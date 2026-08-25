# NOCTIS — STATE

*End of session 42. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2 (24C101), `node v22.22.0`. The
machine has **NOT** rebooted since session 40 — 7 d 2 h of uptime at the last command against
session 41's 5 d 1 h, the same boot. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` RANGED 1.52 TO 5.38 ACROSS THE SESSION*** against CONTRACT §0.2's bar of **1.6**. The
FIRST reading of the session was **1.52 and inside the bar** — the first time that has happened in
ten sessions — but the app was running on port 5173 at the time, so §0.2's other condition was not
met and no absolute is claimed from it. Every number below is a COUNT, a PAIRED delta measured in
this tree minutes apart, an exact area computed from the generator, or a pixel statistic. **No
millisecond in this file is admissible as an absolute** and none is quoted as one.

---

## 0. THE FIVE FRAMES, IN THE OPERATOR'S ORDER

Five defects, five commits, five before-and-after pairs, all wet. He found them by looking and
this is what looking says now. `tools/shot-out/` is gitignored and regenerable; every command
that made a frame is in §7.

```
 1  THE TRAIN'S WINDOWS BLOW OUT THE FRAME          midnight, wet, the viaduct crossing
      s42-trainhi-before-t0-wet.png                 a solid white band, no structure
      s42-trainhi-after-t0-wet.png                  six lit windows a car, no halo
      clipped to white over the band   0.823%  ->  0.000%

 2  A LANDMARK STANDS OVER THE ROAD                 daylight, wet, from the pavement
      s42-dish-before-t0_5-wet.png                  traffic driving under a leaning cone
      s42-dish-after-t0_5-wet.png                   the road stops; the cone stands clear
      dish delivered / claimed          2.041  ->  1.000

 3  THE WEIR IS AN ENORMOUS EMPTY DISC              aerial, wet
      s42-weir-before-t0_5649-wet.png               a blank pale lid, 44 100 m2
      s42-weir-after-t0_5649-wet.png                water, planting, steps, an apron
      within +-10 of its own median     100.0%  ->  47.3%
      — and it is 417 m from the river, so the name is the only thing that says weir

 4  A ROAD THAT DOES NOT LOOK LIKE A ROAD           aerial, wet, the ring boundary
      s42-airring-r4-t0_5649-wet.png                a brown field with a crane on it
      s42-airring-r5-t0_5649-wet.png                carriageway, pavement, a park
      ground bare because a building stands on it   48.39 ha  ->  0.00 ha

 5  STILL TOO MUCH EMPTY LAND                       aerial, wet, 950 m over the centre
      s42-air-before-t0_5649-wet.png                brown fields past the city
      s42-air-after-t0_5649-wet.png                 unresolved city past the city
      bare share of the ground in frame  62.6%  ->  41.5%
```

**ALL FIVE WERE MEASURED BEFORE THEY WERE REPAIRED, AND THREE OF THE FIVE MEASUREMENTS MOVED THE
ANSWER.** §8 lists where the brief and the code disagree, which is where those three are.

---

## 1. THE TRAIN — A CONSTANT THAT DOES NOT EXIST, SINCE SESSION 21

`moving.js:393` read `LIGHT.windowLitNits`. **There is no such constant and there never has been.**
`constants.js` has `windowNits` = 220 and has only ever had it.

```
  in the page      moving:lights   emissive (1,1,1)   emissiveIntensity NOT FINITE
  in constants     LIGHT.windowLitNits   undefined, hasOwnProperty false
  in the frame     the window band clipped to white with no structure
```

three.js refreshes the uniform as `emissive.multiplyScalar(emissiveIntensity)`, so every fragment
of `moving:lights` was NaN, and `lights.js`'s `min(rgb, HDR_CLAMP)` resolved it to **60 000 cd/m²
on this GPU** — 273× the 220 the line's own comment computes with, and **2 043× the midnight
bright-pass onset** of 0.414 exposed.

**THE COMMENT WAS ALWAYS RIGHT ABOUT THE ARITHMETIC AND WRONG ABOUT THE NAME.** It writes
`220 × 74.1 = 16 300 cd/m², which is LIGHT.aviationRedNits` — true of `windowNits` — and the two
`instanceColor` gains on that one material are derived against the same 220 (headlamp 12.0 →
2 640, crane beacon 74.1 → 16 300). **One name repairs three emitters and moves no derived
number.**

### 1.1 The brief predicted the lever and it was right

*"Session 27 measured that the bright-pass threshold barely moves midnight because emitters sit
~300× over its onset — so a threshold change is likely the wrong lever and the radiance is the
candidate."* Correct, and stronger than stated: the streetlamp is 306× over onset and **this
emitter was 2 043×**. No threshold was touched.

