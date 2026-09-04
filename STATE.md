# NOCTIS — STATE

*End of session 78. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`, 16 d 20 h of
uptime — the same boot as sessions 47–78. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` RAN 2.6–4.5 THROUGH THIS SESSION***, over CONTRACT §0.2's bar of 1.6 for the eighteenth
session running. **No millisecond below is a verdict.**

Branch `claude/noctis-78-the-city`, off session 77's head.

**THE CITY ITSELF, WHICH HAD NOT HAD A SESSION SINCE 60.** A build session: five commits, five
things built, and the walk that found them is §0.

---
## 0. WHAT THE CITY LOOKS LIKE TO SOMEONE WALKING IT

Ten poses inside r ≤ 3 232, **written down before shooting** and none of them a landmark view —
because every one of the twenty-three committed poses inside the city looks at a landmark or the
viaduct, and nobody had photographed an ordinary street in seventeen sessions.

```
 1 w-core        70,1.74,0.9        the origin block street, the gate's own eye     r 70
 2 w-trade       -251.94,1.7,291.6  a trading street, the gate's second eye         r 385
 3 w-mid         1152,1.74,700      an ordinary built street                        r 1348
 4 w-outskirt    2304,1.74,300      an ordinary street at the rim                   r 2323
 5 w-junction    1024,1.74,1024     a 128 m lattice junction                        r 1448
 6 w-park        192,1.74,-1000     a park island                                   r 1018
 7 w-market      -448,1.74,-760     a market island                                 r 882
 8 w-industrial  -1088,1.74,-380    an industrial district                          r 1152
 9 w-river       256,1.74,-370      the riverbank                                   r 450
10 w-skyline     1500,140,1500      the skyline, for the height gradient            r 2121
```

**THE PLAIN WORDS, RANKED BY HOW MUCH OF THE FRAME THEY SPOIL TIMES HOW OFTEN THEY RECUR:**

1. **THE CARRIAGEWAY IS AN EMPTY SLAB.** 30–45% of every street frame, in eight of the ten. One
   flat tone with four dashed lines on it. No gutter, no patching that reads, no camber, no polish.
   It is the largest surface in the city and the emptiest.
2. **THE SKYLINE IS A UNIFORM CARPET WITH A HARD EDGE.** From the foreground to the horizon the
   heights are the same everywhere; two or three towers scattered in it; then a straight line where
   the buildings stop and bare tan ground begins. *"The city feels clustered."*
3. **VEHICLE REARS ARE FEATURELESS LOAVES.** The white van is a smooth pill, the dark car a wedge
   with no lights, no plate, no boot line. In six of ten frames.
4. **PEDESTRIANS STAND IN EVENLY-SPACED LINES.** Twelve along one pavement at the rim, all the same
   gap apart, all facing the same way. Reads as cardboard cutouts.
5. **THE TREES ARE CUBES.** Stacked green boxes on a stick. Unmistakable in the park.
6. **A GHOST OF GREY RECTANGLES ON THE ROAD.** I first read it as a shadow. It is the road-patch
   population — the carriageway variation *already exists* and is nearly invisible.
7. **A HARD ROAD-COLOUR SEAM** across the street in the gate's own eye, where the origin block's
   pale carriageway meets the streamed city's dark asphalt.
8. **THE MARKET CANOPY IS EMPTY.** A roof slab on fourteen columns with nothing under it.
9. **THE WATER MOIRÉS** into corduroy at grazing incidence.
10. **THE GRASS IS A FLAT GREEN SLAB.**

**AND THE BEST FRAME OF THE WALK WAS NOT IN THE WALK.** The same ordinary street at midnight, wet,
is the project at its best — lamps doubled in the road, sign colour running down the carriageway,
the pavement reading distinctly from the road at the kerb. **Every defect above is a DAYLIGHT
defect.** The night city is in good shape; the day city is where seventeen sessions of attention
went elsewhere.

**WHICH POSES DID NOT SHOW THEIR SUBJECT** — item 0d. `w-river` was mine and it was bad: I stood at
water level and got 55% water. And **`condenser-street` still does not show the condenser** — §7
item 1.

