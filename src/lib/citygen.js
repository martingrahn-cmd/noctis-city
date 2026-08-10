/**
 * citygen.js — the city, as decisions. Pure: a seed and a chunk coordinate in,
 * a description out. No three.js, no state, no ctx.
 *
 * WHY PURE, AND WHY PER-CHUNK DETERMINISTIC
 *
 * Two consumers have to agree exactly on what is in a chunk: the main thread,
 * which builds its geometry, and the worker, which bakes its canyon field from
 * the occluders of a nine-chunk neighbourhood. If generation depended on order,
 * on how many chunks had been made before, or on a shared generator, those two
 * would disagree and the disagreement would show up as indirect light that does
 * not match the building casting it — a bug with no stack trace.
 *
 * So every chunk is seeded from `(rootSeed, cx, cz, stream)` alone. Chunk
 * (4, −2) is the same city whether it is the first chunk generated or the four
 * hundredth, whether it is generated on the main thread or in a worker, and
 * whether or not its neighbours exist. That is what makes streaming possible at
 * all; everything else here is content.
 *
 * WHAT THE SETTING IS
 *
 * Roughly 2049, and architecturally continuous with the present: the same brick,
 * panel, stucco and concrete, the same restrained palette. That is a resource
 * decision before it is a taste one. A cyberpunk street is paid for in content
 * volume — hundreds of unique signs, decals, cable runs — which is the resource
 * this project has least of. Physically grounded light is what it has most of,
 * and a present-day palette is what lets that light read.
 *
 * What the setting buys, in descending order of value per unit of work, is in
 * `LANDMARKS` below: six to ten structures the generator cannot produce.
 */

import { hashString, mulberry32, rngHelpers, weightedIndex } from './rng.js';

/**
 * The streaming city — session 4. CONTRACT §11.
 *
 * Every number here is a memory or a time budget, and the arithmetic behind each
 * one is written beside it. The ceiling that matters is `memoryBudgetMB`: an
 * unbounded chunk cache is the same class of mistake as an unbounded particle
 * layer, and the answer is the same — count the bytes, cap them, evict.
 */
export const CITY = {
  /**
   * Metres. A real downtown block, and the size at which a chunk's canyon field
   * bakes in about 200 ms — comfortably inside a worker even at 24 m/s, where a
   * chunk crosses the horizon every five seconds.
   *
   * It also lands the roads on the chunk boundaries, which is what makes a chunk
   * self-contained: a building never straddles two chunks, so nothing has to be
   * generated twice or stitched.
   */
  chunkSize: 128,
  /** Metres, from the centreline. Matches BLOCK.streetWidth so the origin block's street continues. */
  roadHalfWidth: 7.5,
  sidewalkWidth: 4.2,

  /**
   * Metres from a junction's centre to the STOP LINE — session 19, item 7, and
   * it is here rather than in `traffic.js` because it has three consumers and
   * they must not be able to disagree.
   *
   * THE ONE QUANTITY, AND THE THREE THINGS THAT READ IT:
   *
   *   1. what a vehicle brakes to      `traffic.js`, the signal hold
   *   2. where the signal head stands  `traffic.js`, `signalApproaches`
   *   3. where the line is PAINTED     `city.js`, `buildGround`'s markings
   *
   * The brief's requirement is that the painted line and the traffic's stopping
   * point are one number and not two, and (3) is the consumer that did not exist
   * until this session — there were no markings anywhere in the project. Putting
   * the number in `traffic.js` and reading it from `city.js` is impossible
   * (CONTRACT §2.2: modules never import each other) and copying it is exactly
   * the arrangement §9.1 is a list of. It lives in the lib both already import.
   *
   * 9.0 m = `roadHalfWidth` + 1.5. The 1.5 m setback is the gap between the stop
   * line and the near edge of the crossing carriageway: enough for a crossing
   * vehicle's overhang to swing through and enough for a pedestrian crossing to
   * be laid in front of it, which is what the 1.5 m band is for.
   *
   * IT WAS ALREADY THIS NUMBER AND THE VEHICLES STILL STOPPED PAST IT, which is
   * the part worth reading: `toStop` measured this distance to the vehicle's
   * ORIGIN — its body centre — and used it as the distance to its NOSE. See
   * `traffic.js`. A shared constant would not have caught that; only the front
   * overhang does.
   */
  stopLineFromJunctionM: 7.5 + 1.5,

  /**
   * Chebyshev radius, in chunks, of each residency ring.
   *
   *   detail    full geometry: facades, windows, signage, street furniture, lights
   *   geometry  massing only — the building boxes and the road. Silhouette and
   *             occlusion, which is all a building 500 m away contributes.
   *   field     a baked canyon field. Beyond it the analytic default (§11), which
   *             is what an unarrived chunk also renders with.
   *
   * The field radius is the smallest of the three on purpose. Indirect light is a
   * low-frequency term on surfaces near the camera; at 400 m a facade is a few
   * pixels wide and the difference between a baked field and the analytic
   * profile is below a quantisation step. Making it the largest ring would spend
   * the entire memory budget on the least visible term.
   */
  detailRadius: 4,
  geometryRadius: 5,
  fieldRadius: 2,
  /**
   * Chunks whose ROAD SURFACE is drawn — the carriageway, the pavement and, on
   * a park block, the grass. Two rings rather than four, because a road at
   * 400 m is a slightly darker strip on a dark plane and it was costing a draw
   * call a chunk across a hundred and twenty of them.
   *
   * It is here, beside the other three radii, because `city.js` needs it in TWO
   * places — once to decide what to build and once to decide whether what was
   * built is still right — and a threshold that lived in only the first of
   * those is why the city had no roads. See `city.js` → `update()`.
   */
  nearRadius: 2,

  /**
   * The canyon field, per chunk.
   *
   * THE FACTOR OF TWO THAT DECIDED THESE NUMBERS. three's `DataArrayTexture`
   * uploads a changed layer with `texSubImage3D` out of `image.data`, so the
   * full array has to stay resident on the CPU for the lifetime of the texture.
   * A slot therefore costs its bytes *twice* — once in the array texture and
   * once in the mirror three uploads from — and sizing this against the GPU
   * figure alone would have put the real number at double the sub-cap while
   * every line of accounting said it was fine. Exactly the failure mode in
   * CONTRACT §9: one quantity used as though it were another.
   *
   * So: 56 × 56 × 28 at RGBA8 × 2 arrays = 0.670 MB per chunk, 1.34 MB counting
   * the mirror. 30 slots is 40.2 MB against a 48 MB sub-cap. The horizontal
   * spacing that falls out is 156/55 = 2.84 m against the origin block's 1.6 m,
   * on a term that is a visibility integral and therefore smooth, in a ring the
   * camera is never standing in.
   *
   * The resident window (fieldRadius 2 → 5×5 = 25 chunks) leaves 5 slots of
   * hysteresis, so walking back and forth across a boundary does not thrash the
   * bake queue. The pool is preallocated, so the field's memory is bounded by
   * construction rather than by a policy that could have a bug in it.
   */
  fieldRes: 56,
  fieldSlices: 28,
  fieldSlots: 30,
  fieldHeight: 96,
  /** Metres of occluder context marched beyond the chunk's own square. */
  fieldMargin: 14,

  /**
   * Layers of one chunk's field uploaded per frame, PER ARRAY. Session 10.
   *
   * **ZERO — THE DRIP IS BUILT, MEASURED AND OFF.** The reason is at the
   * bottom of this comment, under WHAT THE MEASUREMENT SAID; the rest is the
   * design it rejected, kept because the next session should not have to
   * rediscover either half. `?fieldDrip=N` turns it on, which is what the A/B
   * arms and the ANGLE repro use.
   *
   * WHAT THIS NUMBER IS FOR. Session 9d measured a conserved driver stall of
   * essentially one slow upload call per frame — total slow>1 ms upload calls
   * per arm equalled recorded frames + 0–7 on all 24 arms of both routes,
   * while the composition of which calls caught it swung 2.7×. The stall
   * cannot be removed; it can only be aimed at a cheap call instead of an
   * expensive one. A bake that flags all `fieldSlices` layers of both arrays
   * at once asks one frame for 2 × 28 = 56 `texSubImage3D` calls, and the
   * catch on that burst measured ~9.2 ms against ~0.01–0.04 ms on the fast
   * path. Dripping the same 56 calls over several frames makes the burst
   * small enough that the conserved catch lands on a cheap call.
   *
   * WHY 4. Two bounds, from opposite directions, and the number is between
   * them:
   *
   * - ABOVE, by the pop. The slot table's entry flips when the LAST layer
   *   lands, so a chunk's default→baked transition moves ceil(28/N) frames
   *   later than it used to be. At N = 4 that is 7 frames — 0.117 s at 60 fps
   *   — against 0.467 s at N = 1. The pop already happens at an uncontrolled
   *   bake-latency moment; this shifts its timing and changes no settled
   *   frame, and the shift is small enough to be looked at rather than argued
   *   about. Measured in frame at 10 m and at 40 m, both routes.
   * - BELOW, by the burst it exists to break up. 2N calls a frame at N = 4 is
   *   8 calls and 98 KiB, against the 56 calls and 686 KiB the burst asked
   *   for. Session 9d measured s8 catching the same conserved stall on its
   *   steady lanes — 528 KB a frame in 17 `bufferSubData` calls — as 1–3 ms
   *   rather than 9 ms, so a per-frame upload of this size is known to be in
   *   the cheap class on this driver rather than assumed to be.
   *
   * WHAT THE FIRST DRAFT OF THIS DERIVATION GOT WRONG, kept because the
   * correction is the useful half. It bounded N from below by the bake
   * cadence — `night_rain`'s upload-frame gap has median 19–20 frames, so
   * ceil(28/N) < 19 gives N ≥ 2 and "drips never overlap". They overlap
   * constantly: the drain budget is GLOBAL rather than per chunk, so a cold
   * start's 25 near-simultaneous bakes queue behind one another and
   * `streamStats().maxConcurrentDrips` measured **8**, not 1. The per-frame
   * call count is still exactly 2N — that is what the global budget buys and
   * it is the quantity the stall cares about — and the backlog is paid in
   * arrival latency instead. The gap median was a fact about the STEADY
   * route and it was used as a fact about every regime, which is CONTRACT §9
   * with a cadence instead of a length.
   *
   * The total is unchanged: 52 bakes × 28 layers × 2 arrays = 2 912 calls
   * either way, which is 1.21 calls per frame averaged over the route's 2 402
   * frames. This constant decides how they are grouped, not how many there
   * are.
   *
   * WHAT THE MEASUREMENT SAID, and it is why this is 0. Three interleaved
   * counted A/Bs, `loftprobe --aparams=fieldDrip=N --bparams=fieldDrip=0
   * --glprof`, logs beside the s9 artefacts:
   *
   * - **The schedule changed exactly as designed.** `night_rain` upload frames
   *   52 → 364, gap median 20 → 1, with call counts and bytes unchanged
   *   (2 856–3 024 either way, the wobble being arm length). The mechanism is
   *   not in doubt.
   * - **It does not move the quantity the ceiling is compared against.**
   *   `night_rain` wall p95, paired over SIX arms a side across two runs:
   *   **+0.05 ms, SE 0.18** — unresolved, and the two runs disagree in sign
   *   (−0.133 ± 0.273 then +0.233 ± 0.233). The route is red at p95 and this
   *   does not touch p95.
   * - **It costs the other route.** `downtown_dense` at N = 4: **+0.733 ms,
   *   SE 0.273, 3/3 pairs positive**, with the array lane's slow calls
   *   tripling (22/29/20 → 62/57/76) and runs of 14, 28 and 69 CONSECUTIVE
   *   frames past 14.5 ms where the burst arm runs 0, 1 and 5. That last is
   *   the mechanism rather than a statistic: dripping puts the upload on
   *   hundreds of consecutive frames, so a tax that was paid by 28 scattered
   *   frames is paid by 245 adjacent ones, and adjacent long frames are a
   *   stutter where scattered ones are not.
   * - **N = 14 removes the cost by removing the effect.** Array-lane slow
   *   calls come back to parity (24/29/27 against 22/29) because there are
   *   only 58–72 upload frames again. The trade is monotone in N; there is no
   *   sweet spot to find.
   * - **What it does buy is p99, not p95.** `night_rain` frames past 14.5 ms:
   *   drip {30 34 28 31 45 38} against burst {53 46 47 47 71 55} — complete
   *   separation over six arms a side and two runs, and p99 lower on 6/6.
   *   Real, and not what the gate measures, and bought at downtown's expense.
   *
   * So the stall is CONSERVED against this too: total slow upload calls per
   * arm equalled recorded frames + 0–5 in all eighteen arms of both schedules,
   * and total time inside uploads matched to within drift (20 211 against
   * 20 151 ms). Aiming the stall is not the same as paying less for it, and
   * this is the arithmetic that says so.
   *
   * Every number above was measured with the observer running (CONTRACT §0's
   * bar failed) and with `--glprof`'s per-call overhead in the absolutes. The
   * counts are integers and immune; shared load adds far frames to BOTH pools
   * and dilutes a true ratio toward 1, so the separations are floors.
   */
  fieldLayersPerFrame: 0,

  /**
   * Toroidal addressing for the slot lookup. The resident window is at most
   * 2·geometryRadius+1 = 13 chunks across, so a 16×16 wrap is unambiguous: two
   * chunks that map to the same cell can never both be resident.
   */
  slotGrid: 16,

  /**
   * MB. The ceiling on everything the streaming system holds — canyon field
   * slots plus per-chunk instance buffers plus per-chunk unique geometry.
   *
   * Planned residency: 40.2 MB of field (above, mirror included) + about 22 MB
   * of geometry (a 7×7 detail ring at ~4 000 instances × 96 B, plus 120
   * massing-only chunks at ~24 KB) ≈ 62 MB, so the ceiling bites at 1.5× the
   * plan. That is the right place for it: a residency window that grew by half
   * is a tuning change and a cache that never evicts is a bug, and only the
   * second one should trip it.
   */
  memoryBudgetMB: 96,
  /** Sub-cap, so the field cannot quietly eat the whole budget. */
  fieldBudgetMB: 48,

  /**
   * Chunks whose content is generated on the main thread per frame. Generation
   * is arithmetic over a few dozen buildings and measures well under a
   * millisecond, but "well under a millisecond" times forty chunks arriving at
   * once is a visible hitch. One per frame is 128 m of new city every sixtieth
   * of a second, which outruns anything on foot.
   */
  generateBudget: 2,
  /** Bakes in flight at once. One worker; this is its queue depth. */
  bakeConcurrency: 1,

  /**
   * Low-frequency density noise. Periods in metres.
   *
   * docs/authored-city.md §1: generate density from noise, then place within it,
   * never place on a grid with jitter. The long period is what makes five
   * restaurants land on one block and none on the next three; the short one
   * breaks up the long one's contours so the boundaries are not smooth curves.
   */
  densityPeriodLong: 720,
  densityPeriodShort: 190,
  /** Below this the chunk is a dead zone — parking, lot, yard, park. §5. */
  lowDetailThreshold: 0.34,

  /**
   * Maximum yaw deviation from the lot line, degrees. §3: the amounts are small.
   * A degree here, ten centimetres there. Large randomness looks broken.
   */
  maxYawDeg: 2.4,
  /** Fraction of placed objects that get a deviation at all. */
  offAxisFraction: 0.78,
};


/** Deterministic stream for one chunk. Order-independent by construction. */
export function chunkRng(rootSeed, cx, cz, stream) {
  const seed = (hashString(`${rootSeed}:${cx}:${cz}:${stream}`) ^ 0x9e3779b9) >>> 0;
  return rngHelpers(mulberry32(seed));
}

export function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

/** World-space bounds of a chunk's square. */
export function chunkBounds(cx, cz) {
  const s = CITY.chunkSize;
  return { x0: cx * s, x1: (cx + 1) * s, z0: cz * s, z1: (cz + 1) * s };
}

// ---------------------------------------------------------------------------
// density — docs/authored-city.md §1
//
// Value noise on a lattice, two octaves, long period first. NOT a grid with
// jitter: the number of things in a chunk is read off a smooth field, so
// neighbouring chunks are correlated and distant ones are not, which is what
// produces a run of dense blocks and then three empty ones. Jitter reads as
// noise; clustering reads as intent.

function latticeValue(rootSeed, ix, iz, salt) {
  // A hash rather than a stored table: the field is unbounded and a table would
  // have to be either huge or wrapped, and a wrapped one repeats visibly at the
  // scale a player walks.
  const h = hashString(`${rootSeed}:d${salt}:${ix}:${iz}`);
  return (h >>> 8) / 16777216;
}

