# NOCTIS — STATE

*End of session 71. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`, 15 d 12 h of
uptime — the same boot as sessions 47–70. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` RAN 3.99–5.15 THROUGH THIS SESSION***, over CONTRACT §0.2's bar of 1.6 for the eleventh
session running. **No millisecond below is a verdict.** This was a build session and it spent its
time rendering frames, which is exactly what §0.2's own note says puts this machine outside the bar.

Branch `claude/noctis-71-harbour-becomes-a-place`, off session 70's head.

**THIS SESSION SHIPPED CONTENT.** The operator's instruction was *"BUILD MORE, MEASURE LESS"*, and
the verdict below is a frame.

---
## 0. THE CRANE LINE FROM THE WATER, WHICH IS THE QUESTION

**The operator, looking at the quay before this session: *"two posts and a beam."*** Session 66 built
its container gantries as eleven boxes — four legs, a portal beam, one solid bar for a boom and a
mast — and the frame agrees with him: three pale portals in a row on a bare plate. A football goal.

`node tools/lookat.mjs --preset=harbour-air,sea-harbour,sea-road --t=0.42` is the verdict.
**`harbour-air` is new**: 180 m over the berth, anchored on `harbourSite` so it moves if the quay
moves. `sea-air` is 180 m over the MOUTH and shows the terminal off the edge of frame — they are not
the same picture, and the brief's *"aerial over the harbour"* meant this one.

What the frame shows now, and every line of it is a thing that was not there:

```
  three gantries, none of them the same machine   crane 0 works, its trolley RUNNING its boom
                                                  crane 1 stands with its boom RAISED to 62 deg
                                                  crane 2 is out of service, platform and picker
  a portal with 16 m of headroom under it         lorries pass beneath it, and do
  a boom that is a TRUSS and not a bar            two chords, nine posts, a tip
  a back-reach over the yard                      so the machine is asymmetric, not a gate
  a machinery house, an A-frame, stays, a cab     and a stair up one landward leg
  876 containers in 10 blocks, 5 x 2, with lanes  heights varied, one block in four part-worked
  16 stations of quay: BOTH CRANE RAILS,          bollards with heads, fenders over the face,
    a kerb, pallets, drums, a dockers' hut        so a gantry stands on something
  four transit sheds and a gatehouse              flanking the branch road's own approach
  A COASTER UNDER WAY THROUGH THE MOUTH           with a bow wave and a wake
```

**AND THE STEEL WENT DARK, which is half of why it reads.** Session 66's legs were
`[0.30, 0.31, 0.33]`. At this exposure a mid grey against a lit sky goes white and the crane
dissolves into the horizon — which is what the before-frame shows. A gantry is recognised as a **dark
shape with one bright horizontal in it**, so the structure is `[0.105, 0.115, 0.135]` now and the
boom keeps its safety yellow.

---
## 1. WHAT IT COST, WHICH IS THE ONE NUMBER THAT MATTERED

```
  DRAW CALLS      401 of 440 on `highway_speed`, IDENTICAL TO SESSIONS 67-70.
                  Zero new. Every box is a `put()` into the chunk's own `:masses`
                  InstancedMesh; every mover is a part in `river:moving`, which already
                  existed. No new mesh, no new material, no new program.
  TRIANGLES       2 451 648 on `highway_speed`, identical to sessions 67-70 — the whole
                  harbour is 3.9 km from the origin and off every route that binds.
                  About 13 900 added where it stands, 7.8 % of the 178 352 of headroom.
```

**AND THE ROUTE COUNT DID MOVE ONCE, BY 576 TRIANGLES, WHICH IS §3e.** The first battery read
2 452 224. That was the lamp head this session put on every flood mast in the city, and it is the
only thing in this session that reached the routes at all.


Where they went, counted from the generator's own arithmetic:

```
                          boxes before   boxes after      triangles
  the three gantries        11 each        92, 97, 97     132 ->  3 432
  the container yard          384             876       4 608 -> 10 512
  16 quay stations              0             252           0 ->  3 024
  four transit sheds            0             128           0 ->  1 536
  one gatehouse                 0              12           0 ->    144
  the movers                   17 inst          40         204 ->    480
```

