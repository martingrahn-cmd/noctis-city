# NOCTIS — STATE

*End of session 19. The operator walked the city and sent a list of twelve
items plus four carried ones. **The largest finding is that the ground datum was
never undeclared — the origin block has obeyed it since session 1 and exactly
one table disagreed with it**, and declaring it closed three separate defects at
once, including the kerb repair that session 18 proved was blocked. The "cube in
the carriageway" is not a stall: it is a road patch emitted as a 1.00 m tall box
standing half a metre proud of its own road, from a unit SCALE used as a
THICKNESS. Traffic stopped past its own line because the stop distance was
measured to the vehicle's ORIGIN and used as the distance to its NOSE. And the
lamp-bounce fix the brief asked for is real, correctly shaped, nearly free —
and worth **+0.12 stops against the +2.2 the night frame is short**, which is an
impossibility proof rather than a result.*

Read `CONTRACT.md` before this file, and before any source file.

---

## 0. The honesty line, first

**`npm run gates` is SEVEN OF EIGHT GREEN. `perfcheck` is red on six timing
assertions and the machine was at `load1` 4.20 against a bar of 1.6, so none of
those six is a verdict.**

```
✓ parsecheck   81 files — and it now counts CONTRACT §9's table itself
✓ faultcheck   7 cases
✓ lookcheck    all eight frames within budget, ZERO suppressions
✓ windcheck    677 meshes, 673 ok, 0 wound backwards, 4 controls
✓ inputcheck   all three devices deliver their own constants
✓ gateaudit    58 cases, 4 self-tests (perfcheck, citycheck, windcheck, inputcheck)
✓ citycheck    all six authored-city criteria
✗ perfcheck    6 timing assertions, AT load1 4.20 AGAINST A BAR OF 1.6
```

**What perfcheck actually reported, and which half of it can be read.** §9 rule
6's corollary is that *counts do not drift*, so the integers are evidence and the
milliseconds are not:

```
                 draws   tris    instances   froxel margin   CPU p95    ceiling
downtown_dense    325   1.20M     116 491     52 of 96      12.70 ms    12.0  ✗
highway_speed     428   1.39M     158 125     85 of 96      10.50 ms    12.0  ✓
night_rain        332   1.20M     143 536     59 of 96      13.30 ms    12.0  ✗
player            318   1.19M     116 491     56 of 96      13.30 ms    12.0  ✗
```

`highway_speed` holds the draw-call ceiling at **428 of 440**, which is the one
number this session could have broken and did not — every piece of new content
(the roofscape on the outer ring, the crowns, the aviation beacons) rides in
meshes that already existed. Triangles 1.39 M of 2.00 M. Zero swap violations.

**Two of session 18's carried reds are now green.** `downtown_dense` mean
luminance was 0.0653 against a floor of 0.08 and reads **0.1377**; `night_rain`
reads 0.0819 against the same floor, margin 0.0019 (it was 0.0032 — *tighter*,
and that is the one number in this file moving the wrong way). The `player`
route's two timing reds are unchanged in kind.

**`tools/quiet-gates.sh` with the app closed is still the only thing that can
close this, and it is still the operator's.** Two orphan vite servers were
resident at the start of this session — one five hours old from session 18, one
35 minutes old — and **this session could not kill them: the environment refused
the `kill`.** They do not collide with any gate's port (the gates use 5179–5311
and the orphans held 5173/5174), so they cost memory and load rather than
correctness, but they are two of the reasons `load1` sat at 3.4–4.2 all evening.
Kill them before running the quiet battery.

**Nothing was weakened to pass.** No floor moved, no assertion was deleted. One
correction was refused on an arithmetic impossibility proof and is recorded as
such (§4).

---

## 1. Item 1 — the ground datum, and it was already declared

`src/core/constants.js` → **`GROUND`**. **y = 0 is the carriageway surface.**

