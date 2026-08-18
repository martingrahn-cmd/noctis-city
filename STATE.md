# NOCTIS — STATE

*End of session 36. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`, 38 days of
uptime. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` WAS 2.58 AT THE FIRST COMMAND AND RANGED 1.29 TO 5.65 ACROSS THE SESSION***,
against CONTRACT §0.2's bar of **1.6**. **SO NO MILLISECOND IN THIS FILE IS ADMISSIBLE AS AN
ABSOLUTE**, and none is quoted as one. Everything below is a COUNT, a DISTANCE, an AREA or a
PIXEL STATISTIC — all load-independent, CONTRACT §9 rule 6's own corollary — or a paired
before/after taken through the same instrument on the same machine within minutes of itself.
**The last four commands of the session ran at `load1` 1.29–1.77 and one of them is a
finding**: §6.

---

## 0. THE FRAMES, AND THE NUMBER

**ISLAND COVERAGE 28.1% → 31.2%**, over the 81 chunks of `citycheck`'s own 10 × 10 region at
seed 1337 that carry a building, against **95.0%** for a full ring at the depth session 35
built. Buildings 491 → 528. Frontage occupancy per block 0.237 → 0.268. Block sides bare end
to end 147 → 137 of 400.

| # | frame | LOOK.md | did the city move toward it |
|---|---|---|---|
| 1 | `shot-out/s36-air-before-t0_5649-wet.png` → `s36-air-after-t0_5649-wet.png` | **§2** | **YES, AND MODESTLY, AND THE ARITHMETIC SAID IT WOULD BE MODEST.** Session 35's own aerial pose, so three sessions now stand in the same place. Mid-distance blocks that read as a tower on open ground in the before carry a mass at the lot line in the after, most visibly in the western district on the left and around the dish. It is +3.1 points of coverage and it looks like +3.1 points of coverage. **The blocks read as more solid than they did and they do not read as solid.** |
| 2 | `shot-out/s36-gained-before-t0-wet.png` → `s36-gained-after-t0-wet.png` | **§2, §4** | **YES, AND THIS IS THE PAIR THAT SHOWS WHAT THE CHANGE IS.** A street at 1.9 m, midnight, wet. The before's right-hand side is a dark gap with a small building set back behind it; the after's right-hand side is a lit wall running the whole depth of the frame to the kerb. **This is a street wall closing, which is the thing §2 asks for and the thing depth could not do.** THE POSE WAS CHOSEN, AND CHOSEN BY THE NUMBER: chunk (−2,2) went 5 buildings → 9, the joint-largest gain in the region. It is not a random street and it is not offered as one. |
| 3 | `shot-out/s36-street-before-t0-wet.png` → `s36-street-after-t0-wet.png` | **§2** | **NO, AND THAT IS THE HONEST HALF OF FRAME 2.** Session 35's frame-3 pose, taken again so the two sessions are comparable. The two frames are nearly identical. The reason is measured: **58 of 100 chunks are unchanged, 32 gained a building and 10 LOST one to the re-phase** — and the chunk this camera looks into, (−4,3), is one of the ten that lost. Which street you stand in decides whether you see the change at all. |

```
1  node tools/lookat.mjs --pos=-180,230,700  --target=-330,0,460 --fov=60 --t=0.5649 --wet=1
2  node tools/lookat.mjs --pos=-250,1.9,256  --target=-60,10,256 --fov=55 --t=0.0    --wet=1
3  node tools/lookat.mjs --pos=-500,1.9,393.6 --target=-250,10,391 --fov=55 --t=0.0  --wet=1
```

All are `lookat` frames and therefore **frozen** — `?paused=1` stops the clock. Every "before"
was taken by checking session 35's `citygen.js` out over the working tree and re-shooting the
same pose minutes later, so each pair is one instrument on one machine.

**NONE OF THE THREE IS A TRUE A/B, FOR SESSION 35's REASON.** A REFUSED candidate costs `rng`
a different number of draws from a PLACED one, so the first building whose verdict the new
fill changes re-phases every building after it on that side. The delivered city is a different
population. That is what the ten chunks that LOST a building are, and there is no arrangement
of streams that avoids it — §1.7.

---

## 1. THE ONE ITEM — THE FRONTAGE FILL LAW

`4928bdd`, `3cb1b91`, and `8a9f857` for LOOK.md. **The item landed. The brief's expected
limiter is not the limiter and is not close to being one.**

### 1.1 THE INSTRUMENT FIRST, BECAUSE THERE WAS NONE

