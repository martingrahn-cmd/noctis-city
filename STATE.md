# NOCTIS — STATE

*End of session 73. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`, 15 d 16 h of
uptime — the same boot as sessions 47–72. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` RAN 2.15–5.69 THROUGH THIS SESSION***, over CONTRACT §0.2's bar of 1.6 for the
thirteenth session running. **No millisecond below is a verdict.**

Branch `claude/noctis-73-walk-and-fix`, off session 72's head.

**A WALK-AND-FIX.** Twenty-two frames, three worlds, written down before they were shot and read in
plain words before any probe was opened.

---
## 0. WHAT THE WORLD LOOKS LIKE TO SOMEONE DRIVING THROUGH IT

This is item 1b, and it is the whole reason the session exists. No numbers.

### The city by day
- **`condenser-street` is seventy per cent a blank cream curve.** No windows, no panels, no scale,
  no way to tell what the object is. A sliver of street on the right is the only part that reads.
- **`exchange-street` is a smooth brown dome with nothing on it**, over a very large empty wet plaza
  with two lamps and a tree on it.
- **`dish-street` is a smooth white cone with nothing on it**, hard-edged against the sky.
- `viaduct-street` reads as a proper city street — buildings, markings, vehicles, people. A good
  frame. The viaduct itself reads as a footbridge.
- **A white van fills the middle of `viaduct-side` and it has a face**: a featureless box with two
  dark slots where a windscreen should be.
- **`viaduct-side` and `viaduct-piers` each have a large grey angular object at the lens that I
  cannot identify.**
- Pedestrians stand in evenly spaced rows on the pavement and read as flat dark slabs.
- `weir-street` does not show the weir and `stack-street` does not show a stack.

### The countryside and the road out
- **The exit road is a flat brown expanse with no edges**, and the verges are flat green with a hard
  straight line where they meet it — a carpet laid either side.
- **Trees beside it are black cubes**, and one is a stack of cubes.
- `country-air` is smooth and empty: soft brown and olive patches, hedgerows as dotted lines of
  specks, a hill that is a smooth dome.

### The river
- **The promenade is a blank pale slab with nothing on it at all** — no benches, no railings, no
  bollards, nobody. One lamp. The water reads well.

### The estuary and the harbour
- The harbour reads as a working port; session 71's and 72's frames stand up.
- **A grey rectangle floats in the sky** in `sea-harbour`, above and left of the cranes.
- The land either side of the estuary is enormous and bare.

### After dark
- **`viaduct-street` at midnight is the best frame in the round.** Lit windows, neon in three
  colours, lamp pools, a wet road carrying all of it.
- **`country-car` at midnight is a black void.** A farmstead with two small lights, a hill
  silhouette, a tree blob. The road itself is invisible: no studs, no markings that carry, no
  lighting of any kind.
- **`country-air` at midnight is almost entirely black.** The hillside villas are not visible.
- `sea-road` at midnight works — the gate canopy and the crane lights carry it.

### THE RANK — item 1d, loudest first, by how much of the frame it spoils and how often it recurs
```
  1  THE LANDMARKS ARE UNTEXTURED PRIMITIVES      3 of 8, each dominating its own frame   FIXED
  2  THE COUNTRYSIDE IS BLACK AT NIGHT            2 of 4 night frames, LOOK.md §0's own subject
                                                  the VILLAS are fixed; the ROAD is not
  3  TREES ARE SINGLE CUBES                       every frame with vegetation             NOT FIXED
  4  VEHICLES HAVE NO BACK                        most city frames                        NOT FIXED
  5  A GREY RECTANGLE FLOATS IN THE SKY           most outdoor frames                     FIXED
  6  LARGE BARE SURFACES WITH NOTHING ON THEM     5 frames                                NOT FIXED
  7  POSES THAT DO NOT SHOW THEIR SUBJECT         2, and a third that was LYING           NAMED
```

---
## 1. THE THREE FIXES, EACH WITH A PAIR

### 1a. THE LANDMARKS HAD NO SURFACE

