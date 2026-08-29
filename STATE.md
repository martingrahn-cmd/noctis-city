# NOCTIS — STATE

*End of session 53. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`. The machine has
**NOT** rebooted since session 40 — 10 d 18 h of uptime at the first command, the same boot as
sessions 47–52. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` READ 2.24 AT THE FIRST COMMAND AND NEVER ONCE CAME INSIDE CONTRACT §0.2's BAR OF 1.6.***
The session opened a six-agent source audit and then spent its middle in a browser, and one
headless Chromium measures 130% CPU. **NO ABSOLUTE MILLISECOND IN THIS DOCUMENT IS A VERDICT**
unless it is green, and each one says the load it was drawn at. Everything else quoted is COUNTS,
areas, code values, draw calls, triangles and populations out of the pure generator or off a
delivered frame.

---

## 0. THE AERIAL OVER THE RIM, BEFORE AND AFTER

One camera, one pose, one seed. `tools/shot-out/`, and they are the whole session in two frames:

```
  s53-rim-air-before-t0_5-wet.png     [0, 300, 0] -> [2400, 0, 0], fov 62, noon
  s53-rim-air-after-t0_5-wet.png      the same, and the -before arm is a paired git worktree
                                      pinned to fe920c9 rather than a stash, so the two frames
                                      are two builds and not one build twice.
  s53-rim-air-{before,after}-t0_78-wet.png   the same pair at dusk, wet pinned to 1.0.
  s53-rim-street-t0_5-wet.png         THE ONE THAT EXPLAINS FIFTY-TWO SESSIONS. Standing on a
                                      street at (256, 1.74, -40) looking 900 m up it: a dense
                                      canyon, walled both sides, and NO EDGE VISIBLE AT ALL.
                                      The defect is only in the air, which is why nobody hit it.
  s53-city-high-t0_5-wet.png          from 1500 m, where the whole city is one shape. Also
                                      the finding that the atmosphere at 1500 m is brown soup;
                                      not this session's item, recorded in §7.
  s53-rim-night-t0-wet.png            THE SHIPPED NIGHT, t = 0, wet 0.85. §3.6 — the distant
                                      city has its lights on, at a level that is derived and
                                      then measured, and the first arm of that level made the
                                      far half of the world brighter than the near half.
```

**BEFORE:** the city fills the bottom quarter of the frame, stops along a straight line, and
3.23 km of flat earth runs to a knife-edge horizon.
**AFTER:** the city runs to the rim, thins as it goes, and ends.

**AND THE SESSION IN ONE SENTENCE:** the city had no edge to measure — it had a 1408 m streaming
square that travels with the eye — so the session gave the world an extent (§2), drew the part of
it that is past the square (§3), and left the road lattice unbounded, which is §7 item 1 and the
precondition for the brief's *roads that leave*.

---

## 1. ITEM 1 — THE MEASUREMENT, AND IT KILLED THE BRIEF'S PREMISE IN THREE PLACES

The brief asked for the edge to be measured before anything was built at it, and said *"I have
written a false premise into twenty-nine consecutive briefs."* This one had three. `tools/edgeprobe.mjs`,
seven sections, everything out of the pure generator:

```
  node tools/edgeprobe.mjs --rings --field --grid --beyond --walk --extent --distant
```

### 1.1 THERE IS NO EDGE. THERE IS A WINDOW, AND IT TRAVELS WITH THE EYE.

`city.js` → `wantedChunks` floors the camera into a chunk and takes a **Chebyshev ring around that
chunk**. There is no world coordinate in it, no bound on `cx` or `cz`, and — before this session —
no term anywhere in `generateChunk` that read distance from the origin.

```
  radius           chunks  near edge  far edge    span  chunks   what it gates
  fieldRadius           2      256 m     384 m   640 m      25   a baked canyon field
  nearRadius            2      256 m     384 m   640 m      25   street lamps
  detailRadius          4      512 m     640 m  1152 m      81   facades, signage, furniture
  groundRadius          5      640 m     768 m  1408 m     121   carriageway, pavement, courtyards
  geometryRadius        5      640 m     768 m  1408 m     121   building masses — the last thing drawn
```

**The near/far columns are ONE RANGE.** The distance from the eye to the outermost drawn thing is
**640–768 m** depending only on where in its own 128 m square the camera is standing, and the two
opposite edges always sum to 1408 m. **You cannot stand at the rim. Wherever you stand, it is
640–768 m away in every direction.**

### 1.2 THE FIELD DOES NOT FALL TOWARD ANY RIM — 7 OF 12 SEEDS, WHICH IS A COIN

The brief: *"the density field already falls toward the rim … what does that curve look like at the
rim specifically?"* At seed 1337 over the 11 × 11 it does fall, 0.640 at ring 0 to 0.442 at ring 5,
and that fall is one toss of a coin. Two measurements, both in the probe:

```
  27 345 samples on rings at 8 m arc spacing out to 4.10 km, seed 1337
    inner third of rings, mean     0.5066
    outer third of rings, mean     0.4927
    inner - outer                  0.0140
    sd of the ring means           0.0597   <- the scatter it must be read against

  the same core-against-rim comparison over the twelve seeds citycheck pools over
    1337 +0.133   1338 -0.116   1339 +0.240   1340 +0.003   1341 -0.212   1342 -0.045
    1343 -0.032   1344 -0.096   1345 +0.062   1346 +0.053   1347 +0.090   1348 +0.001
    7 OF 12 FALL. Mean delta 0.0067, largest single delta 0.240.
```

At seed 1341 the world is 0.251 in the core and 0.463 at the rim — a city that gets **denser**
outward. `densityAt` was two octaves of value noise and nothing else.

### 1.3 THE STREET GRID DOES NOT THIN. IT RUNS **WIDER** AT THE RIM.

The pure generator over every chunk of the 11 × 11, per-ring means, seed 1337:

```
    ring  chunks  density   bldgs  road ha  walk ha   props   mark  lowDet
       0       1    0.640     4.0   0.1342   0.0708    45.0     41      0%
       1       8    0.611     6.1   0.3043   0.1558    43.1    123      0%
       2      16    0.553     8.3   0.3884   0.1745    39.0    169      0%
       3      24    0.515     7.2   0.3456   0.1551    34.7    150     17%
       4      32    0.471     5.0   0.3990   0.1759    33.2    188     31%
       5      40    0.442     6.5   0.4272   0.1876    32.2    192     33%

  ring 0-2 against ring 5:  road 1.216x   walk 1.142x   markings 1.286x
```

**The carriageway at the rim is 1.216× the core's and the paint is 1.286×**, which is the exact
opposite of a city thinning out. The cause is stated rather than discovered: the road is emitted
from the LATTICE at `2 × roadHalfWidth` = 15.0 m in every chunk in the world, and the only three
things that ever remove carriageway — a landmark, the river, `BLOCK_KEEPOUT` — are all at the
ORIGIN. The rim has more road because it has fewer obstacles.

And the transect out to 4.10 km says it never stops: **from `cx` 3 outward every chunk on
`cz = 0` delivers 0.4542 ha of carriageway and 0.1989 ha of pavement, identically, for ever.**

### 1.4 WHERE THE TWO EDGES SIT RELATIVE TO EACH OTHER, WHICH NOBODY HAD PRINTED

```
  thing                                 extent  fixed to
  earth plane (block.js)                4000 m     WORLD    a plane 8 km square at y -0.020
  building masses                    640-768 m    CAMERA
  road + pavement + courtyard        640-768 m    CAMERA
  facades, signage, furniture        512-640 m    CAMERA
  street lamps                       256-384 m    CAMERA
```

**One thing in this world is fixed to the world and everything else is fixed to the camera.** From
the origin: the last building at 640–768 m, the plane's own edge at 4000 m, and **3232 m of bare
earth between them — 4.2× the distance from the eye to the last building**, or 2.30× the drawn
city's full 1408 m width. The drawn city is **3.10%** of the ground a camera stands on
(1408² against 8000²).

**AND THE TWO MOVE INDEPENDENTLY, WHICH IS A LATENT DEFECT AND NOT A CURIOSITY.** Walk to
x = 4000 and the plane's edge arrives while the city keeps generating; at x = 4768 the whole
resident ring stands over nothing at all. The transect confirms it at `cx` 32 — the generator
delivers a full chunk 160 m past the edge of the ground it would stand on. §2's `extentEdgeM` is
derived from exactly this and closes it.

Every authored thing in this world is inside **560 m** of the origin — the condenser, ring 4 of 5.
Past that it is the procedural lattice and nothing else, in every direction, for ever.

---

## 2. THE CITY GETS AN EXTENT — `densityAt` READS A WORLD COORDINATE FOR THE FIRST TIME

`cityExtentAt(x, z)` is 1 inside `CITY.extentCoreM`, 0 past `CITY.extentEdgeM`, smoothstep between,
and `densityAt` multiplies by it. **Both radii are forced and neither is free:**

```
  extentCoreM  1792 m   THE FURTHEST ANY CHUNK THIS PROJECT MEASURES REACHES FROM THE ORIGIN,
                        rounded up to a whole chunk. edgeprobe --extent recomputes it:
                          citycheck's own chunks, cx,cz in [-5,4]        905.1 m  (+CORRIDOR 916.8)
                          downtown_dense's resident ring at x = 330     1280.0 m
                          night_rain's at x = -400                      1384.5 m
                          highway_speed's at x = -820                   1717.3 m   <- the floor
                        1717.3 / 128 = 13.42 -> 14 chunks = 1792 m. INSIDE IT NOTHING MOVES.

  extentEdgeM  3232 m   BLOCK.groundExtent 4000 - (geometryRadius+1)*128 = 768. A camera standing
                        at the city's own rim must have its WHOLE RESIDENT RING on the earth plane
                        or the city is drawn over a void — §1.4's latent defect, closed by
                        construction. This number cannot be nudged without moving the plane.

  the band they leave   1440 m = 2.00 x densityPeriodLong. An observation, not a derivation, and
                        a checkable one: the transition is two of the field's own largest features
                        wide, so the edge carries the field's structure instead of being one ramp.
```

