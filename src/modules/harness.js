/**
 * harness.js — the surface the gates drive the game through. CONTRACT §8.
 *
 * Exposed as both window.__NOCTIS_HARNESS__ and window.__APEX_HARNESS__,
 * because the perfcheck.mjs that shipped with the starter kit already looks for
 * the second name and rewriting a committed gate to match new code is exactly
 * the move the brief forbids.
 *
 * runRoute() throws. Routes belong to session 3, and a stub that resolved would
 * make perfcheck pass by measuring nothing.
 */

import * as THREE from 'three';
import { TAA, LAMP_BOWL } from '../core/constants.js';
import { gaitOffset } from '../lib/gait.js';
import { CITY, terrainNormalAt } from '../lib/citygen.js';

/**
 * The traffic-saturation instrument. CONTRACT §8 — an instrument, not content.
 *
 * This session ships no vehicles. It ships the thing that will judge them, and
 * a light budget for traffic cannot be checked by reasoning about it: the
 * question "does a froxel hold 96 traffic slots on top of 52 block and 196 lamp
 * lights" has an answer that depends on the grid's tile size, the depth
 * slicing, the cone bound and where the cars are, and every one of those is a
 * measurement. So the pool is saturated with placeholder headlights at the
 * budgeted cone bound and the worst froxel is read off.
 *
 * WHY THIS ARRANGEMENT AND NOT A RANDOM ONE. Froxel occupancy is worst where
 * many lights share one froxel, and the froxels are finest near the camera and
 * near the view axis. A jam at a junction directly ahead — four lanes abreast,
 * nose to tail — is the densest arrangement two lanes each way can produce, and
 * it is a state a real street reaches every time a light turns red. A scatter
 * over the block would measure a luckier city than the one 4b will ship.
 *
 * Placed along the CAMERA's forward axis rather than on the road grid, and
 * deliberately: cluster assignment is a frustum question and knows nothing
 * about occlusion, so the worst case is the arrangement that puts the most
 * lights in the fewest froxels, which is the one aimed down the view axis. A
 * placement that respected the kerbs would measure the kerbs.
 */
const TRAFFIC_DEFAULTS = {
  /** Vehicles; each carries two headlights, so the light count is twice this. */
  vehicles: 48,
  /** Metres of useful throw. The streetlamp beam uses 30 for the same reason. */
  radius: 30,
  /** Outer half-angle, degrees. 35 is a 70° beam — the bound the budget is written against. */
  coneOuterDeg: 35,
  /** Inner half-angle, degrees. */
  coneInnerDeg: 22,
  /** Headlight height above the carriageway, metres. */
  height: 0.65,
  /** Nose-to-tail spacing in a jam, metres. */
  headway: 7,
  /** Lane centres, metres either side of the axis. Two lanes each way. */
  laneOffsets: [-9.6, -3.2, 3.2, 9.6],
  /** Headlight separation across the vehicle, metres. */
  track: 1.5,
  /** How far ahead of the camera the queue starts, metres. */
  standoff: 8,
  /** Candela. Only ever has to be > 0 — this instrument measures froxels, not photons. */
  intensity: 12000,
};

