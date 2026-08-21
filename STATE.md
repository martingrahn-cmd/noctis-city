# NOCTIS — STATE

*End of session 37. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`. **The machine
has REBOOTED since session 36** — 2 days 21 h of uptime at the first command against session 36's
38 days — so nothing about the machine's state carries over. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` WAS 2.24 AT THE FIRST COMMAND AND RANGED 2.24 TO 4.04 ACROSS THE SESSION***, against
CONTRACT §0.2's bar of **1.6**, and it was never once inside it — this was a session of browser
work, which is the state the project memory predicts. **SO NO MILLISECOND IN THIS FILE IS
ADMISSIBLE AS AN ABSOLUTE**, and none is quoted as one. Every figure below is a COUNT, a DISTANCE,
an AREA or a PIXEL STATISTIC — load-independent, CONTRACT §9 rule 6's corollary — or a paired
before/after through the same instrument on the same machine within minutes of itself.

---

## 0. THE FRAMES, THE ARM, AND WHY

**THE FRONTAGE FILL LAW GOES `d^1.10` → `d^0.50`, AND IT IS THE FIRST ARM IN THIS PROJECT'S
HISTORY CHOSEN BY LOOKING RATHER THAN BY WHERE A GATE STOPPED.** Session 36 says so of its own
arm in as many words: *"the largest raise that costs no clumping margin at the gate's own seed"*.
This one was chosen from nineteen frames and the gates were told afterwards what it cost.

**689 buildings over `citycheck`'s 10 × 10 at seed 1337, against 528. Island coverage 31.2% →
38.4% over the chunks that carry a building, against 95.0% for a full ring. Frontage occupancy per
block 0.268 → 0.355. Block sides bare end to end 137 → 118 of 400.**

### THE SWEEP — nineteen frames, seven arms, three poses, one seed

`?fill=` is a new CONTRACT §6 parameter and `lookat --params=` passes it through. **The arm is
bit-for-bit**: `?fill=1.10` — session 36's shipped value — and no parameter at all produce a
byte-identical PNG, `16d5f2b8…`, and that hash reappears as the `f110` frame of the swept series.

```
A  node tools/lookat.mjs --pos=-180,230,700 --target=-330,0,460 --fov=60 --t=0.5649 --wet=1
B  node tools/lookat.mjs --pos=0,950,0      --target=-200,0,-200 --fov=50 --t=0.5649 --wet=1
C  node tools/lookat.mjs --pos=-250,1.9,256 --target=-60,10,256  --fov=55 --t=0.0    --wet=1
   … --params=fill=<power>   →  tools/shot-out/s37-{airA,airB,street}-f<power>-t*.png
```

Pose **A** is session 35's and 36's own aerial, so four sessions now stand in the same place. Pose
**B** is new — 950 m up over the region centre, steep enough that everything in frame is inside the
residency ring, which is the only honest way to see a whole district at once. Pose **C** is session
36's frame-2 street, at 1.9 m, midnight, wet.

| what the frames say | |
|---|---|
| **THEY GIVE TWO DIFFERENT ANSWERS, AND THAT IS THE FINDING.** | From pose **C**, the pavement, **denser is better all the way to `fill = 1.0`** — the street wall closes monotonically and there is no arm at which it stops improving. At `f000` the whole left side of the frame is one continuous lit mass to the horizon. If the street were the only camera, the answer would be `d^0.00`. |
| **From pose B it is not.** | At `f140` and `f110` every block is a loose scatter of separate roofs with bare ground showing between neighbours; no block reads as a block. At `f070` the dense south-west closes but the sparse north is still unfinished scatter. **At `f050` nearly every block carries a continuous ring of roof around a courtyard — and the gradient still reads**: the north-west along the river and the blocks around the tower are visibly looser than the south-west core, the far bank is empty, the dish apron and the park strip are clear ground. At `f030` that gradient is flattening. **At `f000` it is gone** — every block is packed to the same degree and the only variation left is chunk KIND, not density. The city is a carpet. |
| **So the arm is `d^0.50`: the last one at which the blocks read as solid AND the city still has districts.** | It is a judgement, and it is recorded as one. |

### THE NUMBER THE FRAMES WERE READING — LOOK.md §2's LAST BULLET HAS NEVER HAD ONE

*"Density has causes… a city generated from noise looks generated however dense it is."* Every
other column this project keeps says how MUCH city there is. `fillprobe --districts` is new and
says whether it VARIES: the median delivered island coverage of the densest quarter of `built`
chunks over that of the sparsest, ranked by the chunk's own `densityAt`, **pooled over 963 `built`
chunks in twelve regions (seeds 1337–1348)** because one region is 83 chunks and its quartiles mean
nothing.

```
  power    cov Q1 sparse   cov Q4 dense   CONTRAST
   1.40        14.7%          40.8%        2.77x     session 32
   1.10        17.9%          42.7%        2.38x     session 36
   0.90        21.3%          45.2%        2.12x     citycheck clumping goes RED here
   0.70        24.4%          47.1%        1.93x
   0.50        30.5%          49.3%        1.61x     <- SHIPS
   0.30        36.3%          51.8%        1.43x
   0.00        45.2%          53.9%        1.19x
```

