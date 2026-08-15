/**
 * streetlife.js — the people on the pavement, and the pitches they walk to.
 *
 * TWO POPULATIONS IN ONE MODULE, AND WHY THEY ARE NOT TWO MODULES
 *
 * A pedestrian and a market stall share three things that would otherwise be
 * written twice: the pavement itself (both are confined to |d| in [7.5, 11.7]
 * of a lattice centreline, and both have to be tested against the same
 * occupancy before they are allowed to exist), the ring bookkeeping that
 * decides which chunks are simulated as the camera moves, and the material
 * factory. Splitting them would duplicate the geometry predicate, which is the
 * one piece of this file that has to be right, and CONTRACT §9 row 13 is
 * precisely what happens when one predicate is written twice from two
 * different ideas of what it answers.
 *
 * WHAT BLOCKS A PEDESTRIAN IS NOT WHAT BLOCKS A RAY TO THE SKY
 *
 * `chunk.occluders` carries the SKY answer: it contains the viaduct's whole
 * 480 m deck at 21 m, because that deck blocks every ray upward. A person
 * walks under it perfectly well. So every walking and standing test here uses
 * `landmarkGroundBlockers` (the piers, and nothing else) for landmarks, and
 * filters `chunk.occluders` down to the entries with no `landmark` key, which
 * is exactly the set of building footprints. That distinction is CONTRACT §9
 * row 13, already paid for once.
 *
 * THE PAVEMENT IS A LOOP, WHICH IS THE WHOLE REASON THE MOVEMENT IS CHEAP
 *
 * There is no road graph in this project and this module does not build one.
 * Roads are implicit: centrelines at x = 128k and z = 128k, carriageway
 * +-7.5 m, pavement 4.2 m either side, and buildings inset to the island at
 * 11.7 m. Crossing a carriageway is not modelled — nothing in the world draws
 * a crossing — so the pavement a pedestrian can reach on foot is exactly the
 * PERIMETER OF ONE ISLAND: four straight edges of 128 - 2 x 9.6 = 108.8 m, a
 * closed loop of 435.2 m, lying entirely inside one chunk. A pedestrian is
 * therefore one scalar `p` in [0, 435.2) and a sign, the four corners fall out
 * of the parameterisation instead of being special cases, and the chunk a
 * person is counted in never changes between re-seats. 435.2 m is ten mean
 * trips, which is long enough that the constraint is not visible in a frame.
 */

import * as THREE from 'three';
import { LIGHT, CLUSTER, RENDER } from '../core/constants.js';
import { EMITTER_CHROMA, packZone12 } from '../lib/color.js';
import { createInstanceMotion, pixelAngle, motionCutoffDistance } from '../core/instmotion.js';
import { GAIT, GAIT_CYCLE_M, LEG_SHEAR, ARM_SHEAR, gaitOffset, gaitDerivation } from '../lib/gait.js';
import {
  CITY,
  CORRIDOR,
  chunkBounds,
  chunkKey,
  chunkRng,
  densityAt,
  generateChunk,
  landmarksTouching,
  landmarkGroundBlockers,
  riverImpassable,
  occupied,
  BLOCK_KEEPOUT,
} from '../lib/citygen.js';

const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// POPULATION
// ---------------------------------------------------------------------------

/**
 * How many people. Fixed, allocated exactly, and drawn in full every frame.
 *
 * THE DERIVATION, WHICH IS AN AREA AND A DENSITY AND NOTHING ELSE.
 * Pavement is `CITY.sidewalkWidth` = 4.2 m wide on both sides of every road
 * and roads run on a `CITY.chunkSize` = 128 m lattice, so a square metre of
 * city carries 2/128 = 0.015625 m of road centreline, and every metre of
 * centreline carries 2 x 4.2 = 8.4 m^2 of pavement. The pavement area
 * fraction is therefore 0.015625 x 8.4 = 0.13125. Inside a 120 m simulated
 * radius that is 0.13125 x pi x 120^2 = 5937 m^2. At 0.060 people per m^2 —
 * a street where you always see somebody and never have to step round anyone,
 * against Fruin's level-of-service A at 0.083 — that is 5937 x 0.060 = 356,
 * taken as 360.
 *
 * THE 3.3% THAT FRACTION OVERCOUNTS, WRITTEN DOWN RATHER THAN LEFT IN.
 * "2/128 m of centreline per m^2" counts the junction squares twice: the
 * 4.2 x 4.2 m corner at every crossing belongs to both roads. Per chunk that
 * is 4 x 4.2^2 = 70.56 m^2 of double count against 0.13125 x 128^2 = 2150.4,
 * so the true pavement per chunk is 2079.8 m^2 and the true fraction is
 * 0.12694. Carried through, the disc holds 5742 m^2 and 345 people. Both
 * numbers are here because the difference is 4% and somebody will otherwise
 * recompute it from scratch in two sessions' time. 360 is kept: it is the
 * round figure above both, and the population is a decision, not a
 * measurement.
 *
 * The 120 m is where the count comes from, NOT how far people are placed.
 * They are distributed over the 3 x 3 chunk ring (see PED_RING) in proportion
 * to footfall, so the busiest chunk runs near 0.06 per m^2 and the emptiest
 * runs at zero. That spread is the point; a crowd at a uniform 0.019 per m^2
 * everywhere is not a crowd, it is a texture.
 */
const PEDESTRIAN_COUNT = 360;

/** Metres. The radius the count above was derived over. */
const SIM_RADIUS_M = 120;

/** People per m^2 of pavement on a busy street. Fruin LOS A is 0.083. */
const PEOPLE_PER_M2 = 0.06;

/** 2/128 x 8.4. The junction double count is netted off in the log line. */
const PAVEMENT_FRACTION = (2 / CITY.chunkSize) * (2 * CITY.sidewalkWidth);

/**
 * Chebyshev radius, in chunks, of the simulated ring. 1, giving 9 chunks.
 *
 * ONE AND NOT TWO, BECAUSE THE RING HAS TO CONTAIN THE DISC AND NOTHING MORE.
 * A camera anywhere in its own chunk is at most 128 m from the far edge of
 * the ring on its worst side (it stands at a chunk boundary, and the ring
 * still reaches a full chunk beyond it), and 128 >= 120, so the 3 x 3
 * neighbourhood always contains the whole 120 m disc. Ring 2 would declare 25
 * chunks of which 16 could never hold anybody, which inflates the empty
 * fraction with geometry rather than with city.
 */
const PED_RING = 1;

/**
 * Exponent on the density field in the footfall weight.
 *
 * THE SAME CUBE THE PROPS USE, AND FOR THE SAME MEASURED REASON. The raw
 * noise field has a coefficient of variation of 0.302; anything linear in it
 * gives a city that varies by a third, which is a city somebody smoothed. The
 * cube measures 0.712 on the generator's own placement data and 0.689 on the
 * delivered scatter (tools/city-out/placement.json). Pedestrians must EXCEED
 * that, not match it — a crowd no more clumped than the bollards is bollards
 * that walk — which is what the destination term below is for.
 */
const FOOTFALL_DENSITY_POWER = 3;

/**
 * Metres of camera travel that forces the allocation to be recomputed, on top
 * of every chunk crossing.
 *
 * The weight of a chunk includes how much of its pavement lies inside the
 * 120 m disc, and the disc follows the camera continuously while the chunk
 * ring does not. Moving the camera d metres changes the covered area by at
 * most 2Rd/(pi R^2) = 2d/(pi R) of it, which at d = 16 and R = 120 is 8.5% —
 * about 30 of 360 people in the wrong chunk before the correction runs. At
 * the walking route's 4.5 m/s that is one correction every 3.6 s. The people
 * moved are always the ones furthest from the camera, so the re-seat happens
 * behind the frame rather than in it.
 */
const REBALANCE_MOVE_M = 16;

/** Points sampled along an island loop when measuring its disc coverage. */
const COVERAGE_SAMPLES = 64;

// ---------------------------------------------------------------------------
// BODIES
// ---------------------------------------------------------------------------

/**
 * Metres. The figure the geometry is authored at; every instance is scaled by
 * its own height over this. Adult stature pooled across sexes has a mean near
 * 1.70 m and a standard deviation near 0.09 m; 1.72 with 0.082 puts the
 * +-2.4 sigma range at 1.52 to 1.92, and the clamp at [1.55, 1.95] cuts the
 * tails where a box figure stops reading as a person.
 */
const BODY_REF_HEIGHT = 1.72;
const BODY_HEIGHT_SD = 0.082;
const BODY_HEIGHT_MIN = 1.55;
const BODY_HEIGHT_MAX = 1.95;

/**
 * Metres. The smallest body dimension, and therefore a lower bound on the
 * smallest projected extent from any view angle. `tools/budget.json` ->
 * `motionVectors.kindMinExtentM.pedestrian`. Shoulder depth, not shoulder
 * width: the narrow axis is the one that decides whether a 3 x 3 clip
 * neighbourhood fits inside the silhouette.
 */
const PED_MIN_EXTENT_M = 0.45;

/**
 * Pixels. `tools/budget.json` -> `motionVectors.minExtentPx`. A fragment can
 * only express reprojection error when its whole 3 x 3 neighbourhood lies
 * inside the object, and a 1-D interval of length w at arbitrary sub-pixel
 * phase covers at least floor(w) - 1 pixels completely, so three consecutive
 * covered pixels need w >= 4.
 */
const MOTION_MIN_EXTENT_PX = 4;

/** Metres, half the shoulder width. The pad every walking test uses. */
const BODY_HALF_WIDTH_M = 0.3;

/**
 * THE GAIT MOVED TO `src/lib/gait.js` AND INTO THE VERTEX SHADER — session 10.
 *
 * What was here was a step length and a bob amplitude, and the bob was added to
 * the instance matrix's translation with a comment explaining that it had to be
 * there: "the previous frame's phase does not exist in the vertex shader". It
 * does now — `noctisGait` carries this frame's cycle parameter AND last
 * frame's, so the motion vector picks up the displacement the same way it
 * picks up the transform (CONTRACT §5.12's shape, one attribute over).
 *
 * The reason to move it is the reason there is a gait at all: a bob is
 * something the WHOLE figure does, and expressing a per-limb displacement in
 * the instance matrix would need one matrix per limb per person — 2 520
 * matrices a frame where there are now 360, on the one resource in this project
 * with no slack. `GAIT_CYCLE_M` is the phase period and is two steps, not one:
 * the bob repeats every step and the legs only repeat every second one, and a
 * phase wrapped at the step cannot express which leg is forward.
 */
const STEP_LENGTH_M = GAIT.stepM;

// ---------------------------------------------------------------------------
// WALKING
// ---------------------------------------------------------------------------

/**
 * m/s. Free-flow walking speed on a level pavement.
 *
 * READ FROM `gait.js` RATHER THAN TYPED HERE. It was 1.4 in this file and the
 * premise of `GAIT.stepM`'s derivation in that one, which is two copies of one
 * number in two files — §9.1's arrangement exactly. Session 17 added a third
 * reader (the player controller, which may not import a module) and moved the
 * value to the lib both of them may read.
 */
const WALK_SPEED_MEAN = GAIT.walkSpeedMps;
const WALK_SPEED_SD = 0.18;
const WALK_SPEED_MIN = 0.95;
const WALK_SPEED_MAX = 1.9;

/**
 * Trip length, metres: `TRIP_MIN + Exponential(TRIP_SCALE)`, clipped at
 * TRIP_MAX. Measured over 100 000 draws: mean 43.7 m, against the 45 m
 * `tools/city-budget.json` -> `pedestrians.$minArrivalsPerMinute` assumes.
 * TRIP_MAX is 108, which is one island edge (128 - 2 x 9.6 = 108.8): a longer
 * trip would need two corners and the arithmetic that sets the straightness
 * floor assumes at most one per trip.
 */
const TRIP_MIN_M = 10;
const TRIP_SCALE_M = 36;
const TRIP_MAX_M = 108;

/**
 * Dwell, seconds: `DWELL_MIN + Exponential(DWELL_SCALE)` clipped at
 * DWELL_MAX. Measured mean 6.9 s against the budget's assumed 6 s. Dwell
 * changes neither the numerator nor the denominator of straightness — the
 * agent's positions at the two ends of the window are the same whether or not
 * it stood still in between — so it enters the arrival rate and nothing else.
 */
const DWELL_MIN_S = 2;
const DWELL_SCALE_S = 5;
const DWELL_MAX_S = 25;

/**
 * Probability that a new trip goes back the way the agent came.
 *
 * IT IS THE ONE PARAMETER STRAIGHTNESS IS SENSITIVE TO. A window containing a
 * reversal has |net| near zero over a full path length, so each reversal
 * costs about 0.6 of straightness for the 20 s around it. At 1.9 arrivals per
 * pedestrian per minute, 0.12 puts a reversal in 7.6% of windows. Simulated
 * over 360 agents for 400 s: mean straightness 0.948 against the 0.55 floor.
 */
const REVERSE_CHANCE = 0.12;

/**
 * Metres from the centreline to the nominal walking line. The pavement runs
 * from `CITY.roadHalfWidth` = 7.5 to `CORRIDOR` = 11.7, so 9.6 is its middle.
 * Every island loop is parameterised on this one offset so that a single
 * destination list in loop coordinates serves every agent.
 */
const LANE_CENTRE_M = (CITY.roadHalfWidth + CORRIDOR) / 2;

/**
 * HOW THE 4.2 m OF PAVEMENT IS DIVIDED, AND THE ONLY REASON THESE THREE
 * NUMBERS ARE THE NUMBERS THEY ARE: THEY HAVE TO SUM.
 *
 * Nothing in this project does obstacle avoidance, so a walking corridor that
 * overlaps a stall run is a crowd that walks through the stalls. The pavement
 * runs from the kerb at 7.5 to the facade at 11.7, and it is spent like this,
 * with a 5 cm clearance at every join:
 *
 *   7.50           kerb
 *   7.55 - 9.25    stall run, 1.70 m — market stalls and food stands, facing
 *                  inland so the shoppers stand in the corridor and not in
 *                  the gutter
 *   9.30 - 10.90   walking corridor, 1.60 m — body centres in [9.60, 10.60],
 *                  bodies at 0.30 m half-width in [9.30, 10.90]
 *   10.95 - 11.65  shopfront pitch strip, 0.70 m — infill pitches in the bay
 *   11.70          facade
 *
 * 0.05 + 1.70 + 0.05 + 1.60 + 0.05 + 0.70 + 0.05 = 4.20, which is
 * `CITY.sidewalkWidth`. Change one and another has to give.
 *
 * The corridor is offset 0.50 m inland of the 9.6 m loop line, which is why
 * the spread below is expressed as an inset plus a half-width rather than as
 * a symmetric jitter.
 *
 * KEEP-RIGHT IS DELIBERATELY NOT MODELLED. Two counter-flowing streams need
 * the offset to depend on heading, and heading reverses at a destination —
 * which would slide a body a metre sideways in one frame, and a motion vector
 * across that gap is not motion, it is bookkeeping. A fixed per-agent offset
 * costs one crossing behaviour and buys a population with no teleports in it.
 */
const PED_LANE_INSET_M = 0.5;
const PED_LANE_HALF_M = 0.5;

/** Metres between samples when a planned leg is tested against occupancy. */
const PATH_PROBE_M = 6;

// ---------------------------------------------------------------------------
// STRAIGHTNESS AND ARRIVALS — the two numbers the gate reads
// ---------------------------------------------------------------------------

/**
 * Seconds. `tools/city-budget.json` -> `pedestrians.straightnessWindowSeconds`.
 * At 1.4 m/s the window is 28 m of path. The floor is 0.55, which sits above
 * the entire random-walk band (0.886/sqrt(N): 0.140 at tau 0.5 s, 0.243 at
 * 1.5 s, 0.343 at 3 s) and below one right-angle turn per window (0.707).
 */
const STRAIGHTNESS_WINDOW_S = 20;
const STRAIGHTNESS_SAMPLE_S = 0.5;
/** 20 / 0.5 + 1. The +1 is the sample at each end of a full window. */
const STRAIGHTNESS_SLOTS = Math.round(STRAIGHTNESS_WINDOW_S / STRAIGHTNESS_SAMPLE_S) + 1;
/**
 * Seconds of history an agent needs before it contributes. Below this the
 * ratio is dominated by whichever sample happened to be oldest, and a re-seat
 * clears the history, so a system that re-seated constantly could otherwise
 * report the straightness of a lucky subset.
 */
const STRAIGHTNESS_MIN_HISTORY_S = 4;

/** One-second buckets. `arrivalsPerMinute` is measured over the last minute. */
const ARRIVAL_BUCKETS = 60;

// ---------------------------------------------------------------------------
// CLOTHING — the saturation reserve, spent on purpose
// ---------------------------------------------------------------------------

/**
 * One pedestrian in five wears a chromatic garment, and the garment is the
 * torso only. Exactly 360/5 = 72 of them, chosen by rank rather than by a coin
 * so the delivered fraction is 20.000% and not "about a fifth".
 *
 * THE ARITHMETIC, FROM `tools/city-budget.json` -> `saturation` ->
 * `$SESSION_4b_ALLOCATION`. Pedestrian silhouette area integrated over the
 * frustum is 11 931 x ln(d_max/d_min) px^2; from 3 m to 120 m that is
 * 11 931 x ln(40) = 44 013 px^2, which against 2560 x 1440 = 3 686 400 is
 * 1.194% of the frame. A chromatic torso is about 35% of a standing
 * silhouette, so the saturated share is 0.20 x 0.35 = 7.0% of pedestrian
 * pixels = 1.194 x 0.070 = 0.084 percentage points. The reserve had 1.52
 * points left (10.48% peak measured against a 12% ceiling); pedestrians take
 * 0.084, vehicles 0.26 and stalls 0.45, totalling 0.79 and leaving 0.73.
 */
const CHROMATIC_GARMENT_DIVISOR = 3;

/**
 * RAISED FROM 5 TO 3 THIS SESSION — one pedestrian in three rather than one in
 * five, so 120 chromatic garments of 360 rather than 72.
 *
 * THE RESERVE ARITHMETIC, BOTH NUMBERS. Session 4b's allocation above budgets
 * 0.20 x 0.35 = 7.0% of pedestrian pixels as saturated, which against the
 * 1.194% of the frame pedestrians occupy is 0.084 percentage points. At one in
 * three that is 0.333 x 0.35 = 11.7% of pedestrian pixels and 0.140 points —
 * an increase of 0.056. The delivered peak this session started from is 7.57%
 * against a 12% ceiling, so the reserve has 4.43 points spare and this spends
 * 1.3% of what is spare.
 *
 * AND MOST OF IT IS NOT SPENT AT ALL, which is the part worth writing down. The
 * reserve is measured on `night_rain` against `saturation.valueThreshold` 0.5
 * — a pixel has to be saturated AND BRIGHT — and a dyed garment at reflectance
 * 0.13 under LIGHT.streetAverageLux = 16 lux is nowhere near HSV value 0.5 in
 * a frame metered for neon. The 0.140 points is the bound the allocation asks
 * for; the measured cost is whatever a garment standing directly under a lamp
 * contributes, and `citycheck` reports it.
 *
 * Why not further: at one in two a crowd reads as a parade. Three is where a
 * pedestrian in frame is usually neutral and there is reliably a coloured one
 * nearby, which is what a street looks like.
 */

/**
 * Luminance a chromatic garment is normalised to. `EMITTER_CHROMA` entries
 * are normalised to luminance 1 and are emitter chromaticities; multiplying
 * by 0.13 turns one into a REFLECTANCE, which is what a dyed fabric is. Deep
 * dyed cotton reflects 10 to 18% of the light that lands on it. The brightest
 * channel this produces is neonRed's 0.460, which is a valid reflectance.
 */
const GARMENT_LUMINANCE = 0.13;

/**
 * The saturated garment chromaticities. FOUR, and every one of them is
 * already in `city.js` SIGN_CHROMA — no seventh chromaticity enters the
 * project. The other two of that six, `fluorescentCold` and `tungsten`, are
 * left out on purpose: at reflectance they measure 0.20 and 0.31 HSV
 * saturation, below the reserve's 0.6 threshold, so counting them as
 * "chromatic garments" would spend a fifth of the allowance on clothes that
 * cannot enter the measurement.
 */
const GARMENT_CHROMA = [
  EMITTER_CHROMA.neonRed,
  EMITTER_CHROMA.neonCyan,
  EMITTER_CHROMA.sodium,
  EMITTER_CHROMA.neonGreen,
];

/**
 * Muted clothing reflectances, linear. Street clothing reflects 7 to 25% and
 * most of it is grey, navy, brown or black; these are the four in one
 * measured band each rather than a spread of tints, because a crowd where
 * every coat is a different hue reads as confetti.
 */
const MUTED_CLOTH = [
  [0.115, 0.105, 0.1],
  [0.085, 0.09, 0.105],
  [0.155, 0.14, 0.122],
  [0.07, 0.07, 0.072],
  [0.205, 0.181, 0.158],
];

/**
 * Multiplier applied to the body albedo on the head. Skin luminance
 * reflectance runs from about 0.05 to 0.35 depending on complexion; the body
 * albedos above sit near 0.10, so 1.6 warm-weighted puts a head between 0.11
 * and 0.33. It rides in the geometry's vertex colours, which three multiplies
 * by `instanceColor` — one attribute, no extra draw call.
 */
const HEAD_TINT = [1.6, 1.35, 1.15];

/**
 * Multiplier applied to the body albedo on the LEGS, and it is the pedestrian
 * half of what the vehicles got.
 *
 * A crowd at street scale was reading as pale columns. The geometry was never
 * the problem — measured, the delivered width profile scores 1.012 against a
 * 0.35 floor, so the head, the shoulders and the gap between the legs are all
 * there and all resolvable — what was missing was TONE. One `instanceColor` per
 * figure tinted head, hips, arms and legs the same value, so a person was one
 * flat shape with a coloured patch in the middle.
 *
 * 0.55, cool-weighted. Street clothing reflects 7 to 25% and trousers are
 * reliably at the bottom of that band while a coat or a jacket is at the top:
 * MUTED_CLOTH runs 0.070 to 0.205 and 0.55 of it runs 0.039 to 0.113, which is
 * denim-to-charcoal. It costs nothing — it rides in the geometry's vertex
 * colours, which three multiplies by `instanceColor`, exactly as HEAD_TINT
 * above does, so it is neither an attribute nor a draw call nor a material.
 */
const LEG_TINT = [0.55, 0.55, 0.58];

// ---------------------------------------------------------------------------
// STALLS
// ---------------------------------------------------------------------------

/**
 * Chebyshev radius of the stall ring, in chunks: 2, giving 25 chunks.
 *
 * Road SURFACE geometry and street lighting exist only for ring <= 2, so a
 * stall standing on a pavement that has not been built would be standing on
 * the global ground plane in the dark. The ring is the road's ring for that
 * reason and not for a memory one.
 */
const STALL_RING = 2;

