# NOCTIS — STATE

*End of session 52. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`. The machine has
**NOT** rebooted since session 40 — 10 d 10 h of uptime at the first command, the same boot as
sessions 47–51. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` READ 1.21 AT THE FIRST COMMAND — INSIDE CONTRACT §0.2's BAR OF 1.6 — AND 4.04 TO 4.75
BY THE TIME THE GATES RAN***, because the session spent its middle in a browser (`lookat` twelve
times) and one headless Chromium measures 130% CPU. **The one absolute quoted below is GREEN and
is therefore admissible under §0.2** — drift on this machine is one-sided, so load can only make a
frame slower. Everything else quoted is COUNTS, areas, code values, draw calls, triangles and
populations out of the pure generator or off a delivered frame.

---

## 0. THE FOUR, AT HIS OWN SPAWNS

The operator walked session 51's own branch. Two of the four defects were the halves session 51
named and handed over; two were new. **All four reproduce through `tools/lib/headlesscity.mjs`**,
which was the first thing done, and `tools/surfacegrid.mjs --at` prints them:

```
  ?player=1&wet=1&spawn=109.94,52.24,-13.60&t=0.5904&seed=1337   on ground at y 0.000   item 1
  ?player=1&wet=1&spawn=131.59,63.78,-64.66&t=0.6628&seed=1337   on road   at y 0.000   item 2
  ?player=1&wet=1&spawn=-184.56,0.18,188.85&t=0.7136&seed=1337   on ground at y 0.000   item 3
  ?player=1&wet=1&spawn=-163.75,8.97,129.28&t=0.6364&seed=1337   on road   at y 0.001   item 4
```

Frames, `-before` being session 51's shipped build (`88e89bf`) re-photographed from identical poses
in a paired worktree:

```
  tools/shot-out/
  s52-dome-{street,air}-{before,after}*.png   ITEM 1. The apron was a square that reached only to
                                              the drum's tangent line; it is now a band all the
                                              way round, and the street stops one footway short.
  s52-strip-{before,after}*.png               ITEMS 2 AND 4, which are one defect. A street that
                                              ran unbroken into a courtyard now ends at a kerb.
  s52-rail-close-{before,after}*.png          ITEM 3. THE ONE THAT READS AT A GLANCE. Three posts
                                              with two rails bunched below halfway -> a top rail
                                              across the post heads.
  s52-weir-{plan,air}-*.png                   The weir in plan and from the air: the railing ring,
                                              the wider grass rim, and the street ends round it.
  s52-nadir-{dry,wet}-t0_5.png                THE INSTRUMENT FOR ITEM 2a. A nadir frame over a
                                              street section, so a scanline IS the section.
```

---

## 1. ITEM 1 — A LANDMARK STOOD WITH ITS WALL IN THE GUTTER

STATE 51 §3.2 named this and did not reach it, and the geometry is one sentence: **a circle
inscribed in its own square claim touches that square at the midpoint of each side.** So the
precinct — the claim minus the silhouette — was 21.5% of the claim at 45° and **exactly zero at 0°
and 90°, which is where the streets are.** The corners got a plaza; the four places a street
actually arrives got nothing.

`LANDMARK_SETBACK_M` = `CITY.sidewalkWidth` = **4.2 m**. `landmarkGroundClaims` and `landmarkAABB`
carry it for the four ROUND landmarks and not for the other four; `landmarkPrecinct` runs its
staircase out to the CLAIM's half-width with its inner edge on the SILHOUETTE's, so the precinct is
the claim minus the circle rather than the corners of it. It is not a new number: it is the width
of every pavement in this city, it is what `BUILDING_SETBACKS` already gives a landmark, and it is
half of what `CORRIDOR` is made of.

### 1.1 THE MEASUREMENT THAT IS THE ITEM

Nearest carriageway and pavement clearance from the plan silhouette, pure generator, `citycheck`'s
own 10 × 10 region at seed 1337:

```
                    road              pavement
  exchange     0.004 -> 4.203      0.000 -> 4.200
  weir         0.000 -> 4.200      0.504 -> 4.685
  dish         2.328 -> 6.334      1.189 -> 5.288
  condenser   10.500 -> 10.500     6.300 -> 6.300     the road never came near it
```

**Two of the four round landmarks had a road or a pavement at LITERALLY ZERO.** All four now clear
by at least one footway, by construction. `landmarkcensus` reads the other side of it — `del/claim`
for the round four goes **1.000 → 0.787 (exchange), 0.925 (weir), 0.833 (dish)**, and the other
four are unchanged to the digit.

### 1.2 WHAT THE BIGGER CLAIM REFUSES — ITEM 1b

Same region, same seed, before and after, out of `generateChunk`:

```
                        session 51      session 52       delta
  buildings                    674            665          -9
  carriageway            38.3151 ha     37.8402 ha     -0.4749      §4 moves some of this
  pavement               16.7987 ha     16.9691 ha     +0.1704
  apron surface           1.4435 ha      2.2920 ha     +0.8485      1.59x
  props                       3543           3554         +11
  markings                   17017          16941         -76

  the registry REFUSED, by the category that refused it
  precinct                     109            125         +16
  building                     186            184          -2
  water                         31             26          -5
```

**Nine buildings and 0.24 ha of carriageway is what one footway of setback costs**, and the
`precinct` refusal count is the direct reading of it. The remaining carriageway delta is §4's
street ends, which move it to `pavement` rather than losing it.

### 1.3 AND IT COST 0.05 ha OF BARE GROUND, WHICH IS THE WRONG DIRECTION

`citycheck`'s new bare-walkable gate reads **1004 of 284 382 samples = 0.40 ha**, where session 51
shipped **887 of 283 259 = 0.35 ha**. It was RED and is still RED; it moved 13% the wrong way and
the cause is stated rather than discovered: **the apron staircase leaves 8.3% of a corner as
residue, and the corner is now 1.59× bigger.** `surfacegrid --patches`:

```
  island, no surface   0.18 ha  44.2%    was 0.14 — 2 m seams, more of them after the re-clip
  river envelope       0.15 ha  37.3%    unchanged
  landmark:viaduct     0.04 ha   9.8%    unchanged, the two 14 x 14 m end pads
  landmark:weir        0.03 ha   6.4%    unchanged
  landmark:exchange    0.01 ha   2.4%    NEW — two 2 x 24 m patches at x = 87 and x = 153
```

The two new patches are on the OLD claim line. They are the same limitation STATE 51 §6 item 7
records: every keep-out here is an AABB and every surface is axis-aligned, so a curve leaves a
residue at every step corner. A smaller step buys four points and doubles the boxes; a curve wants
a different primitive.

---

## 2. ITEM 2 — BOTH CANDIDATES ARE FALSIFIED, AND THE DEFECT IS ITEM 4 SEEN FROM A DIFFERENT POSE

The brief offered two candidates and asked which, with a number. **It is neither, and here are the
numbers.**

### 2.1 IT IS NOT THE FURNITURE (2b)

The strip the operator stood on is one delivered carriageway rectangle, **x [120.5, 135.5],
z [−72.8, −46.0], 15.0 × 26.8 m**, on chunk (1,−1) whose `roadMaterials` are
`["concrete","patched"]`. It carries **fifteen markings — a centre line at x = 128, lane lines at
124.50 and 131.50, edge lines at 120.80 and 135.20**. Over the region, **6 of 202 road rectangles
carry no marking** and this is not one of them; the six are listed in the probe and the largest is
15.0 × 8.5 m. Both flanking pavements are present at 3.5 m and 4.0 m and both carry a kerb riser.

### 2.2 IT IS NOT THE MATERIAL (2a), AND HERE IS THE TABLE SESSION 46 WAS ASKED FOR

