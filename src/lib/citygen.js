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
import { createRegistry, claimBox, claimAt, SURFACE_TOP_M } from './occupancy.js';

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
   * THE CROSSING, AND IT HAS FOUR READERS — session 33, LOOK.md §4. It is here
   * for the same reason `stopLineFromJunctionM` is: `citygen.js` paints it,
   * `streetlife.js` walks people down it, `traffic.js` measures conflicts
   * against it, and none of the three may import either of the others.
   *
   * BOTH NUMBERS ARE FORCED, NOT CHOSEN. A crossing has to be clear of the
   * carriageway it does NOT cross, or it is painted in the junction box where
   * the green axis is driving; and it has to be inside the line the vehicles
   * stop at, or the vehicles it protects people from are entitled to stand on
   * it. That is
   *
   *     near edge >= roadHalfWidth           = 7.50
   *     far edge  <= stopLine - stopBarW / 2 = 9.00 - 0.20 = 8.80
   *
   * — a band of exactly 1.30 m. At the 0.05 m clearance this project's pavement
   * budget uses at every join, the depth is 1.20 m and the centreline is
   * 7.50 + 0.05 + 0.60 = 8.15.
   *
   * IT IS SHALLOW AND THAT IS A CONSEQUENCE RATHER THAN A PREFERENCE. A zebra
   * gets 2.4 m in the world. 1.20 m is what 7.50, 9.00 and 0.40 leave between
   * them, and the only way to widen it is to move the stop line — which is
   * `minStopLineM`'s own subject and not something to move in passing.
   */
  crossingDepthM: 1.20,
  crossingFromJunctionM: 7.5 + 0.05 + 1.20 / 2,

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
   * Chunks whose STREET LAMPS are built. Two rings, and the number is now
   * about the lamps alone — see `groundRadius` below, which took the road
   * surface off it in session 31.
   *
   * The bound that holds it at 2 is a DRAW CALL one and it is still live: a
   * lamp chunk emits two `InstancedMesh`es (`:lamps` and `:bowls`), so ring 2
   * is 25 chunks paying 50 draws and ring 4 would be 81 chunks paying 162 —
   * **+112 against a `ceilings.drawCalls` of 440 that `highway_speed` measures
   * 434 of.** That is the reason this number cannot simply be raised, and it
   * is why the ground got its own.
   *
   * It is here, beside the other radii, because `city.js` needs it in TWO
   * places — once to decide what to build and once to decide whether what was
   * built is still right — and a threshold that lived in only the first of
   * those is why the city had no roads. See `city.js` → `update()`.
   */
  nearRadius: 2,

  /**
   * Chunks whose ROAD SURFACE is drawn — the carriageway, the pavement and, on
   * a park block, the grass. SESSION 31, AND IT IS A SPLIT RATHER THAN A NEW
   * IDEA: this was `nearRadius` until the operator reported that "the pavement
   * runs along a block and then simply stops against raw ground".
   *
   * IT IS NOT THE BUILDINGS. Measured over 289 chunks, every one of them emits
   * pavement rectangles — all 66 lowDetail chunks and all 74 with zero
   * buildings included — because the `ground` block in `generateChunk` sits
   * ABOVE its `if (!lowDetail)`. What ends the pavement is residency, and at
   * `nearRadius` = 2 it ended **256.0 to 395.7 m** from the camera, on a box
   * that moves with it. Walked along one street: pavement from x = 264 to
   * 383.9, then earth from x = 384.0 = (2+1)·128, for ever.
   *
   * THE OLD JUSTIFICATION WAS TRUE AND IS NOT ANY MORE, WHICH IS WHY IT MOVED.
   * The comment here read *"it was costing a draw call a chunk across a hundred
   * and twenty of them"*. That was the arrangement when each chunk carried its
   * own ground mesh; `rebuildGroundMesh` now concatenates every resident
   * chunk's ground into ONE `city:ground` mesh with one material, so the whole
   * ring is **one draw call at any radius**. CONTRACT §9's shape with a
   * justification instead of a value — a number derived correctly for an
   * arrangement that was later replaced, still load-bearing afterwards.
   *
   * SO WHAT DOES IT COST? Triangles and bytes, both measured by walking the
   * generator over the annuli rather than by scaling a per-chunk mean (which
   * over-stated by 18%, because the near ring at the origin contains
   * `BLOCK_KEEPOUT` and is not a typical chunk):
   *
   *     ring <= 2   25 chunks    185 rects    370 tris    39 960 B
   *     ring <= 4   81 chunks    536 rects   1072 tris   115 776 B
   *     delta                   +351 rects   +702 tris   +75 816 B
   *
   * +702 triangles against `ceilings.triangles` 2 000 000 with `highway_speed`
   * at 1.40M, and +0.076 MB against `ceilings.chunkMemoryMB` 96. Both are
   * noise; the draw call, which is the only tight budget in this project, does
   * not move at all.
   *
   * ~~WHY 4 AND NOT MORE. `detailRadius` is 4 and the predicate is
   * `detail && ring <= groundRadius`, so 4 is where this stops binding — a
   * larger value here would be a number the code cannot read, which is §9.1's
   * own subject.~~ It moves the pavement's end from 256–395.7 m to
   * **512.0–651.7 m**.
   *
   * **5 SINCE SESSION 42 (2026-08-25), AND THE `detail &&` WENT WITH IT.**
   * The sentence above was right about the code and wrong about which half to
   * change: the coupling was the defect, not the number. `city.js`'s own header
   * has said since it was written that the geometry ring draws *"massing only —
   * the building boxes AND THE ROAD SURFACE"*, and it drew the boxes. So a ring
   * of city 128 m wide stood on the world's earth plane, with no carriageway,
   * no pavement and no courtyard under any of it.
   *
   * WHAT THAT WAS WORTH, from `tools/bareprobe.mjs --why --camera=0,0
   * --radius=7`, which attributes every square metre of an aerial's ground to
   * one owner: **48.39 ha — 21.3% of all the ground a 950 m frame can see —
   * was bare BECAUSE A BUILDING WAS DRAWN THERE AND ITS GROUND WAS NOT.** It is
   * the operator's *"a surface that reads as a road but does not look like one:
   * wide, pale, no markings, no kerbs"*, and it is not a road at all: it is
   * `block.js`'s earth plane, whose albedo (0.069 linear) is 84% of asphalt's
   * (0.082), lying exactly where the carriageway belongs.
   *
   * THE COST, by the same annulus walk as the table above:
   *
   *     ring <= 4   81 chunks   2411 rects   4822 tris   520 776 B
   *     ring <= 5  121 chunks   3459 rects   6918 tris   747 144 B
   *     delta      +40 chunks  +1048 rects  +2096 tris  +226 368 B = 0.216 MiB
   *
   * +2 096 triangles against `ceilings.triangles` 2 000 000 with
   * `highway_speed` at 1.40M, and +0.216 MiB against `ceilings.chunkMemoryMB`
   * 96. **Zero draw calls, at any radius**, for the reason the paragraph above
   * this one gives: `rebuildGroundMesh` concatenates every resident chunk's
   * ground into one `city:ground` mesh.
   *
   * It is now `geometryRadius`'s equal and not its own free number, which is
   * the honest bound: ground exists exactly where a building can be drawn
   * standing on it. Past that ring nothing is drawn at all and the earth plane
   * is the correct answer rather than a gap.
   *
   * WHAT IT DOES NOT FIX, STATED SO NOBODY READS MORE INTO IT: the pavement
   * still ENDS, 256 m further out, and it still ends as a zero-thickness slab.
   * `buildGround` emits horizontal quads only — one `quad()` per rectangle, six
   * vertices at one y with normal (0,1,0) — so the streamed city contains no
   * vertical ground face anywhere, not at the termination and not along any
   * kerb line. The only real kerb geometry in this world is `block.js`'s, inside
   * `BLOCK_KEEPOUT`. The step at the termination is `GROUND.pavement` 0.160 −
   * `GROUND.earth` (−0.020) = **0.180 m**, which is under `PLAYER.stepUpM` 0.20
   * so it is a visual defect and not a collision one.
   */
  groundRadius: 5,

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
 * ═══════════════════════════════════════════════════════════════════════════
 * GROUND-FLOOR RETAIL — A PROPERTY OF THE STREET, NOT OF THE DECADE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * SESSION 28. THE MODELLING ERROR IT CORRECTS: `CITY_ERAS[*].ground` decides
 * both what a ground floor LOOKS like and whether it is LIT, and those are two
 * independent facts. The architecture is a property of when the building went
 * up; the commerce is a property of the street it stands on. A postwar block on
 * a shopping street has shops in its plinth — that is how cities work — and
 * this generator could not express it.
 *
 * WHAT THE MEASUREMENT SAID BEFORE ANYTHING WAS BUILT, and it corrects the
 * brief in both directions. Over the gate's own 10x10 region, 366 buildings:
 *
 *     era           share    ground        lit?
 *     postwar       30.6%    blankPlinth   no
 *     infill+contemp 27.6%    recessed      YES
 *     prewar        23.0%    shopfront     YES
 *     corporate     18.9%    colonnade     no
 *
 * TWO of the four treatments are lit, not one: `buildGroundFloor`'s `recessed`
 * case falls through to the glazed-bay branch and emits the same emissive bays
 * the shopfront does, then puts a soffit over them. So **50.5% of buildings
 * already present a lit ground floor**, not the one-in-five the brief expected.
 * The lever is real and it is half the size it was thought to be.
 *
 * THE ROLL IS PER FRONTAGE AND NOT PER BUILDING, AND THAT IS THE WHOLE DESIGN.
 * A per-building roll delivers salt and pepper: every street half-lit, no
 * street dark, no street bright. Real cities have SHOPPING STREETS — a run of
 * frontage given over to trade, and around the corner a residential terrace
 * with nothing at street level. The operator's complaint is literally that
 * shape: *"a whole street frontage with almost nothing lit on it"*. A model
 * that cannot produce a dark frontage also cannot produce a bright one.
 *
 * So each SIDE of each chunk's island rolls once, and the buildings on it
 * inherit it. What survives outside a retail frontage is the CORNER SHOP,
 * which is the one retail use a quiet street really does carry.
 */
export const RETAIL = {
  /**
   * Probability that a frontage is a retail frontage at all, as
   * `base + density * slope`, and BOTH NUMBERS ARE BOUNDED RATHER THAN CHOSEN.
   *
   * The density weighting is the same shape `displayFacade` uses twenty lines
   * from here (`0.03 + density * 0.09`) and the shopfront signage roll uses
   * (`0.32 + density * 0.40`): trade clusters where people are, so a downtown
   * frontage is far more likely to be shops than one a kilometre out.
   *
   * THE FLOOR IS "DO NOT DELIVER LESS LIGHT THAN THE MODEL BEING REPLACED".
   * The era-coupled version lit `shopfront` and `recessed`, which is **50.5%**
   * of the 366 buildings over the gate's region. A decoupling that delivered
   * fewer lit ground floors would be a content reduction wearing a modelling
   * repair's clothes, which is CONTRACT §0 rule 5's shape. Delivered here:
   * **62.8%**.
   *
   * THE CEILING IS NOT THE LIGHT BUDGET, AND THAT IS MEASURED RATHER THAN
   * ASSUMED. An arm at ~73% moved `citycheck`'s bright reserve 4.95% -> 5.00%
   * and `lookcheck`'s band:midnight 0.1091 -> 0.1091 — both inside their own
   * run-to-run spread. Ground-floor bays are 192 instances against 40 386
   * delivered windows and they are mid-tone rather than bright, so this roll
   * cannot reach either bound in any setting. The ceiling is therefore
   * ARCHITECTURAL: a city in which every frontage trades has no quiet streets,
   * and a model that cannot produce a dark frontage cannot produce a bright
   * one either. At these numbers the quietest frontage in the region (density
   * 0.30) is dark 42% of the time and the busiest (0.72) always trades, which
   * is what a real core does.
   *
   * The density over the delivered buildings runs 0.300 to 0.722, median
   * 0.584 — so `base` is the probability at the region's QUIETEST frontage and
   * `base + slope` saturates a little before its busiest.
   */
  frontageBase: 0.35,
  frontageDensity: 0.75,
  /**
   * Within a retail frontage, the share of buildings that actually trade. Not
   * 1.0: a shopping street still has a bank, a stair to the flats above and an
   * office entrance, and a solid run of identical glazing reads as one long
   * lit ribbon rather than as separate businesses — which is the same finding
   * `block.js`'s four shop materials were authored against.
   */
  inFrontage: 0.82,
  /**
   * Outside one, the corner shop. Applied only to a building at the END of a
   * frontage run, where the cross street is — the classic retail position and
   * the reason a corner site is worth more than the plot next to it.
   */
  corner: 0.30,
  /**
   * Metres from the end of a side within which a building counts as a corner.
   * The lattice's own carriageway half-width plus a pavement — i.e. a building
   * whose frontage actually reaches the junction rather than one merely near it.
   */
  cornerM: 14.0,
  /**
   * The quayside terrace. Lower than a street frontage and deliberately so: a
   * promenade carries cafés and chandlers rather than a shopping parade, and
   * the quay walk is already the most-lit edge in the city.
   */
  quay: 0.22,
};

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE ADVERTISING PILLARS — SESSION 28, item 3, and the first new prop kind in
 * several sessions.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A freestanding emissive column on the pavement. The brief asked for
 * "futuristic", and futuristic here means THE LIGHT DOES THE WORK: this city is
 * flat-shaded boxes and the vocabulary holds. Five boxes — a base wider than
 * the column, the column, two emissive faces and a brow — and the emission
 * carries it.
 *
 * IT IS AWARE OF THE RETAIL ROLL RATHER THAN FIRING BLINDLY, which is the
 * brief's own requirement and is also what makes it read: a dark postwar sockel
 * with a lit pillar in front of it is better than the same sockel wearing
 * shopfronts it should not have. So a frontage with NO trade is where a pillar
 * most wants to stand, and one WITH trade still gets some — an advertising
 * column stands on any busy pavement, and a street of shops is the busiest
 * there is.
 */
/**
 * SESSION 30, ITEM 4 — THE BUS STOP.
 *
 * A SHELTER, A POLE WITH A FLAG, A BENCH AND A LIT TIMETABLE PANEL, and the
 * dimensions are a real one: a 4.0 x 1.35 m cantilever shelter is the common
 * UK/EU footprint, its roof is at 2.45 m so it clears `HEAD_CLEAR_M` = 2.10 by
 * 0.35 m, and the flag sits at 2.90 m where it is read from a moving bus.
 *
 * THE CLAIM IS THE ROOF AND NOT THE POSTS, which is the brief's own
 * requirement and session 24's finding is the reason: a claim taken off the
 * thing that touches the ground recorded a 2.4 x 0.06 m hoarding panel as a
 * 2.4 x 2.4 m square. A shelter roof OVERHANGS its posts — that is what a
 * cantilever shelter is — so what a person cannot walk through is the roof's
 * footprint, and the roof is what is claimed. Both numbers are here so the two
 * cannot drift.
 */
export const BUS_STOP = {
  /** p(this chunk has one). See `busStop` in the chunk return for the interval. */
  perChunkP: 0.5,
  /** Metres along the kerb from the chunk's own junction. Derived there. */
  beforeJunctionM: 22.0,
  /** The roof: along the kerb, and out from the building line. WHAT IS CLAIMED. */
  roofAlongM: 4.00,
  roofDeepM: 1.35,
  roofThickM: 0.12,
  roofY: 2.45,
  /** The posts, which are NOT what is claimed. */
  postM: 0.09,
  /** The back panel — glazed, and the thing the timetable is lit against. */
  backThickM: 0.06,
  backTopY: 2.30,
  backBottomY: 0.35,
  /** The bench inside it. */
  benchAlongM: 2.20,
  benchDeepM: 0.42,
  benchY: 0.46,
  /** The pole and its flag, at the downstream end of the shelter. */
  poleM: 0.08,
  flagY: 2.90,
  flagAlongM: 0.62,
  flagDeepM: 0.05,
  /** The lit timetable panel, inside the back, at reading height. */
  panelAlongM: 0.72,
  panelH: 1.05,
  panelY: 1.42,
  /**
   * cd/m². A backlit timetable case is a fluorescent box behind diffusing
   * acrylic — brighter than a domestic window and far below a neon tube. It
   * rides in the chunk's EXISTING window mesh at a tint of
   * `BUS_STOP.panelNits / LIGHT.windowNits`, exactly as the advertising
   * pillar's face does, so it costs no draw call and the delivered radiance is
   * named in the expression (§9 rule 1) rather than hidden in a multiplier.
   */
  panelNits: 420,
  /** The gap between the shelter's road-side face and the kerb line. */
  kerbGapM: 0.40,
};

export const AD_PILLAR = {
  /**
   * p(pillar) at a frontage with NO shops, before the density term — and it is
   * 1.0 at any density this generator produces, which is the brief's own
   * instruction taken literally: *put them where a blank plinth is*. A dark
   * sockel is precisely the frontage that wants one.
   */
  baseNoRetail: 0.85,
  /** And where the ground floor already trades. Lower, not zero. */
  baseRetail: 0.34,
  /** Both are lifted by `density * this`, the same shape every other roll here uses. */
  density: 0.35,
  /**
   * Metres of frontage per pillar. AN ADVERTISING COLUMN IS SPACED ALONG A
   * PAVEMENT, not issued one per landlord — the first version rolled once per
   * building and delivered **1.1 pillars per 128 m chunk**, which over a chunk's
   * roughly 500 m of frontage is one every 450 m. Nobody would see two.
   *
   * 19 m is the generator's own median building width (the walk draws
   * `rng.range(11, 27)`), so a typical frontage carries one and a wide one
   * carries two, at the ends of its elevation rather than stacked at the
   * middle. It is a SPACING and it is measured along the elevation, which is
   * the datum CONTRACT §9 rule 7 asks for.
   */
  perFrontageM: 19.0,
  /** No frontage carries more than this, whatever its width. */
  maxPerBuilding: 2,
};

/**
 * THE BLADE — A SIGN THAT IS TALLER THAN IT IS WIDE. SESSION 34, LOOK.md §3.
 * ==========================================================================
 *
 * THE MEASUREMENT THAT SAYS THIS IS THE GAP, taken before anything was
 * changed, over `citycheck`'s own 10 × 10 region at seed 1337:
 *
 *     692 signs in 5 mountings
 *     taller than wide (aspect > 1)                          0 of 692
 *     width   min 0.90   p50  5.08   p90 14.15   max 22.11 m
 *     height  min 0.22   p50  1.73   p90  3.70   max  5.98 m
 *     >= 3.5 m tall (about one storey)                      88 of 692
 *     >= 12 m tall (the four storeys §3 asks for)            0 of 692
 *
 * **THE WIDTHS ARE NOT THE PROBLEM.** A rooftop sign already reaches 22 m
 * across. What no sign in this city can be is TALL: `aspect` is drawn 0.24–0.62
 * for a shop sign and 0.28–0.42 for a building-scale one, so a vertical sign is
 * not rare here — it is unreachable, and the tallest object in the whole
 * signage vocabulary is 5.98 m against the four storeys §3 asks for.
 *
 * So this is an ASPECT band and not a size band, and the numbers below are what
 * bound it.
 */
export const SIGN_BLADE = {
  /**
   * Metres, the NARROW dimension — and for a projecting blade the narrow
   * dimension IS the cantilever over the pavement, which is what bounds it.
   *
   * The pavement is `CORRIDOR − roadHalfWidth` = 11.7 − 7.5 = **4.2 m**, and
   * `city.js`'s projecting mount already caps any blade at 2.4 m of projection
   * with its own derivation (*"the sign plus its 0.35 m standoff is 2.75 m,
   * leaving 1.45 m of pavement clear"*). 2.2 m sits UNDER that cap, so a blade
   * projects its full width rather than being silently clipped by a constant in
   * another file — which is the arrangement §9.1 is a list of.
   *
   * The minimum is 0.9 and it is the SHOP band's own minimum, deliberately: §3
   * wants a continuum from *"a 0.9 m plate over a door"* upward, not a third
   * mode sitting apart from the two the size comment already argues against.
   */
  widthMinM: 0.9,
  widthMaxM: 2.2,
  /**
   * Height / width. THE FLOOR OF THIS BAND IS THE CEILING OF EVERYTHING
   * SHIPPED, which is the property that makes it a checkable claim rather than
   * a taste: the narrowest blade at the lowest aspect is 0.9 × 2.6 = **2.34 m**
   * and the widest is 2.2 × 2.6 = **5.72 m**, against a delivered maximum sign
   * height of 5.98 m over the whole region. So every blade is at least as tall
   * as the tallest thing this city had, and a blade is never mistakable for a
   * fascia.
   *
   * The ceiling reaches what §3 asks for: 2.2 × 7.0 = **15.4 m**, against four
   * storeys at the shortest era's 3.05 m floor = 12.2 m. Clamped per building
   * to what the elevation can actually carry — see `bladeHeightM`.
   *
   * ═══ RAISED 7.0 → 9.0, SESSION 43, AND THE TARGET MOVED FROM FOUR STOREYS
   * TO SIX. The brief's words are that session 34 *"was a start, not the
   * finish"* and that the reference has signs *"several storeys tall"*.
   * MEASURED FIRST, straight out of this generator over `citycheck`'s own
   * 10 × 10 at seed 1337, before anything was changed:
   *
   *     958 signs, 111 of them taller than wide (11.6%)
   *     tallest sign in the city                      14.24 m
   *     >= 12.2 m — the four storeys §3 asked for       9 of 958   0.9%
   *     >= 18.3 m — six storeys                         0 of 958   0.0%
   *
   * So session 34's four-storey target was REACHED and only just: nine signs of
   * 958. Six storeys at the shortest era's 3.05 m floor is 18.3 m.
   *
   * ═══ THE CEILING IS SOLVED, NOT PICKED, AND SETTING IT AT THE TARGET IS THE
   * MISTAKE THIS AVOIDS. A first arm put it at 9.0, where the widest blade
   * reaches 2.2 × 9.0 = 19.8 m and six storeys is therefore *reachable* — and
   * the generator delivered **0 of 975 signs at 18.3 m**, because only a corner
   * of the (width, aspect) square gets there and that corner has near-zero
   * measure. A band whose top touches the target delivers the target never.
   *
   * So the ceiling is solved from HOW OFTEN the target has to arrive. §3 asks
   * for *"several at different depths in one frame"*, and `pTrading` below
   * already answers the same question with the same population: a frame down a
   * retail street sees SIX TO TEN FRONTAGES. For such a frame to hold a
   * several-storey blade, about one blade in eight has to be one. Over
   * w ~ U(0.9, 2.2) and a ~ U(2.6, A), solving P(w·a ≥ 18.3) = 1/8 gives
   *
   *     A =  9.0   P = 0.007    A = 12.0   P = 0.114    A = 14.0   P = 0.201
   *
   * so **12.0**, delivering 0.114 — one blade in 8.8. The widest blade at the
   * ceiling is 2.2 × 12.0 = 26.4 m, which is eight and a half storeys and is
   * what a vertical hotel or cinema blade actually is.
   *
   * THE WALL IS NOT THE LIMIT AND THAT IS MEASURED TOO. Over the same
   * population the median building under a sign is 38.7 m tall, so the wall
   * between a blade's 3.05 m clear height and its parapet is **34.6 m at the
   * median and 74.3 m at p90** — `bladeHeightM`'s clamp does not bite on a
   * typical building at 12.0, and where it does bite the blade stays a blade at
   * a smaller size rather than becoming something else. What bounds a blade is
   * the pavement it hangs over, through `widthMaxM`, and that is unchanged.
   */
  aspectMin: 2.6,
  aspectMax: 12.0,
  /**
   * Metres from the pavement to the blade's LOWER edge.
   *
   * 3.05 m is the shortest era's storey height, i.e. the first-floor slab —
   * which is what a blade sign is bolted to in the world, hanging down past the
   * shopfront fascia rather than starting above it. Derived rather than picked,
   * and it clears `HEAD_CLEAR_M` (2.10 m, the props budget's own head height)
   * by **0.95 m**, so nothing on this street can walk into one.
   */
  clearM: 3.05,
  /**
   * Probability that a sign on a TRADING building becomes a blade, and on a
   * building that merely stands on a retail frontage.
   *
   * §3 asks for *"several at different depths in one frame"*. A frame down a
   * retail street sees six to ten frontages; `RETAIL.tradingShare` of a retail
   * frontage actually trades, so 0.34 on those and 0.12 on the rest puts two to
   * three blades in such a frame and none at all on a street with no trade —
   * which is the derivation §5 asks for. A blade on a street with no shops is
   * the genre signifier that section refuses.
   *
   * DELIVERED over the same region, measured after: see STATE.
   */
  pTrading: 0.34,
  pFrontage: 0.12,
};

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE BUILDING-SCALE SIGN — A FRACTION OF THE WALL, AND WHERE THE TRADE IS.
 * SESSION 43, LOOK.md §3.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * MEASURED FIRST, same region and seed as `SIGN_BLADE`'s table:
 *
 *     building-scale signs                          22 of 958   2.3%
 *     width / its own frontage, median                    0.71
 *     width / its own frontage, worst                     1.37
 *     OF WHICH OVERHANG THEIR OWN FRONTAGE (> 1.00)     2 of 22
 *
 * TWO SIGNS WERE WIDER THAN THE BUILDINGS THEY ARE BOLTED TO, and the cause is
 * that `width` was an ABSOLUTE `range(9, 17)` on an elevation whose own width
 * is a `range(11, 27)` roll. Two independent draws, one of which is supposed to
 * fit inside the other — CONTRACT §9's shape with two widths, and it is the
 * same pair `city.js` had when a building's CENTRE stood in for its ELEVATION.
 *
 * SO THE WIDTH IS A FRACTION OF THE FRONTAGE, WHICH IS ALSO WHAT §3 ASKED FOR:
 * *"some spanning half a wall"*. `ROOF_SIGN` above already does exactly this,
 * with exactly these numbers, for exactly this reason — a roof sign is
 * `frontage · widthFrac` clamped to a min and a max — so this is the file's own
 * construction applied to the elevation instead of to the roofline, and the two
 * now cannot say different things about the same quantity. A median roll of
 * 0.66 IS half a wall, and 0.86 is a sign that spans the elevation and leaves
 * 7% of it clear at each end.
 *
 * IT CANNOT OVERHANG ANY MORE, BY CONSTRUCTION AND NOT BY LUCK. `along` is
 * scaled by `1 − width/frontage` so that the sign's own half-width plus its
 * offset never leaves the wall — the claim discipline taken as a bound on where
 * it may stand rather than as a shrink applied after the fact.
 */
export const SIGN_BIG = {
  /** Fraction of the elevation. `ROOF_SIGN.widthFracMin/Max`, deliberately. */
  widthFracMin: 0.46,
  widthFracMax: 0.86,
  /** Metres. Also `ROOF_SIGN`'s, and the narrowest building here is 11 m, so
   *  the floor cannot itself produce an overhang. */
  minWidthM: 6.0,
  maxWidthM: 26.0,
  /**
   * WHERE THE BIG ONES GO, AND IT IS SESSION 28's RETAIL ROLL. §5's test for
   * anything added here is that it be derivable from something the city already
   * has: a building-scale sign is ADVERTISING, advertising is bought where the
   * people are, and `bld.retail` / `bld.retailFrontage` already record which
   * frontages trade. The blade got this conditioning in session 34 and the
   * building-scale sign never did — it was a flat 0.07 on any building over
   * 30 m, which puts a nine-storey sign on a quiet residential street.
   *
   * `pQuiet` IS NOT ZERO AND THAT IS THE DERIVATION RATHER THAN A HEDGE. A
   * corporate tower carries its own name over the door whether or not the
   * street trades, and that is identification rather than advertising — so it
   * is rare and it is not absent.
   *
   * WHAT IT DELIVERS AGAINST THE OLD FLAT ROLL. Over the same region the
   * building population is 64.8% trading, 13.4% on a retail frontage without
   * trading and 21.8% neither, so the population-weighted probability is
   * 0.648·0.20 + 0.134·0.09 + 0.218·0.02 = **0.146 against 0.07** — about twice
   * as many, and clustered on the streets that have shops rather than sprinkled
   * over every tall building. §3 asks for *"several at different depths in one
   * frame"*, and a frame down a trading street is where that now happens.
   */
  pTrading: 0.20,
  pFrontage: 0.09,
  pQuiet: 0.02,
};

/**
 * A blade's height on a given elevation: its own roll, clamped to what the wall
 * can carry between `clearM` and the parapet. Returns 0 where nothing fits,
 * which is the caller's signal to leave the sign as it was.
 *
 * The clamp is why there is no `minBuildingHeight` constant: the geometry
 * decides, and a threshold beside it would be a second description of the same
 * inequality.
 */
export function bladeHeightM(width, aspect, buildingHeightM) {
  const room = buildingHeightM - ROOF_PARAPET_M - SIGN_BLADE.clearM;
  const wanted = width * aspect;
  return room >= width * SIGN_BLADE.aspectMin ? Math.min(wanted, room) : 0;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE HOLOGRAM — SESSION 43, LOOK.md §3, AND IT COSTS NO DRAW CALL BECAUSE IT
 * IS NOT A TRANSPARENT SURFACE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * §3 asks for something "emissive, semi-transparent, above the street and at
 * junctions", and says what makes one read: *"it hangs in air nothing supports,
 * it is brighter than the wall behind it, and you can see through it to the
 * wall"*. It also says what makes one fail: *"a hologram that reads as a lit
 * billboard is a lit billboard, and this project already has 692 of those"*.
 *
 * THE BUDGET IS WHY THE FORM IS WHAT IT IS, AND THE ARITHMETIC WAS DONE BEFORE
 * ANYTHING WAS BUILT. `highway_speed` stands at **439 draw calls of 440** after
 * session 42's weir park. A transmissive surface needs `transparent: true` and
 * a blend mode, which is a second material, which is a second mesh even when it
 * is merged city-wide the way `city:signs` is — so alpha would cost EXACTLY ONE
 * DRAW CALL and take the last spare in the project. The brief's instruction is
 * to stop and report rather than take it.
 *
 * SO THE THIRD PROPERTY IS DELIVERED LITERALLY INSTEAD OF THROUGH ALPHA: the
 * panel is a RASTER OF EMISSIVE BARS with air between them, and you see the
 * wall through the gaps because there is nothing there. It is also the honest
 * form for the thing — a projected image in air has no substrate, so what a
 * volumetric display is made of is stacked planes of light and not a sheet.
 * The bars ride in the EXISTING merged `city:signs` mesh at a tint gain, the
 * same trick `LIGHT.roofSignNits` uses to put two radiances on one material, so
 * the whole system costs no material, no mesh and no draw call.
 *
 * WHERE, AND IT IS SESSION 28's ROLL AGAIN. A hologram is advertising, so it
 * belongs where advertising is: over a CORNER SHOP at a junction, which is the
 * one retail position `RETAIL.corner` already models and the one place on a
 * street where people stand still long enough to read something. Not scattered.
 *
 * IT HANGS OFF THE END OF THE ELEVATION, over the junction rather than over the
 * frontage, and that is a placement argument as well as a look one: a blade
 * sign occupies the elevation from `SIGN_BLADE.clearM` up to 24 m and the two
 * would meet. Off the end, they cannot.
 */
export const HOLOGRAM = {
  /**
   * p(a corner shop's junction carries one), as `base + density · slope` — the
   * same shape every other roll in this file uses, so a downtown junction is
   * far more likely to carry one than a junction a kilometre out. At the
   * region's quietest frontage (density 0.30) that is 0.25 and at its busiest
   * (0.72) 0.38, so a hologram is a thing some junctions have rather than a
   * thing junctions have.
   */
  pBase: 0.16,
  pDensity: 0.30,
  /**
   * Metres, the panel. Wider than a blade because it is not bolted to anything
   * and narrower than a building-scale sign because it is read from the corner
   * you are standing on rather than from down the street.
   */
  widthMinM: 2.6,
  widthMaxM: 5.4,
  /** Height / width. A hologram stands up; below 1.0 it is a billboard again. */
  aspectMin: 1.1,
  aspectMax: 2.2,
  /**
   * Metres from the pavement to the panel's LOWER edge. 7.0 is above the
   * shopfront fascia and above `SIGN_BLADE.clearM` = 3.05, so the panel is
   * clear of everything the frontage carries and — the point of the section —
   * it is over the heads of the people at the crossing with nothing under it.
   */
  clearM: 7.0,
  /**
   * The raster. `barM` is the bar and `pitchM` is the spacing centre to centre,
   * so the panel is 16% light and 84% air: you see the wall through it, which
   * is §3's third property. A pitch of 0.62 m puts about nine bars in a 5.4 m
   * panel, which is a raster you can see rather than a texture.
   */
  barM: 0.10,
  pitchM: 0.62,
  /**
   * Metres from the elevation to the panel's INNER edge. The panel then runs
   * OUTWARD from there across the footway, because its face looks down the
   * street rather than out of the wall — see `city.js` for why that orientation
   * and not the other. The pavement is `CORRIDOR − roadHalfWidth` = 4.2 m, so
   * at the widest roll (5.4 m) the outer edge reaches 6.0 m from the building
   * line, i.e. 1.8 m over the carriageway at 7.0 m of height. That is deliberate
   * and it is what §3 means by *"above the street"*: `occupancy.js` allows
   * `canopy × carriageway` on purpose — the pair is absent from FORBIDDEN
   * because a thing over a road at height is a street tree or a shelter and not
   * a collision — and 7.0 m clears everything this city drives.
   */
  standoffM: 0.6,
  /** Metres past the end of the elevation, toward the junction. */
  pastEndM: 2.4,
  /**
   * cd/m². A hologram is brighter than the wall behind it — §3's second
   * property — and the number is stated here rather than hidden in a
   * multiplier (§9 rule 1). 2600 is 30× `LIGHT.signPlateNits` = 86, which is
   * the gain `city.js` puts in the instance tint, and it sits between a
   * shopfront fascia and `LIGHT.neonNits` = 6500. Against a facade at a
   * midnight luminance near 1 cd/m² it is unambiguously an emitter.
   */
  nits: 2600,
};

/**
 * Roll one corner shop's hologram. Returns null where it gets none.
 *
 * ITS OWN RNG STREAM, `holoRng`, for the reason `roofSignRng` has one: drawn
 * from `signRng` this would re-phase every shopfront sign in the city and the
 * diff would read as a change to the signage (CONTRACT §6, and STATE 20's note
 * on the same hazard).
 */
export function rollHologram(holoRng, bld, density, distToEndM, cornerSide) {
  /** ALL THE UNIFORMS FIRST, WHATEVER IS DECIDED, so the stream's phase is a
   *  function of the building COUNT and nothing else. */
  const q = {
    roll: holoRng.next(),
    w: holoRng.range(HOLOGRAM.widthMinM, HOLOGRAM.widthMaxM),
    asp: holoRng.range(HOLOGRAM.aspectMin, HOLOGRAM.aspectMax),
    /**
     * 0..2, an index into `city.js`'s HOLO_CHROMA — the COLD half of
     * `SIGN_CHROMA`. LOOK.md §3 wants a third of emitters cold and session 32
     * measured the delivered emissive area at 8.0%; a hologram is projected
     * light rather than a lamp behind glass, and every real volumetric display
     * is a narrow-band source, so this is the one new emitter population that
     * has no business being warm.
     */
    chroma: holoRng.int(0, 2),
  };
  if (!bld.retail) return null;
  if (distToEndM > RETAIL.cornerM) return null;
  if (q.roll >= HOLOGRAM.pBase + density * HOLOGRAM.pDensity) return null;
  return {
    x: bld.x, z: bld.z,
    facing: bld.facing,
    buildingWidth: bld.width,
    buildingDepth: bld.depth,
    /** Which end of the elevation the junction is at: −1 or +1 along it. */
    cornerSide,
    width: q.w,
    aspect: q.asp,
    chroma: q.chroma,
    yawDeg: bld.yawDeg,
  };
}

/**
 * Does this building's frontage carry an advertising pillar? Rolled in the
 * generator so it is part of the chunk's own description; WHERE it stands and
 * whether it fits are decided against the delivered occupancy in `city.js`,
 * which is where the pylon's own placement test lives.
 */
export function adPillarWanted(pillarRng, retail, density) {
  const base = retail ? AD_PILLAR.baseRetail : AD_PILLAR.baseNoRetail;
  return pillarRng.next() < base + density * AD_PILLAR.density;
}

/**
 * Does this frontage trade? One roll per SIDE, consumed in a fixed order so the
 * answer is deterministic in (seed, chunk, side index) and independent of how
 * many buildings the side ends up carrying.
 */
export function retailFrontage(retailRng, density) {
  return retailRng.next() < RETAIL.frontageBase + density * RETAIL.frontageDensity;
}

/**
 * Does THIS building trade, given its frontage's answer and where it sits on it?
 *
 * `distToEndM` is measured from the building's own frontage span to the nearer
 * end of the side — CONTRACT §9 rule 7, and the datum is named because "near
 * the corner" is a distance and this project has twice measured one from the
 * wrong place. A building 2 m from the end of a run is at the junction; one
 * 40 m along it is in the middle of the block.
 */
export function retailBuilding(retailRng, onRetailFrontage, distToEndM) {
  const p = onRetailFrontage ? RETAIL.inFrontage
    : distToEndM <= RETAIL.cornerM ? RETAIL.corner
      : 0;
  return retailRng.next() < p;
}

/**
 * HOW TALL A BUILDING IS — session 20, item 4, and the change is entirely in
 * the SHAPE of the distribution.
 *
 * WHAT IT WAS: `rng.range(12, 64)`, uniform. Nineteen sessions of skyline, and
 * a uniform distribution is the one thing a real skyline is not. Measured over
 * a 10 x 10 chunk region by `tools/heightprobe.mjs`: mean 36.13 m, **sd/mean
 * 0.425**, hard-capped at 66 m, and the consequence is the even comb the
 * elevated frame shows — no building is ever much taller than its neighbours,
 * because none is allowed to be.
 *
 * THIS FILE ALREADY MAKES THE ARGUMENT ABOUT DENSITY AND NEVER MADE IT ABOUT
 * HEIGHT. `fill` is `0.12 + 0.88 · density^2.2` under a comment saying "real
 * urban density is heavy-tailed rather than normal: a downtown block has ten
 * times what a block a kilometre out has, not one and a half times". Height is
 * the same quantity one axis over and had a uniform roll.
 *
 * DELIVERED, BOTH ARMS THROUGH THE SAME GENERATOR (`heightprobe`, seed 1337).
 * THE FIGURES BELOW ARE SESSION 20's, AND THEY WERE EXACT WHEN WRITTEN — a
 * session-31 pass re-ran THIS COMMIT'S OWN heightprobe out of `git archive` and
 * reproduced every one of them to the digit, including "nine of 432". What
 * moved is the POPULATION, not the distribution: session 21's occupancy
 * registry refused 65 buildings and the region has held 366 ever since, while
 * p99 and max are byte-identical at every commit from ca0169f to HEAD. Both
 * columns are kept, because the RATIO is the claim and it survives:
 *
 *     session 20, 432 buildings
 *     uniform 12–64        mean 36.13   median 34.8   p99  65   max  66   sd/mean 0.425
 *     lognormal 34, σ 0.62 mean 38.43   median 31.1   p99 134   max 154   sd/mean 0.664
 *
 *     TODAY, 366 buildings (session 31, same probe, same seed, same region)
 *     uniform 12–64        mean 36.71   median 36.0   p99  65   max  66   sd/mean 0.416
 *     lognormal 34, σ 0.62 mean 38.90   median 32.7   p99 134   max 154   sd/mean 0.645
 *
 *     the ratio then 0.664/0.425 = 1.562×, now 0.645/0.416 = 1.550×
 *
 * **sd/mean 0.664 against 0.425 — a 1.56× wider spread**, which is the whole
 * change; and a p99 at 134 m against 65, which is the part you can see. σ = 0.62
 * gives `sqrt(exp(σ²) − 1)` = 0.6785 in the limit, and the delivered 0.664 is
 * that with the clamps on. Real city height distributions are measured at
 * σ ≈ 0.5–0.9 (Batty & Longley on building-height power laws); 0.62 is inside
 * that band and at the modest end of it.
 *
 * THE MEDIAN IS 34 AND IT IS CHOSEN AGAINST Σ FLOORS, NOT AGAINST THE MEAN —
 * AND STATE 19 §9.5's ARITHMETIC IS WRONG IN EXACTLY THAT WAY. That entry
 * proposed "median 30 m, σ = 0.62 gives mean **36.4 against the delivered
 * 36.55**, i.e. the mean is preserved to 0.4%". Those are two different
 * quantities: 36.4 is the log-normal's mean BEFORE `floors = max(3, round(h /
 * era.floor))` and 36.55 is what the uniform delivered AFTER it. CONTRACT §9's
 * table with two means.
 *
 * SHIPPED AT MEDIAN 30 IT MEASURED AS A CONTENT REDUCTION AND A GATE SAID SO.
 * `perfcheck` went red on `floors.visibleInstances` — **106 501 against a floor
 * of 115 000** — which is a content floor doing precisely its job. §0 rule 5:
 * the answer is to put the content back, never to move the floor. What had to
 * be preserved was never the mean height; it is the FACADE AREA, because that
 * is what a window count is proportional to, and a setback removes upper-tier
 * perimeter as well as height:
 *
 *     median   Σfloors    facade area    delivered windows + building boxes
 *      30       −5.4%        −6.2%        105 796   (−10.5% — RED)
 *      32       +0.9%        −0.4%
 *      34       +6.6%        +4.9%        121 781   (+3.0% — clear)
 *
 * The delivered column is `citycheck`'s own scene walk, i.e. instances that
 * reached the GPU, and it is the one that decides. Σfloors and facade area are
 * the cheap proxies `heightprobe` computes without a browser so the next
 * session can sweep this in ten seconds rather than in twenty minutes.
 *
 * THE CLAMP IS 150 m AND IT IS NOT A TASTE. `LIGHTING.shadowExtent` is 170 m,
 * so a building taller than that would stand outside the sun's own depth pass
 * and cast no shadow at noon — a 200 m tower with no shadow is a worse artefact
 * than no tower. 150 leaves 20 m of margin, and the delivered maximum is 154 m
 * because `floors · (era.floor + jitter)` is applied AFTER the clamp: the clamp
 * bounds the ROLL and the era's own storey height carries it a little past.
 * **Seven of 366** buildings clear 34 storeys, measured by `heightprobe` at
 * HEAD. The "nine of 432" this line carried is session 20's figure, quoted
 * correctly 55 lines above as a REPRODUCED session-20 measurement and left
 * standing here as a bare present-tense fact — the population fell to 366 when
 * session 21's occupancy registry began refusing buildings. The ratio is the
 * claim and it survives: 9/432 = 2.08%, 7/366 = 1.91%.
 *
 * FLOOR 9 m, because `floors = max(3, ...)` already imposes three storeys and a
 * log-normal's lower tail otherwise spends draws below it that all land on the
 * same answer. 9 is 3 × the 3.05 m of the shortest era.
 */
export const HEIGHT_DISTRIBUTION = {
  /**
   * `logNormal` is what ships. `uniform` is the SESSION-19 BAND, kept as an ARM
   * rather than as a memory: this session's height change is the one that moved
   * `floors.visibleInstances` and the honest way to say by how much is to run
   * the two distributions through the same generator, not to compare a number
   * against a number written down last week. `tools/heightprobe.mjs` is the
   * only caller, and it says in its own header that it asserts nothing.
   *
   * The same shape `?fieldDrip` has: one parameter with two arms, rather than
   * two copies of a module that have to be kept in step (§9.1).
   */
  mode: 'logNormal',
  medianM: 34,
  sigmaLn: 0.62,
  minM: 9,
  maxM: 150,
  /** The arm. Session 19's uniform band, in the units it was written in. */
  uniformLoM: 12,
  uniformHiM: 64,
};

export function buildingHeightRoll(rng) {
  if (HEIGHT_DISTRIBUTION.mode === 'uniform') {
    return rng.range(HEIGHT_DISTRIBUTION.uniformLoM, HEIGHT_DISTRIBUTION.uniformHiM);
  }
  const h = rng.logNormal(HEIGHT_DISTRIBUTION.medianM, HEIGHT_DISTRIBUTION.sigmaLn);
  return Math.min(HEIGHT_DISTRIBUTION.maxM, Math.max(HEIGHT_DISTRIBUTION.minM, h));
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * HOW DEEP A BUILDING GOES — SESSION 35, AND THE CORE IS DERIVED RATHER THAN
 * CHOSEN.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WHAT WAS THERE, AND WHAT IT MEASURED. `rng.range(15, 26)`, one band for every
 * building on every frontage of every block in the city. Over `city-budget`'s
 * own 10 × 10 region at seed 1337, walked by `tools/depthprobe.mjs`:
 *
 *     median depth 20.1 m into a 52.3 m half-block, max 26.0
 *     island footprint covered by buildings              20.8%
 *     built past 31 m from the lot line                   0.06%
 *
 * A rind along the street frontage with the middle of every block hollow. That
 * is what LOOK.md §2 is about — *"a working metropolis ... streets walled on
 * both sides for their whole length"* — and the frontage half of it was raised
 * in session 32 as far as the occupancy registry allows. This is the other
 * half, and unlike the frontage it grows INWARD, into land nothing occupies.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * WHAT THE CORE IS, AND WHY IT IS THAT NUMBER.
 *
 * A perimeter block is not solid: it has a light well, and its width is the one
 * number this whole change turns on. LOOK.md §5's test is that a device be
 * derivable from something the city already has, so it is derived from the
 * narrowest gap this city already puts between two building lines and still
 * calls a street:
 *
 *     CORRIDOR             11.7 m   building line to road centreline
 *     two of them          23.4 m   building line to BUILDING LINE
 *
 * That is `CITY.roadHalfWidth + CITY.sidewalkWidth`, doubled — the section of
 * an ordinary street in this city, and the distance at which this generator
 * already asserts two facades may face each other. A well narrower than that is
 * a shaft nothing could see out of; one that wide is a mews, which is what the
 * back of a dense block is.
 *
 * It is also the number the canyon bake (§5.7) is already asked to resolve at
 * street level, so the light well is inside the regime the indirect-light field
 * was built for rather than outside it.
 *
 *     island                       104.6 m   `CITY.chunkSize − 2·CORRIDOR`
 *     core                          23.4 m   `2 · CORRIDOR`
 *     lot depth   (104.6 − 23.4)/2  40.6 m   ← the deepest a building may go
 *
 * A full ring at 40.6 m covers **95.0%** of the island — against the 96.3% of
 * the lower Manhattan block STATE 33 §6 put beside today's 20.8%, and the 84.9%
 * of the 32 m ring in the same table. The reference is reached by a derivation
 * and not by aiming at it.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * THE DISTRIBUTION, AND WHY IT IS A MIXTURE RATHER THAN A WIDER BAND.
 *
 * Widening `rng.range` to `(15, 40.6)` would make the median depth 27.8 m and
 * every block a rind of uniformly middling buildings — a constant fraction of
 * the lot, moved. Real lot coverage is not unimodal: a block is mostly
 * buildings built to the back of their lot, plus a minority with a YARD behind
 * them. Those are two populations and they should be drawn as two.
 *
 *     deep      `lot − range(0, CORRIDOR)`      28.9 – 40.6 m   built out
 *     shallow   `range(bandLoM, bandHiM)`       15.0 – 26.0 m   a yard behind
 *
 * BOTH ARMS ARE A YARD AND THE DIFFERENCE IS HOW BIG IT IS, which is why the
 * deep arm's spread is a length rather than a fraction: it is the lot less a
 * rear yard **of at most half a street**, `CORRIDOR`. A building built out to
 * its lot is still not a slab to the boundary — it keeps a service strip — and
 * the largest strip that is still a strip rather than a courtyard is the same
 * 11.7 m this file already uses for the distance from a building line to the
 * middle of the road.
 *
 * The shallow arm is TODAY'S BAND UNCHANGED, which is what makes the claim
 * "some of it should survive" checkable: a shallow building in the new city is
 * literally a building from the old one.
 *
 * WHICH ARM IS A FUNCTION OF DENSITY, because LOOK.md §2 says density has
 * causes and this is the cheapest of them to honour: land under a viaduct gets
 * sheds and yards; land in the core gets built to the back of the lot.
 *
 * AND IT IS THE FILL LAW'S OWN ENDPOINTS WITH THE POWER SET TO ONE, not a
 * second set of constants:
 *
 *     frontage   `0.12 + 0.88 · density^1.4`   how much of the side is built
 *     depth      `0.12 + 0.88 · density^1.0`   how much of the lot is built out
 *
 * The endpoints are shared because they are the same statement about the same
 * field — at the bottom of the density field a block is one in eight, at the
 * top it is everything. The POWER is where they differ, and it differs for the
 * reason the quay walk already gives about its own softer power: **depth is the
 * cheapest thing a developer buys.** Somebody who has paid for the frontage
 * builds it out; a heavy power would say the opposite, that the back of the lot
 * is the last thing to go up. So the district structure enters through a linear
 * term rather than through the frontage's 1.4.
 *
 * ONE DRAW, FROM `rng`, AND DELIBERATELY NOT FROM A NEW STREAM.
 *
 * Every other roll added since session 20 got its own stream, for CONTRACT §6's
 * reason: a new roll drawn from `rng` displaces everything after it. This one is
 * the exception and the exception is the reason. It does not ADD a draw — it
 * REPLACES `rng.range(15, 26)`, one draw for one draw — so taken from `rng` the
 * `band` arm below is the shipped city **bit for bit**, and it is a control
 * rather than a memory. Moved to a stream of its own it would take a draw AWAY
 * from `rng`, and the arm would deliver a differently-phased city that could no
 * longer be compared with anything. Measured, before this paragraph was
 * written: on its own stream the `band` arm read **475 buildings against the
 * 480 at HEAD**, and every one of those five is a re-phase.
 *
 * WHAT NO ARRANGEMENT OF STREAMS CAN SAVE, and it is worth being plain about
 * because it decides how the before/after frames must be read: whether a
 * building is PLACED or REFUSED already costs `rng` a different number of draws
 * — one on the refusal path (`rng.range(0, 3)`), zero or two on the placement
 * path (`cantilever` and `crown`, contemporary only). So the FIRST building
 * whose verdict the new depth changes re-phases every building after it in that
 * chunk. The delivered city is a different population and not the old one with
 * deeper boxes, exactly as session 34's blade was for the signage.
 */
export const DEPTH_DISTRIBUTION = {
  /** `lot` is what ships. `band` is session 32's shipped 15–26, kept as an ARM. */
  mode: 'lot',
  /**
   * The depth clip, as an ARM rather than as a memory. `false` restores the
   * refuse-outright behaviour every session before this one had, which is what
   * makes the claim "the clip is what keeps the block a ring" a measurement
   * (STATE 35 §1) rather than an assertion. `tools/depthprobe.mjs --sweep` is
   * the only caller that sets it, and it asserts nothing.
   */
  clip: true,
  /** The light well, as a multiple of `CORRIDOR`. Two of them: line to line. */
  coreCorridors: 2,
  /** The shallow arm — today's band, unchanged, and it is the yard case. */
  bandLoM: 15,
  bandHiM: 26,
  /**
   * The deep arm's own rear yard, as a multiple of `CORRIDOR`. The arm runs
   * from `lot − deepYardCorridors·CORRIDOR` to `lot`.
   */
  deepYardCorridors: 1,
  /**
   * P(deep). The fill law's own endpoints — `0.12 + 0.88·d^p` — with `p` at 1.
   * The two are one statement about one field and differ only in the power.
   */
  deepAtZero: 0.12,
  deepAtOne: 1.0,
  deepPower: 1.0,
  /**
   * The shallowest building the clip may leave standing. Below this a
   * "building" is a wall with windows in it — the sentence `MIN_RIVER_DEPTH`
   * already makes about the tightest stretch of the embankment, and this is the
   * same number for the same reason, so a corner and a quay agree about what a
   * single-bay terrace is.
   */
  minM: 9,
};

/** The lot depth the core leaves on each side of an island. 40.6 m. */
export function lotDepthM() {
  const island = CITY.chunkSize - 2 * CORRIDOR;
  return (island - DEPTH_DISTRIBUTION.coreCorridors * CORRIDOR) / 2;
}

/**
 * ONE draw, from `depthRng`. `density` is the chunk's own, so the mixture is a
 * property of the district and not of the building.
 */
export function buildingDepthRoll(rng, density) {
  const D = DEPTH_DISTRIBUTION;
  if (D.mode === 'band') return rng.range(D.bandLoM, D.bandHiM);
  const lot = lotDepthM();
  const pDeep = D.deepAtZero + (D.deepAtOne - D.deepAtZero) * Math.pow(density, D.deepPower);
  const u = rng.next();
  /**
   * The SAME uniform remapped into whichever arm it lands in, rather than a
   * second draw for the arm's own position. Two draws would make the roll cost
   * twice what the band it replaces cost and would put a `pDeep`-shaped comb
   * into the stream; one keeps the arm and the position perfectly correlated,
   * which is harmless here because the arms do not overlap.
   */
  if (u < pDeep) {
    const v = pDeep > 0 ? u / pDeep : 0;
    return lot - D.deepYardCorridors * CORRIDOR * (1 - v);
  }
  const v = pDeep < 1 ? (u - pDeep) / (1 - pDeep) : 0;
  return D.bandLoM + (D.bandHiM - D.bandLoM) * v;
}

/**
 * THE FRONTAGE FILL LAW, AS A KNOB RATHER THAN AS A LITERAL — SESSION 36.
 *
 * `fill` is the probability that a candidate slot on a block frontage becomes a
 * building. It has been a bare expression inside `generateChunk` since the
 * perimeter walk was written, which is why every session that wanted to know
 * what a different fill delivers has had to edit the generator to find out —
 * session 32 did, and its sweep table is the comment beside the call site. An
 * arm nobody can run is a number nobody can check.
 *
 * IT IS THE SAME STATEMENT AS `DEPTH_DISTRIBUTION`'s `pDeep`, WITH THE SAME
 * ENDPOINTS: `atZero + (atOne − atZero)·density^power`. At the bottom of the
 * density field a block is one in eight; at the top it is everything. The power
 * is the only place the two laws differ and the comment above
 * `buildingDepthRoll` says why they differ there.
 *
 * WHICH DIRECTION IS "MORE". A SMALLER power is a FULLER city, and it fills the
 * SPARSE end hardest: at density 0.30, `d^1.4` is 0.185 and `d^0.6` is 0.486, so
 * fill goes 0.283 → 0.548; at density 0.80 the same move is 0.764 → 0.890. That
 * asymmetry is the whole cost of the knob — it is district structure being
 * spent, which is what `citycheck`'s clumping CV measures and what the comment
 * at the call site was written to protect.
 *
 * THE QUAY IS THIS LAW WITH A SOFTER POWER AND THE DIFFERENCE IS DERIVED: a
 * waterfront is the one frontage a city builds on before it builds on anything
 * else. Session 28 wrote that as 1.6 against the perimeter's 2.2 — the quay
 * softer by 0.6 — and session 32 moved the perimeter to 1.4 without moving the
 * quay, which INVERTED the sentence it was derived from: for four sessions the
 * quay has been the HARDER of the two, and session 36 has made it harder still.
 *
 * IT IS LEFT INVERTED, DELIBERATELY, WITH THE NUMBER BESIDE IT. Restoring the
 * relation is `quayPower = power − 0.6` = 0.5, and measured over the region it
 * delivers **17 river-bank buildings against 8, +9 buildings, +0.2 points of
 * island coverage.** It is not taken here because it decides a content question
 * this project has open and has not answered: STATE 35 §1.6 records that the
 * deep island frontage already took the quay from 12 buildings to 9, and *which
 * frontage owns a narrow riverside lot* is the operator's call, not a side
 * effect of a fill raise. `quayPower` is here so the relation is one
 * subtraction instead of two greps, and so that call costs ten minutes.
 */
export const FRONTAGE_FILL = {
  atZero: 0.12,
  atOne: 1.0,
  /**
   * The island perimeter. Session 32 moved it 2.2 → 1.4; session 36, 1.4 → 1.1;
   * **session 37, 1.1 → 0.50, AND THIS ONE WAS CHOSEN BY LOOKING.**
   *
   * The three before it were chosen by where a gate stopped — session 36 says so
   * of its own arm in as many words, *"the largest raise that costs no clumping
   * margin at the gate's own seed"*. This one was chosen from fourteen aerial
   * frames swept over the whole law at one pose and one seed by
   * `tools/lookat.mjs --params=fill=`, and then the gates were told what the
   * choice cost. `tools/shot-out/s37-airA-f*.png` and `s37-airB-f*.png`.
   *
   * WHAT THE FRAMES SHOW, AND IT IS TWO DIFFERENT ANSWERS. From the pavement,
   * denser is better all the way to `fill = 1.0`: the street wall closes
   * monotonically and there is no arm at which it stops improving. From the
   * air, it is not — past about `d^0.5` the SPARSE districts fill in as fast as
   * the dense ones and the city becomes one carpet.
   *
   * THE NUMBER THE FRAMES ARE READING, over the 963 `built` chunks of twelve
   * regions (seeds 1337–1348), as the median delivered island coverage of the
   * densest quarter over that of the sparsest quarter:
   *
   *     power    cov Q1 sparse   cov Q4 dense   CONTRAST
   *      1.40        14.7%          40.8%        2.77x     session 32
   *      1.10        17.9%          42.7%        2.38x     session 36
   *      0.90        21.3%          45.2%        2.12x     citycheck clumping RED here
   *      0.70        24.4%          47.1%        1.93x
   *      0.50        30.5%          49.3%        1.61x     <- ships
   *      0.30        36.3%          51.8%        1.43x
   *      0.00        45.2%          53.9%        1.19x
   *
   * `node tools/fillprobe.mjs --districts --seeds=1337,...,1348` is the
   * instrument and it prints its population.
   *
   * **THE DENSE QUARTER BARELY MOVES AND THE SPARSE QUARTER TRIPLES.** Across
   * the whole law the core gains 1.32× and the edge gains 3.08×, because the
   * core is already against its own refusal ceiling — so what this knob spends
   * is not "some district structure", it is ALL of it, and the contrast column
   * is the price list. At `fill = 1.0` a sparse block and a dense block are the
   * same block and LOOK.md §2's *"density has causes"* is unreadable.
   *
   * 0.50 IS WHERE THE TWO ANSWERS STILL BOTH HOLD. At 0.70 the sparse blocks in
   * the aerial still read as unfinished scatter rather than as low-density
   * districts; at 0.30 the gradient has gone flat and the frame reads as one
   * uniform mass. It is a judgement and it is recorded as one — the contrast
   * number is what the judgement was looking at, not a threshold it was derived
   * from, and the next session is invited to disagree with the frames.
   *
   * IT IS NOT THE ARM THAT KEEPS THE GATES GREEN, DELIBERATELY. `citycheck`'s
   * clumping CV floor binds at `d^0.90` and this is four steps past it. What
   * that floor turned out to be measuring, and what was done about it, is in
   * `tools/city-budget.json` beside the number.
   */
  power: 0.50,
  /** The river bank. Session 28's own derivation is `power − 0.6`. */
  quayPower: 1.6,
};

/** `p` is passed only by the quay walk, which has its own power for a reason. */
export function frontageFill(density, p = FRONTAGE_FILL.power) {
  const F = FRONTAGE_FILL;
  return F.atZero + (F.atOne - F.atZero) * Math.pow(density, p);
}

/**
 * THE PERIMETER WALK'S REFUSALS, AS A TRACE — SESSION 39.
 *
 * WHY IT IS NOT ANOTHER COUNTER. Session 38's `frontage` tally answers *how
 * many* and *how many metres*; it cannot answer *which claim* or *where*, and
 * both of those are the question the walk's ceiling asks. `clipRefusedBy` keys
 * on `hit.kind`, so `landmark 78` is 78 refusals by any of eight landmarks with
 * four different shapes — and a repair to a pad has to name the pad.
 *
 * OFF BY DEFAULT AND INERT WHEN IT IS ON. It appends to an array; it draws no
 * random number, takes no branch the walk did not already take, and is read by
 * `tools/padprobe.mjs` and `tools/funnelprobe.mjs` only. `--identity` asserts
 * the delivered city is bit-identical with it on, which is the same assertion
 * session 38 owed for the tally itself.
 */
export const FRONTAGE_TRACE = { on: false, rows: [] };

/** One row. Called only from the perimeter walk; a no-op unless tracing. */
function traceFrontage(row) {
  if (FRONTAGE_TRACE.on) FRONTAGE_TRACE.rows.push(row);
}

/**
 * THE TWO THINGS THE WALKS DO WITH A LOT THEY CANNOT USE — SESSION 39.
 * ====================================================================
 *
 * Both are arms rather than constants for the reason `DEPTH_DISTRIBUTION` is:
 * the repair has to be measured against the thing it repairs, over regions,
 * and a session that measures by editing this file between runs is keeping two
 * states of one file in step by hand — CONTRACT §9.1's own failure mode.
 * `tools/funnelprobe.mjs --overrun=` and `--refusal=` sweep them.
 *
 * ── `overrun` — A LOT WIDER THAN THE FRONTAGE THAT REMAINS ──────────────────
 *
 * `'abandon'` IS THE DEFECT AND IT SHIPPED FOR EIGHTEEN SESSIONS. The walk drew
 * `rng.range(11, 27)` without knowing how much frontage was left, and when the
 * draw did not fit it set `t = side.to` and ENDED THE SIDE. Every other refusal
 * in this walk advances past the candidate and keeps going. Measured by
 * `funnelprobe` at the shipped law over `citycheck`'s own region: **94 of 332
 * sides, 1 591 m, 4.6% of the island edge** — and the outer guard is
 * `t < side.to - 12` against a narrowest building of 11.0 m, so a building fits
 * in EVERY one of them by construction. It is 4.6% at every arm of the fill law,
 * which is what says it is not a fill question.
 *
 * The remainder was not left empty for a reason. LOOK.md §2 asks that an empty
 * parcel be empty for one, and "the width roll came out large" is not one.
 *
 * `'clamp'` — THE LAST LOT ON A BLOCK IS WHAT IS LEFT OF IT. The drawn width is
 * cut to the frontage that remains and the candidate goes on to the fill roll
 * and the registry like any other. It draws the SAME single uniform for `width`
 * that `'abandon'` does, at the same point in the stream.
 *
 * `'fit'` — A LOT IS NEVER DRAWN WIDER THAN WHAT IS LEFT. `rng.range(11,
 * min(27, room))`, still one uniform at the same point, so the overrun branch
 * becomes unreachable. It differs from `'clamp'` in changing the width of every
 * candidate with under 27 m of room, not only the ones that would have overrun.
 *
 * ── `refusal` — WHERE THE WALK RESUMES AFTER THE REGISTRY REFUSES ───────────
 *
 * `'step'` is what shipped: `t += width + rng.range(0, 3)`, an advance that
 * knows nothing about where the thing that refused it ENDS. Measured by
 * `tools/padprobe.mjs` at the shipped law: of 296 clip refusals, **68 land PAST
 * the far edge of the claim that refused them and skip 701 m of clear frontage
 * doing it** — 2.0% of the island edge, 10.3 m at a time, given up beyond a pad
 * rather than under one.
 *
 * `'resume'` lands no further than the claim's own far edge plus the same gap
 * the step would have used. IT ONLY EVER SHORTENS THE ADVANCE — never lengthens
 * it — and it takes the shorter landing only when that still advances `t` by at
 * least `0.2 m`, the smallest gap this walk puts between two buildings. Both
 * conditions are what keeps the loop's invariant: every path either advances
 * `t` or ends the side.
 *
 * NEITHER ARM DRAWS A RANDOM NUMBER THE WALK DID NOT ALREADY DRAW. The
 * re-phasing they cause is entirely downstream — a lot that becomes a building
 * draws a depth, an era, a height and its signs, and the ones that did not
 * exist before move every draw after them. CONTRACT §6's named streams cannot
 * help with that: the extra draws are the BUILDINGS' own, on the chunk stream
 * they have always come from, and moving them to a new stream would move every
 * building in the city rather than the ones this repair adds.
 */
export const WALK = {
  overrun: 'clamp',
  refusal: 'resume',
};

/**
 * SETBACKS — session 20, item 4's other half.
 *
 * A tower that is one width from pavement to parapet reads as a SHAPE. One that
 * steps in as it rises reads as ARCHITECTURE, and it is the same argument §7.4
 * makes about the vehicles' height profile: a rectangular prism reads the same
 * at every station, and no amount of colour or detail changes that.
 *
 * THE DESCRIPTION IS PURE AND LIVES HERE, AND `buildingTiers()` BELOW IS THE
 * ONE PLACE THAT TURNS IT INTO BOXES. `city.js` emits the masses from it, the
 * signage asks it where a wall is, and the roofscape asks it where the top roof
 * is. Three readers, one function — because three transcriptions of "how wide
 * is this building at 40 m" is exactly the arrangement §9.1 warns about, and
 * the failure mode is a sign floating in the air beside a wall that stepped
 * away from it.
 *
 * WHO GETS ONE. Nothing under `minHeightM`: a step in a 20 m building is a
 * cornice, and this file already has cornices. The probability rises with
 * height because that is what zoning envelopes do — a tall building is tall
 * BECAUSE it stepped back, under every setback ordinance since New York 1916.
 *
 * THE OCCLUDER IS NOT CHANGED AND THAT IS DELIBERATE, WITH THE COST STATED.
 * `occluders` keeps the full footprint to the full height, so the canyon bake
 * (§5.7) marches against the building's ENVELOPE rather than against its
 * delivered massing, and the field is therefore CONSERVATIVE by the volume the
 * setbacks remove. That volume is above `0.45 · height` by construction and the
 * bake's street-level sky visibility is dominated by the first thirty metres,
 * so the error is small and it is in the direction that under-reports sky
 * rather than over-reports it. Changing the occluder would mean the worker's
 * nine-chunk neighbourhood and the main thread had to agree about a stepped
 * solid, which is a second description of the same shape.
 */
export const SETBACK = {
  minHeightM: 34,
  /** Probability at `minHeightM` and at 100 m; linear between, clamped. */
  pAtMin: 0.22,
  pAtTall: 0.78,
  tallM: 100,
  /** A second step only above this. */
  secondTierM: 72,
  /**
   * Inset per side, as a fraction of the plan dimension it eats into.
   *
   * SOFTENED FROM 0.10–0.19 IN THE SAME SESSION IT WAS WRITTEN, and the reason
   * is a gate rather than a taste: a setback removes upper-tier PERIMETER as
   * well as height, so it removes facade — and facade is windows, and windows
   * are what `floors.visibleInstances` counts. At 0.10–0.19 the step was worth
   * about a fifth of the tier above it on both axes. 0.09–0.16 still reads as a
   * step at the distance a skyline is seen from (the narrowest, on a 11 m
   * frontage, is 2 × 0.09 × 11 = 1.98 m, which is 4 px at 500 m) and costs
   * about a third less area.
   */
  insetMin: 0.09,
  insetMax: 0.16,
  /** Never take a plan dimension below this, whatever the fractions say. */
  minPlanM: 7.5,
};

/**
 * The building's massing as a stack of boxes, bottom first. ALWAYS at least one
 * entry, and for a building with no setback that entry is exactly the box
 * `city.js` drew before this existed — so the no-setback path is unchanged by
 * arithmetic rather than by a branch.
 *
 * Each tier: `{ y0, y1, width, depth }` in metres, world-axis-aligned before
 * the building's own yaw (which `setMatrix` applies, as it does for every other
 * box in the city).
 */
export function buildingTiers(bld) {
  const s = bld.setbacks;
  if (!s || !s.length) return [{ y0: 0, y1: bld.height, width: bld.width, depth: bld.depth }];
  const out = [];
  let y = 0;
  let w = bld.width;
  let d = bld.depth;
  for (const step of s) {
    out.push({ y0: y, y1: step.at, width: w, depth: d });
    y = step.at;
    w = Math.max(SETBACK.minPlanM, w - 2 * step.inset * w);
    d = Math.max(SETBACK.minPlanM, d - 2 * step.inset * d);
  }
  out.push({ y0: y, y1: bld.height, width: w, depth: d });
  return out;
}

/** The topmost tier — where a roof sign stands and where the plant goes. */
export function topTier(bld) {
  const t = buildingTiers(bld);
  return t[t.length - 1];
}

/**
 * Roll a building's setbacks. One `rng` stream, drawn in a fixed ORDER and a
 * fixed COUNT for every building, so the stream position after this call does
 * not depend on the answer — the same discipline `rng.logNormal` observes for
 * the same reason.
 */
function rollSetbacks(rng, height) {
  const p = height < SETBACK.minHeightM
    ? 0
    : Math.min(SETBACK.pAtTall, SETBACK.pAtMin +
      ((SETBACK.pAtTall - SETBACK.pAtMin) * (height - SETBACK.minHeightM)) /
      (SETBACK.tallM - SETBACK.minHeightM));
  // Four draws, always, whatever the answer is.
  const roll = rng.next();
  const at1 = rng.range(0.50, 0.70);
  const at2 = rng.range(0.72, 0.86);
  const inset = rng.range(SETBACK.insetMin, SETBACK.insetMax);
  if (roll >= p) return null;
  const steps = [{ at: height * at1, inset }];
  if (height > SETBACK.secondTierM) steps.push({ at: height * at2, inset: inset * 0.86 });
  return steps;
}

/**
 * ROOF SIGNS — session 20, item 3, and the reason it is here rather than in
 * `city.js` is that it is a DESCRIPTION: the worker bakes this city from the
 * pure generator (§8.1) and everything a chunk contains has to be derivable
 * from `(rootSeed, cx, cz)` alone.
 *
 * WHY THEY ARE A SEPARATE VOCABULARY FROM THE `roof` MOUNTING THAT ALREADY
 * EXISTS. Session 14's `mount: 'roof'` is a SHOPFRONT sign that happens to be
 * bolted above a parapet: it is rolled from the same 0.9–6.2 m width band as a
 * fascia and it stands on its own elevation. What this session is asked for is
 * the other object — the thing you can read from a kilometre away, which is
 * sized off the BUILDING rather than off the shop, is lit far harder
 * (`LIGHT.roofSignNits` 600 against `signPlateNits` 86), and is the only
 * emitter in this city that sits ABOVE THE WINDOW BAND. That band is the whole
 * finding: STATE 19 §8 measured the elevated night frame at 99.30% shadow and
 * median code 7, and §4's and STATE 18 §3.2's impossibility proofs both end at
 * the same sentence — what moves that frame is emitted radiance at scale.
 *
 * ITS OWN RNG STREAM. `chunkRng(rootSeed, cx, cz, 'roofsign')`, not the `sign`
 * stream, because CONTRACT §6's determinism rule is that adding a system must
 * not shift an existing one's sequence, and drawing from `signRng` would move
 * every shopfront sign in the city.
 */
export const ROOF_SIGN = {
  /** Nothing shorter. Below this the sign is taller than the building's top third. */
  minBuildingM: 22,
  minFloors: 5,
  /**
   * WHETHER A TALL BUILDING GETS ONE, AND THE TWO NUMBERS ARE THIS FILE'S OWN.
   *
   * `0.32 + density · 0.40` is EXACTLY the roll the shopfront signage uses
   * twenty lines from here — "does this building carry signage at all" — and
   * reusing it is the claim rather than a coincidence: a building tall enough
   * to carry a roof sign is a building that carries signage, and inventing a
   * second density for the same question would be two numbers for one decision.
   *
   * Delivered, over the eligibility gate above (`height ≥ 22 m` and `≥ 5
   * floors`, which is about two thirds of the population), that is one roof
   * sign per 3.5 to 5 buildings — and roughly 72% of those are double-sided, so
   * from any one viewpoint about a fifth of the tall buildings in frame show a
   * lit sign. The count is printed at boot by `city.js` → `reportRoofSigns`
   * rather than estimated here.
   */
  pBase: 0.32,
  pDensity: 0.40,
  /** Face width as a fraction of the top tier's own frontage. */
  widthFracMin: 0.46,
  widthFracMax: 0.86,
  minWidthM: 6.0,
  maxWidthM: 26.0,
  /** Face height / face width. A rooftop sign is a band, not a plate. */
  aspectMin: 0.16,
  aspectMax: 0.34,
  /**
   * THE THREE MOUNTINGS, AND EACH IS CHOSEN BY WHAT IT DOES TO A SILHOUETTE
   * rather than by what it is — the same rule session 19 used for the five roof
   * plant kinds.
   *
   *   parapet     0.32  sits directly on the upstand. Reads as part of the
   *                     building; the cheapest and the commonest.
   *   frame       0.44  raised on an open lattice with daylight under it. This
   *                     is the one that puts a lit rectangle against the SKY
   *                     rather than against a roof, which is what makes a
   *                     skyline, and it is why it has the largest weight.
   *   cantilever  0.24  projects out over the parapet on brackets, so its
   *                     bottom edge is below the roof line and it reads from
   *                     the street directly beneath as well as from across the
   *                     city.
   */
  wParapet: 0.32,
  wFrame: 0.44,
  wCantilever: 0.24,
  /** How far a framed sign's bottom edge stands above the roof, in metres. */
  frameLiftMin: 2.4,
  frameLiftMax: 7.0,
  /**
   * CHROMA WEIGHTS OVER `city.js`'s SIX-ENTRY `SIGN_CHROMA`, IN ITS ORDER:
   * neonRed, neonCyan, sodium, fluorescentCold, tungsten, neonGreen.
   *
   * Weighted 0.64 toward the two low-saturation entries, and it is a budget
   * rather than a preference. `docs/authored-city.md`'s saturation reserve is a
   * CEILING on the share of pixels above 0.6 saturation and 0.5 value, measured
   * at 9.19% of a 12% ceiling in the last attested run — so an emitter added at
   * this scale in six equally-weighted colours is the one change that could
   * spend it. It is also what a real skyline looks like: corporate rooftop
   * signage is overwhelmingly white or warm white with one brand colour, and a
   * skyline of six neons in equal measure is the accident
   * `SIGN_CHROMA`'s own comment warns about one level down.
   */
  chromaWeights: [0.11, 0.08, 0.09, 0.34, 0.30, 0.08],
  /**
   * WHICH ONES ARE LIT ON BOTH FACES, AND IT IS DECIDED BY WHAT IS BEHIND THEM.
   *
   *   frame       sky behind it, so both faces are read and both are lit.
   *   parapet     a set of letters standing ON the upstand, with the roof
   *               behind rather than a wall — read from the far side across the
   *               roof, so both faces again. This is the commonest arrangement
   *               on a real parapet: the letters are freestanding and the
   *               upstand is only the thing they are bolted to.
   *   cantilever  hangs OVER an edge with the building's own elevation directly
   *               behind it. One face, and the back is a dark hoarding.
   *
   * 0.32 + 0.44 = 0.76 of roof signs are therefore two-faced, which is what
   * makes a skyline read from more than one direction — a city of single-sided
   * signs is a city with a front.
   */
  doubleSided: { parapet: true, frame: true, cantilever: false },
};

/**
 * THE PARAPET'S HEIGHT, AND IT IS HERE BECAUSE THREE THINGS NEED IT.
 *
 * `city.js` built its roof upstand at a literal 1.05 in `buildRoofscape` and
 * its `roof`-mounted signs at a second literal 1.05 forty lines away, under a
 * comment saying the second was "the same `ph` the facade loop uses, read from
 * there rather than guessed, so a change to the upstand cannot leave a sign
 * floating over it" — a claim about a link, with no link (§9.1). Session 20
 * makes it one number, and it is in the pure generator rather than in `city.js`
 * because a roof sign's WORLD HEIGHT is now part of the chunk's description and
 * the description has to be able to compute it.
 */
export const ROOF_PARAPET_M = 1.05;

/**
 * THE TALLEST THING THAT CAN STAND ON A ROOF — SESSION 25, AND IT IS HERE FOR
 * THE SAME REASON `ROOF_PARAPET_M` IS.
 *
 * A building's claim is `y0: 0, y1: height`, and `height` is the top of the
 * WALL. Everything on the roof stands above it, so `deck × building` — the one
 * pair `occupancy.js` decides on the vertical extent rather than on the
 * footprint — has been asking whether a viaduct passes through a building using
 * a box that stops at the eaves. Measured over the 11 × 11 ring
 * (`tools/claimprobe.mjs`): 1 436 plant boxes on 357 of 419 buildings, the
 * median roof standing **16.50 m** above its own claimed top and the worst
 * **18.72 m**.
 *
 * THE ARITHMETIC, which is city.js's `buildRoofscape` read as a bound rather
 * than as a roll. A plant unit is `ph = (1.8 + h·3.4) · kind.tall` with
 * `h ∈ [0, 1)`, so the size term maxes at 1.8 + 3.4 = 5.2 m; the tallest
 * `kind.tall` is the aerial's 3.60. 5.2 × 3.60 = **18.72 m**.
 *
 * A BOUND AND NOT THE DELIVERED VALUE, DELIBERATELY. The generator cannot know
 * what a roof rolled — the hash lives in `city.js` — and it must not draw a
 * uniform to find out, because the claim is made BEFORE the era's crown is
 * rolled and consuming a value early would move every stream after it
 * (CONTRACT §6). So the generator claims the envelope and `city.js` claims what
 * it actually drew. The generator is therefore conservative and the delivered
 * census is exact, which is the right way round: the registry says what was
 * TESTED and the census says what ARRIVED (CONTRACT §9.1). `claimprobe`
 * measures that the bound contains the delivered top on 419 of 419.
 *
 * ITS COST IS ZERO AND THAT IS WHY IT SHIPPED. Measured on both halves of the
 * two-sided check — the delivered census and the generator's own registry, the
 * second of which is the only one holding `water`, `path` and `block` — raising
 * `y1` to this bound produces **0 new forbidden pairs and refuses 0 placements**.
 * The planar half of the same defect costs 78 buildings and is written up in
 * STATE 25 §1 rather than built.
 *
 * `city.js` recomputes 18.72 from its own `ROOF_KINDS` table at module load and
 * says so beside this number, so a kind added with a taller aspect is a printed
 * disagreement rather than a claim that quietly stopped containing its roof.
 */
export const ROOF_PLANT_MAX_M = (1.8 + 3.4) * 3.60;

/**
 * THE HIGHEST POINT OF A BUILDING, from the generator's own fields.
 *
 * One expression, called by both building walks and by `city.js`'s consistency
 * print, because a roof height computed in two places is `pierEvery: 34` beside
 * `i % 3 === 0` with an elevation instead of a spacing (CONTRACT §9.1).
 *
 * THE CROWN IS BOUNDED RATHER THAN READ, and the bound is not a shrug: the
 * claim is laid before `crown` is rolled, and `crown` is `rng.range(0.15, 0.45)`
 * on the contemporary era and 0 on every other. So the crown reaches at most
 * `era.cornice + 0.45` on contemporary (whose `cornice` is 0.0, giving 0.45) and
 * `era.cornice` elsewhere, whose largest is prewar's 0.9. BOTH ARE UNDER
 * `ROOF_PARAPET_M` = 1.05, so on any building that gets a roofscape the crown
 * cannot be the binding term — and on one that does not, it is the only term.
 * Measured: the 62 buildings with no plant stand at most 0.900 m over their
 * claim, which is exactly prewar's cornice.
 */
export function buildingTopM(era, eraName, height, floors) {
  const crownMax = era.cornice + (eraName === 'contemporary' ? 0.45 : 0);
  /** `buildRoofscape` returns before the top parapet and the plant unless this holds. */
  const roofscape = floors > 4;
  return height + Math.max(
    crownMax,
    roofscape ? ROOF_PARAPET_M : 0,
    roofscape ? ROOF_PLANT_MAX_M : 0
  );
}

/**
 * Roll one building's roof sign, if it gets one, and push it into the chunk's
 * sign list. Always draws the SAME NUMBER OF UNIFORMS whatever it decides, so
 * the stream position after the call does not depend on the answer.
 */
function pushRoofSign(bld, rng, density, signs) {
  const tier = topTier(bld);
  const roofY = bld.height;

  /**
   * ALL THE UNIFORMS FIRST, FOR BOTH POSSIBLE SIGNS, WHATEVER IS DECIDED.
   * Sixteen draws every time this is called, so the stream's position after the
   * call does not depend on the answer — the same discipline `rng.logNormal`
   * observes one function up and for the same reason.
   */
  const roll = rng.next();
  const second = rng.next();
  const p = [0, 1].map(() => ({
    wf: rng.range(ROOF_SIGN.widthFracMin, ROOF_SIGN.widthFracMax),
    asp: rng.range(ROOF_SIGN.aspectMin, ROOF_SIGN.aspectMax),
    mr: rng.next(),
    fr: rng.next(),
    ar: rng.range(-0.25, 0.25),
    sr: rng.next(),
    chroma: weightedIndex(rng.next, ROOF_SIGN.chromaWeights),
    face: rng.next(),
  }));

  if (bld.height < ROOF_SIGN.minBuildingM || bld.floors < ROOF_SIGN.minFloors) return;
  if (roll >= ROOF_SIGN.pBase + ROOF_SIGN.pDensity * density) return;

  /**
   * ONE OR TWO, AND THE SECOND HALF OF THE ANCHOR THAT WAS DROPPED.
   *
   * `pBase`/`pDensity` are lifted from the shopfront roll twenty lines from
   * here — `signRng.next() < 0.32 + density · 0.4 ? signRng.int(1, 2) : 0` —
   * and the first version of this function took the PROBABILITY and threw away
   * the `int(1, 2)`. That is half an anchor: the rule this file already states
   * is that a building which carries signage carries ONE OR TWO pieces of it,
   * and a corner building with a sign on each of its two street elevations is
   * the commonest thing in any skyline photograph there is.
   *
   * 0.45 rather than the 0.5 an `int(1, 2)` gives, because the second sign is
   * on a DIFFERENT elevation and needs the building to have two worth facing;
   * `faces` below weights the front at 0.55 and the second draw is forced off
   * it, so the pair is a front sign and a flank sign rather than two fronts.
   */
  const count = second < 0.45 ? 2 : 1;

  const faces = bld.facing[0] === 'x'
    ? [bld.facing, bld.facing === 'x+' ? 'x-' : 'x+', 'z+', 'z-']
    : [bld.facing, bld.facing === 'z+' ? 'z-' : 'z+', 'x+', 'x-'];

  const deadP = { kept: 0.06, worn: 0.22, neglected: 0.52 }[bld.condition];

  for (let k = 0; k < count; k++) {
    const q = p[k];
    /**
     * WHICH ELEVATION. Weighted to the building's own front, because a rooftop
     * sign is bought to be read from the street the shop is on — but not
     * exclusively, because a skyline in which every sign faces the same way is
     * a skyline seen from one direction. The SECOND sign is forced off the
     * front so the pair reads from two directions rather than twice from one.
     */
    const facing = k === 0
      ? faces[weightedIndex(() => q.face, [0.55, 0.17, 0.14, 0.14])]
      : faces[1 + Math.min(2, Math.floor(q.face * 3))];

    /** The tier's extent ALONG this elevation. See `halfTanOf` in `city.js`. */
    const frontage = facing[0] === 'x' ? tier.depth : tier.width;
    const width = Math.min(ROOF_SIGN.maxWidthM, Math.max(ROOF_SIGN.minWidthM, frontage * q.wf));
    const faceH = width * q.asp;

    const roofMount = q.mr < ROOF_SIGN.wParapet ? 'parapet'
      : q.mr < ROOF_SIGN.wParapet + ROOF_SIGN.wFrame ? 'frame' : 'cantilever';
    const lift = roofMount === 'frame'
      ? ROOF_SIGN.frameLiftMin + q.fr * (ROOF_SIGN.frameLiftMax - ROOF_SIGN.frameLiftMin)
      : 0;

    /**
     * A CANTILEVERED SIGN HANGS OVER THE EDGE, so its centre sits lower than
     * the others': its bottom edge drops past the roof line by a third of its
     * own height, which is what makes it visible from the pavement directly
     * underneath as well as from across the city.
     */
    const centreY = roofMount === 'cantilever'
      ? roofY + ROOF_PARAPET_M + faceH / 2 - faceH / 3
      : roofY + ROOF_PARAPET_M + lift + faceH / 2;

    signs.push({
      x: bld.x, y: centreY, z: bld.z,
      facing,
      scale: 'roof',
      mount: 'rooftop',
      roofMount,
      width,
      aspect: q.asp,
      lift,
      doubleSided: ROOF_SIGN.doubleSided[roofMount],
      /** The roof this stands on and the TOP TIER's own plan, not the base's. */
      buildingHeight: roofY,
      buildingWidth: tier.width,
      buildingDepth: tier.depth,
      along: q.ar,
      /**
       * 15% NON-WORKING IS A FLOOR THE WHOLE POPULATION HAS TO MEET (session 12,
       * `docs/authored-city.md` §2), so a roof sign uses the SAME
       * condition-driven probabilities a shopfront does rather than a flat 15%.
       * A neglected building with a dead sign on its roof is the picture; a
       * random 15% is noise.
       */
      state: q.sr < deadP ? 'dead' : q.sr < deadP + 0.1 ? 'half' : 'lit',
      chroma: q.chroma,
      yawDeg: bld.yawDeg,
    });
  }
}

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

export const LOW_DETAIL_KINDS = ['parking', 'lot', 'yard', 'park', 'construction'];

/**
 * A PARK, AS THE SIX THINGS A PARK HAS — session 21.
 *
 * `park` has been in the list above since session 4 and session 19 gave it
 * grass and two crossing paths. What it still read as from the pavement was a
 * green rectangle with a cross on it, which is a pitch rather than a place —
 * the same distinction as density versus variation, one level up: **a lot has
 * to look like a lot.**
 *
 * Every number here is a length off something that already exists, because a
 * park's dimensions are not free — they are what fits in the 104.6 m island a
 * chunk leaves between its corridors.
 */
export const PARK = {
  /**
   * Metres. Half-width of a path. 1.4 is session 19's, kept: a 2.8 m path is
   * two people passing plus a pram, and it is 2/3 of the 4.2 m pavement it
   * joins — which is the right relation, because a park path carries less than
   * a street and looks wrong when it carries the same.
   */
  pathHalf: 1.4,
  /**
   * Metres the perimeter path loop stands in from the island edge. 7.0 leaves
   * a planting strip between the loop and the park's own edge treatment that
   * is wide enough for a tree — `PROP_HALF_WIDTH.tree` is about 1.9 m at
   * scale 1.25, so 7.0 fits a tree and its clearance on both sides of the
   * strip. A loop hard against the railing is a fence with a path against it.
   */
  loopInset: 7.0,
  /**
   * Metres. Half-size of the central paved circus the two cross paths run
   * into. 9.0 is three path widths, which is the smallest square that reads as
   * a place to stand rather than as a wide bit of path.
   */
  circusHalf: 9.0,
  /** Metres. Half-size of the thing in the middle of the circus. */
  centreHalf: 5.0,
  /**
   * Metres between park lamp columns. THE STREET'S IS 32 (`CITY.lampEvery`).
   * Half of it, because a park lamp is half the height and the pool a luminaire
   * throws scales with its mounting height — so 16 m keeps the same overlap
   * between pools that the street has, which is what stops a path being a
   * chain of separate discs. It is also the number that gives the night
   * something it does not have: light that is not in a straight line down a
   * street.
   */
  lampEvery: 16,
  /**
   * Metres. Mounting height of a park lamp's optic. 4.20 m against the
   * street's 8.08: BS 5489 puts a footpath column at 4 to 5 m where a traffic
   * route is 8 to 10, for the reason that matters here — a 4 m column lights
   * the path and the people on it, and an 8 m one lights the whole field.
   */
  lampHeight: 4.2,
  /** Metres. Length of one edge-treatment segment, and the gap left at an entrance. */
  edgeSegment: 2.4,
  edgeGapHalf: 4.5,
  /** The three edge treatments. A park that simply becomes street has no identity. */
  edgeKinds: ['railing', 'hedge', 'wall'],
  /**
   * Metres. Half-thickness of an edge treatment. 0.22 spans a hedge clipped to
   * 0.44 m, a 0.44 m low wall (one and a half bricks on flat) and a railing
   * with its standards — one number for three treatments, because what the
   * registry needs is the room it takes and all three take about the same.
   */
  edgeHalfT: 0.22,
  /** What is in the middle. Parks have a reason to walk to them. */
  centreKinds: ['pond', 'pavilion', 'monument', 'square'],
  /**
   * Tree clumps per park, and the metres a tree is scattered about its clump
   * centre. `docs/authored-city.md` §1's clumping rule applied to planting:
   * evenly spread trees read as an orchard, and the thing that makes a park
   * look planted rather than gridded is that the gaps between the groups are
   * bigger than the gaps inside them. 4 clumps over a 104.6 m island at a 9 m
   * spread puts the within-clump spacing at about 6 m and the between-clump
   * spacing at about 40 m — a factor of 7.
   */
  clumps: 4,
  clumpSpreadM: 9.0,
};

/**
 * A CONSTRUCTION SITE, AS A BLOCK TYPE — session 21, and it is legitimate
 * low-detail rather than an excuse for it.
 *
 * The addendum asks for 8% of blocks to be low-detail and the delivered figure
 * is 17%; what those blocks were was four kinds of empty. A site gives the city
 * three things nothing else in it has:
 *
 *   VERTICAL ASYMMETRY. A tower crane is tall, thin and off-balance — the
 *   opposite of the blocks' prisms — and it breaks the skyline in a way no
 *   building does, because every building here is a mass and this is a line.
 *
 *   MOTION ABOVE EYE LEVEL. Nothing moves above the street but the aircraft.
 *   A crane slewing its jib and raising a load is slow, repeating and legible
 *   at distance, which is the opposite of traffic and is why it reads from
 *   further away.
 *
 *   WORK LIGHTING. Flood masts pointing DOWN into an excavation are a light
 *   type this city does not have: hard, directional and downward, against a
 *   street lamp's pool and a sign's emission.
 */
export const SITE = {
  /** Metres. Hoarding height — 2.4 m is the standard plywood sheet on edge. */
  hoardingHeight: 2.4,
  hoardingSegment: 2.4,
  /** Metres the hoarding stands in from the island edge, leaving the pavement clear. */
  hoardingInset: 1.0,
  /**
   * Metres. HALF THE DEPTH A HOARDING PANEL ACTUALLY OCCUPIES — session 40,
   * and it was 0.12 for nineteen sessions against a delivered 0.43.
   *
   * `city.js` draws a panel 0.06 m thick AND TWO FEET: `put(±0.42·L, 0.06,
   * 0.18, 0.34, 0.12, 0.5)`, a 0.5 m brace offset 0.18 m to one side, so the
   * delivered footprint runs z ∈ [−0.07, +0.43] about the panel's centreline.
   * The claim was a symmetric ±0.12 — it did not contain the feet at all, and
   * a hoarding's feet are the part of it something stands next to.
   *
   * IT IS WHY `prop(container) × site(hoarding)` HAS BEEN ON THIS GATE SINCE
   * SESSION 22. STATE 22 diagnosed it TO THE FEET (0.34 × 0.5 = 0.170 m²
   * against 0.173 measured) and built two candidate repairs on the generator's
   * claim that changed nothing; session 24 found the delivered census reading a
   * 2.4 × 0.06 panel as a 2.4 × 2.4 square and repaired THAT, which removed the
   * false half of the pair and left this one. The measurement that closes it is
   * the same one both sessions had: the claim is 3.6× narrower than the boxes.
   *
   * 0.43 IS SYMMETRIC AND THEREFORE AN OVER-CLAIM ON THE PANEL SIDE, which is
   * `occupancy.js`'s stated safe direction: an over-claim shows up as a
   * conflict a reader can see, an under-claim shows up as nothing at all.
   */
  hoardingHalfDepth: 0.43,
  /**
   * Metres. The tower crane's mast height above the ground.
   *
   * A tower crane clears the building it is putting up by about 15 m of hook
   * height plus the jib. The generator's log-normal has a median of 34 m and a
   * p99 of 134 (`HEIGHT_DISTRIBUTION`), so a crane on an ordinary block is
   * building something around the median: 34 + 15 = 49, and the band below
   * spans that. 78 m at the top is the tallest and is still under the p99, so
   * a crane never out-tops the skyline it stands in — which is the point of
   * having it, since what reads is the CONTRAST between a line and a mass.
   */
  mastMinM: 42,
  mastMaxM: 78,
  /** Metres. Jib length. A 55 m jib on a 60 m mast is the ordinary proportion. */
  jibMinM: 38,
  jibMaxM: 62,
  /** Metres. The counter-jib, which is what makes the silhouette asymmetric. */
  counterJibFrac: 0.32,
  /** Seconds for one full slew. 240 s is 1.5°/s, which is a crane's own speed. */
  slewPeriodS: 240,
  /** Seconds for one hoist cycle, up and down. */
  hoistPeriodS: 46,
  /** Metres. Flood mast height, and how many a site gets. */
  floodHeightM: 9.0,
  floodPerSite: 3,
};

/**
 * THE GROUND THAT IS NOT A BUILDING — SESSION 40.
 * ==============================================
 *
 * WHAT WAS HERE BEFORE, AND IT WAS A LAW RATHER THAN AN ACCIDENT. `park` and
 * `construction` each got a count with a FLOOR under it — `22 + 26·d` and
 * `14 + 16·d` — because a park's planting is what a park IS and a site's
 * clutter is what a site IS. The other three low-detail kinds and the ordinary
 * block interior fell through to `(lowDetail ? 26 : 96) · d³`, a cubic law with
 * no floor at all.
 *
 * AND THE CUBIC LAW AND THE GATE THAT SELECTS THE KIND READ THE SAME FIELD,
 * WHICH IS WHAT MAKES IT A CEILING OF ONE. A chunk is low-detail BECAUSE
 * `density < CITY.lowDetailThreshold` = 0.34 — that is what put it there — so
 * `26 · d³` on a `parking`, `lot` or `yard` chunk cannot exceed
 * `26 × 0.34³ = 1.022`, and it rounds to ZERO below `d = 0.268`. The three
 * kinds were not sparsely furnished; they were capped at one object per chunk
 * by construction, and 84 of the 131 of them in twelve regions delivered
 * nothing at all on 1.094 hectares of open ground (`tools/groundprobe.mjs`,
 * seeds 1337–1348).
 *
 * THE FLOOR IS WHAT THE KIND IS, NOT WHAT THE DENSITY FIELD SAYS. A yard is a
 * yard whether it stands downtown or on the edge — the same sentence `PARK`'s
 * own 22 makes about planting — so every floor below is derived from a length
 * that belongs to that kind, and the derivation is beside the constant.
 *
 * THE FORM, STATED ONCE. `104.6/√N` is the mean spacing between N objects
 * spread evenly over the 104.6 m island, and it is the form `PARK` already
 * uses: `104.6/√22` = 22.3 m, which is the *"one object every 22 m"* its
 * comment quotes.
 *
 * > AND `SITE`'s OWN QUOTATION IS OFF BY ITS OTHER CONSTANT. That comment says
 * > *"14 plus a density term over the 104.6 m island is one object every
 * > 26 m"*. `104.6/√14` is **28.0 m**; 26.15 m is `104.6/√16`, the SLOPE's
 * > spacing rather than the FLOOR's. The floor is unchanged — this is the
 * > arithmetic beside it, corrected in the open (CONTRACT §9 rule 5).
 *
 * WHAT IS A PROP AND WHAT IS A FEATURE, BECAUSE THE SPLIT IS LOAD-BEARING AND
 * IT MOVES A GATE. A thing is a `prop` if its placement is a SCATTER and a
 * `feature` if it is a RUN, a ROW or a GRID — the distinction `park` already
 * draws between its trees (scattered) and its edging, lamps and centre piece
 * (structured). `objectCount` is `buildings + props + signs` and does NOT
 * count features, so `citycheck`'s clumping CV moves with the first and not
 * with the second. The split below is made on the placement and the CV cost of
 * both halves is printed in STATE 40 §5, so that nobody has to take on trust
 * that a row of parked cars is a row because a car park is rows.
 */
export const DEAD_ZONE = {
  /**
   * A CAR PARK, AND ITS FIXTURES ARE ITS LIGHTING. A surface lot is lit by
   * columns, and a 10 m column covers about a 30 m square to the 20 lux a
   * parking surface is lit to: `(104.6/30)² = 12.2 → 12`, spacing
   * `104.6/√12` = 30.2 m. The bays, the cars and the columns themselves are
   * `features` — they stand in rows — and this floor is the loose stuff
   * between them.
   */
  parking: { floor: 12, slope: 16 },
  /**
   * A WORKS YARD, AND ITS MODULE IS THE APRON A VEHICLE NEEDS TO BACK INTO A
   * STACK. A rigid van is 7.0 m long and a service apron is three of its own
   * lengths — 21 m — to back and turn. One stack per apron:
   * `(104.6/21)² = 24.8 → 24`, spacing `104.6/√24` = 21.4 m. It is the densest
   * floor of the five because a yard is the one dead zone that is WORKED.
   */
  yard: { floor: 24, slope: 16 },
  /**
   * A CLEARED LOT, AND ITS CONTENT IS WHAT THE LAST BUILDING LEFT. There is no
   * module to derive from because nothing operates here, so the floor is the
   * smallest number that is a placement rather than a scatter: one object per
   * THIRD of the island on each axis, `3 × 3 = 9`, spacing `104.6/√9` = 34.9 m.
   * The slope is the lowest of the five for the same reason.
   */
  lot: { floor: 9, slope: 12 },
  /**
   * THE BLOCK INTERIOR — the largest bare surface in the city and the one kind
   * here that is not a `LOW_DETAIL_KINDS` member at all.
   *
   * Session 35's depth takes a building 29.6 m into a 52.3 m half-block and
   * `lotDepthM()` caps it at 40.6 m, so the central `104.6 − 2 × 40.6` =
   * **23.4 m** square of every island is ground no perimeter building may
   * reach BY CONSTRUCTION. 659 of 963 built chunks had nothing standing in it
   * (`groundprobe --interiors`, twelve regions).
   *
   * WHAT A LIGHT-WELL CORE CONTAINS IS THE BLOCK'S SERVICING, which is the
   * answer to *"what is it for"* rather than a decoration: bin stores, a plant
   * enclosure, stacked material and a delivery bay. So its module is the same
   * 21.4 m van apron the `yard` is derived from — a block interior IS a
   * service yard — taken over the ground a built island actually has:
   * `groundprobe` measures the median open island ground of a `built` chunk at
   * **0.538 ha = 5 380 m²** over twelve regions, and `5 380 / 21.4² = 11.7`
   * → **12**. The slope is 14, so a core in the densest quarter carries 26: a
   * dense block services more.
   */
  core: { floor: 12, slope: 14 },
  /**
   * Metres. A parking bay and the aisle it is reached from. 2.5 × 5.0 m is the
   * ordinary urban bay and 6.0 m is the aisle a car needs to turn into one, so
   * a DOUBLE-LOADED MODULE — bay, aisle, bay — is `5.0 + 6.0 + 5.0` = 16.0 m.
   */
  bayW: 2.5,
  bayL: 5.0,
  aisleW: 6.0,
  /**
   * How many double-loaded modules an island carries. `floor(104.6/16.0)` is
   * 6, and 6 is not what a block-interior lot is: a parcel reached through ONE
   * entrance off ONE frontage does not run 500 spaces. TWO modules is 32.0 m
   * of the 104.6 m island — four rows of bays with circulation round them —
   * and it is the layout that reads as a car park from the air while leaving
   * the rest of the parcel as the surface it is.
   */
  modules: 2,
  /**
   * The share of bays with a car in them, and it is the CHUNK'S OWN DENSITY.
   *
   * LOOK.md §2's last bullet asks for density to have causes, and this is the
   * one surface in the city where the cause is literally the same quantity: a
   * car park in the core is full and one on the edge is half empty. A
   * low-detail chunk's density runs 0.10–0.34, so a lot delivers between a
   * tenth and a third of its bays occupied — the state that reads as USED,
   * where full reads as a showroom and empty reads as a defect. The PAINT is
   * there at every density, which is what makes the parcel legible as a car
   * park whatever the field says: that is the floor.
   */
  bayOccupancy: 'density',
  /** Metres. Height of the boundary rail round a car park, and of a yard's palisade. */
  railHeight: 1.10,
  palisadeHeight: 2.20,
  /** Metres. Segment length of a boundary run, and how far it stands inside the island. */
  edgeSegment: 3.0,
  edgeInset: 0.9,
  /** Metres. Half-width of the entrance gap in a boundary run. One per parcel. */
  gateHalf: 4.5,
  /** Metres. A car-park lighting column and the square it covers. */
  columnHeight: 10.0,
  columnEvery: 30.0,
};

// ---------------------------------------------------------------------------
// landmarks — docs/authored-city.md §6
//
// Hand-placed, and every one of them is something the generator cannot produce:
// the generator makes rectangular masses on lot lines between 9 and 150 m tall
// (`HEIGHT_DISTRIBUTION`, log-normal since session 20),
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
    /**
     * PORTAL FRAMES RATHER THAN COLUMNS — SESSION 21, AND IT IS THE REPAIR FOR
     * THE FINDING SESSION 5's ARGUMENT COULD NOT REACH.
     *
     * Session 5 re-aimed the arc so its piers would stand on ground you can
     * see, and it reasoned entirely about the origin block's EAST–WEST street.
     * It never asked what the arc does to the streamed lattice, and the answer
     * measured this session is: **8 of 23 piers stood in a carriageway and 2 on
     * a pavement**, because a 1.7 m column on the centreline of a road is a
     * column on the centreline of a road whichever street it crosses.
     *
     * A column cannot be made to fit. A 15.0 m carriageway leaves 7.5 m either
     * side of its centreline and the deck has to be held up somewhere, so the
     * support has to STRADDLE the road rather than stand in it — which is what
     * an elevated railway over a street is built as, everywhere it exists.
     *
     * THE OFFSET IS DERIVED AND EVERY CLEARANCE IS WRITTEN DOWN:
     *
     *   leg centre  = CITY.roadHalfWidth + pierLegHalf = 7.5 + 0.8 = 8.3 m
     *   inner face  = 7.50 m   exactly the kerb line: the carriageway is clear
     *   outer face  = 9.10 m
     *   vs the pedestrian lane centre (roadHalfWidth+CORRIDOR)/2 = 9.60 m
     *                                                     clear by 0.50 m
     *   vs the origin block's clear cross-street band |x| <= 10.5 m
     *                                                     clear by 1.40 m
     *   vs the island edge (the building line) at CORRIDOR = 11.7 m
     *                                                     clear by 2.60 m
     *
     * So a portal stands with one leg hard against each kerb, the carriageway
     * passes between them, 2.6 m of pavement stays walkable outside each leg,
     * and the whole frame fits inside the band session 5 measured the origin
     * block as leaving clear. `citycheck` asserts the last of those as a
     * number rather than trusting this paragraph.
     *
     * WHERE THE DECK DOES NOT CROSS A ROAD SQUARE ON, the two legs are not
     * symmetric about the carriageway and the offset alone cannot save them —
     * so the pier's STATION is nudged along the deck as well. See
     * `viaductPiers`.
     */
    pierLegOffset: 8.3,
    pierLegHalf: 0.8,
    /**
     * Metres a pier may be moved along the deck to get both legs off a
     * carriageway. Half a bay: beyond that a pier is closer to its neighbour's
     * joint than to its own, and the span it is supposed to be dividing stops
     * being divided.
     */
    pierNudgeMaxM: 10.9,
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
     *
     * IT IS NOT A WEIR. THE NAME IS THE ONLY THING ABOUT IT THAT SAYS SO, AND
     * IT HAS COST A SESSION. A weir is a river structure; this claim's nearest
     * point is **417.04 m from the nearest river bank** and 468.70 m from the
     * centreline, with 3.26 chunk widths of city in between (measured session
     * 42 from `riverEdges` over the claim's own x range). That is not a
     * misplacement: `kind` is `basin`, and a detention basin belongs in its
     * catchment rather than on a channel, so the PLACEMENT is right and the
     * word is wrong. The name stays because twenty sessions of registry owner
     * strings, `landmark:weir` mesh names, gate output and STATE files key on
     * it; the correction lives here, where a reader meets it.
     *
     * AND IT IS DRY, WHICH THE PROFILE DECIDES RATHER THAN THE WORD. The floor
     * falls 0.40 m over its 102 m — 0.39% — so a permanent pool a metre deep
     * would stand at r = 255 m, four times the bowl. This cannot hold a pond;
     * it is a dry detention basin, and `city.js` builds the park that follows
     * from that, plus the 25.5 m outlet pool the same slope gives it.
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
 * THE IDEAL ROAD LATTICE, AS A PREDICATE — session 21.
 *
 * Roads run along every chunk boundary, so "is this point in a carriageway" is
 * a function of position and nothing else: the distance to the nearest multiple
 * of `CITY.chunkSize` on either axis, against `CITY.roadHalfWidth`.
 *
 * IT IS THE **IDEAL** LATTICE AND NOT THE DELIVERED ONE, DELIBERATELY, AND THE
 * REASON IS A CYCLE. The delivered carriageway is the ideal one clipped against
 * the river, the origin block and — as of this session — the keep-out registry,
 * which contains the viaduct's own legs. A pier placed against the DELIVERED
 * road would be placed against a road that is waiting to be clipped around the
 * pier, and neither could be computed first. Against the ideal lattice there is
 * no cycle, and the error is one-sided in the safe direction: a pier avoids a
 * carriageway that the river or the block may have taken away anyway, which
 * costs a nudge nobody needed and can never leave a leg in a live traffic lane.
 */
export function latticeCarriageway(x, z, pad = 0) {
  const s = CITY.chunkSize;
  const nx = Math.abs(x - Math.round(x / s) * s);
  const nz = Math.abs(z - Math.round(z / s) * s);
  const r = CITY.roadHalfWidth + pad;
  // STRICT, for `occupancy.overlaps`' reason: a leg whose inner face lands
  // exactly on the kerb line shares a line with the carriageway and not an
  // area. Non-strict here rejected the derived 8.3 m offset — 8.3 ≤ 7.5 + 0.8 —
  // and the search then walked past the answer it was given.
  return nx < r || nz < r;
}

/** The same question about the whole corridor — carriageway plus both pavements. */
export function latticeCorridor(x, z, pad = 0) {
  const s = CITY.chunkSize;
  const nx = Math.abs(x - Math.round(x / s) * s);
  const nz = Math.abs(z - Math.round(z / s) * s);
  const w = CORRIDOR + pad;
  return nx <= w || nz <= w;
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
    /** The circle the stations are on, so `arcStationAt` can land between two. */
    radius: R,
    a0,
    curveSign: l.curveSign,
    arcLength,
    bays,
    segsPerBay,
    /** Chord length between two stations, metres. */
    chord: arcLength / n,
    /** What the piers ACTUALLY come out at, next to what was asked for. */
    pierSpacing: arcLength / bays,
    pierSpacingAsked: l.pierEvery,
    /**
     * Half-width of ONE PORTAL LEG, metres — session 21. It was `pierHalf: 1.7`,
     * the half-width of a single shaft on the deck's own centreline, and that
     * shaft stood in a carriageway 8 times in 23. See `LANDMARKS` → viaduct.
     */
    legHalf: l.pierLegHalf,
    legOffset: l.pierLegOffset,
  };
}

/**
 * Could the building generator have produced this shape?
 *
 * The generator makes axis-aligned rectangular masses — since session 20,
 * STEPPED ones — 9 to 150 m tall, 11 to 27 m wide, with a cornice and windows.
 * Anything that is not a box, or is outside that height band, is outside its
 * range. citycheck asserts every landmark is (`M.generatorProducible`), because
 * a landmark the generator can make is not a landmark, it is a building.
 *
 * THE BAND IS READ FROM `HEIGHT_DISTRIBUTION` RATHER THAN RETYPED FROM IT.
 * Session 20 replaced the uniform 12–64 with a log-normal clamped to 9–150, and
 * a hand-written 12–64 here would have gone on claiming a range the generator
 * left three functions ago — CONTRACT §9.1's config-the-code-does-not-read, with
 * the roles reversed. The band got 2.4× wider and every landmark is still
 * outside it, because every landmark is outside it by KIND: not one of the
 * eight is a box, so `generatorProducible` is empty for a reason no height
 * change can touch. That is worth knowing before somebody adds a ninth.
 */
export function generatorCanProduce(landmark) {
  if (landmark.kind !== 'box') return false;
  return landmark.height >= HEIGHT_DISTRIBUTION.minM && landmark.height <= HEIGHT_DISTRIBUTION.maxM;
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
 * The two yaws the ziggurat's steps alternate between, in degrees.
 *
 * ONE NUMBER, TWO READERS. `city.js` turns each step by these to break the
 * stack's silhouette; `landmarkOccluders` needs the same angle to state the
 * plan silhouette of a turned rectangle. They were two literals in two files
 * until session 42 — `pierEvery: 34` beside `i % 3 === 0`, in degrees — and the
 * claim was the one that was wrong by 0.4 m a side.
 */
export const ZIGGURAT_STEP_YAW_DEG = [-0.6, 0.8];

/**
 * Occluders a landmark contributes to the canyon bake, as axis-aligned boxes.
 *
 * Approximations of the real silhouette, and deliberately so: the bake marches
 * against boxes (lib/canyon.js) and a hyperboloid is not one. Three stacked
 * boxes at the base, waist and crown radii is within a couple of metres of the
 * real profile everywhere, and the field's voxels are two metres.
 *
 * EACH BOX CARRIES TWO EXTENTS AND THE SECOND ONE IS SESSION 42 — CONTRACT §9.
 * =========================================================================
 *
 * `x0..z1` is the BAKE extent, unchanged, and it is deliberately INSCRIBED: a
 * square at a round tower's true radius over-occludes its corners by 4/pi, so
 * the shrink factors below (0.82 for a hyperboloid, 0.70 for a cone) match the
 * box's AREA to the circle's. That is a defensible approximation for a march
 * against two-metre voxels.
 *
 * It is not defensible as a KEEP-OUT, and since session 34 this one list has
 * been both. An area-matched box used as the ground a landmark takes is
 * `landmarkOccluders` answering a third question it was never asked — the same
 * habit `landmarkGroundBlockers` was split out for, which its own comment
 * records: *"one list stand[ing] for two questions"*. What it cost, measured by
 * `tools/landmarkcensus.mjs` with every landmark resident (session 42; session
 * 35 had two of these three off-camera and never measured them):
 *
 *     landmark    claim      delivered      del/claim
 *     dish        62 x 62    88.0 x 88.0      2.041     radiusTop x 0.70
 *     mast         9 x 9     12.0 x 11.7      1.726     baseWidth/2, no diagonals
 *     condenser  102 x 102  124.0 x 124.0     1.487     radiusBase x 0.82
 *
 * The dish is the one the operator photographed: an inverted cone 26 m across
 * at grade and 88 m across at 56.8 m, leaning out over the carriageways of
 * x = -128 and z = -128 with traffic driving under it, because the claim that
 * clips those roads is 61.6 m wide and the object is 88 m wide.
 *
 * `gx0..gz1` is therefore the GROUND extent: the object's own plan silhouette,
 * which is what "the ground a landmark takes" means and what a claim has to
 * contain. It is CIRCUMSCRIBED where the bake extent is inscribed. Nothing is
 * weakened — every ground extent here is >= the bake extent it sits beside —
 * and the bake reads `x0..z1` exactly as before, so the canyon field is
 * untouched by this change.
 */
export function landmarkOccluders(l) {
  const box = (cx, cz, halfX, halfZ, top, groundHalfX = halfX, groundHalfZ = halfZ) => ({
    x0: cx - halfX, x1: cx + halfX, z0: cz - halfZ, z1: cz + halfZ, top, landmark: l.name,
    gx0: cx - groundHalfX, gx1: cx + groundHalfX, gz0: cz - groundHalfZ, gz1: cz + groundHalfZ,
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
        // The bake takes the area-matched box; the ground takes the profile's
        // own widest radius over this segment, which for the base segment is
        // `radiusBase` = 62 and is the 124.0 m the census measures delivered.
        const rTrue = Math.max(rAt(t0), rAt(t1));
        const r = rTrue * 0.82;
        out.push(box(l.x, l.z, r, r, l.height * t1, rTrue, rTrue));
      }
      return out;
    }
    case 'ziggurat': {
      const out = [];
      for (let i = 0; i < l.steps; i++) {
        const hx = l.footprint[0] / 2 - i * l.setback;
        const hz = l.footprint[1] / 2 - i * l.setback;
        if (hx <= 2 || hz <= 2) break;
        // The steps are drawn TURNED (`ZIGGURAT_STEP_YAW_DEG`), so the plan
        // silhouette of a turned rectangle is `hx·|cos| + hz·|sin|` on x and the
        // transpose on z — the 78.8 m the census measures against this 78 m.
        const t = (Math.max(...ZIGGURAT_STEP_YAW_DEG.map(Math.abs)) * Math.PI) / 180;
        const c = Math.cos(t);
        const s = Math.sin(t);
        out.push(box(l.x, l.z, hx, hz, (l.height * (i + 1)) / l.steps,
          hx * c + hz * s, hx * s + hz * c));
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
      for (const leg of viaductLegs(arc, l)) {
        out.push(box(leg.x, leg.z, arc.legHalf + 0.3, arc.legHalf + 0.3, l.height));
      }
      /**
       * SESSION 31. The station widens the deck and rises past it, and BOTH
       * halves of that have to reach this list or the widened part is mass
       * standing in the world that nothing was told about — CONTRACT §9.1's
       * placement rule, and session 23's viaduct abutment is the same object
       * making the same mistake. `city.js` draws the platform from
       * `viaductStations`; this claims the same span from the same function.
       */
      const stations = viaductStations(arc, l);
      for (let i = 0; i < arc.stations.length - 1; i++) {
        const a = arc.stations[i];
        const b = arc.stations[i + 1];
        const st = viaductStationSegment(stations, i);
        // Axis-aligned cover of one rotated deck segment: the chord's own
        // extent plus the deck's half-width. Conservative at the corners, which
        // for a sky-occlusion march at 2.79 m voxels is below a texel.
        //
        // `base` IS NEW AND THE BAKE STILL IGNORES IT — session 21. The canyon
        // march treats every occluder as solid to the ground, which for a deck
        // is conservative in the direction that darkens rather than brightens,
        // and changing that is a lighting decision this session is not making.
        // The KEEP-OUT REGISTRY reads it, and that is the whole point of
        // writing it down: "what blocks a ray to the sky" and "what a building
        // may not grow through" are the two questions session 5 answered with
        // one list, and a vertical extent answers both from one entry.
        /**
         * A station segment reaches `halfAcrossM` = 7.55 m instead of the
         * deck's 4.75, and tops out at the canopy rather than at the slab. The
         * `top` is the one that matters to the registry: `deck` conflicts with
         * `building` alone and the test is on `[y0, y1]`, so a canopy at 25.50
         * asks a taller question of the same buildings than a slab at 21.00.
         */
        const halfAcross = st ? st.halfAcrossM : l.deck / 2;
        const top = st ? st.topY : l.height;
        out.push({
          ...box(
            (a.x + b.x) / 2, (a.z + b.z) / 2,
            Math.abs(b.x - a.x) / 2 + halfAcross,
            Math.abs(b.z - a.z) / 2 + halfAcross,
            top
          ),
          base: viaductSoffitY(l) - VIADUCT_DECK_CLEARANCE_M,
          deck: true,
        });
      }
      /**
       * THE CORES ARE `landmark`, NOT `deck`, AND THE SPLIT IS THE WHOLE POINT
       * OF `occupancy.js` CARRYING A VERTICAL EXTENT. A platform is an elevated
       * structure with clear space under it and a stair core is a solid
       * standing on the ground — `deck` conflicts only with `building` and
       * `landmark` conflicts with the carriageway and the pavement it would be
       * standing in. One claim kind for both would be right about one of them.
       */
      for (const st of stations) {
        for (const core of st.cores) {
          const h = Math.max(
            VIADUCT_STATION.landingM + VIADUCT_STATION.goingM * VIADUCT_STATION.risersPerFlight,
            VIADUCT_STATION.liftSideM,
          ) / 2;
          const w = (VIADUCT_STATION.flightWidthM * 2 + VIADUCT_STATION.wellM
            + VIADUCT_STATION.liftSideM) / 2;
          // Axis-aligned cover of a core turned to the deck's own yaw.
          const c = Math.abs(Math.cos((core.yawDeg * Math.PI) / -180));
          const s = Math.abs(Math.sin((core.yawDeg * Math.PI) / -180));
          out.push(box(core.x, core.z, h * c + w * s, h * s + w * c, st.platformTopY));
        }
      }
      return out;
    }
    case 'dome':
      return [box(l.x, l.z, l.radius, l.radius, l.drum), box(l.x, l.z, l.radius * 0.72, l.radius * 0.72, l.height)];
    case 'basin':
      // A hole in the ground occludes nothing above grade, and saying so is the
      // whole reason this switch is explicit rather than a bounding box.
      return [];
    case 'mast': {
      /**
       * A LATTICE IS WIDER THAN ITS LEGS. `city.js` stands the legs at
       * `w0 = baseWidth·(1 − 0.62·t)/2` — 4.5 m at the base — and then draws one
       * diagonal per bay CENTRED at `w0 · 0.7` and `w0 · 2` long at an arbitrary
       * yaw, so the furthest a bay can reach from the axis is
       * `w0·0.7 + w0 = 1.7·w0` = 7.65 m. That is an upper bound over every yaw;
       * the delivered maximum at the yaws the mast actually uses is 6.0 m
       * (`landmarkcensus`: 12.0 x 11.7 against this 9 x 9). The bound is used
       * rather than the reading because a claim that tracks a measurement is a
       * claim that goes wrong the next time a yaw changes, and over-claiming
       * 1.65 m on a mast whose nearest carriageway is 42 m away costs nothing.
       */
      const legHalf = l.baseWidth / 2;
      return [box(l.x, l.z, legHalf, legHalf, l.height, legHalf * 1.7, legHalf * 1.7)];
    }
    case 'cone':
      // `city.js`'s lathe reaches `radiusTop` at `height − 1.2` — 44 m, i.e. the
      // 88.0 m the census measures — while the bake box is area-matched at 0.7
      // of it. The overhang starts at about 32.8 m up and every metre of it is
      // over ground this claim is what clips.
      return [box(l.x, l.z, l.radiusTop * 0.7, l.radiusTop * 0.7, l.height, l.radiusTop, l.radiusTop)];
    default:
      return [];
  }
}

/**
 * Where the piers actually stand, AFTER being moved off the carriageway.
 *
 * One list, so the geometry, the ground blockers, the occluders and the gate
 * all agree — `pierEvery: 34` beside `i % 3 === 0` is what this file's own
 * header is about, and a second copy of the nudge would be that arrangement
 * with a search instead of a spacing.
 *
 * THE SEARCH, AND WHY IT IS A SEARCH RATHER THAN AN OFFSET. `pierLegOffset` is
 * derived so that a portal STRADDLING a road square-on clears both kerbs. Where
 * the deck crosses at an angle θ the two legs are no longer symmetric about the
 * carriageway, and the transverse offset resolved onto the road's own axis is
 * `8.3·|sin θ|` — which vanishes as the deck turns to run ALONG the road. No
 * fixed offset can be right at every crossing angle, so the free parameter is
 * the one a bridge actually has: where along its own length the pier sits.
 *
 * Nearest-first, ±`pierNudgeMaxM` (half a bay) in 0.5 m steps, and the FIRST
 * clear position wins so the answer is deterministic and the smallest move. A
 * station that cannot be cleared keeps its authored position and is flagged —
 * `blocked: true` — rather than dropped: a bridge with a missing pier is worse
 * than one with a pier in the road, and a flag is something a gate can fail on
 * while a silent omission is not.
 */
export function viaductPiers(arc, l) {
  const authored = arc.stations.filter((s) => s.pier);
  if (!l || l.pierLegOffset === undefined) return authored;
  const maxNudge = l.pierNudgeMaxM;

  /**
   * TWO FREE PARAMETERS, SEARCHED NEAREST-FIRST, AND THE SECOND ONE IS WHY THE
   * FIRST WAS NOT ENOUGH.
   *
   * Nudging the station alone cleared 3 of the 8 blocked piers and left 9
   * blocked, because for 140 m either side of the crown the deck runs INSIDE
   * the x = 0 corridor rather than across it — there is no position along that
   * stretch where a symmetric portal fits, so moving along the deck moves the
   * problem rather than solving it. What varies down that stretch is the deck's
   * own drift off the road centreline: `x` runs 0.00 → −0.79 → −3.17 over three
   * bays as the arc turns away, so a portal centred on the DECK is up to 3.2 m
   * off centre on the ROAD and one leg is in a running lane while the other is
   * at the building line.
   *
   * So each leg gets its own offset. A portal whose legs are at 6.6 m and
   * 10.4 m is still a portal — the crosshead spans whatever it spans — and it
   * is what a real structure does when the street under it is not symmetric
   * about the track.
   */
  const oneLeg = (st, side) => {
    for (let d = 0; d <= VIADUCT_LEG_OFFSET_SPAN_M + 1e-9; d += 0.25) {
      for (const sign of d === 0 ? [1] : [1, -1]) {
        const off = l.pierLegOffset + sign * d;
        if (off < VIADUCT_LEG_OFFSET_MIN_M || off > VIADUCT_LEG_OFFSET_MAX_M) continue;
        const leg = legAt(st, off, side);
        if (legIsClear(leg, l.pierLegHalf)) return leg;
      }
    }
    return null;
  };
  const place = (st) => {
    const a = oneLeg(st, -1);
    const b = oneLeg(st, +1);
    if (a && b) return [a, b];
    return null;
  };

  const out = [];
  for (const st of authored) {
    let legs = place(st);
    let station = st;
    let nudge = 0;
    for (let d = 0.5; d <= maxNudge + 1e-9 && !legs; d += 0.5) {
      for (const sign of [-1, 1]) {
        const cand = arcStationAt(arc, st.s + sign * d);
        const got = place(cand);
        if (got) { legs = got; station = cand; nudge = sign * d; break; }
      }
    }
    /**
     * A HAMMERHEAD WHERE A PORTAL WILL NOT FIT, AND IT IS A REAL STRUCTURE
     * RATHER THAN A CLIMBDOWN.
     *
     * Two stations — s = ±65.5, deck centre at x = −7.11, i.e. 0.39 m inside
     * the x = 0 carriageway's own kerb — have no portal solution at any
     * station nudge or leg offset in the band: reaching the far kerb from
     * there needs an offset of 15.8 m against a maximum of 10.9, and the deck
     * stays inside that corridor for 47 m either way, which is more than half
     * a bay. What DOES fit is one leg on the clear side with the deck
     * cantilevered out to it — a hammerhead bent, which is what is built
     * wherever a road cannot be straddled.
     *
     * Tried LAST rather than as an equal option, because a portal is the
     * better structure where there is room for one and a search that treated
     * them as equivalent would build hammerheads for convenience.
     */
    if (!legs) {
      const solo = oneLeg(st, -1) || oneLeg(st, +1);
      if (solo) legs = [solo];
    }
    out.push(legs
      ? { ...station, nudgeM: nudge, blocked: false, hammerhead: legs.length === 1, legs }
      : { ...st, nudgeM: 0, blocked: true, hammerhead: false, legs: legsAt(st, l.pierLegOffset) });
  }
  return out;
}

/**
 * Metres. The band a portal leg's transverse offset may be searched over.
 *
 *   MAX 10.9 = CORRIDOR (11.70) − pierLegHalf (0.80). The leg's outer face
 *   lands exactly on the island edge, which is the building line: one step
 *   further and the leg is inside a building, which is the defect this whole
 *   change is about.
 *
 *   MIN 5.0. A portal 10 m wide cannot straddle a 15.0 m carriageway at all,
 *   so below this there is no configuration in which both legs are clear and
 *   searching further is searching for something that is not there. It is
 *   reached only where the deck is well away from the lattice, and there the
 *   first offset tried already succeeds.
 *
 *   SPAN 5.9 = the larger of (8.3 − 5.0) and (10.9 − 8.3), so the nearest-first
 *   sweep reaches both ends of the band. Writing it as a derived span rather
 *   than as a third number is what stops it going stale when either end moves.
 */
export const VIADUCT_LEG_OFFSET_MIN_M = 5.0;
export const VIADUCT_LEG_OFFSET_MAX_M = 10.9;
export const VIADUCT_LEG_OFFSET_SPAN_M = 5.9;

/**
 * Half-width, metres, of the band the origin block leaves clear at every `z`.
 *
 * SESSION 5's OWN NUMBER, PROMOTED OUT OF A COMMENT. `LANDMARKS` → viaduct says
 * *"The block leaves x ∈ [−10.5, 10.5] clear at every z"*, and that sentence is
 * the entire reason the viaduct crosses where it does. It was prose, so nothing
 * could check it and nothing did — and this session's measurement found a leg
 * reaching |x| = 12.18 m, 1.68 m past the band the placement was justified by.
 * CONTRACT §9.1: a value in a comment that the code does not read.
 */
export const BLOCK_CROSS_CLEAR_HALF_M = 10.5;

/** May a leg stand here? The one predicate, so the search and the gate agree. */
function legIsClear(leg, half) {
  if (latticeCarriageway(leg.x, leg.z, half)) return false;
  if (insideKeepout(leg.x, leg.z, 0) && Math.abs(leg.x) + half > BLOCK_CROSS_CLEAR_HALF_M) return false;
  if (riverBlocks(leg.x, leg.z, half)) return false;
  return true;
}

/**
 * A station at an arbitrary arc distance, interpolated on the CIRCLE rather
 * than between two chords.
 *
 * `viaductArc` builds its stations from the exact circle; a nudged pier taken
 * by lerping two of them would sit up to one sagitta inside the curve — 0.05 m,
 * which is nothing — but it would also carry a tangent that is the CHORD's and
 * not the curve's, and the tangent is what the legs are offset along. Same
 * expressions as the loop in `viaductArc`, and they are here rather than
 * duplicated there because a second copy of a curve is what CONTRACT §9's
 * viaduct row is made of.
 */
function arcStationAt(arc, s) {
  const [cx, cz] = arc.centre;
  const a = arc.a0 + (arc.curveSign * s) / arc.radius;
  const x = cx + Math.cos(a) * arc.radius;
  const z = cz + Math.sin(a) * arc.radius;
  const dx = -Math.sin(a) * arc.curveSign;
  const dz = Math.cos(a) * arc.curveSign;
  return { s, x, z, yawDeg: (-Math.atan2(dz, dx) * 180) / Math.PI, tangent: [dx, dz], pier: true };
}

/**
 * The two legs of one portal, in world XZ.
 *
 * The transverse direction is the tangent turned a quarter turn in the ground
 * plane — `(dx, dz) → (−dz, dx)` — so a leg is offset ACROSS the deck whatever
 * the deck's heading. Writing it as a rotation of the tangent rather than as a
 * yaw and a trig pair is the version that cannot pick up the sign error that
 * CONTRACT §9's table records for the quayside terrace.
 */
export function legAt(station, offset, side) {
  const [dx, dz] = station.tangent;
  return {
    x: station.x + side * -dz * offset,
    z: station.z + side * dx * offset,
    side,
    offset,
    station,
  };
}

export function legsAt(station, offset) {
  return [-1, 1].map((side) => legAt(station, offset, side));
}

/** Every leg of every portal — the ground the viaduct actually stands on. */
export function viaductLegs(arc, l) {
  const out = [];
  for (const p of viaductPiers(arc, l)) {
    for (const leg of p.legs) out.push({ ...leg, blocked: p.blocked });
  }
  return out;
}

/**
 * Metres of clearance under the deck that a building must fit inside.
 *
 * The soffit is `height − slabThick − boxDepth` = 21 − 0.9 − 1.9 = **18.20 m**
 * (`city.js`'s viaduct case owns those three numbers and this is the one place
 * that reads their sum). 4.00 m below it is 14.20 m, and `buildRoofscape` puts
 * up to 3.40 m of plant on a roof — so a 14.20 m building with a full roofscape
 * reaches 17.60 m and clears the soffit by 0.60 m. That is what a building is
 * allowed to be under an elevated railway, and it is four storeys, which is
 * what is under one in every city that has one.
 */
export const VIADUCT_DECK_CLEARANCE_M = 4.0;

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
  // Ground extents, not bake extents — session 42. A person is stopped by the
  // object's plan silhouette, and the bake box is an area match that is 0.70 of
  // it under the dish. Same list, the other pair of numbers.
  if (l.kind !== 'viaduct') {
    return landmarkOccluders(l).map((o) => ({
      ...o, x0: o.gx0, x1: o.gx1, z0: o.gz0, z1: o.gz1,
    }));
  }
  const arc = viaductArc(l);
  const half = arc.legHalf + 0.3;
  return viaductLegs(arc, l).map((p) => ({
    x0: p.x - half, x1: p.x + half, z0: p.z - half, z1: p.z + half,
    top: l.height, landmark: l.name,
  }));
}

/**
 * EVERY BOX A LANDMARK TAKES OFF THE ROAD NETWORK, AS ONE LIST — SESSION 34.
 * =========================================================================
 *
 * WHAT THIS IS FOR. `generateChunk` clips the carriageway and the pavement
 * against the `landmark` claims it lays down, so the delivered road network
 * already has holes in it wherever a landmark stands. Nothing that MOVES knew
 * that. `traffic.js` refuses a lattice line the river took (`riverNoRoad`) and
 * has never had the equivalent sentence about a landmark, so the fleet drives
 * across every one of them.
 *
 * THE ONE THAT MATTERS IS THE WEIR AND IT IS A DISTRICT. `landmarkAABB(weir)`
 * is **210 × 210 m = 44 100 m²** — 2.69 chunks. Rastered at 0.5 m, the union
 * of every landmark's ground claims is **69 658 m² and the weir is 63.3% of
 * it, 4.28× the next largest** (the condenser's stacked boxes, 10 302 m²).
 *
 * Measured at seed 1337: the road lattice loses two whole north–south avenues
 * (x = −384 and x = −256, 84 m and 44 m from the basin's centre against its
 * 105 m radius) and one east–west street (z = 128) for 210 m each, and the
 * fleet ran along all three. Over `citycheck`'s own 1 280 m region that is
 * **1 050 m of the 28 182 m of lattice centreline — 3.73% — with no
 * carriageway under it**, and the fleet drove every metre.
 *
 * WHY IT IS A FUNCTION AND NOT A SECOND PREDICATE. `landmarkBlocks()` already
 * exists and looks like the answer. It is not, and both of its disagreements
 * with the registry are CONTRACT §9 rule 7's own shape:
 *
 *   - for a `basin` it falls back to a CIRCLE at `landmarkFootprint/2`, where
 *     the registry claims the AABB — 34 636 m² against 44 100, a 21%
 *     disagreement all of it in the four corners;
 *   - for the viaduct it tests `landmarkOccluders`, which INCLUDES the deck
 *     segments, where the registry claims those as `deck` — a category a
 *     carriageway is explicitly allowed to sit under, because an elevated
 *     railway over a street is the thing the split was written for.
 *
 * So this returns exactly the boxes `generateChunk` claims as `landmark`, and
 * `generateChunk` now claims FROM IT rather than beside it. One description,
 * three readers: the claim, the road clip that reads the claim, and
 * `landmarkOccupies` below.
 *
 * MEMOISED PER LANDMARK. `viaductArc` → `viaductLegs` → `viaductEnds` is a few
 * hundred trig calls and `landmarkOccupies` is called once per vehicle per frame.
 * The landmarks are authored data and never change, so the cache is keyed on
 * the object itself and never invalidated.
 */
const landmarkGroundClaimCache = new Map();

export function landmarkGroundClaims(l) {
  const hit = landmarkGroundClaimCache.get(l);
  if (hit) return hit;
  const out = [];
  for (const o of landmarkOccluders(l)) {
    // A deck flies over the street rather than standing in it, and a viaduct's
    // ground contact is its legs — both handled below.
    if (o.deck || l.kind === 'viaduct') continue;
    // The GROUND extent — the plan silhouette. Session 42; see the header of
    // `landmarkOccluders` for the three landmarks this moved and by how much.
    out.push({ x0: o.gx0, x1: o.gx1, z0: o.gz0, z1: o.gz1, y0: 0, y1: o.top, owner: l.name });
  }
  if (l.kind === 'viaduct') {
    for (const g of landmarkGroundBlockers(l)) {
      out.push({ x0: g.x0, x1: g.x1, z0: g.z0, z1: g.z1, y0: 0, y1: g.top, owner: `${l.name}:leg` });
    }
    for (const e of viaductEnds(viaductArc(l), l)) {
      /**
       * `tested: true` carries session 23's `if (reg.conflict(box)) continue`
       * to the one reader that can honour it. The other two cannot — they have
       * no registry — and that is stated rather than hidden: an end treatment
       * refused by a chunk's registry is a box `landmarkOccupies` still calls
       * blocked. Today that difference is EMPTY, because the comment at the
       * claim site records the test as inert (nothing forbidden to `landmark`
       * has been claimed by that point), and it is the conservative direction
       * for a vehicle either way.
       */
      out.push({
        x0: e.claim.x0, x1: e.claim.x1, z0: e.claim.z0, z1: e.claim.z1,
        y0: 0, y1: e.claim.top, owner: `${l.name}:end`, tested: true,
      });
    }
  }
  if (l.kind === 'basin') {
    /**
     * A basin occludes nothing above grade, so `landmarkOccluders` returns []
     * for it and the loop above contributes nothing. It is still 210 m of
     * ground, and `y0` is BELOW the datum rather than at it: the thing is a
     * hole, and the claim has to say so or a future reader asking "what is
     * under this" gets a box that starts where the floor ends.
     */
    const a = landmarkAABB(l);
    /**
     * `y0` is the LOWEST POINT OF THE DELIVERED SECTION and not `-l.depth`,
     * which was the floor's edge and stopped 0.40 m above the outlet even
     * before session 42 dug the pond 1.50 m below that. A claim that starts
     * where the floor ends is exactly the reader-gets-a-box-that-starts-at-the-
     * wrong-place this comment was written against.
     */
    const y0 = Math.min(...basinProfile(l).map((p) => p[1]));
    out.push({ x0: a.x0, x1: a.x1, z0: a.z0, z1: a.z1, y0, y1: l.height, owner: l.name });
  }
  landmarkGroundClaimCache.set(l, out);
  return out;
}

/**
 * DOES A LANDMARK STAND ON THE GROUND AT (x, z)?
 *
 * ONE NAME, BECAUSE THE RIVER'S TWO ARE A REAL DISTINCTION AND A LANDMARK'S
 * WOULD NOT BE. The river needs both `riverImpassable` and `riverNoRoad`: an
 * east–west road LINE inside the channel is refused whole even at the 13% of
 * stations where the meander leaves it on dry land, so what stops a vehicle
 * and what stops a walker are genuinely different questions. A landmark's
 * footprint is one solid and stops both, so a second name would be two names
 * for one answer — which is the thing this function exists to end. Six readers
 * had six spellings of it before session 34 and three of them could not see
 * the largest landmark on the map.
 *
 * A POINT TEST, AND THE DATUM IS THE CALLER'S OWN ORIGIN. Said rather than
 * assumed (CONTRACT §9 rule 7): a 12 m bus whose origin is 1 m outside the
 * weir's claim has 5 m of itself inside it. `traffic.js`'s recycle pass runs
 * every frame, so a body crossing the boundary is recycled within
 * `len/2 / v` ≈ 0.5 s of its nose entering — the same tolerance the river
 * case has carried since session 15. Callers with a body pass `pad`.
 *
 * IT IS LOCAL IN BOTH AXES AND `riverNoRoad` IS NOT, which is why this refuses
 * a POINT rather than a lattice line: a landmark takes 210 m of an avenue and
 * refusing the line would empty the kilometre either side of it.
 */
export function landmarkOccupies(x, z, pad = 0) {
  for (const l of LANDMARKS) {
    // The AABB rejects seven of the eight landmarks in four comparisons. It is
    // computed from `landmarkOccluders`, which for the viaduct is WIDER than
    // the ground claims below — conservative in the direction that only costs
    // a few more box tests.
    const a = landmarkAABB(l);
    if (x < a.x0 - pad || x > a.x1 + pad || z < a.z0 - pad || z > a.z1 + pad) continue;
    for (const g of landmarkGroundClaims(l)) {
      if (x > g.x0 - pad && x < g.x1 + pad && z > g.z0 - pad && z < g.z1 + pad) return true;
    }
  }
  return false;
}

/**
 * THE BASIN'S SECTION, AND THE REASON IT IS IN THIS FILE — SESSION 34.
 * ====================================================================
 *
 * WHAT WAS WRONG, MEASURED BEFORE ANYTHING WAS CHANGED. `city.js` builds the
 * weir as a lathe reaching from **+0.40 m down to −9.40 m**. `block.js` builds
 * ONE 8 km × 8 km opaque earth plane at **−0.02 m** with a hole cut for the
 * river and for nothing else. So **9.40 m of the basin's 9.80 m — 96% of it —
 * is drawn underneath an opaque plane**, and what a frame shows where a 210 m
 * sunken park is supposed to be is flat brown earth with a thin white arc on
 * it: the 0.42 m of retaining ring that stands proud of the plane.
 *
 * That arc is STATE §11's *"the unexplained ground arc near the origin"*,
 * carried as a known gap since session 8. It is the top of this wall.
 *
 * CONTRACT §9.1 already carries the row — *"Geometry authored and then drawn
 * inside something else"* — and this is the largest instance of it in the
 * project by two orders of magnitude: 34 636 m² of basin inside 64 km² of
 * plane.
 *
 * WHY THE PROFILE MOVED HERE. Cutting the plane needs the rim's polyline, and
 * the rim's polyline is a property of the lathe `city.js` draws. Two
 * descriptions of one circle is the arrangement `block.js`'s own earth comment
 * argues against for the river — *"the earth is emitted as a quad strip on the
 * SAME station lattice `river.js` builds the water from, so the three edges are
 * the same polyline and cannot crack apart"*. This is that sentence with a
 * basin instead of a bank: the profile and the segment count are declared once,
 * here, beside the landmark; `city.js` lathes them and `block.js` cuts on them.
 */
export const BASIN_LATHE_SEGMENTS = 40;

/**
 * The section, as `[radius, y]` pairs from the rim inward. Unchanged from the
 * literals `city.js` carried since session 4 — this is a move, not a redesign,
 * and the geometry it produces is identical.
 *
 *     r = radius       y = +0.40   retaining ring, the only part above grade
 *     r = radius       y = −0.60   its inner face
 *     r = radius − 3   y = −1.20   the ledge
 *     r = radius − 3   y = −depth  a 7.80 m vertical drop
 *     r = 0.02         y = −depth − 0.40   the floor, falling to the outlet
 */
export function basinProfile(l) {
  const p = basinPond(l);
  return [
    [l.radius, 0.4], [l.radius, -0.6],
    [l.radius - 3, -1.2], [l.radius - 3, -l.depth],
    [p.radius, p.rimY],
    [p.radius - p.bankRun, p.floorY],
    [0.02, p.floorY],
  ];
}

/**
 * THE PERMANENT POOL AT THE OUTLET — SESSION 42, and it is a change to the
 * section rather than a decoration laid on it.
 *
 * WHY THE SECTION HAD TO MOVE. The floor above falls 0.40 m over its 102 m — a
 * slope of 0.39% — so standing water 0.10 m deep reaches r = 25.5 m and water
 * 1.00 m deep would stand at r = 255 m, four times the bowl. The first attempt
 * put a 0.10 m sheet on that floor and it TORE: a 40-gon cone's chords sag
 * `r(1 − cos(pi/40))` = 0.077 m at r = 25, which is the same order as the water
 * was deep, so the floor surfaced through it in alternating sectors. A depth
 * under the mesh's own faceting is not a depth.
 *
 * So the outlet is dug into a pool the section can actually hold, which is what
 * a wet detention basin has anyway — the dry floor is the storage that fills in
 * a storm, and the permanent pool sits at the outlet and does not.
 *
 *   AREA      20% of the basin floor, the usual permanent-pool share of a wet
 *             detention basin, so `r = floorR x sqrt(0.20)` = 102 x 0.4472 =
 *             **45.6 m** and the pool is 6 538 m² of the floor's 32 685.
 *   DEPTH     1.50 m. A permanent pool shallower than about a metre roots over
 *             and stops being open water; 1.5 m is the ordinary minimum.
 *   BANK      1:4, the steepest side slope a public water's edge is given, so
 *             the bank runs 6.0 m in from the rim before the bottom is flat.
 *
 * The water surface `city.js` draws sits at `rimY`, so the pool is 1.50 m deep
 * at the middle and meets the ground exactly at r = 45.6 m — 24x the faceting
 * sag there, which is the number the first attempt did not have.
 */
export function basinPond(l) {
  const floorR = l.radius - 3;
  const depthM = 1.5;
  return {
    radius: floorR * Math.sqrt(0.2),
    bankRun: depthM * 4,
    rimY: -l.depth - 0.4,
    floorY: -l.depth - 0.4 - depthM,
    depthM,
  };
}

/**
 * The rim, as the same `{ x, north, south }` stations `riverBankStations`
 * returns — one entry per distinct x, `north` the smaller z.
 *
 * THE VERTICES ARE THE LATHE'S OWN. `THREE.LatheGeometry` places vertex k at
 * `(r·sin θ, y, r·cos θ)` for `θ = 2πk/segments`, so this walks the same
 * angles at the same count. A cut computed from `sqrt(r² − dx²)` on a uniform
 * x lattice would be a DIFFERENT polygon inscribed in the same circle, and at
 * the two extremes — where the arc's slope in x is infinite — a 16 m station
 * spacing puts the chord **8.0 m** inside the rim, i.e. an 8 m tongue of earth
 * lying over the bowl at each end. Walking the lathe's angles instead makes
 * the spacing dense exactly where the arc is steep, which is what a lathe's
 * uniform angular step is for.
 */
export function basinRimStations(l) {
  const n = BASIN_LATHE_SEGMENTS;
  const by = new Map();
  for (let k = 0; k < n; k++) {
    const th = (k / n) * Math.PI * 2;
    const x = l.x + l.radius * Math.sin(th);
    const z = l.z + l.radius * Math.cos(th);
    // Keyed to a micrometre: θ and π − θ give the same x to within an ulp and
    // have to land in the same station or the polygon gains a 1e-16 m sliver.
    const key = x.toFixed(6);
    const e = by.get(key);
    if (!e) by.set(key, { x, north: z, south: z });
    else { e.north = Math.min(e.north, z); e.south = Math.max(e.south, z); }
  }
  return [...by.values()].sort((a, b) => a.x - b.x);
}

/** Every landmark that is a hole in the ground rather than a mass on it. */
export function sunkenLandmarks() {
  return LANDMARKS.filter((l) => l.kind === 'basin');
}

/**
 * WHAT A PERSON STANDING AT (x, z) INSIDE A BASIN IS STANDING ON, or null.
 *
 * The section above, read as a function of radius — so it cannot disagree with
 * the lathe, which is the whole reason the profile is one array. `block.js`'s
 * `blockSurfaceAt` consults this before it answers `earth`, because the earth
 * is no longer there: a query that went on answering −0.02 m over a hole its
 * own module had just cut is §9.1's two-descriptions defect introduced by the
 * repair for §9.1's two-descriptions defect.
 *
 * IT USES THE CIRCLE AND `basinRimStations` USES THE 40-GON, AND THAT
 * DISAGREEMENT IS NAMED RATHER THAN LEFT. The polygon is inscribed, so between
 * two rim vertices the drawn edge is up to `r(1 − cos(π/40))` = **0.32 m**
 * inside the circle this function tests. A foot in that 0.32 m band is told it
 * is on the ledge when the drawn ledge stops just short of it. It is under the
 * 0.20 m `PLAYER.stepUpM` in height terms and a third of a metre in plan; it
 * is recorded here so the next reader does not have to re-derive it.
 */
export function basinSurfaceAt(x, z) {
  for (const l of sunkenLandmarks()) {
    const d = Math.hypot(x - l.x, z - l.z);
    if (d >= l.radius) continue;
    const prof = basinProfile(l);
    // The profile runs outward-in, so walk it and take the first band the
    // radius falls in. Linear between the two points that bracket it, which is
    // exactly what the lathe's own triangles interpolate.
    for (let i = 0; i < prof.length - 1; i++) {
      const [ra, ya] = prof[i];
      const [rb, yb] = prof[i + 1];
      if (d > ra || d < rb) continue;
      const t = ra === rb ? 0 : (ra - d) / (ra - rb);
      return { y: ya + (yb - ya) * t, kind: 'basin', known: true };
    }
    // Inside the innermost profile radius (0.02 m): the outlet.
    return { y: prof[prof.length - 1][1], kind: 'basin', known: true };
  }
  return null;
}

/**
 * The underside of the viaduct's deck, in metres above the ground datum.
 *
 * ONE EXPRESSION, AND SESSION 31 COUNTED ITS READERS RATHER THAN TRUSTING
 * THIS PARAGRAPH. What it used to say was that the number is read by three
 * things, naming `city.js` first. `city.js` DOES NOT IMPORT EITHER CONSTANT:
 * it declares its own `const slabThick = 0.9` and `const boxDepth = 1.9` and
 * computes its own soffit from them, so the module that DRAWS the section is
 * the one place that does not read the number. `viaductSoffitY` is read by
 * `moving.js` and by `portalprobe`; `VIADUCT_SLAB_THICK_M` and
 * `VIADUCT_BOX_DEPTH_M` are read by nothing outside this file except through
 * it. That is the roof parapet's own shape — `1.05` written twice under a
 * comment claiming one read the other — still standing in the sentence written
 * to retire it. The literals agree today (`tools/stationprobe.mjs --check`
 * prints both columns and both say 0.9000 and 1.9000); what does not exist is
 * the link.
 */
export const VIADUCT_SLAB_THICK_M = 0.9;
export const VIADUCT_BOX_DEPTH_M = 1.9;
export function viaductSoffitY(l) {
  return l.height - VIADUCT_SLAB_THICK_M - VIADUCT_BOX_DEPTH_M;
}

/**
 * Metres of ballast and rail above the deck slab.
 *
 * `city.js` lays the trough at `slabTop + 0.22` half-depth 0.22 and the rail at
 * `slabTop + 0.53` half-depth 0.09, so rail level is `0.53 + 0.09` = 0.62 above
 * the slab. `moving.js` carried the same 0.62 as its own literal under the
 * comment *"`city.js`'s ballast + rail"* — a comment claiming a link with no
 * link, which is CONTRACT §9.1's variant and is what `ROOF_PARAPET_M` was two
 * sessions ago. It is one number here now and three things read it.
 */
export const VIADUCT_RAIL_RISE_M = 0.62;

/**
 * THE STRUCTURE GAUGE: metres above RAIL LEVEL that must stay clear of
 * structure, so that anything running on this deck passes anything built over
 * it. Session 23.
 *
 * §9 rule 5 forbids a number without a derivation, and this one is a BUDGET
 * rather than a measurement, so here is what the world has to be like for it to
 * be right. The tallest thing on this deck is `moving.js`'s train: a 3.40 m car
 * with a 0.18 m roof cap whose upper face sits 0.09 m proud, i.e. **3.58 m
 * above rail level**. 4.20 leaves **0.62 m** over it — which is exactly one
 * `VIADUCT_RAIL_RISE_M`, i.e. this deck could be re-ballasted from bare slab to
 * its present rail level a second time and the same train would still pass
 * under the same portal. A gauge that only just clears today's vehicle is a
 * gauge that has to be rebuilt when the vehicle changes.
 *
 * `moving.js` prints its own car against this at init (§9 rule 4: when a number
 * is derived from another, print both) so a train grown past it says so in the
 * boot log rather than intersecting a portal in silence.
 */
export const VIADUCT_LOADING_GAUGE_M = 4.2;

/**
 * THE END TREATMENT — WHERE THE LINE STOPS, AND WHAT IT STOPS AGAINST.
 * SESSION 23, item 2. One pure function, so `city.js` DRAWS what this DECIDES
 * and `generateChunk` CLAIMS the same boxes — the arrangement `viaductPiers`
 * already has, for the reason session 5's three-copies-of-one-curve gave.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT WAS THERE, MEASURED BEFORE ANYTHING WAS ADDED (`tools/portalprobe.mjs`).
 *
 * Session 21 put an abutment at each end and the operator still reads the ends
 * as *"a line that has been cut rather than a line that goes somewhere"*. The
 * brief called them unbuilt; they are not, and the real defect is sharper than
 * that. **The abutment tops out at `viaductSoffitY` = 18.20 m, which is exactly
 * the soffit** — it is a BEARING, the thing the deck sits on, and nothing rises
 * past the deck to close it. The section above it:
 *
 *     18.20 -> 20.10   box girder        cut off in mid air
 *     20.10 -> 21.00   slab              cut off in mid air
 *     21.00 -> 21.62   ballast and rail  cut off in mid air
 *     21.00 -> 22.20   parapet RETURNS   0.40 m thick, at +/-4.50 m across,
 *                                        FLOATING 2.80 m over the abutment
 *
 * So 8.60 m of the deck's 9.50 m width ends in nothing, framed by two thin
 * walls with a 2.80 m air gap under them. That is the cross-section the
 * operator is looking at.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT IS ADDED: A PORTAL HEAD ON THE ABUTMENT ALREADY THERE, AND EVERY
 * DIMENSION COMES FROM SOMETHING THAT WAS ALREADY DECIDED.
 *
 *   opening half-width  `l.deck / 2` = 4.75 — THE DECK'S OWN HALF-WIDTH, so
 *       everything on the deck passes through by construction. The widest thing
 *       on it is the parapet, outer face `l.deck/2 - 0.25 + 0.2` = 4.70, which
 *       clears the jamb by **0.05 m**. That is a structure gauge and it is how
 *       a real portal is set out.
 *   opening top         `l.height + VIADUCT_RAIL_RISE_M + VIADUCT_LOADING_GAUGE_M`
 *       = 21.00 + 0.62 + 4.20 = **25.82 m**.
 *   head top            **27.20 m**, which is `l.height + 3.1 + 6.2/2` — THE TOP
 *       OF THE CATENARY MASTS ALREADY STANDING ON THIS DECK. So the portal adds
 *       exactly zero new height to the viaduct's silhouette, and the lintel is
 *       whatever that leaves over the gauge: 27.20 - 25.82 = **1.38 m**.
 *   footprint           the abutment's own, unchanged: 6.0 m along the deck,
 *       11.1 m across. The head CLAIMS NO GROUND THE MASS UNDER IT WAS NOT
 *       ALREADY STANDING ON.
 *
 * THE PARAPET RETURNS ARE REMOVED RATHER THAN KEPT. Their own comment says they
 * exist *"so the deck edge does not simply stop in the air"* and a portal is the
 * thing that actually achieves that; kept, they would float inside the opening
 * and break the recess. Burying them inside the jambs instead was the other
 * option and it is the failure CONTRACT §9.1 records under *"geometry authored
 * and then drawn inside something else"* — five vehicle skirts, invisible,
 * counted by every gate. Net: **-2 boxes and +4 boxes per end.**
 *
 * ────────────────────────────────────────────────────────────────────────────
 * AND THE CLAIM, WHICH IS THE HALF THAT DID NOT EXIST AT ALL.
 *
 * `landmarkOccluders` returns the viaduct's LEGS and its DECK segments. The
 * abutment and the wing walls are in neither, so an 18.2 m solid 6.0 x 11.1 m
 * has stood at each end since session 21 **on ground the registry has never
 * been told about** — CONTRACT §9.1's placement rule, with the landmark's own
 * geometry instead of a prop's. `generateChunk` now claims this box before the
 * roads and the buildings are laid, so both are refused against it rather than
 * drawn through it.
 */
export function viaductEnds(arc, l) {
  const soffitY = viaductSoffitY(l);
  const halfDeck = l.deck / 2;
  /** Session 21's abutment, unchanged. Its inner face is the deck's last station. */
  const abutDepth = 6.0;
  const abutHalfAcross = halfDeck + 0.8;
  /** Session 21's wing walls, unchanged. They reach furthest across, so they set the claim. */
  const wingHalfAcross = halfDeck + 1.6;
  const wingHalfT = 0.5;

  const openHalfAcross = halfDeck;
  const openTop = l.height + VIADUCT_RAIL_RISE_M + VIADUCT_LOADING_GAUGE_M;
  /** The catenary mast's own top, so the portal adds no new silhouette height. */
  const headTop = l.height + 3.1 + 6.2 / 2;
  /** A reveal, so the jamb and lintel edges catch light and the hole sits behind them. */
  const reveal = 0.30;

  const out = [];
  for (const station of [arc.stations[0], arc.stations[arc.stations.length - 1]]) {
    const c = Math.cos((station.yawDeg * Math.PI) / -180);
    const sn = Math.sin((station.yawDeg * Math.PI) / -180);
    /** Outward along the deck, away from the crown. */
    const sgn = station.s < 0 ? -1 : 1;
    const ox = c * sgn;
    const oz = sn * sgn;
    const cx = station.x + ox * (abutDepth / 2);
    const cz = station.z + oz * (abutDepth / 2);
    /**
     * The claim is the WORLD AABB of the whole end treatment — abutment, wings
     * and head — and it is deliberately the conservative shape. The registry is
     * axis-aligned, so a rotated box has to be covered by one; over-claiming
     * shows up as a spurious conflict a reader can see and under-claiming shows
     * up as nothing at all, which is `occupancy.js`'s own argument for why a
     * missing height defaults to a surface.
     */
    const ha = abutDepth / 2;
    const hc = wingHalfAcross + wingHalfT;
    const hx = ha * Math.abs(ox) + hc * Math.abs(oz);
    const hz = ha * Math.abs(oz) + hc * Math.abs(ox);
    out.push({
      station, sgn, yawDeg: station.yawDeg,
      /** Unit vector along the deck, pointing away from the crown. */
      outward: [ox, oz],
      /** Centre of the whole end treatment, on the deck's own centreline. */
      x: cx, z: cz,
      abutDepth, abutHalfAcross, abutTop: soffitY,
      wingHalfAcross, wingHalfT, wingTop: soffitY * 0.72, wingDepth: 5.2,
      openHalfAcross, openTop, headTop, reveal,
      /** Jamb: from the opening's edge out to the abutment's, one each side. */
      jambHalfAcross: (abutHalfAcross - openHalfAcross) / 2,
      jambCentreAcross: (abutHalfAcross + openHalfAcross) / 2,
      /** The AABB the registry is given. */
      claim: { x0: cx - hx, x1: cx + hx, z0: cz - hz, z1: cz + hz, top: headTop },
    });
  }
  return out;
}

/**
 * THE STATION — SESSION 31, STAGES 1 AND 2 OF THE FIVE STATE 27 §8.1 DESIGNED.
 * ===========================================================================
 *
 * The operator's words, carried through four sessions that each listed this
 * last and each ran out of room: *stairs and lifts up to the deck, people
 * riding them, good lighting, at both ends and spread along the line.* Stage 1
 * is the platform, stage 2 is the vertical circulation. Stage 3 —
 * `walkableAt` leaving the ground plane, which is what lets people ride it —
 * is deliberately NOT started; it is a subsystem and STATE 27 says so.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE DESIGN SAID "TWO SIDE PLATFORMS ON THE DECK, 3.0 m WIDE" AND THE DECK HAS
 * 1.36 m. Measured before anything was built, by `tools/stationprobe.mjs`,
 * which reads the DELIVERED instance matrices rather than these constants:
 *
 *     what                          transverse t, metres from the deck centreline
 *     ballast trough        0.68 .. 3.78   (two of them, at +/- 2.2325 +/- 1.55)
 *     walkway kerb          3.20 .. 4.20
 *     catenary mast         3.85 .. 4.15   (0.30 square, y 21.00 .. 27.20)
 *     parapet               4.30 .. 4.70   (y 21.00 .. 22.20)
 *     deck edge                     4.75
 *
 *     the gaps inside the deck edges:  0.150 / 0.100 / 1.364 / 0.100 m
 *
 * The widest clear run on this deck is **1.364 m and it is the six-foot** —
 * the space BETWEEN the two running lines, where a platform would serve no
 * door and could not be reached. The two edge gaps are 0.150 and 0.100 m.
 * STATE 27's 3.0 m is short by 1.636 m against the best of them and by 2.9 m
 * against the ones in the right place. That design was written by a session
 * with the code in front of it and the number was never checked against the
 * section; this is CONTRACT §9 rule 7 — a dimension correct in itself, taken
 * from a datum nobody confirmed.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SO THE STRUCTURE WIDENS AT THE STATION, WHICH IS WHAT AN ELEVATED STATION IS.
 *
 * Every elevated railway that has ever had a station does this: the running
 * viaduct is as narrow as two tracks need, and it swells where people stand.
 * The platforms are carried OUTSIDE the deck on the station's own edge walls.
 *
 * AND IT IS PURELY ADDITIVE — NOT ONE EXISTING BOX MOVES OR DISAPPEARS. That
 * is not a happy accident, it is what the offsets below were chosen for, and
 * each clearance is a subtraction anybody can check:
 *
 *   platform inner edge  4.30   vs the catenary mast's outer face 4.15
 *                               clear by 0.15 m, so no mast is suppressed
 *   platform underside  22.37   vs the parapet's top 22.20
 *                               clear by 0.17 m, so no parapet is suppressed
 *   canopy inner edge    4.60   vs the same mast at 4.15, clear by 0.45 m
 *   canopy top          25.50   vs the catenary ARM at 26.90, clear by 1.40 m
 *   edge wall outer      7.55   vs the origin block's clear cross-street band
 *                               |x| <= 10.5 (LANDMARKS → viaduct, session 5),
 *                               clear by 2.95 m
 *   edge wall outer      7.55   vs the pier legs' outer face 11.60 — and the
 *                               legs stop at the soffit 18.20 m anyway, which
 *                               is 4.17 m below the platform
 *
 * A revert of this station therefore restores the previous viaduct exactly,
 * which is the property CONTRACT asks a commit to have and the reason the
 * platform is threaded between the mast and the parapet rather than replacing
 * either of them.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE PLATFORM'S HEIGHT IS STATE 27's AND IT IS THE ONE NUMBER THAT SURVIVED.
 * Rail level is `l.height + VIADUCT_RAIL_RISE_M` = 21.62 m, and 1.10 m over it
 * is 22.72 m — inside the 0.90–1.15 m a high-floor metro platform is built at,
 * and 0.20 m over the train's own floor.
 *
 * THE STEPPING GAP IS 0.62 m AND IT IS A CONSEQUENCE, NOT A CHOICE. A car is
 * `TRAIN.carWidthM` 2.9 m on a track at 2.2325, so its side is at 3.6825; the
 * platform edge is at 4.30 because the mast is at 4.15. A real station would
 * move the mast; moving it would mean suppressing existing geometry over the
 * station length, and a first delivery that is purely additive is worth more
 * than 0.5 m of realism nobody can see from the street. Written down here
 * rather than discovered, and it is what stage 4 will have to close.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * STAGE 2, AND STATE 27's PLAN FIGURE IS ALSO WRONG — IN THE OTHER DIRECTION.
 *
 * It says a switchback with a landing every ~12 risers *"occupies about 8 x 12 m
 * in plan"*. It does not. A flight of 12 risers at 0.28 m going is 3.36 m of
 * run; a switchback cycle is one flight, one landing, and the return flight
 * folded back over it, so the plan is `flightRun + landing` = 4.76 m long by
 * `2 * flightWidth + well` = 3.80 m wide, and the HEIGHT is what accumulates:
 * 24 risers a cycle at 0.17 m is 4.08 m. 8 x 12 m is a stair drawn end to end
 * instead of folded, which is the thing a switchback is defined by not being.
 *
 * The rise is measured from the pavement, not from the datum: the core stands
 * on `BLOCK.kerbHeight` 0.16 m and climbs to the platform at 22.72, so 22.56 m
 * / 0.17 = **133 risers**, 12 flights, six cycles at 4.08 m = 24.48 m of
 * available rise with the top flight part-used. 0.17 m is inside
 * `PLAYER.stepUpM` = 0.20 by construction, which is why STATE 27 chose it and
 * why stage 3 will not have to change it.
 */
export const VIADUCT_STATION = {
  /**
   * Where the stations are, as signed arc distance from the crown, in metres.
   *
   * ONE ENTRY, AND IT IS THE CROSSING. STATE 27 established with
   * `tools/portalprobe.mjs` that no gate camera in this project sees either end
   * of this viaduct, and the operator has been waiting four sessions to SEE a
   * station — so the first one goes where he is standing. It is a list rather
   * than a scalar because *"spread along the line"* is his own phrasing and the
   * next station is then data rather than code.
   */
  atS: [0],
  /**
   * Half the platform length. 40 m either side takes the eight deck segments
   * whose midpoints fall inside it — `arc.chord` is 10.909 m, so the delivered
   * platform is **87.27 m**, against the 80 m STATE 27 asked for. It is a
   * segment count rather than a length because the platform rides the deck's
   * own stations and a platform that ended mid-segment would need a box the
   * deck does not have.
   */
  halfLengthM: 40,

  /** Transverse inner edge of the platform. Clears the catenary mast by 0.15 m. */
  innerT: 4.30,
  /** Metres of walking surface. STATE 27's number, delivered as written. */
  widthM: 3.00,
  /** Platform top above RAIL level, not above the slab. STATE 27's number. */
  topAboveRailM: 1.10,
  /** Slab depth. Clears the parapet's 22.20 m top by 0.17 m at 22.37. */
  thickM: 0.35,

  /** The edge wall: the station's outer skin, and what the street sees. */
  wallThickM: 0.25,
  /**
   * Metres the balustrade stands above the platform surface, and SESSION 32
   * MADE THE PART ABOVE THE PLATFORM OPEN. It was a solid screen and it hid
   * the train from the street; the skirt below the platform is still solid.
   *
   * ────────────────────────────────────────────────────────────────────────
   * THE NUMBER SESSION 32's BRIEF CARRIED WAS 2.87 m ABOVE THE PLATFORM. IT
   * IS 1.15, AND 2.87 IS ITS HEIGHT ABOVE THE DECK SLAB.
   *
   * `stationprobe` reads the delivered box as t 7.20..7.45, y 21.00..23.870,
   * height 2.870. The platform's walking surface is at 22.720, so 1.720 m of
   * that box is BELOW the surface — it is the skirt that closes the widened
   * structure's side elevation — and only 1.150 m of it is parapet. The
   * constant said 1.15 the whole time. A height measured from the wrong datum
   * is CONTRACT §9's own subject, and this is the second time this station has
   * produced one (STATE 31 §0.3, the 3.0 m platform on a 1.364 m deck).
   *
   * ────────────────────────────────────────────────────────────────────────
   * AND THE CORRECTED NUMBER DOES NOT SAVE THE SOLID WALL — IT CONDEMNS IT.
   *
   * From the operator's own pose [70, 1.74, 0.9], against the DELIVERED train
   * (`trainprobe`: rail 21.62, lit window strip 23.25..24.20, roof cap top
   * 25.20 — not the 25.82 loading gauge, which is a bound and not a roof), the
   * lowest train height an occluder lets through is
   * `1.74 + (top - 1.74)·(70 - 3.7115)/(70 - x)`, where 3.7115 is the near
   * car's window face:
   *
   *     occluder                              lets through   of the 0.95 m strip
   *     edge wall      x 7.45  top 23.87        25.19 m          0.00 m
   *     skirt alone    x 7.45  top 22.72        23.97 m          0.23 m
   *     platform slab  x 7.30  top 22.72        23.92 m          0.28 m
   *     the OLD parapet x 4.60 top 22.20        22.48 m          0.95 m  <- all of it
   *
   * The wall lets through everything above 25.19 m against a roof at 25.20:
   * **one centimetre of a 3.58 m train.** And a SOLID parapet cannot be lowered
   * out of the way either — to show any window at all it must top out below
   * 22.93 m, which is **0.21 m above the platform**, a kerb rather than a
   * railing. So the repair is not a shorter wall. It is an OPEN one, and the
   * brief's word *railing* is exactly right for a reason its own number missed.
   *
   * ────────────────────────────────────────────────────────────────────────
   * WHAT THE REPAIR CANNOT REACH, STATED SO NOBODY RE-DERIVES IT.
   *
   * Once the balustrade is air, the binding occluder is the platform slab's own
   * outer top corner at (7.30, 22.72) — 23.92 m, the **top 0.28 m of the window
   * strip and 1.28 m of the 3.58 m train**. That ceiling is set by a 3.0 m
   * platform standing at 22.72 m outboard of the deck, not by this wall, and
   * closing it would mean narrowing or lowering the platform. The rake of
   * windows the street had before the station is 0.95 m, and it is not coming
   * back at 70 m without moving the platform. It comes back with distance: the
   * same arithmetic clears the whole strip past about 150 m.
   */
  wallAboveM: 1.15,

  /**
   * THE BALUSTRADE — posts, a mid rail and a top rail, all inside the old
   * wall's own 0.25 m envelope so nothing claims ground the wall did not.
   *
   * Six posts to an 11.13 m segment is 1.855 m centres, which is a balustrade
   * bay. The top rail keeps the wall's own 23.87 m top so the station's
   * parapet LINE is unchanged and only its opacity moves — the silhouette a
   * reader compares against STATE 31's frames is the same silhouette.
   *
   * There is deliberately NO toe board. A 0.06 m lip at x 7.45 raises the
   * lowest visible train height from 23.92 to 24.04 m and costs 0.12 m of a
   * 0.28 m window sliver — 43% of what this repair recovers, for a detail
   * nobody resolves at 70 m.
   */
  railPostSideM: 0.10,
  railPostsPerSeg: 6,
  railTopThickM: 0.14,
  railTopDeepM: 0.09,
  railMidThickM: 0.08,
  railMidDeepM: 0.06,
  railMidAboveM: 0.55,

  /** The tactile edge strip, in a lighter concrete. What makes it read as a platform. */
  copingWidthM: 0.55,
  copingProudM: 0.06,

  /** Canopy, on a column line. STATE 27's 25.5 m top. */
  canopyTopM: 25.50,
  canopyThickM: 0.30,
  /** Canopy inner edge. Clears the catenary mast by 0.45 m. */
  canopyInnerT: 4.60,
  /** The downstand at the canopy's inner edge — what catches light from below. */
  fasciaDropM: 0.30,
  columnSideM: 0.30,

  /**
   * STAGE 2. A switchback stair and a lift shaft, per platform.
   *
   * `alongM` 4.76 = flight run 3.36 + landing 1.40. `acrossM` 3.80 = two 1.80 m
   * flights either side of a 0.20 m well. Both derived above rather than
   * chosen.
   */
  riserM: 0.17,
  goingM: 0.28,
  risersPerFlight: 12,
  flightWidthM: 1.80,
  wellM: 0.20,
  landingM: 1.40,
  /** Lift shaft, STATE 27's 2.4 x 2.4 m, with a head over-run for the motor. */
  liftSideM: 2.40,
  liftHeadM: 1.80,
  /**
   * Where a core stands, as (transverse t, along-deck s) from the station
   * centre. The cores go NORTH of the crossing because the origin block's main
   * street occupies |z| <= 7.5 with its pavements out to 11.7, and a stair core
   * in a carriageway is the defect this project has recorded seven times.
   * `t` is the pier line's own 8.3 m, so the core stands where the structure
   * already comes down.
   */
  coreT: 8.30,
  coreS: 14.0,
};

/**
 * THE STATIONS ON A VIADUCT, DECIDED HERE AND DRAWN BY `city.js`.
 *
 * The `viaductPiers` / `viaductEnds` arrangement, for the reason `viaductArc`
 * gives: three consumers had three copies of one curve once, and the field was
 * describing a bridge nobody could see. `city.js` draws what this decides,
 * `landmarkOccluders` claims the same span, and `citycheck` reads the delivered
 * result — three readers, one description.
 *
 * A station is returned as its centre station, the SEGMENT INDEX RANGE it
 * covers, and its cores. Segments rather than metres because the platform is
 * emitted per deck segment and shares its stations.
 */
export function viaductStations(arc, l) {
  const out = [];
  for (const atS of VIADUCT_STATION.atS) {
    /** The deck station nearest this arc distance — the platform's mid-point. */
    const centre = arc.stations.reduce((a, b) => (Math.abs(b.s - atS) < Math.abs(a.s - atS) ? b : a));
    /**
     * Every segment whose MIDPOINT falls inside the half-length. A segment is
     * `stations[i] .. stations[i+1]`, so its midpoint is the mean of the two
     * arc distances — the same quantity `city.js` positions the segment box at.
     */
    const segs = [];
    for (let i = 0; i < arc.stations.length - 1; i++) {
      const mid = (arc.stations[i].s + arc.stations[i + 1].s) / 2;
      if (Math.abs(mid - atS) <= VIADUCT_STATION.halfLengthM) segs.push(i);
    }
    if (!segs.length) continue;

    /**
     * The cores, one per platform side. Placed from the CENTRE STATION's own
     * frame — `city.js`'s `across` expression inverted — so a station on a part
     * of the arc that has turned puts its cores square to the deck rather than
     * square to the world.
     */
    const c = Math.cos((centre.yawDeg * Math.PI) / -180);
    const sn = Math.sin((centre.yawDeg * Math.PI) / -180);
    const cores = [];
    for (const side of [-1, 1]) {
      const t = side * VIADUCT_STATION.coreT;
      const s = VIADUCT_STATION.coreS;
      cores.push({
        side,
        /** `across(t)` displaced by `s` along the deck: the two are orthogonal. */
        x: centre.x - sn * t + c * s,
        z: centre.z + c * t + sn * s,
        yawDeg: centre.yawDeg,
        t, s,
      });
    }

    out.push({
      atS, centre, segs,
      segFrom: segs[0], segTo: segs[segs.length - 1],
      lengthM: segs.length * arc.chord,
      cores,
      /** Platform surface, in metres above the ground datum. */
      platformTopY: l.height + VIADUCT_RAIL_RISE_M + VIADUCT_STATION.topAboveRailM,
      /** How far across the widened structure reaches, for the claim. */
      halfAcrossM: VIADUCT_STATION.innerT + VIADUCT_STATION.widthM + VIADUCT_STATION.wallThickM,
      topY: VIADUCT_STATION.canopyTopM,
    });
  }
  return out;
}

/** Is deck segment `i` inside a station? Read by `city.js` and by the occluders. */
export function viaductStationSegment(stations, i) {
  for (const st of stations) if (i >= st.segFrom && i <= st.segTo) return st;
  return null;
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
 *
 * ---------------------------------------------------------------------------
 * MEMOISED PER LANDMARK — SESSION 41. THE CACHE WAS PUT ON THE BRANCH THAT
 * RARELY RUNS AND LEFT OFF THE ONE THAT ALWAYS DOES.
 * ---------------------------------------------------------------------------
 *
 * `landmarkGroundClaims` is memoised seven hundred lines up, for this exact
 * reason and in these words: *"`viaductArc` -> `viaductLegs` -> `viaductEnds`
 * is a few hundred trig calls and `landmarkOccupies` is called once per vehicle
 * per frame."* True, and it fixed the wrong half.
 *
 * `landmarkOccupies` walks all eight landmarks and calls THIS first, as the
 * REJECT. So eight AABBs are built before a single ground claim is consulted,
 * and the claims — the memoised ones — are reached only by the one landmark
 * whose box the point is inside. The memoised call happened at most once per
 * query; the unmemoised one happened eight times, each rebuilding
 * `landmarkOccluders(l)` from scratch: forty-odd fresh boxes, and for the
 * viaduct the same arc the comment above the claim cache is about.
 *
 * MEASURED, `?player=1&seed=1337&t=0.0` at 1280 x 720, 160 vehicles, three runs
 * a piece, by `tools/inputcheck.mjs` (which prints the frame) — the arms are the
 * commit either side of session 35's `0f60c9a` and this repair on top of HEAD:
 *
 *     landmarkOccupies   landmarkAABB      REBUILDS OF      frame     arm
 *      calls /frame       calls /frame   landmarkOccluders
 *         161               1 369          1 369 /frame       23.3 ms   528cfd9, 0f60c9a^
 *         505               4 143          4 143 /frame       65.7 ms   0f60c9a, and since
 *         505               4 143        8 FOR THE PROCESS     5.2 ms   this commit
 *
 * The CALL count does not move: `landmarkAABB` is still asked 4 143 times a frame
 * and still answers all of them. What stops is the rebuild behind the answer.
 *
 * 2 774 extra rebuilds a frame for 42.4 ms is **15.3 us per rebuild**, and at
 * that price the 1 369 the BEFORE arm already paid were 21.0 ms of its own
 * 23.3 ms frame. This was never a cost session 35 introduced; session 35
 * tripled a call whose price nobody had measured.
 *
 * KEYED ON THE OBJECT AND NEVER INVALIDATED, the same as the claim cache:
 * `LANDMARKS` is authored data at module scope and does not depend on the seed,
 * which is already what makes that cache sound. The cached box is handed back
 * rather than copied, and that is checked rather than assumed — all fourteen
 * call sites in `src/` and `tools/` read the four fields and none writes one.
 */
const landmarkAABBCache = new Map();

export function landmarkAABB(l) {
  const hit = landmarkAABBCache.get(l);
  if (hit) return hit;
  const boxes = landmarkOccluders(l);
  let box;
  if (!boxes.length) {
    // A basin occludes nothing above grade, but it is still 210 m of ground you
    // cannot build on.
    const r = landmarkFootprint(l) / 2;
    box = { x0: l.x - r, x1: l.x + r, z0: l.z - r, z1: l.z + r };
  } else {
    // The GROUND extents: this AABB is the fast reject for `landmarkOccupies`,
    // which is a question about ground, so a bound taken off the inscribed bake
    // boxes would reject points the claims below it accept. Session 42.
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const b of boxes) {
      x0 = Math.min(x0, b.gx0); x1 = Math.max(x1, b.gx1);
      z0 = Math.min(z0, b.gz0); z1 = Math.max(z1, b.gz1);
    }
    box = { x0, x1, z0, z1 };
  }
  landmarkAABBCache.set(l, box);
  return box;
}

/** Does a landmark actually stand at this point? Tested against its boxes, not its bounds. */
export function landmarkBlocks(l, x, z, pad = 0) {
  const boxes = landmarkOccluders(l);
  if (!boxes.length) {
    const r = landmarkFootprint(l) / 2 + pad;
    return Math.hypot(x - l.x, z - l.z) < r;
  }
  for (const b of boxes) {
    // Ground extents — "does a landmark stand here" is a ground question.
    if (x > b.gx0 - pad && x < b.gx1 + pad && z > b.gz0 - pad && z < b.gz1 + pad) return true;
  }
  return false;
}

/** Landmarks whose real extent touches this chunk, so a chunk builds its share. */
export function landmarksTouching(cx, cz, margin = 4) {
  const b = chunkBounds(cx, cz);
  return LANDMARKS.filter((l) => {
    const a = landmarkAABB(l);
    return a.x1 + margin > b.x0 && a.x0 - margin < b.x1 && a.z1 + margin > b.z0 && a.z0 - margin < b.z1;
  });
}

// ---------------------------------------------------------------------------
// the origin block
//
// `block.js` builds a hand-tuned street around the origin and the look gate
// measures it. The generator does not place buildings there — it would put them
// through the block's facades — but it does still place roads, because the
// block's street has to continue out of it or the city has no through route.

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ROAD MARKINGS — THE GEOMETRY, EXPORTED, BECAUSE A SECOND STREET WANTED IT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * SESSION 45. These eleven numbers were local `const`s inside `generateChunk`'s
 * markings block and every one of them is still that block's own derivation —
 * what changed is that they are now readable from outside it, because
 * `block.js` paints the origin block's street and a second copy of a dash cycle
 * is CONTRACT §9.1's arrangement. The precedent in this file is `BUS_STOP`,
 * which `block.js` already imports for exactly this reason: *"a shelter here and
 * a shelter three chunks away cannot become two different objects the way one
 * lamp bowl became 210 and 9000."*
 *
 * WHY THE ORIGIN BLOCK HAD NO PAINT AT ALL, WHICH IS THE DEFECT THIS SERVES.
 * `paint()` below refuses any mark whose footprint is not covered by a
 * DELIVERED `carriageway` claim — *"a road the river took, the block took or a
 * dome took has no lines painted in the air over where it used to be"*. The
 * origin block's 336 m of main street is exactly a road **the block took**:
 * `BLOCK_KEEPOUT` clips the lattice's carriageway out of it so that
 * `block.js`'s own asphalt wins. So the one street in this city that the look
 * gate stands in, and the one the player spawns on, is the one street with no
 * paint on it — by construction, in a guard that is doing its job.
 *
 * WHAT IS NOT HERE, and it is the same line this file draws everywhere else:
 * the paint's THICKNESS and REFLECTANCE are not in this object. This generator
 * is `three`-free and unit-free, and `city.js` says of the same pair that *"a
 * linear albedo in a placement file is a number in the wrong file"*. They are
 * `ROAD_PAINT` in `core/constants.js`, which is where a shared physical
 * quantity with a derivation belongs, and both modules read them from there.
 */
export const ROAD_MARKING = {
  /**
   * THE DASH CYCLE. UK/EU centre-line practice on a 50 km/h urban road is a
   * 2 m mark in a 6 m cycle (1:3); a lane line is 3 m in a 9 m cycle. Both are
   * here rather than one number twice, because the RATIO is what tells a
   * driver which line they are looking at and a single cycle would erase the
   * distinction.
   */
  centreMarkM: 2.0,
  centreCycleM: 6.0,
  laneMarkM: 3.0,
  laneCycleM: 9.0,
  /**
   * m. Where a lane line sits, from the road centreline. `LANE_OFFSET`'s own
   * midpoint, (1.75 + 5.25) / 2 = 3.50 m, which `traffic.js` puts the two
   * running lanes either side of.
   */
  laneOffsetM: 3.5,
  /** m. 0.10 m is a standard urban line; a stop bar is 0.40 m. */
  lineWidthM: 0.10,
  barWidthM: 0.40,
  /** m. How far inside the kerb the solid edge line runs. */
  edgeInsetM: 0.30,
  /**
   * m. The edge line is solid, and a solid line is emitted as a run of boxes
   * because one box per chunk edge would be a 128 m instance that no frustum
   * test can reject. 16 m was the literal inside the loop.
   */
  edgeSegmentM: 16,
  /**
   * The zebra. 1:1 stripe to gap over the 14.4 m a 15 m carriageway leaves
   * inside a 0.30 m edge margin: 14 x 0.50 m on a 1.029 m pitch. Session 21's
   * six 0.45 m stripes over half a road was a hatch, not a crossing.
   */
  crossingStripes: 14,
  crossingStripeWidthM: 0.50,
};

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

/**
 * The same, TILTED about a horizontal axis through its own centre — session 21.
 *
 * `tilt` is degrees and `tiltAz` is the bearing of the axis, both in the
 * MODEL's frame, so a tilted box turns with the model's yaw and leans with the
 * model's lean like everything else. It exists for one reason: **a canopy made
 * of axis-aligned boxes is a stack of slabs, and tilting a slab is what made
 * session 12's lean read as broken rather than as natural.** Three masses at
 * three angles read as foliage; the same three square-on read as crates.
 *
 * It is available to every kind and used by the trees and the spoil heaps,
 * which are the two things in this city that are not made by anybody.
 */
const bxt = (x, y, z, w, h, d, albedo, rough, tilt, tiltAz) => ({ x, y, z, w, h, d, albedo, rough, tilt, tiltAz });

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

  /**
   * STACKED MATERIAL — SESSION 40, and it is the one kind a yard cannot be
   * made of anything already here.
   *
   * `container` is a skip and a shipping box: both are things material arrives
   * IN. What a works yard is covered in is material lying about — timber and
   * sheet on bearers, drums, blocks under a sheet — and none of the nine kinds
   * that existed carries that. It is the only new prop kind this session adds,
   * and the test for adding one is LOOK.md §5's: it is derivable from what the
   * city already has (a yard, declared by `LOW_DETAIL_KINDS` since session 4)
   * rather than placed because it signifies.
   *
   * ALL THREE VARIANTS ARE UNDER `HEAD_CLEAR_M` = 2.10 m, so a stack is
   * entirely in the `prop` band and never in `canopy`. That is what a stack IS
   * — material you can see over — and it also keeps it off the kerb walk's
   * awkward edge, where the across-pad decides whether a kind may stand on a
   * pavement at all.
   */
  stack: [
    /** Sawn timber and sheet on bearers, banded, weathering at the ends. */
    {
      boxes: [
        bx(0, 0.06, 0, 2.40, 0.12, 1.20, TIMBER, 0.92),
        bx(0, 0.44, 0, 2.30, 0.64, 1.08, [0.21, 0.176, 0.126], 0.9),
        bx(0, 0.86, 0.10, 1.90, 0.22, 0.86, [0.17, 0.142, 0.104], 0.9),
      ],
    },
    /** Steel drums, two rows, one on its side — the shape a yard reads by. */
    {
      boxes: [
        bx(-0.62, 0.44, -0.32, 0.58, 0.88, 0.58, [0.19, 0.115, 0.055], 0.72),
        bx(0.02, 0.44, -0.30, 0.58, 0.88, 0.58, [0.16, 0.145, 0.062], 0.74),
        bx(0.64, 0.44, -0.28, 0.58, 0.88, 0.58, [0.13, 0.132, 0.138], 0.7),
        bx(-0.30, 0.29, 0.52, 0.88, 0.58, 0.58, [0.19, 0.115, 0.055], 0.72),
        bx(0.58, 0.29, 0.54, 0.88, 0.58, 0.58, [0.15, 0.14, 0.06], 0.72),
      ],
    },
    /**
     * Palletised blocks under a tarpaulin. The sheet is the one surface in the
     * kind that is not the material: reflectance 0.13 and roughness 0.55, so it
     * catches a lamp where the timber under it does not.
     */
    {
      boxes: [
        bx(0, 0.07, 0, 1.20, 0.14, 1.20, TIMBER, 0.92),
        bx(0, 0.62, 0, 1.14, 0.96, 1.14, CONCRETE, 0.94),
        bx(0, 1.16, 0, 1.30, 0.16, 1.30, [0.13, 0.128, 0.118], 0.55),
        bx(0.55, 0.78, 0.58, 0.22, 0.60, 0.20, [0.13, 0.128, 0.118], 0.55),
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
   * EVERY CROWN CLEARS `HEAD_CLEAR_M` **AS DELIVERED**, and the two words are
   * the whole of session 22's second finding. It is a placement constraint
   * rather than an aesthetic one: `derivePropHalfAcross` counts only what is
   * below head height, so a tree whose lowest foliage hangs at 1.6 m measures
   * 1.4 m across and is refused the pavement it belongs on. A street tree is
   * lifted clear of the footway in exactly the same way and for exactly the
   * same reason.
   *
   * THIS SENTENCE WAS HERE AND WAS FALSE. Session 21 authored the clearances
   * at scale 1 — broad 83 mm of margin, columnar 126 mm — and no delivered
   * tree is at scale 1: the scatter draws `PROP_SCALE` = 0.85..1.25 and the
   * variant leans by up to `leanRange`. Delivered, the broad tree's lowest
   * foliage hung at **1.68 m**. Both crowns are lifted above, and the test in
   * `derivePropHalfAcross` now evaluates the clearance in the space the
   * geometry is delivered in rather than the space it is authored in, so this
   * sentence is checkable instead of aspirational — `citycheck` → `occupancy`
   * is where it is checked, off the delivered instance matrices.
   */
  tree: [
    /**
     * BROAD. A short trunk under a wide crown in THREE overlapping masses at
     * three heights, none of them square to the others.
     *
     * WHAT WAS HERE, AND WHY IT WAS THE WHOLE PROBLEM. Two flat boxes on a
     * pole: `bx(0, 3.20, 0, 2.70, 1.80, 2.50)` with a second slab above it.
     * A canopy is not a box and no number of boxes ARRANGED AS A STACK becomes
     * one — it is the vehicles' lesson at pavement level, and the vehicles took
     * three sessions to learn it. What reads as a crown is an outline that is
     * neither flat on top nor straight down the sides, and what makes that from
     * boxes is overlap plus tilt plus a spread of heights.
     *
     * THE SILHOUETTE'S OWN HEIGHT SPREAD IS THE POINT. Same argument as the
     * roofline (CONTRACT §7.4): one height along a contour reads as a SHAPE and
     * several read as a tree. These three masses top out at 4.10, 4.86 and
     * 5.34 m — a 1.24 m spread over a 5.3 m tree, which is 23% of its own
     * height.
     */
    /**
     * THE CROWN IS 0.50 m HIGHER THAN SESSION 21 AUTHORED IT, AND THE TRUNK IS
     * 0.50 m LONGER — session 22. The crown's own internal spread is untouched:
     * every mass moved by the same amount, so the 4.62 / 5.01 / 5.45 → 5.12 /
     * 5.51 / 5.95 stagger is the same 0.83 m over a taller tree.
     *
     * WHY. The lowest mass's underside sat at **2.183 m** against
     * `HEAD_CLEAR_M` = 2.10, a clearance of 83 mm — AT SCALE 1, which is a size
     * no delivered tree is. `scale` is `PROP_SCALE.min`..`max` = 0.85..1.25, so
     * the delivered underside is 1.856 m before the lean and **1.681 m** at the
     * variant's own 5°. Measured on the delivered census: six kerbside trees
     * with a foliage mass in the GROUND band, every one at scale 0.863–0.933,
     * the worst overlapping its own carriageway by 1.264 m². 1.68 m is under a
     * person and 1.4 m under a hauler's roof.
     */
    {
      leanRange: 5,
      boxes: [
        bx(0, 1.30, 0, 0.36, 2.60, 0.36, BARK, 0.92),
        bx(0.06, 2.40, -0.04, 0.30, 0.70, 0.28, BARK, 0.92),
        bxt(-0.42, 3.90, 0.28, 2.30, 2.10, 2.05, FOLIAGE_A, 0.95, 9, 24),
        bxt(0.62, 4.45, -0.35, 1.95, 1.75, 1.80, FOLIAGE_C, 0.95, -12, 108),
        bxt(0.05, 5.22, 0.42, 1.45, 1.30, 1.35, FOLIAGE_B, 0.95, 7, 200),
      ],
    },
    /**
     * COLUMNAR. A tall narrow crown starting near the ground — a hornbeam or a
     * fastigiate oak — as FOUR masses of falling width rather than one box and
     * a cap. Tapered, which is the second of the three shapes the brief asks
     * for, and the taper is what makes it read as a spire rather than as a
     * pillar.
     */
    /**
     * SAME LIFT, 0.35 m, AND FOR THE SAME READING. Its lowest mass's underside
     * was 2.226 m at scale 1 — a 126 mm clearance — and 1.831 m as delivered at
     * scale 0.85 with the variant's 3° lean. The taper is untouched.
     */
    {
      leanRange: 3,
      boxes: [
        bx(0, 1.275, 0, 0.28, 2.55, 0.28, BARK, 0.92),
        bxt(-0.10, 3.69, 0.08, 1.55, 2.10, 1.45, FOLIAGE_C, 0.95, 5, 60),
        bxt(0.12, 4.90, -0.06, 1.35, 1.90, 1.30, FOLIAGE_A, 0.95, -6, 152),
        bxt(-0.06, 6.15, 0.10, 1.00, 1.55, 0.98, FOLIAGE_C, 0.95, 8, 245),
        bxt(0.04, 7.07, -0.05, 0.62, 1.05, 0.60, FOLIAGE_B, 0.95, -5, 330),
      ],
    },
    /**
     * OPEN. A tall clear trunk, a low limb, and a small high crown — a plane or
     * a lime pollarded up for a street. The limb is what says the crown has
     * something holding it up, which a floating slab never did.
     */
    {
      leanRange: 8,
      boxes: [
        bx(0, 1.60, 0, 0.30, 3.20, 0.30, BARK, 0.92),
        bxt(-0.55, 3.05, 0.15, 1.20, 0.17, 0.30, BARK, 0.92, -14, 90),
        bxt(0.48, 3.55, -0.22, 0.95, 0.15, 0.26, BARK, 0.92, 12, 250),
        bxt(-0.30, 4.45, 0.20, 1.85, 1.85, 1.70, FOLIAGE_B, 0.95, 11, 40),
        bxt(0.55, 4.95, -0.18, 1.55, 1.50, 1.45, FOLIAGE_A, 0.95, -9, 165),
        bxt(-0.05, 5.62, 0.30, 1.10, 1.10, 1.05, FOLIAGE_C, 0.95, 6, 285),
      ],
    },
    /**
     * A FOURTH SPECIES — SMALL AND MULTI-STEMMED. Every tree in the city was
     * 5 to 7 m tall, so the planting had no small end at all: a park with only
     * mature specimens is an arboretum. Two leaning stems from one root collar
     * under a low irregular crown, topping out at 3.6 m — which is under the
     * others' TRUNKS and is what breaks a row of them into a group.
     */
    {
      leanRange: 6,
      boxes: [
        bxt(-0.14, 0.85, 0.05, 0.20, 1.75, 0.20, BARK, 0.92, 9, 20),
        bxt(0.16, 0.75, -0.08, 0.17, 1.55, 0.17, BARK, 0.92, -11, 190),
        bxt(-0.28, 2.15, 0.18, 1.50, 1.35, 1.40, FOLIAGE_C, 0.95, 13, 70),
        bxt(0.42, 2.55, -0.20, 1.25, 1.15, 1.20, FOLIAGE_B, 0.95, -8, 220),
        bxt(0.02, 3.05, 0.24, 0.85, 0.85, 0.82, FOLIAGE_A, 0.95, 10, 310),
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
function derivePropHalfWidth(perVariant = false) {
  const out = {};
  for (const [kind, variants] of Object.entries(PROP_MODELS)) {
    let r = 0;
    const each = [];
    for (const v of variants) {
      let top = 0;
      let flat = 0;
      for (const b of v.boxes) {
        /**
         * A TILTED BOX REACHES FURTHER, and the bound is exact rather than
         * generous: rotating a box of half-extents (w/2, h/2) about a
         * horizontal axis by θ puts its farthest point at
         * `(w/2)·cos θ + (h/2)·sin θ` in the tilt's own plane. A 2.3 x 2.1 m
         * canopy mass at 9° reaches 1.30 m instead of 1.15 — 13% more — and a
         * pad that ignored it would put that much of the crown inside a wall,
         * which is the same failure the LEAN term below was added for one
         * session earlier.
         */
        const th = b.tilt ? Math.abs(b.tilt * Math.PI / 180) : 0;
        const gw = (b.w / 2) * Math.cos(th) + (b.h / 2) * Math.sin(th);
        const gd = (b.d / 2) * Math.cos(th) + (b.h / 2) * Math.sin(th);
        flat = Math.max(flat, Math.abs(b.x) + gw, Math.abs(b.z) + gd);
        top = Math.max(top, b.y + b.h / 2 * Math.cos(th) + b.w / 2 * Math.sin(th));
      }
      const lean = v.leanRange ? Math.sin((v.leanRange * Math.PI) / 180) * top : 0;
      each.push(+(flat + lean).toFixed(3));
      r = Math.max(r, flat + lean);
    }
    out[kind] = perVariant ? each : +r.toFixed(3);
  }
  if (!perVariant) out.default = 0.3;
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
/**
 * EXPORTED SINCE SESSION 22, and it is one number with one owner rather than
 * two literals. `city.js`'s band split reads it to decide which of a prop's two
 * claims a delivered box belongs in, and `derivePropHalfAcross` below reads it
 * to decide which boxes count toward the across-pad. THOSE ARE THE TWO HALVES
 * OF ONE COMPARISON — see STATE 22 §2 for what happens when they disagree —
 * and the second literal carried a comment claiming `citycheck` printed both
 * when they differed, which nothing did (CONTRACT §9.1).
 */
export const HEAD_CLEAR_M = 2.10;

/**
 * THE SCALE EVERY PROP IS DRAWN AT, and it is here rather than as a literal in
 * the scatter because two places now read it: the scatter draws it, and
 * `derivePropHalfAcross` below needs its MINIMUM to know what a model-space
 * height becomes in the world. Two literals in two places is CONTRACT §9.1's
 * first variant and this file has supplied several of them.
 */
const PROP_SCALE = { min: 0.85, max: 1.25 };

function derivePropHalfAcross(perVariant = false) {
  const out = {};
  for (const [kind, variants] of Object.entries(PROP_MODELS)) {
    let r = 0;
    const each = [];
    for (const v of variants) {
      let across = 0;
      const phi = ((v.leanRange || 0) * Math.PI) / 180;
      for (const b of v.boxes) {
        const th = b.tilt ? Math.abs(b.tilt * Math.PI / 180) : 0;
        /**
         * THE UNDERSIDE, AS DELIVERED — session 22, and it was a MODEL-SPACE
         * height used as a WORLD-SPACE one (CONTRACT §9's table).
         *
         * This test decides whether a box is overhead or underfoot, and
         * `city.js` decides the same thing off the delivered instance matrix:
         * `lo = e[13] − hy − baseY` against the same 2.10. The two were asking
         * the same question in two different spaces, because the model is
         * drawn at `p.scale` and tipped by `leanDeg` and this test knew about
         * neither. Measured: the broad tree's lowest foliage cleared 2.10 by
         * 83 mm at scale 1 and hung at **1.68 m** as delivered at scale 0.85
         * with 5° of lean — so the generator claimed a trunk's worth of ground
         * and `city.js` delivered a crown's, and `citycheck` → `occupancy`
         * reported the difference as six trees overlapping their carriageways.
         *
         *   underside, model      u  = b.y − (h/2·cos θ + w/2·sin θ)
         *   worst lean about the base, at the worst azimuth:
         *                         u·cos φ − R·sin φ,  R = the box's own
         *                         horizontal reach from the model axis
         *   worst scale           × PROP_SCALE.min
         *
         * `R` is the circumscribing horizontal radius rather than the exact
         * lowest corner's, so the bound is CONSERVATIVE — it can call a box
         * underfoot that is marginally overhead, never the reverse. That is
         * the safe direction: an over-claim shows up as a spurious conflict a
         * reader can see, and an under-claim shows up as nothing at all
         * (`occupancy.js`, on why a missing height defaults to a surface).
         */
        const gw = (b.w / 2) * Math.cos(th) + (b.h / 2) * Math.sin(th);
        const gd = (b.d / 2) * Math.cos(th) + (b.h / 2) * Math.sin(th);
        const u = b.y - ((b.h / 2) * Math.cos(th) + (b.w / 2) * Math.sin(th));
        const R = Math.hypot(Math.abs(b.x) + gw, Math.abs(b.z) + gd);
        if ((u * Math.cos(phi) - R * Math.sin(phi)) * PROP_SCALE.min >= HEAD_CLEAR_M) continue;
        across = Math.max(across, Math.abs(b.z) + gd);
      }
      const lean = v.leanRange ? Math.sin((v.leanRange * Math.PI) / 180) * HEAD_CLEAR_M : 0;
      each.push(+(across + lean).toFixed(3));
      r = Math.max(r, across + lean);
    }
    out[kind] = perVariant ? each : +r.toFixed(3);
  }
  if (!perVariant) out.default = 0.3;
  return out;
}

export const PROP_HALF_WIDTH = derivePropHalfWidth();
export const PROP_HALF_ACROSS = derivePropHalfAcross();
/**
 * THE SAME TWO PADS, PER VARIANT — session 21, and the reason is a content
 * loss the max over variants would have caused silently.
 *
 * `PROP_HALF_ACROSS` is the maximum over a kind's variants, which is the right
 * answer for a caller that does not yet know which variant it will draw and the
 * WRONG one for the kerb walk, which does. This session added a fourth tree —
 * a small multi-stemmed one whose low crown is genuinely 1.64 m across at head
 * height — and the max took the kind's `across` from 0.35 m to 1.64, which
 * fails `fitsKerb` (`7.85 + 2 × 1.64 = 11.13` against 9.15 m of kerbside strip)
 * and would have removed **every street tree in the city** because one park
 * species does not fit a pavement. A pad that is the worst member of a category
 * bans the whole category for it, which is CONTRACT §7.2's shape with a
 * clearance instead of a floor.
 */
export const PROP_HALF_WIDTH_VARIANT = derivePropHalfWidth(true);
export const PROP_HALF_ACROSS_VARIANT = derivePropHalfAcross(true);

export function propHalfAcross(kind, variant) {
  if (variant !== undefined && PROP_HALF_ACROSS_VARIANT[kind]) {
    const list = PROP_HALF_ACROSS_VARIANT[kind];
    return list[Math.min(list.length - 1, variant)];
  }
  const v = PROP_HALF_ACROSS[kind];
  return v === undefined ? PROP_HALF_ACROSS.default : v;
}

export function propHalfWidth(kind, variant) {
  if (variant !== undefined && PROP_HALF_WIDTH_VARIANT[kind]) {
    const list = PROP_HALF_WIDTH_VARIANT[kind];
    return list[Math.min(list.length - 1, variant)];
  }
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

/**
 * Bisection steps for session 35's depth clip. 7 halvings of a 40.6 m lot
 * resolve 0.32 m, which is under the 0.35 m `MIN_GROUND_PIECE_M` already calls
 * the smallest piece of ground worth emitting — so the residue is smaller than
 * the smallest thing this generator will draw. The search always converges from
 * ABOVE onto a free depth (`lo` is only ever moved to a depth that tested
 * free), so the residue is land left empty and never land taken twice.
 */
const CLIP_STEPS = 7;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE CENTRE OF A BODY WHOSE NEAR FACE STANDS ON A LOT LINE — SESSION 35.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A perimeter building's near face is its lot line, and the lot line is also
 * the far edge of the footway claim in front of it. The two are the same real
 * number and `overlaps` is a STRICT inequality, so a face exactly ON the line
 * does not conflict and a face one ulp past it does.
 *
 * `centre = at − out·half` and then `centre + out·half` is not the identity in
 * binary floating point. At `at = −116.3` with `half = 17.517` it returns
 * **−116.30000000000001** — 1.4e-14 m on the road side of the line.
 *
 * WHAT IT COST BEFORE ANYBODY LOOKED. **Six buildings of 480 at HEAD**, refused
 * for a `pavement` conflict of about 1e-13 m²; they are session 34's
 * `refused: { pavement: 6 }` and nobody had asked what a building was doing
 * standing in a footway. That is a small, old, stationary cost.
 *
 * WHAT IT COSTS THE MOMENT A DEPTH CLIP EXISTS IS NOT STATIONARY, AND THAT IS
 * WHY THIS IS REPAIRED IN THE SESSION THAT ADDED THE CLIP. The round trip's
 * error depends on `half`, so the conflict FLICKERS along the bisection — the
 * near face is over the line at some depths and on it at others — and the
 * search converges wherever the arithmetic happened to round. Measured before
 * the repair: **1.09 m taken off a 35.03 m building** for no reason in the
 * world, and nothing bounds that: a 40 m building can bisect down to 20 m on an
 * ulp.
 *
 * THE REPAIR IS STATE 34 §2.3's, ONE FILE OVER — *a bound at a real number the
 * double lattice does not contain*, answered by removing the noise rather than
 * by widening the line. The centre is stepped INWARD by one ulp of its own
 * magnitude until the reconstructed near face is on the lot line or inside it.
 * Two steps is the observed worst case and the loop is bounded at four; the
 * total movement is under 1e-12 m at this city's coordinates, which is
 * 3.5e11 times smaller than `MIN_GROUND_PIECE_M`.
 *
 * IT SNAPS THE CENTRE AND NOT THE FACES, and the difference is the whole
 * reason it is shaped like this — see `boxAt`. `city.js` reconstructs the
 * DELIVERED claim as `bld.x ± bld.width/2`, so a claim built from exact faces
 * would be a second description of one rectangle and the two would disagree by
 * exactly the ulp this exists to remove. Measured: **59 `building × pavement`
 * overlaps of 0.000 m² in the delivered census.** Both sides compute
 * `centre ± half`; only the centre moves.
 */
export function lotCentre(lotLine, out, half) {
  let c = lotLine - out * half;
  for (let i = 0; i < 4 && (c + out * half - lotLine) * out > 0; i++) {
    c -= out * Math.max(Number.MIN_VALUE, Math.abs(c) * Number.EPSILON);
  }
  return c;
}

/** Half-width of the road-plus-pavement corridor on a chunk boundary. */
export const CORRIDOR = CITY.roadHalfWidth + CITY.sidewalkWidth;

/**
 * Metres of clear ground a BUILDING keeps from each category, over and above
 * not overlapping it.
 *
 * `landmark: 4.2` REPLACES SESSION 4's `10`, AND IT IS STRICTLY STRICTER
 * DESPITE BEING A SMALLER NUMBER. The old test was
 * `landmarkBlocks(l, cxb, czb, 10)` — the building's CENTRE against the
 * landmark's box — so what it actually guaranteed was `10 − halfDepth` of
 * clear ground, which for the generator's 15–26 m depths is **−3.0 to +2.5 m**:
 * negative over most of the range, i.e. buildings standing INSIDE landmarks
 * with their centres politely outside. Measured face-to-face, 4.2 m is
 * `CITY.sidewalkWidth` — clear ground at least one pavement wide the whole way
 * round, so a landmark can be walked around rather than pressed against.
 *
 * The two, compared on the quantity that matters (CONTRACT §9 rule 2 — the
 * same thing derived two ways, printed): old rejects at centre distance
 * < 10.0 m; new rejects at centre distance < halfDepth + 4.2 = **11.7 to
 * 17.2 m**. Stricter at every depth the generator can draw. Carrying the 10 as
 * a face setback instead cost **65 building refusals over the gate's own
 * region** for a plaza nobody asked for.
 * `building: 0` — A TERRACE IS A TERRACE. The perimeter walk advances
 * `t += width + rng.range(0.2, 1.4)` inside a run, so consecutive buildings in
 * a terrace stand 0.2 to 1.4 m apart on purpose. Measured with the quayside
 * walk's 1 m margin applied here by mistake: **303 buildings over the gate's
 * own region against 432**, a 30% content loss that `floors.visibleInstances`
 * would have caught — a setback correct for one walk applied to another, which
 * is CONTRACT §9's shape with a margin. The quay keeps its 1 m as its own
 * (`QUAY_SETBACKS`), because there the two walks genuinely lay one terrace on
 * top of another.
 *
 * Everything else is zero: a building's own footprint is the whole of what it
 * claims, and a mass standing hard against a pavement edge is what a street
 * wall IS.
 */
const BUILDING_SETBACKS = { landmark: CITY.sidewalkWidth, building: 0 };

/** The quayside terrace's own, session 15's 1 m margin against the island's frontage. */
const QUAY_SETBACKS = { landmark: CITY.sidewalkWidth, building: 1 };

/**
 * The same, for a prop. `landmark: 3` is the scatter's own pad from session 4b.
 * A bollard may stand a metre from a wall; it may not stand a metre inside a
 * landmark's plinth.
 */
const PROP_SETBACKS = { landmark: 3 };

/**
 * Metres. The smallest ground rectangle worth emitting after a clip.
 *
 * A road clipped around a portal leg or a dome leaves slivers, and a 4 cm strip
 * of carriageway is two triangles nobody can see costing the same as two
 * triangles somebody can. 0.35 m is a third of a kerbstone: below it the
 * missing surface is inside what `surfaceAt` already answers as bare earth, and
 * above it a person could stand on the piece.
 */
const MIN_GROUND_PIECE_M = 0.35;

/**
 * One rectangle minus one box, as up to four rectangles.
 *
 * A GUILLOTINE AND NOT A POLYGON CLIP, deliberately: every surface in this city
 * is axis-aligned and every keep-out is an AABB, so the difference of two of
 * them is exactly four strips — west, east, and the north and south remainders
 * of the middle band. A general polygon clipper would be correct and would also
 * be a second geometry kernel to be wrong in.
 *
 * The order matters for the RESULT'S SHAPE and not for its area: taking the
 * full-height west and east strips first and then splitting only the middle
 * band gives long strips along the road rather than a pinwheel, which is what
 * keeps a clipped carriageway reading as a carriageway.
 */
function subtractBox(r, b) {
  if (!(r.x1 > b.x0 && r.x0 < b.x1 && r.z1 > b.z0 && r.z0 < b.z1)) return [r];
  const out = [];
  const push = (x0, z0, x1, z1) => {
    if (x1 - x0 >= MIN_GROUND_PIECE_M && z1 - z0 >= MIN_GROUND_PIECE_M) out.push({ ...r, x0, z0, x1, z1 });
  };
  if (b.x0 > r.x0) push(r.x0, r.z0, Math.min(r.x1, b.x0), r.z1);
  if (b.x1 < r.x1) push(Math.max(r.x0, b.x1), r.z0, r.x1, r.z1);
  const mx0 = Math.max(r.x0, b.x0);
  const mx1 = Math.min(r.x1, b.x1);
  if (mx1 > mx0) {
    if (b.z0 > r.z0) push(mx0, r.z0, mx1, Math.min(r.z1, b.z0));
    if (b.z1 < r.z1) push(mx0, Math.max(r.z0, b.z1), mx1, r.z1);
  }
  return out;
}

/** The same, over a list of rectangles and a list of boxes. */
function subtractBoxes(rects, boxes) {
  let cur = rects;
  for (const b of boxes) {
    const next = [];
    for (const r of cur) for (const piece of subtractBox(r, b)) next.push(piece);
    cur = next;
    if (!cur.length) break;
  }
  return cur;
}

/**
 * Generate one chunk. Deterministic in (rootSeed, cx, cz) and nothing else.
 *
 * @returns {{
 *   cx:number, cz:number, density:number, lowDetail:boolean, kind:string,
 *   roadMaterials:string[], buildings:object[], props:object[], signs:object[],
 *   holograms:object[], occluders:object[], landmarks:object[], objectCount:number
 * }}
 */
/**
 * SESSION 30, ITEM 4 — WHERE A CHUNK WANTS A BUS STOP, OR NULL.
 *
 * A DECLARATION AND NOT A PLACEMENT. What is decided here is *which kerb, how
 * far from the junction, and facing which way*; whether that ground is free is
 * `city.js`'s question, because the answer depends on the DELIVERED claims
 * (CONTRACT §9.1: the registry says what was tested and the census says what
 * arrived, and this side is neither — it is the intent).
 *
 * IT IS PURE IN (rootSeed, cx, cz) AND EXPORTED FOR THAT REASON, which is not
 * tidiness — it is the fix for a defect the delivered census found. `city.js`'s
 * `placed` list is the CHUNK'S OWN, so an advertising pillar in one chunk could
 * not see a shelter declared by the chunk next door, and `citycheck` →
 * `occupancy` reported **0.733 m² of pillar standing in a bus stop** across a
 * seam. Asking `generateChunk` for eight neighbours to find that out would cost
 * eight full generations per stop; this costs one hash and a bounds call, so
 * the pillar loop can sweep the 3×3 neighbourhood for nothing.
 *
 * THE PLACEMENT RULE, because the brief asked for a rule and not a scatter:
 *
 *   ON THE PAVEMENT.   `kerbBands` names the four pavement lines a chunk draws,
 *                      as (fixed axis, its value, outward sign). The four
 *                      lattice bands are reproduced here from `chunkBounds`
 *                      alone — the river's two curved bands are excluded, and
 *                      a bank is a promenade rather than a bus route.
 *   NEAR SIDE OF A JUNCTION.  The junction is the chunk's own corner
 *                      (b.x0, b.z0) where its two road lines cross. The stop
 *                      stands `beforeJunctionM` = 22 m along the band from it,
 *                      which is inside the band's own `t0` (CORRIDOR + 3 =
 *                      14.7 m, where the cross-road's corridor stops) with
 *                      7.3 m to spare, so the shelter is clear of the crossing
 *                      rather than on it. 22.0 m is derived and the first
 *                      version of this sentence was not: it said "a bus length
 *                      plus half of one", which is 12.00 + 6.00 = **18.00**,
 *                      and the constant is 22.0. The number that IS 22.0 is
 *                      the one the placement actually has to clear —
 *                      `CORRIDOR` = 11.7 m of cross-road corridor, plus half a
 *                      bus (6.00 m) so a halted 12 m body's tail is clear of
 *                      it, plus the shelter's own half-length (2.00 m) and the
 *                      0.30 m the flag pole reaches past it: 11.7 + 6.0 + 2.0
 *                      + 0.3 = **20.0**, rounded up to 22.0 for the 2 m of
 *                      slack a kerb build needs. It clears the band's own `t0`
 *                      (CORRIDOR + 3 = 14.7) by 7.3 m.
 *   AT INTERVALS.      ONE PER CHUNK AT MOST, at `perChunkP` = 0.5, AND THE
 *                      DELIVERED SPACING IS NOT 1/p CHUNKS. The first version
 *                      of this comment said "a stop every 256 m of route",
 *                      which is `chunkSize / perChunkP` — a per-CHUNK rate used
 *                      as a per-ROUTE spacing, and the two differ by how many
 *                      road lines a chunk owns. A chunk owns TWO (one N–S, one
 *                      E–W) and each carries two pavements, so a chunk holds
 *                      **4 × 128 = 512 m of kerb** and half a stop: the
 *                      delivered spacing is about **1 000 m of kerb per stop**
 *                      before refusals, i.e. one stop per direction of travel
 *                      every ~500 m of route. That is at the LOOSE end of the
 *                      real 250–400 m range rather than the tight one, and it
 *                      is stated that way round rather than flattered. Four a
 *                      chunk, one per band, would be one every 128 m on every
 *                      road line in the city, which nobody builds.
 *
 * `lowDetail` chunks get none, for the reason they get no kerbside props:
 * there is no pavement mesh out there to stand on.
 */
export function busStopAt(rootSeed, cx, cz) {
  const b = chunkBounds(cx, cz);
  const density = densityAt(rootSeed, (b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
  const lowDetail = landmarksTouching(cx, cz).length === 0 && density < CITY.lowDetailThreshold;
  if (lowDetail) return null;
  const rng = chunkRng(rootSeed, cx, cz, 'busstop');
  if (rng.next() >= BUS_STOP.perChunkP) return null;
  /**
   * The four lattice kerb bands, from the chunk's own bounds. The river's two
   * curved promenade bands are deliberately absent — a bank is a promenade and
   * not a bus route — which is why the guard that used to test `band.bank`
   * below was a guard that could not fire and has been removed rather than
   * left to read as a check.
   */
  const bands = [
    { axis: 'x', at: b.x0, side: +1 },
    { axis: 'x', at: b.x0, side: -1 },
    { axis: 'z', at: b.z0, side: +1 },
    { axis: 'z', at: b.z0, side: -1 },
  ];
  const band = bands[rng.int(0, bands.length - 1)];
  /**
   * WHICH junction, and this is the half that was wrong in the first draft.
   *
   * `along` was `corner + beforeJunctionM` for every band, so **78 of 155
   * declared stops stood on the FAR side of the junction** against a rule
   * written as *"near side of a junction"*. A chunk has a junction at each end
   * of the band; which one is NEAR depends on which way the lane beside that
   * pavement runs, and `side` is exactly that fact — it is the outward sign,
   * so with right-hand traffic the lane adjacent to the `+side` pavement runs
   * toward the chunk's LOW corner and the lane adjacent to `-side` runs toward
   * its HIGH one. The stop therefore sits `beforeJunctionM` INSIDE the corner
   * the near lane is heading for, which is inside the band's own `[t0, t1]`
   * either way (`t0` = CORRIDOR + 3 = 14.7, `t1` = size − 3 = 125).
   */
  const lo = band.axis === 'x' ? b.z0 : b.x0;
  const hi = band.axis === 'x' ? b.z1 : b.x1;
  const along = band.side > 0 ? lo + BUS_STOP.beforeJunctionM : hi - BUS_STOP.beforeJunctionM;
  return { axis: band.axis, at: band.at, side: band.side, along };
}

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
  /**
   * Session 20's two new systems, each on its OWN stream. CONTRACT §6: streams
   * are independent so that adding a system cannot shift an existing one's
   * sequence. Drawn from `rng` or `signRng` these would have re-scattered every
   * building and every shopfront sign in the city, and the diff would have read
   * as "the setbacks moved the props", which is a whole session of confusion
   * for two lines saved.
   */
  const setbackRng = chunkRng(rootSeed, cx, cz, 'setback');
  const roofSignRng = chunkRng(rootSeed, cx, cz, 'roofsign');
  /** Session 43's holograms. Its own stream, so nothing else re-phases. */
  const holoRng = chunkRng(rootSeed, cx, cz, 'holo');
  /**
   * SESSION 28 — GROUND-FLOOR RETAIL, AND IT IS ON ITS OWN STREAM FOR THE
   * REASON THE TWO ABOVE ARE.
   *
   * The brief warned that a new roll "will move the city — everything
   * downstream shifts". It does not, and CONTRACT §6 is why: streams are
   * independent, so a roll drawn from `retailRng` cannot displace one drawn
   * from `rng`, `eraRng` or `signRng`. The determinism control measured it —
   * same seed, byte-identical placement, before and after. A new roll shifts
   * the city only when it is taken from a stream something else is already
   * reading, which is exactly what a named stream is for.
   */
  const retailRng = chunkRng(rootSeed, cx, cz, 'retail');
  /** SESSION 28, item 3. The advertising pillars, on their own stream too. */
  const pillarRng = chunkRng(rootSeed, cx, cz, 'pillar');

  const touching = landmarksTouching(cx, cz);
  const hasLandmark = touching.length > 0;
  /**
   * THE LANDMARKS THE REGISTRY MUST KNOW ABOUT ARE NOT THE ONES THE CHUNK
   * BUILDS.
   *
   * `landmarksTouching` answers "whose geometry is mine to draw" and pads by
   * 4 m. A chunk's road strips reach `CORRIDOR` = 11.7 m PAST its own edges, so
   * a landmark sitting 8 m outside the chunk is invisible to that list and its
   * road is not clipped around it: measured, **8 road pieces overlapping the
   * stack, the condenser and the dish, up to 195 m2 each.** One list answering
   * two questions, for the fourth time in this file.
   */
  const nearLandmarks = landmarksTouching(cx, cz, CORRIDOR);

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
  const holograms = [];
  const occluders = [];
  /**
   * WHAT THE REGISTRY REFUSED, BY THE CATEGORY THAT REFUSED IT.
   *
   * `propsGaveUp` exists for exactly this reason and its comment says it: *"a
   * bounded retry is a cap, and a cap nobody prints reads as everything
   * fitted"*. A registry is a much larger cap — it can refuse a whole frontage
   * — and a session that changes a setback needs to see what the change cost
   * before it argues about whether the cost was worth paying. `citycheck`
   * sums these over the region and prints them.
   */
  const refused = {};
  const refuse = (hit) => { if (hit) refused[hit.kind] = (refused[hit.kind] || 0) + 1; return hit; };
  /**
   * SESSION 35. What SHORTENED a building rather than refusing it, by the
   * category that shortened it, plus the metres given up.
   *
   * It is a separate tally from `refused` and not a second use of it, because
   * the two are different verdicts about the same query: a refusal is a
   * building that does not exist and a clip is one that exists and is smaller.
   * Pooling them would make the deepening look like a wave of refusals in
   * exactly the report that is supposed to say whether it was.
   */
  const clipped = {};
  const clip = (kind, lost) => {
    const c = clipped[kind] || (clipped[kind] = { n: 0, lostM: 0 });
    c.n++;
    c.lostM += lost;
  };

  /**
   * SESSION 38 — THE FRONTAGE FUNNEL, COUNTED WHERE IT HAPPENS.
   *
   * `refused` and `clipped` above say what the REGISTRY did. They are the last
   * two stages of a chain that starts at `frontageFill(density)` and ends at a
   * metre of street standing behind a wall, and the six stages between them
   * have never been counted at all. Session 38's brief asks whether there is a
   * loss in that chain beyond what its own definitions explain, and the only
   * honest way to answer is to count each stage in the walk that performs it
   * rather than to reconstruct it in a probe — a second description of this
   * loop living in `tools/` is CONTRACT §9.1's own arrangement, and this file
   * has a comment about exactly that at `bodyAt`.
   *
   * NO RANDOM NUMBER IS DRAWN HERE AND NO BRANCH IS ADDED. Every field is a
   * `++` or a `+=` on a quantity the walk already computed, so the delivered
   * city is bit-identical with this object and without it. That is asserted:
   * `tools/funnelprobe.mjs --identity` compares the delivered census against
   * the pre-instrumentation commit.
   *
   * THE METRES CLOSE. For every side walked,
   *
   *     leadInM + (every candidate's own advance) + tailM  ==  the side length
   *
   * exactly, and `funnelprobe` asserts that residual is zero. An accounting
   * identity is the only thing that makes a funnel evidence rather than a list
   * of numbers that happen to decrease — CONTRACT §9's failure mode is a
   * quantity mistaken for another, and a stage total that does not sum to its
   * parent is that mistake with a length.
   */
  const frontage = {
    /** `frontageFill(density)` for this chunk — the law's own output. */
    fill: 0,
    /** Sides walked, and the metres of island edge they cover. */
    sides: 0, frontageM: 0,
    /** `rng.range(0, 9)` at the head of each side, and what is left at the tail. */
    leadInM: 0, tailM: 0,
    /** Outer-loop runs, and every draw of `width` — one per candidate lot. */
    runs: 0, candidates: 0,
    /**
     * A candidate wider than the frontage left. It ENDS THE SIDE — `t` is set
     * to `side.to` and the run breaks, so the metres in `overrunM` are
     * abandoned rather than walked past. The outer loop's own guard is
     * `t < side.to - 12`, so every one of these had MORE THAN 12 m left and the
     * walk's own minimum building is 11 m wide: the room is recorded so that
     * "a building would have fitted" is a measurement and not an inference.
     */
    overrun: 0, overrunM: 0, overrunRoomMinM: Infinity, overrunRoomMaxM: 0,
    /**
     * SESSION 39, AND THE THREE OF THEM MEASURE DIFFERENT QUANTITIES ON PURPOSE.
     *
     *   `overrun`      candidates whose drawn width did not fit — every arm.
     *   `overrunRoomM` the frontage that was AT RISK — every arm, and NOT a
     *                  bucket of the length funnel, because in the repaired
     *                  arms a building stands on it and `builtM` has it.
     *   `clamped`      candidates the walk CUT to the frontage that remained
     *                  rather than abandoning the side over (`WALK.overrun`).
     *   `clampedM`     the DRAWN width given up by that cut. A width, not a
     *                  frontage: it is metres that were never on the street.
     *
     * `overrunM` — the bucket — is added only where the metres actually leave
     * the walk, which is `'abandon'` alone.
     */
    clamped: 0, clampedM: 0, overrunRoomM: 0, widthOverrunDrawnM: 0,
    /** Of the clamped candidates, the ones that became a BUILDING, and the metres cut off them. */
    clampedDelivered: 0, clampedDeliveredM: 0,
    /**
     * THE QUAY WALK'S OWN COPY OF THE SAME OVERRUN, counted for the first time
     * — STATE 38 §8 carried it as *"uncounted by this funnel"*. It is NOT in
     * the length funnel and must not be: the funnel's parent is the ISLAND
     * edge and the quay runs along the bank, which is a different frontage
     * with a different length. Two lengths in one denominator is CONTRACT §9.
     */
    quayRuns: 0, quayOverrun: 0, quayOverrunM: 0, quayDelivered: 0,
    /** `rng.next() > fill` — the law's own refusal, and what it consumes. */
    fillRefused: 0, fillRefusedM: 0,
    /** Under `MIN_RIVER_DEPTH` between the lot line and the water. */
    riverRefused: 0, riverRefusedM: 0,
    /** Clipped by the registry to under `DEPTH_DISTRIBUTION.minM`. */
    clipRefused: 0, clipRefusedM: 0,
    /** Refused outright by the registry at full depth with no clip available. */
    regRefused: 0, regRefusedM: 0,
    /** Delivered: the count, the frontage they stand on, and the gaps after them. */
    delivered: 0, builtM: 0, runGapM: 0, endGapM: 0, endGaps: 0,
    /**
     * THE WIDTH DRAWN, BY OUTCOME. `width` is `rng.range(11, 27)` and its mean
     * is 19.0 m by construction, so any outcome whose mean width is not 19.0 is
     * SELECTING on width — and the funnel's job is to say whether a stage takes
     * more than its definition allows. The overrun test selects on width by
     * definition; nothing else in the walk is supposed to.
     */
    widthDrawnM: 0, widthDeliveredM: 0, widthFillRefusedM: 0, widthHardRefusedM: 0,
    /**
     * WHAT REFUSED IT, at the stage that does most of the refusing. `refused`
     * above pools every refusal in the chunk — props and the quay walk included
     * — so it cannot answer "what stopped a PERIMETER building", which is the
     * question this funnel's largest drop asks. `clipKeptBy` is the other half:
     * the same kinds, met by a candidate that survived at a shorter depth.
     */
    clipRefusedBy: {}, clipKeptBy: {},
  };

  // --- the buildable island ------------------------------------------------
  // Roads run along every chunk boundary, so the interior is the chunk inset by
  // the corridor half-width. Buildings line its perimeter facing the roads, with
  // the middle left over for whatever the dead-zone kind is — which is how real
  // perimeter blocks work and why they have courtyards.
  const inset = CORRIDOR;
  const island = { x0: b.x0 + inset, x1: b.x1 - inset, z0: b.z0 + inset, z1: b.z1 - inset };

  // --- the keep-out registry ------------------------------------------------
  //
  // ONE OCCUPANCY, WRITTEN AND READ BY EVERYTHING BELOW. See
  // `src/lib/occupancy.js` for why this exists and what the seven violations
  // were. The order of the claims below is the order of AUTHORITY: what is
  // authored claims before what is generated, and what is generated claims in
  // the order a city is built — ground, then structures, then furniture.
  //
  // IT IS BUILT PER CHUNK AND IT KNOWS ABOUT ITS NEIGHBOURS' EDGES, because a
  // chunk owns the corridors on its west and north sides and a building on its
  // own island can reach neither. What it deliberately does NOT do is generate
  // the eight neighbouring chunks to learn their buildings: `generateChunk` is
  // called for every resident chunk every time the ring moves, and a
  // nine-times-the-work registry would put the whole neighbourhood inside
  // `CITY.generateBudget`. The one cross-chunk overlap that matters — two
  // island frontages meeting at a corner — is a property of the LATTICE rather
  // than of a pair, and it is closed below by clamping each side's run to its
  // own island rather than by consulting the neighbour.
  const reg = createRegistry();

  /** The origin block. `block.js` authors this ground; the generator does not. */
  reg.claim(claimBox('block', BLOCK_KEEPOUT.x0, BLOCK_KEEPOUT.z0, BLOCK_KEEPOUT.x1, BLOCK_KEEPOUT.z1,
    { owner: 'origin-block' }));

  /**
   * THE WATER, AS STRIPS ACROSS THE CHUNK, AND NOT WHERE A BRIDGE CROSSES IT.
   *
   * The channel is a curve and a claim is an AABB, so it is sampled every 4 m
   * of x — 32 strips on a river chunk, each the exact `riverEdges` band at its
   * own station. Sampling rather than one envelope box because the envelope is
   * 147.6 m wide and the water is 104.6, and a claim 43 m too wide would refuse
   * the embankment road that is the whole point of a quay.
   *
   * A BRIDGE CROSSING CLAIMS NOTHING, because `river.js` lays a carriageway
   * across it at street grade and a `water` claim under that road would be a
   * conflict the world is supposed to have. The deck is the exception the
   * category exists to express.
   */
  if (riverTouchesChunk(cx, cz)) {
    const STEP = 4;
    /**
     * PAST THE CHUNK'S OWN EDGES BY ONE CORRIDOR, because a chunk's west road
     * strip spans `[x0 − 7.5, x0 + 7.5]` and half of it is over ground the
     * neighbour's coordinates own. Water claimed only inside `[x0, x1]` would
     * leave the western half of every north–south crossing uncut. Over-claiming
     * a neighbour's water is free: `water × water` is not a conflict, and the
     * river is the same river on both sides of a chunk line.
     */
    /**
     * ALIGNED TO A GLOBAL 4 m LATTICE, not to the chunk's own edge.
     *
     * Every chunk that can see a stretch of bank must claim the SAME boxes for
     * it, or two chunks cut the same road to two slightly different lines and
     * the difference turns up as a carriageway 1e-13 m inside the channel —
     * which is what the first version delivered, twice, and it is CONTRACT
     * §9.1's two-descriptions-of-one-thing at the resolution of a rounding
     * error. `b.x0` is a multiple of 128 and therefore of 4, so flooring the
     * start to the lattice makes every chunk's strips identical where they
     * overlap.
     */
    const start = Math.floor((b.x0 - CORRIDOR) / STEP) * STEP;
    for (let x = start; x < b.x1 + CORRIDOR; x += STEP) {
      if (onBridgeDeck(rootSeed, x + STEP / 2, RIVER.z0, CORRIDOR)) continue;
      let north = Infinity;
      let south = -Infinity;
      for (let k = 0; k <= 2; k++) {
        const e = riverEdges(x + (STEP * k) / 2);
        north = Math.min(north, e.north);
        south = Math.max(south, e.south);
      }
      if (south <= north) continue;
      reg.claim(claimBox('water', x, north, x + STEP, south,
        { y0: -RIVER.depth, y1: SURFACE_TOP_M, owner: 'river' }));
    }
  }

  /**
   * THE LANDMARKS, SPLIT INTO WHAT STANDS ON THE GROUND AND WHAT FLIES OVER IT.
   *
   * Session 5 wrote this distinction down as two functions and then had a third
   * question with no answer. Here it is one list with a vertical extent: a
   * viaduct leg is `landmark` from 0 to 21 m and the deck it holds up is `deck`
   * from 14.2 to 21 m, and a carriageway conflicts with the first and not the
   * second — which is what an elevated railway over a street IS.
   *
   * SESSION 34 — THE GROUND HALF MOVED OUT OF THIS LOOP AND INTO
   * `landmarkGroundClaims`, AND NOTHING ABOUT WHAT IS CLAIMED CHANGED. The
   * boxes, their y extents and their owner strings are the same ones session 23
   * and session 31 put here; what is different is that `traffic.js` can now
   * read the same list. It had no way to, so the fleet drove across every
   * landmark in the city — 44 100 m² of it across the weir alone. The deck
   * half stays here because it is the one claim that is NOT a ground claim.
   */
  for (const l of nearLandmarks) {
    for (const o of landmarkOccluders(l)) {
      if (o.deck) {
        reg.claim(claimBox('deck', o.x0, o.z0, o.x1, o.z1, { y0: o.base, y1: o.top, owner: l.name }));
      }
    }
    for (const g of landmarkGroundClaims(l)) {
      const box = claimBox('landmark', g.x0, g.z0, g.x1, g.z1, { y0: g.y0, y1: g.y1, owner: g.owner });
      // `tested` is the viaduct end treatment's own refusal — see below.
      if (g.tested && reg.conflict(box)) continue;
      reg.claim(box);
    }
    if (l.kind === 'viaduct') {
      /**
       * THE END TREATMENT, CLAIMED — SESSION 23, item 2, and it is a claim that
       * did not exist rather than one that was wrong.
       *
       * `landmarkOccluders` returns a viaduct's legs and its deck segments.
       * Session 21's abutment and wing walls are in neither list, so an 18.2 m
       * solid 6.0 x 11.1 m has stood at each end on ground nothing tested —
       * CONTRACT §9.1's *"anything placed procedurally is tested against the
       * existing occupancy, or it is not placed"* with a landmark's own geometry.
       *
       * TESTED BEFORE IT IS CLAIMED, AND REFUSED RATHER THAN MOVED, which is
       * the park railings' pattern (`if (reg.conflict(box)) continue`). Moving
       * it is not available: an end treatment's whole job is to be where the
       * deck stops, and a portal 8 m along the arc from the last station is a
       * shed in a field. So the honest failure is to build nothing there and
       * leave the cut end visible, which a reader can see, rather than to
       * quietly slide a 27 m mass into a building.
       *
       * IT IS CLAIMED HERE, BEFORE THE ROADS AND THE BUILDINGS. That ordering
       * is what does the work: `landmark` conflicts with `building`,
       * `carriageway`, `pavement`, `prop` and five more, so laying it down
       * first makes every one of those refuse ITSELF against the portal.
       * Claimed afterwards it could only ever report a collision somebody else
       * had already committed. Measured: it refuses exactly one building of
       * 367, standing 1.73 m from session 21's abutment against the 4.2 m
       * face-to-face setback the pair carries.
       *
       * **AND THE `conflict()` CALL ITSELF IS INERT TODAY, WHICH IS SAID HERE
       * RATHER THAN LEFT FOR A READER TO DISCOVER.** At this point in
       * `generateChunk` the registry holds only `block`, `water` and the
       * landmarks and decks already walked, and the table permits `landmark`
       * against **all four** — so there is no claim in existence that this test
       * could reject. It is a guard that cannot currently fire, which is
       * CONTRACT §7.1's own subject, and it is kept for two reasons that are
       * both about a future rather than about now: the day one of those four
       * pairs becomes forbidden, and the day an end moves somewhere a `water`
       * or `block` claim reaches. **The measurement that actually decided this
       * placement is `tools/portalprobe.mjs`**, which sweeps candidate
       * footprints against the FULL region registry — buildings included — and
       * is where END A's refusal at 10 m of depth comes from.
       *
       * Measured at seed 1337 over the gate's own region before it was built
       * (`tools/portalprobe.mjs`): free at both ends, and the binding
       * constraint at END A is a 46.4 m building 10.44 m away — free to 8 m of
       * depth and 14.0 m of width, refused at 10 m and 16.0 m. The delivered
       * box is 6.0 x 13.7 m, so it clears by 2 m of depth and 0.3 m of width.
       * END B is free to 20 m and 18 m; its nearest forbidden claim is a
       * planter at 13.01 m.
       *
       * SESSION 34: the boxes and the `conflict()` test both moved to
       * `landmarkGroundClaims` and to the `g.tested` line above. Nothing about
       * either changed; this paragraph is the derivation and stays with the
       * subject it derives.
       */
    }
    /**
     * A BASIN OCCLUDES NOTHING AND STILL TAKES 210 m OF GROUND. `landmarkOccluders`
     * returns [] for it and says so in a comment; `landmarkAABB` already has the
     * fallback and this is the third place that needs it, which is exactly the
     * argument for the registry holding the answer rather than each caller.
     *
     * SESSION 34 — AND THE FOURTH PLACE THAT NEEDED IT WAS `traffic.js`, WHICH
     * NEVER ASKED. The claim moved into `landmarkGroundClaims` above, which is
     * the registry-holds-the-answer arrangement this paragraph asked for,
     * arriving nine sessions later than the paragraph.
     */
  }

  /**
   * THE ROADS — CLIPPED TO WHAT IS ALREADY CLAIMED, AND THIS IS THE HALF THAT
   * WAS MISSING.
   *
   * `city.js` has emitted these rectangles since session 4 and clipped them
   * against exactly two things it knew about by name: the origin block and the
   * river. Nothing told it about the landmarks, so the delivered city has
   * carried, measured this session over the eight landmarks:
   *
   *     exchange   2906 m2 of carriageway    condenser  2113 m2
   *     dish       1201 m2                   stack       384 m2
   *     arch        300 m2                   viaduct     135 m2
   *
   * — the dome the operator walked into being the 2906. The rectangles are
   * computed HERE now, beside the registry they are clipped against, and
   * `city.js` emits what it is given. One description of the road network
   * instead of two.
   */
  const ground = [];
  {
    const r = CITY.roadHalfWidth;
    const w = CORRIDOR;
    /** The blockers a ground surface is cut around: solid, at grade, not a deck. */
    const solid = () => reg.all().filter((c) => c.kind === 'landmark' || c.kind === 'block' || c.kind === 'water');
    /**
     * ALL FOUR EDGES ARE CLAIMED; ONLY TWO ARE EMITTED.
     *
     * A chunk owns the roads on its west and north sides, so those are the ones
     * it draws — that is session 4's arrangement and it is why no road is built
     * twice. It is ALSO why the quayside terrace, which is the one walk that
     * runs the full width of a chunk rather than around its island, could not
     * see the road on its own east or south edge: measured, **two quayside
     * buildings standing in a carriageway and one across a pavement, 36 to
     * 44 m2 each**, tested against every road their chunk happened to own and
     * against neither of the two it did not.
     *
     * The lattice is a pure function of position, so the other two edges cost
     * nothing to compute and are claimed with `own: false`. `ground` gets the
     * two this chunk draws; the registry gets all four, and a building is
     * tested against the road network rather than against this chunk's share
     * of it.
     */
    const strips = [
      { own: true, kind: 'road', yKey: 'roadNS', x0: b.x0 - r, z0: b.z0 - w, x1: b.x0 + r, z1: b.z1 + w, axis: 'NS' },
      { own: true, kind: 'road', yKey: 'roadEW', x0: b.x0 - w, z0: b.z0 - r, x1: b.x1 + w, z1: b.z0 + r, axis: 'EW' },
      { own: true, kind: 'walk', yKey: 'walkNS', x0: b.x0 + r, z0: b.z0 + r, x1: b.x0 + w, z1: b.z1, axis: 'NS' },
      { own: true, kind: 'walk', yKey: 'walkNS', x0: b.x0 - w, z0: b.z0 + r, x1: b.x0 - r, z1: b.z1, axis: 'NS' },
      { own: true, kind: 'walk', yKey: 'walkEW', x0: b.x0 + w, z0: b.z0 + r, x1: b.x1, z1: b.z0 + w, axis: 'EW' },
      { own: true, kind: 'walk', yKey: 'walkEW', x0: b.x0 + w, z0: b.z0 - w, x1: b.x1, z1: b.z0 - r, axis: 'EW' },
      { own: false, kind: 'road', yKey: 'roadNS', x0: b.x1 - r, z0: b.z0 - w, x1: b.x1 + r, z1: b.z1 + w, axis: 'NS' },
      { own: false, kind: 'road', yKey: 'roadEW', x0: b.x0 - w, z0: b.z1 - r, x1: b.x1 + w, z1: b.z1 + r, axis: 'EW' },
      { own: false, kind: 'walk', yKey: 'walkNS', x0: b.x1 - w, z0: b.z0, x1: b.x1 - r, z1: b.z1, axis: 'NS' },
      { own: false, kind: 'walk', yKey: 'walkEW', x0: b.x0, z0: b.z1 - w, x1: b.x1, z1: b.z1 - r, axis: 'EW' },
    ];
    const blockers = solid();
    for (const s of strips) {
      /**
       * THE RIVER'S TWO ANSWERS, KEPT — they are not a clip against a box and
       * the registry cannot express them. An east–west road LINE inside the
       * channel is not a road, it is the river, and is refused whole on the
       * ENVELOPE rather than sampled (`city.js` has the derivation). A
       * north–south road CROSSES, and off a bridge it is cut back to the bank
       * at the worst station across its own width.
       */
      const env = riverEnvelope();
      let pieces = [s];
      if (s.z1 > env.z0 && s.z0 < env.z1) {
        if (s.axis === 'EW') continue;
        if (!onBridgeDeck(rootSeed, (s.x0 + s.x1) / 2, (env.z0 + env.z1) / 2)) {
          /**
           * THE CUT IS TAKEN FROM THE WATER'S OWN CLAIMS, NOT FROM A SECOND
           * SAMPLING OF THE BANK.
           *
           * `city.js` sampled `riverEdges` at 11 stations here and the registry
           * samples it every 4 m, and two samplings of one curve disagree by
           * whatever falls between their stations: measured, **three overlaps
           * of 0.03 to 0.09 m2 between a carriageway and the channel it is
           * supposed to stop short of.** Sub-decimetre, invisible, and exactly
           * CONTRACT §9.1's two-descriptions-of-one-thing. Reading the claims
           * makes the road end at or beyond every claimed edge BY
           * CONSTRUCTION, which is a different kind of correct from a tighter
           * tolerance.
           *
           * A straight cut across the whole strip rather than a stepped one:
           * the road stops at the worst station over its own width, which is
           * `city.js`'s original argument and is what keeps the kerb straight.
           */
          let north = Infinity;
          let south = -Infinity;
          for (const c of reg.hits({ x0: s.x0, x1: s.x1, z0: env.z0, z1: env.z1, y0: 0, y1: SURFACE_TOP_M }, 0, ['water'])) {
            north = Math.min(north, c.z0);
            south = Math.max(south, c.z1);
          }
          if (north === Infinity) {
            // No claimed water under this strip — the whole crossing is a
            // bridge, or the channel has wandered out of the chunk. Left whole.
            north = s.z1;
            south = s.z0;
          }
          pieces = [];
          if (north > s.z0) pieces.push({ ...s, z1: Math.min(s.z1, north) });
          if (south < s.z1) pieces.push({ ...s, z0: Math.max(s.z0, south) });
        }
      }
      for (const piece of subtractBoxes(pieces, blockers)) {
        if (s.own) ground.push(piece);
        reg.claim(claimBox(piece.kind === 'road' ? 'carriageway' : 'pavement',
          piece.x0, piece.z0, piece.x1, piece.z1, { owner: `road:${piece.yKey}` }));
      }
    }
  }

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
     *
     * ───────────────────────────────────────────────────────────────────────
     * SESSION 32: 2.2 → 1.4, AND THE ARGUMENT ABOVE IS THE REASON IT IS 1.4
     * RATHER THAN A LINEAR LAW OR A CONSTANT.
     *
     * LOOK.md §2 asks for a continuous street wall and says *"fill approaches
     * 1.0 in the core"*. It did not: at the region's own p90 density of 0.700
     * the shipped law accepted **51.9%** of candidates, and the median block
     * delivered 16.2% of its frontage as building.
     *
     * Swept over `city-budget.json`'s own 10×10 region at seed 1337, delivered
     * counts read off `generateChunk` rather than predicted:
     *
     *     law                       buildings   occ med   bare sides   bldg CV
     *     0.12 + 0.88·d^2.2  was          366     0.162     179/400      0.771
     *     0.12 + 0.88·d^1.8                418     0.204     166/400      0.712
     *     0.12 + 0.88·d^1.4  now          480     0.244     148/400      0.698
     *     0.20 + 0.80·d^1.2                545     0.294     139/400        —
     *     0.40 + 0.60·d                    630     0.316     127/400        —
     *     1.00               ceiling       797     0.490     115/400        —
     *
     * 1.4 is where the budget stops, not where the picture does — see the
     * measured triangle and draw-call cost in STATE 32. It buys **+31%
     * buildings, +51% frontage occupancy and 31 fewer block sides bare end to
     * end**, and it keeps the district structure this comment exists to
     * protect: the delivered buildings-per-chunk CV moves 0.771 → 0.698, and a
     * linear law is what measured 0.471 and failed.
     *
     * AND THE END-OF-RUN GAP IS NOT THE LEVER IT LOOKS LIKE. STATE 31's sweep
     * has a row where shrinking `rng.range(6, 26)` to `(0.2, 1.4)` takes the
     * city to 921 buildings — but that row is AT `fill = 1.0`. Measured at the
     * shipped fill, `(6, 26) → (3, 13)` delivers **374 buildings against 366**,
     * and block sides bare end to end go UP, 179 → 185, which is the re-phase
     * and not an effect. At this fill the walk is rejection-dominated: a
     * rejected candidate already costs `width + 1..7` ≈ 23 m, so saving 8 m at
     * the end of a run rarely buys room for another 19 m building. The gap is
     * worth revisiting only if the roll ever gets near 1. Session 36 took the
     * roll to 1 and the gap is now the larger of the two remaining terms — see
     * the sweep below.
     *
     * ───────────────────────────────────────────────────────────────────────
     * SESSION 36: 1.4 → 1.1, AND THE THING THAT STOPS IT IS NOT THE ONE ABOVE.
     *
     * Session 32 wrote *"1.4 is where the budget stops"* and the budget it meant
     * was draw calls and triangles. Swept the whole way to the ceiling by
     * `tools/fillprobe.mjs` — same 10 × 10 region, same seed, delivered counts
     * off `generateChunk`, coverage as a UNION raster and not a sum:
     *
     *     power   bldgs   cover%   occ/blk   bare/400   objCV   perfcheck
     *      1.40     491    28.1%    0.237     147/400   0.626   433 draws 1.60 M tris
     *      1.10     528    31.2%    0.268     137/400   0.626   434 draws 1.71 M tris   <- ships
     *      1.05     548    32.1%    0.277     138/400   0.611
     *      1.00     552    32.2%    0.283     140/400   0.609
     *      0.95     569    33.3%    0.293     134/400   0.604
     *      0.90     595    34.4%    0.306     128/400   0.591   <- clumping RED
     *      0.50     689    38.4%    0.355     118/400   0.568
     *      0.00     786    45.4%    0.463     122/400   0.535   437 draws 2.18 M tris
     *
     * `cover%` is over the 81 chunks carrying a building; `objCV` is
     * buildings + props + signs per chunk, which is the quantity `citycheck`'s
     * clumping floor of **0.60** is computed from.
     *
     * **THE DRAW-CALL CEILING NEVER BINDS.** At `fill = 1.0` — 60% more
     * buildings than ship — `highway_speed` measured **437 draws of 440**. The
     * whole range of this law costs FOUR draw calls. What binds at that end is
     * the TRIANGLE ceiling: 2.18 M against 2.00 M, first breached near 700
     * buildings by the 1.96 kTri per building the two endpoints imply.
     *
     * **AND THE CLUMPING FLOOR BINDS BEFORE EITHER, AT 0.90.** A smaller power
     * fills the SPARSE end hardest (see `FRONTAGE_FILL`), which is district
     * structure being spent, and district structure is what that floor is for —
     * LOOK.md §2's *"density has causes"* asks for the same thing from the other
     * side. So it is not a proxy arguing against the goal and it was not
     * re-derived.
     *
     * 1.1 IS THE LARGEST RAISE THAT COSTS NO CLUMPING MARGIN AT THE GATE'S OWN
     * SEED: `objCV` is 0.626 at 1.4 and 0.626 at 1.1, and 0.611 one step
     * further on. It buys +7.5% buildings, +11% island coverage, +13% frontage
     * occupancy and ten fewer block sides bare end to end, for one draw call.
     *
     * **WHAT THAT MARGIN IS WORTH, MEASURED, BECAUSE IT IS ONE DRAW.** Over
     * five seeds `objCV` at the SHIPPED law reads 0.626 / 0.529 mean / **0.466
     * worst** — a spread of 0.160 against a floor margin of 0.026. The gate is
     * green at 1337 and would be red at four of the five. That is CONTRACT §0
     * rule 6's own condition and it is recorded here rather than acted on: the
     * floor is not moved and the arm chosen is the one that spends none of it.
     *
     * AND FILL IS NOT THE LAST KNOB EITHER. At `fill = 1.0` the delivered
     * coverage is **45.4%** against the 95.0% a full ring at this depth would
     * cover. What is left is the end-of-run gap below and the refusals — at the
     * ceiling the registry refuses 484 candidates, 282 of them against another
     * BUILDING, which is the corner meeting session 35's depth created.
     */
    const fill = frontageFill(density);
    frontage.fill = fill;

    const sides = [
      { axis: 'x', at: island.z0, out: -1, from: island.x0, to: island.x1 },
      { axis: 'x', at: island.z1, out: 1, from: island.x0, to: island.x1 },
      { axis: 'z', at: island.x0, out: -1, from: island.z0, to: island.z1 },
      { axis: 'z', at: island.x1, out: 1, from: island.z0, to: island.z1 },
    ];

    /**
     * WHERE THE WALK RESUMES AFTER THE REGISTRY REFUSED A CANDIDATE — SESSION 39.
     *
     * `t + width + gap` is what shipped, and it is an advance that knows
     * nothing about the thing that refused it. A pad 6 m long and a pad 60 m
     * long cost the same 20.5 m step, so the walk lands INSIDE the long one and
     * refuses again (correct — the pad is still there) and PAST the short one,
     * skipping clear frontage on the far side of it for nothing. Measured by
     * `tools/padprobe.mjs`: 68 of 296 clip refusals land past the claim's far
     * edge and give up **701 m — 2.0% of the island edge — beyond a pad rather
     * than under one**.
     *
     * So the refusal lands at the claim's own far edge instead, when that is
     * NEARER than the step would have been. Two guards, and both of them are
     * the loop's invariant rather than taste:
     *
     *   - it only ever SHORTENS the advance, so no frontage is skipped that the
     *     shipped walk would have walked;
     *   - it advances `t` by at least 0.2 m — the smallest gap this walk puts
     *     between two buildings, `rng.range(0.2, 1.4)`'s own floor — so "every
     *     path either advances `t` or ends the side" still holds. Landing hard
     *     against a pad that refuses on a setback would otherwise be a lot
     *     refused at the same `t` for ever.
     *
     * IT DRAWS NO RANDOM NUMBER. `gap` is the draw the caller already took.
     */
    const afterRefusal = (t0, width, gap, side, hit) => {
      const stepped = t0 + width + gap;
      if (WALK.refusal !== 'resume' || !hit) return stepped;
      const far = (side.axis === 'x' ? hit.x1 : hit.z1) + gap;
      return far < stepped && far >= t0 + 0.2 ? far : stepped;
    };

    for (const side of sides) {
      /**
       * ONE RETAIL ROLL FOR THE WHOLE FRONTAGE — session 28. Taken here, before
       * the run loop, so it is a property of the SIDE and every building on it
       * inherits it. That is what makes a shopping street a street rather than
       * a scatter. See `RETAIL`.
       */
      const retailSide = retailFrontage(retailRng, density);
      let t = side.from + rng.range(0, 9);
      frontage.sides++;
      frontage.frontageM += side.to - side.from;
      frontage.leadInM += t - side.from;
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
        frontage.runs++;
        for (let i = 0; i < runLength && t < side.to - 12; i++) {
          const room = side.to - t;
          /** Metres the clamp took off this candidate's drawn width, if any. */
          let cut = 0;
          /** One uniform, whatever the arm — see `WALK`. */
          let width = WALK.overrun === 'fit'
            ? rng.range(11, Math.min(27, room))
            : rng.range(11, 27);
          const tCand = t;
          frontage.candidates++;
          frontage.widthDrawnM += width;
          if (t + width > side.to) {
            frontage.overrun++;
            frontage.overrunRoomM += room;
            /**
             * THE WIDTH AS DRAWN, STORED RATHER THAN RECOVERED BY SUBTRACTION.
             * `funnelprobe --laws` used to get this as
             * `widthDrawnM − delivered − fillRefused − hardRefused`, which is
             * exact only while an overrun candidate lands in NO other bucket.
             * Under `WALK.overrun = 'clamp'` it lands in one, so that
             * subtraction silently became the clamp's own loss and the row read
             * 4.878 m for a stage whose definition is 19.0. Stored.
             */
            frontage.widthOverrunDrawnM += width;
            frontage.overrunRoomMinM = Math.min(frontage.overrunRoomMinM, room);
            frontage.overrunRoomMaxM = Math.max(frontage.overrunRoomMaxM, room);
            traceFrontage({
              what: 'overrun', cx, cz, axis: side.axis, at: side.at, out: side.out,
              t: tCand, width, room, density, arm: WALK.overrun,
            });
            if (WALK.overrun === 'abandon') {
              /**
               * THE ONLY ARM IN WHICH THESE METRES LEAVE THE FUNNEL. `overrunM`
               * is a bucket of the length funnel and `overrunRoomM` is not: in
               * the repaired arms the same metres are spent by the building
               * that stands on them, and counting them twice would be a funnel
               * that no longer closes — which is what the residual is for.
               */
              frontage.overrunM += room;
              t = side.to;
              break;
            }
            // The last lot on a block is what is left of it. `room` is over 12 m
            // by the outer guard and the walk's narrowest building is 11 m, so
            // this is always a lot the walk could have drawn.
            frontage.clamped++;
            frontage.clampedM += width - room;
            cut = width - room;
            width = room;
          }

          if (rng.next() > fill) {
            t += width + rng.range(1, 7);
            frontage.fillRefused++;
            frontage.fillRefusedM += t - tCand;
            frontage.widthFillRefusedM += width;
            traceFrontage({
              what: 'fill', cx, cz, axis: side.axis, at: side.at, out: side.out,
              t: tCand, width, consumed: t - tCand, density,
            });
            continue;
          }

          let depth = buildingDepthRoll(rng, density);

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
                frontage.riverRefused++;
                frontage.riverRefusedM += t - tCand;
                frontage.widthHardRefusedM += width;
                traceFrontage({
                  what: 'river', cx, cz, axis: side.axis, at: side.at, out: side.out,
                  t: tCand, width, consumed: t - tCand, limit, density,
                });
                continue;
              }
              depth = limit;
            }
          }

          const eraName = ERA_NAMES[weightedIndex(eraRng.next, ERA_NAMES.map((n) => CITY_ERAS[n].weight))];
          const era = CITY_ERAS[eraName];
          const floors = Math.max(3, Math.round(buildingHeightRoll(rng) / era.floor));
          const height = floors * (era.floor + eraRng.gauss() * 0.05);

          /**
           * ═══════════════════════════════════════════════════════════════
           * THE DEPTH CLIP — SESSION 35. A FRONTAGE ON A CONSTRAINED LOT IS
           * SHALLOW, NOT ABSENT, AND THAT IS THE SENTENCE THE RIVER CLAMP
           * ABOVE ALREADY MAKES.
           * ═══════════════════════════════════════════════════════════════
           *
           * WHY IT HAD TO EXIST THE MOMENT DEPTH GREW. The four sides are
           * walked in order — the two running along x first, over the island's
           * FULL x range, then the two running along z. A 40 m building on side
           * one occupies the whole corner, and every candidate on side three
           * that lands within 40 m of that corner is refused outright. Measured
           * over the gate's own region with the deepening in and the clip out:
           * see STATE 35 §1's sweep — the block stops being a ring and becomes
           * two deep bars, and the two z sides lose most of their frontage to a
           * refusal each rather than to a shorter building.
           *
           * A REAL BLOCK DOES NOT DO THAT. Its corner is one building serving
           * two frontages, and the building behind the corner is simply less
           * deep. So the answer is the river's: cut the depth to whatever land
           * there is, and refuse only when what is left is under
           * `DEPTH_DISTRIBUTION.minM` — the same 9 m `MIN_RIVER_DEPTH` calls a
           * single-bay terrace, so a corner and a quay agree about what the
           * shallowest real building is.
           *
           * BISECTION, AND IT IS EXACT RATHER THAN APPROXIMATE. The near face
           * is pinned to the lot line and only the far face moves, so the box
           * at depth `d` CONTAINS the box at every smaller depth: conflict is
           * monotone in `d` and a bisection finds the boundary. It draws no
           * random numbers, so it cannot move a stream. `CLIP_STEPS` of 7 on a
           * 40.6 m range resolves 0.32 m, which is under the 0.35 m
           * `MIN_GROUND_PIECE_M` already calls the smallest piece of ground
           * worth emitting.
           *
           * THE FULL-DEPTH BOX IS TESTED FIRST AND COSTS EXACTLY WHAT THE OLD
           * SINGLE TEST COST. Only a building that actually meets something
           * pays for the search, which is why this is not seven times the
           * registry work.
           */
          /**
           * The footprint at depth `d`. `MINUS out` — see the note at `site`.
           *
           * IT IS STILL A CENTRE PLUS AND MINUS A HALF, AND THAT IS LOAD-
           * BEARING RATHER THAN INHERITED. `city.js` reconstructs the DELIVERED
           * claim as `bld.x ± bld.width/2` off the mass it drew, and
           * `citycheck`'s occupancy gate compares that against this one. Two
           * expressions for one rectangle is CONTRACT §9.1's own shape, and it
           * is not hypothetical here: building this box from its FACES instead
           * — exact, and the obvious repair for the ulp below — made the
           * generator and the census disagree by one ulp at the lot line and
           * put **59 `building × pavement` overlaps of 0.000 m² into the
           * delivered census** on the first run. The two sides have to compute
           * the same thing, so the repair goes into the CENTRE.
           */
          const bodyAt = (d) => {
            const half = d / 2;
            const across = lotCentre(side.at, side.out, half);
            const along = t + width / 2;
            const bx = side.axis === 'x' ? along : across;
            const bz = side.axis === 'x' ? across : along;
            const hx = side.axis === 'x' ? width / 2 : half;
            const hz = side.axis === 'x' ? half : width / 2;
            return {
              bx, bz,
              /** `2·half` is exact in binary, so `bw/2` is `hx` bit for bit. */
              bw: 2 * hx,
              bd: 2 * hz,
              site: claimBox('building',
                bx - hx, bz - hz, bx + hx, bz + hz,
                { y0: 0, y1: buildingTopM(era, eraName, height, floors), owner: `bld:${cx},${cz}` }),
            };
          };
          const boxAt = (d) => bodyAt(d).site;

          if (DEPTH_DISTRIBUTION.clip) {
            const hit = reg.conflict(boxAt(depth), 0, BUILDING_SETBACKS);
            if (hit) {
              const wanted = depth;
              let lo = 0;
              let hi = depth;
              for (let i = 0; i < CLIP_STEPS; i++) {
                const mid = (lo + hi) / 2;
                if (reg.conflict(boxAt(mid), 0, BUILDING_SETBACKS)) hi = mid; else lo = mid;
              }
              if (lo < DEPTH_DISTRIBUTION.minM) {
                refuse(hit);
                t = afterRefusal(t, width, rng.range(0, 3), side, hit);
                frontage.clipRefused++;
                frontage.clipRefusedM += t - tCand;
                frontage.widthHardRefusedM += width;
                frontage.clipRefusedBy[hit.kind] = (frontage.clipRefusedBy[hit.kind] || 0) + 1;
                traceFrontage({
                  what: 'clip', cx, cz, axis: side.axis, at: side.at, out: side.out,
                  t: tCand, width, consumed: t - tCand, wanted, best: lo, density,
                  kind: hit.kind, owner: hit.owner,
                  hit: { x0: hit.x0, x1: hit.x1, z0: hit.z0, z1: hit.z1 },
                });
                continue;
              }
              frontage.clipKeptBy[hit.kind] = (frontage.clipKeptBy[hit.kind] || 0) + 1;
              traceFrontage({
                what: 'clipKept', cx, cz, axis: side.axis, at: side.at, out: side.out,
                t: tCand, width, wanted, best: lo, density,
                kind: hit.kind, owner: hit.owner,
                hit: { x0: hit.x0, x1: hit.x1, z0: hit.z0, z1: hit.z1 },
              });
              clip(hit.kind, wanted - lo);
              depth = lo;
            }
          }

          /**
           * MINUS `out`, not plus — and it is inside `boxAt` now.
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
           *
           * THE CENTRE IS NOW DERIVED FROM THE CLAIM AND NOT THE OTHER WAY
           * ROUND — CONTRACT §9.1, one description. `bld.x`/`bld.z` are what
           * `city.js` puts the mass at and the claim is what the registry
           * refuses things against, and computing them from two expressions
           * that agree in exact arithmetic and not in the driver's is the
           * arrangement §9.1 is a list of. It is also what the ulp above is
           * about: the claim's faces are the authority, so the centre is their
           * midpoint.
           */

          /**
           * ONE TEST, AGAINST EVERYTHING — session 21.
           *
           * WHAT THIS REPLACED, AND WHY THREE TESTS WERE NEVER GOING TO BE
           * ENOUGH. There were three here: a padded CENTRE test against the
           * origin block, a padded CENTRE test against the landmarks, and a
           * four-CORNER test against the river with a paragraph explaining why
           * the first two could get away with centres and this one could not.
           * Three predicates, three geometries, three sets of pad arithmetic —
           * and no test at all against the other buildings, which is why 38
           * pairs of them overlapped across the gate's own region with a worst
           * overlap of 504.8 m2, and none against the viaduct deck.
           *
           * The box is the FOOTPRINT and the height is the building's own, so
           * the vertical extent decides the deck: a mass taller than the deck's
           * clearance band conflicts with it and a shorter one stands under it,
           * which is what is under an elevated railway everywhere there is one.
           *
           * `landmark: 10` is session 4's own setback, kept — a building is
           * refused within 10 m of a landmark so that a landmark has a plaza.
           * `water: 0` because `riverBlocks`' 7.7 m of wall-and-promenade is
           * already inside the claim.
           */
          /**
           * `y1` IS THE TOP OF THE BUILDING AND NOT THE TOP OF THE WALL —
           * session 25. It was `height`, which is where the masonry stops and
           * not where the building does: parapet, cornice and plant all stand
           * above it, the worst by 18.72 m. See `buildingTopM`.
           */
          const { bx: cxb, bz: czb, bw, bd, site } = bodyAt(depth);
          if (refuse(reg.conflict(site, 0, BUILDING_SETBACKS))) {
            t += width + rng.range(0, 3);
            frontage.regRefused++;
            frontage.regRefusedM += t - tCand;
            frontage.widthHardRefusedM += width;
            continue;
          }
          reg.claim(site);

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

          /**
           * Distance from this building's own frontage to the nearer END of the
           * side, in metres — i.e. to the cross street. Measured from the
           * building's SPAN (`t` to `t + width`) rather than from its centre,
           * because a 27 m building whose centre is 20 m from the junction has
           * its shopfront 6.5 m from it. CONTRACT §9 rule 7.
           */
          const distToEndM = Math.min(t - side.from, side.to - (t + width));
          const retail = retailBuilding(retailRng, retailSide, distToEndM);

          const bld = {
            x: cxb, z: czb,
            /**
             * OFF THE CLAIM, so the mass `city.js` draws and the footprint the
             * registry defends are one description and not two — see the note
             * at `cxb`. `bw`/`bd` are `width`/`depth` in the right world axis
             * to within an ulp, and it is the ulp that is the point.
             */
            width: bw,
            depth: bd,
            height,
            floors,
            era: eraName,
            material,
            condition: CONDITIONS[conditionIx],
            /**
             * SESSION 28. Whether the ground floor TRADES. `era.ground` still
             * decides what it LOOKS like; this decides whether it is glazed and
             * lit. The two were one field and they are two facts.
             */
            retail,
            /** Kept so a probe can ask why — the frontage's answer, not this building's. */
            retailFrontage: retailSide,
            /** SESSION 28. Wants an advertising pillar; `city.js` decides if it fits. */
            adPillar: adPillarWanted(pillarRng, retail, density),
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
            /**
             * Session 20. `null` for anything under `SETBACK.minHeightM`, and
             * `buildingTiers()` returns the single full-height box for those —
             * so the un-stepped path is the old geometry by arithmetic rather
             * than by a branch. Its own stream, `setbackRng`, for CONTRACT §6's
             * reason: drawn from `rng` it would move every building after it.
             */
            setbacks: rollSetbacks(setbackRng, height),
          };
          buildings.push(bld);

          /**
           * THE ENVELOPE, NOT THE MASSING. See `SETBACK`'s note: the occluder
           * keeps the full footprint to the full height even where the building
           * steps in, so the canyon bake is conservative by the volume the
           * setbacks remove and the worker never has to agree with the main
           * thread about a stepped solid.
           */
          occluders.push({
            x0: cxb - bld.width / 2, x1: cxb + bld.width / 2,
            z0: czb - bld.depth / 2, z1: czb + bld.depth / 2,
            top: height,
          });

          pushRoofSign(bld, roofSignRng, density, signs);
          /**
           * The hologram over this corner's junction, if it has one. `cornerSide`
           * is which end of the elevation the junction is at, as a sign along it:
           * the building's span is `t` to `t + width` and the side runs `from` to
           * `to`, so the nearer end is the one `distToEndM` was taken against.
           */
          const holo = rollHologram(holoRng, bld, density, distToEndM,
            (t - side.from) <= (side.to - (t + width)) ? -1 : 1);
          if (holo) holograms.push(holo);

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
            /**
             * ONE DRAW ON EVERY PATH, unchanged: only the line it is compared
             * against moved. See `SIGN_BIG` for the roll and for the two signs
             * that were wider than their own buildings before it.
             */
            const bigP = bld.retail ? SIGN_BIG.pTrading
              : bld.retailFrontage ? SIGN_BIG.pFrontage : SIGN_BIG.pQuiet;
            const big = height > 30 && signRng.next() < bigP;
            /**
             * THE ELEVATION'S OWN WIDTH, which for a side running along x is
             * `bld.width` and for one running along z is `bld.depth` — the same
             * pair `city.js`'s `halfTanOf` picks between, written here rather
             * than inferred, because both are a width in metres on the same axis
             * convention and that is CONTRACT §9's whole table.
             */
            const frontageM = side.axis === 'x' ? bld.width : bld.depth;
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
            /**
             * THE BLADE ROLL — SESSION 34, LOOK.md §3, and it is conditioned on
             * TRADE rather than sprinkled.
             *
             * §5's test for anything added to this city is that it be derivable
             * from something the city already has. What a blade is derivable
             * from is the retail frontage roll session 28 built: a tall
             * vertical sign is what a shop puts out over a pavement so it reads
             * from down the street, and a street with no shops on it has no
             * reason to carry one. `bld.retail` is "this building trades" and
             * `bld.retailFrontage` is "this side of the block is a shopping
             * street"; both are already decided and nothing read them here.
             *
             * `big` wins over `blade`: a 9–17 m building-scale sign and a
             * vertical blade are two different objects and a building carrying
             * one is not carrying the other.
             */
            const bladeRoll = signRng.next();
            const bladeWanted = !big && (bld.retail
              ? bladeRoll < SIGN_BLADE.pTrading
              : bld.retailFrontage && bladeRoll < SIGN_BLADE.pFrontage);
            const width = big
              ? Math.min(SIGN_BIG.maxWidthM, Math.max(SIGN_BIG.minWidthM,
                frontageM * signRng.range(SIGN_BIG.widthFracMin, SIGN_BIG.widthFracMax)))
              : bladeWanted
                ? SIGN_BLADE.widthMinM + (SIGN_BLADE.widthMaxM - SIGN_BLADE.widthMinM) * u
                : 0.9 + 5.3 * u * u;
            /**
             * ASPECT IS HOISTED ABOVE THE `push` — session 34 — because a
             * blade's HEIGHT decides where its centre goes, and the object
             * literal below evaluates `y` before `aspect`. One draw on every
             * path, as the `width` line above has had since session 20.
             *
             * The stream re-phases: `signRng` now draws bladeRoll and aspect at
             * different points than it did, so the delivered signage is a
             * DIFFERENT population and not the old one with blades added. It is
             * `signRng`'s own stream and nothing else reads it, so nothing
             * outside the signage moves — the same caveat STATE 33 §0 records
             * for the gait stream.
             */
            const aspect = big
              ? signRng.range(0.28, 0.42)
              : bladeWanted
                ? signRng.range(SIGN_BLADE.aspectMin, SIGN_BLADE.aspectMax)
                : signRng.range(0.24, 0.62);
            /** 0 where the elevation cannot carry one — then it stays a fascia. */
            const bladeH = bladeWanted ? bladeHeightM(width, aspect, height) : 0;
            const blade = bladeH > 0;
            /**
             * A BUILDING-SCALE SIGN STAYS ON THE BASE TIER — session 20.
             *
             * `big` puts a 9–17 m sign at 0.55–0.82 of the building's height,
             * and a setback steps the wall in at 0.45–0.66 of it. Left alone,
             * the sign's own elevation would be somewhere the wall no longer
             * is: `city.js` offsets it by `buildingWidth/2`, which after a
             * setback is the BASE's half-width, so the sign would hang in the
             * air one inset clear of the tier it is supposed to be bolted to.
             * That is CONTRACT §9's shape with two half-widths, and it is
             * exactly the failure session 14 found when a building's CENTRE was
             * used as its ELEVATION.
             *
             * Clamped rather than re-based, because a big sign on the base of a
             * stepped tower is where a real one is — the base is the widest,
             * lowest, most-seen elevation the building has. The margin is the
             * sign's own half-height plus a metre, so its top edge clears the
             * step it sits under.
             */
            const bigTop = bld.setbacks
              ? Math.max(8, bld.setbacks[0].at - (width * 0.35) / 2 - 1.0)
              : height;
            signs.push({
              x: cxb,
              // ONE DRAW ON EVERY PATH. The clamp is applied to the draw, not
              // added beside it: `big ? A(draw) : B(draw)` consumes exactly one
              // uniform on all three paths, which is what keeps the sign
              // stream's phase a function of the sign COUNT and nothing else.
              //
              // A BLADE'S CENTRE IS DECIDED BY ITS BOTTOM EDGE, not by a band.
              // `clearM` is where it hangs from and `bladeH` is how far down it
              // comes, so the centre is fixed and the one draw spends whatever
              // slack the elevation has left between the blade's top and the
              // parapet — which is zero on a building that only just carries it.
              y: big
                ? Math.min(height * signRng.range(0.55, 0.82), bigTop)
                : blade
                  ? SIGN_BLADE.clearM + bladeH / 2
                    + signRng.next() * Math.max(0, height - ROOF_PARAPET_M - SIGN_BLADE.clearM - bladeH)
                  : signRng.range(3.4, 7.2),
              z: czb,
              facing: bld.facing,
              scale: big ? 'building' : blade ? 'blade' : 'shop',
              width,
              /**
               * THE DELIVERED ASPECT, NOT THE ROLLED ONE. `bladeHeightM`
               * clamps a blade to the wall it hangs on, so a 15.4 m roll on a
               * 12 m building is a 7.9 m blade — and writing the ROLL here
               * while the height is the CLAMP is CONTRACT §9's shape exactly:
               * `city.js` computes `height = width * aspect` and would draw the
               * unclamped one through the parapet.
               */
              aspect: blade ? bladeH / width : aspect,
              /**
               * A BLADE IS FLUSH OR PROJECTING AND NEVER A ROOF SIGN OR A
               * PYLON. A 12 m vertical panel on a mast above a parapet is not a
               * roof sign and a 12 m pylon on a 4.2 m pavement is not a pylon —
               * the same argument the `big` branch above already makes one
               * mounting over. `projecting` is the default because a blade's
               * whole purpose is to read ALONG the street.
               */
              mount: blade && (mount === 'roof' || mount === 'freestanding') ? 'projecting' : mount,
              /** The elevation's own top, so a roof mount can stand on it. */
              buildingHeight: height,
              buildingWidth: bld.width,
              buildingDepth: bld.depth,
              /**
               * Where along the elevation, as a fraction of its half-width.
               *
               * SCALED FOR A BUILDING-SCALE SIGN so that the sign's own half
               * plus its offset stays on the wall: at `width = f · frontage` the
               * offset may reach `1 − f` of the half-width and no further, which
               * at the widest roll (0.86) is 0.14 and at the narrowest (0.46) is
               * 0.54. THE DRAW IS THE SAME DRAW IN THE SAME PLACE — the scale is
               * applied to it rather than replacing it — so `signRng`'s phase is
               * a function of the sign COUNT exactly as the `width` line above
               * has required since session 20.
               */
              along: signRng.range(-0.62, 0.62) *
                (big ? Math.min(1, Math.max(0, 1 - width / frontageM) / 0.62) : 1),
              state: r < deadP ? 'dead' : r < deadP + 0.1 ? 'half' : 'lit',
              chroma: signRng.int(0, 5),
              yawDeg: yaw(),
            });
          }

          t += width + (i === runLength - 1 ? rng.range(6, 26) : rng.range(0.2, 1.4));
          frontage.delivered++;
          frontage.builtM += width;
          frontage.widthDeliveredM += width;
          if (cut) { frontage.clampedDelivered++; frontage.clampedDeliveredM += cut; }
          traceFrontage({
            what: 'built', cx, cz, axis: side.axis, at: side.at, out: side.out,
            t: tCand, width, density, depth,
            gap: t - tCand - width,
            gapKind: i === runLength - 1 ? 'end' : 'run',
            /** What is left of the side after this building's own gap. */
            roomAfter: side.to - t, sideFrom: side.from, sideTo: side.to,
          });
          if (i === runLength - 1) {
            frontage.endGaps++;
            frontage.endGapM += t - tCand - width;
          } else {
            frontage.runGapM += t - tCand - width;
          }
        }
      }
      frontage.tailM += side.to - t;
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
        /** `left` and not `room`: this walk already calls its DEPTH `room`. */
        const left = b.x1 - t;
        /**
         * THE SAME OVERRUN AS THE PERIMETER WALK'S, AND IT WAS CARRIED IN
         * STATE 38 §8 AS A KNOWN GAP THIS FUNNEL DID NOT COVER — SESSION 39.
         *
         * The guard is `t < b.x1 - 12` and the narrowest building is 11.0 m, so
         * a building fits in every abandoned remainder here too. `WALK.overrun`
         * is the same arm; the quay is not in `funnelprobe`'s length funnel, so
         * what it costs is counted by the delivered building count instead
         * (`tools/padprobe.mjs --quay`).
         */
        let width = WALK.overrun === 'fit'
          ? rng.range(11, Math.min(27, left))
          : rng.range(11, 27);
        frontage.quayRuns++;
        if (t + width > b.x1) {
          frontage.quayOverrun++;
          frontage.quayOverrunM += left;
          if (WALK.overrun === 'abandon') { t = b.x1; break; }
          width = left;
        }
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
        if (rng.next() > frontageFill(density, FRONTAGE_FILL.quayPower)) {
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
        /**
         * NOT SNAPPED, AND THE REASON IS WRITTEN DOWN RATHER THAN THE REPAIR.
         *
         * This walk has the same representability exposure the perimeter walk's
         * `lotCentre` closes, at the other end of the body: `depth` is capped
         * by `room = face − backstop`, so a terrace that takes its whole lot
         * lands its FAR face exactly on `backstop` — the edge of the embankment
         * road's own footway claim — and the centre round trip puts it an ulp
         * past. Measured with the perimeter walk repaired: every remaining
         * `pavement` refusal over the gate's region was this walk's, four of
         * them, on chunks (−5,−3), (−4,−4), (−1,−3) and (3,−4).
         *
         * It is left alone because it is a NEAR-face repair on a FAR face and
         * the two are not the same edit, because it is pre-existing rather than
         * anything this session's depth change introduced, and because a second
         * ulp repair in the same commit would make the delivered building count
         * a sum of two effects. STATE 35 §1 carries it as a gap with the four
         * chunks named.
         */
        const czb = face + bank * (depth / 2);
        /**
         * A BOX-AGAINST-BOX TEST, NOT A PADDED CENTRE — and since session 21 it
         * is THE box-against-box test rather than a fourth private copy of one.
         *
         * `occupied` asks whether a POINT padded by a radius is inside a
         * footprint, which is the right question for a bollard and the wrong
         * one for a 27 m building: two boxes can overlap with neither centre
         * inside the other. The first version used it and delivered three
         * overlapping pairs on the south bank, where the island's own north
         * frontage already faces the water and the terrace was laid on top of
         * it. The 1 m margin it grew to close that is now the registry's own
         * `building` setback, so the two walks cannot disagree about it.
         */
        const eraName = ERA_NAMES[weightedIndex(eraRng.next, ERA_NAMES.map((n) => CITY_ERAS[n].weight))];
        const era = CITY_ERAS[eraName];
        /**
         * LOWER THAN THE CITY BEHIND IT, and it is a rule rather than a taste:
         * a 60 m slab on a 12 m-deep riverside lot is a tower on a plinth, and
         * the reason an embankment reads as an embankment is the long low
         * terrace under the skyline behind it. 8–34 m against the generator's
         * own log-normal at median 30 m.
         */
        const floors = Math.max(3, Math.round(rng.range(8, 34) / era.floor));
        const height = floors * (era.floor + eraRng.gauss() * 0.05);
        /** Session 25, and the same reason as the perimeter walk's — `buildingTopM`. */
        const site = claimBox('building',
          cxb - width / 2, czb - depth / 2, cxb + width / 2, czb + depth / 2,
          { y0: 0, y1: buildingTopM(era, eraName, height, floors), owner: `quay:${cx},${cz}` });
        if (refuse(reg.conflict(site, 0, QUAY_SETBACKS))) {
          t += width + rng.range(2, 12);
          continue;
        }
        reg.claim(site);
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
          /**
           * SESSION 28. The quay is one frontage and it rolls per building at
           * `RETAIL.quay` rather than per side: a promenade terrace is cafés
           * and chandlers scattered along it, not a shopping parade, and the
           * quay walk has no side to roll for.
           */
          retail: retailRng.next() < RETAIL.quay,
          retailFrontage: false,
          adPillar: adPillarWanted(pillarRng, false, density),
          displayFacade: signRng.next() < 0.03 + density * 0.09,
          displayFrom: 0.30,
          displayTo: 0.72,
          cantilever: eraName === 'contemporary' ? rng.range(1.1, 2.4) : 0,
          crown: eraName === 'contemporary' ? rng.range(0.15, 0.45) : 0,
          /**
           * Session 20, and on the terrace it will almost always be null: the
           * band above is 8–34 m against `SETBACK.minHeightM` = 34, so only the
           * very top of the roll qualifies. That is the right answer rather
           * than an omission — a setback on a 20 m riverside terrace is a
           * cornice, and the terrace's whole job is to be the long low thing
           * under the skyline behind it.
           */
          setbacks: rollSetbacks(setbackRng, height),
          /** So a reader of the placement data can see which walk placed it. */
          quayside: true,
        };
        buildings.push(bld);
        frontage.quayDelivered++;
        occluders.push({
          x0: cxb - width / 2, x1: cxb + width / 2,
          z0: czb - depth / 2, z1: czb + depth / 2,
          top: height,
        });
        /**
         * AND THE TERRACE GETS ROOF SIGNS TOO, on the same test. A lit sign
         * over the water is the most-seen sign in any river city — it is read
         * from the far bank, from both bridges and from the promenade — and
         * `ROOF_SIGN.minBuildingM` = 22 against this walk's 8–34 m band means
         * only the taller third of the terrace qualifies, which is the picture.
         */
        pushRoofSign(bld, roofSignRng, density, signs);
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

  // --- road markings --------------------------------------------------------
  //
  // EVERY DIMENSION BELOW IS `ROAD_MARKING`, EXPORTED — SESSION 45, AND THE
  // REASON IS THAT A SECOND STREET WANTED THEM. See that object's own note.
  //
  // THE PAINTED LINE AND THE TRAFFIC'S BRAKING POINT ARE ONE NUMBER, AND THIS
  // IS THE CONSUMER THAT DID NOT EXIST. `CITY.stopLineFromJunctionM` has said
  // since session 19 that it has three readers — the braking constraint, the
  // signal head and the markings — and there were no markings anywhere in the
  // project, so the third reader was a promise. `traffic.js` reads the same
  // constant for `STOP_LINE`; neither imports the other (CONTRACT §2.2) and
  // neither copies it (§9.1).
  //
  // THEY CLIP TO THE DELIVERED CARRIAGEWAY, not to the lattice. A stop bar is
  // emitted only where a `carriageway` claim actually covers it, so a road the
  // river took, the block took or a dome took has no lines painted in the air
  // over where it used to be. That is the registry doing the same job for paint
  // that it does for piers, and it is why this is here rather than in
  // `city.js`.
  const markings = [];
  {
    const r = CITY.roadHalfWidth;
    const S = CITY.chunkSize;
    /** Only where a carriageway was actually emitted. */
    const onRoad = (x, z, halfX, halfZ) =>
      reg.hits({ x0: x - halfX, x1: x + halfX, z0: z - halfZ, z1: z + halfZ, y0: 0, y1: SURFACE_TOP_M }, 0, ['carriageway']).length > 0;
    /**
     * `length` is the box's own local X and `width` its local Z; `yawDeg` is
     * 0 or 90 and takes local X onto world X or world Z. The world half-extents
     * are therefore |cos|·L/2 + |sin|·W/2 and its mirror — NOT L/2 + W/2 on
     * both axes, which is the first thing this function did and which reported
     * a 0.40 x 7.20 m stop bar as 3.8 m deep along the road it lies across.
     * That is a bounding box of a rotated box computed as though it were
     * unrotated, and it is CONTRACT §9's shape with two extents.
     */
    const paint = (x, z, length, width, yawDeg, mkind) => {
      const ca = Math.abs(Math.cos((yawDeg * Math.PI) / 180));
      const sa = Math.abs(Math.sin((yawDeg * Math.PI) / 180));
      const halfX = (ca * length + sa * width) / 2;
      const halfZ = (sa * length + ca * width) / 2;
      if (!onRoad(x, z, halfX * 0.5, halfZ * 0.5)) return;
      markings.push({ x, z, length, width, yawDeg, kind: mkind });
    };
    /**
     * THE DASH CYCLE. UK/EU centre-line practice on a 50 km/h urban road is a
     * 2 m mark in a 6 m cycle (1:3); a lane line is 3 m in a 9 m cycle. Both
     * are here rather than one number twice, because the RATIO is what tells a
     * driver which line they are looking at and a single cycle would erase the
     * distinction.
     */
    const CENTRE_MARK = ROAD_MARKING.centreMarkM;
    const CENTRE_CYCLE = ROAD_MARKING.centreCycleM;
    const LANE_MARK = ROAD_MARKING.laneMarkM;
    const LANE_CYCLE = ROAD_MARKING.laneCycleM;
    const LINE_W = ROAD_MARKING.lineWidthM;
    const BAR_W = ROAD_MARKING.barWidthM;
    /**
     * The crossing. Depth is what the band between the junction mouth and the
     * stop bar leaves (see the junction block below); the stripe count and
     * width are the 1:1 stripe-to-gap a zebra has, over the 14.4 m of
     * carriageway left inside a 0.30 m edge margin: 14 x 0.50 m on a 1.029 m
     * pitch.
     */
    const CROSSING_DEPTH = CITY.crossingDepthM;
    const CROSSING_STRIPES = ROAD_MARKING.crossingStripes;
    const CROSSING_STRIPE_W = ROAD_MARKING.crossingStripeWidthM;

    for (const axis of ['NS', 'EW']) {
      const at = axis === 'NS' ? b.x0 : b.z0;
      const from = axis === 'NS' ? b.z0 : b.x0;
      const put = (along, off, len, w, mkind) => {
        const x = axis === 'NS' ? at + off : along;
        const z = axis === 'NS' ? along : at + off;
        paint(x, z, len, w, axis === 'NS' ? 90 : 0, mkind);
      };
      // Centre line, dashed, on the road's own centreline.
      for (let t = from + CENTRE_CYCLE / 2; t < from + S; t += CENTRE_CYCLE) {
        put(t, 0, CENTRE_MARK, LINE_W, 'centre');
      }
      // Lane lines between the two lanes each way — LANE_OFFSET's own midpoint,
      // (1.75 + 5.25) / 2 = 3.50 m, which `traffic.js` puts the two running
      // lanes either side of.
      for (const side of [-1, 1]) {
        for (let t = from + LANE_CYCLE / 2; t < from + S; t += LANE_CYCLE) {
          put(t, side * ROAD_MARKING.laneOffsetM, LANE_MARK, LINE_W, 'lane');
        }
        // Edge line, solid, `edgeInsetM` inside the kerb.
        for (let t = from; t < from + S; t += ROAD_MARKING.edgeSegmentM) {
          put(t + ROAD_MARKING.edgeSegmentM / 2, side * (r - ROAD_MARKING.edgeInsetM),
            ROAD_MARKING.edgeSegmentM, LINE_W, 'edge');
        }
      }
    }

    /**
     * THE STOP BARS AND THE CROSSINGS, AT THE JUNCTION THIS CHUNK OWNS.
     *
     * A junction is where the two corridors this chunk draws meet: `(b.x0,
     * b.z0)`. Four approaches, and each gets a bar at exactly
     * `CITY.stopLineFromJunctionM` from the junction centre — the same 9.0 m
     * the vehicle's NOSE brakes to. A vehicle stopped at its own line therefore
     * has its front bumper ON the paint, which is what `worstStopLineM >= 0`
     * asserts and what a person walking up to the junction can see.
     */
    const jx = b.x0;
    const jz = b.z0;
    for (const [ax, sgn] of [['NS', -1], ['NS', 1], ['EW', -1], ['EW', 1]]) {
      const d = CITY.stopLineFromJunctionM;
      /**
       * The approach half. `traffic.js`'s `lanePosition` puts an x-running
       * vehicle's lanes at `dir · LANE_OFFSET` in z and a z-running vehicle's
       * at `−dir · LANE_OFFSET` in x, so the half a vehicle APPROACHING the
       * junction from `sgn` occupies is `−sgn` on an EW road and `+sgn` on an
       * NS one. Getting this backwards paints every bar on the far side of the
       * road, which is the same class of mistake as `−out` in the building
       * walk and is why the convention is written out rather than tried.
       */
      const half = ax === 'EW' ? -sgn : sgn;
      const barOff = half * (r / 2 + 0.15);
      const barLen = r - 0.3;
      /**
       * THE CROSSING, AND SESSION 21's WAS IN THE WRONG PLACE AND HALF THE
       * WIDTH IT NEEDED TO BE. Session 33, LOOK.md §4.
       *
       * IT WAS AT `d - 2.6` = 6.40 m FROM THE JUNCTION CENTRE, spanning 2.0 m
       * of depth, i.e. 5.40 to 7.40 — and the crossing road's own carriageway
       * runs to `r` = 7.50. So the whole zebra lay INSIDE THE JUNCTION BOX,
       * across the path of whichever axis had green. It was also painted over
       * one approach half at a time (`half * (0.4 + u * (r - 0.8))`), so no
       * single crossing spanned the road it crossed and nobody could have
       * walked one end to end.
       *
       * THE BAND IS 1.30 m WIDE AND THE CITY'S OWN NUMBERS FIX BOTH ENDS OF IT:
       *
       *   near edge >= r = 7.50            outside the crossing carriageway
       *   far edge  <= d - BAR_W/2 = 8.80  inside the line vehicles stop at
       *
       * At the 0.05 m clearance the pavement budget uses at every join, that is
       * a 1.20 m depth centred on 8.15. `streetlife.js` → `CROSSING_OFFSET_M`
       * carries the same 8.15 and walks people down it; the two are one
       * quantity and they are derived from `r`, `d` and `BAR_W`, which is why
       * neither file copies the other's number.
       *
       * A 1.20 m crossing is shallow — a zebra gets 2.4 m in the world. That is
       * what 7.50, 9.00 and 0.40 leave between them, and widening it means
       * moving `CITY.stopLineFromJunctionM`, which is `minStopLineM`'s subject
       * and not a thing to move in passing.
       *
       * FULL WIDTH, 14 STRIPES. The carriageway is 2r = 15.0 m; 0.30 m of edge
       * margin each side leaves 14.4 m, and 14 stripes on a 1.029 m pitch at
       * 0.50 m wide is the 1:1 stripe-to-gap a zebra actually has. Session 21's
       * six 0.45 m stripes over half a road was a hatch, not a crossing.
       */
      const cOff = CITY.crossingFromJunctionM;
      const cSpan = r - 0.3;
      if (ax === 'NS') {
        paint(jx + barOff, jz + sgn * d, BAR_W, barLen, 90, 'stopbar');
        for (let k = 0; k < CROSSING_STRIPES; k++) {
          const u = (k + 0.5) / CROSSING_STRIPES;
          paint(jx + (2 * u - 1) * cSpan, jz + sgn * cOff, CROSSING_DEPTH, CROSSING_STRIPE_W, 90, 'crossing');
        }
      } else {
        paint(jx + sgn * d, jz + barOff, BAR_W, barLen, 0, 'stopbar');
        for (let k = 0; k < CROSSING_STRIPES; k++) {
          const u = (k + 0.5) / CROSSING_STRIPES;
          paint(jx + sgn * cOff, jz + (2 * u - 1) * cSpan, CROSSING_DEPTH, CROSSING_STRIPE_W, 0, 'crossing');
        }
      }
    }
  }

  // --- the five low-detail kinds, and what each one IS ---------------------
  //
  // ALL FIVE ARE LOW-DETAIL BLOCKS WITH CONTENT, and they are built HERE — in
  // the pure generator, beside the registry — rather than in `city.js`, for the
  // reason the ground rectangles moved here in the same session: a park path
  // is a surface that props must not stand on and a hoarding is a solid that
  // roads must not run through, and a placement decided in the module that
  // draws it is a decision the registry never sees.
  //
  // `features` is everything a low-detail block builds that is not a prop and
  // not ground: an edge segment, a centre piece, a lamp column, a hoarding
  // panel, a crane, a flood mast, a boundary rail, a parked vehicle, a
  // surviving party wall. `city.js` reads the list and draws it; it decides
  // nothing.
  //
  // TWO OF THE FIVE HAD CONTENT AND THREE HAD NONE — SESSION 40. `parking`,
  // `lot` and `yard` reached this point and fell straight through it to a prop
  // scatter capped at ONE object per chunk (see `DEAD_ZONE` for why the cap is
  // one and not a few). They now get what `park` and `construction` have had
  // since session 21: a surface of their own, a boundary, and the things that
  // belong to the kind.
  //
  // NO DRAW ORDER ABOVE THIS LINE MOVES. `featRng` is `chunkRng(..., 'feature')`
  // and a chunk is exactly one kind, so the three new branches draw from a
  // stream no park and no site has ever reached. The delivered park and
  // construction chunks are bit-identical (STATE 40 §7's determinism digest).
  const features = [];
  if (lowDetail) {
    const featRng = chunkRng(rootSeed, cx, cz, 'feature');
    const isl = island;
    const mx = (isl.x0 + isl.x1) / 2;
    const mz = (isl.z0 + isl.z1) / 2;
    /**
     * THE SOLIDS THIS ISLAND IS CLIPPED AGAINST. One list, four consumers —
     * a park's grass, a site's hardcore, a car park's asphalt and a yard's
     * hardstanding all stop at the same landmark, the same block keep-out and
     * the same water.
     */
    const islandSolids = () => reg.all().filter((c) => c.kind === 'landmark' || c.kind === 'block' || c.kind === 'water');

    /**
     * A BOUNDARY RUN — SESSION 40, FACTORED OUT OF THE PARK'S OWN EDGE LOOP.
     *
     * A park has railings, a site has hoarding, a car park has a knee rail and
     * a yard has a palisade. All four are the same placement: segments round
     * the island with ONE entrance gap, each set in by its own half-thickness
     * plus the bulge its yaw jitter adds, each tested against the registry and
     * skipped rather than squeezed. Writing it four times is CONTRACT §9.1's
     * subject; the park's own copy is left exactly where it is, because moving
     * it would re-order its draws and re-phase every park in the city.
     *
     * `gate` is the along-coordinate of the entrance on the rolled side. A
     * boundary with no way in is a wall, which is the sentence `SITE`'s own
     * gate makes.
     */
    const boundaryRun = ({ inset, seg, halfT, height, category, owner, gateSide, gateAt, gateHalf, make }) => {
      const rx0 = isl.x0 + inset;
      const rx1 = isl.x1 - inset;
      const rz0 = isl.z0 + inset;
      const rz1 = isl.z1 - inset;
      const runs = [
        { axis: 'x', at: rz0, from: rx0, to: rx1 },
        { axis: 'x', at: rz1, from: rx0, to: rx1 },
        { axis: 'z', at: rx0, from: rz0, to: rz1 },
        { axis: 'z', at: rx1, from: rz0, to: rz1 },
      ];
      runs.forEach((run, i) => {
        const gateC = run.from + (run.to - run.from) * gateAt;
        for (let t = run.from; t + seg <= run.to; t += seg) {
          const c = t + seg / 2;
          if (i === gateSide && Math.abs(c - gateC) < gateHalf) continue;
          /**
           * The rotation's own bulge, exactly as the park's edge computes it
           * and for the same measured reason (session 31): the claim is the
           * ROTATED box's extent at `CITY.maxYawDeg`, so a segment turned a
           * degree cannot hang over the pavement its centre was set back from.
           */
          const yawBulge = (CITY.maxYawDeg * Math.PI) / 180;
          const halfAcross = halfT * Math.cos(yawBulge) + (seg / 2) * Math.sin(yawBulge);
          const halfAlong = (seg / 2) * Math.cos(yawBulge) + halfT * Math.sin(yawBulge);
          const x = run.axis === 'x' ? c : run.at;
          const z = run.axis === 'x' ? run.at : c;
          const box = claimAt(category, x, z,
            run.axis === 'x' ? halfAlong : halfAcross,
            run.axis === 'x' ? halfAcross : halfAlong,
            { y0: 0, y1: height, owner });
          if (reg.conflict(box)) continue;
          features.push(make(x, z, (run.axis === 'x' ? 0 : 90) + yaw(), run.axis));
          reg.claim(box);
        }
      });
    };

    /**
     * A PARKED VEHICLE — SESSION 40, and it is the one thing a car park cannot
     * be made of anything this project already had.
     *
     * `traffic.js` owns the vehicles that MOVE; they are agents on a lane
     * graph and none of them can stand still on a parcel. A parked car is
     * static geometry and it claims `prop` — it is an object standing on the
     * ground, entirely under `HEAD_CLEAR_M`, and it must not overlap another
     * object. Not `site`, which is a construction fixture, and not `feature`,
     * which a prop is allowed to be refused by rather than to refuse.
     */
    const parkVehicle = (x, z, yawDeg, vehicle) => {
      const halfL = vehicle === 'van' ? 2.70 : 2.30;
      const halfW = vehicle === 'van' ? 1.05 : 0.92;
      const ca = Math.abs(Math.cos((yawDeg * Math.PI) / 180));
      const sa = Math.abs(Math.sin((yawDeg * Math.PI) / 180));
      const hx = ca * halfL + sa * halfW;
      const hz = sa * halfL + ca * halfW;
      const box = claimAt('prop', x, z, hx, hz,
        { y0: 0, y1: vehicle === 'van' ? 2.45 : 1.48, owner: `parked:${vehicle}` });
      if (reg.conflict(box, 0, PROP_SETBACKS)) return false;
      features.push({ kind: 'parked', x, z, yawDeg, vehicle, chroma: featRng.int(0, 5) });
      reg.claim(box);
      return true;
    };

    if (kind === 'park') {
      /**
       * THE PATH NETWORK, AND IT IS THE SINGLE MOST IMPORTANT OF THE SIX.
       *
       * A green field without paths reads as a pitch; with them it reads as a
       * park. Session 19 drew two crossing strips, which is a cross on a
       * rectangle — what makes it a network is that the paths go SOMEWHERE and
       * that they meet: a perimeter loop, two cross paths that run from the
       * pavement into a central circus, and eight junctions where those meet.
       */
      /**
       * A LOW-DETAIL BLOCK IS CLIPPED LIKE EVERY OTHER SURFACE. A park chunk
       * that meets the river had its grass clipped and its PATHS not, because
       * the paths were added after the clip: 71 path rectangles and 128 edge
       * segments over the water, found by the registry in the first run after
       * they existed. Everything a park emits goes through one clip now.
       */
      const solidHere = reg.all().filter((c) => c.kind === 'landmark' || c.kind === 'block' || c.kind === 'water');
      const grass = { x0: isl.x0, z0: isl.z0, x1: isl.x1, z1: isl.z1, kind: 'grass', yKey: 'grass' };
      for (const g of subtractBoxes([grass], solidHere)) ground.push(g);

      const h = PARK.pathHalf;
      const li = PARK.loopInset;
      const lx0 = isl.x0 + li;
      const lx1 = isl.x1 - li;
      const lz0 = isl.z0 + li;
      const lz1 = isl.z1 - li;
      const paths = [
        // The loop, as four strips that overlap at the corners. Overlapping is
        // correct: a corner IS both strips, and `path x path` is not a conflict.
        { x0: lx0 - h, z0: lz0 - h, x1: lx1 + h, z1: lz0 + h },
        { x0: lx0 - h, z0: lz1 - h, x1: lx1 + h, z1: lz1 + h },
        { x0: lx0 - h, z0: lz0 - h, x1: lx0 + h, z1: lz1 + h },
        { x0: lx1 - h, z0: lz0 - h, x1: lx1 + h, z1: lz1 + h },
        /**
         * The two cross paths, from the pavement at the island edge to the
         * circus — and they STOP at the circus rather than crossing it,
         * because what is in the middle is in the middle. Running them through
         * put every cross path straight over the pond: measured as 3
         * `feature x path` conflicts the moment the registry could see them,
         * which is one per park.
         */
        { x0: isl.x0, z0: mz - h, x1: mx - PARK.circusHalf, z1: mz + h },
        { x0: mx + PARK.circusHalf, z0: mz - h, x1: isl.x1, z1: mz + h },
        { x0: mx - h, z0: isl.z0, x1: mx + h, z1: mz - PARK.circusHalf },
        { x0: mx - h, z0: mz + PARK.circusHalf, x1: mx + h, z1: isl.z1 },
        // The circus.
        { x0: mx - PARK.circusHalf, z0: mz - PARK.circusHalf, x1: mx + PARK.circusHalf, z1: mz + PARK.circusHalf },
      ];

      /**
       * SOMETHING IN THE MIDDLE. This is the part that makes a park an
       * ORIENTATION FEATURE rather than a green patch — a reason to walk to it,
       * and a thing you can say you are near.
       *
       * It is decided BEFORE the paving is emitted, because the circus is what
       * SURROUNDS it: paving under a pond is paving nobody will ever see and a
       * conflict the registry is right to report.
       */
      const centre = PARK.centreKinds[featRng.int(0, PARK.centreKinds.length - 1)];
      const ch = PARK.centreHalf;
      const centreBox = claimBox('feature', mx - ch, mz - ch, mx + ch, mz + ch,
        { y0: 0, y1: centre === 'pavilion' ? 4.4 : centre === 'monument' ? 7.0 : 0.6, owner: `park:${centre}` });
      const hasCentre = !reg.conflict(centreBox);
      if (hasCentre) {
        features.push({ kind: 'centre', centre, x: mx, z: mz, half: ch, yawDeg: yaw() });
        reg.claim(centreBox);
      }

      for (const p of subtractBoxes(
        paths.map((q) => ({ ...q, kind: 'path', yKey: 'pathEW' })),
        hasCentre ? [...solidHere, centreBox] : solidHere
      )) {
        ground.push(p);
        reg.claim(claimBox('path', p.x0, p.z0, p.x1, p.z1, { owner: 'park:path' }));
      }

      /**
       * AN EDGE AGAINST THE PAVEMENT. A park that simply becomes street has no
       * identity — the boundary is what tells you you have arrived. Segments
       * rather than one long box so the run can be broken at every entrance,
       * and the entrance is wherever a cross path meets the edge.
       */
      const edge = PARK.edgeKinds[featRng.int(0, PARK.edgeKinds.length - 1)];
      const seg = PARK.edgeSegment;
      const gap = PARK.edgeGapHalf;
      const edgeH = edge === 'railing' ? 1.15 : edge === 'hedge' ? 1.05 : 0.62;
      const EDGE_HALF_T = PARK.edgeHalfT;
      const runs = [
        { axis: 'x', at: isl.z0, from: isl.x0, to: isl.x1 },
        { axis: 'x', at: isl.z1, from: isl.x0, to: isl.x1 },
        { axis: 'z', at: isl.x0, from: isl.z0, to: isl.z1 },
        { axis: 'z', at: isl.x1, from: isl.z0, to: isl.z1 },
      ];
      for (const run of runs) {
        for (let t = run.from; t + seg <= run.to; t += seg) {
          const c = t + seg / 2;
          // The entrance gap, where the cross path crosses this run.
          if (run.axis === 'x' ? Math.abs(c - mx) < gap : Math.abs(c - mz) < gap) continue;
          /**
           * SET IN BY ITS OWN HALF-THICKNESS. A railing whose centreline is the
           * island edge is a railing half of which is on the pavement, and the
           * registry said so 197 times: the island edge IS the pavement's inner
           * boundary, so there is no room for a boundary object ON it.
           *
           * SESSION 31 — AND BY ITS ROTATION'S BULGE AS WELL, BECAUSE THE
           * CLAIM WAS THE UNROTATED BOX AND THE DELIVERY IS THE ROTATED ONE.
           *
           * `features.push` below carries `yawDeg: ... + yaw()`, and a 6 m
           * segment turned even a degree projects `(seg/2)·sin θ` past the face
           * its centre was set back from. So the generator tested a box flush
           * with the island edge and `city.js` drew one hanging over the
           * pavement: measured, **60 forbidden `pavement × feature` overlaps in
           * the delivered census**, 0.012 to 0.066 m² each. CONTRACT §9 rule 7 —
           * both halves of the two-sided check spelled the same yaw omission,
           * so both reported zero for as long as the ring was narrow enough to
           * hide the parks. Widening `CITY.groundRadius` is what put them in
           * the census; the defect is as old as the jitter.
           *
           * The bound is `CITY.maxYawDeg`, which is the project's own declared
           * ceiling on that jitter and the one `citycheck` → `alignment`
           * enforces. Using the bound rather than the drawn angle keeps this
           * expression out of the RNG sequence — rolling `yaw()` here to get
           * the exact value would move every subsequent draw in the park — and
           * it errs by OVER-claiming, which §9.1 says is the safe direction: an
           * over-claim shows up as a conflict a reader can see and an
           * under-claim shows up as nothing at all.
           */
          const yawBulge = (CITY.maxYawDeg * Math.PI) / 180;
          const halfAcross = EDGE_HALF_T * Math.cos(yawBulge) + (seg / 2) * Math.sin(yawBulge);
          const halfAlong = (seg / 2) * Math.cos(yawBulge) + EDGE_HALF_T * Math.sin(yawBulge);
          const inward = run.axis === 'x' ? (run.at < mz ? +1 : -1) : (run.at < mx ? +1 : -1);
          const x = run.axis === 'x' ? c : run.at + inward * halfAcross;
          const z = run.axis === 'x' ? run.at + inward * halfAcross : c;
          const box = claimAt('feature', x, z,
            run.axis === 'x' ? halfAlong : halfAcross, run.axis === 'x' ? halfAcross : halfAlong,
            { y0: 0, y1: edgeH, owner: `park:${edge}` });
          if (reg.conflict(box)) continue;
          features.push({ kind: 'edge', edge, x, z, length: seg, height: edgeH, yawDeg: (run.axis === 'x' ? 0 : 90) + yaw() });
          reg.claim(box);
        }
      }

      /**
       * PARK LIGHTING — LOWER COLUMNS, CLOSER SPACING, FOLLOWING THE PATHS
       * RATHER THAN THE KERB.
       *
       * Every lamp in this city stands on a kerb line, so every pool of light
       * in it is in a straight line down a street. These follow the loop, so
       * at night the park is a rectangle of light with a lit cross through it
       * seen from above and a receding line of low pools seen from inside —
       * neither of which the city has anywhere else.
       */
      const lampOff = PARK.pathHalf + 0.9;
      for (const [ax, at, from, to, side] of [
        ['x', lz0, lx0, lx1, -1], ['x', lz1, lx0, lx1, +1],
        ['z', lx0, lz0, lz1, -1], ['z', lx1, lz0, lz1, +1],
      ]) {
        for (let t = from + PARK.lampEvery / 2; t < to; t += PARK.lampEvery) {
          const x = ax === 'x' ? t : at + side * lampOff;
          const z = ax === 'x' ? at + side * lampOff : t;
          const box = claimAt('feature', x, z, 0.34, 0.34, { y0: 0, y1: PARK.lampHeight, owner: 'park:lamp' });
          if (reg.conflict(box)) continue;
          features.push({ kind: 'lamp', x, z, height: PARK.lampHeight });
          reg.claim(box);
        }
      }
    } else if (kind === 'construction') {
      /**
       * THE SITE. Hoarding round the outside, hardcore inside it, a part-built
       * frame, spoil, and one crane.
       */
      const site = { x0: isl.x0, z0: isl.z0, x1: isl.x1, z1: isl.z1, kind: 'siteGround', yKey: 'site' };
      for (const g of subtractBoxes([site], reg.all().filter((c) => c.kind === 'landmark' || c.kind === 'block' || c.kind === 'water'))) ground.push(g);

      const inset = SITE.hoardingInset;
      const seg = SITE.hoardingSegment;
      const hx0 = isl.x0 + inset;
      const hx1 = isl.x1 - inset;
      const hz0 = isl.z0 + inset;
      const hz1 = isl.z1 - inset;
      /** One gate per site, on a rolled side: a hoarding with no way in is a wall. */
      const gateSide = featRng.int(0, 3);
      const runs = [
        { axis: 'x', at: hz0, from: hx0, to: hx1 },
        { axis: 'x', at: hz1, from: hx0, to: hx1 },
        { axis: 'z', at: hx0, from: hz0, to: hz1 },
        { axis: 'z', at: hx1, from: hz0, to: hz1 },
      ];
      const gateAt = featRng.range(0.25, 0.75);
      runs.forEach((run, i) => {
        const gateC = run.from + (run.to - run.from) * gateAt;
        for (let t = run.from; t + seg <= run.to; t += seg) {
          const c = t + seg / 2;
          if (i === gateSide && Math.abs(c - gateC) < 4.0) continue;
          const x = run.axis === 'x' ? c : run.at;
          const z = run.axis === 'x' ? run.at : c;
          const printed = featRng.chance(0.25);
          const box = claimAt('site', x, z,
            run.axis === 'x' ? seg / 2 : SITE.hoardingHalfDepth,
            run.axis === 'x' ? SITE.hoardingHalfDepth : seg / 2,
            { y0: 0, y1: SITE.hoardingHeight, owner: 'site:hoarding' });
          if (reg.conflict(box)) continue;
          features.push({
            kind: 'hoarding', x, z, length: seg, height: SITE.hoardingHeight,
            yawDeg: (run.axis === 'x' ? 0 : 90) + yaw(),
            /** A quarter of the panels carry a printed graphic. */
            printed,
          });
          reg.claim(box);
        }
      });

      /**
       * THE PART-BUILT FRAME. Columns on a grid with slabs over the lower
       * levels and the top level open — which is what a frame under
       * construction looks like and is why it reads as unfinished rather than
       * as a building somebody forgot to skin.
       */
      const bays = featRng.int(3, 5);
      const bayM = featRng.range(7.0, 9.0);
      const levels = featRng.int(2, 5);
      const storey = 3.6;
      const fw = (bays * bayM) / 2;
      const fx = mx + featRng.range(-12, 12);
      const fz = mz + featRng.range(-12, 12);
      const frameBox = claimAt('site', fx, fz, fw, fw, { y0: 0, y1: levels * storey, owner: 'site:frame' });
      if (!reg.conflict(frameBox)) {
        features.push({ kind: 'frame', x: fx, z: fz, bays, bayM, levels, storey, yawDeg: yaw() });
        reg.claim(frameBox);
      }

      /**
       * THE CRANE. Its base is a concrete pad and a mast; the jib and the load
       * are drawn by the same module and MOVED by `construction.js`, because a
       * crane that does not move is a mast with a stick on it.
       */
      const mast = featRng.range(SITE.mastMinM, SITE.mastMaxM);
      const jib = featRng.range(SITE.jibMinM, SITE.jibMaxM);
      let craneX = fx + featRng.range(-1, 1) * (fw + 8);
      let craneZ = fz + featRng.range(-1, 1) * (fw + 8);
      craneX = Math.min(isl.x1 - 6, Math.max(isl.x0 + 6, craneX));
      craneZ = Math.min(isl.z1 - 6, Math.max(isl.z0 + 6, craneZ));
      const cranePhase = featRng.next();
      const slewDir = featRng.chance(0.5) ? 1 : -1;
      const craneBox = claimAt('site', craneX, craneZ, 3.4, 3.4, { y0: 0, y1: mast, owner: 'site:crane' });
      if (!reg.conflict(craneBox)) {
        features.push({
          kind: 'crane', x: craneX, z: craneZ, mast, jib,
          counterJib: jib * SITE.counterJibFrac,
          /** Its own phase, so two sites on screen are never in step. */
          phase: cranePhase,
          slewDir,
        });
        reg.claim(craneBox);
      }

      /** Flood masts, pointing DOWN into the excavation. */
      for (let i = 0; i < SITE.floodPerSite; i++) {
        const a = (i / SITE.floodPerSite) * Math.PI * 2 + featRng.next();
        const rr = featRng.range(18, 34);
        const x = Math.min(isl.x1 - 4, Math.max(isl.x0 + 4, mx + Math.cos(a) * rr));
        const z = Math.min(isl.z1 - 4, Math.max(isl.z0 + 4, mz + Math.sin(a) * rr));
        if (reg.conflict(claimAt('site', x, z, 0.7, 0.7, { y0: 0, y1: SITE.floodHeightM }))) continue;
        features.push({ kind: 'flood', x, z, height: SITE.floodHeightM, aimX: mx, aimZ: mz });
        reg.claim(claimAt('site', x, z, 0.7, 0.7, { y0: 0, y1: SITE.floodHeightM, owner: 'site:flood' }));
      }

      /** Spoil heaps — the one thing on a site that is not rectangular. */
      const heaps = featRng.int(2, 4);
      for (let i = 0; i < heaps; i++) {
        const x = featRng.range(isl.x0 + 6, isl.x1 - 6);
        const z = featRng.range(isl.z0 + 6, isl.z1 - 6);
        const r = featRng.range(3.0, 6.5);
        if (reg.conflict(claimAt('site', x, z, r, r, { y0: 0, y1: r * 0.55 }))) continue;
        features.push({ kind: 'spoil', x, z, radius: r, height: r * 0.55, yawDeg: yaw() });
        reg.claim(claimAt('site', x, z, r, r, { y0: 0, y1: r * 0.55, owner: 'site:spoil' }));
      }
    } else if (kind === 'parking') {
      /**
       * A CAR PARK IS BAYS, AND THE BAYS ARE WHAT MAKE IT ONE — SESSION 40.
       *
       * The whole of this kind before this session was three prop names —
       * `bollard`, `lamppost`, `planter` — drawn from a law that could ask for
       * at most ONE of them (`DEAD_ZONE`). Not one of the three is a parked
       * vehicle, and a car park with no cars in it is a rectangle of asphalt.
       *
       * FOUR THINGS, AND THE ORDER IS THE ORDER A CAR PARK IS BUILT IN:
       * surface it, mark it out, light it, fence it. The cars go in last
       * because they are the only part of it that is not the car park.
       */
      const D = DEAD_ZONE;
      /**
       * THE SURFACE, AND IT IS THE FIRST TIME THIS KIND HAS HAD ONE. A
       * `parking` island emitted no ground rectangle at all, so what a car
       * park read as was the world's earth plane — which is the ground under a
       * road with no road on it.
       */
      const surf = { x0: isl.x0, z0: isl.z0, x1: isl.x1, z1: isl.z1, kind: 'parkingGround', yKey: 'parking' };
      for (const g of subtractBoxes([surf], islandSolids())) ground.push(g);

      /**
       * THE BAYS. `DEAD_ZONE.modules` double-loaded modules across the middle
       * of the island — bay, aisle, bay, 16.0 m deep — inset clear of the
       * boundary rail. The paint is a `marking`: a 4 mm box like every other
       * line in this city, claiming nothing, so a car may stand on its own bay
       * line exactly as a wheel stands on a lane line.
       *
       * THE ONLY THING THIS BYPASSES IS `paint()`'s `onRoad` TEST, and it is
       * bypassed deliberately: that test exists so no line is painted in the
       * air over a carriageway the river or a dome took, and a bay is not on a
       * carriageway at all. What it is clipped against instead is the same
       * `islandSolids()` the surface under it is.
       */
      const moduleD = D.bayL * 2 + D.aisleW;
      const bankD = D.modules * moduleD;
      const bayInset = D.edgeInset + 2.0;
      const bx0 = isl.x0 + bayInset;
      const bx1 = isl.x1 - bayInset;
      const nBays = Math.max(0, Math.floor((bx1 - bx0) / D.bayW));
      const bankZ0 = mz - bankD / 2;
      const solids = islandSolids();
      /** Clear of every landmark, block keep-out and channel this island meets. */
      const onLot = (x, z, hx, hz) => !solids.some((c) => (
        x + hx > c.x0 && x - hx < c.x1 && z + hz > c.z0 && z - hz < c.z1));
      for (let m = 0; m < D.modules; m++) {
        for (const r of [0, 1]) {
          const rowZ0 = bankZ0 + m * moduleD + r * (D.bayL + D.aisleW);
          const zc = rowZ0 + D.bayL / 2;
          for (let i = 0; i <= nBays; i++) {
            const x = bx0 + i * D.bayW;
            if (!onLot(x, zc, 0.05, D.bayL / 2)) continue;
            markings.push({ x, z: zc, length: D.bayL, width: 0.10, yawDeg: 90, kind: 'bay' });
          }
          /**
           * THE CARS, AND THE OCCUPANCY IS THE CHUNK'S OWN DENSITY.
           *
           * `DEAD_ZONE.bayOccupancy` carries the argument: LOOK.md §2 asks for
           * density to have causes, and this is the one surface in the city
           * where the cause and the field are literally the same quantity. A
           * low-detail chunk's density runs 0.10–0.34, so a lot stands between
           * a tenth and a third full — used, rather than a showroom or a
           * defect. The PAINT is there at every density, and that is the floor.
           *
           * The die is drawn for every bay whether or not the bay exists on
           * this island, so which bays a landmark took does not re-phase the
           * ones it did not.
           */
          for (let i = 0; i < nBays; i++) {
            const occupied = featRng.next() < density;
            const nose = featRng.chance(0.5) ? 90 : 270;
            const x = bx0 + (i + 0.5) * D.bayW;
            if (!occupied) continue;
            if (!onLot(x, zc, D.bayW / 2, D.bayL / 2)) continue;
            parkVehicle(x, zc, nose + yaw(), 'car');
          }
        }
      }

      /**
       * THE LIGHTING, and it is the fixture the floor in `DEAD_ZONE.parking`
       * is derived from: a 10 m column covering a 30 m square. Three per axis
       * over the 104.6 m island. They join the same lamp pool a park lamp and
       * a site flood do — one pool, one reservation against `CLUSTER.maxLights`.
       */
      const nCol = Math.max(1, Math.floor((isl.x1 - isl.x0) / D.columnEvery));
      const colStep = (isl.x1 - isl.x0) / nCol;
      for (let a = 0; a < nCol; a++) {
        for (let b = 0; b < nCol; b++) {
          const x = isl.x0 + (a + 0.5) * colStep;
          const z = isl.z0 + (b + 0.5) * colStep;
          const box = claimAt('feature', x, z, 0.42, 0.42, { y0: 0, y1: D.columnHeight, owner: 'parking:column' });
          if (reg.conflict(box)) continue;
          features.push({ kind: 'lamp', x, z, height: D.columnHeight });
          reg.claim(box);
        }
      }

      /** The boundary: a knee rail with one entrance. */
      const gateSide = featRng.int(0, 3);
      const gateAt = featRng.range(0.25, 0.75);
      boundaryRun({
        inset: D.edgeInset, seg: D.edgeSegment, halfT: 0.08, height: D.railHeight,
        category: 'feature', owner: 'parking:rail', gateSide, gateAt, gateHalf: D.gateHalf,
        make: (x, z, yawDeg) => ({
          kind: 'edge', edge: 'rail', x, z, length: D.edgeSegment, height: D.railHeight, yawDeg,
        }),
      });
    } else if (kind === 'yard') {
      /**
       * A WORKS YARD — SESSION 40. Hardstanding, a palisade with a gate, two
       * masts, and a van backed up to the material.
       *
       * The whole of this kind before this session was the three-name DEFAULT
       * list `['container', 'fence', 'bollard']` shared with `lot`, drawn from
       * a law capped at one object. A yard and a cleared lot are not the same
       * place and they were the same three names.
       *
       * WHAT MAKES IT A YARD RATHER THAN A LOT IS THAT IT IS WORKED: the
       * surface is laid, the boundary is a security fence rather than a
       * hoarding, it is lit, and there is a vehicle in it. What is scattered
       * over it is `DEAD_ZONE.yard`'s own floor of stacked material — 24 plus
       * a density term, one stack per 21.4 m van apron.
       */
      const D = DEAD_ZONE;
      const surf = { x0: isl.x0, z0: isl.z0, x1: isl.x1, z1: isl.z1, kind: 'yardGround', yKey: 'yard' };
      for (const g of subtractBoxes([surf], islandSolids())) ground.push(g);

      /**
       * TWO MASTS, REUSING THE SITE'S. A yard is lit the way a site is — a
       * mast pointing down into the working area — and `flood` is already
       * modelled, already in the lamp pool and already claims `site`, which is
       * the category that keeps material from being stacked on its base.
       */
      for (let i = 0; i < 2; i++) {
        const a = (i / 2) * Math.PI * 2 + featRng.next();
        const rr = featRng.range(20, 36);
        const x = Math.min(isl.x1 - 4, Math.max(isl.x0 + 4, mx + Math.cos(a) * rr));
        const z = Math.min(isl.z1 - 4, Math.max(isl.z0 + 4, mz + Math.sin(a) * rr));
        const box = claimAt('site', x, z, 0.7, 0.7, { y0: 0, y1: SITE.floodHeightM, owner: 'yard:flood' });
        if (reg.conflict(box)) continue;
        features.push({ kind: 'flood', x, z, height: SITE.floodHeightM, aimX: mx, aimZ: mz });
        reg.claim(box);
      }

      /**
       * THE VAN, AND IT IS BACKED UP TO SOMETHING. A yard's vehicle stands
       * against the material rather than in the middle of the parcel, so it is
       * placed on a ring at two thirds of the way out and turned to face the
       * centre — which is what backing up to a stack looks like from above.
       */
      const vans = featRng.int(1, 2);
      for (let i = 0; i < vans; i++) {
        const a = featRng.range(0, Math.PI * 2);
        const rr = featRng.range(24, 38);
        const x = Math.min(isl.x1 - 5, Math.max(isl.x0 + 5, mx + Math.cos(a) * rr));
        const z = Math.min(isl.z1 - 5, Math.max(isl.z0 + 5, mz + Math.sin(a) * rr));
        parkVehicle(x, z, (-a * 180) / Math.PI + yaw(), 'van');
      }

      /** The boundary: a palisade with one gate. A yard is a SECURED parcel. */
      const gateSide = featRng.int(0, 3);
      const gateAt = featRng.range(0.25, 0.75);
      boundaryRun({
        inset: D.edgeInset, seg: D.edgeSegment, halfT: 0.07, height: D.palisadeHeight,
        category: 'feature', owner: 'yard:palisade', gateSide, gateAt, gateHalf: D.gateHalf,
        make: (x, z, yawDeg) => ({
          kind: 'edge', edge: 'palisade', x, z, length: D.edgeSegment, height: D.palisadeHeight, yawDeg,
        }),
      });
    } else if (kind === 'lot') {
      /**
       * A CLEARED LOT — SESSION 40. Hoarding, rubble, and the party wall of
       * the building that is not there any more.
       *
       * EVERY PIECE OF IT IS ALREADY MODELLED, which is the brief's own rule:
       * prefer reusing what is there. A cleared lot IS a construction site
       * with nothing happening on it, so it gets the site's stripped hardcore,
       * the site's plywood hoarding and the site's spoil heaps. The one thing
       * a site does not have is the thing a lot is defined by — what the last
       * building left standing.
       */
      const surf = { x0: isl.x0, z0: isl.z0, x1: isl.x1, z1: isl.z1, kind: 'siteGround', yKey: 'site' };
      for (const g of subtractBoxes([surf], islandSolids())) ground.push(g);

      /**
       * THE PARTY WALL. When a terrace loses one house the flank walls of its
       * neighbours stay up, and what is left on the cleared ground is a blind
       * wall with the ghost of the floors on it. It is placed BEFORE the
       * hoarding so the hoarding breaks around it rather than being refused by
       * it — a hoarding butts into a surviving wall, it does not run past one.
       *
       * ON A LOT LINE, WHICH IS THE ISLAND EDGE, because that is where the
       * demolished building's flank stood. `DEPTH_DISTRIBUTION.minM` = 9 m is
       * the shallowest building this generator admits, so a stub 9 m or more
       * long is the flank of a building that could have existed here.
       */
      const side = featRng.int(0, 3);
      const stubLen = featRng.range(DEPTH_DISTRIBUTION.minM, 22);
      const stubH = featRng.range(3.4, 9.5);
      const stubT = 0.45;
      const along = featRng.range(0.25, 0.75);
      {
        const t0 = side < 2 ? isl.x0 : isl.z0;
        const t1 = side < 2 ? isl.x1 : isl.z1;
        const c = t0 + (t1 - t0) * along;
        const at = (side % 2 === 0 ? (side < 2 ? isl.z0 : isl.x0) : (side < 2 ? isl.z1 : isl.x1))
          + (side % 2 === 0 ? +1 : -1) * (SITE.hoardingInset + stubT);
        const x = side < 2 ? c : at;
        const z = side < 2 ? at : c;
        /**
         * THE CLAIM CONTAINS WHAT `city.js` DRAWS, AND THE THREE MARGINS ARE
         * WRITTEN DOWN RATHER THAN ASSUMED (CONTRACT §9.1 — the generator's
         * claim and the delivered box are the two halves of one comparison).
         *
         *   along   the coping is drawn at `f.length`, so `stubLen / 2`
         *   across  the chimney breast is `thickness × 1.4` = `stubT × 2.8`,
         *           so the half-depth claimed is `stubT × 1.6`
         *   up      the coping's top is `height + 0.16`, so `stubH + 0.2`
         *
         * And the ROTATION'S OWN BULGE on top of all three, at
         * `CITY.maxYawDeg`, the same expression `boundaryRun` above uses and
         * for the same measured reason: a 22 m wall turned one degree reaches
         * 0.19 m further across than its own half-thickness.
         */
        const bulge = (CITY.maxYawDeg * Math.PI) / 180;
        const halfAlong = (stubLen / 2) * Math.cos(bulge) + stubT * 1.6 * Math.sin(bulge);
        const halfAcross = stubT * 1.6 * Math.cos(bulge) + (stubLen / 2) * Math.sin(bulge);
        const hx = side < 2 ? halfAlong : halfAcross;
        const hz = side < 2 ? halfAcross : halfAlong;
        const box = claimAt('site', x, z, hx, hz, { y0: 0, y1: stubH + 0.2, owner: 'lot:stub' });
        if (!reg.conflict(box)) {
          features.push({
            kind: 'stub', x, z, length: stubLen, height: stubH, thickness: stubT * 2,
            floors: Math.max(1, Math.round(stubH / 3.2)),
            yawDeg: (side < 2 ? 0 : 90) + yaw(),
          });
          reg.claim(box);
        }
      }

      /** The hoarding, reusing `SITE`'s own plywood and its own segment. */
      const gateSide = featRng.int(0, 3);
      const gateAt = featRng.range(0.25, 0.75);
      boundaryRun({
        inset: SITE.hoardingInset, seg: SITE.hoardingSegment, halfT: SITE.hoardingHalfDepth,
        height: SITE.hoardingHeight,
        category: 'site', owner: 'lot:hoarding', gateSide, gateAt, gateHalf: 4.0,
        make: (x, z, yawDeg) => ({
          kind: 'hoarding', x, z, length: SITE.hoardingSegment, height: SITE.hoardingHeight,
          yawDeg, printed: featRng.chance(0.25),
        }),
      });

      /** What the demolition left. Fewer and flatter than a working site's. */
      const heaps = featRng.int(1, 3);
      for (let i = 0; i < heaps; i++) {
        const x = featRng.range(isl.x0 + 8, isl.x1 - 8);
        const z = featRng.range(isl.z0 + 8, isl.z1 - 8);
        const r = featRng.range(2.4, 5.0);
        const box = claimAt('site', x, z, r, r, { y0: 0, y1: r * 0.42, owner: 'lot:rubble' });
        if (reg.conflict(box)) continue;
        features.push({ kind: 'spoil', x, z, radius: r, height: r * 0.42, yawDeg: yaw() });
        reg.claim(box);
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
  /** `parking`, `yard` and `lot` — a floor and a slope each. `built` is absent. */
  const deadZoneLaw = DEAD_ZONE[kind];
  const propCount = kind === 'park'
    ? Math.round(22 + 26 * density)
    : kind === 'construction'
      /**
       * A SITE'S CLUTTER IS AUTHORED FOR THE SAME REASON A PARK'S PLANTING IS:
       * a construction site is busy BECAUSE it is a construction site, not
       * because the density field happened to be high where it landed. 14 plus
       * a density term over the 104.6 m island is one object every 26 m, which
       * is a site with room to work in rather than a scrapyard.
       */
      ? Math.round(14 + 16 * density)
      /**
       * ───────────────────────────────────────────────────────────────────
       * SESSION 40: THE OTHER THREE LOW-DETAIL KINDS GET A FLOOR TOO, AND THE
       * `lowDetail ? 26` ARM IS GONE BECAUSE NOTHING REACHES IT ANY MORE.
       *
       * The paragraph above argues against a constant term and then makes an
       * exception for a park; the block just above makes the same exception
       * for a site. What neither noticed is that the cubic law and the gate
       * that SELECTS a low-detail kind read THE SAME FIELD: `density < 0.34`
       * is what makes a chunk `parking`, so `26 · d³` on one cannot exceed
       * `26 × 0.34³` = 1.022 and rounds to ZERO below `d = 0.268`. The three
       * neglected kinds were not sparsely furnished — they were capped at ONE
       * object per chunk by construction, and 84 of 131 of them delivered
       * nothing at all on 1.094 ha of open ground (`tools/groundprobe.mjs`,
       * twelve regions, seeds 1337–1348).
       *
       * `DEAD_ZONE` carries a floor and its derivation for each of them, in
       * the same form `PARK`'s own 22 uses. The `built` arm is UNTOUCHED:
       * `96 · d³` is the law for an ordinary block's STREET furniture, 82% of
       * which goes kerbside, and what the block INTERIOR gets is a separate
       * pass at the end of this function on its own named stream
       * (`DEAD_ZONE.core`).
       */
      : deadZoneLaw
        ? Math.round(deadZoneLaw.floor + deadZoneLaw.slope * density)
        : Math.round(96 * Math.pow(density, 3));

  /**
   * WHERE A PARK'S PLANTING GOES, AND IT IS NOT UNIFORM.
   *
   * `docs/authored-city.md` §1's clumping rule is applied to every other
   * population in this city and never to the one it reads most obviously on.
   * Trees scattered uniformly over an island read as an orchard; the thing
   * that makes planting look planted is that the gaps BETWEEN groups are
   * bigger than the gaps inside them.
   *
   * Benches and bins do not clump — they follow the paths, because that is
   * where the people are and because a bench facing nothing is scenery. A
   * bench goes beside a path (`prop x path` is a conflict, so the registry
   * puts it on the grass by itself) and a bin goes at a junction.
   */
  const parkClumps = [];
  const pathStations = [];
  if (kind === 'park') {
    const clumpRng = chunkRng(rootSeed, cx, cz, 'clump');
    for (let i = 0; i < PARK.clumps; i++) {
      parkClumps.push({
        x: clumpRng.range(island.x0 + 10, island.x1 - 10),
        z: clumpRng.range(island.z0 + 10, island.z1 - 10),
      });
    }
    const li = PARK.loopInset;
    const lx0 = island.x0 + li;
    const lx1 = island.x1 - li;
    const lz0 = island.z0 + li;
    const lz1 = island.z1 - li;
    const off = PARK.pathHalf + 1.1;
    for (const [ax, at, from, to, side] of [
      ['x', lz0, lx0, lx1, -1], ['x', lz1, lx0, lx1, +1],
      ['z', lx0, lz0, lz1, -1], ['z', lx1, lz0, lz1, +1],
    ]) {
      for (let t = from + 6; t < to; t += 11) {
        pathStations.push({
          x: ax === 'x' ? t : at + side * off,
          z: ax === 'x' ? at + side * off : t,
          yawDeg: ax === 'x' ? 0 : 90,
        });
      }
    }
  }

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
   * The four pavement lines this chunk draws, as (the FIXED axis, that axis's
   * value, the outward sign). `t` runs along the band, on the OTHER axis.
   *
   * `axis` NAMES THE AXIS THAT IS HELD CONSTANT, NOT THE ONE THE BAND RUNS
   * ALONG, and the comment here said the opposite for a session. Read the rows
   * below rather than this sentence: a band with `axis: 'x'` carries
   * `at: b.x0`, an x coordinate, and `t0/t1` over the chunk's **z** range — so
   * the kerb line runs along **Z** and a prop lined up with it wants yaw 90°.
   * The claim at the placement site has always been built that way round; the
   * emitted yaw was not, and the mismatch is §9's table with a lattice axis
   * (see the `kerbRef` assignment below for the measurement).
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
  /**
   * ONE CHUNK ROW FURNISHES EACH BANK, AND IT IS THE ROW THE BANK IS IN.
   *
   * `riverTouchesChunk` is true for every chunk the 147.6 m ENVELOPE reaches,
   * which is two rows of chunks; both used to furnish both banks over the same
   * x range, so every promenade in the city was furnished twice by two chunks
   * that could not see each other's props. Measured: **3 overlapping prop pairs
   * on the promenade** — a bin inside a planter, a cabinet inside a tree —
   * which is the first defect `prop x prop` has ever been able to report,
   * because until this session nothing compared two props.
   *
   * The test is where the bank ACTUALLY IS at the chunk's own mid-x, against
   * the chunk's own z range. Exactly one row can answer yes.
   */
  if (!lowDetail && riverTouchesChunk(cx, cz)) {
    const e = riverEdges((b.x0 + b.x1) / 2);
    if (e.north >= b.z0 && e.north < b.z1) kerbBands.push({ bank: -1, t0: b.x0 + 3, t1: b.x1 - 3 });
    if (e.south >= b.z0 && e.south < b.z1) kerbBands.push({ bank: +1, t0: b.x0 + 3, t1: b.x1 - 3 });
  }
  /** Kerbside props already placed, for the min-spacing test between them. */
  const kerbPlaced = [];
  const KERB_SPACING_M = 3.2;

  const PROP_TRIES = 8;
  let propGaveUp = 0;
  let propsKerbside = 0;
  for (let i = 0; i < propCount; i++) {
    /**
     * WHAT EACH KIND IS MADE OF — AND THREE OF THE FIVE ROWS ARE NEW, SESSION
     * 40. The list used to read:
     *
     *     park          tree, tree, tree, bench, planter, bin
     *     construction  container, container, fence, cabinet, bollard
     *     parking       bollard, lamppost, planter
     *     default       container, fence, bollard          <- yard AND lot
     *
     * Not one of `parking`'s three names is a parked vehicle, and `yard` and
     * `lot` shared one three-name default — a working yard and a cleared site
     * are not the same place and they were the same three objects. The
     * STRUCTURED content of each kind — bays, cars, hoarding, a palisade, a
     * party wall — is in the feature block above; this is the loose stuff that
     * scatters over it.
     *
     * `lamppost` LEAVES THE PARKING ROW because a car park's lighting is now a
     * 10 m column on a derived grid rather than a 4 m street lamp dropped at
     * random. The same object placed twice by two rules, one of which is a
     * scatter, is CONTRACT §9.1's arrangement.
     */
    const propKind = lowDetail
      ? propRng.pick(
        kind === 'park' ? ['tree', 'tree', 'tree', 'bench', 'planter', 'bin']
          : kind === 'construction' ? ['container', 'container', 'fence', 'cabinet', 'bollard']
            : kind === 'parking' ? ['bollard', 'bollard', 'cabinet', 'bin', 'planter', 'fence']
              : kind === 'yard' ? ['stack', 'stack', 'stack', 'container', 'bin', 'cabinet', 'fence']
                : ['fence', 'stack', 'container', 'bollard'])
      /**
       * `hydrant` and `bench` added to the built list this session. A bench on
       * an ordinary pavement is the commonest street object there is and it
       * existed only inside a park; a hydrant is the commonest small one and
       * did not exist at all. Both were absent because the list was written
       * before there was anything to draw them with.
       */
      : propRng.pick(['bollard', 'planter', 'bin', 'cabinet', 'tree', 'bench', 'hydrant']);
    const scale = propRng.range(PROP_SCALE.min, PROP_SCALE.max);
    /**
     * THE VARIANT IS DRAWN HERE, BEFORE THE FIT TEST, because which model it is
     * decides whether it fits. It used to be drawn at the end, beside `soil`
     * and `lean`, which was fine while the pad was a property of the KIND.
     */
    const variants = propVariantCount(propKind);
    const variant = variants > 0 ? propRng.int(0, variants - 1) : 0;
    const pad = propHalfWidth(propKind, variant) * scale;

    /**
     * Kerbside if it fits and if the die says so. The die is drawn for EVERY
     * prop, before the fit test, so the random sequence does not depend on
     * which kind came up — the same discipline the spread axes below follow.
     */
    const wantKerb = propRng.next() < 0.82;
    const across = propHalfAcross(propKind, variant) * scale;
    const offset = CITY.roadHalfWidth + KERB_GAP_M + across;
    const fitsKerb = offset + across <= LANE_CENTRE_M - WALK_CLEAR_M;

    let x = 0;
    let z = 0;
    let placed = false;
    let kerb = false;
    let kerbYaw = 0;
    /**
     * THE AXIS THIS PROP IS ALIGNED TO, before §3's jitter — session 21.
     *
     * A kerbside prop's reference is its kerb: 0° or 90° on the lattice, and
     * THE BANK'S OWN TANGENT on a promenade, which reaches 11.46° to the grid
     * where the meander is steepest. `docs/authored-city.md` §3 asks for
     * imperfect alignment, and what "imperfect" is measured against is the
     * thing the object is lined up with — a bollard following a curved quay is
     * aligned, and only its jitter is a deviation.
     *
     * Recorded rather than recomputed by the gate, for §9.1's reason: the gate
     * would have to re-derive the bank tangent at the prop's own station, which
     * is a fourth copy of a formula this file already warns has three.
     */
    let kerbRef = 0;
    /** The box that was tested. Claimed on success, so the test and the claim
     *  cannot be two different rectangles (CONTRACT §9.1). */
    let propClaim = null;

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
        /**
         * ONE TEST — session 21. This replaced four: the origin block, the
         * landmarks, the river and the buildings, each with its own pad and
         * its own geometry, added one at a time over sessions 4b, 14 and 15 as
         * each omission was found. What none of them tested is the
         * CARRIAGEWAY, and the promenade band runs across every north–south
         * road corridor the river cuts: measured before this change, **52 of
         * 1 596 props stood with their centre on a running lane.**
         *
         * `pavement` is absent from the `prop` row of the conflict table on
         * purpose — that pair is what a pavement is for — so this rejects the
         * road and keeps the kerb.
         */
        /**
         * THE CLAIM IS ORIENTED, and a square one was wrong in the direction
         * that matters. A prop's model has its long axis on local x and the
         * kerb walk lays that axis ALONG the kerb — a bench is 1.74 m long and
         * 0.46 m deep — so the extent that reaches toward the carriageway is
         * `propHalfAcross`, not `propHalfWidth`. Claiming a square of the
         * larger reported **7 benches, planters and bins conflicting with a
         * carriageway they are 0.4 m clear of**, which is a false positive in
         * the instrument rather than a defect in the world, and a gate that
         * cries wolf is a gate somebody relaxes.
         */
        /**
         * THE YAW'S OWN CONTRIBUTION, and leaving it out put benches 4 cm into
         * the road.
         *
         * §3's imperfect alignment turns a kerbside prop by up to
         * `CITY.maxYawDeg`, and a 1.74 m bench turned 2.4° reaches
         * `0.87·sin(2.4°)` = **0.036 m** further across than its own
         * half-depth. Measured on the delivered census before this was added:
         * benches overlapping their own carriageway by 0.048 to 0.088 m². The
         * claim is the ROTATED box's extent — `w·cos θ + l·sin θ` — which is
         * the same expression `derivePropHalfWidth` uses for a tilted canopy
         * box and the same one the markings' `paint()` uses, all three now
         * spelt the same way.
         */
        const yawRad = (CITY.maxYawDeg * Math.PI) / 180;
        const halfAlong = pad * Math.cos(yawRad) + across * Math.sin(yawRad);
        const halfAcross = across * Math.cos(yawRad) + pad * Math.sin(yawRad);
        const spot = band.bank || band.axis === 'z'
          ? claimAt('prop', x, z, halfAlong, halfAcross, { owner: propKind })
          : claimAt('prop', x, z, halfAcross, halfAlong, { owner: propKind });
        if (reg.conflict(spot, 0, PROP_SETBACKS)) continue;
        propClaim = spot;
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
          kerbRef = (-Math.atan2(dz, 8) * 180) / Math.PI;
          kerbYaw = kerbRef + yaw();
        } else {
          /**
           * THE LATTICE BANDS, AND THIS LINE WAS TRANSPOSED — session 22.
           *
           * `band.axis` is the FIXED axis (see `kerbBands`), so `axis: 'x'` is a
           * kerb line running along **Z** and its props want **90°**; `axis:
           * 'z'` runs along X and wants **0°**. It shipped the other way round,
           * and the two cases are inverted against EACH OTHER — which is why
           * both produced the same defect and why no comparison between the two
           * lattice bands could show it.
           *
           * THE CLAIM WAS ALWAYS RIGHT. Twenty lines up, `axis === 'x'` claims
           * `claimAt('prop', x, z, halfAcross, halfAlong)` — the small
           * half-extent on X and the long one on Z, i.e. exactly yaw 90°. So
           * the generator tested a box lying along the kerb and `city.js` drew
           * one lying across it, and `citycheck`'s two halves disagreed by
           * exactly that transposition. CONTRACT §9 rule 2, measured on one
           * delivered bench at (8.097, 76.568) by `tools/benchprobe.mjs`:
           *
           *     claimed    half (x 0.286, z 0.944)   yaw the claim implies  90°
           *     delivered  half (x 0.935, z 0.252)   yaw the record carries  -0.325°
           *     transposed (x -0.008, z -0.034)  ← claimed half SWAPPED
           *
           * The centres agree to four decimals and the two boxes are each
           * other's transpose to within 0.044 m, which is not slop: the claim
           * is built at `CITY.maxYawDeg` (the worst case over the jitter) and
           * the bench was drawn at -0.325°, so the claim is larger by exactly
           * the margin it is supposed to carry.
           *
           * 90 AND -90 ARE THE SAME AXIS AND THE SAME BOX, and nothing in this
           * project distinguishes them today: the occupancy claim reads
           * |cos|/|sin|, the alignment check reads `yawDeg - refDeg` mod 90, and
           * `band.side` — the field that would decide which way a bench's BACK
           * faces — is not read here at all. That is a real gap and it is
           * written down rather than closed on a guess, because a bench turned
           * to face the road is a content decision with no measurement behind
           * it yet.
           */
          kerbRef = band.axis === 'x' ? 90 : 0;
          kerbYaw = kerbRef + yaw();
        }
        kerb = true;
        placed = true;
      }
    }

    if (!placed) {
      for (let t = 0; t < PROP_TRIES; t++) {
        /**
         * THE DIE IS DRAWN THE SAME WAY ON EVERY PATH, so the sequence does
         * not depend on which kind came up — the discipline the kerb branch
         * above already follows for `wantKerb`.
         */
        const u0 = propRng.next();
        const u1 = propRng.next();
        if (parkClumps.length && (propKind === 'tree' || propKind === 'planter')) {
          const c = parkClumps[propRng.int(0, parkClumps.length - 1)];
          // Box–Muller off the two uniforms already drawn: a Gaussian scatter
          // about the clump centre, so density falls off rather than stopping.
          const r = Math.sqrt(-2 * Math.log(Math.max(1e-9, u0))) * PARK.clumpSpreadM;
          const a = u1 * Math.PI * 2;
          x = Math.min(island.x1 - 2, Math.max(island.x0 + 2, c.x + Math.cos(a) * r));
          z = Math.min(island.z1 - 2, Math.max(island.z0 + 2, c.z + Math.sin(a) * r));
        } else if (pathStations.length && (propKind === 'bench' || propKind === 'bin')) {
          const st = pathStations[Math.min(pathStations.length - 1, Math.floor(u0 * pathStations.length))];
          // ALONG the path, never across it: a bench jittered on both axes
          // walks off its own station into the grass on one side and into the
          // path on the other, and only one of those two is wrong in a way
          // anybody would notice.
          const j = (u1 - 0.5) * 3.2;
          x = st.x + (st.yawDeg === 0 ? j : 0);
          z = st.z + (st.yawDeg === 0 ? 0 : j);
          kerbYaw = st.yawDeg;
        } else {
          x = island.x0 + 2 + u0 * (island.x1 - island.x0 - 4);
          z = island.z0 + 2 + u1 * (island.z1 - island.z0 - 4);
        }
        // The island scatter's yaw is free, so the claim is the model's
        // circumscribing square. Conservative, and the right answer for a
        // rotation nobody has fixed yet.
        const spot = claimAt('prop', x, z, pad, pad, { owner: propKind });
        if (reg.conflict(spot, 0, PROP_SETBACKS)) continue;
        propClaim = spot;
        placed = true;
        break;
      }
    }
    if (!placed) {
      propGaveUp++;
      continue;
    }
    /** Claimed the moment it is placed, so the next prop tests against it. */
    reg.claim(propClaim);
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
    props.push({
      x,
      z,
      yawDeg: kerb || kerbYaw ? kerbYaw : yaw(),
      /** The axis above, so a deviation is measured from what it lines up with. */
      refDeg: kerb || kerbYaw ? kerbRef : 0,
      kerb,
      kind: propKind,
      scale,
      variant,
      soil: propRng.range(0.62, 1.0),
      lean: propRng.range(-1, 1),
      leanAzDeg: propRng.range(0, 360),
    });
  }

  /**
   * THE BLOCK INTERIOR — SESSION 40, BRIEF ITEM (d).
   * ================================================
   *
   * THE LARGEST BARE SURFACE IN THE CITY, AND IT WAS NOTHING. Session 35's
   * depth takes a building 29.6 m into a 52.3 m half-block and `lotDepthM()`
   * caps it at 40.6 m, so the central `104.6 − 2 × 40.6` = **23.4 m** square
   * of every island is ground no perimeter building may reach BY CONSTRUCTION.
   * `groundprobe --interiors` over twelve regions: **659 of 963 built chunks
   * had nothing standing in it at all**, and the median built island carried
   * 7.0 objects per hectare of open ground against a park's 187.
   *
   * WHAT A LIGHT-WELL CORE CONTAINS IS THE BLOCK'S OWN SERVICING. That is the
   * answer to *"what is this ground for"* rather than a decoration: bin
   * stores, a plant enclosure, stacked material, and a delivery bay with a van
   * on it. The count and its derivation are `DEAD_ZONE.core` — the same 21.4 m
   * van apron the `yard` kind is derived from, because a block interior IS a
   * service yard.
   *
   * IT DRAWS FROM ITS OWN NAMED STREAM AND THAT IS THE WHOLE REASON IT IS
   * SAFE. CONTRACT §6: *"Streams are independent, so adding a new system
   * cannot shift an existing one's sequence."* Session 39 recorded that a
   * named stream could NOT help with the walk's re-phase, because the extra
   * draws there were the added BUILDINGS' own. Here the opposite holds: every
   * draw below belongs to an object that did not exist, nothing above it is
   * re-ordered, and the delivered buildings, signs and street props of every
   * `built` chunk are bit-identical to session 39's. STATE 40 §7 prints the
   * digest either way.
   *
   * ITS OWN YAW, TOO, for the same reason: `yaw()` reads `yawRng`, which every
   * building and prop above has already drawn from, and borrowing it here
   * would make a core object's existence a fact about the street furniture's
   * angles. `CITY.offAxisFraction` and `CITY.maxYawDeg` are §3's numbers and
   * are read rather than copied.
   *
   * SCATTERED OVER THE WHOLE ISLAND AND NOT OVER THE 23.4 m WELL, and the
   * registry is what makes that the right choice: `reg.conflict` refuses every
   * spot a building already stands on, so what is left is the courtyard AND
   * the gaps in the perimeter run. Session 39 measured those gaps — 188 of 267
   * fall mid-side and *"every one of them is a yard"* — so a service yard is
   * exactly what belongs in them, and confining this to the well would have
   * left the thing a walker actually sees empty.
   */
  let coreAsked = 0;
  let coreGaveUp = 0;
  if (!lowDetail) {
    const coreRng = chunkRng(rootSeed, cx, cz, 'core');
    const C = DEAD_ZONE.core;
    coreAsked = Math.round(C.floor + C.slope * density);
    const coreYaw = () => (coreRng.next() < CITY.offAxisFraction
      ? coreRng.gauss() * (CITY.maxYawDeg / 3) : 0);
    /**
     * THE DELIVERY BAY. One per block, and it is the one piece of core content
     * that is a PLACE rather than a thing: a van standing where a block is
     * serviced from. Tried first, so that the clutter is placed around it
     * rather than in it.
     */
    {
      const a = coreRng.range(0, Math.PI * 2);
      const rr = coreRng.range(6, 26);
      const x = island.x0 + (island.x1 - island.x0) / 2 + Math.cos(a) * rr;
      const z = island.z0 + (island.z1 - island.z0) / 2 + Math.sin(a) * rr;
      const yawDeg = (-a * 180) / Math.PI + coreYaw();
      const ca = Math.abs(Math.cos((yawDeg * Math.PI) / 180));
      const sa = Math.abs(Math.sin((yawDeg * Math.PI) / 180));
      const box = claimAt('prop', x, z, ca * 2.70 + sa * 1.05, sa * 2.70 + ca * 1.05,
        { y0: 0, y1: 2.45, owner: 'parked:van' });
      if (!reg.conflict(box, 0, PROP_SETBACKS)) {
        features.push({ kind: 'parked', x, z, yawDeg, vehicle: 'van', chroma: coreRng.int(0, 5) });
        reg.claim(box);
      }
    }
    /**
     * THE SERVICING ITSELF. `bin` is a refuse store, `cabinet` is plant — a
     * substation or a chiller — `stack` is material and `container` is a skip.
     * `bollard` is what keeps a van off the rest of it. Every one of them is
     * already modelled; `stack` is the session's one new kind and it is here
     * for the same reason it is in a yard.
     */
    const CORE_KINDS = ['bin', 'cabinet', 'stack', 'container', 'bollard', 'stack'];
    for (let i = 0; i < coreAsked; i++) {
      const propKind = CORE_KINDS[coreRng.int(0, CORE_KINDS.length - 1)];
      const scale = coreRng.range(PROP_SCALE.min, PROP_SCALE.max);
      const variants = propVariantCount(propKind);
      const variant = variants > 0 ? coreRng.int(0, variants - 1) : 0;
      const half = propHalfWidth(propKind, variant) * scale;
      let placed = false;
      for (let t = 0; t < PROP_TRIES && !placed; t++) {
        const x = island.x0 + 2 + coreRng.next() * (island.x1 - island.x0 - 4);
        const z = island.z0 + 2 + coreRng.next() * (island.z1 - island.z0 - 4);
        /**
         * The circumscribing square, exactly as the island scatter above
         * claims it — the yaw is free, so the claim is the conservative one.
         */
        const spot = claimAt('prop', x, z, half, half, { owner: propKind });
        if (reg.conflict(spot, 0, PROP_SETBACKS)) continue;
        reg.claim(spot);
        props.push({
          x, z, yawDeg: coreYaw(), refDeg: 0, kerb: false, kind: propKind, scale, variant,
          soil: coreRng.range(0.52, 0.94),
          lean: coreRng.range(-1, 1),
          leanAzDeg: coreRng.range(0, 360),
          /** So the census can tell a service yard from a street. */
          core: true,
        });
        placed = true;
      }
      if (!placed) coreGaveUp++;
    }

    /**
     * AND THE CORE GETS A SURFACE, WHICH IS THE HALF THE OBJECTS CANNOT DO.
     *
     * A `built` island emitted no ground rectangle at all, so the ground
     * between and behind its buildings was the world's EARTH PLANE — the
     * surface `block.js` draws under everything, at `GROUND.earth`, which is
     * what is under a road where there is no road. That is why a block
     * interior reads as nothing from the air even when there is something
     * standing in it: there is no floor under it.
     *
     * It is the island minus every solid on it, which is exactly the quantity
     * `groundprobe` calls OPEN GROUND, so the surface and the measurement are
     * the same rectangle set. Clipped by `subtractBoxes` against the same
     * claims a park's grass is clipped against, plus the buildings — a
     * courtyard stops at its own back wall.
     */
    const coreSolids = reg.all().filter((c) => c.kind === 'building' || c.kind === 'landmark'
      || c.kind === 'block' || c.kind === 'water');
    const yardRect = { x0: island.x0, z0: island.z0, x1: island.x1, z1: island.z1, kind: 'coreGround', yKey: 'core' };
    for (const g of subtractBoxes([yardRect], coreSolids)) ground.push(g);
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
    buildings, props, signs, holograms, occluders,
    /**
     * THE GROUND THIS CHUNK EMITS, ALREADY CLIPPED — session 21.
     *
     * `city.js`'s `buildGround` computed these rectangles itself and clipped
     * them against two things it knew by name. Now it EMITS what it is handed.
     * That is CONTRACT §9.1's rule applied to a surface: two descriptions of
     * one road network, one of which decides where the piers may stand and the
     * other of which decides what is drawn, is precisely the arrangement that
     * put a dome across a carriageway.
     */
    ground,
    /** What a park or a site builds that is not a prop and not ground. */
    features,
    /** The painted road markings, already clipped to the delivered carriageway. */
    markings,
    /**
     * The registry itself, for the consumers that place things AFTER the pure
     * generator has run — `city.js`'s freestanding sign pylons, its park
     * furniture and its construction sites — and for the gate. It is a live
     * object rather than data, so it does not cross the worker boundary; the
     * worker only ever asks for `occluders`.
     */
    registry: reg,
    /**
     * Whether the river's envelope reaches this chunk at all, so `city.js` can
     * skip the whole river path on the 98% of chunks that never see water
     * without recomputing the envelope test in four places.
     */
    river: riverTouchesChunk(cx, cz),
    landmarks: touching.map((l) => l.name),
    /**
     * SESSION 43: HOLOGRAMS ARE COUNTED HERE. `clumping` reads this and is red
     * by instruction, so adding to it moves a number nobody was asked to move —
     * but an object the census cannot see is worse, and the direction is the
     * safe one: holograms land only on retail corners, so they make the
     * distribution MORE clustered rather than less, and `clumping`'s floor
     * wants a higher CV. Delivered figure in STATE.
     */
    objectCount: buildings.length + props.length + signs.length + holograms.length,
    /**
     * Props the scatter asked for and could not place in `PROP_TRIES` tries.
     * Reported rather than swallowed: a bounded retry is a cap, and a cap
     * nobody prints reads as "everything fitted". `citycheck` sums it over the
     * region and prints it beside the delivered count.
     */
    propsAsked: propCount,
    propsGaveUp: propGaveUp,
    /**
     * SESSION 40. The block interior's own pass, counted separately from the
     * street's, because they are two laws over two surfaces and one number for
     * both is CONTRACT §9's subject. `props` holds them together; these say how
     * many of them the core asked for and how many found no room.
     */
    coreAsked,
    coreGaveUp,
    /** What the keep-out registry refused, by the category that refused it. */
    refused,
    /**
     * SESSION 38. Every stage of the frontage chain, counted in the walk that
     * performs it — see `frontage` above for what each field is and for the
     * accounting identity `tools/funnelprobe.mjs` asserts on it.
     */
    frontage,
    /**
     * SESSION 35. What the registry SHORTENED rather than refused, by the
     * category that shortened it, with the metres of depth given up. A clip is
     * a different verdict from a refusal and is counted as one — see `clip`.
     */
    clipped,
    /**
     * How many of the placed props stand on a pavement rather than in a
     * courtyard. Reported for the same reason `propsGaveUp` is: before this
     * session the answer was zero and nothing said so, because nothing asked.
     */
    propsKerbside,
    /**
     * SESSION 30, ITEM 4 — WHERE THIS CHUNK WANTS A BUS STOP, OR NULL.
     *
     * A DECLARATION AND NOT A PLACEMENT. What is decided here is *which kerb,
     * how far from the junction, and facing which way*; whether that ground is
     * free is `city.js`'s question, because the answer depends on the DELIVERED
     * claims (CONTRACT §9.1: the registry says what was tested and the census
     * says what arrived, and this side is neither — it is the intent).
     *
     * THE PLACEMENT RULE, WRITTEN DOWN, because the brief asked for a rule and
     * not a scatter:
     *
     *   ON THE PAVEMENT.   `kerbBands` already names the four pavement lines
     *                      this chunk draws, as (fixed axis, its value,
     *                      outward sign). A stop stands on one of them at the
     *                      same kerb offset a kerbside prop does.
     *   NEAR SIDE OF A JUNCTION.  See `busStopAt`, which owns the rule and the
     *                      derivation of `beforeJunctionM`. This is the field,
     *                      not a second copy of the argument.
     */
    busStop: busStopAt(rootSeed, cx, cz),
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
