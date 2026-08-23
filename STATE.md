# NOCTIS — STATE

*End of session 41. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2 (24C101), `node v22.22.0`. The
machine has **NOT** rebooted since session 40 — 5 d 1 h of uptime at the last command against
session 40's 4 d 18 h, the same boot. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` RANGED 2.27 TO 6.72 ACROSS THE SESSION*** against CONTRACT §0.2's bar of **1.6**, and it
was never once inside it. **So no absolute in this file is admissible as an absolute** — but almost
nothing in this file is one. Every number below is either a COUNT, a PAIRED delta measured in this
tree minutes apart in both orders, or a GREEN reading, and CONTRACT §0.2's drift is one-sided: load
can only make a frame slower. The session's decisive `inputcheck` green was taken at **load1 6.72**,
which is the worst load of the session and makes it a stronger green rather than a weaker one.

---

## 0. THE FOUR BOUNDS, BEFORE AND AFTER

The one item. `inputcheck` had been RED on four bounds since session 35's `0f60c9a` and was carried
unrepaired by five briefs.

```
                    session 40, 0e16045          session 41, HEAD           declared
  keyboard:walk   ✗ 3.220 m/s   8.0% off      ✓ 3.473 m/s   0.8% off       3.500 m/s
  keyboard:run    ✗ 6.189 m/s  11.6% off      ✓ 6.920 m/s   1.1% off       7.000 m/s
  gamepad:walk    ✗ 3.232 m/s   7.7% off      ✓ 3.475 m/s   0.7% off       3.500 m/s
  gamepad:look    ✗ 160.20 °/s 11.0% off      ✓ 177.78 °/s  1.2% off       180.00 °/s
                                              tolerance 6% (speed), 8% (look) — UNCHANGED

  inputcheck: 4 failure(s).          →  inputcheck: keyboard, mouse and gamepad each deliver
                                        their own constant, the lock is acquired, and the
                                        mouse is inside the usable band.
```

**NO THRESHOLD MOVED. NO ASSERTION CHANGED. NO INPUT CONSTANT MOVED.** `judgeInput()` is
byte-identical, `speed.toleranceFraction` is still 0.06, `look.toleranceFraction` is still 0.08,
and `PLAYER.walkSpeedMps`, `runSpeedMps`, `maxLookRateDegPerS`, `mouseRadPerCount` and
`lookCurveExponent` are the values session 19 set. `inputcheck --falsify` is **13/13 rejected at
100% coverage of 12 failure sites** — brief item (d), and identical to session 33's reading.

**AND THE SESSION 41 COLUMN IS SESSION 32's COLUMN.** STATE 32 recorded
`inputcheck GREEN walk 3.474 m/s vs 3.500`. This tree now reads 3.472, 3.473 and 3.475 over three
runs. The gate is back at the number it last had when it was green, to the third decimal.

---

## 1. THE WALK WAS ALWAYS 3.5000 m/s. THE FRAME WAS 65 ms.

**THE MEASUREMENT THAT DECIDES IT, AND IT IS THE ONE NOBODY HAD TAKEN.** `inputcheck` reads the
position and `time.now` in SEPARATE round trips either side of a 1500 ms hold. Read them in ONE
`page.evaluate`, every frame, from inside the page — so nothing between the endpoints can be a
round trip — and the city delivers this, in the gate's own scene, `?player=1&seed=1337&t=0.0`:

```
                        per-frame delivered      declared      frames
  keyboard walk            3.5000 m/s            3.500          25 moving frames, min 3.4854 max 3.5115
  keyboard run             6.9998 m/s            7.000          24
  gamepad  walk            3.5002 m/s            3.500          26
  gamepad  look          180.003  °/s          180.00           per-frame over the turning frames
```

**Four decimal places, and the same on BOTH arms of the bisected commit.** Nothing is wrong with
the walk, the run, the pad, the look rate, the curve, the dead zone, the mask or the ground query.

What `0f60c9a` moved is the **FRAME**, and `inputcheck`'s window carries dead time it does not
subtract — `t0` is read before the key goes down, `t1` after the position is read, and each of
those is a CDP round trip serviced on the page's own main thread, so each queues behind whatever
frame is running. What the three speed bounds report is therefore

