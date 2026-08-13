# NOCTIS — STATE

*End of session 27. **The machine HAS a GPU. Checked first, printed, recorded — §0.**
MacBook Air, Mac17,4, Apple M5, 10 CPU cores / 10 GPU cores, 32 GB, Metal 4. This is
the FIRST session in six with display hardware, and the first since session 20 in
which anything was looked at.*

*The session was THE LOOK: six red look assertions read as a description of what the
city looks like, and repaired.*

- ***The control settles it: the stack did not cause the look reds.*** `lookcheck` on
  `main` (049e3d4) and on the s25 head (0333ae9) is red in **the same six ways with
  the same numbers to four decimals** — and the gate itself is byte-identical between
  them, so it is the same instrument over different content. §1.
- ***Four of the six reds were ONE defect, and it was the camera rather than the
  city.*** The midnight frame was **61% bloom-and-veil**: the exposed scene with no
  camera glow at all measures 0.0682 against a band of [0.072, 0.112]. Cutting the
  glow closed `band:midnight`, `groundPools`, `facadeAlbedo` and `facadeNeighbours`
  together. **No threshold moved.** §2.
- ***The brief's hypothesis held, and its mechanism was named wrongly.*** A floor 56%
  over spec would wash out the pools — true, and measured. But it is not an *ambient*
  floor: `groundPools`' bar is `3 × the roadway's own median`, so a MULTIPLICATIVE
  change cancels out of it entirely and only an ADDITIVE one moves it, by `2Δ`.
  Proved both ways: exposure lowered the median 7.6% and left the count at 5; the veil
  lowered it 6.9% and took the count from 5 to 8. §2.2.
- ***The facade palette was NOT what collapsed, and the repair for it was built,
  measured and reverted.*** Brick and concrete sit **2.255** apart as base
  reflectances and the frame was delivering them **0.294** apart — a uniform lift
  drives every ratio toward 1. Widening the palette moved the closest pair 0.259 →
  0.278 and tipped `warmth:dusk` red. Cutting the veil took the count 3 → 4 with the
  palette untouched. §2.4.
- ***The pylon red is closed at exactly the predicted cost.*** 36 → **35** sign
  claims, one pylon of 36, and `sign(pylon) × sign(pylon)` is gone from the delivered
  sweep. §3.
- ***The shoulder chamfer is costed and built*** — +16 instances, +192 triangles,
  **no new draw call** — and the first construction was caught being *inside the body
  box* before it shipped, which is §9.1's own vehicle-skirt row. §4.
- ***Two look reds remain and both were red on `main` too.*** `distinct:midnight|dusk`
  is blocked by `band:noon`'s floor, which sits **above the noon scene's own mean**;
  `midPatchSample:midWallPanel` is a stale sample rect, not content. §5.
- ***AND THE REPAIR IS ONLY HALF OF ONE: IT BROKE A CITY FLOOR, MEASURED AGAINST ITS
  OWN CONTROL.*** `citycheck` → bright reserve was **9.34%** on `main` and is
  **4.85%** here, against a 6.00% floor — a floor session 16 built to catch exactly
  this class of change, naming `POST.glareStrength 0.15 → 0.075` as one of the four
  reductions that motivated it. **The instrument worked.** Removing the lens's false
  brightness without putting real light back is half a repair, and there is **no
  setting of the two glow constants that satisfies both this floor and
  `band:midnight`**. §6. **THIS IS WHY SESSION 27's OWN COMMITS ARE NOT MERGED.** §9.

Read `CONTRACT.md` before this file, and before any source file.

---

## 0. THE MACHINE — CHECKED, NOT ASSUMED

First commands of the session, because five consecutive briefs carried a false
premise and every one was caught by checking rather than by reading:

```
$ system_profiler SPHardwareDataType   MacBook Air, Mac17,4, Apple M5
                                       10 cores (4 Super + 6 Efficiency), 32 GB
$ system_profiler SPDisplaysDataType   Apple M5 GPU, 10 cores, Metal 4, built-in
$ sysctl -n hw.model                   Mac17,4
$ node --version                       v25.9.0
$ npx playwright --version             1.62.1  (chromium-1234 installed)
```

**The brief's premise is TRUE.** Every gate in this project that reads a pixel ran
here, and the renderer string every one of them printed is
`ANGLE (Apple, ANGLE Metal Renderer: Apple M5, Unspecified Version)`.

This is the first session since 20 that has looked at anything, and the first since
21 that could.

### 0.1 What ran

```
✓ parsecheck        92 files, syntactically complete and contract-clean
✓ faultcheck        quarantine, machine-checked
✓ lookcheck         RED AT 2 (was 6). §2, §5
✓ windcheck / inputcheck / citycheck    §6
✗ perfcheck         NOT RUN, ON INSTRUCTION. The brief: "no M5 millisecond
                    baseline". Nothing in this file is a millisecond.
