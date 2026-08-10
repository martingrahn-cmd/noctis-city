/**
 * context.js — the registry, and the quarantine.
 *
 * This file implements CONTRACT §1 and §2. It is the only channel between
 * modules and the only place that decides a module is dead.
 *
 * The quarantine is the point. A module that throws is removed and the frame
 * completes without it. That is not error tolerance for its own sake: it is so
 * that when session 4 adds a weather system that divides by zero on frame 200,
 * you get a city with no rain and one line in the console, instead of a black
 * page and no information.
 */

import * as THREE from 'three';
import { hashString, mulberry32, rngHelpers } from '../lib/rng.js';
import { EXPOSURE } from './constants.js';

const PHASES = ['register', 'init', 'update', 'render', 'event', 'dispose'];

export function createContext({ renderer, scene, camera, config }) {
  /** @type {Map<string, {mod: object, api: object, state: string}>} */
  const records = new Map();
  let order = [];
  let booted = false;

  const faults = [];
  const warned = new Set();
  /** Set once, the first time the frame has to be drawn without a render(). */
  let fallbackArmed = false;
  const listeners = new Map();
  const rngCache = new Map();

  const rootSeed = hashString(String(config.seed));

  function log(...msg) {
    console.log('[noctis]', ...msg);
  }

  function warnOnce(key, ...msg) {
    if (warned.has(key)) return;
    warned.add(key);
    console.warn('[noctis]', ...msg);
  }

  function recordFault(name, phase, err) {
    if (!PHASES.includes(phase)) phase = 'unknown';
    const message = err && err.message ? err.message : String(err);
    const stack = err && err.stack ? err.stack : '';
    faults.push({ name, phase, message, stack });
    // Once. A module that throws every frame must not also spam every frame —
    // the console is evidence, and 4000 identical lines destroy it.
    console.error(`[noctis] quarantined ${name} during ${phase}: ${message}`, err);
  }

  function quarantine(name, phase, err) {
    const rec = records.get(name);
    if (rec) {
      rec.state = 'quarantined';
      rec.api = undefined;
      if (typeof rec.mod.dispose === 'function') {
        try {
          rec.mod.dispose(ctx);
        } catch (e) {
          // A dispose that throws while cleaning up after an init that threw is
          // not new information. Record it, do not cascade.
          console.error(`[noctis] ${name}.dispose() also threw during quarantine`, e);
        }
      }
    }
    recordFault(name, phase, err);
    order = order.filter((n) => n !== name);
  }

  // -------------------------------------------------------------------------

  function register(mod) {
    if (booted) {
      warnOnce('late-register', `register(${mod && mod.name}) after boot — ignored`);
      return;
    }
    try {
      if (!mod || typeof mod !== 'object') throw new Error('module is not an object');
      if (typeof mod.name !== 'string' || !mod.name) throw new Error('module has no name');
      if (records.has(mod.name)) throw new Error(`duplicate module name '${mod.name}'`);
      for (const key of ['init', 'update', 'render', 'dispose']) {
        if (mod[key] !== undefined && typeof mod[key] !== 'function') {
          throw new Error(`${mod.name}.${key} is not a function`);
        }
      }
      if (mod.needs !== undefined && !Array.isArray(mod.needs)) {
        throw new Error(`${mod.name}.needs is not an array`);
      }
      records.set(mod.name, { mod, api: undefined, state: 'registered' });
    } catch (e) {
      recordFault((mod && mod.name) || '<anonymous>', 'register', e);
    }
  }

  /**
   * Kahn's algorithm over `needs`, with registration order as the tiebreak so
   * the update order is stable across runs. Anything left over is in a cycle.
   */
  function topoSort() {
    const names = [...records.keys()];
    const indeg = new Map(names.map((n) => [n, 0]));
    const dependents = new Map(names.map((n) => [n, []]));

    for (const n of names) {
      const needs = records.get(n).mod.needs || [];
      for (const dep of needs) {
        if (!records.has(dep)) continue; // missing dep handled at init time
        indeg.set(n, indeg.get(n) + 1);
        dependents.get(dep).push(n);
      }
    }

    const ready = names.filter((n) => indeg.get(n) === 0);
    const sorted = [];
    while (ready.length) {
      const n = ready.shift();
      sorted.push(n);
      for (const d of dependents.get(n)) {
        indeg.set(d, indeg.get(d) - 1);
        if (indeg.get(d) === 0) ready.push(d);
      }
    }

    const cycle = names.filter((n) => !sorted.includes(n));
    return { sorted, cycle };
  }

  function boot() {
    if (booted) return;
    booted = true;

    const { sorted, cycle } = topoSort();
    for (const n of cycle) {
      quarantine(n, 'init', new Error(`dependency cycle involving '${n}'`));
      records.get(n).state = 'quarantined';
    }

    order = [];
    for (const name of sorted) {
      const rec = records.get(name);
      const needs = rec.mod.needs || [];
      const missing = needs.filter((d) => !records.has(d) || records.get(d).state !== 'live');
      if (missing.length) {
        // Never partially initialised. CONTRACT §2.
        quarantine(name, 'init', new Error(`needs unavailable module(s): ${missing.join(', ')}`));
        continue;
      }
      try {
        const returned = rec.mod.init ? rec.mod.init(ctx) : undefined;
        rec.api = returned && typeof returned === 'object' ? returned : rec.mod.api || {};
        rec.state = 'live';
        order.push(name);
      } catch (e) {
        quarantine(name, 'init', e);
      }
    }
  }

  function get(name) {
    const rec = records.get(name);
    if (!rec || rec.state !== 'live') return undefined;
    return rec.api;
  }

  function has(name) {
    const rec = records.get(name);
    return !!rec && rec.state === 'live';
  }

  function update(dt) {
    // Snapshot: a module quarantined mid-loop mutates `order`.
    const names = order.slice();
    for (const name of names) {
      const rec = records.get(name);
      if (!rec || rec.state !== 'live' || !rec.mod.update) continue;
      try {
        rec.mod.update(ctx, dt);
      } catch (e) {
        quarantine(name, 'update', e);
      }
    }
  }

  function render() {
    for (const name of order.slice()) {
      const rec = records.get(name);
      if (!rec || rec.state !== 'live' || !rec.mod.render) continue;
      try {
        rec.mod.render(ctx);
        return;
      } catch (e) {
        quarantine(name, 'render', e);
        break;
      }
    }
    // CONTRACT §2.1: no renderer left. Draw the scene rather than nothing —
    // a frame that is visibly not the real image is the entire idea.
    //
    // §5.2 holds renderer.toneMapping at NoToneMapping because post owns
    // tonemapping and doing it twice is worse than not doing it. But post is
    // exactly what has just died, and §5.3 makes every value in this scene
    // physical: a noon sky is thousands of cd/m² and the sun disc is 1e9. Sent
    // straight to an 8-bit framebuffer, all of it clips, and the fallback draws
    // a uniformly white screen — which is not a bug you can see, it is a bug
    // you cannot see past, and it is indistinguishable from the renderer having
    // died outright. tools/faultcheck.mjs found this on its first run.
    //
    // So the fallback takes the anchor exposure — the same EV the real system
    // partially adapts around, not a number invented here — and three's own
    // ACES. No bloom, no adaptation, no veiling glare, no Purkinje shift: it
    // looks wrong, which is correct. It is also legible, which is the point.
    if (!fallbackArmed) {
      fallbackArmed = true;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1 / (1.2 * Math.pow(2, EXPOSURE.anchorEV));
      warnOnce(
        'fallback-render',
        'no module is rendering — falling back to an untonemapped scene at the anchor exposure'
      );
    }
    try {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    } catch (e) {
      warnOnce('fallback-render-failed', 'fallback render also failed', e);
    }
  }

  function dispose() {
    for (const name of order.slice().reverse()) {
      const rec = records.get(name);
      if (!rec || !rec.mod.dispose) continue;
      try {
        rec.mod.dispose(ctx);
      } catch (e) {
        recordFault(name, 'dispose', e);
      }
    }
    order = [];
    records.clear();
    listeners.clear();
  }

  // -------------------------------------------------------------------------

  function on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event) && listeners.get(event).delete(fn);
  }

  function emit(event, payload) {
    const set = listeners.get(event);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload, ctx);
      } catch (e) {
        // A bad listener never breaks the emitter, and never breaks the frame.
        warnOnce(`listener:${event}:${fn.name || 'anon'}`, `listener for '${event}' threw`, e);
        set.delete(fn);
      }
    }
  }

  /**
   * CONTRACT §6. One generator per named stream, cached, so a module that calls
   * ctx.rng('buildings') twice gets the same generator and a module added later
   * cannot shift an existing stream's sequence.
   */
  function rng(stream) {
    if (!rngCache.has(stream)) {
      const seed = (rootSeed ^ hashString(stream)) >>> 0;
      rngCache.set(stream, rngHelpers(mulberry32(seed)));
    }
    return rngCache.get(stream);
  }

  const size = {
    width: 1,
    height: 1,
    dpr: 1,
  };

  function setSize(width, height, dpr) {
    size.width = width;
    size.height = height;
    size.dpr = dpr;
    emit('resize', { width, height, dpr });
  }

  const ctx = {
    renderer,
    scene,
    camera,
    config,
    size,

    register,
    boot,
    get,
    has,
    update,
    render,
    dispose,
    setSize,

    on,
    emit,
    rng,
    log,
    warnOnce,

    get faults() {
      return faults.slice();
    },
    /** Names of every module that is currently live, in update order. */
    get live() {
      return order.slice();
    },
  };

  return ctx;
}
