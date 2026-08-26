# NOCTIS — STATE

*End of session 43. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2 (24C101), `node v22.22.0`. The
machine has **NOT** rebooted since session 40 — 7 d 20 h of uptime at the last command against
session 42's 7 d 2 h, the same boot. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` RANGED 2.75 TO 4.06 ACROSS THE SESSION*** against CONTRACT §0.2's bar of **1.6**, and it
was never inside it — this was a browser session from end to end and the memory note's own warning
applies (*"one headless Chromium renderer measures 130% CPU"*). **No millisecond in this file is
admissible as an absolute.** What is quoted is COUNTS, PAIRED deltas measured minutes apart in
interleaved arms, pixel statistics, and figures straight out of the pure generator with no browser
at all.

---

## 0. FOUR ITEMS, FOUR COMMITS, FOUR BEFORE-AND-AFTER PAIRS

**THE HARD CONSTRAINT WAS ONE SPARE DRAW CALL AND IT IS STILL SPARE.** `highway_speed` read
**439 of 440 at HEAD and 439 of 440 after all four items.** Nothing here bought a draw call,
including the transparency in item 4 — see §4 for the form that avoided it.

```
 1  THE AIR IS NOT LIT BY THE CITY IN IT              LOOK.md §3, haze around light
      s43-haze-{before,after}-t0-wet.png              midnight, wet, on the carriageway
      the mechanism was missing and is now there; at 8.7 km visibility it is 1.6%
      darkest large surface        8.73  ->  9.43 cv    crushed black 1.158% -> 0.873%
      draw calls                    294  ->   294

 2  THE WALLS ARE SMOOTH BOXES                        LOOK.md §4/§5, encrusted facades
      s43-wall-{before,after}-t0_5-wet.png            the same elevation, cropped
      pipes, cable runs, condensers, louvres, ducts, cabinets, dishes, fire escapes
      boxes on the resident ring       0  ->  7 010    fire escapes 0 -> 104
      draw calls                    439  ->   439

 3  NO SIGN IN THE CITY REACHED SIX STOREYS           LOOK.md §3, sign scale
      s43-sign2-{before,after}-t0-wet.png             midnight, wet, down a street
      the same blade, most of the way up the wall it hangs on
      tallest sign               14.24  ->  23.99 m    >= 18.3 m: 0 -> 10 of 975
      signs wider than their own building   2  ->  0
      draw calls                    147  ->   147

 4  THE CITY HAS NOTHING LIKE A HOLOGRAM              LOOK.md §3, holograms
      s43-holo2-{before,after}-t0-wet.png             midnight, wet, at a junction
      two of them at two depths in one frame, cold, and you see the wall through them
      holograms                       0  ->     42 resident, 53 over the region
      draw calls                    295  ->   295
```

**ALL FOUR WERE MEASURED BEFORE THEY WERE BUILT**, and in two of them the measurement changed what
was built: item 1's arithmetic said the effect would be invisible before a frame was taken, and
item 3's first arm delivered zero of its target and had to be re-derived. §7 lists both.

---

## 1. THE MEDIUM WAS LIT BY THE SKY ALONE, AND AT MIDNIGHT THE SKY IS NOT WHAT LIGHTS IT

`lights.js`'s haze block has been headed **"THE MEDIUM IS LIT BY WHAT IT CAN SEE, AND IN A STREET
THAT IS NOT THE SKY"** since session 27 — and then lit the medium by the sky alone, scaled DOWN by
the canyon's openness, with nothing standing in for the light the openness factor removes. The
city's own lamps were never in the integral.

They are now, in the same single-scattering model and evaluated exactly rather than marched. Along
the view ray, a source at L contributes

```
    L_in = rho_s . p . I . (1/h) . [ atan((t1 - t0)/h) - atan((t00 - t0)/h) ]
```

with `t0 = L.v` the source's projection onto the ray, `h` its perpendicular distance from it, and
`[t00, t1]` the part of the segment inside the light's own declared radius. Two atans and a divide
per light, no step count to budget.

**THE HALO IS THE 1/h AND NOTHING IS AUTHORED TO PRODUCE IT.** A ray passing close to a lamp
integrates a large 1/r² over its whole length and one passing wide does not. Three decisions are
worth recording beside it:

- **Isotropic phase, 1/4π, and it is a consistency argument.** The sky in-scatter forty lines below
  mixes the sky's radiance in with no phase function at all. Two halves of one haze with two phase
  functions are two atmospheres, and the closed form is exact only for a phase that does not vary
  along the path.
