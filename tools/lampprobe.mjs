/**
 * lampprobe.mjs — NOT A GATE. SESSION 23, item 4. **MEASURE ONLY.**
 *
 * DOES A TREE CROWN GROW INTO A LAMP HEAD, AND HOW OFTEN?
 *
 * THE OBSERVATION THIS EXISTS TO TURN INTO A NUMBER. `occupancy.js` pairs
 * `canopy` against `building`, `landmark` and `block` and against nothing else.
 * A lamppost is in the registry as a `prop` with a 0.17 m half-width post
 * footprint, in the GROUND band — because `derivePropHalfAcross` counts only
 * what is below `HEAD_CLEAR_M` = 2.10 m, and correctly so: the question a
 * pavement asks is *"what is in my way"*. But the lamppost's third box is an
 * ARM AND HEAD at 4.14 m reaching 0.61 m out over the footway, and it declares
 * NOTHING in the canopy band at all.
 *
 * So a crown growing into a lamp head does not meet a missing pair in the
 * table. **It meets an object that was never declared.** Session 22's own frame
 * pair showed a canopy that now occludes a lamp head and nothing objected,
 * which is the observation; this is the count.
 *
 * IT MEASURES AND IT STOPS THERE. No lamp head is declared this session and no
 * tree is moved. Red first: the repair's cost is the number of currently-placed
 * trees a declaration would refuse, and that number is what decides whether the
 * repair is worth making. It is printed at the bottom.
 *
 * NO BROWSER, NO GPU. `generateChunk` is pure and `propMatrix` is a transform;
 * both run in Node, so every number here is a coordinate or a count.
 *
 *   node tools/lampprobe.mjs
 *   node tools/lampprobe.mjs --list        every intersecting pair
 */

import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import {
  generateChunk, PROP_MODELS, HEAD_CLEAR_M, CITY, BLOCK_KEEPOUT,
  promenadeLamps, riverBlocks, riverTouchesChunk,
} from '../src/lib/citygen.js';

const CITY_BUDGET = JSON.parse(await readFile(new URL('./city-budget.json', import.meta.url), 'utf8'));
const BUDGET = JSON.parse(await readFile(new URL('./budget.json', import.meta.url), 'utf8'));
const args = new Set(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')[0]));
const SEED = BUDGET.capture.params.seed || 1337;
const R = CITY_BUDGET.region;
const DEG = Math.PI / 180;

/**
 * `city.js`'s `propMatrix`, re-expressed here.
 *
 * IT IS A COPY AND THAT IS THE ONE THING WRONG WITH THIS PROBE, so it is said
 * out loud rather than left for a reader to find (CONTRACT §9.1: a second copy
 * of a rule is the arrangement `pierEvery: 34` sat in). `city.js` is a module
 * with a `ctx`, a scene and a `worldSurface` query, so it cannot be imported
 * into a headless tool; the transform itself is pure and is reproduced in the
 * same order — yaw, then lean premultiplied, then the box's own tilt
 * postmultiplied. **What that means for the numbers: if the two ever disagree,
 * this instrument is the one that is wrong**, and the direction is checkable —
 * `citycheck`'s `occupancyCensus` reads the DELIVERED matrices and would
 * disagree with the per-prop extents below.
 */
function propBoxWorldAabb(p, b, leanDeg, baseY) {
  const s = p.scale;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (p.yawDeg || 0) * DEG, 0));
  if (leanDeg) {
    const az = (p.leanAzDeg || 0) * DEG;
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(Math.cos(az), 0, Math.sin(az)), leanDeg * DEG));
  }
  const pos = new THREE.Vector3(b.x * s, b.y * s, b.z * s).applyQuaternion(q);
  pos.set(p.x + pos.x, baseY + pos.y, p.z + pos.z);
  if (b.tilt) {
    const az = (b.tiltAz || 0) * DEG;
    q.multiply(new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(Math.cos(az), 0, Math.sin(az)), b.tilt * DEG));
  }
  const m = new THREE.Matrix4().compose(pos, q, new THREE.Vector3(b.w * s, b.h * s, b.d * s));
  const box = new THREE.Box3().makeEmpty();
  const v = new THREE.Vector3();
  for (const sx of [-0.5, 0.5]) {
    for (const sy of [-0.5, 0.5]) {
      for (const sz of [-0.5, 0.5]) box.expandByPoint(v.set(sx, sy, sz).applyMatrix4(m));
    }
  }
  return box;
}

