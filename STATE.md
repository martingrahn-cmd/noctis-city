# NOCTIS — STATE

*End of session 32. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB, AC power**, `node v22.22.0`. Every gate
that reads a pixel printed `ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`. The brief said
this session runs on the M4 Mac mini and not the MacBook, and for the second session running
the machine is the premise that held.*

***`load1` WAS 1.78 AT THE FIRST COMMAND AND FELL ON ITS OWN, exactly as the brief said it
would: the screen-sharing that drove it had already been switched off. It read **1.52** and
**1.48** immediately before the two `perfcheck` runs quoted below — **under CONTRACT §0.2's
bar of 1.6**, which is the first time this project has quoted a millisecond from inside its
own bar with the agent still running. They are recorded as admissible and flagged: the
Claude app was open, and `memory/noctis-quiet-bar.md` says that is worth 22–36% of a core.
Every count below — draw calls, triangles, instances, buildings, chunks, emitting area — is
admissible at any load and was measured on this machine today.*

---

## 0. THE FRAMES, IN ORDER, AND WHAT EACH ONE IS FOR

**This table is the session's report.** LOOK.md §8 asks a session to name the section it
serves; the gate table is in §7 and it is not the verdict.

| # | frame | LOOK.md | did the city move toward it |
|---|---|---|---|
| 1 | `shot-out/s32-i1-street-t0.png` → `…-t0-wet.png` | **§6, §3, §1** | **YES, and it is the largest single change available to this project.** Same pose, same seed, same instant, `wet` 0 → 1. The road becomes a mirror and every light counts twice, which is LOOK.md §1's mood reference word for word. 41.7% of pixels change; frame mean +7.2%, roadway band +9.4%. **The numbers badly understate it — open the pair.** |
| 2 | `shot-out/s32-i2-crop-{before,after}-t0.png`, and `s32-i2-zoom-{before,after}.png` for the band | **§3, §4** | **PARTLY, and the residual is measured and named.** A 35° lens on the crossing from the operator's pose. Before: a flat dark box. After: an open balustrade with sky and city through it, and a sliver of lit carriage window. The full rake does **not** come back — §2 below has the arithmetic and the reason. |
| 3 | `shot-out/s32-i2-street-after-t0.png` | **§4** | The same repair at the gate's own 50° framing, so the crop cannot be accused of choosing its evidence. |
| 4 | `shot-out/s32-i3-street-after2-t0.png` and `…-wet.png` | **§3** | **YES.** Blue panes on both elevations against the sodium. The wet one is the frame that makes the case: on a mirror road each cold window counts twice, and item 1 and item 3 together deliver §3 far better than either alone. |
| 5 | `shot-out/s32-i4-down-{before,after}-t0_5.png` | **§2** | **YES, incrementally.** Straight down from 600 m, before = the item-3 commit. New frontage along the top edge and around the brown dome. It is denser. It is not lower Manhattan. |
| 6 | `shot-out/s32-i4-street-after-t0.png` | **§2, §4** | The street wall down the middle distance, after the raise. |
| 7 | `shot-out/s32-i2-train-from-above-t0.png` | — | Not a verdict, a control: the train IS there, lit, running the whole deck, at the same instant as frames 2 and 3. |

```
1  node tools/lookat.mjs --pos=70,1.74,0.9 --target=-104,17.5,-1.4 --fov=50 --t=0.0 [--wet=1]
2  node tools/lookat.mjs --pos=70,1.74,0.9 --target=0,23,11        --fov=35 --t=0.0
5  node tools/lookat.mjs --pos=0,600,0.5   --target=0,0,0          --fov=52 --t=0.5 --w=1200 --h=1200
7  node tools/lookat.mjs --pos=58,42,-34   --target=-2,20,16       --fov=45 --t=0.0
```

**The pose is the look gate's own `street` shot** — `camera.js` → `SHOTS.street`, `[70, 1.74,
0.9]`, which STATE 31 §0 identifies as the operator's own. It was ray-tested with
`poseprobe` pinned at its own stand-off (`--dmin=--dmax=70.725 --astep=1`): 360 of 360
azimuths clear. **That clearance is weak and it is weak for a known reason** — STATE 31 §1
records that `poseprobe` is blind to the origin block, and this pose stands in it. It is the
gate's camera and it stands in the roadway; the ray test adds nothing here and is recorded
because the brief asked for it.

---

## 1. THE HEADLINE: THE 23 EMPTY CHUNKS ARE A PARK, A YARD AND A WEIR

**Item 4 is the main event and its premise is wrong.** LOOK.md §2 says:

> *Fill approaches 1.0 in the core. Measured at session 31: 23 of 100 chunks carry zero
> buildings, one of them at density 0.715. **That is the defect.***

It is not. `generateChunk` was walked directly over `city-budget.json`'s own 10 × 10 region
at seed 1337. **The counts reproduce STATE 31 to the digit on this machine** — 366 buildings,
23 zero-building chunks, 6 of them not `lowDetail`, the same six at the same densities. What
nobody had asked is **why**, and the generator answers in one column:

```
  17 of the 23 are not `built` chunks at all
     kind            chunks   empty   buildings
     built               83       6         366
     parking              5       5           0
     lot                  4       4           0
     construction         3       3           0
     yard                 3       3           0
     park                 2       2           0
