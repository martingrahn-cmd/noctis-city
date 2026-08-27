# NOCTIS — STATE

*End of session 45. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`. The machine
has **NOT** rebooted since session 40 — 8 d 2 h of uptime at the last command against session
44's 8 d 0 h, the same boot. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` RANGED 2.48 TO 7.18 ACROSS THE SESSION*** against CONTRACT §0.2's bar of **1.6**, and
the session was almost entirely browser work — seventeen browser boots, three `perfcheck`
invocations and a full gate run. **NO RED MILLISECOND IN THIS FILE IS ADMISSIBLE.** What is
quoted is COUNTS (draw calls, triangles, instances, populations), PIXEL STATISTICS off delivered
PNGs, and arithmetic with no browser in it. One green absolute is quoted as green and marked as
such: drift on this machine is one-sided, so load can only make a frame slower.

**THIS SESSION WALKED THE CITY AND FIXED WHAT IT SAW.** **Two hundred and thirty-odd frames over
twenty-eight poses**, four times of day, wet and dry, at street level and from the air, in BOTH
content paths — the origin block and the streamed city, which session 28 showed is one place a
session can build an item into only one of. **Fourteen commits of code and four of documents.
Fourteen repairs and twenty-four findings.** The list below is the deliverable.

**AND FIVE TIMES IN ONE SESSION THE TWO CONTENT PATHS TURNED OUT TO BE TWO DIFFERENT CITIES** —
the lamp radiance, the lamp population, the kerb and the SIGN LIGHTS, with `block.js` correct in
all four, and the road markings, with the streamed city correct. That is the shape of what a walk
finds and no gate does: **a gate reads one path or the other and never both at once**, and every
one of these five was a number that had been printed, or a mesh that had been absent, for between
fifteen and forty-five sessions.

**THREE OF THIS SESSION'S OWN ARMS WERE WRONG AND ITS OWN INSTRUMENTS CAUGHT ALL THREE**, which is
the other thing worth carrying forward. The sign pool shipped a first arm that rendered a
byte-identical frame because a field name never reached a record (§11.1); the sign ranking spent
most of sixteen slots on cabinets facing away from the camera (§11.1); and the rain's beam
modulation was wrong by a factor of ten and would have moved the delivered gain an order of
magnitude outside the bracket the first half chose by looking (§14). **None of the three was found
by looking at a frame.** Two were found by printing a count and one by printing a mean — and the
counts and the mean are now permanent (§7).

---

## 0. THE LIST — EVERYTHING THAT LOOKED WRONG, REPAIRED OR NOT

Every entry has a `spawn=` link you can paste and a frame in `tools/shot-out/`. The links are
`localhost:5173/?player=1&spawn=…`; `&t=` is time of day, `&wet=` and `&rainfall=` are CONTRACT §6
parameters. Frames were taken with a scratchpad multi-pose tool (one boot, many poses) rather than
`lookat`, which is one boot per pose — §7 has the arrangement.

### REPAIRED — eight commits, each revertible on its own

| # | what looked wrong | what it was | frames |
|---|---|---|---|
| **R1** | **The rain does not fall.** `?rainfall=1` changes the frame time and nothing is visible. | 500 of 500 streaks live and INSIDE the frustum. A median streak arrived at **0.136 cd/m² against a lit road at 1.4 — 0.097× the surface it is seen against**, and the drawn population is **1.1%** of the rain's glinting cross-section. ×326.3. §1 | `s45-rain-{before,after}-t0-wet.png` |
| **R2** | **Street level is too dark at night.** | The origin block's lamp bowl was **0.2151× its own derivation** — 420 against 1952.19 cd/m² — and `PLAYER.spawn` is on that block's pavement. The thing that blocked the repair in session 30 stopped existing in session 31. **It also closed `band:dusk`, red since session 40.** §2 | `s45-lamp-{before,after}-t0-wet.png` |
| **R3** | **An entire pavement runs its whole length with no lamp on it at all.** | Every street in the streamed city was lit from **one side**, and the last **29–38 m of every block** from neither. `block.js` has always done it correctly. Merging the per-chunk lamp meshes paid for the repair and **46 draw calls** on top. §3 | `s45-junction-t0-wet.png`, `s45-viaduct-t0-wet.png` |
| **R4** | **The carriageway does not read as a road in daylight.** | Where the road is **concrete** — 34.7% of chunks, in districts — it delivered **14 code values** from its own pavement. 0.19 → 0.11714 from CIE's own R1/R3 classes. §4 | `s45-road-{before,after}-t0_5-dry.png` |
| **R5** | **The splash crowns are at the edge of visible** (STATE 44 item 5). | The same defect as R1 one layer over: all three particle layers multiplied a MEAN radiance by a SHAPE whose mean is not 1. splash ×2.081, spray ×3.273. §1.2 | as R1 |
| **R6** | **No kerb reads.** | The kerb was **a 0.180 m hole with the world's earth plane behind it**. Raycast at 14.13 m: `block:ground`, albedo `[0.1229, 0.1211, 0.1168]`. §5 | `s45-road-after-t0_5-dry.png` |
| **R7** | `city-budget.json`'s stall derivation quoted two laws that no longer exist. Carried since STATE 42. | Corrected in place; the argument survives its own stale facts and no threshold moved. | — |
| **R8** | **The origin block has no road markings at all.** No centre line, no lane line, no edge line, no stop bar, no zebra, in 336 m of main street — and it is the street `lookcheck` stands in and `PLAYER.spawn` puts the player on. | `citygen`'s `paint()` refuses any mark not on a delivered `carriageway` claim, and `BLOCK_KEEPOUT` clips the lattice's carriageway out of this block. **A guard doing its job, and nobody else ever painted here.** One draw call. **It took `lookcheck` red at 3 again** — see L15. §5.1 | `s45-marks-{before,after}-t0_5-dry.png` |

| **R9** | **975 signs and not one of them lights anything.** `perfcheck`'s role census prints `aircraft:1 traffic:96 stall:12 block:56 lamp:192` — there is no sign role. | **The fifth time in this session that two content paths were two different cities**, and `block.js` has lit every one of its five signs since session 3. **243 of the 555 lit signs (43.8%) are at or above one street lamp's 6 800 cd** and every one lit nothing. A pool of 16 slots, ranked by `I·cosθ/d²`. §11 | `s45-sl2-{before,after}-bigroof-t0-wet.png` |
| **R10** | **The sign lights threw white, and white made the frame MORE monochrome.** | `EMITTER_CHROMA` is luminance-normalised (Y = 1.000 for all six), so the sign's own chroma is free. Measured on one wall: no sign light R/B 1.620, white sign light **1.306 — desaturated**, own chroma **1.938**. LOOK.md §3's *"biggest unspent lever"*, spent. §11.2 | as R9 |
| **R11** | **The splash crowns never got their population share** (L5, opened by the first half of this session). | A streak is a GLINT (D² moment, 91.41); a crown is FOAM RAISED BY AN IMPACT, so the moment is `N·v·A` = **D^2.67 → 40.72**, 0.445× the streaks'. The quadrature reproduces the streaks' own closed form at p = 2 or throws. §12 | `s45-crown-{before,after}-crowns-t0-wet.png` |
| **R12** | **53 lamp heads hang in the air with no post under them.** Found by looking at a noon junction. | `city:bowls` 497 instances against `city:lamps` 444. The `chunk.features` loop pushes a bowl and nothing else: **36 park lamps + 17 site floods = 53**, exactly the shortfall. A box in `masses`, not the street lantern — that geometry is a pole merged with its ARM. §13 | `s45-post-{before,after}-carpark-t0_5-dry.png` |
| **R13** | **A drop falling through a lamp's beam is as dull as a drop in the dark** — the operator's own third observation, and the one the brief said to do FIRST. | `STREAK_GLINT_NITS` is a CONSTANT. A drop is a sphere, i.e. a convex mirror, so its flux goes as the **illuminance at the drop** and not the source's radiance. Sampled on the CPU into the gain the layer already carries. **The first arm was wrong by ten and its own instrument caught it.** §14 | `s45-beam-{before,after}-underlamp-t0-wet.png` |
| **R14** | Two ellipsis characters in this session's own comments. | `parsecheck`, run BEFORE this file was written. 112 files, contract-clean. | — |
| **R15** | **The sign pool spent the froxel margin the traffic reserve is made of**, and `perfcheck` refused it. | Each sign's window was sized through the Frostbite shoulder — 233 m for every rooftop cabinet — and `lights.assign()` writes a light into every froxel its radius sphere touches. `downtown_dense` **58 of 96, margin 38** against a floor of 40. Capped at `cutoffM` = 128 m: **56 of 96, margin 40**. §11.3 | — |
| **R16** | `perfcheck`'s own GOOD FIXTURE declared no sign role, so R9's new floor refused the control. | `gateaudit` caught it, and perfcheck reported 74 meaningless passes as ZERO rather than as 74. **The fixture moved, not the floor.** §6.3 | — |

### FOUND AND NOT REPAIRED — the list the next session starts from

**L16. TWO OF THREE STREET POSES ARE NOT REPRODUCIBLE BOOT TO BOOT, AND THAT IS A HAZARD UNDER
EVERY FRAME CLAIM IN THIS PROJECT INCLUDING THIS FILE'S.** Measured deliberately, by rendering the
SAME code at the SAME seed with `?paused=1` and the same `settle(6)` in two separate boots:

```
  pose          brighter   darker    max delta    verdict
  citystreet      0.00%     0.00%      0 cv       BIT-IDENTICAL across boots
  junction        1.10%     0.75%    205 cv       not reproducible
  blockstreet     4.14%    19.70%    243 cv       not reproducible, frame mean 17.93 -> 17.87
```

**A before/after pair taken at `blockstreet` cannot resolve anything smaller than 20% of the
frame.** This session found it the hard way: an early arm of R9 was measured as *"8.63% brighter"*
at `junction` when the code under test was in fact inert — the pool was built, the ranking ran, and
`signEmitters` never reached the resident record, so the two arms were the same build. **The
number was boot noise wearing a result's clothes**, and what caught it was taking the same arm
twice rather than a better argument. Every pixel figure in §11 to §14 is quoted at a pose whose
reproducibility was checked first. **What is owed: why.** Both bad poses are near the origin block
and pedestrians; `citystreet` is a streamed street. `settle(6)`, TAA history and the auto-exposure
adaptation are the three candidates and nobody has separated them.

    localhost:5173/?player=1&spawn=70,1.74,9.4&t=0.0&wet=1

**L17. THE STREAKS' ORIENTATION IS WORLD-SPACE, AND THE BRIEF'S CLAIM THAT IT IS NOT IS FALSE.**
The brief's own first item: *"the streaks LEAN HARD toward the right edge while falling
near-vertical at centre and left. Orientation looks like screen space or camera-facing rather than
world."* **It is not.** `weather.js` builds each streak's long axis as
`(windDir.x·wind, −DROP_TERMINAL_MS, windDir.y·wind)` — a world direction, with the wind drawn once
per seed from a named stream and a log height profile over it — and the comment beside it already
says *"a screen-aligned quad would draw a vertical streak while the drop fell at 21 degrees"*.

**THE DECISIVE TEST IS A 180° YAW**, because a camera-facing lean cannot flip and a world lean must.
Two frames from one pose: looking north the streaks run top-left to bottom-right; looking south
they run **top-right to bottom-left**. What the operator saw is the real wind lean plus perspective
convergence on the vertical vanishing point, which is asymmetric whenever the wind is not square to
the view. **Nothing to repair.** `s45-lean-{north,south}-t0-wet.png`.

    localhost:5173/?player=1&spawn=384,1.74,300&t=0.0&wet=1&rainfall=1

**L18. NOTHING ABOVE GROUND LEVEL GETS WET, AND IT IS THE ONE PART OF THE BRIEF'S FIRST ITEM STILL
UNTOUCHED.** The operator's second observation: facades, roofs and signs look identical in rain and
dry, and wetness reaches only horizontal ground. Not measured this session and not repaired — it is
recorded here so the next session starts from a named item rather than re-reading the brief. The
other two of his three are R13 and L17.