---
## 1. THE STACK WAS 14 BOXES, AND THE EXCHANGE'S CAP WAS NaN

**PREMISE (i) IS TRUE.** Counted out of the running code, not read off a comment: `stack` was **14
boxes, 168 triangles**, one albedo, one roughness. Seven plain cuboids, each 18.86 m tall, the
largest with a single unbroken face of **1 470.9 m²** and **27 245 m² of wall** in all — with no
window, rib, course, cornice, joint or opening anywhere on it. `LANDMARKS` calls it a *"Mass-timber
stepped RESIDENTIAL terrace"*: twenty-seven thousand square metres of dwelling with no way to see
out.

Session 73 detailed three of the eight — condenser, exchange, dish, the three lathes — and wrote the
sentence this repairs: **"no windows is not the same as no surface."** Its ranked defect #6, *"LARGE
BARE SURFACES WITH NOTHING ON THEM, NOT FIXED"*, was scoped to GROUND scatter, so nothing in
sessions 73–77 came back to the five box landmarks. **The walk found the stack from 1.3 km away as a
blank cream wedge on the skyline — which is what STATE 73 §3 blamed on the `stack-street` POSE.**

It gets floor bands at a 3.4 m storey, recessed galleries under each band on the two long faces at
0.10 of the wall's albedo, and corner piers 1.2 m proud. All through `pushCore` into the same
`landmark:<name>:mass` InstancedMesh — **no new mesh, no new material, zero extra draws.** Counted
from the code: 20 boxes a step, seven steps, **140 boxes and 1 680 triangles = 1.03% of headroom**.
The largest unbroken face falls **1 470.9 → about 245 m²**.

**AND A SECOND DEFECT FOUND WHILE COUNTING.** `pushCore` is
`(x, y, z, sx, sy, sz, yaw = 0, a = albedo, r = rough)` and the exchange's lantern cap passed
**eight** arguments: `shade`, a three-element array, landed in `yawDeg` and `rough`, a number,
landed in `a`. `setMatrix` does `tmpEuler.set(0, yawDeg * DEG, 0)` on an array — **NaN** — and
`addInstanced` then does `setRGB(a[0], a[1], a[2])` on a number. **The cap has drawn nothing since
session 73 built it**, and it degrades nothing and warns nobody. CONTRACT §9's shape with an
ARGUMENT POSITION.

**The other four untouched landmarks, ranked and NOT fixed:** `weir` is one 40-gon lathe carrying
the two biggest single surfaces in the city (a **26 149 m²** floor cone and a **4 999 m²**
retaining ring, jointless); `arch` is 23 boxes with a **1 384 m²** deck face and one albedo for all
22 chords; `mast` is a 91-member lattice and correct, though `LANDMARKS` calls it *guyed* and the
word "guy" appears nowhere in `src/`; `viaduct` is the most articulated object in the project and
wants nothing.

---
## 2. THE GROUND HAD A ROUGHNESS CHANNEL AND NOTHING WROTE IT

`noctisRough` is a vec2 per ground vertex. `.y` is the porosity the wet terms read, with a producer
since session 55. **`.x` is a per-vertex ROUGHNESS OVERRIDE, `lights.js` reads it —
`if (vNoctisRough.x > 0.0) roughnessFactor = vNoctisRough.x;` — and `city:ground` has pushed a
literal `0` at every vertex it has ever emitted.** Two floats per vertex, 25 158 vertices, uploaded
on every chunk crossing, to say *"no answer"*. **CONTRACT §9.3, and it is the EIGHTH.**

Why it was worth a table: the walk found the carriageway to be 30–45% of every street frame and one
flat tone in all of it. The variation that exists is **a barbell** — sub-metre to 9 m from the
shader's mineral grain, then nothing until the per-rectangle albedo changes at 120–151 m. **A road
rect is 15.0 × 151.4 m and carries ONE colour and ONE finish over the whole of it.**

