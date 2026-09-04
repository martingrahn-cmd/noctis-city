# NOCTIS — STATE

*End of session 79. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`, 17 d 2 h of
uptime — the same boot as sessions 47–79. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` RAN 2.75–4.85 THROUGH THIS SESSION***, over CONTRACT §0.2's bar of 1.6 for the nineteenth
session running. **No millisecond below is a verdict.**

Branch `claude/noctis-78-the-city`, continued off session 78's head. Four commits.

**A UI SESSION, AND IT COST NOTHING IN THE SCENE.** `highway_speed` came back at **405 draws and
2 592 572 triangles** — the same three figures session 78 shipped, to the digit. Everything below is
a 2D canvas, a DOM panel, and four counters.

---
## 0. THE HARBOUR, REACHED FROM THE MAP IN TWO CLICKS — AND IT IS DUSK, NOT MIDNIGHT

Press **M**. Click **harbour quay**. The player stands on the apron at **4 128, 2.117, −206**, four
kilometres from the origin block, looking east along the quay: three portal cranes on their rails,
the container stacks either side, open sea past the quay face. Press M, click **airfield — north
threshold**: 4 750, 10.292, 700, looking out over the threshold down a 3 000 m runway with the
terminal on the right and the hills past the coast.

**Neither place had ever been on the map.** The operator walked the running build and his own words
for why he had never seen them were *"det är långt att gå till dem"* — the map was built in session
19 when the city WAS the world, and sessions 62–77 put a countryside, 179 hills, an estuary, a
harbour and an airfield outside it without touching the one screen that could take him there.

**THE BRIEF ASKED FOR THE HARBOUR AT MIDNIGHT AND THE FRAME REFUSES IT.** Shot at `t` 0.0 the same
pose is very nearly black — a crane leg, one lit strip, nothing else. **`glow()` in `city.js` pushes
an emissive quad and no light candidate**: CONTRACT §9.3's fifth row, found in session 76 and still
unrepaired, so every quay flood, apron mast and approach light built since session 62 is a lamp that
is *visible and lights nothing*. Dusk is what shows the harbour, and the three affected destinations
carry `t = 0.78` with that sentence in their own `proves` field.

**ITEM 2c IS REFUTED BY THE SAME MEASUREMENT.** The brief: *"the airfield's approach row at noon
shows nothing; it wants midnight."* At midnight it shows nothing either — a horizon and four specks.
Same cause, and the repair is §9.3's fifth row rather than a time of day.

---
## 1. THE MAP COVERS THE WORLD, AND 8 km WOULD HAVE CLIPPED THE AIRFIELD

**THE EXTENT IS DERIVED, NOT CHOSEN, AND IT IS 9 821 m ACROSS.** `worldView()` in `ui.js` takes the
union of the city rim, the eight landmarks, the 179 hill footprints, the harbour, the airfield *with
its approach*, the exit road and the 22 villas:

```
  bbox      x [−4 063, 5 398]   z [−4 323, 4 210]
  centre    (667, −57)          half 4 731 + 180 of margin = 4 911
```

**IT IS NOT CENTRED ON THE ORIGIN, BECAUSE THE WORLD IS NOT.** Everything sessions 62–77 built is
east. Centred on the origin the half would have to be 5 398 to hold the airfield and 1 335 m of the
west edge would be empty skirt. **And the brief's 8 km is too small either way**: the platform runs
x 4 660 to 5 398 and the south approach row reaches z 4 150, so a map of ±4 000 m centred on the
origin clips the whole airfield.

**THE RELIEF IS ONE `terrainHeightAt` PER PIXEL AND IT IS WHAT MAKES IT A LANDSCAPE.** Exactly
0.000000 inside `CITY.extentEdgeM` and −70.9 to +106.0 m outside it, so the city reads as one flat
plate and the hills, the estuary's cut and the airfield's platform have shape. 512 × 512, cached per
seed: **181 ms once, 0.23 ms per redraw afterwards**, measured in the running page. 512 is derived —
the canvas caps at 1 100 px so a raster cell is 2.15 map pixels, and `update()` redraws every frame
the map is open, which is why it could not be a per-frame loop.