**The finding is the direction.** STATE 18 §7.2 recorded that "`y = 0` is the
de-facto ground datum of every object in the project — wheels, pedestrian feet,
prop bases, lamp columns, stall bases, signal masts — and the ground quads are
the only surfaces that are not at it." Half of that is wrong in the useful
direction: **`block.js` has put the origin block's carriageway at exactly
`y = 0.0` since session 1**, over an earth plane at −0.020, with its pavement at
`BLOCK.kerbHeight`. The origin block obeys the datum. `city.js`'s `GROUND_Y` was
the one table that did not, and it disagreed by exactly the z-fighting offset it
was built from.

**So the repair was to move one table, and it closed three defects at once:**

```
                            before      after     what it was
carriageway (NS / EW)   0.020/0.021   0.000/0.001  the datum
pavement    (NS / EW)   0.030/0.031   0.160/0.161  BLOCK.kerbHeight above it
earth plane            −0.020        −0.020        unchanged

160 vehicles                0.020 m sunk into their own road   →  0.000
the streamed kerb           0.010 m  (BLOCK.kerbHeight is 0.160) →  0.160
the 98.5 m pavement overlap 0.130 m step at x = ±266.5          →  0.000
```

**The kerb trap dissolved, and the arithmetic is why.** Session 18 showed the
kerb repair blocked: pavement at 0.181 gives `0.181 − earth(−0.020)` = 0.201 m
against `PLAYER.stepUpM` = 0.200. That is right, and its premise is not — 0.181
is `0.020 + 0.161`, which STACKS a real kerb on the z-fighting offset instead of
REPLACING it. Moving the datum gives **0.160 − (−0.020) = 0.180 m ≤ 0.200**,
clear by 0.020 (1.11×). It needs no new evidence at all: the origin block has
delivered exactly that 0.180 m step at the edge of its own pavement since
session 1 and `walkprobe` has walked it.

**A datum is what a query is measured FROM, and is not a substitute for one.**
Declaring it makes y = 0 correct for anything on a CARRIAGEWAY — the traffic,
and nothing else. Everything on a PAVEMENT was 0.030 m out and would have been
0.160 m out, i.e. **the declaration makes the error eight times larger for those
objects**, so the nine placement sites had to ship in the same change:

| what | now reads |
|---|---|
| 360 pedestrians | `city.groundYAt`, per agent per frame |
| stalls, their glow strips, their work lights | `city.groundYAt` once, at placement |
| props (1 596 delivered) | `city.groundYAt` once, at chunk build |
| streamed lamp columns and bowls (181) | `city.groundYAt`, base and mounting height together |
| the origin block's 16 lamp columns | `block.js`'s own ground, hoisted out of the api |
| traffic signal masts (16 heads × 5 rows) | one query a frame at the camera |
| freestanding sign pylons and their posts | `city.groundYAt` |
| the river's promenade, bridge carriageway and bridge footway | `GROUND` |
| `weather.js`'s private `GROUND_Y = 0.02` | `GROUND.carriageway` |
| `camera.js` → `ROUTES.player.eye` | `GROUND.pavement + 1.74`, was the literal 1.77 |

**One function, and it is the only copy.** `city.worldSurfaceAt(x, z)` is the
maximum over the streamed quads, the origin block and the river's decks.
`player.js` had carried its own max-over-three since session 17 and now calls
this; `city.groundYAt` is the same answer as a bare number. Two implementations
of "which surface am I on" would fail as *the walker standing on one surface and
the crowd beside them standing on another, in the same frame, both looking
correct*.

**What it cost to make it callable 360 times a frame:** a union AABB per chunk
(32 bytes) that rejects eight of the nine neighbours in four comparisons, and a
preallocated result. The remaining allocation is `block.surfaceAt` and
`river.surfaceAt`, which still return literals — about 720 short-lived objects a
frame. Not measured in isolation; the diagnosis's estimate for the un-optimised
path was 0.37 µs/call.