/**
 * THE GROUND DATUM IS TAKEN AS ZERO FOR BOTH OBJECTS, AND THE CAVEAT IS
 * BOUNDED RATHER THAN WAVED AT.
 *
 * `city.js` lifts each prop by `worldSurface(x, z).y`, which needs the delivered
 * ground meshes. What this test reads is the DIFFERENCE of two heights a few
 * metres apart, so a common datum cancels exactly — and where a lamp and a tree
 * genuinely stand on different surfaces the gap is at most one kerb,
 * `BLOCK.kerbHeight` = 0.160 m. Every vertical overlap below is printed, so a
 * reader can see for themselves which findings 0.160 m could flip and which it
 * could not.
 */
const BASE_Y = 0;
const DATUM_UNCERTAINTY_M = 0.160;

/**
 * THE LAMPS THAT ACTUALLY EXIST, AND THE BRIEF'S PREMISE IS OFF BY A WHOLE
 * POPULATION — WHICH IS THE FIRST FINDING AND CHANGES THE REST.
 *
 * The brief describes *"a lamppost in the registry as a `prop` with a 0.17 m
 * half-width post footprint"*, and `PROP_MODELS.lamppost` is exactly that. But
 * that kind is only offered to the `parking` scatter, and over the gate's own
 * region at seed 1337 **zero of them are placed**. The lamps this city actually
 * lights its streets with are emitted by `city.js` directly, on a lattice, and
 * they are a different object at a different height:
 *
 *     prop `lamppost`  head at 4.14 m, arm reaching 0.61 m   0 placed
 *     kerbside lamp    head at 8.08 m, arm reaching 2.10 m   the whole city
 *     promenade lamp   head at 8.08 m, same arm              both quays
 *
 * NEITHER OF THE TWO REAL KINDS IS IN THE REGISTRY AT ALL — not the post, not
 * the head. `citygen`'s prop scatter never sees them, so there is no claim to
 * be missing a band from. That is a LARGER gap than the one the brief
 * describes, and it is the honest version of the item.
 *
 * The lattice is reproduced here from `city.js`'s own street-lighting loop. It
 * is a copy, with the same caveat the transform above carries: if the two ever
 * disagree, this instrument is the one that is wrong.
 */
const LAMP_MOUNT_M = 8.08;
const LAMP_ARM_M = 2.1;
const LAMP_BOWL_R = 0.42;
const realHeads = [];
for (let cz = R.cz[0]; cz <= R.cz[1]; cz++) {
  for (let cx = R.cx[0]; cx <= R.cx[1]; cx++) {
    const x0 = cx * CITY.chunkSize - CITY.chunkSize / 2;
    const z0 = cz * CITY.chunkSize - CITY.chunkSize / 2;
    for (let i = 0; i < 4; i++) {
      const off = ((cx * 7 + cz * 13) % 10) + i * 30;
      if (off > CITY.chunkSize) continue;
      const a = { x: x0 + CITY.roadHalfWidth + 1.3, z: z0 + off, axis: 'x' };
      const c = { x: x0 + off, z: z0 + CITY.roadHalfWidth + 1.3, axis: 'z' };
      for (const spot of [a, c]) {
        if (spot.x > BLOCK_KEEPOUT.x0 && spot.x < BLOCK_KEEPOUT.x1 &&
            spot.z > BLOCK_KEEPOUT.z0 && spot.z < BLOCK_KEEPOUT.z1) continue;
        if (riverBlocks(spot.x, spot.z, 0.6)) continue;
        realHeads.push({
          kind: 'kerbside',
          x: spot.axis === 'x' ? spot.x - LAMP_ARM_M : spot.x,
          z: spot.axis === 'x' ? spot.z : spot.z - LAMP_ARM_M,
          y: LAMP_MOUNT_M,
        });
      }
    }
    if (riverTouchesChunk(cx, cz)) {
      for (const L of promenadeLamps(SEED, x0, x0 + CITY.chunkSize)) {
        if (L.z < z0 || L.z >= z0 + CITY.chunkSize) continue;
        realHeads.push({ kind: 'promenade', x: L.headX, z: L.headZ, y: LAMP_MOUNT_M });
      }
    }
  }
}

/* -------------------------------------------------------- collect the props */

const lamps = [];
const crowns = [];
let lampCount = 0;
let treeCount = 0;