`tools/fillprobe.mjs`. The frontage numbers this project has quoted for four sessions —
*"median block frontage occupancy 0.162 before the raise and 0.244 after, with 148 of 400
block sides still bare end to end"* — came from a session-32 throwaway that is not in the
repository, which is the property LOOK.md §8 says a quoted figure must never have. Over
`citycheck`'s own region, walked through `generateChunk`:

- **a side's occupancy is the UNION of the buildings' projections onto it**, not the sum of
  their widths, because at the fills this session swept a corner building projects onto two
  sides and two buildings are a wall with a bulge rather than 1.3 walls;
- **which side a building fronts is `bld.facing`**, not its position — the same reading
  `depthprobe` makes and for the same reason (STATE 35 §1.1);
- **the river-bank terrace is excluded** from the occupancy statistic, because its lot line is
  the water. It is counted separately.

**IT REPRODUCES SESSION 32's SWEEP AT BOTH ENDS.** Under session 34's depth law — `--depth=band`
— it delivers **479 buildings at `d^1.4` against session 32's 480** (the one is STATE 35 §1.5's
ulp repair, not the law) and **797 at `fill = 1.0` against session 32's 797, exactly**.

**AND IT DOES NOT REPRODUCE THE 0.244.** On session 32's own population the per-BLOCK median
reads **0.234** and the per-SIDE median 0.185; its **148 of 400 bare sides reproduces exactly**.
So the denominator is the block and the figure is a hundredth out, and neither was ever
written down. `fillprobe` prints per-side, per-block, per-built-block and a summed-widths arm
side by side so the next quotation carries its population.

### 1.2 THE LAW IS A KNOB NOW, AND THE REFACTOR IS BIT-FOR-BIT

`FRONTAGE_FILL` and `frontageFill()` in `citygen.js`, beside `DEPTH_DISTRIBUTION`, which is the
same statement about the same field with a different power. Both call sites — the island
perimeter and the quay walk — go through the one expression. **Determinism control: byte-
identical `depthprobe` output across the refactor**, before any number moved.

### 1.3 THE SWEEP, AND WHAT ACTUALLY STOPS IT

All arms through the same generator, same region, same seed. `cover%` is the UNION area of
building claims over the islands rastered at 0.5 m — comparable with `depthprobe`'s headline
and NOT with its `--sweep` column, which is a sum of footprints.

```
  power   fill@d.3  bldgs  quay  cover%  cover%pop  occ/side  occ/blk  bare/400  props  objCV
   1.40     0.283    491     9    22.8%    28.1%     0.193    0.237   147/400   1590   0.626
   1.20     0.328    513     9    24.5%    30.3%     0.213    0.250   136/400   1590   0.621
   1.10     0.354    528     8    25.2%    31.2%     0.218    0.268   137/400   1590   0.626   <- ships
   1.05     0.369    548     8    26.0%    32.1%     0.223    0.277   138/400   1590   0.611
   1.00     0.384    552     8    26.1%    32.2%     0.220    0.283   140/400   1591   0.609
   0.95     0.400    569     6    27.0%    33.3%     0.232    0.293   134/400   1591   0.604
   0.90     0.418    595     7    27.8%    34.4%     0.238    0.306   128/400   1591   0.591  RED
   0.50     0.602    689    10    31.1%    38.4%     0.315    0.355   118/400   1589   0.568
   0.00     1.000    786     2    36.8%    45.4%     0.372    0.463   122/400   1583   0.535
```

**THE DRAW-CALL CEILING NEVER BINDS, AND THE BRIEF EXPECTED IT TO BIND HARDEST.** At
`fill = 1.0` — 60% more buildings than ship — `highway_speed` measures **437 draws of 440**.
The whole range of this law costs **four draw calls**. What binds at that end is the TRIANGLE
ceiling: **2.18 M against 2.00 M**, and the two endpoints imply 1.96 kTri per building, so
2.00 M is first breached near **700 buildings**, which is `power ≈ 0.40`.

**AND `citycheck`'s CLUMPING FLOOR BINDS BEFORE EITHER, AT `d^0.90`.** `objCV` is
buildings + props + signs per chunk and the floor is 0.60. A SMALLER power fills the SPARSE end
of the density field hardest — at density 0.30 the fill goes 0.283 → 0.548 between `d^1.4` and
`d^0.6`, at density 0.80 it goes 0.764 → 0.890 — so what the knob spends is district structure,
and district structure is exactly what that floor is for. LOOK.md §2's *"density has causes"*
asks for the same thing from the other side, so **it is not a proxy arguing against the goal
and it was not re-derived.**

