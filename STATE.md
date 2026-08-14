# NOCTIS — STATE

*End of session 28. **The machine HAS a GPU. Checked first, printed, recorded — §0.1.**
MacBook Air, Mac17,4, Apple M5, 10 CPU cores / 10 GPU cores, 32 GB, Metal 4.*

*The session was asked to be the other half of session 27's repair: session 27 cut the
camera glow that was carrying 61% of the night frame, closed four look reds and broke
one city floor, and this session was to put the real light back. **It built the light
and it measured that the light cannot do it.** Three content levers were added or
swept and none of them moves the floor that is red. That measurement is the session's
main product and §2 is the page to read.*

- ***THE OPERATOR'S OWN COMPLAINT IS ANSWERED AND THE GATE IS NOT.*** The streamed
  city's ground floors now light by FRONTAGE instead of by decade, and 190 advertising
  pillars stand on its pavements. Look at the frames in §0. The `citycheck` bright
  reserve is **unmoved** by both — 4.95% before, **4.83 / 4.97 / 4.65%** over three
  invocations after, against a 6.00% floor, inside its own run-to-run spread. §2.
- ***THE BRIEF'S THREE MAIN PREMISES WERE EACH CHECKED AND EACH WAS WRONG.*** Only one
  era has a lit ground floor → **two of four treatments were already lit, 50.5% of
  buildings** (§4). A new RNG roll will shift the city → **byte-identical, 7 851 rows,
  because a named stream cannot** (§4.2). Real luminaires will restore the reserve
  without lifting midnight → **on the streamed city the correct value is a DIMMING**
  (§3.3).
- ***THE 42.9× LAMP SPLIT IS CLOSED AS A STRUCTURE AND OPEN AS A VALUE, and both halves
  are measured.*** One derivation, one fixture description, two declared factors, a
  delivered-scene census and a one-way ratchet. Neither delivered value moved, because
  both arms of moving it are red: the origin block at 1952 takes `band:midnight` to
  **0.1187** against a 0.112 ceiling; the streamed city at 1952 takes the reserve to
  **3.56%**. §3.
- ***ITEM 4 WAS NOT BUILT, ON PURPOSE, AND THE ARM THAT SAYS SO IS RECORDED.*** +46
  street lamps (pitch 30 → 24 m) moved the reserve 4.87% → **4.50%**. No gain. The
  brief's own instruction: *if the bounds are already tight, DO NOT — say so and stop.*
  §6.
- ***THE FLOOR AND THE VEIL ARE ONE NUMBER AND NOBODY HAS RE-DERIVED THE FLOOR.***
  6.00% was derived in session 16 from a delivered 8.36% measured with
  `POST.glareStrength` at **0.15**. Session 27 took it to 0.010. The floor was
  calibrated against the very camera glow session 27 removed as a defect. **No
  threshold was moved here** — this is the finding, not a licence. §2.4.

Read `CONTRACT.md` before this file, and before any source file.

---

## 0. LOOK AT THESE FIRST, IN THIS ORDER

Every pair is the same seed and the same pose, the pose ray-tested with
`tools/poseprobe.mjs` **pinned to one distance** (`--dmin` = `--dmax`), which is the
discipline session 27 established after reading poseprobe's distance-aggregated
summary as an answer for one stand-off and landing 11 m from a 30 m wall.

| # | file | what changed | what it cost |
|---|---|---|---|
| 1 | `tools/shot-out/retail-{before,after}-t0.png` | The streamed city's ground floors. A run of frontage that was dark now trades — glazed, lit bays with people silhouetted against them and light on the pavement. | Nothing. Bright reserve 4.95% → 4.96%, `band:midnight` 0.1091 → 0.1091. Both inside their own noise. |
| 2 | `tools/shot-out/pillar-{before,after}-t0.png` | The advertising pillars, close. A tall slim emissive face in a dark frame, one white and one red, spaced along the pavement. | Nothing on either bound. 190 pillars, 570 boxes, **zero new draw calls**, zero forbidden overlaps. |
| 3 | `tools/shot-out/street-after-t0.png` (session 27's) beside `street-s28-t0.png` (today's, same pose) | **The frame the operator actually pointed at.** | **Essentially nothing changed, and that is the finding in a picture** — 0.145% of pixels moved by more than 4 code values, 0.148% in the left half. §0.2. |

Poses, so they can be reproduced exactly:

```
1  node tools/lookat.mjs --pos=371.01,1.74,-3.29 --target=340,3,8     --fov=55 --t=0.0
2  node tools/lookat.mjs --pos=316.31,1.74,-2.21 --target=305,2.2,9.1 --fov=50 --t=0.0
3  node tools/lookat.mjs --pos=70,1.74,0.9       --target=-70,1.0,-0.6 --fov=55 --t=0.0
```

