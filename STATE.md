# NOCTIS — STATE

*End of session 77. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`, 16 d 17 h of
uptime — the same boot as sessions 47–77. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` READ 1.60 AT THE START OF THIS SESSION*** — **exactly CONTRACT §0.2's bar**, for the
first time in seventeen sessions. It did not stay there; each gate below prints its own.

Branch `claude/noctis-77-instruments-and-the-quay`, off session 76's head.

**THE INSTRUMENTS, AND THE QUAY.** Five items, four of them repairs to the things that measure.

**THE FRAMES, AND `--t=0` OR THEY PROVE NOTHING:**

```
  node tools/lookat.mjs --preset=sea-harbour,sea-road --t=0
```

Those two are the OPPOSED BEARINGS and they already were: `sea-harbour` stands in the fairway 106 m
off the berth looking ESE, `sea-road` stands on the yard looking WSW. Between them they show the
quay lit and the yard not, which is exactly what was built.

---
## 0. HOW MANY OF THE FOUR STANDING REDS SURVIVE AN HONEST ENTROPY FLOOR — ALL FOUR

Four gates have been red since session 53 and the brief's premise (ii) was that at least one would
not survive. **It is false, and the arithmetic is not close.**

```
  lookcheck    3 violations — distinct:midnight|dusk, facadeAlbedo, facadeNeighbours.
               NONE IS ENTROPY. Survives untouched.
  gateaudit    red DOWNSTREAM of lookcheck, with no assertion of its own about entropy.
               Survives as long as lookcheck does.
  citycheck    4 violations — clumping CV, a sign inside a building, two occupancy rows.
               NONE IS ENTROPY. Survives untouched.
  perfcheck    FIFTEEN violations in session 76. TWO were entropy. Twelve remain (a third
               went with the fleet's new placement, see §9), and eleven of those are
               milliseconds under load, which CONTRACT §0.2 says are not verdicts in the
               red direction at all.
```

**THE ENTROPY FLOOR ACCOUNTED FOR 2 OF 15 VIOLATIONS ON ONE GATE AND 0 ON THE OTHER THREE.** It was
never load-bearing for a single gate's colour. What it was doing was worse than that: asserting a
property it cannot measure, in the one gate whose reds nobody reads any more because eleven of them
are the machine.

**AND THE HONEST NUMBER IS SMALLER STILL, BECAUSE THE CAPTURE WAS UNSETTLED.** §1 measured that
settling `perfcheck`'s screenshot lifts `downtown_dense` from 4.898 to 5.082 — over the OLD floor.
So one of the two entropy reds was the capture and not the content, and the floor change was never
what stood between that route and green. Both facts are stated together because either alone would
flatter this session.

---
## 1. `perfcheck` WAS THE LAST CAPTURE PATH IN THE PROJECT WITHOUT A `settle()`

**ITEM 1a — THE COST, BEFORE THE DECISION AND NOT AFTER IT.** `settle(4)` renders
`pad + 8 + TAA.settleFrames(32) + 4` = **44 to 51 frames, mean 47.5**. Twelve route captures plus
nine silhouette poses is 21 settles, about 1 000 frames, which at the 13–26 ms this machine delivers
is **18–26 s on a gate that takes 1 135 — under 2%.**

**WHAT IT WAS CAPTURING.** `waitForCity` polls a worker in blocks of ten frames, so the frame index
at capture is a wall-clock race — session 69 measured **2 808 to 3 038 over 35 runs of one source**.
`post.frameIndex` drives an 8-sample Halton jitter, and session 70 measured the eight phases of one
unmodified source differing pairwise by **57 801 to 78 979 bytes of 3 499 200**. On top of that the
TAA history was an 1 800-frame MOVING-camera accumulation and the exposure meter was wherever its
1.9 s time constant had reached.

**PLACED AFTER `report()` AND EVERY OTHER READ, AND THAT PLACEMENT IS THE WHOLE OF WHY IT IS SAFE.**
Every millisecond, draw call, triangle and census is already in a variable before the settle runs.
`highway_speed`'s 404 of 440 is four sessions old and is the number this project compares everything
against.

**ITEM 1c, MEASURED — `downtown_dense`, three runs, before and after:**