for (let cz = R.cz[0]; cz <= R.cz[1]; cz++) {
  for (let cx = R.cx[0]; cx <= R.cx[1]; cx++) {
    for (const p of generateChunk(SEED, cx, cz).props || []) {
      const model = PROP_MODELS[p.kind];
      if (!model || !model.length) continue;
      const v = model[Math.min(model.length - 1, p.variant || 0)];
      const leanDeg = v.leanRange ? v.leanRange * (p.lean || 0) : 0;
      if (p.kind === 'lamppost') {
        lampCount++;
        /**
         * THE HEAD IS THE MODEL'S LAST BOX, IDENTIFIED BY HEIGHT RATHER THAN BY
         * INDEX. `PROP_MODELS.lamppost` is a base, a column and a head, and
         * hard-coding `boxes[2]` would silently measure a column if a fourth
         * box were ever added at the front. The head is *the box whose authored
         * centre is above `HEAD_CLEAR_M` and which is offset from the column
         * axis* — which is the definition of an arm.
         */
        v.boxes.forEach((b, i) => {
          if (b.y <= HEAD_CLEAR_M) return;
          lamps.push({
            p, i, aabb: propBoxWorldAabb(p, b, leanDeg, BASE_Y),
            reachM: Math.hypot(b.x, b.z) + Math.max(b.w, b.d) / 2,
          });
        });
      } else if (p.kind === 'tree') {
        treeCount++;
        for (const b of v.boxes) {
          const aabb = propBoxWorldAabb(p, b, leanDeg, BASE_Y);
          /**
           * A CROWN IS A BOX WHOSE DELIVERED UNDERSIDE IS ABOVE HEAD HEIGHT —
           * `city.js`'s own band split, `lo = e[13] - hy - baseY`, evaluated on
           * the same delivered AABB. Reading the model's authored `y` instead
           * would be session 22's finding again: a mass authored to clear
           * 2.183 m hung at 1.681 m as delivered.
           */
          if (aabb.min.y >= HEAD_CLEAR_M) crowns.push({ p, aabb });
        }
      }
    }
  }
}

console.log('lampprobe — tree crowns against lamp heads. MEASURE ONLY.');
console.log(`  region cx ${R.cx[0]}..${R.cx[1]} x cz ${R.cz[0]}..${R.cz[1]} at seed ${SEED}`);
console.log(`  ${lampCount} lampposts (${lamps.length} arm/head boxes), ${treeCount} trees ` +
  `(${crowns.length} delivered canopy masses)`);
console.log(`  HEAD_CLEAR_M ${HEAD_CLEAR_M} m; ground datum taken as ${BASE_Y} for both, ` +
  `bounded uncertainty +/-${DATUM_UNCERTAINTY_M} m`);
console.log('');
console.log('WHAT THE REGISTRY SAYS ABOUT A LAMP HEAD, WHICH IS NOTHING');
{
  const v = PROP_MODELS.lamppost[0];
  for (const [i, b] of v.boxes.entries()) {
    const band = b.y + b.h / 2 <= HEAD_CLEAR_M ? 'ground (prop)'
      : b.y - b.h / 2 >= HEAD_CLEAR_M ? 'ABOVE head height — DECLARED NOWHERE' : 'straddles';
    console.log(`  box ${i}  centre (${b.x}, ${b.y}, ${b.z})  size ${b.w} x ${b.h} x ${b.d}  -> ${band}`);
  }
  console.log(`  the arm reaches ${(Math.hypot(v.boxes[2].x, v.boxes[2].z) + v.boxes[2].d / 2).toFixed(2)} m ` +
    `from the column axis at ${v.boxes[2].y.toFixed(2)} m, over the pavement.`);
  console.log(`  the registry's claim for a lamppost is its POST: half-width ` +
    `${(v.boxes[0].w / 2).toFixed(2)} m, band 'prop', y 0 to ${HEAD_CLEAR_M}.`);
}
console.log('');
console.log('AND THE LAMPS THAT ACTUALLY LIGHT THIS CITY ARE NOT THAT PROP AT ALL');
console.log(`  prop 'lamppost' placed over the region              ${lampCount}`);
console.log(`  kerbside + promenade heads emitted by city.js       ${realHeads.length}` +
  `  (${realHeads.filter((h) => h.kind === 'kerbside').length} kerbside, ` +
  `${realHeads.filter((h) => h.kind === 'promenade').length} promenade)`);