✓ emitcensus        121 chunks, 3 330 delivered claims, occupancy sweep CLEAN
✓ poseprobe         used for both frame pairs, and its own limit found — §7.2
✓ trainprobe        the section, with BOXES_PER_CAR now 8
```

---

## 1. THE CONTROL RUN — AND IT IS UNAMBIGUOUS

The question: did the three-branch stack break the look, or were these reds already
there? Session 26 correctly refused to answer without a control.

**The instrument is identical on both sides, and that is checked rather than
assumed.** `git diff 049e3d4 0333ae9 -- tools/look-budget.json tools/lookcheck.mjs
tools/lib/lookmetrics.mjs tools/lib/lookassert.mjs` is **empty**. The stack touches
six files and all six are in `src/`. So this is one instrument, one seed, one camera,
over two contents.

| | `main` 049e3d4 | s25 head 0333ae9 |
|---|---|---|
| midnight mean | 0.1744 | 0.1744 |
| msd midnight ↔ dusk | 0.02391 | 0.02391 |
| ground pools | 5 | 5 |
| dusk albedo clusters | 3 (closest 0.259) | 3 (closest 0.259) |
| facade neighbours | 2 of 3 | 2 of 3 |
| `midWallPanel` span | 0.45 | 0.45 |
| **reds** | **6** | **6** |
| **assertions that did not run** | **2** | **2** |

Every difference between the two runs is in the last printed digit — dawn 0.3191 vs
0.3192, `wallNorthFar` span 0.57 vs 0.56 — which is CONTRACT §5.11's own note that a
change recompiling a shader is not obliged to be bit-exact. Draw counts are identical
at 298 / 399 / 396 / 298, which is consistent with STATE 25 §1.4's "no matrix moved".

> **THE STACK DID NOT CAUSE THE LOOK REDS.** They are long-standing content and
> instrument defects that nobody had looked at, because for five sessions nobody
> could. Item 5's merge condition is satisfied on this count.

**And the brief's list of six was five.** The brief named `band:midnight`,
`distinct:midnight|dusk`, `groundPools`, `facadeAlbedo` and `facadeNeighbours`. The
sixth is **`midPatchSample:midWallPanel`**, and it is the one that matters
structurally: it is what SUPPRESSES the two assertions that did not run. See §5.2.

---

## 2. THE LOOK REPAIR

`src/core/constants.js` → `POST.bloomStrength`, `POST.glareStrength`.

### 2.1 The decomposition — what the midnight frame is actually made of

Before theorising about a cause, the frame was taken apart. Each arm is one constant
changed from the shipped value, everything else held, `lookcheck` at the gate's own
camera and seed:

```
  bloom  glare   midnight   pools  albedo  crushed black   sd
  0.055  0.075     0.1744      5      3       0.444%      0.216   ← shipped
  0.055  0.000     0.1505      8      3       0.515%      0.201
  0.000  0.075     0.1115      9      4       0.757%      0.146
  0.000  0.000     0.0682      9      3       5.889%      0.135
```

> **The exposed scene with no camera glow at all is 0.0682, against a band of
> [0.072, 0.112] centred 0.092. Sixty-one per cent of the midnight frame was camera
> glow rather than city.** CONTRACT §5.5 names the symptom in one line — *"if the
> whole frame glows, the threshold is wrong"* — and the operator's own complaint
> ("washed out, everything the same") is that sentence from the other side.

The bottom row also vindicates the veil: with both terms at zero the blacks crush at
**5.89% against a 2% ceiling**. Veiling glare is load-bearing and must not go to
zero, exactly as §5.5 says. It is kept, small.

### 2.2 The discriminator that made `band:midnight` and `groundPools` one defect

`groundPools` counts regions on the roadway brighter than **3.0 × the roadway's own
median**. That ratio decides the whole question before any frame is rendered:

- A **multiplicative** change scales the pool and the median together. `P > 3·median`
  is unchanged and the count cannot move.
- An **additive** change raises the median by `Δ` and the bar by `3Δ`, so a pool must
  clear `3·median + 2Δ`. **A uniform lift makes its own test harder by twice what it
  adds.**

Measured, and the two arms are the cleanest result of the session:

```
  arm                        roadway median   change   pools
  shipped                        0.0668         —        5
  minEV 3.0 → 6.0  (multiplicative)  0.0616    −7.6%     5
  glare 0.075 → 0  (additive)        0.0621    −6.9%     8
```

**The exposure arm lowered the median MORE and the count did not move; the veil arm
lowered it LESS and the count went to 8.** The pools were never suppressed by the
light level. They were suppressed by what was being added on top of it.

### 2.3 Three levers measured and REFUTED, recorded so they are not tried again

- **The bright-pass threshold was the obvious repair and it is the wrong one.**
  `bloomThreshold` 0.92 → 2.0 → 4.0 moves midnight only 0.1744 → 0.1712 → 0.1672,
  because the emitters this frame is full of sit ~300× over the onset (§9's
  `streetlampNits` row) and a 4.3× onset does not reach them. What it *does* reach is
  the daytime mid-tones: **noon fell to 0.4277 and 0.4261, through its own 0.428
  floor.**
- **Exposure is midnight-selective and it crushes.** `EXPOSURE.minEV` 3.0 → 7.0 puts
  midnight at **0.0923**, dead centre of the band, and leaves dawn, noon and dusk
  identical to four decimals — the only midnight-only lever in the system. Rejected
  on the frame it produces: crushed black **6.63% against a 2% ceiling**, emitter
  clusters **58 against a floor of 60**. At minEV 8.0 it is 20.11% and 34.
- **`adaptStrength` breaks the two ends.** 0.64 → 0.50 puts midnight in band at
  0.1016 and puts **noon at 0.5025, over its 0.482 ceiling**, and dusk at 0.1227,
  under its 0.14 floor.

**And the lamp-radiance defect §9 row 18 records is nearly irrelevant to this
camera.** `LIGHT.streetlampNits` 9000 → 1952 — the derived-correct value — moved the
frame mean by **0.0001**. The origin block lights this frame through `block.js` →
`EMISSIVE.lampBowl` = 210, and raising *that* to 1952 made everything worse: midnight
0.1999, pools 4. Session 18's finding is about the night ROUTES, not the look gate.
The 42.9× split between the two paths is still open and still unrepaired.

### 2.4 The facade palette was not the cause — built, measured, reverted

`facadeAlbedo` reports clusters over five named wall rects. Which buildings those
rects actually land on had never been written down, so it was measured:

```
  wallSouthNear  x  46  → building 4   concrete
  wallSouthMid   x  23  → building 3   brick
  wallNorthFar   x -24  → building 7   concrete
  wallNorthMid   x  26  → building 8   stucco
  wallNorthNear  x  49  → building 9   brick
                          panel is NEVER sampled
