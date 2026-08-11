# NOCTIS — STATE

*End of session 22. **The 60 benches were a transposition and the repair took
`citycheck` → `occupancy` from 60 forbidden overlaps to 8. The 8 that remained
were trees, the worst of them larger than any bench, and they were a second
quantity confusion that the benches had been hiding: a canopy's head clearance
authored in MODEL space and read as the clearance it is DELIVERED with. Both
halves of the two-sided check are now 0.***

*And the machine, again: **this session did not run on the operator's MacBook Air
M5.** It ran in a Linux container on a 4-core Intel Xeon with no GPU, exactly as
session 21 did. Nothing in `budget.json` is an M5's number and the M4 series
stands untouched. §0.*

Read `CONTRACT.md` before this file, and before any source file.

---

## 0. THE HONESTY LINE — THE BRIEF'S PREMISE WAS FALSE AND IT IS THE FIRST THING TO SAY

The session brief opened: *"You are now running on the operator's MacBook Air
M5."* It was not. Measured, first command of the session:

```
$ uname -a
Linux vm 6.18.5-fc-v20 #1 SMP PREEMPT_DYNAMIC @0 x86_64 x86_64 x86_64 GNU/Linux
$ sw_vers                → (no sw_vers — not macOS)
$ grep 'model name' /proc/cpuinfo
                         → Intel(R) Xeon(R) Processor @ 2.80GHz
$ nproc                  → 4
$ free -m                → 16 075 MB
$ ls /dev/dri            → No such file or directory
GPU (through Chromium)   → ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device
                            (Subzero)), SwiftShader driver)
```

**So brief item 1 could not be done and was not faked. `tools/quiet-gates.sh
--measure-floor 10` measures the machine it runs on; running it here would have
derived a quiet bar for a virtual machine and filed it under `budget.json` →
`machine` as though it were an M5's, which is CONTRACT §9's failure mode with a
whole computer.** That is the same refusal session 21 made, for the same reason,
and it is the second session running in which the brief and the hardware
disagree.

**What was done instead, because a second refusal by discipline is worth less
than a refusal with a mechanism behind it:**

- **`budget.json` → `machine` now carries the two-series shape the brief asked
  for**, with the M4 populated and authoritative and the M5 present as an
  explicitly `UNMEASURED` key holding no numbers, plus the three steps that fill
  it. An empty slot is a measurable state; a plausible number is not.
- **It also records the thing that made two sessions have to *remember*:
  NOTHING IN THE PROJECT READS `budget.json` → `machine`.** Grepped: no gate, no
  probe, no module. It is prose in a data file — CONTRACT §9.1's first variant
  (a value written in config that the code does not read) with a computer
  instead of a pier spacing. `filmshot.mjs` prints the real machine from
  `os.cpus()` and compares it to nothing.
- **`tools/quiet-gates.sh` now stamps the machine into every log it writes**
  (`machine_stamp`, one line, portable): kernel, arch, cores, CPU brand. Both
  `quiet-gates-*.log` and `idle-floor-*.log`. It does **not** refuse — refusing
  needs a declared identity to compare against, which is the assertion above
  recorded as the next session's decision. Before this, `idle-floor-*.log`
  carried no hint of its provenance, so a `min 0.24` off a virtual machine and
  the attested `min 1.32` off the operator's laptop were indistinguishable a
  session later — and 0.24 is the more attractive of the two, because it is
  lower.

**No ceiling was widened and the question was not entertained.** The brief said
*"if you find yourself about to widen a ceiling because the new machine has
headroom, stop and write down why instead"*, and the reason is now in the file:
the stated goal is 60 fps on an M4 or better, so a newer machine's headroom is
not a content allowance. Raising a ceiling because a faster computer arrived
would be CONTRACT §0 rule 5 with a purchase order.

### 0.1 What ran here, and what a number in this file is

