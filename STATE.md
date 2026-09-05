# NOCTIS — STATE

*End of session 80. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`. Every gate that
reads a pixel printed `ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

> ***THE BOOT CHANGED.*** Sessions 47–79 all ran on one 17-day uptime. This session opened at
> **4 h 46 min of uptime** — a different boot, and the first machine-level discontinuity in
> thirty-three sessions. Nothing below depends on it and it is recorded because §0.1 says the
> machine is part of the measurement.

***`load1` RAN 3.86–16.44 THROUGH THIS SESSION***, over CONTRACT §0.2's bar of 1.6 for the twentieth
session running, with a Unity build at 78% CPU and iCloud syncing throughout. **No millisecond below
is a verdict.**

Branch `claude/noctis-78-the-city`, continued off session 79's head. Six commits.

---
## 0. THE HARBOUR QUAY AT MIDNIGHT, AND IT WAS NEVER BLACK

**Session 79 gave three destinations dusk on the grounds that `glow()` deposits no light and the
quay floods light nothing. THE FLOODS ARE NOT `glow()`.** They are six `flood` features routed to
the lamp pool by session 77, and the first thirty minutes of this session measured what they
deliver at session 79's own destination.

```
                            session 77's own point      session 79's harbour-quay
                            `sea-harbour`, 106 m out    on the apron
  lamp pool                 5 of 5                      6 of 6
  median surface luminance  0.1900 cd/m²                3.4042 cd/m²      17.9×
  p90                       0.512                       5.113
  max                       5.67                        7.82
  under 16/255              93.1%                       41.6%
  draws                     78                          75
```

Session 77 reported **0.1903 / 0.514 / 5.67 / 93.1% / 78** at that point. The control reproduces it
to the fourth decimal in this build, so the two figures are comparable and **the difference is the
POINT, not the night**: `sea-harbour` stands 106 m out over open water and most of its frame is sea,
which is what session 77's own STATE said. The nearest quay mast is **24.7 m** from the destination's
eye.

**THE THREE FRAMES, all `node tools/destshot.mjs --keys=harbour-quay`:**

```
  dest-harbour-quay-ship-t0.png       t 0     the shipped pose, MIDNIGHT     6/6 lamps  median 12  under16 52.7%
  dest-harbour-quay-opp-ship-t0.png   t 0     the opposed bearing, 740 m out 0/0 lamps  median 12  under16 76.6%
  dest-harbour-quay-dusk-t0_78.png    t 0.78  session 79's dusk arm          6/6 lamps  median 23  under16  4.9%
```

At midnight the apron is a lit plate with the container stacks, the sheds and the crane legs dark
against it. **From the sea it is a silhouette against the city's own glow — 0 lamp candidates at
that range**, because `quayFloodRadiusM` is 180 m and the Frostbite window is exactly zero beyond
it. That is falloff and not a gate, and it is §9 item 2. `dest-harbour-quay-mid-t0.png` is the same
midnight pose before this session's repairs; the difference is four sodium points on the two working
cranes.

**`harbour-quay` CARRIES MIDNIGHT NOW.** The other two dusk destinations keep dusk, and their
`proves` fields say the measured reason instead of the refuted one — see §2.

---
## 1. ITEM 1a REFUTED BOTH ARMS OF ITS OWN PREMISE, AND IT TOOK ONE COMMAND

The brief offered two worlds: *"either the repair does not reach these points, or session 79's
destinations land where no mast stands."* **Neither.** The repair reaches (6 of 6 in the pool), the
destination stands beside a mast (24.7 m), and the frame is not black (median 3.404 cd/m², 41.6%
under 16/255 — the lowest dark fraction the harbour has ever printed).

**SO CONTRACT §9.3's FIFTH ROW IS CLOSED, AND IT WAS CLOSED IN TWO HALVES BEFORE ANYBODY SAID SO.**
Session 76 routed the airfield's thirteen masts; session 77 routed the quay's six. It stayed on the
list for four sessions because **each session read the row and not the call graph** — which is the
exact inverse of the remedy §9.3 states in its own last paragraph. The row is marked closed there,
with a rule beside it: *a row of that table is a claim about `grep`, so a session that carries one
forward re-runs the grep that put it there.*

