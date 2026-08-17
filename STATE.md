# NOCTIS — STATE

*End of session 33. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB, AC power**, `node v22.22.0`. Every gate
that reads a pixel printed `ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` WAS 1.78 AT THE FIRST COMMAND AND IT DID NOT FALL THIS TIME.** Session 32 quoted
milliseconds from inside CONTRACT §0.2's bar of 1.6 because the screen-sharing that had been
driving the load was switched off; this session ran a browser almost continuously and `load1`
sat between **2.3 and 4.8** for its whole length. **SO NO MILLISECOND IN THIS FILE IS
ADMISSIBLE AS AN ABSOLUTE**, and none is quoted as one. Everything below is a COUNT, a
DISTANCE, a POPULATION or a PIXEL STATISTIC — all of which are load-independent — or a
paired before/after measured through the same instrument on the same machine within minutes
of itself. `memory/noctis-quiet-bar.md` says a GREEN absolute under load is still a verdict
and a RED one is not; both kinds appear in §7 and are labelled.*

---

## 0. THE FRAMES, IN ORDER, AND WHAT EACH ONE IS FOR

**This table is the session's report.** The gate table is §7 and it is not the verdict.

| # | frame | LOOK.md | did the city move toward it |
|---|---|---|---|
| 1 | `shot-out/custom-s33-i1-dry-t0.png` → `custom-s33-i1-default-t0-wet.png` | **§1, §6** | **YES, AND IT IS NOW THE DEFAULT.** Same pose, same instant, `wet` 0 → 0.55. The road carries the red sign, the lamp columns, the headlights and the shopfront strips. `custom-s33-i1-full-t0-wet.png` is the same frame at 1.0 and it is **worse** — see §2. |
| 2 | `shot-out/s33-i2-junction.png`, and **`s33-i2-eye.png` for item 2d** | **§4** | **YES, and it is the frame this session exists for.** A junction at midnight after 90 s of simulated time: a full-width zebra on the carriageway, a person on it, people standing at the kerb, vehicles held at a red, and the whole thing doubled in the wet road. `s33-i2-eye.png` is the same subject from the PAVEMENT at 1.74 m, which is what item 2d asked for and what LOOK.md §4 says the camera that matters is. |
| 3 | `shot-out/custom-s33-i3-crowd-b2-t0-wet.png` → `custom-s33-i3-crowd-a2-t0-wet.png`, and `s33-i3-crowd-live.png` | **§4** | **YES.** The pavement, same pose, before and after. The before is the operator's word for it: ten figures in a single file at one spacing. The after is clustered — a group at mid-distance, two people standing apart in the near ground, and empty pavement between them. |
| 4 | `shot-out/s33-i4-busstop.png` | **§4** | A bus stop. **PARTLY** — the bus behaviour is delivered and measured (§5), but this framing does not catch a bus at a shelter and is recorded as a frame that failed to make the case, not as one that made it. |

```
1  node tools/lookat.mjs --pos=70,1.74,0.9  --target=-104,17.5,-1.4 --fov=50 --t=0.0 [--wet=0|1]
2  live  --pos=145,3.4,150   --target=128,0.3,128 --fov=55 --t=0.0 --sim=90
2d live  --pos=137.6,1.74,150 --target=137.6,1.6,40 --fov=52 --t=0.0 --sim=120
3  node tools/lookat.mjs --pos=200,4.2,131  --target=110,1.0,138    --fov=40 --t=0.0
3  live  --pos=200,4.2,131   --target=110,1.0,138  --fov=40 --t=0.0 --sim=120
4  live  --pos=185,1.74,119  --target=130,1.9,137  --fov=48 --t=0.0 --sim=220
```

**A RE-PHASE CAVEAT ON FRAME 3, said before it can be quoted as a regression.**
`WALK_SPEED_SD` is drawn from the `gait` stream and so are `spread` and the initial gait
phase, in that order, so changing the spread re-phases every agent's other two draws. **The
pair at one camera is two different crowds, not one crowd with more variety in it.** The
counts are the evidence and the frame is the sanity check — the same thing STATE 32 §4.4 had
to say about the fill raise.

Frames 2, 2d, 3-live and 4 are **not** `lookat` frames and could not have been. `lookat` sets `?paused=1`
and `setTimeOfDay` pauses the clock, so `time.now` never advances and nothing that integrates
it ever moves — the pedestrians, the traffic and the weather are all frozen where they were
seeded. **Every frame this project has ever shown of a moving system was a frame of that
system standing still.** They were taken with a throwaway that unpauses, steps N simulated
seconds and then settles; it is not committed, for the reason §10 gives.

---

## 1. ITEM 0 — LOOK.md WAS WRONG THREE TIMES, AND ALL THREE WERE THE OPERATOR'S OWN TEXT

`2f26ba2`, its own commit, first, before anything was built. The brief said two. There were
three.

- **§2's "23 empty chunks are the defect"** is rewritten with session 32's answer: seventeen
  are parks, yards, lots, car parks and building sites; six are `built` chunks under a
  landmark or in the river; `(-3,1)` at 0.715 is 100% inside the weir. **Re-measured at HEAD
  today: 480 buildings, 21 zero-building chunks — 17 non-`built`, 4 `built`, `(-3,1)` still
  among them.** The fill raise moved exactly two chunks, as §4.5 of STATE 32 said it would.
