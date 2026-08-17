/**
 * weather.js — rainfall and wetness, which are two states and not one.
 *
 * THE SEPARATION IS THE WHOLE DESIGN, AND IT IS LOAD-BEARING TWICE.
 *
 * `rainfall` is how hard it is raining right now. It drives the three particle
 * layers and the extinction `lights.setHaze` carries. `wetness` is how much
 * water is lying on the surfaces. It drives `lights.setWetness`, and through it
 * the wet-film darkening, the puddle roughness and the screen-space
 * reflection's gate (SURFACE, and `gNoctisWetFilm` / `gNoctisWetPond` in
 * lights.js).
 *
 * They are separate for a physical reason and for a gate reason, and the two
 * happen to agree:
 *
 *   PHYSICAL. A road stays wet long after the rain stops. The film that makes
 *   asphalt read as wet is 0.05 mm deep; rain at 10 mm/h delivers that in 18 s
 *   and night-time evaporation removes it in 3000 s. One state cannot be both
 *   the supply and the store.
 *
 *   GATE. `harness.setWetness` and `tools/lookcheck.mjs` capture every time of
 *   day at both ends of wetness, and eight committed assertions read those
 *   frames. If rainfall were tied to wetness, every wet look frame would
 *   suddenly gain a haze four times thicker than the clear-air term and all
 *   eight would move — for a reason that has nothing whatever to do with what
 *   they measure. Rainfall therefore DEFAULTS TO 0, and at 0 this module adds
 *   three degenerate InstancedMeshes, `resetHaze()`, and nothing else. The
 *   existing frames are unchanged apart from the recompilation that adding any
 *   material to the scene causes, which CONTRACT §5.11 already writes down: do
 *   not say "bit for bit" about a change that recompiles a shader.
 *
 * THE OVERRIDE, WHICH IS THE TRAP THIS MODULE WOULD OTHERWISE SET.
 *
 * `harness.setWetness(v)` writes the uniform and then settles for
 * `TAA.settleFrames` = 32 frames plus the capture's own. A module that writes
 * `lights.setWetness` every frame wins on the very next `update()`, and every
 * frame the look gate believes is wet is captured dry — silently, because a dry
 * frame is a perfectly good frame. So the api exposes `override(v)` / `release()`
 * and, while overridden, this module DOES NOT CALL `lights.setWetness` AT ALL.
 * Not "writes the same value": does not write. An external direct write has to
 * survive, and the only way to guarantee that is to stop writing.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *
 * A mist particle system. CONTRACT §5.11 and `tools/budget.json` -> particles
 * settle this: one pixel of the internal buffer is 2*tan(25 deg)/1440 =
 * 6.4765e-4 rad, and a 2 mm drop at 35 m subtends 0.002/35 = 5.71e-5 rad, which
 * is 0.088 px. Past about 35 m a drop cannot be a billboard, and extinction is
 * the correct model rather than a cheaper one. `lights.setHaze(density,
 * scaleHeight)` has been fully wired to the uniform since session 5 and has had
 * no caller. This module is its caller.
 */

import * as THREE from 'three';
import { LIGHT, LAMP_BOWL, RENDER, GROUND } from '../core/constants.js';
import { pixelAngle } from '../core/instmotion.js';
import { ATM } from '../lib/atmosphere.js';
import { CITY, CORRIDOR } from '../lib/citygen.js';

// ---------------------------------------------------------------------------
// The rain, as a drop-size distribution. Everything below is one distribution.

/**
 * mm/h at `rainfall` = 1. The night_rain route's rate, and the rate every
 * number in `tools/budget.json` -> particles was derived at. Changing it
 * invalidates the particle split, so it is here once and read everywhere.
 */
const RAIN_FULL_MMH = 10;

/**
 * Marshall-Palmer: N(D) = N0*exp(-Lambda*D), N0 = 8000 m^-3 mm^-1 and
 * Lambda = 4.1*R^-0.21 mm^-1. At R = 10 mm/h, Lambda = 4.1 * 10^-0.21 =
 * 4.1 * 0.61660 = 2.5280 mm^-1, the number density over all diameters is
 * N0/Lambda = 3164.5 drops per m^3 and the median-volume diameter is
 * 3.67/Lambda = 1.452 mm.
 */
const MP_N0 = 8000;
const MP_LAMBDA_FULL = 4.1 * Math.pow(RAIN_FULL_MMH, -0.21);

/**
 * mm. The diameter at which `tools/budget.json` puts the split between a drop
 * that is a billboard and a drop that is the veil. Solved there jointly from
 * the streak count and the splash count: 3.281 mm from the air view and
 * 3.290 mm from the ground view, agreeing to 0.011 mm. Everything smaller is
 * the haze term below, and if this module drew it, it would be drawing water
 * `setHaze` is already delivering.
 */
const DROP_MM = 3.28;

/**
 * m/s. Atlas-Ulbrich terminal velocity, v = 3.78*D^0.67 with D in mm.
 * 3.78 * 3.28^0.67 = 3.78 * 2.2164 = 8.378 m/s.
 */
const DROP_TERMINAL_MS = 3.78 * Math.pow(DROP_MM, 0.67);

/**
 * m^-3. Number density of drops at or above the split diameter:
 * (N0/Lambda) * exp(-Lambda*D) = 3164.5 * exp(-2.5280 * 3.28) = 0.7908 per m^3.
 * This is the number the simulated volume has to be sized against, and it is
 * the coherence check on the whole layer: 500 instances at 0.7908 per m^3 want
 * 632.3 m^3, and `budget.json` derived its frustum wedge independently at
 * 629.2 m^3. Half a percent. Neither number was fitted to the other.
 */
const DROP_DENSITY_FULL = (MP_N0 / MP_LAMBDA_FULL) * Math.exp(-MP_LAMBDA_FULL * DROP_MM);

// ---------------------------------------------------------------------------
// Extinction. CONTRACT §5.11, and the reason there is no mist system.

/**
 * 1/m. Volume extinction coefficient of rain at RAIN_FULL_MMH, integrated over
 * the SAME Marshall-Palmer distribution the drop counts came from:
 *
 *   sigma = Qext * (pi/4) * integral(D^2 * N0 * exp(-Lambda*D) dD)
 *         = 2 * (pi/4) * N0 * 2/Lambda^3
 *         = 1.5708 * 8000 * 2/16.158 * 1e-6      (D in mm, so 1e-6 m^2 per mm^2)
 *         = 1.5556e-3 /m
 *
 * Qext = 2 because every drop here is enormously larger than the wavelength.
 * Koschmieder then gives the meteorological visibility, sigma = 3.912/V:
 * V = 3.912 / 1.5556e-3 = 2515 m. Two and a half kilometres, which is what the
 * brief calls "a few km" for 10 mm/h.
 *
 * PRINTED BESIDE THE OTHER ANSWER, PER §9 RULE 4. The classic empirical fit
 * V = 1.6*R^-0.63 km reports 375 m at the same rate — 6.7 times thicker. That
 * fit is a visibility-in-rain observation and it folds in the mist and road
 * spray that accompany rain, plus the forward-scatter Koschmieder's 2 percent
 * contrast criterion ignores. The integral above is the extinction of the water
 * this module can account for, so it is the one that is used. Both are in the
 * boot log so the next session can disagree with the fits rather than the code.
 *
 * The exponent, for free: Lambda ~ R^-0.21 and sigma ~ Lambda^-3, so
 * sigma ~ R^0.63 — the same 0.63 the empirical law carries. The two disagree
 * about the coefficient and agree about the shape.
 */
const RAIN_SIGMA_FULL = 2 * (Math.PI / 4) * MP_N0 * (2 / Math.pow(MP_LAMBDA_FULL, 3)) * 1e-6;

/** sigma ~ R^0.63, straight out of Lambda ~ R^-0.21 above. Not a fitted curve. */
const RAIN_SIGMA_EXPONENT = 0.63;

/**
 * m. Stratiform cloud base in steady rain. The aerosol has an exponential
 * profile with a 550 m scale height (ATM.hazeScaleHeight); rain does not — it
 * is roughly uniform from the ground to the cloud base and absent above it.
 * The haze shader has room for exactly one scale height, so the two are blended
 * by matching COLUMN INTEGRALS: an exponential of scale height H has column H,
 * and a uniform slab of depth Hc has column Hc, so a slab to 800 m enters the
 * blend as H = 800 m. At full rain the blend gives
 * (4.5e-4*550 + 1.5556e-3*800) / 2.0056e-3 = 744 m.
 */
const RAIN_CLOUD_BASE_M = 800;

/**
 * Koschmieder's constant: ln(1/0.02) = 3.912. sigma = 3.912/V, and V = 3.912/sigma.
 * Written once because the boot log prints both directions of it.
 */
const KOSCHMIEDER = 3.912;

/**
 * A step in rainfall large enough that the previous frame describes a different
 * world, so `post.resetHistory()` is owed. DERIVED, not chosen:
 *
 * transmittance over the 35 m the brief names is T = exp(-sigma*35), and
 * dT/dsigma = -35*T. At the clear-air sigma, T = 0.9844, so one 8-bit code of
 * change, 1/255 = 3.922e-3, needs d(sigma) = 3.922e-3 / (35 * 0.9844) =
 * 1.138e-4 /m. With sigma_rain(r) = 1.5556e-3 * r^0.63, d(sigma)/dr at r = 0.5
 * is 1.5556e-3 * 0.63 * 0.5^-0.37 = 1.267e-3, so dr = 1.138e-4/1.267e-3 = 0.090.
 *
 * Below this a rainfall step cannot move a pixel by a quantisation step at the
 * distance the haze is about, and dropping the accumulation would cost 32
 * frames of convergence to fix nothing. Above it, the history is wrong.
 */
const RAINFALL_HISTORY_STEP = 0.09;

// ---------------------------------------------------------------------------
// Wetness. Two time constants, and the asymmetry between them is not a taste.

/**
 * mm. The water film that has to bridge the aggregate's microtexture before a
 * road reads as wet. Asphalt microtexture is 20-100 microns; 0.05 mm is the
 * middle of it. This is NOT the macrotexture (0.7 mm mean depth) — that is the
 * reservoir a tyre has to displace, not the depth at which a surface goes
 * specular.
 */
