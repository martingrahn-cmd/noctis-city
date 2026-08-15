# NOCTIS — STATE

*End of session 31. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
MacBook Air, Mac17,4, **Apple M5**, 10 cores (4 performance, 6 efficiency), 32 GB, `node
v25.9.0`. Every gate that reads a pixel printed `ANGLE (Apple, ANGLE Metal Renderer: Apple
M5)`. The brief's claim about the machine is the one premise of six that held exactly.*

***`load1` WAS 1.78 AT THE FIRST COMMAND OF THIS SESSION'S SECOND PASS — ABOVE CONTRACT
§0.2's BAR OF 1.6 — AND ROSE TO 3.5 DURING THE GATE RUNS.** So **NO MILLISECOND IN THIS
STATE IS QUOTED AS A VERDICT**, and `perfcheck`'s two frame-time reds are recorded as
inadmissible rather than as findings. Counts, draw calls, instance counts, triangles,
cluster counts and pixel fractions ARE quoted, because counts do not drift (§9 rule 6's
corollary), and every one of them below was measured on this machine today.*

---

## 0. THE STATION EXISTS. IT ALSO HIDES THE TRAIN, AND THAT IS THIS SESSION'S FINDING.

Four sessions listed the station last and four ran out of room. **Stages 1 and 2 of STATE
27 §8.1 are built and committed.** Stage 3 — the `walkableAt` change that lets the
pedestrian network leave the ground plane — is deliberately **not started**.

> **There is one station, on the viaduct's crown at (0, 11), the crossing every gate camera
> and all four routes can see. It is 87.27 m of platform on eight deck segments, walking
> surface at 22.720 m, a canopy on a column line at 25.50 m, an edge wall closing the side
> elevation up to 23.87 m, and two vertical circulation cores on the ground at (±8.30,
> 25.00) carrying 133 risers of switchback stair and a 2.40 m lift shaft each.**

**AND THE EDGE WALL STANDS BETWEEN THE STREET AND THE TRAIN.**

The look gate's own camera — `shot 'street'` at `[70, 1.74, 0.9]`, which is the operator's
own pose — looked straight at the crossing before this branch and saw **a rake of lit
carriage windows** crossing the sky, the brightest structure in the upper half of the
frame. At HEAD it sees **a flat dark box**. Open `tools/look-out/midnight.png` against
session 30's and it is not a subtle difference; it is the single most prominent night
feature in that frame, gone.

**The train is not missing. It is hidden.** Rendered from 42 m up at the same instant
(`node tools/lookat.mjs --pos=58,42,-34 --target=-2,20,16 --fov=45 --t=0.0`) the train is
there, lit, running the full length of the deck. The local-light count is **95 before and
95 after**. The city is still building it, still lighting it, still paying for it, and the
street can no longer see it.

**The arithmetic, and it is a subtraction anybody can check.** The edge wall's top is
22.72 + `wallAboveM` 1.15 = **23.87 m**, its outer face is at t = **7.55 m**, and it runs
unbroken for all **87.27 m** of platform. The train's roof cannot exceed rail 21.62 +
`VIADUCT_LOADING_GAUGE_M` 4.2 = **25.82 m**. So the wall reaches to within **1.95 m** of
the highest thing behind it while standing 7.55 m nearer the eye — and from a 1.74 m eye at
street level the sightline that grazes the parapet passes **above the train for the whole
length of the platform**.

### 0.1 WHAT IT COST THE LOOK GATE, MEASURED BOTH ENDS AND BISECTED

`lookcheck` **was never run by the pass that built the station.** STATE's previous draft
said so itself and presumed the two reds it inherited were unchanged. Both halves of that
presumption are wrong. Run at session 30's head in a `git worktree` and at HEAD, two
minutes apart on the same machine:

```
  band            s30 head 963b293   HEAD 607aff6    delta     threshold        verdict
  midnight            0.1110            0.0745     -0.0365   [0.072, 0.112]   green -> green
  dawn                0.3014            0.2983     -0.0031   >= 0.299         GREEN -> RED
  noon                0.4289            0.4285     -0.0004   >= 0.428         green by 0.0005
  dusk                0.1454            0.1389     -0.0065   [0.140, 0.180]   GREEN -> RED
```

**`band:midnight` moved by 0.0365 — forty times the 0.0009 of headroom this project has
spent three sessions protecting** — and it moved AWAY from the ceiling it was pressed
against and DOWN to within **0.0025 of its floor**. It did not breach. It changed which
end of its own band it is about to fall out of, and nobody was watching that end.

**Bisected over the three content commits, so the attribution is not a guess:**

```
  commit                       midnight   dawn     noon     dusk    draws  emitters  reds
  963b293  session 30 head      0.1110   0.3014   0.4289   0.1454    301      71       2
  0090283  + THE STATION        0.0731   0.2986   0.4282   0.1384    301      59       6
  3e826c8  + the pavement       0.0731   0.2985   0.4283   0.1384    301      58       6
  f4e3be1  + the stalls         0.0744   0.2983   0.4284   0.1389    296      64       5
  607aff6  HEAD                 0.0745   0.2983   0.4285   0.1389    296      63       5
```

**Every red is the station's.** The pavement moves the look by ±0.0001 and the stalls give
back six emitter clusters and five draw calls. The station alone opened four assertions —
`band:dawn`, `band:dusk`, `facadeAlbedo` (4 distinct wall clusters → 3) and
`facadeNeighbours` — and a fifth, `emitters:midnight` at **59 against a floor of 60**,
which the stall commit then closed by accident at 64.

It also **closed one**: `distinct:midnight|dusk` was RED at session 30 (0.02519 against
0.03) and is green at HEAD (0.03114), because darkening midnight pushed it away from dusk.
`lookcheck` went **RED AT 2 → RED AT 5**.