### 0.2 THE DARK FRONTAGE THE OPERATOR POINTED AT IS IN THE ORIGIN BLOCK

He looked at frame 3 and said the left side of the street had a whole frontage with
almost nothing lit on it. That frame stands at x = 70 looking west, and **everything
near the camera in it is the ORIGIN BLOCK — `src/modules/block.js`** — which is a
hand-built ten-building set piece, not the streamed city. The near-left mass is the
block's building 4, a `blankPlinth`.

**Measured rather than argued**: today's head against session 27's frame at the same
pose and seed differs by **0.145% of pixels above 4 code values**, and by **0.148%
over the left half alone**. Everything this session built is somewhere else.

Everything this session built is in the **streamed city** (`citygen.js` / `city.js`).
That was a deliberate choice and it is measured rather than assumed: **the look gate's
midnight frame contains 0.0000 of the streamed city's lamp radiance to four decimals**
(§3.2), so the streamed city is where light can be added without spending the 0.0021
of `band:midnight` ceiling that is all this project has.

**So the honest statement to the operator is: the street you were shown is brighter,
and the street you pointed at is not.** Repairing the origin block's own ground floors
is a real and separable job — it is §8.1 item 2, and it is cheap — but it spends
`band:midnight` headroom directly, which is the one budget with nothing in it.

---

## 0.1 THE MACHINE — CHECKED, NOT ASSUMED

First commands of the session, because six consecutive briefs have carried a false
premise and every one was caught by checking rather than by reading:

```
$ system_profiler SPHardwareDataType   MacBook Air, Mac17,4, Apple M5
                                       10 cores (4 Super + 6 Efficiency), 32 GB
$ system_profiler SPDisplaysDataType   Apple M5 GPU, 10 cores, Metal 4, built-in
$ node --version                       v25.9.0
$ npx playwright --version             1.62.1
```

**The brief's premise is TRUE.** Every gate that reads a pixel ran here and printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M5, Unspecified Version)`.

---

## 1. THE ACCEPTANCE TEST, AND WHERE IT STANDS

The brief set two bounds that pull in opposite directions and asked for both after
every change. **Both were measured after every change and both are recorded below.**

First, a correction to how they were written. The brief gives them as one line —
*"saturation bright reserve ≥ 6.00% and ≤ 12%"* — and they are **two different pixel
populations**:

- **bright reserve** = median of per-run MEANS, fraction of `night_rain` pixels above
  0.5 HSV value. Floor `minBrightFraction` = 6.00%. **`citycheck` puts no ceiling on
  it at all.**
- **saturation peak** = median of per-run MAXIMA, fraction above 0.6 saturation **AND**
  0.5 value. Ceiling `maxFraction` = 12%, floor `minFraction` = 0.4%.

`glows ⊆ bright`. The 12% is on the saturated conjunct. Reported separately from here.

| after | bright reserve (≥ 6.00) | saturation peak (≤ 12) | `band:midnight` ∈ [0.072, 0.112] |
|---|---|---|---|
| **baseline** (s27 head 6f4990b) | **4.95%** [5.18 4.95 4.74] | 2.56% [2.56 2.14 3.03] | **0.1091** |
| item 1, the lamp split | 4.97% [4.59 5.19 4.97] | 2.97% | 0.1091 |
| item 2, retail decoupled | 4.96% [5.02 4.96 4.67] | 2.95% [2.62 2.95 2.98] | 0.1091 |
| item 3, the pillars | **4.87%** [4.54 4.87 5.00] | 3.01% [2.98 3.01 3.04] | **0.1091** |
| *(item 4 arm, reverted)* | *4.50% [4.17 4.81 4.50]* | *2.96%* | *—* |
| **FINAL, three invocations** | **4.83 / 4.97 / 4.65%** | 2.97 / 2.65 / 2.98% | **0.1091 / 0.1091 / 0.1092** |

The final row is three separate invocations, each of which is itself the median of
three fresh page loads — **nine route runs**, whose per-run means span **4.28% to
5.10%**. Against a baseline of 4.95%, the delivered 4.83% is a difference of 0.12
points inside a spread of 0.8. **The session's content changes left the bright reserve
unchanged within the instrument's own resolution**, which is the honest statement and
is the same statement as §2.

**THE INSTRUMENT'S OWN NOISE IS THE SAME SIZE AS THE DEFICIT, AND THAT IS A CONTRACT
§0.1 PROBLEM.** The bright reserve's run-to-run spread across today's eleven
invocations ran **0.23 to 1.04 points**, against a deficit of 1.05–1.13. So no single
`citycheck` invocation can resolve the change this session was asked to make, and
every number above is quoted with its three per-run values for that reason.

