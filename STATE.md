# NOCTIS — STATE

*End of session 20. **The `player` route's frame-time breach is not its camera
and it is not its content: it is its measurement window.** Interleaved and
paired, `player` over 6000 frames costs **+1.17 ± 0.07 ms** of CPU p95 against
the same route, same camera, same world over 1800 — sixteen times its own
standard error, same sign on all three pairs —
while giving `downtown_dense` all five of `player`'s camera parameters makes it
**0.70 ms CHEAPER**. And the roof signs did what the two impossibility proofs
said only emission could: the elevated night frame's crushed fraction went
**5.86% → 0.00%** and its textured band **1.64% → 6.52%**.*

Read `CONTRACT.md` before this file, and before any source file.

---

## 0. The honesty line, first

**`npm run gates` is SEVEN OF EIGHT GREEN, and `perfcheck` is red on exactly TWO
assertions. The machine sat at `load1` 1.75 → 1.95 across the battery against a
bar of 1.6, so those two are the closest this session came to a verdict and are
still not one.** The operator's rule and the reason: this machine's absolutes
need the app closed, and this session could not close it.

```
✗ downtown_dense: mean luminance 0.0737 outside [0.08, 0.55]
✗ player:         frame interval p95 12.80 ms > 12.5   (median of 12.7 / 12.8 / 13.6, spread 0.9)
```

**`player`'s CPU p95 is 11.70 and the ceiling is 12.0 — it is GREEN**, where the
attested session-19 run read 12.20. Only the wall p95 breaches, by 0.30 ms
against a 0.9 ms spread, and §5 attributes 1.17 ± 0.07 ms of it to the
measurement window rather than to anything this project renders.

```
✓ parsecheck   86 files — CONTRACT §9's table now declares 52 rows
✓ faultcheck   7 cases, 16 live modules
✓ lookcheck    all eight frames within budget, ZERO suppressions
✓ windcheck    every generated mesh, 4 controls
✓ inputcheck   all three devices deliver their own constants
✓ gateaudit    58 cases, 4 self-tests
✓ citycheck    all six authored-city criteria
✗ perfcheck    2 assertions, AT load1 1.75 AGAINST A BAR OF 1.6
```

**What is evidence in that run and what is not.** §9 rule 6's corollary: counts
do not drift, so the integers below are evidence and the milliseconds beside them
are not — at 1.75 the bar is missed by 0.15 and CONTRACT §0.2 admits nothing
above 1.6.

```
                 draws   tris   instances  froxel margin  cpu p95  wall p95   roles
downtown_dense    329   1.26M    120 698    62 of 96      11.50 ✓  12.50 ✓    aircraft:1 traffic:96
highway_speed     431   1.44M    162 472    84 of 96       9.00 ✓   9.90 ✓    stall:12 block:52
night_rain        334   1.23M    147 726    60 of 96      12.00 ✓  13.00 ✓    lamp:196
player            320   1.24M    120 698    55 of 96      11.70 ✓  12.80 ✗
```

**`floors.visibleInstances` is GREEN AGAIN AND IT WAS RED IN THE MIDDLE OF THIS
SESSION**, which is the one number in this file that most deserves the space it
gets — see §2. **`highway_speed` holds the draw ceiling at 431 of 440**, up 3
from 428. Two are the aircraft's, by construction. **The third is NOT
attributed** and is written down as unattributed rather than guessed at: the
chunk meshes and the merged sign mesh both come and go with what is resident, and
one draw call is inside what a different building layout moves. Triangles 1.44 M
of 2.00 M.

**Nothing was weakened to pass.** No floor moved, no assertion was deleted, no
ceiling was raised. Two thresholds were *added* (`lightRoles.aircraft` as a
ceiling **and** a floor). One number that was already wrong was corrected with
its arithmetic printed beside the old one, twice (§2, §5).

---

## 1. Item 3 — roof signs, and they are the largest emitter this city has

