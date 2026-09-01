# NOCTIS — STATE

*End of session 65. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`, 14 d 2 h of
uptime — the same boot as sessions 47–64. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` RAN 2.77–6.14 THROUGH THIS SESSION***, with the same two `mediaanalysisd`-class helpers
holding cores as sessions 62–64 — over CONTRACT §0.2's bar of 1.6, for the fifth session running.
**No millisecond below is a verdict.** Every number here is a count, a length, an angle, a
reflectance, a ratio or a pixel.

Branch `claude/noctis-65-the-road-and-the-transform`, off session 64's head, pushed as each item
landed. *Said out loud because it is untidy: the first three commits were made while
`claude/noctis-64-hills-as-land` was still checked out, so that branch has been pushed forward to
session 65's head as well. The commits are the same objects; nothing was rewritten.*

---
## 0. THE FRAME THE SESSION EXISTS TO ANSWER

**`tools/shot-out/country-car-t0_42-wet.png`** — the car's eye, 1.6 m over the drawn road, on the
exit road at x = 3 260 looking east down it, `t = 0.42`, wet pinned.

**THE COUNTRY ROAD IS NOT A MIRROR.** It is dark, damp and glossy; the centre-line dashes read on
it; and the roadside tree that stood inverted in it in session 64's frame is not there. Measured on
the delivered pixels rather than described — rows 555–645 averaged, a straight line fitted across
x 940–1200, because a road carrying no image is a smooth ramp and one carrying an image has a hole
in it:

```
                                worst residual against the trend        sd of residual
  country-car-s65-before        -33.3 code values, 35.0% of trend            17.12
  country-car-s65-road2          -2.2, at the window's own edge, 1.4%         0.51
```

**AND THE POSE IS IN THE REPOSITORY NOW.** Session 64's two frames were made by a command in a
shell nobody kept, so this session could not retake them — `landmarkcensus.mjs`'s own opening
complaint arriving at a camera. `node tools/lookat.mjs --preset=country-car,country-air --t=0.42
--wet=1` derives both from the road's own functions and the hillside-house cluster's own centroid,
so neither can drift and both can be retaken by a reader with no memory of this conversation.

Second frame, **`tools/shot-out/country-air-t0_42-wet.png`**, 180 m over a hill shoulder: the
hedgerows rake with the ground instead of standing off it, and the hill has trees on it. Third,
**`tools/shot-out/villa-t0_42-wet.png`** against **`villa-nocut-t0_42-wet.png`** — a hillside house
standing on a terrace with a face on it, against the same house standing on a plate with open air
under its edge.

---
## 1. ITEM 1 — THE ROAD, AND THE CENSUS THAT SAYS IT WAS THE LAST ONE

**THE BRIEF'S PREMISE (i) IS CONFIRMED, AND AS A MEASUREMENT RATHER THAN AN INSPECTION.**
`block:road:main` — the exit-road ribbon, 482 triangles, −10 km to +10 km — set `position` and
`normal` and nothing else. `lights.js`'s own note says an absent `noctisRough` reads the generic
vertex default `(0, 0)` and that **porosity 0 is IMPERVIOUS**: `sheen = 1`, the pond term
unattenuated, `roughnessFactor` mixed to `SURFACE.puddleRoughness` = 0.045 wherever the puddle field
is high. Polished water, exactly as the operator described it.

It is session 64's `block:ground` defect **one surface along**, found the same way and only the same
way — by somebody looking at a frame.

### 1a. SO THE QUESTION WAS ASKED OF EVERY SURFACE AT ONCE

`tools/roughcensus.mjs` — NOT A GATE, two halves, `landmarkcensus.mjs`'s arrangement. Half A greps
every mesh `src/**` constructs and matches it against a DECLARED table; half B walks the delivered
scene and reads each mesh's porosity **off its own buffer**, consulting no table, because a porosity
the generator chose and the attribute does not carry is exactly the disagreement being looked for.

```
  30 distinct surfaces, 39 construction sites, 0 UNCLASSIFIED
  1 where an impervious default is WRONG and no porosity was chosen — the ribbon
  4 named rows crossed between the two halves, 0 disagreements
```

An `itemSize` of 0, 1 and 2 are **three different findings and the census prints which**: no
attribute at all; the pre-session-55 `float`, whose `.y` is the generic default and which every
instanced prop in this project carries; and a porosity somebody chose.