**THE DENSE QUARTER GAINS 1.32× ACROSS THE WHOLE LAW AND THE SPARSE QUARTER GAINS 3.08×**, because
the core is already against its own refusal ceiling. So this knob does not spend *some* district
structure — the contrast column IS what it spends, and at `fill = 1.0` LOOK.md §2's last bullet is
unreadable by construction. **`d^0.50` is not where a gate stopped: `citycheck`'s clumping floor
binds at `d^0.90` and this ships four steps past it, red.**

---

## 1. THE ONE ITEM

`34ef545`, `60adb48`, `0f06737`, `380ce1a`.

### 1.1 THE BRIEF ASKED FOR A CORRECTION THAT WAS ALREADY MADE, AND HALF OF IT WAS NEVER TRUE

The brief opened: *"Two of those four — the draw-call ceiling and the registry — were written into
LOOK.md §2 by ME as the reason density was blocked. Both are false. Correct that paragraph in its
own commit before anything else."*

- **The correction was already in the repository**, in session 36's own third commit `8a9f857`.
  §2's bullet has read *"THE LIMITER IS `citycheck`'s CLUMPING FLOOR. IT IS NOT THE REGISTRY… AND
  THE FIRST OF THOSE WAS MINE"* since 2026-08-18. **Nothing was owed and nothing was written.**
- **And only ONE of the two was ever in §2.** The bullet it replaced was headed *"THE LIMITER IS
  THE OCCUPANCY REGISTRY, **NOT DRAW CALLS AND NOT BATCHING**"* — §2 disclaimed the draw-call
  ceiling in its own headline, before session 36 touched it. The draw-call claim was in the
  *briefs*, not in this file.

Believe the code: `git show 8a9f857 -- LOOK.md`.

### 1.2 THE ARM MECHANISM IS A PARAMETER, AND THE FIRST SWEEP IT PRODUCED WAS A LIE

`?fill=<power>` — `-1` defers to `FRONTAGE_FILL.power`, `>= 0` overrides, applied in `main.js`
before the first module is constructed. CONTRACT §6's table carries it. **No gate passes it**:
`budget.json`'s `capture.params` does not contain it, so `lookcheck`, `citycheck` and `perfcheck`
render the shipped law exactly as they have for thirty-seven sessions. It is a parameter and not a
second copy of `citygen.js` because CONTRACT §6 says an arm is a parameter, and because this
project's own memory of session 10 records losing a negative control to a file swap.

> **AND THE FIRST SWEEP IT PRODUCED WAS SEVEN COPIES OF THE SAME CITY.** `lookat`'s top-level
> argument parser was `a.replace(/^--/,'').split('=')` destructured into `[k, v]`, so
> `--params=fill=0.90` arrived as `params` → `fill` with the `0.90` **silently dropped**. Every arm
> rendered the shipped law. The sweep looked like a result — *the city does not change with the
> fill* — and every frame in it was real. **`loftprobe.mjs` carries a comment about this exact line
> costing it a refusal in session 10, and the fix I wrote quoted that comment while feeding the
> value through the broken parser above it.** CONTRACT §9's failure mode with a string instead of a
> length. It was caught by hashing the frames, not by looking at them: six of seven were
> byte-identical. **`lookat` now splits on the first `=` only**, which repairs every argument it
> takes, not just this one.
>
> **AND IT LEFT A MEASUREMENT BEHIND.** Of nine renders of one identical city at pose A, **seven
> were byte-identical and two were not**. So a frame at this pose is not perfectly reproducible and
> an A/B on it has a non-zero noise floor. Not chased; recorded, because the whole item rests on
> frame pairs. §9.

### 1.3 DELIVERED

```
                                      s36 (d^1.10)   s37 (d^0.50)
  buildings over the region               528            689
  of those, river bank                      8             10
  chunks carrying a building               81             81
  island coverage, all 100               25.2%          31.1%
  island coverage, the 81 built          31.2%          38.4%     against 95.0% for a full ring
  frontage occupancy, per side           0.218          0.315
  frontage occupancy, per block          0.268          0.355
  block sides bare end to end          137/400        118/400
  signs generated                          755            983
  props / props given up               1590/54        1589/55
  objectCount CV                         0.626          0.568     citycheck floor 0.60, RED
  district contrast, 12 regions          2.38x          1.61x
```

### 1.4 DEPTH AND FILL DO NOT MULTIPLY. RAISING ONE LOWERS THE OTHER, AND NOW IT HAS A SIGN

Session 36 measured that the two knobs multiply to within 6% and named corner refusals as the
residual. Through `depthprobe`, same seed, same region, both arms:

```
                                  d^1.10      d^0.50
  buildings on an island edge        520         679
  median depth into the island      29.8 m      26.7 m     −3.1 m, −10.4%
  depth clipped at corners           905 m     1342 m      +48%
  registry refusals against a building 124       157
```

