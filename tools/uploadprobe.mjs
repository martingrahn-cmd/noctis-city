#!/usr/bin/env node
/**
 * uploadprobe.mjs — NOT A GATE.
 *
 *   node tools/uploadprobe.mjs
 *   node tools/uploadprobe.mjs --route=downtown_dense --frames=600 --arms=6
 *
 * THE QUESTION. Traffic costs +1.05 ms at the median and +2.0 ms at p95 on
 * `downtown_dense`, for TWO draw calls, while every line of its own per-frame
 * work profiles at 0.10 ms. The cost is in the tail, and a profile that says
 * `vertexAttribPointer` 2.97 ms and `uniformMatrix4fv` 2.21 ms of self time
 * says the cost is GL state and upload rather than simulation.
 *
 * TWO HYPOTHESES ARE ALREADY REFUTED AND ARE NOT RE-RUN HERE.
 *
 *   1. Attribute-identity churn invalidating three's cached vertex-attribute
 *      setup. `instmotion.js` was changed from swapping attribute OBJECTS to
 *      fixed identity with the arrays moving underneath. MEASURED IDENTICAL:
 *      11.70 / 12.20 wall p95 against 11.60 / 12.30. Kept because it is not
 *      worse and the reasoning is sound; it is not the cost.
 *   2. `bodyMesh.castShadow` on the 480-instance body with `frustumCulled =
 *      false`. The comparison was not interleaved, and `downtown_dense` is a
 *      night route where `lighting.js` sets `sun.castShadow = lux > 40` false,
 *      so there is no sun shadow pass for it to be saving. The mechanism does
 *      not survive checking, so the shadow was restored.
 *
 * THE HYPOTHESIS NOBODY HAD TESTED. `instmotion.begin()` reassigns each
 * attribute's `.array` every frame, so three re-uploads the whole attribute
 * with `bufferSubData` into a GL buffer the GPU may still be reading from the
 * previous frame's draw. A driver resolves that by orphaning the storage or by
 * stalling until the read retires, and both are TAIL costs rather than mean
 * ones — which is exactly the signature measured: a median that moves by 1.05
 * ms and a p95 that moves by 2.0 ms.
 *
 * THE TEST. Keep traffic drawn and visible, withhold the per-frame upload for a
 * frame window, and measure. Frozen, the vehicles stop moving on screen and
 * every count is identical: same draw calls, same triangles, same instances,
 * same materials, same froxels. What stops is five `bufferSubData` calls a
 * frame — two mat4 attributes per mesh and the colour and roughness attributes.
 * If the tail collapses, the cost is the upload and the fix is two alternating
 * GL buffers, which is NOT the two attribute objects hypothesis 1 refuted.
 *
 * ARMS ARE INTERLEAVED, ON/OFF/ON/OFF, INSIDE ONE PAGE LOAD. Session 4b's first
 * bisect ran arms in sequence and measured removing a whole system as 1.3 ms
 * SLOWER than leaving it in, because the load average went 2.65 to 4.87 over
 * the five arms. Sequential arms measure drift. CONTRACT §9 rule 6.
 */

import { readFile } from 'node:fs/promises';
import { startServer, launchBrowser, openPage, readRendererString } from './lib/page.mjs';

const BUDGET = JSON.parse(await readFile(new URL('./budget.json', import.meta.url), 'utf8'));

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);

const ROUTE = args.get('route') || 'downtown_dense';
const FRAMES = Number(args.get('frames') || 600);
const ARMS = Number(args.get('arms') || 6);

const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : NaN;
};
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return NaN;
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};

const server = await startServer(5213);
const browser = await launchBrowser();
const { page } = await openPage(browser, {
  viewport: { width: BUDGET.capture.viewport.width, height: BUDGET.capture.viewport.height },
});

const url = new URL(server.url);
for (const [k, v] of Object.entries(BUDGET.capture.params)) url.searchParams.set(k, String(v));
url.searchParams.set('route', ROUTE);

/**
 * A FRESH PAGE PER ARM, AND THE FIRST VERSION OF THIS PROBE DID NOT DO IT.
 *
 * `perfcheck.measureRoute` calls `page.goto` at the top of every measurement,
 * so every number this project has ever published for a route was taken on a
 * page that had run exactly one route. Running six arms inside one page is a
 * different regime and it MEASURED like one: 323 draws and 0.62 M triangles
 * against the gate's 380 and 0.96 M, at 20.0 ms wall p50 against 11.7 — LESS
 * content and nearly twice the frame time, because each `runRoute` teleports
 * the camera back to the path's start and the residency ring re-streams under
 * the measured window.
 *
 * The arms were internally consistent and the A/B was valid within that regime,
 * which is exactly what makes it worth writing down rather than quietly fixing:
 * a comparison can be sound and still be a comparison of something nobody
 * ships. Reload per arm, and the probe measures the frame the gate measures.
 */
async function freshPage(frozen) {
  await page.goto(url.toString(), { waitUntil: 'load', timeout: 90_000 });
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
  const set = await page.evaluate((b) => window.__APEX_HARNESS__.setInstanceUploadFrozen(b), frozen);
  return set;
}

