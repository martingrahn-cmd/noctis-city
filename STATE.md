# NOCTIS — STATE

*End of session 54. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`. The machine has
**NOT** rebooted since session 40 — 11 d 1 h of uptime at the first command, the same boot as
sessions 47–53. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` READ 1.62 AT THE FIRST COMMAND — 0.02 OVER CONTRACT §0.2's BAR OF 1.6 — AND NEVER CAME
INSIDE IT AGAIN.*** The session spent its middle in a browser and one headless Chromium measures
130% CPU. **NO ABSOLUTE MILLISECOND IN THIS DOCUMENT IS A VERDICT** unless it is green, and each one
says the load it was drawn at. Everything else quoted is COUNTS, areas, code values, metres,
reflectances and populations out of the pure generator or off a delivered frame.

---

## 0. THE MIDNIGHT FRAMES, BEFORE AND AFTER — THE ONE THE BRIEF SAID TO OPEN WITH

The brief: *"Frames are the verdict, at his own spawns, before and after, and at MIDNIGHT for
item 1 — that is where he found it."* `tools/shot-out/`, and the `-before` arm is a **paired git
worktree pinned to `1f2a3a2`** rather than a stash, so the two frames are two builds and not one
build twice (the arrangement STATE 53 §0 used).

```
  s54-court-nadir-{before,after}-t0-wet.png   MIDNIGHT, straight down over the block interior at
                                              (172, 192) from 120 m. THE ITEM 1 FRAME.
  s54-weir-air-{before,after}-t0-wet.png      MIDNIGHT over the weir's basin from 300 m — the
                                              apron, its railing and its staircase, from high
                                              enough to clear the 90 m blocks that stand round it.
  s54-rim-{before,after}-t0_5-wet.png         At x = 3560, 140 m up, looking BACK at the city from
                                              328 m OUTSIDE its own edge. THE ITEM 6b FRAME, and
                                              the one that reads at a glance.
  s54-church-{before,after}-t0_5886-wet.png   HIS OWN SPAWN, item 4. Dusk and midnight.
  s54-district-{before,after}-t0_6117-wet.png HIS OWN SPAWN, item 5. Dusk and midnight.
  s54-station-{before,after}-t0_5297-wet.png  The viaduct station from the main street, item 2.
  s54-dome-{before,after}-t0_5904-wet.png     HIS OWN SPAWN, item 3 — and the two arms are the
                                              SAME PICTURE, because item 3 was NOT BUILT. §8.
  s54-yard-air, s54-yard-gate, s54-court-air  three cameras that did NOT show their subject and
                                              are kept as the record of that: a block interior is
                                              walled on four sides by 40 m buildings, which is
                                              what LOOK.md §2 asks for, so it is legible from the
                                              street through its own GATE and from directly above
                                              and from nowhere else.
```

**AND THE MIDNIGHT PAIRS MEASURED, BECAUSE A FRAME MEAN IS THE WRONG STATISTIC FOR A LOCAL LIGHT.**
`decodePNG` checked for THREE bytes per pixel first, per STATE 52 §2.2:

```
  frame               whole-frame mean      pixels changed    THEIR mean change
  court-nadir       0.12028 -> 0.11983            0.85%           +0.0308
  weir-air          0.06634 -> 0.06615            0.72%           +0.0202
  district (t0)     0.07400 -> 0.07375            9.21%           +0.0074
  church (t0)       0.12324 -> 0.12208            5.26%           -0.0317
```

**The pixels a courtyard light changed got 0.031 BRIGHTER and there are 0.85% of them.** That is
what lighting a block interior looks like as a number, and it is why the whole-frame mean moves by
−0.0005 and says nothing: session 53 §6.1.1 made the same arithmetic argument in the other
direction. The church frame is the only one that goes DARKER, and the cause is §4.3 rather than
§1 — its nave rolled BRICK, which is 0.101 luminance against the 0.305 constant it replaced.

**AND THE SESSION IN ONE SENTENCE:** the city had built places and not made them inhabitable, so
the session lit every one of the fifteen island kinds and all four landmark aprons (§1), gave the
churchyard the content it is named after (§3), measured item 5's three spreads and found two of
them **exactly zero** (§4), stopped the road lattice at the city's own edge (§5), and made the
train arrive, dwell and depart on its own track (§6) — and left items 2a and 3 unbuilt, which §8
says in as many words.

---

## 1. ITEM 1 — LIGHT THE GROUND, AND THE BRIEF'S PREMISE WAS FALSE FOR ELEVEN OF FIFTEEN KINDS

The brief: *"Since session 47 the city has gained 10 668 m of courtyard wall, fifteen island kinds
of fixtures, eight kinds of place, landmark aprons and steps. NONE OF IT IS LIT."*

