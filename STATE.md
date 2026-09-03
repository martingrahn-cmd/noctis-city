# NOCTIS — STATE

*End of session 75. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`, 15 d 23 h of
uptime — the same boot as sessions 47–75. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` RAN 3.22–6.97 THROUGH THIS SESSION***, over CONTRACT §0.2's bar of 1.6 for the
fifteenth session running, and higher than session 74's 3.6–4.6. **No millisecond below is a
verdict.**

Branch `claude/noctis-75-airfield-lights-and-buildings`, off session 74's head.

**THE AIRFIELD'S LIGHTS, THEN ITS BUILDINGS AND ITS AIRCRAFT.** The platform, the siting and the
markings were not reopened.

**THE FOUR VERDICT FRAMES ARE COMMITTED POSES NOW, AND THIS IS HOW TO TAKE THEM:**

```
  node tools/lookat.mjs --preset=af-apron,af-forecourt,af-hangar --t=0.42
  node tools/lookat.mjs --preset=af-approach --t=0
```

`af-approach` AT `--t=0` OR IT PROVES NOTHING — it is the night frame, and the whole of §0 is about
why it used to be black.

---
## 0. WHY 82 GENERATED LIGHTS DID NOT DRAW — SESSION 74'S OPEN DEFECT, ANSWERED

Session 74 built the airfield's whole light diagram, measured that it cost nothing, took the
midnight approach frame, and got **black**. It ruled out opening hours, brightness and generation,
and ran out of budget. **There are two causes and neither is the one the brief expected.**

**THERE IS NO RESIDENCY RING PROBLEM AND NO BOUNDING SPHERE PROBLEM.** `city:signs` is merged by
`rebuildSignMesh` over every resident chunk into ONE city-wide mesh, so its bounding sphere is
city-wide and `frustumCulled` never rejects it — `city.js` says so in its own comment. The lights
were being drawn the whole time. Premise (i) is false and so is candidate (c).

### 0a. THE FACING — and it is the half nobody would have guessed

`materials.sign` is `THREE.FrontSide` and a `PlaneGeometry`'s front is **local +Z**. `afstrip` and
`afapproach` both carry `yawDeg: 0`, so every runway edge light, every centreline light and every
approach light presented its **back face** to anything standing SOUTH of it.

**Every night frame session 74 took looked north, because north is the approach direction.** The
same runway photographed from the north end has both edge rows in it and always did.

The repair is `glowOmni`, which emits the quad twice — exactly coplanar, exactly opposed, so
whichever faces the camera is the only one rasterised and they cannot z-fight. **Not
`THREE.DoubleSide`**: the material is shared with 2 647 city signs, and all 17 other `glow()` call
sites in `city.js` are floods, shopfront windows, clerestories or door plates that genuinely face
somewhere. Checked one by one. The airfield is this project's first population of **omnidirectional**
fixtures, and the aircraft nav lights added later the same session are the counter-example that
keeps the rule honest — a red port light and a green starboard one are single-sided ON PURPOSE.

### 0b. THE WATER — 16 of 30 approach stations stood on the seabed

```
  z = 250   the south threshold          terrain   7.52 m
  z = -170  the last dry station                   1.80 m
  z = -200  SEA                                   -7.53 m
  z = -650  SEA, the last station                 -61.94 m
```

Sea level is **−4.99 m**, so the far end of session 74's approach row was **57 m under water**.

**THE SITE SURVEY IS NOT WRONG, AND THAT IS THE POINT.** It scored the 3 000 × 620 m PLATFORM and
rejected any that touched the sea; the chosen platform clears the coast by 370 m. The approach row
runs **900 m** beyond the threshold. A predicate that was right about the rectangle it was given,
asked about a rectangle 900 m longer — and it is the SECOND time this exact 900 m has caught the
airfield out, because session 74's own emission gate used the platform's z extent and emitted 4 of
30.

The row now walks outward from its threshold and **stops at the first station without 1.0 m of
freeboard** (`AIRFIELD.approachDryM`). And the north threshold is dry for all thirty, measured on the
same centreline — 7.07 m at the first station, 7.24 m at the last — so the field has two rows now:

```
  south   14 stations, z 220 to -170     420 m, and it is short because the coast is there
  north   30 stations, z 3280 to 4150    900 m
```

### 0c. AND THE THRESHOLD'S GREEN AND RED WERE INSIDE OUT

