# NOCTIS — STATE

*End of session 51. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`. The machine has
**NOT** rebooted since session 40 — 10 d 2 h of uptime at the last command, the same boot as
sessions 47–50. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` RANGED 2.45 TO 4.47*** against CONTRACT §0.2's bar of **1.6**. **NO MILLISECOND IN THIS
FILE IS ADMISSIBLE IN EITHER DIRECTION** except a GREEN one, per §0.2. What is quoted is COUNTS,
areas, draw calls, triangles, populations out of the pure generator, and the delivered sweeps.

---

## 0. THE FOUR, AT HIS OWN SPAWNS

The operator walked the city after session 50 and found four defects, which the brief called four
views of one thing: **the landmarks have never been integrated with the city around them.** Three
of the four turned out to be that. The largest one was not.

```
  ?player=1&spawn=109.94,52.24,-13.60&t=0.5904&seed=1337     on earth at y -0.020
  ?player=1&spawn=146.89,34.75,-23.32&t=0.6059&seed=1337     on earth at y -0.020
  ?player=1&spawn=190.64,75.95,-11.25&t=0.5795&seed=1337     on walk  at y  0.161
  ?player=1&spawn=-163.75,8.97,129.28&t=0.6364&seed=1337     on road  at y  0.001
```

**ALL FOUR REPRODUCE TO THE MILLIMETRE** through `tools/lib/headlesscity.mjs`, which was the first
thing done and is what makes everything below comparable with his frames. `tools/surfacegrid.mjs`
prints them as its own control on every run, and after this session it prints:

```
  REPAIRED  (109.94, -13.60)   s50 earth -0.020  ->  now ground 0.000
  REPAIRED  (146.89, -23.32)   s50 earth -0.020  ->  now ground 0.000
  HELD      (190.64, -11.25)   s50 walk   0.161  ->  now walk   0.161
  HELD      (-163.75, 129.28)  s50 road   0.001  ->  now road   0.001
```

Frames, `-before` being session 50's shipped build (`df92c7f`) re-photographed from the identical
poses in a paired worktree:

```
  tools/shot-out/
  s51-weir-{air,street}*.png    THE ONE THAT READS. Four corners of flat brown earth round a
                                210 m bowl -> grass to the claim's own edge, trees and benches
                                on it, and a RAILING round a nine-metre drop that has been open
                                since session 4. The street still ends dead at x = -195.
  s51-dish-air*.png             A forecourt under the cone's overhang, and the apron staircase's
                                2.1 m steps ARE visible from 110 m as a zigzag. A cost, printed.
  s51-dome-street*.png          The exchange's forecourt and its bollards.
  s51-core-{air,street}*.png    ALMOST NO VISIBLE DIFFERENCE, AND THAT IS §1's FINDING.
  s51-core2-air*.png
```

---

## 1. THE LARGEST GAP IN THE CITY WAS NOT A LANDMARK. IT WAS THE ORIGIN BLOCK.

Item 1a asked for the player's own question, asked systematically. `tools/surfacegrid.mjs` samples
`city.worldSurfaceAt` — *"THE ONE FUNCTION the ground datum points everything at"*, `city.js`'s own
words — over the resident ring, with `city.walkableAt` as the denominator so that a point inside a
building is dropped rather than counted as covered. **The share it prints is therefore the share of
the ground a person can actually reach**, which is what the complaint is about.

**IT IS NOT `bareprobe`, AND THE TWO REASONS ARE BOTH PROPERTIES OF WHAT `bareprobe` READS.** It
reads the GENERATOR, which has no opinion about residency, about `CITY.groundRadius`, or about
`BLOCK_KEEPOUT` clipping a rectangle away afterwards. And its precedence attributes every square
metre inside a landmark claim to the landmark, so the weir's empty corners print as `landmark`.
Run at HEAD it reports **0.47%** bare. The delivered city reported **2.5%**.

```
  surfacegrid, seed 1337, ring 5, 2 m step, 283 259 walkable samples = 113.30 ha

                                BEFORE              AFTER
  BARE                          2.88 ha  2.5%       0.35 ha  0.31%
    origin block keep-out       1.68 ha  58.2%      0.00 ha       four patches, 162 x 34 m each
    landmark:weir               0.88 ha  30.4%      0.03 ha       four patches,  84 x 84 m each
    river envelope              0.15 ha   5.3%      0.15 ha
    island, no surface          0.14 ha   4.8%      0.14 ha       2 m seams
    landmark:viaduct            0.04 ha   1.4%      0.04 ha       two 14 x 14 m end pads
```