---
## 2. ALL THIRTY-EIGHT `glow()` CALL SITES, READ ONE AT A TIME

Session 75 counted seventeen. There are **thirty-eight**, in fifteen feature kinds.

```
  villa 3   flood 1   gantry 3   quaykit 1   transitshed 1   gatehouse 2
  afstrip 2  afthresh 2  afapproach 2  afsock 2  afterm 4  afpier 3
  afhangar 3  aftower 2  afstand 7
```

**THIRTY ARE LIT SURFACES BY CONSTRUCTION** — windows, fascias, sign blades, a cab's glazing, a
dockers' hut's window, aircraft cabin and flight-deck windows, port/starboard/aft position lights, a
tower's obstruction light, and the whole aviation light diagram: runway edge and centreline LENSES,
threshold wing bars, the approach row, the aerodrome beacon. **A runway is not floodlit in life and
must not be here**; those lenses are signals aimed at a pilot's eye and they light nothing on
purpose.

**EIGHT LOOK LIKE FIXTURES AND EVERY ONE OF THEM IS A HOUSING**, refused for a reason and not for
budget:

| site | why it is not routed |
|---|---|
| `gantry` under-portal floods ×4 | the deck under the portal is already at its own derived target. The six quay masts stand **28.00 / 37.33 / 28.00 m** from the three cranes and `QUAY_FLOOD_OPTIC`'s 37° cone was solved from that pitch. |
| `gantry` boom floods ×2 | 12 and 27 m out over open water past the quay face; three of the four land on sea, one on a moored coaster. |
| `afterm` roof heads ×2 | session 76 sited four masts 14 m off the terminal face throwing north. The roof heads sit on modules 0 and 2 — a **120.8 m** pitch against the **87.8 m** ceiling that session solved from its own cone. Three disjoint pools with black between them, on ground already covered evenly. |
| `afpier` tip mast ×2 | the pier's own centreline carries a routed 25 m apron mast whose 43.9 m pool covers the tip. Its session-75 comment — *"which is what lights the apron"* — was already false when it was written and session 76 answered it in geometry. |
| `afhangar` door-header worklights ×2 | a punctual light 1.5 m inside a roofed shell has no occluder in this renderer (`lights.js`: *"a streetlight can spill through a wall"*), so routing would put the interior lighting on the outside walls. |
| `afhangar` door-head flood | a 3.0 × 0.9 panel lying flush on an L-metre lintel, with no housing, no bracket and no mast. Paint on a beam. |
| `gatehouse` canopy pair | outboard of a 10 m carriageway by 0.2–2.8 m, vertical, facing the approach road, and the branch's own header calls them a sign gantry. |
| `villa` door lamp | the terrace lamp beside it is the villa's real light and it was inside the house — §3. |

**AND `glow()` COMPOSES A YAW AND NEVER A PITCH**, which is the general answer to five of those
eight: *"aimed down at the apron"*, *"pointing at the deck below"*, *"aimed in over the floor"* are
intents the primitive cannot carry, and the file already says so in one place fifty lines from three
of them.

**PREMISE (ii) IS THEREFORE UNANSWERABLE AS ASKED AND THE ANSWER IS BETTER.** Nothing needs routing.
The 384-slot budget was never the constraint — the streamed lamp pool is a POOL, distance-sorted, 96
slots, and the harbour reads 6 of 6 and the apron 9 of 9 with it nowhere near saturated. Routing all
eight would have cost ~45 candidates and no slots, and would have double-lit ground already at its
derived illuminance.

---
## 3. WHAT THE CENSUS FOUND INSTEAD — SIX PLATES NO CAMERA COULD SEE