Local +Z points INTO the field at both ends — the piano keys are at `dz = 22` — so a green plate at
local yaw 0 showed green to somebody standing ON the runway and red to the aircraft on final. The
plates were already on the correct sides of the housing; only the two headings were swapped. Found
in `af-look-north`, where the threshold read as a red bar seen from the approach.

### 0d. ITEM 1d: DOES IT AFFECT THE HARBOUR AND THE VILLAS? — NO, AND THE REASON MATTERS

Since the cause is neither a ring nor a sphere, **no range mechanism is at risk anywhere**, and the
harbour's 3.5 km and the villas' 380 m were never relevant. The FACING is a general property of
`city:signs` and it is correct at all 17 other sites, because every one of them is a directional
fixture. Nothing needs changing at the harbour or the villas. **The night frame that proves the
repair is `af-approach`**, a committed pose: an approach centreline row with a crossbar in the
foreground, the green threshold beyond it, and the runway edge rows opening out behind.

---
## 1. WHAT IS BUILT — THE TERMINAL SIDE

**THE LAYOUT WAS DECIDED BY WHERE SESSION 74 PUT THE ROAD, and nothing new is routed.** The access
spur arrives at `spurX` on the platform's south edge; the apron is the 320 × 300 m rectangle
immediately north of it; a terminal is the building that separates one from the other. Its centre
module lands on the spur because both are derived from the same apron rectangle, which
`airfieldSite` now returns once instead of `generateChunk` computing it four times.

```
  terminal   5 modules over 302 m, 56 m deep, 15 m high, straddling the fence line
             (the terminal IS the boundary there, so the fence breaks across it)
  piers      2, 124 m north into the apron, glazed both sides, 4 airbridges
  stands     8, nose-in either side of each pier; 5 occupied
  hangars    3 on their own apron, 104/100/76 m, doors on the apron face,
             two of them open and one of those with an aeroplane in it
  tower      34 m, canted glazed cab, the darkest shaft on the field
  landside   a forecourt terrace 1.34 m proud of the field, 24 cars, two service
             sheds, a three-tank fuel farm
```

**THE VOCABULARY IS LOOK.md's OWN, off the hill houses**: one long volume, an oversailing roof slab
rather than a parapet, glass on the apron elevation ONLY, and a cantilevered canopy where a person
arrives. Ten moves and not one of them is detail.

**AN OPEN HANGAR IS A SHELL AND A CLOSED ONE IS A BOX**, and the first arm got that wrong in a way
worth recording: it drew the solid mass in both cases and put a black slab across the doorway to
stand for the opening. That reads as an opening and it is a **lid** — nothing behind it can ever be
seen, so item 2b's *"one open with something inside it"* had an aeroplane in it that no camera could
reach. **A box cannot be cut here any more than the ground could be**, which is session 74's finding
one scale down, so an open hangar is assembled from the walls it actually has and the doorway is the
volume nobody built.

---
## 2. THE AIRCRAFT

**Five on the stands**, a narrowbody each: 37 m over the fuselage, 34 m of span, 12 m to the fin,
swept wings, underslung engines, a raked three-step fin in one of five liveries, a lit cabin strip a
side. Drawn **nose-forward in its own frame** and posed by the stand's yaw, which is item 3b's *"one
parts list, many poses"* for nothing: session 71's river movers had to earn that with a vehicle index
because they move; a parked aeroplane gets it from `put` composing a yaw. Every box is an instance in
the chunk's own `:masses` mesh and every light a quad in `city:signs`. **Zero draws.**

Three of eight stands are empty and that is deliberate — an airport with every stand full is a model
of an airport. Ground service is one of three states off the index: a fuel bowser under the starboard
wing, a baggage train at the hold, or airstairs and a catering lift; a tug at every nose, cones at
every wingtip.

**ONE ON SHORT FINAL — and it is not a seventh airframe.** The fleet is six and stays six. Within
3 km of the threshold, plane 0 flies a 3° approach on the extended centreline instead of a transit;
outside that range `aircraft.js` behaves exactly as session 20 wrote it.

**THE ISOLATION IS A MEASURED DISTANCE AND NOT A PROMISE.** The nearest point of any gate route to
the south threshold is `highway_speed`'s first waypoint at (640, 3): **4 117 m**, against a 3 000 m
gate — 1.37x. `citycheck`'s region corner is 4 128 m. No route, no pose and no census sample can
reach the branch. The touchdown datum is read off `city.groundYAt` rather than typed, because the
platform's level is derived per seed.

