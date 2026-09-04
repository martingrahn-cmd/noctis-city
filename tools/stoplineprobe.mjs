#!/usr/bin/env node
/**
 * stoplineprobe.mjs — WHICH VEHICLE SETS `worstStopLineM`, AND WHY.
 * =================================================================
 *
 * NOT A GATE. SESSION 25.
 *
 * THE QUESTION, AND IT IS NOT THE ONE THE REPAIR ASSUMES.
 * `trafficLights.minStopLineM` is 0 and `worstStopLineM` has been about −10.5 m
 * since session 21 — a vehicle held at a red with its nose ten metres past its
 * own stop line. Three sessions have carried the same proposed repair (a
 * reservation on the junction EXIT) and none has measured **which vehicle
 * produces the number**. Two worlds give the same figure and they want opposite
 * repairs:
 *
 *   SPILLBACK   a vehicle entered the box on green, its exit was blocked, it
 *               stopped inside. Real, and the exit reservation is the answer.
 *   A TELEPORT  `traffic.js` re-seats an instance somewhere else entirely when
 *               it leaves the simulated radius, and a re-seated vehicle gets
 *               `cleared = null` — no permission — so it is eligible for this
 *               statistic from its first frame. Its distance to "its own" stop
 *               line then describes where the recycler dropped it.
 *
 * STATE 22 §5 and STATE 24 §3 both asked for this measurement first and both
 * deferred it. Building the repair without it is CONTRACT §9 row 21a exactly:
 * two sessions carried a repair for a viaduct-deck defect that was not there,
 * because the diagnosis was written from source rather than measured.
 *
 * NO GPU, AND THAT IS WHY THIS IS REACHABLE NOW. `traffic.js` needs `lights`
 * and `time`, both of which `headlesscity.mjs` already stubs, and its integration
 * is arithmetic — positions, speeds, a signal phase. It builds THREE materials
 * and InstancedMeshes, which construct fine with no GL context because nothing
 * here renders them. `queueprobe.mjs` answers a neighbouring question through a
 * browser and cannot run on a machine with no display hardware; this one can.
 *
 * WHAT IS SUBSTITUTED, listed rather than left to be found: `lights` (slot
 * bookkeeping — the stub records the calls), `time` (the clock traffic reads for
 * its signal phase), and the camera, which is driven along a straight line at a
 * fixed speed because `traffic.js` seeds and recycles relative to the eye. No
 * placement, no integration and no signal logic is re-implemented.
 *
 * ---------------------------------------------------------------------------
 * SESSION 79 — AND IT NOW PRINTS THE POPULATION THE GATE CANNOT SEE.
 *
 * The operator, walking the running build: *"cars stop in the middle of the
 * road, and I think it goes red for them AFTER they have passed, so they stop
 * at the next line, which is the far side of the junction."*
 *
 * This probe's session-34 arm answers the first half and refutes the second:
 * `worstStopLineM` is exactly 0, every held vehicle stands with its nose ON its
 * bar, and there is no far-side line for any expression in `traffic.js` to
 * return. But it answered that question about the WRONG POPULATION.
 * `worstStopLineM` is written only inside `if (veh.cleared !== nextJ)`, and a
 * vehicle that entered the box on green KEEPS its permission all the way
 * through — deliberately, `traffic.js` says so — so **every vehicle that stops
 * in the middle of a junction is excluded from the statistic that exists to
 * find vehicles stopped in the wrong place.**
 *
 * So the second half of this print is the census: stopped bodies with metal
 * inside a junction box, split by permission and by whether the origin has
 * passed the centre; the deepest one, with THE LINE IT IS TESTING AGAINST AND
 * WHERE THAT LINE IS; and the junctions whose crossing road does not exist at
 * all, which the signal head refuses to stand at and the braking point has
 * never asked about.
 *
 * Usage:
 *   node tools/stoplineprobe.mjs                 12 signal cycles
 *   node tools/stoplineprobe.mjs --cycles=20
 */

import * as THREE from 'three';
import { makeStubCtx } from './lib/headlesscity.mjs';
import { createTraffic } from '../src/modules/traffic.js';

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);

/** `traffic.js` → `CYCLE_S = 2·(GREEN_S + AMBER_S)` = 36 s, as `queueprobe` reads it. */
const CYCLE_S = 36;
const CYCLES = Number(args.get('cycles') || 12);
const DT = 1 / 60;
const FRAMES = Math.round((CYCLES * CYCLE_S) / DT);

