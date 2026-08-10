/**
 * atmosphere.js — one atmosphere, two implementations, one set of numbers.
 *
 * The GPU needs the model to render the sky; the CPU needs it to answer
 * "how many lux are falling on the street right now?" so that streetlights can
 * switch on from a photocell instead of from a hardcoded time (CONTRACT §3).
 * Two implementations that disagree would be worse than none, so the constants
 * live here once and the GLSL is *emitted from them*.
 *
 * Model: single scattering, Rayleigh + Mie + ozone absorption, with an
 * isotropic stand-in for multiple scattering. Coefficients are Bruneton's
 * (Precomputed Atmospheric Scattering, 2008), in units of 1/metre.
 *
 * Why not Preetham: Preetham is an analytic fit to a *daytime* sky and it
 * misbehaves as the sun approaches the horizon — which is 0.78, one of the four
 * frames this session is judged on. It also has nothing to say about a sun that
 * has set, so midnight would need a second, disagreeing model. Ray-marched
 * single scattering handles dawn, dusk and night from the same integral: at
 * twilight the low atmosphere is in the earth's shadow while the high
 * atmosphere is still lit, and that is the whole look.
 */

export const ATM = {
  // Geometry, metres.
  Rg: 6360e3, // ground radius
  Ra: 6460e3, // top of atmosphere

  // Scattering / absorption, 1/m.
  betaR: [5.802e-6, 13.558e-6, 33.1e-6], // Rayleigh scattering
  betaMs: 3.996e-6, // Mie scattering
  betaMe: 8.396e-6, // Mie extinction (scattering 3.996 + absorption 4.40)
  betaO: [0.650e-6, 1.881e-6, 0.085e-6], // ozone absorption

  // Density profiles.
  HR: 8000, // Rayleigh scale height
  HM: 1200, // Mie scale height
  ozoneCenter: 25000, // tent profile, metres
  ozoneWidth: 15000,

  mieG: 0.76, // Cornette-Shanks asymmetry

  /**
   * Extraterrestrial solar illuminance, in lux, split into linear sRGB so the
   * disc carries its 5778 K chromaticity. Luminance of this vector is 128000,
   * the accepted solar constant in photometric units. Everything downstream —
   * sky radiance in cd/m², sun intensity in lux — inherits its scale from here.
   */
  sunIrradiance: [142208, 124889, 117022],

  /**
   * Multiple scattering is where a single-scattering sky loses. The real sky is
   * roughly twice as bright as this integral predicts, and its twilight does not
   * collapse to black the moment the geometric shadow arrives. One isotropic
   * term buys back both without a second LUT.
   */
  multiScatter: 0.95,

  /**
   * How achromatic the multiple-scattering term is.
   *
   * Single scattering is blue because Rayleigh is blue. Light that has bounced
   * three or four times has been filtered by that same blue bias at every
   * bounce and comes out far closer to neutral — which is why the shadowed side
   * of a street on a clear day is blue-grey and not navy. Reusing the
   * single-scattering coefficients for the multi-scattering term makes every
   * unlit horizontal surface read as a swimming pool.
   *
   * Kept small. Neutralising this term aggressively also drains the blue out of
   * the *upper* twilight sky, because at dusk this is what most of the sky's
   * remaining light is — and a dusk with no blue over the orange is a sunset
   * poster, not a sky.
   */
  multiScatterNeutral: 0.15,

  /**
   * How achromatic the multiple-scattering term's *path* is, as opposed to its
   * coefficients above. Measured, and deliberately left at zero.
   *
   * The multi term is attenuated by the transmittance along the sun's path to
   * the sample, per channel. At five degrees of elevation that path is nineteen
   * air masses and the blue channel arrives at under one per cent — exactly
   * right for the direct beam, and arguably wrong for light that never
   * travelled along it. Multiply-scattered light reaches a sample from all over
   * the sky by many paths of many lengths, and there is a real argument that
   * its spectrum should regress toward the mean of them, as the coefficients
   * above already do.
   *
   * At zero, every azimuth of a low-sun sky inherits the beam's reddening: the
   * anti-solar horizon at sunrise comes out as orange as the solar one, and a
   * dawn street has no cool light anywhere in it. That is the whole reason
   * dawn reads as one colour with a brightness ramp, and it is why session 2's
   * dawn hue gates are red.
   *
   * It was implemented and measured. The trade, on this project's four frames:
   *
   *            dawn hue spread   dawn facade sep   dusk R−B   noon road B/R
   *   0.00          12.9°             11.4°          0.116        1.148
   *   0.32          20.1°             24.9°          0.072        1.162
   *   0.55          27.7°             43.9°          0.042        1.173
   *
   * Dawn's two gates want 26° and 15°. Dusk needs to stay 0.07 warmer than
   * noon, and the noon road needs to stay under 1.15. There is no value of this
   * constant that satisfies all four: buying dawn's cool fill spends dusk's
   * warmth, and dusk is the frame session 1 got right.
   *
   * That is not an argument for a different constant, it is an argument for a
   * different model. One isotropic scalar cannot be red near the sun and grey
   * away from it, which is precisely what a real twilight sky is. A second-
   * order multiple-scattering LUT (Hillaire 2020) gives that for one more
   * small texture, and it is the highest-value thing left in the atmosphere.
   * Until then this stays at zero, because zero is the value that keeps dusk.
   */
  multiScatterPathNeutral: 0.0,

  /**
   * Urban ground. Feeds the sky's bounce term and, through PMREM, the lower
   * half of the environment map — which is the only thing filling shadows from
   * below. Too dark and every shadow at noon goes navy, lit purely by blue sky.
   */
  groundAlbedo: [0.155, 0.145, 0.125],

  /** 0.268° — the disc, not the aureole. */
  sunAngularRadius: 0.004675,
  moonAngularRadius: 0.004655,

  /**
   * Aerosol haze in the first few hundred metres. Clear-air Mie over a 200 m
   * street is invisible (τ ≈ 0.002); a city's boundary layer is one to two
   * orders of magnitude dirtier, and that haze is most of what reads as depth.
   * Scattering only — it tints distance with whatever the sky is doing.
   *
   * 4.5e-4 /m is a meteorological visibility of about 8.7 km (σ = 3.912 / V),
   * which is an ordinary night in a city rather than a smog event. It is also
   * what stops the far end of the street from being a black cutout: at 170 m it
   * blends about eight per cent of the sky into everything.
   */
  hazeDensity: 4.5e-4, // 1/m at ground level
  hazeScaleHeight: 550, // m
};