**IT IS SESSION 20's LIGHT TWIN AND IT IS SMALL.** `AIRFRAMES.plane` is 11.9 m of span against the
34 m of the aircraft on the stands — a third the size, on final to a 3 km runway. It is honest and it
is odd, and it is item 1 of §6.

---
## 3. THREE OLDER DEFECTS THE FRAMES FOUND ON THE WAY

**1. `onAirfieldAt` HAD NEVER BEEN CALLED BY ANYTHING.** Session 74 wrote it, exported it, and said
of it beside the platform: *"`onAirfieldAt` keeps the countryside scatters off it, so nothing can
grow through it."* Nothing called it. Removed from the field and its 70 m margin: **14 complete
farmsteads** — 28 sheds, 14 silos, 14 farm-yard rectangles and 43 items of yard clutter — and **280
hedge segments**, with farmhouses and barns standing beside the runway. It is CONTRACT §9.1's *"a
value the code does not read"* with a FUNCTION instead of a value, and §9.1 now carries it.

> A correction to this session's own commit message, which claimed 89 trees among them: **no trees
> were removed.** The tree guard went into the HILL scatter and there are no hills on the platform.
> The tree count over the region is 89 before and 89 after. The farmsteads and the hedges are the
> whole of it.

**2. THE SIX AIRFIELD GROUND LAYERS WERE ALL AT THE SAME `yAdd`.** Exactly coplanar. The plan views
never showed it, because from 300 m up the per-quad winner is stable and the field looks right; a
camera standing ON the apron gets a **32 m staircase of grass and concrete**, resolved per pixel by
depth precision. `plate`'s `lift` parameter has existed since session 74 and nothing used it. There
is now a ladder of `AIRFIELD.layerLiftM` = 1 mm — `GROUND.crossingBias`'s own number and its own
derivation, restated in `citygen.js` because `parsecheck` forbids `src/lib` importing `src/core`. A
runway stands 4 mm over its own grass, which is also true.

**3. A TRAFFIC SIGNAL SHOWING A RED LENS ON THE AIRPORT APRON.** `traffic.js` emits four heads at
each of the four junctions of a 128 m arithmetic lattice **nearest the camera**. Session 35 gave that
loop a predicate — *"does a landmark stand here"* — after ten heads were found in the weir's basin.
It never got the other one. The vehicle placer in the same file has asked `cityExtentAt(x, z) <= 0`
since session 34; the signal loop did not. Found by cropping `af-stand-a` 7× to identify a black post
on the apron. Refused slots were already collapsed to zero scale by session 35's own repair, so no
draw and no triangle moves and no junction inside `CITY.extentEdgeM` = 3 232 m is touched.
**CONTRACT §9.2's fourth instance**, and the section now carries the rate note: the first three took
seventy-three sessions and the fourth took two, because the world grew a fifth landscape.

---
## 4. THE FOUR PREMISES

| | premise | verdict |
|---|---|---|
| (i) | the invisible lights are a residency ring rather than a bounding sphere | **FALSE, both halves.** `city:signs` is one merged mesh with a city-wide bounding sphere and `frustumCulled` never rejects it. The lights were drawn. They faced the wrong way, and half of them were under the sea. §0 |
| (ii) | whatever it is also affects the harbour and villa lights at their own ranges | **FALSE, and it cannot.** No range mechanism is involved. The facing is correct at all 17 other `glow()` sites because every one of them is a directional fixture; checked individually. §0d |
| (iii) | aircraft fit the harbour's one-mesh-many-poses route at zero draws | **TRUE, and cheaper than the premise.** They do not need the mover mesh at all: a parked aeroplane is boxes in the chunk's own `:masses` and quads in `city:signs`, which is what the whole airfield already was. Zero draws, zero new meshes. §2 |
| (iv) | the existing sky aircraft can be given an approach path cheaply | **TRUE.** One behaviour branch, one distance gate, no new airframe, no `stats` field moved. What it cannot give cheaply is SIZE — the airframe is a light twin. §2, §6 |

---
## 5. THE COST

**ALL EIGHT RAN, AND THE BATTERY WAS RUN TWICE — SAY WHY.**