### 1.2 The class is machine-checked now, and it was the only instance

`parsecheck` gains a fourth pass: every `NAMESPACE.key` naming an object imported from
`core/constants.js` must exist on it. Over `src/` that is **324 references in 19 files, and with
this line repaired all 324 resolve.** It is CONTRACT §9.1's config-the-code-does-not-read with a
NAME instead of a value, and JavaScript answers `undefined` rather than throwing.

The check carries four directions, all in the same change (§7.3): a real key passes, a fabricated
key off the same namespace fails, a module's OWN local `SITE` is not checked against
`constants.js`'s — `citygen.js` has one, and checking by bare name reports 28 references that are
not references to this object — and a constant named only in a doc comment is prose rather than a
read. **Confirmed RED against the real defect before the repair landed, and green after.**

---

## 2. THE LANDMARK OVER THE ROAD — AND THE TABLE HAD NEVER BEEN TAKEN IN FULL

The brief asked for the whole set before assuming which case this was. Run with every landmark
resident, which needs `landmarkcensus --at=` **twice** because no single camera has them all —
session 35 measured six of eight and this table has never existed before:

```
  landmark    claim        delivered      del/claim    after      what was wrong
  dish        62 x 62      88.0 x 88.0      2.041      1.000      radiusTop x 0.70
  mast         9 x 9       12.0 x 11.7      1.726      0.597      no diagonals in the claim
  condenser  102 x 102    124.0 x 124.0     1.487      1.000      radiusBase x 0.82
  stack       78 x 78      78.8 x 78.8      1.021      0.993      the step yaw
  viaduct    109 x 445    110.2 x 448.0     1.016    unchanged    claims are legs, extent is deck
  exchange    66 x 66      66.0 x 66.0      1.000    unchanged
  weir       210 x 210    210.0 x 210.0     1.000    unchanged
  arch       133 x 15     124.5 x 12.8      0.795    unchanged    claim spans both legs
```

**THREE LANDMARKS OVER-DELIVERED, NOT ONE, AND TWO OF THE THREE HAD NEVER BEEN MEASURED AT ALL.**

### 2.1 The cause is one list answering a question it was never asked

`landmarkOccluders` is the canyon bake's list and its boxes are deliberately INSCRIBED: a square
at a round tower's true radius over-occludes its corners by 4/π, so 0.82 for a hyperboloid and
0.70 for a cone match the box's AREA to the circle's. That is right for a march against two-metre
voxels.

Session 34 then made the same list the GROUND CLAIM. An area-matched box is not a keep-out. The
dish is 26 m across at grade and 88 m across at 56.8 m; the claim that clips the roads under it
was 61.6 m. **So the carriageways of x = −128 and z = −128 kept live lanes under a leaning shell,
which is the operator's frame.** It is the habit `landmarkGroundBlockers` was split out for, in
that function's own words: *"one list stand[ing] for two questions"*.

### 2.2 The repair keeps one list and gives each box both numbers

`x0..z1` is the bake extent, **unchanged to the bit**, so the canyon field does not move.
`gx0..gz1` is the plan silhouette — circumscribed where the bake box is inscribed — and the four
ground readers take it: the registry claim, `landmarkAABB` (the reject for `landmarkOccupies`, a
ground question), `landmarkBlocks`, and `landmarkGroundBlockers`, which is what stops a person.
Every ground extent is ≥ the bake extent beside it; nothing was weakened.

**WHAT IT COSTS, PAIRED WORKTREES AT THE TWO COMMITS**, same seed, same 10 × 10:

```
                    before     after
  buildings            687       674     -13
  carriageway       38.669    38.308 ha  -3 610 m2, the road under the masses
  pavement          16.990    16.803 ha  -1 870 m2
  landmark claim   119 323   128 632 m2  +9 309 m2 of keep-out
```

`citycheck` reports 8 landmarks placed, **0 unreachable on foot**, worst detour 1.46× (the dish) —
so the bigger keep-outs cost no reachability.

### 2.3 One duplicated literal is gone

The stack's steps are turned ±0.8/−0.6° by `city.js` and the claim needs the same angle to state a
turned rectangle's silhouette. They were two literals in two files — `pierEvery: 34` beside
`i % 3 === 0`, in degrees — and the claim was the half that was wrong.
`ZIGGURAT_STEP_YAW_DEG` is exported by citygen and both read it.

The mast's ground half is the analytic bound `1.7 × w0` over every yaw rather than the 6.0 m the
census reads, **because a claim that tracks a measurement goes wrong the next time a yaw changes.**
It over-claims 1.65 m on a mast whose nearest carriageway is 42 m away.

