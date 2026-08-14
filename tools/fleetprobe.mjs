#!/usr/bin/env node
/**
 * fleetprobe.mjs — WHERE A VEHICLE'S EXTENT IS USED, MEASURED. NOT A GATE.
 * ========================================================================
 *
 * SESSION 29. Written BEFORE the bus and the lorry, because CONTRACT §9 rule 7
 * asks "measured from what, and does the other side agree?" of every new
 * distance — and a 12 m body is a new distance arriving inside a model that has
 * carried a fleet of 2.20–9.60 m for twenty sessions. Session 23 found the
 * train's turn-round clamp using its BODY LENGTH where it wanted its EXTENT,
 * and the two had been the same number until a nose 1.6 m long separated them.
 * A bus is that separation applied to five call sites at once.
 *
 * THE POINT IS THAT IT IS MEASURED AND NOT READ. STATE 28 and six briefs before
 * it record the same lesson from the other side: a premise read out of source
 * and believed is a premise nobody checked. So every quantity below is taken
 * off the LIVE module's own integration — `traffic.js` is booted through the
 * `headlesscity.mjs` stub, driven for real signal cycles at dt = 1/60, and
 * every number is read out of `_internal.vehicles` and `BODY_TYPES` as they
 * actually are, never transcribed from the table.
 *
 * NO GPU, for `stoplineprobe.mjs`'s reason: traffic's integration is arithmetic.
 * What is substituted is `lights`, `time` and the camera, none of which enters
 * a length.
 *
 * THE SIX PLACES AN EXTENT CAN HIDE, and what this measures at each:
 *
 *   1 CAR FOLLOWING     `gap = (lead.s − s)·dir − (len + leadLen)/2`. Measured:
 *                       the delivered bumper-to-bumper gap distribution and the
 *                       WORST OVERLAP — a negative gap is one body inside
 *                       another and no number in the model forbids it.
 *   2 THE CAMERA        `gapCam = (camS - s)*dir - len/2 - CAMERA_CLEARANCE`. Measured: the
 *                       closest a body's NOSE ever comes to the eye.
 *   3 THE STOP LINE     `toStop = (nextJ - along)*dir - STOP_LINE - len/2`. Measured per type, so
 *                       the class that sets `worstStopLineM` is named rather
 *                       than assumed. This is `trafficLights.minStopLineM`.
 *   4 THE RECYCLER      `seed()` contained NO length term and no spacing test at
 *                       all, and this probe is what found that. Measured: how
 *                       often a freshly seeded vehicle lands inside a body
 *                       already on that line, and by how much. BEFORE the
 *                       session-29 spacing test: 245 of 637 re-seats, 38.5%,
 *                       worst overlap 9.475 m. AFTER: 3 of 872, 0.34%, worst
 *                       1.698 m, and the residual is the FALLBACK path, which
 *                       places a body without the test and is counted.
 *   5 THE TURN          a quarter circle traversed by the vehicle's ORIGIN at
 *                       TURN_RADIUS = 8.0 m. A long body's corners sweep
 *                       outside the path its origin takes, and nothing in the
 *                       model knows that. Measured: the maximum excursion of
 *                       each type's own body corners outside the arc, computed
 *                       from the delivered yaw and position.
 *   6 JUNCTION OCCUPANCY `veh.cleared` is a permission keyed by junction id with
 *                       no duration and no length in it. Measured: how long a
 *                       body's EXTENT spans the junction box, per type — the
 *                       quantity an exit reservation would have to reserve.
 *
 * AND ONE QUESTION THAT IS NOT ABOUT EXTENT AT ALL, because session 28 shipped
 * a session of content into the path the operator was not looking at:
 *
 *   0 WHICH CONTENT PATH   traffic is ONE module on the 128 m lattice, not
 *                       per-chunk content, so it is not `city.js` or `block.js`
 *                       — it drives over both. Measured: the share of
 *                       vehicle-frames spent inside `BLOCK_KEEPOUT`, the origin
 *                       block's own extent, and the closest approach to the
 *                       look gate's own eye at [70, 1.74, 0.9].
 *
 * Usage:
 *   node tools/fleetprobe.mjs                  12 signal cycles, moving eye
 *   node tools/fleetprobe.mjs --cycles=20
 *   node tools/fleetprobe.mjs --eye=street     eye parked at the look shot
 */

