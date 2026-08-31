/**
 * camera.js — named shots, and enough free-look to judge the lighting by eye.
 *
 * The gate renders one fixed placement at four times of day, so the four frames
 * differ only by the sun. Any other shot in here is for looking, not for
 * asserting — a gate whose camera moves is measuring two things at once.
 */

import * as THREE from 'three';
import { GROUND } from '../core/constants.js';
// CONTRACT §2.2: a module may import `../lib/**`. This one line is what makes
// the comment in ROUTES.player true — see `speed` below.
import { GAIT } from '../lib/gait.js';

const SHOTS = {
  /**
   * The session-1 gate shot. Standing in the roadway east of the intersection,
   * looking west down the street.
   *
   * The street runs east-west (CONTRACT §3.1), so this one placement gets the
   * sun from the far end at dusk and from behind the shoulder at dawn — the
   * two frames are different because the sky is, not because the camera moved.
   */
  street: {
    // Standing in the roadway at the east end of the block, looking west.
    // Placed so the nearest buildings sit just outside the frame edges and
    // enter it as they recede — a camera pressed against one wall shows one
    // wall, which is what the first version of this shot did.
    position: [70, 1.74, 0.9],
    target: [-104, 17.5, -1.4],
    fov: 50,
  },
  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * THE SECOND EYE — SESSION 59, AND IT IS THE FIRST GATE CAMERA IN THIS
   * PROJECT'S HISTORY THAT STANDS IN THE CITY THE GENERATOR BUILDS.
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * `street` above stands at (70, 1.74, 0.9) and `BLOCK_KEEPOUT` is
   * x ∈ [−168, 168], z ∈ [−46, 46] — so every frame the look gate has graded
   * for twenty-three sessions is inside the ORIGIN BLOCK, which `block.js`
   * authors and out of which the streamed generator is clipped. Session 35
   * noticed and session 58 measured it; this closes it.
   *
   * WHAT THE OLD EYE CANNOT SEE, MEASURED BY POSITIVE CONTROL. The same pose
   * rendered at `?fill=1.0` and `?fill=0.0` — the two extremes of the
   * frontage-fill law, a 60% swing in the city's building population — differs
   * in **2.74% of its pixels at midnight and 4.66% at noon** (above 2 code
   * values), and its mean green moves by **0.05 and 0.03 of 255**. That is the
   * whole of what the generator owns in the gate's frame.
   *
   * WHERE THIS ONE STANDS. A north–south street in chunk (−3, 3), which
   * carries eleven trades of five kinds — the densest trading frontage near
   * the origin. Chosen by `tools/poseprobe.mjs --target=-270,3.4,394
   * --eye=1.7 --dmin=104 --dmax=104`, which ray-tests candidate stand-offs
   * against the 1 146 delivered building occluders and reported this azimuth
   * (280°) among nine clear of nine-and-thirty tested. The pose the session
   * had used by eye — 270° — is NOT in the clear list, which is the tool
   * earning its place.
   *
   * FOV 50 IS THE ORIGIN SHOT'S, deliberately: two eyes that differ in field
   * of view differ in how much sky they carry, and sky is most of what a mean
   * luminance band measures. The one thing that must differ between these two
   * cameras is WHERE THEY STAND.
   */
  trade: {
    position: [-251.94, 1.7, 291.58],
    target: [-270, 3.4, 394],
    fov: 50,
  },

  /** For looking at the block as a whole while iterating. Not gated. */
  elevated: {
    position: [104, 33, 48],
    target: [-40, 12, -2],
    fov: 46,
  },
  /** Straight up the cross street, to check the light from another axis. */
  cross: {
    position: [-1.5, 1.68, 62],
    target: [2, 16, -60],
    fov: 50,
  },
};