**THE SEA IS THE TERRAIN'S CONTOUR AND THE FLOOD FILL'S CELL, BOTH.** `river.js` draws one quad per
`seaCells` cell and lets the land occlude it, and the fill is *dilated by one cell on purpose*, so
drawing the cells alone would put 128 m of water on dry land. A pixel is sea when its terrain is
under `SEA.levelY` AND its cell is in the fill — the second half is what keeps an inland hollow from
becoming a lake, which is `seaCells`'s own first-arm defect.

**AND THE MAP COULD TELEPORT THE OPERATOR ONTO THE SEABED.** `city.walkableAt` blocks buildings,
landmark ground, the origin block and `inRiver`; it has never blocked the sea, because until this
session no map could put a click on it. Measured before the guard: a click at (4 500, −600) was
accepted and put the player at **y −60.451 m under 55 m of water.** Refused now, by the raster's own
pair rather than by `isSeaAt`, whose dilated cell would refuse 128 m of dry land.

Also on it now: the exit road with its three shifts and the bend at z −64.84, the harbour branch and
the airfield spur that both hang off the straight section at z −30.0188, the harbour's three
terraces with its cranes and sheds, the runway, taxiway and apron, both approach rows, the 22
villas, and a scale bar. The road lattice is **clipped to the city disc** — drawing an arithmetic
lattice over 9.8 km of countryside is the claim `traffic.js`'s signal loop made until session 75.

> **THE APPROACH ROWS ARE ASYMMETRIC THE OTHER WAY FROM THE OBVIOUS READING.** CONTRACT §3.1 is
> `−Z north`, so `runZ0` = 250 is the **north** threshold. The sea is north, so it is the north row
> that walks into the water and breaks at **14 masts of 30 at z −170**, against the south row's full
> 30 reaching z 4 150. Counted in Node against the generator's own break rule, because a threshold
> named by the wrong compass point is §9's shape with a bearing.

---
## 2. SEVENTEEN DESTINATIONS, AND FIVE OF THE FIRST SEVENTEEN WERE THROWN AWAY

Clicking a point on a map of a 9 821 m world means guessing: one map pixel is 19.2 m. A list means
arriving. Seventeen entries in two groups — **the world first**, because that is what the operator
has never seen — each a POSE and not a place, each stated with what it proves, each rendered and
looked at before it shipped.

```
  the world   harbour quay · harbour yard · airfield north threshold · airfield apron
              estuary mouth · hillside villas · the country road out
  the city    origin block · a trading street · condenser · stack · arch
              exchange · dish · mast · weir basin · the viaduct
```

**LOOK.md §7 SAYS DO NOT ADD A TWENTIETH LYING POSE, SO THE FIRST ARM WAS SHOT AND FIVE DIED:**

| pose | what the first arm delivered, and why |
|---|---|
| `arch` | poseprobe's **fullest** azimuth (0°, 84.1%) looks straight down the arch's own 118 m span and delivers a column. **A stand-off test answers "is anything in the way", never "is this broadside."** az 285 at 160 m is the arch. |
| `weir` | a bowl cannot be seen into from outside it. poseprobe's best pose, 320 m out at its ONE clear azimuth of 24, is a street with people on it. The arithmetic: an eye at 1.74 over a 0.4 m lip does not reach a floor 10.9 m down until 424 m past it, and the bowl is 210 m across. **On the rim** shows the basin. |
| `viaduct` | 240 m east on its fullest azimuth is a shopfront wall. Under the deck at 110 m from the south is the viaduct. |
| `trading-street` | a first arm aimed EAST across a north–south street and delivered a blank brick wall with pedestrians against it. `camera.js` `SHOTS.trade`'s own target — azimuth 280, nine clear of thirty-nine — is the street. |
| `mast` | a 91-member lattice at midnight is a black sky with a city glow under it. Dusk is a mast. |