```

LOOK.md §2's own first bullet asks that a parcel be empty *"for a reason — a yard, a site, a
park — not because a noise field came out low."* **Seventeen of the twenty-three are exactly
that, and they shipped before this session started.**

**The other six are `built` chunks whose islands are under something**, and the registry says
which, by category, per chunk:

```
  chunk    density  refused by            what is actually standing there
  (-3, 1)   0.715   landmark 7            the `weir`'s AABB covers 100.0% of the island
  (-4,-5)   0.323   landmark 2            the `condenser` covers 67.8%
  (-3,-4)   0.370   water 1               the river takes 83.7% of the island's depth
  (-2,-4)   0.480   water 3               88.1%
  ( 4,-4)   0.524   water 1               87.2%
  ( 0,-1)   0.593   landmark 3, block 1   the `exchange`, plus BLOCK_KEEPOUT
```

> **`(-3,1)` at density 0.715 — the block at the region's p90 that STATE 31 and LOOK.md both
> hold up as the proof of the defect — IS A WEIR.** A 210 × 210 m landmark at
> x −405..−195, z 45..255, and the island sits wholly inside it. All seven of its candidates
> were refused by the landmark, not by the roll.

**And at `fill = 1.0` — the knob at its stop — twenty-one of the twenty-three are still
empty**, four of the six `built` ones with them. **The fill law accounts for exactly two
chunks in a hundred.** LOOK.md §2's fourth bullet says *"a city generated from noise looks
generated however dense it is"* and asks for density with causes. It already has four of
them and they are the reason those chunks are bare.

**What IS broken is inside the `built` chunks, and it is the frontage.** Before this session
the median block delivered **16.2%** of its frontage as building and **179 of 400 block sides
were bare end to end**. That is LOOK.md §2's real complaint and §3 below is what was done
about it.

---

## 2. ITEM 2 — THE WALL WAS 1.15 m ABOVE THE PLATFORM, NOT 2.87, AND THAT CONDEMNS IT

`422c661`. The brief said *"THE WALL IS 2.87 m ABOVE THE PLATFORM. A real platform edge is a
railing of about 1.1 m. Replace it with one."* **`stationprobe` reads the delivered box as
t 7.20..7.45, y 21.000..23.870 — height 2.870.** The platform's walking surface is at
**22.720**. So **1.720 m of that box is below the walking level** — it is the skirt that
closes the widened structure's side elevation — and **1.150 m of it is parapet**, which is
what `VIADUCT_STATION.wallAboveM` has said since session 31. 2.87 m is its height above the
deck **slab**. A height measured from the wrong datum, on this station, for the second time
(STATE 31 §0.3 was the first).

**The corrected number does not save the wall. It condemns it.** Against the DELIVERED train
— `trainprobe`: rail 21.62, **lit window strip 23.25..24.20, roof cap top 25.20**, which is
not the 25.82 the brief quotes, that being the loading GAUGE and not a roof — and from the
operator's own pose, the lowest train height each occluder lets through is
`1.74 + (top − 1.74)·(70 − 3.7115)/(70 − x)`:

```
  occluder                              lets through   of the 0.95 m window strip
  edge wall       x 7.45  top 23.87        25.19 m           0.00 m
  skirt alone     x 7.45  top 22.72        23.97 m           0.23 m
  platform slab   x 7.30  top 22.72        23.92 m           0.28 m
  the OLD parapet x 4.60  top 22.20        22.48 m           0.95 m   <- all of it
```

**The wall let through everything above 25.19 m against a roof at 25.20 — one centimetre of
a 3.58 m train.** And a solid parapet cannot be lowered out of the way either: to show any
window at all it must top out below **22.93 m**, which is **0.21 m above the platform** — a
kerb, not a railing. **So the repair is an OPEN railing, and the brief's word was right for
a reason its own number missed.**

Above the platform: a top rail on the wall's own 23.87 m line, a mid rail, six posts to a
segment at 1.855 m centres, all inside the old 0.25 m transverse envelope — so the occupancy
registry sees a strictly smaller solid and the station's parapet LINE is unchanged. Below it
the skirt stays solid, and it costs nothing to keep: the platform slab's own outer corner
binds either way, 23.92 against 23.97. **+128 boxes, 126 202 → 126 330, all in the existing
`landmark:viaduct` mesh. Zero new draw calls.**

### 2.1 IT DOES NOT RECOVER `band:dawn` OR `band:dusk`, AND THE BRIEF SAID TO SAY SO

Measured both ends on this machine, `lookcheck` at the item-2 parent and at the item-2 commit:

```
  band        before    after     delta    threshold        verdict
  midnight    0.0745   0.0745    0.0000   [0.072, 0.112]    green
  dawn        0.2982   0.2981   -0.0001   >= 0.299          RED -> RED
  noon        0.4285   0.4286   +0.0001   >= 0.428          green
  dusk        0.1389   0.1392   +0.0003   >= 0.140          RED -> RED
