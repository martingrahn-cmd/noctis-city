#!/usr/bin/env node
/**
 * routeprobe.mjs — WHY IS ONE ROUTE MORE EXPENSIVE THAN ANOTHER. NOT A GATE.
 *
 *   node tools/routeprobe.mjs                        player vs downtown_dense, interleaved
 *   node tools/routeprobe.mjs --decompose            one camera parameter at a time
 *   node tools/routeprobe.mjs --pairs=3 --frames=1800
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE QUESTION, AND WHY perfcheck CANNOT ANSWER IT.
 *
 * The last attested gate run reports `player` at CPU p95 12.20 ms against a
 * 12.0 ceiling and wall p95 13.10 against 12.5, with per-run spreads of 1.5 and
 * 1.6 ms. CONTRACT §0 rule 6 in one line: **the breach is not resolved by the
 * estimator that measured it.** 0.20 ms against a 1.5 ms spread is 13% of the
 * instrument's own noise, which is §0.1's original incident with a different
 * route's name on it.
 *
 * AND THE INTERESTING PART IS THAT `player` IS CHEAPER IN GEOMETRY THAN THE
 * ROUTES THAT PASS: 318 draws against `highway_speed`'s 428, the same 116 491
 * instances as `downtown_dense`, the same 57 materials, the same render
 * targets. So the cost is not in what is drawn, and a threshold comparison
 * cannot say what it IS in.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE DESIGN: PAIRED AND INTERLEAVED, AND ONE VARIABLE AT A TIME.
 *
 * CONTRACT §6: "Arms must be interleaved when measured — on this machine five
 * sequential arms drifted far enough that removing a whole system measured
 * 1.3 ms SLOWER than leaving it in." So the arms alternate A B A B, each in a
 * FRESH PAGE, and what is reported is the mean of the per-pair DIFFERENCES with
 * its standard error — a paired statistic, in which any drift common to a pair
 * cancels rather than being attributed to the arm that happened to run second.
 *
 * `--decompose` is the half that makes the answer an attribution. The two
 * routes differ in FIVE things at once — field of view, eye height, pace, look
 * pitch, and the lateral offset that puts one on the pavement and the other on
 * the crown of the road — so it takes `downtown_dense` as the base and applies
 * ONE of `player`'s five parameters at a time through
 * `camera.setRouteOverride`, plus a sixth arm with all five together. The sixth
 * arm is the check that the five are the whole difference: if the sum of the
 * five singles does not reconstruct it, something else is going on and the
 * probe says so instead of the operator finding out later.
 *
 * IT ASSERTS NOTHING AND IT MUST NOT. `perfcheck` owns the assertion. This is
 * the instrument the assertion's numbers came from, so that they can be
 * reproduced rather than quoted — the same arrangement `clustercheck.mjs` has.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { startServer, launchBrowser, openPage, readRendererString } from './lib/page.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = path.join(ROOT, 'tools', 'perf-out');

const args = new Map(process.argv.slice(2).map((a) => {
  const [k, v = 'true'] = a.replace(/^--/, '').split('=');
  return [k, v];
}));

const PAIRS = Number(args.get('pairs') || 3);
const FRAMES = Number(args.get('frames') || 1800);
const WARMUP = Number(args.get('warmup') || 300);
const PORT = 5241;

/**
 * `player`'s five camera parameters, as overrides onto `downtown_dense`.
 *
 * READ OFF THE TWO ROUTES RATHER THAN TYPED, so the probe cannot describe a
 * pair of routes that no longer exist — the arms are built in the page from
 * `camera.route(name)` at run time. What is written here is only WHICH KEYS
 * differ, and the lateral is derived from the two paths' own mean z.
 */
const KEYS = ['fov', 'eye', 'speed', 'lookRise', 'lateral'];

function meanSd(xs) {
  const n = xs.length;
  if (!n) return { mean: NaN, sd: NaN, se: NaN, n };
  const m = xs.reduce((a, b) => a + b, 0) / n;
  const v = n > 1 ? xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (n - 1) : 0;
  return { mean: m, sd: Math.sqrt(v), se: Math.sqrt(v / n), n };
}

const pctl = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

await mkdir(OUT, { recursive: true });
const server = await startServer(PORT);
const browser = await launchBrowser();

/**
 * ONE ARM: a fresh page, a route, an optional override, and the frame times.
 *
 * A FRESH PAGE PER ARM, and it is not caution. The canyon field, the chunk
 * cache, the traffic disposition and the TAA history all carry over inside one
 * page, so a second route measured in the same page starts with the first
 * route's world half-resident — which is a measurement of the ORDER the arms
 * ran in. `perfcheck` opens a page per run for the same reason.
 */
