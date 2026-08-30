/**
 * exposure.js — the eye.
 *
 * CONTRACT §5.4. This is the module that makes neon read as bright. A sign is
 * not bright because its emissive value is large; it is bright because the
 * viewer has adapted to a street four stops darker. Take the adaptation away
 * and you get one of two failures, both familiar: blown-out signs, or a black
 * city with a few glowing rectangles.
 *
 * Entirely GPU-side. Measurement reduces the HDR frame to a 1×1 target through
 * a mip chain; adaptation is a 1×1 ping-pong that reads its own previous value.
 * No readRenderTargetPixels anywhere — a readback stalls the pipeline, and an
 * instrument that costs more than what it measures is not an instrument.
 *
 * Two deliberate departures from a naive auto-exposure:
 *
 *   Partial adaptation. EV is pulled only part of the way toward the measured
 *   value. A fully adapting eye renders midnight and noon at the same
 *   brightness, which is not a day/night cycle, it is a light meter.
 *
 *   Centre weighting. The sky at noon is twenty times brighter than the street
 *   and fills the top third of the frame. Metering it flat drags the exposure
 *   down until the buildings are silhouettes. Every camera ever built weights
 *   the middle for the same reason.
 */

import * as THREE from 'three';
import { createFullscreen, FULLSCREEN_VERT } from '../core/fullscreen.js';
import { EXPOSURE } from '../core/constants.js';

const CHAIN_TOP = 128;