**One ordering change this forced:** `buildGround` is now the FIRST thing
`buildChunk` does, because the lamps and props in that function have to be able
to ask how high their pavement is, and a query cannot answer before the surface
exists. `buildingKey`/`buildingGround` make the chunk being built visible to the
query before it is resident — four lines, so that the chunk builder goes through
the same `worldSurface` the player and the crowd use rather than a second height
lookup written locally.

---

## 2. Item 9 — the cube in the carriageway is a road patch, and it is a unit scale

`src/modules/city.js`, the road-patch emitter. The call was

```js
setMatrix(x, 0.025, along, 3 + (i % 3), 1, 5 + (i % 4) * 2.5, yaw)
//                                      ^ sy
```

Every other `sy` in that file is **a length in metres** — a cornice is
`era.cornice`, a building is `bld.height`. This one was a **unit scale**.
`geometries.box` is a unit box, so `sy = 1` is a one-metre slab:

```
y ∈ [0.025 − 0.5, 0.025 + 0.5] = [−0.475, +0.525]
→ 0.505 m proud of its own carriageway, 3 to 6 per `patched` chunk,
  3–5 m wide, 5–12.5 m long, at a shallow angle to the kerb
```

A dark asphalt slab half a metre out of the road **is** a cube in the
carriageway, and traffic drives through it because a patch is not an occluder.
Now `PATCH_THICKNESS_M = 0.01` with the centre derived from it and from the
datum. **The centre was always right** — 0.025 is `roadNS(0.020) + t/2` for
exactly the 10 mm this was meant to be — so the arithmetic that would have
exposed it had been done correctly one argument earlier, in the same call. §9's
table, row 19b.

`citycheck` reports **0 of 1 596 props inside a building footprint**, so the
prop scatter itself is clean; the carriageway obstruction was never a prop.

---

## 3. Item 7 — the stop line, and the brief's premise is half wrong

**`STOP_LINE` was already `roadHalfWidth + 1.5` = 9.0 m from the junction
centre** — 1.5 m short of the near kerb, which is what the brief asks for. The
error is one step further in: `toStop` is the distance from the vehicle's
**ORIGIN** (its body centre) and was used as the distance from its **FRONT**.

```
front at 9.0 − len/2, near kerb at 7.5     past the kerb
  wedge  5.40 m  →  6.30            1.20 m
  pod    3.70 m  →  7.15            0.35 m
  van    6.00 m  →  6.00            1.50 m
  hauler 9.60 m  →  4.20          **3.30 m**, 80% into the kerbside crossing lane
  moto   2.20 m  →  7.90           −0.40 m, the only type that was right
```

Fleet-weighted mean length 5.148 m, so the typical nose stopped **1.07 m** past
the near kerb, and because the car-following model is correct the leader's error
shifts the whole queue forward by it.

**The same file already knew the difference** — car-following subtracts both
half-lengths, the camera-as-obstacle rule subtracts half the camera's — and the
signal stop subtracted nothing. **The signal masts were the independent
witness**: `signalApproaches` puts each head at `STOP_LINE` under a comment
saying that is "where the vehicles are already stopping", and a stopped hauler's
nose was 4.8 m past its own signal head. That comment is now true.

**One quantity, in the lib both modules import.** `citygen.js` →
`CITY.stopLineFromJunctionM`, read by the braking constraint, by the signal head
placement and — when the markings are written — by the painted line. `city.js`
cannot import `traffic.js` (§2.2), so the lib is where a shared number can live.

**The free gate is built and not yet asserted.** `traffic.stats()` →
`worstStopLineM`: the distance from a *held* vehicle's front to its own stop
line, worst over the run. Positive is short of the line; **negative is a
defect**; `Infinity` means no vehicle has been held at a red yet, which is not a
pass. Only vehicles WITHOUT permission are counted — one that has been granted
the junction is supposed to drive through it. **The assertion in
`tools/budget.json` is the next session's five minutes.**

---