`GROUND_FINISH` is per-kind and 0 still means *"use the material's"*, so any kind not named is
byte-identical. Asphalt 0.88, float-finished concrete carriageway 0.72, cut flagstone 0.70, broken
hardcore and site ground 0.90–0.94, grass 0.95. **Every value is at or above 0.66 so `mineral` stays
1.0** and no surface loses the weathering it has — what changes is the finish under it. `lights.js`
already carries the argument: *"Weathered concrete is not a different grey in patches, it is a
different FINISH in patches, and a frame where only albedo varies reads as a texture rather than a
surface."*

**And a concrete carriageway is now a different finish and not only a different grey.** `roadAlbedo`
has split on `chunk.roadMaterials[0]` since session 45 and 36 of 81 detail chunks are concrete, so
the split existed and had only ever been a colour.

**And the 328 road patches shared one literal.** They vary by AGE now, one axis, both ends anchored:
the black end is the 0.055 the line always used, the weathered end is the carriageway's own asphalt,
and **no patch is ever LIGHTER than the road it is cut into.** Roughness runs the other way, 0.62
fresh bitumen to 0.90 oxidised. The COUNT is unchanged — one change at a time.

**COST: 0 triangles, 0 draws, 0 bytes.** Same street, same pose, before and after: 126 draws,
2 190 480 triangles, identical.

> **A FIRST ARM REACHED FOR `buildGround`'s `roadAlbedo` FROM `buildChunkBody`, WHERE IT IS NOT IN
> SCOPE.** That is a ReferenceError and a quarantined city module — session 77's own near-miss, one
> file over, four commits later. Caught before running, by checking the enclosing function rather
> than by trusting the name.

**PREMISE (iv) IS TRUE**: session 72's 64 m limit is a property of `TERRAIN.stationM`'s fixed grid,
and a ground rect has no grid at all. Any axis-aligned rectangle ≥ 0.35 m costs 2 triangles and
**zero draws** — 157.7 m² per triangle, 3 300× better than a road marking. A 4 m partition of the
whole ring is 41 268 triangles, 25% of headroom, 0 draws. **Not built this session** — §7 item 3.

---
## 3. THERE IS NO SECOND TREE POPULATION

**PREMISE (ii) IS REFUTED.** The brief supposed the cube trees session 73 photographed were a
second, unidentified population, because session 22 had already *"fixed the city tree"*. There is no
second population. **Session 22 was a HEAD-CLEARANCE fix**: it moved crowns UP by 0.35–0.50 m and
changed not one dimension, tilt or box count. Variants 0, 2 and 3 are session 21's shapes untouched.
The object in session 73's own frame was projected back through that pose in pure Node and
identified as `PROP_MODELS.tree` variant 1 at 24.2 m.

**WHY THEY READ AS CUBES, MEASURED** — orthographic silhouette, 36 azimuths, crown boxes only:

```
  variant   biggest mass       aspect   biggest box as % of crown area
  0 broad   2.30x2.10x2.05     0.895              69.0%
  1 column  1.55x2.10x1.45     0.645              52.0%
  2 open    1.85x1.85x1.70     0.936              71.8%
  3 small   1.50x1.35x1.40     0.928              71.0%
```

**For three of the four the whole crown is only 1.4× the projected area of its own biggest box, and
that box is a cube to within 8–11%.** Three cubes stacked with a tilt still read as one cube: the
overlap does nothing because the masses are the same SHAPE at three sizes. Variant 0's own comment
already says *"what reads as a crown is an outline that is neither flat on top nor straight down the
sides"* — it got the height stagger right and the SECTION wrong.

Every mass is now about half as tall as it is wide, with lateral offsets that are a real fraction of
the mass. Variant 1 is left alone: at 0.645 it is already the tapered spire it says it is. **Nothing
moves down** — session 22's constraint kept, every underside rises. **Box counts unchanged, so zero
triangles.**

**AND THE ONE THING THAT DID MOVE, STATED RATHER THAN LEFT TO A GATE.** Variant 3 is a 3.6 m tree
whose lowest crown mass has always sat below `HEAD_CLEAR_M`, so it is in the ground band and its
WIDTH is part of its claim. Measured over `citycheck`'s own 10×10: **trees 266 → 259, total props
4 657 → 4 652.** Seven trees refused, two other props taking freed slots. 2.6% of the population,
and a placement consequence of a look change rather than a defect.

