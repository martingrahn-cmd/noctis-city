# NOCTIS — STATE

*End of session 66. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`, 14 d 11 h of
uptime — the same boot as sessions 47–65. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` RAN 2.99–5.87 THROUGH THIS SESSION***, over CONTRACT §0.2's bar of 1.6 for the
sixth session running, with `syspolicyd` at 69.7%, `mediaanalysisd-access` at 68.8% and
`mds_stores` at 63.8% at the opening check — a Spotlight reindex rather than session 65's browser.
**No millisecond below is a verdict.** Every number here is a count, a length, a depth, an angle, a
reflectance, a ratio or a pixel.

Branch `claude/noctis-66-the-sea`, off session 65's head, pushed as each item landed.

---
## 0. THE FRAME THE SESSION EXISTS TO ANSWER

**`tools/shot-out/sea-edge-t0_42-wet.png`** — the city's own edge, 40 m up on the north bank at
x = 3 150, looking east down the river.

**THE CITY STANDS ON WATER.** The river runs out between its quay walls, under the cable-stayed
bridge, and 288 m past the city's edge the banks stop being banks: the estuary opens and the water
runs to the horizon. The coast on the right is a curve nobody drew.

Three more, all four derived from `harbourSite` and the river's own centreline and recorded as
presets so the next session can retake them —
`node tools/lookat.mjs --preset=sea-edge,sea-road,sea-harbour,sea-air --t=0.42`:

```
  sea-road      a car's eye where the branch road arrives on the yard
  sea-harbour   OFF the quay, out in the fairway, looking back at the berth
  sea-air       180 m over the mouth, session 64 and 65's own altitude
  harbour-t0_08 the same berth at night, lit
```

**`sea-harbour` IS SHOT FROM THE WATER AND THAT IS SESSION 57's LESSON, NOT A PREFERENCE.** That
session shot three empty river frames before finding its own barges, occluded by the quay wall from
every camera on the bank — and the quay in question is this harbour's.

---
## 1. ITEM 0 — THE DATUM, AND THERE IS NO THIRD ONE

Session 66 was about to introduce a third ground datum beside the terrain and the road's hoisted
stations, and **the two sessions before it both had CONTRACT §9 rule 7 as their headline finding.**
So the datum came first and `node tools/landprobe.mjs --sea` reproduces all of it.

**PREMISE (i) IS TRUE.** The river's surface is `-RIVER.depth` = **−4.990 m**, a CONSTANT, written
as a literal at two sites in `river.js`. So `SEA.levelY` IS that number and `river.js` reads it too:

```
  SEA.levelY = -RIVER.depth = -4.990 m       ONE water datum for the world
  the river crosses r = 3 232 at x = -3 203.9 (103.4 m wide) and +3 203.8 (112.7 m)
  quay wall top 0.000, toe -5.79, parapet +1.05
  a moored craft already showed 0.75 m of freeboard and drew 0.50 m
```

**There is nothing to transition between at the mouth, because there was never a second scalar.**

### 1a. AND THE MEASUREMENT THAT DECIDED THE SEA'S SHAPE

```
  the landform WITHOUT the basin, 251 001 samples at 16 m:  -15.84 to +106.03 m
  the share of it under SEA.levelY:                          15.34%
```

**`h < level` is not the sea; it is every hollow in the world.** A global test floods a sixth of the
countryside. So `seaCells` floods from the mouth instead — **THE SEA IS THE WATER YOU CAN SAIL TO**
— which has nothing in it to tune and answers correctly by itself if the landform, the basin or the
level ever move.