**The mechanism, measured per pixel** against the same eight PNGs (the instrument
reproduces `lookcheck`'s own four means to the digit, which is why it is trustworthy):

```
  frame      pixels changed   mean delta on the changed pixels
  midnight       37.5%              -0.0975     75% of the loss in a quarter-height
                                                band 14% down the frame — the station
  dusk           11.3%              -0.0600
  dawn            8.3%              -0.0698
  noon            8.4%              +0.0018   <- the tell
```

**Noon is the tell.** The same silhouette changes the same 8.4% of pixels and the mean does
not move, because at noon the sunlit concrete is as bright as the sky it replaced. This is
not "a station is heavy". It is **a dim surface standing where the bright things were**,
and it is worst exactly where this project is most fragile.

### 0.2 WHAT TO DO ABOUT IT — AND WHY THIS SESSION DID NOT DO IT

**No threshold was moved**, and none should be moved to make this go away. Four bands are
open questions that CONTRACT §0.2 and STATE 27 §8.3 both reserve for the operator, and the
brief reserved them again.

**`band:dusk` and `band:midnight` have a content answer and it is already designed.**
STATE 27 §8.1 **Stage 5** — *"a lit platform is an 80 m line source at 23–25 m … the single
largest remaining lever on how the night city reads"*. It was written as the stage that
makes the night city better. This measurement changes its status: **building Stages 1 and 2
without Stage 5 SUBTRACTS light from the night city**, and Stage 5 is now the repair for
two red assertions rather than an enhancement. That is the strongest argument this project
has produced for what to build next, and it was produced by a gate nobody had run.

**`band:dawn` has no content answer.** At dawn the lamps are off (`lookcheck` prints
`lamps off`, 37 961 lx direct) and the deficit is 0.0007 of frame mean caused by geometry
occluding a bright sky. No amount of platform lighting reaches it. Either the station's
silhouette changes or the band does, and **the band is the operator's**.

**Nothing here was tuned to recover a number.** The brief's own instruction for item 4 —
*"do not tune it to make an assertion green; choose the city, then report what it did to
every band"* — is the right rule for item 1 too, and this section is what it produces.

### 0.3 THE DESIGN'S FIRST NUMBER WAS WRONG, AND A NEW INSTRUMENT IS HOW

STATE 27 §8.1 specifies Stage 1 as *"two side platforms **on the deck**, 80 m long,
**3.0 m wide**"*. `tools/stationprobe.mjs` is new, reads the DELIVERED instance matrices
rather than any constant, and prints the deck's section at the crown:

```
  ballast trough   0.68 .. 3.78      walkway kerb   3.20 .. 4.20
  catenary mast    3.85 .. 4.15      parapet        4.30 .. 4.70
  deck edge                4.75

  the gaps inside the deck edges:  0.150 / 0.100 / 1.364 / 0.100 m
```

**The widest clear run on this deck is 1.364 m and it is the six-foot** — the space between
the two running lines, serving no door and reachable from nowhere. 3.0 m is short by
1.636 m against the best of them. CONTRACT §9 rule 7: a dimension correct in itself, taken
from a datum nobody confirmed.

**So the structure widens at the station, which is what an elevated station is — and it is
purely additive.** Not one existing box moves or disappears:

```
  platform inner   4.30  vs the catenary mast's outer face  4.15   clear 0.15
  platform under  22.37  vs the parapet's top              22.20   clear 0.17
  canopy inner     4.60  vs the same mast                   4.15   clear 0.45
  canopy top      25.50  vs the catenary ARM               26.90   clear 1.40
  wall outer       7.55  vs the block's clear band          10.5   clear 2.95
  core outer      10.40  vs the same band                   10.5   clear 0.10  <- tightest
```

**A revert of `0090283` restores the previous viaduct exactly — and restores the train to
the street.** That is the cheapest available answer to §0.1 and it is stated here so the
operator has it: the station and the visible train are, at this geometry, alternatives.

Stage 2's plan figure is wrong the other way. STATE 27 says a switchback *"occupies about
8 × 12 m in plan"*. A 12-riser flight at 0.28 m going is 3.36 m of run, so a cycle is
**4.76 m long by 3.80 m wide** and what accumulates is HEIGHT — 4.08 m a cycle.

**Nobody can climb it yet and nothing tries.** Stage 3 is next session's headline.

---

## 1. LOOK AT THESE FIRST, IN THIS ORDER

The first pair is the session. Everything else is supporting.

| # | pair | what to look for |
|---|---|---|
| 1 | `shot-out/s31-TRAIN-crop-{before,after}-t0.png` | **THE FINDING, AND START HERE.** The viaduct band of the midnight frame, cropped. A rake of lit carriage windows becomes a flat dark box. |
| 1b | `shot-out/s31-TRAIN-midnight-{before,after}-t0.png` | The same two frames whole, so the crop cannot be accused of choosing its evidence. Both rendered today, two minutes apart, same machine — *before* is `963b293` from a `git worktree`. |
| 2 | `shot-out/custom-t0.png` | **The train, from 42 m up, at HEAD, at midnight.** Proof it is hidden and not missing. |
| 2b | `shot-out/s31-band-dusk-{before,after}-t0_78.png` | `band:dusk` going red, 0.1454 → 0.1389. |
| 3 | `s31-operatorpose-{before,after}` | His own pose at noon — the viaduct goes from an open deck to a solid station box. |
| 4 | `s31-station-up-{before,after}` | Street level looking up, the widened soffit against the running viaduct beyond. |
| 5 | `s31-stair-{before,after}` | The two cores. **Shows the open-frame problem** (§11). |
| 6 | `s31-pavement-{before,after}` | Item 2, the most legible pair. Before: the road stops dead a third of the way in. After: the street network runs to the horizon. |
| 7 | `s31-stalls-{before,after}` | Item 3. A dense line of identical silhouettes becomes one stall reading as an object. |

```
2  node tools/lookat.mjs --pos=58,42,-34     --target=-2,20,16     --fov=45 --t=0.0
3  node tools/lookat.mjs --pos=70,1.74,0.9   --target=-70,1.0,-0.6 --fov=55 --t=0.5
4  node tools/lookat.mjs --pos=2.5,1.74,-46  --target=-3.0,21.5,14 --fov=58 --t=0.5
5  node tools/lookat.mjs --pos=0.5,1.74,3    --target=8.3,13.0,26  --fov=55 --t=0.5
6  node tools/lookat.mjs --pos=0,95,4        --target=620,0,4      --fov=48 --t=0.5
7  node tools/lookat.mjs --pos=80,1.7,122.5  --target=145,1.5,118  --fov=55 --t=0.5
```

**`poseprobe` CLEARED A POSE THAT WAS INSIDE A BUILDING.** It reported 72 of 72 candidate
poses unobstructed at 45 m from the station; the first frame from one of them is a facade
filling the lens. `poseprobe` ray-tests `city.residentOccluders()`, the STREAMED city —
**it cannot see the origin block's ten buildings**, and the station is inside
`BLOCK_KEEPOUT`. Every pose above stands on a street the block actually builds.

---

## 2. WHAT WENT ON THE BRANCH

Session 27's branch, `claude/noctis-25-building-floors-89bqul`. **NOTHING MERGED TO MAIN.**
Each commit is independently revertible.

```
  efe3a3a  item 7 (2nd pass) — the doc was fixed and the RUNTIME line was not
  607aff6  STATE 31 (first draft — superseded by this file)
  e54363f  item 7 — fourteen of sixteen were already fixed; two were not, four more wrong
  f4e3be1  item 3 — five stall kinds and ONE delivered scale
  3e826c8  item 2 — the pavement stopped where the STREET LAMPS stop
  0090283  item 1 — THE STATION
  963b293  STATE 30  <- session 30's head, and the "before" of every pair above
```

**THE BRIEF SAYS THE BRANCH CARRIES FOURTEEN COMMITS. IT CARRIES 30 above `main`**
(counting this file's own commit, which is the last of them) and 19
above session 27's tip `6f4990b`, counted with `git rev-list --count main..HEAD`. First
false premise, cheapest to check.

**NO BUDGET FILE CHANGED.** `budget.json`, `look-budget.json`, `city-budget.json` and
`input-budget.json` are byte-identical to session 30. No threshold moved, lowered, raised
or re-derived.

---

## 3. THE BRIEF'S PREMISES, MEASURED

| # | the brief said | measured |
|---|---|---|
| — | the branch carries **fourteen** commits | **29** above main, 19 above session 27 |
| — | the machine is a **MacBook Air M5** | **true.** Mac17,4, Apple M5, 10 cores, 32 GB |
| — | draw calls stand at **434 of 440. Six left.** | **430 of 440. TEN left.** `perfcheck` on `highway_speed` at HEAD |
| 1 | STATE 27's five-stage design is what to build | Stage 1's *"3.0 m on the deck"* **does not fit**; the deck's widest clear run is 1.364 m and it is the six-foot |
| 2 | pavements are per **BLOCK**, so they exist only where buildings do | **wrong.** 289 of 289 chunks emit pavement, 0 of 289 emit none. It ended at `CITY.nearRadius`, which is the STREET LAMPS' radius |
| 3 | the stalls have **one form** | **wrong** — five kinds, five geometries. But **one delivered scale and one yaw across all 340** |
| 4 | `fill = 0.12 + 0.88·d^2.2`, d 0.3 → 18%, d 0.5 → 31% | **arithmetic exactly right** (0.1823, 0.3115). The QUANTITY is wrong: `fill` is a per-candidate acceptance probability on a 1-D perimeter walk, not an area share |
| 5 | the lognormal *"possibly never shipped"* | **it shipped in session 20**, commit `ca0169f`. Live at HEAD |
| 6 | the glTF path — *check it, build nothing* | **§8. Six of the seven classes fit. The seventh breaches by two draw calls.** |
| 7 | session 30 found sixteen comment numbers and **left them** | **wrong for fourteen.** 14 corrected, 1 half, 1 untouched — and four more were wrong, and **six more again** (§5.1) |

**Six of seven wrong, and the two that held are the machine and the ceiling's existence.**
The ceiling's VALUE was wrong in the safe direction: there is more margin than the brief
believed, which is why §8's answer is "six classes" and not "none".

---

## 4. ITEM 2 — IT STOPPED WHERE THE STREET LAMPS STOP

`city.js` had `const near = detail && ring <= CITY.nearRadius`, and `near` gated **two
unrelated things**: the road surface and the street lamps. Measured off the delivered
rectangles AND predicted from the lattice arithmetic — both agree exactly:

```
  pavement ended 256.0 to 395.7 m from the camera, on a box that follows it
  walked along z = 9.6:  walk 264 .. 383.9, then EARTH from 384.0 = (2+1)·128
```

**Raising `nearRadius` is the one fix that cannot be taken.** A lamp chunk emits two
`InstancedMesh`es, so ring 2 is 50 draws and ring 4 is 162 — **+112 against a ten-draw
margin.** So the ground got its own radius:

```
  CITY.groundRadius = 4, cost measured by ANNULUS (a per-chunk mean over-states by 18%,
  because the origin ring contains BLOCK_KEEPOUT and is not a typical chunk):

    ring <= 2   25 chunks   185 rects    370 tris    39 960 B   kinds {road, walk}
    ring <= 4   81 chunks   536 rects   1072 tris   115 776 B   + grass, path, siteGround

  DELIVERED: `city:ground` is ONE mesh of 1072 triangles. +702 against a 2 000 000
  ceiling, +0.0723 MB against 96, and ZERO draw calls. The pavement now ends 512–652 m out.
```

Both figures re-measured this session by an independent headless walk of `generateChunk`
and they reproduce exactly. The old justification — *"it was costing a draw call a chunk"* —
was true when written and stopped being true when `rebuildGroundMesh` merged every resident
chunk's ground into one mesh.

### 4.1 WIDENING THE RING PUT TWO LATENT DEFECTS INTO THE CENSUS

Both are as old as their labels; what changed is that something finally looked.

1. **`occupancy` went 0 → 60 forbidden overlaps, DELIVERED**, worst
   `site(ground:site) × prop(container)` at 4.48 m². `buildGround` labelled a construction
   site's GROUND RECTANGLE `site`, the category for a site's FIXTURES. Meanwhile `grass`
   was passed through unmapped, matched no entry in `CATEGORIES`, and claimed **nothing at
   all**. Over-claiming and under-claiming from one missing row. **`occupancy.js` gains
   `ground`**, forbidden against building, landmark and water only.

2. **Then 60 more**, `pavement × feature(edge:hedge)`, 0.012–0.066 m². A park's edge run is
   set back by its own half-thickness, then drawn with a yaw jitter: the generator tested
   the unrotated box and `city.js` drew the rotated one. **§9 rule 7 — both halves of the
   two-sided check spelled the same omission, so both reported zero.** Set back by the
   rotated AABB using `CITY.maxYawDeg`, which keeps it out of the RNG sequence.

### 4.2 WHAT ITEM 2 DOES NOT FIX

**The pavement still ENDS, 256 m further out, and still as a zero-thickness slab.**
`buildGround` has one emitter — six vertices at one y, normal (0,1,0) — so the streamed
city contains **no vertical ground face anywhere**. The step at the edge is 0.180 m, under
`PLAYER.stepUpM` 0.20, so it is a visual defect and not a collision one. **Nobody has
measured how many edges are exposed.**

---

## 5. ITEM 3 — FIVE KINDS AND ONE SCALE

Measured two independent ways that agree exactly:

```
  distinct instance scales    EXACTLY ONE, (1.000000, 1.000000, 1.000000)
  distinct yaw mod 90°        EXACTLY ONE
  distinct canopy cloths      8          distinct soil tints   336
```

The operator's *"one form"* is wrong — five kinds, box counts 5/8/7/12/9 — and his own row
of nine contains all five. **The vocabulary is five and the dimensions were one**, and at
close range a dimension is what you read.

**The row of ten is real and was located rather than believed**: chunk (−2,−2), the
island's north pavement, **9 stalls on one 108.8 m edge** at a mean gap of 11.12 m.

Shipped at **zero new boxes, meshes, materials and draw calls**, because scale and yaw ride
in `instanceMatrix`:

```
  STALL_MAX_PER_CHUNK  30 -> 18     delivered 340 -> 199, one per 32.0 m -> one per 54.4 m
  STALL_MAX_PER_EDGE   4, new       a row of ten becomes impossible by construction
  STALL_SIZE           per-pitch roll on all three axes, ACROSS capped at 1.0
  STALL_YAW_JITTER_DEG 2.0          under alignment's 3° cap
```

All four live in `src/modules/streetlife.js` (504, 522, 560, 577), **not** `constants.js`.
`minStallsNearRing` is 60; 199 clears it by 3.3×. The 340 → 199 delivery was reproduced
this session from the code alone: summing `round(MAX · smoothstep(0.34, 0.85, density))`
over the 25-chunk ring gives **342 at MAX=30 and 200 at MAX=18**, against a delivered 341
and 199 — one abandoned pitch each time.

**THE TRAP WAS AVOIDED, AND IT WAS CHECKED RATHER THAN ASSERTED.** `hx`/`hz` could have
come from `fp.halfAlong`/`fp.halfAcross` UNSCALED, drawing a stall wider than the rectangle
`rectBlocked` tested. `streetlife.js:3021–3035` multiplies both half-extents by their
rolled scales and folds the 2° jitter into a rotated AABB **above** the test, and
`composeScaledYaw` at :3281 hands the same three numbers to the drawn matrix. The tested
rectangle is the drawn box's world AABB plus the rotation bulge — never under it.

### 5.1 AND THE COMMENT PASS FIXED THE DOC AND LEFT THE RUNTIME LINE — `efe3a3a`

Item 7's first pass corrected six comment sites and **all six are right**, including the
`210` where the code says `420` (`originNits` = 1952.1892 × 0.215143 = 419.99984). It did
not correct the places those same numbers are ALSO written. Six more, fixed this session:

- **`streetlife.js`'s `ctx.log`** still evaluated `smoothstep` at density **0.5** where the
  ring's own mean is **0.5747**, and still divided **512 m** of chunk kerb where a stall
  stands on **435.2 m** of island loop — the two errors the doc comment 3 000 lines above
  had just been corrected for. It printed *"4 per chunk and 100 over the ring, one per
  128 m"* against a delivered **199, one per 54.7 m**. Dropping 30 → 18 made this line
  **more** wrong, not less. The replacement does not re-derive the count at all; it prints
  the caps, which are exact, and names `stallStats()` as the authority.
- **`streetlife.js:773`** — *"stalls yaw in multiples of 90°, so the world AABB is exact"*,
  falsified by `STALL_YAW_JITTER_DEG` = 2.0 **in the same session that relied on the
  conclusion**. This is precisely the `kerbBands` shape the brief cites as item 7's reason.
- **`streetlife.js:585`** — *"twice the 30 the count can ask for"*; it is 18, so 3.44×.
- **`constants.js:1487`** — a present-tense **210** five lines BELOW the pass's own
  210 → 420 correction, in the same doc comment, also siting it in `block.js`'s EMISSIVE
  table, which has not held it since session 2.
- **`citygen.js:775`** — *"Nine of 432 buildings clear 34 storeys"* as bare present fact,
  55 lines below the same figure correctly labelled a session-20 measurement. `heightprobe`
  at HEAD: **seven of 366**. The ratio survives, 2.08% → 1.91%.
- **`city.js:166, 957, 999`** — three comments calling the ground mesh's extent *"the near
  ring"*. Item 2 exists because those two radii were one threshold, and item 2's own commit
  left three comments asserting the thing it had just disproved.

**NOT DONE AND OWED:** `tools/city-budget.json:84`'s `$derivation_count` carries the same
dead arithmetic (30, 175, 512 m, *"one per 73 m"*) **and** the sentence *"road surface and
street lamps exist only for ring ≤ 2"* — the exact claim item 2 falsified. It is untouched
because the brief forbids changing a budget file and §2's byte-identical claim rests on it.
**It is the operator's call and it is the last copy of both errors.**

**ALSO NOT DONE:** goods on the table, side panels, a bare trestle. Each is a new geometry
prototype, i.e. **one new `InstancedMesh` per chunk that delivers it — +5 to +24 meshes**.
The zero-draw-call route is a SHADER change: `noctisLimb.z` already carries a per-vertex
part label and `noctisBodyColor.w` is an uploaded per-instance float a stall never reads,
so a mask collapsing a labelled box to zero size is one line in §5.6's injection.

---

## 6. ITEM 4 — THE FILL LAW. THE KNOB CANNOT DO WHAT THE OPERATOR ASKED.

**Nothing was built and nothing was tuned.** This is the finding the brief asked for.

**THE BRIEF'S ARITHMETIC IS EXACTLY RIGHT.** `fill(0.3)` = 0.1823, `fill(0.5)` = 0.3115.
Over the gate's region density is min 0.158, **median 0.528**, p90 0.681 — so 0.5 is
near-median and 0.3 is the p10. His two worked examples are the right examples.

**THE QUANTITY IS NOT AN AREA SHARE.** `fill` is the acceptance probability for one
candidate on a 1-D **perimeter frontage walk** (`citygen.js:4592`). The roll's pass rate is
0.3756 and the mean of `fill` over built chunks is 0.3744 — agreeing to 0.3%. It
**overstates delivered frontage occupancy by 1.97×**: accepted width over frontage walked
is 6 592.6 / 34 727 = **0.1898**.

**DELIVERED TODAY, over the gate's region:**

```
  frontage occupancy per block   min 0.000  p10 0.000  med 0.229  p90 0.385  max 0.510
  bare-ground share per block    p10 0.296  med 0.809  p90 0.948  mean 0.724
  street-wall gaps (663 of them) p10 1.3 m  MEDIAN 26.1 m  p90 84.1 m  max 104.6 m
  gap fraction of buildable frontage                                   0.7559
  192 of the region's 400 block sides are bare END TO END
```

**AND THE SWEEP, WHICH IS THE ANSWER:**

```
  law                              buildings  occupancy  gapFrac  median gap
  0.12 + 0.88·d^2.2   SHIPPED           366     0.2441    0.7559     26.1 m
  0.12 + 0.88·d^1.6                     458     0.3137    0.6863     19.5 m
  0.40 + 0.60·d                         630     0.4315    0.5685     12.9 m
  0.70 + 0.30·d                         717     0.4883    0.5117      9.7 m
  1.00                CEILING           797     0.5510    0.4490      7.3 m
  1.00 + end-of-run gap 6–26 -> 0.2–1.4 921     0.6181    0.3819      1.9 m
```

> **AT `fill = 1.0` — every candidate accepted, the knob at its stop — the delivered street
> wall is 55.1% and 44.9% of the frontage is still gap. RAISING THE FILL LAW CANNOT CLOSE
> THE STREET WALL.** The remaining 45% is the WALK, not the roll.

**Three corrections to that paragraph as it was first written, found by re-reading the
source rather than the summary:**

1. **`rng.range(1, 7)` is NOT the end-of-run gap.** It is the REJECTED-CANDIDATE advance at
   `citygen.js:4593`. The real end-of-run gap is `rng.range(6, 26)` at `:4944` — which the
   sweep table above names correctly while the prose named it wrongly, **inside one
   section**. CONTRACT §9.1's shape. The brief inherits the error verbatim. Both draws are
   real and both are gap sources; the finding survives and the NAME does not.
2. **`floors.visibleInstances` cannot be the binding budget for ADDING buildings.** It is a
   **floor** (`budget.json`, 115 000 against a delivered 158 458); adding buildings moves
   it further from breach. It binds a DELETION. The ceilings that bind an addition are
   `triangles` 2 000 000 and `drawCalls` 440.
3. **The sweep held the quay LAW fixed but cannot have held the quay PHASE fixed** — the
   quayside walk reads the same `rng` stream, so a changed island acceptance re-phases it.

**THE RE-PHASING IS THE REAL COST OF 4b, AND IT IS STRUCTURAL.** The accept and reject
branches consume different numbers of draws from the shared `layout` stream — 2 for a
reject, 4 for a plain accept, 6 for a contemporary one, 3 for a river-shallow refusal. So
**a single flipped verdict moves every draw after it in that chunk**, and the whole city
downstream of it changes. A causal term is therefore not a small edit to a constant; it is
a re-seed of the region's content.

**The good news for 4b, established and not built:** every cause the brief names is
**already a pure function inside `citygen.js`** — the river, the viaduct arc, the station
(`VIADUCT_STATION.atS = [0]` → the crown → world (0, 11), derived from the landmark record
alone), the bridges. **A causal fill term needs no new import and no new data.** What it
needs is a decision about re-phasing, and a session that is not also carrying a look
regression.

### 6.1 AND THE DRAW-CALL DELTA IS **NOT** ZERO. THIS IS THE NUMBER ITEM 4d ASKED FOR.

The previous draft said *"buildings ride in the chunk's merged mesh, so the expected
draw-call delta is zero and the binding budget is triangles"*. **That is wrong, and it is
wrong in the direction that matters.** Buildings do not ride in one merged city mesh. They
ride in **two PER-CHUNK `InstancedMesh`es** — `${rngKey}:masses` and `${rngKey}:windows`
(`city.js:2828`, `:2837`) — and `masses` also casts, `const casts = detail && ring <=
CAST_RADIUS` (`:2810`). So:

```
  a chunk that gains its FIRST building gains
     :masses  scene   +1
     :masses  shadow  +1   (inside CAST_RADIUS, on a sunlit route)
     :windows scene   +1
                      = 2 to 3 draw calls, whenever that chunk is in frustum
```

**And the region has chunks waiting to be populated.** Measured this session over
`city-budget.json`'s own 10 × 10 region at seed 1337, by walking `generateChunk` directly:

```
  100 chunks, 23 with ZERO buildings, of which 6 are NOT lowDetail:
     (-4,-5) d=0.323   (-3,-4) d=0.370   (-3,1) d=0.715
     (-2,-4) d=0.480   (0,-1)  d=0.593   (4,-4) d=0.524
```

**One of them sits at density 0.715, close to the region's p90, and has built nothing at
all.** That single row is the clearest statement of §6 there is: the fill law is not what
decides whether a block is dense, because a block at the 90th percentile of the density
field can come out empty.

**The consequence for item 4d, stated as the brief asked.** Six newly-populated chunks cost
**+12 to +18 draw calls** if they are all in frustum together, against a **measured margin
of 10** (§9.1). 430 + 12 = **442 > 440**. The ceiling does not obviously admit a fill raise,
and the thing that decides it is not the law but **how many newly-populated chunks the
worst route sees at once** — which nobody has measured, and which is now a specific,
cheap, well-posed measurement rather than a vague worry. **It is owed before anything is
raised, and it may well be the number that stops it.**

**And a second ceiling behind the first.** The generator is a **PERIMETER-RING** generator:
the depth draw is `rng.range(15, 26)`, so the island's central 52.6 × 52.6 m — **25.3% of
every block** — is unreachable by the walk at any fill value. A perfectly closed ring at
the delivered mean depth covers **63.0%** of the island and leaves a 37.0% courtyard.
**"Fill near 1.0 across the whole island" is not reachable by this generator at all**, and
that is a fact about its shape rather than its constants.

---

## 7. ITEM 5 — IT SHIPPED IN SESSION 20. NOTHING TO DO.

`HEIGHT_DISTRIBUTION.mode` is **`'logNormal'`**, median 34, σ 0.62, clamps 9–150, and
`git log -L` on the block returns exactly one commit: **`ca0169f`, session 20**. A pass
extracted that commit with `git archive`, ran ITS heightprobe, and reproduced every printed
figure to the digit. Delivered at HEAD, three independent paths agreeing:

```
  n 366   mean 38.90 m   median 32.7   sd/mean 0.645   p99 133.7 m   max 154.2 m
  60 buildings over 60 m (16.4%)   13 over 100 m (3.6%)   7 over 34 floors   max 49 floors
```

The comment's figures are stale only because the POPULATION fell: session 21's occupancy
registry refused buildings and the region has held 366 since. **p99 134 and max 154 are
byte-identical at every commit from `ca0169f` to HEAD.** The ratio is the claim and it
survives — 1.562× then, 1.550× now.

---

## 8. ITEM 6 — THE glTF PATH. IT IS OPEN FOR SIX CLASSES AND CLOSED FOR SEVEN.

**No loader, no model, no dependency added, and none is proposed here.** This is the
costing the brief asked for, and every number was read out of the source today.

**WHAT THE FLEET COSTS NOW.** `traffic.js` builds **three** `InstancedMesh`es for the whole
fleet — `traffic:bodies` (:2351), `traffic:lights` (:2352), `traffic:wheels` (:2353). A
vehicle is `BOXES_PER_VEHICLE` instance ROWS in the body mesh, so a class today is
expressed per-instance and costs no geometry of its own. Only `bodyMesh.castShadow = true`
(:2367), so the bodies are submitted twice:

```
  traffic:bodies    1 scene + 1 shadow   = 2
  traffic:lights    1 scene              = 1
  traffic:wheels    1 scene              = 1
                              THE FLEET  = 4 draw calls on a sunlit route (3 at night)
```

**WHAT ONE glTF CLASS COSTS: EXACTLY ONE DRAW CALL PER PASS, NOT ZERO.** three.js pushes
one render item per (object, geometry, material, group) and increments
`info.render.calls` once per `renderBufferDirect`. **A shared material saves a program, not
a call** — `traffic.js:2342` already says exactly this about the wheel mesh sharing
`bodyMat`. And every primitive in a `.glb` is its own `BufferGeometry`, so reaching one call
per class requires merging the file's primitives into one geometry with one material
*before* instancing. A three-material body (paint / glass / lamp) costs three.

**THE ARITHMETIC, against a margin of TEN measured today.** There are **seven** classes —
`wedge, pod, van, hauler, moto, bus, lorry` (`LOFT`, `citygen`-style table at
`traffic.js:1034–1354`; `BODY_TYPES = LOFT.map(loftBody)`).

```
  N glTF classes cost   2N (bodies, scene + shadow) + 1 (lights) + 1 (wheels) = 2N + 2
  they replace                                                                     4
  DELTA = 2N - 2

  N = 7   delta +12   430 + 12 = 442  >  440   BREACH by 2
  N = 6   delta +10   430 + 10 = 440  =  440   fits, with nothing to spare
  N = 5   delta  +8   438                       fits
```

> **SIX OF THE SEVEN CLASSES FIT. THE SEVENTH BREACHES `ceilings.drawCalls` BY TWO.**

**ITEM 6b ASKED WHAT FITS AFTER ITEMS 4 AND 5 HAVE SPENT WHAT THEY SPEND. THEY SPENT
NOTHING** — item 4 built no law and item 5 shipped in session 20 — so the whole ten-draw
margin is available, and six is the answer today rather than an optimistic bound.

**Three variants, costed:**

- **Wheels baked into each class's glTF** (retiring `traffic:wheels`): 2N + 1 vs 4, delta
  +11 at N=7 → **441. Still a breach**, by one.
- **Bodies stop casting shadows**: N + 2 vs 4, delta +5 → 435, fits — and is **refused by
  `traffic.js:2364–2367`'s own reasoning**, *"a car with no shadow floats"*.
- **k MERGED CLASS MESHES, and this is the answer rather than the dichotomy.** Nothing
  forces one mesh per class. For k meshes covering all seven classes the delta is
  **2k − 2**, so `430 + 2k − 2 ≤ 440` admits **k ≤ 6** — and at **k = 4** (two classes to a
  mesh, one mesh holding one) the cost is **+6 draws, 436 of 440**, with the mask
  multiplier held to 2 rather than 7. That is the shape worth designing against.

**AND THE PREMISE UNDER ALL OF IT IS WORTH SAYING PLAINLY, BECAUSE AN EARLIER DRAFT OF THIS
SECTION GOT IT BACKWARDS.** *This project already has per-class geometry at zero extra draw
calls.* The class is chosen when the instance ROWS are written — `traffic.js:3524–3547`
walks `for (let b = 0; b < BOXES_PER_VEHICLE; b++)` and reads that vehicle's own class row
out of `type.boxes[b]` — so seven silhouettes already come out of one mesh at a **1×**
triangle multiplier, about 2 242 triangles a vehicle. **glTF does not buy shape here; it
buys AUTHORING.** The question is not "can this engine draw seven different vehicles for
four draw calls" — it does that today — but "what does it cost to let those seven shapes
come from a modelling tool instead of a box table", and the answer is **+2 per mesh you
split them into, with six splits available.**

**WHAT ELSE A LOADED GEOMETRY MUST DO HERE, none of it optional:** write **location 1** of
the HDR target or leave the motion vector undefined (CONTRACT §5.11); carry the
`NOCTIS_PREV_INSTANCE` define and its previous-`instanceMatrix` attribute (§5.12); be
patched through `lights.patch` or receive no clustered light and no indirect light (§5.6,
§5.7); and supply the box rows that `fleetprobe`, the footprint tables and the collision
lengths are currently derived from — those read box geometry, not a mesh.

**Nothing in the project loads an external asset today**: no `GLTFLoader` import, no assets
directory, no `fetch`. CONTRACT §2.2 permits `three/examples/jsm/**`, so the loader itself
is admissible; the ceiling is the only thing in the way, and it is in the way at seven.

---

## 9. GATE STATE — ALL EIGHT RUN, WHICH IS NEW

Each gate was run individually, because `npm run gates` is `&&`-joined and stops at the
first red, hiding everything after it. **The previous draft of this file recorded five
gates as NOT RUN. They have now been run, and that is where §0 came from.**

```
  parsecheck   GREEN   95 files, contract-clean
  faultcheck   GREEN   7 cases; quarantine surgical, frame survives all seven
  windcheck    GREEN   667 meshes, 663 ok, 0 wound backwards, 0 unmeasured;
                       4 controls behave (good/quad-up ok, reversed/quad-down bad)
  inputcheck   GREEN   walk 3.474 m/s vs 3.500 declared, mouse 0.02858°/count
                       vs 0.02857, lock acquired, fov 75.00
  lookcheck    RED AT 5   band:dawn 0.2983 (>= 0.299)      NEW, the station — §0.1
                          band:dusk 0.1389 (>= 0.140)      NEW, the station
                          facadeAlbedo 3 clusters (min 4)  NEW, the station
                          facadeNeighbours 0.216 (min 0.3) NEW, the station
                          midPatchSample:midWallPanel      CARRIED from before s27
                          + 2 assertions that DID NOT RUN (midAlbedo*), which are
                            not passes
                          CLOSED: distinct:midnight|dusk, 0.02519 -> 0.03114
  gateaudit    RED — and it is lookcheck's redness one layer up. Its CONTROL fails,
                     because the control is the unperturbed frame and that frame is
                     now outside two bands. Every one of its ~40 perturbation cases
                     still fires correctly. gateaudit cannot certify a threshold
                     while the control is red, so it is reporting a broken subject,
                     not a broken gate.
  citycheck    RED AT 1   ONLY the carried 6.00% bright-reserve floor, at 4.29%
                          (an earlier run in the same session gave 4.36%, per-run
                          means [4.36 4.50 4.18], spread 0.31 — the two are the
                          same reading).
                          occupancy 0/0 forbidden overlaps over 50 pairs, generator
                          AND delivered. sceneWalk GREEN. walkability, alignment,
                          street level, prop and sign placement, clumping,
                          landmarks: all green.
  perfcheck    RED AT 1, and it is the carried datum:
                 ✗ a held vehicle's front stood 14.75 m past its own stop line
                     (floor 0). CARRIED and NOT REPAIRED, as the brief required.
                     Session 30 recorded 10.77–13.50 m; 14.75 is ABOVE that band,
                     and nobody has ever established the band's own spread, so
                     this is not evidence of a worsening either. STATE 25's datum
                     diagnosis stands.

               THE TWO FRAME-TIME REDS THE PREVIOUS DRAFT RECORDED DID NOT
               RECUR: cpu p95 8.80 ms (median of 14.3 / 8.8 / 8.6) against 12,
               wall p95 10.50 ms (median of 18.6 / 10.5 / 9.9) against 12.5.
               Both PASS. They are still not quoted as verdicts — `load1` was
               1.9–3.5 against CONTRACT §0.2's bar of 1.6 and the run spread is
               8.7 ms — but a pass measured on a machine that is too loud is
               wrong in the SAFE direction, which a failure would not have been.
               The 72%-of-72 tone-profile red carried since session 28 also did
               not appear; `silhouettes` delivered chroma clusters 11 against 8
               written, roofline span 0.3926 (pass 0.879), width span 0.1773
               (pass 1). Nothing was done to any of them and no cause is claimed.
```

### 9.1 THE COUNTS, WHICH ARE ADMISSIBLE

```
  route            draws   tris    instances   at
  highway_speed     434    1.40M    158 632    session 30's head, before anything
  highway_speed     434    1.40M    159 022    + the station (item 1)
  highway_speed     430    1.39M    158 458    HEAD, measured this session
  ceilings          440   2 000 000  115 000 floor
```

> **THE MARGIN ON THE TIGHTEST CEILING IN THIS PROJECT IS TEN, NOT SIX.** The station and
> the ground ring both cost exactly zero — they ride in meshes that were already drawn —
> and the stall reduction (340 → 199 pitches) **retired four `InstancedMesh`es**, because a
> chunk emits one body mesh per kind PRESENT. A content change that reads as *more* city
> bought four draw calls. The look shot shows the same effect independently: 301 draws at
> session 30's head, **301 with the station**, 296 after the stalls.

`floors.visibleInstances` is 158 458 against a floor of 115 000, clear by 1.38×.

**A stale claim inside the code, found and not fixed:** `traffic.js:2346` says *"438 to 439
against a ceiling of 440 … the tightest that ceiling has ever been"* — a margin of ONE.
Measured today it is TEN. That comment is several sessions stale and it is the number a
reader of `traffic.js` would use to conclude §8 is impossible.

---

## 10. WHAT WAS NOT BUILT, AND WHY

- **Stage 3 of the station**, deliberately, on the brief's instruction. Next session's
  headline, and now it shares that slot with Stage 5.
- **Stage 5, the platform light** — and §0.2 is the argument that it is no longer optional.
- **The fill law was not raised**, because the knob cannot reach what was asked for (§6).
- **The causal fill term (item 4b) was not built.** It needs no new data — every cause is
  already a pure function in `citygen.js` — but it re-phases the region's RNG by
  construction (§6), and this session's room went to the look regression.
- **The stalls' goods, side panels and bare trestle** (§5.1), against a mesh-per-kind cost.
- **`minStopLineM` was not touched**, as instructed.
- **No threshold moved. No budget file changed.**
- **`tools/city-budget.json:84`'s stale derivation** — the last copy of two errors this
  session corrected everywhere else. Left because the brief forbids budget-file changes.

---

## 11. KNOWN GAPS CARRIED FORWARD

**Unchanged from s8–s30**: `stats().cutoffM` hard-codes 0.8, the headroom probe inert, GPU
timer queries advertised and never retiring, `saturation-peak.png` overwritten every run,
`$fovYDrift`, `camera.setRouteAt(name, 1.0)` at the sky, rain streaks near-invisible wide at
night, `rain_spray` 0 static, **right turns only**, sun shadows to ~170 m, the bake blind to
elevated slabs, the PMREM hitch, the too-red dawn horizon, one worker at queue depth one,
the far half of the river handing back to the night sky past ~300 m, grime authored, the
near-field washboard on the water, the quay wall inside the walkable mask, props absent from
the walkability mask, the 3.5°–10.4° route camera pitch, the frozen/running A/B,
`materials.display` drawn by nothing, the hauler's marker row buried inside its own body,
the seeding fallback's untested placement, **a bus never turns**, the origin block's absent
occupancy registry, and `facadeAlbedo` sitting on its floor with zero spread.

**New this session:**

- **THE STATION HIDES THE TRAIN FROM THE STREET.** §0. The finding.
- **`lookcheck` IS RED AT 5 AND FOUR OF THE FIVE ARE THIS BRANCH'S.** §0.1, §9.
- **THE STATION'S CORES READ AS AN OPEN FRAME, NOT A TOWER.** The landings are
  3.80 × 1.40 m and recur every 2.04 m of height, so from the street they are the loudest
  thing in the core and the flights disappear between them. One end wall was added; it is
  not enough.
- **NOBODY CAN CLIMB THE STATION** and no gate asserts that anybody should be able to.
- **THE 0.10 m MARGIN AT THE CORE'S OUTER FACE** against the origin block's clear
  cross-street band is the tightest clearance in the project after the draw-call ceiling.
- **`poseprobe` IS BLIND TO THE ORIGIN BLOCK** and will clear a pose inside one of its ten
  buildings — it did, at all 72 azimuths.
- **THE PAVEMENT STILL HAS NO KERB AND STILL ENDS.** §4.2.
- **`traffic.js:2346` CLAIMS A DRAW-CALL MARGIN OF ONE** where it is ten. §9.1.
- **THE STOP-LINE OVERSHOOT MEASURED 14.75 m, ABOVE ITS OWN RECORDED BAND** of 10.77–13.50,
  and that band has never had its spread established.
- **SIX CHUNKS IN THE GATE'S OWN REGION HAVE NO BUILDINGS AND ARE NOT LOW-DETAIL**, one of
  them at density 0.715. They are where a fill raise would land and they are why its
  draw-call cost is not zero. §6.1.
- **`traffic.js:2346`'s "438 to 439 … the tightest that ceiling has ever been"** would, if
  believed, make §8's whole answer impossible. It is ten, measured. §9.1.

**Resolved this session**: the station's absence; the pavement's residency threshold; the
`site`/`grass` ground categories; the park hedge's unrotated claim; the stalls' single scale
and single yaw; the row of ten; two comment numbers session 30 missed, four more, and six
more again; `distinct:midnight|dusk`; and the five gates nobody had run.

---

## 12. OFFERED FOR CONTRACT §9's TABLE

Offered rather than added, because `parsecheck`'s `contractDocCheck` counts the rows and the
count is a gate — sessions 24, 25, 27, 28, 29 and 30 left rows on the same terms.

- **A GATE THAT WAS NOT RUN IS NOT A GATE THAT PASSED.** The station shipped, and STATE
  shipped saying `lookcheck` "was not run" and "the two carried reds are presumed still
  red". Both halves were wrong: one carried red had CLOSED and four new ones had OPENED,
  and the presumption was recorded in the same document as the omission. The cost of
  running it was two minutes;
- **ONE MERGED MESH DESCRIBED AS THE MERGED MESH FOR EVERYTHING ELSE TOO.** *"Buildings
  ride in the chunk's merged mesh, so the expected draw-call delta is zero"* — written
  about a system that emits **two `InstancedMesh`es PER CHUNK**, so a chunk gaining its
  first building costs 2–3 draws. The sentence was true of the GROUND (one mesh for 81
  chunks, §4) and was carried across to the BUILDINGS in the same document. A cost
  estimate of zero is the one estimate nobody re-checks;
- **a design dimension taken from a datum nobody confirmed** — STATE 27's *"3.0 m wide ON
  THE DECK"* against a deck whose widest clear run is **1.364 m, and that run is the
  six-foot between the running lines**;
- **a ROTATED box's world AABB used as its SECTION** — inside `stationprobe`, in its own
  first run, under a header arguing the crown was chosen so the two would coincide;
- **a residency radius for STREET LAMPS used as the radius for the ROAD SURFACE** — one
  `near` gating two things whose costs differ by two orders of magnitude, so **the pavement
  ended 256 m from the camera** in every frame this project has ever shipped;
- **a SURFACE given the category of the FIXTURES that stand on it** — a construction site's
  ground rectangle claimed as `site`, so every container on its own hardcore was a forbidden
  overlap; and its sibling `grass`, matching no category name and claiming nothing;
- **a per-candidate ACCEPTANCE PROBABILITY read as a share of BLOCK AREA** — `fill`
  overstates delivered frontage occupancy by **1.97×**, and at its ceiling of 1.0 delivers a
  **55.1%** street wall, so the knob everyone reaches for cannot produce the thing it is
  reached for;
- **a `smoothstep` evaluated at the mean density used as its value AT the mean** — 0.2335 at
  d = 0.5 against a ring whose actual mean is 0.5747: a stall count stated as 175 and
  delivered as **340**, beside a divisor using 512 m of kerb where stalls stand on 435.2 m
  of loop. **Two wrong quantities in one sentence, compounding to 1.94×** — and when the
  doc comment was corrected, **the runtime line printing the same two errors was not**, so
  the same sentence shipped a third time saying 100 against a delivered 199;
- **a comment that claims a link, with no link, inside the paragraph warning about comments
  that claim links** — `VIADUCT_SLAB_THICK_M`'s *"ONE EXPRESSION, READ BY THREE THINGS"*
  names `city.js` first, and `city.js` imports neither constant.