### 1.4 THE ARM THAT SHIPS, AND THE RULE THAT CHOSE IT

**`power` 1.4 → 1.1: the largest raise that costs no clumping margin at the gate's own seed.**
`objCV` is 0.626 at 1.4 and 0.626 at 1.1, and 0.611 one step further on. It is a measured rule
and not a derived number, which is the same footing session 32's 1.4 stood on — *"where the
budget stops, not where the picture does"*.

> **AND THE MARGIN THAT RULE PROTECTS IS ONE DRAW, MEASURED.** `objCV` at the SHIPPED law over
> five seeds reads **0.626 at 1337, 0.529 mean, 0.466 worst — a spread of 0.160 against a floor
> margin of 0.026.** The gate is green at 1337 and would be red at four of the five other
> regions. That is CONTRACT §0 rule 6's own condition — a threshold compared against one draw
> whose spread is six times the margin — and it is recorded here rather than acted on. **No
> threshold moved.** `fillprobe --sweep --seeds=` prints it.

### 1.5 DELIVERED

```
                                       s35        s36
  buildings over the region            491        528
  of those, river bank                   9          8
  chunks carrying a building            81         81
  island coverage, all 100            22.8%      25.2%
  island coverage, the 81 built       28.1%      31.2%     against 95.0% for a full ring
  frontage occupancy, per side        0.193      0.218
  frontage occupancy, per block       0.237      0.268
  block sides bare end to end       147/400    137/400
  median depth into the island       29.6 m     29.8 m     unchanged, as expected
  props / props given up            1590/54    1590/54     identical
  signs                                724        755
  objectCount CV                     0.626      0.626      citycheck floor 0.60
```

**32 chunks gained a building, 10 lost one, 58 are unchanged.** The largest gains are (−4,4)
9 → 13, (−2,2) 5 → 9 and (−1,−3) 1 → 5; the largest losses are (−4,3) 11 → 9, (−1,1) 5 → 3 and
(3,−4) 7 → 5, and every loss is the re-phase.

### 1.6 THE OCCUPANCY REGISTRY REFUSED NOTHING, AND IT HAS BEEN BLAMED FOR FOUR SESSIONS

The brief asked what refuses what if the raise stops at session 32's `sign(adpillar) ×
prop(planter)` overlap of 0.061 m². **It does not stop there. `citycheck`'s delivered census
reads 0 / 0 forbidden overlaps over 53 forbidden pairs, on 5 512 generator claims and 4 169
delivered** — against session 35's 5 475 and 4 131. The generator's own refusals rose with the
fill, 96 → 124 `building` and 267 → 235 in total across the categories, which is the walk
working rather than the registry stopping it.

That overlap was measured at a DIFFERENT arm — session 32's `0.20 + 0.80·d^1.2`, which moves
the law's lower endpoint as well as its power — and against session 34's building population.
Neither survives. **LOOK.md §2's "THE LIMITER IS THE OCCUPANCY REGISTRY" bullet is corrected in
this session's commit**, and the registry keeps its absolute authority under §7 regardless: it
simply was not what was in the way.

### 1.7 EMPTY STILL MEANS EMPTY FOR A REASON, AND NO FILL LAW CAN CHANGE THAT

The brief asked that parks, yards, lots, car parks and building sites not be filled. **They
cannot be**, and the reason is structural rather than careful: the perimeter walk is inside
`if (!lowDetail)`, and `lowDetail` is what makes a chunk one of those five kinds in the first
place. A chunk with a park in it has no perimeter walk to raise.

```
  kind            chunks in region    of them, carrying no building
  built                  83                 2
  parking                 5                 5
  lot                     4                 4
  construction            3                 3
  yard                    3                 3
  park                    2                 2
```

**19 empty chunks: 17 non-`built` and 2 `built`**, against LOOK.md §2's recorded 21 (17 and 4)
— session 35's depth change populated two of the four. `citycheck`'s negative-space floor reads
17.0% of chunks low-detail over 5 kinds, against a floor of 8% and 3.

### 1.8 THE COST, MEASURED

`perfcheck --runs=1`, which **overrides `budget.capture.runs=3` and is therefore not the gate's
verdict**. The counts are the admissible half and CONTRACT §0.1 says counts do not drift; the
`highway_speed` row was measured three separate times across the session at three different
loads and read 434 / 1.71 M / 221 078 every time.

```
  route            s35 draws   s36 draws   s35 inst   s36 inst   s36 tris
  downtown_dense       332         332      152 461    164 182     1.45M
  highway_speed        433         434      204 631    221 078     1.71M
  night_rain           336         336      188 193    204 094     1.43M
  player               322         324      152 461    164 182     1.42M