function smoothNoise(rootSeed, x, z, period, salt) {
  const u = x / period;
  const v = z / period;
  const ix = Math.floor(u);
  const iz = Math.floor(v);
  const fx = u - ix;
  const fz = v - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = latticeValue(rootSeed, ix, iz, salt);
  const b = latticeValue(rootSeed, ix + 1, iz, salt);
  const c = latticeValue(rootSeed, ix, iz + 1, salt);
  const d = latticeValue(rootSeed, ix + 1, iz + 1, salt);
  return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
}

/**
 * Density in [0,1] at a world point. The long octave carries two thirds of the
 * amplitude, so the structure a player reads while walking is the 720 m one and
 * the 190 m octave only breaks up its contours — a single octave gives density
 * bands with smooth curved edges, which is its own kind of tell.
 */
export function densityAt(rootSeed, x, z) {
  const a = smoothNoise(rootSeed, x, z, CITY.densityPeriodLong, 0);
  const b = smoothNoise(rootSeed, x, z, CITY.densityPeriodShort, 1);
  return Math.max(0, Math.min(1, a * 0.68 + b * 0.32));
}

// ---------------------------------------------------------------------------
// eras — docs/authored-city.md §2
//
// The four from session 3's block, plus one the block does not have. Each is a
// fixed floor height with a small jitter rather than a range: buildings of one
// period really do share a floor height, because they shared a building code and
// a beam depth, and four spaced values read as four periods where four
// overlapping ranges read as noise.

export const CITY_ERAS = {
  prewar: { floor: 4.3, rhythm: 'grid', windowWall: 0.11, ground: 'shopfront', cornice: 0.9, weight: 1.0 },
  postwar: { floor: 3.05, rhythm: 'band', windowWall: 0.45, ground: 'blankPlinth', cornice: 0.08, weight: 1.2 },
  corporate: { floor: 3.85, rhythm: 'vertical', windowWall: 0.32, ground: 'colonnade', cornice: 0.55, weight: 1.0 },
  infill: { floor: 3.45, rhythm: 'irregular', windowWall: 0.19, ground: 'recessed', cornice: 0.28, weight: 0.9 },
  /**
   * The 2030s–40s, and the only era in the project that is not present-day.
   *
   * It differs in FORM, not in era-of-material: cantilevered upper floors, a
   * chamfered or stepped crown, a taller ground floor. That is the whole of the
   * science fiction in the generator, and it is deliberately a minority — a
   * handful of visibly newer buildings among ordinary ones reads as a city that
   * has been added to, where a city entirely of them reads as a render.
   */
  contemporary: { floor: 3.6, rhythm: 'panel', windowWall: 0.58, ground: 'recessed', cornice: 0.0, weight: 0.42 },
};

export const ERA_NAMES = Object.keys(CITY_ERAS);

/**
 * Facade materials, as linear reflectances. Measurements, not colours — see
 * block.js, which authors the same four for the same reason. `display` is not a
 * material: it is the minority case where a facade has been given over to
 * advertising and the wall is a screen.
 */
export const CITY_MATERIALS = {
  brick: { albedo: [0.164, 0.086, 0.062], roughness: 0.9 },
  concrete: { albedo: [0.4, 0.395, 0.378], roughness: 0.76 },
  panel: { albedo: [0.556, 0.573, 0.6], roughness: 0.36 },
  stucco: { albedo: [0.49, 0.452, 0.39], roughness: 0.58 },
};

export const MATERIAL_NAMES = Object.keys(CITY_MATERIALS);

/** Condition drives soiling, dead signage and boarded shopfronts. §2. */
export const CONDITIONS = ['kept', 'worn', 'neglected'];

export const ROAD_MATERIALS = ['asphalt', 'patched', 'concrete'];

// ---------------------------------------------------------------------------
// dead zones — docs/authored-city.md §5

export const LOW_DETAIL_KINDS = ['parking', 'lot', 'yard', 'park'];

// ---------------------------------------------------------------------------
// landmarks — docs/authored-city.md §6
//
// Hand-placed, and every one of them is something the generator cannot produce:
// the generator makes rectangular masses on lot lines between 12 and 64 m tall,
// and none of these is that. `outsideGeneratorRange` is not a label, it is
// checked — citycheck asserts it and `generatorCanProduce()` below is what the
// assertion is made of.
//
// This is where the science fiction lives. One genuinely strange structure on
// the horizon does more for a setting than a thousand neon signs, and it is also
// what makes the city navigable: a city you can orient yourself in feels
// designed, and a city where every direction looks equally plausible feels
// generated no matter how good the individual assets are.

export const LANDMARKS = [
  {
    name: 'condenser',
    kind: 'hyperboloid',
    /**
     * 260 m district heat-rejection tower — the one genuinely strange thing on
     * the horizon, and the thing you navigate by from anywhere in the city. A
     * hyperboloid of revolution in board-marked concrete with an open lattice
     * crown: entirely plausible 2049 infrastructure, entirely unlike anything
     * around it, and legible in silhouette from 2 km.
     */
    x: -430, z: -560, height: 260,
    radiusBase: 62, radiusWaist: 34, radiusTop: 46,
    material: 'concrete',
  },
  {
    name: 'stack',
    kind: 'ziggurat',
    /** Mass-timber stepped residential terrace, 132 m, planted setbacks. */
    x: 300, z: -300, height: 132,
    footprint: [78, 78], steps: 7, setback: 4.4,
    material: 'stucco',
  },
  {
    name: 'arch',
    kind: 'arch',
    /** A 96 m parabolic arch carrying the transit deck across the arterial. */
    x: -64, z: 190, height: 96, span: 118, thickness: 7.5,
    material: 'concrete',
  },
  {
    name: 'viaduct',
    kind: 'viaduct',
    /**
     * The elevated rail curve the addendum asks for by name: a 480 m arc on
     * piers at 21 m. It breaks the grid because it is the only thing in the
     * city that is not orthogonal to it.
     *
     * SESSION 5 RE-AIMED IT, AND THE REASON IS THE ONLY REASON THAT MATTERS
     * FOR A BRIDGE: ITS PIERS HAVE TO STAND ON GROUND YOU CAN SEE.
     *
     * Session 4 ran the arc diagonally across the origin block. The piers were
     * in the geometry and they were the right length — and not one of them was
     * visible, because a diagonal crossing of a 182 m block with buildings 12 to
     * 26 m deep on both sides of a 23 m street puts every pier either inside a
     * building or behind one. Projected through the gate camera, the deck swept
     * from (0.00, 0.47) to (0.71, 0.10) of the frame with piers at (2, 6) — the
     * intersection — and at (−23, 29) and (30, −14), the last two inside block
     * buildings 30 to 74 m tall. So the frames showed three white slabs and
     * nothing holding them up. That is not a lighting defect and no amount of
     * soffit would have fixed it.
     *
     * A diagonal cannot be fixed by translating it. The street corridor is
     * 23.4 m kerb to kerb, so a curve crossing it at 40° spends 36 m inside it,
     * and at a 34 m pier spacing that is room for exactly one pier; the rest
     * land in the building bands whatever the offset.
     *
     * ALONG THE STREET WAS TRIED FIRST, AND MEASURED, AND REJECTED. R was taken
     * to 700 m — the sagitta arithmetic works: a run of arc staying within h of
     * its tangent is 2·√(2Rh), which is 129 m at R = 300 and 197 m at R = 700,
     * and the block is 182 m long, so only 700 clears it inside a corridor that
     * leaves a 9.5 m deck 6.95 m of centreline freedom. Every pier landed on the
     * carriageway and the street got its vertical rhythm. It was also wrong, and
     * the frames said so in numbers:
     *
     *     mean       noon 0.4335 → 0.4157 (band floor 0.428)
     *                dawn 0.3008 → 0.2980 (floor 0.299)
     *                dusk 0.1400 → 0.1214 (floor 0.140)
     *     stddev     dusk 0.1268 → 0.1028 (floor 0.128)
     *     emitters   midnight 69 → 51 clusters (floor 60)
     *
     * Five assertions that had been green, and the picture said why: a deck
     * running along the view axis terminates the vista, and this camera's
     * subject IS the vista — the sunset down the street that the whole look was
     * built around. A pier 70 m ahead stood on the vanishing point.
     *
     * So it crosses the street instead of running down it, and it crosses on the
     * one axis where its piers stand on open ground: the cross street. The block
     * leaves x ∈ [−10.5, 10.5] clear at every z, so an arc through it needs only
     * 1.2 m of sagitta over the block's own depth — R can go back to the
     * authored 300 m. `pierEvery` is 22 m rather than 34 so that a pier lands on
     * each kerb of the main street at z = ±11 instead of one landing in the
     * middle of it: from the gate camera those two are at 0.41 and 0.60 of the
     * frame width and the vista between them is untouched. 22 m is also an
     * ordinary spacing for an elevated railway, and more piers is more of the
     * rhythm the deck is there to provide.
     *
     * `x, z` is a point ON THE DECK — the crown of the curve — and not the
     * centre of the circle. citycheck's visibility test casts a ray at
     * (x, z, height), and a circle centre is 300 m from any part of the
     * structure.
     */
    x: 0, z: 11, height: 21,
    /** Metres. The session 4 figure, restored — see the sagitta note above. */
    arcRadius: 300,
    /** Metres of deck. The addendum's number, unchanged. */
    arcLength: 480,
    /**
     * Bearing of the deck at the crown, degrees, as atan2(dz, dx). 90° is due
     * south, square across the main street and along the cross street
     * (CONTRACT §3.1).
     */
    headingDeg: 90,
    /** +1 bends the arc toward −X (west) at both ends, away from the camera. */
    curveSign: 1,
    deck: 9.5,
    /** Metres between piers. Read as metres — see `viaductArc`. */
    pierEvery: 22,
    material: 'concrete',
  },
  {
    name: 'exchange',
    kind: 'dome',
    /** A preserved 1890s exchange hall: low, wide, domed, out of period with everything around it. */
    x: 120, z: -110, height: 46, radius: 33, drum: 22,
    material: 'brick',
  },
  {
    name: 'weir',
    kind: 'basin',
    /**
     * A stormwater basin and sunken park, 210 m across and 9 m below grade.
     * A landmark made of absence — negative space at the scale of a district,
     * which is the thing that makes the density around it feel dense.
     */
    x: -300, z: 150, height: 6, radius: 105, depth: 9,
    material: 'concrete',
  },
  {
    name: 'mast',
    kind: 'mast',
    /** 186 m guyed lattice mast with a beacon. Thin, so it reads at distance only as a line — which is what a mast is. */
    x: 470, z: 430, height: 186, baseWidth: 9,
    material: 'steel',
  },
  {
    name: 'dish',
    kind: 'cone',
    /** A 58 m inverted-cone civic hall, matte, no windows at all. */
    x: -150, z: -160, height: 58, radiusTop: 44, radiusBase: 13,
    material: 'concrete',
  },
];

// ---------------------------------------------------------------------------
// the river — session 15
//
// AUTHORED, LIKE A LANDMARK, AND FOR THE SAME REASON. The generator makes
// rectangular masses on lot lines; it does not make a river, and a river read
// off the density field would be a different river in every seed, which means
// the bridges, the quays and the walkability mask would all have to be derived
// at run time from something nobody can look at. LANDMARKS is the precedent and
// this sits beside it: one description, consulted by the pure generator, by the
// worker's bake, by the geometry, and by the gate.
//
// WHY IT IS IN THIS FILE AND NOT IN A MODULE OF ITS OWN. The river's first job
// is to take buildings away, and building placement is `generateChunk`'s, which
// is pure and runs in the worker as well as on the main thread (§8.1). A river
// described anywhere else would be a river the bake does not know about, and the
// canyon field would describe a city with a hundred metres of masonry where the
// water is. The GEOMETRY is `src/modules/river.js`; the DECISION is here.
//
// WHERE IT RUNS, AND EVERY TERM OF THE ARITHMETIC.
//
// The river runs east–west, so its banks are functions of x. That is forced
// rather than chosen: the authored landmarks leave exactly one clear band across
// the map, and it runs the other way. Taking each landmark's own AABB (the union
// of the boxes the bake marches against, `landmarkAABB`) and projecting it onto
// z gives the intervals a river may not cross —
//
//     condenser [-610.8, -509.2]   stack   [-339.0, -261.0]   arch [182.5, 197.5]
//     viaduct   [-209.4,  231.4]   weir    [  45.0,  255.0]   mast [425.5, 434.5]
//     exchange  [-143.0,  -77.0]   dish    [-190.8, -129.2]   block [-46, 46]
//
// whose union leaves (-509.2, -339.0) as the widest gap anywhere on the map:
// **170.2 m**. Every other gap is under 100 m, and the same projection onto x
// leaves nothing wider than 126 m. So the river is east–west, centred in that
// gap at z = -424.1, and `riverEnvelope()` below is 147.6 m wide with 11.2 m
// clear of the condenser and 11.4 m clear of the stack. `citycheck` asserts the
// clearance rather than trusting this paragraph — CONTRACT §9.1's rule that
// anything placed procedurally is tested against the existing occupancy, with an
// authored placement instead of a scattered one.
//
// WHAT IT SEPARATES, WHICH IS THE POINT OF PUTTING IT THERE. The condenser —
// 260 m, "the thing you navigate by from anywhere in the city" — ends up on the
// far bank, alone. Every other landmark is on the near one. So the walkability
// flood fill has exactly one landmark it can only reach across a bridge, which
// is the assertion doing its job rather than a formality: delete the bridge
// decks from the mask and `citycheck` goes red on `condenser` and on nothing
// else.
//
// THE WIDTH IS DERIVED, NOT CHOSEN. A chunk's buildable island is
// `chunkSize - 2·CORRIDOR` = 128 - 23.4 = **104.6 m** — the width of the void a
// city block leaves between two facing streets, which is the one open dimension
// this world already has. The river's mean width is that number, so the water is
// exactly as wide as the space between two rows of buildings, and the reason the
// far bank reads as *across* rather than as *over there* is that it is the same
// distance as a street you already know.

export const RIVER = {
  /**
   * Metres. Mean centreline in z, the middle of the 170.2 m gap between the
   * condenser's AABB and the stack's.
   */
  z0: -424.1,
  /**
   * Mean half-width. `(CITY.chunkSize - 2·CORRIDOR) / 2` = 104.6 / 2 = 52.3 —
   * printed beside the number it comes from by `riverBudget()`.
   */
  halfWidth: 52.3,
  /**
   * The meander, as two octaves. Amplitudes in metres, periods in metres of x.
   *
   * SMALL, AND THE BOUND IS THE LANDMARKS RATHER THAN TASTE. The envelope is
   * `halfWidth + widthAmp + Σ amp` either side of `z0`, and it has to stay
   * inside a 170.2 m gap: 52.3 + 5.5 + 11.0 + 5.0 = 73.8, so the envelope is
   * 147.6 m and 22.6 m of the gap is left over as clearance. Anything larger
   * puts water through a cooling tower.
   *
   * Two octaves rather than one because a single sine is a wave and a river is
   * not periodic to the eye; the short octave's period is not a divisor of the
   * long one's (903 / 331 = 2.728), so the pair does not repeat inside any
   * distance a player covers.
   */
  meander: [
    { amp: 11.0, period: 903, phase: 0.0 },
    { amp: 5.0, period: 331, phase: 2.3 },
  ],
  /**
   * The width varies too, on its own octave. A river of constant width is a
   * canal, and the difference is visible from the bank: the far wall runs
   * parallel to the near one for a kilometre.
   *
   * 5.5 m is 10.5% of the half-width, which takes the delivered water from
   * 93.6 m to 115.6 m — a 1.24× spread, against the 1.0× a canal has.
   */
  widthAmp: 5.5,
  widthPeriod: 617,
  widthPhase: 1.1,
  /**
   * Metres below street grade. DERIVED, and the chain is three terms:
   *
   *   deck slab                                          0.85 m
   *   plate girder at the standard L/22 over a 38.2 m
   *     span (a 114.6 m channel in three spans)           1.74 m
   *   freeboard under the soffit: a workboat and the
   *     debris a design flood carries                     2.40 m
   *   ------------------------------------------------------------
   *   water surface below a deck at grade                 4.99 m
   *
   * So a bridge deck can sit at street level — which is what makes a bridge a
   * continuation of the street rather than a ramp — and the quay wall stands
   * 4.99 m out of the water, which is what an embanked urban river looks like.
   * `riverBudget()` prints the three terms and the sum.
   */
  depth: 4.99,
  /**
   * Metres. The quay wall's thickness, and the strip of it that stands proud of
   * the promenade as a parapet.
   */
  wallThickness: 1.3,
  parapet: 1.05,
  /**
   * Metres of clear promenade a building keeps back from the wall's outer face.
   * The pavement on an ordinary street is `CITY.sidewalkWidth` = 4.2 m and a
   * riverside walk is wider because it is a destination rather than a route;
   * 6.4 m is that plus the 2.2 m a bench and a rail need behind the parapet.
   */
  promenade: 6.4,
  /**
   * Metres between bridges. Four street grids — `4 · CITY.chunkSize` = 512 m.
   *
   * NOT EVERY STREET, AND THAT IS THE WHOLE OF THE WALKABILITY TEST. A bridge
   * at every chunk boundary is 128 m apart, which is a canal in Amsterdam and
   * which makes the flood fill's crossing free — every route across the water
   * would be within one block of every other. 512 m is the spacing of the
   * bridges on a real urban river (Westminster to Waterloo is 700 m, Pont Neuf
   * to Pont des Arts is 300 m), and it means a pedestrian on the wrong side of
   * the river walks up to 256 m along the bank before crossing. The streets in
   * between terminate at the quay, which is what `riverBlocks` and the road
   * clip in `city.js` deliver.
   */
  bridgeEvery: 4,
  /**
   * Metres between the stations the bank is sampled at, and it is a SHARED
   * lattice rather than a resolution each consumer picks for itself.
   *
   * Three meshes have an edge on this curve — the world's earth plane (cut to
   * let the water show), the water surface itself, and the quay wall — and if
   * any two of them sampled it at different x the join would be a crack the
   * width of the sampling error, running for kilometres along both banks. So
   * the stations are anchored to `x = i · bankStationM` for integer i and every
   * consumer walks the same list, `riverBankStations`.
   *
   * 16 m, and it is bounded by the bank's own curvature rather than chosen: the
   * sharpest the bank turns is `Σ amp·k² + widthAmp·k_w²` = 0.0029 m⁻¹, so a
   * 16 m chord departs from the true curve by a sagitta of
   * `0.0029 · 16² / 8` = **0.093 m**, which is under the 0.12 m the quay wall's
   * own coping overhangs. Halving it would double 500 stations to 1 000 and buy
   * 2 cm on a surface nobody stands closer than 5 m to.
   */
  bankStationM: 16,
};