```

The failing neighbour pair is **brick against concrete**, which sit **2.255** apart in
the gate's own feature space as base reflectances — and the frame was delivering them
**0.294** apart. A uniform additive lift drives every ratio toward 1, and that is the
same mechanism as §2.2 with chromaticity instead of a pool.

A palette widening was built anyway, because the brief asked for one: stucco
[0.51, 0.455, 0.36] → [0.60, 0.455, 0.275], which takes the concrete↔stucco base pair
from 0.250 to 0.716. **It moved the delivered closest pair only 0.259 → 0.278, left
the count at 3, and tipped `warmth:dusk` RED** (dusk − noon 0.067 against 0.07; it had
been sitting exactly on the line at 0.070). Reverted. Repairing the wrong cause looks
like this.

The base palette table is worth keeping even so, because it says what the material
vocabulary can and cannot do:

```
  brick ↔ concrete  2.255      concrete ↔ panel   0.401
  brick ↔ panel     2.581      concrete ↔ stucco  0.250   ← under the 0.35 floor
  brick ↔ stucco    2.175      panel    ↔ stucco  0.435
```

Two of the four materials are one cluster by construction, and `concrete ↔ panel` at
0.401 is only 1.15× the floor. Nothing is red on either today. **Neither is moved**,
because the veil was the cause and a second change in the same session would make
neither attributable.

### 2.5 What shipped, and the window it sits in

```
  POST.bloomStrength   0.055 → 0.016
  POST.glareStrength   0.075 → 0.010
```

Both carry their full derivation in `constants.js`. Delivered, against the same gate:

| assertion | before | after | bound |
|---|---|---|---|
| `band:midnight` | 0.1744 ✗ | **0.1091** ✓ | [0.072, 0.112] |
| `groundPools` | 5 ✗ | **10** ✓ | ≥ 6 |
| `facadeAlbedo` | 3 ✗ | **4** ✓ | ≥ 4 |
| `facadeNeighbours` | 2 of 3 ✗ | **3 of 3** ✓ (0.988 / 2.059 / 0.610) | ≥ 0.3 |
| midnight crushed black | 0.444% | 0.896% ✓ | ≤ 2% |
| midnight sd | 0.216 | 0.163 ✓ | ≥ 0.126 |
| emitter clusters | 68 | 80 ✓ | ≥ 60 |

**NO THRESHOLD MOVED. `look-budget.json` is byte-identical to `main`.**

**THE COST, AND IT IS THE PART THE OPERATOR HAS TO SEE.** Cutting camera glow moves
every band down together, and three margins got thinner rather than wider:

```
                              before      after     bound        margin now
  band:noon                   0.4393    0.4288 ✓   ≥ 0.428       0.0008
  midnight wet road spread     2.65×     1.81× ✓   ≥ 1.60×       0.21
  noon shadowed road B/R       1.099     1.124 ✓   ≤ 1.15        0.026
```

> **`band:noon`'s floor is what stopped the cut.** The noon scene WITHOUT any camera
> glow is **0.4255**, i.e. noon passes today only *because* bloom adds to it. So the
> feasible window between "midnight under 0.112" and "noon over 0.428" is about
> **0.003 wide** in `bloomStrength`, and 0.016 sits in it.
>
> **THE NOON MARGIN IS 2–3× ITS OWN RUN-TO-RUN SPREAD AND THAT IS A RULE 6
> PROBLEM.** Noon read 0.4292 and 0.4288 on two runs of identical content — a spread
> of 0.0004 against a margin of 0.0008. CONTRACT §0.1 forbids deciding on a
> difference of that order. It is not decided here: the value is left where the
> measurement put it and **this is the first question in §8.1**. Both bands were
> re-centred on **session 2's** content and neither has been re-derived since; that
> they now bracket a 0.003 window is a fact about the bands, not about the city.

---

## 3. THE SIGN PYLON — THE ONE TRUE RED, CLOSED

`src/modules/city.js`. The operator's decision, taken before the session: build it.

The pylon placement tested `chunk.occluders`, which are buildings. A pylon is not a
building and never entered that list, so two pylons could be decided independently
and stand on the same square metre of pavement. Located exactly, before anything was
changed:

```
  A  pylon  centre (10.000, 163.966)  half (0.149, 1.302)  y 0.00..6.33
  B  pylon  centre (10.000, 163.644)  half (0.142, 0.643)  y 0.00..3.90
  centre separation 0.322 m     overlap 0.366 m²     BOTH IN CHUNK (0, 1)
```

**Both members are in one chunk, and that is why the fix works**: `placed` is the
chunk's own claim list, so the second pylon can see the first. A cross-chunk pair
would need two elevations 0.3 m apart across a chunk seam, which the 4.2 m pavement
and the perimeter walk's own spacing do not produce. The bound is stated in the code
rather than left to be discovered.

The test uses `PYLON_HALF` = 0.55 m, the same placement pad this routine already
offers a building — deliberately wider than the claim (0.13–1.30 m half), which is
the safe direction for a keep-out: it can refuse a pylon, it cannot admit an
overlapping one. Refused back to `flush`, not moved.

```
  delivered sign claims        36 → 35        ← ONE PYLON OF 36, as costed
  forbidden sign × sign pairs   1 → 0
  emitcensus control sweep      "sign(pylon) × sign(pylon) 0.366 m²" → "none"