const WET_FILM_MM = 0.05;

/**
 * mm/h. Evaporation from a wet pavement on a still, humid night. Penman for a
 * saturated surface at 15 C, 80% RH and 1 m/s of wind is 0.05-0.08 mm/h; the
 * daytime figure is ten times this and the module does not use it, which is a
 * limitation and is stated in the boot log rather than hidden.
 */
const EVAPORATION_MMH = 0.06;

/**
 * s. Time constant of WETTING at full rainfall: the film depth divided by the
 * supply rate. 0.05 mm / (10 mm/h = 2.7778e-3 mm/s) = 18.0 s.
 */
const WET_TAU_FULL_S = WET_FILM_MM / (RAIN_FULL_MMH / 3600);

/**
 * s. Time constant of DRYING: the same film depth divided by the only flux that
 * removes it. 0.05 mm / (0.06 mm/h = 1.6667e-5 mm/s) = 3000 s, fifty minutes.
 *
 * THE ASYMMETRY IS NOT A PAIR OF CHOSEN NUMBERS. It is 3000/18 = 166.7, which
 * is exactly 10/0.06 — the ratio of the two fluxes that move the same 0.05 mm
 * of water. One number is authored here (the film depth) and it cancels out of
 * the ratio entirely.
 *
 * It also has a useful side effect worth stating rather than discovering: over
 * the 45 frames a look capture settles for, 0.75 s at 60 Hz, an undriven
 * wetness moves by 1 - exp(-0.75/3000) = 2.5e-4. So even without `override()`
 * the gate frames would not visibly drift. `override()` exists because "would
 * not visibly drift" is not the same claim as "does not change", and the
 * assertions are on measured numbers.
 */
const DRY_TAU_S = WET_FILM_MM / (EVAPORATION_MMH / 3600);

/**
 * The exponent that turns rainfall into an EQUILIBRIUM wetness, from Manning's
 * kinematic wave for sheet flow off a crowned carriageway:
 *
 *   h = (n*q/sqrt(S))^0.6,  q = R*W
 *
 * with n = 0.011 (smooth asphalt), S = 0.025 (the standard 2.5% crossfall) and
 * W = 7.5 m (CITY.roadHalfWidth, kerb to crown). At R = 10 mm/h that is
 * q = 2.083e-5 m^2/s and h = 0.314 mm — six times the 0.05 mm film, so the road
 * at full rainfall is ponded rather than merely damp, which is what wetness 1
 * means in the shader. h scales as R^0.6, so the equilibrium wetness is
 * rainfall^0.6.
 */
const WET_EQUILIBRIUM_EXPONENT = 0.6;

// ---------------------------------------------------------------------------
// The three layers. Counts and clamps are `tools/budget.json` -> particles.

const STREAK_COUNT = 500;
const SPLASH_COUNT = 130;
const SPRAY_COUNT = 70;

/** px^2, compile-time. 3 x 56, 8 x 8 and 12 x 12. See the derivations below. */
const STREAK_MAX_AREA_PX = 168;
const SPLASH_MAX_AREA_PX = 64;
const SPRAY_MAX_AREA_PX = 144;

/**
 * px. The FLOOR the vertex shader widens a billboard to, with a compensating
 * reduction in radiance so the flux is unchanged.
 *
 * A quad narrower than a pixel is not drawn thinner, it is drawn intermittently
 * — the rasteriser either catches a sample centre or does not, and the result
 * is a scintillating dotted line rather than a faint continuous one. Widening
 * to one pixel and dividing the radiance by the widening factor is the same
 * total energy in a form the sampler can carry. This matters for exactly one
 * layer: a streak is 1 px wide at 11.6 m and the simulated volume ends at 12 m.
 */
const MIN_EXTENT_PX = 1;

/** m. The streak quad is the drop's own 1/60 s smear: 8.378/60 = 0.1396 m. */
const STREAK_LENGTH_M = DROP_TERMINAL_MS / 60;

/**
 * The streak's aspect, 56/3 = 18.667, straight off the pair of clamps in
 * `budget.json`. Fixing the world quad at this aspect is what makes the single
 * area clamp equivalent to the pair: a quad of aspect 18.667 whose area is
 * 168 px^2 is exactly 3 px by 56 px, so bounding the area bounds both.
 */
const STREAK_ASPECT = 56 / 3;

/**
 * m. 0.1396/18.667 = 7.480 mm. That is 2.28 drop diameters: the 3.28 mm core
 * plus the soft edge either side that lets the line antialias. The pair is
 * self-consistent — width and length reach their clamps at the same distance,
 * 3.85 m, because the world aspect is the clamp aspect.
 */
const STREAK_WIDTH_M = STREAK_LENGTH_M / STREAK_ASPECT;

/**
 * m. Range bound on the simulated volume, and it is CORRIDOR = 11.7 m rounded.
 * Past the kerb-to-kerb width the streaks inside one pixel overlap and the
 * correct model is the participating medium above, not more billboards.
 */
const RAIN_RANGE_M = 12;

/** m. Nearest a streak may be simulated. Inside this it is a blur across the lens. */
const RAIN_NEAR_M = 0.45;

/**
 * m. THE CARRIAGEWAY SURFACE — `GROUND.carriageway`, the datum, session 19.
 *
 * It was the literal `0.02` under a comment saying it "matches city.js
 * buildGround's road quad", which is §9.1's "a value in config the code does not
 * read" with two modules instead of a config file: a private copy of ONE KEY of
 * another module's ground table, kept in step by a sentence. It was already
 * wrong in three of the four places it is used — 1 mm out on an east–west
 * carriageway, 10 mm out on a pavement, and 20 mm out over the origin block's
 * own street, which is at exactly 0. Declaring the datum makes it right on the
 * carriageway by construction and leaves the pavement error, which is what the
 * next paragraph is about.
 *
 * WHY IT IS STILL A CONSTANT AND NOT A QUERY, said out loud. Splashes, spray
 * and the streak floor are RAIN ON THE ROAD: `SPLASH_*` seats its crowns over
 * the carriageway, and a splash on a pavement 0.160 m higher would sit 0.160 m
 * under it. That is a real remaining error and it is bounded — a splash is
 * 24.6 mm across and lives for a fraction of a second — where a per-particle
 * ground query at this population would not be. Recorded rather than fixed.
 */
const GROUND_Y = GROUND.carriageway;

/**
 * m. Splash crown diameter. A crown is about three drop diameters across at
 * formation, 3 * 3.28 = 9.84 mm, and the collapsing ring reaches about 2.5
 * times that: 24.6 mm. It hits the 8 px clamp at 24.6e-3/(8*6.4765e-4) =
 * 4.75 m, which is the near field the clamp exists to bound.
 */
const SPLASH_CROWN_M = 3 * (DROP_MM / 1000) * 2.5;

/**
 * s. Crown lifetime, the same 0.10 s `budget.json` solved the layer split with
 * — six frames at 60 Hz, the low end of a measured crown's 50-100 ms rise and
 * collapse. Changing it changes the splash count, so it is not a free parameter.
 */
const SPLASH_LIFE_S = 0.1;

/**
 * m. Splashes are only placed inside this. A crown is one pixel across at
 * 9.84e-3/6.4765e-4 = 15.2 m, and a one-pixel splash is not a splash, it is
 * noise on the road that TAA will fight.
 */
const SPLASH_RANGE_M = 15;

/** m. Diameter of a spray puff off a tyre. `budget.json`: a 0.30 m turbulent ball. */
const SPRAY_BALL_M = 0.3;

/** m. Spray leaves the tyre at about hub height on the contact patch's own scale. */
const SPRAY_HEIGHT_M = 0.35;

/**
 * s. Spray lifetime, from Stokes settling of the droplets that make it:
 * v = rho*g*D^2/(18*mu) = 998 * 9.81 * (150e-6)^2 / (18 * 1.81e-5) = 0.676 m/s,
 * and 0.35 m of fall at that speed is 0.518 s. Stokes rather than Atlas-Ulbrich
 * because 150 microns is inside the creeping-flow range and 3.28 mm is not.
 */
const SPRAY_LIFE_S = SPRAY_HEIGHT_M / ((998 * 9.81 * Math.pow(150e-6, 2)) / (18 * 1.81e-5));

/** m. Beyond this a 0.30 m ball is under half a pixel and is the haze's business. */
const SPRAY_RANGE_M = 25;

// ---------------------------------------------------------------------------
// Radiance. cd/m^2, linear, CONTRACT §5.3.

/**
 * lux. The design illuminance the street is lit to. constants.js LIGHT.
 * streetlampCandela states the target the luminaire was sized against: "10-20
 * lux average with a min/avg uniformity above 0.4". 15 is the middle of the
 * band the project already committed to, not a new number.
 */
const STREET_DESIGN_LUX = 15;

/** Fresnel reflectance of water at normal incidence: ((1.333-1)/(1.333+1))^2 = 0.02037. */
const WATER_FRESNEL_0 = Math.pow((1.333 - 1) / (1.333 + 1), 2);

/**
 * cd/m^2. Mean radiance of a rain streak, AND THE PLACE THIS MODULE MAKES A
 * CHOICE RATHER THAN A MEASUREMENT. Both numbers are here because §9 rule 4
 * says to print both.
 *
 * THE ENSEMBLE ANSWER. A water sphere's Fresnel-integrated
 * directional-hemispherical reflectance is 0.066. Under 15 lux that is a drop
 * radiance of 0.066*15/pi = 0.315 cd/m^2, and smearing the drop's 8.45 mm^2
 * disc over the 7.480 x 139.63 mm quad conserves flux, so the quad's mean is
 * 0.315 * 8.45/1044 = 2.55e-3 cd/m^2. Against a carriageway at
 * 0.08*15/pi = 0.38 cd/m^2 that is 0.7 percent. THE ENSEMBLE ANSWER IS THAT
 * UNLIT NIGHT RAIN IS INVISIBLE, and that is not an artefact of the arithmetic
 * — it is why rain in a night photograph is only ever visible against lights.
 *
 * THE GLINT ANSWER, WHICH IS WHAT IS DRAWN. A drop is a convex mirror, and a
 * mirror preserves radiance: the specular image of a sodium bowl at
 * LAMP_BOWL.streamedNits = 9000 cd/m^2 is 0.02037 * 9000 = 183.4 cd/m^2. Diluted
 * by the motion-blur duty along the streak, D/length = 3.28/139.63 = 0.02349,
 * and by the fraction of the quad's width the drop's core actually occupies,
 * D/width = 3.28/7.480 = 0.4385, that is 183.4 * 0.02349 * 0.4385 =
 * 1.889 cd/m^2 — about five times the carriageway, which is what a lit street
 * in rain looks like.
 *
 * The glint case applied to every drop over-counts by the fraction of the
 * population actually near a specular alignment, and the per-instance gain
 * below is where that fraction lives: gains are drawn in [0.12, 1.0], mean 0.56.
 * A frame drawn at the ensemble mean has no rain in it at all; a frame drawn at
 * the glint has rain everywhere. This module draws the second, scaled by a
 * scintillation term, and says so rather than quietly picking one.
 */