## 4. Item 10 — the lamp bounce is real, and it is 5% of the problem

**Built:** `CANYON.facadeLampShare = 0.1002`, one term in `canyon.js`'s
`computeRadiance`, three multiplies and three adds per sky rebuild. Nothing
reaches the bake; the field stores transfer and this changes what it is
multiplied by. Delivered at boot, printed as three terms rather than one sum:

```
canyon facade radiance, +X wall: total 10.8277 cd/m²
  = emissive 2.4905 + LAMPS 0.1864 + sun and sky, the remainder
    (16.0 lx road × 0.1002 = 1.603 lx on the wall)
```

**The share is derived, not chosen.** Integrating this project's own optic —
`luminaire.js`'s distribution with the elliptical shaping `tan 68°/tan 46°` =
2.391 — over its own street geometry (head at 8.08 m, 6.7 m off centre, facade
at 11.7 m, 30 m staggered pitch, 70.8 cd of isotropic spill) gives
`E_road = 24.58 lx`, `E_facade = 2.464 lx`, **ratio 0.1002**. A semi-cutoff
optic over a 15 m carriageway puts a tenth as much on the wall as on the road,
and above lamp height it contributes *exactly nothing* by construction.

### 4.1 And it cannot pay for the lamp-bowl correction. This is arithmetic.

The brief's plan was: put the replacement energy in first, then correct
`LIGHT.streetlampNits` 9000 → 1952. Session 18 measured that correction at
**12.15% → 3.26%** of Zone III–VII mass, i.e. **−8.89 points**.

```
what the lamp term delivers        +0.19 cd/m² on a facade at 2.2
                                   = +8.5%  =  **+0.118 stops**
what the night frame is short      median code 24, Zone III at code 60
                                   =        **+2.2 stops**
```

**+0.118 stops is not 8.89 points**, and the ceiling is structural rather than a
tuning failure: lifting a facade one stop needs `E_facade ≈ 2.2·π/0.4` = **17 lx**
on the wall, which is the ROAD's own illuminance, and a cutoff optic delivers a
tenth of that *by design*. There is no lamp specification that closes it. This is
STATE 18 §3.2's proof about the sky term, arriving through the lamps instead.

**So `LIGHT.streetlampNits` stays at 9000 for a nineteenth session**, wrong as a
radiance and load-bearing as lighting, and what would pay for it is EMISSION —
not transfer. The derivation and both numbers are in `constants.js` beside the
constant.

### 4.2 The ground term was already there, and adding one would double-count

The brief asked for a lamp term on the ground as well. §9 rule 2, the same
quantity two ways:

```
sky LUT lower hemisphere      [0.155,0.145,0.125] × 16/π = [0.789, 0.738, 0.637]
block.surfaces.groundAlbedo × 16/π                       = [0.769, 0.718, 0.637]
```

**They agree to 3%.** The lamp bounce off the road is already in the frame
through `sky.setGroundLighting`. A second term would put the same light on every
soffit twice.

---

## 5. Item 12 — the condenser is lit, and no light can reach it

**Both premises in the brief are wrong, and the second is fatal to the obvious
repair.**

1. **The pool has 28 free slots, not 40.** `roleCensus` delivers traffic 96 +
   stall 12 + block 52 + lamp 196 = **356 of 384**. STATE 18 §7.3's "margin 40"
   predates the stall role, which takes 12 and says so in its own comment.
2. **No clustered light at the condenser can ever be assigned.**
   `lights.assign()` culls on `depth − radius > CLUSTER.far` = **320 m** before
   it claims a slot, and the condenser is **560 m** from the closest point on any
   route. Sixteen floodlights would be culled on every frame of every run. §9's
   table, row 19e — a registration count used as a per-frame slot count.

**So the floodlighting is emission, and the quantity that survives the lighting
design is the illuminance it would have produced.**

