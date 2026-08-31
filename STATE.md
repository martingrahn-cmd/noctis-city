# NOCTIS — STATE

*End of session 61. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`, 12 d 23 h of
uptime — the same boot as sessions 47–60. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` READ 3.29 AT THE FIRST COMMAND***, with `mediaanalysisd` and its XPC helper together
on two cores for the whole session — over CONTRACT §0.2's bar of 1.6, so **no millisecond here
is a verdict**. Every number below is a count, an area, a reflectance or a ratio.

Branch `claude/noctis-61-countryside`, off session 60's head, pushed as each item landed.

---
## 0. THE FRAME FROM THE ROAD OUT — DOES THE CITY END, OR DOES IT STOP?

**IT DID NEITHER. IT EVAPORATED.** `s61-past-before-t0_42-wet.png` is a car's eye at
(3 260, 1.6, 0) looking east, fifty metres past the last painted line: the whole lower half of
the frame is one undifferentiated plane with a wet sheen on it. There is no road, no verge, no
kerb and no edge — because `block:road:main` is asphalt at **0.11714** over
`GROUND.earthAlbedo`'s **0.1229**, a **4.7% step**, and past the lattice there is not one mark on
it. The only object in eight hundred metres is session 56's filling station, standing on nothing.

**IT ENDS NOW**, and `s61-past-after-t0_42-wet.png` is the same eye at the same hour: a centre
line running to the horizon, a mown verge either side, hedgerows with gates in them, a tree line,
a farm, and the first hill on the right. `s61-air2-{before,after}` is the same pair from 180 m —
bare mottled earth against a patchwork of two crops with hedgerows on the field boundaries.

```
  s61-out-before-t0_42-wet.png     the exit road at x = 3 000, still inside the lattice
  s61-past-before-t0_42-wet.png    fifty metres past it: one plane and a filling station
  s61-past-after-t0_42-wet.png     the same eye — road, verge, hedge, trees, farm, hill
  s61-air-before / s61-air2-before / s61-air2-after   the transition from 420 m and 180 m
  s61-dusk-after-t0_72-wet.png     the same road at dusk
```

---
## 1. THE BRIEF'S PREMISE WAS WRONG, AND WHAT IS ACTUALLY THERE IS WORSE

The brief said so itself — *"the 68 m gap above is my arithmetic from two sessions' figures;
verify it before building on it"* — and it does not survive. Measured out of the pure generator:

```
  CITY.extentEdgeM                                       3 232 m
  HILLS.rMinM                                            3 300 m   the brief's two numbers
  ---
  the last LATTICE carriageway on cz = 0 reaches         3 211.7 m
  the nearest hill EDGE to the origin                    3 050 m
  the +X exit valley, clear of any hill footprint        |z| < 179 m
  block:road:main                       ONE PLANE, x in [-4000, 4000]
```

**THE HILLS ALREADY REACH 182 m INSIDE THE LATTICE EDGE**, the road does not end at all, and the
exit corridor is a 358 m-wide clear valley to the world's rim. There is no gap and nothing to
bridge. What there is instead is 788 m of drawn asphalt that nothing says is a road, with one
object beside it.

`HILLS.rMinM` is 3 300 as a RADIUS and the hills are scattered on a ring, so `r - foot` reaches
in by up to a 300 m footprint. The brief's arithmetic compared a radius to a radius where the
geometry is a radius minus a footprint. That is CONTRACT §9 rule 7 in a brief instead of in code.

---
## 2. ITEM 2 — A ROAD THAT LEAVES

**`block.js` PAINTS THE RIBBON FROM `CITY.extentEdgeM` OUTWARD.** A centre line only, on a
doubled cycle: a two-lane country road has no edge line and no lane line, and this is the point
where the arterial becomes one. It paints exactly the ground the extent left — the same join the
block's own marks already make with `BLOCK_KEEPOUT` — so it cannot double up with the lattice,
and the 20.3 m between 3 211.7 and 3 232 is unpainted road at a hundred kilometres an hour.