**L19. THE EARTH PLANE SPECKLES AT 1.9 km AND READS AS STATIC.** From 220 m up at dusk the whole
top-left quadrant is a carpet of fine dark specks with no structure — it reads as gravel or as
sensor noise rather than as ground. Raycast: `block:ground` at **1 860.89 m**, i.e. the world's
earth plane past `geometryRadius`, which session 42 recoloured to the city's own area-weighted mean
precisely so it would stop reading as a ploughed field. The COLOUR is repaired and the
high-frequency content is not. `w-aerial-t0_78-wet.png`.

    localhost:5173/?player=1&spawn=384,220,300&t=0.78&wet=1

**L20. A BLANK BUILDING FLANK 50 m WIDE FILLS THE FRAME AT 11.9 m.** Standing on a pavement at the
weir approach, 90% of the frame is one flat blue-grey wall with no windows, no openings and no
tonal variation of any kind — raycast `-2,1:masses` at **11.9 m**, in the camera's own chunk and
therefore fully detailed. A building's street elevations get windows and its flanks get nothing,
which is correct for a party wall between two buildings and is not correct for one you can stand
in front of. `w-weir-t0_5-wet.png` — and note the pose was chosen to look at the weir and does not,
which is L16's lesson in a second form.

    localhost:5173/?player=1&spawn=-180,1.74,150&t=0.5&wet=1

**L21. THE ORIGIN BLOCK REACHES 25 OF 30 FIELD SLOTS WHERE EVERY OTHER POSE REACHES 30 OF 30.**
Printed beside all thirty-two frames of this session's walk: `blockmain` reads `25/30 field` at all
four times of day and the seven streamed poses read `30/30`. Whether five canyon bakes are
legitimately absent over the origin block or five are never requested there is a ten-minute
question nobody has asked, and `poseprobe`'s carried blindness to the origin block (§15) is the
reason it has never come up.

**L22. THE BRIGHT RESERVE'S FLOOR IS INSIDE ITS OWN RUN-TO-RUN NOISE, AND THAT IS THE FINDING —
NOT THE NUMBER IT FELL TO.** `citycheck` was run twice in the second half. Against a 6.00% floor:

```
  run A (uncontended)   median 6.35   per-run 5.73 / 6.35 / 6.81   spread 1.08
  run B (contended)     median 6.16   per-run 6.16 / 6.00 / 6.67   spread 0.66
  first half            median 6.91   per-run 6.92 / 6.45 / 6.91   spread 0.47
```

The gate reads the MEDIAN and passes in all three. But **individual runs span 5.73 to 6.92 — a
range of 1.19 points across a floor of 6.00 — so a single run of this gate can report either
verdict on an unchanged city.** The first half's *"6.91, the largest margin this floor has ever
had"* is one draw from that distribution and was quoted as a level. **L1's window repair is costed
against this reserve**, and what it actually has is not 0.91 points of margin, nor 0.35: it is a
median 0.2–0.4 above a floor that one run in three is already at or under. The item L1 owes is
therefore the reserve's own repeatability before any window is dimmed — how many runs does this
statistic need before its median means anything?

*Run B was taken while `perfcheck` was running, which is §6.3's own warning ignored twenty minutes
after it was written. Its counts and reds are identical to run A's; only the pixel statistics
differ, and they differ by less than run A differs from itself.*

**L23. A CAR PARK FROM EYE LEVEL READS AS STACKED CONCRETE STEPS.** *Written as a question, per
LOOK.md §8.* Session 40 rebuilt the parked vehicles specifically because *"the first version of
both was a slab and the frames said so"*, and from 1.74 m looking along the rows they read as
tiered slabs again — the wedge is a thing the SIDE elevation does and a car park is seen end-on.
Whether that is a defect or is what a real car park looks like from inside it is a look decision
nobody has taken. `s45-post-after-carpark-t0_5-dry.png`.

    localhost:5173/?player=1&spawn=400,1.74,192&t=0.5

**L24. AT NOON AN ASPHALT JUNCTION STILL READS AS ONE PALE PLAZA.** R4 repaired the CONCRETE
carriageway — 34.7% of chunks — and this is one of the other two thirds: carriageway, pavement and
crossing paint all arrive within a narrow band of light grey, the kerb reads only as a thin line,
and the whole junction is a continuous surface with vehicles and people standing on it. It is the
operator's fourth complaint at a pose R4 does not reach. `w-crossing-t0_5-wet.png`.

    localhost:5173/?player=1&spawn=384,1.74,384&t=0.5&wet=1

**L27. `minOccupancyMargin` DOES NOT REPRODUCE TO BETTER THAN EIGHT POINTS, AND IT IS ASSERTED
AGAINST A FLOOR OF FORTY.** This is the session's most useful finding about a GATE rather than
about the city, and it cost an attempted repair to learn. `downtown_dense`, worst froxel over the
run, five measurements of one feature:

```
  pool 16, 233 m throw   four routes    58 of 96   margin 38   BREACH — this is why R15 exists
  pool 16, 128 m throw   four routes    56 of 96   margin 40
  pool 16, 128 m throw   one route      52 of 96   margin 44
  pool 12, 128 m throw   one route      52 of 96   margin 44
  pool 12, 128 m throw   four routes    60 of 96   margin 36
```

**TWELVE SLOTS MEASURED WORSE THAN SIXTEEN, ON THREE OF THE FOUR ROUTES** — 36 / 79 / 41 / 41
against 40 / 79 / 43 / 42. **Four fewer lights cannot raise a froxel's occupancy.** The statistic
is a MAXIMUM over a moving route sampled while traffic drives through it, and maxima of a moving
population do not average; its spread here is about eight points, a fifth of the floor it guards.

**THE POOL WAS CUT TO 12 AND PUT BACK**, because cutting it on the strength of that measurement
would have been choosing a number for a reason the data does not support — which is the thing this
project's whole comment discipline exists to prevent. The 233 → 128 m throw cap STAYS: that one has
a mechanism and it moved the worst reading of all five. **What is genuinely true: this feature took
`downtown_dense`'s margin from 57 to about 40**, i.e. it spent most of the reserve, and the next
session adding any clustered light of any kind should re-derive this statistic's repeatability
before trusting either number.

**L28. THE `night_rain` FRAME MEAN WENT FROM STRADDLING ITS FLOOR TO SITTING UNDER IT.** Per-run
means **[0.0797, 0.0771, 0.0694]** against a floor of 0.08, where the first half read
[0.0793, 0.0782, 0.0813]. It was already red in the first half and it is redder now, and the cause
is not a mystery: CONTRACT §5.4 makes auto-exposure pay for everything added, and §11 added
sixteen lights to the two `lampsOn` times. **The reserve and the mean move in opposite directions
under the same change**, which is worth stating because L22's bright reserve and this floor are
now both being pushed by the same repairs from opposite sides.

**L1. EVERY WINDOW IN THE STREAMED CITY IS 220 cd/m² AND THE ORIGIN BLOCK'S ARE 7 TO 30.**
This is CONTRACT §9's own class — one quantity, two files, nothing comparing them — and it is
**exactly the defect session 28 repaired for the lamp bowl and nobody checked for the window.**

```
  src/core/constants.js  LIGHT.windowNits          220     "a lit office window seen from
                                                            the street", read by city.js for
                                                            EVERY window in the streamed city
  src/modules/block.js   EMISSIVE.windowCold        30     under a table comment that says
                         EMISSIVE.windowWarm        21     "these are authored, not measured"
                         EMISSIVE.windowDirty       14     — the same sentence that produced
                         EMISSIVE.windowDim          7        the 210 cd/m² lamp bowl
```

**7.3× to 31.4× apart.** The delivered consequence is a frame: raycast through the scene at the
white rectangle that owns a fifth of `s45-window-blown-t0-wet.png` returns `2,2:windows` at
**5.87 m**, `emissiveIntensity` 220, `roughness` 0.05. At dusk the same panel is a flat pale
blue-grey slab with no structure (`s45-window-slab-t0_78.png`) because a 0.05-roughness surface
is a mirror and what it mirrors is the sky.

**NOT REPAIRED, and the reason is a number.** Dimming it is a subtraction from `citycheck`'s
bright reserve, a FLOOR that was RED for six sessions before density fixed it (LOOK.md §7).
`constants.js` records that the streamed lamp bowls alone carry 0.96 points of it; the windows
are the larger share and nobody has attributed them, and that attribution — zero each path in
turn, exactly as `$lampBowl_measured` did — is the first hour of this item.

**AND THIS SESSION MADE IT MORE AFFORDABLE THAN IT WAS.** The reserve reads **6.91% against the
6.00% floor** (per-run means 6.92 / 6.45 / 6.91, spread 0.47), against **6.24%** in session 44.
Brightening the origin block's sixteen bowls and painting its street put 0.67 points into the very
reserve the window repair has to spend, and that is the largest margin this floor has ever had.

    localhost:5173/?player=1&spawn=375.4,1.74,300&t=0.78
    localhost:5173/?player=1&spawn=375.4,1.74,300&t=0.0&wet=1

**L2. A STREET-LEVEL POSE AT THE ARCH DELIVERS 2 396 028 TRIANGLES AGAINST A 2 360 000 CEILING,
AND NO GATE ROUTE GOES THERE.** `s45-arch-triangles-t0_5.png`, 256 draws. The weir pose beside it
reads 2 340 700. Subtracting this session's own lamp delta (≈35 000 triangles, §3) still leaves
the arch pose at ≈2 361 000, so **it was at the ceiling before tonight** — this session did not
create it, it found it. The ceiling is asserted on the four `budget.json` routes and all four run
down the main street; `portalprobe` made the same point about the viaduct's ends in session 23.

    localhost:5173/?player=1&spawn=26,1.74,230&t=0.5&wet=1

**L3. THE WEIR IS STILL A PALE LID FROM THE PAVEMENT.** Session 42 took its disc from 100.0% to
47.3% within ten code values of its median, measured from the air. From the ground at noon the
bowl is one enormous featureless plane, the sixteen stands of planting read as **dark green
shipping containers evenly spaced on a rim**, and the permanent pool reads as a thin dark stain
rather than water. The aerial statistic is green and the street view is not, which is §7.3's own
shape: two views, one metric.

    localhost:5173/?player=1&spawn=-180,1.74,150&t=0.5&wet=1        s45-weir-lid-t0_5.png

**L4. DAYLIGHT RAIN IS INVISIBLE AT ANY GAIN, AND IT IS THE BLEND MODE.** At `rainfall=1` and
noon the streaks vanish even at ×326. `WATER_CHROMA` is white and the three layers are
**additive** (`blendSrc: OneFactor, blendDst: OneFactor`), so a drop can only ever ADD light.
Daylight rain reads because a drop REFRACTS: it is darker than a bright sky and brighter than a
dark wall, and an additive layer cannot be darker than what is behind it. Night rain is the case
additive gets right, which is why R1 works and this does not.

    localhost:5173/?player=1&spawn=384,1.74,300&t=0.5&rainfall=1    s45-rain-daylight-t0_5.png

**L5. THE SPLASH CROWNS' POPULATION SHARE IS UNSOLVED, AND THE STREAKS' IS NOT.** R1 gives the
streaks ×91.41 for the drops below `DROP_MM`; the crowns did not get it, deliberately. A streak
is a GLINT so its flux goes as the drop's projected disc and the D² moment is the right integral.
A crown is DIFFUSE FOAM at a size that also goes as D, so the right integral is over the impact
FLUX — `∫ N(D)·v(D)·A_crown(D) dD` with `v = 3.78·D^0.67` — and it is not the same number. One
evening's arithmetic, and `weather.js` already holds every term.

**L6. `rain_spray` DELIVERS 0 TO 4 OF 70.** Carried from STATE 44 item 6 and not measured this
session. `budget.json` sized 70 from *"6 vehicles in the near field × 2 wheel lines × 6 puffs"*
and `SPRAY_RANGE_M` is 25 m.

**L7. FROM 220 m UP AT MIDNIGHT ONLY THE STREET UNDER THE CAMERA HAS LAMP POOLS, AND THIS SESSION
MADE THAT TIGHTER.** `lampPool` is 96 slots handed to the nearest candidates; R3's 2.5× poles
shrink the lit radius by `1/√2.5` = **0.63×**. Within it both kerbs now lay a pool, which is the
right way round for a person on a pavement — but from the air the city is dark streets with lit
windows, and whether that is correct is a look decision nobody has taken. The pool is 96 of
`CLUSTER.maxLights` and `city.js` prints the margin at boot.

    localhost:5173/?player=1&spawn=384,220,300&t=0.0&wet=1