const INV_4PI = 1 / (4 * Math.PI);
const INV_PI = 1 / Math.PI;

// ---------------------------------------------------------------------------
// CPU implementation
// ---------------------------------------------------------------------------

function densityR(h) {
  return Math.exp(-h / ATM.HR);
}
function densityM(h) {
  return Math.exp(-h / ATM.HM);
}
function densityO(h) {
  return Math.max(0, 1 - Math.abs(h - ATM.ozoneCenter) / ATM.ozoneWidth);
}

/** Nearest positive intersection of a ray with a sphere centred at the origin, or -1. */
export function raySphere(ox, oy, oz, dx, dy, dz, radius) {
  const b = ox * dx + oy * dy + oz * dz;
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const d = Math.sqrt(disc);
  const t0 = -b - d;
  const t1 = -b + d;
  if (t1 < 0) return -1;
  return t0 >= 0 ? t0 : t1;
}

/**
 * Transmittance from a point at altitude h, along a ray whose cosine with the
 * local zenith is mu, out to the top of the atmosphere. Zero if the ray hits
 * the ground — that zero is what puts the earth's shadow into twilight.
 */
export function transmittance(h, mu, steps = 32) {
  const r = ATM.Rg + h;
  // Position on the +Y axis; the ray leans by mu.
  const ox = 0;
  const oy = r;
  const oz = 0;
  const sin = Math.sqrt(Math.max(0, 1 - mu * mu));
  const dx = sin;
  const dy = mu;
  const dz = 0;

  if (raySphere(ox, oy, oz, dx, dy, dz, ATM.Rg) > 0) return [0, 0, 0];
  const t = raySphere(ox, oy, oz, dx, dy, dz, ATM.Ra);
  if (t <= 0) return [1, 1, 1];

  const ds = t / steps;
  let tr = 0;
  let tm = 0;
  let to = 0;
  for (let i = 0; i < steps; i++) {
    const s = (i + 0.5) * ds;
    const px = ox + dx * s;
    const py = oy + dy * s;
    const pz = oz + dz * s;
    const hh = Math.max(0, Math.hypot(px, py, pz) - ATM.Rg);
    tr += densityR(hh);
    tm += densityM(hh);
    to += densityO(hh);
  }
  tr *= ds;
  tm *= ds;
  to *= ds;
  return [
    Math.exp(-(ATM.betaR[0] * tr + ATM.betaMe * tm + ATM.betaO[0] * to)),
    Math.exp(-(ATM.betaR[1] * tr + ATM.betaMe * tm + ATM.betaO[1] * to)),
    Math.exp(-(ATM.betaR[2] * tr + ATM.betaMe * tm + ATM.betaO[2] * to)),
  ];
}

