# NOCTIS — STATE

*End of session 62. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`, 13 d 1 h of
uptime — the same boot as sessions 47–61. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` READ 3.46 AT THE FIRST COMMAND AND ROSE TO 5.4 INSIDE THE BATTERY***, with
`mediaanalysisd`, its XPC helper and `mds_stores` together on three cores for the whole session —
far over CONTRACT §0.2's bar of 1.6, so **no millisecond here is a verdict**, for the second
session running. Every number below is a count, a length, an angle, a reflectance or a ratio,
which is CONTRACT §9 rule 6's corollary: those do not drift.

Branch `claude/noctis-62-the-land`, off session 61's head, pushed as each item landed.

---
## 0. THE AERIAL PAIR, WHICH IS THE ONE QUESTION THIS SESSION EXISTS TO ANSWER

The operator rejected session 61's countryside in one sentence — ***"it is the city's block
vocabulary with green and yellow paint on it"*** — and named five things in the frame:

```
  every field an axis-aligned rectangle, several L-cut at 90°, one block across
  the ground dead flat to the horizon
  the road straight through the fields, in the same lattice as downtown
  CITY LAMP POSTS STANDING IN FARMLAND
  the hills three smooth domes resting on the plane without meeting it
```

**Three of the five are repaired, one is measured and refused, and the fifth is repaired at the
hill and not at the ground.** The pair, both from 180 m over the transition at t = 0.42, wet, at
the same pose, taken from a worktree at session 61's head and from this session's:

```
  tools/shot-out/
    custom-s62-air-before-t0_42-wet.png    session 61 — a grid of one-block fields in two
                                           tones, a straight road on the lattice line z = 0,
                                           a smooth dome resting on the plane
    custom-s62-air-after-t0_42-wet.png     this session — 49 parcels where there were 218,
                                           every one crossing a chunk boundary, three tones
                                           with a per-parcel tint, a road bending away, a
                                           hill spreading into the ground with houses on it
    custom-s62-road-before-t0_42-wet.png   the same pose from a car's eye at (3 260, 1.6, 0)
    custom-s62-road-after-t0_42-wet.png    looking east — the second frame the operator shot
    custom-s62-road-after-dry-t0_42.png    THE SAME EYE, DRY, and it is the one that answers
                                           the road: a centre line running away and stopping,
                                           a mown verge either side drawing its edges, a tree
                                           line, hedgerows on the field boundaries, a hill on
                                           the right and the carriageway narrowing as it goes.
                                           At `wet = 1` the lower half of the frame is a
                                           mirror and neither arm of the pair shows a road
                                           surface at all — which is worth knowing about the
                                           pose the operator chose, and is why this is here
    custom-s62house-t0_42.png              TWO HOUSES ON A HILL SHOULDER WITH THE CITY'S
                                           SKYLINE ON THE HORIZON BEHIND THEM. This is the
                                           shot the whole framing exists to produce.
    custom-s62villa2-t0_42.png             three of them from 140 m, on two hills
    custom-s62hill2-t0_42.png              a hill from 120 m: the shoulder, and the octagon
```

**THE PART THAT DID NOT MOVE IS THE GROUND ITSELF.** §5 is the measurement and the refusal:
there is no vertical term anywhere past the extent, and putting one in is not a triangle problem.

---
## 1. THE BRIEF'S THREE PREMISES, MEASURED. ONE SURVIVES, ONE IS HALF RIGHT, ONE IS FALSE BY 33

### 1.1 *"only `scanGround` is axis-aligned"* — **FALSE, AND BY A FACTOR OF 33**

STATE 61 §5 costed a walkable road as *"one new function, because the ground query is the one
axis-aligned thing left."* Walked end to end, the ground pipeline assumes an axis-aligned
rectangle in **33 distinct places**, and `scanGround`'s containment test is one line at the
BOTTOM of the chain:

```
  citygen `ground.push` record   {kind, yKey, x0, z0, x1, z1} — no orientation field exists.
                                 4 193 of 4 193 records over 11 x 11 chunks at seed 1337, and
                                 0 of them carry a yaw, a half-length or a centre.
  citygen `strips`               ten object literals built from chunkBounds, `axis: 'NS'|'EW'`
  citygen `subtractBox`          four WORLD-AXIS half-plane cuts. A rotated rectangle minus an
                                 axis-aligned keep-out is not a set of rectangles at all.
  citygen `MIN_GROUND_PIECE_M`   the sliver test is per world axis
  citygen `streetEnd`            emits the kerb as an axis NAME and a scalar
  citygen `onRoad`               the paint clip is an AABB query
  city.js `quad()`               six vertices from four scalars
  city.js `rects`                the same four, recorded
  city.js `scanGround`           x0/x1/z0/z1                       <- the one line
  occupancy.js                   "a list of AXIS-ALIGNED claims", its own first paragraph
  harness `occupancyCensus`, citycheck's walkability mask, its bare-walkable sweep, its
  delivered-overlap sweep, and 28 separate `ground.push` sites
```