**L8. A SPARSE DISTRICT AT MIDNIGHT HAS ALMOST NO LIT WINDOWS.** *Written as a question, per
LOOK.md §8.* The left half of the midnight aerial is black over about five blocks while the right
half is full of lit windows. Is window lighting supposed to scale with district density, and
should a sparse block read as unbuilt at night rather than as a quiet one? A count per block
against the density field answers it in ten minutes.

**L9. TWO BLOWN-WHITE VERTICAL SLIVERS ON THE ORIGIN BLOCK'S ADVERTISING PILLAR — IDENTIFIED,
AND IT IS NOT A DEFECT.** Written down anyway, because *"this reads oddly and I do not know why"*
is a valid entry and this one took one raycast to close. `block:adpillar:faces`, **2.59 m from the
eye, `emissiveIntensity` 748**, cool white — `AD_PILLAR_BLOCK.faceNits`, which is *"the streamed
city's own `PILLAR_FACE_NITS`"* and is in the 300–800 cd/m² a backlit advertising panel actually
runs at. The pillar has three faces and the pose sees two of them nearly edge-on, so a correct
748 cd/m² panel at 2.6 m arrives as a three-pixel clipped strip. **A real one does that too.**
The entry that remains is the one it shares with L1: this city has several emitters between 220
and 748 cd/m² and no rule about how close a person may stand to one.

    localhost:5173/?player=1&spawn=44,1.74,9.4&t=0.0&wet=1          s45-pillar-slivers-t0-wet.png

**L10. A PEDESTRIAN WITHIN ~2 m OF THE LENS READS AS A DISEMBODIED PALE LIMB.** Consistently, in
three frames from two poses. Probably near-plane clipping through a body box rather than a gait
defect, and `gaitstrip` is the wrong instrument for it because it frames the figure whole.

**L11. THE ORIGIN BLOCK'S STREET READS AS A PLAZA AT NOON EVEN THOUGH ITS ALBEDOS ARE RIGHT.**
Measured 212 (pavement) against 151 (carriageway) — a **61 code-value step**, which reads, against
the concrete district's 14 before R4. What does not read is the BOUNDARY: no lane marking in the
frame at all, no crossing paint, and the kerb is a 0.16 m step seen almost edge-on. R4 and R6 do
not touch this path — `block.js` draws its own ground. **The origin block has no road markings.**

**L12. THE CITY IS ONE HUE AT DUSK.** Every roof, wall, road and vehicle in a 180 m aerial is the
same red-brown (`s45-one-hue-dusk.png`). LOOK.md §3's *"a third of emitters should be cold"* is
still the biggest unspent lever, and at dusk the sun does the same thing to every surface at once.

**L13. THE EMPTY DISTRICTS ARE STILL THERE FROM THE AIR.** Five consecutive blocks of paving with
scattered specks and no building (`s45-empty-districts-t0_25.png`). Not measured this session;
`bareprobe` and `fillprobe` are the instruments and LOOK.md §2 carries the whole argument.

**L14. A WET ROAD AT NOON IS A HARD MIRROR.** At `wet=1` the carriageway returns sharp inverted
building images and reads as polished stone rather than wet asphalt. `main.js` ships `wet: 0.55`
so nobody normally stands in it — but `lookcheck` pins **1.0** in four of its eight frames, so
half the look gate measures that surface.

**L15. `distinct:midnight|dusk` HAD A MARGIN OF 0.0002 OF ITSELF AND R8 SPENT IT.** The bound is
`look-budget.json` -> `distinctness.minPairMSD` = 0.03 over all six pairs of the four times, and
its whole note is one sentence saying what it measures — one of LOOK.md §7's *"76 of 189 bounds
with no recorded derivation at all"*. Three readings today:

```
  midnight <-> dusk      0.03008    0.03007    0.02995   floor 0.030   RED after R8
  midnight <-> dawn      0.12903    0.12898    0.12877
  midnight <-> noon      0.20447    0.20443    0.20404
  dawn     <-> noon      0.11378    0.11378    0.11319
  dawn     <-> dusk      0.05799    0.05798    0.05806
  noon     <-> dusk      0.13813    0.13813    0.13806
```

**Five of the six clear the floor by 0.02 to 0.17 and the sixth cleared it by 0.00007**, against a
run-to-run resolution of 0.00001. Paint is bright at midnight AND at dusk — they are the two
`lampsOn` times — so it adds the same pixels to both frames and shrinks the one difference that
had nothing to spare. **THE THRESHOLD WAS NOT TOUCHED**, and lowering it to make R8 pass would be
CONTRACT §0 rule 5 wearing a re-derivation's clothes. What is owed is LOOK.md §7's own discipline
applied to `minPairMSD` in the open: what is a pair of times supposed to differ BY, and is 0.03
the answer for the one pair where both are lit by the same lamps? That is the next session's, not
the session that broke it.

**CARRIED, UNTOUCHED, AND NOT RE-DISCOVERED HERE:** `clumping` CV 0.443 against a 0.60 floor (red
by instruction, fifth session of asking); the vehicle tone-profile bar (eleventh session); the
generator registry containing no sign claims; `perfcheck`'s `player` route never registering the
player module; a `citycheck` assertion that delivered may not exceed claimed; and everything in
STATE 44 §9 item 11 and §10.

---

## 1. THE RAIN DID NOT FALL, AND IT WAS TWO FACTORS AND NOT A MYSTERY

The brief said to establish whether the layers render at all, what drives their count, and whether
that driver is session 44's rainfall or a second dormant one. **All three were answered at HEAD
before a line was written**, and the answer is that there is one driver, it is session 44's, and
it works:

```
  weather:rain_streak   500 instances   500 with a non-zero gain   500 INSIDE THE FRUSTUM
                        distances 0.88 m to 12.00 m, median 9.40 m
                        gain mean 0.497   uNits 1.8887   uGain 1.00   uViewportPx 1280x720
  weather:rain_splash   130 instances   130 non-zero gain    0 in frustum (all on the road
                                                                behind and beside the camera)
  weather:rain_spray     70 instances    70 non-zero gain    0 in frustum
```

So the layer is fed, seeded, unsheltered, in front of the camera and drawn — and the delivered
frame is indistinguishable from `rainfall = 0`. **The uniform was then swept live in one boot** at
×1, ×8, ×25, ×70, ×180 and ×400 with the clock paused and the pose held: nothing at ×8, a light
shower at ×25, a heavy one at ×70, a downpour at ×400.

### 1.1 THE TWO FACTORS

**THE COVERAGE PROFILE WAS NEVER NORMALISED — ×3.570.** `STREAK_NITS` is a MEAN radiance: the
drop's flux over the whole quad's area, which is what the module's own two dilution factors
compute. The fragment shader then multiplies it by `coverage`, which is a SHAPE, and the shape's
mean over that same quad is not 1:

```
  across   mean of exp(-6·q.x²)                 over q.x in [-1, 1]    0.36152
  along    mean of smoothstep(1, 0.55, |q.y|)   over q.y in [-1, 1]    0.77481
  product                                                              0.28011
```

**72% of every drop's flux went into the profile's own falloff.** A shape may redistribute energy;
it may not remove it.

**THE BILLBOARDS ARE 1.1% OF THE RAIN'S GLINTING CROSS-SECTION — ×91.41.** `budget.json` splits at
`DROP_MM` = 3.28 mm and says of everything below it *"it is not missing, it is the veil"*. That is
true of EXTINCTION, which is what light passing THROUGH the small drops loses over a kilometre. It
is not true of BACK-SCATTER, which is what a drop three metres from the eye sends into it: the
3 164 drops per m³ below the split are inside the same 12 m volume and are glinting at the same
lamps, sub-pixel each and four thousand to one. The share is the D² moment of the same
Marshall–Palmer distribution the counts came from, because a glint's flux is its drop's projected
disc:

```
  all D            N0·2/Λ³                                    = 990.3
  D >= 3.28 mm     N0·e^(-ΛD)·(D²/Λ + 2D/Λ² + 2/Λ³)           =  10.83
  ratio                                                        =  91.41
```

The numerator is `RAIN_SIGMA_FULL`'s own integral with `Qext·π/4` divided back out, so the two
terms cannot disagree about the distribution.

**3.570 × 91.41 = 326.3, AND THE ARM CHOSEN BY LOOKING WAS 70–400.** The derivation lands inside
the bracket the eye picked, which is the only reason it ships rather than the number 70. What
changes about what the layer MEANS is written in the module: a streak was the image of one drop
above the split and is now that drop **carrying its column's water**. The compromise is in the
shape rather than the energy — small drops fall slower and streak shorter, so the honest rendering
of their share would be a denser field of shorter streaks, and 500 is the instance ceiling.

**NO COUNT MOVED.** 500 instances, a 168 px² clamp, one draw call already in the frame at
`rainfall = 0`. `budget.json` → `particles` is byte-identical, because every bound there is a
count or an area and this is a radiance.

### 1.2 THE OTHER TWO LAYERS HAD THE SAME DEFECT

`makeLayer` now takes `coverageMean` and **throws without it** — a default of 1 would let the
defect back in silently, and a layer that declares a shape but not its integral is the same
mistake again.

```
  streak  exp(-6q.x²)·smoothstep(1, 0.55, |q.y|)            0.28011    shipped 28% of its flux
  splash  two smoothsteps making an annulus, over phase     0.48064    shipped 48%
  spray   exp(-|q|²·mix(3.4, 1.6, phase)), over phase       0.30554    shipped 31%
```

STATE 44 item 5 recorded the crowns as *"present and very faint … at the edge of visible"* with
130 of 130 rendering. This is half of why. The other half is L5.

---

## 2. THE ORIGIN BLOCK'S LAMPS ARE THE DERIVATION NOW, AND `band:dusk` WENT GREEN

`citycheck` has printed *"origin block delivers 420.0 = 0.2151× derived"* every run for fifteen
sessions. `PLAYER.spawn` is `[70, 9.7]`, which is that block's north pavement, so **the lamps the
operator walks under at night are these sixteen and not the streamed city's 790.**

**WHAT BLOCKED IT STOPPED EXISTING IN SESSION 31.** Session 30 swept this factor against
`band:midnight`'s 0.112 ceiling, put the crossing near 550 cd/m² and shipped 420 because that left
0.0008 of margin against an instrument spread of 0.0001. **That sweep was taken at a delivered
`band:midnight` of 0.1112.** Session 31 put the station in the same frame and the band read
0.0745; every STATE since has recorded 0.0741–0.0745, three runs each, spread 0.0000. The comment
in `constants.js` has said *"nothing here is what that assertion is balanced against any more"*
since session 31 and **no session went back to re-ask the sweep.**

```
                    before        after       band              headroom
  band:midnight     0.0741        0.0826      [0.072, 0.112]    0.0294 of ceiling
  band:dusk         0.1393  RED   0.1410      [0.140, 0.180]    GREEN by 0.0010
  band:dawn         0.3021        0.3020      [0.299, 0.353]
  band:noon         0.4288        0.4287      [0.428, 0.482]
  crushed black     0.869%        0.571%      ceiling 2.0%
  road pools        —             9           floor 6
```

Session 30's own measurement of this exact step — 420 → 1952 — was **+0.0075** of frame mean on
its content. Predicted 0.0741 + 0.0075 = 0.0816; **delivered 0.0826**, and the prediction is left
in `constants.js` to be wrong against.

**`band:dusk` HAS BEEN RED SINCE SESSION 40 AND THIS CLOSED IT.** Dusk is one of the two
`lampsOn` times (`look-budget.json` → `onAt`), so these bowls are in that frame. The margin is
0.0010 against a run-to-run resolution of 0.0001 — ten times the instrument's own noise, which is
the margin CONTRACT §0.1 permits a decision on.

**IT ALSO MOVED THE FLOOR THE RIGHT WAY.** `band:midnight` is `[0.072, 0.112]` and 0.0741 sat
**0.0021 above its FLOOR**: for fourteen sessions the frame has been closer to being too dark than
to being too bright, which is the operator's complaint in the gate's own units.

`city-budget.json` → `lampBowl.minRatio` moves **0.2151 → 0.9999**, the only direction that bound's
definition allows. **`maxRatio` is NOT touched**: correcting the streamed city's 4.611× is a
DIMMING that `constants.js` records at 1.39 points of a bright reserve standing at 6.24 against a
floor of 6.00. Moving the ratchet toward 1.0 "as far as the bands allow" allows one end and not
the other, and the frames say the same thing — the streamed city at night already reads.