### 1.1 THE ORIGIN BLOCK — 58.2% OF IT, AND BOTH OF HIS `on earth` POSITIONS

**TWO CORRECT DECISIONS MEETING.** `city.js` clips every streamed ground quad out of
`BLOCK_KEEPOUT` — 336 × 92 m — *"so that this one wins"*, which is `blockSurfaceAt`'s own comment
and is right: the block authors its own street. And what `block.js` authored was a street CROSS —
a carriageway, a cross street and four pavement boxes. **The four quadrants behind the kerb were
authored by nobody**, and the only thing under them is the 8 km earth plane.

It is not a new surface; it is the missing half of one. Every other `built` island in this city has
a core: `citygen.js` emits `coreGround` over the island inside its perimeter ring and `city.js`
lays it at `GROUND.carriageway` in what was a literal `coreAlbedo`. The origin block IS a `built`
block. Four quads, **one draw call, eight triangles**, derived from the same `halfCross` and
`walkOuter` the pavement boxes and `blockSurfaceAt` already use. `coreAlbedo` is now
`GROUND.coreAlbedo` and both files read it, because the two cores MEET at `BLOCK_KEEPOUT.x1` = 168.

### 1.2 AND IT IS NEARLY INVISIBLE, WHICH IS WHY IT SURVIVED NINE SESSIONS

`s51-core-air` before and after are hard to tell apart, and the reason is a repair:
**session 42 calibrated `GROUND.earthAlbedo` to the area-weighted mean of the city's own drawn
ground** — `[0.1229, 0.1211, 0.1168]` against the core's `[0.105, 0.102, 0.096]`, a 15% difference
on one channel. Before that it was `0x4a4640`, half as bright and a third redder, and a missing
surface read as *"wide brown fields"*.

**SO A MISSING SURFACE IS NO LONGER A BROWN FIELD. It is a surface of about the right colour that
is not there, 0.18 m below where it should be.** That is why 1.68 ha of it at the origin — where
the player spawns and where every calibration camera stands — survived nine sessions of people
looking at frames, and it is why this item needed a probe and a gate rather than a camera. It is
also the first time a repair in this project has made a later defect *harder* to see, and that is
worth carrying forward: **every future "the ground looks fine" is now worth one `surfacegrid` run.**

### 1.3 THE STANDING CHECK — ITEM 1d

`harness.surfaceCensus(region, step)` is the same walk inside the page; `citycheck` reads it and
`occupancy.maxBareWalkableSamples` is **0**. Zero is the only defensible number, for the reason
`maxDeliveredConflicts` and `maxPropsInsideBuildings` are zero: a tolerance is a licence for the
fourth instance, and the first three (sessions 34, 40, 42) were each a place somebody could stand.
**IT SHIPS RED AT 887 SAMPLES AND IS SUPPOSED TO.** `citycheck --falsify` is 64/64 at 100%
coverage with three new cases: a bare surface, an absent census, and a lattice too small to mean
anything.

The residue is four named places, none of them mysterious, and `--patches` prints them:

```
  1112 m²  (-194, -378)  108 x 12   river envelope, the dry margin inside the bank
   196 m²  ( -93, ±207)   14 x 14   the viaduct's two end treatment pads
   208 m²  ( 481, -576)    2 x 104  an island seam — twelve of these, all 2 m wide
    ~30 m² each                     the apron staircase's own corner residue, 8.3% of the corners
```

---

## 2. ITEM 2's HYPOTHESIS IS FALSIFIED BY THE CODE, AND THE DEFECT IS ONE LEVEL IN

The brief supposed the registry still used the canyon bake's AREA-INSCRIBED boxes as the ground
keep-out, so that *"a round landmark's edge lies outside its own claim by construction while every
measurement says it fits"*. **Session 42 repaired exactly that and the repair holds.**
`landmarkOccluders` carries `gx0..gz1` beside `x0..z1`, the ground extent is CIRCUMSCRIBED where
the bake extent is inscribed, and `landmarkGroundClaims` reads the `g` fields.

`tools/landmarkcensus.mjs`, re-run this session (item 2a), seven of eight resident:

```
  landmark    claim AABB   claim m2  claims   delivered      del/claim   y span
  condenser   124 x 124      36040     4    not resident
  stack        79 x 79       21387     7      78.8 x 78.8      0.993    [0.00, 133.00]
  arch        133 x 15         450     2     124.5 x 12.8      0.795    [-0.31, 99.90]
  viaduct     109 x 445        601    46     110.2 x 448.0     1.016    [0.00, 27.20]
  exchange     66 x 66        6614     2      66.0 x 66.0      1.000    [0.00, 46.00]
  weir        210 x 210      44100     1     210.0 x 210.0     1.000    [-10.90, 0.40]
  mast         15 x 15         234     1      12.0 x 11.7      0.597    [0.00, 188.48]
  dish         88 x 88        7744     1      88.0 x 88.0      1.000    [0.00, 58.00]
```

**NOT ONE LANDMARK EXCEEDS ITS CLAIM.** The dish reads **1.000** where session 35 read **2.041**;
session 46's "six of eight clean" is now seven of seven, with the viaduct's 1.016 the expected
legs-claimed-deck-delivered case and the mast's 0.597 the deliberate over-claim its own comment
derives. **There is nothing to make bigger, so item 2b is answered by not doing it.**

**AND `landmarkcensus` HAS PRINTED THE REAL FINDING UNDER THAT TABLE FOR SIX SESSIONS:**

> `del/claim` is delivered BOUNDING BOX over claim AABB, so it is 1.000 for a structure that
> exactly fills its keep-out **WHATEVER ITS SHAPE** — a round one reads 1.000 and still leaves
> `1 − π/4` = **21.5% of the claim in the corners**.

**A CLAIM IS A RECTANGLE AND FOUR OF THE EIGHT LANDMARKS ARE ROUND.** `landmark` forbids
`carriageway`, `pavement`, `path`, `prop`, `canopy`, `sign`, `site` and `feature` — every surface
this city can lay and every object it can stand on one. So the corner of a round landmark's claim
is ground spoken for by a thing that is not there, and no generator in the project is permitted to
put anything in it. **The weir's four corners are 9 464 m² by construction and were 0.88 ha of the
bare earth §1 measured** — a number `landmarkGroundClaims`' own header has carried since session 34
as a *disagreement between two predicates*. It is not a disagreement. It is a place.

### 2.1 THE `precinct` CATEGORY, AND WHAT IT COST TO GET RIGHT

`precinct` — the ground a landmark's claim TAKES and the landmark does not STAND ON. It forbids
**`building`, `carriageway` and `water`**, which are the readers the claim was written for, and
permits a surface, its furniture and its planting. It is the row `landmark` has with six entries
removed. `landmarkClaimParts(l)` is the split and **BOTH sides call it** — the generator's registry
and `city.js`'s delivered census — because reading the unsplit list on one side is session 34's own
sentence: *"two halves of the project's two-sided occupancy check ... describing two different
worlds."* The first arm did exactly that, and the sweep printed it.

**ITEM 2c ASKED FOR THE COUNT OF WHAT IS NOW REFUSED, AND THE HONEST ANSWER IS NOTHING**, because
the union of the split is the claim that was there before:

```
                       session 50        session 51
  carriageway          38.315 ha         38.315 ha
  pavement             16.799 ha         16.799 ha
  coreGround           43.305 ha         43.305 ha
  buildings                 674               674
```

Every one to the digit, over `citycheck`'s own 10 × 10 region. `citycheck` reports **109 refusals
by `precinct`** — the same 109 `landmark` was making before, wearing the new name.

**THREE THINGS THE SPLIT COST BEFORE THEY WERE FOUND, EACH MEASURED, AND EACH ONE IS CONTRACT §9's
SHAPE WITH SOMETHING OTHER THAN A LENGTH:**

1. **THE SETBACK TABLES ARE KEYED ON THE CATEGORY NAME.** `BUILDING_SETBACKS = { landmark: 4.2 }`
   applied to half of what it used to the moment `landmark` became `landmark | precinct`, and
   **the perimeter walk placed 680 buildings where it had placed 674**. Not a conflict-table
   defect — `precinct × building` is forbidden and all six are outside the claim. It is the part
   of "occupancy" that lives in a key rather than in the table.
2. **`subtractBoxes` DROPS A PIECE UNDER 0.35 m AFTER EACH BLOCKER AND THE FILTER COMPOUNDS.**
   Cutting a carriageway against one 210 m box and against the eighty-eight staircase boxes that
   PARTITION it are the same set difference and not the same result: 0.004 ha of carriageway and
   0.005 ha of pavement lost, six more buildings. The road clip now keeps the landmark's own claim
   rectangles (`landmarkSolids`), in the registry's own blocker ORDER, because `subtractBox` is a
   guillotine and the order decides which sub-pieces fall under the filter.
