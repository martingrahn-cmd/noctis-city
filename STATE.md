# NOCTIS — STATE

*End of session 57. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`, 12 d 11 h of
uptime — the same boot as sessions 47–56. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` READ 2.27 AT THE FIRST COMMAND and ran 1.37 to 4.89 across the night — it went QUIET
for the first three gates and loud for the rest (§6). NO ABSOLUTE MILLISECOND HERE IS A
VERDICT.*** Every number this session turns on
is a COUNT — triangles, instances, populations — and §0.1's corollary is that counts do not
drift. That is the whole reason item 0 could be settled on a loud machine.

Branch `claude/noctis-57-what-a-city-has`, five commits, all pushed as they landed.

---
## 0. THE TRIANGLE NUMBER, WHICH THE BRIEF ASKED FOR FIRST

**THE CEILING STANDS. IT WAS NOT MOVED, AND IT DID NOT NEED TO BE.**

```
  arm                                        triangles    draws   instances
  WORKING LOD      detailRadius 4 (ships)     2.36 M       401     333 734
  LOD DEFEATED     detailRadius 5             2 945 208    415     420 025
                                              ─────────
  a broken LOD costs                          1.248x       (session 37 measured 1.278x)
```

Both arms measured this session on `highway_speed` — the binding route — at seed 1337, the
working arm on a clean tree and the defeated arm with the one constant changed and the tree
restored afterwards. **The ratio HOLDS**, which is the brief's own test: *"If the ratio holds,
the ceiling stands and this session pays for every new triangle with an old one."* It did.

**AND THEN THE SESSION PAID.** After the population cut (§2) and everything in §§3–5:

```
  highway_speed   2.36 M  ->  2.30 M      headroom against 2 360 000:  ~1 500  ->  ~60 000
```

### 0.1 WHAT HAS DRIFTED, AND IT IS NOT THE RATIO — A QUESTION FOR THE OPERATOR

The ceiling is not merely a number between the two arms; session 37 derived it as **the
GEOMETRIC MEAN of them**, on an explicit argument — *"equidistant in RATIO from a false red and
a false green, which is the right symmetry for a multiplicative quantity"*. That property has
drifted, because the CITY grew inside it:

```
                          working arm    defeated arm    geometric mean    ceiling sits at
  session 37, measured    2 086 042      2 666 516       2 358 500         1.131x working
  session 57, measured    2.36 M         2 945 208       2 636 000         1.000x working
```

So the ceiling still DISCRIMINATES — a defeated LOD delivers 2 945 208 and is rejected — but it
no longer sits between the arms with room on both sides: before this session's cut it stood
**1.0006× the delivered city**, where any content change at all breaches it, LOD-related or not.
A detector whose margin is smaller than the thing it must resolve reports content as LOD
failure, which is CONTRACT §0 rule 6's own subject.

**IT IS NOT MOVED AND THIS SESSION DID NOT NEED IT MOVED.** Re-deriving by session 37's own
formula on today's arms gives **2 630 000**, and that is the number a future session would use
if it wants headroom without a cut. Raising it here would have been a ceiling raised on the
session that wanted the room — the shape CONTRACT §0 rule 5 forbids — when a cut was available
and the operator had already authorised one. **The question for the operator is whether the
ceiling should be re-derived at 2 630 000 (restoring its own symmetry, still rejecting a broken
LOD by 1.12×) or held at 2 360 000 and paid for in content every session.** The measurement is
here either way.

---
## 1. THE EYE-LEVEL FRAMES, WHICH IS WHERE HE WALKS

```
  s57-iron-close-t0_5.png        THE ITEM-1b FRAME. A streamed carriageway from 6 m: a gully
                                 casting in the channel, a manhole on the crown, another on
                                 the near-side duct line, against lane and edge paint.
  s57-iron-noon-t0_5.png         The same street from 1.7 m — where the castings are subtle,
                                 which is what cast iron on concrete at 0.67x IS.
  s57-iron-midnight-t0-wet.png   THE VERDICT FRAME. Wet midnight on the same street: a
                                 handful of vehicles, one pedestrian in a lit shopfront, the
                                 moon on the road. The night is quiet now, which is item 0d.
  s57-road-noon / s57-pavement-noon   1.7 m on the origin block's pavement, the new furniture
                                 among the crowd at noon.
  s57-barge-t0_5.png             ITEM 1f. A barge moored against the quay wall, hold cover,
                                 deckhouse aft, mast — with a person on the quay above it.
  s57-craft-nadir-t0_5.png       The same from 45 m, which is how the moorings were confirmed
                                 after three frames failed to show them (§5.1).
  s57-river-reach-t0_5.png       East along the river from the girder bridge.
```

