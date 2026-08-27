# NOCTIS — STATE

*End of session 46. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`. The machine has
**NOT** rebooted since session 40 — 9 d 1 h of uptime at the last command against session 45's
8 d 2 h, the same boot. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` RANGED 3.0 TO 12.7 ACROSS THE SESSION*** against CONTRACT §0.2's bar of **1.6**, and the
session was almost entirely browser work — twenty-two browser boots, five `citycheck` invocations,
one `lookcheck`, one `perfcheck`, one `gateaudit` and one each of `windcheck`, `faultcheck` and
`inputcheck`. **NO MILLISECOND IN THIS FILE IS ADMISSIBLE IN EITHER
DIRECTION.** What is quoted is COUNTS (draw calls, triangles, instances, claims, populations),
PIXEL STATISTICS off delivered PNGs, RATIOS INSIDE ONE FRAME, and arithmetic with no browser in it.

**THE OPERATOR GAVE SIX DEFECTS FROM ONE SPAWN AND THIS FILE OPENS WITH THEM.** Every one was
measured before anything was changed.

- **FOUR WERE REAL AND ARE REPAIRED** — the haze seam, the lamps in the road, the lamps built
  wrong and the viaduct's footings (items 1, 4, 5, 2). Two of the four were about half the street
  lamps in the city.
  The fourth of them is item 2, and **the table the brief asked for is what found it**: six of
  the eight landmarks put not one box outside their own claim, and the thing standing in a road is
  the VIADUCT'S PIER FOOTING — 2.6 m square where the placement cleared 0.8. Repaired after a
  sweep, because the same constant also caps the search band it is searched in.
- **ONE IS REAL, IS MEASURED, AND THE NUMBER SAYS THE OBVIOUS KNOB IS THE WRONG ONE** (item 6).
- **ONE IS FALSE.** The delivered geometry is the right way round in 392 of 392 places (item 3),
  and what he is looking at is fifty millimetres of gap, which is worth naming.

**AND THE SESSION'S OWN BEST FINDING IS NOT ONE OF THE SIX.** Giving the street lamp a registry
claim — because item 4 asked *why does the registry not forbid this* — made `citycheck` report
**twenty-six forbidden overlaps in the delivered scene where there had been two**, eight of them a
defect as old as the advertising pillars and invisible for as long. §2.

    ?player=1&spawn=188.72,91.73,-8.33&t=0.5362&seed=1337

---

## 0. THE SIX

### 1. THE HAZE HAS A HARD EDGE — TRUE, REPAIRED

**It is the sky dome meeting the ground plane, and none of the other three candidates.**

Raycast through the delivered scene at the operator's own spawn, yaw 180, pitch −8, fov 60,
t 0.5362, at x = 340 px:

```
  y <= 286 px   NOTHING — the ray misses the world entirely and the sky dome is what is drawn
  y  = 288 px   block:ground at 4123.23 m, world [1966.77, -0.02, 3710.70]
                albedo [0.1229, 0.1211, 0.1168] = GROUND.earthAlbedo
```

So the "flat wash" is **`block.js`'s 8 km earth plane** and the seam is **its own rim**, 4.1 km
away, one pixel past which there is no more ground. Not the aerial perspective failing, not the
residency ring (which ends at 1 280 m, three kilometres nearer), and not session 43's scattering
term, which is in the frame and working.

**WHAT MADE IT A SEAM RATHER THAN A FADE IS ONE `clamp`.** `lights.js` → `HAZE_FRAGMENT` mixes the
surface toward the sky by `f = 1 − e^(−τ)`, and the sky it mixes toward is scaled by

```glsl
  float openness = mix(uNoctisHazeOpen, 1.0, clamp(wdir.y * 5.0, 0.0, 1.0));
```

`wdir.y` for a ray to that rim is **−0.022**, so the clamp is exactly **0** and the in-scatter is
multiplied by the CANYON's roadway sky-visibility — 0.511 at that pose — while the sky one pixel
above it is the dome at full strength. The eye was 91.73 m up. There is no canyon.

Delivered before, as a scanline at x = 340: **sky 141.3 code values (161,142,121), ground 103.7
(120,104,87), a 37.6 cv step in two pixels.**

**THE RAMP GAINS A SECOND TERM AND IT IS THE EYE'S HEIGHT.** Zero below six storeys (21.6 m,
LOOK.md §2's own bottom of the height band) and one above the 60 m the block already calls *"above
every parapet"*. Measured as the ground band over the sky band immediately above it — a ratio
inside one frame, which is the only exposure-invariant thing a screenshot carries:

```
                   ground / sky        frame mean
  aerial south   0.8376 -> 0.9774    124.31 -> 124.83
  aerial east    0.7940 -> 0.9880    125.61 -> 125.79
  aerial west    0.7675 -> 0.9102    119.82 -> 120.55
```

**AN `abs(wdir.y)` ARM WAS MEASURED AND REJECTED**, which is the part worth carrying forward. It is
the obvious repair and it is wrong: the symmetry argument holds only for a ray that STARTS above
the parapets, and from 1.7 m a ray 11° down meets the road in nine metres and never leaves the
canyon. It moved the street frame mean 123.898 → 126.103 and its road band 140.13 → 145.90, +4.1%,
on a pose nobody complained about — and it closed the seam only to 0.8616 where the height term
alone reaches 0.9774 against a forced-open 0.9778. **Below 21.6 m the shipped term is exactly
zero**, so a person standing in a street is measured at exactly `uNoctisHazeOpen` and nineteen
sessions of luminance bands keep their subject. `lookcheck`'s four bands moved by 0.0001, 0.0000,
0.0001 and 0.0001.

The rim cannot vanish entirely and the arithmetic says why: τ at 4 123 m is 1.7086, so f is 0.8188
and **18% of the pixel is still the ground**. Closing the last of it means a bigger plane, not
more air.

    localhost:5173/?player=1&spawn=188.72,91.73,-8.33&t=0.5362

`s46-recon-{s,e,w}.png` before · `s46-haze-after-{s,e,w}.png` after ·
`s46-hazesweep-*.png` the six sweep arms

### 2. THE LANDMARK OVERHANGS THE ROAD — TRUE OF ONE, MEASURED FOR ALL EIGHT, REPAIRED

The brief asked for delivered extent against claimed extent for every landmark. Read off the
DELIVERED meshes — every instance matrix in `landmark:*` and every lathe's world bounding box —
against `landmarkGroundClaims`, resident ring at seed 1337:

```
  landmark    claimed plan    delivered plan   ANY box outside      over a    outside AND UNDER
              (x, z) m        (x, z) m         its own claim        road      5.1 m of headroom
  condenser   124.0 x 124.0   124.0 x 124.0    0.0 m /    0            0      0.0 m /   0    0
  stack        79.1 x  79.1    78.8 x  78.8    0.0 m /    0            0      0.0 m /   0    0
  arch        133.0 x  15.0   124.5 x  12.8  105.8 m /   76            0      1.1 m /   6    0
  viaduct     109.3 x 444.5   110.2 x 448.0   17.8 m / 1314          184      8.8 m / 152    9
  exchange     66.0 x  66.0    66.0 x  66.0    0.0 m /    0            0      0.0 m /   0    0
  weir        210.0 x 210.0   210.0 x 210.0    0.0 m /    0            0      0.0 m /   0    0
  mast         15.3 x  15.3    12.0 x  11.7    0.0 m /    0            0      0.0 m /   0    0
  dish         88.0 x  88.0    88.0 x  88.0    0.0 m /    0            0      0.0 m /   0    0
```

**SIX OF THE EIGHT ARE CLEAN AND SESSION 42's REPAIR HOLDS.** The condenser, the weir, the dish and
the exchange measure delivered = claimed to the tenth of a metre; the stack and the mast measure
under. **Not one box of those six is outside its own claim.** The `arch`'s 76 are its span, which
is open between two legs because that is what an arch is, and none of the six low ones is over a
road.

**AND THE VIADUCT IS THE ANSWER, AND IT IS NOT AN OVERHANG — IT IS A FOOTING IN THE GUTTER.** The
last two columns are what separate a bridge doing its job from a defect. A deck at 21 m over a road
is excluded from `landmarkGroundClaims` by name (`if (o.deck || l.kind === 'viaduct') continue`)
and is 175 of the 184 boxes. **The other nine are below 5.1 m of headroom, and they are these:**

```
  what                          w x d        y            how it overlaps a delivered carriageway
  7 x pier PAD FOOTING       ~3.3 x 3.3   0.0 .. 0.7 m    up to 1.04 m of the running surface
  3 x pier SHAFT             ~2.3 x 2.2   0.7 .. 17.1 m   0.20 to 0.40 m, at the kerb line
```

**THE CAUSE IS ONE LENGTH USED FOR TWO THINGS, WHICH IS CONTRACT §9 EXACTLY.** `citygen.js` places
a pier so that its LEG clears the kerb — its own comment writes the arithmetic out, *"leg centre =
CITY.roadHalfWidth + pierLegHalf = 7.5 + 0.8 = 8.3 m"* — and `legIsClear(leg, l.pierLegHalf)` is
*"the one predicate, so the search and the gate agree"*. **They do agree, and both are about a box
that is not the one drawn.** `city.js` builds the footing as `push(leg.x, footH/2, leg.z, 2.6,
footH, 2.6, p.yawDeg, …)` — **2.6 m square where the leg is 1.6**, yawed, so its axis-aligned
half-extent reaches 1.84 m against the 0.8 the placement cleared by. 8.3 − 1.84 = **6.46 m, inside
a 7.5 m carriageway**. The shaft is `legHalf·2 × legHalf·2.2` = 1.6 × 1.76, half-extent 1.19 m
yawed, which is the 0.2–0.4 m clip.

**AND `citycheck` PRINTS `0 leg(s) on a carriageway (max 0)` IN THE SAME RUN**, because it reads
the same predicate about the same 0.8 m. A gate and a generator agreeing about a box neither of
them drew is the shape STATE 45 found five times over in the two content paths, arriving through a
third door: **one path, one length, two objects.**

**REPAIRED, AND THE ARM WAS CHOSEN BY A SWEEP BECAUSE THE SAME CONSTANT CAPS THE SEARCH.**
`VIADUCT_LEG_OFFSET_MAX_M` = `CORRIDOR (11.70) − pierLegHalf (0.80)` = 10.9, so tightening the test
also narrows the band it searches, and `citycheck` asserts `0 blocked` over 23 piers with 6 already
nudged and 2 already hammerheads. Swept in the pure generator over the whole pier population before
anything was changed:

```
  clearance   hammerhead  nudged  blocked   footings in a road   worst
     0.80  <-      2          6       0            12            0.926 m
     1.00          2          6       0            12            0.680 m
     1.10          2          7       0            10            0.675 m
     1.30  <-      2          7       0             8            0.424 m
     1.50          3          5       4            11            3.930 m
     1.84          3          5       4             5            3.930 m
```

**1.30 is the largest clearance this deck carries with `0 blocked`, and it is `pierFootM / 2`
exactly** — the pad cleared SQUARE ON. The yawed worst case of `2.6·√2/2` = 1.838 m is
unreachable: four piers lose every solution because the offset band tops out at 10.9. **So the
residual is the yaw**, and it is bounded rather than argued away.

Delivered, on the same census that found it:

```
  before   3 SHAFTS (16.45 m tall) and 7 PADS in a carriageway, worst reach 1.04 m
  after    0 shafts and 7 pads,                                 worst reach 0.424 m
```

`citycheck` in the same run: 23 piers, 2 hammerhead, **7 nudged** (was 6), **0 blocked**, 0 legs on
a carriageway, worst |x| inside the block **9.94 m** against a band of 10.5 — improved from 10.40.
`city.js` reads `l.pierFootM` instead of its own literal now, so the clearance and the geometry are
one length with two readers. **What is NOT widened is the registry claim**, and that is F7.

**THE OTHER THING OVER A CARRIAGEWAY IS NOT A LANDMARK AT ALL** — `canopy`, the category
`occupancy.js` gives the part of a prop above 2.10 m, which *"conflicts with SOLIDS ONLY — a canopy
inside a wall is wrong and a canopy over a carriageway is a street tree."* Legal by that table, and
visible in two of this session's frames as a crown in the air over the running lane. F4.

### 3. IS THE STOP LINE ON THE RIGHT SIDE OF THE CROSSING? — YES, IN 392 OF 392 PLACES

**THIS ONE IS FALSE AND THE MEASUREMENT IS UNAMBIGUOUS.** Out of the pure generator, no browser,
over `citycheck`'s own 10 × 10 at seed 1337, as the near and far EDGES of the delivered paint
measured from the junction centre:

```
  DERIVED     stop bar   8.800 .. 9.200 m     CITY.stopLineFromJunctionM 9.0, barWidthM 0.40
              zebra      7.550 .. 8.750 m     CITY.crossingFromJunctionM 8.15, depth 1.20

  DELIVERED   392 junction approaches carrying both a bar and a zebra
              zebra entirely NEARER the junction than the bar     392 of 392
              bar entirely nearer the junction than the zebra       0
              the two overlapping                                   0
              gap, bar.near - zebra.far        min 0.050  mean 0.050  max 0.050 m
```

A vehicle approaches from outside, meets the bar at 9.0 m and stops; the zebra at 8.15 m is then
between it and the junction. **It stops BEHIND the crossing.** `stoplineprobe` says the same thing
from the vehicle's end over 12 signal cycles and 21 583 frames with someone held at a red:
`worstStopLineM` 0.000, `toStop` median 0.000, **no settled vehicle is ever past its own line.**
The origin block's own paint (session 45's R8) is the same order with this street's numbers —
zebra 6.55–8.75, bar 8.80–9.20.

**WHAT HE IS PROBABLY LOOKING AT IS THE 0.050 m.** The gap between the two marks is fifty
millimetres in all 392 approaches, so from a pavement the bar and the near edge of the zebra are
one continuous band of white 1.65 m deep, and which half is which is not readable. That is a look
question and it is F1.

**AND ONE THING THE MEASUREMENT TURNED UP THAT NOBODY ASKED FOR:** the origin block paints a stop
bar and a zebra on its MAIN street only. Its cross street — 92 m of it, the one `lookcheck`'s
camera looks down — gets a centre line and two edge lines and **no stop bar and no crossing at
all**. F2.

### 4. LAMP POSTS STAND IN THE CARRIAGEWAY — TRUE, REPAIRED, AND THE REGISTRY ANSWER FIRST

**WHICH POPULATION:** the streamed city's own street lamps, `city:lamps`, placed by
`lampStationsFor` in `city.js`. Not `block`, not park, not flood.

**WHAT PLACES THEM AND WHAT THEY TEST AGAINST:** `off = phase + i · LAMP_PITCH_M` is the pole's
distance along its own kerb from the chunk's corner, and **the corner IS a junction** — the road
this chunk owns on its other axis runs along the same boundary, `roadHalfWidth` = 7.5 m either
side. `phase` is `((cx·7 + cz·13) % 10 + 10) % 10`, so the `i = 0` pole is 0 to 9 m along and lands
INSIDE the cross carriageway for every phase under 7.5. The far end is the same statement at the
next junction: `phase + 120` against a road that starts at 120.5.

Measured on the delivered `city:lamps` instance matrices against the delivered `ground:road`
rectangles, resident ring, seed 1337:

```
  before   53 of 320 columns inside a carriageway claim   16.6%
  after     0 of 374                                       0.0%
           columns on a delivered pavement rect  250 -> 341
```

**WHY THE REGISTRY DID NOT FORBID IT, WHICH THE BRIEF PUT AHEAD OF THE REPAIR.** `occupancy.js`
forbids `prop × carriageway` outright and **this loop asks it nothing**: it tests `BLOCK_KEEPOUT`,
`riverBlocks` and `landmarkOccupies` — three bespoke predicates — and writes no claim of its own.
Counted at HEAD before anything changed: of **11 054 delivered claims** over the resident ring,
**172 carry an owner beginning `lamp:` and every one of the 172 is a PARK lamp**
(`chunk.features`, category `feature`); **zero of the 382 street columns was covered by any claim
at all.** `lampprobe.mjs`'s header has said exactly this since session 23 — *"the 790 lamps that do
light this city are emitted by `city.js` directly and are in NO registry band at all — not their
column, not their head"* — and no session had acted on it. **The registry has absolute authority
over what it has been told about, and it had not been told.**

**IT IS TOLD NOW**, at the point of emission: the column as `prop` and the arm and bowl as `canopy`
(solids only, because a lantern over a carriageway is the point of a 2.1 m bracket). **What that
bought in one gate run is §2 below and it is the best argument for the claim that exists.**

The clearance is `LAMP_KERB_INSET_M` itself and there is no second number: a column stands 1.3 m
back from its own kerb line, so it stands 1.3 m back from the cross kerb line. Clamped rather than
dropped — refusing the two offending stations per edge leaves 60 m with no pole across every
junction, which is what session 45 spent a repair closing.

`promenadeLamps` had 3 more on the north–south carriageway where the bank lattice crosses a chunk
boundary. Same clearance, now zero.

    localhost:5173/?player=1&spawn=8.8,1.74,-100&t=0.5

`s46-junction-{before,after}-t0_5.png`

### 5. THE LAMPS ARE BUILT WRONG — TRUE, REPAIRED, AND IT IS HALF THE STREET LAMPS IN THE CITY

**LOOKED AT ONE FROM THREE METRES FIRST, AS INSTRUCTED, AND THEN MEASURED IT.** `s46-lamp-before-
close.png`: the column stands with its bracket reaching left and ending in nothing, and the lantern
floats four metres to its right, attached to nothing.

`city.js` set an axis-`z` column's yaw to **+90** and put its head at `spot.z − side · 2.1`.
three's rotation about +Y takes a local `(x, z)` to `(x·cos + z·sin, −x·sin + z·cos)`, so the
bracket tip at local `(−2.1, 0)` lands at:

```
  yaw    0   ->  (-2.1,  0)     head (x - 2.1, z)      agree
  yaw  180   ->  (+2.1,  0)     head (x + 2.1, z)      agree
  yaw  +90   ->  ( 0,  +2.1)    head (x, z - 2.1)      4.2 m APART
  yaw  270   ->  ( 0,  -2.1)    head (x, z + 2.1)      4.2 m APART
```

The x-axis lamps agreed because 0 and 180 are the two yaws at which the two expressions coincide.
Measured on the delivered `city:lamps` and `city:bowls` matrices as the horizontal distance from
each column's arm tip to the nearest bowl:

```
             columns with no bowl within 1.0 m     median tip->bowl   the offending yaws
  before     165 of 344    48.0%                       0.081 m        +-90 read 4.200 m
  after        0 of 382     0.0%                       0.049 m        max 0.088 m
```

The 0.088 m that remains is `yawJitter`, a ±0.8° wobble deliberately applied to the column and
deliberately not to the head.