3. **`afterRefusal` RESUMES PAST `hit.x1`.** The perimeter walk skips to the far side of whatever
   refused it, so a hit that is one 2.1 m tread advances `t` by 2.1 m where the 210 m claim
   advanced it by 210 — and every `rng` draw after that is a different draw. **A partition can be
   exact as a SET — verified over three chunks at 0.25 m, zero disagreements in 262 144 samples of
   the 4.2 m-dilated union — and still be a different obstacle.** The precinct is therefore claimed
   as the WHOLE rectangle with the landmark's solid part claimed over it, which is the
   `deck × landmark` arrangement `occupancy.js` already documents.

---

## 3. THE LANDMARKS HAD NO FIXTURES BECAUSE OF ONE LINE, 1800 ABOVE THEM

```js
  const lowDetail = !hasLandmark && density < CITY.lowDetailThreshold;
```

**A chunk that touches a landmark is NEVER low-detail**, so it never enters the branch that holds
`lay`, `layPath`, `bayRows`, `floods`, `fence`, `boundaryRun` and the prop palette. Three sessions
of fixture work sits behind a predicate every landmark in the city fails by construction. The
exclusion is CORRECT — a landmark chunk is not a works yard — and what was missing is the
landmark's own programme.

`LANDMARK_APRON` is that programme, and **every row is what its own `LANDMARKS` entry already says
it is**:

```
  condenser  yardGround + palisade + cabinets, stacks, bollards   L 21 m
             "260 m district heat-rejection tower" — a works compound
  exchange   apron paving + bollards, planters, benches           L 12 m
             "a preserved 1890s exchange hall" — a civic forecourt, no railing:
             a forecourt you cannot walk onto is a car park
  weir       grass + RAILING + trees, benches, bins               L 18 m
             "a stormwater basin and SUNKEN PARK", and there has never been a
             park in it. The railing is at a nine-metre drop.
  dish       apron paving + bollards, planters, benches           L 12 m
             "a 58 m inverted-cone civic hall" — the one plaza you stand under
```

**SIZED FROM THE LANDMARK'S OWN CLAIM (item 3b).** The apron is `landmarkPrecinct(l)` — the part of
the claim the landmark does not stand on, which for a round landmark in a square claim is 21.5% of
it by geometry. The boundary ring is on `landmarkGroundRadius`. The furnishing count is
`area / L²`, which is `DEAD_ZONE`'s own `(104.6 / L)²` said for a shape that is not an island, with
the same `L`. **Not one length in that table is a constant.** It adds no mesh (item 3c) — `edge`
features and `bollard`, `bench`, `tree`, `planter`, `cabinet`, `stack`, `bin` props, all of which
sessions 40 and 47 already built.

### 3.1 THE STAIRCASE, AND ITS TWO COSTS

The apron is decomposed as a staircase per quadrant, each step's inner edge taking the circle's
half-width at the step's INNER coordinate so that **every box is strictly outside the circle** —
under-stating would put a grass surface a few metres inside the weir's rim, over a nine-metre hole,
which is `block.js`'s own *"a plane above water hides water"* with a basin. The step is
`CITY.sidewalkWidth / 2` = 2.1 m, half a footway, chosen from a sweep:

```
  step    boxes    condenser   exchange   weir    dish      of the true corner area
  4.2 m     200      86.8%       76.5%    91.7%   82.4%
  2.1 m     408      92.9%       87.3%    95.7%   90.2%     <- shipped
  1.4 m     620      95.2%       91.2%    97.1%   93.3%
```

**COST ONE: the residue is earth**, 8.3% of the weir's corners, and it is in §1.3's list.
**COST TWO: the steps are visible.** `s51-dish-air` is taken from 110 m and the 2.1 m treads read
as a zigzag along the plaza's outer edge rather than as a curve. That is the honest cost of a
box-only geometry kernel and it is printed rather than hidden; a later session that wants a curve
there wants a different primitive, not a smaller step.

Delivered surface: **1.02 ha of `precinct` across the four**, `apron` 0.231 ha, `apronGrass`
0.905 ha, `apronYard` 0.307 ha out of the pure generator.

### 3.2 AND THE HALF OF ITEM 3a THIS DOES NOT REACH — READ `s51-dome-street` FOR IT