async function arm(label, route, override, frames) {
  const { page } = await openPage(browser, {
    viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1,
  });
  try {
    const url = new URL(server.url);
    url.searchParams.set('seed', '1337');
    url.searchParams.set('perf', '1');
    await page.goto(url.toString(), { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => !!window.__NOCTIS_HARNESS__, null, { timeout: 90000 });
    await page.evaluate(() => window.__NOCTIS_HARNESS__.ready);
    await page.evaluate(() => window.__NOCTIS_HARNESS__.takeOver());

    if (override) {
      await page.evaluate(([r, o]) => {
        const cam = window.__NOCTIS__.ctx.get('camera');
        cam.setRouteOverride(r, o);
      }, [route, override]);
    }

    await page.evaluate(async (n) => {
      await window.__NOCTIS_HARNESS__.step(n, 1 / 60);
    }, WARMUP);
    // `startRecording` is what `perfcheck` calls, and it is the only way to open
    // a measurement window: it clears the frame arrays and the peaks together.
    await page.evaluate(() => window.__APEX_PROBE__.startRecording());
    const info = await page.evaluate(async ([r, f]) => {
      const out = await window.__NOCTIS_HARNESS__.runRoute(r, { frames: f, dt: 1 / 60 });
      const rep = window.__APEX_PROBE__.report();
      const i = window.__NOCTIS_HARNESS__.info();
      return {
        route: out,
        cpu: rep.frames.cpuMs,
        wall: rep.frames.wallMs,
        draws: rep.peak.drawCalls,
        tris: rep.peak.triangles,
        instances: rep.visibleInstances,
        cluster: out.cluster,
        fov: i.cameraFov,
        pos: i.cameraPos,
      };
    }, [route, frames || FRAMES]);
    return {
      label,
      cpuP95: pctl(info.cpu, 95),
      cpuP50: pctl(info.cpu, 50),
      wallP95: pctl(info.wall, 95),
      draws: info.draws,
      tris: info.tris,
      instances: info.instances,
      froxel: info.cluster ? info.cluster.peakOccupancy : null,
      metres: info.route.metresTravelled,
      fov: info.fov,
    };
  } finally {
    await page.close();
  }
}

const lines = [];
const say = (s) => { lines.push(s); console.log(s); };

try {
  const probePage = await openPage(browser, { viewport: { width: 400, height: 300 } });
  await probePage.page.goto(server.url, { waitUntil: 'load', timeout: 120000 });
  await probePage.page.waitForFunction(() => !!window.__NOCTIS_HARNESS__, null, { timeout: 90000 });
  say(`GPU: ${await readRendererString(probePage.page)}`);
  const routes = await probePage.page.evaluate(() => {
    const cam = window.__NOCTIS__.ctx.get('camera');
    const pick = (n) => {
      const r = cam.route(n);
      return {
        fov: r.fov, eye: r.eye, speed: r.speed,
        lookRise: r.lookRise != null ? r.lookRise : 0.9,
        meanZ: r.waypoints.reduce((a, w) => a + w[2], 0) / r.waypoints.length,
      };
    };
    return { downtown_dense: pick('downtown_dense'), player: pick('player') };
  });
  await probePage.page.close();

  const A = routes.downtown_dense;
  const B = routes.player;
  say(
    `routeprobe: ${PAIRS} interleaved pairs x ${FRAMES} frames at dt 1/60, ` +
    `${WARMUP} warmup frames, a fresh page per arm.`
  );
  say(
    '  downtown_dense  ' +
    `fov ${A.fov}  eye ${A.eye.toFixed(2)}  speed ${A.speed}  lookRise ${A.lookRise}  meanZ ${A.meanZ.toFixed(2)}`
  );
  say(
    '  player          ' +
    `fov ${B.fov}  eye ${B.eye.toFixed(2)}  speed ${B.speed}  lookRise ${B.lookRise}  meanZ ${B.meanZ.toFixed(2)}`
  );
  say(
    '  NOTE: the player route\'s fov is 50 and downtown_dense\'s is 55 — the NARROWER field is the ' +
    'walking one, so it puts FEWER objects in frustum and MORE pixels on each.'
  );

  /** The full override that should turn `downtown_dense` into `player`. */
  const FULL = {
    fov: B.fov, eye: B.eye, speed: B.speed, lookRise: B.lookRise,
    lateral: +(B.meanZ - A.meanZ).toFixed(3),
  };

  const arms = args.has('window')
    ? [
      /**
       * THE ONE THING `--decompose` CANNOT VARY, because it holds the route
       * fixed: the MEASUREMENT WINDOW. `budget.json` → `capture.framesByRoute`
       * gives `player` 6000 frames against every other route's 1800, and the
       * reason is documented and correct — at `GAIT.walkSpeedMps` = 1.40 m/s,
       * 1800 frames covers 42.0 m against a `floors.metresTravelled` of 120 m,
       * so the floor would reject the route for the crime of being walked.
       *
       * But 6000 frames at dt 1/60 is **100 simulated seconds and about 80
       * seconds of wall clock**, against 30 and about 24 for the others. A p95
       * is the 95th percentile of whatever arrived in the window, and a window
       * three and a third times longer on a machine that drifts has three and a
       * third times as many chances to catch a background hitch. The 1800-frame
       * arm here breaches `metresTravelled` by construction and that is fine:
       * this is a probe and it asserts nothing.
       */
      { label: 'player@1800', route: 'player', override: null, frames: 1800 },
      { label: 'player@6000', route: 'player', override: null, frames: 6000 },
    ]
    : args.has('decompose')
      ? [
        { label: 'base', route: 'downtown_dense', override: null },
        ...KEYS.map((k) => ({
          label: `+${k}`, route: 'downtown_dense', override: { [k]: FULL[k] },
        })),
        { label: '+all five', route: 'downtown_dense', override: FULL },
      ]
      : [
        { label: 'downtown_dense', route: 'downtown_dense', override: null },
        { label: 'player', route: 'player', override: null },
      ];

  /**
   * INTERLEAVED. Every arm is measured once per pass and the passes alternate,
   * so a machine that drifts over the run drifts through every arm equally.
   */
  const results = new Map(arms.map((a) => [a.label, []]));
  for (let p = 0; p < PAIRS; p++) {
    for (const a of arms) {
      const r = await arm(a.label, a.route, a.override, a.frames);
      results.get(a.label).push(r);
      console.log(
        `  pass ${p + 1}  ${a.label.padEnd(16)} cpu p95 ${r.cpuP95.toFixed(2)}  ` +
        `wall p95 ${r.wallP95.toFixed(2)}  draws ${r.draws}  inst ${r.instances}  ` +
        `froxel ${r.froxel}  ${r.metres} m  fov ${r.fov}  ${a.frames || FRAMES} frames`
      );
    }
  }

  const base = arms[0].label;
  say('');
  say('  arm                cpu p95        wall p95       Δcpu vs base (paired)   draws  froxel');
  for (const a of arms) {
    const rs = results.get(a.label);
    const cpu = meanSd(rs.map((r) => r.cpuP95));
    const wall = meanSd(rs.map((r) => r.wallP95));
    const d = a.label === base
      ? null
      : meanSd(rs.map((r, i) => r.cpuP95 - results.get(base)[i].cpuP95));
    say(
      `  ${a.label.padEnd(16)} ${cpu.mean.toFixed(2)} ±${cpu.se.toFixed(2)}   ` +
      `${wall.mean.toFixed(2)} ±${wall.se.toFixed(2)}   ` +
      `${d ? `${d.mean >= 0 ? '+' : ''}${d.mean.toFixed(2)} ±${d.se.toFixed(2)} ms` : '—'.padEnd(18)}` +
      `   ${String(rs[0].draws).padStart(5)}  ${String(rs[0].froxel).padStart(6)}`
    );
  }

  if (args.has('decompose')) {
    const singles = KEYS.map((k) => {
      const rs = results.get(`+${k}`);
      return meanSd(rs.map((r, i) => r.cpuP95 - results.get(base)[i].cpuP95)).mean;
    });
    const sum = singles.reduce((a, b) => a + b, 0);
    const all = meanSd(results.get('+all five').map(
      (r, i) => r.cpuP95 - results.get(base)[i].cpuP95
    ));
    say('');
    say(
      `  SUM OF THE FIVE SINGLES ${sum >= 0 ? '+' : ''}${sum.toFixed(2)} ms against ALL FIVE TOGETHER ` +
      `${all.mean >= 0 ? '+' : ''}${all.mean.toFixed(2)} ±${all.se.toFixed(2)} ms.`
    );
    say(
      '  They agree only if the five are separable. A gap is not noise — it is an interaction, ' +
      'and it is the thing a five-way difference hides.'
    );
  }

  const stamp = args.get('tag') || 'routeprobe';
  const file = path.join(OUT, `${stamp}.log`);
  await writeFile(file, `${lines.join('\n')}\n`);
  console.log(`\nwritten: ${path.relative(ROOT, file)}`);
} finally {
  await browser.close();
  server.child.kill('SIGKILL');
}