A lathe carrying one flat material has no surface information at all, and a 260 m one fills the
frame with it. All three are boxes on a circle, which is a trick the condenser's own crown was
already using one ring up:

```
  condenser   36 meridian ribs in eight lifts, an INLET COLONNADE of 36 raking legs — the bottom
              eight metres of a natural-draught tower is open and it is the feature that says the
              thing breathes — a throat ring and a lip ring.
  exchange    20 meridian ribs, a cornice at the springing, a plinth, pilasters on the drum with a
              tall opening every other bay, and a lantern. The openings are what give it SCALE.
  dish        44 ribs on the RAKE rather than vertical, a lip, and a glazed slot round the foot.
```

Its own comment says *"a civic hall with no windows at all, which is the whole of its character"* —
a good decision that was never carried out, because **no windows is not the same as no surface**.

### 1b. THE VILLAS ARE LIT, AND THE POSE WAS LYING ABOUT THEM

STATE has carried *"the hillside villas are dark"* as a deferred item for five sessions, on session
68's finding that the emissive ring gate excludes them. **Session 71 found the route without looking
for it and this is the second thing it buys.** `city:bowls` is built inside `if (near)` — ring ≤ 2,
which is the gate they were written off against — while `city:signs` merges over EVERY resident
chunk at ring ≤ 5, on a material with a per-instance emissive. `glow()` was already in the feature
loop.

The glazed elevation lights, in tungsten, warm against the city's cold. **15 of 22 houses**, chosen
off the house's own position so it draws no stream.

**AND `country-air` COULD NOT HAVE SHOWN IT EITHER WAY.** It stands 710 m from the cluster and looks
at the BACKS of the houses, whose whole design is *"a wall of glass on the view side and blunt
masonry everywhere else"*. It reads as black whether they are lit or not. `villa-city` is new — the
city side at 380 m, anchored on the same centroid `country-air` is — and the pair at that pose is
a black hill before and five lit windows after.

### 1c. THE ROTOR WAS A SQUARE

`AIRFRAMES.heli` box 2 was `13.4 × 0.09 × 13.4` — a 13.4 m square plate — under a comment that
argues correctly that a turning rotor is a disc. The argument is right and the shape it built is
wrong. Chord 13.4 → 2.4 m, and darker than the airframe because a turning disc is most of the way to
the sky behind it. Diameter untouched.

**Its evidence is weaker than the other two and that is said rather than hidden:** STATE 69 records
the aircraft as the one mesh that moves with the frame count, so the plate being absent from the
after frame could be the plate having moved. What is not in doubt is the table.

---
## 2. WHAT WAS NOT FIXED, AND WHY — items 3, 4 and 6 of the rank

**TREES ARE CUBES, AND SESSION 22 ALREADY FIXED THAT.** The city's `tree` prop is three overlapping
tilted masses at three heights with a 1.24 m spread over a 5.3 m tree, and its comment is two
paragraphs on why a stack of prisms is not a crown. **So the cubes in the round are a different
tree** — the countryside's, beside the exit road, and they were not identified before the box ran
out. Naming the wrong object and fixing it would have been worse than deferring.

**VEHICLES HAVE NO BACK.** The van in `viaduct-side` is the REAR of a van: a blank white face with a
dark skirt, two wheels, and two small dark rectangles at the top that read as eyes at any distance.
No doors, no plate, no handle, no bumper. Rear lights exist — `traffic.js` has a `rear:` table — but
they are dark in daylight and they are all there is. **Not fixed because the body is a LOFT**: a
stepped sweep of one shared chamfered section, one instance row per longitudinal station, built that
way in session 7c precisely because five lofted meshes would have been five draw calls. A number
plate is not a scaled section, so this is a design change and not a forty-minute one.

**THE BARE SURFACES ARE SESSION 72's SCATTER.** The promenade, the exchange plaza, the mast parapet
and the exit road's verges are the same defect: session 72 measured 1.2 % of luminance range across
a whole foreground and established that terrain per-vertex colour cannot carry a feature finer than
64 m. An instanced scatter is the only arm left and it is a session, not an item.

