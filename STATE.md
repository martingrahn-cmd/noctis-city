# NOCTIS — STATE

*End of session 21. **The seven §9.1 violations were one missing structure, and
it is built: one keep-out registry, twelve categories, forty-seven forbidden
pairs, written and read by every generator and asserted over the delivered scene
by `citycheck`. Over the gate's own 10 × 10 region it took the forbidden
overlaps from 200 to 0.** The dome across 2 906 m² of carriageway, the 8 of 23
viaduct piers standing in running lanes, the 38 overlapping building pairs and
the 52 props on carriageways are all instances of it, and all of them are now
impossible rather than fixed. The viaduct stands on portal frames, terminates on
abutments and carries two trains; parks have paths, clumped planting, low
lighting, an edge and a centre; construction sites are a block type with a
slewing crane and downward flood masts.*

*And the carried diagnosis was wrong: the deck does **not** end inside a
building. It ends in mid-air at (−91.0, −204.2) and (−91.0, +226.2), 21.0 and
23.5 m clear of the nearest wall. STATE 19 and 20 both recorded `l.z ±
arcLength/2` — an **arc length used as a straight-line extent** — and neither
opened it. §9's table, row 4 with a different pair of quantities.*

Read `CONTRACT.md` before this file, and before any source file.

---

## 0. The honesty line, first, and this session it is about the MACHINE

**THIS SESSION DID NOT RUN ON THE OPERATOR'S COMPUTER. It ran in a Linux
container with no GPU, on a SwiftShader software rasteriser, and four of the
eight gates refuse to produce a verdict on one — by their own rule, which is the
right rule.**

```
✓ parsecheck              78 files — CONTRACT §9's table now declares 62 rows
✓ citycheck --falsify     56/56 cases, 56 failure sites, coverage 100%
✓ perfcheck --falsify     74/74 cases, 72 failure sites, coverage 100%
✗ faultcheck              REFUSED: software renderer
✗ lookcheck               REFUSED: software renderer
✗ windcheck               REFUSED: software renderer
✗ inputcheck              5 failures, NONE of them content this session touched
✗ citycheck               3 red of 24 — one is the machine, one is UNRUN, one is
                          a real residual. See below.
—  perfcheck              NOT RUN IN FULL. Four routes x three runs is ~50 000
                          SwiftShader frames; two attempts at a 4 320-frame
                          probe lost the renderer's execution context. Only the
                          self-test ran.
```

**`citycheck`'s three, in full:**

```
✗ sceneWalk    the city had not finished arriving — 13 of 25 field bakes in
               30.0 s. THE MACHINE: a canyon bake takes 0.8–1.4 s here against
               0.1–0.3 s on the operator's. Not a content finding.
✗ saturation   UNRUN — needs a hardware rasteriser. See §7.1.
✗ occupancy    60 forbidden overlaps in the DELIVERED scene, all of one kind:
               a kerbside BENCH overlapping its own carriageway by 0.048 to
               0.235 m². The GENERATOR's registry is clean (0 of 5 349 claims),
               so the delivered bench reaches further than the claimed one —
               which is EXACTLY the disagreement the two-sided check exists to
               find, and it is the next session's first thread. §9 item 1.
```

**`inputcheck`'s five are the container, and the claim is checkable.** This
session did not touch `player.js`, the input layer or any constant either reads
— `git diff` says so. Two of the five name themselves: *"clicking the canvas did
not acquire pointer lock"* (headless Chromium does not grant it) and *"a full
look stick delivered 120.00°/s against 180.00"* (a RATE per wall-clock second,
measured on a machine rendering a few frames a second). Both are the instrument
reading the container.

**No gate was green here that would be red on a real machine, and none was made
easier.** The one gate whose SHAPE changed — `citycheck`'s software refusal —
still exits 1 on this machine; see §7.1.

**What is evidence in this container and what is not.** CONTRACT §9 rule 6's
corollary — *counts do not drift* — is what makes this session's work
measurable at all. Draw calls, triangles, instance counts, froxel occupancy,
instance matrices, placement coordinates and conflict counts are integers or
CPU-side floats and are identical on any rasteriser. Milliseconds and pixels are
not: SwiftShader is 20 to 50× slower than a GPU and its shading is a different
implementation. **So every number in this file is a count, a coordinate or a
piece of arithmetic. There is not one millisecond in it, and there is not one
luminance.**

