/**
 * time.js — the only clock.
 *
 * CONTRACT §3. Sun direction, sky colour, exposure, streetlight activation,
 * sign emissive, headlights and NPC density all read from here. Nothing else
 * keeps a clock. Nothing anywhere hardcodes a light colour keyed on the hour.
 *
 * This module owns exactly one number, `timeOfDay`, and derives everything
 * astronomical from it. If a later session wants "it should look moody at
 * 6pm", the answer is to change the latitude or the day of year, not to add a
 * ramp — because a ramp is a lie the shadows will contradict.
 */

import * as THREE from 'three';
import { SITE } from '../core/constants.js';
import {
  sunPosition,
  moonPosition,
  moonIlluminatedFraction,
  moonIlluminance,
  dirFromAzEl,
  starRotation,
} from '../lib/solar.js';

export function createTime(options = {}) {
  const cfg = {
    latitudeDeg: SITE.latitudeDeg,
    dayOfYear: SITE.dayOfYear,
    dayLengthSeconds: 1200,
    moonPhase: 0.62,
    ...options,
  };

  const scratch = { x: 0, y: 0, z: 0 };
  let api = null;

  function recompute() {
    const t = api.timeOfDay;

    const s = sunPosition(t, cfg.latitudeDeg, cfg.dayOfYear);
    dirFromAzEl(s.azimuth, s.elevation, scratch);
    api.sun.direction.set(scratch.x, scratch.y, scratch.z);
    api.sun.elevationRad = s.elevation;
    api.sun.azimuthRad = s.azimuth;
    api.sun.aboveHorizon = s.elevation > 0;

    const m = moonPosition(t, cfg.latitudeDeg, api.moon.phase);
    dirFromAzEl(m.azimuth, m.elevation, scratch);
    api.moon.direction.set(scratch.x, scratch.y, scratch.z);
    api.moon.elevationRad = m.elevation;
    api.moon.azimuthRad = m.azimuth;
    api.moon.aboveHorizon = m.elevation > 0;
    api.moon.illuminatedFraction = moonIlluminatedFraction(api.moon.phase);
    api.moon.illuminanceLux = moonIlluminance(api.moon.phase);

    api.starRotationRad = starRotation(t);
  }

  function setTimeOfDay(t, ctx, discontinuous = true) {
    const previous = api.timeOfDay;
    // Wrap rather than clamp: 1.0 and 0.0 are the same instant.
    api.timeOfDay = ((t % 1) + 1) % 1;
    recompute();
    if (ctx) ctx.emit('timeOfDay', { t: api.timeOfDay, previous, discontinuous });
  }

  return {
    name: 'time',

    init(ctx) {
      api = {
        timeOfDay: 0,
        now: 0,
        dt: 0,
        frame: 0,
        paused: !!ctx.config.paused,
        timeScale: 1,
        /**
         * Multiplier on the SUN's advance only. 1 is the shipped 20-minute day.
         * See `setSunScale` for why this is a second rate rather than a second
         * clock, and for the arithmetic that says 1 is already 72x real time.
         */
        sunScale: 1,
        dayLengthSeconds: cfg.dayLengthSeconds,
        latitudeDeg: cfg.latitudeDeg,
        dayOfYear: cfg.dayOfYear,
        starRotationRad: 0,

        sun: {
          direction: new THREE.Vector3(0, 1, 0),
          elevationRad: 0,
          azimuthRad: 0,
          aboveHorizon: true,
        },
        moon: {
          direction: new THREE.Vector3(0, 1, 0),
          elevationRad: 0,
          azimuthRad: 0,
          aboveHorizon: false,
          phase: cfg.moonPhase,
          illuminatedFraction: 0,
          illuminanceLux: 0,
        },

        setTimeOfDay: (t) => setTimeOfDay(t, ctx, true),
        setPaused: (p) => {
          api.paused = !!p;
        },
        setTimeScale: (s) => {
          api.timeScale = Math.max(0, s);
        },
        /**
         * HOW FAST THE SUN MOVES, AND ONLY THE SUN — session 19, item 4.
         *
         * STILL ONE CLOCK. CONTRACT §3 says this module owns `timeOfDay` and
         * nothing else keeps a clock; it does not say this module owns only one
         * rate. Both numbers live here, both are read here, and `update()` below
         * is the only place either is applied — which is the property the
         * single-clock rule is actually protecting.
         *
         * WHY A SECOND RATE WAS NEEDED. `timeScale` scales `now` AND `timeOfDay`
         * together, and `now` is what `traffic`, `weather`, `streetlife` and
         * `player` each integrate. So a time menu built on `setTimeScale` would
         * run the pedestrians, the traffic and the walker at whatever rate the
         * operator picked for the SUN — a 120× dusk with the crowd sprinting
         * through it. STATE 18 §7.5 found this and did not fix it.
         *
         * THE ARITHMETIC, AND IT CORRECTS THE BRIEF. `dayLengthSeconds` is 1200,
         * i.e. **a 20-minute day**, which is already **72× real time**. The
         * brief's "a full day in 12 minutes is 120×" is 120× REAL, not 120× this
         * project — 720 s against 86 400 s. So the three useful rates are:
         *
         *     real time      86 400 s/day    sunScale = 1200/86400 = 0.01389
         *     as shipped      1 200 s/day    sunScale = 1                 (72× real)
         *     fast              720 s/day    sunScale = 1200/720  = 1.667 (120× real)
         *
         * **The shipped default is already 0.6× of the "fast" setting**, and
         * that is worth knowing before anybody tunes it: the interesting rate
         * for looking at a dusk is not a bigger number, it is a smaller one.
         */
        setSunScale: (s) => {
          api.sunScale = Math.max(0, s);
        },
        setMoonPhase: (p) => {
          api.moon.phase = ((p % 1) + 1) % 1;
          recompute();
        },
        advance: (seconds) => {
          const previous = api.timeOfDay;
          api.timeOfDay = ((api.timeOfDay + seconds / cfg.dayLengthSeconds) % 1 + 1) % 1;
          recompute();
          ctx.emit('timeOfDay', { t: api.timeOfDay, previous, discontinuous: false });
        },
        /** Human-readable, for overlays and log lines. Solar time. */
        clockString: () => {
          const h = api.timeOfDay * 24;
          const hh = Math.floor(h);
          const mm = Math.floor((h - hh) * 60);
          return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
        },
      };

      setTimeOfDay(ctx.config.t, null, true);
      return api;
    },

    update(ctx, dt) {
      api.dt = dt;
      api.frame++;
      if (api.paused || api.timeScale === 0) return;
      /**
       * TWO RATES, ONE CLOCK, AND THIS IS THE ONLY PLACE EITHER IS APPLIED.
       *
       * `now` is SIMULATED SECONDS and is what `traffic`, `weather`,
       * `streetlife`, `player` and the aviation beacons integrate. It advances
       * at `timeScale` and at nothing else, so nothing that MOVES is affected by
       * the sun's rate.
       *
       * `timeOfDay` is WHERE THE SUN IS. It advances at `timeScale · sunScale`,
       * so `?paused=1` and `setTimeScale(0)` still freeze it — a paused world is
       * paused, including its sky — and the menu's rate only ever changes how
       * fast the day runs under a city moving at its own pace.
       *
       * Both are multiplied rather than chosen between: a session that wanted
       * slow motion AND a fast sun would get both, and an engine that picked one
       * would be correct in whichever case nobody tested.
       */
      const scaled = dt * api.timeScale;
      api.now += scaled;
      api.advance(scaled * api.sunScale);
    },
  };
}
