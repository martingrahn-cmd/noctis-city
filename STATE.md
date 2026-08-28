# NOCTIS — STATE

*End of session 49. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`. The machine has
**NOT** rebooted since session 40 — 9 d 18 h of uptime at the last command, the same boot as
sessions 47 and 48. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` RANGED 3.41 TO 5.49 ACROSS THE SESSION*** against CONTRACT §0.2's bar of **1.6**, and
**IT WAS NOT THE AGENT.** `LC_ALL=C ps -eo pcpu,comm | sort -rn | head` names it in one line:
`mediaanalysisd-access` at **97.9%** with `mediaanalysisd` at **42.7%** behind it — macOS indexing
a photo library, about 1.4 cores before any gate started. This is STATE 46's own lesson applied
before the run rather than after it. **NO MILLISECOND IN THIS FILE IS ADMISSIBLE IN EITHER
DIRECTION** except a GREEN one, per §0.2. What is quoted is COUNTS, draw calls, triangles,
populations out of the pure generator, the delivered conflict sweep, and one PAIRED comparison
taken in a worktree (§5.1).

---

## 0. WHAT THE CITY HAS NOW THAT IT DID NOT HAVE

The brief: *"Build as many new kinds of place as it can, roughly, at the same standard session 48
set."* **Eight.**

```
  tools/shot-out/                     what it shows
  s49-school-{air,street}.png         a two-storey teaching block, ribbon glazing on both floors,
                                      a pitch on the same island — a school is a playground with
                                      a building on one side of it
  s49-hospital-{air,street}.png       a four-storey slab, an AMBULANCE BAY on columns with clear
                                      air under it, a stair tower beside the slab, marked
                                      visitors' bays in the foreground
  s49-firestation-{air,street}.png    THREE RED APPLIANCE DOORS and a hose tower with a glazing
                                      slot — the one building in a street whose ground floor is
                                      mostly opening
  s49-industrial-{air,street}.png     a shed with seven loading-dock shutters behind a palisade,
                                      hardstanding, containers, floodlights
  s49-market-{air,street}.png         ONE LARGE ROOF WITH AIR UNDER IT — stalls beneath it and
                                      the city visible straight through the span
  s49-depot-{air,street}.png          a 62 m parking cover with twelve vans in rows under it, four
                                      more out on the apron, a workshop, a rail and floodlights
  s49-church-{air,street}.png         a nave with a long window band and a STEPPED SPIRE beside
                                      it — the only tapering silhouette in this city
  s49-port-{air,street}.png           a wharf: a transit shed with shutters, container stacks, a
                                      slewing crane over the quay, the river beyond
```

**THIRTEEN KINDS OF LOW-DETAIL ISLAND WHERE SESSION 47 HAD FIVE AND SESSION 48 HAD SEVEN.** All
eight are declared in the registry from their first commit, which is what session 47 spent a whole
session earning, and **the delivered forbidden-overlap count went DOWN — 4 to 3** (§5).

---

## 1. THE LIST

### BUILT