**GROUND HEIGHT ON ARRIVAL — ITEM 2d, MEASURED BOTH WAYS.** The same query before the world arrived
and after, over all seventeen:

```
  harbour quay          pre −10.20 m   arrived   2.117 m  (apronY)     12.32 m out
  airfield threshold    pre   7.60 m   arrived  10.296 m  (level)       2.70 m out
  the other fifteen     pre == arrived
```

`teleport(x, null, z)` falls through to `block.surfaceAt` = `GROUND.earth + groundHeightAt`, a PURE
function, so ordinary terrain is right on the first frame with nothing streamed. **Only a BUILT
PLATE is wrong**, because a plate is a `rects` entry that arrives with its chunk. Those two
destinations therefore carry `harbourSite.apronY` and `airfieldSite.level`, which are seed-derived
and camera-independent, and `player.js`'s `player:bigstep` warning — *"a spawn or a teleport into
something solid"* — never fires.

**`player.teleport` TAKES A PITCH NOW.** A destination verified with a `--target` and delivered with
a yaw alone is a different pose from the one that was shot. Clamped by the same `PLAYER.maxPitchRad`
the mouse is.

**`poseprobe` WAS CALLED** — once per landmark, and the eye each city destination carries is a pose
it returned as clear, with its own advisory `fill` quoted beside it. It is **still not called by the
pose generator**, which is CONTRACT §9.3's seventh row and a separate item. Three of the seven have
narrow clear runs worth naming: **the weir has exactly one clear azimuth of twenty-four** (3 clear
poses of 79), the condenser three, the arch four.

**AND ONE LIMIT IS WRITTEN DOWN RATHER THAN FIXED.** A destination's `feetY` is the TERRAIN and not
the landmark ground: on the weir's rim the live surface is −0.80 m and the closed form says −0.02.
The teleport is unaffected (it passes `null` and the live query answers); the error reaches only the
pitch, at 0.78 m over a 208 m sightline = **0.21°**. Fixing it means giving that function a second
ground model, and CONTRACT §9.1 is a list of what two ground models cost.

---
## 3. THE PLAYER MARKER WAS ALREADY THERE — ITEM 3's PREMISE IS FALSE

Session 19 built both halves: a ring at `cam.position` and a whisker off `cam.matrixWorld`'s own
basis rather than off a stored yaw. What changed is the map under it — at 11.2 m a pixel the eye was
the only mark on a 1 692 m map; at 19.2 m it shares the frame with seventeen cyan destination ticks
and read as an eighteenth. The ring is filled, the whisker is 22 px, both carry a dark halo, and the
eye's own coordinates are printed in the footer, which is the part that actually was missing: on a
9 821 m map *"where am I"* is a number as well as a dot.

---
## 4. THE SIGNALS — RIGHT PREDICATE, WRONG POINT, AND THE POINT THAT IS WRONG IS HIS

His words: cars stop in the middle of the road, and it goes red for them AFTER they have passed, so
they stop at the next line, which is the far side of the junction.

**THERE IS NO FAR-SIDE LINE.** `nextJunctionAhead` returns only lattice nodes AHEAD in `dir` and
`− STOP_LINE` always subtracts back toward the vehicle, so a +x driver's bar is `jx − 9.00` and
`jx + 9.00` belongs to the opposing approach and is unreachable by any expression in the file.
`toStop = 0` puts the NOSE on the bar for every body length — which is `stoplineprobe`'s own
`past junction min −15.000 median −11.700 max −10.100` in closed form: `−(9.00 + len/2)` for bus,
wedge and moto.

**AND HE IS RIGHT THAT CARS STOP IN THE MIDDLE OF THE ROAD.** `node tools/stoplineprobe.mjs`, 25 920
frames, 432 simulated seconds:

```
  vehicle-frames stopped with body inside a 15 m junction box   2 794
    of those, HOLDING PERMISSION                                2 794
    of those, ORIGIN past the junction centre                       0
  episodes                                        17, longest 151 frames = 2.52 s
  deepest    a 12 m bus, nose 3.551 m past the junction centre, toStop −12.551 m
```

**EVERY ONE OF THE 2 794 IS INVISIBLE TO THE GATE, BY THE GATE'S OWN FILTER.**
`stats.worstStopLineM` is written only inside `if (veh.cleared !== nextJ)`, and a vehicle that
entered on green KEEPS permission through the box — `traffic.js` says so on purpose, *"the one thing
worse than entering on red is stopping in the middle"*. So **the statistic that exists to find
vehicles stopped in the wrong place excludes, by construction, every vehicle that stops in the wrong
place.** It reads `raw 0  GREEN`.

**IT IS THE SAME DEFECT AS THE −10.62 m, AND THAT FIGURE IS NOT IN STATE.md.** It is
`tools/budget.json:150`, `$minStopLineM_MEASURED_RED`, and **session 21 already named the
mechanism**: *"VEHICLES QUEUE INTO THE JUNCTION BOX. Car following stops a vehicle behind the one in
front wherever that is, and nothing stops it entering a box whose exit is blocked."* It asked for two
things — a re-measurement at dt = 1/60 (the −10.62 was taken at dt = 0.1 because SwiftShader could
not finish one) and then an exit reservation. **This is the re-measurement, four sessions late. The
reservation is not built** — item 4e: a reservation on the box EXIT is a second permission keyed to
a second junction plus a release path for every way a vehicle can leave one, which is a traffic model
change and not a wrong datum.

**A SECOND MECHANISM, AND IT IS §9.3's CLASS EXACTLY.** 3 131 vehicle-samples held at a bar for a
junction whose **crossing road does not exist** — one node, **(0, −384)**, where the east–west road
is in the river channel. Three readers of *"is there a junction here"*: the signal HEAD asks
`landmarkOccupies` (session 35) and `cityExtentAt` (session 75); the PAINT asks `onRoad` before it
draws a bar; **the braking point asks nothing at all.** A car stopped at a red for a crossing that is
a hundred metres of open water is the operator's sentence with a different mechanism under it.
Counted and not repaired: making `nextJunctionAhead` skip a node needs the vehicle's axis and line
and a loop, which changes what every vehicle does.

**ITEM 4b IS REFUTED.** The brief says the signal loop *"HAS NEVER ASKED `cityExtentAt`"*. It asks it
at `traffic.js`'s head loop, added in session 75, with a paragraph about the airport apron.

**ONE THING WAS REPAIRED AND IT IS A WRONG DATUM.** `seed()` nulls `veh.cleared` on a re-seat under a
paragraph — *"a junction id is a world coordinate, so a stale one can equal the id of the junction it
has just been re-seeded in front of; that is permission to run a red light, granted by a coincidence
of arithmetic."* **A turn exit re-seats a vehicle onto a different road in exactly that way**:
`axis`, `line`, `dir` and `s` all change meaning and `lastJ` is nulled for it, and `cleared` was
carried over. The coincidence is arithmetic — the exit lands at `entryLine·128 + exitDir·13.25`, so
the two are equal whenever `jLine === entryLine + exitDir` — but **measured it is LATENT: 0 of 58
turn exits** on this route, because the camera walks one axis and the two indices stay apart.
Counted before it was fixed, so the fix's reach is on the record and `stats.staleTurnPermission`
stays.

**ITEM 4d — PEDESTRIAN SIGNALS — WAS NOT REACHED.** §7 item 2.

---
## 5. THE BATTERY, RUN TWICE