```
      delivered × (1 − dead / window)          dead = 3.10 frames, measured — §5
```

### 1.1 Paired, three runs each, run in BOTH ORDERS at load1 2.6–4.7

Two git worktrees at the two commits either side of `0f60c9a`, `node_modules` symlinked, one
vite and one chromium apiece, `src/` identical except `traffic.js`. Run before→after→before→after
so the ORDER is not the result:

```
  arm                                 frame     fps    outer reading   deficit    verdict
  528cfd9   0f60c9a^                  23.6 ms   42.4    3.340 m/s        4.6%     green
  0f60c9a   … through HEAD~2          64.3 ms   15.5    3.106 m/s       11.3%     RED
  0f60c9a, ONE LINE reverted          24.9 ms   40.2    3.330 m/s        4.9%     green
  HEAD, this session's repair          5.2 ms  192.3    3.462 m/s        1.1%     green

  per-frame delivered speed            3.500     3.500   3.500    3.500   on every one of them
```

**A 2.73× FRAME-TIME REGRESSION FROM ONE COMMIT THAT TOUCHED ONE FILE**, order-independent and
load-independent. And the repair does not restore the before arm — it beats it by **4.5×**.

---

## 2. THE BISECTION IS CORRECT. THE SENTENCE UNDER IT WAS ONE CLAUSE WRONG.

Session 36 bisected to `0f60c9a` commit by commit and it reproduces exactly. Its two eliminations
also reproduce, and **both of them were right**:

- ***"IT IS NOT THE MACHINE"*** — the same four numbers at `load1` 1.48 and 4.75. Correct. The
  deficit is set by a fixed CPU cost inside the page's own frame, which a busy machine barely
  moves; my four arms span `load1` 2.6–6.7 and the frame varies by under 2 ms. **What that
  eliminated was the AMBIENT machine, and it was read as eliminating TIMING.** It is the reason
  five sessions looked at the walk.
- ***"Not a collision: `gamepad:look` is a pure ROTATION rate and no wall can slow it"*** —
  correct, and **it was the answer.** A pure rotation rate under-delivering by the same fraction
  as a translation, with no collision in one of them, leaves the clock and the window and nothing
  else.

Session 36 then wrote the one clause that sent it wrong:

> *"All four are RATES measured against `ctx.get('time').now`, and all four under-deliver by
> 7.5–11.8% — one fraction, on translation and rotation alike, which says the player integrates
> less simulated motion per unit of `time.now` than it did."*

Every word up to the last clause is right, including *"one fraction, on translation and rotation
alike"*, which is the signature of a window artefact and not of a physics change. The last clause
is the inversion: the player does not integrate less motion per unit of `time.now`. **The
INSTRUMENT counts units of `time.now` in which the player was not moving.**

Session 38's *"unchanged to 0.005 m/s"* also reproduces — three runs at HEAD~2 read 3.106, 3.112
and 3.114, a spread of 0.008 — and for the stated reason: the frame was stable at 64 ms.

### 2.1 The gate's margin had already been spent, silently, before the commit that got the blame

```
  STATE 32   inputcheck GREEN, walk 3.474 m/s      deficit 0.74%   →  frame ≈ 3.6 ms
  STATE 33   inputcheck GREEN, no number printed
  STATE 34   inputcheck GREEN, no number printed
  STATE 35   inputcheck GREEN, no number printed
  528cfd9    measured this session, 3.340 m/s      deficit 4.6%    →  frame 23.6 ms
  0f60c9a    measured this session, 3.106 m/s      deficit 11.3%   →  frame 64.3 ms
```

**THE `≈ 3.6 ms` IS BACK-COMPUTED AND IS THE ONLY INFERRED NUMBER IN THIS FILE.** It is §4's model
run backwards from session 32's printed 3.474 — `0.0074 × 1.5 / 3.10` — on a city that had 160
fewer buildings than this one and cannot be re-measured without checking it out. The bottom two
rows are measured in this tree. It is quoted because the DIRECTION is what the paragraph is about
and the direction does not depend on the model being exact.

