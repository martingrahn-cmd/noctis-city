# NOCTIS — STATE

*End of session 63. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`, 13 d 10 h of
uptime — the same boot as sessions 47–62. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` NEVER FELL BELOW 3.74 AND RAN AT 4.0–4.9 THROUGH THE BATTERY***, with
`mediaanalysisd` and its XPC helper on two cores for the whole session — over CONTRACT §0.2's bar
of 1.6, so **no millisecond here is a verdict**, for the third session running. Every number below
is a count, a length, an angle, a reflectance or a ratio.

Branch `claude/noctis-63-the-ground`, off session 62's head, pushed as each item landed.

---
## 0. ITEM 1 FIRST, BECAUSE IF A SLOPE DOES NOT SHADE NOTHING ELSE IS VISIBLE

**A NON-VERTICAL NORMAL SHADES.** Session 62 refused terrain on two independent blocks and the
second was that `buildGround`'s `quad()` writes a hard-coded `(0, 1, 0)` normal, so a displaced
ground surface *"renders with no shading change at all"*. Session 63's mesh does not go through
`quad()` — but *"the lighting will read a real normal"* was an assumption about `lights.js`, not a
measurement of it.

`tools/slopeprobe.mjs` measures it **without adding anything to the scene**, because the subject is
already there at the angle the question is about: session 62's hill profile delivers band slopes of
14.8° / 18.9° / **7.2°** on the instance it picks, and `city:hills` carries a per-instance albedo,
so two facets of ONE hill differ in exactly one thing — the direction their normal points. No other
pair of surfaces in this world gives that: a field beside a hill differs in albedo, in porosity, in
material and in mesh.

```
  t = 0.42, wet, against the SUN.   flat ground beside it reads 108.07
  band          slope    delivered code value          swing   Pearson r
  crown         14.8°    99.4 .. 134.7                  40.5     0.906
  flank         18.9°    90.8 .. 138.1                  47.3     0.974
  SHOULDER       7.2°    94.2 .. 139.6                  45.4     0.942

  t = 0, wet, against the MOON.     flat ground reads 12.14
  crown         14.8°    10.8 .. 11.8                    1.0     0.887
  flank         18.9°    11.0 .. 12.3                    1.3     0.896
  SHOULDER       7.2°    11.1 .. 14.6                    3.5     0.683
```

**45.4 code values of 255 across the eight azimuths of one instance, correlating with
`max(0, n·l)` at r = 0.942.** And session 56's directional moon reaches the countryside and shapes
it: the two steeper bands correlate at 0.887 and 0.896 at midnight against the MOON's own bearing.
The shallowest slope at the darkest hour is where the shading is thinnest — 3.5 code values on a
12-value surface — which is the honest qualification rather than a blocker.

**AND THE CORRELATION CAUGHT A DEFECT IN THE INSTRUMENT ITSELF.** The first arm aimed 0.5 m off a
true nadir, on the argument that `lookAt` is singular when up is parallel to the view and 0.048° of
tilt is negligible. Both halves true, conclusion wrong: at that tilt the basis is not negligibly
wrong, it is ILL-CONDITIONED, and three's fallback orientation is not the one the probe then
assumed. The delivered curve peaked at sector 2 and the prediction at sector 4 — a **90° phase
offset** — at r = 0.001 / 0.219 / 0.384 on swings of 48.0, 38.7 and 40.5 code values. **A swing
that large with no correlation is not "the normal is not read"; it is an instrument reading the
right pixels and calling them by the wrong name.** CONTRACT §7.7 in as many words, inside the probe
written to answer a question about geometry. The basis is `lookAt`'s own arithmetic now and the
ground point a ray-plane intersection, which assumes nothing about which way is right.

`harness.info()` gains `moonAzimuthDeg`: the sun's pair has been there since session 3 and the moon
had only its elevation, so an instrument predicting a night surface's shading had to build a second
solar model to get the bearing.

---
## 1. THE FRAMES, AND WHETHER THE LAND RISES AND FALLS

```
  tools/shot-out/
    custom-s62-air-before-t0_42-wet.png   session 61, kept for the record
    custom-s63-air-after-t0_42-wet.png    session 63 at session 62's own pose — the
                                          ground is a function of position, the crops
                                          are ON it, and a hill rises out of it
    custom-s63-road-after-t0_42.png       a car's eye at (3 260, 1.6, 0) looking east:
                                          THE ROAD RISES AND FALLS WITH THE LAND. Dry,
                                          because at wet = 1 the lower half of that pose
                                          is a mirror and shows no road surface at all —
                                          which STATE 62 already recorded about that pose
    custom-s63-house4-t0_42.png           a hillside villa on ground that moves, with
                                          the city's skyline on the horizon behind it
    slope-t0_42-wet.png / slope-t0-wet.png   §0's own nadir frames
```