```
✓ parsecheck              80 files — and it was RED on main. See §4.
✓ citycheck --falsify     56/56 cases, 56 failure sites, coverage 100%
✓ perfcheck --falsify     74/74 cases, 72 failure sites, coverage 100%
✓ citycheck  occupancy    0 generator / 0 delivered over 50 forbidden pairs
✗ citycheck               2 red (session 21 had 3 of 24): sceneWalk (the
                          machine — canyon bakes at 0.8–3.0 s here) and
                          saturation (UNRUN — needs a rasteriser)
✓ windcheck               678 meshes, 0 wound backwards, coverage 678/400,
                          both control directions holding. RAN FOR THE FIRST
                          TIME ON A MACHINE WITHOUT A GPU — §3.1, its refusal
                          guarded no pixel.
✓ queueprobe              RAN, and the FINDING IS RED: the stop-line defect
                          reproduces at −10.454 m, dt = 0.1, one cycle. §5.
✗ item 2(f), the FRAME     NOT DONE. The brief asked for a street-level frame
                          before and after at the same seed and camera, and it
                          is the one part of item 2 this file cannot answer.
                          §1.6.
—  perfcheck              NOT RUN IN FULL. 4 routes × 3 runs at 2560×1440 is
                          ~21 600 SwiftShader frames. Counts recovered from
                          citycheck's scene walk instead — §3.2.
—  faultcheck / lookcheck refuse, and BOTH REFUSE CORRECTLY. §3.
```

**Every number in this file is a count, a coordinate or a piece of arithmetic.**
CONTRACT §9 rule 6's corollary — *counts do not drift* — is what makes the
session measurable at all. There is not one millisecond in it and there is not
one luminance.

---

## 1. THE 60 BENCHES — A TRANSPOSITION, VERIFIED RATHER THAN ACCEPTED

`src/lib/citygen.js` → `kerbBands`, the `kerbRef` assignment in the kerbside
branch of the prop scatter. `tools/benchprobe.mjs` — NEW, NOT A GATE.

### 1.1 The box pair, which is the whole finding

STATE 21 handed over a disagreement rather than a repair: the generator's
registry reported **0** forbidden overlaps among 5 349 claims and the delivered
census reported **60**, every one a kerbside bench overlapping its own
carriageway. A count of a disagreement says nothing about which of the two
rectangles is wrong, so the first thing built this session was the instrument
that prints both (CONTRACT §9 rule 2, and it is four lines):

```
  bench  overlap 0.048 m² with carriageway (ground:road)
    claimed    centre ( 8.097,  76.568)   half (x  0.286, z  0.944)
    delivered  centre ( 8.097,  76.568)   half (x  0.935, z  0.252)
    Δcentre    0.0000 m    Δhalf      (x  0.650, z -0.691)
    transposed (x -0.008, z -0.034)   ← claimed half SWAPPED against delivered
    record     yawDeg -0.325  refDeg 0.000  kerb true  variant 0  scale 1.074
```

**The centres agree to four decimals and the half-extents are each other's
transpose to within 0.008–0.044 m.** That residual is not slop: the claim is
built at `CITY.maxYawDeg`, the worst case over the jitter, and this bench was
drawn at −0.325°, so the claim is larger by exactly the margin it is supposed to
carry. Three more offenders read the same way (0.088, 0.235, 0.204 m²).

### 1.2 `axis` names the FIXED axis, and the doc comment said the opposite

```js
{ axis: 'x', at: b.x0, side: +1, t0: b.z0 + CORRIDOR + 3, t1: b.z1 - 3 },
```

`at` is an **x** coordinate and `t0/t1` run over the chunk's **z** range, so a
band with `axis: 'x'` is a kerb line running along **Z**, and a prop lined up
with it wants yaw **90°**. The comment above `kerbBands` said *"the axis the band
runs along"*, which is where the error came from. What shipped was

```js
kerbRef = band.axis === 'x' ? 0 : 90;      // both cases inverted
```

**and the two lattice cases are inverted against each other**, which is why both
produced the same defect and why no comparison between the two bands could have
shown it.

**THE CLAIM WAS RIGHT ALL ALONG.** For `axis === 'x'` the placement claims
`claimAt('prop', x, z, halfAcross, halfAlong)` — the small half-extent on X and
the long one on Z, i.e. exactly yaw 90°. The promenade band is also right: its
`kerbRef` is the bank tangent (≈0° where the bank runs along x) and its claim is
long on X. So the generator tested a bench lying **along** the kerb and `city.js`
drew one lying **across** it. Repaired as the emitted yaw and nothing else:

```js
kerbRef = band.axis === 'x' ? 90 : 0;
```

**90 and −90 are the same axis and the same box, and nothing in this project
distinguishes them today** — the occupancy claim reads |cos|/|sin|, the alignment
check reads `yawDeg − refDeg` mod 90, and `band.side`, the field that would
decide which way a bench's BACK faces, is not read in the yaw at all. That is a
real gap; it is written down in the code rather than closed on a guess, because
a bench turned to face the road is a content decision with no measurement behind
it yet.

### 1.3 The determinism claim is ASSERTED, not stated

`kerbRef` draws nothing from `propRng` and `yaw()` is called identically on both
branches, so no position, variant, scale, soil or lean can move and only the
emitted matrices should change. That was verified rather than believed — the
registry dumped over the gate's own region on both sides of the change and
diffed:

```
registry claims                                     5 349  vs  5 349
claims differing IN EMISSION ORDER                            0
sorted full-precision dump, md5                     fe6ccf27…  identical
prop records                                        1 596  vs  1 596
records differing in x, z, kerb, kind, scale,
  variant, soil, lean, leanAzDeg                              0
records with a changed yawDeg                             1 134
records with a changed refDeg                             1 134   ← the same 1 134
refDeg transitions                          0 → 90: 577   90 → 0: 550
records with a changed (yawDeg − refDeg)                      0
```

Byte-identical, not merely set-equal. **The 577/550 split is the confirmation
that both lattice cases were wrong**: they moved in opposite directions in
matched pairs. `max |Δ(yawDeg − refDeg)| = 5.8e-15°`, which is a fraction of an
ulp of 90 in double precision (2.0e-14) and comes from evaluating `90 + y − 90`
instead of `0 + y − 0` — so **do not write "bit for bit" about that quantity**;
write it about the registry, where it is true. CONTRACT §5.11 makes the same
distinction about a change that recompiles a shader.

### 1.4 The alignment check's reading is unchanged, confirmed rather than assumed

It reads `yawDeg − refDeg` and both move together, so it should not move. It
does not, on the generator's own population and on the gate:

```
                          before    after
prop deviation, max      2.200366° 2.200366°
prop off-axis fraction   0.731830  0.731830
citycheck alignment      73.9% of 2490 off-axis, largest deviation 2.27° (max 3°)
                         — IDENTICAL across all three gate runs
```

**One correction to STATE 21 that matters, because it is a claim about an
unchanged quantity.** STATE 21 §5.4 and the session brief both record the
off-axis fraction as **0.665**. The gate prints **0.739**, before and after, on
three independent runs. 2.27° reproduces exactly; 0.665 does not. The floor is
0.60, so the direction is harmless, but the number in STATE 21 is not what the
instrument says.

### 1.5 Delivered, both halves, printed

```
run          generator claims   delivered claims   forbidden overlaps (gen / delivered)
before             5 349              2 006                0 / 60
after the yaw      5 349              2 006                0 /  8
after §2           5 349              1 636                0 /  0
```

`maxDeliveredConflicts` and `maxGeneratorConflicts` are both 0 and neither
moved. **A caveat on the third row, because it is the one that reads as the
result:** it streamed fewer chunks before the 30 s wall bound (`sceneWalk` timed
out with 15 bakes queued rather than 12), so its delivered census is 1 636
claims rather than 2 006. That is still well above `minDeliveredClaims` = 1 200
and the gate's own floor is met, but the 60 → 8 step is a like-for-like
comparison at 2 006 and the 8 → 0 step is not. What corroborates it is §2's
arithmetic, which is machine-independent: the six offenders are named, their
mechanism is derived, and the geometry that produced them no longer exists.

### 1.6 THE FRAME WAS NOT TAKEN, AND THAT IS THE ONE PART OF ITEM 2 THAT IS OPEN

The brief asked for a street-level frame before and after at the same seed and
camera, on the grounds that this is a visual change as well as a numerical one —
*"every bench, planter and cabinet on a north–south street currently stands
across the pavement with its end to the road"*. **It was not taken, and the
reason is a queue rather than a principle:** every browser run on this container
costs 10–40 minutes, `citycheck` was run three times to get the before/after
pair, `windcheck` was run once, and the stop-line arm took the rest. `lookat.mjs`
is the tool (`node tools/lookat.mjs`, and it asserts nothing, which is why it is
the right one) and the pose wants to be down a **north–south** street, because
that is the band the repair turns.

**So the claim in this file about the street READING better is not made.** What is
claimed is the geometry: 1 134 props whose long axis now lies along their kerb
rather than across it, with the claimed and delivered boxes agreeing. Whether
that looks right is a separate question and it is unanswered. Do not let §1.1's
numbers stand in for it — CONTRACT §10 step 4 is explicit that the numbers are
necessary and not sufficient.

---

## 2. THE 8 THAT REMAINED WERE TREES, AND THE BENCHES HAD BEEN HIDING THEM

`src/lib/citygen.js` → `PROP_MODELS.tree` variants 0 and 1,
`derivePropHalfAcross`, and the new `PROP_SCALE`.