```

**dusk closes 27% of its 0.0011 deficit. dawn moves by 0.0001, which is inside the digit
these means are quoted to and is a finding in neither direction.** What DID move is light
getting through: `emitterClusters` at dusk **47 → 60**, at midnight 63 → 66. There is simply
not enough of it — the opened band is 1.15 m at 64 m, about **0.9% of the frame**, and most
of what stands behind it is train and far canopy rather than sky.

**The residual is not the wall.** It is the platform slab's own outer top corner at
(7.30, 22.72), which caps the recovery at **1.28 m of a 3.58 m train and the top 0.28 m of
the window strip**. Closing that means narrowing or lowering a 3.0 m platform — Stage 4, and
the operator's. **The full rake comes back with distance**: the same arithmetic clears the
whole strip past about 150 m.

---

## 3. ITEM 3 — THE SIGNAGE WAS ALREADY COLD AND THE ONE CALLED `windowCold` WAS GREY

`8d792c1`. LOOK.md §3 asks for a third of emitters cold and calls it *"close to free and the
biggest unspent lever"*. The brief said to do the **signage first**. Measured over the 121
resident chunks at the operator's own pose, off the DELIVERED `instanceColor` and instance
scales, weighted by each instance's emitting face:

```
  mesh       lit instances    emitting m2    warm      cold     neutral
  windows          33 213        106 374    98.5%      1.5%       0.0%
  signs               824         18 155    54.1%     45.9%       0.0%
```

**The signage is already 45.9% cold** and has been since `SIGN_CHROMA` got its six members.
The 1.5% of cold window area is the display bands and the ad pillars, which read
`SIGN_CHROMA` too. **Windows carry 5.9× the emitting area of every sign in the city put
together**, and every ordinary one was the single literal `[1, 0.88, 0.72]` on a tungsten
material. **8.0% of the delivered emissive area was cold.**

**AND THE ORIGIN BLOCK'S `windowCold` WAS NOT COLD.** It is 15.95% of its panes and 25.8% of
its emitted light, so on a reading of the code the block was already compliant.
`fluorescentCold` normalises to **R−B −0.111** against a 2450 K pane at **+0.938**: it does
not read as another colour of light, it reads as grey. And the slot it was filling was
already held by `fluorescentDirty` at 29% of panes. **Two near-neutral classes, no cold one,
and the NAME on the second is why nobody looked.**

**The palette, and it is a decision rather than a measurement:**

- **streamed city** — 30% of BUILDINGS cold, 12% of FLOORS flipped against their building's
  grain (a lit stair core, a let floor) → 34.8%. **Per building and not per pane, because
  cold light is a LAND USE**; confetti is LOOK.md §4's stall failure with colour instead of
  form. 65% of the cold is `fluorescentCold`, 35% `mercuryBlue`.
- **origin block** — `windowCold` chroma `fluorescentCold` → `mercuryBlue`, one line. Not a
  fifth material: five window kinds is a fifth `InstancedMesh` on a block that is in every
  gate frame.
- **shopfronts** — 25% cold, rolled PER BAY, because a shop is a bay and this is the light a
  walker at 1.74 m is lit **by**.

`mercuryBlue` normalises to **R−B −0.538**, five times the separation, and is the one
real-world lamp that is genuinely cyan without being a sign. **Not `neonCyan` on a window**:
a saturated cyan pane is a sign with a room behind it, and `SIGN_CHROMA` already owns that.

**Both rolls are position hashes, not `rng` draws** — STATE 31 §6: the `layout` stream
re-phases the whole region if one verdict in it changes. **Every tint is computed, not
typed**: `instanceColor` multiplies INTO the material's tungsten chroma, so a tint is a
ratio and a typed cold triple would deliver a warm cold. Each divides its target by the
tungsten it rides on and rescales to the warm window's own delivered luminance.

**Delivered: emissive area 8.0% → 30.5% cold, windows 98.5% → 71.8% warm. Zero new meshes,
zero new draw calls, 296 both sides. And not one look band moved a digit** — midnight
0.0745, dawn 0.2981, noon 0.4286, dusk 0.1392 before and after — **because the tints are
luminance-matched. This change moves HUE and nothing else**, which is the only way the frame
can be the verdict rather than a confound. `emitterClusters` at midnight 66 → 74.

**AND THE FRAME SAYS WHAT THE CENSUS CANNOT.** Cold pixels in the operator's own midnight
frame go **0.46% → 1.38%** of lit pixels while warm holds at **80.4%** — because most lit
pixels are SURFACES lit by sodium lamps, not emitters. **The street stays warm and the
accents are cold, which is what the reference actually is.** Frame 4's wet variant is where
it lands.

---

## 4. ITEM 4 — THE FILL RAISE COST TWO DRAW CALLS, AND THE STOP IS THE REGISTRY

`af1d608`. `fill = 0.12 + 0.88·d^2.2` → **`0.12 + 0.88·d^1.4`**.

**Swept over the gate's own region, delivered counts read off `generateChunk`:**

```
  law                       buildings   occ med   bare sides   bldg CV
  0.12 + 0.88·d^2.2  was          366     0.162     179/400      0.771
  0.12 + 0.88·d^1.8                418     0.204     166/400      0.712
  0.12 + 0.88·d^1.4  NOW          480     0.244     148/400      0.698
  0.20 + 0.80·d^1.2                545     0.294     139/400        —
  0.40 + 0.60·d                    630     0.316     127/400        —
  1.00               ceiling       797     0.490     115/400        —