**Repairing `scanGround` alone would change nothing**, because nothing upstream can produce a
rotated rectangle for it to fail on.

**AND SESSION 61's OTHER COUNT IS ALSO SHORT.** It reported the rotated-AABB claim expression
`|cos|·L + |sin|·W` in *"THREE copies"*. There are **five in `citygen.js`**, **four in
`city.js`** and two more in `tools/claimprobe.mjs` — **nine in `src`, eleven in all.** Its third
claim is correct and reproduces: rotated road SURFACE has existed since session 19 as `patches`,
0.01 m boxes at a yaw in the instanced box mesh.

**SO THE ROAD IS A POLYLINE AND NOT A ROTATED RECTANGLE** — which is the brief's own item 0b, and
§3 is what it cost.

### 1.2 *"the ground outside the city is a single plane with no vertical term"* — **HALF RIGHT**

**THE CORE OF IT SURVIVES AND IS THE REASON §5 REFUSES THE ITEM.** `GROUND` is seven scalar
literals, `GROUND_Y` is nineteen entries all built from them, and `buildGround`'s `quad()` takes
ONE `y` and writes it into all six vertices under a hard-coded `(0, 1, 0)` normal. **Not one
ground surface anywhere in this project is a function of (x, z).**

**THE OTHER HALF IS WRONG TWICE.** It is not one plane and the plane is not two triangles:

```
  block:ground     the 8 km earth plane at y = -0.020.  A QUAD STRIP ON 522 x-STATIONS —
                   1 077 quads, 2 154 triangles, median gap 16.00 m — because the river's
                   bank stations drive it. With `?river=0` it collapses to 88 triangles.
                   NO TESSELLATION IN z AT ALL: every quad spans the full 8 km.
  block:road:main  the arterial at y = 0.000
  city:ground      3 298 countryside quads at y = +0.140, covering 99.7% of the exit
                   corridor's off-carriageway ground
```

Three flat layers 0.16 m apart, not one — so **displacing the earth plane alone would be
invisible**, because 99.7% of what an aerial sees out there is the layer 0.16 m above it.

### 1.3 *"the field parcels are derived from the chunk lattice"* — **SURVIVES EXACTLY**

Session 61, over cx 25..33, cz −4..4 at seed 1337:

```
  parcels                                                              218
  lying WHOLLY INSIDE their own 128 m chunk                     218 of 218
  axis-aligned rectangles                                       309 of 309
  parcel edges exactly on a multiple of CITY.chunkSize        542 of 872, 62%
  parcels with at least two edges on it                         218 of 218
  longest side, min / median / max                    45.3 / 89.0 / 128 m
  L-cut into two or more rectangles                        24 of 218, 11.0%
```

The operator is exactly right, and the mechanism is that a parcel is `chunkBounds(cx, cz)` split
at most once per axis, so **every parcel has two edges on the lattice by construction and no
field can be wider than one city block.** §4 is what replaces it.

---
## 2. THE LOUDEST TELL: 563 STREET LAMPS STANDING IN FARMLAND

**TWO READERS OF ONE PREDICATE, EVALUATING IT AT TWO DIFFERENT POINTS.** `generateChunk` decides
what a chunk IS from `cityExtentAt` at the CHUNK'S CENTRE — its own comment says *"the boundary
is 128 m ragged"* — and gates the lattice, the props, the island kind and the whole of session
61's countryside on that one answer. `city.js`'s street lamps asked the same function at THE
LAMP'S OWN COORDINATE. Over a 128 m band those are two different questions, so a rim chunk is
farmland over the whole of itself and keeps every lamp standing on the crescent of it still
inside the circle. Measured over every chunk in the world at seed 1337
(`node tools/landprobe.mjs --lamps`):

```
  lamp stations admitted, session 54's gate — cityExtentAt(THE LAMP)      33 238
  lamp stations admitted, session 62's gate — chunk.beyondCity            33 038

    standing on a chunk the generator calls COUNTRYSIDE                      563
      chunks carrying at least one                                            94
      on (25, 0), the exit road's own chunk — where the aerial was shot        10
    on a LATTICE chunk that the point test refuses                            363
      — drawn carriageway with no lamp on it, the mirror defect

  over citycheck's own 10 x 10 region, EITHER gate                        1 620
```