```
  highway_speed   404 draws of 440              IDENTICAL TO SESSIONS 73 AND 74
                  2 466 960 tris of 2 630 000   IDENTICAL TO SESSIONS 73 AND 74

  gate            exit   verdict   seconds  load1 in
  parsecheck         0     GREEN       4.0      3.81
  faultcheck         0     GREEN      29.3      3.67
  lookcheck          1       RED      55.0      4.36    THE IDENTICAL THREE
  windcheck          0     GREEN      46.3      5.40    and the airfield adds no mesh at all
  inputcheck         0     GREEN      17.6      5.04
  gateaudit          1       RED      79.9      4.98    downstream of lookcheck, as always
  citycheck          1       RED     128.2      3.52    IDENTICAL TO SESSIONS 57-74
  perfcheck          1       RED    1267.8      3.26

  4 of 8 RED — the same four as sessions 53-74. NO FIFTH RED.
```

**A TERMINAL, TWO PIERS, THREE HANGARS, A CONTROL TOWER, A CAR PARK, FIVE AEROPLANES AND A SECOND
APPROACH ROW COST NOTHING ON THE BINDING ROUTE.** Not "about the same" — the same two integers,
three sessions running. That is what being 5 km out and off every route buys, and it is now measured
twice in two batteries.

**THE FIRST BATTERY CAME BACK 5 OF 8 AND NEITHER EXTRA RED WAS CONTENT.** `parsecheck` refused an
**ellipsis character in a comment I had just written** — the rule exists so a truncated file cannot
pass, and it caught exactly the shape it is for. And `lookcheck` died with
`page.evaluate: Execution context was destroyed` at `load1` 4.86 after streaming 25 of 30 field
slots, which then cascaded: `gateaudit` exits 2 with *"tools/look-out/ is missing — run npm run
lookcheck first"*, so one browser death reads as two failures. That death has hit `perfcheck` in
sessions 61-63 and had never hit `lookcheck` before. **Both were re-run**; the table above is the
second battery, entire.

**`citycheck` IS BYTE-IDENTICAL TO SESSIONS 57-74**: CV 0.393, 5 forbidden overlaps, 2 of 2 647
sign quads inside a building, 1 004 of 284 918 bare samples, occupancy 18 799 / 19 087. Wiring
`onAirfieldAt` and gating the traffic signals moved none of it, which is what a change 5 km outside
that gate's 10 x 10 chunk region should do.

**`windcheck` GREEN, 574 meshes, 570 ok, 0 wound backwards, 0 unmeasured.** Session 73's mesh-name
lesson held for a second airfield session, and for the same reason: every surface here is a rect in
`city:ground`, every box a chunk `:masses` instance and every light a `city:signs` quad. **The
airfield adds no mesh at all.**

**NO MILLISECOND HERE IS A VERDICT AND THE TWO BATTERIES PROVE IT.** `highway_speed` wall p95 was
**13.00 ms** in the first and **16.20 ms** in the second, on identical content — a 3.2 ms swing at
`load1` 3.3-7.0 against a 12.5 ms ceiling. CONTRACT §0.2's bar is 1.6 and this machine has not seen
it in fifteen sessions.

---
## 6. WHAT TO DO FIRST NEXT TIME

**1. THE AEROPLANE ON FINAL IS A THIRD THE SIZE OF THE ONES ON THE STANDS.** `AIRFRAMES.plane` is
11.9 m of span; the stand aircraft are 34 m. The two populations are in one frame at `af-approach`
and the disagreement is visible. Session 20 chose 11.9 m for a transit over a city and it was right
for that; a runway is a place where the size is legible. The change is not free — `AIRFRAMES.plane.minExtent`
feeds the §5.12 motion cutoff that this module prints and asserts at init — so it is a session's
item, not a line.

**2. THE NIGHT AIRFIELD IS DIM.** The lights appear now, and they are small white dots. Nothing on
the field lights the GROUND: there is no apron floodlighting reaching the concrete, so an aeroplane
on a stand at midnight is a silhouette with a cabin strip. Session 76 is the night session and this
is its subject.

**3. THE APRON PEDESTRIANS ARE A CITY DEFAULT THAT TRAVELS.** `streetlife` puts people on the apron
and in the hangars, evenly, at city density, on the airside of a fence. It is not wrong enough to
have been worth this session's budget and it is the same class as §3 item 3. Measured only by eye.

**4. THE SOUTH APPROACH IS 420 m AND THE NORTH IS 900.** That is the coast and it is correct, but it
means the signature shot has to be taken at the north end or accept a short row. Nothing on the field
knows which threshold is in use.

**5. THE THREE STANDING ITEMS, UNCHANGED.** `perfcheck` captures with no `settle()`; its entropy
floor is a §0.1 case in the open; the four `trade-*` look frames differ run to run entirely in the
vehicles.