The brief asked for *"a boundary against the street, a way in, a forecourt or plaza"*. This
delivers the forecourt and the boundary; **it does not deliver the boundary AGAINST THE STREET, and
the geometry says why.** A circle inscribed in its own square claim TOUCHES that square at the
midpoint of each side, so the precinct is 21.5% of the claim at 45° and **exactly zero at 0° and
90° — which is where the streets are.** `s51-dome-street` is the proof: the exchange's drum wall
meets the pavement with nothing between them, which is the operator's *"the dome's skirt overhangs
the street"* still standing after everything above.

Measured: the nearest carriageway comes within **0.02 m** of the dome's 33 m skirt, at (121, −143).
Not because the dome exceeds its claim — it does not, §2 — but because **the claim IS the plan
silhouette exactly, with no setback in it.** Every other object in this city stands behind a kerb; a
landmark stands with its wall in the gutter.

**THE REPAIR IS THE ONE THE BRIEF ALREADY NAMED AND THIS SESSION DECLINED FOR THE WRONG REASON.**
Item 2b said *"repair the claim to cover what is delivered — that is stricter, not looser"*, and
§2's census answered that nothing exceeds its claim, so nothing was grown. The census was right and
the conclusion was half wrong: the claim needs to grow not to COVER the landmark but to hold its
apron, by one footway all the way round. That moves the road clip, which re-phases the city, which
is why it needs its own measured arm rather than the end of this one. §6 item 2.

---

## 4. THE STREET THAT ENDS IN THE SQUARE — MEASURED, AND HALF BUILT

**ITEM 4a ASKED HOW MANY ENDS ARE LIKE THIS BEFORE BUILDING, AND THE ANSWER IS MANY.** Swept over
`citycheck`'s own 10 × 10 region at seed 1337, counting every delivered carriageway piece whose end
is interior to its own lattice span:

```
  202 delivered carriageway pieces
   63 CUT ENDS — a carriageway that stops where no junction is
   55 distinct end LINES

  river/other  28      origin-block  8      landmark:weir       8
  landmark:condenser 4  landmark:dish 4     landmark:exchange   4
  landmark:arch      4  landmark:stack 3
```

**So it is the general rule and not the roundabout.** His own is `EW z=128 @ x=-195`: the basin
claims a **square** 210 × 210 AABB where its bowl is a 210 m CIRCLE, so the road is guillotined at
x = −195 and the true rim on that line is at x = −197.33 — **the street stops 2.33 m short of the
edge of the hole, on ground that until this session was bare earth.**

**AND THERE IS NO CONCEPT OF A STREET END ANYWHERE IN THIS CODEBASE.** A repo-wide search for
`cul-de-sac | dead end | turning head | turning circle | roundabout | terminat` over `src/`,
`tools/` and `docs/` returns two incidental lines, neither about a road. A road ends because a
rectangle got guillotined and nothing in the project knows it happened. **THE TURNING HEAD IS NOT
BUILT. It is §6 item 1 and the measurement above is the handover.**

### 4.1 WHAT WAS BUILT: THE FLEET STOPPED DRIVING THE ORIGIN BLOCK — ITEM 4b

Item 4b asked what the traffic model does when a lane simply stops, and the answer is worse than
the question: **nothing tests the far end, and until this session nothing tested the origin block
either.** `traffic.js` refuses a lane the river took (`riverNoRoad`, session 15) and a lane a
landmark took (`landmarkOccupies`, session 34), and has never had the third sentence, because
`insideKeepout` was module-private and exported to nobody. Measured off `worldSurfaceAt` — the
player's own query — on the driving lanes themselves, |t| ≤ 60 m at 1 m:

```
  lane            road   ground   walk    not a carriageway
  x = +128 NS       45      68       8        76 of 121
  x = -128 NS       45      68       8        76 of 121
  x =    0 NS      121       0       0         0 of 121
  z =    0 EW      121       0       0         0 of 121
```

**Two lattice lines, about 76 m each, driven since session 4b.** The block paves exactly two lines
through its own keep-out — its street on z = 0 and its cross street on x = 0 — and both are lattice
lines, which is why nobody noticed: the two it DOES pave are the two the eye is always on.
`blockNoRoad` is `riverNoRoad` one keep-out over, tested at nose, centre and tail like the landmark
predicate, on both the seed path and the recycle path.