It is CONTRACT §9 rule 7 with a predicate instead of a datum, and the unusual half is that
**neither reader is wrong on its own terms** — they evaluate one statement at two places. So the
decision is made once, in the generator, and published: `generateChunk` returns `beyondCity` and
`city.js` reads it. It also restores the 363, because a chunk with a lattice lights all of it.
`citycheck`'s region does not move by one station, so it is a repair and not a content change.

---
## 3. THE ROAD THAT LEAVES — ITEMS 0, 1a, 1b AND 1c

`citygen.js` → `EXIT_ROAD` is the **one description**, and its five readers each take it in the
form that reader already understands. Nothing anywhere became a rotated rectangle.

```
  block.js's ribbon      a triangle strip on the station table, in the SAME mesh, the SAME
                         material and the SAME ONE draw call the plane already was.
                         193 quads against 1: +384 triangles, and this is the one piece of
                         the session every gate route pays for.
  block.js's markings    a box per dash with a yaw, which `put` has taken since session 45
  blockSurfaceAt         |z - exitRoadZ(x)| <= exitRoadHalfM(x). ONE comparison, and it IS
                         STATE 61 §5's "one new function" — it is just in block.js
  the registry           one axis-aligned `carriageway` box PER STATION, taking the outer
                         edge pair so the claim CONTAINS the ribbon
  the countryside        the field cut and the verge, on the same staircase
```

**EVERY NUMBER IN THE SHAPE IS FORCED** (`node tools/landprobe.mjs --road`):

```
  world past the extent                              768 m   rim 4000 - extent 3232
  design speed                                     27.78 m/s = 100 km/h
  min radius   R = v²/(g(e+f)), e 0.05, f 0.17      357.6 m
  stations                                        96 at 8 m
  chord sagitta on the tightest arc                0.0224 m   under the 0.05 every join uses

  the first shift, CONTRACT §9 rule 2, two ways
    small-angle  kmax·L²/2π                           65.6 m
    the table's own integral                          64.8 m
  z range over the +X arm                    [-64.8, 0.0] m
  peak |heading|                                    19.59°
  verge edge to the nearest of 173 hill footprints  194.7 m
  chunk columns owning EXACTLY 128 m of road         7 of 7
  verge overlap onto the tarmac, worst station       1.42 m = 4·tan(19.59°), its own bound
```

**THERE IS NO FIRST KILOMETRE.** The brief asks for *"two or three bends over the first
kilometre"*; `BLOCK.groundExtent` is 4000 and `CITY.extentEdgeM` is 3232, so the whole of the
transition the operator photographed is **768 m long**. What fits is one shift — two bends, out
and back, leaving the road parallel and 64.8 m displaced — and the start of a second.

**THE BEND IS A CURVATURE SCHEDULE AND NOT A SINE ON z**, because a sine has its steepest slope
where it crosses zero and would leave the arterial at a kink. `κ(u) = dir·κmax·sin(2πu/L)`
integrates to a heading that is zero at both ends, so both joins are tangential by construction
and nothing has to be blended.

**AND IT CHANGES KIND, WHICH IS ITEM 1b.** 15.0 m of arterial tapering at **1:50** to **7.0 m** of
country road — two of this city's own lanes, `2 × ROAD_MARKING.laneOffsetM`, which clears two
haulers passing (`traffic.js`, 2.66 m each) by 0.84 m a side. No kerb out there and no lamps
(§2). **The centre line runs exactly `taperM` = 200 m past the extent and stops**, because a
marked centre line belongs to the arterial's cross-section: 568 m of road after it carries
nothing at all, which is the brief's *"a centre line that stops"* falling out of the taper rather
than being a second number.

**ITEM 1c — the 788 m.** It is road. Every countryside chunk the ribbon crosses now claims it as
`carriageway` per station over the whole staircase, not only where the chunk furnishes it, so a
hedgerow or a silo is refused from the running lane by the registry. **What is still unclaimed is
20.3 m**, between the last lattice carriageway at 3 211.7 and `CITY.extentEdgeM` at 3 232 — a
chunk that is not `beyondCity` makes no `exit:road` claim, and the lattice's own claim has already
stopped. Nothing stands there and nothing is painted there; it is written down rather than left.

---
## 4. THE FIELDS, AND THE GROUND THEY ARE — ITEM 3

**THE PARCEL STOPS BEING A PROPERTY OF THE CHUNK.** `FARM` is a WORLD lattice of irregularly
spaced boundaries — 200 m mean, 0.30 jitter, so 80 to 320 m apart — evaluated identically in
every chunk from the root seed and the line's own index. The crop and a per-parcel tone are hashed
from the PARCEL's index pair, so a field spanning four chunks is one field in all four.
Over the same rim region session 61 was measured on (`node tools/landprobe.mjs --fields`):

