# NOCTIS — STATE

*End of session 29. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
MacBook Air, Mac17,4, Apple M5, 10 cores (4 Super + 6 Efficiency), 32 GB. `node v25.9.0`.
Load averages through the session: **1.91 at the first command, 2.2–4.1 during the pixel
batteries, 2.79–3.38 at gate time**, against CONTRACT §0.2's bar of **1.6**. Every
millisecond in this session is therefore INADMISSIBLE and none is quoted as a verdict.
Counts, instances, draw calls and pixel fractions are quoted, because counts do not
drift (§9 rule 6's corollary).*

***BOTH OF THIS SESSION'S CHANGES REACH BOTH CONTENT PATHS, AND THAT IS THE FIRST THING
TO KNOW, BECAUSE SESSION 28 BURIED IT.*** Session 28 built a session of content into the
streamed city (`city.js`) while the operator was looking at the origin block
(`block.js`), and the frame he pointed at moved by 0.145% of its pixels. **Traffic is
neither of those two paths.** It is ONE module on the 128 m chunk lattice, and the
lattice runs straight through the origin block. Measured rather than assumed
(`tools/fleetprobe.mjs`, eye parked at the look shot, 216 simulated seconds):
**39.57% of all vehicle-frames are inside `BLOCK_KEEPOUT`, and 156 of 160 vehicles were
inside it at some point.** The buses, the lorries and the new light signatures are on the
street the operator walks, not only in the streamed city.

- ***THE BRIEF'S CENTRAL PREMISE ABOUT THE FLEET WAS WRONG AND THE INSTRUMENT SAID SO
  BEFORE ANYTHING WAS BUILT.*** *"Today every vehicle is a car-length body"* — measured
  off the live table, the fleet was already **2.20 to 9.60 m long and 1.28 to 3.62 m
  tall**, and the hauler was already taller than it is wide. What was actually missing is
  narrower and is what got built: **no passenger vehicle of any kind**, and **no step in
  any side elevation** — all five types were monotone wedges. §2.
- ***THE SESSION'S LARGEST PRODUCT IS A DEFECT NOBODY WAS LOOKING FOR.*** `seed()`, the
  one placement routine in this project that re-runs 160 times a second, had **no
  collision test of any kind**. 245 of 637 re-seats — **38.5%** — landed inside a body
  already on that line. CONTRACT §9.1's placement rule, broken an eighth time. §3.2.
- ***ITEM 1 TURNED FOUR GREEN LOOK ASSERTIONS RED, AND THE CAUSE WAS NOT THE BUS.***
  Measured on both commits: the nearest vehicle to the look camera went **22.3 m → 14.2 m**
  and it is a 3.70 m **pod**. `CAMERA_CLEARANCE` is derived to the NOSE and was tested
  from the ORIGIN. Repaired; three of the four reds closed. §3.3.
- ***ITEM 5'S TEST IS RUN AND SESSION 28'S CONCLUSION SURVIVES.*** A lit bus interior is
  **1.41× a pillar per object and 1/27th of the pillars in aggregate**, and the bright
  reserve moved **4.74% → 4.52%** across the whole session, inside its own spread. §6.
- ***THREE OF THE BRIEF'S SIX ITEMS WERE NOT BUILT — 3, 4 AND 6 — AND NOTHING OF THEM IS
  ON THE BRANCH.*** No half-built bus stop, no half-built dwell. §7 says exactly where the
  next session starts, with the placement machinery already mapped.

Read `CONTRACT.md` before this file, and before any source file.

---

## 0. LOOK AT THESE FIRST, IN THIS ORDER

Every pair is the same seed and the same pose. **Vehicle poses are pinned differently
from prop poses and the reason matters**: `lookat.mjs` opens the page with `paused=1`, and
`traffic.update` takes its step from `time.now − lastNow`, so paused the step is ZERO and
no vehicle ever moves or is recycled. The disposition in every `lookat` frame is the boot
seeding around the camera's BOOT position — `camera.js` → `SHOTS.street`, [70, 1.74, 0.9]
— and not around wherever `setShotAt` later puts the eye. That is what makes a pinned
pose possible for a moving object at all, and `fleetprobe --where` prints the positions
the frame will draw.

| # | file | what changed | what it cost |
|---|---|---|---|
| 1 | `tools/shot-out/fleetstreet-{before,after}-t0.png` | **The frame the operator actually pointed at**, down the origin block's own street. The traffic disposition is different because the fleet is: seven classes instead of five, and every vehicle re-typed. | 310 draws before, **310 after**. |
| 2 | `tools/shot-out/fleetoblique-{before,after}-t0.png` | The same street obliquely, at a stand-off that reads a vehicle's flank. | 245 draws before, **245 after**. |
| 3 | `tools/shot-out/signear-after-t0.png` | **The light signatures, close.** Two different signatures in one frame — a separated outboard `pair` on the near body, a full-width `bar` on the one behind it. This is the operator's oldest request, answered. | 141 draws. |
| 4 | `tools/shot-out/sig-after-t0.png` | The oblique street again, after the signatures. Compare against frame 2's *after*. | 244 draws. |

```
1  node tools/lookat.mjs --pos=70,1.74,0.9  --target=-70,1.0,-0.6 --fov=55 --t=0.0
2  node tools/lookat.mjs --pos=34,1.74,9.4  --target=-30,1.9,1.5  --fov=50 --t=0.0
3  node tools/lookat.mjs --pos=84,1.5,7.2   --target=94.2,1.2,1.8 --fov=45 --t=0.0
4  node tools/lookat.mjs --pos=34,1.74,9.4  --target=-30,1.9,1.5  --fov=50 --t=0.0
```

**There is no *before* for frames 3 and 4's subject and that is stated rather than
implied.** Frame 3 is a close shot chosen *because* the signatures exist; the honest
before/after for the signatures is frame 2's pair, where the same vehicles carry the same
paint and differ only in their lamps.

---

## 1. WHAT WENT ON THE BRANCH

Session 27's branch, `claude/noctis-25-building-floors-89bqul`, above session 28's three.
**NOTHING MERGED TO MAIN**, as instructed.

```
  3582517  item 2 — the light signatures, and a light row that could not move sideways
  8b9c7de  item 1b — the camera clearance, derived to the nose and tested from the origin
  a536f41  item 1  — two vehicle classes, and the recycler with no collision test
  1412d41  STATE 28  <- session 28's head
```

Each is independently revertible. `8b9c7de` is correct on its own merits and survives a
revert of `a536f41`; `3582517` depends on neither.

**NO THRESHOLD MOVED.** `look-budget.json`, `city-budget.json` and `input-budget.json` are
byte-identical to session 28. `budget.json` gained **two rows and one comment** in
`motionVectors.kindMinExtentM` (`bus: 2.55`, `lorry: 2.40`) and changed no bound — that
table is keyed by body type and computed from the delivered geometry, and a missing row is
a hard failure in `perfcheck` rather than a skip.

---

## 2. ITEM 1 — TWO CLASSES, AND THE PREMISE THAT WAS WRONG

`tools/fleetprobe.mjs` is new and is the item's real product. It boots the real traffic
module through the `headlesscity.mjs` stub — no GPU, no browser, because traffic's
integration is arithmetic — and measures the six places a vehicle's extent is used.

### 2.1 The fleet as it actually stood, before a line was written

```
  name      len     wide    high    min     weight
  wedge     5.40    1.96    1.28    1.28    0.340
  pod       3.70    1.66    1.66    1.66    0.240
  van       6.00    2.16    2.24    2.16    0.200
  hauler    9.60    2.66    3.62    2.66    0.100     <- taller than wide already
  moto      2.20    0.64    1.34    0.64    0.120
```

So *"every vehicle is a car-length body"* is false, and *"a lorry is taller than it is
wide"* was already true of one type. **What was missing:** no passenger vehicle of any
kind — nothing in this city carries people except the people — and **no step in any side
elevation**: every one of the five is a monotone wedge, widest at the nose, drawn in at
the tail, roof rising or falling once. The two additions are chosen for those two
silhouettes, and the length follows from the class rather than the other way round.

### 2.2 What was added

```
  bus     12.00 x 2.55 x 3.20   weight 0.03   speed 0.78
  lorry    8.20 x 2.40 x 3.30   weight 0.06   speed 0.82
```

**12.00 m is the standard rigid single-decker** — 2.22× the wedge and **2.67× a 4.50 m
reference-era saloon**, which is the brief's "three times a car" measured against a real
car rather than against this fleet's own wedge. 2.55 m is the EU maximum bus width
(96/53/EC), and this world's hauler at 2.66 is over it: a freighter here is wider than
anything licensed to carry passengers. **The lorry is a CAB AND A BOX** — a 2.02 m cab
over the front axle, a hard step to a 3.30 m body running flat to a square tail, and in
plan the box is the widest thing on it while the cab is narrower, which is the opposite of
every other type here.

**Class share: the five existing weights are UNTOUCHED.** `pickType` divides by the sum,
so the two new weights take their share pro rata from all five at once and the existing
proportions to each other are exactly what they were.

```
  sum = 0.34+0.24+0.20+0.10+0.12+0.03+0.06 = 1.09
  bus   0.03/1.09 = 2.75%  -> 4.4 in the ring -> one every 403 m -> 26.8 veh/h/lane
  lorry 0.06/1.09 = 5.50%  -> 8.8 in the ring                    -> 53.5 veh/h/lane
```

26.8 buses/hour/lane is **at the top of the real range and is chosen rather than derived**
— a trunk corridor with several routes converging runs 20–30 an hour, and a bus the camera
never meets is content that does not exist. Delivered over 160: wedge 43, pod 41, van 27,
hauler 11, moto 24, **bus 5, lorry 9**.

**Weighted mean body length 5.148 → 5.505 m, +6.9% at a fixed vehicle count and a fixed
1 772 m of centreline.** That is item 1(f)'s quantity: road area is unchanged and the
fleet occupies 6.9% more of it.

### 2.3 The shape metrics, and two drafts that failed them

`fleetprobe` computes §7.5's `widthSpan` and §7.4's `roofSpan` through the geometry path,
offline, so a body can be shaped against the floors before it is put in front of a camera.

```
  type      widthSpan   roofSpan      floors 0.12 / 0.30
  wedge       0.1800     0.3944
  pod         0.1800     0.3697
  van         0.1650     0.4259
  hauler      0.1610     0.3847
  moto        0.4240     0.4390
  bus         0.1670     0.3265   <- new
  lorry       0.1740     0.3295   <- new
```

**THE CONTROL, because §7.7 says an instrument is checked against a case whose answer is
known from outside it.** The width column reproduces `hullprobe`'s published session-9
replica figures **exactly** — 0.1800 / 0.1800 / 0.1650 / 0.1610 / 0.4240 — which is what
says this is the same instrument. **The roof column does NOT reproduce** the replica
figures quoted in `traffic.js` (van 0.4482, hauler 0.4155, moto 0.3522) and is therefore
recorded as **indicative only**; the verdict on the roofline belongs to `perfcheck`, which
measures it off the delivered frame.

**BOTH NEW TYPES FAILED BOTH FLOORS IN THEIR FIRST DRAFT**, and the reason generalises:
the §7.4 sampling trims 10% of the length at each end and takes twelve stations over what
is left, which on an eight-section body **reaches sections 1 to 6 and never samples
sections 0 or 7**. A nose deck authored in section 0 is invisible to the metric however
deep it is. Both bodies were reshaped against that, not against the drawing.

A real bus is a flat-topped slab and a real box lorry has a cab the same width as its
body; both would fail. This is the same trade `budget.json` →
`silhouettes.$minWidthSpan_notAllVehiclesTaper` already records for a panel van, **taken
deliberately** rather than discovered.

**AND THE DELIVERED POPULATION HELD, WHICH WAS THE REAL RISK.** The geometry path says a
body clears the floors; it says nothing about whether adding a 12 m body *removes* other
bodies from the measured population, by occluding them or by being declined itself.
`perfcheck` measured it off the delivered frame: **67 vehicles, 39 rooflines, 22 widths**
against floors of 6, 5 and 5, with width span 0.1785 at a pass fraction of **1.000**. §8.2
has the arithmetic of why this was in doubt.

---

## 3. THE THREE EXTENT DEFECTS A 12 m BODY FOUND

The brief predicted that length would propagate into the traffic model and asked for the
sites to be found with an instrument before building. Six were measured; three were
defects.

### 3.1 The turn — off-tracking, and a bound that is derived

The arc is run by the vehicle's ORIGIN. A rigid body of half-length `L` on a radius `R`
swings its corners `sqrt((R+W)² + L²) − (R+W) ≈ L²/(2R)` outside the band its own width
entitles them to. Measured on the delivered arc against that prediction — §9 rule 2, two
derivations printed side by side:

```
             measured   L²/2R
  moto        0.072      0.076
  pod         0.192      0.214
  wedge       0.397      0.456
  van         0.483      0.563
  lorry       0.872      1.051
  hauler      1.162      1.440
  bus         0.000      2.250   <- refused, see below
```

The bound is the **1.75 m lane half-pitch**: past it a corner is over the next lane's
centreline, in space the following model is keeping clear for somebody else. Solving
`L²/(2R) ≤ 1.75` at `R = 8.0` gives `L ≤ 5.2915 m`, i.e. **`len ≤ 10.583 m`**. The hauler
passes with 0.31 m to spare; the 12.00 m bus does not. **Refused rather than moved** — the
alternative is a second turn radius for long vehicles, which is a junction geometry this
city does not have. Delivered bus off-tracking: **0.000 m**.

### 3.2 The recycler — no collision test at all

`seed()` tested the ring, the river and the camera, and nothing about what was already on
the line. Measured before anything changed:

```
                                      BEFORE            AFTER
  re-seats landing inside a body      245 / 637 = 38.5%  6 / 843 = 0.71%
  worst overlap                       −9.475 m           −6.699 m
  pair-frames with a negative gap     313 353 (17%)      23
  p01 of the bumper-to-bumper gap     −5.783 m           +2.000 m
```

The p01 landing exactly on 2.000 m is `SEED_CLEAR_M` — the model's own standing gap,
`safe = 2.0 + 1.2v` at rest — showing up in the delivered distribution.

**Car following cannot undo one of these**: at `gap < 0` its limit is
`max(0, lead.v × gap/safe)` = 0, so the vehicle behind stops INSIDE the vehicle in front
and waits for it to drive out. **The residual is now entirely the FALLBACK path**, which
places a body without the test by construction: 7 fallbacks in 843 re-seats, and they are
counted (`stats().seedFallbacks`) rather than hidden.

### 3.3 The camera clearance — derived to the nose, tested from the origin

**Item 1 turned FOUR look assertions red that were green before it**: `band:midnight`
0.1091 → **0.1151** against a 0.112 ceiling, `band:noon`, and both `wetOverDry` arms. The
reflex reading is *"the bus is in the frame"*.

**Measured instead**, with `fleetprobe --where` run against both commits: the nearest
vehicle to the look camera went **22.3 m → 14.2 m**, and it is a **3.70 m pod**. The cause
was the seeding re-phasing, and 14.2 m is just outside a 14.0 m bound — so the bound was
the thing to look at.

`CAMERA_CLEARANCE` = 14.0 is derived in `traffic.js` as *"2.0 + 1.2 × 12 = 16.4 m, less
half a hauler — 9.60/2 = 4.80 — so the derivation gives 11.6 m and the constant holds the
CONSERVATIVE side of it"*. **That is a statement about where the NOSE ends up.** The test
was `d2 < CAMERA_CLEARANCE²` on the vehicle's **ORIGIN**, so what it guaranteed was
`14.0 − len/2` to the body: 11.2 m for a hauler and **8.0 m for a bus**. CONTRACT §9 rule
7 — a right number measured from the wrong place, invisible for as long as the longest
half-length in the fleet was the 4.80 m the derivation happened to be written against.

Repaired to the oriented body, which is **stricter for every type and strictest for the
longest**: a bus must now seed its origin 20.0 m out where 14.0 m used to do. It does not
move the stream — the candidate loop still draws five numbers twelve times, so
`traffic:layout`'s phase is untouched and only which candidate wins changes.

```
  nearest body to the look eye     14.2 m  ->  24.2 m
  band:midnight                    0.1151  ->  0.1088   (band [0.072, 0.112])
  wetOverDry:midnight, :dawn       RED     ->  green
```

### 3.4 The three that were measured and were NOT defects

- **Car following** already subtracts both half-lengths (`(type.len + leadLen) × 0.5`).
- **The stop line** already subtracts the front overhang — session 19's repair holds.
- **Junction occupancy** has no length in it, but the consequence is proportionate rather
  than wrong: the share of a type's own vehicle-frames with its body extent over a
  junction box runs pod 10.1% to wedge 16.8%, with **bus 13.5% and lorry 13.7%** sitting
  inside that range rather than outside it.

---

## 4. `minStopLineM` — MEASURED BEFORE AND AFTER, AND NOT REPAIRED

The brief required this and forbade the repair. `tools/stoplineprobe.mjs`, headless and
deterministic, 12 signal cycles at dt = 1/60:

```
                                    BEFORE      AFTER
  worstStopLineM                    −13.492 m   −14.826 m     floor 0
  settled population, worst         −13.492 m   −12.180 m
  settled population, median         −8.241 m    −7.908 m
  settled vehicles inside a box      0 / 18 058  0 / 18 359
```

**The two halves move in opposite directions and that is the finding.** The run worst got
**worse by 1.334 m** because the fresh-teleport population now contains a body with a
6.00 m front overhang against the hauler's 4.80 — which is what the brief predicted. The
**settled** population, the one an exit reservation would address, got **better by
1.312 m**, because the spawn spacing repair removed the packed overlaps that were feeding
it.

**Still zero vehicles standing inside a junction box, over 18 359 settled frames.** STATE
25's diagnosis and CONTRACT §9 rule 7's `s25` entry are unchanged: this is a **datum
disagreement** — the queue measures from the junction mouth and the assertion from the
stop line, 9.0 m apart — and not spillback. **The floor is not moved and the repair is not
attempted.**

---

## 5. ITEM 2 — THE LIGHT SIGNATURES

The operator's oldest request. The session-4b comment at the top of `traffic.js` states
*"the light signatures are LINES rather than lamps: a full-width bar front and rear"* as a
feature; one line on every vehicle of every type is not a design language.

**Four signatures, rolled per vehicle on `traffic:signature`.** `bar` is exactly what
shipped before and is kept as signature 0, so the old look is a member of the new
vocabulary rather than something it replaced. `pair` is two separated outboard units,
`column` two tall units at the corners, `strip` one narrow central line. Widths and
lateral offsets are **fractions of the end section's own width**, so a 0.64 m motorcycle
tail and a 2.55 m bus tail get the same proportion; heights and along positions come off
the finished loft, so §9 rule 4's *"a lamp height authored beside a body height is two
numbers that drift"* still holds.

**A SEPARATED PAIR NEEDED A LATERAL OFFSET AND LIGHT ROWS DID NOT HAVE ONE.** The emitter
put every light row on the vehicle's centreline. The hauler's own marker comment records
that as the reason its strip could only be made visible by being made WIDER than the flank
— a row buried inside its own body since session 6b. `lat` is now the seventh element of a
light row, down the vehicle's RIGHT with the same `(−cos yaw, sin yaw)` the wheels have
used since session 5.

**Class constrains it**, as the brief required, and the constraint is a property of what
the vehicle is: the moto gets `strip` only, because a separated pair on a 0.64 m fairing
is two lamps 0.21 m apart and reads as a fault; bus, lorry and hauler get discrete
clusters only, because their lamps are type-approved units in a housing and not a styling
light-line. **Delivered: bar 43 / pair 43 / column 19 / strip 55.**

**The bus saloon**, 160 cd/m², derived rather than chosen: 150 lx of saloon lighting at
0.40 reflectance gives `E·ρ/π` = 19.1 cd/m² of surfaces, plus the ceiling diffuser run
visible along about 8% of the aperture at ~1 750 cd/m² = 140, so 159.1 → 160. Checked
against the one neighbour that matters: **160 / 220 = 0.73× `LIGHT.windowNits`**, so a bus
interior is a little dimmer than an office window.

**Cost.** `LIGHTS_PER_VEHICLE` 3 → 6: **+480 instance rows, +5 760 triangles**, zero new
draw calls, meshes, materials or light slots. `sceneCensus` labels are derived from the
same constants as the allocation and moved with it — `vehicleLightLines 960,
signalHeadBoxes 80`, no mismatch. **The signature roll re-phases nothing**: it is a new
roll on a new stream, and the nearest-vehicle list at the look camera is identical to item
1's to one decimal, so any look-gate movement from here is attributable to the lights
alone.

---

## 6. ITEM 5 — THE MEASUREMENT THE SESSION GOT FOR FREE, AND ITS VERDICT

The brief's hypothesis: *"A BUS WITH A LIT INTERIOR IS THE LARGEST EMITTER AREA THIS CITY
COULD PLAUSIBLY GAIN — far more than a pillar face"*, making this session an unintended
test of STATE 28's conclusion that the bright reserve does not respond to content.

### 6.1 The arithmetic, computed BEFORE the measurement

```
  ad pillar face   1.04 x 3.40  =  3.536 m²   x 2 faces x 190 pillars = 1 343.7 m² @ 748 cd/m²
  bus saloon band  5.80 x 0.86  =  4.988 m²   x 2 flanks x 5 buses    =    49.9 m² @ 160 cd/m²
```

**Per object the brief is right**: a bus's two flanks (9.98 m²) are **1.41×** a pillar's
two faces (7.07 m²). **In aggregate it is wrong by a factor of 27**: the pillars are
**26.9× the area** and, multiplying by radiance, **126× the area × radiance**. Session 28
measured those 190 pillars as moving the reserve by nothing.

### 6.2 The measurement — three invocations per arm, each itself a median of three loads

```
  arm                                  bright reserve (floor 6.00)      median
  baseline (session 28 head)           5.03 / 4.74 / 4.50               4.74%
  item 1, classes only                 4.89 / 4.73 / 4.51               4.73%
  item 1b, + camera clearance          4.83 / 4.58 / 4.68               4.68%
  item 2, signatures + bus interiors   4.52 / 4.39 / 4.66               4.52%
```

```
  saturation peak (ceiling 12%)   2.97 baseline  ->  2.98 after      unmoved
  band:midnight [0.072, 0.112]    0.1091         ->  0.1088          unmoved
  emitter clusters, midnight      78  ->  82  ->  77
```

### 6.3 The verdict, stated plainly as the brief asked

> **SESSION 28'S CONCLUSION SURVIVES.** The whole session's content moved the bright
> reserve by **0.22 points**, from 4.74% to 4.52%, against a per-invocation spread of
> 0.27–0.53 points and a deficit of 1.48. The largest street-level emitter area this
> city could plausibly gain gained nothing, and it is 1/27th of a lever that had already
> been measured to gain nothing.

**DO NOT READ THIS AS A LICENCE.** No threshold moved. The 6.00% floor decision is the
operator's and is still sitting in §7.1 item 1 unmade. What this adds to STATE 28 §2 is
one more arm and a sharper statement of it: the reserve does not respond to emitter area
*at street level, in motion, at a plausible radiance* either.

**One caveat that is the honest limit of this test.** The look and city cameras did not
have a bus close to them in any measured frame — the nearest bus in the pinned disposition
is 76.7 m away on a cross street. The arms above measure five lit buses distributed
through a 190 m ring, which is the realistic case; they do not measure a bus filling the
frame, and nothing in this session claims they do.

---

## 7. WHAT WAS NOT BUILT, AND WHERE THE NEXT SESSION STARTS

**ITEMS 3, 4 AND 6 WERE NOT BUILT AND NOTHING OF THEM IS ON THE BRANCH.** No half-built
bus stop, no half-built dwell behaviour, no platform. The reason is room, and the decision
was taken deliberately rather than run into: a bus stop is a declared, claimed object in
the one registry, and CONTRACT §9.1 records seven sessions in which an object was placed
without being tested against what was there. An unfinished claim is worse than no claim,
because the next reader cannot tell which half was intended.

### 7.1 The three questions on the table (two carried, one new)

1. **RE-DERIVE THE BRIGHT-RESERVE FLOOR, OR ACCEPT THAT THE VEIL COMES BACK.** Carried
   verbatim from STATE 28 §8.1. 6.00% was derived in session 16 against a frame carrying
   4.49 points of veiling glare that session 27 removed as a defect. This session adds a
   fourth content arm that does not reach it. **The operator's call, and it may not be
   taken by a session that also changes content.**
2. **`band:noon` IS NOW RED BY 0.0002–0.0003 AND THIS SESSION PUT IT THERE.** Baseline
   0.4283, delivered **0.4277 / 0.4277 / 0.4278** against a 0.428 floor. The mechanism is
   physical and not an artefact: longer bodies at a fixed vehicle count cover **6.9% more
   bright road with dark paint**, and the noon mean falls for it. **STATE 28 §1 already
   records this assertion as one CONTRACT §0.1 forbids deciding on** — its margin of
   0.0003 is half its own 0.0006 spread. No threshold was moved. It is the operator's call
   whether a floor with half a spread of margin is a floor.
3. **THE TWO LUMINANCE BANDS.** Carried from STATE 27 §8.3 and STATE 28 §8.1 item 3,
   unchanged and still the thing blocking the lamp split.

### 7.2 Item 3, the bus stops — the machinery is mapped, so this is now cheap

The next session should not re-derive any of this. It was read out of the source this
session and each claim is cited:

- **Declare on a new stream.** `chunkRng(rootSeed, cx, cz, 'busstop')`, beside the eight
  at `citygen.js:3632-3661`. A roll drawn from an existing stream re-scatters that whole
  system.
- **The two patterns to copy.** The **sign pylon** (`city.js:1409-1730`, `PYLON_STANDOFF`
  1.7, claim at `:1719-1725`) is the closest analogue for a pole-and-timetable; the
  **advertising pillar** (`city.js:2181-2291`) is the closest for the roll-and-refuse
  discipline. Both use the `|cos|·L + |sin|·W` claim and both push `{kind: 'sign'}`.
- **THE ORDERING TRAP.** At the moment the pillar loop runs, `placed` holds only pylons,
  props and features — the **ground rectangles are pushed later, at `city.js:2580`**. So
  the pillar's own comment about not sharing a carriageway **is not actually exercised**.
  A shelter must either run below `:2586` or test the kerb geometrically against
  `CITY.roadHalfWidth`.
- **The pavement to stand on.** `citygen.js:3942-3952`, the ten ground strips: with
  `r = CITY.roadHalfWidth` = 7.5 and `w = r + CITY.sidewalkWidth` = 11.7, a pavement band
  runs from |7.5| to |11.7| off the chunk line. `band.side` is read at `:5322` and `:5326`
  and already selects which side of the kerb a prop stands on — a shelter's facing can
  come from it.
- **The gates a stop must declare itself into.** Kerbside placement requires `!lowDetail`
  (`citygen.js:5299`); `city.js` emits props and pillars only under `if (detail)`. Kerbside
  spacing is `KERB_SPACING_M` = 3.2 with `PROP_TRIES` = 8.
- **Claim the ROOF, not the posts.** The brief's own requirement, and session 24's finding
  is the reason: a claim that recorded a 2.4 × 0.06 m panel as a 2.4 × 2.4 m square.
- **Both content paths.** The streamed city is the easy half. `block.js` builds the origin
  block's furniture itself and a stop there is a separate decision — but note §0: traffic
  already reaches that street, so a bus with nowhere to stop on it would be visible.

### 7.3 Item 4, the dwell — what the measurement says about it in advance

A halted bus is a queue head, and §3.2's instrument is exactly what detects the packing.
Note before building: a bus **does not turn** (§3.1), so a dwelling bus is on a straight
line and its queue is one-dimensional. `stats().seedRejects` and `seedFallbacks` already
exist to see whether a stopped bus starves the recycler.

### 7.4 Cheap and self-contained, carried

1. **RE-DERIVE THE TWO MID-DISTANCE RECTS.** Carried from STATE 27 §8.2 and STATE 28
   §8.2. Still the cheapest green in the project; still un-suppresses two assertions.
2. **`materials.display` IS DEAD.** Carried from STATE 28 §5. Created, patched, tracked,
   drawn by nothing.
3. **THE STATION, STAGE 1.** Not started for the fourth session running. STATE 27 §8.1
   holds the five-stage design.

---

## 8. GATE STATE

**Each gate was run individually rather than through `npm run gates`**, because that chain
is `&&`-joined and stops at `lookcheck`, which hides every gate after it — the reason
session 27 ended with two gates unreported.

```
  parsecheck   GREEN   93 files
  faultcheck   GREEN   7 cases
  lookcheck    RED AT 3   band:noon (NEW, §7.1 item 2) + the two carried from before s27
  windcheck    GREEN
  inputcheck   GREEN
  citycheck    RED AT 1   the bright reserve, 4.52% against a 6.00% floor — the same red
                          session 28 ended on, unmoved by this session's content (§6)
  gateaudit    RED AT 3   ALL THREE ARE lookcheck's reds restated one layer up. Every
                          --falsify self-test underneath passed at 100% coverage
  perfcheck    RED AT 10  FIVE are milliseconds and are INADMISSIBLE at this machine's
                          load (2.79–4.30 against a bar of 1.6). Four are the carried
                          stop-line datum. One is the carried tone profile, IMPROVED.
```

**`npm run gates` does not exit 0, and this session is not reported complete.**

The two carried `lookcheck` reds are unchanged and were red on `main` before session 27:
`distinct:midnight|dusk` at 0.02534 against 0.03, and `midPatchSample:midWallPanel` at
0.55 against 0.45, which suppresses two assertions downstream of it.

**The one red this session created is `band:noon`, by 0.0002.** §7.1 item 2 has the
mechanism, the arithmetic and the reason no threshold was touched.

### 8.1 `gateaudit` — three failures, all of them `lookcheck`'s

```
  ✗ control failed
  ✗ midAlbedoClusters did not run on the control frames
  ✗ midAlbedoSeparation did not run on the control frames
```

Identical to session 28. **Every `--falsify` self-test underneath passed**, which is what
says the gates themselves are healthy after a session that changed the content they
measure:

```
  perfcheck --falsify   74/74 rejected, 72 failure sites, coverage 100%
                        shape controls 15/16 views (floor 12), worst three-box 0.3216 clears,
                        worst prism 0.0108 does not — both directions held
                        width controls 11/24 views (floor 9), worst taper 0.1424 clears,
                        worst constant-width 0.0197 does not
  citycheck --falsify   61/61 rejected, 61 failure sites, coverage 100%
  inputcheck --falsify  13/13 rejected, coverage 100%
  windcheck, lookcheck  green
```

### 8.2 `perfcheck` — the counts, which ARE admissible, and the population that was at risk

**THE SILHOUETTE POPULATIONS WERE THE REAL RISK OF ITEM 1 AND THEY HELD.** A longer body
is more likely to be *declined* by §7.5's `maxWidthBias` — the bias term scales with
`boxLen × alongSpan / width`, and the bus's is 5.595 against the hauler's 3.425, the
previous worst — and `budget.json` records `nWidth` delivering 5 / 9 / 10 across three
runs against a floor of 5. A bus dropping the count below 5 would have been a NEW red for
a reason no frame would show. Measured on `highway_speed`:

```
  67 vehicles measured                     floor 6     ✓
  ground contrast 0.6876                   floor 0.45  ✓
  tone roughness 0.8448                    floor 0.30  ✓
  chroma clusters 16 delivered / 6 written floor 4     ✓
  roofline over 39: span 0.3826            floor 5 / 0.30, pass 0.846 vs 0.75  ✓
  width over 22 (10 declined for bias): span 0.1785    floor 5 / 0.12, pass 1.000  ✓
  169 pedestrians: width roughness 1.3035, chroma clusters 12                   ✓
```

**Delivered counts, all four routes:**

```
  route            draws  tris    instances  froxel margin  light roles
  downtown_dense    331   1.22M    121 440    63 of 96      aircraft 1, traffic 96,
  highway_speed     431   1.40M    158 350    84 of 96      stall 12, block 52,
  night_rain        334   1.17M    147 652    61 of 96      lamp 196 — UNCHANGED
  player            320   1.18M    121 440    61 of 96      on every route
```

Against `ceilings.drawCalls` 440, `ceilings.triangles` 2 000 000 and
`floors.visibleInstances` 115 000. **`highway_speed` sits at 431 of 440 — nine of margin —
and this session did not move it**, because every instance it added rides in a mesh that
was already drawn. The whole delivered cost of items 1 and 2 is **+480 light instance rows
and +5 760 triangles**, zero new draw calls, meshes, materials or light slots, and the
scene census confirms it: `vehicleLightLines 480 → 960`, `signalHeadBoxes 80`, no
mismatch, no underdraw.

**The ten violations, sorted by what they are:**

- **FIVE ARE MILLISECONDS AND NONE IS A VERDICT.** `downtown_dense` wall 13.20 against
  12.5 on a spread of 1.3; `night_rain` CPU 16.90/12 and wall 18.60/13; `player` CPU
  16.90/12 and wall 18.60/12.5. The machine measured **2.79 → 4.30** through the run
  against CONTRACT §0.2's bar of **1.6**, so §0.2 does not admit an absolute from it. This
  is the fourth session running in which no millisecond in this project has been
  admissible, and `budget.json` → `machine.series.m5` is **still an empty slot**.
- **FOUR ARE THE STOP-LINE DATUM**, 10.81 to 13.07 m on four routes, against session 28's
  10.45 to 13.48 m. Carried, diagnosed, measured before and after (§4), **not repaired**.
- **ONE IS THE TONE PROFILE AND IT IMPROVED**: `highway_speed` 74.6% of 67 vehicles carry
  a non-monotone tone profile against a 75% floor. STATE 28 recorded **71%**. Still red,
  by 0.4 of a point, on a population that grew from the fleet this session widened.

---

## 9. OFFERED FOR CONTRACT §9's TABLE

Offered rather than added, because `parsecheck`'s `contractDocCheck` counts the rows and
the count is a gate — sessions 24, 25, 27 and 28 left rows on the same terms and they are
still owed.

- **a clearance derived to the NOSE and tested from the ORIGIN** — `CAMERA_CLEARANCE`'s
  own comment subtracts *"half a hauler — 9.60/2 = 4.80"* to reach its value, and the test
  was `d2 < CLEARANCE²` on the vehicle's origin. What it delivered was `14.0 − len/2` to
  the body: 11.2 m for the type it was derived against and 8.0 m for a 12 m one. Four look
  assertions went red and the nearest body to the camera was a 3.70 m pod, not the new
  12 m one;
- **a TURN RADIUS run by the ORIGIN, with the body's excursion in the SQUARE of its
  half-length** — `L²/(2R)` is 0.07 m for a motorcycle and 2.25 m for a 12 m bus against a
  1.75 m lane half-pitch, so a defect that is invisible across the whole existing fleet
  becomes a body in the next lane at one new length;
- **the one placement routine in the project with no collision test, and it re-runs 160
  times a second** — `seed()` tested the ring, the river and the camera and nothing about
  what was on the line: 38.5% of re-seats inside an existing body. CONTRACT §9.1's
  placement rule, eighth instance, in the routine nobody thought of as a placement
  routine;
- **a triangle total written from ONE of the two terms that make it** — `traffic.js`'s
  geometry comment read *"480 light quads"*, which is `signalBase` alone, while the mesh
  has been allocated `signalBase + 80` since session 21. Its stated 85 120 was really
  86 080, in a comment nothing checks;
- **a ground-kind mapping with a case for a string the generator never emits** —
  `city.js:2581-2583` maps `q.kind === 'site'` to the `site` category, and `citygen.js`
  emits `siteGround` (`:4903`) and `grass` (`:4775`). Both fall through to `'ground'`,
  which is **not in `CATEGORIES`**, and `mayOverlap` is `!CONFLICTS.has(key)` — so every
  park-grass and construction-site ground rectangle in the delivered census **conflicts
  with nothing**. §9.1's config-the-code-does-not-read, with a category;
- **AND TWICE INSIDE THE INSTRUMENT WRITTEN FOR §9 RULE 7, WHICH IS §7.7 EXACTLY.**
  `fleetprobe`'s turn column first measured the corner's distance from the ENTRY LANE'S
  CENTRELINE, which grows to `TURN_RADIUS` by construction — it read 9.10 m for a
  motorcycle and 12.76 m for a hauler and both numbers were the turn working. Its roof
  column used the GROUND as the subject's datum where §7.4's is the lowest BOX, and read
  0.3363–0.3898 against published figures of 0.3522–0.4482 — the same shapes, a different
  quantity. The first was caught by the numbers being absurd; the second by running the
  control §7.7 requires, and it is the reason that column is reported as indicative and
  not as a verdict.

---

## 10. KNOWN GAPS CARRIED FORWARD

**Unchanged from s8–s28**: `stats().cutoffM` hard-codes 0.8, the headroom probe inert, GPU
timer queries advertised and never retiring, `saturation-peak.png` overwritten every run,
`$fovYDrift`, `camera.setRouteAt(name, 1.0)` at the sky, rain streaks near-invisible wide
at night, `rain_spray` 0 static, **right turns only**, sun shadows to ~170 m, the bake
blind to elevated slabs, the PMREM hitch, the too-red dawn horizon, one worker at queue
depth one, the far half of the river handing back to the night sky past ~300 m, grime
authored, the near-field washboard on the water, the quay wall inside the walkable mask,
props absent from the walkability mask, the 3.5°–10.4° route camera pitch, the frozen/
running A/B, `materials.display` drawn by nothing, and the hauler's marker row buried
inside its own body.

**New gaps this session opened, stated rather than left to be found**:

- **The seeding fallback places a body without the spacing test.** 7 in 843 re-seats, and
  it is the source of all 6 residual overlaps. Counted, not hidden.
- **A bus never turns.** Derived and deliberate (§3.1), but it means buses only ever
  traverse straight lines, so they leave the ring on the axis they entered it.
- **`fleetprobe`'s roof column is not `hullprobe`'s.** Declared in §2.3 and in the tool's
  own header.

**Resolved this session**: the fleet's missing passenger vehicle and missing stepped
elevation; the recycler's absent collision test; the camera clearance's datum; the
centreline-only light row; and the single light signature every vehicle in the project has
worn since session 4b.

**NOT resolved, and it is the first line a reader should carry forward**: `citycheck` →
the bright reserve, **4.52% against a 6.00% floor**. Session 27 broke it by removing the
veil, session 28 established that no content lever it could find moves it, and this
session added the largest street-level emitter the city could plausibly gain and moved it
0.22 points — inside its own noise, in the wrong direction, and 1/27th of a lever that
had already failed.