**Part six of the brief — the MacBook Air M5 — could not be done here and was
not faked.** `tools/quiet-gates.sh --measure-floor` measures the machine it runs
on; running it in this container would derive a quiet bar for a Linux VM and
write it into `budget.json`'s `machine` field as though it were an M5's, which
is CONTRACT §9's failure mode with a whole computer. **`budget.json` is
untouched on that point and the M4 series stands.** What the next session on the
new machine must do, unchanged from the brief:

1. `tools/quiet-gates.sh --measure-floor 10`, with the app closed, and cite the log.
2. All four routes, three runs each, interleaved.
3. Record the machine in `budget.json` → `machine` with **both** series kept.

Until that happens, comparing a number measured on an M5 to a ceiling derived on
an M4 is §9's shape with a computer instead of a length.

**Nothing was weakened to pass.** No floor lowered, no ceiling raised, no
assertion deleted. Six thresholds were **added** (`occupancy.*`,
`trafficLights.minStopLineM`). Two INSTRUMENT corrections moved readings in the
lenient direction and both are argued in full with their negative direction
guarded — §5.4 and §7.1 below — which is the arrangement CONTRACT §7.3.1
requires and the one thing in this file that most deserves a sceptical reading.

---

## 1. The keep-out registry — `src/lib/occupancy.js`

`src/lib/occupancy.js`; `src/lib/citygen.js` throughout; `city.js` →
`placedClaims()`; `harness.occupancyCensus()`; `citycheck` → `occupancy`;
`city-budget.json` → `occupancy`.

**Seven instances is not seven bugs.** Piers inside buildings (s5), props inside
buildings (s4b, 146 of 838), 208 of 208 signs inside their own building (s14),
overlapping quayside frontages (s15), 40 buildings in the river (s15), a deck
terminating nowhere (s19), and a dome across a carriageway (s21). Each repair
added one more private test to one more placement loop, and every new generator
had to remember all four and invent the fifth.

**What it is.** A list of axis-aligned claims, each carrying a category, a
footprint and a **vertical extent**, plus a table of which categories may not
overlap which. 12 categories, 47 forbidden pairs, symmetrised at load so the two
halves of a pair cannot disagree.

**The vertical extent is the part that could not have been left out.** Session 5
wrote the distinction down — *"`landmarkOccluders` answers what blocks a ray to
the sky; the flood fill was asking what blocks a person"* — and built it as two
functions, which is how you get a third question with no answer. A viaduct leg
is `landmark` from 0 to 21 m; the deck it holds up is `deck` from 14.20 to 21 m;
a carriageway conflicts with the first and not the second. That is what an
elevated railway over a street IS, and one list answers all three questions.

**Delivered, over `city-budget.json`'s own 10 × 10 region at seed 1337:**

```
claims 5 349    block 100  carriageway 436  pavement 599  building 367
                prop 1596  landmark 424  site 518  feature 286  path 19
                water 652  deck 352
forbidden overlaps                                                    0
```

### 1.1 It was RED first, and it found real defects on every run

CONTRACT §7.1 requires a gate confirmed red against the content before it is
trusted. This one was red four times, and each time the defect was real:

```
run 1   200 conflicts   197 park railings standing on the pavement,
                        3 park paths laid across a pond
run 2    40             props claimed as squares when they are laid along a kerb
                        (7 benches and planters "in" a road they are 0.4 m clear of)
run 3    18             two chunk rows furnishing one promenade — a bin inside a
                        planter, a cabinet inside a tree — plus 6 road pieces
                        inside landmarks the chunk could not see
run 4     0
```

The last of those is the one worth reading twice: `landmarksTouching` pads by
4 m and a chunk's road strips reach `CORRIDOR` = 11.7 m past its own edges, so a
landmark 8 m outside a chunk was invisible to the list that decides what its
roads are clipped around. **One list answering two questions, for the fourth
time in that file.**

### 1.2 Roads clip to what is claimed, and the road network moved into the generator

`buildGround` computed its own six corridor strips and clipped them against the
two things it knew by name. Measured over the eight landmarks before this
session:

```
exchange  2 906 m²  of carriageway inside the dome  ← the operator's find
condenser 2 113 m²        dish 1 201 m²
stack       384 m²        arch    300 m²        viaduct 135 m²
```

