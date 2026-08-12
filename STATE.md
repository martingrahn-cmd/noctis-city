# NOCTIS — STATE

*End of session 23. **The machine has no GPU. Checked first, printed, recorded — §0.**
The M4 series in `budget.json` remains the binding contract.*

*Three of the four items turned out to be about a premise rather than about the
thing the premise named, and in each case the measurement is the finding:*

- ***The HUD's red 16.7 ms ceiling is the ceiling's own discarded value.***
  `budget.json` records that `wallFrameMsP95` used to be 16.67 and that
  *"16.67 was the vsync line"*. The panel now reads a vsync-locked interval as
  the CENSORED observation it is, which at 60 Hz gives no verdict, at 120 Hz
  gives **green**, and on a dropped frame stays **red**. No ceiling moved. §1.
- ***The viaduct's ends are not unbuilt.*** Session 21 put an abutment at each
  one and it tops out at **18.20 m, exactly the soffit** — so 8.60 m of the
  deck's 9.50 m width is cut off between 18.20 and 22.20, framed by two parapet
  returns floating 2.80 m above the abutment. And that whole mass **was claimed
  by nobody**. A portal head is built on it and the end treatment is now in the
  registry. §2.
- ***The lamppost in item 4's premise does not exist.*** `PROP_MODELS.lamppost`
  is offered only to the `parking` scatter and **zero** are placed over the
  gate's region. The **790** lamps that do light this city come from `city.js`'s
  own loop at 8.08 m and **are in no registry band at all**. Crowns intersecting
  a luminaire: **0**, nearest miss 0.24 m. §4.

*And one thing I got wrong and an instrument caught: a comment claiming the
default Euler order would rake the train in world axes. `trainprobe` refuted it
in the same change. §3.3.*

Read `CONTRACT.md` before this file, and before any source file.

---

## 0. THE MACHINE — CHECKED, NOT ASSUMED. THERE IS NO GPU.

The brief said not to take its word for it. First commands of the session:

```
$ uname -a
Linux vm 6.18.5-fc-v20 #1 SMP PREEMPT_DYNAMIC @0 x86_64 x86_64 x86_64 GNU/Linux
$ grep 'model name' /proc/cpuinfo   → Intel(R) Xeon(R) Processor @ 2.80GHz
$ nproc                             → 4
$ free -h                           → 15 GiB
$ lspci | grep -iE 'vga|3d|display' → lspci unavailable / no match
$ ls /dev/dri                       → No such file or directory
$ ls /sys/class/drm                 → No such file or directory
$ nvidia-smi -L                     → not present
```

**No GPU. Nothing that needs one was attempted, and nothing that needs one is
reported.** This is the same container shape as sessions 21 and 22: a 4-core
Xeon with no display hardware, where a browser falls back to SwiftShader.
`budget.json` → `machine` is untouched and the M4 series stands.

**One environment change was needed and it is a launcher detail, not a gate
change.** `playwright` 1.62 pins browser revision 1234; this container ships
1194 at `/opt/pw-browsers/chromium`, so `chromium.launch({ channel })` refused
before any gate reached an assertion. `tools/lib/page.mjs` now honours
`NOCTIS_CHROMIUM` as an explicit `executablePath`; unset, nothing changes.
CONTRACT §0.2 is the argument — *"a gate that can never pass produces zero
measurements, and zero measurements is not stricter than imperfect ones — it is
nothing."* It cannot make a red gate green: it selects a binary and touches no
threshold, route, viewport or flag, and every gate already prints the renderer
string beside its numbers.

### 0.1 What ran

```
✓ parsecheck            81 files, syntactically complete and contract-clean
✓ citycheck --falsify   56/56 cases rejected, 56 failure sites, coverage 100%
✓ vsyncprobe            NEW. 7 constructed cases, all as constructed, one of
                        them a declared limit. §1.4
✓ trainprobe            NEW. The nose against its design points: worst error
                        1.83e-15 m over four yaws and both faces. Two negative
                        arms, one of which REFUTED the comment it was written
                        to confirm. §3.3
✓ portalprobe           NEW. Both ends measured before anything was built. §2.1
✓ lampprobe             NEW. 0 crown/luminaire intersections over 790 lamps and
                        815 canopy masses. §4
✓ generator half        registry 5 349 → 5 364 claims, 0 forbidden overlaps
                        before and after; the delivered cost is one building. §2.5
GATE-RUNS-NEEDING-A-BROWSER — see §5 for each one's state.
```

**Every number in this file is a count, a coordinate or a piece of arithmetic.**
CONTRACT §9 rule 6's corollary — *counts do not drift* — is what makes a session
on this machine measurable at all. There is not one millisecond in it.

---

## 1. THE HUD'S CEILING UNDER A VSYNC LOCK — THE DECISION, AND WHY IT IS NOT ONE OF THE THREE

`src/core/constants.js` → `HUD.vsync` (new), `src/modules/hud.js`,
`tools/vsyncprobe.mjs` (new, NOT A GATE).