---

## 3. EVERY STREET WAS LIT FROM ONE SIDE, AND MERGING THE MESHES PAID 46 DRAW CALLS FOR THE FIX

The operator's daylight frame: *"an entire pavement runs its whole length with no lamp on it at
all."* It is not a stream gap. `lampStationsFor` emitted both stations at
`b.x0 + roadHalfWidth + 1.3` and `b.z0 + roadHalfWidth + 1.3` — the **+x and +z** pavement of the
chunk's own two roads. A road runs on the chunk BOUNDARY, so its other pavement belongs to the
neighbour, whose loop puts its poles on ITS +x edge 128 m away. **No road in the streamed city has
ever had a lamp on its −x or −z pavement.**

**AND THE PROJECT'S OWN CONSTANTS SAY OTHERWISE, IN WORDS.** `constants.js` → `LUMINAIRE` derives
the whole elongated optic from *"a Type II semi-cutoff lantern, which is what a 15 m street with
**staggered poles both sides** is lit with"*, and goes on: *"the lamps are staggered at an
effective 15 m, so consecutive pools overlap along the road … and stop short of each other across
it (which is what makes the two kerbs read as two rows instead of one carpet)"*. Two kerbs. And
`block.js` → `LAMP_STATIONS` is `-108 + i*30` on one kerb and `-93 + i*30` on the other:
**staggered, both sides, effective 15 m, since session 3.** Two content paths, and again the
authored one was right.

**TWO MORE, BOTH ARITHMETIC.** `i < 4` at a 30 m pitch reaches `phase + 90` of a 128 m edge, so
**29 to 38 m of every block front — 23–30% of the city's kerb length — had no pole by
construction**, and the `off > chunkSize` guard beside it could never fire (99 < 128), which is
CONTRACT §7.1's shape. And `(cx·7 + cz·13) % 10` is negative for half the city, so those chunks'
first pole stands up to 9 m inside the neighbour and the guard only tests the upper end.

### 3.1 THE DRAW-CALL BUDGET WENT FROM ONE SPARE TO FORTY-FIVE

Stations per chunk go 8 → 20. Measured on `highway_speed`, the tightest budget in the project:

```
  arm                                     draws    triangles    verdict
  shipped, session 44                       439        2.13 M   one spare
  + the far kerb, per-chunk meshes          441        2.15 M   BREACH of 440
  + the far kerb, MERGED meshes             395        2.18 M   45 spare
```

The +2 was not new meshes — the scene walk reads 430 either way — it was more of the **same 70
per-chunk lamp meshes** passing the frustum test, because each one's bounding sphere now reaches
the other pavement. The near ring is 35 chunks and each emitted a `:lamps` and a `:bowls` mesh, so
**street lighting alone could ask for 70 of the 440.** Merged city-wide it asks for **2**, which is
the move `rebuildGroundMesh` and `rebuildSignMesh` already make and for the same ceiling. Scene
meshes **430 → 362**.

`nearVisible` replaces the per-chunk `.visible = near` toggle; the census labels become city-wide
totals, which is what `harness.sceneCensus()` sums anyway, and the per-chunk breakdown it loses is
read by nothing.

**THE COST IS TRIANGLES AND IT IS NAMED.** A merged mesh spanning the near ring is effectively
never culled, so the lamps are in every frame: `highway_speed` 2.13 M → 2.18 M against a
2 360 000 ceiling, **7.6% spare**. L2 is the pose where that matters.

---

## 4. THE CONCRETE CARRIAGEWAY WAS FOURTEEN CODE VALUES FROM ITS OWN PAVEMENT

Measured as a scanline across the section rather than as patches, at noon, standing on the
carriageway at x = 384, z = 300, seed 1337:

```
  pavement      202 cv          kerb band   158 cv        lane line   230 cv
  carriageway   188 cv          14 cv apart, 1.176x in display-linear
```

**AND IT IS NOT THE TONE CURVE**, which is what a 0.45-display-linear road at noon invites you to
assume. 0.19 against the pavement's 0.26 is 1.368×, and ACES at that exposure turns 1.368× into
204/188 predicted against **202/188 delivered**. The albedo is the whole of it. The same
measurement in the ORIGIN BLOCK reads **212 against 151, a 61 cv step**, because `block.js` draws
its carriageway at 0.0908.

**A THIRD OF THE CITY, AND IN DISTRICTS RATHER THAN SCATTERED.** `citygen.js` picks `concrete` on
`age < 0.36` where `age` is a SMOOTH noise field: **42 of 121 chunks (34.7%)** over an 11 × 11
region at seed 1337, and the pose above stands on chunk (3,2) with **all eight of its neighbours
concrete too**. A walker in one of those districts sees no road anywhere.

0.19 had no derivation beside it in a block where every other surface carries one (§9 rule 5). The
ratio is CIE's standard road-surface classes, which exist to say exactly how much brighter one
carriageway is than another under one lighting geometry: **R1** cement concrete Q0 = 0.10 against
**R3** dark-aggregate asphalt Q0 = 0.07. Only the RATIO is borrowed — `π·Q0` would put R3 at 0.22
and this project's asphalt is 0.082 — so the anchor is this city's own road:

    0.082 × 10/7 = 0.11714       [0.11714, 0.11714, 0.11405]

It lands between this file's own `core` 0.105 (*"asphalt patched over concrete"*) and `yard` 0.172
(*"worn concrete hardstanding"*), which is where a trafficked concrete carriageway belongs. And it
repairs the markings the same observation complains about: `city.js`'s own parking note calls the
0.62 bay paint against asphalt *"a ratio of 7.6×, which is what makes a bay read at night"* — on a
0.19 road that ratio was 3.3× and it is now **5.3×**.

**DELIVERED**, same pose, same exposure: carriageway 188 → **170**, pavement 202 → **206**
(auto-exposure pays back what was removed), a **35 cv step against 14**.

---

## 5. THE KERB WAS A HOLE AND WHAT YOU SAW IN IT WAS THE EARTH PLANE

`GROUND_Y` in `city.js` has said *"Pavement either side of the north–south carriageway. **A REAL
kerb now.**"* since session 19, and the HEIGHT is real: the pavement quad is at `GROUND.pavement`
= 0.160 and the carriageway quad is at 0. **Nothing joined them.** Two horizontal quads at
different heights abutting in plan leave a 0.180 m vertical slot, and from a standing eye you look
straight through it. Raycast through the delivered scene at the kerb band of the §4 frame:

```
  block:ground    at 14.13 m    albedo [0.1229, 0.1211, 0.1168]
```

That is `GROUND.earthAlbedo` — the surface session 42 identified as *"a field beside a city"* and
calibrated so the far ring would stop reading as a ploughed one. **It was also the kerb of every
street in the streamed city.** The darker line at a road edge in every frame this project has
taken was never a kerb face catching less sky; it was the ground UNDER the city showing through a
gap. `block.js` has drawn a real one since session 3. That is the third time in this session that
two content paths disagreed and `block.js` was the correct one.

The repair is one riser on the ROAD-FACING edge of each `walk` rect — the other three edges abut a
pavement, a building line or a corridor at the same height, and a face there would be a wall
across the footway. Which edge that is comes off `yKey` rather than a guess, and it reproduces on
chunk (3,2)'s delivered rects: **391.5 and 376.5, both exactly `roadHalfWidth` from 384**. The
albedo is the origin block's own ratio and not a new number: `matKerb` 0.3185 over `matPavement`
0.2582 = **1.2335×**, because an upstand is the same cast concrete and is not walked on.

**DELIVERED** at the same scanline: the band at the road edge goes **163 → 82** code values against
a pavement of 207 and a carriageway of 172. It is DARKER than the earth plane it replaces, not
lighter, because a vertical west-facing face under a 57.9° southern sun sees no sun and a fraction
of the sky — which is what a kerb looks like and is why it now reads.

**+954 triangles over the whole ground ring, ZERO draw calls, and NOTHING added to `rects`.** A
riser is not a surface anything stands on, and `rects` is what `surfaceAt` and the delivered
occupancy census read — a vertical face in that list would give the player a floor at the
pavement's height 0.18 m out into the carriageway. `windcheck` green: 563 of 563 cull-eligible
meshes decided, 0 wound backwards.

### 5.1 AND THE ONE STREET THE LOOK GATE STANDS IN HAD NO PAINT ON IT

`citygen.js` delivers **2 077 crossing stripes** over `citycheck`'s 10 × 10 (LOOK.md §4) and
`block.js` delivered **none**: no centre line, no lane line, no edge line, no stop bar, no zebra,
in 336 m of main street and 92 m of cross street. Searching that file for *"marking"* returns
nothing; the word *"crossing"* in it means the cross STREET. And that street is where `lookcheck`'s
camera stands, at `[70, 1.74, 0.9]`, and where `PLAYER.spawn` puts a person.

**IT IS A GUARD DOING ITS JOB.** `citygen`'s `paint()` refuses any mark whose footprint is not
covered by a DELIVERED `carriageway` claim, so that *"a road the river took, the block took or a
dome took has no lines painted in the air over where it used to be"*. `BLOCK_KEEPOUT` clips the
lattice's carriageway out of this block so that the authored asphalt wins — **so the lattice
correctly paints nothing here, and nothing else ever painted anything.** That is the third
different mechanism this session by which the origin block and the streamed city ended up as two
different cities, and the first one where the streamed city was the correct half.

The repair paints **exactly the ground the keep-out took**, so the two cannot double up, and every
dimension is `ROAD_MARKING` — eleven numbers exported from `citygen.js` where they were local
`const`s — with the thickness and reflectance in `constants.js` → `ROAD_PAINT`, which `city.js`
now reads from the same place. The zebra band is SOLVED with this street's own numbers rather than
copied: near ≥ `halfCross + 0.05` = 6.55, far ≤ `9.0 − 0.20 − 0.05` = 8.75, so **2.20 m of depth
centred on 7.65** — wider than the lattice's 1.20 m because this cross street is 13 m and not 15.

**ONE DRAW CALL, and §3.1 is why there was room for it.** Midnight road pools 9 → **12** against a
floor of 6. The four bands moved by 0.0002 to 0.0005 and all four are inside. **`lookcheck` went
back to RED at 3** and the third one is L15 — a bound with a margin of 0.0002 of itself, which the
paint spent.

---

## 6. GATE STATE

Run individually, because `npm run gates` is `&&`-joined and stops at the first red.

**THE WHOLE SET WAS RUN TWICE: once at `b757a37` in the first half (the block below), and again at
`8dfb614` after the second half's five repairs (§6.3).** Both runs are recorded because the second
half changed the light list, the rain and the mass count, and a reader should be able to see which
numbers moved and which did not.

### 6.1 THE FIRST-HALF RUN, AT `b757a37` PLUS R8

```
  parsecheck   GREEN   112 files, contract-clean. Unchanged from sessions 42-44 — this session
                       added no file; its five probes are in the scratchpad.
  faultcheck   GREEN   7 cases, quarantine surgical, the frame survives every one.
  windcheck    GREEN   567 meshes, 563 ok, 0 wound backwards, 0 unmeasured. The kerb risers of
                       §5 are inside `city:ground` and are in that count.
  inputcheck   GREEN   keyboard 3.477 / 3.500 m/s, gamepad look 177.88 / 180.00 deg/s,
                       mouse 40.0 cm/360 inside the 27.2-60 band, lock acquired.
  lookcheck    RED at 3. `band:dusk` CLOSED (§2) after four sessions red, and R8's road
                       markings opened `distinct:midnight|dusk` (L15) — a different assertion,
                       not the same one back. The other two, `facadeAlbedo` and
                       `facadeNeighbours`, are carried, are both about the origin block's facade
                       MATERIALS, and neither was touched this session.
                         band:midnight 0.0829   band:dusk 0.1412   band:dawn 0.3025
                         band:noon 0.4285       crushed black 0.576%   road pools 12 of 6
                         (before R8: 0.0826 / 0.1410 / 0.3020 / 0.4287, black 0.571%, pools 9)
  citycheck    RED at 3, THE SAME THREE as sessions 40-44, no new violation of any kind. §6.1
  perfcheck    RED at 13, of which ELEVEN are frame time at load1 2.48-7.18 and are not
               admissible, one is `night_rain`'s straddling frame mean, and ONE IS CONTENT —
               the carried vehicle tone-profile bar, eleventh session. NOT ONE IS A COUNT. §6.2
  gateaudit    RED at 1, AND IT IS TWO NAMES WHERE IT WAS THREE. "the unperturbed frames do not
               pass their own gate" now names facadeAlbedo and facadeNeighbours only —
               `band:dusk` is out of that list. Everything else green: `ok control — every
               assertion ran` (nothing suppressed), 74/74 perfcheck falsify cases at 100%
               coverage over 72 failure sites, 61/61 citycheck, 13/13 inputcheck, and both
               the §7.3 shape and §7.5 width control sweeps.
```