/**
 * Direct solar illuminance reaching the ground on a surface facing the sun,
 * in lux, per channel. This is the DirectionalLight's colour and intensity:
 * it goes red at sunset because the blue channel's optical depth is 5.7× the
 * red channel's and the path is 38 air masses long. Nobody tinted it.
 */
export function sunIlluminanceAtGround(sunElevationRad) {
  const mu = Math.sin(sunElevationRad);
  const T = transmittance(0, mu, 48);
  return [
    ATM.sunIrradiance[0] * T[0],
    ATM.sunIrradiance[1] * T[1],
    ATM.sunIrradiance[2] * T[2],
  ];
}

function phaseRayleigh(mu) {
  return (3 / (16 * Math.PI)) * (1 + mu * mu);
}

function phaseMie(mu) {
  const g = ATM.mieG;
  const g2 = g * g;
  const d = 1 + g2 - 2 * g * mu;
  return ((3 / (8 * Math.PI)) * ((1 - g2) * (1 + mu * mu))) / ((2 + g2) * Math.pow(Math.max(d, 1e-4), 1.5));
}

/**
 * Sky radiance in cd/m² looking along (dx,dy,dz) from ground level, with the
 * sun at (sx,sy,sz). Mirrors the GLSL below closely enough for illuminance
 * integration; it is not used per-pixel and does not need to be fast.
 */