**AND §1 MADE IT WORSE BEFORE IT MADE IT BETTER**: those 68 m used to be the earth plane, and are
now the block's core surface, so what a frame showed between the two changes is a van driving
across a service court.

The recycler's own remaining gap is unchanged and is recorded rather than repaired: `if (veh.turn)
continue;` exempts a turning vehicle from the whole off-road test for the duration of its arc, and
the turn decision never checks whether the road it is turning into exists.

---

## 5. GATE STATE

Run individually, because `npm run gates` chains with `&&` and lookcheck's seventh-session red
stops everything after it. **That is item 1 on STATE 49's and STATE 50's lists and it is still
true.**

```
  parsecheck   GREEN   113 files, contract-clean. 112 -> 113: `tools/surfacegrid.mjs`.
  faultcheck   GREEN   7 cases.
  windcheck    GREEN   569 mesh names over 569 meshes (floor 400), 565 of 565 cull-eligible
                       decided, 0 wound backwards. 567 -> 569: `block:core` and the apron
                       surfaces ride existing meshes; the two new names are the core quad set.
  inputcheck   GREEN   keyboard, mouse and gamepad each deliver their own constant.
  lookcheck    RED at 3 — THE SAME THREE AS SESSIONS 45-51: distinct:midnight|dusk,
                       facadeAlbedo:dusk, facadeNeighbours:dusk. `distinct` reads 0.02992
                       against 0.03000 where session 50 read 0.02993 — ONE PART IN THIRTY
                       THOUSAND, and it is attributable: §1.1 put a new surface inside the
                       origin block, which is the only content this camera can see. L15 is
                       owed a derivation for a seventh session.
  gateaudit    RED at 1, the carried control, naming exactly lookcheck's three.
  citycheck    RED at 4 — one MORE than session 50, and the fourth is the new gate.
                         clumping CV 0.389 against 0.60 — WAS 0.400. §5.1
                         2 of 2720 sign quads inside a building, the same two
                         4 delivered overlaps (was 3) — the three carried plus one, §5.2
                         887 of 283 259 walkable samples on bare earth — THE NEW GATE, §1.3
                         alignment 73.6% off-axis, largest deviation 2.27° against 3° — GREEN,
                           and it was RED at 42.80° in the first arm. §5.3
                         generator claims 16 152 (was 13 128), delivered 17 125 (was 15 060)
                         prop 3776, feature 5224, precinct 488, landmark 1701
                         the registry REFUSED: building 186, precinct 109, block 40, water 31
                         bright reserve 6.62% against 6.00 — GREEN, three runs [6.62 6.82 6.23]
                         saturation 3.98% pooled peak against 12, three runs [3.57 3.98 3.98]
                         negative space 17.0% low-detail, 9 kinds (min 3)
                         prop placement 0 of 3544 props inside a building
                         walkability 54 304 of 54 438 — IDENTICAL to sessions 46-50. Five
                           sessions of new content and the city is walkable to the cell.
  perfcheck    see §5.4
```

### 5.1 CLUMPING COST 0.011, AGAINST SESSION 50's 0.128

`clumping` CV **0.400 → 0.389** against a floor of 0.60. Session 50 paid 0.128 for ten kinds of
fixture floor and said so; **this session pays 0.011**, and the brief asked for the number either
way. The mechanism is the same one and it is smaller because the content is confined: the apron
adds objects to the sixteen landmark-touching chunks of a hundred, so it narrows the middle of the
distribution by about a twelfth of what filling ten island kinds did.

`objects/chunk` min **12** max 92, where session 50 read min 0 max 92 — **the minimum moved off
zero**, which is the half of this statistic that is worth having and is not what the CV measures.
Over twelve regions (seeds 1337–1348) the CV reads median **0.380**, spread 0.274, 12 of 12 below
the floor. **NO THRESHOLD WAS MOVED.**

### 5.2 THE DELIVERED SWEEP WENT 3 TO 5 AND THEN BACK TOWARD 3

The three carried since session 24 are unchanged. `emitcensus`'s control sweep is the same path.
Two were earned during the session and one of them was paid off before it shipped:

```
  prop(planter)  x prop(lamp:column)   0.064 m²   at (-141.9, 119.6)   SHIPS
  prop(bench)    x feature(edge:wall)  0.001 m²                        FIXED