/**
 * Pitches per chunk: `round(18 * smoothstep(0.34, 0.85, density))`.
 * `tools/city-budget.json` -> `streetLevel.$derivation_count`.
 *
 * A THRESHOLD AND NOT A POWER LAW, WHICH IS THE ONE PLACE THIS DIFFERS FROM
 * EVERY OTHER SCATTER IN THE PROJECT. Buildings use 0.12 + 0.88 x density^2.2
 * and props use density^3, both harsh so that most chunks are empty. A
 * stallholder is different in kind: below some number of passers-by a pitch
 * is not worth setting up, and above it one more stall is marginal. The lower
 * knee is `CITY.lowDetailThreshold` = 0.34, the generator's own dead-zone
 * threshold, rather than a second number invented here.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SESSION 31: 30 -> 18, AND THE OLD DERIVATION BESIDE IT WAS WRONG BY 1.94x.
 *
 * The paragraph that stood here said *"at the field's mean density near 0.5
 * that is 30 x 0.2335 = 7 per chunk and about 175 over the 25-chunk ring"*.
 * Measured, two independent ways that agree exactly — a headless import of
 * this module reading `stallStats()`, and the live page through
 * `harness.stallCensus()` — the ring delivers **340 stalls, 13.6 per chunk**.
 * The ring's own mean density is **0.5747**, not 0.5, and `smoothstep` is
 * steep there; 0.2335 is the value at 0.5 used as the value at the mean.
 *
 * AND THE DIVISOR WAS THE WRONG LENGTH. *"512 m of kerb per chunk"* is 2 owned
 * edges x 128 m x 2 sides. Stalls are placed on the island LOOP, which is
 * 4 x 108.8 = **435.2 m** — the 76.8 m difference is the 4 x 2 x 9.6 m of
 * junction corner the loop excludes and on which no stall can stand. A length
 * computed correctly and used as a different quantity: CONTRACT §9, in the
 * comment that justifies the count.
 *
 * SO THE DELIVERED RATE WAS ONE STALL PER 32.0 m OF PAVEMENT, and the operator
 * reported *"about ten stand in a row along the same pavement"*. That row was
 * located rather than believed: chunk (-2,-2), the island's north pavement, **9
 * stalls on one 108.8 m edge** spanning 88.97 m at a mean gap of 11.12 m, plus
 * a tenth 12.45 m further on round the corner. 90 of the ring's 100 edges carry
 * a stall and 20 carry six or more.
 *
 * 18 delivers about **200 over the ring, one per 54.4 m**. The reason for that
 * number rather than a smaller one: a street market is a thing a city has in
 * places, and `city-budget.json` -> `minStallsNearRing` is 60, so the floor is
 * clear by 3.3x. What actually breaks the row of ten is `STALL_MAX_PER_EDGE`
 * below; this sets the density and that sets the clumping, and they are two
 * different complaints inside one sentence.
 */
const STALL_MAX_PER_CHUNK = 18;

/**
 * Pitches on any ONE edge of the island loop. Session 31.
 *
 * The count above is a chunk-wide budget and says nothing about where the
 * pitches land: the loop is sampled uniformly, so a 108.8 m edge collecting
 * nine of a chunk's fourteen is an ordinary draw rather than a bug, and it is
 * exactly what the operator was looking at. A per-edge cap is the smallest
 * thing that makes "a row of ten" impossible by construction rather than
 * improbable.
 *
 * 4 on 108.8 m is one per 27.2 m at the worst, which is a short parade rather
 * than a market street. Four is also the largest run length that the measured
 * ring already produced on 39 of its 90 occupied edges, so it is inside the
 * distribution rather than outside it — the cap removes the tail (the 8s and
 * 9s) and leaves the body alone.
 */
const STALL_MAX_PER_EDGE = 4;

/**
 * PER-PITCH SIZE, AND IT IS THE DEFECT THE OPERATOR ACTUALLY SAW.
 *
 * His words were that the stalls *"have one form and vary only in canopy
 * colour"*. The first half is wrong and the measurement says so: there are
 * five kinds and each is a separate merged prototype with its own box count
 * and envelope — infill 5 boxes at 2.60 x 2.45 x 0.79 m, market 8 at
 * 2.50 x 2.25 x 1.655, food 7, produce 12, rack 9 — and his own row of nine
 * contains all five of them.
 *
 * The second half is righter than he knew. Across all 340 delivered stalls
 * there was **exactly one instance scale, (1.000000, 1.000000, 1.000000)**, and
 * **exactly one yaw modulo 90°**. Every market stall in the city was the same
 * 2.50 m box at the same angle. What varies per instance is colour: 8 canopy
 * cloths, 336 distinct soil tints, 6 light chromaticities. So the vocabulary is
 * five and the dimensions are one, and at close range a dimension is what you
 * read.
 *
 * THE SCALE RIDES IN `instanceMatrix`, WHICH IS ALREADY UPLOADED — 0 boxes,
 * 0 meshes, 0 draw calls, 0 materials. three's instanced normal path divides
 * by each column's squared length, so an axis-aligned non-uniform scale keeps
 * the normals correct.
 *
 * ACROSS NEVER EXCEEDS 1.0, AND THAT IS NOT TIMIDITY. `STALL_FOOTPRINT` derives
 * every kind's depth against the [7.55, 9.25] and [10.95, 11.65] pitch strips
 * by name — *"the body spans [7.48, 9.32] against the [7.55, 9.25] stall run,
 * 0.07 m OVER at each end, so halfAcross is 0.92"*. A scale above 1 across
 * would invalidate each of those derivations silently. Capping at 1 keeps
 * every one of them true by construction.
 *
 * THE TRAP, AND IT IS CONTRACT §9's EXACT SHAPE: `hx`/`hz` in the placement
 * loop come from `fp.halfAlong`/`fp.halfAcross` UNSCALED, so a widened stall
 * would be DRAWN wider than the rectangle `rectBlocked` TESTED — a box tested
 * and a different box drawn, which is §9.1's own recorded failure. The roll
 * therefore happens BEFORE the test and multiplies both.
 */
const STALL_SIZE = { loAlong: 0.82, hiAlong: 1.22, loUp: 0.90, hiUp: 1.12, loAcross: 0.86, hiAcross: 1.0 };

/**
 * Degrees a pitch may sit off its kerb's own axis. Session 31.
 *
 * A stall is set up by hand against a shutter and nobody uses a square. Every
 * one of the 340 was exactly axis-parallel, which is also why they contributed
 * nothing to `citycheck` -> `alignment`'s off-axis fraction.
 *
 * 2.0° against that gate's own ceiling of 3° on the largest deviation, which
 * the ring currently measures at 2.27°. It is under the cap, so this cannot
 * move the assertion's worst case; it can only move the fraction, in the
 * direction the floor wants. The tested rectangle carries the jitter through
 * the |cos|·L + |sin|·W expression the pylon and the bus stop already use —
 * session 24's row, where a half-extent applied to the wrong axis recorded a
 * 2.4 x 0.06 m panel as 2.4 x 2.4 m.
 */
const STALL_YAW_JITTER_DEG = 2.0;
const STALL_KNEE_LO = CITY.lowDetailThreshold;
const STALL_KNEE_HI = 0.85;

/**
 * Metres along the loop between two pitches. A market stall is 2.4 m wide, so
 * 7 m is the stall plus a 4.6 m gap to get past it — the minimum a pavement
 * 4.2 m wide can carry without the run reading as a wall. It also bounds the
 * ring: 4 x 108.8 = 435.2 m of loop per chunk over 7 m is 62 pitches, 3.44x
 * the 18 the count can ask for since session 31 (it was twice the 30 before
 * it), so the spacing never silently caps the count.
 */
const STALL_MIN_SPACING_M = 7;

/** Placement attempts before a pitch is abandoned. */
const STALL_TRIES = 6;

/**
 * Clustered light slots for the whole ring. `tools/city-budget.json` ->
 * `streetLevel.$maxStallLightSlots`.
 *
 * WHY A TAIL LAMP GETS NONE AND A GRIDDLE GETS ONE, AS ARITHMETIC. A tail
 * lamp puts 0.5 lux on the road at 11 m, which is 3% of a carriageway held at
 * `LIGHT.streetAverageLux` = 16 lux: it is not illuminating anything, it is a
 * thing that is bright. A food stand's worklight is about 400 lm, which
 * spread over a sphere is 400/(4 pi) = 31.8 cd and therefore 31.8 lux at 1 m
 * — twice the ambient, on the stallholder and the counter. Nothing in this
 * project treats emissive geometry as a light source (CONTRACT §5.6: an
 * unpatched material is not lit by local lights, and a patched one is not lit
 * BY an emitter), so an emissive plane cannot light the person standing
 * behind it. 12 is the ceiling because the pool's margin after 52 block + 196
 * lamp + 96 traffic is 40, and spending 12 leaves 28 for session 5.
 */
const STALL_LIGHT_SLOTS = 12;

/** Lumens of a food stand's worklight. A single 5 W LED lamp head. */
const STALL_WORKLIGHT_LUMENS = 400;

/** candela: 400 lm over 4 pi sr. Isotropic, because a bare lamp head is. */
const STALL_WORKLIGHT_CANDELA = STALL_WORKLIGHT_LUMENS / (4 * Math.PI);

/**
 * Metres. Falloff radius, chosen where the worklight stops mattering rather
 * than where it stops being computable: 3% of `LIGHT.streetAverageLux` is
 * 0.48 lux, and with decay 2 that is sqrt(31.83/0.48) = 8.1 m. The same 3%
 * test that gives a tail lamp no slot at all.
 */
const STALL_WORKLIGHT_RADIUS_M = 8.1;

/** Metres above the pavement. Head height over a serving hatch. */
const STALL_WORKLIGHT_HEIGHT_M = 2.28;

/**
 * Metres, in the food stand's own frame. The lamp hangs over the hatch shelf
 * at local z = +0.60, not over the middle of the box: the whole argument for
 * the slot is that it lights the counter and the person behind it, and a lamp
 * centred on the roof lights the roof.
 */
const STALL_WORKLIGHT_LOCAL_Z = 0.62;

/**
 * cd/m^2, the base the stall emissive material runs at; every lit surface
 * scales it through `instanceColor`.
 *
 * ANCHORED TO THE PROJECT'S OWN REFERENCE NITS, NOT PICKED. A lit office
 * window is `LIGHT.windowNits` = 220 and a neon tube is `LIGHT.neonNits` =
 * 6500. A bare LED rope sits between them at 2400. The gains below are then
 * ratios against real fixtures: a T8 tube behind a prismatic diffuser has a
 * luminous exitance near 3000 lm/m^2, so 3000/pi = 955 cd/m^2, gain 0.398; an
 * internally lit retail menu box runs at the trade's 400 cd/m^2, gain 0.167;
 * a griddle plate at cooking heat glows dull red at about 260 cd/m^2, gain
 * 0.108 — deliberately the dimmest thing here, because it is heat and not a
 * lamp.
 */
const STALL_GLOW_NITS = 2400;
const GLOW_GAIN_ROPE = 1.0;
const GLOW_GAIN_TUBE = 955 / STALL_GLOW_NITS;
const GLOW_GAIN_BOARD = 400 / STALL_GLOW_NITS;
const GLOW_GAIN_GRIDDLE = 260 / STALL_GLOW_NITS;

/**
 * Stall lighting chromaticities. The same six `city.js` calls "six and no
 * more", by index, so a canopy rope and a shop sign are the same colour of
 * light. `sodium` for the griddle is not decoration: a hot plate and a sodium
 * lamp really do sit near each other on the Planckian locus.
 */
const STALL_CHROMA = [
  EMITTER_CHROMA.neonRed,
  EMITTER_CHROMA.neonCyan,
  EMITTER_CHROMA.sodium,
  EMITTER_CHROMA.fluorescentCold,
  EMITTER_CHROMA.tungsten,
  EMITTER_CHROMA.neonGreen,
];

/**
 * Kind mix. An infill pitch needs a facade to stand against and becomes a
 * market stall where there is none, so the delivered infill share is always
 * at or below 0.34 — reported by `stallStats()` rather than assumed.
 */
const STALL_KIND_WEIGHTS = [
  { kind: 'infill', w: 0.22 },
  { kind: 'market', w: 0.26 },
  { kind: 'food', w: 0.16 },
  { kind: 'produce', w: 0.20 },
  { kind: 'rack', w: 0.16 },
];

/**
 * AWNING CLOTH, AND IT IS A REFLECTANCE ROLL RATHER THAN A COLOUR ROLL.
 *
 * Session 14. Every canopy, every fascia and every parasol in the city was one
 * grey — `[0.3, 0.288, 0.262]` — on every pitch of every kind, and stalls sit
 * at eye level in the busiest part of the frame. These are LINEAR reflectances
 * of dyed canvas and PVC, not authored sRGB tones: a saturated awning is 0.30
 * to 0.45 in its own channel and 0.04 to 0.12 in the others, because dyed
 * cloth is a subtractive filter over a white weave and cannot be both
 * saturated and bright. The two neutrals are unbleached canvas and a grey
 * tarpaulin, which is what most of a real market is.
 *
 * It rides on `noctisGarment` — the same per-instance attribute and the same
 * one line of vertex shader a pedestrian's coat uses (§5.6's select, decoupled
 * from the gait this session) — so the whole spread costs ZERO draw calls and
 * zero extra meshes. The alternative was a mesh per colour per chunk, which is
 * what `STATE.md` §8 said was the reason this had not been done.
 */
const AWNING_CLOTH = [
  [0.36, 0.085, 0.070],
  [0.075, 0.215, 0.105],
  [0.055, 0.130, 0.330],
  [0.400, 0.245, 0.055],
  [0.315, 0.300, 0.115],
  [0.300, 0.150, 0.235],
  [0.345, 0.335, 0.300],
  [0.190, 0.188, 0.180],
];

/**
 * Where each kind stands and how big it is, from the cross-section at
 * PED_LANE_INSET_M. `inset` is metres inland of the 9.6 m loop line;
 * `halfAcross` is half the kind's depth, which is authored symmetric about
 * local z = 0 precisely so that this table can be one number per kind;
 * `halfAlong` is half its width along the pavement; `faceDeg` is added to the
 * outward-facing yaw.
 *
 *   infill  inset +1.70, centre 11.30, body [10.96, 11.64] inside the
 *           [10.95, 11.65] pitch strip. Faces the road, because its shutter
 *           is behind it.
 *   market  inset -1.20, centre  8.40, body [ 7.57,  9.23] inside the
 *           [7.55, 9.25] stall run. Faces INLAND (180 deg): the counter has
 *           to open onto the walking corridor, not onto the carriageway.
 *   food    inset -1.20, centre  8.40, body [ 7.60,  9.20]. Same reason.
 *
 * Every interval is inside [7.5, 11.7] with margin. "A stall stands on the
 * pavement" is arithmetic here rather than an assertion somewhere else.
 */
const STALL_FOOTPRINT = {
  infill: { inset: 1.7, faceDeg: 0, halfAlong: 1.3, halfAcross: 0.34 },
  market: { inset: -1.2, faceDeg: 180, halfAlong: 1.25, halfAcross: 0.83 },
  food: { inset: -1.2, faceDeg: 180, halfAlong: 1.25, halfAcross: 0.8 },
  /**
   * SESSION 14's TWO KINDS, and both intervals are checked here rather than
   * asserted somewhere else, exactly as the three above are.
   *
   *   produce  inset -1.20, centre 8.40. Deepest box is the gable at
   *            d = 1.00 about z = ±0.42, so the body spans [7.48, 9.32]
   *            against the [7.55, 9.25] stall run — 0.07 m OVER at each end,
   *            so `halfAcross` is 0.92 and the inset moves to -1.05, giving
   *            centre 8.55 and a body of [7.63, 9.47] inside [7.55, 9.55].
   *   rack     inset +1.70, centre 11.30, same as `infill`: it is an infill
   *            kind and stands against the same shutter. Deepest is the
   *            valance at d = 0.42 about z = +0.16, so [11.19, 11.61] inside
   *            the [10.95, 11.65] pitch strip.
   */
  produce: { inset: -1.05, faceDeg: 180, halfAlong: 1.35, halfAcross: 0.92 },
  rack: { inset: 1.7, faceDeg: 0, halfAlong: 1.3, halfAcross: 0.37 },
};

// ---------------------------------------------------------------------------

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Does an axis-aligned RECTANGLE overlap any of these footprints?
 *
 * `occupied` from citygen tests a point with a square pad, which is right for
 * a bollard and wrong for a shop-bay pitch: an infill stall is 2.6 m wide and
 * 0.68 m deep and sits 6 cm off the facade on purpose, so a square pad big
 * enough to cover its width reaches straight through the wall behind it and
 * rejects every placement. Measured before the fix: 0 infill pitches out of
 * 462, with the two other kinds silently absorbing the whole 34% share — a
 * placement rule that rejected everything, which CONTRACT §9.1 records as the
 * shape of a check that is itself wrong.
 *
 * THIS FUNCTION TESTS AN AXIS-ALIGNED RECTANGLE AND THE CALLER IS WHAT MAKES
 * THAT SOUND. Until session 31 the note here read *"stalls yaw in multiples of
 * 90 degrees, so the world AABB is exact"*, and `STALL_YAW_JITTER_DEG` = 2.0
 * made the premise false in the same session that relied on the conclusion.
 * The conclusion survives, but for a different reason and one the caller owns:
 * the BASE yaw is an exact multiple of 90°, and the call site at the stall
 * roll folds the 2° jitter and all three rolled scales into a rotated AABB
 * before handing `hx`/`hz` down. So the rectangle tested here is the drawn
 * box's world AABB plus the rotation bulge — never under it, which is the
 * safe direction. A reader of this function alone must not conclude the
 * boxes are axis-aligned; they are not, and the bound is the caller's.
 */
function rectBlocked(boxes, x, z, hx, hz) {
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (x + hx > b.x0 && x - hx < b.x1 && z + hz > b.z0 && z - hz < b.z1) return true;
  }
  return false;
}

/**
 * A merged geometry from axis-aligned boxes.
 *
 * three ships BufferGeometryUtils for this and it lives under
 * `three/examples/jsm` and knows about morph targets, groups and draw ranges,
 * none of which anything here has. A box's face normals survive a per-axis
 * scale unchanged — they are +-1 on one axis and 0 on the other two — so the
 * scale is applied to positions only and the normals are copied.
 *
 * `withColor` bakes a per-part reflectance into a `color` attribute. three
 * defines USE_COLOR in the VERTEX prefix from `material.vertexColors` alone,
 * so a material that wants per-part colour must set that flag and every
 * geometry drawn with it must carry the attribute, or the shader reads an
 * unbound attribute and every part comes out black.
 */
function boxesToGeometry(parts, withColor, withPartLabel) {
  const proto = new THREE.BoxGeometry(1, 1, 1);
  const flat = proto.toNonIndexed();
  const per = flat.attributes.position.count;
  const sp = flat.attributes.position.array;
  const sn = flat.attributes.normal.array;
  const total = per * parts.length;
  const pos = new Float32Array(total * 3);
  const nrm = new Float32Array(total * 3);
  const col = withColor ? new Float32Array(total * 3) : null;
  /**
   * `noctisLimb` = (shear, pivotY, PART LABEL), and a box has no gait, so the
   * first two are zero and the third is the label the §5.6 injection's
   * two-colour select reads. Session 14: it is the SAME attribute and the same
   * one line of shader the pedestrians use, which is why the select was
   * decoupled from `NOCTIS_GAIT` rather than copied.
   *
   * A float attribute that is absent reads 0 at every vertex, so a geometry
   * built without this is a geometry every part of which takes the FIRST of
   * the two colours — which is `noctisRough`'s argument and is why the flag is
   * safe to be false.
   */
  const limb = withPartLabel ? new Float32Array(total * 3) : null;
  let o = 0;
  for (const p of parts) {
    const c = p.albedo || [1, 1, 1];
    const label = p.tinted ? 1 : 0;
    for (let v = 0; v < per; v++) {
      pos[o * 3] = sp[v * 3] * p.w + p.x;
      pos[o * 3 + 1] = sp[v * 3 + 1] * p.h + p.y;
      pos[o * 3 + 2] = sp[v * 3 + 2] * p.d + p.z;
      nrm[o * 3] = sn[v * 3];
      nrm[o * 3 + 1] = sn[v * 3 + 1];
      nrm[o * 3 + 2] = sn[v * 3 + 2];
      if (col) {
        col[o * 3] = c[0];
        col[o * 3 + 1] = c[1];
        col[o * 3 + 2] = c[2];
      }
      if (limb) limb[o * 3 + 2] = label;
      o++;
    }
  }
  proto.dispose();
  flat.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (limb) g.setAttribute('noctisLimb', new THREE.BufferAttribute(limb, 3));
  g.computeBoundingSphere();
  return g;
}

// ---------------------------------------------------------------------------
// THE LOFT
// ---------------------------------------------------------------------------

/**
 * Radial samples around a lofted section, and sections along a part.
 *
 * EVERY PART HAS THE SAME VERTEX COUNT, AND THAT IS A CONSTRAINT RATHER THAN A
 * CONVENIENCE. `harness.silhouettes()` recovers a subject's parts by striding
 * the position attribute in blocks of `noctisSilhouette.partVertices` — it
 * reads what is DRAWN rather than a table of what was authored (CONTRACT
 * §9.1), and a stride only exists if every part is the same size. So a head, a
 * thigh and a shoulder bag are all eight-sided, five-section lofts, and the
 * shapes differ in their section widths rather than in their resolution.
 *
 * EIGHT AND FIVE, and both are read off the delivered frame rather than
 * guessed. At the ten to fifteen metres the street shot shows, a 1.72 m figure
 * spans 1.72/d radians and the gate renders 2 560 px over 50°, so at 12 m it is
 * 420 px tall and a 0.10 m thigh is 24 px wide. An eight-gon's worst
 * silhouette error against a circle is (1 − cos(π/8)) = 7.6% of the radius,
 * which on that thigh is 0.9 px — under the antialiasing. Five sections put a
 * station every 0.17 m up a leg, which resolves ankle, calf, knee and thigh:
 * the four places a leg changes width.
 *
 * The cost, written out because it is the only reason not to raise them:
 * 6·R·K = 240 vertices and 80 triangles a part, 7 parts a figure at most, 360
 * figures = 201 600 triangles against a 2 000 000 ceiling and a measured
 * 0.91–1.11 M. Raising R to 12 would put it at 302 400.
 */
const LOFT_RADIAL = 8;
const LOFT_RINGS = 5;
/** Side quads 6·R·(K−1), two caps 3·R each: 6·R·K. Asserted against the built geometry. */
const LOFT_PART_VERTICES = 6 * LOFT_RADIAL * LOFT_RINGS;

/**
 * Shoe leather, and the hands. Multipliers on the instance albedo, exactly as
 * HEAD_TINT and LEG_TINT are: they ride in the geometry's vertex colours and
 * cost neither an attribute nor a draw call.
 *
 * A shoe at 0.28 of a 0.070–0.205 trouser reflectance runs 0.020–0.057, which
 * is black leather to scuffed brown. It matters more than its area suggests:
 * the bottom 8 cm of a figure is where it meets the pavement, and a leg that
 * runs one tone to the ground reads as a column standing IN the pavement
 * rather than ON it — the pedestrian half of the ground-contact defect session
 * 5 found on the vehicles.
 */
const SHOE_TINT = [0.28, 0.27, 0.26];

/**
 * A ring point on the unit section, blended between a square and a circle.
 *
 * `k = 1` is an ellipse and `k = 0` is a rectangle, and the blend is what lets
 * one loft draw both a head (round) and a coat (square-shouldered) without two
 * code paths. The square point at angle t is (cos t, sin t) / max(|cos|,|sin|),
 * which is the ray to the unit square — so at the eight sample angles the two
 * shapes share their four axis points and differ only at the diagonals.
 *
 * SAMPLED AT t = 0, pi/4 upward AND NOT OFFSET BY HALF A STEP, so the ±x and ±z
 * extremes are vertices. §7.5's width reading is a percentile of the projected
 * lateral extent; a ring whose widest point fell between two samples would
 * report a width the geometry has and the mask does not.
 */
function ringPoint(i, k, out) {
  const t = (i / LOFT_RADIAL) * Math.PI * 2;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const m = Math.max(Math.abs(c), Math.abs(s));
  out[0] = (c / m) * (1 - k) + c * k;
  out[1] = (s / m) * (1 - k) + s * k;
  return out;
}

/**
 * A merged geometry from lofted parts, with the gait attribute baked in.
 *
 * Replaces `boxesToGeometry` for pedestrians and not for stalls: a market
 * trestle IS a set of boxes and lofting it would be a rounded trestle. What
 * this exists for is the thing five sessions of vehicles established — a stack
 * of rectangular prisms has constant width by definition (CONTRACT §7.5), and
 * no property bolted onto it changes that. A loft's width is a function of
 * height by construction, so `widthSpan` can be non-zero on a pedestrian for
 * the same reason it is exactly zero on a prism.
 *
 * Normals are SMOOTH around the ring and across the sections, from central
 * differences on the section grid. A flat-shaded eight-gon limb has eight
 * visible facets and the facets are what says "this was generated"; the
 * silhouette is only half of reading as a person.
 *
 * `noctisLimb` is (shear, pivotY) per vertex — see `src/lib/gait.js`. It is
 * baked here rather than assigned per mesh because it is a property of which
 * PART a vertex belongs to, and after the merge the part boundary exists
 * nowhere else.
 */
