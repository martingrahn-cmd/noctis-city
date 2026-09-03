/**
 * aircraft.js — things in the air over the city. Session 20, item 5.
 *
 * WHAT THIS IS FOR, AND IT IS TWO THINGS.
 *
 * The first is that a large city has aircraft over it and this one had none, so
 * the sky above the skyline was empty in every frame the project has ever
 * shipped. The second is the one that made it worth a module rather than a
 * decoration: session 19 put eighteen red obstruction beacons on the condenser
 * and the mast, derived them from ICAO Annex 14, and wrote down that they exist
 * FOR AIR TRAFFIC. Built without anything in the air they are a light that
 * warns nobody. Built together they are one idea.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IT IS THE FIRST CONTENT IN THIS PROJECT THAT MOVES IN THREE DIMENSIONS.
 *
 * Traffic runs on a lane lattice, pedestrians on a ground plane, rain falls
 * down one axis. Every one of them is planar. An aeroplane crossing a frame is
 * displaced in x, y and z at once, which is the case CONTRACT §5.11 and §5.12
 * were written for and the case neither has ever been exercised by:
 *
 *   §5.12's SIZE THRESHOLD BITES HERE FOR THE FIRST TIME. A motion vector is
 *   suppressed below `motionVectors.minExtentPx` = 4 px because the TAA
 *   neighbourhood clamp cannot express reprojection error on anything smaller.
 *   The table in `budget.json` records that the threshold "suppresses nothing
 *   today: traffic is simulated inside 190 m and pedestrians inside 120 m
 *   against cutoffs of 560 m and 174 m. It is a bound, not an optimisation."
 *   An aeroplane at `AIRCRAFT.planeHigh` = 900 m is past its own cutoff, so
 *   this is the first system in the project where the bound actually suppresses
 *   something — and the cutoff is printed at init beside the altitudes it is
 *   compared against, because a threshold that starts binding should say so.
 *
 *   THE NAVIGATION LIGHTS ARE BELOW IT ALWAYS. `NAV_M` is 0.22 m, whose cutoff
 *   at the gate's own pixel angle is 85 m — under the lowest altitude any of
 *   this flies at. So every nav-light row is carried, on every frame, and its
 *   motion vector is exactly zero by the mechanism §5.12 built for a recycled
 *   vehicle. That is the correct answer rather than a gap: a 0.22 m box at
 *   400 m is a fifth of a pixel and there is no history for a clamp to reject.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT IT COSTS, WHICH IS THE ARGUMENT FOR BUILDING IT AT ALL.
 *
 *   draw calls    2   `aircraft:bodies` and `aircraft:lights`
 *   instances    24 + 30
 *   triangles    24 x 12 + 30 x 12 = 648
 *   cluster slots 1, and only one: the searchlight. The five nav lights per
 *                 aircraft are EMISSIVE GEOMETRY at zero slots, by the same
 *                 argument `budget.json` makes about tail lamps — the pool a
 *                 40 cd position light throws at 400 m is nothing, and what
 *                 makes an aircraft read at night is the emitter itself.
 *   shadows       none. A shadow at 400 m is outside `LIGHTING.shadowExtent`
 *                 = 170 m before anything else is considered.
 *   collision     none. Nothing in this world is above 260 m except this.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE LEASH, STATED RATHER THAN HIDDEN.
 *
 * The orbiting helicopter's orbit centre follows the camera through a
 * first-order lag with a 20 s time constant. That is a game convention and not
 * a simulation: a real police helicopter orbits an incident, not a viewer.
 * It is recorded here as a deliberate exaggeration, the same shape as
 * `PLAYER.walkSpeedMps` being 1.71x the Froude bound and `AIRCRAFT.planes` = 3
 * being far above what a density model gives. The licence is the same in all
 * three cases: nothing is derived from it. What it buys is that the one thing
 * worth spending a cluster slot on — a moving cone sweeping facades and the
 * river — is in frame rather than four kilometres away.
 *
 * A LAG FOR MOTION AND A SNAP FOR A TELEPORT. The lag handles walking, driving
 * and every route in `perfcheck`; it cannot handle `setShotAt`, which moves the
 * camera hundreds of metres between two frames and which every gate and both
 * film tools drive. So beyond `LEASH_SNAP_M` the centre jumps — and a jump is a
 * recycle, so the orbiter's motion rows are carried on that frame exactly as a
 * re-seeded aeroplane's are. The first version had only the lag, and the first
 * `lookat` frame of the session came back with an empty sky; that is recorded
 * in the branch itself rather than here, because that is where it bites.
 */

import * as THREE from 'three';
import { AIRCRAFT, LIGHT, CLUSTER, RENDER } from '../core/constants.js';
import { AIRFIELD } from '../lib/citygen.js';
import { EMITTER_CHROMA } from '../lib/color.js';
import { createInstanceMotion, pixelAngle, motionCutoffDistance } from '../core/instmotion.js';

/**
 * The internal render buffer's line count, for §5.12's pixel angle. `RENDER`
 * declares `pixels` as a TOTAL (2560 x 1440) and `aspect` separately, so the
 * height is derived from the pair rather than transcribed as 1440 — the same
 * pair `budget.json` calls the gate viewport, and exactly the arrangement §9.1
 * warns about when one of two copies is the one that is wired up.
 */