**The frontage raise bought 7.2 points of island coverage and spent 3.1 m of the depth session 35
built.** Session 36's own 29.8 m reproduces exactly through the same instrument, so this is a
paired reading and not a re-baseline. The third knob — the end-of-run gap, `rng.range(6, 26)` after
every run of buildings — remains unspent, and it is the only one that does not fight anything.

### 1.5 THE DRAW-CALL CEILING STILL DOES NOT BIND, AT FOUR TIMES SESSION 36's CONTENT

`highway_speed` stands at **436 of 440**, against 434 at s36 and 433 at s35. **161 buildings cost
two draw calls.** LOOK.md §2's *"the whole range of this law costs four draw calls"* survives a
change 4.4× larger than the one that produced it.

---

## 2. THE LUMINANCE BANDS — AND SESSION 36's PREDICTED MECHANISM DID NOT FIRE

Three `lookcheck` runs, minutes apart on one machine. **The run-to-run spread of this instrument is
≤ 0.0001**, measured here and unchanged from session 36 — dawn, noon and dusk were IDENTICAL across
all three runs and midnight moved 0.0001 — so every delta below is resolvable by it.

```
  band          s36 dry   s37 dry   delta      s36 wet   s37 wet    band            margin now
  midnight      0.0748    0.0749   +0.0001     0.0798    0.0798    [0.072, 0.112]    0.0029
  dawn          0.3037    0.3025   -0.0012     0.3033    0.3017    [0.299, 0.353]    0.0035
  noon          0.4281    0.4281   +0.0000     0.3926    0.3925    [0.428, 0.482]    0.0001
  dusk          0.1399    0.1396   -0.0003     0.1425    0.1422    [0.14, 0.18]     -0.0004  RED
```

> **`band:noon` MOVED BY NOTHING, AND THE BRIEF EXPECTED IT TO BE THE BINDING CONSTRAINT.** The
> brief, LOOK.md §7 and three consecutive briefs before it all carried: *"at 58° the sun lights the
> GROUND, so more buildings make noon darker. A floor on the noon mean is a ceiling on density."*
> **Session 36 attributed 0.0011 of noon to 37 buildings. Session 37 added 161 — 4.4× as many,
> +30% over the region — and noon read 0.4281 before and 0.4281 after.** The mechanism has no
> surviving evidence. `lookcheck` stands in the origin block, which `block.js` authors and the
> generator never touches, and whatever the streamed city contributes to that frame did not scale
> with this change. **`band:noon` is GREEN, at 0.0001 of margin, and nothing was owed on it.**
> LOOK.md §7's bullet is corrected in `380ce1a` and the inference is recorded as mine.

**AND THE GATE THAT WAS SUPPOSED TO ARGUE AGAINST DENSITY WAS FIXED BY DENSITY.** `citycheck`'s
6.00% bright-reserve floor has been **RED FOR SIX SESSIONS** — 5.67% at s35, 5.33% at s36 — and at
`d^0.50` it reads **6.37%, GREEN**, per-run means `[6.55 6.37 6.37]`, spread 0.18 points against a
margin of 0.37. More buildings on a night route is more sets of lit windows. `perfcheck`'s two
night level floors moved the same way: `downtown_dense` mean luminance 0.0930 → 0.0967 and
`night_rain` 0.0850 → **0.1139**, the latter having been red on both of session 35's readings.

---

## 3. GATE STATE

Each gate run individually, because `npm run gates` is `&&`-joined and stops at the first red.

```
  parsecheck   GREEN   108 files, contract-clean
  faultcheck   GREEN   7 cases; quarantine surgical, frame survives all seven
  windcheck    GREEN
  gateaudit    RAN, twice — and it caught a real defect in this session's own change. §3.3
  citycheck    RED at 2 — clumping, and TWO delivered forbidden overlaps. §3.1
  lookcheck    RED at 3 — the same three, all carried from session 31
  inputcheck   RED at 4 — NOT THIS SESSION'S, NOT THE SESSION BEFORE'S. §6
  perfcheck    every millisecond inadmissible; content reds in §5
```

### 3.1 `citycheck` — RED AT 2, AND ONE OF THEM IS THE REGISTRY

```
  occupancy    5672 generator claims over the region, 4455 delivered (min 1200)
  ✗            0 / 2 forbidden overlaps over 53 forbidden pairs (max 0)
                 sign(pylon) x sign(pylon)      0.095 m2
                 sign(adpillar) x prop(planter) 0.047 m2
  ✗ clumping   CV 0.568 (min 0.6), 94% populated (min 55%), objects/chunk min 0 max 74
  prop place   0 of 1589 props inside a building footprint (max 0)
  sign place   0 of 1793 delivered sign quads inside a building (max 0)
  sign mount   5 distinct over 983 generated signs (min 4)
  pedestrians  360 over 9 chunks, CV 1.0547 (min 0.7), 67% populated
  street level 195 stalls over 25 chunks, 5 kinds, 5 pitches abandoned
  alignment    74.1% of 3261 objects off-axis (min 60%), largest 2.27°
  negative sp  17.0% of chunks low-detail (min 8%), 5 kinds (min 3)
  bright res   6.37% (min 6.00%)  — GREEN, first time in six sessions
  walkability  55 109 of 55 325 free cells reached
  landmarks    8 placed, 6 visible from elevation, 0 unreachable on foot
```