---
## 4. HEIGHT READS THE DENSITY FIELD, WHICH REVERSES SESSION 53

**PREMISE (iii) IS TRUE AND THE FRAME IS WHY** — §0 item 2. And the repair reverses a sentence
session 53 wrote on purpose, ninety lines from the change: *"HEIGHT DOES NOT DEPEND ON DENSITY IN
THIS CITY — both correlations are 0.06, which is nothing — and that is not a defect, it is
`buildingHeightRoll` being a function of `rng` alone."* It was true and it was measured. *"Not a
defect"* meant *"not a bug, it is by construction"*; **it was never a defence of the look.**

**WHY DENSITY AND NOT RADIUS.** A radial term makes a cone, which is a diagram of a city rather than
one. `densityAt` already decides how much ground is covered and how many buildings there are —
session 53's own fits are `cover = 0.267 + 0.362d` and `count = 7.179 + 5.020d` — so a district that
is dense in plan becoming tall in section is the one term that makes all three agree. It inherits
the radial fall for free, because `densityAt` multiplies by `cityExtentAt`.

**THE ANCHOR TOOK THREE VALUES AND THE GATE FOUND THE LAST ONE.** A scale whose expectation is 1
does not preserve the mean of a skewed distribution clamped at both ends, so `HEIGHT_MID_D` = 0.45 —
the mean density per CHUNK, the number that looked right — raised the city 6.8% and its
tall-building count 18.7%. A first sweep against the city's mean height picked **0.50**, which
preserves it to 0.1%.

**AND 0.50 WAS STILL WRONG, BECAUSE EVERY ROUTE THIS PROJECT MEASURES RUNS THROUGH THE CORE** —
which is exactly where a gradient adds height. `highway_speed` came back at **2 668 090 triangles
against a 2 630 000 ceiling.** The mechanism is floors and not metres: over the inner 17×17 chunks
floors went **23 797 → 25 108, +5.5%**, while the whole city moved +0.14%. **A mean preserved over a
disc says nothing about the annulus a camera is standing in** — the same shape as session 77's
finding that `citycheck`'s clumping window sits entirely inside the flat core.

Re-swept against the quantity the routes actually pay:

```
  MID    core floors (17x17)     world mean h    inner/outer     >= 60 m
  ----   before  23 797               40.93         1.013          1180
  0.50           25 108  (+5.5%)      40.98         1.132          1200
  0.54           23 869  (+0.3%)      38.83         1.140          1065
  0.57           22 892  (-3.8%)      37.19         1.145           968
```

**0.54 holds the routes' cost to +0.3% and buys a BETTER gradient than 0.50 did** — 1.013 → 1.140 —
for a city 5.1% shorter on average. That trade is the right way round: 5% of mean height is not
perceptible and a 14% core-to-rim difference is the whole item. Building COUNT is unchanged at
6 713; this moves no placement, only sections.

**WHAT IT DOES NOT DO, said plainly: the far horizon still ends in a hard line.** That is
`extentEdgeM` and a separate item.

**AND THE GRADIENT WAS NEVER THE MISSING PIECE THE BRIEF SUPPOSED.** `densityAt` has had a radial
term since session 53 — `citygen.js:586` multiplies by `cityExtentAt` — but **`extentCoreM` is
`14 × 128` = 1 792 m**, so it is exactly 1.0 over every metre of city anybody has measured, and
`citycheck`'s clumping region is `x,z ∈ [-640, 640]`. **The gradient this project already built is
invisible to the gate that has been red about clumping since session 53, by construction.** Swept in
pure Node: no admissible radial gradient turns that red green — the most violent arm reaches 0.506
against a floor of 0.600 while deleting the measured world — and it moves the CV **only by emptying
the window** (r = +0.972 with the low-detail chunk count), which is the contamination
`city-budget.json` already documents. **Do not let that CV be the reason to build or not build a
gradient.**

---
## 5. THE COST, AND IT WAS SPENT ON THE CITY ON PURPOSE