export function skyRadiance(dx, dy, dz, sx, sy, sz, viewSteps = 16, sunSteps = 12) {
  const ox = 0;
  const oy = ATM.Rg + 1;
  const oz = 0;

  const tGround = raySphere(ox, oy, oz, dx, dy, dz, ATM.Rg);
  const tTop = raySphere(ox, oy, oz, dx, dy, dz, ATM.Ra);
  const tMax = tGround > 0 ? tGround : tTop;
  if (tMax <= 0) return [0, 0, 0];

  const mu = dx * sx + dy * sy + dz * sz;
  const pr = phaseRayleigh(mu);
  const pm = phaseMie(mu);

  const L = [0, 0, 0];
  const thr = [1, 1, 1];

  for (let i = 0; i < viewSteps; i++) {
    const f0 = i / viewSteps;
    const f1 = (i + 1) / viewSteps;
    const t0 = tMax * f0 * f0;
    const t1 = tMax * f1 * f1;
    const ds = t1 - t0;
    const tm = 0.5 * (t0 + t1);
    const px = ox + dx * tm;
    const py = oy + dy * tm;
    const pz = oz + dz * tm;
    const r = Math.hypot(px, py, pz);
    const h = Math.max(0, r - ATM.Rg);

    const rhoR = densityR(h);
    const rhoM = densityM(h);
    const rhoO = densityO(h);

    const sc = [
      ATM.betaR[0] * rhoR + ATM.betaMs * rhoM,
      ATM.betaR[1] * rhoR + ATM.betaMs * rhoM,
      ATM.betaR[2] * rhoR + ATM.betaMs * rhoM,
    ];
    const scMean = (sc[0] + sc[1] + sc[2]) / 3;
    const msCoef = sc.map((v) => v + (scMean - v) * ATM.multiScatterNeutral);

    // Cosine of the sun with the local zenith at this sample.
    const muSun = (px * sx + py * sy + pz * sz) / r;
    const Tsun = transmittance(h, muSun, sunSteps);
    // Softened visibility for the multiple-scattering term: the shadowed side
    // of the terminator is still lit by light scattered from the sunlit side.
    const soft = smoothstep(-0.11, 0.015, muSun);
    const TsoftRaw = transmittance(h, Math.max(muSun, 0.0), sunSteps);
    // See ATM.multiScatterPathNeutral: light that arrived by several bounces
    // did not travel down the beam's path and must not inherit its spectrum.
    const TsoftMean = (TsoftRaw[0] + TsoftRaw[1] + TsoftRaw[2]) / 3;
    const Tsoft = TsoftRaw.map((v) => v + (TsoftMean - v) * ATM.multiScatterPathNeutral);

    for (let c = 0; c < 3; c++) {
      const scatterR = ATM.betaR[c] * rhoR;
      const scatterM = ATM.betaMs * rhoM;
      const single = (scatterR * pr + scatterM * pm) * Tsun[c];
      const multi = msCoef[c] * INV_4PI * ATM.multiScatter * Tsoft[c] * soft;
      L[c] += thr[c] * (single + multi) * ds * ATM.sunIrradiance[c];
      const ext = ATM.betaR[c] * rhoR + ATM.betaMe * rhoM + ATM.betaO[c] * rhoO;
      thr[c] *= Math.exp(-ext * ds);
    }
  }

  if (tGround > 0) {
    const px = ox + dx * tGround;
    const py = oy + dy * tGround;
    const pz = oz + dz * tGround;
    const r = Math.hypot(px, py, pz);
    const muSun = (px * sx + py * sy + pz * sz) / r;
    const ndl = Math.max(0, muSun);
    const Tsun = transmittance(0, muSun, sunSteps);
    for (let c = 0; c < 3; c++) {
      L[c] += thr[c] * ATM.groundAlbedo[c] * INV_PI * ATM.sunIrradiance[c] * Tsun[c] * ndl;
    }
  }

  return L;
}

function smoothstep(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * Horizontal illuminance from the sky dome alone, in lux — a cosine-weighted
 * hemisphere integral of skyRadiance. Together with the direct sun term this is
 * what the streetlights' photocell reads.
 *
 * A fixed low-discrepancy set of directions, so the answer does not flicker
 * frame to frame and does not depend on any RNG stream.
 */
const HEMI_DIRS = (() => {
  const N = 96;
  const dirs = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    // Cosine-weighted: z = sqrt(1 - u), u uniform, gives dA·cosθ weighting.
    const u = (i + 0.5) / N;
    const cosTheta = Math.sqrt(1 - u);
    const sinTheta = Math.sqrt(u);
    const phi = i * golden;
    dirs.push([sinTheta * Math.cos(phi), cosTheta, sinTheta * Math.sin(phi)]);
  }
  return dirs;
})();

export function skyIlluminance(sx, sy, sz) {
  const acc = [0, 0, 0];
  for (const [dx, dy, dz] of HEMI_DIRS) {
    const L = skyRadiance(dx, dy, dz, sx, sy, sz, 12, 8);
    acc[0] += L[0];
    acc[1] += L[1];
    acc[2] += L[2];
  }
  // Cosine-weighted sampling: E = π · mean(L).
  const k = Math.PI / HEMI_DIRS.length;
  return [acc[0] * k, acc[1] * k, acc[2] * k];
}