**MEASURED FIRST.** `tools/placeprobe.mjs --light`, the pure generator, seed 1337 over the 17 × 17.
`city.js` turns a `lamp` or a `flood` feature into a lamp-pool candidate and an emissive bowl and
turns nothing else into either, so *"is this kind of place lit"* has exactly one delivered answer
and it is a count of two feature kinds.

```
  kind          chunks   lit/chunk BEFORE   lit/chunk AFTER
  built            223        0.00               1.96      <- 77% of the city, and it was ALL of it
  lot                4        0.00               1.00
  carpark            2        0.00               8.00
  church             5        0.00              12.00
  parking            7        6.86               6.86      already lit since session 40
  yard              13        2.00               2.00      "
  park               6       24.00              24.00      "
  construction       3        3.00               3.00      "
  recreation         7        4.00               4.00      "
  school             3        2.00               2.00      already lit since session 49
  hospital           1        2.00               2.00      "
  firestation        2        1.50               1.50      "
  industrial         6        1.67               1.67      "
  market             3        2.00               2.00      "
  depot              2        3.00               3.00      "
  port               2        2.50               2.50      "

  4 of 16 kinds delivered no light at all       ->  0 of 16
```

**ELEVEN OF THE FIFTEEN ISLAND KINDS HAVE BEEN LIT SINCE SESSIONS 40 AND 49.** A yard has two flood
masts, a car park has 10 m columns, a park has twenty-four post-tops, and every program place
except the church has floods. *"None of it is lit"* is not what the code says, and it is the
premise the brief itself asked to have checked.

**WHAT WAS ACTUALLY UNLIT IS LARGER AND MORE IMPORTANT THAN THE ISLANDS.** `built` chunks —
**223 of 289, seventeen times the next population** — carried a van, a service scatter, 10 668 m of
courtyard wall and a marked loading bay with **not one light on any of it**. Sessions 40, 47 and 50
lit the 23% of the ground that is dead zone and left the 77% that is block interior dark. Plus
`lot`, `carpark`, `church` and **all four `LANDMARK_APRON` rows** — so the weir's rim, railed in
session 51 and given a staircase in session 52, is a nine-metre drop with no light near it.

### 1.1 WHAT WAS BUILT, AND EVERY FIXTURE IS ONE THIS CITY ALREADY HAD

- **THE BLOCK INTERIOR GETS TWO.** A `PARK.lampHeight` post-top at the courtyard wall's own gate —
  the registry's choice of opening, hoisted out of the wall's block so the lamp and the gap are ONE
  expression — and a 6.0 m work light aimed at the loading bay the van stands on. That is the
  brief's own two sentences: *"A worked yard has a work light. A loading dock has a lamp over the
  door."*

  **TWO PER BLOCK AND NOT TWENTY, AND THE BOUND IS THE POOL.** `updateLampPool` cuts candidates at
  128 m and hands the nearest `poolLamps` a slot, so every light added anywhere competes with the
  street lamps for the same ~98. A ring of courtyard lamps would win that competition near the
  camera and put the STREET into the dark to light a yard — which is this item's own defect,
  inverted.

- **`LIGHT.yardFloodCandela` = 3 600 cd at `yardFloodRadiusM` = 40 m**, the fourth entry in the
  family `parkLampCandela` started. **20 lx** — EN 12464-2's loading zone, 1.25× `streetAverageLux`
  and 0.40× a construction site's — off a 6.0 m column, **window sized first and the intensity
  derived through it** (`siteFloodRadiusM`'s own rule, written out because this project has got it
  wrong three times). `I = E·d²/window = 20 × 100 / 0.5625 = 3 556 → 3 600`. **0.06× a site mast's
  peak and 0.53× a street lamp's.** `city.js` picks it off the feature's own height, which is the
  `lamp` branch's rule since session 40.

- **`LANDMARK_APRON` GAINS A `light` COLUMN**, on the boundary circle the railing runs on. One
  decision doing three jobs: it is where the drop is, it is where a person arrives, and a large
  paved area lit from its perimeter is one you can read the extent of. condenser = a 6.0 m yard mast
  every 30 m; the two forecourts = a 10 m car-park column every 30 m; the weir = `PARK.lampHeight`
  every `PARK.lampEvery`, the 4.20 m post-top and 16 m pitch every park in this city already has.

- **`church` takes the park's own path lamps**, one side per spine and staggered — the first arm put
  them on both sides of both spines and delivered 26 on one island, more than a PARK's 24 and every
  one a pool candidate. **`lot`** takes one security light on its hoarding (one and not three: a
  yard is WORKED and a lot is not, which is the same sentence `DEAD_ZONE.lot`'s floor of 9 is
  derived from). **`carpark`** takes the surface lot's own 30 m column grid, which its `DEAD_ZONE`
  row was already derived from and which nothing had ever emitted.

- **`city.js` stats gains `lampCandidates`** — the number `lampsActive` cannot report once the pool
  saturates, because `min(candidates, pool)` pins at `pool`. The sign pool beside it has carried
  `signCandidates` for exactly that reason since session 45.