console.log(`  their mounting height                              ${LAMP_MOUNT_M} m`);
console.log(`  their arm reach toward the road                    ${LAMP_ARM_M} m`);
console.log(`  their bowl radius                                  ${LAMP_BOWL_R} m`);
console.log(`  what either of them declares in ANY band           NOTHING — they are not props and`);
console.log(`                                                     the scatter never sees them`);
console.log('');

/* ----------------------------------------------------------- intersections */

const hits = [];
for (const lamp of lamps) {
  for (const cr of crowns) {
    if (!lamp.aabb.intersectsBox(cr.aabb)) continue;
    const dx = Math.min(lamp.aabb.max.x, cr.aabb.max.x) - Math.max(lamp.aabb.min.x, cr.aabb.min.x);
    const dy = Math.min(lamp.aabb.max.y, cr.aabb.max.y) - Math.max(lamp.aabb.min.y, cr.aabb.min.y);
    const dz = Math.min(lamp.aabb.max.z, cr.aabb.max.z) - Math.max(lamp.aabb.min.z, cr.aabb.min.z);
    hits.push({
      lamp, cr, dx, dy, dz,
      vol: dx * dy * dz,
      /** How much of the head's own volume the crown has taken. */
      frac: (dx * dy * dz) / ((lamp.aabb.max.x - lamp.aabb.min.x) *
        (lamp.aabb.max.y - lamp.aabb.min.y) * (lamp.aabb.max.z - lamp.aabb.min.z)),
      sep: Math.hypot(lamp.p.x - cr.p.x, lamp.p.z - cr.p.z),
    });
  }
}
hits.sort((a, b) => b.vol - a.vol);
const lampsHit = new Set(hits.map((h) => `${h.lamp.p.x},${h.lamp.p.z}`));
const treesHit = new Set(hits.map((h) => `${h.cr.p.x},${h.cr.p.z}`));

console.log('a. THE COUNT');
console.log(`  intersecting (lamp head, crown mass) pairs   ${hits.length}`);
console.log(`  distinct lamp heads intruded on              ${lampsHit.size} of ${lampCount}` +
  ` (${((lampsHit.size / Math.max(1, lampCount)) * 100).toFixed(2)}%)`);
console.log(`  distinct trees doing the intruding           ${treesHit.size} of ${treeCount}` +
  ` (${((treesHit.size / Math.max(1, treeCount)) * 100).toFixed(2)}%)`);
console.log('');

if (hits.length) {
  console.log('   THE DISTRIBUTION, not an adjective');
  const q = (arr, p) => {
    const a = arr.slice().sort((x, y) => x - y);
    return a[Math.min(a.length - 1, Math.max(0, Math.round(p * (a.length - 1))))];
  };
  for (const [name, vals, unit] of [
    ['overlap volume', hits.map((h) => h.vol), 'm3'],
    ['vertical overlap', hits.map((h) => h.dy), 'm'],
    ['share of the head box', hits.map((h) => h.frac * 100), '%'],
    ['lamp-to-tree spacing', hits.map((h) => h.sep), 'm'],
  ]) {
    console.log(`   ${name.padEnd(22)} min ${q(vals, 0).toFixed(3).padStart(8)}  p25 ` +
      `${q(vals, 0.25).toFixed(3).padStart(8)}  median ${q(vals, 0.5).toFixed(3).padStart(8)}  p75 ` +
      `${q(vals, 0.75).toFixed(3).padStart(8)}  max ${q(vals, 1).toFixed(3).padStart(8)}  ${unit}`);
  }
  const flippable = hits.filter((h) => h.dy <= DATUM_UNCERTAINTY_M).length;
  console.log('');
  console.log(`   pairs whose vertical overlap is under the ${DATUM_UNCERTAINTY_M} m datum uncertainty: ` +
    `${flippable} of ${hits.length} — those are the only ones a kerb could explain away.`);
  if (args.has('list')) {
    console.log('');
    for (const h of hits) {
      console.log(`   lamp (${h.lamp.p.x.toFixed(2)}, ${h.lamp.p.z.toFixed(2)}) scale ` +
        `${h.lamp.p.scale.toFixed(3)} yaw ${(h.lamp.p.yawDeg || 0).toFixed(1)}  x  tree ` +
        `(${h.cr.p.x.toFixed(2)}, ${h.cr.p.z.toFixed(2)}) variant ${h.cr.p.variant} scale ` +
        `${h.cr.p.scale.toFixed(3)}   ${h.sep.toFixed(2)} m apart   overlap ${h.dx.toFixed(3)} x ` +
        `${h.dy.toFixed(3)} x ${h.dz.toFixed(3)} = ${h.vol.toFixed(4)} m3 (${(h.frac * 100).toFixed(1)}% of the head)`);
    }
  }
}
console.log('');