- **Bounded to the light's own radius.** The direct term windows at `d0.w` and stops; an in-scatter
  integrating 1/r² to the horizon would be one light with two ranges, which is CONTRACT §9's shape
  with a falloff radius.
- **The cone and the batwing at the closest point.** Without the cone a downlight glows as a
  sphere. Without the batwing the air directly under one is `(1/peakCos)³` too bright.

### 1.1 ZERO DRAW CALLS, AND AT THIS CITY'S DECLARED AIR IT IS 1.6%

Paired, same tree, same pose, minutes apart: **294 draws at HEAD and 294 after.** No instance, no
triangle, no pass — it is ALU in a shader that already runs.

**AND THE ARITHMETIC SAID IT WOULD BE INVISIBLE BEFORE A FRAME WAS TAKEN.** A ray passing 9 m from
a 6 800 cd lantern collects **0.022 cd/m² against a road at about 1.4 — 1.6%.** That is not a
shortfall in the model:

> **A METEOROLOGICAL VISIBILITY OF 8.7 km MEANS A STREET LAMP HAS NO HALO.**

`ATM.hazeDensity` is 4.5e-4 /m and its own comment calls that *"an ordinary night in a city rather
than a smog event"*. It is right, and the consequence is that the term is real and sub-threshold.

**THE PATH IS LIVE AND THAT WAS CHECKED RATHER THAN ASSUMED** — CONTRACT §7.1, a check gone quiet
being indistinguishable from one that passed. An arm at **40×** was rendered in a disposable
worktree: every lantern in it carries a cone on the wall beside it, and the frame also washes out,
which is the global lift LOOK.md §3 refuses. So the mechanism works and the density is what it is.

What 1× delivers, measured on the delivered frames rather than argued:

```
    the darkest large surface in the frame      8.73  ->  9.43 cv    +8.1%
    the wall under the nearest lantern         37.43  -> 37.43 cv    +0.0%
    the whole frame                            34.25  -> 33.87 cv    -1.1%
```

**THE WHOLE FRAME GOES DOWN BECAUSE THE AUTO-EXPOSURE PAYS FOR WHAT IS ADDED.** 64% of pixels are
darker and 12% brighter. That is `exposure.js` doing what §5.4 says it does, and it is also why a
haze term that merely raised everything would achieve nothing: only a term with STRUCTURE survives
adaptation. This one has it — it lifts the dark and leaves the bright alone.

### 1.2 THE LOOK BANDS: TWO OF FOUR MOVED BY EXACTLY NOTHING, AS PREDICTED IN THE CODE

`lookcheck`, three runs a side, run-to-run spread 0.0001 on every band:

```
    band:noon       0.4288 -> 0.4288    0.0000   photocell off, no local light
    band:dawn       0.3020 -> 0.3019   -0.0001   ditto
    band:dusk       0.1393 -> 0.1393    0.0000   red before, red after, same 0.0007
    band:midnight   0.0753 -> 0.0741   -0.0012   green, margin 0.0033 -> 0.0021

    crushed black at midnight  1.158% -> 0.873%  of a 2.0% ceiling
    frame sd at midnight       0.1394 -> 0.1375  floor 0.126
```

The two bands with no street lighting in them moved by nothing, which is the prediction written
beside the code. **NO BAND WENT RED AND NOTHING WAS RE-DERIVED** — the brief's §7 discipline was
prepared for and not needed. The one statistic that moved the way anybody asked is the crushed
black: **a quarter of the frame's black clipping is gone**, which is the term lifting the darkest
air-filled pixels and is what "the street has depth" is made of.

### 1.3 WHAT IT CANNOT DO, AND BOTH HALVES ARE FINDINGS

**THE LEVER IS THE AIR'S DENSITY AND THE CITY ALREADY DRIVES IT.** `weather.js` → `hazeFor`
multiplies `hazeDensity` by up to **4.46× at full rainfall**, which is LOOK.md §3's own *"denser
where the air is dirtier"* as a mechanism rather than a wish.

> **NOTHING IN THIS PROJECT HAS EVER SET RAINFALL.** `night_rain` is a route with `wet: 0.85` and
> **no rain in it**; `rainfall` is not a CONTRACT §6 parameter and `createWeather`'s own default is
> 0. Every frame this project has ever taken is a frame in clear air.

**AND IT CANNOT LIGHT THE AIR AROUND A SIGN.** The 958 signs and every window are emissive
MATERIALS with no photometry attached — no candela, so there is nothing to integrate. The air glows
around the 192 lanterns, the 96 headlamps, the stall lamps and the block's shopfronts. That is a
fact about the light list and not a choice.