---
## 3. THE POSES THAT DO NOT SHOW THEIR SUBJECT — item 1c

```
  weir-street     shows a brick street and no weir
  stack-street    shows a blank cream wall and no stack
  country-air     shows the BACKS of the villas at 710 m and reports them as dark
```

The third is the one worth carrying: **it was not a pose that showed nothing, it was a pose that
answered wrongly**, and five sessions of STATE repeated its answer. `viaduct-under` is the same
class and was named in session 71. That is three of nineteen committed poses.

---
## 4. CONTRACT §9.2 — A CITY DEFAULT TRAVELS UNQUESTIONED

Item 4a, written before the round was shot. Three instances, each found by eye and none by a gate,
and nobody had noticed it was the third: `block:ground`'s (0,0) porosity carried from under a city
into every field in the world; 42 promenade lamp stations standing in the sea; and session 72's
branch road at `kind: 'road'` falling through to a full mirror on a rural spur off a road session 65
had already measured at 0.70.

**It survives for a reason §9.1's variants do not:** the default is CORRECT at the place it was
written, so every reader near the origin confirms it — and `citycheck`'s region is one 10 × 10
square about the origin, so the whole class lives outside the only gate that could see it. The
section proposes no gate and says why.

**Item 4b's fourth was looked for and not found on this round.** Nothing else in the twenty-two
frames pointed at a city value carried past `CITY.extentEdgeM`. That is a null and it is reported
as one.

---
## 5. THE COST, AND IT MOVED FOR THE FIRST TIME SINCE SESSION 67

```
  highway_speed   404 draws of 440        was 401 for six sessions      +3
                  2 466 960 tris          was 2 451 648                 +15 312
```

**+3 draws is one box mesh per landmark and it is not avoidable.** The exchange and the dish had no
boxes at all before — only a lathe — so `landmark:exchange` and `landmark:dish` did not exist as
instanced meshes, and the condenser's own boxes were all steel. Ribs are boxes and boxes need a mesh.

**AND THE FIRST ARM COST +12 RATHER THAN +3.** `push` owns each box by its own position, so a rib
ring at a 62 m radius spilled across four chunks and three chunks that had held no landmark box
acquired one — 413 draws. `lathe` twenty lines up already states the rule: *"a lathe is one mesh, so
it cannot be split between chunks: the chunk holding its axis owns it."* A rib IS the lathe it sits
on. `pushCore` skips the per-box test and the caller checks the axis once. 413 → 404.

+15 312 triangles is 8.6 % of the 178 352 the brief granted, for three landmarks that each filled the
frame named after them with nothing at all.

---
## 5b. AND A GATE CAUGHT THE SESSION, FOR THE SECOND TIME IN THREE

**The first battery came back with a FIFTH RED — `windcheck`, green since session 53.**

```
  landmark:exchange   1152 tris  242 inst  shell open  nrmAgree derived  facing —  UNMEASURED
  ✗ coverage: 1 cull-eligible mesh(es) decided by no test — landmark:exchange
```

`lathe` names its mesh `landmark:<name>` with an empty suffix and `addInstanced` named the BOX mesh
the same. **Until this session no landmark had both a lathe and a plain box** — the condenser's crown
is steel and goes to `:steel` — so the collision was unreachable. The ribs gave the dome, the cone
and the hyperboloid all three at once, and `windingCensus` keys by MESH NAME: the two rows merged
into one carrying the lathe's `noctisNormalsDerived`, which suppresses the normal test, and the
boxes' instance count, which made the facing test decline. **Nothing decided it.**

That is the rule working. `windcheck`'s own sentence — *"a census that declines is §7.1's quiet gate
wearing a census"* — names this exact failure, and a mesh no test decides is what it exists to catch.
`landmark:<name>:mass` for the boxes; `budget.json` → `requiredMeshes` matches `^landmark:` as a
prefix, and `citycheck` is byte-identical after the rename.