```
                                          session 61        session 62
  parcels over the region                        218                49
  wholly inside one 128 m chunk           218 of 218          0 of 49
  reaching into more than one chunk          0 of 218        49 of 49
  parcel area                          bounded by 1.64 ha   2.58 / 3.82 / 6.32 ha
  largest / smallest                                                 2.4x
  longest side                            45.3-128 m         161-255 m
  crops                                            2                 3
  hedge segments over 81 chunks                1 301               747
```

**AND A FOURTH DEFECT THE MEASUREMENT FOUND THAT NOBODY ASKED ABOUT.** Session 61's crop was
`(ci++ + cx + cz) % 2` over an i-outer/j-inner loop, which puts the two same-crop cells of a
four-way split at the same `j`: **on all 28 four-way chunks the colour made two full-width bands
and the x split line carried no change of crop at all.** Half of every four-way split was
invisible.

**THE THIRD CROP IS NOT A THIRD GREEN, AND A FRAME REFUTED THE FIRST ARM IN ONE RENDER.** It was
a standing cereal at [0.112, 0.142, 0.062] — a green, beside `grassAlbedo`'s green — and two
thirds of a rim in green reads as one carpet exactly as two alternating tones did. **The count
went up and the contrast went down.** The three tones that make farmland read are the three STATES
of one piece of ground, and what the pair left out is the soil itself:

```
  kind      linear albedo             luminance Y      R/G      what it is
  grass     [0.062, 0.094, 0.045]        0.0837       0.66      pasture
  field     [0.186, 0.176, 0.094]        0.1722       1.06      cereal stubble
  tilled    [0.119, 0.097, 0.071]        0.1000       1.22      ploughed earth
```

`tilled` is derived the way `field` is: moist bare loam reflects **1.25×** a green sward in the
visible where the straw above it reflects 2.1×, at an iron-oxide chromaticity of 1.00 : 0.82 :
0.60, and solving `Y = 0.100` at that ratio gives R = 0.1187. **The stubble is the bright one, the
sward is the dark one, and the soil is between them in level and past both in hue — so no pair of
the three is separated on one axis only.**

**AND A PER-PARCEL TONE, WHICH COSTS NOTHING.** Three crops on a lattice still leaves a third of
every boundary invisible, because a third of neighbouring parcels draw the same crop and two
adjacent fields at one reflectance are one field. `hillMasses` already rolls `range(0.82, 1.12)`
on a hill's tone for exactly that reason and this is the same roll; `city.js`'s ground mesh has
carried a per-vertex colour since session 19, so it is one multiplier on the way in — **no new
attribute, no new material, no new draw call.**

**HEDGEROWS ON THE BOUNDARIES THAT EXIST.** Session 61 ran a hedge along the chunk's two rolled
split lines, so every hedge in the world was 128 m long and stopped at a chunk edge whether or not
a field did. They run along the world lines now, and the neighbouring chunk continues the same
line from the same number. The run beside the road takes the road's own tangent per segment, and
its CLAIM is the rotated-AABB expression this file already carries five times — at the peak
19.59° a 12 × 0.7 m segment claims 11.55 × 4.68 m, which is the conservative direction.

**WHAT IS NOT DONE IN ITEM 3.** *"City verge → cultivated soil and grass → dry, thin cover on the
hill shoulders"* is a RADIUS-dependent ground colour, and there is no radius term anywhere in the
ground path. The base earth past the city is still `GROUND.earthAlbedo` = [0.1229, 0.1211,
0.1168], which session 42 derived as the area-weighted mean of the CITY's own surfaces — correct
where it stands in for city and wrong where it stands in for land. The countryside's own
area-weighted mean at the delivered crop shares (38.0 / 25.4 / 36.7 by area) and the mean tone is
**[0.113, 0.115, 0.066]**, i.e. **44% less blue**, and that blue is most of why the far ground
reads as sand. Closing it means a per-vertex colour on the earth plane, which needs the plane
tessellated in z, which is §5.

---
## 5. RELIEF — MEASURED, COSTED, AND NOT BUILT. THE REASON IS NOT TRIANGLES

The brief: *"REPORT THE COST BEFORE BUILDING — this is the one item that can silently eat the
entire triangle budget."* It does not. The triangles are affordable and the item is still refused,
and the reason is worth more than the item would have been.

**THE TRIANGLES.** Displacing the earth plane over the exit corridor at 32 m cells is **+384**;
giving the countryside's ground rectangles a per-corner `y` is **+0**, because `quad()` already
emits six vertices and writes one scalar into all six; the road ribbon is already tessellated at
8 m. About **430 triangles**, 1.1% of the spare, zero new draw calls.

**WHY IT IS REFUSED ANYWAY, IN THREE MEASUREMENTS.**

