/**
 * main.js — bootstrap. Renderer, scene, camera, context, registration, loop.
 *
 * This file knows every module by name exactly once, here. Nothing else in the
 * project does — CONTRACT §0.1.
 */

import * as THREE from 'three';
import { createContext } from './core/context.js';
import { createLoop } from './core/loop.js';
import { createTime } from './modules/time.js';
import { createSky } from './modules/sky.js';
import { createLights } from './modules/lights.js';
import { createLighting } from './modules/lighting.js';
import { createBlock } from './modules/block.js';
import { createCity } from './modules/city.js';
import { createRiver } from './modules/river.js';
import { createCanyon } from './modules/canyon.js';
import { createCamera } from './modules/camera.js';
import { createExposure } from './modules/exposure.js';
import { createPost } from './modules/post.js';
import { createTraffic } from './modules/traffic.js';
import { createWeather } from './modules/weather.js';
import { createStreetlife } from './modules/streetlife.js';
import { createPlayer } from './modules/player.js';
import { createAircraft } from './modules/aircraft.js';
import { createMoving } from './modules/moving.js';
import { createUi } from './modules/ui.js';
import { createHud } from './modules/hud.js';
import { createHarness } from './modules/harness.js';

const DEFAULTS = {
  seed: '1337',
  t: 0.78,
  perf: 0,
  paused: 0,
  /**
   * The on-screen instrument panel — session 20, item 6, and it is now a
   * MODULE rather than the four-line `setInterval` this key used to drive.
   *
   * −1 FOLLOWS `player`, 0 forces it off, 1 forces it on: the same shape `ui`
   * and `fieldDrip` use, and for the same reason `ui` gives — the panel is a
   * DOM overlay and every gate reads `page.screenshot()`, so it must not be
   * present by default or nineteen sessions of look thresholds would have a
   * frame-time readout in the corner of every frame they were derived against.
   *
   * IT WAS `0` AND IT IS `-1`, WHICH IS A DEFAULT CHANGING. What that changes
   * is only the case where `?player=1` is passed and `?hud` is not, i.e. the
   * operator walking the city — which is the one case this exists for. No gate
   * passes `?player=1` (CONTRACT §11), so no gate's `<body>` moves.
   */
  hud: -1,
  shot: 'street',
  debug: '',
  /** Comma-separated `module:phase` fault injections. See injectFaults below. */
  fault: '',
  /** 0..1 surface wetness. Session 4's weather owns this; the look gate captures both ends. */
  wet: 0,
  /** 0 disables every indirect term, for bisecting against the session 1 look. */
  indirect: 1,
  /** 0 disables screen-space reflection, for bisecting against the session 2 look. */
  ssr: 1,
  /** 0 removes the traffic system entirely. Bisecting switch, session 4b. */
  traffic: 1,
  /** 0 removes the three rain particle layers AND the weather module's wetness driver. */
  rain: 1,
  /** 0 removes pedestrians and street-level stalls. */
  streetlife: 1,
  /** 0 removes the aircraft entirely. Session 20's bisecting switch. */
  aircraft: 1,
  /**
   * 0 removes the viaduct's trains and the construction cranes' slewing
   * assemblies. Session 21's bisecting switch — an ordinary one: the
   * `register()` does not happen, so `ctx.get('moving')` is undefined and every
   * consumer already handles that (CONTRACT §1.2).
   */
  moving: 1,
  /**
   * 1 registers the first-person controller and hands it `ctx.camera`.
   * SESSION 17, and it is OFF by default, which is the whole of what keeps the
   * harness safe.
   *
   * `runRoute`, `poseRoute` and `setShotAt` drive every gate and both film
   * tools, and a second writer of `ctx.camera` is not a race with a winner —
   * it is a frame that alternates between two answers at whatever the update
   * order happens to be. So the switch is the ordinary CONTRACT §6 kind: the
   * `register()` does not happen, `ctx.get('player')` is undefined, and every
   * gate runs in exactly the state it has run in for sixteen sessions.
   *
   * `camera.setDriven()` exists for the case where it IS registered, and the
   * arbitration is one-way: an explicit placement always wins and the player
   * re-seats itself there. See `player.js`.
   */
  player: 0,
  /**
   * `x,y,z` — where the player stands. Empty means `PLAYER.spawn`, which is the
   * pavement beside the `street` shot.
   *
   * IT IS HOW A FIND BECOMES A BUG REPORT. Free movement goes places no route
   * has been, and the thing it turns up is a position; without a way to write a
   * position down and come back to it, every find is a memory. `P` prints a
   * paste-ready URL containing this parameter, `t` and `seed`, which is the
   * whole of what it takes to reproduce a frame.
   *
   * A two-component `x,z` stands on the ground. Three components are honoured
   * as written, including a y in the air — falling from a spawn is a legitimate
   * question to ask about a surface.
   */
  spawn: '',
  /**
   * 0 removes the river's SURFACES — the water, the quay walls and every
   * bridge. Session 15's bisecting switch, and the one arm the river's
   * frame-time cost is measured against.
   *
   * IT DOES NOT PUT THE BUILDINGS BACK. The cut is in the pure generator and
   * is baked into the canyon field by a worker that is never told about URL
   * parameters (CONTRACT §8.1: if generation depended on anything but
   * `(rootSeed, cx, cz)` the field would describe a different city from the one
   * being drawn, with no stack trace). What this removes is what the river
   * COSTS TO SHADE, which is the question an A/B on it can answer. `block.js`
   * reads it too, so that arm B has a whole earth plane rather than a hole.
   */
  river: 1,
  /**
   * 0 removes the promenade lamp line from both quays. Session 16's arm.
   *
   * A SUB-CONTENT SWITCH READ INSIDE `city.js` RATHER THAN A `register()` THAT
   * DOES NOT HAPPEN, and the distinction is §6's: a bisecting switch omits a
   * MODULE, and this is one band of furniture inside one. The precedent is
   * `fieldDrip`, which is also read in the module it belongs to and for the
   * same reason — there is no module to leave unregistered.
   *
   * It exists because session 16 added the lamps to answer "the far bank is
   * unlit" and the standing rule is that an arm is a URL parameter rather than
   * a second copy of a module. Arm B is the frame the operator was looking at.
   */
  quayLamps: 1,
  /**
   * Canyon field layers uploaded per frame per array. −1 leaves the decision
   * to `CITY.fieldLayersPerFrame`; **0 is the pre-session-10 burst** — every
   * layer of a landed bake flagged in the frame it lands, which is the arm the
   * fix is measured against; N > 0 overrides the constant.
   *
   * A SCHEDULE AND NOT A CONTENT SWITCH, which is why it is a number rather
   * than a 0/1 like the five above it. Every value delivers the same bytes to
   * the same slots and flips the same table entries; what differs is how many
   * `texSubImage3D` calls one frame is asked for. It is here rather than in a
   * probe because an A/B on a schedule wants two arms of ONE file (§6's
   * interleaving rule), and a file swap to change one integer is the arrangement
   * §9.1 warns about — two copies of a module that have to be kept in step.
   */
  fieldDrip: -1,
  /**
   * The map, the time menu and the fullscreen button. Session 19.
   *
   * −1 FOLLOWS `player`, 0 forces it off, 1 forces it on — the same shape
   * `fieldDrip` uses, and for the same reason: the useful default is "whatever
   * the other setting implies" and the other two values exist so that a session
   * can pin it either way without arguing with the implication.
   *
   * WHY IT FOLLOWS THE PLAYER RATHER THAN DEFAULTING ON. This is the project's
   * first DOM overlay, and every gate reads `page.screenshot()` — so an overlay
   * present by default would put buttons in `tools/look-out/*.png` and in every
   * frame eighteen sessions of thresholds were derived against. `?player=1` is
   * already the flag no gate sets (CONTRACT §11), so following it means the
   * gates render the same `<body>` they always have, and the one person who
   * wants a map is the one person who has asked for a controller.
   */
  ui: -1,
};