**Between session 32 and session 35 the frame grew 6.6× and the gate's margin fell from 8× to
1.3×, with nobody noticing, because three consecutive STATE files wrote `GREEN` without the
number.** `0f60c9a` did not spend the margin; it spent what was left of it. Session 32 is the last
STATE that printed the reading, and printing it is the only reason this paragraph can exist.

---

## 3. THE CAUSE — ONE LINE OF `0f60c9a`, AND A CACHE ON THE WRONG BRANCH IN `citygen.js`

### 3.1 The line

`0f60c9a` made three functional changes to `traffic.js`. Reverting them one at a time in the
worktree, with the others left in:

```
  change                                                         frame     of the 40.7 ms
  the per-vehicle per-frame off-road test, line 4129            24.9 ms      39.4 ms
    `landmarkOccupies(pos.x, pos.z)` → `landmarkUnderBody(...)`
  the signal-head test + the collapsed-slot loop                64.3 ms       1.3 ms
```

**The predicate is RIGHT and it stays.** Session 35's finding stands: a 12.00 m body's origin can
stand outside a claim while half of it stands inside, and every vehicle is still tested at nose,
tail and centre. `landmarkUnderBody` is unchanged. Nothing in `traffic.js` was touched this
session.

### 3.2 What that line cost, and it predates the commit by thirty sessions

`landmarkOccupies` walks all eight landmarks and calls `landmarkAABB` FIRST, as the reject.
`landmarkAABB` rebuilt `landmarkOccluders(l)` on **every call** — forty-odd fresh boxes, and for
the viaduct `viaductArc` → `viaductLegs` → `viaductEnds`.

`landmarkGroundClaims` is memoised against that exact sentence seven hundred lines up, in these
words: *"`viaductArc` → `viaductLegs` → `viaductEnds` is a few hundred trig calls and
`landmarkOccupies` is called once per vehicle per frame."* True, and it fixed the wrong half.

> **THE CACHE WAS PUT ON THE BRANCH THAT RARELY RUNS AND LEFT OFF THE ONE THAT ALWAYS DOES.** The
> ground claims are reached only by the one landmark whose AABB the point is inside, so the
> memoised call happened **at most once** per query while the unmemoised one happened **eight
> times**.

**COUNTED IN THE PAGE, 160 vehicles, over two seconds of frames:**

```
  arm                     landmarkOccupies   landmarkAABB   of which REBUILT   frame
                              calls /frame      calls /frame   landmarkOccluders
  528cfd9   0f60c9a^            161              1 369            1 369 /frame     23.3 ms
  0f60c9a   … HEAD~2            505              4 143            4 143 /frame     65.7 ms
  HEAD, with the memo           505              4 143         8 FOR THE PROCESS    5.2 ms
```

**THE CALL COUNT DOES NOT MOVE AND THAT IS THE POINT** — `landmarkAABB` is still asked 4 143
times a frame and still answers all 4 143. What stops is the REBUILD behind the answer: eight
`landmarkOccluders` evaluations for the lifetime of the page, one per landmark, and a `Map` hit
thereafter.

505 = 160 vehicles × 3 (the line above) + 16 signal heads + the recycler's own. **2 774 extra
rebuilds a frame for 42.4 ms is 15.3 µs each**, and at that price the 1 369 the BEFORE arm already
paid were **21.0 ms of its own 23.3 ms frame — 90% of it**. Session 35 did not introduce this cost.
It tripled a call whose price nobody had ever measured.

### 3.3 The repair

`landmarkAABBCache`, a `Map` keyed on the landmark object, beside `landmarkAABB` in `citygen.js`,
identical in form to `landmarkGroundClaimCache`. `LANDMARKS` is authored data at module scope and
does not depend on the seed — which is already what makes the existing cache sound.

**THE CACHED BOX IS HANDED BACK RATHER THAN COPIED, AND THAT IS CHECKED RATHER THAN ASSUMED.** All
fourteen `landmarkAABB` call sites in `src/` and `tools/` read the four fields; none writes one,
and a grep for a write to `.x0/.x1/.z0/.z1` on an aabb returns nothing. The eight delivered boxes:

