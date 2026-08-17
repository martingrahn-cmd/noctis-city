/**
 * portalprobe.mjs — NOT A GATE. SESSION 23, item 2.
 *
 * WHERE THE VIADUCT'S TWO ENDS LAND, WHAT IS ON THAT GROUND, AND WHO CAN SEE
 * IT — printed BEFORE anything is built there.
 *
 * THE CONSTRAINT THIS EXISTS TO SERVE IS THE ONE SESSION 5 ALREADY PAID FOR
 * ONCE. Session 5 re-aimed the whole arc because *"a pier nobody can see is not
 * a pier"*: its piers were in the geometry, they were the right length, and not
 * one of them was visible because a diagonal across a 182 m block puts every
 * one either inside a building or behind one. A portal inside a block, behind a
 * building, or standing on a carriageway is the same error one object along.
 * The difference is that `src/lib/occupancy.js` exists now, so the question is
 * testable rather than hopeful.
 *
 * NO BROWSER AND NO GPU. `generateChunk` is pure in `(rootSeed, cx, cz)`
 * (CONTRACT §8.1) and `viaductArc` is pure in the landmark, so every number
 * here is a count or a coordinate and is identical on any machine — which is
 * CONTRACT §9 rule 6's corollary and the only reason this session could measure
 * anything at all.
 *
 * IT ASSERTS NOTHING AND IT MUST NOT. `citycheck` owns the verdict on the
 * registry; this is the instrument its numbers can be reproduced from, the same
 * arrangement `benchprobe` has with the same gate.
 *
 *   node tools/portalprobe.mjs
 *   node tools/portalprobe.mjs --sweep     the depth/width sweep at both ends
 */

import { readFile } from 'node:fs/promises';
import {
  LANDMARKS, viaductArc, viaductPiers, viaductSoffitY, generateChunk, CITY,
} from '../src/lib/citygen.js';
import { claimAt, createRegistry, mayOverlap } from '../src/lib/occupancy.js';

