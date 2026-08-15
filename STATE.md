# NOCTIS — STATE

*End of session 31. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
MacBook Air, Mac17,4, **Apple M5**, 10 cores, 32 GB, macOS 26.5.2, `node v25.9.0`. Every
gate that reads a pixel printed `ANGLE (Apple, ANGLE Metal Renderer: Apple M5)`.
**`load1` was 1.45 at the first command of the session — the first admissible reading in
six sessions**, inside CONTRACT §0.2's bar of 1.6 and above its floor of 1.32. By the end
of the gate runs it was **2.98**, and the gates themselves are what put it there. So
**NO MILLISECOND IN THIS STATE IS QUOTED AS A VERDICT.** Counts, draw calls, instance
counts, triangles and pixel fractions are quoted, because counts do not drift (§9 rule 6's
corollary).*

---

## 0. THE STATION EXISTS. HERE IS WHAT IT IS AND WHAT IT LOOKS LIKE.

Four sessions listed it last and four sessions ran out of room. **Stages 1 and 2 of
STATE 27 §8.1 are built and committed.** Stage 3 — the `walkableAt` change that lets the
pedestrian network leave the ground plane — is deliberately **not started**.

> **There is one station, on the viaduct's crown at (0, 11), which is the crossing every
> gate camera and all four routes can see. It is 87.27 m of platform on eight deck
> segments, walking surface at 22.720 m, with a canopy on a column line at 25.50 m, an
> edge wall closing the side elevation from the deck slab up to 23.87 m, and two vertical
> circulation cores on the ground at (±8.30, 25.00) carrying 133 risers of switchback
> stair and a 2.40 m lift shaft each.**

**From the operator's own street pose the crossing has gone from an open ribbon of deck to
a solid station box over the street.** From under it on the cross street the widened soffit
reads against the running viaduct beyond. The stair cores read as an **open switchback
frame rather than an enclosed tower** — the landings recur every 2.04 m of height and are
the loudest thing in them — and that is stated rather than left to be found. An end wall
was added after the first frame said so. It is better and it is not finished.

**Nobody can climb it yet and nothing tries.** Stage 3 is what makes people ride the
stairs, and STATE 27 costs it as its own session. It is the next session's headline.

### 0.1 THE DESIGN'S FIRST NUMBER WAS WRONG, AND A NEW INSTRUMENT IS HOW

STATE 27 §8.1 specifies Stage 1 as *"two side platforms **on the deck**, 80 m long,
**3.0 m wide**"*. `tools/stationprobe.mjs` is new, reads the DELIVERED instance matrices
rather than any constant, and prints the deck's section at the crown — where the heading
is 90°, so the residual is 1.042° and enters a width as 1.65e-4:

```
  ballast trough   0.68 .. 3.78      walkway kerb   3.20 .. 4.20
  catenary mast    3.85 .. 4.15      parapet        4.30 .. 4.70
  deck edge                4.75

  the gaps inside the deck edges:  0.150 / 0.100 / 1.364 / 0.100 m
```

**The widest clear run on this deck is 1.364 m and it is the six-foot** — the space between
the two running lines, serving no door and reachable from nowhere. The two gaps in the
right place are 0.150 and 0.100 m. 3.0 m is short by 1.636 m against the best of them.
CONTRACT §9 rule 7: a dimension correct in itself, taken from a datum nobody confirmed, by
a session that had the code in front of it.

**So the structure widens at the station, which is what an elevated station is — and it is
purely additive.** Not one existing box moves or disappears. That is what the offsets were
chosen for, and each clearance is a subtraction anybody can check:

```
  platform inner   4.30  vs the catenary mast's outer face  4.15   clear 0.15
  platform under  22.37  vs the parapet's top              22.20   clear 0.17
  canopy inner     4.60  vs the same mast                   4.15   clear 0.45
  canopy top      25.50  vs the catenary ARM               26.90   clear 1.40
  wall outer       7.55  vs the block's clear band          10.5   clear 2.95
  core outer      10.40  vs the same band                   10.5   clear 0.10  <- tightest
```