try {
  await page.goto(url.toString(), { waitUntil: 'load', timeout: 90_000 });
  await page.waitForFunction(() => window.__APEX_HARNESS__ && window.__APEX_PROBE__, null, { timeout: 60_000 });
  console.log(`GPU: ${await readRendererString(page)}`);
  console.log(`route ${ROUTE}, ${ARMS} arms x ${FRAMES} frames, interleaved live/frozen, fresh page per arm\n`);

  const rows = [];
  for (let a = 0; a < ARMS; a++) {
    const frozen = a % 2 === 1;
    const set = await freshPage(frozen);
    if (set.traffic !== frozen) {
      console.error(
        `arm ${a}: asked traffic to freeze=${frozen} and it reported ${set.traffic}. ` +
        'Two identical arms would measure no effect and report it as a refutation.'
      );
      process.exit(2);
    }
    await page.evaluate(() => window.__APEX_PROBE__.startRecording());
    await page.evaluate(
      ([r, f]) => window.__APEX_HARNESS__.runRoute(r, { frames: f }),
      [ROUTE, FRAMES]
    );
    const rep = await page.evaluate(() => window.__APEX_PROBE__.report());
    const info = await page.evaluate(() => window.__APEX_HARNESS__.info());
    rows.push({
      arm: a,
      frozen,
      cpuP50: median(rep.frames.cpuMs),
      cpuP95: pct(rep.frames.cpuMs, 95),
      wallP50: median(rep.frames.wallMs),
      wallP95: pct(rep.frames.wallMs, 95),
      wallMean: mean(rep.frames.wallMs),
      draws: info.drawCalls,
      tris: info.triangles,
    });
    const r = rows[rows.length - 1];
    console.log(
      `arm ${a} ${frozen ? 'FROZEN' : ' live '}  ` +
      `cpu p50 ${r.cpuP50.toFixed(2)}  cpu p95 ${r.cpuP95.toFixed(2)}  ` +
      `wall mean ${r.wallMean.toFixed(2)}  wall p50 ${r.wallP50.toFixed(2)}  wall p95 ${r.wallP95.toFixed(2)}  ` +
      `${r.draws} draws  ${(r.tris / 1e6).toFixed(2)}M tris`
    );
  }

  await page.evaluate(() => window.__APEX_HARNESS__.setInstanceUploadFrozen(false));

  const live = rows.filter((r) => !r.frozen);
  const froz = rows.filter((r) => r.frozen);
  const cmp = (k) => {
    const a = median(live.map((r) => r[k]));
    const b = median(froz.map((r) => r[k]));
    return { live: a, frozen: b, delta: a - b };
  };

  console.log('\nMEDIAN OVER ARMS, and the delta is live minus frozen — a positive');
  console.log('number is what the per-frame upload costs.\n');
  for (const k of ['cpuP50', 'cpuP95', 'wallMean', 'wallP50', 'wallP95']) {
    const c = cmp(k);
    console.log(
      `  ${k.padEnd(9)} live ${c.live.toFixed(2)} ms   frozen ${c.frozen.toFixed(2)} ms   ` +
      `delta ${c.delta >= 0 ? '+' : ''}${c.delta.toFixed(2)} ms`
    );
  }

  /**
   * THE SPREAD WITHIN AN ARM TYPE IS THE NOISE FLOOR, MEASURED IN THE SAME RUN
   * AS THE EFFECT. CONTRACT §0 rule 6: a delta smaller than this is not a
   * measurement, and the honest move is to say so rather than to report it.
   */
  const spread = (xs) => (xs.length > 1 ? Math.max(...xs) - Math.min(...xs) : NaN);
  const noise = Math.max(
    spread(live.map((r) => r.wallP95)),
    spread(froz.map((r) => r.wallP95))
  );
  const effect = cmp('wallP95').delta;
  console.log(
    `\n  within-arm wall p95 spread: live ${spread(live.map((r) => r.wallP95)).toFixed(2)} ms, ` +
    `frozen ${spread(froz.map((r) => r.wallP95)).toFixed(2)} ms  ->  noise floor ${noise.toFixed(2)} ms`
  );
  console.log(
    `  effect ${effect.toFixed(2)} ms is ${(effect / noise).toFixed(2)}x the noise floor — ` +
    (Math.abs(effect) < noise
      ? 'NOT RESOLVABLE. The hypothesis is neither confirmed nor refuted by this run.'
      : effect > 0
        ? 'RESOLVED. The per-frame instance upload is the cost.'
        : 'RESOLVED, WITH THE SIGN AGAINST THE HYPOTHESIS. Freezing the upload made it SLOWER, ' +
          'which no mechanism here predicts; suspect drift and re-run.')
  );

  const draws = new Set(rows.map((r) => r.draws));
  const tris = new Set(rows.map((r) => r.tris));
  console.log(
    `\n  counts across all arms: draws ${[...draws].join('/')}, triangles ${[...tris].join('/')} — ` +
    (draws.size === 1 && tris.size === 1
      ? 'identical, so the arms differ in the upload and in nothing else.'
      : 'NOT IDENTICAL. The arms differ in content and this is not an A/B.')
  );
} finally {
  await browser.close();
  server.child.kill('SIGKILL');
}