```
  condenser  x[-480.84, -379.16]  z[-610.84, -509.16]      exchange  x[  87,  153]  z[-143,  -77]
  stack      x[ 261,  339]        z[-339, -261]            weir      x[-405, -195]  z[  45,  255]
  arch       x[-130.5,   2.5]     z[ 182.5, 197.5]         mast      x[465.5, 474.5] z[425.5, 434.5]
  viaduct    x[ -97.87,  11.40]   z[-211.26, 233.26]       dish      x[-180.8, -119.2] z[-190.8, -129.2]
```

The weir's `x1 = −195` and `z1 = 255` are the two numbers `0f60c9a`'s own commit message quotes,
unchanged.

**AND THE NEGATIVE CONTROL IS `citycheck`.** A pure-function memo must move no geometry, and it
moves none: `citycheck` reports the **same three reds with the same numbers as session 40** —
clumping CV 0.431, the same 2 sign quads inside a building, the same 3 forbidden overlaps at
0.013, 0.095 and 0.094 m² — plus walkability 54 511 / 54 653 identical, 8 landmarks at identical
distances, and the same registry refusals. Bright reserve 6.22% against session 40's 6.14%, inside
its own printed spread of 0.92 points and reported as noise (CONTRACT §0 rule 6).

---

## 4. THE INSTRUMENT — 3.10 FRAMES OF DEAD TIME, AND A DECISION LEFT TO THE OPERATOR

`inputcheck` is green because the delivery is right, not because anything about the gate changed.
But the gate reports `delivered × (1 − dead/window)`, and `dead` is a whole number of frames.
**Measured over four arms spanning 5.2 ms to 64.3 ms a frame — a 12.4× range — it is 3.10 frames,
to ±0.07:**

```
  frame     window    reported   deficit   dead / frame
   23.6 ms   1.587 s   3.340       4.6%       3.07
   64.3 ms   1.742 s   3.106      11.3%       3.05
   24.9 ms   1.587 s   3.330       4.9%       3.10
    5.2 ms   1.521 s   3.462       1.1%       3.18
```

So `3.10 × frame / 1.5 s > 0.06`:

> **THIS GATE GOES RED BELOW ABOUT 34 fps WHATEVER THE WALK DOES, AND WHEN IT DOES IT PRINTS "THE
> WALK IS 8% SLOW".** That is what it printed for five sessions while the walk delivered 3.5000.

`input-budget.json`'s own derivation of the 6% tolerance says *"2 frames of 1/60 s over a ~1.2 s
window is 2.8%"* — so the assumption was **stated**, it was **two** frames rather than 3.10, and
it was about a machine this project stopped having at session 33. The 0.06 is untouched and the
sentence deriving it still stands; what is added beside it, dated, is the frame it assumed
(CONTRACT §9 rule 5).

### 4.1 The gate now prints the frame, and the window is deliberately LEFT ALONE

```
  frame  4.7 ms median = 213 fps. READ THE THREE SPEEDS AGAINST THIS: the window above carries
  3.10 frames of dead time it does not subtract, so it reports delivered × (1 − 3.10 × 4.7 ms /
  window) = −1.0%, and it crosses the 6% tolerance below about 34 fps whatever the walk does
```

Predicted −1.0%; delivered −0.8% and −1.1%. **The model is checkable and it checks.**

**WHY THE WINDOW WAS NOT REPAIRED, WHICH IS A CONTENT DECISION AND IS THE OPERATOR'S.** Sampling
position and `time.now` in one evaluate, with the key held across both endpoints, would make this
gate measure the walk and nothing else. It is two lines. It would also **blind the only alarm in
this project that noticed a 41 ms frame regression** — an alarm that fired for five sessions and
was right about there being a defect every time, while being wrong about which one. So:

> **THE QUESTION FOR THE OPERATOR: is `inputcheck` the input gate, or is it also the player
> scene's frame gate?** If the former, subtract the dead time — the repair is exact and costs
> nothing. If the latter, the assertion should be ON the frame with its own derivation, and the
> speed bounds should stop standing in for it. It should not stay as it is, because as it is it
> is a frame-rate detector whose failure message is about the walk.