**A revert of the station commit restores the previous viaduct exactly.**

Stage 2's plan figure is wrong the other way. STATE 27 says a switchback *"occupies about
8 × 12 m in plan"*. A 12-riser flight at 0.28 m going is 3.36 m of run, so a cycle is
**4.76 m long by 3.80 m wide** and what accumulates is HEIGHT — 4.08 m a cycle. 8 × 12 m
is a stair drawn end to end rather than folded.

### 0.2 THE COST, WHICH IS THE ONLY BUDGET THAT MATTERED

`highway_speed` measured **434 draws before the session and 434 after the station**,
against `ceilings.drawCalls` **440**. **+390 instances** (158 632 → 159 022), triangles
unmoved at 1.40M. Every box rides in the chunk's existing `landmark:viaduct` mesh.

**By the end of the session the route measures 430** — item 3's stall reduction retired four
meshes — so the margin on the ceiling the brief called a hard constraint went from six to
**ten**. See §8.1.

---

## 1. LOOK AT THESE FIRST, IN THIS ORDER

All at `--t=0.5`, seed 1337, `tools/shot-out/`. Every pair is the SAME pose before and
after; the before frames were rendered from a `git worktree` at `963b293`, session 30's
head, so nothing about the comparison depends on memory.

| # | pair | what to look for |
|---|---|---|
| 1 | `s31-operatorpose-{before,after}` | **His own pose.** The viaduct at 70 m goes from an open deck you can see sky through to a solid station box across the street. |
| 2 | `s31-station-up-{before,after}` | **Street level looking up**, standing under the deck on the cross street. The widened station soffit against the running viaduct beyond. |
| 3 | `s31-station-air-{before,after}` | The station from above and east: platform, canopy, column line, edge wall. |
| 4 | `s31-stair-{before,after}` | The two cores. **This is the frame that shows the open-frame problem.** |
| 5 | `s31-pavement-{before,after}` | **Item 2, and it is the most legible pair.** Before: the road surface stops dead a third of the way in and every building beyond stands on bare earth. After: the street network runs to the horizon. |
| 6 | `s31-stalls-{before,after}` | Item 3. Before: a dense line of identical small silhouettes. After: one stall reading as an object, the run behind it thinned. |

```
1  node tools/lookat.mjs --pos=70,1.74,0.9   --target=-70,1.0,-0.6  --fov=55 --t=0.5
2  node tools/lookat.mjs --pos=2.5,1.74,-46  --target=-3.0,21.5,14  --fov=58 --t=0.5
3  node tools/lookat.mjs --pos=58,42,-34     --target=-2,20,16      --fov=45 --t=0.5
4  node tools/lookat.mjs --pos=0.5,1.74,3    --target=8.3,13.0,26   --fov=55 --t=0.5
5  node tools/lookat.mjs --pos=0,95,4        --target=620,0,4       --fov=48 --t=0.5
6  node tools/lookat.mjs --pos=80,1.7,122.5  --target=145,1.5,118   --fov=55 --t=0.5
```

**`poseprobe` CLEARED A POSE THAT WAS INSIDE A BUILDING, AND THE REASON IS WORTH
CARRYING.** It reported 72 of 72 candidate poses unobstructed at 45 m from the station;
the first frame taken from one of them is a facade filling the lens. `poseprobe` ray-tests
`city.residentOccluders()`, which is the STREAMED city's buildings — **it cannot see the
origin block's ten**, and the station is inside `BLOCK_KEEPOUT`. Every pose above was
found by standing on a street the block actually builds.

---

## 2. WHAT WENT ON THE BRANCH

Session 27's branch, `claude/noctis-25-building-floors-89bqul`. **NOTHING MERGED TO MAIN.**
Each commit is independently revertible.