---
## 2. THE BRIEF'S FOUR PREMISES

### 2.1 *"the city assumes a fixed ground height"* — **TRUE IN SUBSTANCE, AND ITS ESCAPE CLAUSE FIRES WITHOUT DELIVERING**

There ARE already two per-record ground offsets and the brief did not know it: `g.yAdd` (session
62) and `f.lift` (session 48). Measured over cx, cz ∈ [−5, 5] at seed 1337:

```
  ground records carrying a non-zero `yAdd`            0 of 4 193
  features carrying a non-zero `lift`                  0 of 9 623
  registry claims with y0 === 0 exactly           20 270 of 22 221   91.2%
```

Both carry zero everywhere inside the city, and **`yAdd` — the one that applies to GROUND — is an
offset above a sixteen-entry CONSTANT TABLE rather than above a query.** So it is a second constant
terrain has to move, not a hook terrain can hang on. The premise stands, and the amplitude ramps
from zero at `CITY.extentEdgeM`. A 1 m rise of the ground rects alone would take the kerb from
0.16 m to 1.16 m, because the riser reads the rect at the top and a constant at the bottom.

### 2.2 *the slope arithmetic* — **RIGHT, EXCEPT ONE NUMBER AND THE CONCLUSION DRAWN FROM IT**

`1.757°` at A = 2.5 / λ = 512 (brief: 1.8), `31.53 m` for 7.1° (brief: ~32), `29 450` for the
annulus (brief: ~29 500) — all confirmed independently. **But a uniform 32 m grid over 8 km is
125 000 triangles and not ~250 000: exactly 2× too high, and the brief contradicts itself, because
its own annulus figure back-scales to 125 000.** The conclusion *"eats the new ceiling in one
item"* came from the doubled number.

**AND THE AMPLITUDE IS THE FREE VARIABLE, WHICH IS THE LARGER CORRECTION.** For a field of
amplitude A and period λ the maximum gradient is `2πA/λ`, so a given SLOPE is a RATIO — and buying
7° with a larger amplitude over a longer period costs COARSER stations, not finer:

```
  A =  2.5 m   λ =   128 m   stations ≤  32 m      (the brief's case)
  A =  8   m   λ =   410 m   stations ≤ 102 m
  A = 20   m   λ = 1 024 m   stations ≤ 256 m
```

So the slope is not what sets the station here. **The FIELD PATTERN is** — §5.

**A CAVEAT NEITHER OF US STATED:** `2πA/λ` is one-dimensional. A field summing two orthogonal
octaves reaches `√2` times it on the diagonal — and, in the other direction, a piecewise-linear
mesh never delivers the analytic gradient, only the chord. Both are why the delivered distribution
is measured below rather than predicted.

### 2.3 *"draws, not triangles, bind after the ceiling rises"* — **NEITHER, AND FOR TWO DIFFERENT REASONS**

The terrain is **zero new draw calls**, because `block:ground` — the 8 km earth plane — IS the
terrain mesh: same mesh, same material, same one call. And past `CITY.extentEdgeM` neither budget
binds at all: `wantedChunks` builds five chunks around the CAMERA and no gate route reaches within
1 696 m of that line, so **the countryside's own draw count is unmeasured by anything in this
project.** What the terrain does spend is triangles, and it spends them on every route, because the
earth plane is resident everywhere — §5.

### 2.4 *"a mesh with real vertex normals shades"* — **YES, r = 0.942.** §0.

---
## 3. ITEM 0 — THE RE-BASELINE, PER ROUTE, AND WHICH ROUTE THE CEILING IS ABOUT

The battery cannot complete on this machine (§8), so every route was run separately:

```
  route            draws   triangles   instances   note
  downtown_dense     324      1.97 M     267 191
  highway_speed      402      2.32 M     348 006   THE WORST CASE ON BOTH COUNTS
  night_rain         323      1.94 M     326 641
  player               —           —           —   times out past 10 min at this load
```

**`highway_speed` is the number STATE quotes and the number the ceiling is against, and nothing
before this session said which route either figure came from.** The twenty-day-old log the brief
cites (1.44 M / 431 draws) is not a different world and nothing was eaten unseen: it predates
session 60's flank glazing and session 61's road markings. Session 62's 2.32 M / 402 reproduces
here to three digits and to the instance.