A NADIR frame over the section at (128, −60), so a scanline IS the section: every surface at one
distance, one incidence, one sun. Patches are pixel ranges read off the frame and cross-checked
against the generator's own section, because a block boundary wall runs along both pavements.
**240 rows averaged**, because `SURFACE.grainStrength` = 0.2 puts a ±10 cv procedural grain on
every rough dielectric. `tools/shot-out/s52-nadir-{dry,wet}-t0_5.png`, noon:

```
                        DRY               WET            authored albedo
  courtyard  core      122.3 cv           96.1 cv        [0.105, 0.102, 0.096]
  carriageway concrete 138.1 cv          116.6 cv        [0.11714, 0.11714, 0.11405]
  pavement   walk      174.0 cv          152.3 cv        [0.260, 0.257, 0.248]

  PAVEMENT  - CARRIAGEWAY   +35.9 cv     +35.7 cv        albedo ratio 2.198x
  CARRIAGEWAY - COURTYARD   +15.8 cv     +20.5 cv        albedo ratio 1.144x
```

**Session 45 measured 14 cv, called it *"NOT A ROAD"*, and predicted 47 after its repair. It
delivers 35.9.** The repair holds. And the R/B ratios come back where the authored ones put them —
core 1.250 against an authored 1.094, pavement 1.138 against 1.048 — so the warm surfaces deliver
warm. **The wet arm is 0.2 cv different on the pavement step and 4.7 cv WIDER on the courtyard
step**, so the hypothesis that *"a wet asphalt lifts to the tone of concrete"* is falsified in the
direction opposite to the one it predicts: `SURFACE.wetDarkening` multiplies every diffuse by the
same 0.5 and preserves the ratio.

**AN INSTRUMENT DEFECT WORTH CARRYING FORWARD.** `tools/lib/png.mjs`'s `decodePNG` returns **THREE
bytes per pixel**. Reading it with a stride of 4 walks off the row and rotates the channels, and it
produced a plausible, self-consistent, entirely wrong table — pavement 4.4 cv BELOW the
carriageway, two identical pavements 46 cv apart — that was on the way to becoming this section's
finding. `data.length / (width * height)` is the one line that catches it.

### 2.3 WHAT IT ACTUALLY IS

The delivered surface off `worldSurfaceAt` on a 1 m lattice, along the x = 128 corridor:

```
  z -147.2 .. -72.8    the exchange's claim.        NO CARRIAGEWAY
  z  -72.8 .. -46.0    carriageway, 26.8 m
  z  -46.0 .. +46.0    BLOCK_KEEPOUT, 336 x 92 m.   NO CARRIAGEWAY
```

**He stood in the middle of a street 26.8 m long.** Whichever way he looked, within 19 m the
carriageway stopped — at grade, with no kerb, no footway and no transition — and became session
51's origin-block core at 0.105 or the exchange's apron at 0.26. That is the whole of *"the same
tone as the courtyard beside it: no kerb reads"*, and **item 2 and item 4 are one defect
photographed from two places.** It is repaired in §4.

---

## 3. ITEM 3 — THE TOP RAIL WAS AT 0.62 OF A POST THAT REACHES 1.00

`city.js` drew a `railing`'s two horizontals at `height * 0.50` and `height * 0.62` while the
standards spanned `[0, height]`. On the weir's 1.10 m railing that is **a top rail at 0.68 m with
0.42 m of bare post above it — 38% of the railing's height with nothing in it** — and on the
school's 1.60 m fence it is 0.61 m. The eye reads a railing by its top line, so a run whose top
line is a row of disconnected post heads reads as posts and no rails from any distance at which the
two low rails merge. `s52-rail-close-before` is that, at seven metres.

**It is session 46's shape one object over** — *"half the city's lamps had a head that did not meet
its own column, because two expressions for one point disagreed"*. The post's extent said `height`;
the top rail said 0.62 of it.