**PROVABLY ADDITIVE, MEASURED AND NOT ASSERTED.** The 10 × 10 region `citycheck` runs its
assertions over hashes **identically** before and after —
`sha256 fbc9faa23ba22a2a0eb6a8451b598bb5` both ways, `buildings 665`, `road 37.8402 ha`,
`walk 16.9691 ha`, which are STATE 52 §4.2's own figures. `cityExtentAt` returns exactly 1 there
and `d * 1 === d` in float.

**PRODUCT AND NOT MINIMUM.** A suburb is the same field at a lower amplitude, not a downtown with
its peaks clipped: `Math.min` would flatten the outer band to a constant and delete the field's
structure exactly where the eye has nothing else to read.

**AND THE THRESHOLD DOES THE REST, WITH NOTHING NEW WRITTEN.** `generateChunk` already turns a
chunk under `CITY.lowDetailThreshold` = 0.34 into one of the fifteen island kinds — a yard, a lot,
a depot, allotments — the vocabulary session 40 spent itself giving content to. So the gradient is
not a new system; it is the existing one finally being asked a question that varies:

```
  radius   extent   mean d      sd   share of the world BELOW lowDetailThreshold
   1792 m   1.000   0.4307  0.1564    28.9%
   2048 m   0.916   0.3661  0.1441    42.5%
   2304 m   0.711   0.3100  0.1081    58.5%
   2560 m   0.450   0.2006  0.0642    97.3%
   2816 m   0.202   0.0978  0.0324   100.0%
   3072 m   0.034   0.0167  0.0057   100.0%
   3328 m   0.000   0.0000  0.0000   100.0%
```

**WHAT IT DOES NOT DO, STATED PLAINLY: THE LATTICE STILL DOES NOT STOP.** Past 2816 m every chunk
is low-detail and every chunk still has its 15.0 m carriageway and its 0.4542 ha of it. The city
thins to a landscape of yards and depots and then continues as that, for ever. **§1.3 is repaired
for the BUILDINGS and untouched for the ROAD.** That is §7 item 1 and it is the precondition for
the brief's item 3.

---

## 3. THE CITY BEYOND THE RING — ONE DRAW CALL, 5 936 BOXES

### 3.1 WHY THE RING CANNOT SIMPLY BE RAISED

A resident chunk emits its own meshes, so ring 6 is **+44 chunks of draw calls** against a
`ceilings.drawCalls` of 440 that `highway_speed` measures 397 of. **The ring is bounded by draw
calls and nothing else will change that.** An `InstancedMesh` is bounded by TRIANGLES, which is the
budget with room in it — 2.21 M of 2 360 000. The same content costs **one draw here and
forty-four there**, and that asymmetry is the whole design.

### 3.2 THE LAW, MEASURED, AND TWO OF ITS THREE TERMS ARE FLAT

619 built chunks and 5 957 buildings outside the ring at seed 1337:

```
  quantity      mean     p10     p50     p90     max    corr with density
  median h     36.79   25.63   35.20   49.65   90.30      -0.064
  max h        91.01   52.82   86.56  141.22  153.21      +0.064
  cover         0.44    0.33    0.45    0.57    0.73      +0.423
  count         9.62    7.00   10.00   12.00   14.00      +0.310

  cover = 0.267 + 0.362 * d     r = +0.423
  count = 7.179 + 5.020 * d     r = +0.310
```

**HEIGHT DOES NOT DEPEND ON DENSITY IN THIS CITY** — both correlations are 0.06, which is nothing,
because `buildingHeightRoll` is a function of `rng` alone. What density buys is how much ground is
covered and how many buildings there are.

**AND A BUILDING'S FOOTPRINT DOES NOT DEPEND ON ITS HEIGHT EITHER**, which is the more surprising
one and it is why the distant towers are needles:

```
  height band     n     mean footprint    mean w x d
   0- 25 m      1879        505 m2        21.2 x 24.5
  25- 40 m      1759        509 m2        21.2 x 24.7
  40- 60 m      1281        494 m2        20.9 x 24.4
  60- 90 m       673        503 m2        21.1 x 24.6
  90-120 m       229        505 m2        20.9 x 24.8
 120-160 m       136        528 m2        21.1 x 25.4      corr(height, footprint) = 0.008
```

**A 150 m tower in NOCTIS is 21 × 25 m, exactly like a 20 m shop.** The distant needles are
needles up close too.

So `distantMasses` rolls its heights from `buildingHeightRoll` — **the same function, not a fit of
it** — and takes only the count and the coverage from the two lines above. A fit of the height
distribution would have been a second description of a quantity that already has one (§9.1); a fit
of the coverage is a genuine summary of a placement pass too expensive to run (0.21 ms a chunk
against 0.49 µs).

### 3.3 TWO ARMS WERE BUILT AND THE FIRST ONE IS WHY THE SECOND IS RIGHT