function readConfig() {
  const params = new URLSearchParams(window.location.search);
  const cfg = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS)) {
    if (!params.has(key)) continue;
    const raw = params.get(key);
    cfg[key] = typeof DEFAULTS[key] === 'number' ? Number(raw) : raw;
  }
  cfg.t = Number(params.get('t') ?? DEFAULTS.t);
  return Object.freeze(cfg);
}

const config = readConfig();

// --- renderer -------------------------------------------------------------

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({
  canvas,
  // No canvas AA: the scene resolves through a 4× multisampled HDR target, and
  // asking for it here would allocate a second, unused multisample buffer.
  antialias: false,
  alpha: false,
  stencil: false,
  depth: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});

THREE.ColorManagement.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
// CONTRACT §5.2: tonemapping is ours, in the composite pass, after bloom and
// after exposure. Letting three do it here would apply it twice.
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// The frame is many render() calls. Without this, renderer.info reports the
// last pass rather than the frame.
renderer.info.autoReset = false;

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 6000);

const ctx = createContext({ renderer, scene, camera, config });
const loop = createLoop(ctx);

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  ctx.setSize(width, height, dpr);
}
window.addEventListener('resize', resize);

// --- fault injection ------------------------------------------------------

/**
 * `?fault=block:update` makes block.update throw the first time it is called.
 * `?fault=block:init,post:render` injects two. Phases: init, update, render.
 *
 * CONTRACT §2.1 — a module that throws is quarantined and the frame keeps
 * rendering — was verified by hand in session 1 and by nothing since. This is
 * the hook `tools/faultcheck.mjs` drives so it stays verified. It lives here
 * because main.js is the one file allowed to know a module by name (§0.1), and
 * it is inert unless the query param is present.
 *
 * The throw fires once. A module that threw during `update` has already been
 * removed from the update list, so a second call never happens in the real
 * thing either — and the gate asserts that exactly one error was logged.
 */