const CITY_BUDGET = JSON.parse(await readFile(new URL('./city-budget.json', import.meta.url), 'utf8'));
const BUDGET = JSON.parse(await readFile(new URL('./budget.json', import.meta.url), 'utf8'));
const args = new Set(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')[0]));

const SEED = BUDGET.capture.params.seed || 1337;
const R = CITY_BUDGET.region;
const l = LANDMARKS.find((x) => x.name === 'viaduct');
const arc = viaductArc(l);
const soffitY = viaductSoffitY(l);
const halfDeck = l.deck / 2;

/* ------------------------------------------------------------------ section */

/**
 * THE VERTICAL SECTION AT THE END, WHICH IS THE WHOLE FINDING.
 *
 * Every one of these is read off `city.js`'s viaduct case rather than retyped
 * as a guess — the y of a box is `centre ± size/2` and that arithmetic is done
 * here so the two can be compared in one column (CONTRACT §9 rule 4: when a
 * number is derived from another, print both).
 */
const slabTop = l.height;
const SECTION = [
  ['abutment wall', 0, soffitY, 'session 21. 6.0 m along x 11.1 m across, centred 3.0 m outward'],
  ['wing wall x2', 0, soffitY * 0.72, 'session 21. 5.2 x 1.0, at +/-(halfDeck + 1.6) across'],
  ['deck box girder', soffitY, slabTop - 0.9, 'the 1.9 m box under the middle of the slab'],
  ['deck slab', slabTop - 0.9, slabTop, '0.9 m, top at l.height — rail level is the datum'],
  ['walkway kerb', slabTop, slabTop + 0.24, 'between the running line and the parapet'],
  ['ballast trough', slabTop, slabTop + 0.44, 'the raised bed the sleepers sit in'],
  ['rails', slabTop + 0.44, slabTop + 0.62, 'steel, 1.435 m gauge'],
  ['parapet', slabTop, slabTop + 1.2, 'on the deck, at +/-(halfDeck − 0.25)'],
  ['parapet RETURNS', slabTop, slabTop + 1.2, 'session 21, 6.0 m outward — REMOVED in s23'],
  ['catenary mast', slabTop, slabTop + 6.2, 'every third bay; station 0 has one, station 44 does not'],
  ['PORTAL jambs', soffitY, slabTop + 3.1 + 3.1, 's23. 0.80 m wide each, at +/-5.15 across'],
  ['PORTAL lintel', slabTop + 0.62 + 4.2, slabTop + 3.1 + 3.1, 's23. over a 9.50 m opening'],
  ['PORTAL recess', soffitY, slabTop + 0.62 + 4.2 - 0.3, 's23. dark, set back 0.30 m from the face'],
];

console.log('portalprobe — the viaduct\'s ends, before anything is built there');
console.log(`  landmark: x ${l.x} z ${l.z} height ${l.height} R ${l.arcRadius} arc ${l.arcLength} m ` +
  `heading ${l.headingDeg} deg curveSign ${l.curveSign} deck ${l.deck} m`);
console.log(`  arc: ${arc.stations.length} stations, ${arc.bays} bays, chord ${arc.chord.toFixed(3)} m, ` +
  `pier spacing ${arc.pierSpacing.toFixed(3)} m (asked ${arc.pierSpacingAsked})`);
console.log(`  soffit ${soffitY.toFixed(2)} m, rail level (l.height) ${slabTop.toFixed(2)} m`);
console.log('');
console.log('THE SECTION AT AN END, y0 -> y1 in metres above the ground datum');
for (const [name, y0, y1, why] of SECTION) {
  console.log(`  ${name.padEnd(17)} ${y0.toFixed(2).padStart(6)} -> ${y1.toFixed(2).padStart(6)}   ${why}`);
}
console.log('');
console.log(`  THE ABUTMENT TOPS OUT AT ${soffitY.toFixed(2)} m, WHICH IS EXACTLY THE SOFFIT.`);
console.log(`  The deck's own section occupies ${soffitY.toFixed(2)} to ${(slabTop + 0.62).toFixed(2)} m ` +
  `and its parapet to ${(slabTop + 1.2).toFixed(2)} m.`);
console.log(`  BEFORE SESSION 23 the only geometry between those two figures was the two parapet`);
console.log(`  RETURNS, 0.40 m thick at +/-${(halfDeck - 0.25).toFixed(2)} m across, whose underside is ` +
  `${slabTop.toFixed(2)} m — so they FLOATED`);
console.log(`  ${(slabTop - soffitY).toFixed(2)} m above the abutment they stood over, and ` +
  `${(2 * (halfDeck - 0.45)).toFixed(2)} m of deck width — slab, box girder,`);
console.log(`  ballast and rail — was cut off in mid air. THAT is what "a line that has been cut"`);
console.log(`  was, and it is a HEIGHT rather than a missing object: the abutment was a bearing.`);
console.log(`  The portal head now spans ${soffitY.toFixed(2)} to ${(slabTop + 3.1 + 3.1).toFixed(2)} m ` +
  `over a ${(halfDeck * 2).toFixed(2)} m opening, and the returns are gone.`);
console.log('');

/* --------------------------------------------------------------- the ends */

const st = arc.stations;
const ends = [
  { name: 'END A', station: st[0], sgn: -1 },
  { name: 'END B', station: st[st.length - 1], sgn: +1 },
];
for (const e of ends) {
  const s = e.station;
  const c = Math.cos((s.yawDeg * Math.PI) / -180);
  const sn = Math.sin((s.yawDeg * Math.PI) / -180);
  e.out = [c * e.sgn, sn * e.sgn];
  e.abut = [s.x + e.out[0] * 3.0, s.z + e.out[1] * 3.0];
}

/* --------------------------------------------------------------- registry */

/**
 * The registry over the gate's own region, DE-DUPLICATED.
 *
 * `generateChunk` builds a registry per chunk and every chunk within
 * `CORRIDOR` of a landmark re-claims that landmark, so a raw concatenation
 * reports the viaduct's own deck sixteen times and a reader counting rows
 * would call that sixteen objects. The de-duplication is on the claim's own
 * geometry, at full precision.
 */
const seen = new Set();
const claims = [];
for (let cz = R.cz[0]; cz <= R.cz[1]; cz++) {
  for (let cx = R.cx[0]; cx <= R.cx[1]; cx++) {
    const chunk = generateChunk(SEED, cx, cz);
    if (!chunk.registry) continue;
    for (const q of chunk.registry.all()) {
      const k = `${q.kind}|${q.owner}|${q.x0}|${q.z0}|${q.x1}|${q.z1}|${q.y0}|${q.y1}`;
      if (seen.has(k)) continue;
      seen.add(k);
      claims.push(q);
    }
  }
}
console.log(`registry over cx ${R.cx[0]}..${R.cx[1]} x cz ${R.cz[0]}..${R.cz[1]} at seed ${SEED}: ` +
  `${claims.length} distinct claims (${seen.size} after de-duplication of the per-chunk re-claims)`);

/** Does anything claim the abutment? Asked of the registry rather than assumed. */
const viaductClaims = claims.filter((q) => String(q.owner).startsWith('viaduct'));
const byOwner = {};
for (const q of viaductClaims) byOwner[`${q.kind}:${q.owner}`] = (byOwner[`${q.kind}:${q.owner}`] || 0) + 1;
console.log(`  the viaduct's own claims: ${JSON.stringify(byOwner)}`);
{
  /**
   * BEFORE SESSION 23 THIS READ "legs and deck segments only", and the sentence
   * under it was the finding: `landmarkOccluders` returns a viaduct's legs and
   * its deck, so session 21's abutment and wing walls — an 18.2 m solid,
   * 6.0 x 11.1 m, at each end — stood on ground the registry had never been
   * told about. It is checked here rather than asserted to have been fixed,
   * because a probe that describes a repair it cannot see is the thing
   * CONTRACT §9.1 calls a comment claiming a check.
   */
  const ends = viaductClaims.filter((q) => String(q.owner).endsWith(':end'));
  if (ends.length === 2) {
    console.log(`  -> the END TREATMENT IS CLAIMED, both ends, as \`landmark\` to ` +
      `y ${ends[0].y1.toFixed(2)} m. Session 23.`);
  } else {
    console.log(`  -> ${ends.length} of 2 end claims present. THE ABUTMENT AND ITS WING WALLS ` +
      `STAND ON GROUND NOTHING TESTED:`);
    console.log(`     an ${soffitY.toFixed(1)} m solid, 6.0 x 11.1 m, at each end. A portal head ` +
      `only makes that taller.`);
  }
}
console.log('');

/* ------------------------------------------------------- the world AABB of a rotated box */

/** A box of half-extents (ha along, hc across) yawed onto `out`, as a world AABB. */
function worldAabb(cx, cz, out, ha, hc) {
  const ax = Math.abs(out[0]);
  const az = Math.abs(out[1]);
  const hx = ha * ax + hc * az;
  const hz = ha * az + hc * ax;
  return { x0: cx - hx, x1: cx + hx, z0: cz - hz, z1: cz + hz, hx, hz };
}

/* ------------------------------------------------------------- visibility */

/** Slab test: is the segment eye->target clear of every box? citycheck's own arithmetic. */
function segmentClear(eye, target, boxes) {
  const d = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
  for (const b of boxes) {
    const lo = [b.x0, b.y0, b.z0];
    const hi = [b.x1, b.y1, b.z1];
    let t0 = 0;
    let t1 = 1;
    let hit = true;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-9) {
        if (eye[a] < lo[a] || eye[a] > hi[a]) { hit = false; break; }
        continue;
      }
      let ta = (lo[a] - eye[a]) / d[a];
      let tb = (hi[a] - eye[a]) / d[a];
      if (ta > tb) { const s = ta; ta = tb; tb = s; }
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 > t1) { hit = false; break; }
    }
    if (hit) return false;
  }
  return true;
}