Every one is LOOK.md §7's class: session 75's 82 lights, one scale down, in the geometry sessions
71–77 built the harbour's and the airfield's night around. All six are one line each and none costs
a draw call.

1. **THE FLOOD RACK'S OWN LENS WAS INSIDE ITS OWN HOUSING.** The head box is 5.4 × 0.9 × 1.8 and the
   quad was 5.2 × 0.7 at `dz = 0` — smaller in both dimensions, on the plane through the box's
   centre, against an opaque depth-writing material. **Occluded from every direction including the
   aim.** What has been visible on a quay or apron mast since session 71 is the lamp BOWL. Moved to
   the housing's front face along the aim. `afstrip`'s runway edge light takes the other route — a
   0.5 × 0.34 quad against a 0.34 box, oversize — which is why that one has always read.
2. **THE GANTRIES' UNDER-PORTAL FLOODS WERE 79% BEHIND THE BEAM THEY HANG OFF.** The cross-beam
   occupies y 16.0–18.4; the floods stood at 16.2 ± 0.35. Dropped to `portalY − 0.6` and made
   `glowOmni`, because their normals pointed INTO the beam 0.1 m away and flipping the yaw would
   have hidden them from the two committed poses that stand seaward.
3. **THE PIER'S TWO GLAZING PLATES HAD EACH OTHER'S YAWS.** `citygen` states the convention beside
   the stands that use it — *"`put` maps local +Z to world +X at yaw 90"* — so the west plate at
   `−(W/2 + 0.38)` with yaw 90 faced +X, into the pier body 0.38 m away, and the east plate did the
   mirror. **Both invisible from everywhere**, on a branch whose comment reads *"glazed both long
   sides, because a pier is seen from both stands."*
4. **THE VILLA'S DOOR LAMP HAD ITS YAW APPLIED TWICE.** `put`'s yaw argument is ABSOLUTE and
   `glow`'s is RELATIVE, and this is the only `glow` call in the file that passed `put`'s form. World
   heading was `2·f.yawDeg + 24`, and the villas carry 64° to 127°, so on the fifteen houses where
   `f.lit` is 1 the lamp showed its back on a `FrontSide` quad. The two glazed elevations either side
   of it pass a literal 0 and were always right.
5. **THE VILLA'S TERRACE LAMP WAS INSIDE THE HOUSE.** Local `(+7.14, 0)` is inside **four of the nine
   boxes** `city.js` draws — the long volume, its roof deck, the crossing volume and its deck — so
   the only real light this population owns stood in the living room at 3.4 m under 7.2 and 10.4 m of
   masonry, and 4.70 m short of the terrace its own comment names. Moved to `(0.52·L, 1.05·D)`,
   checked clear of all nine one at a time, through the full rotation rather than the one-scalar form
   that could only ever offset along local +x. **CONTRACT §9.1 with a luminaire in it**, and no gate
   could see it: the villas stand 3 293–4 079 m out and `citycheck`'s region is the ±640 m square.
6. **THE HANGAR'S DOOR-HEADER WORKLIGHTS FACED THE BACK WALL.** Yaw 0 on a branch whose own comment
   says the door faces local −Z. Their sibling three lines up carries 180 and is correct. **They have
   never been rasterised by any frame this project has taken.** `glowOmni`.

**AND ONE NUMBER WAS 38× WRONG AGAINST THIS PROJECT'S OWN CONSTANT.** The control tower's
obstruction light was `signPlateNits · 5.0` = 430 cd/m² where `LIGHT.aviationRedNits` = 16 300 exists
for exactly that fixture, derives itself from ICAO Annex 14 Type B's 2000 cd over a `BEACON_M`
square, and `materials.beacon` has carried it since session 19. **Taking the constant means taking
its denominator** — 16 300 over a 0.7 m square is 7 987 cd, four times the standard — so `BEACON_M`
is hoisted to module scope and the quad is now the square the radiance is derived over. One number,
two readers.

---
## 4. THE 2 794 WERE THE CAMERA, AND THE CAMERA'S OWN COMMENT SAID SO