console.log('a2. THE REAL LAMPS AGAINST THE REAL CROWNS — the question the brief meant to ask');
{
  const bowls = realHeads.map((h) => ({
    h,
    aabb: new THREE.Box3(
      new THREE.Vector3(h.x - LAMP_BOWL_R, h.y - LAMP_BOWL_R, h.z - LAMP_BOWL_R),
      new THREE.Vector3(h.x + LAMP_BOWL_R, h.y + LAMP_BOWL_R, h.z + LAMP_BOWL_R)
    ),
  }));
  const realHits = [];
  let nearest = { d: Infinity };
  for (const b of bowls) {
    for (const cr of crowns) {
      const dxy = Math.hypot(
        Math.max(0, Math.max(cr.aabb.min.x - b.aabb.max.x, b.aabb.min.x - cr.aabb.max.x)),
        Math.max(0, Math.max(cr.aabb.min.z - b.aabb.max.z, b.aabb.min.z - cr.aabb.max.z))
      );
      const dv = b.aabb.min.y - cr.aabb.max.y;
      if (dxy < 3.0 && dv < nearest.d) nearest = { d: dv, dxy, b, cr };
      if (b.aabb.intersectsBox(cr.aabb)) realHits.push({ b, cr });
    }
  }
  const tops = crowns.map((c) => c.aabb.max.y);
  const maxTop = Math.max(...tops);
  const q = (arr, p) => {
    const a = arr.slice().sort((x, y) => x - y);
    return a[Math.min(a.length - 1, Math.max(0, Math.round(p * (a.length - 1))))];
  };
  console.log(`   delivered canopy masses                     ${crowns.length} over ${treeCount} trees`);
  console.log(`   their tops, m above their own base          min ${q(tops, 0).toFixed(2)}  ` +
    `median ${q(tops, 0.5).toFixed(2)}  p95 ${q(tops, 0.95).toFixed(2)}  MAX ${maxTop.toFixed(2)}`);
  console.log(`   the lamp bowl's underside                   ${(LAMP_MOUNT_M - LAMP_BOWL_R).toFixed(2)} m`);
  console.log(`   CLEARANCE, tallest crown to lowest bowl     ` +
    `${(LAMP_MOUNT_M - LAMP_BOWL_R - maxTop).toFixed(2)} m`);
  console.log(`   intersecting (bowl, crown) pairs            ${realHits.length}`);
  if (nearest.d < Infinity) {
    console.log(`   closest approach within 3 m horizontally    ${nearest.d.toFixed(2)} m of vertical gap, ` +
      `${nearest.dxy.toFixed(2)} m horizontally`);
  }
  console.log('');
  console.log(`   THE COUNT IS ZERO AND IT IS NOT ZERO BY A COMFORTABLE MARGIN, which is the`);
  console.log(`   distinction that matters. The two populations OVERLAP IN HEIGHT: crowns reach`);
  console.log(`   ${maxTop.toFixed(2)} m and a bowl's underside is ${(LAMP_MOUNT_M - LAMP_BOWL_R).toFixed(2)} m, ` +
    `so ${crowns.filter((c) => c.aabb.max.y > LAMP_MOUNT_M - LAMP_BOWL_R).length} of ${crowns.length} canopy masses`);
  console.log(`   are tall enough to reach a luminaire. WHAT SEPARATES THEM IS HORIZONTAL: a lamp`);
  console.log(`   stands ${CITY.roadHalfWidth + 1.3} m from the road centreline with its arm reaching ` +
    `${LAMP_ARM_M} m back toward the kerb,`);
  console.log(`   and no tree is planted close enough for its crown to arrive there.`);
  console.log('');
  console.log(`   THE NEAREST MISS IS ${nearest.d < Infinity ? nearest.d.toFixed(2) : 'n/a'} m OF VERTICAL GAP` +
    ` at ${nearest.d < Infinity ? nearest.dxy.toFixed(2) : 'n/a'} m horizontally, which is ` +
    `${nearest.d < Infinity ? (nearest.d / DATUM_UNCERTAINTY_M).toFixed(1) : 'n/a'}x the`);
  console.log(`   ${DATUM_UNCERTAINTY_M} m datum uncertainty — so the zero survives the caveat, but only just.`);
  console.log(`   It is a bound rather than a margin: a different seed, a taller variant or a change to`);
  console.log(`   the kerb offset could produce the first one, and nothing in the project would object.`);
}
console.log('');