const buildings = claims.filter((q) => q.kind === 'building');
/**
 * THE ESTABLISHING EYE. `city.js`'s placement dataset puts it at [430, 200, 470]
 * and `citycheck` asks "how many landmarks can you see from there". It is the
 * one camera in this project that is above the roofs.
 */
const ELEVATED_EYE = [430, 200, 470];

/**
 * THE FOUR GATE ROUTES, as their waypoint EXTENTS in z — read from
 * `src/modules/camera.js` → `ROUTES`. Every waypoint of every route has
 * |z| <= 3.0: all four run down the main east-west street. That single fact
 * decides whether a gate can see an end, and it is why it is printed rather
 * than described.
 */
const ROUTE_Z = { downtown_dense: [-2.0, 2.5], highway_speed: [-1.0, 3.0], night_rain: [-2.0, 2.0], player: [-2.0, 2.5] };

console.log('WHO CAN SEE AN END');
for (const e of ends) {
  const s = e.station;
  console.log(`  ${e.name} deck end at (${s.x.toFixed(3)}, ${s.z.toFixed(3)}), abutment centre ` +
    `(${e.abut[0].toFixed(3)}, ${e.abut[1].toFixed(3)}), outward (${e.out[0].toFixed(4)}, ${e.out[1].toFixed(4)})`);
  // The elevated eye, at the top of the section rather than at the ground.
  const tgt = [e.abut[0], slabTop, e.abut[1]];
  const clear = segmentClear(ELEVATED_EYE, tgt, buildings);
  const dist = Math.hypot(tgt[0] - ELEVATED_EYE[0], tgt[1] - ELEVATED_EYE[1], tgt[2] - ELEVATED_EYE[2]);
  console.log(`    elevated eye [${ELEVATED_EYE}]: ${clear ? 'CLEAR' : 'occluded'} at ${dist.toFixed(0)} m`);
  // The routes, whose cameras are all on the main street at eye height.
  for (const [name, zr] of Object.entries(ROUTE_Z)) {
    const lateral = Math.min(Math.abs(s.z - zr[0]), Math.abs(s.z - zr[1]));
    console.log(`    route ${name.padEnd(15)} runs z in [${zr[0]}, ${zr[1]}] — this end is ` +
      `${lateral.toFixed(0)} m OFF that axis, i.e. broadside to a camera looking along x`);
  }
}
console.log('');
console.log('  SO: NO GATE CAMERA IN THIS PROJECT EVER SEES EITHER END. All four routes run down the');
console.log('  main east-west street at |z| <= 3.0 m and look along x; the ends are 204 m and 226 m off');
console.log('  that axis, i.e. about 90 degrees off the view direction and outside every route\'s 55-60');
console.log('  degree field. THE CONSEQUENCE IS TWO-SIDED and both halves matter: no look assertion can');
console.log('  move when this changes, and equally NO GATE CAN CONFIRM IT — the evidence has to be a');
console.log('  `lookat.mjs` frame from a pose chosen for the subject.');
console.log('');