- **§2 gains the real limiter**: one 0.061 m² `sign(adpillar) × prop(planter)` overlap in the
  occupancy registry one exponent on. Not draws, not triangles, not batching.
- **§6's "never seen"** becomes "never *looked at*". `lookcheck` has captured wet frames at
  all four times of day all along and asserts four bars on them.
- **§4's "crossings currently absent"** — **THE THIRD, AND IT WAS FOUND BY COUNTING RATHER
  THAN READING.** Session 21 put crossing markings in the road-marking path. Over
  `citycheck`'s own 10 × 10 region the generator delivered **2 077 crossing stripes, 82 of
  100 chunks with a full four-approach set**, and they render. §2 below is what was actually
  wrong with them.

---

## 2. ITEM 1 — THE STREET IS WET, AND ONE LINE IN `main.js` WOULD HAVE DELIVERED NOTHING

`dff29bc`. `wet` **0 → 0.55**.

**THE NUMBER IS `weather.js`'s OWN DRYING LAW EVALUATED ONCE.** With the rain off — default
`rainfall` is 0 — that module relaxes wetness toward `rainfall^0.6` = 0 as `exp(-t/3000 s)`,
where 3000 s is the 0.05 mm wet film over 0.06 mm/h of night-time evaporation. **A wetness IS
a time since the shower stopped**, and 0.55 is that law at thirty minutes:
`exp(-1800/3000)` = 0.5488. Thirty minutes is the argument and 0.55 is its consequence — long
enough that the streak, splash and spray layers are all off (they gate on `rainfall`, so
there is no rain in the frame), short enough to sit inside the drying law's own first time
constant. Confirmed in flight: a 240 s run read **0.51** against a predicted
`0.55·exp(-240/3000)` = 0.5077.

### 2.1 THE ONE-LINE CHANGE IS INERT, AND THAT IS WHY THE WATER WAS NEVER LOOKED AT

**Every frame-producing path in this project pins its own wetness.** `lookcheck` pins 0 for
the dry pass and `look-budget.json`'s 1.0 for the wet one. Each `camera.js` route carries its
own: `downtown_dense` 0, `highway_speed` 0, `player` 0, `night_rain` 0.85. `filmshot.mjs`
carries one per shot. And `lookat.mjs` read `Number(args.get('wet') || 0)` and then called
`setWetness(0)` **unconditionally**.

> **`main.js`'s `wet` default was read by NOTHING that makes a frame anybody looks at.**
> Changing it alone would have delivered exactly zero frames, and session 32 could not have
> known that because it read the default rather than the consumers.

`lookat.mjs` now pins only when `--wet` is given, names its output by the wetness
**delivered** rather than the wetness asked for, and prints it.

### 2.2 NOT ONE BAND MOVED, MEASURED THREE RUNS EACH SIDE

In a `git worktree` at the parent commit, three runs; then three in the working tree.

```
  band       before (3 runs)         after (3 runs)          threshold
  midnight   0.0745 0.0745 0.0745    0.0745 0.0745 0.0745    [0.072, 0.112]
  dawn       0.2974 0.2973 0.2973    0.2973 0.2974 0.2973    >= 0.299   RED
  noon       0.4285 0.4286 0.4286    0.4286 0.4285 0.4286    >= 0.428
  dusk       0.1396 0.1396 0.1396    0.1396 0.1396 0.1396    >= 0.140   RED
```

**The between-arm difference is smaller than the within-arm spread** — CONTRACT §0 rule 6's
own case, so there is nothing to resolve. Same four reds both sides. **NO BAND WENT RED, SO
NOTHING WAS RE-DERIVED AND NO BUDGET FILE CHANGED.** The brief expected this item to move
every band at once and to owe a re-derivation; it owes none, and the reason is §2.1.

### 2.3 AND 0.55 IS BETTER THAN 1.0, WHICH WAS NOT WHY IT WAS CHOSEN

At the operator's own pose and instant:

```
  wet    frame mean   roadway mean   roadway spread   % pixels moved > 1%
  0.00     0.0734        15.30           0.1697              —
  0.55     0.0769        18.82           0.2092            15.5
  1.00     0.0788        16.37           0.1862            34.4
```

**0.55 delivers more roadway RANGE than 1.00 does.** A full mirror reflects the dark sky
wherever nothing is lit, and `look-budget.json`'s own wetness comment says a uniform gloss is
the same failure as a uniform matte. The number came out of the drying law; this is why it
survives contact with the frame.

---

## 3. ITEM 2 — THE PAINT EXISTED, IT WAS IN THE JUNCTION BOX, AND NOW PEOPLE WALK ON IT

`b3459a5`.

### 3.1 WHAT WAS WRONG WITH SESSION 21's CROSSINGS

```
                        near edge   far edge   verdict
  carriageway ends                     7.50
  session 21 crossing      5.40        7.40    2.10 m of every zebra INSIDE the junction box
  session 33 crossing      7.55        8.75    clear of the box by 0.05, inside the bar by 0.05
  stop bar near edge       8.80
```