```

The one that ships is a scatter prop meeting a street lamp. **`city.js` places the lamps AFTER the
pure generator and claims them into no registry band that the scatter can test against — session
23's open gap, still open** — so nothing the generator places can avoid one. This pair is not new
in KIND, it is newly unlucky: the apron's claims re-phased the scatter in the sixteen
landmark-touching chunks (**284 props moved, 358 appeared**, buildings and roads untouched) and one
landed 0.16 m from a column. That re-phase is the price of `precinct` deliberately permitting what
`landmark` forbade, and it is the same trade every content session in this project has made.

The one that was fixed is a delivered-extent margin: a prop's registry claim is `propHalfWidth` and
`city.js` draws the boxes that model is made of, and the two agree to a millimetre rather than to
zero. `APRON_SETBACKS.feature = 0.25` is a bench standing clear of a wall, and the final run reads
**4**.

### 5.3 THE ALIGNMENT CRITERION CAUGHT A FREE ROTATION IN ONE LINE

The first arm gave apron props `apronRng.range(0, 360)` and `citycheck` reported
**largest deviation 42.80° against a 3° ceiling**, on a criterion green since session 35. A free
rotation is not a hand-placed object, it is an object nobody placed. Apron props now take `yaw()` —
the city's own jitter, drawn from `yawRng`, which is safe only because the apron runs LAST — and
the boundary ring declares `refDeg` equal to its own chord tangent, which is the field session 35
added for exactly this. **2.27° against 3°.**

### 5.4 PERFCHECK — RED AT 11, FOUR FEWER THAN SESSION 50, AND EVERY COUNT IS PRINTED

```
                          draws  s50    tris   tris s50   instances   inst s50
  downtown_dense            319  317   1.96M     1.95M     244 774   244 137
  highway_speed             398  396   2.24M     2.23M     320 789   319 848
  night_rain                319  317   1.93M     1.92M     300 803   299 768
  player                    308  306   1.91M     1.90M     244 774   244 137

  roles  aircraft:1  traffic:96  stall:12  block:56  lamp:192  sign:16   — identical
```

**`highway_speed` IS 398 OF 440 DRAW CALLS AND 2.24 M OF 2 360 000 TRIANGLES.** Instances are up
**0.29%** on that route against session 50, where session 50 was up 0.5% on session 49.

**THE +2 DRAW CALLS ARE BOTH ACCOUNTED FOR AND ONE OF THEM IS CONTENT.** Diffed off the scene
graph, 329 → 331 meshes at seed 1337:

```
  block:core     0 -> 1     §1.1's four quads, one mesh, eight triangles
  -3,1:masses    0 -> 1     a chunk beside the weir that had NOTHING in it before and now
                            has an apron in it. Not overhead — a mesh appears because a
                            chunk stopped being empty.
```

`windcheck` reads the same +2 as 567 → 569 mesh names over 569 meshes.

**THE ELEVEN SPLIT NINE / ONE / ONE.**

**NINE ARE FRAME TIME**, at `load1` 2.91–4.47 with a browser rendering. Not admissible in either
direction (§0.2). **`highway_speed`'s is NOT among them for the FOURTH session running**: wall p95
**12.10 ms against 12.5** with a three-run spread of **0.1**, cpu p95 **10.80 against 12.00** with
a spread of **0.0**. §0.2 says a GREEN absolute under load IS a verdict, and that route's spread is
the one the quiet bar's own battery resolved.

**ONE IS THE VEHICLE SILHOUETTE BAR**, `59% of 64 vehicles carry a non-monotone tone profile`
against a 75% floor. Its sibling, `tone roughness`, reads **0.7464 — GREEN**, against 0.7675 last
session and 0.2882 / 0.4786 the session before. Session 49 measured this pair straddling across
four runs and session 50 confirmed it. **Confirmed unstable for a third session; not acted on.**

**ONE IS THE HEADROOM PROBE**, whose own defect (`neverExceedNative` shades the same pixels twice
and calls the second one headroom) is recorded in CONTRACT §0.1 and is why its number is not
evidence either way.

### 5.5 SESSION 50's THREE LUMINANCE REDS ARE GREEN THIS SESSION, AND THAT IS NOT A REPAIR

STATE 50 §5.3 attributed three new reds — `downtown_dense` mean 0.0757 and entropy 4.817,
`night_rain` mean 0.0779 — to session 50's fill: *"§1 added hundreds of UNLIT DARK OBJECTS ... At
night an unlit mass occludes lit ground and returns almost nothing"*, and called the shift
one-directional over three runs a side.

**THIS SESSION ADDED MORE UNLIT DARK MASS — trees and benches on the weir's rim, stacks and
cabinets in the condenser's compound — AND ALL THREE READ GREEN**, at a higher load:

```
                          session 49 per run          session 50 per run          session 51 per run
  downtown_dense mean   0.0889 0.0778 0.0903      0.0689 0.0808 0.0757      0.0895 0.0906 0.0934
  downtown_dense entropy 5.203 4.900  5.195        4.714 4.981  4.817        5.189 5.170  5.277
  night_rain mean       0.0801 0.0896 0.0819      0.0772 0.0779 0.0837      0.0840 0.0839 0.0838