> **THE TWO OVERLAPS ARE REAL, THE REGISTRY DID NOT MOVE, AND THEY ARE NOT THIS SESSION'S DEFECT.**
> The brief reserves the registry absolutely and nothing in it was touched. What was measured
> instead:
>
> **THE GENERATOR'S REGISTRY CONTAINS NO `sign` CLAIMS AT ALL.** Over the region it holds 5 672
> claims in 27 kind/owner families — `building`, `water`, `pavement`, `site`, `carriageway`,
> `landmark`, `deck`, `feature`, six kinds of `prop`, `block`, `path` — **and not one `sign`.**
> Signs are claimed only in the DELIVERED census, which is why the generator half of this
> assertion has read 0 for thirty-six sessions and could never have read anything else. A sign
> cannot be refused against a planter it was never compared with.
>
> **AND IT SHOWS AT THE SHIPPED LAW ON OTHER SEEDS.** The delivered census, taken through the
> harness at one camera across six arms:
>
> ```
>   fill    seed    delivered claims   conflicts   involving a SIGN
>   1.10    1337          4490             4              0          (4 x path x pond, origin block)
>   0.50    1337          4781             6              2
>   1.10    1338          3877             1              1          sign(pylon) x sign(pylon) 0.102
>   0.50    1338          4157             0              0
>   1.10    1339          4683             1              1          sign(adpillar) x prop(planter) 0.006
>   0.50    1339          4949             2              2
> ```
>
> **Two of the three other-seed regions deliver a forbidden sign overlap at SESSION 36's SHIPPED
> LAW, and seed 1338 delivers FEWER at `d^0.50` than at `d^1.10`.** The fill raise is a trigger and
> not a cause: more signs is more chances for two to land close. `citycheck` runs at seed 1337 and
> that is the whole reason nobody has seen it.
>
> **A THIRD THING FELL OUT OF THAT TABLE.** The census above finds **four** `path(ground:path) ×
> `feature(centre:pond)` overlaps at seed 1337 that `citycheck` does not report, at both fills —
> and its own delivered claim count is 4 455 against this census's 4 781. **`citycheck`'s delivered
> overlap sweep is a census of whatever happened to be resident when its camera looked**, not of
> the region. It is a sample presented as a survey.

**`walkability` LOST GROUND AND IT IS NOT ASSERTED.** 61 777 of 61 778 free cells reached at s36;
**55 109 of 55 325 now — unreachable cells 1 → 216.** 6 453 fewer free cells because there are 161
more buildings, and the enclosed pockets that come with them. Nothing was aimed at it and no
threshold reads it.

### 3.2 `lookcheck` — RED AT 3, ALL THREE CARRIED FROM SESSION 31

```
  ✗ band:dusk        0.1396  (band [0.14, 0.18])   0.1399 at s36 — moved 0.0003 AWAY
  ✗ facadeAlbedo     3 clusters (min 4)            carried from the station, s31
  ✗ facadeNeighbours 0.213   (min 0.3)             carried from the station, s31
```

`band:midnight`, `band:dawn` and `band:noon` all passed. §2 has the before/after.

### 3.3 `gateaudit` — IT CAUGHT THIS SESSION'S OWN CHANGE, WHICH IS WHAT IT IS FOR

```
  ✗ CONTROL — the unperturbed frames do not pass their own gate:
      band:dusk, facadeAlbedo, facadeNeighbours     <- the same three §3.2 carries
  ok  control — every assertion ran
  ok  every threshold in look-budget.json, fed a frame that should fail it
  ✓  perfcheck --falsify: 74/74 rejected, 100% coverage of 72 failure sites
  ✓  citycheck --falsify: 61/61 rejected, 100% coverage
  ✓  inputcheck --falsify: 13/13 rejected, 100% coverage, good fixture clean
  ✓  --falsify: perturbing each threshold against the control rows