---

## 2. THE WALLS WERE SMOOTH BOXES WITH RECTANGLES DRAWN ON THEM

The only boxes on an elevation were the window lintel, the cill and the era's own spandrel or
mullion — all of which are the wall rather than things ON it. LOOK.md §5's device list has asked
for *"encrusted facades"* since it was written.

**IT IS DERIVED FROM `CITY_ERAS` AND NOT FROM THE GENRE**, which is §5's test applied to a wall.
Each era's storey height, window rhythm and ground treatment between them already say what a wall
of that period carries:

```
  prewar        grid, 4.3 m, shopfront      a fire escape, because it is OLD and was REQUIRED to;
                                            external stacks, because its plumbing came after it;
                                            NO ducting, because it is not air-conditioned
  postwar       band, 3.05 m, blankPlinth   a ribbon window, and the spandrel under a ribbon is
                                            where a through-wall unit goes
  corporate     vertical, 3.85 m, colonnade ducting, intake louvres, condenser banks — and NO fire
                                            escape, because protected internal stairs are exactly
                                            why it could be sealed
  infill        irregular, 3.45 m           a building patched over decades: a bit of everything
  contemporary  panel, 3.6 m, cornice 0     NEARLY NOTHING, and that is the point
```

`contemporary` is the one that would have been easiest to get wrong. It is the era whose written
identity is that it *"could not have been framed in 1960"*; encrusting it would erase the one
difference the era table exists to draw.

### 2.1 ZERO DRAW CALLS, AND THE COST IS INSTANCES

```
                       draws    triangles   instances   cpu p95        wall p95
    A  no clutter        439      2.06 M      302 599   10.70 11.20    11.90 12.40
    B  clutter           439      2.13 M      310 898   11.50 11.30    12.60 12.60
```

Interleaved **A-B-B-A** on one machine with nothing else running, which is the only admissible
form (the memory note's paired-worktree method: *a paired ratio is admissible where neither
absolute is*). **+8 299 instances, +0.07 M triangles against a 2 360 000 ceiling, and no draw
call.**

**THE CPU SEPARATION IS +0.45 ms ON THE MEANS AGAINST A WITHIN-ARM RANGE OF 0.50 (A) AND 0.20 (B)
— A DELTA THE SIZE OF ITS OWN NOISE**, which is CONTRACT §0 rule 6 exactly. `wall p95` read 12.60
against 12.5 on both clutter runs and 11.90 / 12.40 on both baseline ones; a 0.10 ms breach against
a stated run-to-run resolution of 0.40–0.80 is §0.1's original incident with a different content
change in it. **The final run of the session, with all four items in, read cpu p95 10.80 and wall
p95 11.90 — indistinguishable from arm A.** None of it is admissible at load1 3.13 and it needs
the operator's quiet battery; it is not claimed either way here.

An earlier reading of **17 frames over 33 ms** was two browsers running at once and did not
reproduce in any clean arm.

### 2.2 THE SMALL UNITS ARE ON `near` AND THE SILHOUETTES ON `detail`

`buildFacade`'s own sentence, one level down: *"facades, windows and signage are what a building
contributes at four hundred metres; a bollard, a lamp post and the join between the asphalt and the
kerb are not."* **A 0.3 m cabinet is the facade's bollard.** A stack, a duct run and a fire escape
have a silhouette — 1.7 m of steel at 384 m is twelve pixels at the internal resolution — so those
keep the detail ring. The split took the delivered box count over the resident ring from **13 411
to 7 010** and took them out of frames nobody can resolve them in.

Positions are on `buildFacade`'s OWN bay grid — `cols` and `colW` recomputed from the same
expression the windows use — so a pier kind lands on the solid between two openings and a spandrel
kind lands in the band above a window head. **One rotation convention throughout** (pre-swapped
scales, `bld.yawDeg` alone), because mixing the two put 24 907 fins through every east and west
elevation in session 13.

### 2.3 THE FIRE ESCAPE IS THE ONE THING DECLARED, AND THE GUARD HAS FIRED

Everything else projects at most 0.48 m into the first half-metre off a wall above 4.2 m, which
nothing in this city claims. An escape reaches 1.05 m over the pavement for six storeys, so its
PROJECTING part is claimed as `canopy` — `occupancy.js`'s own category for the part of a thing
above head height, which conflicts with solids and not with the footway under it. The wall face is
the claim's inner edge and `overlaps()` is strict, so an escape does not conflict with the wall it
is bolted to.

Delivered: **104 escapes over the resident ring, 0 refused at the lamprow camera and 1 refused at
the origin.** `citycheck` sees them — **272 `canopy` claims in the delivered sweep**.

