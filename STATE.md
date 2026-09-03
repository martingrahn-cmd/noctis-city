# NOCTIS — STATE

*End of session 72. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`, 15 d 14 h of
uptime — the same boot as sessions 47–71. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` RAN 3.28–5.85 THROUGH THIS SESSION***, over CONTRACT §0.2's bar of 1.6 for the twelfth
session running. **No millisecond below is a verdict.**

Branch `claude/noctis-72-the-ground-the-harbour-stands-on`, off session 71's head.

**MATERIALS AND ONE FENCE.** No mesh was added. Four ground kinds, one terrain term, twenty fence
segments.

---
## 0. THE CAR-HEIGHT FRAME, WHICH IS THE QUESTION

`node tools/lookat.mjs --preset=sea-road --t=0.42` is the operator's own frame: a car's eye at the
branch road, 40 m landward of the yard's edge, looking at the quay — so its whole foreground is the
ground the port stands on. **The operator: *"the grass runs to the quay edge"*, and *"the wet patch
in the foreground reads as a puddle in a field."*** Both were true and both are measured below.

Sampled at five columns across the boundary between the port's plate and the ground beside it:

```
                       col 400   600     800    1000    1200
  BEFORE   plate  Y    0.5163  0.4847  0.4110  0.3921  0.4134     sat 0.131 -> 0.055   hue 221 -> 340
           ground Y    0.3366  0.3403  0.3355  0.3364  0.3392     sat 0.326 -> 0.344   hue  70
           the luminance STEP across the edge:
                       0.1668  0.1410  0.0463  0.0589  0.0384

  AFTER    plate  Y    0.3512  0.3434  0.3403  0.3434  0.3470     sat 0.074            hue 351
           ground Y    0.4035  0.4083  0.4043  0.4080  0.4080     sat 0.355 -> 0.366   hue  50
           the luminance STEP across the edge:
                       0.0612  0.0612  0.0414  0.0540  0.0372
```

**The step at the near end fell from 0.167 to 0.061 — 2.7×** — and the plate is now DARKER than the
ground it sits in rather than half again brighter, which is what a wet surface beside dry ground is.
The ground it sits in is no longer pasture: hue 70 → 50, and it is the port's own worn ground.

---
## 1. THE MEASUREMENT CHOSE THE INSTRUMENT, AND IT IS NOT SESSION 65's ANSWER

The brief asked for both and for a verdict on which decided it. On the five columns above, as ratios
of plate against ground:

```
  luminance   1.53   1.42   1.22   1.17   1.22      <- CONVERGES with distance
  saturation  2.49   2.52   3.51   8.64   6.25      <- DIVERGES
```

**CHROMA DECIDED IT — session 64's answer, not session 65's.** At the far end of the same edge the
two surfaces are **1.17× apart in luminance**, which is inside what `FARM.toneMin/toneMax` already
rolls a parcel by (0.82 to 1.12), and **8.6× apart in saturation**. The reason is physical and it is
also item 3's: a wet impervious surface is a mirror, so it goes neutral and takes the sky's hue —
221 near the camera, 330 far away — while vegetation stays chromatic at hue 70 the whole way.
Luminance is the axis this pair happens to share; saturation is the axis they cannot.

So the margins were built to bridge SATURATION, and their luminances are what the mix makes them.

### 1a. THE THREE MARGIN MATERIALS, EACH A MIX OF TWO ALREADY MEASURED

A port margin is not a new material. It is the two materials that made it — the aggregate that was
laid and the ground it was laid on — so each band is a linear mix at a stated fraction and no fourth
reflectance is invented to be defended:

```
  band     mix                             Y        sat     porosity
  gravel   0.35 of tilled into yard      0.1448    0.160     0.94
  worn     0.70 of tilled into yard      0.1206    0.276     0.30
  scrub    0.55 of field into grass      0.1324    0.483     1.00

  the bridge:  yardGround 0.070 -> 0.160 -> 0.276 -> 0.483 -> grass 0.521
  what it did: luminance  0.169 -> 0.145 -> 0.121 -> 0.132 -> 0.084   (not monotone, not chosen)
```