**AND THE REST OF THE COUNTRYSIDE HAD ALREADY CHOSEN ONE.** The verges, the farm plots, the villa
plots, the drives, the lay-bys and the six skirt rings all carry one — the ground rectangles through
`city.js` → `porosityFor` and the terrain and skirt through `block.js` → `groundPorosity`, which is
the same `farmCrop` the tint reads. **The ribbon was the only one left.**

Delivered after the repair: `block:road:main` `0.00..0.70`, **0.70 × 1 434 vertices, 0.00 × 12** —
the twelve being the two quads either side of the city's edge and the one long quad across the
middle, which is the city's own arterial and is right to be a mirror.

### 1b. THE VALUE IS 0.70 AND IT IS A TEXTURE DEPTH

Session 55 derived every porosity in this project as `min(1, K/R)` — an infiltration capacity over
`RAIN_FULL_MMH` = 10 mm/h. **That derivation returns 0.00 for every sealed surface**, because
asphalt, concrete and paving are all definitionally zero, so it cannot separate a city arterial from
a rural chip seal at all. It does not disagree here; it is silent here.

Session 55 wrote the other derivation down in the same comment and set it aside — *"a road film is a
few tenths of a millimetre against dense asphalt's 0.4–0.8 mm mean texture depth"* — for the stated
reason that *"two derivations for one constant is one too many"*, which is a rule about a constant
BOTH of them answer.

The mirror is the water–air interface, and it is a mirror where the water forms a continuous sheet
ON TOP of the texture rather than sitting inside it. For a sheet depth `d` under the texture depth,
the plan fraction standing proud goes as `d / MTD`, so taken as a RATIO against a reference surface
under the same rain **`d` cancels** and only the sand-patch mean texture depths remain:

```
  surface                        MTD mm    sheen    porosity
  dense-graded city asphalt      0.4-0.8    1.00       0.00   <- session 55's anchor
  surface dressing, rural        1.5-2.5    0.30       0.70   <- this road
  a mown sward                    20-50     0.017      0.98   <- THE CHECK
```