```

**Its first run of this session FAILED on something new**: `perfcheck --falsify` refused with *"the
GOOD fixture failed 1 assertion: HUD.budgets disagrees with budget.json ceilings on 1 of 6 keys —
triangles: HUD 2000000 vs budget 2360000."* The triangle ceiling has a second copy in
`src/core/constants.js` for the on-screen panel, and §4's re-derivation moved one and not the
other. **A threshold with two homes, caught within a minute of the drift being created.** Both are
in step in `0f06737`. Run `lookcheck` immediately before `gateaudit` or it audits whichever arm
last wrote `tools/look-out/` — session 36's trap, still true, still obeyed here.

---

## 4. WHAT WENT RED, AND WHAT WAS RE-DERIVED — LOOK.md §7's PROCEDURE, BOTH OUTCOMES

Two thresholds went red on the chosen city. The procedure was run on both, in the open, and they
came out **opposite ways**. Both derivations are written beside their numbers in the budget files,
dated, as the brief required — not only here.

### 4.1 `ceilings.triangles` 2 000 000 → 2 360 000 — AND THE OLD NUMBER NEVER CAUGHT WHAT IT NAMES

**Delivered: `highway_speed` 2 086 042 triangles against a 2 000 000 ceiling. RED.**

- **What it was derived from**, `budget.json` `$triangles_rebaseline`, session 4: *"Measured 0.91M
  / 1.11M / 0.91M. 2000000 is 1.8x the worst route and would catch a geometry LOD that stopped
  working, which 4.5M would not."* Two claims — a construction, and a PURPOSE.
- **Why that input no longer holds.** Nobody had ever measured what a broken LOD costs, so the
  purpose was an assertion. `CITY.detailRadius` is 4 against `geometryRadius` 5, so *"the LOD
  stopped working"* is exactly `detailRadius = 5`: every geometry chunk built at full detail.
  Measured on `highway_speed`, the binding route, minutes apart on one machine:

  ```
    working        2 086 042 tris   436 draws   289 587 instances
    LOD defeated   2 666 516 tris   452 draws   368 529 instances     ratio 1.278x
  ```

  **A BROKEN LOD COSTS 1.278×, NOT 1.8×.** So at session 4's own worst route of 1.11 M a broken LOD
  delivers 1.42 M against a 2.00 M ceiling and **passes**. The ceiling has never been able to catch
  the thing its derivation says it exists for — 1.8× of headroom cannot detect a 1.28× failure, and
  the two numbers were chosen independently and never compared.
- **The new value, and its reason.** Any ceiling strictly between 2 086 042 and 2 666 516
  discriminates and nothing outside that interval does. **2 360 000** is the geometric mean of the
  two, rounded to the nearest ten thousand — equidistant *in ratio* from a false red and a false
  green, which is the right symmetry for a multiplicative quantity. It is 1.131× the delivered
  worst route and the broken city stands 1.130× above it.
- **CAN IT STILL FAIL — the brief's own test. YES, AND FOR THE FIRST TIME.** A defeated detail ring
  delivers 2 666 516 > 2 360 000 and this ceiling rejects it, where 2 000 000 rejected the WORKING
  city instead. `floors.triangles` 940 000 is untouched and still catches deletion.
- **What it costs, said plainly.** Headroom above delivered content is now **13%, not 80%**. The
  next content raise of any size breaches this. That is a ceiling doing its job.
- **This is a ceiling RAISED on the session that breached it**, which is the shape CONTRACT §0
  rule 5 forbids in appearance. What admits it is the measurement, and it is the
  `$drawCalls_correction` / `$screenshotEntropy_s17` shape: a specification correction with
  arithmetic, and the operator's to reject.

### 4.2 `clumping.minDensityCV` — 0.6 STANDS, THE GATE IS RED, AND NO VALUE WOULD BE HONEST

**Delivered: CV 0.568 against a floor of 0.60. RED.** The brief asked for the spread across seeds
to be measured before anything was proposed. It was, and it produced something larger.

- **What it was derived from**, `city-budget.json` `$comment` and `docs/authored-city.md` §1: *"Grid-
  with-jitter gives a CV near 0.1; low-frequency noise with placement inside it gives well over 1.
  The floor is at 0.6 because that is where the two are unambiguously different."*
- **Which input no longer holds — and it never did.** Over **twelve** regions (seeds 1337–1348,
  `citycheck`'s own 10 × 10, at session 36's SHIPPED law) the statistic reads

  ```
    0.266  0.277  0.461  0.479  0.535  0.626  0.647  0.650  0.677  0.797  0.848  1.078
    median 0.636   spread 0.812   ONE of twelve exceeds 1.0
  ```

  **SIX OF TWELVE WERE ALREADY BELOW THIS FLOOR ON THE CITY THAT SHIPPED.** 0.6 has never sat
  between two separated populations; it sits near the middle of this generator's own distribution.
  A green verdict at seed 1337 was a verdict about seed 1337. That is CONTRACT §0 rule 6's
  forbidden state — a margin of 0.026 read off one draw of a statistic whose spread is **thirty-one
  times** the margin. Session 36 recorded the same thing over five seeds and did not act on it.
- **AND THE STATISTIC IS MEASURING SOMETHING ELSE, WHICH IS THE SESSION'S OTHER MAIN RESULT.**
  `objectCount` CV across chunks correlates with the number of NON-`built` chunks in the window at
  **Pearson r = 0.90**, and with the number of EMPTY chunks at **r = 0.92**, over those same twelve
  regions:

  ```
    seed 1340   0 low-detail chunks   59.3 objects/chunk   CV 0.247   <- this gate calls it grid-with-jitter
    seed 1344  47 low-detail chunks   15.8 objects/chunk   CV 0.979   <- this gate calls it beautifully clumped
  ```

  **THE FLOOR IS A FLOOR ON HOW MUCH PARKLAND IS IN THE SAMPLE.**
  `negativeSpace.minLowDetailFraction` already asserts exactly that property, deliberately and with
  its own derivation, so the two measure one thing twice and this is the worse instrument for it.
  `$minPopulatedChunks` was written against precisely this degenerate mode — *"a high CV bought by
  emptiness is not clumping"* — and at 0.55 against a delivered 0.94 it has never been able to
  bind. `citygen.js`'s park-planting comment had already measured one corner of the same coupling:
  planting the parks COSTS 0.046 of CV.
- **Pooling is not the repair either, and that was measured rather than assumed.** The median over
  twelve regions binds at power 0.90 (0.602) and fails at 0.70 (0.596) — which is exactly where the
  single draw at seed 1337 already binds. A pooled estimator moves the verdict by **nothing**, and
  it would make a contaminated statistic precise instead of making it right.
- **So nothing shipped but a print.** `citycheck` now prints all twelve regions and the pooled
  median beside the verdict and **asserts on none of them**, with a control that the gate's own
  seed reproduces the placement CV exactly (it reads `0.0e+0`). That is `budget.json`'s
  `$screenshotEntropy_s17` move in its own words: *"an estimator arrives with the cases that hold
  it honest or it does not arrive."*
- **The brief's test, applied: 0.6 on this statistic rejects grid-with-jitter at 0.1 — and it also
  rejects seed 1340's perfectly ordinary dense window.** A bound that cannot tell those two apart
  is not repairable by choosing a different number for it. **THE REPLACEMENT IS A DIFFERENT
  STATISTIC** — clumping measured WITHIN the built city and at a scale smaller than a 128 m chunk,
  which is the scale `docs/authored-city.md` §1 actually describes (*"five restaurants on one block
  and none for the next three"*). That is a new instrument with its own derivation and its own
  falsifying cases. **It is the next session's item and the numbers above are the handover.**

**AT `d^0.50` THE GATE READS: CV 0.568 at seed 1337, median 0.583 over twelve, 8 of 12 below the
floor. It is RED and it ships red.**

### 4.3 WHAT WAS NOT RE-DERIVED, AND WHY

- **The occupancy registry.** Out of scope by the brief and nothing in it moved. §3.1 explains what
  the two overlaps are, that they are pre-existing, and that the repair — entering sign claims in
  the generator registry — would re-phase the whole city and invalidate the arm chosen in §0.
- **`band:noon`.** Green. §2.
- **`band:dusk`, `facadeAlbedo`, `facadeNeighbours`.** Red before this session and red after, on a
  camera in the origin block that this change does not reach.

---

## 5. `perfcheck` — THE COUNTS

Run as `--runs=1`, which the tool itself prints as **not the gate's verdict**. Every route breached
its GPU p95, GPU max and frame interval at `load1` 2.7 to 3.9 against a bar of 1.6 — frame interval
**62.6 to 117.9 ms against a 12.5 ms ceiling**. That is the machine, it is recorded, and **none of
it is attributed.** The counts are the admissible half and they reproduced EXACTLY across two
separate `highway_speed` invocations.

```
  route            s36 draws  s37 draws   s36 inst   s37 inst    s37 tris
  downtown_dense      332        340      164 182    212 490      1.76 M
  highway_speed       434        436      221 078    289 587      2.09 M
  night_rain          336        339      204 094    268 786      1.74 M
  player              324        331      164 182    212 490      1.72 M