**The band is 1.30 m and both of its ends are numbers this city already had**: outside the
crossing road's own carriageway (`CITY.roadHalfWidth` = 7.50) and inside the stop bar's near
edge (`stopLineFromJunctionM` 9.00 − `BAR_W`/2). At the 0.05 m clearance the pavement budget
uses at every join, that is a **1.20 m depth centred on 8.15**, and both numbers now live in
`CITY.crossingDepthM` / `CITY.crossingFromJunctionM` with four readers and no copies.

**A 1.20 m crossing is shallow** — a zebra gets 2.4 m in the world. It is what 7.50, 9.00 and
0.40 leave between them, and widening it means moving the stop line, which is `minStopLineM`'s
own subject.

They were also **half width**: six 0.45 m stripes over one approach half, so no crossing
spanned the road it crossed. Now **14 × 0.50 m on a 1.029 m pitch across the full 15.0 m**:
2 077 → **4 712 stripes**, 79 of 100 chunks with a full 56.

### 3.2 PEOPLE CROSS, AND IT IS A ROUTING CHANGE AS THE BRIEF SAID

The pedestrian model is a per-island perimeter loop and **no agent had ever left the
pavement**. An agent arriving at a corner now crosses one of the two roads **two times in
three** — the unbiased choice among a corner's three onward continuations — on a three-leg
path: a 2.55 m cut to the kerb, 15.0 m of carriageway, and the mirror cut to the far island's
corner. It waits **at the kerb**, faces the road, and steps off on a red with enough left in
it to cross at **1.2 m/s, the speed a signal is timed on** rather than the 1.4 m/s this crowd
averages.

**Measured, 240 s of simulated time over the nine-chunk ring:**

```
  crossings begun                     219        0.91 per second
  on a crossing at the instant shot    30        of 360 agents
  waiting at a kerb                    13
  on the carriageway                    9
  straightness                     0.9489        floor 0.55
  arrivals per minute               1.375        floor 0.50
```

### 3.3 VEHICLES YIELD, AS A PERMISSION AND NOT AS A SECOND BRAKING MODEL

`traffic.js` already refuses to enter a junction without `veh.cleared` and already brakes
comfortably to the line without it. So the yield is one term on the **grant** and one on the
**revoke**: a junction is not granted while somebody is on the carriageway of the road being
approached, and a granted vehicle that can still stop comfortably has it taken back. It costs
one `Set` lookup and inherits a braking profile and a queue that are both already gated.
**65 yields in 240 s.**

The set is rebuilt from the agents every frame rather than edited on transitions, because a
set edited on entry and exit leaks the first time an agent is re-seated or quarantined
mid-crossing — and a leaked key is a junction no vehicle may ever enter again.

### 3.4 AND THE SIGNAL TIMING LEAVES EXACTLY ZERO SECONDS FOR A PROTECTED PHASE

This is the finding of item 2 and it is arithmetic, not an opinion:

```
  a vehicle granted at the last instant of amber is v²/2a = 36 m from its line
  when the red begins, and must clear    36 + 9.00 + 8.15 + 0.60 + len
  at FREE_SPEED 12 m/s                   4.9 s (car) to 5.5 s (12 m bus)
  crossing 15.0 m at the 1.2 m/s design speed                       12.5 s
  red                                    GREEN_S + AMBER_S =        18.0 s

  18.0 − 5.5 − 12.5 = 0.0 s
```

**No arrangement of the stepping-off rule closes it**, because the conflict is between the
amber's own dilemma-zone guarantee and the crossing's clearance time, and the two together
consume the red exactly. The residual is counted rather than asserted away:
`stats.pedConflictFrames` reads **1 849 vehicle-frames of ~2.3 M over 240 s, 0.08%**.
Closing it needs a longer red or a shorter crossing, and both are the operator's.

---

## 4. ITEM 3 — TWO OF ITS THREE PREMISES WERE ALREADY BUILT, AND THE THIRD WAS THE LINE

The brief said *"pedestrians walk in a single-file line along the pavement, evenly spaced, all
at the same speed"*. **Read against the code, two thirds of that is false:**

- **(a) speed varies per person and persists.** `speed` is drawn once at agent creation from
  a Gaussian and never redrawn. It has been that way for many sessions.
- **(b) they stop.** `dwell` is `2 + Exponential(5)` clipped at 25 s, mean 6.9 s, against a
  31 s walk — about 18% of the crowd is standing at any instant, at shopfronts and stalls,
  facing what they stopped for.
- **(c) THE LINE IS REAL.** Body centres lived in a 1.0 m band and every agent's offset was
  fixed for its lifetime, so nobody ever passed anybody.

**KEEP-RIGHT WAS REFUSED IN SESSION 14 WITH AN EXACT OBJECTION AND THE OBJECTION IS
ANSWERABLE.** The comment says two counter-flowing streams need the offset to depend on
heading, heading reverses at a destination, and *"a motion vector across that gap is not
motion, it is bookkeeping"*. That is an argument against a STEP. The answer is a time
constant: 1.2 s, which is `GAIT_CYCLE_M / WALK_SPEED_MEAN` = 1.07 s rounded up — a step and a
half, so a lane change is a body moving diagonally at 0.58 m/s against 1.4 m/s forward.

