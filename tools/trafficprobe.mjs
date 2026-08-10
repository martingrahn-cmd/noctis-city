#!/usr/bin/env node
/**
 * trafficprobe.mjs — NOT A GATE.
 *
 *   node tools/trafficprobe.mjs
 *   node tools/trafficprobe.mjs --route=downtown_dense --frames=1800 --arms=6
 *
 * THE QUESTION, AND IT IS THE ONE STATE.md SAID TO ANSWER FIRST.
 * `night_rain` finished session 5 with two pooled medians of 11.80 and 12.50 ms
 * against a ceiling of 12.5, i.e. green by EQUALITY and by nothing else, with
 * the estimator's own reproducibility on that route (0.70 ms) larger than its
 * margin. Session 4b had measured the same route at 11.50–11.70 on single runs,
 * and session 5 added a wheel layer — one draw call, 640 instances, ~25 600
 * triangles, 82 kB a frame of upload. Nobody had bisected it.
 *
 * WHY THIS AND NOT ANOTHER SUITE RUN. A suite run costs twenty-five minutes and
 * answers a question about the whole frame: it produces another pair of absolute
 * numbers, on a machine whose load has already invalidated a session's worth of
 * absolutes once (STATE §0), and two more pooled medians 0.70 ms apart would
 * settle nothing. An INTERLEAVED A/B measures the difference in the same run as
 * the noise floor, and interleaving is the one thing that survives a machine
 * that drifts — which is why every bisect in this project is interleaved and
 * why the one that was not (session 4b's, sequential) measured REMOVING a whole
 * system as 1.3 ms slower than leaving it in.
 *
 * WHAT THE ARMS ARE. `?traffic=0` removes the traffic module entirely (main.js
 * registers it behind that switch), so the delta is the WHOLE cost of traffic on
 * this route — bodies, wheels, light lines, the per-instance motion layers and
 * the 96 headlamps in the froxel grid. IT IS NOT THE COST OF THE WHEELS ALONE
 * and this probe does not claim to isolate them: if the whole of traffic is
 * comfortably inside the margin then the wheels are too, and if it is not then
 * a second bisect has somewhere to start. Stating the smaller claim is the point
 * of stating it at all.
 *
 * THE COUNTS DIFFER BETWEEN ARMS BY DESIGN, which is the opposite of
 * `uploadprobe.mjs` where identical counts were the check that the arms differed
 * in one thing. Here the check is that they differ by EXACTLY the traffic
 * content and nothing else, so both arms' counts are printed and the difference
 * is named.
 *
 * ARMS ARE INTERLEAVED, ON/OFF/ON/OFF, WITH A FRESH PAGE PER ARM — the same
 * regime `perfcheck.measureRoute` measures in, for the reason `uploadprobe.mjs`
 * writes out at length: six arms inside one page re-streams the residency ring
 * under the measured window and measures a frame nobody ships.
 */

import { readFile } from 'node:fs/promises';
import { startServer, launchBrowser, openPage, readRendererString, rendererIsSoftware } from './lib/page.mjs';

const BUDGET = JSON.parse(await readFile(new URL('./budget.json', import.meta.url), 'utf8'));

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);

const ROUTE = args.get('route') || 'night_rain';
const FRAMES = Number(args.get('frames') || BUDGET.capture.measureFrames);
const ARMS = Number(args.get('arms') || 6);
const CEILING = BUDGET.ceilings.wallFrameMsP95;