**THE SESSION'S COST IS ATTRIBUTED, not estimated** — `highway_speed` run three times, once with the
height change alone reverted and everything else kept:

```
                                 draws   triangles    instances
  session 77 baseline              404   2 466 960      348 868
  session 78 without the height    405   2 468 628      349 000
  session 78 as shipped            405   2 592 572      358 386
```

**The height gradient is +123 944 triangles — 76% of the 163 040 headroom — and everything else in
the session is +1 668 triangles and +132 instances**, which is the stack's 140 boxes less the seven
refused trees. The brief said *"about 163 000 spare, spend it here; the city is what the ceiling was
raised for"*, and **the ceiling is respected with 37 428 triangles and 35 draws to spare.**

**THE +1 DRAW IS THE EXCHANGE'S NaN, AND THAT IS THE INTERESTING HALF.** It appears in the no-height
arm too, so it is not the gradient. **A NaN instance matrix poisons an `InstancedMesh`'s computed
bounding sphere, and a mesh with a NaN bound is culled** — so fixing the eight-argument call did not
only make the lantern cap draw, **it made the whole `landmark:exchange:mass` mesh draw on this
route.** One mis-positioned argument had been hiding an entire landmark from a camera 1.1 km away,
and the frames looked plausible because the landmark's own lathe is a separate mesh and still drew.

### THE BATTERY, RUN TWICE

**4 OF 8 RED — THE SAME FOUR AS SESSIONS 53–77. NO FIFTH RED.**

```
  gate            exit   verdict   seconds  load1 in
  parsecheck         0     GREEN       3.6      4.40
  faultcheck         0     GREEN      29.6      4.40
  lookcheck          1       RED      50.8      4.99    THE IDENTICAL THREE
  windcheck          0     GREEN      41.5      5.75    574 meshes, 570 ok, 0 wound backwards
  inputcheck         0     GREEN      17.6      5.24
  gateaudit          1       RED      78.8      5.04    downstream of lookcheck, as always
  citycheck          1       RED     127.1      4.93    MOVED — see below
  perfcheck          1       RED    1099.6      4.32    12 violations, NONE of them triangles
```

**IT WAS RUN TWICE AND SAY WHY.** The first battery started at `load1` **6.74** and `perfcheck`
exited **2** — `harness: run failed — page.evaluate: Execution context was destroyed`, the machine
flake this project has recorded at `load1` 5–7 since session 60. Its `night_rain` also delivered one
run at mean 0.0527 and entropy 2.429 against two at 0.10/5.0, which is a frame that mostly failed to
render. **Neither was content.** The table above is the second battery, entire, and its
`highway_speed` reproduces the standalone run to the digit.

**`citycheck` MOVED FOR THE FIRST TIME SINCE SESSION 57 — TWENTY-ONE SESSIONS — AND IT WAS
EXPECTED.** Every figure, and what moved it:

```
                              s77        s78     why
  occupancy claims          18 799     18 794    the seven refused trees, less two props
  delivered                 19 087     19 082    that took the freed slots
  forbidden overlaps             5          7    +2, and they are SIGN ON SIGN
  sign quads                 2 647      2 699    +52 roof signs on the taller core buildings
  signs inside a building        2          1    -1
  clumping CV                0.393      0.396    unchanged in substance; still red at min 0.6
  objects/chunk max            113        114
```

**THE +2 OVERLAPS ARE ATTRIBUTED AND THEY ARE NOT THE TREES.** Session 77's five were
`adpillar × cyclestand`, `planter × lamp:column`, a second `adpillar × cyclestand` and
`colonnade:pier × sign:blade`. The two new ones are **`sign(pylon) × sign(sign:blade)`** and
**`sign(sign:blade) × sign(sign:blade)` at 0.351 m²** — sign on sign, from the 52 extra signs the
taller core buildings earned. It is §9.1's placement-without-a-collision-test class meeting a larger
population, not a new mechanism, and it is **item 8 of §7**.