**THE STANDING FOUR ARE STILL FOUR, AND A FIFTH RED IN THE FIRST BATTERY WAS THE MACHINE.**

```
  gate            exit   verdict   seconds  load1 in
  parsecheck         0     GREEN       4.1      3.38
  faultcheck         0     GREEN      29.1      3.38    7 cases; exit 2 in battery 1, see below
  lookcheck          1       RED      52.4      4.45    FOUR, not three — §5.1
  windcheck          0     GREEN      44.5      4.35    574 meshes, 570 ok, 0 wound backwards
  inputcheck         0     GREEN      17.7      4.81
  gateaudit          1       RED      80.7      5.17    downstream of lookcheck, as always
  citycheck          1       RED     129.8      4.02    BYTE-IDENTICAL TO SESSION 78
  perfcheck          1       RED    1169.1      4.19    15 violations, NONE of them triangles
```

The table is the SECOND battery, entire. The first started at `load1` 3.33 and came back **5 of 8
red**; the fifth was `faultcheck` and it was the machine.

**`faultcheck` EXITED 2 IN THE FIRST BATTERY AND IT IS NOT CONTENT.** It got through 4 of its 7
cases and then `page.evaluate: Execution context was destroyed, most likely because of a
navigation` — the flake this project has recorded for `perfcheck` and `lookcheck` at `load1` 5–7
since session 60, here at 3.22. Run alone, immediately before, it printed *"7 cases — quarantine is
surgical, logged once, and the frame survives it"* and exited 0.

**`citycheck` IS BYTE-IDENTICAL TO SESSION 78** on every figure STATE 78 tabulated: occupancy claims
**18 794**, delivered **19 082**, forbidden overlaps **7**, sign quads **2 699**, signs inside a
building **1**, clumping CV **0.396**, objects/chunk max **114**, props **4 652**. Session 79 added no
geometry and moved none.

**`perfcheck` CARRIES NO TRIANGLE AND NO DRAW BREACH.** `highway_speed` is **405 draws,
2 592 572 triangles, 358 386 instances** — session 78's three figures unchanged, which is the whole
cost attribution for this session. Of its violations, eleven are milliseconds and frame counts at
`load1` 3.2–5.2 (CONTRACT §0.2: not verdicts in the red direction), one is the headroom probe whose
own defect is documented, and **three are the vehicle silhouette**: 70% of 63 vehicles have a dark
gap at the ground (min 75%), tone-profile roughness 0.278 (min 0.3), and only 49% carry a
non-monotone tone profile (min 75%). That is the vehicle rear nobody has built.

**AND THE FIRST BATTERY'S TWO EXTRA VIOLATIONS WERE THE SAME FLAKE.** It reported
`downtown_dense` entropy **3.570** and mean luminance **0.0745** with a per-run spread of **2.385**
and one run at 2.718 — a frame that mostly failed to render, the signature session 78 recorded. The
second battery's three runs are `[5.101 5.066 5.066]`, spread **0.034**, and both assertions are
green. **Neither was content.** The vehicle figures also move with the sample and not with the
build: battery 1 measured 46 vehicles at 61%, battery 2 measured 63 at 49%, against session 78's 66
at 53%.

### 5.1 AND `lookcheck` HAS BEEN FOUR SINCE SESSION 78, NOT THREE

STATE 77 listed three violations by name. STATE 78 wrote **"`lookcheck` IS THE IDENTICAL THREE"**.
**The gate was printing four.** Attributed by A/B in paired worktrees, two runs each, byte-identical
output every time:

```
  30b0282  session 77 head          3 violations, distinct:midnight|dusk 0.02846
  251b298  session 78 after item 2a  3 violations, distinct 0.02846
  7be7adf  session 78's HEIGHT GRADIENT   4 violations, stddev:dusk 0.1267 < 0.128,
                                          distinct 0.02774
  f9bbbc3  session 78 head           4, identical
  HEAD     session 79                4, identical
```