/**
 * Scripted routes — the thing `perfcheck` measures. CONTRACT §8.
 *
 * A route is a path, a speed, a time of day and a wetness. The camera follows a
 * Catmull-Rom spline through the waypoints and looks along the tangent, so the
 * frame is always moving forward through the world and the streaming system is
 * always being asked for chunks it does not have yet. A perf route that stands
 * still measures a screenshot.
 *
 * The three names are the ones `budget.json` has had since session 0, and each
 * exists to make a different thing expensive:
 *
 *   downtown_dense  walking pace at night through the densest part of the city.
 *                   Maximum local lights, maximum overlapping froxels, minimum
 *                   distance so nothing is culled by range.
 *   highway_speed   24 m/s along the arterial. Nothing about the shading is
 *                   hard; the streaming is. At this speed a 128 m chunk crosses
 *                   the horizon every five seconds.
 *   night_rain      walking pace at night with standing water. Everything
 *                   downtown_dense does, plus the screen-space reflection march
 *                   on a third of the frame.
 *
 * The paths are authored in world metres and run well past the origin block, so
 * they are the same paths before and after the city exists around it. What
 * changes between those two measurements is the content, which is the point.
 */
const ROUTES = {
  downtown_dense: {
    t: 0.0,
    wet: 0,
    fov: 55,
    /** Metres per second. A brisk walk. */
    speed: 4.5,
    eye: 1.74,
    waypoints: [
      [330, 0, 2.5],
      [150, 0, 1.0],
      [40, 0, -1.5],
      [-60, 0, 1.5],
      [-170, 0, -2.0],
      [-300, 0, 0.5],
    ],
  },
  highway_speed: {
    t: 0.5,
    wet: 0,
    fov: 60,
    speed: 24,
    eye: 2.2,
    waypoints: [
      [640, 0, 3.0],
      [340, 0, 0.0],
      [60, 0, 2.0],
      [-220, 0, -1.0],
      [-520, 0, 2.0],
      [-820, 0, 0.0],
    ],
  },
  night_rain: {
    t: 0.0,
    wet: 0.85,
    fov: 55,
    speed: 6,
    eye: 1.74,
    waypoints: [
      [300, 0, -2.0],
      [140, 0, 1.5],
      [10, 0, -1.0],
      [-120, 0, 2.0],
      [-260, 0, -1.5],
      [-400, 0, 1.0],
    ],
  },

  /**
   * SESSION 17. THE FOURTH ROUTE, AND THE FIRST ONE AT A PERSON'S PACE.
   *
   * The three above are camera speeds. `downtown_dense` calls 4.5 m/s "a brisk
   * walk" and 4.5 m/s is 16.2 km/h — a run, and 3.2× the 1.40 m/s
   * `GAIT.walkSpeedMps` the crowd in the same frame is walking at. So every
   * millisecond this project has ever measured was measured from something
   * moving through the city faster than anything in the city moves, and the
   * one thing a player does — walk — has never been on the instrument.
   *
   * FOUR THINGS DIFFER FROM `downtown_dense`, AND ALL FOUR ARE THE PLAYER:
   *
   *   speed  1.40 m/s, `GAIT.walkSpeedMps`, READ from the lib the pedestrians
   *          read — and it was a hard literal `1.4` under this exact sentence
   *          until session 18, in a file whose only import was `three`. A
   *          comment that claims a link names the file the link is in
   *          (§9.1), so the import is now there and the literal is gone.
   *          The camera is the median pedestrian by construction.
   *
   *          IT IS NOT `PLAYER.walkSpeedMps` = 2.00 m/s, and that is
   *          deliberate: this route exists to measure the city AT THE CROWD'S
   *          OWN PACE, which is the thing sixteen sessions of routes at 4.5 to
   *          24 m/s never did. The player's traversal rate is a separate
   *          quantity for a separate purpose (`constants.js` → PLAYER
   *          .walkSpeedMps says why), and a route that tracked it would stop
   *          being comparable with the run that produced STATE 17 §4.
   *   z      +9.7, the SOUTH PAVEMENT rather than the crown of the road. The
   *          pavement is z ∈ [7.5, 11.7] (`CITY.roadHalfWidth` 7.5 to
   *          `CORRIDOR` 11.7) and the path wanders ±0.7 m inside it, which is
   *          what a person walking does and what a spline down the centreline
   *          cannot show: at 9.7 the facade is 2.0 m away instead of 11.7, so
   *          the near ring is being asked for the geometry it is worst at.
   *   eye    THE PAVEMENT'S OWN TOP PLUS 1.74 m, and session 19 moved the
   *          pavement rather than the eye. It was the literal `1.77` = the old
   *          streamed pavement (0.030) plus the 1.74 m eye every other route
   *          and every `lookat` preset in the project stands at. Declaring the
   *          ground datum (`constants.js` → `GROUND`) put the pavement at
   *          `BLOCK.kerbHeight`, so 1.77 absolute would now be **1.61 m above
   *          the footway** — the route would have measured the city from a
   *          height nobody chose, and the change that did it is in another
   *          file. It is `GROUND.pavement + 1.74` = **1.90**, expressed rather
   *          than transcribed so the next datum move carries it.
   *
   *          The other three routes set 1.74 ABSOLUTE, which over a carriageway
   *          now at exactly 0 is 1.74 m of actual eye height — the 2 cm this
   *          note used to record is gone, because that carriageway WAS the
   *          0.020 the datum removed.
   *
   *          THE CONSEQUENCE FOR THE GATE, SAID PLAINLY: this route's frames
   *          move. The camera is 0.13 m higher above its own footway than the
   *          number it replaces would have delivered, and identical to what
   *          session 17 and 18 measured relative to the pavement. Comparability
   *          is with the ROUTE'S DEFINITION, not with the literal.
   *   look   `lookRise: 0`. See `setRouteAt` — the other three aim 0.9 m above
   *          the eye at the look-ahead point, which at this route's own
   *          6.3 m look-ahead is atan(0.9/6.3) = 8.1° of upward pitch and would
   *          spend 8.1° × 1440 rows / 50° = 233 rows of a 1440-row frame on sky
   *          that a walking person is not looking at. A walker's gaze is level.
   *
   * `t` and `wet` are `downtown_dense`'s exactly (0.0 dry), so the two routes
   * differ in pace and in position and in nothing else, and the difference
   * between their numbers is attributable. That is the same discipline
   * CONTRACT §6 asks of an A/B arm.
   */
  player: {
    t: 0.0,
    wet: 0,
    /**
     * 50°, which is `ctx.camera`'s own default and the `street` shot's, and is
     * therefore the field every look frame this project has ever judged was
     * judged at. The three routes above use 55 and 60 — a wider field, which
     * puts MORE of the world in frame and fewer pixels on each part of it. At
     * 50 the near facade 2.0 m away covers more of the frame than it would at
     * 55, so this is the stricter choice per pixel and the looser one per
     * instance; both directions are in the measurement rather than argued.
     */
    fov: 50,
    speed: GAIT.walkSpeedMps,
    /** `GROUND.pavement` + the project's 1.74 m eye. See the note above. */
    eye: GROUND.pavement + 1.74,
    lookRise: 0,
    waypoints: [
      [330, 0, 9.7],
      [270, 0, 10.2],
      [210, 0, 9.2],
      [150, 0, 10.1],
      [90, 0, 9.4],
      [30, 0, 10.0],
      [-30, 0, 9.6],
      [-90, 0, 10.2],
      [-150, 0, 9.3],
      [-210, 0, 10.0],
      [-300, 0, 9.7],
    ],
  },
};

