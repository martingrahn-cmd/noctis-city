#!/usr/bin/env node
/**
 * stationprobe.mjs — THE VIADUCT DECK'S DELIVERED CROSS-SECTION, AS NUMBERS.
 * NOT A GATE, and it must never become one. SESSION 31.
 *
 * WHY IT EXISTS.
 *
 * STATE 27 §8.1 designed a station in five stages and specified Stage 1 as
 * *"two side platforms on the deck, 80 m long, 3.0 m wide"*. That design was
 * written by a session with the code in front of it, and the number 3.0 was
 * never checked against the section the deck actually delivers. It cannot fit:
 * the deck is 9.50 m wide, the two ballast troughs are 3.10 m each at ±2.2325 m
 * from the centreline, and what is left outside them inside the parapets is
 * **0.5175 m a side** — a kerb, not a platform. This prints that section so the
 * next reader does not have to take the sentence above on trust.
 *
 * CONTRACT §9.1: A GATE THAT READS CONFIG VERIFIES THE CONFIG. So this does not
 * recompute the section from `LANDMARKS` and the expressions in `city.js`. It
 * boots the real `city.js` through `tools/lib/headlesscity.mjs` and reads the
 * DELIVERED instance matrices — the boxes that were actually pushed — through
 * `captureBuild`'s provenance capture. What it prints is what was emitted.
 *
 * CONTRACT §9 rule 2: ANYTHING DERIVED TWO WAYS IS PRINTED BOTH WAYS. The
 * second path is the generator's own: `viaductArc`, `viaductSoffitY` and
 * `VIADUCT_RAIL_RISE_M` from `citygen.js`. The two columns are printed side by
 * side under `--check`, and where they disagree that disagreement is the
 * finding — as it was for the deck section, where `city.js` carries its own
 * `slabThick = 0.9` and `boxDepth = 1.9` literals while `citygen.js`'s
 * `VIADUCT_SLAB_THICK_M` doc comment says the number is read from there.
 *
 * IT READS THE MATRIX, NOT THE AABB, AND THE FIRST DRAFT OF THIS FILE DID NOT
 * — WHICH IS CONTRACT §7.7 INSIDE THE INSTRUMENT WRITTEN THIS SESSION.
 *
 * The header of that draft argued that the crown station is the safe place to
 * measure because the deck's heading there is 90°, so every box is axis-aligned
 * and its world AABB *is* its section. That is true of the two segments meeting
 * AT the crown and of nothing else: `viaductArc` turns 2.125° per chord, so a
 * segment two bays out is at 3.1°, and an 11.13 m rail 0.14 m wide at 3.1°
 * has an AABB **0.746 m** across — 5.3× its own width. The draft printed
 * exactly that 0.746 and it was believed for as long as it took to compare it
 * with the `push(..., 0.14, yaw)` that emitted it. A rotated box's AABB is
 * STATE 25's `claimprobe` finding and this probe reproduced it in its first run.
 *
 * So the transverse extent is taken in the DECK'S OWN FRAME: `captureBuild`'s
 * `keepElements` hands back each box's emitting matrix and its geometry's own
 * half-extents, the third column of that matrix is the axis `city.js` passed
 * the width on, and the section is `|col2| · halfZ` about the centre's
 * projection onto the crown's across-axis. The residual is the difference in
 * heading between a box's own segment and the crown's, which over the two
 * segments that meet there is under 1.1° and enters as `1 − cos θ` = 1.8e-4.
 * Printed, rather than argued: `--check` reports the worst heading in the slice.
 *
 * Usage:
 *   node tools/stationprobe.mjs                 the crown section
 *   node tools/stationprobe.mjs --check         + the generator's own numbers
 *   node tools/stationprobe.mjs --band=21,27    only boxes in that height band
 *   node tools/stationprobe.mjs --plan          the platform's plan clearances
 *
 * Asserts nothing and must not.
 */

import { captureBuild } from './lib/headlesscity.mjs';
import {
  LANDMARKS, viaductArc, viaductSoffitY, viaductPiers,
  VIADUCT_SLAB_THICK_M, VIADUCT_BOX_DEPTH_M, VIADUCT_RAIL_RISE_M,
  VIADUCT_LOADING_GAUGE_M, CITY, CORRIDOR, BLOCK_KEEPOUT,
} from '../src/lib/citygen.js';

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  }),
);
const num = (k, d) => (args.has(k) ? Number(args.get(k)) : d);

const l = LANDMARKS.find((x) => x.kind === 'viaduct');
const arc = viaductArc(l);
/** The crown is the middle station: `viaductArc` builds `s` signed about it. */
const crown = arc.stations.reduce((a, b) => (Math.abs(b.s) < Math.abs(a.s) ? b : a));