```
E = 20 lx        CIE 94, light surface in a light-surround urban district;
                 1.25× this project's own calibrated streetAverageLux = 16
ρ = 0.394        CITY_MATERIALS.concrete
L = ρE/π       = **2.51 cd/m²**   →  LIGHT.condenserFloodNits

against the road at ρE/π = 0.509           4.93×
against the shaft's delivered 0.034        **74×**
against the bright-pass onset (0.414 exposed at e ≈ 0.0141)   11.7× BELOW it
```

The last line is the check that says it is a lit surface and not a source: a
floodlit wall that blooms is a wall somebody made into a lamp.

**Delivered as two lathes split at profile index 4** (y = 43.33 m, a vertex both
halves share, so there is no seam), the lower one carrying `emissive` on its own
material clone — so the band is still concrete and still reflects the sun at
noon. **+1 draw call.** The tower now reads as curved from the ground; from the
elevated camera its base is occluded by the near city, which is why §8's numbers
do not move.

**Red aviation lights: 18 beacons, 0 cluster slots, +2 draw calls.** ICAO Annex
14 §6.3 intermediate levels at ≤ 105 m, so `ceil(260/105)` = 3 levels on the
condenser (6 + 4 + 4 lamps) and `ceil(186/105)` = 2 on the mast (1 + 3). The
mast's 1.2 m steel beacon cube — unlit since session 4 — keeps its housing and
gains its lamp. `citycheck`'s scene walk reports **`landmarkBeacons 18`**.

```
I = 2000 cd     ICAO Type B, medium intensity
A = 0.35²       the beacon box
L = **16 300 cd/m²**   → LIGHT.aviationRedNits
```

**Why this may be far above the bloom onset when the lamp bowl's 9000 is a
defect:** bloom energy is radiance × AREA. 18 boxes of 0.1225 m² at 16 300 is
**2.5%** of 98 bowls of 1.6115 m² at 9000. An obstruction light is supposed to be
a point of glare at two kilometres.