**Session 78's height gradient is what turned `stddev:dusk` red**, and it moved
`distinct:midnight|dusk` the wrong way at the same time (0.02846 → 0.02774, further from its 0.03
floor). The mechanism is coherent: the gradient makes the CORE taller, the origin block is at r = 0,
so more of that dusk frame is facade and less of it is sky — and a frame with less sky has a lower
luminance stddev. The margin is **0.0013 on 0.128, 1.0% under**.

> **IT WENT UNRECORDED BECAUSE THE SESSION READ ITS PREDECESSOR'S LIST INSTEAD OF THE GATE'S
> OUTPUT.** That is the same failure LOOK.md §8 has a rule about with a defect instead of a
> violation, and it is worth one sentence in a ritual: *the phrase "the identical N" is a claim and
> needs the N counted this session.* **No floor is moved** — CONTRACT §0 rule 5 — and this is not
> session 79's to repair; it is recorded so that the next session that touches building height knows
> it has a second reader.

---
## 6. THE FOUR PREMISES

| | premise | verdict |
|---|---|---|
| (i) | the map can be drawn from generator data without a resident camera | **TRUE, and it always was.** `ui.js` has drawn from `citygen.js` since session 19 and says so in its own header; `citygen.js` imports standalone in pure Node with no `three` and no GL. What was missing was not a data path, it was 9 km of extent. `terrainHeightAt` costs 1 027 ns outside the city and 24 ns inside it, so a 512² world raster is 181 ms once. §1 |
| (ii) | the signal defect is the −10.62 m stop-line assertion carried since session 21, and not a second one | **THE SAME ONE, and the figure is in `budget.json`, not STATE.** Session 21 named the mechanism — vehicles queue into the box — and asked for a re-measurement at dt = 1/60. It is 2 794 vehicle-frames, all of them holding permission, all of them excluded from the statistic by that statistic's own filter. A second mechanism turned up beside it: 3 131 samples held at a junction whose crossing road is in the river. §4 |
| (iii) | a pedestrian crossing cycle is reachable without rebuilding the pedestrian model | **NOT ANSWERED — the item was not reached.** §7 item 2 carries what is known: `traffic.js` already reads `streetlife.crossingBlocked` and withholds permission on it, so a channel between the two modules exists in one direction. |
| (iv) | a destination list costs no draws | **TRUE, and it is stronger than that.** `highway_speed` is 405 draws and 2 592 572 triangles before and after — session 78's figures to the digit. The map is a 2D canvas drawn only while it is open, the panel is DOM, and `?player=1` is what registers the module, which no gate sets. |

---
## 7. WHAT TO DO FIRST NEXT TIME

**1. `glow()` PUSHES A NULL WHERE `pushSignLight` CLAIMS A SLOT — §9.3's fifth row, and it is now the
thing standing between the operator and his own harbour at night.** Every quay flood, apron mast,
runway edge light and approach light built since session 62 is an emissive quad that deposits
nothing. Three of this session's destinations carry `t = 0.78` for that reason and say so. It is the
highest-value repair on this list because it is what makes the world's most-built new content
visible at the time of day it was built for.

**2. PEDESTRIAN SIGNALS AND THE LINE-UP — item 4d, not reached.** Twelve figures at one spacing along
one pavement, all facing the same way, very visible at the rim. A crossing cycle gives them a reason
to bunch, wait and turn, which repairs two things with one mechanism. What is already there:
`traffic.js` reads `streetlife.crossingBlocked(x, z, axis)` every frame and withholds a junction on
it, so the two modules already talk in one direction.

**3. THE EXIT RESERVATION — the repair session 21 asked for and this session measured.** 2 794
vehicle-frames of a body standing in a junction box, 17 episodes, longest 2.52 s. It is a second
permission keyed to the box's EXIT and a release path for every way out of one. Cost it honestly
before starting; the census that proves it is needed now prints in `stoplineprobe`.