Arm one: one box for the block at the chunk's median height, one thin box for its tower. It gave a
**ring-boundary height ratio of 1.548** and an aerial that reads as a field of chips — a 66 m slab
per chunk where the real island is a rind of separate buildings round a hollow core.

Arm two puts the chunk's own COUNT on its own PERIMETER, which is LOOK.md §2's first sentence
(*"buildings meet the lot line"*), and **the streets appear between the blocks** — which is most of
what a city looks like from a kilometre up.

```
  edgeprobe --distant, 619 chunks where both the model and the generator have buildings
                          p10      p50      p90     mean
  TOP LINE model/real    0.515    1.026    1.777    1.114
  MASS     model/real    0.656    1.023    1.789    1.236

  the step at the ring boundary — the one number a silhouette cannot argue its way out of
  ring 5   258 real buildings,    mean height 40.38 m
  ring 6   306 silhouette boxes,  mean height 41.12 m      ratio 1.018   (arm one: 1.548)
```

A ratio of 1.000 would mean the model IS the generator, which it is not and must not claim to be.
What it has to be is **unbiased** — a median near 1 with the spread of one chunk's own luck —
because a silhouette 20% short everywhere is a step in the skyline at a fixed distance from the eye
and a silhouette 20% tall everywhere is a wall.

### 3.4 AND ONE GREY WAS A TONE STEP AT A FIXED DISTANCE FROM THE EYE

The first material was `distantAlbedo()` on every box. The four `CITY_MATERIALS` span **0.086 to
0.600 — a factor of seven** — and that spread is the last thing about a facade to fall below a
pixel, so the ring boundary read as a tone step. The reflectance now rides in `instanceColor` at
the **delivered population's** weights (brick 29.08%, concrete 27.25%, panel 18.90%, stucco 24.78%)
for 71 kB of buffer and zero draw calls.

`distantAlbedo()` is population-weighted **[0.3832, 0.3529, 0.3311]** where equal weights gave
[0.4025, 0.3765, 0.3575] — a 5% error, because brick is the commonest material and the darkest by
a factor of four. Averaging the TABLE instead of the CITY makes the distant half of the world too
bright.

### 3.5 WHAT IT COSTS

```
  DISTANT.radiusChunks 26 = 3328 m = ceil(extentEdgeM 3232 / 128), so a camera at the world's
  centre can see the city's own rim.

  camera at the world centre   620 of 2688 shell chunks built (23.1%)   5936 boxes   71 232 tris
  camera at the RIM, cx 25     411 of 2688 (15.3%)                      3963 boxes   47 556 tris
  worst over seven camera chunks                                        6148 boxes   73 776 tris
```

**73 776 is 49% of the 150 000 of triangle headroom, in ONE draw call.** Fewer at the rim because
half the shell is outside the city, which is the point. Rebuilt on a chunk crossing — once every
5.3 s at `highway_speed`'s 24 m/s — and it returns in one comparison on every other frame.

`windcheck` measures it: **568 meshes where session 52 had 567, 564 of 564 cull-eligible decided,
0 wound backwards.** The +1 is `city:distant` and it is named, measured and correct.

### 3.6 AND IT HAS ITS LIGHTS ON — WITH A PREDICTION THIS SESSION MADE AND FALSIFIED

§6.1 measured that the unlit silhouette moved `distinct:midnight|dusk` the wrong way, and this
document's §7 item 2 originally said, in writing, that lighting it would move the band back. **It
does the opposite, and the measurement is in the same session as the prediction:**

```
  unlit distant city   0.02958        midnight <-> dawn   0.12835 -> 0.12825
  lit   distant city   0.02953        midnight <-> noon   0.20458 -> 0.20458
```

Five times the instrument's own 0.00001 resolution and in the wrong direction. **MIDNIGHT IS
DARKER THAN DUSK, SO ANY LIGHT ADDED AT MIDNIGHT MOVES MIDNIGHT TOWARDS DUSK.** The other two
pairs agree — midnight moved slightly toward the two dim frames and not at all against the bright
one. **There is no arrangement of this content that satisfies the band, because the band rewards a
DARK night city and LOOK.md §1 asks for a lit one.** `minPairMSD` is not moved, the light stays,
and LOOK.md §7 carries the re-derivation with its date.

**THE LEVEL, AND ITS FIRST ARM WAS WRONG BY 1.71× IN ONE STEP.** `era.windowWall` is a DESCRIPTIVE
attribute and not the delivered glazed fraction — `city.js` builds the openings from the RHYTHM,
`winW = colW × (band 0.9 | panel 0.95 | else 0.55)` and
`winH = era.floor × (windowWall > 0.4 ? 0.62 : 0.44)`, which is **0.3604** population-weighted.
**And only two of four faces carry any**, because `city.js` skips a face that is neither front nor
rear: *"a window on a side face is a window inside the neighbour"*. A distant box is seen from
every side, so:

```
  0.3604 x 0.5 (faces) x 0.6280 (lit gain) x 220 (LIGHT.windowNits) = 24.90 cd/m²
```