The flash is 2.0 s at 25% duty (ICAO's 20–60 flashes/min, middle), a raised
cosine rather than a square wave so a sub-pixel emitter does not step into the
TAA history in one frame, phased by a hash of each lamp's own position, and
integrating `time.now` — so `?paused=1` freezes it with everything else.

---

## 6. Item 11 — the roofscape existed, and its problem was kind

**Premise correction.** This city already had 2 476 roof boxes over the detail
ring — 2 to 5 plant units and a four-box parapet on every building over four
floors. A flat roof was never the problem. **Every one of them was one shape and
one colour**: a size-rolled rectangular box at albedo [0.3, 0.3, 0.31]. §7.2's
rule with a roof instead of a vehicle — a count of roof boxes says nothing about
whether the roof reads as a roof.

**Five kinds now, chosen by what they do to a silhouette rather than by what
they are:** `plantRoom` (wide, low, the existing box), `tank` (0.45 wide × 2.30
tall — the one kind that puts a vertical on a flat roof), `stairHouse` (the
building's own material carried up), `duct` (4.6× as long as it is high,
galvanised so a low sun finds it), `aerial` (0.10 × 3.60 — one pixel at 700 m,
which is the point). Aspect ratio is the quantity; a size roll cannot distinguish
kinds in a 3-pixel silhouette.

**And the roofscape is now built on every ring.** `if (detail)` wrapped the
facade, the ground floor *and* the roof plant, and `detail` is ring ≤ 4 against a
geometry radius of 5 — so **ring 5, 40 chunks, 148 buildings, 576 to 768 m out,
was a bare box plus a cornice. That ring IS the skyline.** The facade and ground
floor stay gated (nobody sees a window reveal at 700 m); a roof profile is
precisely what survives that distance. ~1 200 instances, ~14 000 triangles,
**zero draw calls** — they ride in the chunk's existing merged box mesh.

**`bld.crown` is read for the first time.** `citygen.js` has written
`crown: eraName === 'contemporary' ? rng.range(0.15, 0.45) : 0` since the eras
were added and **nothing in `src/` or `tools/` had ever read it** — §9.1's first
variant. It lands on exactly the wrong era: `contemporary` sets `cornice: 0.0`,
so the one era whose written identity is "a chamfered or stepped crown" was the
one era with no crown box at all. The gate is now the sum, and the width factor
is +1.6 for a cornice (which oversails) and −0.55 for a contemporary crown (which
is a chamfer and steps IN). `citycheck` reports **`crowns 497`**, up from 446 —
exactly the 51 contemporary buildings.

**Not done: roof signs, and the height spread.** See §9.

---

## 7. Items 3, 4, 5, 6 — the tools, and the pace

**`src/modules/ui.js` is the project's first UI surface**, and it is registered
only when `?ui` resolves true. `ui: -1` FOLLOWS `?player=1` (0 and 1 force it),
the same shape `fieldDrip` uses — so every gate renders the same `<body>` it has
rendered for eighteen sessions and no button reaches a screenshot. That is
CONTRACT §11's argument for the player, applied to a DOM overlay.

- **The map.** Drawn from `src/lib/citygen.js` — the same pure description the
  generator, the worker's bake and `citycheck` all read — so it cannot show a
  city different from the one being drawn, which a map built from resident
  chunks WOULD. Eight landmarks marked and named with their heights, the river
  from its own bank functions (not the envelope, which is a bound 41% too wide),
  three bridges, the viaduct's arc and piers, the origin block, the street grid,
  the camera and its heading, north, and a scale. 1 662 m across.
  **Click-to-teleport is REFUSED rather than snapped** when `city.walkableAt`
  says no — snapping would move the operator somewhere they did not click, and
  "it said no" is a better failure than "it put me somewhere else". `teleport()`
  now calls `post.resetHistory()`, which STATE 18 §7.6 recorded as missing.
- **The time menu.** The four presets are the gates' own times (midnight 0.0,
  dawn 0.25, noon 0.5, dusk 0.78), so the menu and the gates talk about the same
  moments. The rate is a **second rate on the one clock**: `time.setSunScale`
  multiplies the sun's advance only, so `now` — which traffic, weather,
  streetlife, the player and the beacons all integrate — is untouched. **Every
  rate sets `paused` explicitly, including the three that set it false**; there
  is no path through that handler that leaves the flag alone.
- **The arithmetic corrects the brief.** `dayLengthSeconds` is 1200 — a
  **20-minute day, already 72× real time**. "A full day in 12 minutes is 120×" is
  120× *real*, and against this project it is **1.667×**. The shipped default is
  already 0.6× of the requested fast setting; the interesting rate for looking at
  a dusk is a *smaller* number, not a bigger one.
- **Fullscreen.** The Fullscreen API, a button that releases the pointer lock on
  `pointerdown` so it can be clicked and `preventDefault`s so the click does not
  also reach the world. The hazard is not the API: below 3 686 400 device pixels
  `neverExceedNative` makes the internal buffer equal the drawing buffer, so on a
  1920×1080 dpr-1 display fullscreen shades **1.78×** more pixels than a 1440×810
  window. That is the operator's to spend and is written down beside the button.

**Pace.** `PLAYER.walkSpeedMps` 2.00 → **3.50**, `runSpeedMps` 3.50 → **7.00**.

```
                     2.00 m/s     3.50 m/s     7.00 m/s
one chunk   128 m      64.0 s       36.6 s       18.3 s
bridge to bridge 512 m 4 min 16 s   2 min 26 s   1 min 13 s
```

**The Froude bound was removed deliberately, not exceeded quietly.** 3.50 m/s is
1.71× `RUN_TRANSITION_MPS` = 2.048, i.e. **it is not a walk by this project's own
biomechanics**. The licence is that *nothing is derived from this number*:
`GAIT.walkSpeedMps` is an input to a model (step length, cycle frequency, bob)
and the player has no legs. It is a deliberate exaggeration recorded as one, the
same shape as the fleet's plan taper. The cost, named: 2.50× the crowd's mean,
so the player now overtakes visibly rather than slowly. `inputcheck` delivers
**3.474/3.500 and 6.942/7.000**.

