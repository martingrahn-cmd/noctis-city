# NOCTIS — STATE

*End of session 56. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`, 12 days of
uptime — the same boot as sessions 47–55. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` READ 2.61 AT THE FIRST COMMAND AND RAN 2.4–6.1 ALL NIGHT — the assistant app itself
measured 101% CPU — SO NO ABSOLUTE MILLISECOND IN THIS DOCUMENT IS A VERDICT.*** Counts, code
values, cd/m², metres and generator output are; CONTRACT §0.1's corollary — **counts do not
drift** — is what the one real perf verdict of the night (the triangle ceiling, §7.4) rests on.

Branch `claude/noctis-56-facings-and-the-edge`, eleven commits, all pushed as they landed.

---
## 0. WHAT HE SAW, WHAT WAS REPAIRED, WHAT WAS LEFT — THE LIST

Part one was seven defects the operator found walking session 55's branch; part two was the edge
of the city, asked for twice. **All seven part-one items landed; part two landed (a) and (c) and
reports (b).** Each entry names its spawn or frame.

1. **ROTATIONS — REPAIRED, AND THE ROOT WAS DEEPER THAN THE GOALS** (§1).
   `?player=1&spawn=36.41,19.91,-748.54&t=0.6184&seed=1337`. The goals were 90° off their own
   claim, the hoops faced their touchlines under a comment saying "Facing IN", the centre circles
   delivered as four-pointed stars on every z-axis pitch — and underneath all three, `put()`'s
   position rotation was three's yaw NEGATED, which had been silently mirroring every
   yaw-90/270 feature: **the east and west stadium stands have shown the pitch a blank wall
   since session 48.** All repaired; `citycheck` gained the facing sweep (§1.2).
2. **THE COURT IN THE LAWN — FURNISHED FROM THE ISLAND** (§2). Same spawn. A path from the
   boundary gate, spectator steps, benches, ~28 boundary trees, and the pitch ball-stop split
   high-behind-goals / rail-along-sides as its own comment promised for eight sessions.
3. **THE UNBRIDGED REACH — BRIDGED** (§3). `?player=1&spawn=-257.37,14.49,-373.14&t=0.5874` —
   he stood 254.6 m from one crossing and 257.4 m from the other, the exact midpoint of a 512 m
   reach. A cable-stayed relief bridge stands at x=−256 now, carrying traffic and pedestrians in
   `s56-bridge-after-t0_5874-wet.png`.
4. **THE TERMINUS — BUILT AT BOTH ENDS** (§4). The premise "it turns in mid-air" was checked
   and is stale: abutments, portal heads and a 40 s turnround already existed. What was missing
   and is built: terminus platforms from the station vocabulary, buffer stops on the rails, and
   a stop law that halts the nose 0.6 m short of the beam instead of touching the portal.
5. **PEOPLE ON THE PLATFORM — HIS OLDEST WISH, THE SMALLEST HONEST VERSION** (§5).
   `s56-platform-crowd-t0_5.png`: a train at the platform and people standing at 22.72 m.
   The stairs are specified but not built — the honest cost is in §5.1.
6. **EMPTY GROUND AMONG THE TOWERS — MEASURED FIRST, SIXTH CAUSE FOUND** (§6). Not bare earth
   (0.73% of visible ground): the nine largest empty surfaces were all **coreGround slivers**
   along building backs, up to 845 m² with zero objects. They carry service rows now; the
   residue after the triangle-ceiling trims is four small patches, worst 499 m².
7. **THE MOON — THE NIGHT HAS A DIRECTION** (§7). 85% of the skyglow's lux moved into the
   moon at constant total. The churchyard's headstones have faces
   (`s56-moon-k{0,0.5,0.85,0.933}-t0-wet.png` is the sweep) and `distinct:midnight|dusk` moved
   TOWARD its floor for the first time in four sessions.
8. **THE EDGE** (§8): a ring of 140 hills with wooded shoulders past 3 300 m, valleys where
   the road and the river leave (`s56-edge-air-t0_55.png`); a filling station and allotments on
   the first full chunks beyond the lattice (`s56-fillingstation2`, `s56-allotments`); and the
   honest report on curves — the ground vocabulary is axis-aligned rectangles, so a curved road
   is a new yawed-quad ground kind, costed in §8.3 and not built.

