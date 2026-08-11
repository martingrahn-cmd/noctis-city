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
import { LANDMARKS, viaductArc, viaductSoffitY, SITE } from '../lib/citygen.js';

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
  /** Metres of rail level above the deck slab — `city.js`'s ballast + rail. */
  railRiseM: 0.62,
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
};

/** Boxes per train car: body, roof, skirt, two bogies. */
const BOXES_PER_CAR = 5;
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
  function setRow(arr, motion, row, x, y, z, yaw, sx, sy, sz, carry) {
    pos.set(x, y, z);
    eul.set(0, yaw, 0);
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
      deckY = viaduct.height + TRAIN.railRiseM;

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
       * `LIGHT.windowLitNits` is what `block.js` puts behind a pane and is the
       * right order for a saloon interior; the crane's obstruction light rides
       * the same material at a gain in `instanceColor`, exactly as a traffic
       * signal's lit lens does — one material, two radiances, one draw call.
       * §9 rule 4, both numbers: 220 x 74.1 = 16 300 cd/m², which is
       * `LIGHT.aviationRedNits`, because a crane's head light IS an obstruction
       * light under the same ICAO Annex 14 §6.3 the condenser's are derived
       * from.
       */
      lightMat.emissiveIntensity = LIGHT.windowLitNits;
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

      const trainLen = TRAIN.cars * TRAIN.carLengthM + (TRAIN.cars - 1) * TRAIN.gapM;
      for (let t = 0; t < TRAIN.trains; t++) {
        trains.push({
          /**
           * Two trains, one each way, started half the arc apart so the deck is
           * never empty at both ends and never full in the middle.
           */
          dir: t % 2 === 0 ? 1 : -1,
          s: -arc.arcLength / 2 + (t / TRAIN.trains) * arc.arcLength,
          len: trainLen,
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

      group.add(bodyMesh);
      group.add(lightMesh);
      ctx.scene.add(group);

      return {
        stats: () => stats,
        /** Where the trains are, for a probe. No verdict. */
        trainPositions: () => trains.map((t) => ({ s: t.s, dir: t.dir })),
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
        tr.s += tr.dir * TRAIN.speedMps * step;
        /**
         * A TRAIN THAT RUNS OFF THE END TURNS ROUND, and the reversal is a
         * TELEPORT for §5.12's purposes: the far end of the deck is 430 m from
         * the near one and the vector across that gap is bookkeeping rather
         * than motion. `carry()` is the same mechanism a recycled vehicle uses.
         */
        let recycled = false;
        const halfArc = arc.arcLength / 2;
        if (tr.s > halfArc - tr.len / 2) { tr.s = halfArc - tr.len / 2; tr.dir = -1; recycled = true; }
        if (tr.s < -halfArc + tr.len / 2) { tr.s = -halfArc + tr.len / 2; tr.dir = 1; recycled = true; }

        for (let c = 0; c < TRAIN.cars; c++) {
          const offset = (c - (TRAIN.cars - 1) / 2) * (TRAIN.carLengthM + TRAIN.gapM);
          const st = arcAt(tr.s + offset * tr.dir);
          /**
           * WHICH TRACK. `city.js` lays the two ballast troughs at
           * `±deck·0.235`; a train keeps to the track its direction belongs to,
           * so the two pass each other rather than running through each other.
           */
          const lat = tr.dir * viaduct.deck * 0.235;
          const yaw = st.yaw;
          const nx = -Math.sin(yaw);
          const nz = -Math.cos(yaw);
          const x = st.x + nx * lat;
          const z = st.z + nz * lat;
          const d = Math.hypot(x - cam.x, z - cam.z, deckY - cam.y);
          const carry = recycled || motionCutoffDistance(TRAIN.carWidthM, 4, theta) < d;
          if (carry && !recycled) suppressed += BOXES_PER_CAR;

          const y = deckY + TRAIN.carHeightM / 2;
          setRow(bodyArr, bodyMotion, bodyRow++, x, y, z, yaw, TRAIN.carLengthM, TRAIN.carHeightM, TRAIN.carWidthM, carry);
          setRow(bodyArr, bodyMotion, bodyRow++, x, y + TRAIN.carHeightM / 2 + 0.09, z, yaw,
            TRAIN.carLengthM * 0.96, 0.18, TRAIN.carWidthM * 0.9, carry);
          setRow(bodyArr, bodyMotion, bodyRow++, x, deckY + 0.28, z, yaw,
            TRAIN.carLengthM * 0.98, 0.56, TRAIN.carWidthM * 0.86, carry);
          for (const b of [-1, 1]) {
            const bx = x + Math.cos(yaw) * b * TRAIN.carLengthM * 0.32;
            const bz = z - Math.sin(yaw) * b * TRAIN.carLengthM * 0.32;
            setRow(bodyArr, bodyMotion, bodyRow++, bx, deckY - 0.18, bz, yaw, 3.0, 0.5, TRAIN.carWidthM * 0.7, carry);
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
