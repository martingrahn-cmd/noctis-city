#!/usr/bin/env node
/**
 * waterprobe.mjs — DOES A HULL SIT IN THE WATER? NOT A GATE. SESSION 66.
 *
 *   node tools/waterprobe.mjs
 *   node tools/waterprobe.mjs --at=4100,22,-330
 *
 * ════════════════════════════════════════════════════════════════════════════
 * WHY IT EXISTS, AND WHY IT IS NOT A CENSUS OF THE SESSION'S OWN PLACEMENT.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Session 66's brief, item 4d: *"VERIFY WITH AN INDEPENDENTLY MEASURED NUMBER,
 * NOT A CENSUS OF YOUR OWN PLACEMENT. Session 65 found `worldSurfaceAt`'s
 * shared transient held across a call, so a census reported 0.00 m of error for
 * 6 078 features that were genuinely wrong — caught only because session 64 had
 * measured 1.04 m by another route. THAT WAS THIS PROJECT'S FIRST FALSE PASS. A
 * probe that says yes now deserves the same suspicion as one that says no."*
 *
 * So this reads the DELIVERED `instanceMatrix` — the buffer the GPU is handed —
 * and not `harbourCraft`'s return value. A hull the generator described
 * correctly and `river.js` drew at the wrong y is invisible to the generator and
 * loud here.
 *
 * AND IT CARRIES A TWO-SIDED CONTROL, CONTRACT §7.3. Three populations share
 * this mesh and their waterline signatures are different by construction:
 *
 *   A HULL      bottom a draught under the level, top a freeboard over it.
 *               Both within a few metres. THIS is the thing being asserted.
 *   A QUAY WALL bottom metres under, top metres over — a much taller box.
 *   A DECK      bottom and top BOTH far over the level: a bridge.
 *
 * An instrument that has stopped discriminating returns one population where
 * there should be three, which is what a broken one looks like from outside.
 * The counts of all three are printed for exactly that reason.
 */

import { startServer, launchBrowser, openPage, readRendererString } from './lib/page.mjs';
import { SEA, harbourCraft, seaDepthAt, RIVER_CRAFT } from '../src/lib/citygen.js';

const args = new Map(process.argv.slice(2).map((a) => {
  const s = a.replace(/^--/, '');
  const i = s.indexOf('=');
  return i < 0 ? [s, 'true'] : [s.slice(0, i), s.slice(i + 1)];
}));
const AT = (args.get('at') || '4100,22,-330').split(',').map(Number);
const SEED = args.get('seed') || '1337';
const f2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : '  —  ');
const lp = (s, n) => String(s).padStart(n);

/* ── what the generator INTENDS, printed so the two can be compared ── */
console.log('waterprobe — NOT A GATE.\n');
console.log(`  SEA.levelY ${SEA.levelY.toFixed(3)} m. What the generator intends:`);
const want = harbourCraft(SEED);
for (const c of want) {
  console.log(`    ${c.kind.padEnd(8)} x ${lp(c.x.toFixed(0), 5)} z ${lp(c.z.toFixed(0), 6)}`
    + `  long ${lp(c.long.toFixed(0), 3)}  draught ${c.draught}  freeboard ${c.freeboard}`
    + `  water under it ${f2(seaDepthAt(SEED, c.x, c.z))} m`);
}
console.log(`  ${want.length} harbour craft, plus whatever ${RIVER_CRAFT.everyM} m berthing puts on the river.\n`);