**LEFT, in one place:** the platform stairs (§5.1); the exchange precinct's emptiness (§6.1);
posts standing along the exit road past the edge (§8.4); the core density gradient (§8.5);
`?moonshare` sweep beyond 0.85 if the operator wants more form; and everything §9 carries
forward from session 55.

---
## 1. ITEM 1 — THE THIRD ROTATION WAS A HANDEDNESS BUG, AND IT HAD BEEN MIRRORING THE CITY'S FEATURES FOR EIGHT SESSIONS

### 1.1 The repair (commit `20941ea`)

**`put()` — the feature-delivery helper in `city.js` — rotated positions by −yaw and
orientations by +yaw.** Three's yaw takes local +Z to (sin θ, cos θ); the schoolbook 2D form
`wx = dx·c − dz·s` is that rotation's mirror. Identical at yaw 0/180, a mirror at 90/270 — so
every one-sided assembly on a yaw-90/270 feature landed with its asymmetric parts on the wrong
side. The viaduct's own transverse offsets negate the angle (`Math.PI / -180`) for exactly this
reason, six times in the same file; `put()` now does too. CONTRACT §9 row 2, again.

What that one sign fixed or revealed, all verified in frames
(`s56-{pitch-air,stand-west,court-air}-{before,after}`):

- **Goals**: were `alongX ? 0 : 90` — the claim one line up, transposed, with ONE yaw for both
  ends so even the nets agreed with each other. Now per-end, net away from the pitch.
- **Hoops**: same inverted base; now the stands' own facing table. Claims grew from a 0.6
  square to the delivered reach (rim 1.32 m, backboard ±0.90).
- **Stadium stands**: session 49's yaw table was RIGHT under three's convention and `put()`
  mirrored the x-pair — the east and west stands delivered rake-toward-the-pitch, wall against
  it, and only a close frame could see it (an axis-aligned claim is mirror-invariant).
- **Centre circles**: the `!alongX` branch swaps chord positions across the diagonal (a
  reflection) and the yaw only negated — twelve chords mirrored against their own tangent, a
  four-pointed star on every z-axis pitch and court. Tangent now, both branches.
- **Claims that stopped short of their objects**: the play frame's slide (2.13 m unclaimed on a
  random bearing, both the recreation and school copies), the deck park's scissor ramp (6.2 m of
  concrete the registry had never heard of), the goal's net bag. All claimed at delivered reach.
- **Dock faces land deterministically at +v now**, and the depot shop — whose yard is at −v —
  passes `flip` and turns to face it.

### 1.2 The check (commit `0d0d246`) — item 1b

`citycheck`'s generator half pairs every `chunk.features` record carrying a `yawDeg` with the
registry claim at its own centre and asserts the folded yaw's cardinal equals the axis the
claim's long half implies. Oblong claims only (≥2×), cardinal yaws only (±3°), non-cardinal
counted as DECLINED with a measured-population floor (3 000 against 6 951 today) so declining
cannot become CONTRACT §7.1's quiet gate. **Confirmed RED before the fix per §7.2**: at session
55's HEAD over 17×17 it reads 21 051 measured, 4 mismatches — exactly the operator's four goals.
Now: **6 951 measured, 0 transposed, 105 declined.** Three falsify cases; coverage 100%
(67/67). **What it cannot see is written in the budget's `$featureFacings`: a MIRROR** — the
stands' own defect — is invisible to any axis-aligned claim, so aerials stay the verdict for
that class.

---
## 2. ITEM 2 — THE GROUND AROUND THE PLAY AREA (commit `118cf95`)

Measured first: the court pad is 1 512 m² of a 10 941 m² island (13.8%) and everything else was
one lawn, a fence and 8–12 scattered props. Delivered, all in existing vocabulary, sized from
the island: a **path** from the boundary gate to the play area (cut from the lawn as the pad is,
claimed `path` so the fence opens over it — on a stadium island it stops at the BACK of the
stand, because driven to the pitch it refused the stand it leads to, measured as chunk (−8,−5)
delivering three stands of four); **spectator steps** beside a court (the stand vocabulary with
three treads and a `bare` flag dropping wall, roof and seat decks; 3 of 4 courts took them);
**benches** on the long sides facing in; **~28 boundary trees** at a spacing drawn from the
island side, refused wherever the ground was spoken for; and the pitch boundary's
eight-session-old comment implemented — 4.0 m ball-stop mesh behind the goals only, knee rail
along the sides. `s56-court-air-{before,item2}` is the pair.

