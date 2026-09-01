# NOCTIS — STATE

*End of session 64. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`, 13 d 15 h of
uptime — the same boot as sessions 47–63. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` RAN 2.4–6.0 THROUGH THIS SESSION***, with `mediaanalysisd` and its XPC access helper
holding two cores the whole time — over CONTRACT §0.2's bar of 1.6, for the fourth session running.
**No millisecond below is a verdict.** Every number here is a count, a length, an angle, a
reflectance, a ratio or a pixel.

Branch `claude/noctis-64-hills-as-land`, off session 63's head, pushed as each item landed.

---
## 0. THE FRAME THE SESSION EXISTS TO ANSWER

**`tools/shot-out/s64-car-t0_42-wet.png`** — the car's eye, 1.6 m, on the exit road at
x = 3 260 looking east down it, `t = 0.42`, wet pinned.

**THE HILL ON THE RIGHT IS LAND.** It rises out of the fields with no line where it starts, no
facet on its flank, no separate colour and no seam at its foot. There is nothing in that frame that
distinguishes the hill from the ground it is part of, because there is nothing to distinguish: the
dome is a term of `terrainHeightAt` and `block:ground` draws it with the terrain's own vertex
normals. **`city:hills` does not exist any more.**

**AND THE WORLD DOES NOT END.** The land runs to a haze horizon. The knife edge the operator named
as *"the one thing in the frame that says DEMO"* is gone, and §3 has the delivered pixels either
side of where it was.

Second frame, **`tools/shot-out/s64-air4-t0_42-wet.png`**, aerial from 180 m — the same land from
above, with the hill's shoulder, the houses on it, the farmsteads and the horizon in one shot.

---
## 1. ITEM 1 — THE HILLS BECAME TERRAIN

**THE OPERATOR'S READ IS THAT THE SEAM WAS NEVER THE DEFECT, AND THE MEASUREMENTS AGREE WITH HIM.**
Session 62 took a hill's rim from 43.6° to 7.1°. Session 63 sank each dome to its own lowest rim
and got 43 floating rim samples out of 8 304, worst **0.0386 m**, inside the 0.05 m every join in
this project uses. His frame still showed a hill that *"sits ON the fields rather than in them"* —
because what reads as a knife is a **MESH BOUNDARY**: a different geometry, a different material
and a different albedo meeting the ground along a line. No amount of rim-matching removes a line
between two objects. Removing one of the objects does.

```
  city:hills deleted                    -173 instances, -6 920 triangles, -1 draw call
  raising h(x,z) where they stood       +0 triangles — the 32 m grid already covered it
  terrainHeightAt inside r <= 3 232     0.000000 m over 512 733 samples at 8 m spacing
  relief                                30.6 -> 121.9 m
  slope   p50 1.00 -> 1.63    p90 2.08 -> 20.82    max 6.30 -> 56.12 deg
  share of the outer annulus that is hill                            31.3%
```

**THE ZERO-INSIDE GUARANTEE SURVIVES BY CONSTRUCTION AND NOT BY LUCK.** A hill is the ground now,
so a footprint reaching inside `CITY.extentEdgeM` would lift the lattice's planar roads. 42 of 173
masses reached inside, worst by 297 m. `hillMasses` pushes every crown clear by `foot·ecc` — the
ellipse's LONG axis, which session 63 learned the hard way is not `foot` — and the ring now runs
3 354 to 4 010 m.

**AND A DOME'S SUMMIT FELL BETWEEN LATTICE POINTS.** The mesh samples where the grid is, so a peak
between stations is never drawn: measured, peak loss p50 1.7%, p90 8.1%, **27.1% at worst**. Hill
centres are snapped to the terrain's own station lattice, which costs nothing and takes the loss to
**p50 0.00%, p90 0.00%, max 0.00%** — zero by construction, not by measurement.

The hills' albedo moved with them: `HILLS.hillAlbedo` and `woodAlbedo` blend into the ground's
per-vertex tint over the outer two fifths of a footprint, so a hill's foot is a band of scrub
running into the fields and there is no line for the eye to find.

### 1a. THE FIRST WET FRAME FOUND A COUNTRYSIDE MADE OF WATER

`noctisRough` is a vec2 — a roughness override and the porosity every wet term in `lights.js`
reads — and a mesh without the attribute reads the generic default `(0, 0)`. **Porosity 0 is
IMPERVIOUS**, correct for tarmac, and `block:ground` has silently claimed it since session 1.