### 1.1 The ceiling is on a quantity the browser cannot deliver, and the budget file says so in its own words

The operator read `frame p50 16.7 / 12.5 ms` in red. `budget.json` defines what
that ceiling is a ceiling **on**:

> `$wallFrameMsP95`: *"End-to-end animation-frame interval **with vsync and the
> frame-rate limiter disabled**, so it is bounded below by whichever of the CPU
> and the GPU is slower."*

`tools/lib/page.mjs` and `perfcheck` both launch with `--disable-gpu-vsync
--disable-frame-rate-limit` for exactly that reason. A browser on the operator's
desk has neither flag, so the delivered interval is `max(work, T)` for a refresh
period `T` and the ceiling is on `work`. **Two quantities, same units, plausible
magnitudes — CONTRACT §9's entire subject.**

**And the tell was already in the file.** `$wallFrameMsP95_rebaseline` records
that this ceiling was **16.67** until session 4, and that *"16.67 was the vsync
line"*. The red number on screen is the ceiling's own discarded value.

### 1.2 The decision: read the censored observation, do not suppress it

The brief offered three options — suppress the frame ceiling, keep it with the
lock stated beside it, or record a separate display ceiling. **What shipped is
none of the three, and the reason is that under a lock the reading is not
uninformative, it is CENSORED.** An interval of `m·T` establishes

```
work in ((m-1)·T,  m·T]
```

and nothing finer. So a verdict against a ceiling `W` is available exactly when
that whole band lies on one side of `W`:

```
  m = 1, T = 16.67 (60 Hz)    work in (0, 16.67]    W = 12.5 is INSIDE   no verdict
  m = 2, T = 16.67            work in (16.67, 33]   W is BELOW           BREACH, red
  m = 1, T =  8.33 (120 Hz)   work in (0, 8.33]     W is ABOVE           CLEAR, green
```

**That is why it is not a suppression.** At 120 Hz the same rule turns the cell
**green**, because a held 8.33 ms lock *proves* the work is under 12.5 ms. The
crossover is **80.0 Hz**: at or above it a held lock is a pass. At 60 Hz the cell
goes neutral — not green, not red — with the lock and its measured period printed
beside it, and the **CPU p95** promoted to the line that carries information.
A dropped frame stays red at every refresh rate, which is the one thing a locked
context can still resolve and the thing a person actually sees.

**NO CEILING MOVED AND NO GATE CHANGED.** `budget.json` is untouched.
`HUD.budgets` is byte-identical and `perfcheck`'s `assertHudBudgets` still checks
it key for key against `budget.json → ceilings`. `perfcheck` runs unlocked and
asserts the same 12.5 it always has. What changed is what a panel says about a
measurement it cannot make.

### 1.3 The detector, and the estimator bug it started with

`detectVsyncLock(intervals, callbacks)` — exported and pure, so it is testable
outside a browser. Three conditions, all in `HUD.vsync` with their arithmetic:

- **`minSamples` 60** — one second at 60 Hz. The on-grid fraction then moves in
  steps of 1/60, so the 0.90 threshold sits 6 whole frames clear of 1.0.
- **quantisation, `tolFrac` 0.06 and `lockedFraction` 0.90** — at least 90% of
  intervals within `0.06·T` of an integer multiple of `T`. This is what carries
  the claim: a lock drops a frame to exactly 2T, never to 1.3T. **The
  discrimination is arithmetic**: bands of width `2·tolFrac·T` repeating every
  `T` cover 12% of the line, so an unquantised distribution lands on the grid
  about 12% of the time by luck. Derived 12.00%, **measured 11.65%** over 20 000
  uniform draws (CONTRACT §9 rule 2). Separation against 0.90: **7.5×**.
- **`maxDutyFraction` 0.75** — `p95(callback) <= 0.75·T`. A NECESSARY condition
  and not a sufficient one, and it says so: `callback` ends when the rAF body
  returns, so it does not see GPU or compositor time and the measured duty
  understates the true one.

**THE PERIOD ESTIMATOR WAS WRONG IN THE FIRST VERSION AND THE PROBE CAUGHT IT.**
`T` was `p05` of the intervals — a LOW QUANTILE of the held cluster, biased down
by about the compositor's jitter. It reported a 60 Hz display as **60.5 Hz**
(16.534 against 16.667). The seed is still the right way in (the minimum would
let one early timestamp become `T`), but a seed is not an estimate, so `T` is now
the **median of the frames the seed collects at m = 1**. Recovered:

```
built 16.667 ms (60.0 Hz)  recovered 16.657 (60.0 Hz)  error -0.010 ms (-0.06%)
built  8.333 ms (120.0 Hz) recovered  8.321 (120.2 Hz) error -0.012 ms (-0.15%)
```

It mattered twice: the displayed rate is the reader's whole check on the declared
limit below, and the bias ran toward SHORTER periods — the direction that makes
`bandCensored` claim more.

### 1.4 The declared limit, and both control directions