**4. THE BRAKING POINT ASKS NO PREDICATE.** 3 131 samples held at (0, −384), whose crossing road is
the river. The head asks two questions and the paint asks one; `nextJunctionAhead` asks none. The
fix needs the vehicle's axis and line and a small loop.

**5. THE CARRIAGEWAY IS AN EMPTY SLAB** — 30–45% of every street frame, in eight of ten poses, one
flat tone with four dashed lines. The route is a 4 m PARTITION (not an overlay — coplanar plates
need the 1 mm ladder) at 41 268 triangles and ZERO draws, plus per-corner colours at
`city.js:1503-1515`, because `quad()` flat-shades and would otherwise buy N tones and no gradient.

**6. THE VEHICLE REARS.** `perfcheck` carries a standing red that would MOVE if it were built: 61% of
46 vehicles carry a non-monotone tone profile against a floor of 75%. The body is a lofted sweep of
ONE shared 8-point section; a rear that reads needs a second profile interpolated along the spine.

**7. `condenser-street` STILL DOES NOT SHOW THE CONDENSER**, and the real repair is to make the
`-street` generator call `poseprobe` — §9.3's seventh row. **This session shows what that buys and
what it does not**: poseprobe's clear azimuths are what the seven city destinations were authored
from, and its *fullest* answer was wrong for the arch (down the span) and for the weir (outside the
bowl). **A stand-off test answers "is anything in the way" and never "is this broadside", so the
generator needs the frame as well as the ray.**

**8. THE FOUR REMAINING BARE LANDMARKS** — `weir` first: 26 149 m² and 4 999 m² of jointless
concrete, the two biggest single surfaces in the city, and there is now a destination that shows
them. Then `arch` (a 1 384 m² deck face, one albedo for all 22 chords) and `mast` (correct, but
`LANDMARKS` calls it *guyed* and the word "guy" appears nowhere in `src/`).

**9. THE SKYLINE'S HARD EDGE.** Height reads density since session 78 and inner/outer went
1.013 → 1.140, but the city still stops at a straight line against bare ground. That is `extentEdgeM`
and a separate item — **and §5.1 is the warning that comes with it: the last change to building
height turned a fourth `lookcheck` assertion red and nobody noticed for a session.**

**10. `AIRFIELD.edgeStepM` AND `afPaint` are still declared and never read.**

---
## 8. THE STANDING LIST — recorded so nothing is lost

- **THE BRIDGE CABLES GO TO NOTHING.** The operator's frame: cable stays crossing the whole view,
  meeting no pylon and no beam, some passing in front of buildings blocks away. Either the pylons are
  missing or the cables are drawn from a point no geometry sits on — and the latter is §9.3's ninth
  row again, a mechanism at the wrong argument position.
- **THE STREET-END BUILDING IS TRANSPARENT AND STEPPED.** The massing that closes a street vista is
  see-through to the pavement behind it, with a staircase silhouette. That is `stack` seen from the
  street; session 78 gave it floor bands, galleries and corner piers, and the frame that found it has
  not been retaken.
- **THE HARD ROAD-COLOUR SEAM** across the street in the gate's own eye, where the origin block's
  pale carriageway meets the streamed city's dark asphalt.
- **VEHICLE REARS ARE FEATURELESS LOAVES** (item 6 above), **PEDESTRIANS STAND IN EVENLY-SPACED
  LINES** (item 2), **THE WATER MOIRÉS** into corduroy at grazing incidence, **THE GRASS IS A FLAT
  GREEN SLAB**, **THE MARKET CANOPY IS EMPTY**.
- **`citycheck`'s fourth violation is 1 004 of 284 918 walkable samples (0.35%, 0.40 ha) standing on
  the `block.js` earth plane with no surface drawn over it.** The assertion has existed since
  2026-08-28 and is part of the standing red, not new; `node tools/surfacegrid.mjs --patches` says
  where.