**Session 71's flood-mast heads went 5 → 12 forbidden overlaps while every frame looked fine.
Session 73's mesh name went unmeasured while every frame looked fine.** Two sessions in three where
the gate caught the session rather than the world, and in both cases no frame could have.

---
## 6. GATE STATE

**ALL EIGHT RAN. `perfcheck` COMPLETED THE WHOLE BATTERY FOR THE EIGHTH SESSION RUNNING.** The
battery below is the SECOND of two: the first is what caught §5b's fifth red, and this one ran on
what ships.

```
  gate            exit   verdict   seconds  load1 in     out
  parsecheck         0     GREEN       4.0      4.72    4.90
  faultcheck         0     GREEN      28.9      4.90    4.66
  lookcheck          1       RED      50.9      4.66    4.53    THE IDENTICAL THREE
  windcheck          0     GREEN      41.0      4.53    4.76    RED IN THE FIRST BATTERY
  inputcheck         0     GREEN      17.4      4.76    4.80
  gateaudit          1       RED      78.8      4.80    4.42    the carried `control failed`
  citycheck          1       RED     126.9      4.42    5.69    IDENTICAL TO SESSIONS 57-72
  perfcheck          1       RED    1100.0      5.69    2.99

  4 of 8 RED — the same four as sessions 53-72, after §5b.
```

**`citycheck` IS BYTE-IDENTICAL TO SESSIONS 57–72 ON EVERY COUNT**, which is worth saying because
this session put 1 276 new boxes on three landmarks INSIDE its 10 × 10 region: clumping CV **0.393**,
**5** delivered forbidden overlaps, **2 of 2 647** signs inside a building, **1 004 of 284 918** bare
walkable samples, occupancy **18 799 / 19 087**. A landmark's own geometry is not a claim and the
ribs did not make it one.

`lookcheck`'s three are `distinct:midnight|dusk` at **0.02846**, `facadeAlbedo` and
`facadeNeighbours` — the same three at the same numbers as sessions 53–72.

**EVERY `perfcheck` VIOLATION IS CARRIED OR IS A TIMING ABSOLUTE FROM A LOADED MACHINE**, at `load1`
**5.69** against CONTRACT §0.2's bar of 1.6. The non-timing ones:

```
  night_rain      frame entropy  4.859   per run 4.856 / 4.876 / 4.859   floor 5
  highway_speed   dark gap at the ground   69% of 64 vehicles   floor 75%
  highway_speed   non-monotone tone        58% of 64 vehicles   floor 75%
```

The silhouette bars have now read 75/52 over 71 vehicles, 70/58 over 64, 71/54 over 59 and 69/58 over
64 across sessions 70–73 with nothing in the routes changed — the sampling population
`silhouettes.$estimator` describes. **And they are §0's own list item 4: those two bars are measuring
the vehicles this round's plain words call featureless.**

---
## 7. WHAT TO DO FIRST NEXT TIME

**1. THE COUNTRYSIDE ROAD IS STILL BLACK.** The villas are lit; the road is not. `country-car` at
midnight has no studs, no reflective markings, no lighting of any kind — LOOK.md §0's *"it is no fun
when you cannot see anything"* on the main road out of the city. The `glow()` route reaches ring ≤ 5
and the exit road is drawn by `block.js`, which does not have it — that is the one piece of
plumbing between here and a lit road.

**2. VEHICLES HAVE NO BACK — §2.** The loft is why it was deferred, not whether it is worth doing.
You see rears constantly.

**3. THE NEAR-FIELD SCATTER — §2, and session 72 named it first.** It is the answer to five separate
observations in this round's plain-words list.

**4. FIND THE COUNTRYSIDE'S TREE.** The round says cubes and session 22's city tree is not one.

**5. THE THREE STANDING ITEMS, ALL UNTOUCHED.** `perfcheck` captures with no `settle()`; its entropy
floor is a §0.1 case in the open; the four `trade-*` look frames differ run to run by 3.1–8.1 MB,
entirely in the vehicles.
