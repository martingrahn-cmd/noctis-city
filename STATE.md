# NOCTIS — STATE

*End of session 25. **The machine has no GPU. Checked first, printed, recorded — §0.**
This is the FIFTH consecutive session on a container with no display hardware, and
nothing that needs one was attempted. There is not one millisecond in this file.*

*The session was THE BUILDING CLAIM AND THE PROVENANCE OF FLOORS: what the largest
solid category in the city says about itself against what it actually is, and then
where every threshold in the project came from and whether any run could make it red.*

- ***The building claim is wrong in two independent directions and they cost
  differently.*** In PLAN it ignores the yaw on both sides — 723.4 m² claimed with
  no building in it and the same 723.4 m² of building outside its claim, which are
  equal for a reason (§1.1). In HEIGHT it stops at the top of the WALL, so the
  parapet, the cornice and 1 436 roof-plant boxes stand outside it, the median roof
  by **15.50 m** and the worst by **18.72 m**. §1.
- ***The vertical one cost zero on both halves of the two-sided check, so it is
  BUILT.*** 419 of 419 building claims raised, **no placement refused, no matrix
  moved, no other field changed**, and the delivered red is still exactly the one
  true pylon defect session 24 left standing. §1.4.
- ***The planar one costs 78 buildings and is written up and LEFT.*** And its cost
  is not bookkeeping: all 80 new pairs are **real** — **51.96 m² of delivered
  masonry standing in a pavement**, which neither half of the two-sided check can
  see today because both halves ignore the yaw in the same way. §1.3.
