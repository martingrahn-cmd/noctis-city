/**
 * player.js — the first-person controller. CONTRACT §11, session 17.
 *
 * Sixteen sessions produced a city nobody had ever been inside. Every frame
 * came from a fixed shot, a scripted spline or a pose; the eye had never gone
 * anywhere a route had not already decided to go. This module is the fourth
 * thing to move in this world, after the traffic, the crowd and the rain, and
 * it is the first one with somebody behind it.
 *
 * WHAT IT IS NOT, said first, because a controller grows states if nobody
 * writes down that it must not: there is ONE state. No interiors, no vehicle to
 * get into, no crouch, no swim, no jump. Two states are not needed until one is
 * good, and a second state added now would double the surface of everything
 * below before any of it has been walked on.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * COLLISION IS NOT NEW WORK AND THAT IS THE POINT.
 *
 * Session 3 built a walkability mask over the whole city and every run of
 * `citycheck` since has asserted it: connected cells, every landmark reachable
 * on foot, and since session 15 the bridges carrying it across the river. The
 * expensive part — deciding what a person may stand on — was done and gated
 * three years of sessions ago. So this reads `city.walkableAt()`, which is
 * `placement()`'s own four rules evaluated at a point rather than rasterised
 * into a grid, and adds no collision system of its own.
 *
 * It also inherits that mask's gap, which is now a gap you can walk into:
 * **the mask does not know about props.** `citygen.js` scatters 838 bollards,
 * bins and cabinets over a region on the kerb line, `placement()` blocks
 * buildings, landmarks, the origin block and the water, and neither list has
 * ever contained a bollard. You will walk through them. That is recorded in
 * STATE.md rather than patched here, because a second collision system built
 * quietly inside a controller is how the one gated mask stops being the answer.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ONE CLOCK, AND IT IS THE FIFTH THING TO INTEGRATE IT.
 *
 * `time` owns the clock (CONTRACT §3) and `traffic`, `weather` and
 * `streetlife` all advance on the difference of `time.now` rather than on the
 * raw `dt` the loop hands them. Each of the three carries the same comment
 * about why, and the reason is the same here: `dt` is wall-clock seconds and a
 * system integrating it arrives at a given capture in a different state on
 * every run, because nothing in the harness fixes how many wall seconds a
 * warmup takes.
 *
 * So the player integrates `time.now` too, clamped to the same [0, 0.1] the
 * core clamps `dt` to. THE CONSEQUENCE, STATED RATHER THAN DISCOVERED:
 * `?paused=1` freezes the player exactly as it freezes the traffic. You can
 * still look — the mouse delivers a displacement and has no clock in it at all
 * — and you cannot walk. That is what a paused world means.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * OWNERSHIP OF THE CAMERA, AND HANDING IT BACK.
 *
 * `runRoute`, `poseRoute` and `setShotAt` drive every gate and both film tools.
 * This module is a new CONSUMER of `ctx.camera`, not a replacement for them, so
 * the arbitration is one-way and explicit: `camera.setDriven(true)` stops that
 * module writing the camera, every explicit placement still works and emits
 * `camera:placed`, and this module RE-SEATS itself wherever it was put. The
 * harness never loses an argument it did not know it was having.
 *
 * And it is not registered at all unless `?player=1`, so every gate runs with
 * it absent — which is the state `faultcheck` and the six other gates have
 * always run in.
 */

import * as THREE from 'three';
import { PLAYER, RENDER } from '../core/constants.js';
import { GAIT, RUN_TRANSITION_MPS } from '../lib/gait.js';

/** Standard Gamepad mapping indices, so the numbers below are readable. */
const AXIS_LEFT_X = 0;
const AXIS_LEFT_Y = 1;
const AXIS_RIGHT_X = 2;
const AXIS_RIGHT_Y = 3;
const BUTTON_L3 = 10;
const BUTTON_RT = 7;

const DEG = Math.PI / 180;

/** Keys whose default action would scroll the page under a locked pointer. */
const POINTER_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);

/**
 * A radial dead zone with the remaining range rescaled to [0, 1].
 *
 * Returns the pair scaled to the curved magnitude, so the DIRECTION the stick
 * is pushed survives untouched and only its length is reshaped. Curving the two
 * axes independently would bend the diagonal: (1, 1) normalised is (0.707,
 * 0.707), and squaring each component gives (0.5, 0.5) — the same direction by
 * luck, but (1, 0.5) would go to (1, 0.25), which is a different heading from
 * the one the thumb is pushing.
 */
function stick(x, y, deadzone, exponent) {
  const m = Math.hypot(x, y);
  if (!(m > deadzone)) return { x: 0, y: 0, m: 0 };
  const rescaled = Math.min(1, (m - deadzone) / (1 - deadzone));
  const curved = exponent === 1 ? rescaled : Math.pow(rescaled, exponent);
  return { x: (x / m) * curved, y: (y / m) * curved, m: curved };
}