export function createExposure(options = {}) {
  const cfg = { ...EXPOSURE, ...options };

  let fs = null;
  let chain = [];
  let adaptRT = [null, null];
  let adaptIndex = 0;
  let measureMat = null;
  let reduceMat = null;
  let adaptMat = null;
  let snapNext = true;

  const shared = {
    uAdapted: { value: null },
    uExposureParams: { value: new THREE.Vector4(cfg.K, cfg.adaptStrength, cfg.anchorEV, 0) },
    uExposureClamp: { value: new THREE.Vector2(cfg.minEV, cfg.maxEV) },
  };

  function makeRT(size) {
    return new THREE.WebGLRenderTarget(size, size, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
      colorSpace: THREE.LinearSRGBColorSpace,
    });
  }

  return {
    name: 'exposure',

    init(ctx) {
      fs = createFullscreen();

      for (let s = CHAIN_TOP; s >= 1; s = s >> 1) chain.push(makeRT(s));
      adaptRT = [makeRT(1), makeRT(1)];

      measureMat = new THREE.ShaderMaterial({
        uniforms: {
          uScene: { value: null },
          uTexelSize: { value: new THREE.Vector2() },
          uMeterClamp: { value: new THREE.Vector2(cfg.meterMin, cfg.meterMax) },
          uMeterClip: { value: new THREE.Vector2(cfg.meterClipLow, cfg.meterClipHigh) },
          uPrevAdapted: { value: null },
        },
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: /* glsl */ `
uniform sampler2D uScene;
uniform vec2 uTexelSize;
uniform vec2 uMeterClamp;
uniform vec2 uMeterClip;
uniform sampler2D uPrevAdapted;
varying vec2 vUv;

float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
  // Four taps, each bilinear over the source, so a 128² meter still sees a
  // fifth of a 1600×900 frame rather than 1.6% of it.
  vec2 o = uTexelSize;
  vec3 s = texture2D(uScene, vUv + vec2(-o.x, -o.y)).rgb
         + texture2D(uScene, vUv + vec2( o.x, -o.y)).rgb
         + texture2D(uScene, vUv + vec2(-o.x,  o.y)).rgb
         + texture2D(uScene, vUv + vec2( o.x,  o.y)).rgb;
  // Histogram clipping around the current adaptation, then the absolute
  // clamps. Without the first, a frame full of neon meters as a frame full of
  // neon rather than as the street the neon is standing on.
  float adapted = exp(texture2D(uPrevAdapted, vec2(0.5)).r);
  float lo = max(uMeterClamp.x, adapted * uMeterClip.x);
  float hi = min(uMeterClamp.y, adapted * uMeterClip.y);
  float L = clamp(lum(s) * 0.25, lo, max(hi, lo * 1.0001));

  // Centre weighting. Falls off toward the frame edge — mostly sky above and
  // near foreground below, neither of which is what the exposure is for.
  vec2 d = (vUv - 0.5) * vec2(1.0, 1.15);
  float w = mix(1.0, 0.28, smoothstep(0.18, 0.62, length(d)));

  gl_FragColor = vec4(w * log(L), w, 0.0, 1.0);
}`,
        depthTest: false,
        depthWrite: false,
      });

      reduceMat = new THREE.ShaderMaterial({
        uniforms: { uSrc: { value: null }, uTexelSize: { value: new THREE.Vector2() } },
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: /* glsl */ `
uniform sampler2D uSrc;
uniform vec2 uTexelSize;
varying vec2 vUv;
void main() {
  // Exact 2×2 box: one bilinear tap at the shared corner of four source texels.
  vec2 o = uTexelSize * 0.5;
  vec4 s = texture2D(uSrc, vUv + vec2(-o.x, -o.y))
         + texture2D(uSrc, vUv + vec2( o.x, -o.y))
         + texture2D(uSrc, vUv + vec2(-o.x,  o.y))
         + texture2D(uSrc, vUv + vec2( o.x,  o.y));
  gl_FragColor = s * 0.25;
}`,
        depthTest: false,
        depthWrite: false,
      });

      adaptMat = new THREE.ShaderMaterial({
        uniforms: {
          uMeasured: { value: null },
          uPrevious: { value: null },
          uDt: { value: 1 / 60 },
          uTau: { value: new THREE.Vector2(cfg.tauUp, cfg.tauDown) },
          uSnap: { value: 1 },
          uMeterClamp: { value: new THREE.Vector2(cfg.meterMin, cfg.meterMax) },
        },
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: /* glsl */ `
uniform sampler2D uMeasured;
uniform sampler2D uPrevious;
uniform float uDt;
uniform vec2 uTau;
uniform float uSnap;
uniform vec2 uMeterClamp;
varying vec2 vUv;

void main() {
  vec2 acc = texture2D(uMeasured, vec2(0.5)).rg;
  // Geometric mean: the arithmetic mean of a scene containing a neon sign is
  // the neon sign.
  float target = acc.y > 1e-6 ? acc.x / acc.y : log(0.1);
  target = clamp(target, log(uMeterClamp.x), log(uMeterClamp.y));

  float prev = texture2D(uPrevious, vec2(0.5)).r;
  if (uSnap > 0.5 || prev == 0.0) {
    gl_FragColor = vec4(target, 0.0, 0.0, 1.0);
    return;
  }

  // Asymmetric, in log space, so the time constant is in stops rather than in
  // candelas. Brightening is fast; darkening takes its time, like an eye
  // walking out of a lit shop.
  float tau = target > prev ? uTau.x : uTau.y;
  float k = 1.0 - exp(-uDt / max(tau, 1e-4));
  gl_FragColor = vec4(prev + (target - prev) * k, 0.0, 0.0, 1.0);
}`,
        depthTest: false,
        depthWrite: false,
      });

      shared.uAdapted.value = adaptRT[0].texture;

      const api = {
        /** Shared uniform objects — post.js installs these into its materials. */
        uniforms: shared,
        get adaptedTexture() {
          return adaptRT[adaptIndex].texture;
        },
        /**
         * THE 1x1 ADAPTATION TARGET ITSELF. SESSION 55, item 1.
         *
         * `adaptedTexture` above is what a shader binds; this is what an
         * INSTRUMENT reads a number out of, and the two are deliberately
         * different accessors. §5.4 forbids the readback on the frame path and
         * `hud.js` obeys it in as many words -- *"it will NOT print a measured
         * EV"*. So no readback happens here either: the target is handed to
         * `tools/radianceprobe.mjs`, which is not a module, and the exposure
         * multiplier every pixel of a delivered frame was divided by becomes a
         * MEASUREMENT instead of a guess about what the meter probably read.
         *
         * The texel holds the NATURAL LOG of the adapted luminance in cd/m2 --
         * exactly what `noctisExposure()` in `post.js` fetches -- so a tool
         * reproduces `EV_used` from the same law rather than from a copy of it.
         */
        adaptedTarget() {
          return adaptRT[adaptIndex];
        },
        /** Determinism for capture, not a tuning knob. CONTRACT §5.4. */
        snap() {
          snapNext = true;
        },
        params: cfg,

        measure(renderer, sceneTexture, sceneWidth, sceneHeight, dt) {
          measureMat.uniforms.uScene.value = sceneTexture;
          measureMat.uniforms.uTexelSize.value.set(1 / sceneWidth, 1 / sceneHeight);
          measureMat.uniforms.uPrevAdapted.value = adaptRT[adaptIndex].texture;
          fs.render(renderer, measureMat, chain[0]);

          for (let i = 1; i < chain.length; i++) {
            reduceMat.uniforms.uSrc.value = chain[i - 1].texture;
            reduceMat.uniforms.uTexelSize.value.set(
              1 / chain[i - 1].width,
              1 / chain[i - 1].height
            );
            fs.render(renderer, reduceMat, chain[i]);
          }

          const prev = adaptIndex;
          const next = 1 - adaptIndex;
          adaptMat.uniforms.uMeasured.value = chain[chain.length - 1].texture;
          adaptMat.uniforms.uPrevious.value = adaptRT[prev].texture;
          adaptMat.uniforms.uDt.value = dt;
          adaptMat.uniforms.uSnap.value = snapNext ? 1 : 0;
          fs.render(renderer, adaptMat, adaptRT[next]);

          adaptIndex = next;
          snapNext = false;
          shared.uAdapted.value = adaptRT[next].texture;
        },
      };

      return api;
    },

    dispose() {
      for (const rt of chain) rt.dispose();
      chain = [];
      adaptRT.forEach((rt) => rt && rt.dispose());
      fs && fs.dispose();
      measureMat && measureMat.dispose();
      reduceMat && reduceMat.dispose();
      adaptMat && adaptMat.dispose();
    },
  };
}