**This cannot distinguish a display lock from a machine steadily GPU-bound at
the same period**, because `callback` stops when the rAF body returns and the GPU
retires after it. What it can do is **print the period it measured**, so a reader
seeing `vsync-locked 20.00 ms (50.0 Hz)` on a 60 Hz display knows within one
second that it is not a lock. CONTRACT §7.7: an instrument written to detect a
failure mode is where that mode hides, so the limit is stated rather than
engineered around.

`tools/vsyncprobe.mjs` runs the detector over sequences whose answer is known by
construction (CONTRACT §7.3, both directions):

```
v 60 Hz held                       lock YES  60.0 Hz  onGrid 100%  duty 26.8%   p50 neutral
v 60 Hz, 1 frame in 10 dropped     lock YES                                     p95 RED
v 120 Hz held                      lock YES  120.2 Hz                           p50 GREEN
v unlocked, inside the ceiling     lock no                                      p50 GREEN
v unlocked, BREACHING              lock no   (not quantised AND duty too high)  p50 RED
v too few samples                  lock no   (30 < 60)
! steady GPU-bound 20 ms, vsync off  lock YES 50.5 Hz — THE DECLARED LIMIT, run
```

The fifth row is the one that matters: **a genuinely slow machine must not be
excused as locked**, and both conditions refuse it.

**The graph moved too, and for the same reason one level down.** Its reference
line is the ceiling when unlocked and the refresh period when locked — under a
lock every bar clears 12.5 ms and a graph whose every column is red shows a
person nothing, while a bar at 2T where its neighbours are at T is exactly the
stutter the graph was built for. **Amber is suppressed under a lock**: a held
frame is `T`, `HUD.amberFraction` is 0.90, and `16.7 >= 0.9 · 16.7` is true, so
every correctly delivered frame would have painted amber.

---

## 2. THE VIADUCT'S ENDS — MEASURED FIRST, AND THE BRIEF'S PREMISE WAS OFF

`src/lib/citygen.js` → `viaductEnds` (new), `src/modules/city.js`'s viaduct case,
`tools/portalprobe.mjs` (new, NOT A GATE).

### 2.1 (a) Where the ends land, and what is on that ground

Both ends are **pier stations**: `0.00 m` of unsupported deck at either end.

```
END A   deck end (-90.988, -204.207)   abutment centre (-93.140, -206.297)
END B   deck end (-90.988, +226.207)   abutment centre (-93.140, +228.297)
```

**THE ENDS ARE NOT UNBUILT.** Session 21 put an abutment, two wing walls and two
parapet returns at each one. The defect is sharper than "no portal", and it is a
height:

```
  abutment wall     0.00 -> 18.20   6.0 m along x 11.1 m across
  wing wall x2      0.00 -> 13.10   5.2 x 1.0, at +/-6.35 across
  deck box girder  18.20 -> 20.10   cut off in mid air
  deck slab        20.10 -> 21.00   cut off in mid air
  ballast + rail   21.00 -> 21.62   cut off in mid air
  parapet RETURNS  21.00 -> 22.20   0.40 m thick, at +/-4.50 across
```

**The abutment tops out at 18.20 m, which is exactly `viaductSoffitY`.** It is a
BEARING — the thing the deck sits on — and nothing rose past the deck to close
it. Between 18.20 and 22.20 the only geometry is the two parapet returns, whose
underside is 21.00, so they **float 2.80 m above the abutment they stand over**.
**8.60 m of the deck's 9.50 m width ends in nothing.** That is the cross-section
the operator was looking at.

**AND THE WHOLE MASS WAS CLAIMED BY NOBODY.** `landmarkOccluders` returns a
viaduct's **legs** and its **deck segments**; the abutment and wing walls are in
neither. An 18.2 m solid, 6.0 × 11.1 m, has stood at each end since session 21 on
ground the registry has never been told about — CONTRACT §9.1's *"anything placed
procedurally is tested against the existing occupancy, or it is not placed"*,
with a landmark's own geometry instead of a prop's.

**Visibility, and it is two-sided.** All four gate routes run down the main
east–west street at `|z| <= 3.0` and look along x; the ends are **202 m and
224 m** off that axis, about 90° off the view direction and outside every route's
55–60° field. The elevated eye `[430, 200, 470]` has a **clear** line at 874 m
and 603 m. So: **no gate camera in this project sees either end** — no look
assertion can move when this changes, and equally **no gate can confirm it**.
The evidence has to be a `lookat.mjs` frame from a pose chosen for the subject.

### 2.2 Could a portal go there? `conflict()`, swept, before anything was built

```
END A   depth 4/6/8 m free; 10 m and beyond REFUSED by building:bld:-1,-2
        width 11.1/12.7/14.0 free; 16.0 and beyond REFUSED by the same
END B   free at every depth to 20 m and every width to 18 m
```

END A's binding constraint is a **46.4 m building 10.44 m away**. END B's nearest
forbidden claim is a planter at 13.01 m. The delivered claim is 6.0 m along ×
13.7 m across, so END A clears by 2 m of depth and 0.3 m of width. **No end
landed somewhere a portal cannot go and the arc did not have to move**, which is
what session 5 paid for once.