It never mattered. Inside the city that plane is under the streamed ground; past the extent it was
under session 61's crop RECTANGLES, which carried a sward's 1.0. **SESSION 63 MADE THAT PLANE THE
VISIBLE COUNTRYSIDE AND INHERITED THE OMISSION**, and the first `--wet=1` frame of this session came
back with farmland reflecting the sky like a lake. It is session 55's own *"a lamp post reflecting
in a lawn"* arriving at the one surface session 55 could not reach. The porosity is the crop's now,
out of the same `farmCrop` the tint reads: grass 1.0, field and tilled 0.85, hill 1.0.

---
## 2. THE BRIEF'S FOUR PREMISES

### 2.1 *"32 m stations carry a 7° shoulder at A = 20 m"* — **TRUE, AND IN THE OPPOSITE DIRECTION FROM THE WORRY**

The worry is that the shoulder band is too narrow to resolve, and it is: the band is 0.18 of a
footprint, which at `foot` 110–300 is 20 to 54 m, so **123 of 173 hills have under one cell in it.**

But a cell straddling the footprint edge averages the dome's toe with the flat ground outside it,
so the sampling delivers a **SOFTER** rim than the analytic dome, not a harder one. The outermost
32 m facet, measured along the SHORT axis — the tightest case, and the first arm of this measurement
sampled along `+x` at `u·foot` when the semi-axis is `foot·ecc` and reported a 17.6° rim that does
not exist:

```
  delivered   p10 0.1   p50 1.8   p90  7.2   max 24.9 deg
  analytic    p10 4.0   p50 8.6   p90 15.7   max 26.6 deg
```

against terrain that is itself p90 2.08°. **Nothing needed refining.**

### 2.2 *"raising h and deleting the masses is net triangle-negative"* — **TRUE FOR ITEM 1, AND ITEM 2 SPENT IT**

−6 920 triangles and −1 draw call for the deletion, +0 for the amplitude. §7 has the delivered route
figures and what the horizon cost.

### 2.3 *"the horizon line is fog reach, not ground extent"* — **FALSE. IT IS THE GROUND EXTENT.**

There is no `THREE.Fog` anywhere in this project. The only atmospheric term is the analytic
exponential-height haze integral in `lights.js`, which has **no far plane at all**. The camera's far
plane is 6 000 m. The ground plane's half-extent is 4 000 m, and **nothing whatsoever is drawn past
it** — 3 963 distant boxes, none further than 2 639 m from the origin; the hills stop at 3 950 m.
§3.

### 2.4 *"the floating dash is one instance, not a class of 94"* — **FALSE BOTH WAYS. IT IS A CLASS OF 34.**

§5.

---
## 3. ITEM 2 — THE WORLD STOPS ENDING

**MEASURED FIRST, AND IN THE DELIVERED PIXELS.** Column-averaged linear luminance over the middle
half of the operator's own aerial, 1440 × 810:

```
  the sky's own horizon smoothstep    rows 105..128    0.6967 -> 0.2497
  THE FLAT BAND UNDER IT              rows 128..290    0.2456 -> 0.2400   d/row 0.00003
                                      162 of 810 rows = 20% of the frame
  THE PLANE'S EDGE                    rows 290..325    0.2400 -> 0.1220   a 49% fall
```

The band is `sky.js`'s below-horizon fill and it is **ONE CONSTANT COLOUR**:
`ATM.groundAlbedo × groundLightingLux / π`, with the pollution dome and the airglow both multiplied
by `aboveHorizon` so neither reaches it. Twenty percent of the frame, flat to four decimal places.

**AND THAT CONSTANT IS STANDING IN FOR GROUND IT DOES NOT DESCRIBE.** The countryside's own
area-weighted albedo, over 54 588 samples of the delivered crop and hill tints, is
**[0.109, 0.112, 0.066], Y 0.108** against the fill's **Y 0.144** — 1.34× too bright before the
illuminance is even argued about, because `groundLightingLux` is the **street lamps'** contribution
and session 62 correctly removed every lamp out there. One quantity doing two jobs, CONTRACT §9.

**BOTH OF THE BRIEF'S PROPOSED ARMS ARE FALSIFIED BY ARITHMETIC.**

*Raising the haze erases the city.* To reach 10% transmittance at the 700 m that edge stands at in
this frame, σ must be 3.735e-3 /m — a **1 047 m visibility fog**, in which the city reads 0.474 at
200 m and 0.005 at 1 400 m against today's 0.914 and 0.533. The brief says *do not let haze eat the
city*; the arithmetic says it would eat all of it.

*And the ground cannot outrun sight at the terrain's own station.* 10% transmittance needs about
6 000 m of ground ahead of a camera that stands at 3 300, so a half-extent of 9 300 m: **346 km²
against 64**, at 32 m stations, about **660 000 triangles** against a ceiling with 187 622 spare.