---
## 4. ITEM 2 — THE CALLERS, ENUMERATED BEFORE THE FUNCTION WAS WRITTEN

CONTRACT §9 rule 7 — one quantity measured from two datums with neither side checking the other —
has been found at least eight times, and this item is the most exposed surface in the project for
it. **90 distinct sites read or write a world ground height:**

```
  (a) already go through a query function, and follow for free            41
      city.js 15, streetlife.js 8, block.js 6, player.js 4, tools 5, traffic.js 2, harness 1
  (b) read a CONSTANT, and are latent defects                             49
      city.js 11, block.js 10, weather.js 10, river.js 7, traffic.js 5,
      camera.js 2, citygen.js 2, moving.js 1, occupancy.js 1
  (c) genuinely absolute and must not change                              11
      aircraft.js, altitudes drawn from a fixed 150–900 m band
```

**THE SINGLE CHOKE POINT** for every ground rectangle in the streamed city is one line —
`city.js` → `const y = (Y[g.yKey] ...) + (g.yAdd || 0);` — fed by 51 `yKey` sites.

**THE THREE WORST OF THE 49, NAMED SO THE NEXT SESSION DOES NOT HAVE TO FIND THEM.**

- **`traffic.js` writes every vehicle body, wheel and lamp at a y measured from zero with no ground
  query anywhere** — four y-writes, zero queries, where the signal MAST in the same file does call
  `groundYAt`. Latent only because traffic runs on lattice lines where the terrain is zero.
- **`weather.js` has its own shadow datum**, `const GROUND_Y = GROUND.carriageway`, with nine
  readers placing splashes, spray and streak recycling. Rain lands at y = 0 across the whole 8 km.
- **`player.js` has a SEVENTH ground query with a fallback of literal `0`**, distinct from
  `GROUND_Y.earth`'s −0.02 — two datums for "no ground here", in the module that walks on it.

**AND GROUND HEIGHT ALREADY CROSSED THE PURE BOUNDARY**, which nobody had written down: `citygen.js`
is `three`-free but not unit-free in y. `basinSurfaceAt` returns world-absolute metres, −10.90 at
the basin floor to −0.60 at its rim.

What this session wired: `block.js`'s earth branch and its main-street branch — the two constants
that held a second datum for a surface this same file emits.

---
## 5. ITEM 3 — THE MESH. THE EARTH PLANE IS THE TERRAIN

`block:ground` is a grid on `TERRAIN.stationM` = 32 m now, with per-vertex heights from
`terrainHeightAt`, per-vertex normals from `terrainNormalAt`, and a per-vertex tint.
**One mesh, one material, ONE DRAW CALL — met by not adding a mesh at all.**

```
  ramp 3 232 -> 3 424 m      station 32 m      tint ramp 64 m
  octaves 13 m / 1 024 m  +  5 m / 384 m

  terrainHeightAt inside the disc r <= 3 232, 32 017 samples   0.000000000 m
  relief                                                       30.6 m  [-15.8, 14.8]
  slope   p50 1.00   p75 1.64   p90 2.08   p99 4.54   max 6.30 deg
```

**IT IS SIGNED, AND SESSION 62's REASON FOR REFUSING THAT IS GONE.** Session 62 argued a
non-negative field was forced because the countryside's quads sit 0.160 m above the plane and *"any
corner that drops further puts `block:ground` through the field"*. True of terrain laid OVER the
plane. This one IS the plane, so there is nothing underneath to sink through and the land may fall
as well as rise — which is the operator's own test phrase for the session.

**THE T-JUNCTION QUESTION, WHICH KILLED ARM B, ANSWERED.** `splitQuad` splits on the WORLD station
lattice, so two quads that meet share their split vertices exactly. Where a flat span meets a split
one the vertices differ — harmless for the only reason it can be: **both sides are at exactly `EY`
there**, because the split only happens outside `rampStartM` and inside it the surface is flat.
That is session 62's own argument running the other way, because the surface it applies to is flat.

**THE COST, AND THE FIRST ARM WAS 2.1× IT.** The flat early-out asked whether the ENTIRE span was
inside the flat disc — and a cut-walk span runs from −E to +E at every x, so it never is. Every one
of the ~700 x-intervals split its full 8 km height into 250 cells: **2.32 M → 2.57 M, +252 732
triangles**, where the countryside alone wanted 37 000. The disc is convex, so a span crosses it in
exactly ONE interval and that interval is flat by construction and needs no vertex in it.