The rectangles are now computed in `citygen.js` beside the registry they are
clipped against, and `city.js` emits what it is handed. One description of the
road network instead of two. `chunk.ground` also carries the park's grass and
paths and the site's hardcore, so every surface in the streamed city goes
through one clip.

**All four edges are CLAIMED and two are EMITTED.** A chunk owns the roads on
its west and north sides — that is session 4's arrangement and it is why no road
is built twice — and it is also why the quayside terrace, the one walk that runs
the full width of a chunk, could not see the road on its own east or south edge:
two quayside buildings stood in a carriageway and one across a pavement, 36 to
44 m² each.

### 1.3 The gate's half reads the DELIVERED scene

`harness.occupancyCensus()` returns what `city.js` **emitted**, recorded at the
point of emission: the ground rectangles that ARE the mesh, each prop's world
extent off its own delivered instance matrices, each feature's, each building's
envelope, each landmark's ground solid. `citycheck` runs the same conflict table
over it.

**Not the generator's registry, and the difference is the whole point.** That
structure says what was TESTED; this says what ARRIVED, and twice they have
differed: 208 signs decided on a wall and drawn nine metres inside it, road
patches decided 10 mm thick and drawn a metre tall.

**IT IS DISAGREEING RIGHT NOW, AND THAT IS THE STATE THIS SESSION HANDS OVER.**
The generator's registry reports **0 forbidden overlaps among 5 349 claims**; the
delivered census reports **60**, every one a kerbside bench overlapping its own
carriageway by **0.048 to 0.235 m²**. The claim the generator tests is the
rotated box's extent — `across·cos θ + along·sin θ` at `CITY.maxYawDeg`, which
for a 1.74 m bench is 0.036 m and leaves its inner face 0.31 m clear of the kerb
— so something in the path from that claim to the emitted matrices adds a tenth
of a metre. **That is a real finding and it is not repaired.** Two rounds of
this check have already been closed by fixing the instrument (the canopy band,
the square claim), so the next round is owed a look at the GEOMETRY before the
instrument: print the offending bench's claimed box beside its delivered one,
which is §9 rule 2 and is four lines.

**It found a defect in itself on the first run — 60 of them.** Every one was a
street tree "conflicting" with the carriageway beside it, and every one was a
canopy at 3.4–5.8 m over a road surface at 0.05 m. A tree overhanging a
carriageway is what a street tree is; the conflict was the instrument
collapsing a three-dimensional object into a footprint. The claim is now two
bands per prop split at **`HEAD_CLEAR_M` = 2.10 m**, which is the generator's own
number for the same distinction.

---

## 2. The viaduct — portal frames, abutments and two trains

`citygen.js` → `LANDMARKS.viaduct`, `viaductPiers`, `legAt`, `viaductLegs`;
`city.js` → the `viaduct` case; `src/modules/moving.js`.

### 2.1 The piers, measured before and after

```
                        before          after
piers                       23              23   (21 portals, 2 hammerheads)
legs in a carriageway         8 of 23        0 of 44
legs on a pavement            2               17   (against the kerb, by design)
piers nudged along the deck   —                6   (max 6.0 m)
piers with no solution        —                0
spacing                  21.8 m       15.8–27.8 m, mean 21.81 (asked 22)
max |x| inside the block  12.18 m         10.40 m  (band 10.50)
```

**Session 5's argument was correct about the wrong axis.** It re-aimed the arc so
its piers would stand on ground you can see and reasoned entirely about the
origin block's east–west street; nothing asked what the arc does to the streamed
lattice, and a 1.7 m column on a road centreline is a column on a road
centreline whichever street it crosses.

**A column cannot be made to fit a 15.0 m carriageway, so the support straddles
it.** Leg centre = `roadHalfWidth + pierLegHalf` = 7.5 + 0.8 = **8.3 m**: the
inner face lands exactly on the kerb line, the outer at 9.10 m, clear of the
pedestrian lane centre (9.60) by 0.50 m, of the block's clear cross-street band
(10.50) by 1.40 m and of the building line (11.70) by 2.60 m.