**ITS BOUND IS STATED RATHER THAN ASSUMED.** A falsifying arm at **16 m of projection** refused no
more than the shipping 1.05 m does, because the extra depth reaches into a carriageway and a canopy
may cross one. What the guard can catch is a neighbour in the same chunk, the block keep-out and a
landmark claim — the same bound the ad pillar's own comment records for `placed`.

**Nothing here is below `HEAD_CLEAR_M`**: the band starts at the plinth, 4.2 m or 5.4 m over a
shopfront, so no box on any wall can be walked into and the pavement's occupancy question does not
arise.

---

## 3. TWO SIGNS WERE WIDER THAN THE BUILDINGS THEY ARE BOLTED TO

Measured straight out of the pure generator over `citycheck`'s own 10 × 10 at seed 1337 — no
browser, no GPU, so every number is a coordinate or a count.

```
                                        s34's city     before        after
    signs                                      692        958          975
    taller than wide                    0 (  0.0%)  111(11.6%)   107(11.0%)
    the tallest sign in the city            5.98 m    14.24 m      23.99 m
    >= 12.2 m   four storeys            0 (  0.0%)   9 ( 0.9%)   42 ( 4.3%)
    >= 18.3 m   six storeys             0 (  0.0%)   0 ( 0.0%)   10 ( 1.0%)
    >= 21.35 m  seven storeys           0 (  0.0%)   0 ( 0.0%)    6 ( 0.6%)
    building-scale signs                         —  22 ( 2.3%)   46 ( 4.7%)
      width / its own frontage, p50              —       0.79         0.67
      width / its own frontage, worst            —       1.37         0.85
      WIDER THAN THEIR OWN FRONTAGE              —          2            0
```

**AND THE 692 IS A COUNT OF A CITY THAT NO LONGER EXISTS.** LOOK.md §3 has quoted it since session
34; the population is **958**, because the roof signs landed afterwards and 428 of the 958 are
rooftop mountings. Corrected in place in LOOK.md rather than left to go stale a fourth time (§8's
own rule).

**THE OVERHANG IS CONTRACT §9's SHAPE WITH TWO WIDTHS.** `width` was an absolute `range(9, 17)` on
an elevation that is a `range(11, 27)` — two independent draws, one of which has to fit inside the
other. It is a FRACTION OF THE FRONTAGE now, using `ROOF_SIGN`'s own `widthFrac` construction and
its own numbers, so the roofline and the elevation can no longer say different things about the
same quantity. `along` is scaled by `1 − width/frontage`, which is a bound on where a sign may
stand rather than a shrink applied after the fact.

### 3.1 A BAND WHOSE TOP TOUCHES THE TARGET DELIVERS THE TARGET NEVER

This is the finding worth more than the table.

A first arm raised the blade aspect ceiling from 7.0 to **9.0**, at which the widest blade reaches
2.2 × 9.0 = 19.8 m and six storeys (18.3 m) is therefore *reachable*. **The generator delivered 0
of 975.** Only a near-zero-measure corner of the (width, aspect) square gets there: at A = 9.0 only
widths above 2.033 m qualify at all, and within them only the top sliver of the aspect band.

So the ceiling is solved from HOW OFTEN the target has to arrive instead. §3 asks for *"several at
different depths in one frame"* and `SIGN_BLADE.pTrading` already answers the same question with
the same population — **a frame down a retail street sees six to ten frontages** — so about one
blade in eight must be one. Over w ~ U(0.9, 2.2) and a ~ U(2.6, A):

```
    A =  9.0   P(w.a >= 18.3) = 0.007      A = 13.0   P = 0.158
    A = 12.0   P            = 0.114        A = 14.0   P = 0.201
```

**12.0**, and the delivered blade population is **10 of 107 over 18.3 m — one in 10.7** against the
one in 8.8 the solve predicted.

### 3.2 THE BIG ONES ARE WHERE THE TRADE IS

Session 28's roll doing the work it was built for. A building-scale sign is ADVERTISING and
advertising is bought where the people are; the blade got this conditioning in session 34 and the
building-scale sign never did — it was a flat 0.07 on any building over 30 m, which puts a
nine-storey sign on a quiet residential street. **0.20 trading / 0.09 on a retail frontage / 0.02
elsewhere**, and the last is not zero because a corporate tower carries its own name over the door
and that is identification rather than advertising.

The building population is 64.8% trading, 13.4% on a retail frontage without trading and 21.8%
neither, so the population-weighted probability is **0.146 against the old flat 0.07** — and the
delivered count doubled exactly as the arithmetic said, 22 → 46.