```
  highway_speed, delivered      before     2 320 000     402 draws
                 first arm      2 572 732      +252 732
                 SHIPS          2 442 378      +122 378   402 draws, unchanged
  ceiling (the operator's, §7)             2 630 000
  headroom left                                187 622   7.7%
```

**THE HILLS: THE GROUND WAS THE WRONG THING TO MOVE.** A dome is one instance from ONE base height,
so ground that moves under its 110–435 m footprint floats its rim on one side and buries it on the
other. Four arms tried flattening the ground under it and each failed on a different geometry the
ring already has — the ramp varying under a pad (**12.99 m of |h| inside the city**, where the
design guarantees zero); a wood taking a pad from its own crown (**6.34 m**); the pad's blend
running UNDER the dome so the rim sat on the landform after all; the push using `foot` where the
ellipse reaches `foot·ecc` (**17.60 m**); and a massif union that collapsed 128 crowns into 2.

**A hill in rolling country is cut into the slope — buried uphill, standing clear downhill.** So
the DOME moves: its base is the LOWEST terrain height around its own rim (64 samples) and its drawn
height is raised by the sink, so it still stands `h` above the ground at its own centre and its rim
can never float.

```
  rims FLOATING above the ground   43 of 8 304, worst 0.0386 m
                                   — under the 0.05 m every join here is built with
  buried                           p50 2.14   p90 8.65   max 17.87 m
  sink (drawH − h)                 p50 2.71   p90 6.93   max 8.93 m, against h p50 39.2
```

That deleted the massif union, the pad and a hill re-phase with it: `hillMasses` draws the same
numbers in the same order as session 62 and the population is unchanged.

---
## 6. ITEM 4 — RECONCILING THE PLANAR CLAIMS. THREE POPULATIONS, THREE ANSWERS

**(a) THE ROAD FOLLOWS THE LAND IN SECTION AS WELL AS IN PLAN.** The ribbon is already tessellated
at `EXIT_ROAD.stationM` = 8 m through the curve, four times finer than the terrain's 32 m station,
so it does not step. The height is taken at the CENTRELINE and applied across the carriageway, so
the road is level across its width and rides the land along its length — which is what a road is.
`blockSurfaceAt`'s main-street branch answers the same number, so the drawn road and the walked one
cannot disagree.

**(b) THE 49 FIELD PARCELS CANNOT RIDE IT, AND THE NUMBER SAYS SO.** A planar parcel of length L on
gradient g stands `L·g/2` off the ground. Over the rim's own parcel widths (80–320 m) and the
delivered gradient, 126 samples:

```
  p50 1.96 m     p90 4.37 m     max 7.26 m
```

against the 0.05 m every join in this project uses, and a 1.8 m hedge. **So the crops moved onto the
mesh** as a per-vertex tint, read from the same `farmCrop` at the same world lattice — the parcel
pattern is unchanged and only the surface carrying it moved. **The boundary is now soft over one
32 m cell, and the hedgerow standing on it is what the eye reads as the line.** What stays a
rectangle is everything small enough to be a terrace — verge, lay-by, farm yard, house plot — each
taking `yAdd` from the terrain at its own centre, which is session 62's own *"this vocabulary
expresses a terrace and not a slope"* used where it is exactly right.

**AND IT CLOSED SESSION 62's DEFERRED ITEM 3a FOR NOTHING.** STATE 62 §4 recorded that the base
earth past the city was `GROUND.earthAlbedo` — the area-weighted mean of the CITY's surfaces,
*"correct where it stands in for city and wrong where it stands in for land"* — and that closing it
*"means a per-vertex colour on the earth plane, which needs the plane tessellated in z"*. It is.

**THE COLOUR RAMPS FASTER THAN THE HEIGHT, AND THE FIRST ARM SHARED THE RAMP.** `rampM` is 192 m
and is set by the hills; using it for the tint put the ground at the city's edge at **6%** of its
crop colour, so a car's eye at x = 3 260 saw the city's own pale grey where session 62 had a field.
Height and colour are two quantities and only one has a geometric constraint: `tintRampM` is 64.

**(c) THE HOUSE PADS ARE WHERE THE TERRACE IS RIGHT**, and they take `yAdd` from `groundHeightAt`.

**(d) THE VILLAS' YAW GAINS ±22°.** *"Worst dot product over all 29: 1.000000"* was offered by
session 62 as evidence the facing was right and is also the defect — twenty-nine houses aimed at
one point read as a dish farm rather than as houses.