```
  block:markings   218 instances  ->  346      +1 536 triangles, +0 draw calls
```

**AND THE EXIT ROAD CLAIMS ITS OWN GROUND FOR THE FIRST TIME.** `block.js` draws 3 832 m of
carriageway outside `BLOCK_KEEPOUT` that no registry has ever been told about — CONTRACT §9.1's
own rule unmet on the one road that leaves. Every chunk past the extent that the ribbon crosses
claims it as `carriageway` now, so a hedgerow, a silo or a farmhouse is refused from the running
lane by the registry rather than by an arithmetic guard in a placement loop.

**THE TRAFFIC DOES NOT FOLLOW IT, AND THAT IS NOT A BUG TO FIX HERE — IT IS ITEM 0.** The brief
asked what the traffic model does with a lane that leaves the lattice. **It has no such lane.**
`traffic.js`'s own note: *"a vehicle's whole state is which LINE it is on"*, and the lines are
the chunk lattice at a 128 m pitch; both the seed pass and the recycle pass refuse
`cityExtentAt(pos) <= 0`, the same predicate the lattice, the lamps and now the countryside are
gated on. So the exit road cannot carry traffic until the traffic model has a lane that is not a
lattice line — which is exactly the polyline item 0 costs below. **The two are one item.**

---
## 3. ITEM 3 — WHAT SITS ALONG A ROAD OUT

Every chunk past `CITY.extentEdgeM` is farmland now, and the whole of it rides machinery that
already existed. `COUNTRYSIDE` in `citygen.js` carries every number and its derivation.

```
  FIELDS       two crops as ground rectangles. Two triangles each in the merged
               `city:ground` mesh, ZERO draw calls, and the thing that fixes the
               aerial. `field` is a new ground kind: cereal stubble reflects about
               2.1x a green sward in the visible with straw's chromaticity, so
               [0.062, 0.094, 0.045] x 2.1 redistributed = [0.186, 0.176, 0.094].
  HEDGEROWS    `city.js` has drawn an `edge` of kind `hedge` since session 49 and
               NOTHING HAD EVER ASKED FOR ONE. Two boxes a segment, 12 m segments,
               height rolled +-20% per segment so the top line is one somebody cut,
               and one segment in twelve dropped — which is a field gate.
  FARMSTEADS   a house, a barn, a silo and a yard: `shed`, `shed`, `tower` and a
               ground rectangle — session 49's own three feature kinds, which is the
               brief's point that eight kinds of place came from three meshes.
  A HOUSE ON THE ROAD   single storey on a large plot. This city contains no other
               object of that description: every mass inside the extent is a
               perimeter building or a landmark.
  A LAY-BY AND A BUS STOP   a `busStop` DECLARATION in the shape `busStopAt` already
               returns, so `city.js` builds the shelter, flag, bench and lit
               timetable it has built since session 30 and this adds NO geometry.
  A TREE LINE  `prop(tree)`, offered to the registry like every other prop.
```

**WHERE EACH GOES IS A CONDITION AND NOT A SCATTER**, which is the brief's own method: a farm
wants FLAT land, so it is refused inside a hill's footprint — `hillMasses` is pure and this file
owns it, so the domes `city.js` draws are the ones the farm is refused by rather than a second
description of where the hills are. A house wants a ROAD. A field is what is left.

**DELIVERED, seed 1337:**

```
  81 rim chunks (cx 25..33, cz -4..4)     6 farmsteads, 28 sheds, 1 301 hedge segments,
                                          354 field and grass rectangles
  27 road chunks (cz -1..1)               5 bus stops, 6 lay-bys, 148 verge trees
```

**AND ONE THING THE FIRST ARM GOT WRONG, WHICH AN AERIAL FOUND.** Cutting the fields back by
`vergeM` without laying anything in the gap left **12 m of the earth plane either side of the
road for its whole length**, so from above the exit road read as a pale mottled band rather than
as a road with edges. It is session 42's own finding — *"a missing surface is now a surface of
about the right colour that is not there"* — arriving at the one place session 42 could not
reach, because there was no generator content out here to notice it. The verge is laid as `grass`
now, and the two greens either side of the carriageway are what draws the road's edge.