### 2.3 (b) What was built, and every dimension comes from something already decided

A **portal head on the abutment already there** — two jambs, a lintel, and a dark
recess:

```
opening half-width  l.deck / 2 = 4.75 m   THE DECK'S OWN HALF-WIDTH, so everything
                                          on the deck passes by construction. The
                                          widest thing on it is the parapet at
                                          4.70, clearing the jamb by 0.05 m.
opening top         l.height + VIADUCT_RAIL_RISE_M + VIADUCT_LOADING_GAUGE_M
                    = 21.00 + 0.62 + 4.20 = 25.82 m
head top            27.20 m = l.height + 3.1 + 6.2/2, THE TOP OF THE CATENARY
                    MASTS ALREADY ON THIS DECK — so the portal adds exactly ZERO
                    new height to the viaduct's silhouette
lintel depth        27.20 - 25.82 = 1.38 m, whatever that leaves over the gauge
footprint           the abutment's own, unchanged. The head claims no ground the
                    mass under it was not already standing on.
```

`VIADUCT_LOADING_GAUGE_M` = 4.2 is new and is a **budget**, so §9 rule 5's
obligation is discharged: the tallest thing on this deck is the train at **3.58 m
above rail**, and 4.20 leaves **0.62 m** — exactly one `VIADUCT_RAIL_RISE_M`,
i.e. the deck could be re-ballasted a second time and the same train would still
pass the same portal. `moving.js` prints its car against it at boot.

**The recess is the box that does the work.** A frame with nothing in it is a
hole to the sky. What makes a line appear to *continue* is a dark plane set back
inside the frame: 0.30 m of reveal, inset the same across and at the head, at
**0.10× the concrete's albedo** rather than a black constant — CONTRACT §5 is
physical throughout, a real tunnel mouth is a dim surface and not a void, and the
§5.5 veil lifts it off zero exactly as it lifts every other unlit wall.

**The parapet returns are removed rather than kept.** Their own comment says they
exist *"so the deck edge does not simply stop in the air"* and the portal is what
actually achieves that; kept, they would float inside the opening. Burying them
inside the jambs was the other option and it is the failure CONTRACT §9.1 records
under *"geometry authored and then drawn inside something else"* — five vehicle
skirts, invisible, counted by every gate.

**And `VIADUCT_RAIL_RISE_M` closes a §9.1 instance found in passing**: `moving.js`
carried `railRiseM: 0.62` under the comment *"`city.js`'s ballast + rail"* — a
comment claiming a link with no link. One number now, three readers.

### 2.4 The claim: `conflict()` before `claim()`, refused rather than moved

Claimed as `landmark`, owner `viaduct:end`, the world AABB of the whole end
treatment (half 3.0 along × 6.85 across), `y 0 -> 27.20`, following the park
railings' pattern exactly — `if (reg.conflict(box)) continue;` then `reg.claim`.

**It is claimed BEFORE the roads and the buildings, and that ordering is the
point.** `landmark` conflicts with `building`, `carriageway`, `pavement`, `prop`
and five more, so laying it down first makes every one of those refuse *itself*
against the portal. Claimed afterwards it could only ever report a collision
somebody else had already committed.

**Moving it is not available and that is stated rather than implied**: an end
treatment's whole job is to be where the deck stops, so the honest failure is to
build nothing there and leave the cut end visible — which a reader can see —
rather than to slide a 27 m mass quietly into a building. **Both ends were
claimed; neither was refused.**

### 2.5 (c) The cost, measured against `main`

```
                          main    session 23
registry claims           5 349      5 364     (+15: +16 end claims, -1 building's)
forbidden overlaps            0          0
buildings                   367        366     -1   (-0.27%)
sum of floors              4 024      4 012    -12   (-0.30%)
facade area (m2)       1 117 089  1 114 030  -3 059  (-0.27%)
signs                       527        525     -2   (the refused building's)
props / features / ground  identical
```

**One building is refused**: (−105.3, −219.6), 22.0 × 11.0 m, **46.38 m tall, 12
floors, 3 060 m² of facade.** It was standing **1.73 m** from session 21's
18.2 m abutment, against the `CITY.sidewalkWidth` = 4.2 m face-to-face setback
`landmark × building` carries.