```

**MEASURED ON `highway_speed`, THIS MACHINE, BEFORE AND AFTER:**

```
                    before      after     ceiling
  draw calls           430        432         440
  triangles          1.39M      1.57M       2.00M
  instances        158 586    199 327     115 000 floor
  cpu p95 (ms)        8.70       9.20          12    [8.9 9.2 9.4]
  wall p95 (ms)      10.20      10.60        12.5    [10.4 10.6 10.8], spread 0.4
```

> **+31% BUILDINGS COST TWO DRAW CALLS.** Not STATE 31 §6.1's predicted +12 to +18, because
> a fill raise populates **two new chunks per hundred** (§1) and few of those are in frustum
> together. **The draw-call ceiling was never the obstacle.**

### 4.1 ITEM 4d — THE 440 CEILING IS NOT RE-DERIVED, BECAUSE IT WAS NOT IN THE WAY

The brief reserved one threshold for movement and said to move it *only* on measured frame
time on this machine. **432 of 440, eight spare.** Nothing needed raising, so nothing was
raised and `budget.json` is byte-identical.

What the two runs DO record, from inside CONTRACT §0.2's bar (`load1` 1.52 and 1.48): at 430
draws **cpu p95 8.70 ms [8.5 8.7 9.2]** and **wall p95 10.20 ms [10.1 10.2 10.6]**; at 432
draws and 13% more triangles, **9.20 ms [8.9 9.2 9.4]** and **10.60 ms [10.4 10.6 10.8]**,
against ceilings of 12 and 12.5. **This M4 has headroom.** It is not evidence about 440,
because nothing here came near 440 — a re-derivation needs a run AT the higher draw count,
and this session never produced one.

### 4.2 ITEM 4b — THE BATCHING, AND ONE MERGED POOL BREACHES THE TRIANGLE CEILING ON ITS OWN

The brief called this the real work and asked what the streaming and culling model actually
requires. **The precedent exists twice inside `city.js` already** — `rebuildGroundMesh`
merges every resident chunk's ground into one mesh, and `rebuildSignMesh` does the same for
signage. Both are small: the ground is 1 072 triangles over 81 chunks, the signs 824
instances. **Buildings are 68 556 to 103 991 mass instances.**

Measured by walking the scene against the live camera frustum at four points on
`highway_speed`, per Chebyshev ring:

```
  u        chunk meshes   in frustum      triangles   visTriangles   ONE POOL would submit
  0.00        171             57           1 189 212       491 436         1.19 M always
  0.25        171             62           1 325 280       615 432         1.33 M always
  0.50        187             67           1 671 816       668 112         1.67 M always
  0.75        193             69           1 904 736       760 524         1.90 M always
```

> **The frustum test rejects 54% to 60% of chunk geometry, and that is what those 57–69 draw
> calls are buying.** One merged `masses` + `windows` pool is 2 draws instead of 69 — and
> submits **1.19 to 1.90 M triangles every frame** against a **2.00 M ceiling** with 1.57 M
> already delivered. **At u = 0.75 it breaches on its own, before the sky, the traffic, the
> pedestrians, the landmarks and the stalls.** Not an assumption; a measurement.

**The shape that would work, recorded rather than built.** Far rings are almost entirely
inside the frustum when they are inside it at all: at u = 0.75, ring 5 is 30 meshes, 16 in
frustum, 164 748 triangles of which **156 084 are already visible** — merging that band alone
saves 14 draws for **+8 664 triangles**, and ring 6 is 9 meshes, all 9 visible, **free**. A
per-ring merge for the OUTER bands only is cheap and a whole-city pool is not. It was not
built because §4 above says the ceiling was not the obstacle, and CONTRACT §0 rule 5's
spirit cuts both ways: do not spend a session on a rendering change nothing needs.

**Exact draw-call attribution**, by wrapping `renderBufferDirect` and tallying by object
name — every submission counted where three.js counts it — at the page's default time rather
than the route's, so these are composition ratios and not the route's peak:

```
  u=0.00   masses 37   windows 20   lamps 9   bowls 9   of 249
  u=0.50   masses 41   windows 26   stalls 40           of 209
  u=0.75   masses 43   windows 26   stalls 39           of 181
```

### 4.3 THE STOP IS THE OCCUPANCY REGISTRY, ONE STEP FURTHER ON

```
  0.12 + 0.88·d^1.4   480 buildings   432 draws  1.57M tris   occupancy 0 / 0   <- shipped
  0.12 + 0.88·d^1.2   515 buildings                           occupancy 0 / 1   <- REFUSED