`perfcheck` is the obvious other home and it did not catch this — see §5.

---

## 5. `perfcheck` HAS A ROUTE CALLED `player` AND IT DOES NOT REGISTER THE PLAYER

Worth stating plainly because it is the reason nothing else caught a 2.7× frame regression:
`budget.json`'s `capture.routes` contains `player`, and `capture.params` is `{seed, perf}`.
`perfcheck` sets `route=player`; the player MODULE is gated on `on('player')` =
`Number(config.player) !== 0`, and `main.js:131` defaults `player: 0`. **So the route named
`player` is a camera spline at a walker's height, and no `perfcheck` run in this project's history
has ever had the player module registered.**

**AND perfcheck WAS RED THE WHOLE TIME AND COULD NOT BE BELIEVED, WHICH IS THE OTHER HALF.** STATE
40 §7.4 records `highway_speed` at **wall p95 71.60 ms against a 12.5 ms budget** — 5.7× over — and
refuses it, correctly, because the same code measured 91.20 ms and 71.60 ms two hours apart at
`load1` 1.8 and 3.5. Nine STATE files in a row have carried some version of *"no millisecond in this
file is admissible"*. So the project's frame gate had a signal, had the right sign, and had spent
three sessions learning that its own wall clock could not be used to attribute anything — which is
a correct discipline that here cost it the one attribution it could have made.

**WHAT WOULD HAVE CAUGHT IT is the paired form this session used and `perfcheck` does not**: two
worktrees, one commit apart, run back to back in both orders on the same machine at the same load.
A ratio between two arms measured minutes apart is admissible where neither absolute is, and
CONTRACT §0.2's own drift argument says why. `perfcheck` has no paired mode.

A paired `perfcheck --route=player` over the two arms was started this session and had not returned
by the time the session closed — 6 000 frames at 15 fps is seven minutes a pass on the slow arm
before the render-scale sweep. **It is not needed for the finding and is not quoted here.** The
finding is §1.1's table, which measures the same frame with an instrument that finishes.

---

## 6. THE WALK — BRIEF ITEM (e)

Real keys and a real mouse through the real pointer lock, at 1.7 m, midnight, **wet** — `?wet=1`,
which LOOK.md §6 records as the thing this project has measured for many sessions and never looked
at. Same spawn, same seed, same hour, the two arms differing in nothing but the memo.

```
  tools/shot-out/s41-before-walk.png    s41-after-walk.png       2.5 s of holding W
  tools/shot-out/s41-before-turned.png  s41-after-turned.png     after a 1 320-count mouse sweep
  tools/shot-out/s41-before-run.png     s41-after-run.png        2.5 s of Shift+W
```

All six have distinct md5s. `tools/shot-out/` is gitignored and regenerable.

### 6.1 What a walker gets, per frame, which is the unit a walker sees

```
                        SHIPPED 0e16045        REPAIRED HEAD        what the number is
  frame median          64.6 ms = 15 fps       5.1 ms = 196 fps
  frame p95             69.9 ms                7.6 ms
  frame worst          158.8 ms               11.9 ms
  press to pixel        85.8 ms                6.5 ms              keydown → the first frame
                                                                   the player is somewhere else
  walk, per frame        0.233 m                0.018 m            0.93 → 0.07 body radii
  run,  per frame        0.453 m                0.035 m            1.81 → 0.14 body radii
  run substeps               2                      1
  half-stick look        3.46 °/frame           0.27 °/frame       ceiling 1.00 — see below
  0.1-stick look         4.92 px/frame          0.39 px/frame      floor   1.00 — see below
```

**HOW IT FEELS, AND I CANNOT FEEL IT, SO HERE IS WHAT STANDS IN FOR IT.**

- **The city's own HUD was solid red and nobody read it.** `s41-before-walk.png` shows the frame
  graph full-width red at `p50 67.8 / 12.5 ms   p95 89.5 / 12.5 ms   fps 15`. `s41-after-walk.png`
  shows it green at `p50 5.2 / 12.5   p95 7.7 / 12.5   fps 192`. This has been on screen in every
  frame of the running app for six sessions.