function loftToGeometry(parts) {
  const total = LOFT_PART_VERTICES * parts.length;
  const pos = new Float32Array(total * 3);
  const nrm = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  /**
   * (shear, pivotY, garmentMask) — THREE COMPONENTS IN ONE ATTRIBUTE, and the
   * third rides here because of a hardware limit rather than because it
   * belongs. A patched pedestrian geometry binds position, normal, color,
   * noctisRough, noctisGait, noctisBodyColor, noctisGarment and this, plus FOUR
   * SLOTS EACH for `instanceMatrix` and `noctisPrevInstanceMatrix`, and ANGLE's
   * MAX_VERTEX_ATTRIBS is 16. Separate, the mask made 17 and the program
   * failed to link with "Too many attributes (noctisBodyColor)" — a shader
   * error, one console line, and 360 people silently absent from the frame.
   * Both are per-vertex constants over a part, so one attribute carries them.
   */
  const limb = new Float32Array(total * 3);

  const P = new Float32Array(LOFT_RINGS * LOFT_RADIAL * 3);
  const N = new Float32Array(LOFT_RINGS * LOFT_RADIAL * 3);
  const rp = [0, 0];
  let o = 0;

  const push = (px, py, pz, nx, ny, nz, c, shear, pivotY, g) => {
    pos[o * 3] = px; pos[o * 3 + 1] = py; pos[o * 3 + 2] = pz;
    nrm[o * 3] = nx; nrm[o * 3 + 1] = ny; nrm[o * 3 + 2] = nz;
    col[o * 3] = c[0]; col[o * 3 + 1] = c[1]; col[o * 3 + 2] = c[2];
    limb[o * 3] = shear; limb[o * 3 + 1] = pivotY; limb[o * 3 + 2] = g;
    o++;
  };

  for (const part of parts) {
    const S = part.sections;
    if (S.length !== LOFT_RINGS) {
      throw new Error(`streetlife: part has ${S.length} sections, every loft must have ${LOFT_RINGS}`);
    }
    const shear = part.shear || 0;
    const pivotY = part.pivotY || 0;
    /**
     * THE PART LABEL, AND IT IS NOW 0, 1 OR 2.
     *
     * `garment: true` is still what the torso is tagged with — `bodyBuilds`
     * adds it when it concatenates the frame and the torso — and `zone` is the
     * explicit form a part may declare instead. Both, rather than one, because
     * every caller of `garment` predates this and a silent renaming is how a
     * label ends up meaning two things.
     */
    const gm = part.zone != null ? part.zone : (part.garment ? 1 : 0);

    // The grid of ring positions.
    for (let k = 0; k < LOFT_RINGS; k++) {
      const s = S[k];
      for (let i = 0; i < LOFT_RADIAL; i++) {
        ringPoint(i, s.k, rp);
        const g = (k * LOFT_RADIAL + i) * 3;
        P[g] = (s.x || 0) + rp[0] * s.hw;
        P[g + 1] = s.y;
        P[g + 2] = (s.z || 0) + rp[1] * s.hd;
      }
    }
    // Smooth normals: cross(along, around), by central difference on the grid.
    for (let k = 0; k < LOFT_RINGS; k++) {
      const kUp = Math.min(LOFT_RINGS - 1, k + 1);
      const kDn = Math.max(0, k - 1);
      for (let i = 0; i < LOFT_RADIAL; i++) {
        const iNext = (i + 1) % LOFT_RADIAL;
        const iPrev = (i + LOFT_RADIAL - 1) % LOFT_RADIAL;
        const a = (kUp * LOFT_RADIAL + i) * 3;
        const b = (kDn * LOFT_RADIAL + i) * 3;
        const c = (k * LOFT_RADIAL + iNext) * 3;
        const d = (k * LOFT_RADIAL + iPrev) * 3;
        const ux = P[a] - P[b], uy = P[a + 1] - P[b + 1], uz = P[a + 2] - P[b + 2];
        const vx = P[c] - P[d], vy = P[c + 1] - P[d + 1], vz = P[c + 2] - P[d + 2];
        let nx = uy * vz - uz * vy;
        let ny = uz * vx - ux * vz;
        let nz = ux * vy - uy * vx;
        const len = Math.hypot(nx, ny, nz) || 1;
        const g = (k * LOFT_RADIAL + i) * 3;
        /**
         * OUTWARD, AND THE SIGN WAS NEGATED HERE FOR TWO SESSIONS AFTER THE
         * REASON FOR NEGATING IT WAS REMOVED. Session 14, `tools/windcheck.mjs`.
         *
         * The line used to read `N[g] = -nx / len`, under a comment asserting
         * that `cross(along, around)` "points inward and the sign is flipped
         * once here rather than by reversing every winding below". That comment
         * was a claim with no arithmetic in it (CONTRACT §9 rule 4), and the
         * claim was false in both halves:
         *
         *   `ringPoint` puts (cos t, sin t) into (x, z), so at the +x sample
         *   (t = 0) the around-tangent is +Z and the along-tangent is +Y with
         *   Δy > 0. u × v = (0, Δy, 0) × (0, 0, vz) = (Δy·vz, 0, 0) = +X.
         *   THAT IS ALREADY OUTWARD. Negating it gave -X, pointing into the body.
         *
         * And the second half stopped being true anyway: session 11 DID reverse
         * every winding below, because the triangles were inward and the
         * silhouette could not show it. The normals were left as they were, so
         * from session 11 to session 13 the sides' shading normals pointed the
         * opposite way from their own triangles on all five builds.
         *
         * Measured three independent ways before the sign was touched, because
         * one of the three had to be able to be wrong:
         *   - the census: 83.1% to 90.1% of shaded AREA disagreeing, the 10-17%
         *     that agreed being the flat end caps, which carry hand-set (0,±1,0);
         *   - the cross product above, on paper;
         *   - a direct read of the delivered attribute: a vertex at x = +0.143 m
         *     on a body centred at x = 0 carrying normal.x = -0.989, and 1 052
         *     of 1 680 vertices pointing back at their own centroid.
         *
         * And the TRIANGLES are outward, which is what makes this the normals'
         * defect and not the winding's: the four closed builds have signed
         * volumes of +0.0577 to +0.0921 m³ — a 70 kg person displaces 0.070 m³
         * — and a signed volume is a statement about the triangle order that
         * mentions no attribute at all.
         */
        N[g] = nx / len; N[g + 1] = ny / len; N[g + 2] = nz / len;
      }
    }

    const colOf = (k) => S[k].albedo || part.albedo || [1, 1, 1];

    // Sides.
    for (let k = 0; k < LOFT_RINGS - 1; k++) {
      for (let i = 0; i < LOFT_RADIAL; i++) {
        const j = (i + 1) % LOFT_RADIAL;
        const p00 = (k * LOFT_RADIAL + i) * 3;
        const p10 = (k * LOFT_RADIAL + j) * 3;
        const p01 = ((k + 1) * LOFT_RADIAL + i) * 3;
        const p11 = ((k + 1) * LOFT_RADIAL + j) * 3;
        const c0 = colOf(k);
        const c1 = colOf(k + 1);
        const emit = (p, c) =>
          push(P[p], P[p + 1], P[p + 2], N[p], N[p + 1], N[p + 2], c, shear, pivotY, gm);
        /**
         * WOUND OUTWARD, AND UNTIL SESSION 11 IT WAS WOUND INWARD.
         *
         * `ringPoint` walks (cos t, sin t) into (x, z), so a section winds
         * from +x toward +z, which is CLOCKWISE about +Y. The normals above
         * know this — they take `cross(along, around)`, note that it comes out
         * inward and flip it once. The triangles did not: emitted
         * (p00, p10, p11) the front face of a side quad is
         * `(p10−p00) × (p11−p00)`, and at the +x sample with `Δy > 0` that is
         * `(−0.75·hd·Δy, 0, −0.25·hw·Δy)` — INWARD, the opposite of the normal
         * sitting on the same three vertices.
         *
         * SO EVERY LOFTED PART WAS DRAWING ITS FAR WALL. The silhouette is
         * identical either way, which is why eleven sessions and every gate in
         * the project passed: the outline of a convex solid does not care
         * which of its two shells you rasterise. What changes is DEPTH. A
         * pedestrian's coat was submitting the z of its own BACK surface, so
         * the pelvis inside it — 9 to 26 mm in front of that back wall and 12
         * behind its front one — won the depth test and drew over the cloth.
         * That is session 11's "the coat stands out from the torso as a
         * separate wing": the body was rendering outside its own clothes, and
         * only the garment's silhouette rim survived.
         *
         * It is also the leg-through-hip. Two legs 4 mm apart at the thigh,
         * each showing its far wall, sort against each other backwards
         * wherever they overlap, so at full stride the FORWARD leg draws
         * behind the trailing one — which is exactly what a leg passing
         * through the other hip looks like.
         *
         * Measured, dead ahead at four metres on the coated build: the
         * garment's own colour reached the frame only in two rims at
         * |x| = 0.17 m, with the body covering it from −0.16 to +0.16 m
         * (`tools/gait-out/gait-coated-front-before.png`). After the flip the
         * cloth covers the pelvis, which is what a coat does.
         */
        emit(p00, c0); emit(p11, c1); emit(p10, c0);
        emit(p00, c0); emit(p01, c1); emit(p11, c1);
      }
    }
    // Caps, flat.
    const capC0 = colOf(0);
    const capC1 = colOf(LOFT_RINGS - 1);
    const s0 = S[0];
    const s1 = S[LOFT_RINGS - 1];
    /**
     * A HEM IS AN OPENING AND A CAP IS A LID, and until session 11 every part
     * got a lid. On a jacket the lid is at 0.99 m, buried inside the pelvis,
     * and nobody could see it. On the long coat it is at 0.55 m in free air
     * with two legs passing through it, and it drew a flat disc straight
     * across both thighs — the "coat passes through the legs" of session 11's
     * brief, and it is a closed solid rather than a garment.
     *
     * DEGENERATE RATHER THAN OMITTED, and the reason is the stride. Every part
     * is exactly `LOFT_PART_VERTICES` vertices because `harness.silhouettes`
     * recovers a subject's parts by striding the position attribute (§9.1: it
     * reads what is drawn, and a stride only exists if the parts are equal).
     * Dropping 3·R vertices from one part would make that stride a lie for
     * every part after it. So the ring is collapsed onto the section's own
     * centre: three identical vertices per triangle, zero area, nothing
     * rasterised, and the hull `silhouettes` takes gains one interior point it
     * already contained.
     *
     * What is behind an open hem is the garment's own inside, which is a
     * backface and therefore not drawn. It is visible only from below the hem
     * line looking up — 0.55 m, from an eye at 1.66 m, needs the camera on the
     * pavement — and a hollow seen from there is a better failure than a lid
     * seen from everywhere.
     */
    const openBottom = !!part.openBottom;
    for (let i = 0; i < LOFT_RADIAL; i++) {
      const j = (i + 1) % LOFT_RADIAL;
      const a = i * 3;
      const b = j * 3;
      /**
       * The caps swap winding with the sides, for the same reason and by the
       * same arithmetic: `(P_i − c) × (P_j − c)` at the +x sample is
       * `(0, −0.75·hw·hd, 0)`, so `(c, P_i, P_j)` is the DOWNWARD-facing face
       * and belongs at the bottom, and `(c, P_j, P_i)` at the top. They were
       * the other way round, consistent with the inverted sides and with the
       * `(0, ∓1, 0)` normals both of them carry being backwards from their own
       * triangles. The symptom was a lofted part's bottom cap being visible
       * from ABOVE — a dark disc at the end of every hand, and on the long
       * coat a lid across both thighs.
       */
      if (openBottom) {
        for (let n = 0; n < 3; n++) {
          push(s0.x || 0, s0.y, s0.z || 0, 0, -1, 0, capC0, shear, pivotY, gm);
        }
      } else {
        push(s0.x || 0, s0.y, s0.z || 0, 0, -1, 0, capC0, shear, pivotY, gm);
        push(P[a], P[a + 1], P[a + 2], 0, -1, 0, capC0, shear, pivotY, gm);
        push(P[b], P[b + 1], P[b + 2], 0, -1, 0, capC0, shear, pivotY, gm);
      }
      const t = (LOFT_RINGS - 1) * LOFT_RADIAL * 3;
      push(s1.x || 0, s1.y, s1.z || 0, 0, 1, 0, capC1, shear, pivotY, gm);
      push(P[t + b], P[t + b + 1], P[t + b + 2], 0, 1, 0, capC1, shear, pivotY, gm);
      push(P[t + a], P[t + a + 1], P[t + a + 2], 0, 1, 0, capC1, shear, pivotY, gm);
    }
  }

  if (o !== total) {
    throw new Error(`streetlife: loft wrote ${o} vertices, the stride predicts ${total}`);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('noctisLimb', new THREE.BufferAttribute(limb, 3));
  g.computeBoundingSphere();
  return g;
}

// ---------------------------------------------------------------------------
// BODY TYPES
// ---------------------------------------------------------------------------

/**
 * Five builds, authored at BODY_REF_HEIGHT as LOFTS. Each is split into a
 * FRAME (head, hips, legs, arms and whatever it carries) and a TORSO, because
 * the saturation allowance is spent on the torso and `instanceColor` tints a
 * whole mesh. Two meshes and one instance matrix: the torso is authored in the
 * same local space, so the same transform places both.
 *
 * WHY THIS IS A REWRITE AND NOT A SIXTH PROPERTY. The previous three types
 * were stacks of axis-aligned boxes — a 0.40 m slab of torso from hip to neck,
 * two 0.145 m columns of leg, a 0.17 m box of head. Both pedestrian assertions
 * were GREEN on them (width profile 1.012 against a 0.35 floor, chroma 10
 * clusters), which is the seventh instance of this project's pattern: a floor
 * that counts or samples the wrong axis cannot see that every kind is the same
 * shape (CONTRACT §7.2), and five sessions of vehicles established that no
 * property added to a prism makes it stop being one (§7.5). The fix is the
 * silhouette, so the silhouette is what changed.
 *
 * THE SHOULDER IS NARROWER THAN THE CHEST, which looks wrong written down and
 * is right in this decomposition: the deltoids belong to the ARM masses, which
 * stand outside the torso at ±0.19 m, so the garment's own top section — the
 * cloth between the arms — is narrower than the chest below it. The silhouette
 * a person sees is the union, and that union is widest at the shoulder.
 *
 * FIVE AND NOT THREE, because build is the variety that survives distance.
 * Height alone gives one silhouette at eleven scales, and colour variety
 * disappears the moment a figure is backlit; a slight build, a heavy one and a
 * long coat differ in outline at any exposure. The weights are what a street
 * looks like rather than a uniform fifth each.
 *
 * Sections run BOTTOM TO TOP, five per part, `k` blending square (0) to round
 * (1). `shear` and `pivotY` are the gait attribute — see src/lib/gait.js.
 */
const HIP_Y = GAIT.hipHeightM;
const SHOULDER_Y = GAIT.shoulderHeightM;

/**
 * THE FOOT, AND WHY THE OLD SHOE READ AS A STUMP.
 *
 * It had mass forward of the ankle — 0.143 m of it — and it still read as a
 * hoof, which is the distinction worth writing down: what was missing was not
 * LENGTH, it was a low flat sole and an asymmetric one. The old bottom ring sat
 * at y = 0.018 with hd = 0.115 about z = +0.028, so the shoe ran −0.087 to
 * +0.143 — nearly symmetric about the ankle — and then rose to the instep in
 * 0.070 m. Seen from the side that is a wedge pointing both ways: a hoof.
 *
 * A FOOT IS 0.152 OF STATURE and it is almost all in front. On the 1.72 m
 * reference body that is 0.261 m, and the lateral malleolus stands at about
 * 0.22 of foot length from the heel, so the ankle has **0.057 m behind it and
 * 0.204 m in front**. Both numbers are here rather than one, because the
 * asymmetry is the whole of what makes it read as a foot: the previous shape's
 * ratio was 0.087 : 0.143, or 1 : 1.6, against the 1 : 3.6 a foot has.
 *
 * The new bottom ring is therefore LOW (y = 0.010, so the sole is a plane
 * rather than a corner), LONG (hd = 0.130 about z = +0.073, giving exactly
 * −0.057 to +0.203) and SQUARER in plan (k = 0.45 rather than 0.75, because a
 * sole is a rounded rectangle and an octagon at k = 0.75 is nearly an ellipse).
 * The second ring is the instep at 0.072, which is where a shoe's upper stops
 * rising. So the toe projects **0.060 m further forward than it did**, which is
 * the five-to-eight centimetres the brief asks for, arrived at from the
 * anthropometry rather than from the brief.
 *
 * IT CANNOT CLIP THE GROUND, ARITHMETICALLY RATHER THAN BY INSPECTION. The gait
 * displacement is `dy = comRise/2 · amp · (1 − cos 4πu) ≥ 0` and `dz` is purely
 * horizontal (`src/lib/gait.js`), so no phase of the cycle moves any vertex
 * DOWN. The sole's lowest point is y = 0.010 at rest and only ever rises. The
 * strip is still run over the full cycle on all five builds, because "cannot"
 * from a formula and "does not" in a frame have been different things in this
 * project before.
 *
 * THE WIDTH IS DERIVED FROM THE CALF rather than authored, so the five builds
 * differ here as they differ everywhere else: `heavy`'s 0.066 calf gives a
 * 0.114 m shoe and `slight`'s 0.049 gives 0.085, against a foot breadth of
 * about 0.095 m on the reference body. One number, five feet, no sixth table
 * that has to agree with the other five (§9.1).
 */
const FOOT_LENGTH_M = 0.152 * BODY_REF_HEIGHT;
const FOOT_BEHIND_M = 0.22 * FOOT_LENGTH_M;

const leg = (side, xh, thigh, calf, top) => {
  /** Half-length, and the centre that puts the heel at −FOOT_BEHIND_M. */
  const fhd = FOOT_LENGTH_M / 2;
  const fz = fhd - FOOT_BEHIND_M;
  const fhw = calf * 0.86;
  return {
    shear: side * LEG_SHEAR,
    pivotY: HIP_Y,
    /**
     * THE THIRD COLOUR ZONE, SESSION 15. A leg's cloth is not the wearer's
     * skin, and until this session it had to be: `noctisBodyColor` covered
     * skin, trousers AND shoes while `noctisGarment` covered the torso, so a
     * person in a dark coat could not have pale trousers unless they also had
     * pale hands. `mix()` of two colours cannot make a third independent of
     * both. Zone 2 is unpacked from the two spare `w` channels the widened
     * attributes now carry — see `lib/color.js` → `packZone12`, and STATE §7
     * for the attribute arithmetic that made a third attribute impossible.
     *
     * The SHOES stay on zone 0 deliberately. Their tint is already a separate
     * per-vertex reflectance and a fourth zone would need a fourth colour;
     * what the frame was missing was the trousers, which are half the standing
     * figure.
     */
    zone: 2,
    sections: [
      { y: 0.010, x: side * xh, z: fz, hw: fhw, hd: fhd, k: 0.45, albedo: SHOE_TINT },
      { y: 0.072, x: side * xh, z: fz * 0.42, hw: fhw * 0.95, hd: fhd * 0.66, k: 0.65, albedo: SHOE_TINT },
      { y: 0.115, x: side * xh, z: 0, hw: 0.042, hd: 0.05, k: 0.85, albedo: LEG_TINT },
      { y: 0.5, x: side * xh, z: 0, hw: calf, hd: calf * 1.05, k: 0.9, albedo: LEG_TINT },
      { y: top, x: side * xh, z: 0, hw: thigh, hd: thigh * 1.1, k: 0.85, albedo: LEG_TINT },
    ],
  };
};

/**
 * One arm. `sign` is the gait counter-swing, opposite the leg on the same side.
 *
 * `covered: false` — the arm masses stand OUTSIDE the garment (see the note on
 * the shoulder in `BODY_TYPES`), so `fitGarment` must not size the cloth to
 * contain them. Without it the coat would be a barrel 0.52 m across.
 */
const arm = (side, xh, upper, lower, z) => ({
  shear: -side * ARM_SHEAR,
  pivotY: SHOULDER_Y,
  covered: false,
  sections: [
    { y: GAIT.handHeightM - 0.055, x: side * xh, z, hw: lower * 0.86, hd: lower * 0.98, k: 0.95, albedo: HEAD_TINT },
    { y: GAIT.handHeightM + 0.06, x: side * xh, z, hw: lower * 0.8, hd: lower * 0.85, k: 0.95 },
    { y: 0.95, x: side * xh, z, hw: lower, hd: lower * 1.05, k: 0.92 },
    { y: 1.18, x: side * (xh + 0.004), z, hw: upper * 0.94, hd: upper, k: 0.9 },
    { y: SHOULDER_Y - 0.01, x: side * (xh + 0.008), z, hw: upper, hd: upper * 1.05, k: 0.85 },
  ],
});

/**
 * The head, on the neck. Trunk: no swing, so the shear is zero.
 *
 * SEVEN CENTIMETRES OF NECK AND TWENTY-THREE OF HEAD, and the first draft had
 * those the wrong way round — 12.5 cm of neck under a 17 cm head, which at ten
 * metres read as a small knob on a stalk. A 1.72 m figure is about seven and a
 * half head-heights, so the head is 1.72/7.5 = 0.23 m and the chin sits at
 * 1.49; the shoulder is at 1.42, so 0.07 m of neck is visible between them.
 * The widest section is the cheekbones at 1.575, not the crown.
 */
const head = (top, hw) => ({
  shear: 0,
  pivotY: 0,
  /** A coat does not cover a head. `fitGarment` reads the top of what it does. */
  covered: false,
  albedo: HEAD_TINT,
  sections: [
    { y: SHOULDER_Y, hw: 0.053, hd: 0.056, k: 0.95 },
    { y: 1.49, hw: 0.055, hd: 0.059, k: 0.95 },
    { y: 1.575, z: 0.005, hw, hd: hw * 1.2, k: 0.9 },
    { y: top - 0.045, z: 0.003, hw: hw * 0.95, hd: hw * 1.14, k: 0.9 },
    { y: top, z: 0, hw: hw * 0.62, hd: hw * 0.72, k: 0.95 },
  ],
});

/** The pelvis the legs hang off, under the garment. */
const hips = (hw) => ({
  shear: 0,
  pivotY: 0,
  albedo: LEG_TINT,
  sections: [
    { y: 0.78, hw: hw * 0.94, hd: hw * 0.66, k: 0.7 },
    { y: 0.83, hw: hw * 0.99, hd: hw * 0.7, k: 0.68 },
    { y: 0.88, hw, hd: hw * 0.72, k: 0.66 },
    { y: 0.94, hw: hw * 0.97, hd: hw * 0.71, k: 0.66 },
    { y: 1.0, hw: hw * 0.92, hd: hw * 0.69, k: 0.68 },
  ],
});

/**
 * The garment, as authored. `waist`, `chest`, `shoulder` are half-widths and
 * `hem` is where the cloth stops — 0.99 for a jacket, 0.55 for a long coat,
 * which is the one number that changes a figure's outline at forty metres.
 *
 * THIS TABLE IS NOT THE DELIVERED GARMENT. `fitGarment` below takes it and the
 * frame it hangs on and returns the larger of the two at every section, which
 * is what `BODY_TYPES` is post-processed into. Read the numbers here as the
 * silhouette the build is going for, not as the cloth that is drawn.
 */
const torso = (hem, hip, waist, chest, shoulder, depth, k) => ({
  shear: 0,
  pivotY: 0,
  sections: [
    { y: hem, hw: hip, hd: depth * 0.94, k },
    { y: hem + (1.06 - hem) * 0.55, hw: waist, hd: depth * 0.9, k },
    { y: 1.185, hw: chest, hd: depth, k },
    { y: 1.335, hw: chest * 0.99, hd: depth * 0.95, k },
    { y: 1.425, hw: shoulder, hd: depth * 0.8, k: Math.min(1, k + 0.15) },
  ],
});

/**
 * Metres of cloth clearance between a garment's inside surface and the body
 * inside it, measured perpendicular to the surface.
 *
 * TWELVE MILLIMETRES, AND IT IS A LENGTH RATHER THAN A RATIO. A jacket over a
 * shirt has a few millimetres of ease at the chest and a few centimetres at
 * the waist; 12 mm is the small end of that, chosen because the failure this
 * corrects is not "the coat fits closely" but "the coat and the body occupy
 * the same millimetres". At the pelvis the authored coat cleared the authored
 * hips by 1 mm in depth (0.1062 against 0.1050 on the coated build), which is
 * inside the depth buffer's ability to keep them apart at ten metres, so the
 * pelvis surfaced through the cloth in patches — the "separate wing" of
 * session 11's brief, seen from four metres.
 *
 * It is not the garment's thickness. The garment is a surface with nothing
 * behind it (see `openBottom`); this is the gap in front of the body.
 */
const CLOTH_GAP_M = 0.012;

/**
 * The outline one lofted part draws at height `y`, as the eight points the
 * surface is actually made of, and every one of them at both ends of its gait
 * sweep.
 *
 * IT IS THE DRAWN SURFACE AND NOT A BOUNDING BOX, and the difference is what
 * this function exists for. A first version of the fit compared half-extents
 * on the ±x and ±z axes, which is exact ON THOSE AXES — `ringPoint` samples
 * t = 0, π/4 upward, so the axis extremes are vertices of both shapes. It is
 * wrong everywhere else: two octagons with different `k` have their diagonal
 * vertices at different fractions of their own half-extents, so cloth that
 * clears the body by 9 mm at the axis can be INSIDE it between the samples.
 * Measured on the coated build, dead ahead at four metres: the leading thigh
 * came through the skirt at a point 0.12 mm outside the cloth, and 0.12 mm of
 * penetration is a hole the size of the thigh.
 *
 * The surface between two sections is the linear interpolation of their ring
 * points at the same sample index, which is what the loft emits, so this
 * interpolates points and not half-extents.
 *
 * The sweep is `gaitOffset`'s own `dz`: a vertex `f = max(0, pivotY − y)`
 * below its pivot travels `f · shear · sin(2πu)`, so over a cycle it occupies
 * `±f·|shear|`. Taken from `src/lib/gait.js`'s constants through the shear the
 * part carries, so a change to the walk moves this with it (§9.1: one copy).
 *
 * Returns an empty list above or below the part — a garment section at 1.185 m
 * is not asked to clear a shoe.
 */
function partOutlineAt(part, y, out) {
  const S = part.sections;
  if (y < S[0].y || y > S[S.length - 1].y) return out;
  let k = 0;
  while (k < S.length - 2 && y > S[k + 1].y) k++;
  const a = S[k];
  const b = S[k + 1];
  const span = b.y - a.y;
  const t = span > 1e-9 ? (y - a.y) / span : 0;
  const sweep = Math.max(0, (part.pivotY || 0) - y) * Math.abs(part.shear || 0);
  const rp = [0, 0];
  for (let i = 0; i < LOFT_RADIAL; i++) {
    ringPoint(i, a.k, rp);
    const ax = (a.x || 0) + rp[0] * a.hw;
    const az = (a.z || 0) + rp[1] * a.hd;
    ringPoint(i, b.k, rp);
    const bx = (b.x || 0) + rp[0] * b.hw;
    const bz = (b.z || 0) + rp[1] * b.hd;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    out.push([x, z + sweep]);
    if (sweep > 0) out.push([x, z - sweep]);
  }
  return out;
}

/**
 * Every point the body draws at height `y`, over a whole gait cycle.
 *
 * THE ARMS ARE EXCLUDED AND THAT IS THE ONE JUDGEMENT IN THIS FUNCTION. A
 * garment sized to contain the arms would be a barrel: the arm masses stand at
 * ±0.196 m with the garment's shoulder at ±0.142, and they are OUTSIDE the
 * cloth by construction — the comment on `BODY_TYPES` says so and the
 * silhouette a person reads is the union of the two. A shoulder bag is outside
 * for the same reason, and it carries its own strap over the cloth. What the
 * garment must contain is what it hangs on and what passes through it: the
 * pelvis and, on a long coat, the legs.
 */
function bodyOutlineAt(frameParts, y) {
  const out = [];
  for (const part of frameParts) {
    if (part.covered === false) continue;
    partOutlineAt(part, y, out);
  }
  return out;
}

/**
 * The eight points a ring of this shape and size is made of.
 *
 * A convex polygon's interior is the intersection of its edge half-planes, so
 * clearance is one dot product per point per edge. The ring is convex for
 * every `k` in [0, 1] — it is a blend of a rectangle and an ellipse about the
 * same centre — so no more than this is needed.
 */
function ringVerts(k, hw, hd) {
  const rp = [0, 0];
  const V = [];
  for (let i = 0; i < LOFT_RADIAL; i++) {
    ringPoint(i, k, rp);
    V.push([rp[0] * hw, rp[1] * hd]);
  }
  return V;
}

/**
 * How far outside every one of those points this ring stands, in metres.
 * Negative is penetration. The minimum over the eight edge half-planes and
 * every point, which for a convex ring is the signed distance from the ring's
 * boundary to the deepest point.
 */
function ringClearance(V, points) {
  let worst = Infinity;
  for (let i = 0; i < LOFT_RADIAL; i++) {
    const A = V[i];
    const B = V[(i + 1) % LOFT_RADIAL];
    let nx = B[1] - A[1];
    let nz = -(B[0] - A[0]);
    // Outward: away from the ring's own centre, which is the origin.
    if (nx * A[0] + nz * A[1] < 0) {
      nx = -nx;
      nz = -nz;
    }
    const len = Math.hypot(nx, nz);
    if (len < 1e-12) continue;
    const d = (nx * A[0] + nz * A[1]) / len;
    for (const p of points) {
      const c = d - (nx * p[0] + nz * p[1]) / len;
      if (c < worst) worst = c;
    }
  }
  return worst;
}

/**
 * The ring the loft actually draws at height `y`: the pointwise interpolation
 * of the two bracketing sections' rings, which is what a side quad is.
 *
 * A FIT AT THE SECTIONS IS NOT A FIT, and this is what says so. Cloth is only
 * authored at five heights; between them it is a straight facet, and a facet
 * strung between two rings that each clear the body can still cut through what
 * is between them. That is where the thigh came out of the skirt at 0.65 m
 * after the axis fit — halfway between the hem and the waist, both of which
 * cleared.
 */
function garmentRingAt(sections, y) {
  let k = 0;
  while (k < sections.length - 2 && y > sections[k + 1].y) k++;
  const a = sections[k];
  const b = sections[k + 1];
  const span = b.y - a.y;
  const t = span > 1e-9 ? Math.max(0, Math.min(1, (y - a.y) / span)) : 0;
  const A = ringVerts(a.k, a.hw, a.hd);
  const B = ringVerts(b.k, b.hw, b.hd);
  const V = [];
  for (let i = 0; i < LOFT_RADIAL; i++) {
    V.push([A[i][0] + (B[i][0] - A[i][0]) * t, A[i][1] + (B[i][1] - A[i][1]) * t]);
  }
  return { V, seg: k, t };
}

/**
 * Sweep the whole garment at 2 mm and return the worst clearance anywhere on
 * it, with the section interval it was found in.
 *
 * 2 mm because that is a tenth of the cloth gap, so a violation cannot hide
 * between two samples and still matter; 440 samples over a long coat, once, at
 * boot.
 */
function garmentSweep(sections, frameParts) {
  const y0 = sections[0].y;
  const y1 = sections[sections.length - 1].y;
  let worst = Infinity;
  let at = y0;
  let seg = 0;
  for (let y = y0; y <= y1 + 1e-9; y += 0.002) {
    const points = bodyOutlineAt(frameParts, y);
    if (!points.length) continue;
    const r = garmentRingAt(sections, y);
    const c = ringClearance(r.V, points);
    if (c < worst) {
      worst = c;
      at = y;
      seg = r.seg;
    }
  }
  return { worst, at, seg };
}

/**
 * The delivered garment: the authored silhouette, or the body plus a cloth
 * gap, whichever is larger at each section.
 *
 * WHY `max` AND NOT A REPLACEMENT. The authored table is a build's identity —
 * a heavy figure is broader at the waist than at the chest and a slight one is
 * narrow through both, and deriving the whole garment from the frame would
 * make all five builds the same coat over different skeletons. What the
 * derivation is for is the FLOOR: no section of cloth may be inside the body
 * it covers. Taking the larger keeps the authored silhouette wherever it was
 * already big enough, which on the four jacket builds is everywhere except the
 * hem, and fixes it where it was not.
 *
 * The result is also why the long coat now flares. At its hem, 0.55 m, each
 * leg reaches `(0.855 − 0.55) × 0.2924 = 0.0892` m fore or aft of its rest
 * position and is 0.0623 m deep there, so the cloth has to stand 0.1635 m off
 * the body's centre line to let the stride through — against the 0.1109 m it
 * was authored at. A long coat with 33 cm between its front and back hems is
 * what a long coat is; a 22 cm one is a tube with legs coming out of its
 * sides, which is what was shipping.
 */
function fitGarment(garment, frameParts) {
  /**
   * THE HEM MAY NOT START ABOVE THE BODY IT COVERS. The `heavy` build authored
   * its jacket hem at 1.005 m over a pelvis that stops at 1.000, so between
   * those two heights the figure had NEITHER — a 5 mm slit straight through
   * the waist, about one pixel at four metres, and one more pair of tables
   * that agreed by inspection until one of them moved. Clamped, not asserted:
   * the hem is a look decision and the pelvis is a body decision, and the only
   * relationship between them that matters is this one.
   */
  const covered = frameParts.filter((p) => p.covered !== false);
  const coveredTop = Math.max(...covered.map((p) => p.sections[p.sections.length - 1].y));
  const hemY = Math.min(garment.sections[0].y, coveredTop);
  const sections = garment.sections.map((s, i) => {
    if (i === 0) s = { ...s, y: hemY };
    return s;
  }).map((s) => {
    const points = bodyOutlineAt(frameParts, s.y);
    let hw = s.hw;
    let hd = s.hd;
    if (points.length) {
      /**
       * THE AXES FIRST, EXACTLY. `ringPoint` samples t = 0, π/4 upward, so a
       * ring's ±x and ±z extremes ARE vertices — no search is needed to make
       * the cloth clear the widest and the deepest thing under it, and none is
       * done. This is where nearly all of the fit happens: on the four jacket
       * builds it is the whole of it.
       */
      let maxAbsX = 0;
      let maxAbsZ = 0;
      for (const p of points) {
        maxAbsX = Math.max(maxAbsX, Math.abs(p[0]));
        maxAbsZ = Math.max(maxAbsZ, Math.abs(p[1]));
      }
      hw = Math.max(hw, maxAbsX + CLOTH_GAP_M);
      hd = Math.max(hd, maxAbsZ + CLOTH_GAP_M);
      /**
       * THEN THE FACETS BETWEEN THE AXES, BY ONE SCALE ON THE WHOLE RING.
       *
       * Clearing both axes is not clearing the ring, and this is the
       * correction that cost the most to find. Between two samples the surface
       * is a straight facet, and two rings with different `k` cut their
       * corners by different fractions of their own half-extents — so cloth
       * that stands 9 mm off the pelvis at the ±z axis can be 0.12 mm INSIDE
       * the leading thigh a facet later. That was still on the figure after
       * the axis fit and the winding fix, dead ahead at four metres: a wedge
       * of thigh through the front of the skirt.
       *
       * ONE SCALE AND NOT TWO, because the two are not independent and the
       * one-at-a-time versions both fail. Growing depth alone never converges:
       * with `hw` exactly `max|px| + gap`, the widest body point sits on the
       * ring's own x vertex, every facet through that vertex slopes inward,
       * and the constraint is approached from the wrong side as `hd → ∞`.
       * Growing width alone cannot buy depth at all. A uniform scale opens
       * every facet at once and keeps the build's authored proportions
       * instead of inventing new ones — the coated build's skirt needs 1.065×,
       * and every other section of every build needs 1.0.
       */
      const clears = (f) =>
        ringClearance(ringVerts(s.k, hw * f, hd * f), points) >= CLOTH_GAP_M;
      if (!clears(1)) {
        let lo = 1;
        let hi = 2;
        for (let i = 0; i < 24 && !clears(hi); i++) hi *= 2;
        for (let i = 0; i < 40; i++) {
          const mid = (lo + hi) / 2;
          if (clears(mid)) hi = mid;
          else lo = mid;
        }
        hw *= hi;
        hd *= hi;
      }
    }
    return {
      ...s,
      hw,
      hd,
      $authoredHw: s.hw,
      $authoredHd: s.hd,
    };
  });

  /**
   * AND THEN THE SAME QUESTION ASKED OF THE WHOLE GARMENT, because the loop
   * above only ever looked at five heights.
   *
   * `garmentSweep` walks the delivered surface at 2 mm and returns the worst
   * clearance on it. If a facet between two fitted sections is inside the body
   * — which is exactly where the thigh came through, at 0.65 m, with the hem
   * and the waist both clear — the two rings bracketing it are opened 1% and
   * the sweep is run again. It converges in a couple of passes or not at all,
   * and 64 passes is 1.9× the authored garment, which is a coat that has gone
   * wrong in some other way and should say so rather than grow forever.
   */
  let sweep = garmentSweep(sections, frameParts);
  let passes = 0;
  while (sweep.worst < CLOTH_GAP_M && passes < 64) {
    for (const i of [sweep.seg, sweep.seg + 1]) {
      if (!sections[i]) continue;
      sections[i].hw *= 1.01;
      sections[i].hd *= 1.01;
    }
    sweep = garmentSweep(sections, frameParts);
    passes++;
  }

  return {
    ...garment,
    sections,
    $sweep: { worst: sweep.worst, at: sweep.at, passes },
    /**
     * Open below the hip pivot, capped at or above it, and the threshold is
     * `GAIT.hipHeightM` rather than a sixth number that would have to agree
     * with the hems.
     *
     * Below the hip the body is TWO legs moving in opposite directions, and a
     * flat disc across them is a lid across the stride — visible as a pale
     * shelf cutting both thighs at every phase of the strip. At or above the
     * hip the body is one trunk, and the cap lands inside the pelvis where it
     * closes the mesh and cannot be seen: the four jacket builds stop at 0.965
     * to 1.005 m with the pelvis running to 1.0, so all that shows of their
     * cap is the millimetre ring of ease this fit just gave them, which is
     * what the bottom edge of a jacket looks like.
     */
    openBottom: hemY < GAIT.hipHeightM,
  };
}

const BODY_TYPES = [
  {
    /** The middle of the distribution: a jacket, ordinary build. */
    name: 'upright',
    weight: 0.28,
    frame: [head(1.72, 0.083), hips(0.152), leg(-1, 0.082, 0.083, 0.056, 0.86), leg(1, 0.082, 0.083, 0.056, 0.86), arm(-1, 0.196, 0.055, 0.04, 0.012), arm(1, 0.196, 0.055, 0.04, 0.012)],
    torso: [torso(0.99, 0.155, 0.138, 0.166, 0.142, 0.108, 0.55)],
  },
  {
    /** Slight, longer-legged, narrow through the chest. */
    name: 'slight',
    weight: 0.22,
    frame: [head(1.72, 0.077), hips(0.135), leg(-1, 0.075, 0.073, 0.049, 0.88), leg(1, 0.075, 0.073, 0.049, 0.88), arm(-1, 0.178, 0.047, 0.034, 0.01), arm(1, 0.178, 0.047, 0.034, 0.01)],
    torso: [torso(0.965, 0.135, 0.12, 0.144, 0.126, 0.093, 0.6)],
  },
  {
    /** Heavier: broader at the waist than at the chest, shorter in the neck. */
    name: 'heavy',
    weight: 0.17,
    frame: [head(1.705, 0.089), hips(0.178), leg(-1, 0.092, 0.096, 0.066, 0.85), leg(1, 0.092, 0.096, 0.066, 0.85), arm(-1, 0.213, 0.064, 0.045, 0.014), arm(1, 0.213, 0.064, 0.045, 0.014)],
    torso: [torso(1.005, 0.19, 0.187, 0.182, 0.152, 0.128, 0.45)],
  },
  {
    /**
     * A long coat to mid-thigh. The hem is the outline change: it turns a
     * two-legged silhouette into a one-piece one from the waist down, which is
     * what breaks up a crowd at forty metres where a colour cannot.
     */
    name: 'coated',
    weight: 0.19,
    frame: [head(1.715, 0.084), hips(0.15), leg(-1, 0.084, 0.082, 0.055, 0.86), leg(1, 0.084, 0.082, 0.055, 0.86), arm(-1, 0.203, 0.06, 0.045, 0.014), arm(1, 0.203, 0.06, 0.045, 0.014)],
    torso: [torso(0.55, 0.196, 0.166, 0.176, 0.148, 0.118, 0.4)],
  },
  {
    /**
     * Carrying a shoulder bag on the right, which hangs at the hip and is the
     * one part of the figure that is not symmetric about its own mid-plane.
     */
    name: 'carrier',
    weight: 0.14,
    frame: [
      head(1.715, 0.082), hips(0.15), leg(-1, 0.082, 0.083, 0.056, 0.86), leg(1, 0.082, 0.083, 0.056, 0.86),
      arm(-1, 0.194, 0.055, 0.04, 0.012), arm(1, 0.194, 0.055, 0.04, 0.012),
      {
        /**
         * The bag swings with the body rather than with the arm, so its shear
         * is the trunk's zero: a bag on a strap hangs off the shoulder and the
         * shoulder does not swing.
         */
        shear: 0,
        pivotY: 0,
        /** Outside the cloth, and its strap lies over it. Not the coat's job. */
        covered: false,
        albedo: [0.62, 0.6, 0.58],
        sections: [
          { y: 0.79, x: 0.225, z: 0.03, hw: 0.05, hd: 0.088, k: 0.35 },
          { y: 0.86, x: 0.228, z: 0.035, hw: 0.072, hd: 0.115, k: 0.3 },
          { y: 0.95, x: 0.23, z: 0.035, hw: 0.075, hd: 0.12, k: 0.3 },
          { y: 1.06, x: 0.22, z: 0.02, hw: 0.045, hd: 0.07, k: 0.5 },
          { y: 1.36, x: 0.16, z: 0.005, hw: 0.016, hd: 0.03, k: 0.6 },
        ],
      },
    ],
    torso: [torso(0.985, 0.152, 0.136, 0.163, 0.14, 0.106, 0.55)],
  },
];

/**
 * THE GARMENT IS FITTED TO THE FRAME, ONCE, HERE — session 11.
 *
 * The two tables above were authored independently and agreed by inspection,
 * which is CONTRACT §9.1's two-files-that-must-agree with a body in it: every
 * one of the five builds had cloth inside the body it covered, and nothing in
 * the project could see it. Measured on the coated build, before:
 *
 *   hem 0.55 m   cloth half-depth 0.1109 m against a leg envelope of 0.1515 m
 *                — the stride left the coat by 4.1 cm, twice a cycle
 *   waist 0.83 m cloth 0.1062 m against a pelvis at 0.1050 m — 1.2 mm, which
 *                is not a fit, it is a coincidence
 *
 * After this, a garment section is never smaller than what it covers. The
 * numbers both directions are kept on each section (`$authored*`, `$env*`) and
 * printed at boot, because a derived number whose input is not printed beside
 * it is a magic constant with a longer comment.
 */
for (const type of BODY_TYPES) {
  type.torso = type.torso.map((g) => fitGarment(g, type.frame));
}

/**
 * The three stall kinds, in local space: +Z is the FRONT, +X runs along the
 * pavement, y = 0 is the pavement. `STALL_FOOTPRINT.faceDeg` decides whether
 * the front ends up pointing at the road or at the walking corridor.
 *
 * ALMOST EVERY KIND IS AUTHORED SYMMETRIC IN Z — AND TWO ARE NOT, MEASURED
 * OFF THE DELIVERED GEOMETRY IN SESSION 31. Four of the five kinds are
 * asymmetric in z and two BREACH `halfAcross`: `infill` spans [-0.34, +0.45]
 * against 0.34 and `food` spans [-0.80, +0.845] against 0.80. Both overhangs
 * are CLOTH, at y 2.11-2.45 m and 1.82-2.14 m — an awning over the walking
 * corridor rather than a body in it — and both bodies stay inside the
 * [7.5, 11.7] pavement band, so nothing is standing where it should not. But
 * the sentence below claimed a bound that the geometry does not hold, which is
 * CONTRACT 9.1's own subject, and it is left here corrected rather than
 * quietly deleted. The original read:
 *
 *   EVERY KIND IS AUTHORED SYMMETRIC IN Z, |z| <= halfAcross. That is not
 * tidiness: `STALL_FOOTPRINT` gives one depth per kind and the occupancy
 * rectangle is built from it, so a part that stuck out further than the table
 * says would be a stall whose drawn body is bigger than the body that was
 * tested. That is CONTRACT §9's whole shape — a box tested and a different
 * box drawn — and the way to make it impossible is to have one number.
 *
 * `body` is merged into one geometry per kind with its reflectances in vertex
 * colours, so one pitch is ONE instance and `noctisCensus.stall_<kind>` is the
 * pitch count rather than a box count somebody has to divide. `glow` is
 * instanced separately into the chunk's emissive mesh, one instance per lit
 * surface, with its chromaticity and gain in `instanceColor`.
 *
 * Reflectances: painted steel 0.22, weathered timber 0.18, canvas 0.30, dark
 * rubber and shadowed interior 0.06, galvanised sheet 0.34.
 */
const STALL_KINDS = {
  /**
   * A pitch in a shut shop bay. The shutter is BEHIND it at z = -0.28, which
   * is the whole silhouette: a flat 2.4 m panel with a trestle and a stack of
   * crates in front of it, and no canopy at all.
   */
  infill: {
    body: [
      { x: 0, y: 1.2, z: -0.28, w: 2.6, h: 2.4, d: 0.12, albedo: [0.22, 0.215, 0.21] },
      /** The valance over the bay opening — cloth, so it takes the pitch's own. */
      { x: 0, y: 2.28, z: 0.2, w: 2.5, h: 0.34, d: 0.5, albedo: [1, 1, 1], tinted: true },
      { x: 0, y: 0.86, z: 0.06, w: 2.2, h: 0.07, d: 0.55, albedo: [0.18, 0.16, 0.135] },
      { x: -0.72, y: 0.43, z: 0.06, w: 0.09, h: 0.86, d: 0.09, albedo: [0.18, 0.16, 0.135] },
      { x: 0.86, y: 0.45, z: -0.02, w: 0.52, h: 0.9, d: 0.45, albedo: [0.18, 0.16, 0.135] },
    ],
    glow: [
      { x: 0, y: 2.16, z: -0.1, w: 2.2, h: 0.09, d: 0.09, gain: GLOW_GAIN_TUBE, chroma: 3 },
    ],
  },
  /**
   * A free-standing market stall: four legs, a canopy, a table of goods.
   * Reads at distance as a horizontal slab floating at 2.2 m, which is
   * nothing else on the street.
   */
  market: {
    body: [
      { x: -1.14, y: 1.07, z: 0.72, w: 0.06, h: 2.15, d: 0.06, albedo: [0.22, 0.215, 0.21] },
      { x: 1.14, y: 1.07, z: 0.72, w: 0.06, h: 2.15, d: 0.06, albedo: [0.22, 0.215, 0.21] },
      { x: -1.14, y: 1.07, z: -0.72, w: 0.06, h: 2.15, d: 0.06, albedo: [0.22, 0.215, 0.21] },
      { x: 1.14, y: 1.07, z: -0.72, w: 0.06, h: 2.15, d: 0.06, albedo: [0.22, 0.215, 0.21] },
      /** The canopy. `tinted` puts it on the pitch's own cloth colour. */
      { x: 0, y: 2.2, z: 0, w: 2.5, h: 0.1, d: 1.65, albedo: [1, 1, 1], tinted: true },
      /** A front valance, which is what makes a flat canopy read as cloth. */
      { x: 0, y: 2.04, z: 0.8, w: 2.5, h: 0.28, d: 0.06, albedo: [1, 1, 1], tinted: true },
      { x: 0, y: 0.9, z: 0, w: 2.2, h: 0.06, d: 1.4, albedo: [0.18, 0.16, 0.135] },
      { x: 0, y: 1.1, z: 0, w: 1.9, h: 0.35, d: 1.1, albedo: [0.06, 0.06, 0.062] },
    ],
    glow: [
      { x: 0, y: 2.13, z: 0.79, w: 2.5, h: 0.07, d: 0.07, gain: GLOW_GAIN_ROPE, chroma: -1 },
      { x: 0, y: 1.94, z: 0, w: 0.9, h: 0.08, d: 0.08, gain: GLOW_GAIN_TUBE, chroma: 3 },
    ],
  },
  /**
   * A food stand: a closed box with a serving hatch cut in the front, a
   * chimney out of the back and a griddle glowing inside. The chimney is the
   * silhouette — it is the only thing on the street that is tall, thin and
   * off-centre.
   */
  food: {
    body: [
      { x: 0, y: 0.72, z: -0.05, w: 2.2, h: 1.45, d: 1.4, albedo: [0.34, 0.335, 0.33] },
      { x: 0, y: 2.15, z: 0, w: 2.5, h: 0.12, d: 1.6, albedo: [0.22, 0.215, 0.21] },
      /** A drop awning over the hatch — the food stand's only cloth. */
      { x: 0, y: 1.98, z: 0.82, w: 2.4, h: 0.32, d: 0.05, albedo: [1, 1, 1], tinted: true },
      { x: -1.06, y: 1.78, z: 0.66, w: 0.08, h: 0.75, d: 0.08, albedo: [0.22, 0.215, 0.21] },
      { x: 1.06, y: 1.78, z: 0.66, w: 0.08, h: 0.75, d: 0.08, albedo: [0.22, 0.215, 0.21] },
      { x: 0, y: 1.5, z: 0.6, w: 2.2, h: 0.07, d: 0.4, albedo: [0.18, 0.16, 0.135] },
      { x: -0.78, y: 2.55, z: -0.45, w: 0.22, h: 0.7, d: 0.22, albedo: [0.06, 0.06, 0.062] },
    ],
    glow: [
      { x: 0.25, y: 1.02, z: 0.14, w: 0.9, h: 0.05, d: 0.55, gain: GLOW_GAIN_GRIDDLE, chroma: 2 },
      { x: -0.62, y: 1.95, z: 0.52, w: 0.8, h: 0.5, d: 0.05, gain: GLOW_GAIN_BOARD, chroma: -1 },
      { x: 0, y: 2.05, z: 0.7, w: 2.0, h: 0.06, d: 0.06, gain: GLOW_GAIN_TUBE, chroma: 3 },
    ],
  },
  /**
   * A PRODUCE PITCH. Session 14, and it is the SHAPE half of the variation the
   * brief asked for: a PITCHED awning rather than a flat one, a raked display
   * rather than a level table, and crates on the ground.
   *
   * The pitch is two sloping-looking slabs — two boxes at different heights
   * meeting at a ridge, which at the 0.10 m thickness a canopy has reads as a
   * gable and costs four boxes rather than a lofted surface. That is the same
   * trade `PROP_MODELS` makes and for the same reason: a stall is seen from
   * two to fifteen metres and its silhouette is what carries it.
   *
   * WHAT IS ON THE TABLE IS THE POINT AND NOT A DETAIL. Three stall kinds
   * shared one flat 0.35 m slab of "goods" between them; the brief names "what
   * is on the table" as one of the three axes because a market reads as a
   * market from the lumpiness of its counter. This has a raked back tier, a
   * front tier and two crates below, which is four different heights where
   * there was one.
   */
  produce: {
    body: [
      { x: -1.16, y: 1.02, z: 0.66, w: 0.07, h: 2.05, d: 0.07, albedo: [0.20, 0.19, 0.18] },
      { x: 1.16, y: 1.02, z: 0.66, w: 0.07, h: 2.05, d: 0.07, albedo: [0.20, 0.19, 0.18] },
      { x: -1.16, y: 1.14, z: -0.66, w: 0.07, h: 2.28, d: 0.07, albedo: [0.20, 0.19, 0.18] },
      { x: 1.16, y: 1.14, z: -0.66, w: 0.07, h: 2.28, d: 0.07, albedo: [0.20, 0.19, 0.18] },
      /** The gable: front slope low, back slope high, ridge between them. */
      { x: 0, y: 2.14, z: 0.42, w: 2.6, h: 0.09, d: 1.0, albedo: [1, 1, 1], tinted: true },
      { x: 0, y: 2.36, z: -0.42, w: 2.6, h: 0.09, d: 1.0, albedo: [1, 1, 1], tinted: true },
      { x: 0, y: 2.44, z: 0, w: 2.6, h: 0.10, d: 0.16, albedo: [1, 1, 1], tinted: true },
      /** The raked display: a back tier standing above a front one. */
      { x: 0, y: 0.86, z: 0.22, w: 2.2, h: 0.06, d: 0.9, albedo: [0.18, 0.16, 0.135] },
      { x: 0, y: 1.00, z: 0.20, w: 2.0, h: 0.22, d: 0.78, albedo: [0.09, 0.075, 0.05] },
      { x: 0, y: 1.24, z: -0.34, w: 2.0, h: 0.30, d: 0.5, albedo: [0.10, 0.085, 0.055] },
      /** Crates under the trestle. */
      { x: -0.68, y: 0.20, z: -0.1, w: 0.62, h: 0.40, d: 0.5, albedo: [0.14, 0.115, 0.08] },
      { x: 0.52, y: 0.15, z: -0.2, w: 0.5, h: 0.30, d: 0.44, albedo: [0.14, 0.115, 0.08] },
    ],
    glow: [
      { x: 0, y: 2.06, z: 0.86, w: 2.4, h: 0.06, d: 0.06, gain: GLOW_GAIN_ROPE, chroma: -1 },
      { x: 0, y: 1.88, z: 0, w: 1.1, h: 0.07, d: 0.07, gain: GLOW_GAIN_TUBE, chroma: 4 },
    ],
  },
  /**
   * A CLOTHING RACK against a shut bay — the second infill kind, and it is a
   * FRAME TYPE rather than a second colour. Where `infill` is a trestle and a
   * stack of crates, this is a hanging rail with goods on it and a mirror
   * panel: vertical where the other is horizontal, and it breaks the row of
   * identical shutters an infill run otherwise makes.
   */
  rack: {
    body: [
      { x: 0, y: 1.2, z: -0.28, w: 2.6, h: 2.4, d: 0.12, albedo: [0.22, 0.215, 0.21] },
      { x: 0, y: 2.3, z: 0.16, w: 2.5, h: 0.30, d: 0.42, albedo: [1, 1, 1], tinted: true },
      /** The rail and its two uprights. */
      { x: -0.92, y: 0.94, z: 0.1, w: 0.06, h: 1.88, d: 0.06, albedo: [0.24, 0.24, 0.245] },
      { x: 0.92, y: 0.94, z: 0.1, w: 0.06, h: 1.88, d: 0.06, albedo: [0.24, 0.24, 0.245] },
      { x: 0, y: 1.82, z: 0.1, w: 1.9, h: 0.05, d: 0.05, albedo: [0.30, 0.30, 0.31] },
      /** What is hanging on it — two blocks of garments at different lengths. */
      { x: -0.42, y: 1.34, z: 0.1, w: 0.9, h: 0.92, d: 0.30, albedo: [0.11, 0.10, 0.12] },
      { x: 0.5, y: 1.46, z: 0.1, w: 0.72, h: 0.68, d: 0.28, albedo: [0.13, 0.11, 0.09] },
      /** A mirror panel and a box of stock on the ground. */
      { x: 1.06, y: 0.85, z: -0.14, w: 0.36, h: 1.7, d: 0.05, albedo: [0.42, 0.425, 0.43] },
      { x: -1.02, y: 0.19, z: 0.02, w: 0.5, h: 0.38, d: 0.42, albedo: [0.14, 0.115, 0.08] },
    ],
    glow: [
      { x: 0, y: 2.12, z: -0.08, w: 2.2, h: 0.08, d: 0.08, gain: GLOW_GAIN_TUBE, chroma: 1 },
    ],
  },
};

// ---------------------------------------------------------------------------

export function createStreetlife(options = {}) {
  const cfg = {
    pedestrians: PEDESTRIAN_COUNT,
    stallLightSlots: STALL_LIGHT_SLOTS,
    ...options,
  };

  const root = new THREE.Group();
  root.name = 'streetlife';

  const disposables = [];
  const track = (x) => {
    disposables.push(x);
    return x;
  };

  let rootSeed = '1337';
  let lightsApi = null;
  let cityApi = null;
  let materials = null;

  /** Chunk descriptions when `city` is absent. See `chunkData`. */
  const localChunks = new Map();
  /** Ground blockers per chunk key, memoised: landmark piers, never the deck. */
  const groundBlockers = new Map();
  /** Destination lists in loop coordinates, per chunk key. */
  const destinations = new Map();

  // --- pedestrians ---------------------------------------------------------

  /** One entry per agent. Field-of-arrays would be faster and unreadable. */
  const agents = [];
  /** Per body type: { def, indices[], frameMesh, motion, scratch }. Frame and
   * garment are ONE mesh since session 10 — see `buildPedestrianMeshes`. */
  const bodies = [];
  /** Straightness ring: x, z, cumulative path length, per agent per slot. */
  let history = null;
  let historyHead = null;
  let historyFilled = null;
  let historyClock = 0;
  const arrivalBuckets = new Float64Array(ARRIVAL_BUCKETS);
  let arrivalBucket = 0;
  let arrivalClock = 0;
  let simSeconds = 0;
  let suppressedByThreshold = 0;
  let reseatsThisFrame = 0;
  let reseatsTotal = 0;
  let motionCutoffM = 0;
  let chromaticGarments = 0;

  /** Chunk key -> declaring Object3D carrying `userData.noctisPedestrians`. */
  const pedDeclarers = new Map();
  const pedCounts = new Map();
  let pedRingKeys = [];
  let lastRebalanceChunk = null;
  const lastRebalanceAt = new THREE.Vector3(0, -1e9, 0);

  /**
   * POSE MODE — `{ agent, u, amp, build }` or null. `tools/gaitstrip.mjs` only.
   *
   * One figure, held still, at a phase the caller names. It exists because the
   * two defects it was built to find — a garment that does not follow the body
   * and a leg that passes through the other hip — are properties of the gait
   * CYCLE and not of any one pose, and the delivered frame only ever shows one
   * pose per figure. A strip of eight phases shows the cycle; it is only
   * readable if the figure is in the same place in all eight, which is what
   * this freezes.
   *
   * NOT A GATE AND NO GATE MAY ASSERT THROUGH IT (CONTRACT §10): it suppresses
   * the population, so anything measured here would be measured on a scene
   * that is not the one that ships.
   */
  let posed = null;

  // --- stalls --------------------------------------------------------------

  /** Chunk key -> { group, pitches[], counts, meshes[] }. */
  const stallChunks = new Map();
  let stallCameraChunk = null;
  let stallGeometries = null;
  let glowGeometry = null;
  const stallLightPool = [];

  // --- scratch -------------------------------------------------------------

  const tmpMatrix = new THREE.Matrix4();
  const tmpQuat = new THREE.Quaternion();
  const tmpEuler = new THREE.Euler();
  const tmpPos = new THREE.Vector3();
  const tmpScale = new THREE.Vector3();
  const tmpColor = new THREE.Color();

  let lastFrameId = -1;

  /**
   * The height of the buffer the scene is drawn into, in pixels of THAT
   * buffer. `post` owns it (§5.10) and it is not the drawing buffer: the
   * internal resolution is fixed at RENDER.pixels and upscaled in the
   * composite. Reading the drawing buffer here would put the motion cutoff
   * off by the upscale factor, which is CONTRACT §9's session-4 row one level
   * down. The `> 16` floor rejects `ctx.size` before the first resize, where
   * it is 1 x 1 and would give a cutoff of a few centimetres.
   */
  function internalHeightOf(ctx) {
    const post = ctx.get('post');
    if (post && post.internalSize && post.internalSize.height > 16) return post.internalSize.height;
    const drawn = Math.round(ctx.size.height * ctx.size.dpr);
    return drawn > 16 ? drawn : RENDER.internalHeight;
  }

  /**
   * Compose every instance of one body type straight into a Float32Array.
   *
   * Written out rather than run through `Matrix4.compose`, because the
   * transform is a Y rotation and a uniform scale: column 0 is
   * (s cos, 0, -s sin), column 2 is (s sin, 0, s cos), and the other ten
   * entries are constants. 360 quaternions a frame to express two of them is
   * work that buys nothing.
   *
   * The gait bob rides in the translation. 2.2 cm peak to peak at a 0.75 m
   * step is a 1.9 Hz oscillation at 1.4 m/s — which is exactly the frequency
   * a motion vector exists to carry, and the reason the bob is applied here
   * and not in the vertex shader, where the previous frame's phase does not
   * exist.
   */
  function writeMatrices(b, into) {
    const arr = into || b.scratch;
    for (let sIx = 0; sIx < b.indices.length; sIx++) {
      const a = agents[b.indices[sIx]];
      const sc = a.scale;
      const cos = Math.cos(a.yaw) * sc;
      const sin = Math.sin(a.yaw) * sc;
      const o = sIx * 16;
      arr[o] = cos; arr[o + 1] = 0; arr[o + 2] = -sin; arr[o + 3] = 0;
      arr[o + 4] = 0; arr[o + 5] = sc; arr[o + 6] = 0; arr[o + 7] = 0;
      arr[o + 8] = sin; arr[o + 9] = 0; arr[o + 10] = cos; arr[o + 11] = 0;
      // arr[13] is the instance's world Y. It was the literal 0 until session
      // 19; `a.y` is `city.groundYAt` at the agent's own position, set in
      // `updateAgentPosition`, which is where the reasoning is.
      arr[o + 12] = a.x; arr[o + 13] = a.y; arr[o + 14] = a.z; arr[o + 15] = 1;
    }
    return arr;
  }

  /**
   * The gait state of one body type's instances: (u, uPrev, amp, ampPrev).
   *
   * FOUR FLOATS AN INSTANCE AGAINST SIXTEEN FOR THE MATRIX, and that ratio is
   * the whole argument for putting the gait in the shader. Expressing a bob, an
   * alternating leg and a counter-swinging arm as transforms needs one matrix
   * per limb — seven per person, 2 520 a frame at this population — and matrix
   * writes land on the CPU, which is the one resource in this project without
   * slack. This is 25% of ONE matrix, and it buys all seven limbs.
   *
   * The previous frame's value rides in the same attribute rather than in a
   * double buffer. `instmotion` double-buffers because its buffer is uploaded
   * once and read as two (§5.12, and the swap is what makes it one upload);
   * here both halves are written every frame anyway, so a second buffer would
   * be a second upload of data that is already in hand.
   *
   * `amp` is why this is a vec4 and not a vec2. A figure that stops walking
   * with its phase frozen keeps its legs mid-stride, which reads as a
   * photograph rather than as somebody standing; `amp` fades the whole
   * displacement out over `GAIT.dwellFadeS`, and at amp = 0 every term in
   * `gaitOffset` is exactly zero rather than nearly so.
   */
  function writeGait(b, arr) {
    for (let sIx = 0; sIx < b.indices.length; sIx++) {
      const a = agents[b.indices[sIx]];
      const o = sIx * 4;
      arr[o] = a.gaitU;
      arr[o + 1] = a.gaitUPrev;
      arr[o + 2] = a.gaitAmp;
      arr[o + 3] = a.gaitAmpPrev;
    }
    return arr;
  }

  // -------------------------------------------------------------------------
  // geometry of the world
  // -------------------------------------------------------------------------

  /**
   * The chunk description. `city` owns the cache and this module prefers it;
   * without `city` the same pure generator is called here and memoised, so the
   * occupancy test never silently degrades to "no occupancy" — CONTRACT §9.1:
   * anything placed procedurally is tested against the existing occupancy, or
   * it is not placed.
   */
  function chunkData(cx, cz) {
    if (cityApi && cityApi.describe) return cityApi.describe(cx, cz);
    const key = chunkKey(cx, cz);
    let d = localChunks.get(key);
    if (!d) {
      d = generateChunk(rootSeed, cx, cz);
      localChunks.set(key, d);
      if (localChunks.size > 512) localChunks.delete(localChunks.keys().next().value);
    }
    return d;
  }

  /**
   * What actually stands in the way of somebody on foot in this chunk.
   *
   * Building footprints, from `occluders` with the landmark boxes filtered
   * out, plus `landmarkGroundBlockers` for every landmark that touches the
   * chunk. NOT `landmarkOccluders`, which is the sky answer and contains the
   * viaduct's whole 480 m deck at 21 m — a person walks under that. One list
   * standing for two questions is CONTRACT §9 row 13 and it cost session 5 a
   * walkability mask.
   *
   * The origin block's own buildings come from `block.occluders` when that
   * module is live. The generator places nothing inside `BLOCK_KEEPOUT`, so
   * without them the block's cross street — 13 m wide, not 15, which puts its
   * facades at 10.7 m rather than 11.7 — would read as empty pavement.
   */
  function walkBlockers(ctx, cx, cz) {
    const key = chunkKey(cx, cz);
    let list = groundBlockers.get(key);
    if (!list) {
      list = [];
      const d = chunkData(cx, cz);
      for (const o of d.occluders) {
        if (o.landmark != null) continue;
        list.push(o);
      }
      for (const l of landmarksTouching(cx, cz)) {
        for (const b of landmarkGroundBlockers(l)) list.push(b);
      }
      const b = chunkBounds(cx, cz);
      const touchesBlock =
        b.x1 > BLOCK_KEEPOUT.x0 && b.x0 < BLOCK_KEEPOUT.x1 &&
        b.z1 > BLOCK_KEEPOUT.z0 && b.z0 < BLOCK_KEEPOUT.z1;
      if (touchesBlock) {
        const block = ctx.get('block');
        if (block && block.occluders) for (const o of block.occluders) list.push(o);
      }
      groundBlockers.set(key, list);
      if (groundBlockers.size > 512) groundBlockers.delete(groundBlockers.keys().next().value);
    }
    return list;
  }

  /**
   * The island loop, in one function.
   *
   * Edge 0 is the pavement on the chunk's north road running east, edge 1 the
   * east pavement running south, edge 2 the south pavement running west, edge
   * 3 the west pavement running north. Consecutive edges meet at a corner, so
   * `p` in [0, 4L) walks the whole perimeter and turning is what happens when
   * `p` crosses a multiple of L. `out` is the pair of components of the
   * outward (roadward) direction, `inland` its negation, and `head` the
   * direction of travel at dir = +1.
   */
  const LOOP_EDGE_LENGTH = CITY.chunkSize - 2 * LANE_CENTRE_M;
  const LOOP_LENGTH = 4 * LOOP_EDGE_LENGTH;

  function loopPoint(cx, cz, p, spread, outVec) {
    const b = chunkBounds(cx, cz);
    const c = LANE_CENTRE_M;
    let q = p % LOOP_LENGTH;
    if (q < 0) q += LOOP_LENGTH;
    const e = Math.min(3, Math.floor(q / LOOP_EDGE_LENGTH));
    const u = q - e * LOOP_EDGE_LENGTH;
    let x = 0;
    let z = 0;
    let hx = 0;
    let hz = 0;
    let ox = 0;
    let oz = 0;
    if (e === 0) {
      x = b.x0 + c + u; z = b.z0 + c; hx = 1; hz = 0; ox = 0; oz = -1;
    } else if (e === 1) {
      x = b.x1 - c; z = b.z0 + c + u; hx = 0; hz = 1; ox = 1; oz = 0;
    } else if (e === 2) {
      x = b.x1 - c - u; z = b.z1 - c; hx = -1; hz = 0; ox = 0; oz = 1;
    } else {
      x = b.x0 + c; z = b.z1 - c - u; hx = 0; hz = -1; ox = -1; oz = 0;
    }
    // Spread is signed inland, so a positive value moves toward the facade.
    x -= ox * spread;
    z -= oz * spread;
    outVec.edge = e;
    outVec.x = x;
    outVec.z = z;
    outVec.hx = hx;
    outVec.hz = hz;
    outVec.ox = ox;
    outVec.oz = oz;
    return outVec;
  }

  const scratchPoint = { edge: 0, x: 0, z: 0, hx: 0, hz: 0, ox: 0, oz: 0 };

  /**
   * The destinations on one island's loop: shopfronts where a building meets
   * the pavement, the four corners, and every stall pitch standing on it.
   *
   * A shopfront is defined as "the pavement in front of a building", probed
   * 2.5 m inland of the loop line — 12.1 m from the centreline, which is
   * 0.4 m inside the island and therefore inside the footprint of any
   * perimeter building, whose facade sits exactly on the 11.7 m island edge.
   * That definition counts the origin block's shopfronts too, because it asks
   * the occupancy rather than the generator.
   */
  function destinationsFor(ctx, cx, cz) {
    const key = chunkKey(cx, cz);
    let list = destinations.get(key);
    if (list) return list;
    list = [];
    const boxes = walkBlockers(ctx, cx, cz);
    for (let e = 0; e < 4; e++) {
      list.push({ p: e * LOOP_EDGE_LENGTH, kind: 'corner' });
      for (let u = 6; u < LOOP_EDGE_LENGTH - 4; u += 8) {
        const p = e * LOOP_EDGE_LENGTH + u;
        loopPoint(cx, cz, p, 2.5, scratchPoint);
        if (occupied(boxes, scratchPoint.x, scratchPoint.z, 0)) {
          list.push({ p, kind: 'shopfront' });
        }
      }
    }
    const stalls = stallChunks.get(key);
    if (stalls) for (const s of stalls.pitches) list.push({ p: s.p, kind: 'stall' });
    list.sort((a, b) => a.p - b.p);
    destinations.set(key, list);
    if (destinations.size > 256) destinations.delete(destinations.keys().next().value);
    return list;
  }

  // -------------------------------------------------------------------------
  // materials
  // -------------------------------------------------------------------------

  function buildMaterials(ctx) {
    const lights = ctx.get('lights');

    /**
     * ONE material for every body part of every pedestrian, patched for the
     * per-instance motion path. `vertexColors` is on so the head can carry a
     * skin multiplier in the geometry while the body albedo rides in
     * `instanceColor`; three multiplies the two together into `vColor`.
     */
    const pedestrian = new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0 });
    pedestrian.color.setRGB(1, 1, 1, THREE.LinearSRGBColorSpace);
    pedestrian.vertexColors = true;
    lights.patch(pedestrian, { prevInstance: true, gait: true, garment: true });

    const stallBody = new THREE.MeshStandardMaterial({ roughness: 0.74, metalness: 0 });
    stallBody.color.setRGB(1, 1, 1, THREE.LinearSRGBColorSpace);
    stallBody.vertexColors = true;
    /**
     * `garment: true` — §5.6's two-colour select, which since session 14 is
     * decoupled from the gait. The geometry carries the part label in
     * `noctisLimb.z` and the mesh carries `noctisBodyColor` / `noctisGarment`,
     * so a canopy's cloth colour costs no mesh and no draw call. The gait is
     * NOT compiled here: a stall does not walk, and the displacement would be
     * exactly zero anyway, but a define that buys nothing forks a program for
     * nothing.
     */
    lights.patch(stallBody, { garment: true });

    /**
     * The emissive material, chromaticity-neutral. Chroma and nits both ride
     * in `instanceColor`, which the §5.6 injection multiplies into
     * `totalEmissiveRadiance` as well as into the diffuse — the same
     * arrangement `city.js` uses for signage, so a menu board and a shop sign
     * are one draw call each rather than one per brightness.
     */
    const stallGlow = new THREE.MeshStandardMaterial({ roughness: 0.12, metalness: 0 });
    stallGlow.color.set(0x101216);
    stallGlow.emissive.setRGB(1, 1, 1, THREE.LinearSRGBColorSpace);
    stallGlow.emissiveIntensity = STALL_GLOW_NITS;
    lights.patch(stallGlow);

    return {
      pedestrian: track(pedestrian),
      stallBody: track(stallBody),
      stallGlow: track(stallGlow),
    };
  }

  // -------------------------------------------------------------------------
  // pedestrians — construction
  // -------------------------------------------------------------------------

  function buildPopulation(ctx) {
    const bodyRng = ctx.rng('streetlife:body');
    const clothRng = ctx.rng('streetlife:cloth');
    const gaitRng = ctx.rng('streetlife:gait');

    const cumulative = [];
    let acc = 0;
    for (const t of BODY_TYPES) {
      acc += t.weight;
      cumulative.push(acc);
    }

    for (let i = 0; i < cfg.pedestrians; i++) {
      const r = bodyRng.next() * acc;
      let type = 0;
      while (type < cumulative.length - 1 && r > cumulative[type]) type++;
      const height = Math.max(
        BODY_HEIGHT_MIN,
        Math.min(BODY_HEIGHT_MAX, BODY_REF_HEIGHT + bodyRng.gauss() * BODY_HEIGHT_SD)
      );
      agents.push({
        type,
        slot: 0,
        height,
        /**
         * World Y of the feet. Session 19: written every frame by
         * `updateAgentPosition` from `city.groundYAt`, and seeded at the ground
         * datum here so that the very first `writeMatrices` — which can run
         * before any position update on the frame a chunk lands — puts the
         * figure on the carriageway rather than at `undefined`, which would
         * write NaN into an instance matrix and remove it from the frame with
         * no error anywhere.
         */
        y: 0,
        scale: height / BODY_REF_HEIGHT,
        speed: Math.max(
          WALK_SPEED_MIN,
          Math.min(WALK_SPEED_MAX, WALK_SPEED_MEAN + gaitRng.gauss() * WALK_SPEED_SD)
        ),
        spread: PED_LANE_INSET_M + gaitRng.range(-PED_LANE_HALF_M, PED_LANE_HALF_M),
        /**
         * Cycle parameter in [0,1), and its previous-frame twin. Distributed
         * over the WHOLE cycle rather than over a step: two people in
         * antiphase have opposite legs forward, and a crowd whose phases only
         * span one step has every left leg forward at once.
         */
        gaitPhase: gaitRng.range(0, GAIT_CYCLE_M),
        gaitU: 0,
        gaitUPrev: 0,
        gaitAmp: 1,
        gaitAmpPrev: 1,
        bodyAlbedo: MUTED_CLOTH[clothRng.int(0, MUTED_CLOTH.length - 1)],
        garment: MUTED_CLOTH[clothRng.int(0, MUTED_CLOTH.length - 1)],
        /**
         * The third zone: trousers. Drawn from the same palette and from the
         * same stream as the other two, so a person's three zones are three
         * independent draws — which is the whole of what this attribute buys
         * and is exactly what `mix()` of two colours could not produce.
         */
        trousers: MUTED_CLOTH[clothRng.int(0, MUTED_CLOTH.length - 1)],
        garmentKey: clothRng.next(),
        chromatic: false,
        index: i,
        placed: false,
        cx: 0,
        cz: 0,
        x: 0,
        z: 0,
        p: 0,
        dir: 1,
        remaining: 0,
        dwell: 0,
        pathLength: 0,
        dwellYaw: 0,
        yaw: 0,
        destKind: 'corner',
        reseated: true,
      });
    }

    /**
     * Exactly one in five, by rank rather than by a coin. `chance(0.20)` over
     * 360 draws delivers 20% plus or minus 2.1 points one time in three, and
     * the budget's word is "cap" — 0.20 x 0.35 = 7.0% of pedestrian pixels is
     * an allowance, not an expectation. Sorting on a per-agent key keeps it
     * deterministic and makes the delivered fraction exactly 72/360.
     */
    const wantChromatic = Math.floor(cfg.pedestrians / CHROMATIC_GARMENT_DIVISOR);
    const order = agents.map((a, i) => i).sort((a, b) => agents[a].garmentKey - agents[b].garmentKey);
    for (let k = 0; k < wantChromatic; k++) {
      const a = agents[order[k]];
      const chroma = GARMENT_CHROMA[k % GARMENT_CHROMA.length];
      a.garment = [
        Math.min(1, chroma[0] * GARMENT_LUMINANCE),
        Math.min(1, chroma[1] * GARMENT_LUMINANCE),
        Math.min(1, chroma[2] * GARMENT_LUMINANCE),
      ];
      a.chromatic = true;
    }
    chromaticGarments = wantChromatic;

    // Slots inside each type's mesh, assigned in agent order so the mapping
    // never has to be searched.
    for (let t = 0; t < BODY_TYPES.length; t++) {
      const indices = [];
      for (let i = 0; i < agents.length; i++) {
        if (agents[i].type !== t) continue;
        agents[i].slot = indices.length;
        indices.push(i);
      }
      bodies.push({ def: BODY_TYPES[t], indices, frameMesh: null, motion: null });
    }

    history = new Float32Array(agents.length * STRAIGHTNESS_SLOTS * 3);
    historyHead = new Int16Array(agents.length).fill(-1);
    historyFilled = new Int16Array(agents.length);
  }

  function buildPedestrianMeshes() {
    for (let t = 0; t < bodies.length; t++) {
      const b = bodies[t];
      const n = b.indices.length;
      if (!n) continue;

      /**
       * ONE MESH A BODY TYPE, FRAME AND GARMENT TOGETHER — session 10, and it
       * is a draw-call fix rather than tidiness.
       *
       * They were two meshes because `instanceColor` tints a WHOLE mesh and a
       * garment has to be tinted separately from the skin and the trousers. At
       * three body types that cost six draw calls; at the five builds the
       * silhouette work needs it would have cost ten, and `highway_speed`
       * measured 443 against a ceiling of 440 with the split. §0 rule 5 forbids
       * raising it, so the split went instead: the garment is selected in the
       * vertex shader from a per-vertex mask (`noctisGarmentMask`, baked by
       * `loftToGeometry`) between two per-instance colours, which is five draws
       * for five builds and leaves the ceiling two clear.
       *
       * The geometry is still one per mesh — the instanced attributes live on
       * `geometry.attributes` and three's object-level fallbacks cover only
       * `instanceMatrix` and `instanceColor`, so two meshes sharing a geometry
       * would share one previous-transform buffer.
       */
      const geo = track(loftToGeometry(
        b.def.frame.concat(b.def.torso.map((t) => ({ ...t, garment: true })))
      ));

      const gaitArray = new Float32Array(n * 4);
      const gaitAttr = new THREE.InstancedBufferAttribute(gaitArray, 4);
      gaitAttr.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('noctisGait', gaitAttr);
      b.gaitArray = gaitArray;
      b.gaitAttr = gaitAttr;

      /**
       * TWO COLOURS AN INSTANCE AND NO `instanceColor`.
       *
       * Not `instanceColor` plus one attribute, which was the obvious shape and
       * is wrong: three multiplies `instanceColor` into `vColor` for every
       * vertex before anything of ours runs, so whichever of the two colours
       * rode there would be baked into the other one's fragments and the
       * injection would have to divide it back out. Two attributes and one
       * `mix` is exact, and the mask is 0 or 1 at every vertex — it is a part
       * label, never interpolated across a part boundary, because no triangle
       * spans two parts.
       */
      /**
       * FOUR COMPONENTS, AND THE FOURTH COSTS NOTHING. Session 15.
       *
       * An attribute slot is a vec4 whether the shader declares vec4 or vec3,
       * so these two were already occupying eight floats of which two were
       * unused. The third colour zone rides in exactly those two, packed at 12
       * bits a channel by `lib/color.js` → `packZone12`, which is where the
       * arithmetic and the GLSL that undoes it both live. The attribute COUNT
       * is unchanged at 16 of ANGLE's 16, which is the constraint STATE §7
       * measured and the reason this is a pack rather than a third attribute.
       */
      const bodyCol = new Float32Array(n * 4);
      const garmentCol = new Float32Array(n * 4);
      for (let s = 0; s < n; s++) {
        const a = agents[b.indices[s]];
        const [hi, lo] = packZone12(a.trousers);
        bodyCol[s * 4] = a.bodyAlbedo[0];
        bodyCol[s * 4 + 1] = a.bodyAlbedo[1];
        bodyCol[s * 4 + 2] = a.bodyAlbedo[2];
        bodyCol[s * 4 + 3] = hi;
        garmentCol[s * 4] = a.garment[0];
        garmentCol[s * 4 + 1] = a.garment[1];
        garmentCol[s * 4 + 2] = a.garment[2];
        garmentCol[s * 4 + 3] = lo;
      }
      geo.setAttribute('noctisBodyColor', new THREE.InstancedBufferAttribute(bodyCol, 4));
      geo.setAttribute('noctisGarment', new THREE.InstancedBufferAttribute(garmentCol, 4));

      const mesh = new THREE.InstancedMesh(geo, materials.pedestrian, n);
      mesh.name = `streetlife:body:${b.def.name}`;

      /**
       * Never culled. A pedestrian mesh's instances move every frame, so its
       * bounding sphere is stale the moment it is computed, and the ring
       * surrounds the camera — a sphere that enclosed the whole ring would
       * intersect the frustum from every angle anyway. Five meshes always
       * submitted, against a stale sphere that culls people who are on screen.
       */
      mesh.frustumCulled = false;
      mesh.castShadow = false;

      mesh.userData.noctisCensus = { chunk: 'streetlife', [`pedestrian_body_${b.def.name}`]: n };

      /**
       * `palette: true` HERE, AND IT READS `noctisGarment` RATHER THAN
       * `instanceColor`. The chroma assertion for pedestrians is about
       * CLOTHING; the body albedo is five muted neutrals and would dilute the
       * count the assertion is making rather than contribute to it. When the
       * garment was its own mesh the flag picked the mesh; now it picks the
       * attribute, and `harness.instanceColourPalette` is told which one by
       * `paletteAttribute` rather than guessing.
       *
       * `subject` stays even though a subject is now one mesh: a merge that
       * silently dropped it would leave the silhouette code's two-meshes-one-
       * subject path with no caller and no test, and it is still what a vehicle
       * needs.
       */
      mesh.userData.noctisSilhouette = {
        kind: 'pedestrian', group: 1, partVertices: LOFT_PART_VERTICES,
        subject: `streetlife:ped:${b.def.name}`,
        palette: true, paletteAttribute: 'noctisGarment', gait: true,
      };

      b.frameMesh = mesh;
      b.frameGeo = geo;
      b.motion = createInstanceMotion(n, `streetlife:${b.def.name}`);
      b.scratch = new Float32Array(n * 16);

      root.add(mesh);
    }
  }

  // -------------------------------------------------------------------------
  // pedestrians — where they are
  // -------------------------------------------------------------------------

  /**
   * How much of an island's loop lies inside the simulated disc. Sixty-four
   * samples over 435.2 m is one every 6.8 m, which resolves the disc edge to
   * better than a body length.
   */
  function loopCoverage(cx, cz, camx, camz) {
    let hit = 0;
    const r2 = SIM_RADIUS_M * SIM_RADIUS_M;
    for (let i = 0; i < COVERAGE_SAMPLES; i++) {
      const p = ((i + 0.5) / COVERAGE_SAMPLES) * LOOP_LENGTH;
      loopPoint(cx, cz, p, 0, scratchPoint);
      /**
       * A sample in the river is not pavement. Session 15: the island loop of
       * a chunk the river runs through is water for most of its length, and
       * without this the apportionment hands that chunk its full share of the
       * crowd and then `seatAgent` has nowhere to put them. Counting coverage
       * on the WATER rather than on the envelope keeps the promenade, which is
       * outside `inRiver` and is where a riverside chunk's people belong.
       */
      if (riverImpassable(rootSeed, scratchPoint.x, scratchPoint.z, BODY_HALF_WIDTH_M)) continue;
      const dx = scratchPoint.x - camx;
      const dz = scratchPoint.z - camz;
      if (dx * dx + dz * dz <= r2) hit++;
    }
    return hit / COVERAGE_SAMPLES;
  }

  /**
   * The footfall weight of one chunk: coverage x density^3 x destinations.
   *
   * THREE TERMS, AND THE THIRD IS WHY THIS EXCEEDS THE PROPS' CV RATHER THAN
   * MATCHING IT. A bollard is placed where the density field is high. A
   * person is where the field is high AND there is somewhere to be going, so
   * the count of real destinations on the island — shopfronts, corners and
   * stall pitches — multiplies the field's cube. Measured over 339 camera
   * placements along the three gate routes: mean CV 1.168, minimum 0.849,
   * minimum populated fraction 0.44. The floor is 0.7 and the props deliver
   * 0.689.
   */
  function footfallWeight(ctx, cx, cz, camx, camz) {
    const cov = loopCoverage(cx, cz, camx, camz);
    if (cov <= 0) return 0;
    const b = chunkBounds(cx, cz);
    const dens = densityAt(rootSeed, (b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
    const dest = destinationsFor(ctx, cx, cz).length;
    return cov * Math.pow(dens, FOOTFALL_DENSITY_POWER) * dest;
  }

  /**
   * Recompute the per-chunk allocation and move whoever is in the wrong place.
   *
   * Largest-remainder apportionment, so the shares sum to exactly the
   * population: floor every exact share, then hand the remainder to the
   * chunks with the largest fractional parts. Rounding each share
   * independently would lose or gain people, and the census reads
   * `instanceMatrix.count` — a population that does not match what was
   * allocated is the mismatch `citycheck` exists to catch.
   */
  function rebalance(ctx, camera) {
    const s = CITY.chunkSize;
    const ccx = Math.floor(camera.position.x / s);
    const ccz = Math.floor(camera.position.z / s);

    const ring = [];
    let sum = 0;
    for (let dz = -PED_RING; dz <= PED_RING; dz++) {
      for (let dx = -PED_RING; dx <= PED_RING; dx++) {
        const cx = ccx + dx;
        const cz = ccz + dz;
        const w = footfallWeight(ctx, cx, cz, camera.position.x, camera.position.z);
        ring.push({ cx, cz, key: chunkKey(cx, cz), w, target: 0, exact: 0 });
        sum += w;
      }
    }

    let floored = 0;
    for (const c of ring) {
      c.exact = sum > 0 ? (c.w / sum) * agents.length : agents.length / ring.length;
      c.target = Math.floor(c.exact);
      floored += c.target;
    }
    const remainder = agents.length - floored;
    const byFraction = ring.slice().sort((a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)));
    for (let i = 0; i < remainder; i++) byFraction[i % byFraction.length].target++;

    const wanted = new Map(ring.map((c) => [c.key, c]));
    pedRingKeys = ring.map((c) => c.key);

    // Who is where now, and who is nowhere the ring knows about.
    const held = new Map();
    const homeless = [];
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      const key = chunkKey(a.cx, a.cz);
      if (!wanted.has(key) || !a.placed) {
        homeless.push(i);
        continue;
      }
      if (!held.has(key)) held.set(key, []);
      held.get(key).push(i);
    }

    /**
     * Surplus is shed from the back of the queue sorted by distance from the
     * camera, so the person who disappears is the furthest away. A re-seat is
     * a teleport and its motion vector would span it; `carry(i)` on the frame
     * it happens is what keeps that out of the motion field.
     */
    const cam = camera.position;
    for (const [key, list] of held) {
      const target = wanted.get(key).target;
      if (list.length <= target) continue;
      list.sort((i, j) => {
        const ai = agents[i];
        const aj = agents[j];
        const di = (ai.x - cam.x) * (ai.x - cam.x) + (ai.z - cam.z) * (ai.z - cam.z);
        const dj = (aj.x - cam.x) * (aj.x - cam.x) + (aj.z - cam.z) * (aj.z - cam.z);
        return di - dj;
      });
      for (let k = target; k < list.length; k++) homeless.push(list[k]);
      list.length = target;
    }

    let next = 0;
    for (const c of ring) {
      const have = held.has(c.key) ? held.get(c.key).length : 0;
      if (have >= c.target) continue;
      const rng = chunkRng(rootSeed, c.cx, c.cz, 'pedestrian');
      for (let k = have; k < c.target && next < homeless.length; k++) {
        seatAgent(ctx, agents[homeless[next++]], c, rng, camera);
      }
    }
    /**
     * Unreachable, and here anyway. The targets sum to the population by
     * construction — largest remainder distributes exactly `agents.length` —
     * so every homeless agent has a deficit waiting for it. If that ever
     * stops being true, an agent left un-seated would still be DRAWN, at
     * wherever it was, and counted in no chunk: a population that renders and
     * does not appear in its own census. Seating it into the heaviest chunk
     * is wrong by one person and visible in `pedestrianStats().perChunk`,
     * which is the failure mode to prefer.
     */
    const overflow = byFraction[0];
    while (next < homeless.length) {
      seatAgent(
        ctx,
        agents[homeless[next++]],
        overflow,
        chunkRng(rootSeed, overflow.cx, overflow.cz, 'pedestrian'),
        camera
      );
    }

    lastRebalanceChunk = `${ccx},${ccz}`;
    lastRebalanceAt.copy(camera.position);
  }

  /** Put one agent somewhere on one island's loop, inside the disc if it can. */
  function seatAgent(ctx, a, chunk, rng, camera) {
    a.cx = chunk.cx;
    a.cz = chunk.cz;
    a.placed = true;
    a.reseated = true;
    const r2 = SIM_RADIUS_M * SIM_RADIUS_M;
    let p = 0;
    for (let t = 0; t < 12; t++) {
      p = rng.next() * LOOP_LENGTH;
      loopPoint(a.cx, a.cz, p, a.spread, scratchPoint);
      // Never seated in the water. Twelve draws and then whatever the last one
      // gave, which is the existing contract of this loop — a chunk whose
      // whole loop is river gets a coverage of 0 in `loopCoverage` and is
      // therefore never allocated anybody to seat.
      if (riverImpassable(rootSeed, scratchPoint.x, scratchPoint.z, BODY_HALF_WIDTH_M)) continue;
      const dx = scratchPoint.x - camera.position.x;
      const dz = scratchPoint.z - camera.position.z;
      if (dx * dx + dz * dz <= r2) break;
    }
    a.p = p;
    a.dir = rng.chance(0.5) ? 1 : -1;
    a.dwell = 0;
    a.pathLength = 0;
    a.gaitPhase = rng.range(0, GAIT_CYCLE_M);
    // A re-seat is a teleport; the gait state goes with it so the previous
    // frame's phase does not describe somebody a hundred metres away. Same
    // argument as `carry(i)` on the instance matrix, one attribute over.
    a.gaitU = a.gaitPhase / GAIT_CYCLE_M;
    a.gaitUPrev = a.gaitU;
    a.gaitAmpPrev = a.gaitAmp;
    // A fresh trip, and a fresh straightness history: the jump the re-seat
    // just made is not a walk and must not enter either.
    historyHead[a.index] = -1;
    historyFilled[a.index] = 0;
    planTrip(ctx, a, rng);
    updateAgentPosition(a, ctx);
  }

  /**
   * Choose the next destination and how far it is along the loop.
   *
   * Destinations are FEATURES, never bare points: a shopfront, a junction
   * corner or a stall pitch. The list always has the four corners in it, so
   * there is no branch for "nowhere to go". The chosen feature is the one
   * whose distance ahead is closest to a draw from the trip-length
   * distribution, which is what makes the mean trip 43.7 m rather than
   * whatever the feature spacing happens to be.
   */
  function planTrip(ctx, a, rngIn) {
    const rng = rngIn || ctx.rng('streetlife:trip');
    if (rng.chance(REVERSE_CHANCE)) a.dir = -a.dir;
    const want = Math.min(TRIP_MAX_M, TRIP_MIN_M + -Math.log(1 - rng.next()) * TRIP_SCALE_M);

    const list = destinationsFor(ctx, a.cx, a.cz);
    let best = null;
    let bestErr = Infinity;
    for (let i = 0; i < list.length; i++) {
      let arc = (list[i].p - a.p) * a.dir;
      arc = ((arc % LOOP_LENGTH) + LOOP_LENGTH) % LOOP_LENGTH;
      if (arc < 2) continue;
      const err = Math.abs(arc - want);
      if (err < bestErr) {
        bestErr = err;
        best = { arc, kind: list[i].kind };
      }
    }
    if (!best) best = { arc: Math.min(want, LOOP_LENGTH * 0.5), kind: 'corner' };

    /**
     * The leg is tested against the occupancy before it is walked, sampled
     * every 6 m. Buildings sit at 11.7 m and the loop at 9.6, so on an
     * ordinary block this never fires — the lattice guarantees it. It fires
     * on a viaduct pier standing in the pavement and on the origin block's
     * cross street, whose 13 m carriageway puts its facades at 10.7 m.
     */
    const boxes = walkBlockers(ctx, a.cx, a.cz);
    let arc = best.arc;
    for (let d = PATH_PROBE_M; d <= arc; d += PATH_PROBE_M) {
      loopPoint(a.cx, a.cz, a.p + a.dir * d, a.spread, scratchPoint);
      // The river is occupancy of a kind no box can express — a bridge deck is
      // a hole in it — so it is tested by the same predicate the walkability
      // mask and the traffic lattice use, beside the box test rather than
      // inside it.
      if (occupied(boxes, scratchPoint.x, scratchPoint.z, BODY_HALF_WIDTH_M) ||
          riverImpassable(rootSeed, scratchPoint.x, scratchPoint.z, BODY_HALF_WIDTH_M)) {
        arc = Math.max(0, d - PATH_PROBE_M);
        best.kind = 'corner';
        break;
      }
    }
    a.remaining = arc;
    a.destKind = best.kind;
    if (arc <= 0) {
      // Nowhere to go this way. Turn round rather than stand in a wall.
      a.dir = -a.dir;
      a.dwell = DWELL_MIN_S;
    }
  }

  /**
   * THE FEET FOLLOW THE GROUND — session 19, and until this session they did
   * not: `writeMatrices` wrote a literal `0` into every pedestrian's instance
   * matrix and the crowd stood on the plane y = 0 whatever was under it.
   *
   * That was invisible while the streamed pavement was 0.030 m high, because
   * 30 mm is a third of a shoe sole. Declaring the ground datum
   * (`constants.js` → `GROUND`) put the pavement at `BLOCK.kerbHeight` =
   * 0.160 m, so the same literal would have buried 360 people to the ankle —
   * the datum makes this error EIGHT TIMES LARGER for anything standing on a
   * pavement, which is why it is fixed in the same change rather than after it.
   *
   * ONE QUERY, THE SAME ONE THE PLAYER USES. `city.groundYAt` is the world
   * ground height — the maximum over the streamed quads, the origin block and
   * the river's decks — so a pedestrian crossing the origin block's kerb and a
   * player crossing it are answered by the same function rather than by two
   * that agree today. See `city.js` → `worldSurfaceAt`.
   *
   * PER AGENT PER FRAME, AND THE COST IS WHY `groundYAt` EXISTS AT ALL. 360
   * agents against the player's one, so the query had to lose its allocation
   * and gain the per-chunk bound that rejects eight of nine neighbours in four
   * comparisons. What remains is about ten rectangle tests an agent.
   *
   * A SNAP, NOT AN INTERPOLATION, for the reason `player.js` gives about a
   * kerb: a 0.160 m rise smoothed over three frames is a lift, and a pedestrian
   * stepping up a kerb steps up it. The gait model's vertical bob rides on top
   * of this in the vertex shader and is unaffected — it is a displacement about
   * the instance origin, and the instance origin is what moved.
   */
  function updateAgentPosition(a, ctx) {
    loopPoint(a.cx, a.cz, a.p, a.spread, scratchPoint);
    a.x = scratchPoint.x;
    a.z = scratchPoint.z;
    const city = ctx && ctx.get ? ctx.get('city') : null;
    a.y = city && city.groundYAt ? city.groundYAt(a.x, a.z) : 0;
    if (a.dwell > 0) {
      a.yaw = a.dwellYaw;
    } else {
      a.yaw = Math.atan2(a.dir * scratchPoint.hx, a.dir * scratchPoint.hz);
    }
  }

  // -------------------------------------------------------------------------
  // stalls
  // -------------------------------------------------------------------------

  function buildStallGeometries() {
    stallGeometries = {};
    for (const kind of Object.keys(STALL_KINDS)) {
      stallGeometries[kind] = track(boxesToGeometry(STALL_KINDS[kind].body, true, true));
    }
    glowGeometry = track(boxesToGeometry([{ x: 0, y: 0, z: 0, w: 1, h: 1, d: 1 }], false));
  }

  /**
   * One chunk's pitches, and the meshes that draw them.
   *
   * EVERY PLACEMENT IS TESTED BEFORE IT EXISTS. CONTRACT §9.1: anything
   * placed procedurally is tested against the existing occupancy, or it is
   * not placed. Six tries then abandon — a chunk that is mostly landmark gets
   * fewer stalls, which is the correct answer rather than a lucky one — and
   * the abandonment is counted, because a placement routine that silently
   * drops a third of its work looks exactly like one that was asked for less.
   */
  function buildStallChunk(ctx, cx, cz) {
    const key = chunkKey(cx, cz);
    const d = chunkData(cx, cz);
    const want = Math.round(STALL_MAX_PER_CHUNK * smoothstep(STALL_KNEE_LO, STALL_KNEE_HI, d.density));
    const group = new THREE.Group();
    group.name = `streetlife:stalls:${key}`;

    const pitches = [];
    const counts = Object.fromEntries(Object.keys(STALL_KINDS).map((k) => [k, 0]));
    /** Pitches taken on each of the island loop's four edges. `STALL_MAX_PER_EDGE`. */
    const edgeCount = [0, 0, 0, 0];
    let gaveUp = 0;

    if (want > 0) {
      const rng = chunkRng(rootSeed, cx, cz, 'stall');
      const boxes = walkBlockers(ctx, cx, cz);
      const kindTotal = STALL_KIND_WEIGHTS.reduce((s, k) => s + k.w, 0);

      for (let i = 0; i < want; i++) {
        const roll = rng.next() * kindTotal;
        let acc = 0;
        let kind = 'market';
        for (const k of STALL_KIND_WEIGHTS) {
          acc += k.w;
          if (roll <= acc) {
            kind = k.kind;
            break;
          }
        }

        let placed = false;
        for (let t = 0; t < STALL_TRIES && !placed; t++) {
          const p = rng.next() * LOOP_LENGTH;
          let clash = false;
          for (const q of pitches) {
            let gap = Math.abs(q.p - p);
            gap = Math.min(gap, LOOP_LENGTH - gap);
            if (gap < STALL_MIN_SPACING_M) {
              clash = true;
              break;
            }
          }
          if (clash) continue;

          let thisKind = kind;
          if (thisKind === 'infill' || thisKind === 'rack') {
            // An infill pitch is a pitch in a shut shop BAY. Probed 2.5 m
            // inland of the loop line, which is 12.1 m from the centreline
            // and therefore 0.4 m inside the footprint of any perimeter
            // building, whose facade sits exactly on the 11.7 m island edge.
            // Without a facade there is no bay, and it becomes a market stall.
            loopPoint(cx, cz, p, 2.5, scratchPoint);
            if (!occupied(boxes, scratchPoint.x, scratchPoint.z, 0)) {
              /**
               * A bay pitch with no bay becomes a free-standing one, and WHICH
               * free-standing one is the kind's own sibling rather than always
               * `market`: an infill trestle becomes a market stall and a
               * clothing rack becomes a produce pitch. Always falling back to
               * `market` is how a five-kind vocabulary delivers as three.
               */
              thisKind = thisKind === 'rack' ? 'produce' : 'market';
            }
          }

          const fp = STALL_FOOTPRINT[thisKind];
          loopPoint(cx, cz, p, fp.inset, scratchPoint);

          /**
           * A ROW OF FOUR IS A PARADE; A ROW OF NINE IS A TEXTURE. The cap is
           * per EDGE of the island loop because that is the unit the operator
           * was looking down — one continuous run of pavement — and not the
           * chunk, which is four of them. See `STALL_MAX_PER_EDGE`.
           */
          if (edgeCount[scratchPoint.edge] >= STALL_MAX_PER_EDGE) continue;

          /**
           * THE SIZE AND THE YAW ARE ROLLED HERE, ABOVE THE TEST, AND THAT
           * ORDER IS THE WHOLE POINT. `hx`/`hz` are what `rectBlocked` tests
           * and what the pitch is recorded with; the same numbers reach
           * `composeScaledYaw` below. Rolling them after the test would ship a
           * box tested and a different box drawn, which is CONTRACT §9.1's own
           * recorded failure and is what the park's edge hedging was doing in
           * this same session.
           */
          const sAlong = rng.range(STALL_SIZE.loAlong, STALL_SIZE.hiAlong);
          const sUp = rng.range(STALL_SIZE.loUp, STALL_SIZE.hiUp);
          const sAcross = rng.range(STALL_SIZE.loAcross, STALL_SIZE.hiAcross);
          const jitterDeg = rng.range(-STALL_YAW_JITTER_DEG, STALL_YAW_JITTER_DEG);
          const jr = Math.abs(jitterDeg) * DEG;
          /** The rotated box's own half-extents — |cos|·L + |sin|·W, session 24's row. */
          const halfAlong = fp.halfAlong * sAlong * Math.cos(jr) + fp.halfAcross * sAcross * Math.sin(jr);
          const halfAcross = fp.halfAcross * sAcross * Math.cos(jr) + fp.halfAlong * sAlong * Math.sin(jr);

          // Edges 0 and 2 run along x, so the stall's width is its x extent
          // there and its z extent on the other two.
          const alongX = scratchPoint.edge === 0 || scratchPoint.edge === 2;
          const hx = alongX ? halfAlong : halfAcross;
          const hz = alongX ? halfAcross : halfAlong;
          if (rectBlocked(boxes, scratchPoint.x, scratchPoint.z, hx, hz)) continue;
          edgeCount[scratchPoint.edge]++;

          pitches.push({
            p,
            kind: thisKind,
            sAlong,
            sUp,
            sAcross,
            jitterDeg,
            x: scratchPoint.x,
            z: scratchPoint.z,
            /**
             * THE PAVEMENT UNDER THIS PITCH — session 19, and it is queried
             * ONCE, here, rather than every frame.
             *
             * A stall does not move, so the frame loop has nothing to ask: its
             * base was the literal `0` handed to `composeScaledYaw`, which put
             * every stall on the plane y = 0 while its pitch is on a pavement.
             * That was a 0.030 m error before the ground datum was declared and
             * would be a 0.160 m one after it — a stall sunk to the top of its
             * own kick rail. See `constants.js` → `GROUND`.
             *
             * A pitch is on a pavement by construction (`fp.inset` puts it
             * between the kerb and the facade), so this is `GROUND.pavement` in
             * almost every case — and it is READ rather than assumed, because
             * "almost every" is exactly the kind of claim that is false at the
             * bridges and in the origin block.
             */
            groundY: (() => {
              const city = ctx.get('city');
              return city && city.groundYAt ? city.groundYAt(scratchPoint.x, scratchPoint.z) : 0;
            })(),
            yawDeg: Math.atan2(scratchPoint.ox, scratchPoint.oz) / DEG + fp.faceDeg,
            chroma: rng.int(0, STALL_CHROMA.length - 1),
            /**
             * The awning's own cloth, rolled independently of the LIGHT's
             * chromaticity. They are two different quantities — a reflectance
             * and an emitter chromaticity — and a stall whose canopy is always
             * the colour of its own strip light is a stall lit by its own
             * paint. CONTRACT §9 rule 1: name the quantity in the expression.
             */
            cloth: rng.int(0, AWNING_CLOTH.length - 1),
            soil: rng.range(0.62, 1.0),
            light: null,
          });
          counts[thisKind]++;
          placed = true;
        }
        if (!placed) gaveUp++;
      }
    }

    const meshes = [];
    for (const kind of Object.keys(STALL_KINDS)) {
      const of = pitches.filter((q) => q.kind === kind);
      if (!of.length) continue;
      /**
       * THE GEOMETRY IS CLONED PER MESH, because the two per-instance colour
       * attributes live on `geometry.attributes` and three's object-level
       * fallbacks cover only `instanceMatrix` and `instanceColor` — the same
       * sentence the pedestrian meshes carry, for the same reason. The
       * positions, normals, colours and part labels are shared buffers; only
       * the two instanced attributes are new per chunk.
       */
      const geo = stallGeometries[kind].clone();
      const mesh = new THREE.InstancedMesh(geo, materials.stallBody, of.length);
      /**
       * TWO COLOURS AN INSTANCE, SELECTED BY THE PART LABEL BAKED INTO
       * `noctisLimb.z`. Session 14, and it is the pedestrians' mechanism
       * (§5.6's select) with a stall's part label instead of a garment mask.
       *
       * `noctisBodyColor` is white because the STRUCTURE's reflectances are
       * already in the geometry's own `color` attribute and the soiling is
       * already in `instanceColor`; multiplying by one here would be a third
       * copy of the same quantity. `noctisGarment` is the pitch's own cloth.
       * A canopy is therefore one draw call per kind per chunk whatever its
       * colour, which is what made this affordable at all — STATE §8 recorded
       * the alternative as "one more mesh per chunk in the stall ring".
       */
      /**
       * FOUR COMPONENTS, to match the widened declaration. A stall has two
       * zones and not three — its part labels are 0 and 1 — so the packed
       * third zone is never selected and the two spare floats stay 0, which
       * unpacks to black and is never read. Declaring three components against
       * a `vec4` attribute would leave the fourth at the generic default of 1
       * on some drivers and 0 on others; supplying it is one line and removes
       * the question.
       */
      const bodyCol = new Float32Array(of.length * 4);
      for (let i = 0; i < of.length; i++) {
        bodyCol[i * 4] = 1;
        bodyCol[i * 4 + 1] = 1;
        bodyCol[i * 4 + 2] = 1;
      }
      const clothCol = new Float32Array(of.length * 4);
      const mesh_ = mesh;
      for (let i = 0; i < of.length; i++) {
        // `of[i].groundY`, not the literal 0 it was until session 19 — the
        // pitch's own pavement height, queried once at placement. See `groundY`
        // in `buildStallChunk`.
        /**
         * THE PER-PITCH SCALE AND JITTER, AND THEY ARE THE SAME NUMBERS THE
         * PLACEMENT TESTED. Until session 31 this passed the literals `1, 1, 1`
         * and no jitter, so all 340 delivered stalls in the ring were the same
         * box at the same angle — see `STALL_SIZE`. The prototype's local x is
         * the along-kerb axis and its local z the depth, which is why the
         * arguments are in that order.
         */
        mesh_.setMatrixAt(i, composeScaledYaw(
          of[i].x, of[i].groundY, of[i].z, of[i].yawDeg + of[i].jitterDeg,
          of[i].sAlong, of[i].sUp, of[i].sAcross,
        ));
        const m = of[i].soil;
        // Soiling darkens and warms. A SIGNED colour jitter used as a soiling
        // term is CONTRACT §9 row 14; this one only ever multiplies down.
        tmpColor.setRGB(m, m * 0.985, m * 0.96, THREE.LinearSRGBColorSpace);
        mesh_.setColorAt(i, tmpColor);
        const cloth = AWNING_CLOTH[of[i].cloth % AWNING_CLOTH.length];
        clothCol[i * 4] = cloth[0];
        clothCol[i * 4 + 1] = cloth[1];
        clothCol[i * 4 + 2] = cloth[2];
      }
      geo.setAttribute('noctisBodyColor', new THREE.InstancedBufferAttribute(bodyCol, 4));
      geo.setAttribute('noctisGarment', new THREE.InstancedBufferAttribute(clothCol, 4));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      mesh.name = `${key}:stall:${kind}`;
      mesh.userData.noctisCensus = { chunk: key, [`stall_${kind}`]: of.length };
      /**
       * THE AWNING PALETTE JOINS THE CHROMA CENSUS, reusing the instrument the
       * pedestrians already use rather than a second one. `palette: true` with
       * `paletteAttribute: 'noctisGarment'` is exactly the pedestrian
       * declaration, because it is exactly the same attribute carrying exactly
       * the same kind of quantity — a per-instance reflectance selected by a
       * per-vertex part label. No `subject`, no `partVertices`: a stall has no
       * silhouette assertion and declaring the fields for one would put a
       * subject into `harness.silhouettes()` that no gate reads, which is a
       * mesh the census counts and nothing measures.
       */
      mesh.userData.noctisSilhouette = {
        kind: 'stallAwning', group: 1, palette: true, paletteAttribute: 'noctisGarment',
        /** See `harness.silhouettes()`: this mesh is in the colour census and not the outline one. */
        paletteOnly: true,
      };
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
      meshes.push(mesh);
    }

    /**
     * The lit surfaces, every kind in one mesh, because a strip light and a
     * menu board differ only by a scale and a tint and both of those ride per
     * instance. Chroma index -1 means "the pitch's own chromaticity", which is
     * how a canopy rope and a menu board on the same stall come out the same
     * colour of light instead of two.
     */
    let glowCount = 0;
    for (const q of pitches) glowCount += STALL_KINDS[q.kind].glow.length;
    if (glowCount) {
      const glow = new THREE.InstancedMesh(glowGeometry, materials.stallGlow, glowCount);
      let gi = 0;
      for (const q of pitches) {
        /**
         * THE GLOW RIDES THE BODY'S OWN SCALE AND JITTER — session 31. These
         * boxes are positioned in the stall's local frame and emitted as
         * separate instances in a separate mesh, so a per-pitch scale applied
         * to the body alone would leave every awning strip and every griddle
         * at the size and place of a stall that is no longer there. The local
         * offset is scaled by the same three numbers before it is rotated, and
         * the box's own dimensions by the matching axis: `g.x` is along, `g.z`
         * is across, `g.y` is up, which is the frame `STALL_KINDS` authors in.
         */
        const rad = (q.yawDeg + q.jitterDeg) * DEG;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        for (const g of STALL_KINDS[q.kind].glow) {
          const lx = g.x * q.sAlong;
          const lz = g.z * q.sAcross;
          const wx = q.x + lx * cos + lz * sin;
          const wz = q.z - lx * sin + lz * cos;
          // `g.y` is the glow box's height in the STALL's own frame; the stall's
          // frame now sits on the pavement rather than on y = 0, so the two are
          // added. Session 19 — a glow strip left at `g.y` would have floated
          // 0.160 m over the awning it belongs to.
          glow.setMatrixAt(gi, composeScaledYaw(
            wx, q.groundY + g.y * q.sUp, wz, q.yawDeg + q.jitterDeg,
            g.w * q.sAlong, g.h * q.sUp, g.d * q.sAcross,
          ));
          const c = STALL_CHROMA[g.chroma < 0 ? q.chroma : g.chroma];
          tmpColor.setRGB(c[0] * g.gain, c[1] * g.gain, c[2] * g.gain, THREE.LinearSRGBColorSpace);
          glow.setColorAt(gi, tmpColor);
          gi++;
        }
      }
      glow.instanceMatrix.needsUpdate = true;
      glow.instanceColor.needsUpdate = true;
      glow.name = `${key}:stall:glow`;
      glow.userData.noctisCensus = { chunk: key, stall_emissive: glowCount };
      glow.frustumCulled = true;
      glow.computeBoundingSphere();
      group.add(glow);
      meshes.push(glow);
    }

    root.add(group);
    stallChunks.set(key, { cx, cz, group, pitches, counts, gaveUp, meshes });
    // A new stall is a new destination, so the island's list is stale.
    destinations.delete(key);
  }

  function unbuildStallChunk(key) {
    const rec = stallChunks.get(key);
    if (!rec) return;
    root.remove(rec.group);
    /**
     * The instance buffers, AND — since session 14 — the per-chunk geometry
     * CLONES that carry the two per-instance colour attributes.
     *
     * Materials are shared across every chunk in the ring and are disposed once
     * at module dispose; disposing one here would delete what the other 24
     * chunks are drawing. The clones are not shared: `stallGeometries[kind]` is
     * the prototype and each mesh got `.clone()` of it, because instanced
     * attributes live on the geometry. A clone's `position`, `normal`, `color`
     * and `noctisLimb` are the SAME BufferAttribute objects as the prototype's
     * — `BufferGeometry.clone` copies the attribute references for shared
     * arrays it did not create — so disposing a clone frees its own two
     * instanced attributes and the prototype survives. Verified by the ring
     * cycling: `citycheck` walks the scene after a full stream and finds every
     * stall mesh drawing what it allocated.
     */
    for (const m of rec.meshes) {
      if (m.geometry && m.geometry.getAttribute('noctisGarment')) m.geometry.dispose();
      m.dispose();
    }
    stallChunks.delete(key);
    destinations.delete(key);
  }

  /**
   * A transform, returned in a SHARED Matrix4. Every caller hands it straight
   * to `setMatrixAt`, which copies, so there is nothing to clone.
   */
  function composeScaledYaw(x, y, z, yawDeg, sx, sy, sz) {
    tmpPos.set(x, y, z);
    tmpEuler.set(0, yawDeg * DEG, 0);
    tmpQuat.setFromEuler(tmpEuler);
    tmpScale.set(sx, sy, sz);
    return tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
  }

  /**
   * Hand the twelve slots to the twelve food stands nearest the camera.
   *
   * Reassigned when the ring is rebuilt and not every frame, for the reason
   * `city.js` parks its lamps rather than removing them: a light that comes
   * and goes changes every froxel's index list, and one that sits still and
   * changes intensity changes nothing.
   */
  function assignStallLights(camera) {
    const stands = [];
    for (const rec of stallChunks.values()) {
      for (const q of rec.pitches) {
        q.light = null;
        if (q.kind !== 'food') continue;
        const dx = q.x - camera.position.x;
        const dz = q.z - camera.position.z;
        stands.push({ q, d2: dx * dx + dz * dz });
      }
    }
    stands.sort((a, b) => a.d2 - b.d2);
    for (let i = 0; i < stallLightPool.length; i++) {
      const slot = stallLightPool[i];
      const pick = stands[i];
      if (!pick) {
        slot.position.set(0, -1000, 0);
        slot.intensity = 0;
        continue;
      }
      const rad = pick.q.yawDeg * DEG;
      slot.position.set(
        pick.q.x + STALL_WORKLIGHT_LOCAL_Z * Math.sin(rad),
        // `STALL_WORKLIGHT_HEIGHT_M` is a height ABOVE THE STALL — it is derived
        // from the awning it hangs under — so it is measured from the pitch's
        // own ground, not from the world origin. Session 19: the stall moved up
        // onto its pavement and the lamp has to go with it, or the pool it
        // throws lands 0.160 m into the pavement it is meant to light.
        pick.q.groundY + STALL_WORKLIGHT_HEIGHT_M,
        pick.q.z + STALL_WORKLIGHT_LOCAL_Z * Math.cos(rad)
      );
      pick.q.light = slot;
    }
  }

  // -------------------------------------------------------------------------

  return {
    name: 'streetlife',
    needs: ['lights'],

    init(ctx) {
      rootSeed = String(ctx.config.seed);
      lightsApi = ctx.get('lights');
      cityApi = ctx.get('city');
      const timeApi = ctx.get('time');
      const camApi = ctx.get('camera');

      materials = buildMaterials(ctx);
      buildStallGeometries();
      buildPopulation(ctx);
      buildPedestrianMeshes();
      ctx.scene.add(root);

      for (let i = 0; i < cfg.stallLightSlots; i++) {
        stallLightPool.push(
          lightsApi.add({
            position: new THREE.Vector3(0, -1000, 0),
            color: EMITTER_CHROMA.tungsten,
            intensity: 0,
            radius: STALL_WORKLIGHT_RADIUS_M,
            type: 'point',
            sourceRadius: 0.06,
            role: 'stall',
          })
        );
      }

      // First seating. Everything below reads the live camera, so the first
      // frame is already correct rather than converging over a few frames.
      rebalance(ctx, ctx.camera);
      for (const b of bodies) {
        if (!b.motion) continue;
        b.motion.prime(writeMatrices(b, b.scratch));
        b.frameMesh.instanceMatrix = b.motion.current();
        /**
         * Bound before a frame exists, because a mat4 attribute that is not
         * bound reads as four columns of (0,0,0,1) — singular, and every
         * instance would be at the origin. `prime` stamped both buffers
         * PRIMED, which is older than any frame, so this read is legal and
         * returns the initial transforms: previous equals current, and the
         * motion vector on frame zero is zero for the right reason.
         */
        const prev = b.motion.read(0);
        b.frameGeo.setAttribute('noctisPrevInstanceMatrix', prev);
        // Previous equals current on frame zero, for the gait by the same
        // argument `prime` makes for the transform: a limb's motion vector on
        // the first frame is zero because nothing has moved yet, not because
        // the attribute happened to be zeroed.
        writeGait(b, b.gaitArray);
        b.gaitAttr.needsUpdate = true;
      }

      const internalHeight = internalHeightOf(ctx);
      const theta = pixelAngle(ctx.camera, internalHeight);
      motionCutoffM = motionCutoffDistance(PED_MIN_EXTENT_M, MOTION_MIN_EXTENT_PX, theta);

      const discArea = PAVEMENT_FRACTION * Math.PI * SIM_RADIUS_M * SIM_RADIUS_M;
      const junctionPerChunk = 4 * CITY.sidewalkWidth * CITY.sidewalkWidth;
      const netFraction = PAVEMENT_FRACTION - junctionPerChunk / (CITY.chunkSize * CITY.chunkSize);
      const netArea = netFraction * Math.PI * SIM_RADIUS_M * SIM_RADIUS_M;
      const typeCounts = bodies.map((b) => `${b.def.name} ${b.indices.length}`).join(', ');

      ctx.log(
        `streetlife: pavement ${CITY.sidewalkWidth} m x 2 on a ${CITY.chunkSize} m lattice = ` +
        `2/${CITY.chunkSize} = ${(2 / CITY.chunkSize).toFixed(6)} m centreline per m^2 x ` +
        `${(2 * CITY.sidewalkWidth).toFixed(1)} m^2 per m = ${PAVEMENT_FRACTION.toFixed(5)} pavement ` +
        `fraction; x pi x ${SIM_RADIUS_M}^2 = ${discArea.toFixed(0)} m^2 at ${PEOPLE_PER_M2}/m^2 = ` +
        `${(discArea * PEOPLE_PER_M2).toFixed(0)} people, taken as ${agents.length} (${typeCounts}). ` +
        `Netting off the ${junctionPerChunk.toFixed(2)} m^2 per chunk the junction squares are ` +
        `counted twice gives ${netFraction.toFixed(5)}, ${netArea.toFixed(0)} m^2 and ` +
        `${(netArea * PEOPLE_PER_M2).toFixed(0)} people; 360 is above both. ` +
        `Loop ${LOOP_EDGE_LENGTH.toFixed(1)} m x 4 = ${LOOP_LENGTH.toFixed(1)} m per island, ` +
        `${chromaticGarments} chromatic garments = ` +
        `${((chromaticGarments / agents.length) * 100).toFixed(1)}% x 35% of silhouette x 1.194% of ` +
        `frame = ${((chromaticGarments / agents.length) * 0.35 * 1.194).toFixed(3)} of the 1.52 ` +
        `points the saturation reserve had left`
      );

      /**
       * The gait model's own numbers, printed where they are consumed rather
       * than only where they are declared — CONTRACT §9 rule 4, and this set
       * crosses three files: the geometry authors the pivots, the vertex
       * shader displaces about them, and `harness.silhouettes` projects the
       * result. A constant that three files agree about by luck is exactly
       * the arrangement §9.1 is written about.
       */
      ctx.log(gaitDerivation());

      ctx.log(
        `streetlife: ${bodies.length} builds, ${LOFT_RADIAL}-sided lofts of ${LOFT_RINGS} sections = ` +
        `${LOFT_PART_VERTICES} vertices a part; ` +
        `${bodies.map((b) => `${b.def.name} ${b.def.frame.length + b.def.torso.length}p`).join(', ')}; ` +
        `${bodies.reduce((t, b) => t + (b.def.frame.length + b.def.torso.length) * b.indices.length, 0) * (LOFT_PART_VERTICES / 3)} ` +
        `triangles over ${agents.length} figures, ONE draw call a build since the garment moved from a ` +
        `second mesh to a per-vertex mask (lights.js NOCTIS_GARMENT). Leg shear ${LEG_SHEAR.toFixed(4)}, ` +
        `arm shear ${ARM_SHEAR.toFixed(4)}, both per metre below their own pivot.`
      );

      /**
       * The garment fit, authored against derived, per build, in metres —
       * CONTRACT §9 rule 4 and session 11's standing rule that a number
       * derived from another prints both with its units. A build whose every
       * section reads `=` is one whose authored silhouette already cleared its
       * own body; the ones that read `->` are the ones that were inside it.
       */
      ctx.log(
        `streetlife: garment fit, cloth gap ${CLOTH_GAP_M} m over the body envelope swept across a ` +
        `whole gait cycle (arms and bag excluded — they stand outside the cloth). ` +
        bodies
          .map((b) => {
            const g = b.def.torso[0];
            const rows = g.sections
              .map((s) => {
                const w = s.hw > s.$authoredHw + 1e-6
                  ? `${s.$authoredHw.toFixed(4)}->${s.hw.toFixed(4)}`
                  : `${s.hw.toFixed(4)}=`;
                const d = s.hd > s.$authoredHd + 1e-6
                  ? `${s.$authoredHd.toFixed(4)}->${s.hd.toFixed(4)}`
                  : `${s.hd.toFixed(4)}=`;
                return `y${s.y.toFixed(3)} hw ${w} hd ${d}`;
              })
              .join('; ');
            const sw = g.$sweep;
            const clearance = Number.isFinite(sw.worst)
              ? `swept clearance ${(sw.worst * 1000).toFixed(1)} mm at y ${sw.at.toFixed(3)} m ` +
                `after ${sw.passes} widening pass${sw.passes === 1 ? '' : 'es'}`
              : 'nothing under the cloth to clear';
            return `${b.def.name}[hem ${g.sections[0].y.toFixed(3)} m, ` +
              `${g.openBottom ? 'OPEN' : 'capped'} below ${GAIT.hipHeightM} m hip, ` +
              `${clearance}]: ${rows}`;
          })
          .join(' | ')
      );

      ctx.log(
        `streetlife: motion cutoff ${motionCutoffM.toFixed(1)} m = ${PED_MIN_EXTENT_M} m / ` +
        `(${MOTION_MIN_EXTENT_PX} px x ${theta.toExponential(4)} rad) at ${internalHeight} internal ` +
        `lines and ${ctx.camera.fov.toFixed(1)} deg fov; the ring reaches ` +
        `${(CITY.chunkSize * (PED_RING + 0.5) * Math.SQRT2).toFixed(0)} m, so instances beyond the ` +
        `cutoff are carried rather than given a vector. Per-instance buffers: ` +
        `${bodies.filter((b) => b.motion).length} layers, ` +
        `${(bodies.reduce((n, b) => n + (b.motion ? b.motion.addedBytes : 0), 0) / 1024).toFixed(1)} KiB added, ` +
        `straightness history ${((history.length * 4) / 1024).toFixed(0)} KiB on the CPU`
      );

      ctx.log(
        `streetlife: stalls round(${STALL_MAX_PER_CHUNK} x smoothstep(${STALL_KNEE_LO}, ` +
        `${STALL_KNEE_HI}, density)) per chunk, at most ${STALL_MAX_PER_EDGE} per island edge, ` +
        `over Chebyshev ring ${STALL_RING} = ${(2 * STALL_RING + 1) ** 2} chunks of ` +
        `4 x 108.8 = 435.2 m of island loop each. THE DELIVERED COUNT IS \`stallStats()\`, ` +
        `NOT A NUMBER DERIVED HERE — session 31 measured 199 over the ring, one per 54.7 m. ` +
        `${stallLightPool.length} worklight slots at ${STALL_WORKLIGHT_CANDELA.toFixed(1)} cd = ` +
        `${STALL_WORKLIGHT_LUMENS} lm / 4pi, giving ${STALL_WORKLIGHT_CANDELA.toFixed(1)} lux at 1 m ` +
        `against ${LIGHT.streetAverageLux} lux of ambient; radius ${STALL_WORKLIGHT_RADIUS_M} m is ` +
        `where it falls to 3% of that. Pool now ` +
        `${CLUSTER.maxLights - CLUSTER.trafficLightReserve - stallLightPool.length} of ` +
        `${CLUSTER.maxLights} unreserved. city ${cityApi ? 'live' : 'absent (occupancy from citygen directly)'}, ` +
        `time ${timeApi ? 'live' : 'absent'}, camera module ${camApi ? 'live' : 'absent'}`
      );

      return {
        /**
         * The two numbers `tools/city-budget.json` -> `pedestrians` gates on,
         * plus the population the census reads off `instanceMatrix.count` so
         * the two can be compared without a browser.
         */
        pedestrianStats() {
          const perChunk = {};
          for (const key of pedRingKeys) perChunk[key] = pedCounts.get(key) || 0;
          let sum = 0;
          let n = 0;
          const minSlots = Math.ceil(STRAIGHTNESS_MIN_HISTORY_S / STRAIGHTNESS_SAMPLE_S);
          for (let i = 0; i < agents.length; i++) {
            if (historyFilled[i] < minSlots) continue;
            const head = historyHead[i];
            const oldest = (head - (historyFilled[i] - 1) + STRAIGHTNESS_SLOTS * 2) % STRAIGHTNESS_SLOTS;
            const base = (i * STRAIGHTNESS_SLOTS + oldest) * 3;
            const a = agents[i];
            const len = a.pathLength - history[base + 2];
            if (len < 1) continue;
            const dx = a.x - history[base];
            const dz = a.z - history[base + 1];
            sum += Math.hypot(dx, dz) / len;
            n++;
          }
          const window = Math.max(1e-3, Math.min(ARRIVAL_BUCKETS, simSeconds));
          let arrivals = 0;
          for (let i = 0; i < ARRIVAL_BUCKETS; i++) arrivals += arrivalBuckets[i];
          return {
            total: agents.length,
            perChunk,
            straightness: n ? +(sum / n).toFixed(4) : 0,
            straightnessAgents: n,
            arrivalsPerMinute: +((arrivals / agents.length / window) * 60).toFixed(4),
            suppressedByThreshold,
            motionCutoffM: +motionCutoffM.toFixed(1),
            chromaticGarments,
            reseats: reseatsTotal,
            ringChunks: pedRingKeys.length,
          };
        },

        stallStats() {
          const perChunk = {};
          const byKind = Object.fromEntries(Object.keys(STALL_KINDS).map((k) => [k, 0]));
          /** The cloth roll, so a gate can ask what spread the awnings carry. */
          const cloth = new Set();
          let total = 0;
          let gaveUp = 0;
          let slots = 0;
          for (const [key, rec] of stallChunks) {
            perChunk[key] = { ...rec.counts, gaveUp: rec.gaveUp };
            for (const k of Object.keys(byKind)) byKind[k] += rec.counts[k] || 0;
            total += rec.pitches.length;
            gaveUp += rec.gaveUp;
            for (const q of rec.pitches) { if (q.light) slots++; cloth.add(q.cloth); }
          }
          return {
            total,
            byKind,
            /**
             * Kinds and cloths DELIVERED, not authored. `STALL_KINDS` has five
             * entries and `AWNING_CLOTH` eight; what a route actually shows is
             * what a person sees, and CONTRACT §7.2's pairing is about exactly
             * that difference.
             */
            kindsDelivered: Object.values(byKind).filter((v) => v > 0).length,
            clothsDelivered: cloth.size,
            /**
             * The delivered cloth reflectances themselves, so a gate can
             * measure how far apart they are rather than counting how many
             * there are. CONTRACT §7.2: a floor that counts categories is
             * paired with one that measures the property the categories were
             * assumed to carry, and eight names for one grey is a vocabulary
             * with no spread in it.
             */
            clothColours: [...cloth].sort((a, b) => a - b).map((i) => AWNING_CLOTH[i % AWNING_CLOTH.length]),
            perChunk,
            gaveUp,
            lightSlots: slots,
            maxLightSlots: stallLightPool.length,
            emissiveOnlyFraction: total ? +((total - slots) / total).toFixed(4) : 1,
            ringChunks: stallChunks.size,
          };
        },

        /**
         * The double-buffered layers, for the `motionVectors` bounds. Read off
         * the live objects rather than off a count kept beside them.
         */
        motionLayers() {
          return bodies.filter((b) => b.motion).map((b) => ({ ...b.motion.stats }));
        },

        get pedestrianCount() {
          return agents.length;
        },

        /** The build names, so a diagnostic never has to hardcode the table. */
        pedestrianBuilds() {
          return bodies.map((b) => ({ name: b.def.name, instances: b.indices.length }));
        },

        /**
         * Stand ONE figure of one build at a fixed place and phase, and draw
         * nothing else on foot. `tools/gaitstrip.mjs`. See `posed` above for
         * why this exists and why no gate may read through it.
         *
         * The other builds are hidden with `mesh.count = 0` rather than
         * `visible = false`: `harness.silhouettes` skips invisible meshes but
         * an InstancedMesh at count 0 is still traversed, so if a gate ever
         * did read through here it would find an empty population and say so
         * rather than find a full one and be wrong.
         *
         * Returns the pose it actually took, in world metres — the caller
         * places its camera from THIS and not from what it asked for, so a
         * build that does not exist is a thrown error rather than a strip of
         * eight photographs of a pavement.
         */
        poseOne(spec = {}) {
          const name = spec.build || bodies[0]?.def.name;
          const b = bodies.find((x) => x.def.name === name && x.indices.length > 0);
          if (!b) {
            throw new Error(
              `streetlife: no build '${name}' with instances; have ` +
                bodies.map((x) => `${x.def.name}(${x.indices.length})`).join(', ')
            );
          }
          const a = agents[b.indices[0]];
          a.x = spec.x != null ? spec.x : a.x;
          a.z = spec.z != null ? spec.z : a.z;
          a.yaw = spec.yaw != null ? spec.yaw : a.yaw;
          /**
           * Scale 1 by default, which is BODY_REF_HEIGHT exactly. The gait
           * constants are lengths on the reference body and every instance
           * scales them uniformly with itself, so a strip read at scale 1 is
           * read in the units the model is written in — a clearance measured
           * on a 1.90 m figure would be 1.90/1.72 of the number in gait.js.
           */
          a.scale = spec.scale != null ? spec.scale : 1;
          a.height = a.scale * BODY_REF_HEIGHT;
          a.dwell = 0;
          a.reseated = false;
          posed = {
            agent: a,
            build: b.def.name,
            u: spec.u != null ? spec.u : 0,
            amp: spec.amp != null ? spec.amp : 1,
          };
          for (const other of bodies) {
            if (other.frameMesh) other.frameMesh.count = other === b ? 1 : 0;
          }
          return {
            build: b.def.name,
            x: a.x,
            z: a.z,
            yaw: a.yaw,
            scale: a.scale,
            height: a.height,
            u: posed.u,
            amp: posed.amp,
            cycleM: GAIT_CYCLE_M,
            hipHeightM: GAIT.hipHeightM,
          };
        },

        /** Hand the population back. Idempotent. */
        poseRelease() {
          posed = null;
          for (const b of bodies) {
            if (b.frameMesh) b.frameMesh.count = b.indices.length;
          }
        },
      };
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
      const camera = ctx.camera;
      const time = ctx.get('time');
      const lighting = ctx.get('lighting');
      if (!cityApi) cityApi = ctx.get('city');

      /**
       * The frame id, derived rather than kept. `time` owns it (CONTRACT §3);
       * the clamp exists because `instmotion.begin` throws on a repeated or
       * decreasing id, and a `time` module that is quarantined mid-session
       * would otherwise hand back undefined and restart the count at zero.
       */
      const incoming = time && Number.isFinite(time.frame) ? time.frame : lastFrameId + 1;
      const frame = incoming > lastFrameId ? incoming : lastFrameId + 1;
      lastFrameId = frame;

      simSeconds += dt;
      suppressedByThreshold = 0;
      reseatsThisFrame = 0;

      // --- stalls: the ring ---------------------------------------------
      const s = CITY.chunkSize;
      const ccx = Math.floor(camera.position.x / s);
      const ccz = Math.floor(camera.position.z / s);
      const camChunk = `${ccx},${ccz}`;
      if (camChunk !== stallCameraChunk) {
        const wanted = new Set();
        for (let dz = -STALL_RING; dz <= STALL_RING; dz++) {
          for (let dx = -STALL_RING; dx <= STALL_RING; dx++) wanted.add(chunkKey(ccx + dx, ccz + dz));
        }
        for (const key of [...stallChunks.keys()]) if (!wanted.has(key)) unbuildStallChunk(key);
        /**
         * The whole ring on the first fill and six a frame afterwards. A
         * budget on the first fill would leave the ring incomplete for five
         * frames, and a gate that samples the scene straight after
         * `waitForCity()` would measure the streaming rather than the city.
         * After that only a row of five to nine chunks enters at a crossing,
         * so the budget is rarely the binding constraint.
         */
        let budget = stallChunks.size === 0 ? Infinity : 6;
        let complete = true;
        for (let dz = -STALL_RING; dz <= STALL_RING; dz++) {
          for (let dx = -STALL_RING; dx <= STALL_RING; dx++) {
            const key = chunkKey(ccx + dx, ccz + dz);
            if (stallChunks.has(key)) continue;
            if (budget <= 0) {
              complete = false;
              continue;
            }
            buildStallChunk(ctx, ccx + dx, ccz + dz);
            budget--;
          }
        }
        if (complete) {
          stallCameraChunk = camChunk;
          assignStallLights(camera);
        }
      }

      /**
       * CONTRACT §3: a photocell, not a clock, and the same one the street
       * lamps and the block run on. A market that lit up at a different hour
       * from the street it stands in is the kind of thing nobody notices until
       * a frame is captured between the two.
       */
      const lit = lighting ? lighting.photocellOn : true;
      materials.stallGlow.emissiveIntensity = lit ? STALL_GLOW_NITS : 60;
      for (const slot of stallLightPool) {
        slot.intensity = lit && slot.position.y > 0 ? STALL_WORKLIGHT_CANDELA : 0;
      }

      // --- pedestrians: the ring ----------------------------------------
      // Re-seating is suppressed while posed: the subject of a phase strip has
      // to stand in the same place in every frame of it, and a rebalance moves
      // whoever is furthest from the camera, which is a population of one.
      const moved = camera.position.distanceTo(lastRebalanceAt);
      if (!posed && (camChunk !== lastRebalanceChunk || moved > REBALANCE_MOVE_M)) {
        rebalance(ctx, camera);
      }

      // --- pedestrians: walk --------------------------------------------
      const tripRng = ctx.rng('streetlife:trip');
      const dwellRng = ctx.rng('streetlife:dwell');
      arrivalClock += dt;
      while (arrivalClock >= 1) {
        arrivalClock -= 1;
        arrivalBucket = (arrivalBucket + 1) % ARRIVAL_BUCKETS;
        arrivalBuckets[arrivalBucket] = 0;
      }

      pedCounts.clear();
      for (let i = 0; i < agents.length; i++) {
        const a = agents[i];
        /**
         * Posed: nobody walks, and the subject's phase is whatever was pinned.
         * `uPrev` and `ampPrev` are pinned to the same values rather than left
         * to lag, so the limb term of the motion vector is exactly zero — which
         * is the truth about a figure that did not move between two frames, and
         * keeps TAA from smearing the very edges the strip is read on.
         */
        if (posed) {
          if (a === posed.agent) {
            a.gaitU = posed.u;
            a.gaitUPrev = posed.u;
            a.gaitAmp = posed.amp;
            a.gaitAmpPrev = posed.amp;
          }
          continue;
        }
        if (a.dwell > 0) {
          a.dwell -= dt;
          if (a.dwell <= 0) planTrip(ctx, a, tripRng);
        } else {
          const step = a.speed * dt;
          if (step >= a.remaining) {
            const advanced = Math.max(0, a.remaining);
            a.p += a.dir * advanced;
            a.pathLength += advanced;
            a.remaining = 0;
            arrivalBuckets[arrivalBucket]++;
            a.dwell = Math.min(DWELL_MAX_S, DWELL_MIN_S + -Math.log(1 - dwellRng.next()) * DWELL_SCALE_S);
            /**
             * Turn toward whatever was walked to. A shopfront and a stall are
             * inland, a corner is whichever way the person happened to be
             * looking. Two lines, and without them a queue at a food stand is
             * a line of people facing along the pavement.
             */
            loopPoint(a.cx, a.cz, a.p, a.spread, scratchPoint);
            a.dwellYaw =
              a.destKind === 'corner'
                ? Math.atan2(a.dir * scratchPoint.hx, a.dir * scratchPoint.hz) + dwellRng.range(-1.2, 1.2)
                : Math.atan2(-scratchPoint.ox, -scratchPoint.oz);
          } else {
            a.p += a.dir * step;
            a.remaining -= step;
            a.pathLength += step;
            // Wrapped at the CYCLE and not at the step: the bob repeats every
            // step but the legs only repeat every second one, so a phase
            // wrapped at 0.75 m cannot say which leg is forward. An unwrapped
            // phase is a float that grows for as long as the page is open;
            // `pathLength` is allowed to grow because it is a difference that
            // is taken, not an angle that is evaluated.
            a.gaitPhase = (a.gaitPhase + step) % GAIT_CYCLE_M;
          }
        }
        /**
         * The gait state, advanced once per agent per frame whatever else
         * happened to it. `gaitU` is the cycle parameter the shader reads and
         * `gaitUPrev` is what it read last frame — the pair is what lets the
         * motion vector carry a swinging limb instead of only a moving person.
         *
         * `amp` fades rather than switches. Dropping it to 0 on the frame
         * somebody stops leaves the legs snapping shut in one frame, which is
         * a pop; over `GAIT.dwellFadeS` it is somebody slowing to a halt.
         */
        a.gaitUPrev = a.gaitU;
        a.gaitAmpPrev = a.gaitAmp;
        a.gaitU = a.gaitPhase / GAIT_CYCLE_M;
        const wantAmp = a.dwell > 0 ? 0 : 1;
        const fade = dt / GAIT.dwellFadeS;
        a.gaitAmp = wantAmp > a.gaitAmp
          ? Math.min(wantAmp, a.gaitAmp + fade)
          : Math.max(wantAmp, a.gaitAmp - fade);
        updateAgentPosition(a, ctx);
        const key = chunkKey(a.cx, a.cz);
        pedCounts.set(key, (pedCounts.get(key) || 0) + 1);
        if (a.reseated) reseatsThisFrame++;
      }
      reseatsTotal += reseatsThisFrame;

      // --- straightness history ------------------------------------------
      historyClock += dt;
      if (historyClock >= STRAIGHTNESS_SAMPLE_S) {
        historyClock -= STRAIGHTNESS_SAMPLE_S;
        for (let i = 0; i < agents.length; i++) {
          const a = agents[i];
          const head = (historyHead[i] + 1) % STRAIGHTNESS_SLOTS;
          historyHead[i] = head;
          const base = (i * STRAIGHTNESS_SLOTS + head) * 3;
          history[base] = a.x;
          history[base + 1] = a.z;
          history[base + 2] = a.pathLength;
          if (historyFilled[i] < STRAIGHTNESS_SLOTS) historyFilled[i]++;
        }
      }

      // --- the census declarers -------------------------------------------
      for (const key of pedRingKeys) {
        let decl = pedDeclarers.get(key);
        if (!decl) {
          /**
           * A bare Object3D, not an InstancedMesh, so it needs no
           * `noctisCensus` label and draws nothing. Every chunk in the ring
           * declares INCLUDING count 0: `harness.pedestrianCensus` builds its
           * map only from declaring objects, so a silent empty chunk does not
           * appear at all, the mean is taken over occupied chunks only, the CV
           * collapses toward the within-occupied spread and `populated` goes
           * to 1.0 for free. Both bounds would then have been passed by the
           * shape of the reporting rather than by the crowd.
           */
          decl = new THREE.Object3D();
          decl.name = `streetlife:pedestrians:${key}`;
          decl.matrixAutoUpdate = false;
          decl.visible = false;
          pedDeclarers.set(key, decl);
          root.add(decl);
        }
        decl.userData.noctisPedestrians = { chunkKey: key, count: pedCounts.get(key) || 0 };
      }
      for (const [key, decl] of pedDeclarers) {
        if (pedRingKeys.includes(key)) continue;
        root.remove(decl);
        pedDeclarers.delete(key);
      }

      // --- motion vectors --------------------------------------------------
      motionCutoffM = motionCutoffDistance(
        PED_MIN_EXTENT_M,
        MOTION_MIN_EXTENT_PX,
        pixelAngle(camera, internalHeightOf(ctx))
      );
      const cutoff2 = motionCutoffM * motionCutoffM;

      /**
       * The order below is the CONTRACT §5.12 invariant and not a habit:
       * begin -> fill -> carry -> commit -> bind current() as instanceMatrix
       * and read() as the geometry's noctisPrevInstanceMatrix. `read` throws
       * if handed the buffer written this frame, which is the one failure
       * whose symptom — every motion vector exactly zero — is identical to
       * not having built any of this.
       */
      for (const b of bodies) {
        if (!b.motion) continue;
        writeMatrices(b, b.motion.begin(frame));
        for (let sIx = 0; sIx < b.indices.length; sIx++) {
          const a = agents[b.indices[sIx]];
          const dx = a.x - camera.position.x;
          const dz = a.z - camera.position.z;
          const dy = camera.position.y - a.height * 0.5;
          const d2 = dx * dx + dz * dz + dy * dy;
          if (a.reseated) {
            b.motion.carry(sIx);
          } else if (d2 > cutoff2) {
            b.motion.carry(sIx);
            suppressedByThreshold++;
          }
        }
        b.motion.commit();
        b.frameMesh.instanceMatrix = b.motion.current();
        const prev = b.motion.read(frame);
        b.frameGeo.setAttribute('noctisPrevInstanceMatrix', prev);

        /**
         * The gait, AFTER the carries above and reading the same rule. An
         * instance whose transform was carried — re-seated, or past the motion
         * cutoff — must carry its gait too, or the limb term would write a
         * motion vector for a person whose body term says they did not move.
         * That is not a cosmetic mismatch: §5.12's whole guarantee is that the
         * two halves of a displacement are computed from one description.
         */
        writeGait(b, b.gaitArray);
        for (let sIx = 0; sIx < b.indices.length; sIx++) {
          const a = agents[b.indices[sIx]];
          const dx = a.x - camera.position.x;
          const dz = a.z - camera.position.z;
          const dy = camera.position.y - a.height * 0.5;
          if (a.reseated || dx * dx + dz * dz + dy * dy > cutoff2) {
            b.gaitArray[sIx * 4 + 1] = b.gaitArray[sIx * 4];
            b.gaitArray[sIx * 4 + 3] = b.gaitArray[sIx * 4 + 2];
          }
        }
        b.gaitAttr.needsUpdate = true;
      }

      for (let i = 0; i < agents.length; i++) agents[i].reseated = false;
    },

    dispose(ctx) {
      for (const key of [...stallChunks.keys()]) unbuildStallChunk(key);
      for (const [, decl] of pedDeclarers) root.remove(decl);
      pedDeclarers.clear();
      for (const b of bodies) {
        if (b.frameMesh) {
          root.remove(b.frameMesh);
          if (b.frameMesh.instanceColor) b.frameMesh.instanceColor.array = null;
          b.frameMesh.dispose();
        }
        if (b.motion) b.motion.dispose();
        b.frameMesh = null;
        b.motion = null;
      }
      bodies.length = 0;
      agents.length = 0;
      ctx.scene.remove(root);
      const lights = ctx.get('lights');
      if (lights) for (const slot of stallLightPool) lights.remove(slot);
      stallLightPool.length = 0;
      for (const d of disposables) if (d && d.dispose) d.dispose();
      disposables.length = 0;
      localChunks.clear();
      groundBlockers.clear();
      destinations.clear();
      pedCounts.clear();
      pedRingKeys = [];
      materials = null;
      stallGeometries = null;
      glowGeometry = null;
      cityApi = null;
      lightsApi = null;
      history = null;
      historyHead = null;
      historyFilled = null;
    },
  };
}
