/**
 * headlesscity.mjs — RUN `city.js` WITHOUT A BROWSER, WITHOUT A GPU.
 * ==================================================================
 *
 * NOT A GATE, and it must never become one. It is a way of reaching ONE
 * function — `city.placedClaims()`, the DELIVERED occupancy census — on a
 * machine that has no display hardware.
 *
 * WHY IT IS DEFENSIBLE, AND WHERE THE LINE IS.
 *
 * CONTRACT §9.1 is emphatic that a gate must read the ARTEFACT and not the
 * generator's description of it, and this project has twice had a generator
 * that decided correctly while `city.js` drew something else. The delivered
 * census exists for exactly that reason: `buildChunkBody` accumulates a claim
 * per emitted object from the MATRICES IT PUSHED, and `harness.occupancyCensus`
 * hands that list to the gate.
 *
 * None of that bookkeeping touches a pixel. It is `Matrix4.compose`, a few
 * additions and a `Math.max` — CPU arithmetic that is bit-identical whether a
 * GPU is attached or not (CONTRACT §9 rule 6's corollary: counts do not drift).
 * What needs a GPU is the *rendering* of those matrices, and this file renders
 * nothing.
 *
 * SO THE RULE IS: this boots the REAL `city.js`, the REAL `block.js` and the
 * REAL `river.js` and drives their REAL `update()`. It re-implements no
 * placement, no emission and no claim. What it substitutes is only the three
 * neighbours whose answers `city.js` reads and does not depend on for a
 * placement:
 *
 *   lights    `patch()` is a shader injection and `add()` is a slot in a data
 *             texture. Neither changes a matrix. The stub records the calls.
 *   lighting  one boolean, `photocellOn`, which selects an emissive intensity.
 *   canyon    a baked field. `city.js` reads two scalars off it for the
 *             analytic default and hands it chunk requests; none of it reaches
 *             a claim.
 *   time      `now`, for the beacon flash phase.
 *
 * Each substitution is listed here rather than left to be discovered, and each
 * one is a value the delivered claim list provably does not read. A probe that
 * quietly stubbed something a claim DOES read would be measuring the stub —
 * which is §9.1's "a gate that reads config verifies the config" with a fake
 * module instead of a config file.
 *
 * THE CONTROL. `emitcensus.mjs` prints the delivered conflict list, and STATE 22
 * §2.4 recorded that list from a real browser on a real page: two overlaps,
 * `prop(container) × site(hoarding)` at 0.173 m² and 0.266 m². If this path
 * reproduces those two numbers to three decimals it is the same path; if it
 * does not, it is a different instrument and its numbers are not comparable.
 * That comparison is printed by the probe and is the first thing to read.
 */

import * as THREE from 'three';
import { createCity } from '../../src/modules/city.js';
import { createBlock } from '../../src/modules/block.js';
import { createRiver } from '../../src/modules/river.js';
import { hashString, mulberry32, rngHelpers } from '../../src/lib/rng.js';

/**
 * The camera `citycheck` takes its delivered census at.
 *
 * `citycheck` opens `?perf=1&seed=SEED&paused=1`, calls `takeOver()` and
 * `waitForCity()`, and never places the camera — so the census is taken at
 * whatever `camera.js` seated at boot, which is `SHOTS.street`. Written here as
 * a default rather than as a literal at the call site, because a census taken
 * somewhere else is a census of a different resident ring.
 */
export const CITYCHECK_EYE = [70, 1.74, 0.9];

/**
 * A context object with the same surface `src/core/context.js` presents, and
 * nothing behind it. `ctx.get()` returning `undefined` is a normal condition
 * (CONTRACT §1.2), so an absent module here behaves exactly as a quarantined
 * one does in the browser.
 */