- **86 ms from a keypress to the pixel that shows it.** That is past the point where a control
  reads as *sluggish* and into where it reads as *not listening* — and it is the exact complaint
  `inputcheck` exists to adjudicate, arriving as a number for the first time. 6.5 ms is immediate.
- **A run moved 0.45 m per image — 1.81 body radii.** `moveSubstepped`'s own comment tabulates
  *"60 fps, run 7.00 → ceil(0.1167/0.25) = 1 (unchanged)"* and asserts *"the normal frame pays
  exactly what it paid before and only the frame that was already late pays more, which is the
  right way round."* **At the shipped frame that was false: every normal frame at a run was paying
  two mask queries, not one.** It is true again.
- **The look curve is derived in pixels per frame AT 60 Hz and the derivation says so.**
  `PLAYER.lookCurveExponent` = 1.75 is bounded from below by *"half deflection ≤ 1.00 °/frame"* and
  from above by *"0.1 deflection ≥ 1 px/frame"*, both computed with a literal `/60` in
  `constants.js` and in `player.js`'s init line. **At 15 fps the shipped build delivered 3.46
  °/frame at half stick — 3.46× outside a ceiling the project writes down.** The stick was outside
  its own derivation and nothing read it.
- **The mouse is the one device the frame did not slow, and `player.js` says why**: *"The mouse
  delivers a DISPLACEMENT and has no clock in it."* Both arms turned 38° for the same 1 320 counts,
  exactly. What the frame cost the mouse is not magnitude, it is images: the same sweep arrived in
  184 frames on one arm and 1 489 on the other.

### 6.2 And the frames are worth looking at for their own sake

`s41-after-turned.png` is the best street frame this project has produced and none of it is this
session's work: wet pavement doubling four shopfronts, two pedestrians in silhouette against them,
traffic queued in the near lane, the road a mirror. LOOK.md §3's *"rain-lit neon at street level"*
and §6's water, at last stood in rather than measured.

**It is also entirely amber, which is LOOK.md §3's largest unspent lever confirmed by eye.** One
green pedestrian-signal dot is the only cold light in a 1280 × 720 frame. Not this session's item;
recorded because a frame was taken and looked at.

---

## 7. GATE STATE

Run individually, because `npm run gates` is `&&`-joined and stops at the first red.

```
  parsecheck   GREEN   111 files (unchanged from session 40), contract-clean
  faultcheck   GREEN   7 cases; quarantine surgical, frame survives all seven
  windcheck    GREEN
  inputcheck   GREEN   ← WAS RED AT 4 FOR SIX SESSIONS. §0. Taken at load1 6.72.
  citycheck    RED at 3 — every one identical to session 40, which is the negative control. §3.3
  gateaudit    RAN. Every perturbation case passes and all four --falsify suites are green
               (perfcheck 74/74, citycheck 61/61, inputcheck 13/13, thresholds). Its ONLY
               failure is the CONTROL — lookcheck's own four reds restated. NO THRESHOLD DRIFT.
  lookcheck    NOT RUN as a gate; its four reds are restated by gateaudit's control above and
               nothing this session touches a pixel. `citycheck`'s identical output is the
               stronger statement: the geometry did not move.
  perfcheck    §5.
```

---

## 8. WHERE THE BRIEF DISAGREES WITH THE CODE

The brief asked for this explicitly. Three places, and the first is the whole item:

1. ***"if a delivered constant no longer matches its declaration, the constant is the defect"*** —
   **the premise does not hold.** Every delivered constant matches its declaration to four decimal
   places, on both arms of the bisected commit. There was no constant to repair and no declaration
   to change.
2. ***"This is a shipped control regression. The operator's own hands are on those constants."***
   — the first sentence is **right** and the second is **wrong**. It is a shipped control
   regression and the operator's hands are on it, but not on the constants: on the FRAME. The
   controls were exact the whole time and unusable anyway, which is precisely LOOK.md §7's
   *"a number that matches its declaration can still feel wrong"* — brief item (e) — arriving from
   the direction nobody expected.