import * as THREE from 'three';
import { makeStubCtx } from './lib/headlesscity.mjs';
import { createTraffic } from '../src/modules/traffic.js';
import { BLOCK_KEEPOUT, CITY } from '../src/lib/citygen.js';

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);

const CYCLE_S = 36;
const CYCLES = Number(args.get('cycles') || 12);
const DT = 1 / 60;
const FRAMES = Math.round((CYCLES * CYCLE_S) / DT);
/** The look gate's own eye. `headlesscity.mjs` → CITYCHECK_EYE, same three numbers. */
const LOOK_EYE = [70, 1.74, 0.9];
const PARKED = args.get('eye') === 'street';

console.log('fleetprobe — where a vehicle\'s extent is used, measured. NOT A GATE.');
console.log(`node ${process.version}  ·  ${process.platform}/${process.arch}`);
console.log('no renderer, no browser, no pixel: traffic integration is CPU arithmetic.\n');

const ctx = makeStubCtx({ seed: 1337, eye: LOOK_EYE });
const time = ctx.get('time');
const traffic = createTraffic();
const api = traffic.init(ctx) || traffic.api || {};
ctx.$set('traffic', api);

const { vehicles, BODY_TYPES, lanePosition } = api._internal;
const TYPES = BODY_TYPES.map((t) => t.name);

const q = (list, f) => {
  const a = [...list].sort((x, y) => x - y);
  return a.length ? a[Math.min(a.length - 1, Math.max(0, Math.round(f * (a.length - 1))))] : NaN;
};
const fx = (n, d = 3) => (Number.isFinite(n) ? n.toFixed(d) : 'n/a');

// --- what the module says about itself, before it is driven ------------------

console.log('== THE FLEET AS DELIVERED BY THE MODULE, NEVER TRANSCRIBED ==');
console.log('  name      len     wide    high    min     speed   weight  boxes  wheels  lights');
for (const t of BODY_TYPES) {
  let high = 0;
  for (const b of t.boxes) high = Math.max(high, b[3] + b[1] / 2);
  console.log(
    `  ${t.name.padEnd(9)} ${t.len.toFixed(2).padStart(6)}  ${t.wide.toFixed(2).padStart(6)}  ` +
    `${high.toFixed(2).padStart(6)}  ${t.min.toFixed(2).padStart(6)}  ${t.speed.toFixed(2).padStart(6)}  ` +
    `${t.weight.toFixed(3).padStart(6)}  ${String(t.boxes.length).padStart(5)}  ` +
    `${String(t.wheels.length).padStart(6)}  ${String(t.lights.length).padStart(6)}`
  );
}
{
  const wsum = BODY_TYPES.reduce((a, t) => a + t.weight, 0);
  const lsum = BODY_TYPES.reduce((a, t) => a + t.weight * t.len, 0) / wsum;
  console.log(`  declared weights sum to ${wsum.toFixed(4)}; weighted mean length ${lsum.toFixed(3)} m`);
}

// --- drive it ---------------------------------------------------------------

const N = vehicles.length;
const prev = vehicles.map(() => null);
const framesInBlock = new Array(N).fill(0);
let vehFrames = 0;
let blockFrames = 0;
let nearestEye = Infinity;
let nearestEyeType = null;

/** 1 — car following. */
const gaps = [];
let worstOverlap = Infinity;
let worstOverlapPair = null;

/** 3 — the stop line, per type. */
const stopByType = new Map(TYPES.map((n) => [n, []]));
let worstStop = Infinity;
let worstStopType = null;

/** 4 — the recycler. */
let seeds = 0;
let seedsInsideABody = 0;
let worstSeedOverlap = Infinity;
const seedGaps = [];

/** 5 — the turn. */
const turnExcursion = new Map(TYPES.map((n) => [n, 0]));
/** 6 — junction occupancy, in vehicle-frames of body extent over the box. */
const boxSpan = new Map(TYPES.map((n) => [n, 0]));
const typeFrames = new Map(TYPES.map((n) => [n, 0]));

const pos = { x: 0, z: 0 };
const HALF_JUNCTION = CITY.roadHalfWidth;
/** `traffic.js` → TURN_RADIUS. Read here as a literal and printed, so a change there shows up as a disagreement rather than silently. */
const TURN_RADIUS = 8.0;