```
                        unsettled (s76)         settled (s77)
  draws                     326                     326
  triangles             2 114 082               2 114 082
  instances / materials 267 862 / 67            267 862 / 67
  entropy per run    [4.814 4.898 5.034]     [5.082 5.149 5.065]
  entropy spread          0.220                   0.084      2.6x tighter
  entropy median          4.898                   5.082
  mean per run       [.1108 .1177 .1226]     [.1243 .1278 .1241]
  mean spread            0.0118                  0.0037      3.2x tighter
```

> **THOSE TWO SPREAD FIGURES ARE ONE SAMPLE AND THE FULL BATTERY DID NOT REPRODUCE THEM.** See §9:
> across four routes settling moved the spread down on one and up on three, and this same route
> measured 0.084 in one settled three-run sample and 0.180 in another. The COUNTS below are the
> result; the spread reduction is not.

**NOT ONE COUNT MOVED AND BOTH LEVEL STATISTICS DID.** That is item 1c's warning arriving: **every
`entropy` and `meanLuminance` figure in every STATE before this session describes an unsettled
capture** and is not comparable with what this gate prints from now on. The timing series, the draw
calls, the triangles and every census are unaffected by construction and were measured to be.

One instantaneous stat moved as it should: peak froxel occupancy on that route reads 44 of 96
against session 76's 49 — a per-frame state, 47 frames later, not a count of content.

---
## 2. THE ENTROPY FLOOR ASSERTED A PROPERTY IT CANNOT MEASURE

### 2a. WHICH ONE WAS LYING — THE COMMENT, AND IT WAS ESTABLISHED FROM THE CODE

`perfcheck.mjs:1297` is `entropy: median(perRunLevel.map(s => s.entropy))` and `assertRoute` reads
`metrics.entropy`. **The code pools.** The log line saying *"ASSERTED ON THE LAST OF THESE, NOT
POOLED"* has been false since session 21 and **printed its own refutation every run**: session 76
delivered `[4.814 4.898 5.034]` and asserted **4.898**, which is the median.

It was checked from the source and not from that coincidence, because an output that agrees with a
comment by accident is how this survives. Repaired, and the spread — computed since session 21,
never printed — is printed beside the estimate now.

### 2b. AND THE FRAME ON DISK WAS NOT THE FRAME ASSERTED ON

`perf-out/<route>.png` was `last.shot` while both level statistics are the median of three. Session
76 failed `downtown_dense` on 4.898 and **wrote the 5.034 frame** — the run that passed. This gate's
own last line says *"look at them before changing any numbers in budget.json"*, so a reader who did
what it asked was looking at the wrong run. It writes the median run's frame now.

### 2c. THE FLOOR — 5.0 → 4.3, A REPLACEMENT DERIVATION AND NOT A LOWERED NUMBER

`$screenshotEntropy_s17` ends *"DO NOT LOWER THIS NUMBER AGAIN WITHOUT REPLACING THIS DERIVATION."*
This replaces it, and the reason is not that the gate was inconvenient.

**THE MEASUREMENT THAT KILLS THE OLD CLAIM.** One pose, two runs of `lookat --params=fill=0.0` and
`fill=1.0` — the two extremes of the frontage-fill law, a ~60% swing in the city's building
population and the largest content change one parameter can make here:

```
  entropy 5.338 -> 5.308   =  0.030 bits
```

against a run-to-run spread on the same routes of **0.220, 0.269 and 0.233**. **THE SIGNAL IS AN
EIGHTH OF THE NOISE.** No floor at any value separates a full city from a sparse one on this
statistic, so *"the screen is near-empty"* was never a threshold set too tight — it was a claim the
statistic cannot make.

**AND IT WAS NOT MONOTONE IN ITS OWN PROPERTY.** Normalised by `maxEntropyAtMean` — the ceiling this
gate already prints beside every entropy — session 76's four medians are `downtown_dense` **0.7685**,
`night_rain` **0.7923**, `player` **0.7833**, `highway_speed` **0.8653**. **THE TWO RED ROUTES
BRACKET THE GREEN ONE.** 5.0 is an absolute floor on a quantity the mean bounds, so it discriminated
by BRIGHTNESS — exactly the defect `$screenshotEntropy_s16` proved for 6.8 and only half-corrected,
by lowering the number instead of removing the mean-dependence.