The second arm's fields were also FOUR EQUAL CELLS PER CHUNK, which delivered a checkerboard on a
64 m module. The split is a roll now — a whole chunk, a half on either axis, or quarters —
which is `docs/authored-city.md` §1's clumping rule applied to a surface.

### 3.1 WHAT IT COSTS, AND WHERE THE MEASUREMENT HAD TO BE TAKEN

```
                                 triangles      draws     against
  city eye (citycheck's own)     +1 536         +0        2 360 000 / 440
  rim eye, x = 3 400              417 792        93       2 360 000 / 440
```

**THE ENTIRE COST INSIDE THE CITY IS THE 1 536 TRIANGLES OF ROAD PAINT.** Everything else is past
`CITY.extentEdgeM`, where `city.js` builds nothing until a camera goes there — so the countryside
competes for the ceiling only with itself, and a camera standing in it carries a fifth of what
one standing in the city does.

**AND NO GATE ROUTE REACHES PAST 3 232 m**, which the brief said to say rather than to quote a
band that cannot see it. `perfcheck`'s longest route travels 720 m; `lookcheck`'s two eyes stand
at (70, 1.74, 0.9) and (-251.94, 1.7, 291.58); `citycheck`'s region is cx, cz in [-5, 4]. **The
frames in §0 are the whole of the verdict on this content**, and the numbers above are the whole
of what is known about its cost.

---
## 4. ITEM 1 — THE GRADIENT, MEASURED. HEIGHT IS FLAT EVERYWHERE.

The brief asked for the height distribution BY DISTRICT rather than pooled. Out of the pure
generator over 2 401 chunks (cx, cz in [-24, 24]) at seed 1337, in radial bands of 400 m:

```
  band          chunks  bldgs  meanDens   meanH   medH    p90H    maxH   bldg/chunk  cover%
     0- 400 m       32    224    0.5710    39.5   30.7    72.9   149.9     7.00      21.96
   400- 800 m       88    560    0.4651    42.1   34.4    81.0   150.2     6.36      19.98
   800-1200 m      156   1100    0.4417    41.0   34.5    73.9   152.0     7.05      21.46
  1200-1600 m      208   1458    0.4400    40.9   34.3    75.9   152.6     7.01      21.77
  1600-2000 m      288   1961    0.4196    40.4   34.2    74.4   152.1     6.81      21.11
  2000-2400 m      344   1287    0.3235    41.4   34.5    76.5   153.2     3.74      11.28
  2400-2800 m      392    147    0.1807    41.8   36.4    73.1   152.5     0.38       1.15
  2800-3200 m      893      0    0.0194     —      —       —       —       0.00       0.00
```

**THE COUNT FALLS BY EIGHTEEN TIMES AND THE HEIGHT DOES NOT MOVE AT ALL.** Mean 39.5 to 42.1 m,
median 30.7 to 36.4, p90 73 to 81 and max ~150 at **every radius**, including the band where
there are 0.38 buildings a chunk. And it is not the radius it fails to read — it is the field:

```
  density band     bldgs   meanH   medH    p90H
    0.30-0.45       2301    40.5    34.1    75.2
    0.45-0.60       1674    41.4    34.7    73.6
    0.60-1.00       1567    40.8    34.0    76.6
```

**`buildingHeightRoll(rng)` TAKES AN RNG AND NOTHING ELSE.** Not the density, not the radius, not
the era. So a building at the rim is exactly as likely to be 150 m as one in the core, and what
separates a district from its neighbour is HOW MANY buildings and nothing else.

**THAT IS MOST OF WHAT "IT FEELS CLUSTERED" MEANS**, and it is a sharper statement than session
53's *"the density field has no radial term"*: even if the field had one, height would not read
it. A sparse district in this city is a downtown with buildings deleted — which is precisely the
brief's own *"a suburb is not a sparse downtown"*.