```

---

## 4. THE TRAIN'S SHOULDER CHAMFER — COSTED, THEN BUILT

`src/modules/moving.js`. The operator saw the raked nose and said yes.

**COST, MEASURED FIRST because the brief asked for that order:**

```
  BOXES_PER_CAR            6 → 8
  instances                +16   (2 trains × 4 cars × 2)
  triangles                +192
  draw calls               0     ← they ride in bodyMesh, like every row here
  buffers                  1.25 KiB  (instmotion 1024 B, instanceColor 192 B,
                                      noctisRough 64 B)
  turn-round extent clamp  UNCHANGED — trainLen still 77.90 m, nose tip still
                           stops at s = 240.00, the deck's last station
  structure gauge          UNCHANGED — the cap's top is still 3.58 m
```

### 4.1 The first construction was invisible, and it was caught before it shipped

A chamfer is material REMOVED from a corner and an InstancedMesh of boxes cannot
remove anything. The first version laid a 45° slab on the body's top corner and the
slab was **entirely inside the body box** — CONTRACT §9.1's *"geometry authored and
then drawn inside something else"*, which is the vehicle-skirt row verbatim. Laying it
proud instead is the other failure: a strip standing off the corner reads as a fin.

So the body's own top comes down and the chamfer is the face that bridges it to the
roof cap. The factor of two is the whole difference:

```
  body top at carHeightM − 1×CAP_INSET   the body still occupies the corner → invisible
  body top at carHeightM − 2×CAP_INSET   the band 3.110 → 3.400 outboard of the cap
                                         edge is reached by the CHAMFER ALONE → visible
```

Delivered section, verified numerically before the frame was taken:

```
  body side        up to  y 3.110   half-width 1.450
  63.43° chamfer   3.110 → 3.400    1.450 → 1.305
  roof cap         3.110 → 3.580    half-width 1.305
  slab spans       across 1.2156 → 1.4500   (flush with the body, protrudes nowhere)
                   up     3.0653 → 3.4000   (tops out exactly at carHeightM)
```

### 4.2 The chamfer has no size of its own across the car

Its horizontal run is `CAP_INSET` = 0.145 m, the inset the roof cap has had since
session 21, because the face's upper edge must land on the cap's own lower corner or
the two are not continuous. **The across-run is read from the cap rather than
authored.** What is free is the rise, and that is set by the pixel floor:

- At 45° (rise = run) the facet is 0.145 m and resolves at **75 m** against the 3 px
  floor at the gate's 6.4765e-4 rad/px. **The gate camera stands 174 m away**, so the
  operator would have seen nothing. Built, measured, rejected.
- At rise = 2 × run the facet is 0.290 m and resolves at **149 m**, which reaches the
  near half of the deck and most of the street. It is also the right shape: real
  rolling stock has a tall shallow shoulder, not a 45° cut.

`setRow` gained a `roll` argument, which fills the X Euler slot that module's own
comment reserved *"for what it will mean rather than for what it means today"*. With
two components now non-zero the `'YXZ'` order stops being a formality and starts
being the claim — under the default `'XYZ'` the roll would be in world axes and the
chamfer would leave the shoulder round the curve.

---

## 5. WHAT IS STILL RED, AND WHY

Both were red on `main` (§1), so neither is caused by this session's work.

### 5.1 `distinct:midnight|dusk` — 0.02534 against 0.03

The two frames must differ by 0.03 mean-squared. Cutting glow HELPS this, because a
uniform veil adds the same thing to both frames and is pure common mode: it went
0.02391 → 0.02534, and at bloom 0 / glare 0 it reaches **0.03284, green**.

**So it is closable, and `band:noon` is what closes the door.** Reaching 0.03 needs
the glow cut roughly twice as far again, and noon is already 0.0008 above its floor.
This is the same coupling as §2.5 and it has the same answer: it is a question about
two bands derived on session 2's content, and it is §8.1's first item.

### 5.2 `midPatchSample:midWallPanel` — 0.54 against 0.45, and it is NOT content

The rect is not sitting on one wall, so the two assertions downstream of it —
`midAlbedoClusters` and `midAlbedoSeparation` — **do not run at all**. CONTRACT §10
step 3: a suppressed assertion is not a pass. This is the sixth red the brief's list
omitted and it is the one blocking two others.

It is a **stale sample region**, not a defect in the city. `look-budget.json` →
`regions.$midWalls` says so in its own voice: the two mid-distance rects were derived
in session 5 by projecting every generated wall in the 150–900 m band through the gate
camera and ray-testing for occlusion, and the note ends *"Re-derive both if the
camera, the seed or the block moves."* The camera and seed have not moved; the
**streamed city has** — session 20 changed the height distribution, sessions 21–23
changed placement — so the wall that rect was derived against is not the wall behind
it now.

This session's change made it worse rather than better (0.45 → 0.54) and the reason is
diagnostic: the veil was flattening the patch's own spread, so removing the veil
revealed how much of it was never one surface.

**Re-deriving it is sanctioned by the file it lives in and is NOT a threshold change**
— `maxPatchSpread` stays at 0.45, only the rect moves, exactly as session 4 did for
`wallSouthMid`. It was not done here for time. It is a container-side job (§8.2) and
it is the cheapest green in the project.

---

## 6. GATE STATE — AND THE ONE THING THIS SESSION BROKE

```
  parsecheck   GREEN   92 files
  faultcheck   GREEN   7 cases
  lookcheck    RED AT 2 (was 6), plus the 2 suppressed by §5.2
  windcheck    GREEN
  inputcheck   GREEN   40.0 cm/360° inside the 27.2–60 band, lock acquired
  citycheck    RED AT 1 — AND IT IS A NEW ONE, CAUSED HERE. Below.
  gateaudit    not reached — the chain stops at lookcheck
  perfcheck    NOT RUN ON INSTRUCTION. No millisecond is claimed anywhere here.
