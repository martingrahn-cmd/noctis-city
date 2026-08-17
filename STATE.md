# NOCTIS — STATE

*End of session 35. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`, 37 days of
uptime. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` WAS 2.22 AT THE FIRST COMMAND AND SAT BETWEEN 1.30 AND 3.96 FOR THE WHOLE
SESSION***, against CONTRACT §0.2's bar of **1.6**. **SO NO MILLISECOND IN THIS FILE IS
ADMISSIBLE AS AN ABSOLUTE**, and none is quoted as one. Everything below is a COUNT, a
DISTANCE, an AREA or a PIXEL STATISTIC — all load-independent, CONTRACT §9 rule 6's own
corollary — or a paired before/after taken through the same instrument on the same machine
within minutes of itself. `memory/noctis-quiet-bar.md` records that drift on this machine is
one-sided: a GREEN absolute under load is still a verdict and a RED one is not. **§7 has
twelve red absolutes and not one is reported as a finding.**

---

## 0. THE FRAMES, IN ORDER, AND WHAT EACH ONE IS FOR

**This table is the session's report.** The gate table is §7 and it is not the verdict.

| # | frame | LOOK.md | did the city move toward it |
|---|---|---|---|
| 1 | `shot-out/s35-air-before-t0_5649-wet.png` → `s35-air-after-t0_5649-wet.png` | **§2** | **YES, AND IT IS THE FRAME THIS SESSION EXISTS FOR.** Same pose, same instant, wet, over the densest district in the region. The before is towers standing on a field of bare brown earth with the ground visible between every building. The after is blocks that read as masses: the earth is gone from between them and what is left between the buildings is street. **This is the answer to "do the blocks read as solid" and it is yes.** |
| 2 | `shot-out/s35-block-before-t0_5649-wet.png` → `s35-block-after-t0_5649-wet.png` | **§2, §4** | **YES, AND IT IS THE PAIR THAT SHOWS IT FROM THE PAVEMENT.** A junction at 1.9 m, looking diagonally into a block. The before's corner building is a shallow box whose flank ENDS in mid-block with a gap and a tower behind it. The after's flank runs back into the block and meets what is behind it. |
| 3 | `shot-out/s35-street-before-t0-wet.png` → `s35-street-after-t0-wet.png` | **§2** | **NO, AND THE ARITHMETIC SAYS IT COULD NOT.** The same street at midnight, wet, before and after. The two frames are nearly the same frame. **Recorded as a frame that failed to make the case, because it was the wrong question**: a gap in a street wall is a FRONTAGE fact and depth grows the other way. What differs between these two is re-phase, not depth. §1.6. |
| 4 | `shot-out/s35-i2-signals-before-t0_5649-wet.png` → `s35-i2-signals-after-t0_5649-wet.png` | **§2** | **YES, AND IT IS A TRUE A/B.** The weir's eastern apron. The before carries a row of black signal masts standing on bare ground with no road under it. The after does not. `traffic:layout`'s phase is untouched — the seed loop draws the same five numbers per iteration whether a candidate is refused or not — so this pair is one city, not two. §2. |
| 5 | `shot-out/s35-i2-weir-t0_5649-wet.png` | **§2** | The repaired basin from the operator's own spawn, for the record. Nothing stands in it. |

```
1  node tools/lookat.mjs --pos=-180,230,700  --target=-330,0,460  --fov=60 --t=0.5649 --wet=1
2  node tools/lookat.mjs --pos=-384,1.9,384  --target=-320,14,448 --fov=60 --t=0.5649 --wet=1
3  node tools/lookat.mjs --pos=-500,1.9,393.6 --target=-250,10,391 --fov=55 --t=0.0 --wet=1
4  node tools/lookat.mjs --pos=-190,26,320   --target=-262,3,243  --fov=55 --t=0.5649 --wet=1
5  node tools/lookat.mjs --pos=-158.02,69.96,250.12 --target=-300,0,150 --fov=70 --t=0.5649 --wet=1
```

All are `lookat` frames and therefore **frozen** — `?paused=1` stops the clock, so the traffic
and the crowd stand where they were seeded. Every "before" was taken by checking the previous
commit's file out over the working tree and re-shooting the same pose minutes later, so each
pair is the same instrument on the same machine.

**FRAMES 1–3 ARE NOT TRUE A/Bs AND FRAME 4 IS.** The depth change alters which buildings the
registry refuses, and a REFUSED building costs `rng` a different number of draws from a PLACED
one — one on the refusal path, zero or two on the placement path. So the first building whose
verdict moves re-phases every building after it in that chunk. **The delivered city is a
different population, not the old one with deeper boxes.** §1.4 gives the arithmetic and says
why no arrangement of streams could have avoided it.

---

