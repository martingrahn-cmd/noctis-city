/**
 * sky.js — the atmosphere, as geometry rather than as a gradient.
 *
 * Three products, one model (src/lib/atmosphere.js):
 *
 *   1. A transmittance LUT, built once. It does not depend on the sun, only on
 *      altitude and zenith angle, so rebuilding it per frame would be waste.
 *   2. An equirectangular sky LUT, rebuilt when the sun has actually moved.
 *      This feeds both the visible background and, through PMREM, every
 *      surface's ambient and specular. One source, so the sky a wall reflects
 *      is the sky you can see behind it.
 *   3. CPU-side illuminance in lux — what the sun and sky are delivering to the
 *      street right now. The lighting module turns it into light intensities;
 *      the streetlights' photocell reads it to decide whether to switch on.
 *
 * The sun disc is deliberately *not* in the sky LUT. It is drawn analytically
 * at full resolution in the background pass, because a 0.53° disc smeared into
 * a 512×256 equirect is a blob, and because the DirectionalLight already
 * accounts for its light — putting it in the IBL too would count it twice.
 */

import * as THREE from 'three';
import { createFullscreen, FULLSCREEN_VERT } from '../core/fullscreen.js';
import { HDR_CLAMP, SSR, LIGHT } from '../core/constants.js';
import { ATM, atmosphereGLSL, sunIlluminanceAtGround, skyIlluminance } from '../lib/atmosphere.js';
import { luminance, EMITTER_CHROMA } from '../lib/color.js';

const TRANSMITTANCE_W = 256;
const TRANSMITTANCE_H = 64;
const SKY_W = 512;
const SKY_H = 256;

/** Radians of sun movement that justify rebuilding the sky and its PMREM. */
const REBUILD_ELEVATION_EPS = 0.35 * (Math.PI / 180);

const SUN_SOLID_ANGLE = Math.PI * ATM.sunAngularRadius * ATM.sunAngularRadius;

const COMMON = /* glsl */ `
precision highp float;
const float PI = 3.14159265359;
const float HDR_CLAMP = ${HDR_CLAMP.toFixed(1)};
const float SSR_SKY_DEPTH = ${SSR.skyDepth.toFixed(1)};

vec2 equirectUv(vec3 dir) {
  return vec2(atan(dir.z, dir.x) * (0.5 / PI) + 0.5, asin(clamp(dir.y, -1.0, 1.0)) / PI + 0.5);
}
vec3 dirFromEquirectUv(vec2 uv) {
  float phi = (uv.x - 0.5) * 2.0 * PI;
  float theta = (uv.y - 0.5) * PI;
  float ct = cos(theta);
  return vec3(ct * cos(phi), sin(theta), ct * sin(phi));
}
`;