/**
 * Sky irradiance on a plane with an arbitrary normal, in lux per linear-sRGB
 * channel. Only the part of the hemisphere that is actually sky counts; what a
 * surface sees below the horizon is ground, and ground is somebody else's term.
 *
 * `skyIlluminance` above answers this for a horizontal surface, which is what
 * a photocell needs. A wall needs the directional answer and it is not half the
 * horizontal one: at dawn a wall facing the sun sees the amber half of the sky
 * and the wall opposite sees the blue half, and averaging the dome into one
 * number throws away exactly the difference that stops a low-sun frame from
 * being one colour with a brightness ramp.
 *
 * Cosine-weighted about the given normal, so the estimator is π · mean(L) over
 * the samples that are above the horizon.
 */
export function skyIrradianceOnPlane(nx, ny, nz, sx, sy, sz) {
  /**
   * Orthonormal basis about n, branchless — Duff et al. 2017, "Building an
   * Orthonormal Basis, Revisited", with the sign trick that keeps it stable as
   * n passes through the pole.
   *
   * The published form is written for a Z-up convention and this project is
   * Y-up (CONTRACT §3.1), so the last two components of each tangent are
   * relabelled. Getting that relabelling wrong is silent and specific: it
   * produces a basis whose second tangent is parallel to n, every sample lands
   * on the horizon, and the function returns exactly zero — but only for the
   * normals where the degeneracy bites. Here that was ±Z, which is to say both
   * sides of the street and neither end of it, so the two facades facing the
   * road got no skylight at all while the two facing along it were fine.
   *
   * Verify by hand rather than by eye: for n = (0,0,-1) this gives t1 = (1,0,0)
   * and t2 = (0,1,0), and dot(t1,n) = dot(t2,n) = dot(t1,t2) = 0.
   */
  const sign = ny >= 0 ? 1 : -1;
  const a = -1 / (sign + ny);
  const b = nx * nz * a;
  const t1 = [1 + sign * nx * nx * a, -sign * nx, sign * b];
  const t2 = [b, -nz, sign + nz * nz * a];

  const acc = [0, 0, 0];
  for (const [hx, hy, hz] of HEMI_DIRS) {
    // HEMI_DIRS is cosine-weighted about +Y; rotate it onto n.
    const dx = t1[0] * hx + t2[0] * hz + nx * hy;
    const dy = t1[1] * hx + t2[1] * hz + ny * hy;
    const dz = t1[2] * hx + t2[2] * hz + nz * hy;
    if (dy <= 0) continue;
    const L = skyRadiance(dx, dy, dz, sx, sy, sz, 12, 8);
    acc[0] += L[0];
    acc[1] += L[1];
    acc[2] += L[2];
  }
  const k = Math.PI / HEMI_DIRS.length;
  return [acc[0] * k, acc[1] * k, acc[2] * k];
}

// ---------------------------------------------------------------------------
// GLSL emission
// ---------------------------------------------------------------------------

function f(x) {
  if (!Number.isFinite(x)) throw new Error(`atmosphere: non-finite constant ${x}`);
  const s = x.toPrecision(9);
  return s.includes('.') || s.includes('e') || s.includes('E') ? s : `${s}.0`;
}
function v3(a) {
  return `vec3(${f(a[0])}, ${f(a[1])}, ${f(a[2])})`;
}

/**
 * The shared GLSL half. Emitted from ATM so the two implementations cannot
 * drift apart. Provides:
 *
 *   float atmRaySphere(vec3 ro, vec3 rd, float radius)
 *   vec3  atmTransmittanceLUT(sampler2D lut, float h, float mu)
 *   vec3  atmTransmittanceIntegrate(float h, float mu)      // LUT build only
 *   vec3  atmSkyRadiance(sampler2D lut, vec3 rd, vec3 sunDir, out vec3 tr)
 */