```

**SESSION 51's THREE DOWNTOWN MEANS ARE ABOVE ALL SIX OF SESSIONS 49 AND 50's.** Nothing in this
session lit anything, and the content moved the other way. **So session 50's attribution is NOT
confirmed, and the honest reading is the one CONTRACT §0 rule 6 asks for: this statistic's
run-to-run spread is of the same order as its margin, and a three-run set is not enough to resolve
a 0.010 shift on it.** The `night_rain` spread within this session is 0.0002 and between sessions
it is 0.007 — thirty-five times larger — which is the signature of a between-run term nobody has
identified. **DO NOT ACT ON IT IN EITHER DIRECTION**, and item 3 of §6 (lighting the fill) is still
worth doing because it is right about the world, not because of these numbers.

---

## 6. WHAT TO DO FIRST NEXT TIME

1. **GROW THE LANDMARK CLAIMS BY ONE FOOTWAY.** §3.2, and it is the half of the operator's item 3
   this session did not reach. The precinct is 21.5% of the claim at 45° and ZERO where the streets
   meet it, so the dome's wall still stands 0.02 m from a carriageway. `LANDMARK_APRON` and
   `landmarkPrecinct` are already the shape this needs — the change is that `landmarkGroundClaims`
   gains a `CITY.sidewalkWidth` margin and the precinct becomes the claim minus the silhouette
   rather than the corners of it. It moves the road clip and re-phases the city, so it wants its
   own arm with the §2.1 table run beside it.
2. **THE TURNING HEAD.** §4. The measurement is done — **55 distinct end lines, 63 cut ends over
   202 carriageway pieces**, 27 of them a landmark's and 8 the origin block's — and the general
   rule is what is owed: a street that meets something impassable must end like a street ends. The
   vocabulary is there (`walk` rects bring a kerb riser, which has HEIGHT and therefore reads —
   session 50's own rule) and the placement must be probed against the registry, because at the
   weir the head has to go somewhere the claim is not.
3. **LIGHT THE FILL.** STATE 50 §6 item 1, untouched. `floods(n)` takes a constant 2–3 while the
   fixture floors put up to 38 objects on an island, and the landmark aprons now put trees and
   stacks on four more. Do it because it is right about the world — a worked compound with a
   palisade round it IS lit — and **not** because of the night luminance numbers, which §5.5 shows
   moving the opposite way to the content across three sessions.
4. **`npm run gates` STILL RUNS THREE GATES OF EIGHT.** Item 1 on STATE 49's and 50's lists.
5. **THE ARENA.** STATE 50 §4's recipe is still half an hour and still unspent.
6. **SESSION 23's LAMP GAP IS WHAT THE DELIVERED SWEEP KEEPS FINDING.** §5.2. `city.js` claims
   382 street columns into the delivered census and into no registry band, so nothing the generator
   places can avoid one. Two of the five overlaps in this project's history are that.
7. **THE APRON STAIRCASE READS AS STEPS FROM THE AIR** (§3.1) and leaves 8.3% of the corners bare
   (§1.3). Both are the same limitation: every keep-out in this project is an AABB and every
   surface is axis-aligned. A curve wants a different primitive.
8. **CLUMPING IS 0.389 AGAINST 0.60** and the statistic is still measuring how much parkland is in
   the window — `city-budget.json`'s own `$s37` derivation says so at length and names the
   replacement. Unmoved for fourteen sessions.
9. **HOIST THE BUILDING CLAIMS IN `buildChunkBody`** — session 47's item 1, still what blocks
   facade clutter.
10. **SESSION 49's UNATTRIBUTED GROUND-CONTRAST MOVEMENT**, and **L1 / L15**, owed a derivation for
   a seventh session. Do not lower `minPairMSD` to 0.029.
11. **THE SCHOOL'S COURT MARKINGS RUN OFF THEIR OWN PAD** — STATE 50 §6 item 4, untouched.
