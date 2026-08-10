# NOCTIS — STATE

*End of session 18. The operator walked the city at night and sent back a list
of eleven things. **Three of the eleven turned out not to be what they looked
like, and finding that out is most of what this session produced.** The mouse
and keyboard were never broken — all three input devices deliver their own
constants, measured four ways, and the project now has a gate that says so. The
traffic signals were never decorative — they were real, read by every vehicle,
and the red light simply had no HOLD, because `toStop > 0` was standing in for
"may I proceed". The origin block has no road markings for the streamed city to
be missing — it has a kerb coping strip, and nothing in this project has ever
drawn a marking. Two real defects were fixed, one correction was **measured,
refuted and reverted**, and the night frames still look the way the operator
said they look.*

Read `CONTRACT.md` before this file, and before any source file.

---

## 0. The honesty line, first

**Six of the eleven items are not done.** Items 3 (dynamic range), 4 (upward
glow), 5 (markings and kerb), 6 (pop-in), 9 (map) and 11 (warning lights) are
diagnosed to the file-and-line and not implemented. §7 is what each of them
actually needs, and every one of them is now a smaller job than it was this
morning because the diagnosis is done and, in three cases, the obvious repair is
proven wrong.

**What shipped:** the traffic hold (§2), a NaN in a shader uniform (§3), the
player's field and pace (§4), `inputcheck` — a new gate (§5), and
`tools/levels.mjs` — a new instrument (§1).

**`npm run gates` DID NOT COMPLETE, AND IT FAILED ON THE MACHINE RATHER THAN ON
A THRESHOLD.** Six of eight are green on the final tree:

```
✓ parsecheck   79 files
✓ faultcheck   7 cases
✓ lookcheck    all eight frames within budget, ZERO suppressions
✓ windcheck    4 controls
✓ inputcheck   NEW — all three devices deliver their own constants
✓ gateaudit    58 cases, 4 self-tests (perfcheck, citycheck, windcheck, inputcheck)
? citycheck    all six criteria on the run before the last edit; HUNG on the re-run
? perfcheck    exit 2 — "Execution context was destroyed" mid-route
```

Both question marks are the same fault and it is not a threshold: chromium was
killed under memory pressure and the gate sat waiting on a page that no longer
existed — `citycheck` measured **0.0% CPU for 13 minutes**. `load1` was **2.65
to 3.22** throughout, against a bar of **1.6** (CONTRACT §0.2), with two orphan
vite servers resident. This is the observer being the load, exactly as recorded,
and it means **no absolute measured this session may be read as a verdict.**
`downtown_dense` reported cpu p95 13.70 ms against a carried 10.90 on the same
content — that is drift, not a regression, and it is one-sided.

**`tools/quiet-gates.sh` with the app closed is the only thing that can close
this**, and it is still the operator's. It is now also the only thing that can
confirm the two carried reds and whatever the wider player field costs.

**Carried red, unchanged and untouched:** `downtown_dense` mean luminance
0.0653 against [0.08, 0.55]; the `player` route's 13.50 / 14.30 ms. Neither was
worked on. **Nothing was weakened to pass.** One number was changed, measured,
found worse, and put back — §3.2.

---

## 1. The instrument that had to exist first

`tools/levels.mjs` — NOT A GATE — and `lookmetrics.tonalHistogram()`.

The project has counted the two ENDS of the histogram since session 1
(`clippedWhite` at code ≥ 254, `crushedBlack` at ≤ 2) and asserted a mean and an
entropy. **Not one of those four can see the reported failure.** Both ends can
sit inside their bounds while there is nothing in the middle, and the mean of a
bimodal distribution sits where there are no pixels — STATE 17 §6 already said
so with `median/mean` and nothing acted on it.

The middle band is derived rather than picked: the Zone System's TEXTURED range,
Zones III–VII, an 18% reflector ±2 stops through the sRGB OETF, computed from
0.18 rather than written down as 60 and 221 so the two cannot drift from the
definition.