`band:midnight` is the opposite and it is worth saying: **0.1091 / 0.1091 / 0.1091,
spread 0.0000 over three baseline runs.** The look gate is deterministic to four
decimals, so its 0.0021 of ceiling headroom IS decidable. `band:noon` is not —
0.4289 / 0.4283 / 0.4283 against a 0.428 floor is a margin of 0.0003 on a spread of
0.0006, which CONTRACT §0.1 forbids deciding on. **Noon was not touched.**

**NO THRESHOLD MOVED.** `look-budget.json`, `budget.json` and `input-budget.json` are
byte-identical to session 27. `city-budget.json` gained one new bound (§3.4) and
changed none.

---

## 2. THE CENTRAL FINDING — THE BRIGHT RESERVE DOES NOT RESPOND TO CONTENT

This is the session's main product. The brief said that if the content genuinely
cannot satisfy both bounds, that is a finding to write up and *"the single most
valuable thing this session could discover"*. It cannot, and here is why in numbers.

### 2.1 Eight arms, one estimator

Every row is `citycheck`'s own estimator — the median of per-run means over three
fresh page loads, which is the pooled statistic CONTRACT §0.1 requires.

| arm | what it changes | bright reserve | |
|---|---|---|---|
| baseline | — | **4.95%** | floor 6.00 |
| origin-block bowl radiance → 0 | −16 emitters | 4.89% | −0.06 |
| streamed lamp radiance → 0 | −181 emitters | 3.99% | **−0.96** |
| streamed lamp radiance ÷ 4.61 | dimmer | 3.56% | **−1.39** |
| retail 50.5% → 73% | +82 lit ground floors | 5.00% | +0.05 |
| retail 50.5% → 60.7% *(shipped)* | +37 | 4.96% | inside noise |
| 190 ad pillars *(shipped)* | +380 faces at 748 cd/m² | 4.87% | inside noise |
| **lamps 181 → 227, pitch 30 → 24 m** | **+46 luminaires** | **4.50%** | **no gain** |

> **Removing lamp energy costs reserve; adding lamps does not gain it.**

That asymmetry is the auto-exposure signature and CONTRACT §5.4 names the mechanism:
scene luminance is a log-average clipped around the current adaptation, so new
emitters raise the meter, exposure falls, and the rest of the frame gives back what
the new emitters added.

### 2.2 Why, from the pixel distribution rather than from the argument

Value histogram of a delivered night street frame (`retail-after-t0.png`, 1.44 M px):

```
  value 0.00–0.15   77.83%  of all pixels
  value 0.30–0.50    1.90 points   <- everything a uniform lift could recruit
  value 0.40–0.50    0.53 points
  above 0.50         4.52%
```

The distribution is a large dark mass and a thin bright tail with **almost nothing in
between**. So the two ways of raising the reserve are not comparable:

- **A uniform lift** — which is exactly what veiling glare is — recruits the 0.10–0.15
  mass wholesale. Session 27's veil was worth **4.49 points** of this metric.
- **Localised emitters** brighten only their own pixels. Gaining 1.13 points needs
  1.13% of frame area covered above half-code, which is **more than the entire street
  lighting population of this city delivers** (0.96 points for all 181 bowls).

### 2.3 And the lamp lever is bounded twice, both bounds machine-checked

- **The near ring.** Lamps are built only on `near` chunks — `CITY.nearRadius` = 2, so
  25 chunks. Extending them to the detail ring (81 chunks) costs 2 draw calls a chunk:
  **+112 draws against a 300 ceiling** that the routes already run at 298–399.
- **The clustered light pool.** `budget.json` → `lightRoles`: 384 slots, 196 reserved
  for streetlamps, 96 traffic, 52 block, 12 stall — **margin 28**.

### 2.4 What this says about the 6.00% floor, and what it does not

`city-budget.json` → `$minBrightFraction_number` derives 6.00 from a delivered **8.36%
measured in session 16**, and the four reductions that block names as its motivation
begin with **`POST.glareStrength` 0.15 → 0.075**. Session 27 took that constant to
**0.010** and the veil's 4.49 points went with it.

> **The floor was calibrated against a frame whose mid-tone was 61% camera glow — the
> very thing session 27 removed as a defect. The floor and the veil are one number and
> nobody has re-derived the floor since the veil was cut.**

**This is not a licence to move it.** CONTRACT §0 rule 5 and the brief both forbid it,
and nothing here moved it. It is the finding, and it is the same shape as STATE 27
§8.3 item 1 (the two luminance bands, re-centred on session 2's content and never
re-derived): **a threshold that outlived the frame it was derived from.** Three of
this project's live reds are now instances of that one sentence.

---

## 3. ITEM 1 — THE LAMP SPLIT. Closed as a structure, open as a value.

`src/core/constants.js` → `LAMP_BOWL`, `src/lib/luminaire.js`, `tools/citycheck.mjs`.
Commit `755423c`.