```

**THE CONTENT READINGS, WHICH ARE PIXEL STATISTICS AND THEREFORE ADMISSIBLE:**

```
                                       s36        s37        bound
  downtown_dense mean luminance       0.0930     0.0967 ✓   min 0.08
  night_rain     mean luminance       0.0850     0.1139 ✓   min 0.08
  downtown_dense frame entropy         5.761      5.739 ✓   min 5
  night_rain     frame entropy         5.465      5.507 ✓   min 5
  highway_speed  triangles            1.71 M     2.09 M ✓   ceiling 2.36 M, re-derived — §4.1
  highway_speed  dark gap at ground     71% ✗   pass / 61%  min 75%   FLAPS between runs
  highway_speed  tone profile           52% ✗   56% / 52% ✗ min 75%
  highway_speed  body chromaticities      —      3 ✗        min 4
```

**`tone profile` HAS BEEN RED ON EVERY READING FOR SIX SESSIONS** — 66%, 59%, 61%, 52%, 52% — and
STATE 34 §5 already names the change that moves it, which is still not built. **`dark gap at the
ground` flapped again**, absent from one `highway_speed` run and 61% on the next taken twelve
minutes later, with the vehicle sample 16 and then 23. STATE 33, 34 and 35 all record this family
as one that flaps on a re-phase.

---

## 6. `inputcheck` — RED AT FOUR, AND IT IS STILL NOT THIS SESSION'S

Carried forward from STATE 36 §6 **unrepaired and by instruction**, and it goes at the top of §10
because a shipped control regression outranks everything else on that list.

```
  ✗ keyboard:walk   3.238 m/s   against PLAYER.walkSpeedMps 3.500      7.5% off, tol 6%
  ✗ keyboard:run    6.181 m/s   against PLAYER.runSpeedMps 7.000      11.7% off
  ✗ gamepad:walk    3.235 m/s   against 3.500
  ✗ gamepad:look  159.85 °/s    against PLAYER.maxLookRateDegPerS 180