```
  e54363f  item 6 — fourteen of sixteen were already fixed; two were not, four more wrong
  f4e3be1  item 3 — five stall kinds and ONE delivered scale
  3e826c8  item 2 — the pavement stopped where the STREET LAMPS stop
  0090283  item 1 — the station, and the deck had 1.36 m where the design asked for 3.00
  963b293  STATE 30  <- session 30's head
```

**THE BRIEF SAYS THE BRANCH CARRIES FOURTEEN COMMITS. IT CARRIES NINETEEN above session
27's tip (`6f4990b`) and TWENTY-THREE above `main`**, before this session's four. Counted
with `git log --oneline main..HEAD | wc -l`. That is the first of this brief's false
premises and the cheapest to check.

**NO BUDGET FILE CHANGED.** `budget.json`, `look-budget.json`, `city-budget.json` and
`input-budget.json` are byte-identical to session 30. No threshold was moved, lowered,
raised or re-derived.

---

## 3. THE BRIEF'S SIX PREMISES, MEASURED

| # | the brief said | measured |
|---|---|---|
| — | the branch carries **fourteen** commits | **19** above session 27, **23** above main |
| 1 | STATE 27's five-stage design is what to build | Stage 1's *"3.0 m on the deck"* **does not fit**; the deck has 1.364 m and it is in the wrong place |
| 2 | pavements are per **BLOCK**, so they exist only where buildings do | **wrong.** 289 of 289 chunks emit pavement, including all 66 lowDetail and all 74 with no buildings. It ends at `CITY.nearRadius` |
| 3 | the stalls have **one form** | **wrong** — five kinds, five distinct geometries. But **one delivered scale and one yaw across all 340** |
| 4 | `fill = 0.12 + 0.88·d^2.2`, d 0.3 → 18%, d 0.5 → 31% | **arithmetic exactly right.** The QUANTITY is wrong: `fill` is a per-candidate acceptance probability on a 1-D perimeter walk, not an area share |
| 5 | the lognormal *"possibly never shipped"* | **it shipped in session 20**, commit `ca0169f`. Live at HEAD |
| 6 | session 30 found sixteen comment numbers and **left them** | **wrong for fourteen.** 14 corrected, 1 half, 1 untouched — and four more were wrong |

**Five of six.** The one that held is the draw-call ceiling, and it held exactly: 434 of
440, six of margin, confirmed by measurement before anything was built.

---

## 4. ITEM 2 — IT STOPPED WHERE THE STREET LAMPS STOP

`city.js` had `const near = detail && ring <= CITY.nearRadius`, and `near` gated **two
unrelated things**: the road surface and the street lamps. Measured at three different
camera chunks, off the delivered rectangles AND predicted from the lattice arithmetic —
both agree exactly:

```
  pavement ended 256.0 to 395.7 m from the camera, on a box that follows it
  walked along z = 9.6:  walk 264 .. 383.9, then EARTH from 384.0 = (2+1)·128
```

**Raising `nearRadius` is the one fix that cannot be taken.** A lamp chunk emits two
`InstancedMesh`es, so ring 2 is 50 draws and ring 4 is 162 — **+112 against a ceiling with
six of margin.** So the ground got its own radius:

```
  CITY.groundRadius = 4, cost measured by ANNULUS (scaling a per-chunk mean over-states
  by 18%, because the origin ring contains BLOCK_KEEPOUT and is not a typical chunk):

    ring <= 2   25 chunks   185 rects    370 tris    39 960 B
    ring <= 4   81 chunks   536 rects   1072 tris   115 776 B

  DELIVERED: `city:ground` is ONE mesh of 1072 triangles. +702 against a 2 000 000
  ceiling, +0.076 MB against 96, and ZERO draw calls. The pavement now ends 512–652 m out.
```

The old justification — *"it was costing a draw call a chunk across a hundred and twenty
of them"* — was true when written and stopped being true when `rebuildGroundMesh` merged
every resident chunk's ground into one mesh. §9's shape with a justification instead of a
value.