**THE THREE OFFSETS HAVE TO SUM AND THE FIRST DRAFT'S DID NOT.** The corridor is 1.60 m —
9.30 to 10.90 — so with a 0.30 m body half-width the centres live in a 0.50 m half-range about
10.10. A 0.40 m lane split with the old ±0.25 m jitter is 0.65 of an available 0.50 and put
0.15 m of shoulder into the stall run on one side and the shopfront strip on the other. It is
**0.35 + 0.15 + 0.30 = 0.80**, the corridor's own half-width, and the delivered body extents
are `[9.300, 10.200]` kerbward and `[10.000, 10.900]` inland — the corridor exactly, at both
ends. Caught by doing the arithmetic the corridor budget's own last line demands, not by a
gate.

**`WALK_SPEED_SD` 0.18 → 0.26.** It was the one number in that file with no derivation, sitting
under a paragraph that derives only the mean — one of LOOK.md §7's *"76 of 189 bounds with no
recorded derivation at all"*. 0.26 m/s is the standard spread for a mixed adult population;
0.18 on a 1.4 m/s mean is a CV of 0.13 against a real 0.19, i.e. **the crowd was a third less
varied than a real one**. The mean is untouched: it is `GAIT.walkSpeedMps` and `GAIT.stepM` is
derived from it.

---

## 5. ITEM 4 — BUSES STOP, AND TWO BUGS HAD TO BE FOUND BEFORE ONE EVER DID

### 5.1 BUSES WERE IN THE WRONG LANE

Measured before anything: of 13.3 buses in the ring, **24.5% were in lane 1** — the kerbside
lane the shelters stand on. `seed()` drew every vehicle's lane from one 62/38 roll regardless
of type, so three quarters of the buses spent their routes in the overtaking lane and the stop
rule had almost nothing to fire on: **0 berths in 40 s**. A 12 m single-decker that serves
kerbside stops does not do that. Buses now seed into lane 1.

### 5.2 THE BERTH TEST COULD NEVER FIRE, AND IT IS THIS FILE'S OWN INCIDENT ONE OBJECT OVER

The approach profile is `v = sqrt(2·a·s)`. It reaches `s = 0` at `v = 0` in finite time in
continuous arithmetic and **never in discrete steps** — each frame multiplies the remaining
distance by a factor short of zero. The first draft tested `toDoor <= 0` and delivered **8
approaches and 0 berths in 40 s**: every bus crept toward its shelter for ever.

> **`traffic.js` carries a long comment about exactly this shape, written in session 18 about
> `toStop > 0` at the stop line, and it did not stop the same mistake being made 400 lines
> away.** It is now a **1.00 m berthing accuracy** — half a bus door — and that is a quantity
> rather than an epsilon.

### 5.3 WHAT A BUS DOES NOW

Slows on `sqrt(2·a·s)`, halts with its doors at the shelter — the berth is `type.len / 6`
short of the shelter's centre, because a bus is berthed when its DOORS are at the flag and not
when its back axle is — dwells, and rejoins. No boarding animation, no passenger transfer, no
route network.

**THE DWELL IS THE BOARDING TIME OF THE PEOPLE WHO ARE ACTUALLY STANDING THERE.** 5 s of door
cycle plus 2.5 s a boarder, and the boarder count is counted by `streetlife.waitingAt` over the
shelter's own roof footprint rather than assumed. Items 4a and 4b are therefore one mechanism:
a stop with nobody at it is a 5 s pause and a stop with four people at it is 15 s, and the
reason the bus is standing there is in the same frame.

**Item 4b**: shelters are now pedestrian destinations. A waiting agent stands at the **kerb**
edge of the corridor rather than in the middle of it, so the queue is beside the shelter and
not across the people walking past, and it **faces the road** — `+out`, where a shopfront
dweller faces `−out`. That one sign is the difference between a queue at a stop and a queue
with its back to the traffic.

### 5.4 ITEM 4d — THE REFUSAL IS IMPLEMENTED AND ITS CONDITION HAS NO CASE ON THIS LATTICE

**"Clear of the running lane" cannot mean a lay-by anywhere in this city:**

```
  kerb                    CITY.roadHalfWidth          7.50 m
  kerbside lane centre    LANE_OFFSET[1]              5.25 m
  lane half-pitch                                     1.75 m
  lane outer edge                                     7.00 m
  space between the running lane and the kerb         0.50 m
  a bus                                               2.55 m wide
```

There is nowhere to pull into. So it is delivered as **clear of the THROUGH lane**, which is
what a kerbside stop is in the world: the bus halts in lane 1 and traffic passes in lane 0.
The refusal is implemented and counted — a bus in the offside lane does not serve a stop
rather than swerving across a running lane to reach a kerb — and with §5.1's fix **it now
never fires**. It is left in because the condition is right even where the geometry never
presents it, and `stats.busStopsRefused.offsideLane` reads 0 rather than being absent.

### 5.5 DELIVERED

```
  berths in 240 s                                   8
  shelters inside SIM_RADIUS                       11
  headway per shelter                             330 s
  offside-lane refusals                             0
  wrong-side refusals (per bus per frame)      29 552
```