**The operator's two frames, measured:**

```
                                pavement, x=300, eye 1.77, t=0.0   elevated, over the condenser
crushed  ≤2                                   2.53%                          1.41%
below Zone III (code 60)                     85.11%                         97.29%
TEXTURED, Zones III–VII                      12.15%                          0.99%
above Zone VII (code 221)                     2.43%                          1.69%
clipped ≥254                                  0.10%                          0.00%
median code                                      24                             13
```

**The top end is barely clipping at all — 0.10% and 0.00%.** "The bright is
blown" is the *contrast* reading of a 2.4% highlight population against an 85%
shadow population with bloom spreading the highlights, and "the dark is very
dark" is 85–97% of the frame below the range a print can hold. That is one
statement about one distribution, exactly as the brief said, and it is now a
number instead of an impression.

**And the after-frames are the same frames**, which is the session's headline
and is stated here rather than buried:

```
                  pavement                        elevated
textured   12.15% → 12.12%  (−0.03 pts)    0.99% → 1.01%  (+0.02)
crushed     2.53% →  2.58%  (+0.04)        1.41% → 1.97%  (+0.56)
clipped     0.10% →  0.10%  (0.00)         0.00% → 0.00%  (0.00)
mean       0.1419 → 0.1418                0.0756 → 0.0762   median 13 → 14
```

Nothing that moves this histogram shipped, because the one change that moved it
moved it the wrong way (§6) and the one that was a genuine correctness fix moves
it by hundredths of a point (§3.1). **The night frames still look exactly as the
operator described them**, and §7 is the list of what would change that.

Frames: `tools/shot-out/s18-{pavement,eleva}-{before,after}-t0.png`, plus the
`-lampfix-` pair that measured the refuted correction.

---

## 2. Item 1 — traffic. The signals were real; the red light had no hold

**The premise in the brief was wrong in the useful direction.** `signal(axis,
now)` is real, every vehicle reads it (`traffic.js`, the per-vehicle block), the
two axes are never simultaneously green, and 4b's "legible stopping" was
implemented. What was missing is that **a stopped vehicle was released.**

The whole stop was one expression guarded by `toStop > 0`:

```js
if (phase !== 0 && toStop > 0) limit = min(limit, sqrt(2·BRAKE_A·toStop))
```

`toStop > 0` was standing in for *may I proceed*, and it is not that quantity —
it is *am I short of the line*, **which stops being true the moment the vehicle
arrives.** The approach profile `v = sqrt(2·a·s)` reaches the line at v = 0 in
finite time, the guard goes false, the constraint disappears, and the vehicle
accelerates at 1.4 m/s² into the junction on a red light from a standing start.
CONTRACT §9's shape with two predicates instead of two lengths, and it is now
row 17d in that table.

**The repair is a permission keyed by the junction**, which is the reservation
model the brief asked for with the property that makes a table unnecessary: the
phase already guarantees the crossing axis is red, so the conflict set is
`{this junction}` and permission cannot carry because `nextJ` changes when the
vehicle passes it. Granted on green, or on amber inside the dilemma zone;
**never on red**; revoked if the phase leaves green while there is still room to
stop comfortably; kept once inside the box, because the one thing worse than
entering on red is stopping in the middle. The hold is `max(0, toStop)` so a
vehicle a centimetre over the line is limited to zero rather than released by
the sign of its own position.

**Measured, over one whole 36 s cycle, `stats().holdingAtRed`:**

```
t   1.7  3.2  4.7  6.2  7.7  9.2 10.7 12.2 13.7 15.2 16.7 18.2 19.7 21.2 22.7 ...
n    11   12   21   21   25   25   26   27   29   29   29    0    0    0    2 ...
```