### 1.2 AND FOUR CLAIM DEFECTS, EVERY ONE A CLAIM SMALLER THAN THE THING DRAWN

`citycheck` caught all four on the first run of this session's content, which is the two-sided check
working:

```
  site(flood:) x building(bld)         0.038 m2   a flood's pedestal is 0.9 m square (half 0.45)
                                                  and the new lights claimed 0.34 for both
                                                  fixtures. 0.70 now, which is what every
                                                  existing flood in citygen already claims.
  feature(school:frame) x path(...)   12.152 m2   the play frame was claimed BEFORE `layPath`,
                                                  which claims its spines unconditionally. In the
                                                  GENERATOR's own claims, which is the one list
                                                  that is supposed to be impossible to break.
  the headstone's claim                           the stone stands ON its base, so the top is the
                                                  SUM and `stoneMaxM` alone under-claims by 0.11.
  LIGHT_SETBACKS = { building: 0.35 }             a building's claim is its MASS and `city.js`
                                                  draws it with a cornice and a crown, so a light
                                                  hard against a facade is refused by nothing. The
                                                  shape `APRON_SETBACKS.feature` already has.
```

**AND ONE LATENT DEFECT THIS SESSION'S CONTENT MADE VISIBLE, WHICH IS THE MOST USEFUL OF THE FIVE.**
`city.js` has pushed a POST under every post-top head since session 45, straight into `bodies`
**after `massCensus` was assembled** — an instance the census did not describe. It was invisible for
nine sessions because `lamp` and `flood` features had never landed on a `built` chunk. The moment
they did, `citycheck` said so:

```
  24 mesh(es) hold a different number of instances from the number they describe
  — e.g. '-1,-1:masses' labels 837 and allocated 839
```

which is exactly the two lights this session adds per block. Hoisted above the census with its own
array and its own line, the arrangement `crowns`, `propBoxes`, `adPillarBoxes` and `busStopBoxes`
already have. **An undescribed instance is CONTRACT §9.1's own subject: a delivered-side census that
does not count what it draws passes exactly as long as nobody looks.**

---

## 2. L15 — RE-DERIVED IN THE OPEN FOR THE SECOND TIME, AND THE QUESTION IS DIFFERENT NOW

The brief: *"Light the city and re-derive the band in the open per §7, with reason and date. Do not
dim content to keep it green."* **LOOK.md §7 carries it, dated 2026-08-29.**

**THERE IS NO `distinct:midnight|dusk` THRESHOLD. THERE IS ONE FLOOR OVER SIX PAIRS, AND THAT IS THE
DEFECT.** `look-budget.json` → `distinctness.minPairMSD` is 0.03000 and its own comment says *"all
six pairs must clear it"*. The six are not six samples of one quantity:

```
  midnight <-> noon     0.20458    the two ENDS of the cycle           6.8x clear
  noon     <-> dusk     0.13898
  midnight <-> dawn     0.12835
  dawn     <-> dusk     0.05812    same elevation, opposite azimuth
  midnight <-> dusk     0.02958    ADJACENT — dusk is the transition INTO midnight   0.98x
```

**A 7× SPREAD ASSERTED AGAINST ONE NUMBER, and the pair that most nearly fails is the pair whose two
members are ADJACENT IN THE CYCLE** — the one relation for which similarity is CORRECT rather than a
defect. Session 53 proved the band is inverted rather than tight: lighting the distant city moved it
the WRONG way by five times the instrument's resolution, because midnight is darker than dusk so any
light added at midnight moves midnight towards dusk. **Every session that satisfies LOOK.md §1 makes
this band worse.**

LOOK.md §7 now carries the shape a derived gate would have — `minCycleMSD` on the spanning pair and
`minAdjacentMSD` on the neighbours, with the falsifying cases each owes — and **does not build it**,
because splitting one floor into two where a branch is looser is indistinguishable from a loosening
and CONTRACT §0.1 says so in as many words. **`minPairMSD` is NOT moved and stays at 0.03000, for
the second session running.**

---

## 3. ITEM 4 — THE CHURCHYARD IS HEADSTONES, AND THE PALETTE AUDIT IS TWO ROWS

Item 4's question asked of each of the fifteen kinds — *"does its vocabulary contain the thing that
MAKES it that place?"* — and thirteen answer yes. `tools/placeprobe.mjs --light` prints all fifteen
palettes so the audit can be re-read rather than retaken. The two that answer no:

**CHURCH.** Session 49 built the nave and spire, session 50 gave it a path and planting, and
`s54-church-before-t0_5886-wet.png` is a **104.6 m lawn with a church on it**. `GRAVEYARD` is the
missing content, and every length is a plot's: 1.2 m along a row, 3.6 m between rows (2.4 m of plot
plus a 1.2 m walk). Laid in **6.0 m segments** so the run breaks round the nave, the spire and the
two path spines and closes up on the other side — the same argument the core wall's segments make.