**NO DRAW CALL AND NO INSTANCE.** Signage is already one merged `city:signs` mesh; the paired
frames read 147/147 and 191/191 draws.

---

## 4. THE HOLOGRAM IS NOT A TRANSPARENT SURFACE, AND THAT IS WHY IT COST NOTHING

The brief's instruction was to measure before building and to say so with the number if it does not
fit. **The measurement was done first and it is the reason the form is what it is.**

> A transmissive surface needs `transparent: true` and a blend mode. That is a second MATERIAL,
> which is a second MESH even when it is merged city-wide the way `city:signs` is. **Exactly one
> draw call — and 439 of 440 means it is the only one left.**

So the third of LOOK.md §3's three properties is delivered LITERALLY instead of through alpha: the
panel is a **raster of emissive bars**, a 0.10 m bar on a 0.62 m pitch — 16% light and 84% air —
and you see the wall through it because nothing is there. It is also the honest form for the thing:
a projected image has no substrate, so what a volumetric display is made of is stacked planes of
light and not a sheet.

All three properties, checked against the section's own words:

```
  "it hangs in air nothing supports"        7.0 m up, off the END of the elevation, over the
                                            junction. Nothing under it and nothing beside it.
  "it is brighter than the wall behind it"  HOLOGRAM.nits 2600, which is 30 x LIGHT.signPlateNits
                                            and the gain the instance tint carries — the same
                                            arrangement the roof signs' own 11.63x uses.
  "you can see through it to the wall"      84% air, and the delivered frame shows the facade's
                                            lit windows between the bars.
```

**DERIVED, NOT SCATTERED.** A hologram is advertising, so it belongs where advertising is: over a
**corner shop at a junction**, which is the one retail position `RETAIL.corner` already models and
the one place on a street where people stand still long enough to read something. `p = 0.16 +
density · 0.30`, so a downtown junction carries one far more often than a junction a kilometre out.

**COLD BY CONSTRUCTION**, indexed out of the cold half of `SIGN_CHROMA` rather than written again.
LOOK.md §3 wants a third of emitters cold and session 32 measured the delivered emissive area at
8.0%; a projected image is a narrow-band source and this is the one new emitter population this
session adds, so putting it on the warm side would have moved the one number §3 is most emphatic
about in the wrong direction.

**IT FACES ALONG THE STREET, NOT OUT OF THE WALL**, which is session 14's own finding — the
mounting that reads from a pavement is the one perpendicular to the elevation — and it matters more
here than for a plate, because **a raster of horizontal bars seen edge-on is nothing at all**.

**IT IS CLAIMED AND IT IS COUNTED.** The panel's plan goes into `placed` as `canopy`, refused
rather than moved. `canopy × carriageway` is absent from `occupancy.js`'s FORBIDDEN on purpose, so
the outer 1.8 m of the widest panel hanging over the roadway at 7.0 m is allowed by the table
rather than by an exemption — which is what §3's *"above the street"* means. Holograms are in
`objectCount`, so `clumping` sees them; they land only on retail corners, so the direction is the
safe one.

Delivered: **53 over the region, 42 resident, 928 bars in `city:signs`, 0 refused.** **295 draws in
both arms.**

---

## 5. GATE STATE

Run individually, because `npm run gates` is `&&`-joined and stops at the first red.

```
  parsecheck   GREEN   112 files, contract-clean. Unchanged from session 42 — this session
                       added no file and its two scratchpad probes are outside the tree.
  faultcheck   GREEN
  windcheck    GREEN
  perfcheck    RED at 2, and BOTH ARE THE CARRIED VEHICLE ONES:
                 highway_speed  439 draws of 440   UNCHANGED FROM HEAD
                                2.13M tris of 2 360 000   (2.06M at HEAD)
                                312 006 instances  (302 599 at HEAD)
                 ✗ 65% of 23 vehicles have a dark gap at the ground (min 75%)
                 ✗ 65% of 23 vehicles carry a non-monotone tone profile (min 75%)
               No draw-call, triangle, memory or frame-time violation. Nothing this
               session touched a vehicle; see §9 item 1 on the spread.
  citycheck    RED at 3 — the SAME THREE as sessions 40, 41 and 42:
                 clumping CV        0.440 -> 0.443   (floor 0.60, untouched by instruction)
                 sign quads inside      2 -> 2       UNCHANGED under signs half again as tall
                                                     AND under 928 hologram bars: the DENOMINATOR
                                                     went 1792 -> 2720 and the numerator did not
                 delivered overlaps     2 -> 2       the same two, both adpillar x prop
               Bright reserve 6.11% -> 6.53% GREEN against 6.00 — MORE green, not less, which is
               session 42's own finding again: more lit content on a night route is more bright
               reserve. 8 landmarks placed, 8 visible from elevation, 0 unreachable on foot,
               worst detour 1.46x. No new violation of any kind.
  lookcheck    RED at 3 — band:dusk 0.1393, facadeAlbedo, facadeNeighbours. IDENTICAL
               before and after the haze, three runs a side. §1.2.
```