**`tools/stoplineprobe.mjs`, 25 920 frames at dt = 1/60, seed 1337, three builds differing only in
two expressions of `traffic.js`:**

```
                                      in-box   episodes   longest   phantom
  A  as shipped                        2 794        17     2.52 s     3 131
  B  + the camera-lane guard               3         1     0.05 s     2 650
  C  + the phantom-junction grant          0         0        —           0
```

Arm A reproduces session 79 to the digit — 2 794 / 17 / 151 frames / a 12 m bus 3.551 m past a
junction centre / 3 131 samples at (0, −384) / 58 turn exits, 0 stale.

**THE CAMERA-AS-OBSTACLE TEST NEVER ASKED WHICH CARRIAGEWAY, OR WHETHER THE CAMERA WAS AHEAD.** Its
own comment has claimed both since session 33: *"on the same line, ahead of it. A camera on the
pavement, ON THE OTHER CARRIAGEWAY or on a different street is not an obstacle and must not slow
anything down."* Two of those four clauses were in the prose and in no expression.

- `camLane.dir` was assigned by the scan above the test and `grep -n 'camLane\.dir'` returned exactly
  one hit — its own assignment. A lane's offset is `dir · LANE_OFFSET[lane]`, so `(dir, lane)`
  TOGETHER name it: `(+1, 1)` is +5.25 m and `(−1, 1)` is −5.25 m, two lanes 10.5 m apart on opposite
  sides of the street.
- `gapCam` is signed in the vehicle's own travel direction, so for any vehicle the camera was BEHIND,
  `gapCam` was large and negative, `gapCam < safe` was trivially true, and
  `max(0, FREE_SPEED · gapCam/safe)` collapsed to **exactly 0**. The vehicle braked at `BRAKE_A` to a
  dead stop and stood wherever it happened to be — mid-block, or with its body in a junction box, on
  green, holding permission, invisible to `worstStopLineM` by that statistic's own filter.

**THAT IS THE OPERATOR'S SENTENCE**, and it is three lines of car-following rather than the exit
reservation four sessions of briefs have carried. **PREMISE (iii) IS TRUE**: one mechanism, 99.89% of
the census.

**AND THE PHANTOM JUNCTION IS REPAIRED WHERE IT IS CHEAPEST RATHER THAN WHERE IT WAS FOUND.** Session
79 declined it because teaching `nextJunctionAhead` to skip a node needs the vehicle's axis and line
and a loop across six call sites, on a module-level function with no `rootSeed` in scope. The node
stays and the **permission** is granted unconditionally: nothing crosses a road that is in the river,
so there is nothing to yield to and no conflict for the phase to protect. One disjunct on the grant,
short-circuited so it is evaluated only on red, on the same memoised `crossingMissing` the census
beside it has called since session 79 — **one predicate, three consumers instead of two.**

> **THE EXIT RESERVATION SESSION 21 ASKED FOR IS NOT BUILT AND SHOULD NOT BE.** The population it was
> proposed for is 0 after two lines of guard. Session 21's diagnosis — *"vehicles queue into the
> junction box"* — was a plausible mechanism for a number produced by a different one, which is
> CONTRACT §9 row 21a exactly: a repair carried for four sessions for a defect that was not there.

---
## 5. ITEM 2d — THE FILTER IS NEITHER FIXED NOR RETIRED, AND THE ASSERTION I BUILT FOR IT DID NOT SURVIVE ITS OWN BATTERY

`worstStopLineM` is written only inside `if (veh.cleared !== nextJ)`. **That filter is CORRECT for
the question it asks.** A vehicle with permission is supposed to drive through the box and its
`toStop` goes negative legitimately; admitting one would make the number measure the green light,
which is what its own comment says. What was missing was not a wider filter but the **paired
statistic** for the population it excludes by construction — CONTRACT §7.2's own rule.