const FAULT_PHASES = new Set(['init', 'update', 'render']);

function injectFaults(mod, spec) {
  if (!spec) return mod;
  for (const entry of String(spec).split(',')) {
    const [name, phase = 'update'] = entry.trim().split(':');
    if (name !== mod.name || !FAULT_PHASES.has(phase)) continue;
    // Only wrap something that is already there. Synthesising a render() onto a
    // module that has none would make it the frame's renderer, which is a
    // different experiment from the one being asked for.
    if (typeof mod[phase] !== 'function') {
      console.warn(`[noctis] ?fault=${entry}: ${name} has no ${phase}() to inject into`);
      continue;
    }
    const original = mod[phase];
    let fired = false;
    mod[phase] = function (...a) {
      if (!fired) {
        fired = true;
        throw new Error(`injected fault in ${name}.${phase} (?fault=${entry})`);
      }
      return original.apply(this, a);
    };
  }
  return mod;
}

// --- modules --------------------------------------------------------------
// Registration order is only a tiebreak; `needs` decides the real order.

const register = (mod) => ctx.register(injectFaults(mod, config.fault));
/** A content switch is `register()` not being called. See the block below. */
const on = (key) => Number(config[key]) !== 0;

register(createTime());
register(createCamera({ shot: config.shot }));
register(createLights());
register(createSky());
register(createLighting());
register(createBlock());
register(createCanyon());
register(createCity());
if (on('river')) register(createRiver());
register(createExposure());
register(createPost());

/**
 * THE BISECTING SWITCHES FOR SESSION 4b's THREE CONTENT SYSTEMS.
 *
 * `?indirect=0` and `?ssr=0` exist so that a cost or a look change can be
 * ATTRIBUTED rather than argued about, and sessions 2 and 3 both needed them.
 * 4b landed three whole systems with no equivalent, which was found the way
 * these things are always found: `downtown_dense` gained 3.6 ms of CPU and
 * there was no way to say which system spent it. Measured with these, on a
 * quiet machine, three runs an arm — see STATE.md.
 *
 * A switch removes the module rather than disabling it from inside. `ctx.get()`
 * returning undefined is what quarantine already looks like from the outside
 * (CONTRACT §1.2), every consumer has to handle it anyway, and main.js is the
 * one file allowed to know a module by name (§0.1) — so the alternative would
 * have put an `if (enabled)` in three files instead of a predicate in one.
 *
 * These are for the operator. A gate run with one of them off is a gate
 * measuring a different world, and `perfcheck` goes red on the missing
 * particle layers and the missing traffic role exactly as it should.
 */