**WHICH GATE SAW WHICH COMMIT, SAID RATHER THAN ASSUMED.** All eight ran in one uninterrupted
block with nothing else launched, in `npm run gates`' own order, at commit **`b757a37`** — the
seventh code commit. **R8, the road markings, landed after that**, so `lookcheck`, `windcheck` and
`citycheck` were re-run against it (they are the three it can move) and their numbers above are
the post-R8 ones. `perfcheck` and `gateaudit` were NOT re-run: R8 is one instanced mesh of 340
boxes and one draw call, measured at every pose in §5.1, and the four routes have 45 draw calls
and 180 000 triangles of margin. `gateaudit`'s control will now name three assertions rather than
two, and L15 says which.

### 6.2 CITYCHECK IN THAT RUN — RED AT 3, THE SAME THREE AS SESSIONS 40–44

```
  clumping             CV 0.443    floor 0.60    untouched by instruction, fifth session
  sign quads inside    2 of 2720   max 0         the same two
  delivered overlaps   2           max 0         sign(adpillar) x prop(tree) 0.013 m2 and
                                                 sign(adpillar) x prop(planter) 0.086 m2
```

**AND THE LAMP-BOWL RATCHET PASSED AT ITS NEW BOUND**, which is the assertion §2's change had to
clear:

```
  lamp bowls   derived 1952.2 cd/m2 = phi/(pi*A) over a 0.42 m bowl, photocell on
               origin     delivered 1952.2 = 1.0000x derived, 16 meshes   ratchet [0.9999, 4.611]
               streamed   delivered 9000.0 = 4.6102x derived,  1 mesh     ratchet [0.9999, 4.611]
```

**TWO NUMBERS MOVED A LONG WAY AND BOTH MOVED THE RIGHT WAY:**

- **bright reserve 6.24% -> 6.83% -> 6.91%** against a 6.00% floor (per-run 6.92 / 6.45 / 6.91,
  spread 0.47, after R8). Attributable to §2 and §5.1: the origin block's sixteen bowls are 4.65x
  brighter and its street now has white paint on it, and `night_rain` runs through that block.
  **That is the largest margin this floor has ever had**, and it is the budget L1's window repair
  has to spend.
- **saturation peak 4.01% -> 4.57% -> 4.61%** against a 12% ceiling (per-run maxima 4.74 / 4.47 /
  4.61, spread 0.27, after R8). STATE 44 asked *"what took a third off the saturation peak, and does the estimator
  note still describe the gate it was written for"* — it has come back 0.56 points, still against
  a `$estimator` note recording six per-run maxima of 8.64 to 11.74 and calling the gate *"green
  by less than its own resolution"*. **It is green by 7.4 points now and the note is still wrong
  about which gate it describes.** Carried, unanswered, and the question is unchanged.

Everything else green: 0 of 3333 props inside a building, 5 sign mountings over 975 signs, 195
stalls of a floor of 60, 8 landmarks placed and 8 visible and 0 unreachable on foot, worst detour
1.46x, 5 eras, 3 road materials, 74.1% of 4982 objects off-axis, 341 instanced meshes with 341
labelled and 0 not.

### 6.2b PERFCHECK IN THAT RUN — EVERY COUNT, AND THE MILLISECONDS ARE NOT ADMISSIBLE

```
                       draws   draws s44      tris   tris s44   instances    inst s44
   downtown_dense        317         343     1.91M      1.87M     238 242     237 836
   highway_speed         395         439     2.18M      2.13M     312 306     312 006
   night_rain            316         342     1.88M      1.84M     292 561     292 225
   player                306         330     1.86M      1.81M     238 242     237 836
```

**THE DRAW-CALL CEILING IS NO LONGER THE LIMITER.** `highway_speed` reads **395 of 440** where it
read 439 for three sessions — **45 spare where there was one** — and every other route fell by
24 to 44. §3.1 is where that came from and it is one structural change, not a content cut: 2.5×
the street lamps went IN at the same time. **Every one of the four routes is down and every one
of the four carries more content than it did.**

The triangle ceiling is what moved the other way: 2.13 M -> **2.18 M of 2 360 000**, 7.6% spare,
because a city-wide merged mesh is effectively never culled. L2 is the pose where that matters.

`night_rain`'s frame ENTROPY went green on its own — 4.933 -> **5.184** against a floor of 5.0 —
and its frame MEAN is 0.0793 against a floor of 0.08 with per-run values 0.0793 / 0.0782 / 0.0813,
which is `$screenshotEntropy_s17`'s own straddling statistic doing exactly what that note says it
does. Neither has anything to do with rain: every route printed `rain 0.00 (now 5s, next shower
868s), 0 drops`, which is session 44's own print and §4 of that STATE explaining why.

**THIRTEEN VIOLATIONS, SORTED BY WHAT THEY ARE, AND NOT ONE IS A COUNT:**

- **ELEVEN ARE FRAME TIME** — four cpu p95, four wall p95, three "frames over 33 ms" — measured at
  `load1` 2.48 to 7.18 with a browser rendering. None is admissible in either direction. The
  closest to a real reading is `highway_speed` wall p95 **12.70 against 12.5**, which is 0.20 ms
  over: CONTRACT §0.1's founding incident is 0.10 ms over against a measured noise floor of
  0.40-0.80, and this run's own three-run spread on that statistic is 0.2.
- **ONE IS A FRAME-LEVEL STATISTIC**, `night_rain` mean luminance, above.
- **ONE IS CONTENT**, and it is the carried vehicle bar: *"only 63% of 70 vehicles carry a
  non-monotone tone profile (min 75%)"*. **Eleventh session.** Session 44's population went 23 ->
  68 -> 78 between runs of one gate; this run reads 70 and 63%, which is inside that spread.
- **NOT ONE IS A DRAW CALL, A TRIANGLE, AN INSTANCE OR A CLUSTER SLOT.** The 441 of 440 this
  session created at §3 is gone, and so are 44 draw calls that were there before it.

---

### 6.3 THE SECOND-HALF RUN, AT `8dfb614` — AND `gateaudit` REFUSED IT ONCE, CORRECTLY

Run individually and, after the first attempt, **run ALONE** — see the note at the end of this
section, which is a finding about the measurement and not about the city.

```
  parsecheck   GREEN   112 files, contract-clean. RED on the first attempt, on two ellipsis
                       characters in this session's own comments (R14). The file count is
                       unchanged from sessions 42-45: the second half added no file either, and
                       its four new probes are in the scratchpad beside the first half's five.
  windcheck    GREEN   563 of 563 cull-eligible meshes decided, 0 wound backwards. The 53 lamp
                       posts of §13 are boxes inside `#,#:masses` and are in that count.
  inputcheck   GREEN   keyboard, mouse and gamepad each deliver their own constant, the lock is
                       acquired, and the mouse is inside the usable band.
  faultcheck   GREEN   7 cases, quarantine surgical, the frame survives every one.
  lookcheck    RED at 3 — THE SAME THREE, and no band moved out of its own range. `band:dusk`
                       is still CLOSED, which is the first half's R2 holding through five more
                       repairs including sixteen new lights.
                         band:midnight 0.0828   band:dusk 0.1412   band:dawn 0.3025
                         band:noon 0.4285       crushed black 0.575%   road pools 12 of 6
                         distinct:midnight|dusk 0.02992 against 0.03000 — L15, and the second
                         half moved it 0.00003, three times the instrument's resolution and
                         nowhere near the floor
                         102 local lights at midnight and at dusk, which includes the 16 signs
  citycheck    RED at 3, THE SAME THREE as sessions 40-45, no new violation of any kind. §6.4
  perfcheck    RED at 13 — the same count as the first half and the same three categories.
                       ELEVEN are frame time at load1 2.7-4.2 and are not admissible in either
                       direction; ONE is `night_rain`'s frame mean, which was already red in the
                       first half and is redder now (L28); and ONE IS CONTENT, the carried vehicle
                       tone-profile bar, TWELFTH session. **NOT ONE IS A COUNT** — no draw call, no
                       triangle, no instance, no cluster slot and no role. §6.5
  gateaudit    RED at 1 on the re-run, AND ON THE FIRST RUN IT WAS RED AT 2 AND THE SECOND ONE
                       WAS THIS SESSION'S OWN (R16, below). The one that remains is the carried
                       control, which now names THREE assertions where the first half predicted it
                       would — `distinct:midnight|dusk`, `facadeAlbedo`, `facadeNeighbours`, which
                       are exactly lookcheck's three reds. Everything else green, including
                       `ok control — every assertion ran` (nothing suppressed), 74/74 perfcheck
                       falsify cases at 100% coverage over 72 failure sites, 61/61 citycheck,
                       13/13 inputcheck, and both control sweeps.
```

**`gateaudit` REFUSED THE RUN AND IT WAS RIGHT TO.** `budget.json` -> `lightRoles.floors` gained
`sign: 1` when the pool landed (§11.1). `perfcheck --falsify` measures every case against a GOOD
FIXTURE — a hand-written description of a world that passes — and that fixture predates the role,
so it declares no sign lights and the new floor failed it. perfcheck did the right thing with it:

```
  ✗ the GOOD fixture failed 1 assertion(s), so every case below is meaningless:
    highway_speed: only 0 lights with role 'sign' < 1
```

**It reported 74 meaningless passes as ZERO passes** rather than as 74. The FIXTURE is what moved,
not the floor — `$floors`' own sentence is *"a role that stopped being created reads as excellent
pool margin"*, and a floor withdrawn to make a stale fixture pass is that failure with a tidier
face. The other five rows of that fixture are deliberately NOT re-synced to the delivered city
(they read block 52 / lamp 196 / stall 8 against a delivered 56 / 192 / 12): they carry ceilings
only, the fixture describes a passing world rather than today's, and moving them is a change no
failing assertion asked for. **After the fix: 74/74 cases rejected, 72 failure sites, coverage
100%, and the good fixture passes clean.**

`gateaudit`'s remaining red is the carried control — *"the unperturbed frames do not pass their own
gate"* — which now names `facadeAlbedo`, `facadeNeighbours` and `distinct:midnight|dusk`, exactly
as L15 predicted at the end of the first half.

**AND ONE FINDING IS ABOUT THE MEASUREMENT.** The first `perfcheck` of this half was launched and
then `gateaudit` and `perfcheck --falsify` were launched beside it, so three browser harnesses
were contending on one machine; `load1` went to **5.42** and the run had to be killed at 14 minutes
having produced nothing. **Gates in this project are not concurrent-safe in the only sense that
matters — they measure a machine, and they are each other's load.** CONTRACT §0.2's bar of 1.6 is
about the operator's own machine being quiet; this is the same rule pointed inward. The run quoted
above waited for `load1` to fall below 4.0 and then ran alone.

---

### 6.5 PERFCHECK IN THE SECOND-HALF RUN — EVERY COUNT, AND THE ROLE THAT DID NOT EXIST

```
                    draws  s45 first half    tris   tris s45   instances    froxel margin
 downtown_dense       318         317       1.91M      1.91M     238 480     40  (was 57)
 highway_speed        396         395       2.18M      2.18M     312 551     79  (was 85)
 night_rain           317         316       1.88M      1.88M     292 804     43
 player               307         306       1.86M      1.86M     238 480     42

 roles   aircraft:1  traffic:96  stall:12  block:56  lamp:192  SIGN:16
         373 of 384, unrolled 0
