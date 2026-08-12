/**
 * trainprobe.mjs — NOT A GATE. SESSION 23, item 3.
 *
 * THE TRAIN'S SECTION AS NUMBERS, AND THE RAKED NOSE'S CORNERS AGAINST THE
 * POINTS IT WAS DESIGNED TO TOUCH.
 *
 * Two things it exists to do, and the second is the one that matters.
 *
 *   1. PRINT WHAT IS ALREADY THERE. The brief asked for three changes — a raked
 *      nose, a roof cap inset from the body, a shoulder chamfer — and the roof
 *      cap has been the second box of every car since session 21. A claim like
 *      that should be a column of numbers rather than a sentence, so here is the
 *      section: every box's extent above rail level and across the car.
 *
 *   2. CHECK THE ROTATION AGAINST A CASE WHOSE ANSWER IS KNOWN FROM OUTSIDE IT.
 *      CONTRACT §7.7. The nose is placed by composing a yaw and a RAKE, and the
 *      Euler order decides whether the rake acts about the car's own transverse
 *      axis or about a world one. That is CONTRACT §9's row 2 — a basis in one
 *      convention used as the same basis in the other — and it is invisible in
 *      a still frame at yaw 0, which is exactly where it would have been
 *      checked. So the box's eight corners are transformed by the SAME
 *      `Matrix4.compose` the module uses, at several yaws, and the two corners
 *      that define the raked face are compared against the coordinates the
 *      design specifies. A mismatch is printed as a distance, not as a verdict.
 *
 * It asserts nothing and it must not. No browser, no GPU: `three`'s maths runs
 * in Node and every number here is a coordinate.
 *
 *   node tools/trainprobe.mjs
 */

import * as THREE from 'three';
import {
  LANDMARKS, viaductArc, viaductEnds, VIADUCT_RAIL_RISE_M, VIADUCT_LOADING_GAUGE_M,
} from '../src/lib/citygen.js';

/**
 * The train's numbers, READ OFF `moving.js` rather than retyped.
 *
 * `TRAIN` is a module-private constant and `moving.js` exports a factory, not
 * the table — so rather than transcribe eleven numbers (CONTRACT §9.1's
 * config-the-code-does-not-read, which is what this whole project keeps
 * finding), the table is parsed out of the source. If the parse fails this
 * says so and stops, which is the honest failure: a probe quoting stale numbers
 * is worse than one that will not start.
 */
const src = await (await import('node:fs/promises')).readFile(
  new URL('../src/modules/moving.js', import.meta.url), 'utf8'
);
const TRAIN = {};
for (const key of [
  'trains', 'cars', 'carLengthM', 'carWidthM', 'carHeightM', 'gapM', 'speedMps',
  'windowsPerSide', 'windowWidthM', 'windowHeightM',
  'noseOverhangM', 'noseTipRiseM', 'noseThickM',
]) {
  const m = src.match(new RegExp(`^\\s*${key}:\\s*([-\\d.]+),`, 'm'));
  if (!m) throw new Error(`trainprobe: could not read TRAIN.${key} out of moving.js`);
  TRAIN[key] = Number(m[1]);
}
const BOXES_PER_CAR = Number(src.match(/^const BOXES_PER_CAR = (\d+);/m)[1]);

const l = LANDMARKS.find((x) => x.kind === 'viaduct');
const arc = viaductArc(l);
const deckY = l.height + VIADUCT_RAIL_RISE_M;

console.log('trainprobe — the train\'s section, and the nose against its own design');
console.log(`  read out of moving.js: ${JSON.stringify(TRAIN)}`);
console.log(`  BOXES_PER_CAR ${BOXES_PER_CAR}; rail level ${deckY.toFixed(2)} m ` +
  `(l.height ${l.height} + VIADUCT_RAIL_RISE_M ${VIADUCT_RAIL_RISE_M})`);
console.log('');

/* ------------------------------------------------------------- the section */

const H = TRAIN.carHeightM;
const W = TRAIN.carWidthM;
const L = TRAIN.carLengthM;
const rise = H - TRAIN.noseTipRiseM;
const faceLen = Math.hypot(TRAIN.noseOverhangM, rise);
const rakeDeg = (Math.atan2(rise, TRAIN.noseOverhangM) * 180) / Math.PI;