**`traffic.stats().inBoxStoppedPermittedTotal` IS BUILT, PUBLISHED AND GOOD.** Run-cumulative over
the module's life (the three counters beside it are reset every frame and belong to `stoplineprobe`,
which integrates them itself). It is what took session 79's census from 2 794 to 3 to 0 across three
builds, and `stoplineprobe` prints it beside its own integration — two paths to one number, and they
agree.

**IT WAS ASSERTED IN `perfcheck` FOR EXACTLY ONE BATTERY AND THE BATTERY REFUSED IT.** Same build,
same route, same seed, two runs differing only in what else the machine was doing:

```
  downtown_dense   CPU p95 47.10 ms  ->     0 vehicle-frames
  downtown_dense   CPU p95 30.80 ms  ->  1 133 vehicle-frames
```

**A VEHICLE-FRAME COUNT IS A COUNT OF FRAMES.** A route that renders faster delivers more of them
and steps the integration finer, so the quantity moves with the observer's load — CONTRACT §0.2's
own category with an integer instead of a millisecond. And §0.2's guarantee does not cover it: that
section holds because drift there is ONE-SIDED, so a green absolute is still a verdict. **This one
is red on a quiet machine and green on a busy one**, which is the inversion. Withdrawn the same
session it was added, with both measurements in `budget.json` →
`$maxInBoxStoppedPermitted_WITHDRAWN`. `perfcheck --falsify` is back to **75/75 at 100% coverage**.

> **THE CONTROL CAME BEFORE THE FLOOR AND THE CONTROL WAS STILL NOT ENOUGH — §9 row 71, with a
> lesson attached.** The three-build table in §4 is a real control: it separates 2 794 from 0 on one
> route. What it does not do is establish that 0 is what a DIFFERENT route delivers.
> `stoplineprobe` walks one axis in a straight line and is not dense enough to produce spillback;
> `downtown_dense` is. **1 133 vehicle-frames on a dense downtown route may be perfectly ordinary
> queueing, and nothing built this session separates ordinary queueing from the defect.** A control
> that shows a statistic MOVING is not a control that shows what its floor should be.

**WHAT WOULD BE ASSERTABLE** is an EPISODE count — one per time a vehicle comes to rest inside a
box, not one per frame it stands there. `stoplineprobe` already computes episodes globally
(17 → 1 → 0); `traffic.js` does not keep them per vehicle. Next session's five minutes, and it needs
its own control on a route that queues.

---
## 6. THE FOUR STANDING REDS HAVE CONTENT, AND ALL THREE OF THE OLD ONES HAVE MOVED

**Nobody had ever read inside them.** Printed at HEAD as a baseline, then `lookcheck` run at session
53's head (`1f2a3a2`) in a paired worktree outside iCloud and diffed line by line:

```
                           s53 (1f2a3a2)        s80 HEAD
  distinct:midnight|dusk     0.02954             0.02774    −6.1%, AWAY from its 0.03 floor
  facadeAlbedo closest pair  0.168               0.177      +5.4%, toward the 0.35 separation
  facadeNeighbours           1.292 1.932 0.229   1.145 1.646 0.216
                                                            all three DOWN, and the pair that
                                                            fails went 0.229 → 0.216, further
                                                            from the 0.3 bar it has to clear
  stddev:dusk                green               0.1267     red since 7be7adf (session 78)
```

**PREMISE (iv) IS TRUE AND IT IS ALL THREE, NOT AT LEAST ONE.** Twenty-seven sessions of content
moved every number in every standing red, two of them the wrong way, with the exit code 1 throughout
and nobody looking. And the brief's own framing needs one correction: **the four have NOT been red
since session 53.** Three have; `stddev:dusk` turned red at session 78's height gradient, which
STATE 79 §5.1 established and this session's A/B confirms — it does not appear in session 53's output
at all.

**THIS SESSION MOVED NO BAND.** `lookcheck`'s four violation lines are byte-identical between the
baseline battery and the final one, every digit. The rule is now in CONTRACT §10 in both directions:
diff the lines forward against the previous session, and backward against the session the red
started in.

