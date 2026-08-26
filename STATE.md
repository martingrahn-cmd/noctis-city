# NOCTIS — STATE

*End of session 44. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2 (24C101), `node v22.22.0`. The
machine has **NOT** rebooted since session 40 — 8 d 0 h of uptime at the first command against
session 43's 7 d 20 h, the same boot. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` RANGED 2.42 TO 3.56 ACROSS THE SESSION*** against CONTRACT §0.2's bar of **1.6**, and
`mediaanalysisd-access` held **97–100% of one core for most of it** — a Photos indexing pass, not
this project. **NO MILLISECOND IN THIS FILE IS ADMISSIBLE AS AN ABSOLUTE**, and §5.1 has the
demonstration rather than the assertion: `perfcheck` ran three times on content that never changed,
every COUNT agreed to the unit across all nine route measurements, and one run of `highway_speed`
read **31.4 ms cpu p95 against 11.4 ms for the same route ninety minutes earlier**. One of the three
invocations lost its last route to a browser crash. What is quoted here is COUNTS, RATIOS TAKEN
INSIDE ONE FRAME, pixel statistics, and arithmetic with no browser in it at all.

---

## 0. IT RAINS NOW, AND THE HALO IS 1.6% → 7.0%

```
  s44-rain-{before,after}-t0-wet.png     midnight, wet, on the carriageway, fov 55
                                         session 43's own haze pose, so the numbers compare
                                         294 draws in BOTH arms

  s44-lamp-{before,after}-t0-wet.png     midnight, wet, on the pavement looking down the
                                         street — a lantern at 20 m with the halo as the
                                         subject.  329 draws in BOTH arms
```

Both pairs are one build and one parameter: `--params=rainfall=0` against `--params=rainfall=0.6`.
Wetness is pinned at 1.0 in all four, so **the air is the only variable**.

**WHAT SESSION 43's INTEGRAL DELIVERS AT EACH RAINFALL.** Its 1.6% is a ratio — a ray passing 9 m
from a 6 800 cd lantern collecting 0.022 cd/m² against a road at about 1.4 — and the in-scatter is
linear in the medium's density, so the whole table is that figure scaled by
`hazeFor(r).density / ATM.hazeDensity`:

```
    rainfall   mm/h    sigma /m    visibility   x clear   in-scatter   % of a road at 1.4
      0        0.0     4.500e-4      8.69 km     1.000    0.022 cd/m2       1.6%
      0.17     1.7     9.595e-4      4.08 km     2.132    0.047             3.3%   mean instant of rain
      0.29     2.9     1.163e-3      3.36 km     2.585    0.057             4.1%   mean shower peak
      0.60     6.0     1.578e-3      2.48 km     3.506    0.077             5.5%   the "after" frames
      1.00    10.0     2.006e-3      1.95 km     4.457    0.098             7.0%   full rain
```

> **THE HEADLINE IS 1.6% → 7.0%, AND EVEN 7.0% IS AN UPPER BOUND.** The integral hands the rain's
> whole extinction to an isotropic phase function, and `weather.js`'s own note says half of a
> raindrop's `Qext = 2` is diffraction into a forward lobe of λ/D = 1.7e-4 rad — which a halo never
> sees. Discount that half and full rain is **4.4%**. The honest figure is the bracket **4.4–7.0%**,
> and neither end is a halo you would call a halo.

**AND YET THE FRAMES CHANGED, BECAUSE WHAT ARRIVED IS STRUCTURE.** §1.2 has the delivered numbers:
the air in a lantern's beam gains **18.5% on the road beside it** while a dark wall with no lamp
near it gains **1.7%**. The glow is where the lamps are and nowhere else.

**FOUR COMMITS OF CODE, ZERO DRAW CALLS, ZERO TRIANGLES, ZERO INSTANCES.** `highway_speed` read **439 of
440 draws, 2.13 M of 2 360 000 triangles and 312 006 instances** — every one identical to session
43's, to the unit. The one spare draw call is still spare.

---

## 1. NOTHING HAD EVER SET RAINFALL, AND THE BRIEF SAID TO CHECK THAT BEFORE BUILDING ON IT

It is true, and it was checked four ways before a line was written:

```
  main.js         `rainfall` is not in DEFAULTS, so it is not a CONTRACT §6 parameter and
                  no URL can set it. `createWeather()` was called with NO ARGUMENTS.
  weather.js      `createWeather`'s own cfg default is 0.
  camera.js       every route carries `t` and `wet`. None carries a rainfall.
                  `night_rain` is `wet: 0.85` and nothing else — a route named for weather
                  it has never had.
  the whole tree  `setRainfall` has exactly TWO call sites and both are the plumbing:
                  the module's own api and `harness.setRainfall`, which nothing calls.
```

`budget.json` → `capture.params` is `{seed, perf}`, so no gate could have passed one either.

**WHAT IS DORMANT AND WHAT RUNS, WHICH IS THE OTHER HALF OF THE QUESTION.** Everything wetness
drives has been running since session 33: the wet film, the puddle roughness, the Fresnel gate and
the drying law, at `main.js`'s `wet: 0.55`. Everything RAINFALL drives was dormant: the three
particle layers, the Marshall–Palmer split, the rain extinction, `setHazeOpenness`, and the whole
in-scatter multiplier session 43 built the integral for.