The brief predicted *"After: 0 of every kind"*, measured with a kind-level AABB.
The delivered per-box banded census says **8**, all `prop(tree) × carriageway`,
and **the worst of them is 1.264 m² — larger than any of the 52 benches.** It
was invisible until the benches were repaired, because it is the same conflict
pair and the benches dominated the count.

### 2.1 The mechanism, and it is CONTRACT §9's table again

Two places decide whether a prop's box is overhead or underfoot, and they were
asking the same question in two different spaces:

```
generator   derivePropHalfAcross:  b.y − (h/2·cos θ + w/2·sin θ) ≥ HEAD_CLEAR_M
                                   → MODEL space, unscaled, no lean
delivered   city.js band split:    lo = e[13] − hy − baseY < HEAD_CLEAR_M
                                   → off the DELIVERED instance matrix: scaled,
                                     leaned, yawed
```

`HEAD_CLEAR_M` is 2.10 m. No delivered tree is at scale 1 — the scatter draws
`PROP_SCALE` = 0.85..1.25 — and each variant leans by up to `leanRange`:

```
variant     lowest foliage underside    at scale 1   at 0.85   at 0.85 + lean
broad  (0)  bxt(-0.42, 3.40, …, 9°)        2.183      1.856        1.681
colum. (1)  bxt(-0.10, 3.34, …, 5°)        2.227      1.893        1.831
small  (3)  bxt( 0.02, 3.05, …, 10°)       2.558      2.174        2.084
```

**The broad tree's crown was authored to clear head height by 83 mm and hung at
1.68 m as delivered** — under a person, and 1.4 m under a hauler's roof. So the
generator claimed a trunk's worth of ground and `city.js` delivered a crown's.
Every one of the six offenders confirms it: scale **0.863, 0.870, 0.895, 0.904,
0.930, 0.933**, variants 0 and 1 only, low-band tops at 3.86–4.19 m — a whole
foliage mass in the ground band. Not one at scale > 0.933.

**And the comment over `PROP_MODELS.tree` said it could not happen:** *"EVERY
CROWN CLEARS `HEAD_CLEAR_M`, and that is a placement constraint rather than an
aesthetic one."* A claim about the models with no check behind it (CONTRACT
§9.1). It is now true, and it names where it is checked.

### 2.2 The repair is on the GEOMETRY, and moving the test alone was the trap

Making `derivePropHalfAcross` delivered-accurate **without** touching the models
would count those masses as ground and take the across-pad from **0.363 m to
1.640 m** (broad) and **0.250 m to 1.004 m** (columnar), against the
**0.650 m** `fitsKerb` admits. That refuses every broad and columnar street tree
the pavement — which is session 21's own §5.3 arriving from the other side, and
that session's warning is why it was checked instead of shipped.

So both crowns are **lifted** — broad by 0.50 m, columnar by 0.35 m — with the
trunk extended to meet them and **the crown's internal spread untouched**: every
mass moved by the same amount, so the broad tree's 4.62 / 5.01 / 5.45 stagger
becomes 5.12 / 5.51 / 5.95, the same 0.83 m over a tree 0.50 m taller. A street
tree is lifted clear of the footway for exactly this reason. Variant 3 needs
nothing: its low crown is deliberate, it is a park species refused the kerb
already, and its across-pad is set by masses below the one that disagreed — the
disagreement is inert and was checked to be.

**Then the test was corrected too**, so a future model cannot reintroduce this
silently. It now evaluates the clearance in the space the geometry is delivered
in, at the worst scale and the worst lean:

```
underside, model     u  = b.y − (h/2·cos θ + w/2·sin θ)
worst lean, worst azimuth   u·cos φ − R·sin φ     R = the box's own horizontal
                                                    reach from the model axis
worst scale                 × PROP_SCALE.min
```

`R` is the circumscribing horizontal radius rather than the exact lowest
corner's, so the bound is **conservative** — it can call a box underfoot that is
marginally overhead, never the reverse. That is the safe direction, and it is
`occupancy.js`'s own argument about why a missing height defaults to a surface:
an over-claim shows up as a spurious conflict a reader can see, an under-claim
shows up as nothing at all.

`PROP_SCALE` is a named constant now because two places read it — the scatter
draws it and the derivation needs its minimum. It was a literal `0.85, 1.25` in
the scatter and nothing else knew.

### 2.3 What it cost, measured against `main` rather than argued

```
                          main   session 22
registry claims           5349      5349
props                     1596      1596
kerbside props            1171      1171
buildings                  367       367
park / site features       804       804
refused, by category    identical (landmark 55, building 47, water 16,
                        block 14, pavement 6, carriageway 5, deck 4)

kerbside trees             133  →    134
tree across per variant   0.363 / 0.250 / 0.442 / 1.233  — EXACTLY session 21's
```