**Premise (i) held with room to spare** — a gantry with legs, boom, back-reach and machinery house
fits into 178 352 triangles about thirteen times over. **Premise (ii) held** — the yard grew 2.3× at
zero draws, by the same `put()` route session 68 used.

---
## 2. PREMISE (iii) IS FALSE, AND IT MADE ITEM 3 CHEAPER RATHER THAN DEARER

> *"Session 57's barges already move on the river. If that mover reaches the estuary, one hull
> leaving is the strongest sign of life available."*

**Session 57's barges do not move.** `riverCraft` is MOORED craft — static instance matrices in the
chunk's `river:structure` mesh, rebuilt only on a chunk crossing, with no path, no speed and no
update. Its own header says so — *"WHAT IS MOORED ON THE RIVER — SESSION 57"* — and `river.js` labels
the drawing side *"THE MOORED CRAFT"*. **The only thing that has ever moved on water in this project
is session 68's harbour launch**, and it was already at the harbour.

So there was no river mover to extend. **There was something better.** Session 68's mover is a PARTS
LIST with a vehicle index and one pose per vehicle per frame, all in ONE InstancedMesh — so a new
vehicle is a new index and some parts, at **zero new draw calls**. Everything item 3 asked for went
in that way:

```
  a coaster under way        78 m hull, house aft, two hatches, a mast, a bow wave and a wake
                             3.1 m/s over x 3 520 -> 4 600: six minutes to cross the frame
  two lorries                on the crane line, so they pass UNDER the portals
  a third straddle carrier   in the yard's second lane
  crane 0's trolley          running its boom out over the water and back
```

**AND SHE STARTS AT PHASE 1.45, NOT 0, WHICH IS SESSION 57's LESSON PAID A THIRD TIME.** A paused
harness reads `time.now = 0`, so phase 0 is what every frame ever taken of this harbour shows — and
phase 0 put the coaster at x = 3 520, four hundred metres west of the quay, behind every camera that
looks at it. Session 57 shot three empty river frames before finding barges the quay wall hid;
session 68 berthed its launch behind the `sea-harbour` camera and wrote a comment saying so. 1.45
puts her mid-channel at x = 4 114 and heading **west, outbound**.

---
## 3. FIVE DEFECTS FOUND ON THE WAY — FOUR OF THEM THIS SESSION'S OWN

### 3a. A STRADDLE CARRIER HAS RUN 6.35 m UNDERGROUND SINCE SESSION 68

`buildMoving` bakes each part's `dy` once and `stepMoving` writes only x, z and yaw — so a vehicle's
height is decided in one place and its position in another. Session 68 wrote `H.apronY` for both
carriers and then posed carrier 1 at `z = H.apronZ - 10 + 14` = **−184**, which is on the **yard**
plate. `apronY` is 2.117 and `yardY` is 8.470. **It ran its whole 330 m stroke buried to the portal
beam**, in a mesh whose draw count said it was there — CONTRACT §9's shape with two platforms: the
height of ONE level used as the height of the site.

Each carrier now takes the datum of the lane it runs in, and `carrierLane` holds the height and the z
**together**, so the two can no longer be written apart and disagree.

### 3b. A SECOND `shed` BRANCH IS DEAD CODE

The first arm of item 2c added `} else if (f.kind === 'shed')`. Session 49's `shed` already sits
forty branches up the same `if/else-if` chain with five call sites — a school, a hospital slab, a
fire station, a farmstead barn and this harbour's own two warehouses. **The first match wins**, so
the new branch never ran, and the new emitter's `{length, width, height, tone}` arrived at a branch
expecting `{length, depth, albedo, trim, style}`: `f.depth` undefined, a shed drawn NaN metres deep.
**Found by reading the chain, not by the frame** — a NaN box does not draw, and an absent shed looks
exactly like a shed that was never emitted. Renamed `transitshed`.

### 3c. THE WAREHOUSES AND BOTH FLOOD MASTS STOOD INSIDE THE CONTAINER STACKS

Session 66 put its two warehouses at z = −152 and −150 — inside the yard band (−188 to −132) and
inside the block row centred at −146: a 96 × 34 m building interpenetrating four container blocks.
Both flood masts were at `H.x0 + 40` = 3 944 and `H.yardZ − 14` = −146, which is a stack COLUMN
centre and a block ROW centre, so each 14 m column stood through a block. Invisible in every frame
taken since, because the blocks were three high and the shed is twelve metres tall in the same place.
The warehouses move to the second rank inland; the masts move into the lanes.