**Two free parameters, searched nearest-first, and the second is why the first
was not enough.** Nudging the station alone cleared 3 of 8 and left 9 blocked,
because for 140 m either side of the crown the deck runs INSIDE the x = 0
corridor rather than across it. What varies down that stretch is the deck's own
drift off the road centreline — x runs 0.00 → −0.79 → −3.17 over three bays — so
a portal centred on the DECK is up to 3.2 m off centre on the ROAD. Each leg
therefore gets its own offset in [5.0, 10.9] m.

**Two stations have no portal solution at any offset or nudge and get a
hammerhead** — one leg on the clear side with the deck cantilevered to it, which
is what is built wherever a road cannot be straddled. Tried last rather than as
an equal option.

### 2.2 The deck ends in mid-air, and the carried diagnosis was arithmetic

STATE 19 and 20 both recorded *"deck ending inside buildings at z ≈ −229 and
+251"*. Those are `l.z ± arcLength/2` = 11 ± 240 — **a straight-line extent in z
computed from an arc length**. Measured against the curve the ends are at
**(−91.0, −204.2)** and **(−91.0, +226.2)**, and the nearest building to either
is **21.0 m and 23.5 m away**. Nothing had to be moved out of the way; what was
missing was a thing to terminate on. Each end now carries an abutment: a portal
wall to the soffit, two splayed wing walls, and the parapets returning onto it.

### 2.3 The deck carries traffic, and the traffic is a train

`city.js` has laid two ballast troughs, four rails at 1.435 m gauge and catenary
masts on that deck since session 19. **Road vehicles on a railway deck would be
a category error**, so what it carries is two four-car trains at 12 m/s — the
same free-flow speed the cars under it run at — with six lit windows a side per
car and a headlamp on the leading car. That is the brief's "movement above eye
level" and "light sweeping facades from underneath", delivered by the thing that
belongs on the structure.

`src/modules/moving.js`, **2 draw calls and one instance-motion pair for BOTH
the trains and the cranes**, because they are one piece of engineering: rigid
boxes on a scripted path, above eye level, both needing §5.12's previous
transform. Split into two modules they would have cost four draws against a
ceiling `highway_speed` sits 9 under. `?moving=0`.

§5.12's cutoffs, printed at init: **car 2.9 m → 1 119 m, jib 1.6 m → 618 m,
hook 1.1 m → 425 m** at the gate's own pixel angle.

---

## 3. Parks — the six things a park has

`citygen.js` → `PARK`, the `kind === 'park'` branch; `city.js` → the
`chunk.features` loop.

`park` has been in `LOW_DETAIL_KINDS` since session 4 and session 19 gave it
grass and two crossing strips. What it read as from the pavement was a green
rectangle with a cross on it, which is a pitch rather than a place.

- **Paths, as a network.** A perimeter loop inset 7.0 m, two cross paths from the
  pavement into a central circus, and the circus itself. The cross paths STOP at
  the circus rather than running through it — running them through put every one
  of them straight over the pond, which the registry reported the moment it could
  see them.
- **Trees in clumps.** 4 clump centres per park, Gaussian scatter at 9.0 m. Within-clump
  spacing about 6 m against a between-clump spacing about 40 m — a factor of 7,
  which is `docs/authored-city.md` §1's clumping rule applied to the population
  it reads most obviously on.
- **Benches along the paths, bins at the junctions**, jittered ALONG the path and
  never across it, and standing BESIDE it: `prop × path` is a forbidden pair
  where `prop × pavement` is not, because a 4.2 m pavement has a furniture strip
  by construction and a 2.8 m path does not.
- **Park lighting.** `LIGHT.parkLampCandela` = **870 cd** at a **4.20 m** mounting
  height, derived through the batwing's own relation for a target of
  `streetAverageLux / 2` = 8 lx: `I = E·h²/cos³57° = 8 × 17.64 / 0.1614 = 874`.
  **0.128× a street lamp's peak delivering 0.50× its illuminance**, because the
  pool is four times closer to the ground. Columns every 16 m — half the
  street's 32 — following the loop rather than a kerb, which gives the night
  something it has never had: light that is not in a straight line down a
  street. They join the EXISTING lamp pool rather than a second one.
- **An edge**, one of railing / hedge / low wall per park, in 2.4 m segments with
  a 9 m gap at every entrance, set in by its own half-thickness — a railing whose
  centreline is the island edge is a railing half of which is on the pavement,
  and the registry said so 197 times.