const STREAK_NITS =
  WATER_FRESNEL_0 * LAMP_BOWL.streamedNits *
  (DROP_MM / (STREAK_LENGTH_M * 1000)) *
  (DROP_MM / (STREAK_WIDTH_M * 1000));

/**
 * cd/m^2. A splash crown is AERATED water — a thin sheet full of entrained
 * bubbles, which is what makes whitewater white. Foam's diffuse reflectance is
 * about 0.5 against clear water's 0.066, so 0.5 * 15/pi = 2.39 cd/m^2. The
 * crown is the one part of this system that is genuinely bright, and it is
 * bright for the same reason surf is.
 */
const SPLASH_NITS = 0.5 * STREET_DESIGN_LUX / Math.PI;

/**
 * cd/m^2. A spray puff is an optically thin ball of 150 micron droplets. Its
 * single-scattering albedo is water's, near 1, but its optical depth is under
 * one, so the ball returns roughly 0.30 of what lands on it: 0.30*15/pi =
 * 1.43 cd/m^2.
 */
const SPRAY_NITS = 0.3 * STREET_DESIGN_LUX / Math.PI;

/**
 * Linear white, and it is a claim rather than a default. Specular reflection at
 * a dielectric interface is achromatic, so a rain streak carries the
 * chromaticity of whatever it is reflecting — which this module has no way to
 * know, because it is not inside the clustered lighting model. Writing white is
 * the only claim the module can support. It also keeps the layers out of the
 * saturation reserve entirely (docs/authored-city.md: the reserve is spent by
 * the NUMBER of different saturated things), which matters because 500 streaks
 * at 168 px is 2.3 percent of the frame and a seventh saturated chromaticity
 * covering 2.3 percent of every rainy frame is exactly what the reserve is
 * there to stop.
 */
const WATER_CHROMA = [1, 1, 1];

// ---------------------------------------------------------------------------
// Wind. A log profile, so the streaks lean more at the top than at the bottom.

/** von Karman. */
const KARMAN = 0.41;
/** m. Aerodynamic roughness length of a built-up urban surface. */
const WIND_Z0_M = 1.0;
/** m/s at 10 m. A steady urban night breeze. */
const WIND_10M_MS = 3.0;
/** u* = u(10)*kappa/ln(10/z0) = 3.0*0.41/2.3026 = 0.534 m/s. */
const WIND_USTAR = (WIND_10M_MS * KARMAN) / Math.log(10 / WIND_Z0_M);

// ---------------------------------------------------------------------------

const RAD = Math.PI / 180;

/**
 * The log wind profile, u(y) = (uStar / kappa) * ln(y/z0), clamped at the roughness
 * length below which the log law is not defined.
 *
 * This is why the streaks are not parallel. At 12 m the wind is 3.24 m/s and a
 * drop falling at 8.378 m/s leans atan(3.24/8.378) = 21.1 degrees; at 2 m it is
 * 0.90 m/s and 6.2 degrees. A single tilt angle would have been one number and
 * would have made every streak in the frame the same line.
 */
function windSpeedAt(y) {
  return (WIND_USTAR / KARMAN) * Math.log(Math.max(y, WIND_Z0_M * 1.05) / WIND_Z0_M);
}

/**
 * Is (x, z) under something? True when the point falls inside the plan of a
 * building box whose top is above `y`.
 *
 * DELIBERATELY NOT `canyon.sampleField`. That reads the ORIGIN BLOCK's baked
 * field and clamps its indices, so a query anywhere outside the block returns
 * the block's edge voxel — a sky-visibility number for a place three hundred
 * metres away. It is the right instrument for "how much sky does this point
 * see" inside the block and the wrong one for "can rain reach here" anywhere.
 * CONTRACT §9: one quantity used as though it were another, and this is the
 * variant where the wrong answer is plausible everywhere.
 */
function sheltered(boxes, x, z, y) {
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (b.top > y && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return true;
  }
  return false;
}

/** Distance from the nearest road centreline. Centrelines are x = 128k and z = 128k. */
function distanceToCentreline(x, z) {
  const s = CITY.chunkSize;
  const dx = Math.abs(x - Math.round(x / s) * s);
  const dz = Math.abs(z - Math.round(z / s) * s);
  return Math.min(dx, dz);
}

/**
 * The vertex shader every layer shares.
 *
 * THE CLAMP IS A #define AND NOT A UNIFORM, and `tools/perfcheck.mjs` reads it
 * off `material.defines` rather than off the layer's own declaration. A clamp
 * that can change at runtime is a clamp nobody can budget — the same rule §5.8
 * applies to the SSR march's step count. The pair-bound in `budget.json` is on
 * the PRODUCT of the instance count and this number, so a uniform here would
 * make the fill an unbounded quantity with a bounded-looking name.
 *
 * The projected size comes from the view-space position and the live projection
 * matrix, so it is right at any field of view and any internal resolution.
 * projectionMatrix[0][0] is 2n/(r-l), and an offset `a` in view space at depth
 * `d` covers projectionMatrix[0][0]*a/d in NDC, which is half the viewport width
 * again in pixels. The TAA jitter lives in elements [2][0] and [2][1] and does
 * not enter this.
 */
const PARTICLE_VERTEX = /* glsl */ `
precision highp float;

uniform vec2 uViewportPx;
uniform float uGain;

/** x: per-instance radiance gain. y: per-instance life phase, 0..1. */
in vec2 noctisParticle;

out vec2 vUv;
out float vGain;
out float vPhase;

void main() {
  mat4 mvi = modelViewMatrix * instanceMatrix;

  vec4 centre = mvi * vec4(0.0, 0.0, 0.0, 1.0);
  // The quad's two axes, in view space. PlaneGeometry spans exactly 1.0 in each
  // of x and y, so these are its full extents rather than half of them.
  vec3 ax = (mvi * vec4(1.0, 0.0, 0.0, 0.0)).xyz;
  vec3 ay = (mvi * vec4(0.0, 1.0, 0.0, 0.0)).xyz;

  float depth = max(0.05, -centre.z);
  float kx = 0.5 * uViewportPx.x * projectionMatrix[0][0] / depth;
  float ky = 0.5 * uViewportPx.y * projectionMatrix[1][1] / depth;

  vec2 px = vec2(ax.x * kx, ax.y * ky);
  vec2 py = vec2(ay.x * kx, ay.y * ky);

  float sx = 1.0;
  float sy = 1.0;
  float energy = 1.0;

  // Widen to the sampling floor and pay for it in radiance. A parked instance
  // has zero-length axes and must fall through both branches untouched, or a
  // divide by zero would send it to infinity instead of leaving it degenerate.
  float wPx = length(px);
  if (wPx > 1e-5 && wPx < float(NOCTIS_PARTICLE_MIN_EXTENT_PX)) {
    sx = float(NOCTIS_PARTICLE_MIN_EXTENT_PX) / wPx;
    energy /= sx;
  }
  float hPx = length(py);
  if (hPx > 1e-5 && hPx < float(NOCTIS_PARTICLE_MIN_EXTENT_PX)) {
    sy = float(NOCTIS_PARTICLE_MIN_EXTENT_PX) / hPx;
    energy /= sy;
  }

  // The projected footprint is the parallelogram the two axes span, which is
  // the exact answer for an affine transform rather than width times height.
  float areaPx = abs(px.x * py.y - px.y * py.x) * sx * sy;
  if (areaPx > float(NOCTIS_PARTICLE_MAX_AREA_PX)) {
    float k = sqrt(float(NOCTIS_PARTICLE_MAX_AREA_PX) / areaPx);
    sx *= k;
    sy *= k;
  }

  vUv = uv;
  vGain = noctisParticle.x * uGain * energy;
  vPhase = noctisParticle.y;

  gl_Position = projectionMatrix * (mvi * vec4(position.x * sx, position.y * sy, 0.0, 1.0));
}
`;

/**
 * The fragment shader every layer shares, with `NOCTIS_PARTICLE_COVERAGE` left
 * for the layer to define.
 *
 * TWO THINGS THIS HAS TO DO BY HAND, BECAUSE `lights.patch()` CANNOT TOUCH IT.
 * patch() rejects anything that is not MeshStandardMaterial or
 * MeshPhysicalMaterial with a console.warn — correctly, since it injects into
 * three's own PBR chunks — so a hand-written material owes both of the HDR
 * target's contracts itself. src/modules/sky.js is the worked example and this
 * follows it.
 *
 * 1. FRAGMENT OUTPUT LOCATION 1. A shader that writes location 0 and not
 *    location 1 leaves location 1 UNDEFINED — not cleared, not preserved —
 *    and the resolve would reproject rain by whatever the driver left there.
 *    Rain is written vec2(0.0), and that is DERIVED rather than chosen:
 *    CONTRACT §5.12's threshold is 4 px of minimum screen extent, and
 *    `budget.json` -> particles fixes maxStreakWidthPx at 3. A streak can never
 *    reach the threshold, so it can never qualify for a motion vector, and the
 *    question does not arise for the other two either at 8 px and 12 px of
 *    diameter with a lifetime under a third of a second.
 *
 *    Additive blending makes zero the right value in a second, independent way.
 *    WebGL2 has one blend function for all draw buffers, so location 1 is
 *    blended additively too: adding vec2(0.0) leaves the motion vector the
 *    OPAQUE SURFACE BEHIND THE RAIN already wrote exactly as it was. The wet
 *    road under a streak keeps its own reprojection. A material that wrote its
 *    own motion here would erase the road's.
 *
 * 2. THE ALPHA CHANNEL IS LINEAR VIEW DEPTH, NOT OPACITY. The SSR march reads
 *    it (§5.8). So the alpha blend factors are ZeroFactor and OneFactor: the
 *    source alpha is discarded and the destination survives untouched. Rain
 *    drawn over a wet road must not tell the reflection march that the road is
 *    fourteen centimetres closer than it is.
 */