`src/lib/citygen.js` → `ROOF_SIGN` and `pushRoofSign`; `src/modules/city.js`,
the `mount === 'rooftop'` branch; `src/core/constants.js` → `LIGHT.roofSignNits`.

**THE FRAMES, WHICH ARE THE POINT.** Same camera, before and after, `t = 0.0`,
`tools/levels.mjs` over `tools/shot-out/s20-{eleva,street}-{before,after}-t0.png`.
The cameras are written down this time so the next session can reproduce them:

```
elevated  --pos=300,110,190  --target=-150,45,-160  --fov=50  --t=0
street    --pos=300,1.90,9.7 --target=60,4.0,7.0    --fov=55  --t=0
```

```
                     ELEVATED                      STREET
textured 60–221   1.64% →  6.52%  (+4.88)     10.26% → 10.83%  (+0.57)
crushed  ≤2       5.86% →  0.00%  (−5.86)      1.22% →  1.21%  (−0.01)
clipped  ≥254     0.00% →  0.18%  (+0.18)      0.03% →  0.03%   (0.00)
shadow   <60     96.70% → 90.32%  (−6.38)     84.48% → 83.95%  (−0.53)
mean             0.0846 → 0.1396              0.1632 → 0.1658
median code          18 → 25                      26 → 27
```

**The elevated frame's crushed fraction is zero and it was 5.86%.** That is the
region above the window band, which STATE 19 §8 measured at 99.30% shadow and
median code 7 and could not move with a roofscape because *at night a cluttered
black silhouette and a plain one are both black*. §4 of that file and §3.2 of
STATE 18 are two impossibility proofs ending in the same sentence — what moves
that frame is EMISSION — and this is the emission.

**The street frame barely moves and that is honest rather than disappointing.**
It is dominated by a lit facade two metres from the lens; a sign three hundred
metres away and forty metres up cannot compete with it, and nothing in this
session claimed it would.

### 1.1 What was built

- **One or two per qualifying building**, on `0.32 + density · 0.40` — *the same
  roll this file already uses for whether a building carries signage at all*,
  including its `int(1, 2)`. The first version took the probability and dropped
  the count, which is half an anchor.
- **Three mountings**, chosen by what each does to a silhouette rather than by
  what it is: `parapet` (on the upstand), `frame` (raised on a lattice with
  daylight under it — the one that puts a lit rectangle against the SKY, and it
  has the largest weight for that reason), `cantilever` (over the edge, so its
  bottom edge drops below the roof line and it reads from the pavement below).
  0.76 of them are two-faced, decided by what is BEHIND them.
- **Size** off the top tier's own frontage, 0.46–0.86 of it, 6.0–26.0 m wide at
  an aspect of 0.16–0.34 — a band, not a plate.
- **Colour** over `SIGN_CHROMA`'s six, weighted **0.64 to the two low-saturation
  entries**. That is a budget rather than a preference: `citycheck`'s saturation
  reserve is a ceiling on the share of pixels above 0.6 saturation and 0.5 value,
  and an emitter added at this scale in six equal colours is the one change that
  could spend it.
- **15% non-working**, through the SAME condition-driven probabilities a
  shopfront sign uses, so the dead ones cluster on the neglected buildings.
- **Zero draw calls and zero cluster slots.** The faces ride in the merged
  `city:signs` mesh at a tint gain and the frames, legs and brackets ride in the
  chunk's own box mesh.

### 1.2 The radiance, and it moved once with its reason

`LIGHT.roofSignNits` = **1000 cd/m²**. ILP GN01 / CIE 150 give a maximum average
luminance for an externally-read illuminated sign over 10 m²: **E3 (suburban)
600, E4 (urban centre) 1000**. It shipped at 600 for a session-hour and the
correction is the DISTRICT rather than the measurement — `downtown_dense` is 93%
chunk occupancy at `streetAverageLux` = 16 lx, which is an urban centre by every
criterion the standard uses. Picking the row below because it was smaller is
choosing a number for the wrong reason.