**THE SWARD IS A CHECK AND NOT A FIT.** Session 55 set turf to 1.00 from infiltration alone, ten
sessions before this line existed, and this model gives 0.983 — within 1.7%. Two derivations, one
number, and neither was made to agree with the other. Where they DO diverge is bare soil (0.85
against about 0.95 at a tilled seedbed's random roughness), so the relief model is used for the
SEALED class only and session 55's table keeps everything else.

Sensitivity across the class: MTD 1.5 → 0.60, MTD 2.5 → 0.76. **The answer is 0.60 to 0.76 and 0.70
is the centre of the class**, not a point somebody liked inside a range.

**AND IT DARKENS.** `lights.js` reads the FILM and not the sheen for the darkening, deliberately —
wet grass is darker than dry grass and so is wet asphalt — so the country road still goes to
`SURFACE.wetDarkening` = 0.5 of its dry diffuse in the rain. What 0.30 of remaining sheen buys is
glossy and damp instead of polished: on the deepest puddle the delivered roughness goes
**0.045 → 0.417**, a factor of 9, and on the plain film **0.286 → 0.576**.

**`noctisRough.z` IS STILL FREE.** The brief noted it and said it was not an instruction; nothing
here uses it.

### 1c. AND THE FIRST ARM PUT IT ON THE WRONG SCHEDULE, WHICH THE FRAME CAUGHT

It ramped the porosity over `EXIT_ROAD.taperM` on the reasoning *"the surface changes where the
section changes"*. **`taperM` = 200 m is `4.0 m × 50`, the standard 1:50 rate for narrowing a
carriageway** — a rate of change of WIDTH, borrowed to schedule a MATERIAL. CONTRACT §9's own shape,
and it is a row in that table now.

The operator stands 28 m past the edge, where that ramp delivers **0.098**, so the near half of the
frame he complained about was still a mirror after the repair, and `country-car-s65-road` shows it:
worst residual **−24.6 code values** against −33.3 before and −2.2 after. It steps at
`CITY.extentEdgeM` now, which is where the maintaining authority changes and is the datum the whole
road is already measured from. The step is drawn 8 m wide because the attribute is per-vertex and
the stations are 8 m apart — the mesh's resolution stated as a limit, not a design.

---
## 2. ITEM 2 — THE SHARED TRANSFORM, AND THE PREMISE THE CENSUS KILLED

### 2a. THE ENUMERATION, WHICH IS WORTH MORE THAN THE REPAIR

`tools/featurecensus.mjs` — NOT A GATE. `city.js`'s feature loop is ONE closure, `put`, taking ONE
`worldSurface(f.x, f.z).y` sample at a feature's centre and composing a yaw and nothing else.

```
  20 kinds, 118 put() calls
  269 189 features over an 8.8 km square
    241 117 inside CITY.extentEdgeM        28 072 outside it
  29 400 stand where the normal is not exactly vertical
    of those, 1 328 are INSIDE the disc, worst 0.476 deg
```

**THE 1 328 ARE THE INSTRUMENT'S OWN FOOTPRINT AND NOT A HOLE IN THE GUARANTEE.**
`terrainNormalAt` is a central difference at `TERRAIN.stationM / 2` = 16 m, so a query 16 m inside
`rampStartM` straddles the flat disc and one of its four samples is outside. The HEIGHT at those
points is still exactly 0. `block.js`'s ground mesh has always known this — its `push()` read
`h === 0 ? (0,1,0) : terrainNormalAt(...)` — and that test is `citygen.js` → **`groundNormalAt`**
now, so the mesh and the transform read one function instead of two spellings that can drift.

### 2b. PREMISE (ii) IS FALSE, AND THE MEASUREMENT SAYS SO

The brief's premise is that the floating houses and the 5 174 hedgerow ends are ONE mechanism.
**They are two**, and the census's `stands on` column is what separates them:

```
  edge:hedge   stands on `earth`, the terrain mesh itself. ~92% of the total
               departure from the ground in every view, and 94-98% of it is
               explained by the ground's own gradient at the feature's centre.
               A PITCH removes it.
  villa:       stands on `grass` — its own plot rectangle, which citygen lays
               FLAT at one `yAdd`, because a house's plot IS a terrace cut into
               a hillside. PITCHING A HOUSE ON A LEVEL TERRACE WOULD TIP THE
               HOUSE. Its corners hang off because the PLATE is too small.
  lamp:head    17 of 17 over 0.05 m, at exactly 0.16 m, on a perfectly vertical
               post. That is BLOCK.kerbHeight and a claim that spans a kerb.
```

**AND THE HOUSES' OWN NUMBER, WHICH BRIEF 64 ITEM 1e ASKED FOR AND SESSION 64 DID NOT PRODUCE:**
a villa's worst drawn corner stands **p50 1.86 m and up to 6.00 m** off the ground under it, on a
45.7 m plan diagonal. Every one of the 23 pads floats over its own hillside (**0.32 to 2.97 m, 9 of
23 over 1 m**) and **19 of 23** have a ground-bearing box corner standing on nothing, worst 2.54 m.
The plot reaches 1.20 m short of the drawn house at yaw 0 and **3.89 m** at the delivered worst yaw.

### 2c. THE PITCH, AND IT IS MEASURED ON THE GEOMETRY AND NOT ON THE LANDSCAPE

`harness.boxGroundCensus` — every instanced box whose bottom face sits on the ground at its own
centre, worst bottom CORNER against the ground under that corner, off its own `instanceMatrix`.
Paired, same seed, same camera, same tree population:

```
                      boxes  over .05    p50    p90    p99    max   sum m
  inside  r <= 3232   15993      1106   0.00   0.01   0.18   1.07   221.5   before
  inside  r <= 3232   15993      1106   0.00   0.01   0.18   1.07   221.5   AFTER
  outside r >  3232    1000       528   0.09   1.57   2.73   3.69   451.6   before
  outside r >  3232    1000       311   0.01   0.52   1.70   2.39   145.6   after
                                 -41%   -89%   -67%   -38%   -35%    -68%
```

The six worst boxes in the scene were 12.0 m hedgerows before and are `river:structure` and one
building mass after — a different module, a different transform, and named rather than fixed.

**THE FIRST ARM MEASURED THE CAUSE.** `featureGround` reports how much the GROUND varies under a
footprint, which is a property of the landscape and which a pitch does not change by one millimetre
— so the A/B reported no improvement from a repair that works. Both quantities are printed now and
the file says which is which.

**INSIDE THE CITY IT IS A NO-OP BY CODE PATH AND NOT BY DATA.** `groundNormalAt` returns exactly
`(0, 1, 0)` wherever `terrainHeightAt` is 0, the `n[1] < 1` test fails, no quaternion is composed,
and `setMatrix` is called with `undefined` and produces the same float for float. The brief asked
for exactly that distinction and this is it.

**TWO GATES, AND BOTH ARE MEASUREMENTS.** The feature must stand on `earth`, and its kind must RAKE
rather than stand plumb — `PITCHES_WITH_GROUND` carries `edge`, `graves`, `spoil`, `hoarding` and
`parked`, and **its default is plumb** so a kind added later cannot start leaning by omission. A
leaning lamp post is a worse frame than the one it replaces.

**AND NOTHING GOES THROUGH THIS TRANSFORM ONTO THE ROAD** — 0 of 3 100 features stand on a surface
`worldSurfaceAt` answers `road` for, so the pitch may read the terrain without becoming the ribbon's
second datum. That is the brief's item 2d, answered by a count rather than by care.

### 2d. THE OTHER HALF — A TERRACE GETS ITS CUT FACE

`node tools/landprobe.mjs --plates`, new, over the same 8.8 km square:

```
  kind            plates  over 0.05      p50      p90      max   p90 span
  grass             2 383      1 630     0.13     1.06     6.21      61.1
  yardGround          385        359     0.54     1.23     3.98      43.3
  parkingGround        14          0     0.01     0.01     0.01       7.2

  2 782 plates carry a yAdd, 1 989 stand over 0.05 m off the ground at their
  own edge, over 1.36 km2 of surface.
```

Session 62's own comment says a `yAdd` rectangle is a TERRACE and that a terrace is flat by
definition, and that is right. What nobody had measured is how far its EDGE stands off the ground
beside it — which is session 45's kerb finding one scale up: *"Two horizontal quads at different
heights abutting in plan leave a vertical slot, and from a standing eye you look straight through
it."*

The repair reuses session 45's own `riser`. **Downhill only**, because where the terrain stands
higher the ground already covers the gap and a riser there would be a wall in somebody's garden.
Split on the terrain's own 32 m station, so a 68 m farm yard's face follows the ground rather than
stepping once at each corner. **Nothing in `rects`** — session 45's rule, because a riser is not a
surface anything stands on. Inside the city no ground rectangle carries a `yAdd`, so the branch is
not taken and the mesh is byte-identical by code path.

**AND THE FACE'S COLOUR TOOK TWO ARMS.** `GROUND.earthAlbedo` is a defensible answer to *"what is a
hillside made of"* and it delivered **a pale 0.16 m line along both sides of the country road for
its whole length** — earthAlbedo Y 0.1212 against a mown verge's Y 0.0837. A repair that closes a
hole and draws a kerb where a country road has none is not a repair. The face takes the plate's own
tinted albedo now and **no new number is authored at all**; `lights.js` already darkens a vertical
face because it sees less sky, and that is what makes the edge read.

---
## 3. ITEM 3 — THE HILL GETS CLOTHES, AND CHROMA WAS THE WRONG INSTRUMENT

### 3a. THE GRASS LINE, MEASURED FIRST

**The hill's own cover boundary has no line in it.** Scanning down through a hill foot in the
delivered aerial, Y runs 99.4 → 83.4 → 106.5 with no step over 3 code values per 10 px, and
saturation runs 0.330 → 0.402 monotone. `groundTint` blends the cover to the crop over `u`
0.60–1.00 and it works.

**The line the frame does have is the near-field crop boundary**: eight pixels carrying Y
123.8 → 157.6 (+27%) and saturation 0.128 → 0.220 (1.72×).

**AND IT IS LUMINANCE.** `HILLS.hillAlbedo` Y 0.0876 against `field` Y 0.1722 is 1.97× in albedo;
ACES at that exposure predicts 1.28× in delivered code values and the frame measures **1.28×**.
Their SATURATIONS are 0.348 and 0.495 — **1.42×**, where session 64's `yardGround` pad was six to
seven times flatter in chroma than everything it abutted.

**Session 64's chroma instrument answered its own question and does not answer this one**, and there
is no colour here to repair. What was missing is the vegetation.

### 3b. PREMISE (iv) IS TRUE AND THE PLACEMENT IS THE WHOLE OF IT

The same `PROP_MODELS.tree`, the same four variants, the same `PROP_SCALE`, the same lean, the same
`claimAt('prop')` offer to the registry, the same `propMatrix` base query. No new geometry, no new
mechanism, no new material, and a tree on a hill rides the chunk's own box mesh exactly as a tree on
a verge does.

```
  8 169 -> 14 262 trees over an 8.8 km square                       +6 093
  a candidate every 16 m, jittered inside its own cell — 39/ha at p 1
  p 0.22 on scrub (8.6/ha), p 0.62 on a wooded mass (24/ha)
```

**A PROP IS A CLUMP AND NOT A STEM**, which is what decides the number: a tree here is five or six
boxes with a 2.7–5.8 m crown, and closed-canopy conifer at 400 stems a hectare would be 15 600 of
them. Both numbers sit inside the 10–50 per hectare that wood pasture is described at.

**AND THE DENSITY FALLS ON `groundTint`'s OWN `u` RAMP**, not on a slope threshold — so the trees
stop exactly where the scrub colour stops and a hill's foot is a thinning band of clumps running
into a field. One description, two consumers. The brief asked for *"radius and slope"* and the
measurement says radius carries it: the cover band IS the ground no plough reaches, and outside
`u = 1` the ground is a crop parcel by construction.

**THE CITY IS BYTE-IDENTICAL.** 1 908 chunks lying wholly inside r ≤ 3 232 m hash
`6f192b75fb42ae2a5545ca17` in both arms. That needed one line, and a measurement put it there: over
an 8 km grid at 8 m spacing, **`hillSurfaceAt` returns non-null as far in as r = 3 227.5 m**, 4.5 m
INSIDE `CITY.extentEdgeM`, because it is a FOOTPRINT test while the zero-height guarantee comes from
the RAMP. The two are not the same statement. The scatter reads `TERRAIN.rampStartM` directly, which
is the datum `groundTint` reads, so a tree can never stand on ground with no cover painted under it.

Only the resident detail ring carries props, so a hill two rings out is still bare. That is the
streaming ring behaving as it always has, and it is what the aerial shows.

---
## 4. ITEM 4 — MEASURE ONLY, AND PREMISE (iii) IS FALSE BOTH WAYS

**THERE ARE NO SHADOW CASCADES IN THIS PROJECT AT ALL.** One `DirectionalLight`, one orthographic
shadow camera: left/right/top/bottom **±170 m**, near 1, far 704, a 4096² map, texel-snapped at
83 mm and following the camera. Against a ground plane that runs to `TERRAIN.skirtM` = 10 000 m that
is **58.8×**, and `block:ground` never sets `castShadow` at all — so no shadow of any kind reaches
the middle distance, twice over.

**NOR IS IT THE RINGS.** The skirt's boundaries are concentric circles about the origin at
**4 128, 4 384, 4 896, 5 920 and 7 968 m** (widths 128, 256, 512, 1 024, 2 048 and a clamped
2 032). The bands appear inside 4 000 m, where there are no rings, and they are not arcs.

**IT IS THE LANDFORM, SHADED.** `TERRAIN.longPeriodM` = 1 024 m at `longAmpM` = 13 m is a maximum
slope of 4.56°, and `shortPeriodM` 384 at 5 m is 4.69°. Measured in one fixed strip of the delivered
aerial with nothing changed but the clock:

```
  t 0.30   sun 18.84 deg    sd 27.67 code values    sd/mean 0.2244
  t 0.42   sun 48.88 deg    sd  3.25               sd/mean 0.0289
  t 0.50   sun 57.91 deg    sd  1.95               sd/mean 0.0172
```

A **14.2× fall in band amplitude, monotone in sun elevation**. An albedo pattern does not do that.
The ratio is not modelled against Lambert because the sky's own hemispherical term is in the
denominator and its share moves with elevation too; the direction and the monotonicity are the
finding.

**NOT FIXED, AND THERE IS NOTHING TO FIX.** The operator's *"they do not read as terrain"* is a look
judgement and a fair one: 13 m of relief over 1 024 m is **1.3% of its own wavelength**, so at 180 m
there is no silhouette cue at all and only a 2.9% shading cue at `t = 0.42`. At `t = 0.30` it reads
unmistakably as land (`tools/shot-out/country-air-s65-band-t0_3-wet.png`). Anything that changed it
would be a change to the LANDFORM's amplitude, not to a renderer, and that is a look decision nobody
has taken.

---
## 5. THE BRIEF'S FOUR PREMISES

| | premise | verdict |
|---|---|---|
| (i) | `noctisRough` does not reach the road ribbon, for the same reason it did not reach `block:ground` | **TRUE**, and measured rather than inspected: `itemSize` 0 on 482 delivered triangles. §1 |
| (ii) | the floating houses and the 5 174 hedgerow ends are ONE mechanism | **FALSE.** A hedge stands on the terrain and has no pitch; a villa stands on a level plot that is too small for it. Two defects, one symptom. §2b |
| (iii) | the bands are shadow cascades rather than the rings' gradient | **FALSE BOTH WAYS.** There are no cascades, the one shadow box is ±170 m of a 20 km plane, `block:ground` never casts, and the rings are concentric circles the bands are not. It is the landform. §4 |
| (iv) | hill vegetation needs no new mechanism, only placement | **TRUE**, and the placement declares nothing and draws nothing new. §3b |

---
## 6. THE COST

**NOTHING THIS SESSION ADDED IS INSIDE A GATE ROUTE, AND THAT IS A FACT ABOUT THE ROUTES RATHER
THAN A LICENCE.** All four `perfcheck` routes run inside the city; the road's surfacing steps at
`CITY.extentEdgeM`, the feature pitch is a no-op inside it by code path, the trees are refused
inside `TERRAIN.rampStartM`, and no ground rectangle inside the city carries a `yAdd`. So the
ceiling's own numbers are unchanged by construction, and `highway_speed` says so to the instance:

```
                   session 64     session 65
  draw calls          401            401        of 440
  triangles          2.45 M         2.45 M      of 2 630 000
  instances         347 833        347 833
```

**WHAT IT COSTS WHERE IT IS VISIBLE IS NOW A NUMBER**, because `lookat` prints the triangle count:

```
                                     draws   triangles
  country-air   before this session     79     579 832
                after item 3            83     587 932      +8 100  the trees
                after item 2d           83     588 080        +148  the cut faces
  country-car   before this session     85     567 476
                after item 3            86     568 448        +972
                after item 2d           86     571 634      +3 186  the verges' own faces
```

`block:road:main` gains no triangle at all — a `noctisRough` vec2 over 1 446 vertices is 11.6 kB of
buffer and nothing else. The pitch gains none: it is a quaternion composed into a matrix that was
already being composed. **About 180 000 of headroom is still under the ceiling** and this session
spent none of it where the ceiling is measured.

**THE CEILING LIVES IN TWO PLACES AND BOTH ARE UNTOUCHED.** `budget.json` and `HUD.budgets` are
byte-identical and `perfcheck --falsify` still runs its 74 cases at 100% coverage.

---
## 7. GATE STATE

**THE BATTERY RAN TWICE**, because two inert cleanups landed after the first one and CONTRACT §10
asks the gates of the source that ships. The second is the verdict; the first is a second draw and
§8 item 6 is what it bought.

```
  gate            exit   verdict   seconds  load1 in     out
  parsecheck         0     GREEN       3.9      3.33    3.33    122 files, contract-clean
  faultcheck         0     GREEN      28.3      3.33    4.30    7 cases, quarantine surgical
  lookcheck          1       RED      51.8      4.30    4.78    THE IDENTICAL THREE
  windcheck          0     GREEN      41.3      4.78    4.97    570 meshes, 0 wound backwards
  inputcheck         0     GREEN      17.4      4.97    5.20
  gateaudit          1       RED      79.4      5.20    4.20    the carried `control failed`
  citycheck          1       RED     128.2      4.20    4.87    IDENTICAL TO SESSIONS 57-64
  perfcheck          1       RED    1097.1      4.87    4.68    AND IT FINISHED AGAIN

  4 of 8 RED — the same four as sessions 53-64. NOT ONE NEW RED GATE.
```

**`perfcheck` RAN TO COMPLETION TWICE**, 1 099 s and 1 097 s over all four routes, where sessions
61, 62 and 63 each had it die in the browser. Session 64 was the first time it finished; this is the
second and third. Nothing was done to make that happen and no conclusion is drawn from it.

**`lookcheck` IS RED ON THE IDENTICAL THREE** — `distinct:midnight|dusk`, `facadeAlbedo` and
`facadeNeighbours`, all at dusk. Both look eyes stand inside 400 m of the origin, where the terrain
is exactly zero by session 64's guarantee, and this session put nothing inside `CITY.extentEdgeM`
except a `noctisRough` attribute on the ribbon whose delivered value there is the same `(0,0)` the
generic default was. **The msd itself is §8 item 6 and it is the loudest thing in this section.**

**`windcheck` IS GREEN OVER 570 MESHES**, 566 ok, 0 wound backwards, 0 unmeasured, and its four
§7.3 controls still land good/bad/good/bad. The terrace faces this session added are `riser`'s own
winding, derived rather than tried, and no gate route sees one — so that is a statement about the
routes and not about the faces.

**`gateaudit`'s only failure is `control failed`** — the three above, reported as the unperturbed
frames failing their own gate. Every falsify suite at full coverage: `perfcheck` 74/74 at 100%,
`citycheck` 67/67 at 100%, `inputcheck` 13/13 at 100%.

**`citycheck` IS BYTE-IDENTICAL TO SESSIONS 57–64 ON ALL FOUR REDS AND ON EVERY COUNT** — clumping
CV **0.393**, **5** delivered forbidden overlaps, **2 of 2 647** signs inside a building, **1 004 of
284 918** bare walkable samples, **344** instanced meshes, **block_markings 252**. And the one the
brief named as a constraint: **18 799 generator claims, 19 087 delivered.** The occupancy registry
is untouched and arm A stands.

**EVERY `perfcheck` VIOLATION IS CARRIED OR IS A TIMING ABSOLUTE FROM A LOADED MACHINE.**

- Every CPU and wall-clock red, at `load1` **4.87** against CONTRACT §0.2's bar of 1.6 — including
  the `N frames over 33 ms` counts, which are counts OF a timing and are contaminated the same way.
  `highway_speed`'s wall p95 reads 12.90 in the first battery and 13.10 in the second, against a
  12.5 ceiling, on identical source: **0.20 ms of drift between two runs of the same build**, which
  is §0.1's own incident restated.
- The vehicle silhouette bars, which LOOK.md §4 names in as many words. They also move run to run
  because the vehicles in frame differ — the first battery measured **75** vehicles and failed three
  bars, the second measured **63** and failed two, and they are not the same two.
- The frame-entropy straddle, which STATE 54 already recorded as a straddle: `downtown_dense` 4.954
  then 4.934 and `night_rain` 5.012 then 4.946, against a floor of 5. **The two batteries disagree
  about which of them is red**, on identical source, which is what a straddle looks like from the
  inside.
- `headroom probe` 22.60 ms at 1.5×, carried, and its own defect — `neverExceedNative` clamping the
  render scale so it shades the same pixels twice — is untouched and is why its number is not
  evidence of headroom whatever it says.

---
## 8. WHAT TO DO FIRST NEXT TIME

1. **A VILLA'S PLOT IS STILL SMALLER THAN THE HOUSE STANDING ON IT (§2b).** §2d's cut face closed
   the floating-plate half — the terrace has a face now instead of open air — and the overhang is
   untouched: the drawn villa reaches **1.20 m past its plot at yaw 0 and 3.89 m at the delivered
   worst yaw**, and **19 of 23 houses have a ground-bearing box corner outside the rectangle**.
   STATE 64 §9 item 4 costed the trade and nobody has taken it: sizing the pad to the rotated extent
   — the `|cos|·L + |sin|·W` this file already carries five times, and which the registry's own
   claim already uses — takes the plate to 1 119 m² and an 11.15 m corner span, against a slope
   guard derived for a 6.78 m platform. **Both numbers are on record and the trade is the
   decision.** A third arm nobody has costed: leave the plate and pull the villa's own crossing slab
   and boundary wall inside it.

2. **EVERY COUNTRYSIDE GRASS RECTANGLE STANDS 0.16 m PROUD OF THE FIELD BESIDE IT, BY
   CONSTRUCTION** — and §2d made it visible rather than a hole to look through. `GROUND_Y.grass` is
   `BLOCK.kerbHeight − 0.02`, a KERBED LAWN's datum, and the verges, the farm plots, the villa plots
   and the country-house gardens all use it. Measured, face heights by plate size: the p10 of every
   class is about 0.08 m and the small plates' p50 is **0.170 m**, on ground whose own gradient
   explains none of it. **A country verge has no kerb.** The fix is a datum, not a face, and it
   moves every countryside rectangle by 0.16 m — which is why it is written down here rather than
   taken at the end of a session.

3. **THE HEDGES THAT STAND ON A LAID RECTANGLE, WHICH THE PITCH DOES NOT REACH (§2b).** Measured
   per view: **432 to 817 `edge:hedge` segments stand on `ground` rather than `earth`** — a verge or
   a farm plot — with errors to **9.50 m** and only 10–22% of the departure explained by the
   ground's gradient. Their base is a flat rectangle and the step is at the rectangle's own edge, so
   it is item 2's other class: the same defect as the villa, one object down.

4. **THE BELOW-HORIZON FILL IS 1.34× THE GROUND IT STANDS IN FOR.** Carried from STATE 64 §9 item 2,
   untouched and unexamined. One quantity doing two jobs — the visible backdrop past the plane edge
   and, through PMREM, the only thing lighting every downward-facing surface in the city — and still
   the most dangerous entry on this list. It wants its own session with `lookcheck` as judge.

5. **THE FRAME TIME AND THE `frustumCulled = false`.** Carried from STATE 63 §8 and 64 §9 item 3,
   and larger again: `block:ground` carries the terrain, the skirt and now the terrace faces, and is
   still submitted whole every frame. Tiling costs draw calls and there are 39 spare. First thing to
   measure on a quiet machine — and this machine has not been quiet for five sessions.

6. **`lookcheck`'s `distinct:midnight|dusk` IS NOT A CONSTANT AND THREE STATES HAVE SAID IT IS.**
   The brief asked for that number moving to be reported loudly. It moved, and then it moved back.
   Paired and interleaved A B A B against session 64's head in a `/tmp` worktree, which is
   `routeprobe`'s own arrangement for exactly this:

   ```
     pair            s65        s64      difference
       1          0.02837    0.02838      -1e-5
       2          0.02837    0.02836      +1e-5
       3          0.02837    0.02838      -1e-5
     mean paired difference  -0.33e-5,  standard error 0.67e-5

     every draw taken this session, one source each:
       s65 head   0.02837 0.02838 0.02838 0.02837 0.02837 0.02837 0.02836   range 2e-5
       s64 head   0.02836 0.02837 0.02838 0.02836 0.02838                   range 2e-5
   ```

   **Both builds span the same 2e-5 and their means are half a standard error apart.** Nothing
   moved. What has been reported as a constant for three sessions is ONE DRAW A SESSION read to a
   decimal the instrument cannot resolve — CONTRACT §0.1 rule 6, in the place three STATEs have used
   as the control that says nothing changed. The VERDICT is unaffected: the margin to the 0.03 floor
   is 1.63e-4, eight times the observed range, so the red is real. **It is the fifth decimal that
   should stop being quoted as though it were evidence.**

7. **NOTHING PAST 3 232 m IS INSIDE ANY GATE, AND THERE IS MORE OUT THERE EVERY SESSION.** Carried
   from STATE 61 §7 through 64. The terrain, the crops, the hills, the villas, the farmsteads, the
   skirt, the road's surfacing, the feature pitch, the terrace faces and 6 093 trees are all outside
   every assertion in this project. `landprobe`, `slopeprobe`, `roughcensus` and `featurecensus` are
   probes and say so in their own headers.

8. **`hillSurfaceAt` REACHES 4.5 m INSIDE `CITY.extentEdgeM` (§3b).** New, measured, and harmless
   today: r = 3 227.5 m against 3 232. It is a FOOTPRINT test while the zero-height guarantee comes
   from the RAMP, and the two have been read as one statement since session 64. The tree scatter
   reads `TERRAIN.rampStartM` because of it; nothing else that asks `hillSurfaceAt` has been checked
   against this.

9. **THE PEDESTRIANS FOLLOW THE CAMERA ONTO A HILLSIDE**, carried from STATE 63 §9 and 64 §9 item 7
   — and `tools/shot-out/villa-t0_42-wet.png` is full of them, standing on a hill shoulder 3.5 km
   from the nearest pavement.

10. **THE 49 CONSTANT-READING GROUND SITES**, carried from STATE 63 §4 and 64 §9 item 6.
    `traffic.js` writes four vehicle y values with no ground query; `weather.js` carries its own
    shadow `GROUND_Y`; `player.js` has a fallback of literal `0`. All latent while terrain is zero
    inside the extent, and `block.js`'s markings were the fiftieth.

11. **CARRIED, UNCHANGED**: the height law reads nothing at all (STATE 61 §4); the traffic has no
    lane that is not a lattice line; `city.js`'s `unitHash` puts the multiplier inside the sine; the
    three chunk seams; the 53 holograms; the school yard's 8 trees and the church square's 98.

12. **AND WHEN A NEW INSTRUMENT REPORTS A PERFECT WORLD, SUSPECT THE INSTRUMENT.**
    `featureGround`'s first arm held `city.worldSurfaceAt`'s shared transient across a second call —
    against a comment three lines long saying *"copy what you keep"* — and reported **0.00 m for
    6 078 features including 424 on hill shoulders**, when session 64 had independently measured a
    hedgerow median of 1.04 m. It was caught by that other session's number and by nothing else.
    `slopeprobe` has now been wrong in both sessions it has run, `featureGround` was wrong in its
    first, and `roughcensus`'s own first arm filed three meshes as UNCLASSIFIED for a regex reason
    that had nothing to do with them. **A new instrument's FIRST answer needs a second source,
    always.**

13. **`decodePNG` RETURNS THREE BYTES PER PIXEL.**