```

**+1 DRAW CALL ON EVERY ROUTE, AND IT IS R12's LAMP POSTS** — L26 has the mechanism. `highway_speed`
reads **396 of 440**, so the ceiling the first half took from 439 to 395 is still not the limiter:
**44 spare.** Triangles are unmoved to three figures; instances are +238 to +245, which is the
posts.

**THE FROXEL MARGIN IS THE ONE COUNT THAT MOVED AND IT IS §11.3's.** Three of the four routes now
sit within 3 points of a floor of 40 where they had 57 to 85. L27 is why no further repair was
attempted and why the pool is still 16.

**THIRTEEN VIOLATIONS, AND THE SPLIT IS THE SAME AS THE FIRST HALF'S:**

- **ELEVEN ARE FRAME TIME** — four cpu p95, three wall p95, three "frames over 33 ms" and the
  headroom probe, measured at `load1` 2.7–4.2 with a browser rendering. Not admissible. The
  closest to a real reading is `highway_speed` wall p95 **12.70 against 12.5**, which is the same
  0.20 ms over that the first half recorded, with a three-run spread of **0.0**.
- **ONE IS `night_rain`'s FRAME MEAN**, 0.0771 against a floor of 0.08. Already red in the first
  half at 0.0793; L28.
- **ONE IS CONTENT**, the carried vehicle tone-profile bar: *"only 52% of 63 vehicles carry a
  non-monotone tone profile (min 75%)"*. **TWELFTH session**, and the population keeps moving
  (23 → 68 → 78 → 70 → 63) which is its own carried question.
- **NOT ONE IS A DRAW CALL, A TRIANGLE, AN INSTANCE, A CLUSTER SLOT OR A ROLE.**

---

## 7. HOW EVERY FRAME AND EVERY NUMBER IN THIS FILE WAS TAKEN

All at seed 1337, all `?paused=1`, all at 1.70–1.74 m on the street unless the pose says otherwise,
1280 × 720.

**FIVE PROBES, ALL IN THE SCRATCHPAD, NONE IN THE TREE.** `parsecheck` still counts 112 files.

```
  walkshot.mjs    MANY POSES, MANY TIMES, ONE BOOT — this session's camera. `lookat.mjs` takes one
                  pose per boot, and this session's job was fifty frames across four times of day
                  in two content paths, which is fifty boots through lookat and one through this.
                  It writes the draw call, triangle, wetness, clock, field-slot and chunk counts
                  beside every frame, so a frame taken mid-stream says so.
  patch.mjs       named rectangles as mean sRGB code values, and scanlines across a section. The
                  §4 and §5 numbers are scanlines rather than patches on purpose: a patch
                  straddling a boundary reports the boundary, and that is exactly the mistake the
                  first read of the origin block made here (a "1.20x" that was two shadow states).
  rainsweep45.mjs one boot, one pose, sweeping the three layers' `uNits` uniform live with the
                  clock paused. It is what produced §1's ×1/×8/×25/×70/×180/×400 arm, and its
                  FIRST version silently changed nothing because the regex was `/^rain_/` against
                  mesh names that begin `weather:rain_` — twelve frames of an unmodified build
                  that looked like a finding. CONTRACT §9's failure mode with a string again, and
                  `lookat.mjs`'s own header carries the same story about `split('=')`.
  raindiag.mjs    the instance census that answered §1's first question: how many streaks are
                  live, how many carry a gain, how many are IN THE FRUSTUM, and at what distance.
                  It is the probe that turned "the rain does not render" into "the rain renders at
                  8% of its own derived radiance".
  pick.mjs        raycast the delivered scene through one pixel and print what is there, with its
                  material. Two of this session's findings are one line of its output each: the
                  kerb is `block:ground`, and the white rectangle is a window at 220 cd/m². It also
                  produced this session's one WRONG reading — see §13 — because a street lamp's
                  bowl hangs 2.1 m out on its arm and a ray straight down from one correctly finds
                  nothing.
```

**FOUR MORE IN THE SECOND HALF, ALL SCRATCHPAD, `parsecheck` STILL 112.**

```
  diff.mjs        two frames in, a per-pixel difference map out — green where the second is
                  brighter, red where it is darker, x8 — plus the brighter/darker shares and the
                  largest single delta. IT IS THE INSTRUMENT THAT MADE THE SECOND HALF WORK: three
                  of its five repairs were invisible in a side-by-side and unmistakable in a
                  difference map, because auto-exposure pays for everything added and moves 30-80%
                  of the frame the other way.
  signsize.mjs    the sign population by mount, area and I = L·A, straight out of `citygen` with
                  no browser in it. §11's table.
  streakstat.mjs  the percentile structure of a rectangle, so a rain streak — a bright outlier on
                  a smooth sky — can be measured without the sky averaging it away.
  beamstat.mjs    reads `particleStats().beam`. §14 is the reason it exists: the claim being made
                  was "this adds variation, not level", the claim was FALSE by a factor of ten,
                  and no frame was going to say so.
```

**AND THE SECOND HALF ADDED TWO PERMANENT NUMBERS TO THE WORLD**, both for the same reason —
a claim that no frame can check:

```
  city.stats().signsActive / signCandidates / signPool     §11.1
  weather.particleStats().beam {mean, min, max, n, sources} §14
```

**THE TWENTY-ONE FRAMES THIS FILE CITES**, all in `tools/shot-out/` and all regenerable from the
`spawn=` links in §0 (the directory is gitignored, so a fresh clone has to take them again):

```
  s45-rain-before-t0-wet.png        rainfall=1 at HEAD, and you cannot tell it from
  s45-rain-dry-air-t0-wet.png       rainfall=0, which is beside it for exactly that reason
  s45-rain-after-t0-wet.png         the same pose and the same parameter, after R1/R5
  s45-rain-daylight-t0_5.png        L4 — rainfall=1 at noon, and still nothing

  s45-lamp-before-t0-wet.png        the origin block's pavement at midnight, one lamp in frame
  s45-lamp-after-t0-wet.png         after R2, R3, R4, R6 and R8
  s45-junction-t0-wet.png           a streamed junction: the staggered line on BOTH kerbs
  s45-viaduct-t0-wet.png            the main street under the deck — the session's best frame
  s45-city-road-after-t0-wet.png    the §4 pose at midnight, wet

  s45-road-before-t0_5-dry.png      noon, the concrete district: pavement 202, road 188
  s45-road-after-t0_5-dry.png       after R4 and R6: 206, 170, and a kerb at 82
  s45-marks-before-t0_5-dry.png     the origin block's cross street as one flat plane
  s45-marks-after-t0_5-dry.png      after R8
  s45-marks-junction-t0_5-dry.png   the same street looking along it

  s45-window-blown-t0-wet.png       L1 — a 220 cd/m2 window at 5.87 m owning a fifth of the frame
  s45-window-slab-t0_78.png         L1 at dusk, the same panel as a flat pale slab
  s45-arch-triangles-t0_5.png       L2 — 2 396 028 triangles at street level
  s45-weir-lid-t0_5.png             L3 — 44 100 m2 of pale nothing from the pavement
  s45-empty-districts-t0_25.png     L13 — five blocks of paving with nothing on them
  s45-one-hue-dusk.png              L12 — one colour, 180 m up
  s45-pillar-slivers-t0-wet.png     L9 — a correct 748 cd/m2 panel seen edge-on at 2.6 m
```

**AND THE SECOND HALF'S**, same directory, same rule:

```
  s45-sl2-before-bigroof-t0-wet.png   R9 — a facade at 1.013x an unlit control wall
  s45-sl2-after-bigroof-t0-wet.png    R9 — the same wall at 1.772x it
  s45-sl3-chroma-bigroof-t0-wet.png   R10 — the same wall again, red instead of neutral
  s45-crown-{before,after}-crowns-t0-wet.png    R11 — the crowns arrive on the road
  s45-post-{before,after}-carpark-t0_5-dry.png  R12 — the posts arrive under the heads
  s45-beam-{before,after}-underlamp-t0-wet.png  R13 — the rain redistributes toward the lamp
  s45-lean-{north,south}-t0-wet.png   L17 — the lean flips under a 180 deg yaw, so it is world
  w-{blockmain,citystreet,bigroof,retail,weir,arch,aerial,crossing}-t{0,0_25,0_5,0_78}-wet.png
                                      the walk — 8 poses x 4 times of day, one boot. L19, L20,
                                      L21 and L24 are each one of these thirty-two.
```

**EVERY FRAME WAS CHECKED FOR ITS SUBJECT BEFORE ANYTHING WAS MEASURED OFF IT**, which is STATE 43
§6's lesson. Three poses from the first batch were discarded for being blocked by a stall or a
sign panel at the lens, and they are why `walkshot` prints its counts per frame.

---

## 8. WHERE THE BRIEF DISAGREES WITH THE CODE

The brief asked for this section explicitly. **All four of its numbered claims are TRUE and one of
its SUB-claims is false**, and the false one is exactly the kind the brief warned about in its own
last paragraph:

1. **"The rain does not fall."** True, and the reason is not that the layers are dormant — STATE
   44's *"500 of 500 delivered"* is also true. A median streak renders at **7.2% of the radiance the
   module's own derivation names** — 0.497 scintillation × 0.517 min-extent widening × 0.280
   un-normalised profile = **0.136 cd/m² against a lit road at 1.4**, i.e. **0.097× the surface
   it is seen against**. Only the third of those three is a defect; the other two are the model
   doing what it says it does. §1.
2. **"The street lamps are four and a half times too dim."** True of the origin block exactly:
   0.2151× is 4.65×. **The brief's instruction to move the ratchet toward 1.0 "as far as the bands
   allow" allows ONE END AND NOT THE OTHER**, and the reason is printed in `constants.js`: the
   streamed city's correction is a DIMMING that costs 1.39 points of a bright reserve with 0.24 of
   margin. §2.
3. **"The carriageway does not read as a road in daylight."** True, and it is neither the earth
   plane (session 42 fixed that) nor a wet material nor the tone curve. It is **one albedo on a
   third of the city's chunks**, plus a kerb that was a hole. §4, §5.
4. **"Check whether the lamp POPULATION along a pavement is right, not only each lamp's
   brightness."** This was the largest of the four and the brief only asked it as an aside. §3.
5. **"Nine hundred and seventy-five signs and not one of them lights anything."** TRUE, and it is
   the item the first half of this session did not reach. The census the brief quotes is the
   evidence and it is exact. What the brief did not have is that **`block.js` has lit its five
   since session 3**, so this is the same two-content-paths class as claims 2 and 4 and not a
   missing feature. §11.

**AND ONE SUB-CLAIM IS FALSE.** *"The streaks LEAN HARD toward the right edge … orientation looks
like screen space or camera-facing rather than world."* **It is world-space**, the code says so in
a comment written before this session, and a 180° yaw flips the lean — which a camera-facing
billboard cannot do. L17 has the two frames. What the operator saw is the real wind lean plus
perspective convergence, which is asymmetric whenever the wind is not square to the view.

**AND ONE CONSTRAINT IN THE BRIEF IS STALE IN THE HELPFUL DIRECTION.** *"Draw calls 439 of 440. ONE
spare and it stays spare."* §3.1 of this same session took `highway_speed` to **395 of 440**. Every
repair in §11 to §14 still cost zero draw calls, so the spare is untouched either way — but the
sentence a future brief should carry is 45 and not 1.

---

## 9. WHAT WAS NOT DONE

- **The window radiance.** L1, and it is the biggest single finding of the session. Not repaired
  because it is a subtraction from a reserve with 0.24 points of margin.
- **No re-derivation of any threshold.** `look-budget.json` and `input-budget.json` are
  byte-identical. `city-budget.json` moves ONE number, `lampBowl.minRatio` 0.2151 → 0.9999, which
  is the tightening direction its own definition names. **`budget.json` gains a `sign` role
  ceiling of 16 and a floor of 1 — an ADDED bound for added content, not a moved one**; every
  existing number in that file is untouched.
- **`clumping` was not touched.** Red by instruction.
- **No quiet battery.** `load1` 2.48–7.18 in the first half and 2.69–3.04 in the second, never
  inside 1.6.
- **No merge to main.** Fourteen commits of code and four of documents on
  `claude/noctis-44-make-it-rain`, all pushed.
- **`minPairMSD` was NOT re-derived**, and R8 took it red by 0.00005. L15. It reads 0.02992 at the
  end of the session against 0.02995 after R8 — the second half moved it by 0.00003, which is
  three times the instrument's resolution and still nowhere near the floor.
- **L18, wetness above ground level**, is the one part of the brief's first item nobody has
  touched in either half of this session.
- **The window (L1) was still not repaired**, and L22 is why the next session should re-read the
  reserve before starting: it is 6.35% on the median with one run of three at 5.73, below the
  floor.

---

## 10. WHAT TO DO FIRST NEXT TIME

0. **L16, THE POSES THAT DO NOT REPRODUCE — BEFORE ANY OF THE REST.** Two of three street poses
   render differently in two boots of identical code at the same seed, one of them by 20% of the
   frame. **Every before/after pair in this project is a single-boot pair**, including most of the
   ones cited above, and this session already mistook boot noise for a result once. It is the
   cheapest item on this list and it decides how much the others' numbers are worth: take one arm
   twice at six poses, publish which poses are admissible, and put the check in `walkshot`.
1. **L1, THE WINDOW.** 220 against 7–30, one quantity in two files, and the same class session 28
   spent a session on for the lamp bowl. The first hour is the attribution: zero each path in turn
   and read the bright reserve, exactly as `$lampBowl_measured` did. **Read L22 FIRST**: the
   reserve the first half of this session left at 6.91 now reads 6.35 on the median with one run of
   three at 5.73, below the floor — so the margin this repair was promised is 0.35 and not 0.91.
2. **L15, `minPairMSD`.** R8 took it red by 0.00005 and it is owed a derivation, not a number: what
   is a pair of times supposed to differ BY, and is one figure right for `midnight ↔ dusk` — the
   only pair where both frames are lit by the same lamps — as well as for `midnight ↔ noon`? Five
   of the six pairs clear 0.03 by 0.02 to 0.17 and this one has never cleared it by more than
   0.0002 of itself. **Do not lower it to 0.029.**
3. **L2, THE TRIANGLE CEILING OFF-ROUTE.** A street pose at the arch is over it and no gate goes
   there. Either the four routes are not a sample of this city or the ceiling is not a ceiling.
4. **L4, THE BLEND MODE.** Daylight rain cannot work additively. This is a decision about what the
   layer is, not a measurement.
5. **THE DRAW-CALL BUDGET IS NO LONGER THE LIMITER.** 395 of 440, and 44 of the 45 spare were
   bought by ONE structural change (§3.1) rather than by cutting anything. Five sessions of items
   have been deferred with *"it costs a draw call"* beside them — the landmark/mass split (five
   calls, STATE 44 §9 item 11), the hologram's transparency (LOOK.md §3), the weir's ledge planters
   (LOOK.md §4, built and removed at 441). **They are affordable now, and the same merge is
   available again**: `#,#:masses` is 116 meshes and `#,#:windows` is 50.