**CHECKED ACROSS THE WHOLE `edge` VOCABULARY, WHICH IS WHAT THE BRIEF ASKED FOR**, and `railing` is
the only one of the four that had it:

```
  rail      top horizontal at 0.86 of a post that reaches 0.90    car park knee rail
  mesh      0.98 of 1.00                                          session 48's ball-stop
  palisade  0.80, with the pales themselves reaching 0.96         session 40's yard
  railing   0.62 of 1.00                                          THIS
```

**479 railing bays over `citycheck`'s 10 × 10 at seed 1337 — 227 at 1.10 m and 252 at 1.60 m — and
93 of them are the ring session 51 put round the weir's nine-metre drop**, measured on the rim
circle at r + `APRON_STEP_M` = 107.1 m. That is the one the brief said matters most and it is
included.

Top rail **0.95**, mid rail **0.50**: at 0.95 the 0.05 m rail's top face is 1.0725 m on a 1.10 m
post, so 27.5 mm of standard stands proud and the run reads as a rail held up by posts. **No new
box and no new claim** — the posts already reached `height`, so the feature's delivered extent is
unchanged and no conflict moved.

---

## 4. ITEM 4 — A STREET NOW ENDS LIKE A STREET ENDS

STATE 51 measured it and handed it over: **63 cut ends over 202 delivered carriageway pieces**, and
a repo-wide search for `cul-de-sac | dead end | turning head | turning circle | roundabout |
terminat` over `src/`, `tools/` and `docs/` returned two incidental lines, neither about a road.

### 4.1 ITEM 4a ASKED WHETHER THE 55 SHARE A SHAPE. THEY DO.

Re-measured this session, by the width of the carriageway across the cut:

```
  15.0 m   49        the full lattice carriageway, 2 x roadHalfWidth
  12.0 m    4
  10.0 m    4
   3.0 m    4
   4.3 m    2
```

