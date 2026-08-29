/**
 * moving.js — the two things in this city that move and are not vehicles.
 * Session 21, items 2 and 4.
 *
 * WHY THEY SHARE A MODULE, BECAUSE IT LOOKS LIKE A BAG AND IS NOT ONE.
 *
 * A tower crane's jib and a train on the viaduct have nothing to do with each
 * other as content and everything in common as ENGINEERING: both are rigid
 * boxes on a scripted path, both move ABOVE eye level, both need §5.12's
 * per-instance previous transform, and both are small. Split across two
 * modules they would cost four draw calls and two instance-motion buffers
 * against a ceiling `highway_speed` currently sits 9 under; together they cost
 * two and one. Session 4's own argument for merging the chunk's four box meshes
 * into one, at a different scale.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT MOVES ABOVE THE STREET, AND WHY IT MATTERS MORE THAN ITS COST.
 *
 * Nothing in this city moved above eye level except the aircraft, and an
 * aircraft is far away and small. Two things here are near and large:
 *
 *   THE TRAIN. The viaduct has carried two tracks, ballast, rails and catenary
 *   since session 19 and has never carried a train, which makes 480 m of
 *   elevated railway a decoration. A train is also the answer to the brief's
 *   "its deck either carrying traffic or explicitly left whole": the deck is a
 *   RAILWAY deck — `city.js` lays 1.435 m gauge track on it — so putting road
 *   vehicles on it would be a category error, and what belongs there is a
 *   train. It sweeps light across the facades from underneath, which is the
 *   thing the brief actually wanted and which a road vehicle would have done
 *   with headlights and a train does with lit windows.
 *
 *   THE CRANE'S JIB. A tower crane is tall, thin and off-balance — the
 *   opposite of the blocks' prisms — and the part that reads at distance is not
 *   the mast but the SLEW: a jib turning at 1.5°/s is slow, repeating and
 *   legible from a kilometre, which is the opposite of traffic and is why it
 *   reads from further away.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * §5.12, AND WHAT IT SUPPRESSES HERE.
 *
 * Every row is instanced and every row moves independently, so this is exactly
 * the case CONTRACT §5.12 exists for. The size threshold does real work: a
 * hook block is 1.1 m and a jib section is 1.6 m, whose cutoffs at the gate's
 * own pixel angle are 425 m and 618 m — so a crane across the city carries its
 * jib's vectors and drops its hook's, which is the threshold behaving as a
 * bound rather than as an optimisation.
 *
 * ONE CLOCK. `time.now`, like traffic, weather, streetlife, aircraft and the
 * player, so `?paused=1` freezes the jib and the train exactly as it freezes
 * everything else. A crane integrating wall-clock dt would arrive at a given
 * capture in a different state on every run.
 */

import * as THREE from 'three';
import { LIGHT, CLUSTER } from '../core/constants.js';
import { createInstanceMotion, pixelAngle, motionCutoffDistance } from '../core/instmotion.js';
import { RENDER } from '../core/constants.js';

/**
 * Lines of the internal buffer. `RENDER.pixels` is a PIXEL COUNT and not a
 * resolution — `aircraft.js` derives the same number the same way, and using
 * the count where the height was meant is CONTRACT §9's table in one
 * expression.
 */
const INTERNAL_LINES = Math.round(Math.sqrt(RENDER.pixels / (16 / 9)));
import {
  LANDMARKS, viaductArc, viaductSoffitY, SITE, viaductStations,
  VIADUCT_RAIL_RISE_M, VIADUCT_LOADING_GAUGE_M,
} from '../lib/citygen.js';

/**
 * The train, as numbers.
 *
 * SPEED. 12 m/s is 43 km/h, which is a metro's running speed between closely
 * spaced stops and is also `traffic.js`'s own free-flow figure — so a train on
 * the deck and a car under it move at the same rate, which is what makes the
 * deck read as part of the same city rather than as a separate system.
 *
 * CARS AND LENGTH. Four cars at 18.0 m is a 72 m train, which at the deck's
 * 480 m of arc is 15% of it — long enough to read as a train from the side and
 * short enough that two of them are never both wholly in one frame, which is
 * what makes the deck feel used rather than busy.
 */