/* ------------------------------------------------------ b. does it cost light? */

console.log('b. DOES IT PLAUSIBLY COST LIGHT? — GEOMETRY ONLY. NO LIGHTING MODEL WAS CHANGED.');
console.log(`   The mechanism the brief proposes is a crown SITTING ON TOP OF a luminaire, cutting`);
console.log(`   the pool at its source. CONTRACT §5.9 says what that would take: a street lamp`);
console.log(`   declares an angular distribution about a named axis and follows 1/cos^3 below its`);
console.log(`   peak angle — it throws its light DOWN AND OUTWARD onto the road. So foliage costs a`);
console.log(`   pool only if it sits between the optic and the ground under it.`);
console.log('');
console.log(`   THE GEOMETRY DOES NOT SUPPORT IT. Zero crowns intersect a luminaire, so nothing is`);
console.log(`   between any optic and any pavement. The operator's standing complaint — pavements and`);
console.log(`   parks dead outside the lamp pools — is real and is carried in STATE, and this is now a`);
console.log(`   HYPOTHESIS EXCLUDED rather than a question left open: whatever is causing it, it is`);
console.log(`   not a canopy on a lamp head, because there is not one.`);
console.log('');
console.log(`   WHAT SESSION 22's FRAME PAIR ACTUALLY SHOWED, re-read against these numbers: a crown`);
console.log(`   that OCCLUDES THE VIEW OF a lamp head from a pavement-height camera 6.5 m away. That`);
console.log(`   is a line of sight passing a crown, not a crown resting on an optic, and the two are`);
console.log(`   different claims. STATE 22 §1.6 says "now occludes the streetlamp head that was`);
console.log(`   visible above it before" — which is exactly right and is not this mechanism.`);
console.log('');

/* ------------------------------------- c. what a repair would cost, if one is owed */

console.log('c. WHAT DECLARING LAMP HEADS WOULD COST — AND WHY THE ITEM IS NOT THE ONE IT LOOKED LIKE');
console.log(`   The brief's instruction was: if the count is non-trivial, write the repair up with its`);
console.log(`   cost. THE COUNT IS 0, so by the brief's own test the repair is not owed — and the`);
console.log(`   arithmetic for it is here anyway, because a zero with a 0.24 m margin under it is a`);
console.log(`   thing to keep an eye on rather than a thing to close.`);
console.log('');
console.log(`   trees a declaration would refuse today      0 of ${treeCount} (0.00%)`);
console.log(`   lamp heads currently intruded on            0 of ${realHeads.length}`);
console.log('');
console.log(`   TWO THINGS THE MEASUREMENT FOUND THAT ARE WORTH MORE THAN THE ITEM WAS:`);
console.log('');
console.log(`   1. THE POPULATION IN THE BRIEF IS EMPTY. \`PROP_MODELS.lamppost\` — the 0.17 m post`);
console.log(`      with the arm at 4.14 m — is offered only to the \`parking\` scatter and ZERO are`);
console.log(`      placed over the gate's region. Declaring ITS head in the canopy band would be a`);
console.log(`      change to an object that does not exist, which is a gate that cannot fail`);
console.log(`      (CONTRACT §7.1) wearing a claim.`);
console.log('');
console.log(`   2. THE ${realHeads.length} LAMPS THAT DO EXIST ARE IN NO BAND AT ALL. They are emitted by`);
console.log(`      \`city.js\`'s street-lighting loop, not by the prop scatter, so neither their column`);
console.log(`      nor their head is a registry claim of any kind. That is a bigger gap than a missing`);
console.log(`      pair in a table and it is a different repair: a column 1.3 m outside the kerb is`);
console.log(`      something a prop, a tree or a sign could be placed straight through, and nothing`);
console.log(`      would report it. RED FIRST — this session measured it and stopped, exactly as the`);
console.log(`      brief asked, and the first thing next session should do with it is ask the same`);
console.log(`      question of \`prop x lamp column\` that this one asked of \`canopy x lamp head\`.`);
console.log('');
console.log('lampprobe: nothing asserted, nothing declared, nothing moved.');