/**
 * The centre of the quarter circle a turning vehicle is on, reconstructed the
 * way `traffic.js`'s emitter does: RIGHT = cross(heading, up) = (−hz, hx), and
 * the centre sits TURN_RADIUS to the vehicle's right of the entry line at the
 * point the turn begins.
 */
function turnCentre(v) {
  if (!v.turn) return null;
  lanePosition(v.axis, v.line, v.dir, v.lane,
    v.turn.j - v.dir * (TURN_RADIUS + [1.75, 5.25][v.lane]), pos);
  const hx = v.axis === 0 ? v.dir : 0;
  const hz = v.axis === 0 ? 0 : v.dir;
  return { x: pos.x + -hz * TURN_RADIUS, z: pos.z + hx * TURN_RADIUS };
}

for (let f = 0; f < FRAMES; f++) {
  time.now = f * DT;
  time.frame = f;
  if (!PARKED) ctx.camera.position.z = LOOK_EYE[2] - 6.0 * f * DT;
  traffic.update(ctx, DT);
  const s = api.stats();

  /**
   * Buckets: same axis, line, dir, lane, AND NOT TURNING — which is exactly
   * `traffic.js`'s own `tracks` map, including its `if (veh.turn) continue`.
   * Bucketing differently here would measure a following model the module does
   * not run (CONTRACT §7.7: the instrument is where the failure mode hides).
   */
  const buckets = new Map();
  for (let i = 0; i < N; i++) {
    const v = vehicles[i];
    if (v.turn) continue;
    const key = `${v.axis}:${v.line}:${v.dir}:${v.lane}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(i);
  }

  for (const list of buckets.values()) {
    list.sort((a, b) => (vehicles[a].s - vehicles[b].s) * vehicles[a].dir);
    for (let k = 0; k + 1 < list.length; k++) {
      const a = vehicles[list[k]];
      const b = vehicles[list[k + 1]];
      const gap = (b.s - a.s) * a.dir - (BODY_TYPES[a.type].len + BODY_TYPES[b.type].len) * 0.5;
      gaps.push(gap);
      if (gap < worstOverlap) {
        worstOverlap = gap;
        worstOverlapPair = [TYPES[a.type], TYPES[b.type], f];
      }
    }
  }

  for (let i = 0; i < N; i++) {
    const v = vehicles[i];
    const t = BODY_TYPES[v.type];
    vehFrames++;

    // 0 — which content path. The delivered px/pz, written by the emitter.
    const inBlock = v.px > BLOCK_KEEPOUT.x0 && v.px < BLOCK_KEEPOUT.x1 &&
      v.pz > BLOCK_KEEPOUT.z0 && v.pz < BLOCK_KEEPOUT.z1;
    if (inBlock) { blockFrames++; framesInBlock[i]++; }
    /**
     * THE CLOSEST APPROACH TO THE EYE, AND THE FIRST VERSION OF THIS LINE WAS
     * `hypot(dx, dz) - len/2`, WHICH IS NOT A DISTANCE TO A BODY.
     *
     * It subtracts the half-LENGTH whatever the body's orientation, so a 12 m
     * bus passing BROADSIDE in the next lane 4.35 m away scored -1.65 m and read
     * as a bus driving through the camera. The quantity wanted is the distance
     * from the eye to the oriented box, so the eye goes into the vehicle's own
     * frame — along its heading and across it — and is clamped to the
     * half-extents there. CONTRACT §9 rule 7: measured from what, and does the
     * other side agree.
     */
    const dx = v.px - LOOK_EYE[0];
    const dz = v.pz - LOOK_EYE[2];
    const alongE = dx * v.hx + dz * v.hz;
    const latE = -dx * v.hz + dz * v.hx;
    const dEye = Math.hypot(
      Math.max(0, Math.abs(alongE) - t.len * 0.5),
      Math.max(0, Math.abs(latE) - t.wide * 0.5)
    );
    if (dEye < nearestEye) { nearestEye = dEye; nearestEyeType = t.name; }

    // 4 — the recycler. `recycled` lives one frame; compare against last frame.
    const p = prev[i];
    if (p && (Math.abs(v.s - p.s) > 40 || v.axis !== p.axis || v.line !== p.line)) {
      seeds++;
      let closest = Infinity;
      let overlapped = false;
      for (let j = 0; j < N; j++) {
        if (j === i) continue;
        const o = vehicles[j];
        if (o.axis !== v.axis || o.line !== v.line || o.dir !== v.dir || o.lane !== v.lane) continue;
        const clear = Math.abs(o.s - v.s) - (t.len + BODY_TYPES[o.type].len) * 0.5;
        if (clear < closest) closest = clear;
      }
      if (Number.isFinite(closest)) {
        seedGaps.push(closest);
        if (closest < 0) overlapped = true;
        if (closest < worstSeedOverlap) worstSeedOverlap = closest;
      }
      if (overlapped) seedsInsideABody++;
    }

    /**
     * 5 — THE TURN, AND THE FIRST VERSION OF THIS COLUMN MEASURED THE ARC.
     *
     * It reported the corner's distance from the ENTRY lane's centreline, which
     * grows to TURN_RADIUS by construction as the vehicle rounds the corner —
     * so it read 9.10 m for a motorcycle and 12.76 m for a hauler and both
     * numbers were the turn working. CONTRACT §7.7: the instrument written to
     * find a length used as the wrong quantity used one itself, in its first
     * run. What is wanted is OFF-TRACKING: how far a rigid body's corners swing
     * outside the annulus its own half-width entitles them to.
     *
     * The origin runs a circle of radius R about the turn centre. A corner at
     * (±L along, ±W across) sits at radius sqrt((R ± W)² + L²), so its
     * excursion past R + W is sqrt((R+W)² + L²) − (R + W) ≈ L²/(2R) — a
     * quantity in the SQUARE of the half-length, which is why it is the number
     * a long body finds and a short one does not.
     */
    if (v.turn) {
      const half = t.len * 0.5;
      const halfW = t.wide * 0.5;
      const sx = v.hx;   // sin yaw, as the emitter wrote it
      const cz = v.hz;   // cos yaw
      const c = turnCentre(v);
      if (c) {
        let worst = 0;
        for (const along of [half, -half]) {
          for (const lat of [halfW, -halfW]) {
            const cxw = v.px + sx * along - cz * lat;
            const czw = v.pz + cz * along + sx * lat;
            const r = Math.hypot(cxw - c.x, czw - c.z);
            // Outside the outer rail, or inside the inner one: both are the
            // body leaving the band its own width entitles it to.
            const outside = Math.max(r - (TURN_RADIUS + halfW), (TURN_RADIUS - halfW) - r);
            if (outside > worst) worst = outside;
          }
        }
        if (worst > turnExcursion.get(t.name)) turnExcursion.set(t.name, worst);
      }
    }

    /**
     * 6 — JUNCTION OCCUPANCY. Does this body's EXTENT span a junction box?
     *
     * Reported as a SHARE of each type's own vehicle-frames, not as a raw
     * count: a raw count is dominated by how many of that type the multinomial
     * happened to draw. The peak overhang the first version printed was
     * `len/2 + roadHalfWidth`, i.e. the geometry restated — it could not have
     * been anything else and measured nothing.
     */
    typeFrames.set(t.name, typeFrames.get(t.name) + 1);
    const along = v.axis === 0 ? v.px : v.pz;
    const j = Math.round(along / CITY.chunkSize) * CITY.chunkSize;
    const d = Math.abs(along - j);
    if (d < t.len * 0.5 + HALF_JUNCTION) boxSpan.set(t.name, boxSpan.get(t.name) + 1);

    prev[i] = { s: v.s, axis: v.axis, line: v.line };
  }

  // 3 — the stop line, attributed to the type that set it.
  const w = s.frameWorstStopLineWitness;
  if (w) {
    const name = w.type || w.bodyType || null;
    if (name && stopByType.has(name)) stopByType.get(name).push(w.toStopM);
    if (w.toStopM < worstStop) { worstStop = w.toStopM; worstStopType = name; }
  }
}

// --- the report -------------------------------------------------------------

const s = api.stats();
console.log(`\n${FRAMES} frames = ${(FRAMES * DT).toFixed(0)} simulated seconds = ${CYCLES} signal cycles`);
console.log(`${s.vehicles} vehicles, ${vehFrames} vehicle-frames\n`);

console.log('== 0. WHICH CONTENT PATH DOES A VEHICLE REACH ==');
console.log('  Traffic is ONE module on the 128 m lattice. It is neither city.js nor block.js;');
console.log(`  BLOCK_KEEPOUT is x [${BLOCK_KEEPOUT.x0}, ${BLOCK_KEEPOUT.x1}], z [${BLOCK_KEEPOUT.z0}, ${BLOCK_KEEPOUT.z1}] — the origin block's own extent.`);
console.log(`  vehicle-frames inside the origin block's extent: ${blockFrames} of ${vehFrames} = ${(100 * blockFrames / vehFrames).toFixed(2)}%`);
console.log(`  vehicles that were inside it at some point:      ${framesInBlock.filter((n) => n > 0).length} of ${N}`);
console.log(`  closest any body's NOSE came to the look eye [70, 1.74, 0.9]: ${fx(nearestEye)} m (${nearestEyeType})`);

console.log('\n== 1. CAR FOLLOWING — the gap the model computes, delivered ==');
console.log(`  bumper-to-bumper gap, ${gaps.length} pair-frames:`);
console.log(`    min ${fx(q(gaps, 0))}  p01 ${fx(q(gaps, 0.01))}  median ${fx(q(gaps, 0.5))}  p99 ${fx(q(gaps, 0.99))} m`);
console.log(`    negative gaps (one body inside another): ${gaps.filter((g) => g < 0).length} of ${gaps.length}` +
  (worstOverlapPair ? `   worst ${fx(worstOverlap)} m, ${worstOverlapPair[0]} behind ${worstOverlapPair[1]}` : ''));

console.log('\n== 3. THE STOP LINE — trafficLights.minStopLineM, per type ==');
console.log(`  worst over the run: ${fx(worstStop)} m` + (worstStopType ? ` (${worstStopType})` : ''));
for (const [name, list] of stopByType) {
  if (!list.length) { console.log(`    ${name.padEnd(9)} — never set the per-frame worst`); continue; }
  console.log(`    ${name.padEnd(9)} n ${String(list.length).padStart(6)}   min ${fx(q(list, 0))}   median ${fx(q(list, 0.5))} m`);
}

console.log('\n== 4. THE RECYCLER — the spawn spacing test, and what it delivers ==');
console.log(`  re-seats observed: ${seeds}`);
if (s.seedRejects !== undefined) {
  console.log(`  candidate placements the spacing test refused: ${s.seedRejects}`);
  console.log(`  seeds that exhausted all 12 candidates and took the FALLBACK: ${s.seedFallbacks}` +
    '   ← a fallback places a body WITHOUT the test');
}
if (seedGaps.length) {
  console.log(`  clearance to the nearest body already on that line, at the moment of seeding:`);
  console.log(`    min ${fx(worstSeedOverlap)}  p05 ${fx(q(seedGaps, 0.05))}  median ${fx(q(seedGaps, 0.5))} m`);
  console.log(`  seeds landing INSIDE another body: ${seedsInsideABody} of ${seeds} = ${(100 * seedsInsideABody / Math.max(1, seeds)).toFixed(2)}%`);
}

console.log(`\n== 5. THE TURN — TURN_RADIUS ${TURN_RADIUS.toFixed(1)} m is run by the ORIGIN, not by the body ==`);
console.log('  OFF-TRACKING: how far a body corner swings outside the band its own half-width');
console.log('  entitles it to, measured on the delivered arc. Lane pitch is 3.50 m, so an');
console.log('  excursion over 1.75 m puts a corner past the next lane\'s centreline.');
console.log('    type      measured   L²/2R predicted   half-length');
for (const [name, v] of turnExcursion) {
  const t = BODY_TYPES[TYPES.indexOf(name)];
  const L = t.len / 2;
  console.log(`    ${name.padEnd(9)} ${fx(v, 3).padStart(8)} m ${fx(L * L / (2 * TURN_RADIUS), 3).padStart(13)} m ${L.toFixed(2).padStart(13)}`);
}

console.log('\n== 6. JUNCTION OCCUPANCY — `cleared` is a permission with no length in it ==');
console.log('  share of each type\'s own vehicle-frames with its body EXTENT over a junction box:');
for (const [name, n] of boxSpan) {
  const tf = typeFrames.get(name);
  console.log(`    ${name.padEnd(9)} ${(100 * n / Math.max(1, tf)).toFixed(2).padStart(6)}%  (${n} of ${tf} vehicle-frames)`);
}

/**
 * THE SHAPE METRICS, THROUGH THE GEOMETRY PATH — §7.5's `fromBoxes` arm.
 *
 * `hullprobe.mjs` owns this comparison and needs a browser for its delivered
 * arms; this is the same sampling with no browser, so a body type can be shaped
 * against `silhouettes.minWidthSpan` and `minRoofSpan` BEFORE it is put in front
 * of a camera. §9.1 says a second copy of a sampling drifts, which is why a GATE
 * may not have one and a probe that prints its control may.
 *
 * THE CONTROL, and it is the §7.7 requirement rather than a nicety: the five
 * types that existed before session 29 have published replica figures in
 * `traffic.js`'s own session-9 comment — width 0.1610–0.4240, roof 0.3522–0.4482
 * — measured by `hullprobe`. If this path reproduces them it is the same
 * instrument; if it does not, its numbers about a NEW body are not comparable to
 * the floor those numbers are compared against.
 */
function shapeFromBoxes(t, S) {
  // BODY_TYPES rows are [len, height, width, centreHeight, albedo, rough, centreAlong].
  const boxes = t.boxes.map((b) => ({ along: b[6], len: b[0], wide: b[2], h: b[1], cy: b[3] }));
  let a0 = Infinity; let a1 = -Infinity; let u0 = Infinity; let u1 = -Infinity;
  let l0 = Infinity; let l1 = -Infinity;
  for (const b of boxes) {
    a0 = Math.min(a0, b.along - b.len / 2); a1 = Math.max(a1, b.along + b.len / 2);
    u0 = Math.min(u0, b.cy - b.h / 2); u1 = Math.max(u1, b.cy + b.h / 2);
    l0 = Math.min(l0, -b.wide / 2); l1 = Math.max(l1, b.wide / 2);
  }
  /**
   * THE SUBJECT'S DATUM IS THE LOWEST BOX, NOT THE GROUND, AND THE FIRST VERSION
   * OF THIS FUNCTION USED THE GROUND.
   *
   * With the ground as the datum the five pre-session-29 types read 0.3363-0.3898
   * against hullprobe's published 0.3522-0.4482 — the same shapes, a different
   * quantity, and no amount of looking at the number would have said which. The
   * subject's own extent is over its BODY BOXES: the sill's lower edge is the
   * bottom and the wheels are not in it. Restated with the correct datum the van
   * reads 0.4497 against a published 0.4482, i.e. the same instrument.
   *
   * This is CONTRACT §7.7 exactly — the check that caught it is a case whose
   * answer is known from OUTSIDE this file, and it was written in the same change
   * as the instrument.
   */
  const bottom = u0;
  const heightM = u1 - bottom;
  const widthM = l1 - l0;
  const lengthM = a1 - a0;
  /**
   * AND THE TWO METRICS DO NOT SHARE A DATUM. §7.6 says they are separate
   * assertions over separate populations; they are also separate ARITHMETIC.
   * The width probe stands at `latHeight` of the subject's height measured from
   * the GROUND — it is `traffic.js`'s own `probeH = high * 0.50`, printed at
   * boot as "width probe: wedge 0.64 m", and 0.64 = 0.50 x 1.28 is the wedge's
   * roof height above the road, not above its sill. Using the roof metric's
   * datum here moved the van from 0.1650 to 0.1600 and dropped two stations,
   * which is a width reading taken at the wrong height and would have shaped a
   * new body against a probe the gate does not use.
   */
  const probeH = u1 * S.latHeight;
  const aLo = a0 + lengthM * S.trim;
  const band = (a1 - lengthM * S.trim - aLo) / S.stations;
  const med = (xs) => {
    const s = xs.slice().sort((x, y) => x - y);
    const h = s.length >> 1;
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
  };
  const pc = (sorted, p) => {
    const r = p * (sorted.length - 1);
    const lo = Math.floor(r);
    const hi = Math.min(sorted.length - 1, lo + 1);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (r - lo);
  };
  const wide = [];
  const roof = [];
  for (let i = 0; i < S.stations; i++) {
    const wv = [];
    const rv = [];
    for (let j = 0; j < S.subSamples; j++) {
      const a = aLo + band * (i + (j + 0.5) / S.subSamples);
      let lo = Infinity; let hi = -Infinity; let top = -Infinity;
      for (const b of boxes) {
        if (a < b.along - b.len / 2 || a > b.along + b.len / 2) continue;
        if (b.cy + b.h / 2 > top) top = b.cy + b.h / 2;
        // §7.5's straddle rule: only boxes crossing the probe height count for width.
        if (probeH < b.cy - b.h / 2 || probeH > b.cy + b.h / 2) continue;
        lo = Math.min(lo, -b.wide / 2); hi = Math.max(hi, b.wide / 2);
      }
      if (hi > lo) wv.push((hi - lo) / widthM);
      // §7.4: the fraction of the [bottom, overshoot x height] segment the roof reaches.
      if (top > -Infinity) rv.push((top - bottom) / (S.overshoot * heightM));
    }
    if (wv.length) wide.push(med(wv));
    if (rv.length) roof.push(med(rv));
  }
  const ws = wide.slice().sort((x, y) => x - y);
  const rs = roof.slice().sort((x, y) => x - y);
  return {
    widthSpan: wide.length >= Math.ceil(S.minStationFraction * S.stations) ? +(pc(ws, 0.9) - pc(ws, 0.1)).toFixed(4) : null,
    roofSpan: roof.length ? +(pc(rs, 0.9) - pc(rs, 0.1)).toFixed(4) : null,
    stations: wide.length,
    heightM: +heightM.toFixed(2),
    probeH: +probeH.toFixed(2),
  };
}

console.log('\n== THE SHAPE METRICS THROUGH THE GEOMETRY PATH (§7.5 fromBoxes) ==');
{
  const S = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('./budget.json', import.meta.url), 'utf8')).silhouettes;
  const cf = S.kinds.vehicle;
  console.log(`  floors: widthSpan >= ${cf.minWidthSpan}, roofSpan >= ${cf.minRoofSpan}; both are MEDIAN-over-population`);
  console.log('  plus a pass fraction of ' + S.minPassFraction + ', so a single failing type is not on its own a red.');
  console.log('    type      widthSpan   roofSpan   stations  height  probeH');
  for (const t of BODY_TYPES) {
    const r = shapeFromBoxes(t, S);
    const wf = r.widthSpan == null ? ' n/a ' : (r.widthSpan >= cf.minWidthSpan ? ' ' : '!');
    const rf = r.roofSpan == null ? ' n/a ' : (r.roofSpan >= cf.minRoofSpan ? ' ' : '!');
    console.log(
      `    ${t.name.padEnd(9)} ${fx(r.widthSpan, 4).padStart(8)}${wf}  ${fx(r.roofSpan, 4).padStart(8)}${rf}  ` +
      `${String(r.stations).padStart(8)}  ${fx(r.heightM, 2).padStart(6)}  ${fx(r.probeH, 2).padStart(6)}`
    );
  }
  console.log('  CONTROL — traffic.js\'s own session-9 replica figures, measured by hullprobe:');
  console.log('    width 0.1610-0.4240, roof 0.3522-0.4482 over the five pre-session-29 types.');
  console.log('    A reading outside that band for one of those five means this path is NOT hullprobe\'s.');
}

console.log('\n== FLEET COMPOSITION DELIVERED, against the declared weights ==');
{
  const counts = new Array(TYPES.length).fill(0);
  for (const v of vehicles) counts[v.type]++;
  const wsum = BODY_TYPES.reduce((a, t) => a + t.weight, 0);
  for (let i = 0; i < TYPES.length; i++) {
    console.log(`    ${TYPES[i].padEnd(9)} ${String(counts[i]).padStart(4)} of ${N} = ${(100 * counts[i] / N).toFixed(1)}%   declared ${(100 * BODY_TYPES[i].weight / wsum).toFixed(1)}%`);
  }
}
console.log('\nAsserts nothing. `perfcheck` and `citycheck` own every verdict this touches.');