const INTERNAL_LINES = Math.round(Math.sqrt(RENDER.pixels / (16 / 9)));

/** Boxes per airframe, and light rows per airframe. Both fixed. */
const BOXES_PER_AIRCRAFT = 4;
const LIGHTS_PER_AIRCRAFT = 5;

/**
 * The nav-light emitter box, m. 0.22 m is a lens housing plus its fairing, and
 * it is the number `LIGHT.aircraftNavNits` divides the candela by — the two are
 * one decision and neither is meaningful without the other.
 */
const NAV_M = 0.22;

/**
 * THE MINIMUM SIZE A NAV LAMP IS DRAWN AT, IN PIXELS — and the quantity that is
 * conserved when it is enlarged is the INTENSITY, not the radiance.
 *
 * THE PROBLEM, MEASURED BEFORE IT WAS FIXED: a 0.22 m box at 1000 m subtends
 * 2.2e-4 rad, which at the gate's own 6.4765e-4 rad per pixel is **0.34 px**.
 * A sub-pixel emitter is not dim, it is ABSENT — the rasteriser either misses
 * every sample or catches one and the TAA clamp discards the result as an
 * outlier. The first sky frame of this session showed exactly nothing at all,
 * which is how this was found.
 *
 * THE FIX IS NOT "MAKE IT BIGGER", WHICH WOULD MAKE A 40 cd LAMP AS BRIGHT AS A
 * FLOODLIGHT. What a distant emitter delivers to a frame is its luminous
 * INTENSITY `I = L · A` in candela, and that is what has to survive: the box is
 * grown to the pixel floor and its radiance is divided by the same area factor,
 * so `I` is identical at every distance and the enlargement is a RESAMPLING
 * rather than a brightening. It is written out at the point of use below,
 * because a radiance divided by an area ratio is exactly the shape §9's table
 * is made of.
 *
 * 3 px, AND IT IS THIS PROJECT'S OWN NUMBER RATHER THAN A NEW ONE.
 * `budget.json` → `particles.maxStreakWidthPx` is 3, derived in session 4a as
 * "a 1 px core plus a half-pixel soft edge each side, the narrowest quad that
 * can carry an antialiased line under TAA jitter". A nav lamp is that question
 * with a point instead of a line, so it takes the same answer. It sits below
 * §5.12's 4 px by construction, which is consistent rather than awkward: 4 px
 * is the size at which an object can express reprojection error, 3 px is the
 * size at which it can be drawn at all, and a lamp qualifies for the second and
 * not the first — which is why every lamp row is carried.
 */
const NAV_MIN_PX = 3;

/**
 * The radius at which an aeroplane is re-seeded on the far side. 1500 m is
 * outside anything the city draws — `CITY.geometryRadius` x `CITY.chunkSize` is
 * 5 x 128 = 640 m of buildings — so a recycle always happens off screen at any
 * sane field of view, which is what makes the `carry()` invisible rather than a
 * pop.
 */
const RING_M = 1500;

/**
 * How far the camera may get from the orbit centre before the centre jumps
 * rather than chases. 600 m is just outside the city's own geometry ring
 * (`CITY.geometryRadius` x `CITY.chunkSize` = 640 m), so ordinary walking,
 * driving and every route in `perfcheck` stay inside it, and only a TELEPORT
 * crosses it — which is the event it exists for.
 */
const LEASH_SNAP_M = 600;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ONE AEROPLANE ON SHORT FINAL — SESSION 75, ITEM 3c.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * *"AN AIRCRAFT ON SHORT FINAL OVER THE APPROACH ROW is the shot this whole
 * two-session arc exists to produce."*
 *
 * IT IS NOT A SEVENTH AIRFRAME. The fleet is six and stays six; while the
 * camera is near the field, plane 0 flies the approach instead of a transit.
 * A new role would mean a new count, a new mesh size and three `stats` fields
 * that `landmarkcensus` and `motioncheck` read — for one aeroplane that is
 * already in the sky. This is the same aeroplane doing something different.
 *
 * AND IT IS GATED ON DISTANCE SO NO GATE CAN SEE IT. Every `perfcheck` route,
 * every `lookcheck` pose and `citycheck`'s whole region are inside the city;
 * the field is 5.06 km from the origin, so `APPROACH_RANGE_M` = 3 000 m cannot
 * reach any of them. Outside that range this file behaves exactly as session
 * 20 wrote it, line for line.
 *
 * THE SLOPE IS 3°, WHICH IS THE ONE NUMBER IN AVIATION EVERYBODY AGREES ON,
 * and the touchdown datum is asked of the city rather than typed, because the
 * platform's level is derived per seed (`airfieldSite`) and a literal here
 * would be right at 1337 and wrong at 1338 — `harbourSite`'s own lesson.
 */
const APPROACH_RANGE_M = 3000;
const APPROACH_SLOPE = Math.tan((3 * Math.PI) / 180);
/**
 * Where it is picked up, and where it goes around. Both from the threshold.
 *
 * 900 m OUT AND NOT 2 600, AND THE REASON IS THE CAPTURE PATH. Every frame
 * tool runs the page with `?paused=1`, so an aeroplane seeded at the outer
 * marker is still at the outer marker when the shutter opens — 2.6 km away and
 * 146 m up, which is a dot. 900 m puts it on SHORT final at 57 m over the
 * approach row, which is where item 3c wants it and is also a real point on a
 * real approach. The path is the same either way; this is where it starts.
 */