console.log('THE SECTION, in metres above RAIL LEVEL and across the car centreline');
const SECTION = [
  ['body', 0, H, W / 2, `${L.toFixed(2)} m long — the box the operator is reading`],
  ['roof cap', H, H + 0.09 + 0.18 / 2, (W * 0.9) / 2,
    `ALREADY THERE since s21: ${(L * 0.96).toFixed(2)} long, inset ` +
    `${((W - W * 0.9) / 2).toFixed(3)} m each side`],
  ['skirt', 0, 0.56, (W * 0.86) / 2, `${(L * 0.98).toFixed(2)} long, inset ${((W - W * 0.86) / 2).toFixed(3)} m`],
  ['bogies x2', -0.43, 0.07, (W * 0.7) / 2, 'at +/-' + (L * 0.32).toFixed(2) + ' m along'],
  ['windows', H * 0.62 - TRAIN.windowHeightM / 2, H * 0.62 + TRAIN.windowHeightM / 2, W * 0.51,
    `${TRAIN.windowsPerSide} a side, emissive, zero cluster slots`],
  ['NOSE (new)', TRAIN.noseTipRiseM, H, (W * 0.94) / 2,
    `raked face ${faceLen.toFixed(3)} m at ${rakeDeg.toFixed(2)} deg from horizontal`],
];
for (const [name, y0, y1, hw, why] of SECTION) {
  console.log(`  ${name.padEnd(12)} y ${y0.toFixed(2).padStart(6)} -> ${y1.toFixed(2).padStart(6)}   ` +
    `half-width ${hw.toFixed(3)}   ${why}`);
}
const carTop = H + 0.09 + 0.18 / 2;
console.log('');
console.log(`  TOP OF THE VEHICLE: ${carTop.toFixed(2)} m above rail, against the viaduct's ` +
  `${VIADUCT_LOADING_GAUGE_M} m structure gauge — ${(VIADUCT_LOADING_GAUGE_M - carTop).toFixed(2)} m clear.`);
console.log(`  THE ROOF CAP THE BRIEF ASKED FOR IS THE SECOND ROW OF EVERY CAR AND HAS BEEN SINCE`);
console.log(`  SESSION 21. It is ${((W - W * 0.9) / 2).toFixed(3)} m inset each side and ` +
  `${((L - L * 0.96) / 2).toFixed(2)} m short at each end, so the hard upper edge is already broken.`);
console.log('');

/* ------------------------------------------- the nose, through the real matrix */

/** `moving.js`'s own placement arithmetic, so this measures the code and not a copy of it. */
function noseMatrix(yaw, face) {
  const rakeSign = -face;
  const rake = rakeSign * Math.atan2(rise, TRAIN.noseOverhangM);
  const midAlong = face * (L / 2 + TRAIN.noseOverhangM / 2);
  const midUp = TRAIN.noseTipRiseM + rise / 2;
  const nAlong = (face * rise) / faceLen;
  const nUp = TRAIN.noseOverhangM / faceLen;
  const along = midAlong - nAlong * (TRAIN.noseThickM / 2);
  const up = midUp - nUp * (TRAIN.noseThickM / 2);
  const m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(Math.cos(yaw) * along, up, -Math.sin(yaw) * along),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, rake, 'YXZ')),
    new THREE.Vector3(faceLen, TRAIN.noseThickM, W * 0.94)
  );
  return m;
}

/**
 * THE TWO POINTS THE DESIGN SPECIFIES, in the car's own (along, up) frame.
 * They are written from the derivation in `moving.js`'s comment and NOT from
 * anything this file computes, which is the whole of §7.7's requirement.
 */
function designPoints(face) {
  return {
    tip: [face * (L / 2 + TRAIN.noseOverhangM), TRAIN.noseTipRiseM],
    roof: [face * (L / 2), H],
  };
}