**WHICH HALF WAS WRONG IS DECIDED BY THE CARRIAGEWAY, NOT BY TASTE.** An axis-`z` station stands at
`b.z0 ± 8.8` from a road centred on `b.z0` with `roadHalfWidth` 7.5, so the head at ±6.7 m is over
the carriageway and the arm tip at ±10.9 m was over the back of the pavement. **The head was
right.** So the repair turns the column and **moves no light in the city.**

**`promenadeLamps` HAD THE SAME DEFECT AND A COMMENT ASSERTING THE OPPOSITE ROTATION** — *"`rot` 90
puts the arm in −z"*, which is false — and its heads ignored the bank tangent entirely, so even
with the sign right they sat up to `ARM·(1 − cos θ)` off the bracket wherever the bank turns. Both
halves are ONE expression now: the head is the arm's tip carried through the column's own yaw.
`LAMP_ARM_M` replaces three literal `2.1`s in two files.

    localhost:5173/?player=1&spawn=203,5.4,-4&t=0.5362

`s46-lamp-{before,after}-close.png` · `s46-lamp-{before,after}-row.png`

### 6. STILL LARGE EMPTY SURFACES — TRUE, MEASURED BY OWNER, AND IT IS NEITHER OF THE TWO PRIOR CASES

**THE INSTRUMENT THE BRIEF ASKED FOR DID NOT EXIST, SO IT IS ONE OF THE TWO THIS SESSION BUILT.**
`bareprobe` attributes a REGION's square metres and `groundprobe` divides objects by open ground;
neither answers *"what am I looking at"*, because a perspective frame spends most of its pixels on
the nearest two hundred metres. `frameown` casts a ray through a grid of the DELIVERED frame's own
pixels, names the mesh each one hit, and resolves every ground hit back through `generateChunk` to
the kind that owns it — so the share is a share OF THE PICTURE.

**From the operator's own spawn, looking down 45° into the city at noon, 2 304 rays:**

```
  building mass          56.51%
  ground coreGround      16.19%    <- the largest ground owner in the frame
  ground road             7.51%
  ground walk             3.99%
  landmark exchange       4.51%
  building windows        3.78%
  ground siteGround       2.30%
  ground parkingGround    0.65%
  BARE, block.js's earth plane                 0.00%
  the five surfaces with no street on them    19.14% of the frame
```

**BARE GROUND IS 0.00% OF THIS FRAME.** Session 42's case is closed at this pose. The residency
ring is not it either: from 91.73 m looking east the earth plane is 10.53% of the not-sky frame at
a median range of **1 641 m**, which is LOOK.md §2's own *"you are looking past the edge of the
city"*. **What he is looking at is the BLOCK INTERIOR, and it is drawn, correctly coloured, and
almost empty.**

**AND THE PER-HECTARE NUMBER SAYS THE REPAIR IS NOT `DEAD_ZONE.core`.** `groundprobe`, same seed,
same region, objects per hectare of OPEN ground:

```
  kind          chunks   props  feats   objects per hectare, median
  park             2       45    278        275.1
  lot              4       49    495        202.4
  parking          5       82    894        178.2
  construction     3       54    518        174.6
  yard             3       85    410        150.8
  built           83     1898     55         43.8      <- 2/83 with nothing at all
```

**A `built` island delivers a quarter of a car park and a sixth of a park** — and the column that
explains it is `feats`. The other five kinds get 83–92% of their content from FIXTURES: a car park
has bays, rows of parked bodywork, a boundary rail and lighting columns; a yard has a palisade,
stacks and two floods. **The core has 55 features over 83 chunks — 0.7 each — and everything else
it has is scatter.** Its scatter is not short: `DEAD_ZONE.core` at 12 + 14·d delivers 41.8 props
per hectare where `DEAD_ZONE.yard` at 24 + 16·d delivers 29. **The core already has more props per
hectare than a yard.**

**SO RAISING `DEAD_ZONE.core` WOULD BE CHOOSING A NUMBER FOR A REASON THE DATA DOES NOT SUPPORT**,
which is what session 45's L27 refused to do with the froxel pool, and it is not done here either.
The item is fixtures, the constant's own comment already names them — *"bin stores, a plant
enclosure, stacked material and a delivery bay"* — and it is the first thing on §7's list with
every number it needs already printed.

    localhost:5173/?player=1&spawn=188.72,91.73,-8.33&t=0.5362

`s46-own-down.png`

---

## 1. THE LIST

### REPAIRED — each on its own revertible commit