/**
 * HOW WIDE A SLICE COUNTS AS "AT THE CROWN".
 *
 * Half a chord either side, so the window holds the two deck segments that meet
 * AT the crown and nothing further. It bounds the residual rather than the AABB
 * — the section itself is taken in the deck frame below — and the worst heading
 * actually swept is printed under `--check` so the bound is a measurement.
 */
/**
 * Three quarters of a chord. The two segments that meet at the crown have their
 * MIDPOINTS at exactly ±chord/2, so a half-chord window lands on both of them
 * at once and floating point decides which side gets in — the first run of this
 * printed one track and a 5.53 m "clear run" that is the other track's ballast.
 * 0.75 puts both midpoints inside with margin and the third segment out.
 */
const SLICE_HALF_M = arc.chord * 0.75;

/** The crown's own across-axis in world XZ, from its yaw, as `city.js` builds it. */
const CROWN_C = Math.cos((crown.yawDeg * Math.PI) / -180);
const CROWN_S = Math.sin((crown.yawDeg * Math.PI) / -180);
/** Transverse offset of a world point from the deck centreline at the crown. */
const across = (x, z) => -(x - crown.x) * CROWN_S + (z - crown.z) * CROWN_C;
/** Distance ALONG the deck from the crown — the axis the slice is taken on. */
const along = (x, z) => (x - crown.x) * CROWN_C + (z - crown.z) * CROWN_S;

const bandArg = (args.get('band') || '').split(',').map(Number);
const yLo = bandArg.length === 2 && Number.isFinite(bandArg[0]) ? bandArg[0] : -Infinity;
const yHi = bandArg.length === 2 && Number.isFinite(bandArg[1]) ? bandArg[1] : Infinity;

console.log('stationprobe — the viaduct deck section as DELIVERED\n');
console.log(`  viaduct    crown (${l.x}, ${l.z}) heading ${l.headingDeg}° deck ${l.deck} m`);
console.log(`  crown station  s=${crown.s.toFixed(2)}  (${crown.x.toFixed(3)}, ${crown.z.toFixed(3)})  yaw ${crown.yawDeg.toFixed(3)}°`);
console.log(`  slice          |along| <= ${SLICE_HALF_M.toFixed(2)} m from the crown (0.75 chord either side)`);
if (Math.abs(crown.yawDeg % 90) > 1e-6) {
  console.log(`  !! crown yaw is not a multiple of 90° — an AABB is NOT the section here.`);
}

const built = captureBuild({ seed: num('seed', 1337), keepElements: true });
console.log(`  build          ${built.total} boxes, ${built.unmatched} unmatched geometry\n`);

/**
 * Every delivered box whose CENTRE falls in the crown slice, reduced to its
 * section in the deck's own frame.
 *
 * `e` is the emitting `Matrix4`'s elements, column-major. `city.js` emits every
 * one of these through `setMatrix(x, y, z, len, height, width, yaw)` against a
 * unit box, so column 0 carries the length along the deck, column 1 the height
 * and **column 2 the transverse width** — which is the axis this probe is about.
 * The half-extent is therefore `|col2| · halfZ` of the box's own geometry, and
 * it is exact under any yaw, which the world AABB is not.
 */
