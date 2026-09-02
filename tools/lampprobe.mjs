#!/usr/bin/env node
/**
 * lampprobe.mjs — IS THE LAMP HEAD OVER THE THING IT LIGHTS? NOT A GATE, and it
 * must never become one. SESSION 68, ITEM 2.
 *
 *   node tools/lampprobe.mjs
 *   node tools/lampprobe.mjs --at=2048,40,-400
 *
 * ════════════════════════════════════════════════════════════════════════════
 * WHY IT EXISTS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The operator's frame at a river crossing: *"the arms hang out over the water
 * and the fields on both sides instead of over the carriageway."*
 *
 * The brief offered two mechanisms and asked for a number to separate them:
 *
 *   (A) `put()` MIRRORED every feature's yaw for eight sessions before session
 *       65 touched it, and a lamp is asymmetric. That error is CONSTANT.
 *   (B) The road became a POLYLINE in session 62 while the lamps still read the
 *       chunk LATTICE. That error GROWS WITH CURVATURE.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * AND THE CONTROL IS WHAT THIS TOOL IS REALLY FOR — §9 ROW 71's OWN SHAPE.
 *
 * A street lamp's yaw is `(axis === 'x' ? 0 : -90) + (side < 0 ? 180 : 0)`,
 * which is CARDINAL, off the chunk lattice, with no road tangent in it at all.
 * **So a heading measured against a tangent also derived from that lattice
 * would agree with itself perfectly and prove nothing** — one expression
 * compared against a copy of itself, which is exactly how `waterprobe` came to
 * report *"8 of 8 matched, worst 0.00 m"* with a discriminator that could not
 * discriminate.
 *
 * So this reads NEITHER of them. It takes the two DELIVERED instance matrices —
 * `city:lamps` for the column, `city:bowls` for the head — and judges them with
 * `inRiver`, the river's own envelope: a pure `citygen` predicate that no lamp
 * has ever consulted, and the same one the generator already refuses COLUMNS
 * with. Two independent deliveries and a third-party judge.
 *
 * THE CONTROL RUNS FIRST AND IT IS TWO-SIDED (§7.3). `columnsOverWater` must be
 * **0** — the generator has refused those since session 19 — and `aimed` must
 * be a large fraction of `bowls`, because a run that pairs nothing would report
 * "0 heads over water" and look like a pass. An instrument that can only say
 * yes is not an instrument.
 */

import { startServer, launchBrowser, openPage, readRendererString } from './lib/page.mjs';
import { CITY, inRiver, riverEdges, exitRoadYawDeg, EXIT_ROAD } from '../src/lib/citygen.js';

const args = new Map(process.argv.slice(2).map((a) => {
  const s = a.replace(/^--/, '');
  const i = s.indexOf('=');
  return i < 0 ? [s, 'true'] : [s.slice(0, i), s.slice(i + 1)];
}));
const AT = (args.get('at') || '2048,40,-400').split(',').map(Number);
const SEED = args.get('seed') || '1337';