| # | what | where it goes, and it is derived |
|---|---|---|
| **P1** | **A SCHOOL** — a 58 × 14 m two-storey teaching block with ribbon glazing, on an island that also carries a pitch. | The middle of the low-detail band. Below `pitchBelow` it falls through to `recreation`, so a school and a sports ground are ONE decision about a quiet block. |
| **P2** | **A HOSPITAL** — a 56 × 18 m four-storey slab, a 34 m stair tower beside it, an ambulance bay on columns, 14 marked visitor bays. | Standing on an ARTERIAL. A hospital is the one civic building allowed to be taller than its street, and it stands on the road that gets you there. Off an arterial it falls through to `carpark`. |
| **P3** | **A FIRE STATION** — a 34 × 14 m appliance house with three red bay doors and an 18 m hose tower. | Between `pitchBelow` and `courtBelow` — a fire station sits in the ordinary middle of a city, not its edge and not its core. Otherwise `lot`. |
| **P4** | **AN INDUSTRIAL ESTATE** — two 44 × 22 m sheds with loading docks, hardstanding, six container stacks, two vans, a palisade, three floods. | The river, the viaduct, or land nobody wants. It is the deliberate SINK for three other kinds' failed conditions, which is the honest reading rather than the convenient one. |
| **P5** | **A MARKET HALL** — a 62 × 34 m roof on columns at 7.2 m with stalls under it and a forecourt in front. | The dense end of the band — a hall needs a catchment. Below `courtBelow` it falls through to `park`. |
| **P6** | **A DEPOT** — a 62 × 26 m parking cover with sixteen vans, twelve under it and four on the apron, and a 28 × 14 m workshop. | Within 3 chunks of the VIADUCT's own AABB. Otherwise `industrial`. |
| **P7** | **A CHURCH** — a 30 × 13 m nave with a window band and a 21 m stepped spire, a square and a hedge. | Nothing. A church is where a church is, and the brief says so: *"a thing does not need a derivation to EXIST."* |
| **P8** | **A PORT** — a 46 × 18 m transit shed with seven shutters, container stacks and a slewing crane. | A chunk that is DRY with a WET NEIGHBOUR. Otherwise `industrial`. |
| **P9** | **The delivered census claimed a `canopy` as a `feature` from `y0: 0`**, so a roof on columns conflicted with everything standing under it. | 12 `feature(canopy) × prop(parked)` and 1 `prop(bollard) × feature(canopy)`. §2.3 |
| **P10** | **The park's `centre` took a `yaw()` its own claim did not carry.** | 4 `path × feature(centre:square)` at 0.5 m². Session 48 fixed the POND's 2% coping overrun; this is the same reading on the same object, arriving through the rotation instead of through a literal. §2.4 |
| **P11** | **`placeMass` returned `null` and nothing read it**, so a chunk whose building was refused still got its tower. | One fire station of two: an 18 m hose tower alone in a fenced empty yard. §2.5 |
| **P12** | **All twelve of the depot's vans stood inside the cover's own footprint**, so the aerial frame of a depot was a blank 62 m roof on an empty apron. | The operator's session-46 defect rebuilt by the session trying to fix it, and only a frame from above could see it. Four vans and ten bay marks now stand on the open apron. |

### FOUND AND NOT FIXED

- **An ARENA.** Session 48 left it first on the list and it is still first. A closed shell with a
  large roof is the one shape neither `shed` nor `canopy` makes.
- **THE CHURCH'S LAWN IS FOUR PITCHES OF EMPTY GRASS.** `s49-church-air.png`: `lay('grass')` covers
  the whole 104.6 m island and a 30 × 13 m nave stands at one edge of it. A hedge and a square are
  all it has. It is the largest bare surface any of the eight adds, and it is the same defect as
  P12 on a different kind — **a fixture set sized for the BUILDING rather than for the ISLAND.**
- **AN INDUSTRIAL SHED'S UPPER WALL.** 44 m × 6 m of blank above the dock shutters
  (`s49-industrial-street.png`). Two roof-plant boxes are all that break it. Honest for a shed, and
  still worth a band or a vent run.
- **`hospital` IS RARE BY CONSTRUCTION.** One chunk in 289 at seed 1337, because `onArterial` is a
  1 m test against a bridge line. It is not empty, which is the bar §2.2 sets, but it is one
  narrowing away from being so.
- **THE VEHICLE GROUND-CONTACT BAR MOVED AND I COULD NOT EXPLAIN IT.** §5.1. Attributed to this
  commit range by a paired worktree; the obvious mechanism is ruled out by distance.

---

## 2. HOW THEY WERE BUILT, AND THE FIVE THINGS THAT WERE WRONG

### 2.1 THREE FEATURE KINDS CARRY ALL EIGHT

A school, a transit shed, an appliance house, a nave, a workshop and two industrial sheds are ONE
object with six sets of numbers. So are a spire, a hose tower and a hospital's stair core. So the
whole session is three new feature kinds in `city.js`, and `windcheck` counts **567 meshes, exactly
as session 48 did** — eight kinds of place added not one mesh, because all three ride the chunk's
existing mass pool:

```
  shed     a body, a parapet, and a STYLE — window (ribbon glazing), dock (a platform and
           shutters), bay (red appliance doors), blank — plus two roof-plant boxes
  canopy   a roof plane on column pairs every ~9 m, a shallow ridge, a fascia on the long edges
  tower    a body, a parapet and a CAP — spire (a five-step taper), drum, flat — and a glazing slot
```

**`canopy` IS THE ONE THIS CITY DID NOT HAVE.** Every roof in NOCTIS before this session was the
lid of a prism. A span you can see under is a different silhouette, and it is what makes a market
hall read as a market hall rather than as a low warehouse.

### 2.2 A CONDITION NARROW ENOUGH TO BE PRECISE IS USUALLY NARROW ENOUGH TO BE EMPTY

This cost three placements and it is the session's general finding.

- The **depot's** first band was one chunk of the viaduct's AABB. Delivered **nothing within twelve
  chunks of spawn.** Widened to three chunks.
- The **port's** first rule was *"the river envelope reaches this chunk"* — which leaves about
  **14 m of dry land** on a 128 m island. Nine wharves of fourteen got no shed. Replaced by
  `onBank`: this chunk is dry and a NEIGHBOUR is wet.
- **`placeMass` gave up after one try.** The nominal spot is the island centre line, and
  `islandSolids()` carries the river and any landmark on that island, so a 46 × 18 m shed was
  refused outright. It now sweeps nine positions — the nominal spot first, then the island's
  quarters — which is the same shape `viaductPiers`' nudge search has.

**None of the three is visible in the code and all three are visible in one delivered count at the
shipped seed.** Check the count before believing a placement rule.

### 2.3 A MARKET HALL CLAIMED AS A `building` REFUSES ITS OWN STALLS

`occupancy.js` has had the right category since it was written: `canopy` is *"the part of a thing
that is over your head"*, and it conflicts with SOLIDS ONLY. A market hall claimed as `building`
forbids `prop`, so **ten stalls were refused by their own roof — 2 halls, 0 stalls.** Claimed as
`canopy` with its `y0` at the soffit, the ground under it is free again and the **depot went from
11 parked vehicles to 83.**

**AND THE DELIVERED SIDE DID NOT AGREE WITH THE GENERATOR — P9.** `city.js`'s delivered census
mapped every non-site, non-parked feature to category `feature` with a hard-coded `y0: 0`. Session
48 half-closed that by making LIFTED features skip the claim; this session gave the rest a base.
Until it matched, the sweep reported a depot colliding with the vehicles it is built to cover.
`citycheck` now walks **659 delivered `canopy` claims** in a category session 48's census listed
among those with none.

### 2.4 THE PARK CENTRE'S ROTATION WAS NOT IN ITS CLAIM — P10

`centre` sits at the crossing of two AXIAL paths, is claimed as an axis-aligned box, and was drawn
with `yaw()`. A 10 m square turned by `CITY.maxYawDeg` has an AABB **0.19 m larger on each side**
and nothing grew the claim with it. **Widening the claim does not help** — the delivered census
compares DRAWN boxes — so the thing that was wrong is the rotation, and a square at a crossroads
does not have one.

### 2.5 A TOWER STOOD WHERE ITS OWN BUILDING HAD BEEN REFUSED — P11

`placeMass` has returned the record or `null` since §2.2's port fix, and **nothing read the
return.** At seed 1337 one fire station of two delivered an 18 m hose tower alone in a fenced empty
yard, because the viaduct's claim crosses that island and a 34 × 14 m shed does not fit between the
piers where a 6.4 m tower does. **The refusal was correct; the consequence of it was missing.** A
yard with a fence and no shed reads as a yard. A lone tower reads as a mistake. Gated on the fire
station's house, the church's nave and the hospital's slab — the three kinds where the vertical is
what NAMES the building. Delivered over 289 chunks: fire towers 2 → 1 against 1 shed, church 5 of
5, hospital 1 of 1.

### 2.6 AND THE HOSPITAL'S TOWER WAS CLAIMED INSIDE ITS OWN SLAB