### 3.1 The three numbers, verified from the project's own code first

```
A = 2πR²(cos 63° − cos 180°),  R = 0.42   = 1.6115 m²    (contract said 1.6115)
Φ = luminaireFlux(6800, LUMINAIRE)        = 9883.5 lm     (contract said 9883.5)
L = Φ / (π·A) = 9883.5 / 5.0627           = 1952.19 cd/m² (contract said 1952)
```

`9000 / 1952.19 = 4.6102×` · `1952.19 / 210 = 9.30×` · `9000 / 210 = 42.86×`.
Both files build the **same** bowl; only the tessellation differs (12×8 and 8×6).

### 3.2 Which path lights which camera — measured by zeroing each in turn

| path zeroed | look `band:midnight` | citycheck bright reserve |
|---|---|---|
| origin block (`EMISSIVE.lampBowl` 210) | 0.1091 → **0.1061** (−0.0030) | 4.95% → 4.89% (−0.06) |
| streamed city (`streetlampNits` 9000) | 0.1091 → **0.1091** (−0.0000) | 4.95% → 3.99% (**−0.96**) |

STATE 27's claim holds and is sharper than it was written: **the streamed city's lamp
bowls do not reach the look camera at all**, and the bright reserve is a streamed-city
measurement by **16:1** — despite `night_rain` running x = 300 → −400 straight through
the origin block (|x| ≤ 168), which contributes 0.06 points of it.

### 3.3 Why 1952 cannot ship on either path, and it refutes the brief

| arm | look `band:midnight` | bright reserve |
|---|---|---|
| shipped (210 / 9000) | 0.1091 ✓ | 4.95% ✗ |
| origin block 210 → **1952** | **0.1187 ✗ RED** (ceiling 0.112) | — |
| streamed city 9000 → **1952** | 0.1090 | **3.56% ✗** [3.49 3.56 3.56] |

The brief expected *"real luminaires restore the bright reserve WITHOUT lifting the
midnight mean much"*. Neither half holds:

- **On the streamed city the correction is a DIMMING** (÷4.61). It costs **1.39
  points** of a reserve already 1.05 short, taking the deficit to 2.44. The only path
  the reserve can see is the one where the correct value subtracts light.
- **On the origin block it is a 9.30× brightening** worth **+0.0096** of midnight mean
  against **0.0021** of ceiling — red by 0.0067, i.e. 4.6× the room that exists.

Session 18 wrote the same sentence about the city side. This is the first time it has
been measured from both ends at once, and the block side is **blocked on the same
`band:midnight` ceiling STATE 27 §8.3 item 1 already named as this project's first
open question.** They are one question.

### 3.4 What was repaired, since the value could not be

- **`lib/luminaire.js`** gains `bowlZoneAreaM2` and `bowlRadianceNits`. Pure.
- **`constants.js` → `LAMP_BOWL`** holds the fixture's geometry, derives Φ/(π·A) from
  `streetlampCandela` and `LUMINAIRE`, and expresses BOTH delivered radiances as
  declared factors of it. **Change the lantern and both bowls follow**; before, both
  went stale in opposite directions in silence.
- **Both emitters build the bowl from `LAMP_BOWL`**, so the area in the derivation
  cannot diverge from the area on the screen. `city.js`'s boot log loses a hand-copied
  `1.6115`.
- **`city-budget.json` → `lampBowl` is a RATCHET** on the two departures: it sits at
  today's measured error and **may only ever move toward 1.0**. The shape of
  `minBrightFraction` and `floors.visibleInstances`, with an error instead of a count.
- **`harness.lampBowlCensus()`** reads the delivered materials and geometry off the
  live scene; `citycheck` runs the ratchet over it and prints derived and delivered on
  one line. Five falsifying cases. `citycheck --falsify` **61/61, coverage 100%**.

Delivery-neutral, checked rather than claimed: the factors are quoted at the precision
that reproduces what shipped (9000.00022 and 209.99992).

### 3.5 The geometry check caught a defect in itself, in its first hour

three's `phiStart/phiLength` is the **azimuthal** sweep; `thetaStart/thetaLength` is
the polar one. `LAMP_BOWL` named the polar pair `phi`, built the geometry correctly
anyway (the values went into the theta slots), and the census then compared three's
azimuthal 0 and 2π against 0.35π and 0.65π. **Two angles, one letter apart** — CONTRACT
§9 rule 7 inside the instrument written for §9 rule 7 (§7.7). Both pairs are now named
and both are checked, because the full revolution is an assumption `bowlZoneAreaM2`
makes and nothing was testing it.

---

## 4. ITEM 2 — RETAIL IS A PROPERTY OF THE STREET. Commit `cd57f62`.