```

At exponent 1.2 the DELIVERED scene carries **one forbidden overlap —
`sign(adpillar) × prop(planter)`, 0.061 m²**. LOOK.md §7 reserves the registry's authority
absolutely — *"nothing may stand inside anything else, whatever it looks like"* — so that is
the stop, and it is where the raise stopped. **It has the shape of STATE 31 §4.1's two latent
defects: a placement that was always wrong and has only now had two objects put in the same
place.** Owed, and named here rather than routed around.

**So the budget for density is none of the three things the brief expected.** Not the
draw-call ceiling (8 spare), not triangles (0.43 M spare), not frame time (2.8 ms and 1.9 ms
of margin). **It is an ad pillar standing in a planter.**

### 4.4 AND THE END-OF-RUN GAP IS NOT A LEVER AT THIS FILL

STATE 31 §6's sweep has a row taking the city to 921 buildings by shrinking the end-of-run
gap `rng.range(6, 26)` to `(0.2, 1.4)` — **but that row is at `fill = 1.0`.** Measured at the
shipped fill, `(6, 26) → (3, 13)` delivers **374 buildings against 366**, and block sides bare
end to end go the WRONG way, **179 → 185**, which is the re-phase and not an effect. At this
fill the walk is rejection-dominated: a rejected candidate already costs `width + 1..7` ≈ 23 m,
so saving 8 m at the end of a run rarely buys room for another 19 m building.

### 4.5 WHAT THE RAISE DELIVERED

Buildings **366 → 480**. Frontage occupancy per block, median **0.162 → 0.244**. Block sides
bare end to end **179 → 148 of 400**. Bare-ground share, mean **0.874 → 0.843**. The
buildings-per-chunk CV holds at **0.771 → 0.698** and `citycheck`'s own `clumping` at
**0.652 → 0.632** against a floor of 0.600, so the district structure the 2.2 exponent exists
to protect survives.

**A RE-PHASE MEANS A BEFORE/AFTER FRAME AT ONE CAMERA IS NOT A DENSITY COMPARISON.** Changing
the roll changes every draw after it in the chunk, so frame 5's pair is two different cities
at the same camera, not one city with more in it. **It is denser, and the counts are the
evidence; the frame is the sanity check.** Said plainly because an earlier framing of it,
along the arterial rather than straight down, read as *less* dense and would have been quoted
as a regression.

---

## 5. ITEM 5 — THE LOGNORMAL SHIPPED IN SESSION 20. NOTHING TO DO.

The brief asked to *"first establish whether that shipped"*. Three independent paths agree:

- `HEIGHT_DISTRIBUTION.mode` is **`'logNormal'`**, median 34, σ 0.62, clamps 9–150.
- `git log -L` on that exact line returns **exactly one commit: `ca0169f`, session 20**.
- `heightprobe` at HEAD, both arms through the same generator: **lognormal n 480, mean
  40.62 m, median 33.9, p99 140, max 154, sd/mean 0.657**, against the retained `uniform`
  arm's **sd/mean 0.406, p99 66, max 66**.

`citygen.js`'s comment argues for *"sd/mean 0.664 against today's 0.425, p99 134 m against
65"*. **Delivered today: 0.657 against 0.406, p99 140 against 66.** The comment reads like a
proposal because it is written as an argument — but the argument was acted on in the same
session that wrote it, which is why the brief could not tell. **Both arms reproduce.**

---

## 6. ITEM 1 — WET, AND LOOK.md §6's OWN PREMISE IS THE ONE THAT WAS WRONG

No commit: **nothing in the repository changed and nothing needed to.** The deliverable is
frame 1.

LOOK.md §6 says *"every frame in this project's history — every gate frame, every screenshot
in every STATE — is a dry street."* **That is false, and the counter-example is a gate.**
`lookcheck` captures **dry and wet at all four times of day** (`look-budget.json` →
`wetness.value` = 1.0), writes `tools/look-out/{midnight,dawn,noon,dusk}-wet.png`, and asserts
four bars on them — road specular spread ≥ 1.6× dry, a minimum dry↔wet MSD, elongated SSR
reflection count, and the per-frame quarantine and cluster-overflow checks on the wet side
specifically. At HEAD it reads **midnight 4.32×, dawn 5.60×, noon 8.56×, dusk 9.21×** and
**23 elongated reflections against a floor of 4**.

**What IS true is narrower and it is the whole point**: `main.js:58` has `wet: 0`, so the
running app, every `lookat` frame and every screenshot in every STATE is dry. The wet street
has been measured for many sessions and never *looked at*.

**Changing that default is not this session's to take.** It moves every band in
`look-budget.json` at once and LOOK.md §7 reserves that class of decision. It is one line and
it is the operator's.

---

## 7. GATE STATE — ALL EIGHT RUN, AND THE NET IS ONE RED CLOSED AND ONE OPENED

Each gate was run individually, because `npm run gates` is `&&`-joined and stops at the first
red, hiding everything after it.

```
  parsecheck   GREEN   111 files, contract-clean
  faultcheck   GREEN   7 cases; quarantine surgical, frame survives all seven
  windcheck    GREEN
  inputcheck   GREEN   walk 3.474 m/s vs 3.500, mouse inside the band, lock acquired, fov 75.00

  lookcheck    RED AT 4, DOWN FROM 5, AND THE TWO SILENT ONES NOW RUN
                 ✗ band:dawn        0.2973  (>= 0.299)   carried, and 0.0008 WORSE — §4.5
                 ✗ band:dusk        0.1396  (>= 0.140)   carried, and 0.0004 from closing
                 ✗ facadeAlbedo     3 clusters (min 4)   carried from the station, s31
                 ✗ facadeNeighbours 0.218   (min 0.3)    carried from the station, s31
                 CLOSED: midPatchSample:midWallPanel, carried since before session 27 —
                   a denser city put a wall under the patch, spans 0.55 -> 0.21.
                 AND `midAlbedoClusters` / `midAlbedoSeparation`, which STATE 31 had to
                   record as "DID NOT RUN — these are not passes", NOW RUN AND PASS:
                   2 clusters over 2 walls, closest pair 1.262 against a floor of 0.5.
                 Bands: midnight 0.0745  dawn 0.2973  noon 0.4286  dusk 0.1396

  gateaudit    RED — and it is lookcheck's redness one layer up, exactly as STATE 31
                 recorded. The CONTROL is the unperturbed frame and that frame is
                 outside two bands. Every falsify battery underneath it passes at
                 100% coverage: perfcheck 74/74, citycheck 61/61, inputcheck 13/13,
                 the shape and width controls, and the estimator's four two-sided cases.
                 It is reporting a broken subject, not a broken gate.

  citycheck    RED AT 1, the carried bright reserve — AND IT MOVED 1.59 POINTS
                 ✗ saturation  5.71% of night-route pixels above 0.5 value  (min 6.00%)
                   4.29% at session 31, 4.12% at this session's start, 5.71% now.
                   The fill raise did that and it is 0.29 points from closing the
                   longest-carried red in this project.
                 occupancy 0 / 0 forbidden overlaps, generator AND delivered, over 53
                 forbidden pairs. clumping CV 0.632 (min 0.6). walkability 69 514 of
                 69 515. alignment 73.9% off-axis (min 60%). street level 199 stalls,
                 5 kinds. negative space 17.0% low-detail, 5 kinds. landmarks 8 placed,
                 8 visible, 0 unreachable. All green.

  perfcheck    RED AT 8 OVER FOUR ROUTES, AND EVERY FRAME-TIME CEILING PASSES.

                 route            cpu p95   wall p95   ceil   draws  tris    inst
                 downtown_dense    10.60     11.70     12.5    333   1.40M  150 207
                 highway_speed      9.40     10.70     12.5    432   1.57M  199 327
                 night_rain        11.70     12.70     13.0    334   1.32M  183 673
                 player            10.60     11.50     12.5    322   1.33M  150 207
                 spreads 0.1–0.2 ms. `load1` 1.48 at the start of the run.

                 `downtown_dense` — CONTRACT §0.1's own incident, the route whose
                 margin was 0.10 ms — is clear by 0.80 ms with a 0.2 ms spread.
                 `floors.visibleInstances` 115 000 against a worst route of 150 207:
                 the fill raise took that margin from 1.06× to 1.31×.

                 ✗ ×4  the stop-line datum, 10.77 to 11.99 m on all four routes.
                       CARRIED. STATE 25's diagnosis stands and nothing touched it.
                 ✗     downtown_dense mean luminance 0.0734  (min 0.08).  CARRIED —
                       measured at 0.0731 at the item-3 commit in a `git worktree`,
                       so the fill raise moved it 0.0003 the RIGHT way.
                 ✗     night_rain mean luminance 0.0639  (min 0.08).  CARRIED at
                       0.0690, and the fill raise moved it 0.0051 the WRONG way.
                 ✗     highway_speed tone profile 64% of 63 vehicles (min 75%).
                       CARRIED since session 28 and it flaps: 72% at s28–30, absent
                       at s31, 73% then 64% here, on a population that is itself
                       re-phased. Nothing in this session touches vehicles.
                 ✗     night_rain frame entropy 4.962  (min 5).  ** NEW, AND IT IS
                       ITEM 4's. ** Absent from the same route at the item-3 commit.