export function makeStubCtx({ seed = 1337, eye = CITYCHECK_EYE } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 6000);
  camera.position.set(eye[0], eye[1], eye[2]);

  const modules = new Map();
  const rngCache = new Map();
  const logs = [];
  const warned = new Set();
  /** Every `lights.add()` spec, so a caller can count slots without a texture. */
  const lightSpecs = [];
  /** Every material handed to `lights.patch()`, for the same reason. */
  const patched = [];

  const ctx = {
    scene,
    camera,
    renderer: null,
    config: Object.freeze({ seed: String(seed), t: 0.78, quayLamps: 1 }),
    size: { width: 1280, height: 720, dpr: 1 },
    get: (name) => modules.get(name),
    has: (name) => modules.has(name),
    /** `src/core/context.js`'s own seeding, spelt the same way. */
    rng: (stream) => {
      if (!rngCache.has(stream)) {
        rngCache.set(stream, rngHelpers(mulberry32((hashString(String(seed)) ^ hashString(stream)) >>> 0)));
      }
      return rngCache.get(stream);
    },
    on: () => () => {},
    emit: () => {},
    log: (...m) => { logs.push(m.join(' ')); },
    warnOnce: (key, ...m) => { if (!warned.has(key)) { warned.add(key); logs.push(`WARN ${key}: ${m.join(' ')}`); } },
    faults: [],
    /* --- test-side handles, not part of the contract's ctx --- */
    $logs: logs,
    $lightSpecs: lightSpecs,
    $patched: patched,
    $set: (name, api) => modules.set(name, api),
  };

  modules.set('lights', {
    patch: (m) => { patched.push(m); return m; },
    add: (spec) => { lightSpecs.push(spec); return spec; },
    remove: () => {},
    setFieldDefault: () => {},
  });
  modules.set('lighting', { photocellOn: true });
  modules.set('time', { now: 0, timeOfDay: 0.78, dt: 1 / 60, frame: 0 });
  modules.set('canyon', {
    /**
     * The two scalars `city.js` reads for the analytic default. They are the
     * numbers the origin block's own bake measures and they are quoted in
     * `city.js`'s init log; here they only decide a uniform nothing in the
     * claim list reads.
     */
    roadSkyVis: 0.51,
    facadeSkyVis: 0.244,
    setFieldDefault: () => {},
    requestChunk: () => {},
    fieldBytes: () => 0,
    streamStats: () => ({ queued: 0, inFlight: 0, dripping: 0 }),
  });

  return ctx;
}

/**
 * Boot the real modules in dependency order and drive `update()` until the
 * resident ring stops growing.
 *
 * `CITY.generateBudget` chunks are built per frame by design, so a full ring is
 * several dozen frames. Bounded rather than a spin, and the bound is REPORTED:
 * a census taken over a partially built ring is a census of the streaming
 * system (CONTRACT §7.1's shape — the number would be wrong and the probe would
 * still print one).
 */
export function bootCity({ seed = 1337, eye = CITYCHECK_EYE, maxFrames = 400 } = {}) {
  const ctx = makeStubCtx({ seed, eye });

  const block = createBlock();
  const blockApi = block.init(ctx) || block.api || {};
  ctx.$set('block', blockApi);

  const river = createRiver();
  const riverApi = river.init(ctx) || river.api || {};
  ctx.$set('river', riverApi);

  const city = createCity();
  const cityApi = city.init(ctx) || city.api || {};
  ctx.$set('city', cityApi);

  let frames = 0;
  let stable = 0;
  let last = -1;
  for (; frames < maxFrames; frames++) {
    city.update(ctx, 1 / 60);
    const n = cityApi.stats ? cityApi.stats().resident : -1;
    if (n === last) stable++;
    else { stable = 0; last = n; }
    // Three consecutive frames with no change: the queue is drained. Not one,
    // because `generateBudget` can be met exactly by an eviction in the same
    // frame and leave the count unmoved for one tick.
    if (stable >= 3) break;
  }

  return {
    ctx,
    city,
    cityApi,
    block,
    blockApi,
    river,
    riverApi,
    frames,
    stats: cityApi.stats ? cityApi.stats() : null,
  };
}

/**
 * BOOT, AND RECORD WHERE EVERY EMITTED BOX CAME FROM AND HOW BIG IT IS.
 *
 * Two probes need this and a second copy of it would be CONTRACT §9.1's own
 * subject — two descriptions of one thing, one of which decides a census and
 * the other a conflict decomposition.
 *
 * PROVENANCE. `city.js`'s `setMatrix` and `propMatrix` both END in
 * `Matrix4.clone()`, so wrapping that prototype method catches every instanced
 * box, window pane and sign quad exactly once, and the stack at that moment
 * names the line that emitted it. The wrap is removed before this returns.
 *
 * EXTENT. A matrix does not say how big a thing is: `setMatrix(x, y, z, 1, 1,
 * 1, yaw)` is a 1 m cube against the unit box and an 8.4 m column with a 2.1 m
 * arm against `geometries.lamp`. So the geometry is recovered from the scene —
 * every `InstancedMesh` walked, its instance matrices keyed, its own bounding
 * box attached — and the world AABB is that box under that matrix.
 *
 * THE KEY GOES THROUGH `Math.fround`. `Matrix4.elements` is doubles and
 * `instanceMatrix.array` is a **Float32Array**, so `setMatrixAt` narrows on the
 * way in. Keyed at full precision the match rate was 35 574 of 124 007 and the
 * rest fell back to a made-up unit box; through `fround` it is every city.js
 * matrix and nothing else. The `=== 0` guard is negative zero, which `toFixed`
 * renders as `-0.0000`.
 */