`CITY_ERAS[*].ground` decided both what a ground floor LOOKS like and whether it is
LIT. Those are independent facts: the architecture is when the building went up, the
commerce is which street it stands on.

### 4.1 The brief's premise, corrected by measurement before anything was built

Over the gate's own 10×10 region, 366 buildings:

```
  postwar              30.6%   blankPlinth   dark
  infill+contemporary  27.6%   recessed      LIT
  prewar               23.0%   shopfront     LIT
  corporate            18.9%   colonnade     dark
```

**TWO of the four treatments were already lit, not one** — `buildGroundFloor`'s
`recessed` case falls through to the glazed-bay branch — so **50.5% of buildings
already presented a lit ground floor**, not the one-in-five the brief expected. The
lever is real and half the size it was thought to be.

### 4.2 The roll is per FRONTAGE, and the determinism control refutes the brief

A per-building roll gives salt and pepper: every street half-lit, none dark, none
bright. Real cities have shopping streets and, round the corner, terraces with nothing
at street level — which is literally the operator's complaint. **A model that cannot
produce a dark frontage cannot produce a bright one.** So each SIDE of each island
rolls once and its buildings inherit it; outside a retail frontage what survives is
the corner shop, at the end of the run where the cross street is.

The brief warned that a new roll would shift everything downstream. **It shifts
nothing.** `retailRng` is its own named chunk stream and CONTRACT §6 makes streams
independent. A dump of every building, claim, prop and sign over the region — **7 851
rows at full precision — is BYTE-IDENTICAL before and after**, and byte-identical
between two runs at the same seed.

### 4.3 Every treatment now carries both variants

```
  shopfront   + tall glazed bays, slender piers, stallriser   − the same piers, bays infilled
  colonnade   + lit bays behind the piers, piers UNCHANGED    − a dark covered walk
  blankPlinth + openings PUNCHED in the sockel, no pilasters  − solid base, one service door
  recessed    + glazed bays under the soffit                  − solid wall under the soffit
```

Delivered **60.7%**, spread across all four (blankPlinth 56.3%, colonnade 72.5%,
recessed 65.3%, shopfront 51.2%) instead of 100% of two and 0% of two. That spread
**is** the decoupling, stated as a number.

The probabilities are bounded rather than chosen: floored at *"no less lit than the
model being replaced"* (50.5%) and ceilinged by architecture rather than by light,
because the light budget was measured not to bind at any setting (§2.1).

### 4.4 The colonnade recess was wrong and the delivered frame caught it

The piers already stand 0.45–1.35 m proud, so *behind the piers* is delivered by the
piers, not by pushing the glass back. The first draft set the glass **0.92 m inside the
building** — 1.37 to 2.27 m behind the pier face — and the bays were invisible from the
street. CONTRACT §9 rule 7, a recess measured from the wrong plane and applied twice.
Corrected: the delivered frame's mean delta over changed pixels went **8.3 → 53.0**
code values at the same pose.

---

## 5. ITEM 3 — THE ADVERTISING PILLARS. Commit `325e38c`.

190 over the resident ring, on the pavement, three dark boxes and two emissive faces
each at 748 cd/m². The operator asked for futuristic; futuristic here is the light
doing the work, which is the vocabulary this city already has.

- **Declared before it was drawn.** Tests `chunk.occluders`, `BLOCK_KEEPOUT` and every
  claim already in `placed` — through `occupancy.js`'s **own** `mayOverlap('sign', …)`
  rather than a private list of categories, because there is one occupancy (§9.1).
  Runs AFTER the signs and props so the list it is tested against is full. **Refused,
  not moved.** Delivered sign claims 35 → 225, **zero new forbidden overlaps**.
- **The claim is the BASE, not the column.** The base is 1.40 × 0.74 m and the column
  1.04 × 0.44, so claiming the column would under-claim by 0.36 m on one axis and 0.30
  on the other — session 24's own finding, which recorded a 2.4 × 0.06 m panel as a
  2.4 × 2.4 m square. Folded through the pillar's own yaw by the |cos|·L + |sin|·W
  expression `paint()` and the pylon claim already use. The vertical extent is the
  **brow's** top, not the column's.
- **Spaced along the frontage, and the first version was not.** One roll per building
  delivered **1.1 pillars per 128 m chunk** — one every 450 m of frontage, which nobody
  would see two of. `AD_PILLAR.perFrontageM` = 19 m, the generator's own median
  building width. 132 → 190.
- **Aware of the retail roll**, as the brief required: p = 0.85 + density·0.35 where the
  frontage has no shops, 0.34 + density·0.35 where it trades.
- **No new draw call.** Dark boxes ride in the chunk's box mesh, faces in its window
  mesh at a tint of `PILLAR_FACE_NITS / LIGHT.windowNits`, so the delivered radiance is
  named in the expression rather than hidden in a multiplier.