### 1.1 THE PARAMETER, AND THE WEATHER BEHIND IT

`rainfall` is a §6 parameter with the shape `fill`, `fieldDrip`, `ui` and `hud` already use:
**−1 defers, `>= 0` pins.** Behind the −1 is a shower cycle in `weather.js`, and it is a **PURE
FUNCTION of `time.now`** rather than an integrated state — so two captures at the same clock agree
whatever they stepped in between, which is the determinism defect that put `citycheck`'s saturation
peak 1.64 points apart on three identical runs.

**FOUR NUMBERS AND THREE OF THEM WERE ALREADY IN THE MODULE:**

```
  how long a shower lasts   sqrt(WET_TAU_FULL_S x DRY_TAU_S) = sqrt(18 x 3000) = 232.4 s
                            The geometric mean of this module's own two time constants. A
                            shower much shorter than the 18 s WETTING constant never wets the
                            road; one much longer than the 3000 s DRYING constant is not a
                            shower, it is a climate. The film depth cancels, exactly as it
                            cancels out of the module's own 166.7:1 asymmetry.

  how fast it arrives       RAIN_CLOUD_BASE_M / DROP_TERMINAL_MS = 800 / 8.378 = 95.5 s.
  and leaves                A shower cannot start faster than the column between the cloud
                            and the street takes to fill, or stop faster than it empties. So
                            the profile is a TRAPEZOID: the square wave is the shape that
                            claims the sky can switch.

  how often it rains        8% of hours, and it is the ONE number from outside — stated as a
                            citation so the next session can disagree with the climatology
                            rather than with the code. SITE.latitudeDeg is 40.0 and LOOK.md
                            §1's density reference is lower Manhattan.  Period 2905 s, 48 min.

  how hard it rains         NOT CHOSEN AT ALL. 1200 mm/yr over 8766 h at RAIN_FULL_MMH pins
                            the long-run mean of rainfall(t) at 0.0137; divided by the duty
                            and by the trapezoid's own mean of 0.589 that fixes the MEAN PEAK
                            at 0.290 = 2.9 mm/h. Peaks are the exponential's inverse CDF at a
                            golden-ratio sequence in the shower index, clipped at 1, with the
                            exponential's parameter SOLVED (0.3014) so the clipped mean lands
                            on the target. 3.6% of showers reach full rain.
```

**THE CONSERVATION CHECK IS INTEGRATED OFF THE DELIVERED FUNCTION AND PRINTED AT BOOT**, rather than
restated from the algebra that produced it. 1024 showers at 64 midpoints inside each:

```
  weather: ... DELIVERED long-run mean 0.01369 against 0.01369 required by 1200 mm/yr at
  10 mm/h (0.04%), integrated over 1024 showers.
```

**WHAT WAITING ACTUALLY GETS YOU, printed rather than left to be discovered.** The first four
showers after a boot, at `timeScale` 1:

```
    t = 14.5 min   peak 0.081   0.8 mm/h    drizzle
    t = 63.0 min   peak 0.580   5.8 mm/h    a proper shower
    t = 111  min   peak 0.193   1.9 mm/h
    t = 159  min   peak 0.028   0.3 mm/h
```

That sequence is an artefact of the equidistributed sequence's own offset and nothing else — it is
the distribution doing what a distribution does, and the *mean* is what was solved for. It is
printed here because "wait a quarter of an hour and it drizzles" is a legitimate thing to be
surprised by, and `?rainfall=` is the answer to it.

**AND THE PHASE IS NOT A NEW NUMBER EITHER.** `main.js`'s `wet: 0.55` is the drying law at THIRTY
MINUTES past a shower, and its own comment says the thirty minutes is the argument and the 0.55 is
the consequence. So the cycle is phased so `now = 0` lands exactly there: the last shower ended
1800 s ago, the road is at `exp(-1800/3000)` = 0.5488 and drying, and the two defaults now describe
one city instead of being two numbers that can drift.

### 1.2 WHAT IT DELIVERS, MEASURED AS A RATIO INSIDE ONE FRAME

Session 43's finding that **auto-exposure pays for anything added** is the reason absolute code
values across two frames cannot be compared: at full rain **76% of pixels go DARKER** and the frame
mean falls 34.64 → 31.84 cv. A ratio taken inside ONE frame survives that, and session 43's own
1.6% is already a ratio — in-scatter against the road it is seen beside.

**THE FIVE ARMS BELOW ARE ONE BOOT.** `rainsweep.mjs` loads the page once, sets the pose once and
sweeps `setRainfall` with the clock paused, so no vehicle, pedestrian or streamed chunk moves
between them and the air is the only thing that differs. That matters and it was found the hard way:
the same rectangles read completely differently on the DELIVERED frame pair, which is a separate
boot — `road_lit` is 98.31 cv in the sweep and 22.61 in the `lookat` capture, because a vehicle's
headlamp pool is in that rectangle in one and not the other. **Patch coordinates do not transfer
between two boots of this city**, and a ratio table has to come from one.

```
  patch, as a fraction of the lit road in the same frame        r=0      r=0.35     r=1.0
    the air in the lantern's beam, low                        0.2009    0.2145    0.2381   +18.5%
    the air in the lantern's beam, under the head             0.3066    0.3187    0.3375   +10.1%
    a dark wall with NO lamp near it                          0.0891    0.0899    0.0906    +1.7%
    the sky over the canyon                                   0.1313    0.1855    0.2302   +75.3%
    the far end of the street                                 0.4243    0.4126    0.4064    -4.2%
```

