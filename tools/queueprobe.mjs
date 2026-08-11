#!/usr/bin/env node
/**
 * queueprobe.mjs — NOT A GATE. Session 21, item 5.
 *
 * WHAT IT ANSWERS, AND WHY IT IS A SERIES RATHER THAN A FRAME.
 *
 * The operator's aerial frame showed bumper-to-bumper traffic across several
 * junctions and reported that it *"looks permanent rather than like a signal
 * cycle"*. That is a statement about a SERIES made from one sample, and there
 * are two worlds that produce that frame:
 *
 *   CONGESTION BY DESIGN — the queue builds through the red and empties on the
 *   green, every cycle, and the picture is a busy street. Then the question is
 *   the density (`trafficLights.contentVehicles` = 160) and the answer is a
 *   content decision.
 *
 *   DEADLOCK — the queue grows without bound because a vehicle stopped past its
 *   own line blocks the junction it has entered, which blocks the crossing
 *   direction, which never clears. Then the question is the mechanism and the
 *   answer is a repair.
 *
 * A single frame cannot tell those apart and no amount of looking at it will.
 * What tells them apart is the queue length at each junction over several full
 * signal cycles, which is what this prints. CONTRACT §9: *measure before
 * theorising. A theory about why a frame looks wrong costs an hour; printing
 * the number costs a minute and is right more often.*
 *
 * IT ASSERTS NOTHING AND MUST NOT. The verdict — is 29 vehicles at a junction
 * too many — is a content judgement, and a gate that made it would be a gate
 * whose threshold nobody derived. What it does is make the distinction
 * decidable: it reports, per junction, the peak, the trough, whether the
 * trough returns to zero within a cycle, and the slope of the peaks over the
 * window. A trough that reaches zero every cycle is the first world; a series
 * of rising peaks with a trough that never reaches zero is the second.
 *
 * Usage:
 *   node tools/queueprobe.mjs                       downtown_dense, 6 cycles
 *   node tools/queueprobe.mjs --route=night_rain --cycles=8
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { startServer, launchBrowser, openPage, readRendererString, ROOT } from './lib/page.mjs';
import path from 'node:path';

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v === undefined ? true : v];
  })
);

const ROUTE = String(args.get('route') || 'downtown_dense');
const SEED = String(args.get('seed') || '1337');
/**
 * `traffic.js` → `CYCLE_S = 2 · (GREEN_S + AMBER_S)` = 36 s. Six cycles is
 * 216 simulated seconds: long enough that a linear trend in the peaks is
 * separable from one bad cycle, and short enough to run.
 */
const CYCLE_S = 36;
const CYCLES = Number(args.get('cycles') || 6);
/**
 * The simulated step, and it is FIXED rather than wall-clock for the reason
 * CONTRACT §8 gives about every capture in this project: a series that depends
 * on how fast the machine rendered is not a series.
 */
const DT = Number(args.get('dt') || 1 / 20);
/**
 * One sample every ~0.5 s — about 72 per cycle, which resolves an 18 s red
 * comfortably.
 *
 * `dt` IS 1/20 AND NOT 1/60, AND THE REASON IS THE MEASUREMENT RATHER THAN THE
 * MACHINE. What is measured is a queue length over 216 simulated seconds, and a
 * queue is a count of stationary vehicles: it is not resolved any better by
 * integrating three times as often, and `traffic.js`'s braking is a first-order
 * integration whose stability bound at BRAKE_A = 2.0 m/s^2 is far outside
 * 0.05 s. What 1/60 buys is 12 960 rendered frames instead of 4 320 for the
 * same 216 seconds, and every one of them renders the whole city. CONTRACT
 * §4.2's clamp is [0, 0.1]; this is half of it.
 */
const SAMPLE_EVERY = Number(args.get('sample') || 10);

const out = path.join(ROOT, 'tools', 'perf-out');