**THE POROSITY IS NOT MONOTONE EITHER AND SHOULD NOT BE.** Rough grass drains — session 55's turf at
1.00. Rutted ground with the surfacing worn off it PONDS: it is a building site's compacted hardcore,
which this project already measures at 0.30 and which is borrowed rather than restated. Loose crushed
stone drains freely again. **So the margin has its wet band in the middle of it, which is where a
port's puddles are.**

### 1b. AND THE GRADIENT READS — ON THE AERIAL, WHICH IS THE POSE THAT CROSSES IT

`harbour-air`, row 640, scanning outward from the terminal into the fields:

```
                  x 1200      x 1300      x 1400
  BEFORE  sat     0.278       0.303       0.336
  AFTER   sat     0.231       0.320       0.347
```

Before, the crop's saturation was already near its full value one pixel outside the plate. After, it
**dips to 0.231 at the port's edge and climbs back to the crop's 0.347** over the next 200 px — which
is the gradient item 1b asked for, in the axis §1 measured to be the tell.

### 1c. THE COUNTRYSIDE STILL ARRIVES

The port's cover is blended into the TERRAIN's own per-vertex tint by `portGroundAt`, which is
`groundTint`'s hill-cover term one paragraph down applied to a quay — *"so a hill's foot is a band of
scrub running out into the fields, and there is no line anywhere for the eye to read as an edge."*
The port joins the session 62–65 sequence by the same mechanism instead of interrupting it with a
rectangle. It composes BEFORE the hill and the strand, so a hill's foot may run into a port's margin
and the shingle still wins at the waterline.

### 1d. AND THE TERRAIN'S OWN NYQUIST IS THE LIMIT ON ALL OF IT

The first arm wobbled the band boundaries at a 54 m period and rolled a tone at 19 m, and **the frame
showed neither.** `TERRAIN.stationM` is **32 m**, so the terrain's per-vertex colour cannot carry a
feature finer than **64 m**: 19 m is below that outright and 54 m is 1.7 samples a cycle. Both were
aliased into a flat wash — which is exactly what the brief warned about, *"a single new flat colour
would be the same mistake in a different hue"*, arriving through the sampling rather than through the
choice. They are 96 m and 150 m now.

**THE NEAR FIELD CANNOT BE FIXED THERE AT ALL, AND THE FRAME STILL SAYS SO.** Down the `sea-road`
foreground the ground's luminance ranges 0.4035 to 0.4083 — **1.2 % over the whole visible column**,
against 1.4 % before. The colour changed; the uniformity did not. Two reasons, both measured: the
32 m lattice, and the fact that this camera stands 40 m INSIDE a 96 m margin and therefore looks
along it rather than across it. **Near-field ground texture needs a scatter or a texture, and this
session shipped neither** — §5 item 1.

---
## 2. THE PLATE, THE SPUR, AND WHY THEY ARE NEW KINDS

```
  kind          albedo                porosity   what it is
  portApron     yardGround's exactly    0.455    heavy-duty brushed concrete
  portGravel    PORT_ALBEDO.gravel      0.940    the yard's 13 m shoulder strip
  portWorn      PORT_ALBEDO.worn        0.300    the terrain margin's middle band
  portRoad      road's exactly          0.700    the harbour's access spur
```

**`portApron`'s 0.455 IS DERIVED AND ITS SENSITIVITY IS STATED.** `EXIT_ROAD`'s own comment carries
the model — `porosity = 1 − MTD_ref / MTD`, anchored on dense-graded city asphalt at MTD 0.6 mm — and
says infiltration *"cannot separate a city arterial from a rural chip seal at all"*, which is exactly
this class. Heavy-duty brushed concrete is MTD 0.9–1.3 mm, so **0.33 to 0.54, and 0.455 is the centre
of the class.** The gravel is a CHECK of the kind session 65's sward was: infiltration puts crushed
stone over 100 mm/h against this city's 10 mm/h full rain, i.e. 1.00, and the relief model puts it at
0.94 — two derivations, 6 % apart, neither fitted to the other.