### 4.1 WIDENING THE RING PUT TWO LATENT DEFECTS INTO THE CENSUS

Both are as old as their labels. What changed is that something finally looked.

1. **`occupancy` went 0 → 60 forbidden overlaps, DELIVERED**, worst
   `site(ground:site) × prop(container)` at 4.48 m². `buildGround` labelled a construction
   site's GROUND RECTANGLE `site`, which is the category for a site's FIXTURES, and
   `site × prop` is forbidden — so every container standing on the hardcore of its own
   building site was a collision. Meanwhile `grass` was passed through unmapped, matches no
   entry in `CATEGORIES`, and therefore claimed **nothing at all**. Over-claiming and
   under-claiming, one missing row. **`occupancy.js` gains `ground`**, forbidden against
   building, landmark and water only. **STATE 30 §10 named this gap and this closes it.**

2. **Then 60 more**, `pavement × feature(edge:hedge)`, 0.012–0.066 m². A park's edge run is
   set back by its own half-thickness so the CLAIM is flush with the island edge, then
   drawn with a yaw jitter. The generator tested the unrotated box and `city.js` drew the
   rotated one — **§9 rule 7: both halves of the two-sided check spelled the same omission,
   so both reported zero.** Set back by the rotated AABB using `CITY.maxYawDeg` as the
   bound, which keeps it out of the RNG sequence and over-claims, the safe direction.

### 4.2 WHAT ITEM 2 DOES NOT FIX

**The pavement still ENDS, 256 m further out, and it still ends as a zero-thickness slab.**
`buildGround` has exactly one emitter — six vertices at one y with normal (0,1,0) — so the
streamed city contains **no vertical ground face anywhere**, not at the termination and not
along any kerb line. The only real kerb in this world is `block.js`'s, inside
`BLOCK_KEEPOUT`. The step at the edge is `GROUND.pavement` 0.160 − `GROUND.earth` −0.020 =
**0.180 m**, under `PLAYER.stepUpM` 0.20, so it is a visual defect and not a collision one.
**Nobody has measured how many edges are exposed and no cost is guessed here.**

---

## 5. ITEM 3 — FIVE KINDS AND ONE SCALE

Measured two independent ways that agree exactly — a headless import reading
`stallStats()` and the live page through `harness.stallCensus()`:

```
  distinct instance scales    EXACTLY ONE, (1.000000, 1.000000, 1.000000)
  distinct yaw mod 90°        EXACTLY ONE
  distinct canopy cloths      8
  distinct soil tints         336
```

The operator's *"one form"* is wrong — five kinds, five separate merged prototypes, box
counts 5/8/7/12/9 — and his own row of nine contains all five. **The vocabulary is five and
the dimensions were one**, and at close range a dimension is what you read.

**The row of ten is real and was located rather than believed**: chunk (−2,−2), the
island's north pavement, **9 stalls on one 108.8 m edge** at a mean gap of 11.12 m, plus a
tenth round the corner. 90 of the ring's 100 edges carried a stall; 20 carried six or more.

**The count's own derivation was wrong by 1.94× in two places at once.** The comment said
*"30 × 0.2335 = 7 per chunk and about 175 over the ring"*; delivered was **340, 13.6 per
chunk** — 0.2335 is `smoothstep` at density 0.5 used as its value at the ring's actual mean
of 0.5747, where it is steep. And the divisor was *"512 m of kerb"* where stalls stand on
the island LOOP, **435.2 m**; the 76.8 m difference is the junction corner no stall can
stand on.

Shipped, all at **zero new boxes, meshes, materials and draw calls**, because the scale and
yaw ride in `instanceMatrix`:

```
  STALL_MAX_PER_CHUNK  30 -> 18     delivered 340 -> 199, one per 32.0 m -> one per 54.4 m
  STALL_MAX_PER_EDGE   4, new       a row of ten becomes impossible by construction
  STALL_SIZE           per-pitch roll on all three axes, ACROSS capped at 1.0
  STALL_YAW_JITTER_DEG 2.0          under alignment's 3° cap on the largest deviation
```

