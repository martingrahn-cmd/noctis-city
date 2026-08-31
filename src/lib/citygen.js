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
   * ═════════════════════════════════════════════════════════════════════════
   * THE CITY'S OWN EXTENT — SESSION 53, AND IT IS THE FIRST WORLD COORDINATE
   * THIS GENERATOR HAS EVER READ.
   * ═════════════════════════════════════════════════════════════════════════
   *
   * `tools/edgeprobe.mjs` measured what was here before these two numbers: over
   * 27 345 samples on rings out to 4.10 km, the density field's inner third of
   * rings reads **0.5066** and its outer third **0.4927**, a difference of
   * 0.0140 against a ring-to-ring scatter of 0.0597. The same core-against-rim
   * comparison over twelve seeds falls **7 of 12** with a mean delta of 0.0067.
   * That is a coin, and it is what a field with no radial term looks like:
   * `densityAt` was a function of the noise alone, so the city was uniform in
   * every direction for ever and what ended it was `city.js`'s streaming square,
   * which is 1408 m wide and travels with the eye.
   *
   * SO THE CITY HAD NO EDGE. It had a window. Session 53's brief asked how the
   * density behaves "over the last third of the ring"; the answer is that there
   * is no last third, because the ring is not a place.
   *
   * `extentCoreM` — inside this radius NOTHING MOVES, and that is the whole
   * point of the number. It is a floor computed from what this project actually
   * measures, not a preference:
   *
   *     chunks `citycheck` generates      cx, cz in [-5, 4]   corner  905.1 m
   *     chunks resident at any waypoint   `highway_speed` at x = -820  1717.3 m
   *
   * — the worst is 1717.3 m, and 1717.3 / 128 = 13.42 chunks, so **14 chunks =
   * 1792 m**. Every gate camera, every route and every chunk any of them
   * generates is inside it, so this change is provably an ADDITION beyond the
   * measured city and not an edit to it. `edgeprobe --extent` recomputes the
   * floor and fails loudly if a new route ever puts a camera outside it.
   *
   * `extentEdgeM` — where the city is gone. Forced, not chosen:
   *
   *     BLOCK.groundExtent - (geometryRadius + 1) * chunkSize
   *   = 4000 - 768 = 3232
   *
   * The earth plane is 4000 m of half-extent and it is fixed to the WORLD; the
   * resident ring is 768 m of half-extent and it is fixed to the CAMERA. A
   * camera standing at the city's own rim must have its whole ring on the plane
   * or the city is drawn over a void — so the rim is exactly as far out as the
   * plane's edge less the ring's own reach. 3232 m is where those two meet, and
   * it is why this number cannot be nudged without moving the plane.
   *
   * THE BAND BETWEEN THEM IS WHAT THEY LEAVE: 3232 - 1792 = **1440 m**, which is
   * exactly 2 x `densityPeriodLong`. That is an observation and not a
   * derivation — but it is a checkable one, and it says the transition is two of
   * the field's own largest features wide, so the edge carries the field's
   * structure rather than being one smooth ramp.
   *
   * EUCLIDEAN AND NOT CHEBYSHEV. The rings in `city.js` are Chebyshev because a
   * streaming square is one; a city is not. A Chebyshev extent would give the
   * world four straight rims and four corners at 1.41x the radius, and the
   * corner is exactly where an aerial looks.
   */
  extentCoreM: 14 * 128,
  extentEdgeM: 4000 - 6 * 128,

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
 * HOW MUCH CITY THERE IS AT A WORLD POINT, in [0,1]. 1 inside the core, 0 past
 * the rim, smoothstep between — see `CITY.extentCoreM` / `extentEdgeM` for where
 * both radii come from and why neither is free.
 *
 * SMOOTHSTEP AND NOT A LINEAR RAMP, and it is the same `t*t*(3-2*t)` that
 * `smoothNoise` twenty lines up is built from. A linear ramp has a corner at
 * each end: the derivative jumps from 0 to its full value at exactly the radius
 * where the core stops, so the first chunk outside the core is measurably
 * thinner than the last one inside it and the core reads as a disc drawn on the
 * map. Smoothstep leaves both ends flat, so the thinning begins as gently as it
 * ends and no radius in the world is the one where it starts.
 *
 * IT IS A SEPARATE EXPORTED FUNCTION AND NOT AN EXPRESSION INSIDE `densityAt`
 * because two things read it — the field below, and `city.js`'s distant
 * silhouette, which must stop exactly where the field does or the two disagree
 * about where the city is. CONTRACT §9.1: one description of one quantity.
 */
export function cityExtentAt(x, z) {
  const r = Math.hypot(x, z);
  if (r <= CITY.extentCoreM) return 1;
  if (r >= CITY.extentEdgeM) return 0;
  const t = (r - CITY.extentCoreM) / (CITY.extentEdgeM - CITY.extentCoreM);
  return 1 - t * t * (3 - 2 * t);
}

/**
 * Density in [0,1] at a world point. The long octave carries two thirds of the
 * amplitude, so the structure a player reads while walking is the 720 m one and
 * the 190 m octave only breaks up its contours — a single octave gives density
 * bands with smooth curved edges, which is its own kind of tell.
 *
 * AND SINCE SESSION 53 IT IS MULTIPLIED BY THE CITY'S OWN EXTENT. The product
 * and not the minimum: a suburb is not a downtown with its peaks clipped off,
 * it is the same field at a lower amplitude, so a locally dense patch at 2.5 km
 * is still denser than its neighbours and simply has less in it. `Math.min`
 * would flatten the outer band to a constant and delete the field's structure
 * exactly where the eye has nothing else to read.
 *
 * THE THRESHOLD DOES THE REST AND NOTHING NEW HAD TO BE WRITTEN. `generateChunk`
 * already turns a chunk with `density < CITY.lowDetailThreshold` into one of the
 * fifteen island kinds — a yard, a lot, a depot, allotments — so a field that
 * falls toward a rim turns the outer band into exactly the low-detail landscape
 * LOOK.md §2 spent session 40 giving content to. The gradient is not a new
 * system; it is the existing one finally being asked a question that varies.
 *
 * WHY IT IS INSIDE THIS FUNCTION AND NOT AT THE THREE CALL SITES. There are
 * three (`busStopAt`, `generateChunk`, `streetlife.js`), and a term applied at
 * two of three is CONTRACT §9.1's own subject — one quantity with two
 * descriptions, agreeing until they do not.
 */
export function densityAt(rootSeed, x, z) {
  const a = smoothNoise(rootSeed, x, z, CITY.densityPeriodLong, 0);
  const b = smoothNoise(rootSeed, x, z, CITY.densityPeriodShort, 1);
  const d = a * 0.68 + b * 0.32;
  return Math.max(0, Math.min(1, d * cityExtentAt(x, z)));
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
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THE SHOP ACTUALLY IS — SESSION 58, AND IT IS THE FIRST TIME THIS CITY
 * HAS KNOWN THE DIFFERENCE BETWEEN A BAR AND A LAUNDRETTE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Session 28 decoupled trade from era and gave every frontage a boolean:
 * `bld.retail` says the ground floor is glazed and lit, and nothing anywhere
 * says WHAT IT SELLS. So every lit bay in the city drew the same warm tint at
 * the same strength, with a 25% cold share rolled from a hash — a colour
 * temperature with no cause behind it.
 *
 * THE OPERATOR'S OWN OBSERVATION IS THE DESIGN: *"different trades light in
 * opposite directions."* A cafe throws light OUT — big windows, warm, the
 * pavement brighter for it. A bar keeps light IN — dark glass, and the sign is
 * the only thing that reaches the street. A hairdresser is cold fluorescent; a
 * laundrette burns pale all night. That is four colour temperatures on one
 * block, each one a CONSEQUENCE of what the business is rather than a roll.
 *
 * THE CHROMA IS NAMED HERE AND MIXED IN `city.js`, and that is not a style
 * choice: **this file has never imported `color.js`** — only modules do — so a
 * trade carries the NAME of an `EMITTER_CHROMA` entry and the module resolves
 * it. `DISTANT.nightMix` is the same arrangement and says so in the same words.
 *
 * `out` IS THE FRACTION OF THE BAY'S OWN GLOW THAT REACHES THE STREET, and it
 * is the axis the operator named. It multiplies the emissive of the glass, so
 * a bar at 0.20 is not a dark shop — it is a shop whose light is behind
 * something, which is what dark glass and a screen at the back of a bar are.
 *
 * THE HOURS ARE OPEN AND CLOSE IN LOCAL SOLAR HOURS, wrapping past midnight,
 * and `tradeOpen` below is the one reader. They are the trades' real hours
 * rather than a shape chosen to look busy: a cafe is finished by seven, a bar
 * has not started until six, and a laundrette is the only thing on the street
 * still lit at three in the morning.
 */
export const TRADES = {
  /** The generic unit: a shop with stock in the window. The fallback. */
  shop: { out: 0.60, chroma: 'tungsten', sign: 'neonAmber', signScale: 1.00, openH: 9, closeH: 18 },
  /** Light OUT: the biggest glass on the street, and warm. */
  cafe: { out: 1.00, chroma: 'tungsten', sign: 'neonGreen', signScale: 0.95, openH: 7, closeH: 19 },
  /** Light IN: the sign is the whole of what the street gets. */
  bar: { out: 0.20, chroma: 'neonMagenta', sign: 'neonMagenta', signScale: 1.45, openH: 17, closeH: 2 },
  /** Warm window light and a lit menu — dimmer than a cafe, later. */
  restaurant: { out: 0.75, chroma: 'tungsten', sign: 'neonRed', signScale: 1.15, openH: 12, closeH: 23 },
  /** Cold fluorescent, and the mirrors double it. */
  hairdresser: { out: 0.85, chroma: 'fluorescentCold', sign: 'neonCyan', signScale: 0.85, openH: 9, closeH: 18 },
  /** Pale, flat and on all night, which is what makes it read at 3 a.m. */
  laundrette: { out: 0.70, chroma: 'fluorescentDirty', sign: 'fluorescentDirty', signScale: 0.70, openH: 6, closeH: 23 },
  /** Bright, hard and open latest of all. */
  takeaway: { out: 0.95, chroma: 'fluorescentDirty', sign: 'neonRed', signScale: 1.10, openH: 11, closeH: 2 },
  /** A small bright box on a corner. */
  kiosk: { out: 0.65, chroma: 'fluorescentCold', sign: 'neonAmber', signScale: 0.60, openH: 6, closeH: 20 },
};

/**
 * WHERE EACH TRADE GOES, AND THE CUTS ARE MEASURED RATHER THAN ASSUMED.
 *
 * Session 48 delivered SEVEN PLAYGROUNDS OUT OF SEVEN by splitting a band it
 * had not measured, and that lesson has now cost four sessions — so the cuts
 * below are the TERCILES OF THE TRADING POPULATION ITSELF, taken over
 * `city-budget.json`'s own 10 x 10 region at seed 1337: 433 trading buildings
 * of 668, density running 0.287 to 0.727 with **p33 = 0.5056 and p67 =
 * 0.6495**. They are the terciles of the buildings that TRADE, not of the
 * density field and not of the low-detail band, because those are three
 * different populations and only one of them is the one being split.
 *
 * WEIGHTS AND NOT CONDITIONS, so no cut can empty a district — session 49's
 * fallback-chain rule with a distribution instead of a chain. Every trade can
 * appear anywhere; what the tercile changes is how often.
 *
 *   quiet   where people LIVE. The laundrette's own tercile, and the
 *           takeaway's. Almost no bars: a bar wants a catchment.
 *   middle  the ordinary high street — the widest mix of the three.
 *   busy    where people are AT NIGHT. Bars and restaurants take a third of
 *           it between them, which is what a core does after six.
 *
 * AND A CORNER IS A DIFFERENT SITE FROM A MID-BLOCK ONE. `RETAIL.cornerM`
 * already treats the corner specially — it is the one place a non-retail
 * frontage may still trade — and a corner pub is a real building type, so a
 * corner site doubles the bar and kiosk weights before the roll.
 */
const TRADE_MIX = {
  quiet: { shop: 0.30, laundrette: 0.18, takeaway: 0.16, hairdresser: 0.14, cafe: 0.12, kiosk: 0.06, restaurant: 0.03, bar: 0.01 },
  middle: { shop: 0.26, cafe: 0.16, hairdresser: 0.14, takeaway: 0.13, restaurant: 0.12, bar: 0.09, laundrette: 0.06, kiosk: 0.04 },
  busy: { shop: 0.20, bar: 0.20, restaurant: 0.18, cafe: 0.17, takeaway: 0.10, hairdresser: 0.07, kiosk: 0.05, laundrette: 0.03 },
};

/** The measured terciles of the TRADING population. See `TRADE_MIX`. */
export const TRADE_CUTS = { p33: 0.5056, p67: 0.6495 };

/**
 * Which trade this building carries. Deterministic in the stream it is given,
 * so a trade cannot move a building, a sign or a prop (CONTRACT §6).
 */
export function tradeFor(tradeRng, density, distToEndM) {
  const band = density < TRADE_CUTS.p33 ? 'quiet' : density < TRADE_CUTS.p67 ? 'middle' : 'busy';
  const mix = TRADE_MIX[band];
  const corner = distToEndM <= RETAIL.cornerM;
  let total = 0;
  const w = {};
  for (const [k, v] of Object.entries(mix)) {
    w[k] = v * (corner && (k === 'bar' || k === 'kiosk') ? 2 : 1);
    total += w[k];
  }
  let r = tradeRng.next() * total;
  for (const [k, v] of Object.entries(w)) {
    r -= v;
    if (r <= 0) return k;
  }
  return 'shop';
}

/**
 * Is this trade lit at `t`? Hours wrap past midnight, which is the whole
 * reason a bar and a cafe are different objects at 01:00.
 *
 * IT RETURNS A RAMP AND NOT A BOOLEAN. A shop does not switch off at a stroke;
 * `rampH` is the hour over which it comes up and goes down, so a street at
 * closing time has some windows still on — and, more importantly for a
 * capture, no frame ever lands on a discontinuity. 0.75 h is a real closing
 * routine and is short enough that midnight and dusk are firmly on opposite
 * sides of a bar's opening.
 */
export const TRADE_RAMP_H = 0.75;
export function tradeOpen(trade, t) {
  const T = TRADES[trade] || TRADES.shop;
  return hoursFactor(T.openH, T.closeH, t);
}

/**
 * OPEN / SHUT AS A RAMP, FOR ANY PAIR OF HOURS — extracted in session 60 so
 * that the second table of opening hours in this file reads the same
 * arithmetic rather than carrying a copy of it. `tradeOpen` above and
 * `playOpen` below are the two callers; a third would be the third caller of
 * one function and not a third spelling of one ramp (CONTRACT §9.1).
 *
 * The ramp itself is session 58's and is unchanged: `TRADE_RAMP_H` wide at
 * each end, so no capture ever lands on a discontinuity.
 */
export function hoursFactor(openH, closeH, t) {
  const h = (((t % 1) + 1) % 1) * 24;
  const span = ((closeH - openH) + 24) % 24;
  const since = ((h - openH) + 24) % 24;
  if (since >= span) return 0;
  const upto = Math.min(since, TRADE_RAMP_H) / TRADE_RAMP_H;
  const left = Math.min(span - since, TRADE_RAMP_H) / TRADE_RAMP_H;
  return Math.min(upto, left);
}

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
 * THE DISTANT CITY — SESSION 53. WHAT STANDS BEYOND THE RESIDENT RING.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * THE DEFECT IT ANSWERS, PHOTOGRAPHED: `tools/shot-out/s53-rim-air-*.png`. From
 * 300 m up the city fills the bottom quarter of the frame, cuts off along a
 * straight line, and 3.23 km of flat earth runs to the horizon. That cut is
 * `CITY.geometryRadius`, 640–768 m from the eye, and it is the operator's *"the
 * city stops abruptly and becomes desert"* in one number.
 *
 * WHY IT CANNOT BE FIXED BY RAISING THE RING. A resident chunk emits its own
 * meshes, so ring 6 is +44 chunks of draw calls against a `ceilings.drawCalls`
 * of 440 that `highway_speed` measures 397 of. The ring is bounded by draw
 * calls and nothing else will change that. What is NOT bounded is instances: one
 * `InstancedMesh` draws two thousand boxes in one call, and a city seen from
 * a kilometre away is exactly two thousand boxes.
 *
 * SO THIS IS A SILHOUETTE AND IT SAYS SO. It is not the city at low detail; it
 * is the same FIELD read at the resolution the distance leaves. What makes that
 * honest rather than a painted backdrop is that it reads `densityAt` and
 * `buildingHeightRoll` — the generator's own two laws — so a chunk's silhouette
 * and the chunk you get by walking there are two readings of one field, and
 * `edgeprobe --distant` measures how far apart they are.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE LAW, MEASURED OVER 619 BUILT CHUNKS OUTSIDE THE RING AT SEED 1337.
 *
 *   quantity      mean     p10     p50     p90     max    corr with density
 *   median h     36.79   25.63   35.20   49.65   90.30      -0.064
 *   max h        91.01   52.82   86.56  141.22  153.21      +0.064
 *   cover         0.44    0.33    0.45    0.57    0.73      +0.423
 *   count         9.62    7.00   10.00   12.00   14.00      +0.310
 *
 * READ THE LAST COLUMN. **HEIGHT DOES NOT DEPEND ON DENSITY IN THIS CITY** —
 * both correlations are 0.06, which is nothing — and that is not a defect, it is
 * `buildingHeightRoll` being a function of `rng` alone. What density buys is
 * HOW MUCH GROUND IS COVERED and HOW MANY buildings there are, and both fits are
 * printed beside their correlation rather than as bare coefficients:
 *
 *     cover = 0.267 + 0.362 * d      r = +0.423
 *     count = 7.179 + 5.020 * d      r = +0.310
 *
 * So the silhouette rolls its heights from `buildingHeightRoll` — THE SAME
 * FUNCTION, not a fit of it — and takes only the count and the coverage from the
 * two lines above. A fit of the height distribution would have been a second
 * description of a quantity that already has one (CONTRACT §9.1); a fit of the
 * coverage is a genuine summary of a placement pass too expensive to run.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO BOXES A CHUNK, AND THE NUMBER IS THE TRIANGLE BUDGET'S.
 *
 * `perfcheck` measures `highway_speed` at 2.21 M triangles against a
 * `ceilings.triangles` of 2 360 000 — **150 000 of headroom**. A box is 12
 * triangles; the silhouette reaches 26 chunks, which is 53² − 11² = 2 688
 * chunks, so K boxes a chunk costs 32 256·K triangles at full occupancy. K = 2
 * is 64 512 — under half the headroom, leaving the other half for whatever
 * comes next. K = 4 would be 129 024 and would leave 21 000, which is not
 * headroom, it is a coincidence waiting to go red.
 *
 * AND TWO IS WHAT A SKYLINE IS MADE OF, WHICH IS WHY IT IS NOT A COMPROMISE.
 * The table above says a chunk is a mass at the median height with one thing
 * standing well above it: p50 of the median is 35.2 m and p50 of the max is
 * 86.6 m, a factor of 2.5. **One box for the block and one for its tower** is
 * that pair, and it is the whole of what a block contributes to a top line seen
 * from a kilometre away.
 *
 * FULL OCCUPANCY NEVER HAPPENS, AND THE EXTENT IS WHY. A chunk under
 * `CITY.lowDetailThreshold` has no buildings, so it contributes no boxes at all
 * — and past `CITY.extentEdgeM` every chunk is under it by construction. The
 * silhouette therefore thins and stops on its own, reading the same
 * `cityExtentAt` the field does, and `edgeprobe --distant` prints the delivered
 * count against the 5 376 ceiling.
 */
export const DISTANT = {
  /** Chebyshev radius in chunks. `ceil(extentEdgeM / chunkSize)` = 26, so a
   *  camera standing at the world's centre can see the city's own rim. */
  radiusChunks: 26,
  /** `cover = a + b * density`, r = +0.423 over 619 built chunks. */
  coverBase: 0.267,
  coverSlope: 0.362,
  /** `count = a + b * density`, r = +0.310 over the same 619. */
  countBase: 7.179,
  countSlope: 5.020,
  /**
   * ONE BUILDING'S FOOTPRINT, AND IT IS A CONSTANT BECAUSE THE CITY MEASURES AS
   * ONE. 5 957 buildings outside the ring at seed 1337, binned by height:
   *
   *     height band     n     mean footprint    mean w x d
   *      0- 25 m      1879        505 m2        21.2 x 24.5
   *     25- 40 m      1759        509 m2        21.2 x 24.7
   *     40- 60 m      1281        494 m2        20.9 x 24.4
   *     60- 90 m       673        503 m2        21.1 x 24.6
   *     90-120 m       229        505 m2        20.9 x 24.8
   *    120-160 m       136        528 m2        21.1 x 25.4
   *
   * **corr(height, footprint) = 0.008.** A 150 m tower in NOCTIS is 21 x 25 m,
   * exactly like a 20 m shop, because `buildingHeightRoll` and
   * `buildingDepthRoll` are independent draws. That is a real property of this
   * city and it is why the distant towers are needles: they are needles up
   * close too.
   */
  frontageM: 21.1,
  depthM: 24.7,
  /**
   * How far the building line stands from the island's own edge. The island is
   * what `CORRIDOR` leaves of a chunk and a perimeter building meets the lot
   * line, so this is 0 — written down rather than omitted, because LOOK.md §2's
   * first bullet is *"buildings meet the lot line"* and a silhouette that
   * quietly set them back would be drawing a different city's rule.
   */
  setbackM: 0,
  roughness: 0.85,
  /**
   * WHICH MATERIAL, AND THE WEIGHTS ARE THE DELIVERED POPULATION'S — measured
   * over the same 5 957 buildings, not re-derived from the era chain:
   *
   *     brick 29.08%   concrete 27.25%   panel 18.90%   stucco 24.78%
   *
   * A SILHOUETTE NEEDS FOUR COLOURS AND NOT ONE, and the first arm proved it in
   * a frame: every box at the mean reflectance made the whole distant city one
   * flat grey against a near ring of brick, stucco and panel, so the ring
   * boundary read as a TONE step at a fixed distance from the eye. The four
   * reflectances span 0.086 to 0.600 — a factor of seven — and that spread is
   * the last thing about a facade to fall below a pixel.
   *
   * It rides in `instanceColor`, so it is 71 kB of buffer and ZERO extra draw
   * calls: the same arrangement `addInstanced`'s `skin` already uses for every
   * building in the resident ring.
   *
   * The order is `MATERIAL_NAMES`, and it is indexed rather than named so a
   * material added to `CITY_MATERIALS` is a length mismatch here rather than a
   * silent renormalisation.
   */
  materialWeights: [0.291, 0.272, 0.189, 0.248],
  /**
   * ═════════════════════════════════════════════════════════════════════════
   * THE DISTANT CITY AT NIGHT — cd/m², AND A GATE ASKED FOR THIS NUMBER.
   * ═════════════════════════════════════════════════════════════════════════
   *
   * The silhouette shipped with no emission at all, and `lookcheck`'s
   * `distinct:midnight|dusk` measured the consequence: 0.03004 -> 0.02959 over
   * six runs on two arms with a spread of 0.00001 an arm. STATE 53 §6.1.1 has
   * the mechanism, measured off the frames rather than argued: the silhouette
   * changes 8.97% of the pixels, those pixels were the frame's HIGHEST-contrast
   * region (the sky at the far end of a street — 0.051 against 0.028 for
   * everything else), and an unlit grey mass standing in front of sky swings
   * less between midnight and dusk than the sky it replaced.
   *
   * LOOK.md §1 is a NIGHT city. At midnight a distant city is a field of lights
   * against a black sky, and STATE 53 §7 predicted in writing that lighting it
   * would move the band back.
   *
   * ══ THAT PREDICTION WAS FALSIFIED IN THE SAME SESSION THAT MADE IT. ══
   *
   * Delivered: **0.02958 unlit -> 0.02953 lit**, five times the instrument's own
   * 0.00001 resolution and in the WRONG DIRECTION. The mechanism is one
   * sentence and it should have been obvious: **midnight is DARKER than dusk,
   * so ANY light added at midnight moves midnight TOWARDS dusk.** The other
   * pairs agree — `midnight<->dawn` 0.12835 -> 0.12825 and `midnight<->noon`
   * 0.20458 -> 0.20458, i.e. midnight moved slightly toward the two dim frames
   * and not at all against the bright one.
   *
   * So `distinct:midnight|dusk` rewards a DARK night city, and LOOK.md §1 asks
   * for a lit one. **THE LIGHT STAYS AND THE THRESHOLD DOES NOT MOVE** —
   * LOOK.md §7: *"a look threshold is evidence, not a verdict"*, and *"the
   * correct response is to ask what that band was derived from, not to abandon
   * the change."* What is owed is a derivation of that band against a city that has
   * its lights on, and it is written up there with its date.
   *
   * IT IS AN AREA MEAN AND THAT IS WHY IT IS ONE NUMBER RATHER THAN GEOMETRY.
   * A window at 2 km is a hundredth of a pixel. What reaches the eye is the
   * facade's mean radiance, and the mean is the honest primitive.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * THE ARITHMETIC, AND ITS FIRST ARM WAS WRONG BY 1.71x IN ONE STEP.
   *
   * The first arm read `era.windowWall` — 0.3083 population-weighted — as the
   * glazed fraction of a facade. **IT IS NOT.** It is a descriptive era
   * attribute, and `city.js` builds the actual openings from the RHYTHM:
   * `winW = colW * (band 0.9 | panel 0.95 | else 0.55)` and
   * `winH = era.floor * (windowWall > 0.4 ? 0.62 : 0.44)`. Over the 5 957
   * buildings outside the ring at seed 1337:
   *
   *     era           share   rhythm      winW/colW  winH/floor  glazed
   *     prewar       21.19%   grid            0.55       0.44     0.2420
   *     postwar      27.14%   band            0.90       0.62     0.5580
   *     corporate    21.55%   vertical        0.55       0.44     0.2420
   *     infill       20.72%   irregular       0.55       0.44     0.2420
   *     contemporary  9.40%   panel           0.95       0.62     0.5890
   *                                                     weighted   0.3604
   *
   * **AND ONLY TWO OF FOUR FACES CARRY ANY.** `city.js`'s window loop skips a
   * face that is neither `front` nor `rear`, and its own comment says why:
   * *"buildings in a run touch, so a window on a side face is a window inside
   * the neighbour"*. A distant box is seen from every side, so the mean has to
   * be over all four:
   *
   *     0.3604 x 0.5 (faces)  x  0.6280 (lit gain)  x  220 (windowNits)
   *   = 0.1802               x  0.6280             x  220   =  24.90 cd/m²
   *
   * The lit gain is `city.js`'s own per-window roll,
   * `lit > 0.42 ? 1 : lit > 0.3 ? 0.35 : 0.02` on a uniform hash:
   * 0.58·1 + 0.12·0.35 + 0.30·0.02.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * AND THEN A MEASURED FACTOR, BECAUSE THE FRAME REFUSED THE DERIVATION.
   *
   * At 42.59 (the first arm) the night aerial delivered a **mean of 42.27 code
   * values over the distant band against 8.00 over the near city's** —
   * `s53-rim-night-*.png`, rows 373-535 against 567-794 —  and the far half of
   * the world was brighter than the near half. 24.90 is 1.71x better and still
   * 3.1x over.
   *
   * `DISTANT.nightToneFactor` is that residual, MEASURED and named for what it
   * absorbs rather than tuned until it looked right:
   *
   *   1. THE TONE CURVE IS CONCAVE. A uniform surface at radiance L and a
   *      mixture of {30% at 220, 70% at ~0} with the same mean L are the same
   *      radiance and NOT the same code value: the mixture's highlights are
   *      compressed and its darks are not, so the uniform one comes out
   *      brighter. This is the dominant term and it is a real property of the
   *      renderer, not an error in either number.
   *   2. THE NEAR BAND CONTAINS STREETS. The comparison is two bands of one
   *      frame; the near band has carriageway between its buildings and the
   *      distant band is nearly solid city.
   *
   * SO IT IS A CALIBRATION AND IT SAYS SO, INCLUDING WHAT IT WAS CALIBRATED TO.
   * The target was not equality — the near band contains streets and the far
   * band is nearly solid city, so they cannot be equal — it was **the same
   * order**, and the delivered ratio is 1.58 where the first arm's was 5.28.
   * What it is calibrated against is printed above and reproducible in one
   * command. What would retire it is a
   * probe that reads the near city's own facade pixels rather than a band of
   * frame — `bareprobe --why` already attributes ground pixels to owners and is
   * the shape of it. §7 of STATE 53.
   */
  nightNits: 0.3604 * 0.5 * 0.6280 * 220 * 0.32,
  /** See above: the measured residual between 24.90 cd/m² and the frame. */
  nightToneFactor: 0.32,
  nightMix: { tungsten: 0.652, fluorescentCold: 0.348 * 0.65, mercuryBlue: 0.348 * 0.35 },
};


/**
 * The silhouette's mean reflectance — `DISTANT.materialWeights` against
 * `CITY_MATERIALS`. Not what any one box is skinned with (each carries its own,
 * see `distantMasses`); this is what the population averages to, and it is what
 * a probe compares the near ring's mean against.
 *
 * A FUNCTION AND NOT A FIELD OF `DISTANT`, for a boring reason worth writing
 * down: `CITY_MATERIALS` is declared 800 lines below this one, so an
 * initialiser here would read it in its temporal dead zone. Derived from that
 * table rather than copied out of it, so the near ring's facades and the
 * distant one's masses cannot drift to two different greys.
 *
 * POPULATION-WEIGHTED AND NOT EQUAL-WEIGHTED, which is a 5% difference and was
 * a real error in the first arm: equal weights give [0.4025, 0.3765, 0.3575]
 * and the delivered population gives [0.3832, 0.3529, 0.3311]. Brick is the
 * commonest material and the darkest by a factor of four, so averaging the
 * TABLE instead of the CITY makes the distant half of the world too bright.
 */
export function distantAlbedo() {
  const w = DISTANT.materialWeights;
  const out = [0, 0, 0];
  for (let i = 0; i < MATERIAL_NAMES.length; i++) {
    const a = CITY_MATERIALS[MATERIAL_NAMES[i]].albedo;
    for (let j = 0; j < 3; j++) out[j] += w[i] * a[j];
  }
  return out;
}

/**
 * The masses that stand for chunk (cx, cz) when it is too far away to build.
 * Empty for a chunk with no buildings — which is every chunk under
 * `CITY.lowDetailThreshold` and therefore every chunk past `CITY.extentEdgeM`.
 *
 * PURE, AND ON ITS OWN RNG STREAM. CONTRACT §6: a roll drawn from an existing
 * stream would re-phase everything downstream of it, and this one is read for
 * chunks the generator has never been run on — so `'distant'` it is.
 *
 * ON THE PERIMETER AND NOT AT THE CENTRE. The first arm of this put ONE box at
 * the island's centre with the chunk's median height and one thin box for its
 * tower, and the aerial it produced reads as a field of chips: a 66 m slab per
 * chunk where the real island is a rind of separate buildings around a hollow
 * core. LOOK.md §2's own first sentence is what was missing — *"buildings meet
 * the lot line"* — and once the boxes are on the lot line the STREETS appear
 * between them, which is most of what a city looks like from a kilometre up.
 *
 * `n` OF THEM AND NOT TWO. The count law above gives 7 to 12, and at
 * `DISTANT.frontageM` x `depthM` = 521 m2 each that is 44% of the island —
 * which is `coverBase + coverSlope * d` = 0.44 at the mean density, arrived at
 * from the other direction. The two fits agree to 1%, and that agreement is
 * the check that the silhouette is the same city rather than a plausible one.
 * Cost, measured over seven camera chunks: **6 148 boxes worst case = 73 776
 * triangles**, against 150 000 of headroom under `ceilings.triangles`. One
 * draw call.
 */
export function distantMasses(rootSeed, cx, cz) {
  const b = chunkBounds(cx, cz);
  const mx = (b.x0 + b.x1) / 2;
  const mz = (b.z0 + b.z1) / 2;
  const d = densityAt(rootSeed, mx, mz);
  if (d < CITY.lowDetailThreshold) return [];

  const rng = chunkRng(rootSeed, cx, cz, 'distant');
  const n = Math.max(1, Math.round(DISTANT.countBase + DISTANT.countSlope * d));

  /** The island, which is what a chunk's buildings stand on. See `lotDepthM`. */
  const island = CITY.chunkSize - 2 * CORRIDOR;
  const half = island / 2 - DISTANT.setbackM;
  const perim = 8 * half;
  const step = perim / n;

  const out = [];
  for (let i = 0; i < n; i++) {
    /**
     * Evenly spaced round the perimeter with a rolled offset inside the gap.
     * Evenly spaced ALONE would put every chunk's buildings at the same
     * fraction of its own side and the whole distant city on one phase — the
     * lattice tell `docs/authored-city.md` §1 refuses for the density field, one
     * scale up. The jitter is bounded by the gap so two neighbours cannot swap.
     */
    const slack = Math.max(0, step - DISTANT.frontageM);
    const t = (i * step + rng.range(0, slack)) % perim;
    const h = buildingHeightRoll(rng);
    const material = MATERIAL_NAMES[weightedIndex(rng.next, DISTANT.materialWeights)];

    // Which side of the square, and how far along it. Sides are 2*half long.
    const side = Math.floor(t / (2 * half));
    const u = t - side * 2 * half - half;
    const inset = DISTANT.depthM / 2;
    if (side === 0) out.push({ x: mx + u, z: mz - half + inset, w: DISTANT.frontageM, d: DISTANT.depthM, h, material });
    else if (side === 1) out.push({ x: mx + half - inset, z: mz + u, w: DISTANT.depthM, d: DISTANT.frontageM, h, material });
    else if (side === 2) out.push({ x: mx - u, z: mz + half - inset, w: DISTANT.frontageM, d: DISTANT.depthM, h, material });
    else out.push({ x: mx - half + inset, z: mz - u, w: DISTANT.depthM, d: DISTANT.frontageM, h, material });
  }
  return out;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE HILLS PAST THE EDGE — SESSION 56, PART TWO (a). The city ends naturally.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Session 53 stopped the density at 3 232 m and costed terrain in the band
 * beyond it; session 54 stopped the lattice there. What was left past the
 * edge was the flat earth plane running to its 4 000 m rim — a horizon with
 * no shape. This is the horizon-with-shape variant: a ring of hill MASSES,
 * standing on the existing plane, drawn on the distant city's own pattern
 * (one world-fixed instanced mesh, no claims, no gates, nothing that moves)
 * — the silhouette class, which is CHEAPER than the 21-site terrain variant
 * because it touches none of the ground machinery at all.
 *
 * DERIVED, NOT DRESSED:
 *   rMin 3 300      just past the lattice edge, so no hill stands where a
 *                   road or a claim could ever be (density is 0 out there).
 *   rMax 3 950      the earth plane ends at 4 000; a hill's footprint stays
 *                   on the ground it stands on.
 *   height 22–85 m  at 3.5 km one degree of horizon is 61 m, so the ridge
 *                   subtends 0.35–1.4° — a low rim round a river basin, not
 *                   an alp. Scaled up with r so a far row reads over a near
 *                   shoulder rather than hiding behind it.
 *   THE VALLEYS ARE THE POINT: the main street (z ≈ 0) and the river
 *   (z ≈ RIVER.z0) each get a gap wider than any hill that could close it —
 *   a city's one exit road leaves through a valley, and its water does too.
 *   A wooded shoulder rides some hills as a second, darker, flatter dome:
 *   the treeline, at zero extra draw calls.
 */
export const HILLS = {
  rMinM: 3300,
  rMaxM: 3950,
  count: 140,
  footMinM: 110,
  footMaxM: 300,
  heightMinM: 22,
  heightMaxM: 85,
  roadGapM: 170,
  riverGapM: 150,
  woodChance: 0.45,
  /** Linear reflectances: dry scrub hill, and conifer wood on its shoulder. */
  hillAlbedo: [0.082, 0.092, 0.060],
  woodAlbedo: [0.034, 0.050, 0.035],
};

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE COUNTRYSIDE — SESSION 61. WHAT IS BETWEEN THE CITY'S EDGE AND THE HILLS.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * THE PREMISE THE BRIEF ASKED ME TO CHECK, MEASURED, AND IT IS NOT WHAT IT
 * SAID. The brief's arithmetic was *"the road ends sixty-eight metres before
 * the hills begin"* — `extentEdgeM` 3232 against `HILLS.rMinM` 3300. Both
 * numbers are right and neither is the geometry:
 *
 *   the last LATTICE carriageway on cz = 0 reaches   x = 3211.7 m
 *   the nearest hill EDGE to the origin is at        r = 3050 m
 *   the +X exit valley is clear of any hill footprint for  |z| < 179 m
 *   `block:road:main` is ONE PLANE, x in [-4000, 4000]     — it never ends
 *
 * So the hills already reach 182 m INSIDE the lattice edge, the road does not
 * end at all, and the exit corridor is a 358 m-wide clear valley all the way
 * to the rim. THE GAP IS NOT A GAP. What the frame shows at x = 3260 is worse
 * and simpler: **the road, the pavement and the earth become one surface.**
 * `block:road:main` is asphalt at 0.11714 against `GROUND.earthAlbedo`'s
 * 0.1229 — a 4.7% step — so past the last painted line there is nothing in
 * the frame that says *road* at all, and the only object in 800 m is session
 * 56's filling station standing on it.
 *
 * WHAT THIS BUILDS, AND WHY EACH PIECE IS THE CHEAP ONE:
 *
 *   FIELDS       the base layer, and the one that fixes the aerial. A ground
 *                rectangle is two triangles in the merged `city:ground` mesh
 *                and costs NO draw call, so a whole rim of fields is free at
 *                the ceiling. It is also what makes the road read from a car:
 *                LOOK.md §2's own lesson is that on pale ground what reads is
 *                a change of SURFACE or an object with HEIGHT, not paint — so
 *                the fields ARE the road's verge.
 *   HEDGEROWS    `city.js` has drawn an `edge` of kind `hedge` since session
 *                49 and nothing has ever asked for one. Two boxes a segment.
 *   FARMS        a house, a barn, a silo and a yard: `shed`, `shed`, `tower`
 *                and a ground rectangle — session 49's own three feature kinds,
 *                which is the brief's point that eight kinds of place were made
 *                from three meshes.
 *   A HOUSE ON THE ROAD   single storey on a large plot, which is the object
 *                this city does not contain anywhere: every mass inside the
 *                extent is a perimeter block or a landmark.
 *
 * WHERE THEY GO IS DERIVED FROM WHAT IS ALREADY OUT THERE. A farm wants FLAT
 * land, so it is refused inside a hill's footprint (`hillMasses` is pure and
 * this file owns it). A house wants a ROAD, so it stands on the exit
 * corridor. A field is what is left.
 *
 * AND THE EXIT ROAD CLAIMS ITS OWN GROUND FOR THE FIRST TIME. `block.js`
 * draws the 8 km ribbon and claims nothing outside `BLOCK_KEEPOUT`, so from
 * x = 168 to the rim there has never been a `carriageway` claim under it —
 * which is CONTRACT §9.1's rule unmet on the one road that leaves. Every
 * beyond-the-city chunk the ribbon crosses claims it now, so a hedgerow, a
 * silo or a farmhouse is refused from the running lane by the registry rather
 * than by an arithmetic guard in this block.
 */
export const COUNTRYSIDE = {
  /**
   * Metres, half-width of the exit road's claimed carriageway. It is
   * `CITY.roadHalfWidth` and it is ALSO `BLOCK.streetWidth / 2` = 7.5 in
   * `core/constants.js`, which this file may not import (it runs in the
   * streaming worker, CONTRACT §8.1). Two constants for one width is §9.1's
   * own subject, so the equality is written here and the SETBACK below is
   * large enough that a future disagreement of a metre could not put a hedge
   * in the road.
   */
  roadHalfM: CITY.roadHalfWidth,
  /**
   * Metres. The verge: from the carriageway's edge to the first field.
   * `CORRIDOR - roadHalfWidth` = 4.2 m is the city's own footway width, and a
   * country road has a verge rather than a footway — so this is that width
   * plus the same 1.8 m a hedge is deep, which is the ground a hedge needs to
   * stand on and be clear of the lane.
   */
  vergeM: 6.0,
  /**
   * Metres. A hedgerow segment. 12 m against the fence's 3.0 m
   * (`RECREATION.fenceSegmentM`) because a hedge has no posts and no panel
   * joint — its length is a drawing decision and not a manufactured one — and
   * a longer segment is four times fewer boxes over a rim that is 121 chunks
   * wide when you stand in it.
   */
  hedgeSegM: 12.0,
  /** Metres. A stock-proof hedge, and the height `city.js` draws its two boxes at. */
  hedgeHeightM: 1.8,
  hedgeHalfT: 0.35,
  /**
   * p(a chunk carries a farmstead). One in five puts a farm about every
   * 286 m along a rim, which at 128 m chunks is a working density for
   * agricultural land rather than a village.
   */
  farmChance: 0.20,
  /** p(a chunk beside the exit road carries a house). */
  houseChance: 0.55,
  /** Metres. A silo: 5 m across, 14 m tall — a real farm silo, and the one
   *  vertical in this landscape. */
  siloHalfM: 2.5,
  siloHeightM: 14,
  /** Linear reflectance of a stubble field. See `citygen`'s note: a mown lawn
   *  is [0.062, 0.094, 0.045] here (broadband ~0.08) and cereal stubble
   *  reflects about 2.1x that with straw's chromaticity — red and green nearly
   *  equal, blue about half. Delivered as a second ground kind so a rim reads
   *  as fields of two crops rather than one carpet. */
  $fieldAlbedo: '[0.186, 0.176, 0.094] — see city.js albedoFor',
};

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE ROAD THAT LEAVES — SESSION 62. ONE CENTRELINE, FIVE READERS.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * THE OPERATOR REJECTED SESSION 61's COUNTRYSIDE IN ONE SENTENCE: *"it is the
 * city's block vocabulary with green and yellow paint on it"*, and the third of
 * his four tells is that **the road runs straight through the fields in the
 * same lattice as downtown**. It does: `block.js` draws `block:road:main` as a
 * single `PlaneGeometry(groundExtent * 2, streetWidth)` at z = 0, so the one
 * road in this world that leaves the grid is the straightest thing in it.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * WHAT SESSION 61 COSTED, AND THE HALF OF IT THAT WAS WRONG.
 *
 * STATE 61 §5 says a rotated road surface has existed since session 19 and that
 * *"a road you can WALK on is one new function, because `scanGround` is the one
 * axis-aligned thing left"*. The first half is true — `city.js`'s road
 * `patches` are 0.01 m boxes at a yaw, riding the instanced box mesh. The
 * second half is not: the ground vocabulary is axis-aligned END TO END —
 * `generateChunk` pushes `{x0, x1, z0, z1}`, `subtractBoxes` intersects
 * rectangles, `buildGround`'s `quad()` emits from four scalars, `rects` records
 * the same four, `scanGround` tests them, `harness.occupancyCensus` reads them
 * and `occupancy.js` is *"a list of AXIS-ALIGNED claims"* in its own first
 * paragraph.
 *
 * **SO THIS ROAD IS NOT A ROTATED GROUND RECTANGLE AND DOES NOT ASK FOR ONE.**
 * It is a POLYLINE — the brief's own item 0b — and every consumer takes it in
 * the form that consumer already understands:
 *
 *   `block.js`'s ribbon        a triangle strip on this station table. It is
 *                              the same mesh, the same material and the same
 *                              ONE draw call the plane already was.
 *   `block.js`'s markings      a box per dash with a YAW, which is what
 *                              `put(x, z, l, w, yawDeg)` has taken since s45.
 *   `blockSurfaceAt`           `|z - centreZ(x)| <= halfAt(x)`. ONE expression,
 *                              and it replaces `az <= halfStreet`.
 *   the registry               an axis-aligned `carriageway` box PER CHUNK
 *                              bounding the polyline's own crossing of it —
 *                              the same conservative shape `paint()` and the
 *                              prop scatter already claim rotated things with.
 *   the countryside            the fields are cut, and the verge laid, against
 *                              a STAIRCASE of short axis-aligned boxes taken
 *                              from this table. Rectangles, so `subtractBoxes`
 *                              is untouched.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * THE SHAPE, AND EVERY NUMBER IN IT IS FORCED.
 *
 * **THERE ARE 768 m OF WORLD.** `BLOCK.groundExtent` is 4000 and
 * `CITY.extentEdgeM` is 3232, so the whole of *"the transition"* the operator
 * photographed is 768 m long. The brief asks for *"two or three bends over the
 * first kilometre"*; there is no first kilometre, and what fits is stated
 * rather than pretended.
 *
 * **THE CURVATURE IS BOUNDED BY A DESIGN SPEED.** `R = v² / (g·(e + f))` with
 * `e` = 0.05 superelevation and `f` = 0.17 side friction — the standard rural
 * pair — at 100 km/h (27.78 m/s) gives **R = 357.6 m**. That is `minRadiusM`,
 * and the schedule's `kmax` is its reciprocal, 2.797e-3 /m.
 *
 * **THE BEND IS A CURVATURE SCHEDULE AND NOT A SINE ON z.** A sine centreline
 * has its steepest SLOPE where it crosses zero, so it leaves the straight
 * arterial at an angle — a kink at exactly the join this exists to make
 * invisible. What a road actually does is enter a curve at zero curvature and
 * build it up, so the schedule is on κ:
 *
 *     κ(u) = dir · κmax · sin(2π u / L)        u ∈ [0, L], one SHIFT
 *     θ(u) = dir · (κmax·L / 2π) · (1 − cos(2π u / L))
 *
 * θ is 0 at both ends and peaks at `κmax·L/π` in the middle, so one shift is
 * **two bends** — out and back — leaving the road parallel to where it started
 * and displaced sideways. Both ends are tangential to the straight by
 * construction, which is why nothing has to be blended.
 *
 * **THE SEGMENT LENGTH IS WHAT MAKES THE OFFSET READ FROM A CAR.** The lateral
 * shift of one segment is `≈ κmax·L² / 2π`; at L = 384 m and κmax = 1/357.6
 * that predicts **65.6 m**, and the table delivers **64.8 m** — the 1.2%
 * between them is the small-angle step the estimate takes and the integral does
 * not, and both are printed because CONTRACT §9 rule 2 asks for it. The peak
 * heading is **19.59°**. At the gate's own 50° field a frame 400 m long is
 * 373 m wide, so 65 m of offset puts the road's far end a sixth of the frame
 * off centre — visibly not a lattice arm. Two segments fit in 768 m and the
 * second is shorter, so the two bends are not each other.
 *
 * **THE ROAD ALSO CHANGES KIND, WHICH IS THE OTHER HALF OF THE ITEM.** The
 * arterial is `2 · CITY.roadHalfWidth` = 15.0 m. A country road is TWO OF THIS
 * CITY'S OWN LANES and nothing else — `2 · ROAD_MARKING.laneOffsetM` = 7.0 m,
 * which is where this city already puts a lane line from the centre — and 7.0
 * clears two haulers passing (`traffic.js` → 2.66 m each) by 0.84 m a side.
 * The taper is at **1:50**, the standard rate, so narrowing 4.0 m on each side
 * takes `4.0 × 50` = **200 m**.
 *
 * **AND THE CENTRE LINE STOPS WHERE THE CROSS-SECTION DOES.** A marked centre
 * line belongs to the arterial's section; past the taper the road is an
 * unmarked country lane. So the paint runs exactly `taperM` past the extent and
 * ends, which is the brief's *"a centre line that stops"* falling out of the
 * taper rather than being a second number.
 *
 * **THE AMPLITUDE IS CLEAR OF THE HILLS, MEASURED RATHER THAN ASSUMED.**
 * `hillMasses` refuses any hill with `|z| < HILLS.roadGapM + foot`, so no
 * footprint reaches within 170 m of the axis. Measured over the delivered
 * population at seed 1337, the free z-band in the +X corridor is
 * `[-400, +179]` at its narrowest (x = 3900) and unbounded to −400 for the
 * whole of the −X corridor. **The +X road shifts NORTH first** (−z, CONTRACT
 * §3.1) into the side that is clear at every station. Delivered, swept at 4 m
 * over both arms against all 179 delivered hill and wood footprints: the
 * road's own VERGE EDGE comes no closer than **194.7 m** to any of them.
 */
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE FIELD PATTERN — SESSION 62, AND IT IS THE OPERATOR'S FIRST TELL.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * His words about session 61's aerial: *"every field is an axis-aligned
 * rectangle, several L-cut at exactly 90°, all of them roughly one city block
 * across."* Measured out of the pure generator at seed 1337 over the rim
 * (cx 25..33, cz −4..4):
 *
 *   field parcels                                                      218
 *   lying WHOLLY INSIDE their own 128 m chunk                    218 of 218
 *   axis-aligned rectangles                                      309 of 309
 *   parcel edges exactly on a multiple of `CITY.chunkSize`     542 of 872, 62%
 *   parcels with at least two edges on that lattice              218 of 218
 *   longest side, min / median / max                     45.3 / 89.0 / 128 m
 *   L-cut into two or more rectangles                       24 of 218, 11.0%
 *
 * **HE IS EXACTLY RIGHT AND THE BRIEF'S THIRD PREMISE SURVIVES.** Session 61
 * split `chunkBounds(cx, cz)` at most once per axis at a rolled line, so a
 * parcel is a chunk or a half or a quarter of one and can be nothing else —
 * every parcel has two edges on the 128 m lattice by construction, and the
 * upper bound on a field is one city block.
 *
 * A FOURTH THING THE MEASUREMENT FOUND THAT NOBODY ASKED ABOUT. The crop was
 * `(ci++ + cx + cz) % 2` over an i-outer/j-inner loop, which puts the two
 * same-crop cells of a four-way split at the same `j`: **on all 28 four-way
 * chunks the colour makes two full-width bands and the x split line carries no
 * change of crop at all.** A four-way split reads from the air as a two-way
 * split, so half the subdivision this file thought it was drawing was never
 * visible.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * WHAT REPLACES IT, AND WHY IT IS STILL AXIS-ALIGNED RECTANGLES.
 *
 * The ground vocabulary assumes an axis-aligned rectangle in 33 places (see
 * `EXIT_ROAD` below), so the answer is not a rotated parcel. It is that the
 * PARCEL STOPS BEING A PROPERTY OF THE CHUNK: the boundaries come from a WORLD
 * lattice of irregularly spaced lines, evaluated identically in every chunk
 * from the root seed and the line's own index, so a parcel spans as many chunks
 * as it likes and the chunk boundary stops being one of its edges.
 *
 * `pitchM` = 260 m gives a mean parcel of **6.8 ha**, which is an arable field;
 * a chunk is 1.6 ha and that is a paddock. `jitter` = 0.30 puts consecutive
 * lines `0.4` to `1.6 × pitch` apart — 104 to 416 m — so the gaps never cross
 * (the minimum is positive by construction) and no two parcels are the same
 * size.
 *
 * THE CROP IS A PROPERTY OF THE PARCEL AND NOT OF THE CHUNK, which is what
 * makes a parcel spanning four chunks read as ONE field rather than as four.
 * It is hashed from the line indices, and there are THREE crops rather than
 * two, because two alternating tones is a checkerboard however the cells are
 * shaped.
 */
export const FARM = {
  /**
   * Metres. Mean spacing of the parcel boundaries. 200 m gives 4.0 ha, which is
   * an arable field; `CITY.chunkSize` is 128 m and 1.6 ha, which is a paddock.
   * It is also 1.56 chunks, so a boundary crosses a given chunk 0.64 times on
   * each axis and most parcels reach into a neighbour — which is the whole
   * point, and is what session 61's 218-of-218-inside-one-chunk could not do.
   */
  pitchM: 200,
  /**
   * Fraction of `pitchM` a boundary is displaced by. 0.30 puts consecutive
   * lines 0.4 to 1.6 pitches apart (80–320 m), so the spacing is never
   * negative and the largest parcel is 16 times the smallest in area.
   */
  jitter: 0.30,
  /**
   * Metres. A boundary nearer than this to a chunk edge is dropped, because
   * both chunks either side make the same test on the same world number and so
   * both drop it — the parcel simply meets its neighbour at the chunk edge
   * instead, which is a metre or two out and nothing can see it.
   */
  minPieceM: 16,
  /**
   * The crops. Three and not two: two alternating tones is a checkerboard
   * whatever shape the cells are, which is what session 61's own frame showed.
   *
   * AND THE THIRD ONE IS NOT A THIRD GREEN, which the first arm got wrong and
   * a frame said so within the minute: a standing cereal at [0.112, 0.142,
   * 0.062] is a green, `grass` is a green, and a rim that is two thirds green
   * reads as one carpet exactly as two alternating tones did. The three that
   * make farmland read are the three STATES of the same ground — sward,
   * stubble, and the bare soil between them. `grass` is pasture, `field` is
   * cereal stubble, `tilled` is ploughed earth; see `city.js` →
   * `GROUND_ALBEDO` for all three reflectances and their derivations.
   */
  crops: ['grass', 'field', 'tilled'],
  /**
   * PER-PARCEL TONE, AND IT IS `hillMasses`' OWN ROLL. Three crops on a lattice
   * still delivers a third of every boundary invisible, because a third of
   * neighbouring parcels draw the same crop — and two adjacent fields of one
   * reflectance are one field. `hillMasses` already rolls `rng.range(0.82,
   * 1.12)` on a hill's tone for exactly this reason and this is the same roll:
   * the question *"two of the same thing at the same reflectance read as one
   * thing"* does not care whether the thing is a hill or a field.
   *
   * It costs NOTHING. `city.js`'s ground mesh has carried a per-vertex colour
   * since session 19 and `quad()` already writes the kind's albedo into it, so
   * a multiplier on the way in is one expression and no new attribute, no new
   * material and no new draw call.
   */
  toneMin: 0.82,
  toneMax: 1.12,
};

/**
 * WHERE PARCEL BOUNDARY `k` FALLS, on one axis, in world metres. Pure in
 * `(rootSeed, axis, k)`, so every chunk that touches this line computes the
 * same number and the parcel is one parcel.
 */
export function farmLine(rootSeed, axis, k) {
  const j = chunkRng(rootSeed, k, 0, `farm:${axis}`).next() - 0.5;
  return k * FARM.pitchM + j * 2 * FARM.jitter * FARM.pitchM;
}

/** The index of the parcel a world coordinate falls in, on one axis. */
export function farmIndex(rootSeed, axis, v) {
  let k = Math.floor(v / FARM.pitchM);
  /** The jitter is under 0.5 pitch, so the true index is within one of this. */
  for (let i = 0; i < 4; i++) {
    if (farmLine(rootSeed, axis, k) > v) { k -= 1; continue; }
    if (farmLine(rootSeed, axis, k + 1) <= v) { k += 1; continue; }
    break;
  }
  return k;
}

/**
 * Which crop parcel `(kx, kz)` carries, and at what tone. A property of the
 * PARCEL, so a parcel spanning four chunks is one field in all four of them.
 */
export function farmCrop(rootSeed, kx, kz) {
  const rng = chunkRng(rootSeed, kx, kz, 'farm:crop');
  const kind = FARM.crops[Math.min(FARM.crops.length - 1, Math.floor(rng.next() * FARM.crops.length))];
  return { kind, tone: rng.range(FARM.toneMin, FARM.toneMax) };
}

/**
 * The parcel boundaries strictly inside `(from, to)` on one axis, sorted, with
 * anything within `minPieceM` of either end dropped. See `FARM.minPieceM`.
 */
export function farmLinesIn(rootSeed, axis, from, to) {
  const out = [];
  const k0 = Math.floor(from / FARM.pitchM) - 1;
  const k1 = Math.ceil(to / FARM.pitchM) + 1;
  for (let k = k0; k <= k1; k++) {
    const v = farmLine(rootSeed, axis, k);
    if (v > from + FARM.minPieceM && v < to - FARM.minPieceM) out.push(v);
  }
  return out;
}

export const EXIT_ROAD = {
  /** Where the lattice stops and this road becomes the only one. */
  startM: CITY.extentEdgeM,
  /**
   * The world's rim. `BLOCK.groundExtent` = 4000 in `core/constants.js`, which
   * this file may not import (CONTRACT §8.1 — it runs in the worker), and it is
   * already written here as the `4000` inside `extentEdgeM`'s own derivation.
   * One literal, two uses, said out loud.
   */
  rimM: 4000,
  /** Half-width of the arterial. Identically `CITY.roadHalfWidth`. */
  halfCityM: CITY.roadHalfWidth,
  /** Half-width of the country road: one of this city's own lanes. */
  halfCountryM: 3.5,
  /** Metres of taper, at the standard 1:50 for a 4.0 m narrowing each side. */
  taperM: 200,
  /** m/s. 100 km/h — a rural trunk road leaving a metropolis. */
  designSpeedMS: 27.78,
  /** Metres. `v² / (g (e + f))`, e = 0.05, f = 0.17. 27.78² / (9.81 · 0.22). */
  minRadiusM: 27.78 * 27.78 / (9.81 * 0.22),
  /**
   * The shift schedule. `dir` is the sign in z; −1 is NORTH, which is the side
   * the hill measurement says is clear at every station of the +X corridor.
   * The west arm runs the same schedule with the signs flipped, so the two
   * roads out of this city are not each other's mirror.
   */
  shifts: [
    { lengthM: 384, dir: -1 },
    { lengthM: 300, dir: 1 },
    { lengthM: 300, dir: -1 },
  ],
  /**
   * Metres between stations of the tabulated polyline. The sagitta a chord
   * subtends on the tightest arc this road contains is
   * `R (1 − cos(s / 2R))` = 357.6 · (1 − cos(0.01119)) = **0.022 m**, which is
   * under the 0.05 m every join in this project is built with, so the strip
   * is the curve to within the tolerance the rest of the world uses.
   */
  stationM: 8,
  /**
   * The station the VERGE and the FIELD CUT are built on. Half `stationM`,
   * because those two are the readers whose error is a rectangle's inability to
   * follow a sloping edge rather than a chord's sagitta: `4 · tan(19.59°)` =
   * **1.42 m** of grass over the tarmac at the steepest bend against 2.85 m at
   * 8 m. See `exitRoadSpans`.
   */
  vergeStationM: 4,
};

/**
 * THE POLYLINE, TABULATED ONCE. Pure, module-scope, and identical in the
 * worker and on the main thread because it reads no seed and no state.
 *
 * CONTRACT §9 rule 2 — a quantity derived two ways is printed both ways at
 * least once. The two ways here are the closed-form heading θ(u) above and the
 * numerically integrated z, and what the table stores is the integral of the
 * closed form, so there is exactly one description. What is checked from the
 * other end is the DELIVERED offset against the `κmax·L²/2π` estimate in the
 * comment: 384 m at κ = 1/429 predicts 54.8 m and the table delivers the
 * number `tools/landprobe.mjs` prints.
 */
const EXIT_ROAD_TABLE = (() => {
  const E = EXIT_ROAD;
  const kMax = 1 / E.minRadiusM;
  const span = E.rimM - E.startM;
  const n = Math.ceil(span / E.stationM);
  /** `s` metres past `startM`; z and heading of the EAST arm at each station. */
  const s = new Float64Array(n + 1);
  const z = new Float64Array(n + 1);
  const th = new Float64Array(n + 1);
  /** Which shift a distance falls in, and how far into it. */
  const heading = (u) => {
    let rest = u;
    for (const sh of E.shifts) {
      if (rest <= sh.lengthM) {
        return sh.dir * (kMax * sh.lengthM / (2 * Math.PI))
          * (1 - Math.cos((2 * Math.PI * rest) / sh.lengthM));
      }
      rest -= sh.lengthM;
    }
    return 0;
  };
  /**
   * Simpson over each station interval. A trapezoid would accumulate a
   * first-order error over 96 stations against a quantity the ribbon, the
   * markings, the claim and the field cut all read — CONTRACT §9's own shape
   * with an integration rule.
   */
  for (let i = 0; i <= n; i++) {
    s[i] = Math.min(i * E.stationM, span);
    th[i] = heading(s[i]);
    if (i === 0) { z[0] = 0; continue; }
    const a = s[i - 1];
    const b = s[i];
    const m = (a + b) / 2;
    z[i] = z[i - 1] + ((b - a) / 6)
      * (Math.sin(heading(a)) + 4 * Math.sin(heading(m)) + Math.sin(heading(b)));
  }
  return { n, s, z, th, span };
})();

/**
 * THE CENTRELINE'S z AT A WORLD x. Zero everywhere the lattice still exists, so
 * every reader inside the city gets exactly the straight road it had.
 *
 * The two arms take opposite signs, which is the whole of what makes the road
 * out of the west a different road from the road out of the east.
 */
export function exitRoadZ(x) {
  const ax = Math.abs(x);
  if (ax <= EXIT_ROAD.startM) return 0;
  const T = EXIT_ROAD_TABLE;
  const u = Math.min(ax - EXIT_ROAD.startM, T.span);
  const i = Math.min(Math.floor(u / EXIT_ROAD.stationM), T.n - 1);
  const t = (u - T.s[i]) / (T.s[i + 1] - T.s[i] || 1);
  const zz = T.z[i] + (T.z[i + 1] - T.z[i]) * t;
  return x >= 0 ? zz : -zz;
}

/**
 * THE TANGENT'S YAW IN DEGREES, for the markings and for anything laid ALONG
 * the road. Positive is the rotation about +Y that `setMatrix` takes, and it is
 * read off the same table rather than differenced out of `exitRoadZ` — two
 * descriptions of one tangent is §9.1 with an angle.
 *
 * On the west arm the road runs toward −x, so a mark's local +X is reversed as
 * well as its z: the two negations cancel and the yaw is the east arm's own.
 */
export function exitRoadYawDeg(x) {
  const ax = Math.abs(x);
  if (ax <= EXIT_ROAD.startM) return 0;
  const T = EXIT_ROAD_TABLE;
  const u = Math.min(ax - EXIT_ROAD.startM, T.span);
  const i = Math.min(Math.floor(u / EXIT_ROAD.stationM), T.n - 1);
  const t = (u - T.s[i]) / (T.s[i + 1] - T.s[i] || 1);
  const th = T.th[i] + (T.th[i + 1] - T.th[i]) * t;
  return (th * 180) / Math.PI;
}

/**
 * THE CARRIAGEWAY'S HALF-WIDTH AT A WORLD x. 7.5 m of arterial, tapering at
 * 1:50 to 3.5 m of country lane over `taperM`, and holding.
 */
export function exitRoadHalfM(x) {
  const ax = Math.abs(x);
  if (ax <= EXIT_ROAD.startM) return EXIT_ROAD.halfCityM;
  const t = Math.min(1, (ax - EXIT_ROAD.startM) / EXIT_ROAD.taperM);
  return EXIT_ROAD.halfCityM + (EXIT_ROAD.halfCountryM - EXIT_ROAD.halfCityM) * t;
}

/**
 * THE POLYLINE AS AXIS-ALIGNED SPANS OVER AN x RANGE — the form every consumer
 * in this file already understands, and the reason no rotated ground rectangle
 * is needed anywhere.
 *
 * A RECTANGLE CANNOT FOLLOW A SLOPING EDGE, so each interval reports FOUR z
 * values rather than two, and which one a caller wants depends on which way it
 * would rather be wrong:
 *
 *   `zFar0` / `zFar1`    the OUTERMOST north and south edges over the interval.
 *                        A box between them CONTAINS the ribbon. This is what
 *                        the registry claims and what the fields are cut by, so
 *                        nothing is ever drawn or placed on the running lane.
 *   `zNear0` / `zNear1`  the INNERMOST. A verge laid from here outward OVERLAPS
 *                        the asphalt by at most the interval's own z change and
 *                        never leaves a strip of bare earth between the two.
 *
 * THE DIRECTION IS CHOSEN AND NOT TOLERATED. Session 61's own aerial found the
 * other one: cutting the fields back by `vergeM` and laying nothing in the gap
 * left 12 m of earth plane either side of the road for its whole length, which
 * is session 42's *"a missing surface is a surface of about the right colour
 * that is not there"*. So the verge overlaps the tarmac rather than falling
 * short of it, and what that looks like is grass growing over the edge of a
 * country road — which is what grass does.
 *
 * The overlap is bounded: `stationM · tan(θmax)` = 8 · tan(19.59°) = **2.85 m**
 * at the steepest bend, against a 7.0 m carriageway. `EXIT_ROAD.vergeStationM`
 * halves the station for exactly this reader and takes it to **1.42 m**, which
 * is under the 1.8 m a hedge is deep and is the same order as the ragged edge a
 * mown verge has anyway.
 */
export function exitRoadSpans(x0, x1, stationM = EXIT_ROAD.stationM) {
  const out = [];
  if (x1 <= x0) return out;
  /** Snap to the station lattice so two chunks describe the same staircase. */
  const a = Math.floor(x0 / stationM) * stationM;
  for (let t = a; t < x1; t += stationM) {
    const lo = Math.max(t, x0);
    const hi = Math.min(t + stationM, x1);
    if (hi <= lo) continue;
    const zA = exitRoadZ(lo);
    const zB = exitRoadZ(hi);
    const hA = exitRoadHalfM(lo);
    const hB = exitRoadHalfM(hi);
    out.push({
      x0: lo,
      x1: hi,
      zFar0: Math.min(zA - hA, zB - hB),
      zNear0: Math.max(zA - hA, zB - hB),
      zNear1: Math.min(zA + hA, zB + hB),
      zFar1: Math.max(zA + hA, zB + hB),
    });
  }
  return out;
}

/**
 * WHICH x RANGES OF A CHUNK OWN THE ROAD. Session 61's rule was
 * `b.z0 <= 0 && b.z1 > 0` — the chunk row containing z = 0 — and its own
 * comment gives the reason: the road runs on a chunk BOUNDARY, so exactly one
 * of the two chunks either side must furnish it *"or everything beside it is
 * emitted twice"*.
 *
 * A ROAD THAT BENDS CROSSES ROWS, so the rule becomes the same sentence with
 * the centreline substituted for the boundary: a chunk furnishes the road over
 * exactly the x where the CENTRELINE lies inside its own z band. The half-open
 * interval `[b.z0, b.z1)` is what makes it exactly one chunk when the line
 * lands on a boundary, which is what it does for the whole of the straight
 * part inside the extent.
 *
 * Evaluated on the station lattice so two neighbours agree to the metre.
 */
export function exitRoadOwnSpans(b, stationM = EXIT_ROAD.stationM) {
  const out = [];
  let run = null;
  const a = Math.floor(b.x0 / stationM) * stationM;
  for (let t = a; t < b.x1; t += stationM) {
    const lo = Math.max(t, b.x0);
    const hi = Math.min(t + stationM, b.x1);
    if (hi <= lo) continue;
    const zc = exitRoadZ((lo + hi) / 2);
    const owns = zc >= b.z0 && zc < b.z1;
    if (owns) {
      if (run && run.x1 === lo) run.x1 = hi;
      else { run = { x0: lo, x1: hi }; out.push(run); }
    } else run = null;
  }
  return out;
}

export function hillMasses(rootSeed) {
  const rng = chunkRng(rootSeed, 0, 0, 'hills');
  const out = [];
  for (let i = 0; i < HILLS.count; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(HILLS.rMinM, HILLS.rMaxM);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const foot = rng.range(HILLS.footMinM, HILLS.footMaxM);
    const far = (r - HILLS.rMinM) / (HILLS.rMaxM - HILLS.rMinM);
    const h = rng.range(HILLS.heightMinM, HILLS.heightMaxM) * (0.7 + 0.6 * far);
    /**
     * The two valleys: the exit road's and the river's. Against the FULL
     * footprint — a hemisphere's rim reaches all of it, and the first arm
     * used 0.7x and stood a hill's shoulder over the forecourt at x 3400.
     */
    if (Math.abs(z) < HILLS.roadGapM + foot) continue;
    if (Math.abs(z - RIVER.z0) < HILLS.riverGapM + foot) continue;
    const tone = rng.range(0.82, 1.12);
    /**
     * THE PLAN IS AN ELLIPSE AT A BEARING — SESSION 62, AND IT IS FREE.
     *
     * The operator's word for session 61's hills was *"three smooth domes"*,
     * and three identical circular domes at three scales is three copies of one
     * object — LOOK.md §4's *"any object placed at intervals needs FORM
     * variation, not colour variation"*, which `tone` above was answering with
     * colour. `city.js` composes the instance from a quaternion and three
     * independent scales already, so an eccentricity and a bearing cost nothing
     * but these two rolls.
     *
     * `ecc` multiplies one horizontal half-extent and divides the other, so the
     * PLAN AREA IS UNCHANGED at every value and the ring's footprint budget —
     * which `HILLS.roadGapM` and the farmstead's `onHill` are both written
     * against — does not move with it. 1.0 to 1.45 takes the long axis to
     * 1.45x the short one, which is a ridge rather than a dome and is under the
     * 1.5 at which a hemisphere starts to read as a wall.
     */
    const ecc = rng.range(1.0, 1.45);
    const bearingDeg = rng.range(0, 180);
    out.push({ x, z, foot, h, wood: false, tone, ecc, bearingDeg });
    if (rng.chance(HILLS.woodChance)) {
      /** The wood sits on the flank, downhill of the crown, flatter and darker. */
      const wa = rng.range(0, Math.PI * 2);
      out.push({
        x: x + Math.cos(wa) * foot * 0.4,
        z: z + Math.sin(wa) * foot * 0.4,
        foot: foot * rng.range(0.35, 0.55),
        h: h * rng.range(0.30, 0.45),
        wood: true,
        tone: rng.range(0.85, 1.1),
        ecc: rng.range(1.0, 1.6),
        bearingDeg: rng.range(0, 180),
      });
    }
  }
  return out;
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
 * Metres. HOW FAR OUTSIDE A SIDE ELEVATION TO LOOK FOR THE NEIGHBOUR THAT
 * MAKES IT A PARTY WALL — session 60, item 2.
 *
 * IT IS NOT A TOLERANCE, IT IS THE GAP BETWEEN TWO POPULATIONS. The perimeter
 * walk above advances `t += width + rng.range(0.2, 1.4)` between two buildings
 * of one run and `rng.range(6, 26)` after the last of one, and the quay walk's
 * own advance is `rng.range(0.2, 6)`. So the distance from a building's side
 * face to the next thing along the frontage is drawn from one of two bands and
 * there is **nothing between 1.4 m and 6.0 m** on the perimeter walk:
 *
 *     within a run      0.2 .. 1.4 m     a party wall — the comment in
 *                                        `city.js` → `buildFacade` is right
 *     end of a run      6.0 .. 26.0 m    a yard, an alley, a cross street
 *
 * 2.0 m stands in that gap: 0.6 m above the first band's ceiling and 4.0 m
 * below the second's floor. Any number in [1.4, 6.0) classifies every
 * perimeter building identically, so the value is not a knob and moving it
 * inside that interval changes nothing — which is the property CONTRACT §9
 * rule 5 asks a constant to have.
 *
 * THE QUAY WALK IS THE EXCEPTION AND IT IS NAMED RATHER THAN EXCUSED: its
 * `rng.range(0.2, 6)` spans the gap, so a quayside terrace with a 3 m break in
 * it reads as a party wall here. That is the conservative direction — it keeps
 * an elevation blank rather than glazing one a neighbour is standing against —
 * and the quay's own 1 m building margin (`QUAY_SETBACKS`) means its terraces
 * genuinely do lie one on another.
 */
export const SIDE_PARTY_PROBE_M = 2.0;

/**
 * Metres. HOW FAR IN FRONT OF A SIDE ELEVATION IS WORTH LOOKING — session 60,
 * item 2, and it is a SATURATION rather than a threshold.
 *
 * `sideOpenM` is the clear distance from a side face to the nearest mass in
 * front of it, and past a certain distance the answer stops carrying
 * information: `CORRIDOR × 2` = 23.4 m is this city's own building line to
 * building line (see `depthprobe`'s note and LOOK.md §2's light-well
 * derivation), so anything clear for 30 m is looking across at least a street.
 * The sweep stops there rather than walking the whole island, which is what
 * makes the query one registry call per face.
 */
export const SIDE_OPEN_MAX_M = 30.0;

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

export const LOW_DETAIL_KINDS = [
  'parking', 'lot', 'yard', 'park', 'construction', 'recreation', 'carpark',
  /**
   * SESSION 49 — THE PROGRAM. See `PROGRAM` for what each one is and, more to
   * the point, for where each one goes: every entry below carries a condition,
   * and a roll whose condition fails FALLS THROUGH to a neighbouring kind
   * rather than being re-rolled — the arrangement `carpark` established in
   * session 48, because falling through makes two kinds one decision about the
   * land and re-rolling makes them compete for a die face.
   */
  'school', 'hospital', 'firestation', 'industrial', 'market', 'depot', 'church', 'port',
];

/**
 * WHAT A CITY NEEDS THAT IS NEITHER A HOUSE NOR A PITCH — SESSION 49.
 *
 * Session 48 built five kinds of place and proved the budget is not the limit:
 * a stadium is 324 boxes and 3 900 triangles against 130 000 spare, so forty
 * car parks would fit. **What limits block-scale program is authoring time**,
 * and the answer to that is a shared vocabulary rather than eight bespoke
 * draws. `city.js` gained three feature kinds this session — `shed`, `canopy`
 * and `tower` — and the eight places below are compositions of those three
 * plus what session 40 and 48 already built.
 *
 * EVERY PLACEMENT IS DERIVED FROM SOMETHING THE CITY ALREADY KNOWS, and the
 * cuts are the MEASURED quantiles of the low-detail population (see
 * `RECREATION` for the 237-chunk distribution) rather than the thirds of the
 * band it lives in — which is session 48's own lesson, learnt when the band's
 * thirds delivered seven playgrounds out of seven.
 *
 *   school       where people live      density >= p33, the same land a
 *                                       playground takes
 *   hospital     an arterial            the chunk's own west boundary carries a
 *                                       RIVER BRIDGE, which is the one road in
 *                                       this city that is a through route by
 *                                       construction (`bridgeX`, every 512 m)
 *   firestation  a corner, clear access the middle tercile — between the core it
 *                                       serves and the roads it needs
 *   industrial   cheap land, freight    the river, the viaduct, or density < p33
 *   market       the dense core         density >= p67, where the retail
 *                                       frontage roll is already highest
 *   depot        near the viaduct       the viaduct's own AABB, padded a chunk
 *   church       anywhere               no condition: a parish is not a land use
 *   port         the water              `riverTouchesChunk`, and nothing else
 */
/**
 * The eight, as a set, so the one branch that builds them all can be selected
 * without an eight-way `||`. `LOW_DETAIL_KINDS` keeps the order the die reads.
 */
export const PROGRAM_KINDS = new Set([
  'school', 'hospital', 'firestation', 'industrial', 'market', 'depot', 'church', 'port',
]);

/**
 * THE SHED'S OWN OVERHANGS, EXPORTED BECAUSE `city.js` DRAWS THEM AND
 * `placeMass` MUST CLAIM THEM — session 50, and both were found by the
 * delivered sweep the moment this session put a path and a container next to a
 * shed. Same arrangement as `LOW_WALL`, session 47.
 *
 * `dockReachM` IS THE ONE THAT MATTERED. A `dock` shed draws a loading platform
 * at `d / 2 + 0.9` that is 1.8 m deep, so it stands **1.8 m outside the body**,
 * and `placeMass` claimed the body alone: `prop(container) x feature(shed:)` at
 * 0.773 m² and two `path(ground:path) x feature(shed:)` at 0.364. A platform
 * outside the wall is CORRECT — that is what a loading dock is — so the claim
 * grows to meet the draw rather than the other way round, and it grows on BOTH
 * sides because which side `+v` is after `alongX` is exactly the question
 * CONTRACT §9 keeps catching this file on.
 *
 * `parapetLongFactor` IS THE THIRD TIME THIS PROJECT HAS SHIPPED A COPING WIDER
 * THAN THE THING IT COPES. The pond's was 2% (session 48), the park centre's
 * arrived through a yaw (session 49), and the shed's is `w * 1.01` by
 * `d * 1.02` against a claim of exactly `w` by `d`. It is 0.22 m on a 44 m
 * shed — invisible, and forbidden. Flush.
 */
export const SHED = {
  dockReachM: 1.8,
  parapetLongFactor: 1.0,
  parapetDeepFactor: 1.0,
  /**
   * WHAT THE LONG FACE CARRIES, AND IT HAS TO STAND PROUD. A ribbon window sits
   * at `d / 2 + 0.04` and an appliance door at `d / 2 + 0.06`; INSETTING them
   * to remove the overhang would bury them inside an opaque body and they would
   * not be drawn at all. So the claim grows to meet the draw. The deepest of
   * the three is the `bay` door at `0.06 + 0.14 / 2` = 0.13; 0.14 covers all
   * of them and is the number `placeMass` adds on the depth axis for EVERY
   * shed, whatever its style.
   */
  faceProudM: 0.14,
};

export const PROGRAM = {
  /** Metres. A school block: two storeys, a long face to the playground. */
  schoolLongM: 58, schoolDeepM: 14, schoolStoreyM: 4.0, schoolFloors: 2,
  /** Metres. A hospital slab and the tower on it. */
  hospLongM: 56, hospDeepM: 18, hospFloors: 4, hospStoreyM: 3.6,
  hospTowerHalfM: 7.0, hospTowerM: 34,
  /** Metres. Ambulance bay: a canopy a vehicle turns under. */
  hospBayLongM: 16, hospBayDeepM: 9, hospBayHighM: 4.6,
  /** Metres. A fire station: three appliance bays and a hose tower. */
  fireLongM: 34, fireDeepM: 14, fireHighM: 7.4, fireBays: 3,
  fireTowerHalfM: 3.2, fireTowerM: 18,
  /** Metres. An industrial shed, and how many an estate carries. */
  shedLongM: 44, shedDeepM: 22, shedHighM: 9.5, sheds: 2,
  /** Metres. A market hall: one roof, open sides, a forecourt. */
  marketLongM: 62, marketDeepM: 34, marketHighM: 7.2,
  /** Metres. A depot: a parking canopy and a workshop beside it. */
  depotLongM: 62, depotDeepM: 26, depotHighM: 6.0,
  depotShopLongM: 28, depotShopDeepM: 14, depotShopHighM: 8.0,
  /** Metres. A church: a nave and a spire. */
  naveLongM: 30, naveDeepM: 13, naveHighM: 11,
  spireHalfM: 3.6, spireM: 21,
  /** Metres. A wharf shed and the container stacks beside it. */
  wharfLongM: 46, wharfDeepM: 18, wharfHighM: 8.0,
};

/**
 * A MULTI-STOREY CAR PARK — SESSION 48, TIER TWO, AND THE FIRST BLOCK-SCALE
 * OBJECT IN THIS CITY THAT IS NOT A HAND-PLACED LANDMARK.
 *
 * HOW A BLOCK-SCALE OBJECT GETS PLACED AT ALL, which the brief asked to
 * establish before anything was built. There were two candidate paths and
 * neither is obviously right:
 *
 *   THE LANDMARK PATH is authored — eight entries in `LANDMARKS`, each with a
 *   bespoke `kind` in `landmarkOccluders` and a bespoke case in `buildLandmark`,
 *   each appearing exactly ONCE in the world at a coordinate somebody typed. It
 *   is the right path for a thing you navigate by and the wrong one for a thing
 *   a district has one of: a city has a car park per few blocks, not one.
 *
 *   THE LOW-DETAIL KIND PATH already owns a whole island. `lowDetail` does not
 *   mean "little here" — a construction site with a 40 m crane on it is a
 *   low-detail chunk — it means **the perimeter walk does not run on this
 *   island**, which is exactly and only the property a block-scale object
 *   needs. The walk lofts 11-27 m buildings along an island edge; a 64 x 32 m
 *   deck structure is not a building it can produce at any parameter.
 *
 * SO IT IS THE SECOND, and the misleading part is the name rather than the
 * mechanism. Nothing new was built to place this.
 *
 * WHERE IT GOES IS THE BRIEF'S OWN SENTENCE, MADE A NUMBER. *"A car park goes
 * at the edge of the dense core where people drive to and then walk"* — which
 * is the TOP of the low-detail band, the blocks that only just failed to be
 * built on. `RECREATION.courtBelow` is the measured p67 of that population
 * (see `RECREATION` for the 237-chunk distribution) and it is read here rather
 * than a second quantile being derived: above it you build a deck because land
 * is dear, below it the die falls through to `parking` and you lay a surface
 * lot, because it is not. **The two car parks in this file are one decision
 * about land value.**
 *
 * EVERY DIMENSION IS `DEAD_ZONE`'s OWN PARKING MODULE. A double-loaded module
 * is `bayL + aisleW + bayL` = 5.0 + 6.0 + 5.0 = 16.0 m and the surface lot
 * lays two of them; this lays two of them per deck, so the structure is
 * 32.0 m deep. The length is 26 bays of `bayW` 2.5 = 65.0 m, which is what
 * fits the 104.6 m island with the ramp and the boundary either side.
 */
export const DECK_PARK = {
  /** Decks above the ground one. 5 -> a 14.5 m box, four storeys of housing. */
  levels: 5,
  /**
   * Metres, floor to floor. A parked van's own delivered height is 2.45 m
   * (`parkVehicle`), the slab is 0.25 and the services under it 0.20, so 2.90
   * is the smallest deck a van clears — and a car park that a van cannot enter
   * is a car park with a height barrier on it, which is a different building.
   */
  storeyM: 2.90,
  /** Bays along the deck, and the two double-loaded modules across it. */
  baysLong: 26,
  modulesDeep: 2,
  /** Metres. The upstand at every open deck edge — a 1.1 m vehicle barrier. */
  upstandM: 1.10,
  /** Metres. Column pitch on the perimeter, and the column itself. */
  columnEveryM: 8.0,
  columnM: 0.44,
  /** Metres. The straight ramp up one flank, and the core at one end. */
  rampWidthM: 6.0,
  coreM: 7.0,
  /** Cars left on each deck. A car park at four in the afternoon is not empty. */
  carsPerDeck: 7,
};

/**
 * WHAT A CITY NEEDS THAT IS NOT A HOUSE — SESSION 48, TIER ONE.
 *
 * The operator's words: *"density, but not only houses: sports arenas, a
 * football stadium, parks, playgrounds, basketball courts, multi-storey car
 * parks. Everything a city needs."* Before this session every block in NOCTIS
 * was housing-shaped or empty-shaped: five building eras, five kinds of empty,
 * eight authored landmarks, and **nothing anywhere that is a pitch, a court or
 * a playground.**
 *
 * ONE KIND, THREE VARIANTS, AND THE VARIANT IS DERIVED RATHER THAN ROLLED.
 * A sixth entry in the die above would put recreation on one low-detail chunk
 * in six wherever the die fell; what LOOK.md §2's last bullet asks for is that
 * *"density has causes"*, and these three have the plainest causes in the file:
 *
 *   PLAYGROUND  belongs where people live, so it takes the DENSEST end of the
 *               low-detail band — the blocks with housing on every side.
 *   COURT       a hard court is a leftover corner: the middle of the band.
 *   PITCH       needs a whole flat block nobody built on, which is the SPARSE
 *               end and is also the only end where 60 x 40 m fits.
 *
 * THE CUTS ARE THE POPULATION'S TERCILES AND NOT THE BAND'S, AND THE FIRST ARM
 * WAS THE BAND'S AND DELIVERED SEVEN PLAYGROUNDS OUT OF SEVEN.
 *
 * The band is `[0, CITY.lowDetailThreshold)` = [0, 0.34) by construction, and
 * splitting it in thirds at 0.1133 and 0.2267 is the obvious thing to do. It is
 * also wrong, because **the band is not uniformly occupied**: a chunk is
 * low-detail because its density fell under a threshold, and the density field
 * piles up just under it. Measured over 237 low-detail chunks, twelve regions
 * of 10 x 10, seeds 1337-1348:
 *
 *     min 0.0625   p10 0.1486   p33 0.2082   median 0.2486
 *     p67 0.2879   p90 0.3197   max 0.3385
 *     split by the BAND's own thirds:   9 / 92 / 136
 *
 * So the band's thirds put 57% of the population in one bucket and 4% in
 * another, and the first arm of this delivered **seven playgrounds and no pitch
 * and no court over `citycheck`'s own region.** It is LOOK.md §3's own lesson
 * one field over — *"a band whose top touches the target delivers the target
 * never"* — with a floor instead of a ceiling.
 *
 * The cuts below are the measured p33 and p67 of the delivered population, so
 * the three variants arrive in thirds rather than in the proportions the field
 * happens to have. `recreationVariant` is the one reader.
 */
export const RECREATION = {
  /**
   * Metres. A five-a-side pitch is 40 x 20 in the laws of the game; this is
   * the next size up that still fits an island with room for the fence and the
   * run-off, and it is what a city block actually carries. The island is
   * 104.6 m, so a 60 m pitch leaves 22.3 m at each end for the ball-stop, the
   * goal run-off and the way in.
   */
  pitchLongM: 60,
  pitchShortM: 38,
  /**
   * Metres. A basketball court is 28 x 15 (FIBA). Unchanged, because unlike a
   * pitch it fits any island with room to spare and shrinking it would make it
   * a court that is not one.
   */
  courtLongM: 28,
  courtShortM: 15,
  /** Metres. The key's arc radius and the free-throw line, both FIBA. */
  courtArcM: 6.75,
  /** Metres. Goal: 3.66 x 2.13 for five-a-side, 0.12 m sections. */
  goalWidthM: 3.66,
  goalHeightM: 2.13,
  goalPostM: 0.12,
  /** Metres. Hoop: 3.05 m rim, a 1.8 x 1.05 backboard, a 1.2 m arm off the post. */
  rimHeightM: 3.05,
  boardWidthM: 1.80,
  boardHeightM: 1.05,
  boardArmM: 1.20,
  /**
   * Metres. The ball-stop fence. 4.0 m behind a goal is what stops a ball
   * reaching the carriageway 11.7 m beyond it; 2.4 m along the sides is the
   * same plywood height a hoarding uses, because it is the same panel.
   */
  netHighM: 4.0,
  netLowM: 2.4,
  fenceSegmentM: 3.0,
  fenceHalfT: 0.06,
  /** Metres. Playground: a frame deck at 1.8, a slide off it, a 1.1 m fence. */
  frameDeckM: 1.8,
  playFenceM: 1.10,
  /** Line width. The same paint every marking in this city is drawn with. */
  lineW: 0.12,
  /**
   * The two density cuts, and they are the MEASURED p33 and p67 of the
   * low-detail population rather than the thirds of the band it lives in. See
   * the note above this object for the 237-chunk distribution and for the arm
   * that used the band's thirds and delivered seven playgrounds of seven.
   */
  pitchBelow: 0.2082,
  courtBelow: 0.2879,
  /**
   * AND THE SPARSEST TENTH OF THE PITCHES GET STANDS ROUND THEM — session 48,
   * tier two's second object.
   *
   * A STADIUM IS A PITCH WITH A BOWL ROUND IT, which is why it costs almost
   * nothing to build here: the playing surface, the goals, the ball-stop and
   * the four floodlight masts are already what a `pitch` is, and the stand is a
   * ring of raked seating and an outer wall on top of them.
   *
   * WHERE, and it is the brief's own sentence: *"a stadium goes where land is
   * cheap and access is good — the periphery, not the core."* Cheap land is the
   * BOTTOM of the low-detail band, and the cut is its measured **p20** — the
   * cheapest fifth — from the same 237-chunk distribution the other two come
   * from.
   *
   * THE FIRST ARM WAS THE p10 AND IT PUT NO STADIUM IN THE WORLD. Recreation
   * is one low-detail kind in seven and low-detail is 17% of chunks, so a
   * further tenth of that is 0.24% — and at seed 1337 there was **no stadium
   * within +-12 chunks of the origin**, which is 1 536 m in every direction and
   * three times the residency ring. A thing nobody can walk to or photograph is
   * not shipped, whatever the generator says it built. At the p20 the nearest
   * is chunk (-1,-6) at density 0.1634.
   */
  stadiumBelow: 0.1867,
  /** Metres. Rake per tier and the depth of one, over three tiers. */
  tierRiseM: 3.4,
  tierDeepM: 5.2,
  tiers: 3,
};

/**
 * WHICH RECREATION A CHUNK GETS, FROM ITS OWN DENSITY. See `RECREATION`.
 *
 * The thirds of the low-detail band, and the band's own top is
 * `CITY.lowDetailThreshold`, so this cannot drift from the test that put the
 * chunk here.
 */
export function recreationVariant(density) {
  if (density < RECREATION.pitchBelow) return 'pitch';
  if (density < RECREATION.courtBelow) return 'court';
  return 'playground';
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WHEN A PLAY AREA IS IN USE — SESSION 60, ITEM 3.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The operator's item: *"He would like to see people moving on the courts and
 * pitches ... Derive the count from the time of day."*
 *
 * TWO CLOCKS ACT ON A PLAY AREA AND THEY MUST NOT BE ONE. `streetlife.js`'s
 * `crowdFactor` already scales the WHOLE awake population by the hour, so a
 * play area allocated a fixed share of that population is already emptier at
 * three in the morning — 18% of its daytime crowd, the diurnal floor. That is
 * the street's curve and it is the wrong shape for a ground: at 03:00 the
 * street's remaining 18% are night workers going home and none of them is on
 * a basketball court. So a play area carries its OWN hours on top, and what
 * the two together deliver is the count.
 *
 * THE HOURS ARE THE FLOODLIGHTS. `citygen.js` already puts four `flood` masts
 * at the corners of every play area — *"a pitch nobody can use after four
 * o'clock in winter is a lawn with lines on it"* — so the ground is usable
 * after dark by construction and the closing hour is a curfew rather than a
 * sunset. Each row below says which.
 *
 *   pitch       07 → 22   A floodlit adult pitch: booked from before work to
 *                         a late curfew. The latest of the three, because it
 *                         is the one with the biggest lighting installation.
 *   court       08 → 21   A hard court is unbooked and unsupervised, so it
 *                         closes with the light it can be seen to be used in.
 *   playground  08 → 19   The one used by children, and the only one whose
 *                         closing hour is not about light at all.
 *
 * A STADIUM TAKES THE PITCH'S ROW, because a stadium in this generator IS a
 * pitch with a bowl round it (`RECREATION.stadiumBelow`).
 */
export const PLAY_HOURS = {
  pitch: { openH: 7, closeH: 22 },
  court: { openH: 8, closeH: 21 },
  playground: { openH: 8, closeH: 19 },
};

/** The share of a play area's own population that is out at `t`. */
export function playOpen(variant, t) {
  const P = PLAY_HOURS[variant] || PLAY_HOURS.court;
  return hoursFactor(P.openH, P.closeH, t);
}

/**
 * People per m² of PLAY SURFACE when the ground is open — session 60, item 3,
 * and it is `streetlife.js`'s `PEOPLE_PER_M2` with the game as its citation
 * instead of Fruin.
 *
 * That constant is **0.06 people per m² of pavement on a busy street, against
 * Fruin's LOS A at 0.083**. A play surface needs the same kind of number and
 * cannot take that one: a pavement is a corridor everybody uses and a pitch is
 * a facility a few people use at a time.
 *
 * THE CITATION IS THE GAME THIS GENERATOR ALREADY BUILT THE GOAL FOR.
 * `RECREATION.goalWidthM` is 3.66 m, which its own comment records as
 * *"3.66 x 2.13 for five-a-side"* — so the pitch this city lays is a
 * five-a-side pitch and the population of one in use is **ten players over
 * `pitchLongM × pitchShortM` = 60 × 38 = 2 280 m² = 0.00439 people per m²**.
 * That is 7.3% of the pavement figure, which is the right order: the operator
 * asked for *"a handful per court ... this does not need a game of
 * basketball."*
 *
 * ONE DENSITY FOR ALL THREE VARIANTS, and the variants differ by their own
 * area rather than by a second table. Delivered at the shipped dimensions,
 * play area including run-off:
 *
 *     pitch        68 × 46 m = 3 128 m²   →  13.7 people
 *     court (×2)   36 × 42 m = 1 512 m²   →   6.6 people
 *     playground   42 × 34 m = 1 428 m²   →   6.3 people
 *
 * before the hours factor and before the ring's own apportionment, which is
 * what turns a wanted count into a share of the crowd that is actually there.
 */
export const PLAY_PEOPLE_PER_M2 = 10 / (RECREATION.pitchLongM * RECREATION.pitchShortM);

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
 * THE THING THAT MAKES A CHURCHYARD A CHURCHYARD — SESSION 54.
 * ===========================================================
 *
 * Session 49 built the nave and the spire, session 50 gave the ground a path
 * to the door and planting in clumps, and what was delivered was a 104.6 m
 * LAWN WITH A CHURCH ON IT — `tools/shot-out/s54-church-before-t0_5886-wet.png`
 * is the frame, and it is the operator's own word for it.
 *
 * A CHURCHYARD IS GRAVES. Everything else in the brief's list for this kind —
 * benches, lamps, gravel paths, a gate — either exists already (`bench`,
 * `planter` in the palette; `layPath`; `pathLamps` this session) or is a
 * treatment of something that does. The one thing with no representation at
 * all was the content the place is named after.
 *
 * A ROW AND NOT A SCATTER, AND THAT DECIDES WHAT IT IS. `LOW_DETAIL_PROPS`'
 * own rule: *"a thing is a `prop` if its placement is a SCATTER and a
 * `feature` if it is a RUN, a ROW or a GRID"*, and `objectCount` — which
 * `citycheck`'s clumping CV is computed from — counts props and not features.
 * Graves are laid out in rows by definition; a scatter of headstones is a
 * battlefield. So this is a `feature`, one record per ROW SEGMENT, and the
 * clumping statistic does not move.
 *
 * EVERY LENGTH IS A PLOT'S. A burial plot is 2.4 m long and about 1.2 m wide,
 * so a row of stones at the head of consecutive plots is `plotPitchM` = 1.2 m
 * along and consecutive ROWS are back to back at `rowPitchM` = 2.4 m plus a
 * 1.2 m walk between them = 3.6 m. Nothing here is chosen for the look of it.
 *
 * TWO BOXES A STONE AND THE SECOND ONE IS THE BASE, which is what makes a slab
 * read as standing rather than as painted on the grass. `city.js` draws a whole
 * segment from one record, so the geometry cost is `perSegment * 2` boxes and
 * the CLAIM cost is one.
 */
export const GRAVEYARD = {
  /** Metres. Along a row, head-to-head; and between rows, back to back plus a walk. */
  plotPitchM: 1.2,
  rowPitchM: 3.6,
  /** How many plots one claimed segment covers. A segment is 6.0 m of row. */
  perSegment: 5,
  /** Metres. The stone: width across the plot, depth, and the height band. */
  stoneW: 0.62,
  stoneD: 0.14,
  stoneMinM: 0.55,
  stoneMaxM: 1.30,
  /** Metres. The base slab under it. */
  baseW: 0.78,
  baseD: 0.36,
  baseH: 0.11,
  /**
   * Weathered limestone, and it is the PALEST reflectance on any ground
   * furniture in this city — `CITY_MATERIALS.panel` is 0.556/0.573/0.600 and
   * that is a curtain wall. A headstone reads at all because it is a light
   * object against grass at 0.085: the contrast is 5.6x, which is why the
   * operator called this *"the cheapest instanced content in the project"*.
   */
  stoneAlbedo: [0.52, 0.508, 0.472],
  baseAlbedo: [0.40, 0.392, 0.368],
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
/**
 * THE LOW WALL `city.js` DRAWS FOR AN `edge` FEATURE WITH NO NAMED TREATMENT —
 * SESSION 47, AND IT IS HERE BECAUSE A CLAIM NOW HAS TO COVER IT.
 *
 * The treatment is a course and a coping, and the coping is drawn **2% longer
 * than the segment** so that consecutive lengths read as one wall rather than
 * as a row of blocks. That 1.02 was a literal in the drawing module and the
 * claim was made in this one, which is CONTRACT §9.1 exactly — and it showed
 * up the moment the block core's boundary started claiming: the delivered
 * sweep reported a uniform **0.013 m2** of
 * `feature(edge:wall) x pavement(ground:walk)`, which is `0.03 m x 0.44 m`,
 * which is one end of one coping. One number, two readers.
 */
export const LOW_WALL = {
  courseDeepM: 0.36,
  copingDeepM: 0.44,
  /** The coping laps its neighbours by this factor of the segment length. */
  copingLongFactor: 1.02,
};

/**
 * WHAT THE LOOSE STUFF ON EACH LOW-DETAIL ISLAND IS MADE OF. Paired with
 * `DEAD_ZONE`, which says HOW MANY: a floor without a palette furnishes a
 * churchyard with containers, and a palette without a floor delivers one of
 * them. Both tables are keyed by the same `kind`, so a kind added later is
 * missing from both in the same place.
 *
 * A KIND REPEATED IN THE ARRAY IS WEIGHTED — `propRng.pick` is uniform over
 * entries, which is how `park` has read as three-quarters trees since it was
 * written.
 */
export const LOW_DETAIL_PROPS = {
  /** The five that existed before session 50, carried across UNCHANGED. */
  park: ['tree', 'tree', 'tree', 'bench', 'planter', 'bin', 'cafetable'],
  construction: ['container', 'container', 'fence', 'cabinet', 'bollard'],
  parking: ['bollard', 'bollard', 'cabinet', 'bin', 'planter', 'fence'],
  yard: ['stack', 'stack', 'stack', 'container', 'bin', 'cabinet', 'fence'],
  $default: ['fence', 'stack', 'container', 'bollard'],

  /** A playing field's margin: seating and litter, and a tree for shade. */
  recreation: ['bench', 'bench', 'bin', 'tree', 'bollard', 'cyclestand'],
  /** A deck park's apron is a car park's apron. */
  carpark: ['bollard', 'bollard', 'cabinet', 'bin', 'planter', 'fence'],
  /** A hospital forecourt: guarded edges, planting, seating for waiting. */
  hospital: ['bollard', 'planter', 'bench', 'bin', 'cabinet'],
  /** A school: trees along the boundary, seating and bins on the hard yard. */
  school: ['tree', 'tree', 'bench', 'bin', 'bollard', 'planter', 'cyclestand'],
  /** A fire station: HYDRANTS, which exist as a model and belong nowhere else
   *  in this city more than here, and the bollards that keep an apron clear. */
  firestation: ['hydrant', 'hydrant', 'bollard', 'bollard', 'bin', 'cabinet'],
  /** An estate and a depot are both works yards, and take `yard`'s own list. */
  industrial: ['stack', 'stack', 'container', 'fence', 'cabinet', 'bin'],
  depot: ['stack', 'container', 'bollard', 'cabinet', 'fence', 'bin'],
  /** A churchyard is PLANTED. Not one container, which is what it had. */
  church: ['tree', 'tree', 'tree', 'bench', 'planter', 'bollard'],
  /** A market forecourt: goods, planting and the bins a market needs. */
  market: ['stack', 'planter', 'bin', 'bench', 'bollard'],
  /** A wharf stacks to its fence line. */
  port: ['container', 'container', 'stack', 'stack', 'bollard', 'cabinet'],
};

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
   * ───────────────────────────────────────────────────────────────────────
   * SESSION 50: THE TEN KINDS SESSIONS 48 AND 49 ADDED FELL STRAIGHT BACK INTO
   * THE HOLE THE THREE ABOVE WERE LIFTED OUT OF.
   *
   * `deadZoneLaw = DEAD_ZONE[kind]` and this table held four rows, so every
   * kind added after session 40 took the `96 · d³` fall-through — and a chunk
   * is low-detail BECAUSE `density < 0.34`, which is the same field, so that
   * law cannot exceed `96 × 0.34³` = 3.8 objects and rounds to ONE below
   * `d = 0.216`. The paragraph in `citygen.js` beside `propCount` says this in
   * as many words about the previous three; nobody re-read it while adding
   * ten more. Measured over twelve regions (seeds 1337–1348), props per chunk:
   *
   *     WITH a floor          WITHOUT one
   *     yard         28.3     firestation   1.0     school      2.2
   *     park         27.8     hospital      0.5     carpark     3.0
   *     construction 17.7     recreation    1.2     industrial  4.1
   *     parking      15.5     depot         1.9     port        9.1
   *     lot          12.1     church        1.9     market     13.3
   *
   * A seven-to-twenty-eight-fold gap, and the four bottom rows are exactly the
   * four islands session 49's own frames show as bare. THE FRAMES AND THE
   * GENERATOR AGREE, which is why this is one table and not a look question.
   *
   * EVERY FLOOR BELOW IS `(104.6 / L)²` FOR A LENGTH `L` THAT BELONGS TO THE
   * KIND, which is the form the three rows above use, and the spacing it
   * implies is printed beside it. **THEY ARE DELIBERATELY UNEQUAL** — 8 to 38
   * against the existing 9 to 24. Levelling ten kinds onto one number would
   * flatten the prop-density spread `citycheck`'s clumping CV measures, and
   * that statistic has moved the right way for two sessions on VARIETY rather
   * than fill. A church is not a works yard and must not be furnished like one.
   */
  /** A PLAYING FIELD IS EMPTY BY DEFINITION — its furniture lives on the margin,
   *  one object per `36 m`: `(104.6/36)² = 8.4 → 8`, spacing 37.0 m. The
   *  sparsest floor in the table, because the pitch is the content. */
  recreation: { floor: 8, slope: 12 },
  /** A DECK PARK'S SURFACE APRON, on the same 30 m lighting square `parking`
   *  derives above: `(104.6/30)² = 12.2 → 12`, spacing 30.2 m. The decks are
   *  features; this is the loose stuff on the ground beside them. */
  carpark: { floor: 12, slope: 16 },
  /** HALF A HOSPITAL SITE IS VISITORS' PARKING, so it takes the same 30 m
   *  square: 12, spacing 30.2 m. */
  hospital: { floor: 12, slope: 16 },
  /** A SCHOOL'S FURNITURE RINGS ITS HARD PLAY AREA rather than crossing it —
   *  one per `26 m`, about the side of the yard itself: `(104.6/26)² = 16.2 →
   *  16`, spacing 26.2 m. */
  school: { floor: 16, slope: 16 },
  /** AN APRON WORKED BY 8 m APPLIANCES. Three appliance lengths is the turn a
   *  pump needs to come off the apron nose-first — `24 m`: `(104.6/24)² = 19.0
   *  → 19`, spacing 24.0 m. */
  firestation: { floor: 19, slope: 16 },
  /** AN INDUSTRIAL ESTATE IS A WORKS YARD and takes `yard`'s own 21 m van
   *  apron unchanged: 24, spacing 21.4 m. */
  industrial: { floor: 24, slope: 16 },
  /** SO IS A DEPOT — the same apron, the same 24. */
  depot: { floor: 24, slope: 16 },
  /** A CHURCHYARD IS PLANTED, not worked. One tree or bench per `18 m`, which
   *  is a crown's spread plus a path's width: `(104.6/18)² = 33.8 → 34`,
   *  spacing 17.9 m. */
  church: { floor: 34, slope: 12 },
  /** A MARKET FORECOURT IS THE BUSIEST GROUND IN THIS CITY OUTSIDE A SITE —
   *  one per `17 m`, a stall pitch and its queue: `(104.6/17)² = 37.9 → 38`,
   *  spacing 17.0 m. */
  market: { floor: 38, slope: 16 },
  /** A WHARF STACKS TO ITS FENCE LINE. A container is 12.2 m and needs a
   *  handler's width beside it — `17 m`: 38, spacing 17.0 m. */
  port: { floor: 38, slope: 16 },
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
  /**
   * Metres. A SERVICE YARD'S WORK LIGHT — session 54. Between a park lamp's
   * 4.20 m (a path) and a car park column's 10.0 m (a 30 m square), because
   * what it covers is a loading bay and a way in and not either of those.
   * `LIGHT.yardFloodCandela` is derived at this height and through its own
   * window; the two must move together and the derivation says so.
   */
  yardLightHeightM: 6.0,
};

/**
 * Metres. One bay of a boundary run on a landmark's apron.
 *
 * `DEAD_ZONE.edgeSegment` is 3.0 and this is 4.0, and the difference is the
 * SHAPE rather than the fence: an island boundary is four straight runs and
 * this is a circle approximated by chords, so a bay buys sagitta as well as
 * geometry. At the smallest radius this is used on (the dome's 33 + 2.1 m) a
 * 4.0 m chord is 6.5 degrees and 0.06 m of sagitta — under the 0.07 m
 * half-thickness of the rail itself, so the run reads as a curve and not as a
 * polygon. It is also what a railing panel and a bollard spacing both are.
 */
export const APRON_BAY_M = 4.0;

/**
 * WHAT EACH LANDMARK'S APRON IS, AND EVERY ROW IS A SENTENCE ABOUT THE THING.
 *
 * Only the four ROUND landmarks have an apron at all — see `landmarkPrecinct`
 * for why, and for the four that do not. The four rows are the four kinds of
 * place a large structure sits in, and each one is what its own `LANDMARKS`
 * entry already says it is:
 *
 *   condenser  *"260 m district heat-rejection tower"* — infrastructure. A
 *              works compound: hardstanding, a palisade, cabinets and stacks.
 *              `yardGround` is the surface `yard`, `industrial` and `port`
 *              already lay, and `palisadeHeight` is the one a yard already
 *              uses, so a plant compound in the middle of the city is built
 *              out of the same parts as one on its edge.
 *   exchange   *"a preserved 1890s exchange hall"* — a civic forecourt.
 *              `apron` paving at the pavement's own datum and reflectance,
 *              with BOLLARDS, which is what stands between a listed hall and
 *              the traffic. No railing: a forecourt you cannot walk onto is a
 *              car park.
 *   weir       *"a stormwater basin and SUNKEN PARK"*, and there has never
 *              been a park in it. The rim gets grass, trees, benches — and a
 *              RAILING, because the thing on the other side of that line is a
 *              nine-metre drop and fifty sessions have left it open.
 *   dish       *"a 58 m inverted-cone civic hall"* — the same forecourt as the
 *              exchange. Its overhang starts 32.8 m up, so its plaza is the
 *              one in this city you can stand under.
 *
 * `spacingM` IS THE `DEAD_ZONE` LENGTH FOR THE SAME KIND OF PLACE, so the
 * apron and the island it sits beside are furnished at one density: the
 * weir's 18 m is `church`'s *"a crown's spread plus a path's width"*, the two
 * forecourts' 12 m is a bollard line's own pitch, and the condenser's 21 m is
 * `industrial`'s *"`yard`'s own van apron"*.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * AND `light` IS SESSION 54's COLUMN, BECAUSE THE ROW HAD EVERY OTHER ONE.
 *
 * Session 51 gave each apron a ground, a boundary, a prop palette and a
 * furnishing density. It gave none of them a light, and nothing since has:
 * measured at seed 1337, `tools/placeprobe.mjs --light` prints all four rows
 * as `<- unlit`. So the weir's rim — *"a NINE METRE DROP and fifty sessions
 * have left it open"*, then railed in session 51 and given a staircase in
 * session 52 — is a railing, a flight of steps and a nine-metre fall with no
 * light anywhere near any of them.
 *
 * IT GOES ON THE BOUNDARY CIRCLE AND NOT IN THE MIDDLE, which is one decision
 * doing three jobs: it is where the drop is, it is where a person walking on
 * to the apron arrives, and a large paved area lit from its perimeter is one
 * you can read the extent of — lit from the centre it is a bright disc with a
 * dark rim, which is the opposite of what a forecourt is for.
 *
 * EVERY FIXTURE IS ONE THIS CITY ALREADY HAS, at its own derived pitch:
 *
 *   condenser  a works compound, so `yard`'s own work light — a 6.0 m mast at
 *              `LIGHT.yardFloodCandela`, on the 30 m module `DEAD_ZONE`
 *              derives for an open surface (`columnEvery`).
 *   exchange   a civic forecourt is a large open paved area, which is the
 *              class `carParkColumnCandela` is derived for: a 10.0 m column
 *              (`DEAD_ZONE.columnHeight`) on the same 30 m square.
 *   dish       the same forecourt, and its plaza is the one you can stand
 *              UNDER, so the columns are what light the soffit from below.
 *   weir       *"a stormwater basin and SUNKEN PARK"* — a park path, so
 *              `PARK.lampHeight` at `PARK.lampEvery`, the 4.20 m post-top and
 *              the 16 m pitch every park in this city is already lit by.
 */
/**
 * ─────────────────────────────────────────────────────────────────────────
 * AND `approach`, `portico` AND `dropOff` ARE SESSION 55's THREE COLUMNS —
 * STATE 54 §8 ITEM 3, WHICH SPECIFIED THEM AND DID NOT BUILD THEM.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The operator's own frame: *"the dome has one flight of steps at one edge,
 * two files of people crossing bare apron, no vehicle approach, no visible
 * entrance"*. Session 52 opened 4.2 m of precinct round these four and session
 * 54 lit it; nothing has ever said HOW YOU GET IN.
 *
 * **THE APPROACHES ARE ON THE FOUR CARDINAL BEARINGS AND THAT IS GEOMETRY, NOT
 * TASTE.** Every ground rectangle in this project is axis-aligned — `ground`
 * carries `{x0, z0, x1, z1}` and nothing else — so a radial at 37° would be
 * drawn as a comb of steps, which is what `landmarkPrecinct`'s own 2.1 m
 * staircase already is and is only acceptable there because it is a RESIDUE.
 * A way in is a thing you look along.
 *
 * **AND THEY ARE CLAIMED BEFORE THE BOUNDARY RUN, WHICH MAKES THE GATE FREE.**
 * `occupancy.js` forbids `feature × path`, so every railing bay whose chord
 * crosses an approach is refused by the paving — and the railing has an opening
 * exactly where an approach arrives, without either routine knowing the other
 * exists. That is the same mechanism `layPath` uses to keep a churchyard's
 * trees off its own spines.
 *
 * `portico` IS THE AMBULANCE BAY'S OWN THREE NUMBERS AND NOT A FOURTH SET.
 * STATE 54 designed *"a `canopy` feature, 16.0 × 13.0 m at 5.4 m — three car
 * lengths long, one bay plus a footway deep, and high enough for a van"*, and
 * this project already contains that object: `PROGRAM.hospBay{Long,Deep,High}M`
 * = **16 × 9 at 4.6**, a hospital's ambulance bay, described in its own comment
 * as *"a canopy a vehicle turns under"*. 16 agrees exactly. **The 13.0 is the
 * design's own arithmetic slipping — one bay (`DEAD_ZONE.bayL` = 5.0) plus a
 * footway (`CITY.sidewalkWidth` = 4.2) is 9.2 and rounds to the 9 that is
 * already here; 13.0 counts the footway twice** — and 5.4 was authored where a
 * derived 4.6 existed. A porte-cochère and an ambulance bay are one object, so
 * they are one set of numbers (§9 rule 2).
 *
 * WHO GETS WHAT, AND EACH ROW IS A SENTENCE ABOUT THE PLACE:
 *
 *   condenser  ONE approach and no portico and no drop-off. A works compound
 *              has a GATE. STATE 54 §8 said this in as many words.
 *   exchange   four approaches, a portico and a drop-off. It is a hall people
 *              arrive at, and the operator's spawn looks straight at it.
 *   dish       the same, and its plaza is the one you can stand under.
 *   weir       four approaches, no portico, no drop-off. A sunken park is
 *              entered on foot from every side and nobody is driven into it.
 *
 * `approachGround` IS THE SURFACE AND IT IS A SENTENCE TOO — and it is the
 * ONLY thing about an approach that varies, because the claim is always `path`
 * (that is what opens the railing) and the datum is always the apron's. Three
 * of the four are DRIVES and are laid in the car park's own asphalt: a hall is
 * arrived at by car and a works compound's gate is a lorry track. The weir's
 * are WALKS and take the park path's pale gravel.
 *
 * IT IS A CONTRAST DECISION AND SESSION 50 MEASURED THE RULE: *"on pale ground
 * the fixture that reads is a change of SURFACE or an object with HEIGHT, not
 * paint"*. Gravel at 0.19 on a forecourt at 0.26 is a 27% step and reads as
 * nothing; asphalt at 0.082 on the same paving is **3.2x**, which is the same
 * order as the 7.6x that makes a bay marking read at night. On the weir's
 * grass (0.062-0.094) the gravel is 2-3x by itself and needs no help.
 */
export const LANDMARK_APRON = {
  condenser: {
    ground: 'apronYard', yKey: 'apronYard',
    edge: 'palisade', edgeHeight: 2.20,
    props: ['cabinet', 'stack', 'bollard'], spacingM: 21,
    light: 'flood', lightHeightM: 6.0, lightEveryM: 30,
    approaches: 1, portico: false, dropOff: false, approachGround: 'parkingGround',
  },
  exchange: {
    ground: 'apron', yKey: 'apron',
    edge: null, edgeHeight: 0,
    props: ['bollard', 'bollard', 'planter', 'bench'], spacingM: 12,
    light: 'lamp', lightHeightM: 10.0, lightEveryM: 30,
    approaches: 4, portico: true, dropOff: true, approachGround: 'parkingGround',
  },
  weir: {
    ground: 'apronGrass', yKey: 'apronGrass',
    edge: 'railing', edgeHeight: 1.10,
    props: ['tree', 'tree', 'bench', 'bin'], spacingM: 18,
    light: 'lamp', lightHeightM: 4.2, lightEveryM: 16,
    approaches: 4, portico: false, dropOff: false, approachGround: 'path',
  },
  dish: {
    ground: 'apron', yKey: 'apron',
    edge: null, edgeHeight: 0,
    props: ['bollard', 'bollard', 'planter', 'bench'], spacingM: 12,
    light: 'lamp', lightHeightM: 10.0, lightEveryM: 30,
    approaches: 4, portico: true, dropOff: true, approachGround: 'parkingGround',
  },
};

/**
 * Metres. HALF THE WIDTH OF A LANDMARK APPROACH, and it is the portico's own
 * depth halved — `PROGRAM.hospBayDeepM / 2` = 4.5.
 *
 * A porte-cochère spans the drive it stands over, so the drive is as wide as
 * the canopy is deep and neither number is free once the other is chosen. What
 * that 9 m is made of is one set-down bay (`DEAD_ZONE.bayL` = 5.0) and one
 * footway (`CITY.sidewalkWidth` = 4.2), which is 9.2 and is the sentence
 * `PROGRAM`'s own ambulance-bay comment already carries.
 */
export const APPROACH_HALF_M = PROGRAM.hospBayDeepM / 2;

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
     * ═══════════════════════════════════════════════════════════════════════
     * AND THE THING THAT STANDS IN THE ROAD IS THE FOOTING, NOT THE LEG —
     * SESSION 46. IT IS THE OPERATOR'S SECOND DEFECT.
     * ═══════════════════════════════════════════════════════════════════════
     *
     * Every clearance in the paragraph above is measured from `pierLegHalf`,
     * and `legIsClear(leg, l.pierLegHalf)` is called *"the one predicate, so
     * the search and the gate agree"*. They do agree — about a box that is not
     * the one drawn. `city.js` builds the pier's pad as
     * `push(leg.x, footH / 2, leg.z, 2.6, footH, 2.6, p.yawDeg, albedo, 0.86)`: **2.6 m
     * square where the leg is 1.6**, which is what a footing is.
     *
     * MEASURED ON THE DELIVERED `landmark:viaduct` INSTANCE MATRICES against
     * the delivered `ground:road` rectangles, resident ring, seed 1337:
     * **7 pad footings and 3 shafts stood inside a carriageway**, the pads by
     * up to 1.04 m of running surface. `citycheck` printed `0 leg(s) on a
     * carriageway (max 0)` in the same run, because it reads the same 0.8.
     * CONTRACT §9 with a length: one number standing for two objects.
     *
     * THE VALUE IS THE DRAWN PAD AND `city.js` READS IT FROM HERE, so the
     * clearance and the geometry cannot drift apart again — the arrangement
     * `CITY.stopLineFromJunctionM` has had since session 19.
     *
     * WHAT THE CLEARANCE COSTS, SWEPT IN THE PURE GENERATOR OVER THE WHOLE
     * PIER POPULATION before anything was changed (23 piers, seed 1337):
     *
     *   clearance   hammerhead  nudged  blocked   footings in a road   worst
     *      0.80  <-      2         6       0            12            0.926 m
     *      1.00         2         6       0            12            0.680 m
     *      1.10         2         7       0            10            0.675 m
     *      1.30  <-      2         7       0             8            0.424 m
     *      1.50         3         5       4            11            3.930 m
     *      1.84         3         5       4             5            3.930 m
     *
     * **1.30 IS THE LARGEST CLEARANCE THIS DECK CAN CARRY WITH `0 blocked`**,
     * which `citycheck` asserts, and it is `pierFootM / 2` exactly — the pad
     * cleared SQUARE ON. The yawed worst case is `2.6·√2/2` = 1.838 m and the
     * sweep says it is unreachable: the leg-offset band tops out at 10.9 m and
     * four piers lose every solution. **So the residual is the yaw**, and it is
     * 0.424 m at the worst of eight legs against 0.926 m at the worst of
     * twelve.
     *
     * NOT ALSO WIDENED: the registry claim. `landmarkOccluders` boxes a leg at
     * `arc.legHalf + 0.3` = 1.10 m, which under-declares this 1.30 m pad by
     * 0.20 m — the same class of defect one level out. Widening it moves the
     * road clip and the building keep-out and therefore re-phases the city,
     * which is a change that needs its own measured arm. STATE 46 F7.
     */
    pierFootM: 2.6,
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
   * EXTRA CROSSINGS, BY WORLD X — session 56, item 3. The lattice above stays
   * exactly what it is (its indices name the built bridges and reshuffling
   * them rebuilds the river), and this list adds relief crossings at street
   * lines the lattice skips.
   *
   * WHY −256 AND ONLY −256. The operator stood at (−257, −373) — the midpoint
   * of the girder@0 ↔ arch@−512 reach, 254.6 m from one crossing and 257.4 m
   * from the other, and reported a street meeting the river and ending. −256
   * is a chunk boundary, so a north–south street already runs at it on both
   * banks; the road clip, the water claims, the walkability mask, traffic,
   * the promenade lamps and the canyon bake all consult the crossing
   * functions below and follow without edits. The reach he walked is the only
   * one inside the streamed ring whose midpoint the gate region sees; the
   * derivation for NOT halving `bridgeEvery` globally is that spacing's own
   * comment above — 512 m is a real urban river, and one relief bridge where
   * a defect was reported is a repair while 256 m everywhere is a canal.
   */
  extraCrossingsX: [-256],
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
 * The x of the crossing nearest to `x` — lattice AND extras. Session 56:
 * every consumer that used `bridgeX(bridgeIndexAt(x))` to find "the bridge
 * here" asks this instead, so an extra crossing is a crossing everywhere at
 * once rather than in the files somebody remembered.
 */
export function nearestCrossingX(x) {
  let best = bridgeX(bridgeIndexAt(x));
  for (const ex of RIVER.extraCrossingsX) {
    if (Math.abs(ex - x) < Math.abs(best - x)) best = ex;
  }
  return best;
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
  return bridgeSpecAtX(rootSeed, bridgeX(i), bridgeStructure(rootSeed, i), i);
}

/**
 * The spec for a crossing at an arbitrary street line — the lattice bridges
 * delegate here, and an EXTRA crossing computes its structure as THE ERA NOT
 * YET STANDING BETWEEN ITS TWO LATTICE NEIGHBOURS: a relief bridge is the
 * youngest span on its own reach, which is what an infill crossing in a
 * growing city is. Between girder@0 and arch@−512 that is the cable-stayed.
 */
export function bridgeSpecAtX(rootSeed, x, structure = null, i = null) {
  if (!structure) {
    const step = RIVER.bridgeEvery * CITY.chunkSize;
    const k = Math.round(x / step);
    if (Math.abs(x - bridgeX(k)) < 0.5) {
      /** A lattice crossing asked for by x keeps its own timeline identity. */
      structure = bridgeStructure(rootSeed, k);
      if (i === null) i = k;
    } else {
      const a = bridgeStructure(rootSeed, Math.floor(x / step)).name;
      const b2 = bridgeStructure(rootSeed, Math.ceil(x / step)).name;
      structure = BRIDGE_STRUCTURES.find((s) => s.name !== a && s.name !== b2) || BRIDGE_STRUCTURES[0];
    }
  }
  const e = riverEdges(x);
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

/** Crossings whose deck reaches into `[x0, x1]` — lattice and extras. */
export function bridgesTouching(rootSeed, x0, x1) {
  const step = RIVER.bridgeEvery * CITY.chunkSize;
  const out = [];
  const i0 = Math.floor(x0 / step) - 1;
  const i1 = Math.ceil(x1 / step) + 1;
  for (let i = i0; i <= i1; i++) {
    const s = bridgeSpec(rootSeed, i);
    if (s.x + s.deckHalf > x0 && s.x - s.deckHalf < x1) out.push(s);
  }
  for (const ex of RIVER.extraCrossingsX) {
    const s = bridgeSpecAtX(rootSeed, ex);
    if (s.x + s.deckHalf > x0 && s.x - s.deckHalf < x1) out.push(s);
  }
  return out;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IS MOORED ON THE RIVER — SESSION 57, ITEM 1(f).
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The river has had quays since session 15, a promenade with lamps since 16,
 * three crossings since 56 — and nothing has ever floated on it. A working
 * river is not water with walls: it is water with WORK on it, and the cheapest
 * true statement of that is a moored craft against the bank.
 *
 * WHERE THEY GO IS DERIVED FROM WHAT THE RIVER ALREADY KNOWS:
 *   - against the BANK, never in the channel. A craft moors where the wall is,
 *     so its outboard edge sits `berthOffM` off the wall face and the channel
 *     between the two mooring lines stays clear — which is also what makes the
 *     water still read as navigable rather than as a car park.
 *   - never under a crossing. `onBridgeDeck` is the same predicate the road
 *     clip, the walkability mask and the promenade lamps use, padded by the
 *     craft's own half-length, so a barge cannot be moored inside a bridge.
 *   - on a lattice of `everyM`, jittered inside its own cell, so the spacing
 *     reads as moorings taken up rather than as a fence of boats.
 *
 * THE STREAM IS ITS OWN (`chunkRng(rootSeed, k, 0, 'craft')`, keyed on the
 * berth index) so a craft's existence cannot move a building, a prop or a
 * bridge — CONTRACT §6, and the same arrangement `bridgeStructure` uses to
 * stay deterministic in `(rootSeed, i)` alone.
 */
export const RIVER_CRAFT = {
  /** Metres between berths along one bank. About four to a 1 024 m window. */
  everyM: 240,
  /** Metres from the wall face to the craft's inboard side. A fender's worth. */
  berthOffM: 1.1,
  /** p(a berth is occupied). A river with every berth full is a dock. */
  occupiedP: 0.62,
  /** Hull, in metres. A European Class I barge is 38.5 x 5.05; this is under it. */
  bargeLongM: [24, 34],
  bargeWideM: [4.6, 6.0],
  /** Freeboard: how much hull stands above the water, laden. */
  freeboardM: 0.75,
  /** The small end of the fleet — a workboat or a tender. */
  launchLongM: [7.0, 10.0],
  launchWideM: [2.4, 3.1],
};

/**
 * The craft moored between `x0` and `x1`. Pure in `(rootSeed, x0, x1)`; the
 * berth index is global so two overlapping windows agree about every berth,
 * which is the property `riverBankStations` exists for one object down.
 */
export function riverCraft(rootSeed, x0, x1) {
  const C = RIVER_CRAFT;
  const out = [];
  const i0 = Math.floor(x0 / C.everyM) - 1;
  const i1 = Math.ceil(x1 / C.everyM) + 1;
  for (let k = i0; k <= i1; k++) {
    for (const bank of [-1, 1]) {
      const rng = chunkRng(rootSeed, k, bank, 'craft');
      if (!rng.chance(C.occupiedP)) continue;
      const launch = rng.chance(0.28);
      const long = launch ? rng.range(...C.launchLongM) : rng.range(...C.bargeLongM);
      const wide = launch ? rng.range(...C.launchWideM) : rng.range(...C.bargeWideM);
      const x = k * C.everyM + rng.range(-C.everyM * 0.3, C.everyM * 0.3);
      if (x + long / 2 < x0 || x - long / 2 > x1) continue;
      /** Padded by its own half-length: a berth is not a bridge. */
      const e = riverEdges(x);
      const z = bank < 0
        ? e.north + RIVER_CRAFT.berthOffM + wide / 2
        : e.south - RIVER_CRAFT.berthOffM - wide / 2;
      if (onBridgeDeck(rootSeed, x, z, long / 2 + 6)) continue;
      out.push({
        x, z, bank, long, wide, launch,
        /** Along the bank, and the bank turns: the local tangent, as the wall does. */
        yawDeg: (-Math.atan2(
          (bank < 0 ? riverEdges(x + 4).north - riverEdges(x - 4).north
            : riverEdges(x + 4).south - riverEdges(x - 4).south), 8
        ) * 180) / Math.PI,
        tone: rng.range(0.7, 1.15),
        cabinAft: rng.chance(0.75),
      });
    }
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
  const s = bridgeSpecAtX(rootSeed, nearestCrossingX(x));
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
     * AND A LAMP ON THE NORTH–SOUTH CARRIAGEWAY IS THE SAME MISTAKE WITHOUT A
     * BRIDGE OVER IT — SESSION 46. The bank lattice is stepped every
     * `RIVER.bankStationM` and knows nothing about the road grid, so a station
     * that lands on a chunk boundary lands on the centreline of a north–south
     * road. Measured on the delivered columns against the delivered
     * `ground:road` rectangles at seed 1337: **3 promenade columns stood in a
     * carriageway**, at x = −128, +128 and +256 — three chunk boundaries
     * exactly. Same clearance the road lamps use at a junction.
     */
    const toGrid = Math.abs(st.x - Math.round(st.x / CITY.chunkSize) * CITY.chunkSize);
    if (toGrid < CITY.roadHalfWidth + PROMENADE_LAMP_SETBACK_M) continue;
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
      /**
       * WHICH WAY THE ARM POINTS — CORRECTED IN SESSION 46, AND THE SENTENCE
       * IT REPLACES WAS WRONG ABOUT THE ROTATION ITSELF.
       *
       * It read: *"`rot` 90 puts the arm in −z — that is what the axis-'z' road
       * lamp does."* Neither half is true. three's rotation about +Y takes a
       * local `(x, z)` to `(x·cos + z·sin, −x·sin + z·cos)`, and the bracket
       * tip is at local `(−ARM, 0)`, so **yaw +90 puts the tip at z + ARM**.
       * The road lamp it cites had the same defect and is repaired in the same
       * session (`city.js`, `lampStationsFor`'s caller). Measured on the
       * delivered matrices, the promenade's own columns read a median arm
       * tip-to-bowl distance of **4.19 m** against an arm 2.1 m long.
       *
       * AND THE HEAD IS THE ARM'S TIP NOW, not a second expression for it.
       * `headX: st.x` ignored `tangentDeg` altogether, so even with the sign
       * right the head sat up to `ARM·(1 − cos θ)` off the bracket wherever the
       * bank turns. One derivation, two readers.
       */
      const rotDeg = (bank < 0 ? -90 : 90) + tangentDeg;
      const armA = (rotDeg * Math.PI) / 180;
      out.push({
        x: st.x,
        z,
        bank,
        rotDeg,
        headX: st.x - PROMENADE_LAMP_ARM_M * Math.cos(armA),
        headZ: z + PROMENADE_LAMP_ARM_M * Math.sin(armA),
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
    case 'arch': {
      // The two legs. The span between them is open, which is the point of an
      // arch and the reason it does not read as a wall in the field.
      const legs = [
        box(l.x - l.span / 2, l.z, l.thickness, l.thickness, l.height * 0.72),
        box(l.x + l.span / 2, l.z, l.thickness, l.thickness, l.height * 0.72),
      ];
      /**
       * ═══════════════════════════════════════════════════════════════════════
       * AND THE DECK THE ARCH IS CARRYING WAS CLAIMED BY NOBODY — SESSION 47.
       * ═══════════════════════════════════════════════════════════════════════
       *
       * `LANDMARKS` describes this thing as *"a 96 m parabolic arch carrying
       * the transit deck across the arterial"*, and `city.js` builds that deck:
       * `push(l.x, l.height + 3.2, l.z, l.span * 0.92, 1.4, l.thickness * 1.7)`
       * — **108.6 × 12.75 m of structure at 98.5 to 99.9 m**, plus nine
       * hangers down to the arc. This list had two legs in it and nothing else,
       * so `emitcensus` measured the deck at **997.93 m² with no solid claim
       * over it at any height, reaching 47.53 m past the nearest one**.
       *
       * IT IS EXACTLY SESSION 23's VIADUCT END MASS, one landmark over. The
       * viaduct's deck segments carry `deck: true` and became `kind: 'deck'`
       * claims in session 34; the arch's deck was never in the list at all, so
       * neither half of the two-sided check has ever known it is there.
       *
       * `deck` AND NOT `landmark`, which is the split the viaduct's own note
       * three cases down already writes out: `deck` conflicts with `building`
       * alone and the test is on `[y0, y1]`, so a 150 m tower under this thing
       * is refused and a 40 m one is not — which is what a bridge 99 m up
       * means. A `landmark` claim would take the arterial it crosses out of the
       * road network, which is the opposite of what an arch is for.
       *
       * `base` IS THE HANGERS' OWN FOOT and not the deck soffit. The nine
       * hangers run from the deck down to the parabola, so the lowest structure
       * in this footprint is the arc at the span's ends — `height · (1 − 1²)`
       * = 0 at the very ends, but the hangers only reach `±0.43·span`, where
       * the parabola is at `height · (1 − 0.86²)` = 0.26·height. Taking that as
       * the base claims the hangers and leaves the opening under them open.
       *
       * COST, measured by `emitcensus` before it was written: **0 new forbidden
       * pairs** for the deck and 0 for the hangers.
       */
      const deckHalfX = (l.span * 0.92) / 2;
      const deckHalfZ = (l.thickness * 1.7) / 2;
      const deckY = l.height + 3.2;
      legs.push({
        ...box(l.x, l.z, deckHalfX, deckHalfZ, deckY + 0.7),
        base: l.height * (1 - Math.pow(0.86, 2)),
        deck: true,
      });
      return legs;
    }
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
        /**
         * THE PAD, NOT THE LEG — session 46. `l.pierFootM / 2` is the drawn
         * footing's half-width square on; see that constant for the sweep that
         * chose it and for why the yawed 1.838 m is not reachable.
         */
        if (legIsClear(leg, Math.max(l.pierLegHalf, l.pierFootM / 2))) return leg;
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
    /**
     * A DECK STOPS NOBODY, AND SESSION 47 IS THE FIRST SESSION IN WHICH A
     * NON-VIADUCT LANDMARK HAS ONE. This function's own header says a viaduct
     * is *"the first structure in this city that a person walks UNDER, so the
     * two answers separate"* — and then the split was implemented as
     * `kind === 'viaduct'` rather than as `o.deck`, which is the same mistake
     * one level down: a KIND standing in for a PROPERTY. The arch now carries a
     * transit deck at 99 m, so without this line its 108.6 x 12.75 m soffit
     * would wall off the arterial it was built to cross, in the walkability
     * flood fill and in every prop test that reads this list.
     * `landmarkGroundClaims` two hundred lines down has tested `o.deck` since
     * session 34; this is the same test, in the second of the three readers.
     */
    return landmarkOccluders(l).filter((o) => !o.deck).map((o) => ({
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
  /**
   * ONE FOOTWAY, AND ONLY ROUND — SESSION 52. `landmarkClaimMargin` is 4.2 m
   * for the four round landmarks and 0 for the other four, so every box below
   * is the same box it was for a ziggurat, an arch, a viaduct leg and a mast.
   * See `LANDMARK_SETBACK_M` for the whole derivation.
   */
  const m = landmarkClaimMargin(l);
  for (const o of landmarkOccluders(l)) {
    // A deck flies over the street rather than standing in it, and a viaduct's
    // ground contact is its legs — both handled below.
    if (o.deck || l.kind === 'viaduct') continue;
    // The GROUND extent — the plan silhouette. Session 42; see the header of
    // `landmarkOccluders` for the three landmarks this moved and by how much.
    out.push({ x0: o.gx0 - m, x1: o.gx1 + m, z0: o.gz0 - m, z1: o.gz1 + m, y0: 0, y1: o.top, owner: l.name });
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
    // `landmarkAABB` already carries the session-52 margin for a round
    // landmark, and a basin is round, so `a` is the grown claim.
    out.push({ x0: a.x0, x1: a.x1, z0: a.z0, z1: a.z1, y0, y1: l.height, owner: l.name });
  }
  landmarkGroundClaimCache.set(l, out);
  return out;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE GROUND A LANDMARK'S CLAIM TAKES AND THE LANDMARK DOES NOT STAND ON.
 * SESSION 51, AND IT IS ONE SENTENCE: **A CLAIM IS A RECTANGLE AND FOUR OF
 * THE EIGHT LANDMARKS ARE ROUND.**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WHAT THE OPERATOR PHOTOGRAPHED, AND IT IS NOT THE HYPOTHESIS HE OFFERED.
 * The session-51 brief supposed that the registry was still using the canyon
 * bake's AREA-INSCRIBED boxes as the ground keep-out, so that a round
 * landmark's edge would lie outside its own claim by construction — session
 * 35 measured the dish at delivered 88 x 88 m against a 62 x 62 m keep-out, a
 * ratio of 2.041. **That was repaired in session 42** and the repair holds:
 * `landmarkOccluders` carries `gx0..gz1` beside `x0..z1`, the ground extent is
 * CIRCUMSCRIBED where the bake extent is inscribed, and `landmarkGroundClaims`
 * reads the `g` fields. Re-measured this session with `tools/landmarkcensus.mjs`:
 *
 *     landmark    claim AABB    delivered      del/claim
 *     stack        79 x 79       78.8 x 78.8     0.993
 *     arch        133 x 15      124.5 x 12.8     0.795
 *     viaduct     109 x 445     110.2 x 448.0    1.016   legs claimed, deck delivered
 *     exchange     66 x 66       66.0 x 66.0     1.000
 *     weir        210 x 210     210.0 x 210.0    1.000
 *     mast         15 x 15       12.0 x 11.7     0.597
 *     dish         88 x 88       88.0 x 88.0     1.000
 *
 * **NOT ONE LANDMARK EXCEEDS ITS CLAIM.** The dish reads 1.000 where session
 * 35 read 2.041. So there is nothing to make bigger, and the defect is one
 * level further in — which `landmarkcensus` has been printing under its own
 * table for six sessions and nobody read:
 *
 *   > `del/claim` is delivered BOUNDING BOX over claim AABB, so it is 1.000
 *   > for a structure that exactly fills its keep-out WHATEVER ITS SHAPE — a
 *   > round one reads 1.000 and still leaves 1 - pi/4 = 21.5% of the claim in
 *   > the corners.
 *
 * THOSE CORNERS ARE THE DEFECT AND THEY ARE MEASURED. `tools/surfacegrid.mjs`
 * samples `city.worldSurfaceAt` — the player's own query — over the resident
 * ring: **the weir's four corners are 0.88 ha of bare earth, 30.4% of every
 * square metre in the city where a person can stand on no surface at all**,
 * in four patches each 84 x 84 m. The weir's claim is 210 x 210 = 44 100 m²
 * and its bowl is a 210 m CIRCLE = 34 636 m². The difference is 9 464 m²,
 * which is the number `landmarkGroundClaims`' own header has carried since
 * session 34 as a disagreement between two predicates. It is not a
 * disagreement. It is a place.
 *
 * WHY IT WAS DRAWN AS NOTHING. `landmark` forbids `carriageway`, `pavement`,
 * `path`, `prop`, `canopy`, `sign`, `site` and `feature` — every surface this
 * city can lay and every object it can stand on one. So the corner of a round
 * landmark's claim is ground that has been spoken for by a thing that is not
 * there, and no generator in the project is permitted to put anything in it.
 * The 8 km earth plane shows through, and that is what he stood on.
 *
 * THE SPLIT. This returns the part of the claim the landmark does NOT cover;
 * `generateChunk` claims that part `precinct` and the rest `landmark`, so the
 * UNION is bit-for-bit the claim that was there before. `precinct` forbids
 * `building` and `carriageway`, which are the two readers the claim was
 * written for, so the road network and the building population do not move —
 * and it permits a surface, its furniture and its planting, which is what a
 * forecourt is.
 *
 * A STAIRCASE PER QUADRANT, AND IT OVER-STATES THE CIRCLE ON PURPOSE. Each
 * step's inner edge takes the circle's half-width at the step's INNER
 * coordinate, so every box is strictly outside the circle. Under-stating
 * would put a surface a few metres INSIDE the rim — over a nine-metre hole,
 * at the weir — which is the failure mode `block.js`'s own earth-plane
 * comment is about (*"a plane above water hides water"*). Over-stating leaves
 * a thin residue of earth at the step corners instead, and residue that a
 * later session can measure is the safe direction.
 *
 * THE STEP COUNT IS DERIVED FROM THE LANDMARK AND THE STEP SIZE IS MEASURED.
 * `N = ceil(r / APRON_STEP_M)` per quadrant, and what a step buys is the
 * share of the true corner area the staircase covers — the rest is the
 * residue of earth at the step corners. Swept over the four round landmarks:
 *
 *     step    boxes    condenser   exchange   weir    dish
 *     4.2 m     200      86.8%       76.5%    91.7%   82.4%
 *     2.1 m     408      92.9%       87.3%    95.7%   90.2%
 *     1.4 m     620      95.2%       91.2%    97.1%   93.3%
 *
 * **2.1 m, which is HALF a footway.** The first row is the footway itself and
 * it leaves a quarter of the dome's corner bare; the third doubles the boxes
 * again for four more points. Half a footway is also the width at which a
 * step stops being something you could walk along and starts being a curve,
 * which is the visual half of the same choice.
 *
 * ONLY THE ROUND ONES HAVE A PRECINCT, AND THE OTHER FOUR ARE SAID RATHER
 * THAN OMITTED. The ziggurat's claim is its own turned plan silhouette, the
 * arch's and the viaduct's are their legs, the mast's is a lattice bound —
 * all boxes, all filling their claims, all `del/claim` at or below 1.000 for
 * a reason that is not roundness. `landmarkPrecinct` returns `[]` for them
 * and `generateChunk` claims `landmark` over the whole box exactly as before.
 * The 0.04 ha `surfacegrid` attributes to `landmark:viaduct` — two 14 x 14 m
 * pads at the deck's two end treatments — is NOT closed by this and is
 * recorded in STATE rather than swept in here.
 */
export const APRON_STEP_M = CITY.sidewalkWidth / 2;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ONE FOOTWAY OF SETBACK ROUND A ROUND LANDMARK — SESSION 52, AND IT IS THE
 * REPAIR STATE 51 §3.2 NAMED AND DID NOT REACH.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * SESSION 51 DELIVERED THE FORECOURT AND NOT THE BOUNDARY AGAINST THE STREET,
 * AND THE GEOMETRY SAYS WHY IN ONE SENTENCE: **a circle inscribed in its own
 * square claim TOUCHES that square at the midpoint of each side.** So the
 * precinct — the claim minus the silhouette — is 21.5% of the claim at 45°
 * and **exactly zero at 0° and 90°, which is where the streets are.** The
 * corners got a plaza; the four places a street actually arrives got nothing.
 * Measured then: the nearest carriageway comes within **0.02 m** of the
 * exchange's 33 m drum, at (121, −143). Not because the dome exceeds its claim
 * — `landmarkcensus` reads del/claim 1.000 — but because **the claim IS the
 * plan silhouette exactly, with no setback in it.** Every other object in this
 * city stands behind a kerb; a landmark stood with its wall in the gutter.
 *
 * SO THE CLAIM GROWS BY ONE FOOTWAY ALL THE WAY ROUND, and the precinct
 * becomes the claim minus the SILHOUETTE rather than the corners of it.
 * `CITY.sidewalkWidth` = 4.2 m, and it is not a new number: it is the width of
 * every pavement in this city, it is what `BUILDING_SETBACKS` already gives a
 * landmark, and it is what `CORRIDOR` is made of. A landmark now stands the
 * same distance behind the kerb line as a building does.
 *
 * WHAT IT IS WORTH, per landmark, as the precinct area a surface can be laid
 * on — the claim square minus the circle, at r and at r + 4.2:
 *
 *     landmark    r      21.5% of claim    claim minus circle    ratio
 *     condenser   62      3 300 m2           5 454 m2            1.65x
 *     exchange    33        935 m2           2 114 m2            2.26x
 *     weir       105      9 464 m2          13 062 m2            1.38x
 *     dish        44      1 662 m2           3 211 m2            1.93x
 *
 * AND THE PART THAT IS NOT AN AREA: at 0° the precinct goes from **0.00 m to
 * 4.20 m wide**. That is the whole item. A forecourt that is 21.5% of the
 * claim at the corners and nothing at all where the street meets it is not a
 * forecourt, it is four triangles of leftover.
 *
 * ONLY THE ROUND FOUR. The ziggurat's claim is its own turned plan silhouette,
 * the arch's and the viaduct's are their legs, the mast's is a lattice bound —
 * all boxes, all filling their claims. A margin round those would take
 * carriageway and give nothing back, because there is no corner to stand in:
 * a box claim already meets its street at a straight line. `landmarkPrecinct`
 * returns `[]` for them and so does this.
 *
 * IT IS THE SAFE DIRECTION AND THAT IS WHY IT NEEDS NO NEW PERMISSION. A claim
 * that grows can only refuse more; the registry keeps absolute authority and
 * every refusal is a road or a building that does not get built. What it costs
 * is counted rather than assumed — see STATE 52 §1.
 *
 * NOT GROWN: `landmarkGroundBlockers`, which is what stops a PERSON, and
 * `landmarkBlocks`, which is what a prop tests against. Both answer "does the
 * structure stand here" and the structure has not moved. Growing them would
 * wall off the very apron this exists to make walkable — CONTRACT §9 row 13's
 * one-list-two-questions, which this file has paid for twice.
 */
export const LANDMARK_SETBACK_M = CITY.sidewalkWidth;

/** The radius of a landmark's plan silhouette at grade, or 0 if it is not round. */
export function landmarkGroundRadius(l) {
  switch (l.kind) {
    // The profile flares to `radiusBase` at the ground and to `radiusTop` at
    // the crown, and `radiusBase` is the larger for the one hyperboloid there
    // is — 62 against 46. `Math.max` rather than `radiusBase`, because a claim
    // is the PLAN silhouette and the plan silhouette of a flared crown is the
    // crown.
    case 'hyperboloid': return Math.max(l.radiusBase, l.radiusTop);
    case 'dome': return l.radius;
    case 'basin': return l.radius;
    /**
     * THE CONE'S GROUND CONTACT IS `radiusBase` = 13 AND ITS PLAN SILHOUETTE
     * IS `radiusTop` = 44, AND THE SILHOUETTE IS THE RIGHT ONE HERE.
     *
     * This function decides what a SURFACE may be laid under, and the answer
     * is governed by what a look down sees rather than by what touches the
     * ground: the overhang starts about 32.8 m up, so the 7 213 m² between
     * the two radii is roofed. Paving it would be paving the inside of a
     * building. The precinct is therefore the claim minus the 88 m circle,
     * the same as for the other three, and the ground under the overhang
     * stays the landmark's own.
     */
    case 'cone': return l.radiusTop;
    default: return 0;
  }
}

/**
 * The half-width of a landmark's GROUND CLAIM: its plan silhouette plus
 * `LANDMARK_SETBACK_M` for a round one, and 0 for everything else — a box
 * landmark's claim is its own boxes and this function has nothing to say
 * about it.
 */
export function landmarkClaimHalf(l) {
  const r = landmarkGroundRadius(l);
  return r > 0 ? r + LANDMARK_SETBACK_M : 0;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * IS THIS POINT ON A LANDMARK'S APPROACH — A PURE PREDICATE, SESSION 55.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `latticeCorridor`'s shape, and it exists for the same reason session 52
 * built that one: a CHUNK SEAM. `citycheck` pools every chunk's claims, so it
 * compares an approach laid by one chunk against a prop scattered by the next
 * — and neither generator's registry has heard of the other. It found
 * `path(exchange:approach) x prop(bench)` at 0.287 m² on the first run of this
 * content and again on the second, because the first repair guarded only the
 * APRON's own scatter and the bench came from the island's.
 *
 * **THE GUARD IS THE SENTENCE RATHER THAN THE SEAM**, which is session 52's own
 * rule written down: *a scatter does not furnish a landmark's drive.* This
 * reads nothing but `LANDMARKS`, `LANDMARK_APRON` and the point, so it is the
 * same answer in every chunk in every order, and the two can no longer choose
 * the same square metre.
 *
 * Conservative on purpose: it is the WHOLE corridor a landmark is allowed to
 * look along, including the part the carriageway and the solids cut away.
 * Over-refusing a bench costs a bench; under-refusing one costs a forbidden
 * overlap, and this project has three of those it did not choose.
 */
export function inLandmarkApproach(x, z, pad = 0) {
  for (const l of LANDMARKS) {
    const spec = LANDMARK_APRON[l.name];
    if (!spec || !spec.approaches) continue;
    const outer = landmarkClaimHalf(l) + PROGRAM.hospBayLongM + pad;
    const hw = APPROACH_HALF_M + pad;
    const ax = x - l.x;
    const az = z - l.z;
    if (Math.abs(ax) > outer || Math.abs(az) > outer) continue;
    for (const [ux, uz] of [[1, 0], [-1, 0], [0, 1], [0, -1]].slice(0, spec.approaches)) {
      const along = ux !== 0 ? ax * ux : az * uz;
      const across = ux !== 0 ? Math.abs(az) : Math.abs(ax);
      if (along >= -pad && along <= outer && across <= hw) return true;
    }
  }
  return false;
}

/** Metres a round landmark's ground claim is dilated by. 0 for the other four. */
export function landmarkClaimMargin(l) {
  return landmarkGroundRadius(l) > 0 ? LANDMARK_SETBACK_M : 0;
}

const landmarkPrecinctCache = new Map();

export function landmarkPrecinct(l) {
  const hit = landmarkPrecinctCache.get(l);
  if (hit) return hit;
  const out = [];
  const r = landmarkGroundRadius(l);
  /**
   * `R` IS THE CLAIM AND `r` IS THE SILHOUETTE, AND UNTIL SESSION 52 THEY WERE
   * ONE NUMBER. The staircase runs out to R and its inner edge takes the
   * circle's half-width at radius `r`; past `a0 = r` that half-width is zero
   * and the step is the full depth of the claim, which is the 4.2 m band at 0°
   * and 90° that the whole item is about. `Math.max(0, ...)` under the square
   * root was already there for the rounding at a0 = r and now carries the
   * band as well.
   */
  const R = landmarkClaimHalf(l);
  if (r > 0) {
    const n = Math.max(2, Math.ceil(R / APRON_STEP_M));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        for (let k = 0; k < n; k++) {
          // The step spans [a0, a1] in |x|; the circle's half-height over that
          // span is largest at a0, so a0 is what keeps the box outside it.
          const a0 = (R * k) / n;
          const a1 = (R * (k + 1)) / n;
          const c = Math.sqrt(Math.max(0, r * r - a0 * a0));
          if (R - c < MIN_GROUND_PIECE_M || a1 - a0 < MIN_GROUND_PIECE_M) continue;
          const x0 = l.x + (sx < 0 ? -a1 : a0);
          const x1 = l.x + (sx < 0 ? -a0 : a1);
          const z0 = l.z + (sz < 0 ? -R : c);
          const z1 = l.z + (sz < 0 ? -c : R);
          out.push({ x0, x1, z0, z1, owner: `${l.name}:precinct` });
        }
      }
    }
  }
  landmarkPrecinctCache.set(l, out);
  return out;
}

const landmarkClaimPartCache = new Map();

/**
 * THE CLAIM, SPLIT, AS ONE LIST — AND IT HAS TWO READERS THAT MUST NOT
 * DISAGREE.
 *
 * `generateChunk` writes these into the keep-out registry and `city.js` writes
 * them into the DELIVERED census, which is the two-sided check CONTRACT §9.1
 * is about. Session 34's own comment beside the second of those readers says
 * what happens when they drift:
 *
 *   > *"the two halves of the project's two-sided occupancy check have been
 *   > describing two different worlds ... A two-sided check whose second side
 *   > is blind passes exactly as long as the first side never fails."*
 *
 * It happened again in this session, in the first arm, and the sweep printed
 * it: the generator's `landmark` claim shrank to the dish's circle while the
 * delivered census still claimed its 88 x 88 m rectangle, so the apron's own
 * bollards and planters — standing on ground the generator had just declared
 * free — came back as `landmark(dish) x prop(bollard)`. One function, two
 * readers, and the split cannot drift.
 *
 * `precinct` FIRST, so that it is the lower index in every registry bucket and
 * `conflict` returns it before the pieces — see the call site in
 * `generateChunk` for the two buildings that cost.
 */
export function landmarkClaimParts(l) {
  const hit = landmarkClaimPartCache.get(l);
  if (hit) return hit;
  const precinct = landmarkPrecinct(l);
  const out = [];
  for (const g of landmarkGroundClaims(l)) {
    if (!precinct.length) {
      out.push({ kind: 'landmark', x0: g.x0, x1: g.x1, z0: g.z0, z1: g.z1, y0: g.y0, y1: g.y1, owner: g.owner, tested: g.tested });
      continue;
    }
    out.push({
      kind: 'precinct', x0: g.x0, x1: g.x1, z0: g.z0, z1: g.z1,
      y0: 0, y1: g.y1, owner: `${g.owner}:precinct`, tested: g.tested,
    });
    for (const part of subtractBoxes([{ x0: g.x0, x1: g.x1, z0: g.z0, z1: g.z1 }], precinct, 0)) {
      out.push({
        kind: 'landmark', x0: part.x0, x1: part.x1, z0: part.z0, z1: part.z1,
        y0: g.y0, y1: g.y1, owner: g.owner, tested: g.tested,
      });
    }
  }
  landmarkClaimPartCache.set(l, out);
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
 * THE BUFFER STOP — SESSION 56, AND IT IS ONE CONSTANT BECAUSE TWO FILES READ
 * IT. `city.js` stands the buffer `setInM` inside the abutment's inner face
 * (the deck's last station), and `moving.js` derives the end stop so the nose
 * halts `standOffM` short of the beam. Before this the nose tip stopped at
 * s = 240.00 exactly — touching the portal's recess plane — which was the
 * clamp doing what it said while the end treatment said "through line".
 * 1.5 m is a friction buffer's own footprint on the rails it grips; 0.6 m is
 * the stopping mark a driver is given at a real terminus, and both are
 * bounds a delivered frame can check by eye.
 */
export const VIADUCT_BUFFER_M = { setInM: 1.5, standOffM: 0.6 };

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
  /**
   * THE TERMINI — SESSION 56. Where the line ENDS there was a portal head, a
   * recess pretending the line continues, and a train visibly reversing at
   * it every cycle. A terminus is platforms at the end of the track, and the
   * station vocabulary already knows how to build platforms, canopies and
   * stair cores — so each end gets one entry, placed from the DECK'S OWN
   * LAST STATION rather than from the train's stopping point: the platform
   * runs back from the abutment, and the train (whose stop moving.js derives
   * from its own extent) stands along it by construction, nose at the
   * buffer. `terminus: true` is read by moving.js so the stop list does not
   * gain a near-duplicate of the end stop it already carries, and the stair
   * cores flip INBOARD — a core placed toward the end would stand in the
   * portal.
   */
  const endS = arc.stations[arc.stations.length - 1].s;
  const entries = VIADUCT_STATION.atS.map((s) => ({ atS: s, endSgn: 0, terminus: false }));
  for (const sgn of [-1, 1]) {
    entries.push({ atS: sgn * (endS - VIADUCT_STATION.halfLengthM), endSgn: sgn, terminus: true });
  }
  for (const entry of entries) {
    const { atS, terminus } = entry;
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
      /** A terminus core points inboard: toward the end it stands in the portal. */
      const s = terminus ? -entry.endSgn * VIADUCT_STATION.coreS : VIADUCT_STATION.coreS;
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
      atS, centre, segs, terminus,
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
  /**
   * THE SESSION-52 SETBACK IS IN HERE TOO, AND IT HAS TO BE. This box is the
   * fast reject for `landmarkOccupies`, which then tests
   * `landmarkGroundClaims` — so a bound that did not carry the margin would
   * reject points the claims accept, which is the same shape of defect session
   * 42 fixed by moving this off the inscribed bake boxes. It is also what
   * `landmarksTouching` reads, and a chunk 4.2 m outside a landmark now has an
   * apron in it.
   */
  const m = landmarkClaimMargin(l);
  let box;
  if (!boxes.length) {
    // A basin occludes nothing above grade, but it is still 210 m of ground you
    // cannot build on.
    const r = landmarkFootprint(l) / 2 + m;
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
    box = { x0: x0 - m, x1: x1 + m, z0: z0 - m, z1: z1 + m };
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
    // Ground extents — "does a landmark stand here" is a ground question, and a
    // DECK is the one box in this list that answers it `no` however wide it is.
    // Session 47, the third reader; see `landmarkGroundBlockers`. It matters for
    // the viaduct too and always did — 352 deck segments — and was invisible
    // because this spelling has no callers left (STATE 34 §11).
    if (b.deck) continue;
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

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * IS THIS A PLACE THE LATTICE HAS A ROAD AND THE ORIGIN BLOCK DOES NOT —
 * SESSION 51, AND IT IS `riverNoRoad` AND `landmarkOccupies` ONE KEEP-OUT OVER.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `traffic.js` refuses a lane the river took (`riverNoRoad`, session 15) and
 * a lane a landmark took (`landmarkOccupies`, session 34). It has never had
 * the third sentence, because `insideKeepout` was module-private and exported
 * to nobody: **the fleet has driven the origin block's keep-out since session
 * 4b with no test at all.**
 *
 * MEASURED, off `city.worldSurfaceAt` — the player's own query — on the
 * driving lanes themselves, seed 1337, over |t| <= 60 m at 1 m:
 *
 *     lane            road   ground   walk    not a carriageway
 *     x = +128 NS       45      68       8        76 of 121
 *     x = -128 NS       45      68       8        76 of 121
 *     x =    0 NS      121       0       0         0 of 121
 *     z =    0 EW      121       0       0         0 of 121
 *
 * So it is **two lattice lines and about 76 m each**: `BLOCK_KEEPOUT` clips
 * the lattice's carriageway out of a 336 x 92 m rectangle and `block.js` paves
 * exactly two lines through it — its main street on z = 0 and its cross street
 * on x = 0. Both are lattice lines, which is why nobody noticed: the two the
 * block DOES pave are the two the eye is always on.
 *
 * And session 51 made it worse before it made it better. Those 68 m used to be
 * the earth plane, which is 84% of asphalt's albedo and reads as a wide pale
 * road; they are now the block's own core surface, so what a frame shows is a
 * van driving across a service court.
 *
 * THE HALF-WIDTH IS `CITY.roadHalfWidth` FOR BOTH STREETS AND THAT IS THE
 * FILE'S OWN SENTENCE: it is 7.5 and its comment says *"Matches
 * BLOCK.streetWidth so the origin block's street continues"*. The cross street
 * is 13 m rather than 15, so this is 1.0 m lenient on that one axis — in the
 * direction that lets a vehicle drive rather than stopping one that could, and
 * both lane centrelines (`LANE_OFFSET` 1.75 and 5.25) are inside 6.5 anyway.
 * A second copy of `BLOCK.crossStreetWidth` in this file is the arrangement
 * CONTRACT §9.1 is a list of, and it would buy nothing.
 */
export function blockNoRoad(x, z, pad = 0) {
  if (!insideKeepout(x, z, pad)) return false;
  const r = CITY.roadHalfWidth;
  return Math.abs(z) > r + pad && Math.abs(x) > r + pad;
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
  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * SESSION 57 — FIVE KINDS OF STREET FURNITURE, AND THEY COST ALMOST NOTHING
   * BECAUSE THE SCATTER'S COUNT IS FIXED.
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * `propCount` decides HOW MANY objects a chunk carries and this table decides
   * WHAT THEY ARE. Adding kinds therefore changes the mix and not the
   * population: the delivered triangle cost is the difference between a new
   * kind's box count and the average of the palette it joins, which for the
   * five below is between −1 and +2 boxes. The city gets five new objects at
   * eye level for about the price of nothing, which is the cheapest content
   * this project has ever added and is the answer to "what does a city have
   * that this one does not" at the one height it is judged from (LOOK.md §4).
   *
   * All five are things a person passes within a metre of on an ordinary
   * pavement, and every one is a shape rather than a texture — the lesson
   * session 50 paid for with the painted kerb line: on pale ground what reads
   * is a change of SURFACE or an object with HEIGHT, never paint.
   */

  /** A pillar box: a drum on a plinth with a domed cap and a slot. */
  postbox: [
    {
      boxes: [
        bx(0, 0.06, 0, 0.62, 0.12, 0.62, IRON, 0.75),
        bx(0, 0.62, 0, 0.52, 1.00, 0.52, [0.24, 0.045, 0.035], 0.55),
        bx(0, 1.14, 0, 0.58, 0.06, 0.58, [0.22, 0.040, 0.032], 0.5),
        bx(0, 1.20, 0, 0.46, 0.08, 0.46, [0.22, 0.040, 0.032], 0.5),
        /** The aperture, and it is the one thing that says post box. */
        bx(0, 0.98, 0.26, 0.30, 0.05, 0.03, [0.02, 0.02, 0.02], 0.9),
      ],
    },
    /** The wall-mounted kind on a post, for the narrower pavement. */
    {
      boxes: [
        bx(0, 0.55, 0, 0.10, 1.10, 0.10, IRON, 0.6),
        bx(0, 1.22, 0, 0.34, 0.44, 0.28, [0.24, 0.045, 0.035], 0.55),
        bx(0, 1.42, 0.145, 0.24, 0.04, 0.03, [0.02, 0.02, 0.02], 0.9),
      ],
    },
  ],

  /**
   * A CYCLE STAND — the Sheffield hoop, which is two uprights and a rail and
   * is the same object in every city in the world. Drawn as three boxes
   * because the bend is 0.05 m of steel at 0.8 m: at the 3 px floor session 20
   * derived, a radius that small is under a pixel past nine metres.
   */
  cyclestand: [
    {
      boxes: [
        bx(-0.35, 0.40, 0, 0.06, 0.80, 0.06, STEEL, 0.5),
        bx(0.35, 0.40, 0, 0.06, 0.80, 0.06, STEEL, 0.5),
        bx(0, 0.79, 0, 0.76, 0.06, 0.06, STEEL, 0.5),
      ],
    },
    /** A pair, which is how they are actually installed. */
    {
      boxes: [
        bx(-0.35, 0.40, -0.5, 0.06, 0.80, 0.06, STEEL, 0.5),
        bx(0.35, 0.40, -0.5, 0.06, 0.80, 0.06, STEEL, 0.5),
        bx(0, 0.79, -0.5, 0.76, 0.06, 0.06, STEEL, 0.5),
        bx(-0.35, 0.40, 0.5, 0.06, 0.80, 0.06, STEEL, 0.5),
        bx(0.35, 0.40, 0.5, 0.06, 0.80, 0.06, STEEL, 0.5),
        bx(0, 0.79, 0.5, 0.76, 0.06, 0.06, STEEL, 0.5),
      ],
    },
  ],

  /**
   * A KERBSIDE CHARGING POINT. 2049: the thing that has replaced the parking
   * meter, and the one piece of furniture in this list that dates the city.
   * The lit face is `emissive` nowhere — it is a pale panel, because a screen
   * bright enough to read is a light source and this project puts light in the
   * light list rather than in an albedo (CONTRACT §5.3).
   */
  charger: [
    {
      boxes: [
        bx(0, 0.05, 0, 0.34, 0.10, 0.30, CONCRETE, 0.8),
        bx(0, 0.62, 0, 0.26, 1.05, 0.22, STEEL, 0.45),
        bx(0, 1.24, 0, 0.30, 0.20, 0.26, [0.30, 0.305, 0.312], 0.4),
        bx(0, 1.16, 0.115, 0.18, 0.24, 0.02, [0.42, 0.44, 0.46], 0.25),
        /** The cable, looped on its hook. */
        bx(0.14, 0.80, 0.02, 0.05, 0.34, 0.05, [0.05, 0.05, 0.055], 0.9),
      ],
    },
  ],

  /** A newspaper or parcel-locker box: a body, a sloped top and a door. */
  newsbox: [
    {
      boxes: [
        bx(0, 0.10, 0, 0.52, 0.20, 0.40, STEEL, 0.6),
        bx(0, 0.66, 0, 0.56, 0.92, 0.44, [0.16, 0.20, 0.26], 0.5),
        bx(0, 1.14, -0.04, 0.58, 0.08, 0.40, [0.14, 0.17, 0.22], 0.5),
        bx(0, 0.80, 0.225, 0.40, 0.44, 0.02, [0.36, 0.38, 0.40], 0.3),
      ],
    },
    {
      boxes: [
        bx(0, 0.50, 0, 0.42, 1.00, 0.36, [0.20, 0.16, 0.12], 0.62),
        bx(0, 1.04, 0, 0.46, 0.08, 0.40, TIMBER, 0.7),
      ],
    },
  ],

  /**
   * A CAFE TABLE AND TWO CHAIRS. The one piece of furniture here that says
   * somebody is USING the street rather than passing through it, which is the
   * difference §4 asks for between a pavement and a corridor.
   */
  cafetable: [
    {
      boxes: [
        bx(0, 0.36, 0, 0.07, 0.72, 0.07, STEEL, 0.5),
        bx(0, 0.73, 0, 0.72, 0.05, 0.72, [0.30, 0.28, 0.25], 0.45),
        bx(0, 0.03, 0, 0.34, 0.06, 0.34, IRON, 0.7),
        bx(-0.62, 0.24, 0, 0.40, 0.05, 0.40, TIMBER, 0.65),
        bx(-0.80, 0.50, 0, 0.05, 0.56, 0.40, TIMBER, 0.65),
        bx(0.62, 0.24, 0, 0.40, 0.05, 0.40, TIMBER, 0.65),
        bx(0.80, 0.50, 0, 0.05, 0.56, 0.40, TIMBER, 0.65),
      ],
    },
  ],

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
/**
 * `precinct` CARRIES THE SAME NUMBER AS `landmark` AND OMITTING IT COST SIX
 * BUILDINGS — SESSION 51, and it is the sharpest lesson of the claim split.
 *
 * `pads` is a PER-CATEGORY setback and it is keyed on the category NAME. So
 * the moment `landmark` became `landmark | precinct`, this table applied to
 * half of what it used to and **the perimeter walk placed 680 buildings where
 * it had placed 674** — six masses that had been refused by a 4.2 m margin
 * against ground that is still spoken for. It is not a conflict-table defect:
 * `precinct × building` is forbidden and every one of those six is outside
 * the claim. It is the SETBACK, which is the part of "occupancy" that lives
 * in a key rather than in the table, and it is exactly CONTRACT §9's shape —
 * one quantity split in two, with a reader that knew only the old name.
 *
 * Every setback table in this file therefore names both, and the delivered
 * building population is 674 again.
 */
const BUILDING_SETBACKS = {
  landmark: CITY.sidewalkWidth, precinct: CITY.sidewalkWidth, building: 0,
};

/** The quayside terrace's own, session 15's 1 m margin against the island's frontage. */
const QUAY_SETBACKS = {
  landmark: CITY.sidewalkWidth, precinct: CITY.sidewalkWidth, building: 1,
};

/**
 * The same, for a prop. `landmark: 3` is the scatter's own pad from session 4b.
 * A bollard may stand a metre from a wall; it may not stand a metre inside a
 * landmark's plinth.
 *
 * `precinct: 3` KEEPS THE STREET SCATTER OUT OF A FORECOURT — session 51. It
 * is the phase-preserving choice and it is also the right sentence: a
 * landmark's apron is furnished by the landmark's OWN programme
 * (`LANDMARK_APRON`), not by the kerbside scatter that happens to reach it.
 * That programme uses `APRON_SETBACKS` below, which is this table without the
 * row — because the thing it is placing stands IN the precinct.
 */
const PROP_SETBACKS = { landmark: 3, precinct: 3 };

/**
 * A landmark apron's own furniture: 3 m off the structure, and inside its
 * precinct.
 *
 * `feature: 0.25` IS A DELIVERED-EXTENT MARGIN AND NOT A TASTE. A prop's
 * registry claim is `propHalfWidth`, which is the model's own half-width, and
 * `city.js` draws the boxes that model is made of — the two agree to a
 * millimetre and not to zero. Placed hard against a railing the sweep reported
 * `prop(bench) x feature(edge:wall)` at **0.001 m²**, which is a fifth
 * delivered overlap earned by a tolerance rather than by a mistake. A quarter
 * of a metre is under the 0.35 m this file already calls the smallest gap
 * worth having, and it is also what a bench standing clear of a wall looks
 * like.
 */
const APRON_SETBACKS = { landmark: 3, feature: 0.25 };

/**
 * Metres a NEW SESSION-54 LIGHT stands clear of a building, and it is a
 * DELIVERED-EXTENT MARGIN in the shape `APRON_SETBACKS.feature` already has.
 *
 * A building's registry claim is its mass; `city.js` draws that mass WITH a
 * cornice and a crown, and those reach past it. A flood placed hard against a
 * facade was refused by nothing and the DELIVERED sweep reported
 * `site(flood:) x building(bld)` at 0.038 m2 — a fifth overlap earned by a
 * tolerance rather than by a mistake, which is the sentence `APRON_SETBACKS`
 * is already written under. 0.35 m is `MIN_GROUND_PIECE_M`, which this file
 * already calls the smallest gap worth having.
 */
const LIGHT_SETBACKS = { building: 0.35 };


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
function subtractBox(r, b, minPiece = MIN_GROUND_PIECE_M) {
  if (!(r.x1 > b.x0 && r.x0 < b.x1 && r.z1 > b.z0 && r.z0 < b.z1)) return [r];
  const out = [];
  const push = (x0, z0, x1, z1) => {
    if (x1 - x0 >= minPiece && z1 - z0 >= minPiece) out.push({ ...r, x0, z0, x1, z1 });
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

/**
 * The same, over a list of rectangles and a list of boxes.
 *
 * `minPiece` IS A PARAMETER SINCE SESSION 51 AND ITS ONE NON-DEFAULT CALLER
 * IS A PARTITION RATHER THAN A CUT. `MIN_GROUND_PIECE_M` is a statement about
 * a SURFACE — *"a missing surface is inside what `surfaceAt` already answers
 * as bare earth"* — and dropping a 0.2 m sliver of pavement is invisible.
 * Dropping a 0.2 m sliver of KEEP-OUT is not: the landmark claim split (see
 * `landmarkPrecinct`) subtracts the precinct staircase out of the claim, and
 * at the default the two halves stopped summing to the whole. Measured over
 * `citycheck`'s own 10 x 10 region: **90 m² of claim lost, 0.02% of the road
 * network moved and SIX buildings of 674 re-phased** — a re-phase, which this
 * file's own comments are emphatic costs a differently-phased city rather
 * than the same one with a change in it. At `minPiece: 0` the union is exact
 * and both counts are identical.
 */
function subtractBoxes(rects, boxes, minPiece = MIN_GROUND_PIECE_M) {
  let cur = rects;
  for (const b of boxes) {
    const next = [];
    for (const r of cur) for (const piece of subtractBox(r, b, minPiece)) next.push(piece);
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
  /**
   * SESSION 58. Its OWN stream, so that giving a shop a trade cannot move a
   * building, a sign, a prop or a pillar — CONTRACT §6's whole point, and the
   * same reason `DEAD_ZONE.core` draws from `'core'`.
   */
  const tradeRng = chunkRng(rootSeed, cx, cz, 'trade');

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

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * PAST THE CITY'S OWN EXTENT, NOTHING — SESSION 54, AND IT IS STATE 53 §7
   * ITEM 1, THE ONE THE BRIEF SAID TO BUILD IF NOTHING ELSE.
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Session 53 gave the world an extent and STATE 53 §2's last paragraph wrote
   * down exactly what it did not do: *"THE LATTICE STILL DOES NOT STOP. Past
   * 2816 m every chunk is low-detail and every chunk still has its 15.0 m
   * carriageway and its 0.4542 ha of it. The city thins to a landscape of
   * yards and depots and then continues as that, for ever."* Measured in §1.3
   * on the transect out to 4.10 km: from `cx` 3 outward every chunk on
   * `cz = 0` delivers 0.4542 ha of carriageway and 0.1989 ha of pavement,
   * identically, for ever.
   *
   * `cityExtentAt` IS ALREADY THE ANSWER AND NOTHING WAS READING IT HERE.
   * `densityAt` multiplies by it, so past `CITY.extentEdgeM` the field is
   * exactly 0 and every chunk is low-detail — but a low-detail chunk still
   * emits a full road lattice and a `DEAD_ZONE` floor of props, and BOTH of
   * those are independent of density by construction: the floor is what
   * session 50 added so that a yard at d = 0.1 is still a yard, and the
   * lattice never read the field at all. So the two things that make the outer
   * world go on for ever are exactly the two the extent term cannot reach
   * through `densityAt`, and they have to read it directly.
   *
   * WHAT IS PAST IT: the earth plane, and nothing else. `DISTANT`'s silhouette
   * shell is already empty out here because IT reads density. That is a city
   * that ends, which is what the operator asked for, and it is the
   * precondition for a road that LEAVES the grid — a road cannot leave a grid
   * that has no boundary.
   *
   * THE TEST IS THE CHUNK'S CENTRE, SO THE BOUNDARY IS 128 m RAGGED, and that
   * is right rather than tolerated: `cityExtentAt` is a smoothstep over a
   * 1440 m band and every chunk that fails it has `density` under 0.01
   * already, so what stops being drawn is a yard the field had all but emptied.
   */
  const beyondCity = cityExtentAt(cxWorld, czWorld) <= 0;

  const lowDetail = !hasLandmark && density < CITY.lowDetailThreshold;
  /**
   * `carpark` IS THE ONE KIND WITH A CONDITION ON IT, AND THE CONDITION IS THE
   * DERIVATION — session 48. See `DECK_PARK`: a deck is what you build where
   * land is dear, and a surface lot is what you lay where it is not, so a
   * `carpark` roll under `RECREATION.courtBelow` falls through to `parking`
   * rather than being re-rolled. Re-rolling would make the two kinds compete
   * for one die face; falling through makes them one decision about land value.
   */
  let kind = lowDetail
    ? LOW_DETAIL_KINDS[Math.floor(rng.next() * LOW_DETAIL_KINDS.length)]
    : 'built';
  if (kind === 'carpark' && density < RECREATION.courtBelow) kind = 'parking';
  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * THE PROGRAM'S OWN CONDITIONS — SESSION 49. See `PROGRAM` for each one's
   * reason; this is the whole of the placement machinery.
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * FALL THROUGH, NEVER RE-ROLL, which is session 48's `carpark` rule applied
   * eight more times: a re-roll makes two kinds compete for one die face, and a
   * fall-through makes them ONE DECISION ABOUT THE LAND. Land by the water that
   * did not draw `port` is still waterside land, so it becomes `industrial`;
   * land in the core that did not draw `market` is still core land, so it
   * becomes `park`.
   *
   * AND TWO SITES OVERRIDE THE DIE ENTIRELY, because a die over fifteen kinds
   * would put a wharf on the river about once every four hundred chunks and the
   * city would never have one. `riverTouchesChunk` is true for the two rows the
   * envelope reaches and the viaduct's AABB for four chunks either side of its
   * arc, so the override is confined to land that IS the reason for the use.
   */
  if (lowDetail) {
    /**
     * A WHARF GOES ON THE BANK AND NOT IN THE WATER, AND THE FIRST ARM PUT IT
     * IN THE WATER. `riverTouchesChunk` is true for the rows the ENVELOPE
     * reaches, and on those rows the channel takes z −497.9 to −350.3 out of a
     * 128 m chunk — so a `port` island had **14 m of dry land** and its 46 × 18
     * shed was refused by the water every time: 9 of 14 ports had no building
     * on them and none within twelve chunks of the origin at seed 1337. The
     * quay-side block is the one NEXT to the water, which is also where a wharf
     * actually is: the cranes are on the quay and the sheds are behind them.
     */
    const wet = riverTouchesChunk(cx, cz);
    const onBank = !wet && (riverTouchesChunk(cx, cz - 1) || riverTouchesChunk(cx, cz + 1));
    const onRiver = wet || onBank;
    const vb = landmarkAABB(LANDMARKS.find((l) => l.name === 'viaduct'));
    const b = chunkBounds(cx, cz);
    /**
     * THREE CHUNKS OF PAD AND NOT ONE. A depot serves a railway from within a
     * few hundred metres of it, and the band has to be wide enough that some of
     * it is low-detail: at one chunk it held 24 chunks of which about four are,
     * and there was **no depot within twelve chunks of the origin at seed
     * 1337**. That is session 48's stadium-at-the-p10 again — a use nobody can
     * walk to is not shipped — and it is the second time this session, after
     * the wharf in the water. **The lesson generalises: a condition narrow
     * enough to be precise is usually narrow enough to be empty, so check the
     * delivered count at the shipped seed before believing a placement rule.**
     */
    const vpad = 3 * CITY.chunkSize;
    const nearViaduct = b.x1 > vb.x0 - vpad && b.x0 < vb.x1 + vpad
      && b.z1 > vb.z0 - vpad && b.z0 < vb.z1 + vpad;
    /** A through route: this chunk's own west boundary carries a river bridge. */
    const onArterial = Math.abs(b.x0 - nearestCrossingX(b.x0)) < 1;

    if (onRiver && rng.chance(0.6)) kind = onBank && rng.chance(0.6) ? 'port' : 'industrial';
    else if (nearViaduct && rng.chance(0.55)) kind = rng.chance(0.6) ? 'depot' : 'industrial';

    if (kind === 'port' && !onBank) kind = 'industrial';
    if (kind === 'depot' && !nearViaduct) kind = 'industrial';
    if (kind === 'industrial' && !(onRiver || nearViaduct || density < RECREATION.pitchBelow)) kind = 'yard';
    if (kind === 'school' && density < RECREATION.pitchBelow) kind = 'recreation';
    if (kind === 'hospital' && !onArterial) kind = 'carpark';
    if (kind === 'firestation'
      && !(density >= RECREATION.pitchBelow && density < RECREATION.courtBelow)) kind = 'lot';
    if (kind === 'market' && density < RECREATION.courtBelow) kind = 'park';
    if (kind === 'carpark' && density < RECREATION.courtBelow) kind = 'parking';
  }

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
  /** The landmarks' claim rectangles, WHOLE, for the road clip. See below. */
  const landmarkSolids = [];
  for (const l of nearLandmarks) {
    for (const o of landmarkOccluders(l)) {
      if (o.deck) {
        reg.claim(claimBox('deck', o.x0, o.z0, o.x1, o.z1, { y0: o.base, y1: o.top, owner: l.name }));
      }
    }
    /**
     * THE CLAIM, SPLIT INTO WHAT THE LANDMARK STANDS ON AND WHAT IT MERELY
     * TOOK — SESSION 51. See `landmarkPrecinct` for the whole derivation.
     *
     * THE GROUND THE CLAIM SPEAKS FOR DOES NOT MOVE, which is what makes this
     * safe to do at all. Every square metre that was `landmark` is now
     * `precinct`, and the part the structure actually stands on is `landmark`
     * as well — see the two claims below. `precinct` still forbids `building`
     * and `carriageway`, the two readers the claim was written for, so the
     * road clip below and the perimeter walk after it see exactly what they
     * saw: measured over `citycheck`'s own 10 x 10 region, **carriageway
     * 38.315 ha, pavement 16.799 ha, core 43.305 ha and 674 buildings, every
     * one of them session 50's figure to the digit.**
     *
     * `landmarkGroundClaims` ITSELF IS UNTOUCHED. `landmarkOccupies` reads it
     * and `traffic.js` reads that, so the fleet's idea of where a landmark is
     * does not move by a millimetre. The split lives HERE, at the one place
     * the registry is written, rather than in the description every other
     * reader shares.
     */
    const precinct = landmarkPrecinct(l);
    const parts = landmarkClaimParts(l);
    for (const g of landmarkGroundClaims(l)) {
      /**
       * THE WHOLE CLAIM, RECORDED FOR THE ROAD CLIP BEFORE IT IS SPLIT —
       * SESSION 51, and it is a sliver defect with a measurement.
       *
       * `subtractBoxes` drops a piece under `MIN_GROUND_PIECE_M` = 0.35 m
       * AFTER EACH BLOCKER, which is right for a surface and is a filter that
       * COMPOUNDS. Cutting a carriageway against one 210 m box and cutting it
       * against the eighty-eight staircase boxes that partition the same
       * 210 m box are the same set difference and not the same result.
       * Measured over `citycheck`'s 10 x 10 region before this array existed:
       * **0.004 ha of carriageway and 0.005 ha of pavement lost, and SIX
       * buildings of 674 placed that the lost slivers had been refusing.**
       * Six buildings is a re-phased city, which is the thing every comment in
       * this file about a new `rng` draw is protecting against.
       */
      const box = claimBox('landmark', g.x0, g.z0, g.x1, g.z1, { y0: g.y0, y1: g.y1, owner: g.owner });
      // `tested` is the viaduct end treatment's own refusal — see below. It is
      // tested BEFORE `landmarkSolids` records it: an end treatment that is
      // not built must not cut a carriageway, and the first arm of this split
      // pushed the box first and took 0.014 ha of pavement off two chunks.
      if (g.tested && reg.conflict(box)) continue;
      landmarkSolids.push({ x0: g.x0, x1: g.x1, z0: g.z0, z1: g.z1, kind: 'landmark' });
      if (!precinct.length) { reg.claim(box); continue; }
      /**
       * THE PRECINCT IS THE WHOLE CLAIM AND THE LANDMARK IS THE PART OF IT
       * THE STRUCTURE STANDS ON, SO THE TWO OVERLAP. That is deliberate and
       * it is the `deck × landmark` arrangement one row down in
       * `occupancy.js`: *"a deck's own legs are `landmark` claims directly
       * under it, which is the arrangement rather than a defect."*
       *
       * IT IS ALSO THE ONLY VERSION THAT DOES NOT RE-PHASE THE CITY, and the
       * first arm is why. Claiming the precinct as the eighty-eight STAIRCASE
       * boxes and the landmark as the remainder is the same set and the same
       * dilated union — verified over three chunks at 0.25 m, **zero
       * disagreements in 262 144 samples** — and it still moved two buildings
       * of 674, because `afterRefusal` reads `hit.x1`:
       *
       *   > `const far = (side.axis === 'x' ? hit.x1 : hit.z1) + gap;`
       *
       * The perimeter walk RESUMES PAST THE THING THAT REFUSED IT, so a hit
       * that is one 2.1 m tread of a staircase advances `t` by 2.1 m where a
       * hit that is the 210 m claim advances it by 210 — and every `rng` draw
       * after that is a different draw. A partition can be exact as a SET and
       * still be a different obstacle, which is CONTRACT §9's shape with a
       * refusal instead of a length.
       *
       * Claimed BEFORE the landmark pieces, so that it is the lower index in
       * every grid bucket and `conflict` returns it first — the same box, at
       * the same insertion position, that the single claim used to be.
       *
       * `y1` IS THE LANDMARK'S OWN, NOT A SURFACE'S: a building is refused on
       * `[y0, y1]`, so a forecourt that declared itself 0.02 m tall would let
       * a 40 m tower stand in the dome's plaza. `y0` is the datum rather than
       * the claim's, because the basin's is -10.9 m and its rim is at grade.
       */
      for (const part of parts) {
        if (part.owner !== g.owner && part.owner !== `${g.owner}:precinct`) continue;
        reg.claim(claimBox(part.kind, part.x0, part.z0, part.x1, part.z1,
          { y0: part.y0, y1: part.y1, owner: part.owner }));
      }
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
  /**
   * SESSION 52. Street ends this chunk DREW, and ends it declined because the
   * street would have been left shorter than it is wide. Counted for the
   * reason `propsGaveUp` is: a bounded treatment nobody prints reads as
   * "every end was finished". `own` strips only — the two a chunk draws —
   * so summing over a region counts each end once.
   */
  const streetEnds = { built: 0, tooShort: 0 };
  /** `beyondCity` — see its derivation above. Past the extent there is no road. */
  if (!beyondCity) {
    const r = CITY.roadHalfWidth;
    const w = CORRIDOR;
    /**
     * The blockers a ground surface is cut around: solid, at grade, not a deck.
     *
     * THE LANDMARKS COME FROM `landmarkSolids` AND NOT FROM THE REGISTRY —
     * session 51, and the reason is at that array's push site above: the claim
     * was split into `landmark` and `precinct`, and cutting a road against the
     * eighty-eight staircase boxes that PARTITION a claim is not the same
     * result as cutting it against the claim. `subtractBoxes` drops a piece
     * under `MIN_GROUND_PIECE_M` after each blocker and the filter compounds.
     * Every OTHER filter in this file that named `landmark` now names
     * `precinct` beside it, because those cut a SURFACE and a surface is what
     * that constant is a statement about.
     *
     * THE ORDER IS THE REGISTRY'S OWN — block, then water, then the landmarks
     * — and it is load-bearing for the same reason. `subtractBox` is a
     * GUILLOTINE, so the order of the blockers decides the SHAPE of the
     * remainder and therefore which sub-pieces fall under
     * `MIN_GROUND_PIECE_M`. Putting the landmarks first cost 0.014 ha of
     * pavement on the two chunks the viaduct crosses, for no other reason.
     */
    const solid = () => reg.all()
      .filter((c) => c.kind === 'block' || c.kind === 'water')
      .concat(landmarkSolids);
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
    /**
     * ═══════════════════════════════════════════════════════════════════════
     * THE STREET END — SESSION 52, AND UNTIL NOW THERE WAS NO CONCEPT OF ONE
     * ANYWHERE IN THIS CODEBASE.
     * ═══════════════════════════════════════════════════════════════════════
     *
     * STATE 51 §4 measured it and handed it over: **63 cut ends over 202
     * delivered carriageway pieces**, and a repo-wide search for
     * `cul-de-sac | dead end | turning head | turning circle | roundabout |
     * terminat` over `src/`, `tools/` and `docs/` returned two incidental
     * lines, neither about a road. **A road ends because a rectangle got
     * guillotined and nothing in the project knows it happened.** The
     * carriageway simply stops, at grade, against whatever refused it — a
     * courtyard at 0.105, a precinct at 0.26, the origin block's core — with
     * no kerb, no footway and no transition. That is the operator's *"no kerb
     * reads"* and it is why a 15 m street reads as a bay in a plaza.
     *
     * ITEM 4a ASKED WHETHER THE 55 SHARE A SHAPE BEFORE ANYTHING WAS BUILT,
     * AND THEY DO. Re-measured this session over `citycheck`'s 10 x 10 at seed
     * 1337, by the width of the carriageway across the cut:
     *
     *     15.0 m   49        the full lattice carriageway, 2 x roadHalfWidth
     *     12.0 m    4
     *     10.0 m    4
     *      3.0 m    4
     *      4.3 m    2
     *
     * **49 of 63 — 77.8% — are a full-width carriageway stopping dead**, and
     * what is one metre beyond them is 24 nothing (the river's dry margin),
     * 22 a landmark precinct, 8 the origin block, 7 a landmark's own solid and
     * 2 the water. So the GENERAL RULE is what is owed, not the roundabout,
     * and this is it.
     *
     * WHAT A STREET END IS, AND EVERY LENGTH IN IT IS ALREADY IN THIS FILE.
     * The footway that runs along both sides of the street TURNS THE CORNER
     * and closes across its end. It is the same surface, the same
     * `CITY.sidewalkWidth` = 4.2 m, the same datum and the same reflectance as
     * the two it joins — it is not a new object, it is the one that is already
     * there, finished. Nothing is added to the world: the band is taken out of
     * the carriageway's own last 4.2 m, so the ground area is unchanged to the
     * square metre and the only thing that moves is which of two existing
     * kinds a rectangle is.
     *
     * AND IT BRINGS A KERB, WHICH IS THE HALF THAT READS. `city.js` emits a
     * 0.16 m riser for every `walk` rectangle, so an end footway puts a
     * VERTICAL FACE across the end of the street — STATE 50's own rule that a
     * `walk` rect has HEIGHT and therefore reads — with the pavement's 0.26
     * albedo behind it against the carriageway's 0.117. Measured this session
     * on a nadir frame at noon, 240 rows: **the pavement delivers 35.9 code
     * values above the carriageway dry and 35.7 wet.** A street end is now the
     * second most contrasty line in the street after the paint.
     *
     * THE KERB EDGE IS DECLARED AND NOT DERIVED, AND IT HAS TO BE. `city.js`
     * infers which edge of a `walk` rect carries the riser from the nearest
     * LATTICE LINE, which is right for a footway running beside a road and
     * meaningless for one lying across it: a street end is not on a lattice
     * line, so the inference would pick whichever edge happened to be nearer
     * an arbitrary multiple of 128. So the rectangle says. See `buildGround`.
     *
     * THE ONE GUARD, AND IT IS A LENGTH FROM THIS FILE TOO. A street that
     * would be left shorter than it is wide is not a street with an end, it is
     * a bay — so the treatment is skipped where the remainder would fall under
     * `2 * CITY.roadHalfWidth` = 15.0 m. The shortest piece at a cut end in
     * the region is **0.7 m**; the median is 69.5 m. What is skipped is
     * counted rather than assumed — `chunk.streetEnds` carries `built` and
     * `tooShort`, for the reason `propsGaveUp` exists: a bounded treatment
     * nobody prints reads as "every end was finished".
     *
     * WHAT THIS IS NOT: a turning head. A vehicle still cannot turn round at
     * one of these, and widening the carriageway into a T bar is a second
     * change that takes ground the registry has already given to something
     * else — at the weir the head has to go where the claim is not, and item 1
     * of this session made that claim one footway BIGGER. It is STATE 52 §6.
     */
    const END_EPS = 0.05;
    const streetEnd = (piece, s) => {
      if (piece.kind !== 'road') return [piece];
      const ns = s.axis === 'NS';
      const s0 = ns ? s.z0 : s.x0;
      const s1 = ns ? s.z1 : s.x1;
      let p0 = ns ? piece.z0 : piece.x0;
      let p1 = ns ? piece.z1 : piece.x1;
      /**
       * AN END AT A JUNCTION IS A T, AND A T NEEDS NO TREATMENT — AND THE
       * FIRST ARM BUILT ONE ANYWAY AND THE LANE PROBE PRINTED IT.
       *
       * An end footway is `CITY.sidewalkWidth` deep along its street and the
       * FULL carriageway wide across it, so one built inside a crossing
       * street's corridor lies ACROSS that street's driving lanes. Measured on
       * the driving lanes off `worldSurfaceAt`, ±512 m at 1 m, against exactly
       * the three tests `traffic.js`'s recycle pass makes: session 51's city
       * had **0 m** of lane on something that is not a carriageway and this
       * put **156 m** there — 20 stretches, the largest of them **15.0 m**,
       * which is the crossing carriageway's own full width and is the
       * signature. Every metre of it was this.
       *
       * `CORRIDOR` = `roadHalfWidth + sidewalkWidth` is the half-width of the
       * street a junction is made of, so an end inside it is an end AT the
       * junction — which is a road meeting a road, and a road meeting a road
       * already ends the way a street ends. The treatment is for a road
       * meeting something impassable.
       */
      const atJunction = (t) => {
        const n = Math.abs(t - Math.round(t / CITY.chunkSize) * CITY.chunkSize);
        return n < CORRIDOR + CITY.sidewalkWidth;
      };
      const cuts = [];
      if (p0 > s0 + END_EPS && !atJunction(p0)) cuts.push(-1);
      if (p1 < s1 - END_EPS && !atJunction(p1)) cuts.push(+1);
      if (!cuts.length) return [piece];
      const wf = CITY.sidewalkWidth;
      if ((p1 - p0) - cuts.length * wf < 2 * CITY.roadHalfWidth) {
        return [{ ...piece, endTooShort: cuts.length }];
      }
      const out = [];
      for (const dir of cuts) {
        const a = dir < 0 ? p0 : p1 - wf;
        const bEnd = dir < 0 ? p0 + wf : p1;
        out.push({
          ...piece,
          kind: 'walk',
          // The datum of the two footways this one joins, so the whole footway
          // round a street end is one surface at one height.
          yKey: ns ? 'walkNS' : 'walkEW',
          [ns ? 'z0' : 'x0']: a,
          [ns ? 'z1' : 'x1']: bEnd,
          // The riser stands on the edge that faces the carriageway.
          kerbAxis: ns ? 'z' : 'x',
          kerbAt: dir < 0 ? bEnd : a,
          kerbDir: -dir,
          owner: 'road:end',
          endLine: true,
        });
        if (dir < 0) p0 += wf; else p1 -= wf;
      }
      out.push({ ...piece, [ns ? 'z0' : 'x0']: p0, [ns ? 'z1' : 'x1']: p1 });
      return out;
    };
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
        for (const part of streetEnd(piece, s)) {
          if (s.own) ground.push(part);
          reg.claim(claimBox(part.kind === 'road' ? 'carriageway' : 'pavement',
            part.x0, part.z0, part.x1, part.z1, { owner: part.owner || `road:${part.yKey}` }));
          if (part.endLine && s.own) streetEnds.built++;
          if (part.endTooShort && s.own) streetEnds.tooShort += part.endTooShort;
        }
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
            /**
             * WHAT IT SELLS — session 58. `retail` says the ground floor is
             * glazed and lit; this says what the light is FOR, and `city.js`
             * takes the bay's colour temperature, its strength and its opening
             * hours from it. Null where nothing trades, so a reader cannot
             * mistake a dark plinth for a shut shop.
             */
            trade: retail ? tradeFor(tradeRng, density, distToEndM) : null,
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
            /**
             * ═══════════════════════════════════════════════════════════════
             * AND THE TRADE DECIDES HOW BADLY IT WANTS ONE — SESSION 59.
             * ═══════════════════════════════════════════════════════════════
             *
             * Session 58 wrote `signScale` onto all eight trades and NOTHING
             * READ IT. It does two things here, and both are the same fact
             * about the business: a bar's whole shopfront strategy is a sign,
             * because `TRADES.bar.out` is 0.20 and almost no light leaves its
             * glass; a laundrette's is a lit window, so its fascia can be
             * modest. `signScale` runs 0.60 (kiosk) to 1.45 (bar).
             *
             *   THE BLADE PROBABILITY scales with it, clamped to 0.85 so no
             *   trade is certain to hang one — a street where every bar has a
             *   blade is a street with one idea. bar 0.34 x 1.45 = 0.49,
             *   kiosk 0.34 x 0.60 = 0.20.
             *
             *   THE WIDTH scales with it too, and through `bladeHeightM`'s
             *   `width * aspect` that makes a bar's blade TALLER as well as
             *   wider — which is the brief's "bigger and more vertical where
             *   the trade would have it" delivered by one multiplier rather
             *   than by a second roll.
             *
             * THE CLAMP IS SESSION 43's AND IT IS NOT OPTIONAL. That session
             * found two signs WIDER THAN THE BUILDINGS THEY ARE BOLTED TO,
             * because an absolute width roll met a narrower elevation. A scale
             * that multiplies a width has exactly that failure mode, so the
             * result is capped at the frontage the sign hangs on.
             */
            const tradeSign = bld.trade && TRADES[bld.trade] ? TRADES[bld.trade].signScale : 1;
            const bladeWanted = !big && (bld.retail
              ? bladeRoll < Math.min(0.85, SIGN_BLADE.pTrading * tradeSign)
              : bld.retailFrontage && bladeRoll < SIGN_BLADE.pFrontage);
            const widthRaw = big
              ? Math.min(SIGN_BIG.maxWidthM, Math.max(SIGN_BIG.minWidthM,
                frontageM * signRng.range(SIGN_BIG.widthFracMin, SIGN_BIG.widthFracMax)))
              : bladeWanted
                ? SIGN_BLADE.widthMinM + (SIGN_BLADE.widthMaxM - SIGN_BLADE.widthMinM) * u
                : 0.9 + 5.3 * u * u;
            /**
             * Scaled by the trade and then CAPPED AT ITS OWN FRONTAGE —
             * session 43's finding, which is that a width roll meeting a
             * narrower elevation delivers a sign wider than its building. A
             * `big` sign is already a fraction of the frontage and is left
             * alone; only the shop-scale and blade rolls are multiplied.
             */
            const width = big ? widthRaw
              : Math.min(widthRaw * tradeSign, frontageM * 0.85);
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
              /**
               * SESSION 58 — WHOSE SIGN IT IS. A sign over a trading ground
               * floor advertises THAT TRADE, so `city.js` takes its chroma and
               * its size from `TRADES` instead of from the index above, and
               * `rebuildSignMesh` takes its opening hours from the same record.
               * Null on a building that does not trade, where the index roll
               * stands exactly as it did — every sign written before this
               * session is byte-identical unless its own building trades.
               */
              trade: bld.trade || null,
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

  // --- which SIDE elevations face something -------------------------------
  //
  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION 60, ITEM 2 — THE THIRTY-METRE BLANK WALL, AND THE REGISTRY IS WHAT
  // KNOWS WHICH ONES ARE PARTY WALLS.
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // THE OPERATOR'S QUESTION: *"how reasonable is it that buildings in downtown
  // have no windows on every side?"* `city.js` → `buildFacade` builds four
  // faces and glazes two — the elevation the building FACES and the courtyard
  // elevation behind it — and skips the two sides, under a comment that is
  // right about the case it names and silent about the case it does not:
  //
  //     "Not the two side faces: buildings in a run touch, so a window on a
  //      side face is a window inside the neighbour."
  //
  // A BUILDING IN A RUN TOUCHES ITS NEIGHBOUR. A BUILDING AT THE END OF A RUN
  // DOES NOT. The walk advances `t += width + rng.range(0.2, 1.4)` inside a run
  // and `rng.range(6, 26)` after the last building of one, so the same field
  // that produced the comment also produces the counter-example — and session
  // 35 then made the sides 29.6 m deep, so what stands across a cross street is
  // the largest unbroken surface in a street frame.
  //
  // THE PROBE IS 2.0 m AND IT SEPARATES THE TWO POPULATIONS BY CONSTRUCTION.
  // The within-run gap's own ceiling is 1.4 m and the end-of-run gap's own
  // floor is 6.0 m; 2.0 clears the first by 0.6 and is under the second by 4.0.
  // It is not a tuned distance — there is no building in this generator whose
  // near neighbour stands between 1.4 m and 6.0 m away, so any number in that
  // interval gives the same answer and the interval's own middle is the honest
  // place to stand. `SIDE_PARTY_PROBE_M`.
  //
  // WHAT IS RECORDED IS THE COVERED SPANS AND NOT A BOOLEAN, because a
  // neighbour is not obliged to be as deep as the building beside it: session
  // 35's depth is `rng.range` over a band, so a 30 m building next to a 16 m
  // one has 14 m of side elevation standing in the open above its own party
  // wall's end. A boolean would have to round that to blank or to glazed and
  // both are wrong. `city.js` reads the spans per COLUMN, which is
  // §7.3.1's rule — *a station is read against the boxes that span it* — with
  // a window bay instead of a vehicle station.
  //
  // AND THE HEIGHT IS CARRIED WITH IT. A neighbour four storeys high against a
  // twenty-storey flank is a party wall for four storeys and sky for sixteen.
  // Each covered span therefore carries the TOP of the tallest thing covering
  // it, and a bay is blank only below that. Recorded as a height above the
  // ground rather than a floor count, because the two buildings need not share
  // an era and therefore need not share a storey height.
  //
  // IT IS COMPLETE IN THIS CHUNK'S OWN REGISTRY, and that is a property of the
  // lattice rather than luck: the perimeter walk clamps every side's run to its
  // own island (see the registry's own note above), so the two buildings that
  // meet at an island corner are both this chunk's. A neighbouring island is
  // 23.4 m away across a corridor, which is nine times the probe.
  for (const bld of buildings) {
    /**
     * `width` is the world-X extent and `depth` the world-Z extent — both are
     * taken off the delivered claim, not off the roll (see `bld.width`). So a
     * building facing z± has its two SIDE faces on ±X, each of them `depth`
     * long; one facing x± has them on ±Z, each `width` long. This is
     * `buildFacade`'s own `faces` table read from the other end, and the two
     * agree because both are written in world axes.
     */
    const sideOnX = bld.facing === 'z-' || bld.facing === 'z+';
    const halfAcross = (sideOnX ? bld.width : bld.depth) / 2;
    const halfAlong = (sideOnX ? bld.depth : bld.width) / 2;
    const spans = {};
    const open = {};
    for (const sgn of [-1, 1]) {
      const faceAt = (sideOnX ? bld.x : bld.z) + sgn * halfAcross;
      const c = (sideOnX ? bld.z : bld.x);
      /**
       * A SLAB IMMEDIATELY OUTSIDE THE FACE, one probe deep and the face's own
       * length. `y` is a surface band: a `building` claim runs from 0 to its
       * delivered top, so any building at all overlaps it and the vertical
       * question is answered by the span's own `top` below rather than by the
       * query.
       */
      const box = sideOnX
        ? claimBox('building', faceAt + (sgn > 0 ? 0 : -SIDE_PARTY_PROBE_M),
          c - halfAlong, faceAt + (sgn > 0 ? SIDE_PARTY_PROBE_M : 0), c + halfAlong,
          { y1: SURFACE_TOP_M })
        : claimBox('building', c - halfAlong, faceAt + (sgn > 0 ? 0 : -SIDE_PARTY_PROBE_M),
          c + halfAlong, faceAt + (sgn > 0 ? SIDE_PARTY_PROBE_M : 0), { y1: SURFACE_TOP_M });
      const out = [];
      for (const hit of reg.hits(box, 0, ['building', 'landmark'])) {
        /** The neighbour's own extent along this face, in the face's parameter
         *  (`-halfAlong .. +halfAlong` from the building's centre). */
        const a = Math.max(-halfAlong, (sideOnX ? hit.z0 : hit.x0) - c);
        const b = Math.min(halfAlong, (sideOnX ? hit.z1 : hit.x1) - c);
        if (b - a <= 0.05) continue;
        out.push({ a: +a.toFixed(3), b: +b.toFixed(3), top: +hit.y1.toFixed(3) });
      }
      spans[sgn > 0 ? 'plus' : 'minus'] = out;

      /**
       * AND HOW FAR IT CAN SEE, which is a different question from whether it
       * is a party wall and the two are answered separately on purpose.
       *
       * `sideCovered` above says which BAYS have a neighbour standing on them.
       * This says what the elevation as a whole is LOOKING AT: 0.2 m of slot
       * between two buildings in a terrace, 14 m of yard at the end of a run,
       * or the cross street. A side face in a slot is not a party wall — there
       * is genuinely a gap — and it is not an elevation either, and one number
       * cannot say both.
       *
       * THE NEAREST BLOCKER AND NOT THE MEDIAN ONE, which is the conservative
       * direction: a neighbour clipping one metre of a thirty-metre face
       * closes the whole face here. `sideCovered` is what recovers the rest,
       * where the caller wants it.
       */
      const reach = sideOnX
        ? claimBox('building', sgn > 0 ? faceAt : faceAt - SIDE_OPEN_MAX_M,
          c - halfAlong, sgn > 0 ? faceAt + SIDE_OPEN_MAX_M : faceAt, c + halfAlong,
          { y1: SURFACE_TOP_M })
        : claimBox('building', c - halfAlong, sgn > 0 ? faceAt : faceAt - SIDE_OPEN_MAX_M,
          c + halfAlong, sgn > 0 ? faceAt + SIDE_OPEN_MAX_M : faceAt, { y1: SURFACE_TOP_M });
      let openM = SIDE_OPEN_MAX_M;
      for (const hit of reg.hits(reach, 0, ['building', 'landmark'])) {
        const near = sgn > 0
          ? (sideOnX ? hit.x0 : hit.z0) - faceAt
          : faceAt - (sideOnX ? hit.x1 : hit.z1);
        if (near < openM) openM = Math.max(0, near);
      }
      open[sgn > 0 ? 'plus' : 'minus'] = +openM.toFixed(3);
    }
    /**
     * WHAT `city.js` READS. Named for the axis they are on rather than for
     * "left" and "right", because a side is only left or right of somebody who
     * has been told which way the building faces, and this record is read by a
     * loop that walks all four faces in world axes.
     */
    bld.sideAxis = sideOnX ? 'x' : 'z';
    bld.sideCovered = spans;
    /** Metres of clear ground in front of each side face, saturating at
     *  `SIDE_OPEN_MAX_M`. See the note at the query. */
    bld.sideOpenM = open;
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
    /**
     * WHAT THE IRONWORK IS MADE OF — session 57. Cast iron at 0.055 linear is
     * the same reflectance every bollard, railing and manhole in this project
     * already uses (`IRON`), and against asphalt at 0.082 that is 0.67x: a
     * cover reads as a DARK disc where paint reads as a bright line, which is
     * why the two need different albedos in one mesh rather than one albedo
     * and a hope. Roughness 0.72 — a trafficked cover is polished by tyres
     * where the road around it is not, and that difference is most of what
     * makes one visible in a wet night frame.
     */
    const ROAD_IRON = {
      albedo: [0.055, 0.055, 0.058],
      rough: 0.72,
      manholeM: 0.68,
      manholeEveryM: 34,
      gullyLongM: 0.62,
      gullyAcrossM: 0.34,
      gullyEveryM: 20,
    };
    /**
     * An iron casting through the paint path: same guard, same mesh, its own
     * albedo. It takes the axis's own `put` so a gully on a north-south road
     * lies along that road exactly as its markings do.
     */
    const putIron = (put, along, off, len, wid, mkind) => {
      const before = markings.length;
      put(along, off, len, wid, mkind);
      for (let i = before; i < markings.length; i++) {
        markings[i].albedo = ROAD_IRON.albedo;
        markings[i].rough = ROAD_IRON.rough;
      }
    };
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
        /**
         * ═══════════════════════════════════════════════════════════════════
         * THE GULLIES — SESSION 57, ITEM 1(b). *"The carriageway is the
         * largest surface in a street frame and it is uniform."*
         * ═══════════════════════════════════════════════════════════════════
         *
         * A road gully sits IN THE CHANNEL — the gutter line against the kerb
         * face, which is where the water goes — so its offset is the
         * carriageway half-width less its own half-length, not an inset
         * chosen to look right. `ROAD_IRON.gullyEveryM` is 20 m, which is
         * drainage practice for a 15 m carriageway at this gradient and is
         * also, usefully, about one per frame at eye level.
         *
         * IT IS A MARKING AND NOT A PROP, and that is the whole economy of
         * this item: `markings` are 4 mm boxes in a mesh the chunk already
         * builds, so a gully costs 12 triangles and no draw call, where the
         * same object as a `prop` would carry a registry claim, a setback
         * test and a scatter slot it would have to win from a bollard.
         */
        for (let t = from + ROAD_IRON.gullyEveryM / 2; t < from + S; t += ROAD_IRON.gullyEveryM) {
          putIron(put, t, side * (r - ROAD_IRON.gullyLongM / 2),
            ROAD_IRON.gullyLongM, ROAD_IRON.gullyAcrossM, 'gully');
        }
      }
      /**
       * THE MANHOLES, ON THE CROWN AND OFF IT. A carriageway carries more than
       * one buried service and they do not share a trench, so the covers sit
       * on two lines — the crown, where the sewer runs, and the near-side lane,
       * where the ducts do — offset from each other by half a cycle so the
       * road does not read as a dotted line. `manholeEveryM` 34 m is a
       * chamber spacing a surveyor would recognise and is coprime with the
       * 6 m centre-line cycle, so no cover ever lands centred on a dash.
       */
      for (let t = from + 6; t < from + S; t += ROAD_IRON.manholeEveryM) {
        putIron(put, t, 0, ROAD_IRON.manholeM, ROAD_IRON.manholeM, 'manhole');
        putIron(put, t + ROAD_IRON.manholeEveryM / 2, -ROAD_MARKING.laneOffsetM * 1.5,
          ROAD_IRON.manholeM, ROAD_IRON.manholeM, 'manhole');
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
  // NO DRAW ORDER ABOVE THIS LINE MOVES. `featRng` is `chunkRng(rootSeed, cx, cz, 'feature')`
  // and a chunk is exactly one kind, so the three new branches draw from a
  // stream no park and no site has ever reached. The delivered park and
  // construction chunks are bit-identical (STATE 40 §7's determinism digest).
  const features = [];

  if (lowDetail && !beyondCity) {
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
    const islandSolids = () => reg.all().filter((c) => c.kind === 'landmark' || c.kind === 'precinct'
      || c.kind === 'block' || c.kind === 'water');

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
      const solidHere = reg.all().filter((c) => c.kind === 'landmark' || c.kind === 'precinct'
        || c.kind === 'block' || c.kind === 'water');
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
        /**
         * A CENTRE IS SQUARE TO ITS OWN PATHS — session 49, and the yaw it used
         * to take was decoration that cost a conflict. `centre` sits at the
         * crossing of two AXIAL paths and is claimed as an axis-aligned box, so
         * a rotation of up to `CITY.maxYawDeg` grows the delivered AABB by
         * `half · (cos + sin − 1)` = 0.19 m on each side and nothing grows the
         * claim with it: `path(ground:path) × feature(centre:square)` at 0.5 m²
         * on four edges. Session 48 fixed the POND's 2% coping overrun and this
         * is the same reading on the same object, arriving through the yaw
         * instead of through a literal. Widening the claim does not help — the
         * delivered census compares DRAWN boxes — so the thing that was wrong
         * is the rotation, and a square at a crossroads does not have one.
         */
        features.push({ kind: 'centre', centre, x: mx, z: mz, half: ch, yawDeg: 0 });
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
      for (const g of subtractBoxes([site], reg.all().filter((c) => c.kind === 'landmark'
        || c.kind === 'precinct' || c.kind === 'block' || c.kind === 'water'))) ground.push(g);

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

      /**
       * ONE SECURITY LIGHT ON THE HOARDING — SESSION 54. A cleared lot was one
       * of the four kinds `placeprobe --light` printed with no lamp and no
       * flood on any chunk, and a hoarded lot in a city is not dark: what is
       * behind the plywood is worth nothing and what is ON the plywood is a
       * light, because an unlit hoarding is where people go.
       *
       * IT IS ONE AND NOT THREE, and that is the difference between a lot and
       * a yard. `yard` takes two masts because it is WORKED and `construction`
       * takes three because people are on it; nothing operates here, which is
       * the same sentence `DEAD_ZONE.lot`'s floor of 9 is derived from — *"the
       * smallest number that is a placement rather than a scatter"*.
       */
      {
        const x = mx + featRng.range(-24, 24);
        const z = mz + featRng.range(-24, 24);
        /** 0.70, the flood's own pedestal. See the apron light. */
        const box = claimAt('feature', x, z, 0.7, 0.7,
          { y0: 0, y1: DEAD_ZONE.yardLightHeightM, owner: 'lot:light' });
        if (!reg.conflict(box, 0, LIGHT_SETBACKS)) {
          features.push({
            kind: 'flood', x, z,
            height: DEAD_ZONE.yardLightHeightM, aimX: mx, aimZ: mz,
          });
          reg.claim(box);
        }
      }
    } else if (kind === 'recreation') {
      /**
       * ═══════════════════════════════════════════════════════════════════════
       * A PITCH, A COURT OR A PLAYGROUND — SESSION 48, AND WHICH ONE IS THE
       * CHUNK'S OWN DENSITY.
       * ═══════════════════════════════════════════════════════════════════════
       *
       * See `RECREATION` for the three causes and `recreationVariant` for the
       * two cuts. All three are built the way session 40 built the other five —
       * **a surface, a boundary, and the fixtures that say what it is** — and
       * that order is the order they are laid in, because a court with no paint
       * on it is a rectangle of asphalt and a pitch with no goal is a lawn.
       *
       * THE PAINT IS `markings`, WHICH CLAIMS NOTHING AND COSTS NOTHING. A line
       * is a 4 mm box in the mesh the road markings already ride in, so a
       * touchline and a lane line are the same object at the same price. It is
       * pushed straight into `markings` rather than through `paint()` for the
       * reason the car park's bays are: that guard exists to keep a line off
       * ground a river or a dome took, and none of this is on a carriageway.
       */
      const R = RECREATION;
      const variant = recreationVariant(density);
      const hard = variant !== 'pitch';
      /** A pitch on the cheapest land gets a bowl round it. See `RECREATION`. */
      const stadium = variant === 'pitch' && density < R.stadiumBelow;

      /** The play area's own long axis, so a pitch does not always run east. */
      const alongX = featRng.chance(0.5);
      /**
       * COURTS COME IN PAIRS AND THE REASON IS WHAT THEY ARE FOR. One 28 x 15 m
       * court on a 104.6 m island is 3.9% of it, and the first arm delivered
       * exactly that: an enormous red rectangle with two hoops in the middle of
       * it. Municipal courts are laid in banks sharing one fence and one gate,
       * which is also the only arrangement that fills the parcel with COURT
       * rather than with surfacing.
       */
      const courts = variant === 'court' ? 2 : 1;
      const [pl, ps] = variant === 'pitch' ? [R.pitchLongM, R.pitchShortM]
        : variant === 'court' ? [R.courtLongM, R.courtShortM]
          : [34, 26];
      const halfL = pl / 2;
      const halfS = ps / 2;
      /** Metres between two courts in a bank, and round the outside of one. */
      const runOff = 4.0;
      /** Centres of each play area, offset across the short axis. */
      const bank = [];
      for (let i = 0; i < courts; i++) {
        const off = (i - (courts - 1) / 2) * (ps + runOff);
        bank.push({ x: mx + (alongX ? 0 : off), z: mz + (alongX ? off : 0) });
      }
      /** Half-extents on the world axes of the WHOLE bank, once the axis is chosen. */
      const bankS = halfS + ((courts - 1) * (ps + runOff)) / 2;
      const hxP = alongX ? halfL : bankS;
      const hzP = alongX ? bankS : halfL;

      /**
       * ═══════════════════════════════════════════════════════════════════════
       * ITEM 2, SESSION 56 — THE GROUND AROUND THE PLAY AREA. The operator:
       * a court pad "sits in the middle of a 100 m island, and the rest is
       * empty grass". The pad is 13.8% of a 10 941 m² island and everything
       * else was one lawn, a fence and 8–12 scattered props. What a real
       * ground has around its courts is A WAY IN, somewhere to sit, and a
       * planted boundary — all sized from the island, all in vocabulary this
       * file already draws.
       *
       * THE GATE IS ROLLED BEFORE THE SURFACE because the path must be cut
       * out of the lawn (coplanar quads z-fight — the pad's own rule), and
       * the path runs from the gate. Moving the two rolls re-phases the
       * playground fixtures and floods within this kind only.
       * ═══════════════════════════════════════════════════════════════════════
       */
      const gateSide = featRng.int(0, 3);
      const gateAt = featRng.range(0.3, 0.7);
      /** The path from the boundary gate to the play area's near edge —
       *  exactly boundaryRun's own gate arithmetic, same inset. */
      const pathRect = (() => {
        const inset = DEAD_ZONE.edgeInset;
        const h = PARK.pathHalf;
        /**
         * On a stadium island the path stops at the BACK of the stand — the
         * stands are claimed after this and `building x path` is forbidden,
         * so a path driven to the pitch would refuse the stand it leads to.
         * Measured before this clause: chunk (-8,-5) delivered three stands
         * of four, the missing one exactly where the gate rolled.
         */
        const standOff = stadium ? 6.0 + R.tiers * R.tierDeepM + 1.0 : 0;
        const stopX = hxP + standOff + (hard ? runOff : 2.0);
        const stopZ = hzP + standOff + (hard ? runOff : 2.0);
        const gx = (isl.x0 + inset) + ((isl.x1 - isl.x0) - 2 * inset) * gateAt;
        const gz = (isl.z0 + inset) + ((isl.z1 - isl.z0) - 2 * inset) * gateAt;
        if (gateSide === 0) return { x0: gx - h, x1: gx + h, z0: isl.z0, z1: mz - stopZ, kind: 'path', yKey: 'pathEW' };
        if (gateSide === 1) return { x0: gx - h, x1: gx + h, z0: mz + stopZ, z1: isl.z1, kind: 'path', yKey: 'pathEW' };
        if (gateSide === 2) return { x0: isl.x0, x1: mx - stopX, z0: gz - h, z1: gz + h, kind: 'path', yKey: 'pathEW' };
        return { x0: mx + stopX, x1: isl.x1, z0: gz - h, z1: gz + h, kind: 'path', yKey: 'pathEW' };
      })();
      const pathOk = pathRect.x1 > pathRect.x0 + 2 && pathRect.z1 > pathRect.z0 + 2;
      if (pathOk) {
        for (const q of subtractBoxes([pathRect], islandSolids())) {
          ground.push(q);
          reg.claim(claimBox('path', q.x0, q.z0, q.x1, q.z1, { owner: 'sport:path' }));
        }
      }

      /**
       * THE SURFACE IS THE PLAY AREA AND ITS RUN-OFF, NOT THE ISLAND.
       *
       * A pitch is grass and its run-off is grass, so a pitch takes the whole
       * island and nothing is wasted. A COURT is a piece of macadam the size of
       * a court — the first arm laid `sportGround` over all 104.6 m of the
       * island and it read as a red field with two hoops on it, because 96% of
       * what was surfaced is not a court. The rest of the island is the same
       * `grass` a park's is, so a court reads as a hard rectangle IN a green
       * one, which is what a municipal court is.
       */
      /** The path is cut out of the lawn exactly as the pad is — coplanar
       *  quads z-fight, and `islandSolids` knows nothing about paths. */
      const lawnCuts = pathOk ? [pathRect] : [];
      /**
       * ═══════════════════════════════════════════════════════════════════════
       * THE PLAY AREA IS A CLAIM NOW, AND FOR TWELVE SESSIONS IT WAS NOT —
       * SESSION 60, ITEM 1.
       * ═══════════════════════════════════════════════════════════════════════
       *
       * THE OPERATOR'S FRAME: `?player=1&spawn=580.12,0.14,1061.89&t=0.6017`,
       * two trees growing out of a basketball court. Chunk (4, 8), seed 1337,
       * and the two are at (575.51, 1077.25) and (569.26, 1078.65) — inside a
       * pad running x [558, 594] × z [1067, 1109].
       *
       * IT WAS NOT THE AD PILLAR'S SHAPE. Session 57's neighbouring case is a
       * 3 × 3 sweep against a scatter that reaches across a chunk boundary;
       * both trees here are in THIS chunk's own `props` and were placed by
       * THIS chunk's own island scatter, 40 m from the nearest boundary. It is
       * the simpler defect: **the pad was never offered to the registry at
       * all.** The block above pushed it into `ground` and the scatter, forty
       * lines below, tested `reg.conflict` against a registry that had never
       * heard of it — 200 claims on this chunk and not one of them the court.
       *
       * AND A CLAIM ALONE WOULD NOT HAVE BEEN ENOUGH, which is the half worth
       * writing down. `city.js` maps `sportGround` into the delivered census as
       * `ground`, and `ground × prop` is ABSENT from the conflict table ON
       * PURPOSE: a surface is the thing you stand a bollard on. So the pad had
       * no claim, and the category it would have carried permits exactly the
       * thing that stood on it. Two reasons, one frame. `occupancy.js` →
       * `pitch` is the category that says the other thing.
       *
       * THE CLAIM IS THE DELIVERED PIECES AND NOT THE PAD RECTANGLE, so the
       * generator's registry and `city.js`'s delivered census describe the same
       * polygons (CONTRACT §9.1). `subtractBoxes` normally returns the pad
       * whole — a recreation island is `lowDetail`, so no perimeter walk runs
       * on it — and where it does not, an over-claim would show up as a
       * spurious conflict and get the rule relaxed.
       *
       * `y1` IS `SURFACE_TOP_M` AND NOT THE FENCE'S HEIGHT. It is a SURFACE:
       * a crown at 4 m over a corner of it is a tree beside the court and must
       * stay legal, which is the same sentence `canopy × carriageway` is.
       */
      const claimPlay = (rects) => {
        for (const q of rects) {
          reg.claim(claimBox('pitch', q.x0, q.z0, q.x1, q.z1,
            { owner: `sport:${variant}` }));
        }
      };
      if (hard) {
        const pad = { kind: 'sportGround', yKey: 'sport',
          x0: mx - hxP - runOff, x1: mx + hxP + runOff,
          z0: mz - hzP - runOff, z1: mz + hzP + runOff };
        const green = { x0: isl.x0, z0: isl.z0, x1: isl.x1, z1: isl.z1, kind: 'grass', yKey: 'grass' };
        /**
         * THE LAWN IS CUT ROUND THE PAD AND NOT DRAWN UNDER IT. They are level
         * with each other (`GROUND_Y.sport` is the grass datum, and that note
         * carries the frame that made it so), so two coplanar quads over the
         * same ground is a z-fight rather than a court. `subtractBoxes` is the
         * same clipper a park's grass is cut round its own paths with.
         */
        for (const g of subtractBoxes([green], [...islandSolids(), pad, ...lawnCuts])) ground.push(g);
        const laid = subtractBoxes([pad], islandSolids());
        for (const g of laid) ground.push(g);
        claimPlay(laid);
      } else {
        /**
         * A PITCH IS GRASS ON GRASS, SO ITS PLAY AREA HAD NOTHING TO BE A
         * CLAIM OF — and that is why the fix is a ground KIND rather than one
         * more `reg.claim` line.
         *
         * The three hard variants have a pad, and `city.js` reads a delivered
         * claim off every rectangle it draws; the two grass variants laid one
         * lawn over the whole island, so there was no delivered rectangle that
         * was the pitch. A generator-only claim would have been the half of a
         * two-sided check that CONTRACT §9.1 says is worth least — the
         * registry says what was tested and the census says what arrived.
         *
         * `playField` IS `grass` WITH A DIFFERENT CATEGORY AND NOTHING ELSE.
         * Same albedo, same datum, same porosity — the delivered frame is
         * identical to the pixel. It is the relation `apronGrass` already has
         * to `grass` (session 51), which differs in category for the same
         * reason: the generator knows something about a piece of ground that
         * the ground itself cannot say.
         *
         * Measured before this existed, over 25 × 25 chunks at seed 1337:
         * **35 props standing on a play area over 14 recreation islands, 9 of
         * them trees** — 24 of the 35 on the six PITCHES, which is the variant
         * that had no surface to claim.
         */
        const play = { kind: 'playField', yKey: 'grass',
          x0: mx - hxP - runOff, x1: mx + hxP + runOff,
          z0: mz - hzP - runOff, z1: mz + hzP + runOff };
        const surf = { x0: isl.x0, z0: isl.z0, x1: isl.x1, z1: isl.z1, kind: 'grass', yKey: 'grass' };
        for (const g of subtractBoxes([surf], [...islandSolids(), play, ...lawnCuts])) ground.push(g);
        const laid = subtractBoxes([play], islandSolids());
        for (const g of laid) ground.push(g);
        claimPlay(laid);
      }
      /** A line on play area `c`: `t` along its long axis, `u` across it. */
      const line = (c, t, u, len, wid, across) => markings.push({
        x: c.x + (alongX ? t : u),
        z: c.z + (alongX ? u : t),
        length: len, width: wid,
        yawDeg: (alongX ? 0 : 90) + (across ? 90 : 0),
        kind: 'sport',
      });

      if (variant !== 'playground') for (const c of bank) {
        /**
         * THE MARKING SET. A touchline pair, a goal line pair, a halfway line
         * and a centre circle for both; the court adds nothing else because a
         * key drawn in 0.12 m paint at this scale is four more boxes for
         * something you cannot read from the pavement.
         *
         * THE CENTRE CIRCLE IS TWELVE CHORDS, which is the same trick the
         * basin's lathe uses one scale up: a circle made of boxes is a polygon,
         * and twelve segments at a 9.15 m radius has a 0.31 m sagitta, which is
         * under the 0.12 m line's own width times three and reads as round.
         */
        for (const sgn of [-1, 1]) {
          line(c, sgn * halfL, 0, ps, R.lineW, true);       // goal lines
          line(c, 0, sgn * halfS, pl, R.lineW, false);      // touchlines
        }
        line(c, 0, 0, ps, R.lineW, true);                   // halfway
        const cr = variant === 'pitch' ? 9.15 : R.courtArcM;
        const n = 12;
        for (let i = 0; i < n; i++) {
          const a0 = (i / n) * Math.PI * 2;
          const a1 = ((i + 1) / n) * Math.PI * 2;
          const t = (Math.cos(a0) + Math.cos(a1)) / 2 * cr;
          const u = (Math.sin(a0) + Math.sin(a1)) / 2 * cr;
          const seg = 2 * cr * Math.sin(Math.PI / n);
          const mDeg = (((a0 + a1) / 2) * 180) / Math.PI;
          markings.push({
            x: c.x + (alongX ? t : u), z: c.z + (alongX ? u : t),
            length: seg, width: R.lineW,
            /**
             * TANGENT TO ITS OWN CIRCLE, IN BOTH BRANCHES — session 56. The
             * !alongX branch swaps the chord's (t, u) POSITION across the
             * diagonal, which is a REFLECTION, and the old yaw only negated —
             * `−m + 90 + 90` — so on every z-axis pitch and court the twelve
             * chords stood mirrored against their own tangent and the centre
             * circle delivered as a four-pointed star. A box's long axis under
             * three's yaw is (cos, −sin): parallel to the tangent needs
             * `90 − m` unswapped and `+m` swapped, mod 180.
             */
            yawDeg: alongX ? 90 - mDeg : mDeg,
            kind: 'sport',
          });
        }
      }

      /**
       * THE FIXTURES. Two goals at the ends of a pitch, two hoops at the ends
       * of a court, a frame and a swing set on a playground. Each is claimed
       * `feature` — the category the park's own edge and centre use, which
       * conflicts with a carriageway, a pavement and a prop and not with the
       * ground it stands on.
       */
      if (variant === 'pitch') {
        for (const c of bank) for (const sgn of [-1, 1]) {
          const x = c.x + (alongX ? sgn * halfL : 0);
          const z = c.z + (alongX ? 0 : sgn * halfL);
          /**
           * THE CLAIM IS THE DELIVERED REACH, NOT THE POST — session 56. The
           * crossbar overhangs each post by a post's width (`width + post` in
           * the draw), so the wide half is `(width + post) / 2` = 1.89; the
           * net bag rakes back 0.62 m plus its own slab, so the thin half is
           * 0.65. The old claim said 0.12 × 1.83 — the frame alone, with the
           * net unclaimed.
           */
          const box = claimAt('feature', x, z,
            alongX ? 0.65 : (R.goalWidthM + R.goalPostM) / 2,
            alongX ? (R.goalWidthM + R.goalPostM) / 2 : 0.65,
            { y0: 0, y1: R.goalHeightM, owner: 'sport:goal' });
          if (reg.conflict(box)) continue;
          features.push({
            kind: 'goal', x, z, width: R.goalWidthM, height: R.goalHeightM,
            post: R.goalPostM,
            /**
             * THE CROSSBAR RUNS ACROSS THE PITCH AND THE MOUTH FACES IT —
             * SESSION 56, AND FOR EIGHT SESSIONS IT WAS `alongX ? 0 : 90`,
             * WHICH IS THE CLAIM ABOVE TRANSPOSED. Three's yaw takes local +Z
             * to (sin, cos); the goal's open face is local +Z and its net is
             * local −Z, so the goal at the +axis end wants its +Z pointing
             * back down the axis: 270 on an x-axis pitch, 180 on a z-axis
             * one. The old expression laid every crossbar ALONG the long
             * axis — the operator's "end goals standing on the touchlines" —
             * and gave both ends one yaw, so even the nets agreed with each
             * other and not with the pitch. The stands' table at the bottom
             * of this block is the same derivation and was right first.
             */
            yawDeg: alongX ? (sgn > 0 ? 270 : 90) : (sgn > 0 ? 180 : 0),
          });
          reg.claim(box);
        }
      } else if (variant === 'court') {
        for (const c of bank) for (const sgn of [-1, 1]) {
          const x = c.x + (alongX ? sgn * (halfL + 0.6) : 0);
          const z = c.z + (alongX ? 0 : sgn * (halfL + 0.6));
          /**
           * THE CLAIM IS THE DELIVERED REACH — session 56. The rim plate ends
           * 1.32 m out along the facing axis and the backboard spans ±0.90
           * across it; the old 0.6 square left both unclaimed.
           */
          const box = claimAt('feature', x, z,
            alongX ? 1.32 : 0.90,
            alongX ? 0.90 : 1.32,
            { y0: 0, y1: R.rimHeightM + R.boardHeightM, owner: 'sport:hoop' });
          if (reg.conflict(box)) continue;
          features.push({
            kind: 'hoop', x, z, rim: R.rimHeightM, boardW: R.boardWidthM,
            boardH: R.boardHeightM, arm: R.boardArmM,
            /**
             * FACING IN, which is the whole of what makes a hoop a hoop — and
             * for eight sessions the base yaw was `alongX ? 0 : 90`, which
             * faced all four hoops at their own touchlines. The hoop marches
             * post → arm → board → rim along local −Z, so facing the court
             * centre is the stands' own yaw table: local +Z away from the
             * middle. SESSION 56.
             */
            yawDeg: alongX ? (sgn > 0 ? 90 : 270) : (sgn > 0 ? 0 : 180),
          });
          reg.claim(box);
        }
      } else {
        /**
         * THE PLAY FRAME AND A SWING. Three tries each, because a playground's
         * island already carries the perimeter fence and the registry decides
         * where there is room rather than a rule doing it.
         */
        for (const [pkind, hw, hh] of [['frame', 3.2, 3.0], ['swing', 2.6, 2.4]]) {
          /**
           * THE FRAME'S CLAIM COVERS ITS SLIDE — session 56. The slide is
           * drawn at `half·1.4` with a 1.7 m slab on a RANDOM bearing, so its
           * far edge reaches `3.2·1.4 + 0.85 = 5.33 m` from the centre while
           * the old claim stopped at 3.2: a 2.13 m unclaimed protrusion the
           * registry could never defend. The claim is the circumscribing
           * square of the delivered reach, which is what a random yaw needs.
           */
          const claimHalf = pkind === 'frame' ? hw * 1.4 + 1.7 / 2 : hw;
          for (let t = 0; t < 3; t++) {
            const x = featRng.range(isl.x0 + 12, isl.x1 - 12);
            const z = featRng.range(isl.z0 + 12, isl.z1 - 12);
            const box = claimAt('feature', x, z, claimHalf, claimHalf, { y0: 0, y1: hh, owner: `sport:${pkind}` });
            if (reg.conflict(box)) continue;
            features.push({
              kind: 'play', play: pkind, x, z, half: hw, height: hh,
              deck: R.frameDeckM, yawDeg: yaw(),
            });
            reg.claim(box);
            break;
          }
        }
      }

      /**
       * THE BOWL. Four raked stands round the play area, each `tiers` deep, and
       * a blank outer wall behind them — which is what a ground looks like from
       * the street and is the whole reason the brief calls a stadium a
       * silhouette rather than a building. The stand claims `building`, because
       * that is what it is: a solid nothing may stand in and no road may cross.
       *
       * EACH SIDE IS ONE FEATURE AND NOT ONE PER TIER, so the four claims are
       * four boxes and the delivered census sees four objects rather than
       * twelve overlapping ones.
       *
       * IT IS BUILT BEFORE THE BALL-STOP AND THE FIRST ARM WAS AFTER IT, WHICH
       * DELIVERED ZERO STANDS ON FIVE QUALIFYING CHUNKS. The fence runs at
       * `DEAD_ZONE.edgeInset` = 0.9 m inside the island edge and a stand's
       * outer face lands 0.7 m inside it, so `building x feature` refused every
       * one of them. Ordering, and the right order is the one a ground is
       * actually built in: the stand first, and then the fence takes whatever
       * frontage is left — which is also why a real ground has fence only where
       * it has no stand.
       */
      if (stadium) {
        const depth = R.tiers * R.tierDeepM;
        const gap = 6.0;
        for (const [ax, sgn] of [['x', -1], ['x', 1], ['z', -1], ['z', 1]]) {
          /**
           * The stand stands off the play area on ITS OWN axis and runs the
           * length of the other one plus both corners, so the four of them
           * close into a bowl rather than leaving the corners open.
           */
          const off = (ax === 'x' ? hxP : hzP) + gap + depth / 2;
          const cx2 = ax === 'x' ? mx + sgn * off : mx;
          const cz2 = ax === 'x' ? mz : mz + sgn * off;
          /**
           * THE CORNERS ARE OPEN, AND THE FIRST ARM WRAPPED THEM AND DELIVERED
           * TWO STANDS OF FOUR. A stand that runs its own length PLUS both
           * corners overlaps the two stands on the other axis, and
           * `building x building` is forbidden — so the third and fourth were
           * refused by the first and second every time. Ending at the play
           * area's own corner makes the four abut exactly, and `overlaps()` is
           * strict, so all four stand. It is also what most grounds this size
           * actually are.
           */
          const halfA = (ax === 'x' ? hzP : hxP) + gap;
          const hxS = ax === 'x' ? depth / 2 : halfA;
          const hzS = ax === 'x' ? halfA : depth / 2;
          if (cx2 - hxS < isl.x0 || cx2 + hxS > isl.x1
            || cz2 - hzS < isl.z0 || cz2 + hzS > isl.z1) continue;
          const box = claimAt('building', cx2, cz2, hxS, hzS,
            { y0: 0, y1: R.tiers * R.tierRiseM + 3.0, owner: 'stadium:stand' });
          if (reg.conflict(box)) continue;
          features.push({
            kind: 'stand', x: cx2, z: cz2,
            long: 2 * halfA, deep: depth, tiers: R.tiers,
            rise: R.tierRiseM, tread: R.tierDeepM,
            /**
             * FACING THE PITCH: the stand's local +z points AWAY from the play
             * area, so the rake climbs outward and its local X — the long axis
             * — runs along the touchline. Three's Y rotation takes local (0, 1)
             * to `(sin, cos)`, so an east stand wants 90 and a north one 0.
             *
             * THE FIRST ARM HAD THESE THE OTHER WAY ROUND AND THE CLAIM DID
             * NOT. `hxS` is `depth / 2` for an `x` stand, i.e. the claim is
             * thin on the axis it stands off — correct — while the draw ran the
             * 50 m length along that same axis, so the four stands crossed the
             * pitch in a plus instead of ringing it. The registry could not see
             * it because the claim was right; only a frame from above could,
             * and did. CONTRACT §9.1, with a yaw.
             */
            yawDeg: ax === 'x' ? (sgn > 0 ? 90 : 270) : (sgn > 0 ? 0 : 180),
          });
          reg.claim(box);
        }
      }

      /**
       * THE BOUNDARY. A ball-stop behind the goals and a lower run along the
       * sides for a pitch; a single height for a court and a playground,
       * because a court's fence is uniform and a playground's is a barrier
       * rather than a net. `boundaryRun` puts the gate in, refuses every
       * segment the registry has already spoken for, and rides the chunk's own
       * mesh at no draw call.
       */
      const netH = variant === 'pitch' ? R.netHighM
        : variant === 'court' ? R.netLowM : R.playFenceM;
      boundaryRun({
        inset: DEAD_ZONE.edgeInset, seg: R.fenceSegmentM, halfT: R.fenceHalfT,
        height: netH, category: 'feature', owner: `sport:${variant}:fence`,
        gateSide, gateAt, gateHalf: 3.0,
        make: (x, z, yawDeg, axis) => {
          /**
           * THE COMMENT ABOVE SAID "a ball-stop behind the goals and a lower
           * run along the sides" FOR EIGHT SESSIONS AND THE CODE PASSED ONE
           * HEIGHT TO ALL FOUR SIDES — session 56 implements the sentence.
           * Behind the goals is the pair of sides the long axis points at:
           * the 'z'-axis runs when the pitch runs along x. The claim's y1
           * stays `netH` on every side, which over-claims the low sides in y
           * only — the conservative direction.
           */
          const behindGoal = (axis === 'z') === alongX;
          const low = variant === 'pitch' && !behindGoal;
          return {
            kind: 'edge',
            edge: variant === 'playground' ? 'railing' : low ? 'rail' : 'mesh',
            x, z, length: R.fenceSegmentM,
            height: low ? DEAD_ZONE.railHeight : netH, yawDeg,
          };
        },
      });

      /**
       * SOMEWHERE TO SIT: benches on the play area's two long sides, facing
       * it, long axis along the edge they serve — and for the court, one bank
       * of BARE SPECTATOR STEPS, which is the stand vocabulary with three
       * treads and no wall or roof. Sized from the play area, not authored.
       */
      if (variant === 'court') {
        const deep = 3 * 0.9;
        const off = (alongX ? hzP : hxP) + runOff + deep / 2 + 0.8;
        const sx2 = alongX ? mx : mx + off;
        const sz2 = alongX ? mz + off : mz;
        const long = pl * 0.6;
        const box = claimAt('building',
          sx2, sz2,
          alongX ? long / 2 : deep / 2, alongX ? deep / 2 : long / 2,
          { y0: 0, y1: 3 * 0.42 + 0.4, owner: 'sport:steps' });
        if (!reg.conflict(box)) {
          reg.claim(box);
          features.push({
            kind: 'stand', x: sx2, z: sz2, long, deep, tiers: 3,
            rise: 0.42, tread: 0.9, bare: true,
            /** The stands' own facing table: local +Z away from the courts. */
            yawDeg: alongX ? 0 : 90,
          });
        }
      }

      if (!stadium) {
        const offA = (alongX ? hzP : hxP) + runOff + 1.2;
        for (const sa of [-1, 1]) {
          for (const su of [-0.45, 0.45]) {
            const bx = alongX ? mx + su * 2 * hxP * 0.5 : mx + sa * offA;
            const bz = alongX ? mz + sa * offA : mz + su * 2 * hzP * 0.5;
            const half = propHalfWidth('bench', 0);
            const spot = claimAt('prop', bx, bz, half, half, { owner: 'sport:bench' });
            if (reg.conflict(spot, 0, PROP_SETBACKS)) continue;
            reg.claim(spot);
            props.push({ x: bx, z: bz, yawDeg: alongX ? 0 : 90, refDeg: 0, kerb: false,
              kind: 'bench', scale: 1.0, variant: 0,
              soil: featRng.range(0.62, 1.0), lean: 0, leanAzDeg: 0 });
          }
        }
      }
      /**
       * TREES ALONG THE BOUNDARY — the brief's own list, and the one entry
       * that reads from every distance. A ring inside the fence at a spacing
       * drawn from the island side; the registry refuses any that meet the
       * path, the pad, a stand or the fence, so the ring opens exactly where
       * the ground is already spoken for.
       */
      {
        const inset2 = DEAD_ZONE.edgeInset + 4.3;
        const tx0 = isl.x0 + inset2; const tx1 = isl.x1 - inset2;
        const tz0 = isl.z0 + inset2; const tz1 = isl.z1 - inset2;
        const step = (tx1 - tx0) / 8;
        for (const [ax, at2, from, to] of [
          ['x', tz0, tx0, tx1], ['x', tz1, tx0, tx1],
          ['z', tx0, tz0, tz1], ['z', tx1, tz0, tz1],
        ]) {
          for (let t = from + step / 2; t < to; t += step) {
            const px = ax === 'x' ? t : at2;
            const pz = ax === 'x' ? at2 : t;
            const scale = featRng.range(PROP_SCALE.min, PROP_SCALE.max);
            const variants = propVariantCount('tree');
            const tv = variants > 0 ? featRng.int(0, variants - 1) : 0;
            const pad2 = propHalfWidth('tree', tv) * scale;
            const spot = claimAt('prop', px, pz, pad2, pad2, { owner: 'sport:tree' });
            if (reg.conflict(spot, 0, PROP_SETBACKS)) continue;
            reg.claim(spot);
            props.push({ x: px, z: pz, yawDeg: yaw(), refDeg: 0, kerb: false,
              kind: 'tree', scale, variant: tv,
              soil: featRng.range(0.62, 1.0),
              lean: featRng.range(-1, 1), leanAzDeg: featRng.range(0, 360) });
          }
        }
      }

      /**
       * AND IT IS LIT, because a pitch nobody can use after four o'clock in
       * winter is a lawn with lines on it. `flood` is the site's own mast,
       * already modelled, already in the lamp pool and already claiming `site`
       * — four of them at the corners of the play area, aimed at its centre,
       * which is what a floodlit pitch looks like from anywhere in the city.
       */
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const x = mx + sx * (hxP + 3.0);
          const z = mz + sz * (hzP + 3.0);
          if (x < isl.x0 + 2 || x > isl.x1 - 2 || z < isl.z0 + 2 || z > isl.z1 - 2) continue;
          const box = claimAt('site', x, z, 0.7, 0.7,
            { y0: 0, y1: SITE.floodHeightM, owner: 'sport:flood' });
          if (reg.conflict(box)) continue;
          features.push({ kind: 'flood', x, z, height: SITE.floodHeightM, aimX: mx, aimZ: mz });
          reg.claim(box);
        }
      }
    } else if (kind === 'carpark') {
      /**
       * ═══════════════════════════════════════════════════════════════════════
       * A MULTI-STOREY CAR PARK — SESSION 48, TIER TWO. See `DECK_PARK` for how
       * a block-scale object gets placed at all and for where this one goes.
       * ═══════════════════════════════════════════════════════════════════════
       *
       * IT READS BY ITS SECTION AND NOT BY ITS DETAIL: horizontal open decks
       * stacked with nothing between them, a blank core at one end, and cars
       * parked on every level with sky behind them. That silhouette is unlike
       * every other mass in this city — a building here is a prism with windows
       * punched in it and this is a stack of gaps — which is the whole reason
       * the operator can name it from a moving car.
       */
      const P = DECK_PARK;
      const D = DEAD_ZONE;
      const surf = { x0: isl.x0, z0: isl.z0, x1: isl.x1, z1: isl.z1, kind: 'parkingGround', yKey: 'parking' };

      /** Every dimension off `DEAD_ZONE`'s own parking module. See `DECK_PARK`. */
      const deckLong = P.baysLong * D.bayW;
      const deckDeep = P.modulesDeep * (D.bayL * 2 + D.aisleW);
      const alongX = featRng.chance(0.5);
      const hx = (alongX ? deckLong : deckDeep) / 2;
      const hz = (alongX ? deckDeep : deckLong) / 2;
      const topY = P.levels * P.storeyM + P.upstandM;

      /**
       * `building` AND NOT `feature`, because that is what it is: a solid a
       * road may not run through, a pavement may not cross and nothing may be
       * placed inside. It is claimed BEFORE the surface is laid so the asphalt
       * is cut round it by the same `subtractBoxes` a park's grass is cut round
       * its paths with — a car park's deck does not stand on its own tarmac.
       */
      /**
       * THE CLAIM COVERS THE SCISSOR RAMP — session 56. The ramp run and its
       * upstand are drawn at local −Z, reaching `rampWidthM` beyond the deep
       * face, and the old claim stopped at the deck: a 6.2 m concrete
       * structure on ground the registry had never been told about. The claim
       * centre shifts half the ramp toward it, so nothing is over-claimed on
       * the far side.
       */
      const rampR = P.rampWidthM / 2;
      const box = claimAt('building',
        mx - (alongX ? 0 : rampR), mz - (alongX ? rampR : 0),
        hx + (alongX ? 0 : rampR), hz + (alongX ? rampR : 0),
        { y0: 0, y1: topY, owner: 'carpark:deck' });
      const built = !reg.conflict(box);
      if (built) {
        reg.claim(box);
        features.push({
          kind: 'deckpark', x: mx, z: mz, yawDeg: alongX ? 0 : 90,
          long: deckLong, deep: deckDeep, levels: P.levels, storey: P.storeyM,
          upstand: P.upstandM, columnEvery: P.columnEveryM, column: P.columnM,
          ramp: P.rampWidthM, core: P.coreM,
        });
        /**
         * THE CARS ON THE DECKS, AND THEY ARE THE SAME `parked` FEATURE THE
         * SURFACE LOT USES — with a `lift`, which is the one field the feature
         * loop gained for this. A deck park with empty decks is a concrete
         * frame; what says "car park" from the street is a row of roofs behind
         * an upstand with sky above them.
         *
         * NOT CLAIMED. A car standing on the fourth deck is inside the
         * `building` claim above, and claiming it as `prop` would report the
         * structure colliding with its own contents — which is `emitcensus`'s
         * self-pair case, and the reason the deck is one claim rather than
         * sixty.
         */
        for (let k = 1; k <= P.levels; k++) {
          for (let i = 0; i < P.carsPerDeck; i++) {
            const u = ((i + 0.5) / P.carsPerDeck - 0.5) * (deckLong - 8);
            const v = (i % 2 ? 1 : -1) * (D.bayL + D.aisleW) / 2;
            features.push({
              kind: 'parked', vehicle: featRng.chance(0.22) ? 'van' : 'car',
              x: mx + (alongX ? u : v), z: mz + (alongX ? v : u),
              yawDeg: (alongX ? 90 : 0) + (i % 2 ? 180 : 0),
              chroma: featRng.int(0, 5), lift: k * P.storeyM + 0.13,
            });
          }
        }
      }
      for (const g of subtractBoxes([surf], [...islandSolids(), ...(built ? [box] : [])])) ground.push(g);

      /**
       * AND THE APRON'S LIGHTING, WHICH IS THE SURFACE LOT'S OWN — SESSION 54.
       *
       * `LOW_DETAIL_PROPS.carpark` already says *"a deck park's apron is a car
       * park's apron"* and `DEAD_ZONE.carpark` takes `parking`'s own 30 m
       * lighting square, so the one thing left that did not follow was the
       * fixture that square is derived FROM. `placeprobe --light` printed this
       * kind at 0.00 lamps and 0.00 floods a chunk. The loop is `parking`'s,
       * unchanged; the deck itself is a `building` claim, so `reg.conflict`
       * refuses the columns that would stand inside it and what is left is
       * exactly the apron.
       */
      {
        const nCol = Math.max(1, Math.floor((isl.x1 - isl.x0) / D.columnEvery));
        const colStep = (isl.x1 - isl.x0) / nCol;
        for (let a = 0; a < nCol; a++) {
          for (let bcol = 0; bcol < nCol; bcol++) {
            const x = isl.x0 + (a + 0.5) * colStep;
            const z = isl.z0 + (bcol + 0.5) * colStep;
            const cbox = claimAt('feature', x, z, 0.42, 0.42,
              { y0: 0, y1: D.columnHeight, owner: 'carpark:column' });
            if (reg.conflict(cbox)) continue;
            features.push({ kind: 'lamp', x, z, height: D.columnHeight });
            reg.claim(cbox);
          }
        }
      }

      /** The same knee rail the surface lot has, and one gate. */
      const gateSide = featRng.int(0, 3);
      boundaryRun({
        inset: D.edgeInset, seg: D.edgeSegment, halfT: 0.07, height: D.railHeight,
        category: 'feature', owner: 'carpark:rail',
        gateSide, gateAt: featRng.range(0.3, 0.7), gateHalf: D.gateHalf,
        make: (x, z, yawDeg) => ({
          kind: 'edge', edge: 'rail', x, z, length: D.edgeSegment, height: D.railHeight, yawDeg,
        }),
      });
    } else if (PROGRAM_KINDS.has(kind)) {
      /**
       * ═══════════════════════════════════════════════════════════════════════
       * THE PROGRAM — SESSION 49. Eight places out of three feature kinds.
       * ═══════════════════════════════════════════════════════════════════════
       *
       * See `PROGRAM` for what each one is and where it goes; the placement
       * conditions are up in `generateChunk`'s kind selection. Everything here
       * is composition: `shed`, `canopy` and `tower` are the vocabulary
       * `city.js` gained this session, and the surfaces, boundaries, floods,
       * containers and parked vehicles are what sessions 40 and 48 already
       * built.
       */
      const G = PROGRAM;
      const D = DEAD_ZONE;
      const alongX = featRng.chance(0.5);

      /**
       * ═══════════════════════════════════════════════════════════════════════
       * SESSION 54, ITEM 5 — THE TWO SPREADS THAT MEASURED EXACTLY ZERO.
       * ═══════════════════════════════════════════════════════════════════════
       *
       * The brief's item 5 asked for the spread of three quantities to be
       * MEASURED before anything was changed. `tools/placeprobe.mjs --program`,
       * seed 1337 over the 17 x 17:
       *
       *   HEIGHT   residential mass  n 2058  sd 26.77 m  max 152.03
       *            all program mass  n   37  sd  6.10 m  max  34.00
       *            and WITHIN a kind the sd is EXACTLY 0.00 for school,
       *            industrial, market, port and carpark, because every
       *            dimension in `PROGRAM` is a constant with no roll behind it.
       *
       *   TONE     residential facade luminance: 4 distinct values, sd 0.175,
       *            range 0.101-0.571 — a factor of 5.7, through four materials
       *            and five eras.
       *            program: 1 or 2 distinct values WITHIN a kind, sd 0.000 for
       *            six of the nine, and the five eras and five window rhythms
       *            reach ZERO program masses.
       *
       * SO THE OPERATOR'S TWO OBSERVATIONS ARE BOTH TRUE AND BOTH UNDERSTATED:
       * it is not that the program is low and samey, it is that within a kind
       * it has no variance at all.
       *
       * THE MATERIAL IS THE CITY'S OWN AND THE KIND'S COLOUR BECOMES THE TRIM,
       * which is the honest architecture as well as the bigger move. A school
       * does not read as a school by being 0.40 grey — it reads by its long low
       * block, its ribbon windows, its court and its railing, every one of
       * which is unchanged. What a school built in this city IS made of is what
       * everything else here is made of, so the body takes a `CITY_MATERIALS`
       * albedo at `DISTANT.materialWeights` — the DELIVERED population weights
       * STATE 53 §3.4 measured, not the table's equal ones, because brick is
       * the commonest and the darkest by a factor of four.
       *
       * ITS OWN NAMED STREAM. CONTRACT §6: a roll taken from `featRng` would
       * re-phase every mass position, every fence gate and every flood on every
       * program island in the city, and the diff would read as "the tone change
       * moved the buildings". `program` is new, so nothing above it moves.
       */
      const progRng = chunkRng(rootSeed, cx, cz, 'program');
      /** The body material, from the city's own four at the delivered weights. */
      const bodyAlbedo = () =>
        CITY_MATERIALS[MATERIAL_NAMES[weightedIndex(progRng.next, DISTANT.materialWeights)]].albedo;
      /**
       * A DIMENSION'S ROLL, AND `PROGRAM`'S CONSTANT IS ITS MEDIAN RATHER THAN
       * ITS VALUE. Multiplicative and not additive: a 6 m depot roof and a 34 m
       * hospital tower cannot share an additive spread, and every one of these
       * numbers is a height, which is the quantity `HEIGHT_DISTRIBUTION` is
       * log-normal in for the same reason.
       */
      const sz = (base, lo, hi) => base * (lo + progRng.next() * (hi - lo));
      /** A storey count, which is what a floored mass's height is made of. */
      const floorsRoll = (lo, hi) => lo + Math.floor(progRng.next() * (hi - lo + 1));

      /**
       * ONE HELPER, AND IT COMPUTES THE CLAIM FROM THE SAME `alongX` THE DRAW
       * USES — which is session 48's stadium defect fixed before it can happen
       * again. That stand's claim was thin on the axis it stood off (correct)
       * while the draw ran its length along that same axis, so four stands
       * crossed a pitch in a plus and no gate could see it, because the CLAIM
       * was right. Here there is one expression: `yawDeg` and the half-extents
       * come out of the same boolean.
       */
      /**
       * A ROOF ON POSTS IS `canopy` AND NOT `building`, AND THE FIRST ARM WAS
       * `building` AND DELIVERED A MARKET HALL WITH NOTHING UNDER IT.
       *
       * `occupancy.js` says it in one line: *"the part of a thing that is over
       * your head", and "it conflicts with SOLIDS ONLY — a canopy inside a wall is
       * wrong and a canopy over a carriageway is a street tree."* A market's
       * whole point is that things stand under it, and `building x prop` is
       * forbidden, so ten stalls were refused by their own roof — 2 halls,
       * 0 stalls. Claimed from the UNDERSIDE up, so the roof is spoken for and
       * the ground under it is not.
       */
      const placeMass = (fkind, x, z, long, deep, top, owner, extra, opts = {}) => {
        const cat = opts.category || 'building';
        const base = opts.base || 0;
        /**
         * A `dock` SHED'S PLATFORM STANDS OUTSIDE ITS OWN WALL — `SHED.dockReachM`,
         * claimed on both sides because which side it is on depends on `alongX`
         * and guessing that is how this file has been wrong three times.
         */
        const grow = fkind === 'shed'
          ? SHED.faceProudM + (extra && extra.style === 'dock' ? SHED.dockReachM : 0)
          : 0;
        const hx = (alongX ? long / 2 : deep / 2 + grow);
        const hz = (alongX ? deep / 2 + grow : long / 2);
        /**
         * IT SEARCHES, AND THE FIRST ARM DID NOT — which delivered a WHARF WITH
         * NO SHED ON IT. A port chunk is one the river envelope reaches, so
         * `islandSolids()` carries the water and the one nominal position was
         * refused by it; the same happened to a fire station whose island had
         * a landmark on it. One try is a placement rule that works only where
         * nothing else is, which is not where these uses go.
         *
         * The sweep is the nominal spot first and then the island's own
         * quarters, so the answer is deterministic and the smallest move —
         * the same shape `viaductPiers`' nudge search has.
         */
        for (const [du, dv] of [[0, 0], [0, 26], [0, -26], [22, 0], [-22, 0],
          [0, 44], [0, -44], [30, 22], [-30, -22]]) {
          const px = x + (alongX ? du : dv);
          const pz = z + (alongX ? dv : du);
          if (px - hx < isl.x0 || px + hx > isl.x1 || pz - hz < isl.z0 || pz + hz > isl.z1) continue;
          const box = claimAt(cat, px, pz, hx, hz, { y0: base, y1: top, owner });
          if (reg.conflict(box)) continue;
          reg.claim(box);
          /**
           * A MASS'S ONE-SIDED FACE — a dock apron, a row of bay doors — is
           * drawn at local +Z and therefore lands at the island's own +v
           * (session 56, once `put`'s offsets stopped mirroring the yaw-90
           * branch). A mass whose yard is on its −v side passes `flip` and
           * turns 180; the dock-reach claim above is grown on BOTH sides, so
           * the registry is indifferent to the choice by construction.
           */
          const f = {
            kind: fkind, x: px, z: pz, yawDeg: (alongX ? 0 : 90) + (opts.flip ? 180 : 0),
            length: long, depth: deep, ...extra,
          };
          features.push(f);
          return f;
        }
        return null;
      };
      /** Along the island's long axis from its centre, and across it. */
      const at = (u, v) => ({ x: mx + (alongX ? u : v), z: mz + (alongX ? v : u) });
      /**
       * A TOWER, WITH THE SAME SEARCH THE MASSES GET. The first arm put the
       * hospital's tower at the slab's own centre line and `building x
       * building` refused **every one of them** — two hospitals, no towers, and
       * the tower is the whole reason a hospital reads from a distance. A
       * vertical goes BESIDE the slab it serves, not inside it.
       */
      const placeTower = (x, z, half, height, cap, albedo, owner) => {
        for (const [du, dv] of [[0, 0], [0, 18], [0, -18], [16, 0], [-16, 0], [0, 30], [0, -30]]) {
          const px = x + (alongX ? du : dv);
          const pz = z + (alongX ? dv : du);
          if (px - half < isl.x0 || px + half > isl.x1
            || pz - half < isl.z0 || pz + half > isl.z1) continue;
          const box = claimAt('building', px, pz, half, half,
            { y0: 0, y1: height + half * 3.4, owner });
          if (reg.conflict(box)) continue;
          reg.claim(box);
          features.push({ kind: 'tower', x: px, z: pz, half, height, cap, albedo, yawDeg: 0 });
          return true;
        }
        return false;
      };
      /** The island's own surface, cut round everything standing on it. */
      const lay = (gkind, yKey) => {
        const surf = { x0: isl.x0, z0: isl.z0, x1: isl.x1, z1: isl.z1, kind: gkind, yKey };
        for (const g of subtractBoxes([surf], islandSolids())) ground.push(g);
      };
      /** A boundary of one treatment with one gate, refused wherever a mass is. */
      const fence = (edge, height, owner) => boundaryRun({
        inset: D.edgeInset, seg: D.edgeSegment, halfT: 0.07, height,
        category: 'feature', owner,
        gateSide: featRng.int(0, 3), gateAt: featRng.range(0.3, 0.7), gateHalf: D.gateHalf,
        make: (x, z, yawDeg) => ({ kind: 'edge', edge, x, z, length: D.edgeSegment, height, yawDeg }),
      });
      /** Two site floods aimed at the middle, the way a yard and a pitch are lit. */
      const floods = (n) => {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + 0.6;
          /** Session 50: the ring is the island's own, not a flat 40 m. */
          const p = at(Math.cos(a) * halfU * 0.76, Math.sin(a) * halfV * 0.76);
          if (p.x < isl.x0 + 3 || p.x > isl.x1 - 3 || p.z < isl.z0 + 3 || p.z > isl.z1 - 3) continue;
          const box = claimAt('site', p.x, p.z, 0.7, 0.7,
            { y0: 0, y1: SITE.floodHeightM, owner: `${kind}:flood` });
          if (reg.conflict(box)) continue;
          features.push({ kind: 'flood', x: p.x, z: p.z, height: SITE.floodHeightM, aimX: mx, aimZ: mz });
          reg.claim(box);
        }
      };
      /**
       * ─────────────────────────────────────────────────────────────────────
       * SESSION 50: THE ISLAND'S OWN HALF-EXTENTS, WHICH IS WHAT EVERY FIXTURE
       * BELOW SHOULD HAVE BEEN SIZED FROM AND WAS NOT.
       *
       * Session 49 put a BUILDING-scale fixture set on a BLOCK-scale island: a
       * flood ring at a flat 40 m, a stack spread of 34, a school yard of
       * 68 x 44, a church square of 52 x 32 — every one a constant, on an
       * island that is 104.6 m square. The remainder is what the operator has
       * been calling *"wide flat areas with nothing on them"* since session 41.
       * `lay()` already covers the whole island; nothing else did.
       *
       * On the same axes `at(u, v)` uses, so a fixture written in `at` co-ordinates
       * can be clamped against them without thinking about `alongX` twice —
       * which is CONTRACT §9's shape and the reason session 48's stands ended
       * up rotated ninety degrees off their own claim.
       */
      const halfU = (alongX ? isl.x1 - isl.x0 : isl.z1 - isl.z0) / 2;
      const halfV = (alongX ? isl.z1 - isl.z0 : isl.x1 - isl.x0) / 2;

      /** Every SOLID standing on this island, including the masses just placed. */
      const hereSolids = () => reg.all().filter((c) => (c.kind === 'landmark' || c.kind === 'precinct' || c.kind === 'block'
        || c.kind === 'water' || c.kind === 'building')
        && c.x1 > isl.x0 && c.x0 < isl.x1 && c.z1 > isl.z0 && c.z0 < isl.z1);

      /**
       * A PATH THE WIDTH OF THE ISLAND, cut round whatever stands on it. The
       * park has had exactly this since session 19 and no other kind could
       * reach it, so a churchyard was a lawn you could not walk across. Two
       * spines at the island's own centre lines, `PARK.pathHalf` wide, claimed
       * `path` — which forbids `prop` and `feature`, so the scatter that runs
       * later puts its trees BESIDE the path rather than on it, without either
       * routine knowing about the other.
       */
      const layPath = (owner) => {
        const h = PARK.pathHalf;
        const runs = [
          { x0: mx - h, x1: mx + h, z0: isl.z0, z1: isl.z1, kind: 'path', yKey: 'pathEW' },
          { x0: isl.x0, x1: isl.x1, z0: mz - h, z1: mz + h, kind: 'path', yKey: 'pathEW' },
        ];
        let n = 0;
        for (const q of subtractBoxes(runs, hereSolids())) {
          ground.push(q);
          reg.claim(claimBox('path', q.x0, q.z0, q.x1, q.z1, { owner }));
          n++;
        }
        return n;
      };

      /**
       * LAMPS ALONG THE PATHS THAT WERE JUST LAID — SESSION 54, and it is
       * `park`'s own arrangement moved one branch over rather than a second
       * one written.
       *
       * A park has had post-tops on its loop since session 19: `PARK.lampEvery`
       * = 16 m along the run, `PARK.pathHalf + 0.9` off the edge of the paving,
       * 4.20 m tall, `LIGHT.parkLampCandela` behind them. Session 50 gave the
       * churchyard the PATH and left it in the dark; `placeprobe --light`
       * printed `church` at 0.00 lamps and 0.00 floods a chunk, which is one
       * of the four kinds in the city with no light of any kind. A churchyard
       * is a park with graves in it, so it is lit like a park.
       *
       * OFF THE PATH AND NOT ON IT. The spines are claimed `path`, which
       * forbids `feature`, so a lamp on the centre line would be refused by
       * the paving it is there to light — the offset is what makes the run
       * possible at all, and it is the same 0.9 m a park's is.
       *
       * ONE SIDE PER SPINE AND STAGGERED, WHICH IS HALF WHAT THE FIRST ARM
       * DREW. Both sides of both spines is 26 lamps on a 104.6 m island —
       * more than the PARK's own 24, on a place that is quieter than a park —
       * and every one of them is a candidate competing for the same 98 pool
       * slots the street lamps use (`updateLampPool` cuts at 128 m). A path
       * lit from alternating sides is what `LUMINAIRE`'s stagger already
       * argues for on a carriageway: consecutive pools overlap ALONG the walk
       * and stop short of each other ACROSS it, so one side is not a dimmer
       * arrangement, it is the same arrangement without the second row.
       */
      const pathLamps = (owner) => {
        const off = PARK.pathHalf + 0.9;
        let n = 0;
        for (const [axis, at0, from, to, side, phase] of [
          ['x', mz, isl.x0, isl.x1, -1, 0.5],
          ['z', mx, isl.z0, isl.z1, +1, 1.0],
        ]) {
          for (let t = from + PARK.lampEvery * phase; t < to; t += PARK.lampEvery) {
            const x = axis === 'x' ? t : at0 + side * off;
            const z = axis === 'x' ? at0 + side * off : t;
            const box = claimAt('feature', x, z, 0.34, 0.34,
              { y0: 0, y1: PARK.lampHeight, owner });
            if (reg.conflict(box)) continue;
            features.push({ kind: 'lamp', x, z, height: PARK.lampHeight });
            reg.claim(box);
            n++;
          }
        }
        return n;
      };

      /**
       * BAYS ACROSS THE ISLAND rather than across the building. The hospital's
       * own row is `for (i < 14) at(-30 + i * 4.6, 34)` — fourteen marks and
       * two constants, on an apron four times that wide. Here the column count
       * comes OUT of `2 * halfU / bayW`, and every mark is offered to the
       * registry as `ground` first — which forbids exactly `building`,
       * `landmark` and `water` — so paint stops at whatever stands on the
       * island instead of being drawn under it, and a bay under a CANOPY is
       * still a bay, which is what a covered depot stand is.
       */
      const bayRows = (vs, owner) => {
        const cols = Math.max(1, Math.floor((halfU * 2 - 6) / D.bayW));
        let n = 0;
        for (const v of vs) {
          for (let c = 0; c < cols; c++) {
            const a = at(-halfU + 3 + (c + 0.5) * D.bayW, v);
            const probe = claimAt('ground', a.x, a.z,
              alongX ? D.bayW / 2 : D.bayL / 2, alongX ? D.bayL / 2 : D.bayW / 2,
              { y0: 0, y1: 0.02, owner });
            if (reg.conflict(probe)) continue;
            markings.push({ x: a.x, z: a.z,
              length: alongX ? 0.10 : D.bayL, width: alongX ? D.bayL : 0.10,
              yawDeg: 0, kind: 'bay' });
            n++;
          }
        }
        return n;
      };

      /**
       * THE KERB LINE WAS BUILT, LOOKED AT, AND TAKEN OUT AGAIN — session 50,
       * and the reason is worth more than the fixture was.
       *
       * The brief asks for *"an apron, a kerb line, a gate"*, so a `kerbLine`
       * helper laid four island-length painted runs inset 4 m, segmented and
       * probed exactly as `bayRows` is. It delivered about fifty marks an
       * island and **it is invisible in both frames.** From 78 m a 0.16 m line
       * is about one pixel; from the pavement it is white paint on pale
       * hardstanding, which is white on near-white — `MARKING_ALBEDO` against
       * `GROUND.carriageway` is a contrast a painted line simply does not have
       * on this surface.
       *
       * SO THE RULE THIS ISLAND-SCALE ITEM ACTUALLY YIELDS: on pale ground, the
       * fixture that reads is a change of SURFACE or an object with HEIGHT, not
       * paint. `bayRows` survives because a bay is read as a RHYTHM of many
       * marks rather than as one line, and the eye finds a repeat where it
       * cannot find an edge.
       */

      /** Stacked containers, which every freight use in this list has. */
      const stack = (n, spread = halfU - 8) => {
        for (let i = 0; i < n; i++) {
          /** Session 50: to the FENCE LINE by default, not to a constant 34. */
          const p = at(featRng.range(-spread, spread),
            featRng.range(-Math.min(spread, halfV - 8), Math.min(spread, halfV - 8)));
          const half = propHalfWidth('container', 0) * 1.1;
          const spot = claimAt('prop', p.x, p.z, half, half, { owner: 'container' });
          if (reg.conflict(spot, 0, PROP_SETBACKS)) continue;
          reg.claim(spot);
          props.push({
            x: p.x, z: p.z, yawDeg: yaw(), refDeg: 0, kerb: false, kind: 'container',
            scale: 1.1, variant: 0, soil: featRng.range(0.5, 0.95),
            lean: 0, leanAzDeg: 0, core: true,
          });
        }
      };

      if (kind === 'school') {
        /**
         * A LONG LOW BLOCK ALONG ONE EDGE AND A HARD PLAYGROUND IN FRONT OF IT,
         * which is what a school is from the air and is the only arrangement
         * that reads as one rather than as an office with a yard.
         */
        lay('grass', 'grass');
        /**
         * `hardGround` AND NOT `sportGround` — SESSION 60, AND IT IS A RENAME
         * THAT CHANGES NO PIXEL.
         *
         * Both kinds are the same macadam at the same datum with the same
         * porosity; what separates them is the CATEGORY `city.js` claims for
         * the delivered rectangle. `sportGround` is a PLAY AREA now and
         * refuses a prop (`occupancy.js` → `pitch`); a school's hard yard
         * carries bins, cycle stands and bollards on purpose and must not.
         * The name was borrowed for its colour and is given back.
         *
         * WHAT IS LEFT ON IT IS A MEASURED QUESTION AND NOT A REPAIR. Over
         * 25 × 25 chunks at seed 1337 the four school yards in range carry
         * **8 trees** growing out of the tarmac, and the sixteen church
         * squares carry **98**. A tree in a paved square is a tree in a tree
         * pit and a tree in the middle of a playground is not, and the
         * category tool cannot tell them apart: `pitch` refuses every `prop`,
         * and a bench on a churchyard square is right. Splitting `prop` into
         * furniture and PLANTING is what would say it, and it is a change to
         * every prop claim in the project rather than to this line.
         */
        const yard = { kind: 'hardGround', yKey: 'sport',
          x0: mx - (alongX ? 34 : 22), x1: mx + (alongX ? 34 : 22),
          z0: mz - (alongX ? 22 : 34), z1: mz + (alongX ? 22 : 34) };
        for (const g of subtractBoxes([yard], islandSolids())) ground.push(g);
        const p = at(0, -34);
        /** Two to four storeys. `G.schoolFloors` 2 is the bottom of the band. */
        const schoolFloors = floorsRoll(G.schoolFloors, G.schoolFloors + 2);
        const schoolH = G.schoolStoreyM * schoolFloors;
        placeMass('shed', p.x, p.z, G.schoolLongM, G.schoolDeepM,
          schoolH + 1.1, 'school:block',
          { height: schoolH, floors: schoolFloors, style: 'window',
            albedo: bodyAlbedo(), trim: [0.40, 0.375, 0.335] });
        /** A court on the hard yard, so the playground is a playground. */
        for (const sgn of [-1, 1]) {
          const a = at(sgn * 14, 0);
          markings.push({ x: a.x, z: a.z, length: alongX ? 0.12 : 26, width: alongX ? 26 : 0.12,
            yawDeg: 0, kind: 'sport' });
        }
        layPath('school:path');
        /**
         * A PLAY FRAME AND A SWING ON THE GRASS — SESSION 54, and it is
         * `recreation`'s own pair moved one branch over.
         *
         * ITEM 4's QUESTION, ASKED OF THIS KIND: *"does its vocabulary contain
         * the thing that MAKES it that place?"* A school delivered a long low
         * block, a hard yard with a court marked on it, a railing, two floods
         * and a scatter of trees and bins — every one of which an office with a
         * car park also has. What only a school has is the equipment, and
         * `recreation` has had a `play` feature with a frame and a swing since
         * session 48. Placed on the GRASS rather than the yard, because that
         * is where it goes and because the yard already carries the court.
         *
         * AFTER `layPath` AND NOT BEFORE, WHICH IS THE WHOLE OF WHY THE FIRST
         * ARM WAS WRONG. `layPath` CLAIMS its two spines unconditionally — a
         * path is a surface and a surface is laid, not negotiated — so a
         * feature claimed before it is a feature the path is then drawn over.
         * `citycheck` reported it on the first run:
         * `feature(school:frame) x path(school:path)` at 12.152 m2, in the
         * GENERATOR's own claims, which is the one list that is supposed to be
         * impossible to break. The order is the fix, not a test.
         */
        for (const [pkind, hw, hh] of [['frame', 3.2, 3.0], ['swing', 2.6, 2.4]]) {
          /** The frame's claim covers its slide — see the recreation copy. */
          const claimHalf = pkind === 'frame' ? hw * 1.4 + 1.7 / 2 : hw;
          for (let t = 0; t < 3; t++) {
            const p2 = at(featRng.range(-halfU + 12, halfU - 12), featRng.range(6, halfV - 12));
            const box = claimAt('feature', p2.x, p2.z, claimHalf, claimHalf, { y0: 0, y1: hh, owner: `school:${pkind}` });
            if (reg.conflict(box)) continue;
            features.push({
              kind: 'play', play: pkind, x: p2.x, z: p2.z, half: hw, height: hh,
              deck: RECREATION.frameDeckM, yawDeg: yaw(),
            });
            reg.claim(box);
            break;
          }
        }
        fence('railing', 1.6, 'school:fence');
        floods(2);
      } else if (kind === 'hospital') {
        /**
         * A SLAB WITH A TOWER ON IT AND AN AMBULANCE BAY UNDER A CANOPY. The
         * tower is what makes it read from a distance — every other mass in
         * this district is a prism of about one height, and a hospital is the
         * one civic building that is allowed to be taller than its street.
         */
        lay('parkingGround', 'parking');
        const p = at(0, -20);
        const hospFloors = floorsRoll(G.hospFloors - 1, G.hospFloors + 3);
        const hospH = G.hospStoreyM * hospFloors;
        const hospBody = bodyAlbedo();
        const slab = placeMass('shed', p.x, p.z, G.hospLongM, G.hospDeepM,
          hospH + 1.1, 'hospital:slab',
          { height: hospH, floors: hospFloors, style: 'window',
            albedo: hospBody, trim: [0.46, 0.452, 0.435] });
        const t = at(-G.hospLongM * 0.28, -20 + G.hospDeepM / 2 + G.hospTowerHalfM + 1.5);
        /** Same rule: the tower is what the slab is tall for. */
        if (slab) {
          /**
           * THE TOWER IS WHERE A PROGRAM BUILDING IS ALLOWED TO BE TALL, and
           * it is the one mass in this whole branch that can reach the band the
           * residential city lives in. 0.7 to 1.65 of 34 m is 24 to 56 m.
           */
          placeTower(t.x, t.z, G.hospTowerHalfM, sz(G.hospTowerM, 0.7, 1.65), 'flat',
            hospBody, 'hospital:tower');
        }
        const c = at(G.hospLongM * 0.22, 4);
        placeMass('canopy', c.x, c.z, G.hospBayLongM, G.hospBayDeepM, G.hospBayHighM + 1.6,
          'hospital:bay', { height: G.hospBayHighM, albedo: [0.42, 0.40, 0.38] },
          { category: 'canopy', base: G.hospBayHighM });
        /**
         * VISITORS' PARKING, MARKED, WHICH IS HALF OF WHAT A HOSPITAL SITE IS —
         * and session 49 drew fourteen marks from `-30 + i * 4.6`, two constants
         * on an apron four times that wide. Three rows the island's own width.
         */
        bayRows([halfV * 0.44, halfV * 0.58, halfV * 0.72], 'hospital:bays');
        fence('rail', D.railHeight, 'hospital:rail');
        floods(2);
      } else if (kind === 'firestation') {
        /**
         * BAY DOORS FACING THE STREET AND A HOSE TOWER BEHIND THEM. The doors
         * are the whole silhouette — a fire station is the one building in a
         * street whose ground floor is mostly opening — and the tower is what
         * says it is not a bus garage.
         */
        lay('siteGround', 'site');
        const p = at(0, -26);
        const fireH = sz(G.fireHighM, 0.9, 1.35);
        const fireBody = bodyAlbedo();
        const house = placeMass('shed', p.x, p.z, G.fireLongM, G.fireDeepM, fireH + 1.1, 'fire:house',
          { height: fireH, floors: 2, style: 'bay', bays: G.fireBays,
            albedo: fireBody, trim: [0.38, 0.30, 0.28] });
        const t = at(G.fireLongM * 0.5 + G.fireTowerHalfM + 1.0, -26);
        /**
         * A VERTICAL ONLY IF ITS OWN BUILDING STOOD — session 49. `placeMass`
         * has returned the record or `null` since the port lost nine sheds to
         * the river, and NOTHING READ THE RETURN, so a chunk whose mass was
         * refused still got its tower: at seed 1337 one fire station of two
         * delivered an 18 m hose tower alone in an empty yard, because the
         * viaduct's own claim sits across that island and a 34 x 14 shed does
         * not fit between the piers where a 6.4 m tower does. A yard with a
         * fence and no shed reads as a yard, which is fine; a lone tower reads
         * as a mistake. The refusal was CORRECT — this is the consequence of it
         * that was not carried through.
         */
        if (house) {
          placeTower(t.x, t.z, G.fireTowerHalfM, sz(G.fireTowerM, 0.8, 1.8), 'flat',
            fireBody, 'fire:tower');
        }
        const v = at(-10, 10);
        parkVehicle(v.x, v.z, alongX ? 0 : 90, 'van');
        /**
         * STAFF BAYS AT THE FAR END, AND THE APPLIANCE RUN LEFT CLEAR. Two rows
         * across the island's full width rather than fourteen marks in front of
         * the building — but NOT across the apron itself, because the ground a
         * pump reverses onto is the one part of a fire station that is empty on
         * purpose. Sized by `bayRows` from `2 * halfU / bayW`.
         */
        bayRows([halfV * 0.52, halfV * 0.66], 'fire:bays');
        fence('palisade', D.palisadeHeight, 'fire:palisade');
        floods(2);
      } else if (kind === 'industrial') {
        /**
         * SHEDS WITH LOADING DOCKS, HARDSTANDING AND CONTAINERS. It is the
         * fall-through for every use in this list whose own condition failed,
         * which is right rather than convenient: land by the water, land under
         * a viaduct and land nobody wants is industrial land, and that is the
         * one sentence all three of those have in common.
         */
        lay('yardGround', 'yard');
        for (let i = 0; i < G.sheds; i++) {
          const p = at(0, -30 + i * 34);
          /** Rolled PER SHED, so the two on one estate are not twins. */
          const sh = sz(G.shedHighM, 0.75, 1.7);
          placeMass('shed', p.x, p.z, G.shedLongM, G.shedDeepM, sh + 1.1,
            `industrial:shed${i}`,
            { height: sh, floors: 1, style: 'dock',
              albedo: bodyAlbedo(), trim: [0.30, 0.298, 0.286] });
        }
        stack(6);
        for (let i = 0; i < 2; i++) {
          const v = at(featRng.range(-30, 30), featRng.range(-6, 18));
          parkVehicle(v.x, v.z, alongX ? 0 : 90, 'van');
        }
        fence('palisade', D.palisadeHeight, 'industrial:palisade');
        floods(3);
      } else if (kind === 'market') {
        /**
         * ONE LARGE ROOF WITH AIR UNDER IT AND A FORECOURT IN FRONT. Nothing
         * else in this city is a span — every roof here is the lid of a prism —
         * so a market hall reads by being the one place you can see under.
         */
        lay('parkingGround', 'parking');
        const p = at(0, -8);
        const marketH = sz(G.marketHighM, 0.85, 1.5);
        placeMass('canopy', p.x, p.z, G.marketLongM, G.marketDeepM, marketH + 2.0,
          'market:hall', { height: marketH, albedo: [0.30, 0.22, 0.16] },
          { category: 'canopy', base: marketH });
        /** The stalls under it: crates and cabinets in two rows, not a scatter. */
        for (let i = 0; i < 10; i++) {
          const a = at(-26 + i * 5.8, -8 + (i % 2 ? 7 : -7));
          const half = propHalfWidth('stack', 0);
          const spot = claimAt('prop', a.x, a.z, half, half, { owner: 'stack' });
          if (reg.conflict(spot, 0, PROP_SETBACKS)) continue;
          reg.claim(spot);
          props.push({ x: a.x, z: a.z, yawDeg: alongX ? 0 : 90, refDeg: 0, kerb: false,
            kind: 'stack', scale: 1.0, variant: 0, soil: 0.7, lean: 0, leanAzDeg: 0, core: true });
        }
        floods(2);
      } else if (kind === 'depot') {
        /**
         * A PARKING CANOPY WITH ROWS OF VEHICLES UNDER IT AND A WORKSHOP BESIDE
         * IT. The rows are what makes it a depot: a car park's bays are
         * scattered by occupancy and a depot's are full, in line, all one way.
         */
        lay('parkingGround', 'parking');
        const p = at(0, -14);
        const depotH = sz(G.depotHighM, 0.9, 1.5);
        placeMass('canopy', p.x, p.z, G.depotLongM, G.depotDeepM, depotH + 2.0,
          'depot:cover', { height: depotH, albedo: [0.32, 0.318, 0.308] },
          { category: 'canopy', base: depotH });
        for (let i = 0; i < 12; i++) {
          const a = at(-26 + (i % 6) * 10.4, -22 + Math.floor(i / 6) * 15);
          parkVehicle(a.x, a.z, alongX ? 90 : 0, 'van');
        }
        /**
         * AND A ROW STANDING OUT IN THE OPEN, BECAUSE A ROOF HIDES WHAT IS
         * UNDER IT FROM ABOVE. Every one of the twelve above is inside the
         * cover's own footprint, which is right from the pavement and useless
         * from the air: the aerial frame of this chunk was a blank 62 m roof on
         * an empty apron, which is the operator's session-46 defect — *"wide
         * flat areas with nothing on them"* — rebuilt by a session trying to
         * fix it. Four outside and a row of bays give the apron something to be.
         */
        for (let i = 0; i < 4; i++) {
          const a = at(-16 + i * 10.4, 10);
          parkVehicle(a.x, a.z, alongX ? 90 : 0, 'van');
        }
        /** Session 50: rows the island's width, not ten marks at a constant. */
        bayRows([halfV * 0.30, halfV * 0.44, halfV * 0.58], 'depot:bays');
        const w = at(0, 30);
        const shopH = sz(G.depotShopHighM, 0.85, 1.5);
        placeMass('shed', w.x, w.z, G.depotShopLongM, G.depotShopDeepM, shopH + 1.1,
          'depot:shop', { height: shopH, floors: 1, style: 'dock',
            albedo: bodyAlbedo(), trim: [0.30, 0.298, 0.286] },
          /** The shop stands at +v with its vans and bays at lower v — its
           *  dock faces its own yard, not the boundary fence. Session 56. */
          { flip: true });
        fence('rail', D.railHeight, 'depot:rail');
        floods(3);
      } else if (kind === 'church') {
        /**
         * A NAVE AND A SPIRE, AND A SQUARE IN FRONT. The spire is the only
         * tapering silhouette in this city — every other vertical is a prism or
         * a lattice — so it reads at a distance no other building of its size
         * does, which is exactly what a spire is for.
         */
        lay('grass', 'grass');
        /** `hardGround`: the same macadam, and not a play area. See `school`. */
        const sq = { kind: 'hardGround', yKey: 'sport',
          x0: mx - (alongX ? 26 : 16), x1: mx + (alongX ? 26 : 16),
          z0: mz - (alongX ? 16 : 26), z1: mz + (alongX ? 16 : 26) };
        for (const g of subtractBoxes([sq], islandSolids())) ground.push(g);
        const p = at(6, -26);
        const naveH = sz(G.naveHighM, 0.85, 1.45);
        const churchBody = bodyAlbedo();
        const nave = placeMass('shed', p.x, p.z, G.naveLongM, G.naveDeepM, naveH + 1.1,
          'church:nave',
          { height: naveH, floors: 1, style: 'window',
            albedo: churchBody, trim: [0.34, 0.30, 0.25] });
        const t = at(6 - G.naveLongM * 0.5 - G.spireHalfM - 1.0, -26);
        /** A spire without its nave is the same misread as a hose tower without its bays. */
        if (nave) {
          /** 0.75 to 2.0 of 21 m is 16 to 42 m, which is a parish church and a
           *  cathedral, and both belong in a city of this size. */
          placeTower(t.x, t.z, G.spireHalfM, sz(G.spireM, 0.75, 2.0), 'spire',
            churchBody, 'church:spire');
        }
        /**
         * A PATH TO THE DOOR, AND IT IS THE WHOLE OF SESSION 50'S ITEM ON THIS
         * KIND. The lawn was 104.6 m square with a 30 x 13 m nave at one edge
         * and nothing else — `s50-church-air-before.png`. A churchyard is a
         * lawn you can WALK ACROSS; the path is what makes the grass somebody's
         * rather than leftover, and it is sized from the island because that is
         * what it crosses.
         */
        layPath('church:path');
        pathLamps('church:lamp');
        /**
         * THE GRAVES — SESSION 54. See `GRAVEYARD` for what a plot is and why
         * this is a `feature` rather than a prop.
         *
         * ROWS ACROSS THE ISLAND, OFFERED TO THE REGISTRY IN SEGMENTS. A whole
         * 104.6 m row would be refused by the first thing it met and the
         * churchyard would have graves only where the nave is not; in 6.0 m
         * segments the run BREAKS around the nave, the spire and the two path
         * spines and closes up again on the other side, which is what a
         * churchyard laid out round a church actually looks like. It is the
         * same argument the core wall's segments make one branch over.
         *
         * `feature x building` and `feature x path` are both forbidden, so
         * nothing is tested for here that the table does not already answer.
         * THE ONE THING THE TABLE CANNOT ANSWER is the paved square in front
         * of the door: it is `ground` and `feature x ground` is allowed, which
         * is correct in general — a bench stands on paving — and wrong for
         * this. A forecourt with graves on it is not a forecourt. That is a
         * decision about content and it is made here in one line rather than
         * by giving the square a claim it does not otherwise need.
         */
        {
          const G = GRAVEYARD;
          const segLen = G.perSegment * G.plotPitchM;
          /**
           * THE BURIAL GROUND IS THE NAVE'S OWN HALF OF THE ISLAND AND NOT
           * ALL OF IT, AND THE FIRST ARM WAS ALL OF IT.
           *
           * Measured at seed 1337: rows over the whole 104.6 m island deliver
           * **234 segments and 1 170 stones on every church chunk** — 2 574
           * boxes and 30 900 triangles for ONE chunk, against the 80 000 of
           * headroom STATE 53 §6.3 says is left in the whole budget. A city
           * block entirely full of graves is also not what a churchyard is:
           * the stones are round the church, and the far side of the ground
           * from the door is where the hedge, the trees and the benches are.
           *
           * `at(6, -26)` is where the nave stands, so the ground it stands in
           * runs from the island's far edge to a little past its own centre
           * line — which is 15 rows of the 27 the island would hold.
           */
          for (let v = -halfV + 6; v <= 8; v += G.rowPitchM) {
            for (let u = -halfU + 6; u <= halfU - 6 - segLen; u += segLen + G.plotPitchM) {
              const c = at(u + segLen / 2, v);
              if (c.x > sq.x0 && c.x < sq.x1 && c.z > sq.z0 && c.z < sq.z1) continue;
              const hAlong = segLen / 2 + G.baseW / 2;
              const hAcross = G.baseD / 2 + 0.1;
              const box = claimAt('feature', c.x, c.z,
                alongX ? hAlong : hAcross, alongX ? hAcross : hAlong,
                /**
                 * THE STONE STANDS ON THE BASE, so the claim's top is the SUM
                 * and not the taller of the two. `stoneMaxM` alone under-claims
                 * by `baseH`.
                 */
                { y0: 0, y1: G.baseH + G.stoneMaxM, owner: 'church:graves' });
              if (reg.conflict(box)) continue;
              features.push({
                kind: 'graves', x: c.x, z: c.z, yawDeg: alongX ? 0 : 90,
                n: G.perSegment, pitch: G.plotPitchM,
                /**
                 * ONE SEED PER SEGMENT AND THE HEIGHTS COME OUT OF IT IN
                 * `city.js`. The stone heights are a distribution, not a
                 * constant, and drawing `perSegment` numbers HERE would put
                 * five floats a segment across the worker boundary for
                 * something the draw can reproduce exactly from one integer.
                 */
                seed: featRng.int(0, 65535),
              });
              reg.claim(box);
            }
          }
        }
        fence('hedge', 1.4, 'church:hedge');
      } else if (kind === 'port') {
        /**
         * A WHARF: A SHED ON THE QUAY, STACKED CONTAINERS AND A CRANE. The
         * crane is `construction`'s own — already modelled, already slewing in
         * `moving.js`, already claiming `site` — which is what makes a working
         * wharf almost free, and it is also the honest reading: a container
         * crane and a tower crane are the same machine at two scales.
         */
        lay('yardGround', 'yard');
        const p = at(0, -24);
        const wharfH = sz(G.wharfHighM, 0.85, 1.7);
        placeMass('shed', p.x, p.z, G.wharfLongM, G.wharfDeepM, wharfH + 1.1, 'port:shed',
          { height: wharfH, floors: 1, style: 'dock',
            albedo: bodyAlbedo(), trim: [0.28, 0.286, 0.296] });
        stack(10);
        {
          const c = at(14, 22);
          /** `SITE`'s own mast and jib, and the same record `construction` pushes. */
          const mast = featRng.range(SITE.mastMinM, SITE.mastMaxM);
          const jib = featRng.range(SITE.jibMinM, SITE.jibMaxM);
          const box = claimAt('site', c.x, c.z, 3.4, 3.4, { y0: 0, y1: mast, owner: 'port:crane' });
          if (!reg.conflict(box)) {
            reg.claim(box);
            features.push({
              kind: 'crane', x: c.x, z: c.z, mast, jib,
              counterJib: jib * SITE.counterJibFrac,
              phase: featRng.next(), slewDir: featRng.chance(0.5) ? 1 : -1,
            });
          }
        }
        fence('palisade', D.palisadeHeight, 'port:palisade');
        floods(3);
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
  const deadZoneLaw = beyondCity ? null : DEAD_ZONE[kind];
  const propCount = beyondCity ? 0 : kind === 'park'
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
  /**
   * SESSION 50: A CHURCHYARD AND A SCHOOL ARE PLANTED, NOT SCATTERED. This
   * condition read `kind === 'park'`, so the two other kinds whose ground is
   * GRASS got the uniform island scatter — and the paragraph above says in as
   * many words what that looks like: *"trees scattered uniformly over an island
   * read as an orchard."* `s50-church-air` at the floor alone is that sentence
   * as a picture. Same clumps, same Gaussian, same island-derived bounds; the
   * bench and bin stations come with it, and both kinds now have a path for
   * those stations to follow.
   */
  if (kind === 'park' || kind === 'church' || kind === 'school') {
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
      /**
       * THE OTHER HALF OF `DEAD_ZONE`'s SESSION-50 HOLE, and it was the worse
       * half. The chain this replaces named four kinds and sent every other
       * low-detail island to `['fence', 'stack', 'container', 'bollard']` —
       * works-yard content — so the ten kinds added in sessions 48 and 49
       * furnished a CHURCHYARD AND A SCHOOL WITH SHIPPING CONTAINERS. It went
       * unseen because the count law was refusing all but one or two of them;
       * raising the floor without this would have delivered thirty-four
       * containers onto a lawn. A table rather than a chain, in `LOW_DETAIL_PROPS`
       * beside `DEAD_ZONE`, so a kind added later is missing from BOTH visibly.
       *
       * The five original rows are carried across unchanged, and `propRng.pick`
       * draws one number whatever the array holds, so no sequence moves.
       */
      ? propRng.pick(LOW_DETAIL_PROPS[kind] || LOW_DETAIL_PROPS.$default)
      /**
       * `hydrant` and `bench` added to the built list this session. A bench on
       * an ordinary pavement is the commonest street object there is and it
       * existed only inside a park; a hydrant is the commonest small one and
       * did not exist at all. Both were absent because the list was written
       * before there was anything to draw them with.
       */
      /**
       * SESSION 57 — FIVE NEW KINDS, WEIGHTED RATHER THAN APPENDED. A uniform
       * pick over a longer list would put one pillar box on every chunk, i.e.
       * one every 128 m, where a real city has one every few hundred; the
       * repeats below keep the ordinary furniture ordinary and make the five
       * new kinds punctuation. Delivered shares: bollard 3/20, planter and bin
       * and cabinet and tree and bench 2/20 each, hydrant 1/20, and each new
       * kind 1/20 — about 0.8 of each per chunk at the shipped `propCount`.
       */
      : propRng.pick(['bollard', 'bollard', 'bollard', 'planter', 'planter',
        'bin', 'bin', 'cabinet', 'cabinet', 'tree', 'tree', 'bench', 'bench',
        'hydrant', 'cyclestand', 'cyclestand', 'charger', 'newsbox',
        'postbox', 'cafetable']);
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
        /**
         * A KERBSIDE SCATTER DOES NOT FURNISH A LANDMARK'S DRIVE — session 55,
         * and this is the site the first two repairs missed. `citycheck`'s
         * `path(exchange:approach) x prop(bench)` survived a guard on the
         * apron's own scatter and a guard on the island's, because the bench
         * came from the KERB BAND: an approach reaches sixteen metres past the
         * claim, which is exactly where the footway furniture is. See
         * `inLandmarkApproach` — a pure predicate, so this chunk and the one
         * that laid the drive cannot disagree across a seam.
         */
        if (inLandmarkApproach(x, z, Math.max(halfAlong, halfAcross))) continue;
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
        /**
         * A SCATTER DOES NOT FURNISH A LANDMARK'S DRIVE — session 55, and it
         * is `latticeCorridor` one line up in spirit: a pure predicate, so
         * this chunk and the one that laid the approach cannot disagree.
         */
        if (inLandmarkApproach(x, z, pad)) continue;
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
  let coreVan = null;
  let coreWallSegments = 0;
  let coreGateSegments = 0;
  /**
   * WHERE THE WAY IN IS, HOISTED OUT OF THE WALL'S OWN BLOCK — session 54.
   * The gate is chosen by the registry (the longest continuous run of wall) and
   * the lamp that lights it must stand at the SAME place, not at a second
   * opinion about where a gate would look right. One expression, two readers,
   * which is the rule `lampStationsFor` and the bus stop already share.
   */
  let coreGate = null;
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
        // Kept so the loading bay below is painted round the van that is
        // actually there rather than round the one that was asked for.
        coreVan = { x, z, yawDeg };
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
        /** The same guard the island scatter takes — see `inLandmarkApproach`. */
        if (inLandmarkApproach(x, z, half)) continue;
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
     * ═══════════════════════════════════════════════════════════════════════
     * THE BOUNDARY, THE WAY IN, AND WHAT IT IS FOR — SESSION 47, AND IT IS THE
     * OPERATOR'S SIX-SESSION COMPLAINT ANSWERED WITH CONTENT RATHER THAN WITH
     * A DENSITY KNOB.
     * ═══════════════════════════════════════════════════════════════════════
     *
     * Session 46 measured the complaint properly for the first time: bare
     * ground is **0.00%** of the frame he was standing in, `coreGround` is
     * **16.19%** and the largest single ground owner in the picture, and a
     * `built` island already carries **41.8 props per hectare against a yard's
     * 29**. So the courtyards are not under-scattered — they are UNBOUNDED.
     * The number that separates them from every other ground kind is the
     * FIXTURE count: park 278, lot 495, parking 894, construction 518, yard 410
     * over their whole populations, and **core 55 over 83 chunks**. The other
     * five read as somebody's because each has a boundary, a way in and a use;
     * this one had scatter and a surface.
     *
     * A YARD IS A YARD BECAUSE IT HAS A WALL ROUND IT, and `DEAD_ZONE.core`'s
     * own comment already says *"a block interior IS a service yard"*. So the
     * boundary is the yard's boundary, at the yard's own height, and the only
     * new decision is where it runs.
     *
     * WHERE IT RUNS IS DECIDED BY THE REGISTRY AND NOT BY A RULE. The wall is
     * laid in `DEAD_ZONE.edgeSegment` lengths along all four island edges and
     * every segment is offered to `reg.conflict` first — so it appears exactly
     * where a building does NOT, which is the frontage gap. Session 39
     * measured those gaps and called them by name: **267 of them at seed 1337,
     * 15.0 m mean, 4 001 m — 11.5% of the island edge — and 188 fall MID-SIDE,
     * where the walk goes on afterwards, which are the ones that read as a hole
     * in a street wall.** This is that hole, closed, at zero draw calls,
     * without adding one building and without touching the fill law LOOK.md §2
     * spends four bullets choosing.
     *
     * THE OUTER FACE IS FLUSH WITH THE BUILDING LINE. `halfT` is 0.22 m — the
     * `edge` treatment's own 0.36 m course plus its 0.44 m coping, halved — and
     * the inset is the same number, so the wall's street face lands on the
     * island edge where a building's would. A wall set back would read as a
     * second, poorer building line.
     *
     * `feature` IS THE CATEGORY AND IT IS WHAT MAKES THE GAP-FINDING WORK.
     * `feature x building` is forbidden, which is the refusal that carves the
     * run; `feature x pavement` and `feature x carriageway` are forbidden,
     * which keeps it off the footway it stands beside; `feature x feature` is
     * absent, so consecutive segments abut. The same row the yard's palisade
     * uses.
     *
     * THE WAY IN IS CUT FROM THE LONGEST RUN AND NOT ROLLED. A gate rolled onto
     * a random side lands inside a building four times in five and is a way in
     * nobody can see; the widest continuous stretch of wall on the island is
     * the one place an opening reads as an opening. `DEAD_ZONE.gateHalf` is the
     * yard's own gate.
     */
    {
      const W = DEAD_ZONE;
      /** Half the DELIVERED depth, which is the coping's and not the course's. */
      const halfT = LOW_WALL.copingDeepM / 2;
      const height = W.palisadeHeight;
      const seg = W.edgeSegment;
      const runs = [
        { axis: 'x', at: island.z0 + halfT, from: island.x0, to: island.x1 },
        { axis: 'x', at: island.z1 - halfT, from: island.x0, to: island.x1 },
        { axis: 'z', at: island.x0 + halfT, from: island.z0, to: island.z1 },
        { axis: 'z', at: island.x1 - halfT, from: island.z0, to: island.z1 },
      ];
      /** Every segment the registry will accept, in order along its own run. */
      const wall = [];
      runs.forEach((run, ri) => {
        for (let t = run.from; t + seg <= run.to; t += seg) {
          const c = t + seg / 2;
          const x = run.axis === 'x' ? c : run.at;
          const z = run.axis === 'x' ? run.at : c;
          /**
           * ALONG the run it is the COPING's length and not the segment's —
           * `LOW_WALL.copingLongFactor`, read from the constant `city.js` now
           * draws it with. The first arm claimed `seg / 2` and the delivered
           * sweep reported the missing 0.03 m at every end.
           */
          const halfAlong = (seg * LOW_WALL.copingLongFactor) / 2;
          const box = claimAt('feature', x, z,
            run.axis === 'x' ? halfAlong : halfT,
            run.axis === 'x' ? halfT : halfAlong,
            { y0: 0, y1: height, owner: 'core:wall' });
          if (reg.conflict(box)) continue;
          wall.push({ ri, c, x, z, box, axis: run.axis });
        }
      });
      /**
       * THE LONGEST CONTIGUOUS RUN, which is contiguity in the SEGMENT INDEX
       * and not in the metre: two segments are neighbours when they are on the
       * same side and their centres are one `seg` apart, so a run broken by a
       * building is two runs and the gate cannot be cut across a building.
       */
      let best = { i0: 0, n: 0 };
      for (let i = 0; i < wall.length;) {
        let j = i + 1;
        while (j < wall.length && wall[j].ri === wall[i].ri
          && Math.abs(wall[j].c - wall[j - 1].c - seg) < 1e-6) j++;
        if (j - i > best.n) best = { i0: i, n: j - i };
        i = j;
      }
      const gateC = best.n ? (wall[best.i0].c + wall[best.i0 + best.n - 1].c) / 2 : Infinity;
      const gateRi = best.n ? wall[best.i0].ri : -1;
      if (best.n) {
        const run = runs[gateRi];
        coreGate = {
          x: run.axis === 'x' ? gateC : run.at,
          z: run.axis === 'x' ? run.at : gateC,
          /** Which way is INTO the courtyard from this run. */
          inX: run.axis === 'x' ? 0 : (run.at < (island.x0 + island.x1) / 2 ? 1 : -1),
          inZ: run.axis === 'x' ? (run.at < (island.z0 + island.z1) / 2 ? 1 : -1) : 0,
        };
      }
      let gated = 0;
      for (const w of wall) {
        if (w.ri === gateRi && Math.abs(w.c - gateC) < W.gateHalf) { gated++; continue; }
        /**
         * SQUARE, AND THE FIRST ARM WAS NOT. Every other scattered thing in
         * this file takes `yaw()`; a wall CONTINUING a street frontage does
         * not, because the buildings it runs between are on the lot line and a
         * wall a degree off it is a wall that is not joining them. The first
         * arm yawed it and the delivered sweep reported **196
         * `feature(edge:wall) x pavement(ground:walk)` overlaps**, 0.001 to
         * 0.171 m2 — a few centimetres of coping over the footway, which is
         * `boundaryRun`'s own `yawBulge` note ("a segment turned a degree
         * cannot hang over the pavement its centre was set back from") arriving
         * by the door it was written to close. Square, the claim IS the
         * delivered box and the count is zero.
         */
        features.push({
          kind: 'edge', edge: 'wall', x: w.x, z: w.z,
          length: seg, height, yawDeg: w.axis === 'x' ? 0 : 90,
        });
        reg.claim(w.box);
      }
      coreWallSegments = wall.length - gated;
      coreGateSegments = gated;
    }

    /**
     * AND THE USE, WHICH IS THE THIRD OF THE THREE. The van above stands on
     * nothing; a serviced block has its loading bay MARKED, the way a car park
     * has its bays marked, and for the same reason — the paint is what makes
     * the parcel legible as the thing it is at every density.
     *
     * A `marking` claims nothing (it is a 4 mm box, like every line in this
     * city) so it cannot refuse the van standing on it. It is pushed straight
     * into `markings` rather than through `paint()`, exactly as the car park's
     * bays are, because `paint()`'s `onRoad` guard exists to keep a line off
     * ground a river or a dome took and a loading bay is not on a carriageway
     * at all.
     *
     * 3.0 x 7.0 m is the van's own delivered box (2.70 m half-length, 1.05 m
     * half-width) plus a working margin on each side, drawn as four edges.
     */
    if (coreVan) {
      const bayL = 7.0;
      const bayW = 3.0;
      const a = (coreVan.yawDeg * Math.PI) / 180;
      const ux = Math.cos(a), uz = -Math.sin(a);
      for (const sgn of [-1, 1]) {
        markings.push({
          x: coreVan.x - uz * sgn * bayW / 2, z: coreVan.z - ux * sgn * bayW / 2,
          length: bayL, width: 0.12, yawDeg: coreVan.yawDeg, kind: 'bay',
        });
        markings.push({
          x: coreVan.x + ux * sgn * bayL / 2, z: coreVan.z - uz * sgn * bayL / 2,
          length: bayW, width: 0.12, yawDeg: coreVan.yawDeg + 90, kind: 'bay',
        });
      }
    }

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * AND THE FOURTH THING, WHICH IS THE LIGHT — SESSION 54, AND IT IS THE
     * LARGEST UNLIT POPULATION IN THIS CITY BY A FACTOR OF SEVENTEEN.
     * ═══════════════════════════════════════════════════════════════════════
     *
     * `tools/placeprobe.mjs --light`, seed 1337 over the 17 x 17: **223 of 289
     * chunks deliver no `lamp` and no `flood` feature at all**, and those 223
     * are every `built` chunk in the city. Eleven of the fifteen ISLAND kinds
     * have been lit since sessions 40 and 49 — a yard has masts, a car park
     * has columns, a park has post-tops — and the surface those sessions were
     * lighting is 23% of the ground. The block interior is the other 77%, and
     * sessions 40, 47 and 50 filled it with a van, a service scatter, 10 668 m
     * of courtyard wall and a marked loading bay without one light landing on
     * any of it. STATE 50 wrote the diagnosis itself: *"the fill is hundreds
     * of unlit dark objects; the fix is to light them, which is what a worked
     * yard is."* Three sessions carried it.
     *
     * TWO FIXTURES, AND EACH IS A SENTENCE ABOUT WHAT IS ALREADY THERE:
     *
     *   THE GATE LAMP.  A yard with a wall round it has a light at its way in.
     *                   It stands at `coreGate` — the registry's own choice of
     *                   opening, not a second guess — one metre inside the
     *                   wall, and it is the `PARK.lampHeight` post-top with
     *                   `LIGHT.parkLampCandela` behind it, which is the
     *                   fixture this city already lights every footpath with.
     *                   It is also the one that MATTERS from the street: the
     *                   gate is a hole in the frontage, and session 39
     *                   measured 188 of 267 such gaps as falling mid-side
     *                   where the walk goes past them.
     *
     *   THE BAY LIGHT.  *"A loading dock has a lamp over the door"* — the
     *                   brief's own sentence. A 6.0 m column
     *                   (`DEAD_ZONE.yardLightHeightM`) aimed at the van's own
     *                   bay, carrying `LIGHT.yardFloodCandela`: 20 lx, which
     *                   is EN 12464-2's loading zone and 0.06x a construction
     *                   mast. It is emitted as a `flood` because that is the
     *                   record for a luminaire that AIMS; `city.js` picks the
     *                   yard luminaire off its height.
     *
     * TWO PER BLOCK AND NOT TWENTY. `updateLampPool` cuts candidates at 128 m
     * and hands the nearest `poolLamps` of them a slot, so every light added
     * anywhere competes with the street lamps for the same 98. A ring of
     * courtyard lamps would win that competition near the camera and put the
     * STREET into the dark to light a yard, which is the defect this item is
     * repairing, inverted. Two is one light at the way in and one over the
     * thing being serviced, which is what the place actually has.
     */
    if (coreGate) {
      const x = coreGate.x + coreGate.inX * 1.4;
      const z = coreGate.z + coreGate.inZ * 1.4;
      const box = claimAt('feature', x, z, 0.34, 0.34,
        { y0: 0, y1: PARK.lampHeight, owner: 'core:gateLamp' });
      if (!reg.conflict(box, 0, LIGHT_SETBACKS)) {
        features.push({ kind: 'lamp', x, z, height: PARK.lampHeight });
        reg.claim(box);
      }
    }
    if (coreVan) {
      /**
       * BESIDE THE BAY AND NOT OVER IT. The column stands one van-length off
       * the bay's own centre, on the axis the van is turned to, so the throw
       * is the `hypot(6, 8)` = 10.0 m slant range `LIGHT.yardFloodCandela` is
       * derived at — and so the column is not standing in the bay it lights,
       * which is what `claimAt('prop', ..., 'parked:van')` would refuse
       * anyway. Two tries, either side, and then it stops: a courtyard with
       * no room for a column is a courtyard, not a failure.
       */
      const a = (coreVan.yawDeg * Math.PI) / 180;
      const ux = Math.cos(a);
      const uz = -Math.sin(a);
      for (const sgn of [1, -1]) {
        const x = coreVan.x + uz * sgn * 8.0;
        const z = coreVan.z + ux * sgn * 8.0;
        if (x < island.x0 + 1 || x > island.x1 - 1 || z < island.z0 + 1 || z > island.z1 - 1) continue;
        /** 0.70, which contains the 0.9 m pedestal `city.js` draws under every
         *  `flood`. See the apron light for the arithmetic. */
        const box = claimAt('feature', x, z, 0.7, 0.7,
          { y0: 0, y1: DEAD_ZONE.yardLightHeightM, owner: 'core:bayLight' });
        if (reg.conflict(box, 0, LIGHT_SETBACKS)) continue;
        features.push({
          kind: 'flood', x, z,
          height: DEAD_ZONE.yardLightHeightM, aimX: coreVan.x, aimZ: coreVan.z,
        });
        reg.claim(box);
        break;
      }
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
    const coreSolids = reg.all().filter((c) => c.kind === 'building' || c.kind === 'landmark' || c.kind === 'precinct'
      || c.kind === 'block' || c.kind === 'water');
    const yardRect = { x0: island.x0, z0: island.z0, x1: island.x1, z1: island.z1, kind: 'coreGround', yKey: 'core' };
    const coreRects = [];
    for (const g of subtractBoxes([yardRect], coreSolids)) {
      ground.push(g);
      if (g.kind === 'coreGround') coreRects.push(g);
    }

    /**
     * THE SERVICE ROWS — SESSION 56, ITEM 6, AND THE MEASUREMENT CAME FIRST.
     * Over the 5×5 chunks at the origin, the NINE largest empty surfaces
     * among the towers are all coreGround SLIVERS — the 8–17 m strips
     * `subtractBoxes` leaves along the building backs, up to 845 m² with
     * zero objects — while every furnished core patch runs 19–41 objects/ha.
     * The uniform island scatter above cannot reach them: its 8 tries land
     * mostly on buildings and are refused, and a thin strip is a small
     * target. A strip along a building's back is where a block's servicing
     * actually stands, so the largest empty strips each get a ROW along
     * their own long axis, from the same palette and the same named stream —
     * appended draws only, so nothing already delivered moves. The row pitch
     * of 9 m puts a 12 m strip at ~30 objects/ha, the middle of the band the
     * furnished patches measure.
     */
    for (const g of coreRects
      .map((r) => ({ r, area: (r.x1 - r.x0) * (r.z1 - r.z0) }))
      /** 420, not 300 — the second trim the triangle ceiling asked for: the
       *  many small strips cost rows across hundreds of chunks while the
       *  operator's complaint is the LARGE patches, which all clear 420. */
      .filter((e) => e.area > 420)
      .sort((a, b) => b.area - a.area)
      .slice(0, 4)
      .map((e) => e.r)) {
      const rowAlongX = (g.x1 - g.x0) >= (g.z1 - g.z0);
      const len = rowAlongX ? g.x1 - g.x0 : g.z1 - g.z0;
      /**
       * 12 m pitch and no multi-box stacks in the ROWS (the uniform scatter
       * above keeps its full palette): the first arm at 9 m and five rows a
       * chunk delivered the repair and 26 444 triangles past
       * `ceilings.triangles` on `highway_speed` — a count, so a verdict
       * whatever the load — and two more trims (area 420, pitch 13, ten
       * fewer hills) were needed to get back under. THE CEILING IS NOW
       * EFFECTIVELY SPENT: the next session inherits about 2k of headroom. A 13 m pitch on a 12 m strip is ~19 objects/ha,
       * inside the furnished band's low half; the largest patches stay
       * covered and the ceiling stays a ceiling.
       */
      const rowN = Math.max(2, Math.floor(len / 13));
      const ROW_KINDS = ['bin', 'cabinet', 'container', 'bollard'];
      for (let i = 0; i < rowN; i++) {
        const u = (i + 0.5) / rowN;
        const propKind = ROW_KINDS[coreRng.int(0, ROW_KINDS.length - 1)];
        const scale = coreRng.range(PROP_SCALE.min, PROP_SCALE.max);
        const variants = propVariantCount(propKind);
        const variant = variants > 0 ? coreRng.int(0, variants - 1) : 0;
        const half = propHalfWidth(propKind, variant) * scale;
        const x = rowAlongX ? g.x0 + u * len : (g.x0 + g.x1) / 2 + coreRng.range(-1.5, 1.5);
        const z = rowAlongX ? (g.z0 + g.z1) / 2 + coreRng.range(-1.5, 1.5) : g.z0 + u * len;
        if (inLandmarkApproach(x, z, half)) continue;
        const spot = claimAt('prop', x, z, half, half, { owner: propKind });
        if (reg.conflict(spot, 0, PROP_SETBACKS)) continue;
        reg.claim(spot);
        props.push({
          x, z, yawDeg: coreYaw(), refDeg: 0, kerb: false, kind: propKind, scale, variant,
          soil: coreRng.range(0.52, 0.94),
          lean: coreRng.range(-1, 1),
          leanAzDeg: coreRng.range(0, 360),
          core: true,
        });
      }
    }
  }

  /**
   * THE APRON RUNS LAST, AFTER THE PROP SCATTER, AND THAT IS THE WHOLE OF ITS
   * PLACEMENT IN THE ORDER — SESSION 51.
   *
   * Put before the scatter it re-phased it: **284 existing props moved and 358
   * appeared across the sixteen landmark-touching chunks**, because a claim
   * added anywhere in a chunk changes which candidates the scatter's retries
   * refuse. Every comment in this file about a new `rng` draw is about that
   * cost, and the ordering pays none of it — the scatter runs against exactly
   * the registry session 50 gave it, and the apron is laid into what is left.
   *
   * IT COSTS THE APRON NOTHING, and the reason is `PROP_SETBACKS.precinct`:
   * the precinct is claimed at the TOP of this function with the landmarks, so
   * the street scatter has been three metres clear of it all along and there
   * is nothing in there for the apron to be refused by.
   */
  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * THE LANDMARK APRON — SESSION 51, AND IT IS THE OPERATOR'S THIRD DEFECT.
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * *"Sessions 48, 49 and 50 gave fifteen island kinds a floor, a palette and
   * fixtures sized to the island. THE EIGHT LANDMARKS GOT NONE OF IT."*
   *
   * AND ONE LINE OF THIS FILE IS WHY, 1800 LINES ABOVE:
   *
   *     const lowDetail = !hasLandmark && density < CITY.lowDetailThreshold;
   *
   * A chunk that touches a landmark is NEVER low-detail, so it never enters
   * the `if (lowDetail)` branch below and never reaches `lay`, `layPath`,
   * `bayRows`, `floods`, `fence`, `boundaryRun` or the prop palette. Three
   * sessions of fixture work is behind a predicate that every landmark in the
   * city fails by construction. The exclusion is CORRECT — a landmark chunk is
   * not a works yard and must not draw one — and what was missing is the
   * landmark's OWN programme.
   *
   * SIZED FROM THE LANDMARK'S OWN CLAIM, WHICH IS SESSION 50'S WHOLE LESSON.
   * The apron is not a radius somebody chose: it is `landmarkPrecinct(l)` —
   * the part of the registry claim the landmark does not stand on, which for a
   * round landmark in a square claim is 21.5% of it by geometry. The boundary
   * ring is on the landmark's own `landmarkGroundRadius`, and the furnishing
   * count is the apron's own area over a spacing that belongs to the kind. Not
   * one constant in `LANDMARK_APRON` is a length.
   *
   * WHAT IT IS MADE OF: `edge` features and `bollard`, `bench` and `tree`
   * props, which is the vocabulary sessions 40 and 47 already built and which
   * session 49 made eight kinds of place out of without adding a mesh. This
   * adds none either.
   *
   * ONE CHUNK, ONE SHARE. A landmark spans up to four chunks and every one of
   * them sees the same `landmarkPrecinct`, so each clips it to its OWN
   * `chunkBounds` — not to the corridor-extended bounds the road strips use.
   * Every square metre is in exactly one chunk, so nothing is emitted twice
   * and nothing z-fights with a neighbour's copy of itself.
   */
  {
    const apronRng = chunkRng(rootSeed, cx, cz, 'apron');
    for (const l of nearLandmarks) {
      const spec = LANDMARK_APRON[l.name];
      const pre = spec ? landmarkPrecinct(l) : [];
      if (!pre.length) continue;
      const r = landmarkGroundRadius(l);

      /**
       * THE SURFACE. Cut against the two things that can be under it and are
       * not the landmark — the origin block and the river — and against the
       * buildings the perimeter walk has already placed, which is what `lay`
       * does with `islandSolids` one branch down. The landmark's own claim
       * needs no cut: the precinct IS the claim minus the landmark.
       */
      const cut = reg.all().filter((c) => c.kind === 'block' || c.kind === 'water' || c.kind === 'building');
      const mine = [];
      for (const q of pre) {
        const x0 = Math.max(q.x0, b.x0);
        const x1 = Math.min(q.x1, b.x1);
        const z0 = Math.max(q.z0, b.z0);
        const z1 = Math.min(q.z1, b.z1);
        if (x1 - x0 < MIN_GROUND_PIECE_M || z1 - z0 < MIN_GROUND_PIECE_M) continue;
        mine.push({ x0, x1, z0, z1, kind: spec.ground, yKey: spec.yKey });
      }
      for (const g of subtractBoxes(mine, cut)) {
        ground.push(g);
        /**
         * `precinct` AND NOT `ground`, which is the category `city.js` gives
         * the same rectangle when it emits it — see `CATEGORY_FOR_GROUND`
         * there for the delivered-census measurement that decided it. The two
         * sides of the claim must agree or `citycheck` is comparing a
         * generator that said one thing with an artefact that said another,
         * which is the whole reason the delivered census exists.
         */
        reg.claim(claimBox('precinct', g.x0, g.z0, g.x1, g.z1, { owner: `${l.name}:apron` }));
      }

      /**
       * ═══════════════════════════════════════════════════════════════════
       * THE WAY IN — SESSION 55, AND IT IS STATE 54 §8 ITEM 3 BUILT.
       * ═══════════════════════════════════════════════════════════════════
       *
       * The operator, at his own spawn looking at the dome: *"one flight of
       * steps at one edge, two files of people crossing bare apron, no vehicle
       * approach, no visible entrance"*. Session 52 opened the precinct and
       * session 54 lit it; nothing had ever said how you get in.
       *
       * FROM THE LANDMARK'S OWN CIRCLE TO ITS CLAIM'S EDGE, on the cardinal
       * bearings — see `LANDMARK_APRON` for why cardinal is geometry rather
       * than taste. `landmarkGroundRadius` is the silhouette and
       * `landmarkClaimHalf` is the square the registry holds, so an approach
       * runs the whole width of the apron and reaches the street corridor at
       * the far end without either number being chosen here.
       *
       * IT IS CLAIMED BEFORE THE BOUNDARY RUN, WHICH IS WHAT MAKES THE GATE
       * FREE: `feature × path` is forbidden, so the railing bays that cross an
       * approach are refused by the paving and the opening appears without the
       * two routines knowing about each other.
       *
       * `path` AND NOT `pavement`, at the apron's OWN datum. The category is
       * the one `layPath` uses for a park spine — a footway that is not beside
       * a road — and it is the one that forbids `feature` and `prop`, which is
       * the whole mechanism above. The datum is `spec.yKey` rather than
       * `pathEW`, because an approach across a forecourt is level with it: a
       * gravel run at the park path's own height would be a 20 mm step round
       * three sides of a dome.
       *
       * SUBTRACTED AGAINST THE CARRIAGEWAY AS WELL AS THE SOLIDS. `path`
       * forbids `carriageway`, so an approach reaching a lattice line would be
       * refused whole by `reg.conflict` and the landmark would lose that
       * bearing entirely. Cutting first means it stops AT the kerb, which is
       * where a drive meets a street.
       */
      const approachDirs = [];
      /**
       * HOW FAR OUT AN APPROACH REACHES, AND IT IS THE PORTICO'S OWN LENGTH.
       *
       * The drive is as long as the thing standing over it: `hospBayLongM` is
       * three car lengths, so three cars stand under the canopy on paving that
       * runs the whole way. The first arm used two footways (8.4 m) and left
       * the canopy overhanging its own drive by seven metres and the drop-off
       * bays painted on bare ground beside it.
       *
       * IT IS A BOUND AND NOT A LENGTH. Everything past the apron is cut
       * against the carriageway and the solids below, so an approach that meets
       * a kerb at four metres stops at four; this is only how far it is allowed
       * to look.
       */
      const approachOuter = landmarkClaimHalf(l) + PROGRAM.hospBayLongM;
      if (spec.approaches > 0) {
        const h = APPROACH_HALF_M;
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].slice(0, spec.approaches);
        /**
         * THE CUT IS EVERYTHING A PATH MAY NOT LIE ON, AND THE LANDMARK'S OWN
         * CLAIM IS IN IT.
         *
         * The first arm ran from `landmarkGroundRadius` — the SILHOUETTE —
         * outward and every bearing came back `conflict with landmark`,
         * because the registry's claim is a 2.1 m STAIRCASE that contains the
         * arc rather than a circle of that radius, so along the centreline it
         * reaches further out than the radius does. Rather than derive where
         * the staircase ends, the run starts at the landmark's own centre and
         * the staircase is SUBTRACTED: the residue is exactly the apron, which
         * is the definition of the precinct one block up. §9's own lesson —
         * a length computed twice is a length that disagrees with itself.
         *
         * `prop`, `feature` and `site` are cut for the same reason and not
         * because they would be refused: `reg.conflict` would refuse the WHOLE
         * piece for one kerbside bollard, and losing a bearing to a bin is not
         * what a way in should cost. Cutting leaves the paving flowing round
         * it, which is what paving does.
         */
        const cutKinds = new Set(['block', 'water', 'building', 'carriageway',
          'landmark', 'prop', 'feature', 'site']);
        const pathCut = reg.all().filter((c) => cutKinds.has(c.kind));
        for (const [dx, dz] of dirs) {
          const run = dx !== 0
            ? {
                x0: dx > 0 ? l.x : l.x - approachOuter,
                x1: dx > 0 ? l.x + approachOuter : l.x,
                z0: l.z - h, z1: l.z + h,
              }
            : {
                x0: l.x - h, x1: l.x + h,
                z0: dz > 0 ? l.z : l.z - approachOuter,
                z1: dz > 0 ? l.z + approachOuter : l.z,
              };
          const clipped = {
            x0: Math.max(run.x0, b.x0), x1: Math.min(run.x1, b.x1),
            z0: Math.max(run.z0, b.z0), z1: Math.min(run.z1, b.z1),
          };
          if (clipped.x1 - clipped.x0 < MIN_GROUND_PIECE_M) continue;
          if (clipped.z1 - clipped.z0 < MIN_GROUND_PIECE_M) continue;
          let laid = 0;
          for (const q of subtractBoxes([clipped], pathCut)) {
            if (q.x1 - q.x0 < MIN_GROUND_PIECE_M || q.z1 - q.z0 < MIN_GROUND_PIECE_M) continue;
            const box = claimBox('path', q.x0, q.z0, q.x1, q.z1, { owner: `${l.name}:approach` });
            if (reg.conflict(box)) continue;
            ground.push({
              x0: q.x0, x1: q.x1, z0: q.z0, z1: q.z1,
              kind: spec.approachGround, yKey: spec.yKey,
            });
            reg.claim(box);
            laid++;
          }
          if (laid) approachDirs.push([dx, dz]);
        }
      }

      /**
       * THE PORTICO — A ROOF ON COLUMNS AT THE INNER END OF THE FIRST
       * APPROACH, and it is the ambulance bay's own three numbers.
       *
       * `LANDMARK_APRON` carries why: a porte-cochère and an ambulance bay are
       * one object — *"a canopy a vehicle turns under"* — so they are one set
       * of dimensions rather than a fourth set authored beside them.
       *
       * `canopy` AND NOT `building`, which is `placeMass`'s own lesson: the
       * category conflicts with SOLIDS only, so a roof over a forecourt is not
       * a wall across it. It stands OUTSIDE the landmark's stepped claim —
       * `canopy × landmark` is forbidden — which is what puts it against the
       * face rather than through it.
       *
       * ITS LONG AXIS IS ALONG THE DRIVE. Sixteen metres is three car lengths
       * (`DEAD_ZONE.bayL` = 5.0), so three vehicles stand under it at once;
       * nine metres across is the drive itself. A canopy turned the other way
       * would be a wide thin roof over one car, which is a bus shelter.
       */
      /**
       * WHICH BEARING IS THE FRONT, AND IT IS DERIVED RATHER THAN CHOSEN: THE
       * ONE THAT FACES THE CITY CENTRE.
       *
       * A civic hall fronts the city it is in. `l.x` and `l.z` are the
       * landmark's own offset from the origin, so the dominant component names
       * the bearing back toward it — the exchange at (120, −110) fronts WEST
       * and the dish at (−150, −160) fronts SOUTH.
       *
       * IT HAS TO BE A FUNCTION OF THE LANDMARK AND NOT OF THE CHUNK. A
       * landmark spans up to four chunks and each one lays only the approaches
       * that fall inside it, so `approachDirs[0]` is a different bearing in
       * each — and taking it would have put a portico and a drop-off on every
       * face, one per chunk, four porte-cochères on a building with one door.
       * Measured before it shipped: three canopies over the exchange across
       * three chunks.
       */
      const face = Math.abs(l.x) >= Math.abs(l.z)
        ? [l.x > 0 ? -1 : 1, 0]
        : [0, l.z > 0 ? -1 : 1];

      if (spec.portico) {
        const [dx, dz] = face;
        const long = PROGRAM.hospBayLongM;
        const deep = PROGRAM.hospBayDeepM;
        /**
         * ITS INNER EDGE ON THE CLAIM'S OWN LINE. `canopy × landmark` is
         * forbidden and the claim is a staircase that reaches past the
         * silhouette, so a canopy against the FACE is refused; against the
         * CLAIM it stands at the head of the drive, over the outer edge of the
         * apron and the footway beyond it, which is where a porte-cochère is.
         */
        const stand = landmarkClaimHalf(l) + long / 2;
        const px = l.x + dx * stand;
        const pz = l.z + dz * stand;
        const hx = dx !== 0 ? long / 2 : deep / 2;
        const hz = dx !== 0 ? deep / 2 : long / 2;
        if (px >= b.x0 && px < b.x1 && pz >= b.z0 && pz < b.z1) {
          const box = claimAt('canopy', px, pz, hx, hz,
            { y0: PROGRAM.hospBayHighM, y1: PROGRAM.hospBayHighM + 1.6, owner: `${l.name}:portico` });
          if (!reg.conflict(box)) {
            reg.claim(box);
            features.push({
              kind: 'canopy', x: px, z: pz, yawDeg: dx !== 0 ? 0 : 90,
              length: long, depth: deep, height: PROGRAM.hospBayHighM,
              albedo: [0.42, 0.40, 0.38],
            });
          }
        }
      }

      /**
       * THE DROP-OFF — A ROW OF BAYS AT THE OUTER END OF THE FIRST APPROACH,
       * PROBED AS `ground` EXACTLY AS `bayRows` PROBES A HOSPITAL'S.
       *
       * `ground` forbids only `building`, `landmark` and `water`, so paint
       * stops at what stands on the apron and is drawn under a canopy and
       * across a path — which is what a set-down bay is. Offset to one side of
       * the drive by half a bay, so the marked stalls are the set-down lane and
       * the other half of the nine metres is the footway they open onto.
       */
      if (spec.dropOff) {
        const [dx, dz] = face;
        /**
         * UNDER THE PORTICO, AND THE COUNT IS THE PORTICO'S OWN LENGTH.
         *
         * Three bays, because `PROGRAM.hospBayLongM / DEAD_ZONE.bayL` = 16/5
         * is three — which is the same "three car lengths" the canopy's own
         * dimension came from, arrived at from the other end. `bayRows`'s own
         * comment says a bay under a canopy is still a bay, and a covered
         * set-down is what a porte-cochère is FOR.
         *
         * THE MARK IS THE DIVIDER AND NOT THE STALL, which is `bayRows`'s
         * shape: `n + 1` lines across the lane at `bayL` centres, each one
         * `bayW` long. Paint that outlined every stall would be four times the
         * boxes for a rhythm the eye reads off the repeat (session 50's own
         * finding about the kerb line).
         *
         * AGAINST THE FAR EDGE OF THE DRIVE, at `APPROACH_HALF_M - bayW/2`, so
         * the marked lane is the set-down and the other half of the nine metres
         * is the footway it opens onto.
         */
        const inner = landmarkClaimHalf(l);
        const nBay = Math.max(1, Math.floor(PROGRAM.hospBayLongM / DEAD_ZONE.bayL));
        const side = APPROACH_HALF_M - DEAD_ZONE.bayW / 2;
        for (let i = 0; i <= nBay; i++) {
          const along = inner + i * DEAD_ZONE.bayL;
          const x = l.x + dx * along + (dx !== 0 ? 0 : side);
          const z = l.z + dz * along + (dz !== 0 ? 0 : side);
          if (x < b.x0 || x >= b.x1 || z < b.z0 || z >= b.z1) continue;
          const probe = claimAt('ground', x, z,
            dx !== 0 ? 0.05 : DEAD_ZONE.bayW / 2, dx !== 0 ? DEAD_ZONE.bayW / 2 : 0.05,
            { y0: 0, y1: 0.02, owner: `${l.name}:dropoff` });
          if (reg.conflict(probe)) continue;
          markings.push({
            x, z,
            length: dx !== 0 ? 0.10 : DEAD_ZONE.bayW,
            width: dx !== 0 ? DEAD_ZONE.bayW : 0.10,
            yawDeg: 0, kind: 'bay',
          });
        }
      }

      /**
       * THE BOUNDARY, ON THE LANDMARK'S OWN CIRCLE.
       *
       * `APRON_STEP_M` out from the silhouette, because the staircase
       * over-states the circle by up to one step and a run laid ON the radius
       * would be refused by the residue rather than by anything real. At the
       * weir that setback is also what a railing has: the rim is a NINE METRE
       * DROP and there has never been anything at the top of it.
       *
       * Segments, not an arc: every boundary in this project is a run of
       * straight bays (`boundaryRun`), and a 4.0 m bay on a 105 m radius is
       * 2.2 degrees of chord — 0.02 m of sagitta, which is under the mesh's
       * own tolerance. ONE GAP, at a rolled bearing, for the same reason
       * `boundaryRun` leaves one: a compound you cannot get into is a wall.
       */
      if (spec.edge) {
        const rr = r + APRON_STEP_M;
        const n = Math.max(8, Math.round((2 * Math.PI * rr) / APRON_BAY_M));
        const gate = Math.floor(apronRng.next() * n);
        for (let i = 0; i < n; i++) {
          if (Math.abs(i - gate) <= 1) continue;
          const a = ((i + 0.5) / n) * Math.PI * 2;
          const x = l.x + Math.cos(a) * rr;
          const z = l.z + Math.sin(a) * rr;
          if (x < b.x0 || x >= b.x1 || z < b.z0 || z >= b.z1) continue;
          const yawDeg = (-a * 180) / Math.PI;
          const ca = Math.abs(Math.cos(a));
          const sa = Math.abs(Math.sin(a));
          const halfAlong = APRON_BAY_M / 2;
          const halfT = 0.07;
          const box = claimAt('feature', x, z,
            sa * halfAlong + ca * halfT, ca * halfAlong + sa * halfT,
            { y0: 0, y1: spec.edgeHeight, owner: `${l.name}:edge` });
          if (reg.conflict(box)) continue;
          features.push({
            kind: 'edge', edge: spec.edge, x, z,
            length: APRON_BAY_M, height: spec.edgeHeight,
            /**
             * THE BOUNDARY IS ALIGNED TO ITS OWN CHORD AND SAYS SO. A run of
             * railing round a circle is at every angle by construction, so it
             * declares `refDeg` — its own tangent — and the alignment
             * criterion measures the deviation FROM that rather than from the
             * world axes. That field exists for exactly this: session 35 found
             * the gate reading a promenade bollard's 11.46 degree world yaw as
             * 11.46 degrees of deviation because the projection dropped it.
             */
            yawDeg: yawDeg + 90, refDeg: yawDeg + 90,
          });
          reg.claim(box);
        }
      }

      /**
       * THE LIGHT, ON THE SAME CIRCLE THE BOUNDARY RUNS ON — SESSION 54.
       *
       * See `LANDMARK_APRON` for which fixture each landmark gets and why.
       * The PITCH is the fixture's own (`lightEveryM`) and the ring is the
       * boundary's own (`r + APRON_STEP_M`), so a column stands beside the
       * railing rather than a metre inside or outside it — which at the weir
       * is the whole point: the thing being lit is the top of a nine-metre
       * drop and its staircase, and a light set back from a fall lights the
       * ground you are safe on.
       *
       * `n` IS ROUNDED FROM THE CIRCUMFERENCE AND NOT CHOSEN, the same
       * arithmetic the boundary's own bay count uses one block up, so the two
       * cannot go out of step: a lamp every `lightEveryM` of arc.
       *
       * AIMED AT THE LANDMARK FOR A FLOOD AND STRAIGHT DOWN FOR A POST-TOP,
       * which is what the two fixtures are. `city.js`'s `chunk.features` loop
       * already turns both kinds into a pool candidate. WHICH LUMINAIRE EACH
       * ONE CARRIES IS DECIDED BY ITS HEIGHT THERE, exactly as a `lamp`'s
       * already is (`f.height >= DEAD_ZONE.columnHeight` picks the car-park
       * column over the park lamp): this file is pure and holds no photometry,
       * so a candela written here would be a second copy of a number
       * `constants.js` owns — CONTRACT §9.1 with a luminaire.
       */
      if (spec.light) {
        const rr = r + APRON_STEP_M;
        const n = Math.max(4, Math.round((2 * Math.PI * rr) / spec.lightEveryM));
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const x = l.x + Math.cos(a) * rr;
          const z = l.z + Math.sin(a) * rr;
          if (x < b.x0 || x >= b.x1 || z < b.z0 || z >= b.z1) continue;
          /**
           * `feature` AND NOT `site`. A yard's flood mast claims `site`
           * because what it stands in is an excavation nothing else may
           * enter; an apron column stands on a forecourt beside a railing,
           * which is what every other `edge` and `lamp` on this apron claims.
           * The column's own footprint, and the head is over it.
           */
          /**
           * A FLOOD'S CLAIM IS 0.70 AND A POST-TOP'S IS 0.34, BECAUSE THE TWO
           * DRAW DIFFERENT BASES. `city.js` puts a 0.9 m square pedestal under
           * a `flood` (half 0.45) and a 0.42 m one under a `lamp` (half 0.21),
           * so one number for both under-claims the flood on every side —
           * CONTRACT §9.1 with a pedestal. 0.70 is what every existing flood in
           * this file already claims.
           */
          const lightHalf = spec.light === 'flood' ? 0.7 : 0.34;
          const box = claimAt('feature', x, z, lightHalf, lightHalf,
            { y0: 0, y1: spec.lightHeightM, owner: `${l.name}:light` });
          if (reg.conflict(box, 0, LIGHT_SETBACKS)) continue;
          if (spec.light === 'flood') {
            features.push({ kind: 'flood', x, z, height: spec.lightHeightM, aimX: l.x, aimZ: l.z });
          } else {
            features.push({ kind: 'lamp', x, z, height: spec.lightHeightM });
          }
          reg.claim(box);
        }
      }

      /**
       * THE FURNISHING, AND THE COUNT IS THE APRON'S OWN AREA.
       *
       * `DEAD_ZONE` gives a low-detail island a floor of `(104.6 / L)²` for a
       * length `L` that belongs to the kind — session 50's table. This is the
       * same statement for a shape that is not an island: `area / L²`, with
       * the same `L`, so a forecourt and a churchyard are furnished at one
       * density and neither has to know the other's shape. The area is THIS
       * CHUNK'S share, so a landmark spanning four chunks is furnished once.
       */
      const mineArea = mine.reduce((t, q) => t + (q.x1 - q.x0) * (q.z1 - q.z0), 0);
      const want = Math.round(mineArea / (spec.spacingM * spec.spacingM));
      let placed = 0;
      /**
       * THREE TRIES PER OBJECT AND THEN IT STOPS. A refusal here is the
       * registry saying the ground is taken — by the railing that has just
       * gone up, by a building, by another bollard — and the honest answer to
       * a full apron is fewer objects, not a search that finds a gap in it.
       * Session 40's own rule for the same loop.
       */
      for (let i = 0; i < want * 3 && want > 0 && placed < want; i++) {
        if (mine.length === 0) break;
        const q = mine[Math.floor(apronRng.next() * mine.length)];
        const x = apronRng.range(q.x0, q.x1);
        const z = apronRng.range(q.z0, q.z1);
        const pk = spec.props[Math.floor(apronRng.next() * spec.props.length)];
        const half = propHalfWidth(pk, 0);
        /**
         * A METRE INSIDE THE CLAIM'S OWN EDGE, AND IT IS NOT TIDINESS.
         *
         * `city.js` places the street lamps AFTER the pure generator has run,
         * so they are in the delivered census and in no registry band the
         * scatter can test against — session 23's finding, still true. A lamp
         * stands on the kerb just OUTSIDE a landmark's claim (that is what
         * `landmarkOccupies` refuses it), so the one object an apron prop can
         * collide with is the one a metre the other side of the boundary.
         * Measured: without this the sweep gained
         * `prop(planter) x prop(lamp:column)` at 0.064 m², a fourth delivered
         * overlap against the three this project has carried since session 24.
         */
        const edge = 1.0;
        /**
         * AGAINST THE CLAIM'S HALF-WIDTH AND NOT THE SILHOUETTE'S — SESSION
         * 52. This line read `r`, which was the claim's half-width until the
         * setback separated the two; left alone it would have confined every
         * apron prop to the old square and left the new 4.2 m band round the
         * outside — the band the whole item exists to open — unfurnished.
         */
        const R = landmarkClaimHalf(l);
        if (Math.abs(x - l.x) > R - half - edge || Math.abs(z - l.z) > R - half - edge) continue;
        /**
         * AND NOT IN THE STREET CORRIDOR — SESSION 52, AND `citycheck` FOUND
         * IT IN THE FIRST ARM OF THE BIGGER CLAIM.
         *
         * `prop(weir:apron) x prop(tree)`, 0.12 m² at (−390, 246), and it is a
         * CHUNK SEAM rather than a placement bug: chunk (−4,1)'s apron and
         * chunk (−3,1)'s kerbside scatter both furnished the SAME corridor
         * strip and neither registry can see the other. **A chunk owns the
         * corridors on its west and north edges**, so its scatter reaches up
         * to `CORRIDOR` = 11.7 m into the neighbour — the tree stood 8.0 m
         * outside its own chunk, exactly as designed — and the apron clips to
         * its own `chunkBounds` and tested against a registry that had never
         * heard of it. Session 23's lamp gap, one generator over.
         *
         * The guard is the sentence rather than the seam: **a forecourt does
         * not furnish the street.** `latticeCorridor` is the pure function
         * that already answers "is this the carriageway or its two footways",
         * it is what the kerbside scatter's own bands are made of, and it is
         * the same answer in every chunk — so the two can no longer choose the
         * same square metre whatever order they run in. What it costs is
         * measured rather than assumed: the apron loses 11.7 m either side of
         * every lattice line that crosses a precinct, and the delivered count
         * is in STATE 52 §1.
         */
        if (latticeCorridor(x, z, half)) continue;
        /** A forecourt does not furnish its own drive — `inLandmarkApproach`. */
        if (inLandmarkApproach(x, z, half)) continue;
        const spot = claimAt('prop', x, z, half, half, { owner: `${l.name}:apron` });
        if (reg.conflict(spot, 0, APRON_SETBACKS)) continue;
        reg.claim(spot);
        /**
         * `yaw()` AND NOT A FREE ROTATION, AND THE GATE SAID SO IN ONE LINE.
         *
         * The first arm drew `apronRng.range(0, 360)`, and `citycheck`'s
         * alignment criterion measures a prop's deviation from the axis it
         * declares itself aligned to (`refDeg`) against a 3 degree ceiling:
         * **largest deviation 42.80 degrees**, on a criterion that had been
         * green for sixteen sessions. A free rotation is not a hand-placed
         * object, it is an object nobody placed — which is the sentence that
         * criterion exists to make checkable.
         *
         * `yaw()` is the city's own jitter — `CITY.offAxisFraction` of props
         * take a Gaussian at a third of `CITY.maxYawDeg` and the rest are
         * square — and it is what `stack()` and every other fixture in this
         * file uses. It draws from `yawRng`, which is safe HERE and would not
         * be anywhere else: the apron runs LAST, after the scatter, so a draw
         * taken now displaces nothing.
         */
        props.push({
          x, z, yawDeg: yaw(), refDeg: 0, kerb: false, kind: pk,
          scale: apronRng.range(PROP_SCALE.min, PROP_SCALE.max),
          variant: apronRng.int(0, propVariantCount(pk) - 1),
          soil: apronRng.range(0.5, 0.95), lean: 0, leanAzDeg: 0, core: true,
        });
        placed++;
      }
    }
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

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * WHAT SITS ALONG THE EXIT ROAD — SESSION 56, PART TWO (c).
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * The 8 km main street is the one road that leaves the grid, and past
   * 3 232 m it ran to the world's rim with nothing beside it. What stands
   * along a real exit road is the low commerce of the edge — a filling
   * station where the city lets go, allotments where its gardens end — and
   * both are already expressible in this file's own vocabulary: a canopy, a
   * shed, cabinets, planters, a path, floods.
   *
   * TWO SITES, DERIVED AND NOT SCATTERED: the first FULL chunk beyond the
   * lattice edge on each side of the exit (`ceil(extentEdgeM / chunkSize)`
   * = 26 east, −27 west), on alternating sides of the carriageway, so a
   * driver leaving either way passes one. Density is 0 out here so nothing
   * else will ever stand on this ground; every object still claims, because
   * the registry's authority does not end at the edge of the city.
   */
  {
    const EDGE_CHUNK = Math.ceil(CITY.extentEdgeM / CITY.chunkSize);
    const rr = chunkRng(rootSeed, cx, cz, 'roadside');
    if (cx === EDGE_CHUNK && cz === -1) {
      /** THE FILLING STATION — north of the road, forecourt to the kerb line. */
      const sx = cx * CITY.chunkSize + 52;
      ground.push({ x0: sx - 26, x1: sx + 26, z0: -52, z1: -12, kind: 'parkingGround', yKey: 'parking' });
      const can = { x: sx - 8, z: -26 };
      const cBox = claimAt('canopy', can.x, can.z, 13, 6.5, { y0: 5.6, y1: 7.0, owner: 'roadside:canopy' });
      if (!reg.conflict(cBox)) {
        reg.claim(cBox);
        features.push({ kind: 'canopy', x: can.x, z: can.z, yawDeg: 0, length: 26, depth: 13, height: 5.6 });
        /** The pump islands: three cabinets on the forecourt's own line. */
        for (const px of [-8, 0, 8]) {
          const half = propHalfWidth('cabinet', 0);
          const spot = claimAt('prop', can.x + px, can.z, half, half, { owner: 'roadside:pump' });
          if (reg.conflict(spot, 0, PROP_SETBACKS)) continue;
          reg.claim(spot);
          props.push({ x: can.x + px, z: can.z, yawDeg: 90, refDeg: 90, kerb: false,
            kind: 'cabinet', scale: 1.0, variant: 0, soil: rr.range(0.7, 0.95), lean: 0, leanAzDeg: 0 });
        }
      }
      const kBox = claimAt('building', sx + 16, -40, 6, 4.5, { y0: 0, y1: 4.5, owner: 'roadside:kiosk' });
      if (!reg.conflict(kBox)) {
        reg.claim(kBox);
        features.push({ kind: 'shed', x: sx + 16, z: -40, yawDeg: 0, length: 12, depth: 9,
          height: 3.6, floors: 1, style: 'window',
          albedo: [0.42, 0.41, 0.39], trim: [0.30, 0.30, 0.31] });
      }
      for (const fx of [-24, 24]) {
        const fBox = claimAt('site', sx + fx, -48, 0.7, 0.7, { y0: 0, y1: SITE.floodHeightM, owner: 'roadside:flood' });
        if (reg.conflict(fBox)) continue;
        reg.claim(fBox);
        features.push({ kind: 'flood', x: sx + fx, z: -48, height: SITE.floodHeightM, aimX: can.x, aimZ: can.z });
      }
    } else if (cx === -(EDGE_CHUNK + 1) && cz === 0) {
      /** THE ALLOTMENTS — south of the road: beds, huts and a path. */
      const mx2 = cx * CITY.chunkSize + 64;
      ground.push({ x0: mx2 - 44, x1: mx2 + 44, z0: 14, z1: 98, kind: 'grass', yKey: 'grass' });
      const pathR = { x0: mx2 - 1.4, x1: mx2 + 1.4, z0: 14, z1: 98, kind: 'path', yKey: 'pathEW' };
      ground.push(pathR);
      reg.claim(claimBox('path', pathR.x0, pathR.z0, pathR.x1, pathR.z1, { owner: 'roadside:path' }));
      for (let gz = 26; gz <= 86; gz += 24) {
        for (const side of [-1, 1]) {
          /** A hut per plot, off the path, each on its own slight bearing. */
          const hx = mx2 + side * rr.range(22, 36);
          const hBox = claimAt('building', hx, gz, 1.9, 1.5, { y0: 0, y1: 2.6, owner: 'roadside:hut' });
          if (!reg.conflict(hBox)) {
            reg.claim(hBox);
            features.push({ kind: 'shed', x: hx, z: gz, yawDeg: rr.range(-8, 8), length: 3.6, depth: 2.8,
              height: 2.2, floors: 1, style: 'blank',
              albedo: [0.30, 0.26, 0.20], trim: [0.24, 0.22, 0.18] });
          }
          /** The beds: planter rows between the path and the huts. */
          for (let k = 0; k < 3; k++) {
            const bx = mx2 + side * (6 + k * 5.5);
            const half = propHalfWidth('planter', 0);
            const spot = claimAt('prop', bx, gz + rr.range(-6, 6), half, half, { owner: 'roadside:bed' });
            if (reg.conflict(spot, 0, PROP_SETBACKS)) continue;
            reg.claim(spot);
            props.push({ x: (spot.x0 + spot.x1) / 2, z: (spot.z0 + spot.z1) / 2, yawDeg: 0, refDeg: 0,
              kerb: false, kind: 'planter', scale: rr.range(0.9, 1.15), variant: 0,
              soil: rr.range(0.6, 0.9), lean: 0, leanAzDeg: 0 });
          }
        }
      }
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * THE COUNTRYSIDE — SESSION 61. See `COUNTRYSIDE` for the measurement that
   * replaced the brief's premise and for what each piece costs.
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * It runs on every chunk past `CITY.extentEdgeM` — the same predicate the
   * lattice, the lamps and the traffic are gated on, so there is one statement
   * in this project about where the city is and this is its fifth reader.
   *
   * ORDER IS AUTHORITY, exactly as the registry's own note at the top of this
   * function says: the ROAD claims first, then the farmstead, then the house,
   * then the fields are cut round whatever stands on them, then the hedgerows
   * take what frontage is left. A hedge refused by a barn is a gap in a hedge,
   * which is what a farm gate is.
   */
  /**
   * A COUNTRY BUS STOP, DECLARED HERE AND PLACED BY `city.js` — the same
   * split `busStopAt` already has (CONTRACT §9.1: what is decided here is
   * which kerb and how far along; whether that ground is free is the
   * delivered census's question).
   */
  let countryStop = null;
  if (beyondCity) {
    const K = COUNTRYSIDE;
    const cr = chunkRng(rootSeed, cx, cz, 'country');

    /**
     * DOES THIS CHUNK OWN THE EXIT ROAD? It runs at z = 0, which is a chunk
     * BOUNDARY, so exactly one of the two chunks either side of it must own
     * the road or everything beside it is emitted twice.
     *
     * THE FIRST ARM ASKED "does the ribbon cross this chunk" — `b.z0 < half &&
     * b.z1 > -half` — WHICH IS TRUE OF BOTH. Delivered: two verge rectangles
     * over the same ground (coplanar, so a z-fight), two hedgerow runs, two
     * lay-bys and two tree lines, and the trees did not refuse each other
     * because a registry is per chunk (CONTRACT §8.1) and neither chunk can
     * see the other's claims. It reads in the frame as an avenue where a
     * roadside tree line was asked for.
     *
     * The rule is this file's own: **a chunk owns the corridors on its WEST
     * and NORTH sides**, which is the sentence the registry's note at the top
     * of `generateChunk` states and the lattice is built on. The road at z = 0
     * is the north edge of the `cz = 0` row, so that row owns it.
     *
     * BUT OWNERSHIP AND THE CUT ARE TWO DIFFERENT QUESTIONS, and collapsing
     * them into one predicate was the SECOND arm's defect, which the frame
     * caught immediately: with only the owner cutting its fields back, the
     * chunk on the other side laid stubble over the road's near half and
     * **the left half of the frame was a field**. A chunk must keep its fields
     * off the road whether or not it furnishes it.
     *
     *   `nearRoad`  the ribbon and its verge cross this chunk   -> CUT
     *   `ownsRoad`  this chunk furnishes it                     -> VERGE,
     *               trees, hedgerows, lay-by, stop, and the claim
     */
    /**
     * ═══════════════════════════════════════════════════════════════════════
     * AND SINCE SESSION 62 THE ROAD BENDS, SO BOTH PREDICATES READ THE
     * POLYLINE INSTEAD OF THE NUMBER ZERO.
     * ═══════════════════════════════════════════════════════════════════════
     *
     * Session 61's two lines were `b.z0 < half + verge && b.z1 > -(half+verge)`
     * and `b.z0 <= 0 && b.z1 > 0` — both of them the statement *"the road is
     * the line z = 0"*, written twice. `citygen.js` → `EXIT_ROAD` is that line
     * now, and it is a curve, so:
     *
     *   `roadSpans`   the staircase of axis-aligned intervals the ribbon
     *                 crosses this chunk in. Nothing here is rotated: a span is
     *                 four scalars and `subtractBoxes` never learns anything.
     *   `ownSpans`    the x sub-ranges where the CENTRELINE is inside this
     *                 chunk's own z band — which is session 61's *"exactly one
     *                 of the two chunks either side must own the road"* with a
     *                 curve substituted for a boundary. A bending road crosses
     *                 rows, so ownership is now a set of x ranges rather than a
     *                 property of the whole chunk.
     *   `nearRoad`    any span reaches this chunk's z band at all -> CUT.
     */
    const roadSpans = exitRoadSpans(b.x0, b.x1, EXIT_ROAD.vergeStationM)
      .filter((s) => s.zFar0 - K.vergeM < b.z1 && s.zFar1 + K.vergeM > b.z0);
    const ownSpans = exitRoadOwnSpans(b, EXIT_ROAD.vergeStationM);
    const nearRoad = roadSpans.length > 0;
    const ownsRoad = ownSpans.length > 0;
    /**
     * THE ONE ROAD THAT LEAVES, CLAIMED. `block.js` draws it and claims
     * nothing outside `BLOCK_KEEPOUT`, so for 3 832 m of its length it was
     * asphalt nothing had been told about. Claimed per chunk rather than once,
     * because the registry is built per chunk (CONTRACT §8.1 — it must be
     * deterministic in `(rootSeed, cx, cz)` alone) and a claim spanning the
     * world would be a different claim in every chunk that made it.
     *
     * ONE BOX PER STATION INTERVAL, AND EACH TAKES THE `zFar` PAIR, so the
     * claim CONTAINS the ribbon rather than approximating it — the same
     * conservative direction the hedge's claim takes at its rolled height, and
     * the reason a hedgerow or a silo cannot land in the running lane however
     * the road bends. It is claimed over the whole staircase this chunk sees
     * and not only over `ownSpans`: ownership decides who FURNISHES the road,
     * and a chunk the road merely crosses must still refuse things from it.
     */
    for (const s of roadSpans) {
      reg.claim(claimBox('carriageway', s.x0, s.zFar0, s.x1, s.zFar1,
        { owner: 'exit:road' }));
    }

    /**
     * FLAT LAND, and it is the one condition a farm has. `hillMasses` is pure
     * in the root seed and this file owns it, so the same domes `city.js`
     * draws are the ones a farmstead is refused by — not a second description
     * of where the hills are (§9.1). Tested against the chunk's own middle
     * plus the farmstead's own reach.
     */
    const mx = (b.x0 + b.x1) / 2;
    const mz = (b.z0 + b.z1) / 2;
    const onHill = (x, z, pad) => hillMasses(rootSeed)
      .some((h) => !h.wood && Math.hypot(x - h.x, z - h.z) < h.foot + pad);

    /** Everything the fields must be cut around, in this chunk's own coordinates. */
    const solids = [];
    /**
     * THE CUT IS THE STAIRCASE'S OUTER EDGE PLUS THE VERGE, one box per station
     * interval. It CONTAINS the ribbon, so no field is ever drawn on the road
     * whichever way the road is turning.
     */
    for (const s of roadSpans) {
      solids.push({ x0: s.x0, x1: s.x1, z0: s.zFar0 - K.vergeM, z1: s.zFar1 + K.vergeM });
    }
    if (ownsRoad) {
      /**
       * AND THE VERGE IS LAID RATHER THAN LEFT BARE, which session 61's first
       * arm got wrong and an aerial said so: cutting the fields back by
       * `vergeM` without laying anything in the gap left **12 m of the earth
       * plane either side of the road for its whole length**, so from above the
       * exit road read as a pale mottled band rather than as a road with edges.
       * It is session 42's own finding — *"a missing surface is now a surface
       * of about the right colour that is not there"* — arriving at the one
       * place session 42 could not reach.
       *
       * `grass` and not `field`: a verge is mown and a field is cropped, and
       * the two greens either side of the carriageway are what draws the road's
       * edge from the air.
       *
       * AND SINCE SESSION 62 EACH STRIP RUNS FROM THE RIBBON'S **INNER** EDGE
       * OUT TO THE CUT, which is the choice `exitRoadSpans` exists to offer. A
       * rectangle cannot follow a sloping edge, so it either overlaps the
       * tarmac or leaves earth showing beside it; overlapping is bounded at
       * `vergeStationM · tan(19.59°)` = 1.42 m and leaving earth is exactly the
       * defect the paragraph above is about. Grass over the edge of a country
       * road is what grass does.
       *
       * Only over `ownSpans`, so the chunk on the other side of the centreline
       * does not lay a second one over the same ground.
       */
      for (const s of roadSpans) {
        for (const o of ownSpans) {
          const x0 = Math.max(s.x0, o.x0);
          const x1 = Math.min(s.x1, o.x1);
          if (x1 <= x0) continue;
          ground.push({ kind: 'grass', yKey: 'grass', x0, x1,
            z0: s.zFar0 - K.vergeM, z1: s.zNear0 });
          ground.push({ kind: 'grass', yKey: 'grass', x0, x1,
            z0: s.zNear1, z1: s.zFar1 + K.vergeM });
        }
      }
    }

    /**
     * A FARMSTEAD: a house, a barn, a silo and the yard they stand on. Four
     * objects and three of them are session 49's own feature kinds — which is
     * the brief's own point, that eight kinds of place were made from three
     * meshes and not one new one.
     *
     * IT STANDS BACK FROM THE ROAD AND ON FLAT GROUND. A farm on the verge is
     * a filling station; a farm on a hillside is a photograph. Both are
     * conditions on where rather than rolls.
     */
    if (!nearRoad && cr.chance(K.farmChance) && !onHill(mx, mz, 60)) {
      const fx = mx + cr.range(-28, 28);
      const fz = mz + cr.range(-28, 28);
      const yard = { x0: fx - 34, x1: fx + 34, z0: fz - 26, z1: fz + 26,
        kind: 'yardGround', yKey: 'yard' };
      const along = cr.chance(0.5);
      /** The house: TWO STOREYS AT MOST AND ON A LARGE PLOT, which is the
       *  object this city does not contain — every mass inside the extent is a
       *  perimeter building or a landmark. */
      const hBox = claimAt('building', fx - 16, fz - 8, 7, 5,
        { y0: 0, y1: 7.4, owner: 'farm:house' });
      if (!reg.conflict(hBox)) {
        reg.claim(hBox);
        features.push({ kind: 'shed', x: fx - 16, z: fz - 8, yawDeg: along ? 0 : 90,
          length: 14, depth: 10, height: 6.2, floors: 2, style: 'window',
          albedo: [0.36, 0.33, 0.29], trim: [0.26, 0.24, 0.21] });
        solids.push({ x0: yard.x0, x1: yard.x1, z0: yard.z0, z1: yard.z1 });
        for (const g of subtractBoxes([yard], solids.slice(0, -1))) ground.push(g);
      }
      /** The barn: long, blank and taller than the house, which is what makes
       *  a farmstead read from a road rather than a bungalow with sheds. */
      const bBox = claimAt('building', fx + 12, fz + 6, 12, 7,
        { y0: 0, y1: 9.6, owner: 'farm:barn' });
      if (!reg.conflict(bBox)) {
        reg.claim(bBox);
        features.push({ kind: 'shed', x: fx + 12, z: fz + 6, yawDeg: along ? 0 : 90,
          length: 24, depth: 14, height: 8.4, floors: 1, style: 'dock',
          albedo: [0.28, 0.26, 0.235], trim: [0.22, 0.205, 0.19] });
      }
      /** The silo: the one vertical in this landscape, and it is what you see
       *  first from a car. `tower` is session 49's third kind. */
      const sBox = claimAt('building', fx + 30, fz - 14, K.siloHalfM, K.siloHalfM,
        { y0: 0, y1: K.siloHeightM, owner: 'farm:silo' });
      if (!reg.conflict(sBox)) {
        reg.claim(sBox);
        features.push({ kind: 'tower', x: fx + 30, z: fz - 14, yawDeg: 0,
          half: K.siloHalfM, height: K.siloHeightM,
          albedo: [0.40, 0.395, 0.37] });
      }
      /** A tractor's worth of clutter, from the yard's own palette. */
      for (let i = 0; i < 4; i++) {
        const kind2 = ['stack', 'container', 'cabinet', 'bin'][cr.int(0, 3)];
        const px = fx + cr.range(-26, 26);
        const pz = fz + cr.range(-18, 18);
        const half = propHalfWidth(kind2, 0);
        const spot = claimAt('prop', px, pz, half, half, { owner: 'farm:yard' });
        if (reg.conflict(spot, 0, PROP_SETBACKS)) continue;
        reg.claim(spot);
        props.push({ x: px, z: pz, yawDeg: yaw(), refDeg: 0, kerb: false,
          kind: kind2, scale: 1.0, variant: 0, soil: cr.range(0.5, 0.9),
          lean: 0, leanAzDeg: 0 });
      }
    }

    /**
     * A HOUSE ON THE ROAD. Single storey on a big plot, set back behind its
     * own hedge — the brief's *"a different object from anything in this city,
     * and it is what says 'not the city any more'"*. Placed on the far side of
     * the verge so the plot's frontage is the road's own edge.
     */
    if (ownsRoad && cr.chance(K.houseChance)) {
      const side = cr.chance(0.5) ? 1 : -1;
      /**
       * ON THE ROAD MEANS ON THE ROAD, AND SINCE SESSION 62 THAT IS THE CURVE.
       * `hx` is drawn inside an owned span rather than inside the chunk, and
       * the setback is measured from `exitRoadZ(hx)` — so a house on a bend
       * stands beside the bend instead of beside the line z = 0, which after
       * the first shift is 65 m away in a field.
       */
      const span = ownSpans[cr.int(0, ownSpans.length - 1)];
      const hx = span.x0 + cr.range(0, Math.max(0, span.x1 - span.x0 - 24));
      const edge = exitRoadZ(hx) + side * (exitRoadHalfM(hx) + K.vergeM);
      const hz = edge + side * cr.range(16, 30);
      const hBox = claimAt('building', hx, hz, 9, 6, { y0: 0, y1: 5.2, owner: 'country:house' });
      if (!reg.conflict(hBox) && !onHill(hx, hz, 12)) {
        reg.claim(hBox);
        features.push({ kind: 'shed', x: hx, z: hz, yawDeg: cr.range(-4, 4),
          length: 18, depth: 12, height: 4.2, floors: 1, style: 'window',
          albedo: [0.38, 0.355, 0.32], trim: [0.28, 0.26, 0.235] });
        /** The plot: grass up to the verge, so the house stands in a garden. */
        solids.push({ x0: hx - 22, x1: hx + 22,
          z0: Math.min(hz - 20, edge), z1: Math.max(hz + 20, edge) });
        const dr = { kind: 'grass', yKey: 'grass',
          x0: hx - 22, x1: hx + 22,
          z0: Math.min(hz - 20, edge), z1: Math.max(hz + 20, edge) };
        for (const g of subtractBoxes([dr], [{ x0: hBox.x0, x1: hBox.x1, z0: hBox.z0, z1: hBox.z1 }])) ground.push(g);
      }
    }

    /**
     * A LAY-BY AND THE BUS STOP ON IT — the brief's own *"a lay-by, a bus stop
     * with nothing around it"*, and the second half of that phrase is the
     * point: a shelter on an empty verge is the object that says somebody
     * lives out here without a building to prove it.
     *
     * ONE IN FIVE ROAD CHUNKS, which at 128 m puts a stop about every 640 m —
     * a rural service interval rather than the city's own
     * `BUS_STOP.perChunkP` of 0.5. It is a `busStop` DECLARATION in the same
     * shape `busStopAt` returns, so `city.js` builds it with the shelter,
     * flag, bench and lit timetable it has built since session 30 and this
     * adds no geometry at all.
     */
    if (ownsRoad && cr.chance(0.2)) {
      const side = cr.chance(0.5) ? 1 : -1;
      const lspan = ownSpans[cr.int(0, ownSpans.length - 1)];
      const along = (lspan.x0 + lspan.x1) / 2;
      /**
       * The hard standing the shelter sits on, out of the running lane — and
       * since session 62 it is a run of station-length boxes beside the curve
       * rather than one 52 m rectangle beside z = 0. A lay-by is 52 m long and
       * the road turns 19.6°, so one rectangle would have put a third of it in
       * the carriageway and the rest in a field.
       */
      const layFrom = Math.max(lspan.x0, along - 26);
      const layTo = Math.min(lspan.x1, along + 26);
      for (const s2 of exitRoadSpans(layFrom, layTo, EXIT_ROAD.vergeStationM)) {
        ground.push({ kind: 'parkingGround', yKey: 'parking',
          x0: s2.x0, x1: s2.x1,
          z0: side > 0 ? s2.zNear1 : s2.zFar0 - K.vergeM,
          z1: side > 0 ? s2.zFar1 + K.vergeM : s2.zNear0 });
      }
      /**
       * `axis: 'z'` AND NOT `'x'`, AND THE FIRST ARM HAD IT THE OTHER WAY —
       * CONTRACT §9's transposition, caught by reading the record back against
       * its consumer rather than by a frame.
       *
       * `busStopAt`'s own bands are `{ axis: 'x', at: b.x0 }` and their
       * `along` runs over the chunk's **z**: the field names the axis the band
       * is FIXED on, which is the opposite of the axis it runs along, and it
       * is the same pair of quantities session 22's `kerbRef` swapped over
       * 1 134 props. The exit road is fixed at **z = 0** and runs along x, so
       * it is a `'z'` band with `along` an x coordinate. Written the other way
       * `city.js` computes `bx = at + side * standoff` and `bz = along`, which
       * puts a shelter 8.6 m from the world ORIGIN in x and 3.4 km away in z —
       * a stop in a field, on a chunk that never asked for one.
       */
      countryStop = { axis: 'z', at: exitRoadZ(along), side, along };
    }

    /**
     * TREES ALONG THE VERGE, and they are the one thing in this landscape that
     * reads from every distance — the same sentence the sports ground's own
     * boundary planting is built on. Spaced at `PROP_SPACING`-scale intervals
     * rather than in a row: a roadside tree line in the world is a remnant of
     * a hedge and is irregular.
     *
     * OFFERED TO THE REGISTRY LIKE EVERY OTHER PROP, so a tree is refused from
     * the carriageway this block claimed at the top and from the hedge, the
     * house and the lay-by below it.
     */
    if (ownsRoad) {
      for (const side of [-1, 1]) {
        for (let t = b.x0 + cr.range(4, 26); t < b.x1; t += cr.range(18, 44)) {
          const scale = cr.range(PROP_SCALE.min, PROP_SCALE.max);
          const variants = propVariantCount('tree');
          const tv = variants > 0 ? cr.int(0, variants - 1) : 0;
          const pad = propHalfWidth('tree', tv) * scale;
          /**
           * ON THE VERGE'S OUTER EDGE, WHEREVER THE VERGE IS. 1.2 m in from the
           * cut, so a crown overhangs the road the way a roadside tree does
           * and its trunk does not. The registry still refuses it from the
           * carriageway claim above, which is what makes this a position and
           * not a guarantee.
           */
          const tz = exitRoadZ(t) + side * (exitRoadHalfM(t) + K.vergeM - 1.2);
          const spot = claimAt('prop', t, tz, pad, pad, { owner: 'country:tree' });
          if (reg.conflict(spot, 0, PROP_SETBACKS)) continue;
          reg.claim(spot);
          props.push({ x: t, z: tz, yawDeg: yaw(), refDeg: 0, kerb: false,
            kind: 'tree', scale, variant: tv, soil: cr.range(0.62, 1.0),
            lean: cr.range(-1, 1), leanAzDeg: cr.range(0, 360) });
        }
      }
    }

    /**
     * THE FIELDS. The chunk, split once on each axis at a drawn line, cut
     * round everything above, and laid as two crops so a rim reads as farmland
     * rather than as one carpet. Each is `ground`, which conflicts with a
     * building, a landmark and the water and with nothing else — which is
     * right: a field is a surface things stand on.
     */
    /**
     * THE PARCEL IS A WORLD OBJECT AND NOT A CHUNK ONE — SESSION 62. Session
     * 61's split rolled `chunkBounds` in half on each axis, so 218 of 218
     * parcels lay wholly inside one 128 m chunk and every one of them had two
     * edges on the lattice. `FARM` above carries the measurement and the whole
     * derivation of what replaces it.
     *
     * The chunk still EMITS its own square — it must, because `generateChunk`
     * is deterministic in `(rootSeed, cx, cz)` alone (CONTRACT §8.1) — but the
     * boundaries it cuts on come from `farmLinesIn`, which is a function of the
     * world coordinate. Two chunks either side of a parcel compute the same
     * lines and hash the same crop, so what the frame shows is one field
     * crossing a chunk boundary rather than two fields meeting on one.
     */
    const xs = [b.x0, ...farmLinesIn(rootSeed, 'x', b.x0, b.x1), b.x1];
    const zs = [b.z0, ...farmLinesIn(rootSeed, 'z', b.z0, b.z1), b.z1];
    for (let i = 0; i + 1 < xs.length; i++) {
      for (let j = 0; j + 1 < zs.length; j++) {
        /**
         * THE CROP IS HASHED FROM THE PARCEL'S OWN INDEX PAIR, taken at the
         * cell's centre. Session 61's `(ci++ + cx + cz) % 2` was a parity over
         * a loop counter, and the measurement found what that costs: on all 28
         * four-way-split chunks it put the two same-crop cells at the same `j`,
         * so the colour made two full-width bands and **the x split line
         * carried no change of crop at all**. Half of every four-way split was
         * invisible.
         */
        const kx = farmIndex(rootSeed, 'x', (xs[i] + xs[i + 1]) / 2);
        const kz = farmIndex(rootSeed, 'z', (zs[j] + zs[j + 1]) / 2);
        const c = farmCrop(rootSeed, kx, kz);
        for (const g of subtractBoxes(
          [{ x0: xs[i], x1: xs[i + 1], z0: zs[j], z1: zs[j + 1],
            kind: c.kind, yKey: 'grass', tone: c.tone }],
          solids
        )) ground.push(g);
      }
    }

    /**
     * THE HEDGEROWS. One run on each of the two split lines, and one along
     * each side of the road where the road crosses — which is the frontage a
     * driver actually sees. Every segment is offered to the registry, so the
     * run BREAKS around a barn, a house and the road itself and closes up
     * again, which is what a hedge with a field gate in it looks like (the
     * same argument the churchyard's grave rows are laid on).
     */
    /**
     * ONE SEGMENT, AT A POINT AND A YAW — session 62, hoisted out of `hedgeRun`
     * so that the run along the exit road can hand it the road's own tangent.
     * A hedge beside a bend that is drawn axis-aligned is a fence panel across
     * a field, which is what session 61's road hedges became the moment the
     * road stopped being the line z = 0.
     *
     * THE CLAIM IS STILL AXIS-ALIGNED and it is the rotated-AABB expression
     * this file already carries in five places: a box of length L and depth W
     * at yaw t occupies `|cos t|·L + |sin t|·W` on x and the transpose on z.
     * At the road's peak 19.59° that inflates a 12 x 0.7 m segment's claim to
     * 11.55 x 4.68 m, which is the conservative direction — a hedge refuses
     * slightly more ground than it stands on, and refusing is what a claim is
     * for.
     */
    const hedgeSeg = (x, z, yawDeg) => {
      /**
       * THE HEIGHT IS ROLLED PER SEGMENT AND THE CLAIM TAKES THE CEILING.
       * A hedge whose top line is dead flat over 128 m is a wall, which is
       * what the first arm delivered and what the frame showed. +-20% of
       * 1.8 m is 1.44 to 2.16 — a stock-proof hedge either way, and the
       * only difference is that its top is a line somebody cut rather than
       * a line somebody drew. The claim is made at the FULL height so a
       * shorter segment still refuses what a taller one would (the
       * conservative direction, and the same one the ball-stop's low sides
       * take).
       */
      /**
       * AND ONE SEGMENT IN TWELVE IS A GAP, which is a FIELD GATE. A hedge
       * that only breaks where the registry refuses it breaks at buildings
       * and nowhere else, so a 128 m run beside a road reads as a fence
       * panel; a hedge in the world has a way into the field behind it every
       * hundred metres or so. `1/12` of a 12 m segment is one 12 m gap per
       * 144 m, which is that spacing and is one roll rather than a second
       * placement pass.
       */
      if (cr.next() < 1 / 12) return;
      const hh = K.hedgeHeightM * (0.8 + cr.next() * 0.4);
      const yd = yawDeg + yaw();
      const cs = Math.abs(Math.cos((yd * Math.PI) / 180));
      const sn = Math.abs(Math.sin((yd * Math.PI) / 180));
      const halfX = (cs * K.hedgeSegM + sn * 2 * K.hedgeHalfT) / 2;
      const halfZ = (sn * K.hedgeSegM + cs * 2 * K.hedgeHalfT) / 2;
      const box = claimAt('feature', x, z, halfX, halfZ,
        { y0: 0, y1: K.hedgeHeightM * 1.2, owner: 'country:hedge' });
      if (reg.conflict(box)) return;
      reg.claim(box);
      features.push({ kind: 'edge', edge: 'hedge', x, z,
        length: K.hedgeSegM, height: hh, yawDeg: yd });
    };
    /** A run of segments along one world-axis line. */
    const hedgeRun = (axis, at, from, to) => {
      for (let t = from; t + K.hedgeSegM <= to; t += K.hedgeSegM) {
        const c = t + K.hedgeSegM / 2;
        hedgeSeg(axis === 'x' ? c : at, axis === 'x' ? at : c, axis === 'x' ? 0 : 90);
      }
    };
    /**
     * ON THE BOUNDARIES THAT EXIST, WHICH IS THE BRIEF'S OWN PHRASE. Session
     * 61 ran a hedge along the chunk's two rolled split lines, so every hedge
     * in the world was 128 m long and stopped at a chunk edge whether or not a
     * field did. These run along `farmLinesIn`'s world lines instead, and the
     * neighbouring chunk continues the same line from the same number — so a
     * hedgerow is now as long as the parcel it bounds.
     */
    for (const v of farmLinesIn(rootSeed, 'x', b.x0, b.x1)) hedgeRun('z', v, b.z0, b.z1);
    for (const v of farmLinesIn(rootSeed, 'z', b.z0, b.z1)) hedgeRun('x', v, b.x0, b.x1);
    /**
     * AND ALONG THE ROAD, WHICH IS THE FRONTAGE A DRIVER ACTUALLY SEES — one
     * segment per station interval now, standing on the outer edge of the
     * verge and taking the road's own yaw, so the hedge follows the bend
     * instead of running through it.
     */
    if (ownsRoad) {
      for (const side of [-1, 1]) {
        for (const o of ownSpans) {
          for (let t = o.x0; t + K.hedgeSegM <= o.x1; t += K.hedgeSegM) {
            const c = t + K.hedgeSegM / 2;
            const hz = exitRoadZ(c) + side * (exitRoadHalfM(c) + K.vergeM);
            hedgeSeg(c, hz, -exitRoadYawDeg(c));
          }
        }
      }
    }
  }

  return {
    cx, cz, density, lowDetail, kind,
    /**
     * WHETHER THIS CHUNK IS PAST THE CITY'S EDGE — SESSION 62, AND IT IS
     * PUBLISHED BECAUSE TWO READERS OF ONE PREDICATE WERE READING IT AT TWO
     * DIFFERENT POINTS.
     *
     * `beyondCity` above is `cityExtentAt(cxWorld, czWorld) <= 0` — the
     * chunk's own CENTRE, and its comment says so in as many words: *"the test
     * is the chunk's centre, so the boundary is 128 m ragged"*. It gates the
     * lattice, the props, the low-detail island and the whole countryside, so
     * a chunk is farmland or it is city, entirely, either way.
     *
     * `city.js`'s street lamps read `cityExtentAt` too — and at THE LAMP'S OWN
     * POINT. A rim chunk whose centre is outside the circle still has a
     * crescent of itself inside it, so the lamp survives on ground the same
     * predicate has already turned into a field. **Measured over the whole
     * world at seed 1337: 563 street lamp stations standing on a countryside
     * chunk**, ten of them on chunk (25, 0) — the exit road, which is where
     * the operator's aerial was shot and what he named as *"CITY LAMP POSTS
     * STANDING IN FARMLAND"*.
     *
     * It is CONTRACT §9 rule 7 with a predicate instead of a datum: *"both
     * sides of the check shared the assumption"* — except here they did not
     * share it, they evaluated it at two places, and neither is wrong on its
     * own terms. So the decision is made ONCE, here, and handed out. The
     * counter-measurement is the same run's other column: **363 stations on a
     * LATTICE chunk that the point test refuses**, i.e. drawn road with no
     * lamp on it, which reading the chunk's own answer also repairs.
     */
    beyondCity,
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
    /**
     * The block boundary, so `groundprobe` and `citycheck` can say how much of
     * the frontage gap this island closed and how wide its way in is without
     * counting features by name. Session 47.
     */
    coreWallSegments,
    coreGateSegments,
    /** What the keep-out registry refused, by the category that refused it. */
    refused,
    /** Session 52. Street ends drawn, and ends declined as too short. */
    streetEnds,
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
    busStop: countryStop || busStopAt(rootSeed, cx, cz),
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