**330 s is an artefact of there being no route network**, which item 4 forbade: 160 vehicles
at a 3% bus share, seeded anywhere on a 380 m box of lattice and turning at random. So the
bus-stop WAIT is not half of it — 165 s would park bodies under a shelter for the better part
of three minutes — and is bounded by the shelter's own 4.00 m capacity instead. That is said
in the constant rather than hidden in it.

---

## 6. ITEM 5 — THE HYPOTHESIS IS CORRECT, AND THE BLOCK INTERIORS ARE EMPTY PAST 28 m

Measure only, as the brief required. Walked directly over `generateChunk` at HEAD, seed 1337,
`citycheck`'s own 10 × 10 region: **79 built chunks, 480 buildings**, island 104.6 m square.

```
  building DEPTH (m)      p10 13.5   median 19.4   p90 25.3   max 27.0   mean 19.4
  as a fraction of the island's 52.3 m half-depth   median 0.370   p90 0.484
  far face reach from the lot line (m)   p10 15.9  median 19.7  p90 24.5  max 40.1
  island footprint covered by buildings              20.8%

  built fraction by distance from the lot line, 4 m bands
      0–  3 m   25.1%  #############
      4–  7 m   33.8%  #################
      8– 11 m   36.3%  ##################
     12– 15 m   34.6%  #################
     16– 19 m   25.3%  #############
     20– 23 m   11.0%  ######
     24– 27 m    1.4%  #
     28– 31 m    0.1%
     32– 55 m    0.0%
```

> **PAST 28 m FROM THE LOT LINE THE CITY IS EMPTY.** 0.1% at 28–31 m and 0.0% everywhere
> beyond. The inner **48.6 m square of every island — 21.6% of its area — has nothing in it at
> all**, and the deepest building in the region reaches 40.1 m of a possible 52.3.

**What the reference needs, from the same arithmetic:**

```
  ring depth   light-well   ring coverage
     19.4 m      65.8 m         60.4%     <- today's median depth, at full frontage
     26.0 m      52.6 m         74.7%
     32.0 m      40.6 m         84.9%
     42.3 m      20.0 m         96.3%     <- a lower Manhattan block
```

Delivered coverage is **20.8%**, which is 0.344 of the 60.4% today's depth would give at full
frontage — the rest is STATE 32's frontage occupancy of 0.244. **So both knobs are short and
they multiply**: depth is at 0.46 of the reference and frontage at 0.244 of it.

**AND DEPTH IS NOT LIMITED BY WHAT STOPPED THE FILL RAISE.** Session 32's stop is a
`sign(adpillar) × prop(planter)` overlap on the FRONTAGE. Depth grows a building INWARD, into
land the raster above shows is empty, and the only thing it can eventually meet is the
building on the opposite frontage — at `2 × depth > 104.6`, i.e. past 52.3 m. It is also free
in every budget this project tracks: **a deeper box is the same box.** Same instance, same
twelve triangles, same draw call. Only the side elevations' window rows grow.

**This is a measurement and not a licence.** Nothing was changed. The next session's building
item has its arithmetic here.

---

## 7. GATE STATE — TWO REDS CLOSED, ONE OPENED, AND THE LOAD MAKES ONE GATE UNREADABLE

Each gate run individually, because `npm run gates` is `&&`-joined and stops at the first red.

```
  parsecheck   GREEN   105 files, contract-clean
  faultcheck   GREEN   7 cases; quarantine surgical, frame survives all seven
  windcheck    GREEN
  inputcheck   GREEN

  lookcheck    RED AT 3, DOWN FROM 4 — `band:dawn` CLOSED
                 CLOSED: band:dawn  0.2973 -> 0.3008 / 0.3008 / 0.3009 over three runs,
                   against a floor of 0.299. It has been red since before session 31 and
                   STATE 32 recorded it moving 0.0008 FURTHER away under a denser city.
                   The move is +0.0035 against a measured run-to-run spread of 0.0001,
                   i.e. 35x the noise floor — CONTRACT §0 rule 6 satisfied in the
                   direction that matters. Nothing was aimed at it: it is 4 712 stripes
                   of 0.62-albedo paint on a 0.082-albedo road, at dawn.
                 ✗ band:dusk        0.1393  (>= 0.140)   carried, 0.0003 further out
                 ✗ facadeAlbedo     3 clusters (min 4)   carried from the station, s31
                 ✗ facadeNeighbours 0.211   (min 0.3)    carried from the station, s31
                 Bands, three runs: midnight 0.0745/0.0744/0.0744  dawn 0.3008/0.3008/0.3009
                   noon 0.4289 x3  dusk 0.1393 x3

  citycheck    RED AT 1, AND IT MOVED 0.27 POINTS TOWARD CLOSING
                 ✗ saturation  5.98% of night-route pixels above 0.5 value  (min 6.00%)
                   4.29% at s31, 5.71% at s32, 5.98% now. The deficit is 0.02 points
                   against a statistic CONTRACT §0.1 records as having a 0.60-0.80 point
                   run-to-run spread. IT IS NOT RESOLVED IN EITHER DIRECTION and must not
                   be reported as nearly closed on one draw.
                 occupancy 0 / 0 forbidden overlaps over 53 forbidden pairs, generator
                 AND delivered, with 4 712 new crossing stripes in the scene.
                 pedestrians 360 over 9 chunks, CV 1.0432 (min 0.7), 67% populated.
                 clumping CV 0.632 (min 0.6). walkability 69 514 of 69 515.
                 alignment 73.9% off-axis. street level 199 stalls, 5 kinds.
                 negative space 17.0%, 5 kinds. landmarks 8/8/0. All green.

  perfcheck    SEE §7.2. Run under load1 2.3-3.6, so its frame times are not admissible
                 and its counts and distances are.

  gateaudit    Not run to completion this session — see §10.
```