/**
 * The three bridge structures, and the era each one belongs to.
 *
 * THIS IS THE ERA ARGUMENT ON AN OBJECT BIG ENOUGH FOR IT TO SHOW.
 * `CITY_ERAS` exists because buildings of one period share a floor height —
 * they shared a building code and a beam depth — and four spaced values read as
 * four periods where four overlapping ranges read as noise. A bridge is the
 * same statement with a hundred times the depth of field: the structural form a
 * city could build is a property of the decade it built in, and the three forms
 * below are not three styles of one bridge, they are three different answers to
 * "get a street across 110 m of water" separated by thirty years each.
 *
 * `aboveDeck` is the structure's own reach above its deck, in metres, and it is
 * the property `city-budget.json` → `river.minBridgeAboveDeckSpreadM` measures.
 * A count of three structures that are all flat decks is CONTRACT §7.2's exact
 * failure mode — `trafficLights.minBodyTypes: 4` passed at 5 on five flat-topped
 * boxes — so the count of kinds is paired with a measurement of the thing the
 * kinds were for, and for a bridge seen from half a kilometre that is the
 * silhouette above the deck line.
 */
export const BRIDGE_STRUCTURES = [
  {
    name: 'arch',
    era: 'prewar',
    /**
     * A steel bowstring through-arch, the oldest crossing on the river. It
     * clears the channel in one span because a pre-war city could not sink a
     * pier into a navigable river cheaply, and it carries its structure ABOVE
     * the deck for the same reason.
     */
    riverPiers: 0,
    /** Rise as a fraction of the clear span. 1/6 is the classic bowstring. */
    riseRatio: 1 / 6,
  },
  {
    name: 'girder',
    era: 'postwar',
    /**
     * A continuous steel plate girder on two river piers — three spans, all the
     * structure under the deck, nothing above it but a parapet. The cheap
     * post-war replacement, and the reason the three forms read apart at
     * distance: this one has no silhouette at all.
     */
    riverPiers: 2,
    riseRatio: 0,
  },
  {
    name: 'cable',
    era: 'contemporary',
    /**
     * A cable-stayed span on one tower per bank. The only one of the three that
     * could not have been built in 1930, and the tallest thing on the river by a
     * factor of two — which is what makes a bridge a landmark rather than a
     * crossing.
     *
     * Tower height above deck as a fraction of the clear span. 0.28 is the band
     * a fan-stayed tower lands in: the outermost stay wants to meet the deck at
     * 22–30° and tan(25°)·(span/2)/span = 0.233, plus the head above the top
     * anchorage.
     */
    riverPiers: 0,
    riseRatio: 0.28,
  },
];

const TAU = Math.PI * 2;

/** The centreline's z at a world x. */
export function riverCentreAt(x) {
  let z = RIVER.z0;
  for (const m of RIVER.meander) z += m.amp * Math.sin((TAU * x) / m.period + m.phase);
  return z;
}

/** The half-width at a world x. */
export function riverHalfAt(x) {
  return RIVER.halfWidth + RIVER.widthAmp * Math.sin((TAU * x) / RIVER.widthPeriod + RIVER.widthPhase);
}

/**
 * The two banks at a world x. `north` is the smaller z (CONTRACT §3.1: −Z is
 * north), `south` the larger.
 */
export function riverEdges(x) {
  const c = riverCentreAt(x);
  const h = riverHalfAt(x);
  return { north: c - h, south: c + h };
}

/**
 * The band of z the water can ever occupy, as a bound rather than a sample.
 *
 * Derived from the amplitudes rather than measured by walking x, because a
 * sampled bound is a bound only at the points it sampled — and this one is used
 * to cut a hole in the world's earth plane, where being wrong by a metre is a
 * strip of sky along the horizon.
 */
export function riverEnvelope() {
  let reach = RIVER.halfWidth + RIVER.widthAmp;
  for (const m of RIVER.meander) reach += m.amp;
  return { z0: RIVER.z0 - reach, z1: RIVER.z0 + reach, reach };
}

/** Is this point in the water? `pad` grows the water outward. */
export function inRiver(x, z, pad = 0) {
  const e = riverEdges(x);
  return z > e.north - pad && z < e.south + pad;
}

/**
 * What the river takes out of the buildable city: the water, both quay walls
 * and the promenade behind them.
 *
 * A SECOND PREDICATE, AND NOT A PAD ON THE FIRST, for the reason
 * `landmarkGroundBlockers` is a second list and not `landmarkOccluders` with a
 * margin: these two answer different questions and this project has shipped the
 * bug where one list answered both (CONTRACT §9 row 13). `inRiver` is where the
 * water surface is drawn and where a person cannot walk. This is where a
 * building may not stand, and it is wider by the wall plus the promenade —
 * about 7.7 m — because a building on the wall's own line has no pavement in
 * front of it and the wall has nothing to bear on.
 */
export function riverBlocks(x, z, pad = 0) {
  return inRiver(x, z, pad + RIVER.wallThickness + RIVER.promenade);
}

/**
 * The crossings, as street indices. A bridge stands where a north–south street
 * at `x = k · chunkSize` crosses the water and `k` is a multiple of
 * `bridgeEvery`; every other street terminates at the quay.
 */
export function bridgeIndexAt(x) {
  const step = RIVER.bridgeEvery * CITY.chunkSize;
  return Math.round(x / step);
}

/** World x of crossing `i`. */
export function bridgeX(i) {
  return i * RIVER.bridgeEvery * CITY.chunkSize;
}

/**
 * Which structure crossing `i` carries.
 *
 * A SEEDED PERMUTATION PER GROUP OF THREE, WHICH IS WHY THE VOCABULARY IS
 * GUARANTEED RATHER THAN LIKELY. Drawing the era from `CITY_ERAS`' own weights
 * — the first version — gives P(arch) 0.42, P(girder) 0.49, P(cable) 0.09, so
 * the three crossings inside `city-budget.json`'s region deliver all three
 * structures about one seed in nine and `minBridgeStructures: 3` would be an
 * assertion about luck. The building weights are the right distribution for
 * buildings and the wrong one for bridges anyway: a city builds a bridge at most
 * once a generation and does not replace one with a copy of its neighbour, so
 * what the river carries is a TIMELINE — one crossing of each period per group
 * of three, in a seeded order.
 *
 * Deterministic in `rootSeed` and `i` alone, so the worker and the main thread
 * agree without being told (§8.1).
 */
export function bridgeStructure(rootSeed, i) {
  const group = Math.floor(i / BRIDGE_STRUCTURES.length);
  const within = i - group * BRIDGE_STRUCTURES.length;
  // Fisher–Yates over three, driven by one seeded stream per group. Three
  // elements is two swaps; writing it out is shorter than importing a shuffle.
  const rng = chunkRng(rootSeed, group, 0, 'bridge');
  const order = BRIDGE_STRUCTURES.map((_, k) => k);
  for (let k = order.length - 1; k > 0; k--) {
    const j = rng.int(0, k);
    const t = order[k];
    order[k] = order[j];
    order[j] = t;
  }
  return BRIDGE_STRUCTURES[order[within]];
}

/**
 * Everything the geometry, the bake, the road clip and the walkability mask
 * need to know about one crossing, computed once.
 *
 * `clearSpan` is the water it has to cross at its own x — measured from the
 * river's own edges, never from `RIVER.halfWidth`, because the half-width
 * varies and a bridge built to the mean is a bridge that ends in the water at
 * the wide stations. Both numbers are returned so the caller can print them
 * beside each other (CONTRACT §9 rule 4).
 */
export function bridgeSpec(rootSeed, i) {
  const x = bridgeX(i);
  const e = riverEdges(x);
  const structure = bridgeStructure(rootSeed, i);
  const clearSpan = e.south - e.north;
  /**
   * Metres of deck beyond each bank, so the deck lands on the promenade behind
   * the quay wall rather than on its coping. The wall plus the promenade is
   * what `riverBlocks` already keeps clear, so the abutment stands on ground no
   * building was allowed to take.
   */
  const abutment = RIVER.wallThickness + RIVER.promenade;
  return {
    i,
    x,
    structure: structure.name,
    era: structure.era,
    riverPiers: structure.riverPiers,
    north: e.north,
    south: e.south,
    clearSpan,
    nominalSpan: RIVER.halfWidth * 2,
    /** Where the deck begins and ends, in z. */
    deckZ0: e.north - abutment,
    deckZ1: e.south + abutment,
    deckLength: clearSpan + abutment * 2,
    /** Half-width of the deck: the street's own corridor, so a bridge is a street. */
    deckHalf: CORRIDOR,
    /** Metres of structure above the deck. The §7.2 paired property. */
    aboveDeck: structure.riseRatio * clearSpan + (structure.riseRatio > 0 ? 0 : RIVER.parapet),
    riseRatio: structure.riseRatio,
  };
}

/**
 * The bank, sampled on the shared lattice. See `RIVER.bankStationM`.
 *
 * Returns one entry per station from the first lattice point at or below `x0`
 * to the first at or above `x1`, so two callers asking for overlapping ranges
 * get IDENTICAL vertices on the overlap — which is the property that keeps the
 * earth plane, the water surface and the quay wall from cracking apart.
 */
export function riverBankStations(x0, x1) {
  const s = RIVER.bankStationM;
  const i0 = Math.floor(x0 / s);
  const i1 = Math.ceil(x1 / s);
  const out = [];
  for (let i = i0; i <= i1; i++) {
    const x = i * s;
    const e = riverEdges(x);
    out.push({ x, north: e.north, south: e.south });
  }
  return out;
}

/**
 * Does the river's envelope reach this chunk?
 *
 * Against the ENVELOPE and not against the banks, because this is the test that
 * decides whether a caller looks at the river at all, and a bank test would
 * answer "no" for the chunk the bridge's abutment stands in.
 */
export function riverTouchesChunk(cx, cz) {
  const b = chunkBounds(cx, cz);
  const env = riverEnvelope();
  return b.z1 > env.z0 && b.z0 < env.z1;
}

/** Crossings whose deck reaches into `[x0, x1]`. */
export function bridgesTouching(rootSeed, x0, x1) {
  const step = RIVER.bridgeEvery * CITY.chunkSize;
  const out = [];
  const i0 = Math.floor(x0 / step) - 1;
  const i1 = Math.ceil(x1 / step) + 1;
  for (let i = i0; i <= i1; i++) {
    const s = bridgeSpec(rootSeed, i);
    if (s.x + s.deckHalf > x0 && s.x - s.deckHalf < x1) out.push(s);
  }
  return out;
}

/**
 * Is this point on a bridge deck — that is, can a person walk here even though
 * `inRiver` says it is water?
 *
 * THE WALKABILITY MASK IS BUILT FROM THIS AND FROM `inRiver`, IN THAT ORDER,
 * and the pair is the whole reason `citycheck`'s flood fill stays green: the
 * water blocks and the deck unblocks. Blocking without unblocking cuts the
 * condenser off and the gate says so, which is the gate working rather than the
 * gate being relaxed.
 */
export function onBridgeDeck(rootSeed, x, z, pad = 0) {
  const step = RIVER.bridgeEvery * CITY.chunkSize;
  const i = Math.round(x / step);
  const s = bridgeSpec(rootSeed, i);
  return (
    x > s.x - s.deckHalf - pad && x < s.x + s.deckHalf + pad &&
    z > s.deckZ0 - pad && z < s.deckZ1 + pad
  );
}

/**
 * THE PROMENADE LAMP LINE, BOTH BANKS. Session 16.
 *
 * WHY THIS DID NOT EXIST. `city.js` places street lighting on the two ROADS a
 * chunk owns, at `x = b.x0 + roadHalfWidth + 1.3` and its mirror in z, and
 * refuses any spot the river covers. A promenade is not a road, so no lamp has
 * ever stood on either quay — and the two banks are not symmetric in what that
 * costs, which is what makes it visible from one side and not the other:
 *
 *   the SOUTH bank keeps the whole city behind it, and the nearest surviving
 *   east–west road is at z = −256, which is 94 m back from the envelope edge.
 *   the NORTH bank's nearest surviving east–west road is z = −512, only 14 m
 *   beyond the envelope, because −384 falls inside it and was refused.
 *
 * So from the north bank the far side reads as a lit skyline standing on an
 * unlit edge — the buildings are the light and the waterfront is borrowing it.
 * That is the frame this function exists for, and the fix is not to brighten
 * anything: it is to put on the quay the one piece of street furniture every
 * embanked river in the world has and this one did not.
 *
 * EVERY NUMBER HERE IS ONE THE CITY ALREADY USES, and that is deliberate — a
 * promenade with its own lamp pitch and its own setback would be two more
 * numbers nobody derived (§9 rule 5).
 *
 *   pitch    `2 · RIVER.bankStationM` = 32 m. The road's pitch is 30 m
 *            (`city.js`, `i * 30`), and 32 is the nearest multiple of the
 *            SHARED BANK LATTICE to it — within 6.7%. On the lattice rather
 *            than near it, because a lamp walked at 30 m falls between
 *            stations and `riverEdges` would be asked for the bank at an x the
 *            wall, the water and the earth plane never sampled. Same argument
 *            as `bankStationM`'s own: two consumers sampling one curve
 *            differently is a crack, and here the crack would be a lamp
 *            standing 9 cm inside its own parapet.
 *   setback  `RIVER.wallThickness + 1.3`. The 1.3 m is the road lamp's own
 *            clearance from the carriageway edge — one length, two uses, which
 *            is the argument the promenade PROP band already makes for
 *            `KERB_GAP_M`.
 *   arm      2.1 m toward the land, which is the road lamp's own arm, so the
 *            head sits 3.4 m out over a 6.4 m promenade — the middle of the
 *            walk. An arm reaching the other way would light the water and
 *            leave the people in the dark, and the point of this line is the
 *            EDGE reading as lit rather than the river doing so.
 *
 * IT CANNOT HIT A BUILDING AND THAT IS BY CONSTRUCTION RATHER THAN BY TEST:
 * `riverBlocks` keeps every building `wallThickness + promenade` clear of the
 * water, and this stands at `wallThickness + 1.3`, which is inside that by
 * 5.1 m. Bridges are a test, because an abutment is not a building.
 */
const PROMENADE_LAMP_SETBACK_M = 1.3;
const PROMENADE_LAMP_ARM_M = 2.1;