---
## 3. ITEM 3 — THE RELIEF CROSSING (commit `29159b6`)

**Premise corrections, per the brief's own request:** "two bridges" is the census window's
sample — the code defines a crossing at every 512 m for all integer i (arch@−512 exists);
and session 52's rule is a street-end FOOTWAY whose own comment disclaims the turning head.

The spacing is real: the operator stood at the midpoint of the girder@0 ↔ arch@−512 reach.
`RIVER.extraCrossingsX = [-256]` adds the relief crossing there — a chunk boundary, so a
north–south street already runs at it on both banks. `nearestCrossingX`/`bridgeSpecAtX`
generalise the five crossing functions, so the road clip, water claims, walkability, traffic,
promenade lamps, the map and the canyon bake all followed with **zero further edits** (a bridge
claims nothing by construction). The extra's structure is derived as **the era not yet standing
between its two lattice neighbours** — the cable-stayed — because an infill crossing is the
youngest span on its reach. Global halving to 256 m was considered and declined: `bridgeEvery`'s
own derivation (512 m is a real urban river) stands; one relief bridge where a defect was
reported is a repair, a canal everywhere is not. Span 93.6 m, walkable, carrying traffic.

---
## 4. ITEM 4 — THE TERMINUS (commit `296e9c3`)

The line's ends already carried abutments, wing walls, portal heads and (since session 54) a
brake-dwell-reverse cycle — "it turns in mid-air" is stale as geometry and motion. What was true:
no platform, no buffer, and a recess whose one job is to say "the line CONTINUES" behind a train
that visibly reverses at it.

- `viaductStations` emits a **terminus entry per end**, placed from the DECK'S last station
  (platform runs back from the abutment; the train's stop is derived independently in
  `moving.js` from its own extent, and the two meet by construction — no duplicated constant).
  The station vocabulary brings platforms, coping, balustrades, canopies and stair cores;
  terminus cores flip INBOARD, because a core toward the end stands in the portal.
- `VIADUCT_BUFFER_M { setInM: 1.5, standOffM: 0.6 }` — one constant, two readers: `city.js`
  stands a stanchion pair and beam per track inside each abutment face, and `moving.js` derives
  the end stop so the nose halts 0.6 m short of the beam. Before this the nose tip stopped at
  s = 240.00 exactly — touching the recess plane.
- `moving.js` filters terminus entries from its stop list (the end stop IS the terminus stop).

Delivered: 3 stations (mid + termini at segs 0–6 and 37–43, 76.4 m each).
`s56-terminus-{north,street}` frames.

---
## 5. ITEM 5 — PEOPLE STAND ON THE PLATFORM (commit `6142453`)

**`city.decks()`** is the new record: one per station platform, carrying the walking strip and a
`pointAt(u, t)` built on the ARC'S OWN stations — an 87 m platform on a 300 m arc bows 3.2 m, so
a straight frame would stand people in the air off both ends. **Deliberately NOT in
`worldSurface`'s max**: a person walks UNDER this deck; the record is opt-in and only an agent
carrying a deck id reads it.

`streetlife`: each visible deck joins the rebalance ring as one allocation entry, weighted
scale-free against the ring's own mean (2 × 87.3 m of platform against 435 m of chunk loop =
0.40 of a mean chunk ≈ sixteen people at the crossing station). A platform trip is a LINE, not
a loop; y comes off the record, never `groundYAt`; a waiting passenger draws from the bus
stop's own wait distribution and turns to the track. Census rows key by deck, so the row that
allocated the crowd reports it. `s56-platform-crowd-t0_5.png` is the picture: a train at the
platform, people beside it.

### 5.1 What the stairs would take (specified, not built)