The first arm put it on the slab's centre line, so `building × building` refused **every one** — two
hospitals, no towers, and the tower is the whole reason a hospital reads at a distance. A vertical
goes BESIDE the slab it serves. `placeTower` gives it the same seven-position search the masses get.

---

## 3. WHAT THE EIGHT DELIVER

Seed 1337, 289 chunks (17 × 17 about the origin), straight out of the pure generator:

```
  kind          chunks  sheds canopies towers   props
  church             5      5        0      5      10
  industrial         6      8        0      0      31
  school             3      3        0      0       7
  market             3      0        3      0      38
  firestation        2      1        0      1       3      1 shed, 1 tower — §2.5
  depot              2      2        2      0       4
  port               2      2        0      0      15
  hospital           1      1        1      1       0
```

**24 of 289 chunks, 8.3% of the city, are now a kind of place that did not exist eight commits
ago.**

---

## 4. WHERE YOU STAND DECIDES THE ANSWER, AND THAT IS THE POINT

Four of the eight are sited on the RIVER and the VIADUCT, which are authored at fixed world
coordinates and do not move with the seed. So a census that offsets its window by seed walks away
from them and reads `port 0, depot 1` — which is the sampling, not the city. **Two windows, twelve
seeds each (1337–1348), 1 200 chunks each, and the truth is that they bracket it:**

```
                            AWAY from the corridor      ON the corridor
                            (window offset by seed)     (window fixed at the river)
    low-detail chunks             183  (15.3%)                237  (19.8%)
    of those, PROGRAM              42  (23.0%)                175  (73.8%)
    industrial                      3   (1.6%)                 82  (34.6%)
    depot                           1   (0.5%)                 53  (22.4%)
    port                            0   (0.0%)                 20   (8.4%)
    school                         11   (6.0%)                  6   (2.5%)
    church                         10   (5.5%)                  7   (3.0%)
```

**THE CITY NOW HAS AN INDUSTRIAL BELT ALONG ITS RIVER AND UNDER ITS VIADUCT**, which is LOOK.md
§2's last bullet — *"Land under a viaduct gets sheds and yards"* — asked for since session 32 and
never read by anything until this session. A district away from the water is schools and churches,
because those are the two of the eight with no site condition at all.

**IT IS ALSO THE HONEST STATEMENT OF THE PROBLEM WITH IT.** 34.6% of the corridor's low-detail
islands are `industrial`, because that kind is deliberately the SINK for three other kinds' failed
conditions. The structure is right and the ratio is not. §8.

---

## 5. GATE STATE

Run individually and ALONE, which is STATE 45 §6.3's finding about this machine.

**`npm run gates` CHAINS WITH `&&`, SO LOOKCHECK'S FIVE-SESSION-OLD RED STOPS THE RUN** and
`windcheck`, `inputcheck`, `gateaudit`, `citycheck` and `perfcheck` never execute. The last five
were run one at a time afterwards and that is the only reason this table is complete. **Anyone
running `npm run gates` alone has been running three gates of eight since session 45.**