console.log('stoplineprobe — which vehicle sets worstStopLineM, and why. NOT A GATE.');
console.log(`node ${process.version}  ·  ${process.platform}/${process.arch}`);
console.log('no renderer, no browser, no pixel: traffic integration is CPU arithmetic.\n');

const ctx = makeStubCtx({ seed: 1337 });
/**
 * A moving eye. `traffic.js` seeds vehicles around the camera and recycles them
 * out of the far end of the simulated radius, so a STATIONARY camera measures a
 * world in which nothing is ever recycled — which is precisely the mechanism
 * under test. 6.0 m/s is `night_rain`'s own route speed.
 */
const EYE_SPEED = 6.0;
const time = ctx.get('time');

const traffic = createTraffic();
const api = traffic.init(ctx) || traffic.api || {};
ctx.$set('traffic', api);

let worst = Infinity;
let worstAt = 0;
const witnesses = [];
let held = 0;
let framesWithHold = 0;
let recycles = 0;

/** Session 79's census, accumulated over the run. See the header. */
let inBoxFrames = 0;
let inBoxPermitted = 0;
let inBoxPastCentre = 0;
let phantomSamples = 0;
let deepest = null;
/** Episodes: a run of consecutive frames with somebody in a box. */
let episodes = 0;
let episodeRun = 0;
let longestEpisode = 0;

for (let f = 0; f < FRAMES; f++) {
  time.now = f * DT;
  time.frame = f;
  ctx.camera.position.z = -EYE_SPEED * f * DT;
  traffic.update(ctx, DT);
  const s = api.stats();
  recycles += s.recycledThisFrame || 0;
  if (s.holdingAtRed > 0) { framesWithHold++; held = Math.max(held, s.holdingAtRed); }
  if (s.worstStopLineM < worst) { worst = s.worstStopLineM; worstAt = f; }
  /**
   * EVERY FRAME'S WORST, NOT EVERY RECORD. The run-cumulative figure only moves
   * a handful of times and all of them in the first seconds, when every vehicle
   * has just been seeded — the first version of this probe collected exactly
   * those and would have reported the simulation's own startup as a property of
   * the traffic.
   */
  if (s.frameWorstStopLineWitness) {
    witnesses.push({ frame: f, tSim: +(f * DT).toFixed(2), ...s.frameWorstStopLineWitness });
  }
  inBoxFrames += s.inBoxStopped;
  inBoxPermitted += s.inBoxStoppedPermitted;
  inBoxPastCentre += s.inBoxStoppedPastCentre;
  phantomSamples += s.heldAtPhantomJunction;
  if (s.inBoxStopped > 0) {
    episodeRun++;
    if (episodeRun === 1) episodes++;
    if (episodeRun > longestEpisode) longestEpisode = episodeRun;
  } else {
    episodeRun = 0;
  }
  if (s.inBoxWitness && (!deepest || s.inBoxWitness.noseIntoBoxM > deepest.noseIntoBoxM)) {
    deepest = { frame: f, tSim: +(f * DT).toFixed(2), ...s.inBoxWitness };
  }
}

const s = api.stats();
console.log(`${FRAMES} frames = ${(FRAMES * DT).toFixed(0)} simulated seconds = ${CYCLES} signal cycles at ${CYCLE_S} s`);
console.log(`${s.vehicles} vehicles, ${recycles} recycles over the run, ${framesWithHold} frames with someone held at a red (worst ${held} at once)`);
/**
 * PRINTED RAW AS WELL AS ROUNDED — SESSION 34.
 *
 * The gate's test is `worstStopLineM < 0` and three decimals cannot tell
 * `-0.0000` from `-0.0004`: one passes and one fails, and both print as
 * `-0.000 m against a floor of 0`. That is CONTRACT §9's shape with a
 * FORMATTER — a number displayed at a precision that cannot resolve the
 * comparison being made of it. The raw value decides the gate, so the raw
 * value is what this line has to show.
 */
console.log(`\nworstStopLineM = ${worst === Infinity ? 'Infinity — NOBODY WAS EVER HELD (unrun, not a pass)' : `${worst.toFixed(3)} m   raw ${worst}   ${worst < 0 ? 'RED' : 'GREEN'}`}` +
  `   against the floor of 0 in budget.json → trafficLights.minStopLineM`);