and then **a MEASURED residual of 0.32**, named for what it absorbs rather than tuned until it
looked right. At the first arm's 42.59 the night aerial delivered a distant band mean of
**42.27 code values against the near city's 8.00** — the far half of the world brighter than the
near half. At 7.97 it is **14.18 against 8.96**, a ratio of 1.58 where the two bands cannot be
equal anyway because the near one contains streets. The dominant term in that 0.32 is that **the
tone curve is concave**: a uniform surface at radiance L and a mixture of {30% at 220, 70% at 0}
with the same mean L are the same radiance and not the same code value.

`tools/shot-out/s53-rim-night-t0-wet.png` is the frame, and `--wet=0.85` at `t=0`.

---

## 4. `npm run gates` RUNS EIGHT GATES AGAIN, NOT THREE — FOUR SESSIONS' ITEM 1

The script was eight commands chained with `&&`. `lookcheck` has been red since session 45, so the
chain stopped there and **`gateaudit`, `citycheck` and `perfcheck` never ran at all**. Eight
sessions of running the last five by hand and writing a note asking the next session to.

**IT IS NOT A LOOSENING AND THE DISTINCTION IS THE WHOLE OF IT.** `&&` and `tools/rungates.mjs`
agree exactly on the verdict — the suite exits non-zero if any gate does. What differs is how much
you know when it fails: `&&` reports the FIRST failure and nothing about the seven other gates.
A suite that hides seven results behind one is not stricter, it is the same strictness with less
evidence — CONTRACT §9's own subject one level up, a signal that looks like a verdict and is a
truncation. The runner prints all eight and says in one line how many `&&` would have hidden.

Sequential by design (two headless Chromiums at once is what made session 43 read `cpu p95
19.60 ms` on a route that measures 11.30 alone); `gateaudit` still after `lookcheck` because it
reads the frames `lookcheck` writes; `load1` printed beside every gate and browser gates that
started above §0.2's bar named at the end; `LC_ALL=C` exported by the runner rather than required
of the caller, which is §0.2's instrument defect 1.

---

## 5. WHAT TERRAIN WOULD COST — THE NUMBER THE BRIEF ASKED FOR, AND IT IS 176

Six independent lenses over `src/` and `tools/`, every site re-read at its own line by a second
pass that dropped what did not survive. **203 reports → 176 distinct sites over 41 files.**

```
  severity     sites   share
  foundation      35     20%     the data model itself cannot express terrain
  mechanical     117     66%     a call site that needs a height lookup threaded through it
  cosmetic        24     14%     a constant or a comment

  files: 19 under src/, 22 under tools/
  city.js 24 · citygen.js 20 · traffic.js 12 · lights.js 12 · streetlife.js 11 · block.js 9
  player.js 8 · lib/canyon.js 8 · river.js 7 · weather.js 7 · occupancy.js 5 · constants.js 4
```

`src/modules/river.js` is the only file where **every** site is foundation.

**THE 35 FOUNDATION SITES GROUP INTO NINE MECHANISMS**, and each is one change with everything
else at that site following from it:

```
  the streamed ground record and emitter      city.js 981, 1179, 1186, 1195, 722, 724, and the
                                              generator's wire format at citygen.js
     rects.push({ x0, z0, x1, z1, y, kind })  ONE SCALAR y PER RECTANGLE
     normals.push(0, 1, 0)                    a literal, not a computed normal
     GROUND_Y                                 SIXTEEN entries, each a constant
  the two 8 km planes                         block.js 728, 822, 937 — the earth strip walks
                                              x-stations with whole z-intervals and would need
                                              subdivision on BOTH axes before a height can land
  water and its edges                         river.js 213, 223, 260, 324, 580, 662, 676
  the datum                                   constants.js 575 `carriageway: 0`, whose own line
                                              568 already concedes "a datum is what a query is
                                              measured FROM"
  the claim band                              occupancy.js 344 SURFACE_TOP_M
  motion                                      traffic.js 73, 2807 · player.js 258
  the canyon sky-visibility field              lib/canyon.js 89, 222, 280, 445, 498 ·
                                              modules/canyon.js 557 · canyon-worker.js 42 ·
                                              lights.js 753, 861 — and 89 is shared by the CPU
                                              and the GLSL, so it is one change in two languages
                                              that must agree
  the sky's ground                            sky.js 287, 295 — the lower hemisphere is one flat
                                              lit plane and, through PMREM, the only thing lighting
                                              every downward-facing surface in the world
  the gate that defines "no floor"            citycheck.mjs 534 — failure is `su.kind === 'earth'`,
                                              and with terrain `earth` is the legitimate ground
                                              everywhere, so the gate fires on the whole city
```

### 5.1 THE CHEAPEST HONEST SUBSET, WHICH IS THE ANSWER TO THE QUESTION UNDER ALL FOUR ITEMS

§2 gave the world a boundary, so this variant does not have to invent one. *"Terrain only outside
the built grid"* is **the band from `extentEdgeM` 3232 m to the plane's rim at 4000 m**, and no
gate camera, no route and no census sample reaches it.

```
  touched — must change to ship it                       21 sites    8 foundation
  conditional — only if a camera or the player goes out   22 sites    3 foundation
  untouched                                              133 sites   24 foundation
```

