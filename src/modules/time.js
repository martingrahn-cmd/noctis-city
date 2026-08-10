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
      const scaled = dt * api.timeScale;
      api.now += scaled;
      api.advance(scaled);
    },
  };
}
