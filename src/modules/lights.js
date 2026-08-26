/**
 * lights.js — clustered forward+ local lighting.
 *
 * CONTRACT §5.6. This is the architectural decision the brief says to make in
 * session 1 and not to revisit: local lights do not live in a uniform array
 * evaluated by every fragment of every material. They live in a data texture,
 * the frustum is diced into froxels, and a fragment loops over the handful of
 * lights that actually reach its froxel.
 *
 * On ten buildings this is unnecessary. That is the point — retrofitting it in
 * session 3 means rewriting every material, and a session-3 rewrite of every
 * material is how a project's look gets frozen at whatever it was in session 2.
 *
 * Three textures, rebuilt per frame:
 *   lightData     5 texels per light: position(view), radius, colour×intensity,
 *                 type, cone axis, cone cosines, source radius, the two
 *                 transverse scales of the luminaire distribution, and the
 *                 along-road axis it measures them against
 *   clusterGrid   (offset, count) per froxel, laid out tilesX·tilesY × slicesZ
 *   indices       flat list of light indices that the offsets point into
 *
 * Assignment runs on the CPU. WebGL2 has no compute shaders, and for the light
 * counts a city block reaches, a conservative screen-AABB test in JS costs less
 * than the readback a GPU implementation would need.
 *
 * Not here, deliberately: shadows from local lights. A streetlight can spill
 * through a wall. Session 3 owns that, when there are walls worth occluding.
 */

import * as THREE from 'three';
import { CLUSTER, HDR_CLAMP, SURFACE, SSR, WATER, waterWaves } from '../core/constants.js';
import { ATM } from '../lib/atmosphere.js';
import { GAIT_GLSL } from '../lib/gait.js';
import { ZONE_UNPACK_GLSL } from '../lib/color.js';

/**
 * Five, not four, since session 3. Texel 4 carries the luminaire's along-road
 * axis in view space and leaves one float free, which is where session 3's
 * shadow-atlas index goes when local lights get shadows. 384 lights × 5 texels
 * × RGBA float32 is 30.7 kB — the texture was never the cost here, and the cap
 * that is (`CLUSTER.maxPerCluster`) is in `core/constants.js` beside it.
 */
const TEXELS_PER_LIGHT = 5;
/** Centres of the five texels along a row of width TEXELS_PER_LIGHT. */
const TEXEL_U = Array.from({ length: TEXELS_PER_LIGHT }, (_, i) =>
  ((i + 0.5) / TEXELS_PER_LIGHT).toFixed(4)
);

/**
 * Order of the canyon field's face buckets. Must match lib/canyon.js —
 * FACE_AXES there, NOCTIS_FACE_AXIS in the shader below, and this array are the
 * same four directions written down three times, which is two more than is
 * safe. They are adjacent so a change to one is a change nobody can miss.
 */
const FACE_AXIS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
];