export function promenadeLamps(rootSeed, x0, x1) {
  const out = [];
  const every = 2;
  for (const st of riverBankStations(x0, x1)) {
    if (st.x < x0 || st.x >= x1) continue;
    if (Math.round(st.x / RIVER.bankStationM) % every !== 0) continue;
    /**
     * A lamp inside a bridge is the `pierEvery` shape of mistake with a light
     * in it, so the crossings are asked rather than assumed. 8 m of slack past
     * the deck's own half-width is the lamp's arm plus its column, which is
     * what has to clear the abutment.
     */
    if (bridgesTouching(rootSeed, st.x - 8, st.x + 8).length) continue;
    /**
     * The bank's tangent, differentiated over the same 8 m the promenade props
     * use, so a lamp and the bench beside it face the same way. The third copy
     * of this formula, and §9.1's note on `river.js` and `city.js` having the
     * other two applies here too: no two of these files may import each other.
     */
    const e0 = riverEdges(st.x - 4);
    const e1 = riverEdges(st.x + 4);
    for (const bank of [-1, +1]) {
      const edge = bank < 0 ? st.north : st.south;
      const z = edge + bank * (RIVER.wallThickness + PROMENADE_LAMP_SETBACK_M);
      if (onBridgeDeck(rootSeed, st.x, z, 8)) continue;
      const dz = bank < 0 ? e1.north - e0.north : e1.south - e0.south;
      const tangentDeg = (-Math.atan2(dz, 8) * 180) / Math.PI;
      out.push({
        x: st.x,
        z,
        bank,
        /**
         * `rot` 90 puts the arm in −z — that is what the axis-'z' road lamp
         * does, whose head is at `spot.z − 2.1`. The north bank's land is at
         * −z, so it takes 90 and the south bank takes 270. The road code never
         * needed the flip because it only ever placed `side: +1`.
         */
        rotDeg: (bank < 0 ? 90 : 270) + tangentDeg,
        headX: st.x,
        headZ: z + bank * PROMENADE_LAMP_ARM_M,
        /**
         * The pool aims a lamp from `axis` and `side`: axis 'z' makes the
         * luminaire's long axis x, which is the way this band runs, and the
         * beam tilts by `−side · 0.3` in z. The tilt has to go the way the arm
         * does, so `side = −bank`.
         */
        axis: 'z',
        side: -bank,
      });
    }
  }
  return out;
}

/**
 * Can a person stand here?
 *
 * The water, minus the bridge decks. The promenade, the quay coping and both
 * embankment roads are all outside `inRiver` and are therefore walkable, which
 * is the point of testing the WATER rather than the envelope: a test on the
 * envelope would take the promenade away from the pedestrians as well.
 *
 * This is the same pair `citycheck`'s walkability mask is built from, exported
 * once so that the mask, the crowd and the traffic cannot disagree about where
 * the river is (CONTRACT §9.1 — a threshold written in two files is the
 * arrangement `pierEvery: 34` sat in).
 */
export function riverImpassable(rootSeed, x, z, pad = 0) {
  return inRiver(x, z, pad) && !onBridgeDeck(rootSeed, x, z, pad);
}

/**
 * Is there a ROAD here, for something that drives?
 *
 * Stricter than `riverImpassable` in one direction and looser in another, and
 * the difference is the reason it is a second function. An EAST–WEST road line
 * inside the envelope is not built at all (`city.js` → `buildGround`), even at
 * the 13% of stations where the meander leaves it momentarily on dry land — so
 * a vehicle on such a line is driving on nothing, which `inRiver` cannot see. A
 * NORTH–SOUTH road crosses, and what stops it is the water unless the crossing
 * carries a bridge.
 *
 * `eastWest` is what the caller's own lane axis means, passed in rather than
 * inferred, because "axis 0" means the opposite thing in two of this project's
 * modules and a boolean with a name cannot be read backwards.
 */
export function riverNoRoad(rootSeed, x, z, eastWest) {
  const env = riverEnvelope();
  if (!(z > env.z0 && z < env.z1)) return false;
  if (eastWest) return true;
  return !onBridgeDeck(rootSeed, x, z);
}

/**
 * What the river contributes to the canyon bake, as axis-aligned boxes.
 *
 * THE WATER CONTRIBUTES NOTHING AND THAT IS THE POINT — a hundred metres of
 * open sky is exactly what the field should say is there, and it is why the
 * bank reads as a bank. What DOES occlude is the far side of a quay wall seen
 * from the water, and a bridge deck, which is 23 m of concrete over the river
 * at street level and is the only thing in this world a boat would pass under.
 *
 * The deck is emitted at its own height rather than at `l.height` the way
 * `landmarkOccluders` does for the viaduct, because the bake's march is against
 * a `top` — a box from the ground up — and a bridge deck at grade over water
 * 4.99 m below is a box 4.99 m tall standing on the riverbed. Anything taller
 * would shadow the quay behind it.
 */
export function riverOccluders(rootSeed, cx, cz) {
  const b = chunkBounds(cx, cz);
  const env = riverEnvelope();
  if (b.z1 < env.z0 || b.z0 > env.z1) return [];
  const out = [];
  for (const s of bridgesTouching(rootSeed, b.x0, b.x1)) {
    out.push({
      x0: Math.max(b.x0, s.x - s.deckHalf), x1: Math.min(b.x1, s.x + s.deckHalf),
      z0: s.deckZ0, z1: s.deckZ1,
      top: RIVER.depth,
      river: 'deck',
    });
  }
  return out;
}

/**
 * The line CONTRACT §9 rule 4 asks for: every number the river derives, beside
 * the number it was derived from. Printed by `river.js` at init.
 */
export function riverBudget() {
  const env = riverEnvelope();
  const island = CITY.chunkSize - 2 * CORRIDOR;
  let wMin = Infinity;
  let wMax = 0;
  for (let x = -2048; x <= 2048; x += 4) {
    const w = riverHalfAt(x) * 2;
    wMin = Math.min(wMin, w);
    wMax = Math.max(wMax, w);
  }
  return {
    island,
    meanWidth: RIVER.halfWidth * 2,
    widthMin: +wMin.toFixed(2),
    widthMax: +wMax.toFixed(2),
    envelopeZ0: +env.z0.toFixed(2),
    envelopeZ1: +env.z1.toFixed(2),
    envelopeWidth: +(env.z1 - env.z0).toFixed(2),
    depth: RIVER.depth,
    /** The three terms `RIVER.depth` is the sum of. */
    depthTerms: { deckSlab: 0.85, girder: 1.74, freeboard: 2.4 },
    bridgeSpacing: RIVER.bridgeEvery * CITY.chunkSize,
  };
}

/**
 * The viaduct's curve, sampled once, for everybody who needs it.
 *
 * THREE CONSUMERS HAD THREE CURVES. `landmarkOccluders` sampled the arc at 14
 * stations, `city.js` drew it at 30, and the pier spacing was neither: the deck
 * was drawn at "every third station", which over 30 stations of a 480 m arc is
 * 48 m between piers where `pierEvery` — the number in the landmark data, in
 * metres — says 34. A count used where a length was meant, CONTRACT §9 in its
 * usual clothes. The bake was therefore marching against a different bridge from
 * the one being drawn, and the piers were at a spacing nobody had written down.
 *
 * So: one function, one curve, and the two derived quantities printed together
 * by the caller (CONTRACT §9 rule 4).
 *
 * Stations are the chords the deck is built from. A pier stands at every
 * `segsPerBay`-th station, and the station count is a multiple of the bay count
 * so that a pier always lands on a joint rather than under the middle of a span.
 */
export function viaductArc(l) {
  const R = l.arcRadius;
  const arcLength = l.arcLength;
  const hdg = (l.headingDeg * Math.PI) / 180;
  const tx = Math.cos(hdg);
  const tz = Math.sin(hdg);
  // The centre of curvature is one radius off the crown, on the side the curve
  // bends toward. Deriving it here rather than authoring it is what keeps
  // `l.x, l.z` a point on the deck.
  const cx = l.x - tz * l.curveSign * R;
  const cz = l.z + tx * l.curveSign * R;
  const a0 = Math.atan2(l.z - cz, l.x - cx);

  /** Bays, from the spacing in METRES that the landmark data declares. */
  const bays = Math.max(2, Math.round(arcLength / l.pierEvery));
  /**
   * Chord length, chosen so the polygonal error stays under 0.06 m: the sagitta
   * of a chord c on a radius R is c²/8R, so 11 m at R = 300 is 0.05 m. `ceil`
   * rather than `round` — a bay 21.8 m long rounds to one segment and 0.20 m of
   * facet, which on a 480 m curve reads as a chain of straight pieces.
   */
  const segsPerBay = Math.max(1, Math.ceil(arcLength / bays / 12));
  const n = bays * segsPerBay;

  const stations = [];
  for (let i = 0; i <= n; i++) {
    // Arc distance from the crown, signed, so the crown is the middle station.
    const s = (i / n - 0.5) * arcLength;
    const a = a0 + (l.curveSign * s) / R;
    const x = cx + Math.cos(a) * R;
    const z = cz + Math.sin(a) * R;
    // Tangent, differentiated rather than assumed: d(pos)/ds = curveSign·(−sin a, cos a).
    const dx = -Math.sin(a) * l.curveSign;
    const dz = Math.cos(a) * l.curveSign;
    stations.push({
      i,
      s,
      x,
      z,
      /** Yaw that takes a box's +X axis onto the deck tangent, degrees. */
      yawDeg: (-Math.atan2(dz, dx) * 180) / Math.PI,
      tangent: [dx, dz],
      pier: i % segsPerBay === 0,
    });
  }
  return {
    stations,
    centre: [cx, cz],
    arcLength,
    bays,
    segsPerBay,
    /** Chord length between two stations, metres. */
    chord: arcLength / n,
    /** What the piers ACTUALLY come out at, next to what was asked for. */
    pierSpacing: arcLength / bays,
    pierSpacingAsked: l.pierEvery,
    /** Half-width of a pier shaft, metres. Used by the geometry and the blockers. */
    pierHalf: 1.7,
  };
}

/**
 * Could the building generator have produced this shape?
 *
 * The generator makes axis-aligned rectangular masses, 12–64 m tall, 14–34 m
 * wide, with a cornice and windows. Anything that is not a box, or is outside
 * that height band, is outside its range. citycheck asserts every landmark is —
 * because a landmark the generator can make is not a landmark, it is a building.
 */
export function generatorCanProduce(landmark) {
  if (landmark.kind !== 'box') return false;
  return landmark.height >= 12 && landmark.height <= 64;
}

export function landmarkFootprint(l) {
  switch (l.kind) {
    case 'hyperboloid': return Math.max(l.radiusBase, l.radiusTop) * 2;
    case 'ziggurat': return Math.max(l.footprint[0], l.footprint[1]);
    case 'arch': return l.span;
    case 'viaduct': return l.arcLength;
    case 'dome': return l.radius * 2;
    case 'basin': return l.radius * 2;
    case 'mast': return l.baseWidth;
    case 'cone': return l.radiusTop * 2;
    default: return 30;
  }
}

/**
 * Occluders a landmark contributes to the canyon bake, as axis-aligned boxes.
 *
 * Approximations of the real silhouette, and deliberately so: the bake marches
 * against boxes (lib/canyon.js) and a hyperboloid is not one. Three stacked
 * boxes at the base, waist and crown radii is within a couple of metres of the
 * real profile everywhere, and the field's voxels are two metres.
 */
export function landmarkOccluders(l) {
  const box = (cx, cz, halfX, halfZ, top) => ({
    x0: cx - halfX, x1: cx + halfX, z0: cz - halfZ, z1: cz + halfZ, top, landmark: l.name,
  });
  switch (l.kind) {
    case 'hyperboloid': {
      const out = [];
      const n = 4;
      for (let i = 0; i < n; i++) {
        const t0 = i / n;
        const t1 = (i + 1) / n;
        // Radius profile of a hyperboloid: waist at mid height, flaring both ways.
        const rAt = (t) => {
          const w = 2 * t - 1;
          return l.radiusWaist + (w < 0 ? (l.radiusBase - l.radiusWaist) * w * w : (l.radiusTop - l.radiusWaist) * w * w);
        };
        const r = Math.max(rAt(t0), rAt(t1)) * 0.82;
        out.push(box(l.x, l.z, r, r, l.height * t1));
      }
      return out;
    }
    case 'ziggurat': {
      const out = [];
      for (let i = 0; i < l.steps; i++) {
        const hx = l.footprint[0] / 2 - i * l.setback;
        const hz = l.footprint[1] / 2 - i * l.setback;
        if (hx <= 2 || hz <= 2) break;
        out.push(box(l.x, l.z, hx, hz, (l.height * (i + 1)) / l.steps));
      }
      return out;
    }
    case 'arch':
      // The two legs. The span between them is open, which is the point of an
      // arch and the reason it does not read as a wall in the field.
      return [
        box(l.x - l.span / 2, l.z, l.thickness, l.thickness, l.height * 0.72),
        box(l.x + l.span / 2, l.z, l.thickness, l.thickness, l.height * 0.72),
      ];
    case 'viaduct': {
      // The same stations the deck is drawn from, so the bake marches against
      // the bridge that is on screen. Session 4 sampled the curve at 14 here
      // and at 30 in city.js: two descriptions of one object, and the field was
      // describing the one nobody could see.
      const out = [];
      const arc = viaductArc(l);
      for (const p of viaductPiers(arc)) {
        out.push(box(p.x, p.z, arc.pierHalf + 0.5, arc.pierHalf + 0.5, l.height));
      }
      for (let i = 0; i < arc.stations.length - 1; i++) {
        const a = arc.stations[i];
        const b = arc.stations[i + 1];
        // Axis-aligned cover of one rotated deck segment: the chord's own
        // extent plus the deck's half-width. Conservative at the corners, which
        // for a sky-occlusion march at 2.79 m voxels is below a texel.
        out.push(box(
          (a.x + b.x) / 2, (a.z + b.z) / 2,
          Math.abs(b.x - a.x) / 2 + l.deck / 2,
          Math.abs(b.z - a.z) / 2 + l.deck / 2,
          l.height
        ));
      }
      return out;
    }
    case 'dome':
      return [box(l.x, l.z, l.radius, l.radius, l.drum), box(l.x, l.z, l.radius * 0.72, l.radius * 0.72, l.height)];
    case 'basin':
      // A hole in the ground occludes nothing above grade, and saying so is the
      // whole reason this switch is explicit rather than a bounding box.
      return [];
    case 'mast':
      return [box(l.x, l.z, l.baseWidth / 2, l.baseWidth / 2, l.height)];
    case 'cone':
      return [box(l.x, l.z, l.radiusTop * 0.7, l.radiusTop * 0.7, l.height)];
    default:
      return [];
  }
}

/** Stations that carry a pier. One list, so the geometry and the blockers agree. */
export function viaductPiers(arc) {
  return arc.stations.filter((s) => s.pier);
}

/**
 * What a landmark puts on the ground, as opposed to what it puts in the sky.
 *
 * FOR EVERYTHING EXCEPT THE VIADUCT THESE ARE THE SAME BOXES, AND THAT IS WHY
 * THE DIFFERENCE WENT UNNOTICED. `landmarkOccluders` answers "what blocks a ray
 * to the sky"; the walkability flood fill in city.js was asking "what blocks a
 * person", and used the sky answer because for a tower they coincide. A viaduct
 * is the first structure in this city that a person walks *under*, so the two
 * answers separate: 480 m of deck at 21 m blocks every ray and no pedestrian.
 *
 * With the deck running down the main street (see LANDMARKS), using the sky
 * answer would have walled off the block's own street and reported every
 * landmark west of it unreachable — the same shape of failure as session 4's
 * arc-length keep-out, from the same habit of having one list stand for two
 * questions. Buildings are still kept out of the deck's footprint, because a
 * building 12 to 64 m tall would grow through it; that is `landmarkBlocks`, and
 * it is a third question with a third answer.
 */
export function landmarkGroundBlockers(l) {
  if (l.kind !== 'viaduct') return landmarkOccluders(l);
  const arc = viaductArc(l);
  const half = arc.pierHalf + 0.5;
  return viaductPiers(arc).map((p) => ({
    x0: p.x - half, x1: p.x + half, z0: p.z - half, z1: p.z + half,
    top: l.height, landmark: l.name,
  }));
}

/** Which chunk a landmark's centre falls in. */
export function landmarkChunk(l) {
  return [Math.floor(l.x / CITY.chunkSize), Math.floor(l.z / CITY.chunkSize)];
}

/**
 * A landmark's real extent, as an axis-aligned box.
 *
 * From its own occluders, not from `landmarkFootprint`. Those two are not the
 * same number and confusing them was a real bug: `landmarkFootprint` returns the
 * viaduct's arc LENGTH — 480 m — which as a circular keep-out radius sterilised
 * every lot within 250 m of a structure that is nine metres wide. The chunk at
 * (2, 2) measured a density of 0.42 and generated zero buildings.
 *
 * A curve is not a disc, and the union of the boxes the bake already marches
 * against is the one description of a landmark that is true by construction.
 */
export function landmarkAABB(l) {
  const boxes = landmarkOccluders(l);
  if (!boxes.length) {
    // A basin occludes nothing above grade, but it is still 210 m of ground you
    // cannot build on.
    const r = landmarkFootprint(l) / 2;
    return { x0: l.x - r, x1: l.x + r, z0: l.z - r, z1: l.z + r };
  }
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const b of boxes) {
    x0 = Math.min(x0, b.x0); x1 = Math.max(x1, b.x1);
    z0 = Math.min(z0, b.z0); z1 = Math.max(z1, b.z1);
  }
  return { x0, x1, z0, z1 };
}