### 3d. THE EAST 28 m OF QUAY HAD NO RAIL, NO BOLLARD AND NO FENDER

`quaykit`'s first arm put its stations at `H.x0 + (n / qN) * (x1 − x0)`, so the last one landed on
x = 4 352 **exactly** — which is `chunkBounds(34, −2).x0`, the chunk EAST of the harbour, and that
chunk fails the site's own overlap test because `min(4352, 4480) === max(3904, 4352)`. Sixteen of
seventeen stations emitted. Stations are centred in their own run now, so every one is strictly
inside the site. **Same class as the `cz` guard session 66 already carries a comment about**: an edge
that is a boundary to two things at once.

### 3e. AND ONE THAT `citycheck` CAUGHT AND NO FRAME WOULD HAVE

The lamp head added in item 4 went on **every** `flood` feature. There are NINE emitters of that
kind — construction sites, canopies, yards — and **all nine pass `aimX`**, so nothing in the feature
could tell a quay mast from a building site's. The gate said so within the hour:

```
  forbidden delivered overlaps      5  ->  12     new: prop(bin) x site(flood:)      0.034 m2
                                                       prop(cabinet) x site(flood:)  0.169 m2
  delivered sign quads in region   2 647 -> 2 713
  highway_speed triangles      2 451 648 -> 2 452 224
```

A 2.6 × 1.2 m head on a 0.20 m mast claims **thirteen times** the ground the mast does, and 66 of
them stand in a city that was laid out around a pole. `f.head` is set by the harbour's emitter and by
nothing else now. **CONTRACT rule 5's shape with a bin in it: a gate's number moved as a side effect
of a change aimed somewhere else** — and the only reason it was caught is that `citycheck` counts a
population nobody was looking at. The frames were all fine.

---
## 4. THE LIGHT, AND PREMISE (iv) IS TRUE FOR A BETTER REASON THAN THE BRIEF GAVE

**The harbour is inside the emissive gate. There are TWO gates and they are 2× apart:**

```
  city:bowls    built inside `if (near)` — ring <= 2, 256-384 m. The gate session 68's villas
                failed against a 900 m drive reach. ONE global emissive intensity and no
                per-instance channel, so every bowl in the world is the same sodium at the
                same brightness: LOOK.md's "warm against the city's cold" cannot be said
                through it at all.
  city:signs    merged by `rebuildSignMesh` over EVERY resident chunk — ring <= 5, 640-768 m
                — on `materials.sign`, which `lights.js` gives a per-instance emissive
                through `totalEmissiveRadiance *= vColor`.
```

So the harbour's lights are **sign quads**: twice the reach, a draw call that already exists, a
chroma and a gain per instance, and **no cluster light slot taken**. `sea-road` and `sea-harbour`
both stand at ring 1 of the quay, so every committed pose that looks at this sees it.

Lit: four portal-corner floods on every gantry, two more along each boom, the operator's cab, a
proper head on each flood mast aimed the way the mast already said it was aimed, clerestory strips
along the transit sheds, the gatehouse window and its canopy, and the dockers' hut. **Sodium outside
and cold fluorescent inside**, which is the contrast that makes both read.

`glow()` writes `signQuads`, `signTint` and `signTrade` together or not at all — `rebuildSignMesh`
asserts their lengths match and session 55 paid for a parallel array that ran short.

**WHAT IT DOES NOT BUY, said out loud: these quads GLOW, they do not ILLUMINATE.** Nothing is lit by
them. The actual illumination on the quay is still session 66's eight `lamp` features and the three
`flood` masts, which take real cluster slots. At `t = 0.92` the terminal reads as a line of warm
lights along a dark quay with one bright pool where a mast is aimed — which is what a port looks like
at night, and is also less than a session with a light budget could do.

---
## 5. GATE STATE

**ALL EIGHT RAN. `perfcheck` COMPLETED THE WHOLE BATTERY FOR THE SIXTH SESSION RUNNING.** The
battery below is the SECOND of two: the first ran on the source that carried §3e's flood head, and it
is what caught it. This one ran on what ships.