**A `feature` AND NOT A PROP, AND THAT DECIDES A GATE.** `LOW_DETAIL_PROPS`' own rule is *"a thing is
a `prop` if its placement is a SCATTER and a `feature` if it is a RUN, a ROW or a GRID"*, and
`objectCount` — which `citycheck`'s clumping CV is computed from — counts props and not features.
Graves are rows by definition. **Measured: `clumping` reads 0.389 against session 53's 0.388/0.389.**

```
  first arm, rows over the whole island   234 segments   1170 stones   2574 boxes   30 900 tris
  shipped, the NAVE's half of the island  126 segments    630 stones    945 boxes   11 340 tris
```

against the **80 000 triangles** STATE 53 §6.3 says is all that is left in the budget. One box a
stone, with a base earned at the top third and a crosspiece at the top fifth.

**SCHOOL.** A long low block, a marked court, a railing, two floods and a scatter of trees is what
an office with a car park also has. `recreation` has had a `play` frame and swing since session 48;
the school now puts them on its grass. 2 per school chunk delivered at seed 1337.

---

## 4. ITEM 5 — THE THREE SPREADS, MEASURED BEFORE ANYTHING WAS CHANGED, AND TWO WERE **ZERO**

The brief was explicit that this item is a measurement. `tools/placeprobe.mjs --program --grid`,
pure generator, seed 1337 over the 17 × 17. **All three of the operator's observations are true and
two of them are understated.**

### 4.1 (a) HEIGHT — and within a kind the spread is EXACTLY 0.00

```
  population                     n     mean      sd      min      p50      max
  residential                 2058    41.00   26.77     8.94    34.21   152.03
  ALL non-built mass, BEFORE    37    11.76    6.10     4.60     9.50    34.00
  ALL non-built mass, AFTER     37    16.39   10.66     4.60    13.80    50.70

  within-kind sd, BEFORE -> AFTER
    school        0.00 -> 4.00       industrial    0.00 -> 2.52
    market        0.00 -> 1.11       port          0.00 -> 0.29
    carpark       0.00 -> 0.00  (still flat, and said so below)
```

**The tallest thing on any of the sixty-six non-built islands was a 34 m hospital tower — 4.5×
shorter than the tallest residential building — and every `PROGRAM` dimension was a constant with no
roll behind it.**

### 4.2 (b) TONE — the four materials and five eras reached ZERO program masses

```
  population                     n   distinct      sd      min      max
  residential                 2058          4   0.175    0.101    0.571
  non-built mass, BEFORE        35          9   0.050    0.233    0.452
  non-built mass, AFTER         35          7   0.164    0.101    0.571
```

Rec.709 luminance of the delivered facade reflectance. Before: **1 or 2 distinct values within a
kind, sd 0.000 for six of the nine.** After, the range IS the residential range.

### 4.3 THE REPAIR, WHICH FOLLOWS FROM THE MEASUREMENT AND IS TWO LINES OF PRINCIPLE

**The body material is the CITY'S and the kind's colour becomes the TRIM.** A school does not read
as a school by being 0.40 grey — it reads by its long low block, its ribbon windows, its court and
its railing, every one of which is unchanged. The body takes a `CITY_MATERIALS` albedo at
`DISTANT.materialWeights`, the DELIVERED population weights STATE 53 §3.4 measured rather than the
table's equal ones, because brick is the commonest and the darkest by a factor of four.

**Every height is a roll about `PROGRAM`'s constant, which becomes the median rather than the
value.** Multiplicative, because a 6 m depot roof and a 34 m hospital tower cannot share an additive
spread. Storey counts roll as counts. The hospital tower and the church spire get the widest bands —
**24–56 m and 16–42 m** — because a tower is where a program building is allowed to be tall.

**Its own named stream `program`**, so nothing above it re-phases (CONTRACT §6).

**WHAT IS STILL FLAT AND SAYS SO:** the market hall's canopy keeps its own warm brown (a canopy has
no parapet to carry a trim) and the deck park's 15.60 m is still `P.levels × P.storeyM` with no roll.

### 4.4 (c) BLOCK DIMENSION — THE OPERATOR IS RIGHT AND IT IS NOT REPAIRED

`latticeCarriageway(x, z)` walked at 0.25 m along four 4 km transects, and the run length of every
stretch that is NOT carriageway is what a block is, measured off the same function the generator
clips its ground with:

```
  x at z = 300     32 blocks   mean 110.72 m   sd 9.960   min 72.75   max 113.25   2 DISTINCT
  x at z = -700    32 blocks   mean 110.72 m   sd 9.960   min 72.75   max 113.25   2 DISTINCT
  z at x = 300     32 blocks   ... identical
  z at x = -700    32 blocks   ... identical
  POOLED: 128 blocks, 2 distinct lengths, and the sd of 9.84 is ONE OUTLIER.

  the buildable island: 289 chunks, ONE distinct area, sd 0.000
```