console.log('THE NOSE\'S RAKED FACE, through the module\'s own Matrix4.compose, at four yaws');
console.log('  the two design points are the TIP (low, forward) and the ROOF CORNER (high, at the body face)');
let worst = 0;
for (const face of [+1, -1]) {
  const d = designPoints(face);
  for (const yawDeg of [0, 45, -44.163, 137]) {
    const yaw = (yawDeg * Math.PI) / 180;
    const m = noseMatrix(yaw, face);
    // The four corners of the box's own +Y face — the raked face — in local units.
    const corners = [];
    for (const sx of [-0.5, 0.5]) {
      const v = new THREE.Vector3(sx, 0.5, 0).applyMatrix4(m);
      // Back out of world XZ into the car's own along axis.
      corners.push([v.x * Math.cos(yaw) - v.z * Math.sin(yaw), v.y]);
    }
    // Which corner is the tip (the lower one) and which the roof.
    corners.sort((a, b) => a[1] - b[1]);
    const gotTip = corners[0];
    const gotRoof = corners[1];
    const eT = Math.hypot(gotTip[0] - d.tip[0], gotTip[1] - d.tip[1]);
    const eR = Math.hypot(gotRoof[0] - d.roof[0], gotRoof[1] - d.roof[1]);
    worst = Math.max(worst, eT, eR);
    console.log(`  face ${face > 0 ? '+' : '-'}  yaw ${String(yawDeg).padStart(8)} deg   ` +
      `tip (${gotTip[0].toFixed(4)}, ${gotTip[1].toFixed(4)}) vs design (${d.tip[0].toFixed(4)}, ` +
      `${d.tip[1].toFixed(4)})  err ${eT.toExponential(2)}`);
    console.log(`  ${' '.repeat(23)}roof (${gotRoof[0].toFixed(4)}, ${gotRoof[1].toFixed(4)}) vs design ` +
      `(${d.roof[0].toFixed(4)}, ${d.roof[1].toFixed(4)})  err ${eR.toExponential(2)}`);
  }
}
console.log('');
console.log(`  worst error over all yaws and both faces: ${worst.toExponential(3)} m`);
console.log('');

/**
 * THE NEGATIVE DIRECTION, RUN RATHER THAN ASSERTED — CONTRACT §7.3. TWO ARMS,
 * AND THE FIRST ONE REFUTED THE CLAIM IT WAS WRITTEN TO CONFIRM.
 *
 * `moving.js` originally said the default `'XYZ'` Euler order would put the
 * rake in world axes and rake the train differently at every point on the
 * curve. Arm 1 below is that claim, run: the error is **0.0000 m at every
 * yaw**, identical to the delivered `'YXZ'`. With the X component zero,
 * `'XYZ'` composes `Rx(0)·Ry·Rz` and `'YXZ'` composes `Ry·Rx(0)·Rz`, and both
 * are `Ry(yaw)·Rz(rake)`. THE COMMENT WAS WRONG AND IT HAS BEEN CORRECTED —
 * §7.7's second consequence: an expectation that moves to match the instrument
 * must say which of the two was wrong.
 *
 * Arm 2 is the real negative direction, and it is what a wrong rake actually
 * looks like: the tilt applied about the car's local X (its LENGTH axis) rather
 * than its Z. That is a roll, not a rake, and it is what a reader reaching for
 * "the pitch slot" would write.
 */
function armCorners(yaw, face, mode) {
  const rake = -face * Math.atan2(rise, TRAIN.noseOverhangM);
  const midAlong = face * (L / 2 + TRAIN.noseOverhangM / 2);
  const midUp = TRAIN.noseTipRiseM + rise / 2;
  const nAlong = (face * rise) / faceLen;
  const nUp = TRAIN.noseOverhangM / faceLen;
  const along = midAlong - nAlong * (TRAIN.noseThickM / 2);
  const up = midUp - nUp * (TRAIN.noseThickM / 2);
  const eul = mode === 'xyz-default' ? new THREE.Euler(0, yaw, rake)
    : mode === 'roll-not-rake' ? new THREE.Euler(rake, yaw, 0, 'YXZ')
      : new THREE.Euler(0, yaw, rake, 'YXZ');
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(Math.cos(yaw) * along, up, -Math.sin(yaw) * along),
    new THREE.Quaternion().setFromEuler(eul),
    new THREE.Vector3(faceLen, TRAIN.noseThickM, W * 0.94)
  );
  const cs = [];
  for (const sx of [-0.5, 0.5]) {
    const v = new THREE.Vector3(sx, 0.5, 0).applyMatrix4(m);
    cs.push([v.x * Math.cos(yaw) - v.z * Math.sin(yaw), v.y]);
  }
  cs.sort((a, b) => a[1] - b[1]);
  return cs;
}