export function createHarness(options = {}) {
  const { loop } = options;

  return {
    name: 'harness',

    init(ctx) {
      /** Placeholder headlights and the spec they were made from. */
      const trafficLights = [];
      let trafficSpec = TRAFFIC_DEFAULTS;
      const fwd = new THREE.Vector3();
      const right = new THREE.Vector3();

      /** The §5.11 verification object. One box, one fixed path, no content. */
      let probeMesh = null;
      let probeSpec = null;
      let probeT = 0;
      const prevModel = new THREE.Matrix4();

      /**
       * The §7.3 shape controls for the winding census. Empty in every
       * delivered frame — `windingControls(true)` adds them, `false` removes
       * them, and `windingControlsActive()` is what a gate reads to prove its
       * own census was taken on the city rather than on the controls.
       */
      const windingControlMeshes = [];

      let readyResolve;
      const ready = new Promise((res) => {
        readyResolve = res;
      });

      const step = (n = 1, dt = 1 / 60) => {
        if (loop) loop.takeOver();
        return loop ? loop.step(n, dt) : Promise.resolve();
      };

      const api = {
        ready,

        /** Hand the frame clock to the caller. Everything below assumes this. */
        takeOver() {
          if (loop) loop.takeOver();
        },
        release() {
          if (loop) loop.release();
        },

        step,

        async setTimeOfDay(t) {
          const time = ctx.get('time');
          if (!time) throw new Error('time module is quarantined');
          time.setPaused(true);
          time.setTimeOfDay(t);
          // Two frames: one for the sky rebuild that the discontinuity queued,
          // one for lighting and the photocell to read the rebuilt sky.
          await step(2);
        },

        setShot(name) {
          const cam = ctx.get('camera');
          if (!cam) throw new Error('camera module is quarantined');
          if (!cam.setShot(name)) throw new Error(`unknown shot '${name}'`);
        },

        shots() {
          const cam = ctx.get('camera');
          return cam ? cam.shots : [];
        },

        /**
         * Stand anywhere and look at anything. For `tools/lookat.mjs`, which is
         * the answer to "the numbers are necessary and not sufficient" — no gate
         * asserts through this, and no gate may.
         */
        setShotAt(position, target, fov) {
          const cam = ctx.get('camera');
          if (!cam || !cam.setShotAt) throw new Error('camera module is quarantined');
          cam.setShotAt(position, target, fov);
        },

        /**
         * Converge the exposure and stop. Adaptation is deliberately slow
         * (CONTRACT §5.4) and a capture must not depend on how many frames the
         * machine happened to render. This snaps to the measured value; it does
         * not change what that value is.
         */
        async settle(frames = 4) {
          const exposure = ctx.get('exposure');
          // The meter clips around its own previous reading, so a single snap
          // only moves it one clipping window. Iterate until the window has
          // walked the full range (6^8 is nine orders of magnitude, which
          // covers midnight to noon), then hold for a few plain frames.
          for (let i = 0; i < 8; i++) {
            await step(1);
            if (exposure) exposure.snap();
          }
          /**
           * Then converge the temporal accumulation. TAA is an exponential
           * average, so "settled" is a number of frames and not a state to poll
           * for: at feedback 0.92, 32 frames leaves 0.92^32 = 7% of the initial
           * frame in the image, which is under a quantisation step. Without this
           * a capture would record whatever fraction of the eight jitter
           * positions the machine happened to have averaged — CONTRACT §8.
           */
          await step(TAA.settleFrames);
          // The exposure meter reads the resolved buffer, which has just moved.
          // Snap once more so the frame that is captured is metered on itself.
          if (exposure) exposure.snap();
          await step(frames);
        },

        setRenderScale(s) {
          const post = ctx.get('post');
          if (post) post.setRenderScale(s);
        },

        /**
         * Hold one pedestrian still at one gait phase, for
         * `tools/gaitstrip.mjs`. Passthrough to `streetlife.poseOne` — see the
         * `posed` comment there for what it suppresses and why no gate may
         * read through it. Throws when streetlife is quarantined rather than
         * returning null, on the same argument `cityPlacement` makes: a
         * diagnostic that photographs an empty pavement and reports nothing
         * wrong is worse than one that stops.
         */
        poseOnePedestrian(spec) {
          const sl = ctx.get('streetlife');
          if (!sl || !sl.poseOne) throw new Error('streetlife module is quarantined');
          return sl.poseOne(spec);
        },

        releasePosedPedestrian() {
          const sl = ctx.get('streetlife');
          if (sl && sl.poseRelease) sl.poseRelease();
        },

        pedestrianBuilds() {
          const sl = ctx.get('streetlife');
          return sl && sl.pedestrianBuilds ? sl.pedestrianBuilds() : [];
        },

        /**
         * Surface wetness, 0..1. The look gate captures every time of day at
         * both ends of it, so the wet frames are the same eight camera-seconds
         * as the dry ones rather than a separate authored scene.
         */
        /**
         * Pin the surface wetness, and STOP THE WEATHER MODULE OVERWRITING IT.
         *
         * This is the trap the weather module's own arrival creates and the one
         * that would have been found by a look frame quietly going dry. The
         * look gate sets wetness through here and then settles for about
         * forty-five frames; a module that writes wetness every update wins on
         * the very next frame, and eight 'wet' captures silently become dry
         * captures with wet in their filenames. So the override is explicit and
         * it is here rather than in the caller: every existing gate already
         * calls this, and none of them should have to learn about weather.
         */
        setWetness(v) {
          const lights = ctx.get('lights');
          if (!lights) throw new Error('lights module is quarantined');
          const weather = ctx.get('weather');
          if (weather && weather.override) weather.override(v);
          lights.setWetness(v);
        },

        /** Hand wetness back to the weather module. */
        releaseWetness() {
          const weather = ctx.get('weather');
          if (weather && weather.release) weather.release();
        },

        /**
         * Turn every indirect term off. Not a gate mode — a bisecting tool, and
         * the fastest way to answer "is this the lighting or the material",
         * which was the question behind three of session 1's four hardest bugs.
         */
        setIndirect(on) {
          const canyon = ctx.get('canyon');
          if (canyon) canyon.setEnabled(on);
          else {
            const lights = ctx.get('lights');
            if (lights) lights.setIndirect(on);
          }
        },

        /**
         * The placement dataset `citycheck` asserts against. CONTRACT §11.
         *
         * Throws rather than returning an empty object when the city is
         * quarantined: a gate that measures nothing and reports it as a pass is
         * worse than a gate that fails.
         */
        cityPlacement(region) {
          const city = ctx.get('city');
          if (!city) throw new Error('city module is quarantined — there is nothing to check');
          return city.placement(region);
        },

        /**
         * WHERE THE SIGN QUADS ACTUALLY ARE, off the delivered instance
         * matrices, against the buildings that are actually resident.
         *
         * Session 14, and it exists because reading the placement data would
         * have verified the placement data. `citygen` writes a sign's position
         * as the BUILDING'S CENTRE and `city.js` turns that into an elevation;
         * for thirteen sessions the turn was a 0.5 m offset from the centre
         * rather than a `depth/2` offset to the wall, so all 208 signs in the
         * 49 chunks round the origin sat a median 9.51 m INSIDE their own
         * building and not one of them reached a frame. A gate reading
         * `chunk.signs` would have found `x: cxb, z: czb` — the centre — and
         * had no opinion about it, because the centre is where the generator
         * meant the sign's BUILDING to be. CONTRACT §9.1: a gate that reads
         * config verifies the config.
         *
         * So this reads `city:signs`' `instanceMatrix` translations, which are
         * the numbers the GPU is handed, and returns them beside the resident
         * occluder boxes. The gate does the test; this supplies no verdict
         * (CONTRACT §8).
         */
        /**
         * THE DELIVERED KEEP-OUT CLAIMS — session 21.
         *
         * `city.placedClaims()` records what the module EMITTED, at the point
         * of emission: the ground rectangles that are the mesh, each prop's
         * world extent off its own delivered instance matrices, each park and
         * site feature's, each building's envelope and each landmark's ground
         * solid. `citycheck` runs `occupancy.findConflicts` over it.
         *
         * IT IS DELIBERATELY NOT THE GENERATOR'S REGISTRY. That structure says
         * what the generator TESTED; this says what arrived. The two agreeing
         * is the claim, and CONTRACT §9.1 exists because twice they have not:
         * 208 signs decided on a wall and drawn nine metres inside it, and
         * road patches decided 10 mm thick and drawn a metre tall.
         */
        occupancyCensus() {
          const city = ctx.get('city');
          if (!city || !city.placedClaims) throw new Error('city.placedClaims() is missing');
          const claims = city.placedClaims();
          const counts = {};
          for (const c of claims) counts[c.kind] = (counts[c.kind] || 0) + 1;
          return { claims, counts, total: claims.length };
        },

        /**
         * ═══════════════════════════════════════════════════════════════════
         * IS THERE A SURFACE UNDER EVERY POINT A PERSON CAN STAND ON —
         * SESSION 51, AND IT IS THE THIRD TIME THIS CLASS HAS BEEN REPAIRED.
         * ═══════════════════════════════════════════════════════════════════
         *
         * Session 34 found it at the weir, session 42 traced it to buildings
         * drawn to ring 5 and ground to ring 4, session 40 found a built
         * island emitting no ground rectangle at all — and this session found
         * two more, the origin block's four quadrants and the corners of every
         * round landmark's claim. Each time the operator found it by WALKING
         * THERE and pressing `P`, because `player.js` prints
         * `on <kind> at y <h>` and twice in four positions it printed
         * `on earth at y -0.020`.
         *
         * A city where a walkable point can have no surface should fail a
         * gate, not wait for somebody to stand on it. This is the census that
         * lets it.
         *
         * IT IS THE PLAYER'S OWN QUERY AND NOT A SECOND DESCRIPTION OF IT.
         * `city.worldSurfaceAt` is the one function the ground datum points
         * everything at (`city.js`'s own comment says so), and
         * `city.walkableAt` is the predicate `player.js` moves against. A
         * census that rasterised `chunk.ground` instead would be asking the
         * generator, and the generator has no opinion about residency, about
         * the ground ring, or about `BLOCK_KEEPOUT` clipping a rectangle away
         * afterwards — which is where 58% of the gap turned out to be.
         *
         * THE DENOMINATOR IS WALKABILITY, DELIBERATELY. A point inside a
         * building is not a gap in the ground; nobody can stand there and no
         * surface is owed. So a refused point is DROPPED rather than counted
         * as covered, which makes the share this returns the share of the
         * ground a person can actually reach.
         *
         * SAMPLED, AND THE STEP IS RETURNED WITH THE COUNTS so a reader can
         * turn a count into an area without assuming one.
         * `tools/surfacegrid.mjs` is the same walk outside the browser, with
         * the attribution by owner that a gate does not need.
         */
        surfaceCensus(region, step = 2) {
          const city = ctx.get('city');
          if (!city || !city.worldSurfaceAt || !city.walkableAt) {
            throw new Error('city.worldSurfaceAt/walkableAt are missing — there is nothing to check');
          }
          const S = CITY.chunkSize;
          const x0 = region.cx[0] * S;
          const x1 = (region.cx[1] + 1) * S;
          const z0 = region.cz[0] * S;
          const z1 = (region.cz[1] + 1) * S;
          const byKind = {};
          let sampled = 0;
          let unwalkable = 0;
          let unknown = 0;
          for (let z = z0 + step / 2; z < z1; z += step) {
            for (let x = x0 + step / 2; x < x1; x += step) {
              sampled++;
              if (!city.walkableAt(x, z).walkable) { unwalkable++; continue; }
              const su = city.worldSurfaceAt(x, z);
              if (!su.known) unknown++;
              byKind[su.kind] = (byKind[su.kind] || 0) + 1;
            }
          }
          const walkable = sampled - unwalkable;
          return {
            step,
            sampled,
            unwalkable,
            walkable,
            unknown,
            byKind,
            bare: byKind.earth || 0,
            bareFraction: walkable > 0 ? (byKind.earth || 0) / walkable : 0,
          };
        },

        signPlacement() {
          const city = ctx.get('city');
          if (!city) throw new Error('city module is quarantined — there is nothing to check');
          const quads = [];
          const m = new THREE.Matrix4();
          ctx.scene.traverse((o) => {
            if (!o.isInstancedMesh || o.name !== 'city:signs') return;
            for (let i = 0; i < o.count; i++) {
              m.fromArray(o.instanceMatrix.array, i * 16);
              quads.push([m.elements[12], m.elements[13], m.elements[14]]);
            }
          });
          return { quads, occluders: city.residentOccluders ? city.residentOccluders() : null };
        },

        /**
         * The street-level census. `tools/city-budget.json` → `streetLevel` has
         * carried `minStallsNearRing`, `minStallKinds` and `maxStallLightSlots`
         * since session 4b AND NO GATE HAS EVER READ ANY OF THEM — CONTRACT
         * §9.1's "a value written in config that the code does not read", with a
         * whole block instead of one pier spacing. Session 14 wires it up.
         *
         * Null when streetlife is quarantined, which is a failure and not a
         * pass, for the same reason `pedestrianCensus` says so.
         */
        stallCensus() {
          const sl = ctx.get('streetlife');
          return sl && sl.stallStats ? sl.stallStats() : null;
        },

        /**
         * The river, session 15: what the module BUILT, not what `RIVER` says.
         *
         * `bridges()` is the record `river.js` wrote as it pushed the boxes for
         * the last rebuild, so `structure` and `aboveDeck` come from the same
         * pass that placed the deck rather than from `BRIDGE_STRUCTURES` — which
         * is the vocabulary and has no opinion about what got built. CONTRACT
         * §7.2: the category count is a statement about the generator and the
         * paired measurement has to come off the delivered artefact, or it is a
         * gate reading its own config (§9.1).
         *
         * Null when the river is absent — which `?river=0` makes true — and
         * `citycheck` treats null as UNRUN rather than as a pass, the same way
         * it treats a missing stall census.
         */
        riverCensus() {
          const r = ctx.get('river');
          if (!r || !r.bridges) return null;
          return {
            bridges: r.bridges(),
            structures: r.structures(),
            stats: r.stats(),
            depth: r.depth,
            envelope: r.envelope,
            budget: r.budget,
          };
        },

        /**
         * Put the world into a route's conditions without driving it, for gates
         * that sample a handful of positions rather than measuring a run.
         */
        async prepareRoute(name) {
          const cam = ctx.get('camera');
          if (!cam || !cam.route(name)) throw new Error(`unknown route '${name}'`);
          const route = cam.route(name);
          await api.setTimeOfDay(route.t);
          api.setWetness(route.wet);
        },

        /**
         * Stand at one point on a route and settle. Used by the saturation
         * reserve, which is a claim about the whole route rather than about one
         * frame, so it has to be sampled at several points along it.
         */
        async sampleRouteAt(name, u) {
          const cam = ctx.get('camera');
          if (!cam || !cam.setRouteAt(name, u)) throw new Error(`unknown route '${name}'`);
          const post = ctx.get('post');
          if (post) post.resetHistory();
          // Long enough for the streaming system to have delivered the chunks
          // this position needs. A frame captured mid-stream measures the
          // streaming system, not the city.
          await step(30);
          await api.settle();
        },

        /**
         * Step until every chunk in the residency ring exists and every field
         * bake has landed, or until a bounded amount of TIME has passed.
         *
         * Streaming is asynchronous by design, so any gate that wants to measure
         * the *city* rather than the streaming system has to say when it has
         * finished arriving. Bounded rather than a spin: a bake that never
         * returns must fail the gate on its numbers, not hang it.
         *
         * A FRAME COUNT IS NOT A DURATION, AND UNTIL SESSION 4b THIS BOUND WAS
         * ONE. CONTRACT §9 row 18.
         *
         * The bound was 900 frames. What it is actually waiting for is 25 field
         * bakes running one at a time in a worker at 89 to 333 ms each — about
         * 2.6 s of WALL CLOCK in another thread, which the frame loop does not
         * govern and cannot hurry. So the faster this machine renders, the less
         * time 900 frames buys, and the bound goes the wrong way with hardware.
         *
         * Measured, both arms, same commit, same machine, from cold:
         *
         *   vsync ON  (60 Hz)   drained at 314 frames / 5227 ms   — passed
         *   vsync OFF           900 frames burned in 3124 ms,
         *                       11 of 25 bakes landed             — TIMED OUT
         *
         * and `tools/lib/page.mjs` launches every gate's browser with
         * `--disable-gpu-vsync --disable-frame-rate-limit`, so the failing arm
         * is the one every gate runs. It failed by reporting a census of a
         * PARTIAL CITY, which is the quiet-gate shape this session added
         * CONTRACT §7 for: the number was wrong and the gate still printed one.
         *
         * So the primary bound is wall clock, which is the quantity that
         * actually governs, and the frame budget stays as a secondary guard so
         * a machine that renders at one frame a second cannot sit here for
         * twenty seconds doing nothing. Whichever bound is hit is REPORTED —
         * `timedOutOn` — because the two mean different things: 'wall' is a
         * bake that is slow or stuck, 'frames' is a renderer that has stopped.
         *
         * 20 s is 3.6x the 5.5 s a cold start measures end to end. Not tuned to
         * the measurement: tuning a deadline to what it just took is how the
         * next machine fails.
         *
         * `performance.now()` and not `Date.now()` — CONTRACT §6, machine-checked
         * by parsecheck.
         */
        async waitForCity(maxFrames = 6000, maxMs = 20000) {
          const city = ctx.get('city');
          const canyon = ctx.get('canyon');
          const t0 = performance.now();
          const snap = (extra) => ({
            field: canyon && canyon.streamStats ? canyon.streamStats() : null,
            city: city ? city.stats() : null,
            ms: +(performance.now() - t0).toFixed(1),
            ...extra,
          });
          for (let i = 0; i < maxFrames; i += 10) {
            await step(10);
            const s = canyon && canyon.streamStats ? canyon.streamStats() : null;
            const c = city ? city.stats() : null;
            /**
             * `!s.dripping` AND NOT `s.dripping === 0` — session 10. A bake
             * whose bytes have landed but whose layers are still being handed
             * to the driver a few at a time (canyon.js `drainUploads`) is a
             * chunk still rendering with the analytic default, and returning
             * there would capture a frame mid-stream while reporting a fully
             * baked city. `queued` and `inFlight` are both zero at that
             * moment, so the two old terms cannot see it. The loose test is
             * deliberate: a canyon that predates the drip reports no such key
             * and must go on passing rather than hang on `undefined === 0`.
             */
            if (s && s.queued === 0 && s.inFlight === 0 && !s.dripping && c && c.resident > 0) {
              // A few more so the last arrival is in a drawn frame.
              await step(4);
              return snap({ frames: i + 14 });
            }
            if (performance.now() - t0 > maxMs) {
              return snap({ frames: i + 10, timedOut: true, timedOutOn: 'wall' });
            }
          }
          return snap({ frames: maxFrames, timedOut: true, timedOutOn: 'frames' });
        },

        /**
         * Fill the clustered-light pool with placeholder headlights.
         *
         * Returns what it actually made, because "I asked for 96" and "96 exist"
         * are different claims and the gate must assert the second. A saturation
         * probe that quietly made none would report a magnificent margin.
         */
        saturateTraffic(opts = {}) {
          const lights = ctx.get('lights');
          if (!lights) throw new Error('lights module is quarantined — there is nothing to saturate');
          api.clearTraffic();
          const s = { ...TRAFFIC_DEFAULTS, ...opts };
          trafficSpec = s;
          const coneOuter = (s.coneOuterDeg * Math.PI) / 180;
          const coneInner = (s.coneInnerDeg * Math.PI) / 180;
          for (let i = 0; i < s.vehicles; i++) {
            const lane = i % s.laneOffsets.length;
            const rank = Math.floor(i / s.laneOffsets.length);
            // Two of the four lanes are oncoming. Their beams point at the lens,
            // which is the case that puts the most lights in the near froxels.
            const oncoming = lane < s.laneOffsets.length / 2;
            for (let side = -1; side <= 1; side += 2) {
              trafficLights.push({
                light: lights.add({
                  role: 'traffic',
                  position: new THREE.Vector3(0, -1000, 0),
                  color: [1, 0.95, 0.86],
                  intensity: s.intensity,
                  radius: s.radius,
                  type: 'spot',
                  direction: new THREE.Vector3(0, 0, -1),
                  coneOuter,
                  coneInner,
                  sourceRadius: 0.09,
                }),
                lane, rank, side, oncoming,
              });
            }
          }
          api.updateTraffic();
          return {
            vehicles: s.vehicles,
            lights: trafficLights.length,
            coneOuterDeg: s.coneOuterDeg,
            radius: s.radius,
            /**
             * The froxel saving the cone bound buys, from the geometry rather
             * than from the measurement, so the two can be compared. CONTRACT
             * §9 rule 2 — anything derived two ways is printed both ways once.
             */
            coneBoundVolumeRatio:
              +(1 / (8 * Math.pow(Math.cos(coneOuter), 3))).toFixed(4),
          };
        },

        /**
         * Re-seat the queue relative to where the camera is now. Called from
         * inside the route loop, not from a `beforeRender` listener: §4.1 puts
         * `beforeRender` after every `update()`, and `lights.update()` is where
         * assignment happens, so a listener would place this frame's cars for
         * last frame's grid.
         */
        updateTraffic() {
          if (!trafficLights.length) return;
          const s = trafficSpec;
          const cam = ctx.camera;
          cam.updateMatrixWorld();
          fwd.set(0, 0, -1).applyQuaternion(cam.quaternion);
          fwd.y = 0;
          if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
          fwd.normalize();
          right.set(fwd.z, 0, -fwd.x);
          const ground = cam.position.y - 1.74;
          for (const t of trafficLights) {
            const along = s.standoff + t.rank * s.headway;
            const across = s.laneOffsets[t.lane] + t.side * (s.track / 2);
            t.light.position.set(
              cam.position.x + fwd.x * along + right.x * across,
              ground + s.height,
              cam.position.z + fwd.z * along + right.z * across
            );
            // Oncoming headlights face the camera; the rest face away. Dipped
            // by 1.5°, which is what a low beam is aimed at.
            const dir = t.oncoming ? -1 : 1;
            t.light.direction.set(fwd.x * dir, -0.026, fwd.z * dir).normalize();
          }
        },

        clearTraffic() {
          const lights = ctx.get('lights');
          if (lights) for (const t of trafficLights) lights.remove(t.light);
          trafficLights.length = 0;
        },

        /**
         * The grid's occupancy, and the whole point of the exercise.
         *
         * `peak` is the high-watermark since `resetClusterPeaks()` and not this
         * frame's value: the cap is a claim about every frame of the route and
         * the gate reads one of them.
         */
        clusterStats() {
          const lights = ctx.get('lights');
          if (!lights || !lights.clusterConfig) return null;
          const cfg = lights.clusterConfig();
          return {
            ...cfg,
            // From the light list, not from `trafficLights.length` — the
            // instrument's own bookkeeping and the world's answer are two
            // numbers and only one of them is evidence.
            /**
             * THE POOL, NOT THE LIT COUNT, AND THEY ARE TWO QUANTITIES.
             *
             * `countByRole` counts ENABLED lights, which is the right answer to
             * "how many headlamps are on" and the wrong one to "does the grid
             * this session ships hold 96 traffic slots". Vehicle lighting runs
             * on the street photocell, so on the daylight route every headlamp
             * is legitimately off and `countByRole` returns 0 — and the gate
             * read that as "the pool is not saturated, UNRUN", which is a
             * different and false statement.
             *
             * So the assertion reads the POOL and the lit count is reported
             * beside it. CONTRACT §9, one more time.
             */
            trafficLights: lights.roleCensus ? (lights.roleCensus().byRole.traffic || 0) : trafficLights.length,
            trafficLightsLit: lights.countByRole ? lights.countByRole('traffic') : 0,
            placeholderTrafficLights: trafficLights.length,
            peakOccupancy: lights.peakOccupancyEver,
            occupancyMargin: cfg.maxPerCluster - lights.peakOccupancyEver,
            clustersAtCap: lights.clustersAtCap,
            lightCount: lights.lightCountEver,
            poolMargin: cfg.maxLights - lights.lightCountEver,
            assignedIndices: lights.assignedIndicesEver,
            overflow: lights.overflowEver,
          };
        },

        resetClusterPeaks() {
          const lights = ctx.get('lights');
          if (lights && lights.resetClusterPeaks) lights.resetClusterPeaks();
        },

        /** The A side of the cone-bound A/B. See lights.js `coneBound`. */
        setConeBound(on) {
          const lights = ctx.get('lights');
          if (!lights || !lights.setConeBound) throw new Error('lights module is quarantined');
          lights.setConeBound(on);
        },

        /**
         * ONE BOX ON A FIXED PATH. CONTRACT §5.11, and the whole verification
         * of it.
         *
         * `post.js` predicted in writing that the first thing to move would
         * break TAA, and the arithmetic was specific: a vehicle at 12 m/s at
         * 30 m crosses the frame at roughly eighteen pixels per frame against a
         * ±1 px neighbourhood clamp, so history is rejected and traffic aliases
         * rather than ghosts. This is that vehicle, reduced to the smallest
         * thing that can carry the claim.
         *
         * WHY A BOX AND NOT THE TRAFFIC SYSTEM. If the motion attachment lands
         * after the traffic system, then two new systems are being debugged
         * against one symptom, and the symptom will look like a traffic bug.
         * With one box on a scripted path the expected NDC displacement is a
         * number that can be computed on paper and compared against what the
         * attachment says — which is the only way anything in CONTRACT §9 has
         * ever been found.
         *
         * The material is a CLONE, and it is patched after cloning. three's
         * Material.copy does not carry `onBeforeCompile` or
         * `customProgramCacheKey` — they are instance functions and are not on
         * the documented property list — which is how four landmarks spent a
         * session outside the lighting model. An unpatched clone here would
         * write no motion at all and the probe would report the bug it exists
         * to detect as a pass.
         */
        motionProbe(opts = {}) {
          const lights = ctx.get('lights');
          if (!lights) throw new Error('lights module is quarantined');
          api.clearMotionProbe();
          const s = {
            /** Metres ahead of the camera. The distance in the prediction. */
            distance: 30,
            /** Metres per second, across the view. The speed in the prediction. */
            speed: 12,
            /** Metres of travel before it turns round, so it stays in frame. */
            span: 24,
            size: 2.4,
            ...opts,
          };
          probeSpec = s;
          probeT = 0;
          const mat = new THREE.MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.6 });
          lights.patch(mat);
          probeMesh = new THREE.Mesh(new THREE.BoxGeometry(s.size, s.size, s.size), mat);
          probeMesh.name = 'harness:motion-probe';
          probeMesh.frustumCulled = false;
          ctx.scene.add(probeMesh);
          api.updateMotionProbe(0);
          return api.motionProbeExpectation();
        },

        /**
         * What the attachment SHOULD read on the probe's pixels, from the
         * geometry alone. Computed here so that the measurement has something
         * to disagree with — CONTRACT §9 rule 2.
         */
        motionProbeExpectation() {
          if (!probeMesh) return null;
          const s = probeSpec;
          const dt = 1 / 60;
          const metresPerFrame = s.speed * dt;
          // Small-angle: the box is near the view axis, so its angular
          // displacement is the lateral one over the distance.
          const radPerFrame = metresPerFrame / s.distance;
          const post = ctx.get('post');
          const internal = post && post.internalSize ? post.internalSize : { width: 2560, height: 1440 };
          const tanHalfY = Math.tan((ctx.camera.fov * 0.5 * Math.PI) / 180);
          const radPerPixel = (2 * tanHalfY) / internal.height;
          // NDC.x spans [-1, 1] over 2·tanHalfY·aspect radians.
          const ndcPerFrame = radPerFrame / (tanHalfY * ctx.camera.aspect);
          return {
            distance: s.distance,
            speed: s.speed,
            metresPerFrame: +metresPerFrame.toFixed(4),
            radPerPixel: +radPerPixel.toExponential(3),
            pixelsPerFrame: +(radPerFrame / radPerPixel).toFixed(2),
            ndcPerFrame: +ndcPerFrame.toFixed(6),
          };
        },

        /**
         * Advance the probe by one frame and hand its material the transform it
         * had before the advance.
         *
         * `uNoctisPrevDelta` is prevModel · inverse(model), so it maps this
         * frame's world position to last frame's. Composed here, once, from two
         * matrices this function owns — rather than in the shader from two it
         * would have to be given separately.
         */
        /**
         * @param writeDelta  False withholds the previous transform, leaving
         *   the delta at the identity — which is exactly what session 5
         *   believed about every object in the world. It is the A side of the
         *   A/B, not a mode: the difference between the two resolved frames IS
         *   what §5.11 added, and a claim that something changed needs the
         *   version where it did not.
         */
        updateMotionProbe(dt = 1 / 60, writeDelta = true) {
          if (!probeMesh) return;
          const s = probeSpec;
          prevModel.copy(probeMesh.matrixWorld);
          probeT += dt;
          // Triangle wave, so the box crosses the frame and comes back rather
          // than leaving it. Constant speed everywhere except the two turns.
          const period = (2 * s.span) / s.speed;
          const phase = (probeT % period) / period;
          const x = phase < 0.5
            ? -s.span / 2 + phase * 2 * s.span
            : s.span / 2 - (phase - 0.5) * 2 * s.span;
          fwd.set(0, 0, -1).applyQuaternion(ctx.camera.quaternion);
          right.set(-fwd.z, 0, fwd.x).normalize();
          probeMesh.position.set(
            ctx.camera.position.x + fwd.x * s.distance + right.x * x,
            ctx.camera.position.y + fwd.y * s.distance,
            ctx.camera.position.z + fwd.z * s.distance + right.z * x
          );
          probeMesh.updateMatrixWorld(true);
          const u = probeMesh.material.userData.noctisPrevDelta;
          if (u) {
            if (writeDelta) u.value.copy(probeMesh.matrixWorld).invert().premultiply(prevModel);
            else u.value.identity();
          }
        },

        /**
         * Override the probe's previous transform with a pure lateral
         * translation of `metres`, so the motion vector it writes is whatever
         * size the caller wants.
         *
         * WHY AN INSTRUMENT NEEDS THIS. The physically correct displacement —
         * 0.008 NDC, ten pixels a frame — changes the RESOLVED frame by about
         * 1.5/255 over the box, because the box is flat and untextured and the
         * neighbourhood clamp's fallback is the background behind it, which is
         * a similar grey. That difference is smaller than the exposure meter's
         * own drift across two runs, so an A/B on it measures the meter. It is
         * a measurement problem and not a rendering one, and the way out is to
         * make the input large: at 20 m of lateral displacement the resolve
         * fetches history from 40% of the screen away, which nothing else in
         * the pipeline can imitate.
         *
         * This proves the resolve READS the buffer. That the buffer holds the
         * physically correct number is proved separately, and numerically, by
         * comparing its magnitude against the geometry.
         */
        forceMotionProbeDelta(metres) {
          if (!probeMesh) return null;
          const u = probeMesh.material.userData.noctisPrevDelta;
          if (!u) return null;
          fwd.set(0, 0, -1).applyQuaternion(ctx.camera.quaternion);
          right.set(-fwd.z, 0, fwd.x).normalize();
          u.value.makeTranslation(right.x * metres, 0, right.z * metres);
          return { metres, axis: right.toArray().map((v) => +v.toFixed(4)) };
        },

        /** The TAA neighbourhood clip width. Instrument only — see post.js. */
        setClipGamma(v) {
          const post = ctx.get('post');
          if (!post || !post.setClipGamma) throw new Error('post module is quarantined');
          return post.setClipGamma(v);
        },

        /**
         * The other two halves of the temporal filter, for the static-camera
         * shimmer probe. Instruments, exactly like `setClipGamma`: no gate may
         * render through any of the three, and the argument is CONTRACT §8's
         * about `setShotAt`. The full derivation of what each one separates is
         * on `post.setFeedback`.
         *
         * They throw rather than returning null when `post` is quarantined,
         * because an arm that silently did not apply would be reported as an
         * arm that made no difference — which is the same sentence with the
         * opposite meaning.
         */
        setTaaFeedback(v) {
          const post = ctx.get('post');
          if (!post || !post.setFeedback) throw new Error('post module is quarantined');
          return post.setFeedback(v);
        },
        setJitterScale(v) {
          const post = ctx.get('post');
          if (!post || !post.setJitterScale) throw new Error('post module is quarantined');
          return post.setJitterScale(v);
        },
        /** The two resolve arms. See post.js → TAA_JITTER_COMP, TAA_KARIS_SCALE. */
        setJitterComp(v) {
          const post = ctx.get('post');
          if (!post || !post.setJitterComp) throw new Error('post module is quarantined');
          return post.setJitterComp(v);
        },
        setKarisScale(v) {
          const post = ctx.get('post');
          if (!post || !post.setKarisScale) throw new Error('post module is quarantined');
          return post.setKarisScale(v);
        },

        clearMotionProbe() {
          if (!probeMesh) return;
          ctx.scene.remove(probeMesh);
          probeMesh.geometry.dispose();
          probeMesh.material.dispose();
          probeMesh = null;
        },

        /**
         * Show the motion attachment instead of the composite, so it can be
         * screenshotted and decoded. §5.11.
         *
         * NOT a readback. `readRenderTargetPixels` is forbidden in a module by
         * CONTRACT §5.4 and `parsecheck` enforces it — and, separately, three's
         * readback rejects any format that is not RGBA, so a readback of the
         * RG16F attachment returns a buffer of zeros and a console error. The
         * first version of this did exactly that and the static-world check
         * passed on it, reporting "no motion anywhere" for a reason that had
         * nothing to do with motion.
         *
         * `scale` is the encoding gain, from `post`, so the decoder and the
         * encoder cannot drift apart.
         */
        showMotion(on) {
          const post = ctx.get('post');
          if (!post || !post.setDebugView) throw new Error('post module is quarantined');
          if (!post.motionTexture) throw new Error('no motion attachment — §5.11 is not built');
          post.setDebugView(on ? 'motion' : null);
          return { scale: post.motionDebugScale, internal: post.internalSize };
        },

        /**
         * WHAT IS ACTUALLY IN THE SCENE, read off the live objects.
         *
         * `citycheck` reads placement data — the generator's own description of
         * what it decided — and five of its six criteria are claims about the
         * generator, so that is right. It is also the arrangement in which
         * `pierEvery: 34` sat in the data while `i % 3 === 0` sat in the code
         * and 48 metres shipped: nothing ever compared what was written down
         * against what was built. A gate that reads config verifies the config.
         *
         * So this walks `ctx.scene` and reads `instanceMatrix.count` off every
         * InstancedMesh — the number the GPU will actually be handed — and the
         * per-kind breakdown each mesh recorded when it was assembled. The
         * breakdown is a label and the count is the measurement; a mesh whose
         * label does not sum to its count is a mesh that lost something between
         * being described and being built.
         *
         * `count` and `instanceMatrix.count` are BOTH reported. three draws
         * `count` instances out of an `instanceMatrix` that may be larger, and
         * a pool that allocated 700 and draws 40 is a different fact from one
         * that allocated 40 — which is precisely the distinction a particle
         * budget lives or dies on.
         */
        sceneCensus() {
          const meshes = [];
          const totals = {};
          let instancedMeshes = 0;
          let plainMeshes = 0;
          let unlabelled = 0;
          ctx.scene.traverse((o) => {
            if (!o.isInstancedMesh) {
              if (o.isMesh) plainMeshes++;
              return;
            }
            instancedMeshes++;
            const label = o.userData.noctisCensus || null;
            const allocated = o.instanceMatrix ? o.instanceMatrix.count : 0;
            if (!label) unlabelled++;
            let labelled = 0;
            if (label) {
              for (const [k, v] of Object.entries(label)) {
                if (typeof v !== 'number') continue;
                labelled += v;
                totals[k] = (totals[k] || 0) + v;
              }
            }
            meshes.push({
              name: o.name,
              visible: o.visible,
              drawn: o.count,
              allocated,
              labelled: label ? labelled : null,
              label,
            });
          });
          return {
            instancedMeshes,
            plainMeshes,
            unlabelled,
            totals,
            /** Every mesh whose label does not sum to what it allocated. */
            mismatches: meshes.filter((m) => m.labelled != null && m.labelled !== m.allocated),
            /** Every mesh that allocated more than it draws. */
            underdrawn: meshes.filter((m) => m.drawn < m.allocated),
            meshes,
          };
        },

        /**
         * THE LAMP BOWL CENSUS — session 28, and it exists because one object
         * had two radiances in two files with nothing comparing them.
         *
         * `constants.js` → `LAMP_BOWL` now derives ONE radiance, Φ/(π·A), and
         * declares each path as a factor of it. That makes the two agree by
         * construction at the point of AUTHORING. This reads the other end:
         * every material in the LIVE SCENE tagged `noctisLampPath`, with the
         * `emissiveIntensity` that actually arrived on it and the sphere-zone
         * parameters of the geometry it is actually drawn on.
         *
         * CONTRACT §9.1: a gate that reads config verifies the config. The
         * factor could be right in `constants.js` and the material could still
         * be set from a literal somewhere downstream — `city.js` and
         * `block.js` both re-write `emissiveIntensity` every time the photocell
         * changes, which is exactly the kind of line a refactor rewrites.
         *
         * IT REPORTS THE PHOTOCELL RATHER THAN GUESSING FROM THE VALUE. Both
         * paths carry 0.5 when the lamps are off, and a census that could not
         * tell "off" from "wrong" would fail every daylight run — §7.1's quiet
         * gate wearing the opposite sign.
         */
        lampBowlCensus() {
          const lighting = ctx.get('lighting');
          const byPath = new Map();
          ctx.scene.traverse((o) => {
            if (!o.isMesh && !o.isInstancedMesh) return;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of mats) {
              const path = m && m.userData && m.userData.noctisLampPath;
              if (!path) continue;
              const g = o.geometry && o.geometry.parameters ? o.geometry.parameters : {};
              let row = byPath.get(path);
              if (!row) {
                row = {
                  path,
                  meshes: 0,
                  /** What ARRIVED on the material, not what was authored for it. */
                  deliveredNits: m.emissiveIntensity,
                  /**
                   * The zone the radiance is divided by, off the DELIVERED
                   * geometry. BOTH pairs: `theta` is the polar sweep the area
                   * formula integrates and `phi` is the revolution it assumes
                   * is complete. Reading only one pair is how this instrument
                   * was wrong on its first write.
                   */
                  radiusM: g.radius === undefined ? null : g.radius,
                  thetaStart: g.thetaStart === undefined ? null : g.thetaStart,
                  thetaLength: g.thetaLength === undefined ? null : g.thetaLength,
                  phiStart: g.phiStart === undefined ? null : g.phiStart,
                  phiLength: g.phiLength === undefined ? null : g.phiLength,
                };
                byPath.set(path, row);
              }
              row.meshes++;
            }
          });
          return {
            /** Φ/(π·A) — the one number both delivered values are a factor of. */
            derivedNits: LAMP_BOWL.derivedNits,
            /** So the gate knows whether `deliveredNits` is the ON value. */
            lampsOn: lighting ? !!lighting.photocellOn : null,
            paths: [...byPath.values()],
          };
        },

        /**
         * THE WINDING CENSUS. Session 14. CONTRACT §9.1's fourth variant,
         * instrumented.
         *
         * Three winding defects in three places — the pedestrian loft (s12),
         * the ground quad (s13) and the reveal's double rotation (s13) — and
         * every one of them shipped through six gates because *the silhouette
         * of a convex solid is identical whichever shell is drawn*. A backwards
         * box is a box. Nothing in this project has ever asked which shell.
         *
         * This asks, three independent ways, and returns all three per mesh
         * because CONTRACT §9 rule 2 says a quantity derived two ways is
         * printed both ways. It returns NO VERDICT — the thresholds live in
         * `tools/budget.json` and the arithmetic in `tools/lib/winding.mjs`,
         * for the reason §8 gives about `silhouettes()`.
         *
         *  1. SIGNED VOLUME, sum of `v0 · (v1 × v2) / 6` over the triangles.
         *     For a CLOSED mesh this is the enclosed volume and its sign is the
         *     winding, with no reference to any attribute anybody authored.
         *     Positive is outward. Translation-invariant on a closed mesh —
         *     the divergence theorem's own guarantee — so no origin has to be
         *     chosen. Meaningless on an open one, which is why closedness is
         *     measured rather than assumed.
         *
         *  2. NORMAL AGREEMENT, the area-weighted fraction of triangles whose
         *     geometric normal `(v1−v0) × (v2−v0)` points the same way as the
         *     mean of their three authored vertex normals. This is precisely
         *     the pair of quantities §9.1 says are two statements about the
         *     same thing, put side by side. It is VACUOUS wherever the normals
         *     were derived from the winding by `computeVertexNormals()` — it
         *     cannot be otherwise, and `normalsDerived` is reported per mesh so
         *     a reader can see which rows it says nothing about. All three
         *     known defects were authored-normal cases and all three fail it.
         *
         *  3. FRONT-FACING AREA FRACTION toward a given eye point, in WORLD
         *     space and through every instance matrix, which is the quantity
         *     the rasteriser itself uses. A closed solid reads about 0.5 from
         *     anywhere. A horizontal surface below the eye reads 1.0 wound up
         *     and 0.0 wound down — the ground defect, stated as the number the
         *     GPU acted on. This one needs no attribute and no closedness, and
         *     it is the only one of the three that would have caught all three
         *     defects on its own.
         *
         * INSTANCE DETERMINANT. An instance matrix with a negative determinant
         * mirrors its geometry and therefore REVERSES its effective winding,
         * whatever the geometry says. Correct geometry drawn through one is
         * still a back-facing draw, so the sign is counted per mesh rather than
         * assumed — this project composes every instance matrix from a
         * position, a yaw and a scale, and one negative scale anywhere would do
         * it silently.
         *
         * KEYED BY MESH NAME, WITH THE GEOMETRY WORK CACHED BY GEOMETRY.
         *
         * The first version keyed the rows by geometry uuid, on the argument
         * that winding is a property of the triangle order and twenty-five
         * chunks sharing one box are one subject. Two things were wrong with
         * that and both showed up on the first run:
         *
         *  - `city:ground` and `city:signs` are REBUILT whole whenever the near
         *    ring changes, so each pose produced a fresh uuid, every row was
         *    seen at one eye, and the facing test declined on the two meshes
         *    this whole gate was written for.
         *  - eleven `block:*` meshes share one `PlaneGeometry`, so a negative
         *    instance determinant was reported against all eleven names at once
         *    and the finding could not be attributed to any of them.
         *
         * The geometry work — volume, closedness, normal agreement — is still
         * computed once per geometry and cached, because that is what is
         * expensive. Only the row identity moved.
         *
         * `eye` defaults to the live camera. Sampling is exhaustive up to
         * `maxTris` per geometry and then strided, so a million-triangle city
         * costs a bounded walk; `sampled` and `tris` are both returned so the
         * caller can see which rows are estimates. A stride never changes the
         * SIGN of a majority, which is the only thing read off it.
         */
        windingCensus(opts = {}) {
          const maxTris = opts.maxTris != null ? opts.maxTris : 6000;
          const eye = new THREE.Vector3();
          if (opts.eye) eye.set(opts.eye[0], opts.eye[1], opts.eye[2]);
          else ctx.camera.getWorldPosition(eye);

          const byMesh = new Map();
          const geomCache = new Map();
          const v0 = new THREE.Vector3();
          const v1 = new THREE.Vector3();
          const v2 = new THREE.Vector3();
          const e1 = new THREE.Vector3();
          const e2 = new THREE.Vector3();
          const gn = new THREE.Vector3();
          const sn = new THREE.Vector3();
          const cen = new THREE.Vector3();
          const toEye = new THREE.Vector3();
          const m4 = new THREE.Matrix4();
          const m3 = new THREE.Matrix3();

          ctx.scene.traverse((o) => {
            if (!o.isMesh || !o.geometry) return;
            const g = o.geometry;
            const pos = g.getAttribute('position');
            if (!pos || pos.count < 3) return;
            const idx = g.index;
            const triCount = idx ? Math.floor(idx.count / 3) : Math.floor(pos.count / 3);
            if (triCount < 1) return;

            /**
             * The instance matrices this geometry is actually drawn through.
             * `null` for a plain mesh, whose world matrix carries the same
             * information and is handled below.
             */
            const inst = o.isInstancedMesh ? o.instanceMatrix : null;
            const drawn = o.isInstancedMesh ? o.count : 1;

            /**
             * MIRRORING, AND THREE COMPENSATES FOR EXACTLY ONE OF THE TWO
             * PLACES IT CAN HAPPEN. Read out of three's own source rather than
             * assumed, because the first version of this census assumed and was
             * wrong in the direction that manufactures findings:
             *
             *   WebGLRenderer.renderBufferDirect:
             *     const frontFaceCW = ( object.isMesh && object.matrixWorld.determinant() < 0 );
             *     state.setMaterial( material, frontFaceCW );
             *   WebGLState.setMaterial:
             *     let flipSided = ( material.side === BackSide );
             *     if ( frontFaceCW ) flipSided = ! flipSided;
             *
             * So a mirrored OBJECT has its culling convention flipped for it and
             * is still rasterised the right way round. An `InstancedMesh`'s
             * per-instance matrix is not in `matrixWorld` and gets no such
             * treatment, so a mirrored INSTANCE really is drawn inside-out.
             *
             * The normal goes the other way. `defaultnormal_vertex` applies the
             * instance matrix to the normal — `transformedNormal = im *
             * transformedNormal`, after dividing out the column LENGTHS, which
             * removes the scale magnitude and not its sign — and then
             * `normalMatrix`, the inverse transpose; `FLIP_SIDED` comes from
             * `material.side === BackSide` and never from `frontFaceCW`. A
             * single-axis mirror leaves a normal perpendicular to that axis
             * exactly where it was. So a mirrored OBJECT is drawn correctly and
             * LIT BACKWARDS, and a mirrored INSTANCE is both.
             *
             * Two counts, therefore, and not one. They are different defects
             * with different symptoms and the gate says which.
             */
            const worldDet = o.matrixWorld.determinant();
            /** three flips the culling for us: facing is right, the normal is not. */
            const mirroredObject = worldDet < 0 ? 1 : 0;
            /** three does not: the face itself is drawn inside-out. */
            let mirroredInstances = 0;
            let detMin = Infinity;
            let detMax = -Infinity;
            if (inst) {
              for (let i = 0; i < drawn; i++) {
                m4.fromArray(inst.array, i * 16);
                const d = m4.determinant();
                if (d < 0) mirroredInstances++;
                if (d < detMin) detMin = d;
                if (d > detMax) detMax = d;
              }
            } else {
              detMin = detMax = worldDet;
            }
            if (!Number.isFinite(detMin)) { detMin = detMax = worldDet; }

            let stats = geomCache.get(g.uuid);
            if (!stats) {
              /**
               * The geometry half — computed once per geometry in its own
               * local space, because that is where the triangle order lives.
               */
              const nrm = g.getAttribute('normal');
              const tri = (t, a, b, c) => {
                const ia = idx ? idx.getX(t * 3) : t * 3;
                const ib = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
                const ic = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
                a.fromBufferAttribute(pos, ia);
                b.fromBufferAttribute(pos, ib);
                c.fromBufferAttribute(pos, ic);
                return [ia, ib, ic];
              };

              const stride = Math.max(1, Math.ceil(triCount / maxTris));
              let sampled = 0;
              let vol6 = 0;
              let areaTotal = 0;
              let areaAgree = 0;
              let areaDisagree = 0;
              let areaAmbiguous = 0;
              let hasNormals = !!nrm;
              /**
               * WHETHER THE NORMALS CAME OUT OF THE WINDING IS DECLARED, NOT
               * INFERRED, AND THE FIRST VERSION INFERRED IT AND WAS WRONG.
               *
               * It tested whether every sampled shading normal was bit-equal
               * to its own face normal, on the argument that this is what
               * `computeVertexNormals()` leaves on a flat-shaded non-indexed
               * geometry. It is — and it is ALSO what correct hand-authored
               * flat normals look like, because a flat surface's correct
               * normal IS its face normal. So the heuristic declined
               * `city:ground`, `traffic:bodies`, every `BoxGeometry` in the
               * project and — fatally — the gate's own `quad-up` control,
               * which is the road surface exactly as it should be. A detector
               * that cannot tell "correct" from "unmeasurable" is a detector
               * that hides the one case the gate was written for.
               *
               * So the declaration is `geometry.userData.noctisNormalsDerived`,
               * set at the site that calls `computeVertexNormals()`. Reading a
               * declaration is normally the mistake CONTRACT §9.1 names — but
               * this one can only ever make a row WEAKER, never greener: it
               * removes a pass the row did not earn and leaves the facing test
               * to decide it. A missing declaration therefore fails safe.
               */
              const derived = !!(g.userData && g.userData.noctisNormalsDerived);

              for (let t = 0; t < triCount; t += stride) {
                tri(t, v0, v1, v2);
                sampled++;
                vol6 += v0.dot(e1.copy(v1).cross(v2));
                e1.subVectors(v1, v0);
                e2.subVectors(v2, v0);
                gn.crossVectors(e1, e2);
                const twoArea = gn.length();
                areaTotal += twoArea * 0.5;
                if (twoArea < 1e-12) continue;
                gn.multiplyScalar(1 / twoArea);
                if (!nrm) continue;
                const ia = idx ? idx.getX(t * 3) : t * 3;
                const ib = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
                const ic = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
                sn.set(0, 0, 0);
                sn.x = nrm.getX(ia) + nrm.getX(ib) + nrm.getX(ic);
                sn.y = nrm.getY(ia) + nrm.getY(ib) + nrm.getY(ic);
                sn.z = nrm.getZ(ia) + nrm.getZ(ib) + nrm.getZ(ic);
                const sl = sn.length();
                if (sl < 1e-9) { areaAmbiguous += twoArea * 0.5; continue; }
                sn.multiplyScalar(1 / sl);
                const d = gn.dot(sn);
                if (d > 0.2) areaAgree += twoArea * 0.5;
                else if (d < -0.2) areaDisagree += twoArea * 0.5;
                else areaAmbiguous += twoArea * 0.5;
              }

              /**
               * CLOSEDNESS, by directed-edge pairing over POSITION-WELDED
               * vertices. Non-indexed geometry duplicates every corner, so an
               * index-based pairing would call every mesh in this project open
               * and the signed volume would never be read. Quantised to 1e-4 m
               * — a tenth of a millimetre, four orders below the smallest
               * authored feature (a 0.12 m lamp arm) and four above float
               * error at city coordinates.
               *
               * A closed orientable surface has every directed edge (a,b)
               * matched by exactly one (b,a). Counting the unmatched ones is
               * cheaper than building a half-edge structure and answers the
               * only question asked of it.
               */
              let closed = null;
              let openEdges = 0;
              if (triCount <= maxTris * 4) {
                const wid = new Map();
                const key3 = (a) => `${Math.round(a.x * 1e4)},${Math.round(a.y * 1e4)},${Math.round(a.z * 1e4)}`;
                const idOf = (a) => {
                  const k = key3(a);
                  let n = wid.get(k);
                  if (n === undefined) { n = wid.size; wid.set(k, n); }
                  return n;
                };
                const edges = new Map();
                const bump = (a, b) => {
                  const k = `${a}>${b}`;
                  edges.set(k, (edges.get(k) || 0) + 1);
                };
                for (let t = 0; t < triCount; t++) {
                  tri(t, v0, v1, v2);
                  const a = idOf(v0);
                  const b = idOf(v1);
                  const c = idOf(v2);
                  bump(a, b); bump(b, c); bump(c, a);
                }
                for (const [k, n] of edges) {
                  const [a, b] = k.split('>');
                  const back = edges.get(`${b}>${a}`) || 0;
                  if (back !== n) openEdges++;
                }
                closed = openEdges === 0;
              }

              stats = {
                geometry: g.uuid,
                tris: triCount,
                sampled,
                stride,
                /** Cubic metres of the geometry's own local space. */
                signedVolume: vol6 / 6,
                area: areaTotal,
                hasNormals,
                /** Declared at the `computeVertexNormals()` site — see above. */
                normalsDerived: hasNormals && derived,
                normalAgree: areaAgree,
                normalDisagree: areaDisagree,
                normalAmbiguous: areaAmbiguous,
                normalAgreement: areaAgree + areaDisagree > 0
                  ? areaAgree / (areaAgree + areaDisagree)
                  : null,
                closed,
                openEdges,
              };
              geomCache.set(g.uuid, stats);
            }

            const name = o.name || '(unnamed)';
            let rec = byMesh.get(name);
            if (!rec) {
              rec = {
                ...stats,
                name,
                names: [name],
                geometries: new Set([stats.geometry]),
                frontArea: 0,
                backArea: 0,
                instances: 0,
                mirroredObjects: 0,
                mirroredInstances: 0,
                determinantMin: detMin,
                determinantMax: detMax,
                side: null,
                material: null,
              };
              byMesh.set(name, rec);
            } else {
              rec.geometries.add(stats.geometry);
              /**
               * Two meshes with one name and different geometries is a naming
               * collision, not a subject. The row keeps the WORST of the two on
               * every test, because a row that averaged them would report a
               * mesh nobody drew.
               */
              rec.tris = Math.max(rec.tris, stats.tris);
              rec.signedVolume = Math.min(rec.signedVolume, stats.signedVolume);
              rec.closed = rec.closed === true && stats.closed === true ? true
                : rec.closed === null || stats.closed === null ? null : false;
              rec.openEdges = Math.max(rec.openEdges, stats.openEdges);
              rec.normalsDerived = rec.normalsDerived || stats.normalsDerived;
              rec.hasNormals = rec.hasNormals && stats.hasNormals;
              if (stats.normalAgreement != null) {
                rec.normalAgreement = rec.normalAgreement == null
                  ? stats.normalAgreement
                  : Math.min(rec.normalAgreement, stats.normalAgreement);
              }
            }
            rec.instances += drawn;
            rec.mirroredObjects += mirroredObject;
            rec.mirroredInstances += mirroredInstances;
            rec.determinantMin = Math.min(rec.determinantMin, detMin);
            rec.determinantMax = Math.max(rec.determinantMax, detMax);
            const mat = Array.isArray(o.material) ? o.material[0] : o.material;
            if (mat) {
              rec.side = mat.side === THREE.DoubleSide ? 'double'
                : mat.side === THREE.BackSide ? 'back' : 'front';
              rec.material = mat.name || mat.type;
            }
            if (!o.visible) return;

            /**
             * Test 3, and it is done HERE rather than in the geometry block
             * because it is a property of the placement: the same triangles
             * drawn through a mirroring matrix face the other way.
             *
             * Bounded at `maxTris` triangles across all of a mesh's instances
             * together — for a 4 000-instance prop mesh that is one instance
             * in eight rather than one triangle in eight, and the sign of an
             * area majority survives either.
             */
            const perInst = Math.max(1, Math.floor(maxTris / Math.max(1, triCount)));
            const instStride = Math.max(1, Math.ceil(drawn / perInst));
            for (let i = 0; i < drawn; i += instStride) {
              if (inst) {
                m4.fromArray(inst.array, i * 16).premultiply(o.matrixWorld);
              } else {
                m4.copy(o.matrixWorld);
              }
              const triStride = Math.max(1, Math.ceil(triCount / Math.max(1, Math.floor(maxTris / 8))));
              /**
               * three's own `frontFaceCW`, applied here rather than described
               * in a comment: a mesh whose WORLD matrix mirrors has its winding
               * convention flipped by the renderer, so the front face is the
               * other side of the cross product. The instance matrix is inside
               * `gn` already and must NOT be compensated, because three does
               * not compensate it either.
               */
              const conv = worldDet < 0 ? -1 : 1;
              for (let t = 0; t < triCount; t += triStride) {
                const ia = idx ? idx.getX(t * 3) : t * 3;
                const ib = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
                const ic = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
                v0.fromBufferAttribute(pos, ia).applyMatrix4(m4);
                v1.fromBufferAttribute(pos, ib).applyMatrix4(m4);
                v2.fromBufferAttribute(pos, ic).applyMatrix4(m4);
                e1.subVectors(v1, v0);
                e2.subVectors(v2, v0);
                gn.crossVectors(e1, e2);
                const twoArea = gn.length();
                if (twoArea < 1e-12) continue;
                cen.copy(v0).add(v1).add(v2).multiplyScalar(1 / 3);
                toEye.subVectors(eye, cen);
                /**
                 * THE MIRRORING IS ALREADY INSIDE `gn` — the cross product of
                 * two edges that were both transformed by a matrix with a
                 * negative determinant comes out reversed — so it is NOT
                 * applied again here. `negativeDeterminant` is counted
                 * separately because a reader needs to know a mirror happened,
                 * not because the arithmetic needs telling twice.
                 */
                if (conv * gn.dot(toEye) > 0) rec.frontArea += twoArea * 0.5 * instStride;
                else rec.backArea += twoArea * 0.5 * instStride;
              }
            }
          });

          const rows = [...byMesh.values()].map((r) => ({
            ...r,
            geometries: r.geometries.size,
            frontFacing: r.frontArea + r.backArea > 0
              ? r.frontArea / (r.frontArea + r.backArea)
              : null,
          }));
          rows.sort((a, b) => a.name.localeCompare(b.name));
          return { eye: [eye.x, eye.y, eye.z], meshes: rows.length, rows };
        },

        /**
         * THE TWO CONTROLS THE WINDING GATE IS CHECKED AGAINST. CONTRACT §7.3.
         *
         * A metric that claims to measure a property of a shape is run over the
         * same code path on a shape that HAS the property and one that does
         * NOT, and both directions are required. `darkFraction` scored 0.646 on
         * the flat grey boxes it existed to reject because nobody had ever fed
         * it a shape that had the property; a winding metric that answered
         * "outward" to everything would pass every falsifying case §7.1 can
         * write, because those hand an assertion a number and never compute
         * one.
         *
         * So the controls are REAL MESHES IN THE LIVE SCENE, walked by
         * `windingCensus` exactly as the city is. Not a fixture built in node,
         * which is §7.3.1's mistake in advance: the render path — the instance
         * matrices, the world matrix, the material's `side` — is part of the
         * code path, and a control that skips it certifies the arithmetic
         * rather than the instrument.
         *
         * FOUR of them, because the three tests have three independent ways to
         * fail and the fourth is the one no attribute can see:
         *
         *   winding:control:good      a closed box, correct order. MUST PASS.
         *   winding:control:reversed  the same box, index reversed. MUST FAIL
         *                             on signed volume AND on front-facing.
         *   winding:control:quad-up   an open horizontal quad below the eye,
         *                             normals (0,1,0), wound counter-clockwise
         *                             from above. MUST PASS. This is the road
         *                             surface as it should always have been.
         *   winding:control:quad-down the SAME quad with the session-12 vertex
         *                             order and the SAME (0,1,0) normals —
         *                             `buildGround`'s defect, reproduced
         *                             exactly. MUST FAIL on normal agreement
         *                             and on front-facing, and it is CLOSED-
         *                             blind: a quad has no volume, so test 1
         *                             declines it and the row proves the other
         *                             two are load-bearing rather than
         *                             decorative.
         *
         * They are added on request and removed on release, they are never
         * present during a gate's own census, and `windingControlsActive()`
         * says which it is — because a control mesh left in a delivered frame
         * is content nobody authored.
         */
        windingControls(on) {
          if (!on) {
            for (const m of windingControlMeshes) {
              ctx.scene.remove(m);
              m.geometry.dispose();
              m.material.dispose();
            }
            windingControlMeshes.length = 0;
            return { active: false, names: [] };
          }
          if (windingControlMeshes.length) {
            return { active: true, names: windingControlMeshes.map((m) => m.name) };
          }
          const eye = new THREE.Vector3();
          ctx.camera.getWorldPosition(eye);
          /** Well below the eye and well outside the block, so nothing is occluded. */
          const base = new THREE.Vector3(eye.x + 4000, eye.y - 30, eye.z + 4000);
          const mat = () => new THREE.MeshBasicMaterial({ color: 0x808080, side: THREE.FrontSide });

          const box = new THREE.BoxGeometry(2, 2, 2);
          const good = new THREE.Mesh(box, mat());
          good.name = 'winding:control:good';
          good.position.copy(base);

          const rev = box.clone().toNonIndexed();
          {
            const p = rev.getAttribute('position');
            const n = rev.getAttribute('normal');
            for (let t = 0; t < p.count; t += 3) {
              for (const a of [p, n]) {
                const x = a.getX(t + 1), y = a.getY(t + 1), z = a.getZ(t + 1);
                a.setXYZ(t + 1, a.getX(t + 2), a.getY(t + 2), a.getZ(t + 2));
                a.setXYZ(t + 2, x, y, z);
              }
            }
            /**
             * The NORMALS ARE SWAPPED WITH THE POSITIONS AND NOT NEGATED, so
             * this control is a mesh whose authored normals still point
             * outward while its triangles wind inward — which is exactly the
             * defect, and is why test 2 can see it. Negating them too would
             * make a consistently-inverted mesh, which test 2 would call fine
             * and only tests 1 and 3 would catch.
             */
          }
          const reversed = new THREE.Mesh(rev, mat());
          reversed.name = 'winding:control:reversed';
          reversed.position.set(base.x + 6, base.y, base.z);

          /**
           * The two quads, authored by hand in the same order `buildGround`
           * uses, so the negative control IS the delivered defect rather than
           * a description of it. 10 m square, 5 m below the eye plane.
           */
          const quadGeo = (up) => {
            const y = 0;
            const v = up
              ? [[-5, y, -5], [5, y, 5], [5, y, -5], [-5, y, -5], [-5, y, 5], [5, y, 5]]
              : [[-5, y, -5], [5, y, -5], [5, y, 5], [-5, y, -5], [5, y, 5], [-5, y, 5]];
            const p = new Float32Array(18);
            const n = new Float32Array(18);
            for (let i = 0; i < 6; i++) {
              p[i * 3] = v[i][0]; p[i * 3 + 1] = v[i][1]; p[i * 3 + 2] = v[i][2];
              n[i * 3] = 0; n[i * 3 + 1] = 1; n[i * 3 + 2] = 0;
            }
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(p, 3));
            g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
            g.computeBoundingSphere();
            return g;
          };
          const qUp = new THREE.Mesh(quadGeo(true), mat());
          qUp.name = 'winding:control:quad-up';
          qUp.position.set(base.x, base.y - 5, base.z + 20);
          const qDown = new THREE.Mesh(quadGeo(false), mat());
          qDown.name = 'winding:control:quad-down';
          qDown.position.set(base.x + 20, base.y - 5, base.z + 20);

          windingControlMeshes.push(good, reversed, qUp, qDown);
          for (const m of windingControlMeshes) {
            m.frustumCulled = false;
            m.updateMatrixWorld(true);
            ctx.scene.add(m);
          }
          return { active: true, names: windingControlMeshes.map((m) => m.name) };
        },

        windingControlsActive() {
          return windingControlMeshes.length > 0;
        },

        /**
         * The centroid of the live control cluster, so a caller can put its own
         * eye points around it without knowing where `windingControls` chose to
         * stand them. Null when no controls are live — a caller that asks for
         * the centre of nothing gets nothing rather than the origin, which is a
         * real place in this world.
         */
        windingControlCentre() {
          if (!windingControlMeshes.length) return null;
          const c = new THREE.Vector3();
          const p = new THREE.Vector3();
          for (const m of windingControlMeshes) c.add(m.getWorldPosition(p));
          c.multiplyScalar(1 / windingControlMeshes.length);
          return [c.x, c.y, c.z];
        },

        /**
         * The particle layers the scene declares, read off the live objects.
         * Empty until 4b ships rain — and empty is a FAILURE and not a pass,
         * because `tools/budget.json` carries a bound for them and a bound
         * nobody measures is not a bound (CONTRACT §10 step 3).
         *
         * A layer declares itself by putting `noctisParticleLayer` on an
         * InstancedMesh's userData: `{ name, maxAreaPx, clampCompileTime }`.
         * The COUNT is never taken from there — it comes from
         * `instanceMatrix.count`, which is the number that will be drawn.
         */
        particleLayers() {
          const layers = [];
          ctx.scene.traverse((o) => {
            const d = o.userData && o.userData.noctisParticleLayer;
            if (!d || !o.isInstancedMesh) return;
            const allocated = o.instanceMatrix ? o.instanceMatrix.count : 0;
            layers.push({
              name: d.name || o.name || 'unnamed',
              allocated,
              drawn: o.count,
              /**
               * The screen-area clamp, and whether it is compile-time. A clamp
               * in a uniform is a clamp that can change at runtime, which is a
               * clamp nobody can budget — the same rule §5.8 applies to the SSR
               * march's step count. Read from the material's own `defines` so
               * the answer is the shader's and not the author's.
               */
              maxAreaPx: d.maxAreaPx != null ? d.maxAreaPx : null,
              clampCompileTime: !!(
                o.material &&
                o.material.defines &&
                o.material.defines.NOCTIS_PARTICLE_MAX_AREA_PX != null
              ),
              declaredDefine: o.material && o.material.defines
                ? o.material.defines.NOCTIS_PARTICLE_MAX_AREA_PX
                : null,
            });
          });
          return layers;
        },

        /**
         * SCREEN-SPACE SILHOUETTES OF THE MOVING CONTENT, so a gate can measure
         * what a vehicle looks like rather than how many kinds of vehicle there
         * are. CONTRACT §7.1, second rule.
         *
         * WHAT THIS RETURNS AND WHAT IT DELIBERATELY DOES NOT. It returns the
         * projected corners of every body box of every visible vehicle and
         * pedestrian, in SCREENSHOT PIXELS, plus each box's view depth. It does
         * NOT return a colour, a luminance or a verdict. The gate rasterises
         * these polygons against `page.screenshot()` — the delivered frame, the
         * same bytes a person opens — and every number it asserts on comes from
         * those pixels.
         *
         * That split is the whole point and it is CONTRACT §8's rule about
         * `showMotion` applied one system across. The obvious way to measure a
         * silhouette is to render a mask pass and count it, and a gate that
         * does so has stopped measuring the frame that ships: a mask is a
         * picture the operator created. What an instrument may supply is a
         * DESCRIPTION of where the geometry is, which is what `sceneCensus`
         * supplies about how much of it there is.
         *
         * THE PROJECTION IS UN-JITTERED AND THAT IS NOT AN OVERSIGHT. post.js
         * adds the TAA jitter to `camera.projectionMatrix` immediately before
         * the scene pass and subtracts it immediately after (§5.10), so the
         * matrix standing here between frames is the un-jittered one — which is
         * also the one the TAA resolve is aligned to, because "every texel of a
         * TAA output is at its pixel centre". Projecting with the jittered
         * matrix would be half a pixel wrong against the frame it is measuring.
         *
         * A mesh joins this census by declaring `userData.noctisSilhouette`:
         * `{ kind, group }`, where `group` is how many consecutive instance
         * rows make up one subject. The label is written where the mesh is
         * assembled, for the reason §9.1 gives: a refactor that merges meshes
         * erases the category, and the label has to exist where the category
         * still does.
         */
        silhouettes(opts = {}) {
          const cam = ctx.camera;
          cam.updateMatrixWorld();
          const viewProj = new THREE.Matrix4().multiplyMatrices(
            cam.projectionMatrix,
            cam.matrixWorldInverse
          );
          // Screenshot pixels. `ctx.size` is the drawing buffer and at the
          // gate's dpr of 1 it is also the internal render resolution (§5.10);
          // both are returned so the gate can assert against the PNG it decoded
          // rather than assume they agree.
          const W = ctx.size.width;
          const H = ctx.size.height;
          const post = ctx.get('post');

          const m = new THREE.Matrix4();
          const v = new THREE.Vector3();
          const vi = cam.matrixWorldInverse.elements;

          const meshes = [];
          const problems = [];
          ctx.scene.traverse((o) => {
            const d = o.userData && o.userData.noctisSilhouette;
            if (!d || !o.isInstancedMesh || !o.visible) return;
            /**
             * A PALETTE-ONLY DECLARATION IS NOT A SILHOUETTE SUBJECT, AND IT
             * SAYS SO RATHER THAN BEING INFERRED.
             *
             * Session 14: the stall awnings joined `instanceColourPalette`,
             * which reads this same `noctisSilhouette` key, and a stall has no
             * outline any gate measures. The first version of this guard tested
             * `!d.partVertices` — and `partVertices` means "this subject is one
             * strided mesh", which a PEDESTRIAN is and a VEHICLE is not: a
             * vehicle is a group of instances and declares `group` instead. So
             * the guard removed all 16 vehicles from the census, `perfcheck`
             * reported `0 vehicle silhouettes measurable (min 6) — UNRUN`, and
             * the whole §7.2 vehicle suite went quiet in the same session that
             * added a gate about quantities used as other quantities.
             *
             * It is the same lesson as `noctisNormalsDerived` two files over: a
             * property that can only be inferred from a proxy is declared by
             * the thing that has it. `paletteOnly` is that declaration, and its
             * absence fails safe — a mesh that forgets it is MEASURED rather
             * than skipped.
             */
            if (d.paletteOnly) return;
            meshes.push({ mesh: o, d });
          });

          /**
           * TWO MESHES CAN BE ONE SUBJECT. A pedestrian is a frame mesh and a
           * torso mesh sharing an instance index, because the garment is tinted
           * separately; measuring the frame alone would score a figure with a
           * hole where its chest is. A label may therefore name a `subject`,
           * and rows with the same subject name and the same index are merged.
           * Absent, the mesh is its own subject, which is what a vehicle is.
           */
          const merged = new Map();

          for (const { mesh, d } of meshes) {
            const kind = d.kind || mesh.name;
            const group = Math.max(1, d.group || 1);
            const subjectKey = d.subject || mesh.uuid;

            /**
             * THE PART BOXES COME OFF THE GEOMETRY'S OWN VERTICES.
             *
             * traffic draws one `BoxGeometry(1,1,1)` per instance row, so a row
             * IS a box and the bounds are the geometry's. streetlife merges six
             * boxes into one geometry and draws a whole person in one row, so
             * the parts have to be recovered — and recovering them from the
             * position attribute recovers what is DRAWN, where reading them out
             * of the body-type table would recover what was authored. §9.1: a
             * gate that reads config verifies the config.
             *
             * `partVertices` is 36, which is what `BoxGeometry.toNonIndexed()`
             * produces, and it is asserted to divide the vertex count exactly.
             * A label that has drifted from its geometry is reported rather
             * than silently producing one part of the wrong size.
             */
            const pos = mesh.geometry.attributes.position;
            const partVerts = d.partVertices || 0;
            if (partVerts > 0 && pos.count % partVerts !== 0) {
              problems.push(
                `${mesh.name}: partVertices ${partVerts} does not divide ${pos.count} vertices`
              );
              continue;
            }
            /**
             * THE PART'S OWN VERTICES, AND THE FIRST VERSION USED ITS BOUNDING
             * BOX. The outline of a convex solid entirely in front of the eye is
             * the convex hull of its PROJECTED VERTICES; the hull of its
             * bounding box's eight corners is that outline only when the solid
             * IS a box.
             *
             * MEASURED, and it is why this is written out rather than quietly
             * corrected. A wheel is a ten-sided cylinder and its bounding box is
             * a square: at 5% of the radius above the ground the tyre covers
             * sqrt(1 - 0.9025) = 31% of the box's width, so the bottom rows of a
             * box mask are about 70% ROAD. The ground-contact assertion measures
             * exactly those rows, and it read the road: six vehicles of
             * twenty-two scored a ground band BRIGHTER than their own body, one
             * of them by 4.25x, with the darkest wheels in the project directly
             * under them.
             *
             * Deduplicated and cached on the geometry, because a `BoxGeometry`
             * carries each corner three times and a cylinder carries its rim
             * twice — 24 vertices become 8 and the hull is over the same set.
             */
            let parts = mesh.geometry.userData.noctisSilhouetteParts;
            if (!parts) {
              parts = [];
              const stride = partVerts > 0 ? partVerts : pos.count;
              for (let p = 0; p < pos.count; p += stride) {
                const seen = new Set();
                const verts = [];
                for (let k = p; k < p + stride; k++) {
                  const x = pos.getX(k); const y = pos.getY(k); const z = pos.getZ(k);
                  const key = `${Math.round(x * 4096)},${Math.round(y * 4096)},${Math.round(z * 4096)}`;
                  if (seen.has(key)) continue;
                  seen.add(key);
                  verts.push(x, y, z);
                }
                parts.push(verts);
              }
              mesh.geometry.userData.noctisSilhouetteParts = parts;
              /**
               * THE GAIT ATTRIBUTE, ONE READING PER PART — session 10, and it
               * is the reason this cache grew a second array rather than the
               * measurement growing a caveat.
               *
               * streetlife's pedestrians are displaced in the VERTEX SHADER
               * (`src/lib/gait.js`, injected by lights.js): the legs shear fore
               * and aft by up to half a step, the body bobs. Projecting the
               * authored rest pose and calling it the delivered silhouette
               * would hand the gate a figure standing still while the frame
               * shows one walking, with the legs up to 0.375 m from where the
               * mask has them — CONTRACT §9's shape with a pose in it, and §7.2
               * is explicit that the paired assertion measures the DELIVERED
               * artefact.
               *
               * `noctisLimb` is constant over a part by construction — it is
               * baked per part in `loftToGeometry` — so one reading at the
               * part's first vertex IS the part's, and the dedup above (which
               * loses the vertex index) costs nothing. A geometry without the
               * attribute reads null and is projected undisplaced, which is
               * every vehicle, stall and building in the project.
               */
              const limbAttr = mesh.geometry.attributes.noctisLimb;
              const limbs = [];
              for (let p = 0; p < pos.count; p += stride) {
                limbs.push(limbAttr ? [limbAttr.getX(p), limbAttr.getY(p)] : null);
              }
              mesh.geometry.userData.noctisSilhouettePartLimbs = limbs;
            }
            const partLimbs = mesh.geometry.userData.noctisSilhouettePartLimbs;
            const gaitAttr = d.gait ? mesh.geometry.attributes.noctisGait : null;

            const rows = mesh.count != null ? mesh.count : mesh.instanceMatrix.count;
            for (let base = 0; base < rows; base += group) {
              const id = `${subjectKey}#${base / group}`;
              let sub = merged.get(id);
              if (!sub) {
                sub = {
                  kind, near: Infinity, far: -Infinity, behind: false, boxes: [],
                  boxAlong: [], boxUp: [], profile: false, frame: null,
                };
                merged.set(id, sub);
              }
              // OR-ed rather than assigned at creation. A vehicle is two meshes
              // — bodies and wheels — and only the body mesh declares the
              // profile label, so whichever of the two `traverse` reaches first
              // must not decide the answer for the subject.
              if (d.profile) sub.profile = true;
              for (let r = base; r < Math.min(rows, base + group); r++) {
                mesh.getMatrixAt(r, m);
                m.premultiply(mesh.matrixWorld);
                /**
                 * THE SUBJECT'S OWN AXES, TAKEN OFF THE INSTANCE MATRIX AND NOT
                 * OFF A BODY-TYPE TABLE. §7.3 asks for the top edge sampled
                 * along the vehicle's long axis, and the long axis is the thing
                 * that has to come from somewhere. `traffic.js` writes every row
                 * as `compose(position, yaw, scale)`, so the composed matrix's
                 * normalised columns ARE the vehicle's right / up / heading —
                 * and every row of one vehicle carries the same yaw, so the
                 * basis is the same whichever row is seen first. Reading the
                 * heading out of the module's own table instead would be §9.1's
                 * gate-that-reads-config with a direction in it.
                 */
                if (!sub.frame) {
                  const e = m.elements;
                  const nr = Math.hypot(e[0], e[1], e[2]) || 1;
                  const nu = Math.hypot(e[4], e[5], e[6]) || 1;
                  const nf = Math.hypot(e[8], e[9], e[10]) || 1;
                  sub.frame = {
                    o: [e[12], e[13], e[14]],
                    right: [e[0] / nr, e[1] / nr, e[2] / nr],
                    up: [e[4] / nu, e[5] / nu, e[6] / nu],
                    fwd: [e[8] / nf, e[9] / nf, e[10] / nf],
                    a0: Infinity, a1: -Infinity,
                    u0: Infinity, u1: -Infinity,
                    l0: Infinity, l1: -Infinity,
                  };
                }
                const F = sub.frame;
                /**
                 * This instance's gait state, in the same (u, amp) the shader
                 * reads out of `noctisGait.xz`. `.yw` is the previous frame's
                 * and belongs to the motion vector, not to where the figure is
                 * drawn now.
                 */
                const gaitU = gaitAttr ? gaitAttr.getX(r) : 0;
                const gaitAmp = gaitAttr ? gaitAttr.getZ(r) : 0;
                for (let pi = 0; pi < parts.length; pi++) {
                  const p = parts[pi];
                  const limb = partLimbs && partLimbs[pi];
                  const pts = [];
                  let boxNear = Infinity;
                  /**
                   * THE PART'S OWN EXTENT ALONG THE SUBJECT'S LONG AXIS, AND IT
                   * IS THE FIX FOR THE ROOFLINE. CONTRACT §7.3.
                   *
                   * The gate's mask is a UNION of the per-box hulls with no
                   * depth test between a subject's own parts, and the roofline
                   * read the topmost pixel of that union above each station. A
                   * box of length `l` and width `w` seen at `theta` from
                   * broadside projects an image-horizontal span of
                   * `l*cos(theta) + w*sin(theta)`, which GROWS as the subject
                   * turns away, while the sampled axis projects
                   * `L*(1-2*trim)*cos(theta)`, which SHRINKS. Past about 0.86 of
                   * the second by the first, a tall box's hull covers every
                   * station and the roofline reads the tall box at all of them.
                   *
                   * MEASURED, through the whole render path, by
                   * `tools/hullprobe.mjs`: a reference-era three-box body scored
                   * 0.319 / 0.318 / 0.172 / 0.021 at 0 / 25 / 30 / 39 degrees
                   * against a 0.30 floor, and the delivered wedge went 0.208 at
                   * broadside to 0.015 by 20 degrees. At three-quarter view a
                   * prism, a three-box saloon and the wedge all returned ~0.02:
                   * three shapes, one answer, which is `$DISCARDED_darkFraction`
                   * one level down and in the mask rather than the statistic.
                   *
                   * A DEPTH-ORDERED MASK CANNOT FIX IT and that is why this is
                   * an extent rather than a depth. The reading is SET MEMBERSHIP
                   * in the union; ordering the pixels by depth assigns each an
                   * owner and changes the set by nothing. Nor is there anything
                   * spurious to remove — a convex box's outline IS the hull of
                   * its projected vertices, so those pixels really are cabin.
                   * What was wrong is attributing a pixel above station `a` to
                   * station `a`. So the gate is told which stations each box
                   * SPANS, and reads a station against those boxes only.
                   *
                   * In the subject's own frame and in metres, the same
                   * coordinate `F.a0`/`F.a1` and the station positions are in.
                   * Accumulated in this loop because the vertex is already in
                   * hand and already being resolved against the frame.
                   */
                  let boxA0 = Infinity;
                  let boxA1 = -Infinity;
                  /**
                   * AND THE PART'S OWN EXTENT ALONG THE SUBJECT'S UP AXIS, which
                   * is the same fix one axis over and is what the WIDTH profile
                   * needs. §7.5.
                   *
                   * The width reading probes ACROSS the subject at one height,
                   * and every box the probe's image line happens to cross would
                   * otherwise be a candidate for it — including the wheels,
                   * whose lateral centres are near the body's own half-width and
                   * whose along extent is short, so at a wheel station they
                   * would report a wider body than the panel above them. That is
                   * a spurious width CHANGE along the length, which is the
                   * lenient direction: the metric would reward a body for having
                   * wheels rather than for tapering.
                   *
                   * So a station is read against the boxes that span it along the
                   * axis AND straddle the probe height, which is the body side
                   * and nothing else. Accumulated here because `lu` is already
                   * being resolved against the frame two lines below.
                   */
                  let boxU0 = Infinity;
                  let boxU1 = -Infinity;
                  for (let c = 0; c < p.length; c += 3) {
                    v.set(p[c], p[c + 1], p[c + 2]);
                    if (limb && gaitAmp !== 0) {
                      // The same displacement the vertex shader applies, from
                      // the same source file. `p[c+1]` is the AUTHORED height,
                      // which is what the shader passes too — it reads
                      // `position.y` and not `transformed.y`, because a limb's
                      // reach below its pivot is a property of the body rather
                      // than of the pose.
                      const g = gaitOffset(limb[0], limb[1], p[c + 1], gaitU, gaitAmp);
                      v.y += g.dy;
                      v.z += g.dz;
                    }
                    v.applyMatrix4(m);
                    // View-space depth. Row 2 of the view matrix, which in
                    // three's column-major elements is indices 2, 6, 10, 14 —
                    // negated because the camera looks down -Z.
                    const z = -(v.x * vi[2] + v.y * vi[6] + v.z * vi[10] + vi[14]);
                    if (z < boxNear) boxNear = z;
                    // A corner behind the eye projects to a point on the wrong
                    // side of the frame. One is enough to make the polygon
                    // meaningless, so the subject is dropped rather than
                    // clipped — a gate that clips measures a shape it invented.
                    if (z <= 0.05) sub.behind = true;
                    // The subject's own extent, in ITS frame and in metres.
                    // Taken here, from the same world position the polygon is
                    // projected from, because the wheels and the light lines are
                    // part of the subject and the extent has to be the delivered
                    // one rather than the body table's `len`. Accumulated for
                    // every subject and not only for the labelled ones, because
                    // the label arrives with whichever mesh `traverse` reaches
                    // first and the wheels must be inside the extent whether
                    // they came before the hull or after it.
                    {
                      const dx = v.x - F.o[0];
                      const dy = v.y - F.o[1];
                      const dz = v.z - F.o[2];
                      const la = dx * F.fwd[0] + dy * F.fwd[1] + dz * F.fwd[2];
                      const lu = dx * F.up[0] + dy * F.up[1] + dz * F.up[2];
                      const ll = dx * F.right[0] + dy * F.right[1] + dz * F.right[2];
                      if (la < F.a0) F.a0 = la;
                      if (la > F.a1) F.a1 = la;
                      if (la < boxA0) boxA0 = la;
                      if (la > boxA1) boxA1 = la;
                      if (lu < boxU0) boxU0 = lu;
                      if (lu > boxU1) boxU1 = lu;
                      if (lu < F.u0) F.u0 = lu;
                      if (lu > F.u1) F.u1 = lu;
                      if (ll < F.l0) F.l0 = ll;
                      if (ll > F.l1) F.l1 = ll;
                    }
                    v.applyMatrix4(viewProj);
                    pts.push(
                      +((v.x * 0.5 + 0.5) * W).toFixed(2),
                      +((1 - (v.y * 0.5 + 0.5)) * H).toFixed(2)
                    );
                  }
                  if (boxNear < sub.near) sub.near = boxNear;
                  if (boxNear > sub.far) sub.far = boxNear;
                  sub.boxes.push(pts);
                  /**
                   * PARALLEL TO `boxes` AND NOT INSIDE IT. Everything that reads
                   * `boxes` reads a flat run of x, y pairs — `measureSubject`
                   * hulls it, `measureSilhouettes` fills it into the occlusion
                   * mask, and `perfcheck --falsify`'s fixture writes it by hand.
                   * Changing the element type would have meant changing all
                   * three to add a number none of them uses.
                   */
                  sub.boxAlong.push([boxA0, boxA1]);
                  sub.boxUp.push([boxU0, boxU1]);
                }
              }
            }
          }

          /**
           * THE STATION SEGMENTS, WHICH ARE WHERE GEOMETRY PROJECTS TO AND
           * NOTHING ELSE. CONTRACT §7.3.
           *
           * At each of `stations` positions along the subject's own long axis
           * this returns the projected image segment from the bottom of the
           * subject to `overshoot` times its own height, on the subject's
           * longitudinal mid-plane. The gate walks each segment in the
           * DELIVERED screenshot's mask and reports how far up it the silhouette
           * reaches; the harness supplies no colour, no luminance and no
           * verdict, exactly as for the polygons above.
           *
           * WHY A SEGMENT RATHER THAN A HEIGHT. A roof height read in pixels is
           * a height in pixels of a thing at some distance, and both ends of a
           * vehicle are at different distances, so a profile in pixels carries
           * the perspective foreshortening as though it were shape — measured on
           * a 4.9 m body at 20 m in three-quarter view, ±8.7% of the roof height
           * from geometry that is exactly flat. A segment normalises it away: the
           * ground point and the roof point at one station are at the SAME depth,
           * so the fraction of the segment the silhouette reaches is the
           * subject's own height fraction whatever the distance.
           *
           * `subSamples` per station and the gate takes their MAXIMUM, so the
           * profile is the roofline's upper envelope over the band rather than a
           * point sample of it. Without that a 0.15 m gap between a hauler's cab
           * and its trailer reads as a height change of two thirds of the
           * vehicle, which is a sampling accident wearing the costume of a
           * finding.
           *
           * TRIMMED at both ends, because the outermost few per cent of a
           * vehicle's length is a wheel, a bumper or the antialiased edge of
           * one, and a roofline that included them would report the wheel as a
           * level.
           */
          const N = Math.max(2, opts.stations || 12);
          const K = Math.max(1, opts.subSamples || 3);
          const TRIM = opts.trim != null ? opts.trim : 0.10;
          const OVER = opts.overshoot || 1.15;
          /**
           * THE WIDTH PROBE'S TWO PARAMETERS. §7.5, the sibling of the roofline
           * one axis over: at the same stations, a segment ACROSS the subject at
           * one height, and the gate reports how much of it the subject's own
           * side panels cover.
           *
           * `latOvershoot` is the roofline's `overshoot` on the lateral axis and
           * is there for the same reason plus one more. Same reason: the probe
           * has to reach past the geometry or every station clips to 1.000 and a
           * tapered body reports a prism's span. One more: a subject's own box
           * hulls have no depth test between them, so a box of along-extent `l`
           * lets a probe point up to `l*cot(theta)` outside the true width find a
           * point of that same box at the same image position — an ADDITIVE
           * inflation that the probe must be long enough to contain, or the
           * reading saturates and the station is declined.
           *
           * `latHeight` is the fraction of the subject's own height the probe
           * stands at, and 0.50 is the centre of `silhouettes.bodyBand` — the
           * band that block already establishes is the body side on every type
           * and contains no glazing. Both come IN from budget.json for the same
           * reason `stations` does: an instrument that held its own thresholds
           * would be a second copy of them.
           */
          const LATOVER = opts.latOvershoot || 1.60;
          const LATH = opts.latHeight != null ? opts.latHeight : 0.50;

          const subjects = [];
          for (const s of merged.values()) {
            if (s.behind || !s.boxes.length) continue;
            const out = {
              kind: s.kind,
              near: +s.near.toFixed(2),
              far: +s.far.toFixed(2),
              boxes: s.boxes,
            };
            const F = s.frame;
            if (s.profile && F && F.a1 > F.a0 && F.u1 > F.u0) {
              const lengthM = F.a1 - F.a0;
              const heightM = F.u1 - F.u0;
              const latMid = (F.l0 + F.l1) / 2;
              const aLo = F.a0 + lengthM * TRIM;
              const aHi = F.a1 - lengthM * TRIM;
              const band = (aHi - aLo) / N;
              const segs = [];
              /**
               * WHERE ALONG THE SUBJECT EACH SEGMENT STANDS, one entry per
               * segment, in the same frame metres as `boxAlong` above.
               *
               * Emitted rather than left for the gate to recompute from
               * `lengthM`, `trim`, `stations` and `subSamples`, all of which it
               * has. Recomputing would be a SECOND COPY of the four lines
               * below, and the failure mode of a second copy is the one this
               * project keeps meeting: the two drift, every station maps to the
               * wrong box, and the number stays plausible. §9.1.
               */
              const alongs = [];
              /**
               * ONE PROJECTOR, AND IT RETURNS THE VIEW DEPTH AS WELL.
               *
               * The depth is what the WIDTH probe needs and the roofline does
               * not. A roofline segment's two ends are at the same station and
               * the same lateral offset, so they sit at the same depth and the
               * image is a linear map of the segment's own parameter — which is
               * the whole reason §7.4 reads a fraction of a segment. A LATERAL
               * segment's two ends are at DIFFERENT depths by `widthM*cos(theta)`
               * of the view axis, so image fraction is not parameter fraction,
               * and a reading in image fractions would carry the perspective as
               * though it were shape. The two endpoint depths are enough for the
               * gate to walk the probe in its own parameter exactly.
               */
              const projectAt = (a, h, l) => {
                v.set(
                  F.o[0] + F.fwd[0] * a + F.up[0] * h + F.right[0] * l,
                  F.o[1] + F.fwd[1] * a + F.up[1] * h + F.right[1] * l,
                  F.o[2] + F.fwd[2] * a + F.up[2] * h + F.right[2] * l
                );
                const z = -(v.x * vi[2] + v.y * vi[6] + v.z * vi[10] + vi[14]);
                v.applyMatrix4(viewProj);
                return [
                  +((v.x * 0.5 + 0.5) * W).toFixed(2),
                  +((1 - (v.y * 0.5 + 0.5)) * H).toFixed(2),
                  z,
                ];
              };
              const project = (a, h) => projectAt(a, h, latMid);
              /**
               * THE PROBE'S HALF-EXTENT, IN METRES, DERIVED FROM THE SUBJECT'S
               * OWN DELIVERED LATERAL EXTENT AND NOT FROM A BODY TABLE. §9.1.
               * Printed beside the width it is derived from, §9 rule 4:
               * `widthM` is what the geometry spans, `latHalfM` is
               * `widthM/2 * latOvershoot` and is what the probe reaches to.
               */
              const widthM = F.l1 - F.l0;
              const latHalfM = (widthM / 2) * LATOVER;
              const latHeightM = F.u0 + heightM * LATH;
              const latSegs = [];
              const latZ = [];
              for (let i = 0; i < N; i++) {
                for (let j = 0; j < K; j++) {
                  const a = aLo + band * (i + (j + 0.5) / K);
                  const b = project(a, F.u0);
                  const t = project(a, F.u0 + heightM * OVER);
                  segs.push([b[0], b[1], t[0], t[1]]);
                  alongs.push(+a.toFixed(4));
                  const p0 = projectAt(a, latHeightM, latMid - latHalfM);
                  const p1 = projectAt(a, latHeightM, latMid + latHalfM);
                  latSegs.push([p0[0], p0[1], p1[0], p1[1]]);
                  latZ.push([+p0[2].toFixed(4), +p1[2].toFixed(4)]);
                }
              }
              const e0 = project(aLo, F.u0);
              const e1 = project(aHi, F.u0);
              out.profile = {
                stations: N,
                subSamples: K,
                overshoot: OVER,
                lengthM: +lengthM.toFixed(3),
                heightM: +heightM.toFixed(3),
                // The projected length of the sampled axis, in screenshot
                // pixels. A vehicle seen end-on has a long axis that projects to
                // nothing, and a roof profile squeezed into a handful of columns
                // is a measurement of the resampler. The gate applies the bound;
                // this only reports the number it is applied to.
                alongPx: +Math.hypot(e1[0] - e0[0], e1[1] - e0[1]).toFixed(1),
                segments: segs,
                /**
                 * WHICH STATIONS EACH BOX SPANS, aligned by index with
                 * `boxes` above. Inside `profile` rather than beside it,
                 * because the roofline is the only reader and a pedestrian —
                 * which declares no profile, and there are 52 of them against
                 * 20 vehicles — should not carry six extra pairs it never uses.
                 */
                boxAlong: s.boxAlong.map((r) => [+r[0].toFixed(4), +r[1].toFixed(4)]),
                stationAlong: alongs,
                /**
                 * THE WIDTH PROBE. §7.5. One lateral segment per station
                 * sub-sample, aligned by index with `segments` above, plus each
                 * box's own extent in the subject's up axis so the gate can pick
                 * the boxes that straddle the probe rather than every box whose
                 * hull the probe's image line crosses.
                 *
                 * `latHalfM` is the probe's own half-extent in metres, so the
                 * gate's reading — the covered fraction of the probe — converts
                 * to units of the subject's own width by multiplying by
                 * `latOvershoot` and nothing else.
                 */
                boxUp: s.boxUp.map((r) => [+r[0].toFixed(4), +r[1].toFixed(4)]),
                widthM: +widthM.toFixed(3),
                latOvershoot: LATOVER,
                latHalfM: +latHalfM.toFixed(4),
                latHeightM: +latHeightM.toFixed(4),
                latHeightFraction: LATH,
                latSegments: latSegs,
                latZ,
              };
            }
            subjects.push(out);
          }

          return {
            width: W,
            height: H,
            internal: post && post.internalSize ? post.internalSize : null,
            fovY: cam.fov,
            problems,
            subjects,
          };
        },

        /**
         * THE PALETTE THE INSTANCE ATTRIBUTE ACTUALLY HOLDS, read off the live
         * `instanceColor` buffers of the same meshes `silhouettes()` walks.
         *
         * This exists to be printed NEXT TO the colour the gate measures in the
         * frame, which is CONTRACT §9 rule 2: a quantity derived two ways is
         * printed both ways at least once. The two answer different questions
         * and the project has already been burned by conflating them —
         * `instanceColor` was nearly reported dead in session 5 because
         * three's VERTEX prefix defines `USE_COLOR` from `vertexColors` alone
         * while its FRAGMENT prefix defines it from
         * `vertexColors || instancingColor || batchingColor`. Reading one of two
         * prefixes and concluding is the whole mistake, and reading neither and
         * assuming is a larger one.
         *
         * So: this is what was WRITTEN. The gate's cluster count is what
         * ARRIVED. If the first is six and the second is one, the attribute is
         * not reaching `diffuseColor` and no amount of adding palette entries
         * will change a pixel.
         */
        instanceColourPalette() {
          const out = {};
          ctx.scene.traverse((o) => {
            const d = o.userData && o.userData.noctisSilhouette;
            /**
             * `palette: true` AND NOT EVERY MESH THAT HAS AN instanceColor.
             * A vehicle's wheels carry an instance colour too and it is one
             * tyre black on all 640 of them; counting it would add a cluster to
             * the WRITTEN palette that the frame is then expected to deliver,
             * and the comparison this instrument exists for would be between a
             * body palette and a body-plus-tyres palette. The flag says which
             * mesh holds the colour the assertion is about.
             */
            if (!d || !d.palette || !o.isInstancedMesh) return;
            /**
             * WHICH BUFFER HOLDS THE COLOUR THE ASSERTION IS ABOUT — session
             * 10. A vehicle's is `instanceColor`, which three multiplies into
             * `diffuseColor` for us. A pedestrian's garment is one of TWO
             * per-instance colours selected by a per-vertex mask in the vertex
             * shader (lights.js `GARMENT_VERTEX`), so the mesh carries no
             * `instanceColor` at all and reading one would report nothing —
             * which is §7.1's quiet gate, arriving as an empty palette that
             * every cluster count would then agree with.
             *
             * The label names the attribute rather than this guessing from
             * what is present, for the reason §9.1 gives about comments that
             * claim a check: the mesh that owns the colour is the only thing
             * that knows which buffer it put it in.
             */
            const src = d.paletteAttribute
              ? o.geometry.attributes[d.paletteAttribute]
              : o.instanceColor;
            if (!src) return;
            const arr = src.array;
            const rows = src.count;
            const step = Math.max(1, d.group || 1);
            const seen = new Set();
            const colours = [];
            // Row `base` of each group is the one the gate compares against: it
            // is the hull, and the hull is what carries the seeded body colour.
            // Quantised to 1/512 so "distinct" means distinguishable rather
            // than "differs in the last float bit".
            const q = (x) => Math.round(x * 512) / 512;
            /**
             * THE STRIDE IS THE ATTRIBUTE'S OWN, NOT 3.
             *
             * It was 3, hard-coded, and session 15 widened `noctisBodyColor`
             * and `noctisGarment` to vec4 so a third colour zone could ride in
             * the spare components at no attribute cost. A reader that assumes
             * a stride reports the wrong three floats the moment the buffer it
             * reads gains a fourth — every colour shifted by one row and the
             * cluster count still plausible, which is precisely the failure
             * CONTRACT §7.7 says an instrument is where to look for.
             */
            const stride = src.itemSize || 3;
            for (let base = 0; base < rows; base += step) {
              const key = `${q(arr[base * stride])},${q(arr[base * stride + 1])},${q(arr[base * stride + 2])}`;
              if (seen.has(key)) continue;
              seen.add(key);
              colours.push(key.split(',').map(Number));
            }
            // Keyed by MESH and not by kind: two meshes' instance colours can
            // mean different things — a vehicle's body against its tyres — and
            // one bucket would report the union as though it were one palette.
            out[o.name || o.uuid] = { kind: d.kind || o.name, subjects: Math.ceil(rows / step), colours };
          });
          return out;
        },

        /**
         * Per-instance motion vectors, CONTRACT §5.12, off the live movers.
         *
         * WHY THIS IS A CPU REPORT AND NOT A PICTURE. The obvious verification
         * of a motion vector is to look at the attachment, and CONTRACT §8
         * forbids a gate from doing that: `showMotion` replaces the composite,
         * which makes the gate's subject something the operator created. So the
         * pixels stay with `tools/motioncheck.mjs`, which is an instrument, and
         * what a GATE gets is this — the bookkeeping that is exact, cheap and
         * is the half that breaks silently later.
         *
         * `sameFrameViolations` is the swap discipline. It is zero in any
         * healthy run because `instmotion.read()` throws before it can be
         * anything else, and the module then quarantines and `ctx.faults` stops
         * being empty. The counter exists so the failure is a NUMBER here as
         * well as a stack trace in a console nobody kept.
         *
         * `written` versus `carried` is the other half: a swap that works and a
         * population that never moves produce identical zeros in the
         * attachment, and only this distinguishes them.
         */
        instanceMotionStats() {
          const layers = [];
          for (const name of ['traffic', 'streetlife']) {
            const m = ctx.get(name);
            if (!m || !m.motionLayers) continue;
            for (const l of m.motionLayers()) layers.push({ module: name, ...l });
          }
          let written = 0;
          let carried = 0;
          let violations = 0;
          let reads = 0;
          for (const l of layers) {
            written += l.written || 0;
            carried += l.carried || 0;
            violations += l.sameFrameViolations || 0;
            reads += l.reads || 0;
          }
          return { layers, written, carried, sameFrameViolations: violations, reads };
        },

        /**
         * Every clustered light, by the role it declared.
         *
         * `role` was a free-form tag with one consumer until this session and
         * every shipping light left it null, so "how many slots does street
         * lighting have and how many does traffic" was a question the world
         * could not answer about itself. `unrolled` is the count that answers
         * nobody, and `tools/budget.json` -> lightRoles requires it to be zero:
         * a slot with no role is a slot nobody is accountable for, and a pool
         * filling up is exactly the failure that arrives with no name on it.
         */
        lightRoleCensus() {
          const lights = ctx.get('lights');
          if (!lights || !lights.roleCensus) return null;
          return lights.roleCensus();
        },

        /**
         * ═══════════════════════════════════════════════════════════════════
         * THE RADIANCE CHAIN'S FOUR BUFFERS. SESSION 55, ITEM 1.
         * ═══════════════════════════════════════════════════════════════════
         *
         * `post.radianceBuffers()` owns the three the composite adds together
         * and `exposure.adaptedTarget()` owns the one it multiplies by. This
         * puts them in one object so a tool can read a pixel out of all four in
         * one `page.evaluate` and reconstruct the whole chain from a lamp's
         * candela to a byte in a PNG.
         *
         * NOTHING IS READ BACK HERE. The readback is in
         * `tools/radianceprobe.mjs` and is forbidden anywhere under `src/`
         * (§5.4, machine-checked by `parsecheck`). What crosses this boundary
         * is the render targets and the renderer, which is the same thing
         * `motionTexture` and `ssrSource` already hand out.
         *
         * The question it exists to answer is the one four content increases
         * could not: where between a lamp's candela and a byte does the picture
         * stop changing.
         */
        radianceBuffers() {
          const post = ctx.get('post');
          const exposure = ctx.get('exposure');
          if (!post || !post.radianceBuffers) return null;
          const b = post.radianceBuffers();
          if (!b) return null;
          b.adapted = exposure && exposure.adaptedTarget ? exposure.adaptedTarget() : null;
          b.exposureParams = exposure && exposure.params ? { ...exposure.params } : null;
          return b;
        },

        /** The traffic system's own account of itself. Null when it is absent. */
        trafficStats() {
          const t = ctx.get('traffic');
          return t && t.stats ? t.stats() : null;
        },

        /**
         * THE §5.12 UPLOAD A/B ARM. `tools/uploadprobe.mjs`, and nothing else.
         *
         * Returns what it actually set, because "I asked traffic to freeze" and
         * "traffic froze" are different claims and a probe that could not tell
         * them apart would measure two identical arms and report no effect —
         * which is a green that means nothing, the same shape as
         * `saturateTraffic` returning what it made rather than what it was asked
         * for.
         *
         * NO GATE MAY CALL THIS. Frozen, the vehicles stop moving on screen; an
         * A/B arm that changes what is drawn is not an A/B (CONTRACT §8, on
         * `setConeBound`).
         */
        setInstanceUploadFrozen(b) {
          const t = ctx.get('traffic');
          if (!t || !t.setUploadFrozen) return { traffic: null };
          t.setUploadFrozen(b);
          return { traffic: !!b };
        },

        /** The weather system's. Null when it is absent. */
        weatherStats() {
          const w = ctx.get('weather');
          return w && w.particleStats ? w.particleStats() : null;
        },

        /**
         * Rainfall, 0..1. Separate from wetness on purpose: a road stays wet
         * after the rain stops, and — the reason it matters to a GATE — the look
         * gate captures wet and dry frames through `setWetness` and asserts on
         * eight of them. Tying rainfall to wetness would have given every wet
         * look frame a haze four times thicker for a reason that has nothing to
         * do with what those assertions measure.
         */
        setRainfall(r) {
          const w = ctx.get('weather');
          if (!w || !w.setRainfall) throw new Error('weather module is quarantined');
          w.setRainfall(r);
        },

        /**
         * AND IT PINS, SINCE SESSION 44 — the same trap `setWetness` was given
         * `override()` for. `weather.js` now drives rainfall from a shower
         * cycle every frame, so a setter that merely wrote the value would be
         * overwritten on the next `update()` and every caller would read its
         * own label back over the cycle's own phase. `setRainfall` takes the
         * state; this hands it back.
         */
        releaseRainfall() {
          const w = ctx.get('weather');
          if (!w || !w.releaseRainfall) throw new Error('weather module is quarantined');
          return w.releaseRainfall();
        },

        /**
         * Pedestrians, counted per chunk off the live scene. Null until 4b.
         *
         * Null is a FAILURE and not a pass. `city-budget.json` carries a
         * clumping floor for them and a floor nobody measures is not a floor —
         * §6's lesson, in the place it will next be needed.
         *
         * A pedestrian population declares itself by putting
         * `noctisPedestrians` on an Object3D's userData:
         * `{ chunkKey, count }` per chunk, or an InstancedMesh whose
         * `instanceMatrix.count` is the population and whose userData says
         * which chunk it belongs to. The COUNT is never read from anywhere but
         * the live object, for the reason `sceneCensus` exists.
         */
        pedestrianCensus() {
          const perChunk = new Map();
          let found = false;
          ctx.scene.traverse((o) => {
            const d = o.userData && o.userData.noctisPedestrians;
            if (!d) return;
            found = true;
            const key = d.chunkKey != null ? String(d.chunkKey) : (o.name || 'unkeyed');
            const n = o.isInstancedMesh && o.instanceMatrix ? o.instanceMatrix.count : (d.count || 0);
            perChunk.set(key, (perChunk.get(key) || 0) + n);
          });
          if (!found) return null;
          const counts = [...perChunk.values()];
          const total = counts.reduce((a, b) => a + b, 0);
          const mean = total / Math.max(1, counts.length);
          const sd = Math.sqrt(
            counts.reduce((a, c) => a + (c - mean) * (c - mean), 0) / Math.max(1, counts.length)
          );
          return {
            chunks: counts.length,
            total,
            populated: counts.filter((c) => c > 0).length,
            mean: +mean.toFixed(3),
            densityCV: +(sd / Math.max(1e-9, mean)).toFixed(4),
            perChunk: Object.fromEntries(perChunk),
          };
        },

        /**
         * ═══════════════════════════════════════════════════════════════════
         * WHAT EVERY MESH IN THE SCENE CLAIMS ABOUT WATER — SESSION 65.
         * ═══════════════════════════════════════════════════════════════════
         *
         * `lights.js` → `noctisRough` is a **vec2**: `.x` is a roughness
         * override and `.y` is the POROSITY every wet term reads. Its own
         * comment says the safe default is zero *"twice over"* — a geometry
         * with NO attribute reads the generic `(0,0)`, and a geometry with the
         * one-component `float` every mesh carried before session 55 reads
         * `(x,0)`. **Both give porosity 0, and porosity 0 is IMPERVIOUS**,
         * which is a full mirror under `wet = 1`.
         *
         * That default is correct for tarmac and silent everywhere else, and it
         * has now been found twice by looking at a frame: session 64 found it on
         * `block:ground` after session 63 made that plane the visible
         * countryside, and session 65 found it on the 8 km exit-road ribbon —
         * one surface away, the same omission, one session later. **Finding
         * this class one frame at a time is what this method exists to stop.**
         *
         * IT IS A CENSUS AND NOT A CHECK, and it must stay one: it reports what
         * every mesh delivers and asserts nothing at all. `tools/roughcensus.mjs`
         * is the reader; `sceneCensus` above is the same arrangement with
         * instance counts.
         *
         * THE POROSITY IS READ OFF THE DELIVERED BUFFER and not off the code
         * that wrote it — CONTRACT §9 rule 2, and it is the whole point. A
         * value the generator chose and the attribute does not carry is exactly
         * the disagreement this is looking for, so nothing here may consult a
         * table.
         */
        roughCensus() {
          const rows = [];
          const sph = new THREE.Sphere();
          ctx.scene.traverse((o) => {
            if (!o.isMesh || !o.geometry) return;
            const g = o.geometry;
            const pos = g.getAttribute('position');
            if (!pos) return;
            const a = g.getAttribute('noctisRough');
            const drawn = o.isInstancedMesh ? o.count : 1;
            const idx = g.getIndex();
            const triangles = Math.floor(((idx ? idx.count : pos.count) / 3)) * drawn;
            /**
             * THE HISTOGRAM IS OVER `.y` AND ONLY EXISTS WHEN THERE IS A `.y`.
             * `itemSize` is the finding: 0 means the attribute is absent and
             * the mesh reads the generic default; 1 means it carries the
             * pre-session-55 float, whose `.y` is also the generic default.
             * Neither is a porosity this mesh chose, and printing a 0 for both
             * would hide which of the two it is.
             */
            let poros = null;
            if (a && a.itemSize >= 2) {
              const bins = new Map();
              let lo = Infinity;
              let hi = -Infinity;
              for (let i = 0; i < a.count; i++) {
                const y = a.getY(i);
                if (y < lo) lo = y;
                if (y > hi) hi = y;
                const k = y.toFixed(3);
                bins.set(k, (bins.get(k) || 0) + 1);
              }
              poros = {
                min: a.count ? +lo.toFixed(4) : null,
                max: a.count ? +hi.toFixed(4) : null,
                vertices: a.count,
                /** Sorted descending by vertex count; the tail is truncated. */
                bins: [...bins.entries()]
                  .sort((p, q) => q[1] - p[1])
                  .slice(0, 8)
                  .map(([v, n]) => [Number(v), n]),
                distinct: bins.size,
              };
            }
            /**
             * WHERE IT IS, IN WORLD METRES, so a reader can say which rows are
             * countryside without a table of names. The bounding sphere is
             * three's own and is computed here rather than trusted, because a
             * geometry that has never been culled may not have one.
             */
            if (o.isInstancedMesh) {
              /**
               * AN INSTANCED MESH'S GEOMETRY BOUND IS ONE UNIT BOX, NOT THE
               * FIELD — and the first arm of this method read the geometry's
               * for every row, so `city:distant`, 47 556 triangles spread over
               * kilometres, reported a reach of **1 m**. three keeps a separate
               * `InstancedMesh.boundingSphere` over the instance matrices and
               * that is the one that answers "where is this mesh".
               */
              if (!o.boundingSphere) o.computeBoundingSphere();
              sph.copy(o.boundingSphere).applyMatrix4(o.matrixWorld);
            } else {
              if (!g.boundingSphere) g.computeBoundingSphere();
              sph.copy(g.boundingSphere).applyMatrix4(o.matrixWorld);
            }
            rows.push({
              name: o.name || '(unnamed)',
              instanced: !!o.isInstancedMesh,
              drawn,
              triangles,
              itemSize: a ? a.itemSize : 0,
              porosity: poros,
              centre: [+sph.center.x.toFixed(1), +sph.center.y.toFixed(1), +sph.center.z.toFixed(1)],
              radius: +sph.radius.toFixed(1),
              /** How far the mesh reaches from the origin in plan. */
              reachM: +(Math.hypot(sph.center.x, sph.center.z) + sph.radius).toFixed(1),
              visible: o.visible,
            });
          });
          return { meshes: rows.length, rows };
        },

        /**
         * ═══════════════════════════════════════════════════════════════════
         * HOW FAR A RIGID FEATURE'S ENDS ARE OFF THE GROUND IT STANDS ON —
         * SESSION 65.
         * ═══════════════════════════════════════════════════════════════════
         *
         * `city.js`'s feature loop takes ONE `worldSurface(f.x, f.z).y` sample
         * at a feature's centre and composes a yaw and no pitch, so a rigid box
         * on a slope has its ends `L · g / 2` off the surface. This reports, for
         * every feature the delivered census recorded, the base the transform
         * used against the ground under the four corners of its own drawn
         * footprint.
         *
         * IT IS THE PLAYER'S OWN QUERY AND NOT A SECOND DESCRIPTION OF IT —
         * `city.worldSurfaceAt`, for `surfaceCensus`'s reason one method up. A
         * census that read `terrainHeightAt` instead would be asking the
         * generator, which has no opinion about the plot rectangles a villa
         * stands on, about the ribbon's hoisted stations, or about residency.
         *
         * THE CENTRE IS THE DATUM AND THE CORNERS ARE THE MEASUREMENT, which is
         * the whole shape of the defect: `put` is exact at the centre by
         * construction and can be arbitrarily wrong at the ends.
         *
         * `kinds` is passed IN rather than known here, because which `f.kind`
         * values the loop serves is a fact about `city.js`'s source and
         * `tools/featurecensus.mjs` greps it out of that file — so the two
         * cannot disagree about the list, and a kind added to the loop appears
         * in the census without this method being touched.
         */
        featureGround(kinds) {
          const city = ctx.get('city');
          if (!city || !city.placedClaims || !city.worldSurfaceAt) {
            throw new Error('city.placedClaims()/worldSurfaceAt() is missing');
          }
          const want = new Set(kinds || []);
          const out = [];
          for (const c of city.placedClaims()) {
            /**
             * The feature loop's own record writes `owner` as `kind:edge`; no
             * other producer in the delivered census uses that shape with a
             * feature kind in front of the colon, and the kind list is the
             * caller's, so a `prop` owner like `lamp:column` is refused by the
             * list rather than by a guess about the string.
             */
            if (!c.owner) continue;
            const kind = String(c.owner).split(':')[0];
            if (!want.has(kind)) continue;
            const x = (c.x0 + c.x1) / 2;
            const z = (c.z0 + c.z1) / 2;
            /**
             * COPIED OUT AT ONCE, AND THE FIRST ARM DID NOT — `worldSurface`
             * fills and returns ONE shared `worldOut` object and its own
             * comment says *"THE RESULT IS TRANSIENT — copy what you keep."*
             * Holding the reference and then querying a corner overwrites the
             * base with the corner, so every difference below came out exactly
             * **0.00 m** — for 6 078 features including 424 on hill shoulders,
             * against session 64's independently measured hedge median of
             * 1.04 m. A measurement that reports a perfect world is the loudest
             * possible symptom and it still needed a second number to catch.
             */
            const base = city.worldSurfaceAt(x, z);
            const baseY = base.y;
            const baseKind = base.kind;
            let err = 0;
            for (const p of [[c.x0, c.z0], [c.x1, c.z0], [c.x0, c.z1], [c.x1, c.z1]]) {
              const d = Math.abs(city.worldSurfaceAt(p[0], p[1]).y - baseY);
              if (d > err) err = d;
            }
            /**
             * ═══════════════════════════════════════════════════════════════
             * AND WHETHER A PITCH COULD HAVE FIXED IT, WHICH IS A SECOND
             * QUANTITY AND NOT A RESTATEMENT OF THE FIRST.
             * ═══════════════════════════════════════════════════════════════
             *
             * An end off the ground has two causes and only one of them is
             * this session's:
             *
             *   A SLOPE the rigid box cannot follow — `put` composes a yaw and
             *     no pitch, so a box of plan diagonal `d` on gradient `g` has
             *     its worst corner `d/2 · g` off a level base. A pitch removes
             *     this one.
             *   A STEP in the ground the box straddles — a kerb, a terrace
             *     edge, a plot boundary. A lamp head's claim spans the
             *     carriageway and the pavement, so a corner of it is
             *     `BLOCK.kerbHeight` = 0.160 m up and the COLUMN is perfectly
             *     vertical. **A pitch would not fix that and must not try**;
             *     leaning a lamp post into a kerb is a worse frame than the one
             *     it replaces.
             *
             * The predictor is `terrainNormalAt` — the same central difference
             * `block.js` writes into the ground mesh, which is the surface the
             * feature is standing on (STATE 64 §1b: `slopeprobe` was wrong twice
             * by predicting from something that was not what is drawn). Where
             * `err` and `predicted` agree, a pitch takes it out; where `err` is
             * much the larger, the ground has a step in it and the transform is
             * not the defect.
             */
            // `String(...)`: `city.js` does the same at its own `rootSeed` — `chunkRng`
            // hashes its argument and a number and its decimal string are not the
            // same key, which is CONTRACT §9 with a seed.
            const n = terrainNormalAt(String(ctx.config.seed), x, z);
            const grad = Math.hypot(n[0], n[2]) / Math.max(1e-9, n[1]);
            const diag = Math.hypot(c.x1 - c.x0, c.z1 - c.z0);
            out.push({
              kind,
              owner: c.owner,
              x: +x.toFixed(1),
              z: +z.toFixed(1),
              err: +err.toFixed(4),
              predicted: +((diag / 2) * grad).toFixed(4),
              slopeDeg: +((Math.atan(grad) * 180) / Math.PI).toFixed(3),
              span: +diag.toFixed(2),
              baseKind,
            });
          }
          return out;
        },

        /**
         * ═══════════════════════════════════════════════════════════════════
         * EVERY BOX THAT SITS ON THE GROUND, AND HOW FAR ITS CORNERS ARE FROM
         * IT — SESSION 65, AND IT IS THE MEASUREMENT `featureGround` IS NOT.
         * ═══════════════════════════════════════════════════════════════════
         *
         * `featureGround` above measures **how much the ground varies under a
         * feature's footprint**. That is the CAUSE, and it is a property of the
         * landscape: a pitch in the transform does not change it by one
         * millimetre, so an A/B on it reports no improvement from a repair that
         * works. The first arm of session 65's item 2 measured exactly that and
         * had to be told so by the numbers not moving.
         *
         * THIS measures the EFFECT: for every instanced box in the delivered
         * scene whose bottom face is ON the ground at its own centre, how far
         * the worst of its four bottom corners is from the ground under that
         * corner. A level box on a slope reports `d/2 · g`; a box raked with the
         * ground reports the residual curvature and nothing else.
         *
         * THE SELECTION IS STABLE ACROSS THE ARMS, which is what makes the A/B
         * legible: a box qualifies on its bottom-face CENTRE being within
         * `nearM` of the surface, and the pitch pivots each feature through its
         * own base, so a box that qualified before qualifies after. Selecting on
         * a corner instead would let the repair change the population it is
         * measured over, which is CONTRACT §7.3's own failure with a filter.
         *
         * IT WALKS THE DELIVERED `instanceMatrix` and not a description of it.
         * The box's four bottom corners come out of its own world matrix — the
         * same one the GPU is handed — so a transform that composes a pitch the
         * comment says it composes and a transform that does not are two
         * different numbers here.
         */
        boxGroundCensus(opts = {}) {
          const city = ctx.get('city');
          if (!city || !city.worldSurfaceAt) throw new Error('city.worldSurfaceAt() is missing');
          const nearM = opts.nearM === undefined ? 0.30 : opts.nearM;
          const rows = [];
          const m4 = new THREE.Matrix4();
          const v = new THREE.Vector3();
          ctx.scene.traverse((o) => {
            if (!o.isInstancedMesh || !o.instanceMatrix) return;
            if (opts.name && o.name.indexOf(opts.name) < 0) return;
            const inst = o.instanceMatrix.array;
            const n = Math.min(o.count, o.instanceMatrix.count);
            for (let i = 0; i < n; i++) {
              m4.fromArray(inst, i * 16).premultiply(o.matrixWorld);
              const e = m4.elements;
              /** The box's own half-extents along its three local axes. */
              const hx = 0.5;
              const cxw = e[12];
              const cyw = e[13];
              const czw = e[14];
              /** Half the LOCAL −Y face, in world: the columns scaled by ±0.5. */
              const dy = -0.5;
              let worst = 0;
              let centreGap = 0;
              {
                v.set(e[4] * dy + cxw, e[5] * dy + cyw, e[6] * dy + czw);
                centreGap = v.y - city.worldSurfaceAt(v.x, v.z).y;
              }
              if (Math.abs(centreGap) > nearM) continue;
              for (const sx of [-hx, hx]) {
                for (const sz of [-hx, hx]) {
                  v.set(
                    e[0] * sx + e[4] * dy + e[8] * sz + cxw,
                    e[1] * sx + e[5] * dy + e[9] * sz + cyw,
                    e[2] * sx + e[6] * dy + e[10] * sz + czw
                  );
                  const d = Math.abs(v.y - city.worldSurfaceAt(v.x, v.z).y);
                  if (d > worst) worst = d;
                }
              }
              rows.push({
                name: o.name,
                x: +cxw.toFixed(1),
                z: +czw.toFixed(1),
                r: +Math.hypot(cxw, czw).toFixed(0),
                worst: +worst.toFixed(4),
                /** The box's plan diagonal, which is what the gradient multiplies. */
                diag: +Math.hypot(
                  Math.hypot(e[0], e[2]), Math.hypot(e[8], e[10])
                ).toFixed(2),
              });
            }
          });
          return rows;
        },

        faults() {
          return ctx.faults;
        },

        live() {
          return ctx.live;
        },

        info() {
          const r = ctx.renderer.info;
          const cam = ctx.camera;
          const time = ctx.get('time');
          const lights = ctx.get('lights');
          const block = ctx.get('block');
          const lighting = ctx.get('lighting');
          const sky = ctx.get('sky');
          const canyon = ctx.get('canyon');
          return {
            wetness: lights ? lights.getWetness() : null,
            indirect: canyon ? canyon.enabled : null,
            canyon: canyon
              ? {
                  roadSkyVis: +canyon.roadSkyVis.toFixed(3),
                  facadeSkyVis: +canyon.facadeSkyVis.toFixed(3),
                  voxels: canyon.stats ? canyon.stats.voxels : null,
                  bakeMs: canyon.stats ? +canyon.stats.bakeMs.toFixed(1) : null,
                }
              : null,
            drawCalls: r.render.calls,
            sceneDrawCalls: (() => {
              const post = ctx.get('post');
              return post && post.sceneDrawCalls != null ? post.sceneDrawCalls : null;
            })(),
            triangles: r.render.triangles,
            programs: r.programs ? r.programs.length : 0,
            timeOfDay: time ? time.timeOfDay : null,
            clock: time ? time.clockString() : null,
            sunElevationDeg: time ? (time.sun.elevationRad * 180) / Math.PI : null,
            sunAzimuthDeg: time ? (time.sun.azimuthRad * 180) / Math.PI : null,
            moonElevationDeg: time ? (time.moon.elevationRad * 180) / Math.PI : null,
            /**
             * SESSION 63. The sun's pair has been here since session 3 and the
             * moon had only its elevation, so an instrument that wanted to
             * predict a night surface's shading had to build a second solar
             * model to get the bearing — CONTRACT §9.1's config-the-code-does-
             * not-read with an ephemeris. `tools/slopeprobe.mjs` is the reader.
             */
            moonAzimuthDeg: time ? (time.moon.azimuthRad * 180) / Math.PI : null,
            ambientLux: lighting ? lighting.ambientLux : null,
            sunLux: lighting ? lighting.sunIlluminanceLux : null,
            photocellOn: lighting ? lighting.photocellOn : null,
            skyVersion: sky ? sky.version : null,
            clusteredLights: lights ? lights.lightCount : null,
            clusterIndices: lights ? lights.assignedIndices : null,
            clusterOverflow: lights ? lights.overflow : null,
            /**
             * The margin, beside the boolean. `clusterOverflow: false` at 96 of
             * 96 and at 31 of 96 are the same boolean and different findings.
             */
            clusterPeakOccupancy: lights ? lights.peakOccupancy : null,
            clusterMaxPerCluster: lights && lights.clusterConfig ? lights.clusterConfig().maxPerCluster : null,
            /**
             * Lights whose owner declared them traffic. Zero until 4b, and the
             * assertion that reads it fails on zero rather than passing: a
             * `clusterOverflow: false` measured over a grid with no traffic in
             * it is a statement about a different grid.
             */
            trafficLights: lights && lights.countByRole ? lights.countByRole('traffic') : null,
            /**
             * `variation` is what session 3's structural gate reads, and it is
             * read off the live instanced buffers rather than off the block's
             * authoring intent (see block.js). It is on `info()` rather than in
             * a side channel so that the gate measures the same object a person
             * typing `__NOCTIS_HARNESS__.info()` in the console sees.
             */
            block: block ? { ...block.counts, variation: block.variation } : null,
            faults: ctx.faults.length,
            // A frame captured with the wrong camera or the wrong aspect is a
            // frame whose numbers describe something nobody asked for. Report
            // the geometry alongside the measurement, always.
            shot: ctx.get('camera') ? ctx.get('camera').shot : null,
            /**
             * SESSION 17. Null whenever `?player=1` was not passed, which is
             * every gate run there has ever been — the switch omits the
             * `register()` (CONTRACT §6), so this is `ctx.get()` returning
             * undefined and not a flag.
             *
             * It is on `info()` rather than on its own harness method for the
             * same reason `blockAuthoring` is: what it carries is the state of
             * a thing that is either there or is not, and a caller that has to
             * ask two questions to find out will one day ask only the first.
             */
            player: (() => {
              const p = ctx.get('player');
              return p && p.state ? p.state() : null;
            })(),
            cameraPos: cam.position.toArray().map((v) => +v.toFixed(2)),
            cameraFov: cam.fov,
            cameraAspect: +cam.aspect.toFixed(4),
            viewport: [ctx.size.width, ctx.size.height, ctx.size.dpr],
            drawingBuffer: [ctx.renderer.domElement.width, ctx.renderer.domElement.height],
            /**
             * What was actually rendered, which since session 4 is not the
             * drawing buffer (§5.10). Reported next to it so a gate can never
             * measure one and believe it measured the other.
             */
            internal: (() => {
              const post = ctx.get('post');
              return post && post.internalSize
                ? [post.internalSize.width, post.internalSize.height]
                : null;
            })(),
            targetMemoryMB: (() => {
              const post = ctx.get('post');
              const lightsMod = ctx.get('lights');
              let bytes = post && post.targetBytes ? post.targetBytes() : 0;
              if (lightsMod && lightsMod.bytes) bytes += lightsMod.bytes();
              return +(bytes / 1048576).toFixed(1);
            })(),
            /**
             * Resident streamed chunk data — the canyon field slots plus the
             * per-chunk instance buffers. Exact, not estimated: every byte here
             * is an allocation this project made from a size it knows.
             */
            chunkMemoryMB: (() => {
              const cityMod = ctx.get('city');
              const canyonMod = ctx.get('canyon');
              if (!cityMod && !canyonMod) return null;
              let bytes = cityMod ? cityMod.bytes : 0;
              if (canyonMod && canyonMod.fieldBytes) bytes += canyonMod.fieldBytes();
              return +(bytes / 1048576).toFixed(2);
            })(),
            city: (() => {
              const cityMod = ctx.get('city');
              const canyonMod = ctx.get('canyon');
              if (!cityMod) return null;
              return {
                ...cityMod.stats(),
                field: canyonMod && canyonMod.streamStats ? canyonMod.streamStats() : null,
              };
            })(),
          };
        },

        /**
         * Drive a scripted route. CONTRACT §8, and since session 4 the thing
         * `perfcheck` actually measures.
         *
         * Every frame is stepped with a fixed dt, so the path travelled depends
         * on the frame count and not on how fast the machine rendered it. A
         * route driven by wall-clock time measures a different distance on every
         * run and calls the difference a performance change.
         *
         * The instrument is sampled from in here rather than from the gate,
         * because the scene graph is not reachable from outside the page and the
         * content floors — visible instances, distinct materials — are the whole
         * reason the gate cannot be passed by deleting the world.
         */
        /**
         * PLACE THE CAMERA AT A POINT ON A ROUTE AND LET THE FRAME CONVERGE.
         *
         * For pooling a per-frame measurement over more than one sample of the
         * same route. The end of `runRoute` is ONE camera position, and a
         * content assertion read off it is a claim about wherever the path
         * happened to stop: `highway_speed` ends with 27 vehicles inside 60 m on
         * one run and would end with a different number if the frame count
         * changed. The route is deterministic so that is not noise, but it is
         * still a sample of one, which is the shape of mistake this whole
         * session is about.
         *
         * NOT `setShotAt`, AND THE DIFFERENCE IS THE WHOLE REASON THIS IS
         * ALLOWED. CONTRACT §8 forbids a gate rendering through `setShotAt`
         * because the operator chooses where to stand and the gate then
         * measures the operator. Here the placement comes from the route's own
         * spline at a parameter — the same call `runRoute` makes on every one of
         * its 1800 frames — so the gate is sampling the path it already runs
         * rather than choosing a new one.
         */
        async poseRoute(name, u, frames = 24) {
          const cam = ctx.get('camera');
          if (!cam || !cam.setRouteAt) throw new Error('camera module is quarantined');
          if (!cam.route(name)) throw new Error(`unknown route '${name}'`);
          cam.setRouteAt(name, Math.min(1, Math.max(0, u)));
          // The residency ring follows the camera and the pose may be a long way
          // back down the path, so the world has to arrive before anything is
          // worth measuring — the same reason `lookat.mjs` waits after a
          // teleport.
          await api.waitForCity(900);
          const post = ctx.get('post');
          if (post) post.resetHistory();
          for (let i = 0; i < frames; i++) {
            api.updateTraffic();
            await step(1, 1 / 60);
          }
        },

        async runRoute(name, opts = {}) {
          const cam = ctx.get('camera');
          if (!cam || !cam.setRouteAt) throw new Error('camera module is quarantined');
          const route = cam.route(name);
          if (!route) throw new Error(`unknown route '${name}' — have ${cam.routes.join(', ')}`);

          const frames = Math.max(1, opts.frames || 900);
          const dt = opts.dt || 1 / 60;
          const probe = window.__APEX_PROBE__;

          await api.setTimeOfDay(route.t);
          api.setWetness(route.wet);

          const length = cam.routeLength(name);
          // If the path is longer than the run can cover, the run covers the
          // first part of it. Reported, never silently rescaled: a route whose
          // speed changes with the frame count is not the same route.
          const covered = route.speed * dt * frames;
          const span = Math.min(1, covered / Math.max(length, 1e-6));

          cam.setRouteAt(name, 0);
          const post = ctx.get('post');
          if (post) post.resetHistory();

          // Let the world arrive before the measured window opens. Otherwise the
          // first two hundred frames measure an empty city and the route reports
          // a frame budget nobody will ever experience — and, worse, the content
          // floors would be measured against a world that had not turned up yet.
          await api.waitForCity(600);

          // The measurement window opens here, after the city has arrived. A
          // high-watermark that included the warmup would be a watermark of the
          // streaming system.
          api.resetClusterPeaks();

          for (let i = 0; i < frames; i++) {
            cam.setRouteAt(name, (i / Math.max(1, frames - 1)) * span);
            // Before the step, so the cars this frame are the cars the grid is
            // built from. See updateTraffic().
            api.updateTraffic();
            await step(1, dt);
            if (probe && probe.sampleScene && i % 30 === 0) {
              probe.sampleScene(ctx.scene, ctx.camera);
            }
          }
          if (probe && probe.sampleScene) probe.sampleScene(ctx.scene, ctx.camera);

          return {
            route: name,
            frames,
            dt,
            metresTravelled: +(length * span).toFixed(1),
            pathLength: +length.toFixed(1),
            coveredFraction: +span.toFixed(3),
            /**
             * The grid's high-watermark over the whole run, not over the frame
             * the gate happens to screenshot. Reported here because this is the
             * only object that outlives the run.
             */
            cluster: api.clusterStats(),
          };
        },
      };

      window.__NOCTIS_HARNESS__ = api;
      window.__APEX_HARNESS__ = api;

      // One frame has to have been drawn before anything can be captured, and
      // the first frame is where every shader in the project gets compiled.
      requestAnimationFrame(() => requestAnimationFrame(() => readyResolve()));

      return api;
    },

    dispose(ctx) {
      // CONTRACT §2: dispose must leave ctx.scene as it found it. Both of these
      // add to it.
      const h = window.__NOCTIS_HARNESS__;
      if (h) {
        if (h.clearMotionProbe) h.clearMotionProbe();
        if (h.clearTraffic) h.clearTraffic();
      }
      void ctx;
      delete window.__NOCTIS_HARNESS__;
      delete window.__APEX_HARNESS__;
    },
  };
}