const TRAIN = {
  trains: 2,
  cars: 4,
  carLengthM: 18.0,
  carWidthM: 2.9,
  carHeightM: 3.4,
  gapM: 0.9,
  speedMps: 12.0,
  /**
   * Lit windows a side, per car. A metro car has about nine bays a side; six
   * is the count at which the emissive band still reads as separate windows at
   * 100 m rather than as a stripe, measured against the same 3 px floor
   * session 20 derived for a navigation lamp: at 100 m a 1.4 m window is 12 px
   * and a 0.4 m gap is 3.4 px, so the gap survives.
   */
  windowsPerSide: 6,
  windowWidthM: 1.4,
  windowHeightM: 0.95,

  /**
   * THE RAKED NOSE — SESSION 23, item 3. The operator: *"it would not have hurt
   * if the train had somewhat softer forms"*; it read as a run of rectangular
   * boxes.
   *
   * OF THE THREE CHANGES THE BRIEF ASKED FOR, ONE WAS ALREADY BUILT AND IS
   * MEASURED RATHER THAN ADDED AGAIN. The roof cap — *"narrower than the body,
   * inset a little on each side"* — is the second box of every car and has been
   * since session 21: `carLengthM * 0.96` long, 0.18 m deep, `carWidthM * 0.9`
   * wide, i.e. **inset 0.145 m each side and 0.36 m short at each end**. So the
   * hard upper edge is already broken and adding a second cap would be a box per
   * car for nothing. `tools/trainprobe.mjs` prints the section so the claim is
   * checkable rather than asserted.
   *
   * WHAT IS ACTUALLY MISSING IS THE NOSE, and it is the one of the three that
   * reads at distance, because at distance what reads is the silhouette against
   * the sky. Every number below is bounded by something rather than chosen:
   *
   *   overhang 1.6 m   How far the tip projects past the body's end face. It is
   *                    the DEVIATION FROM A SQUARE CORNER, so it is what has to
   *                    clear the pixel floor: against the 3 px floor session 20
   *                    derived for a navigation lamp, at the gate's own
   *                    6.4765e-4 rad/px, 1.6 m subtends 3 px at **823 m** — past
   *                    anything in this city and past the car's own §5.12
   *                    cutoff. The rake reads wherever the train does.
   *   tip rise 1.1 m   Above rail level. The window band is centred at
   *                    `carHeightM * 0.62` = 2.108 m with half-height 0.475, so
   *                    its underside is 1.633 m: the tip sits **0.53 m below the
   *                    glazing**, which is what puts the driver's screen ON the
   *                    rake instead of above it. It is also clear of the skirt,
   *                    whose top is 0.56 m.
   *   thickness 1.0 m  Back along the raked face's own normal. It puts the
   *                    wedge's top-rear corner 0.82 m INSIDE the body's end
   *                    face, so the nose is anchored in the car rather than
   *                    butted against it — a thin slab would read as a fin from
   *                    three-quarter view and as a nose only from the side.
   *
   * Derived from those three: rise `carHeightM - tipRise` = 2.30 m, face length
   * `hypot(1.6, 2.30)` = 2.801 m, rake **55.17 deg from horizontal / 34.83 from
   * vertical**.
   */
  noseOverhangM: 1.6,
  noseTipRiseM: 1.1,
  noseThickM: 1.0,

  /**
   * THE SHOULDER CHAMFER — SESSION 27. The operator saw the raked nose and asked
   * for this one by name.
   *
   * The nose softens the train END ON. It does nothing to the LONG upper edge,
   * which is what the whole 72 m of the train shows you from the side and from
   * the street below, and that edge was a 90° corner running unbroken for
   * 17.28 m at a time.
   *
   * THE CHAMFER HAS NO SIZE OF ITS OWN ACROSS THE CAR. Its horizontal run is
   * `CAP_INSET`, the 0.145 m the roof cap has been inset each side since session
   * 21, because the face's upper edge has to land exactly on the cap's own lower
   * corner or the two are not continuous. So the across-run is read from the cap
   * rather than authored, and changing the cap's inset moves the chamfer with
   * it. What IS free is how far the face rises over that run, and that is this
   * constant.
   *
   * RISE 2× THE RUN, AND IT IS THE PIXEL FLOOR THAT SETS IT. A 45° face (rise =
   * run = 0.145 m) was built first and rejected on arithmetic: against the 3 px
   * floor session 20 derived for a navigation lamp, at the gate's own 6.4765e-4
   * rad/px, a 0.145 m facet resolves at **75 m** — and the gate camera stands
   * **174 m** from the crossing, so the operator would have seen exactly
   * nothing. At rise = 2·run the facet is 0.290 m tall and resolves at
   * **149 m**, which reaches the near half of the deck and most of the street.
   * It is also the right shape: real rolling stock has a tall shallow shoulder,
   * not a 45° cut, because the loading gauge is tight at the top corner and
   * generous at the waist.
   *
   * Derived from those two: face length `hypot(0.145, 0.290)` = **0.3242 m**,
   * **63.43° from horizontal**, and the visible band runs from the body's top at
   * `carHeightM − 2·CAP_INSET` = 3.110 m to `carHeightM` = 3.400 m.
   *
   * THICKNESS 0.10 m. The slab lies ON the chamfer plane, pushed back along that
   * plane's own inward normal by half its thickness — the nose's construction,
   * one axis over — so the visible FACE lands where it was designed to and the
   * mass sits behind it.
   *
   * IT DOES NOT MOVE THE TURN-ROUND CLAMP, and that is checked rather than
   * assumed. §9's row 23 is this module's own defect: the train's BODY LENGTH
   * used where its EXTENT was meant, once a nose existed to separate them. A
   * chamfer is `carLengthM * 0.96` long and inset within the body on both
   * transverse axes, so it reaches past nothing. `trainLen` is unchanged at
   * 77.90 m and the nose tip still stops at s = 240.00, the deck's last station.
   * The cap's TOP is unchanged at 3.58 m, so the 4.2 m structure gauge
   * `trainprobe` prints is untouched too.
   */
  shoulderChamferRise: 2,
  shoulderChamferThickM: 0.1,

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * ARRIVE, DWELL, DEPART — SESSION 54, AND IT REPLACES A ONE-FRAME REVERSAL
   * THAT ALSO CHANGED TRACK.
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * The operator: *"THE TRAIN JUMPS. It stops at the end of its run and
   * reappears on the other track."* Both halves are the code and neither was a
   * frame artefact:
   *
   *   `if (tr.s > halfArc - tr.len/2) { tr.s = ...; tr.dir = -1; }` — the
   *   train ran at a constant 12 m/s until the clamp fired and was travelling
   *   12 m/s the other way on the next frame. No deceleration, no stop, no
   *   start.
   *
   *   `const lat = tr.dir * viaduct.deck * 0.235` — THE TRACK WAS A FUNCTION
   *   OF THE DIRECTION, so flipping `dir` moved the whole 78 m train sideways
   *   by `2 x 0.235 x deck` in that same frame. That is the *"reappears on the
   *   other track"* half, exactly, and it is CONTRACT §9.1's shape: one field
   *   standing in for two independent facts. A train's track is a fact about
   *   the train; its direction is a fact about the journey.
   *
   * IT IS THE SAME RECYCLER PATTERN SESSION 25 FOUND IN `traffic.seed()` ON A
   * LARGER BODY — a placement routine putting a body somewhere it could only
   * have reached by teleporting — and `carry()` was hiding it from §5.12's
   * motion field, which is why no gate ever saw it.
   *
   * EVERY NUMBER BELOW IS A METRO'S OWN.
   *
   *   `brakeMps2` 1.0    service braking. EN 13452-1 puts emergency braking at
   *                      1.2 m/s2 and service braking below it; 1.0 from
   *                      `speedMps` 12.0 is a 72.0 m stopping distance, which
   *                      is 15% of the 480 m deck and 0.36x the 201 m from the
   *                      station to either end. It fits, with room.
   *   `accelMps2` 1.0    symmetric, which is what a metro's traction and its
   *                      service brake actually are within a few percent.
   *   `dwellS` 22        a through station's dwell: doors open, alight, board,
   *                      doors close. Metro dwells run 20-30 s.
   *   `turnroundS` 40    a TERMINUS is longer because the driver changes ends,
   *                      and it is what makes the deck read as a line with two
   *                      ends rather than a loop.
   *
   * AND THE ROUND TRIP IS 239 s, OF WHICH THE TRAIN IS STANDING FOR HALF —
   * arithmetic, because a dwell nobody adds up is a dwell that turns out to be
   * the whole timetable. A 201.05 m leg is 12 s of acceleration over 72 m, 4.75 s
   * of cruise over 57 m and 12 s of braking over 72 m = 28.75 s; four legs is
   * 115 s; two station dwells is 44 s; two turnrounds is 80 s. **239 s, 52% of
   * it stationary.**
   *
   * THAT IS NOT A NUMBER TO TUNE AWAY, IT IS THE DECK BEING 480 m LONG. A
   * shuttle whose whole line is forty seconds of running each way stands for
   * about half its cycle whatever the dwells are, and the two trains start half
   * an arc apart on opposite tracks, so what the deck shows is one train moving
   * while the other stands — which is a service. What it must not show is a
   * train at 12 m/s that becomes a train at 12 m/s the other way, on the other
   * track, in one frame, which is what it showed for twenty-three sessions.
   */
  brakeMps2: 1.0,
  accelMps2: 1.0,
  dwellS: 22,
  turnroundS: 40,
};

