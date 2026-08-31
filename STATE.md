# NOCTIS — STATE

*End of session 60. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`, 12 d 20 h of
uptime — the same boot as sessions 47–59. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` READ 2.09 AT THE FIRST COMMAND AND RAN 3.9–6.7 THROUGH THE GATES***, with
`mediaanalysisd` at 99% of a core for most of the session — far over CONTRACT §0.2's bar of 1.6,
so **no millisecond here is a verdict**. Every number this session turns on is a COUNT, a RATIO,
or a MONOTONE RELATION across three arms of the same build, and §0.1's corollary is that counts
do not drift.

Branch `claude/noctis-60-play-and-flank`, off session 59's head, two commits. NOT PUSHED.

**THE BRIEF SAID "FOUR THINGS" AND LISTED THREE.** Items 1, 2 and 3 arrived; item 4 did not, and
nothing here is a guess at what it was. Items 1–3 are done in full.

---
## 0. THE THREE ITEMS, IN ONE PLACE

```
  1  trees on the basketball court   the pad had NO claim, and the category it
                                     would have carried permits a prop anyway
  2  the thirty-metre blank flank    73.4% of side elevation area is not a party
                                     wall; the full repair is 3x the headroom
  3  nobody on the courts            zero triangles: the crowd is redistributed,
                                     not added
```

---
## 1. ITEM 1 — THE PAD CARRIED NO CLAIM, AND THE CATEGORY WOULD NOT HAVE HELPED

**REPRODUCED EXACTLY.** `?player=1&spawn=580.12,0.14,1061.89&t=0.6017&seed=1337` is chunk
**(4, 8)**, a `court` at density 0.2465, whose pad runs x ∈ [558, 594], z ∈ [1067, 1109]. Two
trees stood at **(575.51, 1077.25)** and **(569.26, 1078.65)**. Both are in that chunk's own
`props` and were placed by its own island scatter.

**IT IS NOT SESSION 57's SHAPE.** The ad pillar's defect is a 3×3 sweep that a kerbside scatter
reaches across; both of these trees are forty metres from the nearest chunk boundary and were
never a cross-chunk question. It is the simpler failure, and there are **two of them**:

1. **THE PAD WAS NEVER OFFERED TO THE REGISTRY.** `citygen.js` pushed the `sportGround`
   rectangle into `ground` and claimed nothing. Chunk (4, 8) carries **200 claims** — block 1,
   carriageway 4, pavement 6, path 1, feature 138, building 1, prop 45, site 4 — and not one of
   them is the court. The scatter forty lines below tested `reg.conflict` against a registry
   that had never heard of it.
2. **AND THE CATEGORY IT WOULD HAVE CARRIED PERMITS A PROP.** `city.js` maps `sportGround` into
   the delivered census as `ground`, and `ground × prop` is **absent from the conflict table on
   purpose** — a container on a site's hardcore and a bench on a lawn are what a surface is for.
   So a claim alone would have been silent too.

**THE POPULATION, BEFORE AND AFTER.** `tools/playprobe.mjs`, 625 chunks (cx, cz ∈ [−12, 12]) at
seed 1337 — the gate's own region is too small to contain the question, see below:

```
                              before   after
  props standing on a play area   35       0     over 14 recreation islands
    of which trees                 9       0
  play area claimed              0 ha   3.06 ha  1.18 pad + 1.88 turf
```

**AND 24 OF THE 35 WERE ON THE SIX PITCHES, WHICH HAD NO SURFACE TO CLAIM AT ALL.** A court and a
playground lay a `sportGround` pad; a pitch and a stadium are grass on grass, so there was no
delivered rectangle that WAS the pitch. A generator-only claim would have been the half of a
two-sided check CONTRACT §9.1 says is worth least, so the fix is a ground KIND: **`playField` is
`grass` with a different category and nothing else** — same albedo, same datum, same porosity,
the frame identical to the pixel. It is the relation `apronGrass` already has to `grass`.

