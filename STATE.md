# NOCTIS — STATE

*End of session 39. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2 (24C101), `node v22.22.0`. The
machine has **NOT** rebooted since session 38 — 4 d 2 h of uptime at the first command against
session 38's 3 d 14 h, the same boot. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` WAS 2.17 AT THE FIRST COMMAND AND RANGED 2.17 TO 4.28 ACROSS THE SESSION***, against
CONTRACT §0.2's bar of **1.6**, and it was never once inside it. **SO NO MILLISECOND IN THIS FILE
IS ADMISSIBLE AS AN ABSOLUTE.** `perfcheck` DID run this session — for its COUNTS, which are
load-independent (CONTRACT §9 rule 6's corollary) — and its three wall-clock reds are quoted in §7
only to be refused as evidence. Everything in §0 to §5 is a COUNT, a LENGTH or a RATIO of the two,
read off `generateChunk` with no renderer involved at all.

---

## 0. THE ONE ITEM: THE PERIMETER WALK'S CEILING

**IT WAS 0.431 OF THE FRONTAGE AND IT IS NOW 0.451.** Pooled over twelve regions of 10 × 10 chunks
(seeds 1337–1348), at `fill = 1.0` — every candidate accepted, which is the most any law of any
shape can ask for:

```
                                      session 38      session 39     range, 12 regions
  THE WALK'S CEILING, fill = 1.0         0.431           0.451        0.389–0.455 → 0.403–0.478
  at the shipped law d^0.50              0.354           0.371        0.284–0.401 → 0.296–0.425
  at seed 1337 alone, d^0.50             0.364           0.371
  delivered buildings, 12 regions        7 640           8 016        +4.9%
```

**NO CLAIM IN THE OCCUPANCY REGISTRY MOVED BY A MILLIMETRE.** The two repairs are both in the
WALK's response to the registry, not in what the registry protects — which is the answer to the
brief's item (c) and it is a measured answer, not a preference. See §3.

**THE ARM DID NOT MOVE.** `FRONTAGE_FILL.power` stays at **0.50**, re-chosen by looking after the
repairs exactly as session 37 chose it, from nineteen new frames over seven arms and three poses.
The district-contrast ratio at `d^0.50` reads **1.61×** on the repaired walk against session 37's
1.61× — the rule session 37 set (blocks read as solid AND contrast ≥ 1.61×) picks the same arm. §6.

### The frames from the re-chosen arm

```
  tools/shot-out/s39-airB-f050-t0_5649-wet.png    950 m over the region centre, fov 50
  tools/shot-out/s39-airA-f050-t0_5649-wet.png    session 35–37's own oblique aerial, fov 60
  tools/shot-out/s39-street-f050-t0-wet.png       1.9 m, midnight, wet, fov 55
```

Every arm is beside them as `f140 f110 f090 f070 f050 f030 f000`, one frame per arm per pose, taken
with `tools/lookat.mjs --params=fill=<power>` at seed 1337. `tools/shot-out/` is gitignored and
regenerable; the commands are in §6.

---

## 1. WHAT WAS VERIFIED BEFORE ANYTHING WAS TOUCHED — BRIEF ITEM (a)

**SESSION 38'S FUNNEL REPRODUCES EXACTLY, EVERY BUCKET AND EVERY POOLED RATIO.** Not approximately:
the same integers. `funnelprobe --overrun=abandon --refusal=step` is the walk as session 38
measured it and it is still one command away, so every "before" figure in this file was re-measured
this session rather than quoted from the last one.

```
  the length funnel at d^0.50, seed 1337, 34 727 m of island edge
                                            BEFORE (s38, re-measured)     AFTER
    standing behind a building              12 656 m  36.4%   679      12 874 m  37.1%   684
    refused by the fill roll                 7 017 m  20.2%   306       7 931 m  22.8%   347
    refused by the depth clip                6 034 m  17.4%   296       6 517 m  18.8%   364
    end-of-run gaps                          3 950 m  11.4%   261       4 001 m  11.5%   267
    overrun — the side ABANDONED             1 591 m   4.6%    94           0 m   0.0%    94  <- repaired
    lead-in at the head of each side          1 502 m   4.3%   332       1 653 m   4.8%   332
    refused at the river bank                1 051 m   3.0%    54       1 165 m   3.4%    59
    tail — the last 12 m never entered          586 m   1.7%   332         248 m   0.7%   332
    gaps within a run                           340 m   1.0%   418         339 m   1.0%   417
    registry refusal, no clip                     0 m   0.0%     0           0 m   0.0%     0
    TOTAL                                    34 727 m 100.0%          34 727 m 100.0%
    RESIDUAL                                 0.000000 m                0.000000 m
```

The funnel closes to **0.000000 m at all six combinations of the two repair arms**, which is what
says the freed metres went somewhere real rather than out of the accounting.

**AND THE POOLED CEILING REPRODUCES: 0.431 (0.389–0.455) over twelve regions**, by
`funnelprobe --stages --power=0`. So did the step ratios, the quartile table and the law's own
0.771 in / 0.771 out. Nothing in session 38 disagreed with the code.

> **ONE FIGURE IN SESSION 38 DID DISAGREE WITH THE CODE AND THE CODE WINS.** STATE 38 §7.3 says
> *"`landmark: 10` and the origin `block` pad extend ALONG the frontage"*.
> `BUILDING_SETBACKS.landmark` is `CITY.sidewalkWidth` = **4.2 m**, and the comment at it records
> the 10 as replaced in session 4 — *"strictly stricter despite being a smaller number"*, because
> the 10 was measured to a building's CENTRE. The sentence's conclusion survives; its number did
> not.

---

## 2. THE OVERRUN — BRIEF ITEM (b), AND IT IS REPAIRED IN BOTH WALKS

Session 38 §1.2: the walk drew `rng.range(11, 27)` without knowing how much frontage was left, and
when the draw did not fit it set `t = side.to` and **ended the side**. 94 of 332 sides, 1 591 m,
4.6% of the island edge, at every arm of the fill law. The outer guard is `t < side.to - 12` and
the narrowest building is 11.0 m, so a building fitted in every one of them by construction.

**THREE ARMS, MEASURED, POOLED OVER TWELVE REGIONS**, with the refusal arm held at what shipped so
the comparison is one change:

```
  WALK.overrun    occupancy d^0.50   the walk's CEILING   delivered   overruns
    abandon           0.354               0.431            7 640       1 098      <- session 38
    clamp             0.359               0.433            7 786       1 100      <- ships
    fit               0.357               0.430            7 807           0
```

- **`clamp`** cuts the drawn width to the frontage that remains — *the last lot on a block is what
  is left of it*.
- **`fit`** never draws a lot wider than what is left: `rng.range(11, min(27, room))`.

**`fit` DELIVERS 21 MORE BUILDINGS AND 0.002 LESS OCCUPANCY**, because its buildings are narrower.
Occupancy is a LENGTH and LOOK.md §2 asks for metres of street wall, so `clamp` ships. Both arms
draw exactly one uniform for `width`, at the same point in the stream, which is what makes this a
repair rather than a new law.

**AND AT SEED 1337 ALONE THE OVERRUN REPAIR READS THE OTHER WAY: 0.364 → 0.358.** One region is one
draw of a proportion and the repair re-phases every chunk it touches. The twelve-region estimate is
the one that resolves it (CONTRACT §0 rule 6). Both are printed here rather than the flattering one.

### 2.1 THE QUAY WALK HAD THE SAME LINE AND IT IS COUNTED FOR THE FIRST TIME

STATE 38 §8 carried *"the quay walk's own copy of §1.2's overrun at `citygen.js:6197`, uncounted by
this funnel"*. It is repaired and counted — `frontage.quayRuns` / `quayOverrun` / `quayDelivered`,
deliberately **not** in the length funnel, because that funnel's parent is the ISLAND edge and the
bank is a different frontage with a different length (two lengths in one denominator is CONTRACT
§9's own shape).

```
  over twelve regions      candidates   abandoned the run   metres at risk   delivered / region
    abandon                   1 892           106            1 793 m          5.33   sd 2.67
    clamp                     1 894            91            1 516 m          4.42   sd 1.51
    fit                       1 899             0                0 m          4.58   sd 1.31
```

**106 of 1 892 bank candidates — 5.6% — abandoned the run.** The delivered count moves 5.33 → 4.42
per region, **1.0 se on twelve regions: inside the spread, and not evidence in either direction**.
The abandonment is not inside anything.

---

## 3. THE PADS — BRIEF ITEM (c), AND THE PAD WAS NEVER THE THING

STATE 38 §1.5 named the pads: *"`landmark` refuses 87% of what it meets and `block` refuses 100%,
because both pads extend ALONG the frontage."* `tools/padprobe.mjs` is new this session and reads
the walk's own refusals **by owner and by geometry** rather than by kind, off an inert trace in
`citygen.js` (`FRONTAGE_TRACE`, off by default; the delivered city is bit-identical with it on).

```
  WHO REFUSES A PERIMETER CANDIDATE — citycheck's 10 x 10, seed 1337, d^0.50
    kind       refused  kept   refused%    metres   % of edge   owners
    building      143     91      61%      2 891.6     8.3%      70 chunks
    landmark       78     12      87%      1 597.8     4.6%       9
    water          34     10      77%        699.7     2.0%       1
    block          29      0     100%        609.8     1.8%       1
    deck           12      1      92%        235.5     0.7%       1
    TOTAL         296    114      72%      6 034.4    17.4%

    the five largest single owners
    landmark weir       46   2    96%   912.5 m   2.6%   <- the largest pad in the city
    water    river      34  10    77%   699.7 m   2.0%
    block    origin     29   0   100%   609.8 m   1.8%
    deck     viaduct    12   1    92%   235.5 m   0.7%
    landmark exchange    8   0   100%   186.0 m   0.5%
```

### 3.1 EACH OPTION THE BRIEF NAMED, MEASURED, AND THE FIRST TWO REJECTED WITH A NUMBER

**A NARROWER PAD — worth 6 refusals of 296.** `BUILDING_SETBACKS.landmark` is 4.2 m, one pavement
wide, so a landmark can be walked around rather than pressed against. **290 of 296 clip refusals
(98.0%) overlap the claim ALONG THEIR OWN FRONTAGE** — they are refused by the thing, not by the
margin around it. Taking the setback to zero could rescue at most the other six, and it would give
up the walkable ring the setback exists for. Rejected.

**A PAD THAT MATCHES ITS OWN SHAPE — worth 3 refusals and 54 m, 0.2% of the island edge.** The weir
is a 210 m disc claimed as a 210 m square and it is the largest single refuser in the city, so
claiming the disc looked like the repair: 21.5% of that claim, **9 464 m²**, is ground the basin is
not standing on. Measured, only **3 of its 46 refusals** have a footprint that clears the disc plus
the setback — the frontage that meets the weir meets it square on, not at a corner. Rejected, with
the number rather than on the argument.

> **AND THE OTHER ROUND LANDMARKS WERE DELIBERATELY NOT DECIDED.** A `cone` (the dish) overhangs a
> 13 m base with a 44 m crown, a `dome` (the exchange) sits on a drum, and a `hyperboloid` (the
> condenser) has a ground claim of half-width 50.8 m against its own 62 m base radius, because
> `landmarkOccluders` scales by 0.82 for the canyon bake. **That last one is an UNDER-claim and it
> is a question, not a finding**: it is the registry claiming less ground than the tower stands on.
> It goes on §11's list rather than into a repair at 02:00, because the conservative direction for
> an under-claim is to make it larger and this session had no mandate to remove frontage.

**A WALK THAT RESUMES ON THE FAR SIDE OF A PAD — worth 68 refusals and 701 m, 2.0% of the edge, and
it is what ships.** After a refusal the walk advanced `t += width + rng.range(0, 3)`, an advance
that knows nothing about where the thing that refused it ENDS. A 6 m pad and a 60 m pad cost the
same 20.5 m step, so the walk lands INSIDE the long one and refuses again — correct, the pad is
still there — and **PAST the short one, skipping clear frontage on the far side of it for nothing:
68 of 296 refusals, 701 m, 10.3 m at a time.**

It now lands at the claim's own far edge plus the gap it had already drawn, when that is NEARER
than the step would have been. Two guards, and both are the loop's invariant rather than taste:

- it only ever SHORTENS the advance, so no frontage is skipped that the shipped walk would walk;
- it must still advance `t` by at least **0.2 m** — the floor of `rng.range(0.2, 1.4)`, the smallest
  gap this walk puts between two buildings. Landing hard against a pad that refuses on a setback
  would otherwise refuse the same lot at the same `t` for ever.

```
  WALK.refusal    occupancy d^0.50   the walk's CEILING   delivered
    step              0.359               0.433            7 786
    resume            0.371               0.451            8 016     +3.0%
```

After the repair, refusals landing past the claim fall from **68 × 10.3 m to 119 × 3.5 m**, and the
3.5 m that remains is the walk's own gap draw, which is there so a building does not stand hard
against a pad.

### 3.2 WHAT IS STILL ON THE TABLE AND WAS NOT TAKEN

**A CANDIDATE THAT COULD BE NARROWED OR SLID.** The clip can only SHORTEN a building — never narrow
it, never slide it along the frontage — so a 19 m lot with 4 m of pad under one end is refused
whole. Measured: **51 of 296 refusals have 11 m or more of clear frontage before or after the claim
— 26 before (446 m) and 25 after (399 m), 845 m in all, 2.4% of the island edge.** That is an upper
bound on what a narrowing verdict could return, before the registry takes its share of it, and it
is the honest form of STATE 38 §7.3's *"missing verdict"*. Not attempted: it needs a second
registry query and a bounded retry inside the walk, and this session had two repairs and an arm to
re-choose. §11 item 2.

---

## 4. THE END-OF-RUN GAPS — BRIEF ITEM (d). THEY ARE A DEFINITION, AND IT CANNOT MAKE THE THING ITS OWN COMMENT NAMES

`rng.range(6, 26)` after the last building of every run of 1–4. Nobody had looked at them. Measured
at seed 1337 with both repairs in, by `padprobe --endgaps`:

```
  runs that ended with a gap      267    15.0 m mean    4 001 m    11.5% of the island edge
    mid-side, the walk goes on    188                   2 662 m     7.7%   <- a hole in a street wall
    at the end, the side stops     79                   1 338 m     3.9%   <- the last parcel before a corner

  the gap itself, in 4 m bins
     6–8   33      8–12  62     12–16  62     16–20  48     20–24  41     24–28  21
```

**THEY ARE A DEFINITION.** The walk's own comment says they are *"where the side alleys, the yards
and the blank end walls live"*, and they are deliberate: without them the perimeter is one
continuous extruded ring.

**AND THE DEFINITION DOES NOT MATCH ITS OWN COMMENT. NOT ONE OF THE 267 IS UNDER 6 m, BECAUSE 6 m
IS THE LAW'S OWN FLOOR.** An alley is 3–6 m; this law cannot produce one. Every gap in this city is
a yard, 78 of the 267 (29%) are wider than the mean delivered building of 18.8 m, and the width
that decides how many metres of street wall the city has is a constant with no derivation beside
it.

**WHAT IS NEW AND USABLE IS THE SPLIT.** STATE 37 §7.2 prices this knob at *"11.4% of the island
edge"* and calls it the one to spend. **7.7% is the part that reads as a hole in a street wall**;
the other 3.9% is the last parcel before a corner, where the side was going to stop anyway. So the
prize is smaller than the bucket, and a sweep should be judged against 7.7%.

**NOT CHANGED.** It is a look decision, STATE 37 §7.2 asks for the sweep first, and it would have
re-phased the city a third time in one session while the arm was already being re-chosen from
frames. §11 item 3.

---

## 5. THE RE-PHASE, HANDLED OPENLY — AND CONTRACT §6's NAMED STREAM DOES NOT REACH IT

The brief required this to be decided deliberately rather than discovered.

**NEITHER REPAIR DRAWS A RANDOM NUMBER THE WALK DID NOT ALREADY DRAW.** The clamp reuses the
`rng.range(11, 27)` the walk had drawn and cuts it; the resume reuses the `rng.range(0, 3)` the
refusal had drawn and lands earlier with it. There is no new draw at either decision point, and
that is asserted by the funnel closing to 0.000000 m at every arm.

**WHAT RE-PHASES THE CITY IS THE BUILDINGS THE REPAIR ADDS.** A lot that becomes a building draws a
depth, an era, a height and its signs from the chunk's own stream, and the ones that did not exist
before move every draw after them. **A named stream cannot help with that**: those draws have come
from the chunk stream since session 4, and moving them to a new stream would move every building in
the city rather than the ones this repair adds — which is the opposite of what CONTRACT §6's
guarantee is for. So the honest answer to *"draw new numbers on a named stream where the structure
allows it"* is that **the structure does not allow it here, and the reason is that the new numbers
are not the repair's, they are the buildings' own.**

**THE DETERMINISM CONTROL, RUN EITHER WAY.** Same seed twice, over `citycheck`'s own region,
digesting geometry, era, material, condition, facing, yaw and the retail/pillar/display flags of
every building, then every sign and every prop:

```
  run 1   b2e968ffb028e4d7cf76b08bab6034b920ff3ee35b333e63e7c6c1c77e467ecd   687 buildings
  run 2   b2e968ffb028e4d7cf76b08bab6034b920ff3ee35b333e63e7c6c1c77e467ecd   687 buildings
  IDENTICAL
```

And the instrument commit that opened the session is bit-identical to session 38's city:
`funnelprobe --identity` printed session 38's own pre-tally digest `bc693636…c0b8b76`, so the trace
and the arms were provably inert before either repair moved anything.

---

## 6. THE ARM, RE-CHOSEN BY LOOKING — AND IT DID NOT MOVE

Nineteen frames, seven arms, three poses, one seed, by `lookat --params=fill=`, the same three
poses session 37 used so that five sessions now stand in the same places:

```
A  node tools/lookat.mjs --pos=-180,230,700 --target=-330,0,460 --fov=60 --t=0.5649 --wet=1 \
     --name=s39-airA   --tag=f<power> --params=fill=<power>
B  node tools/lookat.mjs --pos=0,950,0      --target=-200,0,-200 --fov=50 --t=0.5649 --wet=1 \
     --name=s39-airB   --tag=f<power> --params=fill=<power>
C  node tools/lookat.mjs --pos=-250,1.9,256 --target=-60,10,256  --fov=55 --t=0.0    --wet=1 \
     --name=s39-street --tag=f<power> --params=fill=<power>
```

The seven aerial frames at pose B have seven distinct md5s, which is the check session 37 had to
add after `lookat` silently truncated `--params=fill=0.90` and delivered seven copies of one city.

### 6.1 THE NUMBER THE FRAMES ARE READ AGAINST, ON THE REPAIRED WALK

`fillprobe --districts` over the 963 `built` chunks of twelve regions — the median delivered island
coverage of the densest quarter over that of the sparsest:

```
  power   cov Q1 sparse   cov Q4 dense   CONTRAST      session 37's contrast
   1.40       14.8%          42.1%        2.84x              2.77x
   1.10       18.6%          45.1%        2.42x              2.38x
   0.90       22.9%          46.5%        2.03x              2.12x
   0.70       26.3%          49.4%        1.88x              1.93x
   0.50       32.4%          52.1%        1.61x              1.61x    <- SHIPS
   0.30       36.8%          53.8%        1.46x              1.43x
   0.15       42.0%          55.4%        1.32x
   0.00       48.0%          56.8%        1.18x              1.19x
```

**EVERY COVERAGE ROSE AND THE CONTRAST AT `d^0.50` DID NOT MOVE.** Q1 30.5% → 32.4%, Q4 49.3% →
52.1%, ratio 1.61× → 1.61×. The repair gave the sparse quarter and the core the same proportional
lift, which is what a repair to a REFUSAL should do and is the opposite of what the fill law does.

### 6.2 WHAT THE FRAMES SAY

Session 37's rule, unchanged: **the arm is the densest one at which the blocks still read as solid
AND the dense-over-sparse contrast stays at or above 1.61×.**

- **From the air (B), `f140` and `f110` are a loose scatter** — separate roofs with bare ground
  between neighbours, no block reading as a block. `f070` closes the south-west core but the north
  bank is still unfinished scatter.
- **`f050` is where nearly every block carries a near-continuous ring of roof around a courtyard,
  and the gradient still reads**: the far bank is visibly looser, the weir apron and the park strip
  are clear ground, the south-west core is the densest thing in frame.
- **`f030` flattens it** — the far bank fills in at the same rate as the core — and **`f000` is one
  carpet**, every block packed to the same degree, the only variation left being chunk KIND.
- **From the pavement (C) denser is better all the way to `f000`**, exactly as session 37 found: the
  street wall closes monotonically and there is no arm at which it stops improving. At `f050` the
  left side of the frame carries an unbroken lit wall to the mid-distance that `f110` does not.

**Two cameras, two answers, and 0.50 is where both still hold.** The contrast rule excludes 0.30
(1.46×) and everything below it; the frames exclude 0.70 and above. **The arm survives the repair.**

---

## 7. GATE STATE

Run individually, because `npm run gates` is `&&`-joined and stops at the first red.

```
  parsecheck   GREEN   110 files (109 + tools/padprobe.mjs), contract-clean
  faultcheck   GREEN   7 cases; quarantine surgical, frame survives all seven
  windcheck    GREEN
  gateaudit    RAN — first time in three sessions. Every perturbation case passes and all four
               --falsify suites are green. Its ONLY failure is the CONTROL, which is lookcheck's
               own four reds restated: "the unperturbed frames do not pass their own gate".
               NO THRESHOLD DRIFT was found.
  citycheck    RED at 4 — was RED at 2. §7.1
  lookcheck    RED at 4 — was RED at 3. §7.2
  inputcheck   RED at 4 — carried, unrepaired by instruction. §7.3
  perfcheck    RAN for its COUNTS on highway_speed, the binding route. Its three wall-clock reds
               are INADMISSIBLE: load1 was 4.28 against a bar of 1.6. §7.4
```

### 7.1 `citycheck` — RED AT FOUR, AND TWO OF THEM ARE NEW

```
                                  session 38        session 39
  clumping CV                       0.568             0.566      RED, floor 0.60, carried
  forbidden overlaps, delivered       2                 3        RED, max 0
  sign quads inside a building        0                 2        RED, max 0 — NEW
  bright reserve                    6.37%             6.00%      RED, floor 6.00% — NEW
  generator claims                  5 672             5 670
  delivered claims                  4 455             4 458
  walkability                  55 109 / 55 325   54 511 / 54 653
  registry refusals    building 157 → 190, landmark 79 → 102, block 29 → 40, water 34 → 31,
                       pavement 2 → 9, deck 12 → 9, carriageway 5 → 6
```

**THE TWO SIGN REDS ARE ONE DEFECT AND IT IS NOT THIS SESSION'S.** STATE 37 §3.1 established that
**the generator's occupancy registry contains no `sign` claims at all**, and that is verified again
here by grep: `citygen.js` has eight `claimBox` sites and their kinds are `building` ×2, `water`,
`path`, `landmark`, `feature`, `deck`, `block` — no sign, no prop. Nothing tests a sign against
anything, so WHICH signs collide is decided by wherever the stream happens to put them, and session
37 already recorded this gate as red *"on two of three seeds tested"* at the shipped law. **The
repair re-rolls it; it did not create the mechanism.** The third overlap is
`sign(adpillar) × prop(tree) 0.013 m²` beside the two session 38 carried.

**THE BRIGHT RESERVE IS AT ITS FLOOR AND THE MOVE IS BARELY RESOLVABLE.** `citycheck` pools it as
the median of three runs' means and printed **[6.32 6.00 6.00], spread 0.32 points**. The fall from
6.37% is **1.2× that spread**, and the breach of the floor is 0.00 points at the printed
resolution. **No threshold was moved** (CONTRACT §0 rule 5), and the re-derivation LOOK.md §7
allows was not attempted unattended on a floor this session's own change pushed against — but the
same §7 already lists this floor first among the ones *"derived under a camera veil session 27
removed"*, so it is on §11's list rather than accepted as a verdict.

### 7.2 `lookcheck` — RED AT FOUR, THREE RUNS, ZERO SPREAD

**THREE RUNS, BYTE-IDENTICAL IN ALL FOUR BANDS.** The brief asked for three and they resolve to
0.0000, better than the 0.0001 CONTRACT §0.2 quotes:

```
              run 1     run 2     run 3     band            session 38
  midnight    0.0752    0.0752    0.0752    [0.072, 0.112]   green
  dawn        0.3023    0.3023    0.3023    [0.299, 0.353]   green
  noon        0.4278    0.4278    0.4278    [0.428, 0.482]   0.4281 GREEN -> RED by 0.0002
  dusk        0.1392    0.1392    0.1392    [0.140, 0.180]   0.1395 RED   -> RED by 0.0008
```

**`band:noon` IS A NEW RED AND IT IS RESOLVABLE.** −0.0003 against an instrument whose run-to-run
spread this session is 0.0000. That is a real movement and it is reported as one.

**IT ALSO CONTRADICTS THE MECHANISM THREE BRIEFS CARRIED AND SESSION 37 WITHDREW.** Session 36
claimed more buildings mean more noon shadow; session 37 added 161 buildings and moved this band
by 0.0000. This session added far fewer and moved it by 0.0003. **So the band is not monotone in
building count** — it moves with which buildings stand where in one frame, and neither the old
mechanism nor its withdrawal explains this. It is a question, on §11's list, and **no number was
moved to make it green.** `facadeAlbedo` and `facadeNeighbours` are unchanged and carried from
session 31.

### 7.3 `inputcheck` — RED AT FOUR, FOURTH SESSION, STILL NOT THIS SESSION'S

Carried forward unrepaired by instruction, and the numbers are the same to within 0.002 m/s and
0.12 °/s of session 38's, session 37's and session 36's:

```
  ✗ keyboard:walk   3.238 m/s   against PLAYER.walkSpeedMps 3.500      7.5% off, tol 6%
  ✗ keyboard:run    6.180 m/s   against PLAYER.runSpeedMps 7.000      11.7% off
  ✗ gamepad:walk    3.231 m/s   against 3.500
  ✗ gamepad:look  160.24 °/s    against PLAYER.maxLookRateDegPerS 180
```

Bisected in session 36 to **`0f60c9a`**, machine and collision ruled out, mechanism still unknown.
**Carried four times now.**

### 7.4 `perfcheck` — THE COUNTS ARE ADMISSIBLE AND THE MILLISECONDS ARE NOT

`--route=highway_speed`, the binding route, at `load1 = 4.28` against a bar of 1.6:

```
  ADMISSIBLE (counts; CONTRACT §9 rule 6's corollary)      session 37       session 39
    draw calls          ceiling 440, floor 300                436              434
    triangles           ceiling 2 360 000, floor 940 000   2 086 042          2.09 M
    visible instances   floor 115 000                       289 587          295 103
    distinct materials  floor 48                                                 67

  INADMISSIBLE — quoted only to be refused
    gpu p95 27.65 ms, gpu max 47.48 ms, wall p95 71.50 ms against 12.5 ms
```

**THE TRIANGLE CEILING DID NOT BIND.** The brief warned it might: session 37 re-derived it from
2 000 000 to **2 360 000** with the delivered worst route at 2 086 042, leaving 13% of headroom.
The repaired city reads **2.09 M — unchanged at this instrument's printed resolution of 0.01 M** —
so the headroom is still 13%, and the +4.9% of buildings did not reach this route's visible set.
Draw calls fell by two.

**TWO SILHOUETTE REDS ARE ON CONTENT THIS SESSION DID NOT TOUCH.** *"68% of 71 vehicles have a dark
gap at the ground (min 75%)"* and *"52% carry a non-monotone tone profile (min 75%)"* — LOOK.md §4
records these as red at 73% and 63%. They are read off whichever vehicles the sampler caught in a
frame, on a machine at load 4.28, and the generator change cannot move a vehicle. Not attributed.

---

## 8. THE INSTRUMENT THAT WENT STALE THE MOMENT THE WALK WAS REPAIRED

**`funnelprobe --laws` PRINTED A FINDING THAT WAS AN ARTEFACT, AND IT WAS CAUGHT BY READING ITS OWN
OUTPUT.** After the overrun repair the row *"width of an overrun candidate"* read **4.878 m against
a definition of 19.0**, and the paragraph under it concluded *"Something else selects on width"*.

Both were one subtraction. The row was
`widthDrawnM − delivered − fillRefused − hardRefused`, which is the overrun's width **only while an
overrun candidate lands in no other bucket**. Under `clamp` it lands in one, so the subtraction
silently became the clamp's own loss. **This is CONTRACT §9's failure mode inside the instrument
written to name it.** The walk now stores `widthOverrunDrawnM` and the row reads **21.998 m against
19.0** — session 38's own +3.00.

Three rows are now outside their definitions BY DESIGN and the instrument says so before the table
rather than leaving it to be inferred:

- `refusal = resume` — a hard refusal advances to the LESSER of `width + rng.range(0, 3)` and the
  pad's far edge, so 20.5 m is an upper bound and the −2.333 m is **what the repair returns**;
- `overrun = clamp` — a clamped candidate carries a narrower width into whichever bucket it lands
  in, so every width row reads under 19.0. Exactly: **1 140 candidates cut by 5 561 m in total,
  394 of them delivered, carrying 1 981 m of that cut into the delivered row.**

And `--stages`'s row `survive the overrun test` is now `drawn width fitted, no clamp`, because
nothing is refused there any more.

> **THE POOLED LEAD-IN IS WHY THAT TABLE IS POOLED, AGAIN.** At seed 1337 the lead-in reads
> 4.98 m against a definition of 4.50 on 332 draws — **3.4 se, which read as a defect in the
> largest per-side law in the walk**. Over twelve regions it is **4.539, delta +0.039 against 3 se
> of 0.126**. Session 38 caught the same shape on the end-of-run gap. CONTRACT §0 rule 6, caught
> before it was written down as a finding rather than after.

---

## 9. WHAT WENT ON THE BRANCH

Branch `claude/noctis-39-walk-ceiling`, cut from `2c7de8d` (the tip of session 38's
`claude/noctis-38-fill-funnel`), pushed after every commit. **No merge to main.**

```
  72d1267  funnelprobe --stages: 'survive the overrun test' is not what that row measures any more
  052ef3f  funnelprobe --laws went stale the moment the walk was repaired, and it said so wrongly
  2e0e6c3  LOOK.md §2: the ceiling is 0.451, the pad was never the thing, and one of my own
           sentences was wrong
  8551e3b  padprobe --endgaps: the end-of-run gap cannot make the thing its comment names
  e642735  The walk resumes on the far side of a pad instead of stepping blindly past it
  935a138  The overrun no longer ends the side: the last lot on a block is what is left
  9766b3b  padprobe: which pad refuses a building, by name — and the walk is unmoved
  2c7de8d  <- session 38's tip, the branch point
```

**ONE REVERTIBLE COMMIT PER REPAIR**, and the two repairs are `935a138` and `e642735`: each is a
one-line change of a default in `WALK`, so either can be reverted on its own and the arms are still
there to measure with.

**No threshold moved. No budget file was touched.** `budget.json`, `city-budget.json`,
`look-budget.json` and `input-budget.json` are byte-identical to session 38. The occupancy registry
was not touched — not a claim, not a setback, not a forbidden pair. `clumping` stays red at 0.566
and no value was proposed for it.

**STAGED BY NAME AT EVERY COMMIT.** `git status --short` was read before each one and never showed
more than the files named in it; **`git add -A` was not used**, and `parsecheck` counted 110 files
where session 38 counted 109 — the one file being `tools/padprobe.mjs`. That count is the only
thing that caught the iCloud sync-conflict copy of `citygen.js` in session 37.

`origin/main` still carries session 34's `b2ad696` and nothing after it — the repair STATE 34 §10
names is still one command and still the operator's:

```
git push --force-with-lease origin 2b04ace:main
```

---

## 10. WHAT WAS NOT BUILT, AND WHY

- **The narrowed / slid candidate.** §3.2 — 51 refusals, 845 m, 2.4% of the island edge as an upper
  bound. It needs a bounded retry and a second registry query inside the walk; the session had two
  repairs, an arm to re-choose and a gate battery. Priced, not attempted.
- **The end-of-run gap.** §4 — measured and diagnosed, not changed, because it is a look decision
  and the arm was already being re-chosen.
- **The weir's disc, the setback, and every other pad change.** §3.1 — measured and rejected on the
  numbers. The registry is exactly as session 38 left it.
- **The condenser's under-claim.** §3.1 — a question about a solid, in the direction that would
  REMOVE frontage. Not touched at 02:00 by an unattended session.
- **`band:noon` and the bright reserve.** §7 — both red, both left red. LOOK.md §7's re-derivation
  is available and was not used, because a threshold re-derived by the session whose change
  breached it is indistinguishable from a threshold tuned green.
- **No quiet battery, no admissible millisecond.** `load1` ran 2.17–4.28 against a bar of 1.6.
- **Nothing else was started.**

---

## 11. WHAT TO DO FIRST NEXT TIME

1. **`inputcheck`, AND IT HAS NOW BEEN CARRIED FOUR TIMES.** §7.3. Red since `0f60c9a`, which STATE
   35 reported as green; bisected in session 36, machine and collision ruled out, reproducible to
   0.002 m/s across four sessions, mechanism unknown. **It is the only gate in this project that
   went from green to red without anybody noticing.** It has outranked everything on this list
   three times without being done.

2. **THE NARROWING VERDICT — the largest remaining honest gain in the walk.** §3.2. 51 refusals
   with 11 m or more of clear frontage beside the claim, 845 m, 2.4% of the island edge, and the
   pads stay exactly as they are. `padprobe` prints the population and `WALK` is where the arm
   goes. It is STATE 38 §7.3's *"a candidate that could be narrowed or slid"*, now with a number.

3. **THE END-OF-RUN GAP, AND THE PRIZE IS 7.7% AND NOT 11.5%.** §4. Sweep `rng.range(6, 26)`
   through `funnelprobe --sweep` before choosing a number, judge it against the MID-SIDE share, and
   do it in the same session as an arm re-choice because it re-phases the city.

4. **`band:noon` HAS NO SURVIVING MECHANISM IN EITHER DIRECTION.** §7.2. Session 36's *"more
   buildings mean more noon shadow"* was withdrawn by session 37 on +161 buildings moving it
   0.0000; this session moved it −0.0003 on far fewer. The band is 0.0002 below a floor whose own
   margin has been under its noise floor for four sessions. **Ask what it is actually measuring
   before moving anything.**

5. **The bright reserve at its floor.** §7.1. [6.32 6.00 6.00] against a floor of 6.00 and a spread
   of 0.32. LOOK.md §7 already lists this floor as derived under a camera veil session 27 removed.
   A re-derivation is owed, in the open, by a session that is not also the one that pushed it.

6. **The two delivered sign overlaps and the two sign quads inside a building, and the reason under
   all four.** §7.1 — **the generator's registry contains no `sign` claims and no `prop` claims**,
   verified by grep this session: eight `claimBox` sites, kinds `building` ×2, `water`, `path`,
   `landmark`, `feature`, `deck`, `block`. Until a sign is a claim, this gate's count is a lottery
   on the stream.

7. **The condenser's ground claim is NARROWER than the tower it stands for.** §3.1 —
   `landmarkOccluders` scales a hyperboloid's radius by 0.82 for the canyon bake and the registry
   claims those same boxes, so the claim's half-width is 50.8 m against a 62 m base radius. A
   building may stand where the tower is. **A question, not a finding**: it needs the solid's real
   footprint, and the answer removes frontage rather than adding it.

8. **The clumping statistic, replaced rather than re-numbered.** STATE 37 §4.2 hands over twelve
   regions, a correlation of 0.92 with how many chunks in the window are empty, and the reason a
   number cannot fix it. `citycheck` printed the twelve-region population again this session:
   median 0.574, min 0.249, max 0.964, **9 of 12 below the floor**.

9. **A quiet battery.** Every millisecond in the last seven STATE files is inadmissible. This one
   needs the operator and `tools/quiet-gates.sh`.

---

## 12. KNOWN GAPS CARRIED FORWARD

**Unchanged from s8–s38**: `stats().cutoffM` hard-codes 0.8, the headroom probe inert,
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
keep-out, the quay walk's ulp exposure on four named chunks, **`walkability` unreachable cells at
216 with no threshold reading it**, **`tone profile` red on every reading for seven sessions**, and
a gate message frozen in the present tense of the session that wrote it.

**CLOSED THIS SESSION:**

- **The quay walk's own copy of the overrun at `citygen.js:6197`** — repaired and counted. §2.1.

**NEW THIS SESSION — all of it measured, none of it inferred:**

- **THE WALK'S CEILING IS 0.451, NOT 0.431**, pooled over twelve regions (0.403–0.478), and the
  shipped law delivers 0.371 against 0.354. **No claim in the registry moved.** §0.
- **THE PAD WAS NEVER WHAT COST THE FRONTAGE.** 290 of 296 clip refusals (98.0%) overlap the claim
  along their own frontage, so a narrower setback is worth 6 refusals; the weir's disc instead of
  its bounding square is worth 3 refusals and 54 m. §3.1.
- **THE WALK'S RESPONSE TO A PAD IS.** 68 of 296 refusals landed past the claim that refused them
  and skipped 701 m — 2.0% of the island edge — beyond a pad rather than under one. §3.1.
- **`clamp` BEATS `fit` ON FRONTAGE AND LOSES ON COUNT**: 7 786 buildings at 0.359 against 7 807 at
  0.357. Occupancy is a length. §2.
- **THE QUAY WALK ABANDONED 106 OF 1 892 BANK CANDIDATES** over twelve regions, 1 793 m; its
  delivered count moves 1.0 se, inside the spread. §2.1.
- **NOT ONE END-OF-RUN GAP IS UNDER 6 m, BECAUSE 6 m IS THE LAW'S OWN FLOOR** — so the *"side
  alleys"* its comment names cannot exist, and **188 of 267 gaps (2 662 m, 7.7% of the edge) fall
  mid-side**, which is the part that reads as a hole. §4.
- **NEITHER REPAIR DRAWS A NUMBER THE WALK DID NOT ALREADY DRAW**, and CONTRACT §6's named stream
  cannot help with the re-phase, because the extra draws are the added BUILDINGS' own. §5.
- **THE ARM SURVIVES THE REPAIR.** Contrast at `d^0.50` is 1.61× before and 1.61× after, on twelve
  regions, while both quartiles' coverage rose. §6.1.
- **`funnelprobe --laws` PRINTED AN ARTEFACT AS A FINDING** and was repaired: an overrun candidate's
  width was recovered by subtraction, which stopped being that quantity the moment the walk clamped
  instead of abandoning. §8.
- **THE LEAD-IN READS 3.4 se HIGH AT SEED 1337 AND IS EXACT OVER TWELVE.** 4.98 m against 4.50 on
  one region; 4.539 pooled, delta +0.039 against 3 se of 0.126. §8.
- **`gateaudit` FOUND NO THRESHOLD DRIFT**, and its only failure is `lookcheck`'s own reds restated
  as its control. §7.
- **THE TRIANGLE CEILING DID NOT BIND**: 2.09 M against 2 360 000, 434 draws of 440, 295 103
  instances. §7.4.
- **`band:noon` IS RED BY 0.0002 ON AN INSTRUMENT WITH ZERO SPREAD OVER THREE RUNS**, and neither
  session 36's mechanism nor session 37's withdrawal of it explains the move. §7.2.
- **STATE 38 §7.3's `landmark: 10` IS STALE.** `BUILDING_SETBACKS.landmark` is 4.2 m and has been
  since session 4. §1.