**`island = CITY.chunkSize − 2 × CORRIDOR` and both terms are constants, so every block in this
world is the same size by construction, everywhere, for ever.** That is the finding item 5(c) asked
for and it is the largest of the three. **The repair is NOT in this session** — moving the lattice
pitch is foundational (traffic's whole simulation is `line × chunkSize`, streetlife's footfall
weight, every claim, the canyon bake), and the cheap version — subdividing an island with a service
lane so two parcels read where one does — is a change to the perimeter frontage walk that wants a
session of its own. §8 item 2.

---

## 5. ITEM 6b — THE LATTICE STOPS. STATE 53 §7 ITEM 1, CLOSED

STATE 53 measured it on the transect to 4.10 km: *"from `cx` 3 outward every chunk on `cz = 0`
delivers 0.4542 ha of carriageway and 0.1989 ha of pavement, identically, for ever."* The brief:
*"If you build nothing else here, build that."*

**`cityExtentAt` was already the answer and nothing was reading it here.** `densityAt` multiplies by
it, so past `CITY.extentEdgeM` the field is exactly 0 and every chunk is low-detail — but a
low-detail chunk still emits a full road lattice and a `DEAD_ZONE` floor of props, and **both are
independent of density by construction**: the floor is what session 50 added so that a yard at
d = 0.1 is still a yard, and the lattice never read the field at all. So the two things that made
the outer world go on for ever are exactly the two the extent term cannot reach through `densityAt`,
and they now read it directly.

```
  cx    dist m   extent   density   road ha   walk ha   props   kind
  22      2881    0.149    0.0648    0.4542    0.1989       9   recreation
  24      3137    0.013    0.0056    0.4542    0.1989      12   parking
  25      3265    0.000    0.0000    0.0000    0.0000       0   recreation
  32      4160    0.000    0.0000    0.0000    0.0000       0   park
```

**AND THE FLEET IS BOUNDED BY THE SAME PREDICATE.** `traffic.js`'s lattice is ARITHMETIC — `line ×
chunkSize` — and the road under it is `generateChunk`'s. Those two agreed for fifty-three sessions
only because the drawn road never stopped. `seed()` and the recycle pass both gain
`cityExtentAt(x, z) <= 0`, in the same shape as the river, landmark and block tests already there.
Without it this change would have delivered the operator's own session-46 report — *"vehicles,
buses, pedestrians, lamp posts and market stalls arranged in neat lanes on BARE GROUND"* — at the
rim instead of at the weir.

**AND THE STREET LAMPS DID NOT STOP EITHER, WHICH THE FRAME FOUND AND NO GATE COULD.**
`s54-rim-after` at its first take showed **a grid of lamp columns standing on bare earth with no
street under them** — the operator's own session-46 report at the weir, arriving 328 m past the
city's edge. `lampStationsFor` is arithmetic on the chunk lattice and emits twenty stations a chunk
wherever the resident ring reaches; it agreed with the drawn road for fifty-three sessions only
because the drawn road never stopped. It now takes the same `cityExtentAt(x, z) <= 0` guard, beside
the `riverBlocks` and `landmarkOccupies` guards already on that loop.

**WHAT IS STILL OUT THERE, AND IT IS A FINDING RATHER THAN A LEFTOVER.** `block.js` draws its MAIN
STREET as one `groundExtent * 2` plane, so **a single 8 km arterial runs past the city's edge to
the world's rim** and is visible in `s54-rim-after` as the pale strip crossing the bare ground. It
is authored, it is **the only road in this world that leaves the grid**, and it is now unlit from
the edge outward. That is either the beginning of the brief's *"roads that leave"* or a plane that
wants an end; it is not a defect and it is not decided. §8.

**`streetlife.js` NEEDED NOTHING, AND THAT IS A FACT RATHER THAN AN OMISSION.** `footfallWeight` is
`cov × densityAt^p × dest` and `densityAt` is exactly 0 out there, so the per-chunk allocation is
already 0. Session 53's extent term paid for this one in advance.

---

## 6. ITEM 2b — THE TRAIN ARRIVES, DWELLS AND DEPARTS, AND STAYS ON ITS OWN TRACK

The operator: *"THE TRAIN JUMPS. It stops at the end of its run and reappears on the other track."*
**Both halves were the code and neither was a frame artefact.**

```
  if (tr.s > halfArc - tr.len/2) { tr.s = ...; tr.dir = -1 }
      12 m/s one way became 12 m/s the other way in one frame. No deceleration, no stop.

  const lat = tr.dir * viaduct.deck * 0.235
      THE TRACK WAS A FUNCTION OF THE DIRECTION, so flipping `dir` moved the whole 77.90 m train
      sideways by the full track gauge in that same frame. That is "reappears on the other track",
      exactly.