```

**`highway_speed` stands at 434 of 440 — SIX SPARE, down from seven.** Thirty-seven buildings
cost ONE draw call. The brief expected this change to cost more draw calls than any before it;
it cost the fewest per building of any content change on record, and §1.3 says why.

### 1.9 THE QUAY IS LEFT INVERTED, DELIBERATELY, WITH THE NUMBER BESIDE IT

Session 28 derived the quay's own fill power as the perimeter's less 0.6 — *a waterfront is the
one frontage a city builds on before it builds on anything else* — and wrote 1.6 against the
perimeter's 2.2. Session 32 moved the perimeter to 1.4 without moving the quay, which inverted
the sentence; **this session moved it to 1.1 and has made the inversion worse.**

Restoring the relation is `quayPower = 0.5` and it delivers **17 river-bank buildings against
8, +9 buildings and +0.2 points of island coverage.** It was not taken, because it decides a
content question this project has open: STATE 35 §1.6 records that the deep island frontage
already took the quay from 12 to 9, and *which frontage owns a narrow riverside lot* is the
operator's call and not a side effect of a fill raise. The number is in the source beside the
knob so that call costs ten minutes.

### 1.10 FILL IS NOT THE LAST KNOB EITHER, AND THE THIRD ONE IS THE GAP

**At `fill = 1.0` the delivered coverage is 45.4%** against 95.0% for a full ring at this depth.
The frontage roll taken to certainty still leaves more than half the island empty. Two terms
hold the rest, and both are measured:

- **the end-of-run gap.** A run of 1–4 buildings is followed by `rng.range(6, 26)` — a mean of
  16 m of frontage given away per run. Session 32's comment says this gap *"is worth revisiting
  only if the roll ever gets near 1"*; the roll has now been taken to 1 and the condition is met.
- **the refusals, and they are session 35's depth coming back.** At the ceiling the registry
  refuses 484 candidates over the region, **282 of them against another BUILDING**. The four
  sides are walked x-first, so two 40.6 m corner buildings own 81 m of a 104.6 m side before
  the walk that runs third arrives. **Depth and fill do not purely multiply — they fight at the
  corners.** Measured over the 2 × 2 of both laws at both settings, they multiply to within 6%:
  predicted 48.3% at the ceiling under the new depth, delivered 45.4%.

---

## 2. THE LUMINANCE BANDS DID MOVE, AND ONE OF THEM IS NOW 0.0001 FROM ITS FLOOR

Three runs of `lookcheck` on each side, all four times of day, dry and wet, minutes apart on
one machine. **The dry means were identical to within 0.0001 across the three runs on each
side**, so the run-to-run spread of this instrument is 0.0001 and every delta below is
resolvable by it.

```
  band          before    after     delta     band              margin before → after
  midnight dry  0.0744    0.0748   +0.0004   [0.072, 0.112]      0.0024 → 0.0028
  midnight wet  0.0793    0.0798   +0.0005
  dawn dry      0.3005    0.3037   +0.0032   [0.299, 0.353]      0.0015 → 0.0047
  dawn wet      0.2996    0.3033   +0.0037
  noon dry      0.4292    0.4281   -0.0011   [0.428, 0.482]      0.0012 → 0.0001
  noon wet      0.3924    0.3926   +0.0002
  dusk dry      0.1392    0.1399   +0.0007   [0.14, 0.18]       -0.0008 → -0.0001  RED, closer
  dusk wet      0.1418    0.1425   +0.0007