---
## 2. ITEM 0d — THE POPULATIONS COME DOWN, AND FOR THE FIRST TIME THEY READ THE CLOCK

The operator released these counts and gave the reason: *"there is really too much"*, and *"an
outer arterial at 3 a.m. should not be busy"*. Those are two different asks and they needed two
different answers.

**THE BASE CUT** — pedestrians **360 → 280**, vehicles **160 → 120**. The vehicle figure is
costed in `traffic.js`'s own units, beside the two numbers that file already argues about:

```
  160 over 1771 m of centreline   one every 11.07 m over four lanes   975 veh/h/lane  "busy"
  120                             one every 14.76 m                   732 veh/h/lane  ships
   96                             one every 18.45 m                   585 veh/h/lane  "a quiet night"
```

against a saturation flow near 1800. **The headlamp pool is untouched at 96** — the two budgets
that block exists to keep apart stay apart, and 96 of 120 lit fills a disc of 170 m against the
190 m simulated, so the pool is shallower and still a pool.

**THE DIURNAL CURVE**, and the finding under it: **nothing in this city has ever read the clock
for population.** `rebalance` normalises its weights by their own sum, so the ring received
EXACTLY `agents.length` people at every hour — a midnight ring of empty outer chunks got the
same crowd as downtown at noon, merely redistributed. `crowdFactor` is a day window (1 from
08:00 to 20:00, `smoothstep` to an 18% floor at 03:30 — a real city's small hours are not empty)
and it delivers:

```
  t = 0.0    midnight   0.549   154 people      three of the four gate routes run here
  t = 0.146  03:30      0.180    50 people      the trough
  t = 0.25   dawn       0.658   184
  t = 0.5    noon       1.000   280 people      highway_speed — the triangle-binding route
  t = 0.78   dusk       1.000   280 people      citycheck, against pedestrians.minTotal 200
```

**IT IS FREE BECAUSE `awake` IS A PREFIX.** `bodies[].indices` is built by walking the agents in
order, so it is ascending, so the awake agents are the first rows of every body mesh and
`InstancedMesh.count` alone draws them — no reordering, no compaction, and no row that changes
occupant between frames. A wake sets `reseated`, so §5.12's carry covers the frame a row comes
back. `poseRelease` restores to the awake prefix rather than the allocation.

**WHERE IT COSTS NOTHING, SAID PLAINLY.** `highway_speed` runs at t = 0.5, where the factor is
exactly 1 — **so the diurnal curve buys NO triangles on the route the ceiling binds on**, and
the base cut is what paid for §§3–5. What the curve buys is the picture at night, and
`s57-iron-midnight` is that picture.

`pedestrianStats().total` now reports the DRAWN population rather than the allocation: a census
saying 280 while 50 people were out would be a gate reading the config (CONTRACT §9.1).

---
## 3. ITEM 1a — FIVE KINDS OF STREET FURNITURE, AT ABOUT THE PRICE OF NOTHING

`postbox` (a pillar box and a wall-mounted one), `cyclestand` (the Sheffield hoop, and a pair),
`charger` (2049's parking meter — a kerbside charging point with its cable on the hook),
`newsbox` (a vending box and a timber stall) and `cafetable` (a table and two chairs — the one
object here that says somebody is USING the street rather than passing through it).

**THE COST IS THE POINT.** `propCount` decides HOW MANY objects a chunk carries and
`PROP_MODELS` decides WHAT THEY ARE, so adding kinds changes the mix and not the population:
the delivered cost is the difference between a new kind's box count and the average of the
palette it joins, which is between −1 and +2 boxes. Five new objects at eye level for about
nothing, which is the cheapest content this project has added.

**THE PALETTE IS WEIGHTED RATHER THAN APPENDED**, because a uniform pick over a longer list
would put one pillar box on every chunk — one every 128 m, where a real city has one every few
hundred. Delivered over 5 × 5 chunks at seed 1337: bollard 265, cabinet 250, bin 248, tree 58,
planter 48, cyclestand 44, bench 38, cafetable 34, charger 32, hydrant 25, newsbox 24,
postbox 23.

**WHAT WAS ALREADY THERE, AND THE BRIEF LISTED IT AS MISSING:** bus shelters with timetables
exist — `BUS_STOP` since session 28, a roof, posts and a glazed back panel *"the timetable is
lit against"*. Planters and varied bollards exist (three bollard variants since session 21).

---
## 4. ITEM 1b — THE IRONWORK IN THE ROAD

*"The carriageway is the largest surface in a street frame and it is uniform."* It is not now.

- **Gullies every 20 m, IN THE CHANNEL** — the gutter line against the kerb face, which is
  where the water goes, so the offset is the carriageway half-width less the casting's own
  half-length rather than a number chosen to look right.
- **Manholes every 34 m on TWO lines** — the crown where a sewer runs and the near-side lane
  where the ducts do, offset half a cycle so the road does not read as a dotted line. 34 is
  coprime with the 6 m centre-line cycle, so no cover lands centred on a dash.

**THEY ARE MARKINGS AND NOT PROPS, WHICH IS THE WHOLE ECONOMY OF THE ITEM.** A marking is a
4 mm box in a mesh the chunk already builds, so a casting costs **12 triangles and no draw
call**, where the same object as a `prop` would carry a registry claim, a setback test and a
scatter slot it would have to win from a bollard. `markings` gained an optional `albedo`/`rough`
— cast iron 0.055 at roughness 0.72, which is **0.67× the asphalt where paint is 7.6× it** — and
a marking with no albedo of its own is still paint, so every line written before this session is
byte-identical.

Delivered over 5 × 5 chunks: **467 gullies and 311 manholes, 9 336 triangles.**

---
## 5. ITEM 1f — THE RIVER GETS WORK ON IT

Quays since session 15, a promenade since 16, three crossings since 56, and nothing has ever
floated on it. `riverCraft` moors barges and launches against both banks: outboard edge a
fender's 1.1 m off the wall face so the channel stays clear; never inside a crossing (tested
with `onBridgeDeck` padded by the craft's own half-length — the same predicate the road clip and
the walkability mask use); on a 240 m berth lattice jittered inside its own cell; 62% of berths
occupied, because a river with every berth full is a dock. A hull is drawn as a box on purpose —
what reads from a quay forty metres up-river is the SHEER — but it sits IN the water, so only
`freeboardM` shows. Delivered: **3 craft in the 1024 m window at seed 1337**, about 18 boxes.

### 5.1 AND IT TOOK FOUR FRAMES TO SEE THEM, WHICH IS WORTH RECORDING

Three frames showed empty water and the pure function reported three craft. The cause was not
the code: **a craft moored against a quay is occluded by that quay's own wall from any camera
standing back on the bank** — the sightline that clears a 1.05 m parapet at 43 m is already
below the barge's deck 3 m further on. It was confirmed from directly above and then framed from
the water side. *A frame that does not show its subject is not evidence that the subject is
absent*, and the cheap check is the nadir.

---
## 6. GATE STATE

`npm run gates`, all eight, 22 minutes. **The machine was QUIET for the first three gates —
load1 1.37, 1.58, 1.57, inside CONTRACT §0.2's bar of 1.6 — and loud for the rest**, which the
suite prints itself: *"4 browser gate(s) started above the quiet bar."* So `parsecheck`,
`faultcheck` and `lookcheck` ran admissibly and nothing after them did.

```
  gate            exit   verdict   seconds  load1 in   out
  parsecheck         0     GREEN       3.4     1.37    1.58    117 files, contract-clean
  faultcheck         0     GREEN       9.7     1.58    1.57
  lookcheck          1       RED      34.2     1.57    2.46    THE IDENTICAL THREE
  windcheck          0     GREEN      36.1     2.46    3.65
  inputcheck         0     GREEN      14.4     3.65    4.64
  gateaudit          1       RED      69.7     4.64    4.22    the carried control
  citycheck          1       RED     116.1     4.22    4.89
  perfcheck          1       RED    1023.0     4.89    4.34

  4 of 8 RED — the same four as sessions 53-56.
```

**`lookcheck`: unmoved.** `distinct:midnight|dusk` reads **0.02840** against session 56's
0.02841 — this session's content did not touch it, which is the right answer for furniture and
castings. The other two are the carried facade pair.

**TWO REDS ARE NEW AND BOTH ARE THIS SESSION'S. Neither was tuned away.**

1. **`120 vehicles, budget says 160`, on all four routes — REPAIRED, and it is a DECLARATION
   rather than a threshold.** `perfcheck` asserts `traffic.vehicles === contentVehicles`: a
   DELIVERED count against a written one, which is CONTRACT §9.1's two-descriptions-of-one-thing
   check. A content change that left the declaration alone would have the gate comparing the new
   city against a stale note. `budget.json` → `contentVehicles` is 120 with its arithmetic
   beside it; `contentHeadlamps` stays 96 because the pool did not change, and no floor or
   ceiling in that file moved. **This one line was changed AFTER the battery and is named here
   for that reason** (STATE 55's rule); `parsecheck` was re-run on it.

2. **`sign(adpillar) × prop(cyclestand)` 0.067 m² — NOT repaired, and the mechanism is
   identified.** The delivered occupancy sweep went from the carried FOUR to FIVE, and the new
   one is a `cyclestand` — one of §3's kinds. **It is not a bad claim: it is a CHUNK SEAM, and
   the same family as the carried `sign(adpillar) × prop(planter)`.** `city.js` places
   advertising pillars after the pure generator and tests each against `placed` — *this chunk's*
   claims — while a neighbouring chunk's kerbside scatter reaches up to `CORRIDOR` = 11.7 m
   across the boundary, exactly as session 55 §6.1 recorded for a bench and a landmark approach.
   The pillar already sweeps the **3 × 3 neighbourhood** for lamps and for bus stops, and the
   comment above that sweep says it exists *because the delivered census found the defect*; the
   prop test is the one that was never widened. **The fix is to give the prop test the same 3 × 3
   sweep the two beside it already have**, and it would close the carried planter instance too.
   Not done here because it changes a baseline four sessions old at the end of a session, which
   is how a repair becomes an unattributable move.

**`citycheck` otherwise:** clumping 0.393 (untouched, as the constraints require); the same two
buried sign quads; 1 004 bare walkable samples, identical to sessions 52-56.

**`perfcheck`:** every millisecond was measured at load1 4.3-4.9 and is not a verdict. The
counts are: **2.30 M triangles**, 401 draws, 336 562 instances, and the vehicle silhouette bars
at 66% and 58% of **59** vehicles (the population fell with the fleet, as it had to). Frame
entropy on `downtown_dense` reads 4.941 against session 56's 4.893 — the same carried straddle,
asserted on one run, and this session's night cut is a mechanism that could move it either way.


---
## 7. WHAT TO DO FIRST NEXT TIME

1. **THE CEILING QUESTION (§0.1).** Re-derive at 2 630 000 by session 37's own formula, or hold
   2 360 000 and pay in content every session. It is the operator's call and it decides how much
   any future session can build. ~60 000 of headroom stands today.
2. **WHAT ITEM 1 STILL HAS IN IT**, in the order a player would notice:
   - **(c) what moves besides cars** — and the brief's premise needs correcting first: `bus` and
     `lorry` are body types in **`traffic.js`**, not `moving.js` (which is trains and cranes),
     and there are already **seven** types (wedge 0.34, pod 0.24, van 0.20, moto 0.12,
     hauler 0.10, lorry 0.06, bus 0.03). So what is missing is not "big vehicles" but
     CYCLISTS, a delivery trike, a street sweeper, a refuse round and emergency vehicles. An
     eighth body type is FREE in count for the same reason §3's furniture is — the fleet size
     is fixed — so an ambulance or a police unit with its own livery and a roof light bar is
     the cheapest of these by a distance. A cyclist is not: it is a new figure mesh.
   - **(d) night vs day** — shutters down, a bar lit when the office beside it is dark. The
     retail frontage roll knows which frontage is trade, and `crowdFactor` now gives the city a
     clock it did not have, so this item got cheaper this session.
   - **(e) vertical public space** — a footbridge over an arterial, an underpass, steps. Session
     56's deck record already carries people at 22.72 m, so the machinery exists.
3. **THE STAIRS between platform and street** (STATE 56 §5.1), including that the stair cores
   block nobody at street level.
4. **CARRIED**: a curved road needs a new ground kind (STATE 56 §8.3); 128 blocks with 2
   distinct lengths; cloudy, costed but not built; the vehicle silhouette bars; clumping;
   the apron staircase's 0.40 ha bare residue.
5. **`decodePNG` RETURNS THREE BYTES PER PIXEL.**