---
## 7. THE BATTERY, RUN THREE TIMES

**A baseline at session 79's head before anything was touched; a run after the repairs, which found a red
of my own making (§5); and a final run after it was withdrawn.**

```
  gate         baseline   after repairs   final    seconds   load1 in
  parsecheck    0 GREEN      0 GREEN      0 GREEN      3.8      3.99
  faultcheck    0 GREEN      0 GREEN      0 GREEN     29.3      4.47
  lookcheck     1 RED, 4     1 RED, 4     1 RED, 4    53.7      4.76   IDENTICAL LINES, ALL THREE
  windcheck     0 GREEN      0 GREEN      0 GREEN     54.5      4.81
  inputcheck    0 GREEN      0 GREEN      0 GREEN     17.8      5.22
  gateaudit     1 RED        1 RED        1 RED       94.2      5.83   downstream of lookcheck
  citycheck     1 RED, 4     1 RED, 4     1 RED, 4   146.1      7.10   + a streaming flake in two of three
  perfcheck     1 RED, 15    1 RED, 16    1 RED, 15  1454.2      7.14
```

The middle column is the run that carried **one violation this session put there** — §5 — and
withdrawing it took `perfcheck` back to fifteen, thirteen of which are milliseconds.

`citycheck`'s figures are unchanged on every number STATE 78 and 79 tabulated: occupancy claims
**18 794**, delivered **19 082**, forbidden overlaps **7**, sign quads **2 699**, one sign inside a
building, clumping CV **0.396**. **Everything this session changed stands 3.3 to 5.2 km out**, past
`citycheck`'s ±640 m region and past every `lookcheck` eye, which is why the two gates could not move
and did not.

> **TWO OF THE THREE RUNS CARRIED A FIFTH `citycheck` VIOLATION AND IT IS THE MACHINE.**
> *"the city had not finished arriving when the census was taken"* — bound hit at **wall after
> 2 440 frames / 20 057.7 ms** in one run and **1 710 frames / 20 053.8 ms** in another, both with a
> bake still in flight, and absent from the run between them. That is `citycheck`'s 20-second
> wall-clock bound reading LOAD as a streaming defect: the frame counts differ by 30% and the
> milliseconds agree to 4 parts in 10 000, which is what a clock timing out looks like and not what a
> stall looks like. The four content violations are byte-identical in all three runs.

**`perfcheck` CARRIES NO TRIANGLE AND NO DRAW BREACH, AND `highway_speed` IS UNCHANGED TO THE
DIGIT.** **405 draws, 2 592 572 triangles, 358 386 instances** in all three runs — session 78's and
79's three figures, which is this session's whole cost attribution on the binding route. Of the final
run's fifteen violations, twelve are milliseconds and frame counts at `load1` 4–7 (CONTRACT §0.2: not
verdicts in the red direction), one is the headroom probe whose own defect is documented, and **two
are the vehicle silhouette** — 73% of 55 vehicles with a dark gap at the ground (min 75%) and 69%
with a non-monotone tone profile (min 75%).

**THAT STATISTIC MOVES WITH THE SAMPLE AND NOT WITH THE BUILD**, and this session has four more data
points for it: 46 vehicles at 61%, 63 at 49%, 66 at 53%, 59 at 59%, 64 at 67%, 55 at 69%. Session 79
reported three silhouette reds and this run has two — the tone-ROUGHNESS figure came back 0.4129 and
0.7255 on two runs against its 0.3 floor. The underlying defect does not move: it is the vehicle rear
nobody has built.

---
## 8. THE FOUR PREMISES