**AND THE NOISE HAS A NAME THAT SESSION 17 ALREADY WROTE DOWN**: *"a vehicle coming to rest at the
lens"*. `player` is the only one of the four routes that walks the PAVEMENT rather than the crown of
the road, so nothing can drive past its lens — and its entropy spread is **0.015**, a fifteenth of
the other three. Session 76's delivered `downtown_dense` frame has a car filling the bottom fifth of
it. **It is the same mechanism as §4's `trade-*` frames: one defect wearing two instruments.**

**4.3 IS TWO-SIDED AND MEASURED** over 30 real frames on disk put through this gate's own
`imageStats`. From above, the twelve delivered observations span 4.814–6.944. From below, the
emptiest real frames this renderer makes are the countryside at midnight — `country-car` reads
**3.825** with 99.0% of its surfaces under 16/255 and no carriageway visible in it — and the
airfield's darkest committed poses read 3.269–3.853. The gap is **3.853 to 4.814**; its midpoint is
4.33 → **4.3**, clearing both populations by 0.45–0.51 against a worst spread of 0.269. Both margins
are 1.7x the noise. 5.0 was never clear in either direction.

**THE WEAKNESS, STATED:** the lower anchor is a different SCENE, because nothing in the harness can
render a route pose with its world removed. A session that adds that capture should re-derive.

**AND A SECOND FALSIFYING CASE, BECAUSE THE FIRST HELD NOTHING HONEST.** `solidPNG(128)` reads
entropy 0 and would reject at a floor of 0.5 — it proves the assertion is WIRED and nothing about
its VALUE, and the value is what moved. `levelsPNG(16)` is **exactly 4.000 bits** (verified: k
levels give log2 k), so it rejects at 4.3 and would pass anything at or under 4.0.
`perfcheck --falsify`: **75/75 rejected, 72 sites, coverage 100%.**

---
## 3. THE POSE AUDIT — AND THE GENERATOR IS THE FINDING

Seven of the twenty-three presets come from one loop that stands the eye back by
`max(70, height*1.5, halfExtent + 55)` and snaps one axis to the 128 m road lattice. **That formula
guarantees the landmark FITS IN A 55 DEGREE FRAME. It never asks whether anything is in the way** —
and `tools/poseprobe.mjs` has existed since session 26 to ray-test exactly that. The generator does
not call it. **A mechanism exists and nothing calls it: the seventh instance.**

Ray-tested against the delivered building occluders, and then the accused were LOOKED AT, which is
the half that mattered:

| pose | verdict |
|---|---|
| `weir-street`, `stack-street` | blocked, already recorded. The calibration — both fall out of the arithmetic alone. |
| **`condenser-street`** | **THE EYE STOOD INSIDE THE DISH.** Confirmed by frame. |
| `arch-street` | accused of 0% visibility; **THE FRAME REFUTES THE MODEL** — a leg and its stays are there. It still does not read as a 96 m arch. |
| `sea-road` | STATE 70 §3e recorded *"does not show the sea"*. Never fixed; four commits have touched that file since. |
| `af-approach` | proves its approach row and threshold. Its *"and the runway edge rows"* is **4 stations of 50**. |
| `mast-street`, `dish-street`, `exchange-street` | clear. |

**THE ONE REPAIR.** The stand-off comment already says the eye is kept *"outside ITS OWN footprint —
a 44 m overhang seen from 30 m inside it is a photograph of a ceiling."* **There are eight landmarks
and the guard was written for one**, so the snap that puts the eye on a carriageway was free to put
it under a neighbour. Measured over all seven: exactly one is inside another's AABB.
`condenser-street`'s `rawX` = −149.2 snaps to **−128**, a road line through the DISH at (−150, −160)
— eye-to-dish axis 25.7 m against a 48.2 m half-extent. **The delivered noon frame is the underside
of the dish across 60% of it, with the 260 m condenser it is named for nowhere in it.** A photograph
of a ceiling, as promised, from the landmark next door. The guard tests every landmark now;
`condenser-street` moves −128 → −256 and no other pose moves.