**And it found a dead material.** `materials.display` — *"a display panel is a
window-sized emitter, not a neon tube"*, 900 cd/m² — is created, patched by
`lights.patch` and tracked in `city.js`, and is **drawn by nothing**: it appears in no
`addInstanced` call and nowhere else in the file. §9.1's config-the-code-does-not-read
with a material. Not deleted here — that is its own revertible change. §8.2.

---

## 6. ITEM 4 — NOT BUILT, AND THE ARM THAT SAYS SO

The brief: *"If items 1–3 land and the bright reserve is comfortably inside [6%, 12%]
… add luminaires. If the bounds are already tight, DO NOT — say so and stop."*

The arm was measured rather than argued: lamp pitch 30 m → 24 m — which is 3.0×
mounting height and inside the standard band for this optic, where 30 m is above it —
took the delivered lamps **181 → 227** and the bright reserve **4.87% → 4.50%**. No
gain, inside a 0.64-point run spread. **The arm was reverted; the working tree is
clean.**

Two hard bounds sit behind that result and both are machine-checked (§2.3): the near
ring's draw-call cost and the clustered light pool's margin of 28 slots.

---

## 7. GATE STATE

**Each gate was run individually rather than through `npm run gates`**, because that
chain is `&&`-joined and stops at `lookcheck` — so a red early gate hides the state of
every gate after it, which is how session 27 ended with `gateaudit` and `perfcheck`
unreported.

**Three invocations of the two gates carrying the acceptance test, one of the rest,
and the asymmetry is CONTRACT §0.1 rather than laziness.** `lookcheck` and `citycheck`
pool noisy pixel statistics and their spreads are the whole question here, so they were
run three times (nine route runs inside `citycheck`). `parsecheck`, `faultcheck`,
`windcheck` and `inputcheck` are deterministic pass/fail over counts and parses —
§9 rule 6's corollary is that counts do not drift, so a second identical run measures
nothing. `perfcheck` was run once because its milliseconds are inadmissible at this
machine's load whatever the count of runs (§7.2), and repeating an inadmissible
measurement three times does not admit it.

```
  parsecheck   GREEN   92 files
  faultcheck   GREEN
  lookcheck    RED AT 2   both red on main before session 27; neither caused here
  windcheck    GREEN
  inputcheck   GREEN
  citycheck    RED AT 1   the bright reserve, 4.83 / 4.97 / 4.65% over three
                          invocations against a 6.00% floor. §2. The ONLY red this
                          session's work is downstream of, and it was already red at
                          session 27's head (4.95%)
  gateaudit    RED AT 3   ALL THREE ARE lookcheck's two reds, restated. §7.1
  perfcheck    RED AT 8   FIRST RUN EVER ON THIS MACHINE, AND NOT ADMISSIBLE. §7.2
```

**`npm run gates` does not exit 0, and this session is not reported complete.**

The two `lookcheck` reds are unchanged, both carried from before session 27 and both
diagnosed there:

- **`distinct:midnight|dusk`** 0.02536 against 0.03. Closable only by cutting glow
  further, which `band:noon`'s floor blocks — the coupling STATE 27 §5.1 records.
- **`midPatchSample:midWallPanel`** 0.54 against 0.45. A **stale sample rect**, not
  content, and it suppresses two assertions downstream of it. `look-budget.json`'s own
  note authorises re-deriving it. **Still the cheapest green in the project.**

### 7.1 `gateaudit` — three failures, all of them the same two

```
  ✗ control failed
  ✗ midAlbedoClusters did not run on the control frames
  ✗ midAlbedoSeparation did not run on the control frames
```

All three are `lookcheck`'s reds arriving one layer up: the control frames are red, and
the two suppressed assertions are the ones the stale `midWallPanel` rect blocks.
**Every `--falsify` self-test underneath it passed**, which is the part that says the
gates themselves are healthy:

```
  perfcheck --falsify   74/74 rejected, 72 failure sites, coverage 100%
  citycheck --falsify   61/61 rejected, 61 failure sites, coverage 100%   (5 new here)
  inputcheck --falsify  13/13 rejected, coverage 100%
  windcheck, lookcheck  green
```

### 7.2 `perfcheck` — run for the first time on this machine, and NOT ADMISSIBLE

Nothing in this project has had a millisecond measured since session 20, and
`budget.json` → `machine.series.m5` is still an empty slot — so the ceilings these
routes were compared against were derived on a different machine.

**AND THE MACHINE WAS NOT QUIET.** Measured immediately after the run, `LC_ALL=C`:

```
  load averages: 2.31 3.55 3.35        against CONTRACT §0.2's bar of 1.6
  searchpartyuseragent 20.7% CPU, searchpartyd 13.8%   — Apple's, not ours
```