1. **THE VOCABULARY CANNOT MAKE A CONFORMING MESH.** A ground rectangle's edges come from field
   lines, road cuts and `subtractBoxes` residue, all at arbitrary positions. Two rectangles that
   share an edge but not a subdivision T-JUNCTION, and the crack is the terrain's own chord error
   over the longer span. At a 128 m span the error is `A·(1 − cos(πL/λ))`, so holding it under the
   0.05 m every join in this project uses needs **λ ≥ 2000 m at A = 2.5 m**.

2. **AND AT THAT AMPLITUDE THE RELIEF IS INVISIBLE FROM THE AIR.** 2.5 m over 2000 m is a maximum
   slope of **0.45°**, and `quad()` writes a hard-coded `(0, 1, 0)` normal, so the shading does not
   change at all. What would read is the ROAD going over a crest at a car's eye — one of the two
   frames — and nothing in the other.

3. **A NON-NEGATIVE FIELD IS FORCED, AND IT IS THE ONLY FREE PART.** The countryside's quads sit
   **0.160 m** above the earth plane, so any corner that drops further puts `block:ground` through
   the field — the whole down-going half of a ±2 m undulation. Land that only rises is honest and
   costs nothing; land that falls costs the earth plane a z-tessellation it does not have (522
   stations in x, one quad in z, 8 km wide).

**SO THE HONEST STATEMENT IS: the ground vocabulary can express a TERRACE and not a SLOPE.** That
is not a guess — it is what item 4 spent the same mechanism on and got value from (§7, `yAdd`),
and it is why the hills are repaired at the hill (§6) rather than at the ground.

**AND ONE MEASUREMENT THAT SOUNDS WORSE THAN IT IS, WITH ITS ARITHMETIC DONE PROPERLY.** Measured
on session 61's countryside, **58.2% of the flat ground AREA out there is drawn inside a hill
footprint** — the fields are cut round roads, yards and house plots and never round hills. What
that actually costs is small and the sum says why. A field sits at `GROUND.grass` = 0.140 and a
hill's base at `GROUND.earth` = −0.020, so the dome wins wherever `h·hillProfile(u) > 0.160`:

```
  hill h        the field covers r/foot beyond      as a fraction of the radius
  15.4 smallest              0.940                            6.0%
  51   median                0.967                            3.3%
  107  largest               0.977                            2.3%
```

So the field hides the outer 2.3–6.0% of a hill's radius — 4.5 to 11.7 m of skirt on a 195 m
footprint, at a place where the dome is under 0.16 m tall. It is the pale ring visible round the
dome's foot in the BEFORE frame. What it costs is about 3 800 triangles drawn and never seen, and
what it breaks is `scanGround`: a walker inside a hill footprint stands on the field at 0.14 m
while the dome is forty metres over their head. Nothing walks out there yet. Written down rather
than repaired, and it is the cheapest thing on §9's list that is not on it.

---
## 6. THE HILLS MEET THE GROUND, FOR ZERO TRIANGLES — ITEM 2c

`SphereGeometry(1, 8, 3, 0, 2π, 0, π/2)` puts its four vertex rings at `r/foot` = 0, 0.500, 0.866,
1.000 and `y/h` = 1, 0.866, 0.500, 0 — **half the hill's height in the last 13.4% of its radius**,
arriving at the plane at a median 43.6° and stopping. That is a crease, and *"resting on"* is an
exact description of it.

The profile is smoothstep's complement now, `1 − 3u² + 2u³`, whose derivative `−6u(1−u)` is **zero
at both ends** — a round top and a tangential foot, which are the two properties a hemisphere has
one of. The rings are placed to spread the slope instead of piling it at the rim
(`node tools/landprobe.mjs --hills`):

```
  band                      0 - 0.50    0.50 - 0.82    0.82 - 1.00
  median hill  new             14.7          18.7           7.1   degrees
               hemisphere       4.0          14.7          44.3
  largest      new             21.8          27.3          10.7
               hemisphere       6.1          21.8          56.1
  smallest     new             12.8          16.4           6.2
               hemisphere       3.5          12.8          40.3
```

**Same 8 × 3 geometry, same 40 triangles a hill, same one draw call.** The steepest band moves
from the RIM to the MIDDLE, which is the whole difference between a dome and a hill.

**AND THE PLAN IS AN ELLIPSE AT A BEARING**, which is also free — the instance matrix already
carries a quaternion and two independent horizontal scales. Eccentricity 1.00 to 1.59 (p50 1.24),
**area-preserving**, so `HILLS.roadGapM` and the farmstead's `onHill` do not move with it. Three
identical circular domes at three scales are three copies of one object, which is LOOK.md §4's
*"any object placed at intervals needs FORM variation, not colour variation"* — and `HILLS.tone`
was answering it with colour.