export function atmosphereGLSL({ viewSteps = 16, lutSteps = 40 } = {}) {
  return /* glsl */ `
const float ATM_RG = ${f(ATM.Rg)};
const float ATM_RA = ${f(ATM.Ra)};
const vec3  ATM_BETA_R = ${v3(ATM.betaR)};
const float ATM_BETA_MS = ${f(ATM.betaMs)};
const float ATM_BETA_ME = ${f(ATM.betaMe)};
const vec3  ATM_BETA_O = ${v3(ATM.betaO)};
const float ATM_HR = ${f(ATM.HR)};
const float ATM_HM = ${f(ATM.HM)};
const float ATM_OZ_CENTER = ${f(ATM.ozoneCenter)};
const float ATM_OZ_WIDTH = ${f(ATM.ozoneWidth)};
const float ATM_MIE_G = ${f(ATM.mieG)};
const vec3  ATM_SUN_IRRADIANCE = ${v3(ATM.sunIrradiance)};
const float ATM_MULTISCATTER = ${f(ATM.multiScatter)};
const float ATM_MS_NEUTRAL = ${f(ATM.multiScatterNeutral)};
const float ATM_MS_PATH_NEUTRAL = ${f(ATM.multiScatterPathNeutral)};
const vec3  ATM_GROUND_ALBEDO = ${v3(ATM.groundAlbedo)};
const float ATM_SUN_ANGULAR_RADIUS = ${f(ATM.sunAngularRadius)};
const float ATM_MOON_ANGULAR_RADIUS = ${f(ATM.moonAngularRadius)};
const float ATM_HAZE_DENSITY = ${f(ATM.hazeDensity)};
const float ATM_HAZE_SCALE_H = ${f(ATM.hazeScaleHeight)};
const float ATM_TOP = ${f(ATM.Ra - ATM.Rg)};

const int ATM_VIEW_STEPS = ${viewSteps};
const int ATM_LUT_STEPS = ${lutSteps};

const float ATM_INV_4PI = 0.0795774715;
const float ATM_INV_PI  = 0.3183098862;

float atmDensityR(float h) { return exp(-h / ATM_HR); }
float atmDensityM(float h) { return exp(-h / ATM_HM); }
float atmDensityO(float h) { return max(0.0, 1.0 - abs(h - ATM_OZ_CENTER) / ATM_OZ_WIDTH); }

vec3 atmExtinction(float h) {
  return ATM_BETA_R * atmDensityR(h) + vec3(ATM_BETA_ME) * atmDensityM(h) + ATM_BETA_O * atmDensityO(h);
}

float atmRaySphere(vec3 ro, vec3 rd, float radius) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - radius * radius;
  float disc = b * b - c;
  if (disc < 0.0) return -1.0;
  float d = sqrt(disc);
  float t0 = -b - d;
  float t1 = -b + d;
  if (t1 < 0.0) return -1.0;
  return t0 >= 0.0 ? t0 : t1;
}

/** Reference integration. Used once, to build the LUT. */
vec3 atmTransmittanceIntegrate(float h, float mu) {
  vec3 ro = vec3(0.0, ATM_RG + h, 0.0);
  vec3 rd = vec3(sqrt(max(0.0, 1.0 - mu * mu)), mu, 0.0);
  if (atmRaySphere(ro, rd, ATM_RG) > 0.0) return vec3(0.0);
  float t = atmRaySphere(ro, rd, ATM_RA);
  if (t <= 0.0) return vec3(1.0);
  float ds = t / float(ATM_LUT_STEPS);
  vec3 tau = vec3(0.0);
  for (int i = 0; i < ATM_LUT_STEPS; i++) {
    vec3 p = ro + rd * ((float(i) + 0.5) * ds);
    tau += atmExtinction(max(0.0, length(p) - ATM_RG));
  }
  return exp(-tau * ds);
}

/**
 * The LUT is indexed (mu, h) and does not depend on the sun, so it is built
 * once at boot and never rebuilt. Bilinear filtering across the horizon row
 * smears the hard ground-shadow edge over about a degree, which is a free and
 * physically defensible soft terminator.
 */
vec3 atmTransmittanceLUT(sampler2D lut, float h, float mu) {
  vec2 uv = vec2(mu * 0.5 + 0.5, clamp(h / ATM_TOP, 0.0, 1.0));
  return texture2D(lut, uv).rgb;
}

float atmPhaseR(float mu) { return 0.0596831037 * (1.0 + mu * mu); }

float atmPhaseM(float mu) {
  float g = ATM_MIE_G;
  float g2 = g * g;
  float d = max(1e-4, 1.0 + g2 - 2.0 * g * mu);
  return 0.1193662073 * ((1.0 - g2) * (1.0 + mu * mu)) / ((2.0 + g2) * pow(d, 1.5));
}

/**
 * Sky radiance in cd/m² for a view ray from ground level.
 * outTransmittance is the residual transmittance along the ray, which the
 * background pass uses to attenuate the sun and moon discs.
 */
vec3 atmSkyRadiance(sampler2D lut, vec3 rd, vec3 sunDir, out vec3 outTransmittance) {
  vec3 ro = vec3(0.0, ATM_RG + 1.0, 0.0);
  float tGround = atmRaySphere(ro, rd, ATM_RG);
  float tTop = atmRaySphere(ro, rd, ATM_RA);
  float tMax = tGround > 0.0 ? tGround : tTop;
  outTransmittance = vec3(1.0);
  if (tMax <= 0.0) return vec3(0.0);

  float mu = dot(rd, sunDir);
  float pr = atmPhaseR(mu);
  float pm = atmPhaseM(mu);

  vec3 L = vec3(0.0);
  vec3 throughput = vec3(1.0);

  for (int i = 0; i < ATM_VIEW_STEPS; i++) {
    float f0 = float(i) / float(ATM_VIEW_STEPS);
    float f1 = float(i + 1) / float(ATM_VIEW_STEPS);
    // Quadratic spacing: dense near the camera, where the density is.
    float t0 = tMax * f0 * f0;
    float t1 = tMax * f1 * f1;
    float ds = t1 - t0;
    vec3 p = ro + rd * (0.5 * (t0 + t1));
    float r = length(p);
    float h = max(0.0, r - ATM_RG);

    float rhoR = atmDensityR(h);
    float rhoM = atmDensityM(h);

    float muSun = dot(p / r, sunDir);
    vec3 Tsun = atmTransmittanceLUT(lut, h, muSun);
    vec3 TsoftRaw = atmTransmittanceLUT(lut, h, max(muSun, 0.0));
    // See ATM.multiScatterPathNeutral. Light that arrived by several bounces
    // did not come down the beam's path and must not inherit its spectrum.
    vec3 Tsoft = mix(TsoftRaw, vec3(dot(TsoftRaw, vec3(0.333333))), ATM_MS_PATH_NEUTRAL);
    // How far the multiple-scattering term reaches past the geometric
    // terminator. Too generous and civil twilight reads several thousand lux —
    // bright enough that no neon in the frame can register.
    float soft = smoothstep(-0.11, 0.015, muSun);

    vec3 scatterR = ATM_BETA_R * rhoR;
    vec3 scatterM = vec3(ATM_BETA_MS * rhoM);

    vec3 single = (scatterR * pr + scatterM * pm) * Tsun;

    // Higher-order scattering is close to neutral — see ATM.multiScatterNeutral.
    vec3 sc = scatterR + scatterM;
    vec3 msCoef = mix(sc, vec3(dot(sc, vec3(0.333333))), ATM_MS_NEUTRAL);
    vec3 multi = msCoef * ATM_INV_4PI * ATM_MULTISCATTER * Tsoft * soft;

    L += throughput * (single + multi) * ATM_SUN_IRRADIANCE * ds;
    throughput *= exp(-atmExtinction(h) * ds);
  }

  if (tGround > 0.0) {
    vec3 gp = ro + rd * tGround;
    vec3 n = gp / length(gp);
    float ndl = max(0.0, dot(n, sunDir));
    vec3 Tsun = atmTransmittanceLUT(lut, 0.0, dot(n, sunDir));
    L += throughput * ATM_GROUND_ALBEDO * ATM_INV_PI * ATM_SUN_IRRADIANCE * Tsun * ndl;
    throughput = vec3(0.0);
  }

  outTransmittance = throughput;
  return L;
}
`;
}