```

**SESSION 35 SAW NOTHING MOVE PAST 0.0003 AND THIS SESSION MOVED DAWN BY 0.0032.** The brief
expected little for session 35's reason — `lookcheck`'s camera stands in the origin block,
which `block.js` authors and the generator never touches. That reason is still true and it is
not the whole truth: **the streamed city reaches the frame as mid-distance walls, and this
change added mid-distance walls.** The signs agree with the mechanism: at dawn the sun is 5°
above the horizon and lights vertical surfaces, and the mean went UP; at noon it is at 58° and
lights the ground, and more buildings mean more shadow, so the mean went DOWN.

> **`band:noon` NOW SITS 0.0001 ABOVE ITS FLOOR, AND IT LOST 92% OF ITS MARGIN TO 37
> BUILDINGS.** `gateaudit`'s headroom table, on the shipped frames: `band noon 0.4281 in
> [0.428, 0.482] nearest edge 0.0001`. The margin now EQUALS the measured run-to-run spread,
> which is the state LOOK.md §7 already named this band for and which is now a number rather
> than a suspicion. **The direction is the finding: a floor on the noon mean is a ceiling on
> density**, and §2 spends the whole section arguing for density. `citycheck`'s 6.00% bright
> reserve moved the same way in the same run, 5.67% → 5.33%.

**NO LOOK BAND WENT RED THAT WAS NOT RED BEFORE**, so nothing was owed under LOOK.md §7 and
**no budget file was touched.** `budget.json`, `look-budget.json`, `city-budget.json` and
`input-budget.json` are byte-identical to session 35.

---

## 3. GATE STATE

Each gate run individually, because `npm run gates` is `&&`-joined and stops at the first red.

```
  parsecheck   GREEN   108 files, contract-clean
  faultcheck   GREEN   7 cases; quarantine surgical, frame survives all seven
  windcheck    GREEN
  gateaudit    RAN — first time in four sessions. §3.3
  citycheck    RED at 1 — saturation, and it is the one that has been red for six sessions
  lookcheck    RED at 3 — all three carried
  inputcheck   RED at 4 — AND IT IS NOT THIS SESSION'S. §6
  perfcheck    twelve red milliseconds, inadmissible; four content reds. §5
```

### 3.1 `citycheck` — RED AT 1, AND THE OCCUPANCY IS GREEN ON BOTH SIDES

```
  occupancy    5512 generator claims over the region, 4169 delivered (min 1200)
               0 / 0 forbidden overlaps over 53 forbidden pairs (max 0)
  clumping     CV 0.626 (min 0.6), 94% populated (min 55%), objects/chunk min 0 max 68
  prop place   0 of 1590 props inside a building footprint (max 0)
  sign place   0 of 1355 delivered sign quads inside a building (max 0)
  sign mount   5 distinct over 755 generated signs (min 4)
  pedestrians  360 over 9 chunks, CV 1.0148 (min 0.7), 67% populated
  street level 194 stalls over 25 chunks, 5 kinds, 6 pitches abandoned
  alignment    73.7% of 2873 objects off-axis (min 60%), largest 2.27°
  negative sp  17.0% of chunks low-detail (min 8%), 5 kinds (min 3)
  walkability  61 777 of 61 778 free cells reached
  ✗ saturation 5.33% of night-route pixels above 0.5 value (min 6.00%)
```

**`clumping` HELD AT 0.626 EXACTLY**, which is the arm's whole selection rule (§1.4), and the
0.026 of margin STATE 35 called *"the tightest this gate has been"* is unchanged.

**`saturation` moved 0.34 points the WRONG way** — 5.67% at s35 → 5.33% now, with per-run
readings [5.20 5.33 5.33], spread 0.13. CONTRACT §0.1 records this statistic's spread as
**0.60–0.80 points**, so the move is inside it and **it is NOT RESOLVED IN EITHER DIRECTION**,
which is the fourth consecutive STATE to write that sentence. The direction is nonetheless the
same one §2 above records for `band:noon`, and for the same reason.

**`walkability` gained free ground and lost unreachable cells**: 64 234 of 64 253 reached at
s35, **61 777 of 61 778** now. 2 475 fewer free cells because there are 37 more buildings, and
**19 unreachable cells down to 1**. Nothing was aimed at it.

### 3.2 `lookcheck` — RED AT 3, ALL THREE CARRIED

```
  ✗ band:dusk        0.1399  (band [0.14, 0.18])   0.1392 at s35 — moved 0.0007 TOWARD the band
  ✗ facadeAlbedo     3 clusters (min 4)            carried from the station, s31
  ✗ facadeNeighbours 0.213   (min 0.3)             carried from the station, s31
```

`band:midnight`, `band:dawn` and `band:noon` all passed. §2 has the before/after.

### 3.3 `gateaudit` — IT RAN, AND IT HAD NOT FOR THREE SESSIONS

STATE 33, 34 and 35 all recorded it as NOT RUN, which is three sessions in which `lookcheck`'s
own thresholds were never falsified. It runs in under two minutes.

```
  ✗ CONTROL — the unperturbed frames do not pass their own gate:
      band:dusk, facadeAlbedo, facadeNeighbours     <- the same three §3.2 carries
  ok  control — every assertion ran
  ok  every threshold in look-budget.json, fed a frame that should fail it
  ✓  perfcheck --falsify: 74/74 cases rejected, 100% coverage of 72 failure sites
  ✓  citycheck --falsify: 61/61 rejected, 100% coverage
  ✓  inputcheck --falsify: 13/13 rejected, 100% coverage, good fixture clean
  ✓  --falsify: perturbing each threshold against the control rows