**Nothing lost, and one more street tree.** The per-variant pads are identical
to the four numbers STATE 21 §5.3 recorded, so the delivered-space test costs no
kerb eligibility at all. Per-kind totals shift by ±3 as a few placements resolve
differently against the slightly larger crown pad; the totals do not move.

---

## 3. THE FOUR REFUSING GATES — WHICH REFUSALS ARE REAL

The brief asked for every one of these as a number, red or green, on a real GPU.
There is no GPU here, so the honest report is: **one of the four refusals was
guarding nothing and that gate now runs; two refuse correctly and report in full
before doing so; one is a genuine pixel measurement and stays UNRUN.**

| gate | where the refusal sits | is it guarding a pixel? |
|---|---|---|
| `faultcheck` | at the END, after every case has run and printed | yes — *"the frame still renders: real pixels, more than one value in them"* |
| `lookcheck` | at the END, after all eight captures and the structure notes | yes — it is the look gate; the frames ARE the measurement |
| `citycheck` | beside the saturation sample, since session 21 | yes — `saturation` and `bright reserve` read the frame |
| `windcheck` | **line 87, before a single census was gathered** | **no. Nothing in it reads a pixel.** |

### 3.1 `windcheck`'s refusal is now a NOTE, and this is the one change to a gate

It threw before anything was gathered, so a machine without a GPU produced no
verdict on the winding of any mesh in the city. That is exactly the shape
`citycheck` had a session ago, and STATE 21 §7.1 corrected it by moving the
refusal to the assertion it invalidates. **This gate has no such assertion:**

```
volume    signed volume from the triangle order
normals   authored normal against the geometric one, weighted by AREA
facing    front-facing AREA toward an eye point, in world space, through
          matrixWorld and three's own frontFaceCW rule
```

All three run in `harness.windingCensus()` on the CPU over geometry attributes
and delivered instance matrices. `budget.json` →
`winding.thresholds.$minNormalAgreement` already said so of itself: *"the whole
computation is deterministic Float32 arithmetic in JS with no driver in it."*
CONTRACT §0.2 is explicit about the cost of a refusal that cannot pass — *"a gate
that can never pass produces zero measurements, and zero measurements is not
stricter than imperfect ones — it is nothing."*

**IT CANNOT MAKE A RED GATE GREEN, and the guard is already built rather than
added for the occasion.** The one way a slow rasteriser degrades this census is
by not finishing the streaming, so fewer meshes are resident — and `minMeshes`
(400) and `requiredMeshes` fail on exactly that. **The failure mode of a software
run is a false RED, not a false green**, which is the direction a gate is allowed
to be wrong in. The renderer string is still printed beside the table so no log
is anonymous about the machine it came off, and `budget.json` →
`winding.$pixelFree` records **what would invalidate the argument**: any
threshold here that comes to read `page.screenshot()`, a
`readRenderTargetPixels`, or a harness call that renders in order to answer. Add
one and the refusal comes back, beside it.

This is the change in the session that most deserves a sceptical reading, and it
is the one CONTRACT §7.3.1 requires be argued with its negative direction
guarded. The negative direction is the paragraph above — and it is not only an
argument, because the run happened:

```
6 eyes over 3 routes: 354 / 481 / 397 / 491 / 439 / 485 meshes

678 meshes: 674 ok, 0 WOUND BACKWARDS, 0 unmeasured, 4 double-sided (not culled)
coverage:   678 names, 678 meshes (floor 400), 674 of 674 cull-eligible decided
            (volume 587, normals 669, facing 502); 0 unmeasured (ceiling 0)

controls — CONTRACT §7.3, four shapes through the same census
  winding:control:good        closed   +8.00e+0   1.0000   0.5000   ok   ← must pass
  winding:control:reversed    closed   −8.00e+0   0.0000   0.6667   bad  ← must fail
  winding:control:quad-up     open      0.00e+0   1.0000   1.0000   ok   ← must pass
  winding:control:quad-down   open      0.00e+0   0.0000   0.0000   bad  ← must fail

windcheck ✓
```

**Both control directions hold on a software rasteriser**, which is §7.3's own
requirement and is the demonstration that the census is not answering the same
thing to everything. The four double-sided rows are the sky background and the
three rain layers, exactly the four `budget.json` →
`winding.thresholds.$maxUnmeasured` names.