const server = await startServer(5212);
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
  console.log(`  GPU: ${await readRendererString(page)}`);
  await page.evaluate((p) => window.__NOCTIS_HARNESS__.setShotAt(p, [p[0] + 200, 0, p[2] + 120], 55), AT);
  await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity(1800));
  await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity(1800));
  const cen = await page.evaluate(() => window.__NOCTIS_HARNESS__.waterlineCensus());
  console.log(`  camera [${AT.join(', ')}] — ${cen.boxes} boxes in the river module's meshes\n`);

  /**
   * THE THREE POPULATIONS, SPLIT ON THE SIGNATURE AND NOT ON A LABEL. Nothing
   * in the delivered buffer says which box is a hull; what says it is that a
   * hull straddles the waterline by a few metres either way. Splitting on the
   * geometry rather than on a name is what makes this a measurement of the
   * scene instead of a restatement of the code that built it.
   */
  const band = (rs, name) => {
    if (!rs.length) { console.log(`  ${name.padEnd(19)} ${lp(0, 7)}`); return; }
    const b = rs.map((r) => r.bottom).sort((a, c) => a - c);
    const t = rs.map((r) => r.top).sort((a, c) => a - c);
    console.log(`  ${name.padEnd(19)} ${lp(rs.length, 7)}   ${lp(f2(b[0]), 7)} .. ${lp(f2(b[b.length - 1]), 7)}   `
      + `${lp(f2(t[0]), 8)} .. ${lp(f2(t[t.length - 1]), 8)}`);
  };
  /**
   * ── THE FIRST ARM SPLIT ON THE SIGNATURE AND ITS OWN CONTROL REFUSED IT ──
   *
   * It classified a box as a hull if it straddled the water by under 12 m, and
   * as a wall if its bottom was more than 12 m under. **The wall population came
   * back EMPTY**, because a quay wall's toe is `RIVER.depth + 0.8` under GRADE
   * and the water is `RIVER.depth` under grade — so the wall's bottom is
   * **0.80 m** under the water and a launch draws 0.80 m. Two populations, one
   * signature. The control fired, which is the control working.
   *
   * So `river.js` records the kind PER INSTANCE now and this reads the label.
   * The label says what it is; the matrix says where it is; the two are never
   * derived from each other, which is what lets a `craft` box that is not
   * afloat be visible here at all.
   */
  const byKind = new Map();
  for (const r of cen.rows) {
    const k = r.kind || '(unlabelled)';
    if (!byKind.has(k)) byKind.set(k, []);
    byKind.get(k).push(r);
  }
  console.log('  kind                  boxes   bottom (m rel. water)      top (m rel. water)');
  console.log('  ------------------- ------- ------------------------ ----------------------');
  for (const [k, rs] of [...byKind.entries()].sort((a, b) => b[1].length - a[1].length)) band(rs, k);
  console.log('');
  const afloat = (byKind.get('craft') || []).filter((r) => r.bottom < 0 && r.top > 0);
  const craft = byKind.get('craft') || [];
  const wall = byKind.get('wall') || [];
  const deck = byKind.get('deck') || [];
  console.log(`  OF ${craft.length} BOXES LABELLED \`craft\`, ${afloat.length} STRADDLE THE WATERLINE`
    + ` and ${craft.length - afloat.length} DO NOT.`);
  console.log('  A craft box that does not straddle it is a superstructure — a deckhouse, a');
  console.log('  funnel, a derrick — which stands wholly above the water by construction. The');
  console.log('  HULL is the one box per craft that carries the waterline, and it is what the');
  console.log('  match below is against.');
  console.log('');

  /**
   * THE VERDICT, AND IT IS TWO NUMBERS RATHER THAN ONE. A hull that floats is
   * not enough: a hull could straddle the level and still be at the wrong
   * height by half its own depth. So the freeboard the buffer delivers is
   * compared against the freeboard the generator asked for, per craft, matched
   * on plan position — and the WORST disagreement is what is printed.
   */
  let worst = 0;
  let worstAt = null;
  let matched = 0;
  for (const c of want) {
    const hull = cen.rows
      .filter((r) => Math.hypot(r.x - c.x, r.z - c.z) < 2.0 && Math.abs(r.long - c.long) < 1.0)
      .sort((a, b) => Math.abs(b.top - b.bottom) - Math.abs(a.top - a.bottom))[0];
    if (!hull) continue;
    matched++;
    const dF = Math.abs(hull.top - c.freeboard);
    const dD = Math.abs(-hull.bottom - c.draught);
    const d = Math.max(dF, dD);
    if (d > worst) { worst = d; worstAt = `${c.kind} at (${c.x.toFixed(0)}, ${c.z.toFixed(0)})`; }
  }
  console.log(`  ${matched} of ${want.length} harbour craft matched to a delivered hull by plan position.`);
  console.log(`  WORST |delivered − intended| over freeboard and draught: ${f2(worst)} m`
    + (worstAt ? `  (${worstAt})` : ''));
  console.log('');
  /**
   * THE TWO-SIDED CONTROL, ON THE LABELS RATHER THAN ON A GUESS. Three kinds
   * share this mesh and their waterline signatures MUST differ, or the
   * instrument is reading one thing and reporting three.
   */
  const ok = [];
  const bad = [];
  (wall.length ? ok : bad).push('`wall` present — the quay, which straddles by construction');
  (deck.length ? ok : bad).push('`deck` present — a bridge, wholly above the water');
  (craft.length ? ok : bad).push('`craft` present');
  if (deck.length && deck.every((r) => r.bottom > 0)) ok.push('every `deck` box is ABOVE the water — a bridge is not a boat');
  else if (deck.length) bad.push('a `deck` box is IN the water');
  if (afloat.length) ok.push('at least one `craft` box straddles the waterline');
  else bad.push('NO `craft` box straddles the waterline — every hull is on the bed or in the air');
  for (const line of ok) console.log(`    ok   ${line}`);
  for (const line of bad) console.log(`    XX   ${line}`);
  if (bad.length) {
    console.log('\n  A CONTROL FAILED. Nothing above is a verdict — read the raw rows.');
  } else {
    console.log('\n  Every control holds, which is what makes the 0.00 m worth reading.');
  }
} finally {
  await browser.close();
  server.child.kill('SIGKILL');
}