| # | what looked wrong | what it was | frames |
|---|---|---|---|
| **R1** | **The head, the arm and the column do not go together** (item 5). | `+90` here and `z − side·2.1` there are two expressions for one point, and on the `z` axis they disagreed by twice the arm. **165 of 344 columns had no bowl within a metre; 0 of 382 after.** The head was the correct half, so no light moved. §0.5 | `s46-lamp-{before,after}-close.png` |
| **R2** | **Lamp posts stand in the carriageway** (item 4). | `off = phase + i·30` against a cross road ±7.5 m at the chunk's own corner. **53 of 320 → 0 of 374.** Clamped, not dropped. §0.4 | `s46-junction-{before,after}-t0_5.png` |
| **R3** | **The street lamps were in no registry band at all** (item 4's real answer). | 172 `lamp:` claims over the ring and all 172 are PARK lamps; zero of 382 street columns carried one. Column `prop`, arm and bowl `canopy`, at the point of emission. §2 | — |
| **R4** | **An advertising pillar standing inside a lamp column**, 8 times over the region, worst **0.072 m² of a 0.09 m² footprint**. As old as the pillars. | Found by R3 within one `citycheck` run. The pillar now runs the same 3×3 `lampStationsFor` sweep the bus stop has had since session 30. 999 → 948 pillar boxes. §2 | — |
| **R5** | **Two lamp columns in the same place**, one per near chunk — introduced by R2 and found by R3 in the same run. | A junction corner has one pole position and two kerbs asking for it. The NS kerb takes it. The test is GEOMETRIC (`\|off − inset\| ≥ 0.30`) and not *"was it clamped"*, because the first version was the second and missed `phase = 9` by 0.20 m. §2 | — |
| **R6** | **The haze has a hard edge at the horizon** (item 1). | The elevation ramp is `clamp(wdir.y·5, 0, 1)`, exactly 0 for any DOWNWARD ray, so the ground at the earth plane's 4.1 km rim got the CANYON's openness while the sky above it got the full dome. Ground/sky **0.8376 → 0.9774**. §0.1 | `s46-recon-{s,e,w}.png`, `s46-haze-after-{s,e,w}.png` |
| **R7** | `promenadeLamps` carried the same rotation defect, a comment asserting the opposite, heads that ignored the bank tangent, and 3 columns on a carriageway. | All four in one edit; the head is the arm's tip through the column's own yaw. §0.5 | — |
| **R8** | **A 16.45 m viaduct pier standing in a carriageway** (item 2), three of them, plus seven pad footings reaching up to 1.04 m into the running surface. | The placement clears `pierLegHalf` = 0.8 m and `city.js` drew the pad as a literal **2.6 m square**. One length, two objects. Clearance is the pad now, at the largest value a sweep says keeps `0 blocked`. **3 shafts and 7 pads → 0 shafts and 7 pads, worst 1.04 → 0.424 m.** §0.2 | — |

### FOUND AND NOT REPAIRED

**F1. THE STOP BAR AND THE ZEBRA ARE FIFTY MILLIMETRES APART, IN ALL 392 APPROACHES.** The order
is right (item 3) and the GAP is a constant: `min 0.050, mean 0.050, max 0.050 m`, because both
edges are solved against the same two numbers with the same 0.05 m clearance the pavement budget
uses at every join. From a pavement that is one continuous band of white paint 1.65 m deep, and
which half of it is the bar is not readable. Widening it means moving
`CITY.stopLineFromJunctionM`, which is `minStopLineM`'s own subject and has three readers — see
that constant's note. **A look decision nobody has taken.**

    localhost:5173/?player=1&spawn=384,1.74,370&t=0.5

**F2. THE ORIGIN BLOCK'S CROSS STREET HAS NO STOP BAR AND NO CROSSING.** Session 45's R8 painted
the block's main street: centre line, lane lines, edge lines, two stop bars and two zebras. The
cross street got a centre line and two edge lines and neither of the other two, in 92 m — and it
is the street `lookcheck`'s camera looks down. It is one `for` loop, and it is not done here
because R8's own paint is what took `distinct:midnight|dusk` red (L15) and this adds more of
exactly the same pixels to exactly the same two frames.

**F3. `frameown` NEEDS A SECOND POSE PER FINDING AND HAS ONE.** Every share in §0.6 is a single
frame's ray census. STATE 45's L16 says two of three street poses are not reproducible boot to
boot; a ray census is not a pixel census and should not drift with exposure, but nobody has
checked that. **One arm twice, at two poses, is the ten-minute item.**

**F4. A TREE CROWN HANGS OVER THE CARRIAGEWAY WITH ITS TRUNK BEHIND A VAN, AND THE TABLE ALLOWS
IT.** Visible in `s46-lamp-after-row.png` and `s46-street-e.png` as a cluster of green boxes in the
air over the road. `occupancy.js` → `canopy` conflicts with SOLIDS ONLY and its own note says *"a
canopy over a carriageway is a street tree"*, so this is legal by construction. **Whether a street
tree should overhang the running lane of a 15 m carriageway rather than the parking lane is a look
decision**, and it is the nearest thing in the frame to the operator's item 2 that is not a
landmark.

**F5. `city.js` → `CATEGORY_FOR_GROUND` COLLAPSES FIVE SURFACES TO ONE CLAIM, SO NO DELIVERED
INSTRUMENT CAN TELL A CAR PARK FROM A COURTYARD.** `siteGround`, `grass`, `parkingGround`,
`yardGround` and `coreGround` all become the category `ground` with owner `ground:<kind>` — the
owner survives, the KIND on the claim does not, and `rects` (which `surfaceAt` and the delivered
census read) carries only the category. It is correct for the conflict table, which is what the
category is for, and it is why §0.6's split had to go back through the pure generator.

**F6. THE STREET POSE AT THE OPERATOR'S SPAWN MOVED 123.90 → 125.45 IN FRAME MEAN ACROSS THIS
SESSION, AND THE HAZE TERM IS PROVABLY ZERO THERE.** `clamp((1.74 − 21.6)/38.4, 0, 1)` = 0, so the
mover is the lamp geometry — 16.6% of the columns changed position and 48% changed yaw. Two boots
of the same code at that pose read 126.132 and 126.382 (spread 0.25), so the move is eight times
the noise. **Recorded because it is the first paired boot-to-boot control anybody has taken at a
STREAMED street pose**, and L16 only ever measured the origin block's.

**F7. THE VIADUCT'S REGISTRY CLAIM STILL UNDER-DECLARES ITS OWN FOOTING BY 0.20 m, AND
`citycheck` STILL READS `0 leg(s) on a carriageway` FROM A BOX NOBODY DRAWS.** R8 moved the pier;
it did not make the claim honest. `landmarkOccluders` boxes a leg at `arc.legHalf + 0.3` = **1.10 m**
against a delivered pad of **1.30 m** square on and 1.838 m yawed, so the registry, the road clip
and the building keep-out are all still describing the leg. Widening it re-phases the city — the
road clip and the building refusals both move — so it needs its own arm, and the arm is cheap:
`fillprobe`/`funnelprobe` over the same twelve regions at 1.10 and at 1.60. **The residual on the
ground is 7 pads reaching 0.089 to 0.424 m into a carriageway, all 0.65 m tall**, and it is the
pier's YAW, which no single clearance can remove inside the 10.9 m offset band.

**F8. THE 0.08 MEAN-LUMINANCE FLOOR IS INSIDE ITS OWN RUN-TO-RUN SPREAD AND THIS RUN SWAPPED WHICH
ROUTE IT FAILS.** `night_rain` — L28's red — is GREEN at 0.0856 with per-run means
[0.0751, 0.0901, 0.0856]; `downtown_dense` is RED at 0.0796 with [0.0796, 0.0643, 0.0839]. **Both
straddle 0.08, the spread is about 0.020, and the margin is 0.000.** The gate prints its own
warning beside the number — *"ASSERTED ON THE LAST OF THESE, NOT POOLED"* — so which night route is
red is a draw rather than a verdict. It is CONTRACT §0.1's original incident with a luminance
instead of a millisecond, and rule 6's *"counts are pooled worst-case, statistics by median"* has
an answer for it that nobody has applied here.

**CARRIED, UNTOUCHED, AND NOT RE-DISCOVERED HERE:** everything in session 45's own list —
L1 (the 220 cd/m² window), L2 (the arch pose over the triangle ceiling), L3, L4 (the blend mode),
L6, L7, L8, L9, L10, L11, L12, L13, L14, L15 (`minPairMSD`, owed a derivation), L16 (the
non-reproducing poses), L17, L18 (nothing above ground gets wet), L19, L20, L21, L22, L23, L24,
L25, L26, L27, L28; `clumping` CV 0.443 against 0.60, red by instruction, sixth session; the two
sign quads inside a building; the vehicle tone-profile bar, THIRTEENTH session; and the two
`sign(adpillar) × prop(tree/planter)` overlaps §2 leaves exactly where it found them.

---

## 2. THE CLAIM FOUND TWENTY-SIX OVERLAPS IN ONE GATE RUN AND EIGHTEEN OF THEM WERE THIS SESSION'S

**THIS IS THE BEST ARGUMENT FOR R3 THAT EXISTS AND IT COST THREE `citycheck` RUNS.** Giving the
street lamp a claim gave the delivered census its first sight of it, and the number went from the
2 forbidden overlaps session 45 recorded to **26**:

```
  26   prop(lamp:column) x prop(lamp:column)  0.09 m2, one per near chunk
       MINE, and one commit old. Both `i = 0` stations are `inset` from their own kerb, so
       when `off` clamps to `inset` they are THE SAME POINT. 0.09 m2 is 0.30 x 0.30 — the
       whole claim box. A junction corner has one pole position and two kerbs asking for it.

   8   sign(adpillar) x prop(lamp:column)  worst 0.072 m2 of a 0.09 m2 column
       NOT MINE. 80% of a lamp post inside an advertising pillar, as old as the pillars and
       invisible for as long, because `clash` reads the one table correctly and there was no
       lamp in the list to read. Same 3x3 sweep the bus stop has had since session 30.

   3   prop(lamp:column) x prop(lamp:column)  0.01 m2
       MINE AGAIN, and the first de-duplication was `off === raw` — "was it clamped" — where
       the question is geometric. At `phase = 9`, `off` is 9.0 against an inset of 8.8: no
       clamp fires, the columns are 0.20 m apart, and two 0.30 m claims still overlap.

   2   sign(adpillar) x prop(tree) 0.013 m2 and sign(adpillar) x prop(planter) 0.086 m2
       The same two STATE 45 §6.2 records. Cross-chunk, untouched, and still there.
```

**`occupancy` ends the session reporting exactly the two overlaps it reported before it**, with a
claim band of **333 columns and 333 canopies** added under it. That is what a registry is for, and
it is the fourth time this project has found a defect by writing something down rather than by
looking at it.

---

## 3. GATE STATE

Run individually and ALONE, which is STATE 45 §6.3's own finding about this machine: gates measure
a machine and they are each other's load.

```
  parsecheck   GREEN   112 files, contract-clean. The file count is unchanged from sessions
                       42-46: this session added no file either, and its seven probes are in
                       the scratchpad.
  windcheck    GREEN   568 mesh names over 568 meshes (floor 400), 564 of 564 cull-eligible
                       decided, 0 wound backwards, 0 unmeasured. The lamp columns R1 turns and
                       R2 moves are in that count.
  inputcheck   GREEN   keyboard, mouse and gamepad each deliver their own constant, the lock is
                       acquired, and the mouse is inside the usable band.
  faultcheck   GREEN   7 cases — quarantine is surgical, logged once, and the frame survives it.
  lookcheck    RED at 3 — THE SAME THREE AS SESSION 45, and no band moved by more than the
                       instrument's own resolution:
                         band:midnight 0.0829 (s45 0.0828)   band:dusk 0.1412 (0.1412)
                         band:dawn     0.3026 (0.3025)       band:noon 0.4286 (0.4285)
                         crushed black 0.577% (0.575%)       road pools 13 of 6 (12)
                         distinct:midnight|dusk 0.02992 against 0.03000 — L15, unchanged from
                         the end of session 45 to five decimals
                         102 local lights at midnight and at dusk
                       facadeAlbedo and facadeNeighbours at dusk are the other two, both
                       carried and both about the origin block's own facade.
  citycheck    RED at 3 on the run before R8 — THE SAME THREE as sessions 40-46 — and
                       `occupancy` reports THE SAME TWO delivered overlaps it reported before
                       this session, with a claim band of 333 lamp columns and 333 canopies
                       added under it. §2. **RED AT 3 AFTER R8 TOO, ON THE THIRD
                       RUN, AND THE SECOND RUN'S FOURTH RED WAS THE MACHINE — WHICH IS ONLY
                       KNOWN BECAUSE IT WAS TAKEN TWICE.** The first run after R8 added
                       `sceneWalk: the city had not finished arriving`, a WALL-CLOCK timeout at
                       20 030.7 ms with 3 bakes queued and 1 in flight. Re-run twenty minutes
                       later on the same commit:

                         load1 12.38   city arrived  20 030.7 ms  TIMEOUT, red at 4
                         load1  4.19   city arrived  16 117.7 ms  3054 frames, red at 3

                       `load1` went to 12.38 because a screen-share and audio session started on
                       the machine during `perfcheck` (`coreaudiod` 195%, `screensharingd`
                       25.6%). The gate's own message says a wall timeout means a bake is slow;
                       it was, and the reason is not in this repository. **Every count is
                       identical across the two runs and the viaduct row IMPROVED in both.**
                       `city arrived` is the one number in `citycheck` that is a MILLISECOND,
                       and CONTRACT §0.2 applies to it exactly as it does to a frame time.

                       The three that stand:
                         clumping CV 0.443 against 0.60, sixth session, untouched by instruction
                         2 of 2720 sign quads inside a building, the same two
                         2 delivered overlaps: sign(adpillar) x prop(tree) 0.013 m2 and
                           sign(adpillar) x prop(planter) 0.086 m2 — the same two
                         bright reserve 6.34% against 6.00 (s45 median 6.35; read L22 before
                           reading anything into that)
                         viaduct 23 piers, 2 hammerhead, 7 nudged, 0 blocked, 0 leg(s) on a
                           carriageway, worst |x| inside the block 9.94 m against 10.40 — R8
                         saturation 4.00% pooled peak against a 12% ceiling
                         lamp bowls: origin 1.0000x derived, streamed 4.6102x, ratchet unmoved
  perfcheck    RED at 13 — the same count as session 45 and the same three categories.
                       **NOT ONE IS A COUNT.** Every route, against session 45's own table:

                            draws  s45     tris   tris s45   instances   inst s45   froxel  s45
    downtown_dense            318  318    1.91M     1.91M      238 336   238 480      43     40
    highway_speed             396  396    2.18M     2.18M      312 410   312 551      79     79
    night_rain                317  317    1.88M     1.88M      292 666   292 804      49     43
    player                    307  307    1.86M     1.86M      238 336   238 480      45     42

    roles  aircraft:1  traffic:96  stall:12  block:56  lamp:192  sign:16   — identical

                       Not one draw call and not one triangle to three figures. Instances are
                       -138 to -144 on every route, which is the corner pole R5 removes, one per
                       near chunk. The froxel margin is equal or better on all four and L27's
                       eight-point spread is why nothing is claimed from that.
  gateaudit    RED at 1, THE SAME ONE AS SESSION 45 — the carried control, *"the unperturbed
                       frames do not pass their own gate"*, naming exactly `lookcheck`'s three.
                       Everything else green: `ok control — every assertion ran` (nothing
                       suppressed), perfcheck --falsify 74/74 cases at 100% coverage over 72
                       failure sites, citycheck 61/61 at 100% over 61, inputcheck 13/13 at 100%
                       over 12 with its good fixture clean, and both control sweeps.
```

**THE ELEVEN FRAME-TIME REDS ARE NOT ADMISSIBLE IN EITHER DIRECTION** — four cpu p95, three wall
p95, three "frames over 33 ms" and the headroom probe, at a `load1` that started the run at 3.04
and ended it at **12.70**, because the operator started a video call on the machine during the last
route (`coreaudiod` 191%, `avconferenced` 34.7%, `screensharingd` 26.3%). CONTRACT §0.2's drift is
one-sided, so those readings can only be slow.

**THE TWELFTH IS A LUMINANCE FLOOR AND IT CHANGED ROUTES, WHICH IS THE FINDING.** L28 recorded
`night_rain`'s frame mean red at [0.0797, 0.0771, 0.0694] against a floor of 0.08. This run:

```
  night_rain       per-run mean [0.0751 0.0901 0.0856]   asserted 0.0856   GREEN
  downtown_dense   per-run mean [0.0796 0.0643 0.0839]   asserted 0.0796   RED
```

**Both straddle the floor and the assertion reads the LAST run, not a pooled estimate** (the gate
says so itself: *"ASSERTED ON THE LAST OF THESE, NOT POOLED"*). So which of the two night routes is
red is decided by a draw from a distribution whose spread is 0.020 against a margin of 0.000.
That is CONTRACT §0.1's own case with a luminance instead of a millisecond, and it is F8.

**THE THIRTEENTH IS CONTENT** — the carried vehicle tone-profile bar, *"only 54% of 69 vehicles
carry a non-monotone tone profile (min 75%)"*. **THIRTEENTH session**, and the population keeps
moving (23 → 68 → 78 → 70 → 63 → 69).

---

## 4. WHERE THE BRIEF DISAGREES WITH THE CODE

The brief asked for this and there are four disagreements, three of them in the constraints.

1. **"Session 45 reported `highway_speed` at 396 of 440, down from 439, and did not say why."**
   **It said why, twice.** STATE 45 §3.1 is a three-row table — `shipped s44` 439, `+ the far
   kerb, per-chunk meshes` 441 (a BREACH), `+ the far kerb, MERGED meshes` 395 — and L26 carries
   the last one: R12's lamp posts made a `masses` mesh appear on `park` and `parking` chunks that
   had none, `highway_speed` 395 → **396**. 439 − 396 = 43, and the three legs are +2, −46, +1.
   **They were freed by a real structural change and not by a measurement moving:** the +2 was
   more of the same 70 per-chunk lamp meshes passing the frustum test because each bounding sphere
   now reached the other pavement, and the −46 was merging those 70 into 2, the move
   `rebuildGroundMesh` and `rebuildSignMesh` already make. **Scene meshes 430 → 362** is the
   corroborating count, and STATE 45 §8 already says *"the sentence a future brief should carry is
   45 and not 1"*.

2. **"The haze has a hard edge."** TRUE, and the cause is the second of the four candidates the
   brief lists — the sky dome meeting the ground plane. §0.1.

3. **"The landmark still overhangs the road."** **TRUE, and it is one landmark and it is not an
   overhang.** Six of the eight put not one box outside their own claim, so session 42's repair
   holds; the arch's 76 are its span and none is over a road. **The viaduct puts 7 pier PAD
   FOOTINGS and 3 pier SHAFTS into a delivered carriageway below 5.1 m**, because the placement
   clears `pierLegHalf` = 0.8 m and the drawn footing is 2.6 m square. The brief's own guess —
   *"the canyon bake's occluder boxes being used as a ground keep-out"* — is the RIGHT CLASS with
   the wrong box: it is one length standing for two objects. **Repaired** (R8): 0 shafts and a
   worst pad reach of 0.424 m against 1.04. §0.2, and the claim itself is F7.

4. **"At a junction the painted stop bar and the zebra appear to be in the wrong order — a vehicle
   would stop ON the crossing rather than behind it."** **FALSE in 392 of 392 delivered
   approaches**, and false from the vehicle's end too: no settled vehicle is ever past its own line
   over 21 583 frames. §0.3.

**AND THE BRIEF'S OWN LAST PARAGRAPH IS WHY BOTH OF THOSE WERE MEASURED BEFORE ANYTHING WAS
CHANGED.** Two of six were false premises this time, where session 45 found one of five.

---

## 5. HOW EVERY FRAME AND EVERY NUMBER IN THIS FILE WAS TAKEN

All at seed 1337, all `?paused=1`, 1280 × 720 unless the pose says otherwise. **EIGHT PROBES, ALL
IN THE SCRATCHPAD, NONE IN THE TREE.** `parsecheck` still counts 112 files.

```
  shot.mjs      MANY POSES, MANY TIMES, ONE BOOT — session 45's `walkshot` rebuilt, because a
                scratchpad does not survive a session. Prints the draw call, triangle, wetness,
                clock, field-slot and chunk counts beside every frame, so a frame taken
                mid-stream says so.
  census.mjs    THE DELIVERED SCENE, THREE QUESTIONS, ONE BOOT: every landmark's plan extent off
                its own instance matrices and lathe bounds against `landmarkGroundClaims`, every
                lamp column against the delivered `ground:road` rects, and every column's ARM TIP
                against the bowl that is supposed to be on the end of it. ITS FIRST PASS WALKED
                ONLY `isInstancedMesh` and reported the condenser, the weir, the exchange and the
                dish as their BEACONS — two of the eight read NOT RESIDENT while standing 123 m
                from the eye. A lathe is a plain mesh.
  markprobe.mjs THE STOP BAR AND THE ZEBRA AS EDGES FROM THE JUNCTION CENTRE, out of
                `generateChunk` with no browser in it. §0.3's table.
  pick.mjs      raycast the delivered scene through one screen pixel and print what is there with
                its material and its range. §0.1's two lines are one call of this.
  patch.mjs     scanlines and named rectangles as sRGB code values. The seam is a SCANLINE
                because a patch straddling a boundary reports the boundary.
  hazesweep.mjs ONE BOOT, ONE POSE, THE HAZE UNIFORMS SWEPT LIVE. It is the probe that caught the
                first arm of R6: the derivation predicted 1.96x the sky term, the frame moved 3%,
                and driving `setHazeOpenness` directly said the mechanism was right and the RAMP
                CONSTANT was the limiter. No frame was going to say that.
  piersweep.mjs THE VIADUCT'S WHOLE PIER POPULATION AGAINST ONE CLEARANCE, in the pure
                generator. R8 could not be chosen without it: the constant being tightened is
                also the one that caps the search band, so the arm had to be picked from
                blocked / nudged / hammerhead counts rather than from the clearance alone.
  frameown.mjs  WHAT OWNS THIS FRAME'S PIXELS. A ray per grid cell of the delivered frame, named
                by the mesh it hit, with every ground hit resolved back through `generateChunk`
                to the kind that owns it. §0.6, and the brief asked for it by name.
```

**THE FRAMES THIS FILE CITES**, all in `tools/shot-out/` and all regenerable from the `spawn=`
links above (the directory is gitignored, so a fresh clone has to take them again):

```
  s46-recon-{n,e,s,w,down}.png        the operator's spawn, five directions, BEFORE everything
  s46-street-{n,e,s,w}.png            the same spawn at 1.74 m, BEFORE everything
  s46-haze-after-{s,e,w,street}.png   after R6
  s46-hazesweep-*.png                 the six live arms of the openness and density sweep
  s46-lamp-before-{close,row,junction,xroad}.png    before R1
  s46-lamp-after-{close,row,junction,xroad}.png     after R1
  s46-junction-{before,after}-t0_5.png     R1 AND R2 IN ONE PAIR, and the session's best frame:
  s46-junction-{before,after}-ns-t0_5.png  a lamp column on the centre line of a carriageway
                                           with traffic passing it, and detached bowls behind
                                           it. 306 draws in both arms.
  s46-own-down.png                    the frame §0.6's ray census was taken through
  s46-ctrl-street-{A,B}.png           F6's two boots of one build
```

**THREE POSES WERE TAKEN AND DISCARDED BEFORE ANYTHING WAS MEASURED OFF THEM**, which is STATE 45
§7's rule and it earned its keep again: `s46-lamp-before-junction` framed the inside of a market
stall, `s46-street-n` framed L20's blank flank at 3 m, and the first `s46-junction-before-b` put
the lens inside a tree. A frame that does not show its subject is not a weaker frame, it is a
different measurement.

**THE BEFORE FRAMES FOR R2 CAME OUT OF A SECOND WORKTREE**, because R1 and R2 landed in one
sitting and a before frame taken after the fact is not a before frame. `git worktree add` at
`0145b1d` with `node_modules` symlinked, and a copy of `shot.mjs` importing THAT tree's
`page.mjs` — otherwise `startServer` serves the repository the module lives in and both arms are
the same city.

---

## 6. WHAT WAS NOT DONE

- **No threshold was moved anywhere.** `look-budget.json`, `input-budget.json`, `city-budget.json`
  and `budget.json` are byte-identical to session 45's.
- **`clumping` was not touched.** Red by instruction, sixth session.
- **`minPairMSD` was not re-derived**, which was item 2 on session 45's own list. It reads 0.02992
  against 0.030, unchanged from the end of session 45 to five decimal places.
- **No quiet battery.** `load1` never inside 1.6, and it ended the session at **12.38** because
  a screen-share and audio session started on the machine during `perfcheck`'s last route. That
  is not this session's load and it is the reason the final `citycheck` carries a fourth red.
- **Item 6 got a measurement and no repair**, and §0.6 is the argument for why the obvious knob is
  the wrong one.
- **No merge to main.**

---

## 7. WHAT TO DO FIRST NEXT TIME

0. **THE BLOCK INTERIOR'S FIXTURES — §0.6, and every number it needs is printed.** 16.19% of the
   operator's own frame, 43.8 objects per hectare against a car park's 178.2 and a park's 275.1,
   and 83–92% of what those two have is FIXTURES rather than scatter. `DEAD_ZONE.core`'s own
   comment names the content — bin stores, a plant enclosure, stacked material, a delivery bay —
   and three of the four are already modelled prop kinds. **Do not raise the scatter: it is already
   above a yard's.**
1. **L1, THE WINDOW.** Carried from session 45 unchanged and still the biggest single finding in
   this project. 220 cd/m² against 7–30, one quantity in two files. Read L22 first: the bright
   reserve is a median 0.3 above a floor one run in three is already under, and this session's
   run reads 6.29%.
2. **L15, `minPairMSD`.** Owed a derivation since session 45 and not paid. Do not lower it to
   0.029. F2 is blocked behind it.
3. **F7, THE VIADUCT'S CLAIM.** R8 moved the pier off the road and left the registry describing
   the leg: `arc.legHalf + 0.3` = 1.10 m against a delivered 1.30 m pad. Widening it re-phases the
   city, so it wants `fillprobe` over twelve regions at both values first.
4. **F4, THE CANOPY OVER THE CARRIAGEWAY.** `occupancy.js` permits it by name and a frame makes it
   look like a mistake. Either the table's sentence is right and the frame needs a different tree
   position, or the sentence needs a lane in it.
5. **L2, THE TRIANGLE CEILING OFF-ROUTE.** A street pose at the arch is over 2 360 000 and no gate
   route goes there.
6. **THE DRAW-CALL BUDGET IS STILL NOT THE LIMITER.** §4 item 1 has the arithmetic. The items
   deferred with *"it costs a draw call"* — the landmark/mass split, the hologram's transparency,
   the weir's ledge planters — are all still affordable.
7. Everything else in §1's carried list, then STATE 44 §9 items 3, 4, 6, 7, 8, 9, 10 and 11.