export function createLights(options = {}) {
  const cfg = { ...CLUSTER, ...options };

  const numTiles = cfg.tilesX * cfg.tilesY;
  const numClusters = numTiles * cfg.slicesZ;

  /** @type {Array<object>} */
  const lights = [];
  const patched = new Set();

  let lightTex = null;
  let gridTex = null;
  let indexTex = null;
  let lightArr = null;
  let gridArr = null;
  let indexArr = null;

  let indexTexW = 0;
  let indexTexH = 0;

  let canyonA = null;
  let canyonB = null;
  let defaultA = null;
  let defaultB = null;
  let defaultSSR = null;
  /** 0 disables the screen-space pass entirely. `?ssr=0` is the bisecting switch. */
  let ssrStrength = 1;
  /**
   * Cone bounding for narrow spot lights. On.
   *
   * Off is not a shipping mode and there is no URL parameter for it: it is the
   * A side of an A/B, so that the froxel saving can be MEASURED rather than
   * only derived. The derivation says 1/(8·cos³θ) — 4.40× at θ = 35° — and a
   * derivation nobody checked against a measurement is a claim (CONTRACT §9
   * rule 2). `tools/clustercheck.mjs` drives this and prints both numbers.
   */
  let coneBound = true;

  /** Reused per frame; allocating 3456 arrays every frame is its own budget. */
  const buckets = new Array(numClusters);
  for (let i = 0; i < numClusters; i++) buckets[i] = [];

  const shared = {
    uNoctisLightData: { value: null },
    uNoctisClusterGrid: { value: null },
    uNoctisClusterIndices: { value: null },
    uNoctisClusterParams: { value: new THREE.Vector4(cfg.tilesX, cfg.tilesY, cfg.slicesZ, cfg.maxLights) },
    uNoctisClusterDepth: { value: new THREE.Vector4(cfg.near, cfg.far, 1 / Math.log(cfg.far / cfg.near), 0) },
    uNoctisScreen: { value: new THREE.Vector2(1, 1) },
    uNoctisIndexSize: { value: new THREE.Vector2(1, 1) },
    // Haze — see the fragment injection below.
    uNoctisSky: { value: null },
    // Straight from the atmosphere model. A second copy of this number living
    // in whoever calls setHaze() is a second number, and it will drift.
    uNoctisHaze: { value: new THREE.Vector2(ATM.hazeDensity, ATM.hazeScaleHeight) },
    /** Fraction of the sky the haze in a street canyon is lit by. See HAZE_FRAGMENT. */
    uNoctisHazeOpen: { value: 1 },
    uNoctisViewRotInv: { value: new THREE.Matrix3() },
    uNoctisCamHeight: { value: 1.7 },
    /**
     * The previous frame's un-jittered view-projection. §5.11.
     *
     * Shared, because it is a property of the camera and every object is seen
     * by the same one. `uNoctisPrevDelta` — the object's OWN previous transform
     * — is emphatically not shared, and is created per material in
     * onBeforeCompile for that reason.
     */
    uNoctisPrevViewProj: { value: new THREE.Matrix4() },

    // --- the canyon field (CONTRACT §5.7, src/lib/canyon.js) ---
    // Two 3D textures of pure geometry, and four radiances the CPU recomputes
    // whenever the sky is rebuilt. Nothing baked into the textures knows where
    // the sun is, which is what lets them be baked once and streamed later.
    uNoctisCanyonA: { value: null }, // rgb bent normal, a sky visibility
    uNoctisCanyonB: { value: null }, // +X, −X, +Z, −Z facade fractions
    uNoctisCanyonMin: { value: new THREE.Vector3() },
    uNoctisCanyonInvSpan: { value: new THREE.Vector3(1, 1, 1) },
    uNoctisCanyonYMax: { value: 1 },
    uNoctisCanyonVoxel: { value: 1.5 },
    // --- the streamed chunk field, §11 ---
    uNoctisChunkA: { value: null },
    uNoctisChunkB: { value: null },
    uNoctisChunkSlots: { value: null },
    /** chunkSize, fieldMargin, fieldSlices, fieldHeight */
    uNoctisChunkParams: { value: new THREE.Vector4(128, 14, 28, 96) },
    /** slotGrid, 1/slotGrid, slotCount, enabled */
    uNoctisChunkGrid: { value: new THREE.Vector4(16, 1 / 16, 30, 0) },
    /** canyon half-width, mean facade height — the analytic default, §11 */
    uNoctisFieldDefault: { value: new THREE.Vector3(11.7, 26, 0.25) },
    uNoctisFaceL: { value: FACE_AXIS.map(() => new THREE.Vector3()) },
    uNoctisGroundL: { value: new THREE.Vector3() },
    /** 0 disables every indirect term, for bisecting. ?indirect=0. */
    uNoctisIndirect: { value: 1 },
    /** 0 dry, 1 fully wet. Session 4's weather drives this; the gate captures both. */
    uNoctisWet: { value: 0 },
    /**
     * Seconds, from `ctx.get('time').now` and from nowhere else. CONTRACT §3.
     *
     * The only animated surface in the project reads this. It is the SAME
     * number the sun is derived from — `time.update` accumulates `dt·timeScale`
     * into `now` and hands the same `scaled` to `advance()` — so a paused clock
     * stops the water and the sun together, which is what makes
     * `filmshot --static`'s negative control (jitter off, clock paused, camera
     * locked ⇒ every input to every frame identical) still true with water in
     * the frame. A module-local accumulator would have broken that instrument
     * silently and it would have read as a TAA regression.
     */
    uNoctisTime: { value: 0 },
    uNoctisSurface: {
      value: new THREE.Vector4(
        SURFACE.wetFilmRoughness,
        SURFACE.puddleRoughness,
        SURFACE.wetDarkening,
        SURFACE.grainStrength
      ),
    },

    // --- screen-space reflection (CONTRACT §5.8, constants.SSR) ---
    // The previous frame, at half resolution: rgb is exposed-nothing, raw HDR
    // radiance, and a is linear view depth in metres. One texture rather than a
    // colour target plus a depth target, because the march reads both at every
    // step and two fetches per step is twice the bandwidth for the same answer.
    uNoctisSSRSource: { value: null },
    uNoctisSSRPrevViewProj: { value: new THREE.Matrix4() },
    uNoctisSSRPrevView: { value: new THREE.Matrix4() },
    /** x strength (0 disables), y maxDistance, z startOffset, w maxRoughness */
    uNoctisSSR: { value: new THREE.Vector4(0, SSR.maxDistance, SSR.startOffset, SSR.maxRoughness) },
    /** x stepGrowth, y thicknessScale, z minThickness, w blurPerRoughness */
    uNoctisSSR2: {
      value: new THREE.Vector4(SSR.stepGrowth, SSR.thicknessScale, SSR.minThickness, SSR.blurPerRoughness),
    },
    /** x maxMipLevel, y edgeFade, z maxThickness */
    uNoctisSSR3: { value: new THREE.Vector3(0, SSR.edgeFade, SSR.maxThickness) },
  };

  const api = {
    add: () => null,
    remove: () => {},
    patch: (m) => m,
    lightCount: 0,
    assignedIndices: 0,
    overflow: false,
    /** Fullest froxel this frame, and how many froxels are at the cap. */
    peakOccupancy: 0,
    clustersAtCap: 0,
    /**
     * The same three, high-watermarked since the last `resetClusterPeaks()`.
     *
     * A route is 1800 frames and a gate reads one of them. The frame the gate
     * happens to read is not the frame the grid was fullest in, and the cap is
     * a claim about every frame — so the number that has to clear it is the
     * maximum over the run, collected in the only place that sees every frame.
     */
    peakOccupancyEver: 0,
    lightCountEver: 0,
    assignedIndicesEver: 0,
    overflowEver: false,
    setHaze: () => {},
    setHazeOpenness: () => {},
  };

  // -------------------------------------------------------------------------
  // shader injection

  const CLUSTER_FRAGMENT = /* glsl */ `
{
  // Froxel lookup. Depth is sliced exponentially: linear slices waste almost
  // all of them on the far half of the frustum, where lights are smallest.
  float viewDepth = vViewPosition.z;
  float zNear = uNoctisClusterDepth.x;
  float zFar  = uNoctisClusterDepth.y;
  float invLogRatio = uNoctisClusterDepth.z;
  float slices = uNoctisClusterParams.z;

  float d = clamp(viewDepth, zNear, zFar);
  float slice = clamp(floor(log(d / zNear) * invLogRatio * slices), 0.0, slices - 1.0);

  vec2 tiles = uNoctisClusterParams.xy;
  vec2 tile = clamp(floor(gl_FragCoord.xy / (uNoctisScreen / tiles)), vec2(0.0), tiles - 1.0);

  float cellIndex = tile.y * tiles.x + tile.x;
  vec2 gridUv = vec2((cellIndex + 0.5) / (tiles.x * tiles.y), (slice + 0.5) / slices);
  vec2 oc = texture2D(uNoctisClusterGrid, gridUv).rg;

  float offset = oc.r;
  int count = int(oc.g + 0.5);

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * THE VIEW RAY, FOR THE HAZE-AROUND-LIGHT INTEGRAL BELOW. LOOK.md §3.
   * ═══════════════════════════════════════════════════════════════════════
   *
   * The camera is the origin in view space, so the segment the air occupies is
   * simply 0 → geometryPosition and its length is the distance to the surface
   * this fragment is. Hoisted out of the loop because it is a property of the
   * fragment and not of any light.
   *
   * noctisHazeWy is the ray's WORLD vertical component, which is the only
   * part of the world direction the integral needs: the aerosol density has an
   * exponential height profile and the scattering that matters happens near the
   * light, so the density is evaluated at the height of the ray's closest
   * approach rather than at the camera's. At street level the two agree to
   * under a per cent over a whole block (H = 550 m); from 950 m up they do not,
   * and it is the lower one that is right.
   */
  float noctisHazeD = length(geometryPosition);
  vec3 noctisHazeV = geometryPosition / max(noctisHazeD, 1e-4);
  float noctisHazeWy = (uNoctisViewRotInv * noctisHazeV).y;
  gNoctisLightHaze = vec3(0.0);

  for (int ci = 0; ci < NOCTIS_MAX_CLUSTER_LIGHTS; ci++) {
    if (ci >= count) break;

    float ip = offset + float(ci);
    vec2 iuv = (vec2(mod(ip, uNoctisIndexSize.x), floor(ip / uNoctisIndexSize.x)) + 0.5) / uNoctisIndexSize;
    float li = texture2D(uNoctisClusterIndices, iuv).r;

    float lv = (li + 0.5) / uNoctisClusterParams.w;
    vec4 d0 = texture2D(uNoctisLightData, vec2(${TEXEL_U[0]}, lv));
    vec4 d1 = texture2D(uNoctisLightData, vec2(${TEXEL_U[1]}, lv));
    vec4 d2 = texture2D(uNoctisLightData, vec2(${TEXEL_U[2]}, lv));
    vec4 d3 = texture2D(uNoctisLightData, vec2(${TEXEL_U[3]}, lv));
    vec4 d4 = texture2D(uNoctisLightData, vec2(${TEXEL_U[4]}, lv));

    /**
     * ═════════════════════════════════════════════════════════════════════
     * HAZE AROUND LIGHT — THIS LIGHT'S SHARE OF THE AIR BETWEEN THE EYE AND
     * THIS SURFACE. LOOK.md §3, session 43.
     * ═════════════════════════════════════════════════════════════════════
     *
     * IT IS ATMOSPHERE AND NOT BLOOM, and the distinction is structural rather
     * than a matter of degree. Bloom is a screen-space convolution of whatever
     * is bright — session 27 measured the frame at 61% camera glow and cut it,
     * and nothing here puts that back. This is the SAME single-scattering
     * integral the block below already runs against the sky, evaluated against
     * the lights instead: it has a source position, a candela figure, a
     * physical extinction coefficient and a path length, and it falls off with
     * distance from the source because the source's own irradiance does.
     *
     * THE INTEGRAL, EXACTLY AND NOT NUMERICALLY. Along the ray x(t) = t·v with
     * the camera at t = 0 and the surface at t = d, a source at L contributes
     *
     *     L_in = ρ_s · p · I · ∫ dt / |x(t) − L|²
     *          = ρ_s · p · I · (1/h)·[atan((t₁ − t₀)/h) − atan((t₀₀ − t₀)/h)]
     *
     * with t₀ = L·v the source's projection onto the ray, h = |L − t₀·v| its
     * perpendicular distance from it, and [t₀₀, t₁] the part of the segment
     * that is inside the light's own declared radius — see the bound below. ρ_s is 1/m, I is candela, the integral is
     * 1/m and p is 1/sr, so the product is cd/m² — the units the rest of this
     * shader is in. Two atans and a divide, no march, no step count to budget.
     *
     * WHERE THE HALO COMES FROM, because this is the part that reads: it is the
     * 1/h. A ray that passes close to a lamp integrates a large 1/r² over its
     * whole length and one that passes wide does not, so the glow is tight
     * around the source and falls off with the angle you look away from it.
     * That is a geometric fact about the air, and it is why no separate falloff
     * is authored anywhere here.
     *
     * ISOTROPIC PHASE, 1/4π, AND IT IS A CONSISTENCY ARGUMENT AND NOT A
     * SIMPLIFICATION. The sky in-scatter forty lines below mixes the sky's
     * radiance in with no phase function at all, i.e. isotropically. Two halves
     * of one haze with two phase functions would be two atmospheres, and the
     * closed form above is exact only for a phase that does not vary along the
     * path. A Mie lobe would sharpen the halo the 1/h already produces; it
     * would not produce it.
     *
     * THE CONE IS EVALUATED AT THE CLOSEST POINT, and without it a street
     * lantern would glow as a sphere — air above a downlight that the lantern
     * cannot reach. At the closest approach the direction to the source is
     * perpendicular to the ray, which for a horizontal ray under a downlight is
     * straight up the beam axis (full attenuation, correctly) and for a ray
     * passing above the lantern is straight down it (zero, correctly). The
     * batwing is applied there too: min(1, (peakCos/cosγ)³) is a REDUCTION
     * toward nadir, and dropping it would put the glow directly under every
     * lantern up to (1/peakCos)³ too bright.
     *
     * WHAT IT DOES NOT DO, said rather than discovered later:
     *
     *   - NO OCCLUSION. A lamp behind a wall still lights the air in front of
     *     it. This is the same simplification §5.6 records for the direct term
     *     ("a streetlight can spill through a wall") and it is bounded here by
     *     the froxel: a light has to reach this fragment's own froxel to be in
     *     the list at all.
     *   - ONLY THE FROXEL'S LIGHTS, not every light along the ray. A light near
     *     the camera is not in a distant surface's froxel and contributes
     *     nothing to it. That is a limit and it is also the reason this cannot
     *     become a global lift: each pixel is lit by the air near ITS OWN
     *     depth, which is exactly the term LOOK.md §3 asks for and not a veil
     *     over the frame.
     *   - NOTHING FOR AN EMISSIVE SURFACE. The 692 signs and the windows are
     *     emissive materials with no photometry attached — they are not in this
     *     list, they have no candela, and a number cannot be integrated that
     *     nobody wrote down. The air glows around the 192 lanterns, the 96
     *     headlamps, the stall lamps and the block's shopfronts, and not around
     *     a sign. That is a finding about the light list, not a choice.
     *
     * IT IS COMPUTED BEFORE THE RANGE REJECT ON PURPOSE. d0.w is the falloff
     * radius of the light ON A SURFACE; the air between here and there is lit
     * whether or not this particular surface is inside it.
     */
    {
      float hzT0 = dot(d0.xyz, noctisHazeV);
      float hzH = sqrt(max(dot(d0.xyz, d0.xyz) - hzT0 * hzT0, 0.0));
      // Clamped to the source's own size: inside a sphere of radius R the
      // irradiance stops growing. ATM.hazeMinSourceRadiusM is a divide-by-zero
      // guard under every declared radius in the project — see its derivation.
      hzH = max(hzH, max(d3.y, ${ATM.hazeMinSourceRadiusM.toFixed(2)}));
      /**
       * BOUNDED BY THE LIGHT'S OWN DECLARED REACH, so the air this light lights
       * is the air the SURFACES it lights are in. The direct term twenty lines
       * below windows at d0.w and stops; an in-scatter that integrated 1/r² to
       * the horizon would be the same light with two different ranges, which is
       * CONTRACT §9's shape with a falloff radius. The ray is inside the sphere
       * for (t − t₀)² ≤ R² − h², so the exact integral is taken between those
       * two roots clipped to the segment, and it is exact rather than windowed:
       * three's quartic taper has no closed form here, and a hard bound
       * over-counts only the last few metres, where the taper is near zero.
       */
      float hzM2 = d0.w * d0.w - hzH * hzH;
      float hzLine = 0.0;
      if (hzM2 > 0.0) {
        float hzM = sqrt(hzM2);
        float hzLo = max(0.0, hzT0 - hzM);
        float hzHi = min(noctisHazeD, hzT0 + hzM);
        if (hzHi > hzLo) {
          hzLine = (atan((hzHi - hzT0) / hzH) - atan((hzLo - hzT0) / hzH)) / hzH;
        }
      }
      float hzShape = 1.0;
      if (d1.w > 0.5) {
        vec3 hzToLight = normalize(d0.xyz - noctisHazeV * hzT0);
        float hzCos = dot(hzToLight, d2.xyz);
        hzShape = getSpotAttenuation(d2.w, d3.x, hzCos);
        if (d4.w > 0.0) hzShape *= min(1.0, pow(d4.w / max(hzCos, 1e-3), 3.0));
      }
      if (hzShape > 0.0 && hzLine > 0.0) {
        // The aerosol density where the scattering actually happens.
        float hzY = max(uNoctisCamHeight + noctisHazeWy * hzT0, 0.0);
        float hzRho = uNoctisHaze.x * exp(-hzY / uNoctisHaze.y);
        // 1/4π = 0.07957747, the isotropic phase, named rather than folded in.
        gNoctisLightHaze += d1.rgb * (hzRho * hzShape * hzLine * 0.07957747);
      }
    }

    vec3 lVector = d0.xyz - geometryPosition;
    float lDist = length(lVector);
    if (lDist > d0.w) continue;

    directLight.direction = lVector / max(lDist, 1e-4);

    // Same inverse-square windowing three uses for its own punctual lights, so
    // a clustered light and a stock light of equal candela are equal.
    float atten = getDistanceAttenuation(lDist, d0.w, 2.0);

    if (d1.w > 0.5) {
      /**
       * The luminaire's angular distribution.
       *
       * A street lantern is not a circular cone (see LUMINAIRE in constants).
       * The direction from fragment to light is split into the beam axis and
       * the two transverse axes — along the carriageway and across it — the
       * transverse parts are scaled, and the result goes into the same cone
       * attenuation as before. Scaling *down* along the road widens the
       * effective beam there; scaling *up* across it narrows the beam there.
       *
       * At scale (1, 1) this is algebraically the identity, so a light that
       * declares no along-road axis behaves exactly as a circular spot. That
       * is deliberate: the shop and sign lights are points and must not pick
       * up a street lantern's optic by accident.
       */
      vec3 axis = d2.xyz;
      float cosAngle = dot(directLight.direction, axis);
      vec3 along = d4.xyz;
      if (dot(along, along) > 0.5) {
        // The along-road axis was orthogonalised against the beam axis on the
        // CPU, once per light per frame, so this is a genuine orthonormal frame
        // with no degenerate case to fall into. Session 2 lost a day to a
        // published branchless basis relabelled between axis conventions; a
        // basis built from two vectors already known to be perpendicular has no
        // convention left to get wrong.
        vec3 perp = directLight.direction - axis * cosAngle;
        vec3 across = cross(axis, along);
        vec3 shaped = axis * cosAngle
          + along * (dot(perp, along) * d3.z)
          + across * (dot(perp, across) * d3.w);
        cosAngle = dot(normalize(shaped), axis);
      }
      atten *= getSpotAttenuation(d2.w, d3.x, cosAngle);

      /**
       * The batwing core: intensity rising as 1/cos³ from nadir up to the
       * optic's peak angle, flat from there to the cutoff.
       *
       * Illuminance on a flat road is I(γ)·cos³γ/h², so this is the profile
       * that puts *equal* light on every point of the carriageway out to the
       * peak angle. It is what makes the difference between lighting a road
       * and lighting the pavement under the pole. d4.w is cos(peak angle);
       * zero means the light has no optic and its maximum is on its axis,
       * which is every shopfront and sign in the block.
       */
      if (d4.w > 0.0) {
        atten *= min(1.0, pow(d4.w / max(cosAngle, 1e-3), 3.0));
      }
    }

    if (atten <= 0.0) continue;

    directLight.color = d1.rgb * atten;
    directLight.visible = true;

    /**
     * Sphere lights, by widening the specular lobe to the light's angular size.
     *
     * A punctual light has no angular size, so on a near-mirror its highlight
     * is a delta function: at roughness 0.045 the reflection of a streetlamp in
     * wet asphalt lands inside one pixel and effectively disappears. That is
     * not a wet road, it is a dry road with the diffuse turned down, and it is
     * exactly what the first wet midnight frame showed — the specular spread
     * went *down* when the road got wet.
     *
     * A lamp bowl is 0.42 m across and hangs 8 m up, so it subtends about 3°.
     * Karis's approximation (Real Shading in Unreal Engine 4): alpha' = alpha +
     * radius / (2·distance), in GGX alpha rather than perceptual roughness.
     * The highlight then has the angular size of the actual source, which on a
     * grazing wet surface is the long vertical smear a night street is full of.
     *
     * The representative-point half of that method is deliberately left out:
     * it moves the light direction, which in three's structure would move the
     * diffuse too, and for sources this small the gain is not worth the error.
     */
    float noctisSrcR = d3.y;
    float noctisSavedRough = material.roughness;
    if (noctisSrcR > 0.0) {
      float a = material.roughness * material.roughness;
      material.roughness = sqrt(clamp(a + noctisSrcR / (2.0 * max(lDist, 0.05)), 0.0, 1.0));
    }

    RE_Direct(directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);

    material.roughness = noctisSavedRough;
  }
}
`;

  const HAZE_FRAGMENT = /* glsl */ `
{
  // Aerosol haze with an exponential height profile, integrated analytically
  // along the view ray. In-scattered colour is the sky in that direction, so
  // the haze down the street at dusk is orange and the haze behind you is blue.
  // A single fog colour cannot do that, and the difference is most of what
  // reads as distance.
  vec3 vp = -vViewPosition;
  float dist = length(vp);
  vec3 wdir = uNoctisViewRotInv * (vp / max(dist, 1e-4));

  float H = uNoctisHaze.y;
  float rho0 = uNoctisHaze.x;
  float h0 = uNoctisCamHeight;
  float h1 = h0 + wdir.y * dist;
  float dh = h1 - h0;

  float tau;
  if (abs(dh) < 1e-3) {
    tau = rho0 * exp(-max(h0, 0.0) / H) * dist;
  } else {
    tau = rho0 * H * (dist / dh) * (exp(-max(h0, 0.0) / H) - exp(-max(h1, 0.0) / H));
  }

  float f = clamp(1.0 - exp(-max(tau, 0.0)), 0.0, 1.0);

  /**
   * THE MEDIUM IS LIT BY WHAT IT CAN SEE, AND IN A STREET THAT IS NOT THE SKY.
   *
   * WHY THIS WAS NOT FOUND BY LOOKING AT THE MIX FRACTION. At 300 m a
   * near-horizontal ray has tau = 0.132 and f = 0.124, and 12 percent of
   * anything sounds like nothing. But f is a fraction of the *radiance being
   * mixed in*, and at noon that radiance was the unoccluded horizon sky at
   * roughly 12 000 cd/m2 while a shaded brick facade is 0.164 / pi x 25 000 =
   * 1 300. Nine to one. So
   *
   *     L = 0.876 x 1300 + 0.124 x 12000 = 1139 + 1488
   *
   * and the haze is 57 percent of the delivered radiance — it more than doubles
   * the wall and it arrives neutral-blue. A 12 percent mix, 57 percent of the
   * light. That is CONTRACT section 9 exactly: a fraction applied to one
   * quantity and reasoned about as though it applied to another. The Koschmieder
   * visual range that follows from this density, 8.7 km, is the same mistake one
   * level up: it is the range at which a black target loses contrast against the
   * HORIZON SKY, and it says nothing about a dark facade seen against a dark
   * street.
   *
   * The physical error is the source function. In-scatter is the medium's own
   * radiance, which is the ambient it can see times its scattering albedo — and
   * a parcel of air 300 m down a canyon between 30 and 70 m buildings sees the
   * strip of sky those buildings leave it, not the whole dome, and is in their
   * shadow for most of the path. uNoctisHazeOpen is the roadway openness the
   * canyon bake already measures (canyon.js, roadSkyVis) — the same number,
   * not a second one authored to match.
   *
   * Ramped off with elevation, because a ray that climbs out of the canyon
   * really does see the open sky: at 11 degrees above horizontal a 300 m ray has
   * risen 60 m, which is above every parapet in the block.
   */
  float openness = mix(uNoctisHazeOpen, 1.0, clamp(wdir.y * 5.0, 0.0, 1.0));
  vec3 inscatter = texture2D(uNoctisSky, equirectUv(wdir)).rgb * openness;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, inscatter, f);

  /**
   * AND THE OTHER HALF OF THE SAME MEDIUM — the air lit by the city's own
   * lamps rather than by the sky. LOOK.md §3, session 43. The cluster block
   * above accumulated it in cd/m²; see the derivation there.
   *
   * ADDED, WHERE THE SKY TERM IS MIXED, and the two are not the same operation
   * for a reason. mix() is what conserves energy over a path that ENDS at the
   * sky: the fraction f of the surface's radiance that the medium has
   * absorbed is the fraction the sky replaces. The lamps add radiance into a
   * path that already exists; they do not stand behind it. The lamp term's own
   * extinction over the remaining path is second order — τ is 0.132 at 300 m by
   * this block's own arithmetic — and is not applied.
   *
   * AT NOON AND DAWN THIS IS EXACTLY ZERO, because the photocell has the street
   * lighting off and there is no local light to scatter. The two bands that can
   * move are the two with lamps in them.
   */
  gl_FragColor.rgb += gNoctisLightHaze;
}
// CONTRACT §5.3: the half-float target tops out at 65504. A smooth surface
// under a 100 klx sun can produce a specular lobe well past that, and one Inf
// becomes NaN and then a black hole in the bloom chain.
gl_FragColor.rgb = min(gl_FragColor.rgb, vec3(${HDR_CLAMP.toFixed(1)}));

/**
 * Linear view depth, in metres, in the alpha channel of the HDR target.
 *
 * Session 3's screen-space reflection has to march against a depth buffer, and
 * the alternative — attaching a DepthTexture to a 4× multisampled target and
 * relying on the driver to resolve it — is a second surface, a second resolve,
 * and a behaviour that differs between backends. Alpha on the HDR target is
 * already allocated, already resolved with the colour, and already zero use:
 * every material in this project is opaque and the composite reads .rgb.
 *
 * The sky background writes SSR.skyDepth here for the same reason, so a ray
 * that leaves the geometry cannot report a hit on the sky.
 */
gl_FragColor.a = vViewPosition.z;
`;

  // -------------------------------------------------------------------------
  // the canyon field, and the procedural surface response that rides with it

  /**
   * Value noise. Deterministic, seedless, and a function of world position, so
   * a wall's grain does not move when the wall does not, no two buildings share
   * a pattern, and a thousand of them cost nothing extra. This is the whole
   * reason the material variation is positional rather than per-instance data:
   * per-instance data has to be generated, stored, streamed and kept in sync,
   * and this has to be sampled.
   */
  const NOISE_GLSL = /* glsl */ `
float noctisHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noctisValue(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(noctisHash(i + vec2(0.0, 0.0)), noctisHash(i + vec2(1.0, 0.0)), u.x),
    mix(noctisHash(i + vec2(0.0, 1.0)), noctisHash(i + vec2(1.0, 1.0)), u.x),
    u.y);
}

float noctisFbm(vec2 p) {
  float a = 0.5;
  float s = 0.0;
  float n = 0.0;
  for (int i = 0; i < 3; i++) {
    s += a * noctisValue(p);
    n += a;
    p *= 2.17;
    a *= 0.5;
  }
  return s / n;
}

/**
 * Project world position onto the plane the surface most faces, so a facade is
 * textured in its own plane and the road in the ground plane. Cheaper than a
 * triplanar blend by three, and the seams land on box edges, where the normal
 * flips and there is a silhouette anyway.
 */
vec2 noctisSurfaceUv(vec3 wp, vec3 n) {
  vec3 a = abs(n);
  if (a.y > max(a.x, a.z)) return wp.xz;
  if (a.x > a.z) return wp.zy;
  return wp.xy;
}
`;

  const CANYON_GLSL = /* glsl */ `
vec3 noctisFieldUvw(vec3 wp) {
  return clamp(vec3(
    (wp.x - uNoctisCanyonMin.x) * uNoctisCanyonInvSpan.x,
    (wp.z - uNoctisCanyonMin.z) * uNoctisCanyonInvSpan.z,
    // The same square-root warp lib/canyon.js bakes with. One function, two
    // languages; if these ever disagree the field is sampled at the wrong
    // height and every soffit in the city is lit by the wrong sky.
    sqrt(clamp(wp.y / uNoctisCanyonYMax, 0.0, 1.0))
  ), 0.0, 1.0);
}

/**
 * THE NEUTRAL DEFAULT — CONTRACT §11.
 *
 * What a surface is lit by when its chunk's field has not arrived, or is outside
 * the resident ring, or its bake failed. It has to render plausibly rather than
 * as a hole or a stall, and it has to be cheap enough to be the answer for most
 * of the city most of the time.
 *
 * It is not a constant. The cosine-weighted sky view factor at the floor of an
 * infinite canyon of half-width w whose walls rise H above the point is
 * sin(atan(w / (H − y))) — a closed form, not a fitted curve — so a point on the
 * road sees a strip of sky and a point at parapet height sees nearly all of it.
 * That is the whole of what the baked field does at low frequency, and it is why
 * the ring boundary is not visible: the default and the bake agree about the
 * average and differ only about the particular building.
 *
 * The bent normal defaults to straight up and the four face fractions split the
 * occluded remainder evenly, which is the correct average over street
 * orientations — the one honest thing to say when you do not know which way the
 * canyon runs.
 *
 * IT TAKES THE SURFACE NORMAL, AND UNTIL SESSION 5 IT DID NOT. That omission is
 * the mid-distance boundary, and the arithmetic is not close:
 *
 *   the closed form is calibrated so vis(y = 0) = the block's MEASURED roadway
 *   openness, 0.512. It is a monotonically rising function of height, so at a
 *   facade 20 m up it returns sin(atan(15.5 / 6)) = 0.93 — while the block's
 *   own facade probes, marching the same horizon at the same points the bake
 *   samples, measure 0.244. A factor of 3.8, on the term that decides how much
 *   sky a wall is lit by.
 *
 * The shader then applies 1 − (1 − vis)·0.5 for a vertical surface, so a
 * facade outside the field ring was lit at 0.88 of the open sky and one inside
 * it at 0.62 — a 42% step in ambient at exactly fieldRadius, which is two
 * chunks, which is 256 m, which is "roughly two blocks out". Every facade past
 * it was over-lit into the top of the tone curve, and a 0.4-albedo wall at the
 * top of the tone curve is white whatever colour it started as.
 *
 * CONTRACT §8.1 states the requirement — "the default's job is to agree with the
 * bake about the average; where they disagree, the ring boundary becomes
 * visible". Session 4 fitted TWO free parameters to ONE measurement and the
 * boundary duly became visible. There are two measurements, both already on the
 * CPU: canyon.roadSkyVis and canyon.facadeSkyVis. This uses both, selected
 * by the one thing the closed form cannot infer from a position — which way the
 * surface faces.
 *
 * upness is the geometric normal's Y clamped to [0,1]: 1 on a road, 0 on a
 * wall and on a soffit. A soffit's answer does not matter — CANYON_MAPS gives a
 * downward normal a visibility of 1 by construction, because its hemisphere is
 * below the horizon where the environment map is already right.
 */
void noctisDefaultField(vec3 wp, vec3 n, out vec4 skyBent, out vec4 faces) {
  float w = uNoctisFieldDefault.x;
  float H = uNoctisFieldDefault.y;
  float rise = max(H - wp.y, 0.35);
  float floorVis = clamp(sin(atan(w / rise)), 0.06, 1.0);
  float upness = clamp(n.y, 0.0, 1.0);
  float vis = clamp(mix(uNoctisFieldDefault.z, floorVis, upness), 0.04, 1.0);
  skyBent = vec4(0.0, 1.0, 0.0, vis);
  faces = vec4(vec3((1.0 - vis) * 0.25), (1.0 - vis) * 0.25);
}

/**
 * Sample the indirect field at a world point.
 *
 * Three sources, in falling order of fidelity and rising order of coverage:
 * the origin block's own high-resolution field where it applies, the streamed
 * chunk array where a slot is resident, and the analytic default everywhere
 * else. Every one of them returns something; there is no path here that returns
 * darkness because a chunk was late.
 */
void noctisSampleField(vec3 wp, vec3 n, out vec4 skyBent, out vec4 faces) {
  vec3 blockUvw = vec3(
    (wp.x - uNoctisCanyonMin.x) * uNoctisCanyonInvSpan.x,
    (wp.z - uNoctisCanyonMin.z) * uNoctisCanyonInvSpan.z,
    sqrt(clamp(wp.y / uNoctisCanyonYMax, 0.0, 1.0)));

  // Unclamped, because the test is whether this point is inside the block's
  // field at all. Using the clamped coordinates would make every point in the
  // city read the block's edge voxel, which is a wall.
  if (blockUvw.x > 0.0 && blockUvw.x < 1.0 && blockUvw.y > 0.0 && blockUvw.y < 1.0) {
    skyBent = texture(uNoctisCanyonA, blockUvw);
    faces = texture(uNoctisCanyonB, blockUvw);
    return;
  }

  if (uNoctisChunkGrid.w > 0.5) {
    float chunkSize = uNoctisChunkParams.x;
    vec2 c = floor(wp.xz / chunkSize);
    vec2 cell = mod(c, uNoctisChunkGrid.x);
    // The slot table stores slot+1 in an 8-bit red channel, so zero means
    // "nothing resident here" and no separate validity channel is needed.
    float packed = texture(uNoctisChunkSlots, (cell + 0.5) * uNoctisChunkGrid.y).r;
    float slot = packed * 255.0 - 1.0;
    if (slot > -0.5) {
      float margin = uNoctisChunkParams.y;
      float slices = uNoctisChunkParams.z;
      vec2 origin = c * chunkSize - margin;
      float span = chunkSize + 2.0 * margin;
      vec2 uv = (wp.xz - origin) / span;
      if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
        // Manual interpolation across layers: a 2D array filters within a layer
        // and never between them, so the vertical lerp a sampler3D gives for
        // free has to be written out. Same square-root warp as the bake.
        float wy = sqrt(clamp(wp.y / uNoctisChunkParams.w, 0.0, 1.0)) * slices - 0.5;
        float y0 = floor(wy);
        float fy = wy - y0;
        float l0 = clamp(y0, 0.0, slices - 1.0);
        float l1 = clamp(y0 + 1.0, 0.0, slices - 1.0);
        float base = slot * slices;
        skyBent = mix(texture(uNoctisChunkA, vec3(uv, base + l0)),
                      texture(uNoctisChunkA, vec3(uv, base + l1)), fy);
        faces   = mix(texture(uNoctisChunkB, vec3(uv, base + l0)),
                      texture(uNoctisChunkB, vec3(uv, base + l1)), fy);
        return;
      }
    }
  }

  noctisDefaultField(wp, n, skyBent, faces);
}

/**
 * Specular occlusion from ambient occlusion and roughness — Lagarde & de
 * Rousiers, "Moving Frostbite to PBR", §4.10. A mirror reflects one direction
 * and we cannot say whether that direction is blocked, so it is left nearly
 * open; a rough lobe integrates most of the hemisphere and is occluded almost
 * as much as the diffuse. Without this a wet road in a canyon reflects a sky
 * it cannot see, which is the same bug as the navy road wearing a gloss coat.
 */
float noctisSpecularOcclusion(float NoV, float ao, float roughness) {
  return clamp(pow(NoV + ao, exp2(-16.0 * roughness - 1.0)) - 1.0 + ao, 0.0, 1.0);
}
`;

  /**
   * Screen-space reflection against the previous frame. CONTRACT §5.8.
   *
   * WHY IT IS IN THE FORWARD PASS AND NOT A POST PASS
   *
   * A post pass has the colour and the depth of the frame and knows nothing
   * about the surface it is reflecting off: not its roughness, not whether it
   * is wet, not whether it is a wall or a road. Recovering that would mean a
   * G-buffer — a second full pass over the geometry — or a height test in
   * screen space, which is a material flag written down somewhere else. Here,
   * `material.roughness` and `gNoctisWetFilm` are already in registers, so the
   * march is masked to exactly the fragments that have a mirror on them: the
   * wet road, and nothing else in the frame. A dry frame never enters the loop.
   *
   * WHY THE PREVIOUS FRAME
   *
   * A forward pass cannot read the target it is writing. The colour and depth
   * come from the frame before, reprojected through that frame's own
   * view-projection, so a moving camera is handled properly rather than
   * ignored. One frame of lag on a road reflection is what every shipped
   * implementation of this has.
   *
   * WHAT IT DOES NOT DO
   *
   * One ray per fragment, no lobe sampling — the roughness blur is a mip
   * selection on the source buffer, which is a cone approximation and not an
   * integral. Nothing behind the camera, nothing off the sides of the screen,
   * and nothing hidden behind what is on screen. All three failure modes end
   * in `weight = 0` and the canyon fallback, never in a black pixel.
   */
  const SSR_GLSL = /* glsl */ `
struct NoctisHit {
  vec3 color;
  float weight;
};

vec2 noctisSSRProject(vec3 wp, out float zRay, out bool valid) {
  vec4 clip = uNoctisSSRPrevViewProj * vec4(wp, 1.0);
  valid = clip.w > 1e-4;
  zRay = -(uNoctisSSRPrevView * vec4(wp, 1.0)).z;
  return clip.xy / max(clip.w, 1e-4) * 0.5 + 0.5;
}

/**
 * How far the march reaches, in metres.
 *
 * A FUNCTION AND NOT A UNIFORM, because the two answers are compile-time: the
 * road's is SSR.maxDistance and open water's is SSR.waterMaxDistance, the
 * step count differs with it, and NOCTIS_WATER already forks its own program.
 * See constants.js for the arithmetic — 110 m is a property of a 15 m
 * carriageway and 210 m is a property of a 104.6 m river, and neither is a
 * property of the march.
 */
float noctisSSRReach() {
#ifdef NOCTIS_WATER
  return ${SSR.waterMaxDistance.toFixed(1)};
#else
  return uNoctisSSR.y;
#endif
}

NoctisHit noctisSSR(vec3 wp, vec3 dir, float rough) {
  NoctisHit hit;
  hit.color = vec3(0.0);
  hit.weight = 0.0;

  float growth = uNoctisSSR2.x;
  // s0·(growth^N − 1)/(growth − 1) = maxDistance, so the ladder always spans
  // exactly maxDistance no matter what the step count is set to.
  float span = (pow(growth, float(NOCTIS_SSR_STEPS)) - 1.0) / (growth - 1.0);
  float stepLen = noctisSSRReach() / span;

  float t = uNoctisSSR.z;
  float lastMiss = t;
  float hitT = -1.0;
  float zRay;
  bool valid;

  for (int i = 0; i < NOCTIS_SSR_STEPS; i++) {
    t += stepLen;
    vec2 uv = noctisSSRProject(wp + dir * t, zRay, valid);
    // Behind the camera, or off the screen: the buffer has nothing to say about
    // where this ray went, and guessing is how screen-space reflection earns
    // its reputation. Stop, and let the fallback stand.
    if (!valid) break;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;

    float zScene = textureLod(uNoctisSSRSource, uv, 0.0).a;
    float delta = zRay - zScene;
    float thickness = clamp(stepLen * uNoctisSSR2.y, uNoctisSSR2.z, uNoctisSSR3.z);
    if (delta > 0.0 && delta < thickness) { hitT = t; break; }

    lastMiss = t;
    stepLen *= growth;
  }

  if (hitT < 0.0) return hit;

  // Bisect the last interval. The march found the step the surface is in; this
  // finds where in that step it is, which at grazing incidence is the
  // difference between a reflection and a smear.
  float lo = lastMiss;
  float hi = hitT;
  for (int i = 0; i < NOCTIS_SSR_REFINE; i++) {
    float mid = 0.5 * (lo + hi);
    vec2 uv = noctisSSRProject(wp + dir * mid, zRay, valid);
    if (!valid) break;
    float zScene = textureLod(uNoctisSSRSource, uv, 0.0).a;
    if (zRay - zScene > 0.0) hi = mid; else lo = mid;
  }

  vec2 uv = noctisSSRProject(wp + dir * hi, zRay, valid);
  if (!valid) return hit;

  // Fade at the screen edge. A reflection that walks off the side of the frame
  // and stops dead draws a hard line across the road; this is the whole reason
  // screen-space reflection needs an edge term and not just a bounds test.
  vec2 fade = smoothstep(vec2(0.0), vec2(uNoctisSSR3.y), uv)
            * (1.0 - smoothstep(vec2(1.0 - uNoctisSSR3.y), vec2(1.0), uv));

  float mip = clamp(rough * uNoctisSSR2.w, 0.0, uNoctisSSR3.x);
  hit.color = textureLod(uNoctisSSRSource, uv, mip).rgb;
  // Hand back to the environment as the surface roughens: one mirror ray stops
  // describing a wide lobe long before the lobe covers the hemisphere.
  float roughFade = 1.0 - smoothstep(uNoctisSSR.w * 0.55, uNoctisSSR.w, rough);
  hit.weight = min(fade.x, fade.y) * roughFade;
  return hit;
}
`;

  /**
   * OPEN WATER. CONTRACT §5.13, constants `WATER` and `waterWaves()`.
   *
   * COMPILED ONLY UNDER `NOCTIS_WATER`, so the city's million triangles never
   * see it — the same rule `NOCTIS_GRIME` and `NOCTIS_GAIT` follow, and the
   * same reason: this is three sines, three cosines and two screen-space
   * derivatives on a surface that can fill the lower half of the frame.
   *
   * WHAT IT RETURNS IS A SLOPE AND NOT A HEIGHT, and that is the whole model.
   * The water plane is flat and stays flat; what moves is its normal. A
   * displaced surface would need tessellation fine enough for a 0.47 m wave
   * across a hundred metres of river — a hundred thousand triangles for a
   * quantity that is invisible at every angle except the silhouette, and a
   * river seen from the bank has no silhouette. The slope is exact for the
   * model; the height is exactly zero and is not needed anywhere.
   *
   * THE SECOND RETURN IS THE VARIANCE THIS FRAGMENT COULD NOT RESOLVE. Each
   * component fades as the pixel footprint approaches its own wavelength, and
   * `residual` is the mean-square slope those faded components were carrying.
   * The caller turns it into roughness, because a roughness IS the statistics of
   * the slopes inside one pixel: what is lost as geometry is regained as BRDF
   * and the total is conserved. Without it the far half of the river is a
   * sparkling mess under any amount of temporal accumulation, and turning the
   * waves off with distance instead would make it a mirror — both are the same
   * mistake, which is treating an unresolved detail as though it were absent.
   *
   * The numbers are baked in from `waterWaves()` rather than passed as uniforms:
   * they are derived from the wind speed and the dispersion relation at module
   * load and nothing at run time may move them, so a uniform would be a knob
   * this design specifically does not have.
   */
  const WAVES = waterWaves();
  const WATER_GLSL = /* glsl */ `
#ifdef NOCTIS_WATER
/**
 * Slope of the wind sea at a world-space xz, at time t seconds.
 *
 * out residual   mean-square slope of the components this pixel cannot resolve
 */
vec2 noctisWaterSlope(vec2 p, float t, vec2 dpx, vec2 dpy, out float residual, out float span) {
  vec2 g = vec2(0.0);
  residual = 0.0;
  span = 0.0;
${WAVES.waves
    .map(
      (w, i) => `  // component ${i}: lambda ${w.lambda} m, k ${w.k.toFixed(4)}, omega ${w.omega.toFixed(4)} rad/s, c ${w.c.toFixed(3)} m/s, amp ${w.amp.toFixed(5)} m
  {
    vec2 d = vec2(${w.dir[0].toFixed(6)}, ${w.dir[1].toFixed(6)});
    /**
     * THE FOOTPRINT THIS COMPONENT SEES IS THE PIXEL'S EXTENT ALONG ITS OWN
     * DIRECTION OF TRAVEL, AND NOT THE PIXEL'S LONGEST AXIS.
     *
     * A plane wave is constant perpendicular to d, so averaging it over a
     * footprint only attenuates it in proportion to how far that footprint
     * reaches ALONG d. The first version used max(|dFdx|, |dFdy|) — the
     * anti-aliasing answer, and the wrong quantity here — which at grazing
     * incidence is the view-aligned axis and is tens of metres while the
     * across-view axis is centimetres. Every component faded, the residual
     * went to the full Cox-Munk variance, the roughness came out at 0.44 and
     * SSR's own roughness fade then threw away 93% of the reflection at
     * exactly the angle the river exists to be seen at. Measured on the
     * delivered frame: the far bank's lights did not reach the water at all.
     * (No backticks in this comment: it lives INSIDE a template literal.)
     */
    float along = abs(dot(d, dpx)) + abs(dot(d, dpy));
    span = max(span, along);
    float fade = 1.0 - smoothstep(${(w.lambda * WATER.fadeLo).toFixed(4)}, ${(w.lambda * WATER.fadeHi).toFixed(4)}, along);
    // d(a*sin(k*(d.p) - w*t))/dp = a*k*d*cos(...), which is the slope this
    // component contributes along each axis. The constant is a*k, and it is
    // the same for all three by construction (equal share of the variance).
    // (No backticks in this comment: it lives INSIDE a template literal.)
    g += d * (${WAVES.perComponentSlope.toFixed(6)} * fade) *
         cos(${w.k.toFixed(6)} * dot(d, p) - ${w.omega.toFixed(6)} * t);
    float lost = ${WAVES.perComponentSlope.toFixed(6)} * (1.0 - fade);
    residual += 0.5 * lost * lost;
  }`
    )
    .join('\n')}
  return g;
}
#endif
`;

  /**
   * Adding entries to shader.uniforms binds values; it does not declare them.
   * The declarations have to be prepended to the source or the injected code
   * refers to identifiers the compiler has never seen.
   */
  /**
   * The motion attachment's declaration and the arithmetic that fills it.
   * CONTRACT §5.11.
   *
   * DECLARED AT GLOBAL SCOPE, WHICH IS WHY IT LIVES IN THE PARS BLOCK. three
   * converts every non-raw material to `#version 300 es` and emits
   * `layout(location = 0) out highp vec4 pc_fragColor;` in its own prefix; this
   * is the second output and it has to sit beside that, not inside main().
   *
   * DECLARED UNCONDITIONALLY, INCLUDING WHEN THE TARGET HAS ONE ATTACHMENT.
   * three calls `gl.drawBuffers([COLOR_ATTACHMENT0])` for a single-attachment
   * target, which maps location 1 to GL_NONE, and a write to an output mapped
   * to NONE is defined to be discarded. So the shadow pass and any future
   * single-target pass compile and run unchanged.
   *
   * WHAT IT HOLDS. prevNdc(where this surface WAS) − prevNdc(where it IS), both
   * through the same previous view-projection, so the camera's contribution
   * cancels and what remains is the object's own displacement in NDC. The
   * resolve adds it to its camera reprojection. For a static object
   * `uNoctisPrevDelta` is the identity, the two terms are the same expression,
   * and the difference is exactly zero — not approximately, and not by a
   * branch. That is what lets §5.10's frames be reproduced bit for bit.
   *
   * ONE mat4 UNIFORM AND NO NEW VARYING. `uNoctisPrevDelta` is
   * prevModelMatrix · inverse(modelMatrix), so it maps this frame's world
   * position to last frame's directly and `vNoctisWorldPos` — already a
   * varying, already perspective-correct — is the only input it needs. The
   * alternative was two clip-space varyings, eight floats on every vertex of a
   * million-triangle city to carry a value that is currently zero everywhere.
   *
   * WHAT IT CANNOT DO, STATED HERE RATHER THAN DISCOVERED IN 4b: one delta per
   * MATERIAL is one delta per draw call, so an InstancedMesh whose instances
   * move independently — which is what a traffic system is — cannot use this.
   * Rigid non-instanced objects are covered; per-instance motion needs a
   * previous instanceMatrix, which is a second instanced attribute and a
   * decision 4b has to make. It is a limit, not a bug, and the probe that
   * verifies this session exercises exactly the case that works.
   */
  const MOTION_PARS = /* glsl */ `
layout(location = 1) out highp vec2 gNoctisMotion;
uniform mat4 uNoctisPrevViewProj;
uniform mat4 uNoctisPrevDelta;

vec2 noctisMotionNdc(vec3 worldPos) {
  vec4 here = uNoctisPrevViewProj * vec4(worldPos, 1.0);
  vec4 was  = uNoctisPrevViewProj * (uNoctisPrevDelta * vec4(worldPos, 1.0));
  // The same guard the resolve uses on the same quantity — max(w, 1e-4) — and
  // deliberately the same rather than merely equivalent: these two divisions
  // have to agree about what happens behind the camera or the sum of their
  // results is a reprojection to nowhere.
  vec2 a = here.xy / max(here.w, 1e-4);
  vec2 b = was.xy  / max(was.w,  1e-4);
  return b - a;
}

/**
 * The per-instance overload. CONTRACT §5.12.
 *
 * Same shape, same guard, and the guard is the same EXPRESSION rather than an
 * equivalent one for the reason given above. The only difference is where the
 * previous world position comes from: the uniform path applies one delta to
 * every fragment of a draw call, and an InstancedMesh whose instances move
 * independently has one delta per instance and therefore cannot use it.
 */
vec2 noctisMotionNdc(vec3 worldPos, vec3 prevWorldPos) {
  vec4 here = uNoctisPrevViewProj * vec4(worldPos, 1.0);
  vec4 was  = uNoctisPrevViewProj * vec4(prevWorldPos, 1.0);
  vec2 a = here.xy / max(here.w, 1e-4);
  vec2 b = was.xy  / max(was.w,  1e-4);
  return b - a;
}
`;

  /**
   * WHY THE INSTANCED BRANCH IS AN #ifdef AND NOT A RUNTIME TEST.
   *
   * `noctisRough` gets away with "absent means zero" because the default
   * generic vertex attribute is (0,0,0,1) and its first component being zero is
   * a usable sentinel. A mat4 attribute occupies four locations and an absent
   * one reads as four columns of (0,0,0,1) — which is not the identity, it is
   * SINGULAR, and it would collapse every vertex of every non-instanced patched
   * mesh in the city onto the origin. There is no value of an unbound mat4 that
   * means "no override".
   *
   * So the attribute is declared only where it is bound, gated on a define that
   * `patch(m, { prevInstance: true })` sets. three's program cache key already
   * includes the defines, so this correctly forks a second program rather than
   * baking whichever variant compiled first.
   *
   * The cost is 3 varying floats — and only on the materials that opt in, which
   * is why §5.11's objection to "eight floats on every vertex of a
   * million-triangle city" does not apply: the city's buildings never compile
   * this branch.
   */
  const MOTION_INSTANCED_PARS = /* glsl */ `
#ifdef NOCTIS_PREV_INSTANCE
  varying vec3 vNoctisMotionOffset;
#endif
`;

  const MOTION_FRAGMENT = /* glsl */ `
#ifdef NOCTIS_PREV_INSTANCE
  gNoctisMotion = noctisMotionNdc(vNoctisWorldPos, vNoctisWorldPos + vNoctisMotionOffset);
#else
  gNoctisMotion = noctisMotionNdc(vNoctisWorldPos);
#endif
`;

  const FRAGMENT_PARS = /* glsl */ `
uniform sampler2D uNoctisLightData;
uniform sampler2D uNoctisClusterGrid;
uniform sampler2D uNoctisClusterIndices;
uniform vec4 uNoctisClusterParams;
uniform vec4 uNoctisClusterDepth;
uniform vec2 uNoctisScreen;
uniform vec2 uNoctisIndexSize;
uniform sampler2D uNoctisSky;
uniform vec2 uNoctisHaze;
uniform float uNoctisHazeOpen;
uniform mat3 uNoctisViewRotInv;
uniform float uNoctisCamHeight;

uniform sampler3D uNoctisCanyonA;
uniform sampler3D uNoctisCanyonB;
uniform vec3 uNoctisCanyonMin;
uniform vec3 uNoctisCanyonInvSpan;
uniform float uNoctisCanyonYMax;
uniform float uNoctisCanyonVoxel;
uniform sampler2DArray uNoctisChunkA;
uniform sampler2DArray uNoctisChunkB;
uniform sampler2D uNoctisChunkSlots;
uniform vec4 uNoctisChunkParams;
uniform vec4 uNoctisChunkGrid;
uniform vec3 uNoctisFieldDefault;
uniform vec3 uNoctisFaceL[4];
uniform vec3 uNoctisGroundL;
uniform float uNoctisIndirect;
uniform float uNoctisWet;
uniform float uNoctisTime;
uniform vec4 uNoctisSurface;

uniform sampler2D uNoctisSSRSource;
uniform mat4 uNoctisSSRPrevViewProj;
uniform mat4 uNoctisSSRPrevView;
uniform vec4 uNoctisSSR;
uniform vec4 uNoctisSSR2;
uniform vec3 uNoctisSSR3;

varying vec3 vNoctisWorldPos;
varying vec3 vNoctisWorldNormal;
varying float vNoctisRough;
#ifdef NOCTIS_GRIME
  varying float vNoctisGrime;
#endif

// Written once per fragment in the surface block, read again in the indirect
// block, which is a different point in three's chain. Globals rather than a
// second texture fetch.
vec4 gNoctisSkyBent;
vec4 gNoctisFaces;
float gNoctisWetFilm;
/** Standing water, not the film: zero on anything that is not near-level. */
float gNoctisWetPond;
float gNoctisPuddle;
/**
 * IN-SCATTERED RADIANCE FROM THE LOCAL LIGHTS, cd/m². LOOK.md §3.
 *
 * Accumulated over the fragment's own froxel in the cluster block and spent in
 * the haze block, which are two different points in three's chain — a global
 * for exactly the reason gNoctisSkyBent above is one, and initialised in the
 * cluster block rather than left to GLSL's undefined global.
 */
vec3 gNoctisLightHaze;
#ifdef NOCTIS_WATER
  /** d(height)/dx and d(height)/dz of the wind sea. See WATER_GLSL. */
  vec2 gNoctisWaterSlope;
#endif

${NOISE_GLSL}
${CANYON_GLSL}
${SSR_GLSL}
${WATER_GLSL}
`;

  const VERTEX_PARS = /* glsl */ `
varying vec3 vNoctisWorldPos;
varying vec3 vNoctisWorldNormal;
/**
 * Per-instance roughness, session 3. Declared unconditionally because every
 * patched material shares one program; a mesh with no such attribute reads the
 * default generic vertex attribute, which is zero, and zero means "this mesh
 * has no per-instance roughness — use the material's". That is why the test
 * downstream is a comparison against zero rather than a define.
 *
 * It exists because the block has four base materials and one material object:
 * albedo rides in instanceColor, which three already multiplies into
 * diffuseColor, and roughness has nowhere to ride, so it gets an attribute.
 * Four THREE materials instead would be four InstancedMeshes per element type.
 */
/**
 * NOT DECLARED ON THE PEDESTRIAN MATERIAL, and the carve-out is a hardware
 * limit rather than a preference. ANGLE binds at most 16 vertex attributes;
 * that material already declares position, normal, color, noctisLimb,
 * noctisGait, noctisBodyColor, noctisGarment plus FOUR SLOTS EACH for
 * instanceMatrix and noctisPrevInstanceMatrix, and this one made seventeen —
 * the program failed to link with "Too many attributes", which is one console
 * line and 360 people missing from the frame.
 *
 * IT COSTS NOTHING BECAUSE THE VALUE WAS ALREADY ZERO. A pedestrian geometry
 * never carried this attribute, so it read the unbound generic default of 0,
 * and the fragment treats 0 as "no override" (see SURFACE_FRAGMENT, and the
 * noctisRough comment above about why 0 is a usable sentinel for a float). The
 * branch below writes the same 0 it used to read.
 */
#ifndef NOCTIS_GARMENT
  attribute float noctisRough;
#endif
varying float vNoctisRough;

/**
 * The previous frame's instanceMatrix, CONTRACT §5.12. Declared only under the
 * define, for the reason MOTION_INSTANCED_PARS gives: an unbound mat4 is
 * singular, not the identity.
 */
#ifdef NOCTIS_PREV_INSTANCE
  attribute mat4 noctisPrevInstanceMatrix;
  varying vec3 vNoctisMotionOffset;
#endif

/**
 * Vehicle grime, session 9. Behind a define for the reason 5.12 gates the
 * per-instance motion path: the term is opt-in per material, and the city's
 * million triangles never compile it or pay its varying. (No backticks in
 * this comment: it lives INSIDE a template literal.)
 *
 * TWO ATTRIBUTES, ONE VARYING. noctisGrimeV is PER-VERTEX, baked into the
 * shared section geometry in the section's own unit space — which is what makes
 * the film ride the body. The alternative was the SURFACE_FRAGMENT soiling
 * term, and it is wrong for anything that moves: its noise is anchored in
 * world space, so on a vehicle the pattern crawls through the paint at the
 * vehicle's own speed. noctisGrime is PER-INSTANCE strength — which row of
 * the body, and how neglected this vehicle is. A geometry carrying neither
 * reads 0 * 0 = 0 through the same unbound-attribute default noctisRough
 * relies on, which is what the wheels (same material, own geometry) do.
 */
#ifdef NOCTIS_GRIME
  attribute float noctisGrimeV;
  attribute float noctisGrime;
  varying float vNoctisGrime;
#endif

/**
 * The pedestrian gait, session 10. Behind a define for the same reason the two
 * above are: the city's million triangles never compile it.
 *
 * TWO ATTRIBUTES AND NO VARYING. noctisLimb is PER-VERTEX — (shear, pivotY),
 * baked into the lofted geometry by streetlife.js, because which limb a vertex
 * belongs to is a property of the geometry and after the merge into one mesh it
 * exists nowhere else. noctisGait is PER-INSTANCE and carries FOUR numbers:
 * this frame's cycle parameter, last frame's, and the two matching swing
 * amplitudes. Last frame's is here rather than in a double buffer because both
 * halves are written every frame anyway (instmotion double-buffers to turn two
 * reads into one upload; there is nothing to save here).
 *
 * The displacement itself is src/lib/gait.js — one model, two emissions, the
 * way atmosphere.js is. The harness projects the SAME displaced vertices when
 * it hands a gate a silhouette, and two copies of a displacement formula is
 * exactly the arrangement CONTRACT 9.1 is about. (No backticks in this
 * comment: it lives INSIDE a template literal.)
 */
#if defined( NOCTIS_GAIT ) || defined( NOCTIS_GARMENT )
  /**
   * noctisLimb is (shear, pivotY, PART LABEL) and the third component is read
   * by the two-colour select below, which is why this declaration is shared
   * between the two defines rather than living under the gait one. A stall
   * has a part label and no gait; a pedestrian has both.
   */
  attribute vec3 noctisLimb;
#endif
#ifdef NOCTIS_GAIT
  attribute vec4 noctisGait;
${GAIT_GLSL}
#endif

/**
 * Two per-instance colours selected by a per-vertex mask, session 10.
 *
 * A pedestrian is one mesh carrying a body and a garment that are tinted
 * independently per person, and instanceColor tints a WHOLE mesh — which is
 * why the garment used to be a second mesh and why five builds then cost ten
 * draw calls against a ceiling of 440 that highway_speed measured 443 against.
 *
 * NOT instanceColor PLUS ONE ATTRIBUTE: three multiplies instanceColor into
 * vColor before any injection of ours runs, so whichever colour rode there
 * would be baked into the other one's fragments and this would have to divide
 * it back out. Two attributes and one mix is exact. The mask is 0 or 1 at
 * every vertex and no triangle spans two parts, so it is never interpolated to
 * anything between.
 */
/**
 * TWO ATTRIBUTES, THREE COLOUR ZONES — AND THE THIRD COSTS NO SLOT.
 *
 * Session 14 wrote down the wall and its arithmetic: a patched pedestrian
 * program binds position, normal, color, noctisRough, noctisLimb, noctisGait,
 * noctisBodyColor, noctisGarment and FOUR SLOTS EACH for instanceMatrix and
 * noctisPrevInstanceMatrix, which is 16 of ANGLE's 16 MAX_VERTEX_ATTRIBS. A
 * seventeenth attribute does not fail loudly; it fails to LINK, which is one
 * console line and 360 people absent from the frame. So a third independent
 * zone could not have a third colour attribute.
 *
 * IT DOES NOT NEED ONE. An attribute slot is a vec4 whether the shader
 * declares vec4 or vec3 — the hardware binds sixteen four-component slots and
 * a vec3 wastes the fourth component. These two attributes were vec3. Widening
 * both to vec4 costs exactly zero slots and yields TWO spare floats, which is
 * the same trick session 10 used when it put the part label into the third
 * component of noctisLimb rather than into a mask of its own.
 *
 * WHAT THE TWO SPARE FLOATS CARRY: one linear RGB reflectance at 12 bits a
 * channel, packed as
 *
 *     noctisBodyColor.w = round(r·4095)·4096 + round(g·4095)
 *     noctisGarment.w   = round(b·4095)
 *
 * r*4095 is at most 4095, and 4095*4096 + 4095 = 16 777 215, which is exactly
 * 2^24 - 1: the largest integer a float32 mantissa represents without loss. So
 * the pack is EXACT and floor/mod recover both channels exactly. Twelve
 * bits is a step of 1/4095 = 0.024% of full scale; eight bits would have been
 * one float instead of two and was rejected on the dark end, where these
 * reflectances live: a 0.04 trouser cloth quantised at 1/255 has ten steps
 * across it and the banding is visible on a leg at four metres.
 *
 * The zone index is the third component of noctisLimb and it is now 0, 1 or 2
 * rather than 0 or 1.
 * It is still a PART LABEL, still constant over a part, and still never
 * interpolated, because no triangle spans two parts.
 */
#ifdef NOCTIS_GARMENT
  attribute vec4 noctisBodyColor;
  attribute vec4 noctisGarment;
${ZONE_UNPACK_GLSL}
#endif
`;

  /**
   * The garment select, injected after three's own color_vertex.
   *
   * At that point vColor is the geometry's color attribute — the per-part
   * tint (skin, trousers, shoe leather) — and nothing else, because these
   * meshes deliberately carry no instanceColor. Multiplying by the chosen
   * instance colour here is therefore the whole of "what reflectance is this
   * fragment", in one line, with no division and no branch.
   */
  const GARMENT_VERTEX = /* glsl */ `
#if defined( NOCTIS_GARMENT ) && defined( USE_COLOR )
  {
    /**
     * The third zone, unpacked from the two spare w channels. See the
     * declaration above for why it is 12 bits a channel and why the pack is
     * exact rather than approximately exact.
     */
    vec3 noctisThird = noctisUnpackZone( noctisBodyColor.w, noctisGarment.w );
    /**
     * TWO STEPS AND NO BRANCH. noctisLimb.z is 0, 1 or 2 exactly, so
     * step(0.5, z) selects zone 1 over zone 0 and step(1.5, z) then selects
     * zone 2 over whichever of those won. A mix chain is what the two-zone
     * version was; this is the same shape with one more link, which keeps the
     * cost a pair of lerps on a vertex shader that already runs on 1 680
     * vertices a person.
     */
    vec3 noctisZone = mix( noctisBodyColor.xyz, noctisGarment.xyz, step( 0.5, noctisLimb.z ) );
    noctisZone = mix( noctisZone, noctisThird, step( 1.5, noctisLimb.z ) );
    vColor.xyz *= noctisZone;
  }
#endif
`;

  /**
   * World position and world normal, taken through the same instancing and
   * batching path three takes, so an instanced pilaster samples the field where
   * it actually stands rather than where its prototype does.
   *
   * mat3(modelMatrix) rather than a proper inverse-transpose: every mesh in the
   * block is a box, a plane or a cylinder scaled along its own axes and yawed a
   * fraction of a degree, and for a face normal aligned with an axis a
   * rotation-times-diagonal-scale followed by normalize is exact. Introduce a
   * sheared or non-axis-aligned mesh and this stops being true.
   */
  const VERTEX_FRAGMENT = /* glsl */ `
{
  vec4 noctisWorld = vec4(transformed, 1.0);
  #ifdef USE_BATCHING
    noctisWorld = batchingMatrix * noctisWorld;
  #endif
  #ifdef USE_INSTANCING
    noctisWorld = instanceMatrix * noctisWorld;
  #endif
  vNoctisWorldPos = (modelMatrix * noctisWorld).xyz;

  vec3 noctisN = objectNormal;
  #ifdef USE_BATCHING
    noctisN = mat3(batchingMatrix) * noctisN;
  #endif
  #ifdef USE_INSTANCING
    noctisN = mat3(instanceMatrix) * noctisN;
  #endif
  vNoctisWorldNormal = normalize(mat3(modelMatrix) * noctisN);
  #ifdef NOCTIS_GARMENT
    vNoctisRough = 0.0;
  #else
    vNoctisRough = noctisRough;
  #endif
  #ifdef NOCTIS_GRIME
    // The clamp is here and not in the fragment because the product is the
    // only thing the fragment reads: a seam row is written with strength above
    // one so its floor saturates, and an interpolated value must not overshoot.
    vNoctisGrime = clamp(noctisGrimeV * noctisGrime, 0.0, 1.0);
  #endif

  /**
   * THE OFFSET IS A DIFFERENCE OF MATRICES, NOT A DIFFERENCE OF POSITIONS, AND
   * THAT IS WHAT KEEPS §5.11's GUARANTEE.
   *
   * §5.11 promised "exactly zero over a static world, arithmetically and not by
   * a branch", and it earned that by computing a difference of two IDENTICAL
   * expressions. Building a parallel prevInstanceMatrix-times-transformed-then
   * -modelMatrix chain here would give two expressions that are equal in exact
   * arithmetic and are not obliged to be equal in the driver's — fma
   * contraction and reassociation are free to schedule them differently, and a
   * stationary instance would then carry a motion vector of a few ulps.
   *
   * (prev - instance) is exactly the zero matrix when the instance has not
   * moved, so the product is exactly vec3(0.0), so vNoctisWorldPos +
   * vNoctisMotionOffset is bit-identical to vNoctisWorldPos, so the two
   * projections in the fragment overload are a difference of identical
   * expressions again. The guarantee survives one level down.
   *
   * It also costs 3 varying floats instead of 6, because one world position is
   * already a varying and only the delta is new.
   */
  #ifdef NOCTIS_PREV_INSTANCE
    #ifdef NOCTIS_GAIT
      /**
       * THE SAME DIFFERENCE, WITH THE LIMB'S OWN DISPLACEMENT ADDED — and the
       * shape above is preserved rather than replaced, which is the whole
       * point of writing it this way.
       *
       * transformed already carries THIS frame's gait (the deform runs after
       * begin_vertex, below). Where the surface was last frame is therefore
       * transformed + (lastFrame's offset − this frame's), so the previous
       * world position is prev * (transformed + noctisGaitBack) and the
       * difference splits into the old term plus one more:
       *
       *     (prev − inst) * vec4(transformed, 1.0)  +  prev * vec4(back, 0.0)
       *
       * The w of 0 is load-bearing: back is a DIRECTION, and running it
       * through the translation column would add the instance's position to a
       * displacement.
       *
       * §5.11's guarantee survives, and by construction rather than by
       * inspection: back is a difference of two evaluations of one function,
       * so identical gait states give exactly vec3(0.0), so prev * vec4(0.0,
       * 0.0, 0.0, 0.0) is exactly the zero vector and the sum is
       * bit-identical to the expression without this branch. A static world
       * never compiles it in any case — NOCTIS_GAIT is set on one material.
       */
      vec3 noctisGaitBack =
        noctisGaitOffset(noctisLimb.x, noctisLimb.y, position.y, noctisGait.y, noctisGait.w) -
        noctisGaitOffset(noctisLimb.x, noctisLimb.y, position.y, noctisGait.x, noctisGait.z);
      vNoctisMotionOffset =
        (modelMatrix * ((noctisPrevInstanceMatrix - instanceMatrix) * vec4(transformed, 1.0)
                        + noctisPrevInstanceMatrix * vec4(noctisGaitBack, 0.0))).xyz;
    #else
      vNoctisMotionOffset =
        (modelMatrix * ((noctisPrevInstanceMatrix - instanceMatrix) * vec4(transformed, 1.0))).xyz;
    #endif
  #endif
}
`;

  /**
   * The gait displacement, applied to `transformed` immediately after
   * `begin_vertex` — which is where it has to go and the only interesting thing
   * about this string.
   *
   * `VERTEX_FRAGMENT` above runs after `#include <project_vertex>`, because
   * what it does is read the final position into world space. A displacement
   * cannot go there: by then `gl_Position` and `mvPosition` have already been
   * built from `transformed`, so a person's legs would swing in the world
   * position the lighting samples and stand still on screen.
   *
   * `position.y` and not `transformed.y` on the right-hand side: the limb's
   * reach below its pivot is a property of the AUTHORED body, and feeding the
   * displaced height back in would make the displacement depend on itself.
   */
  const GAIT_VERTEX = /* glsl */ `
#ifdef NOCTIS_GAIT
  transformed += noctisGaitOffset(noctisLimb.x, noctisLimb.y, position.y, noctisGait.x, noctisGait.z);
#endif
`;

  /**
   * Surface response: sample the field, then let it decide how wet and how
   * weathered this fragment is.
   *
   * Everything here is derived from world position, world normal and the
   * material's own roughness and metalness. No material carries a flag saying
   * "I am concrete" or "rain reaches me". Glass is vertical, so it does not
   * pond; glass is smooth, so it takes no mineral grain; a canopy soffit faces
   * down and stays dry; the space under it has low sky visibility and stays dry
   * too. A thousand buildings need no extra bytes for any of it.
   */
  const SURFACE_FRAGMENT = /* glsl */ `
{
  vec3 wn = normalize(vNoctisWorldNormal);

  /**
   * Per-instance roughness, before anything else touches it.
   *
   * This is the base finish of the material this instance is made of — brick,
   * concrete, panel, stucco — and everything below reads it: the mineral grain
   * only lands on rough dielectrics, so a smooth panel wall does not get the
   * weathering a concrete one does, and that is a difference a colour grade
   * cannot flatten. Zero means the mesh carries no such attribute.
   */
  if (vNoctisRough > 0.0) roughnessFactor = vNoctisRough;

  // Push the lookup out of the solid. A wall's own voxel is inside the
  // building; trilinear filtering would drag half of that darkness onto it.
  vec3 probe = vNoctisWorldPos + wn * uNoctisCanyonVoxel;
  noctisSampleField(probe, wn, gNoctisSkyBent, gNoctisFaces);

  // --- weathering ---
  // Rough dielectrics only. The test is the material's own roughness and
  // metalness, so it lands on concrete, asphalt and pavement and not on glass,
  // chrome or a sign face.
  float mineral = smoothstep(0.42, 0.66, roughnessFactor) * (1.0 - metalnessFactor);
  if (mineral > 0.0) {
    vec2 suv = noctisSurfaceUv(vNoctisWorldPos, wn);
    float coarse = noctisFbm(suv * 0.34);
    float fine = noctisValue(suv * 3.7);
    float grain = mix(coarse, fine, 0.35) - 0.5;

    // Roughness varies more than colour does. Weathered concrete is not a
    // different grey in patches, it is a different *finish* in patches, and a
    // frame where only albedo varies reads as a texture rather than a surface.
    roughnessFactor = clamp(roughnessFactor + grain * uNoctisSurface.w * mineral, 0.05, 1.0);
    diffuseColor.rgb *= 1.0 + grain * uNoctisSurface.w * 0.42 * mineral;

    // Dirt collects on anything that faces up and streaks down what does not.
    float settle = clamp(wn.y, 0.0, 1.0);
    float soil = noctisFbm(suv * 0.11) * (0.35 + 0.65 * settle);
    diffuseColor.rgb *= mix(1.0, 0.84, soil * mineral);
  }

  /**
   * --- vehicle grime, session 9 ---
   *
   * AFTER the mineral block and not inside it, and the order is load-bearing:
   * mineral is computed from the roughness ABOVE this line, so grime raising
   * a wedge's 0.34 paint past the 0.42 gate cannot switch the world-anchored
   * soiling noise on for a moving body — which would put a pattern in the
   * paint that crawls at the vehicle's own speed. BEFORE the water block, so
   * the wet film's roughness mix pulls a grime-mattened finish back toward
   * gloss, which is what rain on a dirty car does.
   *
   * A MIX TOWARD A FILM ALBEDO, NOT A MULTIPLY, AND THE FIRST VERSION WAS THE
   * MULTIPLY AND THE GATE CAUGHT IT. Road film is not a neutral-density
   * filter; it is a LAYER with its own reflectance — about 0.05, warm — so it
   * darkens silver paint and slightly LIGHTENS near-black paint. The multiply
   * could only darken, and on the dark half of the palette it pushed the
   * 30-70% body band BELOW the sunlit road showing through under the body:
   * highway_speed's ground-contact pass fraction went 73% against a 75% floor
   * with one vehicle at -0.353 — a ground band brighter than its own body.
   * The mix moves dark bodies the other way, which is both the physics and
   * the direction the assertion needed; no floor and no strength constant
   * moved to make it pass.
   *
   * The film warms — r > g > b — because soiling only warms (block.js,
   * session 5: a signed jitter cost the palette a required cluster).
   * (0.062, 0.056, 0.048) is dry road film: two-thirds of the 0.09-ish of
   * weathered asphalt, warm-shifted. The 0.7 cap keeps full grime from
   * erasing the paint entirely — a filthy vehicle still reads its livery.
   * Roughness +0.28 at full grime takes the smoothest paint (0.32) to 0.60:
   * matte film, still under the tyres' 0.86.
   */
  #ifdef NOCTIS_GRIME
  if (vNoctisGrime > 0.0) {
    roughnessFactor = clamp(roughnessFactor + vNoctisGrime * 0.28, 0.05, 1.0);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.062, 0.056, 0.048), vNoctisGrime * 0.7);
  }
  #endif

  // --- water ---
  // Where rain can reach, where it runs off, and where it stands. All three
  // come from things already on hand: the field says what sees sky, the normal
  // says which way the surface faces.
  //
  //   faceUp    1 on a road, 0 on a wall — where water POOLS
  //   faceOut   1 on anything not facing downward — where rain LANDS
  //
  // Session 2 had only the first, so a rainstorm left every facade in the city
  // bone dry. A soffit gets neither and stays dry, which was already true.
  float faceUp = smoothstep(0.55, 0.93, wn.y);
  float faceOut = smoothstep(-0.25, 0.05, wn.y);
  /**
   * How exposed this point is, corrected for which way it faces.
   *
   * The field's sky visibility is cosine-weighted about *up*, so a vertical
   * wall standing in the open reads about 0.25 — not because anything is in
   * front of it but because half of its hemisphere is the wall itself. Feeding
   * that raw number to a "can rain reach here" test says no facade in a city
   * ever gets wet, which is what session 3 measured before this line existed:
   * the top six-tenths of the midnight frame was identical wet and dry.
   *
   * The correction is the same one the indirect-diffuse term below uses for
   * the same reason, written the same way. A soffit reads fully exposed under
   * it, which is correct — a soffit's hemisphere is unoccluded — and it is
   * faceOut that keeps a soffit dry, not this.
   */
  float openness = smoothstep(
    0.12,
    0.45,
    1.0 - (1.0 - gNoctisSkyBent.a) * clamp(0.5 + 0.5 * wn.y, 0.0, 1.0)
  );
  float level = mix(${SURFACE.verticalFilm.toFixed(2)} * faceOut, 1.0, faceUp);
  gNoctisWetFilm = uNoctisWet * level * openness;
  gNoctisWetPond = uNoctisWet * faceUp * openness;

  if (gNoctisWetFilm > 0.0) {
    vec2 puv = vNoctisWorldPos.xz / ${SURFACE.puddleScale.toFixed(2)};
    // Two scales: broad low ground that ponds, and a finer break-up so the
    // edges are not one contour line. Gated on the pond rather than the film:
    // standing water does not form on a wall, and the xz projection of a
    // vertical surface would smear one puddle up the whole building.
    gNoctisPuddle = clamp(noctisFbm(puv) * 1.25 + noctisValue(puv * 4.3) * 0.22 - 0.34, 0.0, 1.0);
    float deep = smoothstep(0.22, 0.62, gNoctisPuddle) * gNoctisWetPond;

    // A film first — every wet surface is smoother than it was — and standing
    // water on top of it. The gate asks for a *range* of specular response,
    // and this is where the range comes from: the dry-ish film and the pond are
    // two thirds of a decade apart in roughness and both are on the same road.
    roughnessFactor = mix(roughnessFactor, uNoctisSurface.x, gNoctisWetFilm * 0.9);
    roughnessFactor = mix(roughnessFactor, uNoctisSurface.y, deep);
    diffuseColor.rgb *= mix(1.0, uNoctisSurface.z, gNoctisWetFilm);
  }

  /**
   * --- open water, session 15 ---
   *
   * LAST, AND IT OVERWRITES RATHER THAN BLENDS. Everything above this line
   * describes how much rain has reached a surface; a river does not care. The
   * two states the SSR march is gated on — the pond term and a roughness under
   * SSR.maxRoughness — are set to standing water unconditionally here, which is
   * the one thing the wet-road model cannot express and the whole reason this
   * is a define rather than a wetness of 1.0: uNoctisWet is GLOBAL, and setting
   * it to 1 to make the river reflect would put standing water on every road in
   * the city on a dry afternoon.
   *
   * The puddle field is switched off with it. That term is a 7 m
   * world-space noise that says where the low spots on a road are, and a river
   * has no low spots — leaving it on gives open water a stationary pattern of
   * rougher and smoother patches locked to the world grid, which is the one
   * artefact that makes water read as a texture.
   */
  #ifdef NOCTIS_WATER
  {
    gNoctisWetFilm = 1.0;
    gNoctisWetPond = 1.0;
    gNoctisPuddle = 0.0;

    /**
     * The pixel's footprint on the water, as its two world-space edge vectors
     * rather than as a single length.
     *
     * Read off the screen-space derivative of the world position rather than
     * from the depth and the field of view, because at 5° of grazing incidence
     * a pixel's footprint along the view is two orders of magnitude longer than
     * across it and a footprint computed from distance alone would be wrong by
     * exactly that factor over the whole part of the river this exists for.
     * Both vectors go through, because which of them matters depends on which
     * way a given wave is travelling. See noctisWaterSlope below.
     */
    vec2 dpx = dFdx(vNoctisWorldPos.xz);
    vec2 dpy = dFdy(vNoctisWorldPos.xz);

    float residual;
    float span;
    gNoctisWaterSlope = noctisWaterSlope(vNoctisWorldPos.xz, uNoctisTime, dpx, dpy, residual, span);

    /**
     * The slope variance this fragment could not resolve, turned back into
     * roughness. For a Gaussian slope distribution of variance s2 per axis the
     * matching GGX alpha is √2·s, so alpha² = 2·s² and the two variances add:
     *
     *     alpha² = alpha_base² + 2 · residual
     *
     * with alpha = roughness². At the far bank of a 105 m river seen from the
     * near one the 0.47 m component has gone and the other two have not, so
     * this lands around 0.19; at 300 m every component has gone and it reaches
     * the Cox–Munk total, 0.1916 of alpha and 0.438 of roughness.
     */
    float noctisAlpha0 = ${WATER.baseRoughness.toFixed(4)} * ${WATER.baseRoughness.toFixed(4)};
    float noctisAlpha = sqrt(noctisAlpha0 * noctisAlpha0 + 2.0 * residual);
    roughnessFactor = sqrt(noctisAlpha);

    /**
     * And past the footprint at which even the longest wave is sub-pixel, over
     * SSR.maxRoughness — so the march switches itself off rather than
     * spending 24 fetches and 5 refinements on a lobe one ray cannot describe.
     * §5.8's bound, stated as a footprint instead of as a roughness.
     */
    roughnessFactor = max(roughnessFactor, ${WATER.cutoffRoughness.toFixed(3)} *
      smoothstep(${(WATER.cutoffLo * Math.max(...WATER.wavelengths)).toFixed(3)},
                 ${(WATER.cutoffHi * Math.max(...WATER.wavelengths)).toFixed(3)}, span));
  }
  #endif
}
`;

  /**
   * The wave normal, injected after three has built `normal`.
   *
   * IT CANNOT GO IN THE BLOCK ABOVE and the reason is three's own include
   * order: `metalnessmap_fragment` — where the surface block is injected —
   * runs BEFORE `normal_fragment_begin`, so at that point `normal` does not
   * exist yet and anything written to it would be overwritten a line later.
   * The slope is computed up there because that is where the roughness it
   * shares a derivation with is decided, and carried down in a global, the
   * same arrangement `gNoctisSkyBent` already uses across the same gap.
   *
   * `vNoctisWorldNormal` is deliberately NOT perturbed. It is an `in` and
   * therefore read-only, and it is also the right thing: it feeds the canyon
   * field lookup and the facade-bounce weights, which are integrals over a
   * hemisphere and have nothing to say about a 0.4 m wave. What the wave has to
   * bend is the mirror direction, and the mirror direction is built from
   * `geometryNormal`, which is built from this.
   */
  const WATER_NORMAL = /* glsl */ `
#ifdef NOCTIS_WATER
{
  // The plane is level, so the unperturbed world normal is +Y exactly and the
  // perturbed one is (−dh/dx, 1, −dh/dz) normalised. viewMatrix rather than
  // normalMatrix: the water mesh is unrotated and unscaled, and a normal matrix
  // for the identity is the identity — writing it out would be a second
  // expression for the same value, which CONTRACT §9 rule 2 says to delete
  // once the two have been shown to agree.
  vec3 noctisWaterN = normalize(vec3(-gNoctisWaterSlope.x, 1.0, -gNoctisWaterSlope.y));
  normal = normalize((viewMatrix * vec4(noctisWaterN, 0.0)).xyz);
}
#endif
`;

  /**
   * Replaces three's `lights_fragment_maps`. This is where the canyon field
   * becomes light, and it is three changes to the stock chunk:
   *
   *   1. the environment's diffuse is sampled along the bent normal instead of
   *      the geometric one, so a wall in a canyon integrates the sky it can
   *      actually see rather than the sky it would see in a field;
   *   2. it is scaled by the field's visibility, which is the half of the noon
   *      bug that made the road too bright;
   *   3. the facades and the ground are added back, which is the other half —
   *      the light that used to go missing entirely.
   *
   * The bounce goes into `iblIrradiance` rather than `irradiance` deliberately.
   * three splits `iblIrradiance` between diffuse and multi-scatter specular
   * with an energy-conserving BRDF; `irradiance` is the lightmap path and gets
   * plain Lambert. Near-field bounce is environment light, so it should be
   * spent the way environment light is spent.
   */
  const CANYON_MAPS = /* glsl */ `
vec3 noctisBent = normalize(gNoctisSkyBent.xyz * 2.0 - 1.0);
float noctisSkyVis = mix(1.0, gNoctisSkyBent.a, uNoctisIndirect);
vec3 noctisWn = normalize(vNoctisWorldNormal);

// The field is baked cosine-weighted about *up*, which is exactly right for a
// road and increasingly wrong as a surface tilts away from it: half of a
// vertical wall's hemisphere is below the horizon, where the bake has nothing
// to say and the environment map already does the right thing.
float noctisVisN = 1.0 - (1.0 - noctisSkyVis) * clamp(0.5 + 0.5 * noctisWn.y, 0.0, 1.0);

#if defined( RE_IndirectDiffuse )

  #ifdef USE_LIGHTMAP
    vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
    vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
    irradiance += lightMapIrradiance;
  #endif

  #if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
    // getIBLIrradiance takes a view-space normal and rotates it back itself, so
    // the bent normal — which is world-space, because the field is — has to
    // come the other way through the view matrix first.
    vec3 noctisBentView = mat3(viewMatrix) * noctisBent;

    /**
     * THE STEER MAY NOT TURN A SURFACE INSIDE OUT. CONTRACT §9.
     *
     * A bent normal is the mean unoccluded direction of the hemisphere the bake
     * integrated, and that hemisphere is about UP — not about this surface. For
     * a road the two agree; for a wall they are 90° apart and the steer is a
     * correction; for a SOFFIT they are opposite, and
     * mix(down, up, 0.55) = 0.10 of up — normalised, straight up. Every
     * downward-facing surface in the city was therefore sampling the environment
     * at the zenith and multiplying it by a visibility term that is 1.0 for a
     * downward normal by construction. At noon that is the full sky, arriving
     * through a concrete slab.
     *
     * That is why the elevated deck's underside rendered pale, and it is not a
     * property of the analytic default: the baked field does the same thing,
     * because both hand back a bent normal of up and the bug is in what is done
     * with it. Sessions 3 and 4 both looked at the frame and read it as "the
     * default has no notion of a downward-facing surface". Half true — one line
     * further down, neither does the steer.
     *
     * Ramped rather than clamped, and over a band that ends at zero: anything
     * whose normal is on the same side as the bent normal steers exactly as it
     * did before, so no road and no wall in the project changes. Only surfaces
     * that face away from it — which had no business steering toward it — stop.
     */
    float noctisSteerAgree = dot(noctisBentView, geometryNormal);
    float noctisSteerAmt = 0.55 * uNoctisIndirect * smoothstep(-0.45, 0.0, noctisSteerAgree);
    vec3 noctisSteered = normalize(mix(geometryNormal, noctisBentView, noctisSteerAmt));
    iblIrradiance += getIBLIrradiance( noctisSteered ) * noctisVisN;
  #endif

  if (uNoctisIndirect > 0.0) {
    vec3 noctisBounce = vec3(0.0);
    vec3 axes[4];
    axes[0] = vec3( 1.0, 0.0, 0.0);
    axes[1] = vec3(-1.0, 0.0, 0.0);
    axes[2] = vec3( 0.0, 0.0, 1.0);
    axes[3] = vec3( 0.0, 0.0,-1.0);
    for (int i = 0; i < 4; i++) {
      // A facade's light arrives from the direction opposite its outward
      // normal, tilted up by the mean elevation of a wall seen from a street.
      // The 1.414 puts an up-facing surface — the case the field is baked for —
      // back at unity.
      vec3 wdir = normalize(-axes[i] + vec3(0.0, 1.0, 0.0));
      float w = clamp(dot(noctisWn, wdir) * 1.41421356, 0.0, 1.0);
      noctisBounce += uNoctisFaceL[i] * (gNoctisFaces[i] * w);
    }

    // The ground. The sky LUT's lower hemisphere carries only the artificial
    // street lighting (sky.js), so by day every downward-facing surface in the
    // scene was lit by nothing at all — soffits, spandrel undersides, the
    // underside of every canopy and sign. This is the term that was missing.
    float noctisFaceTotal = dot(gNoctisFaces, vec4(1.0));
    float noctisGroundFrac = clamp(0.5 - 0.5 * noctisWn.y, 0.0, 1.0) * (1.0 - 0.5 * noctisFaceTotal);
    noctisBounce += uNoctisGroundL * noctisGroundFrac;

    iblIrradiance += noctisBounce * PI;
  }

#endif

#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )

  float noctisNoV = clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0);
  float noctisSpecOcc = noctisSpecularOcclusion(noctisNoV, noctisVisN, material.roughness);

  /**
   * What the reflection is a reflection *of*.
   *
   * A standing camera sees the road at 82 to 88 degrees of incidence, and at
   * those angles Fresnel takes a dielectric most of the way to a mirror no
   * matter how rough it is. So most of what the road contributes to the frame
   * is a reflection — and the only thing available to reflect is the
   * environment map, which is the sky and nothing else. The reflected ray off a
   * grazing view does not go up to the zenith; it goes out along the street at
   * a few degrees above horizontal, straight into the building opposite. The
   * renderer was answering "sky" to a question whose answer is "wall", and it
   * was doing it over the whole lower half of the frame.
   *
   * That is the last of the noon road's blue, and it is the half that
   * attenuating the reflection could never fix: darkening the wrong colour
   * leaves the wrong colour. It has to be *substituted*.
   *
   * The field already knows the answer. The face buckets give the area-weighted
   * mean radiance of the surrounding walls, and how much of the reflected lobe
   * lands on wall rather than sky follows from how horizontal the reflected ray
   * is and how enclosed the point is. Look straight down at the road and it
   * mirrors the zenith; look along it and it mirrors the street.
   *
   * This is also what puts the facades and the signs into wet asphalt at night,
   * where the sky is nearly black and the street is not.
   */
  vec3 noctisWallL = vec3(0.0);
  float noctisWallArea = dot(gNoctisFaces, vec4(1.0));
  if (noctisWallArea > 1e-4) {
    for (int i = 0; i < 4; i++) noctisWallL += uNoctisFaceL[i] * gNoctisFaces[i];
    noctisWallL /= noctisWallArea;
  }
  vec3 noctisReflW = uNoctisViewRotInv * normalize(reflect(-geometryViewDir, geometryNormal));
  float noctisWallShare =
    (1.0 - noctisSkyVis) * smoothstep(0.55, 0.02, noctisReflW.y) * uNoctisIndirect;

  #ifdef USE_ANISOTROPY
    vec3 noctisEnvSpec = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy ) * noctisSpecOcc;
  #else
    vec3 noctisEnvSpec = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness ) * noctisSpecOcc;
  #endif
  vec3 noctisReflected = mix(noctisEnvSpec, noctisWallL, noctisWallShare);

  /**
   * And the third answer, where there is water: the actual geometry.
   *
   * The wall radiance above is the area-weighted *mean* of the surrounding
   * facades, which is the right answer for a rough surface and the wrong one
   * for a mirror. A mirror does not reflect the average of a facade, it
   * reflects the lit window at 14 m and the dark wall beside it, and at
   * midnight the difference between those two is the difference between a road
   * with a street in it and a road with a colour on it.
   *
   * Gated on STANDING WATER rather than on roughness alone, and rather than on
   * the film: the pond is the mirror. A wall in the rain carries a film and is
   * darker and glossier for it, but a single mirror ray off a vertical surface
   * is a different question with a different cost — it would put the march on
   * most of the screen rather than on the road — and it should be answered
   * with a frame in front of you. Glass and chrome are excluded by the same
   * clause, for the same reason.
   */
  if (uNoctisSSR.x > 0.0 && gNoctisWetPond > 0.05 && material.roughness < uNoctisSSR.w) {
    NoctisHit noctisHit = noctisSSR(vNoctisWorldPos, noctisReflW, material.roughness);
    noctisReflected = mix(noctisReflected, noctisHit.color, noctisHit.weight * uNoctisSSR.x * gNoctisWetPond);
  }

  radiance += noctisReflected;

  #ifdef USE_CLEARCOAT
    clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness ) * noctisSpecOcc;
  #endif

#endif
`;

  function onBeforeCompile(shader) {
    for (const key of Object.keys(shared)) shader.uniforms[key] = shared[key];

    /**
     * PER MATERIAL, NOT SHARED. §5.11.
     *
     * A previous-frame transform belongs to an object, and `shared` is one
     * object handed to every material — putting it there would give the whole
     * city whichever mover happened to write last. `this` is the material,
     * because three calls `material.onBeforeCompile(shader, renderer)` as a
     * method; the uniform is parked on `userData` so a caller can reach it
     * without waiting for a compile that may already have happened.
     *
     * The default is the identity, which makes the motion exactly zero. Every
     * material in the project takes that path today.
     */
    const prev =
      this.userData.noctisPrevDelta ||
      (this.userData.noctisPrevDelta = { value: new THREE.Matrix4() });
    shader.uniforms.uNoctisPrevDelta = prev;

    shader.vertexShader = (VERTEX_PARS + shader.vertexShader)
      .replace('#include <color_vertex>', `#include <color_vertex>\n${GARMENT_VERTEX}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${GAIT_VERTEX}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${VERTEX_FRAGMENT}`);

    shader.fragmentShader = (MOTION_PARS + MOTION_INSTANCED_PARS + FRAGMENT_PARS + shader.fragmentShader)
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>\n${SURFACE_FRAGMENT}`
      )
      /**
       * §5.13. After three has built `normal` and after any normal map has had
       * its say, because on water there is no normal map and the wave IS the
       * normal. Inert on every material without `NOCTIS_WATER`.
       */
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>\n${WATER_NORMAL}`
      )
      /**
       * Per-instance emissive tint.
       *
       * three multiplies `instanceColor` into `diffuseColor` for us, and does
       * not touch the emissive — so without this, a thousand windows at four
       * brightnesses would be four materials and four draw calls per chunk.
       * With it they are one material, one draw call, and `instanceColor`
       * carries both the glass colour and how brightly that particular window is
       * lit. An unlit window is the same instance with a near-zero tint.
       *
       * Guarded on USE_COLOR, which three defines exactly when `vColor` exists.
       * Every material in the project that has an emissive today has no
       * instanceColor, so this is inert on all of them — verified by compiling
       * the facade material and reading the source back, because "three defines
       * USE_COLOR here" is a claim about three's internals and those are not a
       * contract.
       */
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
#ifdef USE_COLOR
  totalEmissiveRadiance *= vColor;
#endif`
      )
      .replace(
        '#include <lights_fragment_begin>',
        `#include <lights_fragment_begin>\n${CLUSTER_FRAGMENT}`
      )
      .replace('#include <lights_fragment_maps>', CANYON_MAPS)
      .replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>\n${HAZE_FRAGMENT}\n${MOTION_FRAGMENT}`
      );
  }

  /**
   * @param material            a MeshStandardMaterial/MeshPhysicalMaterial, or an array
   * @param {object} [opts]
   * @param {boolean} [opts.prevInstance]  compile the CONTRACT §5.12 per-instance
   *        motion path. The mesh must then carry a `noctisPrevInstanceMatrix`
   *        InstancedBufferAttribute on its GEOMETRY (not on the mesh: three
   *        resolves program attributes out of `geometry.attributes` and
   *        object-level fallbacks exist only for `instanceMatrix` and
   *        `instanceColor`), and the geometry must be cloned per mesh because
   *        instance attributes live on it. Setting this on a material whose
   *        meshes do not supply the attribute reads four columns of (0,0,0,1),
   *        which is singular.
   * @param {boolean} [opts.grime]  compile the session-9 vehicle grime path.
   *        The mesh's geometry then carries `noctisGrimeV` (per-vertex curve)
   *        and `noctisGrime` (per-instance strength); a geometry supplying
   *        neither reads 0 and gets no grime, which is safe — a float's unbound
   *        default is 0, unlike the mat4 above.
   */
  function patch(material, opts = {}) {
    if (!material) return material;
    const mats = Array.isArray(material) ? material : [material];
    for (const m of mats) {
      if (!m) continue;
      if (patched.has(m)) {
        // Idempotent, EXCEPT for turning the per-instance path on: a material
        // patched plainly and later handed to an instanced mover needs the
        // define and a recompile, and silently keeping the old program is how
        // a motion vector becomes zero for a reason nobody can see.
        if (opts.prevInstance && m.defines && !m.defines.NOCTIS_PREV_INSTANCE) {
          m.defines.NOCTIS_PREV_INSTANCE = '1';
          m.needsUpdate = true;
        }
        if (opts.grime && m.defines && !m.defines.NOCTIS_GRIME) {
          m.defines.NOCTIS_GRIME = '1';
          m.needsUpdate = true;
        }
        if (opts.gait && m.defines && !m.defines.NOCTIS_GAIT) {
          m.defines.NOCTIS_GAIT = '1';
          m.needsUpdate = true;
        }
        if (opts.garment && m.defines && !m.defines.NOCTIS_GARMENT) {
          m.defines.NOCTIS_GARMENT = '1';
          m.needsUpdate = true;
        }
        if (opts.water && m.defines && !m.defines.NOCTIS_WATER) {
          m.defines.NOCTIS_WATER = '1';
          m.needsUpdate = true;
        }
        continue;
      }
      if (!m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial) {
        // Unlit and custom materials have no lights_fragment_begin to inject
        // into. Silently doing nothing would be worse than saying so.
        console.warn(`[noctis] lights.patch: ${m.type} has no clustered lighting hook — skipped`);
        continue;
      }
      m.defines = m.defines || {};
      m.defines.NOCTIS_MAX_CLUSTER_LIGHTS = String(cfg.maxPerCluster);
      // Compile-time, so the loops unroll to a fixed cost. A step count that
      // could change at runtime is a step count nobody can budget.
      // Open water marches further, on more steps, so its first step stays the
      // road's length. See SSR.waterMaxDistance for both derivations.
      m.defines.NOCTIS_SSR_STEPS = String(opts.water ? SSR.waterSteps : SSR.steps);
      m.defines.NOCTIS_SSR_REFINE = String(SSR.refineSteps);
      if (opts.prevInstance) m.defines.NOCTIS_PREV_INSTANCE = '1';
      // Forks its own program through three's cache key, exactly as
      // NOCTIS_PREV_INSTANCE does (§5.12) — the shared custom key does not
      // collapse materials whose defines differ.
      if (opts.grime) m.defines.NOCTIS_GRIME = '1';
      /**
       * Session 10's pedestrian gait. Forks its own program the same way, and
       * the mesh's geometry must then carry `noctisLimb` (per-vertex) and
       * `noctisGait` (per-instance). Both are safe to be absent — a float's
       * unbound generic attribute default is 0, so a geometry supplying
       * neither has zero shear about a pivot at zero with zero amplitude, and
       * every term of the displacement is exactly zero. That is the
       * `noctisRough` argument rather than the `mat4` one.
       */
      if (opts.gait) m.defines.NOCTIS_GAIT = '1';
      /**
       * Session 10's two-colour select. The geometry must then carry
       * `noctisGarmentMask` (per-vertex) and `noctisBodyColor` /
       * `noctisGarment` (per-instance). Absent, all three read 0 and every
       * fragment goes black — which is loud, and is the `vertexColors`
       * argument rather than the `noctisRough` one: a colour has no safe
       * default because 0 is a legal colour.
       */
      /**
       * Session 10's two-colour select, DECOUPLED FROM THE GAIT IN SESSION 14.
       * It was guarded on both defines because the only mesh that had ever
       * wanted it also walked, and `noctisLimb` was declared under the gait —
       * so a stall wanting a per-pitch awning colour would have had to declare
       * itself a pedestrian. The mask is a PART LABEL and a part label has
       * nothing to do with walking. `noctisLimb` is now declared under either
       * define and the select under this one alone.
       */
      if (opts.garment) m.defines.NOCTIS_GARMENT = '1';
      /**
       * Session 15's open water. Forks its own program the same way the four
       * above do, and it is the ONE material in the project that gets it: three
       * sines, three cosines and two screen-space derivatives per fragment on a
       * surface that can fill half the frame is a cost the city's million
       * triangles must never compile, let alone pay.
       *
       * The geometry needs nothing. Unlike `gait`, `grime` and `prevInstance`
       * this define adds no attribute and no varying — the wave is a function of
       * `vNoctisWorldPos`, which every patched material already carries.
       */
      if (opts.water) m.defines.NOCTIS_WATER = '1';
      m.onBeforeCompile = onBeforeCompile;
      // All patched materials share one injection, so they share one program
      // cache key and three does not recompile per material.
      m.customProgramCacheKey = () => 'noctis-clustered';
      m.needsUpdate = true;
      patched.add(m);
    }
    return material;
  }

  // -------------------------------------------------------------------------
  // cluster assignment

  const vView = new THREE.Vector3();
  const vDir = new THREE.Vector3();
  const vAlong = new THREE.Vector3();
  const vAxis = new THREE.Vector3();
  const corner = new THREE.Vector4();

  /**
   * How much of the frustum a light claims, and why a headlight was claiming
   * 4.4× more of it than it lights.
   *
   * Until this session every light was bounded by a sphere of `radius` centred
   * on the light, which is exact for a point light and wildly conservative for
   * a spot: a beam is a spherical SECTOR, and the sphere that circumscribes a
   * sector of range R and half-angle θ has radius R/(2·cos θ) centred
   * R/(2·cos θ) along the axis — not R centred at the apex.
   *
   * The saving is a ratio of volumes and it goes as the cube:
   *
   *     (R / (2·cos θ))³ / R³  =  1 / (8·cos³θ)
   *
   * and for the headlight bound this session budgets against — a 70° beam, so
   * θ = 35° — that is 1/(8 × 0.81915³) = 1/(8 × 0.54952) = 1/4.396, i.e.
   * **4.40× fewer froxels claimed at zero content cost**. cos 35° = 0.81915;
   * both numbers are here rather than only the ratio, per CONTRACT §9 rule 4.
   *
   * It is a win for every θ < 60° and a loss above it, because at 60° exactly
   * R/(2·cos 60°) = R and the two spheres coincide; `CLUSTER.coneBoundMaxHalfAngle`
   * is that crossover. The street lantern's outer cone is wider than the
   * crossover for some fixtures and narrower for others, so this is applied by
   * measurement of θ and never by light kind.
   *
   * CONSERVATIVE IN THE DIRECTION THAT MATTERS. The bound sphere reaches
   * R/cos θ along the axis — 1.22 R at 35° — which is FURTHER than the light's
   * own radius. That is empty space, not extra light: the sector's own farthest
   * point is still at R, so the visibility pre-cull above stays on `l.radius`,
   * which is both correct and tighter. Bounding and culling are two questions
   * and they take two radii.
   *
   * Returns the bound in view space, into the four scratch fields on `out`.
   */
  function boundSphere(v, l, view, out) {
    out.x = v.vx;
    out.y = v.vy;
    out.z = v.vz;
    out.r = l.radius;
    if (!coneBound) return;
    if (l.type !== 'spot') return;
    if (!(l.coneOuter < cfg.coneBoundMaxHalfAngle)) return;
    const c = l.radius / (2 * Math.cos(l.coneOuter));
    // The beam axis in view space. `l.direction` points the way the light
    // shines; `vDir` in the write block below is its negation, which is three's
    // convention for the shader and is the wrong sign to walk along here.
    vAxis.copy(l.direction).transformDirection(view);
    out.x = v.vx + vAxis.x * c;
    out.y = v.vy + vAxis.y * c;
    out.z = v.vz + vAxis.z * c;
    out.r = c;
  }

  /** Reused; `assign` runs every frame and must not allocate. */
  const bound = { x: 0, y: 0, z: 0, r: 0 };

  function assign(ctx) {
    const camera = ctx.camera;
    const view = camera.matrixWorldInverse;
    const proj = camera.projectionMatrix;

    for (let i = 0; i < numClusters; i++) buckets[i].length = 0;

    const near = cfg.near;
    const far = cfg.far;
    const invLog = 1 / Math.log(far / near);

    // Nearest first, so an overflow drops the lights that matter least.
    const visible = [];
    for (let i = 0; i < lights.length; i++) {
      const l = lights[i];
      if (!l.enabled || l.intensity <= 0) continue;
      vView.copy(l.position).applyMatrix4(view);
      const depth = -vView.z;
      if (depth + l.radius < near) continue;
      if (depth - l.radius > far) continue;
      visible.push({ l, index: i, vx: vView.x, vy: vView.y, vz: vView.z, depth });
    }
    visible.sort((a, b) => a.depth - b.depth);

    let written = 0;
    let overflow = false;
    let slot = 0;

    for (const v of visible) {
      if (slot >= cfg.maxLights) {
        overflow = true;
        break;
      }
      const l = v.l;
      // The sector's circumscribing sphere for a narrow spot, the light's own
      // radius sphere for everything else. See boundSphere().
      boundSphere(v, l, view, bound);
      const r = bound.r;
      const bDepth = -bound.z;

      // Screen-space extent from the sphere's AABB, clipped to z <= -near.
      // Clipping first is what keeps a lamp the camera is standing under from
      // claiming every tile on screen: perspective projection is a projective
      // map, so as long as every corner is in front of the near plane, the
      // image of the box is the convex hull of the images of its corners.
      let minX = 1e9;
      let maxX = -1e9;
      let minY = 1e9;
      let maxY = -1e9;

      const zFarSide = bound.z - r;
      const zNearSide = Math.min(bound.z + r, -near);

      for (let c = 0; c < 8; c++) {
        const px = bound.x + (c & 1 ? r : -r);
        const py = bound.y + (c & 2 ? r : -r);
        const pz = c & 4 ? zNearSide : zFarSide;
        corner.set(px, py, pz, 1).applyMatrix4(proj);
        const iw = 1 / Math.max(corner.w, 1e-6);
        const nx = corner.x * iw;
        const ny = corner.y * iw;
        if (nx < minX) minX = nx;
        if (nx > maxX) maxX = nx;
        if (ny < minY) minY = ny;
        if (ny > maxY) maxY = ny;
      }

      const tx0 = Math.max(0, Math.floor((minX * 0.5 + 0.5) * cfg.tilesX));
      const tx1 = Math.min(cfg.tilesX - 1, Math.floor((maxX * 0.5 + 0.5) * cfg.tilesX));
      const ty0 = Math.max(0, Math.floor((minY * 0.5 + 0.5) * cfg.tilesY));
      const ty1 = Math.min(cfg.tilesY - 1, Math.floor((maxY * 0.5 + 0.5) * cfg.tilesY));
      if (tx1 < tx0 || ty1 < ty0) continue;

      const dNear = Math.max(near, bDepth - r);
      const dFar = Math.min(far, bDepth + r);
      if (dFar < dNear) continue;
      const s0 = Math.max(0, Math.floor(Math.log(dNear / near) * invLog * cfg.slicesZ));
      const s1 = Math.min(cfg.slicesZ - 1, Math.floor(Math.log(dFar / near) * invLog * cfg.slicesZ));

      // Write the light's data at its compacted slot.
      //
      // TEXEL 0 IS THE LIGHT, NOT THE BOUND, AND THAT SENTENCE IS THE WHOLE OF
      // CONTRACT §9 ROW 17. xyz is the light's own view position and w is the
      // radius the SHADER culls and attenuates against — `if (lDist > d0.w)
      // continue` and `getDistanceAttenuation(lDist, d0.w, 2.0)` below, both
      // measured from d0.xyz. `bound.r` is a different quantity about a
      // different sphere: it is the radius of the sphere CIRCUMSCRIBING the
      // beam's sector, centred `bound.xyz` which is R/(2·cos θ) along the axis
      // and not here. Writing it into w paired a radius with the wrong centre.
      //
      // WHAT IT COST, IN THE UNITS THE BUG WAS IN. For a spot at the budgeted
      // headlight half-angle of 35°, bound.r = R/(2·cos 35°) = 0.6104·R, so a
      // declared 30 m throw was culled at 18.31 m — 61% of it — and the
      // Frostbite window `saturate(1 − (d/cutoff)⁴)²` bit 2.7× earlier: at
      // 15 m it delivered (1 − (15/18.31)⁴)² = 0.302 where the correct cutoff
      // gives (1 − 0.5⁴)² = 0.879. A beam that reached 61% as far and was
      // three times dimmer in its own middle distance.
      //
      // NOTHING CAUGHT IT AND NOTHING COULD HAVE. `boundSphere` is only
      // entered for a spot narrower than the 60° crossover, and until this
      // session the only such lights in existence were `harness.saturateTraffic`'s
      // placeholders — whose own comment says the instrument "measures froxels,
      // not photons". Every street lantern is 68° and returns early. So the
      // defect was invisible in every delivered frame and would have shipped
      // inside the first real headlight, as a beam that looked short rather
      // than as a bug. It also means `setConeBound(false)` was changing
      // CONTENT and not only occupancy, which is not what an A/B may do.
      //
      // Froxel assignment is unaffected: the AABB and the depth slices above
      // still use `bound`, so 4a's measured margin of 21 stands unchanged.
      const base = slot * TEXELS_PER_LIGHT * 4;
      lightArr[base + 0] = v.vx;
      lightArr[base + 1] = v.vy;
      lightArr[base + 2] = v.vz;
      lightArr[base + 3] = l.radius;
      lightArr[base + 4] = l.color[0] * l.intensity;
      lightArr[base + 5] = l.color[1] * l.intensity;
      lightArr[base + 6] = l.color[2] * l.intensity;
      lightArr[base + 7] = l.type === 'spot' ? 1 : 0;
      if (l.type === 'spot') {
        // three's convention: the stored axis points from the target back to
        // the light, because the shader dots it with the fragment→light vector.
        vDir.copy(l.direction).negate().transformDirection(view).normalize();
        lightArr[base + 8] = vDir.x;
        lightArr[base + 9] = vDir.y;
        lightArr[base + 10] = vDir.z;
        lightArr[base + 11] = Math.cos(l.coneOuter);
        lightArr[base + 12] = Math.cos(l.coneInner);
      } else {
        lightArr[base + 8] = 0;
        lightArr[base + 9] = 0;
        lightArr[base + 10] = 1;
        lightArr[base + 11] = -1;
        lightArr[base + 12] = -1;
      }
      // Source radius, metres. The slot CONTRACT §5.6 reserved; it is what
      // gives a clustered light an angular size instead of being a delta.
      lightArr[base + 13] = l.sourceRadius;
      lightArr[base + 14] = l.alongScale;
      lightArr[base + 15] = l.acrossScale;

      /**
       * The luminaire's along-road axis, in view space, orthogonalised against
       * the beam axis here rather than in the shader.
       *
       * Once per light per frame instead of once per fragment per light, and —
       * more to the point — it is the one place the frame can be wrong, so it
       * is the one place worth looking at. A light with no `alongAxis` writes
       * a zero vector, which the shader reads as "circular", and every point
       * light in the block takes that path.
       */
      if (l.type === 'spot' && l.alongAxis) {
        vAlong.copy(l.alongAxis).transformDirection(view);
        vAlong.addScaledVector(vDir, -vAlong.dot(vDir));
        const len = vAlong.length();
        if (len > 1e-4) {
          vAlong.multiplyScalar(1 / len);
          lightArr[base + 16] = vAlong.x;
          lightArr[base + 17] = vAlong.y;
          lightArr[base + 18] = vAlong.z;
        } else {
          lightArr[base + 16] = 0;
          lightArr[base + 17] = 0;
          lightArr[base + 18] = 0;
        }
      } else {
        lightArr[base + 16] = 0;
        lightArr[base + 17] = 0;
        lightArr[base + 18] = 0;
      }
      /**
       * Cosine of the optic's peak angle; zero for a light whose maximum is on
       * its own axis. Local-light shadows will need a slot of their own — this
       * one is spoken for.
       */
      lightArr[base + 19] = l.peakCos;

      for (let sz = s0; sz <= s1; sz++) {
        const zBase = sz * numTiles;
        for (let ty = ty0; ty <= ty1; ty++) {
          const yBase = zBase + ty * cfg.tilesX;
          for (let tx = tx0; tx <= tx1; tx++) {
            const b = buckets[yBase + tx];
            if (b.length >= cfg.maxPerCluster) {
              overflow = true;
              continue;
            }
            b.push(slot);
            written++;
          }
        }
      }

      slot++;
      if (written > cfg.maxIndices - cfg.maxPerCluster) {
        overflow = true;
        break;
      }
    }

    // Flatten.
    //
    // THE OCCUPANCY IS COLLECTED HERE AND NOT DERIVED FROM `overflow`.
    // `overflow` is a boolean about the frame; the question this session has to
    // answer is a margin — how close the worst froxel came to the cap — and a
    // boolean cannot answer it. A grid that reports "did not overflow" at 96 of
    // 96 and a grid that reports it at 31 of 96 are the same boolean and
    // completely different findings, and only one of them says traffic fits.
    let cursor = 0;
    let peak = 0;
    let atCap = 0;
    for (let i = 0; i < numClusters; i++) {
      const b = buckets[i];
      if (b.length > peak) peak = b.length;
      if (b.length >= cfg.maxPerCluster) atCap++;
      gridArr[i * 4 + 0] = cursor;
      gridArr[i * 4 + 1] = b.length;
      gridArr[i * 4 + 2] = 0;
      gridArr[i * 4 + 3] = 0;
      for (let k = 0; k < b.length; k++) {
        if (cursor >= indexArr.length) {
          overflow = true;
          break;
        }
        indexArr[cursor++] = b[k];
      }
    }

    api.lightCount = slot;
    api.assignedIndices = cursor;
    api.overflow = overflow;
    api.peakOccupancy = peak;
    api.clustersAtCap = atCap;
    if (peak > api.peakOccupancyEver) api.peakOccupancyEver = peak;
    if (slot > api.lightCountEver) api.lightCountEver = slot;
    if (cursor > api.assignedIndicesEver) api.assignedIndicesEver = cursor;
    api.overflowEver = api.overflowEver || overflow;
    if (overflow) {
      ctx.warnOnce(
        'cluster-overflow',
        `clustered lighting overflowed (${lights.length} lights, ${cursor} indices) — furthest lights dropped`
      );
    }

    lightTex.needsUpdate = true;
    gridTex.needsUpdate = true;
    indexTex.needsUpdate = true;
  }

  return {
    name: 'lights',

    init(ctx) {
      lightArr = new Float32Array(cfg.maxLights * TEXELS_PER_LIGHT * 4);
      lightTex = new THREE.DataTexture(
        lightArr,
        TEXELS_PER_LIGHT,
        cfg.maxLights,
        THREE.RGBAFormat,
        THREE.FloatType
      );
      lightTex.minFilter = THREE.NearestFilter;
      lightTex.magFilter = THREE.NearestFilter;
      lightTex.needsUpdate = true;

      gridArr = new Float32Array(numClusters * 4);
      gridTex = new THREE.DataTexture(gridArr, numTiles, cfg.slicesZ, THREE.RGBAFormat, THREE.FloatType);
      gridTex.minFilter = THREE.NearestFilter;
      gridTex.magFilter = THREE.NearestFilter;
      gridTex.needsUpdate = true;

      indexTexW = 256;
      indexTexH = Math.ceil(cfg.maxIndices / indexTexW);
      indexArr = new Float32Array(indexTexW * indexTexH);
      indexTex = new THREE.DataTexture(indexArr, indexTexW, indexTexH, THREE.RedFormat, THREE.FloatType);
      indexTex.minFilter = THREE.NearestFilter;
      indexTex.magFilter = THREE.NearestFilter;
      indexTex.needsUpdate = true;

      shared.uNoctisLightData.value = lightTex;
      shared.uNoctisClusterGrid.value = gridTex;
      shared.uNoctisClusterIndices.value = indexTex;
      shared.uNoctisIndexSize.value.set(indexTexW, indexTexH);

      /**
       * A one-voxel field that says "open sky, no walls", bound from the start.
       *
       * CONTRACT rule 2: if the canyon module is quarantined, or has not baked
       * yet, every patched material still has a valid sampler3D and the scene
       * renders exactly as it did before indirect light existed. A null
       * sampler is an unbound texture unit and a driver-dependent black frame,
       * which is the opposite of what quarantine is for.
       */
      const openSky = new Uint8Array([128, 255, 128, 255]);
      defaultA = new THREE.Data3DTexture(openSky, 1, 1, 1);
      defaultA.format = THREE.RGBAFormat;
      defaultA.type = THREE.UnsignedByteType;
      defaultA.minFilter = THREE.LinearFilter;
      defaultA.magFilter = THREE.LinearFilter;
      defaultA.wrapS = defaultA.wrapT = defaultA.wrapR = THREE.ClampToEdgeWrapping;
      defaultA.needsUpdate = true;

      defaultB = new THREE.Data3DTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, 1);
      defaultB.format = THREE.RGBAFormat;
      defaultB.type = THREE.UnsignedByteType;
      defaultB.minFilter = THREE.LinearFilter;
      defaultB.magFilter = THREE.LinearFilter;
      defaultB.wrapS = defaultB.wrapT = defaultB.wrapR = THREE.ClampToEdgeWrapping;
      defaultB.needsUpdate = true;

      shared.uNoctisCanyonA.value = defaultA;
      shared.uNoctisCanyonB.value = defaultB;

      /**
       * A 1×1 "there is only sky out there" reflection source, bound from the
       * start, for the same reason as the one-voxel canyon field above: before
       * the first frame exists, and if `post` is ever quarantined, every
       * patched material still has a bound sampler. An unbound sampler unit is
       * a driver-dependent black frame, which is the opposite of what
       * quarantine is for. Its depth channel is the sky sentinel, so even if
       * something did march against it, no ray could report a hit.
       */
      defaultSSR = new THREE.DataTexture(
        new Float32Array([0, 0, 0, SSR.skyDepth]),
        1,
        1,
        THREE.RGBAFormat,
        THREE.FloatType
      );
      defaultSSR.minFilter = THREE.LinearFilter;
      defaultSSR.magFilter = THREE.LinearFilter;
      defaultSSR.needsUpdate = true;
      shared.uNoctisSSRSource.value = defaultSSR;

      shared.uNoctisWet.value = Math.max(0, Math.min(1, Number(ctx.config.wet) || 0));
      if (ctx.config.ssr !== undefined && Number(ctx.config.ssr) === 0) ssrStrength = 0;

      /**
       * The froxel lookup divides `gl_FragCoord.xy` by the screen size, so this
       * has to be the size of the target the scene is actually drawn into — the
       * internal render resolution (§5.10), which since session 4 is not the
       * drawing buffer. Getting it from the drawing buffer would compress every
       * cluster into the lower-left corner of the frame by exactly the upscale
       * factor: lights would be assigned to the wrong froxels everywhere, and it
       * would look like a lighting bug rather than an arithmetic one.
       *
       * `post` announces it, because `post` owns the buffer. The drawing buffer
       * is the fallback for the case where `post` is quarantined and the core is
       * drawing the scene straight to the framebuffer at its full size — where
       * it is then the correct answer.
       */
      const setScreen = (size) => {
        if (size && size.width) shared.uNoctisScreen.value.set(size.width, size.height);
        else shared.uNoctisScreen.value.copy(ctx.renderer.getDrawingBufferSize(new THREE.Vector2()));
      };
      setScreen();
      ctx.on('resize', () => setScreen());
      ctx.on('post:internal', setScreen);

      api.add = (def) => {
        const light = {
          position: new THREE.Vector3().copy(def.position),
          color: def.color || [1, 1, 1],
          intensity: def.intensity != null ? def.intensity : 1,
          radius: def.radius != null ? def.radius : 12,
          type: def.type || 'point',
          direction: new THREE.Vector3(0, -1, 0).copy(def.direction || new THREE.Vector3(0, -1, 0)).normalize(),
          coneOuter: def.coneOuter != null ? def.coneOuter : Math.PI / 4,
          coneInner: def.coneInner != null ? def.coneInner : Math.PI / 6,
          /**
           * Radius of the emitting surface, metres. Not a falloff radius —
           * that is `radius`. This is how big the thing actually is, and it
           * sets how wide its reflection is in a smooth surface. Zero gives
           * the old punctual behaviour.
           */
          sourceRadius: def.sourceRadius != null ? def.sourceRadius : 0,
          /**
           * The luminaire's angular distribution, as two transverse scales
           * about `alongAxis` (see LUMINAIRE in constants). Omitting `alongAxis`
           * leaves the light circular, which is what every bulb, shopfront and
           * sign in the block is — only a street lantern has an optic.
           */
          alongAxis: def.alongAxis ? new THREE.Vector3().copy(def.alongAxis).normalize() : null,
          alongScale: def.alongScale != null ? def.alongScale : 1,
          acrossScale: def.acrossScale != null ? def.acrossScale : 1,
          /**
           * Cosine of the angle from the axis at which the optic reaches its
           * peak candela. Zero — the default — is a source whose maximum is on
           * its own axis, which is what a bulb behind a shop window is.
           */
          peakCos: def.peakAngle != null ? Math.cos(def.peakAngle) : 0,
          /**
           * What this light is for, as a string its owner chose. Not used by
           * the shader and not used by assignment — it exists so a gate can ask
           * "how many traffic lights are in this world" and get an answer from
           * the world rather than from a count somebody maintained alongside it.
           *
           * Unset today on every light in the project, which is the correct
           * answer: nothing has declared itself traffic, and the assertion that
           * reads it is red for that reason.
           */
          role: def.role || null,
          enabled: def.enabled !== false,
        };
        lights.push(light);
        return light;
      };

      api.remove = (light) => {
        const i = lights.indexOf(light);
        if (i >= 0) lights.splice(i, 1);
      };

      api.patch = patch;
      api.all = () => lights;
      /** How many live lights declare themselves `role`. See `add`. */
      api.countByRole = (role) => lights.reduce((n, l) => n + (l.role === role && l.enabled ? 1 : 0), 0);

      /**
       * The whole pool, broken down by the role each light declared.
       *
       * `countByRole` answers one question about one role and counts only
       * ENABLED lights, which is right for "how many headlamps are lit" and
       * wrong for "who is holding the pool". This answers the second: every
       * light, enabled or parked, grouped, plus the ones that declared nothing.
       *
       * `unrolled` is the number that matters. A slot with a null role is a
       * slot nobody is accountable for, and the pool filling up is the failure
       * that arrives with no name attached to it — the same shape as an
       * InstancedMesh with no census label. `tools/budget.json` -> lightRoles
       * requires it to be zero.
       */
      api.roleCensus = () => {
        const byRole = {};
        const enabledByRole = {};
        let unrolled = 0;
        for (const l of lights) {
          if (!l.role) { unrolled++; continue; }
          byRole[l.role] = (byRole[l.role] || 0) + 1;
          if (l.enabled) enabledByRole[l.role] = (enabledByRole[l.role] || 0) + 1;
        }
        return { total: lights.length, unrolled, byRole, enabledByRole, maxLights: cfg.maxLights };
      };
      /**
       * The grid's own dimensions and caps, so a gate never has to hardcode
       * them. A budget written against a number the code does not report is a
       * budget that verifies the budget — §9's new entry, one file over.
       */
      api.clusterConfig = () => ({
        tilesX: cfg.tilesX,
        tilesY: cfg.tilesY,
        slicesZ: cfg.slicesZ,
        clusters: numClusters,
        maxLights: cfg.maxLights,
        maxPerCluster: cfg.maxPerCluster,
        maxIndices: cfg.maxIndices,
      });
      /**
       * Start a new measurement window. Called by the gate immediately before a
       * route so the high-watermarks describe that route and not the warmup.
       */
      /**
       * The previous frame's un-jittered view-projection, from `post`, which
       * owns it. §5.11. Called once per frame immediately before the scene
       * pass; see the comment at the call site for why the ordering is the
       * whole of the correctness argument.
       */
      api.setPrevViewProj = (m) => { shared.uNoctisPrevViewProj.value.copy(m); };
      /** The A side of the cone-bound A/B. Not a shipping mode — see `coneBound`. */
      api.setConeBound = (on) => { coneBound = !!on; };
      api.getConeBound = () => coneBound;
      api.resetClusterPeaks = () => {
        api.peakOccupancyEver = 0;
        api.lightCountEver = 0;
        api.assignedIndicesEver = 0;
        api.overflowEver = false;
      };
      /** For session 4's weather: rain and fog thicken the same layer. */
      api.setHaze = (density, scaleHeight) => {
        shared.uNoctisHaze.value.set(density, scaleHeight);
      };
      api.resetHaze = () => shared.uNoctisHaze.value.set(ATM.hazeDensity, ATM.hazeScaleHeight);
      /** The canyon openness the in-scatter is scaled by. One measured number. */
      api.setHazeOpenness = (v) => { shared.uNoctisHazeOpen.value = Math.min(1, Math.max(0.05, v)); };

      /**
       * Bind a baked canyon field. Called by the `canyon` module, which owns
       * the bake; this module owns the shader the field is read from, and the
       * two never import each other (CONTRACT §2.2).
       */
      api.setCanyonField = (field) => {
        const [nx, nz, ny] = field.dims;
        const mk = (data) => {
          const t = new THREE.Data3DTexture(data, nx, nz, ny);
          t.format = THREE.RGBAFormat;
          t.type = THREE.UnsignedByteType;
          t.minFilter = THREE.LinearFilter;
          t.magFilter = THREE.LinearFilter;
          t.wrapS = t.wrapT = t.wrapR = THREE.ClampToEdgeWrapping;
          t.needsUpdate = true;
          return t;
        };
        if (canyonA) canyonA.dispose();
        if (canyonB) canyonB.dispose();
        canyonA = mk(field.skyBent);
        canyonB = mk(field.faces);
        shared.uNoctisCanyonA.value = canyonA;
        shared.uNoctisCanyonB.value = canyonB;
        shared.uNoctisCanyonMin.value.set(...field.bounds.min);
        shared.uNoctisCanyonInvSpan.value.set(
          1 / (field.bounds.max[0] - field.bounds.min[0]),
          1,
          1 / (field.bounds.max[2] - field.bounds.min[2])
        );
        shared.uNoctisCanyonYMax.value = field.yMax;
        shared.uNoctisCanyonVoxel.value = field.voxelXZ * 0.75;
      };

      /**
       * Bind the streamed chunk field. CONTRACT §11.
       *
       * Two `DataArrayTexture`s and a slot table, all owned by `canyon`, all
       * read here — the same split as `setCanyonField` above and for the same
       * reason: this module owns the one material injection, and nothing else
       * may touch it.
       */
      api.setChunkField = (binding) => {
        if (!binding) {
          shared.uNoctisChunkGrid.value.w = 0;
          return;
        }
        shared.uNoctisChunkA.value = binding.arrayA;
        shared.uNoctisChunkB.value = binding.arrayB;
        shared.uNoctisChunkSlots.value = binding.slots;
        shared.uNoctisChunkParams.value.set(
          binding.chunkSize, binding.margin, binding.slices, binding.height
        );
        shared.uNoctisChunkGrid.value.set(
          binding.slotGrid, 1 / binding.slotGrid, binding.slotCount, 1
        );
      };

      /**
       * The two numbers the analytic default is computed from: the canyon's
       * half-width and its mean facade height. Measured off the city the
       * generator actually placed, not authored — the default's whole job is to
       * agree with the bake about the average.
       */
      /**
       * The analytic default's calibration. Three numbers, two of them measured
       * off the block's own baked field and one derived from the first — see
       * `noctisDefaultField` for why the third one had to exist.
       */
      api.setFieldDefault = (halfWidth, meanHeight, facadeVis) => {
        shared.uNoctisFieldDefault.value.set(
          Math.max(1, halfWidth),
          Math.max(2, meanHeight),
          Math.min(1, Math.max(0.04, facadeVis))
        );
      };

      /**
       * Bytes of GPU texture this module owns. Exact: every one of these is an
       * allocation made here from a size that is known here.
       */
      api.bytes = () => {
        let n = 0;
        if (lightTex) n += lightTex.image.width * lightTex.image.height * 16;
        if (gridTex) n += gridTex.image.width * gridTex.image.height * 16;
        if (indexTex) n += indexTex.image.width * indexTex.image.height * 4;
        // The origin block's field, both 3D textures.
        if (canyonA && canyonA.image) {
          n += canyonA.image.width * canyonA.image.height * canyonA.image.depth * 4 * 2;
        }
        return n;
      };

      /**
       * The four facade radiances and the ground radiance, in cd/m², linear.
       * Recomputed on the CPU whenever the sky is rebuilt — which is the entire
       * per-frame cost of the indirect light.
       */
      api.setCanyonLight = (faceL, groundL) => {
        for (let i = 0; i < 4; i++) {
          shared.uNoctisFaceL.value[i].set(faceL[i][0], faceL[i][1], faceL[i][2]);
        }
        shared.uNoctisGroundL.value.set(groundL[0], groundL[1], groundL[2]);
      };

      api.setWetness = (v) => {
        shared.uNoctisWet.value = Math.max(0, Math.min(1, v));
      };
      api.getWetness = () => shared.uNoctisWet.value;

      /** Bisecting switch. Zero restores the session 1 lighting exactly. */
      api.setIndirect = (on) => {
        shared.uNoctisIndirect.value = on ? 1 : 0;
      };
      /**
       * The other bisecting switch. Zero restores the session 2 reflections —
       * environment map and canyon wall radiance and nothing else — which is
       * the fastest way to answer "is that a reflection or a light".
       */
      api.setSSR = (on) => {
        ssrStrength = on ? 1 : 0;
      };
      api.ssrEnabled = () => ssrStrength > 0;
      api.faceAxes = FACE_AXIS;

      return api;
    },

    update(ctx) {
      const sky = ctx.get('sky');
      if (sky) shared.uNoctisSky.value = sky.skyTexture;

      const cam = ctx.camera;
      cam.updateMatrixWorld();
      shared.uNoctisViewRotInv.value.setFromMatrix4(cam.matrixWorld);
      shared.uNoctisCamHeight.value = cam.position.y;

      /**
       * The one clock, read rather than kept. CONTRACT §3, and it is read HERE
       * — in the module that owns the material injection — rather than pushed
       * by whoever owns the water, so there is exactly one line in the project
       * that decides what `uNoctisTime` means.
       */
      const clock = ctx.get('time');
      if (clock) shared.uNoctisTime.value = clock.now;

      /**
       * The previous frame's colour-and-depth buffer, pulled from `post` rather
       * than pushed by it.
       *
       * `post` owns the render targets and this module owns the one material
       * injection, and neither imports the other (CONTRACT §2.2). Pulling here
       * also gets the timing right for free: every module's update() runs
       * before post.render(), so what is read here is always the buffer post
       * finished writing last frame, along with the camera matrices that frame
       * was drawn with.
       *
       * Before the first frame has been drawn there is nothing to read, and
       * SSR is simply off — no branch to remember, no black reflections.
       */
      const post = ctx.get('post');
      const src = post && post.ssrSource ? post.ssrSource() : null;
      if (src) {
        shared.uNoctisSSRSource.value = src.texture;
        shared.uNoctisSSRPrevViewProj.value.copy(src.viewProj);
        shared.uNoctisSSRPrevView.value.copy(src.view);
        shared.uNoctisSSR3.value.x = src.maxMip;
        shared.uNoctisSSR.value.x = ssrStrength;
      } else {
        shared.uNoctisSSR.value.x = 0;
      }

      assign(ctx);
    },

    dispose() {
      lightTex && lightTex.dispose();
      gridTex && gridTex.dispose();
      indexTex && indexTex.dispose();
      canyonA && canyonA.dispose();
      canyonB && canyonB.dispose();
      defaultA && defaultA.dispose();
      defaultB && defaultB.dispose();
      defaultSSR && defaultSSR.dispose();
      canyonA = canyonB = defaultA = defaultB = defaultSSR = null;
      lights.length = 0;
      patched.clear();
    },
  };
}