/**
 * SESSION 79: GUARDED RATHER THAN AN EARLY `exit(0)`. The census below is a
 * DIFFERENT POPULATION and has to print whether or not a vehicle without
 * permission was ever held — an early exit here is how the second half of this
 * probe would silently not run on the day it mattered, which is the shape of
 * every gate this project has had to repair for going quiet.
 */
if (!witnesses.length) {
  console.log('\nNo witness recorded — either nothing was held, or the witness field is not being written.');
} else {

const q = (list, f) => {
  const a = [...list].sort((x, y) => x - y);
  return a.length ? a[Math.min(a.length - 1, Math.max(0, Math.round(f * (a.length - 1))))] : NaN;
};

console.log(`\n== THE PER-FRAME WORST HELD VEHICLE, OVER ${witnesses.length} FRAMES THAT HAD ONE ==`);
console.log('  toStop = metres from the held vehicle\'s FRONT to its own stop line; negative is the defect.');
console.log('  past   = metres its ORIGIN is beyond the junction CENTRE; POSITIVE means it is inside the box.\n');
{
  const t = witnesses.map((w) => w.toStopM);
  console.log(`  toStop        min ${q(t, 0).toFixed(3)}  p05 ${q(t, 0.05).toFixed(3)}  median ${q(t, 0.5).toFixed(3)}  p95 ${q(t, 0.95).toFixed(3)}  max ${q(t, 1).toFixed(3)} m`);
  const p = witnesses.map((w) => w.pastJunctionM);
  console.log(`  past junction min ${q(p, 0).toFixed(3)}  median ${q(p, 0.5).toFixed(3)}  max ${q(p, 1).toFixed(3)} m`);
}

/**
 * THE TWO WORLDS, SEPARATED. A vehicle whose ORIGIN is past the junction centre
 * is standing IN the box — spillback. One short of the centre but past its own
 * stop line has overshot the LINE. And one re-seated within the last two seconds
 * is a teleport whose distance describes the recycler.
 */
const negative = witnesses.filter((w) => w.toStopM < 0);
const fresh = negative.filter((w) => w.framesSinceRecycle !== null && w.framesSinceRecycle < 120);
const inBox = negative.filter((w) => w.pastJunctionM > 0);
const settled = negative.filter((w) => !(w.framesSinceRecycle !== null && w.framesSinceRecycle < 120));

console.log('\n== THE VERDICT ON THE MECHANISM ==');
console.log(`  frames whose worst held vehicle is PAST its line at all:      ${negative.length} of ${witnesses.length}`);
console.log(`    of those, re-seated within the last 2 s (120 frames):       ${fresh.length}  ← a teleport, not a red run`);
console.log(`    of those, settled (not recently re-seated):                 ${settled.length}`);
console.log(`    of those, ORIGIN inside the junction box (spillback):       ${inBox.length}`);
if (settled.length) {
  const st = settled.map((w) => w.toStopM);
  const stBox = settled.filter((w) => w.pastJunctionM > 0);
  console.log(`\n  THE SETTLED POPULATION — the one an exit reservation would address:`);
  console.log(`    worst ${q(st, 0).toFixed(3)} m, median ${q(st, 0.5).toFixed(3)} m, ${stBox.length} of ${settled.length} standing inside the box`);
  const byType = {};
  for (const w of settled) byType[w.type] = (byType[w.type] || 0) + 1;
  console.log(`    by body type: ${Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
} else {
  console.log('\n  NO SETTLED VEHICLE IS EVER PAST ITS OWN STOP LINE.');
  console.log('  Every frame whose worst held vehicle is past the line has a RECENTLY RE-SEATED vehicle in it,');
  console.log('  so `worstStopLineM` is measuring the RECYCLER and not a vehicle that ran a red. An exit');
  console.log('  reservation would not move this number, and building one would be a repair for a defect');
  console.log('  that is not there — CONTRACT §9 row 21a, with a junction instead of a viaduct deck.');
}
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SESSION 79 — THE POPULATION THE STATISTIC ABOVE EXCLUDES BY CONSTRUCTION.
 * ═══════════════════════════════════════════════════════════════════════════
 */
console.log(`\n== STOPPED WITH METAL INSIDE A ${(2 * 7.5).toFixed(1)} m JUNCTION BOX, OVER ${FRAMES} FRAMES ==`);
console.log('  `worstStopLineM` above is written ONLY for a vehicle WITHOUT permission (traffic.js).');
console.log('  A vehicle that entered on green KEEPS permission through the box, on purpose, so every');
console.log('  one of these is invisible to it. This is the operator\'s "cars stop in the middle of the road".\n');
console.log(`  vehicle-frames stopped with body in a box            ${inBoxFrames}`);
console.log(`    of those, HOLDING PERMISSION (invisible above)     ${inBoxPermitted}`);
console.log(`    of those, ORIGIN past the junction centre          ${inBoxPastCentre}`);
console.log(`  episodes (runs of consecutive frames)                ${episodes}` +
  `${episodes ? `, longest ${longestEpisode} frames = ${(longestEpisode * DT).toFixed(2)} s` : ''}`);

if (deepest) {
  console.log('\n  THE DEEPEST ONE, AND THE LINE IT WAS TESTING AGAINST — item 4c:');
  console.log(`    a ${deepest.type} (${deepest.lenM.toFixed(2)} m) at t = ${deepest.tSim} s, axis ${deepest.axis}, line ${deepest.lineM} m`);
  console.log(`    junction centre at    ${deepest.junctionAtM.toFixed(2)} m along its own axis`);
  console.log(`    the bar it is testing ${deepest.barAtM.toFixed(2)} m  ` +
    `= junction ${deepest.barAtM < deepest.junctionAtM ? '−' : '+'} ${Math.abs(deepest.junctionAtM - deepest.barAtM).toFixed(2)} m ` +
    `— the NEAR side, which is where it should be`);
  console.log(`    its nose is           ${deepest.noseIntoBoxM.toFixed(3)} m PAST the junction centre`);
  console.log(`    its origin is         ${deepest.pastJunctionM.toFixed(3)} m past the centre`);
  console.log(`    toStop                ${deepest.toStopM.toFixed(3)} m, permitted ${deepest.permitted}, phase ${deepest.phase}`);
  console.log('    THE BAR IS ON THE NEAR SIDE AND IT IS 9.00 m FROM THE CENTRE. There is no far-side');
  console.log('    line: `nextJunctionAhead` returns lattice nodes AHEAD and `− STOP_LINE` subtracts back');
  console.log('    toward the vehicle, so `jx + 9.00` belongs to the opposing approach and is unreachable.');
  console.log('    The operator\'s predicate is right and his point is wrong — CONTRACT §9\'s oldest class.');
} else {
  console.log('\n  NOBODY EVER STOPPED INSIDE A BOX IN THIS RUN.');
}

const phantom = api.stats().phantomJunctions || [];
console.log('\n== HELD AT A BAR FOR A JUNCTION WITH NO CROSSING ROAD ==');
console.log('  The signal HEAD asks `landmarkOccupies` (s35) and `cityExtentAt` (s75) before it stands;');
console.log('  the PAINT asks `onRoad` before it draws a bar. The BRAKING POINT asks nothing at all.\n');
console.log(`  vehicle-samples held at a phantom junction           ${phantomSamples}`);
console.log(`  distinct junctions                                  ${phantom.length}`);
for (const j of phantom.slice(0, 8)) {
  console.log(`    (${j.x}, ${j.z})  crossing road taken by ${j.why}  ${j.samples} samples`);
}
if (!phantom.length) {
  console.log('    none on this route — which is a statement about the route, not about the lattice.');
}

/**
 * AND THE ONE THING THAT WAS REPAIRED RATHER THAN COUNTED — session 79.
 * `seed()` nulls `veh.cleared` on a re-seat with a paragraph saying why; the
 * TURN EXIT re-seats a vehicle onto a different road in the same way and did
 * not. Counted before it was fixed, so the fix's own reach is on the record.
 */
const st = api.stats();
console.log('\n== STALE PERMISSION CARRIED THROUGH A TURN ==');
console.log(`  turn exits over the run                             ${st.turnExits}`);
console.log(`  at which the carried `+'`cleared`'+` equalled the junction ahead   ${st.staleTurnPermission}`);
console.log('  `cleared` is a bare world coordinate and the exit lands at');
console.log('  `entryLine·128 + exitDir·13.25`, so the two coincide whenever');
console.log('  `jLine === entryLine + exitDir` — a junction index one step from a line index.');
console.log(`  ${st.staleTurnPermission === 0
  ? 'LATENT ON THIS ROUTE, NOT DELIVERED: the camera walks one axis, so the two indices'
    + '\n  stay far apart. It is nulled at the exit now, which changes nothing measurable here'
    + '\n  and closes a coincidence `seed()` has had a paragraph about since session 18.'
  : 'DELIVERED — and each one was permission to run a red, granted by arithmetic.'}`);