export function createPlayer(options = {}) {
  const cfg = {
    spawn: null,
    ...options,
  };

  /** Feet, in world metres. The eye is this plus `PLAYER.eyeHeightM`. */
  const feet = new THREE.Vector3(PLAYER.spawn[0], 0, PLAYER.spawn[1]);
  let yaw = 0;
  let pitch = 0;
  /** m/s, vertical only. Horizontal motion has no inertia: a walker stops. */
  let fallVel = 0;
  let grounded = true;
  /**
   * THE FEET'S OWN SURFACE RECORD, AND IT IS COPIED INTO RATHER THAN REPLACED.
   *
   * `city.worldSurfaceAt` returns a SHARED scratch object — it is called once
   * per pedestrian per frame and an allocation there is 21 600 objects a
   * second. Holding the returned reference across frames would mean this
   * module's `surface` silently became whichever pedestrian asked last, and the
   * HUD would report the crowd's ground as the player's. Read it now, copy what
   * you keep. Session 19.
   */
  const surface = { y: 0, kind: 'earth', known: false };

  /** Copy the transient world answer into `surface` and return it. */
  function readSurface(ctx, x, z) {
    const s = surfaceAt(ctx, x, z);
    surface.y = s.y;
    surface.kind = s.kind;
    surface.known = s.known;
    return surface;
  }

  /** Pending mouse displacement, in counts. Applied and cleared each update. */
  let mouseDX = 0;
  let mouseDY = 0;
  const keys = new Set();
  let pointerLocked = false;
  /** Set by `pointerlockerror` or a rejected request. See `onLockError`. */
  let lockError = false;
  let padIndex = null;

  /**
   * `'walk'` or `'fly'`. Session 19, and CONTRACT §11 says this module has ONE
   * STATE — so read the argument before adding a third.
   *
   * A FLY MODE IS A CAMERA MODE, NOT A CHARACTER STATE, and the distinction is
   * the whole licence. §11's rule is about the CONTROLLER growing states: a
   * crouch, a swim, a vehicle to get into are each a new set of rules about what
   * the body is, and every one of them doubles the surface of the collision, the
   * ground query and the gait. Fly has NONE of that: there is no body, no
   * ground, no mask, no step height, no fall. It is the same three input numbers
   * — a heading, a magnitude and a look — applied to a free eye instead of to a
   * pair of feet, and it deletes rules rather than adding them.
   *
   * The test that keeps it honest: `walk` and `fly` share every line of the
   * input block below and diverge only where the walk consults the world.
   * If a future session finds itself writing a second collision path, a second
   * ground query or a second gait for `fly`, it has stopped being a camera mode
   * and §11 applies again.
   *
   * IT IS ALSO THE MOST USEFUL DIAGNOSTIC IN THE PROJECT AFTER THE WALK ITSELF.
   * Session 17's argument for the controller was that free movement goes places
   * no route has been; a fly camera goes places no PERSON can, which is where
   * the roofscape, the skyline and every landmark's upper two thirds are — all
   * three of which this session changed and none of which a walker can see.
   */
  let mode = 'walk';

  /** Simulated seconds at the previous update. See the header. */
  let lastNow = null;

  /** Set by `camera:placed`; consumed at the top of the next update. */
  let reseatTo = null;

  /**
   * Synthetic input, for `tools/walkprobe.mjs`. Null unless a probe set it.
   * In the factory's closure and not at module scope, because a module-scope
   * `let` would be shared by every instance the factory ever made — one of
   * which is the harness's, in a test, in a session nobody has had yet.
   */
  let synthetic = null;

  const forward = new THREE.Vector3();
  const rightVec = new THREE.Vector3();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');

  let detachers = [];

  /**
   * WHAT THE FEET ARE STANDING ON AT (x, z) — the maximum over the three
   * modules that emit ground, because the topmost surface is the one you stand
   * on and each of the three is authoritative about its own geometry:
   *
   *   river.js  bridge decks and footways, and the two promenades
   *   block.js  the origin block's street, its 0.160 m pavement, the earth
   *   city.js   the streamed carriageways, pavements, park grass and paths
   *
   * A MAXIMUM AND NOT A PRECEDENCE ORDER, and the difference matters where they
   * overlap. On a bridge, `city.js` leaves its north–south corridor whole and
   * `river.js` lays a deck across it, so both answer: 0.020/0.030 from the city
   * and 0.030/0.060 from the river. The maximum picks the deck, which is what
   * is drawn on top. A precedence order would have to be right about which of
   * the six overlaps is which, and it would be wrong the first time one moved.
   *
   * Every `ctx.get()` here may return undefined — that is what quarantine looks
   * like from the outside (CONTRACT §1.2) — so a missing module removes its
   * surfaces and leaves the others, rather than throwing.
   */
  function surfaceAt(ctx, x, z) {
    /**
     * SESSION 19 — THE MAX-OVER-THREE MOVED TO `city.worldSurfaceAt` AND THIS
     * CALLS IT. The three-line loop that used to be here is unchanged in
     * behaviour and is now in one place instead of two, because session 19 gave
     * the crowd, the stalls and the street furniture the same query and two
     * copies of "which surface am I on" is §9.1's subject with a height. Its
     * failure mode is the one that would be hardest to attribute: the walker
     * standing on one surface and the crowd beside them standing on another, in
     * the same frame, both looking correct.
     *
     * `city` quarantined is a world with no streamed ground in it at all, so
     * the fallback is the origin block alone rather than a second copy of the
     * maximum. There is nothing else to stand on.
     */
    const city = ctx.get('city');
    if (city && city.worldSurfaceAt) return city.worldSurfaceAt(x, z);
    const block = ctx.get('block');
    if (block && block.surfaceAt) return block.surfaceAt(x, z);
    return { y: 0, kind: 'none', known: false };
  }

  /**
   * CAN THE FEET GO THERE — and it is TWO questions, not one.
   *
   *   the mask   does anything stand in the way (buildings, landmarks, the
   *              origin block, the water), padded by the body's own radius
   *   the step   is the surface there more than `PLAYER.stepUpM` above the
   *              surface here
   *
   * The second is what makes `stepUpM` a step height rather than a lift. The
   * first draft had only the mask, and let the ground query snap the feet to
   * whatever height it found afterwards — which walked a person 1.02 m straight
   * up the face of the quay wall and onto its parapet, because the mask blocks
   * the WATER and has never blocked the WALL. Found on foot, in the fourth
   * walk of the session, which is the whole argument for having walked.
   *
   * "Up a kerb and not up a wall" is therefore a comparison made BEFORE the
   * move is committed. Downward is unbounded, because that is a fall and a fall
   * is a thing a quay edge is supposed to do.
   */
  function canStandAt(ctx, x, z, fromY, aheadX, aheadZ) {
    const city = ctx.get('city');
    if (city && city.walkableAt && !city.walkableAt(x, z, PLAYER.radiusM).walkable) return false;
    /**
     * The step is probed a body radius FURTHER ALONG THE DIRECTION OF TRAVEL,
     * for the same reason the mask query carries the radius: a person stops
     * with their body clear of the wall, not with their eye against it.
     *
     * It costs nothing at a kerb and it is the whole thing at a wall. The
     * permission is granted 0.25 m early going up a kerb, and the height the
     * feet actually take still comes from the feet's own position afterwards —
     * so a kerb is climbed where it is and a parapet is refused before it.
     */
    return surfaceAt(ctx, aheadX, aheadZ).y - fromY <= PLAYER.stepUpM;
  }

  /**
   * THE MOVE, AXIS BY AXIS, SO THAT A WALL IS SOMETHING YOU SLIDE ALONG.
   *
   * A single test of the combined displacement stops the player dead the moment
   * either component is blocked, so walking into a facade at 20° off normal
   * stops you rather than turning you along it — and a player who cannot follow
   * a wall cannot follow a street. Two independent tests cost one extra mask
   * query and give the slide for nothing.
   *
   * The order is x then z and it is not symmetric in a corner, where both are
   * refused and the result is the same either way: no movement.
   */
  function moveWithSlide(ctx, dx, dz) {
    const r = PLAYER.radiusM;
    if (dx !== 0 && canStandAt(ctx, feet.x + dx, feet.z, feet.y, feet.x + dx + Math.sign(dx) * r, feet.z)) {
      feet.x += dx;
    }
    if (dz !== 0 && canStandAt(ctx, feet.x, feet.z + dz, feet.y, feet.x, feet.z + dz + Math.sign(dz) * r)) {
      feet.z += dz;
    }
  }

  /**
   * THE SAME MOVE, SPLIT SO THAT NO SINGLE TEST SKIPS OVER A BLOCKER — session
   * 19, and it is the one thing the speed change actually required.
   *
   * `moveWithSlide` tests the DESTINATION, so a displacement larger than the
   * thing in the way steps straight over it: the destination is clear, the
   * origin was clear, and nothing looks at the interval between them. Session 17
   * never had to care, because the whole frame's displacement was
   * `2.00 · dt`, which at 60 fps is 0.033 m.
   *
   * WHAT CHANGED IS NOT THE SPEED, IT IS THE WORST-CASE FRAME. `core/loop.js`
   * clamps `dt` to 0.1 s (CONTRACT §4.2) so a hitched frame delivers a whole
   * tenth of a second at once, and at `runSpeedMps` = 7.00 that is **0.70 m** in
   * one test — 2.8× the body radius, and wider than every landmark ground
   * blocker thinner than a building. A pier is 1.6–2.4 m across, so 0.70 m does
   * not tunnel one today; 0.70 m is nonetheless the first displacement in this
   * project's history that is larger than the body making it, and the failure it
   * invites is a player standing inside a pier with no way to see how they got
   * there.
   *
   * THE SUBSTEP IS `radiusM` AND THAT IS THE DERIVATION: a body of radius r
   * cannot pass through a blocker of thickness ≥ r if it is tested every r, and
   * `PLAYER.radiusM` = 0.25 m is already the quantity every mask query is padded
   * by, so this introduces no second number. Cost, in mask queries per frame:
   *
   *     60 fps, walk 3.50    ceil(0.0583 / 0.25) = 1     (unchanged)
   *     60 fps, run  7.00    ceil(0.1167 / 0.25) = 1     (unchanged)
   *     dt = 0.1, run 7.00   ceil(0.7000 / 0.25) = 3
   *
   * So the normal frame pays exactly what it paid before and only the frame that
   * was already late pays more, which is the right way round.
   *
   * A REFUSED SUBSTEP ENDS THE AXIS RATHER THAN CONTINUING. Sliding along a wall
   * is per-axis and already handled inside `moveWithSlide`; continuing to push a
   * refused axis through further substeps would let a body oscillate into a
   * corner it was refused from, at a cost of two more queries for no motion.
   */
  function moveSubstepped(ctx, dx, dz) {
    const dist = Math.hypot(dx, dz);
    const n = Math.max(1, Math.ceil(dist / PLAYER.radiusM));
    if (n === 1) {
      moveWithSlide(ctx, dx, dz);
      return;
    }
    const sx = dx / n;
    const sz = dz / n;
    for (let i = 0; i < n; i++) {
      const beforeX = feet.x;
      const beforeZ = feet.z;
      moveWithSlide(ctx, sx, sz);
      if (feet.x === beforeX && feet.z === beforeZ) break;
    }
  }

  function readPad() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    if (!pads) return null;
    // Re-acquire every frame rather than caching the object: the Gamepad
    // objects a browser hands back are snapshots, not live handles, and a
    // cached one reports the state it had when it was cached, for ever.
    if (padIndex != null && pads[padIndex] && pads[padIndex].connected) return pads[padIndex];
    for (let i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected) {
        padIndex = i;
        return pads[i];
      }
    }
    padIndex = null;
    return null;
  }

  /**
   * The line that turns a find into a bug report. Printed on `KeyP` and
   * returned by `state()`, and it is a URL rather than three numbers because a
   * position nobody can get back to is a memory.
   */
  function positionLine(ctx) {
    const t = ctx.get('time');
    const p = [feet.x, feet.y, feet.z].map((v) => v.toFixed(2)).join(',');
    const q = [
      `?player=1&spawn=${p}`,
      `t=${t ? t.timeOfDay.toFixed(4) : ctx.config.t}`,
      `seed=${ctx.config.seed}`,
    ].join('&');
    return (
      `[noctis] player at ${p}  yaw ${(yaw / DEG).toFixed(1)}°  pitch ${(pitch / DEG).toFixed(1)}°  ` +
      `on ${surface.kind} at y ${surface.y.toFixed(3)}${surface.known ? '' : ' (STREAMING — no near-ring ground here yet)'}\n` +
      `           ${q}`
    );
  }

  return {
    name: 'player',
    /**
     * A HARD DEPENDENCY, DELIBERATELY, EVEN THOUGH THE CAMERA IS CORE-OWNED.
     *
     * `ctx.camera` exists whatever happens, so this module could drive it with
     * `camera` quarantined. What it could not do is stop `camera.update()`
     * fighting it, because `setDriven` would be gone — and two modules writing
     * one transform in one frame is not a race with a winner, it is a frame
     * that alternates. Quarantining rather than half-working is CONTRACT §2's
     * rule and this is what it is for.
     */
    needs: ['camera'],

    init(ctx) {
      /**
       * `?spawn=x,y,z`. Three numbers, and the y is honoured rather than
       * snapped: standing 20 m up and falling is a legitimate thing to ask a
       * controller to do, and it is how you find out whether the ground under a
       * chunk that has not arrived is the ground you thought it was.
       */
      let spawnY = null;
      const raw = String(cfg.spawn != null ? cfg.spawn : ctx.config.spawn || '').trim();
      if (raw) {
        const n = raw.split(',').map(Number);
        if (n.length >= 2 && n.every((v) => Number.isFinite(v))) {
          if (n.length === 2) {
            feet.set(n[0], 0, n[1]);
          } else {
            feet.set(n[0], n[1], n[2]);
            spawnY = n[1];
          }
        } else {
          ctx.warnOnce('player:spawn', `?spawn=${raw} is not x,y,z — using the default`);
        }
      }

      readSurface(ctx, feet.x, feet.z);
      if (spawnY == null) feet.y = surface.y;

      // Face west, down the main street, which is the direction the `street`
      // shot looks and therefore the view the project is calibrated on.
      yaw = Math.PI / 2;
      pitch = 0;

      const cam = ctx.camera;
      cam.fov = PLAYER.fovDeg;
      cam.updateProjectionMatrix();

      const camApi = ctx.get('camera');
      if (camApi && camApi.setDriven) camApi.setDriven(true);

      /**
       * Re-seat wherever an explicit placement put the camera. `runRoute` emits
       * this 1800 times a run, so the work has to be nothing but three numbers
       * — which it is; the actual re-seat happens once, at the top of the next
       * update, however many placements arrived in between.
       */
      detachers.push(
        ctx.on('camera:placed', (e) => {
          reseatTo = e && e.position ? e.position.slice() : null;
        })
      );

      const dom = ctx.renderer.domElement;

      const onKeyDown = (e) => {
        keys.add(e.code);
        if (e.code === 'KeyP') console.log(positionLine(ctx));
        if (e.code === 'KeyF') {
          mode = mode === 'walk' ? 'fly' : 'walk';
          fallVel = 0;
          // Say which mode is active, every time, because a mode you cannot see
          // is a mode you will fight. The brief asked for this line by name.
          console.log(
            `[noctis] player mode: ${mode.toUpperCase()} — ` +
            (mode === 'fly'
              ? `${PLAYER.flySpeedMps} m/s, ${PLAYER.flySpeedMps * PLAYER.flyBoost} m/s with shift; ` +
                'Space/Ctrl for up and down; no collision and no ground. F for walk.'
              : `${PLAYER.walkSpeedMps} m/s, ${PLAYER.runSpeedMps} m/s with shift; ` +
                'the walkability mask and the ground query are back. F for fly.')
          );
        }
        // WASD and the space bar scroll the page otherwise, and a controller
        // whose forward key also scrolls is a controller nobody can use.
        if (POINTER_KEYS.has(e.code) && pointerLocked) e.preventDefault();
      };
      const onKeyUp = (e) => keys.delete(e.code);
      const onBlur = () => keys.clear();
      const onMouseMove = (e) => {
        if (!pointerLocked) return;
        mouseDX += e.movementX || 0;
        mouseDY += e.movementY || 0;
      };
      const onLockChange = () => {
        pointerLocked = document.pointerLockElement === dom;
        if (!pointerLocked) keys.clear();
      };
      /**
       * A FAILED LOCK MUST NOT BE SILENT — session 18.
       *
       * Session 17 requested the lock and never asked whether it arrived, so
       * the two states "the mouse is not wired up" and "the browser refused the
       * lock" produced the same frame and the same silence: a view that does
       * not turn. Session 18 could not reproduce the reported failure on this
       * machine (measured: lock acquired, yaw moved at the derived rate), which
       * is exactly the case where the instrument matters more than the fix —
       * whatever refused, it refused somewhere this session cannot stand.
       *
       * `lockError` is on `state()`, so the HUD and `inputcheck` both see it.
       */
      const onLockError = () => {
        lockError = true;
        ctx.warnOnce(
          'player:pointerlock',
          'the browser refused pointer lock on the canvas — mouse look is unavailable. ' +
          'The keyboard and the gamepad are unaffected; only the mouse needs the lock.'
        );
      };
      const onClick = () => {
        if (pointerLocked || !dom.requestPointerLock) return;
        lockError = false;
        // Chrome returns a promise here and Safari does not, so the rejection
        // has to be handled both ways or one browser reports nothing.
        const r = dom.requestPointerLock();
        if (r && typeof r.catch === 'function') r.catch(onLockError);
      };

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', onBlur);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('pointerlockchange', onLockChange);
      document.addEventListener('pointerlockerror', onLockError);
      dom.addEventListener('click', onClick);
      detachers.push(() => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('pointerlockchange', onLockChange);
        document.removeEventListener('pointerlockerror', onLockError);
        dom.removeEventListener('click', onClick);
      });

      /**
       * CONTRACT §9 rule 4: when a number is derived from another, print both,
       * at the moment of derivation, in the same line. Four of the six numbers
       * in this module are derived from numbers in another file.
       */
      /**
       * The near-plane corner AT THE FIELD ACTUALLY SET, not at the field the
       * constant's comment was written for. Session 18 widened the fov and this
       * bound moves with it (`PLAYER.radiusM`), so it is computed here from
       * `cam` rather than quoted — a quoted 0.138 would have gone stale in the
       * same edit that made it wrong.
       */
      const halfH = cam.near * Math.tan((cam.fov * DEG) / 2);
      const corner = Math.hypot(cam.near, halfH, halfH * cam.aspect);
      /**
       * Degrees of heading per pixel at the LIVE field and the internal
       * resolution, which is the unit both of `lookCurveExponent`'s bounds and
       * `mouseCmPer360`'s lower bound are stated in.
       */
      const degPerPx =
        (2 * Math.atan(Math.tan((cam.fov * DEG) / 2) * cam.aspect)) / DEG / RENDER.internalWidth;
      /** Optic flow at the bottom edge of the frame — see `PLAYER.fovDeg`. */
      const flowDegPerS = (v, fovDeg) => {
        const d = PLAYER.eyeHeightM / Math.tan((fovDeg * DEG) / 2);
        return ((v * PLAYER.eyeHeightM) / (PLAYER.eyeHeightM ** 2 + d * d)) / DEG;
      };
      /**
       * `CITY.chunkSize` and `RIVER.bridgeEvery` live in `src/lib/citygen.js`,
       * which this module may not reach through — §2.2 allows `../lib/**` and
       * `citygen.js` is a lib, but importing the whole city generator into the
       * controller to print two integers is the wrong trade. They are quoted
       * with their source instead, and the quantity DERIVED from them (the
       * crossing time) is what gets printed — §9 rule 4 asks for the pair, and
       * the pair here is "512 m" and "how long that takes at this constant".
       */
      const BRIDGE_SPACING_M = 512; // citygen.js: RIVER.bridgeEvery(4) · CITY.chunkSize(128)
      const CHUNK_M = 128; // citygen.js: CITY.chunkSize
      console.log(
        `[noctis] player: eye ${PLAYER.eyeHeightM} m, walk ${PLAYER.walkSpeedMps} m/s ` +
        `(= PLAYER.walkSpeedMps, a TRAVERSAL rate — ${(PLAYER.walkSpeedMps / GAIT.walkSpeedMps).toFixed(2)}× ` +
        `GAIT.walkSpeedMps ${GAIT.walkSpeedMps} m/s, which is the crowd's gait model and is NOT this number; ` +
        `${(PLAYER.walkSpeedMps / RUN_TRANSITION_MPS).toFixed(2)}× the ${RUN_TRANSITION_MPS.toFixed(3)} m/s ` +
        `walk–run transition, so it is NOT a walk by this project's own biomechanics — session 19 ` +
        `removed that bound deliberately because nothing is derived from this number), ` +
        `run ${PLAYER.runSpeedMps} m/s (= ${(PLAYER.runSpeedMps / GAIT.walkSpeedMps).toFixed(2)}× the crowd, ` +
        `${(PLAYER.runSpeedMps / RUN_TRANSITION_MPS).toFixed(2)}× the transition, ` +
        `${(PLAYER.runSpeedMps / PLAYER.walkSpeedMps).toFixed(2)}× the walk), ` +
        `step ${PLAYER.stepUpM} m, ` +
        `radius ${PLAYER.radiusM} m (near-plane corner at fov ${cam.fov} is ${corner.toFixed(4)} m, ` +
        `${(PLAYER.radiusM / corner).toFixed(3)}× clear)`
      );
      /**
       * THE NUMBER THE SPEED WAS CHANGED FOR, printed against the world rather
       * than against a gait model — because "2.50× the crowd" is the cost and
       * "how long to the next bridge" is the reason.
       */
      console.log(
        `[noctis] player scale: a ${CHUNK_M} m chunk takes ` +
        `${(CHUNK_M / PLAYER.walkSpeedMps).toFixed(1)} s walking / ` +
        `${(CHUNK_M / PLAYER.runSpeedMps).toFixed(1)} s running; ` +
        `${BRIDGE_SPACING_M} m bridge to bridge takes ` +
        `${(BRIDGE_SPACING_M / PLAYER.walkSpeedMps / 60).toFixed(2)} min / ` +
        `${(BRIDGE_SPACING_M / PLAYER.runSpeedMps / 60).toFixed(2)} min ` +
        `(it was ${(BRIDGE_SPACING_M / 2.0 / 60).toFixed(2)} min at session 18's 2.00 m/s). ` +
        `Collision substeps at the loop's clamped dt=0.1 s: ` +
        `${Math.max(1, Math.ceil((PLAYER.runSpeedMps * 0.1) / PLAYER.radiusM))} ` +
        `(1 at 60 fps — see moveSubstepped)`
      );
      console.log(
        `[noctis] player fov ${cam.fov}° (the ROUTES are unchanged at 50–58; every gate sets its own). ` +
        `Ground point at the bottom edge sits at ${(PLAYER.eyeHeightM / Math.tan((cam.fov * DEG) / 2)).toFixed(2)} m, ` +
        `so walking at ${PLAYER.walkSpeedMps} m/s flows ${flowDegPerS(PLAYER.walkSpeedMps, cam.fov).toFixed(2)}°/s ` +
        `against ${flowDegPerS(GAIT.walkSpeedMps, 50).toFixed(2)}°/s for 1.40 m/s at fov 50 — ` +
        `${(flowDegPerS(PLAYER.walkSpeedMps, cam.fov) / flowDegPerS(GAIT.walkSpeedMps, 50)).toFixed(2)}× the apparent pace, ` +
        `of which ${(flowDegPerS(GAIT.walkSpeedMps, cam.fov) / flowDegPerS(GAIT.walkSpeedMps, 50)).toFixed(2)}× is the FIELD ` +
        `and ${(PLAYER.walkSpeedMps / GAIT.walkSpeedMps).toFixed(2)}× is the SPEED. The two are recorded ` +
        `separately because they were measured separately.`
      );
      console.log(
        `[noctis] player input: move deadzone ${PLAYER.stickDeadzoneMove.toFixed(4)} ` +
        `(XInput 7849/32767), look deadzone ${PLAYER.stickDeadzoneLook.toFixed(4)} (8689/32767), ` +
        `look curve m^${PLAYER.lookCurveExponent} at ${PLAYER.maxLookRateDegPerS}°/s ` +
        `(half deflection = ${(PLAYER.maxLookRateDegPerS * Math.pow(0.5, PLAYER.lookCurveExponent) / 60).toFixed(2)}°/frame ≤ 1.00, ` +
        // DEGREES PER PIXEL AT THE LIVE FIELD, not the 0.031 of fov 50 this
        // line divided by until session 18. `lookCurveExponent`'s upper bound
        // is stated in PIXELS, so printing it against a stale pixel size is
        // printing a bound that is not the one in force — the same staleness
        // the constant itself carried, two lines apart, one fixed and one not.
        `0.1 deflection = ${(PLAYER.maxLookRateDegPerS * Math.pow(0.1, PLAYER.lookCurveExponent) / 60 / degPerPx).toFixed(2)} px/frame ≥ 1.00 ` +
        `at ${degPerPx.toFixed(4)}°/px, fov ${cam.fov}), ` +
        `mouse ${PLAYER.mouseCmPer360} cm/360° at ${PLAYER.mouseCpi} cpi = ` +
        `${(PLAYER.mouseRadPerCount / DEG).toFixed(5)}°/count`
      );
      console.log(
        `[noctis] player mode: WALK (F toggles walk/fly — fly is ${PLAYER.flySpeedMps} m/s, ` +
        `${PLAYER.flySpeedMps * PLAYER.flyBoost} m/s boosted, Space/Ctrl for up and down, no collision). ` +
        'Both modes come from the same URL; the mode is not a query parameter, because it is a thing ' +
        'you change while looking at something rather than a thing you decide before the page loads.'
      );
      console.log(`[noctis] player spawned — click to capture the mouse, P prints the position, M opens the map`);

      return {
        get position() {
          return feet.clone();
        },
        get eye() {
          return new THREE.Vector3(feet.x, feet.y + PLAYER.eyeHeightM, feet.z);
        },
        /** Everything a HUD, a probe or a bug report needs. No verdicts. */
        state: () => ({
          position: [+feet.x.toFixed(3), +feet.y.toFixed(3), +feet.z.toFixed(3)],
          yawDeg: +(yaw / DEG).toFixed(2),
          pitchDeg: +(pitch / DEG).toFixed(2),
          surface: surface.kind,
          surfaceY: +surface.y.toFixed(4),
          surfaceKnown: surface.known,
          grounded,
          fallVel: +fallVel.toFixed(3),
          /** `'walk'` or `'fly'`. Session 19. See `mode`. */
          mode,
          gamepad: padIndex != null,
          pointerLocked,
          lockError,
          /**
           * THE DELIVERED RESPONSE PER UNIT INPUT, session 18, and it is on
           * `state()` rather than computed by a caller for the reason CONTRACT
           * §9.1 gives about `stats().minExtentM`: a test that recomputed these
           * from the constants would compare two declarations and verify
           * neither. These are what `update()` will actually use this frame.
           */
          walkSpeedMps: PLAYER.walkSpeedMps,
          runSpeedMps: PLAYER.runSpeedMps,
          fovDeg: ctx.camera ? ctx.camera.fov : null,
          mouseDegPerCount: (PLAYER.mouseRadPerCount / DEG),
          padDegPerSec: PLAYER.maxLookRateDegPerS,
        }),
        line: () => positionLine(ctx),
        /**
         * Put the player somewhere. For probes and for the console; nothing in
         * a gate may call it, for the reason CONTRACT §8 gives about
         * `setShotAt` — a gate whose subject the operator places measures the
         * operator.
         */
        teleport: (x, y, z, yawDeg) => {
          feet.set(x, y != null ? y : 0, z);
          readSurface(ctx, feet.x, feet.z);
          if (y == null) feet.y = surface.y;
          if (yawDeg != null) yaw = yawDeg * DEG;
          fallVel = 0;
          /**
           * THE TAA HISTORY IS A DESCRIPTION OF A DIFFERENT WORLD NOW — session
           * 19, and STATE 18 §7.6 recorded this as the one missing piece before
           * the map existed to expose it.
           *
           * CONTRACT §5.10: history is dropped on resize, on a discontinuous
           * `timeOfDay`, and "by `post.resetHistory()` for anything else that
           * makes the previous frame a description of a different world". A
           * teleport is the plainest case of that sentence there is, and it was
           * the one caller that did not do it — the camera reprojection would
           * fetch a history texel from six hundred metres away, the
           * neighbourhood clamp would reject nearly all of it, and the first
           * frames after a jump would resolve from almost no accumulation.
           *
           * Cheap and unconditional: a teleport happens when a person clicks a
           * map, not sixty times a second.
           */
          const post = ctx.get('post');
          if (post && post.resetHistory) post.resetHistory();
          return true;
        },
        /**
         * Synthetic input, for `tools/walkprobe.mjs`. A probe that drove the
         * camera directly would be measuring a spline again; this drives the
         * same three numbers a thumb does, through the same dead zone, the same
         * curve, the same mask and the same ground query.
         */
        setSynthetic: (v) => {
          synthetic = v ? { moveX: 0, moveY: 0, lookX: 0, lookY: 0, run: false, ...v } : null;
          return !!synthetic;
        },
      };
    },

    update(ctx, dtWall) {
      /**
       * ADVANCE ON THE SIMULATED CLOCK, NOT ON `dtWall`. The same four lines
       * `traffic.js`, `weather.js` and `streetlife.js` each carry, for the same
       * reason, and this is the fifth thing in the project to integrate that
       * clock. See the header.
       */
      const time = ctx.get('time');
      const dt = time
        ? (lastNow == null ? 0 : Math.min(0.1, Math.max(0, time.now - lastNow)))
        : dtWall;
      if (time) lastNow = time.now;

      const cam = ctx.camera;

      // An explicit placement wins, always, and this is where it lands.
      if (reseatTo) {
        feet.set(reseatTo[0], reseatTo[1] - PLAYER.eyeHeightM, reseatTo[2]);
        euler.setFromQuaternion(cam.quaternion, 'YXZ');
        yaw = euler.y;
        pitch = euler.x;
        fallVel = 0;
        reseatTo = null;
        readSurface(ctx, feet.x, feet.z);
      }

      // --- input ------------------------------------------------------------

      let moveX = 0;
      let moveY = 0;
      let lookX = 0;
      let lookY = 0;
      let run = keys.has('ShiftLeft') || keys.has('ShiftRight');

      const pad = readPad();
      if (pad) {
        const a = pad.axes || [];
        // Gamepad Y is positive DOWN on both sticks, which is why both are
        // negated here rather than only the look one.
        const mv = stick(
          a[AXIS_LEFT_X] || 0,
          -(a[AXIS_LEFT_Y] || 0),
          PLAYER.stickDeadzoneMove,
          1
        );
        const lk = stick(
          a[AXIS_RIGHT_X] || 0,
          -(a[AXIS_RIGHT_Y] || 0),
          PLAYER.stickDeadzoneLook,
          PLAYER.lookCurveExponent
        );
        moveX = mv.x;
        moveY = mv.y;
        lookX = lk.x;
        lookY = lk.y;
        const b = pad.buttons || [];
        const pressed = (i) => !!(b[i] && (b[i].pressed || b[i].value > 0.5));
        if (pressed(BUTTON_L3) || pressed(BUTTON_RT)) run = true;
      }

      // Keyboard, added to the pad rather than instead of it, so a pad plugged
      // in halfway through does not silently disable the keys.
      let kx = 0;
      let ky = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) ky += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) ky -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) kx += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) kx -= 1;
      if (kx || ky) {
        // A key is a boolean, so its magnitude is 1 and the diagonal has to be
        // normalised or W+D walks 41% faster than W.
        const m = Math.hypot(kx, ky);
        moveX += kx / m;
        moveY += ky / m;
      }

      if (synthetic) {
        moveX += synthetic.moveX;
        moveY += synthetic.moveY;
        lookX += synthetic.lookX;
        lookY += synthetic.lookY;
        if (synthetic.run) run = true;
      }

      const moveMag = Math.min(1, Math.hypot(moveX, moveY));

      // --- look -------------------------------------------------------------

      // The mouse delivers a DISPLACEMENT and has no clock in it, which is why
      // it still works with the world paused.
      yaw -= mouseDX * PLAYER.mouseRadPerCount;
      pitch -= mouseDY * PLAYER.mouseRadPerCount;
      mouseDX = 0;
      mouseDY = 0;

      // The stick delivers a RATE and integrates the same clock everything else
      // does — so a paused world does not turn.
      const rate = PLAYER.maxLookRateDegPerS * DEG * dt;
      yaw -= lookX * rate;
      pitch += lookY * rate;
      pitch = Math.max(-PLAYER.maxPitchRad, Math.min(PLAYER.maxPitchRad, pitch));

      // --- walk -------------------------------------------------------------

      /**
       * FLY — the whole of the second mode, and it is deliberately shorter than
       * the walk it replaces rather than longer.
       *
       * It shares the input block above verbatim: the same dead zone, the same
       * curve, the same keyboard normalisation, the same look. What it does not
       * share is everything the walk needs the WORLD for — `canStandAt`, the
       * mask, the substep, the step height, the fall — because a camera has no
       * body to keep out of a wall. That asymmetry is the argument for calling
       * this a camera mode rather than a second character state; see `mode`.
       *
       * THE FORWARD VECTOR INCLUDES PITCH HERE AND NOT IN THE WALK. A walker
       * looking at a roofline does not rise, which is why the walk builds its
       * forward from `yaw` alone; a fly camera looking at a roofline flies
       * toward it, which is the one thing it exists for.
       *
       * Vertical is on Space and Ctrl, absolute rather than camera-relative, so
       * "up" is up whatever the eye is pointed at — the property that makes a
       * fly camera usable for framing a shot rather than only for travelling.
       */
      if (mode === 'fly') {
        const fast = run ? PLAYER.flyBoost : 1;
        const step = PLAYER.flySpeedMps * fast * dt;
        if (moveMag > 0 && dt > 0) {
          const mag = Math.hypot(moveX, moveY);
          const dirX = moveX / mag;
          const dirY = moveY / mag;
          const cp = Math.cos(pitch);
          forward.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
          rightVec.set(Math.cos(yaw), 0, -Math.sin(yaw));
          feet.x += (forward.x * dirY + rightVec.x * dirX) * step * moveMag;
          feet.y += forward.y * dirY * step * moveMag;
          feet.z += (forward.z * dirY + rightVec.z * dirX) * step * moveMag;
        }
        let lift = 0;
        if (keys.has('Space')) lift += 1;
        if (keys.has('ControlLeft') || keys.has('ControlRight')) lift -= 1;
        if (pad) {
          const b = pad.buttons || [];
          const held = (i) => !!(b[i] && (b[i].pressed || b[i].value > 0.5));
          if (held(0)) lift += 1;
          if (held(1)) lift -= 1;
        }
        feet.y += lift * step;
        grounded = false;
        fallVel = 0;
        // The surface under the eye is still reported, because "what am I over"
        // is the question a fly camera is usually being used to answer.
        readSurface(ctx, feet.x, feet.z);
        cam.position.set(feet.x, feet.y + PLAYER.eyeHeightM, feet.z);
        cam.up.set(0, 1, 0);
        euler.set(pitch, yaw, 0, 'YXZ');
        cam.quaternion.setFromEuler(euler);
        cam.updateMatrixWorld(true);
        return;
      }

      if (moveMag > 0 && dt > 0) {
        // Direction and magnitude are separated, because the pad and the keys
        // are SUMMED above and their sum can exceed 1. Normalising the
        // direction and clamping the magnitude keeps "which way" and "how fast"
        // independent; scaling the pair together would let a pad plus a key
        // walk at 2.8 m/s, which is a run nobody asked for.
        const mag = Math.hypot(moveX, moveY);
        const dirX = moveX / mag;
        const dirY = moveY / mag;
        // `PLAYER.walkSpeedMps`, NOT `GAIT.walkSpeedMps`. Session 18: the two
        // are different quantities and the constant says why — one is an input
        // to the crowd's biomechanical model, this one is a traversal rate with
        // no gait attached. The ratio between them is printed at init.
        const step = (run ? PLAYER.runSpeedMps : PLAYER.walkSpeedMps) * moveMag * dt;
        // Horizontal only. A walker looking at a roofline does not rise.
        forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
        rightVec.set(Math.cos(yaw), 0, -Math.sin(yaw));
        moveSubstepped(
          ctx,
          (forward.x * dirY + rightVec.x * dirX) * step,
          (forward.z * dirY + rightVec.z * dirX) * step
        );
      }

      // --- ground -----------------------------------------------------------

      readSurface(ctx, feet.x, feet.z);
      const target = surface.y;
      const rise = target - feet.y;

      if (rise > 0 && rise <= PLAYER.stepUpM) {
        // A kerb. Snapped rather than interpolated: a 0.010 m rise smoothed
        // over three frames is a 0.010 m rise nobody can see, and a 0.160 m one
        // smoothed is a lift.
        feet.y = target;
        fallVel = 0;
        grounded = true;
      } else if (rise > PLAYER.stepUpM) {
        /**
         * UNREACHABLE BY WALKING, and that is the assertion rather than the
         * comment: `canStandAt` refuses any move onto a surface more than
         * `stepUpM` above this one, so the only ways here are `?spawn=` inside
         * geometry and `teleport()`. Both are the operator's, so the answer is
         * to lift them out and say so once rather than to trap them.
         */
        feet.y = target;
        fallVel = 0;
        grounded = true;
        ctx.warnOnce(
          'player:bigstep',
          `player was inside geometry: lifted ${rise.toFixed(3)} m at ` +
          `${feet.x.toFixed(1)},${feet.z.toFixed(1)} — over the ${PLAYER.stepUpM} m step height, ` +
          `so this was a spawn or a teleport into something solid, not a walk`
        );
      } else if (feet.y - target > 1e-4) {
        // Falling. A quay edge behaves like a quay edge.
        fallVel -= PLAYER.gravityMps2 * dt;
        feet.y += fallVel * dt;
        grounded = false;
        if (feet.y <= target) {
          feet.y = target;
          fallVel = 0;
          grounded = true;
        }
      } else {
        feet.y = target;
        fallVel = 0;
        grounded = true;
      }

      // --- the camera -------------------------------------------------------

      cam.position.set(feet.x, feet.y + PLAYER.eyeHeightM, feet.z);
      cam.up.set(0, 1, 0);
      euler.set(pitch, yaw, 0, 'YXZ');
      cam.quaternion.setFromEuler(euler);
      cam.updateMatrixWorld(true);
    },

    dispose(ctx) {
      for (const off of detachers) {
        try {
          off();
        } catch {
          /* a listener that will not detach must not stop the others */
        }
      }
      detachers = [];
      const camApi = ctx.get('camera');
      if (camApi && camApi.setDriven) camApi.setDriven(false);
      if (typeof document !== 'undefined' && document.pointerLockElement && document.exitPointerLock) {
        document.exitPointerLock();
      }
    },
  };
}