/* ------------------------------------------------------------ the sweep */

/**
 * COULD A PORTAL STAND THERE? Asked through `occupancy.js`'s own `conflict()`
 * against the region's registry, at the category the mass would be claimed
 * under — never through a hand-rolled overlap test, which is the fifth private
 * idea of occupancy CONTRACT §9.1 says the registry exists to retire.
 */
const reg = createRegistry();
reg.claimAll(claims);

function tryPortal(e, depth, halfAcross, top, verbose) {
  const cx = e.station.x + e.out[0] * (depth / 2);
  const cz = e.station.z + e.out[1] * (depth / 2);
  const a = worldAabb(cx, cz, e.out, depth / 2, halfAcross);
  const box = claimAt('landmark', cx, cz, a.hx, a.hz, { y0: 0, y1: top, owner: 'viaduct:portal' });
  const hit = reg.conflict(box);
  if (verbose && hit) {
    console.log(`      refused by ${hit.kind}:${hit.owner} x[${hit.x0.toFixed(1)},${hit.x1.toFixed(1)}] ` +
      `z[${hit.z0.toFixed(1)},${hit.z1.toFixed(1)}] y[${hit.y0.toFixed(2)},${hit.y1.toFixed(2)}]`);
  }
  return { box, hit, aabbHalf: [a.hx, a.hz] };
}

console.log('COULD A PORTAL STAND THERE? conflict() against the region registry, category `landmark`.');
console.log(`  (the world AABB of the rotated box is used, which is CONSERVATIVE — it is larger than the`);
console.log(`   box at every yaw but the axis-aligned ones, so a PASS here is a pass for the real shape)`);
for (const e of ends) {
  console.log(`  ${e.name}:`);
  const HALF = (l.deck + 1.6) / 2;
  for (const depth of [4, 6, 8, 10, 12, 14, 16, 20]) {
    const r = tryPortal(e, depth, HALF, 27.0, false);
    console.log(`    depth ${String(depth).padStart(2)} m x ${(HALF * 2).toFixed(1)} m across, top 27.0 m: ` +
      `${r.hit ? `REFUSED by ${r.hit.kind}:${r.hit.owner}` : 'free'}`);
  }
  if (args.has('sweep')) {
    for (const across of [11.1, 12.7, 14.0, 16.0, 18.0]) {
      const r = tryPortal(e, 6, across / 2, 27.0, false);
      console.log(`    depth  6 m x ${across.toFixed(1)} m across: ` +
        `${r.hit ? `REFUSED by ${r.hit.kind}:${r.hit.owner}` : 'free'}`);
    }
  }
}
console.log('');

/* --------------------------------------------- the nearest thing at each end */

console.log('THE NEAREST CLAIM OF EACH KIND TO EACH END, so a refusal has a distance beside it');
for (const e of ends) {
  const s = e.station;
  console.log(`  ${e.name} at (${s.x.toFixed(2)}, ${s.z.toFixed(2)})`);
  const best = new Map();
  for (const q of claims) {
    if (String(q.owner).startsWith('viaduct')) continue;
    const dx = Math.max(0, Math.max(q.x0 - s.x, s.x - q.x1));
    const dz = Math.max(0, Math.max(q.z0 - s.z, s.z - q.z1));
    const d = Math.hypot(dx, dz);
    const cur = best.get(q.kind);
    if (!cur || d < cur.d) best.set(q.kind, { d, q });
  }
  const rows = [...best.entries()].sort((a, b) => a[1].d - b[1].d);
  for (const [kind, { d, q }] of rows) {
    const forbidden = !mayOverlap('landmark', kind);
    console.log(`    ${d.toFixed(2).padStart(7)} m  ${kind.padEnd(12)} ${String(q.owner).padEnd(22)} ` +
      `y[${q.y0.toFixed(2)},${q.y1.toFixed(2)}]  ${forbidden ? 'FORBIDDEN vs landmark' : 'may overlap'}`);
  }
}
console.log('');
console.log(`  CITY.roadHalfWidth ${CITY.roadHalfWidth} m; the portal legs stand at ` +
  `+/-${l.pierLegOffset} m with half ${l.pierLegHalf} m.`);
console.log('portalprobe: nothing asserted. citycheck owns the verdict.');