## 1. ITEM 1 — BUILDINGS THAT GO TO THE BACK OF THEIR LOT

`2c0a4a4`, and `528cfd9` for LOOK.md. **The brief's three figures reproduce and one of them
measures the wrong quantity.**

### 1.1 THE INSTRUMENT FIRST, BECAUSE THERE WAS NONE

`tools/depthprobe.mjs`. STATE 33 §6's three numbers came out of a throwaway that is not in the
repository, and LOOK.md §8 says a number quoted from somewhere else must carry its instrument
and its population or it *"cannot be checked and therefore cannot be wrong"*. Over
`city-budget`'s own 10 × 10 region at seed 1337, walked directly through `generateChunk`:

```
  STATE 33 §6                     depthprobe at HEAD        verdict
    median depth      19.4 m        20.1 m into the island   REPRODUCES a different quantity
    max               27.0 m        26.0 m                   27.0 IS UNREACHABLE
    island coverage   20.8%         20.8%                    EXACT, over the 79 chunks
                                                             carrying a building
    built past 31 m    0.0%          0.05%                   ESSENTIALLY EXACT
```

**19.4 and 27.0 are `bld.depth` read for every building without consulting `bld.facing`.**
`bld.width` and `bld.depth` are WORLD-AXIS extents: a building whose frontage runs along x has
its depth in `bld.depth`, and one whose frontage runs along z has it in `bld.width`. So for
half the city `bld.depth` is the FRONTAGE WIDTH — `rng.range(11, 27)` — and **27.0 is that
band's own maximum, which no depth roll can reach.** CONTRACT §9's table with two lengths.
The probe carries that reading as a named arm so the two can be compared rather than argued
about. **It does not change the conclusion**: 20.1 m of a 52.3 m half-block is still a rind.

Two further corrections to STATE 33's own text, from the same instrument:

- *"the deepest building in the region reaches 40.1 m"* — that is a QUAY building measured
  against an island edge it does not front. Its lot line is the river. Over the island
  frontage the deepest reach at HEAD was **26.0 m**;
- *"79 built chunks"* — 83 chunks are of kind `built`; 79 of them carry a building.

### 1.2 THE CORE IS DERIVED

LOOK.md §5's test is that a device be derivable from something the city already has.

```
  CORRIDOR                        11.7 m   building line to road centreline
  2 x CORRIDOR                    23.4 m   building line to BUILDING LINE
  island   CITY.chunkSize - 2C   104.6 m
  lot      (104.6 - 23.4) / 2     40.6 m   <- the deepest a building may go
```

23.4 m is the section of an ordinary street in this city and the narrowest gap it already
asserts two facades may face each other across. A well narrower is a shaft; one that wide is
a mews, which is what the back of a dense block is. **A full ring at 40.6 m covers 95.0% of
the island** against the 96.3% STATE 33 quotes for a lower Manhattan block — reached by a
derivation and not by aiming at it.

### 1.3 THE DISTRIBUTION IS A MIXTURE, AND BOTH ARMS ARE A YARD

```
  deep      lot - range(0, CORRIDOR)     28.9 - 40.6 m   built out
  shallow   range(bandLoM, bandHiM)      15.0 - 26.0 m   a yard behind
  P(deep)   0.12 + 0.88 * density^1.0
```

The deep arm's spread is a LENGTH and not a fraction: the lot less a rear yard of at most half
a street. The shallow arm is **today's band unchanged**, which is what makes *"some of it
should survive"* checkable — a shallow building in the new city is literally a building from
the old one. `P(deep)` is the fill law's own endpoints with the power set to 1, because depth
is the cheapest thing a developer buys and a heavy power would say the opposite.

### 1.4 THE CLIP IS WHAT KEEPS THE BLOCK A RING, AND IT IS MEASURED

The four sides are walked x-first over the island's FULL x range, so a 40 m building on side
one owns the corner and every candidate on side three within 40 m of it is refused outright.
`depthprobe --sweep`, all arms through the same generator:

```
  arm                         bldgs  quay  medDepth  cover%  props  gaveUp  objCV  refused(bldg)  clipped
  AS SHIPPED s34               479    10    20.0     16.2   1594     50    0.633       92            0
  band, clip                   510    10    19.7     17.0   1593     51    0.627       74          193 m
  lot, NO clip                 424    10    30.6     20.2   1594     50    0.624      149            0
  lot, clip     <- ships       491     9    29.6     22.6   1590     54    0.626       96          906 m
  lot, clip, deepPower 1.4     492    10    25.9     22.1   1591     53    0.625       97          733 m
  lot, clip, deepPower 0.7     488     7    30.8     23.5   1588     56    0.626       99          999 m
  lot, clip, yard 2xCORRIDOR   496     9    23.4     20.2   1589     55    0.626       90          614 m
  lot, clip, yard 0            483     8    33.9     24.6   1586     58    0.623      104         1308 m
  lot, clip, core 3xCORRIDOR   496     9    24.9     20.4   1590     54    0.627       90          550 m
  lot, clip, core 1xCORRIDOR   482     8    34.3     24.4   1589     55    0.625      105         1372 m
```