export function captureBuild(opts = {}) {
  const CLONE = THREE.Matrix4.prototype.clone;
  /** site chain → { key, count, elements[], boxes[] } */
  const bySite = new Map();
  let capturing = false;

  const siteOf = () => {
    const s = new Error().stack.split('\n');
    const chain = [];
    for (let i = 1; i < s.length && chain.length < 4; i++) {
      const m = /\/src\/modules\/([a-z]+)\.js:(\d+):/.exec(s[i]);
      if (m) chain.push(`${m[1]}:${m[2]}`);
    }
    return chain.join(' < ');
  };

  THREE.Matrix4.prototype.clone = function clone() {
    const m = CLONE.call(this);
    if (capturing) {
      const key = siteOf();
      let rec = bySite.get(key);
      if (!rec) { rec = { key, count: 0, elements: [], boxes: [] }; bySite.set(key, rec); }
      rec.count++;
      rec.elements.push(Float64Array.from(m.elements));
    }
    return m;
  };

  let world;
  try {
    capturing = true;
    world = bootCity(opts);
  } finally {
    capturing = false;
    THREE.Matrix4.prototype.clone = CLONE;
  }

  const f32 = (v) => { const n = Math.fround(v); return (n === 0 ? 0 : n).toFixed(4); };
  const mkey = (a, o = 0) => {
    let s = '';
    for (let i = 0; i < 16; i++) s += `${f32(a[o + i])}|`;
    return s;
  };
  const cityRoot = world.ctx.scene.children.find((o) => o.name === 'city');
  const geoByMatrix = new Map();
  cityRoot.traverse((o) => {
    if (!o.isInstancedMesh) return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    const g = { min: [bb.min.x, bb.min.y, bb.min.z], max: [bb.max.x, bb.max.y, bb.max.z], mesh: o.name };
    for (let i = 0; i < o.count; i++) {
      const k = mkey(o.instanceMatrix.array, i * 16);
      const prev = geoByMatrix.get(k);
      if (!prev) { geoByMatrix.set(k, g); continue; }
      // Two meshes sharing a matrix: the union, which can only over-state.
      geoByMatrix.set(k, {
        min: [Math.min(prev.min[0], g.min[0]), Math.min(prev.min[1], g.min[1]), Math.min(prev.min[2], g.min[2])],
        max: [Math.max(prev.max[0], g.max[0]), Math.max(prev.max[1], g.max[1]), Math.max(prev.max[2], g.max[2])],
        mesh: `${prev.mesh}+${g.mesh}`,
      });
    }
  });

  const UNIT = { min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5], mesh: '(unmatched)' };
  let unmatched = 0;
  let total = 0;
  for (const rec of bySite.values()) {
    for (const e of rec.elements) {
      total++;
      const g = geoByMatrix.get(mkey(e)) || (unmatched++, UNIT);
      const c = [(g.min[0] + g.max[0]) / 2, (g.min[1] + g.max[1]) / 2, (g.min[2] + g.max[2]) / 2];
      const h = [(g.max[0] - g.min[0]) / 2, (g.max[1] - g.min[1]) / 2, (g.max[2] - g.min[2]) / 2];
      const wx = e[0] * c[0] + e[4] * c[1] + e[8] * c[2] + e[12];
      const wy = e[1] * c[0] + e[5] * c[1] + e[9] * c[2] + e[13];
      const wz = e[2] * c[0] + e[6] * c[1] + e[10] * c[2] + e[14];
      const hx = Math.abs(e[0]) * h[0] + Math.abs(e[4]) * h[1] + Math.abs(e[8]) * h[2];
      const hy = Math.abs(e[1]) * h[0] + Math.abs(e[5]) * h[1] + Math.abs(e[9]) * h[2];
      const hz = Math.abs(e[2]) * h[0] + Math.abs(e[6]) * h[1] + Math.abs(e[10]) * h[2];
      rec.boxes.push({
        x0: wx - hx, x1: wx + hx, y0: wy - hy, y1: wy + hy, z0: wz - hz, z1: wz + hz,
        mesh: g.mesh, site: rec.key,
      });
    }
    rec.elements = null;
  }

  return { world, bySite, claims: world.cityApi.placedClaims(), total, unmatched, cityRoot };
}