**THE 1.7% IS THE CONTROL AND IT IS THE POINT.** A wall with no lamp near it gains almost nothing,
because the light-haze integral only sums the froxel's OWN lights — so this cannot become a global
lift, which is what LOOK.md §3 refuses. The beam gains eleven times as much as the wall does.

The other two rows are aerial perspective doing what it should: the sky over the canyon nearly
doubles against the road (a low overcast lit by the city is what a rainy night has instead of
stars), and the far end of the street LOSES 4.2%, because at midnight extinction over 100 m takes
more out of a distant emitter than in-scatter puts back. Depth arrived as a cue, not as a wash.

### 1.3 AND IT STILL CANNOT LIGHT THE AIR AROUND A SIGN

Unchanged from session 43 and re-confirmed against a better instrument than last time.
`perfcheck`'s own light-role census enumerates **every light in the world by role** and prints it on
each route line:

```
    roles   aircraft:1   traffic:96   stall:12   block:56   lamp:192        357 lights
```

**THERE IS NO SIGN ROLE, AND THERE ARE 975 SIGNS.** Signs and windows are emissive MATERIALS with no
candela attached, so there is nothing for any scattering model to integrate — it is a fact about the
light list rather than a choice. The air glows around those 357 and around nothing else.

---

## 2. THE RAIN IS ALSO SOMETHING YOU SEE, AND ALL THREE LAYERS RENDER

The brief asked whether the streak, splash and spray meshes are dormant too. They are not — they
were never dormant, they were never *fed*. Measured live over five arms of one sweep:

```
    rainfall     rain_streak   rain_splash   rain_spray    draws    triangles
      0            0 / 500       0 / 130       0 / 70        294    1 360 340
      0.15       500 / 500     130 / 130       4 / 70        294    1 360 340
      0.35       500 / 500     130 / 130       4 / 70        294    1 360 340
      0.60       500 / 500     130 / 130       4 / 70        294    1 360 340
      1.00       500 / 500     130 / 130       4 / 70        294    1 360 340
```

**RAIN COSTS NOTHING AND THAT WAS CHECKED RATHER THAN ASSUMED**, which is the brief's instruction.
The three meshes carry `frustumCulled = false` and a 1e6 bounding sphere, so they are in the draw
count whether it is raining or not: turning the rain on moves no draw call, no triangle and no
instance. The second pose reads 329 in all five arms.

**HOW THEY READ FROM THE PAVEMENT, said as three separate answers:**

- **Streaks read.** 500 of 500, leaning 21° at 12 m under the module's 3 m/s wind, and clearly
  visible against the sky in the delivered frame. Against a dark wall they are faint — which is
  derived rather than a defect: `STREAK_NITS` is the glint case at 1.889 cd/m² and the module's own
  boot log says the ensemble mean is 2.55e-3 and "draws nothing".
- **Splash crowns are present and very faint.** 130 of 130 on the carriageway, staggered across
  their own 0.10 s life by `seedSplash` so a still frame catches them at every phase. On a wet road
  at midnight they are at the edge of visible. **This is the same shape as the carried "rain streaks
  near-invisible wide at night" gap, one layer over, and it is now measured rather than suspected.**
- **Spray delivers 0 to 4 of 70, and which one depends on the pose.** `sprayFollowsTraffic` is TRUE
  at every r > 0, so the carried "rain_spray 0 static" gap is closed — the layer does follow the
  traffic. What it cannot do is fill: `budget.json` sized 70 from "6 vehicles in the near field × 2
  wheel lines × 6 puffs", and a pavement pose has **no vehicles in the near field at all**. 4 of 70
  on the carriageway pose, 0 of 70 on the pavement pose.

---

## 3. THE WEATHER HAS STATE, AND THE BRIEF'S THIRD CLAUSE IS BACKWARDS BY A FACTOR OF 31

The brief asked for a city where "it rains sometimes, the streets stay wet for a while afterwards,
and **the air stays thick longer than the ground stays shiny**". The first two are delivered. The
third is not, and it is not delivered because this city's own physics says the opposite. Three time
constants, every one of them derived from a number already in the project:

```
    the drops fall out of the column     95.5 s    RAIN_CLOUD_BASE_M / DROP_TERMINAL_MS
    the street's air exchanges            329 s    a 19.7 m canyon at 0.02 x WIND_10M_MS
    the road dries                       3000 s    DRY_TAU_S
```

**THE GROUND IS SHINY 31× LONGER THAN THE AIR IS THICK.** And the 95.5 s is not a missing term —
it is `SHOWER_EDGE_S`, the trailing edge of every shower, so the air already stays thick for exactly
as long as it physically can.

The canyon height is worth its own line because it was measured rather than assumed: for an infinite
street canyon the sky view factor at the road centre is `sin(a)` with `tan(a) = (W/2)/H`, and
`canyon.roadSkyVis` is **0.51** at `CORRIDOR` = 11.7 m of half-width, which puts the walls at
**19.7 m**.