- **A centre**: pond, pavilion, monument or square. This is the part that makes a
  park an orientation feature rather than a green patch.

Delivered over the region: 2 park chunks, 248 edge segments, 37 lamps, 1 centre
(the second park's centre stands where the river's claim is and was refused,
which is the registry working).

---

## 4. Construction sites — a block type with a working crane

`citygen.js` → `SITE`, the `kind === 'construction'` branch; `city.js`;
`moving.js`.

`LOW_DETAIL_KINDS` gains a fifth entry. Delivered: **3 construction chunks over
the region**, 495 hoarding panels, 3 part-built frames, 3 cranes, 9 flood masts,
8 spoil heaps. Low-detail is 17 of 100 chunks, unchanged, against the addendum's
8% floor.

- **Vertical asymmetry.** A tower crane 42–78 m tall with a 38–62 m jib and a
  counter-jib at 0.32 of it. The mast never out-tops the skyline it stands in —
  78 m is under the generator's own p99 of 134 — because what reads is the
  CONTRAST between a line and a mass.
- **Motion above eye level.** The jib slews at 1.5°/s (240 s a revolution) and the
  hook rises and falls on a 46 s raised cosine through the whole height of the
  building it is building — 1.7 m/s over 40 m. Two periods that do not divide
  each other, each with its own phase, so two cranes on screen are never in step
  and the motion never reads as a loop.
- **Work lighting.** `LIGHT.siteFloodCandela` = **45 000 cd** at 9.0 m aimed into
  the excavation: `I = E·d²` for 50 lx (HSG38 general construction area, 3.1×
  `streetAverageLux`) at the 27.5 m slant range in the middle of the band.
  **6.6× a street lamp's peak from a mast 0.53× the height**, which is why it
  reads as a different KIND of light rather than as a brighter one. It does NOT
  follow the photocell: a site is lit by whether anybody is working.

---

## 5. Trees, markings, and the two instrument corrections

### 5.1 Trees that are not one box

Four species now, each a trunk plus **three to five overlapping canopy masses at
different heights, none of them square to the others**. `bxt()` adds a per-box
tilt about a bearing in the model's own frame, so a canopy mass keeps its angle
when the whole tree is yawed or leaned — which is what makes a leaning tree read
as one object rather than as a tilted slab on an upright pole.

The broad species tops out at 4.10 / 4.86 / 5.34 m across its three masses — a
**1.24 m spread over a 5.3 m tree, 23% of its own height**. That is the roofline
argument (CONTRACT §7.4) at pavement level: one height along a contour reads as a
shape, several read as a tree.

A **fourth species is small and multi-stemmed**, 3.6 m — under the others'
TRUNKS — because every tree in the city was 5 to 7 m and a park with only mature
specimens is an arboretum.

### 5.2 Road markings, painted from the number the traffic brakes against

`CITY.stopLineFromJunctionM` has said since session 19 that it has three readers
and the third — the markings — did not exist. **13 593 markings over the region**
(centre lines 2 m in a 6 m cycle, lane lines 3 m in 9, solid edge lines, 0.40 m
stop bars, six-stripe crossings), each a 4 mm box at reflectance 0.62 against the
carriageway's 0.082 — **7.6×**.

**They clip to the DELIVERED carriageway**, so a road the river, the block or a
dome took away has no lines painted over where it used to be.

**What is not modelled, stated rather than faked.** A real marking is
retroreflective; a class R2 line gives RL = 100 mcd/(m²·lx) at the standard
88.76° entrance angle, and this diffuse surface delivers `E·cos(88.76°)·0.62/π`
= **4.1 mcd/(m²·lx)**, i.e. **24× less**. At ten metres, where the entrance angle
is 79°, the diffuse term is 23 mcd/(m²·lx) and the gap is 4.3×. This project has
no retroreflective BRDF and adding one is a shader change with no gate behind it,
so the gap is written down with its arithmetic instead.

### 5.3 The per-variant pad, which nearly deleted every street tree

`propHalfAcross` was the MAXIMUM over a kind's variants. The new small tree's low
crown is genuinely 1.64 m across at head height, which took the KIND's pad from
0.35 to 1.64 m — and `fitsKerb` is `7.85 + 2·across ≤ 9.15`. **Every street tree
in the city would have been refused the pavement because one park species does
not fit it.** Pads are per-variant now: tree across = [0.363, 0.250, 0.442,
1.233], so three species keep the kerb and the fourth is a park tree.