**AND THE REPAIRED FRAME STILL DOES NOT SHOW THE CONDENSER.** Removing the ceiling did not deliver
the subject — the street canyon is in the way, which is `stack-street`'s defect and needs a re-sited
eye rather than a snap. **A pose can be wrong in more than one way at once, and fixing the one you
measured does not make the frame true.** Recorded rather than patched.

LOOK.md §7 carries the rule now, beside the band rules: **a pose is stated with what it proves, and
a night subject is shot from two opposed bearings.**

---
## 4. THE FOUR `trade-*` FRAMES ARE REPRODUCIBLE, AND IT WAS ONE LINE

Session 70 measured them differing run to run by 3.1–8.1 MB, *"entirely THE VEHICLES, with the
buildings, road, pavement, pedestrians and street furniture identical to the byte"*, named it a
second race orthogonal to the jitter phase it had just repaired, and did not chase it. STATE 69 §8
item 3 has carried it since. **No code was ever written against it.**

**AND THE RECORD WAS WRONG ABOUT THE MECHANISM.** STATE 69 says traffic *"reseeds against the
resident ring, which arrives on the worker's schedule"*. Every refusal `seed()` consults —
`riverNoRoad`, `landmarkOccupies`, `blockNoRoad`, `cityExtentAt` — is a **pure function of position
and rootSeed**. Not one reads a streamed chunk. The worker's schedule reached the fleet through the
**FRAME COUNT**:

```
  traffic.js   if (rng.next() < 0.004) veh.latTarget = rng.range(-1.1, 1.1);
```

draws from the shared `traffic:layout` stream **every frame, per moto, unconditional on dt** — and
`ctx.rng` caches one stream per name, so its POSITION is state. 17 motos of 120 at seed 1337, so the
stream advanced **~17.07 draws per rendered frame**, under `?paused=1`, where nothing moves at all.
`setShot('trade')` then jumps the camera **433.75 m** against `SIM_RADIUS` 190, so every one of the
120 bodies fails the ring test on the next rebuild and is recycled through `seed()`: **7 272 draws
in one frame**, from wherever the stream had reached — `240 + 7 272 + 17.07*F`, with `F` the frames
since boot, which `waitForCity` sets in blocks of ten on a worker's wall clock. **Ten frames moves
the stream 171 draws and re-places the whole fleet.**

**MEASURED, TWO RUNS EACH, md5 of all four `trade-*` frames:**

```
  before   A  d774f2bd  0bb28eac  b3fa07b7  49f51122
           B  7a7f6527  48b40b64  21fe2092  44046210     ALL FOUR DIFFER
  after    E  6e31e5e4  6e5e2d43  61480ac7  e26bc4c9
           F  6e31e5e4  6e5e2d43  61480ac7  e26bc4c9     ALL FOUR IDENTICAL
```

**AND IT COSTS NOTHING.** Every look band unchanged to the printed digit — midnight 0.1096, dusk
0.1552, stddev 0.139/0.129, emitters 84/76, `distinct:midnight|dusk` **0.02846** — the identical
three violations and no new one. `highway_speed`: **404 draws of 440, 2 466 960 triangles**, 348 868
instances, 73 materials, froxel 17 of 96. Sessions 73–76 exactly.

The gate is correct on its own terms too: a per-FRAME Bernoulli trial makes a moto change its mind
twice as often at 120 fps as at 60.

> **A FIRST ARM GATED ON `step`, WHICH IS NOT IN SCOPE THERE.** It quarantined the whole traffic
> module, and both runs came back byte-identical — *a frame with no vehicles in it trivially is* —
> which looked exactly like success. `lookcheck` printed `hard:console` and `hard:faults:midnight`,
> and CONTRACT §2.1's quarantine is what stopped a green-looking artefact from being believed. **The
> near-miss is worth more than the fix and it is recorded in the source beside it.**

---
## 5. THE QUAY, AND FOUR DEFECTS IN THE THREE MASTS THAT WERE THERE

**Measured at `sea-harbour`, t=0, dry, across the session:**

```
                       s76        after §6      after the masts
  lamp pool          2 of 2       2 of 2           5 of 5
  clustered            99            3                7
  peak froxel       96 of 96      3 of 96          6 of 96
  median surface    0.1291       0.1292           0.1903        1.47x
  p90 surface       0.382        0.382            0.514         1.35x
  max               3.89         3.89             5.67
  under 16/255      96.6%        96.6%            93.1%
  draws               78           78               78
```