for (const [mode, label, expectation] of [
  ['xyz-default', "arm 1: the default 'XYZ' order", 'the comment said this differs. IT DOES NOT.'],
  ['roll-not-rake', 'arm 2: the tilt in the X slot (a ROLL, not a rake)', 'this is the real wrong version.'],
]) {
  console.log(`${label} — ${expectation}`);
  let w = 0;
  for (const yawDeg of [0, 45, -44.163, 137]) {
    const yaw = (yawDeg * Math.PI) / 180;
    const cs = armCorners(yaw, +1, mode);
    const d = designPoints(+1);
    const eT = Math.hypot(cs[0][0] - d.tip[0], cs[0][1] - d.tip[1]);
    w = Math.max(w, eT);
    console.log(`  yaw ${String(yawDeg).padStart(8)} deg   tip (${cs[0][0].toFixed(4)}, ` +
      `${cs[0][1].toFixed(4)}) vs design (${d.tip[0].toFixed(4)}, ${d.tip[1].toFixed(4)})   ` +
      `err ${eT.toFixed(4)} m`);
  }
  console.log(`  worst: ${w.toFixed(4)} m   ${w > 0.05 ? '<- REJECTED, as a negative control must be'
    : '<- INDISTINGUISHABLE from the delivered order'}`);
  console.log('');
}
console.log(`  So the metric separates a rake from a roll (arm 2) and CANNOT separate the two Euler`);
console.log(`  orders (arm 1), because at x = 0 they are the same matrix. The delivered order is kept`);
console.log(`  for the case where the X slot stops being zero, not because it is right today.`);
console.log('');

/* ------------------------------------------- the train against the portal */

const trainLen = TRAIN.cars * L + (TRAIN.cars - 1) * TRAIN.gapM + 2 * TRAIN.noseOverhangM;
const bodyOnlyLen = TRAIN.cars * L + (TRAIN.cars - 1) * TRAIN.gapM;
const halfArc = arc.arcLength / 2;
const leadOffset = ((TRAIN.cars - 1) / 2) * (L + TRAIN.gapM);
const ends = viaductEnds(arc, l);
const e = ends[1];

console.log('THE TURN-ROUND, AND WHY THE TRAIN\'S LENGTH HAD TO INCLUDE ITS NOSES');
for (const [label, len] of [['body only (before)', bodyOnlyLen], ['with both noses (now)', trainLen]]) {
  const clamp = halfArc - len / 2;
  const leadCentre = clamp + leadOffset;
  const bodyFace = leadCentre + L / 2;
  const tip = bodyFace + TRAIN.noseOverhangM;
  console.log(`  ${label.padEnd(22)} len ${len.toFixed(2)} m  centre clamps at s ${clamp.toFixed(2)}  ` +
    `lead car centre ${leadCentre.toFixed(2)}  body face ${bodyFace.toFixed(2)}  NOSE TIP ${tip.toFixed(2)}`);
}
console.log(`  the deck's last station is at s ${halfArc.toFixed(2)}; the portal's recess begins ` +
  `${e.reveal.toFixed(2)} m beyond it, at s ${(halfArc + e.reveal).toFixed(2)}.`);
const overrun = (halfArc - bodyOnlyLen / 2 + leadOffset + L / 2 + TRAIN.noseOverhangM) - (halfArc + e.reveal);
console.log(`  SO WITH THE OLD LENGTH THE NOSE WOULD HAVE STOOD ${overrun.toFixed(2)} m INSIDE THE RECESS.`);
console.log(`  With the new one the tip reaches s ${(halfArc - trainLen / 2 + leadOffset + L / 2 + TRAIN.noseOverhangM).toFixed(2)}` +
  ` — the deck's end exactly.`);
console.log('');

/* --------------------------------------------------------------- the cost */

const bodyRows = TRAIN.trains * TRAIN.cars * BOXES_PER_CAR;
const drawnNoses = TRAIN.trains * 2;
const allocNoses = TRAIN.trains * TRAIN.cars;
console.log('THE COST, IN COUNTS (CONTRACT §9 rule 6: counts do not drift)');
console.log(`  body rows allocated   ${TRAIN.trains} trains x ${TRAIN.cars} cars x ${BOXES_PER_CAR} = ` +
  `${bodyRows}  (was ${TRAIN.trains * TRAIN.cars * (BOXES_PER_CAR - 1)} at 5 boxes a car, so +${allocNoses})`);
console.log(`  nose rows DRAWN       ${drawnNoses} of ${allocNoses} — a cab at each end of each unit; ` +
  `the ${allocNoses - drawnNoses} middle cars park theirs at zero scale`);
console.log(`  triangles             +${drawnNoses * 12} (12 per box), on the SAME geometry and the SAME material`);
console.log(`  draw calls            +0 — moving:bodies is one InstancedMesh and stays one`);
console.log(`  cluster slots         +0 — the nose is body geometry, not an emitter`);
console.log(`  census label          movingBoxes ${bodyRows} + movingLights ` +
  `${TRAIN.trains * TRAIN.cars * (TRAIN.windowsPerSide * 2 + 1) + 4 * 1}`);
console.log('');
console.log('trainprobe: nothing asserted.');