**AND THE EMISSIVE PATH IS COSTED AND NOT BUILT**, which the brief permits. `put()` writes an
albedo and a roughness into an instanced body mesh and `materials.facade` never sets an emissive,
so `instanceColor × black = 0` and a feature physically cannot glow. Three options, measured:

```
  (a) push the villa's glass into the chunk's own `windows` array   +1 per villa chunk, up to +6
      — every villa chunk has zero buildings, so that mesh does not exist and pushing creates one
  (b) a second emissive body mesh per chunk                          strictly worse than (a)
  (c) push it into `flankQuads`, which merges CITY-WIDE into
      `city:flank` on `materials.window` — the identical 220-nit
      tungsten emitter                                               +1 FOR THE WHOLE COUNTRYSIDE
```

**(c) is the answer and it is two array pushes.** And the draw budget the brief named does not bind
it: no gate route makes a villa resident, so 402 of 440 is the wrong budget to spend against.

---
## 7. THE TRIANGLE CEILING — 2 630 000, AND IT IS THE OPERATOR'S DECISION

**RECORDED WITH THAT PROVENANCE SO NO FUTURE READER THINKS A SESSION MOVED ITS OWN CEILING.**
STATE 57 §0.1 derived 2 630 000 and session 57 refused to apply it to itself under CONTRACT rule 5;
sessions 58–62 each carried it as *"still awaiting the operator"*. The session-63 brief grants it
in as many words. The same is true of arm A over arm B: the operator chose it, not this session.

**IT DOES NOT BREAK THE DETECTOR THE OLD NUMBER WAS CALIBRATED AS, AND THAT WAS MEASURED RATHER
THAN ASSUMED.** 2 360 000 was the geometric mean of a working city (2 086 042) and one with
`CITY.detailRadius = 5` (2 666 516) — a LOD-failure detector, equidistant in RATIO from a false red
and a false green. Re-measured this session in a worktree at HEAD, same route, same seed:

```
  working                       2 442 378 tris    402 draws
  detailRadius = 5 (defeated)   3 170 000         416
  ratio                             1.298                (session 37 measured 1.278)
  geometric mean of the pair    2 782 500
  the operator's number         2 630 000    1.077x working, 1.205x below defeated
```

**So the granted number is STRICTER than session 37's own symmetry rule would give.** The
`drawCalls` ceiling of 440 also still discriminates: 402 working against 416 defeated.

---
## 8. GATE STATE

```
  gate            exit   verdict   seconds  load1 in   out
  parsecheck         0     GREEN       3.5     4.64    4.67    120 files, contract-clean
  faultcheck         0     GREEN      16.9     4.67    4.70
  lookcheck          1       RED      47.9     4.70    4.03    THE IDENTICAL THREE
  windcheck          0     GREEN      37.0     4.03    4.25
  inputcheck         0     GREEN      15.5     4.25    4.05
  gateaudit          1       RED      75.1     4.05    3.80    the carried control + ONE OF MINE
  citycheck          1       RED     120.1     3.80    3.61    IDENTICAL TO SESSIONS 57-62
  perfcheck          2       RED      27.7     3.61    3.80    the browser died — re-run per route

  4 of 8 RED — the same four as sessions 53-62. NOT ONE NEW RED GATE.
```

**`lookcheck` IS RED ON THE IDENTICAL THREE** — `distinct:midnight|dusk` **0.02838**, session 62's
figure to five decimal places, plus `facadeAlbedo` and `facadeNeighbours` at dusk. Both eyes stand
inside 400 m of the origin, where the terrain is exactly zero, so **the ground moving could not have
moved this band and did not.**

**`citycheck` IS BYTE-IDENTICAL TO SESSIONS 57–62** on all four reds — clumping CV **0.393**,
**5** delivered overlaps, **2 of 2 647** signs inside a building, **1 004 of 284 918** bare
walkable samples.

**AND `gateaudit` CAUGHT MY OWN THRESHOLD CHANGE, INSIDE THE SAME BATTERY.** Moving
`budget.json`'s ceiling to 2 630 000 and not the copy in `HUD.budgets` failed
`perfcheck --falsify`'s good fixture, naming the key and both values:

```
  ✗ HUD.budgets disagrees with budget.json ceilings on 1 of 6 keys —
    triangles: HUD 2360000 vs budget 2630000
```