const rows = [];
let worstHeadingDeg = 0;
for (const rec of built.bySite.values()) {
  for (const b of rec.boxes) {
    const cx = (b.x0 + b.x1) / 2;
    const cy = (b.y0 + b.y1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    if (Math.abs(along(cx, cz)) > SLICE_HALF_M) continue;
    // Only the structure over the street; the ground plane would fill the table.
    if (b.y1 < 1.0) continue;
    if (Math.abs(across(cx, cz)) > 32) continue;
    const e = b.e;
    if (!e) continue;
    const colLen = (i) => Math.hypot(e[i * 4], e[i * 4 + 1], e[i * 4 + 2]);
    const halfZ = ((b.gmax[2] - b.gmin[2]) / 2) * colLen(2);
    const halfY = ((b.gmax[1] - b.gmin[1]) / 2) * colLen(1);
    // The box's own along-deck axis against the crown's, as a heading error.
    const bc = e[0] / (colLen(0) || 1);
    const bs = e[2] / (colLen(0) || 1);
    const dot = Math.min(1, Math.abs(bc * CROWN_C + bs * CROWN_S));
    const t = across(cx, cz);
    // The bound is about the DECK's own boxes. A block building beside the
    // viaduct carries its own yaw and would report 89° — which is true of that
    // building and says nothing about the residual on the section.
    if (b.mesh.includes('viaduct')) {
      worstHeadingDeg = Math.max(worstHeadingDeg, (Math.acos(dot) * 180) / Math.PI);
    }
    rows.push({
      t0: t - halfZ, t1: t + halfZ,
      y0: cy - halfY, y1: cy + halfY,
      mesh: b.mesh, site: b.site,
    });
  }
}
rows.sort((a, b) => (a.y0 - b.y0) || (a.t0 - b.t0));

console.log('  DELIVERED SECTION AT THE CROWN — t is transverse in the DECK frame, y is height, metres');
console.log(`  worst heading error swept: ${worstHeadingDeg.toFixed(3)}° (enters the width as 1-cos = ${(1 - Math.cos((worstHeadingDeg * Math.PI) / 180)).toExponential(2)})`);
console.log('  ' + '-'.repeat(96));
console.log('     t0       t1     width       y0       y1    height   mesh / emitting line');
console.log('  ' + '-'.repeat(96));
const seen = new Set();
for (const b of rows) {
  // `--band` windows the PRINTED TABLE only. `rows` is unwindowed, because the
  // §9 rule 2 check below reads it and a check that silently reported `NO`
  // because its subject was outside the display window would be §7.1's quiet
  // gate — which this file printed once already for the soffit.
  if (b.y1 < yLo || b.y0 > yHi) continue;
  const k = `${b.t0.toFixed(3)}|${b.t1.toFixed(3)}|${b.y0.toFixed(3)}|${b.y1.toFixed(3)}|${b.site}`;
  if (seen.has(k)) continue;
  seen.add(k);
  console.log(
    `  ${b.t0.toFixed(3).padStart(7)}  ${b.t1.toFixed(3).padStart(7)}  ${(b.t1 - b.t0).toFixed(3).padStart(7)}`
    + `  ${b.y0.toFixed(3).padStart(7)}  ${b.y1.toFixed(3).padStart(7)}  ${(b.y1 - b.y0).toFixed(3).padStart(7)}`
    + `   ${b.mesh} ${b.site}`,
  );
}
console.log('  ' + '-'.repeat(96));

/**
 * THE CLEAR WIDTH, WHICH IS THE QUESTION STAGE 1 ACTUALLY ASKS.
 *
 * Take everything ON the deck — above the slab's top surface — and report the
 * transverse intervals it leaves empty. A platform has to stand in one of them.
 */
const slabTop = l.height;
const onDeck = rows.filter((b) => b.y1 > slabTop + 0.05 && b.y0 < slabTop + 6);
const occupied = onDeck.map((b) => [b.t0, b.t1]).sort((a, b) => a[0] - b[0]);
const merged = [];
for (const iv of occupied) {
  const last = merged[merged.length - 1];
  if (last && iv[0] <= last[1] + 1e-9) last[1] = Math.max(last[1], iv[1]);
  else merged.push([...iv]);
}
console.log('\n  WHAT STANDS ON THE DECK (above the slab top at y = ' + slabTop.toFixed(2) + '), merged transverse spans:');
for (const [a, b] of merged) console.log(`    t ${a.toFixed(3)} .. ${b.toFixed(3)}   (${(b - a).toFixed(3)} m)`);

const deckL = -l.deck / 2;
const deckR = l.deck / 2;
console.log(`\n  THE GAPS INSIDE THE DECK EDGES (t ${deckL.toFixed(3)} .. ${deckR.toFixed(3)}):`);
let cursor = deckL;
const gaps = [];
for (const [a, b] of merged) {
  if (b <= deckL || a >= deckR) continue;
  if (a > cursor + 1e-9) gaps.push([cursor, Math.min(a, deckR)]);
  cursor = Math.max(cursor, Math.min(b, deckR));
}
if (cursor < deckR - 1e-9) gaps.push([cursor, deckR]);
for (const [a, b] of gaps) {
  console.log(`    t ${a.toFixed(3)} .. ${b.toFixed(3)}   ${(b - a).toFixed(4)} m clear`);
}
const widest = gaps.reduce((m, g) => Math.max(m, g[1] - g[0]), 0);
console.log(`\n  WIDEST CLEAR RUN ON THE DECK: ${widest.toFixed(4)} m`);
console.log(`  STATE 27 §8.1 STAGE 1 ASKS FOR:  3.0000 m of platform, twice.`);
console.log(`  VERDICT: ${widest >= 3 ? 'it fits' : `IT DOES NOT FIT — short by ${(3 - widest).toFixed(4)} m per platform`}`);

if (args.has('check')) {
  /**
   * The generator's own arithmetic beside the delivered boxes (§9 rule 2). The
   * two paths are independent: the left column is `citygen.js`'s exported
   * constants and the right is measured off the matrices `city.js` pushed.
   */
  /** The slab: the widest box whose top face IS the slab top. */
  const slab = rows.filter((b) => Math.abs(b.y1 - slabTop) < 1e-6)
    .sort((a, b) => (b.t1 - b.t0) - (a.t1 - a.t0))[0];
  /** The box girder: the lowest thing under the slab that is not a crosshead. */
  const girder = rows.filter((b) => Math.abs(b.y1 - (slabTop - VIADUCT_SLAB_THICK_M)) < 1e-6)
    .sort((a, b) => a.y0 - b.y0)[0];
  /** The rails: the steel bucket's boxes above the slab. */
  const railTop = rows.reduce((m, b) => (b.mesh.includes('steel') && b.y0 >= slabTop ? Math.max(m, b.y1) : m), -Infinity);
  console.log('\n  §9 RULE 2 — THE SAME NUMBERS TWO WAYS');
  console.log('  ' + '-'.repeat(76));
  console.log('    quantity                    citygen.js         delivered      agree');
  const row = (name, gen, del) => {
    const ok = Number.isFinite(del) && Math.abs(gen - del) < 1e-3;
    console.log(`    ${name.padEnd(26)} ${gen.toFixed(4).padStart(10)}  ${(Number.isFinite(del) ? del.toFixed(4) : 'n/a').padStart(14)}      ${ok ? 'yes' : 'NO'}`);
  };
  row('slab thickness', VIADUCT_SLAB_THICK_M, slab ? slab.y1 - slab.y0 : NaN);
  row('box girder depth', VIADUCT_BOX_DEPTH_M, girder ? girder.y1 - girder.y0 : NaN);
  row('soffit y', viaductSoffitY(l), girder ? girder.y0 : NaN);
  row('rail rise above slab', VIADUCT_RAIL_RISE_M, railTop - slabTop);
  row('deck width', l.deck, slab ? slab.t1 - slab.t0 : NaN);
  console.log('  ' + '-'.repeat(76));
  console.log(`    box girder depth ${VIADUCT_BOX_DEPTH_M} and loading gauge ${VIADUCT_LOADING_GAUGE_M} are exported and`);
  console.log(`    read by moving.js and the probes; city.js re-states 0.9 and 1.9 as its own`);
  console.log(`    literals, which is what this column is here to make visible.`);
}

if (args.has('plan')) {
  /**
   * WHAT A WIDENED DECK WOULD HAVE TO CLEAR, IN PLAN.
   *
   * A real elevated station widens its structure — the platforms are carried on
   * brackets outside the running structure, which is what every elevated
   * railway that has ever had a station does. So the question is not "does it
   * fit on the deck" (it does not, above) but "what does an outrigger hit".
   */
  console.log('\n  IF THE PLATFORM IS CARRIED OUTSIDE THE DECK — WHAT IS OUT THERE');
  console.log('  ' + '-'.repeat(76));
  const piers = viaductPiers(arc, l);
  const nearPiers = piers.filter((p) => Math.abs(p.z - crown.z) < 90);
  const legOuter = Math.max(...nearPiers.flatMap((p) => p.legs.map((g) => Math.abs(g.side * g.offset)))) + arc.legHalf;
  const legInner = Math.min(...nearPiers.flatMap((p) => p.legs.map((g) => Math.abs(g.side * g.offset)))) - arc.legHalf;
  console.log(`    pier legs, nearest ${nearPiers.length} to the crown`);
  console.log(`      inner face   ${legInner.toFixed(3)} m from the deck centreline`);
  console.log(`      outer face   ${legOuter.toFixed(3)} m`);
  console.log(`      crosshead top ${viaductSoffitY(l).toFixed(3)} m — BELOW any platform at ${(slabTop + 1.1).toFixed(2)} m, so it is not a conflict in y`);
  console.log(`    origin block clear cross-street band   |x| <= ${(BLOCK_KEEPOUT ? 10.5 : 10.5).toFixed(3)} m (session 5, LANDMARKS → viaduct)`);
  console.log(`    road half-width                        ${CITY.roadHalfWidth.toFixed(3)} m`);
  console.log(`    corridor half-width (road + pavement)  ${CORRIDOR.toFixed(3)} m`);
  console.log(`    catenary mast centre                   ${(l.deck / 2 - 0.75).toFixed(3)} m, 0.30 m square, 21.00 .. 27.20 m`);
  console.log(`    catenary arm reaches                   ${(l.deck / 2 * 1.45 / 2).toFixed(3)} m either side at 26.90 m`);
  console.log('  ' + '-'.repeat(76));
  console.log('    A platform outside the parapet is clear of the pier (which stops at the');
  console.log('    soffit) and of the carriageway (which is 21 m below it). What it must');
  console.log('    clear in its own band is the catenary mast and the block band above.');
}

console.log('\n  stationprobe asserts nothing.');