**ITEM 1b — THE BLOCK SIZE.** Over `citycheck`'s own 10 x 10 the delivered pavement runs take 64
distinct lengths, but **298 of them are two values** — 120.5 m and 116.3 m, the two island sides
— and the rest are the clip residue of the river, the landmarks and the origin block. The
lattice is one module: `CITY.chunkSize` 128 m, island 104.6 m, **every block in this city is the
same block**. Session 50's carried finding reproduces exactly.

**ITEM 1c — NOT BUILT, AND THE REASON IS THE ONE THE BRIEF GIVES FOR THE CEILING.** A height law
that reads the field changes the height of **every building in the city**, and `distantMasses`
reads the same law, so the silhouette out to 3 328 m moves with it. That re-bases every luminance
band, the facade census, the triangle count and `citycheck`'s clumping and coverage in one
change — the same shape as the `unitHash` item, and it wants a session with the re-derivations
in it rather than a half hour at the end of this one. **What this session did build at that end
of the gradient is §3**: the city no longer runs blocks-then-nothing, it runs blocks, thinning
blocks, farmland.

**AND `clumping` DID NOT MOVE**, which the brief asked to be told either way: 0.393 against a
floor of 0.60, identical to sessions 57-60. The countryside is outside the gate's region
entirely, so the one statistic built to reward this kind of variety cannot see it — which is
§3.1's point about where the measurement had to be taken, arriving from the other side.

---
## 5. ITEM 0 — THE CURVED ROAD, COSTED. IT IS AN HOUR FOR ONE YOU CAN DRIVE ON.

STATE 56 §8.3 said *"the ground vocabulary is axis-aligned rectangles"* and that a road following
land cannot be expressed at all. **The first half is true of `ground` and the second half is
false**, because this project has drawn rotated road surface since session 19 and nobody
connected the two.

```
  what a polyline road needs         does it exist                        where
  ---------------------------------------------------------------------------------
  a rotated SURFACE piece            YES — `patches`, 0.01 m boxes laid    city.js, s19
                                     "at a shallow angle to the kerb",
                                     251 of them in the resident ring
  a rotated CLAIM                    YES — |cos|.L + |sin|.W, and there    citygen paint(),
                                     are already THREE copies of it        the prop scatter,
                                                                           the pylon claim
  rotated MARKINGS                   YES — `paint()` takes a yawDeg        citygen.js
  a rotated thing to STAND ON        NO  — `scanGround` walks `ground      city.js
                                     .rects` and tests x0/x1/z0/z1
```

**SO THE COST IS: a road you can DRIVE on is free of new machinery** — a run of rotated boxes at
12 triangles a piece, which over 800 m at a 24 m pitch is 33 pieces and 396 triangles — **and a
road you can WALK on is one new function**, because the ground query is the one axis-aligned
thing left, and it is the same gap the road patches already have.

**AND THE TRAFFIC IS THE SAME ITEM (§2).** `traffic.js` parameterises a vehicle by which lattice
LINE it is on; a polyline is exactly the thing that would let it leave. Item 0 and the second
half of item 2 are one piece of work and should be briefed as one.

**RECOMMENDATION: it is an hour, and it is the highest-value hour on the list**, because the
exit road is currently straight for 3 800 m and a straight road is what makes the countryside
read as a corridor rather than as a place.

---
## 6. GATE STATE

```
  gate            exit   verdict   seconds  load1 in   out
  parsecheck         0     GREEN       3.4     4.13    4.13    118 files, contract-clean
  faultcheck         0     GREEN      10.1     4.13    4.35
  lookcheck          1       RED      47.0     4.35    4.08    THE IDENTICAL THREE
  windcheck          0     GREEN      36.4     4.08    4.12
  inputcheck         0     GREEN      14.4     4.12    4.18
  gateaudit          1       RED      73.9     4.18    3.45    the carried control
  citycheck          1       RED     116.4     3.45    5.27    IDENTICAL TO SESSIONS 57-60
  perfcheck          1       RED    1031.8     5.27    4.40

  4 of 8 RED — the same four as sessions 53–60. NOT ONE NEW RED GATE.
```