**THE GATES WERE RUN BEFORE THIS FILE WAS WRITTEN**, which is the brief's own instruction after
session 42 shipped two defects into a commit that its own gate then caught.

---

## 6. HOW EVERY FRAME IN THIS FILE WAS TAKEN

All at seed 1337, all `?paused=1`, all wet, all at 1.70 m on the street, and **every pose
ray-tested with `tools/poseprobe.mjs` and pinned with `--dmin` = `--dmax`** before the camera was
placed.

```
  1  node tools/poseprobe.mjs --target=8,8,90 --eye=1.7 --dmin=80 --dmax=80 --fov=55
     node tools/lookat.mjs --pos=1.03,1.70,169.70 --target=8,8,90 --fov=55 --t=0.0 --wet=1 \
       --name=s43-haze  --tag=<before|after>
  2  the same pose, --t=0.0,0.5 --name=s43-wall --tag=<before|after>
  3  node tools/poseprobe.mjs --target=-97,20.9,521 --eye=1.7 --dmin=45 --dmax=45 --fov=55
     node tools/lookat.mjs --pos=-142,1.70,521 --target=-97,20.9,521 --fov=55 --t=0.0 --wet=1 \
       --name=s43-sign2 --tag=<before|after>
  4  node tools/poseprobe.mjs --target=142.8,10.4,119.3 --eye=1.7 --dmin=35 --dmax=35 --fov=50
     node tools/lookat.mjs --pos=177.67,1.70,122.35 --target=142.8,10.4,119.3 --fov=50 \
       --t=0.0 --wet=1 --name=s43-holo2 --tag=<before|after>
```

**THE `before` ARM IS A GIT WORKTREE IN THE SCRATCHPAD**, per the memory note: worktrees land
outside iCloud, so the conflict-copy hazard that put `src/lib/citygen 2.js` in the tree in session
37 never arises, and no repo file is rewritten twice. `node_modules` is one symlink.

**TWO POSES WERE THROWN AWAY AND IT IS WORTH SAYING WHY.** `poseprobe` answers *"is there a BUILDING
in the way"* and it answers it correctly; it does not answer *"is the subject in frame"*. A first
hologram pose at `--pos=-208.30,1.70,8.50` came back clear and delivered a frame taken under a
cantilever with the subject nowhere in it — the before and after are pixel-identical. Its own
header says as much (*"it does NOT answer 'is the subject big enough to read'"*), and the cost of
not reading that is one frame pair.

**THE PROBES ARE IN THE SCRATCHPAD AND NOT IN THE TREE.** Two were written this session: a pure
generator sign census (no browser, no GPU — `generateChunk` is pure, so every number in §3 is a
coordinate) and a delivered-census reader that boots the page and sums `harness.sceneCensus()`.
Neither is a gate, neither asserts anything, and `parsecheck` still counts 112 files.

---

## 7. WHERE THE BRIEF DISAGREES WITH THE CODE

The brief said *"no false premise from me this time — every number below is session 42's own or
LOOK.md's, and where the code disagrees, believe the code."* Four places where it does:

1. **"session 41 took cpu p95 to 3.7 ms against a ceiling of 12. There is CPU headroom."** 3.7 ms
   is `inputcheck`'s frame, not `perfcheck`'s cpu p95 on `highway_speed`, which reads **10.70 to
   11.20**. The headroom on the route that matters is **1.3 ms and not 8.3**, and item 2 spends
   about a third of it. This changed what was built: the small clutter units were gated to the
   `near` ring on that reading.
2. **"session 42 left roughly 10% of headroom [on triangles]."** Correct — 2.06 M against
   `ceilings.triangles` **2 360 000** is 12.7%. Note that STATE 42 §6.1 says *"2.06M triangles
   against a 2.00M ceiling"* twice; the ceiling is 2 360 000 and has been since it was written, so
   that sentence is the stale one and the brief is right.