CONTRACT §0.2 admits an absolute only from a load at which the instrument's spread has
been measured. **So none of the four frame-interval reds is a verdict**, and the run's
own spreads say the same thing without reference to the bar:

```
  downtown_dense  13.30 ms > 12.5   breach 0.80   spread 1.7 ms   breach is 47% of the spread
  night_rain      13.20 ms > 13.0   breach 0.20   spread 1.4 ms   breach is 14% of the spread
  player          14.00 ms > 12.5   breach 1.50   spread 0.3 ms
  highway_speed   9.20 ms — inside its ceiling
```

That is CONTRACT §0.1's original incident, verbatim, on three routes at once.

The other four reds are **carried and diagnosed**: the stop-line floor at 10.45 to
13.48 m past the line on four routes, which STATE 25 §3 and CONTRACT §9 rule 7's s25
entry establish is **a datum disagreement rather than a vehicle in a junction** — the
queue measures from the junction mouth and the assertion from the stop line, 9.0 m
apart. The eighth is `highway_speed`'s vehicle tone profile at 71% against 75%, on
vehicles this session did not touch.

**WHAT IS ADMISSIBLE FROM THAT RUN IS THE COUNTS, because counts do not drift**
(§9 rule 6's corollary), and they are the attribution this session owes:

```
                          baseline (s27 head)   after items 1-3
  lookcheck draw calls    298 / 399 / 396 / 298   298 / 399 / 396 / 298   IDENTICAL
  instanced meshes        387                     387                     IDENTICAL
  buildingBoxes           62 105                  62 630                  +525
  windows                 40 386                  40 862                  +476
  adPillarBoxes           —                       570                     +570
  propBoxes, signQuads    16 524 / 932            16 524 / 932            unchanged
  clustered light roles   aircraft 1, traffic 96, stall 12, block 52, lamp 196 — unchanged
```

**+1 095 instances, ZERO new draw calls, ZERO new meshes, ZERO new light slots.** That
is the whole delivered cost of this session's content, and it is measured rather than
claimed.

---

## 8. WHAT THE NEXT SESSION STARTS FROM

### 8.1 The three questions this session's measurements put on the table

1. **RE-DERIVE THE BRIGHT-RESERVE FLOOR, OR ACCEPT THAT THE VEIL COMES BACK.** §2.4.
   6.00% was derived against a frame carrying 4.49 points of veiling glare that no
   longer exists, and §2.1 shows no plausible content change reaches it. The two
   honest options are (a) re-derive the floor on today's content, with the same
   ratchet discipline `$minBrightFraction_number` already states, or (b) decide the
   veil was not wholly a defect and put some of it back with a derivation. **Both are
   the operator's call and neither may be done by a session that also changes
   content**, or the two are not attributable.
2. **THE ORIGIN BLOCK'S OWN GROUND FLOORS.** §0.2. The frontage the operator pointed
   at is `block.js`, which this session did not touch. Decoupling its ground floors the
   way §4 did the streamed city's is a small, self-contained job — but it spends
   `band:midnight` headroom directly, and there is 0.0021 of it. Measure before
   building.
3. **THE TWO LUMINANCE BANDS.** Carried verbatim from STATE 27 §8.3 item 1, and this
   session adds a number to it: the lamp correction the project has owed since session
   18 needs **0.0067** of `band:midnight` ceiling that does not exist. Re-deriving the
   bands closes `distinct:midnight|dusk` as a side-effect AND unblocks half the lamp
   split.

### 8.2 Cheap and self-contained

1. **RE-DERIVE THE TWO MID-DISTANCE RECTS.** Carried, STATE 27 §8.2 item 1. Still the
   cheapest green; still un-suppresses two assertions.
2. **`materials.display` IS DEAD.** §5. Created, patched, tracked, drawn by nothing.
   Either give it the pillar faces (which are exactly what it was authored for) or
   delete it. One revertible change either way.
3. **THE STATION, STAGE 1.** Not started this session — the brief's own rule is *do
   not start anything you cannot finish and commit*, and the measurement work took the
   room. The full five-stage design is unchanged and still correct: STATE 27 §8.1.
   Stage 5 (a lit platform as an 80 m line source at 23–25 m) is now the **only
   untested large-area emissive lever left**, and §2.2 says what to measure it against.
4. Carried unchanged from STATE 27 §8.2: the yaw-carrying claim (scoped, not built),
   `chunk.occluders`/`walkableAt` stopping at the wall, the roof plant's kind mix,
   the road patch clipped against nothing, five of thirteen categories claimed on one
   side only, the 76 underived bounds, and the stop line's real question.

### 8.3 Needs the operator

1. **LOOK AT THE FRAMES IN §0 AND SAY WHETHER IT IS BETTER.** The gate is not the
   verdict, and on this session's main axis the gate says nothing at all.
2. **DECIDE 8.1 ITEM 1.** Everything else in the look is downstream of it.
3. **RUN THE M5 BASELINE.** `budget.json` → `machine.series.m5` is still an empty slot.

---

## 9. THE MERGE — NOTHING WENT TO MAIN

As instructed. This session's three commits sit on
`claude/noctis-25-building-floors-89bqul` above session 27's, which are themselves
still unmerged for the reason STATE 27 §9 gives.

```
  325e38c  the advertising pillars
  cd57f62  retail is a property of the street
  755423c  one bowl, one derivation, two declared errors
  6f4990b  STATE 27  <- session 27's head, still unmerged to main
```

Each of the three is independently revertible and none depends on another: the lamp
split touches constants and the gate, the retail decoupling touches the generator and
the ground-floor builder, the pillars touch the generator and the chunk emitter. **The
operator can keep any two and drop the third without unpicking a knot.**

Session 27's own commits are still the thing blocking a merge, and this session did
not change that: the bright reserve is still red and is still red for session 27's
reason. What this session adds is the measurement that **it cannot be closed by adding
content**, which turns the merge question from *"finish the repair"* into §8.1 item 1.

---

## 10. KNOWN GAPS CARRIED FORWARD

**Unchanged from s8–s27**: `stats().cutoffM` hard-codes 0.8, the headroom probe inert,
GPU timer queries advertised and never retiring, `saturation-peak.png` overwritten
every run, `$fovYDrift`, `camera.setRouteAt(name, 1.0)` at the sky, rain streaks
near-invisible wide at night, `rain_spray` 0 static, right turns only, sun shadows to
~170 m, the bake blind to elevated slabs, the PMREM hitch, the too-red dawn horizon,
one worker at queue depth one, the far half of the river handing back to the night sky
past ~300 m, grime authored, the near-field washboard on the water, the quay wall
inside the walkable mask, props absent from the walkability mask, the 3.5°–10.4° route
camera pitch, and the frozen/running A/B.

**Resolved this session**: the 42.9× lamp split, as a structure — one derivation, one
fixture, two declared factors, a delivered-scene census and a ratchet; the era/commerce
conflation in ground-floor retail; and the absence of any advertising pillar at all.

**NOT resolved, and it is the first line a reader should carry forward**: `citycheck` →
the bright reserve, **4.83% against a 6.00% floor**. Session 27 broke it by removing
the veil; this session established that **no content lever it could find moves it**
(§2), and that the floor was calibrated against the veil it now lacks (§2.4).

**Still red**: `distinct:midnight|dusk` at 0.02536 and `midPatchSample:midWallPanel` at
0.54, both red on `main` before session 27, both diagnosed in STATE 27 §5, neither
closed. `minStopLineM` at 0 — not moved, and it is the right floor.

**New for CONTRACT §9's table** (offered rather than added, because `parsecheck`'s
`contractDocCheck` counts the rows and the count is a gate — sessions 24, 25 and 27
left rows on the same terms and they are still owed):