**`lookcheck` IS RED ON THE IDENTICAL THREE** — `distinct:midnight|dusk` **0.02838**, session
60's figure to five decimal places, plus `facadeAlbedo` and `facadeNeighbours` at dusk. The four
trade bands pass: midnight 0.1911, dusk 0.1975, dawn 0.3176, noon 0.4466, against bands of
[0.158, 0.228], [0.162, 0.232], [0.283, 0.353] and [0.412, 0.482]. **Neither eye can see any of
this session's content** — both stand inside 400 m of the origin — which is §3.1's point and is
why the frames are the verdict.

**`gateaudit`'s only failure is `control failed`**, the same carried three, with every falsify
suite at 100% coverage.

**`citycheck` IS IDENTICAL TO SESSIONS 57–60** on all four reds — clumping CV **0.393**, the same
**5** delivered overlaps, **2 of 2 647** signs inside a building, **1 004 of 284 918** bare
walkable samples — and on its counts: **18 799 generator claims, 19 087 delivered, 345 instanced
meshes, 0 label mismatches**. `block_markings` reads **346** where session 60 read 218.

**`perfcheck`: `highway_speed` 2.32 M triangles and 402 draws**, session 60's figures to three
digits, with **348 106 instances against 347 978 — exactly the 128 new road marks**. Every
violation is carried:

- the two vehicle silhouette bars, which LOOK.md §4 names in as many words, plus a third
  (`roofline`, 70% of **15** measured vehicles) that session 60's run passed at 78.8% of 33 —
  the brief's own *"do not act on one run of the vehicle silhouette bars"*, and one vehicle of
  fifteen is 6.7%;
- `night_rain`'s frame entropy 4.913, session 60's 4.916;
- every wall-clock and CPU red, at **load1 5.27** — CONTRACT §0.2 says a red absolute from there
  is not a verdict, and `highway_speed`'s wall p95 12.70 against 12.5 is 0.2 ms on a machine two
  cores down.

**TWO DEFECTS IN THIS SESSION'S OWN WORK LANDED AFTER THE BATTERY** (the bus stop's transposed
axis, and ownership collapsed into the field cut — both in the commit that names them). Both are
inside `if (beyondCity)`, so no gate-visible chunk moves; `citycheck` was re-run afterwards and
is **byte-identical** to the row above, which is the check rather than the claim.

---
## 7. WHAT TO DO FIRST NEXT TIME

1. **THE POLYLINE (§5), AND THE TRAFFIC WITH IT.** Costed, cheap, and it unblocks the winding
   road, the arterials that leave, and the first vehicle that is not on a lattice line. Brief
   them as one item.
2. **THE HEIGHT LAW DOES NOT READ THE FIELD (§4).** The measurement is done and the table is
   above; what it wants is a session that can afford to re-derive every luminance band after it.
   The shape: `buildingHeightRoll(rng, density)`, read by the perimeter walk AND by
   `distantMasses` so the silhouette and the city stay one law.
3. **THE COUNTRYSIDE IS OUTSIDE EVERY GATE (§3.1).** Nothing in this project asserts anything
   past 3 232 m. That is honest today because the content is new and the frames are the verdict,
   and it will stop being honest the first time somebody changes it and nothing goes red. The
   cheap version is a third `lookcheck` eye on the exit road, derived the way session 59 derived
   the trade eye.
4. **CARRIED, UNCHANGED**: `city.js`'s `unitHash` puts the multiplier INSIDE the sine, so it is
   arcsine-distributed and six shares deliver 0.14 to 0.72 of what their comments claim
   (STATE 60 §2.4); the three chunk seams, measured as one mechanism — a kerbside prop 8.30 to
   8.36 m inside its neighbour's square against two `city.js` placements that test only their
   own chunk; STATE 57 §0.1, the triangle ceiling at 2 630 000, still awaiting the operator; the
   53 holograms, untouched since session 43; the school yard's 8 trees and the church square's
   98, which want `prop` split into furniture and planting.
5. **`decodePNG` RETURNS THREE BYTES PER PIXEL.**