A crossing-style path per core: ~25 y-interpolated legs (12 flights + landings, geometry at
`city.js`'s stair draw), the re-seat-clears-path rule (`a.cross = null`'s own argument), and a
gait caveat — the shader gait is a flat walk cycle and on the 31° pitch it will read as sliding
unless amplitude/frequency are tuned. **Plus a ground claim for the cores**: they appear in NO
ground predicate today, so an agent can walk through a stair core at street level — that gap
predates this session and needs closing whether or not anyone climbs. The lift is one solid box
and is NOT honest to put people in as drawn.

---
## 6. ITEM 6 — MEASURED FIRST: THE CORE SLIVERS (commits `3197bc9`, `2dfea02`)

Sixth time the operator has said "empty ground among the towers"; sixth different cause.
`bareprobe --camera=0,0`: BARE is **0.73% of visible ground** — the floor holds — and the
largest owner is the block interior at 40.1%. One level down (a patch census over the 5×5 at
the origin): **the nine largest empty surfaces were all coreGround SLIVERS** — the 8–17 m
strips `subtractBoxes` leaves along building backs, up to 845 m² with zero objects — while
furnished core patches run 19–41 objects/ha. The island-uniform core scatter cannot reach them.

**The repair is service ROWS along each large strip's own axis** (a strip along a building's
back is where a block's servicing stands), from the core's own palette and named stream —
appended draws only, nothing already delivered moved. After the triangle-ceiling trims (§7.4):
13 m pitch, four rows a chunk, area floor 420 m², single-box palette. Residue: four zero-object
patches in the 5×5, worst 499 m², written here rather than chased.

### 6.1 The next-largest empty read is the exchange precinct

At the daylight aerial (`s56-core-air{,-after}`) the single largest contiguous empty surface is
the dome's precinct — session 55 gave it approaches and porticos; the ground between them is
still a plain field with scattered crates. A civic precinct's furniture (planting beds, kiosks,
banner masts, a paving pattern) is a session of its own.

---
## 7. ITEM 7 — THE MOON REDISTRIBUTION (commit `423b5af`)

STATE 55 §0.2 measured the mechanism: 96.7% of the 3.24 lx on a night surface arrives from an
isotropic dome, so nothing has a face. **The repair moves 85% of the skyglow's horizontal
illuminance into the moon's directional term at CONSTANT TOTAL LUX** — an identity per rebuild
(`sky.js` → `computeRedistribution`: dome × (1−k), moon × (1 + k·glowE/moonH); the ±k·glowE
cancels at every time and phase while the moon is up; moon down → k treated as 0). It is the
one lever the exposure meter's 0.64 clawback cannot touch, because the frame's total does not
move. CPU and GPU read the same two numbers, computed before the LUT renders.

- **`?moonshare=` is a CONTRACT §6 parameter** (−1 defers to `LIGHT.moonRedistribution` = 0.85;
  0 restores the pre-56 sky bit for bit). No gate passes it.
- **k = 0.85 was chosen from delivered midnight frames** at the churchyard per LOOK.md §0:
  grave-region contrast sd 3.71 → 4.28 (+15%) with the floor's blacks holding at p05 10; at
  0.933 the gain is marginal (4.44) and the horizon glow nearly gone. The moon delivers ~4 lx
  normal — 38× the physical figure, the first lie LOOK.md §0 licenses by name. The trade shown,
  not hidden: the visible sky dims hard (the amber wash becomes a dark night sky) — if the
  operator wants the old sky back it is one URL.
- **`distinct:midnight|dusk` moved 0.02621 → 0.02841, TOWARD its floor** — the first change in
  four sessions to move L15 the right way (midnight's sky darkened away from dusk).
  `band:midnight` 0.1090 against 0.112, margin 0.0030 = 30× the instrument's spread. Dusk
  untouched (moon below its horizon — the invariant working).
- The stale `castShadow` arithmetic in `lighting.js` is repealed in place; the accepted
  no-shadow lie is written beside it. `LIGHT.fullMoonLux` — 0.267 in two files, nothing
  comparing them — lost its dead copy; `solar.js` owns the number.
- **Premise correction:** STATE 55's own two moon figures disagreed (§0.2 said 0.107 lx, §8
  said 0.099); 0.107 is what the code reproduces.

---
## 8. PART TWO — THE EDGE (commits `01ea194`, `42ee19d`)