/**
 * Boxes per train car: body, roof cap, skirt, two bogies, the nose, and — since
 * session 27 — the two shoulder chamfers. 6 → 8.
 *
 * COST, MEASURED BEFORE IT WAS BUILT, because the brief asked for it costed
 * first: 2 trains × 4 cars × 2 = **16 new instances** and **192 triangles**, in
 * the mesh that already exists. **No new draw call** — the chamfers ride in
 * `bodyMesh` like every other row here, which is the whole reason this module
 * allocates per car rather than per part. The buffers that scale with
 * `bodyCount` grow by 16 rows: `instmotion`'s double buffer 1 024 B,
 * `instanceColor` 192 B, `noctisRough` 64 B — **1.25 KiB**. Unlike the nose,
 * BOTH rows are drawn on every car rather than parked at zero scale on the
 * middle ones, because a shoulder runs the length of the unit and a cab does
 * not.
 *
 * THE NOSE ROW IS ALLOCATED ON EVERY CAR AND DRAWN ON TWO. A unit has a cab at
 * each end and nowhere else, so cars 0 and `cars-1` carry one and the middle
 * cars park theirs at zero scale — the same thing this module already does with
 * every row no crane used this frame. A per-car row count that varied by
 * position would make `bodyCount` depend on the car index, and the census label
 * `citycheck` asserts against is a single number.
 */
const BOXES_PER_CAR = 8;
/** Emissive rows per car: `windowsPerSide` a side, plus one headlamp. */
const LIGHTS_PER_CAR = TRAIN.windowsPerSide * 2 + 1;

/**
 * Boxes in one crane's MOVING assembly: the slewing ring, the cab, six jib
 * sections, the counter-jib, the counterweight, the trolley, the hoist rope and
 * the load. The mast and its ties are static and ride in the chunk's own box
 * mesh (`city.js` → the `crane` feature), because a chunk mesh is rebuilt on a
 * residency change and a jib has to turn every frame.
 */
const BOXES_PER_CRANE = 12;
/** The crane's own obstruction light, at the jib head. */
const LIGHTS_PER_CRANE = 1;

/**
 * How many cranes may be animated at once.
 *
 * `SITE.floodPerSite` sites are scattered by the density field and the
 * resident ring holds up to 121 chunks, so the count is unbounded by
 * construction — which is the same class of mistake as an unbounded particle
 * layer (CONTRACT §8.1). 4 is the number of construction chunks the budget's
 * own 10x10 region delivers at seed 1337 (3) plus one, so the cap is a bound
 * on a measured population rather than a budget somebody chose.
 */
const MAX_CRANES = 4;