### 7.1 `minStraightness` AND `minArrivalsPerMinute` HAVE NO READER

Both live in `tools/city-budget.json` → `pedestrians`, both carry long `$derivation` text, and
**`grep` over `tools/` finds no consumer of either.** `citycheck` asserts the pedestrian
density CV and the populated fraction and nothing else about the crowd. This session changed
what pedestrians do more than any session since they were built, and the two thresholds that
describe their BEHAVIOUR watched none of it.

Measured by hand, from the module's own statistics over a 240 s run: **straightness 0.9489
against a floor of 0.55, arrivals 1.375 per minute against 0.50.** Both clear comfortably, and
crossings help straightness rather than hurting it because a crossing is a straight 19 m leg.

**It was not wired up here**, and the reason is a measurement rather than a preference: the
arrival rate is a rate over a 60-bucket minute, and `citycheck` samples routes with a
few-frame settle, so the quantity reads near zero in the harness state that gate runs in. It
needs a gate that RUNS the simulation, which is a new capability and not a line. It is owed and
it is §11's first entry.

### 7.2 PERFCHECK, AND WHAT OF IT IS ADMISSIBLE

**RED AT 8, THE SAME COUNT AS SESSION 32, AND THE DRAW CALLS ARE IDENTICAL ON EVERY ROUTE.**

```
  route            cpu p95   wall p95   ceil   draws   tris     inst      s32 draws
  downtown_dense    9.60      11.90     12.5    333    1.41M   152 521      333
  highway_speed     8.40      10.90     12.5    432    1.58M   201 866      432
  night_rain       10.50      12.80     13.0    334    1.33M   186 276      334
  player            9.60      11.80     12.5    322    1.34M   152 521      322
  spreads 0.1 – 0.7 ms.  load1 3.5 – 4.5 throughout.
```

> **THE BRIEF ASKED THAT EVERY ITEM COST INSTANCES RATHER THAN DRAWS, AND TO SAY
> SO RATHER THAN ASSUME IT. It is checked and it is exact: 333, 432, 334, 322 —
> the same four numbers session 32 recorded, to the draw.** 2 635 new crossing
> stripes, the bus behaviour and the crossing crowd cost **+2 314 to +2 603
> instances** and **+0.01 M triangles**, all inside meshes that already existed.
> **432 of 440 stands where session 32 left it, and the eight spare are still
> spare.**

**THE FRAME TIMES ARE ALL GREEN AND THEY ARE ADMISSIBLE IN THAT DIRECTION ONLY.**
`load1` never came near CONTRACT §0.2's bar of 1.6; `memory/noctis-quiet-bar.md`
records that drift on this machine is one-sided, so load can only make a frame
SLOWER — a green absolute under load is a verdict and a red one would not have
been. Every route cleared its ceiling with a browser and the agent both running:
`downtown_dense` 11.90 of 12.5, `night_rain` 12.80 of 13.0. **`night_rain`'s
0.20 ms margin is smaller than its own 0.5 ms spread and is not resolved by
this run in either direction** — it is green, not clear.

**ITEMS 2c AND 4c — `minStopLineM`, MEASURED AND NOT REPAIRED.**

```
  route            s32 (recorded)   s33      floor
  downtown_dense                    11.27      0
  highway_speed    10.77 to 11.99   11.25      0
  night_rain        on all four     11.41      0
  player                            10.83      0
```

**All four sit inside the band session 32 recorded on this machine, and the
carried red is carried unchanged.** A yielding vehicle changes queue behaviour
and a halted bus is a queue head, which is why the brief asked; neither moved
the statistic, because both act through `veh.cleared` and the stop-line datum is
a property of a vehicle *held at its own line*, not of what is holding it. STATE
25's diagnosis stands and nothing touched it.

**THE OTHER FOUR REDS, AND TWO MOVED THE WRONG WAY.**

```
  ✗ downtown_dense mean luminance 0.0720 (min 0.08).   CARRIED. 0.0734 at s32.
  ✗ night_rain     mean luminance 0.0594 (min 0.08).   CARRIED. 0.0639 at s32,
                     and the per-run set is [0.0632 0.0590 0.0594] against a
                     gate that asserts on the LAST run rather than pooling —
                     budget.json's own `$screenshotEntropy_s17` says so. A
                     0.0042 spread across three runs on a 0.0206 deficit.
  ✗ night_rain     frame entropy 4.824 (min 5).        CARRIED from s32's 4.962,
                     0.138 worse, and s32 §7.1 already argued this one: tonal
                     entropy falls when more of the frame is one dark value, and
                     a denser night city has more unlit wall in it. Still the
                     operator's to re-derive; still not touched here.
  ✗ highway_speed  tone profile 71% of 76 vehicles (min 75%).  CARRIED, AND IT
                     MOVED 7 POINTS THE RIGHT WAY — 64% at s32, 72% at s28–30,
                     absent at s31. It flaps on a re-phased population and
                     nothing this session touches vehicle tone.
```