if (on('traffic')) register(createTraffic());
if (on('rain')) register(createWeather());
if (on('streetlife')) register(createStreetlife());
/**
 * Aircraft — session 20, item 5. An ordinary CONTRACT §6 bisecting switch:
 * `?aircraft=0` omits the `register()`, which is how a cost or a look change
 * gets attributed to this system rather than argued about. Session 4b shipped
 * three systems at once without switches and could not say which spent the
 * 3.6 ms; every content system since has had one on the day it landed.
 */
if (on('aircraft')) register(createAircraft());
if (on('moving')) register(createMoving());

/**
 * The player, last of the content modules and after `camera` in registration
 * order — which is what puts its `update()` after the camera module's, so its
 * write to `ctx.camera` is the frame's final one. `needs: ['camera']` makes
 * that a topological fact rather than a registration-order accident.
 */
if (on('player')) {
  register(createPlayer({ spawn: config.spawn }));
} else {
  /**
   * AN ABSENT MODULE SAYS SO — session 19, and it cost a long round of
   * misdiagnosis to earn the line.
   *
   * `?player=1` is off by default and that is right (§6, and the harness safety
   * argument above). What was wrong is that the *absence* was silent: with no
   * controller registered the keyboard and the mouse do nothing, which is
   * indistinguishable from a controller that is registered and broken. Session
   * 18 spent a session measuring an input layer four ways and finding it
   * perfect, against a walkthrough that reported it dead — the walkthrough was
   * on a URL without the flag.
   *
   * This is the same class of finding as `player.js`'s `pointerlockerror`
   * handler: two different failures were producing one silence, and the repair
   * is an instrument rather than a fix. `console.log`, not `warn` — a default
   * configuration is not a warning, and `tools/lib/page.mjs` collects only
   * `error` and `warning`, so every gate's console assertions are untouched.
   */
  console.log(
    '[noctis] no first-person controller — the `player` module is NOT registered, ' +
    'because ?player=1 is absent (it is off by default; see main.js). ' +
    'Mouse, keyboard and gamepad move nothing until it is present. ' +
    `Try ${location.pathname}?player=1`
  );
}

/**
 * The UI surface — session 19. `?ui=-1` follows `?player=1`; see DEFAULTS.
 * Registered AFTER the player so that `ctx.get('player')` is live when the map
 * teleports, and before the harness for no reason but registration order.
 */
const uiOn = Number(config.ui) < 0 ? on('player') : Number(config.ui) !== 0;
if (uiOn) register(createUi());

/**
 * The HUD, session 20. It is handed `loop` for the same reason the harness is:
 * the rAF callback's boundary exists nowhere else (see `loop.js`'s note on
 * `timing()`), and a panel that measured `beforeRender` → `afterRender` instead
 * would be showing the render pass and calling it the frame.
 */
const hudOn = Number(config.hud) < 0 ? on('player') : Number(config.hud) !== 0;
if (hudOn) register(createHud({ loop }));

register(createHarness({ loop }));

resize();
ctx.boot();

if (ctx.faults.length) {
  console.warn(`[noctis] booted with ${ctx.faults.length} quarantined module(s)`, ctx.faults);
}
console.log('[noctis] live modules:', ctx.live.join(' → '));

loop.start();

// --- optional instrumentation --------------------------------------------

if (Number(config.perf) === 1) {
  import('../tools/perf-probe.js')
    .then(({ probe }) => {
      probe.attach(renderer);
      ctx.on('beforeRender', () => probe.frameStart());
      ctx.on('afterRender', () => probe.frameEnd());
    })
    .catch((e) => console.warn('[noctis] perf probe unavailable', e));
}

// Handy in the console while iterating; the gates never touch it.
window.__NOCTIS__ = { ctx, loop, THREE };
