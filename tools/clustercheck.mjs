#!/usr/bin/env node
/**
 * clustercheck.mjs — NOT A GATE. The cluster grid, measured with the pool
 * saturated.
 *
 *   node tools/clustercheck.mjs
 *   node tools/clustercheck.mjs --route=night_rain --frames=600
 *   node tools/clustercheck.mjs --json
 *
 * It asserts nothing and it must not. `perfcheck` owns the assertion
 * (`clusterOverflow` false on all three routes with the pool saturated); this
 * is the instrument that produced the numbers the assertion was written from,
 * and it exists so that those numbers can be reproduced and disagreed with
 * rather than quoted from a session report.
 *
 * WHAT IT MEASURES, AND WHY EACH ONE
 *
 *   peak froxel occupancy   The binding limit is CLUSTER.maxPerCluster, not
 *                           CLUSTER.maxLights — a light in the pool costs five
 *                           texels, a light in a froxel costs a shader
 *                           iteration for every pixel of that froxel. The
 *                           margin is maxPerCluster minus this, and it is the
 *                           number that decides whether traffic fits.
 *   pool occupancy          The other cap, reported beside it so the two are
 *                           never confused again.
 *   assigned indices        The froxel writes. The A/B below is what turns the
 *                           cone bound's 1/(8·cos³θ) from a derivation into a
 *                           measurement (CONTRACT §9 rule 2).
 *
 * Both sides of the A/B run in the SAME page and the SAME route, back to back,
 * because the quantity is a count and not a time — counts do not drift, so the
 * paired-run discipline that timings need does not apply and the extra browser
 * launch would only add variance to the streaming state.
 */

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { startServer, launchBrowser, openPage, readRendererString, rendererIsSoftware } from './lib/page.mjs';

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);
const JSON_OUT = args.has('json');
const log = (...m) => { if (!JSON_OUT) console.log(...m); };

const BUDGET = JSON.parse(await readFile(new URL('./budget.json', import.meta.url), 'utf8'));
const TRAFFIC = BUDGET.trafficLights;
const routes = args.has('route') ? [args.get('route')] : BUDGET.capture.routes;
const frames = Number(args.get('frames') || BUDGET.capture.measureFrames);

const spec = {
  /**
   * `--vehicles` exists because the A/B at the budgeted 48 CANNOT measure the
   * cone bound's saving: with the bound off, all three routes drive the flat
   * index list to `CLUSTER.maxIndices` exactly and the assignment loop breaks
   * early, so the unbounded index count is not what the unbounded grid wanted —
   * it is the cap. A ratio taken against a saturated denominator is a lower
   * bound wearing a measurement's clothes, which is CONTRACT §9's shape.
   * Running the pair at a count where neither side clips is what turns it back
   * into a number.
   */
  vehicles: Number(args.get('vehicles') || TRAFFIC.vehicles),
  radius: TRAFFIC.radiusM,
  coneOuterDeg: TRAFFIC.coneOuterDeg,
};

let server;
let browser;
let opened;
const rows = [];