The median moves only 1.47x because most of that frame is open water — the camera stands 106 m off
the berth in the fairway. **What moved is the SUBJECT**: the quay is a lit strip with its pool on
the concrete, the crane rails and bollards are legible, the water carries a sodium reflection the
length of the berth, and **the gantries are dark steel against lit ground** — which is session 71's
whole argument working for the first time, because until now there was nothing behind them to be
dark against.

**`LIGHT.quayFloodCandela` IS DERIVED AND NOT BORROWED.** EN 12464-2's exterior-work table gives a
cargo quay's *"cargo handling, loading and unloading"* **30 lx at Uo 0.25**, against ICAO's 20 lx on
an aircraft stand — 1.5x, because a gantry is putting a 30-tonne box on a lorry. Reusing 144 000
would have been §9.2 with a number this project derived itself two sessions ago.

```
  mast 30 m on the YARD (y 8.470), aiming z -220 on the QUAY (y 2.117)
  throw 36.0   drop 30 + 6.353 = 36.353   slant d 51.16   depression 45.3 deg
  R >= 51.16/0.293 = 174.6 -> 180 m,   window (1 - 51.16/180)^2 = 0.5123
  I = 30 x 2617.3 / 0.5123 = 153 275  ->  153 000 cd
  BACK-CHECK  I*w/d^2 = 29.95 lx.
  RATIOS: 1.06x an apron mast, 2.55x a site flood, 42.5x a yard flood, 22.5x a street lamp,
  from a mast 1.20x an apron mast's height.
```

Two independent derivations landing 6% apart is the reassurance that neither was fitted to the
other: 1.5x the illuminance over a 0.85x shorter slant nearly cancels.

**FOUR DEFECTS IN SESSION 71'S THREE MASTS, none of them the one session 71 was fixing when it last
moved them:**

1. **THEY STOOD IN A MOVING STRADDLE CARRIER'S LANE.** `river.js` runs carrier 2 along z = −133 with
   a 5.0 m portal, swept band z[−135.5, −130.5]; all three masts sat at z = −134. The portal passed
   through each column once a stroke. Session 71 moved them out of the container blocks and into a
   vehicle.
2. **TWO OF THREE AIMED PAST THEIR OWN WINDOW.** One shared aim point at the quay's midpoint: slant
   167.0 / 91.9 / 153.9 m against `siteFloodRadiusM` 130, and the Frostbite window is **exactly zero
   at and beyond R**.
3. **THE AIM IGNORED THE 6.353 m TERRACE.** `city.js` took the drop as the mast's own height — true
   on a site, false on a quay, where `harbourSite` delivers two terraces. Delivered depressions 4.81
   / 8.77 / 5.22 degrees against the 15.8 the crane line needs, so **no existing mast's beam axis met
   ground inside its own radius**; the west one reached quay level 243 m out, over open water.
   `f.aimDrop` fixes it and defaults to 0, so every site and yard flood keeps the vector it had.
4. **THEY BURNED AT NOON**, because `updateLampPool` exempts a flood from the photocell by testing
   `l.candela === LIGHT.siteFloodCandela` — a VALUE standing in for a FIXTURE, §9's own shape. A quay
   flood carries a different candela and so follows the photocell.