```
  parsecheck   GREEN   112 files, contract-clean. Unchanged from sessions 42-49: this session
                       added no file to the tree.
  faultcheck   GREEN   7 cases — quarantine surgical, the frame survives every one.
  windcheck    GREEN   567 mesh names over 567 meshes (floor 400), 563 of 563 cull-eligible
                       decided, 0 wound backwards. IDENTICAL to session 48. §2.1
  inputcheck   GREEN   keyboard 3.476 m/s, gamepad 3.470, mouse 0.02858°/count, lock acquired.
  lookcheck    RED at 3 — THE SAME THREE AS SESSIONS 45-49, AND NOT ONE BAND MOVED:
                         band:midnight 0.0828   band:dusk 0.1412   band:dawn 0.3023
                         band:noon 0.4288       crushed black 0.579%
                         distinct:midnight|dusk 0.02993 against 0.03000 — L15, FIFTH session
                       Byte-for-byte session 48's four numbers, which is what a change confined to
                       low-detail islands 400 m from the look camera should read.
  gateaudit    RED at 1, THE SAME ONE AS SESSIONS 45-49 — the carried control, naming exactly
                       lookcheck's three. 59 green rows: perfcheck --falsify 74/74 at 100%
                       coverage over 72 failure sites, citycheck 61/61 over 61, inputcheck 13/13
                       over 12, and both control sweeps.
  citycheck    RED at 3 — the same three, and `city arrived` did NOT time out (16 571 ms over
                       2 994 frames at load1 ~4.6, against session 46's 20 030 ms timeout at 12.38).
                         clumping CV 0.528 against 0.60 — WAS 0.451, and it moved the right way
                           for the SECOND session running, FOUR TIMES as far as session 48 moved
                           it. Over twelve regions the population goes 12 of 12 below the floor to
                           8 OF 12: median 0.552, min 0.224, max 0.880. Still red, still untouched
                           by instruction, and the mechanism is still variety rather than fill.
                         2 of 2720 sign quads inside a building, the same two
                         3 delivered overlaps — WAS 4. The three carried ones only; session 48's
                           own prop(fence) x feature(deckpark) is gone. This session INTRODUCED
                           thirteen and EXPOSED four more, and closed all seventeen before the
                           gates ran:
                             12  feature(canopy) x prop(parked)    introduced — §2.3
                              1  prop(bollard) x feature(canopy)   introduced — §2.3
                              4  path(ground:path) x feature(centre:square)
                                                                  pre-existing, exposed by the
                                                                  re-phase exactly as session
                                                                  48's pond was — §2.4
                         generator claims 12 801 (was 13 392), delivered 14 788 (was 15 262)
                         delivered by category now reads canopy 659 — §2.3
                         bright reserve 6.66% against 6.00
                         negative space 17.0% low-detail, 9 KINDS (min 3) — was 6
                         prop placement 0 of 3131 props inside a building
                         walkability 54 304 of 54 438 free cells — IDENTICAL to sessions 46, 47
                           and 48, so eight new kinds of place blocked nobody
  perfcheck    RED at 13 — two more than session 48, and both are in the vehicle silhouette
                       family. Every count is flat:

                            draws  s48    tris   tris s48   instances   inst s48   froxel  s48
    downtown_dense            317  317   1.95M     1.96M     242 818   245 654      49     42
    highway_speed             396  396   2.23M     2.23M     318 491   320 403      17     79
    night_rain                317  317   1.92M     1.92M     298 411   300 205      45     43
    player                    306  306   1.90M     1.90M     242 818   245 654      48     46

    roles  aircraft:1  traffic:96  stall:12  block:56  lamp:192  sign:16   — identical

                       **NOT ONE DRAW CALL AND NOT ONE TRIANGLE TO THREE FIGURES ON ANY ROUTE.**
                       `highway_speed` is 396 of 440 and 2.23 M of 2 360 000 exactly as it was
                       before this session. Instance counts fell slightly — a program island
                       carries fewer boxes than the construction site or yard it replaced.
```

**THE THIRTEEN SPLIT TEN / THREE.**

**TEN ARE FRAME TIME** — cpu p95, wall p95 and *"frames over 33 ms"* on `downtown_dense`,
`night_rain` and `player`, plus the headroom probe, at `load1` 5.0 with a browser rendering and
`mediaanalysisd` taking 1.4 cores. **Not admissible in either direction**, CONTRACT §0.2.

**`highway_speed`'s FRAME TIME IS NOT AMONG THEM, FOR THE SECOND SESSION RUNNING.** Wall p95
**12.10 ms against a 12.5 ms ceiling with a three-run spread of 0.0**, and cpu p95 **10.90 against
12.00**. Session 48 read 12.20 with a spread of 0.2; sessions 46 and 47 both read 12.90. §0.2 says
a GREEN absolute measured under load IS a verdict, because drift on this machine is one-sided and
load can only make a frame slower. **That route's ceiling is met on a session that added eight
kinds of place to it.**

**THREE ARE CONTENT, THEY ARE ALL ONE OBJECT, AND SESSION 48 HAD ONE OF THEM.** §5.1.