`cover%` here is the SUM of footprint areas over all 100 islands — a sweep column, comparable
across arms and not the union figure §1.6 reports.

**Without the clip, deepening COSTS 55 buildings** and `building` refusals go 92 → 149. With
it, a constrained frontage is SHALLOW rather than ABSENT — the sentence the river clamp fifty
lines above already makes — and 906 m of depth is given up over 57 corner meetings. The
neighbouring arms buy at most 2 percentage points of coverage and none of them is derived.

**THE `AS SHIPPED` ARM IS THE SHIPPED CITY BIT FOR BIT** — 480 buildings, 12 quay, at HEAD
against 479/10 here, and those two differences are the ulp repair in §1.5 and not the law.
That control only exists because the depth roll is drawn from `rng` and not from a stream of
its own: it REPLACES a draw rather than adding one. Taken from `depthRng` the same arm
delivered **475 buildings**, and all five of those were phase.

### 1.5 A REPRESENTABILITY DEFECT AT THE LOT LINE, AND THE OBVIOUS REPAIR WAS WORSE

`centre = at - out * half` and then `centre + out * half` is not the identity in binary. At
`at = -116.3` with `half = 17.517` it returns **-116.30000000000001** — 1.4e-14 m onto the
footway — and `overlaps` is a strict inequality, so a face ON the line does not conflict and a
face one ulp past it does.

- **At HEAD it cost six buildings of 480**, refused for a `pavement` conflict of about
  1e-13 m². They are session 34's `refused: { pavement: 6 }` and nobody had asked what a
  building was doing standing in a footway.
- **With a bisection over depth it stops being stationary.** The round trip's error depends on
  `half`, so the conflict FLICKERS along the search: **1.09 m was taken off a 35.03 m building
  for nothing**, and nothing bounds it — a 40 m building can bisect to 20 m on an ulp.

`lotCentre` steps the centre inward by one ulp of its own magnitude until the reconstructed
near face is on the line or inside it. STATE 34 §2.3's repair one file over.

> **AND IT SNAPS THE CENTRE AND NOT THE FACES, WHICH IS THE PART WORTH KEEPING.** Building the
> claim from exact faces is the obvious repair, it is exact, and it put **59
> `building × pavement` overlaps of 0.000 m² into the DELIVERED census** on the first run —
> because `city.js` reconstructs that claim as `bld.x ± bld.width/2` off the mass it drew, and
> two expressions for one rectangle is CONTRACT §9.1. Both sides compute `centre ± half`; only
> the centre moves. **The generator and the census have to compute the same thing, and that
> beats computing the right thing.**

The quay walk has the same exposure on its FAR face — `depth` is capped by `room` so a terrace
that takes its whole lot lands exactly on `backstop` — and is deliberately left alone. Every
remaining `pavement` refusal in the region is that walk's: four, on chunks (−5,−3), (−4,−4),
(−1,−3) and (3,−4). §9.

### 1.6 DELIVERED, AND WHAT IT DOES NOT DO

```
                                        s34        s35
  buildings over the region             480        491
  chunks carrying a building             79         81
  median depth into the island         20.1 m     29.6 m     of a 52.3 m half-block
  p90 depth                            24.9 m     37.6 m
  island coverage (union raster)        20.8%      28.1%
  built past 31 m                        0.05%      5.35%
  quay terrace                           12          9
  props / props given up              1594/50    1590/54    generator side, §1.4's sweep
  objectCount CV                        0.632      0.626     citycheck, floor 0.60
```

**AND IT IS THE SMALLER OF THE TWO KNOBS.** Coverage is depth times frontage and they
multiply: depth now stands at 29.6/40.6 = **0.73 of the derived ring** and frontage occupancy
at **0.244**. 28.1% against a 95.0% reference is what those two multiply to. Frame 3 says the
same thing from the pavement — **the deepening is nearly invisible from the street** — and
that is a fact about which knob owns a gap in a street wall, not a failure of the change. The
fill law was out of scope and remains the short one.

**THE QUAY LOST THREE BUILDINGS OF TWELVE.** A deep island frontage on a river chunk takes
land the quay walk builds on, and the quay walk runs second. That is a content decision about
which frontage owns a narrow riverside lot, it is not measured against anything, and it is
recorded in §9 rather than repaired on a guess.

### 1.7 THE COST, MEASURED