3. **LOOK.md §3's "692 signs"** is 958. §3 above.
4. **"the reference has signs several storeys tall"** is reachable and the brief was right that
   session 34 was a start — but the way to get there is not a bigger ceiling, it is a ceiling
   solved from a frequency. §3.1.

**AND ONE PLACE WHERE THE BRIEF WAS RIGHT AND THE PREDICTION HELD.** *"It will move the luminance
bands."* It moved two of them and left the two with no street lighting in them at exactly 0.0000,
which is the prediction written into the code before the gate was run.

---

## 8. WHAT WAS NOT DONE

- **`clumping` was not touched.** Red by instruction. 0.440 → 0.443 as a consequence of the
  geometry this session changed, and still under its 0.60 floor. Holograms ARE counted in
  `objectCount`, so it sees them; they land only on retail corners, which is the direction that
  helps rather than hurts.
- **`hazeDensity` was not touched**, and item 1 is 1.6% because of it. Raising it is the global
  lift LOOK.md §3 and the brief both refuse; the city's own rainfall coupling is the lever and
  §1.3 says nothing has ever used it.
- **No sign claims were added to the generator registry.** The brief listed them as open and not
  for this session, and the fire escape's placement had to work around their absence — it takes
  the bay furthest from every projecting sign on its own elevation, because there is nothing to
  refuse it against.
- **`perfcheck`'s `player` route still does not register the player module.** Carried, untouched.
- **The `inputcheck` window was not repaired.** The operator's decision, carried.
- **The two blind sites and the weir's walkable mask.** Carried from STATE 42 §10 item 2.
- **No quiet battery.** `load1` 2.75–4.06 and never inside 1.6.
- **No merge to main.** FOUR commits on `claude/noctis-42-operator-five`, pushed, one per item.

---

## 9. WHAT TO DO FIRST NEXT TIME

1. **THE CLUMPING STATISTIC, REPLACED RATHER THAN RE-NUMBERED.** Carried from STATE 40 item 2,
   STATE 41 item 3 and STATE 42 item 1, untouched, now **0.443** against a 0.60 floor. **It needs a
   decision from the operator, not another measurement.**

2. **NOTHING IN THIS PROJECT HAS EVER SET RAINFALL, AND IT IS NOW THE LARGEST UNSPENT LEVER.**
   `night_rain` is a route with `wet: 0.85` and no rain in it; `rainfall` is not a CONTRACT §6
   parameter. `weather.js` already models the extinction (`RAIN_SIGMA_FULL`, Marshall–Palmer, ×4.46
   at full rain), the streak, splash and spray layers are all gated on it, and item 1's haze scales
   with it for free. **The whole of LOOK.md §1's mood reference is "rain-lit neon at street level"
   and no frame in this project's history has had rain in the air.** Two lines: a `rainfall`
   default in `main.js` and a `--params` pass-through that already exists.

3. **THE VEHICLE SILHOUETTE BARS READ 65% AND 65% THIS SESSION AGAINST 52% AND 63% LAST**, with
   nothing touching a vehicle in either. STATE 40 item 5's warning about the spread, delivered a
   third time. **Pool them or stop quoting them** stands, and it is now two bars rather than one.

4. **THE GENERATOR REGISTRY CONTAINS NO SIGN CLAIMS AT ALL.** Carried from STATE 41 item 4 and
   STATE 42 item 3. It is worth more now than it was: signs are half again as tall and the fire
   escape had to work around their absence.

5. **A `citycheck` ASSERTION THAT DELIVERED MAY NOT EXCEED CLAIMED.** Carried from STATE 42 item 8,
   and this session found the same shape in the signage — a sign 1.37× its own building — which
   nothing would have caught either.

6. **`perfcheck` HAS A ROUTE NAMED `player` AND HAS NEVER REGISTERED THE PLAYER.** Carried.

7. **THE `inputcheck` WINDOW**, **THE LOOK CURVE'S TWO BOUNDS PER FRAME AT 60 Hz**,
   **`landmarkOccluders` UNMEMOISED**, **A LANDMARK'S BOXES AND ITS CHUNK'S MASSES BEING TWO
   MESHES** (still five draw calls sitting in the tightest budget in the project — and this session
   spent none of them, so the spare is still one), **THE NARROWING VERDICT**, **THE YARD'S BOUNDARY
   STACK**, **`band:noon` AND `band:dusk` HAVING NO SURVIVING MECHANISM**, **the end-of-run gap**,
   **a quiet battery**. Carried from STATE 42 items 4–10, untouched.