### 5.1 THE VEHICLE SILHOUETTE BARS — MEASURED WITH A PAIRED WORKTREE, NOT ASSERTED

Session 48 called its one red *"the same drawing-from-a-distribution the luminance floor does"* and
moved on. Three reds where there was one is worth four minutes, so both arms were measured:
`perfcheck --route=highway_speed`, the session-48 tip in a scratchpad worktree with `node_modules`
symlinked (STATE 41's method), **twice each**, so a between-commit difference can be read against a
within-commit one.

```
    arm                    vehicles   ground contrast   tone roughness   non-monotone   violations
    s48 tip   run A           74           0.7135           0.4523            54%            1
    s48 tip   run B           71           0.7132           0.4421            52%            1
    s49 HEAD  run A           70           0.9073           0.2882            49%            3
    s49 HEAD  run B           55           0.9517           0.4786            58%            2
```

**TWO OF THE THREE ARE NOT ATTRIBUTABLE AND THE THIRD IS.**

- **`tone roughness` and the non-monotone fraction STRADDLE.** HEAD's own two runs are 0.2882 and
  0.4786 — a spread of **0.19 on one commit**, which contains the whole s48 pair (0.4523, 0.4421,
  spread 0.01). Same for the fraction: HEAD 49–58% against s48 52–54%. **The first reading of each
  was the low draw, not a regression.** `budget.json`'s own `$estimator` note predicted exactly
  this: *"a pass fraction over fourteen carries a standard error near 12 points against a floor 4
  points away"*, and records it swinging **for five consecutive sessions on content nobody had
  changed.**
- **`ground contrast` SEPARATES.** s48 {0.7135, 0.7132}, spread **0.0003**; HEAD {0.9073, 0.9517},
  spread 0.044. The gap is 0.20 — three orders of magnitude past the s48 spread — and the two sets
  do not overlap. **This session moved it**, in the direction the metric calls BETTER (higher = a
  darker gap under the vehicle), while its PASS FRACTION sits on the floor at 73% and 75% against
  75%, so which side of the line it lands on is a coin flip.

**AND THE MECHANISM IS NOT ESTABLISHED. THE OBVIOUS ONE IS RULED OUT.** The silhouette metric
rasterises hulls against the DELIVERED FRAME's pixels, so what is under a vehicle matters, and the
new kinds do change ground albedo. `corridor.mjs` diffs the two arms' chunk kinds along
`highway_speed`'s own waypoints and finds **8 changed chunks**, four of them swapping
`parkingGround` [0.082, 0.082, 0.086] and `siteGround` [0.115, 0.107, 0.092] for `grass`
[0.062, 0.094, 0.045], the darkest ground in the city — the right direction for a deeper gap.
**But every changed chunk is at `cx` 3–5 and the three sample poses sit at x ≈ 129, −236, −601**,
250 m from the nearest one, and the sampler only measures vehicles within 60 m of a pose. So the
ground beside the route cannot be what moved it. §8.

**One earlier claim of mine was wrong and this is the correction.** I argued the bars could not
have moved because `harness.silhouettes()` walks only meshes carrying `userData.noctisSilhouette`
and this session's parked vans carry no such tag. The tags are irrelevant: **the metric reads frame
pixels**, so anything that changes what is behind or under a vehicle changes it, tagged or not.

---

## 6. HOW EVERY NUMBER IN THIS FILE WAS TAKEN

**NO INSTRUMENT WAS BUILT.** `emitcensus.mjs` answered the registry side, the pure generator
answered the populations, `citycheck` answered the delivered scene, and §5.1 is `perfcheck`'s own
route flag run in a worktree. `parsecheck` counts **112 files**, unchanged from sessions 42–49:
this session added no file to the tree.

**THE SCRATCHPAD**, none of it in the repository: session 47's `shot.mjs` copied forward unchanged,
plus `locate.mjs`, `census.mjs` and `corridor.mjs`, twenty lines each. `locate.mjs` exists because
a street camera cannot be placed by eye — eye height is 1.7 m and the subject is behind whatever
else stands on the island — and it derives BOTH frames of a pair from one run, so they cannot
disagree about which chunk they are of.

**THE FRAMES**, all in `tools/shot-out/`, all regenerable, the directory gitignored. Every one was
checked for its subject before anything was written about it, and **this session discarded more
poses than it kept**:

```
  what was wrong                                          how many
  the shooter's yaw 90 looks +X and I read it as -X          3   the hospital's camera stood on
                                                                 the island's east edge with its
                                                                 back to the hospital
  backed off by the mass's LENGTH, not the tallest thing     1   the church's spire cropped to its
                                                                 bottom three metres
  then backed off 2.4x the tallest thing                     1   139 m for a hospital tower — two
                                                                 chunks away, inside somebody
                                                                 else's island
  stood on the side with more ROOM, not a clear line         2   the depot's camera behind its own
                                                                 28 m workshop
  aimed at the nearest chunk of a kind, which had no mass    1   the fire station the viaduct
                                                                 correctly refused a shed — §2.5
  moved laterally to the crane and stood at its foot         1   the port, all mast and sky
  aerials older than the fixes they were meant to show       8   re-shot; the depot's STILL showed
                                                                 an empty cover — P12
```

**`shot.mjs`'s CONVENTION, WRITTEN DOWN BECAUSE IT HAS NOW COST FIVE FRAMES OVER TWO SESSIONS:**
the target is `pos + (sin yaw, ·, −cos yaw)`. **Yaw 0 looks −Z, 90 looks +X, 180 looks +Z, 270
looks −X.**

---

## 7. WHERE THE BRIEF DISAGREES WITH THE CODE

1. **"Session 48 … proved the budget is not the limit."** Correct, and this session is the test of
   it: eight kinds, and §5's route table is flat to three figures on all four routes.
2. **"A frame from above as well as from the street."** Honoured, and the aerials had to be taken
   TWICE — the first set predated §2.5's tower fix and P12's apron, and one of them was of a fire
   station that has no appliance house. §6.
3. **"Do not treat this as a list to complete."** Taken literally and then not needed: all eight
   read well enough to ship. What was cut instead was DEPTH — none of the eight has an interior, a
   service yard laid out on purpose, or more than one silhouette per kind. §1's *"a fixture set
   sized for the BUILDING rather than for the ISLAND"* is what that costs.
4. **"`minOccupancyMargin` has ~8 points of spread … do not act on one run of either."** Followed,
   and §5.1 is the same rule applied to a statistic the brief did not name — which is where it
   found something.

---

## 8. WHAT TO DO FIRST NEXT TIME

1. **`npm run gates` RUNS THREE GATES OF EIGHT.** The `&&` chain stops at lookcheck's carried red,
   which has been there since session 45. Whatever the fix — `;`, a runner that reports all eight,
   or finally closing L15 — nothing else on this list matters as much, because it decides whether
   anybody sees the rest. §5.
2. **THE GROUND-CONTACT BAR: ATTRIBUTED, UNEXPLAINED.** §5.1 has the four measurements and rules
   out the ground beside the route. The next step is the pose captures themselves — which vehicles,
   over what — not another `perfcheck` run.
3. **AN ARENA.** Session 48 left it first; session 49 did not reach it.
4. **FIXTURES SIZED FOR THE ISLAND, NOT THE BUILDING.** The church's four-pitch lawn and the
   depot's apron are the same defect, and it is the operator's session-46 complaint arriving
   through new content. §1.
5. **THE INDUSTRIAL CORRIDOR IS MONOTONOUS** — 34.6% of its low-detail islands. A second
   industrial silhouette splits it without touching the derivation. §4.
6. **HOIST THE BUILDING CLAIMS IN `buildChunkBody`** — session 47's item 1, still what stands
   between `emitcensus` and `UNDECLARED 5 → 3`, and still what blocks facade clutter.
7. **L1, THE WINDOW.** Carried since session 45. Bright reserve **6.66%** against a 6.00% floor.
8. **L15, `minPairMSD`.** Owed a derivation for a fifth session. **Do not lower it to 0.029.**