```
  gate            exit   verdict   seconds  load1 in     out
  parsecheck         0     GREEN       4.0      5.28    5.10
  faultcheck         0     GREEN      27.7      5.10    5.12
  lookcheck          1       RED      51.8      5.12    5.01    THE IDENTICAL THREE
  windcheck          0     GREEN      41.1      5.01    4.88
  inputcheck         0     GREEN      17.4      4.88    5.46
  gateaudit          1       RED      78.1      5.46    5.06    the carried `control failed`
  citycheck          1       RED     126.1      5.06    4.67    IDENTICAL TO SESSIONS 57-70
  perfcheck          1       RED    1102.8      4.67    4.62

  4 of 8 RED — the same four as sessions 53-70. NO FIFTH RED.
```

**`citycheck` IS BYTE-IDENTICAL TO SESSIONS 57–70 ON EVERY COUNT, AFTER §3e AND NOT BEFORE:**
clumping CV **0.393**, **5** delivered forbidden overlaps, **2 of 2 647** signs inside a building,
**1 004 of 284 918** bare walkable samples, occupancy **18 799 / 19 087**. The harbour added 409
features and roughly 1 400 boxes to the world and moved none of them, because every one of them is
3.9 km outside that gate's 100-chunk region.

`lookcheck`'s three are `distinct:midnight|dusk` at **0.02846** against a floor of 0.03,
`facadeAlbedo` and `facadeNeighbours` — the same three, at the same numbers, as sessions 53–70.

**EVERY `perfcheck` VIOLATION IS CARRIED OR IS A TIMING ABSOLUTE FROM A LOADED MACHINE**, at `load1`
**4.67** against CONTRACT §0.2's bar of 1.6. The non-timing ones:

```
  downtown_dense  frame entropy  4.992   floor 5
  night_rain      frame entropy  4.968   per run 4.810 / 4.978 / 4.968   spread 0.168
  highway_speed   dark gap at the ground   70% of 64 vehicles   floor 75%
  highway_speed   non-monotone tone        58% of 64 vehicles   floor 75%
```

The silhouette bars read 75 % and 52 % over 71 vehicles in session 70 and 70 % and 58 % over 64 here,
with nothing in the routes changed — which is the sampling population `silhouettes.$estimator`
already describes. **And `night_rain`'s entropy spread is 0.168 against a 0.032 breach for the second
session running**, which is §6 item 4.

---
## 6. WHAT TO DO FIRST NEXT TIME

**1. LOOK AT THE HARBOUR AND SAY WHAT IS STILL WRONG.** This session built roughly and on purpose —
*"many things built roughly beats one built perfectly"* — and frames are the only judge that has run
on any of it. The container blocks read as a grid from 500 m and as a wall from the gate; the transit
sheds are ribbed boxes; nothing on the quay has been looked at from reading distance.

**2. THE MOORED HULLS HAVE NO NAV LIGHTS AND THE COASTER HAS NONE EITHER.** `harbourCraft` is drawn
by `river.js`'s own `push` into `river:structure`, which is not the sign mesh, so the `glow()` route
this session opened does not reach it. A red and a green on a moving hull is the cheapest sign of
life left unbought.

**3. `sea-road` IS THE ONLY POSE AT CAR HEIGHT AND IT NEARLY DIED THIS SESSION.** The first arm
spread four transit sheds evenly and put two of them 3 m either side of that camera; the frame came
back as two white walls with a slot between them. They flank the gate now and the 134 m window is the
road's own approach. **Any future building landward of `yardZ` has to be checked against that pose
before it is committed.**

**4. THE TWO THINGS SESSION 70 LEFT, BOTH STILL TRUE AND NEITHER TOUCHED.** `perfcheck` captures with
no `settle()` at all, so its frames are the only ones left in the repo that are not phase-normalised;
and its entropy floor is a §0.1 case in the open — `night_rain` read 4.947 / 4.972 / 5.095 across
three runs against a floor of 5, asserted on a single draw whose spread is five times the breach. The
four `trade-*` look frames still differ run to run by 3.1–8.1 MB, entirely in the vehicles.

**5. THE SEAM AND THE RIVER BLEED.** Session 70 measured the sea seam at five poses and found that
`span` takes the river at 130 m from a pavement. Untouched here by instruction, and it is still the
largest live defect in the water.