The queue builds to 29, empties **exactly at t = 18.2 s** — `GREEN_S + AMBER_S`
is 18 — rebuilds on the crossing axis, and empties again at 36.2 s, which is the
cycle. Before this change that number was **structurally always zero**: there
was no state in which a vehicle was stopped and held. Cost: one integer field
per vehicle, two comparisons per vehicle per frame, 160 vehicles — no allocation,
no table, no per-frame sort.

**What is NOT fixed, and it is the second half of the item.** A vehicle inside
`veh.turn` is excluded from `tracks` (`if (veh.turn) continue`), so for the
1.47 s of its quarter circle it follows nobody and nobody follows it, and it
rejoins the crossing road at a computed arc length **with no occupancy test** —
CONTRACT §9.1's "placement without a collision test against what is already
there", with a vehicle instead of a prop. Right turns happen on green onto a red
axis, so the exit lane is usually clear, which is why this is the smaller half;
it is not zero.

---

## 3. Item 4 — one real bug, and a structural proof that the rest of the item is not the fix

### 3.1 `uNoctisFieldDefault.z` has been NaN

`city.js` measures the facade openness off its own horizon march, logs it beside
the roadway figure and the ratio between them, and passes all three numbers to
`canyon.setFieldDefault`. **The forwarder in `canyon.js` took two.** So
`lights.setFieldDefault` evaluated `Math.min(1, Math.max(0.04, undefined))` =
**NaN** into `uNoctisFieldDefault.z`, which `noctisDefaultField` mixes into the
sky visibility of every surface in every chunk **without a baked field** — that
is everything past the 30-slot field ring, which at the elevated night view is
most of the city and all of the skyline. The measured 0.244 that `city.js` has
printed at boot for four sessions had never reached a shader.

Fixed. **Measured effect is small and honest about it**: textured 0.99% → 1.00%,
mean 0.0756 → 0.0765, median code 13 → 14. It is a correctness fix, not a look
fix — a NaN in a uniform is never acceptable and the driver's clamp was
evidently landing somewhere near the intended value.

### 3.2 The upward-glow term is 0.27 lux and cannot light a skyline

Derived rather than argued, twice, from opposite ends, agreeing:

**From the physics.** Treat the lit city as a horizontal Lambertian plane of
exitance `M = ρ·E·f`, with `LIGHT.streetAverageLux` = 16 lx, road albedo 0.10
and a lit-corridor plan fraction of 0.33 → M = 0.53 lm/m². A vertical facade at
height h sees it through a form factor
`G(h) = (2/π)∫₀^{π/2} cos²φ · e^{−σh/sin φ} dφ`, which is exactly 0.5 at h = 0
and falls with height through the extinction σ = 4.5e-4 /m. So E_v(0) = 0.27 lx,
and on a 0.35 facade that is **0.030 cd/m² — about 1/17 of the road's own
0.51 cd/m²**, which lands at sRGB code ≈ 2. The term is real and it is
invisible.

**From the frame.** Sampled on the delivered elevated frame: condenser shaft
mean code **5.7–6.7 over a 2-code span**, sky immediately beside it at the same
rows **16.8**, horizon glow band 22.1. The condenser is already receiving very
nearly its correct airlight (τ = σ·490 m = 0.220, so 19.8% of the path) and
almost no surface illumination.

**And the ceiling is structural.** A Lambertian surface under a uniform
hemisphere of radiance `L_s` returns at most `ρ/2 · L_s` = 0.197·L_s at the
condenser's albedo. **No ambient term of any magnitude can bring an unlit wall
within 5× of the sky it is seen against.** Skylines are dark in real photographs
for the same reason. What makes a real upper storey read is its own emission —
which is **item 11's job, not item 4's**, and item 11 is therefore promoted from
"cheap and nice" to "the fix for item 4".

Two further findings on the same path, both unfixed: at midnight `eSun` is
**exactly [0,0,0]** (the transmittance integral returns zero for any negative
elevation) and `eSky` excludes the urban glow, so `computeRadiance`'s ground
radiance is exactly zero and the four facade radiances collapse to
`S.facadeEmissive`; and the bent-normal steer tilts the sampling lobe 50.7° off
a vertical wall, cutting the one place street lighting *does* reach a facade
from 1.166 lux to 0.264 lux.