---

## 3. THE WEIR IS NOT A WEIR, AND THE NAME IS THE ONLY THING THAT SAYS IT IS

**MEASURED FROM THE GENERATOR'S OWN RIVER**, sweeping the claim's x range through `riverEdges`:

```
  weir claim, nearest point to the nearest river bank     417.04 m    at x = -405
  weir claim, nearest point to the river centreline       468.70 m
  the river's whole envelope, worst case                  395.3 m short
  in chunk widths                                         3.26
```

The brief said *"a weir is a river structure"* and that a weir nowhere near the river would be a
placement finding outranking the appearance. **It is not a placement finding.** `kind` is `basin`,
the authored comment has said *"a stormwater basin and sunken park"* since it was written, and a
detention basin belongs in its catchment rather than on a channel. **The placement is right and
the WORD is wrong** — it cost this brief an item, asking for *"water, a spillway, a channel,
banks"*. The name stays, because twenty sessions of registry owner strings, `landmark:weir` mesh
names, gate output and STATE files key on it; the correction is written into the LANDMARKS entry
where a reader meets it.

### 3.1 The geometry refuted the first repair, and the number is why

The floor falls 0.40 m over its 102 m — **0.39%** — so water 1.00 m deep would stand at r = 255 m,
four times the bowl. This section cannot hold a pond, and what it describes is a DRY detention
basin. So the first pool was derived at the depth the floor does allow, 0.10 m reaching r =
25.5 m, **and it tore**: a 40-gon cone's chords sag `r(1 − cos(π/40))` = **0.077 m at r = 25**,
the same order as the water was deep, so the floor surfaced through it in alternating sectors and
the disc rendered as a black starburst.

> **A DEPTH UNDER THE MESH'S OWN FACETING IS NOT A DEPTH.**

So the outlet is dug into a pool the section can hold, which is what a wet detention basin has at
its outlet anyway — the dry floor is the storage that fills in a storm, and the permanent pool
does not. `basinPond` owns the arithmetic: **20% of the floor area** (r = 102 × √0.20 = 45.6 m,
6 537 m² of 32 685), **1.50 m** deep because a permanent pool shallower than about a metre roots
over, on a **1:4** bank. At r = 45.6 the water meets the ground at 24× the faceting sag.

The water is `lights.patch(m, { water: true })` — the same call `river.js` makes. Waves, Fresnel
and the SSR march come with the define and `uNoctisTime` is a SHARED uniform, so a second water
surface needs no hookup. Drawn WITHOUT it, at that albedo and at the bottom of a 9 m bowl with
almost no sky in view, the disc was a black rip, which is worse than the lid it replaced.

`WATER_BODY` moved to `core/constants.js`: it was a literal in `river.js` and `city.js` may not
import a module (§2.2), so the alternative was the same colour written twice.

### 3.2 The rest is the park its own entry promises

Four flights of steps from the ledge to the floor at 0.17 m risers — climbable by this city's own
controller, `PLAYER.stepUpM` = 0.20 — where the only way in was a 7.80 m vertical face; and
sixteen stands of planting on the floor at **4.0 m, not 0.6**, because from overhead a bed's plan
area is the same at any height and its SHADOW is not.

The pond is a `CircleGeometry` rather than a lathe because a lathe over a profile of constant y
has normals of zero length — CONTRACT §9.1's own rule about a surface's normal and its winding
being two statements that must agree.

### 3.3 THE PARK BROKE THE DRAW CEILING AND ITS STAIRS WERE NEVER BUILT — BOTH MINE

Both were found by running the gate, after the commit that claimed them.

**`perfcheck` read `highway_speed: 441 draw calls > 440`.** `addInstanced` emits ONE
`InstancedMesh` PER CHUNK that owns a box, so a park spread over a 210 m bowl costs a draw call
per chunk it reaches. The boundaries here are x = −384 and −256 (84 m and 44 m from the axis) and
z = 128 and 256 (22 m and 106 m):

```
  ledge ring + beds + pond    6 meshes + 1 = 7 draws    434 -> 441   OVER
  beds + stairs + pond        4 meshes + 1 = 5 draws    434 -> 439   under
```

A ring of ledge planters at r = 103.5 crossed x = −384 and cost two chunks. **It was removed and
everything now stays inside r = 83.6 m.** Four chunks is the FLOOR for anything that fills this
bowl, because z = 128 passes 22 m from the axis. The ceiling did not move (§0 rule 5) and the disc
metric did not notice the ring going: 47.2% with it, **47.3%** without.