**49 of 63 — 77.8% — are a full-width carriageway stopping dead.** What is one metre beyond them:
24 nothing (the river's dry margin), 22 a landmark precinct, 8 the origin block, 7 a landmark's own
solid, 2 the water. **So the general rule, not the roundabout**, and that is 4a answered with the
number it asked for.

### 4.2 WHAT A STREET END IS, AND IT ADDS NOTHING TO THE WORLD

The footway that runs along both sides of the street **turns the corner and closes across its
end**. Same surface, same `CITY.sidewalkWidth`, same datum, same reflectance — it is not a new
object, it is the one already there, finished. It is taken out of the carriageway's own last 4.2 m:

```
  road   38.0723 -> 37.8402 ha        walk  16.7370 -> 16.9691 ha
  sum    54.8093             ->       54.8093              to four decimals
  buildings 665 -> 665       the relabel does not re-phase the city
```

`pavement` forbids a strict subset of what `carriageway` forbids, so the change is a loosening
exactly where a footway should carry furniture and identical where a building is concerned.

**40 ends built, 4 declined** because the street would have been left shorter than it is wide
(`2 * CITY.roadHalfWidth` = 15.0 m; the shortest piece at a cut end is 0.7 m, the median 69.5 m).
`chunk.streetEnds` carries both, for the reason `propsGaveUp` exists.

**AND IT BRINGS A KERB, WHICH IS THE HALF THAT READS.** `city.js` emits a 0.16 m riser for every
`walk` rectangle, so the end now has a vertical face across it with the pavement's 0.26 behind —
**§2.2's 35.9 code values.** The kerb edge is **DECLARED, not derived**: the existing inference
reads the nearest LATTICE LINE, which is right for a footway beside a road and meaningless for one
lying across it, so `streetEnd` says which edge and `buildGround` reads it. Every footway written
before this session carries no `kerbAxis` and takes the old branch byte-identically.

**AN END AT A JUNCTION IS A T, AND THE FIRST ARM BUILT ONE ANYWAY.** The lane probe printed it:
156 m of driving lane on pavement where session 51 had 0, the largest stretch **15.0 m**, which is
the crossing carriageway's own full width and is the signature. An end inside `CORRIDOR` of a
lattice line is now skipped, because a road meeting a road already ends the way a street ends.

### 4.3 ITEM 4b — WHAT TRAFFIC DOES AT A LANE THAT ENDS IN GEOMETRY

Measured off `worldSurfaceAt` on the driving lanes themselves — 36 lanes, ±512 m, 1 m steps,
36 900 samples — against **exactly the three tests `traffic.js`'s recycle pass makes**
(`riverNoRoad`, `landmarkOccupies`, `blockNoRoad`), at nose, centre and tail:

```
  what is under a driving lane:  road 79.90%  earth 9.81%  walk 4.35%  basin 2.95%
                                 precinct 2.00%  ground 0.74%  parapet 0.26%

  metres NOT a carriageway and NOT refused:
                               moto (half 1.10 m)   bus (half 6.00 m)
    session 51                     884 m  2.40%       860 m  2.33%
    street end, no reach          1078 m  2.92%       928 m  2.51%
    street end + BODY_REACH_M      931 m  2.52%       915 m  2.48%
```

**Session 51's `blockNoRoad` left the lanes clean and the street end put pavement under them**, so
the traffic half is owed with it. `BODY_REACH_M` = `CITY.sidewalkWidth` extends the nose and tail
probes ALONG the body's own axis — **not a pad, which applies to both axes and would refuse 4.2 m
of road ACROSS every lane** for a reason that has nothing to do with the blocker; that argument is
already written beside `landmarkUnderBody` and this obeys it. A vehicle is now recycled at the
street end's kerb rather than at the wall behind it. **It recovers 147 m of the 194 a moto gained.**

The residual 47 m is a named case rather than a mystery: a road strip is cut across its full 15 m
width by a blocker that covers only part of it, so the lane on the uncovered side reaches a street
end with nothing beyond it to refuse it. The weir's north edge at z = 259.2 against a lane at
z = 259.75 is the largest instance.

**THE TURNING HEAD IS NOT BUILT.** A vehicle still cannot turn round at one of these. §6 item 1.

---

## 5. THE FORBIDDEN OVERLAP THIS SESSION EARNED AND PAID OFF BEFORE IT SHIPPED

The first arm of the bigger claim gave `citycheck` **`prop(weir:apron) × prop(tree)`, 0.12 m² at
(−390, 246) — the first forbidden overlap among the GENERATOR's own claims this project has
carried.** It is a CHUNK SEAM and not a placement bug: **a chunk owns the corridors on its west and
north edges**, so chunk (−3,1)'s kerbside scatter put a tree **8.0 m outside its own bounds**,
exactly as designed, and chunk (−4,1)'s apron clips to its own `chunkBounds` and tested against a
registry that had never heard of it. Session 23's lamp gap, one generator over.

The guard is the sentence rather than the seam: **a forecourt does not furnish the street.** An
apron prop may not stand in `latticeCorridor`, which is the same pure function the kerbside bands
are made of and gives the same answer in every chunk, so the two can no longer choose the same
square metre whatever order they run in. Generator conflicts **1 → 0**, props 3581 → 3554, apron
props 45.

---

## 6. GATE STATE — FOUR OF EIGHT, ONE BETTER THAN SESSION 51

Run individually, because `npm run gates` chains with `&&` and lookcheck's carried red stops
everything after it. **That is item 1 on STATE 49's, 50's and 51's lists and it is still true.**

```
  parsecheck   GREEN   113 files, contract-clean. Unchanged: no file added or removed.
  faultcheck   GREEN   7 cases.
  windcheck    GREEN   567 mesh names over 567 meshes (floor 400), 563 of 563 cull-eligible
                       decided, 0 wound backwards. 569 -> 567: nine fewer buildings (§1.2)
                       took two chunk meshes with them.
  inputcheck   GREEN   keyboard, mouse and gamepad each deliver their own constant.
  lookcheck    RED at 2 — ONE FEWER THAN SESSIONS 45-51, AND THAT IS NOT A REPAIR. §6.1.
                       facadeAlbedo:dusk 3 clusters of 5 walls against 4;
                       facadeNeighbours:dusk 2 of 3 adjacent pairs.
  gateaudit    RED at 1, the carried control, naming lookcheck's reds.
  citycheck    RED at 4 — THE SAME FOUR AS SESSION 51, after §5 was paid off.
                         clumping CV 0.388 against 0.60 — was 0.389. 12 of 12 seeds below
                           the floor, median 0.382, spread 0.272. NO THRESHOLD MOVED.
                         2 of 2666 sign quads inside a building, the same two
                         4 delivered overlaps — the identical four session 51 shipped
                         1004 of 284 382 walkable samples on bare earth — WAS 887. §1.3
                         generator claims 17 046 (was 16 152), delivered 17 646 (was 17 125)
                         0 of 4 generator overlaps (was 1 in the first arm, §5)
                         prop 3784, feature 5297, precinct 700, landmark 1938
                         the registry REFUSED: building 184, precinct 125, block 40, water 26
                         alignment 73.6% off-axis, largest deviation 2.27° against 3° — GREEN
                         bright reserve 6.57% against 6.00 — GREEN, three runs [6.48 6.57 6.83]
                         saturation 3.65% pooled peak against 12, three runs [3.38 3.65 3.69]
                         walkability 54 786 of 54 920 — six sessions, walkable to the cell
                         0 of 3554 props inside a building
  perfcheck    RED at 1 on the ONE ROUTE RUN. §6.2. The other three routes were not run and
                       their state is unknown; session 51 read 11 reds over four routes.
```

### 6.1 A LUMINANCE BAND WENT GREEN AND IT MUST NOT BE REPORTED AS A REPAIR

`distinct:midnight|dusk` has been red since session 45 and this session reads **0.03005 against a
floor of 0.03000**, where session 51 read 0.02992 and session 50 read 0.02993.

**THE MARGIN IS 0.00005 — ONE PART IN SIX HUNDRED — AND LOOK.md §7 RECORDS THIS FAMILY'S OWN
RUN-TO-RUN SPREAD AS 0.0001 OVER THREE RUNS.** The margin is HALF the instrument's measured
resolution. CONTRACT §0 rule 6 forbids a decision on a difference smaller than the instrument's own
noise floor, and it does not stop applying because the difference points the pleasant way. **Nothing
in this session lit anything**; what it did was remove nine buildings and move a strip of surface
from one reflectance to another in the origin block, which is the only content this camera can see.

**So: L15 is owed a derivation for an EIGHTH session, the red is not repaired, and a future session
that finds it red again has not regressed anything.** STATE 51 §5.5 recorded the mirror image of
this — three reds reading green while the content moved the other way — and the honest reading is
the same one: this statistic's spread is of the same order as its margin and a single run is not a
verdict in either direction. **Do not lower `minPairMSD` to 0.029 and do not claim 0.03005.**

### 6.2 PERFCHECK — ONE ROUTE, AND BOTH NUMBERS THE BRIEF ASKED FOR

`perfcheck --route=highway_speed`, at `load1` 4.04:

```
                    draws   s51    tris    tris s51    instances   inst s51
  highway_speed       397   398   2.21M     2.24M       317 986    320 789
```

**`highway_speed` IS 397 OF 440 DRAW CALLS AND 2.21 M OF 2 360 000 TRIANGLES.** Both are DOWN on
session 51 — instances by **0.87%** — and the accounting is the nine buildings §1.2 refused and the
27 apron props §5 moved out of the corridor. This is the first session in some time whose content
made the budget cheaper.

**wall p95 12.10 ms against 12.5, three runs [11.9 12.1 12.2], spread 0.3. cpu p95 10.70 against
12.00, [10.6 10.7 10.8].** §0.2 says a GREEN absolute under load IS a verdict; this one is green at
`load1` 4.04, which is the fifth consecutive session that route has come in clear.

**THE ONE VIOLATION IS THE VEHICLE SILHOUETTE BAR**, `65% of 62 vehicles carry a non-monotone tone
profile` against a 75% floor. Sessions 49, 50 and 51 each measured this pair straddling and did not
act; **that is now four sessions, and it is still not acted on.** `tools/budget.json` →
`silhouettes.$estimator` already derives why: the sample is whichever subjects are in frame at the
pose, and its population moved 55–74 across four runs in session 49 alone.

---

## 7. WHAT TO DO FIRST NEXT TIME

1. **THE TURNING HEAD.** §4.2. The footway now closes every end and **a vehicle still cannot turn
   round at one.** The measurement is done — 40 ends built, 4 declined, 49 of 63 at the full 15 m
   width — and what is owed is the carriageway widening into a T bar. It takes ground the registry
   has already given to something else, and §1 made the round landmarks' claims one footway BIGGER,
   so the head has less room than it had, not more: probe it against the registry and count what is
   refused.
2. **THE 47 m OF LANE ON PAVEMENT.** §4.3. A road strip cut across its full width by a blocker that
   covers only part of it leaves the lane on the uncovered side reaching a street end with nothing
   to refuse it. The fourth sentence `traffic.js` wants is *"a body standing on something that is
   not a carriageway is off-road"*, and `city.worldSurfaceAt` through `ctx.get('city')` can answer
   it at 64 vehicles a frame where `streetlife` already does 360.
3. **`npm run gates` STILL RUNS THREE GATES OF EIGHT.** Item 1 on STATE 49's, 50's and 51's lists.
   Four sessions.
4. **L15 IS OWED A DERIVATION FOR AN EIGHTH SESSION**, and this session's green reading makes that
   more urgent rather than less. §6.1.
5. **THE THREE ROUTES `perfcheck` DID NOT RUN.** Only `highway_speed` was measured. Session 51 read
   eleven reds over four routes and nine of them were frame time.
6. **THE VEHICLE SILHOUETTE BAR, FOUR SESSIONS UNACTED.** §6.2.
7. **LIGHT THE FILL.** STATE 50 §6 item 1 and STATE 51 §6 item 3, untouched twice. `floods(n)`
   takes a constant 2–3 while the fixture floors put up to 38 objects on an island, and the
   landmark aprons are now 1.59× bigger. Do it because it is right about the world.
8. **THE APRON STAIRCASE'S RESIDUE GREW WITH THE CLAIM** — §1.3, 0.35 → 0.40 ha of bare walkable
   ground, and the gate is red on it. Same limitation as STATE 51 §6 item 7: every keep-out is an
   AABB and every surface is axis-aligned. A curve wants a different primitive, not a smaller step.
9. **SESSION 23's LAMP GAP IS STILL WHAT THE DELIVERED SWEEP FINDS.** `city.js` claims 332 street
   columns into the delivered census and into no registry band, so nothing the generator places can
   avoid one. Two of the four delivered overlaps are that.
10. **HOIST THE BUILDING CLAIMS IN `buildChunkBody`** — session 47's item 1, still what blocks
    facade clutter.
11. **CLUMPING IS 0.388 AGAINST 0.60**, unmoved for fifteen sessions, and `city-budget.json`'s own
    `$s37` derivation says it is measuring how much parkland is in the window and names the
    replacement.
12. **THE ARENA** (STATE 49 §4) and **THE SCHOOL'S COURT MARKINGS RUNNING OFF THEIR OWN PAD**
    (STATE 50 §6 item 4). Both still unspent.
13. **`decodePNG` RETURNS THREE BYTES PER PIXEL.** §2.2. Any probe that reads a `shot-out` frame
    must divide `data.length` by `width * height` and check, because a stride of 4 produces a
    plausible and entirely wrong table rather than an error.