const APPROACH_OUT_M = 380;
const APPROACH_PAST_M = 700;
/** Flare height: it does not touch down, because nothing here rolls out. */
const APPROACH_FLARE_M = 14;

/**
 * The five kinds of light on an airframe, in the order they are written into
 * the light mesh. Position is in the airframe's own axes: +x starboard, +y up,
 * −z forward (the same right-handed convention CONTRACT §3.1 gives the world).
 *
 * THE COLOURS AND THE SIDES ARE THE REGULATION'S, NOT A CHOICE.
 * ICAO Annex 6 / FAR 23.1385: red to PORT, green to STARBOARD, white aft. It is
 * worth writing down which is which, because a red light on the wrong wingtip
 * is the one error in this file a person could see and nobody would report.
 */
const NAV_LIGHTS = [
  { name: 'port', side: -1, aft: 0.0, up: 0.0, chroma: EMITTER_CHROMA.neonRed, nits: 'nav', flash: null },
  { name: 'starboard', side: 1, aft: 0.0, up: 0.0, chroma: EMITTER_CHROMA.neonGreen, nits: 'nav', flash: null },
  { name: 'tail', side: 0, aft: 1.0, up: 0.1, chroma: [1, 1, 1], nits: 'nav', flash: null },
  { name: 'strobe', side: 0.92, aft: 0.1, up: 0.0, chroma: [1, 1, 1], nits: 'beacon', flash: 'strobe' },
  { name: 'beacon', side: 0, aft: 0.25, up: -0.55, chroma: EMITTER_CHROMA.neonRed, nits: 'beacon', flash: 'beacon' },
];

/**
 * THE AIRFRAMES. Four boxes each, and the four are chosen by what they do to a
 * silhouette against a sky rather than by what they are — the same rule session
 * 19 used for the roof plant and §7.2 states in general.
 *
 * `wingSpan` is also the quantity `NAV_LIGHTS[].side` is a fraction of, so the
 * position lights are at the tips by construction and cannot drift inboard when
 * a dimension changes. `minExtent` is the smallest of the fuselage's own three
 * dimensions and is what §5.12's cutoff is computed from.
 */
const AIRFRAMES = {
  /** A light twin. 11.9 m span, 8.7 m long — a King Air, near enough. */
  plane: {
    wingSpan: 11.9,
    minExtent: 1.35,
    boxes: [
      { x: 0, y: 0, z: 0, w: 1.35, h: 1.35, d: 8.7 },
      { x: 0, y: -0.1, z: 0.4, w: 11.9, h: 0.32, d: 1.9 },
      { x: 0, y: 0.15, z: 3.6, w: 4.4, h: 0.24, d: 0.9 },
      { x: 0, y: 1.25, z: 3.7, w: 0.22, h: 2.2, d: 1.4 },
    ],
  },
  /**
   * A twin-engine helicopter. The rotor is ONE VERY FLAT BOX rather than blades:
   * at the distances this is seen from, a turning rotor is a disc, and four
   * blades at 5 Hz under a 60 Hz frame is a stroboscope rather than a rotor.
   * 13.4 m rotor diameter is an AW139's.
   *
   * ── AND IT WAS A SQUARE, WHICH IS NOT A DISC — SESSION 73, THE WALK ───────
   *
   * The round's own words, on `sea-harbour`: *"a grey rectangle floats in the
   * sky."* It is this box. **13.4 x 0.09 x 13.4 is a 13.4 m SQUARE PLATE**, and
   * the paragraph above is right about the disc and then builds the wrong
   * shape: from underneath, a square reads as a diamond hanging in the air with
   * a small wedge under it, which is what the frame shows. Nothing about it
   * says helicopter.
   *
   * A ROTOR IS A BAR AND NOT A PLATE, at any speed a frame can catch. Four
   * blades frozen by a shutter are a cross; blurred, they are a thin annulus
   * seen edge-on as a LINE. Both read as a bar, and a bar is what this can be
   * inside `BOXES_PER_AIRCRAFT` = 4 — which is fixed here and in the mesh's own
   * row arithmetic, so a fifth box is not a one-line change.
   *
   * The diameter is untouched: 13.4 m is still an AW139's and `wingSpan` still
   * reads it. What changed is the chord, 13.4 m to 2.4, and the disc is darker
   * than the airframe because a rotor in motion is.
   */
  heli: {
    wingSpan: 13.4,
    minExtent: 1.9,
    boxes: [
      { x: 0, y: 0, z: 0, w: 2.1, h: 1.9, d: 4.6 },
      { x: 0, y: 0.35, z: 3.4, w: 0.5, h: 0.5, d: 3.4 },
      { x: 0, y: 1.35, z: 0.2, w: 13.4, h: 0.09, d: 2.4, dark: 1 },
      { x: 0.1, y: 0.9, z: 5.0, w: 0.14, h: 1.6, d: 0.7 },
    ],
  },
};