---

## 4. Item 7 — the field was the larger half, and it is derived

`PLAYER.fovDeg` **50 → 75**, `PLAYER.walkSpeedMps` **new, 2.00 m/s**.

The derivation is **optic flow**, which is the cue the brain reads as speed. The
ground point on the bottom edge of the frame is at `d = h/tan(fov/2)`, and as the
walker advances it sweeps at `dθ/dt = v·h/(h² + d²)`:

```
fov 50°   d = 3.73 m   flow  8.23 °/s   1.00×
fov 70°   d = 2.48 m   flow 15.17 °/s   1.84×
fov 75°   d = 2.27 m   flow 17.08 °/s   2.07×   ← here
fov 90°   d = 1.74 m   flow 23.05 °/s   2.80×
```

**The field alone is worth 2.07× the apparent pace** — 1.40 m/s at 75° flows
exactly as fast as 2.90 m/s did at 50°, which is already inside the 2.5–4 m/s
band first-person games use. That is why the speed only had to move to 2.00 and
not to 4, and the two are recorded separately because they were measured
separately. Bounded above at 90°, where `d` falls to the eye height itself and
the ground under the camera is in shot.

**`PLAYER.walkSpeedMps` is not the split-constant defect, and the constant says
why at length.** `GAIT.walkSpeedMps` = 1.40 is an input to a BIOMECHANICAL
MODEL — `stepM` = 0.75 m is derived from it, the cycle frequency from that, the
bob from the cycle — and a figure drawn at a speed its step length was not
derived for slides its feet. The player's is a CAMERA TRAVERSAL RATE with no
gait attached. Session 17 coupled them, which is why "make the player faster"
read as "make the crowd faster" and could not be done. **The cost, named:**
2.00/1.40 = **1.43× the crowd's mean**, 1.05× its fastest walker — the player
overtakes slowly rather than sweeping past, which is what keeps the pedestrians
reading as people. Bounded above by `RUN_TRANSITION_MPS` = 2.048 m/s: at 2.00 it
is 0.976× of the Froude-0.5 boundary, i.e. the fastest thing this project's own
physics will still call a walk.

`PLAYER.radiusM`'s near-plane-corner bound was **re-derived rather than left
pointing at a field nothing uses**: at 75° the corner is 0.1857 m and 0.25 m
clears it by 1.346× where it used to clear 0.1380 m by 1.811×. At 90° it would
be 1.101×, which is the number that makes the next widening check itself.

**The route captures are untouched.** Every gate and both film tools set their
own fov on every placement; this constant is read by `player.js` and by nothing
a gate drives.

### 4.1 And widening the field broke a constant in another block, which is the session's neatest instance of its own failure mode

`PLAYER.lookCurveExponent` **2 → 1.75.** Its derivation is written in pixels per
frame, so its upper bound moves with the field and its lower bound does not:

```
                                 fov 50°           fov 75°
one pixel                        0.0310°           0.0420°
upper bound (0.1 defl ≥ 1 px)    k ≤ 1.986         k ≤ 1.854
lower bound (½ defl ≤ 1°/frame)  k ≥ 1.585         k ≥ 1.585
k = 2 delivers                   0.97 px/frame     0.71 px/frame  ← outside
```

**The value did not move; the quantity it was derived from did, and nothing
linked them.** k = 2 at fov 75 is the second dead zone the bound exists to
forbid — created a few hours earlier by an edit to a different constant in the
same file. §9 table row 18c. 1.75 is 1.10× above its lower bound and 1.06× below
its upper, the first value in that block's history to sit inside both with
margin rather than exactly on one.

Three more of the same family, found by re-reading the session's own changes:

- **`PLAYER.mouseRadPerCount` retyped its own inputs.** It was
  `(2·π)/((40/2.54)·800)` two lines under `mouseCmPer360: 40` and
  `mouseCpi: 800`, so editing either constant changed what `player.js` PRINTS
  and not what the mouse DOES. It is a getter over the two now.
- **`camera.js` → `ROUTES.player.speed` was the literal `1.4`** under a comment
  saying "`GAIT.walkSpeedMps`, read from the lib the pedestrians read", in a
  file whose only import was `three`. §9.1's "a comment that claims a link".
  `camera.js` now imports `../lib/gait.js` — which §2.2 has always allowed — and
  the comment is true. It stays at the CROWD's 1.40 and deliberately does not
  follow `PLAYER.walkSpeedMps`: that route exists to measure the city at the
  crowd's own pace, and tracking the player would break comparability with
  STATE 17 §4.
- **CONTRACT §9's table said "twenty-five" against 39 delivered rows**, in the
  sentence that says the count "is now derived by counting the rows, which is
  the only way it stays right". It was wrong a third time, in the section about
  claims about checks. It is 42 now, and the four-line command that counts them
  is printed beside it instead of the claim.

---

## 5. Item 2 — the input layer was never broken, and now there is a gate that can say so

**Measured four ways, all negative:** real browser key and mouse events through
the real listener targets, in the dev server and in the built `dist/` bundle,
with and without a gamepad connected, in the real rAF loop and under
`harness.step()`. Keyboard 1.39 m/s (the constant exactly), pointer lock
acquired on a canvas click, mouse yaw at 0.02857°/count (`PLAYER.mouseRadPerCount`
exactly), gamepad walking and looking. A fifth independent check drove
`createPlayer()` against a stub DOM with no app at all and got the same numbers.

So the honest report is: **on this machine the input layer delivers everything
session 17 specified.** Whatever refused, refused somewhere this session cannot
stand. Two things follow, and both are built:

- **A failed lock is no longer silent.** Session 17 requested pointer lock and
  never asked whether it arrived, so "the mouse is not wired" and "the browser
  refused the lock" produced the same frame and the same silence. There is now a
  `pointerlockerror` handler, a rejection handler on the promise Chrome returns
  and Safari does not, a `warnOnce`, and `lockError` on `state()`.