6. **L12, COLOUR OPPOSITION — PART-SPENT AND WORTH FINISHING.** §11.2 put the signs' own chroma
   on the facades and moved one wall's R/B from 1.306 to 1.938, and half of `SIGN_CHROMA` is cold.
   The lever is the WINDOWS and the emissive materials, which are still warm and are still the
   larger area. The measurement to reuse is R/B on a named patch, and the trap to avoid is in
   §11.2: adding NEUTRAL light to a one-hue city makes it more neutral, not less.
7. **L18, WETNESS ABOVE GROUND.** The last untouched third of the brief's first item.
8. Everything else in §0's list, then STATE 44 §9 items 3, 4, 6, 7, 8, 9, 10 and 11, all carried.

---

## 11. THE 975 SIGNS LIGHT SOMETHING, AND `block.js` HAS LIT ITS FIVE SINCE SESSION 3

`perfcheck`'s own light-role census has printed `aircraft:1 traffic:96 stall:12 block:56 lamp:192`
for two sessions, and LOOK.md §3 carried *"there is no sign role, and there are 975 signs"* as a
FACT ABOUT THE LIGHT LIST. It is a defect. `block.js` lights every one of its five signs — the
`signLights` push at the foot of its sign loop — and says so in `BLOCK_RETAIL.shopLightSlots`'s own
derivation: *"this file delivers 32 lamp beams and 5 sign lights"*. **That is the fifth time in
this one session that two content paths turned out to be two different cities, after the lamp
radiance, the lamp population, the kerb and the road markings.**

**WHAT THE SIGNS ARE WORTH**, measured straight out of the generator over `citycheck`'s own 10 × 10
at seed 1337, as the Lambertian panel's normal intensity `I = L·A`:

```
  mount            n    median A    median I        max I     nits
  rooftop        340     40.0 m²   40 035 cd   217 320 cd     1000
  flush          181      6.3 m²      540 cd    11 269 cd       86
  projecting     176      5.3 m²      457 cd     3 223 cd       86
  roof            68      5.6 m²      478 cd    12 352 cd       86
  freestanding    39      2.6 m²      222 cd     3 312 cd       86
```

**243 OF THE 555 LIT SIGNS — 43.8% — ARE AT OR ABOVE ONE STREET LAMP'S 6 800 cd**, and every one
of them lit nothing. A rooftop cabinet at a median 40 035 cd is 5.9 street lamps hung over a roof.

**THE SOURCE IS A POINT ONE EQUIVALENT RADIUS BEHIND ITS OWN PANEL.** `lights.js` windows the
inverse square exactly as three does, so a light AT the panel is a 1/d² singularity on the wall it
is bolted to — 11 269 cd at the 0.12 m a channel-letter box stands proud of its masonry is
**780 000 lx**, and the wall goes white. A Lambertian disc of radiance L and area A delivers
`E(d) = π·L·A/(A + π·d²)`, and a point of intensity `L·A` placed `r = √(A/π)` behind the face
reproduces both of its limits exactly — `π·L` at the face and `L·A/d²` far away. **So the near
field is capped by the physics and not by a clamp**: the brightest thing any sign in this city can
do to what it is mounted on is 270 lx for a fascia and 3 140 lx for a rooftop cabinet, against a
street lighting design level of 16 lx. Between the two limits the shifted point is up to 2× darker
than the exact disc, which is the safe direction and is written in the constant.

**THE CONE IS THE FRONT HEMISPHERE**, `coneOuter = π/2`, or every sign lights the inside of its own
building. A double-sided sign gets one hemisphere and not two — under-delivery, and the alternative
is a second slot per sign.

### 11.1 THE POOL IS 16 AND THE RANKING IS THE HALF THAT MATTERS

A fixed pool assigned per frame, the same shape as `updateLampPool`, so the clustered count is
bounded by construction. `budget.json` → `lightRoles.$aircraft` states the spare in its own words —
*"357 of 384, and 27 spare"* — and the live census agreed exactly.

**THE RANKING IS `I·cosθ/d²` AND NOT DISTANCE**, which is where this differs from the pool it
copies. Every street lamp in this city is the same lamp, so nearest-first IS brightest-first for
them; signs span **222 cd to 217 320 cd, a factor of 979**. **The cosine is not a refinement.** The
first arm ranked on `I/d²` alone and handed most of sixteen slots to rooftop cabinets pointing AWAY
from the camera — candidates whose contribution to the frame is exactly zero, held against fascias
eight metres away lighting the pavement the player stands on.

Delivered, per pose: `citystreet` 6 candidates, `junction` 3, `retail` 9, `cabinet` 7, **`bigroof`
15 of 16**. So the pool very nearly binds at the densest pose and does not bind at the others —
**the limiter is the 128 m cutoff and the facing test, not the sixteen slots.**

```
  role census   aircraft 1  traffic 96  stall 12  block 56  lamp 192  SIGN 16
                373 of 384, unrolled 0, 11 spare
  cluster       overflow false at every pose, peak froxel 34-47 of 96 against a
                `minOccupancyMargin` floor of 40
```

**AND THE FIRST ARM SHIPPED A FRAME THAT WAS BYTE-IDENTICAL TO THE ONE BEFORE IT.** The resident
record in `city.js` is assembled FIELD BY FIELD rather than spread, so `signEmitters` — returned by
`buildChunk`, named in no field list — reached nothing. 16 slots, 0 candidates, and a pool whose
own boot line read correctly. It is CONTRACT §9's shape with a field name, and what found it was
adding `signsActive` / `signCandidates` to `city.stats()` rather than looking harder at a frame.

**DELIVERED**, at the pose that stands under a sign, as a RATIO INSIDE ONE FRAME — exposure pays
for what is added (CONTRACT §5.4), so absolutes are not the statement:

```
  a sign-lit facade against an unlit control wall in the same frame   1.013x -> 1.772x
  a second one                                                        0.077x -> 0.152x
```

and the lit wall rises **25% in absolute code value while the frame's own exposure falls 15%**.
**ZERO DRAW CALLS** — 118 / 103 / 299 / 250 / 147 / 292 identical in both arms at six poses.

### 11.3 WHAT IT COSTS, AND `perfcheck` NAMED IT

**THE POOL SHIPPED WITH A FROXEL BREACH AND THE GATE FOUND IT.** Each sign's falloff window was
sized through the Frostbite shoulder — `cutoffM × 1.82` = 233 m for anything bright enough to reach
that far, which is every rooftop cabinet. Optically that is right; `lights.assign()` disagreed:

```
                     worst froxel   margin   floor   before any sign light
  downtown_dense       58 of 96       38      40           57
  highway_speed        17 of 96       79      40           85
```

A light is written into every froxel its RADIUS SPHERE touches and the froxel loop is
`CLUSTER.maxPerCluster` long whatever is in it, so a 233 m sphere is **470× the volume of the 30 m
one a street lamp carries**. Capping the throw at `cutoffM` — one number for both the candidacy
test and the throw, so the pool's whole spatial extent is `2 × cutoffM` — takes it to **56 of 96,
margin 40**, which clears the floor. What it gives up is between a seventh and a twentieth of the
street's design level on surfaces a block and a half away: the largest cabinet delivers 2.4 lx at
128 m and 0.74 lx at 233 m.

**HALVING THE RADIUS DID NOT HALVE THE COST**, and the four static street poses moved by at most
ONE froxel (45 → 46, 34 → 36, 47 → 47, 41 → 39). A sphere that CONTAINS the camera is in nearly
every froxel whatever its radius, so the saving is on the route and not at the poses where the look
was measured — **no frame in §11 or §11.2 changes.**

**AND THE ATTEMPT TO SPEND LESS BY TAKING FEWER SLOTS WAS MEASURED AND REVERTED.** L27 is the whole
of that, and it is the more useful finding: twelve slots measured WORSE than sixteen on three of
four routes, which is causally impossible and therefore a statement about the instrument.

### 11.2 A SIGN THROWS ITS OWN COLOUR, AND IT IS FREE

`EMITTER_CHROMA` is **luminance-normalised — every one of `SIGN_CHROMA`'s six entries has
Y = 1.000, checked** — so carrying the sign's chroma into its light changes the HUE of what it
throws and not how much. The intensity derivation stands, and the light and the panel can no longer
disagree about what colour the sign is: both are `color[ch] × intensity` off one table.

**THE WHITE ARM WAS WASHING COLOUR OUT OF THE FRAME**, which is the finding. Measured on one wall,
7 700 pixels, as R/B:

```
  no sign light      R/B 1.620   Y 0.0763    the ambient sodium-lit wall
  white sign light   R/B 1.306   Y 0.0955    DESATURATED, a third of the way to neutral
  its own chroma     R/B 1.938   Y 0.0937
```

Adding neutral light to a city that is already one hue does not oppose that hue, it moves the wall
toward grey. Three of the six chromas are cold, so half of what the signs put on this city's
facades now fights the sodium the street lamps put there — LOOK.md §3's *"biggest unspent lever"*,
and L12's own frame is what it was spent against.

---

## 12. THE CROWNS' POPULATION SHARE IS 40.72 AND NOT THE STREAKS' 91.41

L5, opened by the first half of this session in as many words: *"R1 gives the streaks ×91.41 for
the drops below `DROP_MM`; the crowns did not get it, deliberately."* The 130 crowns stand for
every impact on the road exactly as the 500 streaks stand for every drop in the air, so they are
owed the same correction — **and a different number.**

A streak is a GLINT: its flux is the drop's projected disc, so the moment is D². A crown is DIFFUSE
FOAM RAISED BY AN IMPACT: what arrives is a FLUX of drops onto the ground and what each buys is the
AREA of the crown it throws, so the integrand is `N(D)·v(D)·A_crown(D)` with this module's own
`v = 3.78·D^0.67` and `A_crown ∝ D²` — **the D^2.67 moment.**

```
  streaks   D^2.00   all 1.2379e-1   D >= 3.28 mm 1.3543e-3   91.41
  crowns    D^2.67   all 1.3392e-1   D >= 3.28 mm 3.2889e-3   40.72
```