**EXCEPT ONE THING, AND IT IS THE SESSION'S ONE COMPROMISE.** The pure fill came back with **459 of
2 541 exit-road samples under water**, and the basin at every one of them measured **−0.00 m**:
they are the landform's own hollows, chained to the estuary from x = 6 336 outward. The connection
is real — halving the step to test each edge's midpoint changed the count by zero — because this
countryside's sub-level set percolates. So the fill is restricted to ground the coast lowered
(`SEA.claimM` = 0.5 m, the smallest value that separates two populations which do not overlap: the
estuary's cells carry tens of metres and the hollows carry 0.00).

**WHAT IT COSTS, MEASURED:** 90 cell edges where water stops against ground still under the level,
p50 **3.84 m** deep, max 9.17. The nearest is **2 016 m** from the harbour, the p50 is **4 995 m**,
and **0 of the 90 fall within 2 km** — all out on the skirt where session 64's rings are 512 to
2 048 m wide. It is a defect and it is in §8 as one.

---
## 2. ITEM 1 — THE SEA, AT ZERO DRAW CALLS

**PREMISE (iv) IS BETTER THAN STATED: the sea costs ZERO draw calls, not one, and the shoreline
costs none.** It is not a new surface at all — it is the river's own water plane, at the river's own
level, in the river's own mesh, on the river's own `NOCTIS_WATER` material.

```
  1 856 cells of 128 m = 30.4 km2 of sea
  first sea 288 m past the city's edge on the river's own centreline
  depth 30.8 m at the mouth, 59.2 m at x = 6 000
  zero disc          0.000000 m over 303 601 samples at 12 m
  the exit road      0 of 2 541 samples in the sea, nearest sea 88 m
```

**THE COAST IS THE TERRAIN'S OWN SHAPE AND NOT A CURVE.** The basin lowers the ground; where it
crosses the level is where the land stops, and the landform's ±18 m moves that crossing. Measured,
the south shore stands 152 to 236 m off the centreline over x 3 300 to 6 000 — **it wanders 84 m**.
Nothing is drawn at the water's edge at all: the land occludes the water and that is the coast.

The fill is **dilated by one cell**, so its own boundary always lies under ground that stands above
the level. That is what makes `SEA.cellM` free — the water plane is FLAT, so the cell is not a
resolution, only how tightly the quads hug a coast that is drawn by something else.

**ITEM 1d IS SETTLED BY CONSTRUCTION RATHER THAN BY CLASSIFICATION.** The sea is not surface 31: it
is `river:water`, which `roughcensus.mjs` already carries as `moot` because `NOCTIS_WATER`
overwrites both wet terms unconditionally and `noctisRough` cannot reach it. **The one surface in
this project that is supposed to mirror was already the one declared as such.**

The census after building, which item 1d asked for: **30 distinct surfaces, 39 construction sites,
0 UNCLASSIFIED**, 0 where an impervious default is wrong, and 4 rows crossed between the census's
two halves with 0 disagreements. `river:water` goes 1 000 → 5 094 triangles and its row does not
move.

**ITEM 1e, DECIDED RATHER THAN INHERITED.** `river:water` was already `frustumCulled = false` with
its own comment — *"its bound is the world; culling it is a test that can only answer visible"* —
and the sea joins that mesh, so the decision is the one already taken and written down. Nothing new
was given the property by accident.

**ITEM 1c — NO REFLECTION PASS.** None was built. The water uses the environment map already in
use, perturbed by `waterWaves`'s Cox–Munk slope field, at `WATER.baseRoughness` = 0.045. §5 has what
that costs.

---
## 3. ITEM 2 — THE SHORE, AND CHROMA IS THE TELL

The brief asked which instrument applies — session 64's CHROMA, which found the grey pads, or
session 65's LUMINANCE, which found the hill's grass line — and said to measure both rather than
assume. Measured, `GROUND.earthAlbedo` against what it replaces:

```
  strand vs   luminance      chroma
  grass         1.45x      10.50x flatter
  field         0.70x       9.97x flatter
  tilled        1.21x       8.13x flatter
```

**CHROMA, overwhelmingly, and harder than the 6 to 7 that found the farmsteads.** The luminance
ratio **spans 1.0** and therefore carries no consistent sign at all: a shingle bank is brighter than
grass and darker than stubble. Session 65's tell does not apply here.

**AND NO NEW NUMBER IS AUTHORED.** `GROUND.earthAlbedo` is session 42's *"a field beside a city"* —
bare soil, Y 0.1212, saturation 0.050 — which is a wet shingle strand already. Session 65 tried the
same borrowing for a cut face and the frame refused it; the difference is that a pale neutral LINE
along a country road is a kerb and a pale neutral BAND at the water's edge is a beach. Porosity 1.0,
which is session 55's own crushed-stone row.

`SEA.strandM` is **3.0 m of HEIGHT** and the width is the terrain's: measured, a strand **8 to 24 m
wide** over the harbour reach — narrow where the shore is steep, wide where it is gentle, which is
what a coast does.

**NO BREAKWATER.** Item 2b asked for a spit or a breakwater to give the estuary a mouth; it is not
built, and the mouth is instead the natural narrowing where the basin's flare begins. §8.

---
## 4. ITEM 3 AND 4 — THE HARBOUR, AND HULLS THAT READ THE WATER

**PREMISE (ii) IS TRUE AND MORE SO THAN STATED.** Session 57's craft already sit IN the water from
an explicit `y`, which is now `SEA.levelY`. The harbour's craft are river craft moored at a
different wall, in the same mesh, at the same datum. The warehouses are `shed`, session 49's kind.
No new geometry vocabulary and no new draw call.

**THE SITE IS MEASURED AND THE LEVELS ARE DERIVED, NOT TYPED.** The south shore is regular from
x = 3 884 to 4 396: coast at z = −193 to −214, water 60 m out 25 to 28 m deep, the exit road 168 to
184 m inland. `harbourSite` samples the terrain along each platform's LANDWARD edge — the edge that
governs, because the seaward one is under water — and takes the maximum plus 0.4 m:

```
  apron   +2.117 m,  7.107 m over the water,  36 m of working quay
  yard    +8.470 m,  56 m more for containers and sheds
  water at the quay face 12.1 to 18.3 m
  3 portal cranes, 6 container blocks of 3x3 ISO boxes, 2 warehouses,
  8 quay lamps, 2 yard floods, and a branch road that climbs in 32 m plates
```

**Session 65's cut face draws the quay wall down to the bed and the retaining edge behind the yard
without a line of new code** — item 3d asked for that mechanism and got it twice.

**AND IT CLAIMS NOTHING.** No `reg.claim` anywhere in it. The harbour refuses hedgerows and hill
trees through an `inHarbourAt` predicate, which is `onHill`'s own shape, so the occupancy registry
is byte-identical.

### 4a. ITEM 4d — VERIFIED INDEPENDENTLY, AND THE PROBE'S OWN CONTROL FIRED FIRST

`tools/waterprobe.mjs` reads the DELIVERED `instanceMatrix` — the buffer the GPU is handed — and not
`harbourCraft`'s return value.

**ITS FIRST ARM SPLIT HULL FROM WALL ON THE WATERLINE SIGNATURE AND THE WALL POPULATION CAME BACK
EMPTY.** A quay wall's toe is `RIVER.depth + 0.8` under GRADE, which is **0.80 m under the water**,
and a launch draws 0.80 m. Two populations, one signature. The §7.3 control fired, which is the
control working — and it is exactly the shape session 65's first false pass had.

So `river.js` records the kind PER INSTANCE and the probe reads the label, with the geometry as the
measurement and the two never derived from each other. Delivered:

```
  craft   52 boxes, 11 straddling the waterline, 41 superstructure above it
  wall    128, deck 3, and every `deck` box is ABOVE the water
  8 of 8 harbour craft matched to a delivered hull by plan position
  WORST |delivered − intended| over freeboard and draught:  0.00 m
```

**ITEM 4a IS ANSWERED BY ROUTING RATHER THAN BY CARE.** `city.js`'s feature `put()` gained a pitch
in session 65 and takes ONE ground query; a hull placed through it would sit on the bed 12 to 18 m
down. **Nothing here goes through it.** The craft are drawn by `river.js`'s own `push`, which takes
an explicit `y`, and that `y` is the same constant the water plane is built at.

Item 4b: **moored only.** Session 57's barges move on the river through `river.js`'s own update; the
harbour's are static, which is what one session buys.

---
## 5. ITEM 5 — THE EMISSIVE PATH, AND SESSION 62 IS FALSE IN AN EXACT WAY

STATE 62: *"there is NO EMISSIVE PATH FOR A FEATURE IN THIS PROJECT AT ALL."* Session 20 delivered
aircraft navigation lights. **Both cannot be true, and the narrow sense in which 62 is right is one
closure rather than the project.**

```
  `put()` writes props/propSkin -> the chunk's `masses` mesh on materials.facade,
    whose `emissive` is BLACK. lights.js injects `totalEmissiveRadiance *= vColor`,
    so an instanceColor over 1.0 there is multiplied by ZERO — not clamped.
    Session 62 is exactly right about that path.
  BUT the same loop already pushes into a SECOND array for `f.kind === 'lamp'`:
    the bowl joins the city-wide `city:bowls` mesh on materials.lampBowl, which
    has a real emissive, and the head takes a clustered light slot.
    A FEATURE HAS BEEN ABLE TO GLOW SINCE SESSION 40.
```

There are exactly **two** mechanisms in the project: an emissive material scaled per instance by
`instanceColor` (aircraft, trains, city windows, signs, stalls, vehicles, block neon), and a real
clustered light slot (the searchlight, street lamps, floods). Nothing else.

So the harbour is lit with the kind that already works, at **zero new draw calls and zero new
materials**. **WHAT IT DOES NOT BUY, SAID OUT LOUD:** a lamp bowl is ONE global `emissiveIntensity`
uniform with no per-instance channel, so every bowl in the world is the same sodium at the same
brightness. LOOK.md's *"warm against the city's cold"* needs a per-instance emissive, which
`materials.window` has and this does not. §8.

**AND IT IS ALSO WHY THE 23 HILLSIDE VILLAS ARE STILL DARK**, which is a different reason from the
one session 62 gave: their terrace lamp reaches the bowl mesh, but `city.js` gates the bowls on
`near = detail && ring <= CITY.nearRadius` = 2, which is 256 to 384 m, and a villa stands up to
`HILLSIDE.driveReachM` = 900 m from the road. **The lamp is never built, not never possible.**

---
## 6. WHAT THE SEA COSTS TO LOOK AT, AND IT IS §9's BILL

**THE BRIEF PREDICTED THIS AND TOLD ME NOT TO FIX IT.** *"A sea at the horizon sits exactly where
[the below-horizon fill] shows. Report it if it reads badly."* It reads badly, and here is the
measurement.

From 180 m looking 15° down, the sea's delivered colour and the river's, at comparable range:

```
                       rgb                    Y      saturation   hue
  the sea at ~500 m    75.7, 68.9, 59.1     69.6      0.219       r > g > b
  the river at ~300 m  73.5, 76.8, 81.6     76.5      0.100       b > g > r
  ATM.groundAlbedo      0.155, 0.145, 0.125            0.194       r > g > b
```

**THE SEA IS THE COLOUR OF THE LAND.** `sky.js` paints the below-horizon hemisphere as
`ATM_GROUND_ALBEDO × groundLighting / π`, the water is a near-mirror at
`WATER.baseRoughness` = 0.045, and a camera 180 m up looking 15° down reflects into the band the
PMREM blurs that fill into. The sea's delivered hue is `ATM.groundAlbedo`'s hue to the channel
order and within 0.03 of its saturation.

**FROM A LOW EYE IT IS WATER.** The same surface from 6 m reads blue with the wave field on it
(`sea-harbour`, `sea-road`), because the reflected ray goes steeply into sky the fill cannot reach.
So the defect is a VIEW ANGLE on a known quantity, not a property of the sea — and it is §9's own
entry, which wants its own session with `lookcheck` as judge.

---
## 7. THE BRIEF'S FOUR PREMISES

| | premise | verdict |
|---|---|---|
| (i) | the river surface is a fixed height inside the zero disc | **TRUE.** −4.990 m, a constant at two literal sites. So the sea is that number and there is no transition. §1 |
| (ii) | session 57's quay and barges are reusable as they stand | **TRUE, and more so.** The craft already sat IN the water from an explicit `y`; the warehouses are `shed`. No new vocabulary. §4 |
| (iii) | session 20's aircraft lights are an emissive path a feature can reach, contradicting session 62 | **TRUE, and 62 is false as written.** Two mechanisms exist; a feature has reached one since session 40. 62 is right about `put()` and wrong about the project. §5 |
| (iv) | the sea costs one draw call and the shoreline costs none | **BETTER: it costs ZERO.** The sea is the river's own mesh, level and material. §2 |

---
## 8. THE COST

**THE DRAW BUDGET WAS THE BINDING CONSTRAINT AND THE SESSION SPENT NONE OF IT.** Sea, water,
harbour, containers and boats were given 39 draw calls between them:

```
                   session 65     session 66
  draw calls          401            401        of 440
  triangles          2.45 M         2.45 M      of 2 630 000
  instances         347 833        347 833
```

**AND THE TRIANGLE FIGURE IS A ROUNDING, WHICH IS WHY THE BOOT LINE PRINTS THE REAL ONE.**
`perfcheck` reports two decimals of a megatriangle and the sea is under one hundredth of that, so it
would have been invisible in the only place the ceiling is measured. Delivered:

```
  1 856 cells flooded, DILATED to 2 047 quads = 4 094 triangles
  0.156% of the 2 630 000 ceiling
  `river:water` 1 000 -> 5 094 triangles
```

**ZERO DRAW CALLS, AND NOT ZERO TRIANGLES EVERYWHERE.** `river:water` is `frustumCulled = false`
— it was already, with its own comment — so those 4 094 triangles are submitted from every camera
position in the world, including inside the city where the routes run. That is the honest statement
and it is the same class as `block:ground`'s, which §10 has carried since session 63.

**WHAT THE HARBOUR COSTS IS PAID ONLY WHERE IT IS RESIDENT**, because it is chunk content:

```
                        draws   triangles
  country-air              83     588 080  ->  592 174   +4 094, exactly the sea
  country-car              86     571 634  ->  575 764   +4 130
  sea-edge                 92     607 456   the city's edge, the river and the estuary
  sea-air                  86     626 144   180 m over the mouth
  sea-road                 87     487 824   on the yard
  sea-harbour              87     489 930   off the quay
```

**THE CEILING LIVES IN TWO PLACES AND BOTH ARE UNTOUCHED.** `budget.json` and `HUD.budgets` are
byte-identical.

**AND THE OCCUPANCY REGISTRY IS BYTE-IDENTICAL: 18 799 generator claims, 19 087 delivered**, which
is the brief's own constraint. Nothing in the harbour calls `reg.claim`; it refuses the countryside's
scatters through `inHarbourAt`, which is `onHill`'s shape. Water is not a claim.

---
## 9. GATE STATE

**THE BATTERY RAN TWICE**, because a z-fight and three documentation changes landed after the first
one and CONTRACT §10 asks the gates of the source that ships. The second is the verdict; the first
is a second draw, and §9a is what that bought.

```
  gate            exit   verdict   seconds  load1 in     out
  parsecheck         0     GREEN       3.9      3.76    3.76    123 files, contract-clean
  faultcheck         0     GREEN      27.8      3.76    4.00    7 cases, quarantine surgical
  lookcheck          1       RED      51.1      4.00    3.99    THE IDENTICAL THREE
  windcheck          0     GREEN      41.3      3.99    5.33    every mesh, 0 wound backwards
  inputcheck         0     GREEN      17.3      5.33    5.87
  gateaudit          1       RED      79.3      5.87    5.13    the carried `control failed`
  citycheck          1       RED     128.9      5.13    4.89    IDENTICAL TO SESSIONS 57-65
  perfcheck          1       RED    1090.0      4.89    3.87    AND IT FINISHED AGAIN

  4 of 8 RED — the same four as sessions 53-65. NOT ONE NEW RED GATE.
```

**`citycheck` IS BYTE-IDENTICAL TO SESSIONS 57–65 ON EVERY COUNT** — clumping CV **0.393**, **5**
delivered forbidden overlaps, **2 of 2 647** signs inside a building, **1 004 of 284 918** bare
walkable samples, **344** instanced meshes. And the one the brief named as a constraint:
**18 799 generator claims, 19 087 delivered.** The occupancy registry is untouched, water is not a
claim, and the harbour claims nothing.

**`highway_speed` READS 401 DRAWS, 2.45 M TRIANGLES AND 347 833 INSTANCES**, identical to sessions
64 and 65 — but §8 says why the triangle figure is a rounding rather than a fact, and the sea's
4 094 are inside it.

**`windcheck` IS GREEN**, which matters more this session than usual: the sea's 2 047 quads and the
harbour's cranes, containers and hulls are all new hand-emitted geometry, and every winding in them
is derived in a comment beside the emission rather than tried.

**`gateaudit`'s only failure is `control failed`** — the three `lookcheck` reds reported as the
unperturbed frames failing their own gate. Every falsify suite at full coverage.

**EVERY `perfcheck` VIOLATION IS CARRIED OR IS A TIMING ABSOLUTE FROM A LOADED MACHINE**, at `load1`
**4.89** against CONTRACT §0.2's bar of 1.6 — including the `N frames over 33 ms` counts, which are
counts OF a timing. `highway_speed`'s wall p95 reads 13.10 in the first battery and 12.90 in the
second on source that differs by one millimetre of water 3.3 km outside its route: **0.20 ms of
drift between two runs**, which is §0.1's own incident restated for the third session running. The
vehicle silhouette bars moved from three failures over 75 vehicles to two over 65, which LOOK.md §4
names in. The frame-entropy straddle is a straddle again: `downtown_dense` 4.940 and `night_rain`
4.848 against a floor of 5, where the first battery had `night_rain` GREEN at 5.012.

### 9a. AND THE msd DID NOT MOVE, WHICH IS NOW A 14-DRAW STATEMENT

Session 65 showed that `lookcheck`'s `distinct:midnight|dusk` — quoted as a constant **0.02838** by
three STATEs — ranges **0.02836 to 0.02838** over five draws on an unchanged head, and that the
fifth decimal has always been noise. This session added two more draws across a source state that
gained a sea, a coast, a harbour and eight ships:

```
  battery 1   0.02838
  battery 2   0.02836
```

**Both inside the band, which now stands on 14 draws across three source states.** The margin to the
0.03 floor is 1.63e-4, eight times the range, so the red is real and only the fifth decimal is
noise. No band is evidence until its noise floor is known, and this one's is.

---
## 10. WHAT TO DO FIRST NEXT TIME

1. **THE BELOW-HORIZON SKY FILL, AND THERE IS NOW A SEA IN FRONT OF IT (§6).** Carried from STATE 64
   §9 item 2 and 65 §8 item 4, and this session put **the largest bright surface in the world exactly
   where it shows**. It is no longer a 1.34× brightness argument: measured, the sea's delivered hue
   IS `ATM.groundAlbedo`'s, channel order and all. `sky.js` says of that same line *"through PMREM it
   is the only thing illuminating every downward-facing surface in the scene"*, so splitting the
   backdrop from the ambient moves every soffit in the city. **It is the top of this list and it has
   been for three sessions.**

2. **A LAMP BOWL HAS NO PER-INSTANCE EMISSIVE, SO THE HARBOUR CANNOT BE WARM (§5).** `city:bowls` is
   one global `emissiveIntensity` uniform with `skin = null`, so `USE_COLOR` is not even defined on
   it and every bowl in the world is the same sodium at the same brightness. LOOK.md's *"warm against
   the city's cold"* needs the channel `materials.window` already has —
   `totalEmissiveRadiance *= vColor` — and giving the bowl mesh a skin is the whole change. It would
   also light the 23 villas, which are dark for a **RING** reason and not session 62's: their terrace
   lamp reaches the bowl mesh, but `city.js` gates bowls on `near = detail && ring <= 2` = 256 to
   384 m and a villa stands up to `HILLSIDE.driveReachM` = 900 m from the road. **The lamp is never
   built, not never possible.**

3. **`SEA.claimM`'s 90 CUT EDGES (§1a).** Water stops against ground still under the level, p50
   3.84 m deep, max 9.17 — the price of refusing to flood a sixth of the countryside. All far away
   (nearest 2 016 m from the harbour, p50 4 995 m, 0 within 2 km) and all on the skirt. The clean
   repair is not a better threshold: it is a landform whose sub-level set does not percolate, which
   is a change to `TERRAIN`'s own amplitude and belongs with §10 item 6 below.

4. **NO BREAKWATER, AND ITEM 2b ASKED FOR ONE.** The estuary's mouth is the natural narrowing where
   the basin's flare begins, which reads, but a mole or a spit is what gives a harbour a reason to be
   where it is. It is one more `yAdd` plate with session 65's cut face and a light on the end, so it
   is cheap — it was cut for time and not for cost.

5. **THE WAVE FIELD IS A RIVER'S.** `waterWaves` is Cox–Munk at 3 m/s over a hundred-metre channel,
   and over open water at close range it delivers a regular diagonal corduroy rather than a sea —
   visible in `sea-harbour` and `sea-road`. A fetch-dependent amplitude would be one term; nothing
   about it is measured yet.

6. **THE SEA'S FAR SHORE IS ON THE SKIRT.** Measured: **0.50 km of the south shoreline lies inside
   the 4 km plane at 32 m stations and 5.04 km lies on the skirt**, where session 64's rings are 128,
   256, 512, 1 024, 2 048 and 2 032 m wide. The near coast — the harbour's own — is the half that is
   resolved. The far half is the same trade session 64 took for the horizon and it is louder now
   that there is a coastline on it.

7. **`river:water` IS `frustumCulled = false` AND NOW CARRIES 5 094 TRIANGLES.** Same class as
   `block:ground`'s, which §10 has carried since session 63 and which is now three meshes: the
   ground, the skirt and the water, all submitted whole every frame from everywhere.

8. **THE PEDESTRIANS WALK ON THE WATER.** Carried from STATE 63 §9 and 65 §8 item 9 — they follow
   the camera and `streetlife.js` has no ground query — and `tools/shot-out/seacar-t0_42-wet.png`
   shows a crowd standing on the estuary. The defect is unchanged; what changed is that it is now
   funny.

9. **A VILLA'S PLOT IS STILL SMALLER THAN THE HOUSE ON IT**, carried from STATE 65 §8 item 1 with
   both numbers on record and the trade untaken.

10. **EVERY COUNTRYSIDE GRASS RECTANGLE STANDS 0.16 m PROUD OF THE FIELD BESIDE IT**, carried from
    STATE 65 §8 item 2. `GROUND_Y.grass` is a kerbed lawn's datum and a country verge has no kerb.
    **The harbour's plates use `yKey: 'yard'`, which is `GROUND.carriageway` = 0**, so they do not
    inherit it — which is worth knowing when the datum is finally moved.

11. **THE FRAME TIME AND THE `frustumCulled = false`**, carried from STATE 63 §8 through 65 §8
    item 5. First thing to measure on a quiet machine, and this machine has not been quiet for six
    sessions.

12. **NOTHING PAST 3 232 m IS INSIDE ANY GATE**, carried from STATE 61 §7 through 65. The sea, the
    coast, the strand, the harbour, its cranes, its containers and its ships are all outside every
    assertion in this project. `landprobe --sea` and `waterprobe` are probes and say so in their own
    headers.

13. **CARRIED, UNCHANGED**: the hedges that stand on a laid rectangle (STATE 65 §8 item 3); the 49
    constant-reading ground sites; the height law reads nothing at all; the traffic has no lane that
    is not a lattice line; `city.js`'s `unitHash` puts the multiplier inside the sine; the three
    chunk seams; the 53 holograms.

14. **AND A PROBE'S CONTROL IS WORTH MORE THAN ITS VERDICT.** `waterprobe`'s first arm told hull from
    quay wall by their waterline signatures, and the wall population came back EMPTY because both
    sit 0.80 m under the water. It reported `8 of 8 matched, worst 0.00 m` at the same time — a true
    verdict beside a broken discriminator. Session 65's first false pass was a census with no
    control at all; this one had one and it fired. **Build the control before reading the number.**

15. **`decodePNG` RETURNS THREE BYTES PER PIXEL.**