**WHAT NOBODY COSTED IS A COARSE ONE.** Past 4 km the transmittance is under 0.22 and falling; there
is no relief to resolve and no crop to read. So the ground continues as **four fans out to
`TERRAIN.skirtM` = 10 000 m** — `camera.far` plus the furthest a camera stands from the origin and is
still over ground — with the inner edge on the plane's OWN 32 m stations, so no T-junction can crack
and no seam can read, and with the outer square scaled by `S/E` so the four corners meet exactly.

```
  one ring per station        2 000 triangles   AND IT LOOKED LIKE A CATHEDRAL FLOOR.
                                                Each quad is 6 km long and interpolates its
                                                tint and its height from two ends, so the
                                                crops came back as radial stripes converging
                                                on the horizon.
  six rings, doubling out    12 000 triangles   128 m at the join, 4 km at the far end.
                                                STILL ONE DRAW CALL.
```

**DELIVERED, same camera, same seed, same hour, rows 132..330:**

```
                                before      after
  worst 4-row fall            0.02947     0.01525     -48%
  as % of the brighter side     12.8%       9.8%
  worst step / mean step        11.0x       4.9x      -55%
```

**A knife is one big step in an otherwise flat band.** The band is not flat any more and the step is
half what it was: the land recedes continuously from the near field into haze. **The residual is the
fill's own 1.34×**, and removing it means splitting the sky LUT's lower hemisphere from the IBL it
also feeds — `sky.js` says of that same line *"through PMREM it is the only thing illuminating every
downward-facing surface in the scene"* — which moves every soffit in the city. Measured, named, and
not this session. §9.

**THE RIBBON WENT WITH IT.** A road stopping at 4 000 m while the land runs on is the same edge moved
onto the one object a car is looking at. Past `EXIT_ROAD.rimM` the centreline is straight and the
section constant, so the stations out there are 256 m: **96 triangles**. `blockSurfaceAt` reads
`TERRAIN.skirtM` too, or the query would answer `earth` over 6 km of drawn road.

---
## 4. ITEM 3 — THE PAD'S MATERIAL WAS IN THE FILE ALL ALONG

A hillside villa's plot was `kind: 'yardGround'`, which `city.js` documents in words as **worn
concrete hardstanding**, laid 28 × 26 m = 728 m² on a hill shoulder.

**LEVEL IS NOT THE TELL.** `yardGround`'s luminance is 0.169 against a stubble field's 0.172 —
within 2%. **CHROMA IS**: saturation `(max−min)/max` is 0.070 against grass 0.521, field 0.495 and
tilled 0.403, so the pad is **six to seven times flatter in chroma** than everything it abuts, at
almost exactly a crop's brightness. A big flat grey rectangle in farmland is a car park.

The plot is `grass` now — Y 0.0837 against `HILLS.hillAlbedo`'s 0.0871, **within 4%** of the scrub
the terrain paints under it, so it disappears. The paving becomes 3.6 m wide and 50 m², running the
downhill half of the plot on the city-facing side: **a drive**. It takes the LAWN's datum and not
the yard's, which is session 48's rule for a hard court — `GROUND_Y.yard` is 0 and `GROUND_Y.grass`
is 0.14, so a drive at the yard datum is a trench through its own garden.

**AND THE FRAME SAID THAT WAS NOT THE PAD HE WAS LOOKING AT.** After the villa plots went green the
grey plates were still there: they are the **FARMSTEADS**. 68 × 52 m = **3 536 m²** of hardstanding
with a two-storey farmhouse standing in the middle of it, **221 of them**, the largest single grey
shape in the countryside. The plot is grass now and the concrete is 36 × 24 m around the barn and
its apron — **864 m², 24% of what was there** — so the house keeps a garden and the silo stands on
grass, which is what a farm looks like from a road.

### 4a. AND THE GUARD DOES WHAT ITS OWN COMMENT DERIVES

`hillsideHouses` tested `> 0.60` while the paragraph over it derived **0.18** and said so in words.
CONTRACT §9.1 exactly — a comment that claims a check. 0.60 is **31.0°** and nobody builds on that;
over the merged terrain it admitted 39 houses whose flat plates missed their own ground by up to
**20.67 m corner to corner**. At the derived 0.18 — 10.2° — it admits 23 and the worst plate misses
by **6.78 m**, which is the 2.5 m of cut and 2.5 m of fill the paragraph itself calls a platform.
Delivered slope at the house: p50 4.9°, max 10.2°.

### 4b. AND `onHill` ASKS THE ELLIPSE