try {
  server = await startServer(5183);
  browser = await launchBrowser();
  opened = await openPage(browser, {
    viewport: { width: BUDGET.capture.viewport.width, height: BUDGET.capture.viewport.height },
    deviceScaleFactor: BUDGET.capture.viewport.dpr,
  });
  const page = opened.page;

  await page.goto(`${server.url}?perf=1&seed=1337`, { waitUntil: 'load', timeout: 90_000 });
  await page.waitForFunction(() => window.__NOCTIS_HARNESS__, null, { timeout: 60_000 });
  await page.evaluate(() => window.__NOCTIS_HARNESS__.ready);

  const gpu = await readRendererString(page);
  if (rendererIsSoftware(gpu)) throw new Error(`software renderer (${gpu})`);
  log(`GPU: ${gpu}\n`);

  /**
   * --sweep: where does the froxel saturate?
   *
   * This is the derivation behind `trafficLights.vehicles`, run rather than
   * argued. A shorter route than the gate's, deliberately: occupancy is a
   * count, the peak is reached within the first few seconds of a jam, and a
   * sweep at 1800 frames per point would take an hour to produce the same
   * integers.
   */
  if (args.has('sweep')) {
    const sweepFrames = Number(args.get('frames') || 600);
    const route = routes[0];
    log(`sweep on ${route}, ${sweepFrames} frames per point\n`);
    log('  vehicles  lights  peak froxel  margin  at cap   pool  indices  overflow');
    const sweep = [];
    for (const vehicles of [0, 12, 24, 36, 48, 60, 72, 96]) {
      if (vehicles === 0) {
        await page.evaluate(() => window.__NOCTIS_HARNESS__.clearTraffic());
      } else {
        await page.evaluate((s) => window.__NOCTIS_HARNESS__.saturateTraffic(s), { ...spec, vehicles });
      }
      const info = await page.evaluate(
        ([r, f]) => window.__NOCTIS_HARNESS__.runRoute(r, { frames: f }),
        [route, sweepFrames]
      );
      const c = info.cluster;
      sweep.push({ vehicles, ...c });
      log(
        `  ${String(vehicles).padStart(8)}  ${String(c.trafficLights).padStart(6)}  ` +
        `${String(c.peakOccupancy).padStart(11)}  ${String(c.occupancyMargin).padStart(6)}  ` +
        `${String(c.clustersAtCap).padStart(6)}  ${String(c.lightCount).padStart(5)}  ` +
        `${String(c.assignedIndices).padStart(7)}  ${c.overflow ? 'YES' : 'no'}`
      );
    }
    await mkdir(new URL('./perf-out/', import.meta.url), { recursive: true });
    await writeFile(
      new URL('./perf-out/cluster-sweep.json', import.meta.url),
      JSON.stringify({ route, frames: sweepFrames, spec, sweep }, null, 1)
    );
    await opened.context.close();
    await browser.close();
    server.child.kill('SIGKILL');
    if (JSON_OUT) console.log(JSON.stringify({ route, sweep }, null, 2));
    else console.log('\nWritten to tools/perf-out/cluster-sweep.json.');
    process.exit(0);
  }

  const made = await page.evaluate((s) => window.__NOCTIS_HARNESS__.saturateTraffic(s), spec);
  log(
    `pool saturated: ${made.vehicles} vehicles → ${made.lights} placeholder headlights, ` +
    `${made.coneOuterDeg}° half-angle, ${made.radius} m throw\n` +
    `cone bound, from geometry: 1/(8·cos³${made.coneOuterDeg}°) = 1/${(1 / made.coneBoundVolumeRatio).toFixed(3)} ` +
    `→ ${(1 / made.coneBoundVolumeRatio).toFixed(2)}× fewer froxels claimed\n`
  );

  for (const route of routes) {
    const pair = {};
    for (const coneBound of [true, false]) {
      await page.evaluate((on) => window.__NOCTIS_HARNESS__.setConeBound(on), coneBound);
      const info = await page.evaluate(
        ([r, f]) => window.__NOCTIS_HARNESS__.runRoute(r, { frames: f }),
        [route, frames]
      );
      pair[coneBound ? 'bounded' : 'unbounded'] = info.cluster;
    }
    // Leave the world in its shipping configuration.
    await page.evaluate(() => window.__NOCTIS_HARNESS__.setConeBound(true));

    const b = pair.bounded;
    const u = pair.unbounded;
    rows.push({
      route,
      frames,
      maxPerCluster: b.maxPerCluster,
      maxLights: b.maxLights,
      trafficLights: b.trafficLights,
      peakOccupancy: b.peakOccupancy,
      occupancyMargin: b.occupancyMargin,
      clustersAtCap: b.clustersAtCap,
      lightCount: b.lightCount,
      poolMargin: b.poolMargin,
      overflow: b.overflow,
      indicesBounded: b.assignedIndices,
      indicesUnbounded: u.assignedIndices,
      indexRatio: +(u.assignedIndices / Math.max(1, b.assignedIndices)).toFixed(3),
      /**
       * True when the unbounded side hit the index cap, which makes the ratio
       * above a LOWER BOUND and not a measurement. Reported rather than left
       * for the reader to notice.
       */
      unboundedClipped: u.assignedIndices >= b.maxIndices - b.maxPerCluster,
      peakOccupancyUnbounded: u.peakOccupancy,
      overflowUnbounded: u.overflow,
    });

    log(
      `${b.overflow ? '✗' : '✓'} ${route.padEnd(16)} ` +
      `peak froxel ${String(b.peakOccupancy).padStart(3)} of ${b.maxPerCluster} ` +
      `(margin ${String(b.occupancyMargin).padStart(3)}, ${b.clustersAtCap} at cap)  ` +
      `pool ${String(b.lightCount).padStart(3)} of ${b.maxLights} (margin ${b.poolMargin})  ` +
      `indices ${b.assignedIndices} bounded / ${u.assignedIndices} unbounded = ` +
      `${(u.assignedIndices / Math.max(1, b.assignedIndices)).toFixed(2)}×` +
      (u.assignedIndices >= b.maxIndices - b.maxPerCluster
        ? '  [UNBOUNDED CLIPPED AT maxIndices — the ratio is a lower bound]'
        : '') +
      (u.overflow ? `  [unbounded overflows: peak froxel ${u.peakOccupancy}]` : '')
    );
  }
} catch (e) {
  if (opened) await opened.context.close();
  if (browser) await browser.close();
  if (server) server.child.kill('SIGKILL');
  console.error('harness: run failed —', e.message);
  process.exit(2);
}

await opened.context.close();
await browser.close();
server.child.kill('SIGKILL');

await mkdir(new URL('./perf-out/', import.meta.url), { recursive: true });
await writeFile(
  new URL('./perf-out/cluster.json', import.meta.url),
  JSON.stringify({ spec, rows }, null, 1)
);

if (JSON_OUT) {
  console.log(JSON.stringify({ spec, rows }, null, 2));
} else {
  const worst = rows.reduce((a, r) => (r.occupancyMargin < a.occupancyMargin ? r : a), rows[0]);
  console.log(
    `\nWorst froxel across ${rows.length} route(s): ${worst.peakOccupancy} of ${worst.maxPerCluster} ` +
    `on ${worst.route} — margin ${worst.occupancyMargin}.`
  );
  console.log('Written to tools/perf-out/cluster.json. This asserts nothing; perfcheck does.');
}