/** Does a landmark actually stand at this point? Tested against its boxes, not its bounds. */
export function landmarkBlocks(l, x, z, pad = 0) {
  const boxes = landmarkOccluders(l);
  if (!boxes.length) {
    const r = landmarkFootprint(l) / 2 + pad;
    return Math.hypot(x - l.x, z - l.z) < r;
  }
  for (const b of boxes) {
    if (x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad) return true;
  }
  return false;
}

/** Landmarks whose real extent touches this chunk, so a chunk builds its share. */
export function landmarksTouching(cx, cz) {
  const b = chunkBounds(cx, cz);
  return LANDMARKS.filter((l) => {
    const a = landmarkAABB(l);
    return a.x1 + 4 > b.x0 && a.x0 - 4 < b.x1 && a.z1 + 4 > b.z0 && a.z0 - 4 < b.z1;
  });
}

// ---------------------------------------------------------------------------
// the origin block
//
// `block.js` builds a hand-tuned street around the origin and the look gate
// measures it. The generator does not place buildings there — it would put them
// through the block's facades — but it does still place roads, because the
// block's street has to continue out of it or the city has no through route.

export const BLOCK_KEEPOUT = { x0: -168, x1: 168, z0: -46, z1: 46 };

function insideKeepout(x, z, pad = 0) {
  return (
    x > BLOCK_KEEPOUT.x0 - pad && x < BLOCK_KEEPOUT.x1 + pad &&
    z > BLOCK_KEEPOUT.z0 - pad && z < BLOCK_KEEPOUT.z1 + pad
  );
}

// ---------------------------------------------------------------------------

/**
 * STREET FURNITURE AND PLANTING, AS MODELS RATHER THAN AS A BOX.
 * ==============================================================
 *
 * WHAT WAS HERE BEFORE, AND WHY IT WAS THE WHOLE PROBLEM. Every prop in the
 * city — bollard, planter, bin, cabinet, tree, bench, container, fence,
 * lamppost — was drawn by `city.js` as ONE AXIS-ALIGNED BOX: `1.1 · scale` tall
 * and `2 · propHalfWidth(kind) · scale` square, in one of two colours. A tree
 * was a green cube 5.2 m tall and 3.4 m across. Nine kinds, one model.
 *
 * That is the difference between DENSITY and VARIATION stated as a table.
 * Density is how much is there and the scatter was already good at it: 757
 * props over 81 chunks, clumped on the density field, tested against the
 * building footprints. Variation is how DIFFERENT the things are, and a
 * procedural system produces streets that are full of things that are all the
 * same thing unless every category carries its own spread. The buildings had
 * four eras. This had one box.
 *
 * WHAT THE SPREAD IS MADE OF, and there are four independent axes so that two
 * props of the same kind are unlikely to agree on any of them:
 *
 *   1. TWO OR THREE MODELS PER KIND, each a small stack of boxes rather than
 *      one. `variant` is seeded per prop.
 *   2. `scale`, already there: 0.85 to 1.25.
 *   3. `yawDeg`, already there: §3's imperfect alignment.
 *   4. `soil`, new: a multiplier on every box's albedo, 0.62 to 1.0, and it
 *      only ever multiplies DOWN. A SIGNED colour jitter used as a soiling term
 *      is CONTRACT §9 row 14 and this project has shipped that mistake once.
 *
 * Trees get a fifth: `leanDeg` about a seeded azimuth, applied to the whole
 * model about its own base. A tree is the only street object tall enough to
 * break the mid-distance silhouette, so its variation reads further than
 * anything at pavement level — which is why it is the one kind with three
 * genuinely different species rather than three sizes of the same thing.
 *
 * THE COST, because it is the only reason not to: these boxes ride in the
 * chunk's ONE box mesh, exactly as the window reveals do, so they cost no draw
 * call at all. They cost instances and triangles. Measured on the delivered
 * city below by `propBoxBudget()`, which is printed at boot beside the number
 * it is derived from (§9 rule 4) rather than asserted here.
 *
 * GEOMETRY CONVENTION. Every box is `{ x, y, z, w, h, d, albedo, rough }` in
 * metres in the prop's own frame: +y up from the pavement, y is the box's
 * CENTRE height, and the model stands on y = 0. `city.js` scales by `scale`,
 * rotates by `yawDeg` about y and, if the variant declares one, leans by
 * `leanDeg` about a horizontal axis at azimuth `leanAzDeg` through the origin.
 *
 * Reflectances are linear and physical, as everywhere else in this project:
 * cast iron 0.055, painted steel 0.22, galvanised sheet 0.34, weathered timber
 * 0.18, concrete 0.30, terracotta 0.19, foliage 0.085, bark 0.065, hydrant
 * paint 0.24 red.
 */
const IRON = [0.055, 0.055, 0.058];
const STEEL = [0.22, 0.222, 0.228];
const GALV = [0.34, 0.345, 0.352];
const TIMBER = [0.18, 0.148, 0.108];
const CONCRETE = [0.30, 0.298, 0.288];
const TERRACOTTA = [0.19, 0.105, 0.075];
const BARK = [0.065, 0.055, 0.045];
const FOLIAGE_A = [0.070, 0.105, 0.048];
const FOLIAGE_B = [0.086, 0.118, 0.062];
const FOLIAGE_C = [0.058, 0.092, 0.055];
const HYDRANT = [0.24, 0.045, 0.035];

const bx = (x, y, z, w, h, d, albedo, rough = 0.8) => ({ x, y, z, w, h, d, albedo, rough });

export const PROP_MODELS = {
  bollard: [
    /** A slim steel post with a cap. The ordinary one. */
    { boxes: [bx(0, 0.45, 0, 0.11, 0.90, 0.11, STEEL, 0.5), bx(0, 0.925, 0, 0.145, 0.05, 0.145, STEEL, 0.45)] },
    /** Squat cast iron on a flared base — the older street's bollard. */
    {
      boxes: [
        bx(0, 0.055, 0, 0.30, 0.11, 0.30, IRON, 0.72),
        bx(0, 0.44, 0, 0.19, 0.66, 0.19, IRON, 0.62),
        bx(0, 0.80, 0, 0.13, 0.06, 0.13, IRON, 0.6),
      ],
    },
    /** A tall post with a reflective band, and no cap. */
    {
      boxes: [
        bx(0, 0.52, 0, 0.085, 1.04, 0.085, STEEL, 0.42),
        bx(0, 0.83, 0, 0.10, 0.10, 0.10, [0.52, 0.44, 0.10], 0.35),
      ],
    },
  ],

  hydrant: [
    {
      boxes: [
        bx(0, 0.04, 0, 0.34, 0.08, 0.34, IRON, 0.75),
        bx(0, 0.34, 0, 0.19, 0.52, 0.19, HYDRANT, 0.55),
        bx(0, 0.66, 0, 0.24, 0.10, 0.24, HYDRANT, 0.5),
        bx(0.15, 0.40, 0, 0.12, 0.13, 0.13, HYDRANT, 0.5),
        bx(-0.15, 0.40, 0, 0.12, 0.13, 0.13, HYDRANT, 0.5),
      ],
    },
    {
      boxes: [
        bx(0, 0.30, 0, 0.22, 0.60, 0.22, HYDRANT, 0.6),
        bx(0, 0.66, 0, 0.14, 0.14, 0.14, HYDRANT, 0.55),
        bx(0, 0.46, 0.14, 0.11, 0.11, 0.10, IRON, 0.6),
      ],
    },
  ],

  bin: [
    /** A square litter bin on a stub post, lid proud of the body. */
    {
      boxes: [
        bx(0, 0.62, 0, 0.40, 0.60, 0.34, STEEL, 0.62),
        bx(0, 0.945, 0, 0.44, 0.06, 0.38, STEEL, 0.5),
        bx(0, 0.16, 0, 0.10, 0.32, 0.10, IRON, 0.7),
      ],
    },
    /** A wheeled bin, lid ajar. The one that is nearly always slightly off. */
    {
      boxes: [
        bx(0, 0.52, 0, 0.58, 1.00, 0.48, [0.13, 0.15, 0.13], 0.68),
        bx(0, 1.05, 0.03, 0.60, 0.07, 0.52, [0.11, 0.13, 0.11], 0.66),
        bx(-0.24, 0.07, -0.18, 0.09, 0.14, 0.14, IRON, 0.8),
        bx(0.24, 0.07, -0.18, 0.09, 0.14, 0.14, IRON, 0.8),
      ],
    },
    /** An open wire basket on a hoop. Reads as a hole rather than a mass. */
    {
      boxes: [
        bx(0, 0.60, 0, 0.34, 0.46, 0.34, [0.10, 0.10, 0.105], 0.75),
        bx(0, 0.845, 0, 0.40, 0.05, 0.40, GALV, 0.45),
        bx(0, 0.19, 0, 0.07, 0.38, 0.07, GALV, 0.5),
      ],
    },
  ],

  cabinet: [
    /** A tall utility cabinet on a plinth. */
    {
      boxes: [
        bx(0, 0.05, 0, 0.62, 0.10, 0.42, CONCRETE, 0.85),
        bx(0, 0.76, 0, 0.56, 1.32, 0.34, GALV, 0.55),
        bx(0, 1.45, 0, 0.60, 0.06, 0.38, GALV, 0.5),
      ],
    },
    /** A low, wide one with a shallow pitched top and a door seam. */
    {
      boxes: [
        bx(0, 0.42, 0, 0.98, 0.84, 0.44, [0.19, 0.205, 0.20], 0.66),
        bx(0, 0.87, 0, 1.02, 0.07, 0.48, [0.16, 0.175, 0.17], 0.6),
        bx(0, 0.44, 0.23, 0.42, 0.72, 0.02, [0.13, 0.14, 0.14], 0.7),
      ],
    },
    /** A slim column cabinet with a hooded top — a signal or comms pillar. */
    {
      boxes: [
        bx(0, 0.60, 0, 0.36, 1.20, 0.30, STEEL, 0.6),
        bx(0, 1.25, 0, 0.44, 0.10, 0.38, STEEL, 0.52),
        bx(0, 0.04, 0, 0.44, 0.08, 0.36, CONCRETE, 0.88),
      ],
    },
  ],

  planter: [
    /** A square concrete trough with a low shrub. */
    {
      boxes: [
        bx(0, 0.28, 0, 0.86, 0.56, 0.86, CONCRETE, 0.9),
        bx(0, 0.60, 0, 0.74, 0.10, 0.74, [0.10, 0.075, 0.055], 0.95),
        bx(0, 0.86, 0, 0.62, 0.44, 0.60, FOLIAGE_B, 0.95),
      ],
    },
    /** A tall terracotta tub with a small standard on a stem. */
    {
      boxes: [
        bx(0, 0.34, 0, 0.60, 0.68, 0.60, TERRACOTTA, 0.86),
        bx(0, 0.95, 0, 0.09, 0.56, 0.09, BARK, 0.9),
        bx(0, 1.42, 0, 0.72, 0.50, 0.68, FOLIAGE_A, 0.95),
      ],
    },
    /** A long timber box against a wall — two shrubs and a gap. */
    {
      boxes: [
        bx(0, 0.24, 0, 1.30, 0.48, 0.50, TIMBER, 0.88),
        bx(-0.38, 0.66, 0, 0.44, 0.38, 0.42, FOLIAGE_C, 0.95),
        bx(0.36, 0.72, 0, 0.40, 0.48, 0.40, FOLIAGE_B, 0.95),
      ],
    },
  ],

  bench: [
    /** Slatted seat and back on cast-iron ends. */
    {
      boxes: [
        bx(0, 0.42, 0, 1.74, 0.07, 0.46, TIMBER, 0.85),
        bx(0, 0.72, -0.20, 1.74, 0.40, 0.06, TIMBER, 0.85),
        bx(-0.78, 0.21, 0, 0.09, 0.42, 0.44, IRON, 0.7),
        bx(0.78, 0.21, 0, 0.09, 0.42, 0.44, IRON, 0.7),
      ],
    },
    /** A plain concrete plinth bench, no back. */
    {
      boxes: [
        bx(0, 0.20, 0, 1.60, 0.40, 0.44, CONCRETE, 0.92),
        bx(0, 0.43, 0, 1.66, 0.06, 0.48, CONCRETE, 0.86),
      ],
    },
  ],

  fence: [
    /** Two rails on three posts — a run rather than a panel. */
    {
      boxes: [
        bx(-1.0, 0.55, 0, 0.08, 1.10, 0.08, GALV, 0.6),
        bx(0, 0.55, 0, 0.08, 1.10, 0.08, GALV, 0.6),
        bx(1.0, 0.55, 0, 0.08, 1.10, 0.08, GALV, 0.6),
        bx(0, 1.02, 0, 2.10, 0.06, 0.05, GALV, 0.55),
        bx(0, 0.58, 0, 2.10, 0.05, 0.05, GALV, 0.55),
      ],
    },
    /** A solid hoarding panel on feet. */
    {
      boxes: [
        bx(0, 1.05, 0, 2.10, 2.05, 0.06, [0.26, 0.255, 0.24], 0.82),
        bx(-0.85, 0.05, 0, 0.30, 0.10, 0.42, CONCRETE, 0.9),
        bx(0.85, 0.05, 0, 0.30, 0.10, 0.42, CONCRETE, 0.9),
      ],
    },
  ],

  container: [
    /** A skip: sloped ends, open top. */
    {
      boxes: [
        bx(0, 0.55, 0, 2.20, 1.05, 1.55, [0.20, 0.115, 0.075], 0.8),
        bx(0, 1.14, 0, 2.26, 0.08, 1.62, [0.17, 0.10, 0.065], 0.78),
        bx(0, 0.35, 0.86, 2.20, 0.68, 0.10, [0.20, 0.115, 0.075], 0.8),
      ],
    },
    /** A shipping box on timber bearers. */
    {
      boxes: [
        bx(0, 0.80, 0, 2.30, 1.50, 1.30, [0.14, 0.155, 0.16], 0.72),
        bx(0, 0.04, -0.5, 2.30, 0.08, 0.14, TIMBER, 0.9),
        bx(0, 0.04, 0.5, 2.30, 0.08, 0.14, TIMBER, 0.9),
      ],
    },
  ],

  lamppost: [
    {
      boxes: [
        bx(0, 0.10, 0, 0.34, 0.20, 0.34, CONCRETE, 0.9),
        bx(0, 2.10, 0, 0.14, 4.00, 0.14, STEEL, 0.5),
        bx(0, 4.14, 0.30, 0.11, 0.09, 0.62, STEEL, 0.45),
      ],
    },
  ],

  /**
   * TREES. Three species rather than three sizes, because the axis that reads
   * at distance is the SHAPE of the crown and not its diameter:
   *
   *   broad     a short trunk under a wide flat crown in two tiers
   *   columnar  a tall narrow crown that starts near the ground
   *   open      a tall clear trunk with a small high crown and a lower limb
   *
   * `leanRange` is degrees about a seeded azimuth, applied to the whole model
   * about its own base, so a leaning tree's crown moves with its trunk.
   *
   * EVERY CROWN CLEARS `HEAD_CLEAR_M`, and that is a placement constraint
   * rather than an aesthetic one: `derivePropHalfAcross` counts only what is
   * below head height, so a tree whose lowest foliage hangs at 1.6 m would
   * measure 1.4 m across and be refused the pavement it belongs on. A street
   * tree is lifted clear of the footway in exactly the same way and for
   * exactly the same reason.
   */
  tree: [
    {
      leanRange: 5,
      boxes: [
        bx(0, 1.10, 0, 0.34, 2.20, 0.34, BARK, 0.92),
        bx(0, 3.20, 0, 2.70, 1.80, 2.50, FOLIAGE_A, 0.95),
        bx(0.25, 4.40, -0.15, 2.05, 1.05, 1.90, FOLIAGE_C, 0.95),
      ],
    },
    {
      leanRange: 3,
      boxes: [
        bx(0, 1.15, 0, 0.26, 2.30, 0.26, BARK, 0.92),
        bx(0, 4.20, 0, 1.35, 3.60, 1.30, FOLIAGE_C, 0.95),
        bx(0, 6.20, 0, 0.85, 0.90, 0.82, FOLIAGE_B, 0.95),
      ],
    },
    {
      leanRange: 8,
      boxes: [
        bx(0, 1.65, 0, 0.28, 3.30, 0.28, BARK, 0.92),
        bx(-0.55, 2.85, 0.15, 1.10, 0.16, 0.35, BARK, 0.92),
        bx(0, 4.40, 0, 2.15, 1.90, 2.05, FOLIAGE_B, 0.95),
        bx(-0.30, 5.50, 0.20, 1.35, 0.85, 1.30, FOLIAGE_A, 0.95),
      ],
    },
  ],
};