export function createMoving() {
  let group = null;
  let bodyMesh = null;
  let lightMesh = null;
  let bodyGeo = null;
  let lightGeo = null;
  let bodyMat = null;
  let lightMat = null;
  let bodyMotion = null;
  let lightMotion = null;
  let primed = false;
  let frameId = 0;
  let lastNow;

  const trains = [];
  /**
   * The arc coordinates a train stops at: both termini and every station.
   * Filled at init from `viaductStations`, which is the same list `city.js`
   * builds the platform from.
   */
  let stopsAt = [];
  const stats = {
    trains: 0,
    cranes: 0,
    bodyRows: 0,
    lightRows: 0,
    /** §5.12 rows suppressed this frame because they project under 4 px. */
    suppressed: 0,
    jibCutoffM: 0,
    hookCutoffM: 0,
    carCutoffM: 0,
  };

  const m4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const eul = new THREE.Euler();
  const col = new THREE.Color();

  let arc = null;
  let viaduct = null;
  let deckY = 0;

  /** Where on the arc a train is, as a station interpolated on the circle. */
  function arcAt(s) {
    const [cx, cz] = arc.centre;
    const a = arc.a0 + (arc.curveSign * s) / arc.radius;
    return {
      x: cx + Math.cos(a) * arc.radius,
      z: cz + Math.sin(a) * arc.radius,
      yaw: -Math.atan2(Math.cos(a) * arc.curveSign, -Math.sin(a) * arc.curveSign),
    };
  }

  /**
   * ONE ROW, WRITTEN STRAIGHT INTO THE MOTION BUFFER.
   *
   * `instmotion.begin()` hands back the array the mesh's `instanceMatrix` is
   * about to be bound to, so writing the matrix here IS setting the instance —
   * there is no second copy to keep in step. `carry(row)` forces this row's
   * previous transform equal to its current one, which is what a teleport and a
   * sub-threshold row both need (CONTRACT §5.12).
   */
  function setRow(arr, motion, row, x, y, z, yaw, sx, sy, sz, carry, rake = 0, roll = 0) {
    pos.set(x, y, z);
    /**
     * `rake` TILTS THE BOX ABOUT ITS OWN TRANSVERSE AXIS. A `BoxGeometry(1,1,1)`
     * scaled by `(length, height, width)` has its length on local X and its
     * width on local Z, so **Z is the axis that lifts the nose** — the whole of
     * the correctness is choosing that slot rather than the Euler order.
     *
     * THE ORDER IS WRITTEN OUT ANYWAY, AND THE FIRST VERSION OF THIS COMMENT WAS
     * WRONG ABOUT WHY. It claimed the default `'XYZ'` would put the rake in
     * world axes and rake the train differently at every point on the curve.
     * `tools/trainprobe.mjs` was written to demonstrate that and REFUTED IT:
     * the error under `'XYZ'` is 0.0000 m at every yaw, identical to `'YXZ'`.
     * The reason is one line of algebra that the comment asserted past — with
     * the X component zero, `'XYZ'` composes `Rx(0)·Ry·Rz` and `'YXZ'` composes
     * `Ry·Rx(0)·Rz`, and both are `Ry(yaw)·Rz(rake)`. An Euler order can only
     * matter when at least two components are non-zero.
     *
     * So `'YXZ'` is kept for what it will mean rather than for what it means
     * today: the moment anything sets the X slot — a gradient on the deck, a
     * cant through a curve — `Ry·Rx·Rz` is the order that keeps the rake in the
     * car's frame and the default stops being equivalent. The probe carries the
     * arm that would catch it, and it carries the refutation too, because
     * CONTRACT §7.7 says an expectation that moves to match the instrument must
     * say which of the two was wrong. Here it was the comment.
     */
    /**
     * `roll` TILTS THE BOX ABOUT ITS OWN LONGITUDINAL AXIS — the X slot, which
     * the comment above says was kept empty "for what it will mean rather than
     * for what it means today". Session 27 is that day: the shoulder chamfer
     * needs the box turned 45° about the car's length, and `rake` cannot supply
     * it because `rake` is the Z slot and turns about the TRANSVERSE axis.
     *
     * With two components now non-zero the Euler order stops being a formality
     * and starts being the claim, exactly as written: `'YXZ'` composes
     * `Ry(yaw)·Rx(roll)·Rz(rake)`, so the roll is applied in the CAR's frame
     * after the yaw rather than in world axes, and a chamfer stays on the
     * shoulder all the way round the curve. Under the default `'XYZ'` it would
     * be `Rx(roll)·Ry(yaw)·Rz(rake)` — the roll in WORLD axes — and the two
     * stop being equal the moment `roll` is non-zero. `tools/trainprobe.mjs`
     * carries the arm that measured them identical at roll 0 and it is the arm
     * that now separates them.
     */
    eul.set(roll, yaw, rake, 'YXZ');
    quat.setFromEuler(eul);
    scl.set(sx, sy, sz);
    m4.compose(pos, quat, scl);
    m4.toArray(arr, row * 16);
    if (carry) motion.carry(row);
  }

  return {
    name: 'moving',
    needs: ['time'],

    init(ctx) {
      viaduct = LANDMARKS.find((l) => l.kind === 'viaduct');
      if (!viaduct) return { stats: () => stats };
      arc = viaductArc(viaduct);
      /**
       * Rail level: the deck slab's top plus the ballast and rail rise
       * `city.js` builds. Both numbers come from `citygen` rather than being
       * retyped — a train floating over its own track or sunk into it is
       * CONTRACT §9's shape with two datums, and session 19 spent a whole item
       * on exactly that.
       */
      deckY = viaduct.height + VIADUCT_RAIL_RISE_M;

      group = new THREE.Group();
      group.name = 'moving';

      const lights = ctx.get('lights');
      bodyMat = new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.45, metalness: 0.15, envMapIntensity: 1,
      });
      lightMat = new THREE.MeshStandardMaterial({ color: 0x0a0b0d, roughness: 0.1, metalness: 0 });
      lightMat.emissive.setRGB(1, 1, 1, THREE.LinearSRGBColorSpace);
      /**
       * A LIT TRAIN WINDOW IS AN OFFICE WINDOW SEEN THROUGH GLASS, not a sign.
       * `LIGHT.windowNits` is what `city.js` puts behind every pane in the
       * streamed city and is the right order for a saloon interior; the crane's
       * obstruction light rides the same material at a gain in `instanceColor`,
       * exactly as a traffic signal's lit lens does — one material, two
       * radiances, one draw call. §9 rule 4, both numbers: 220 x 74.1 =
       * 16 300 cd/m², which is `LIGHT.aviationRedNits`, because a crane's head
       * light IS an obstruction light under the same ICAO Annex 14 §6.3 the
       * condenser's are derived from.
       *
       * THE NAME WAS `LIGHT.windowLitNits` FROM SESSION 21 TO SESSION 42 AND NO
       * SUCH CONSTANT HAS EVER EXISTED. `constants.js` has `windowNits` and has
       * had only that, so this line assigned `undefined`; three.js refreshes the
       * emissive uniform as `emissive.multiplyScalar(emissiveIntensity)`, which
       * made every fragment of `moving:lights` NaN, and `lights.js`'s
       * `min(rgb, HDR_CLAMP)` resolved it to **60 000 cd/m² on this GPU** — 273x
       * the 220 the comment above computes with. Measured session 42, in the
       * page: `emissiveIntensity` not finite, `emissive` (1,1,1). The two gains
       * below are stated against 220 and were therefore also wrong by the same
       * factor, which is why one name repairs three emitters at once. The class
       * — a constant reference that resolves to nothing — is now machine-checked
       * by `tools/parsecheck.mjs`, which found this was the only one in `src/`.
       */
      lightMat.emissiveIntensity = LIGHT.windowNits;
      if (lights) {
        lights.patch(bodyMat, { prevInstance: true });
        lights.patch(lightMat, { prevInstance: true });
      }

      const bodyCount = TRAIN.trains * TRAIN.cars * BOXES_PER_CAR + MAX_CRANES * BOXES_PER_CRANE;
      const lightCount = TRAIN.trains * TRAIN.cars * LIGHTS_PER_CAR + MAX_CRANES * LIGHTS_PER_CRANE;

      bodyGeo = new THREE.BoxGeometry(1, 1, 1);
      lightGeo = new THREE.BoxGeometry(1, 1, 1);
      bodyMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, bodyCount);
      lightMesh = new THREE.InstancedMesh(lightGeo, lightMat, lightCount);
      bodyMesh.name = 'moving:bodies';
      lightMesh.name = 'moving:lights';
      /**
       * THE CENSUS LABEL — `citycheck`'s scene walk requires every instanced
       * mesh to declare what its rows are and requires the declaration to sum
       * to `instanceMatrix.count` (CONTRACT §9.1). Two new meshes with no label
       * would take that gate red for the right reason.
       */
      bodyMesh.userData.noctisCensus = { movingBoxes: bodyCount };
      lightMesh.userData.noctisCensus = { movingLights: lightCount };
      for (const m of [bodyMesh, lightMesh]) {
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        m.frustumCulled = false;
        m.castShadow = false;
        m.receiveShadow = false;
      }
      bodyMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(bodyCount * 3), 3);
      lightMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(lightCount * 3), 3);
      bodyMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      lightMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      bodyGeo.setAttribute('noctisRough', new THREE.InstancedBufferAttribute(new Float32Array(bodyCount).fill(0.45), 1));
      lightGeo.setAttribute('noctisRough', new THREE.InstancedBufferAttribute(new Float32Array(lightCount).fill(0.1), 1));

      bodyMotion = createInstanceMotion(bodyCount, 'moving:bodies');
      lightMotion = createInstanceMotion(lightCount, 'moving:lights');

      /**
       * THE TRAIN'S LENGTH NOW INCLUDES ITS NOSES, AND THAT IS NOT BOOKKEEPING.
       *
       * `tr.len` is used for exactly one thing: the turn-round clamp,
       * `halfArc - len/2`, i.e. *"stop when the train reaches the end of the
       * deck"*. Before the nose existed, the body's end face WAS the train's
       * extent and the two were the same number. They are not any more, and
       * leaving this as the body length would be a quantity computed correctly
       * and then used as a different one (CONTRACT §9): the extent of the BODY
       * standing in for the extent of the TRAIN.
       *
       * It is load-bearing rather than pedantic, because the portal built this
       * session is 1.6 m from where the body used to stop. Arithmetic, both
       * ways: body length 74.70 m clamps the centre at 202.65, putting the
       * leading car's centre at 231.00 and its BODY face at s = 240.00 — the
       * deck's last station exactly — and its nose tip at **241.60, which is
       * 1.30 m inside the portal's recess**. With the noses counted, 77.90 m
       * clamps the centre at 201.05, the leading car's centre at 229.40, and the
       * NOSE TIP at s = 240.00. The train noses up to the portal and stops,
       * which is what it should have been doing all along and what the reader
       * now sees it do.
       */
      const trainLen = TRAIN.cars * TRAIN.carLengthM + (TRAIN.cars - 1) * TRAIN.gapM
        + 2 * TRAIN.noseOverhangM;
      /**
       * THE STOPS, IN ARC COORDINATES, AND THE STATION IS ONE OF THEM.
       *
       * `viaductStations` is the same function `city.js` builds the platform,
       * the stairs and the lift cores from — ONE description of where the
       * station is, read by the thing that draws it and by the thing that stops
       * at it (CONTRACT §9.1). Session 31 built a platform at 22.72 m and
       * nothing has ever stopped at it: the train ran past at 12 m/s for
       * twenty-three sessions.
       *
       * The two ends are where the clamp already put them — `halfArc - len/2`,
       * the nose tip against the portal, session 23's derivation unchanged.
       */
      const stationStops = viaductStations(arc, viaduct).map((st) => st.atS);
      const endStop = arc.arcLength / 2 - trainLen / 2;
      stopsAt = [-endStop, ...stationStops, endStop].sort((a, b) => a - b);

      for (let t = 0; t < TRAIN.trains; t++) {
        trains.push({
          /**
           * Two trains, one each way, started half the arc apart so the deck is
           * never empty at both ends and never full in the middle.
           */
          dir: t % 2 === 0 ? 1 : -1,
          /**
           * AND THE TRACK IS THE TRAIN'S, NOT THE JOURNEY'S — session 54. See
           * `TRAIN.turnroundS` for the defect this closes. A shuttle keeps to
           * its own track and reverses on it; the two trains are on opposite
           * tracks, so they still pass each other rather than running through
           * each other, which is what the `lat` expression was for.
           */
          track: t % 2 === 0 ? 1 : -1,
          /**
           * SEEDED INSIDE ITS OWN LINE. Half an arc apart is session 21's
           * spacing and it is kept, clamped to the terminus stops — the old
           * code seeded at `-arcLength/2` and let the CLAMP pull it in on the
           * first frame, which is a teleport on frame one and exactly the
           * class of thing this change is removing.
           */
          s: Math.max(-endStop, Math.min(endStop,
            -arc.arcLength / 2 + (t / TRAIN.trains) * arc.arcLength)),
          len: trainLen,
          /** Current speed, always non-negative; `dir` carries the sense. */
          v: TRAIN.speedMps,
          /** Seconds left standing, and whether this stand ends in a reversal. */
          hold: 0,
          reversing: false,
        });
      }
      stats.trains = TRAIN.trains;
      stats.bodyRows = bodyCount;
      stats.lightRows = lightCount;

      /**
       * §5.12's cutoffs, printed at init beside the distances they are compared
       * against, because a threshold that binds should say so in its own voice
       * (session 20's aircraft made the same line necessary).
       */
      const theta = pixelAngle(ctx.camera, INTERNAL_LINES);
      stats.carCutoffM = +motionCutoffDistance(TRAIN.carWidthM, 4, theta).toFixed(0);
      stats.jibCutoffM = +motionCutoffDistance(1.6, 4, theta).toFixed(0);
      stats.hookCutoffM = +motionCutoffDistance(1.1, 4, theta).toFixed(0);
      ctx.log(
        `moving: ${TRAIN.trains} trains x ${TRAIN.cars} cars on ${arc.arcLength} m of deck at ` +
        `${TRAIN.speedMps} m/s (lap ${(arc.arcLength / TRAIN.speedMps).toFixed(0)} s), rail level ` +
        `${deckY.toFixed(2)} m; up to ${MAX_CRANES} cranes slewing at ` +
        `${(360 / SITE.slewPeriodS).toFixed(2)} deg/s. §5.12 cutoffs: car ${stats.carCutoffM} m, ` +
        `jib ${stats.jibCutoffM} m, hook ${stats.hookCutoffM} m`
      );
      /**
       * THE CAR AGAINST THE PORTAL'S STRUCTURE GAUGE — CONTRACT §9 rule 4, both
       * numbers, at the point of USE rather than the point of derivation.
       *
       * `citygen.VIADUCT_LOADING_GAUGE_M` is what `viaductEnds` sizes the portal
       * opening from, and this is the vehicle it was sized for. They are in two
       * files and neither imports the other's intent, so a car grown past the
       * gauge would intersect a portal in silence — the arrangement `pierEvery:
       * 34` sat in beside `i % 3 === 0`. Printed, it says so at boot.
       */
      const carTopAboveRail = TRAIN.carHeightM + 0.09 + 0.18 / 2;
      ctx.log(
        `moving: car reaches ${carTopAboveRail.toFixed(2)} m above rail (body ${TRAIN.carHeightM} ` +
        `+ roof cap) against the viaduct's ${VIADUCT_LOADING_GAUGE_M} m structure gauge — ` +
        `${(VIADUCT_LOADING_GAUGE_M - carTopAboveRail).toFixed(2)} m clear` +
        `${carTopAboveRail > VIADUCT_LOADING_GAUGE_M ? '  ** OVER GAUGE **' : ''}. ` +
        `Nose: ${TRAIN.noseOverhangM} m overhang, tip ${TRAIN.noseTipRiseM} m, rake ` +
        `${((Math.atan2(TRAIN.carHeightM - TRAIN.noseTipRiseM, TRAIN.noseOverhangM) * 180) / Math.PI).toFixed(2)} deg ` +
        `from horizontal; train extent ${trainLen.toFixed(2)} m including both noses`
      );

      group.add(bodyMesh);
      group.add(lightMesh);
      ctx.scene.add(group);

      return {
        stats: () => stats,
        /** Where the trains are, for a probe. No verdict. */
        trainPositions: () => trains.map((t) => ({
          s: t.s, dir: t.dir, track: t.track, v: t.v, hold: t.hold,
        })),
      };
    },

    update(ctx, dt) {
      if (!bodyMesh) return;
      const time = ctx.get('time');
      const now = time ? time.now : 0;
      const step = time ? Math.min(0.1, Math.max(0, now - (lastNow === undefined ? now : lastNow))) : 0;
      lastNow = now;

      const cam = ctx.camera.position;
      const theta = pixelAngle(ctx.camera, INTERNAL_LINES);
      const bodyArr = bodyMotion.begin(frameId);
      const lightArr = lightMotion.begin(frameId);
      let bodyRow = 0;
      let lightRow = 0;
      let suppressed = 0;

      // --- the trains --------------------------------------------------------
      for (const tr of trains) {
        /**
         * ═══════════════════════════════════════════════════════════════════
         * ARRIVE, DWELL, DEPART — SESSION 54. See `TRAIN.brakeMps2` for the
         * defect this replaces and for where each number comes from.
         * ═══════════════════════════════════════════════════════════════════
         *
         * A SERVICE, NOT A CLAMP. The train runs at `speedMps` toward the next
         * stop ahead of it, brakes at `brakeMps2` from exactly the distance
         * that arithmetic requires, stands for its dwell, and accelerates away
         * at `accelMps2`. At a terminus the stand is longer and ends in a
         * reversal; at the station it does not.
         *
         * THE BRAKING POINT IS DERIVED, NOT TRIGGERED. `v²/(2a)` is the
         * distance a speed needs, so the test is *"is what is left less than
         * what I need"* — which brakes at the right place from any speed,
         * including one it is still accelerating through. A trigger at a fixed
         * distance would be a second description of the same physics and would
         * be wrong for every speed but one (CONTRACT §9.1).
         *
         * NOTHING IS RECYCLED ANY MORE AND THAT IS THE POINT. `carry()` exists
         * for a transform that changed by more than motion can explain; a train
         * that decelerates to a stand and accelerates away never has one, so
         * §5.12's motion field now carries the train's real velocity through
         * the whole manoeuvre instead of being told to ignore it.
         */
        let recycled = false;
        if (tr.hold > 0) {
          tr.hold -= step;
          tr.v = 0;
          if (tr.hold <= 0) {
            tr.hold = 0;
            if (tr.reversing) { tr.dir = -tr.dir; tr.reversing = false; }
          }
        } else {
          /** The next stop ahead, in this direction. */
          let target = null;
          for (const st of stopsAt) {
            const ahead = (st - tr.s) * tr.dir;
            if (ahead > 0.02 && (target === null || ahead < (target - tr.s) * tr.dir)) target = st;
          }
          if (target === null) {
            /**
             * Standing at the far end with nothing ahead: turn round now. It
             * is reachable only on the first frame of a boot that seeded a
             * train exactly on the end stop, and a state machine with an
             * unhandled case is how a train ends up stationary for ever.
             */
            tr.dir = -tr.dir;
          } else {
            const left = (target - tr.s) * tr.dir;
            const need = (tr.v * tr.v) / (2 * TRAIN.brakeMps2);
            if (left <= need) tr.v = Math.max(0, tr.v - TRAIN.brakeMps2 * step);
            else tr.v = Math.min(TRAIN.speedMps, tr.v + TRAIN.accelMps2 * step);
            tr.s += tr.dir * tr.v * step;
            const arrived = (target - tr.s) * tr.dir <= 0.05
              || (tr.v <= 0.02 && (target - tr.s) * tr.dir < 1.0);
            if (arrived) {
              tr.s = target;
              tr.v = 0;
              /** A terminus is a stop at either end of the line, and only there. */
              tr.reversing = Math.abs(Math.abs(target) - (arc.arcLength / 2 - tr.len / 2)) < 0.01;
              tr.hold = tr.reversing ? TRAIN.turnroundS : TRAIN.dwellS;
            }
          }
        }

        for (let c = 0; c < TRAIN.cars; c++) {
          const offset = (c - (TRAIN.cars - 1) / 2) * (TRAIN.carLengthM + TRAIN.gapM);
          const st = arcAt(tr.s + offset * tr.dir);
          /**
           * WHICH TRACK. `city.js` lays the two ballast troughs at
           * `±deck·0.235`; a train keeps to the track its direction belongs to,
           * so the two pass each other rather than running through each other.
           */
          const lat = tr.track * viaduct.deck * 0.235;
          const yaw = st.yaw;
          const nx = -Math.sin(yaw);
          const nz = -Math.cos(yaw);
          const x = st.x + nx * lat;
          const z = st.z + nz * lat;
          const d = Math.hypot(x - cam.x, z - cam.z, deckY - cam.y);
          const carry = recycled || motionCutoffDistance(TRAIN.carWidthM, 4, theta) < d;
          if (carry && !recycled) suppressed += BOXES_PER_CAR;

          /**
           * THE BODY, THE CAP AND THE CHAMFER ARE ONE DECOMPOSITION — session 27.
           *
           * A CHAMFER IS MATERIAL REMOVED FROM A CORNER, and an InstancedMesh of
           * boxes cannot remove anything. The first version of this laid a 45°
           * slab on the body's top corner and it was **entirely inside the body
           * box** — CONTRACT §9.1's "geometry authored and then drawn inside
           * something else", which is the vehicle skirt row verbatim, caught
           * here before it shipped rather than a session later. Laying it PROUD
           * instead is the other failure: a strip standing off the corner reads
           * as a fin, not a bevel.
           *
           * So the body's top comes DOWN by the cap's own inset and the cap
           * comes DOWN to meet it, and the chamfer is the face that bridges
           * them. Three rows that were two, and the shoulder is now:
           *
           *     body side          up to  y 3.110   half-width 1.450
           *     63.43° chamfer     3.110 → 3.400    1.450 → 1.305
           *     roof cap           3.110 → 3.580    half-width 1.305
           *
           * THE BODY COMES DOWN BY TWICE THE INSET, NOT ONCE, and the factor of
           * two is the whole difference between a chamfer and an invisible box.
           * At `carHeightM − CAP_INSET` the body still occupies the corner the
           * chamfer is supposed to be cutting, so the slab is inside it and
           * nothing changes on screen. At `carHeightM − 2·CAP_INSET` the band
           * from 3.110 to 3.255 is reached by the CHAMFER alone outboard of
           * 1.305 and by the cap inboard of it, which is the only arrangement
           * of boxes in which the face is actually seen.
           *
           * THE CHAMFER'S SIZE IS NOT A NEW NUMBER. It is `CAP_INSET`, the
           * 0.145 m the roof cap has been inset each side since session 21, so
           * the chamfer's upper edge lands exactly on the cap's own lower corner
           * and the two are continuous by construction rather than by tuning. A
           * 45° face across a 0.145 m step is `0.145·√2` = 0.2051 m wide, which
           * is `shoulderChamferM` and is why that constant is read rather than
           * authored. Change the cap's inset and the chamfer follows it.
           *
           * The cap is EXTENDED DOWNWARD rather than moved: its top stays at
           * 3.58 m, which is the number `trainprobe` prints against the
           * viaduct's 4.2 m structure gauge, so the clearance is untouched.
           */
          const CAP_INSET = (TRAIN.carWidthM - TRAIN.carWidthM * 0.9) / 2;
          const bodyTopM = TRAIN.carHeightM - 2 * CAP_INSET;
          const capTopM = TRAIN.carHeightM + 0.18;
          const y = deckY + bodyTopM / 2;
          setRow(bodyArr, bodyMotion, bodyRow++, x, y, z, yaw, TRAIN.carLengthM, bodyTopM, TRAIN.carWidthM, carry);
          setRow(bodyArr, bodyMotion, bodyRow++, x, deckY + (bodyTopM + capTopM) / 2, z, yaw,
            TRAIN.carLengthM * 0.96, capTopM - bodyTopM, TRAIN.carWidthM * 0.9, carry);
          setRow(bodyArr, bodyMotion, bodyRow++, x, deckY + 0.28, z, yaw,
            TRAIN.carLengthM * 0.98, 0.56, TRAIN.carWidthM * 0.86, carry);
          for (const b of [-1, 1]) {
            const bx = x + Math.cos(yaw) * b * TRAIN.carLengthM * 0.32;
            const bz = z - Math.sin(yaw) * b * TRAIN.carLengthM * 0.32;
            setRow(bodyArr, bodyMotion, bodyRow++, bx, deckY - 0.18, bz, yaw, 3.0, 0.5, TRAIN.carWidthM * 0.7, carry);
          }

          /**
           * THE SHOULDER CHAMFERS. Two per car, one each side, running the
           * length — the constants block above carries the derivation.
           *
           * THE CONSTRUCTION IS THE NOSE'S, ONE AXIS OVER, and it is written in
           * the car's own (across, up) frame and rotated into world XZ at the
           * end — one basis change, at the end, the same shape the nose uses.
           *
           * The square corner is at `(carWidthM/2, carHeightM/2)` from the body
           * centre. A 45° face of width `w` cuts it from `(W/2, H/2 − w/√2)` to
           * `(W/2 − w/√2, H/2)`, so its midpoint is `w/(2√2)` in from the corner
           * on both axes. The slab is then pushed back along that face's own
           * inward normal `(1,1)/√2` by half its thickness, so the visible FACE
           * lands on the chamfer plane and the mass sits behind it rather than
           * straddling the corner.
           *
           * `sh` is which side, in the car's local +Z. It signs the across
           * offset and the ROLL together: the face normal is `(+1,+1)/√2` on one
           * shoulder and `(−1,+1)/√2` on the other, and `Rx(θ)` takes the
           * slab's own thickness axis `(0,1,0)` to `(0, cos θ, sin θ)` — so
           * `θ = +45°` and `θ = −45°` are exactly those two normals. The sign
           * falls out of the geometry rather than being tried both ways.
           */
          const chamRun = CAP_INSET;
          const chamRise = CAP_INSET * TRAIN.shoulderChamferRise;
          const chamFaceLen = Math.hypot(chamRun, chamRise);
          /** Outward unit normal of the chamfer face, in (across, up). */
          const nAcross = chamRise / chamFaceLen;
          const nUp = chamRun / chamFaceLen;
          /**
           * The face's midpoint is `chamOff` in from the body's top corner on
           * both axes; the slab is then pushed back along the face's own inward
           * normal by `chamBack` so the FACE lands on the chamfer plane and the
           * mass sits behind it — the nose's construction, one axis over.
           */
          const half = TRAIN.shoulderChamferThickM / 2;
          const chamAcross = TRAIN.carWidthM / 2 - chamRun / 2 - nAcross * half;
          const chamUp = bodyTopM + chamRise / 2 - nUp * half;
          const chamRoll = Math.atan2(chamRise, chamRun);
          for (const sh of [-1, 1]) {
            const across = sh * chamAcross;
            setRow(
              bodyArr, bodyMotion, bodyRow++,
              x + Math.sin(yaw) * across, deckY + chamUp, z + Math.cos(yaw) * across, yaw,
              TRAIN.carLengthM * 0.96, TRAIN.shoulderChamferThickM, chamFaceLen,
              carry, 0, sh * chamRoll
            );
          }

          /**
           * THE NOSE. One raked slab at the outer end of each END car; the
           * middle cars park the row at zero scale.
           *
           * `face` is which end of the unit this car is, in the car's own local
           * +X: car 0 looks backward along the body axis and the last car looks
           * forward. It is NOT `tr.dir` — a unit has a cab at each end whichever
           * way it is running, and keying this off the direction of travel would
           * move the nose from one end to the other every time a train turned
           * round, which is the one thing a cab does not do.
           */
          const face = c === 0 ? -1 : c === TRAIN.cars - 1 ? +1 : 0;
          if (face === 0) {
            setRow(bodyArr, bodyMotion, bodyRow++, 0, -1000, 0, 0, 0, 0, 0, true);
          } else {
            const rise = TRAIN.carHeightM - TRAIN.noseTipRiseM;
            const faceLen = Math.hypot(TRAIN.noseOverhangM, rise);
            /**
             * The rake, measured from horizontal and signed by which end it is
             * on. `Rz` takes local +X to `(cos, sin)`, so the roof-to-tip
             * direction `(+overhang, -rise)` on the forward end is an angle of
             * `-atan2(rise, overhang)`, and the rear end is its mirror.
             */
            const rakeSign = -face;
            const rake = rakeSign * Math.atan2(rise, TRAIN.noseOverhangM);
            /**
             * The slab's centre: the midpoint of the raked face, pushed back
             * along that face's own inward normal by half the thickness, so the
             * FACE lands where it was designed to and the mass sits behind it.
             * Computed in the car's local (along, up) frame and then rotated
             * into world XZ by the car's yaw — one basis change, at the end.
             */
            const midAlong = face * (TRAIN.carLengthM / 2 + TRAIN.noseOverhangM / 2);
            const midUp = TRAIN.noseTipRiseM + rise / 2;
            /** Outward unit normal of the raked face, in (along, up). */
            const nAlong = (face * rise) / faceLen;
            const nUp = TRAIN.noseOverhangM / faceLen;
            const along = midAlong - nAlong * (TRAIN.noseThickM / 2);
            const up = midUp - nUp * (TRAIN.noseThickM / 2);
            const nx2 = x + Math.cos(yaw) * along;
            const nz2 = z - Math.sin(yaw) * along;
            setRow(bodyArr, bodyMotion, bodyRow++, nx2, deckY + up, nz2, yaw,
              faceLen, TRAIN.noseThickM, TRAIN.carWidthM * 0.94, carry, rake);
          }
          for (let i = 0; i < BOXES_PER_CAR; i++) {
            const r = bodyRow - BOXES_PER_CAR + i;
            /**
             * A METRO CAR IS PAINTED, and the paint is the one thing that says
             * it belongs to a system rather than being rolling stock somebody
             * left. One livery, two trains, so the pair reads as a service.
             */
            col.setRGB(0.30, 0.33, 0.36, THREE.LinearSRGBColorSpace);
            bodyMesh.setColorAt(r, col);
          }

          for (const side of [-1, 1]) {
            for (let w = 0; w < TRAIN.windowsPerSide; w++) {
              const along = ((w + 0.5) / TRAIN.windowsPerSide - 0.5) * TRAIN.carLengthM * 0.88;
              const wx = x + Math.cos(yaw) * along + nx * side * TRAIN.carWidthM * 0.51;
              const wz = z - Math.sin(yaw) * along + nz * side * TRAIN.carWidthM * 0.51;
              setRow(lightArr, lightMotion, lightRow++, wx, deckY + TRAIN.carHeightM * 0.62, wz, yaw,
                TRAIN.windowWidthM, TRAIN.windowHeightM, 0.06, carry);
              col.setRGB(1, 1, 1, THREE.LinearSRGBColorSpace);
              lightMesh.setColorAt(lightRow - 1, col);
            }
            /* one headlamp on the leading car only; the rest get a dark row */
          }
          const lead = tr.dir > 0 ? TRAIN.cars - 1 : 0;
          const hx = x + Math.cos(yaw) * tr.dir * TRAIN.carLengthM * 0.5;
          const hz = z - Math.sin(yaw) * tr.dir * TRAIN.carLengthM * 0.5;
          setRow(lightArr, lightMotion, lightRow++, hx, deckY + TRAIN.carHeightM * 0.28, hz, yaw,
            0.12, 0.34, TRAIN.carWidthM * 0.62, carry);
          /**
           * `LIGHT.trainHeadNits` would be a fifth photometric constant for one
           * box; the headlamp rides the window material at a gain instead, and
           * the gain is written out: 220 x 12.0 = 2 640 cd/m², which is the
           * order of a sealed-beam lamp seen head-on and is 0.30x the neon tube
           * this project already carries.
           */
          const g = c === lead ? 12.0 : 0.0;
          col.setRGB(g, g * 0.96, g * 0.88, THREE.LinearSRGBColorSpace);
          lightMesh.setColorAt(lightRow - 1, col);
        }
      }

      // --- the cranes --------------------------------------------------------
      const city = ctx.get('city');
      const cranes = city && city.cranes ? city.cranes() : [];
      let n = 0;
      for (const cr of cranes) {
        if (n >= MAX_CRANES) break;
        n++;
        /**
         * THE SLEW AND THE HOIST, BOTH OFF THE ONE CLOCK AND BOTH WITH THEIR
         * OWN PHASE, so two cranes on screen are never in step. A crane that
         * repeats every four minutes and a hook that repeats every forty-six
         * seconds beat against each other at a period neither of them has,
         * which is what stops the motion reading as an animation loop.
         */
        const slew = ((now / SITE.slewPeriodS + cr.phase) % 1) * Math.PI * 2 * cr.slewDir;
        const hoistU = (now / SITE.hoistPeriodS + cr.phase * 3) % 1;
        /** A raised cosine: a load accelerates and decelerates, it does not jump. */
        const lift = 0.5 - 0.5 * Math.cos(hoistU * Math.PI * 2);
        const topY = cr.mast;
        const cs = Math.cos(slew);
        const sn = Math.sin(slew);
        const d = Math.hypot(cr.x - cam.x, cr.z - cam.z, topY - cam.y);
        const carryJib = motionCutoffDistance(1.6, 4, theta) < d;
        const carryHook = motionCutoffDistance(1.1, 4, theta) < d;
        if (carryJib) suppressed += BOXES_PER_CRANE;

        const along = (t) => [cr.x + cs * t, cr.z + sn * t];
        // Slewing ring and cab.
        setRow(bodyArr, bodyMotion, bodyRow++, cr.x, topY + 0.6, cr.z, -slew, 2.6, 1.2, 2.6, carryJib);
        {
          const [ax, az] = along(3.2);
          setRow(bodyArr, bodyMotion, bodyRow++, ax, topY + 2.2, az, -slew, 2.6, 2.2, 2.2, carryJib);
        }
        // Six jib sections of falling depth: a jib TAPERS, which is what makes
        // it read as a truss rather than as a plank.
        for (let i = 0; i < 6; i++) {
          const t0 = (i / 6) * cr.jib;
          const t1 = ((i + 1) / 6) * cr.jib;
          const [ax, az] = along((t0 + t1) / 2);
          const depth = 1.9 - 1.0 * (i / 5);
          setRow(bodyArr, bodyMotion, bodyRow++, ax, topY + 1.4 + depth / 2, az, -slew,
            t1 - t0, depth, 1.6, carryJib);
        }
        // Counter-jib and counterweight — the asymmetry is the silhouette.
        {
          const [ax, az] = along(-cr.counterJib / 2);
          setRow(bodyArr, bodyMotion, bodyRow++, ax, topY + 2.0, az, -slew, cr.counterJib, 1.5, 1.8, carryJib);
          const [bxp, bzp] = along(-cr.counterJib);
          setRow(bodyArr, bodyMotion, bodyRow++, bxp, topY + 1.6, bzp, -slew, 3.4, 2.4, 3.0, carryJib);
        }
        // Trolley, rope and load.
        {
          const trolleyAt = cr.jib * (0.35 + 0.5 * ((cr.phase * 7) % 1));
          const [tx, tz] = along(trolleyAt);
          setRow(bodyArr, bodyMotion, bodyRow++, tx, topY + 1.1, tz, -slew, 1.6, 0.7, 1.8, carryJib);
          /**
           * THE LOAD RISES AND FALLS THROUGH THE WHOLE HEIGHT OF THE BUILDING
           * IT IS BUILDING, which is what makes the motion legible at distance:
           * a 40 m travel over 46 s is 1.7 m/s, and the eye reads a slow
           * vertical against a static skyline more easily than anything else in
           * this project.
           */
          const loadY = 2.0 + lift * (topY - 8.0);
          setRow(bodyArr, bodyMotion, bodyRow++, tx, (topY + 0.7 + loadY) / 2, tz, -slew,
            0.09, topY + 0.7 - loadY, 0.09, carryHook);
          setRow(bodyArr, bodyMotion, bodyRow++, tx, loadY + 0.55, tz, -slew, 1.1, 0.5, 1.1, carryHook);
          setRow(bodyArr, bodyMotion, bodyRow++, tx, loadY - 0.6, tz, -slew + 0.4, 2.6, 1.2, 1.6, carryHook);
        }
        for (let i = bodyRow - BOXES_PER_CRANE; i < bodyRow; i++) {
          col.setRGB(0.52, 0.34, 0.09, THREE.LinearSRGBColorSpace);
          bodyMesh.setColorAt(i, col);
        }
        // The obstruction light at the jib head.
        {
          const [lx, lz] = along(cr.jib);
          setRow(lightArr, lightMotion, lightRow++, lx, topY + 2.6, lz, -slew, 0.35, 0.35, 0.35, carryJib);
          const flash = ((now / 2.0 + cr.phase) % 1) < 0.25 ? 74.1 : 0.45;
          col.setRGB(flash, flash * 0.05, flash * 0.04, THREE.LinearSRGBColorSpace);
          lightMesh.setColorAt(lightRow - 1, col);
        }
      }
      stats.cranes = n;
      stats.suppressed = suppressed;

      /**
       * Rows nobody used this frame are parked at the origin with zero scale.
       * A row left holding last frame's transform is a crane that stayed behind
       * when its chunk streamed out; a zero-scale row draws no pixels and keeps
       * the instance count constant, which is what stops the draw call's cost
       * moving with the content (`traffic.js` parks its spare rows the same way).
       */
      for (let r = bodyRow; r < stats.bodyRows; r++) setRow(bodyArr, bodyMotion, r, 0, -1000, 0, 0, 0, 0, 0, true);
      for (let r = lightRow; r < stats.lightRows; r++) setRow(lightArr, lightMotion, r, 0, -1000, 0, 0, 0, 0, 0, true);

      if (!primed) {
        // Both buffers seeded with frame 0's transforms, so frame 0 reads a
        // PRIMED buffer rather than one nobody wrote (§5.12's three states).
        bodyMotion.prime(bodyArr);
        lightMotion.prime(lightArr);
        primed = true;
      }
      /**
       * THE SWAP IS AN INVARIANT RATHER THAN A CONVENTION (§5.12).
       * `instmotion` stamps every write with its frame id and `read()` THROWS
       * if handed the buffer written this frame; a module that throws is
       * quarantined and every gate in this project asserts `ctx.faults` is
       * empty. One invariant, six gates, no new gate.
       */
      bodyMotion.commit();
      lightMotion.commit();
      bodyMesh.instanceMatrix = bodyMotion.current();
      lightMesh.instanceMatrix = lightMotion.current();
      bodyMesh.instanceMatrix.needsUpdate = true;
      lightMesh.instanceMatrix.needsUpdate = true;
      bodyGeo.setAttribute('noctisPrevInstanceMatrix', bodyMotion.read(frameId));
      lightGeo.setAttribute('noctisPrevInstanceMatrix', lightMotion.read(frameId));
      if (bodyMesh.instanceColor) bodyMesh.instanceColor.needsUpdate = true;
      if (lightMesh.instanceColor) lightMesh.instanceColor.needsUpdate = true;
      frameId++;
    },

    dispose(ctx) {
      if (group) ctx.scene.remove(group);
      if (bodyGeo) bodyGeo.dispose();
      if (lightGeo) lightGeo.dispose();
      if (bodyMat) bodyMat.dispose();
      if (lightMat) lightMat.dispose();
      if (bodyMesh) bodyMesh.dispose();
      if (lightMesh) lightMesh.dispose();
      group = null;
      bodyMesh = null;
      lightMesh = null;
      trains.length = 0;
    },
  };
}