Against numbers already in `constants.js`: **4.55× a lit office window**, **11.6×
a shopfront fascia**, **0.111× a lamp bowl**. That ordering is the one the
elevated frame needs — the bowls are all below the camera behind parapets, the
windows were the only thing in that frame, and this sits between them.

**The gain rides in `instanceColor`**, because two materials would be two draw
calls at 431 of 440: `lights.js` injects `totalEmissiveRadiance *= vColor` and
three multiplies the same buffer into `diffuseColor`, so one material at 86 nits
carries both populations. 86 × 11.63 = 1000.0 cd/m². The diffuse side is checked
rather than assumed: the sign material's `color` is 0x101216 ≈ 0.0056 linear, so
the gain puts its reflectance at 0.065 — a dark grey, not a reflectance above 1.

### 1.3 And it did NOT close item 1, which is the part that needs saying

`downtown_dense` mean luminance, the floor being 0.08:

```
session 19, attested quiet (load 1.57)   0.0652   [0.0643 0.0521 0.0652]  range 0.0131
session 20, final battery  (load 1.75)   0.0737   [0.0760 0.0567 0.0737]  range 0.0193
```

**+13.0%, and still under.** The margin is 0.0063 against a per-run range of
0.0193 — **33% of the instrument's own noise floor** — which is CONTRACT §0.1's
original incident with a luminance instead of a millisecond, and it is decided on
a SAMPLE OF ONE while every millisecond beside it is pooled over three. STATE 19
§10 carries that as a known gap; this session measured it and did not repair it.

**And the frame says why.** `tools/perf-out/downtown_dense.png`: a hauler has
come to rest against the lens and fills the bottom-right 40% of the frame with a
dark grey box. `budget.json` already records that discrete state
(`CAMERA_CLEARANCE`), and it is what puts 0.0580 in the middle of that triple.
The roof signs are clearly in the same frame — six of them across the skyline.

---

## 2. Item 4 — the height spread, and a content floor caught it

`src/lib/citygen.js` → `HEIGHT_DISTRIBUTION`, `SETBACK`, `buildingTiers`;
`tools/heightprobe.mjs`.

**Delivered, both arms through the same generator, seed 1337, 432 buildings
(`node tools/heightprobe.mjs`):**

```
                       mean    median   p99   max   sd/mean   Σfloors   facade
uniform 12–64 (s19)   36.13     34.8     65    66    0.425      4400     1186.8
lognormal 34, σ 0.62  38.43     31.1    134   154    0.664      4690     1245.3
```

**sd/mean 0.664 against 0.425 — a 1.56× wider spread at a preserved built
volume, and a p99 at 134 m against 65.** That is the comb broken, and it is the
part of the elevated frame you can see without a histogram.

### 2.1 The floor that caught it, and why the repair is not the mean

**Shipped at STATE 19 §9.5's proposed median of 30, `perfcheck` went red on
`floors.visibleInstances`: 106 501 against 115 000.** A content floor catching a
content reduction, which is exactly what it is for, and §0 rule 5 says the answer
is to put the content back.

**STATE 19 §9.5's arithmetic is wrong in a way §9's table is made of.** It read:
*"a log-normal at median 30 m, σ = 0.62 gives mean 36.4 against the delivered
36.55, i.e. the mean is preserved to 0.4%"*. Those are two different quantities —
36.4 is the log-normal's mean BEFORE `floors = max(3, round(h / era.floor))` and
36.55 is what the uniform delivered AFTER it. Like for like, the uniform's
pre-floor mean is **38.00**, so median 30 was 4.3% short before any flooring.

**And the mean was the wrong quantity anyway.** A window count is proportional to
FACADE AREA, and a setback removes upper-tier PERIMETER as well as height:

```
median   Σfloors   facade    delivered windows + building boxes
 30       −5.4%     −6.2%     105 796   (−10.5% — RED)
 32       +0.9%     −0.4%
 34       +6.6%     +4.9%     121 781   (+3.0% — clear)
```

Median **34**, and the delivered column is `citycheck`'s own scene walk. The
setback insets were softened in the same change, 0.10–0.19 → **0.09–0.16**, for
the same reason and with the legibility stated: the narrowest step is
2 × 0.09 × 11 m = 1.98 m, which is 4 px at 500 m.

`floors.visibleInstances` now reads **120 698 against 116 491 before the
session** — the content is back with 3.6% to spare.

### 2.2 Two bounds that were inert and started biting

- **`buildFacade`'s 34-row cap** was written when the tallest possible building
  was 21 storeys. At p99 = 134 m it would have left **nine buildings of 432 with
  blank walls above about 108 m** — on precisely the towers this session added.
  Now `HEIGHT_DISTRIBUTION.maxM / era.floor`, so it is a bound again.
- **The clamp is 150 m and the delivered maximum is 154**, because
  `floors · (era.floor + jitter)` is applied after it. `LIGHTING.shadowExtent` is
  170, so the margin is real and stated rather than discovered.

### 2.3 Setbacks

`buildingTiers()` is the ONE function that turns a setback description into
boxes, and the massing, the facade, the crown, the roof plant, the parapets and
the signage all ask it. Three transcriptions of *how wide is this building at
40 m* is §9.1's arrangement with an object instead of a number, and the failure
mode is a sign floating beside a wall that stepped away from it.

- **A parapet on EVERY tier's roof.** A step with no upstand is a change of
  width and nothing else; the upstand is the horizontal line that says *this is a
  roof*.
- **The cantilever is suppressed where there is a setback** — a mass cannot both
  oversail and step in at the same level, and the two land at 0.66 and 0.50–0.70
  of the height.
- **A building-scale flush sign is clamped below the first setback**, because
  `city.js` offsets it by the BASE's half-width and it would otherwise hang one
  inset clear of the tier it is bolted to.
- **The occluder keeps the full envelope**, so the canyon bake is conservative by
  the volume the setbacks remove and the worker never has to agree with the main
  thread about a stepped solid. Stated, with the direction.

---

## 3. Item 5 — aircraft, and the first content that moves in three dimensions

`src/modules/aircraft.js`, `src/core/constants.js` → `AIRCRAFT`,
`tools/airprobe.mjs`.

Six airframes: three aeroplanes at 420–900 m, two helicopters transiting at
180–320 m, one orbiting at 150 m with a searchlight. **2 draw calls, 54
instances, 648 triangles, ONE cluster slot.** Navigation lights are red to port,
green to starboard, white aft, a white strobe at 90 flashes/min and a red beacon
at 45 — FAR 23.1385 and 23.1401, and all thirty are emissive geometry at zero
slots by the same argument the vehicles' tail lamps make.

**It finishes session 19's thought.** The eighteen red obstruction beacons on the
condenser and the mast are derived from ICAO Annex 14 and exist FOR AIR TRAFFIC.
Built with nothing in the air they are a light that warns nobody.

### 3.1 §5.12's threshold suppresses something for the first time

`budget.json` records that the 4 px motion-vector threshold *"suppresses nothing
today: traffic is simulated inside 190 m and pedestrians inside 120 m against
cutoffs of 560 m and 174 m. It is a bound, not an optimisation."* Not any more:

```
fuselage 1.35 m → cutoff 521 m   against altitudes 150–900 m
                                 → 5 of 6 airframes suppressed on a typical frame
nav lamp 0.22 m → cutoff  85 m   under every altitude
                                 → every lamp row carried, every frame
```

Printed at init by the module, because a threshold that starts binding should say
so in its own voice.

### 3.2 Two defects found by looking, both §9's shape, both now in the table