**SIX MASTS IN THE ONE LANE THAT TAKES THEM.** The yard's only band clear of both container rows AND
all three carrier runs is z in [−188, −180.195], 7.81 m — the strip against the terrace edge. The
pitch is the quay's run over six, **74.67 m**, and `QUAY_FLOOD_OPTIC`'s 37 degree cone is solved FROM
that pitch. (The airfield solved its pitch from its cone; the same equation read the other way,
because there the apron's width was free and here it is not.)

**AND THE SEATS WERE CHECKED AGAINST ALL THREE COMMITTED POSES BEFORE THEY WERE WRITTEN.** Worst
plan clearance to any axis is **15.3 m**. `x = 4058` is absent on purpose: it is the obvious gantry
mid-gap and it is **2.8 m off `sea-road`'s axis** — session 76's mistake sitting in a different
landscape, waiting.

Sodium and not the apron's cold white, because session 71 built this harbour *"warm sodium outside,
cold fluorescent in"* and every outdoor emitter obeys it. Dark steel `[0.105, 0.115, 0.135]`, the
gantries' own: session 71 took the cranes off pale steel because *"pale steel goes white against a
lit sky"* and then stood three masts beside them in exactly the pale steel it had removed — a
decision made in the crane's branch that never reached the mast's. **A default that did not travel
FAR ENOUGH, at a range of thirty metres.**

---
## 6. THE SATURATED FROXEL WAS 96 HEADLAMPS ON A CAR PARK AT SEA

Session 76 read `clustered 99 resident, peak froxel 96 of 96` at the harbour twice and did not chase
it. 96 is both `CLUSTER.maxPerCluster` and `CLUSTER.trafficLightReserve`, so the print could not say
which. **It was the second: the whole traffic headlamp pool, stacked on seven points inside 4.41 m
of each other, 163 m out over open water.**

1. Outside `CITY.extentEdgeM` = 3 232 m there is no lattice, so all twelve candidates in `seed()`
   fail the extent test `traffic.js` has carried since session 34 and `best` stays null.
2. **THE FALLBACK HAS NO EXTENT TEST OF ITS OWN.** It parks the body at `cam.x + SIM_RADIUS*0.8` on
   the camera's own z-line. Its comment calls itself reachable *"only if the ring is degenerate"*;
   outside the city it is **every seed**.
3. The recycle pass then judges that same position off-road — on the `cityExtentAt(pos.x, pos.z) <= 0`
   line it already carries — and seeds it again. **Measured at the `sea-harbour` eye over 240 frames:
   28 920 fallbacks, 120.5 per frame. Every vehicle, every frame, forever.**
4. **THE ONE SWITCH THAT TURNS A HEADLAMP OFF IS DEAD CODE.** `lit = min(lampPool.length 96,
   lampOrder.length 120)` is always 96, which is `lampPool.length`, so `if (k >= lit)` never runs.
   All 96 have been lit everywhere in the world at night on `lampsOn` alone.
5. Identical positions give identical froxel boxes, so all 96 land in each of the same 18 froxels:
   peak 96 of 96, `clustersAtCap` 18, and **`overflow` FALSE** — the cap is breached on the 97th
   push, so a froxel that is exactly full reports clean.

This is STATE 75 §3's traffic-signal defect again, **in the same file, one function over**: a
predicate applied to the main path and not to the branch beside it. It is also the **sixth** "a
mechanism exists and nothing calls it".

**THE FIX DOES NOT ADD A SWITCH — IT MAKES THE DEAD ONE REACHABLE.** `seed()` records `veh.onRoad`,
false exactly when the fallback fires, and `lampOrder` is built from the bodies that are on a road.

```
                       before      after
  clustered resident      99          3
  peak froxel          96 of 96    3 of 96
  median surface       0.1291      0.1292
  under 16/255          96.6%       96.6%
```

**NINETY-SIX LIGHTS REMOVED AND THE PICTURE DID NOT MOVE** — a median that shifts by one part in ten
thousand. **A COST defect and not a look one**: a 96-iteration loop in every lit fragment of the left
19% of that frame, delivering nothing because the region is open sea and `HEAD_RADIUS` is 20 m.
Sixty sessions of frames could not have shown it.

**AND IT CANNOT MOVE THE CITY, BY ARITHMETIC AND THEN BY MEASUREMENT.** The street look eye before
and after: 296 draws, 29 of 29 lamp candidates, 3 of 3 sign, 105 clustered resident, peak froxel 26
of 96, adapted L 0.933811, median surface 0.97384, brightest 1938.36038. **Identical in every
figure.** Item 6c: the six new quay masts took the peak from 3 to 6 of 96 — they did not make it
worse.

---
## 9. THE COST

**ALL EIGHT RAN, ONCE. 4 OF 8 RED — THE SAME FOUR AS SESSIONS 53–76. NO FIFTH RED.**

```
  highway_speed   404 draws of 440              IDENTICAL TO SESSIONS 73, 74, 75 AND 76
                  2 466 960 tris of 2 630 000   IDENTICAL TO SESSIONS 73, 74, 75 AND 76
                  348 868 instances, 73 materials, froxel 17 of 96

  gate            exit   verdict   seconds  load1 in
  parsecheck         0     GREEN       3.7      2.85
  faultcheck         0     GREEN      28.3      2.85
  lookcheck          1       RED      50.8      3.04    THE IDENTICAL THREE
  windcheck          0     GREEN      40.6      3.52
  inputcheck         0     GREEN      17.5      4.45
  gateaudit          1       RED      77.8      4.50    downstream of lookcheck, as always
  citycheck          1       RED     127.8      4.10    IDENTICAL TO SESSIONS 57-76
  perfcheck          1       RED    1088.8      4.07    12 violations, down from 15
```

**`perfcheck` TOOK 1 088.8 s AGAINST SESSION 76's 1 134.8 WITH THE SETTLE ADDED** — the 2% it costs
is inside the run-to-run variation of the gate's own wall clock, which is the honest way to report a
2% cost on a machine at `load1` 4.

**`lookcheck` IS THE IDENTICAL THREE AND `distinct:midnight|dusk` READS 0.02846** — the same five
decimals as sessions 76 and 75, after a session that made every vehicle in the world reproducible.
**`citycheck` IS BYTE-IDENTICAL TO SESSIONS 57–76**: CV 0.393, 5 forbidden overlaps, 2 647 sign
quads, 1 004 of 284 918 bare samples, occupancy **18 799 / 19 087**.

**`perfcheck` WENT 15 VIOLATIONS TO 12.** The two entropy reds are gone, and so is
`highway_speed`'s roofline red — that third one is §4's doing, not §2's: the fleet is placed
differently now, and the silhouette sampler measured 57 vehicles where session 76 measured 73.
**Eleven of the twelve that remain are milliseconds and frame counts under `load1` 4.07**, which
CONTRACT §0.2 says are not verdicts in the red direction. The twelfth is the vehicle tone profile.

### AND THE BATTERY CORRECTS THIS SESSION'S OWN §1

§1 reports the entropy spread falling from 0.220 to 0.084 on `downtown_dense`, measured on one
`perfcheck --route=downtown_dense` run of three. **The full battery does not reproduce it:**

```
  route            s76 spread   s77 spread   s77 median
  downtown_dense      0.220        0.180        5.023
  highway_speed       0.269        0.307        6.784
  night_rain          0.233        0.262        4.859
  player              0.015        0.030        5.742
```

**Settling did not systematically tighten the spread.** One route fell, three rose, and the same
route measured 0.084 in one settled sample and 0.180 in another. **A three-run spread is not a
spread measurement**, which is CONTRACT §0.1's own subject arriving inside a number this session
quoted, and §1's "2.6x tighter" should be read as one sample and not a result.

**IT DOES NOT WEAKEN §2 — IT STRENGTHENS IT.** The signal a floor would have to resolve is 0.030
bits; the noise is 0.18 to 0.31 and is not reliably reducible by settling. What settling did buy is
what it was for: a fixed jitter phase, a dropped history and a converged meter, so the frame is a
picture of the content rather than of the wall clock.

**AND IT NAMES THE RESIDUAL COUPLING FOR THE NEXT SESSION.** §4 made the vehicles reproducible for a
PAUSED capture, and a perf route is paused — but `perfcheck`'s **300 warmup frames run with the loop
free-running before `setTimeOfDay` pauses it**, so `dt > 0` there and the moto line draws a
wall-clock-dependent number of times from `traffic:layout` before the route begins. That is the same
mechanism §4 closed, through the one door §4 left open.


---
## 7. WHAT TO DO FIRST NEXT TIME

**1. THE YARD IS 20 lx AND THERE IS NOWHERE TO PUT A MAST.** EN 12464-2 gives the container yard its
own level and §5 lit only the quay's 30. `sea-road` looks north across the yard and it is still
black. The mid lane leaves 2.31 m beside carrier lane 1 and the landward lane 2.31 m beside carrier
lane 2, against a 3.4 m pad. **A yard fixture has to be building-mounted, on the transit sheds**, and
it is a second derivation.

**2. `sea-road` DOES NOT SHOW THE SEA AND STATE 70 §3e SAID SO.** Seven sessions, four commits to
`poses.mjs`, none of them touching it. The mechanism is measured: the eye sits at `yardY + 1.6` =
10.070 m and the sight line crosses two container rows stacked 3–5 high. **It is the one liar in the
set that a taller eye fixes** — try `--pos=4132,18,-92`, the same x and z eight metres up.

**3. `condenser-street` STILL DOES NOT SHOW THE CONDENSER** — §3. `arch-street` and `stack-street`
are the same defect. The real repair is to make the `-street` generator call `poseprobe`, which has
existed since session 26 for exactly this.

**4. THE TERMINAL GLAZING IS A 3 600 m² LAMP AND IT LIGHTS NOTHING** — STATE 76 §3, unchanged. Two
lines through `pushSignLight`, which is already in scope at `glow()`. What it costs is
`SIGN_LIGHT.cutoffM`, and that one is not inert: 3 candidates against 16 slots at the street eye
means every new candidate lights.

**5. NINE FLOOD MASTS THREW A STREET LANTERN'S BEAM AND SIX OF THEM STILL DO.** §5 gave the quay's
its own optic; the six construction masts and the yard floods still inherit `LANTERN_OPTIC` — 68
degrees, sodium, elongated 2.39x across a road axis they do not have, with a 1/cos³ batwing peaking
57 degrees off nadir. Deriving a site mast's optic is a session's item.

**6. THE PHOTOCELL EXEMPTION TESTS A VALUE FOR A FIXTURE.** `l.candela === LIGHT.siteFloodCandela` is
how `updateLampPool` decides a flood burns by day. It is §9's shape and it is now load-bearing in the
other direction: the quay masts follow the photocell only because their candela happens to differ.
A `dayBurn` flag on the record is one line and nobody has spent it.

**7. `perfcheck`'s ENTROPY SPREAD IS 0.084 AND ITS SIGNAL IS 0.030.** §1 and §2. Settling took the
noise down 2.6x and the statistic still cannot resolve what a floor would want to assert. The
remaining noise is the vehicle at the lens; §4 made the vehicles reproducible for a PAUSED capture,
and a perf route is paused, so the next battery should show a smaller spread again. **Measure it
before deriving anything from it.**

**8. THE THREE STANDING ITEMS.** `citycheck`'s saturation peak is an extreme-value statistic with a
0.8-point spread and belongs under §0.1 like the rest; the headroom probe's `neverExceedNative`
defect is untouched; `AIRFIELD.edgeStepM` and `afPaint` are still declared and never read.

---
## 8. THE FOUR PREMISES

| | premise | verdict |
|---|---|---|
| (i) | settling `perfcheck` moves at least one of its printed figures | **TRUE, and only the ones it should.** Entropy median 4.898 → 5.082 and mean 0.1177 → 0.1243; spreads 2.6x and 3.2x tighter. Not one count moved: 326 draws, 2 114 082 triangles, 267 862 instances, 67 materials. §1 |
| (ii) | at least one of the four standing reds does not survive an honest entropy floor | **FALSE, and not close.** The floor was 2 of 15 violations on one gate and 0 on the other three. All four survive. And one of the two was the unsettled capture rather than the content — settling alone lifts `downtown_dense` over the OLD floor. §0 |
| (iii) | the `trade-*` divergence is in vehicle update order rather than vehicle geometry | **TRUE, and sharper than that.** It is neither order nor geometry but the POSITION OF A SHARED RNG STREAM: one line drew from `traffic:layout` every frame per moto, so a ten-frame `waitForCity` block moved the stream 171 draws and re-placed all 120 bodies at the trade reseed. Fixed; all four frames byte-identical over two runs. §4 |
| (iv) | the quay's repair is the airfield's, through the same existing call | **TRUE IN THE CALL AND FALSE IN THE NUMBER.** Same `flood` feature, same pool, same +0 on the binding route — but a cargo quay is EN 12464-2's 30 lx against an aircraft stand's ICAO 20, and the harbour has a 6.353 m terrace the airfield does not, which broke the aim vector for every mast session 71 built. Reusing the apron's number would have been the §9.2 this session found four more instances of. §5 |