**AND THE FOUR FLIGHTS OF STEPS WERE NEVER BUILT.** `drop = -l.depth - ledgeY` is −9 − (−1.2) =
**−7.8**, so `steps` was −46 and the loop never ran once — while the comment beside it said
*"7.80 m"* and the commit message described the stairs as delivered. It is CONTRACT §9's shape
with a SIGN, in a line whose own comment carried the right number. Found while computing which
chunks the park touches: the stair loop contributed no chunks at all, which is not a plausible
answer for four flights on a 102 m circle. Repaired, and the flights are in the frame — four
ribbed marks at the diagonals, which is how it was confirmed rather than assumed.

The claim's `y0` now takes the section's own minimum (−10.9) instead of `-l.depth` (−9.0), which
stopped 0.40 m above the outlet even before the pond was dug.

---

## 4. THE ROAD THAT IS NOT A ROAD IS THE EARTH PLANE

Identified against the brief's own four candidates, before anything was repaired:

```
  (i)    a carriageway with its markings missing        REFUTED, with a number
           216 of 218 carriageway rects carry markings; unmarked area 0.00 ha, 0.0%
  (ii)   a road material that is not asphalt            REAL, AND NOT IT
           38.8% of carriageway is concrete at 2.32x asphalt's albedo — but sampled
           in the delivered frame at centrelines of KNOWN material, asphalt reads
           median luma 87.9 (71.0-196.4) and concrete 97.8 (24.7-198.2). Shading
           swamps albedo; no frame can attribute a pale road to its material.
  (iii)  a ground rectangle from another owner          the yard, palest at 0.172, 1.9%
  (iv)   THE EARTH PLANE SHOWING THROUGH                THIS ONE
```

`tools/bareprobe.mjs` is the instrument and it is new, because per-hectare object counts cannot
answer this: `groundprobe` divides by OPEN GROUND, which is exactly the quantity that says nothing
about whether a SURFACE was drawn on it. **A parcel with 180 objects a hectare and no surface
under them is 180 objects standing on the world's earth plane.**

```
  BARE GROUND, 950 m over the region centre, 14 x 14 chunks at seed 1337

    past the geometry ring            93.53 ha    41.1% of visible ground
    MASSING RING, GROUND NOT DRAWN    48.39 ha    21.3% of visible ground
    river envelope / island / clip     0.69 ha     0.3%
```

**21.3% of everything a frame can see was bare because a BUILDING was drawn there and its ground
was not.** `city.js` drew massing to `geometryRadius` (5) and ground to `groundRadius` (4), so a
band of city 128 m wide stood on the earth plane — whose albedo, 0.069 linear, is **84% of
asphalt's** 0.082, lying exactly where the carriageway belongs. Wide, pale, no markings and no
kerbs, because it is not a road.

**THE MODULE'S OWN HEADER HAS PROMISED OTHERWISE SINCE IT WAS WRITTEN:** *"geometry (6) massing
only — the building boxes AND THE ROAD SURFACE"*. It drew the boxes. That header's three ring
numbers were 3, 6 and 2 against `CITY`'s 4, 5 and 2 — stale in the direction that matters, since
the point of the list is which ring is larger than which. Both corrected.

### 4.1 The repair is the coupling, not the number

`groundRadius`'s own comment said *"a larger value here would be a number the code cannot read"*
because the predicate was `detail && ring <= groundRadius` with `detailRadius` = 4. **That was
right about the code and wrong about which half to change.** The `detail &&` is gone and
`groundRadius` is `geometryRadius`'s equal, which is the honest bound: ground exists exactly where
a building can be drawn standing on it.

Re-derived in the open with the date, LOOK.md §7, 2026-08-25:

```
    ring <= 4    81 chunks   2411 rects   4822 tris   520 776 B
    ring <= 5   121 chunks   3459 rects   6918 tris   747 144 B
    delta       +40 chunks  +1048 rects  +2096 tris  +226 368 B = 0.216 MiB
```

+2 096 triangles against `ceilings.triangles` 2 000 000 with `highway_speed` at 1.40M, and
+0.216 MiB against `ceilings.chunkMemoryMB` 96.

**ZERO DRAW CALLS, MEASURED IN BOTH ARMS AND NOT ARGUED.** `rebuildGroundMesh` concatenates every
resident chunk's ground into one `city:ground` mesh, so the ring is one draw call at any radius.
Paired, same tree, same pose, minutes apart: **groundRadius 4 → 364 draws, groundRadius 5 → 364
draws.**

Delivered: **10.24% of the aerial's pixels changed, in an annulus.** In the r4 arm that band is a
featureless brown field with one crane jib floating on it; in r5 it is carriageway, pavement,
block interiors and a park.