**THE ONE MECHANISM THAT COULD REVERSE THE ORDERING WAS COMPUTED, NOT DISMISSED.** A wet road
humidifies its own canyon and a humid aerosol swells. The film is 0.05 mm = **50 g/m² of water**,
and the saturation deficit at the 15 °C and 80% RH that `EVAPORATION_MMH`'s own Penman figure is
stated at is 2.56 g/m³ — so **the film holds enough water to saturate a 19.5 m column of its own
street's air, against a canyon measured at 19.7 m.** That coincidence is why it was worth taking
seriously. It still fails on the flux: 0.06 mm/h of supply against 0.06 m/s of exchange is a steady
excess of 0.28 g/m³, which raises the street from 80.0% to 82.2% RH, and `(1 − RH)^−0.65` on that is
**+7.8% of the aerosol = 3.5e-5 /m — 2.2% of the rain's own 1.5556e-3.** It also decays with the
wetted fraction, i.e. **with** the road rather than after it, and it would move eight look
assertions because `lookcheck` pins wetness to 1.0 in every wet frame it captures. It buys 2% of the
term it was meant to reinforce and none of the property it was wanted for. **It is not built, and
the whole derivation is in `weather.js`'s "what is deliberately not here" so nobody has to redo it.**

### 3.1 THE WATER'S CLOCK AND THE SUN'S CLOCK DISAGREE BY 72×

Building a weather cycle is what exposed this. `time.js` runs a **1200 s day**, so:

- `DRY_TAU_S` = 3000 s is **two and a half simulated days**. On the sun's calendar this city's roads
  take most of a week to dry.
- A cycle scaled to the SUN instead — a shower a day, which is roughly right for 1200 mm/yr — would
  rain every 20 minutes of wall clock onto a road that takes 50 minutes to dry, and the city would
  be **permanently wet**. That is the "always on" the brief refuses, arrived at from the other side.

**Rainfall and wetness are two halves of one water budget and have to agree with EACH OTHER before
either agrees with the sun**, so both are on `time.now`. The consequence is stated rather than
hidden: at `timeScale` 1 the shipped city rains for about four minutes in every forty-eight, and
`?rainfall=` is how you look at a shower without waiting for one — exactly the relation `?t=` has to
midnight.

---

## 4. NO GATE MOVED, AND THE REASON IS STRUCTURAL RATHER THAN LUCKY

The cycle is phased 1800 s past a shower, so the next one is **872 s away** at boot. That is the
margin every threshold in this project now silently depends on, so it was measured rather than
argued:

> **`runRoute` CALLS `setTimeOfDay`, WHICH CALLS `time.setPaused(true)`.** The simulated clock is
> FROZEN for the whole of every measured window. The longest route in the project — the player's
> **6000 frames** — leaves `time.now` at **5 s**, all of it the 300 warmup frames before
> `takeOver()`. **872 / 5 = 174×, and it does not depend on how fast the machine renders.**

**AND IT IS PRINTED NOW, BECAUSE A DEPENDENCY NOTHING PRINTS IS CONTRACT §7.1's OWN SHAPE.** Every
`perfcheck` route line carries `rain 0.00 (now 5s, next shower 868s), 0 drops`. A route that ever
rained would say so beside the numbers it invalidated.

### 4.1 THE LOOK BANDS: FOUR OF FOUR UNMOVED, THREE RUNS EACH

```
    band:noon       0.4288  0.4288  0.4288      s43: 0.4288    0.0000
    band:dawn       0.3021  0.3021  0.3021      s43: 0.3019   +0.0002
    band:dusk       0.1393  0.1393  0.1393      s43: 0.1393    0.0000   RED, carried
    band:midnight   0.0741  0.0741  0.0741      s43: 0.0741    0.0000

    crushed black at midnight   0.869 / 0.871 / 0.872 %   of a 2.0% ceiling  (s43: 0.873)
    frame sd at midnight        0.137                     floor 0.126
```