```

**Its only failure is that the control fails, and the control fails on the three reds
`lookcheck` already carries.** Every assertion runs; every falsification suite is at 100%.
That is the strongest statement about the gates this project has recorded, and it cost 111
seconds.

> **AND IT AUDITS THE FRAMES `lookcheck` LAST WROTE, WHICH IS A TRAP WORTH WRITING DOWN.**
> `gateaudit` reads `tools/look-out/*.png` rather than rendering. Run after a before/after
> battery it audits whichever arm ran last — the first run of this session reported the BEFORE
> city's headroom under the AFTER code, and reported it convincingly, because every number in
> it was real. Re-run `lookcheck` immediately before `gateaudit` or the table is about a city
> that is no longer checked out.

---

## 4. THE BRIEF'S PREMISES, MEASURED

| # | the brief said | measured |
|---|---|---|
| — | island coverage **20.8% → 28.1%**, full ring **95.0%**, reference **96.3%** | **ALL FOUR REPRODUCE EXACTLY.** 28.1% at HEAD before anything was touched. §1.1 |
| — | `fill = 0.12 + 0.88 · density^2.2`, raised by session 32 to **1.4** | **TRUE AT 1.4.** Now 1.1. §1.4 |
| — | **draw calls stand at 433 of 440**, seven spare | **TRUE AT 433.** Now **434, six spare** — for 37 buildings. §1.8 |
| b | **expect this to cost more draw calls than any change so far** | **FALSE, AND IT IS THE SESSION'S MAIN RESULT.** The whole law taken to `fill = 1.0` — 786 buildings — costs FOUR draw calls, 437 of 440. What binds there is TRIANGLES, 2.18 M of 2.00 M. §1.3 |
| b | **where the ceiling binds before the city does, say so** | **THE CEILING IS `citycheck`'s CLUMPING CV FLOOR AND IT BINDS AT `d^0.90`**, long before triangles and infinitely before draws. Its margin is 0.026 and the statistic's seed-to-seed spread is 0.160. §1.3, §1.4 |
| c | the registry stopped the raise at one **0.061 m²** overlap | **IT DID NOT STOP IT.** 0 / 0 forbidden overlaps at a fill past the one that produced it. That overlap was a different arm on a different population. §1.6 |
| d | do not fill the seventeen non-`built` chunks | **THEY CANNOT BE FILLED.** The perimeter walk is inside `if (!lowDetail)` and `lowDetail` is what made them parks and yards. 19 empty now, 17 non-`built`. §1.7 |
| e | expect little from the bands; **session 35 saw nothing past 0.0003** | **FALSE. Dawn moved 0.0032 and noon lost 92% of its margin.** The origin-block reason is still true and is not the whole truth: the streamed city arrives as mid-distance walls. §2 |
| f | **do the blocks read as solid** | **MORE SOLID, NOT SOLID.** +3.1 points of coverage looks like +3.1 points. Frame 1. And the frontage change IS visible from the pavement where it landed — frame 2 — which is the thing depth could not do. |
| — | *"depth and fill multiply and only one has been raised"* | **THEY MULTIPLY TO WITHIN 6%**, measured over the 2 × 2 of both laws. The 6% is corner refusals: depth and fill fight where two sides meet. §1.10 |
| — | *"I have written a false premise into fourteen consecutive briefs"* | **Three of ten premises above are false**, and one of the three was the brief's own headline expectation. |

---

## 5. `perfcheck` — THE MILLISECONDS ARE INADMISSIBLE AND THE COUNTS ARE NOT

Run as `--runs=1`, which the tool itself prints as **not the gate's verdict**. Every route
breached its GPU p95, GPU max and frame interval, at `load1` 1.52 to 3.19 against CONTRACT
§0.2's bar of 1.6 — the frame interval at **61.5 to 70.9 ms against a 12.5 ms ceiling**. That
is the machine, it is recorded, and **none of it is attributed.**

**THE CONTENT READINGS, WHICH ARE PIXEL STATISTICS AND THEREFORE ADMISSIBLE:**

```
                                       s35 (2 runs)      s36        bound
  downtown_dense mean luminance      0.0711 / 0.0854    0.0930 ✓   min 0.08
  night_rain     mean luminance      0.0672 / 0.0703    0.0850 ✓   min 0.08
  downtown_dense frame entropy        5.074 / 5.396      5.761 ✓   min 5
  night_rain     frame entropy        4.967 / 5.026      5.465 ✓   min 5
  highway_speed  dark gap at ground   absent / absent     71% ✗    min 75%
  highway_speed  tone profile         59% / 61%           52% ✗    min 75%
```

**`night_rain` MEAN LUMINANCE CROSSED ITS FLOOR FROM BELOW** — 0.0672 and 0.0703 at s35, both
red, against 0.0850 now — and **the mechanism is the change**: 37 more buildings on a night
route is 37 more sets of lit windows. It is nonetheless ONE run of a statistic whose s35
per-run readings spanned 0.0607 to 0.0776, so it is **recorded as crossed and not as fixed**.

**`dark gap at the ground` went the other way**, absent from s35's violation list and back at
71% now. STATE 33, 34 and 35 all record this family as one that flaps on a re-phase, and this
is a re-phase. **`tone profile` has been red on every reading for five sessions** — 66%, 59%,
61%, 52% — and STATE 34 §5 already names the change that moves it, which is still not built.

---

## 6. A GATE REPORTED GREEN IN STATE 35 IS RED AT STATE 35's OWN COMMIT

**`inputcheck` fails four bounds, and it is not this session's change.** It was found because
the machine went quiet at the end of the session and the run was repeated to see whether the
reds were load.

```
  ✗ keyboard:walk   3.238 m/s   against PLAYER.walkSpeedMps 3.500      7.5% off, tol 6%
  ✗ keyboard:run    6.193 m/s   against PLAYER.runSpeedMps 7.000      11.5% off
  ✗ gamepad:walk    3.231 m/s   against 3.500
  ✗ gamepad:look  160.39 °/s    against PLAYER.maxLookRateDegPerS 180
```

**BISECTED, one commit at a time, each run 19 seconds:**

```
  a787407  session 34's STATE, the s35 branch point     GREEN
  2c0a4a4  s35 item 1 — building depth                  GREEN
  0f60c9a  s35 item 2 — the signals and the vehicles    RED, all four
  76e9740  session 35's HEAD                            RED, all four
  8a9f857  this session's HEAD                          RED, all four, same numbers
```

**IT IS NOT THE MACHINE AND THAT IS MEASURED**: the same four numbers come back at `load1`
**1.48** and at `load1` **4.75**, varying by under 0.01 m/s. STATE 35 §5 records
`inputcheck GREEN`.

**WHAT IT IS NOT.** Not a collision: `gamepad:look` is a pure ROTATION rate and no wall can
slow it. All four are RATES measured against `ctx.get('time').now`, and all four under-deliver
by 7.5–11.8% — one fraction, on translation and rotation alike, which says the player
integrates less simulated motion per unit of `time.now` than it did. **What in `0f60c9a`
causes that is a QUESTION and this session did not answer it**, because the session had one
item. The bisect is the whole of what is owed to answer it.

---

## 7. WHAT WAS NOT BUILT, AND WHY

- **The end-of-run gap, the corner refusals, the quay's inverted power, haze, facade clutter,
  holograms, the remaining two vehicle devices, the 76 underived bounds and the sceneWalk
  streaming timeout** — all out of scope by the brief. §1.9 and §1.10 leave numbers on the
  first three.
- **`inputcheck`'s four reds were diagnosed and not repaired.** §6.
- **No quiet perfcheck battery.** `load1` fell to 1.29 in the last ten minutes of the session,
  which is the first admissible window in four sessions, and the brief forbids performance
  work. One `inputcheck` run was taken in it because a red had to be attributed.
- **No merge to main.**

---

## 8. WHAT WENT ON THE BRANCH

Branch `claude/noctis-36-frontage-fill`, from `76e9740`, pushed.

```
  8a9f857  LOOK.md §2 and §7 — the limiter was not the registry, and band:noon is at 0.0001
  3cb1b91  The frontage fill law goes to d^1.1, and what stops it is the clumping floor
  4928bdd  fillprobe, and the fill law becomes a knob
  76e9740  <- session 35's STATE, the branch point
```

**NO BUDGET FILE CHANGED. No threshold moved, lowered, raised or re-derived.** No look band
went red that was not red before, so nothing was owed.

`origin/main` still carries session 34's `b2ad696` and nothing after it — the repair STATE 34
§10 names is still one command and still the operator's:

```
git push --force-with-lease origin 2b04ace:main
```

---

## 9. KNOWN GAPS CARRIED FORWARD

**Unchanged from s8–s35**: `stats().cutoffM` hard-codes 0.8, the headroom probe inert,
`saturation-peak.png` overwritten every run, `$fovYDrift`, `camera.setRouteAt(name, 1.0)` at
the sky, rain streaks near-invisible wide at night, `rain_spray` 0 static, **right turns only**,
sun shadows to ~170 m, the bake blind to elevated slabs, the PMREM hitch, the too-red dawn
horizon, one worker at queue depth one, the far half of the river handing back to the night sky
past ~300 m, grime authored, the near-field washboard on the water, the quay wall inside the
walkable mask, props absent from the walkability mask, the 3.5°–10.4° route camera pitch, the
frozen/running A/B, `materials.display` drawn by nothing, the hauler's marker row buried inside
its own body, the seeding fallback's untested placement, **a bus never turns**, the origin
block's absent occupancy registry, `facadeAlbedo` on its floor with zero spread, the station's
cores reading as an open frame, **nobody can climb the station**, the 0.10 m margin at the
core's outer face, `poseprobe`'s blindness to the origin block, the pavement's missing kerb,
`tools/city-budget.json:84`'s stale `$derivation_count`, one merged building pool breaching the
triangle ceiling, the station's platform slab hiding the train, `traffic.js:2346`'s claimed
draw-call margin of one, `minStraightness` and `minArrivalsPerMinute` having no gate reader,
the zero-second protected pedestrian phase, **44 100 m² of the city is an empty concrete bowl**,
`landmarkBlocks` still exported and still disagreeing with the registry two ways, **the basin is
walkable in the mask and unwalkable in the geometry**, the two `walkableAt` sites still blind to
a basin, the dish delivering 88 m of structure against a 62 m keep-out, the quay walk's ulp
exposure on four named chunks, and a gate message frozen in the present tense of the session
that wrote it.

**CLOSED THIS SESSION:**

- **"the fill law is the short knob and one 0.061 m² overlap has stopped it for three
  sessions"** — raised, and the overlap was never the reason. §1.
- **`gateaudit` NOT RUN, three sessions running** — it ran, in 111 seconds. §3.3.

**NEW THIS SESSION:**

- **THE DRAW-CALL CEILING DOES NOT CONSTRAIN THE FILL LAW ANYWHERE IN ITS RANGE.** 437 of 440
  at `fill = 1.0`, four draw calls for 60% more buildings. §1.3.
- **WHAT CONSTRAINS IT IS `citycheck`'s CLUMPING CV FLOOR, AT `d^0.90`** — and that floor's
  0.026 of margin sits against a **0.160** seed-to-seed spread in the statistic it reads.
  Green at 1337, red at four of five other regions. §1.4.
- **`band:noon` IS 0.0001 ABOVE ITS FLOOR, AND DENSITY IS WHAT PUSHES IT DOWN.** A floor on the
  noon frame mean is a ceiling on how much city there may be. §2.
- **`inputcheck` IS RED AT FOUR BOUNDS AND HAS BEEN SINCE `0f60c9a`**, which STATE 35 reported
  as green. Bisected, load-independent, mechanism unknown. §6.
- **AT `fill = 1.0` THE ISLANDS ARE STILL ONLY 45.4% COVERED.** The remaining terms are the
  end-of-run gap and 282 corner refusals against other buildings. §1.10.
- **SESSION 32's "0.244" IS A PER-BLOCK MEDIAN AND READS 0.234 ON ITS OWN POPULATION**; its
  "148 of 400 bare sides" reproduces exactly. §1.1.
- **`gateaudit` AUDITS WHATEVER `lookcheck` LAST WROTE TO DISK**, so a before/after battery
  leaves it reporting the wrong arm convincingly. §3.3.

---

## 10. WHAT TO DO FIRST NEXT TIME

1. **`inputcheck`, and it is one commit wide.** §6 hands over a bisect, a mechanism ruled out
   and four numbers. It is the only gate in this project that went from green to red without
   anybody noticing, and the session that broke it is the session before last.
2. **The end-of-run gap.** §1.10: `rng.range(6, 26)` after every run of buildings, a mean of
   16 m of frontage per run, and session 32's own comment says the condition for revisiting it
   is that the roll get near 1 — which it now has. It is the largest remaining term in a number
   that stands at 31.2% against 95.0%.
3. **A quiet battery.** `load1` was 1.29 at the end of this session. Every millisecond in the
   last four STATE files is inadmissible, and the GPU timer queries have retired three sessions
   running with nobody able to read them.
4. **`band:noon` at 0.0001, before the next content change rather than after it.** §2 records
   what it is and LOOK.md §7 now records the direction. The re-derivation, if there is one, is
   the operator's.