- **The first sky frame was empty.** A 0.22 m lamp at 1000 m is **0.34 px**, and
  a sub-pixel emitter is not dim — it is absent. The repair is not "bigger": the
  box is grown to a 3 px floor (`particles.maxStreakWidthPx`'s own number, one
  system over) and its radiance divided by the same area ratio, so the delivered
  INTENSITY is 40.2 cd at every distance and the enlargement is a resampling.
- **The searchlight lit nothing.** `radius` was 260 m for a beam whose ground
  point is 155–249 m down the axis, and three's `getDistanceAttenuation(d, R, 2)`
  carries a Frostbite window `(1 − d/R)²` — so the pool got **0.0018** of the
  intensity, i.e. 0.04 lx. §9 row 6b is the same window with a headlamp. Sized
  the window first (R = 850 m, window 0.50–0.66 across the sweep), then derived
  the intensity through it: **3 300 000 cd → 90.8 lx at the steep end and 26.6 lx
  at the shallow one**, against `streetAverageLux` = 16 and against a real
  Nightsun's ~1300 lx. The sweep's shallow end moved 25° → 37° for the same
  reason: `asin(150/260)` = 35.2° is where the beam first reaches the ground
  inside its own falloff.

`tools/shot-out/s20-air-searchlight.png` is the pool on a tower from above;
`s20-air-5-orbiter.png` is the airframe with its port and starboard lamps.

### 3.3 The leash, stated rather than hidden

The orbit centre follows the camera through a first-order lag, τ = 20 s, and
SNAPS beyond 600 m. That is a game convention: a real police helicopter orbits an
incident, not a viewer. It is recorded as a deliberate exaggeration, the same
shape as `PLAYER.walkSpeedMps` at 1.71× the Froude bound, and the licence is the
same — nothing is derived from it. The snap exists because `setShotAt` moves the
camera hundreds of metres between two frames and a 20 s lag closes 0.08% of that
in one; a snap is a recycle and it carries the orbiter's motion rows.

---

## 4. Item 6 — the HUD, and the two things it refuses to do

`src/modules/hud.js`, `src/core/loop.js` → `timing()` / `reportOverhead()`,
`src/core/constants.js` → `HUD`. `H` cycles **off → minimal → render → world →
derivations**. `?hud` follows `?player=1`, so no gate's `<body>` moved.

- **minimal** — frame p50/p95, CPU p95, fps, and a one-second graph of the
  delivered interval at a FIXED vertical scale of twice the ceiling. An
  autoscaled graph rescales when the thing it shows gets worse, which is the one
  failure a stutter graph cannot have.
- **render** — draws, triangles, instances, clustered lights of 384, peak froxel
  occupancy, target and chunk memory, internal resolution against the drawing
  buffer, the GPU string.
- **world** — position and heading off the camera's own basis, clock, chunks,
  bake queue, traffic, crowd, roof-sign count, weather, wetness, visibility,
  photocell, and the aircraft's §5.12 suppression count.
- **derivations** — `ctx.logLines`, which is new: every §9 rule 4 derivation this
  project prints at boot now goes to a bounded transcript as well as to a console
  nobody had open. The river's Cox–Munk figures, the gait's foot creep, the
  canyon field's openness, the motion cutoffs, this session's roof-sign bloom
  energy. **Bounded at 200 and it drops the TAIL**, because what this is for is
  the first lines.

**Green under the ceiling, amber from 90% of it, red over, and the ceiling
printed beside the value.** 90% rather than 95% because §0.2 measures this
machine's wall-p95 spread at 0.45 ms against a 12.5 ms ceiling — 3.6% — so amber
starts 2.8 spreads out and a green reading is green by more than the instrument's
noise. A colour that flickers on an unchanged machine is §0 rule 6 with a colour
instead of a verdict.

**It does not lie about itself.**

- Measured around the **rAF callback** in `loop.js`, not around `ctx.render()`.
  A timer around the draw omits every `update()` — traffic, streaming, the crowd,
  the chunk builder — which is most of the CPU cost, and a HUD reporting that
  would disagree with `perfcheck` about the same machine.