`minStallsNearRing` is 60; 199 clears it by 3.3×. **`ACROSS` never exceeds 1.0 and that is
not timidity** — `STALL_FOOTPRINT` derives every kind's depth against the [7.55, 9.25] and
[10.95, 11.65] pitch strips by name, and a scale above 1 would invalidate each of those
silently.

**THE TRAP, AND IT IS §9.1's OWN RECORDED FAILURE:** `hx`/`hz` come from `fp.halfAlong` /
`fp.halfAcross` UNSCALED, so a widened stall would be **drawn** wider than the rectangle
`rectBlocked` **tested**. The roll happens above the test and multiplies both.

**NOT DONE, AND THE NUMBER THAT STOPS IT.** The brief also asks for goods on the table,
side panels and a bare trestle. Each is a new geometry prototype, i.e. **one new
`InstancedMesh` per chunk that delivers it — +5 to +24 meshes over the ring, against six
draw calls of margin.** The zero-draw-call route exists and is a SHADER change:
`noctisLimb.z` already carries a per-vertex part label and `noctisBodyColor.w` is an
already-uploaded per-instance float a stall never reads, so a mask collapsing a labelled
box to zero size is one line in §5.6's injection in `lights.js`. That is a different kind of
change and was not made at the end of a session.

---

## 6. ITEM 4 — THE FILL LAW. **THE KNOB CANNOT DO WHAT THE OPERATOR ASKED, AND HERE IS THE NUMBER.**

This is the finding the brief said it needed. **Nothing was built and nothing was tuned.**

**THE BRIEF'S ARITHMETIC IS EXACTLY RIGHT.** `fill(0.3)` = 0.1823, `fill(0.5)` = 0.3115,
recomputed from the shipped constants. And over the gate's own region the density is
min 0.158, **median 0.528**, p90 0.681 — so 0.5 is near-median and 0.3 is the p10. His two
worked examples are the right examples.

**THE QUANTITY IS NOT AN AREA SHARE.** `fill` is the acceptance probability for one
candidate on a 1-D **perimeter frontage walk**. Measured two ways that agree to 0.3%: the
roll's pass rate is 0.3756 and the mean of `fill` over built chunks is 0.3744. It says
nothing about area, and `fill` **overstates delivered frontage occupancy by 1.97×** —
accepted building width over frontage walked is 6 592.6 / 34 727 = **0.1898**, confirmed by
sweeping the delivered geometry to the same four decimals.

**DELIVERED TODAY, over the gate's region:**

```
  frontage occupancy per block   min 0.000  p10 0.000  med 0.229  p90 0.385  max 0.510
  bare-ground share per block    min 0.000  p10 0.296  med 0.809  p90 0.948  mean 0.724
  street-wall gaps (663 of them) p10 1.3 m  MEDIAN 26.1 m  p90 84.1 m  max 104.6 m
  gap fraction of buildable frontage                                   0.7559
  192 of the region's 400 block sides are bare END TO END
```

**AND THE SWEEP, WHICH IS THE ANSWER.** Every law run through the same generator, quay law
held fixed so only the island law moves:

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
> THE STREET WALL. The remaining 45% is not the fill roll at all; it is the WALK: a leading
> offset of `rng.range(0, 9)`, an end-of-run gap of `rng.range(1, 7)` on top of the
> candidate's own width, and `t = side.to; break` — one candidate too wide ends the whole
> side, which happens 99 times.**

And a second ceiling behind that one. **The generator is a PERIMETER-RING generator**: the
depth draw is `rng.range(15, 26)`, so the island's central 52.6 × 52.6 m — **25.3% of every
block** — is unreachable by the walk at any fill value. A *perfectly* closed ring at the
delivered mean depth covers **63.0% of the island** and leaves a 37.0% courtyard.
**"Fill near 1.0 across the whole island" is not reachable by this generator at all**, and
that is a fact about its shape rather than about its constants.