```

### 7.1 THE ONE NEW RED, AND IT IS LOOK.md §7's CASE IN ONE FRAME

> `✗ night_rain: frame entropy 4.962 < 5 — the screen is near-empty (5.513 was available at
> this mean)`

**Open `tools/perf-out/night_rain.png` before believing that sentence.** It is a wet street
walled on both sides to the horizon, the road a mirror carrying red, amber, green and cyan,
cold blue windows against warm ones on the near elevation, and the viaduct crossing the sky.
It is the best frame this project has produced and **it is the only frame in this session
that shows all three changes at once** — `night_rain` is the one gate route that already runs
at `wet: 0.85`, so item 1's water, item 3's colour and item 4's density are all in it.

The statistic is not lying about its own quantity. Tonal entropy falls when more of the frame
is one dark value, and **a denser night city has more unlit wall in it** — that is what a
dense night city is. The floor was derived against a sparser one.

**Nothing was done about it.** LOOK.md §7: *"A proxy that now argues against the goal is a
proxy that needs re-deriving, in the open, with the reason and the date written down."* This
paragraph is the open part. **Re-deriving it is the operator's**, and CONTRACT §0 rule 5 is
why it was not touched here: a threshold moved in the same change that broke it is
indistinguishable from a loosening.

---

## 8. WHAT WENT ON THE BRANCH

Session 27's branch, `claude/noctis-25-building-floors-89bqul`. **NOTHING MERGED TO MAIN.**
Each commit is independently revertible, and each one was pushed as it landed — sessions 28
through 31 sat unpushed on one laptop for four sessions and this one did not.

```
  af1d608  item 4 — the fill law, 2.2 -> 1.4, and why the 23 empty chunks are not a defect
  8d792c1  item 3 — cold light
  422c661  item 2 — the station's edge wall becomes a railing
  c2cc4bb  LOOK.md  <- session 31's head, and the "before" of frames 2 and 5