const sorted = (xs) => [...xs].filter(Number.isFinite).sort((a, b) => a - b);
const pct = (xs, p) => {
  const s = sorted(xs);
  return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : NaN;
};
const median = (xs) => {
  const s = sorted(xs);
  if (!s.length) return NaN;
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const spread = (xs) => (xs.length > 1 ? Math.max(...xs) - Math.min(...xs) : NaN);

const server = await startServer(5196);
const browser = await launchBrowser();
const { page } = await openPage(browser, {
  viewport: { width: BUDGET.capture.viewport.width, height: BUDGET.capture.viewport.height },
  deviceScaleFactor: BUDGET.capture.viewport.dpr,
});

const urlFor = (withTraffic) => {
  const u = new URL(server.url);
  for (const [k, v] of Object.entries(BUDGET.capture.params)) u.searchParams.set(k, String(v));
  u.searchParams.set('route', ROUTE);
  u.searchParams.set('traffic', withTraffic ? '1' : '0');
  return u.toString();
};

try {
  await page.goto(urlFor(true), { waitUntil: 'load', timeout: 90_000 });
  await page.waitForFunction(() => window.__APEX_HARNESS__ && window.__APEX_PROBE__, null, { timeout: 60_000 });
  const gpu = await readRendererString(page);
  if (rendererIsSoftware(gpu)) {
    throw new Error(`software renderer (${gpu}) — every number below would be of a rasteriser nobody ships`);
  }
  console.log(`GPU: ${gpu}`);
  console.log(
    `route ${ROUTE}, ${ARMS} arms x ${FRAMES} frames, interleaved traffic on/off, fresh page per arm, ` +
    `ceiling ${CEILING} ms\n`
  );

  const rows = [];
  for (let a = 0; a < ARMS; a++) {
    const withTraffic = a % 2 === 0;
    await page.goto(urlFor(withTraffic), { waitUntil: 'load', timeout: 90_000 });
    await page.waitForFunction(() => window.__APEX_HARNESS__ && window.__APEX_PROBE__, null, { timeout: 60_000 });
    await page.evaluate(() => window.__APEX_HARNESS__.ready);
    await page.evaluate(
      (n) => new Promise((res) => {
        let i = 0;
        const step = () => (++i >= n ? res() : requestAnimationFrame(step));
        requestAnimationFrame(step);
      }),
      BUDGET.capture.warmupFrames
    );

    /**
     * THE ARM IS VERIFIED AGAINST THE LIVE MODULE LIST AND NOT AGAINST THE URL
     * IT WAS ASKED FOR. A typo in a query parameter gives two identical arms, a
     * delta of zero, and a confident refutation of whatever was being tested —
     * which is `uploadprobe.mjs`'s freeze check one level up.
     */
    const hasTraffic = await page.evaluate(() => !!window.__NOCTIS__.ctx.get('traffic'));
    if (hasTraffic !== withTraffic) {
      throw new Error(
        `arm ${a}: asked for traffic=${withTraffic} and ctx.get('traffic') reports ${hasTraffic}. ` +
        'Two identical arms would measure no effect and report it as a settlement.'
      );
    }

    await page.evaluate(() => window.__APEX_PROBE__.startRecording());
    await page.evaluate(
      ([r, f]) => window.__APEX_HARNESS__.runRoute(r, { frames: f }),
      [ROUTE, FRAMES]
    );
    const rep = await page.evaluate(() => window.__APEX_PROBE__.report());

    /**
     * `report.peak.drawCalls`, WHICH IS THE QUANTITY THE GATE ASSERTS, AND THE
     * FIRST VERSION OF THIS READ A DIFFERENT ONE.
     *
     * It used `harness.info().drawCalls`, which is `renderer.info.render.calls`
     * for the LAST FRAME and includes the twenty-six calls of the post chain.
     * On `night_rain` that reported 349 against the 381 `perfcheck` publishes —
     * a peak over 1800 frames of the SCENE pass alone. The A/B was unaffected
     * because both arms read the same quantity at the same point of the same
     * deterministic route, and that is exactly what makes it worth writing out:
     * the delta was right and the absolute would have been read as a route's
     * draw count and compared against a floor of 360 it was never measuring.
     * CONTRACT §9, in this file, today.
     */
    rows.push({
      arm: a,
      withTraffic,
      cpuP50: median(rep.frames.cpuMs),
      cpuP95: pct(rep.frames.cpuMs, 95),
      wallP50: median(rep.frames.wallMs),
      wallP95: pct(rep.frames.wallMs, 95),
      wallMean: mean(rep.frames.wallMs),
      draws: rep.peak.drawCalls,
      tris: rep.peak.triangles,
    });
    const r = rows[rows.length - 1];
    console.log(
      `arm ${a} ${withTraffic ? 'traffic ON ' : 'traffic OFF'}  ` +
      `cpu p50 ${r.cpuP50.toFixed(2)}  cpu p95 ${r.cpuP95.toFixed(2)}  ` +
      `wall p50 ${r.wallP50.toFixed(2)}  wall p95 ${r.wallP95.toFixed(2)}  ` +
      `${r.draws} draws  ${(r.tris / 1e6).toFixed(2)}M tris`
    );
  }

  const on = rows.filter((r) => r.withTraffic);
  const off = rows.filter((r) => !r.withTraffic);
  const cmp = (k) => {
    const a = median(on.map((r) => r[k]));
    const b = median(off.map((r) => r[k]));
    return { on: a, off: b, delta: a - b };
  };

  console.log('\nMEDIAN OVER ARMS. The delta is ON minus OFF — a positive number is');
  console.log('what the whole traffic module costs on this route.\n');
  for (const k of ['cpuP50', 'cpuP95', 'wallP50', 'wallP95']) {
    const c = cmp(k);
    console.log(
      `  ${k.padEnd(8)} on ${c.on.toFixed(2)} ms   off ${c.off.toFixed(2)} ms   ` +
      `delta ${c.delta >= 0 ? '+' : ''}${c.delta.toFixed(2)} ms`
    );
  }

  /**
   * THE WITHIN-ARM SPREAD IS THE NOISE FLOOR, measured in the same run as the
   * effect and on the same machine at the same moment. CONTRACT §0 rule 6: a
   * delta smaller than this is not a measurement, and saying so is the result.
   */
  const noise = Math.max(spread(on.map((r) => r.wallP95)), spread(off.map((r) => r.wallP95)));
  const effect = cmp('wallP95').delta;
  console.log(
    `\n  within-arm wall p95 spread: on ${spread(on.map((r) => r.wallP95)).toFixed(2)} ms, ` +
    `off ${spread(off.map((r) => r.wallP95)).toFixed(2)} ms  ->  noise floor ${noise.toFixed(2)} ms`
  );
  console.log(
    `  effect ${effect >= 0 ? '+' : ''}${effect.toFixed(2)} ms is ${(Math.abs(effect) / noise).toFixed(2)}x the noise floor — ` +
    (Math.abs(effect) < noise
      ? 'NOT RESOLVABLE from zero by this run.'
      : effect > 0
        ? 'RESOLVED. Traffic costs this much on this route.'
        : 'RESOLVED WITH THE SIGN AGAINST THE HYPOTHESIS. Removing traffic made it SLOWER, which no ' +
          'mechanism here predicts; suspect drift and re-run.')
  );

  /**
   * WHERE THE MARGIN ACTUALLY IS. The ON arms are the world that ships; the
   * ceiling is compared against them and not against the median of everything.
   * Reported as the WORST on-arm as well as the median, because CONTRACT §10's
   * standing rule is to report the failing run and not the lucky one.
   */
  const onP95 = on.map((r) => r.wallP95);
  console.log(
    `\n  traffic-on wall p95 across arms: [${onP95.map((v) => v.toFixed(2)).join(' ')}]  ` +
    `median ${median(onP95).toFixed(2)} ms, worst ${Math.max(...onP95).toFixed(2)} ms, ceiling ${CEILING} ms`
  );
  console.log(
    `  margin at the median ${(CEILING - median(onP95)).toFixed(2)} ms, at the worst arm ` +
    `${(CEILING - Math.max(...onP95)).toFixed(2)} ms`
  );

  const dDraws = median(on.map((r) => r.draws)) - median(off.map((r) => r.draws));
  const dTris = median(on.map((r) => r.tris)) - median(off.map((r) => r.tris));
  console.log(
    `\n  counts: on ${median(on.map((r) => r.draws))} draws / ${(median(on.map((r) => r.tris)) / 1e6).toFixed(2)}M tris, ` +
    `off ${median(off.map((r) => r.draws))} / ${(median(off.map((r) => r.tris)) / 1e6).toFixed(2)}M  ->  ` +
    `traffic is ${dDraws} draws and ${(dTris / 1e3).toFixed(1)}k triangles`
  );
  console.log(
    `  within-arm count spread: on draws ${spread(on.map((r) => r.draws))}, off draws ${spread(off.map((r) => r.draws))} — ` +
    (spread(on.map((r) => r.draws)) === 0 && spread(off.map((r) => r.draws)) === 0
      ? 'counts do not drift, so the arms differ in traffic and in nothing else.'
      : 'COUNTS DRIFTED WITHIN AN ARM TYPE, so the arms differ in more than traffic and this is not an A/B.')
  );
} finally {
  await browser.close();
  server.child.kill('SIGKILL');
}