---

## 5. THE EMPTY LAND — THE GENERATOR'S HALF WAS ALREADY CLOSED

```
  bare ground, share of all the ground an aerial frame can see
    what the GENERATOR leaves bare (no ring rule)                 0.7%
    what the FRAME showed at the start of this session           62.6%
    what the FRAME shows after the ground ring was extended      41.5%
```

**Session 40 really did close its half: 0.7%.** None of the brief's candidates was the cause —
not the street width, not the ground between kerb and building line, not surfaces owned by
nobody, not the bare-earth share inside filled chunks. Those total 0.69 ha over 14 × 14 chunks.

What is left after §4 is **one** reason: past the geometry ring, 99.1% of the remaining bare and
41.1% of the ground an aerial sees. **Nothing is drawn there and nothing should be** — that is the
residency ring working, not a gap.

### 5.1 What IS drawn there is the earth plane, and its colour was a guess

`block.js` drew it at `0x4a4640` with no comment beside it, in a file where every other surface
carries one (*"asphalt 0.09 linear weathered"*, *"cast concrete paving: 0.26 linear, mid-range for
a weathered slab"*). §9 rule 5 calls that a guess, and this one is **8 km square**.

Against this city's own ground, area-weighted by `bareprobe` and coloured by `city.js`'s
`albedoFor`:

```
    core        40.96%  [0.105, 0.102, 0.096]
    carriageway 28.58%  [0.082, 0.082, 0.086]
    pavement    15.22%  [0.260, 0.257, 0.248]
    site         5.75%  [0.115, 0.107, 0.092]
    parking      5.07%  [0.082, 0.082, 0.086]
    yard         3.08%  [0.172, 0.169, 0.160]
    grass        1.34%  [0.062, 0.094, 0.045]
    -----------------------------------------
    mean               [0.1229, 0.1211, 0.1168]   over 106.35 ha
    the earth plane    [0.0685, 0.0612, 0.0513]   0x4a4640
```

**1.80×, 1.98× and 2.28× darker, and a third warmer — R/B 1.34 against 1.05.** Dark and red beside
grey is a field beside a city, and both halves of *"wide brown fields"* were literally true.

The precedent is this project's own, one system over. CONTRACT §8.1, on the canyon field's
analytic default: *"The default's job is to agree with the bake about the average; where they
disagree, the ring boundary becomes visible."* **This plane is the GROUND's analytic default and
had never been calibrated against the ground it stands in for.** It is now that mean, in
`GROUND.earthAlbedo`, with the table above beside it.

**It is not content and does not pretend to be.** No surface, no object, no draw call. It does not
make the far field a city; it stops the far field claiming to be a ploughed one. Delivered: over a
patch of pure earth plane in the aerial, mean luma **81.3 → 99.0**.

### 5.2 And the look bands do not move — paired, not argued

`lookcheck` run **with and without** this change, same tree, minutes apart, reports the IDENTICAL
three violations to four decimal places, `band:dusk` 0.1393 in both. The dusk frame is a street
inside the origin block, walled on both sides, and the earth plane is not in it.

---

## 6. GATE STATE

Run individually, because `npm run gates` is `&&`-joined and stops at the first red.

```
  parsecheck   GREEN   112 files (111 + tools/bareprobe.mjs), contract-clean, and it
                       now carries a fourth pass — §1.2
  faultcheck   GREEN   7 cases; quarantine surgical, frame survives all seven
  windcheck    GREEN
  inputcheck   GREEN   frame 3.7 ms = 270 fps. Session 41's repair holds.
  citycheck    RED at 3 — the SAME THREE as sessions 40 and 41, and one is smaller:
                 clumping CV        0.431 -> 0.440   (floor 0.60, untouched by instruction)
                 sign quads inside      2 -> 2       (unchanged)
                 delivered overlaps     3 -> 2       one fewer; 0.013 and 0.094 m2 remain
               No new violation of any kind. Bright reserve 6.16% GREEN against 6.00.
               8 landmarks placed, 0 unreachable on foot, worst detour 1.46x.
  lookcheck    RED at 3 — band:dusk 0.1393 (band [0.14, 0.18]), facadeAlbedo, facadeNeighbours.
               IDENTICAL with and without this session's last change. §5.2.
  gateaudit    RAN. All four --falsify suites green (perfcheck 74/74, citycheck 61/61,
               inputcheck 13/13, thresholds). Its ONLY failure is the CONTROL — lookcheck's
               own reds restated. NO THRESHOLD DRIFT.
  perfcheck    RED, and it CAUGHT SOMETHING THIS SESSION PUT THERE. §6.1.
```

**STATE 41 SAYS `lookcheck` HAS FOUR REDS. IT HAS THREE**, at HEAD and after, and this file says so
rather than repeating the number. It is item 2 of STATE 41's own list — a gate whose count is
carried forward instead of printed is a count that goes stale.

### 6.1 perfcheck

**Its milliseconds are not admissible** — `load1` was 5.38 and CONTRACT §0.2's bar is 1.6 with the
app closed. **Its counts are**, by §9 rule 6's corollary, and one of them was the most useful
reading of the session:

```
  ✗ highway_speed: 441 draw calls > 440      <- this session's weir park. §3.3
  ✗ highway_speed: 439 draw calls            <- after the repair. UNDER.
  ✗ highway_speed: 52% of 64 vehicles carry a non-monotone tone profile (min 75%)
  ✗ night_rain:    cpu p95 12.70 / wall p95 13.80    inadmissible at this load
  ✗ night_rain:    mean luminance 0.0715 outside [0.08, 0.55]
```

**The `tone profile` red is the carried one** — STATE 41's gaps list has it *"red on every reading
for eight sessions"*, and STATE 40 item 5 says its spread is larger than any arm anybody has
compared with it. It read **63%** on the first run of this session and **52%** on the second, an
11-point swing with no content change between them that touches a vehicle, which is that warning
arriving as a number. **Pool them or stop quoting them** stands.

`highway_speed` reads **2.06M triangles against a 2.00M ceiling** and is not asserted on it — the
carried gap *"one merged building pool breaching the triangle ceiling"*. This session's ground ring
added 2 096 of those 2 060 000, which is 0.1% and does not change whose gap it is.

The draw-call catch is worth stating plainly, because §5 of STATE 41 was about a gate that had a
signal nobody could believe: **a count in a red gate is still a verdict.** The 441 was found in a
run whose milliseconds were worthless.

---

## 7. HOW EVERY FRAME IN THIS FILE WAS TAKEN

All at seed 1337, all `?paused=1`, all wet. All seventeen have distinct md5s.

```
  1  node tools/lookat.mjs --pos=95,44,44   --target=0,24,11    --fov=45 --t=0.0    --wet=1 \
       --name=s42-trainhi --tag=<before|after>
     node tools/lookat.mjs --pos=150,1.7,0.6 --target=0,24.5,11 --fov=40 --t=0.0    --wet=1 \
       --name=s42-train2  --tag=<before|after>      the same thing from the pavement
  2  node tools/lookat.mjs --pos=-128,1.7,-40 --target=-150,35,-160 --fov=60 --t=0.5 --wet=1 \
       --name=s42-dish    --tag=<before|after>
  3  node tools/lookat.mjs --pos=-300,420,480 --target=-300,-5,150 --fov=55 --t=0.5649 --wet=1 \
       --name=s42-weir    --tag=<before|after>
  4  node tools/lookat.mjs --pos=0,950,0 --target=-200,0,-200 --fov=50 --t=0.5649 --wet=1 \
       --name=s42-airring --tag=<r4|r5>            the ground-ring A/B, one parameter apart
  5  node tools/lookat.mjs --pos=0,950,0 --target=-200,0,-200 --fov=50 --t=0.5649 --wet=1 \
       --name=s42-air     --tag=<before|after>
```

**A STREET-LEVEL FRAME AT THE VIADUCT DOES NOT SHOW THE TRAIN AND THE ARITHMETIC SAYS WHY.** The
first attempt stood at 53 m and saw only the deck: the sightline over the near parapet (top 23.2 m)
rises past the window band (23.73 m) at any distance under about **102 m**, so a walker close to
the crossing cannot see a train on it. `s42-train2` is taken at 150 m for that reason and
`s42-trainhi` at 44 m up, where the band is unobstructed and the defect is legible.

---

## 8. WHERE THE BRIEF DISAGREES WITH THE CODE

The brief asked for this explicitly, and said it had written a false premise into nineteen
consecutive briefs. **This one contains no false premise.** Three of its five items resolved to
something other than what they proposed, and in every case the brief had already told the session
to measure first:

1. **Defect 2 — *"either a 24th site, one of the two known blind ones, or a landmark whose
   delivered geometry exceeds its claim"*.** The third, and **three landmarks exceed, not one**.
   The site list is 23 at HEAD and was 23 at session 35; there is no 24th. The two blind sites are
   still blind and still `basin`-shaped (§10 item 4).
2. **Defect 3 — *"make it read as that thing: water, a spillway, a channel, banks"*.** The
   geometry says none of those: 0.39% of floor slope is a DRY basin, and the object is 417 m from
   the river. What it wanted was the sunken park its own entry has promised since session 4.
3. **Defect 5 — the four candidates offered.** None of them. *"The streets themselves may simply
   be too wide"*, *"the ground between the kerb and the building line"*, *"surfaces owned by
   nobody"*, *"the bare-earth share inside chunks that already count as filled"* — together they
   are **0.69 ha of 227 ha, 0.3%**. The generator's own bare share is 0.7%. It is the residency
   ring, and the operator was looking past the edge of the city.
4. **Defect 1 — the brief's one prediction, and it held.** *"A threshold change is likely the
   wrong lever and the radiance is the candidate."* Right, and by a larger factor than it knew.

---

## 9. WHAT WAS NOT DONE

- **`clumping` was not touched.** Red by instruction. It moved 0.431 → 0.440 as a consequence of
  the geometry this session changed, and remains under its 0.60 floor. STATE 40 item 2 and STATE
  41 item 3 both say it needs a decision from the operator rather than another measurement.
- **The sign claims were not touched.** The brief listed them as open and not for this session.
- **The `inputcheck` window was not repaired.** STATE 41 §4.1 left it as the operator's decision
  and this session had no mandate for it. `inputcheck` is green at 270 fps either way.
- **`perfcheck`'s `player` route still does not register the player module.** STATE 41 §5.
- **The weir's mask still calls the whole bowl walkable** and the geometry still disagrees away
  from the four new stairs. §10 item 2.
- **No quiet battery.** `load1` 1.52–5.38 with the app running on 5173.
- **The weir's park cost five draw calls** and `highway_speed` now stands at **439 of 440**. That
  is legal and it is one spare. §3.3 and §10 item 9 say how to get them back.
- **No merge to main.** SIX commits on `claude/noctis-42-operator-five`, pushed — five for the
  operator's five defects and one for the two defects the sixth commit's own gate found in the
  third of them.

---

## 10. WHAT TO DO FIRST NEXT TIME

1. **THE CLUMPING STATISTIC, REPLACED RATHER THAN RE-NUMBERED.** Carried from STATE 40 item 2 and
   STATE 41 item 3, untouched, and now **0.440** against a 0.60 floor. Four sessions have shown it
   punishes content: it correlates 0.92 with how many chunks are EMPTY, and the last three
   sessions have all been about filling chunks. **It needs a decision from the operator, not
   another measurement.**

2. **THE TWO BLIND SITES ARE STILL BLIND AND THE WEIR IS NOW WORTH ENTERING.** `walkableAt` and
   the walkability flood fill both `continue` on `l.kind === 'basin'` and then ask
   `landmarkGroundBlockers`, which returns `[]` for a basin — so the mask calls all 44 100 m²
   walkable while the geometry is a 7.80 m drop everywhere except the four new stairs. Session 42
   made the geometry agree at four points; the mask still disagrees everywhere else, and there is
   now a park down there for somebody to walk in.

3. **THE GENERATOR REGISTRY CONTAINS NO SIGN CLAIMS AT ALL.** Carried from STATE 41 item 4. Eight
   `claimBox` sites and not one a sign, which is why delivered sign overlaps reappear on every
   re-phase. This session re-phased the city three times and the delivered count went 3 → 2, which
   is the lottery that finding predicts.

4. **`perfcheck` HAS A ROUTE NAMED `player` AND HAS NEVER REGISTERED THE PLAYER.** Carried from
   STATE 41 item 5, untouched.

5. **THE `inputcheck` WINDOW.** Carried from STATE 41 item 1. The operator's decision, two lines
   either way.

6. **THE LOOK CURVE'S TWO BOUNDS ARE STATED PER FRAME AT 60 Hz.** Carried from STATE 41 item 6.
   The frame is now 3.7 ms and the 0.1-deflection reading is outside the bound at the other end.
   **The constant is almost certainly fine and the BOUND's expression is what is stale.**

7. **`landmarkOccluders` IS STILL UNMEMOISED** and is the function doing the work. Carried from
   STATE 41 item 5b. `landmarkGroundBlockers` now allocates a fresh array of mapped boxes on every
   call as well, which is the same path — not per-frame today, and worth the same `Map` if it ever
   becomes one.

8. **A `citycheck` ASSERTION THAT DELIVERED MAY NOT EXCEED CLAIMED.** The table in §2 is the
   ratchet this project does not have: three landmarks over-delivered for eight sessions and the
   only instrument that could see it needed two camera positions and a person to run it. Every row
   is now ≤ 1.000 except the viaduct's documented 1.016, so the assertion could be written GREEN
   today — which CONTRACT §7.5 says is the wrong order, but it is at least writable now.

9. **A LANDMARK'S BOXES AND ITS CHUNK'S BUILDING MASSES ARE TWO MESHES FOR NO REASON.** They use
   the same geometry and the same material and are separate only because they are assembled in two
   places, so every landmark that spans chunks costs one draw call per chunk it touches. That is
   what capped the weir's park at four chunks (§3.3) and it is five draw calls sitting in the
   tightest budget in the project. The caveat is CONTRACT §9.1's own, about the merge that took
   the detail ring from nine draws to five: **a refactor that erases a category erases the check
   on it**, and `citycheck` asserts on `landmarkBoxes`.

10. **THE NARROWING VERDICT**, **THE YARD'S BOUNDARY STACK**, **THE VEHICLE-SILHOUETTE SPREAD**,
    **`band:noon` AND `band:dusk` HAVE NO SURVIVING MECHANISM**, **the condenser's ground claim**
    (now closed — §2), **the end-of-run gap**, **a quiet battery**. Carried from STATE 41 items
    7–13, untouched except where noted. The vehicle-silhouette spread is no longer a warning: it
    moved 63% → 52% inside this session with nothing touching a vehicle (§6.1).

---

## 11. KNOWN GAPS CARRIED FORWARD

**Unchanged from s8–s41**: `stats().cutoffM` hard-codes 0.8, the headroom probe inert,
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
`minArrivalsPerMinute` having no gate reader, the zero-second protected pedestrian phase,
`landmarkBlocks` still exported and still disagreeing with the registry two ways, **the basin is
walkable in the mask and unwalkable in the geometry**, the two `walkableAt` sites still blind to a
basin, the quay walk's ulp exposure on four named chunks, **`walkability` unreachable cells at 134
with no threshold reading it**, **`tone profile` red on every reading for eight sessions**, a gate
message frozen in the present tense of the session that wrote it, **a palisade that does not stop a
pedestrian**, and **the two delivered `sign ×` overlaps and the two sign quads inside a building**.

**CLOSED THIS SESSION:**

- **The train's windows at 60 000 cd/m²**, NaN since session 21 and 273× their intended radiance.
  §1.
- **The dish delivering 88 m of structure against a 62 m keep-out**, measured and unrepaired since
  session 35 — and with it the mast's 12.0 m against 9 m and the condenser's 124 m against 102 m,
  neither of which had ever been measured. §2.
- **44 100 m² of the city being an empty concrete bowl**, carried since session 34. §3.
- **21.3% of an aerial's ground being bare because a building stood on undrawn ground.** §4.
- **The earth plane's colour having no derivation**, since the plane existed. §5.

**NEW THIS SESSION — all of it measured, none of it inferred:**

- **`LIGHT.windowLitNits` HAS NEVER EXISTED**, and it was the ONLY dangling constant reference in
  `src/` — 324 references in 19 files, all of which resolve now. §1.
- **THE WEIR IS 417.04 m FROM THE NEAREST RIVER BANK**, 3.26 chunk widths, and its placement is
  correct because it is a detention basin and not a weir. §3.
- **THREE LANDMARKS DELIVERED MORE THAN THEY CLAIMED**, and the delivered-versus-claimed table had
  never been taken with all eight resident. §2.
- **THE GENERATOR LEAVES 0.7% OF ITS GROUND BARE.** Session 40's work holds; the emptiness the
  operator sees is the residency ring. §5.
- **THE EARTH PLANE IS 1.80x/1.98x/2.28x DARKER THAN THE CITY'S OWN GROUND** and a third redder,
  R/B 1.34 against 1.05. §5.1.
- **A DEPTH UNDER A MESH'S OWN FACETING IS NOT A DEPTH** — 0.077 m of chord sag against 0.10 m of
  water, which is why the basin's section had to move rather than its surface. §3.1.
- **A STREET-LEVEL CAMERA CLOSER THAN ~102 m CANNOT SEE A TRAIN ON THE VIADUCT**, because the near
  parapet's sightline passes above the window band. §7.
- **THE GROUND RING COSTS ZERO DRAW CALLS AT ANY RADIUS**, measured in both arms at 364. §4.1.
- **`lookcheck` HAS THREE REDS AND STATE 41 SAYS FOUR.** §6.
- **A LANDMARK COSTS ONE DRAW CALL PER CHUNK IT TOUCHES**, because `addInstanced` emits one mesh
  per chunk — which is what made 44 100 m² of park cost seven of the six draw calls this project
  had spare. §3.3.
- **THE `tone profile` BAR MOVED 63% → 52% INSIDE ONE SESSION** with no change to any vehicle,
  which is STATE 40 item 5's warning about its spread, delivered. §6.1.