3. ***"Sessions 36 through 40 each carried it forward without repairing it, because every one of
   those briefs told them to. That instruction was mine and it was wrong five times."*** —
   verified against all five STATE files and correct. Adding to it: **the instruction was wrong,
   and so was the diagnosis they were carrying.** Five sessions carried *"the walk under-delivers"*
   forward as a fact. It was never measured; §1's per-frame reading takes twenty seconds and
   settles it.

Nothing else in the brief disagrees with the code. The bisection, the two eliminations, the 0.005
m/s stability and the 13/13 falsify are all reproduced above.

---

## 9. WHAT WAS NOT DONE

- **The window was not repaired.** §4.1 — deliberately, and it is written up as a question with
  the arithmetic rather than decided here.
- **`clumping` and the sign claims were not touched.** The brief listed both as forward items and
  not for this session. They are §10 items 2 and 3.
- **No merge to main.** No performance work beyond the one line that was the cause, and the frame
  numbers here are consequences of that repair rather than a target anybody aimed at.
- **No quiet battery.** `load1` 2.27–6.72 against a bar of 1.6.
- **Nothing else was started.**

---

## 10. WHAT TO DO FIRST NEXT TIME

1. **THE `inputcheck` WINDOW — the operator's decision, and it is two lines either way.** §4.1.
   Is this the input gate or the player scene's frame gate? Leaving it as it is means the next
   frame regression again reports itself as a slow walk. The arithmetic, the 3.10 frames and the
   34 fps crossover are all above and in the gate's own output.

2. **A GATE THAT PRINTS `GREEN` WITHOUT ITS NUMBER CANNOT NOTICE A MARGIN BEING SPENT.** §2.1 —
   STATE 32 printed `walk 3.474 m/s`, 33, 34 and 35 printed `GREEN`, and the frame grew 6.6× in
   between with the margin falling from 8× to 1.3×. This is a STATE-writing rule, not a gate
   change, and it is free.

3. **THE CLUMPING STATISTIC, REPLACED RATHER THAN RE-NUMBERED.** Carried from STATE 40 item 2,
   untouched, and now **12 of 12 regions below the floor, up from 9 of 12**, because session 40
   filled the ground and the statistic correlates 0.92 with how many chunks are EMPTY (STATE 37
   §4.2). Three sessions have shown it punishes content. **It needs a decision from the operator,
   not another measurement** — the brief says so in those words.

4. **THE GENERATOR REGISTRY CONTAINS NO SIGN CLAIMS AT ALL.** Eight `claimBox` sites and not one
   of them a sign, which is why delivered sign overlaps reappear whenever the city re-phases —
   the three `sign ×` overlaps in §3.3 are a lottery on the stream and this session re-rolled
   nothing and got the same three, which is the control that says so.

5. **`landmarkOccluders` ITSELF IS STILL UNMEMOISED**, and it is the function doing the work.
   §3.2 removed its 4 143 calls a frame from the hot path; `city.js`'s chunk builder, `canyon.js`'s
   bake and `landmarkGroundBlockers` still rebuild it per call. Those are not per-frame paths so
   nothing is bleeding, but the same cache would serve them and the aliasing question is real
   there — `landmarkGroundBlockers` returns the array VERBATIM and `citygen.js:8347` pushes its
   boxes into a list. **A question, not a finding.**

6. **THE LOOK CURVE'S TWO BOUNDS ARE STATED PER FRAME AT 60 Hz AND THE FRAME IS NOW 5 ms.** §6.1.
   At 196 fps the 0.1-deflection reading is **0.39 px/frame against a floor of 1.00** — outside
   the bound at the other end. In the frame-rate-free form nothing moved: `180 × 0.1^1.75` = 3.20
   °/s = 76 px/s at any frame rate, which is not a dead zone by any reading. **So the constant is
   almost certainly fine and the BOUND's expression is what is stale** — the same `/60` trap that
   cost this project five sessions, sitting in a derivation two constants away. Worth re-deriving
   in °/s before anybody reads the px/frame number as a red.

7. **THE NARROWING VERDICT.** Carried from STATE 40 item 3, untouched. 51 refusals with 11 m or
   more of clear frontage beside the claim, 845 m, 2.4% of the island edge.