| | premise | verdict |
|---|---|---|
| (i) | the harbour is black because `glow()` deposits no light, and not because session 79's destination stands away from session 77's masts | **FALSE ON BOTH ARMS, and the harbour is not black.** 6 of 6 in the pool at the destination, the nearest mast 24.7 m away, median surface luminance 3.404 cd/m² against 0.1900 at session 77's own point in the same build. §0, §1 |
| (ii) | routing every light-emitting `glow()` site fits inside 384 slots | **UNANSWERABLE AS ASKED, and the real answer is that nothing needs routing.** 30 of 38 sites are lit surfaces by construction and the other 8 are housings inside pools that already exist. The pool is a POOL and was never the constraint: 96 slots, distance-sorted, 6 of 6 at the quay and 9 of 9 on the apron. §2 |
| (iii) | the 2 794 stopped-with-permission frames are one mechanism rather than several | **TRUE — 99.89% of them, and the mechanism is not in the permission system at all.** The camera-as-obstacle test never asked which carriageway or whether the camera was ahead. 2 794 → 3 on that guard alone, → 0 with the phantom-junction grant. §4 |
| (iv) | at least one of the four standing reds has changed content since session 53 while keeping its colour | **TRUE, and it is all three of the ones that were red then.** Two moved AWAY from their floors. The fourth was not red in session 53 at all. §6 |

---
## 9. WHAT TO DO FIRST NEXT TIME

**1. A VEHICLE-FRAME CENSUS THAT SWINGS 0 → 1 133 WITH THE MACHINE'S LOAD IS AN OPEN QUESTION, NOT A
CLOSED ONE.** §5 withdrew the assertion; it did not explain the number. Two things are unseparated
and both are cheap to separate: **(a)** is 1 133 vehicle-frames on `downtown_dense` ordinary
spillback — a queue that backs through a junction for a second and clears, which is what a dense
downtown does and what box-junction markings exist for in life — or is it the defect? **(b)** why
does it read 0 at 47 ms a frame and 1 133 at 31 ms? Both are answered by an EPISODE counter kept per
vehicle plus one run of `perfcheck --route=downtown_dense` at two deliberate frame rates. **Until
that is done, the only honest statement about junction-box stopping is the one in §4: on
`stoplineprobe`'s route it is zero, and on a dense route nobody has looked.**

**2. THE HARBOUR IS LIT FROM INSIDE 180 m AND FROM NOWHERE ELSE.** `quayFloodRadiusM` is 180, so the
Frostbite window is exactly zero beyond it and the opposed-bearing frame in §0 has **0 lamp
candidates at 740 m**. A port seen from the sea is one of this world's best available pictures and it
is currently a silhouette. The question is not the pool and not the near ring — it is whether a
harbour wants a second, longer-throw fixture (a real one has floodlight towers seen from miles) or
whether the sodium sky-glow belongs in `atmosphere.js`. Cost it before building.

**3. THE AIRFIELD APRON IS LIT WHERE THE STANDS ARE AND BLACK WHERE THE CAMERA STANDS.** Session 76
solved the mast pitch from its own cone so the pools land on the stands; `airfield-apron` stands
270 m south of the nearest row and gets a lit terminal across a black plane. Either the destination
moves onto the stands or the apron gets a second row — and the second row is what a 320 × 300 m apron
actually has.

**4. THE `city:signs` RING TRUNCATES THE APPROACH ROW.** `afstrip` stations are 60 m apart and the
sign mesh is merged at ring ≤ 5 (640–768 m), so at most 12–13 station pairs of a 3 km runway are ever
in it. LOOK.md's own pose audit already measured this — *"its 'and the runway edge rows' is 4
stations of 50."* **Nits are not the problem; range is.** A row receding to a vanishing point is the
whole diagram.

**5. PEDESTRIAN CROSSINGS — item 4d of session 79 and item 2e of this one, not reached twice.**
Twelve figures at one spacing along one pavement, all facing the same way. `traffic.js` already reads
`streetlife.crossingBlocked` and withholds permission on it, so the channel exists in one direction.

**6. THE CARRIAGEWAY IS AN EMPTY SLAB** — 30–45% of every street frame, one flat tone with four
dashed lines. The route is a 4 m PARTITION (not an overlay — coplanar plates need the 1 mm ladder) at
41 268 triangles and ZERO draws, plus per-corner colours, because `quad()` flat-shades.