/**
 * Half-width of each prop kind at scale 1, metres. THE AUTHORITY, and the
 * reason it is here rather than in `city.js` is CONTRACT §9 rule 3: the number
 * is used for two different things in two different files and they have to be
 * the same number. `city.js` builds the boxes and the scatter below tests
 * occupancy with `propHalfWidth(kind) * scale` as its pad. One table, two
 * consumers, no drift.
 *
 * IT IS NOW DERIVED FROM THE MODELS RATHER THAN AUTHORED BESIDE THEM, which is
 * the same rule one step further along: an authored pad and an authored model
 * are two numbers that have to agree, and CONTRACT §9.1 is a list of pairs like
 * that which did not. The pad is the largest half-extent any variant of the
 * kind reaches on either horizontal axis, plus the lean's own contribution —
 * `sin(leanRange) · topOfModel`, because leaning a 6 m tree by 8° moves its
 * crown 0.84 m sideways and a pad that ignored that would put the crown in a
 * wall while the trunk stood clear of it.
 *
 * A tree is the one that matters: the gate's own test is centre-only, so a pad
 * of zero would pass `citycheck` with two metres of canopy inside a wall.
 */
function derivePropHalfWidth() {
  const out = {};
  for (const [kind, variants] of Object.entries(PROP_MODELS)) {
    let r = 0;
    for (const v of variants) {
      let top = 0;
      let flat = 0;
      for (const b of v.boxes) {
        flat = Math.max(flat, Math.abs(b.x) + b.w / 2, Math.abs(b.z) + b.d / 2);
        top = Math.max(top, b.y + b.h / 2);
      }
      const lean = v.leanRange ? Math.sin((v.leanRange * Math.PI) / 180) * top : 0;
      r = Math.max(r, flat + lean);
    }
    out[kind] = +r.toFixed(3);
  }
  out.default = 0.3;
  return out;
}

/**
 * Metres a kind reaches ACROSS its own local z axis, counting only the boxes
 * that are below head height — and it is a different quantity from the pad
 * above, deliberately.
 *
 * The pad is "how much room does this need not to be inside a wall". This is
 * "how much room does this need not to be inside a PERSON", and a street tree
 * answers the two very differently: its trunk is 0.17 m across and its crown is
 * 1.35 m, and the crown is over your head. Using one number for both is how a
 * tree would have been banned from the pavement it belongs on.
 *
 * `HEAD_CLEAR_M` is 2.10: `streetlife`'s reference figure is 1.72 m tall and
 * the tallest instance the height distribution admits is `BODY_HEIGHT_MAX`, so
 * 2.10 clears a tall person with a hand up. Boxes whose UNDERSIDE is above it
 * are not counted.
 */
const HEAD_CLEAR_M = 2.10;

function derivePropHalfAcross() {
  const out = {};
  for (const [kind, variants] of Object.entries(PROP_MODELS)) {
    let r = 0;
    for (const v of variants) {
      let across = 0;
      for (const b of v.boxes) {
        if (b.y - b.h / 2 >= HEAD_CLEAR_M) continue;
        across = Math.max(across, Math.abs(b.z) + b.d / 2);
      }
      const lean = v.leanRange ? Math.sin((v.leanRange * Math.PI) / 180) * HEAD_CLEAR_M : 0;
      r = Math.max(r, across + lean);
    }
    out[kind] = +r.toFixed(3);
  }
  out.default = 0.3;
  return out;
}

export const PROP_HALF_WIDTH = derivePropHalfWidth();
export const PROP_HALF_ACROSS = derivePropHalfAcross();

export function propHalfAcross(kind) {
  const v = PROP_HALF_ACROSS[kind];
  return v === undefined ? PROP_HALF_ACROSS.default : v;
}

export function propHalfWidth(kind) {
  const v = PROP_HALF_WIDTH[kind];
  return v === undefined ? PROP_HALF_WIDTH.default : v;
}

/** How many models a kind has. Used by the scatter to seed `variant`. */
export function propVariantCount(kind) {
  const v = PROP_MODELS[kind];
  return v ? v.length : 0;
}

/**
 * The line CONTRACT §9 rule 4 asks for: the box count these models cost, beside
 * the prop count it is derived from. Printed by `city.js` at init.
 */
export function propBoxBudget() {
  const parts = [];
  let min = Infinity;
  let max = 0;
  for (const [kind, variants] of Object.entries(PROP_MODELS)) {
    const counts = variants.map((v) => v.boxes.length);
    min = Math.min(min, ...counts);
    max = Math.max(max, ...counts);
    parts.push(`${kind} ${variants.length}×${counts.join('/')}`);
  }
  return { min, max, parts };
}

/**
 * Is (x, z), padded by `pad`, inside any of these axis-aligned footprints?
 *
 * The same predicate shape `landmarkBlocks` uses, deliberately, so the two
 * occupancy questions this generator asks are answered by code that reads the
 * same way. Callers pass the list appropriate to THEIR question: building
 * footprints for a prop, `landmarkGroundBlockers` for anything that walks or
 * drives. CONTRACT §9 row 13 is one list having answered two questions.
 */
export function occupied(boxes, x, z, pad = 0) {
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad) return true;
  }
  return false;
}

/**
 * Metres. The shallowest a riverside frontage may be before `generateChunk`
 * refuses the site instead of cutting it down to fit.
 *
 * The generator's ordinary depth band is 15–26 m. 9 m is a single-bay terrace
 * — one room and a stair — which is what the tightest stretch of a real
 * embankment carries, and below that a "building" is a wall with windows in it.
 * It is also more than the 7.7 m of wall-plus-promenade the river already keeps
 * clear, so a 9 m building is at least as deep as the pavement in front of it.
 *
 * MODULE SCOPE, not inside `generateChunk`, because the building loop reads it
 * hundreds of lines above where a chunk-local const would be declared and a
 * `const` read before its declaration is a temporal-dead-zone throw rather than
 * a value.
 */
const MIN_RIVER_DEPTH = 9;

/** Half-width of the road-plus-pavement corridor on a chunk boundary. */
export const CORRIDOR = CITY.roadHalfWidth + CITY.sidewalkWidth;

/**
 * Generate one chunk. Deterministic in (rootSeed, cx, cz) and nothing else.
 *
 * @returns {{
 *   cx:number, cz:number, density:number, lowDetail:boolean, kind:string,
 *   roadMaterials:string[], buildings:object[], props:object[], signs:object[],
 *   occluders:object[], landmarks:object[], objectCount:number
 * }}
 */