```

The same four bounds and the same numbers to within 0.02 m/s and 0.6°/s of session 36's readings.
**Session 36 bisected it to `0f60c9a` — session 35's item 2, the signals and the vehicles — and
ruled out both the machine and collision.** All four are RATES measured against `ctx.get('time').now`
and all four under-deliver by 7.5–11.7%, one fraction on translation and rotation alike, which says
the player integrates less simulated motion per unit of `time.now` than it did. **What in `0f60c9a`
causes that is still a QUESTION.** It is one commit wide.

---

## 7. WHAT WAS NOT BUILT, AND WHY

- **The end-of-run gap, the quay's inverted power, haze, facade clutter, holograms, the remaining
  two vehicle devices, the 76 underived bounds and the sceneWalk streaming timeout** — out of scope
  by the brief. §1.4 and `citygen.js`'s `FRONTAGE_FILL` comment leave numbers on the first two.
- **The two delivered sign overlaps were diagnosed and not repaired.** §3.1.
- **`inputcheck`'s four reds were not touched.** §6, by instruction.
- **No quiet perfcheck battery.** `load1` never fell below 2.24 and the session was browser work
  from the second command onward, which is exactly what the project memory predicts of a session
  that renders.
- **No merge to main.**

---

## 8. WHAT WENT ON THE BRANCH

Branch `claude/noctis-36-frontage-fill`, from `47d92e4`, pushed.

```
  f825ad9  STATE 37, and the removal of an iCloud copy of citygen.js that git add -A committed
  380ce1a  LOOK.md §2 and §7 — the fill law ships at d^0.50, and the noon mechanism was mine
  0f06737  The triangle ceiling is re-derived against a MEASURED broken LOD; clumping is not
  60adb48  The frontage fill law goes to d^0.50, and the arm was chosen by looking
  34ef545  The fill law becomes a URL parameter, and the arm is bit-for-bit
  47d92e4  <- session 36's STATE, the branch point