const server = await startServer(5217);
const browser = await launchBrowser();
const { page } = await openPage(browser, { viewport: { width: 800, height: 450 } });
try {
  const url = new URL(server.url);
  url.searchParams.set('seed', SEED);
  url.searchParams.set('paused', '1');
  await page.goto(url.toString(), { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!window.__NOCTIS_HARNESS__, null, { timeout: 60000 });
  await page.evaluate(() => window.__NOCTIS_HARNESS__.ready);
  await page.evaluate(() => window.__NOCTIS_HARNESS__.takeOver());
  console.log(`lampprobe — NOT A GATE.\n\n  GPU: ${await readRendererString(page)}`);
  await page.evaluate((p) => window.__NOCTIS_HARNESS__.setShotAt(p, [p[0], 0, p[2] - 100], 60), AT);
  await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity(1800));
  await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity(1800));
  await page.evaluate(() => window.__NOCTIS_HARNESS__.settle(4));

  const cen = await page.evaluate(() => window.__NOCTIS_HARNESS__.lampAimCensus());
  if (!cen) { console.log('\n  NO LAMP MESHES RESIDENT — nothing below is a verdict.'); process.exit(1); }

  /* ─────────────────────────── the controls, first ─────────────────────── */
  console.log('\n  ── THE CONTROLS (§7.3), AND THEY RUN BEFORE ANYTHING IS READ ──\n');
  const okCol = cen.columnsOverWater === 0;
  const okPair = cen.aimed >= 0.5 * cen.bowls;
  console.log(`  columns    ${String(cen.columns).padStart(5)}`);
  console.log(`  bowls      ${String(cen.bowls).padStart(5)}   of which post-top (no arm) ${cen.unpairedBowls}`);
  console.log(`  aimed      ${String(cen.aimed).padStart(5)}   ${okPair ? 'ok' : 'XX'}  a run that paired nothing would`);
  console.log( '                     report "0 heads over water" and read as a pass');
  console.log(`  COLUMNS over water ${String(cen.columnsOverWater).padStart(3)}   ${okCol ? 'ok' : 'XX'}  the generator has refused these`);
  console.log( '                     since session 19, so a non-zero here is the');
  console.log( '                     instrument and not the city');
  if (!okCol || !okPair) console.log('\n  A CONTROL FAILED. NOTHING BELOW IS A VERDICT.\n');
  else console.log('\n  Both hold.\n');

  /* ─────────────────────────── the measurement ─────────────────────────── */
  console.log('  ── WHAT THE GENERATOR ASKED OF THE COLUMN AND NEVER OF THE HEAD ──\n');
  const pct = (n) => `${((100 * n) / Math.max(1, cen.aimed)).toFixed(2)}%`;
  console.log(`  HEADS OVER WATER      ${String(cen.headsOverWater).padStart(5)} of ${cen.aimed}  (${pct(cen.headsOverWater)})`);
  console.log(`  heads outside the city${String(cen.headsOutsideCity).padStart(5)} of ${cen.aimed}  (${pct(cen.headsOutsideCity)})`);

  /**
   * AND THE TWO MECHANISMS, SEPARATED BY THE ONE NUMBER THE BRIEF ASKED FOR.
   *
   * A mirrored yaw is a CONSTANT error and a stale datum is one that GROWS
   * WITH CURVATURE, so the discriminator is the spread of the delivered arm
   * bearings, not their mean. `LAMP_PITCH_M`-spaced cardinal stations give
   * exactly four bearings and nothing between them; a tangent-derived arm gives
   * a continuum.
   */
  const bear = cen.rows.map((r) => ((r.armBearingDeg % 360) + 360) % 360);
  const buckets = new Map();
  for (const b of bear) {
    const k = Math.round(b / 5) * 5 % 360;
    buckets.set(k, (buckets.get(k) || 0) + 1);
  }
  const sorted = [...buckets.entries()].sort((a, c) => c[1] - a[1]);
  console.log('\n  ── THE DELIVERED ARM BEARINGS, 5° BUCKETS ──\n');
  console.log('  bearing   count    share');
  let top4 = 0;
  for (const [k, v] of sorted.slice(0, 10)) {
    console.log(`  ${String(k).padStart(5)}°  ${String(v).padStart(6)}   ${pct(v)}`);
  }
  for (const [, v] of sorted.slice(0, 4)) top4 += v;
  console.log(`\n  distinct 5° buckets ${buckets.size}`);
  console.log(`  in the four largest ${top4} of ${cen.aimed} (${pct(top4)})`);
  console.log('\n  FOUR BUCKETS CARRYING NEARLY EVERYTHING IS A CARDINAL DATUM — the');
  console.log('  mechanism is the LATTICE. A continuum would be a tangent, and a');
  console.log('  tangent that is merely MIRRORED would still be a continuum.');

  /** The bank the river is on where each offending head sits, so the frame can be aimed. */
  const wet = cen.rows.filter((r) => r.headInRiver)
    .sort((a, b) => Math.hypot(a.headX - AT[0], a.headZ - AT[2]) - Math.hypot(b.headX - AT[0], b.headZ - AT[2]));
  if (wet.length) {
    console.log('\n  ── THE NEAREST HEADS STANDING OVER THE RIVER ──\n');
    console.log('  column x       z      yaw     head x       z      arm    river z at head');
    for (const r of wet.slice(0, 12)) {
      const e = riverEdges(r.headX);
      console.log(`  ${r.colX.toFixed(1).padStart(8)}${r.colZ.toFixed(1).padStart(9)}`
        + `${r.colYawDeg.toFixed(0).padStart(7)}°${r.headX.toFixed(1).padStart(10)}${r.headZ.toFixed(1).padStart(9)}`
        + `${r.armM.toFixed(2).padStart(8)}   ${e.north.toFixed(1)} .. ${e.south.toFixed(1)}`);
    }
  }

  /**
   * AND THE COUNTRYSIDE ARM, WHICH IS THE OTHER HALF OF THE OPERATOR'S
   * SENTENCE. `exitRoadZ` is zero inside `EXIT_ROAD.startM` and the lamp
   * stations are culled outside `cityExtentAt`, so the two populations are
   * printed against each other rather than assumed to overlap.
   */
  console.log(`\n  ── WHERE THE ROAD BENDS AND WHERE THE LAMPS STOP ──\n`);
  console.log(`  EXIT_ROAD.startM      ${EXIT_ROAD.startM}   the road is straight inside this`);
  console.log(`  CITY.extentEdgeM      ${CITY.extentEdgeM}   the lamp stations stop at the ring`);
  console.log(`  exitRoadYawDeg(3232)  ${exitRoadYawDeg(3232).toFixed(4)}°`);
  console.log(`  exitRoadYawDeg(4000)  ${exitRoadYawDeg(4000).toFixed(4)}°`);
  console.log(`  heads outside the city ${cen.headsOutsideCity}`);
  console.log('\n  IF THAT LAST COUNT IS ZERO the road never bends under a lamp, and');
  console.log('  the brief\'s candidate (B) — a stale datum on a bent road — cannot be');
  console.log('  the mechanism however attractive it is. The lattice is still the');
  console.log('  datum; it is simply not WRONG about a road that never turns.');
} finally {
  await browser.close();
  server.child.kill('SIGKILL');
}