### 5.4 The alignment datum — an instrument correction, argued

**This is the reading in this session that most deserves scepticism, so here is
all of it.** `citycheck`'s alignment check measured a prop's yaw against the
nearest right angle and used it as *how far off its own alignment is this
object*. Those are the same quantity on a lattice and a different one on a
CURVE: the river's promenade runs at up to **11.46°** to the grid where the
meander is steepest, so a bollard perfectly lined up with its own quay read as
11.46° of deviation against a 3° bound. `river.js` derives the quay wall from the
same tangent and nothing complains, because a wall is not in the list.

It was **inert until this session** and §5.3 is what woke it: the per-variant pad
let narrow props onto the promenade, and the measured maximum went **2.27° →
11.46°** with no change to any yaw expression.

- The threshold does **not** move: `maxDeviationDeg` is 3 before and after.
- `refDeg` is **0** for every building, every sign and every prop not on a kerb,
  so for those populations the reading is unchanged bit for bit.
- The negative direction still holds: a prop misaligned with its OWN kerb by more
  than 3° still fails, which `alignment.maxDeviation` falsifies.
- Delivered after the correction: max deviation **2.27°** (a building), off-axis
  fraction **0.665** against a 0.60 floor.

CONTRACT §7.3.1's precedent is exactly this shape and its guard is the one
applied here.

---

## 6. The traffic queue, measured

`tools/queueprobe.mjs` — NOT A GATE — and `traffic.stats().queueByJunction`.

The operator's aerial frame *"looks permanent rather than like a signal cycle"*,
which is a statement about a SERIES made from one sample. Two worlds produce that
frame and no amount of looking at it distinguishes them: **congestion by design**
(the queue builds through the red and empties on the green, and the question is
the density) or **deadlock** (a vehicle stopped past its own line blocks the box
it has entered, and the question is the mechanism).

**Measured** (`tools/queueprobe.mjs --cycles=3 --dt=0.1 --static`,
`tools/perf-out/queueprobe-downtown_dense.log`), 108 simulated seconds, 15
junctions in the census:

```
  junction     peak  trough  zeroed   peaks by cycle
  1:0:0           5       0     yes   5 5 5
  1:1:-128        5       0     yes   5 2 0
  1:1:0           5       0     yes   5 1 0
  0:0:0           5       0     yes   5 3 2
  1:0:-128        4       0     yes   4 3 2
  …
  15 junctions queued, worst single queue 5 vehicles
  0 junctions NEVER reached zero        0 junctions trending upward
  held at a red, mean over the window 9.6 of 160 vehicles
```

**IT IS CONGESTION, NOT DEADLOCK.** Every queue emptied inside the window, no
junction trended upward, and most peaks DECLINE across the three cycles (5 → 2 →
0) as the network settles out of its seeded state. The worst queue anywhere is
**5 vehicles**, against session 18's single-junction trace peaking at 29. So the
aerial frame is a signal cycle caught at its worst moment, and the open question
is the density rather than the mechanism.

**AND THE NEW ASSERTION IS RED ON ITS FIRST MEASUREMENT: worst stop-line
clearance −10.62 m.** A vehicle's nose stood 10.6 m past its own painted bar.
That is not session 19's defect returning — that one was a missing front
overhang and is repaired — it is the OTHER half of the brief's own suspicion:
**vehicles queue INTO the junction box.** Car-following stops a vehicle behind
the one in front wherever that happens to be, and nothing stops it entering a
box whose exit is blocked. The mechanism the brief named exists; the consequence
it predicted — a network that never clears — does not, at 160 vehicles.