That check exists because CONTRACT §9.1 records *"a table in a budget file and a table in a module
is exactly the arrangement in which `pierEvery: 34` sat beside `i % 3 === 0`"*. **It is the one
check in this project written for exactly this drift and it fired on the first change that could
cause it.** The copy is in step and `gateaudit` re-run afterwards is back to its single carried
`control failed`, with `perfcheck --falsify` at 74/74.

**`perfcheck` DID NOT FINISH — the browser death, for the third session running**, at 27.7 s.
Re-run per route, as sessions 62 and 63 have both had to:

```
  highway_speed   402 draws   2 442 378 tris   348 006 inst   THE WORST CASE ON BOTH
```

**THE TRIANGLE CEILING IS NO LONGER BREACHED**: 2 442 378 against 2 630 000, 187 622 of headroom.
`drawCalls` is unmoved at 402 of 440 — the terrain is the earth plane and the earth plane was
already one call.

**WHAT I CANNOT TELL YOU IS WHETHER IT COST FRAME TIME.** `highway_speed`'s wall p95 read 12.60 and
12.70 ms earlier in this session and 14.80 in the final run, at `load1` 3.3–3.9 with a 1.5 ms
run-to-run spread. **+2.1 ms against a 1.5 ms spread is barely over the noise and CONTRACT §0.2
says a red absolute from this load is not a verdict** — so it is recorded as unresolved rather than
as a cost or as nothing. **There is a mechanism it could be**, and it is written down rather than
left: `block:ground` is `frustumCulled = false`, on the argument that *"the bound is the whole
world; culling it is a wasted test that can only ever answer visible."* That was right at 2 154
triangles. At 124 532 it means **the whole 8 km of terrain is submitted and vertex-shaded every
frame, including the four fifths of it behind the camera.** Making it cullable means splitting it
into tiles, which costs draw calls — 38 spare — and is the first thing to measure on a quiet
machine.

---
## 9. WHAT TO DO FIRST NEXT TIME

1. **THE 2 ms, ON A QUIET MACHINE, AND THE `frustumCulled = false` THAT MIGHT EXPLAIN IT (§8).**
   It is the only number this session could not resolve, and the mechanism is named. If the terrain
   costs frame time, tiling the plane is the repair and the trade is draw calls.
2. **THE 49 CONSTANT-READING GROUND SITES (§4), AND THREE OF THEM ARE NAMED.** `traffic.js` writes
   four vehicle y values with no ground query at all; `weather.js` carries its own shadow
   `GROUND_Y` with nine readers; `player.js` has a seventh ground query whose fallback is a literal
   `0`. All three are latent — traffic and rain live where the terrain is zero — and all three
   become defects the moment terrain reaches inside `CITY.extentEdgeM`.
3. **THE EMISSIVE PATH FOR A FEATURE, COSTED AT +1 DRAW CALL FOR THE WHOLE COUNTRYSIDE (§6).**
   `flankQuads` merges city-wide into `city:flank` on `materials.window`, the identical 220-nit
   tungsten emitter. Two array pushes. The 29 villas are dead at night and that was the point of
   putting them there.
4. **NOTHING PAST 3 232 m IS INSIDE ANY GATE, AND THERE IS NOW A GREAT DEAL MORE OF IT.** STATE 61
   §7 asked for a third `lookcheck` eye on the exit road and sessions 62 and 63 both built an
   instrument instead (`landprobe`, `slopeprobe`). The terrain, the crops, the hills' sink and the
   villas are all outside every assertion in this project.
5. **THE PEDESTRIANS FOLLOW THE CAMERA ONTO A HILLSIDE.** `custom-s63-house4-t0_42.png` shows the
   crowd standing on a hill flank 3.6 km from the city, correctly on the ground for the first time
   — which is the ground query working and the crowd's own residency rule not. It was invisible
   while they were buried.
6. **THE FIELD BOUNDARY IS SOFT OVER ONE 32 m CELL (§6b).** The hedgerow carries the line today.
   A crisper boundary wants per-triangle colour on a non-indexed mesh, which this geometry already
   is — the vertices of one quad could share a parcel's colour — at the price of a 32 m staircase
   instead of a 32 m gradient. It is a look decision nobody has taken.
7. **CARRIED, UNCHANGED**: the height law reads nothing at all (STATE 61 §4); the traffic has no
   lane that is not a lattice line while `EXIT_ROAD` is exactly the polyline it needs (STATE 61
   §5); `city.js`'s `unitHash` puts the multiplier inside the sine; the three chunk seams; the 53
   holograms; the school yard's 8 trees and the church square's 98.
8. **`decodePNG` RETURNS THREE BYTES PER PIXEL.**