8. **`poseprobe` ANSWERS ONE QUESTION AND A FRAME NEEDS TWO.** §6. It ray-tests buildings and says
   nothing about whether the subject is in shot; two of this session's poses came back clear and
   delivered pixel-identical pairs. Its `--fill` column is advisory and was not enough. A cheap
   repair exists: report the subject's screen-space bounding box after the ray test, so a pose
   that is clear AND blind says so.

---

## 10. KNOWN GAPS CARRIED FORWARD

**Unchanged from s8–s42**: `stats().cutoffM` hard-codes 0.8, the headroom probe inert,
`saturation-peak.png` overwritten every run, `$fovYDrift`, `camera.setRouteAt(name, 1.0)` at the
sky, rain streaks near-invisible wide at night, `rain_spray` 0 static, **right turns only**, sun
shadows to ~170 m, the bake blind to elevated slabs, the PMREM hitch, the too-red dawn horizon, one
worker at queue depth one, the far half of the river handing back to the night sky past ~300 m,
grime authored, the near-field washboard on the water, the quay wall inside the walkable mask,
props absent from the walkability mask, the 3.5°–10.4° route camera pitch, the frozen/running A/B,
`materials.display` drawn by nothing, the hauler's marker row buried inside its own body, the
seeding fallback's untested placement, **a bus never turns**, the origin block's absent occupancy
registry, `facadeAlbedo` on its floor with zero spread, the station's cores reading as an open
frame, **nobody can climb the station**, the 0.10 m margin at the core's outer face, `poseprobe`'s
blindness to the origin block, the pavement's missing kerb, `tools/city-budget.json:84`'s stale
`$derivation_count`, one merged building pool breaching the triangle ceiling, the station's platform
slab hiding the train, `traffic.js:2346`'s claimed draw-call margin of one, `minStraightness` and
`minArrivalsPerMinute` having no gate reader, the zero-second protected pedestrian phase,
`landmarkBlocks` still exported and still disagreeing with the registry two ways, **the basin is
walkable in the mask and unwalkable in the geometry**, the two `walkableAt` sites still blind to a
basin, the quay walk's ulp exposure on four named chunks, **`walkability` unreachable cells at 134
with no threshold reading it**, **the vehicle silhouette bars red on every reading for nine
sessions**, a gate message frozen in the present tense of the session that wrote it, **a palisade
that does not stop a pedestrian**, and **the two delivered `sign ×` overlaps and the two sign quads
inside a building**.

**CLOSED THIS SESSION:**

- **The air in this city was lit by the sky and nothing else**, since the haze block was written in
  session 27, in a block whose own heading said otherwise. §1.
- **Nothing had ever been bolted to a wall in this city.** LOOK.md §5's "encrusted facades", asked
  for since it was written. §2.
- **Two building-scale signs were wider than their own buildings**, and no sign in the city reached
  six storeys. §3.
- **The city had nothing like a hologram**, LOOK.md §3's one piece of new content. §4.

**NEW THIS SESSION — all of it measured, none of it inferred:**

- **A METEOROLOGICAL VISIBILITY OF 8.7 km MEANS A STREET LAMP HAS NO HALO.** The exact
  single-scattering integral against a 6 800 cd lantern at 9 m is 0.022 cd/m² against a road at
  1.4 — 1.6%. The model is right and the density is what decides. §1.1.
- **AUTO-EXPOSURE PAYS FOR ANYTHING ADDED TO A FRAME**, so 64% of pixels go DARKER when light is
  added and only a term with structure survives. §1.1.
- **NOTHING IN THIS PROJECT HAS EVER SET RAINFALL.** `night_rain` has no rain in it. §1.3.
- **THE SIGNS AND WINDOWS HAVE NO PHOTOMETRY**, so no scattering model can make them light the air.
  §1.3.
- **A BAND WHOSE TOP TOUCHES THE TARGET DELIVERS THE TARGET NEVER** — a ceiling at which six
  storeys is reachable delivered 0 of 975, and the ceiling has to be solved from a frequency. §3.1.
- **A TRANSMISSIVE SURFACE COSTS EXACTLY ONE DRAW CALL AND A RASTER OF EMISSIVE BARS COSTS NONE**,
  which is how the one spare in the project survived a session that added holograms. §4.
- **LOOK.md's 692 SIGNS ARE 958**, because the roof signs landed after the number was written. §3.
- **`poseprobe` CAN RETURN A CLEAR POSE THAT CANNOT SEE ITS SUBJECT**, twice this session. §6.
- **THE BRIEF'S 3.7 ms IS `inputcheck`'s FRAME AND NOT `highway_speed`'s cpu p95**, which is 10.70
  — so the CPU headroom on the route that matters is 1.3 ms and not 8.3. §7.