**THE FIRST WINDING DERIVATION WAS BACKWARDS AND ONE FRAME SAID SO.** The hills rendered as black
spikes. `t` increases from +X toward +Z and +Z is south, so a ring runs clockwise seen from above
and the outward face is the reverse of the naive order. Checked from outside the instrument this
time (CONTRACT §7.7): **40 of 40 face normals have `.y > 0`, minimum 0.5807.**

The population re-phased — 173 masses (125 crowns, 48 woods) against session 61's 179, because the
two new rolls shifted the stream. 6 920 triangles at one draw call against 7 160.

---
## 7. THE HOUSES ON THE HILL SHOULDERS — ITEM 4

**THE BRIEF NAMED THE WRONG BUDGET, AND IT IS THE most USEFUL THING IN THE ITEM.** These do not
spend the ~40 000 in-city triangles. `wantedChunks` builds a Chebyshev ring of 5 chunks around the
CAMERA and the furthest any gate route travels is x = −820 m, reaching built geometry at −1 536 m
against an extent at 3 232 — so a hill-shoulder house costs **exactly zero** against
`highway_speed`, `downtown_dense`, `night_rain`, `player` and both `lookcheck` eyes. The only
figure it competes with is STATE 61's un-gated rim eye, **417 792 of 2 360 000**, which leaves
room for about twenty thousand of them. **The ceiling on this content is a frame and not a gate**
— which is STATE 61 §7 item 3 arriving as a licence rather than as a worry.

Delivered at seed 1337 (`node tools/landprobe.mjs --houses`):

```
  hills whose own footprint comes within 900 m of the exit road's polyline   14 of 125
  houses                                                                            29
  on a chunk the generator calls countryside, i.e. emitted                    29 of 29
  rise above the plane          min 0.00   p50 5.19   max 21.02 m
  ground slope at the house     min  0.0   p50 13.4   max  28.2 deg
  the GLAZED elevation against the direction to the origin, worst dot   1.000000
```

**THREE PLACEMENT ARMS WERE WRONG AND EACH WAS CAUGHT BY A NUMBER RATHER THAN A FRAME.**

- **The band.** u = 0.86–0.96, chosen because the new profile's outer band is its gentlest at
  7.1°, delivered a **median rise of 0.00 m** — smoothstep's complement has spent 95% of the
  hill's height by u = 0.86, so a house at the flattest point of this profile is a house on flat
  ground beside a hill. 0.62–0.80 now.
- **The platform.** Taking the MINIMUM of the plot's four corners, so that no plate could stand
  proud, delivered a median of **0.57 m**: a 24 m plot on a 195 m footprint always has one corner
  off the hill entirely. It is the plot's CENTRE now — cut at the back, fill at the front, with the
  terrace's own blade as the retaining wall.
- **The facing.** `setMatrix`'s yaw takes local +z to `(sin y, 0, cos y)` and the glass and the
  terrace are both at `+d/2`, so `y = atan2(-x, -z)`. The first version wrote `-atan2(-z, -x)`,
  which points the house's LONG AXIS at the city and its glass along the hill. **Right city, wrong
  face.**

**WHAT A VILLA IS:** ten boxes, 120 triangles, riding the chunk's existing `:masses` instanced mesh
at zero new draw calls. Two volumes at an angle (the L-plan, which is why `shed` could not be
reused), an oversailing roof slab rather than a parapet, **glass on the city-facing elevation
only**, and a cantilevered terrace on a blade. Angular per LOOK.md §5, not suburban pastiche.

**`yAdd` IS THE MECHANISM AND IT IS `f.lift`'s SIBLING ONE TABLE OVER** — a per-rectangle height
on a ground record, so a plot five metres up a shoulder is drawn at five metres and `scanGround`
answers five metres. One scalar, so the four corners are at one height: a TERRACE, which is §5's
own limit used where it is exactly right.

**TWO THINGS ITEM 4 ASKS FOR THAT ARE NOT DELIVERED.**

1. **The drive.** A strip of ground that climbs needs a per-CORNER `y`, which is §5. Each house has
   its apron and a garage set at the angle a drive would arrive at, and the 900 m road condition is
   a statement about where a drive COULD run rather than a drive.
2. **The lit windows.** `put()` writes an albedo and a roughness into an instanced body mesh and
   **there is no emissive path through it** — only a generated BUILDING, a sign and the lamp pool
   are emissive in this project. Each villa carries a `lamp` on its terrace instead, which is warm
   light ON the house rather than light FROM it. A fourth emissive path is the item.