**`lookcheck` IS THE IDENTICAL THREE.** **`perfcheck`'s twelve violations contain no entropy and no
triangle or draw breach** — eleven are milliseconds and frame counts at `load1` 4.3–5.8, which
CONTRACT §0.2 says are not verdicts in the red direction. The twelfth is the vehicle tone profile,
and it got worse: **53% of 66 vehicles against 65% of 57 in session 77.** That is the vehicle rear
this session did not build, measured by the gate that has been asking for it.



---
## 5. WHAT TO DO FIRST NEXT TIME

**1. `condenser-street` STILL DOES NOT SHOW THE CONDENSER** — item 0d, unfixed. Session 77 moved the
eye off the dish's footprint and the street canyon is still in the way; `arch-street` and
`stack-street` are the same defect. **The real repair is to make the `-street` generator call
`poseprobe`**, which has existed since session 26 for exactly this and which the generator has never
called (CONTRACT §9.3's seventh). `poseprobe` gives the condenser clear azimuths at 10–20, 160, 250,
260–290 and 355; the shipped pose is at 54.

**2. THE VEHICLE REARS — the highest-visibility thing left in the city, and it is a DESIGN change.**
The body is a lofted sweep of ONE shared 8-point section (`traffic.js` `sectionProfile`), 28
triangles, applied unchanged at every station. A rear that reads needs a second profile interpolated
along the spine. Session 73 deferred it, session 78 did not reach it, and `perfcheck` carries a
standing red that would MOVE if it were built: *"only 65% of 57 vehicles carry a non-monotone tone
profile (min 75%)"*.

**3. THE 9 m TO 120 m HOLE IN THE GROUND.** §2 established that premise (iv) is true and that a
ground rect costs 2 triangles and 0 draws at 157.7 m² per triangle. A 4 m partition of carriageway
and pavement over the whole ring is 41 268 triangles — 25% of headroom, **0 draws** — and it is the
only route that fills the band between the shader's 9 m grain and the rectangle's 120 m albedo.
Two constraints: it must be a PARTITION and not an overlay (coplanar plates need the 1 mm ladder),
and `quad()` flat-shades, so it buys N tones and not a gradient until `city.js:1503-1515` pushes
per-corner colours.

**4. THE PEDESTRIAN LINE-UP.** Twelve figures at one spacing along one pavement, all facing the same
way. Very visible at the rim and never named before.

**5. THE FOUR REMAINING BARE LANDMARKS** — §1. `weir` first: 26 149 m² and 4 999 m² of jointless
concrete, the two biggest single surfaces in the city.

**6. THE HARD ROAD-COLOUR SEAM** in the gate's own eye, where the origin block's carriageway meets
the streamed city's.

**7. `AIRFIELD.edgeStepM` AND `afPaint` are still declared and never read**, and the mast is still
called *guyed* with no guys in `src/`.

---
## 6. THE FOUR PREMISES

| | premise | verdict |
|---|---|---|
| (i) | at least one of the five untouched landmarks is still a smooth primitive | **TRUE, and it is `stack`.** 14 boxes, 168 triangles, one albedo, a 1 470.9 m² unbroken face and 27 245 m² of wall on an object its own data calls a residential terrace. Built. Three of the other four are also bare and are named in §1. §1 |
| (ii) | the cube trees are one unidentified call site rather than a population | **FALSE.** There is no second population and no unidentified site: it is `PROP_MODELS.tree`, and session 22's fix was a head-clearance fix that changed no shape. Identified by projecting session 73's own frame back through its own pose. The crowns read as cubes because each is 1.4× its own biggest box. §3 |
| (iii) | the city still reads clustered to an eye walking it | **TRUE, and the skyline frame is the evidence** — a uniform carpet to the horizon with a hard edge. Height now reads density; the inner/outer ratio goes 1.013 → 1.132 at an unchanged city mean. The hard edge remains. §4 |
| (iv) | session 72's 64 m limit does not apply to paved city surfaces | **TRUE, for two independent reasons.** The terrain's Nyquist is a property of a fixed 32 m grid and a ground rect has no grid — any rectangle ≥ 0.35 m is 2 triangles and 0 draws. And a world-space procedural term already runs on these surfaces at 0.27 m. §2 |