It tested a **CIRCLE** of radius `foot` while a hill's plan has had semi-axes `foot·ecc` and
`foot/ecc` since session 62, with `ecc` running to 1.60 — **blind to 44% of the long axis** and
over-refusing on the short one. Measured: a farm silo at (−2439.8, −3010.9) stands at ellipse
u = 0.972, comfortably inside its hill, with a circular `r/foot` of 1.135 that let it through. It is
`hillRiseAt`'s own expression now, with the pad added to both semi-axes rather than to a radius.

---
## 5. ITEM 4 — ONE FLOATING DASH IS THIRTY-FOUR, AND IT IS NOT NINETY-FOUR

`block.js`'s `put` — the **one** y-source for every mark in `block:markings` — set
`GROUND.carriageway`, a constant. It was right for sixty-two sessions because every road in this
block was at that constant. **SESSION 63 MOVED THE ROAD AND NOT THE PAINT**: the ribbon's vertices
and `blockSurfaceAt` both became a function of position, the datum stopped being a number, and this
call site kept the number. CONTRACT §9 rule 7, with the two sides three hundred lines apart.

```
  221 marks this block places
  187 inside BLOCK_KEEPOUT     max |terrain| 0.000000 m — the constant was right there
   34 on the exit road, 3 232 to 3 432 m
      32 of them off their road by more than 0.05 m
      p50 5.31   p90 8.34   max 9.34 m, and every one of them FLOATING
```

**THE OPERATOR SEES ONE BECAUSE THE OTHER 33 ARE SUB-PIXEL OR BEHIND HIM.** From the car's eye,
fifteen are ahead; one subtends 29 px and sits ~177 px above the tarmac it is painted on; the next
is 8.6 px, and the remaining twelve are under 2.3 px and pile up on the horizon.

**ASKING THE QUESTION FOUND A SECOND ONE, OLDER AND INVISIBLE.** The cross street is laid 0.005 m
over the main one where they meet, and its own centre line and edge lines were being placed at
`carriageway + 0.002` — **three millimetres INSIDE the asphalt they belong to**. Not a float: paint
that z-fights or disappears, which is why nobody has ever reported it.

The height comes from `blockSurfaceAt` now, not from a third copy of its branches. A mark asks what
it is lying on and lies on it.

### 5a. AND THE OBVIOUS FIX WAS WRONG, WHICH A MEASUREMENT CAUGHT

Reading `terrainHeightAt` at the mark would have put the paint on the **SMOOTH** function while the
ribbon draws **STRAIGHT LINES** between 8 m stations. Over the 200 m that carries paint those two
differ by p50 **0.0041**, p90 **0.0097**, max **0.0149 m** against a paint thickness of 0.004 —
buried on a crest, floating in a dip. So the ribbon's stations are hoisted, the strip is built from
them, `roadRiseAt` bisects and lerps them, and `blockSurfaceAt` answers out of the same array. **A
wheel, a boot, a vertex and a dash now read one description.**

---
## 6. ITEM 1e — THE PLANAR CLAIMS ON THE SHOULDERS, AND THE ONE THAT IS STILL OPEN

Three populations sit on ground the merge moved.

**THE VILLA PADS — 26 rectangles, and they are the only planar ground on a hill.** 1 118
countryside ground rectangles in the walked ring; 26 have their centre inside a hill footprint;
every one is a villa plot. No verge, lay-by, farm yard or house garden is up there — `onHill`
already refuses those, and §4b makes that refusal correct for the first time. §4a takes their worst
corner span from 20.67 m to 6.78 m.

**THE PROPS — 733 in the ring, 0 on a hill.** Nothing to do.

**THE HEDGES — 5 174 SEGMENTS, AND THIS IS THE OPEN ONE.** A hedgerow segment is a rigid 12 m box
placed at one `worldSurface` height, so on a slope its ends leave the ground. Measured against the
surface `city.js` actually draws, over 662 hill chunks:

```
  edge:hedge   5 174 on a hill    end off the ground   p50 1.04   p90 2.59   p99 4.24   max 6.84 m
                                                       over 0.05 m: 5 094 of 5 174
  every other rigid feature    9 on a hill             p50 0.47   p90 0.87   max 1.16 m
```

A hedge is 1.8 m tall. **At the median its end is over half its own height off the ground**, and at
the worst it is nearly four hedges up. The repair is a PITCH on the feature's base transform —
`put` composes a yaw and nothing else, so a hedge on a slope cannot lean with it — and that is a
change to the shared transform every feature kind in this project goes through. It is named, costed
as one session's work, and not done here. §9.

---
## 7. THE COST