export function generateChunk(rootSeed, cx, cz) {
  const b = chunkBounds(cx, cz);
  const cxWorld = (b.x0 + b.x1) / 2;
  const czWorld = (b.z0 + b.z1) / 2;
  const density = densityAt(rootSeed, cxWorld, czWorld);

  const rng = chunkRng(rootSeed, cx, cz, 'layout');
  const eraRng = chunkRng(rootSeed, cx, cz, 'era');
  const signRng = chunkRng(rootSeed, cx, cz, 'sign');
  const yawRng = chunkRng(rootSeed, cx, cz, 'yaw');
  const propRng = chunkRng(rootSeed, cx, cz, 'prop');

  const touching = landmarksTouching(cx, cz);
  const hasLandmark = touching.length > 0;

  const lowDetail = !hasLandmark && density < CITY.lowDetailThreshold;
  const kind = lowDetail
    ? LOW_DETAIL_KINDS[Math.floor(rng.next() * LOW_DETAIL_KINDS.length)]
    : 'built';

  /**
   * Road surface. Three variants, and which one a stretch gets is a function of
   * position and age rather than of a die roll per chunk — a city resurfaces a
   * street at a time, not a block at a time.
   */
  const roadMaterials = [];
  {
    const age = smoothNoise(rootSeed, cxWorld, czWorld, 430, 7);
    // Distinct by construction. The first version could push 'concrete' twice
    // and report two variants where there was one — the road-variant count is an
    // assertion in citycheck, and an assertion that counts duplicates is not
    // counting what it says it is.
    const add = (m) => { if (!roadMaterials.includes(m)) roadMaterials.push(m); };
    add(age < 0.36 ? 'concrete' : 'asphalt');
    if (age > 0.5 || rng.chance(0.55)) add('patched');
    if (roadMaterials.length < 2) add(rng.chance(0.5) ? 'patched' : age < 0.36 ? 'asphalt' : 'concrete');
  }

  /**
   * Yaw. §3 — imperfect alignment. A fraction of objects get a deviation, and
   * every deviation is under `maxYawDeg`. Both bounds matter: large randomness
   * looks broken, small consistent deviation looks real.
   */
  const yaw = () => (yawRng.next() < CITY.offAxisFraction ? yawRng.gauss() * (CITY.maxYawDeg / 3) : 0);

  const buildings = [];
  const props = [];
  const signs = [];
  const occluders = [];

  // --- the buildable island ------------------------------------------------
  // Roads run along every chunk boundary, so the interior is the chunk inset by
  // the corridor half-width. Buildings line its perimeter facing the roads, with
  // the middle left over for whatever the dead-zone kind is — which is how real
  // perimeter blocks work and why they have courtyards.
  const inset = CORRIDOR;
  const island = { x0: b.x0 + inset, x1: b.x1 - inset, z0: b.z0 + inset, z1: b.z1 - inset };

  if (!lowDetail) {
    /**
     * How much of the perimeter gets built on. Read off the density field, not
     * rolled: two adjacent dense chunks are both dense, which is what makes a
     * dense district rather than a scatter of dense blocks.
     *
     * A POWER OF THE DENSITY, NOT THE DENSITY. Measured: the noise field itself
     * has a coefficient of variation of 0.302, so anything linear in it produces
     * a city that varies by a third — which is a city somebody smoothed, and it
     * failed docs/authored-city.md §1 at 0.471 against a floor of 0.6. Real
     * urban density is heavy-tailed rather than normal: a downtown block has ten
     * times what a block a kilometre out has, not one and a half times. The cube
     * of the same field measures 0.712 and looks like a city with districts.
     */
    const fill = 0.12 + 0.88 * Math.pow(density, 2.2);

    const sides = [
      { axis: 'x', at: island.z0, out: -1, from: island.x0, to: island.x1 },
      { axis: 'x', at: island.z1, out: 1, from: island.x0, to: island.x1 },
      { axis: 'z', at: island.x0, out: -1, from: island.z0, to: island.z1 },
      { axis: 'z', at: island.x1, out: 1, from: island.z0, to: island.z1 },
    ];

    for (const side of sides) {
      let t = side.from + rng.range(0, 9);
      // A run of touching buildings, then a gap, then another run. The gaps are
      // where the side alleys, the yards and the blank end walls live, and they
      // are what stops the perimeter from being one continuous extruded ring.
      //
      // EVERY PATH THROUGH THE INNER LOOP EITHER ADVANCES `t` OR ENDS THE SIDE.
      // The first version did not: with 12 to 14 m of frontage left, the outer
      // condition was still true and every draw of `width` was too wide to fit,
      // so the inner loop broke without advancing and the outer loop span
      // forever. It hung the page rather than producing a wrong city, which is
      // the good version of this mistake — but the invariant is worth stating
      // rather than re-deriving.
      while (t < side.to - 12) {
        const runLength = rng.int(1, 4);
        for (let i = 0; i < runLength && t < side.to - 12; i++) {
          const width = rng.range(11, 27);
          if (t + width > side.to) {
            t = side.to;
            break;
          }

          if (rng.next() > fill) {
            t += width + rng.range(1, 7);
            continue;
          }

          let depth = rng.range(15, 26);

          /**
           * A FRONTAGE ON A NARROW EMBANKMENT IS SHALLOW, NOT ABSENT.
           *
           * A side running along x has its body extending in z, so the river
           * takes such a building away by taking away its DEPTH. The first
           * version refused it outright, and that cost the whole of chunk row
           * −4: two buildings survived where the dry city puts forty-five, and
           * `perfcheck` measured **110 033 visible instances against a floor of
           * 115 000**. The floor caught a content system being deleted, which
           * is precisely what it is for, and the answer CONTRACT §0 rule 5
           * allows is to put the content back — not to move the floor.
           *
           * A river bank is the most valuable frontage a city has, and a narrow
           * one carries a shallow terrace: think of the buildings along a
           * Victoria Embankment or a quai. So the depth is cut to whatever land
           * lies between the lot line and the water, and the building is
           * refused only when that is under `MIN_RIVER_DEPTH`. Measured at the
           * WORST of seven stations across the building's own frontage, because
           * the bank is a curve and a frontage is a straight run — the same
           * reason the four-corner test below exists for the other two sides.
           *
           * IT RUNS BEFORE `cxb`/`czb`, WHICH ARE DERIVED FROM `depth`. Cutting
           * the depth afterwards would leave the centre where the full-depth
           * building's centre was — half a building further into the water than
           * its own footprint says — which is CONTRACT §9's table with a depth
           * and a centre.
           */
          if (side.axis === 'x') {
            const pad = RIVER.wallThickness + RIVER.promenade;
            // The forbidden band in z at this frontage, taken at its widest
            // over the building's own x span.
            let bandLo = Infinity;
            let bandHi = -Infinity;
            for (let k = 0; k <= 6; k++) {
              const e = riverEdges(t + (width * k) / 6);
              bandLo = Math.min(bandLo, e.north - pad);
              bandHi = Math.max(bandHi, e.south + pad);
            }
            // Where the body actually is: from the lot line to `depth` in the
            // direction opposite `out`, which is what `cxb`/`czb` below encode.
            const far = side.at - side.out * depth;
            const lo = Math.min(side.at, far);
            const hi = Math.max(side.at, far);
            /**
             * ONLY WHEN THE BODY ACTUALLY REACHES THE WATER, and the first
             * version of this line did not check: it computed
             * `north − pad − side.at` unconditionally, which for a frontage
             * four hundred metres from the river is a large NEGATIVE number,
             * and every building in the city was refused for being too shallow.
             * Measured before it shipped — row 0 fell from 48 buildings to 28
             * and every other row with it — which is what a whole-region count
             * printed beside the previous one is for (CONTRACT §9 rule 2).
             */
            if (hi > bandLo && lo < bandHi) {
              const limit = side.at <= bandLo ? bandLo - side.at
                : side.at >= bandHi ? side.at - bandHi
                  : -1;
              if (limit < MIN_RIVER_DEPTH) {
                t += width + rng.range(0, 3);
                continue;
              }
              depth = limit;
            }
          }

          const eraName = ERA_NAMES[weightedIndex(eraRng.next, ERA_NAMES.map((n) => CITY_ERAS[n].weight))];
          const era = CITY_ERAS[eraName];
          const floors = Math.max(3, Math.round(rng.range(12, 64) / era.floor));
          const height = floors * (era.floor + eraRng.gauss() * 0.05);

          /**
           * MINUS `out`, not plus.
           *
           * `out` is the direction the building FACES — outward, toward the
           * road. Its body therefore extends the other way, into the island. The
           * first version added it, which put every perimeter building half its
           * own depth into the carriageway: from the street the city was a
           * continuous wall with no road in it, and the first frame rendered
           * from a route's starting position was a facade pressed against the
           * lens. The same class of error as every other one in CONTRACT §9 — a
           * quantity used as though it were a different one, here a facing used
           * as an offset.
           */
          const cxb = side.axis === 'x' ? t + width / 2 : side.at - (side.out * depth) / 2;
          const czb = side.axis === 'x' ? side.at - (side.out * depth) / 2 : t + width / 2;

          if (insideKeepout(cxb, czb, 6)) {
            t += width + rng.range(0, 3);
            continue;
          }
          // A building that would stand where a landmark stands loses.
          if (touching.some((l) => landmarkBlocks(l, cxb, czb, 10))) {
            t += width + rng.range(0, 3);
            continue;
          }
          /**
           * A BUILDING THAT WOULD STAND IN THE RIVER LOSES, AND A SIDE RUNNING
           * ALONG Z IS TESTED AT ITS FOUR CORNERS RATHER THAN AT ITS CENTRE.
           *
           * The landmark test above is centre-only and gets away with it
           * because a landmark keep-out is padded by 10 m against a building
           * whose half-depth is 7.5 to 13. The river's bank is a CURVE and a
           * building is up to 27 m long, so a centre test on the bank leaves a
           * corner in the water at every station where the bank is not
           * parallel to the frontage — which is every station, because the
           * meander's slope is 6.4° at its steepest. The four corners of the
           * axis-aligned footprint bound the yawed one: `maxYawDeg` is 2.4, so
           * the yaw adds at most `sin(2.4°)·27/2` = 0.57 m, which is inside
           * `riverBlocks`' own 7.7 m of wall-plus-promenade.
           *
           * The x-axis sides were handled above, before `depth` was fixed,
           * because for them the river takes the DEPTH rather than the site.
           */
          if (side.axis !== 'x') {
            const hw = depth / 2;
            const hd = width / 2;
            let wet = false;
            for (const sx of [-1, 1]) {
              for (const sz of [-1, 1]) {
                if (riverBlocks(cxb + sx * hw, czb + sz * hd)) { wet = true; break; }
              }
              if (wet) break;
            }
            if (wet) {
              t += width + rng.range(0, 3);
              continue;
            }
          }

          const conditionIx = weightedIndex(eraRng.next, [0.42, 0.4, 0.18]);
          const material = MATERIAL_NAMES[weightedIndex(eraRng.next,
            eraName === 'contemporary' ? [0.05, 0.2, 0.65, 0.1] : [0.32, 0.28, 0.14, 0.26])];

          /**
           * Facade advertising. §"more aggressive facade advertising on a
           * minority of buildings — surfaces given over to display where
           * present-day buildings would have windows". A minority, and weighted
           * toward density, so it clusters in the busy districts rather than
           * being sprinkled evenly over the city.
           */
          const displayFacade = signRng.next() < 0.03 + density * 0.09;

          const bld = {
            x: cxb, z: czb,
            width: side.axis === 'x' ? width : depth,
            depth: side.axis === 'x' ? depth : width,
            height,
            floors,
            era: eraName,
            material,
            condition: CONDITIONS[conditionIx],
            /** Which way the front faces: outward, toward the road. */
            facing: side.axis === 'x' ? (side.out < 0 ? 'z-' : 'z+') : (side.out < 0 ? 'x-' : 'x+'),
            yawDeg: yaw(),
            displayFacade,
            /**
             * Which slice of the elevation is given over to display, as a
             * fraction of the building's floors. A real advertising facade is a
             * band — the floors above the shopfronts and below the plant — not
             * the whole building. Measured reason as well as an authored one:
             * whole-elevation displays put the night route's peak saturated-and-
             * bright fraction at 15.8% against a 12% reserve, and the reserve is
             * the one thing docs/authored-city.md is most emphatic about.
             */
            displayFrom: 0.30,
            displayTo: 0.72,
            /**
             * Cantilever, contemporary only. The upper two thirds oversail the
             * base by up to 2.4 m on the street side. It is the cheapest way to
             * make a building read as newer in FORM rather than in material,
             * which is the distinction the brief draws.
             */
            cantilever: eraName === 'contemporary' ? rng.range(1.1, 2.4) : 0,
            crown: eraName === 'contemporary' ? rng.range(0.15, 0.45) : 0,
          };
          buildings.push(bld);

          occluders.push({
            x0: cxb - bld.width / 2, x1: cxb + bld.width / 2,
            z0: czb - bld.depth / 2, z1: czb + bld.depth / 2,
            top: height,
          });

          /**
           * Signage. §2 asks for at least 15% of it non-working; condition is
           * what decides, so the dead signs cluster on the neglected buildings
           * rather than being sprinkled at random over healthy ones. That is the
           * difference between a city with wear in it and a city with noise on
           * top of it.
           */
          const signCount = signRng.next() < 0.32 + density * 0.4 ? signRng.int(1, 2) : 0;
          for (let s = 0; s < signCount; s++) {
            const deadP = { kept: 0.06, worn: 0.22, neglected: 0.52 }[bld.condition];
            const r = signRng.next();
            /**
             * Building-scale signs. §"a few building-scale signs among the
             * ordinary ones. Scale contrast, not quantity." 7% of signs, and
             * only on buildings over 30 m — a twelve-metre sign on a
             * fourteen-metre building is a shopfront with delusions.
             */
            const big = height > 30 && signRng.next() < 0.07;
            /**
             * MOUNTING, SESSION 14, AND IT IS THE AXIS THE SIGNAGE NEVER HAD.
             *
             * Session 3 gave signs a colour roll, two scales and three states,
             * and one mounting: flush against the elevation. A flat sign on a
             * wall is EDGE-ON to anyone walking down the street, which
             * `block.js` already says in a comment about its own blade signs
             * and which the generated city never acted on — so the streamed
             * city's entire signage vocabulary was invisible from the one place
             * a person stands. Four mountings now, and the weights are what a
             * street has rather than a quarter each:
             *
             *   flush        0.40  the shopfront fascia. Reads head-on.
             *   projecting   0.34  a blade out over the pavement, perpendicular
             *                      to the elevation. This is the one that reads
             *                      ALONG a street, which is how a street is
             *                      seen, and it is the largest single gain.
             *   roof         0.14  above the parapet on a mast. It is the only
             *                      mounting visible from another block, so it
             *                      is what a skyline is made of, and it is rare
             *                      for the same reason a landmark is.
             *   freestanding 0.12  a pylon on the pavement. Needs clear ground
             *                      and is refused back to `flush` where there is
             *                      none — see `city.js`, which owns the
             *                      occupancy test (CONTRACT §9.1: anything
             *                      placed procedurally is tested against what is
             *                      already there, or it is not placed).
             *
             * A BUILDING-SCALE SIGN IS NEVER A BLADE OR A PYLON. A 17 m sign
             * cantilevered off a facade is a structure nobody builds, and a 17 m
             * pylon on a pavement is not a pylon. It is flush or on the roof,
             * which is what a building-scale sign is in every city there is.
             */
            const mr = signRng.next();
            const mount = big
              ? (mr < 0.55 ? 'flush' : 'roof')
              : mr < 0.40 ? 'flush'
                : mr < 0.74 ? 'projecting'
                  : mr < 0.88 ? 'roof' : 'freestanding';
            /**
             * SIZE SPREAD, AND THE OLD ONE WAS TWO BANDS WITH A GAP.
             *
             * `shop` was 2.2–4.4 m and `building` 9–17 m with nothing between,
             * so the delivered widths were bimodal and the two modes were 2x
             * apart within themselves. A street has a continuum: a 0.9 m plate
             * over a door, a 3 m fascia, a 6 m fascia over a double frontage.
             * The shop band now runs 0.9–6.2 m on a SQUARED roll, which puts
             * the median at 0.9 + 5.3·0.25 = 2.23 m and the mean at 2.67 m —
             * small signs common, large ones rare, which is the distribution a
             * street actually has rather than a uniform one that makes every
             * frontage the same size.
             *
             * Aspect is rolled too, and it was a constant: `height` was
             * `width · 0.42` for every shop sign in the city, so a hundred
             * signs were one rectangle at a hundred sizes. 0.24–0.62 now, which
             * spans a letter-height fascia and a near-square plate.
             */
            const u = signRng.next();
            const width = big
              ? signRng.range(9, 17)
              : 0.9 + 5.3 * u * u;
            signs.push({
              x: cxb, y: big ? height * signRng.range(0.55, 0.82) : signRng.range(3.4, 7.2),
              z: czb,
              facing: bld.facing,
              scale: big ? 'building' : 'shop',
              width,
              aspect: big ? signRng.range(0.28, 0.42) : signRng.range(0.24, 0.62),
              mount,
              /** The elevation's own top, so a roof mount can stand on it. */
              buildingHeight: height,
              buildingWidth: bld.width,
              buildingDepth: bld.depth,
              /** Where along the elevation, as a fraction of its half-width. */
              along: signRng.range(-0.62, 0.62),
              state: r < deadP ? 'dead' : r < deadP + 0.1 ? 'half' : 'lit',
              chroma: signRng.int(0, 5),
              yawDeg: yaw(),
            });
          }

          t += width + (i === runLength - 1 ? rng.range(6, 26) : rng.range(0.2, 1.4));
        }
      }
    }
  }

  // --- the quayside terrace ------------------------------------------------
  //
  // A FIFTH FRONTAGE, ON A LINE THE ISLAND DOES NOT HAVE.
  //
  // The four sides above are the island's own straight edges, and they are
  // where a block faces a street. A river chunk has a fifth edge — the bank —
  // and it is the most valuable frontage in a city: the whole point of an
  // embankment is that the buildings look at the water. Without this the river
  // is a hole in the city with the city's back turned to it.
  //
  // IT IS ALSO WHAT PUTS BACK WHAT THE CUT TOOK. `perfcheck` measured 110 033
  // visible instances against a floor of 115 000 the first time the river
  // shipped: chunk row −4's island is water almost end to end, so three of its
  // four sides were refused and the row fell from about forty-five buildings to
  // two. CONTRACT §0 rule 5 says a floor is not moved to accommodate a change,
  // and the honest answer to "the city lost a row of buildings" is to build the
  // row somewhere it belongs rather than to lower the number that noticed.
  //
  // THE BANK IS A CURVE AND THESE ARE AXIS-ALIGNED BOXES, so each building is
  // set back from the WORST station across its own frontage — the same rule the
  // shallow-depth clamp above uses, and for the same reason. What that leaves
  // is a terrace whose building line steps in and out as the bank meanders,
  // which is what a real quayside is: a straight terrace on a curved river has
  // a wedge of open ground at every step, and those wedges are the little
  // riverside squares.
  if (!lowDetail && riverTouchesChunk(cx, cz)) {
    const pad = RIVER.wallThickness + RIVER.promenade;
    for (const bank of [-1, 1]) {
      // −1 is the north bank: the land is at smaller z and a building extends
      // further north, away from the water. +1 mirrors it.
      // The building line may not enter the corridor of the embankment road,
      // which is the island edge of the chunk row the bank sits in.
      const backstop = bank < 0 ? b.z0 + CORRIDOR : b.z1 - CORRIDOR;
      let t = b.x0 + rng.range(0, 11);
      while (t < b.x1 - 12) {
        const width = rng.range(11, 27);
        if (t + width > b.x1) { t = b.x1; break; }
        /**
         * A SOFTER POWER THAN THE PERIMETER'S, AND IT IS A STATEMENT ABOUT
         * LAND VALUE RATHER THAN A KNOB.
         *
         * The island perimeter uses `0.12 + 0.88·density^2.2`, derived in the
         * comment above it: the raw noise field has a coefficient of variation
         * of 0.302 and a heavy power is what turns that into districts. A
         * waterfront is the one frontage a city builds on before it builds on
         * anything else — riverside land is developed at a density the block
         * behind it has not reached yet, which is why every river in every city
         * has a continuous wall of building on it and a car park two streets
         * back. 1.6 against 2.2 is that sentence: at a density of 0.5 the
         * perimeter fills 0.31 of its frontage and the quay fills 0.41.
         */
        if (rng.next() > 0.12 + 0.88 * Math.pow(density, 1.6)) {
          t += width + rng.range(1, 9);
          continue;
        }
        // The water's edge at the worst station across this frontage.
        let edge = bank < 0 ? Infinity : -Infinity;
        for (let k = 0; k <= 6; k++) {
          const e = riverEdges(t + (width * k) / 6);
          edge = bank < 0 ? Math.min(edge, e.north) : Math.max(edge, e.south);
        }
        /**
         * THE SIGN, WRITTEN OUT, BECAUSE IT WAS WRONG ONCE AND THE FRAME DID
         * NOT SAY SO.
         *
         * `bank` is −1 on the north bank, where the land is at SMALLER z, so
         * the water-facing wall stands at `north − pad` and the body extends
         * further north; `edge + bank·pad` gives exactly that, and
         * `edge − bank·pad` — the first version — puts the wall 7.7 m INTO the
         * water and the body 9 to 24 m further in again. Measured before it
         * shipped: **40 buildings with a corner in the river, all of them
         * quayside, 16 to 29 m deep in it.** A count of footprints against
         * `inRiver` found it in one run; looking at the frame would not have,
         * because a building standing in water 5 m below it looks like a
         * building standing on a bank from every angle but one.
         */
        const face = edge + bank * pad;
        const room = bank < 0 ? face - backstop : backstop - face;
        if (room < MIN_RIVER_DEPTH) { t += width + rng.range(2, 12); continue; }
        const depth = Math.min(room, rng.range(MIN_RIVER_DEPTH, 24));
        const cxb = t + width / 2;
        const czb = face + bank * (depth / 2);
        /**
         * A BOX-AGAINST-BOX TEST, NOT A PADDED CENTRE.
         *
         * `occupied` asks whether a POINT padded by a radius is inside a
         * footprint, which is the right question for a bollard and the wrong
         * one for a 27 m building: two boxes can overlap with neither centre
         * inside the other. The first version used it and delivered three
         * overlapping pairs on the south bank, where the island's own north
         * frontage already faces the water and the terrace was laid on top of
         * it.
         */
        const bx0 = cxb - width / 2;
        const bx1 = cxb + width / 2;
        const bz0 = czb - depth / 2;
        const bz1 = czb + depth / 2;
        let clash = false;
        for (const o of occluders) {
          if (bx1 > o.x0 - 1 && bx0 < o.x1 + 1 && bz1 > o.z0 - 1 && bz0 < o.z1 + 1) { clash = true; break; }
        }
        if (clash || insideKeepout(cxb, czb, 6) ||
            touching.some((l) => landmarkBlocks(l, cxb, czb, 10))) {
          t += width + rng.range(2, 12);
          continue;
        }
        const eraName = ERA_NAMES[weightedIndex(eraRng.next, ERA_NAMES.map((n) => CITY_ERAS[n].weight))];
        const era = CITY_ERAS[eraName];
        /**
         * LOWER THAN THE CITY BEHIND IT, and it is a rule rather than a taste:
         * a 60 m slab on a 12 m-deep riverside lot is a tower on a plinth, and
         * the reason an embankment reads as an embankment is the long low
         * terrace under the skyline behind it. 8–34 m against the generator's
         * own 12–64.
         */
        const floors = Math.max(3, Math.round(rng.range(8, 34) / era.floor));
        const height = floors * (era.floor + eraRng.gauss() * 0.05);
        const material = MATERIAL_NAMES[weightedIndex(eraRng.next,
          eraName === 'contemporary' ? [0.05, 0.2, 0.65, 0.1] : [0.32, 0.28, 0.14, 0.26])];
        const bld = {
          x: cxb, z: czb, width, depth, height, floors,
          era: eraName,
          material,
          condition: CONDITIONS[weightedIndex(eraRng.next, [0.42, 0.4, 0.18])],
          /** It faces the water: +z on the north bank, −z on the south. */
          facing: bank < 0 ? 'z+' : 'z-',
          yawDeg: yaw(),
          displayFacade: signRng.next() < 0.03 + density * 0.09,
          displayFrom: 0.30,
          displayTo: 0.72,
          cantilever: eraName === 'contemporary' ? rng.range(1.1, 2.4) : 0,
          crown: eraName === 'contemporary' ? rng.range(0.15, 0.45) : 0,
          /** So a reader of the placement data can see which walk placed it. */
          quayside: true,
        };
        buildings.push(bld);
        occluders.push({
          x0: cxb - width / 2, x1: cxb + width / 2,
          z0: czb - depth / 2, z1: czb + depth / 2,
          top: height,
        });
        const signCount = signRng.next() < 0.32 + density * 0.4 ? signRng.int(1, 2) : 0;
        for (let s = 0; s < signCount; s++) {
          const deadP = { kept: 0.06, worn: 0.22, neglected: 0.52 }[bld.condition];
          const r = signRng.next();
          const mr = signRng.next();
          const u = signRng.next();
          signs.push({
            x: cxb, y: signRng.range(3.4, 7.2), z: czb,
            facing: bld.facing,
            scale: 'shop',
            width: 0.9 + 5.3 * u * u,
            aspect: signRng.range(0.24, 0.62),
            mount: mr < 0.40 ? 'flush' : mr < 0.74 ? 'projecting' : mr < 0.88 ? 'roof' : 'freestanding',
            buildingHeight: height,
            buildingWidth: width,
            buildingDepth: depth,
            along: signRng.range(-0.62, 0.62),
            state: r < deadP ? 'dead' : r < deadP + 0.1 ? 'half' : 'lit',
            chroma: signRng.int(0, 5),
            yawDeg: yaw(),
          });
        }
        t += width + rng.range(0.2, 6);
      }
    }
  }

  // --- street furniture and dead-zone contents -----------------------------
  //
  // Counted as "props" by the clumping check, and the count is what the
  // coefficient of variation is computed from. It follows density directly, so
  // the CV of the placement is the CV of the noise field and not of a die.

  // Same power law as the building fill, and for the same measured reason. No
  // constant term: a chunk with nothing in it is what negative space IS, and a
  // floor of "at least three bollards everywhere" is what makes a generated city
  // read as evenly-populated no matter how the buildings are placed.
  //
  // 58 → 96 THIS SESSION, AND IT IS THE ONE DENSITY THIS CHANGE MOVES. The
  // arithmetic, because a count without one is a guess (§9 rule 5): a chunk
  // draws four pavement bands of 441 m in total, and at 58 with 71% of them
  // kerbside that is one street object every 65.7 m. A real street has one
  // every 15 to 25. 96 gives 39.7 m, which is still under-furnished and is
  // where this stops — the count is deliberately left short of a real street
  // rather than run past it, because the operator's read of the film was that
  // the DENSITY looked good and this change is about variation. What was wrong
  // was not how many there were, it was that none of them was on a street: the
  // scatter ran over the chunk INTERIOR and the interior is behind the
  // buildings. Moving them is worth more than multiplying them, and the
  // multiplier is the smaller half of this line.
  //
  // A PARK IS THE ONE KIND WITH A CONSTANT TERM, and it is the exception the
  // paragraph above argues against, so it needs its own argument. A dead zone
  // is low-detail BECAUSE its surroundings are empty — `density < 0.34` is what
  // put it there — so `26 · density³` gives it one prop, and one tree is not a
  // park, it is a field with a tree in it. Planting is what a park IS rather
  // than what happens to have accumulated on it, so its count is authored:
  // 22 plus a density term, which over the 104.6 m island is one object every
  // 22 m, the spacing of an avenue of street trees.
  //
  // IT COSTS CLUMPING AND THE TRADE IS MEASURED RATHER THAN ASSERTED, because
  // filling a low-density chunk is exactly what a coefficient of variation
  // punishes. Over `city-budget.json`'s own region, planting the three parks in
  // it against a floor of 0.60:
  //
  //     park planting   0        8+10d    12+14d   16+20d   22+26d
  //     objectCount CV  0.6912   0.6669   0.6584   0.6511   0.6456
  //
  // So the whole park contribution is 0.046 of CV and the delivered margin is
  // 0.0456 — 7.6% clear, and deterministic in the seed rather than noisy, so it
  // is a verdict and not a coin. The sweep is here so the next session can see
  // what it is spending before it plants anything else.
  const propCount = kind === 'park'
    ? Math.round(22 + 26 * density)
    : Math.round((lowDetail ? 26 : 96) * Math.pow(density, 3));

  /**
   * THE OCCUPANCY TEST, SESSION 4b. CONTRACT §9.1:
   *
   *   > Anything placed procedurally is tested against the existing occupancy,
   *   > or it is not placed.
   *
   * Until this session the scatter tested the origin-block keep-out and the
   * landmark keep-outs and NOT the perimeter buildings it sits inside — and the
   * perimeter buildings occupy 15 to 26 m of the island on every side.
   * Measured: 146 of 838 props, 17.4%, standing inside a wall. Second placement
   * routine in two sessions with the same omission, which is why §9.1 now
   * carries it as a rule rather than as an incident.
   *
   * `occluders` at this point holds EXACTLY this chunk's building footprints:
   * it is filled inside the perimeter walk above, and the landmark boxes are
   * appended two statements below. That is also precisely the set `citycheck`
   * reconstructs with `.filter(o => o.landmark == null)`, so the gate and the
   * generator are testing the same thing. (CONTRACT §9.1 and session 4a's STATE
   * both say "three lines above the scatter"; the array is DECLARED near the
   * top and FILLED in the building loop. The operative fact is what it holds
   * here, not where it was written.)
   *
   * REJECTION SAMPLING RATHER THAN `continue`, AND THE REASON IS A DIFFERENT
   * GATE. `objectCount` is buildings + props + signs, and it is what
   * `citycheck`'s clumping CV and its 0.55 populated fraction are computed
   * from. Dropping 17.4% of props on the floor would move both — a placement
   * fix silently perturbing a distribution assertion, which is the kind of
   * coupling that gets discovered two sessions later. Retrying keeps the count
   * the generator asked for; a prop that cannot find a home in 8 tries is in a
   * chunk that is nearly all building, and giving up there is correct rather
   * than lucky.
   *
   * THE PAD IS THE PROP'S OWN HALF-WIDTH, NOT A CONSTANT. The gate's test is
   * centre-only, so pad 0 would clear it while leaving a 3.4 m tree with 1.7 m
   * of itself inside a wall. `PROP_HALF_WIDTH` is the single authority for that
   * number and `city.js` builds its boxes from the same table.
   */
  /**
   * KERBSIDE PLACEMENT, AND WHY IT IS NOT A POLISH ITEM.
   *
   * The scatter above ran over `island` — the whole chunk INTERIOR — and the
   * perimeter buildings stand on that interior's edge, so a prop placed
   * uniformly over it lands in a COURTYARD far more often than on a street.
   * Measured on the delivered city before this change: the island is
   * 104.6 × 104.6 m and the pavements are outside it entirely, so the fraction
   * of props a person walking the street could see was ZERO except where a
   * perimeter run had a gap. Nine kinds of street furniture, none of it on a
   * street. That is not a variation problem and no number of models fixes it,
   * which is why this sits in the same change as the models.
   *
   * A chunk owns the road on its west edge and the one on its north edge, and
   * `buildGround` draws the pavement on BOTH sides of each — so there are four
   * bands, and each is furnished by the chunk that draws it. Furnishing only
   * the two on this chunk's own side would leave every road with one bare
   * pavement, because the chunk across the road owns a different road.
   *
   * The offset from the centreline puts the prop's outer face `KERB_GAP_M`
   * inside the kerb, and the placement is REFUSED — falling back to the
   * interior — when the far face would reach within `WALK_CLEAR_M` of the
   * pedestrian lane centre. Both are lengths with the same authority as the
   * pavement's own: `CITY.roadHalfWidth` 7.5, `CORRIDOR` 11.7, and
   * `streetlife`'s lane centre is the midpoint at 9.6, which leaves 2.1 m of
   * kerbside strip to work in.
   */
  const KERB_GAP_M = 0.35;
  const WALK_CLEAR_M = 0.45;
  const LANE_CENTRE_M = (CITY.roadHalfWidth + CORRIDOR) / 2;
  /**
   * The four pavement lines this chunk draws, as (fixed axis value, the axis
   * the band runs along, the outward sign). `t` runs along the band.
   */
  const kerbBands = [
    { axis: 'x', at: b.x0, side: +1, t0: b.z0 + CORRIDOR + 3, t1: b.z1 - 3 },
    { axis: 'x', at: b.x0, side: -1, t0: b.z0 + CORRIDOR + 3, t1: b.z1 - 3 },
    { axis: 'z', at: b.z0, side: +1, t0: b.x0 + CORRIDOR + 3, t1: b.x1 - 3 },
    { axis: 'z', at: b.z0, side: -1, t0: b.x0 + CORRIDOR + 3, t1: b.x1 - 3 },
  ];
  /**
   * TWO MORE BANDS ON A RIVER CHUNK: THE PROMENADE, ON BOTH SIDES.
   *
   * A quayside with nothing on it is the same defect the whole city had before
   * session 14's kerbside placement — nine kinds of street furniture, none of
   * it on a street — with a promenade instead of a pavement. It is also the one
   * band in the city that is a DESTINATION rather than a route, so it should be
   * better furnished than an ordinary kerb rather than worse.
   *
   * The band FOLLOWS THE BANK, which none of the four above do: `at` is a
   * function of the along coordinate rather than a constant, so the placement
   * loop asks `riverEdges` for it at the station it drew. That is why `bank`
   * is a separate field and not a fifth value of `axis` — an axis-aligned band
   * and a curved one are two different things and one field meaning both is
   * how a generator ends up with a bollard in the water.
   */
  if (!lowDetail && riverTouchesChunk(cx, cz)) {
    kerbBands.push({ bank: -1, t0: b.x0 + 3, t1: b.x1 - 3 });
    kerbBands.push({ bank: +1, t0: b.x0 + 3, t1: b.x1 - 3 });
  }
  /** Kerbside props already placed, for the min-spacing test between them. */
  const kerbPlaced = [];
  const KERB_SPACING_M = 3.2;

  const PROP_TRIES = 8;
  let propGaveUp = 0;
  let propsKerbside = 0;
  for (let i = 0; i < propCount; i++) {
    const propKind = lowDetail
      ? propRng.pick(kind === 'park' ? ['tree', 'bench', 'planter', 'bin'] : kind === 'parking' ? ['bollard', 'lamppost', 'planter'] : ['container', 'fence', 'bollard'])
      /**
       * `hydrant` and `bench` added to the built list this session. A bench on
       * an ordinary pavement is the commonest street object there is and it
       * existed only inside a park; a hydrant is the commonest small one and
       * did not exist at all. Both were absent because the list was written
       * before there was anything to draw them with.
       */
      : propRng.pick(['bollard', 'planter', 'bin', 'cabinet', 'tree', 'bench', 'hydrant']);
    const scale = propRng.range(0.85, 1.25);
    const pad = propHalfWidth(propKind) * scale;

    /**
     * Kerbside if it fits and if the die says so. The die is drawn for EVERY
     * prop, before the fit test, so the random sequence does not depend on
     * which kind came up — the same discipline the spread axes below follow.
     */
    const wantKerb = propRng.next() < 0.82;
    const across = propHalfAcross(propKind) * scale;
    const offset = CITY.roadHalfWidth + KERB_GAP_M + across;
    const fitsKerb = offset + across <= LANE_CENTRE_M - WALK_CLEAR_M;

    let x = 0;
    let z = 0;
    let placed = false;
    let kerb = false;
    let kerbYaw = 0;

    if (wantKerb && fitsKerb && !lowDetail) {
      for (let t = 0; t < PROP_TRIES && !placed; t++) {
        const band = kerbBands[propRng.int(0, kerbBands.length - 1)];
        if (band.t1 <= band.t0) continue;
        const along = propRng.range(band.t0, band.t1);
        if (band.bank) {
          /**
           * The promenade band. The prop stands behind the quay wall with its
           * outer face `KERB_GAP_M` clear of the coping, which is the same
           * relation to the wall that an ordinary kerbside prop has to the
           * kerb — one length, two uses, rather than a second gap constant.
           *
           * `fitsKerb` above was computed against the ROAD's clearance and is
           * the wrong bound here: what a promenade prop has to fit inside is
           * `RIVER.promenade`, and this band is skipped rather than squeezed
           * when it does not.
           */
          if (RIVER.wallThickness + KERB_GAP_M + 2 * across > RIVER.wallThickness + RIVER.promenade) continue;
          const e = riverEdges(along);
          const edge = band.bank < 0 ? e.north : e.south;
          x = along;
          z = edge + band.bank * (RIVER.wallThickness + KERB_GAP_M + across);
        } else if (band.axis === 'x') {
          x = band.at + band.side * offset;
          z = along;
        } else {
          x = along;
          z = band.at + band.side * offset;
        }
        if (insideKeepout(x, z, 2)) continue;
        if (touching.some((l) => landmarkBlocks(l, x, z, 3))) continue;
        // The river takes the kerb as well as the island: a bollard on the
        // quayside band of a road that no longer exists is a bollard in the
        // water. Tested with the prop's own pad, exactly as the island scatter
        // below does (§9.1 — tested against the existing occupancy, or not
        // placed).
        if (riverBlocks(x, z, pad)) continue;
        /**
         * AND AGAINST THE BUILDINGS, which this branch did not test until
         * session 15 and got away with because the kerb bands lie on the road
         * and every building lay on the island — 11.7 m from the boundary
         * against the kerb's 9.5. The quayside terrace is the first frontage
         * in this generator that is not on an island edge, so the guarantee
         * that used to come from the lattice now has to come from the test.
         * Measured when it was missing: 3 of 1 586 props inside a building,
         * and `citycheck` said so in the first run after the terrace landed.
         */
        if (occupied(occluders, x, z, pad)) continue;
        let clash = false;
        for (const q of kerbPlaced) {
          if ((q.x - x) ** 2 + (q.z - z) ** 2 < KERB_SPACING_M * KERB_SPACING_M) { clash = true; break; }
        }
        if (clash) continue;
        // The model's long axis is its local x, so a bench, a fence and a wide
        // cabinet all lie ALONG the kerb rather than across it. The jitter is
        // §3's own, not a new number.
        /**
         * The model's long axis is its local x, so a bench, a fence and a wide
         * cabinet all lie ALONG the kerb rather than across it. On a promenade
         * band the kerb is a curve, so the yaw is the BANK'S OWN TANGENT,
         * differentiated over 8 m — the same derivation `river.js` uses for its
         * wall segments (`atan2(−dz, dx)` takes a box's +X onto the chord) and
         * the same one `city.js` uses for the viaduct's deck. Three copies of
         * one formula is what CONTRACT §9.1 warns about, and the reason there
         * are three is that no two of these files may import each other.
         */
        if (band.bank) {
          const e0 = riverEdges(along - 4);
          const e1 = riverEdges(along + 4);
          const dz = (band.bank < 0 ? e1.north - e0.north : e1.south - e0.south);
          kerbYaw = (-Math.atan2(dz, 8) * 180) / Math.PI + yaw();
        } else {
          kerbYaw = (band.axis === 'x' ? 0 : 90) + yaw();
        }
        kerb = true;
        placed = true;
      }
    }

    if (!placed) {
      for (let t = 0; t < PROP_TRIES; t++) {
        x = propRng.range(island.x0 + 2, island.x1 - 2);
        z = propRng.range(island.z0 + 2, island.z1 - 2);
        if (insideKeepout(x, z, 2)) continue;
        if (touching.some((l) => landmarkBlocks(l, x, z, 3))) continue;
        if (riverBlocks(x, z, pad)) continue;
        if (occupied(occluders, x, z, pad)) continue;
        placed = true;
        break;
      }
    }
    if (!placed) {
      propGaveUp++;
      continue;
    }
    if (kerb) {
      kerbPlaced.push({ x, z });
      propsKerbside++;
    }
    /**
     * The four spread axes, all drawn from `propRng` so they are deterministic
     * in (rootSeed, cx, cz) alone and a chunk that streams out and back looks
     * the same (CONTRACT §8.1).
     *
     * `soil` MULTIPLIES DOWN ONLY. A signed colour jitter used as a soiling
     * term is §9 row 14 — the one that rendered stucco as concrete — and the
     * distinction is that weather removes reflectance and never adds it.
     *
     * `leanDeg` is signed about a seeded azimuth, and it is drawn for every
     * prop rather than only for trees so the sequence does not depend on which
     * kind came up. A kind whose variant declares no `leanRange` ignores it.
     */
    const variants = propVariantCount(propKind);
    props.push({
      x,
      z,
      yawDeg: kerb ? kerbYaw : yaw(),
      kerb,
      kind: propKind,
      scale,
      variant: variants > 0 ? propRng.int(0, variants - 1) : 0,
      soil: propRng.range(0.62, 1.0),
      lean: propRng.range(-1, 1),
      leanAzDeg: propRng.range(0, 360),
    });
  }

  for (const l of touching) {
    for (const o of landmarkOccluders(l)) occluders.push(o);
  }

  /**
   * The river's own occluders, appended AFTER the prop scatter has run, for
   * the same reason the landmarks' are: the `occupied(occluders, ...)` call above must see
   * this chunk's building footprints and nothing else, and `citycheck`
   * reconstructs exactly that set with `.filter(o => o.landmark == null)`. A
   * bridge deck in that array would make the gate and the generator disagree
   * about what a prop was tested against — which is the arrangement CONTRACT
   * §9.1 is a list of. `river` labels them for the same reason `landmark` does.
   */
  const riverBoxes = riverOccluders(rootSeed, cx, cz);
  for (const o of riverBoxes) occluders.push(o);

  return {
    cx, cz, density, lowDetail, kind,
    roadMaterials,
    buildings, props, signs, occluders,
    /**
     * Whether the river's envelope reaches this chunk at all, so `city.js` can
     * skip the whole river path on the 98% of chunks that never see water
     * without recomputing the envelope test in four places.
     */
    river: riverTouchesChunk(cx, cz),
    landmarks: touching.map((l) => l.name),
    objectCount: buildings.length + props.length + signs.length,
    /**
     * Props the scatter asked for and could not place in `PROP_TRIES` tries.
     * Reported rather than swallowed: a bounded retry is a cap, and a cap
     * nobody prints reads as "everything fitted". `citycheck` sums it over the
     * region and prints it beside the delivered count.
     */
    propsAsked: propCount,
    propsGaveUp: propGaveUp,
    /**
     * How many of the placed props stand on a pavement rather than in a
     * courtyard. Reported for the same reason `propsGaveUp` is: before this
     * session the answer was zero and nothing said so, because nothing asked.
     */
    propsKerbside,
  };
}

/**
 * Occluders for a bake of chunk (cx, cz): its own plus the eight around it.
 *
 * A chunk's field depends only on what its horizon march can hit, and that march
 * reaches `fieldMargin` past the chunk's own square — so the neighbours have to
 * be generated too. They are generated, not looked up, precisely because
 * generation is order-independent: the worker can do this without knowing or
 * caring which chunks the main thread happens to hold.
 */
export function bakeOccluders(rootSeed, cx, cz, extraOccluders = []) {
  const out = [];
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (const o of generateChunk(rootSeed, cx + dx, cz + dz).occluders) out.push(o);
    }
  }
  for (const o of extraOccluders) out.push(o);
  return out;
}