```

**It is CONTRACT §9.1's shape with a vehicle: one field standing in for two independent facts.** A
train's track is a fact about the train; its direction is a fact about the journey. And it is the
recycler pattern session 25 found in `traffic.seed()` on a larger body — **`carry()` was hiding it
from §5.12's motion field, which is why no gate ever saw it.**

**NOW: `track` is fixed per train and `dir` reverses on it.** The train runs at `speedMps` toward
the next stop, brakes at `brakeMps2` from the distance `v²/2a` requires — **derived, not triggered
at a constant, so it brakes at the right place from any speed** — stands for its dwell, and
accelerates away. Nothing is recycled any more, so §5.12 now carries the train's real velocity
through the whole manoeuvre instead of being told to ignore it.

**AND THE STATION IS ONE OF THE STOPS.** `viaductStations` is the same function `city.js` builds the
platform and the stair cores from — one description, two readers. **Session 31 built a platform at
22.72 m and nothing has ever stopped at it; the train ran past at 12 m/s for twenty-three
sessions.**

The state machine simulated offline at 1/60 s for 900 s, one train, the shipped constants:

```
  stops on the line          -201.05   0.00   201.05      braking distance 72.0 m, shortest leg 201.1
  station calls in 900 s     15
  LARGEST ONE-FRAME MOVE     0.2000 m, which is speedMps/60 EXACTLY — there is no teleport left
  standing                   456.1 s of 900 = 50.7%
  round trip                 230.8 s
```

**50.7% standing is not a number to tune away, it is the deck being 480 m long.** A shuttle whose
whole line is forty seconds of running each way stands for about half its cycle whatever the dwells
are, and the two trains start half an arc apart on opposite tracks, so what the deck shows is one
train moving while the other stands — which is a service.

---

## 7. GATE STATE

Run through `tools/rungates.mjs`, all eight, in **24 minutes**. **`load1` ran 4.95 to 6.06 across it
and was never inside §0.2's bar of 1.6** — the session had a browser open for most of its length.

```
  gate            exit   verdict   seconds  load1 in     out
  parsecheck         0     GREEN       3.4      5.78    5.56     116 files, contract-clean
  faultcheck         0     GREEN       9.8      5.56    5.54
  lookcheck          1       RED      34.6      5.54    5.26     THE IDENTICAL THREE
  windcheck          0     GREEN      39.3      5.26    5.42     568 names / 568 meshes
  inputcheck         0     GREEN      14.4      5.42    6.06
  gateaudit          1       RED      72.7      6.06    5.40     the carried control
  citycheck          1       RED     115.1      5.40    5.44     THE IDENTICAL FOUR
  perfcheck          1       RED    1141.7      5.44    4.95     15 over four routes
                                  -------
                                    24 min for the whole suite

  4 of 8 RED — lookcheck, gateaudit, citycheck, perfcheck. The same four as session 53.
```

**TWO EDITS WERE MADE AFTER THIS RUN AND BOTH ARE NAMED, because a suite run that describes a tree
that no longer exists is worse than no run at all.**

1. A COMMENT in `moving.js` replacing hand arithmetic with the measured timetable (§6). No
   behaviour moves.
2. **THE STREET-LAMP GUARD** in `city.js` (§5), which is behaviour — and it is admissible without a
   re-run for the reason STATE 53 §5.1 admits the terrain variant: **it fires only where
   `cityExtentAt` is 0, which is past 3232 m, and no gate reaches there.** `citycheck`'s surface
   census is a 1280 m square at the origin, `lookcheck` stands in the origin block, and all four
   `perfcheck` routes run within 900 m of it. The predicate is `continue` inside a loop whose other
   two guards are the same shape, so inside the gates' region it is provably a no-op.

`parsecheck` was re-run on both.

### 7.1 CITYCHECK — THE IDENTICAL FOUR, AND EVERY NEW THING THIS SESSION BUILT IS CLEAN

```
  clumping CV 0.389 against 0.60 — session 53 read 0.388/0.389. THE GRAVES ARE A `feature`
    AND NOT A PROP, which is why. 100 chunks, 100% populated, objects/chunk 12 to 92.
  2 of 2666 sign quads inside a building — the same two, six sessions
  4 delivered overlaps — THE IDENTICAL FOUR (planter x lamp:column, colonnade:pier x
    sign:blade, adpillar x planter, sign:blade x pylon)
  1004 of 284 382 walkable samples on bare earth (0.40 ha) — IDENTICAL to sessions 52 and 53
  0 forbidden overlaps among the GENERATOR's own claims
  342 instanced meshes, 342 labelled, 0 not; 0 whose label does not sum to their instance count
  generator claims 17 655, delivered 18 082 — session 53 read 17 046 / 17 646, so this session
    added 609 claims and 436 delivered boxes and broke none of them
  negative space 17.0% of chunks low-detail, 9 kinds
  bright reserve 6.67% against 6.00 — GREEN. saturation 3.42% pooled peak against 12
  city arrived over 3484 frames / 19 894.7 ms at load1 5.40 — inside the wall-clock bound