**THE ATTRIBUTION MATTERS AND IT WAS RUN RATHER THAN ARGUED.** Two arms, claim
top at 18.20 (session 21's mass alone, no head) and at 27.20 (delivered):

```
  claim top 18.20  ->  366 buildings
  claim top 27.20  ->  366 buildings
```

**The building is refused by the FOOTPRINT, not by the head.** The content cost
is the price of claiming a mass that has stood unclaimed since session 21; the
portal itself costs nothing in placement.

**Geometry cost: net +4 boxes over both ends** (−2 parapet returns, +4 portal
boxes, per end). No new mesh, no new material, no new draw call.

**What the floor says.** `floors.visibleInstances` is 115 000 and it is
**unmeasured on this machine** (it needs a route `perfcheck` can finish — STATE
22 §3.2, unchanged). The reduction is 0.27% of facade area, which is what a
window count is proportional to (CONTRACT §9, session 20's row). The refused
building is at z = −219.6, **220 m off every route's axis**, so its contribution
to any route's *visible* set is likely zero — but that is an argument and not a
measurement, and it is flagged as such. **This is the one content reduction in
the session and it is a placement refusal, not a budget trim.**

---

## 3. THE TRAIN'S SILHOUETTE — ONE OF THE THREE WAS ALREADY BUILT

`src/modules/moving.js`, `tools/trainprobe.mjs` (new, NOT A GATE).

### 3.1 The roof cap the brief asked for has been there since session 21

Measured rather than described. `trainprobe` prints the section:

```
  body       y 0.00 -> 3.40   half-width 1.450   18.00 m long
  roof cap   y 3.40 -> 3.58   half-width 1.305   17.28 long   <- ALREADY THERE
  skirt      y 0.00 -> 0.56   half-width 1.247   17.64 long
  bogies x2  y -0.43 -> 0.07  half-width 1.015
  windows    y 1.63 -> 2.58   half-width 1.479   6 a side, emissive
  NOSE (new) y 1.10 -> 3.40   half-width 1.363   raked face 2.802 m at 55.18 deg
```

The roof cap is the **second box of every car**: `carLengthM * 0.96` long, 0.18 m
deep, `carWidthM * 0.9` wide — **inset 0.145 m each side and 0.36 m short at each
end**. The hard upper edge is already broken and a second cap would be a box per
car for nothing. **Not added.**

### 3.2 The nose, and every number is bounded by something

```
overhang  1.6 m   the DEVIATION FROM A SQUARE CORNER, so it is what has to clear
                  the pixel floor. Against the 3 px floor session 20 derived for
                  a navigation lamp, at 6.4765e-4 rad/px, 1.6 m subtends 3 px at
                  823 m — past anything in this city and past the car's own
                  §5.12 cutoff. The rake reads wherever the train does.
tip rise  1.1 m   the window band's underside is carHeightM*0.62 - 0.475 =
                  1.633 m, so the tip is 0.53 m BELOW the glazing — which puts
                  the driver's screen ON the rake instead of above it. Clear of
                  the skirt at 0.56.
thickness 1.0 m   back along the face's own normal, putting the wedge's top-rear
                  corner 0.82 m INSIDE the body's end face. A thin slab reads as
                  a fin from three-quarter view.
derived           rise 2.30 m, face 2.802 m, rake 55.18 deg from horizontal
```

**Cost, in counts:** `BOXES_PER_CAR` 5 → 6, allocated body rows 40 → 48, **4
drawn** (a cab at each end of each unit; the 4 middle cars park theirs at zero
scale), **+48 triangles**, **+0 draw calls** (one `InstancedMesh`, still one),
**+0 cluster slots**. The census label `movingBoxes` goes **88 → 96** — it is
the whole mesh, cranes included — and `movingLights` is **unchanged at 108**.
`citycheck`'s scene walk asserts the label sums to `instanceMatrix.count` and
both come from the same `bodyCount`, so they still agree.

**Against the saturation reserve: it costs nothing there.** The brief asked
because the train's lit windows are already in the reserve at zero cluster slots.
The nose is **body geometry on the existing body material** — not an emitter —
so `movingLights` is unchanged at 108 and the emissive area of the train does not
move at all. The reserve itself is still unmeasured here (§5).

**AND THE NOSE FORCED A CORRECTION THE PORTAL MADE LOAD-BEARING.** `tr.len` is
used for one thing: the turn-round clamp, *"stop when the train reaches the end
of the deck"*. Before the nose existed, the body's end face **was** the train's
extent. It is not any more:

```
  body only (before)     len 74.70 m   lead car body face s 240.00   NOSE TIP 241.60
  with both noses (now)  len 77.90 m   lead car body face s 238.40   NOSE TIP 240.00
```

The deck's last station is s = 240.00 and the portal's recess begins 0.30 m
beyond it. **With the old length the nose would have stood 1.30 m inside the
recess.** With the new one the train noses up to the portal and stops.

### 3.3 THE COMMENT I GOT WRONG, AND THE INSTRUMENT THAT CAUGHT IT

The rake is composed with Euler order `'YXZ'`. The comment I wrote for it claimed
the default `'XYZ'` *"would apply the tilt in WORLD axes and rake the train
differently at every point on a curve"* — CONTRACT §9's row 2, one axis over.

**`trainprobe` was written to demonstrate that and refuted it.** The error under
`'XYZ'` is **0.0000 m at every yaw**, identical to `'YXZ'`. The reason is one
line of algebra the comment asserted past: with the X component zero, `'XYZ'`
composes `Rx(0)·Ry·Rz` and `'YXZ'` composes `Ry·Rx(0)·Rz`, and both are
`Ry(yaw)·Rz(rake)`. **An Euler order can only matter when at least two components
are non-zero.**

CONTRACT §7.7's second consequence is that an expectation which moves to match
the instrument must say which of the two was wrong. **Here it was the comment**,
and it now says so. `'YXZ'` is kept for what it will mean rather than for what it
means today: the moment anything sets the X slot — a gradient, a cant through a
curve — it stops being equivalent.

**The probe now carries both arms, and the second one is the real wrong version:**

```
delivered  'YXZ' with the rake in the Z slot    worst error 1.83e-15 m  <- exact
arm 1      'XYZ', the default                   worst error 0.0000 m    <- INDISTINGUISHABLE
arm 2      the tilt in the X slot (a ROLL)      worst error 2.8534 m    <- REJECTED
```

The delivered nose lands on its two design points — the tip at
`(carLength/2 + overhang, tipRise)` and the roof corner at `(carLength/2,
carHeight)` — to **1.83e-15 m** over four yaws and both faces.

### 3.4 The other two changes are NOT built, and the reason differs for each

- **Roof cap: already exists** (§3.1). Building it would have been a box per car
  for a property the car already has.
- **Shoulder chamfer: HELD, and honestly held.** The brief's instruction was to
  do the nose first and *look at it* before the other two. **I could not look at
  it properly on this machine** — see §5 — so the honest state is that the nose
  is built and verified geometrically and the judgement the brief asked for has
  not been made. It is next session's first call, and it is a one-line decision
  once somebody has a frame: **if the nose alone settles it, the chamfer is cost
  without benefit and should be written off rather than deferred again.**

---

## 4. THE LAMP HEAD IN THE CANOPY BAND — MEASURED, NOT REPAIRED

`tools/lampprobe.mjs` (new, NOT A GATE). Nothing was declared and nothing moved.

### 4.1 The population the item is about is empty

```
prop 'lamppost' placed over the gate's region           0
kerbside + promenade heads emitted by city.js         790   (716 + 74)
```

`PROP_MODELS.lamppost` — the 0.17 m post with the arm at 4.14 m reaching 0.61 m,
which is exactly what the brief describes — is offered only to the `parking`
scatter, and **zero are placed** over the region at seed 1337. Declaring *its*
head in the canopy band would be a change to an object that does not exist, which
is CONTRACT §7.1's gate-that-cannot-fail wearing a claim.

**The lamps that actually light this city are a different object.** They are
emitted by `city.js`'s own street-lighting loop on a lattice, at **8.08 m** of
mounting height with a **2.1 m** arm and a 0.42 m bowl, plus the promenade line
on the same geometry. **Neither their column nor their head is a registry claim
of any kind** — the prop scatter never sees them, so there is no claim to be
missing a band from. **That is a larger gap than the one the brief describes.**

### 4.2 (a) The count is 0, and it is not 0 by a comfortable margin

```
intersecting (bowl, crown) pairs                      0
delivered canopy masses                             815   over 224 trees
their tops:   min 2.78   median 5.60   p95 8.25   MAX 9.47 m
a bowl's underside                                 7.66 m
canopy masses tall enough to reach a luminaire     64 of 815
NEAREST MISS                    0.24 m vertical at 2.57 m horizontal
```

**The two populations overlap in height.** 64 of 815 canopy masses reach above a
bowl's underside. What separates them is **horizontal**: a lamp stands 8.8 m from
the road centreline with its arm reaching 2.1 m back toward the kerb, and no tree
is planted close enough for its crown to arrive there.

The nearest miss of 0.24 m is **1.5×** the 0.16 m ground-datum uncertainty (the
probe takes a common datum; where a lamp and a tree stand on different surfaces
the gap is at most one `BLOCK.kerbHeight`). **So the zero survives the caveat,
but only just. It is a bound rather than a margin.**

### 4.3 (b) It does not plausibly cost light, and that is a hypothesis excluded

CONTRACT §5.9: a street lamp declares an angular distribution and follows 1/cos³
below its peak angle — it throws light **down and outward** onto the road. So
foliage costs a pool only if it sits between the optic and the ground under it.
**Zero crowns intersect a luminaire, so nothing is between any optic and any
pavement.** The operator's standing complaint — pavements and parks dead outside
the lamp pools — is real and is carried in §6, and **it is not this**. No
lighting model was changed to find out.

**Session 22's own frame pair, re-read against these numbers.** STATE 22 §1.6
says the lifted crown *"now occludes the streetlamp head that was visible above
it before"*. That is a **line of sight passing a crown** from a pavement-height
camera 6.5 m away — not a crown resting on an optic. Two different claims, and
the first one is true.

### 4.4 (c) The repair is not owed by the brief's own test, and two better items came out of it

The brief said: *if the count is non-trivial, write the repair up with its cost.*
**The count is 0**, so it is not owed. The arithmetic is recorded anyway because
a zero with 0.24 m under it is worth watching:

```
trees a declaration would refuse today      0 of 224 (0.00%)
lamp heads currently intruded on            0 of 790
```

And a note on the mechanism the brief proposed: declaring a lamp head as `canopy`
would be **inert**, because `canopy × canopy` is permitted on purpose (two crowns
overlapping is a clump). It would have to be declared as something the table
forbids a canopy from meeting, and *that* is the change with a cost.

**The two findings worth more than the item was** are §6 items 2 and 3.

---

## 5. WHAT COULD NOT BE RUN HERE, AND WHY EACH ONE REFUSES

Unchanged in kind from sessions 21 and 22: there is no GPU, so every gate that
reads a pixel refuses or is unmeasurably slow.

| gate | state this session |
|---|---|
| `parsecheck` | **green**, 81 files |
| `citycheck --falsify` | **green**, 56/56, coverage 100% |
| `citycheck` (full) | needs a browser; `sceneWalk` and `saturation` were red on this machine in session 22 for machine reasons and nothing here changes that |
| `windcheck` | **started and DID NOT FINISH.** Three of its six eyes ran (354 / 481 / 397 meshes) and it then died on `page.evaluate: Execution context was destroyed` — the SwiftShader renderer crash session 21 hit twice. It was running alongside a `lookat` capture on four cores; both died together, which is the attribution. Not re-run for want of wall-clock. See §6 item 1 |
| `faultcheck` | findings green in session 22, refuses on the renderer at the END, after every case has printed |
| `lookcheck` | **cannot be reached**: eight captures at 2560×1440 on SwiftShader, one PNG in ~21 minutes |
| `perfcheck` | 4 routes × 3 runs is ~21 600 SwiftShader frames. Not attempted |

**`npm run gates` did not run green end to end, and it could not have on this
machine.** That is the same honest state sessions 21 and 22 recorded, and it is
recorded again rather than worked around. Nothing was weakened to change it: the
one environment change (§0) selects a browser binary and moves no threshold.

**The frames.** The brief asked for the ray-tested pose from session 22 rather
than a guessed camera, and `tools/portalprobe.mjs` does that: candidate poses are
ray-tested against the region's building claims until one has a clear line to
both the portal's base and its head top. The poses it found:

```
END A   --pos=-125.32,1.74,-230.58 --target=-93.14,16.86,-206.30
END B   --pos=-121.83,1.74,256.17  --target=-93.14,16.86,228.30
```

Both are 40 m outward of their deck end at eye height, clear of every building.

**END B's frame came back and the portal reads.**
`tools/shot-out/portal-endB-t0_5.png`, 1024 × 576 on SwiftShader, 347 draws,
121 chunks, **30/30 field slots ready in 4 waits** — a fully streamed city
rather than the mid-stream capture `lookcheck` gets at 2560 × 1440 here:

```
node tools/lookat.mjs --pos=-121.83,1.74,256.17 --target=-93.14,16.86,228.30 \
  --fov=58 --t=0.5 --w=1024 --h=576
```

What it shows, and it is the thing that was asked for: **a mass with a dark
recess near its top, and the line has gone into it.** The recess reads as depth
rather than as a hole punched through to the sky — the jamb and lintel edges
catch the sun and the opening sits behind them in shadow, which is what the
0.30 m reveal is for. The head sits under the arch landmark 37.75 m beyond it and
does not compete with it. **This is no longer a line that has been cut.**

**Two honest observations from the same frame, neither of them this session's
item.** The abutment below the opening is 18.2 m of undifferentiated wall and it
reads as a lot of blank concrete — that mass is session 21's and this session
did not touch it. And the frame is taken from OUTSIDE the end, so it shows the
portal and not the deck running into it; a three-quarter pose would show both
and was not run for want of wall-clock.

---

## 6. WHAT THE NEXT SESSION STARTS FROM

1. **`windcheck` DID NOT FINISH AND IT IS THE GATE THIS SESSION'S GEOMETRY MOST
   OWES.** §5. Four portal boxes an end and a raked nose row a car are new
   geometry, and the census is the thing that says nothing is inside out. It
   reached three of six eyes before the renderer's execution context was
   destroyed — with a `lookat` capture running beside it on four cores, which is
   the likely cause. **Run it alone.** Nothing about it needs a GPU (STATE 22
   §3.1); it needs the machine to itself.
2. **JUDGE THE TRAIN'S SILHOUETTE.** §3.4. The nose is built and verified as
   geometry to 1.83e-15 m, and the brief's actual instruction — look at it, then
   decide whether the other two changes are worth their boxes — is the part this
   session could not complete. `node tools/lookat.mjs --pos=70,1.74,0.9
   --target=0,23,11 --fov=52` catches a train near the crown (train 1 starts at
   s = 0 at boot). **If the nose alone settles it, the shoulder chamfer is cost
   without benefit and should be written off rather than deferred a third time.**
2. **THE 790 LAMPS ARE IN NO REGISTRY BAND AT ALL.** §4.1. Not their column, not
   their head. A column 1.3 m outside the kerb is something a prop, a tree or a
   sign could be placed straight through and nothing would report it. Ask of
   `prop × lamp column` the question this session asked of
   `canopy × lamp head` — `tools/lampprobe.mjs` already builds the lattice.
3. **`PROP_MODELS.lamppost` is placed zero times over the gate's region.** §4.1.
   Either it should reach the street scatter or it is dead content; both are
   decisions, and today it is neither.
4. **THE TWO CONTAINERS ON A HOARDING'S FOOT — `citycheck` is still red at 2.**
   Carried from STATE 22 §2.4 unchanged. `node tools/benchprobe.mjs --limit=8` is
   one command. **Two repairs were built, measured, found to change nothing, and
   reverted — read STATE 22 §2.4 before rebuilding either.**
5. **`floors.visibleInstances` and `drawCalls` on a real route.** Counts, so they
   need no quiet machine, but they need a route `perfcheck` can finish. This
   session removed one building of 367 (§2.5) and that number is the one it
   would show up in.
6. **The saturation reserve, still unmeasured.** STATE 20 recorded 1.53 points of
   margin. The train's lit windows and the crane's obstruction light have never
   been measured against it; this session's nose adds no emissive at all (§3.2),
   so the question is unchanged rather than worse.
7. **`faultcheck`, `lookcheck` and `citycheck`'s saturation all need a GPU.** §5.
8. **The machine, and it is now the fourth session asking.** `budget.json` →
   `machine.series.m5` is an empty slot with the three steps that fill it.
   Nothing in this project has a millisecond measured after session 20.
9. **Decide whether `machine` gets an assertion.** Carried from STATE 22 §6.3.
   The field is inert, which is why three sessions have had to remember not to
   fake it.
10. **The stop line stays at −10.45 m and stays red.** STATE 22 §5, untouched by
    instruction. The measurement that decides it is one line: record
    `veh.recycled` alongside the vehicle that sets `worstStopLineM`.
11. **`index.html`'s `#bootfail` still has not been through `lookcheck` or
    `gateaudit`.** Carried from STATE 21 §9 item 3.
12. **A bench's BACK faces nowhere in particular.** STATE 22 §1.2. `band.side` is
    known at the placement and is not read in the yaw.
13. **STATE 21's off-axis fraction of 0.665 does not reproduce** (the gate prints
    0.739). STATE 22 §1.4.
14. **Items 8 and 14 from session 20 — vehicle light signatures and vehicle
    pop-in — NOT STARTED.** Diagnosis carried.
15. **`player`'s ceiling at the quiet bar** (STATE 20 §5.3) and **the
    retroreflective BRDF for the markings** (STATE 21 §5.2, 24× at the standard
    entrance angle).
16. **TWO MERGED BRANCHES STILL EXIST ON THE REMOTE.** Checked this session with
    `git ls-remote`: `claude/generator-occupancy-registry-6pbuer` and
    `claude/noctis-22-machine-residual-t3u3px` are both still there. Both are
    verified ancestors of `origin/main`, so deleting them loses nothing.
    `git push --delete` returns **HTTP 403** through this environment's proxy and
    the GitHub MCP surface has no delete-branch tool. **Not retried this
    session** — it needs a click, not a session.

---

## 7. KNOWN GAPS CARRIED FORWARD

**Unchanged from s8–s22**: `stats().cutoffM` hard-codes 0.8, the headroom probe
inert, GPU timer queries advertised and never retiring, `saturation-peak.png`
overwritten every run, `$fovYDrift`, `camera.setRouteAt(name, 1.0)` at the sky,
rain streaks near-invisible wide at night, `rain_spray` 0 static, right turns
only, sun shadows to ~170 m, the bake blind to elevated slabs, the PMREM hitch,
the too-red dawn horizon, one worker at queue depth one, the far half of the
river handing back to the night sky past ~300 m, grime authored, the near-field
washboard on the water, the quay wall inside the walkable mask, **props absent
from the walkability mask**, the 3.5°–10.4° route camera pitch, the
frozen/running A/B, and `downtown_dense`'s mean luminance under its floor.

**Resolved this session**: a HUD ceiling that could not go green in the context
it was displayed in; the viaduct's deck section ending in mid air above an
abutment that stopped at the soffit; that abutment and its wing walls standing on
unclaimed ground; `moving.js`'s `railRiseM` as a second literal under a comment
claiming a link; the train's turn-round clamp using the body's extent as the
train's; a launcher that could not find the browser this container has.

**Still red and unchanged**: `occupancy` at 2, `prop(container) × site(hoarding)`
— STATE 22 §2.4. `minStopLineM` at 0. `floors.visibleInstances` unmeasured.

**New in CONTRACT §9's table**: the vsync-locked frame INTERVAL read as the
UNLOCKED interval the ceiling was derived for; a viaduct's ABUTMENT — the mass
under the deck — standing in for its END TREATMENT, so the section above the
soffit was never closed; the train's BODY LENGTH used as the train's EXTENT in
the turn-round clamp.

**One thing recorded in the code rather than in the table, because it caused no
delivered defect**: a comment claiming the default Euler order would rake the
train in world axes. It would not — at x = 0 both orders are the same matrix. The
comment was corrected and `trainprobe` carries the refutation (§3.3). It belongs
here rather than in §9's table because nothing was ever wrong in the frame; what
was wrong was a claim about what would have been.