What it does **not** touch: **every claim** (all 20 `citygen.js` and all 5 `occupancy.js` sites —
density is 0 out there so nothing is ever claimed); **every gate** (`citycheck`'s surface census is
a 1280 m square entirely inside `extentCoreM`, and 33 of the 35 `tools/` sites); **everything that
moves** (all 12 `traffic.js`, all 11 `streetlife.js`); **all eight `lib/canyon.js` sites**.

**AND IT BUYS 8 OF 35 FOUNDATION SITES AND NO PROGRESS ON THE EXPENSIVE HALF.** It buys a horizon.
27 of the 35 — including the entire `city.js` ground record and emitter, every claim and the whole
canyon field — are exactly as expensive afterwards as before. **That is the number, and the
decision it supports is that a horizon is cheap and a walkable hill is not.**

### 5.2 AND THE AUDIT FOUND A LIVE DEFECT ON FLAT GROUND, WHICH IS THE HONEST BONUS

`occupancy.js`'s `SURFACE_TOP_M` is **0.05 m**, and its own justification says *"0.05 m is above
every value in `city.js`'s `GROUND_Y` table (0.020–0.033)"*. `GROUND.pavement` is
`BLOCK.kerbHeight` = **0.16** — **3.2× the constant, and above it, not below.** So the sentence
that derives the number has been false since the kerb got its height.

**THE VERDICT IS UNCHANGED AND THIS IS NOT A REPAIR TO MAKE IN PASSING.** The band exists so a
ground surface overlaps a building (whose `y0` is 0) and does not overlap a deck (soffit 18.2 m),
and `[0, 0.05]` still does both. What is stale is the derivation, not the outcome. §7 item 6.

---

## 6. GATE STATE

Run through `tools/rungates.mjs`, which is the first time in eight sessions the suite itself ran
all eight, in 22 minutes. **`load1` ran 2.85 to 5.48 across it and was never inside §0.2's bar
of 1.6.**

```
  parsecheck   GREEN   115 files, contract-clean. 113 -> 115: edgeprobe.mjs and rungates.mjs.
                       It went RED once during the session on an ELLIPSIS CHARACTER in a
                       citygen.js comment — "probable elision" — and the runner is what
                       surfaced it, because it ran the three gates after it anyway. §4.
  faultcheck   GREEN
  lookcheck    RED at 3 — ONE MORE THAN SESSION 52, AND THIS SESSION CAUSED IT. §6.1.
                       distinct:midnight|dusk 0.02958 unlit, 0.02953 lit — §3 moved BOTH,
                       measured, and §3.6 is the prediction that was falsified
                       facadeAlbedo:dusk 3 clusters of 5 walls against 4
                       facadeNeighbours:dusk 2 of 3 adjacent pairs
  windcheck    GREEN   568 mesh names over 568 meshes (floor 400), 564 of 564 cull-eligible
                       decided, 0 wound backwards. 567 -> 568 is `city:distant`, §3.5.
  inputcheck   GREEN
  gateaudit    RED at 1, the carried control, naming lookcheck's reds.
  citycheck    RED at 4 — THE IDENTICAL FOUR SESSION 52 SHIPPED. §6.2.
  perfcheck    RED at 13 over FOUR routes, where session 52 ran one. §6.3.
```

```
  gate          exit   verdict   seconds   load1 in    out
  parsecheck       0     GREEN       3.2       2.85   2.86
  faultcheck       0     GREEN       9.6       2.86   3.52
  lookcheck        1       RED      33.7       3.52   3.44
  windcheck        0     GREEN      35.4       3.44   3.85
  inputcheck       0     GREEN      14.3       3.85   4.47
  gateaudit        1       RED      69.5       4.47   4.80
  citycheck        1       RED     115.1       4.80   5.48
  perfcheck        1       RED    1065.4       5.48   4.36
                                 -------
                                  22 min for the whole suite
```

### 6.1 L15 MOVED, THIS SESSION MOVED IT, AND HERE ARE THE SIX RUNS THAT SAY SO

`distinct:midnight|dusk` reads **0.02958**, against session 52's 0.03005 and sessions 50–51's
0.02993 / 0.02992. STATE 52 §6.1 wrote in advance that *"a future session that finds it red again
has not regressed anything"* — **and this session must not lean on that sentence, because it has a
candidate cause and it ran the A/B rather than guessing.**