**Depth itself is free and the reading is in the source rather than in a budget.**
`buildFacade` emits windows on the FRONT and REAR elevations only — the side faces are blank
party walls, by its own comment — and for a z-facing building both are `tier.width`. So the
window count does not depend on depth at all. `buildRoofscape` draws `2 + floor(seed*4)` plant
units regardless of footprint, and a parapet is four boxes per tier. **A deeper box is the same
box, and so is everything on top of it.**

What was not free is the eleven extra BUILDINGS:

```
  route            s34 draws   s35 draws   s34 inst    s35 inst    s35 tris
  downtown_dense       332         332      152 474     152 461      1.38M
  highway_speed        431         433      201 761     204 631      1.60M
  night_rain           333         336      186 258     188 193      1.35M
  player               321         322      152 474     152 461      1.34M
```

**`highway_speed` stands at 433 of 440 — SEVEN SPARE, down from nine.** The brief said depth is
free in draws and it is; what costs two draws is that **two chunks that carried no buildings
now carry some** (79 → 81 over the gate's region), and a chunk with buildings allocates meshes
a chunk without them does not. That is a hypothesis with the two numbers beside it, not a
measurement of the mechanism.

### 1.8 THE LUMINANCE BANDS DID NOT MOVE, AND THE BRIEF EXPECTED THEM TO

Both sides of `lookcheck` run minutes apart on the same machine, all four times of day, dry
and wet:

```
  band          before    after     delta     band
  midnight dry  0.0744    0.0744   +0.0000   [0.072, 0.112]
  midnight wet  0.0792    0.0793   +0.0000
  dawn dry      0.3006    0.3005   -0.0001   [0.299, 0.353]
  dawn wet      0.3000    0.2996   -0.0003
  noon dry      0.4290    0.4292   +0.0002   [0.428, 0.482]
  noon wet      0.3922    0.3924   +0.0002
  dusk dry      0.1392    0.1392   -0.0000   [0.14, 0.18]
  dusk wet      0.1418    0.1417   -0.0002
```

**Not one band moved by more than 0.0003**, against the 0.0025 of headroom `gateaudit`'s table
records for the tightest of them. The reason is that `lookcheck`'s camera is the ORIGIN BLOCK,
which `block.js` authors and the generator never touches; the streamed city reaches that frame
only as mid-distance walls. **So nothing was owed under LOOK.md §7 and no budget file was
touched.** Note also that all four bands sit within 0.0024 of their LOWER edge, which is where
the next content change will find them.

---

## 2. ITEM 2 — THE SIGNALS ASKED NOBODY, AND THE VEHICLES ASKED FROM THE WRONG END

`0f60c9a`. **The brief's hypothesis is half right and the half that is wrong is the more
useful half.**

The brief guessed a seventh and eighth spelling of *"does a landmark stand here"*. There is
one seventh spelling. The other defect is a site that DOES ask, correctly, at the wrong point
— and so, it turns out, is the seventh once you write it.

### 2.1 THE INSTRUMENT, AND IT RUNS THE CLOCK

`tools/landmarkcensus.mjs`. Session 34's equivalent was a throwaway in a scratch directory, so
its *"50 before, 0 after"* cannot be reproduced and a seventh spelling could not have been
noticed. This one is in the repository and it takes `--sim`, because `?paused=1` measures the
SEEDING rule and nothing traffic does about a landmark after seeding.

At the operator's own spawn, 90 simulated seconds:

```
  weir   10  y [1.55, 3.86]  traffic:lights:signalHeadBoxes  at (-247,247) ... (-265,247)
  weir    2  y [0.58, 0.65]  traffic:bodies                  at (-196,251) (-195,251)
  weir    2  y [0.61, 0.61]  traffic:lights:vehicleLightLines
  weir    2  y [0.29, 0.29]  traffic:wheels                  at (-195,250) (-195,252)
```

The mesh is split by its own `noctisCensus` label, because `traffic:lights` carries the
vehicles' light rows and then the signal heads and **a signal mast reported as a vehicle is a
different defect with a different repair.**

### 2.2 BOTH ARE CONTRACT §9 RULE 7 — A RIGHT PREDICATE AT THE WRONG POINT

- **`writeSignals` asked nothing at all.** Four heads at every junction of an arithmetic
  lattice, with no test of any kind. **And a test at the JUNCTION would not have found these
  ten.** They belong to junction **(−256, 256)**, which is one metre OUTSIDE the weir's own
  `z1 = 255`; `signalApproaches` sets a head `STOP_LINE` back and
  `roadHalfWidth + SIGNAL_KERB_M` across, so the heads stand at **z = 247, nine metres inside
  the claim the junction is outside of.** The test is therefore at the HEAD.
- **`seed` and the recycler DO test, and they test the vehicle's ORIGIN.** Half a 12.00 m body
  can stand inside a claim while its origin stands outside — which is what x = −195 and −196
  against the weir's own `x1 = −195` are. `landmarkUnderBody` tests nose, tail and centre.
  Three points rather than a pad, because `landmarkOccupies`' pad applies to both axes and a
  bus would keep 6.00 m clear ACROSS its lane as well as along it. **`traffic.js` already
  carries the identical correction about the identical quantity** — *"MEASURED FROM THE BODY,
  NOT FROM THE ORIGIN — SESSION 29, AND THE CONSTANT'S OWN DERIVATION ALREADY SAID SO."*

**AND A REFUSAL NEEDED SOMEWHERE FOR THE ROW TO GO.** Sixteen slots and four junctions of four
approaches had filled every slot every frame since the signals existed, so nothing ever
cleared one — the first refusal would have left a head standing exactly where the refusal
removed it from. Unfilled slots are collapsed to zero scale and carried (§5.12's recycle rule).

**DELIVERED: all sixteen traffic instances are out of the weir.** The `weir` rows that remain
are `aircraft:*` at y 150 — an aeroplane over a basin, which is a landmark's ground claim
correctly not reaching the sky.

### 2.3 THE ENUMERATION, WHICH IS WORTH MORE THAN THE TWO REPAIRS

`node tools/landmarkcensus.mjs --sites`. **60 code references over 7 files; 23 declared sites.**

```
  ok     11   asks the right list for the question it is asking
  n/a    10   reads the table for something that is not a keep-out
  blind   2   asks a GROUND question through a SKY answer
```

**THE TWO THAT ARE STILL BLIND ARE `city.js`'s `walkableAt` AND ITS WALKABILITY MASK.** Both
ask *"may a person stand here"* through `landmarkGroundBlockers`, which returns
`landmarkOccluders` verbatim and therefore `[]` for a basin. Both then skip basins explicitly
with a stated reason — *"the basin is a hole, not a wall: you walk down into it"* — and STATE
34 already records that the reason contradicts the geometry, which has a 7.8 m vertical drop at
r = 102. **The blindness and the exemption are two separate facts and both are still true.**

A call site with no declared row prints as **UNCLASSIFIED** and is counted, so a ninth spelling
makes the tool disagree with this file.

---

## 3. ITEM 3 — THE WEIR'S CLAIM IS EXACTLY THE SIZE OF THE WEIR

`2825eaa`. Measure and leave it, as the brief required. Measured off the DELIVERED geometry —
the world bounds of every mesh named `landmark:*` — and not off `LANDMARKS`.

```
  landmark    claim AABB     claim m2  claims   delivered (m)    del/claim   y span
  stack         78 x 78        20806     7     78.8 x 78.8        1.021    [0.00, 133.00]
  arch         133 x 15          450     2    124.5 x 12.8        0.795    [-0.31, 99.90]
  viaduct      109 x 445         601    46    110.2 x 448.0       1.016    [0.00, 27.20]
  exchange      66 x 66         6614     2     66.0 x 66.0        1.000    [0.00, 46.00]
  weir         210 x 210       44100     1    210.0 x 210.0       1.000    [-9.40, 0.40]
  dish          62 x 62         3795     1     88.0 x 88.0        2.041    [0.00, 58.00]
```

**THE ANSWER IS THAT THE CLAIM IS NOT TOO BIG.** Delivered 210.0 × 210.0 against a claim of
210 × 210 — ratio **1.000**, on ONE claim box, so it is not an artefact of nested claims the
way the stack's seven would be. The basin really is 2.69 chunks across and the keep-out is its
own extent to a decimetre. **44 000 m² is not returnable to the city by shrinking the claim; it
is returnable only by making the weir smaller, which is a content decision and the operator's.**

What the claim contains that the structure does not is the **21.5% in the corners** between a
round lathe and a square AABB — 9 464 m² — which STATE 34 §11 already records and which is a
SHAPE question, not a size one.

> **AND THE SAME TABLE FOUND ONE NOBODY HAD ASKED ABOUT. The dish delivers 88.0 × 88.0 m
> against a 62 × 62 m claim — 2.041, thirteen metres of structure outside its own keep-out on
> every side.** `landmarkAABB` is computed from `landmarkOccluders`, so buildings, roads and
> props are refused within 62 m while the cone reaches 88. A cone is widest at its base and
> this one's y span starts at 0.00, so it is very likely at grade — **but the bounding box
> pools every height and this session did not separate them, so that last clause is a QUESTION
> and not a statement.** Ten minutes with the probe answers it.

The arch at 0.795 and the viaduct at 1.016 are expected: their ground claims are legs and their
extent is a deck.

---

## 4. WHAT WAS NOT BUILT, AND WHY

- **Haze, facade clutter, holograms, the remaining two vehicle devices, the fill law, the 76
  underived bounds and the sceneWalk streaming timeout** — all out of scope by the brief.
- **`gateaudit` was NOT RUN.** Third session running. It is the most expensive gate in the
  project and it reports `lookcheck`'s state one layer up. **It is recorded as a gate that did
  not run, not as a pass.**
- **The quay's own ulp exposure was not repaired** and the four chunks are named in the source
  comment. §1.5.
- **No merge to main.**

---

## 5. GATE STATE

Each gate run individually, because `npm run gates` is `&&`-joined and stops at the first red.

```
  parsecheck   GREEN   107 files, contract-clean
  faultcheck   GREEN   7 cases; quarantine surgical, frame survives all seven
  windcheck    GREEN
  inputcheck   GREEN
  gateaudit    NOT RUN — see §4
```

### 5.1 `citycheck` — RED AT 1, AND THE OCCUPANCY IS GREEN ON BOTH SIDES

```
  occupancy    5475 generator claims over the region, 4131 delivered (min 1200)
               0 / 0 forbidden overlaps over 53 forbidden pairs (max 0)
  clumping     CV 0.626 (min 0.6), 94% populated (min 55%)
  prop place   0 of 1590 props inside a building footprint (max 0)
  sign place   0 of 1298 delivered sign quads inside a building (max 0)
  pedestrians  360 over 9 chunks, CV 1.0394 (min 0.7), 67% populated
  walkability  64 234 of 64 253 free cells reached
  ✗ saturation 5.67% of night-route pixels above 0.5 value (min 6.00%)
```

**`saturation` is the one red and it moved 0.59 points the RIGHT way** — 5.08% at s34 → 5.67%
now. CONTRACT §0.1 records this statistic's spread as **0.60–0.80 points**, so it is **NOT
RESOLVED IN EITHER DIRECTION**, which is the same sentence STATE 33 and STATE 34 both had to
write. LOOK.md §7 names this floor as one of the three derived against a city that no longer
exists.

**`clumping` lost margin and is still green**: CV 0.626 against 0.60, down from 0.632. The
deepening refuses a few more props into the interior (`propsGaveUp` 53 → 54) and adds eleven
buildings. **0.026 of margin is the tightest this gate has been** and it is the number the next
content change should look at first.

### 5.2 `lookcheck` — RED AT 3, ALL THREE CARRIED, AND NOT ONE BAND MOVED

```
  ✗ band:dusk        0.1392  (band [0.14, 0.18])   0.1392 at s34 — unmoved
  ✗ facadeAlbedo     3 clusters (min 4)            carried from the station, s31
  ✗ facadeNeighbours 0.211   (min 0.3)             carried from the station, s31
```

`band:midnight`, `band:dawn` and `band:noon` all passed. **NO LOOK BAND WENT RED THAT WAS NOT
RED BEFORE, so nothing was owed and no budget file was touched.** §1.8 has the before/after.

---

## 6. THE BRIEF'S PREMISES, MEASURED

| # | the brief said | measured |
|---|---|---|
| — | draw calls stand at **431 of 440**, nine spare | **TRUE at 431.** Now **433, seven spare** — and it is not the depth, it is two chunks that had no buildings and now have some. §1.7 |
| 1 | median depth **19.4 m** | **REPRODUCES, and it is `bld.depth` read without `facing`.** The depth is **20.1 m**; 19.4 is half a city's frontage widths. §1.1 |
| 1 | **0.0% built beyond 31 m** | **0.05%.** Essentially exact. §1.1 |
| 1 | island coverage **20.8%** against **96.3%** | **EXACT**, over the 79 chunks carrying a building. §1.1 |
| 1 | **AND IT IS FREE** — same draw, same instance, same triangles | **TRUE OF DEPTH AND NOT OF THE SESSION.** `buildFacade` skips the side elevations, so windows do not scale with depth at all; `buildRoofscape` is footprint-independent. +2 draws came from eleven more BUILDINGS. §1.7 |
| 1 | not blocked by what stopped the fill raise | **TRUE.** Occupancy is 0/0 on both sides. What it IS blocked by is corner meetings, and the clip is the answer. §1.4 |
| 1e | **expect noon and dawn to move** | **FALSE. Nothing moved by more than 0.0003.** `lookcheck`'s camera is the origin block, which the generator does not touch. §1.8 |
| 1f | from the street, are the gaps gone | **NO, AND DEPTH WAS NEVER GOING TO CLOSE THEM.** A gap in a street wall is a frontage fact. Frame 3. §1.6 |
| 2 | lamp columns and signal heads are a **seventh and eighth spelling** | **ONE SEVENTH SPELLING.** Kerbside lamps have tested since s34; the masts the operator saw are SIGNAL masts. The other defect is a site that asks correctly at the wrong point. §2.2 |
| 2b | **enumerate** every site that asks | **23 declared, 60 code references over 7 files: 11 ok, 10 n/a, 2 blind.** §2.3 |
| 3 | the weir's claim may be **far larger than the thing** | **FALSE. It is 1.000.** 210.0 × 210.0 delivered against 210 × 210 claimed. §3 |
| — | *"treat everything below as a hypothesis with my name on it"* | **Four of thirteen premises above are false or misattributed.** |

---

## 7. `perfcheck` — TWELVE RED MILLISECONDS THAT ARE NOT ADMISSIBLE, AND FOUR CONTENT REDS THAT FLAP

**`perfcheck` was run twice: once after item 1 at `load1` 2.08 and once after item 2 at 3.53.**
Both are over CONTRACT §0.2's bar of 1.6. Twelve of the reds are milliseconds — a GPU p95, a
GPU max and a frame interval on each of the four routes, the frame interval at **63–70 ms
against a 12.5 ms ceiling in the second run against 23–27 ms in the first, on identical
content**. That is the machine, it is recorded, and **none of it is attributed.** The GPU timer
queries retired again (`issued 1827 drained 1827 disjoint 0 starved 0`), the second session
running, so the attribution is there for whoever runs this quiet.

**THE COUNTS ARE IDENTICAL ACROSS THE TWO RUNS**, which is what makes them the admissible half
and which is also item 2's whole cost report: 332 / 433 / 336 / 322 draws, 152 461 / 204 631 /
188 193 / 152 461 instances, the same triangles. **The signal repair cost nothing** — the rows
were already allocated and are now collapsed rather than written.

**THE CONTENT REDS, BOTH RUNS, BECAUSE THE PAIR IS THE FINDING:**

```
                                        s34      s35 run 1   s35 run 2   bound
  downtown_dense mean luminance        0.0638     0.0711      0.0854 ✓   min 0.08
      per run                                [.0776 .0607 .0711]  [.0854 .0860 .0843]
  night_rain     mean luminance        0.0675     0.0672      0.0703     min 0.08
  downtown_dense frame entropy          4.862     5.074 ✓     5.396 ✓    min 5
  night_rain     frame entropy          5.030     4.967       5.026 ✓    min 5
      per run                                [5.084 4.93 4.967]   [5.061 4.898 5.026]
  highway_speed  dark gap at ground    68% of 62   ✓ absent    ✓ absent   min 75%
  highway_speed  tone profile          66% of 62  59% of 65   61% of 61   min 75%
```

> **`downtown_dense` MEAN LUMINANCE CROSSED ITS FLOOR BETWEEN TWO RUNS OF TREES THAT DIFFER
> ONLY IN TRAFFIC, AND THAT IS NOT A REPAIR — IT IS THE STATISTIC.** Run 1's three readings
> span 0.0607 to 0.0776, which is **2.1× the whole distance from the floor to the reading**.
> Run 2's span 0.0843 to 0.0860. CONTRACT §0 rule 6's own condition, and `budget.json`'s
> `$meanLuminance_s16` already argues this number should be per-route. **Neither run is a
> verdict.** The same sentence covers `night_rain` frame entropy, which was green at s34, red
> in run 1 and green in run 2 with per-run readings straddling the line both times.

**`dark gap at the ground` is CLOSED on both runs** — 68% of 62 at s34, absent from the
violation list now, with the median ground contrast at 0.8093. **Nothing was aimed at it**, the
population is not s34's, and STATE 33 and STATE 34 both record this family as one that flaps
on a re-phase. It is recorded as closed and not as achieved.

**`tone profile` is the one that stayed red on every reading** — 66%, 59%, 61% against a 75%
floor on three different populations. STATE 34 §5 already says which change moves it and that
change is item 5b, which is still not built.

---

## 8. WHAT WENT ON THE BRANCH

Branch `claude/noctis-35-building-depth`, from `a787407`.

```
  2825eaa  item 3 — the weir's claim is exactly the size of the weir
  0f60c9a  item 2 — the signals asked nobody, and the vehicles asked from the wrong end
  528cfd9  LOOK.md §2 — the block interiors have a number
  2c0a4a4  item 1 — buildings that go to the back of their lot
  a787407  <- session 34's STATE, the branch point
```

**NO BUDGET FILE CHANGED.** `budget.json`, `look-budget.json`, `city-budget.json` and
`input-budget.json` are byte-identical to session 34. **No threshold moved, lowered, raised or
re-derived.** No look band went red that was not red before, so nothing was owed.

`origin/main` still carries session 34's `b2ad696` and nothing after it — the repair STATE 34
§10 names is still one command and still the operator's:

```
git push --force-with-lease origin 2b04ace:main
```

---

## 9. KNOWN GAPS CARRIED FORWARD

**Unchanged from s8–s34**: `stats().cutoffM` hard-codes 0.8, the headroom probe inert,
`saturation-peak.png` overwritten every run, `$fovYDrift`, `camera.setRouteAt(name, 1.0)` at
the sky, rain streaks near-invisible wide at night, `rain_spray` 0 static, **right turns only**,
sun shadows to ~170 m, the bake blind to elevated slabs, the PMREM hitch, the too-red dawn
horizon, one worker at queue depth one, the far half of the river handing back to the night sky
past ~300 m, grime authored, the near-field washboard on the water, the quay wall inside the
walkable mask, props absent from the walkability mask, the 3.5°–10.4° route camera pitch, the
frozen/running A/B, `materials.display` drawn by nothing, the hauler's marker row buried inside
its own body, the seeding fallback's untested placement, **a bus never turns**, the origin
block's absent occupancy registry, `facadeAlbedo` on its floor with zero spread, the station's
cores reading as an open frame, **nobody can climb the station**, the 0.10 m margin at the
core's outer face, `poseprobe`'s blindness to the origin block, the pavement's missing kerb,
`tools/city-budget.json:84`'s stale `$derivation_count`, the `sign(adpillar) × prop(planter)`
overlap that stops the fill raise, one merged building pool breaching the triangle ceiling, the
station's platform slab hiding the train, `traffic.js:2346`'s claimed draw-call margin of one,
`minStraightness` and `minArrivalsPerMinute` having no gate reader, the zero-second protected
pedestrian phase, **44 100 m² of the city is an empty concrete bowl**, `landmarkBlocks` still
exported and still disagreeing with the registry two ways, **the basin is walkable in the mask
and unwalkable in the geometry**, and a gate message frozen in the present tense of the session
that wrote it.

**CLOSED THIS SESSION:**

- **"buildings 19.4 m deep into a 52.3 m half-block with nothing built past 31 m"** — the
  largest single change left at the end of session 34, and it is built. §1.
- **The three defects the operator reported at the repaired basin** — every traffic instance is
  out of the weir. §2.

**NEW THIS SESSION:**

- **STATE 33 §6's HEADLINE DEPTH FIGURE WAS TWO LENGTHS POOLED.** 19.4 m is `bld.depth` read
  for every building without consulting `bld.facing`, so half the population contributed its
  FRONTAGE WIDTH. The tell was in the same table: max 27.0 m, which is `rng.range(11, 27)`'s
  own ceiling and unreachable by any depth roll. §1.1.
- **A CLAIM BUILT FROM EXACT FACES DISAGREES WITH A DELIVERED BOX BUILT FROM A CENTRE.** The
  exact repair for the lot-line ulp put 59 zero-area `building × pavement` overlaps into the
  delivered census. Both sides must compute the same expression, which beats computing the
  right one. §1.5.
- **THE QUAY WALK HAS THE SAME ULP EXPOSURE ON ITS FAR FACE, ON FOUR NAMED CHUNKS.** §1.5.
- **A SEVENTH SPELLING OF "DOES A LANDMARK STAND HERE" AND IT SPELLED IT AS NOTHING.**
  `writeSignals`, ten heads inside the weir — from a junction that is one metre OUTSIDE the
  claim. §2.2.
- **A SIXTEEN-SLOT POOL THAT HAD NEVER HAD A SLOT LEFT OVER HAD NO CODE TO CLEAR ONE.** §2.2.
- **THE DISH DELIVERS 88 m OF STRUCTURE AGAINST A 62 m KEEP-OUT — 2.041.** Thirteen metres
  outside its own claim on every side, and whether it is at grade is a question this session
  did not answer. §3.
- **THE DEEP FRONTAGE TAKES LAND FROM THE QUAY TERRACE**, 12 → 9 buildings, and which frontage
  owns a narrow riverside lot is undecided. §1.6.
- **`clumping` CV IS DOWN TO 0.026 OF MARGIN**, the tightest it has been. §5.1.

---

## 10. WHAT TO DO FIRST NEXT TIME

1. **Run `gateaudit`.** Three sessions have now recorded it as not run, which is three sessions
   in which `lookcheck`'s own thresholds have not been falsified.
2. **The frontage, not the depth.** §1.6's arithmetic says coverage is 0.73 × 0.244 of the
   reference and depth is the knob that has been turned. The other one is
   `sign(adpillar) × prop(planter)`, 0.061 m², and it has stopped the fill raise for three
   sessions.
3. **Ten minutes on the dish.** §3 leaves one question with a number attached.
4. **A quiet machine.** The GPU timer queries have retired two sessions running and nobody has
   yet read them under `load1 < 1.6`. Every millisecond in the last three STATE files is
   inadmissible.