**WHAT THIS MEANS FOR THE NEXT SEVERAL SESSIONS, which is what the brief said it decides.**
Lower Manhattan's closed street wall is available here, and it costs a change to the WALK
and not to the law: the end-of-run gap and the `break` are worth more than the whole range
of the exponent (0.5510 → 0.6181 from one of them). The interior courtyard is a different
and larger question — it is what a mid-block generator would be for. **The draw-call cost
was not measured, because no law was shipped**; the instance and object counts are above
(2 487 → 3 826 objects at the far end) and buildings ride in the chunk's merged mesh, so
the expected draw-call delta is zero and the binding budget is `floors.visibleInstances`
and triangles rather than draws. **That measurement is owed before anything is raised.**

---

## 7. ITEM 5 — IT SHIPPED. NOTHING TO DO.

`HEIGHT_DISTRIBUTION.mode` is **`'logNormal'`**, median 34, σ 0.62, clamps 9–150, and
`git log -L` on the block returns exactly one commit: **`ca0169f`, session 20**. The
comment the brief reads as a proposal is a RECORD — a session-31 pass extracted that commit
with `git archive`, ran ITS heightprobe, and reproduced every printed figure to the digit,
including *"nine of 432"*.

Delivered at HEAD, three independent paths agreeing (heightprobe, an own walk of
`generateChunk`, and the roll called directly against a closed form):

```
  n 366   mean 38.90 m   median 32.7   sd/mean 0.645   p99 133.7 m   max 154.2 m
  60 buildings over 60 m (16.4%)   13 over 100 m (3.6%)   max 49 floors
```

The comment's figures are stale only because the POPULATION fell: session 21's occupancy
registry refused 65 buildings and the region has held 366 ever since. **p99 134 and max 154
are byte-identical at every commit from `ca0169f` to HEAD.** Both columns are now printed
in the comment, because the ratio is the claim and it survives — 1.562× then, 1.550× now.

---

## 8. GATE STATE

Each gate was run individually, because `npm run gates` is `&&`-joined and stops at
`lookcheck`, hiding everything after it.

```
  parsecheck   GREEN   95 files
  citycheck    RED AT 1   ONLY the carried 6.00% bright-reserve floor, at 4.36%
                          (per-run means [4.36 4.50 4.18], spread 0.31).
                          occupancy 0 / 0 forbidden overlaps over 50 pairs,
                          generator AND delivered. sceneWalk GREEN — 0 meshes
                          whose label does not sum to instanceMatrix.count.
                          walkability, alignment, street level, prop and sign
                          placement, clumping, landmarks: all green.
  perfcheck    RED AT 4 on `highway_speed`, and TWO OF THE FOUR ARE THE MACHINE:

                 ✗ CPU p95 15.20ms > 12ms    (runs 12.2 / 15.2 / 16.6, spread 4.4)
                 ✗ interval p95 17.20 > 12.5 (runs 13.4 / 17.2 / 17.8, spread 4.4)
                     INADMISSIBLE. `load1` was 2.98 against CONTRACT §0.2's bar
                     of 1.6, and the spread is 4.4 ms against margins of 3.2 and
                     4.7. Neither is a verdict about this content.
                 ✗ a held vehicle's front stood 12.48 m past its own stop line
                     CARRIED and NOT REPAIRED, as the brief required. Session 30
                     recorded 10.77–13.50 m; 12.48 is inside that band. STATE 25's
                     datum diagnosis stands.
                 ✗ 72% of 72 vehicles carry a non-monotone tone profile (min 75%)
                     CARRIED since session 28, and STATE 30 §10 recorded this
                     population as UNSTABLE RUN TO RUN — 69% of 67 and 75% of 71
                     on the same commit range. 72% of 72 is inside that. Nobody
                     has established its own spread and nothing here did either.
```