```

### 6.1 THE BRIGHT RESERVE — BROKEN BY THIS SESSION, MEASURED AGAINST ITS OWN CONTROL

```
  ✗ [saturation] only 4.85% of pixels on the night route are above 0.5 value
                 < 6.00% — the reserve's ceiling is being met by turning the
                 lights down
```

**The control was run before this was written down.** `citycheck` on `main`
(049e3d4), same machine, same seed:

| | `main` | s27 head |
|---|---|---|
| bright reserve (median of per-run means) | **9.34%** ✓ | **4.85%** ✗ |
| the three per-run means | 9.34 / 9.51 / 8.54 | 4.55 / 4.85 / 4.91 |
| saturation peak (ceiling 12%) | 7.35% | 2.91% |
| delivered forbidden overlaps | **3** | **0** |

> **THIS SESSION CAUSED IT. A 4.49-point drop, through a floor that exists to catch
> precisely this.** `city-budget.json` → `$minBrightFraction` is worth reading in
> full: it was added in session 16 because *"every reduction this project made in
> answer to a saturation red was of the second kind"* — darkening rather than
> desaturating — and the first of the four it names is **`POST.glareStrength 0.15 →
> 0.075`**, the same constant cut again here. *"Each is defensible alone; the SUM of
> them had no instrument, because the only thing watching was a ceiling that a darker
> frame satisfies by construction."* This session is the fifth reduction of that kind
> and the floor caught it on the first run. **The gate is right and the change is
> incomplete.**

**There is no setting of the two glow constants that satisfies both.** The bright
reserve needs roughly a quarter of the cut restored, and at bloom 0.025 / glare 0.010
midnight already reads 0.1219 against a 0.112 ceiling — over, before the reserve is
anywhere near 6%. The two bounds bracket the change from opposite sides.

**And the way through is the one both the brief and the code already name.** The
brief: *"add light rather than lowering the requirement."* `constants.js` →
`streetlampNits`, written in session 18: *"the mid-tone it removes has to come back as
light before it goes in, not as camera veil."* This session removed the veil and did
not add the light. **That is the whole of what is missing**, it is §8.3's second item,
and it is the same sentence as the operator's own complaint that the pavements read
dead — the gate and the operator are asking for the same thing.

Nothing was weakened: `look-budget.json`, `budget.json`, `city-budget.json` and
`input-budget.json` are **untouched** — verified by diff, not asserted.

**`npm run gates` does not exit 0**, and this session is not reported complete.

---

## 7. THE FRAMES

### 7.1 The pairs the operator was shown

One pose, two times, before and after. Same seed, same camera, dry:

```
  node tools/lookat.mjs --pos=70,1.74,0.9 --target=-70,1.0,-0.6 --fov=55 \
       --name=street --t=0.0,0.78 --w=1600 --h=900