`highway_speed`, the worst case on both counts, run on its own because the battery's `perfcheck`
has died in the browser for four sessions running:

```
                   session 63     session 64
  draw calls          402            401       of 440
  triangles       2 442 378         2.45 M     of 2 630 000
  instances         348 006         347 833
```

`perfcheck` prints the triangle figure rounded to two decimals, so the exact delta is given by
construction rather than read off the tool: **−6 920** for `city:hills`, **+12 000** for the skirt's
six rings, **+96** for the ribbon over it — **+5 176**, which is 2 447 554 and prints as 2.45 M.
About **182 000 of headroom** left under the ceiling the operator granted in session 63.

**THE DRAW CALL CAME BACK AND NOTHING SPENT IT.** 401 of 440, the lowest this project has run since
the merged lamp meshes in session 62. Both new surfaces — the hills and the skirt — are vertices in
`block:ground`, which was already one call.

**WHAT I CANNOT TELL YOU IS FRAME TIME.** `highway_speed` read cpu p95 11.50 ms and wall p95
12.90 ms with a 0.8 ms spread over three runs, at `load1` near 6.0 with `mediaanalysisd` on two
cores and a browser on two more. CONTRACT §0.2's bar is 1.6. **A red wall-clock absolute from this
machine is not a verdict** and is recorded as unresolved, exactly as sessions 62 and 63 recorded
theirs. The mechanism named in STATE 63 §8 is unchanged and now carries more geometry:
`block:ground` is `frustumCulled = false`, so the whole 20 km of ground is submitted and
vertex-shaded every frame including what is behind the camera. Tiling it costs draw calls and there
are 39 spare.

---
## 8. GATE STATE

<!--GATES-->

---
## 9. WHAT TO DO FIRST NEXT TIME

1. **THE 5 174 HEDGES ON THE SHOULDERS (§6).** The largest single population of rigid geometry
   standing off the ground in this project, median 1.04 m on a 1.8 m object. The repair is a pitch
   in the shared feature transform, which every feature kind reads, so it needs its own falsifying
   case and its own session.
2. **THE BELOW-HORIZON FILL IS 1.34× THE GROUND IT STANDS IN FOR (§3).** It is the residual of item
   2 and it is one quantity doing two jobs: the visible backdrop past the plane edge, and — through
   PMREM — the only thing lighting every downward-facing surface in the city. Splitting them is
   right and it moves the city's look, so it is a look decision with a gate consequence, not a
   repair.
3. **THE FRAME TIME AND THE `frustumCulled = false`, CARRIED FROM STATE 63 §8 AND NOW LARGER (§7).**
   `block:ground` carries the skirt as well as the terrain and is still submitted whole every frame.
   Tiling costs draw calls. First thing to measure on a quiet machine.
4. **A VILLA STILL HANGS OFF ITS OWN TERRACE.** The pad is axis-aligned at 14 × 13 while the house
   is rotated and its drawn extent reaches `|cos|·14 + |sin|·15` — **up to 7.16 m past the plate**
   at 45°. Sizing the pad to the rotated extent fixes the overhang and takes the plate to 1 119 m²
   and an 11.15 m corner span, which contradicts the derivation that sized it a platform and not a
   plateau. Both numbers are here; the trade has not been taken.
5. **NOTHING PAST 3 232 m IS INSIDE ANY GATE, AND THERE IS NOW 6× MORE GROUND OUT THERE.** Carried
   from STATE 61 §7, 62 and 63. The terrain, the crops, the hills, the villas, the farmsteads and
   now the skirt are all outside every assertion in this project. `landprobe` and `slopeprobe` are
   probes and say so in their own headers.
6. **THE 49 CONSTANT-READING GROUND SITES, CARRIED FROM STATE 63 §4.** `traffic.js` writes four
   vehicle y values with no ground query; `weather.js` carries its own shadow `GROUND_Y` with nine
   readers; `player.js` has a fallback of literal `0`. All latent while terrain is zero inside the
   extent. **`block.js`'s markings were the fiftieth and it stopped being latent in one session**
   (§5) — that is what these look like when they fire.
7. **THE PEDESTRIANS FOLLOW THE CAMERA ONTO A HILLSIDE**, carried from STATE 63 §9.
8. **CARRIED, UNCHANGED**: the height law reads nothing at all (STATE 61 §4); the traffic has no
   lane that is not a lattice line; `city.js`'s `unitHash` puts the multiplier inside the sine; the
   three chunk seams; the 53 holograms; the school yard's 8 trees and the church square's 98.
9. **`decodePNG` RETURNS THREE BYTES PER PIXEL.**