export function createAircraft(options = {}) {
  const cfg = { ...options };

  let group = null;
  let bodyMesh = null;
  let lightMesh = null;
  let bodyGeo = null;
  let lightGeo = null;
  let bodyMat = null;
  let lightMat = null;
  let bodyMotion = null;
  let lightMotion = null;
  let searchlight = null;
  let ctxRef = null;

  /** The fleet. Fixed length; nothing is ever added or removed after init. */
  const fleet = [];
  let frameId = 1;
  let lastNow = 0;
  let primed = false;

  /** The orbit centre, lagged toward the camera. See the header's note. */
  const orbitCentre = { x: 0, z: 0 };
  let orbitSeeded = false;
  /** Set when the centre jumped this frame; carries the orbiter's motion rows. */
  let orbitSnapped = false;

  const stats = {
    count: 0,
    planes: 0,
    cruisers: 0,
    orbiters: 0,
    recycledThisFrame: 0,
    /** Airframes past §5.12's own cutoff this frame, i.e. carried for size. */
    suppressedByThreshold: 0,
    bodyCutoffM: 0,
    navCutoffM: 0,
    searchlightOn: false,
    searchTargetM: 0,
    /** Where the beam meets the ground, world metres. For a probe and the HUD. */
    searchTarget: [0, 0, 0],
  };

  const mat = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const eul = new THREE.Euler();
  const vPos = new THREE.Vector3();
  const vScale = new THREE.Vector3();

  /**
   * A deterministic hash in [0,1). Used for per-aircraft phase and heading, off
   * the aircraft's INDEX rather than off `ctx.rng`, for the same reason
   * `city.js`'s roofscape does: the fleet has to be identical on every run and
   * on every machine, and consuming a shared stream would be one more thing a
   * future system could shift.
   */
  const hash = (i, salt) => Math.abs(Math.sin((i * 12.9898 + salt * 78.233) * 43758.5453) % 1);

  /**
   * THE APPROACH'S OWN GEOMETRY, off `AIRFIELD` and the delivered ground.
   *
   * `AIRFIELD.cx` and `cz` are constants, so the centreline and the threshold
   * need no seed; only the touchdown ELEVATION does, and that is read off the
   * city module's delivered ground rather than recomputed — CONTRACT §9.1, and
   * `groundYAt` is the same call the signal masts make.
   */
  const threshZ = () => AIRFIELD.cz - AIRFIELD.runM / 2;
  function approachDatum(ctx) {
    const city = ctx && ctx.get ? ctx.get('city') : null;
    const y = city && city.groundYAt ? city.groundYAt(AIRFIELD.cx, threshZ()) : null;
    return Number.isFinite(y) ? y : 10;
  }
  /** Is the camera near enough the field for plane 0 to be flying an approach? */
  function approachActive(cam) {
    const dx = cam.x - AIRFIELD.cx;
    const dz = cam.z - threshZ();
    return dx * dx + dz * dz < APPROACH_RANGE_M * APPROACH_RANGE_M;
  }
  /** Put it back at the outer marker, on the extended centreline, inbound. */
  function seedApproach(a, ctx) {
    a.approach = true;
    a.hx = 0;
    a.hz = 1;
    a.x = AIRFIELD.cx;
    a.z = threshZ() - APPROACH_OUT_M;
    a.roll = 0;
    a.groundY = approachDatum(ctx);
    a.trips++;
  }

  function seedAircraft(a, i, cam, initial) {
    /**
     * A HEADING AND AN OFFSET, NOT A WAYPOINT LIST. A transiting aircraft flies
     * a straight line; giving it a spline would be simulating an airway this
     * city does not have.
     */
    const th = hash(i, 3) * Math.PI * 2;
    a.hx = Math.sin(th);
    a.hz = -Math.cos(th);
    /**
     * Re-seeded on the FAR side of the ring along its own track, offset
     * laterally so it does not fly through the point it just left. `initial`
     * spreads the fleet along the track instead, so nothing arrives at once.
     */
    const along = initial ? (hash(i, 7) * 2 - 1) * RING_M : -RING_M;
    const lateral = (hash(i, 11 + (a.trips % 7)) * 2 - 1) * 620;
    a.x = cam.x + a.hx * along - a.hz * lateral;
    a.z = cam.z + a.hz * along + a.hx * lateral;
    a.trips++;
    return true;
  }

  return {
    name: 'aircraft',
    needs: ['time'],

    init(ctx) {
      ctxRef = ctx;
      const lights = ctx.get('lights');

      group = new THREE.Group();
      group.name = 'aircraft';

      // --- materials -----------------------------------------------------
      //
      // Two, both compiling the §5.12 per-instance motion path. An airframe at
      // night is a silhouette with lamps on it, so the body carries no
      // emissive at all and the light rows carry nothing else.

      bodyMat = new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.52, metalness: 0.1, envMapIntensity: 1,
      });
      lightMat = new THREE.MeshStandardMaterial({ color: 0x0a0b0d, roughness: 0.12, metalness: 0 });
      lightMat.emissive.setRGB(1, 1, 1, THREE.LinearSRGBColorSpace);
      /**
       * The material's emissive is the NAV figure and the beacon's extra rides
       * in `instanceColor`, exactly as a traffic signal's lit lens does — one
       * material, two radiances, one draw call. §9 rule 4, both numbers:
       * 830 x 10.0 = 8300 cd/m².
       */
      lightMat.emissiveIntensity = LIGHT.aircraftNavNits;
      if (lights) {
        lights.patch(bodyMat, { prevInstance: true });
        lights.patch(lightMat, { prevInstance: true });
      }

      const count = AIRCRAFT.planes + AIRCRAFT.cruisers + AIRCRAFT.orbiters;
      const bodyCount = count * BOXES_PER_AIRCRAFT;
      const lightCount = count * LIGHTS_PER_AIRCRAFT;

      bodyGeo = new THREE.BoxGeometry(1, 1, 1);
      lightGeo = new THREE.BoxGeometry(1, 1, 1);
      bodyMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, bodyCount);
      lightMesh = new THREE.InstancedMesh(lightGeo, lightMat, lightCount);
      bodyMesh.name = 'aircraft:bodies';
      lightMesh.name = 'aircraft:lights';
      /**
       * THE CENSUS LABEL. `citycheck`'s scene walk asserts that every instanced
       * mesh in the world declares what its rows ARE and that the declaration
       * sums to `instanceMatrix.count` — CONTRACT §9.1's remedy for a refactor
       * that erases a category. Two new meshes with no label would have made
       * that gate red for the right reason, and putting the label here rather
       * than in the gate is the whole point of the mechanism.
       */
      bodyMesh.userData.noctisCensus = { aircraftBoxes: bodyCount };
      lightMesh.userData.noctisCensus = { aircraftNavLights: lightCount };
      for (const m of [bodyMesh, lightMesh]) {
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        // The population follows the camera over a 3 km box, so a per-mesh
        // bound would be wrong the moment it was computed. Same reasoning as
        // `traffic.js`.
        m.frustumCulled = false;
        m.castShadow = false;
        m.receiveShadow = false;
      }
      bodyMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(bodyCount * 3), 3);
      lightMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(lightCount * 3), 3);
      bodyMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      lightMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      /**
       * `noctisRough` — the per-instance roughness attribute every other
       * instanced surface in this project carries. An airframe is painted metal
       * and a lens is glass, and the two are one material.
       */
      const bodyRough = new Float32Array(bodyCount).fill(0.52);
      bodyGeo.setAttribute('noctisRough', new THREE.InstancedBufferAttribute(bodyRough, 1));
      const lightRough = new Float32Array(lightCount).fill(0.1);
      lightGeo.setAttribute('noctisRough', new THREE.InstancedBufferAttribute(lightRough, 1));

      bodyMotion = createInstanceMotion(bodyCount, 'aircraft:bodies');
      lightMotion = createInstanceMotion(lightCount, 'aircraft:lights');

      // --- the fleet -----------------------------------------------------

      const cam = ctx.camera.position;
      for (let i = 0; i < count; i++) {
        const role = i < AIRCRAFT.planes ? 'plane'
          : i < AIRCRAFT.planes + AIRCRAFT.cruisers ? 'cruiser' : 'orbiter';
        const frame = role === 'plane' ? 'plane' : 'heli';
        const band = role === 'plane'
          ? [AIRCRAFT.planeLow, AIRCRAFT.planeHigh]
          : role === 'cruiser' ? [AIRCRAFT.cruiserLow, AIRCRAFT.cruiserHigh]
            : [AIRCRAFT.orbitAltitude, AIRCRAFT.orbitAltitude];
        const a = {
          i, role, frame,
          y: band[0] + hash(i, 1) * (band[1] - band[0]),
          speed: role === 'plane' ? AIRCRAFT.planeSpeedMps
            : role === 'cruiser' ? AIRCRAFT.cruiserSpeedMps : AIRCRAFT.orbitSpeedMps,
          x: 0, z: 0, hx: 0, hz: -1, yaw: 0, roll: 0,
          trips: 0,
          /** Its own flash phase, so six aircraft do not blink together. */
          phase: hash(i, 5),
          orbitAngle: hash(i, 9) * Math.PI * 2,
        };
        seedAircraft(a, i, cam, true);
        fleet.push(a);
      }
      stats.count = count;
      stats.planes = AIRCRAFT.planes;
      stats.cruisers = AIRCRAFT.cruisers;
      stats.orbiters = AIRCRAFT.orbiters;

      // --- the one clustered light ---------------------------------------

      if (lights && AIRCRAFT.orbiters > 0) {
        searchlight = lights.add({
          role: 'aircraft',
          position: new THREE.Vector3(0, -1000, 0),
          color: [1, 0.97, 0.92],
          intensity: LIGHT.searchlightCandela,
          /**
           * The falloff radius, m, and it is `LIGHT.searchlightRadiusM` rather
           * than a number chosen here — the intensity above was derived through
           * this radius's own Frostbite window, so the two are one decision and
           * a copy of either would be half of it.
           */
          radius: LIGHT.searchlightRadiusM,
          type: 'spot',
          direction: new THREE.Vector3(0, -1, 0),
          /** 7.5° half-angle. See `LIGHT.searchlightCandela` for why not 2°. */
          coneOuter: 0.1309,
          coneInner: 0.0785,
          sourceRadius: 0.18,
        });
      }

      group.add(bodyMesh);
      group.add(lightMesh);
      ctx.scene.add(group);

      /**
       * §9 rule 4 and §5.12's own obligation: the cutoff is DERIVED from a
       * pixel count and an angle and consumed in a different file, so both it
       * and the altitudes it is compared against are printed at the point of
       * use. This is the first system in the project where the threshold is not
       * inert, and the line says so.
       */
      const theta = pixelAngle(ctx.camera, INTERNAL_LINES);
      stats.bodyCutoffM = +motionCutoffDistance(AIRFRAMES.plane.minExtent, 4, theta).toFixed(0);
      stats.navCutoffM = +motionCutoffDistance(NAV_M, 4, theta).toFixed(0);
      ctx.log(
        `aircraft: ${count} airframes (${AIRCRAFT.planes} plane, ${AIRCRAFT.cruisers} cruiser, ` +
        `${AIRCRAFT.orbiters} orbiter), ${bodyCount} body + ${lightCount} light instances, 2 draws, ` +
        `${searchlight ? 1 : 0} of ${CLUSTER.maxLights} cluster slots. ` +
        `§5.12 cutoff: fuselage ${AIRFRAMES.plane.minExtent} m → ${stats.bodyCutoffM} m against altitudes ` +
        `${AIRCRAFT.orbitAltitude}–${AIRCRAFT.planeHigh} m, so an aeroplane at cruise IS suppressed — ` +
        `the first content in this project the threshold actually bites on. ` +
        `Nav lamp ${NAV_M} m → ${stats.navCutoffM} m, under every altitude, so every lamp row is carried.`
      );

      return {
        stats: () => ({ ...stats }),
        /** For a probe and for the HUD. No verdicts. */
        fleetState: () => fleet.map((a) => ({
          role: a.role, x: +a.x.toFixed(1), y: +a.y.toFixed(1), z: +a.z.toFixed(1),
        })),
        motionLayers: () => [bodyMotion, lightMotion],
      };
    },

    update(ctx, dtRaw) {
      if (!bodyMesh) return;
      const time = ctx.get('time');
      /**
       * ONE CLOCK, and this is the sixth thing to integrate it (CONTRACT §11's
       * list plus the beacons). `time.now` rather than the loop's `dt`, so
       * `?paused=1` freezes the aircraft exactly as it freezes the traffic and
       * a capture arrives in the same state on every run.
       */
      const now = time ? time.now : 0;
      let dt = now - lastNow;
      lastNow = now;
      if (!(dt > 0)) dt = 0;
      if (dt > 0.1) dt = 0.1;

      const cam = ctx.camera.position;
      const theta = pixelAngle(ctx.camera, INTERNAL_LINES);
      const bodyCut = motionCutoffDistance(AIRFRAMES.plane.minExtent, 4, theta);
      stats.bodyCutoffM = +bodyCut.toFixed(0);
      stats.navCutoffM = +motionCutoffDistance(NAV_M, 4, theta).toFixed(0);

      if (!orbitSeeded) {
        orbitCentre.x = cam.x;
        orbitCentre.z = cam.z;
        orbitSeeded = true;
      } else {
        /**
         * A LAG FOR MOTION AND A SNAP FOR A TELEPORT, and the two are different
         * events rather than one tolerance.
         *
         * The lag (tau = 20 s) is what keeps the searchlight over the operator
         * without the helicopter reading as attached to them. It cannot handle
         * `harness.setShotAt` or `player.teleport`, which move the camera
         * hundreds of metres between two frames — at dt = 1/60 the lag closes
         * 0.08% of that gap, so the helicopter would be left behind for the next
         * four minutes and every `lookat` frame of this session would have had
         * an empty sky. Measured: the first sky shot did.
         *
         * So beyond `LEASH_SNAP_M` the centre jumps, and a jump is a RECYCLE:
         * the orbiter's rows are carried on that frame (§5.12) because its
         * genuine previous transform is 600 m away and the vector across that
         * gap is bookkeeping rather than motion.
         */
        const gap = Math.hypot(cam.x - orbitCentre.x, cam.z - orbitCentre.z);
        if (gap > LEASH_SNAP_M) {
          orbitCentre.x = cam.x;
          orbitCentre.z = cam.z;
          orbitSnapped = true;
        } else {
          const k = 1 - Math.exp(-dt / 20);
          orbitCentre.x += (cam.x - orbitCentre.x) * k;
          orbitCentre.z += (cam.z - orbitCentre.z) * k;
        }
      }

      const bodyArr = bodyMotion.begin(frameId);
      const lightArr = lightMotion.begin(frameId);
      const bodyCol = bodyMesh.instanceColor.array;
      const lightCol = lightMesh.instanceColor.array;

      stats.recycledThisFrame = 0;
      stats.suppressedByThreshold = 0;

      for (let n = 0; n < fleet.length; n++) {
        const a = fleet[n];
        let recycled = false;

        if (a.role === 'orbiter') {
          a.orbitAngle += (a.speed / AIRCRAFT.orbitRadiusM) * dt;
          a.x = orbitCentre.x + Math.cos(a.orbitAngle) * AIRCRAFT.orbitRadiusM;
          a.z = orbitCentre.z + Math.sin(a.orbitAngle) * AIRCRAFT.orbitRadiusM;
          // Tangential heading, so it flies the circle rather than crabbing it.
          a.hx = -Math.sin(a.orbitAngle);
          a.hz = Math.cos(a.orbitAngle);
          /**
           * The bank angle is the turn's own: v²/(g·r), small-angle. At 12.9 m/s
           * on a 240 m orbit that is 4.0°, which is what `AIRCRAFT.orbitSpeedMps`
           * derives itself from — so the two cannot disagree.
           */
          a.roll = Math.atan((a.speed * a.speed) / (9.81 * AIRCRAFT.orbitRadiusM));
        } else if (a.approach) {
          /**
           * ON FINAL. Straight in on the extended centreline, descending at 3°
           * to a flare height it holds over the runway, and picked up again at
           * the outer marker when it has gone past. The RING test does not
           * apply: this aeroplane is anchored to a RUNWAY and not to a camera,
           * which is the whole difference between an approach and a transit.
           */
          a.z += a.speed * dt;
          a.roll = 0;
          const toGo = threshZ() - a.z;
          a.y = a.groundY + Math.max(APPROACH_FLARE_M, toGo * APPROACH_SLOPE);
          if (a.z > threshZ() + APPROACH_PAST_M || !approachActive(cam)) {
            if (approachActive(cam)) {
              seedApproach(a, ctxRef);
            } else {
              a.approach = false;
              a.y = AIRCRAFT.planeLow + hash(a.i, 1) * (AIRCRAFT.planeHigh - AIRCRAFT.planeLow);
              seedAircraft(a, a.i, cam, false);
            }
            recycled = true;
            stats.recycledThisFrame++;
          }
        } else {
          a.x += a.hx * a.speed * dt;
          a.z += a.hz * a.speed * dt;
          a.roll = 0;
          const dx = a.x - cam.x;
          const dz = a.z - cam.z;
          if (dx * dx + dz * dz > RING_M * RING_M) {
            /**
             * SESSION 75: near the field, plane 0 is recycled onto the
             * approach instead of onto a fresh transit heading. Nothing else
             * in the fleet changes and nothing anywhere changes outside
             * `APPROACH_RANGE_M`.
             */
            if (a.i === 0 && approachActive(cam)) seedApproach(a, ctxRef);
            else seedAircraft(a, a.i, cam, false);
            recycled = true;
            stats.recycledThisFrame++;
          } else if (a.i === 0 && approachActive(cam)) {
            seedApproach(a, ctxRef);
            recycled = true;
            stats.recycledThisFrame++;
          }
        }
        a.yaw = Math.atan2(a.hx, -a.hz);

        const af = AIRFRAMES[a.frame];
        const dxc = a.x - cam.x;
        const dyc = a.y - cam.y;
        const dzc = a.z - cam.z;
        const dist = Math.sqrt(dxc * dxc + dyc * dyc + dzc * dzc);
        /**
         * §5.12. Suppressed when the airframe is past its own cutoff OR when it
         * was recycled this frame — a re-seeded aeroplane's genuine previous
         * position is 3 km away and the vector across that gap is bookkeeping.
         */
        const suppressBody = recycled || dist > bodyCut ||
          (a.role === 'orbiter' && orbitSnapped);
        if (dist > bodyCut) stats.suppressedByThreshold++;

        eul.set(a.roll * (a.role === 'orbiter' ? 1 : 0), a.yaw, 0, 'YXZ');
        quat.setFromEuler(eul);

        for (let b = 0; b < BOXES_PER_AIRCRAFT; b++) {
          const box = af.boxes[b];
          // The box's own offset, rotated into the world by the airframe's
          // attitude. Composed through the same quaternion the body uses, so a
          // rolled helicopter's rotor rolls with it.
          vPos.set(box.x, box.y, box.z).applyQuaternion(quat);
          vPos.set(a.x + vPos.x, a.y + vPos.y, a.z + vPos.z);
          vScale.set(box.w, box.h, box.d);
          mat.compose(vPos, quat, vScale);
          const row = n * BOXES_PER_AIRCRAFT + b;
          mat.toArray(bodyArr, row * 16);
          if (suppressBody) bodyMotion.carry(row);
          // A dark grey airframe. At night it is a silhouette; by day it is a
          // pale underside against a bright sky, which is what a real one is.
          //
          // `box.dark` IS THE ROTOR — session 73. A turning disc is not the
          // colour of the machine under it: it is most of the way to the sky
          // behind it, and painting it the airframe's own 0.40 is what made a
          // 13.4 m plate read as a solid object rather than as motion.
          const bc = box.dark ? 0.16 : 0.40;
          bodyCol[row * 3] = bc;
          bodyCol[row * 3 + 1] = bc * 1.025;
          bodyCol[row * 3 + 2] = bc * 1.075;
        }

        /**
         * THE DRAWN SIZE OF A LAMP, AND THE AREA FACTOR THAT PAYS FOR IT.
         * `navSide` is the real housing until the pixel floor bites, and
         * `navGain` is `(NAV_M / navSide)²` — so `L · A` stays 830 × 0.0484 =
         * 40.2 cd at every distance, which is FAR 23.1389's forward-sector
         * minimum and the number `LIGHT.aircraftNavNits` was derived from.
         * The fraction names the quantity it is a fraction of (§9 rule 1).
         */
        const navSide = Math.max(NAV_M, NAV_MIN_PX * theta * dist);
        const navGain = (NAV_M * NAV_M) / (navSide * navSide);

        for (let l = 0; l < LIGHTS_PER_AIRCRAFT; l++) {
          const nav = NAV_LIGHTS[l];
          vPos.set(
            nav.side * af.wingSpan * 0.5,
            nav.up + af.boxes[0].h * 0.5,
            nav.aft * af.boxes[0].d * 0.5
          ).applyQuaternion(quat);
          vPos.set(a.x + vPos.x, a.y + vPos.y, a.z + vPos.z);
          vScale.set(navSide, navSide, navSide);
          mat.compose(vPos, quat, vScale);
          const row = n * LIGHTS_PER_AIRCRAFT + l;
          mat.toArray(lightArr, row * 16);
          /**
           * ALWAYS CARRIED. `NAV_M` = 0.22 m is under §5.12's 4 px at every
           * altitude this flies at — see the header — so this is the threshold
           * doing its job rather than a shortcut, and the alternative would be
           * a motion vector on a fifth of a pixel.
           */
          lightMotion.carry(row);

          /**
           * The flash. A RAISED COSINE rather than a square wave, for the reason
           * `city.js`'s aviation beacons give: a sub-pixel emitter that steps on
           * in one frame steps into the TAA history in one frame, and the clamp
           * turns that into lost accumulation rather than into a flash.
           */
          let gain = 1;
          if (nav.flash) {
            const period = nav.flash === 'strobe' ? AIRCRAFT.strobePeriodS : AIRCRAFT.beaconPeriodS;
            const duty = nav.flash === 'strobe' ? AIRCRAFT.strobeDuty : AIRCRAFT.beaconDuty;
            const u = ((now / period) + a.phase + l * 0.13) % 1;
            gain = u < duty ? 0.5 - 0.5 * Math.cos((u / duty) * Math.PI * 2) : 0;
          }
          /**
           * 10.0 = `aircraftBeaconNits` / `aircraftNavNits` = 8300 / 830. The
           * material is at the nav figure and the beacons ride a gain, which is
           * one material and one draw call for two radiances (§5.6's
           * per-instance emissive tint). Computed rather than typed.
           */
          const scale = (nav.nits === 'beacon'
            ? LIGHT.aircraftBeaconNits / LIGHT.aircraftNavNits : 1) * gain * navGain;
          lightCol[row * 3] = nav.chroma[0] * scale;
          lightCol[row * 3 + 1] = nav.chroma[1] * scale;
          lightCol[row * 3 + 2] = nav.chroma[2] * scale;
        }

        // --- the searchlight ---------------------------------------------
        if (a.role === 'orbiter' && searchlight) {
          /**
           * TWO SINUSOIDS AT COPRIME PERIODS, so the pool walks the city rather
           * than tracing one figure. See `AIRCRAFT.searchSweepS`.
           */
          const dep = AIRCRAFT.searchMinDepressionRad +
            (AIRCRAFT.searchMaxDepressionRad - AIRCRAFT.searchMinDepressionRad) *
            (0.5 - 0.5 * Math.cos((now / AIRCRAFT.searchSweepS) * Math.PI * 2));
          const bearing = a.yaw + Math.sin((now / AIRCRAFT.searchBearingS) * Math.PI * 2) * 1.15;
          const c = Math.cos(dep);
          searchlight.enabled = true;
          searchlight.position.set(a.x, a.y - af.boxes[0].h * 0.6, a.z);
          searchlight.direction.set(Math.sin(bearing) * c, -Math.sin(dep), -Math.cos(bearing) * c).normalize();
          stats.searchlightOn = true;
          /** Slant range to the ground under the beam, m. Printed by the HUD. */
          stats.searchTargetM = +(a.y / Math.max(0.05, Math.sin(dep))).toFixed(0);
          stats.searchTarget = [
            +(a.x + searchlight.direction.x * stats.searchTargetM).toFixed(1),
            0,
            +(a.z + searchlight.direction.z * stats.searchTargetM).toFixed(1),
          ];
        }
      }

      if (!primed) {
        // Both buffers seeded with frame 0's transforms, so frame 0 reads a
        // PRIMED buffer rather than one nobody wrote (§5.12's three states).
        bodyMotion.prime(bodyArr);
        lightMotion.prime(lightArr);
        primed = true;
      }

      orbitSnapped = false;
      bodyMotion.commit();
      lightMotion.commit();
      bodyMesh.instanceMatrix = bodyMotion.current();
      lightMesh.instanceMatrix = lightMotion.current();
      bodyMesh.instanceMatrix.needsUpdate = true;
      lightMesh.instanceMatrix.needsUpdate = true;
      bodyGeo.setAttribute('noctisPrevInstanceMatrix', bodyMotion.read(frameId));
      lightGeo.setAttribute('noctisPrevInstanceMatrix', lightMotion.read(frameId));
      bodyMesh.instanceColor.needsUpdate = true;
      lightMesh.instanceColor.needsUpdate = true;
      frameId++;
    },

    dispose(ctx) {
      if (group) ctx.scene.remove(group);
      if (bodyMesh) bodyMesh.dispose();
      if (lightMesh) lightMesh.dispose();
      if (bodyGeo) bodyGeo.dispose();
      if (lightGeo) lightGeo.dispose();
      if (bodyMat) bodyMat.dispose();
      if (lightMat) lightMat.dispose();
      if (bodyMotion) bodyMotion.dispose();
      if (lightMotion) lightMotion.dispose();
      const lights = ctx.get('lights');
      if (lights && searchlight && lights.remove) lights.remove(searchlight);
      group = null;
      bodyMesh = null;
      lightMesh = null;
      bodyMotion = null;
      lightMotion = null;
      searchlight = null;
      fleet.length = 0;
    },
  };
}