**THEY ARE NEW KINDS AND NOT CHANGES TO `yardGround` AND `road`**, and session 71 is why:
`yardGround` is *"the surface `yard`, `industrial` and `port`"*, so giving it a porosity would have
re-sheened every car park in the city for the harbour's sake — the flood-mast head one session later.

---
## 3. ITEM 3, AND PREMISE (ii) IS FALSE

> *(ii) that the wet patch is item 1's defect rather than its own*

**FALSE. It was its own, and it was the branch road.** The wedge in the operator's foreground is the
100 m ramp from the exit road up to the yard, and it was `kind: 'road'` — which falls through
`city.js`'s `porosityFor` to **0.0**, a full mirror at this project's wet convention. That value is
dense-graded city asphalt's and it is correct on an arterial. **This is a spur off the exit road**,
and session 65 measured that road at `1 − 0.6/2.0` = **0.70** from the same sand-patch model. A
hundred metres of rural spur was carrying a city arterial's sheen in the middle of a field, which is
what a puddle looks like.

`portRoad` reads `exitRoadPorosity` rather than a number, so the spur and the road it joins cannot
drift apart. **The wetness was not deleted** — the frame is still wet by convention and the road is
still glossy and dark; what went is the mirror.

---
## 4. ITEM 2 — THE FENCE, AND ITEM 1d's CENSUS

**Twenty segments** on the three landward edges, stopping 26 m either side of `branchX` so the
gatehouse session 71 built is the only way in. Posts every 3 m, a mesh panel that stops short of the
ground, a top rail, a raked barbed arm as two stepped boxes — `put` composes only a yaw and the
ground's pitch, so a rake is session 71's staircase at a twentieth of the scale — and a warning plate
on one bay in five. **ZERO draw calls: it rides the chunk's own `:masses` mesh**, which is premise
(iii) and it holds.

**IT IS NOT A REGISTRY CLAIM**, following the harbour's own precedent rather than a decision taken
here: session 66 wrote *"the rule is that water and its works are not claims"* and left the cranes,
the yard and the warehouses out. `inHarbourAt` already keeps every countryside scatter off this
ground, so nothing can grow through it.

**`roughcensus` READS 30 DISTINCT SURFACES, 39 CONSTRUCTION SITES, 0 UNCLASSIFIED, 0 IMPERVIOUS BY
DEFAULT, and 4 rows crossed with 0 disagreements — unchanged from session 65, because this session
added NO MESH.** And the reason it is unchanged is worth writing down: **its unit is a
`new THREE.Mesh(` construction site and it cannot see a ground KIND at all.** What classifies a kind
is three tables in `city.js`, and all four new kinds are in all three:

```
  GROUND_ALBEDO         fall-through is walkAlbedo — an unmapped kind renders as PAVEMENT
  porosityFor           fall-through is 0.0        — an unmapped kind is a MIRROR
  CATEGORY_FOR_GROUND   unmapped matches no CATEGORY — the surface CLAIMS NOTHING (session 31)
```

Three silent fall-throughs, all of them plausible-looking, and the census sees none of them. That is
the shape of session 64's `block:ground` defaulting to (0,0) since session 1, one table over.

---
## 5. GATE STATE

**ALL EIGHT RAN. `perfcheck` COMPLETED THE WHOLE BATTERY FOR THE SEVENTH SESSION RUNNING.**