```

**THAT IS THE HEADLINE OF THE SESSION'S HYGIENE:** ~500 new lights, 630 headstones a churchyard,
rolled heights and materials on every program mass, a stopped lattice and a rebuilt train, and the
occupancy registry reports **exactly what session 52 and 53 shipped**. Four claim defects were
introduced and all four were caught by `citycheck` on the first run of the content — §1.2 lists
them, because a gate that catches something is worth more written down than a session that never
broke anything.

### 7.2 LOOKCHECK — THE IDENTICAL THREE

```
  distinct:midnight|dusk   0.02953 against 0.03000, 0.98x the floor — §2, re-derived in LOOK.md §7
  facadeAlbedo:dusk        3 clusters over 5 walls against 4
  facadeNeighbours:dusk    2 of 3 adjacent pairs
```

**AND THE FIRST OF THOSE DID NOT MOVE AT ALL.** Session 53's lit reading was 0.02953 and this
session's is 0.02953, on an instrument whose own run-to-run spread on this band is **0.00001**. So
~500 new near-city lights are worth **nothing** to it. What moved it in session 53 was a kilometre
of silhouette standing in front of sky, which is the mechanism §6.1.1 of that document measured.
All six pair distances are in LOOK.md §7.

### 7.3 PERFCHECK — FOUR ROUTES, AND THE TWO NUMBERS THIS SESSION COST

**`load1` was 5.44 at the start of this gate.** CONTRACT §0.2: a GREEN absolute under load is a
verdict because drift here is one-sided; a RED one is not.

```
                    draws  s53    tris   tris s53   instances  wall p95   cpu p95
  highway_speed       398  398   2.29M     2.28M     327 387   13.40 ms  12.00 ms
  downtown_dense      320  320   2.01M     2.01M     250 759   27.40     26.00
  night_rain          319  319   1.98M     1.97M     307 149   28.70     27.20
  player              309    —   1.96M         —     250 759   27.10     25.80