export function createSky(options = {}) {
  const cfg = {
    /**
     * Upward-scattered city light, in cd/m² at the horizon.
     *
     * A zenith measurement of an inner-city sky is around 0.02 cd/m², and this
     * is sixty times that on purpose. The camera is standing *inside* the
     * boundary layer, on a lit street, looking up through the air column that
     * the streetlights and shopfronts are illuminating from below. What reads
     * as "sky" from down here is mostly nearby scattered street light, not the
     * far sky — which is also why a night-city photograph almost always has a
     * sky brighter than its asphalt.
     */
    pollutionNits: 3.2,
    pollutionFalloff: 0.5,
    /**
     * The floor under the whole sky, so the zenith at midnight is dark rather
     * than exactly zero. Real airglow is around 2×10⁻⁴ cd/m²; this is the same
     * near-air scattering argument as the pollution term above, and it is what
     * keeps a night frame off the crushed-black limit without anyone reaching
     * for a lift in the grade.
     */
    airglowNits: [0.038, 0.048, 0.062],
    starBrightness: 6.0,
    ...options,
  };

  let fs = null;
  let transmittanceRT = null;
  let skyRT = null;
  let pmrem = null;
  let envRT = null;
  let skyMesh = null;

  let lutMaterial = null;
  let skyMaterial = null;

  /**
   * THE MOON REDISTRIBUTION — SESSION 56, AND IT IS LOOK.md §0's FIRST
   * LICENSED LIE, BUILT AS AN INVARIANT.
   *
   * STATE 55 §0.2 measured that 96.7% of the light on a night surface
   * arrives from an isotropic dome, so nothing has a face and the churchyard
   * has no form — and §8 item 1 named this arm: move light OUT of
   * `pollutionNits` INTO the moon at constant total lux, which costs the
   * exposure meter nothing (it is the one arm the 0.64 clawback cannot
   * touch, because the frame's total does not move) and buys the whole of
   * the direction.
   *
   * `moonShare` (k) is the fraction of the pollution dome's horizontal
   * illuminance handed to the moon. Per rebuild: the dome is drawn and
   * integrated at `pollutionNits·(1−k)` and the moon's scale gains
   * `1 + k·glowE / moonH`, so the CPU total
   * `moonH·gain + glowE·(1−k) = moonH + glowE` is an identity at every time
   * and phase WHILE THE MOON IS UP. When the moon is down the boost has
   * nowhere to land, so k is treated as 0 — the dome keeps its light and
   * the total is still exact; the step at moonset rides the same rebuild
   * cadence every other sky change does. CPU and GPU take the SAME two
   * numbers (`pollutionEff`, `moonGain`), computed once per rebuild BEFORE
   * the LUT renders, because two halves of one model that read different
   * copies is CONTRACT §9.1.
   */
  let moonShare = 0;
  let moonGain = 1;
  let pollutionEff = cfg.pollutionNits;
  function computeRedistribution(time) {
    const f = cfg.pollutionFalloff;
    const tail = f * f * (1 - Math.exp(-1 / f) * (1 + 1 / f));
    const glowE = 2 * Math.PI * cfg.pollutionNits * tail;
    const moonEl = time.moon.elevationRad;
    const up = Math.max(0, Math.sin(moonEl));
    const moonT = sunIlluminanceAtGround(moonEl);
    const ms = time.moon.illuminanceLux / 128000;
    const moonH = luminance(moonT[0] * ms, moonT[1] * ms, moonT[2] * ms) * up;
    if (!(moonShare > 0) || !(moonH > 1e-6)) {
      moonGain = 1;
      pollutionEff = cfg.pollutionNits;
      return;
    }
    moonGain = 1 + (moonShare * glowE) / moonH;
    pollutionEff = cfg.pollutionNits * (1 - moonShare);
  }
  let bgMaterial = null;

  let lastSunElevation = Number.NaN;
  let lastMoonElevation = Number.NaN;
  let pendingRebuild = true;

  const api = {
    version: 0,
    skyTexture: null,
    transmittanceTexture: null,
    envTexture: null,
    /** Direct normal solar illuminance at ground, lux, per linear-sRGB channel. */
    sunIlluminance: [0, 0, 0],
    /** Horizontal illuminance from the sky dome, lux, per channel. */
    skyIlluminance: [0, 0, 0],
    /** Direct normal lunar illuminance, lux, per channel. */
    moonIlluminance: [0, 0, 0],
    /** Total photometric illuminance on a horizontal surface. The photocell. */
    groundIlluminanceLux: 0,
    /** The part of it that comes from scattered city light rather than the sun. */
    urbanIlluminanceLux: 0,
    /** Horizontal illuminance the artificial street lighting adds, lux. */
    groundLightingLux: 0,
    rebuild: () => {},
    setGroundLighting: () => {},
  };

  function makeRT(w, h, { wrapS = THREE.ClampToEdgeWrapping } = {}) {
    const rt = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
      colorSpace: THREE.LinearSRGBColorSpace,
    });
    return rt;
  }

  function buildTransmittanceLUT(renderer) {
    fs.render(renderer, lutMaterial, transmittanceRT);
  }

  function renderSkyLUT(renderer, ctx, time) {
    const u = skyMaterial.uniforms;
    u.uSunDir.value.copy(time.sun.direction);
    u.uMoonDir.value.copy(time.moon.direction);
    // The moon is the sun, five and a half orders of magnitude down. Running the
    // same integral with a scaled source gives moonlit haze around the moon and
    // a faintly lit sky, for the cost of a second march.
    u.uMoonScale.value = (time.moon.illuminanceLux / 128000) * moonGain;
    /** The redistribution's other half — same two numbers the CPU integral reads. */
    u.uPollutionStrength.value = pollutionEff;
    fs.render(renderer, skyMaterial, skyRT);
  }

  function computeIlluminance(time) {
    const el = time.sun.elevationRad;
    const direct = sunIlluminanceAtGround(el);
    const cosZenith = Math.max(0, Math.sin(el));
    api.sunIlluminance = direct;

    const d = time.sun.direction;
    const sky = skyIlluminance(d.x, d.y, d.z);
    api.skyIlluminance = sky;

    // The moon, through the same transmittance, on the same footing.
    const moonEl = time.moon.elevationRad;
    const moonT = sunIlluminanceAtGround(moonEl);
    const moonScale = (time.moon.illuminanceLux / 128000) * moonGain;
    api.moonIlluminance = [moonT[0] * moonScale, moonT[1] * moonScale, moonT[2] * moonScale];

    const sunHorizontal = luminance(direct[0], direct[1], direct[2]) * cosZenith;
    const skyHorizontal = luminance(sky[0], sky[1], sky[2]);
    const moonHorizontal =
      luminance(api.moonIlluminance[0], api.moonIlluminance[1], api.moonIlluminance[2]) *
      Math.max(0, Math.sin(moonEl));

    // The pollution and airglow terms live in the sky shader, so the CPU side
    // has to add them here or the two halves of the model disagree about how
    // many lux are on the street — and the photocell reads the CPU side.
    //
    //   E = 2π·P·∫₀¹ u·e^(-u/f) du + π·A,  integrated over the upper hemisphere
    //   with the cosine weighting a horizontal surface sees.
    const f = cfg.pollutionFalloff;
    const tail = f * f * (1 - Math.exp(-1 / f) * (1 + 1 / f));
    /** `pollutionEff`, not `pollutionNits`: the k·glowE the dome gave up is in the moon term above. */
    const glowE = 2 * Math.PI * pollutionEff * tail;
    const airglowE = Math.PI * luminance(...cfg.airglowNits);
    api.urbanIlluminanceLux = glowE + airglowE;

    api.groundIlluminanceLux = sunHorizontal + skyHorizontal + moonHorizontal + api.urbanIlluminanceLux;
  }

  function rebuild(ctx) {
    const time = ctx.get('time');
    if (!time) return;

    /** Before the LUT: both consumers below read the same two numbers. */
    computeRedistribution(time);

    renderSkyLUT(ctx.renderer, ctx, time);

    // PMREM is the expensive half — a 256 cube plus five blurred mips. It is
    // throttled by the same movement test as the LUT, not run per frame.
    envRT = pmrem.fromEquirectangular(skyRT.texture, envRT);
    api.envTexture = envRT.texture;
    ctx.scene.environment = envRT.texture;

    computeIlluminance(time);

    lastSunElevation = time.sun.elevationRad;
    lastMoonElevation = time.moon.elevationRad;
    api.version++;
    pendingRebuild = false;
    ctx.renderer.setRenderTarget(null);
    ctx.emit('sky:rebuilt', { version: api.version });
  }

  return {
    name: 'sky',
    needs: ['time'],

    init(ctx) {
      const renderer = ctx.renderer;
      /**
       * `?moonshare=` — CONTRACT §6. `-1` defers to the shipped
       * `LIGHT.moonRedistribution`; `>= 0` pins, and 0 is the bisecting arm
       * that restores the pre-56 sky bit for bit. The sweep that chose the
       * shipped value is `tools/lookat.mjs --params=moonshare=K`.
       */
      const ms = Number(ctx.config.moonshare);
      moonShare = Number.isFinite(ms) && ms >= 0 ? Math.min(1, ms) : LIGHT.moonRedistribution;
      fs = createFullscreen();

      transmittanceRT = makeRT(TRANSMITTANCE_W, TRANSMITTANCE_H);
      skyRT = makeRT(SKY_W, SKY_H, { wrapS: THREE.RepeatWrapping });
      skyRT.texture.mapping = THREE.EquirectangularReflectionMapping;

      api.transmittanceTexture = transmittanceRT.texture;
      api.skyTexture = skyRT.texture;

      const atm = atmosphereGLSL({ viewSteps: 16, lutSteps: 40 });

      lutMaterial = new THREE.RawShaderMaterial({
        vertexShader: `precision highp float;
attribute vec3 position;
attribute vec2 uv;
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
        fragmentShader: `${COMMON}
${atm}
varying vec2 vUv;
void main() {
  // x is cos(zenith angle) remapped to [0,1]; y is altitude.
  float mu = vUv.x * 2.0 - 1.0;
  float h = vUv.y * ATM_TOP;
  gl_FragColor = vec4(atmTransmittanceIntegrate(h, mu), 1.0);
}`,
        depthTest: false,
        depthWrite: false,
      });

      skyMaterial = new THREE.RawShaderMaterial({
        uniforms: {
          uTransmittance: { value: transmittanceRT.texture },
          uSunDir: { value: new THREE.Vector3(0, 1, 0) },
          uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
          uMoonScale: { value: 0 },
          uPollutionColor: { value: new THREE.Vector3(...EMITTER_CHROMA.sodium) },
          uPollutionStrength: { value: cfg.pollutionNits },
          uPollutionFalloff: { value: cfg.pollutionFalloff },
          uAirglow: { value: new THREE.Vector3(...cfg.airglowNits) },
          uGroundLighting: { value: 0 },
        },
        vertexShader: `precision highp float;
attribute vec3 position;
attribute vec2 uv;
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
        fragmentShader: `${COMMON}
${atm}
uniform sampler2D uTransmittance;
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform float uMoonScale;
uniform vec3 uPollutionColor;
uniform float uPollutionStrength;
uniform float uPollutionFalloff;
uniform vec3 uAirglow;
uniform float uGroundLighting;
varying vec2 vUv;

void main() {
  vec3 dir = normalize(dirFromEquirectUv(vUv));

  vec3 trSun;
  vec3 L = atmSkyRadiance(uTransmittance, dir, uSunDir, trSun);

  if (uMoonScale > 0.0) {
    vec3 trMoon;
    L += atmSkyRadiance(uTransmittance, dir, uMoonDir, trMoon) * uMoonScale;
  }

  // Upward city light, scattered back down by the boundary layer. Strongest at
  // the horizon where the sight line crosses the most of it.
  float aboveHorizon = smoothstep(-0.03, 0.02, dir.y);
  float glow = exp(-max(dir.y, 0.0) / uPollutionFalloff);
  L += uPollutionColor * uPollutionStrength * glow * aboveHorizon;
  L += uAirglow * aboveHorizon;

  // The lower hemisphere is a lit surface at night, not a hole. This is the
  // street lighting bouncing off the road, and through PMREM it is the only
  // thing illuminating every downward-facing surface in the scene.
  L += ATM_GROUND_ALBEDO * (uGroundLighting * ATM_INV_PI) * (1.0 - aboveHorizon);

  gl_FragColor = vec4(min(L, vec3(HDR_CLAMP)), 1.0);
}`,
        depthTest: false,
        depthWrite: false,
      });

      // ---- background ------------------------------------------------------

      bgMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uSky: { value: skyRT.texture },
          uTransmittance: { value: transmittanceRT.texture },
          uSunDir: { value: new THREE.Vector3(0, 1, 0) },
          uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
          uProjInv: { value: new THREE.Matrix4() },
          uCamRot: { value: new THREE.Matrix3() },
          uStarRot: { value: 0 },
          uStarBrightness: { value: cfg.starBrightness },
          uLatitude: { value: 0 },
        },
        vertexShader: /* glsl */ `
uniform mat4 uProjInv;
uniform mat3 uCamRot;
varying vec3 vRay;
void main() {
  vec4 p = uProjInv * vec4(position.xy, 1.0, 1.0);
  vRay = uCamRot * (p.xyz / p.w);
  gl_Position = vec4(position.xy, 1.0, 1.0);
}`,
        fragmentShader: `${COMMON}
${atm}
// The HDR target's second attachment, §5.11. Global scope, beside three's own
// layout(location = 0) out vec4 pc_fragColor — see the note at the write.
layout(location = 1) out highp vec2 gNoctisSkyMotion;
uniform sampler2D uSky;
uniform sampler2D uTransmittance;
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform float uStarRot;
uniform float uStarBrightness;
uniform float uLatitude;
varying vec3 vRay;

float hash31(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

/** Rotate a direction about the celestial pole, so the sky turns as it should. */
vec3 rotatePolar(vec3 d, float ang, float lat) {
  // Pole is at elevation = latitude, due north (-Z).
  vec3 axis = normalize(vec3(0.0, sin(lat), -cos(lat)));
  float c = cos(ang), s = sin(ang);
  return d * c + cross(axis, d) * s + axis * dot(axis, d) * (1.0 - c);
}

vec3 starField(vec3 dir) {
  vec3 d = rotatePolar(dir, uStarRot, uLatitude);
  vec3 p = d * 110.0;
  vec3 cell = floor(p);
  vec3 f = fract(p);
  float h = hash31(cell);
  if (h < 0.975) return vec3(0.0);
  vec3 sp = vec3(hash31(cell + 11.3), hash31(cell + 27.7), hash31(cell + 41.1));
  float dist = length(f - sp);
  float mag = hash31(cell + 63.9);
  // A steep magnitude distribution: a handful of bright stars, many faint ones.
  float bright = pow(mag, 5.0);
  float disc = smoothstep(0.11, 0.0, dist);
  // B-V colour index, crudely: bright stars run blue-white, faint ones amber.
  vec3 tint = mix(vec3(1.0, 0.82, 0.62), vec3(0.78, 0.86, 1.0), hash31(cell + 7.7));
  return tint * disc * bright;
}

void main() {
  vec3 dir = normalize(vRay);
  vec3 L = texture2D(uSky, equirectUv(dir)).rgb;

  // Transmittance from the ground along this ray. Zero below the horizon, which
  // is what hides the sun, the moon and the stars when they have set.
  vec3 tr = atmTransmittanceLUT(uTransmittance, 0.0, dir.y);

  // --- sun disc, analytic and full resolution ---
  float sunAng = acos(clamp(dot(dir, uSunDir), -1.0, 1.0));
  float sunMask = 1.0 - smoothstep(ATM_SUN_ANGULAR_RADIUS * 0.9, ATM_SUN_ANGULAR_RADIUS * 1.1, sunAng);
  if (sunMask > 0.0) {
    float x = clamp(sunAng / ATM_SUN_ANGULAR_RADIUS, 0.0, 1.0);
    float mu = sqrt(max(0.0, 1.0 - x * x));
    float limb = 1.0 - 0.6 * (1.0 - pow(mu, 0.55));
    L += (ATM_SUN_IRRADIANCE / ${SUN_SOLID_ANGLE.toPrecision(8)}) * tr * limb * sunMask;
  }

  // --- moon disc, lit by the actual sun direction so the phase is geometry ---
  vec3 mz = uMoonDir;
  vec3 mx = normalize(cross(vec3(0.0, 1.0, 0.0), mz) + vec3(1e-6, 0.0, 0.0));
  vec3 my = cross(mz, mx);
  vec2 mo = vec2(dot(dir, mx), dot(dir, my)) / ATM_MOON_ANGULAR_RADIUS;
  float rr = dot(mo, mo);
  if (rr < 1.2 && dot(dir, mz) > 0.0) {
    float edge = 1.0 - smoothstep(0.9, 1.05, sqrt(rr));
    vec3 n = normalize(mx * mo.x + my * mo.y + mz * sqrt(max(0.0, 1.0 - min(rr, 1.0))));
    float ndl = max(0.0, dot(n, uSunDir));
    // Flat, not Lambertian — the moon's regolith backscatters.
    L += vec3(4200.0) * pow(ndl, 0.35) * edge * tr;
  }

  L += starField(dir) * uStarBrightness * tr;

  // Alpha is linear view depth, not opacity: the HDR target's alpha channel is
  // the depth buffer session 3's screen-space reflection marches against (see
  // the note in lights.js). The sky is at SSR.skyDepth so that a reflected ray
  // leaving the geometry can never report a hit on it — the alternative is a
  // wet road that mirrors the sky it is standing under, which is the one thing
  // the whole pass exists to stop doing.
  gl_FragColor = vec4(min(L, vec3(HDR_CLAMP)), SSR_SKY_DEPTH);

  /**
   * The motion attachment. CONTRACT §5.11.
   *
   * THE SKY IS THE ONE THING IN THE SCENE THAT lights.patch() DOES NOT TOUCH,
   * and since the HDR target grew a second attachment that is no longer a
   * private arrangement between this module and its own colours. A fragment
   * shader that writes location 0 and not location 1 leaves location 1
   * UNDEFINED — not cleared, not preserved, undefined — so the resolve would
   * reproject the sky by whatever the driver happened to leave there. Zero is
   * both correct and the answer that needs no argument: the sky is at
   * SSR.skyDepth, it does not move, and the camera's own contribution is
   * already carried by the resolve's depth reprojection.
   *
   * This is the same class of statement CONTRACT §5.6 makes about unpatched
   * materials and clustered light — an unpatched material is outside the model
   * deliberately and visibly. The difference is that "outside the motion field"
   * is not visible; it is undefined memory. So this is written out by hand
   * rather than left to the rule.
   */
  gNoctisSkyMotion = vec2(0.0);
}`,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      });

      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3)
      );
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
      skyMesh = new THREE.Mesh(geo, bgMaterial);
      skyMesh.frustumCulled = false;
      skyMesh.renderOrder = -1000;
      skyMesh.name = 'sky:background';
      skyMesh.onBeforeRender = (renderer, scene, camera) => {
        const u = bgMaterial.uniforms;
        u.uProjInv.value.copy(camera.projectionMatrixInverse);
        u.uCamRot.value.setFromMatrix4(camera.matrixWorld);
      };
      ctx.scene.add(skyMesh);

      pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();

      buildTransmittanceLUT(renderer);

      api.rebuild = () => rebuild(ctx);
      api.setGroundLighting = (lux) => {
        if (Math.abs(lux - api.groundLightingLux) < 0.5) return;
        api.groundLightingLux = lux;
        skyMaterial.uniforms.uGroundLighting.value = lux;
        pendingRebuild = true;
      };

      ctx.on('timeOfDay', ({ discontinuous }) => {
        if (discontinuous) pendingRebuild = true;
      });

      const time = ctx.get('time');
      bgMaterial.uniforms.uLatitude.value = time.latitudeDeg * (Math.PI / 180);
      rebuild(ctx);

      return api;
    },

    update(ctx) {
      const time = ctx.get('time');
      if (!time) return;

      const u = bgMaterial.uniforms;
      u.uSunDir.value.copy(time.sun.direction);
      u.uMoonDir.value.copy(time.moon.direction);
      u.uStarRot.value = time.starRotationRad;

      const moved =
        Math.abs(time.sun.elevationRad - lastSunElevation) > REBUILD_ELEVATION_EPS ||
        Math.abs(time.moon.elevationRad - lastMoonElevation) > REBUILD_ELEVATION_EPS * 3;

      if (pendingRebuild || moved) rebuild(ctx);
    },

    dispose(ctx) {
      if (skyMesh) {
        ctx.scene.remove(skyMesh);
        skyMesh.geometry.dispose();
      }
      if (ctx.scene.environment === api.envTexture) ctx.scene.environment = null;
      transmittanceRT && transmittanceRT.dispose();
      skyRT && skyRT.dispose();
      envRT && envRT.dispose();
      pmrem && pmrem.dispose();
      fs && fs.dispose();
      lutMaterial && lutMaterial.dispose();
      skyMaterial && skyMaterial.dispose();
      bgMaterial && bgMaterial.dispose();
    },
  };
}