```

> **AND A 368 kB COPY OF `citygen.js` GOT COMMITTED BY ACCIDENT, AND IT WAS FOUND BY A FILE
> COUNT.** `parsecheck` reported **109 files where every earlier run this session reported 108**,
> and the extra one was **`src/lib/citygen 2.js`** — an iCloud sync-conflict copy of the largest
> module in the project, carrying the OLD `power: 1.10`, created at 20:08 while `citygen.js` was
> being rewritten twice in a second for §1.4's paired depth measurement. `git add -A` swept it into
> `380ce1a`. Nothing imported it, so nothing rendered from it; it is removed in `f825ad9` and
> `parsecheck` is back to 108. **`/Users/martingrahn/Documents` is a synced directory, so `git add
> -A` on this machine can commit files nobody wrote** — and a second copy of `citygen.js` in
> `src/lib/` is precisely CONTRACT §9.1's failure mode, two files that have to be kept in step,
> sitting in the folder every module imports from. **The file count in `parsecheck`'s last line is
> the only thing that caught it.**

**TWO BUDGET NUMBERS EXIST WHERE ONE DID, AND ONE THRESHOLD MOVED.** `ceilings.triangles`
2 000 000 → 2 360 000 in `budget.json`, and its second copy in `src/core/constants.js`'s
`HUD.budgets` moved with it — §3.3 records that `gateaudit` caught the drift before this file was
written. `city-budget.json` gained a derivation and **no number**. `look-budget.json` and
`input-budget.json` are byte-identical to session 36.

`origin/main` still carries session 34's `b2ad696` and nothing after it — the repair STATE 34 §10
names is still one command and still the operator's:

```
git push --force-with-lease origin 2b04ace:main
```

---

## 9. KNOWN GAPS CARRIED FORWARD

**Unchanged from s8–s36**: `stats().cutoffM` hard-codes 0.8, the headroom probe inert,
`saturation-peak.png` overwritten every run, `$fovYDrift`, `camera.setRouteAt(name, 1.0)` at the
sky, rain streaks near-invisible wide at night, `rain_spray` 0 static, **right turns only**, sun
shadows to ~170 m, the bake blind to elevated slabs, the PMREM hitch, the too-red dawn horizon, one
worker at queue depth one, the far half of the river handing back to the night sky past ~300 m,
grime authored, the near-field washboard on the water, the quay wall inside the walkable mask,
props absent from the walkability mask, the 3.5°–10.4° route camera pitch, the frozen/running A/B,
`materials.display` drawn by nothing, the hauler's marker row buried inside its own body, the
seeding fallback's untested placement, **a bus never turns**, the origin block's absent occupancy
registry, `facadeAlbedo` on its floor with zero spread, the station's cores reading as an open
frame, **nobody can climb the station**, the 0.10 m margin at the core's outer face, `poseprobe`'s
blindness to the origin block, the pavement's missing kerb, `tools/city-budget.json:84`'s stale
`$derivation_count`, one merged building pool breaching the triangle ceiling, the station's platform
slab hiding the train, `traffic.js:2346`'s claimed draw-call margin of one, `minStraightness` and
`minArrivalsPerMinute` having no gate reader, the zero-second protected pedestrian phase, **44 100 m²
of the city is an empty concrete bowl**, `landmarkBlocks` still exported and still disagreeing with
the registry two ways, **the basin is walkable in the mask and unwalkable in the geometry**, the two
`walkableAt` sites still blind to a basin, the dish delivering 88 m of structure against a 62 m
keep-out, the quay walk's ulp exposure on four named chunks, and a gate message frozen in the
present tense of the session that wrote it.

**CLOSED THIS SESSION:**

- **`citycheck`'s 6.00% bright reserve, RED FOR SIX SESSIONS** — 6.37% and green, and what fixed it
  was more city. §2.
- **`night_rain` mean luminance**, red on both of session 35's readings — 0.1139 against a 0.08
  floor. §5.
- **`lookat` silently truncating any argument containing a second `=`.** §1.2.
- **"a floor on the noon mean is a ceiling on density"** — 161 buildings moved it 0.0000. §2.

**NEW THIS SESSION:**

- **THE GENERATOR'S OCCUPANCY REGISTRY CONTAINS NO `sign` CLAIMS.** 5 672 claims over the region in
  27 families and not one sign. The delivered census carries them and the generator census cannot,
  which is why that assertion has read 0 for thirty-six sessions. **Two delivered sign overlaps
  ship red**, and two of three other seeds already had one at session 36's law. §3.1.
- **`citycheck`'s DELIVERED overlap sweep is a sample, not a survey.** It reports 4 455 claims where
  a census at a different camera finds 4 781, and misses four `path × pond` overlaps at its own
  seed. §3.1.
- **`clumping`'s CV CORRELATES AT r = 0.92 WITH HOW MANY EMPTY CHUNKS ARE IN THE WINDOW.** It is a
  floor on parkland, which `negativeSpace` already asserts. §4.2.
- **THE TRIANGLE CEILING NEVER CAUGHT A BROKEN LOD**, at any point in this project's history — a
  defeated detail ring costs 1.278× and the ceiling stood at 1.8×. Now measured and re-derived. §4.1.
- **DEPTH AND FILL FIGHT, WITH A SIGN**: the fill raise cost 3.1 m of median depth and 48% more
  corner clipping. §1.4.
- **THE AERIAL FRAME IS NOT PERFECTLY REPRODUCIBLE**: two of nine renders of one identical city at
  one pose differed in bytes. §1.2.
- **`walkability` UNREACHABLE CELLS 1 → 216**, and no threshold reads it. §3.1.
- **THE DRAW-CALL CEILING STILL DOES NOT BIND** at 4.4× session 36's content raise. 436 of 440. §1.5.
- **`git add -A` ON THIS MACHINE CAN COMMIT A FILE NOBODY WROTE.** An iCloud sync-conflict copy of
  `citygen.js` was committed and then removed; `parsecheck`'s file count is what found it. §8.

---

## 10. WHAT TO DO FIRST NEXT TIME

1. **`inputcheck`, AND IT IS ONE COMMIT WIDE.** §6. Red since `0f60c9a`, which STATE 35 reported as
   green; bisected, load-independent, mechanism unknown. **It is the only gate in this project that
   went from green to red without anybody noticing, and it has now survived two sessions in that
   state.** A shipped control regression outranks everything else on this list.
2. **The two delivered sign overlaps, and the reason under them.** §3.1: the generator registry has
   no `sign` claims at all. This is the registry's own absolute authority not being exercised over
   an entire category of object, and it is red at the shipped law on two of three seeds tested.
   Expect entering sign claims to re-phase the city, so it is an item and not a patch.
3. **The clumping statistic, replaced rather than re-numbered.** §4.2 hands over twelve regions, a
   correlation of 0.92, the pooled arithmetic, and the reason a number cannot fix it. What is wanted
   is clumping WITHIN the built city at a scale smaller than a chunk.
4. **The end-of-run gap.** `rng.range(6, 26)` after every run of buildings, a mean of 16 m of
   frontage given away per run. It is the last knob that does not fight depth (§1.4), and island
   coverage stands at 38.4% against 95.0%.
5. **A quiet battery.** Every millisecond in the last five STATE files is inadmissible. This session
   never saw `load1` under 2.24 and it never will while it renders — this one needs the operator and
   `tools/quiet-gates.sh`.