Run-to-run spread **0.0000 on every band over three runs** (a fourth run of `dusk` read 0.1392, so
the instrument's resolution is the 0.0001 it has always been). Dawn's +0.0002 against session 43 is
two counts of that resolution and the delivered field-slot count differed between the runs
(25/30 against 30/30), which is the known source. **NO BAND WENT RED AND NOTHING WAS OWED UNDER
LOOK.md §7** — the brief's re-derivation discipline was prepared for and, for the second session
running, not needed.

**AND THAT IS EXACTLY WHAT SHOULD BE ARGUED WITH.** The bands did not move BECAUSE the gates still
render clear air. If the operator wants the gates to measure a city it rains in, that is a decision
about what the instrument is for, and §9 item 2 carries it with the cost attached.

---

## 5. GATE STATE

Run individually, because `npm run gates` is `&&`-joined and stops at the first red.

```
  parsecheck   GREEN   112 files, contract-clean. Unchanged from sessions 42 and 43 — this
                       session added no file; its four probes are in the scratchpad.
  faultcheck   GREEN   7 cases, quarantine surgical, the frame survives every one.
  windcheck    GREEN
  inputcheck   GREEN   keyboard 3.468 / 3.500 m/s, gamepad look 178.08 / 180.00 deg/s,
                       mouse 40.0 cm/360 inside the 27.2–60 band, lock acquired.
  lookcheck    RED at 3 — band:dusk 0.1393, facadeAlbedo, facadeNeighbours. THE SAME THREE
                       as sessions 42 and 43, at the same values. §4.1.
  gateaudit    RED at 1, AND IT IS THE SAME THREE ONE LEVEL OUT: "the unperturbed frames do
                       not pass their own gate" naming band:dusk, facadeAlbedo and
                       facadeNeighbours. Everything else in it is green, including
                       `ok control — every assertion ran` (nothing suppressed), 74/74
                       perfcheck falsify cases at 100% coverage, 61/61 citycheck cases,
                       13/13 inputcheck cases, and both shape-control sweeps.
  citycheck    RED at 3 — the SAME THREE as sessions 40 through 43:
                 clumping CV        0.443    (floor 0.60, untouched by instruction)
                 sign quads inside      2 of 2720
                 delivered overlaps     2    both adpillar x prop, the same two
               Bright reserve 6.24% GREEN against 6.00 (per-run 6.47 / 6.16 / 6.24, spread
               0.31). 8 landmarks placed, 8 visible from elevation, 0 unreachable on foot,
               worst detour 1.46x. NO NEW VIOLATION OF ANY KIND.

               AND ONE NUMBER MOVED A LONG WAY WITH NO ATTRIBUTION, RECORDED RATHER THAN
               EXPLAINED: the saturation peak reads 4.01% (per-run maxima 3.93 / 4.04 / 4.01,
               spread 0.10) against a 12% ceiling. `city-budget.json` -> saturation
               `$estimator` records six per-run maxima of 8.64 to 11.74 and calls that gate
               "green by less than its own resolution". It is now green by 8 points. Nothing
               this session touched saturation — night_rain ran at rainfall 0 like every other
               route — so this is content from an earlier session, and it is a QUESTION for the
               next one rather than a claim from this: what took a third off the saturation
               peak, and does the estimator note still describe the gate it was written for?
  perfcheck    RED at 13 in the final invocation and 10 in the first — see §5.1. ONE of them
               is content (the carried vehicle tone-profile bar); the rest are frame time and
               two frame-level statistics, and NONE of those is admissible at load1 2.42–3.56.
               Every COUNT is identical across three invocations and identical to session 43.
```

### 5.1 PERFCHECK RAN THREE TIMES, THE COUNTS AGREED TO THE UNIT, AND THE MILLISECONDS DID NOT

Three invocations across the session — two complete and one that **lost its last route to a
browser crash** (`page.evaluate: Execution context was destroyed, most likely because of a
navigation`, on `player`, the 6000-frame route, on a machine with a 100%-CPU indexing pass running).
That is recorded rather than hidden: it is the second thing this session's machine did that a quiet
one would not have. **Every count is identical in all three, and identical to session 43's:**

```
                        draws     tris   instances       weather
   downtown_dense         343    1.87M     237 836       rain 0.00, 0 drops
   highway_speed          439    2.13M     312 006       rain 0.00, 0 drops
   night_rain             342    1.84M     292 225       rain 0.00, 0 drops
   player                 330    1.81M     237 836       rain 0.00, 0 drops
```

**`highway_speed` READS 439 OF 440 DRAWS, 2.13 M OF 2 360 000 TRIANGLES AND 312 006 INSTANCES** —
session 43 recorded 439 / 2.13M / 312 006. Not one unit moved. **The one spare draw call is still
spare**, and this session spent no part of the triangle or instance headroom either.

**THE MILLISECONDS, ON THE OTHER HAND:**

```
   highway_speed cpu p95     s43        11.50       11.50       12.90
     the three runs behind      —   [11.6 11.4 11.5]  [11.5 11.6 11.5]  [12.1 12.9 31.4]
     s43's own reading       10.70 to 11.20
```

**ONE RUN OF THE FINAL INVOCATION READ 31.4 ms ON A ROUTE WHOSE OTHER FIVE READINGS THIS SESSION
WERE 11.4 TO 12.9** — an intra-invocation spread of **19.6 ms** against a ceiling of 12.5. `player`
read 28.2 / 24.9 / 16.2. `load1` ranged 2.42 to 3.56 and `mediaanalysisd-access` held 97–100% of a
core for most of the session. **CONTRACT §0.2 is explicit about what that licenses, and it licenses
nothing:** not one millisecond here is admissible, in either direction, and the three invocations
disagreeing by 1.4 ms on the median while agreeing to the unit on every count is the cleanest
demonstration of that distinction this project has recorded.

**THE VIOLATIONS, SORTED BY WHAT THEY ARE.** Thirteen in the final invocation, ten in the first
(the two invocations that reached the end):

- **Seven to nine are cpu p95 or wall p95**, plus two "frames over 33 ms" that only appeared in the
  final invocation. All machine. None claimed either way.
- **Two are `night_rain`'s frame LEVEL statistics** — mean luminance 0.0698 against a floor of 0.08
  and entropy 4.933 against 5.0. Both are read off ONE screenshot and both are the statistic
  `budget.json` → `$screenshotEntropy_s17` already records as unpooled and straddling its own noise.
  The per-run means printed beside them are **0.0698 / 0.0743 / 0.0639** in the final invocation and
  **0.0721 / 0.0692 / 0.0688** in the first, so the assertion lands green or red depending on which
  run happens to be last. **Neither has anything to do with rain**: `night_rain` ran at
  `rain 0.00, 0 drops`, printed on its own line, like every other route.
- **ONE IS CONTENT**, and it is the carried vehicle bar:

```
   ✗ 60% of 68 vehicles carry a non-monotone tone profile (min 75%)     invocation 1
   ✗ 63% of 78 vehicles carry a non-monotone tone profile (min 75%)     invocation 3
                                                    s43: 65% of 23
```

**AND SESSION 43'S OTHER VEHICLE BAR WENT GREEN ON ITS OWN.** *"65% of 23 vehicles have a dark gap
at the ground"* was red in session 43 and is absent from all three invocations here — ground
contrast read 0.9267 / 0.8493 / 0.8025 and passed every time. **Nothing touched a vehicle in either
session.** §9 item 4.

## 6. HOW EVERY FRAME AND EVERY NUMBER IN THIS FILE WAS TAKEN

All at seed 1337, all `?paused=1`, all at 1.70 m on the street, all at `--t=0.0`, all `--wet=1`.

```
  1  node tools/poseprobe.mjs --target=8,8,90 --eye=1.7 --dmin=80 --dmax=80 --fov=55
     node tools/lookat.mjs --pos=1.03,1.70,169.70 --target=8,8,90 --fov=55 --t=0.0 --wet=1 \
       --name=s44-rain --tag=<before|after> --params=rainfall=<0|0.6>

  2  node tools/poseprobe.mjs --target=9.7,5,130 --eye=1.7 --dmin=110 --dmax=110 --fov=55
     node tools/lookat.mjs --pos=9.7,1.70,240 --target=9.7,5,130 --fov=55 --t=0.0 --wet=1 \
       --name=s44-lamp --tag=<before|after> --params=rainfall=<0|0.6>
```

**BOTH POSES WERE RAY-TESTED AND BOTH FRAMES WERE THEN CHECKED FOR THEIR SUBJECT**, which is STATE
43 §6's lesson and cost that session two frame pairs. Pose 1 is azimuth 95° inside `poseprobe`'s
clear run 90–100°; pose 2 is azimuth 90° in the same run. Both were then looked at before anything
downstream was measured: pose 1 has three lanterns and a lit facade in it, pose 2 has a lantern in the
near field, a receding line of six more, pedestrians and a cold sign.

**AND THE `before` ARM IS NOT A WORKTREE THIS TIME — IT IS A PARAMETER.** Session 43 needed a git
worktree because its change was code. This session's change is a CONTRACT §6 parameter, so both arms
are one build, one seed and one pose with one number different, which is what §6 says an arm is and
is strictly stronger than two trees that have to be kept in step (§9.1).

**FIVE PROBES, ALL IN THE SCRATCHPAD, NONE IN THE TREE.** `parsecheck` still counts 112 files.

```
  rainsweep.mjs    boots ONCE, holds one pose, sweeps harness.setRainfall, and reports draws,
                   triangles, layer activity, haze density, visibility and pixel statistics
                   per level. It is the probe that answered items (a), (c) and (d) at HEAD
                   BEFORE a line of this session's code existed, and its single boot is why
                   §1.2's ratios mean anything.
  patches.mjs      named rectangles as a RATIO INSIDE ONE FRAME, which is the only
                   exposure-invariant thing a screenshot carries. §1.2.
  diffmap.mjs      the exposure-normalised difference of two frames, tiled and ranked, so
                   "where did the light go" is a list of coordinates rather than an
                   impression. It is what found the lantern cones.
  scout.mjs        SEVERAL POSES IN ONE BOOT, which is this session's answer to STATE 43
                   item 8 — a blind pose costs a screenshot instead of a frame pair. Four
                   candidates were rendered before either pair was taken and the second pose
                   is the one that came back with a lantern in the near field.
  gatewindow.mjs   runs a full route and reports the weather state at the end of it. What it
                   established is §4's end-state: rainfall 0, all three layers at 0 active.
                   The 5 s figure beside it is `perfcheck`'s own new print, not this — a
                   timeOfDay delta cannot measure elapsed `now` across a route, because
                   `runRoute` sets the clock before it starts.
```

---

## 7. WHERE THE BRIEF DISAGREES WITH THE CODE

1. **"the air stays thick longer than the ground stays shiny"** is backwards by 31×, and no
   mechanism in this city's physics reverses it. §3. This is the one place the session did not
   build what was asked for, and the arithmetic is in the module.
2. **"session 43's claim is the whole basis of this brief and it should be checked"** — it was, and
   it holds exactly. §1.
3. **"Two lines: a `rainfall` default in `main.js` and a `--params` pass-through"** (STATE 43 §9
   item 2). The pass-through already existed; the default is one line; and the two of them alone
   would have delivered *permanent* rain, which the brief itself rejects in the next paragraph. The
   cycle is what the two lines turn into once "sometimes" is a requirement.
4. **"rain is particles and haze is a shader term, so both should be free of draws"** — correct, and
   now measured in ten arms rather than assumed. §2.

---

## 8. WHAT WAS NOT DONE

- **No route was given rain.** `night_rain` still carries `wet: 0.85` and no rainfall, and that is
  a deliberate refusal rather than an oversight: a route is the instrument's operating condition,
  and arming one re-bases every millisecond in this project's history against a different content.
  It is §9 item 2, with the cost attached, and it is the operator's call.
- **`clumping` was not touched.** Red by instruction, 0.443 against a 0.60 floor, unchanged.
- **`hazeDensity` was not touched.** The rain multiplier is the lever and it is now driven.
- **The hygroscopic post-shower term was derived and not built.** §3.
- **No sign photometry.** §1.3 — it is the reason lamps have halos and signs do not, and it is one
  session's work rather than a line.
- **The generator registry still contains no sign claims**, `perfcheck`'s `player` route still does
  not register the player module, and the vehicle tone-profile bar is red for the tenth session.
  All three were listed as open and not for this session.
- **No quiet battery.** `load1` 2.42–3.56 and never inside 1.6, with a Photos indexing pass holding
  a core for the whole session.
- **No merge to main.** Four commits of code and one of documents on
  `claude/noctis-44-make-it-rain`, pushed:
  the parameter and the cycle; the conservation check made cheap; the gate's dependence on being
  dry made visible; and `hud.js`'s fraction-labelled-mm/h, which was harmless for forty sessions
  and stopped being so the moment the value could be non-zero.

---

## 9. WHAT TO DO FIRST NEXT TIME

1. **THE HALO IS 4.4–7.0% AND THAT MAY BE THE END OF THE LINE FOR THIS MECHANISM.** Session 43
   built the integral, session 44 gave it the densest air this city's own weather model can produce,
   and the answer is single-figure percentages. The rain term is already **78% of the total σ** at
   full rain, and the only density lever left in the module is `RAIN_FULL_MMH` above 10 mm/h —
   which invalidates every particle count in `budget.json`, all of which were derived at that
   rate, so it is not a knob. If the operator wants a halo like the reference images, the remaining
   levers are named and **none of them is a density**:

   - **a forward phase function**, which is exactly what the 4.4-vs-7.0 bracket decides. It costs
     session 43's consistency argument (one atmosphere, one phase) and it is arguable that
     argument should be paid;
   - **photometry on the signs**, so that the 975 largest emitters in the city are in the integral
     at all. `perfcheck`'s role census says there is no sign role and there are 357 lights;
   - **a deliberate non-physical bloom**, which LOOK.md §3 currently refuses in as many words.

   **This needs a decision, not another measurement.**

2. **SHOULD A GATE EVER SEE RAIN?** Today none does, by construction (§4), and that is why nothing
   moved. The honest reading is that this is a *choice* and it has not been made: it can be argued
   that a city whose mood reference is rain should be measured in rain, and it can be argued that
   re-basing four routes against different content throws away every millisecond and every band this
   project has recorded. `budget.json` → `capture.params` is the one line either way.

3. **THE CLUMPING STATISTIC, REPLACED RATHER THAN RE-NUMBERED.** Carried from STATE 40 item 2 and
   every STATE since, untouched, **0.443** against a 0.60 floor. **It needs a decision from the
   operator, not another measurement.** Fifth session of asking.

4. **ONE OF THE TWO VEHICLE BARS WENT GREEN ON ITS OWN AND THE OTHER MOVED 5 POINTS, AND NOTHING
   TOUCHED A VEHICLE.** Session 43 was red on both: *"65% of 23 have a dark gap at the ground"* and
   *"65% of 23 carry a non-monotone tone profile"*. This session, over three invocations of the same
   gate on the same content:

   ```
     population           23 (s43)      68        63        78
     ground contrast      RED           pass      pass      pass      0.9267 / 0.8493 / 0.8025
     tone profile         RED 65%       RED 60%    —        RED 63%
   ```

   **The measured population tripled between two runs of one gate** and a carried red closed itself
   without a line of geometry changing. STATE 40 item 5's warning about this spread, delivered a
   fourth time and now with a bar that flipped. **Pool them or stop quoting them** is no longer a
   suggestion: as they stand, one of these two bars reports the traffic's disposition and calls it
   a verdict about the fleet.

5. **THE SPLASH CROWNS ARE THE SAME DEFECT AS THE STREAKS AND NOW BOTH ARE MEASURED.** 130 of 130
   render and they are at the edge of visible on a wet road at midnight. §2. It is a nits question
   against a derived number, so it is a real piece of work rather than a slider.

6. **`rain_spray` DELIVERS 4 OF 70 ON A CARRIAGEWAY POSE AND 0 OF 70 ON A PAVEMENT ONE.**
   `sprayFollowsTraffic` is true at every rainfall above zero, so the mechanism works and the
   carried "0 static" gap is closed; what does not work is the sizing. `budget.json` derived 70
   from "6 vehicles in the near field x 2 wheel lines x 6 puffs" and the delivered near-field
   vehicle count is 0 or 1. Either the number is wrong or the query radius is, and both are one
   measurement away.

7. **THE GENERATOR REGISTRY CONTAINS NO SIGN CLAIMS AT ALL.** Carried from STATE 41 item 4.

8. **A `citycheck` ASSERTION THAT DELIVERED MAY NOT EXCEED CLAIMED.** Carried from STATE 42 item 8.

9. **`perfcheck` HAS A ROUTE NAMED `player` AND HAS NEVER REGISTERED THE PLAYER.** Carried.

10. **`poseprobe` ANSWERS ONE QUESTION AND A FRAME NEEDS TWO.** Carried from STATE 43 item 8. This
    session paid the tax by hand — four scout frames rendered in one boot before either pair was
    taken — and the repair that entry describes (report the subject's screen-space box beside the
    ray test) would have made that a flag instead of a habit.

11. **THE `inputcheck` WINDOW**, **THE LOOK CURVE'S TWO BOUNDS PER FRAME AT 60 Hz**,
    **`landmarkOccluders` UNMEMOISED**, **A LANDMARK'S BOXES AND ITS CHUNK'S MASSES BEING TWO
    MESHES** (five draw calls in the tightest budget in the project — and this session spent none,
    so the spare is still one), **THE NARROWING VERDICT**, **THE YARD'S BOUNDARY STACK**,
    **`band:noon` AND `band:dusk` HAVING NO SURVIVING MECHANISM**, **the end-of-run gap**, **a quiet
    battery**. Carried from STATE 42 items 4–10 and STATE 43 item 7, untouched.

---

## 10. KNOWN GAPS CARRIED FORWARD

**Unchanged from s8–s43**: `stats().cutoffM` hard-codes 0.8, the headroom probe inert,
`saturation-peak.png` overwritten every run, `$fovYDrift`, `camera.setRouteAt(name, 1.0)` at the
sky, **right turns only**, sun shadows to ~170 m, the bake blind to elevated slabs, the PMREM hitch,
the too-red dawn horizon, one worker at queue depth one, the far half of the river handing back to
the night sky past ~300 m, grime authored, the near-field washboard on the water, the quay wall
inside the walkable mask, props absent from the walkability mask, the 3.5°–10.4° route camera pitch,
the frozen/running A/B, `materials.display` drawn by nothing, the hauler's marker row buried inside
its own body, the seeding fallback's untested placement, **a bus never turns**, the origin block's
absent occupancy registry, `facadeAlbedo` on its floor with zero spread, the station's cores reading
as an open frame, **nobody can climb the station**, the 0.10 m margin at the core's outer face,
`poseprobe`'s blindness to the origin block, the pavement's missing kerb,
`tools/city-budget.json:84`'s stale `$derivation_count`, one merged building pool breaching the
triangle ceiling, the station's platform slab hiding the train, `traffic.js:2346`'s claimed
draw-call margin of one, `minStraightness` and `minArrivalsPerMinute` having no gate reader, the
zero-second protected pedestrian phase, `landmarkBlocks` still exported and still disagreeing with
the registry two ways, **the basin is walkable in the mask and unwalkable in the geometry**, the two
`walkableAt` sites still blind to a basin, the quay walk's ulp exposure on four named chunks,
**`walkability` unreachable cells at 134 with no threshold reading it**, **the vehicle silhouette
bars red on every reading for ten sessions**, a gate message frozen in the present tense of the
session that wrote it, **a palisade that does not stop a pedestrian**, and **the two delivered
`sign ×` overlaps and the two sign quads inside a building**.

**CLOSED THIS SESSION:**

- **Nothing in this project had ever set rainfall**, in forty-three sessions, past a setter, a
  harness method, a HUD readout and a route named for it. §1.
- **`rain_spray` "0 static"**, carried since session 4b: `sprayFollowsTraffic` is TRUE at every
  rainfall above zero. What is left is a sizing question, not a dead layer. §2.
- **LOOK.md §3's open question** — *"that is the open question this bullet leaves"* — is a table
  now. §0.

**NEW THIS SESSION — all of it measured, none of it inferred:**

- **THE HALO IS 1.6% → 7.0% AT FULL RAIN, AND 4.4% IF THE RAIN'S FORWARD DIFFRACTION IS DISCOUNTED.**
  The densest air this city's weather can produce buys a factor of 4.46 on a term that started at
  1.6% of a road. §0.
- **RAIN COSTS ZERO DRAW CALLS, ZERO TRIANGLES AND ZERO INSTANCES**, because the three particle
  meshes are `frustumCulled = false` and are already in every frame's count. Ten arms. §2.
- **THE HAZE'S GAIN IS 18.5% IN A LANTERN'S BEAM AND 1.7% ON A WALL WITH NO LAMP NEAR IT**, measured
  as a ratio inside one frame because auto-exposure makes 76% of pixels darker. §1.2.
- **THE GROUND IS SHINY 31× LONGER THAN THE AIR IS THICK**, and the wet road's own humidity buys
  2.2% of the rain term rather than reversing it. §3.
- **THE ROAD FILM HOLDS ENOUGH WATER TO SATURATE A 19.5 m COLUMN AND THE CANYON IS 19.7 m**, which
  is why the mechanism was worth computing and not why it works. §3.
- **THE WATER'S CLOCK AND THE SUN'S CLOCK DISAGREE BY 72×**, so no rain cycle can be correct on both
  and this city's roads take two and a half simulated days to dry. §3.1.
- **THE SIMULATED CLOCK IS FROZEN INSIDE EVERY GATE**, because `runRoute` calls `setTimeOfDay`,
  which pauses time. The longest route in the project advances `time.now` by 5 s. §4.
- **`downtown_dense`'s FRAME MEAN READ 0.0288 / 0.0933 / 0.0932 OVER THREE RUNS OF ONE GATE** —
  `$screenshotEntropy_s17`'s "vehicle at rest at the lens" state, caught again. §5.1.
- **THE VEHICLE POPULATION `perfcheck` MEASURES WENT 23 → 68 BETWEEN TWO SESSIONS** with no vehicle
  touched. §9 item 4.