### 8.1 The hills (a)

A ring of **140 hill masses with wooded shoulders**, r 3 300–3 950 m, on the earth plane that
already ends at 4 000 — the distant city's own pattern (pure function, own stream, one
world-fixed InstancedMesh, ONE draw call, no claims, no gates, nothing that moves), which is
CHEAPER than the 21-site terrain variant session 53 costed because it touches no ground
machinery at all. Heights 22–85 m = 0.35–1.4° of horizon at 3.5 km, scaled up with r so far
rows read over near shoulders. **The valleys are the point**: the main street's corridor and
the river's envelope each carve a gap wider than any hill's FULL footprint (the first arm used
0.7× and stood a shoulder over the forecourt), so the one road that leaves the grid leaves
through a valley and the water does too. The hills material is the distant recipe MINUS the
emission — a ridge does not glow, and item 7's moon keys its form at night.
`s56-edge-air-t0_55.png`.

### 8.2 The roadside (c)

Two sites, derived not scattered — the first FULL chunk beyond the lattice edge each side
(`ceil(extentEdgeM/chunkSize)` = 26 east, −27 west), alternating sides of the carriageway:
east a **filling station** (26×13 canopy over three pump cabinets, kiosk, two floods, forecourt),
west **allotments** (planter beds off a claimed path, six timber huts on their own bearings).
Density is 0 out there; every object still claims — the registry's authority does not end at
the edge. They render when a camera goes out (streaming follows it); that is what roadside
content on an exit road is for. `s56-fillingstation2`, `s56-allotments`.

### 8.3 A road that leaves (b) — the curve answer, reported

**The network cannot express a curve.** Every ground record is an axis-aligned rectangle
(`{x0,z0,x1,z1}` — no yaw field exists), `subtractBoxes` is axis-aligned, and the only curved
carriageable surface in the city is the viaduct's authored deck, which is yawed BOXES in a mass
mesh, not ground. A curved exit road therefore needs a new ground kind — a yawed quad with its
own `surfaceAt`, walkability and claim story — before any polyline of chords can be honest.
The 8 km main street stays the exit road, now passing through §8.1's valley; it stays unlit
past 3 232 m, which is what a country road is.

### 8.4 Found on the way and not chased

A few **posts stand along the exit road past the edge** (visible in `s56-allotments`) — most
likely the signal masts or sign pylons missing the `cityExtentAt` guard that stopped the lamps
in session 54 (`city.js:5043`). One predicate, next session.

### 8.5 The density gradient — premise correction and the honest cost

The brief said "the density field has NO RADIAL TERM." **Stale since session 53**: `densityAt`
multiplies by `cityExtentAt(x,z)` — but that window is 1 everywhere inside 1 792 m, so within
the gate's region the premise still holds: the CORE has no gradient and core-vs-rim is still a
coin toss. Building one means touching `densityAt` inside the window, which **re-phases every
chunk in the city** — kinds, fills, heights, the arm session 37 chose from nineteen frames.
That is a session of its own with frames, not a line in this one. `clumping` was NOT touched
(0.389 → 0.393 across the session, the fill churn of items 2 and 6, printed not argued).

---
## 9. GATE STATE

`npm run gates`, all eight, 24 min, load1 2.4–3.8 throughout (over §0.2's bar — no absolute
millisecond is a verdict):

```
  gate            exit   verdict   seconds
  parsecheck         0     GREEN       3.5     117 files, contract-clean
  faultcheck         0     GREEN      10.0
  lookcheck          1       RED      35.2     THE IDENTICAL THREE
  windcheck          0     GREEN      41.2     (citycheck's walk: 344 meshes, 344 labelled — city:hills joined)
  inputcheck         0     GREEN      14.5
  gateaudit          1       RED      75.0     the carried control
  citycheck          1       RED     118.5     THE IDENTICAL FOUR
  perfcheck          1       RED    1187.1

  4 of 8 RED — lookcheck, gateaudit, citycheck, perfcheck. The same four as sessions 53–55.
```