- **`tools/inputcheck.mjs`, a gate, and the magnitude is the whole design.** The
  obvious test is "press W, assert the player moved" — **and that test passes on
  the build that was reported broken.** A boolean instrument cannot tell "not
  wired" from "wired and imperceptible", and those need different repairs. Every
  assertion compares a DELIVERED quantity against the constant that is supposed
  to produce it, never against another declaration (§9.1's own remedy). The
  mouse additionally carries a **usability band in cm/360°**, bounded below by
  one count per pixel (27.2 cm at fov 75) and above by a 180° turn in one 30 cm
  sweep (60 cm) — which is the assertion that can tell the two failures apart.
  Delivered: 40.0 cm, inside both.

```
inputcheck — delivered response, through the real listeners
  keyboard  walk 1.990 m/s / declared 2.000   run 3.476 / 3.500   strafe dot -0.0000
  gamepad   walk 1.990 m/s   look 178.58°/s / declared 180.00
  mouse     0.02858°/count / declared 0.02857 = 40.0 cm/360° (band 27.2–60)  lock acquired
  authority 1 s of stick = 180°, one 30 cm sweep = 270°, ratio 1.50 (bound 3)
  field     fov 75.00° / declared 75.00°
```

`--falsify`: 13 cases against 12 failure sites, 100% coverage, good fixture
clean. Added to `npm run gates` before `gateaudit`, and to `gateaudit`'s
`SELF_TESTS`, so there is still exactly one meta-gate.

**And the gate caught an error in itself within the hour, which is CONTRACT §7.7
happening in the file written to catch it.** The first draft measured the pad's
look rate by subtracting two wrapped yaw angles. A full stick turns 180 °/s, so
a 1.2 s sweep turns 216°, which wraps to −144, and the gate reported 117.4 °/s
and failed the one device the walkthrough said was working. It now accumulates
short legs. An instrument that measures an angle by subtracting two wrapped
angles is measuring the wrap.

---

## 6. Item 3 — a real quantity confusion, measured, and put back

`LIGHT.streetlampNits` = 9000 is **not a radiance.** It is an INTENSITY OVER A
PROJECTION: the bowl is a sphere of radius 0.42 m whose projected area is
π·0.42² = 0.5542 m², and `streetlampCandela` / 0.5542 = 12 270 cd/m². The
radiance of an emitting surface is its flux over its own area, and every number
needed already existed in the project without ever having been written on one
line:

```
Φ = luminaireFlux(6800 cd, LUMINAIRE)   =  9883.5 lm
A = 2π·0.42²·(cos 63° − cos 180°)       =     1.6115 m²
L = Φ / (π·A)                           =  1952 cd/m²        9000 / 1952 = 4.61×
```

At the exposure the night frame settles at, 9000 cd/m² is **307× the bright-pass
onset** on ninety-eight bowls at once. §5.5: "if the whole frame glows, the
threshold is wrong" — the threshold was not wrong.

**And correcting it made the frame measurably worse, so it was put back.**
Interleaved A/B on the operator's own pavement frame:

```
9000 → 1952     TEXTURED  12.15% → 3.26%   (−8.89 points)
                crushed    2.53% → 6.23%   (+3.70)
                clipped    0.10% → 0.10%   (unchanged)
                mean      0.1419 → 0.1042
```

**The top end did not move at all**, and that is the entire explanation: a bowl
at 9000 and a bowl at 1952 are both far above white, so dividing by 4.61 removes
no clipping — what it removes is BLOOM ENERGY, and the veiling glare fed from
that energy is the only thing holding 85% of a night frame off zero.
`POST.glareStrength` says so in its own derivation: it was re-derived 0.15 →
0.075 against a frame whose glare budget this constant was filling. **The two
numbers are one system, and 9000 is load-bearing as LIGHTING even though it is
wrong as a RADIANCE.**

So: the defect is real, the correct value is 1952 cd/m², and it cannot ship
alone — the 8.89 points of mid-tone have to come back as light before it goes
in, not as camera veil. The arithmetic and the measured A/B are in
`constants.js` beside the number so the next session argues with the derivation
rather than the taste.

**The split is also still open**, and it is the standing defect verbatim:
`block.js` → `EMISSIVE.lampBowl` = **210** for the same object, read only by
`block.js`, against 9000 read only by `city.js` — 42.9× = **5.42 stops**, with
the look gates watching the 210 side and the night routes filling their frames
from the 9000 side. Neither number is Φ/(πA). Same shape at 9.5× on the windows
(`LIGHT.windowNits` 220 vs `EMISSIVE.windowWarm` 21) — and there the arithmetic
exonerates `city.js`: CONTRACT §5.3 says an office window is ≈300 cd/m², so 220
is the law's own number and 21 is 14× under it. **Windows are NOT carrying a
tube's radiance**; that was session 14's error, it was in the signs, and it was
fixed.

Two more, unfixed and recorded: `sky.js` → `pollutionNits` is **3.2** and its own
comment derives **1.2** ("a zenith measurement is around 0.02 cd/m², and this is
sixty times that") — a 2.67× gap between a number and its stated reason, and it
is the constant that makes every shadow in the frame orange, through the PMREM
env map rather than through the haze (the haze is 0.45% at 10 m and cannot tint
a near facade). And `POST.purkinjeStrength` cannot reach anything: its window is
`smoothstep(0.4, 0.006, absL)` on absolute luminance, and the pavement is at
1.32 cd/m² and facades at ~2.0.

---

## 7. What each unfinished item now needs, and why each is smaller than it was

1. **Item 5, markings.** *The brief's premise is wrong and this is the biggest
   correction of the session.* `block.js` has **no lane lines, no centre line
   and no crossings**, and neither does anything else — a tree-wide grep for a
   drawn marking returns nothing, and the project has **no textures at all**, so
   they cannot be hiding in one. What `block.js` has is a KERB COPING STRIP, a
   0.32 m lighter box along each pavement edge whose own comment says "at night
   it is the only line that tells you where the road stops". That is what reads
   as "markings" in a frame. **There is nothing unreachable to unblock;
   markings have to be written**, and the streamed path is the cheaper one to
   write them in because `buildGround` already emits vertex-coloured horizontal
   quads into one merged mesh on one material.

2. **Item 5, kerb.** `BLOCK.kerbHeight` = 0.160 is imported by `block.js` and by
   **nothing else**; `city.js` imports `LIGHT, LUMINAIRE, CLUSTER` and never
   `BLOCK`. The standing defect, literally. **But the naive repair is blocked by
   arithmetic**: raising the pavement to 0.181 makes
   `0.181 − GROUND_Y.earth(−0.020) = 0.201 m > PLAYER.stepUpM = 0.200 m`, so
   every island interior in the city (399/399 sampled points at earth) becomes a
   hole a player can fall into and cannot climb out of, and `stepUpM` cannot
   absorb it — it is bounded above at 0.19–0.20 m by the maximum habitable stair
   riser. **The road datum has to move too**, and moving it is right for a
   second reason found on the way: **y = 0 is the de-facto ground datum of every
   object in the project** — wheels, pedestrian feet, prop bases, lamp columns,
   stall bases, signal masts — and the ground quads are the only surfaces that
   are not at it. So **160 vehicles drive 0.020 m sunk into their own road, and
   twelve lamp columns in the origin block stand 0.160 m buried in their own
   pavement, in every frame this project has shipped.** Nobody noticed the kerb
   because the whole world is drawn as if the ground were flat at zero.

3. **Item 11 is now item 4's fix**, on §3.2's proof. Emissive geometry with zero
   cluster slots, by the tail-light pattern; the pool measured 344 of 384
   reserved with margin 40. The condenser is 260 m and the mast 186 m against a
   mean facade height of 36.6 m over 349 buildings, so a threshold is derivable
   from the distribution rather than picked.

4. **Item 6, pop-in.** *Not a draw-distance or LOD problem — there is no
   distance culling of traffic anywhere* (`frustumCulled = false` on all three
   meshes, nothing ever sets `.visible`). It is a PLACEMENT problem that
   **actively optimises for the middle of the frame**: `seed()` scores its twelve
   candidate re-seat sites with `score = ahead`, the cosine of the bearing from
   the camera axis, and takes the maximum, with the only distance constraint
   being `d ≥ CAMERA_CLEARANCE = 14 m`. A vehicle can materialise 14 m dead
   ahead in the camera's own lane, and `carry(i)` — correctly implemented — is
   what makes it hard-edged. Fix is a frustum rejection on recycle, in one file,
   changing no count and no budget number. Second finding: `fwd` is the camera's
   LOOK axis while `seed`'s own comment justifies the bias by TRAVEL; on the
   three fixed routes those coincide and **with `?player=1` they do not**.

5. **Item 10, time menu.** `timeScale` exists on the time module, but it scales
   `now` AND `timeOfDay` together — and `now` is what `traffic`, `weather`,
   `streetlife` and `player` integrate. **A 120× menu built on `setTimeScale`
   accelerates the pedestrians, the traffic and the walker by 120× as well.**
   The menu needs a separate sun rate, which is still one clock because `time`
   owns both numbers. PMREM cadence derived: 200.000° of solar elevation travel
   per in-game day / 0.35° = 571 sun rebuilds/day; simulating the actual OR-test
   at 60 fps gives 581/day at 1× and **458/day at 120×** — fewer, not more,
   because the test cannot fire more than once a frame. The fast rate does not
   break the bake.

6. **Items 8 and 9.** There is **no UI surface at all**: `<body>` has one
   element, and `src/core/fullscreen.js` is the full-screen *triangle* every post
   pass draws, which will mislead anyone who greps for it. For (8) the one real
   hazard is that the internal buffer is only *fixed* while the drawing buffer
   exceeds 3 686 400 device pixels — below that `neverExceedNative` makes
   internal == drawing buffer, so on a dpr-1 display fullscreen raises the
   shading load rather than only the drawing buffer. For (9) everything a map
   needs is already reachable in-page — `city.placement(region)` builds the same
   4 m mask `citycheck` flood-fills, `city.walkableAt` is the point predicate,
   `player.teleport()` exists — and the one missing piece is that `teleport()`
   does not call `post.resetHistory()`.

---

## 8. Known gaps carried forward

**Unchanged from s8–s17**: `stats().cutoffM` hard-codes 0.8, the headroom probe
inert, GPU timer queries advertised and never retiring, `saturation-peak.png`
overwritten every run, `$fovYDrift`, `camera.setRouteAt(name, 1.0)` at the sky,
rain streaks near-invisible wide at night, `rain_spray` 0 static, right turns
only, sun shadows to ~170 m, the bake blind to elevated slabs, the PMREM hitch,
the too-red dawn horizon, one worker at queue depth one, the generator's four
island frontages overlap at the corners, the far half of the river hands back to
the night sky past ~300 m, grime is authored, the near-field washboard on the
water, the viaduct pier across both footways, the quay wall inside the walkable
mask, 147/147 props walk-through, the 98.5 m pavement overlap, the 3.5°–10.4°
route camera pitch. **The frozen/running A/B is a seventh session undone**, and
**the `player` route with `lookRise: 0.9` — last session's cheapest item — was
not run.**

**The level statistics are still a sample of one** while every millisecond
beside them is pooled over three, and `night_rain`'s mean luminance still has
0.0032 of margin. Neither was touched.

**New this session, all recorded above:** the released red light; the NaN field
default; the 42.9× lamp-bowl split and the 4.61× quantity error inside it; the
2.67× gap between `pollutionNits` and its own derivation; the Purkinje window
that no surface in the frame can enter; markings that never existed; the kerb
repair blocked by `stepUpM` and the earth plane; **y = 0 as an undeclared ground
datum that every object obeys and no ground quad does**; traffic re-seeding
optimised toward the centre of the frame; `timeScale` driving the simulation as
well as the sun; and `GROUND_Y` having eight keys under a comment that says six.

---

## 9. What the next session starts from

1. **Re-run `npm run gates` end to end.** The run in this session is mixed — it
   started before the traffic change landed. Nothing here may be called green
   until one clean run says so.
2. **Item 11, and treat it as item 4.** §3.2 proves an ambient term cannot make
   an unlit wall read against the sky it is seen against; emission can. It is
   the highest-value visible work left and the arithmetic for it is done.
3. **Item 6's frustum rejection on recycle.** One file, no count changes, and
   §7.4 has the derivation of the rejection angle.
4. **The ground datum, then the kerb, then the markings, in that order**, because
   §7.2 shows they are one change and doing the kerb first breaks the islands.
   Any geometry through `windcheck`.
5. **The lamp bowl, with its compensating half.** §6 has the derivation, the
   measured regression and the reason the two numbers are one system.
6. **`tools/quiet-gates.sh` with the app closed.** Still the operator's, and
   `player`'s two reds are still waiting on it — and the `player` route now runs
   at fov 75 with more of the world in frame, so its cost has moved and nobody
   has measured which way.
7. `node tools/levels.mjs --a=<before> --b=<after>` on any change that touches
   light, and `node tools/inputcheck.mjs` on any change that touches the
   controller.