**7. THE VEHICLE REARS.** `perfcheck` carries a standing red that would MOVE if it were built: 59% of
59 vehicles carry a non-monotone tone profile against a floor of 75%. The body is a lofted sweep of
ONE shared 8-point section; a rear that reads needs a second profile interpolated along the spine.

**8. `poseprobe` IS STILL NOT CALLED BY THE POSE GENERATOR** — §9.3's seventh row, and session 79
showed what calling it buys and what it does not: a stand-off test answers *"is anything in the way"*
and never *"is this broadside"*, so the generator needs the frame as well as the ray.

**9. THE FOUR REMAINING BARE LANDMARKS** — `weir` first (26 149 m² and 4 999 m² of jointless
concrete, the two biggest single surfaces in the city, and there is now a destination that shows
them), then `arch` and `mast`.

**10. THE SKYLINE'S HARD EDGE.** The city still stops at a straight line against bare ground; that is
`extentEdgeM`. **And §6 is the warning that comes with it: the last change to building height turned
a fourth `lookcheck` assertion red and moved a fifth number the wrong way, and nobody noticed for a
session.**

**11. `AIRFIELD.edgeStepM` AND `afPaint` are still declared and never read.**

---
## 10. THE STANDING LIST — recorded so nothing is lost

- **THE BRIDGE CABLES GO TO NOTHING.** Cable stays crossing the whole view, meeting no pylon and no
  beam, some passing in front of buildings blocks away.
- **THE STREET-END BUILDING IS TRANSPARENT AND STEPPED.** That is `stack` seen from the street;
  session 78 gave it floor bands, galleries and corner piers, and the frame that found it has not
  been retaken.
- **THE HARD ROAD-COLOUR SEAM** across the street in the gate's own eye, where the origin block's
  pale carriageway meets the streamed city's dark asphalt.
- **`condenser-street` STILL DOES NOT SHOW THE CONDENSER.**
- **VEHICLE REARS ARE FEATURELESS LOAVES**, **PEDESTRIANS STAND IN EVENLY-SPACED LINES**, **THE WATER
  MOIRÉS** into corduroy at grazing incidence, **THE GRASS IS A FLAT GREEN SLAB**, **THE MARKET
  CANOPY IS EMPTY**.
- **`citycheck`'s fourth violation is 1 004 of 284 918 walkable samples (0.35%, 0.40 ha) standing on
  the `block.js` earth plane with no surface drawn over it.** `node tools/surfacegrid.mjs --patches`
  says where.
- **THE GATEHOUSE BRANCH PROMISES A SIGN GANTRY IT DOES NOT BUILD.** Its header enumerates *"a cabin,
  a canopy over the lanes, two barriers and a sign gantry"* and no sign gantry exists anywhere in the
  branch — which is a standing invitation to misread its two sodium quads as either thing.
- **`materials.beacon` DOES NOT FLASH ON THE CONTROL TOWER.** `constants.js` says 30/min *"is what an
  obstruction light on a tower actually does"*; the flashing route is `materials.beacon` and the
  tower's light is a `glow` quad on `materials.sign`, which has no phase.

---
## 11. THE INSTRUMENTS THIS SESSION ADDED

- **`harness.destinations()`** publishes `ui.destinationList()`. Null unless `?ui=1` — which follows
  `?player=1` by default — so no gate sees it.
- **`tools/destshot.mjs`** shoots the shipped destinations from that list at **fov 75**, the player
  camera's rather than `lookat`'s 55, optionally from **two opposed bearings** (`E' = 2L − E`), and
  prints lamp-pool occupancy beside the frame's green-channel distribution. It reads the poses rather
  than rebuilding them, which is the arrangement `ui.js`'s own comment asks for.
  `node tools/destshot.mjs --keys=harbour-quay --t=0 --opposed`
- **`traffic.stats().inBoxStoppedPermittedTotal`**, run-cumulative, asserted by `perfcheck` — §5.