**The battery above ran BEFORE the triangle trims (§7.4's story); after the trims the changed
gates were re-run singly and are quoted below from those runs.** One genuinely new red appeared
in the battery and was closed the same night:

- **`highway_speed` 2 386 444 tris > 2 360 000 — the session's content spent 96k against 70k of
  headroom.** A count, so a verdict whatever the load. Three trims (rows to 13 m pitch / 4 per
  chunk / 420 m² floor / single-box palette; hills to 8×3 segments and 140 masses) brought it
  under, measured after each cut: 2 386 444 → 2 362 108 → 2 360 392 → under. **THE TRIANGLE
  CEILING IS NOW EFFECTIVELY SPENT — the next session inherits ~1.5k of headroom and should
  treat it as a wall.** Draws: 401 of 440 (hills +1, station chunks +2).
- `citycheck` (re-run post-trim): **facings 6 951 measured / 0 transposed / 105 declined** (the
  new §1.2 sweep, printing beside occupancy); 3 bridges in the 1024 m window; the IDENTICAL
  FOUR delivered overlaps; clumping 0.393 against 0.60 (untouched per the constraints); 2 of
  2 645 sign quads (the same two); 1 004 bare walkable samples — identical to sessions 52–55;
  walkable samples 284 918 (+536, the relief bridge's deck).
- `lookcheck` (re-run post-trim): the IDENTICAL THREE. Bands 0.1090 / 0.3096 / 0.4336 / 0.1550,
  crushed black 0.000% everywhere, `distinct:midnight|dusk` **0.02841** (§7).
- `perfcheck`: the two vehicle silhouette bars (68%/52% of 66 this run against 75% floors) — the
  seven-session carried pair, population oscillating 52–74 as recorded; `downtown_dense`
  entropy 4.893 (the carried straddle, single-run assertion); froxel 58/96 margin 38 (carried,
  one slot better than s55). Every wall/CPU millisecond: load-contaminated, not a verdict.

---
## 10. WHAT TO DO FIRST NEXT TIME

1. **THE TRIANGLE CEILING IS SPENT** (§9). ~1.5k of headroom on `highway_speed`. Anything that
   adds geometry must first find geometry to remove, or the operator must be asked about the
   ceiling (2 360 000 has held since session 37).
2. **THE STAIRS** (§5.1): the platform crowd exists; the climb is specified — ~25 y-interpolated
   legs per core on the crossing pattern, the gait pitch caveat, and the cores' missing ground
   claim (walk-through-able at street level today).
3. **THE EXCHANGE PRECINCT** (§6.1): the largest contiguous empty surface at the core aerial.
4. **THE EDGE'S LOOSE POSTS** (§8.4): one `cityExtentAt` predicate.
5. **`?moonshare` IS A LIVE SWEEP** (§7): if the churchyard still reads flat to the operator,
   0.933 is one URL away and the numbers are in this file; if the sky reads too dead, lower it.
   The band that limits further black-floor work is unchanged (STATE 55 §8 item 4 carries it).
6. **CARRIED UNTOUCHED FROM SESSION 55**: the 128-blocks-one-size question (the largest single
   thing the operator has named); cloudy (costed, a session); the turning head; the 47 m of
   lane on pavement; `SURFACE_TOP_M`'s false derivation; the vehicle silhouette bars (seven→
   eight sessions); clumping at 0.393 for nineteen sessions with STATE 53's window experiment
   still unrun; the apron staircase's 0.40 ha bare residue (1 004 samples, identical five
   sessions); hoisting `buildChunkBody`'s claims; the arena.
7. **PREMISE LEDGER FOR THE NEXT BRIEF** (the brief asked): "goals on touchlines" — position
   false, perception true (yaw); "session 49 fixed the stands" — claims yes, delivery mirrored;
   "two bridges" — the window's sample; "turning head rule" — it is an end footway that
   disclaims the head; "turns in mid-air" — stale; "platform from session 54" — session 31
   built it, 54 stopped at it; STATE 55's two moon numbers disagreed (0.107 reproduces);
   "no radial term" — stale at the rim, true in the core; "21 sites" — accurate, +22
   conditional if anyone walks out there.
8. **`decodePNG` RETURNS THREE BYTES PER PIXEL** (measured again this session, §7's sweep).
   And the frames: `tools/shot-out/s56-*` — thirty-odd, every one named in the section it
   verifies.