**Nothing in this session was aimed at any of these four and none of them is
this session's.** `night_rain` is the one route that runs wet (0.85, its own,
unchanged by item 1), so its two reds are the same subject session 32 handed on.

---

## 8. WHAT WENT ON THE BRANCH

Session 27's branch, `claude/noctis-25-building-floors-89bqul`. **NOTHING MERGED TO MAIN.**

```
  b3459a5  items 2, 3, 4 — crossings, the crowd, and buses that stop
  dff29bc  item 1 — wet by default, and lookat stops pinning
  2f26ba2  item 0 — LOOK.md's three false claims
  90692cc  <- session 32's head
```

**NO BUDGET FILE CHANGED.** `budget.json`, `look-budget.json`, `city-budget.json` and
`input-budget.json` are byte-identical to session 32. **No threshold moved, lowered, raised or
re-derived.** The brief reserved a re-derivation for any look band that went red under the wet
default; none did, because §2.1.

---

## 9. THE BRIEF'S PREMISES, MEASURED

| # | the brief said | measured |
|---|---|---|
| — | draw calls stand at **432 of 440**, eight spare | **TRUE**, and every item this session cost instances rather than draws — see §7.2 |
| 0 | LOOK.md is wrong **twice** | **THREE TIMES.** §4's *"crossings currently absent"* is the third: 2 077 stripes shipped in session 21 |
| 1 | the bands were derived on dry frames and **wetting will move them** | **FALSE.** `lookcheck` pins wetness itself, both passes, and every perf route carries its own. Three runs each side: not one band moved a digit |
| 1 | where a band goes red, **re-derive it in the open** | **nothing to re-derive.** No band went red. The owed work was zero and saying so is the deliverable |
| 2 | crossings **are simply absent** | **FALSE.** The paint shipped in session 21. What was absent is that it sat 2.10 m inside the junction box, spanned half a road, and nobody walked on it |
| 2a | the markings cost **no new draw call** — check rather than assume | **TRUE, checked.** They are boxes in the streamed props mesh; 2 077 → 4 712 stripes is instances |
| 2b | the pedestrian network already exists — **this is a routing change** | **TRUE**, and it was the cheapest half of the item |
| 3 | pedestrians are **all at the same speed** and **never stop** | **FALSE on both.** Per-agent speed has persisted for many sessions; dwell is 2–25 s at an 18% standing share. **The single file is real** and is what was fixed |
| 4 | shelters exist on both content paths, **nothing stops at them** | **TRUE**, and now something does |
| 4d | if a bus **cannot pull clear of the lane**, it does not stop there | **its condition has no case.** 0.50 m between the running lane and the kerb against a 2.55 m bus: nothing can pull clear anywhere in this city. §5.4 |
| 5 | buildings are **shallow boxes near the frontage** with empty block interiors | **TRUE, and quantified.** Median depth 19.4 m of a 52.3 m half-depth; **0.0% built past 31 m**; 20.8% island coverage against 96.3% for a lower Manhattan ring |

---

## 10. WHAT WAS NOT BUILT, AND WHY

- **`gateaudit` was not run to completion.** It is the most expensive gate in the project and
  it reports `lookcheck`'s redness one layer up; `lookcheck` is red at 3 and its control frame
  is therefore outside one band, which is the state STATE 31 and 32 both recorded. Running it
  would have produced the same sentence for the third time at the cost of the item-3 frames.
  **This is a gate that did not run and it is recorded as that, not as a pass.**
- **The bus-stop frame does not show a bus at a stop.** Two framings were tried and neither
  caught one; at a 330 s headway per shelter and a 12.5 s dwell, a given shelter has a bus at
  it 3.8% of the time. The behaviour is measured (§5.5) and the frame is not the evidence.
- **No new instrument was committed.** Five throwaway probes were written and left in the
  scratchpad: the marking census, the chunk-kind re-count, the wetness comparison, the depth
  raster, and the live-sim shot tool. The last is the one worth having and it is the one §0
  says every previous session lacked — but a tool that unpauses the world is a tool that
  changes what a frame means, and committing it in the same session that used it is how a
  gate's camera stops being the gate's.
- **`minStopLineM` was measured, not repaired**, as items 2c and 4c required. §7.2.
- **The 0.02-point saturation deficit was not chased.** It is 3% of that statistic's own
  run-to-run spread.
- **Stage 3 of the station, `walkableAt`, vehicle models, the batching** — all out of scope
  and all untouched.

---

## 11. KNOWN GAPS CARRIED FORWARD