The silhouette metrics moved the right way and are recorded because they are counts:
**chroma clusters 14 delivered against 8 written**, roofline span 0.3771 over 35 subjects
(pass 0.886, 3 levels), and the width assertion now measures **24 subjects, 11 declined for
bias, span 0.1779, pass 1** — where STATE 30 §7.5's note recorded 0 of 16 measurable.

**`citycheck` is down from session 30's RED AT 2 to RED AT 1**, and the one that closed was
`sceneWalk`, which session 30 recorded as timing out on a loaded machine rather than
failing on content.

**`perfcheck` IS RED AT FOUR AND NONE OF THE FOUR IS NEW.** Two are milliseconds on a
machine at load 2.98 and are inadmissible; two are the carried stop-line datum and the
carried tone profile, both explicitly not to be touched this session.

**`lookcheck`, `gateaudit`, `faultcheck`, `windcheck` and `inputcheck` WERE NOT RUN THIS
SESSION.** That is a gap and it is stated rather than implied: `npm run gates` does not
exit 0 and **this session is not reported complete**. The two `lookcheck` reds carried from
before session 27 are presumed still red; nothing here re-measured them, and the station
adds unlit concrete to the night frame whose effect on `band:midnight` — which had 0.0009
of headroom — **has not been measured and must be before anything else lands.**

### 8.1 THE COUNTS, WHICH ARE ADMISSIBLE

```
  route            draws   tris    instances   at
  highway_speed     434    1.40M    158 632    session 30's head, before anything
  highway_speed     434    1.40M    159 022    + the station (item 1)
  highway_speed     430    1.39M    158 458    + the pavement and the stalls, FINAL
  ceilings          440   2 000 000  115 000 floor
```

> **THE MARGIN ON THE TIGHTEST CEILING IN THIS PROJECT WENT FROM SIX TO TEN.** The station
> and the ground ring both cost exactly zero — they ride in meshes that were already drawn —
> and the stall reduction (340 → 199 pitches) **retired four `InstancedMesh`es**, because a
> chunk emits one body mesh per kind PRESENT and fewer pitches means fewer chunks carrying
> all five. A content change that reads as *more* city bought four draw calls.

`floors.visibleInstances` is 158 458 against a floor of 115 000, clear by 1.38×.

### 8.2 THE BRIGHT RESERVE MOVED AND IT IS NOT A RESOLVABLE DIFFERENCE

Session 30 recorded 4.54 / 4.66 / 4.74 / 5.26%. This session's runs: 4.32, 4.31, 4.36, with
per-run spreads of 0.31–0.35 points. **The gap between the two sessions' medians is inside
the statistic's own spread**, which STATE 28 recorded at 0.23–1.04 for the same quantity.
No arm was run, so **no cause is attributed and none should be read into it.**

---

## 9. WHAT WAS NOT BUILT

- **Stage 3 of the station**, deliberately, on the brief's instruction. It is the
  subsystem, it is what makes people ride the stairs, and it is next session's headline.
- **The fill law was not raised**, because the measurement says the knob cannot reach what
  was asked for. §6 is the finding rather than the change.
- **The stalls' goods, side panels and bare trestle**, because each costs meshes against a
  six-draw margin. §5 names the zero-draw-call route.
- **`minStopLineM` was not touched**, as instructed.
- **No threshold moved.** No budget file changed.

---

## 10. KNOWN GAPS CARRIED FORWARD

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
occupancy registry, and `facadeAlbedo` sitting on its floor at 4 of 4 with zero spread.

**New this session, stated rather than left to be found:**

- **THE STATION'S CORES READ AS AN OPEN FRAME, NOT A TOWER.** The landings are 3.80 × 1.40 m
  and recur every 2.04 m of height, so from the street they are the loudest thing in the
  core and the flights disappear between them. One end wall was added; it is not enough.