```

**THE TWO NUMBERS THE WHOLE SESSION COST ARE +0 DRAW CALLS AND +0.01 M TRIANGLES.** Every fixture
this session added rides in a mesh that already existed — the lights and the graves are boxes in
the chunk's own `masses`, the program rolls change dimensions and not counts, and the lattice stop
REMOVES geometry. 2.29 M against a `ceilings.triangles` of 2 360 000 leaves **70 000**, and the
next session should read that as the real remaining figure.

**FIFTEEN VIOLATIONS, AND ONLY THE COUNTS ARE READABLE.** Every frame-time red is at `load1` 5.44
and says nothing under §0.2. The four that are not frame times:

- **`downtown_dense` frame entropy is GREEN at 5.215**, where session 53 read 4.880 against a floor
  of 5 and called it *"not resolvable by this instrument as configured"*. Three runs
  [5.215 5.201 5.224], spread 0.023 against session 53's 0.42. **Do not read that as a repair** —
  nothing in this session touched the histogram of that route, and the honest reading is that the
  estimator's spread is what session 53 said it was.
- **`night_rain` mean luminance 0.0797 against a floor of 0.08 — NEW, AND IT IS CONTRACT §0.1's OWN
  INCIDENT.** Per-run means [0.0797 0.0949 0.0786], **spread 0.0163 against a margin of 0.0003**.
  The margin is **1.8% of the spread**, and the assertion is made on ONE run rather than pooled.
  That is a straddle, not a finding, and it is the same shape as the `downtown_dense` wall p95 that
  produced rule 6. **It is not attributable to this session without a paired run and none was run.**
- **`player` worst froxel 61 of 96, margin 35 < 40**, where session 53 read 57 and a margin of 39.
  A count, so §0.2's load caveat does not apply. **This session put two more lights in every block
  and the player route stands in one**, so this IS attributable and the direction is expected. It is
  4 slots further from the floor than session 53's and the next session should treat the froxel
  margin as a cost this session spent.
- **`highway_speed` silhouettes: 55% of 65 vehicles non-monotone (min 75%) and 69% with a dark
  ground gap (min 75%).** Session 53 read 60% of 68 on the first; session 49 measured the population
  moving 55–74 across four runs of one session. `budget.json` → `silhouettes.$estimator` already
  derives why a single reading is not a verdict: the sample is whichever subjects are in frame at
  the pose. **SIX SESSIONS UNACTED.**

---

## 8. WHAT TO DO FIRST NEXT TIME

1. **ITEM 2a — PEDESTRIANS CANNOT LEAVE THE GROUND PLANE, AND IT IS THE OPERATOR'S OLDEST UNBUILT
   WISH.** NOT BUILT this session and the reason is scope, not doubt. What was established before
   deciding, which is what the brief asked for:

   - **`city.walkableAt(x, z, pad)` HAS NO `y` IN IT AT ALL.** It is a 2-D predicate over four
     blocker lists — buildings, landmark ground blockers, the origin block, the water — and it
     answers *"is this column free"*. There is nothing in it to extend; a level is a concept it does
     not have.
   - **`streetlife.js` IS ALLOCATED PER CHUNK BY `footfallWeight`** and every agent's `y` comes off
     the ground. `PED_RING` is 1 and `SIM_RADIUS_M` is 120.
   - So the change is a **DECK**: a walkable surface with a height, a footprint and a way on. An
     agent gains a `deck` field (null = ground), its `y` comes off the deck's top, its destinations
     are on the deck, and its movement stays 2-D within the deck's footprint. The station's platform
     at 22.72 m is the first one and the stair cores are the ways on. **Estimate: streetlife's
     allocator, its destination table and its instance write, plus one new record in `city.js`.**
   - The train now STOPS at that platform (§6), so the thing people would be riding is there.

2. **ITEM 5(c) — EVERY BLOCK IN THE WORLD IS THE SAME SIZE, MEASURED.** §4.4. 128 blocks, 2 distinct
   lengths, and one of the two is a single outlier. The cheap repair is NOT the lattice: it is
   splitting an island into two parcels with a service lane, so the grid reads as two block sizes
   without moving one road. That is a change to the perimeter frontage walk and to `DEAD_ZONE`'s
   core, and it is the largest single thing left that the operator has named.

3. **ITEM 3 — THE DOME HAS NO WAY IN.** NOT BUILT. The design is specified and costed rather than
   half-built, because the brief said to finish fewer completely:

   - **`LANDMARK_APRON` gains `approach`, `dropOff` and `portico`.**
   - **The approach is radial `path` rectangles on the four CARDINAL bearings** — a geometric
     constraint and not a choice, because every ground rectangle in this project is axis-aligned and
     a radial at 37° would be a diagonal drawn as a comb.
   - **Claimed BEFORE the boundary run**, which makes the gates free: `feature × path` is forbidden,
     so every boundary bay a path crosses is refused and the railing has an opening exactly where an
     approach arrives, without either routine knowing about the other.
   - **The drop-off is a row of `DEAD_ZONE` bays** at the outer end of the first approach, probed as
     `ground` exactly as `bayRows` probes a hospital's.
   - **The front is a porte-cochère**: a `canopy` feature (a roof on columns, session 49's own
     vocabulary), 16.0 × 13.0 m at 5.4 m — three car lengths long, one bay plus a footway deep, and
     high enough for a van. `canopy` and NOT `building`, which is `placeMass`'s own lesson.
   - `condenser` takes ONE approach and no portico: a works compound has a gate, not a forecourt.

4. **THE 8 km MAIN STREET IS THE ONLY ROAD THAT LEAVES THE GRID, AND NOBODY DECIDED THAT.** §5.
   `block.js` draws it as one `groundExtent * 2` plane, so now that the lattice stops it is the one
   thing running from the city out to the world's rim. Either give it an end, or make it the first
   road that leaves — which is the brief's own item 6 and is now, for the first time, a change with
   a boundary to leave FROM.

5. **THE ATMOSPHERE AT 1500 m IS BROWN SOUP.** STATE 53 §7 item 3, untouched.

6. **THE TURNING HEAD** (STATE 52 §7 item 1) and **THE 47 m OF LANE ON PAVEMENT** (item 2), both
   still untouched.

7. **`SURFACE_TOP_M`'s DERIVATION IS FALSE BY 3.2×.** STATE 53 §5.2, untouched. The verdict is
   unchanged; the comment states a range the code contradicts.

8. **THE VEHICLE SILHOUETTE BAR, SIX SESSIONS UNACTED** — 60% of 68 against a 75% floor at session
   53. `budget.json` → `silhouettes.$estimator` already derives why a single reading is not a
   verdict.

9. **THE APRON STAIRCASE'S RESIDUE.** Still 0.40 ha of bare walkable ground, 1004 of 284 382
   samples, **identical to sessions 52 and 53 to the sample**.

10. **CLUMPING IS UNMOVED AT 0.389 AGAINST 0.60 FOR SEVENTEEN SESSIONS.** STATE 53 §7 item 9's
   experiment — *"a window at 2300 m would move it"* — is STILL NOT RUN, and this session made it
   more interesting rather than less: §5 empties everything past 3232 m completely, so a window out
   there is now a window over a genuine edge rather than over a thinning field.

11. **HOIST THE BUILDING CLAIMS IN `buildChunkBody`** — session 47's item 1, still what blocks facade
    clutter. **THE ARENA** (STATE 49 §4). Both still unspent.

12. **`decodePNG` RETURNS THREE BYTES PER PIXEL.** STATE 52 §2.2, and it cost that session a whole
    plausible and entirely wrong table.