```
  gate            exit   verdict   seconds  load1 in     out
  parsecheck         0     GREEN       3.6      3.97    3.89
  faultcheck         0     GREEN      28.6      3.89    3.86
  lookcheck          1       RED      50.8      3.86    3.55    THE IDENTICAL THREE
  windcheck          0     GREEN      40.4      3.55    5.85
  inputcheck         0     GREEN      17.6      5.85    5.72
  gateaudit          1       RED      78.5      5.72    4.62    the carried `control failed`
  citycheck          1       RED     127.5      4.62    5.85    IDENTICAL TO SESSIONS 57-71
  perfcheck          1       RED    1102.6      5.85    4.51

  4 of 8 RED — the same four as sessions 53-71. NO FIFTH RED.
```

**THE TWO CONSTRAINTS DID NOT MOVE AT ALL, WHICH IS MORE THAN THE BRIEF ASKED FOR** (*"both numbers
should barely move"*):

```
  highway_speed   401 draws of 440              IDENTICAL TO SESSIONS 67-71
                  2 451 648 tris of 2 630 000   IDENTICAL TO SESSIONS 67-71
```

Four ground kinds and a twenty-segment fence cost nothing, because a ground kind is per-vertex
attributes on one merged `city:ground` mesh and the fence rides the chunk's own `:masses`.

**`citycheck` IS BYTE-IDENTICAL TO SESSIONS 57–71 ON EVERY COUNT:** clumping CV **0.393**, **5**
delivered forbidden overlaps, **2 of 2 647** signs inside a building, **1 004 of 284 918** bare
walkable samples, occupancy **18 799 / 19 087**. The harbour is 3.5 km outside its region and the
four new kinds are emitted nowhere else.

`lookcheck`'s three are `distinct:midnight|dusk` at **0.02846** against 0.03, `facadeAlbedo` and
`facadeNeighbours` — the same three at the same numbers as sessions 53–71.

**EVERY `perfcheck` VIOLATION IS CARRIED OR IS A TIMING ABSOLUTE FROM A LOADED MACHINE**, at `load1`
**5.85** against CONTRACT §0.2's bar of 1.6. The non-timing ones:

```
  downtown_dense  frame entropy  4.975   floor 5
  highway_speed   dark gap at the ground   71% of 59 vehicles   floor 75%
  highway_speed   non-monotone tone        54% of 59 vehicles   floor 75%
```

The silhouette bars have read 75/52 over 71 vehicles, 70/58 over 64, and 71/54 over 59 across
sessions 70–72 with nothing in the routes changed — which is the sampling population
`silhouettes.$estimator` already describes.

---
## 6. WHAT TO DO FIRST NEXT TIME

**1. THE NEAR-FIELD GROUND IS STILL ONE FLAT COLOUR AND THE REASON IS MEASURED.** 1.2 % of luminance
range over the whole visible foreground of the car-height frame. The terrain's 32 m vertex lattice
cannot carry anything finer than 64 m, and ground RECTANGLES cannot help either — they are flat at
one `y` and the terrain outside the harbour is not, which is why session 63 replaced the
countryside's quads with the terrain mesh in the first place. **What is left is a scatter** — stones,
tufts, rubble, spoil as instanced boxes through `put()`, which costs no draw and is the vocabulary
the yard and the hedgerows already use. That is the next honest step and it is not a big one.

**2. NOTHING HAS BEEN LOOKED AT FROM THE SIDES OR THE BACK.** The margin runs 96 m out on three
edges and only two poses look at any of it. A camera east of `x1` or south of the fence would say
whether the bands read as bands or as a halo from any angle but the aerial's.

**3. THE MOORED HULLS STILL HAVE NO NAV LIGHTS** — session 71's own §6 item 2, untouched.

**4. THE TWO SESSION-70 ITEMS, BOTH STILL TRUE.** `perfcheck` captures with no `settle()`, so its
frames are the only ones in the repo that are not phase-normalised; and its entropy floor is a §0.1
case in the open. The four `trade-*` look frames still differ run to run, entirely in the vehicles.

**5. THE SEAM AND THE RIVER BLEED.** Session 70 measured the sea seam at five poses and found `span`
takes the river at 130 m from a pavement. Untouched by instruction for two sessions now, and still
the largest live defect in the water.