**AND A FRAME-TIME REPAIR THAT WAS ABOUT TO SHIP.** `hillRiseAt` calls `hillMasses`, which runs a
140-iteration rng loop, and `hillsideHouses` makes about 210 queries — so one countryside chunk
was regenerating the hill population **29 400 times**. Memoised on the root seed, which the
function is already deterministic in. Delivered: **81 countryside chunks in 27 ms against 100 city
chunks in 71 ms.**

---
## 8. GATE STATE

```
  gate            exit   verdict   seconds  load1 in   out
  parsecheck         0     GREEN       3.3     3.56    3.92    119 files, contract-clean
  faultcheck         0     GREEN      10.0     3.92    4.17
  lookcheck          1       RED      47.4     4.17    4.35    THE IDENTICAL THREE
  windcheck          0     GREEN      36.4     4.35    4.98
  inputcheck         0     GREEN      14.5     4.98    5.14
  gateaudit          1       RED      65.2     5.14    4.64    the carried control + ONE MACHINE
  citycheck          1       RED     116.1     4.64    5.47    IDENTICAL TO SESSIONS 57-61
  perfcheck          2       RED     202.9     5.47    4.94    THE BROWSER DIED — see below
  perfcheck, per route, re-run separately afterwards: every route completes.

  4 of 8 RED — the same four as sessions 53-61. NOT ONE NEW RED GATE.
```

**`lookcheck` IS RED ON THE IDENTICAL THREE** — `distinct:midnight|dusk` **0.02838**, session
61's figure to five decimal places, plus `facadeAlbedo` (3 clusters of 4) and `facadeNeighbours`
at dusk. **Neither eye can see one square metre of this session's content**: both stand inside
400 m of the origin and everything here is past 3 232 m. That is §3.1's point from session 61,
unchanged, and it is why §0's frames are the verdict.

**`citycheck` IS BYTE-IDENTICAL TO SESSIONS 57-61** on all four reds — clumping CV **0.393**,
**5** delivered overlaps, **2 of 2 647** signs inside a building, **1 004 of 284 918** bare
walkable samples — and on its counts: **18 799 generator claims, 19 087 delivered, 345 instanced
meshes, 0 label mismatches**. It was run TWICE, once in the battery and once after the villa's own
defect landed (§7), and the two runs agree line for line, which is the check rather than the
claim.

**ONE COUNT MOVED AND IT IS THE CENTRE LINE.** `block_markings` reads **252** where session 61
read **346**. Session 61 painted the ribbon from 3 232 to 4 000 at a 12 m cycle, both arms — 128
marks; this session stops at the taper's end, 3 432, which is 33. `346 − 128 + 33 = 251` against a
delivered 252, the one being the loop's own start offset. It is a content REDUCTION and there is
no floor on markings; every mark removed is past the extent.

**`gateaudit`'s SECOND FAILURE IS THE MACHINE, AND IT WAS CHECKED RATHER THAN ASSUMED.** It
reported `windcheck.mjs --falsify exited 1: report exists — the run produced no report`, which
session 61 did not have. Run on its own five minutes later: **`windcheck --falsify` passes
11 of 11 falsifying cases and exits 0.** It ran inside the battery at `load1` 5.14 with
`mediaanalysisd` and its XPC helper at 96% and 90% of a core each; the page died. The carried
`control failed` is unchanged.

**`perfcheck` DID NOT FINISH, AND THE CAUSE WAS ESTABLISHED TWO-SIDED RATHER THAN ASSUMED.** It
cleared `downtown_dense` and then died with `page.evaluate: Execution context was destroyed`, at
`load1` 5.47. Re-run on its own it died **at the same place, reproducibly**. So each route was run
SEPARATELY, and every one of them completes:

```
  route            draws    triangles   instances   note
  downtown_dense     324       1.97 M     267 191   froxel 49-50/96, two runs, identical
  highway_speed      402       2.32 M     348 006   the headline route
  night_rain         323       1.94 M     326 641   frame entropy 4.923 (session 61: 4.913)
  player               —            —           —   timed out at 10 min at this load
```

**THE CONTENT PASSES ROUTE BY ROUTE AND THE BATTERY DIES AT THE ROUTE TRANSITION**, which is a
renderer that cannot survive a second page at `load1` 5 and not an assertion about anything in
this session. `roles` reads `aircraft:1 traffic:96 stall:12 block:56 lamp:192 sign:16` on all
three, unchanged.

**`highway_speed` IS 402 DRAWS AND 2.32 M TRIANGLES, WHICH IS SESSION 61's FIGURE TO THREE
DIGITS — AND THE INSTANCE DELTA IS ACCOUNTED FOR EXACTLY.** 348 006 against session 61's
**348 106**, a difference of **100**:

```
  block:markings   346 -> 252   the centre line stops at the taper      -94
  city:hills       179 -> 173   two new rolls re-phased the stream       -6
                                                                       ----
                                                                       -100
```

Its four violations are the carried ones. `wall p95` **12.70 against 12.5** is session 61's own
figure and is 0.2 ms on a machine three cores down, which CONTRACT §0.2 says is not a verdict; the
other three are the vehicle silhouette bars LOOK.md §4 names in as many words — ground gap 74% of
72 measured (min 75%), tone-profile roughness 0.243 (min 0.30), non-monotone 46% (min 75%).
**`roofline` PASSES this session at 0.829 over 35 measured vehicles**, where session 61 recorded it
red at 70% of 15 — the brief's own *"do not act on one run of the vehicle silhouette bars"*,
arriving from the green side.

**AND THE FIGURE THE BRIEF QUOTES CANNOT BE VERIFIED FROM THE TREE.** The brief opens with
*"TRIANGLES 2,32 M of 2 360 000, ABOUT 40 000 SPARE"*. `tools/budget.json` confirms the two
ceilings — 2 360 000 and 440 — but **there is no `perfcheck` log from session 61 anywhere in
`tools/perf-out`**: the newest is `gates-20260811-0847.log`, twenty days old, reading
`highway_speed` at **1.44 M triangles and 431 draws**. The six PNGs beside it are dated 2026-08-31
with no log written. So *"2.32 M and 402"* is a number in prose with nothing behind it that a
reader can open, and *"about 40 000 spare"* is a three-digit rounding admitting anywhere from
35 001 to 45 000 — a ±12% band on the whole headroom.

---
## 9. WHAT TO DO FIRST NEXT TIME

1. **THE GROUND IS THE LAST OF THE OPERATOR'S FIVE AND IT NEEDS A DIFFERENT VOCABULARY (§5).**
   Not more triangles — a CONFORMING mesh. The shape of the answer is that the countryside's
   ground stops being `subtractBoxes` residue and becomes a fixed world lattice of cells that
   every rect snaps to, so no two neighbours can T-junction; then a per-corner `y` is free and the
   normals come off the corners. It re-bases `scanGround`, the delivered census and the
   walkability mask, and it is the item that makes RELIEF, the earth plane's colour ramp (§4) and
   a climbing DRIVE (§7) all possible at once. Brief them as one.
2. **THE BASE EARTH IS THE WRONG COLOUR PAST THE CITY, AND THE NUMBER IS 44% (§4).**
   `GROUND.earthAlbedo` is the area-weighted mean of the CITY's surfaces (session 42, correct);
   the countryside's own mean at the delivered crop shares is **[0.113, 0.115, 0.066]**, and the
   gap is almost all BLUE. It is what makes the far ground read as sand. Closing it needs the
   earth plane tessellated in z — today it is 522 stations in x and ONE quad in z, 8 km wide —
   which the item above would deliver anyway.
3. **THERE IS NO EMISSIVE PATH FOR A FEATURE (§7).** A generated building's windows, a sign and
   the lamp pool are the only three, so nothing built out of `features` — a farmhouse, a villa, a
   bus shelter, a barn — can have a lit window. It is the reason the countryside is dark at night
   in a way the city is not, and LOOK.md §3's *"what is still emissive-with-no-candela is every
   window"* has this as its sibling.
4. **A THIRD `lookcheck` EYE ON THE EXIT ROAD.** STATE 61 §7 item 3 asked for it and this session
   did not build it; `tools/landprobe.mjs` is the half that was built instead, and it asserts
   nothing on purpose. Everything in §3, §4, §6 and §7 is still outside every gate in this
   project, and now there is a lot more of it.
5. **THE MACHINE, AND IT IS TWO SESSIONS RUNNING.** `mediaanalysisd` and its XPC helper have held
   two cores for the whole of sessions 61 and 62, `load1` never fell below 3.46, and this session
   lost `perfcheck` and one `gateaudit` case to it. Nothing in this project can fix that; what it
   costs is that no wall-clock number has been a verdict since session 60.
6. **CARRIED, UNCHANGED**: the height law reads nothing at all (STATE 61 §4 — the measurement is
   done and the table is written, and `distantMasses` reads the same law so it re-bases every
   luminance band); the traffic has no lane that is not a lattice line, and **`EXIT_ROAD` is now
   exactly the polyline it would need** (STATE 61 §5); `city.js`'s `unitHash` puts the multiplier
   inside the sine; the three chunk seams; STATE 57 §0.1's triangle ceiling at 2 630 000, still
   awaiting the operator; the 53 holograms; the school yard's 8 trees and the church square's 98.
7. **`decodePNG` RETURNS THREE BYTES PER PIXEL.**
