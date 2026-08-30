/**
 * lighting.js — the two global sources, and the photocell.
 *
 * Sun and sky are the only global lights (brief: "Sun and sky as the only
 * global sources"). The moon is the sun's night shift and is here for one
 * reason: without a second key, a night frame has no shape above the reach of
 * the streetlights, and every building becomes a black rectangle.
 *
 * Nothing in this file chooses a colour. The sun's colour is the atmospheric
 * transmittance along its own path — computed in lib/atmosphere.js from the
 * elevation that lib/solar.js derived from timeOfDay. At 2° the path is
 * nineteen air masses and the blue channel arrives at 0.6% strength. That is
 * the entire sunset.
 */

import * as THREE from 'three';
import { LIGHT } from '../core/constants.js';
import { luminance } from '../lib/color.js';

const UP = new THREE.Vector3(0, 1, 0);
/** Hoisted: update() runs every frame and must not allocate. */
const shadowTarget = new THREE.Vector3();
const shadowEye = new THREE.Vector3();
const shadowView = new THREE.Matrix4();

export function createLighting(options = {}) {
  const cfg = {
    shadowMapSize: 4096,
    shadowExtent: 170,
    shadowDistance: 320,
    /** Metres. Shadow acne on grazing 2° light needs a real normal offset. */
    shadowNormalBias: 0.09,
    shadowBias: -0.0006,
    ...options,
  };

  let sun = null;
  let moon = null;
  let sunTarget = null;
  let moonTarget = null;

  const api = {
    sun: null,
    moon: null,
    /** Total illuminance on a horizontal surface, lux. What the photocell sees. */
    ambientLux: 0,
    /** True when the street lighting should be on. Hysteresis, not a threshold. */
    photocellOn: false,
    sunIlluminanceLux: 0,
    moonIlluminanceLux: 0,
  };

  function applySkyState(ctx) {
    const time = ctx.get('time');
    const sky = ctx.get('sky');
    if (!time || !sky) return;

    // --- sun ---
    const E = sky.sunIlluminance;
    const lux = luminance(E[0], E[1], E[2]);
    api.sunIlluminanceLux = lux;

    if (lux > 1e-3) {
      sun.visible = true;
      sun.intensity = lux;
      // Chromaticity only — the magnitude is the intensity, in lux.
      sun.color.setRGB(E[0] / lux, E[1] / lux, E[2] / lux, THREE.LinearSRGBColorSpace);
    } else {
      sun.visible = false;
      sun.intensity = 0;
    }
    /**
     * The shadow camera follows the view camera. CONTRACT §11.
     *
     * Until session 4 the sun sat at `direction × shadowDistance` with its
     * target left at the world origin, and that was correct for exactly as long
     * as the world was one block at the origin. In a streaming city the player
     * walks a kilometre away and leaves the shadow map behind: a 340 m box
     * centred on a place nobody is standing. Every surface outside it renders
     * fully lit, which does not look like a bug — it looks like an overcast day
     * that only happens away from the centre of the map.
     *
     * SNAPPED TO A SHADOW TEXEL. Moving the shadow camera continuously makes
     * every shadow edge crawl as the player walks, because the depth samples
     * land in different places each frame. Snapping the target to whole texels
     * *in the light's own basis* means the samples land on the same world
     * positions until the camera has moved a full texel. The texel is
     * 2 × 170 / 4096 = 83 mm, so the residual jump is below a pixel at any
     * distance the shadow is legible from.
     */
    const texel = (2 * cfg.shadowExtent) / cfg.shadowMapSize;
    const d = time.sun.direction;
    shadowTarget.set(ctx.camera.position.x, 0, ctx.camera.position.z);
    shadowEye.copy(d).multiplyScalar(cfg.shadowDistance).add(shadowTarget);
    shadowView.lookAt(shadowEye, shadowTarget, UP);
    shadowView.invert();
    shadowTarget.applyMatrix4(shadowView);
    shadowTarget.x = Math.round(shadowTarget.x / texel) * texel;
    shadowTarget.y = Math.round(shadowTarget.y / texel) * texel;
    shadowView.invert();
    shadowTarget.applyMatrix4(shadowView);

    sun.target.position.copy(shadowTarget);
    sun.target.updateMatrixWorld();
    sun.position.copy(d).multiplyScalar(cfg.shadowDistance).add(shadowTarget);
    sun.castShadow = lux > 40;

    // --- moon ---
    const M = sky.moonIlluminance;
    const mlux = luminance(M[0], M[1], M[2]);
    api.moonIlluminanceLux = mlux;
    if (mlux > 1e-5 && time.moon.aboveHorizon) {
      moon.visible = true;
      moon.intensity = mlux;
      moon.color.setRGB(M[0] / mlux, M[1] / mlux, M[2] / mlux, THREE.LinearSRGBColorSpace);
    } else {
      moon.visible = false;
      moon.intensity = 0;
    }
    moon.position.copy(time.moon.direction).multiplyScalar(cfg.shadowDistance);

    // --- photocell ---
    api.ambientLux = sky.groundIlluminanceLux;
    if (api.photocellOn && api.ambientLux > LIGHT.photocellOffLux) api.photocellOn = false;
    else if (!api.photocellOn && api.ambientLux < LIGHT.photocellOnLux) api.photocellOn = true;

    // Tell the sky what the street lighting is putting on the road, so the
    // environment map's lower hemisphere is a lit surface rather than a hole.
    sky.setGroundLighting(api.photocellOn ? LIGHT.streetAverageLux : 0);
  }

  return {
    name: 'lighting',
    needs: ['time', 'sky'],

    init(ctx) {
      sunTarget = new THREE.Object3D();
      sunTarget.position.set(0, 6, 0);
      ctx.scene.add(sunTarget);

      sun = new THREE.DirectionalLight(0xffffff, 0);
      sun.name = 'lighting:sun';
      sun.target = sunTarget;
      sun.castShadow = true;

      const s = sun.shadow;
      s.mapSize.set(cfg.shadowMapSize, cfg.shadowMapSize);
      s.camera.left = -cfg.shadowExtent;
      s.camera.right = cfg.shadowExtent;
      s.camera.top = cfg.shadowExtent;
      s.camera.bottom = -cfg.shadowExtent;
      s.camera.near = 1;
      s.camera.far = cfg.shadowDistance * 2.2;
      s.bias = cfg.shadowBias;
      s.normalBias = cfg.shadowNormalBias;
      s.radius = 2.2;
      s.camera.updateProjectionMatrix();
      ctx.scene.add(sun);

      moonTarget = new THREE.Object3D();
      moonTarget.position.set(0, 6, 0);
      ctx.scene.add(moonTarget);

      moon = new THREE.DirectionalLight(0xffffff, 0);
      moon.name = 'lighting:moon';
      moon.target = moonTarget;
      /**
       * NO MOON SHADOWS — and since session 56 that sentence has a different
       * justification. It used to read "at 0.2 lux the shadow is three orders
       * of magnitude below the streetlights'"; the moon redistribution
       * (`LIGHT.moonRedistribution`) now delivers about 4 lx, a quarter of
       * `streetAverageLux`, so the old arithmetic is repealed. What stands:
       * the key exists to separate the FACES of one object (a headstone's lit
       * side against its dark side), which needs no occlusion; a second 4k
       * depth pass every frame is the cost; and the error — moonlight
       * reaching a wall another building shades — is a lie LOOK.md §0
       * licenses at a luminance where the veil already owns the floor. If a
       * moonlit wall inside a shadowed canyon ever reads wrong in a frame,
       * this is the line to reopen.
       */
      moon.castShadow = false;
      ctx.scene.add(moon);

      api.sun = sun;
      api.moon = moon;

      applySkyState(ctx);
      // Recompute when the sky is rebuilt, not on a timer of our own.
      ctx.on('sky:rebuilt', () => applySkyState(ctx));

      return api;
    },

    update(ctx) {
      applySkyState(ctx);
    },

    dispose(ctx) {
      if (sun) {
        ctx.scene.remove(sun);
        sun.dispose();
      }
      if (moon) {
        ctx.scene.remove(moon);
        moon.dispose();
      }
      if (sunTarget) ctx.scene.remove(sunTarget);
      if (moonTarget) ctx.scene.remove(moonTarget);
    },
  };
}