const server = await startServer(5187);
const browser = await launchBrowser();
const { page, consoleErrors, pageErrors } = await openPage(browser, {
  /**
   * SMALL ON PURPOSE. Nothing here reads a pixel — the whole measurement is
   * `traffic.stats()`, which is CPU state — so the viewport buys nothing and
   * costs the fill rate of every one of 4 320 frames.
   */
  viewport: { width: 480, height: 270 }, deviceScaleFactor: 1,
});

const lines = [];
const log = (...m) => { const s = m.join(' '); console.log(s); lines.push(s); };

try {
  await page.goto(`${server.url}?perf=1&seed=${SEED}`, { waitUntil: 'load', timeout: 90_000 });
  await page.waitForFunction(() => window.__NOCTIS_HARNESS__, null, { timeout: 60_000 });
  await page.evaluate(() => window.__NOCTIS_HARNESS__.ready);
  log(`queueprobe: ${await readRendererString(page)}`);
  log(`route ${ROUTE}, seed ${SEED}, ${CYCLES} cycles x ${CYCLE_S} s at dt ${DT.toFixed(4)} s`);

  const faults = await page.evaluate(() => window.__NOCTIS_HARNESS__.faults());
  if (faults.length) throw new Error(`${faults.length} module(s) quarantined: ${faults.map((f) => f.name).join(', ')}`);

  await page.evaluate(() => window.__NOCTIS_HARNESS__.takeOver && window.__NOCTIS_HARNESS__.takeOver());
  /**
   * THE CAMERA IS PLACED ONCE AND THEN LEFT ALONE.
   *
   * `traffic.js` simulates within 190 m of the camera, so where it stands
   * decides WHICH junctions are in the census — but a camera that keeps moving
   * changes that set every frame, and a queue series over a changing set of
   * junctions is not a series. One `poseRoute` at the route's midpoint, then
   * nothing: the whole measurement is CPU state and no pixel is read.
   */
  if (!args.has('static')) {
    await page.evaluate((r) => window.__NOCTIS_HARNESS__.prepareRoute(r), ROUTE);
    await page.evaluate(([r, u]) => window.__NOCTIS_HARNESS__.sampleRouteAt(r, u), [ROUTE, 0.5]);
  }

  const totalFrames = Math.round((CYCLES * CYCLE_S) / DT);
  /** @type {Array<{t:number, worst:number, junctions:number, held:number, byJ:object}>} */
  const series = [];
  for (let f = 0; f < totalFrames; f += SAMPLE_EVERY) {
    await page.evaluate(([n, dt]) => window.__NOCTIS_HARNESS__.step(n, dt), [SAMPLE_EVERY, DT]);
    if (page.isClosed()) throw new Error(`the page closed after ${series.length} samples`);
    const s = await page.evaluate(() => {
      const t = window.__NOCTIS_HARNESS__.trafficStats ? window.__NOCTIS_HARNESS__.trafficStats() : null;
      if (!t) return null;
      return {
        worst: t.worstQueue, junctions: t.queuedJunctions, held: t.holdingAtRed,
        byJ: t.queueByJunction, stopped: t.stopped, worstStopLineM: t.worstStopLineM,
      };
    });
    if (!s) throw new Error('harness.trafficStats() is missing — nothing to measure');
    series.push({ t: ((f + SAMPLE_EVERY) * DT), ...s });
  }

  // --- per junction, over the whole window ---------------------------------
  const junctions = new Map();
  for (const s of series) {
    for (const [k, v] of Object.entries(s.byJ)) {
      if (!junctions.has(k)) junctions.set(k, []);
    }
  }
  for (const [k, arr] of junctions) {
    for (const s of series) arr.push(s.byJ[k] || 0);
  }

  log('');
  log('  junction          peak  trough  zeroed  cycles seen   peaks by cycle');
  const perCycle = Math.max(1, Math.round(CYCLE_S / (SAMPLE_EVERY * DT)));
  const rows = [];
  for (const [k, arr] of junctions) {
    const peak = Math.max(...arr);
    const trough = Math.min(...arr);
    const zeroed = arr.some((v) => v === 0);
    const peaks = [];
    for (let c = 0; c * perCycle < arr.length; c++) {
      peaks.push(Math.max(...arr.slice(c * perCycle, (c + 1) * perCycle)));
    }
    rows.push({ k, peak, trough, zeroed, peaks });
  }
  rows.sort((a, b) => b.peak - a.peak);
  for (const r of rows.slice(0, 14)) {
    log(`  ${r.k.padEnd(16)} ${String(r.peak).padStart(4)}  ${String(r.trough).padStart(6)}  ` +
      `${(r.zeroed ? 'yes' : 'NO ').padStart(6)}  ${String(r.peaks.length).padStart(11)}   ${r.peaks.join(' ')}`);
  }

  const anyNeverZero = rows.filter((r) => !r.zeroed);
  const worstOverall = rows.length ? rows[0].peak : 0;
  /**
   * THE VERDICT, AS A DISTINCTION RATHER THAN AS A PASS.
   *
   * `growing` compares the mean of the last third of a junction's per-cycle
   * peaks against the first third. A queue that empties every cycle has a flat
   * or noisy trend; a deadlock has a rising one, because every cycle adds the
   * arrivals it could not discharge.
   */
  let growing = 0;
  for (const r of rows) {
    const n = r.peaks.length;
    if (n < 3) continue;
    const k = Math.max(1, Math.floor(n / 3));
    const first = r.peaks.slice(0, k).reduce((a, b) => a + b, 0) / k;
    const last = r.peaks.slice(n - k).reduce((a, b) => a + b, 0) / k;
    if (last > first * 1.5 + 1) growing++;
  }

  log('');
  log(`  ${junctions.size} junction(s) queued at some point in the window; worst single queue ${worstOverall} vehicles`);
  log(`  ${anyNeverZero.length} junction(s) NEVER reached zero in ${CYCLES} cycles`);
  log(`  ${growing} junction(s) whose per-cycle peaks grew by more than 50% from the first third to the last`);
  log('');
  if (anyNeverZero.length === 0 && growing === 0) {
    log('  READING: every queue emptied within the window and no junction is trending upward.');
    log('  That is CONGESTION BY DESIGN — the picture is a signal cycle, not a deadlock, and the');
    log('  open question is the density rather than the mechanism.');
  } else {
    log('  READING: at least one junction never cleared or is trending upward. That is the DEADLOCK');
    log('  side of the distinction and the mechanism is the question. The prime suspect named in the');
    log('  session brief is a vehicle stopped past its own line blocking the box it has entered —');
    log('  perfcheck asserts worstStopLineM >= 0 for exactly that reason; this run measured ' +
      `${series.length ? series[series.length - 1].worstStopLineM : 'n/a'} m.`);
  }

  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  log('');
  log(`  held at a red, mean over the window: ${mean(series.map((s) => s.held)).toFixed(1)} vehicles of ` +
    `${series.length ? '160' : '?'}; braking, mean: ${mean(series.map((s) => s.stopped)).toFixed(1)}`);
  log(`  worst stop-line clearance over the window: ` +
    `${Math.min(...series.map((s) => (isFinite(s.worstStopLineM) ? s.worstStopLineM : Infinity))).toFixed(3)} m ` +
    `(negative is a vehicle's nose past its own painted bar)`);

  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, `queueprobe-${ROUTE}.json`), JSON.stringify({ route: ROUTE, seed: SEED, cycleS: CYCLE_S, cycles: CYCLES, series, rows }, null, 2));
  await writeFile(path.join(out, `queueprobe-${ROUTE}.log`), lines.join('\n') + '\n');
  log(`\n  written to tools/perf-out/queueprobe-${ROUTE}.{json,log}`);
  if (consoleErrors.length) log(`  console errors: ${consoleErrors.length}`);
  if (pageErrors.length) log(`  page errors: ${pageErrors.length}`);
} finally {
  await browser.close();
  server.child.kill('SIGKILL');
}