**0.445× the streaks'**, because weighting by `v` tilts the integral toward the large drops that are
already above the split. The first half of this session was right not to hand them the same figure.

**THE QUADRATURE CHECKS ITSELF.** 2.67 is not an integer, so there is no elementary antiderivative
of the kind `STREAK_POPULATION_SHARE` writes out; run at p = 2 the same integrator must reproduce
that closed form's 91.41, and it **throws** if it misses by more than 0.1%. It reproduces 91.405.

**DELIVERED**, midnight, wet, `rainfall=1`, camera low inside `SPLASH_RANGE_M`: crowns that were not
there are on the road — 2.27% of pixels brighter, max **+199 code values**, frame mean 21.22 →
21.29. 118 and 105 draw calls in both arms. `budget.json` is untouched: every bound in `particles`
is a count or an area and this is a radiance.

**WHAT IT COSTS, SAID RATHER THAN DISCOVERED LATER.** A crown is 0.0246 m across — about 2 px at
15 m and 10 px at 3 m, i.e. **RESOLVED in the near field**, unlike a streak which is sub-pixel
everywhere. So a near crown now renders brighter than foam at this road's illuminance can
physically be. The honest rendering of the same energy is more crowns rather than brighter ones,
and 130 is the instance ceiling.

---

## 13. FIFTY-THREE LAMP HEADS WERE HANGING IN THE AIR

Found by looking at a noon junction: dark ellipsoids floating in the sky. **The count says it
exactly** — over the resident ring at seed 1337, `city:bowls` has **497** instances and
`city:lamps` has **444**.

A street lamp pushes TWO matrices, a column into `lampBodies` and a bowl into `bowls`. The
`chunk.features` loop pushes a bowl AND NOTHING ELSE. Counted straight out of the generator over
the same 5 × 5 near ring: **36 `lamp` + 17 `flood` = 53**, the shortfall to the unit. Every park
lamp, every car-park column and every site flood mast in this city was a head with nothing holding
it up.

**IT IS A BOX IN `masses`, NOT AN INSTANCE OF `geometries.lamp`**, and the reason is the shape
rather than the budget: that geometry is a pole MERGED WITH ITS ARM, built for a lantern that
overhangs a carriageway from the kerb. These are post-top — the bowl is directly over the base and
the feature loop's own `dir: [0, −1, 0]` says so — so instancing the street lantern would stand a
2.1 m bracket beside every one of them reaching out at nothing. It is emitted just before `bodies`
closes into the chunk's `masses` mesh, gated on the same `near` the feature loop is gated on.

**ZERO DRAW CALLS AT EVERY POSE MEASURED** — 123 and 116 in both arms, +780 and +828 triangles,
which is 65 boxes at 12. **AND ONE DRAW CALL ON THE ROUTES**, which no pose showed and only the
route census did: `downtown_dense` 317 → 318 and `highway_speed` 395 → 396. A post is a box in the
chunk's existing `masses` mesh and is free — except on a chunk that had NO `masses` mesh because
nothing was standing on it, which is exactly a `park` or `parking` chunk with a lamp in it. L26.

**THE FIRST READING OF THIS WAS WRONG AND IS WORTH RECORDING.** The blob raycast first was a STREET
lamp's bowl, and a ray straight down from one correctly finds nothing, because the head hangs 2.1 m
out on its arm. **The count is what turned a suspicion into a defect, not the raycast.**

---

## 14. A DROP IN A LAMP'S BEAM, AND AN INSTRUMENT THAT CAUGHT ITS OWN AUTHOR

The operator's third observation and the one the brief said to do FIRST: *"session 44 lit the AIR
in that beam and left the DROPS out of it."* The first half of this session changed the streaks'
MAGNITUDE by 326.3 and left **every drop in the world at the same radiance**, which is a different
sentence. `STREAK_GLINT_NITS` is `F·L_bowl·dilution` — a constant — so a drop three metres from a
lantern and a drop fifty metres from any light were identical.

**WHAT THE VARIATION IS, AND IT IS NOT A TASTE.** A drop is a SPHERE, i.e. a convex mirror: it
intercepts `I·πr²/d²` from a source of intensity I, reflects a Fresnel fraction and spreads it over
the whole sphere. So the flux a drop sends to the eye goes as `I/d²` — **the illuminance at the
drop** — and not as the source's radiance. Sampled on the CPU into the per-instance gain the layer
already carries, off `lights.all()`, so it sees the street lamps, the shopfronts, the stalls and
§11's sign pool without any of them declaring themselves to weather. Bounded by construction: a
12-source shortlist rebuilt once a frame, so the inner loop is 500 × 12 and not 500 × 384.

**THE FIRST ARM WAS WRONG BY TEN AND ITS OWN INSTRUMENT CAUGHT IT.** Referencing the drops to
`STREET_DESIGN_LUX` = 15 gave a measured modulation mean of **9.794 and 13.619** — a tenfold
brightening of the whole layer wearing a variation's clothes, which would have moved R1's delivered
gain to **3 263**, an order of magnitude outside the 70–400 bracket the first half of this session
chose by looking at six frames. 15 lx is what the CARRIAGEWAY is lit to: a horizontal plane at
ground level, averaged between the poles. A drop is in the air from 0 to 12 m, beside an 8.08 m
lantern rather than under it. **The reference is the measured figure, 175 lx** (147 and 204 at two
poses), and `particleStats().beam` prints the mean so the claim is checkable rather than trusted.

```
  beam mean    0.840 and 1.167    bracketing 1, so this is VARIATION and not LEVEL
  beam range   0.007 to 3.43      a factor of 490 between the darkest drop and the brightest
  clamps       0.3 lx and 600 lx, in ABSOLUTE illuminance so they do not move when the
               reference is re-measured. 600 lx is 6800/d² at d = 3.4 m, where a lantern
               stops being a point source to a drop; 0.3 lx is this module's own
               "within a factor of two of full moonlight"
```

**DELIVERED**, midnight, wet, `rainfall=1`: frame mean **29.63 → 29.62** and **38.57 → 38.56** —
unchanged, which is the point — with 2.0% of pixels brighter and 2.1–2.8% darker and individual
drops up to **+218 code values**. The difference map is **red streaks on the dark side of the frame
and green streaks toward the lamp**. 119 and 107 draw calls, identical in both arms.

---

## 15. KNOWN GAPS CARRIED FORWARD

**Unchanged from s8–s44**: `stats().cutoffM` hard-codes 0.8, the headroom probe inert,
`saturation-peak.png` overwritten every run, `$fovYDrift`, `camera.setRouteAt(name, 1.0)` at the
sky, **right turns only**, sun shadows to ~170 m, the bake blind to elevated slabs, the PMREM
hitch, the too-red dawn horizon, one worker at queue depth one, the far half of the river handing
back to the night sky past ~300 m, grime authored, the near-field washboard on the water, the quay
wall inside the walkable mask, props absent from the walkability mask, the 3.5°–10.4° route camera
pitch, the frozen/running A/B, `materials.display` drawn by nothing, the hauler's marker row buried
inside its own body, the seeding fallback's untested placement, **a bus never turns**, the origin
block's absent occupancy registry, `facadeAlbedo` on its floor with zero spread, the station's
cores reading as an open frame, **nobody can climb the station**, the 0.10 m margin at the core's
outer face, `poseprobe`'s blindness to the origin block, one merged building pool breaching the
triangle ceiling, the station's platform slab hiding the train, `traffic.js:2346`'s claimed
draw-call margin of one, `minStraightness` and `minArrivalsPerMinute` having no gate reader, the
zero-second protected pedestrian phase, `landmarkBlocks` still exported and still disagreeing with
the registry two ways, **the basin is walkable in the mask and unwalkable in the geometry**, the
two `walkableAt` sites still blind to a basin, the quay walk's ulp exposure on four named chunks,
**`walkability` unreachable cells at 134 with no threshold reading it**, **the vehicle silhouette
tone-profile bar red on every reading for eleven sessions**, a gate message frozen in the present
tense of the session that wrote it, **a palisade that does not stop a pedestrian**, and **the two
delivered `sign ×` overlaps and the two sign quads inside a building**.

**CLOSED THIS SESSION:**

- **`band:dusk`**, red since session 40, closed by the origin block's lamp correction. §2.
- **"the pavement's missing kerb"**, carried since session 17's `walkprobe` — it was missing in the
  streamed city and it is a riser now. §5.
- **`tools/city-budget.json:84`'s stale `$derivation_count`**, carried since STATE 42.
- **The origin block having no road markings**, which nobody had noticed in forty-four sessions
  because the gate that counts markings counts the LATTICE's. §5.1.
- **The draw-call ceiling as the project's limiter.** 439 of 440 for three sessions; 395 now.
- **`LOOK.md` §3's *"there is no sign role, and there are 975 signs"***, carried since session 44
  as a fact about the light list. It was a defect and there is a sign role now. §11.
- **L5, the crowns' population share**, opened by this session's own first half and closed by its
  second. §12.
- **The operator's third rain observation** — a drop in a beam as dull as a drop in the dark. §14.
- **The claim that the streaks' orientation is screen-space.** It is world-space and a 180° yaw
  proves it. L17.

**NEW THIS SESSION — all of it measured, none of it inferred:**

- **A MEDIAN STREAK RENDERED AT 0.136 cd/m² AGAINST A ROAD AT 1.4** — 0.097× the surface it is
  seen against, and 7.2% of the radiance its own derivation names. §1.
- **ALL THREE PARTICLE LAYERS WERE DELETING ENERGY WITH THEIR OWN SHAPE** — 0.280, 0.481, 0.306.
  §1.2.
- **THE BILLBOARDS ARE 1.1% OF THE RAIN'S GLINTING CROSS-SECTION**, because `budget.json`'s split
  is about extinction and this is back-scatter. §1.1.
- **NO ROAD IN THE STREAMED CITY HAD EVER HAD A LAMP ON ITS −x OR −z PAVEMENT**, and 23–30% of its
  kerb length had no pole at all. §3.
- **STREET LIGHTING WAS ASKING FOR UP TO 70 OF 440 DRAW CALLS** and now asks for 2. §3.1.
- **THE CONCRETE CARRIAGEWAY IS 34.7% OF CHUNKS AND CAME IN DISTRICTS**, 14 code values from its
  own pavement. §4.
- **THE KERB WAS THE EARTH PLANE**, seen through a 0.180 m slot, on every street in the streamed
  city. §5.
- **EVERY WINDOW IN THE STREAMED CITY IS 220 cd/m² AND THE ORIGIN BLOCK'S ARE 7 TO 30.** L1.
- **A STREET POSE AT THE ARCH IS OVER THE TRIANGLE CEILING AND NO GATE GOES THERE.** L2.
- **FOUR TIMES IN ONE SESSION THE TWO CONTENT PATHS TURNED OUT TO BE TWO DIFFERENT CITIES** — the
  lamp radiance, the lamp population and the kerb, with `block.js` correct; and the road markings,
  with the streamed city correct. Every one was found by looking and none by a gate.
- **`distinct:midnight|dusk` HAD A MARGIN OF 0.00007 AGAINST AN INSTRUMENT THAT RESOLVES 0.00001**,
  and one street's worth of white paint spent it. L15.
- **243 OF 555 LIT SIGNS ARE AT OR ABOVE ONE STREET LAMP'S 6 800 cd** and every one of them lit
  nothing, while `block.js` had lit its five since session 3. §11.
- **ADDING NEUTRAL LIGHT TO A ONE-HUE CITY MAKES IT MORE NEUTRAL, NOT LESS** — a wall's R/B went
  1.620 → 1.306 under white sign light and → 1.938 under the signs' own chroma. §11.2.
- **`city:bowls` 497 AGAINST `city:lamps` 444** — 53 lamp heads with no post, which is exactly the
  36 park lamps plus 17 site floods the generator emits. §13.
- **THE RAIN'S BEAM MODULATION WAS WRONG BY TEN AND ITS OWN PRINTED MEAN SAID SO**, against a
  reference (the carriageway's design lux) that is the wrong plane for something in the air. §14.
- **TWO OF THREE STREET POSES DO NOT REPRODUCE BOOT TO BOOT**, one of them by 20% of the frame,
  and this session mistook that noise for a result once before it measured it. L16.
- **THE EARTH PLANE SPECKLES AT 1.9 km**, which is the colour repair of session 42 with its
  high-frequency half still open. L19.