- Its **own cost is measured and subtracted**, through
  `loop.reportOverhead(ms)`, and the subtracted total is displayed so the
  correction is visible. This is the failure `filmshot` caught when a PNG
  readback landed inside the frame interval and the tool reported an encoder as
  the renderer.
- **It will not print a measured EV, and it says so on the panel.** The number
  lives in a 1×1 GPU target and CONTRACT §5.4 forbids the readback —
  *"it stalls the pipeline and would make the instrument the thing that blows the
  budget"* — so the panel prints the exposure LAW and its declared window plus a
  line naming where the measurement is. A HUD that stalled the pipeline to fill a
  field would be the second requirement broken to satisfy the first.

**`HUD.budgets` is a checked copy.** A module may not import `tools/budget.json`
(§2.2), so six ceilings are duplicated in `constants.js` and `perfcheck` asserts
the two agree, printing both — with a falsifying case that drifts one key.

---

## 5. Item 2 — the `player` breach is its MEASUREMENT WINDOW, and here is the arithmetic

`tools/routeprobe.mjs`. Interleaved, paired, a fresh page per arm, and the
reported statistic is the mean of the per-pair differences with its standard
error, so drift common to a pair cancels instead of being attributed to whichever
arm ran second (§6's rule, and the 1.3 ms it cost session 4b to learn).

**First, the brief's premise needs one correction.** The `player` ROUTE's fov is
**50** and `downtown_dense`'s is **55** — the walking route is the NARROWER one,
so it puts fewer objects in frustum and more pixels on each. 75° is the PLAYER
MODULE's field (`inputcheck` reports it), which no route uses.

### 5.1 It is not the camera. Giving `downtown_dense` all five of `player`'s camera parameters makes it CHEAPER

`node tools/routeprobe.mjs --decompose --pairs=2 --frames=1800`
(`tools/perf-out/s20-decompose.log`), Δ is CPU p95 against the base, paired:

```
base (downtown_dense)   11.55 ±0.15 ms          —
  + fov      50          11.45 ±0.05         −0.10 ±0.20     inside its own error
  + eye      1.90        11.65 ±0.05         +0.10 ±0.10     inside its own error
  + speed    1.40 m/s    10.85 ±0.05         −0.70 ±0.10     CHEAPER
  + lookRise 0           12.35 ±0.15         +0.80 ±0.00     dearer, and the only one
  + lateral  +9.43 m     11.15 ±0.25         −0.40 ±0.40     unresolved
  + all five             10.85 ±0.05         −0.70 ±0.20     CHEAPER
```

**Every candidate the brief named is refuted.** The fov is inside its own error;
the eye height is inside its own error; the walking pace is *cheaper*, which is
what a streaming system does when it is asked for a third as much new world. The
one parameter that costs anything is **`lookRise: 0`, +0.80 ms** — a level gaze
puts the near facades and the road across the whole frame where an 8.13° upward
pitch spends 233 rows of 1440 on sky. And the five together are still 0.70 ms
CHEAPER than the base.

**The sum of the five singles is −0.30 ms against −0.70 ± 0.20 for all five
together**, so they are not separable and the 0.40 ms gap is an interaction —
which is the thing a five-way difference hides and the reason the sixth arm
exists.

### 5.2 It is the window, and the effect is seventeen sigma

`node tools/routeprobe.mjs --window --pairs=3` (`tools/perf-out/s20-window.log`).
Same route, same camera, same content, same seed — only `frames`:

```
player @ 1800 frames   cpu p95 10.73 ±0.09   wall p95 11.70 ±0.10   42 m travelled
player @ 6000 frames   cpu p95 11.90 ±0.15   wall p95 12.90 ±0.15  140 m travelled
                       Δ cpu p95  +1.17 ±0.07 ms      3 of 3 pairs, same sign
```

**+1.17 ms, standard error 0.07 — sixteen times it, and the same sign on all
three pairs.** The final battery reads `player` at CPU p95
**11.70 against a 12.0 ceiling — green** — and wall p95 **12.80 against 12.5**,
a breach of 0.30 ms. Subtract the measured window cost from the wall figure and
the same route over the same 1800 frames the other three get reads **11.63,
inside the ceiling by 0.87 ms**. The window is 3.9× the breach.

**And `budget.json` already contains the argument it did not make about itself.**
`capture.$estimator` says, of pooling frames across RUNS: *"THAT IS A DIFFERENT
QUANTITY. `wallFrameMsP95` was derived against a single run's p95; the p95 of
frames pooled from three runs is the 95th percentile of a MIXTURE…"*. The same
sentence is true of a per-run p95 over a **3.33× longer window**:
`capture.framesByRoute` gives `player` 6000 frames for a correct and documented
reason — 1800 covers 42 m against a 120 m floor, and *"lengthening the window
makes the gate stricter"* — and it is 100 simulated seconds and about 80 of wall
clock against 30 and 24. On a machine whose drift is one-sided, a p95 over 3.33×
the frames is not the p95 the ceiling was written for. **§9's table, and it is
the gate's own two numbers in the same file.**

### 5.3 NOTHING WAS MOVED, and that is deliberate

`ceilingsByRoute` exists and `night_rain` already has an entry, so a `player`
override of 12.0 + 1.17 would be one line. **It is not written, for one reason:
+1.17 was measured at `load1` 3.5–4.2 and a hitch-driven term scales with load,
so a ceiling derived from it would be looser than a quiet machine warrants.** The
repair is the operator's call and it is one of two: re-measure the window cost at
the §0.2 bar and give `player` a derived ceiling, or make the comparison
like-for-like. The instrument is built and both arms are one command.

---

## 6. What the gates say about the rest of it

- **`citycheck` all six green.** Saturation reserve **10.47% pooled peak
  against a 12% ceiling**, up from 9.19% before the session — this is what the
  roof signs actually spent, 1.28 points of a 2.81-point margin, and the 0.64
  chroma weighting toward white is the only reason it is not over. **The next
  session adding a saturated emitter at scale has 1.53 points left.** Bright
  reserve 9.13% against a 6.00% floor. Sign mountings **5 distinct** (flush,
  freestanding, projecting, roof, rooftop) over 612 generated signs, of which
  **262 over a 10 × 10 chunk region are the new rooftop kind** (`heightprobe`).
  **0 of 1 100 delivered sign quads inside a building**, against 578 quads before
  the session.
- **One placement defect found and refused rather than moved.** The first run
  reported **1 of 908 sign quads inside a building**. It is not the sign's own
  building — a roof sign's centre is above its own occluder's top by
  construction — it is STATE §10's carried gap, *the four island frontages
  overlapping at the corners*. The generator walks each side independently, two
  runs meet at a corner, and a roof sign on the shorter of the pair stands inside
  the taller one forty metres up. Refused, on the gate's own condition, in the
  same shape as the pylon's placement test. **It does not repair the overlapping
  BUILDINGS**, which are still §10's gap.
- **`faultcheck`'s module list is two-sided and caught the new module within a
  minute of its existing** — `aircraft is live but should not be`, seven times,
  because nobody had written it down.
- **The HUD's own derivations panel caught a defect in a line the HUD prints.**
  `city.js` → `reportRoofSigns` fired as soon as 24 faces were resident, which on
  a cold start is about a fifth of the ring, and printed **47 faces / 1992 m²**
  as though it were the delivered total. The world panel said `roof signs 513` in
  the same frame. It now waits for the residency count to stop changing and
  prints **513 faces over 121 chunks, 19 490 m², 161 m² of emitter per chunk** —
  and says in its own words that the 13.7× against the lamp bowls is an UPPER
  BOUND rather than a measurement, because the 98 bowls are what the pool lights
  within 150 m and this is everything resident over a 1.4 km square. What a frame
  receives is `levels.mjs` on a frame, which is §1.

---

## 7. What the next session starts from

1. **`tools/quiet-gates.sh` with the app closed.** Every millisecond in this file
   was measured between `load1` 2.3 and 4.2 against a bar of 1.6. The counts are
   evidence; the timings are not. No orphan vite servers were resident at the
   start of this session and none was left.
2. **The level assertions are the last un-pooled statistic in `perfcheck`**, and
   this session measured what that costs: `downtown_dense`'s mean luminance was
   decided against a per-run range of **0.0193** with a margin of **0.0063** —
   33% of the noise floor. §0.1 says its own correction *"applies to every
   measurement in this project and not only to this gate"*. Pooling by the median
   of per-run means would NOT make this green (the median is 0.0737), which is
   precisely what makes it safe to do: it cannot be a loosening. The two
   falsifying cases (`floor.meanLuminance`, `floor.screenshotEntropy`) would have
   to perturb every run rather than the last, exactly as the timing cases do.
3. **`player`'s ceiling, at the quiet bar.** §5.3. One command each way.
4. **Assert `traffic.stats().worstStopLineM >= 0`** in `budget.json` and
   `perfcheck`. Carried from session 19; the instrument is built and the
   assertion is still five minutes.
5. **Item 2, the viaduct — NOT STARTED, diagnosis carried.** Piers in the
   streamed north–south carriageway at x ≈ 0, deck ending inside buildings at
   z ≈ −229 and +251, no traffic on the deck. The river's session-15 treatment is
   the pattern.
6. **Item 8, vehicle light signatures — NOT STARTED.** One stripe front and back
   on every vehicle, across five body types, twelve chroma clusters and four
   eras. Four axes at zero cluster slots.
7. **Item 14, pop-in — NOT STARTED, diagnosis carried.** `seed()` takes the
   maximum `ahead` over twelve candidates, so a vehicle can materialise 14 m dead
   ahead in the camera's own lane.
8. **Markings.** `CITY.stopLineFromJunctionM` has been waiting since session 19
   for the line to be painted from the same number the traffic brakes against.
9. **The corner overlap between island frontages** is now something new content
   stands inside rather than merely something buildings do. §6.

---

## 8. Known gaps carried forward

**Unchanged from s8–s19**: `stats().cutoffM` hard-codes 0.8, the headroom probe
inert, GPU timer queries advertised and never retiring, `saturation-peak.png`
overwritten every run, `$fovYDrift`, `camera.setRouteAt(name, 1.0)` at the sky,
rain streaks near-invisible wide at night, `rain_spray` 0 static, right turns
only, sun shadows to ~170 m, the bake blind to elevated slabs, the PMREM hitch,
the too-red dawn horizon, one worker at queue depth one, the four island
frontages overlapping at the corners, the far half of the river handing back to
the night sky past ~300 m, grime authored, the near-field washboard on the water,
the quay wall inside the walkable mask, props absent from the walkability mask,
the 3.5°–10.4° route camera pitch, the frozen/running A/B, and the three level
assertions still a sample of one.

**Resolved this session**: the elevated frame's crushed fraction (5.86% → 0.00%);
the `player` route's breach, as an ATTRIBUTION rather than a repair (§5); the
two-literal parapet height; `buildFacade`'s inert-then-binding row cap;
STATE 19 §9.5's pre-floor/post-floor mean.

**New this session, all recorded above**: a sub-pixel emitter's radiance used
where its intensity was the quantity; a searchlight's slant range used as a
distance inside its own falloff window; a log-normal's pre-floor mean compared
against a uniform's post-floor delivered one; a 34-row facade cap derived against
a 66 m world and applied to a 150 m one; `1.05` written twice under a comment
claiming one read the other; and a roof sign standing inside the building next
door because two island frontages overlap at a corner.