**And this is brief item 3's real answer: session 21's new geometry is correctly
wound.** The park's pond surface (`river:water`, open, signed volume −1.44e6,
facing 1.0000), the abutment wing walls, the tilted canopy masses and this
session's lifted crowns are all in a census of 678 meshes with **zero** wound
backwards. That is the gate the brief expected to have something to say, and what
it says is that nothing is inside out. 678 against the 627 the budget's
derivation recorded is session 21's own additions turning up.

### 3.2 The counts the brief asked for

`floors.visibleInstances` and `drawCalls` are asserted by `perfcheck`, which
needs 4 routes × 3 runs at 2560×1440 — about 21 600 SwiftShader frames, and
session 21 lost the renderer's execution context twice trying 4 320. **They are
counts, so they do not drift (CONTRACT §9 rule 6's corollary), and what could be
recovered here came off `citycheck`'s scene walk of the delivered city:**

```
270 instanced meshes (270 labelled, 0 not), 100 plain
0 meshes whose label does not sum to instanceMatrix.count, 0 drawing fewer
  than they allocated
movingBoxes 88, movingLights 108      ← session 21's two new draws, delivering
buildingBoxes 29 074   propBoxes 5 365   windows 19 076   crowns 135
vehicleBoxes 1 920   vehicleWheels 640   vehicleLightLines 480
aircraftBoxes 24   aircraftNavLights 30
stall_emissive 705   block_windows_off 798
```

**`moving:bodies` and `moving:lights` are present and populated**, which is the
half of brief item 3's third bullet that a count can answer. What a count cannot
answer is the ceiling: `drawCalls` 440 and `visibleInstances` 115 000 are
route-wide figures from a moving camera and this census is of one resident ring
with the stream incomplete. **Unmeasured here, and it is the first thing
`perfcheck` should print on the operator's machine.**

### 3.3 The saturation reserve, still unmeasured

STATE 20 recorded **1.53 points of margin**; the train's lit windows and the
crane's obstruction light are new emitters at zero cluster slots and nothing has
measured what they spent. `citycheck` reports `saturation` **UNRUN and red** on a
software rasteriser, which is correct — it is a pixel measurement and there is no
rasteriser here worth reading. Unchanged from session 21, and it needs the
operator's machine.

---

## 4. `parsecheck` WAS RED ON `main`, AND NOT FOR ANY SESSION'S CONTENT

STATE 21 §9 item 3 flagged that `index.html` gained an element after the gates
ran. The same thing happened to a second file and this one broke a gate:
`vite.config.js` arrived with the GitHub Pages commits (`d17db6b`, after session
21's gates) carrying an ellipsis character in a comment table —

```
 *   NOCTIS_BASE=…    whatever is given   a user page, a custom domain, a subpath
```

— and `parsecheck` rejects `…` as a probable elision. **That is the FIRST gate
in `npm run gates`, so the whole chain was red on `main` before any content was
touched.** Fixed in the prose (`NOCTIS_BASE set`), not in the rule.

Worth naming as a pattern rather than an incident: **both instances are files
edited after the gates ran, by work that was not content work.** Publishing,
tooling and CI changes do not feel like they need a gate run, and twice now they
have needed one.

---

## 5. THE STOP LINE — THE TIMESTEP IS EXCLUDED BY ARITHMETIC, NOT BY A RUN

`budget.json` → `trafficLights.minStopLineM` = 0, asserted against
`traffic.stats().worstStopLineM`. STATE 21 measured **−10.62 m** at dt = 0.1 s,
the top of CONTRACT §4.2's clamp, because the previous container could not finish
a 1/60 run. The brief asked for a re-measurement at 1/60 before any repair, on
the reasoning that *"a 0.1 s step moves a free-running vehicle 1.2 m, so part of
that overshoot is integration and the rest is the box."*

### 5.1 What ran, and what did not

```
--cycles=3 --dt=0.1 --static  (1 080 frames)  →  page.evaluate: Execution
                                                 context was destroyed
                                                 (session 21's own failure)
--cycles=1 --dt=0.1 --static  (  360 frames)  →  COMPLETED
```

**The defect reproduces on this machine.** One cycle at dt = 0.1: worst
clearance **−10.454 m**, 14 junctions queued, worst single queue 5 vehicles,
every one reaching zero, none trending upward, 15.4 of 160 held at a red on
average. Session 21's −10.62 m over three cycles and −10.454 m over one are the
same finding with a shorter window on a cumulative statistic.

**The 1/60 arm did not finish** — it is six times the frame count of a run that
already dies at three cycles. So item 4(a) was not closed by measurement.

### 5.2 IT DID NOT NEED TO BE. The overshoot bound is closed form

`traffic.js` clamps the speed to the signal's stopping profile **every step**, as
a hard `min` rather than a rate limit:

```js
limit = Math.min(limit, Math.sqrt(Math.max(0, 2 * BRAKE_A * Math.max(0, toStop))));
…
veh.v = Math.max(0, Math.min(limit, veh.v + a * dt));
```

So after any step, `v ≤ √(2·a·toStop)`. A vehicle whose clearance is `s > 0`
before a step advances by at most `dt·√(2as)`, leaving `s − dt·√(2as)`.
Minimising over `s`: `s* = a·dt²/2`, and the value there is **exactly
`−a·dt²/2`**. That is the worst the timestep can do, for every `s`, not for one:

```
BRAKE_A = 2.0 m/s²

  dt = 0.1      worst overshoot   0.010000 m
  dt = 1/30                       0.001111 m
  dt = 1/60                       0.000278 m
```

**At dt = 0.1 the braking constraint cannot overshoot its own stop line by more
than one centimetre. The measured breach is −10.62 m, which is 1 062× that: the
timestep can account for 0.094% of it.** The brief's 1.2 m is the displacement of
a *free-running* vehicle, and a vehicle under this constraint is by construction
not free-running — its speed is re-derived from its remaining clearance on every
step.

**A bound beats the run that was asked for**, because it holds at every dt and
for every vehicle rather than at one dt for one run. Item 4(c)'s escape hatch —
*"if the residual after the integration correction is small, say so and leave
it"* — does not apply. The residual is 10.61 m of 10.62.

### 5.3 And the repair the brief proposed is probably aimed at the wrong mechanism

This is a diagnosis, not a measurement, and it is flagged as such — but it
follows from the control flow and it changes what 4(b) should be.

`worstStopLineM` is recorded **only inside `if (veh.cleared !== nextJ)`** — a
vehicle without permission. And the braking constraint above is applied in the
same branch, so a vehicle without permission has its speed clamped to `√0 = 0`
the instant its clearance goes negative. **It cannot drive past its own line.**
There are exactly three writes to `veh.cleared` in the file:

```
2412  veh.cleared = nextJ   granted: green, or amber and cannot stop
2414  veh.cleared = null    revoked — but ONLY while toStop > brakeDist, i.e.
                            still short of the line. Permission is STICKY once
                            the vehicle is inside the box.
2013  veh.cleared = null    ON RECYCLE. "A recycled vehicle inherits a `cleared`
                            from wherever it used to be" — session 18's own fix.
```

So a counted vehicle at −10.62 m never braked into that position; it **appeared**
there. The geometric range says such positions exist for every body type:

```
toStop = (nextJ − along)·dir − STOP_LINE − len/2,   STOP_LINE = 7.5 + 1.5 = 9.0

  type      len   at the junction boundary
  wedge    5.40        −11.70 m
  pod      3.70        −10.85 m
  van      6.00        −12.00 m
  hauler   9.60        −13.80 m
  moto     2.20        −10.10 m      ← the only type that cannot reach −10.62
```

`toStop` is negative over the whole last 10.1–13.8 m of an approach, and jumps to
about +114 the moment the centre crosses the boundary and `nextJ` advances a
chunk. **−10.62 m is a real position inside that band, not an artefact** — and
`seed()` re-seeds relative to the camera, which is STATE 21 §9 item 14's carried
finding (*"a vehicle can materialise 14 m dead ahead in the camera's own lane"*)
pointing at the same 14 m.

**A reservation on the EXIT of the junction box would not fix that.** A re-seeded
vehicle never asked for the box. So:

- **NO REPAIR WAS IMPLEMENTED**, which is the brief's own instruction (*"do not
  implement it before (a) says how much of the −10.62 m is real"*) and is also
  the honest call for a traffic change that cannot be run on this machine. A
  repair that cannot be measured is worse than a measured defect, for the same
  reason a repair fitted to a timestep artefact is.
- **The measurement that decides it is one line**, and it is the next session's
  cheapest win: record `veh.recycled` (or frames-since-seed) alongside the
  vehicle that set `worstStopLineM`. If every offender is freshly seeded, the
  repair is in `seed()` — refuse a seat inside the negative-clearance band, or
  grant permission to a vehicle seeded inside a box it is already in — and item
  14 and this assertion are one defect. If offenders are NOT freshly seeded,
  there is a fourth path to `cleared !== nextJ` that this reading did not find,
  and the exit reservation is back on the table.
- **`minStopLineM` stays at 0 and stays red.** A signed clearance whose sign is
  the verdict has one defensible floor. It is not moved, and the honest state is
  *red with the mechanism narrowed*, not green.

---

## 6. WHAT THE NEXT SESSION STARTS FROM

1. **THE MACHINE, AND IT IS NOW THE THIRD SESSION ASKING.** §0. `budget.json` →
   `machine.series.m5` is an empty slot with the three steps that fill it.
   Nothing in this project has a millisecond measured after session 20.
2. **Decide whether `machine` gets an assertion.** §0. The field is inert, which
   is why two sessions had to remember not to fake it. The assertion is not free
   — it would refuse every run on any machine but the M4, including the
   operator's own M5 — so it is a decision rather than an omission.
3. **`floors.visibleInstances` and `drawCalls` on a real route.** §3.2. Counts,
   so they need no quiet machine, but they need a route perfcheck can finish.
4. **`faultcheck`, `lookcheck` and `citycheck`'s saturation.** §3. All three
   refuse for the right reason and all three need a GPU. `windcheck` no longer
   does — §3.1 — and its verdict is in this file: **678 meshes, 0 wound
   backwards.**
5. **`index.html`'s `#bootfail` still has not been through `lookcheck` or
   `gateaudit`.** Carried unchanged from STATE 21 §9 item 3: both refuse a
   software renderer, and both read that file.
6. **TAKE THE FRAME. §1.6 — the one part of brief item 2 that is open.**
   `node tools/lookat.mjs`, eye height, down a NORTH–SOUTH street, seed 1337.
   Before is `2c6de3b`, after is this branch. The numbers say the props turned;
   nothing in this file says the street looks better, and CONTRACT §10 step 4 is
   why that matters.
7. **A bench's BACK faces nowhere in particular.** §1.2. `band.side` is known at
   the placement and is not read in the yaw, so 90° and −90° are chosen
   arbitrarily and a bench can face away from the road. No measurement behind it
   yet; it is a content decision — and §1.6's frame is what would show it.
8. **STATE 21's off-axis fraction of 0.665 does not reproduce.** §1.4. The gate
   prints 0.739 on three runs. Harmless direction, wrong number in the file.
9. **Item 8, vehicle light signatures — NOT STARTED.** Carried from session 20.
10. **Item 14, vehicle pop-in — NOT STARTED, diagnosis carried.** `seed()` takes
   the maximum `ahead` over twelve candidates, so a vehicle can materialise 14 m
   dead ahead in the camera's own lane.
11. **`player`'s ceiling, at the quiet bar.** STATE 20 §5.3, unchanged.
12. **The retroreflective BRDF for the markings.** STATE 21 §5.2 has the
   arithmetic: 24× at the standard entrance angle.
13. **The merged branch `claude/generator-occupancy-registry-6pbuer` still
   exists on the remote.** It IS fully merged — `git diff
   origin/main...<branch>` is **0 bytes** and its tip `fa60b64` is an ancestor of
   `origin/main` via the merge `1bcd585` — but `git push --delete` returns
   **HTTP 403** through this environment's proxy and the GitHub MCP surface has
   no delete-branch tool. It needs one click in the web UI. (My first check used
   a stale local `main` at `ca0169f` and looked non-empty; against `origin/main`
   it is empty.)

---

## 7. KNOWN GAPS CARRIED FORWARD

**Unchanged from s8–s21**: `stats().cutoffM` hard-codes 0.8, the headroom probe
inert, GPU timer queries advertised and never retiring, `saturation-peak.png`
overwritten every run, `$fovYDrift`, `camera.setRouteAt(name, 1.0)` at the sky,
rain streaks near-invisible wide at night, `rain_spray` 0 static, right turns
only, sun shadows to ~170 m, the bake blind to elevated slabs, the PMREM hitch,
the too-red dawn horizon, one worker at queue depth one, the far half of the
river handing back to the night sky past ~300 m, grime authored, the near-field
washboard on the water, the quay wall inside the walkable mask, **props absent
from the walkability mask**, the 3.5°–10.4° route camera pitch, the
frozen/running A/B, and `downtown_dense`'s mean luminance under its floor.

**Resolved this session**: the kerbside yaw transposition, and with it the 60
delivered-census overlaps STATE 21 handed over; the canopy head clearance
authored in model space; `parsecheck` red on `main`; `windcheck` producing no
verdict at all on a machine without a GPU.

**New this session, both in CONTRACT §9's table**: a lattice band's fixed axis
read as the axis the band runs along; a model-space head clearance read as a
delivered one. Plus one §9.1 instance recorded in `budget.json` itself — the
`machine` field that nothing reads.