/** Catmull-Rom through the waypoints, clamped at the ends. */
function splineAt(pts, u) {
  const n = pts.length;
  const s = Math.max(0, Math.min(0.999999, u)) * (n - 1);
  const i = Math.floor(s);
  const f = s - i;
  const p = (k) => pts[Math.max(0, Math.min(n - 1, k))];
  const p0 = p(i - 1);
  const p1 = p(i);
  const p2 = p(i + 1);
  const p3 = p(i + 2);
  const f2 = f * f;
  const f3 = f2 * f;
  const out = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    out[c] =
      0.5 *
      ((2 * p1[c]) +
        (-p0[c] + p2[c]) * f +
        (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * f2 +
        (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * f3);
  }
  return out;
}

export function createCamera(options = {}) {
  const cfg = { shot: 'street', freeLook: true, moveSpeed: 14, ...options };

  let current = cfg.shot;
  let free = false;
  /**
   * TRUE WHILE SOMETHING ELSE OWNS `ctx.camera` — session 17's player.
   *
   * CONTRACT §1.1 says a module may move the camera and none may replace it,
   * which leaves open what happens when two of them want to. Two modules
   * writing `camera.position` in one frame is not a race with a winner, it is
   * a frame that alternates between two answers at whatever the update order
   * happens to be, and it would read as jitter rather than as a bug.
   *
   * So there is exactly one rule and it is arbitration rather than precedence:
   * while `driven` is true this module's own free-look does nothing, and every
   * EXPLICIT placement — `setShot`, `setShotAt`, `setRouteAt` — still works and
   * emits `camera:placed`. The driver is expected to listen and re-seat itself
   * there. That is what "hand it back cleanly" means: the harness never loses,
   * and `runRoute`, `poseRoute` and `setShotAt` behave identically whether the
   * player is registered or not.
   */
  let driven = false;
  /** name → patch. Probe-only; see `setRouteOverride`. Empty for every gate. */
  const overrides = new Map();
  /**
   * A route as the camera should read it: the authored one with any probe
   * override applied. ONE function, and every reader goes through it — a second
   * place that merged the patch would be a second copy of the merge, which is
   * §9.1's arrangement with an object instead of a number.
   */
  function routeOf(name) {
    const r = ROUTES[name];
    if (!r) return null;
    const o = overrides.get(name);
    if (!o) return r;
    const merged = { ...r, ...o };
    if (o.lateral) {
      merged.waypoints = r.waypoints.map((w) => [w[0], w[1], w[2] + o.lateral]);
    }
    return merged;
  }
  const keys = new Set();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const dir = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  /** Tell whoever is driving that the camera was placed from outside. */
  function announcePlacement(ctx, source) {
    ctx.emit('camera:placed', { source, position: ctx.camera.position.toArray() });
  }

  function applyShot(ctx, name) {
    const shot = SHOTS[name];
    if (!shot) {
      ctx.warnOnce(`shot:${name}`, `no camera shot named '${name}'`);
      return false;
    }
    const cam = ctx.camera;
    cam.position.set(...shot.position);
    cam.up.set(0, 1, 0);
    cam.lookAt(new THREE.Vector3(...shot.target));
    cam.fov = shot.fov;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    euler.setFromQuaternion(cam.quaternion, 'YXZ');
    current = name;
    free = false;
    announcePlacement(ctx, `shot:${name}`);
    return true;
  }

  return {
    name: 'camera',

    init(ctx) {
      applyShot(ctx, cfg.shot);

      const dom = ctx.renderer.domElement;

      if (cfg.freeLook) {
        /**
         * `driven` IS CHECKED HERE AND NOT ONLY IN `pointermove` — session 19.
         *
         * The rule two blocks up says that while `driven` is true this module's
         * own free-look DOES NOTHING. Until this session only `pointermove`
         * enforced it; `pointerdown` still set `dragging` and still called
         * `setPointerCapture`, which is not nothing — it is a claim on a pointer
         * the player already owns. With `?player=1` the canvas is under a
         * pointer lock, the pointer is not in the active state `setPointerCapture`
         * requires, and every click on the world threw
         *
         *     InvalidStateError: Failed to execute 'setPointerCapture'
         *
         * out of this line. Harmless — the throw is inside a DOM listener, so
         * nothing downstream saw it — and it is exactly the kind of harmless
         * that makes a console useless for finding the next thing. The walkthrough
         * reported it because clicking the canvas is how you ACQUIRE the lock,
         * so it fired on the player's very first interaction.
         *
         * Not a try/catch: the correct behaviour is to not ask. A catch would
         * have made the frame identical and left this module still trying to
         * take a pointer that is spoken for.
         */
        dom.addEventListener('pointerdown', (e) => {
          if (driven) return;
          dragging = true;
          lastX = e.clientX;
          lastY = e.clientY;
          dom.setPointerCapture(e.pointerId);
        });
        dom.addEventListener('pointerup', (e) => {
          dragging = false;
          // Release only what was actually captured. A `pointerup` whose
          // `pointerdown` was refused above — or one that arrives after
          // `setDriven(true)` mid-drag — has no capture to give back, and
          // `releasePointerCapture` throws the same InvalidStateError for it.
          if (dom.hasPointerCapture && dom.hasPointerCapture(e.pointerId)) {
            dom.releasePointerCapture(e.pointerId);
          }
        });
        dom.addEventListener('pointermove', (e) => {
          if (!dragging || driven) return;
          free = true;
          euler.y -= (e.clientX - lastX) * 0.0026;
          euler.x -= (e.clientY - lastY) * 0.0026;
          euler.x = Math.max(-1.45, Math.min(1.45, euler.x));
          lastX = e.clientX;
          lastY = e.clientY;
          ctx.camera.quaternion.setFromEuler(euler);
        });
        window.addEventListener('keydown', (e) => keys.add(e.code));
        window.addEventListener('keyup', (e) => keys.delete(e.code));
      }

      return {
        get shot() {
          return current;
        },
        shots: Object.keys(SHOTS),
        setShot: (name) => applyShot(ctx, name),

        /**
         * An arbitrary placement, for looking. CONTRACT §10 step 4 says the
         * numbers are necessary and not sufficient, and until session 5 the only
         * way to look at anything was one of the three named shots above — so
         * the underside of a structure the gate camera sees at 26° of elevation
         * had never been looked at from anywhere else.
         *
         * `current` records the placement rather than a name, so `info().shot`
         * still says what was rendered. Gates use `setShot`; nothing asserts
         * against this.
         */
        setShotAt: (position, target, fov) => {
          const cam = ctx.camera;
          cam.position.set(position[0], position[1], position[2]);
          cam.up.set(0, 1, 0);
          cam.lookAt(new THREE.Vector3(target[0], target[1], target[2]));
          if (fov) {
            cam.fov = fov;
            cam.updateProjectionMatrix();
          }
          cam.updateMatrixWorld(true);
          euler.setFromQuaternion(cam.quaternion, 'YXZ');
          current = `free:[${position.map((v) => v.toFixed(1)).join(',')}]→[${target.map((v) => v.toFixed(1)).join(',')}]`;
          free = false;
          announcePlacement(ctx, 'setShotAt');
          return true;
        },

        routes: Object.keys(ROUTES),
        route: (name) => routeOf(name),

        /**
         * A ROUTE'S CAMERA PARAMETERS, OVERRIDDEN ONE AT A TIME. Session 20.
         * NOT A MODE, AND NO GATE MAY CALL IT — see CONTRACT §8's list beside
         * `setConeBound` and `showMotion`, which this joins.
         *
         * WHY IT EXISTS. `perfcheck` reports `player` over its ceilings and
         * `downtown_dense` under them, and the two routes differ in FIVE things
         * at once: field of view, eye height, pace, look pitch, and the lateral
         * offset that puts one on the pavement and the other on the crown of the
         * road. A difference of two numbers whose inputs differ in five ways is
         * not an attribution — it is exactly what session 4b could not do when
         * three systems landed together without switches, and the answer then
         * was the same as the answer now: one variable at a time, interleaved.
         *
         * IT PATCHES RATHER THAN REPLACES, and the patch is applied where the
         * route is READ rather than written into `ROUTES` — so a probe cannot
         * leave a route permanently altered, `clearRouteOverrides()` is total,
         * and `perfcheck` running immediately afterwards in the same page would
         * see the shipped numbers. `lateral` shifts every waypoint on the axis
         * PERPENDICULAR to the route's own run, which for all four routes is z:
         * they run east–west down the main street (CONTRACT §3.1).
         */
        setRouteOverride: (name, patch) => {
          if (!ROUTES[name]) return null;
          overrides.set(name, { ...(overrides.get(name) || {}), ...patch });
          return { ...overrides.get(name) };
        },
        clearRouteOverrides: () => {
          overrides.clear();
        },
        routeOverrides: () => Object.fromEntries([...overrides.entries()].map(([k, v]) => [k, { ...v }])),

        /**
         * Total path length in metres, so the caller can turn a frame count and
         * a dt into a position on the path without knowing the spline. Sampled
         * rather than integrated: a Catmull-Rom's arc length has no closed form
         * and 256 chords is well under a tenth of a percent on paths this smooth.
         */
        routeLength: (name) => {
          const r = routeOf(name);
          if (!r) return 0;
          let len = 0;
          let prev = splineAt(r.waypoints, 0);
          for (let i = 1; i <= 256; i++) {
            const q = splineAt(r.waypoints, i / 256);
            len += Math.hypot(q[0] - prev[0], q[1] - prev[1], q[2] - prev[2]);
            prev = q;
          }
          return len;
        },

        /**
         * Place the camera at parameter `u` along a route, looking along the
         * tangent. Free-look is cancelled: a route that the mouse can nudge is
         * not a reproducible measurement.
         */
        setRouteAt: (name, u) => {
          const r = routeOf(name);
          if (!r) return false;
          const cam = ctx.camera;
          const here = splineAt(r.waypoints, u);
          // Look ahead rather than at the next waypoint, so the heading is
          // continuous through the joints instead of snapping at each one.
          const ahead = splineAt(r.waypoints, Math.min(1, u + 0.01));
          cam.position.set(here[0], r.eye, here[2]);
          cam.up.set(0, 1, 0);
          /**
           * THE 0.9 IS A HEIGHT AND IT IS BEING USED AS A PITCH, WHICH IS WHY
           * IT IS NOW A PER-ROUTE NUMBER WITH THE OLD VALUE AS THE DEFAULT.
           *
           * The aim point is the look-ahead position raised by `lookRise`
           * metres, and the look-ahead distance is 0.01 of the route's OWN path
           * length — so the resulting pitch is atan(rise / (0.01 · length)) and
           * differs per route for a reason nobody chose:
           *
           *   downtown_dense  length 630.2 m → ahead 6.30 m → **8.13° up**
           *   night_rain      length 700.2 m → ahead 7.00 m → **7.32° up**
           *   highway_speed   length 1460.1 m → ahead 14.60 m → **3.53° up**
           *
           * A 4.60° spread of camera pitch across three routes, from one
           * constant that reads as "look slightly up". CONTRACT §9's shape with
           * a length standing in for an angle; recorded rather than repaired,
           * because changing it moves every millisecond and every look number
           * the three routes have ever produced. `player` sets 0 because a
           * walking person's gaze is level and this is the first route where
           * that is a claim about the subject rather than about the camera.
           */
          const rise = r.lookRise != null ? r.lookRise : 0.9;
          cam.lookAt(ahead[0], r.eye + rise, ahead[2]);
          if (cam.fov !== r.fov) {
            cam.fov = r.fov;
            cam.updateProjectionMatrix();
          }
          cam.updateMatrixWorld(true);
          euler.setFromQuaternion(cam.quaternion, 'YXZ');
          current = `route:${name}`;
          free = false;
          announcePlacement(ctx, `route:${name}`);
          return true;
        },
        /** True once the user has taken manual control. Gates never see this. */
        get free() {
          return free;
        },

        /**
         * Hand `ctx.camera` to another module, or take it back. See `driven`.
         * Returns what it actually set, so a caller cannot believe it took
         * ownership it did not get.
         */
        setDriven: (b) => {
          driven = !!b;
          if (driven) keys.clear();
          return driven;
        },
        get driven() {
          return driven;
        },
      };
    },

    update(ctx, dt) {
      // Session 17: while the player owns the camera this module writes
      // nothing. Not "writes the same thing" — nothing, so that a disagreement
      // between the two is impossible rather than small.
      if (driven) return;
      if (!cfg.freeLook || !keys.size) return;
      const cam = ctx.camera;
      const speed = cfg.moveSpeed * (keys.has('ShiftLeft') ? 4 : 1) * dt;
      cam.getWorldDirection(dir);
      right.crossVectors(dir, up).normalize();

      if (keys.has('KeyW')) cam.position.addScaledVector(dir, speed);
      if (keys.has('KeyS')) cam.position.addScaledVector(dir, -speed);
      if (keys.has('KeyD')) cam.position.addScaledVector(right, speed);
      if (keys.has('KeyA')) cam.position.addScaledVector(right, -speed);
      if (keys.has('KeyE')) cam.position.y += speed;
      if (keys.has('KeyQ')) cam.position.y -= speed;
      if (keys.size) free = true;
    },
  };
}