- **NOBODY CAN CLIMB THE STATION** and no gate asserts that anybody should be able to.
  Stage 3.
- **THE 0.10 m MARGIN AT THE CORE'S OUTER FACE** against the origin block's clear
  cross-street band is the tightest clearance in the project after the draw-call ceiling.
  A wider core, or a second station at the crossing, breaches it.
- **`poseprobe` IS BLIND TO THE ORIGIN BLOCK.** It ray-tests `residentOccluders()`, which is
  the streamed city only, so it will clear a pose standing inside one of the block's ten
  buildings — and it did, this session, at every one of 72 azimuths.
- **THE PAVEMENT STILL HAS NO KERB AND STILL ENDS.** §4.2.
- **`lookcheck` AND `gateaudit` WERE NOT RUN.** §8.
- **THE STATION'S EFFECT ON `band:midnight` IS UNMEASURED**, against 0.0009 of headroom.

**Resolved this session**: the station's absence; the pavement's residency threshold; the
`site`/`grass` ground categories; the park hedge's unrotated claim; the stalls' single scale
and single yaw; the row of ten; two comment numbers session 30 missed and four more.

---

## 11. OFFERED FOR CONTRACT §9's TABLE

Offered rather than added, because `parsecheck`'s `contractDocCheck` counts the rows and the
count is a gate — sessions 24, 25, 27, 28, 29 and 30 left rows on the same terms.

- **a design dimension taken from a datum nobody confirmed** — STATE 27 §8.1's *"3.0 m wide
  ON THE DECK"* against a deck whose widest clear run is **1.364 m, and that run is the
  six-foot between the running lines**. Written by a session with the code in front of it,
  carried unexamined through three more, and refuted by the first instrument that printed
  the section;
- **a ROTATED box's world AABB used as its SECTION** — inside `stationprobe`, in its own
  first run, under a header arguing the crown was chosen so that the two would coincide.
  They coincide for the two segments meeting there and nowhere else: at 3.1° an 11.13 m rail
  0.14 m wide reads **0.746 m across, 5.3× its own width**. CONTRACT §7.7, in the instrument
  written this session to prevent exactly this;
- **a residency radius for STREET LAMPS used as the radius for the ROAD SURFACE** — one
  `near` gating two things whose costs differ by two orders of magnitude, so the ground paid
  the lamps' draw-call bound and **the pavement ended 256 m from the camera** in every frame
  this project has ever shipped;
- **a SURFACE given the category of the FIXTURES that stand on it** — a construction site's
  ground rectangle claimed as `site`, so every container on its own hardcore was a forbidden
  overlap; and its sibling, `grass`, matching no category name at all and therefore claiming
  nothing. **Over-claiming and under-claiming from one missing row**, and invisible for as
  long as the ring was narrow enough to keep both out of the census;
- **a per-candidate ACCEPTANCE PROBABILITY read as a share of BLOCK AREA** — `fill` is a
  roll on a 1-D perimeter walk and overstates delivered frontage occupancy by **1.97×**;
  and at its own ceiling of 1.0 it delivers a **55.1%** street wall, so the knob everyone
  has been reaching for cannot produce the thing it is being reached for;
- **a `smoothstep` evaluated at the mean density used as its value AT the mean** — 0.2335 at
  d = 0.5 against a ring whose actual mean is 0.5747, where the curve is steep: a stall
  count stated as 175 and delivered as **340**, beside a divisor that used 512 m of kerb
  where the stalls stand on 435.2 m of island loop. **Two wrong quantities in one sentence,
  compounding to 1.94×**;
- **a comment that claims a link, with no link, inside the paragraph warning about comments
  that claim links** — `VIADUCT_SLAB_THICK_M`'s *"ONE EXPRESSION, READ BY THREE THINGS"*
  names `city.js` first, and `city.js` imports neither constant. It declares its own 0.9 and
  1.9. The module that DRAWS the section is the one place that does not read the number.