- ***The roof plant is not the mix `city.js` says it is.*** `Math.abs(Math.sin(x) %
  1)` is `|sin(x)|`, which is arcsine-distributed and not uniform, so the weights
  4/3/3/3/2 deliver 17/14/16/20/**33**%. The aerial is weighted 13.3% and delivered
  **33.2%**. Measured against both laws; the arcsine one predicts all five kinds to
  within 0.6 points. §1.2.
- ***Two more thresholds that cannot fail, and they are a matched pair.***
  `ceilings.gpuFrameMsP95` and `gpuFrameMsMax` sit behind a guard that has been
  false on every run this project has recorded, and the fallback that runs instead
  — `headroomProbe.requireP95MsBelow` — is **16.67, the 60 Hz vsync line**, applied
  to a CPU time. Neither carries a derivation. **Recorded, not moved.** §2.3.

Read `CONTRACT.md` before this file, and before any source file.

---

## 0. THE MACHINE — CHECKED, NOT ASSUMED. AND THE BRIEF'S PREMISES, CHECKED.

First commands of the session:

```
$ hostname            vm
$ uname -a            Linux vm 6.18.5-fc-v20 #1 SMP PREEMPT_DYNAMIC @0 x86_64 GNU/Linux
$ lscpu               Intel(R) Xeon(R) Processor @ 2.80GHz, 4 cores, 1 socket, KVM
$ free -h             15 GiB total, 14 GiB free
$ ls /dev/dri         No such file or directory
$ lspci               not present
$ nvidia-smi          command not found
$ node --version      v22.22.2
$ df -h /             252 G, 30 G available
```

**No GPU.** Same container shape as sessions 21–24. `budget.json` → `machine` is
untouched and the M4 series stands. **This is the fifth session asking for a
machine.**

### 0.1 The brief's own claims, tested

The brief asked to be treated as a hypothesis with a name on it, and named its own
failure rate: three consecutive briefs with a false premise, each from reading
source and writing absence as fact. Five of this one's claims were checkable here.

| the brief said | measured |
|---|---|
| four sessions running have had no GPU | **TRUE**, and this is the fifth |
| roof plant stands up to 18.72 m above its own building's claimed top | **TRUE**, reproduced exactly, and the number is `(1.8 + 3.4) × 3.60` — the aerial's aspect against the size roll's maximum |
| the building claim ignores yaw on both sides | **TRUE**, and both halves spell it identically, which is why they agree with each other and both disagree with the world |
| **"367 buildings is the biggest single category in the city"** | **WRONG TWICE.** 367 is one session stale: it is the count over `citycheck`'s own 10 × 10 region *before* session 23's viaduct-end claim refused one, and that region carries **366** today. Over the delivered resident ring it is **419**. And `building` is not the biggest category — **`prop` carries 1 312 delivered claims against building's 419.** |
| downstream checks reading the wrong volume include **aircraft clearance** | **THERE IS NO AIRCRAFT CLEARANCE CHECK.** `budget.json`'s `aircraft` entries are light-slot role counts (`lightRoles.ceilings.aircraft`, `floors.aircraft`, both 1). No gate, probe or module anywhere compares an aircraft's altitude to a building, a landmark or anything else. §1.5 |

**So the fifth consecutive brief carried a false premise, and this time there were
two.** Both were caught by measuring rather than by reading. The `prop`-versus-
`building` one matters beyond pedantry: it means the *largest* category in the city
is the one whose claim session 22 had to repair for a transposed yaw, not the one
this session repaired.

### 0.2 What ran

```
✓ parsecheck                88 files, syntactically complete and contract-clean
✓ citycheck --falsify       56/56 cases rejected, 56 failure sites, coverage 100%
✓ generator half            5 364 claims over the gate's own region, 0 forbidden
                            overlaps — BYTE-IDENTICAL to session 24's figure
✓ emitcensus                121 chunks, 124 007 boxes, 3 330 delivered claims,
                            occupancy red at 1 — session 24's end state, reproduced
✓ claimprobe                NEW. The building claim in plan and in height. §1
✓ budgetaudit               NEW. Every floor and ceiling, its derivation, its
                            readers. §2
GATE-RUNS-NEEDING-A-BROWSER — see §4.
```

---

## 1. THE BUILDING CLAIM

`tools/claimprobe.mjs` (new, NOT A GATE), `tools/lib/headlesscity.mjs` (extended),
`src/lib/citygen.js`, `src/modules/city.js`.

### 1.0 The instrument, and the one thing it had to not inherit

Session 24's `emitcensus` takes each emitted box's **world AABB**, which is the
right extent for *"is anything claimed over this footprint"* and the **wrong one
for a yaw question**: a 26 m box turned 2.4° has an AABB up to 0.55 m wider than
the box, so a probe reading AABBs would report its own instrument's inflation as
the building escaping its claim. So `captureBuild` gained an opt-in
`keepElements`, each box carries its matrix and its own geometry bounds, and the
footprint here is **four transformed ground corners — an exact rotated rectangle**.
Areas are exact convex-polygon intersections (Sutherland–Hodgman), self-tested in
three directions on every run against the analytic `2(√2−1) = 0.828427`.

**THE CONTROLS, ALL FOUR, AND THEY RUN BEFORE ANY FINDING.**

```
generator over the 11×11 ring   419 buildings
delivered census                419 `building` claims           AGREE
box counts vs STATE 24 §1.4     tier 532, cantilever 40, crown 419, plant 1436   ALL FOUR AGREE
base-tier match                 419 of 532 tier boxes matched a generator building on
                                CENTRE + WIDTH + DEPTH + YAW together, worst residual 8.88e-15
                                (the other 113 are stepped buildings' upper tiers)
cost-model control              today's claim, rebuilt through the probe's own path: 0 new pairs
```

**AND THE ATTRIBUTION WAS WRONG FIRST, WHICH IS RECORDED BECAUSE IT IS THIS
PROJECT'S OWN FAILURE MODE INSIDE THE INSTRUMENT (§7.7).** A parapet bar is
written at `bld.x ± t.width/2` — *half a building* from its own centre, 13 m on a
26 m frontage. Attributing boxes to the **nearest building centre** therefore
handed a tall building's parapet to whichever short neighbour stood closer, and
the first run reported a parapet **79.57 m** above its claim and a tier parapet
**35.73 m below** one. Both were one building's roof measured against another
building's height. Replaced by attribution on **claim containment** — every box a
building emits has its centre inside that building's own claim — which reports
**0 ambiguous and 0 orphaned** across all 2 866 boxes, and the outliers vanished.

### 1.1 (a) THE PLANAR DEFECT — AND THE TWO DIRECTIONS ARE EQUAL FOR A REASON

The claim is `bld.x ± width/2`, the **unrotated** footprint; the mass is drawn at
`bld.yawDeg`. **325 of 419 buildings (77.6%) carry a non-zero yaw**, max **2.2671°**
against `CITY.maxYawDeg` = 2.4.

```
                                   n    min    p25   median    p75    p95     max      total
claimed with no building in it   419  -0.000  0.171   1.119   2.676  5.289  10.390    723.4 m²
building outside its own claim   419   0.000  0.171   1.119   2.676  5.289  10.390    723.4 m²
  as a share of the claim              -0.00%  0.05%   0.36%   0.73%  1.37%   2.25%
```

**The two are equal per building to 7.17e-11 m², and that is checked rather than
assumed.** A rectangle turned about its own centre keeps its area, so every square
metre the claim loses in one direction it gains in the other. The defect is a
*rotation*, not an inflation — which is exactly why widening the box does not
repair it (§1.3).

Over the **whole delivered mass** — every building box except the roof plant,
which is (b)'s subject:

```
total outside the claim (summed)  median 29.25 m²   total 14 623.0 m²
furthest any corner reaches past  median  0.397 m   p95 1.637 m   max 2.482 m
  which role reaches furthest, per building:  crown 209, parapetTop 87, parapetTier 83, cantilever 40
  the 40 cantilever buildings:  worst 2.482 m, median 1.697 m
```

### 1.2 (b) THE VERTICAL DEFECT — AND WHAT THE PLANT ACTUALLY IS

The claim's `y1` is `bld.height`, **the top of the wall**. Everything on the roof
stands above it.

```
                                   n    min    p25   median    p75    p95     max
delivered top above claimed top  419  0.080  9.189  15.495  17.943  18.670  18.720 m
  buildings WITH roof plant      357  1.429 11.753  16.500  18.170  18.693  18.720 m
  buildings WITHOUT it            62  0.080  0.280   0.550   0.900   0.900   0.900 m

per role:   crown        n 419   0.080 .. 0.900 m   (0.900 is prewar's cornice exactly)
            parapetTop   n 357   1.050 exactly      (= ROOF_PARAPET_M)
            plant        n 357   1.429 .. 18.720 m
            tier, cantilever      0.000 — these are the only two that stop at the claim
```

`floors > 4` is what decides whether a building gets a roofscape at all, which is
the 357 / 62 split.

**WHAT THE PLANT IS — and the delivered mix is not the declared mix.** Classified
off the delivered box rather than by re-running the hash: `ROOF_KINDS` gives each
kind a fixed width-to-depth ratio, so 3.690 is a duct, 0.758 a stair house, 1.176 a
plant room, and the two at 1.000 separate on absolute width by 4.5×.

```
  kind         delivered   if uniform   if |sin| (arcsine)   tallest above its claim
  plantRoom      16.78%      26.67%          17.18%                  5.20 m
  tank           14.35%      20.00%          13.72%                 11.96 m
  stairHouse     15.18%      20.00%          15.55%                  9.10 m
  duct           20.47%      20.00%          20.29%                  1.77 m
  aerial         33.22%      13.33%          33.25%                 18.72 m
                 1 436 plant boxes over the ring
```

> **`Math.abs(Math.sin(x) % 1)` IS `|sin(x)|`, NOT A UNIFORM.** For any `x` with
> `|sin x| < 1`, `sin(x) % 1` **is** `sin(x)`, so the expression is `|sin x|`,
> whose CDF is `(2/π)·asin(t)` — concentrated at 1. `city.js` multiplies it by
> `ROOF_KIND_TOTAL` = 15 and walks a cumulative sum of the weights 4/3/3/3/2,
> which is correct **only if the variate is uniform**. It is not. The arcsine
> prediction matches the delivered mix to within **0.6 points on all five kinds**;
> the declared weights are out by **20 points** on the aerial.

The same expression draws `h`, which sets each unit's **size**, and `seed`, which
sets **how many units** a roof carries — so both are biased toward their maxima
too, and that is why the median roof stands 16.50 m over its claim rather than
somewhere near the middle of the range. **This is a content property, not a
defect in the claim, and it is NOT changed here**: correcting the variate would
redistribute every roof in the city, which is a content change and the operator's
to see. It is offered for CONTRACT §9's table in §7.

**WHICH OF THESE WERE MEANT TO BE INSIDE THE CLAIM: all of them.** A parapet and a
cornice are the building's own fabric; a plant room, a tank, a stair enclosure and
a duct run are its services; an aerial is a mast standing on it. Every one is a
solid object a viaduct may not pass through, which is what `building` means in
`occupancy.js` — the one category with no exceptions in the conflict table.

### 1.3 (c) WHAT DECLARING EACH ONE CORRECTLY COSTS

Session 24's rule, unchanged: the claim a repair *would* make is built from the
delivered boxes, substituted into the census, and the sweep re-run. What was not
there before is the cost. **Measured on BOTH halves** — the delivered census and
the generator's own registry, and the second half is not optional because it is the
only one holding `water` (728), `path` (19) and `block` (121), all three of which
`building` is forbidden to overlap.

```
                                                        delivered census      generator registry
  CONTROL — today's claim through the probe's own path        0 new                  —
  (a) PLANAR — the yawed mass's world AABB                   80 new                  —
  (b) VERTICAL — y1 = the delivered roof top                  0 new                0 → 0
  (b') VERTICAL — y1 = the bound the generator can compute     0 new                0 → 0
  (a)+(b) BOTH                                               80 new                  —
```

**THE VERTICAL REPAIR IS FREE ON BOTH SIDES, FOR BOTH SPELLINGS.** The bound
contains the delivered top on **419 of 419** buildings, tightest slack 0.000 m.

**THE PLANAR REPAIR COSTS 78 BUILDINGS, AND THE COST IS REAL RATHER THAN THE
INSTRUMENT'S.** `occupancy.js` stores axis-aligned boxes and cannot hold a rotated
one, so "declare the yaw" can only mean *the world AABB of the rotated mass* —
which is larger than the building, with the extra at the corners. So each new pair
was re-tested by clipping the **delivered rotated footprint** against the other
claim exactly:

```
  of the 80 new pairs:  80 are a delivered solid genuinely overlapping a claim it may not,
                         0 are the AABB's corners with nothing there
  total true overlap     51.959 m²   —  tier 43.355, parapetTop 5.575, crown 3.030 m²
  by pair                building × pavement 77,  building × building 3
  78 distinct buildings of 419 are involved
```

> **The yaw defect is not costing accuracy, it is HIDING 51.96 m² of building
> standing in pavement across 78 buildings — and neither half of the two-sided
> check can see it, because both halves make the same mistake.** CONTRACT §9.1's
> whole design is that the generator's claims and the delivered census are two
> independent descriptions; where they share an error they are one description
> written twice.

And the repair is a trade rather than a fix: the AABB **removes the under-claim
entirely and enlarges the over-claim**, by a median of 4.497 m² and up to 43.008 m²
per building, 2 942.4 m² over the ring. That is the safe direction for a keep-out —
it can refuse, it cannot admit — and it is not free.

### 1.4 (d) REPAIR ONLY WHAT COSTS ZERO — SO THE VERTICAL ONE IS BUILT AND THE PLANAR ONE IS NOT

**Built**, in one expression readable from both sides:

- `citygen.js` → **`ROOF_PLANT_MAX_M = (1.8 + 3.4) × 3.60 = 18.72`**, beside
  `ROOF_PARAPET_M` and for the same reason session 20 put that one there.
- `citygen.js` → **`buildingTopM(era, eraName, height, floors)`**, called by both
  building walks. The crown is **bounded rather than read**, and that is not a
  shrug: the claim is laid *before* `crown` is rolled and consuming a uniform early
  would move every stream after it (CONTRACT §6). The bound is `era.cornice + 0.45`
  on contemporary and `era.cornice` elsewhere — largest 0.9, **both under
  `ROOF_PARAPET_M` = 1.05**, so on any building with a roofscape the crown cannot
  be the binding term, and on one without it, it is the only term. Confirmed by the
  62 plantless buildings measuring exactly 0.900 m.
- `city.js` → `buildRoofscape` now **returns the highest point it drew**; the
  building loop accumulates it per building; `placedClaims` uses it.
- `city.js` → an init line prints citygen's 18.72 against the same envelope
  **recomputed from `ROOF_KINDS` itself**, so a kind added with a taller aspect is
  a printed disagreement rather than a claim that quietly stopped containing its
  own roof. It reads `roof envelope — citygen.ROOF_PLANT_MAX_M 18.72 m claimed,
  ROOF_KINDS' own worst (1.8+3.4)·3.60 = 18.72 m drawn — agree`.

**The generator claims a BOUND and the census claims what ARRIVED, deliberately.**
The registry records what was *tested* and the census records what *is there*
(CONTRACT §9.1). The generator cannot know what a roof rolled — the hash lives in
`city.js` — so it claims the envelope and is conservative; the delivered claim is
exact.

**THE A/B, EVERY CLAIM DUMPED BEFORE AND AFTER AND DIFFED FIELD BY FIELD:**

```
                              before   after
  resident chunks               121     121
  delivered claims            3 330   3 330    identical, and identical BY KIND
  generator claims            6 515   6 515    identical, and identical BY KIND
  buildings placed              419     419    ← NO PLACEMENT REFUSED
  delivered forbidden overlaps      1       1  sign(pylon) × sign(pylon) 0.366 m², unmoved
  generator forbidden overlaps      0       0
  claims differing in ANY field   419     419  every one of them kind `building`
  claims differing in y1 ONLY     419          largest rise 18.720 m
  claims differing in any OTHER field   0      ← on both sides
```

**Content cost: zero. No matrix moved, no placement changed, no geometry touched.**
What changed is how tall the city says its buildings are.

**THE PLANAR ONE IS NOT BUILT.** 78 buildings of 419 would be refused. That is a
content change and the brief's rule — and session 24's — is that a placement
refusal is the operator's to see. **The number is in §1.3 and the decision is in
§5.1.**

### 1.5 WHICH DOWNSTREAM CHECKS WERE READING THE WRONG VOLUME

**There are FOUR different descriptions of a building's volume in this project, and
until this session all four stopped at the top of the wall and all four ignored the
yaw.** Enumerating them is most of the answer:

| # | where | shape | fixed this session? |
|---|---|---|---|
| 1 | `citygen.js` → the `building` claim | AABB, `y1 = height` | **vertical: yes.** planar: no |
| 2 | `city.js` → `placedClaims()` | AABB, `y1 = height` | **vertical: yes.** planar: no |
| 3 | `citygen.js` → `chunk.occluders` | `{x0,x1,z0,z1, top: height}` | **no** — untouched |
| 4 | `city.js` → `walkableAt` | `b.x ± width/2`, **no height at all** | **no** — untouched |

And the readers, each checked rather than assumed:

- **`deck × building`** — the one pair `occupancy.js` decides on the vertical
  extent — reads **1 and 2**, and it was **reading the wrong volume**. Its past
  green verdicts are **not overturned**: the sweep is still 0 after the repair. But
  they were green for a reason that could not have failed on a roof. Measured: the
  deck band is **14.20–21.00 m**; **377 of 419** building claims now reach into it
  where 374 did before, so **3 buildings were invisible to this test and are not
  now**; the nearest building reaching the band to any deck is **12.21 m** away in
  plan. *A check that passed against the wrong volume did not pass — it was
  unfalsifiable on the roof, and it is not any more.*
- **`canopy × building`** reads **2** (`canopy` is a delivered-only category —
  STATE 24 §1.7). **Unaffected by the vertical repair**, because a canopy's band
  starts at `HEAD_CLEAR_M` = 2.10 m and every building's claim already spanned
  0 … height ≥ 9.08 m, so the two already overlapped vertically wherever they
  overlapped in plan. **It is affected by the PLANAR defect, which is unrepaired**,
  and a crown reaching 0.5 m past a yawed building's claim is exactly the case.
- **Roof signs** — `citycheck` → `sceneWalk.signsInsideBuildings` reads **3**, and
  its buried test is `q[1] < b.top`. A roof sign sits at `bld.height +
  ROOF_PARAPET_M + …`, i.e. **above** `top`, so it is correctly *not* counted as
  buried. **This check was right and stays right**, and it would have broken had it
  read the claim instead — the vertical repair raises the claim over the sign. It
  still reads the unrotated footprint, so its *plan* half carries the planar defect.
- **`sceneWalk.propsInsideBuildings`** reads **3** in plan only, with no height
  test at all. Carries the planar defect. Unrepaired.
- **The freestanding sign pylon placement** (`city.js`) tests `chunk.occluders`,
  i.e. **3** — which is the same list that, per STATE 24 §1.5, does not include the
  other pylons and is why `occupancy` is red at 1.
- **The canyon sky-visibility bake** reads **3** deliberately as an *envelope*, and
  its own comment says so. Not a defect.
- **Aircraft clearance: there is no such check.** See §0.1.

---

## 2. THE PROVENANCE OF EVERY FLOOR AND CEILING

`tools/budgetaudit.mjs` (new, NOT A GATE). **This is an audit. No threshold was
moved, and that is the point** — the operator decides what a real bound would be.

### 2.1 The shape of the question, and the distinction the whole section turns on

```
323 leaves across budget.json, city-budget.json, look-budget.json, input-budget.json
189 of them are a floor, a ceiling or an assertion
```

Four questions per threshold, three machine-checkable:

1. **Is there a derivation?** — CONTRACT §9 rule 5.
2. **Does anything read it?** — §9.1's first variant.
3. **Is the assertion wired?** — a `--falsify` case, CONTRACT §7.1.
4. **Can a real run cross it?** — **not machine-checkable, and it is the one that
   matters.**

> **QUESTION 3 IS NOT QUESTION 4, AND CONFLATING THEM IS HOW BOTH KNOWN DEFECTS
> SURVIVED.** A falsifying case **mutates the measurement** — `r.roles.byRole.
> aircraft = 0` — and asserts the gate goes red. That proves the assertion is
> **wired**. It says nothing about whether the instrument, run against the real
> world, can ever produce a number on the far side of the line. The vsync ceiling
> had a case and passed it for nineteen sessions while being unreachable in the one
> direction that mattered.

### 2.2 What the machine-checkable columns say

```
where each bound's derivation lives:   direct 73,  sibling 18,  ancestor 22,  NONE 76   of 189
leaves nothing in src/ or tools/ names:                                        19  of 323
```

**THE FIRST VERSION OF THE DERIVATION TEST PRODUCED A FALSE FINDING AND IT IS
RECORDED HERE BECAUSE IT IS THIS SESSION'S OWN SUBJECT.** Looking only for a
sibling `$key` reported **"116 of 189 bounds have no derivation"**, which is not
true: `particles.maxStreakLengthPx` is derived over four lines inside
`$derivation_area`, and `ceilings.wallFrameMsP95` inside `capture.$estimator` one
object up. A number is documented if its *name* is argued about in prose a reader
of that number would find, so all three scopes are counted and reported separately.
**NONE now means nothing anywhere in the file argues about that number.**

**AND THE PER-THRESHOLD FALSIFY COLUMN WAS BUILT, MEASURED, AND REMOVED.** Matching
a case to a threshold by name reported **"140 of 189 bounds uncovered"** and every
one of those was a naming mismatch — cases are named by *assertion*, one case
covers several bounds, and a bound can be covered by a case sharing none of its
letters. Publishing that number would have been the fourth false absence in five
sessions. The project already answers the question properly: `falsify.
requireCoverage: 1` makes each gate count its own `fail()` **sites** and refuse to
pass with fewer cases than sites, and `citycheck --falsify` reads **56/56, coverage
100%** on this machine today.

### 2.3 THE TABLE — WHAT EACH BOUND WAS DERIVED FROM, AND WHETHER A RUN EXISTS THAT MAKES IT RED

The bounds where the answer is anything other than "yes, ordinarily". **Every one
is left exactly where it was.**

| threshold | value | derived from | can a real run make it red? |
|---|---|---|---|
| `ceilings.wallFrameMsP95` | 12.5 | `downtown_dense`'s **own measured p95** — the data it guards | **NO, under a vsync lock**, and known since s23. `max(work, T)` cannot go below 16.67 at 60 Hz, so the HUD cell was red for every possible state of the world. `perfcheck` runs unlocked and there it can. `$wallFrameMsP95_rebaseline` records it *was* 16.67 "because that was the vsync line" |
| `occupancy.minDeliveredClaims` | 1 200 | **the near ring alone**, applied to the whole ring | **NO in the direction it is for.** Known since s24. A 50-chunk ring clears it at 2 273; the full ring delivers **3 330**, 2.8× the floor. It cannot notice a half-built ring, which is why the red was "2" for two sessions and is 3 |
| **`ceilings.gpuFrameMsP95`** | **15** | **NOTHING — no derivation anywhere in the file** | **NOT ON ANY RUN THIS PROJECT HAS RECORDED.** §2.4 |
| **`ceilings.gpuFrameMsMax`** | **22** | **NOTHING** | same guard, same answer. §2.4 |
| **`headroomProbe.requireP95MsBelow`** | **16.67** | **NOTHING — and 16.67 is the 60 Hz vsync line**, applied to a CPU time | **ONLY ON NOISE.** §2.4 |
| `floors.metresTravelled` | 120 | a **distance**, against `capture.measureFrames` = 1800, a **time** | yes, and it did — on `player` at 1.40 m/s, which is why `framesByRoute.player` = 6000 exists. CONTRACT §9 row 17c |
| `floors.visibleInstances` | 115 000 | the delivered population before the change it guards | **YES, and it has** — s20 measured 106 501 against it and caught a content reduction. This is what a floor looks like when it works |
| `trafficLights.minStopLineM` | 0 | **not a measurement** — a signed clearance whose sign IS the verdict | **YES, and it is red**, at −10.45 m since s21. §3 |
| `occupancy.maxDeliveredConflicts` | 0 | not a measurement — zero is the only defensible value | **YES, and it is red at 1** on a true defect, deliberately left standing |
| `silhouettes.*` count floors (`minMeasured` 6/8, `minWidthMeasured` 5, …) | — | a **population sampled at three poses on one route** | yes — s7c/s9 record them going red and being restored. But they are the shape most at risk: `$estimator` records `--runs=1` reporting 19 subjects against `--runs=3` reporting 17, and a pass fraction over ~14 subjects carrying a 12-point standard error against a floor 4 points away |
| `alignment.minOffAxisFraction` | 0.6 | the delivered yaw population | **flagged**: STATE 22 §1.4 records that s21's measured 0.665 **does not reproduce** — the gate prints 0.739. A floor derived from a number that has since moved by 11% |

**Flagged as derived from a single run of the thing they guard, or from a subset of
the data they are applied to** — the brief's item 2(b). Beyond the five rows above:
`ceilingsByRoute.night_rain.wallFrameMsP95` = 13 (CONTRACT §0.2 measures its margin
at 0.60–0.75× the instrument's own spread — *"not resolved"*, in the contract's own
words); `city-budget.json` → `saturation.maxFraction` = 0.12 (CONTRACT §0.1 names
it as an extreme-value statistic belonging under rule 6, and s14 found it red at
12.49 against 12 — green today by less than its own 3.10-point spread); and the
**76 bounds with no derivation in their own file at all**, which is 40% of every
bound in the project. The full list is `node tools/budgetaudit.mjs`.

### 2.4 THE TWO NEW ONES, AND THEY ARE A MATCHED PAIR

**`ceilings.gpuFrameMsP95` = 15 and `ceilings.gpuFrameMsMax` = 22 sit behind a
guard.** Read out of `perfcheck.mjs` rather than assumed:

```js
const usingGpuTimers = report.method === 'gpu-timer-query' && gpu.length > 30;
...
if (usingGpuTimers) {
  if (metrics.gpuP95 > ceilings.gpuFrameMsP95) fail(...);
  if (metrics.gpuMax > ceilings.gpuFrameMsMax) fail(...);
}
```

and in `perf-probe.js`, `method: this.ext ? 'gpu-timer-query' : 'cpu-only'` — set
by the **presence of the extension** alone, whatever it delivered. What actually
protects the ceilings is `gpu.length > 30`, i.e. *did any query retire*. **When it
is false the two assertions are not failed, they are skipped**, and CONTRACT §10
step 3 names that exactly: *a suppressed assertion is not a pass.* `perfcheck`
prints `gpu p95 —` and moves on.

*Not re-measured here and said so:* whether `gpu.length` is ever above 30 on real
hardware needs a GPU. What this session verified is the **structure** — that both
ceilings are conditional, that the condition depends on queries retiring rather
than on the extension existing, and that STATE has carried *"GPU timer queries
advertised and never retiring"* as a known gap since session 8. The evidence that
the guard has been false is the other branch:

**`headroomProbe.requireP95MsBelow` = 16.67 runs `if (!anyGpuTimers)` — i.e.
exactly when the GPU ceilings did not.** And it cannot fail except on noise, for
three reasons that compound:

1. **It measures a CPU number.** `cpuMs` p95, against `ceilings.cpuFrameMsP95` =
   **12** on the same route. A run where the CPU ceiling passes has already
   established `p95 ≤ 12 < 16.67`.
2. **The 1.5× render scale does not change the pixel count.** `RENDER.pixels` is
   `2560 × 1440` = 3 686 400 and the capture viewport is 2560 × 1440 at dpr 1, so
   `target = pixels × 1.5²` exceeds the buffer and `RENDER.neverExceedNative`
   clamps `w, h` straight back to the native size. **The probe shades exactly the
   pixels the 1× run shades.** The file's own comment says this and calls the
   number "not evidence of headroom whatever it says".
3. **16.67 is the 60 Hz vsync line** — the same number session 23 identified as
   `wallFrameMsP95`'s discarded value — applied to a quantity that has nothing to
   do with a frame interval.

Its own recorded readings on identical work are **8.70 / 8.70 / 22.80 ms**: a
14.1 ms spread across a 16.67 ms requirement. So the one way it goes red is a
drifted run, which is CONTRACT §0.1's original incident with the sign reversed —
*a gate that can only fail on noise*, where that one could only pass on it.

> **Three of the five "cannot fail" thresholds this project has found are the same
> number wearing different clothes: 16.67, the 60 Hz frame interval.** It was
> `wallFrameMsP95` until session 4, it is what the HUD's 12.5 is unreachable
> *because of*, and it is `headroomProbe.requireP95MsBelow` today. **Not moved** —
> the operator decides what a real headroom bound would be, and the honest answer
> may be that the probe should be deleted rather than re-based, because its
> instrument is inert independently of its threshold.

---

## 3. THE STOP LINE — NOT STARTED, AND THE REASON IS THE BRIEF'S OWN RULE

The brief: *"DO NOT START THIS unless 1 and 2 are finished and written up. If you
start and cannot finish, revert it and say so — a half-built traffic change is
worse than an unstarted one."*

Items 1 and 2 are finished and written up. **Item 3 was not started.** Items 1 and
2 came to three instruments, two source repairs and an audit of 323 thresholds, and
what remained was not enough to design an exit reservation, measure it against a
−10.45 m overshoot, and revert it cleanly if it did not hold. **`minStopLineM` is
still 0 and `worstStopLineM` is still −10.45 m, untouched. No line of `traffic.js`
was read or changed this session.**

The design handed over is unchanged and is repeated so the next session does not
reconstruct it:

- **A reservation on the EXIT of the junction box.** A vehicle claims space on the
  far side for its own length plus a gap *before* it enters, and yields if it
  cannot. Deadlock is already excluded as the cause (worst queue five vehicles,
  every junction reaching zero) and so is the timestep (0.010 m of a 10.45 m
  overshoot).
- **Two different defects are reported by one assertion, and separating them comes
  first.** *Crossing the stop line on red* is a violation; *standing in the box on
  green with the exit blocked* is spillback. They have different causes and
  different repairs.
- **The one-line measurement that should precede both**, carried from STATE 22 §5
  and still not done: record `veh.recycled` alongside the vehicle that sets
  `worstStopLineM`, because a recycled vehicle is a teleport and its stop-line
  distance is bookkeeping rather than a violation.
- **It no longer needs a GPU.** `tools/lib/headlesscity.mjs` boots the real city in
  node and traffic is CPU work, which is what unblocked this item after three
  deferrals.

---

## 4. WHAT COULD NOT BE RUN HERE

Unchanged in kind from sessions 21–24: there is no GPU, so every gate that reads a
pixel refuses. **Nothing that needs one was attempted, on instruction.**

| gate | state this session |
|---|---|
| `parsecheck` | **green**, 88 files (86 + `claimprobe` + `budgetaudit`) |
| `citycheck --falsify` | **green**, 56/56, coverage 100% |
| `citycheck` (generator half) | **green**, run directly: **5 364 claims over the gate's region, 0 forbidden overlaps** — byte-identical to session 24 |
| `citycheck` (delivered half) | **run headlessly, RED AT 1** — `sign(pylon) × sign(pylon)` 0.366 m², session 24's true defect, deliberately left standing |
| `citycheck` (full) | needs a browser. It launches Chromium *before* its generator half, so on this machine it refuses at `browserType.launch` and prints nothing — the generator half was therefore run directly, over the gate's own region |
| `windcheck` | **not attempted.** Still owed |
| `faultcheck`, `lookcheck`, `perfcheck` | need a browser. Not attempted |

**`npm run gates` did not run green end to end and could not have on this machine.**
Nothing was weakened: `budget.json`, `city-budget.json`, `look-budget.json` and
`input-budget.json` are **untouched** — verified, §2 is an audit and moved nothing.
No threshold moved, no assertion was deleted, no red was closed.

**No frame was taken. No judgement about whether anything reads better is in this
file.**

---

## 5. WHAT THE NEXT SESSION STARTS FROM

### 5.1 The operator's own list — these cannot be done by a session

1. **LOOK AT THE VIADUCT'S PORTAL AND THE TRAIN'S RAKED NOSE.** Both on
   `claude/noctis-23-hud-vsync-ceiling-9fu4nf`, both unmerged, **neither has ever
   been looked at by a human**. The nose's pose is
   `node tools/lookat.mjs --pos=70,1.74,0.9 --target=0,23,11 --fov=52`.
2. **DECIDE THE SHOULDER CHAMFER.** One line, once the nose has been seen.
3. **DECIDE THE PYLON.** `occupancy` is red at 1 on a true defect — two pylons
   0.32 m apart, one's panel through the other's post. The repair costs **1 pylon
   of 36**. Leaving a true red standing is a correct state; closing it is a content
   change.
4. **DECIDE THE PLANAR BUILDING CLAIM.** New this session. Declaring the yaw
   correctly refuses **78 buildings of 419** and surfaces **51.96 m² of real
   building-in-pavement** that nothing can currently see. §1.3. *This is the largest
   costed decision on the list.*
5. **RUN THE M5 BASELINE.** `budget.json` → `machine.series.m5` is an empty slot
   with the three steps that fill it. **Nothing in this project has had a
   millisecond measured since session 20.**
6. **DELETE TWO MERGED REFS.** `claude/generator-occupancy-registry-6pbuer` and
   `claude/noctis-22-machine-residual-t3u3px`, both verified ancestors of
   `origin/main`. `git push --delete` returns HTTP 403 through this proxy. **It
   needs a click, not a retry.**
7. **RUN `npm run gates` ON A MACHINE WITH A GPU.** Five sessions stale.

### 5.2 The session's list — these can be done here, without a GPU

1. **THE STOP LINE.** §3. Reachable headlessly now; the design is written out.
2. **THE PLANAR BUILDING CLAIM IS COSTED AND WAITING ON (5.1.4).** If the operator
   accepts the 78, the expression is already spelt three times in `citygen.js`
   (`paint()`, the kerbside prop claim, the sign pylon). **The deeper answer is that
   `occupancy.js` cannot express a rotated box at all** — every claim is an AABB —
   so the honest repair may be a claim that carries a yaw rather than a wider box.
   That is a change to the registry and should be costed before it is designed.
3. **`chunk.occluders` AND `walkableAt` STILL STOP AT THE WALL AND IGNORE THE YAW.**
   §1.5, descriptions 3 and 4. Four descriptions of one volume is CONTRACT §9.1's
   two-descriptions problem doubled; the vertical half of two of them is now
   repaired and the other two are not. **Nobody has costed unifying them.**
4. **THE ROOF PLANT'S KIND MIX IS NOT ITS DECLARED MIX.** §1.2. The variate is
   `|sin|`, not uniform. Correcting it redistributes every roof in the city — a
   content change. The same expression drives `h` and `seed`, so unit sizes and
   counts are biased too.
5. **THE ROAD PATCH IS CLIPPED AGAINST NOTHING.** Carried, STATE 24 §1.6. 10 of 58
   near-ring patches lie wholly off every carriageway. Cost: up to 10 patches of 58.
6. **FIVE OF THIRTEEN CATEGORIES ARE CLAIMED ON ONE SIDE ONLY.** Carried, STATE 24
   §1.7. `water`, `path`, `block` never appear in the delivered census; `canopy` and
   `sign` never in the generator's. **This session used that fact rather than fixing
   it** — §1.3's generator-side cost measurement exists precisely because the
   delivered sweep is blind to `water`, `path` and `block`.
7. **A CLAIM MAY CARRY A KIND THAT IS NOT A CATEGORY.** Carried, STATE 24 §1.7.
   `'ground'` is silently permitted against everything; 25 grass rectangles carry
   it. **Genuinely free** — a validation in `claimBox` refuses nothing today.
8. **`citycheck`'s DELIVERED SWEEP HAS NEVER RUN OVER A COMPLETE RING.** Carried,
   STATE 24 §1.2. Either `waitForCity` asserts `resident === (2·geometryRadius+1)²`
   or the gate does.
9. **THE 76 UNDERIVED BOUNDS.** §2.2. 40% of every bound in the project has no
   arithmetic beside it. `node tools/budgetaudit.mjs` lists them; CONTRACT §9 rule 5
   says each is a guess until one is written.
10. **`windcheck` IS STILL THE GATE THIS GEOMETRY MOST OWES**, and it needs no GPU
    — it needs a machine that can stream the origin block without losing the
    SwiftShader context, which this one demonstrably cannot.

### 5.3 Carried, unchanged, from session 24 and earlier

11. **`PROP_MODELS.lamppost` is placed zero times** over the gate's region.
12. **The lamps are in no registry band at all.** 181 columns and 181 heads over
    this ring, none claimed. Declaring the column as `prop` costs 113 forbidden
    pairs, 72 against the carriageway the arm reaches over. **A column and its arm
    need two bands, not one.**
13. **A bench's BACK faces nowhere in particular.** STATE 22 §1.2. Reachable
    headlessly.
14. **STATE 21's off-axis fraction of 0.665 does not reproduce** (the gate prints
    0.739) — and it is now also §2.3's last row, because a floor of 0.6 was derived
    from a number that has since moved 11%.
15. **`index.html`'s `#bootfail`** has still not been through `lookcheck` or
    `gateaudit`.
16. **`floors.visibleInstances` and `drawCalls` on a real route**; **the saturation
    reserve, still unmeasured** (STATE 20 recorded 1.53 points); **session 20's
    items 8 and 14** (vehicle light signatures, vehicle pop-in); **`player`'s
    ceiling at the quiet bar**; **the retroreflective BRDF for the markings**.
17. **Decide whether `machine` gets an assertion.** The field is inert, which is why
    five sessions have had to remember not to fake it.

---

## 6. KNOWN GAPS CARRIED FORWARD

**Unchanged from s8–s24**: `stats().cutoffM` hard-codes 0.8, the headroom probe
inert (**and now costed — §2.4**), GPU timer queries advertised and never retiring
(**and now shown to gate two undocumented ceilings — §2.4**),
`saturation-peak.png` overwritten every run, `$fovYDrift`,
`camera.setRouteAt(name, 1.0)` at the sky, rain streaks near-invisible wide at
night, `rain_spray` 0 static, right turns only, sun shadows to ~170 m, the bake
blind to elevated slabs, the PMREM hitch, the too-red dawn horizon, one worker at
queue depth one, the far half of the river handing back to the night sky past
~300 m, grime authored, the near-field washboard on the water, the quay wall inside
the walkable mask, **props absent from the walkability mask**, the 3.5°–10.4° route
camera pitch, the frozen/running A/B, and `downtown_dense`'s mean luminance under
its floor.

**Resolved this session**: the building claim stopping at the top of the wall, on
both halves of the two-sided check; `deck × building` being decided by a box that
could not reach a roof; the absence of any measurement of what the building claim
over- and under-claims; the absence of any enumeration of where each threshold in
this project came from.

**Still red and unchanged**: `minStopLineM` at 0, `worstStopLineM` at −10.45 m.
`floors.visibleInstances` unmeasured.

**Still red, and red on something true**: `occupancy`'s delivered half at **1** —
two sign pylons 0.32 m apart, one's panel through the other's post. Session 24's
finding, deliberately not closed.

**New in CONTRACT §9's table** (offered for the next session to add rather than
added here, because `parsecheck`'s `contractDocCheck` counts the rows and the count
is a gate — session 24 left four rows on the same terms and they are still owed):

- a building's claimed top — `y1: bld.height`, **the top of the WALL** — used as
  the top of the BUILDING, so the parapet, the cornice and 1 436 roof-plant boxes
  stood outside the claim that answers *"does the viaduct pass through this
  building"*, the median roof by 15.50 m and the worst by 18.72 m;
- **`Math.abs(Math.sin(x) % 1)` read as a UNIFORM variate when it is `|sin(x)|`** —
  arcsine-distributed, CDF `(2/π)·asin(t)` — so `city.js`'s roof-plant weights of
  4/3/3/3/2 of 15 deliver 17/14/16/20/**33**%, the aerial at 2.5× its declared
  share, and the size and unit-count rolls drawn the same way are biased toward
  their maxima;
- **16.67, a 60 Hz FRAME INTERVAL, used as a bound on CPU frame time** in
  `headroomProbe.requireP95MsBelow` — the third appearance of the same number as an
  unreachable threshold, on a probe whose render scale is clamped back to native by
  `neverExceedNative` so it shades the same 3 686 400 pixels twice;
- a delivered box's **world AABB** used as the box's **footprint** in a question
  about YAW — inside this session's own instrument, in its first hour: a 26 m
  building turned 2.4° has an AABB 0.55 m wider than itself, so the probe would have
  reported its own inflation as the building escaping its claim;
- a box's **nearest building CENTRE** used as **the building that emitted it** —
  also inside the instrument: a parapet bar is written half a building from its own
  centre, so a tall building's parapet was attributed to a short neighbour and
  reported as standing 79.57 m above its claim.