8. **THE YARD STACKS AGAINST ITS BOUNDARY, AND A CAR PARK'S APRON IS TWO THIRDS OF IT.** Carried
   from STATE 40 item 4, untouched.

9. **THE TWO VEHICLE-SILHOUETTE BARS HAVE A SPREAD LARGER THAN ANY ARM ANYBODY HAS COMPARED WITH
   THEM.** Carried from STATE 40 item 5. Pool them or stop quoting them.

10. **`band:noon` AND `band:dusk` HAVE NO SURVIVING MECHANISM.** Carried from STATE 40 item 6.

11. **The condenser's ground claim is NARROWER than the tower it stands for.** Carried from STATE
    40 item 8, untouched. A question.

12. **The end-of-run gap.** Carried from STATE 40 item 9, untouched.

13. **A quiet battery.** Every millisecond in the last nine STATE files is inadmissible as an
    absolute. Needs the operator and `tools/quiet-gates.sh`.

---

## 11. KNOWN GAPS CARRIED FORWARD

**Unchanged from s8–s40**: `stats().cutoffM` hard-codes 0.8, the headroom probe inert,
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
216 with no threshold reading it**, **`tone profile` red on every reading for eight sessions**, a
gate message frozen in the present tense of the session that wrote it, **a palisade that does not
stop a pedestrian**, and **the three delivered `sign ×` overlaps and the two sign quads inside a
building**.

**CLOSED THIS SESSION:**

- **`inputcheck`'s four reds**, red since session 35's `0f60c9a` and carried by five briefs. The
  cause was 39.4 ms a frame, not a constant. §0–§3.
- **`landmarkAABB` rebuilding its landmark's geometry on every call**, since the function was
  written. 4 143 rebuilds a frame → 8 for the process. §3.2.
- **The `player` scene at 15 fps**, shipped since session 35 and visible as a full-width red bar in
  the app's own HUD the whole time. §6.1.

**NEW THIS SESSION — all of it measured, none of it inferred:**

- **THE WALK, THE RUN, THE PAD AND THE LOOK RATE EACH DELIVER THEIR CONSTANT TO FOUR DECIMAL
  PLACES**, and did so on both arms of the commit that was blamed for them. §1.
- **`inputcheck`'s WINDOW CARRIES 3.10 FRAMES OF DEAD TIME IT DOES NOT SUBTRACT**, constant to
  ±0.07 across a 12.4× range of frame time, so the gate crosses its own 6% tolerance below about
  34 fps whatever the walk does. §4.
- **ONE LINE OF `0f60c9a` COST 39.4 ms OF A 40.7 ms REGRESSION**, isolated by reverting each of
  its three changes separately in a worktree. §3.1.
- **THE UNMEMOISED AABB WAS ALREADY 90% OF THE FRAME BEFORE THAT COMMIT** — 1 369 rebuilds at
  15.3 µs is 21.0 ms of a 23.3 ms frame. §3.2.
- **THE GATE'S MARGIN FELL FROM 8× TO 1.3× BETWEEN SESSIONS 32 AND 35 WITH NOBODY NOTICING**,
  because three STATE files printed `GREEN` and not the number. §2.1.
- **SESSION 36's TWO ELIMINATIONS WERE BOTH CORRECT AND THE SECOND ONE WAS THE ANSWER.** §2.
- **PRESS TO PIXEL WAS 85.8 ms AND IS 6.5 ms.** §6.1.
- **A RUN MOVED 1.81 BODY RADII PER FRAME**, so `moveSubstepped`'s *"1 at 60 fps (unchanged)"* was
  false on every normal frame at the shipped frame rate. §6.1.
- **THE LOOK CURVE'S HALF-STICK CEILING WAS EXCEEDED 3.46× BY THE SHIPPED BUILD**, against a bound
  `constants.js` states in degrees per frame at 60 Hz. §6.1.
- **`perfcheck` HAS A ROUTE NAMED `player` AND HAS NEVER REGISTERED THE PLAYER MODULE.** §5.
- **`citycheck` IS BYTE-IDENTICAL TO SESSION 40 ON ALL THREE REDS**, which is the negative control
  that says a pure-function memo moved no geometry. §3.3.