```

**NO BUDGET FILE CHANGED.** `budget.json`, `look-budget.json`, `city-budget.json` and
`input-budget.json` are byte-identical to session 31. **No threshold moved, lowered, raised
or re-derived** — including the one the brief put in play.

---

## 9. THE BRIEF'S PREMISES, MEASURED

| # | the brief said | measured |
|---|---|---|
| — | this session runs on the **M4 Mac mini**, not the MacBook | **TRUE.** `Mac16,10`, Apple M4, 10 cores, 24 GB, AC power. Every pixel gate printed `ANGLE Metal Renderer: Apple M4` |
| — | `load1` will look high early and fall on its own | **TRUE.** 1.78 at the first command, 1.52 and 1.48 before the two `perfcheck` runs |
| 1 | LOOK.md §6: every frame in this project's history is a dry street | **FALSE.** `lookcheck` captures wet at all four times and asserts four bars on them. True of the app's default and of every STATE screenshot — §6 |
| 2 | the wall is **2.87 m above the platform** | **FALSE.** 1.15 m above the platform; 2.87 m above the deck slab. `wallAboveM` said 1.15 the whole time |
| 2 | the train's roof cannot exceed **25.82 m** | that is the loading GAUGE. The delivered roof cap tops at **25.20 m**; the lit windows are 23.25..24.20 |
| 2 | expect this to recover `band:dawn` and `band:dusk` | **FALSE.** dusk +0.0003 of a needed 0.0011; dawn −0.0001, inside the digit. §2.1 |
| 3 | do the **signage first**, it is authored colour and costs nothing | **already done.** Signs are **45.9% cold by emitting area**. The monochrome is the windows, at 98.5% warm and 5.9× the area |
| 4 | draw calls stand at **430 of 440** | **TRUE, and it is the one number in this brief that was exactly right** |
| 4 | ten spare buys **three or four** of the twenty-three chunks | **the arithmetic is wrong.** +31% buildings cost **+2 draws**, because a raise populates two chunks per hundred |
| 4 | 23 chunks carry zero buildings, one at 0.715 — **that is the defect** | **FALSE.** 17 are park/yard/lot/parking/construction; 6 are `built` under a landmark or the river; **(-3,1) is 100% inside the weir**. At `fill = 1.0`, 21 are still empty. §1 |
| 4 | *"Raising fill is not a parameter change; it is a batching problem"* | **FALSE.** It is a parameter change. The stop is the **occupancy registry**, one exponent further on. §4.3 |
| 4d | the 440 ceiling may be a stale derivation | **untested, and honestly so.** Nothing came near 440, so nothing licenses moving it. §4.1 |
| 5 | the lognormal *"may never have shipped"* | **it shipped in session 20**, `ca0169f`. Live at HEAD, both arms reproduce. §5 |

---

## 10. WHAT WAS NOT BUILT, AND WHY

- **The batching.** Measured and refused on its own numbers: one merged pool submits up to
  1.90 M triangles against a 2.00 M ceiling. The far-ring variant is cheap and was not needed.
  §4.2.
- **`wet` was not made the default.** One line, and it moves every look band at once. §6.
- **The `sign(adpillar) × prop(planter)` overlap was not chased.** It is what stopped the
  fill raise and it is a placement defect, not a density one. §4.3.
- **Nothing was done about `band:dawn`.** It moved 0.0008 further from its floor under a
  denser city, by the same mechanism as the station: geometry occluding a bright sky. STATE
  31 §0.2 says it has no content answer and the band is the operator's; that is still true.
- **No new instrument was committed.** Four throwaway probes were written and deleted — the
  emissive chroma census, the exact draw-call attribution, the per-ring frustum cost, and the
  fill sweep. Their numbers are in this file; the brief's rule was that ten sessions of
  probe-writing is why LOOK.md had to exist.
- **Stage 3 of the station, `walkableAt`, vehicle models, `minStopLineM`** — all out of scope
  and all untouched.

---

## 11. KNOWN GAPS CARRIED FORWARD

**Unchanged from s8–s31**: `stats().cutoffM` hard-codes 0.8, the headroom probe inert, GPU
timer queries advertised and never retiring, `saturation-peak.png` overwritten every run,
`$fovYDrift`, `camera.setRouteAt(name, 1.0)` at the sky, rain streaks near-invisible wide at
night, `rain_spray` 0 static, **right turns only**, sun shadows to ~170 m, the bake blind to
elevated slabs, the PMREM hitch, the too-red dawn horizon, one worker at queue depth one, the
far half of the river handing back to the night sky past ~300 m, grime authored, the
near-field washboard on the water, the quay wall inside the walkable mask, props absent from
the walkability mask, the 3.5°–10.4° route camera pitch, the frozen/running A/B,
`materials.display` drawn by nothing, the hauler's marker row buried inside its own body, the
seeding fallback's untested placement, **a bus never turns**, the origin block's absent
occupancy registry, `facadeAlbedo` on its floor with zero spread, the station's cores reading
as an open frame, **nobody can climb the station**, the 0.10 m margin at the core's outer
face, `poseprobe`'s blindness to the origin block, the pavement's missing kerb, and
`tools/city-budget.json:84`'s stale `$derivation_count`.

**New this session:**

- **THE 23 EMPTY CHUNKS ARE NOT A FILL DEFECT** and LOOK.md §2's third bullet should be
  rewritten. §1. **This is the finding that decides the next several sessions.**
- **THE FILL RAISE IS STOPPED BY `sign(adpillar) × prop(planter)`, 0.061 m²** in the delivered
  scene at exponent 1.2. §4.3.
- **ONE MERGED BUILDING POOL BREACHES THE TRIANGLE CEILING** — 1.90 M of 2.00 M at u = 0.75,
  before everything else in the frame. §4.2.
- **THE STATION'S PLATFORM SLAB, NOT ITS WALL, IS WHAT HIDES THE TRAIN NOW** — the outer top
  corner at (7.30, 22.72) caps the view at 1.28 m of a 3.58 m train from 70 m. §2.
- **`band:dawn` MOVED FURTHER FROM ITS FLOOR UNDER A DENSER CITY**, 0.2981 → 0.2973.
- **`night_rain` FRAME ENTROPY IS RED AT 4.962 AND THE FRAME IS THE BEST ONE HERE.** §7.1.
- **`night_rain` MEAN LUMINANCE MOVED 0.0051 FURTHER FROM ITS FLOOR** under the denser city,
  0.0690 → 0.0639. Carried red, made worse. `downtown_dense` moved the other way.
- **`traffic.js:2346` STILL CLAIMS A DRAW-CALL MARGIN OF ONE** where it is eight. Carried
  from STATE 31 §9.1, still unfixed.
- **`citygen.js`'s FILL COMMENT SAID "THE CUBE"** of a field the code raised to 2.2. Corrected
  in passing; the class is CONTRACT §9's.

**Resolved this session**: the edge wall's solidity; the wall's datum; the claim that the
signage needed cold light; the origin block's grey `windowCold`; the fill law's exponent; the
draw-call cost of a fill raise; `midPatchSample:midWallPanel`; LOOK.md §6's premise; and the
question of whether the lognormal shipped.

---

## 12. OFFERED FOR CONTRACT §9's TABLE

Offered rather than added, because `parsecheck`'s `contractDocCheck` counts the rows and the
count is a gate — sessions 24 through 31 left rows on the same terms.

- **A HEIGHT MEASURED FROM THE WRONG DATUM, ON THE SAME OBJECT, TWICE.** STATE 31 §0.3 caught
  *"3.0 m wide on the deck"* against a deck whose widest clear run is 1.364 m. Session 32's
  brief then measured the same station's edge wall as **2.87 m above the platform** when 2.87
  is its height above the **slab** and 1.150 m of it is above the platform — a number the
  constant beside it had spelled correctly the whole time;
- **A BOUND QUOTED AS THE THING IT BOUNDS.** The train's roof *"cannot exceed 25.82 m"* is
  `rail + VIADUCT_LOADING_GAUGE_M`, a clearance envelope. The delivered roof is **25.20 m**
  and the thing anybody wanted to see is the window strip at **23.25..24.20**. An occlusion
  argument run against the envelope instead of the vehicle gets the right verdict here by
  luck and would get the wrong one at 0.62 m of difference;
- **A CLASS NAMED FOR THE ROLE IT WAS MEANT TO PLAY AND NOT THE ONE IT PLAYS.** `windowCold`
  carried `fluorescentCold` at **R−B −0.111** beside `windowDirty` at a comparable neutral —
  two near-neutral classes, no cold one — so a reading of the code said the origin block was
  25.8% cold by emitted light and the frame said it was amber. **The name is why nobody
  looked for eleven sessions**;
- **A PER-INSTANCE TINT TYPED AS A COLOUR WHEN IT IS A RATIO.** `instanceColor` multiplies
  into the material's own chroma, so writing a cold triple into a tungsten window's tint
  delivers `tungsten ⊙ cold`, which is warm. Every tint in this session's palette is
  computed by dividing out the chroma it rides on;
- **AN EMPTY PARCEL READ AS A FAILED ROLL.** Three documents — STATE 31, LOOK.md §2 and this
  session's brief — carried *"23 of 100 chunks carry zero buildings, one at density 0.715,
  that is the defect"*. **Seventeen are parks, yards, lots, car parks and building sites, and
  the one at 0.715 is a weir.** At the knob's stop, 21 of the 23 are still empty. The count
  was right in all three and nobody had asked the generator *why*, which it answers in one
  column;
- **A COST ESTIMATE INHERITED ACROSS A CHANGE OF QUANTITY.** *"Ten spare buys three or four
  chunks of the twenty-three"* multiplies a per-chunk draw cost by chunks that a fill raise
  cannot reach. The delivered cost of +31% buildings is **+2 draw calls**, and the two
  numbers differ by a factor of nine because one counts empty chunks and the other counts
  newly-populated ones in frustum;
- **A FRUSTUM TEST COUNTED AS OVERHEAD RATHER THAN AS WORK.** *"Raising fill is a batching
  problem"* treats 57–69 per-chunk draw calls as pure waste. They reject **54% to 60% of the
  city's triangles**, and the merge that removes them submits up to **1.90 M against a 2.00 M
  ceiling**. The draw calls were buying something nobody had priced;
- **A SWEEP ROW READ AT THE WRONG OPERATING POINT.** STATE 31's *"1.00 + end-of-run gap
  6–26 → 0.2–1.4 = 921 buildings"* is true **at `fill = 1.0`**. Applied at the shipped fill it
  delivers **374 against 366** and takes bare block sides the wrong way, because at that fill
  the walk is rejection-dominated and the end-of-run gap is not what is spending the frontage.