**Two caveats on that number and both are the next session's to close.** It was
measured at **dt = 0.1 s**, the top of CONTRACT §4.2's clamp, because 1/60 is
12 960 rendered frames of SwiftShader and this container could not finish one
(two attempts lost the renderer's execution context after ~40 minutes). A
0.1 s step moves a free-running vehicle 1.2 m, so some of the overshoot is
integration and the rest is the box. Re-measure at 1/60 on a real machine before
deciding which, then decide whether the repair is a reservation on the EXIT of
the box rather than on the box itself.



**And the free gate is finally written.** `budget.json` →
`trafficLights.minStopLineM` = **0**, asserted against
`traffic.stats().worstStopLineM` — the signed clearance from a HELD vehicle's
front to its own painted bar. Session 19 built the instrument and measured the
defect (hauler −3.30 m, fleet mean −1.07 m); STATE 20 §7 carried the assertion as
"five minutes" for two sessions. Both directions are falsified: a nose past the
line fails, and `Infinity` — nobody held at a red anywhere on the route — fails as
UNRUN rather than passing.

---

## 7. Two gates changed shape, and neither got easier

### 7.1 `citycheck`'s software refusal is scoped to the measurement it invalidates

It threw before anything was gathered, so a machine without a GPU produced no
verdict on the clumping, the scene walk, the landmarks, the river, the
walkability or the new occupancy check — **none of which reads a pixel**. The
refusal now lives at the saturation assertion, which reports **UNRUN and fails**.
The gate still exits 1 on a software renderer; what changed is that twenty-odd
assertions report first. CONTRACT §10: a gate that cannot run is not a green
gate — and this makes strictly more of it run.

### 7.2 The three level assertions are pooled, and it cannot be a loosening

CONTRACT §0.1 says of its own correction: *"It applies to every measurement in
this project and not only to this gate."* `meanLuminance` and `screenshotEntropy`
were read off the LAST run's frame while every millisecond beside them was
already a median of three. STATE 20 §7 measured what that cost: `downtown_dense`
decided against a per-run range of **0.0193** with a margin of **0.0063** — 33%
of the instrument's own noise floor.

The estimator is the **median of the per-run values**, the same one
`capture.$estimator` names for the timings, and the spread is printed beside it.
Session 20's own triple was [0.0760, 0.0567, 0.0737] and its median is 0.0737 —
identical to the last-run value the gate used, so the gate is red before and
after. **No threshold moved.**

**The falsifying cases now perturb every run**, exactly as `ceiling.cpuP95` does.
A case that darkened one frame of three would be outvoted 2:1 and would report
the assertion as unfalsifiable, which is §7.1's quiet gate arriving by way of an
estimator change. STATE 20 §7 named this requirement in advance.

`citycheck --falsify`: **56/56, coverage 100%**. `perfcheck --falsify`:
**74/74, coverage 100%**.

---

## 8. What the content cost, stated plainly

**367 buildings over the gate's region against 432.** Every one of the 65 was
refused by the registry and every refusal was a real violation:

```
refused by    landmark 55   building 47   water 16   block 14
              pavement 6    carriageway 5   deck 4
```

Two of those need reading:

- **`building × building` 47.** The four island frontages have overlapped at
  their corners since session 4 — 38 pairs over the region with a worst overlap
  of **504.8 m²** — and session 20 found a roof sign standing inside the building
  next door because of it. STATE 20 §7 item 9 carried it. It is closed.
- **`landmark` 55, and the setback got SMALLER and STRICTER.** The old test was
  `landmarkBlocks(l, centre, 10)`, which guarantees `10 − halfDepth` of clear
  ground = **−3.0 to +2.5 m** over the generator's depth range: negative over
  most of it, i.e. buildings inside landmarks with their centres politely
  outside. Face-to-face at `CITY.sidewalkWidth` = 4.2 m rejects at a centre
  distance of **11.7 to 17.2 m** against the old 10.0 — stricter at every depth
  the generator can draw.

**What went back in.** 13 593 markings, 495 hoardings, 248 park edges, 37 park
lamps, 3 cranes, 9 flood masts, 8 spoil heaps, 44 portal legs, 2 abutments,
2 trains × 4 cars, and one to three extra canopy masses on every tree in the
city. `floors.visibleInstances` is the number that decides whether that is
enough and it is a COUNT, so it is measurable here — see §9.

---

## 9. What the next session starts from

1. **THE 60 BENCHES.** `citycheck` → `occupancy` is red on the DELIVERED scene
   and clean on the generator's registry, which is the two-sided check doing its
   job. Print the claimed box beside the delivered one for one offending bench
   (§9 rule 2, four lines) before touching either. Do NOT relax the pair: two
   rounds of this check were closed by correcting the instrument and the third
   is owed a look at the geometry.
2. **THE MACHINE, AND BEFORE ANY CONTENT NUMBER.** §0. Quiet bar,
   four routes, `budget.json` → `machine` with both series. Nothing in this file
   is a millisecond and nothing in it is a pixel, so the M4 series is still the
   only performance evidence this project has.
3. **`index.html` GAINED AN ELEMENT AFTER THE GATES WERE RUN.** Publishing to
   GitHub Pages (after this session's content work, same day) added a
   `#bootfail` paragraph and an `onerror` on the entry script, so that serving
   the repository's ROOT — which shows a black canvas and nothing else — says
   what is wrong. It is inert on the success path and that was checked rather
   than assumed: against the dev server the app boots, `#bootfail` is `hidden`
   with a 0x0 box, 238 draws, zero quarantined modules. But `lookcheck` and
   `gateaudit` read that file and NEITHER HAS RUN AGAINST IT, because both
   refuse a software renderer. It is the first thing to re-run on a real GPU,
   before the four below.

4. **Run the four refusing gates on a real GPU.** `faultcheck`, `lookcheck`,
   `windcheck` and `citycheck`'s saturation sample have not run against this
   session's geometry. Everything new is boxes in existing meshes on existing
   materials, so `windcheck` is the one most likely to have something to say —
   the park's pond surface, the abutment wing walls and the tilted canopy masses
   are all new emissions.
5. **`floors.visibleInstances` and `drawCalls` against the delivered city.**
   Two draw calls were added (`moving:bodies`, `moving:lights`) against
   `highway_speed`'s 431 of 440. Both are counts and both are measurable
   anywhere; §8 is the reason to look.
6. **The saturation reserve has a new emitter in it.** The train's lit windows
   and the crane's obstruction light are emissive geometry at zero cluster
   slots. STATE 20 recorded 1.53 points of margin left; nothing here measured
   what these spent, because the measurement needs a rasteriser.
7. **Item 8, vehicle light signatures — NOT STARTED.** Carried from session 20.
8. **Item 14, vehicle pop-in — NOT STARTED, diagnosis carried.** `seed()` takes
   the maximum `ahead` over twelve candidates, so a vehicle can materialise 14 m
   dead ahead in the camera's own lane.
9. **`player`'s ceiling, at the quiet bar.** STATE 20 §5.3, unchanged: the
   instrument is built and both arms are one command.
10. **The retroreflective BRDF for the markings.** §5.2 has the arithmetic for
   what is missing: 24× at the standard entrance angle.

---

## 10. Known gaps carried forward

**Unchanged from s8–s20**: `stats().cutoffM` hard-codes 0.8, the headroom probe
inert, GPU timer queries advertised and never retiring, `saturation-peak.png`
overwritten every run, `$fovYDrift`, `camera.setRouteAt(name, 1.0)` at the sky,
rain streaks near-invisible wide at night, `rain_spray` 0 static, right turns
only, sun shadows to ~170 m, the bake blind to elevated slabs, the PMREM hitch,
the too-red dawn horizon, one worker at queue depth one, the far half of the
river handing back to the night sky past ~300 m, grime authored, the near-field
washboard on the water, the quay wall inside the walkable mask, **props absent
from the walkability mask**, the 3.5°–10.4° route camera pitch, the frozen/running
A/B, and `downtown_dense`'s mean luminance under its floor.

**Resolved this session**: the seven §9.1 placement violations, as a structure
rather than seven repairs (with ONE residual still red — §9 item 1); the four island frontages overlapping at their corners;
viaduct piers in the carriageway; the deck terminating on nothing; the deck
carrying nothing; parks as a green rectangle; trees as boxes; roads with no
markings; the stop-line assertion carried since session 19; the three level
assertions as a sample of one; `citycheck` producing no verdict at all on a
machine without a GPU.

**New this session, all recorded in CONTRACT §9's table**: an arc length used as
a straight-line extent in a DIAGNOSIS that two sessions carried; a pad that is
the maximum over a category's members applied to one member; a yaw measured from
the world grid used as a deviation from the axis an object is aligned to; a
three-dimensional prop collapsed to a footprint and tested against a vertical
extent; the bounding box of a rotated box computed as though it were unrotated;
a margin correct for one building walk applied to another; a 10 m pad on a
building's centre standing in for 10 m of clear ground; session 5's clear-band
sentence, in prose, that nothing checked; two samplings of one river bank; and
one promenade furnished by two chunk rows that could not see each other.