`moveWithSlide` gained a substep of `radiusM` = 0.25 m, because at the loop's
clamped `dt` = 0.1 s a 7 m/s frame is **0.70 m** — the first displacement in this
project's history larger than the body making it. Cost: 1 query at 60 fps
(unchanged), 3 on a hitched frame.

**The fly camera is a first-class second mode**, on `F`, both from the same URL,
and the console says which mode is active on every toggle. CONTRACT §11's ONE
STATE rule is about the *controller* growing states; fly has no body, no ground,
no mask, no step height and no fall — it **deletes** rules rather than adding
them, and it shares every line of the input block. `flySpeedMps` = 24 is
`highway_speed`'s own rate, the one speed at which this project's streaming has
ever been deliberately stressed; `flyBoost` = 3 crosses the map in 15.6 s.

**Two silences closed.** `main.js` now logs one line naming `?player=1` when the
controller is absent — session 18 spent a whole session measuring an input layer
four ways against a walkthrough on a URL without the flag. And
`camera.js`'s free-look `pointerdown` now checks `driven`: it was calling
`setPointerCapture` on a pointer the player already owned, which threw
`InvalidStateError` on the very first click — the click that *acquires* the
lock. Not a try/catch; the correct behaviour is to not ask.

---

## 8. The frames, and the histogram

Same camera, before and after, `t = 0.0`:

```
                    pavement                     elevated
textured    9.96% → 10.45%  (+0.49 pts)     0.34% → 0.34%  (0.00)
crushed     1.75% →  0.90%  (−0.85)        35.85% → 35.64% (−0.20)
clipped     0.02% →  0.03%  (+0.00)         0.00% →  0.00% (0.00)
shadow     84.82% → 84.26%  (−0.56)        99.30% → 99.30% (0.00)
median code    25 → 26                          7 → 7
```

**The pavement frame moved the right way and the elevated frame did not**, and
both are honest. Half the crushed pixels on the pavement recovered with the
clipped fraction unchanged, which is the loop the brief asked for. The elevated
frame is a skyline of **unlit roofs against a dark sky**: the roofscape landed,
and at night a cluttered silhouette and a plain one are both black. §4's
impossibility proof and STATE 18 §3.2's are the same statement — **what moves
that frame is emitted radiance at scale**, and the only emission this session
added up there is 18 beacons.

The pavement pair is a *cumulative* before→after, not an isolated A/B of any one
change: it carries the datum, the kerb, the removed road slabs, the camera's
1.77 → 1.90 and the lamp term together.

Frames: `tools/shot-out/s19-{pavement,eleva}-{before,after}-t0.png`, plus
`s19-condenser-s12-t0.png` (the floodlit band from the ground) and
`s19-ui-{menu,map}.png`.

---

## 9. What the next session starts from