- **a POLAR sweep and an AZIMUTHAL sweep, one letter apart** — three's
  `SphereGeometry` takes `phiStart/phiLength` around the equator and
  `thetaStart/thetaLength` pole to pole. `LAMP_BOWL` named the polar pair `phi`, built
  the geometry correctly, and then had its own delivered census compare three's
  azimuthal 0 and 2π against 0.35π and 0.65π. §9 rule 7 inside the instrument written
  for §9 rule 7, caught by that instrument in its first hour;
- **a RECESS measured from the wrong plane and applied twice** — a colonnade's piers
  already stand 0.45–1.35 m proud of the wall, so setting the shop glass 0.92 m further
  back put it INSIDE the building, 1.37–2.27 m behind the pier face, and the lit bays
  were invisible from the street. Mean delta over the changed pixels 8.3 against 53.0
  once corrected;
- **a floor derived against a CAMERA TERM that was later removed as a defect** —
  `saturation.minBrightFraction` = 6.00% was derived in session 16 from a delivered
  8.36% measured with `POST.glareStrength` at 0.15, and session 27 took that constant
  to 0.010 on the grounds that it was carrying 61% of the night frame. The floor and
  the veil are one number and only one of them was re-derived;
- **a PROBABILITY read as a share of buildings when it is a share of frontages** — the
  first advertising-pillar roll fired once per building and delivered 1.1 pillars per
  128 m chunk, i.e. one every 450 m of frontage. A per-object roll and a per-metre
  spacing are different quantities and the first reads as the second at any single
  building;
- **an EMISSIVE MATERIAL created, patched and tracked, and drawn by nothing** —
  `city.js` → `materials.display`, §9.1's config-the-code-does-not-read with a
  material rather than a value.
