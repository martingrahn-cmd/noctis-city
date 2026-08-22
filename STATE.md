# NOCTIS — STATE

*End of session 38. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2 (24C101), `node v22.22.0`. The
machine has **NOT** rebooted since session 37 — 3 d 14 h of uptime at the first command against
session 37's 2 d 21 h, the same boot. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` WAS 2.55 AT THE FIRST COMMAND AND RANGED 1.75 TO 3.04 ACROSS THE SESSION***, against
CONTRACT §0.2's bar of **1.6**, and it was never once inside it. **SO NO MILLISECOND IN THIS FILE
IS ADMISSIBLE AS AN ABSOLUTE**, and none is quoted — `perfcheck` was not run. Every figure in §0
and §1 is a COUNT, a LENGTH or a RATIO of the two, read off `generateChunk` with no renderer
involved at all. The gate readings in §3 and §4 are counts and pixel statistics. All of it is
load-independent (CONTRACT §9 rule 6's corollary) and all of it reproduces exactly across runs.

---

## 0. THE FUNNEL

**THE ONE ITEM WAS: FOLLOW THE FILL NUMBER FROM THE LAW TO THE DELIVERED BUILDING.** It is
followed, every stage is counted inside the walk that performs it, and **the metres close to
0.000000 m**. Over `citycheck`'s own 10 × 10 region at seed 1337, at the shipped law
`fill = 0.12 + 0.88 · d^0.50`:

```
  THE COUNT FUNNEL — one candidate lot is one draw of `width`

    stage                                          n     surviving   of cands   step
    candidate lots drawn                        1429        1429      100.0%
      − too wide for the frontage left            94        1335       93.4%    0.934x
      − refused by the FILL ROLL                 306        1029       72.0%    0.771x
      − refused: no land between lot and water    54         975       68.2%    0.948x
      − refused: clipped under the minimum depth 296         679       47.5%    0.696x   <- LARGEST
      − refused: registry conflict, no clip        0         679       47.5%    1.000x
    DELIVERED BUILDINGS                          679         679       47.5%

  THE LENGTH FUNNEL — every metre of 34 727 m of walked island edge, in one bucket each

    standing behind a building              12 656 m   36.4%   679 x 18.6 m
    refused by the FILL ROLL                 7 017 m   20.2%   306 x 22.9 m   <- LARGEST LOSS
    refused by the depth clip                6 034 m   17.4%   296 x 20.4 m
    end-of-run gaps                          3 950 m   11.4%   261 x 15.1 m
    overrun — the side ABANDONED             1 591 m    4.6%    94 x 16.9 m
    lead-in at the head of each side         1 502 m    4.3%   332 x  4.5 m
    refused at the river bank                1 051 m    3.0%    54 x 19.5 m
    tail — the last 12 m never entered         586 m    1.7%   332 x  1.8 m
    gaps within a run                          340 m    1.0%   418 x  0.8 m
    registry refusal, no clip                    0 m    0.0%
    TOTAL                                   34 727 m  100.0%   RESIDUAL 0.000000 m
```

**WHERE THE LARGEST DROP IS DEPENDS ON WHICH FUNNEL, AND THAT IS THE RESULT.** In COUNTS it is the
depth clip at **0.696×** — larger than the fill roll's own 0.771×, and it is the registry, not the
law. In LENGTH it is the fill roll's own refusals at **20.2% of the island edge** — the law doing
exactly what it says, at a cost nobody had priced. The two funnels have different denominators and
different answers, and reading one as the other is CONTRACT §9's failure mode with a probability
and a length. That is why there are two.

**POOLED OVER TWELVE REGIONS (seeds 1337–1348, 16 551 candidate lots), because a step ratio read
off one region is one draw of a proportion:**

```
  step                            pooled     min     max
  survive the overrun test         0.934   0.918   0.943
  survive the fill roll            0.760   0.672   0.881     the law itself reads 0.762
  survive the river depth          0.944   0.896   0.969
  survive the depth clip           0.689   0.658   0.711     <- the largest drop, everywhere
  DELIVERED / candidates           0.462   0.371   0.524
  OCCUPANCY = builtM / island edge 0.354   0.284   0.401
```

### 0.1 THE LAW IS APPLIED EXACTLY AS WRITTEN. THERE IS NO LOSS AT THE ROLL

The candidate-weighted mean of `frontageFill(density)` over the region is **0.771**. The measured
pass rate of `rng.next() > fill` is **0.771**. The deviation is **0.0005** against a binomial 3 sd
of **0.0340**. Nothing is lost between the law evaluating and the roll being taken, and if the
session had found one thing it would have been that — it did not.

### 0.2 EVERY OTHER STAGE MATCHES ITS OWN DEFINITION, TO 3 se, OVER TWELVE REGIONS

`funnelprobe --laws`. Each row is a uniform the walk draws; DEFINITION is that uniform's mean.

```
  what is drawn                            n     measured   DEFINITION    delta    3 se
  lead-in    rng.range(0, 9)            3 852      4.517      4.500      +0.017   0.126
  width      rng.range(11, 27), all    16 551     19.005     19.000      +0.005   0.108
  fill refusal   width + range(1, 7)    3 711     22.771     23.000      -0.229   0.243
  hard refusal   width + range(0, 3)    4 102     20.481     20.500      -0.019   0.220
  within-run gap range(0.2, 1.4)        4 838      0.801      0.800      +0.001   0.015
  end-of-run gap range(6, 26)           2 802     15.932     16.000      -0.068   0.327
```

Two rows read outside, and both are the same fact. The **overrun** candidates average **22.162 m**
against 19.0 — but that test refuses a candidate FOR BEING TOO WIDE, so the +3.16 m is its
definition. Removing those 1 098 draws leaves a pool of 15 453 at 18.781 m, and the **delivered**
mean of 18.660 m stands **−0.121 m** from it against 3 se of 0.159 — inside. **Nothing else in the
walk selects on width.**

> **AND THE END-OF-RUN GAP IS WHY THAT TABLE IS POOLED.** At seed 1337 alone it reads **15.1 m
> against 16.0**, which is **2.4 sd** on 261 draws of a uniform whose own standard deviation is
> 5.8 m. Read as a verdict it is a defect in the largest gap law in the walk. Over twelve regions
> it is **15.932**, delta −0.068 against 3 se of 0.327. CONTRACT §0 rule 6, caught before it was
> written down as a finding rather than after.

### 0.3 THE ANSWER TO THE BRIEF'S QUESTION: 0.74 AND 0.268 WERE NEVER COMPARABLE, THREE TIMES OVER

The brief asked for this in one paragraph and it takes three sentences, because there are three
independent mismatches and each on its own is enough.

**They are different QUANTITIES.** `fill` is a Bernoulli probability applied once per candidate
lot: `if (rng.next() > fill) continue`. Frontage occupancy is a LENGTH ratio — union of building
projections over island edge. A probability of 0.74 that a 19 m lot is built on is not 0.74 of a
104.6 m side covered, and it cannot be, because **a refused candidate still consumes its own width
and a gap**. A candidate lot is 19.0 m of frontage by definition and consumes **24.3 m** on
average, built on or not.

**They are different LAWS.** 0.74 is `frontageFill(0.5)` at session 37's shipped `d^0.50`. 0.268 is
session 36's per-block median at `d^1.10`, which is a law session 37 replaced. At `d^1.10` the
law's own candidate-weighted mean over this region is **0.580**, not 0.74.

**They are different POPULATIONS.** 0.74 is the law at one density. 0.268 is a MEDIAN over 100
chunks — and **17 of those 100 are `lowDetail` and have no perimeter walk at all**, so no fill law
of any value can reach them and they enter the median as zeros. The like-for-like pairs are:

```
                                    law, candidate-weighted    delivered occupancy
  session 36's d^1.10                       0.580              0.285 walked / 0.268 per block
  session 37's d^0.50, ships                0.771              0.364 walked / 0.355 per block
```

**AND THE BRIEF'S SECOND NUMBER DESCRIBES A CHUNK THAT DOES NOT EXIST.** *"at d = 0.9 it evaluates
to 0.96"* — the arithmetic is right, `frontageFill(0.9) = 0.9548`. But over `citycheck`'s region
the density field runs **0.158 to 0.722**, and over a region sixteen times larger (40 × 40 chunks)
it peaks at **0.803**. The walked chunks run **0.300 to 0.722**, median 0.567. `d = 0.9` is a
density this generator does not produce.

---

## 1. WHAT THE FUNNEL TURNED UP THAT NOBODY WAS LOOKING FOR

### 1.1 THE WALK'S CEILING IS 0.431 OF THE FRONTAGE, AND A SATURATED CORE IS NOT A FILL QUESTION

At `fill = 1.0` — every candidate accepted, which is the most any law of any shape can ask for —
the delivered occupancy is **0.431 pooled over twelve regions (0.389–0.455)**, and 0.428 at seed
1337. The other 57% is:

```
  at fill = 1.0, of 34 727 m          |  at d^0.50, for comparison
    standing behind a building  42.8% |  36.4%
    registry (clip + river)     31.5% |  20.4%
    end-of-run gaps             13.6% |  11.4%
    overrun, abandoned           4.6% |   4.6%
    lead-in                      4.4% |   4.3%
    tail                         2.0% |   1.7%
    within-run gaps              1.1% |   1.0%
    the fill roll                0.0% |  20.2%
```

**EVERYTHING THE FILL LAW GIVES UP IS NOT HANDED TO THE STREET.** Taking the power 1.40 → 0.00 at
seed 1337 frees **654** candidate lots from the roll. **302 of them become buildings and 337 become
registry refusals.** The registry takes more than half of every relaxation.

**AND THE CORE IS WHERE THAT IS WORST**, which is the measurement that prices the brief's own
item (e). Delivered frontage occupancy per walked chunk, split at the quartiles of the chunk's own
density, pooled over eight regions:

```
  power    fill    occ Q1 sparse   occ Q2   occ Q3   occ Q4 CORE   Q4/Q1
   1.40   0.490       0.144        0.232    0.276      0.348       2.41x
   1.10   0.558       0.171        0.258    0.323      0.359       2.10x
   0.50   0.750       0.281        0.347    0.409      0.414       1.47x    <- ships
   0.00   1.000       0.458        0.487    0.488      0.470       1.03x
```

**THE CORE GAINS 1.35× ACROSS THE ENTIRE LAW AND STOPS AT 0.470. THE PERIPHERY GAINS 3.18×.**
So `0.12 + 0.88·d^p` is not failing to saturate the core because it has one parameter — **the chain
cannot saturate the core at any fill whatsoever**, because at `fill = 1.0` the core is already
refusal-bound at 0.470. A sigmoid with a sharp high-density transition can move the core at most
5.6 points, and it can only get there by giving the periphery what it currently withholds.

That is why item (e) was not attempted. It is in §6.

### 1.2 THE DEFECT: ONE STAGE ABANDONS THE SIDE WHERE A BUILDING FITS

Every refusal in the walk advances `t` past the candidate and keeps walking. **One does not.**

```js
const width = rng.range(11, 27);
if (t + width > side.to) { t = side.to; break; }     // ends the SIDE, not the candidate
```

The outer guard is `while (t < side.to - 12)` and the narrowest building this walk can draw is
**11.0 m**, so **a building fits in every one of these by construction**. Measured:

```
  sides walked                                 332
  sides that end this way                       94    28.3% of every side in the region
  frontage abandoned                         1 591 m   4.6% of the island edge
  room left when it fires   min 12.1 m   mean 16.9 m   max 24.6 m
```

It is 4.6% at every arm of the law — at `fill = 1.0` it is 91 sides and 1 601 m. **This is the one
stage that loses more than its definition explains**: its definition is *"this candidate is too
wide"* and what it does is give up the rest of the frontage.

**IT IS NOT REPAIRED, AND THE REASON IS THE ARM.** The fix is one line — advance and `continue`
rather than `break`. But the current path draws **no** random numbers, and any repair draws more
on those 94 sides, which re-phases every subsequent draw in the chunk's stream and moves every
building in the city. That discards the arm session 37 chose from nineteen frames, and re-choosing
it is a session. The brief's own rule: fix it only if the fix is smaller than the measurement was.
It is not. **The same `t = b.x1; break;` is in the quay walk**, which this funnel does not cover.

### 1.3 THE FINAL REGISTRY TEST IS UNREACHABLE, AND HAS BEEN SINCE SESSION 35

`refused: registry conflict, no clip` reads **0** at every arm and every seed. It is structural, not
lucky: with `DEPTH_DISTRIBUTION.clip` on, the clip branch has already tested the full-depth box and
either refused it or bisected `depth` down to a value it verified conflict-free, so the
`reg.conflict(site, …)` that follows can never fire. It costs one registry query per delivered
building and it is not wrong — it is dead. Turning the clip off (`--depth=band`) brings it straight
back to 10–26% of the frontage, which is what proves the two are one test.

### 1.4 THE CORNER CLIP IS NOT WHAT COSTS THE FRONTAGE — MEASURED, AND IT WAS THE OBVIOUS SUSPECT

The depth clip is the largest count drop, so the natural hypothesis is session 35's 40.6 m depth:
deep corner buildings blocking the sides walked third and fourth. **`funnelprobe --depth=band`
restores session 34's `rng.range(15, 26)` with no corner clip at all, and the occupancy barely
moves:**

```
  power    shipped depth    session 34's shallow depth, no clip
   1.40        0.259                    0.253
   1.10        0.285                    0.284
   0.50        0.364                    0.348
   0.00        0.428                    0.434
```

The refusals happen either way; the deep law merely reattributes them from the final test to the
clip branch, and **shortens** 114 buildings that the shallow law would have refused outright. So
the registry's 31.5% at the ceiling is not a depth artefact and cannot be bought back by making
buildings shallower.

### 1.5 WHAT REFUSES A CANDIDATE, BY KIND

`refused` in the chunk pools every refusal including props and the quay; this is the perimeter
walk's own, split by what the candidate met and whether the clip saved it.

```
  at d^0.50            REFUSED   KEPT (clipped shorter)   refused share
    building              143            91                  61%
    landmark               78            12                  87%
    water                  34            10                  77%
    block                  29             0                 100%
    deck                   12             1                  92%
    TOTAL                 296           114                  72%

  at fill = 1.0         REFUSED   KEPT                   refused share
    building              268            92                  74%
    landmark               93            15                  86%
    block                  44             0                 100%
    water                  41            15                  73%
    deck                   15             1                  94%
    TOTAL                 461           123                  79%
```

**`landmark` refuses 87% of what it meets and `block` refuses 100%.** Both are pads that extend
ALONG the frontage as well as into the lot, so no depth saves a candidate standing in one — the
clip can only shorten a building, never narrow it or move it. That is correct behaviour and it is
also the reason the clip's rescue rate is 28% rather than the near-100% its comment implies.

---

## 2. HOW IT WAS MEASURED, AND WHY IT IS IN `citygen.js` AND NOT IN `tools/`

`citygen.js`'s perimeter walk now carries a **`frontage` tally** beside the `refused` and `clipped`
tallies that have been there since sessions 21 and 35. `tools/funnelprobe.mjs` sums it and divides;
it computes nothing about the walk itself. A second description of that loop living in `tools/` is
CONTRACT §9.1's own arrangement — two things that have to be kept in step — and this file already
carries a comment about exactly that at `bodyAt`.

**THE TALLY IS INERT AND THAT IS ASSERTED, NOT CLAIMED.** No field draws a random number and no
branch was added, so the delivered city must be bit-identical.

```
  node tools/funnelprobe.mjs --identity
    buildings 689  signs 983  props 1589
    delivered digest  bc693636e24827b9c6de6b40a7f664dc49ef77d01cd2c5968b6710feec0b8b76
    pre-tally digest  bc693636e24827b9c6de6b40a7f664dc49ef77d01cd2c5968b6710feec0b8b76
    IDENTICAL — the frontage tally is inert.
```

The digest covers geometry, era, material, condition, facing, yaw and the retail/pillar/display
flags of every building, then every sign and every prop, over `citycheck`'s own region. It was
taken from the pre-tally file before the first counter was written. **`citycheck` independently
reproduces session 37 to the digit** — 5 672 generator claims, 4 455 delivered, CV 0.568, refusals
`building 157, landmark 79, water 34, block 29, deck 12, carriageway 5, pavement 2`, bright reserve
6.37%, walkability 55 109 of 55 325, the same two reds.

**THE FUNNEL CLOSES BY CONSTRUCTION AND THE RESIDUAL IS PRINTED EVERY RUN.** For every side,
`leadIn + Σ(each candidate's own advance) + tail == side length`, and the region-wide residual is
`0.000000 m`. A funnel whose stages do not sum to their parent is a list of numbers that happen to
decrease.

```
  node tools/funnelprobe.mjs                the funnel at the shipped law
  node tools/funnelprobe.mjs --sweep        seven arms, both funnels
  node tools/funnelprobe.mjs --stages       the step ratios pooled over twelve regions
  node tools/funnelprobe.mjs --laws         every gap law against its own mean, with 3 se
  node tools/funnelprobe.mjs --quartiles    what a denser law can buy, and where
  node tools/funnelprobe.mjs --transfer     fill in, occupancy out, per chunk
  node tools/funnelprobe.mjs --depth=band   session 34's depth, no corner clip
  node tools/funnelprobe.mjs --identity     the tally is inert
```

---

## 3. GATE STATE

Run individually, because `npm run gates` is `&&`-joined and stops at the first red. **Nothing in
this session changes any content, so every gate below is session 37's verdict re-measured** — which
is the point of running them.

```
  parsecheck   GREEN   109 files (108 + tools/funnelprobe.mjs), contract-clean
  faultcheck   GREEN   7 cases; quarantine surgical, frame survives all seven
  windcheck    GREEN
  citycheck    RED at 2 — clumping CV 0.568 and two delivered forbidden overlaps. Unchanged.
  lookcheck    RED at 3 — band:dusk, facadeAlbedo, facadeNeighbours. Carried from session 31.
  inputcheck   RED at 4 — carried, unrepaired by instruction. §4.
  gateaudit    NOT RUN — see below
  perfcheck    NOT RUN — `load1` never below 1.75; no millisecond would have been admissible
```

**`parsecheck` reads 109 where session 37 read 108, and the one file is the one this session
wrote.** That count is the only thing that caught the iCloud sync-conflict copy of `citygen.js`
last session, so it is checked deliberately: `git status --short` showed exactly
`M src/lib/citygen.js` and `?? tools/funnelprobe.mjs` at every commit, and **nothing was staged
with `git add -A`.**

```
  lookcheck    band:dusk 0.1395 against session 37's 0.1396, on an instrument whose run-to-run
               spread is 0.0001. band:midnight, band:dawn and band:noon all passed.
  citycheck    the two overlaps are still sign(pylon) x sign(pylon) 0.095 m2 and
               sign(adpillar) x prop(planter) 0.047 m2 — STATE 37 §3.1 has the diagnosis
```

**`gateaudit` WAS NOT RUN AND THAT IS A GAP.** It audits whichever arm last wrote
`tools/look-out/`, and `lookcheck` did run immediately before it would have. It was skipped because
no threshold moved this session and it costs a long run on a loud machine — but STATE 37's own
`gateaudit` caught a real threshold drift within a minute of it being created, so *"no threshold
moved"* is exactly the claim `gateaudit` exists to check rather than to be excused by. It goes on
§7's list.

---

## 4. `inputcheck` — RED AT FOUR, THIRD SESSION, STILL NOT THIS SESSION'S

Carried forward from STATE 36 §6 and STATE 37 §6 **unrepaired and by instruction**.

```
  ✗ keyboard:walk   3.236 m/s   against PLAYER.walkSpeedMps 3.500      7.5% off, tol 6%
  ✗ keyboard:run    6.183 m/s   against PLAYER.runSpeedMps 7.000      11.7% off
  ✗ gamepad:walk    3.231 m/s   against 3.500
  ✗ gamepad:look  160.12 °/s    against PLAYER.maxLookRateDegPerS 180
```

The same four bounds and the same numbers to within **0.005 m/s and 0.3 °/s** of session 37's
readings and session 36's before them — so it is stable, load-independent and reproducible. Session
36 bisected it to **`0f60c9a`**, session 35's item 2 (the signals and the vehicles), and ruled out
both the machine and collision. All four are RATES measured against `ctx.get('time').now` and all
four under-deliver by 7.5–11.7%, one fraction on translation and rotation alike, which says the
player integrates less simulated motion per unit of `time.now` than it did. **What in `0f60c9a`
causes that is still a QUESTION. It is one commit wide, and it has now been carried three times.**

---

## 5. WHAT WENT ON THE BRANCH

Branch `claude/noctis-38-fill-funnel`, cut from `1e83e7e` (the tip of session 37's
`claude/noctis-36-frontage-fill`), pushed. **No merge to main.**

```
  ddeff19  funnelprobe: the step ratios and the quartiles, pooled over regions
  c26c461  LOOK.md §2: the chain is walked and it closes, and the walk's ceiling is 0.431
  bbdbc13  The fill law is followed to a delivered building, and the chain closes to zero
  1e83e7e  <- session 37's tip, the branch point
```

**No threshold moved. No budget file was touched.** `budget.json`, `city-budget.json`,
`look-budget.json` and `input-budget.json` are byte-identical to session 37. The occupancy registry
was not touched. `clumping` stays red at 0.568 and no value was proposed for it — session 37
established none is honest.

**LOOK.md §2 gained one block** and it is a STATEMENT rather than a QUESTION because every number
in it was printed first, with the instrument and the population beside it, per §8.

`origin/main` still carries session 34's `b2ad696` and nothing after it — the repair STATE 34 §10
names is still one command and still the operator's:

```
git push --force-with-lease origin 2b04ace:main
```

---

## 6. WHAT WAS NOT BUILT, AND WHY — INCLUDING THE HALF OF THE BRIEF THAT WAS DECLINED

**ITEMS (e), (f) AND (g) — THE SIGMOID — WERE NOT ATTEMPTED.** The brief gates them:
*"THEN, ONLY IF THE FUNNEL IS CLEAN"*. Two things say not to.

1. **The funnel is not clean.** §1.2 is a stage that loses more than its definition explains, and
   the brief's own (d) calls that a defect.
2. **More importantly, (e)'s premise does not survive the funnel.** It asks for a law that delivers
   *"a saturated core AND a sparse periphery"* on the grounds that one parameter is too few. §1.1
   measures that the core saturates at **0.470 at `fill = 1.0`** — the ceiling of the request, not
   of the power law. A second parameter cannot buy what the chain does not sell. Building a
   sigmoid, sweeping it over seven arms, taking aerial frames at each and measuring every band
   three times would have cost the session and moved the core by at most 5.6 points, and the
   `d^0.50` arm session 37 chose from nineteen frames would have been re-phased to get it.

   **The honest version of (e) is a different item**, and it is §7.2.

**THE OVERRUN DEFECT WAS NOT FIXED.** §1.2 — one line, and it re-phases the whole city.

**`gateaudit` was not run.** §3.

**No quiet battery, no `perfcheck`.** `load1` ran 1.75–3.04 against a bar of 1.6. This session
rendered only what `citycheck` and `lookcheck` render, and still never saw the bar.

**Nothing else was started.** The item landed inside the session and the session stopped, which is
what the brief asked for.

---

## 7. WHAT TO DO FIRST NEXT TIME

1. **`inputcheck`, AND IT IS STILL ONE COMMIT WIDE.** §4. Red since `0f60c9a`, which STATE 35
   reported as green; bisected, load-independent, reproducible to 0.005 m/s across three sessions,
   mechanism unknown. **It is the only gate in this project that went from green to red without
   anybody noticing, and it has now been carried three times.** A shipped control regression
   outranks everything else on this list, and it has outranked everything else on this list twice
   without being done.

2. **THE THIRD KNOB IS NOW PRICED, AND IT IS THE ONE TO SPEND.** The end-of-run gap
   (`rng.range(6, 26)`) costs **11.4% of the island edge at the shipped law and 13.6% at the
   ceiling** — §0's length funnel. It is the largest loss that is neither the law nor the registry,
   it does not fight depth (STATE 37 §1.4), and unlike the fill law it is not against a refusal
   ceiling: it is 3 950 m of frontage given away by a constant. Halving it to `(3, 13)` is worth
   about 5 points of occupancy IF the freed frontage survives the registry — which §1.1 says is
   roughly a coin toss, so **measure it through `funnelprobe --sweep` before choosing a number**.
   Session 32 measured the gap at the OLD fill and found it worthless (*"374 buildings against
   366"*); at the current fill the walk is no longer rejection-dominated and that finding is stale.

3. **THE REGISTRY IS THE CEILING, NOT THE LAW, AND NOBODY HAS ASKED WHY A LANDMARK REFUSES 87%.**
   §1.5. The clip saves 28% of what it meets, and its comment implies it saves nearly everything.
   `landmark: 10` and the origin `block` pad extend ALONG the frontage, so the clip — which only
   shortens — cannot help. A candidate that could be **narrowed or slid** instead of shortened is
   the missing verdict, and it is worth 93 buildings at the ceiling. It is also the honest form of
   the brief's (e): the core is refusal-bound, so the way to a saturated core runs through the
   registry's verdicts and not through the fill law.

4. **The overrun.** §1.2 — 4.6% of the island edge, 28% of all sides, one line to fix, and a
   re-phase of the whole city to pay for it. Do it in the same session as (2) or (3), where the arm
   is being re-chosen anyway, and never on its own.

5. **The two delivered sign overlaps, and the reason under them.** STATE 37 §3.1: the generator's
   occupancy registry contains **no `sign` claims at all** — 5 672 claims in 27 families and not
   one sign. Red at the shipped law on two of three seeds tested.

6. **The clumping statistic, replaced rather than re-numbered.** STATE 37 §4.2 hands over twelve
   regions, a correlation of 0.92 with how many chunks in the window are empty, and the reason a
   number cannot fix it.

7. **`gateaudit`.** §3. Not run this session and it should have been.

8. **A quiet battery.** Every millisecond in the last six STATE files is inadmissible. This one
   needs the operator and `tools/quiet-gates.sh`.

---

## 8. KNOWN GAPS CARRIED FORWARD

**Unchanged from s8–s37**: `stats().cutoffM` hard-codes 0.8, the headroom probe inert,
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
slab hiding the train, `traffic.js:2346`'s claimed draw-call margin of one, **the quay walk's own
copy of §1.2's overrun at `citygen.js:6197`, uncounted by this funnel**, `minStraightness` and
`minArrivalsPerMinute` having no gate reader, the zero-second protected pedestrian phase, **44 100 m²
of the city is an empty concrete bowl**, `landmarkBlocks` still exported and still disagreeing with
the registry two ways, **the basin is walkable in the mask and unwalkable in the geometry**, the two
`walkableAt` sites still blind to a basin, the dish delivering 88 m of structure against a 62 m
keep-out, the quay walk's ulp exposure on four named chunks, **`walkability` unreachable cells at
216 with no threshold reading it**, **`tone profile` red on every reading for six sessions**, unread this session because
`perfcheck` did not run,, and
a gate message frozen in the present tense of the session that wrote it.

**NEW THIS SESSION — all of it measured, none of it inferred:**

- **THE FILL LAW IS APPLIED EXACTLY AS WRITTEN.** 0.771 in, 0.771 out, deviation 0.0005 against a
  binomial 3 sd of 0.0340. There is no loss at the roll. §0.1.
- **THE CHAIN CLOSES TO 0.000000 m** across ten buckets over 34 727 m of island edge, asserted
  every run. §0.
- **THE LARGEST COUNT DROP IS THE REGISTRY, NOT THE LAW** — the depth clip at 0.689× pooled over
  twelve regions (0.658–0.711), against the fill roll's 0.760×. §0.
- **THE LARGEST LENGTH LOSS IS THE FILL ROLL'S OWN REFUSALS**, 20.2% of the island edge, because a
  refused candidate consumes its width and a gap. The count funnel and the length funnel have
  different answers and that is the result. §0.
- **THE WALK'S CEILING IS 0.431 OF THE FRONTAGE**, pooled over twelve regions, 0.389–0.455. 57% of
  the island edge is unreachable by any fill law of any shape. §1.1.
- **A SATURATED CORE IS NOT A FILL QUESTION.** The densest quartile gains **1.35×** across the
  entire law and stops at **0.470** at `fill = 1.0`; the sparsest gains 3.18×. §1.1.
- **MORE THAN HALF OF EVERY RELAXATION GOES TO THE REGISTRY.** 1.40 → 0.00 frees 654 candidates;
  302 become buildings and 337 become refusals. §1.1.
- **THE OVERRUN ABANDONS THE SIDE WHERE A BUILDING FITS** — 94 of 332 sides, 1 591 m, 4.6% of the
  island edge, minimum room 12.1 m against a minimum building of 11.0 m. **A defect, not repaired.**
  The same shape is in the quay walk. §1.2.
- **THE FINAL REGISTRY TEST IN THE WALK IS UNREACHABLE** with the corner clip on, and has been
  since session 35. Reads 0 at every arm and every seed. §1.3.
- **THE CORNER CLIP IS NOT WHAT COSTS THE FRONTAGE.** Session 34's shallow depth with no clip
  delivers 0.348 against 0.364 at the shipped law, and 0.434 against 0.428 at the ceiling. §1.4.
- **`landmark` REFUSES 87% OF WHAT IT MEETS AND `block` REFUSES 100%**, because both pads extend
  along the frontage and the clip can only shorten. The clip's overall rescue rate is 28%. §1.5.
- **THE END-OF-RUN GAP READS 2.4 sd LOW AT SEED 1337 AND IS EXACT OVER TWELVE.** 15.1 against 16.0
  on one region, 15.932 pooled. It would have been written down as a defect. §0.2.
- **`d = 0.9` IS A DENSITY THIS GENERATOR DOES NOT PRODUCE.** The field peaks at 0.803 over a
  40 × 40 chunk region and at 0.722 over `citycheck`'s. §0.3.

**CLOSED THIS SESSION:**

- **"0.74 against 0.268" — never comparable, three times over**: different quantities, different
  laws, different populations. The like-for-like pair at the shipped law is **0.771 → 0.364**. §0.3.
- **"is there a loss between the law evaluating and a building standing on the street?"** — at the
  roll, no. Downstream, yes, and every metre of it is now attributed. §0.