function particleFragment(coverage) {
  return /* glsl */ `
precision highp float;

layout(location = 0) out vec4 gNoctisRain;
layout(location = 1) out highp vec2 gNoctisMotion;

uniform vec3 uChroma;
uniform float uNits;

in vec2 vUv;
in float vGain;
in float vPhase;

void main() {
  vec2 q = vUv * 2.0 - 1.0;
  float coverage = ${coverage};
  gNoctisRain = vec4(uChroma * (uNits * vGain * coverage), 0.0);
  gNoctisMotion = vec2(0.0);
}
`;
}

export function createWeather(options = {}) {
  const cfg = {
    /** Rainfall at boot. 0, and the whole first block comment is why. */
    rainfall: 0,
    ...options,
  };

  const root = new THREE.Group();
  root.name = 'weather';

  /** 0..1, how hard it is raining. */
  let rainfall = Math.max(0, Math.min(1, Number(cfg.rainfall) || 0));
  /** 0..1, how much water is on the surfaces. Seeded from lights at init. */
  let wetness = 0;
  /** While true this module does not write lights.setWetness at all. */
  let pinned = false;

  /** Whether this module is currently the author of the haze and its openness. */
  let hazeDriven = false;
  let opennessDriven = false;

  let hazeDensity = ATM.hazeDensity;
  let hazeScaleHeight = ATM.hazeScaleHeight;

  const layers = [];
  let disposed = false;
  /** True while the particle simulation is running. See the dry path in update(). */
  let simActive = false;

  /** Building occluders of the 3x3 chunks around the camera, refreshed on a move. */
  let occluderPool = [];
  let occluderChunk = null;
  /** The subset of them within reach of the simulated volume. Rebuilt each frame. */
  let occludersNear = [];

  const camPos = new THREE.Vector3();
  const camRight = new THREE.Vector3();
  const camUp = new THREE.Vector3();
  const camFwd = new THREE.Vector3();
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const tmpAxisX = new THREE.Vector3();
  const tmpAxisY = new THREE.Vector3();
  const tmpAxisZ = new THREE.Vector3();
  const tmpMatrix = new THREE.Matrix4();
  const tmpViewProj = new THREE.Matrix4();
  const frustum = new THREE.Frustum();

  const ZERO3 = new THREE.Vector3(0, 0, 0);

  // -------------------------------------------------------------------------

  /**
   * One layer: an InstancedMesh, its hand-written material, and the CPU arrays
   * that drive it.
   *
   * `count` is fixed and every instance is drawn every frame.
   * `mesh.count === instanceMatrix.count` always, because `citycheck` fails a
   * scene in which more than 5% of meshes draw fewer than they allocated, and
   * `harness.particleLayers()` reads the population off `instanceMatrix.count`.
   * A layer that is not raining parks its instances at zero scale — a
   * degenerate quad rasterises no fragments, which costs the vertex shader and
   * nothing else, and it keeps the allocated number honest.
   */
  function makeLayer({ name, count, maxAreaPx, nits, coverage }) {
    const geometry = new THREE.PlaneGeometry(1, 1);
    /** x: radiance gain, y: life phase. One vec2 per instance. */
    const attr = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      attr[i * 2] = 1;
      attr[i * 2 + 1] = 0;
    }
    const attribute = new THREE.InstancedBufferAttribute(attr, 2);
    attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('noctisParticle', attribute);
    /**
     * Huge, and paired with frustumCulled = false. The instances are placed in
     * a volume that follows the camera, so three's per-mesh bounding sphere is
     * a description of where they were when it was last computed. Recomputing
     * it every frame is 700 matrix reads to arrive at "in front of the camera",
     * which is the one thing already known.
     */
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      defines: {
        NOCTIS_PARTICLE_MAX_AREA_PX: maxAreaPx,
        NOCTIS_PARTICLE_MIN_EXTENT_PX: MIN_EXTENT_PX,
      },
      uniforms: {
        uViewportPx: { value: new THREE.Vector2(RENDER.internalWidth, RENDER.internalHeight) },
        uGain: { value: 0 },
        uChroma: { value: new THREE.Vector3(WATER_CHROMA[0], WATER_CHROMA[1], WATER_CHROMA[2]) },
        uNits: { value: nits },
      },
      vertexShader: PARTICLE_VERTEX,
      fragmentShader: particleFragment(coverage),
      /**
       * Additive with the DESTINATION ALPHA PRESERVED. See the fragment
       * shader's header: the HDR target's alpha is linear view depth and the
       * SSR march reads it, so the source alpha is multiplied by zero and the
       * destination by one. Colour is a straight sum, which is what emission
       * through a transmissive medium is.
       *
       * CHECKED AGAINST THREE'S OWN SOURCE RATHER THAN ASSUMED, because
       * `WebGLState.setBlending` contains `blendSrcAlpha = blendSrcAlpha ||
       * blendSrc`. A ZeroFactor that happened to be the number 0 would be
       * falsy, would silently become OneFactor, and every rain fragment would
       * overwrite the depth in the alpha channel with zero — a wet road that
       * reflects nothing, in a shape no gate reads. THREE.ZeroFactor is 200,
       * so the `||` passes it through, and `factorToGL[200]` is `gl.ZERO`.
       * Same habit post.js applies to `setupFrameBufferTexture`.
       */
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendEquationAlpha: THREE.AddEquation,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
      /** Occluded by the world, and never an occluder itself. */
      depthTest: true,
      depthWrite: false,
      transparent: true,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.name = `weather:${name}`;
    mesh.frustumCulled = false;
    mesh.renderOrder = 10;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    /**
     * The census, CONTRACT §9.1. The numeric fields must sum exactly to
     * `instanceMatrix.count`, and `chunk` is a string so it is skipped by the
     * sum. These instances belong to no chunk — they follow the camera — so the
     * key says which system they belong to instead.
     */
    mesh.userData.noctisCensus = { chunk: 'weather', [name]: count };
    /**
     * The particle declaration `harness.particleLayers()` walks the scene for.
     * The COUNT is never read from here; the gate takes it off
     * `instanceMatrix.count`, and it takes the clamp off the material's own
     * defines. This is a label beside a measurement, not the measurement.
     */
    mesh.userData.noctisParticleLayer = { name, maxAreaPx, clampCompileTime: true };

    root.add(mesh);

    const layer = {
      name,
      count,
      mesh,
      geometry,
      material,
      attribute,
      attr,
      /** Instances that drew something this frame. Reported, never used to size anything. */
      active: 0,
    };
    layers.push(layer);
    return layer;
  }

  /** Park instance `i`: zero basis, position left where it was. Degenerate, no fragments. */
  function park(layer, i) {
    tmpMatrix.makeBasis(ZERO3, ZERO3, ZERO3);
    layer.mesh.setMatrixAt(i, tmpMatrix);
  }

  // -------------------------------------------------------------------------
  // Streaks.

  /** World position of every streak. Flat, three floats each. */
  let streakPos = null;
  /** Per-streak scintillation gain, drawn once. See STREAK_NITS. */
  let streakGain = null;
  let streakLayer = null;
  /** Unit vector the wind blows towards, in the ground plane. */
  const windDir = new THREE.Vector2(1, 0);

  /**
   * Seed one streak uniformly in the simulated volume.
   *
   * THE VOLUME IS THE VIEW FRUSTUM TRUNCATED AT 12 M OF RANGE, and that is
   * forced rather than preferred. `budget.json` derived 500 from
   * Marshall-Palmer against a 629.2 m^3 frustum wedge, and the density that
   * makes 500 the right number is 0.791 drops per m^3. A world-axis box of the
   * same 12 m half-width is 24 x 24 x 12 = 6912 m^3 and would need 5450 drops
   * at that density — nearly eight times the entire particle budget — while
   * putting only about 45 of the 500 inside the frame at any instant. The wedge
   * is not a shortcut. It is the only volume in which 500 is the correct number,
   * and the 12 m is CORRIDOR rounded, exactly as the budget says.
   *
   * Range is sampled as 12*cbrt(u) so the density is uniform in space rather
   * than uniform in depth, and the two angular coordinates are the frustum's
   * own normalised ones, so the wrap below is a wrap in a box.
   */
  function seedStreak(rng, i, fromTop) {
    const d = Math.max(
      RAIN_NEAR_M,
      RAIN_RANGE_M * Math.cbrt(Math.max(1e-4, rng.next()))
    );
    const u = rng.range(-1, 1);
    const v = fromTop ? 1 : rng.range(-1, 1);
    placeStreak(i, d, u, v);
    // A wedge that dips below the carriageway would seed drops inside the road.
    if (streakPos[i * 3 + 1] < GROUND_Y) {
      streakPos[i * 3 + 1] = GROUND_Y + rng.range(0, tanHalfY * d * 2);
    }
  }

  /** Normalised frustum coordinates to a world position. Recomputed per frame. */
  let tanHalfX = Math.tan(25 * RAD) * (16 / 9);
  let tanHalfY = Math.tan(25 * RAD);

  function placeStreak(i, d, u, v) {
    const hx = tanHalfX * d;
    const hy = tanHalfY * d;
    const x = camPos.x + camFwd.x * d + camRight.x * (u * hx) + camUp.x * (v * hy);
    const y = camPos.y + camFwd.y * d + camRight.y * (u * hx) + camUp.y * (v * hy);
    const z = camPos.z + camFwd.z * d + camRight.z * (u * hx) + camUp.z * (v * hy);
    streakPos[i * 3] = x;
    streakPos[i * 3 + 1] = y;
    streakPos[i * 3 + 2] = z;
  }

  function updateStreaks(rng, dt, gain) {
    const layer = streakLayer;
    let active = 0;
    const raining = gain > 0;

    for (let i = 0; i < STREAK_COUNT; i++) {
      const o = i * 3;

      if (raining) {
        // Fall, and lean. The horizontal term is the log wind profile at this
        // drop's own height, which is why the streaks are not parallel.
        const y = streakPos[o + 1];
        const u = windSpeedAt(y - GROUND_Y) * dt;
        streakPos[o] += windDir.x * u;
        streakPos[o + 1] = y - DROP_TERMINAL_MS * dt;
        streakPos[o + 2] += windDir.y * u;
      }

      // Where is it, in the frustum's own coordinates?
      tmpA.set(streakPos[o] - camPos.x, streakPos[o + 1] - camPos.y, streakPos[o + 2] - camPos.z);
      let d = tmpA.dot(camFwd);
      if (d < RAIN_NEAR_M || d > RAIN_RANGE_M || tmpA.lengthSq() > RAIN_RANGE_M * RAIN_RANGE_M) {
        seedStreak(rng, i, false);
        tmpA.set(streakPos[o] - camPos.x, streakPos[o + 1] - camPos.y, streakPos[o + 2] - camPos.z);
        d = Math.max(RAIN_NEAR_M, tmpA.dot(camFwd));
      }

      let uu = tmpA.dot(camRight) / (tanHalfX * d);
      let vv = tmpA.dot(camUp) / (tanHalfY * d);
      // The wrap. A drop that leaves the left of the wedge re-enters on the
      // right at the same depth and height, and one that falls out of the
      // bottom re-enters at the top, which is what keeps the stream continuous
      // and the density uniform under a pan.
      let wrapped = false;
      if (uu > 1) { uu -= 2; wrapped = true; } else if (uu < -1) { uu += 2; wrapped = true; }
      if (vv > 1) { vv -= 2; wrapped = true; } else if (vv < -1) { vv += 2; wrapped = true; }
      if (wrapped) placeStreak(i, d, uu, vv);

      // The ground is the other end of a drop's life, and it is the one that
      // makes a splash. A drop below the carriageway restarts at the top.
      if (streakPos[o + 1] < GROUND_Y) {
        seedStreak(rng, i, true);
      }

      if (!raining) {
        park(layer, i);
        continue;
      }

      // Can rain reach here at all? Buildings, from the live chunk descriptions.
      if (sheltered(occludersNear, streakPos[o], streakPos[o + 2], streakPos[o + 1])) {
        park(layer, i);
        continue;
      }

      // A cylindrical billboard about the fall direction: the long axis is the
      // drop's own velocity and the short axis is whatever is perpendicular to
      // both it and the line of sight. A screen-aligned quad would draw a
      // vertical streak while the drop fell at 21 degrees.
      const wind = windSpeedAt(streakPos[o + 1] - GROUND_Y);
      tmpAxisY.set(windDir.x * wind, -DROP_TERMINAL_MS, windDir.y * wind).normalize();
      tmpB.set(camPos.x - streakPos[o], camPos.y - streakPos[o + 1], camPos.z - streakPos[o + 2]);
      tmpAxisX.crossVectors(tmpAxisY, tmpB);
      const len = tmpAxisX.length();
      if (len < 1e-5) {
        // Looking straight down the streak. Nothing to draw and no basis to
        // build one from; the alternative is a NaN matrix.
        park(layer, i);
        continue;
      }
      tmpAxisX.multiplyScalar(STREAK_WIDTH_M / len);
      tmpAxisZ.crossVectors(tmpAxisX, tmpAxisY).normalize();
      tmpAxisY.multiplyScalar(STREAK_LENGTH_M);

      tmpMatrix.makeBasis(tmpAxisX, tmpAxisY, tmpAxisZ);
      tmpMatrix.setPosition(streakPos[o], streakPos[o + 1], streakPos[o + 2]);
      layer.mesh.setMatrixAt(i, tmpMatrix);
      /**
       * The wrap's own artefact, paid for where it happens.
       *
       * A drop that crosses |u| = 1 or |v| = 1 reappears on the far side at
       * full brightness, and TAA cannot hide it because rain writes no motion
       * vector and the neighbourhood clamp therefore rejects its history — it
       * aliases rather than ghosts, exactly as §5.11 says. Fading the outer 6
       * percent of the wedge in each axis costs nothing visible (|u| = 1 IS the
       * frame edge) and removes the pop at its source rather than downstream.
       */
      const edge =
        Math.min(1, (1 - Math.abs(uu)) / 0.06) * Math.min(1, (1 - Math.abs(vv)) / 0.06);
      layer.attr[i * 2] = streakGain[i] * Math.max(0, edge);
      active++;
    }

    layer.active = active;
    layer.mesh.instanceMatrix.needsUpdate = true;
    layer.attribute.needsUpdate = true;
  }

  // -------------------------------------------------------------------------
  // Splashes.

  let splashPos = null;
  let splashAge = null;
  let splashLayer = null;

  /**
   * Try to find a point on the road within SPLASH_RANGE_M that is in the frame
   * and that rain reaches. Returns false if the samples all missed, in which
   * case the instance parks for this frame and tries again on the next one —
   * standing under an awning ought to produce no splashes in front of you.
   */
  function seedSplash(rng, i) {
    // Sampled inside the horizontal field of view rather than over the whole
    // disc and then rejected: at a 79.3 degree horizontal fov a full-circle
    // sample throws away four fifths of its candidates, and an instance that
    // runs out of attempts parks for a frame. The frustum test still runs last,
    // because the fov is not the frustum — the near plane and the vertical
    // planes reject too when the camera is pitched.
    const yaw = Math.atan2(camFwd.x, camFwd.z);
    const halfFovX = Math.atan(tanHalfX);
    for (let attempt = 0; attempt < 8; attempt++) {
      // Uniform in AREA over the sector, which is sqrt of the uniform draw.
      const r = SPLASH_RANGE_M * Math.sqrt(Math.max(1e-4, rng.next()));
      const a = yaw + rng.range(-halfFovX, halfFovX);
      const x = camPos.x + Math.sin(a) * r;
      const z = camPos.z + Math.cos(a) * r;
      if (distanceToCentreline(x, z) > CORRIDOR) continue;
      if (sheltered(occludersNear, x, z, GROUND_Y)) continue;
      tmpB.set(x, GROUND_Y, z);
      if (!frustum.containsPoint(tmpB)) continue;
      splashPos[i * 2] = x;
      splashPos[i * 2 + 1] = z;
      // Staggered rather than synchronised: a fresh crown starts somewhere in
      // its own life, or all 130 would rise and collapse on the same frame.
      splashAge[i] = rng.range(0, SPLASH_LIFE_S);
      return true;
    }
    splashAge[i] = -1;
    return false;
  }

  function updateSplashes(rng, dt, gain) {
    const layer = splashLayer;
    let active = 0;
    const raining = gain > 0;

    for (let i = 0; i < SPLASH_COUNT; i++) {
      if (!raining) {
        splashAge[i] = -1;
        park(layer, i);
        continue;
      }

      if (splashAge[i] >= 0) splashAge[i] += dt;
      if (splashAge[i] < 0 || splashAge[i] >= SPLASH_LIFE_S) {
        if (!seedSplash(rng, i)) {
          park(layer, i);
          continue;
        }
      }

      const t = splashAge[i] / SPLASH_LIFE_S;
      // Rise and collapse. The ring expands through the crown's life and the
      // sheet thins as it goes, so the radiance is a half-sine rather than a
      // decay: a crown is brightest halfway through, not at the instant of
      // impact.
      const radius = SPLASH_CROWN_M * (0.35 + 0.65 * t);
      const fade = Math.sin(Math.PI * t);

      // Flat on the carriageway. `budget.json`: the crown is floor-projected and
      // therefore square. Local +X to world +X, local +Y to world -Z, local +Z
      // to world +Y, which is right-handed.
      tmpAxisX.set(radius, 0, 0);
      tmpAxisY.set(0, 0, -radius);
      tmpAxisZ.set(0, 1, 0);
      tmpMatrix.makeBasis(tmpAxisX, tmpAxisY, tmpAxisZ);
      tmpMatrix.setPosition(splashPos[i * 2], GROUND_Y, splashPos[i * 2 + 1]);
      layer.mesh.setMatrixAt(i, tmpMatrix);
      layer.attr[i * 2] = fade;
      layer.attr[i * 2 + 1] = t;
      active++;
    }

    layer.active = active;
    layer.mesh.instanceMatrix.needsUpdate = true;
    layer.attribute.needsUpdate = true;
  }

  // -------------------------------------------------------------------------
  // Spray.

  let sprayPos = null;
  let sprayAge = null;
  /** Per-puff amplitude. The flux off a tyre scales with the vehicle's speed. */
  let sprayAmp = null;
  let sprayLayer = null;
  /** (x, y, z, speedFraction) per wheel point, refilled by traffic each frame. */
  let sprayQuery = null;
  /** True while the layer is attached to real vehicles rather than the fallback. */
  let sprayFollowsTraffic = false;

  /**
   * Ask the traffic module where its wheels are throwing water.
   *
   * OPTIONAL BY CONSTRUCTION: `traffic` is NOT in `needs`, because a
   * quarantined traffic system must not take the rain down with it, and
   * `ctx.get` returns undefined for a quarantined module.
   *
   * `traffic.sprayPoints(out, max)` fills `out` with (x, y, z, speed/freeSpeed)
   * per moving vehicle and returns how many it wrote. Positions only, which is
   * the right shape: a weather module that had to know what a vehicle IS would
   * be two modules importing each other with extra steps.
   *
   * The return value is validated rather than trusted, and NOT wrapped in a
   * try/catch. A traffic module that throws in here should quarantine
   * something and be logged, not be silently absorbed into a rain layer that
   * then looks merely wrong — that is the same "indistinguishable from the
   * absence of the feature" defect `core/instmotion.js` refuses to allow.
   */
  function querySprayPoints(ctx) {
    const traffic = ctx.get('traffic');
    if (!traffic || typeof traffic.sprayPoints !== 'function') return 0;
    const n = traffic.sprayPoints(sprayQuery, SPRAY_COUNT);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(n | 0, SPRAY_COUNT);
  }

  /**
   * Which way the road runs at (x, z): true when the nearest centreline is one
   * of the x = 128k family, so the carriageway runs along Z and the wheel
   * tracks are offset in X. Same lattice the fallback below uses.
   */
  function roadRunsAlongZ(x, z) {
    const s = CITY.chunkSize;
    return Math.abs(x - Math.round(x / s) * s) <= Math.abs(z - Math.round(z / s) * s);
  }

  /**
   * The fallback, used when traffic is absent or quarantined: the wheel lines
   * of the nearest carriageway, with no vehicle on them. It is spray in the
   * right places thrown by nothing, and `particleStats().sprayFollowsTraffic`
   * is false while it is running so a gate can tell the two apart rather than
   * reading a plausible number and believing it.
   *
   * Right-hand traffic is the authored choice, so heading +X you are on the +Z
   * side (forward cross up is +Z for forward = +X). Two lanes each way in
   * CITY.roadHalfWidth = 7.5 m puts the lane centres at 1.875 m and 5.625 m
   * from the centreline, and a 1.6 m track puts the wheels 0.8 m either side of
   * each: |offset| in {1.08, 2.68, 4.83, 6.43}, mirrored.
   */
  const WHEEL_OFFSETS = [1.075, 2.675, 4.825, 6.425];

  function seedSpray(rng, i, points) {
    if (points > 0) {
      const k = rng.int(0, points - 1);
      const x = sprayQuery[k * 4];
      const z = sprayQuery[k * 4 + 2];
      // Traffic reports one point per vehicle, on its own axis. A car throws
      // from two wheel lines, half a 1.8 m track either side of that axis, and
      // which world axis that is follows from the road lattice rather than
      // from a heading traffic would have had to publish.
      const side = rng.chance(0.5) ? 0.9 : -0.9;
      if (roadRunsAlongZ(x, z)) {
        sprayPos[i * 3] = x + side;
        sprayPos[i * 3 + 2] = z;
      } else {
        sprayPos[i * 3] = x;
        sprayPos[i * 3 + 2] = z + side;
      }
      /**
       * Height, and it is the lifetime's other end. Traffic reports the contact
       * patch at 0.12 m; the plume is thrown to about hub height, and
       * SPRAY_LIFE_S is exactly the time a 150 micron droplet takes to fall
       * back from SPRAY_HEIGHT_M at its Stokes speed. Spawning here and
       * settling at 0.676 m/s puts the puff on the road as its life ends,
       * which is one number doing both jobs rather than two that agree today.
       */
      sprayPos[i * 3 + 1] = SPRAY_HEIGHT_M;
      // The flux off a tyre rises with speed; a stopped car throws nothing.
      sprayAmp[i] = Math.max(0, Math.min(1, sprayQuery[k * 4 + 3]));
      sprayAge[i] = rng.range(0, SPRAY_LIFE_S);
      return;
    }

    const s = CITY.chunkSize;
    const nx = Math.round(camPos.x / s) * s;
    const nz = Math.round(camPos.z / s) * s;
    const offset = WHEEL_OFFSETS[rng.int(0, WHEEL_OFFSETS.length - 1)] * (rng.chance(0.5) ? 1 : -1);
    const along = rng.range(-SPRAY_RANGE_M, SPRAY_RANGE_M);
    if (roadRunsAlongZ(camPos.x, camPos.z)) {
      sprayPos[i * 3] = nx + offset;
      sprayPos[i * 3 + 2] = camPos.z + along;
    } else {
      sprayPos[i * 3] = camPos.x + along;
      sprayPos[i * 3 + 2] = nz + offset;
    }
    sprayPos[i * 3 + 1] = SPRAY_HEIGHT_M;
    sprayAmp[i] = 1;
    sprayAge[i] = rng.range(0, SPRAY_LIFE_S);
  }

  function updateSpray(ctx, rng, dt, gain) {
    const layer = sprayLayer;
    let active = 0;
    const on = gain > 0;
    const points = on ? querySprayPoints(ctx) : 0;
    sprayFollowsTraffic = points > 0;

    for (let i = 0; i < SPRAY_COUNT; i++) {
      if (!on) {
        sprayAge[i] = -1;
        park(layer, i);
        continue;
      }

      if (sprayAge[i] < 0 || sprayAge[i] >= SPRAY_LIFE_S) {
        seedSpray(rng, i, points);
      } else {
        sprayAge[i] += dt;
        // The puff settles under gravity while the wake carries it. Stokes
        // again: 0.676 m/s down, and the wind takes it sideways.
        const fall = 0.676 * dt;
        const u = windSpeedAt(sprayPos[i * 3 + 1]) * dt;
        sprayPos[i * 3] += windDir.x * u;
        sprayPos[i * 3 + 1] = Math.max(GROUND_Y, sprayPos[i * 3 + 1] - fall);
        sprayPos[i * 3 + 2] += windDir.y * u;
      }

      const o = i * 3;
      tmpB.set(sprayPos[o] - camPos.x, sprayPos[o + 1] - camPos.y, sprayPos[o + 2] - camPos.z);
      if (tmpB.lengthSq() > SPRAY_RANGE_M * SPRAY_RANGE_M) {
        park(layer, i);
        continue;
      }
      if (sheltered(occludersNear, sprayPos[o], sprayPos[o + 2], sprayPos[o + 1])) {
        park(layer, i);
        continue;
      }

      const t = Math.max(0, Math.min(1, sprayAge[i] / SPRAY_LIFE_S));
      // A turbulent ball grows and thins. Optical depth falls as the inverse
      // square of the radius, so a puff that has doubled is a quarter as bright.
      const grow = 1 + 1.4 * t;
      const radius = SPRAY_BALL_M * grow;
      const fade = (sprayAmp[i] * (1 - t)) / (grow * grow);

      tmpAxisX.copy(camRight).multiplyScalar(radius);
      tmpAxisY.copy(camUp).multiplyScalar(radius);
      tmpAxisZ.copy(camFwd).multiplyScalar(-1);
      tmpMatrix.makeBasis(tmpAxisX, tmpAxisY, tmpAxisZ);
      tmpMatrix.setPosition(sprayPos[o], sprayPos[o + 1], sprayPos[o + 2]);
      layer.mesh.setMatrixAt(i, tmpMatrix);
      layer.attr[i * 2] = fade;
      layer.attr[i * 2 + 1] = t;
      active++;
    }

    layer.active = active;
    layer.mesh.instanceMatrix.needsUpdate = true;
    layer.attribute.needsUpdate = true;
  }

  // -------------------------------------------------------------------------

  /**
   * Building occluders near the camera, from `city.describe`. Gathered over the
   * 3x3 chunk neighbourhood when the camera changes chunk, then filtered every
   * frame to the boxes the simulated volume can actually touch — nine chunks is
   * a couple of hundred boxes and 500 streaks against all of them is a hundred
   * thousand tests a frame for an answer that involves five of them.
   *
   * The origin block's own buildings are not in `city.describe` — the generator
   * keeps out of BLOCK_KEEPOUT — so `block.occluders` is folded in when the
   * block module is live. Both lookups are optional and both handle undefined:
   * quarantining either must not take the rain down with it.
   */
  function refreshOccluders(ctx) {
    const s = CITY.chunkSize;
    const cx = Math.floor(camPos.x / s);
    const cz = Math.floor(camPos.z / s);
    const key = `${cx},${cz}`;
    if (key !== occluderChunk) {
      occluderChunk = key;
      occluderPool = [];
      const city = ctx.get('city');
      if (city && typeof city.describe === 'function') {
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const d = city.describe(cx + dx, cz + dz);
            if (!d || !Array.isArray(d.occluders)) continue;
            for (const b of d.occluders) occluderPool.push(b);
          }
        }
      }
      const block = ctx.get('block');
      if (block && Array.isArray(block.occluders)) {
        for (const b of block.occluders) occluderPool.push(b);
      }
    }

    const reach = RAIN_RANGE_M + 1;
    occludersNear.length = 0;
    for (let i = 0; i < occluderPool.length; i++) {
      const b = occluderPool[i];
      if (b.x1 < camPos.x - reach || b.x0 > camPos.x + reach) continue;
      if (b.z1 < camPos.z - reach || b.z0 > camPos.z + reach) continue;
      occludersNear.push(b);
    }
  }

  /** density and scale height for a given rainfall. See RAIN_SIGMA_FULL. */
  function hazeFor(r) {
    const rain = RAIN_SIGMA_FULL * Math.pow(r, RAIN_SIGMA_EXPONENT);
    const density = ATM.hazeDensity + rain;
    // Column-matched blend of a 550 m exponential and a slab to the cloud base.
    const scaleHeight =
      (ATM.hazeDensity * ATM.hazeScaleHeight + rain * RAIN_CLOUD_BASE_M) / density;
    return { density, scaleHeight };
  }

  function driveHaze(ctx) {
    const lights = ctx.get('lights');
    if (!lights) return;
    const canyon = ctx.get('canyon');
    const base = canyon && typeof canyon.roadSkyVis === 'number' ? canyon.roadSkyVis : 1;

    if (rainfall <= 0) {
      if (hazeDriven) {
        // The clear-air pair lives in one place, `lib/atmosphere.js`, and
        // `lights.resetHaze()` reads it there. Writing 4.5e-4 here would be a
        // second copy of it and it would drift.
        lights.resetHaze();
        hazeDensity = ATM.hazeDensity;
        hazeScaleHeight = ATM.hazeScaleHeight;
        hazeDriven = false;
      }
      if (opennessDriven) {
        // canyon.js sets this once at init and nothing ever put it back.
        if (lights.setHazeOpenness) lights.setHazeOpenness(base);
        opennessDriven = false;
      }
      return;
    }

    const h = hazeFor(rainfall);
    hazeDensity = h.density;
    hazeScaleHeight = h.scaleHeight;
    lights.setHaze(hazeDensity, hazeScaleHeight);
    hazeDriven = true;

    /**
     * The in-scatter's source function, raised toward the whole hemisphere as
     * it rains harder.
     *
     * `uNoctisHazeOpen` is the fraction of the sky the medium is lit by, and
     * for the aerosol that is the canyon's own aperture, 0.51 measured
     * (canyon.roadSkyVis). Rain is not that medium. Its scatterers are three
     * thousand times the wavelength, so half of Qext = 2 is diffraction into a
     * forward lobe of angular width lambda/D = 0.55e-6/3.28e-3 = 1.7e-4 rad:
     * what a rain veil adds along a sight line is overwhelmingly the radiance
     * of what is BEHIND it, not of the strip of sky above it. Driving openness
     * toward 1 is the cheapest expression of that in a model whose source
     * function is a single sky lookup, and it is an approximation rather than a
     * derivation — stated so, because the alternative is a number that looks
     * measured.
     */
    if (lights.setHazeOpenness) {
      lights.setHazeOpenness(base + (1 - base) * rainfall);
      opennessDriven = true;
    }
  }

  // -------------------------------------------------------------------------

  /**
   * Held so the api's setters can reach `post` and `lights` from outside a
   * frame — `harness.setWetness` and a console call to `setRainfall` both
   * arrive between frames, with no ctx in hand.
   */
  let lastCtx = null;

  const api = {
    /**
     * Pin wetness and stop driving it. What `harness.setWetness` is wired to.
     * While pinned this module does not call `lights.setWetness` at all — see
     * the header. Rainfall, the haze and the particles are unaffected: they are
     * the other state.
     */
    override(v) {
      pinned = true;
      wetness = Math.max(0, Math.min(1, Number(v) || 0));
      // Written ONCE, here, and never again until release(). The integrator may
      // wire `harness.setWetness` to call this INSTEAD of `lights.setWetness`
      // rather than as well as it, so this has to be the write that lands; and
      // if it is wired as well as it, this is the same value twice, which costs
      // one uniform assignment.
      const lights = lastCtx && lastCtx.get('lights');
      if (lights) lights.setWetness(wetness);
      return wetness;
    },
    /** Resume driving wetness from wherever it was pinned. Idempotent. */
    release() {
      pinned = false;
      return wetness;
    },
    /**
     * Set the rainfall state. `post.resetHistory()` when the step is big enough
     * to make the previous frame a description of a different world — see
     * RAINFALL_HISTORY_STEP for the arithmetic. The continuous ramp in
     * `update()` never resets anything.
     */
    setRainfall(r) {
      const next = Math.max(0, Math.min(1, Number(r) || 0));
      const jumped = Math.abs(next - rainfall) >= RAINFALL_HISTORY_STEP;
      rainfall = next;
      if (jumped && lastCtx) {
        const post = lastCtx.get('post');
        if (post && typeof post.resetHistory === 'function') post.resetHistory();
      }
      return rainfall;
    },
    rainfall: () => rainfall,
    wetness: () => wetness,
    /** True while `override()` holds wetness. */
    overridden: () => pinned,
    /**
     * What the gates read. Counts come off the live meshes rather than off the
     * constants above, for the reason `harness.sceneCensus` exists: a label is
     * not a measurement.
     */
    particleStats() {
      return {
        layers: layers.map((l) => ({
          name: l.name,
          allocated: l.mesh.instanceMatrix ? l.mesh.instanceMatrix.count : 0,
          active: l.active,
        })),
        rainfall,
        wetness,
        hazeDensity,
        visibilityM: KOSCHMIEDER / hazeDensity,
        /** False while the spray layer is on its carriageway placeholder. */
        sprayFollowsTraffic,
      };
    },
  };

  /**
   * The camera basis, and the frustum's own half-angles.
   *
   * `updateMatrixWorld()` rather than trusting the order: `needs` is only
   * `lights`, so nothing guarantees this module updates after the camera
   * module. One matrix update is cheaper than a rule nobody can check, and if
   * this does run first the particles are placed around last frame's camera —
   * 0.4 m at the fastest route speed, inside the wrap and invisible.
   */
  function readCamera(ctx) {
    const cam = ctx.camera;
    cam.updateMatrixWorld();
    const e = cam.matrixWorld.elements;
    camRight.set(e[0], e[1], e[2]).normalize();
    camUp.set(e[4], e[5], e[6]).normalize();
    camFwd.set(-e[8], -e[9], -e[10]).normalize();
    camPos.set(e[12], e[13], e[14]);
    tanHalfY = Math.tan((cam.fov * RAD) / 2);
    tanHalfX = tanHalfY * cam.aspect;
    tmpViewProj.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    frustum.setFromProjectionMatrix(tmpViewProj);
  }

  return {
    name: 'weather',
    /**
     * HARD dependency, and the only one. Everything this module produces is
     * consumed through the lights api — the wetness uniform, the haze pair, the
     * openness — and without it there is nothing to drive. `time`, `post`,
     * `city`, `canyon`, `block` and `traffic` are all looked up with
     * `ctx.get()` and all handle undefined: quarantining the canyon bake must
     * not take the rain down with it.
     */
    needs: ['lights'],

    init(ctx) {
      lastCtx = ctx;
      const lights = ctx.get('lights');

      // Wetness is seeded from where lights already put it, which is
      // Number(ctx.config.wet). Reading it back rather than re-reading the
      // config is deliberate: two readers of one config value is how a default
      // and a live value drift apart, and lights clamps it.
      wetness = typeof lights.getWetness === 'function' ? lights.getWetness() : 0;

      const windRng = ctx.rng('weather:wind');
      const a = windRng.range(-Math.PI, Math.PI);
      windDir.set(Math.cos(a), Math.sin(a));

      streakLayer = makeLayer({
        name: 'rain_streak',
        count: STREAK_COUNT,
        maxAreaPx: STREAK_MAX_AREA_PX,
        nits: STREAK_NITS,
        // Across: a gaussian core about one pixel wide inside a three-pixel
        // quad. Along: tapered at both ends, because a motion-blurred drop
        // fades in and out of its own smear rather than starting square.
        coverage: 'exp(-q.x * q.x * 6.0) * smoothstep(1.0, 0.55, abs(q.y))',
      });
      splashLayer = makeLayer({
        name: 'rain_splash',
        count: SPLASH_COUNT,
        maxAreaPx: SPLASH_MAX_AREA_PX,
        nits: SPLASH_NITS,
        // A ring, not a disc: a crown is a hollow sheet of water and the middle
        // of it is the hole the drop went through. The annulus narrows over the
        // crown's life because the sheet's water is conserved while the ring
        // expands, so vPhase moves the inner edge outward.
        coverage:
          'smoothstep(1.0, 0.86, length(q)) * ' +
          'smoothstep(mix(0.10, 0.66, vPhase), mix(0.32, 0.82, vPhase), length(q))',
      });
      sprayLayer = makeLayer({
        name: 'rain_spray',
        count: SPRAY_COUNT,
        maxAreaPx: SPRAY_MAX_AREA_PX,
        nits: SPRAY_NITS,
        // A soft ball, flattening as turbulence mixes it out. No structure: at
        // 12 px across there is none to see.
        coverage: 'exp(-dot(q, q) * mix(3.4, 1.6, vPhase))',
      });

      streakPos = new Float32Array(STREAK_COUNT * 3);
      streakGain = new Float32Array(STREAK_COUNT);
      splashPos = new Float32Array(SPLASH_COUNT * 2);
      splashAge = new Float32Array(SPLASH_COUNT).fill(-1);
      sprayPos = new Float32Array(SPRAY_COUNT * 3);
      sprayAge = new Float32Array(SPRAY_COUNT).fill(-1);
      sprayAmp = new Float32Array(SPRAY_COUNT).fill(1);
      sprayQuery = new Float32Array(SPRAY_COUNT * 4);

      ctx.camera.updateMatrixWorld();
      readCamera(ctx);

      const streakRng = ctx.rng('weather:streak');
      for (let i = 0; i < STREAK_COUNT; i++) {
        seedStreak(streakRng, i, false);
        // The scintillation term. See STREAK_NITS: the drawn radiance is the
        // glint case, which every drop cannot be in at once, so the population
        // is spread over the range a specular alignment produces. Mean 0.56.
        streakGain[i] = streakRng.range(0.12, 1.0);
        park(streakLayer, i);
      }
      for (let i = 0; i < SPLASH_COUNT; i++) park(splashLayer, i);
      for (let i = 0; i < SPRAY_COUNT; i++) park(sprayLayer, i);
      for (const l of layers) l.mesh.instanceMatrix.needsUpdate = true;

      ctx.scene.add(root);

      driveHaze(ctx);

      /**
       * The boot log. CONTRACT §9 rule 4: a number derived from another is
       * printed beside it, with units, at the moment of derivation. Every line
       * below is an argument this module makes, and none of them was printed
       * anywhere before.
       */
      const theta = pixelAngle(ctx.camera, RENDER.internalHeight);
      const full = hazeFor(1);
      ctx.log(
        `weather: rainfall ${rainfall.toFixed(2)} (${(rainfall * RAIN_FULL_MMH).toFixed(1)} mm/h of ` +
        `${RAIN_FULL_MMH} at full), wetness ${wetness.toFixed(3)} seeded from lights.getWetness(); ` +
        `Marshall-Palmer at ${RAIN_FULL_MMH} mm/h gives Lambda ${MP_LAMBDA_FULL.toFixed(4)} /mm, ` +
        `${(MP_N0 / MP_LAMBDA_FULL).toFixed(0)} drops/m3 over all D and ` +
        `${DROP_DENSITY_FULL.toFixed(4)} /m3 at D >= ${DROP_MM} mm, so ${STREAK_COUNT} streaks want ` +
        `${(STREAK_COUNT / DROP_DENSITY_FULL).toFixed(1)} m3 against the budget's 629.2 m3 wedge ` +
        `(${(((STREAK_COUNT / DROP_DENSITY_FULL) / 629.2 - 1) * 100).toFixed(1)}%)`
      );
      ctx.log(
        `weather: wetness tau ${WET_TAU_FULL_S.toFixed(1)} s wet = ${WET_FILM_MM} mm of microtexture / ` +
        `${(RAIN_FULL_MMH / 3600).toExponential(4)} mm/s at ${RAIN_FULL_MMH} mm/h, ` +
        `tau ${DRY_TAU_S.toFixed(0)} s dry = the same ${WET_FILM_MM} mm / ` +
        `${(EVAPORATION_MMH / 3600).toExponential(4)} mm/s of night evaporation ` +
        `(${EVAPORATION_MMH} mm/h) — the ${(DRY_TAU_S / WET_TAU_FULL_S).toFixed(0)}:1 asymmetry is the ` +
        `ratio of the two fluxes moving the same film, and the film depth cancels. ` +
        `Equilibrium wetness is rainfall^${WET_EQUILIBRIUM_EXPONENT} from Manning sheet flow ` +
        `(n 0.011, S 0.025, W ${CITY.roadHalfWidth} m gives h 0.314 mm at full rain, 6x the film). ` +
        `Daytime evaporation is ten times this figure and is not modelled.`
      );
      ctx.log(
        `weather: haze clear ${ATM.hazeDensity.toExponential(3)} /m = ` +
        `${(KOSCHMIEDER / ATM.hazeDensity).toFixed(0)} m visibility (sigma = ${KOSCHMIEDER}/V); ` +
        `full rain adds ${RAIN_SIGMA_FULL.toExponential(4)} /m from 2*(pi/4)*N0*2/Lambda^3, alone ` +
        `${(KOSCHMIEDER / RAIN_SIGMA_FULL).toFixed(0)} m — the empirical V = 1.6*R^-0.63 km fit says ` +
        `375 m at the same rate, 6.7x thicker, because it folds in the mist and spray that come with ` +
        `rain. Total ${full.density.toExponential(4)} /m = ${(KOSCHMIEDER / full.density).toFixed(0)} m ` +
        `at scale height ${full.scaleHeight.toFixed(0)} m (column-matched blend of ` +
        `${ATM.hazeScaleHeight} m aerosol and a slab to ${RAIN_CLOUD_BASE_M} m of cloud base). ` +
        `Drops at D >= ${DROP_MM} mm carry 1.1% of that extinction, so the billboards and the veil ` +
        `double-count by 1.1%, under the spread of the drop-size fit.`
      );
      ctx.log(
        `weather: 1 px = ${theta.toExponential(4)} rad at ${RENDER.internalHeight} lines and ` +
        `${ctx.camera.fov} deg fov, so a ${DROP_MM} mm drop is 1 px at ` +
        `${(DROP_MM / 1000 / theta).toFixed(2)} m and 0.088 px at 35 m — past which extinction is the ` +
        `model and there is no mist system. Streak quad ${(STREAK_WIDTH_M * 1000).toFixed(2)} x ` +
        `${(STREAK_LENGTH_M * 1000).toFixed(1)} mm (the 1/60 s smear at ` +
        `${DROP_TERMINAL_MS.toFixed(3)} m/s), hitting 3 x 56 px at ` +
        `${(STREAK_WIDTH_M / (3 * theta)).toFixed(2)} m. Fill ${STREAK_COUNT}x${STREAK_MAX_AREA_PX} + ` +
        `${SPLASH_COUNT}x${SPLASH_MAX_AREA_PX} + ${SPRAY_COUNT}x${SPRAY_MAX_AREA_PX} = ` +
        `${STREAK_COUNT * STREAK_MAX_AREA_PX + SPLASH_COUNT * SPLASH_MAX_AREA_PX + SPRAY_COUNT * SPRAY_MAX_AREA_PX} px ` +
        `= ${((STREAK_COUNT * STREAK_MAX_AREA_PX + SPLASH_COUNT * SPLASH_MAX_AREA_PX + SPRAY_COUNT * SPRAY_MAX_AREA_PX) / RENDER.pixels * 100).toFixed(3)}% of ` +
        `${RENDER.internalWidth}x${RENDER.internalHeight}. Nits: streak ${STREAK_NITS.toFixed(3)} ` +
        `(the glint case; the ensemble mean is 2.55e-3 and draws nothing), splash ` +
        `${SPLASH_NITS.toFixed(3)}, spray ${SPRAY_NITS.toFixed(3)} cd/m2. Wind ${WIND_10M_MS} m/s at ` +
        `10 m, u* ${WIND_USTAR.toFixed(3)}, so a streak leans ` +
        `${(Math.atan(windSpeedAt(12) / DROP_TERMINAL_MS) / RAD).toFixed(1)} deg at 12 m and ` +
        `${(Math.atan(windSpeedAt(2) / DROP_TERMINAL_MS) / RAD).toFixed(1)} deg at 2 m.`
      );

      return api;
    },

    /**
     * ADVANCE ON THE SIMULATED CLOCK, NOT ON `dt`. CONTRACT §3, and it is a
     * DETERMINISM fix rather than a stylistic one.
     *
     * `dt` is wall-clock seconds and `ctx.get('time')` owns the simulated clock,
     * which can be paused. Every gate that captures a frame steps a number of
     * frames that is NOT fixed — `waitForCity` is bounded by wall clock since
     * this session, precisely so that a fast machine cannot time it out — so a
     * system integrating raw `dt` arrives at each capture in a different state
     * on every run.
     *
     * Measured, on citycheck's saturation peak with identical code and seed:
     * 12.25%, 10.61%, 12.10% across three consecutive runs, a spread of 1.64
     * points against a ceiling of 12.00. A gate straddling its own threshold on
     * noise is a gate that passes or fails at random, and the noise was this.
     *
     * The step is the difference of the time module's own `now`, clamped to the
     * same [0, 0.1] the core clamps `dt` to.
     */
    update(ctx, dtWall) {
      const noctisTime = ctx.get('time');
      const dt = noctisTime
        ? (this._lastNow == null ? 0 : Math.min(0.1, Math.max(0, noctisTime.now - this._lastNow)))
        : dtWall;
      if (noctisTime) this._lastNow = noctisTime.now;
      if (disposed) return;
      lastCtx = ctx;
      const lights = ctx.get('lights');

      /**
       * WETNESS FOLLOWS RAINFALL, WITH exp(-dt/tau) AND NOT A LERP.
       *
       * A lerp by a constant fraction per frame is a time constant that depends
       * on the frame rate, which means the road dries at a different speed on a
       * machine that is struggling — the same class of defect as a capture that
       * depends on how many frames the machine happened to render (CONTRACT §8).
       * exp(-dt/tau) integrates the same first-order relaxation exactly at any
       * dt, including the 0.1 s clamp.
       *
       * tau depends on the DIRECTION, and while wetting it also depends on the
       * rate: the supply is rainfall * 10 mm/h, so the wetting time constant is
       * WET_TAU_FULL_S/rainfall. At half rainfall a road takes 36 s rather than
       * 18 to reach 63% of its equilibrium, which is what halving the supply of
       * water to a fixed film depth does.
       */
      const target = Math.pow(rainfall, WET_EQUILIBRIUM_EXPONENT);
      if (!pinned) {
        const tau = target > wetness
          ? WET_TAU_FULL_S / Math.max(rainfall, 1e-3)
          : DRY_TAU_S;
        const k = Math.exp(-dt / tau);
        wetness = target + (wetness - target) * k;
        if (wetness < 1e-5) wetness = 0;
        if (lights) lights.setWetness(wetness);
      }

      driveHaze(ctx);

      if (!layers.length) return;

      /**
       * THE DRY PATH, AND IT IS AN EARLY RETURN RATHER THAN A LOOP THAT DOES
       * NOTHING.
       *
       * Default rainfall is 0 and every existing gate runs there, so this is
       * the branch the project spends nearly all of its frames in. Parked
       * instances are parked once, and after that the layers cost three draw
       * calls of degenerate quads and no CPU at all — the alternative was 700
       * matrix composes and 44.8 KB of instanceMatrix upload every frame to
       * re-park what was already parked.
       */
      if (rainfall <= 0) {
        if (!simActive) return;
        for (const l of layers) {
          for (let i = 0; i < l.count; i++) park(l, i);
          l.active = 0;
          l.mesh.instanceMatrix.needsUpdate = true;
        }
        simActive = false;
        return;
      }
      readCamera(ctx);
      refreshOccluders(ctx);

      if (!simActive) {
        // Rain has just started. The drops have been sitting where the camera
        // left them, which may be a hundred metres away.
        const seedRng = ctx.rng('weather:streak');
        for (let i = 0; i < STREAK_COUNT; i++) seedStreak(seedRng, i, false);
        for (let i = 0; i < SPLASH_COUNT; i++) splashAge[i] = -1;
        for (let i = 0; i < SPRAY_COUNT; i++) sprayAge[i] = -1;
        simActive = true;
      }

      // The internal buffer, not the drawing buffer. §5.10, and CONTRACT §9's
      // fourth row: session 4 used the drawing-buffer size where the target's
      // size was wanted and put every froxel in the wrong place.
      const post = ctx.get('post');
      const size = post && post.internalSize
        ? post.internalSize
        : { width: RENDER.internalWidth, height: RENDER.internalHeight };
      for (const l of layers) l.material.uniforms.uViewportPx.value.set(size.width, size.height);

      streakLayer.material.uniforms.uGain.value = rainfall;
      splashLayer.material.uniforms.uGain.value = rainfall;
      /**
       * Spray is gated on rainfall AND wetness, and the rainfall half is what
       * keeps the wet look frames unchanged. Physically spray is thrown off a
       * WET road and would belong to wetness alone — but wetness alone would
       * put spray into every frame `harness.setWetness(1)` produces, which is
       * the same defect the two states were separated to avoid, one layer down.
       */
      sprayLayer.material.uniforms.uGain.value = rainfall * wetness;

      updateStreaks(ctx.rng('weather:streak'), dt, rainfall);
      updateSplashes(ctx.rng('weather:splash'), dt, rainfall);
      updateSpray(ctx, ctx.rng('weather:spray'), dt, rainfall * wetness);
    },

    dispose(ctx) {
      if (disposed) return;
      disposed = true;

      const lights = ctx.get('lights');
      if (lights) {
        if (hazeDriven) lights.resetHaze();
        if (opennessDriven && lights.setHazeOpenness) {
          const canyon = ctx.get('canyon');
          lights.setHazeOpenness(canyon && typeof canyon.roadSkyVis === 'number' ? canyon.roadSkyVis : 1);
        }
      }
      hazeDriven = false;
      opennessDriven = false;

      for (const l of layers) {
        root.remove(l.mesh);
        l.mesh.dispose();
        l.geometry.dispose();
        l.material.dispose();
      }
      layers.length = 0;
      ctx.scene.remove(root);
      streakPos = null;
      streakGain = null;
      splashPos = null;
      splashAge = null;
      sprayPos = null;
      sprayAge = null;
      sprayAmp = null;
      sprayQuery = null;
      occluderPool = [];
      occludersNear = [];
      occluderChunk = null;
    },
  };
}