**WHY NO GATE HAD SEEN IT, AND IT IS A FINDING ABOUT THE REGION RATHER THAN ABOUT THE CHECK.**
`city-budget.json` → `region` is cx, cz ∈ [−5, 4], and over those hundred chunks at seed 1337
there is **exactly one recreation island** — a playground at (3, 2), the variant whose palette is
least likely to draw a tree. `citycheck`'s delivered census is taken at `SHOTS.street`, which
sees the same one. **The operator's court is eight chunks north of the region's edge.** Session
56's `$featureFacings` note records the same gap in the same words for the same islands.

### 1.1 `occupancy.js` → `pitch`, AND EVERY ABSENCE IN THE ROW IS A SENTENCE

```
  pitch: ['building', 'landmark', 'water', 'carriageway', 'prop', 'sign']
```

`feature` is absent and it is the load-bearing absence: the goals, the hoops, the ball-stop
fence, the play frame and the swing are all `feature` and every one stands ON the play area by
design. `site` is absent because the four floodlight masts stand at `hxP + 3.0` inside a pad that
reaches `hxP + 4.0` — a mast on the run-off is what a floodlit court is, and forbidding `site`
would have unlit every pitch in the city to keep a hoarding off one. `pavement` and `path` are
absent because session 56's gate path stops exactly at the pad's edge and `overlaps()` is strict.
`canopy` is absent by the same argument that lets a street tree overhang a carriageway.

**`sportGround` WAS DOING THREE JOBS AND KEEPS ONE.** A school's hard yard and a church's paved
square borrowed the kind for its macadam. They are `hardGround` now — same albedo, same datum,
same category (`ground`), **not one pixel different** — because a bench on a churchyard square is
right and the `pitch` row refuses every `prop`.

### 1.2 THE OTHER SURFACES THE BRIEF NAMED, MEASURED

`node tools/playprobe.mjs`, 625 chunks at seed 1337:

```
  * recreation/playField      6 chunks   1.88 ha   nothing on it
  * recreation/sportGround    8 chunks   1.18 ha   nothing on it
    school/hardGround         4 chunks   1.20 ha   tree 8, planter 4, bollard 4, cyclestand 2
    church/hardGround        16 chunks   2.66 ha   tree 98, planter 21, bollard 18
    market/parkingGround      5 chunks   5.47 ha   stack 91, bench 51, planter 42, bin 42, bollard 39
    parking/parkingGround    20 chunks  21.14 ha   bollard 110, planter 57, bin 56, fence 53, cabinet 46
  * = claims `pitch`
```

- **The pitch, the playground's safety surface and the stadium's pitch** are all `recreation`
  and are all closed. A stadium is a `pitch` variant with a bowl round it, so it takes the same
  `playField`.
- **The market hall has no floor.** The hall is a `canopy` mass over the island's own
  `parkingGround`, and what stands under it is the market's own ten stalls, placed there on
  purpose. `LOW_DETAIL_PROPS.market` contains **no tree**, and none is delivered on any of the
  five market islands in range. There is nothing to repair and the question is answered.
- **THE SCHOOL YARD AND THE CHURCH SQUARE ARE A REAL FINDING AND ARE NOT REPAIRED.** 8 trees
  growing out of a school's tarmac and 98 out of a church's paving. A tree in a paved square is a
  tree in a tree pit and a tree in the middle of a playground is not, and **the category tool
  cannot tell them apart**: `pitch` refuses every `prop`, and a bench on a churchyard square is
  correct. Saying so needs `prop` split into furniture and PLANTING — a change to every prop
  claim in the project. Written here as a measured statement per LOOK.md §8, not acted on.

### 1.3 THE CARRIED SEAMS ARE **NOT** CLOSED, AND HERE IS WHY WITH THE MECHANISM

The brief asks to say so if they were. They were not. The delivered census still reads the same
five overlaps sessions 57–59 recorded. Session 57 predicted that widening **the prop test** would
close them; this session widened the conflict **table**, which is a different repair.

**AND THE MECHANISM IS ONE SENTENCE FOR ALL THREE, MEASURED.** Each is a kerbside prop emitted
by one chunk and standing inside its neighbour's square, because a chunk owns the corridors on
its west and north sides and a kerbside scatter reaches `CORRIDOR` across:

```
  sign(adpillar) x prop(cyclestand)  cyclestand emitted by (1,0)   8.35 m inside (0,0)
  sign(adpillar) x prop(cyclestand)  cyclestand emitted by (0,3)   8.30 m inside (-1,3)
  prop(planter)  x prop(lamp:column) planter    emitted by (-2,1)  8.36 m inside (-2,0)
```

`city.js` places both the pillar and the lamp column against `placed`, **the chunk's own claim
list**, while the pillar already sweeps 3 × 3 for bus stops and lamps through pure functions.
The prop test cannot use the same trick because the pure function is `generateChunk`, which is
what `CITY.generateBudget` exists to ration. A memoised neighbour lookup is the shape of the
repair and it is a session's item, not a line in this one.

---
## 2. ITEM 2 — THE FLANK, AND THE FULL VERSION IS THREE TIMES THE HEADROOM

`buildFacade` builds four faces and glazes two. Its own comment is right about the case it names
and silent about the case it does not: *"buildings in a run touch, so a window on a side face is a
window inside the neighbour."* True INSIDE a run, where the walk advances `rng.range(0.2, 1.4)`;
false at the end of one, where it advances `rng.range(6, 26)`.

**MEASURED OVER `city-budget`'s OWN 10 × 10 AT SEED 1337**, from the registry:

```
  668 buildings, 1 336 side faces
    party wall, end to end     199   14.9%
    partly covered             358   26.8%
    open end to end            779   58.3%
    both sides open            222 buildings, 33.2%

  side elevation area        1 521 k m2, of which 73.4% is EXPOSED
  front + rear area          1 049 k m2
  exposed side / front+rear  1.065x
```

**SO THE TWO FACES THIS FUNCTION SKIPPED ARE ANOTHER WHOLE CITY OF WINDOWS.** And a correction
the brief needs: **windows in this project are BOXES, not plane quads** — twelve triangles each,
deliberately, since session 5, under a comment that says a plane flush with a wall reads as a
decal. The costs, counted off the delivered meshes at `citycheck`'s own eye:

```
  front + rear, today          76 598 panes    919 176 tris   boxes
  every exposed side face      93 702 panes    187 404 tris   as PLANES
                                             1 124 424 tris   as boxes
  the ceiling                                 2 360 000       budget.json
  highway_speed at HEAD                       2 300 000       ~60 000 spare
```

### 2.1 WHAT DECIDES WHICH FACE, AND IT IS THE REGISTRY

`citygen.js` measures two things per side face against its own claims and puts them on the
building:

- **`sideCovered`** — the spans a neighbour stands on and **how high that neighbour reaches**.
  Not a boolean: a 30 m flank beside a 16 m neighbour is a party wall for 16 m and an elevation
  for 14, and a 60 m flank beside a four-storey neighbour is a party wall for four storeys and an
  elevation above it. `city.js` reads it per BAY, which is §7.3.1's *"a station is read against
  the boxes that span it"* with a window bay instead of a vehicle station.
  The probe is **`SIDE_PARTY_PROBE_M` = 2.0 m**, and it is not a tolerance: nothing in this
  generator stands between **1.4 m** (the within-run gap's ceiling) and **6.0 m** (the end-of-run
  gap's floor), so every value in that interval classifies every perimeter building identically.
- **`sideOpenM`** — the clear distance in front of the face, saturating at `SIDE_OPEN_MAX_M`
  = 30 m. A face in a 0.4 m slot is not a party wall and is not an elevation either, and one
  number cannot say both.

**THE CUT IS `FLANK.minOpenM` = 23.4 m = `2 × CORRIDOR`** — this city's own building line to
building line, LOOK.md §2's *"the narrowest gap it already asserts two facades may face each
other across"*. So the rule is **an elevation is glazed when it has at least a street's width of
clear ground in front of it**, which is the brief's *"put windows on the elevations that face a
street"* with the street's width supplied by the generator. It selects the corner and
end-of-side flanks — item 2c's *"glaze the corner buildings first"* — by measurement rather than
by a corner test.

### 2.2 THE SWEEP, WHICH IS WHAT ITEM 2b ASKED FOR

Delivered panes and triangles, resident ring at `citycheck`'s eye, seed 1337:

```
  minOpenM   bayM   keep     panes    triangles
     0.0     2.0    1.00    93 702      187 404   every exposed flank
     2.0     2.0    1.00    77 135      154 270
    12.0     2.0    1.00    60 251      120 502
    23.4     2.0    1.00    37 924       75 848
    23.4     2.8    1.00    26 658       53 316
    23.4     3.4    1.00    21 738       43 476
    30.0     2.8    1.00    20 863       41 726
    23.4     2.8    0.50    13 294       26 588
    23.4     2.8    0.35     9 332       18 664   <- SHIPS
    23.4     2.8    0.20     5 339       10 678
```

**`bayM` = 2.8 m is the widest bay `buildFacade` already draws** (the `vertical` rhythm's), so a
flank sits at the coarse end of this city's own vocabulary rather than at a number invented for
it. **`keep` = 0.35 is a BUDGET and is said to be one** (CONTRACT §9 rule 5): 60 000 triangles
spare, two triangles a pane in a mesh that is never frustum-culled, so the city can carry 30 000
panes; spending a THIRD of the headroom leaves the ceiling something to be a ceiling with.
**What the world has to be like for 0.35 to be right**: a flank built expecting a neighbour
carries about one opening for every three the front does — a stair window, a landing, the back
rooms with no other elevation.

**DELIVERED, `highway_speed`**, against HEAD in the same session on the same machine:

```
                    HEAD        ships       ceiling
  triangles       2.30 M       2.32 M      2 360 000
  draw calls         401          402            440
  instances      336 587      347 978
```

**ONE DRAW CALL FOR THE WHOLE CITY**, because the panes ride one merged `city:flank` mesh —
session 58's own arrangement for the sign blades. What that costs in return is said rather than
discovered: a city-wide bounding sphere is never frustum-culled, so every triangle in it is
submitted every frame, which is why the arithmetic above is done against the whole delivered
population and not against the fraction in front of the camera.

### 2.3 AND THE MERGED MESH HAD A REBUILD STALL, FOUND BY THE GATE THAT MEASURES IT

`CITY.generateBudget` is 2, so a chunk crossing that queues twenty chunks takes ten frames — and
a merged mesh rebuilt on each of them uploads the whole city's flank ten times for one crossing.
That is the ANGLE-Metal upload stall `budget.json` → `ceilingsByRoute.night_rain` already names.
Measured on `highway_speed`, frames over 33 ms against a ceiling of 3:

```
  HEAD, no flank mesh                     <= 3
  26 658 panes, rebuilt per chunk           12     RED
   9 332 panes, rebuilt per chunk            4     RED
   9 332 panes, rebuilt once the ring is complete  none
```

The absolute counts are not verdicts at load1 3.9 (§0.2). **The monotone relation across three
arms of the same build is**, and it is what the schedule was written against:
`if (flankDirty && built >= generateQueue.length)` — rebuild when the resident ring is the one
the camera asked for, not once per chunk.

### 2.4 A FINDING THIS ITEM TURNED UP AND DID NOT REPAIR: `unitHash` IS NOT UNIFORM

`city.js`'s `unitHash` is `|sin((a+b+c) · 43758.5453) % 1|`. The canonical GLSL hash puts the
multiplier **outside** the sine, where it is what shreds it into a uniform fraction; this one
puts it inside, so `sin` is in [−1, 1], `% 1` is a no-op, and what comes back is **|sin| of a
scrambled argument** — arcsine-distributed, with `P(h < p) = (2/π)·arcsin(p)`.

Every "share" in that file compared against it therefore delivers a different share:

```
  written                        p       delivered   named in the comment as
  era `irregular` skip          0.25       0.161     "a quarter"
  rear-elevation skip           0.22       0.141     "half the windows of the street front"
  MERCURY_SHARE_OF_COLD         0.35       0.228     "12.2% of all windows"
  COLD_SHOP_SHARE               0.25       0.161     "a minority"
  `lit` fully on   (> 0.42)     0.58       0.724
  `lit` dead       (<= 0.30)    0.30       0.194
```

CONTRACT §9's shape with a DISTRIBUTION instead of a length. **Not repaired**: it re-rolls which
window in the city is lit, which cold and which mercury, and would move every luminance band and
every emitter census in the project. `fractHash` — the correct one — is written beside it and the
flank's own `keep` uses it, which is why 0.35 delivers 0.3500 of the bays and not 0.226 of them.

---
## 3. ITEM 3 — PEOPLE ON THE COURTS, FOR ZERO TRIANGLES

Session 56 put people on the station platform by adding each deck to the pedestrian
apportionment as one more allocation entry. A play area is that at grade, and it is easier: a
deck needs its own `y` because a person walks UNDER it, and a court is a rectangle of ground
`surfaceAt` already answers for.

**NO NEW AGENTS AND NO NEW GEOMETRY.** The population is a fixed array apportioned by largest
remainder; a play area takes a share of it. Zero instances, zero triangles, zero draw calls.

**`city.playAreas()` IS READ OFF THE DELIVERED `pitch` RECTANGLES** — item 1's own claim, so the
list of play areas IS the list of surfaces the registry calls a play area, and a pad clipped away
by a landmark contributes nothing rather than contributing a rectangle nobody drew.

**THE COUNT IS DERIVED AND THERE ARE TWO CLOCKS.**

```
  PLAY_PEOPLE_PER_M2 = 10 / (60 x 38) = 0.00439 people/m2
      ten players on a five-a-side pitch — the pitch this generator lays, because
      RECREATION.goalWidthM's own comment is "3.66 x 2.13 for five-a-side".
      Against streetlife.js's PEOPLE_PER_M2 = 0.06 for a busy pavement (Fruin LOS A
      is 0.083), i.e. 7.3% of it: "a handful per court", which is what the brief asks.

  PLAY_HOURS   pitch 07-22   court 08-21   playground 08-19
      The closing hour is the FLOODLIGHTS' curfew and not the sunset — citygen already
      puts four masts on every play area, so the ground is usable after dark by
      construction. A playground's hour is the only one that is not about light.
```

The delivered count is the product of that with `crowdFactor(timeOfDay)`, which already scales
the whole awake population. Two curves and not one, deliberately: the street's 18% night floor is
people going home, and none of them is on a basketball court.

**DELIVERED, at the operator's own pose and seed:**

```
  t = 0.6017 (14:26)   play:4,8  6      play:4,7  6      280 awake
  t = 0.0    (00:00)   no play entry at all              154 awake
```

Six is the derivation's own 6.6 for a 1 512 m² court pad, before rounding.
`tools/shot-out/s60-court-people-t0_6017-wet.png` is that frame.

**AND THE REBALANCE NEEDED A THIRD TRIGGER, WHICH IS A FINDING ABOUT THE FIRST TWO.** A rebalance
fires when the camera crosses a chunk or moves `REBALANCE_MOVE_M`. Both are properties of the
CAMERA — and a deck comes out of `LANDMARKS`, which is pure and available on frame zero, while a
play area comes out of the RESIDENT GROUND, which arrives over the sixty frames the ring takes to
build. So a camera that is placed and then stands still — **which is every gate, every `lookat`
and every film shot in this project** — rebalanced once, before the court existed, and never
again. Measured before the repair: the census at the operator's court read `4,8 78` and no
`play:4,8` at all, with the delivered `pitch` claim present in the same frame. `playSignature` is
the third trigger.

---
## 4. WHAT WAS LOOKED AT

```
  s60-court-before-t0_6017-wet.png   two trees on the playing surface
  s60-court-after-t0_6017-wet.png    the same pose, clear
  s60-court-people-t0_6017-wet.png   the same pose with six people on it
  s60-flank-before-t0-wet.png        a 102 m flank at midnight: ONE BLACK WALL
  s60-flank-after-t0-wet.png         the same wall, lit
  s60-flank-noon-after-t0_5-wet.png  the same wall at noon
```

The flank pair is the item's whole argument in two pictures: the before frame's only light is the
sliver of the FRONT elevation's windows down the corner edge, and everything else in the frame is
0/255.

---
## 5. GATE STATE

```
  gate            exit   verdict   seconds  load1 in   out
  parsecheck         0     GREEN       3.5     4.15    4.14    118 files, contract-clean
  faultcheck         0     GREEN       9.8     4.14    4.35
  lookcheck          1       RED      47.0     4.35    4.74    THE IDENTICAL THREE
  windcheck          0     GREEN      36.5     4.74    4.76
  inputcheck         0     GREEN      14.3     4.76    5.17
  gateaudit          1       RED      73.5     5.17    4.85    the carried control
  citycheck          1       RED     115.5     4.85    5.02    IDENTICAL TO SESSIONS 57-59
  perfcheck          1       RED    1026.9     5.02    2.77

  4 of 8 RED — the same four as sessions 53–59. NOT ONE NEW RED THIS SESSION,
  and every perfcheck violation was CONFIRMED CARRIED against HEAD on this
  machine rather than argued to be.
```

**`lookcheck` IS RED ON THE IDENTICAL THREE**, all origin-block assertions:
`distinct:midnight|dusk` **0.02839** against session 59's 0.02841 — a −0.00002 move on an
instrument that resolves 0.00001, in the direction sessions 53–55 record (a night city got more
lit) — plus `facadeAlbedo` and `facadeNeighbours` at dusk.

**AND THE FOUR TRADE BANDS SAW THE SESSION THAT THE ORIGIN EYE DID NOT.** Session 59 built the
second eye for exactly this and this is its first content session:

```
  time       s59 delivered   s60 delivered   move     band
  midnight      0.1906          0.1931      +0.0025   [0.158, 0.228]
  dusk          0.1975          0.1967      −0.0008   [0.162, 0.232]
  dawn          0.3176          0.3142      −0.0034   [0.283, 0.353]
  noon          0.4472          0.4478      +0.0006   [0.412, 0.482]
```

The origin eye moved by 0.00002 and the second eye's midnight moved by **0.0025** — a hundred
times more — because the lit flanks are in the second eye's frame and not in the first's. Largest
move 0.0034 against a half-width of 0.035, so all four pass with the margin they were derived to
have. **The four bands did what the second eye was built to do**, twice now.

**`gateaudit`'s only failure is `control failed`** — the same carried three. Every falsify suite
is at 100% coverage: `perfcheck` 74/74 cases, `citycheck` 67/67, `inputcheck` 13/13, the shape
and width controls both directions at every admissible view.

**`citycheck` IS IDENTICAL TO SESSIONS 57–59** on all four of its reds — clumping CV **0.393**,
the same **5** delivered overlaps, **2 of 2 647** sign quads inside a building, **1 004 of
284 918** bare walkable samples. What moved is what this session added:

```
  scene walk   345 instanced meshes, 345 labelled, 0 mismatches, 0 underdrawn
               flankQuads 9332      NEW — the one merged city:flank mesh
               windows    76598     unchanged
  occupancy    delivered by category ... pitch 1        NEW
               0 / 5 forbidden overlaps over 62 forbidden pairs (was 53 pairs)
  surface      by kind: ... pitch 320                   NEW
               a play area is a named surface a person can stand on now
  props        0 of 4657 props inside a building footprint (max 0)
```

**`perfcheck`: EVERY VIOLATION CONFIRMED CARRIED.** The machine ran at load1 5.02, so CONTRACT
§0.2 says a red absolute here is not a verdict — but the two silhouette reds on `highway_speed`
are named in LOOK.md §4 in as many words (*"only 73% of vehicles have a dark gap at the ground
against a 75% floor, and only 63% carry a non-monotone tone profile"*), and `downtown_dense`'s
four were re-measured at HEAD on this machine an hour later:

```
                        HEAD                    session 60
  downtown_dense   1.95 M / 323 draws       1.97 M / 324 draws
    CPU p95            22.20 ms                 22.20 ms
    wall p95           23.40 ms                 23.40 ms
    frames > 33 ms           36                       35
    frame entropy        4.709  RED              4.931  RED   (floor 5)
  highway_speed    2.30 M / 401 draws       2.32 M / 402 draws
```

**The entropy floor is breached at HEAD and breached less afterwards**, which is the direction
this session's content predicts: adding lit rectangles to a dark frame spreads the histogram.

**THE TRIANGLE CEILING WAS NOT TOUCHED AND STANDS AT 2 360 000.** `highway_speed` delivers
**2.32 M**, up 18 664 for 9 332 flank panes and one draw call, with **about 40 000 of the 60 000
headroom left**. §2.2's sweep says what the rest would buy.

---
## 6. WHAT TO DO FIRST NEXT TIME

1. **ITEM 4 OF THIS BRIEF NEVER ARRIVED.** The brief said four things and listed three.
2. **`unitHash` IS ARCSINE (§2.4).** Six shares in `city.js` deliver between 0.14 and 0.72 of
   what their own comments claim. It is one line to repair and a whole city of windows to
   re-measure, so it is a session's item: change `unitHash` to `fractHash`, then re-derive
   `MERCURY_SHARE_OF_COLD`, `COLD_SHOP_SHARE`, the two `lit` cuts and the two skip fractions
   against what they were MEANT to deliver, and re-run every look band.
3. **THE THREE CARRIED SEAMS ARE ONE MECHANISM (§1.3)** and the numbers are now in hand: a
   kerbside prop 8.30–8.36 m inside its neighbour's square, against two `city.js` placements that
   test only their own chunk. The repair is a memoised `generateChunk` for the east, south and
   south-east neighbours — pure, so residency order cannot change the answer.
4. **THE GATE'S REGION CANNOT SEE A SPORTS GROUND (§1).** One recreation island in a hundred
   chunks at seed 1337, and session 56 recorded the same gap for the same islands. Either widen
   `city-budget.json` → `region` (the generator sweep reads **0 conflicts over 625 chunks at
   three seeds**, so widening can only tighten it) or accept that `tools/playprobe.mjs` is where
   that population is measured.
5. **PLANTING IS NOT FURNITURE (§1.2).** 8 trees on a school yard and 98 on a church square. The
   mechanism is a `planting` category derived mechanically from `prop`'s own row so a rule that
   forbids a bollard cannot silently permit a tree.
6. **THE FLANK CAN BE SPENT UP (§2.2).** The sweep is in the table; `keep` 0.50 is +8 000
   triangles and every exposed flank at the front's own rhythm is +169 000, which the ceiling
   cannot carry until the front and rear panes stop being boxes. **That** is the change that
   would free 766 000 triangles, and it is a look decision about reveals rather than a budget one.
7. **A DELIVERED CHECK ON THE FLANK PANES IS OWED AND `signPlacement`'s CANNOT BE REUSED.**
   `citycheck` asserts `0` sign quads inside a building off the delivered matrices, which is
   exactly the shape this item wants — *"a window on a side face is a window inside the
   neighbour"* — and it would give a FALSE POSITIVE on every flank pane, twice over: a pane sits
   `FLANK.proudM` = 0.03 m outside its own tier, and `residentOccluders()` is the ENVELOPE, so a
   pane on a setback tier is legitimately inside its own building's occluder by the setback's
   own inset. The check needs the pane's OWNING building carried beside it, which the merged
   mesh does not hold today. Written down rather than approximated: a gate that cries wolf is a
   gate somebody relaxes.
8. **CARRIED, UNCHANGED**: STATE 57 §0.1, the triangle ceiling at 2 630 000, still awaiting the
   operator; session 54's five hundred lights re-run at the second eye (STATE 59 §7 item 1);
   the rest of item 2 of session 59 (holograms, gable and viaduct signage); a second eye for
   `citycheck` and `perfcheck`; shopfront glass following the clock; the platform stairs; a
   curved road; 128 blocks with 2 distinct lengths; cloudy.
9. **`decodePNG` RETURNS THREE BYTES PER PIXEL.**