**Unchanged from s8–s32**: `stats().cutoffM` hard-codes 0.8, the headroom probe inert, GPU
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
face, `poseprobe`'s blindness to the origin block, the pavement's missing kerb,
`tools/city-budget.json:84`'s stale `$derivation_count`, the `sign(adpillar) × prop(planter)`
overlap that stops the fill raise, one merged building pool breaching the triangle ceiling,
the station's platform slab hiding the train, and `traffic.js:2346`'s claimed draw-call margin
of one where it is eight.

**New this session:**

- **`minStraightness` AND `minArrivalsPerMinute` HAVE NO GATE READER.** §7.1. Both clear by
  large margins when measured by hand; neither is watched. Wiring them up needs a gate that
  runs the simulation, which this project does not have.
- **EVERY FRAME THIS PROJECT HAS EVER SHOWN OF A MOVING SYSTEM WAS FROZEN.** `lookat` sets
  `?paused=1` and `setTimeOfDay` pauses the clock, so pedestrians, traffic and weather stand
  where they were seeded. Every judgement about the crowd in every STATE was made on frame
  zero of the simulation.
- **THE SIGNAL TIMING LEAVES ZERO SECONDS FOR A PROTECTED PEDESTRIAN PHASE.** §3.4, with the
  arithmetic. 0.08% of vehicle-frames are the residual and it cannot be closed by rules.
- **BUILDINGS ARE 19.4 m DEEP INTO A 52.3 m HALF-BLOCK AND NOTHING IS BUILT PAST 31 m.** §6.
  Depth is free in draws, triangles and instances, and is not limited by what stopped the fill
  raise.
- **A BUS COULD NOT PULL CLEAR OF A RUNNING LANE ANYWHERE IN THIS CITY** — 0.50 m of space for
  a 2.55 m vehicle. §5.4.
- **`traffic.js` REPEATED ITS OWN SESSION-18 INCIDENT 400 LINES AWAY**: `toDoor <= 0` against a
  `sqrt(2as)` profile. §5.2.
- **THE THREE PAVEMENT OFFSETS DID NOT SUM IN THE FIRST DRAFT** of the keep-right change, by
  0.15 m on each side. §4. Caught by arithmetic, not by a gate — nothing gates a pedestrian's
  lateral position against the corridor budget.
- **`band:dawn` IS CLOSED** and `citycheck`'s saturation is 0.02 points out with a 0.60-point
  spread. §7.

---

## 12. OFFERED FOR CONTRACT §9's TABLE

Offered rather than added, because `parsecheck`'s `contractDocCheck` counts the rows and the
count is a gate — sessions 24 through 32 left rows on the same terms.

- **A DEFAULT WITH NO CONSUMER, MISTAKEN FOR A SETTING.** `main.js` → `wet` was read by
  nothing that produces a frame: `lookcheck` pins both ends, every `camera.js` route carries
  its own, `filmshot.mjs` carries one per shot, and `lookat.mjs` pinned 0 unconditionally.
  Three documents and a session brief treated changing it as the thing that would make the
  city wet, and changing it alone delivers zero frames. **The question a default answers is
  "what happens when nobody says", and the answer here was "everybody says";**
- **A GEOMETRY REPEATED IN THREE FILES AND WRONG IN THE ONE THAT DREW IT.** Session 21's
  crossing sat at `stopLineFromJunctionM − 2.6`, an expression that reads like a derivation and
  puts 2.10 m of a 2.0 m zebra inside the junction box. The two constraints that actually bound
  it — outside `roadHalfWidth`, inside the stop bar — were both already in the file;
- **A TERMINATION TEST ON A DISTANCE THAT SHRINKS GEOMETRICALLY.** `toDoor <= 0` against
  `v = sqrt(2·a·s)` never fires: 8 bus approaches, 0 berths. `traffic.js` carries a
  session-18 comment about `toStop > 0` doing exactly this at the stop line, 400 lines away in
  the same file, and the comment did not prevent it. **A written-up failure mode is not a
  guard;**
- **A VEHICLE CLASS DRAWING A PROPERTY FROM THE FLEET'S ROLL.** `seed()` gave every type the
  same 62/38 lane draw, so 75% of buses ran in the overtaking lane. The stop-serving rule was
  correct and fired on nothing, and a rule that never fires is indistinguishable from one that
  is not wired up — which is why the refusal counters exist;
- **THREE OFFSETS THAT HAVE TO SUM, SUMMED WRONG.** The pavement budget's own closing line is
  *"change one and another has to give"*. A 0.40 m lane split added to a ±0.25 m jitter and a
  0.30 m body is 0.95 against an available 0.80, and it put shoulders in the stall run. The
  budget is a paragraph of prose and nothing checks it;
- **A THRESHOLD WITH A DERIVATION AND NO READER.** `minStraightness` and
  `minArrivalsPerMinute` carry hundreds of words of derivation in `city-budget.json` and no
  tool reads either. The derivation is the part that looks like rigour and the reader is the
  part that is one;
- **A SPREAD TYPED BESIDE A DERIVED MEAN.** `WALK_SPEED_SD = 0.18` sat under a paragraph
  deriving `WALK_SPEED_MEAN` from `gait.js` and explaining why the mean must not be duplicated.
  The reader's eye stops at the derived number and the undefended one beside it inherits its
  authority.