```

`tools/shot-out/street-{before,after}-t0.png` and `-t0_78.png`. Night: the milky lift
is gone, the corners are black, the signs read as saturated colour instead of glowing
into haze, and the pools are on the asphalt. Dusk: the walls separate into distinct
materials where every facade had been the same salmon wash.

### 7.2 `poseprobe` was used and its own limit was found

The brief required the pose to be ray-tested rather than guessed. Two things came out
of doing that which are worth keeping:

- **Its `clear azimuths` line AGGREGATES OVER ALL DISTANCES.** A first pose was read
  off that summary — "0–88° clear" — and the camera landed 11 m from a 30 m wall at
  x = 50, with a building filling a third of the frame. Azimuth 0° was clear at
  *some* distance in the swept band, not at the one used. Pinning `--dmin=140
  --dmax=140` gives an honest answer for one stand-off, and that is how the delivered
  pose was chosen.
- **It tests the sightline to the TARGET, not the frustum.** A pose can have a
  perfectly clear ray to its subject and still have a building across the frame edge.
  The tool does not claim otherwise; nothing downstream should read it as if it did.

Measured while chasing the first bad pose, and it explains `camera.js`'s own comment:
at x = 50 the origin block's buildings stand from |z| > 12 and the street is 14 m of
carriageway plus 4 m pavements; at x = 70 the block's buildings have ended. That is
why the gate shot stands at 70.

### 7.3 The train

`tools/shot-out/train-shoulder-t0_5.png`, camera level with the deck at
`--pos=48,23.5,-14 --target=0,22.3,11 --fov=42`. The two trains seed at s = −240 and
s = 0 on a 480 m arc, i.e. at (−91.0, −204.2) and **(0.0, 11.0)** — computed from
`viaductArc` rather than hunted for, after two shots missed.

---

## 8. WHAT THE NEXT SESSION STARTS FROM

### 8.1 THE STATION — DESIGNED, NOT BUILT. This is the top of the list.

His words: *stairs and lifts up to the deck, people riding them, good lighting, at
both ends and spread along the line.* It is the biggest thing he has asked for and it
must not be lost in a frame log again.

**Where.** The deck's rail level is **21.62 m** (`l.height` 21 + `VIADUCT_RAIL_RISE_M`
0.62) over a 480 m arc with 45 stations. A platform is 80 m — a 4-car 72 m train plus
margin — so the arc holds three or four without crowding. The crossing station at
s = 0, (0.0, 11.0), is the one the gate camera and all four routes can see; the ends
at (−91.0, −204.2) and (−91.0, +226.2) are the ones §7's `portalprobe` established
**no gate camera in this project sees**, which makes them the safe place to build
first and the wrong place to judge from.

**Stage 1 — A PLATFORM YOU CAN SEE.** *Small.*
Two side platforms on the deck, 80 m long, 3.0 m wide, top at rail + 1.1 m = 22.72 m;
a canopy at 25.5 m on a column line; edge coping. Static boxes in the chunk's own box
mesh, so **no new draw call**. Claims a `deck` band, 22.72 → 25.5 m, which
`occupancy.js` already permits over a carriageway and forbids against a building.
Touches `citygen.js` (the site) and `city.js` (the emission). Ends with a frame from
the street showing a station above it. **Nothing else in the project changes.**

**Stage 2 — STAIRS AND LIFTS, AS GEOMETRY.** *Small to medium.*
21 m of rise. At a 0.17 m riser and 0.28 m going that is 124 risers and 34.7 m of
going, so a switchback with a landing every ~12 risers occupies about **8 × 12 m in
plan and 21 m in height** — a real mass on the pavement, which is the point, and one
that must be claimed and tested against the existing occupancy (§9.1) exactly as the
pylon now is. Two lift shafts, 2.4 × 2.4 m, at each stair core. Still static geometry;
still no draw call. Ends with a frame you can see people *ought* to be able to climb.

**Stage 3 — `walkableAt` LEAVES THE GROUND PLANE.** *Medium, and it is the only
systems change in the whole design.*
This is the honest cost and it should be read before Stage 2 is committed:

- `city.walkableAt(x, z, pad)` answers for a point **in plan**. A station has walkable
  floor at 22.72 m over ground that is walkable at 0.16 m, so the question stops
  having a single answer and the signature has to carry a height.
- `surfaceAt(x, z)` returns the **maximum** of city/block/river — "the topmost surface
  is the one you stand on" (CONTRACT §11). A platform makes that false: standing on
  the pavement under a station, the topmost surface is the platform. It must become
  "the surface nearest below the querier's own feet", i.e. `surfaceAt(x, z, fromY)`,
  or return a sorted list and let the caller choose.
- `PLAYER.stepUpM` = 0.20 m already governs transitions and needs no change — a stair
  riser of 0.17 m is inside it by construction, which is why 0.17 is the riser above.
- **Consumers that must be visited, all four:** `player.js` (the ground query and the
  pre-move step-up test), `streetlife.js` (pedestrian ground following),
  `citycheck`'s walkability flood fill (which is 2-D and would have to become 2-D
  per level), and `tools/walkprobe.mjs` (which prints `walkableAt` against the
  rasterised mask cell by cell and is the instrument that would catch a mistake here).
- **The risk to name now:** the flood fill is what asserts every landmark is reachable
  on foot. A second level makes "connected" a question about a graph rather than a
  grid, and the cheap wrong answer is to flood each level separately and declare
  victory — which would pass with a platform nobody can reach.

**Stage 4 — PEOPLE ON IT.** *Medium.*
Pedestrians already have destinations and a gait (`gait.js`, one copy, shared with the
silhouette instrument). Three new things: a path that climbs, a queue that waits, and
an agent standing on a MOVING surface. The last is the only hard one — a lift car is a
rigid body with its own transform and a passenger's world matrix becomes
`car × local`, which §5.12 already has the machinery for (`instmotion`'s previous
transform) and which nothing in this project has yet composed two deep. **A person
riding a lift is the first object in NOCTIS whose motion is relative to another moving
object.** Ends with a frame of people on the platform and on the stairs.

**Stage 5 — THE LIGHT, AND IT IS THE STAGE THAT CHANGES THE NIGHT CITY.** *Small.*
This city has almost no emissive above 9 m: street lamps are at 8.4 m, and the only
things higher are the train's own windows and the viaduct's deck lights. A lit
platform is **a 80 m line source at 23–25 m**, and what it does is throw light DOWN
onto a street that currently receives all of its light from below that height. Under
the canopy it is a linear luminaire; between the platform edges it spills through the
deck gaps onto the carriageway. Given §2's finding — that the night frame's structure
was being erased by a flat term and is now not — **this is the single largest
remaining lever on how the night city reads**, and it should be costed against
`groundPools`, `emitterClusters` and the saturation reserve at the same time.

**Build order.** 1 → 2 → 5 gives a lit station you can look at without touching a
single system. 3 and 4 are the ones that change how the world works, and 3 must land
before 4.

### 8.2 Work that can be done in a container, with no GPU

1. **RE-DERIVE THE TWO MID-DISTANCE RECTS.** §5.2. Cheapest green in the project, it
   un-suppresses two assertions, and `look-budget.json`'s own note authorises it.
   Pure projection arithmetic against the generator; no browser needed to *derive* it,
   only to confirm.
2. **SCOPE, THEN BUILD, THE YAW-CARRYING CLAIM.** §8.4 below is the page the brief
   asked for. The decision is the operator's; the scoping is done.
3. **`chunk.occluders` AND `walkableAt` STILL STOP AT THE WALL AND IGNORE THE YAW.**
   Carried, STATE 25 §1.5, descriptions 3 and 4 of four. Nobody has costed unifying
   them — and Stage 3 above will have to touch `walkableAt` anyway, so the two jobs
   should be costed together rather than twice.
4. **THE ROOF PLANT'S KIND MIX IS NOT ITS DECLARED MIX.** Carried, STATE 25 §1.2.
   `Math.abs(Math.sin(x) % 1)` is `|sin(x)|`, arcsine-distributed; the aerial is
   weighted 13.3% and delivered 33.2%.
5. **THE ROAD PATCH IS CLIPPED AGAINST NOTHING.** Carried, STATE 24 §1.6.
6. **FIVE OF THIRTEEN CATEGORIES ARE CLAIMED ON ONE SIDE ONLY**, and **A CLAIM MAY
   CARRY A KIND THAT IS NOT A CATEGORY.** Carried, STATE 24 §1.7.
7. **THE 76 UNDERIVED BOUNDS.** Carried, STATE 25 §2.2. `node tools/budgetaudit.mjs`.
8. **THE STOP LINE'S REAL QUESTION.** Carried, STATE 25 §3.5: why a HELD vehicle is
   past its line at all when its own braking constraint is zero there. Do **not**
   build the exit reservation — costed at zero occurrences over 11 538 frames.
9. **`windcheck` IS STILL THE GATE THIS GEOMETRY MOST OWES** — and it now has a new
   subject: the chamfer is the first box in this project with a non-zero X Euler, so
   its winding under a two-axis rotation has never been checked by anything.

### 8.3 Work that needs the operator's machine

1. **DECIDE THE TWO LUMINANCE BANDS.** §2.5. This is the first question and everything
   else in the look is downstream of it. `band:noon`'s floor sits above the noon
   scene's own mean; `band:midnight`'s ceiling and it bracket a 0.003 window; the noon
   margin is 2–3× its own run spread, which CONTRACT §0.1 says is not a decidable
   difference. Both were re-centred on session 2's content. **A session that
   re-derives them on today's content closes `distinct:midnight|dusk` as a
   side-effect.**
2. **PUT REAL LIGHT BACK INTO THE NIGHT CITY — AND THIS IS WHAT UNBLOCKS THE MERGE.**
   §6.1. The bright reserve is 4.85% against a 6.00% floor because the veil that was
   supplying it is gone. It needs **1.15 points** of delivered pixels above half-code,
   from the city rather than from the lens, on the `night_rain` route. Three candidates,
   none costed: more emissive AREA (shopfronts, more lit windows per facade), more
   luminaire OUTPUT (the 42.9× bowl split below is the obvious one), or light at a new
   height (the station's Stage 5, §8.1). **The operator's own complaint — pavements
   dead outside the lamp pools — is the same request.** Measure with
   `node tools/citycheck.mjs`, which reports both conjuncts on every run.
3. **LOOK AT THE FOUR FRAMES AND SAY WHETHER IT IS BETTER.** The gate says four
   assertions went green. The gate is not the verdict, and it is also now saying the
   city is under-lit.
4. **THE 42.9× LAMP-BOWL SPLIT.** §2.3. `block.js` → `EMISSIVE.lampBowl` = 210 and
   `LIGHT.streetlampNits` = 9000 describe the same object; the derived-correct value
   is 1952 and **neither path uses it**. The look gate watches the 210 side, the night
   routes fill their frames from the 9000 side. Now that the veil is no longer being
   fed by that energy, correcting it is a smaller change than it was in session 18.
5. **DECIDE THE PLANAR BUILDING CLAIM.** §8.4.
6. **RUN THE M5 BASELINE.** `budget.json` → `machine.series.m5` is still an empty slot.
   Deliberately untouched this session, on instruction. Nothing in this project has
   had a millisecond measured since session 20.
7. **RUN `npm run gates` TO GREEN.** Blocked on (1), (2) and §5.2.
8. **~~DELETE TWO MERGED REFS~~ — DONE. §9.** It needed the operator's machine, which
   is exactly what the note carried since session 22 said it needed.

### 8.4 THE YAW-CARRYING CLAIM — SCOPED, NOT BUILT

The brief: do not refuse the 78 buildings; scope a claim that carries its own yaw,
because `occupancy.js` storing only axis-aligned boxes is the actual defect.

**The trade that makes the AABB repair wrong.** Declaring the yaw as a world AABB
removes 723.4 m² of under-claim and adds **2 942.4 m² of over-claim**, refusing 78
buildings of 419 — 18.6% of the skyline — to surface 51.96 m² of real
building-in-pavement. Bad bargain, and it is the operator's decision that it is.

**What changes in the registry.** A claim is `{kind, x0, x1, z0, z1, y0, y1, owner}`
and every consumer reads those fields directly. The minimal honest change is
**additive**: an optional `yawDeg` plus the centre and half-extents it rotates about,
with the existing `x0..z1` kept as the world AABB of the rotated box. Then:

- `overlaps(a, b, pad)` stays as the **broad phase** and is unchanged.
- A **narrow phase** is added: when both boxes clear the AABB test and either carries
  a yaw, run a separating-axis test over the two rectangles' four axes. `claimprobe`
  already has an exact convex-polygon intersection (Sutherland–Hodgman, self-tested
  against the analytic `2(√2−1)`), so the arithmetic exists and is verified.
- `overlapAreaM2` must follow it, or the report ranks by an area the test no longer
  agrees with — which is §9's own shape.
- The uniform grid (`CELL_M` 16) indexes by AABB and needs no change at all.

**Which consumers break, each checked rather than assumed.** Everything reading
`x0..z1` keeps working, because the AABB is still there and is still conservative.
What changes is only the *verdict* on pairs that clear the AABB and miss the true
rectangles. That set is exactly the 80 pairs STATE 25 §1.3 measured, of which **80 of
80 are real**. The readers to visit: `citycheck` → `occupancy` (both halves),
`emitcensus`, `benchprobe`, `claimprobe`, `city.js`'s pylon and prop tests, and
`citygen.js`'s scatter. **`walkableAt` and `chunk.occluders` are NOT in this list** and
that is the trap — they are descriptions 3 and 4 of four (STATE 25 §1.5) and they
carry the planar defect independently.

**Rough size.** ~60 lines in `occupancy.js` (the narrow phase and its area), a
falsifying case pair in `citycheck --falsify` (two rotated rectangles that overlap and
two whose AABBs overlap and whose rectangles do not — §7.3's both-directions rule),
and the yaw threaded through at each of the ~6 emission sites that already know it.
**The cost in refused placements is not zero and is not yet measured** — the 78 is the
AABB's cost, not the rotated test's, and the rotated test refuses *fewer*. Measuring
that number is the first thing the build session should do, and `claimprobe` already
has the machinery.

---

## 9. THE MERGE — THE STACK WENT IN, THIS SESSION'S OWN WORK DID NOT

**The stack merged.** `0333ae9` is linear and contains s23 and s24 whole. The control
(§1) establishes it did not cause the look reds, which was the stated condition, and
the citycheck control adds a second reason to want it in: **`main` carries 3 forbidden
delivered overlaps and the stack carries 0.** `main` fast-forwards to `0333ae9`. Four
sessions of unmerged work, in.

**Session 27's own commits are NOT merged, deliberately.** They sit on
`claude/noctis-25-building-floors-89bqul` above `main`. The brief's condition was that
items 0 and 2 hold; item 2 does not hold cleanly — it closes four look reds and opens
one city red (§6.1), and that trade is a content decision about how bright this city
should be. **A session does not merge its own regression.** Everything needed to
decide is in §2.5 and §6.1: the arms, the control, and the reason the two bounds
cannot both be met by a camera constant.

To take it: merge the branch. To reject it: `git revert` the look commit alone — it is
two constants in one file and nothing else depends on it.

**THE TWO STALE REFS ARE GONE.** `claude/generator-occupancy-registry-6pbuer` and
`claude/noctis-22-machine-residual-t3u3px`, both re-verified as ancestors of
`origin/main` with `git merge-base --is-ancestor` before the delete rather than on the
strength of the note carried since session 22. `git push --delete` returned HTTP 403
through the container proxy for five sessions; **on the operator's own machine with
his own credentials it succeeded first try.** Nothing was retried and nothing was
forced. The remote now carries `main` and the three session branches and nothing
else.

---

## 10. KNOWN GAPS CARRIED FORWARD

**Unchanged from s8–s26**: `stats().cutoffM` hard-codes 0.8, the headroom probe inert,
GPU timer queries advertised and never retiring, `saturation-peak.png` overwritten
every run, `$fovYDrift`, `camera.setRouteAt(name, 1.0)` at the sky, rain streaks
near-invisible wide at night, `rain_spray` 0 static, right turns only, sun shadows to
~170 m, the bake blind to elevated slabs, the PMREM hitch, the too-red dawn horizon,
one worker at queue depth one, the far half of the river handing back to the night sky
past ~300 m, grime authored, the near-field washboard on the water, the quay wall
inside the walkable mask, props absent from the walkability mask, the 3.5°–10.4° route
camera pitch, and the frozen/running A/B.

**Resolved this session**: `band:midnight`, `groundPools`, `facadeAlbedo` and
`facadeNeighbours`, all four by one change and with no threshold moved; the
three-session-old question of whether the stack broke the look, answered by control;
the sign-pylon overlap, the only true red in `citycheck`'s delivered sweep; and the
3 forbidden delivered overlaps `main` carries (prop × hoarding), which the stack fixed
and which the merge therefore also closes.

**BROKEN BY THIS SESSION, and it is the first line a reader should carry forward**:
`citycheck` → the bright reserve, 9.34% on `main` → 4.85% here against a 6.00% floor.
§6.1. The look repair is half a repair until real light replaces the veil it removed.

**Still red**: `distinct:midnight|dusk` at 0.02534 and
`midPatchSample:midWallPanel` at 0.54, both red on `main` before this session, both
diagnosed in §5, neither closed. `minStopLineM` at 0 — not moved, and it is the right
floor; what was wrong is the diagnosis (STATE 25 §3).

**New for CONTRACT §9's table** (offered rather than added, because `parsecheck`'s
`contractDocCheck` counts the rows and the count is a gate — sessions 24 and 25 left
rows on the same terms and they are still owed):

- **a VEILING GLARE coefficient — a camera property — carrying 61% of a night frame's
  mean**, so four separate look assertions were measuring the lens rather than the
  city: the exposed scene at midnight is 0.0682 against a band centred 0.092, and
  bloom plus veil were adding 0.106 to it;
- **a bar defined as a MULTIPLE OF THE MEDIAN read as a bar on absolute brightness** —
  `groundPools` counts regions over `3 × the roadway's own median`, so a
  multiplicative change cannot move the count and an additive one moves the bar by
  `2Δ`. Three sessions of STATE describe that red as "the streetlights are not laying
  light on the asphalt"; the streetlights were, and the veil was raising the bar
  faster than the pools;
- **a MATERIAL PALETTE's base separation used as the separation the frame delivers** —
  brick and concrete sit 2.255 apart as reflectances and were delivered 0.294 apart,
  because a uniform additive lift drives every ratio toward 1. The repair aimed at the
  palette moved the delivered pair by 0.019 and broke a different assertion;
- **a `clear azimuths` summary aggregated over a swept RANGE of distances read as the
  answer for ONE distance** — inside `poseprobe`, the tool written to stop exactly this
  class of mistake (§7.7 again): "0–88° clear" was true of the band and false of the
  stand-off used, and the camera landed 11 m from a 30 m wall;
- **a chamfer authored as a slab ON a corner the body box still fills** — the body's
  top had to come down by TWICE the roof cap's inset, not once, or the geometry is
  inside the solid it is supposed to be cutting. §9.1's vehicle-skirt row, caught in
  the same hour it was written rather than a session later.