1. **`tools/quiet-gates.sh` with the app closed, and kill the two orphan vite
   servers first** (5173/5174; this session's environment refused the `kill`).
   Six perfcheck timing assertions are unadjudicated at `load1` 4.20.
2. **Assert `traffic.stats().worstStopLineM >= 0`** in `tools/budget.json` and
   `perfcheck`. The instrument is built; the assertion is five minutes. §3.
3. **Item 2, the viaduct — NOT STARTED, and diagnosed.** Its piers stand in the
   streamed north–south carriageway at x ≈ 0 (the arc runs down a chunk
   boundary, which the session-5 re-aiming argument never considered — it
   reasoned about the origin block's east–west street). Its deck ends at
   z ≈ −229 and +251, in streamed chunks nothing clips to. The river's session-15
   treatment is the pattern: an envelope the generators read. The pier-nudge and
   the building clip are the two halves worth doing first; deck traffic is a
   spline-network change and is honestly large.
4. **Item 8, vehicle light signatures — NOT STARTED.** Every vehicle has one
   stripe front and back while the bodies carry five types, twelve chroma
   clusters and four eras. Four axes at zero cluster slots: signature shape per
   body type, front colour temperature tied to era, tail hue, side markers, and a
   single headlamp on the motorcycle.
5. **Item 11's remaining two: roof signs and the height spread.** Roof signs are
   the highest-value emission left and cost no draw call (`city:signs` exists,
   the `roof` mounting exists). The height distribution is *uniform* on 12–64 m,
   sd/mean 0.423, capped at 66.22 — and the same file already applies a
   heavy-tail argument to density and never to height. A log-normal at median
   30 m, σ = 0.62 gives mean **36.4 m against the delivered 36.55**, i.e. the
   mean is preserved to 0.4% and the whole change is in the shape, with p99 at
   127 m. Clamp at 150 m: `LIGHTING.shadowExtent` is 170.
6. **Item 14, pop-in — NOT STARTED, diagnosis carried.** `seed()` scores its
   twelve candidate re-seat sites by `ahead` and takes the maximum, so a vehicle
   can materialise 14 m dead ahead in the camera's own lane. Frustum rejection on
   recycle, one file, no count changes.
7. **Markings.** The kerb half of that item is done (§1); the markings half is
   not, and `CITY.stopLineFromJunctionM` is waiting for the stop line to be
   painted from the same number the traffic brakes against.
8. **The condenser is absent from most of every route.** `wantedChunks` builds a
   Chebyshev ring ≤ 5 and the condenser's chunk is at ring 6 from
   `downtown_dense`'s and `night_rain`'s start — **it pops into existence as the
   camera crosses x = 256 m**. `citycheck`'s "8 visible from elevation" is
   geometric and says so in its own comment; it is not evidence of residency.
   The repair is owed a rendering fix first (the four lathes merged into one
   mesh), because `highway_speed` sits at 428 of 440 draws.

---

## 10. Known gaps carried forward

**Unchanged from s8–s18**: `stats().cutoffM` hard-codes 0.8, the headroom probe
inert, GPU timer queries advertised and never retiring (`starved 2157` this
run), `saturation-peak.png` overwritten every run, `$fovYDrift`,
`camera.setRouteAt(name, 1.0)` at the sky, rain streaks near-invisible wide at
night, `rain_spray` 0 static, right turns only, sun shadows to ~170 m, the bake
blind to elevated slabs, the PMREM hitch, the too-red dawn horizon, one worker at
queue depth one, the four island frontages overlapping at the corners, the far
half of the river handing back to the night sky past ~300 m, grime authored, the
near-field washboard on the water, the quay wall inside the walkable mask,
props absent from the walkability mask, the 3.5°–10.4° route camera pitch, the
frozen/running A/B (an eighth session undone), and the three level assertions
still a sample of one while every millisecond beside them is pooled over three.

**Resolved this session**: the 98.5 m pavement overlap's 0.130 m step (§1); the
1 cm streamed kerb (§1); the viaduct pier across both footways is *unchanged*
but is now understood (§9.3).

**New this session, all recorded above**: the road patch as a 1.00 m slab; the
stop line measured to the origin; `bld.crown` never read; the roofscape absent
from the ring that IS the skyline; the light pool's registration-vs-slot
conflation and `CLUSTER.far` making the condenser unlightable; the 28-slot
margin against STATE 18's 40; `river.js`'s three transcribed ground heights and
the 10 mm lip they left at every bridge approach; `weather.js`'s private copy of
one key of another module's ground table; `block.js`'s pavement box authored at a
literal 0.16 beside a configurable `cfg.kerbHeight`; and the session-18 `python3`
row counter that counts pipe-leading lines to end of file — correct only for as
long as §9's table stays the last table in the document, which is §9's own shape
inside the derivation printed to defend against §9.