A paired git worktree pinned to `fe920c9`, arms interleaved, three runs each
(STATE 49's note: a control on ONE arm measures that arm's disposition, not the statistic's):

```
  fe920c9 (before)   0.03004   0.03004   0.03005 (session 52)
  HEAD    (after)    0.02958   0.02958   0.02959

  spread 0.00001 on each arm. Difference -0.00045 = 45x the instrument's own resolution.
```

**THIS STATISTIC IS DETERMINISTIC FOR A FIXED BUILD.** LOOK.md §7's recorded 0.0001 spread over
three runs belongs to `band:noon`; **this band's own spread had never been measured** and it is
0.00001. So the move is attributable, and it is attributable to §3.

### 6.1.1 AND THE MECHANISM IS NOT DILUTION, WHICH IS WHAT IT LOOKS LIKE

Measured off the four delivered frames at 3200 × 1800 — `decodePNG` checked for THREE bytes per
pixel first, per STATE 52 §2.2:

```
  pixels the silhouette changed              516 956 of 5 760 000 = 8.97%
  their own midnight<->dusk msd, BEFORE      0.05148
  their own midnight<->dusk msd, AFTER       0.04645
  every other pixel in the frame             0.02812
  0.0897 x (0.05148 - 0.04645) = 0.00045     the whole-frame delta, to the digit
```

**Those pixels were the frame's HIGHEST-contrast region and the silhouette covered them.** The far
end of a street is SKY, and sky is the largest luminance swing anywhere between midnight and dusk —
0.051 against 0.028 for everything else. A grey unlit mass standing in front of some of that sky
swings less than the sky it replaced.

**SO THE BAND IS RIGHT AND IT IS POINTING AT A CONTENT GAP, WHICH IS EXACTLY WHAT LOOK.md §7 SAYS
TO DO WITH ONE.** NOCTIS is a night city; at midnight a distant city is a field of lights against a
black sky, which swings MORE than the sky did and in the opposite sign. What is drawn today is
unlit mass. **`minPairMSD` is not moved and stays at 0.03000.** The re-derivation is written into
LOOK.md §7 with its date. §7 item 2 is the repair.

### 6.2 CITYCHECK — THE IDENTICAL FOUR SESSION 52 SHIPPED, AFTER ONE THIS SESSION EARNED

```
  clumping CV 0.388 against 0.60 — IDENTICAL to session 52's 0.388. 12 of 12 seeds below
    the floor, median 0.382, spread 0.272. NO THRESHOLD MOVED. §7 item 10 is why it did not move.
  2 of 2666 sign quads inside a building, the same two
  4 delivered overlaps — the identical four
  1004 of 284 382 walkable samples on bare earth (0.40 ha) — IDENTICAL to session 52's 1004
  generator claims 17 046, delivered 17 646 — both identical to session 52
  0 of 4 generator overlaps · 0 of 3554 props inside a building
  alignment 73.6% off-axis, largest deviation 2.27° against 3° — GREEN
  bright reserve 6.66% against 6.00 — GREEN, three runs [6.66 6.34 6.66]
  saturation 3.68% pooled peak against 12, three runs [3.68 4.19 3.68]
  RE-RUN AFTER §3.6 LIT THE DISTANT CITY: the identical four violations again,
    with every count identical. bright reserve 6.50% [7.12 6.39 6.50] — GREEN,
    saturation 3.46% [3.37 3.46 3.65]. So a night city with 5 936 more emitting
    boxes in it spent 0.16 points of bright reserve and no saturation at all.
  walkability 54 786 of 54 920 — seven sessions
  scene walk 342 instanced meshes, 342 labelled, 0 not. `distantMasses 5936`.
  city arrived over 2954 frames / 15 862.5 ms at load1 4.80 — inside the wall-clock bound
```

**EVERY PLACEMENT NUMBER IS SESSION 52's TO THE DIGIT**, which is §2's additivity claim measured
from the delivered side rather than from the generator's hash.

**AND CITYCHECK CAUGHT A DEFECT THIS SESSION INTRODUCED, ON THE FIRST FULL SUITE RUN IN EIGHT
SESSIONS.** `city:distant`'s census label was written as an ARRAY, and `harness.sceneCensus` sums
numeric values with `Object.entries` — so it summed to zero and the gate said
*"'city:distant' labels 0 and allocated 5936"*. That is §4's own argument arriving as a fact: a
mesh added in a session that never reaches `citycheck` ships undescribed. Fixed, re-run, gone.

### 6.3 PERFCHECK — ALL FOUR ROUTES, AND ONLY THE GREENS ARE VERDICTS

**`load1` was 5.48 at the start of this gate.** CONTRACT §0.2: a GREEN absolute under load is a
verdict because drift here is one-sided; a RED one is not. Session 52 ran ONE route.

```
                    draws  s52    tris   tris s52   instances  wall p95   cpu p95
  highway_speed       398  397   2.28M     2.21M     323 841   12.20 ms  10.80 ms   GREEN
  downtown_dense      320    —   2.01M         —     248 335   25.20     23.70
  night_rain          319    —   1.97M         —     303 650   26.10     24.60
  player                —    —       —         —           —   25.10     23.80
```

**THE TWO NUMBERS THE DISTANT CITY COST ARE +1 DRAW AND +0.07 M TRIANGLES**, which is
`edgeprobe --distant`'s prediction of 71 232 to within 1%. 2.28 M against a `ceilings.triangles`
of 2 360 000 leaves **80 000**, so the silhouette spent 47% of the headroom it was budgeted half
of — and the next session should read that as the real remaining figure, not 150 000.

`highway_speed` wall p95 **12.20 against 12.5, three runs [12.2 12.3 12.0], spread 0.3** — green
at `load1` 5.48, which is the sixth consecutive session that route has come in clear. Session 52
read 12.10 at `load1` 4.04; the two are not comparable and neither is a regression on the other.

**THE THREE ROUTES SESSION 52 DID NOT RUN ARE NOW MEASURED AND THEIR REDS ARE NEWLY KNOWN RATHER
THAN NEW.** `downtown_dense`, `night_rain` and `player` all breach frame time by roughly 2× at
`load1` 5.48, which under §0.2 says nothing. Two of their reds are NOT frame time and are therefore
readable:

- **`downtown_dense` frame entropy 4.880 < 5** — three runs [4.853 4.88 5.273], and the gate
  asserts on the LAST rather than pooling (`budget.json` → `$screenshotEntropy_s17`). The spread
  is 0.42 and the margin is 0.12. **Not resolvable by this instrument as configured**, and that
  is a statement about the estimator rather than about the city.
- **`player` worst froxel 57 of 96, margin 39 < 40.** A count, so §0.2's load caveat does not
  apply. One away from the floor.
- **`highway_speed` 60% of 68 vehicles carry a non-monotone tone profile against a 75% floor.**
  Session 52 read 65% of 62, session 49 read the population moving 55–74 across four runs of one
  session. **FIVE SESSIONS UNACTED**, and `budget.json` → `silhouettes.$estimator` already derives
  why a single reading is not a verdict: the sample is whichever subjects are in frame at the pose.

---

## 7. WHAT TO DO FIRST NEXT TIME

1. **THE LATTICE STILL DOES NOT STOP.** §2's last paragraph. The buildings thin to nothing past
   2816 m and every chunk out there still delivers **0.4542 ha of 15.0 m carriageway**, for ever.
   The city now fades into a landscape of yards with a full street grid under it. Making
   `generateChunk` emit no lattice past `extentEdgeM` is the precondition for the brief's item 3
   (*roads that leave*), because a road cannot leave a grid that has no boundary — and it is where
   the filling station, the yard, the motel and the depot go.
2. **L15 NEEDS A DERIVATION AGAINST A CITY WITH ITS LIGHTS ON.** §3.6 and LOOK.md §7. This item
   used to read *"the distant city is dark at night, and a gate said so"*; it was acted on inside
   the session, the prediction was falsified, and what is left is the band itself. **A night city
   that is lit is more like dusk than a night city that is black**, so `distinct:midnight|dusk`
   structurally penalises the direction LOOK.md §1 asks for. Nine sessions owed, and it is now
   owed a DIFFERENT derivation from the one sessions 45–52 were asking for: not *why is the
   margin small*, but *why is this the right pair of times*. `msd dawn <-> dusk` reads 0.05812 and
   `msd noon <-> dusk` 0.13898 — either might be the band this one was meant to be.
3. **THE ATMOSPHERE AT 1500 m IS BROWN SOUP.** `s53-city-high-t0_5-wet.png`. `ATM.hazeScaleHeight`
   is 550 m and the camera was at 1500; the frame is a uniform brown wash with the sky gone. Not
   this session's item and not looked into, but it is the first frame this project has taken from
   that altitude and it is now cheap to take more, because §3 put something out there to look at.
4. **THE TURNING HEAD**, STATE 52 §7 item 1, untouched. And **THE 47 m OF LANE ON PAVEMENT**,
   item 2, untouched.
5. **`SURFACE_TOP_M`'s DERIVATION IS FALSE BY 3.2×.** §5.2. The verdict is unchanged, which is why
   it is item 6 and not item 1, but the comment states a range that the code contradicts and that
   is CONTRACT §9's shape exactly.
6. **THE VEHICLE SILHOUETTE BAR, FIVE SESSIONS UNACTED** — 60% of 68 against a 75% floor, §6.3.
   STATE 52 §7 item 5, *the three routes perfcheck did not run*, is DONE: all four ran and §6.3 is
   what they say. `player`'s froxel margin of 39 against 40 is the other count worth reading.
7. **LIGHT THE FILL**, STATE 50 §6 item 1, untouched three times.
8. **THE APRON STAIRCASE'S RESIDUE**, STATE 52 §7 item 8. Still 0.40 ha of bare walkable ground.
9. **CLUMPING IS UNMOVED AT ~0.39 AGAINST 0.60** for sixteen sessions. **AND SESSION 53 IS THE
    FIRST THAT SHOULD MOVE IT THE RIGHT WAY** — `city-budget.json`'s own `$s37` derivation says
    the statistic correlates 0.92 with how many chunks in the window are EMPTY, and §2 makes the
    outer band emptier. It was NOT measured this session because `citycheck`'s window is the
    10 × 10 at the origin, which §2 leaves byte-identical. **A window at 2300 m would move it, and
    that is the experiment.**
10. **HOIST THE BUILDING CLAIMS IN `buildChunkBody`** — session 47's item 1, still what blocks
    facade clutter. **THE ARENA** (STATE 49 §4). Both still unspent.
11. **`decodePNG` RETURNS THREE BYTES PER PIXEL.** STATE 52 §2.2, and it cost that session a whole
    plausible and entirely wrong table.
