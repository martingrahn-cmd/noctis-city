# LOOK.md — what NOCTIS is supposed to look like

This is the third governing document, beside `CONTRACT.md` and `STATE.md`.

`CONTRACT.md` says what a session may not do. `STATE.md` says what has been
done. Neither says what the city is *for*, and for ten sessions that absence
has meant every session optimised proxies — luminance bands, cluster counts,
claim areas — because those were the only written targets. This file is the
target.

**A session that satisfies every gate and does not move the city toward this
document has not succeeded.**

---

## 1. The city

**A dense night city in 2049.** Not a ruin, not a utopia, not a cyberpunk
pastiche. A working metropolis that has kept building for twenty-five years.

The density reference is **lower Manhattan**: streets walled on both sides for
their whole length, buildings meeting the pavement with no gaps, no visible bare
ground between them. Sky is something you see a strip of, looking up.

The mood reference is **rain-lit neon at street level** — the class of image
where the road is a mirror and every light counts twice.

**AND FOR FORTY-THREE SESSIONS THE "RAIN-LIT" HALF OF THAT SENTENCE HAD NEVER
BEEN RENDERED.** The water on the road landed in session 4 and the app started
standing in it in session 33; the rain in the AIR had a module, three particle
layers, a drop-size distribution and no caller. Session 44 turned it on —
`?rainfall=`, and a shower cycle behind it — so the reference's own weather is
now something this city can be in rather than something it is described as.

**AND SESSION 45 MADE THE DROPS VISIBLE, WHICH IS NOT THE SAME SENTENCE.** For
three sessions `?rainfall=1` changed the frame time and changed nothing you
could see. It was not dormancy: measured at HEAD, **500 of 500 streaks live and
inside the frustum**, at 0.88 to 12.0 m, median 9.4 m. A median streak arrived at **0.136 cd/m²
against a lit road at 1.4 — 0.097× the surface it is seen against**, which is
7.2% of the radiance the module's own derivation names. Two of the three
factors behind that are the model doing what it says; the third is a defect —
a coverage profile whose mean over its own quad is 0.280. The other correction
is a drawn population that is 1.1% of the rain's glinting cross-section,
because `budget.json`'s split at 3.28 mm is about EXTINCTION and a drop three
metres from the eye is BACK-SCATTER. The two
corrections multiply to 326.3 and the arm chosen by looking at six live-swept
frames was 70–400, so the derivation lands inside the bracket the eye picked.
`tools/shot-out/s45-rain-{before,after}-t0-wet.png` is the pair, 118 draws in
both. **The mood reference's own half-sentence is on the screen now.**

**AND THE SAME SESSION PUT THE DROPS IN THE LAMPS, WHICH IS THE HALF THAT MAKES
IT A STREET RATHER THAN A WEATHER SYSTEM.** *"Rain-lit"* is two words and the
second one had a constant behind it: `STREAK_GLINT_NITS` gave every drop in the
world the same radiance, so a drop three metres from a lantern and a drop fifty
metres from any light were identical. A drop is a SPHERE — a convex mirror — so
its flux to the eye goes as the **illuminance at the drop** and not as the
source's radiance, and the modulation is that illuminance over the one the
constant already stood for. Delivered: the frame mean does not move (29.63 →
29.62) and the difference map is **red streaks on the dark side of the frame and
green streaks toward the lamp** — a redistribution, with a measured spread of
**0.007 to 3.43** between the darkest drop and the brightest.

**THE REFERENCE IN THAT RATIO WAS WRONG BY TEN IN ITS FIRST ARM AND THE MODULE'S
OWN PRINTED MEAN CAUGHT IT** — `STREET_DESIGN_LUX` is what the CARRIAGEWAY is
lit to, a horizontal plane at ground level, and a drop is in the air beside an
8.08 m lantern rather than under it. `weather.particleStats().beam` exists so the
claim *"this adds variation and not level"* is checkable rather than trusted, and
it reads 0.840 and 1.167 at two poses.

**THE CROWNS GOT THEIR OWN POPULATION SHARE IN THE SAME SESSION, AND IT IS NOT
THE STREAKS'.** A streak is a glint, so the moment is D² and the ratio is 91.41;
a crown is diffuse foam raised by an impact, so the moment is `N·v·A` = D^2.67
and the ratio is **40.72**, 0.445× the streaks'.

**WHAT IS STILL MISSING FROM THE MOOD REFERENCE:** nothing above ground level
gets wet (STATE 45 L18), and daylight rain is invisible at any gain because the
layers are additive and a drop in daylight REFRACTS (L4).

---

## 2. Density — what it concretely means

The single largest gap between NOCTIS today and the reference is not detail.
It is that the street wall is broken.

- **Buildings meet the lot line.** A block's frontage is continuous. Where a
  parcel is empty, it is empty *for a reason* — a yard, a site, a park — not
  because a noise field came out low.
- **AND THE REASON WAS DECLARED AND NOT DRAWN, WHICH IS THE OPERATOR'S OWN
  READ OF SESSION 39's FRAMES: *"everything which is not a building stands
  empty."*** The bullet above has been satisfied since session 32 — a chunk is
  a `yard`, a `lot`, a `parking`, a `park` or a `construction` site and it says
  so — and until session 40 three of those five names bought the parcel
  nothing at all.

  **THE CAP WAS ONE OBJECT PER CHUNK AND IT WAS BY CONSTRUCTION.** `park` and
  `construction` each had a count with a FLOOR under it — `22 + 26·d` and
  `14 + 16·d`. The other three fell through to `26 · d³`, and a chunk is
  low-detail BECAUSE `density < CITY.lowDetailThreshold` = 0.34, so the law and
  the gate that selects the kind read the same field: `26 × 0.34³` = **1.022**,
  rounding to zero below `d = 0.268`. Measured by `tools/groundprobe.mjs` over
  twelve regions of 10 × 10 chunks (seeds 1337–1348), as objects per hectare of
  OPEN GROUND — the 104.6 m island minus the exact union of every building,
  landmark, water and block claim standing on it, because a per-chunk count
  hides that a built island has half of itself under a wall:

  ```
    kind          chunks   objects per hectare of open ground   chunks with
                            s39    s40      s39 → s40 zero      NOTHING on them
     parking         41      0.0   180.1                         26/41 →  0/41
     lot             45      0.0   163.6                         29/45 →  0/45
     yard            45      0.0   149.9                         29/45 →  0/45
     built           963     7.0    46.0                        114/963 → 12/963
     park            47    187.4   187.4    unchanged              0/47
     construction    59    174.6   174.6    unchanged              0/59
  ```

  **84 of the 131 parking, lot and yard chunks delivered nothing at all** on
  1.094 hectares of open ground, and the two kinds anybody had given a floor
  delivered 187 and 175. The repair is `DEAD_ZONE` in `citygen.js`: a floor and
  a slope for each of the three, each floor derived from a length that belongs
  to the kind — a car park's 30 m lighting square, a yard's 21.4 m van apron, a
  third of the island for a cleared lot — plus the content itself. **None of it
  is a preference: the derivation is beside every constant.**
- **THE BLOCK INTERIOR IS THE LARGEST BARE SURFACE IN THE CITY AND IT HAD NO
  FLOOR UNDER IT — LITERALLY.** `lotDepthM()` is 40.6 m, so the central
  `104.6 − 2 × 40.6` = **23.4 m** square of every island is ground no perimeter
  building may reach by construction. **659 of 963 built chunks had nothing
  standing in it**, and a `built` island emitted **no ground rectangle at all**
  — the courtyard was the world's earth plane, the surface under a road where
  there is no road. A light-well core is the block's own service yard, so it
  now carries one (`DEAD_ZONE.core`, 12 + 14·d, from the same van apron) and a
  surface to stand it on. Empty wells: **659/963 → 187/963.**

  **IT COST THE CLUMPING GATE AND THE NUMBER IS PRINTED RATHER THAN ARGUED
  AWAY.** `citycheck`'s prop-density CV fell **0.566 → 0.430** against a floor
  of 0.60 it has been under for six sessions, and the twelve-region population
  went from 9 of 12 below the floor to **12 of 12**. That statistic correlates
  0.92 with how many chunks in the window are EMPTY (STATE 37 §4.2), and this
  change is precisely a change to how many chunks are empty — its own populated
  fraction moved 94% → 99% against a floor of 55%. **No threshold was moved**
  (CONTRACT §0 rule 5) and no re-derivation was attempted by the session whose
  change breached it (§7 below). It is the first item on STATE 40's list after
  `inputcheck`.
- **AND THE EMPTINESS THAT WAS LEFT AFTER ALL OF THAT WAS NEVER THE GENERATOR'S
  — SESSION 42.** The operator's read of session 41's frames is *"still too much
  empty land, and it is not realistic"*, and the two bullets above had spent two
  sessions filling parcels. `tools/bareprobe.mjs` attributes every square metre
  of a frame's ground to ONE owner — solids, then the surface rectangles
  `city.js` triangulates, then BARE, which is `block.js`'s earth plane — exactly,
  by coordinate compression. Over 14 × 14 chunks at seed 1337:

  ```
    bare ground, as a share of all the ground a 950 m aerial can see
      what the GENERATOR leaves bare                              0.7%
      what the FRAME showed at the end of session 41             62.6%
      what the FRAME shows now                                   41.5%
  ```

  **The generator leaves 0.7%.** The two bullets above are finished, and the
  instrument that says so is not the one that made them: a per-hectare object
  count divides by OPEN GROUND, which is exactly the quantity that says nothing
  about whether a SURFACE was drawn under those objects.

  **21.3% OF THE GROUND AN AERIAL SHOWS WAS A BUILDING STANDING ON NO GROUND.**
  `city.js` drew massing to `geometryRadius` (5) and ground to `groundRadius`
  (4), so a band of city 128 m wide stood on the earth plane, whose albedo
  (0.069 linear) is **84% of asphalt's** (0.082) and which lay exactly where the
  carriageway belonged. That is the operator's fourth defect — *"a surface that
  reads as a road but does not look like one: wide, pale, no markings, no
  kerbs"* — and it is not a road at all. The ring is now the geometry ring's
  equal, at **zero draw calls**, because `rebuildGroundMesh` merges every
  resident chunk's ground into one mesh; measured in both arms at 364 draws.

  **AND THE PLANE ITSELF WAS A GUESS.** 0x4a4640, with no derivation beside it
  in a file where every other surface has one, is **1.80×, 1.98× and 2.28×
  darker than this city's own area-weighted ground** and a third warmer — R/B
  1.34 against 1.05. Dark and red beside grey is a field beside a city. It is
  now that mean (`GROUND.earthAlbedo`), which is CONTRACT §8.1's rule for the
  canyon field's analytic default — *"the default's job is to agree with the
  bake about the average; where they disagree, the ring boundary becomes
  visible"* — applied to the one surface nobody had ever applied it to.

  **WHAT IS LEFT IS THE RESIDENCY RING AND IT IS NOT A DEFECT.** 41.1% of an
  aerial's ground is past `geometryRadius`, where nothing is drawn and nothing
  should be. At 950 m the frame is about 1 575 m wide and the streamed city is
  1 280 m. **From high enough, the honest answer is that you are looking past
  the edge of the city**, and no ground colour and no fill law changes that.
- **AND THE THIRD ANSWER IS THE BLOCK INTERIOR, MEASURED IN THE FRAME'S OWN
  PIXELS — SESSION 46.** The operator's sixth defect is *"between and behind
  buildings, in daylight, wide flat areas with nothing on them"*, for the third
  time in seven sessions. Neither of the first two instruments can answer it:
  `groundprobe` divides objects by OPEN GROUND, and `bareprobe` attributes a
  REGION's square metres, and a perspective frame spends most of its pixels on
  the nearest two hundred metres. `tools`' new scratchpad `frameown` casts a ray
  through a grid of the DELIVERED frame's own pixels, names the mesh each one
  hit, and resolves every ground hit back through `generateChunk` to the kind
  that owns it. From the operator's own spawn, looking down 45° at noon:

  ```
    building mass         56.51%      ground road            7.51%
    ground coreGround     16.19%      ground walk            3.99%
    landmark exchange      4.51%      ground siteGround      2.30%
    building windows       3.78%      ground parkingGround   0.65%
    BARE — block.js's earth plane                            0.00%
  ```

  **BARE GROUND IS 0.00% OF THAT FRAME**, so the bullet above is closed at this
  pose, and the residency ring is not it either — from 91.73 m looking east the
  earth plane is 10.53% of the not-sky frame at a MEDIAN RANGE OF 1 641 m, which
  is that bullet's own *"you are looking past the edge of the city"*.
  **The largest ground owner in the picture is the block interior at 16.19%, and
  it is drawn, correctly coloured, and almost empty.**

  **AND THE PER-HECTARE COLUMN SAYS THE KNOB IS NOT THE ONE ANYBODY WOULD
  REACH FOR.** `groundprobe`, same seed, same region, objects per hectare of
  open ground with the fixture count beside it:

  ```
    kind          chunks   props  feats   objects / ha
    park             2       45    278       275.1
    lot              4       49    495       202.4
    parking          5       82    894       178.2
    construction     3       54    518       174.6
    yard             3       85    410       150.8
    built           83     1898     55        43.8
  ```

  A `built` island delivers a quarter of a car park and a sixth of a park, and
  the column that explains it is `feats`: the other five get **83–92% of their
  content from FIXTURES** — bays and parked bodywork and a boundary rail and
  lighting columns; a palisade, stacks and two floods — while the core has 0.7
  features per chunk and everything else it has is scatter. **Its scatter is not
  short**: `DEAD_ZONE.core` delivers 41.8 props per hectare where
  `DEAD_ZONE.yard` delivers 29. So raising the core's count would be choosing a
  number for a reason the data does not support. **The item is fixtures**, and
  `DEAD_ZONE.core`'s own comment already names them — bin stores, a plant
  enclosure, stacked material and a delivery bay.

  **AND THE FIXTURE THAT MATTERED WAS THE BOUNDARY, WHICH IS THIS SECTION'S OWN
  HEADLINE ARRIVING FROM THE OTHER SIDE — SESSION 47.** *"A yard is a yard
  because it has a wall round it, a gate, and something being done on it."* The
  core's boundary is the yard's boundary at the yard's own height — 2.20 m,
  `DEAD_ZONE.palisadeHeight` — drawn as masonry rather than palisade because it
  faces a street rather than a compound, and **where it runs is decided by the
  registry and not by a rule**: every segment is offered to `reg.conflict`
  first, so it appears exactly where a building does NOT.

  **WHICH IS THE FRONTAGE GAP THIS SECTION HAS BEEN COUNTING SINCE SESSION 39.**
  267 gaps at seed 1337, 15.0 m mean, 4 001 m, 11.5% of the island edge, *"188
  of them MID-SIDE, where the walk goes on afterwards, and those are the ones
  that read as a hole in a street wall"*. Delivered over 10 × 10 at seed 1337,
  61 built chunks:

  ```
    wall segments   3 556   = 10 668 m    41.8% of the built island edge
    gate segments     161   =    483 m    the way in, cut from the LONGEST run
    loading bays    1 636 marks
  ```

  **The frontage is continuous at ground level now on 41.8% of the edge that had
  nothing on it, at ZERO draw calls, without one new building and without
  touching the fill law this section spends four bullets choosing.** Walkability
  is identical — 54 304 of 54 438 free cells — so the wall closed the street and
  blocked nobody. `tools/shot-out/s47-wall-{before,after}-{front,court}.png`;
  the `court` pair is a gap between two buildings opening straight onto the
  street, with a van and two bins on pale ground behind it, closed.
- **THE EMPTY CHUNKS ARE NOT THE DEFECT, AND THE CLAIM THAT THEY WERE WAS MINE.**
  This bullet used to read *"23 of 100 chunks carry zero buildings, one of them at
  density 0.715 — that is the defect"*, and STATE 31, this file and session 32's
  brief all carried it. Session 32 asked the generator **why**, which nobody had:
  **seventeen of the twenty-three are `park`, `yard`, `lot`, `parking` and
  `construction`** — the previous bullet's own list, shipped — and the other six
  are `built` chunks whose islands stand under a landmark or in the river.
  **`(-3,1)` at 0.715, the one held up as the proof, lies 100% inside the weir.**
  At `fill = 1.0`, twenty-one of the twenty-three are still empty. At HEAD, after
  session 32's raise, the region reads **480 buildings and 21 empty chunks — 17
  non-`built`, 4 `built`, `(-3,1)` still among them.** The city already does what
  the bullet above asks. **The real complaint is inside the `built` chunks and it
  is the frontage:** median block frontage occupancy 0.162 before the raise and
  0.244 after, with 148 of 400 block sides still bare end to end.
- **THE LIMITER IS `citycheck`'s CLUMPING FLOOR. IT IS NOT THE REGISTRY, IT IS
  NOT DRAW CALLS AND IT IS NOT BATCHING — AND THE FIRST OF THOSE WAS MINE.**
  This bullet used to read *"THE LIMITER IS THE OCCUPANCY REGISTRY"*, on session
  32's one forbidden overlap — `sign(adpillar) × prop(planter)`, 0.061 m² — and
  it stopped the fill raise for four sessions. **Session 36 shipped a fill past
  the one that produced it and the delivered census read 0 / 0 forbidden
  overlaps over 53 forbidden pairs, on 5 512 generator claims and 4 169
  delivered.** The registry keeps its absolute authority (§7); it simply was not
  what was in the way.

  Swept the whole law to `fill = 1.0` by `tools/fillprobe.mjs`, same 10 × 10
  region at seed 1337:

  ```
    power    bldgs   island cover   occ/block   bare sides   objCV   highway_speed
     1.40      491      28.1%         0.237      147/400     0.626   433 draws 1.60 M tris
     1.10      528      31.2%         0.268      137/400     0.626   434 draws 1.71 M tris
     0.90      595      34.4%         0.306      128/400     0.591   <- clumping RED
     0.50      689      38.4%         0.355      118/400     0.568   436 draws 2.09 M tris  <- SHIPS, s37
     0.00      786      45.4%         0.463      122/400     0.535   437 draws 2.18 M tris
  ```

  **AND THE ARM THAT SHIPS WAS CHOSEN BY LOOKING, WHICH IS NEW.** Session 37 took
  fourteen aerial frames over seven arms at two poses and one seed
  (`tools/shot-out/s37-airA-f*.png`, `s37-airB-f*.png`, and five street frames
  `s37-street-f*.png`), by `lookat --params=fill=` — `?fill=` is CONTRACT §6's
  new parameter and the arm is bit-for-bit at the shipped value. The frames give
  **two different answers**: from the pavement, denser is better all the way to
  `fill = 1.0` and there is no arm at which the street wall stops improving;
  from the air it is not, because past about `d^0.5` the sparse districts fill
  in as fast as the dense ones and the city becomes one carpet.

  **THE DRAW-CALL CEILING NEVER BINDS.** At `fill = 1.0` — 60% more buildings
  than ship — `highway_speed` measures **437 draws of 440**. The whole range of
  this law costs four draw calls. The triangle ceiling binds at that end instead
  (2.18 M of 2.00 M, first breached near 700 buildings), and **`citycheck`'s
  clumping CV floor of 0.60 binds before either, at `d^0.90`** — a smaller power
  fills the SPARSE end of the density field hardest, and that is the district
  structure the last bullet of this section asks for, spent. The merged-pool
  finding is unchanged: the frustum test rejects 54–60% of the city's triangles,
  so one pool would submit 1.90 M before the sky, the traffic, the people and
  the stalls.
- **BUILDINGS GO TO THE BACK OF THEIR LOT, AND THE CORE IS A LIGHT WELL ONE
  STREET WIDE.** Measured over `city-budget`'s own 10 × 10 region at seed 1337
  by `tools/depthprobe.mjs`, which is the instrument the numbers below come out
  of. Before session 35 every building in the city drew its depth from one band,
  `rng.range(15, 26)`, wherever it stood:

  ```
                                    s34        s35
    median depth into the island   20.1 m     29.6 m     of a 52.3 m half-block
    island coverage                20.8%      28.1%      over the chunks that
                                                         carry a building
    built past 31 m from the lot    0.05%      5.35%    of the built-chunk
                                                        island area past 31 m
  ```

  **The core is derived and not chosen.** `CORRIDOR` is 11.7 m, building line to
  road centre; two of them is **23.4 m, building line to building line** — the
  section of an ordinary street in this city, and the narrowest gap it already
  asserts two facades may face each other across. So the light well is one
  street wide and the lot is `(104.6 − 23.4) / 2 = 40.6 m`. A full ring at 40.6 m
  covers **95.0%** of the island against the 96.3% of the lower Manhattan block
  STATE 33 §6 measured this against.

  **AND THE OTHER KNOB WAS THE SHORT ONE, AND IT IS NOW PAST WHAT THE GATES
  ALLOW — DELIBERATELY.** Frontage occupancy went 0.237 (s32) → 0.268 (s36) →
  **0.355 per block** (s37) and island coverage 28.1% → 31.2% → **38.4%** over
  the chunks carrying a building, against 95.0% for a full ring.

  **DEPTH AND FILL DO NOT MULTIPLY — RAISING ONE LOWERS THE OTHER, MEASURED.**
  Session 36 said they multiply to within 6% and that they fight at the corners;
  session 37 put a sign on it. Through `depthprobe`, same seed, same region,
  both arms:

  ```
                                  d^1.10      d^0.50
    buildings on an island edge      520         679
    median depth into the island    29.8 m      26.7 m     −3.1 m, −10.4%
    depth clipped at corners        905 m      1342 m      +48%
    island coverage, built chunks   31.2%       38.4%
  ```

  So the frontage raise BOUGHT 7.2 points of coverage and SPENT 3.1 m of the
  depth session 35 built. The third knob — the end-of-run gap — is still
  unspent, and it is the one that does not fight anything. `tools/fillprobe.mjs` is the instrument
  and it prints its population; session 32's *"0.244"* is a per-BLOCK median,
  and on the same population this instrument reads 0.234, so the figure quoted
  for four sessions is a hundredth out and the denominator was never written
  down. Its *"148 of 400 block sides bare"* reproduces EXACTLY.

  **NEITHER KNOB REACHES THE REFERENCE AND FILL CANNOT.** At `fill = 1.0` the
  delivered coverage is **45.4%**. What holds the other half is the end-of-run
  gap — `rng.range(6, 26)` after every run of 1–4 buildings — and the registry
  refusals, which at the ceiling number 484 over the region, **282 of them
  against another BUILDING**. That last number is the corner meeting session
  35's 40.6 m depth created: two deep corner buildings own 81 m of a 104.6 m
  side before the walk that runs third reaches it. **Depth and fill do not
  purely multiply; they fight at the corners**, and the third knob is the gap.

  **AND THE WHOLE CHAIN HAS NOW BEEN WALKED, STAGE BY STAGE, AND IT CLOSES TO
  ZERO — SESSION 38.** `tools/funnelprobe.mjs` counts every stage inside
  `citygen.js`'s own perimeter walk; over `citycheck`'s 10 × 10 at seed 1337 the
  law evaluates to **0.771**, the roll passes **0.771** — the law is applied
  exactly as written — and **0.364** of the island edge ends up standing behind
  a wall. Those are three different quantities: a probability per candidate lot,
  the same probability measured, and a LENGTH ratio. The metres between them are
  all accounted for, with a residual of 0.000000 m:

  ```
    of 34 727 m of walked island edge, at d^0.50        at fill = 1.0
      standing behind a building              36.4%         42.8%
      refused by the fill roll                20.2%          0.0%
      refused by the registry (clip + river)  20.4%         31.5%
      end-of-run gaps                         11.4%         13.6%
      overrun — the side ABANDONED             4.6%          4.6%
      lead-in at the head of each side         4.3%          4.4%
      tail, the last 12 m never entered        1.7%          2.0%
      gaps within a run                        1.0%          1.1%
  ```

  **SO THE WALK'S OWN CEILING IS 0.431 OF THE FRONTAGE**, pooled over twelve
  regions (0.389–0.455), and not 1.0. Everything the fill law gives up is not
  handed to the street: taking the power from 1.40 to 0.00 frees 654 candidate
  lots at seed 1337 and **302 of them become buildings while 337 become registry
  refusals**. The core is the end where that is worst — per-chunk frontage
  occupancy in the DENSEST quartile moves 0.348 → 0.470 across the entire law
  (1.35×) while the sparsest moves 0.144 → 0.458 (3.18×), pooled over eight
  regions. **A SATURATED CORE IS NOT REACHABLE BY ANY FILL LAW OF ANY SHAPE**,
  because at `fill = 1.0` the core already delivers only 0.470.

  **AND ONE STAGE ABANDONS FRONTAGE WHERE A BUILDING FITS.** When a candidate is
  wider than what is left, the walk sets `t = side.to` and ENDS THE SIDE rather
  than walking past it as every other refusal does. Its own outer guard is
  `t < side.to − 12` and its narrowest building is 11.0 m, so a building fits in
  every one of them by construction: **94 of 332 sides (28.3%) end this way,
  giving up 1 591 m — 12.1 m at the least, 16.9 m on average, 24.6 m at the
  most.** It is 4.6% of the island edge at every arm. ~~Not repaired: the fix
  draws more random numbers on those sides and re-phases the whole city, which
  would discard the arm session 37 chose from nineteen frames.~~ **REPAIRED IN
  SESSION 39, AND THE HALF OF THAT SENTENCE ABOUT RANDOM NUMBERS WAS WRONG.** The
  repair draws exactly the uniform the walk already drew — the width is CUT to
  the frontage that remains, not re-rolled — and the same is true of the pad
  repair below. What re-phases the city is the BUILDINGS the repair adds, which
  draw their own depth, era, height and signs; no named stream can help with
  that, because those draws have always come from the chunk's own stream and
  moving them would move every building in the city rather than the new ones.
  The arm was re-chosen by looking anyway, and it did not move — see below.

  **AND THE CEILING IS 0.451, NOT 0.431 — SESSION 39, AND THE PAD WAS NOT THE
  THING.** Session 38 named landmark and block pads as the cause because
  `landmark` refuses 87% of what it meets and `block` 100%. Measured by
  `tools/padprobe.mjs`, which reads the walk's own refusals by OWNER rather than
  by kind, over `citycheck`'s 10 × 10 at seed 1337:

  ```
    the option                                        what it returns
    a narrower pad (BUILDING_SETBACKS.landmark 4.2 m)   6 of 296 refusals
        — 98% of refusals OVERLAP the claim along their own frontage,
          so the setback is not what refuses them
    the weir's disc instead of its bounding square      3 refusals, 54 m, 0.2%
        — 21.5% of that claim is ground the basin is not standing on,
          and the frontage meets it square on rather than at a corner
    the walk RESUMING at the pad's far edge            68 refusals, 701 m, 2.0%
        — the advance `width + rng.range(0, 3)` knows nothing about
          where the claim ends, so it steps past the short ones
  ```

  **SO THE PADS ARE UNTOUCHED AND THE WALK'S RESPONSE TO THEM IS WHAT CHANGED.**
  With the overrun repaired and the refusal landing at the claim's far edge,
  pooled over twelve regions: occupancy at the shipped law **0.354 → 0.371** and
  the walk's own ceiling **0.431 → 0.451** (0.403–0.478). The registry keeps
  every claim it had, to the millimetre.

  **AND THE END-OF-RUN GAP IS A DEFINITION THAT CANNOT MAKE THE THING ITS OWN
  COMMENT NAMES.** `rng.range(6, 26)` after every run of 1–4 buildings: 267 gaps
  at seed 1337, 15.0 m mean, 4 001 m, 11.5% of the island edge. **188 of them —
  2 662 m, 7.7% — fall MID-SIDE**, where the walk goes on afterwards, and those
  are the ones that read as a hole in a street wall; the other 79 are the last
  parcel before a corner. **Not one of the 267 is under 6 m**, because 6 m is the
  law's own floor, so the *"side alleys"* its comment claims are unreachable by
  construction and every one of them is a yard. The width is a constant with no
  derivation beside it, and it is the largest remaining loss that is neither the
  law nor the registry. **Not changed in session 39** — it is a look decision and
  the sweep STATE 37 §7.2 asks for comes first.

  **From the street the deepening was nearly invisible** — session 35's own
  frame pair says so — because a gap in a street wall is a frontage fact and
  depth grows the other way. **The fill raise IS visible from the street, on the
  blocks it reached**: 32 of 100 chunks gained a building, 10 lost one to the
  re-phase and 58 are unchanged, so which street you stand in decides whether
  you see it at all.
- **Heights are lognormal, not an even comb.** Mostly six to twelve storeys,
  with occasional towers standing well clear. `citygen.js` already carries the
  argument and both measured arms: sd/mean 0.664 against today's 0.425, p99
  134 m against 65.
- **AND EVERY BLOCK WAS HOUSING-SHAPED OR EMPTY-SHAPED, WHICH IS A DIFFERENT
  DEFECT FROM DENSITY AND IS THE ONE THE OPERATOR NAMED — SESSION 48.** His
  words: *"density, but not only houses: sports arenas, a football stadium,
  parks, playgrounds, basketball courts, multi-storey car parks. Everything a
  city needs."* Every bullet above this one is about HOW MUCH is built; this is
  about WHAT. Before session 48 the answer was five building eras, five kinds of
  empty, eight authored landmarks and a river — and nothing anywhere in it was a
  pitch, a court, a playground, a car park or a ground.

  **THE MACHINERY WAS ALREADY THERE AND ITS NAME WAS THE MISLEADING PART.**
  `lowDetail` does not mean *"little here"* — a construction site with a 40 m
  crane on it is a low-detail chunk — it means **the perimeter walk does not run
  on this island**, which is exactly and only the property a block-scale object
  needs. So the five new places are five new low-detail kinds and nothing was
  built to place them:

  ```
    pitch        grass, touchlines, two goals, a ball-stop, four floodlight masts
    court        two courts on a macadam pad set into a lawn, four hoops
    playground   a safety surface, a play frame with a slide, a swing set
    carpark      five open decks at 2.90 m, an upstand a level, 35 cars on it
    stadium      four raked stands with open corners round a pitch
  ```

  **WHERE EACH GOES IS DERIVED, WHICH IS WHAT THIS SECTION ASKS FOR AND IS THE
  half THAT STOPS IT LOOKING GENERATED.** A playground belongs where people
  live, a court is a leftover corner, a pitch needs a whole flat block nobody
  built on, a deck park is *"the edge of the dense core where people drive to
  and then walk"* and a stadium goes where land is cheap. All five are cuts in
  the chunk's own density — and the cuts are the MEASURED terciles and quantiles
  of the low-detail population, not of the band it lives in, because the band is
  not uniformly occupied: the first arm split [0, 0.34) in thirds and delivered
  **seven playgrounds out of seven**. §3's own *"a band whose top touches the
  target delivers the target never"*, with a floor instead of a ceiling.

  **IT COST NOTHING.** Not one draw call and not one triangle to three figures
  on any of the four gate routes: `highway_speed` reads 396 of 440 and 2.23 M of
  2 360 000 exactly as it did before. A stadium is about 324 boxes against the
  123 117 the resident ring already carries in buildings, so the ceiling was
  never the limit for block-scale program — **authoring time is.** What is still
  missing is an arena, and everything that is not sport: a school, a depot, a
  market hall, a hospital.

  **AND THE OTHER EIGHT WERE BUILT THE NEXT SESSION, WHICH IS THE POINT OF THE
  SENTENCE ABOVE — SESSION 49.** If authoring time is the limit, then the test
  of that claim is how many kinds one session can author. Eight: a **school**, a
  **hospital**, a **fire station**, an **industrial estate**, a **market hall**,
  a **depot**, a **church** and a **port**. Thirteen kinds of low-detail island
  where session 47 had five, and the whole of it rides three new feature kinds —
  `shed`, `canopy`, `tower` — because a school, a transit shed, an appliance
  bay and a nave are ONE object with four sets of numbers, and a spire, a hose
  tower and a hospital's stair core are another.

  **THE ONE THAT IS NOT A PRISM IS THE ONE THAT CHANGED THE MOST.** `canopy` is
  a roof on columns with air under it — a market hall, a depot's parking cover,
  an ambulance bay — and this city had no span at all before it: every roof in
  NOCTIS was the lid of a box. It is also the only one of the three that needed
  the REGISTRY to be right before it could exist, because a market hall claimed
  as a `building` forbids `prop`, and ten stalls were refused by their own roof.
  Claimed as `canopy` from the soffit up, the depot went from 11 parked vehicles
  to 83.

  **WHERE THEY GO IS DERIVED FROM WHAT THE CITY ALREADY KNOWS, AND FOUR OF THE
  EIGHT READ SOMETHING THIS SECTION'S LAST BULLET HAS ASKED FOR SINCE SESSION
  32** — *"Land by water and by transit gets built tall and to the line. Land
  under a viaduct gets sheds and yards."* Until this session nothing in the city
  read the river or the viaduct as a REASON for anything:

  ```
    school        the middle of the low-detail band          falls back to recreation
    market        the dense end — a hall needs a catchment    falls back to park
    firestation   between those two cuts                      falls back to lot
    hospital      standing on an ARTERIAL                     falls back to carpark
    port          a DRY chunk with a WET neighbour            falls back to industrial
    depot         within 3 chunks of the VIADUCT's AABB       falls back to industrial
    industrial    the river, the viaduct, or land nobody wants falls back to yard
    church        no condition — a church is where a church is
  ```

  **EVERY DERIVATION IS A FALLBACK CHAIN AND THAT IS NOT DECORATION.** A chunk
  that fails its test becomes a plainer kind rather than nothing, so no
  condition can empty a district; and `industrial` is deliberately the sink for
  three of them, which is the honest reading rather than the convenient one —
  land by the water, land under a viaduct and land nobody wants are the same
  land.

  **AND EVERY ONE OF THEM FELL THROUGH THE FLOOR THIS SECTION SPENT SESSION 40
  BUILDING — SESSION 50.** The three bullets above this one are about giving
  `parking`, `lot` and `yard` a fixture count with a floor under it, because
  `26 · d³` and the gate that SELECTS a low-detail kind read the same field.
  `propCount` reads `DEAD_ZONE[kind]`, that table held four rows, and **every
  kind added after session 40 took the fall-through** — so the five places of
  session 48 and the eight of session 49 were capped at one to four objects by
  exactly the construction this section already describes. Measured over twelve
  regions, props per chunk:

  ```
    WITH a floor              WITHOUT one
    yard          28.3        hospital       0.5     school       2.2
    park          27.8        firestation    1.0     carpark      3.0
    construction  17.7        recreation     1.2     industrial   4.1
    parking       15.5        depot          1.9     port         9.1
    lot           12.1        church         1.9     market      13.3
  ```

  **The four bottom rows are exactly the four islands session 49's frames show
  as bare**, so the frames and the generator agreed and it was one table rather
  than a look question. The palette was the worse half: the chain that picks
  WHAT an island is furnished with named four kinds and sent the rest to
  `['fence', 'stack', 'container', 'bollard']`, so a **churchyard and a school
  were furnished with shipping containers** — invisible only because the count
  law was refusing all but one of them.

  **AND THE FIXTURES THEMSELVES WERE SIZED FROM THE BUILDING, NOT THE ISLAND.**
  A flood ring at a flat 40 m, a stack spread of 34, fourteen hospital bays from
  `-30 + i · 4.6` — on an island 104.6 m square. The remainder is what the
  operator sees. `layPath` and `bayRows` take their extent from the island's own
  half-extents; a churchyard is now a lawn you can walk across, which the park
  has been since session 19 and no other kind could reach.

  **WHAT IT COST, PRINTED RATHER THAN ARGUED AWAY, EXACTLY AS SESSION 40's DID:
  clumping CV 0.528 → 0.400** against a floor of 0.60, where session 40's own
  equivalent fix cost 0.566 → 0.430. Ten kinds instead of three. `objects/chunk
  min 0 max 92` is unchanged in both runs, so the tails did not move — the
  middle filled in. **AND THE TWO NIGHT ROUTES GOT DARKER BY ABOUT 0.010**,
  because the fill is hundreds of UNLIT dark objects; the fix is to light them,
  which is what a worked yard is, not to move a floor.

  **ONE FIXTURE WAS BUILT, LOOKED AT AND REMOVED, AND ITS LESSON IS THE
  GENERAL ONE.** A painted kerb line round each apron — fifty marks an island —
  is invisible from 78 m (one pixel) and from the pavement (white paint on pale
  hardstanding). **On pale ground the thing that reads is a change of SURFACE or
  an object with HEIGHT, not paint.** Bay rows survive because a bay is read as
  a RHYTHM of many marks rather than as one line.

  **AND THE LESSON THAT COST THREE PLACEMENTS: A CONDITION NARROW ENOUGH TO BE
  PRECISE IS USUALLY NARROW ENOUGH TO BE EMPTY.** The depot's first band was one
  chunk of the viaduct's AABB and delivered nothing within twelve chunks of
  spawn. The port's first rule was *"the river envelope reaches this chunk"*,
  which leaves about 14 m of dry land on a 128 m island — nine wharves of
  fourteen got no shed. Neither is visible in the code and both are visible in
  one delivered count at the shipped seed.
- **Density has causes.** A river, a viaduct, an elevated railway with stations
  — the city already has all four and nothing reads them. Land by water and by
  transit gets built tall and to the line. Land under a viaduct gets sheds and
  yards. A station mouth concentrates frontage around it. A city generated from
  noise looks generated however dense it is.

  **THIS BULLET HAS A NUMBER NOW, AND IT IS THE PRICE LIST FOR THE BULLET
  ABOVE IT.** `fillprobe --districts` pools 963 `built` chunks over twelve
  regions (seeds 1337–1348) and reports the median delivered island coverage of
  the densest quarter over that of the sparsest — 1.00× meaning a sparse block
  and a dense block are the same block:

  ```
    power    cov Q1 sparse   cov Q4 dense   CONTRAST
     1.40        14.7%          40.8%        2.77x     session 32
     1.10        17.9%          42.7%        2.38x     session 36
     0.50        30.5%          49.3%        1.61x     ships, session 37
     0.00        45.2%          53.9%        1.19x
  ```

  **The dense quarter gains 1.32× across the whole law and the sparse quarter
  gains 3.08×**, because the core is already against its own refusal ceiling. So
  the fill knob does not spend "some" district structure — the contrast column
  IS what it spends, and at `fill = 1.0` this bullet is unreadable by
  construction. That is the whole reason the arm is `d^0.50` and not `d^0.0`.

  **AND A SURFACE THAT IS NOT THERE NO LONGER LOOKS LIKE ANYTHING — SESSION 51,
  AND IT IS A CONSEQUENCE OF A REPAIR RATHER THAN A DEFECT.** For forty-one
  sessions the missing-ground failure mode announced itself: `block.js`'s earth
  plane was `0x4a4640`, half as bright as the city's own ground and a third
  redder, so a courtyard nobody surfaced read as the operator's *"wide brown
  fields"* and could be found by looking. Session 42 replaced that guess with
  the area-weighted mean of every surface the city actually draws —
  `[0.1229, 0.1211, 0.1168]`, which is correct and is what a far field should
  be — and the by-product is that **a missing surface is now a surface of about
  the right colour that is not there**, 0.18 m below where it should be and 15%
  off on one channel.

  Session 51 measured what that hid: **1.68 ha behind the origin block's own
  kerb, at the origin, where the player spawns and every calibration camera
  stands, surviving nine sessions of people looking at frames.** The operator
  found it with the console rather than with his eyes — `player.js` printing
  `on earth at y -0.020` — and `s51-core-air-before` and `s51-core-air` are
  hard to tell apart even knowing which is which.

  **SO THIS BULLET NOW HAS AN INSTRUMENT AND NOT A LOOK.**
  `tools/surfacegrid.mjs` asks `worldSurfaceAt` on a lattice and
  `citycheck`'s `maxBareWalkableSamples` is 0. *"The ground looks fine"* stopped
  being evidence in session 42 and nobody noticed until session 51.

---

## 3. Light

Light is the city's main material. Geometry is what the light lands on.

- **Neon.** Large, and often vertical. Today's signs are small horizontal plates
  high on facades; the reference has signs four storeys tall, several at
  different depths in one frame, some spanning half a wall.

  **MEASURED, session 34**, over `citycheck`'s own 10 × 10 region at seed 1337:
  **692 signs in 5 mountings — and NOT ONE OF THEM IS TALLER THAN WIDE.**
  `aspect` is drawn from 0.24–0.62 for a shop sign and 0.28–0.42 for a
  building-scale one, so a vertical sign is not rare in this city, it is
  *unreachable*. Delivered heights: median **1.73 m**, p90 **3.70 m**, max
  **5.98 m** — the tallest sign in the world is under two storeys, and 88 of
  692 (12.7%) reach even one. The machinery is not the gap: the mountings, the
  size roll, the aspect roll and the lit/half/dead states all exist. **The
  sizes and the orientation are the gap.**

  **SESSION 34 CLOSED THE ORIENTATION AND SESSION 43 CLOSED THE SIZE.** Same
  region, same seed, straight out of the pure generator — and note that the
  population is **958, not 692**: the roof signs landed after session 34 wrote
  its number and 428 of the 958 are rooftop mountings, so the 692 above is a
  count of a city that no longer exists.

  ```
                                    s34's city      s43 before      s43 after
    signs                                  692             958            975
    taller than wide                0 (  0.0%)     111 (11.6%)    107 (11.0%)
    the tallest sign in the city         5.98 m         14.24 m        23.99 m
    >= 12.2 m   four storeys           0 ( 0.0%)       9 (0.9%)      42 (4.3%)
    >= 18.3 m   six storeys            0 ( 0.0%)       0 (0.0%)      10 (1.0%)
    building-scale signs                     —       22 (2.3%)      46 (4.7%)
      width / its own frontage, worst        —           1.37           0.85
      WIDER THAN THEIR OWN FRONTAGE          —              2              0
  ```

  **AND TWO OF THEM WERE WIDER THAN THE BUILDINGS THEY ARE BOLTED TO**, because
  `width` was an absolute `range(9, 17)` on an elevation that is a
  `range(11, 27)` — two draws, one of which has to fit inside the other. It is
  a fraction of the frontage now, which is also what this bullet's own *"some
  spanning half a wall"* asks for.

  **A BAND WHOSE TOP TOUCHES THE TARGET DELIVERS THE TARGET NEVER**, and that
  is worth more than the numbers above. A first arm raised the blade aspect
  ceiling to the value at which the widest blade *reaches* six storeys, and the
  generator delivered **0 of 975**: only a near-zero-measure corner of the
  (width, aspect) square gets there. The ceiling is solved from HOW OFTEN the
  target has to arrive instead — one blade in eight, because a frame down a
  retail street sees six to ten frontages — and the delivered figure is one in
  10.7.
- **Holograms. BUILT IN SESSION 43, AND NOT OUT OF TRANSPARENCY.** Emissive,
  above the street and at junctions.

  What makes a hologram read is that it does not obey the street: it hangs in
  air nothing supports, it is brighter than the wall behind it, and you can see
  through it to the wall. A hologram that reads as a lit billboard is a lit
  billboard, and this project already has 692 of those.

  **THE THIRD PROPERTY IS DELIVERED LITERALLY BECAUSE ALPHA COSTS THE LAST
  DRAW CALL.** `highway_speed` stood at 439 of 440 after session 42's weir park.
  A transmissive surface needs `transparent: true` and a blend mode, which is a
  second material and therefore a second mesh even merged city-wide the way
  `city:signs` is — **exactly one draw call, and it is the only one left**. So
  the panel is a RASTER OF EMISSIVE BARS at a 0.10 m bar on a 0.62 m pitch, 16%
  light and 84% air, and you see the wall through it because nothing is there.
  It is also the honest form: a projected image has no substrate, so what a
  volumetric display is made of is stacked planes of light and not a sheet.

  Delivered over `citycheck`'s 10 × 10 at seed 1337: **53 holograms**, over
  corner shops at junctions (session 28's retail roll, `RETAIL.cornerM`), cold
  by construction, riding in the existing merged `city:signs` mesh at a tint
  gain of `HOLOGRAM.nits / LIGHT.signPlateNits` = 30. **Zero draw calls,
  measured in both arms at 295** on the same street-level wet midnight pose.
  `tools/shot-out/s43-holo2-{before,after}-t0-wet.png` is the pair, and the
  after frame has two of them at two different depths.
- **Haze around light.** The air is clear and every emitter stops at its own
  edge. In the reference a sign LIGHTS THE AIR — a cone or a bloom around it,
  denser where the air is dirtier, and it is most of what makes a street feel
  full of light when it is nearly empty of objects.

  This is the term with the least geometry and the most risk to the look
  budget. §7's luminance bands measure whole-frame mean, and putting light into
  the air raises exactly that — `gateaudit`'s headroom table has all four bands
  within 0.0025 of an edge. So it is the change that most needs §7's
  re-derivation discipline, and the one where "it cannot be done honestly
  inside the bands" is a legitimate answer rather than a failure.

  **THE MECHANISM WAS MISSING AND IS NOW THERE; THE LOOK IT WAS SUPPOSED TO BUY
  IS NOT, AND THE REASON IS A NUMBER. SESSION 43.** `lights.js`'s haze block has
  been headed *"THE MEDIUM IS LIT BY WHAT IT CAN SEE, AND IN A STREET THAT IS
  NOT THE SKY"* since session 27 — and then lit the medium by the sky alone,
  scaled DOWN by the canyon's openness, with nothing standing in for the light
  the openness factor removes. The city's own lamps are now in the same
  single-scattering integral, evaluated exactly (two atans, no march) against
  the froxel's own light list, at **zero draw calls, zero instances and zero
  triangles**.

  **AND AT THIS CITY'S DECLARED AIR IT IS 1.6%.** A ray passing 9 m from a
  6 800 cd lantern collects **0.022 cd/m² against a road at about 1.4**. That is
  not a shortfall in the model — it is what a meteorological visibility of
  8.7 km MEANS (`ATM.hazeDensity`, 4.5e-4 /m): **on a clear night a street lamp
  has no halo**. An arm at 40× was rendered to prove the path is live and it is,
  and it also washes the frame out, which is the global lift this bullet
  refuses. What the term does deliver at 1× is measurable and it is the right
  shape: the darkest large surface in the frame goes **8.73 → 9.43 code values,
  +8.1%**, the whole frame goes **−0.38 cv** because auto-exposure pays for what
  is added, and **midnight's crushed black falls 1.158% → 0.873%** of a 2.0%
  ceiling. It lifts the dark and leaves the bright alone, which is the opposite
  of a lift.

  **THE LEVER IS THE AIR'S DENSITY AND THE CITY ALREADY DRIVES IT.** Rain
  multiplies `hazeDensity` by up to 4.46× (`weather.js` → `hazeFor`), and this
  bullet's own *"denser where the air is dirtier"* is that mechanism. Session
  43 found that **nothing in this project had ever set rainfall** — `night_rain`
  is a route with `wet: 0.85` and no rain in it — and left it as this bullet's
  open question.

  **SESSION 44 ANSWERED IT, AND THE ANSWER IS A TABLE.** `rainfall` is a §6
  parameter now and `weather.js` runs a shower cycle derived from its own two
  time constants. The in-scatter is linear in the medium's density, so what a
  ray passing 9 m from a 6 800 cd lantern collects is exactly the 0.022 cd/m²
  above scaled by `hazeFor(r).density / ATM.hazeDensity`:

  ```
    rainfall   mm/h    sigma /m    visibility   x clear    against a road at 1.4
      0        0.0     4.500e-4      8.69 km     1.000            1.6%
      0.17     1.7     9.595e-4      4.08 km     2.132            3.3%   mean instant of rain
      0.29     2.9     1.163e-3      3.36 km     2.585            4.1%   mean shower peak
      0.60     6.0     1.578e-3      2.48 km     3.506            5.5%
      1.00    10.0     2.006e-3      1.95 km     4.457            7.0%   full rain
  ```

  **SO THE HONEST HEADLINE IS 1.6% → 7.0%, AND EVEN THAT IS AN UPPER BOUND.**
  The integral gives the rain's whole extinction to an isotropic phase, and
  `weather.js`'s own note says half of a raindrop's `Qext = 2` is diffraction
  into a forward lobe of λ/D = 1.7e-4 rad, which a halo never sees. Discounting
  that half puts full rain at **4.4%** instead of 7.0%, and the honest figure is
  the bracket. Neither end is a halo you would call a halo.

  **WHAT IT DOES DELIVER IS STRUCTURE, AND STRUCTURE IS WHAT SURVIVES THE
  EXPOSURE.** Measured on delivered frames as a RATIO INSIDE ONE FRAME, which
  is the only exposure-invariant thing a screenshot carries (CONTRACT §5.4 pays
  for anything added, so 76% of pixels go darker at full rain): the air in a
  lantern's beam goes from **0.201 to 0.238 of the lit road beside it, +18.5%**,
  while a dark wall with no lamp near it goes 0.0891 → 0.0906, **+1.7%**. The
  glow is where the lamps are and nowhere else, which is what this bullet asks
  for and the opposite of a lift. Frames:
  `tools/shot-out/s44-{rain,lamp}-{before,after}-t0-wet.png`, **294 and 329 draw
  calls in both arms of both pairs.**

  ~~It still cannot light the air around a SIGN, and that is a fact about the
  light list rather than a choice.~~ **IT WAS A DEFECT AND NOT A FACT, AND
  SESSION 45 REPAIRED IT.** Session 44 re-confirmed the census against a better
  instrument than the one session 43 used — `perfcheck`'s own light-role census,
  which enumerates every light in the world by role and prints it beside each
  route: `aircraft:1  traffic:96  stall:12  block:56  lamp:192`. **THERE WAS NO
  SIGN ROLE AND THERE WERE 975 SIGNS**, and two sessions read that as a
  limitation of the light list. It is the same two-content-paths defect this
  file records three times over for the lamp bowl, the lamp population and the
  kerb: **`block.js` has lit every one of its five signs since session 3** and
  says so in `BLOCK_RETAIL.shopLightSlots`'s own derivation.

  **AND THE SIGNS ARE NOT A ROUNDING ERROR IN THIS CITY'S LIGHT.** Measured out
  of the generator over `citycheck`'s 10 × 10 at seed 1337, as the Lambertian
  panel's own normal intensity `I = L·A`:

  ```
    mount            n    median A    median I        max I     nits
    rooftop        340     40.0 m²   40 035 cd   217 320 cd     1000
    flush          181      6.3 m²      540 cd    11 269 cd       86
    projecting     176      5.3 m²      457 cd     3 223 cd       86
    roof            68      5.6 m²      478 cd    12 352 cd       86
    freestanding    39      2.6 m²      222 cd     3 312 cd       86
  ```

  **243 of the 555 LIT signs — 43.8% — are at or above one street lamp's
  6 800 cd.** The pool is 16 slots of the 27 the role census had spare, assigned
  per frame by `I·cosθ/d²`, and the source is a point one equivalent radius
  `√(A/π)` behind its own panel — which reproduces the Lambertian disc at both
  limits and caps the near field at `π·L` by the physics rather than by a clamp.
  Delivered: a facade goes from **1.013× an unlit control wall to 1.772×** it,
  at **zero draw calls**. `constants.js` → `SIGN_LIGHT` carries the whole
  derivation. The air in a sign's neighbourhood is now in the same
  single-scattering integral as the lamps, because the haze term reads the same
  light list.

  **What is still emissive-with-no-candela is EVERY WINDOW**, and that is the
  larger area — see STATE 45 L1, which is where the 220 cd/m² question lives.

  **AND THE SAME BLOCK PUT A HARD EDGE ACROSS THE HORIZON, WHICH IS THE OTHER
  END OF THE SAME TERM — SESSION 46, AND IT IS THE OPERATOR'S FIRST DEFECT.**
  His words: *"a distinct horizontal line where the atmosphere starts — above it
  clear, below it a flat wash, with a visible seam between."* Raycast at his own
  spawn: the pixel above the seam is SKY and the one below is `block:ground` at
  **4 123.23 m**, i.e. the 8 km earth plane's own rim. So it is the sky dome
  meeting the ground plane and not the residency ring, which ends three
  kilometres nearer.

  **WHAT MADE IT A SEAM RATHER THAN A FADE IS THE OPENNESS RAMP.**
  `clamp(wdir.y · 5, 0, 1)` is exactly 0 for any DOWNWARD ray, so the ground at
  the rim got the CANYON's openness — 0.511 — while the sky one pixel above got
  the dome at full strength. **The eye was 91.73 m up; there is no canyon.**
  Delivered: sky 141.3 code values against ground 103.7, a 37.6 cv step in two
  pixels. The ramp gains a second term — the eye's height, zero below six
  storeys and one above the 60 m this block already calls *"above every
  parapet"* — and the ground/sky ratio goes **0.8376 → 0.9774** at three
  bearings, with the four luminance bands moving 0.0001, 0.0000, 0.0001, 0.0001.

  **AN `abs(wdir.y)` ARM WAS MEASURED AND REJECTED, AND THAT IS THE part worth
  keeping.** It is the obvious repair and it is wrong: the symmetry only holds
  for a ray that STARTS above the parapets, and from 1.7 m a ray 11° down meets
  the road in nine metres and never leaves the canyon. It lifted the street's
  road band 4.1% on a pose nobody complained about and closed the seam only to
  0.8616, where the height term alone reaches 0.9774 against a forced-open
  0.9778. **The rim cannot vanish**: τ at 4 123 m is 1.71, so 18% of that pixel
  is still the ground, and closing the last of it means a bigger plane rather
  than more air.
- **Colour opposition.** This is close to free and it is the biggest unspent
  lever. NOCTIS is currently monochrome amber — nearly every emitter is warm.
  The reference works because cold cyan fights warm sodium in the same frame.
  A third of emitters should be cold.

  **PART-SPENT IN SESSION 45, AND THE MEASUREMENT SAYS SOMETHING THIS BULLET
  DID NOT.** The sign lights above throw the sign's own chroma, which is FREE
  because `EMITTER_CHROMA` is luminance-normalised — every entry has Y = 1.000,
  checked — so it is a hue change and not a brightness one. On one wall, 7 700
  pixels, as R/B:

  ```
    no sign light      R/B 1.620   Y 0.0763    the ambient sodium-lit wall
    white sign light   R/B 1.306   Y 0.0955    DESATURATED
    its own chroma     R/B 1.938   Y 0.0937
  ```

  **ADDING NEUTRAL LIGHT TO A ONE-HUE CITY MAKES IT MORE NEUTRAL, NOT LESS.**
  That is the trap in this bullet's own word "opposition": the lever is not
  *more light*, it is light of the OTHER hue, and a white emitter spends the
  budget and moves the frame the wrong way. Three of `SIGN_CHROMA`'s six are
  cold. What is left unspent is the windows, which are the larger area and are
  still warm.
- **Wet streets.** The road reflecting its own light sources is what makes a
  dark frame read as full of light rather than empty. See §6 — this is already
  built.
- **Light at pavement height.** Shopfronts, stall lamps, bus shelters, pillar
  faces. A pedestrian should be lit by something at their own level, not only
  silhouetted.

  **AND THE STREET LAMPS THEMSELVES WERE THE ANSWER TWICE OVER — SESSION 45.**
  The operator's complaint every time he walks at night is that street level is
  too dark, and `PLAYER.spawn` is on the origin block's pavement, where the lamp
  bowl was **0.2151× its own derivation** — 420 cd/m² against 1952.19. Session
  30 rationed it against `band:midnight`'s ceiling at a delivered 0.1112; the
  station landed in that frame in session 31 and the band has read 0.0741–0.0745
  ever since, so the 0.0021 of headroom it was rationed by is 0.0294. At the
  derivation the band reads **0.0826**, and **`band:dusk` — red since session
  40 — closed at 0.1410.**

  The second half is the POPULATION and it is the larger one. `LUMINAIRE`'s own
  derivation is *"a 15 m street with staggered poles both sides"* at *"an
  effective 15 m"*, `block.js` has built exactly that since session 3, and the
  streamed city put every pole on the **+x and +z pavement of its own chunk** —
  so no road in it had ever had a lamp on its other side, and the last 29–38 m
  of every block front had none at all. Both kerbs now, staggered, full length.
  `tools/shot-out/s45-{junction,viaduct}-t0-wet.png`.

  **IT COST NEGATIVE FORTY-SIX DRAW CALLS.** The near ring is 35 chunks and each
  emitted a `:lamps` and a `:bowls` mesh, so street lighting alone could ask for
  70 of the 440; merged city-wide the way the ground and the signage already
  are, it asks for 2. `highway_speed` 439 → **395 of 440**. The ceiling that has
  deferred five sessions of items is no longer the limiter.

  **AND HALF OF THEM WERE NOT LAMPS — SESSION 46, FROM THREE METRES.** The
  operator's fifth defect is *"the head, the arm and the column do not go
  together"*, and it was exact. `city.js` gave an axis-`z` column a yaw of +90
  and put its head at `spot.z − side · 2.1`; three's rotation about +Y takes the
  bracket tip at local `(−2.1, 0)` to `(0, +2.1)` at that yaw, so the lantern
  hung **4.2 m from the end of its own arm, on the other side of the pole.** The
  x-axis lamps agreed because 0 and 180 are the two yaws at which the two
  expressions coincide, and that is the whole of why forty-three sessions of
  frames did not show it. Measured on the delivered instance matrices as the
  distance from each column's arm tip to the nearest bowl: **165 of 344 columns
  had no bowl within a metre, at a median of 4.200 m; 0 of 382 after.** The head
  was the correct half — it is the one over the carriageway — so the repair
  turns the column and **moves no light in the city**. `promenadeLamps` had the
  same defect and a comment asserting the opposite rotation.

  **AND SIXTEEN PER CENT OF THEM STOOD IN THE ROAD.** `off` is the pole's
  distance along its own kerb from the chunk corner, and the corner IS a
  junction: `phase` runs 0 to 9 against a cross carriageway that reaches 7.5 m.
  **53 of 320 columns inside a delivered `ground:road` rectangle; 0 of 374
  after.** The registry could not have stopped it and that is the finding rather
  than the count: of 11 054 delivered claims, **172 carry an owner beginning
  `lamp:` and all 172 are PARK lamps — zero of the 382 street columns was
  covered by any claim at all.** `lampprobe.mjs` has printed that since session
  23. The column is claimed `prop` and the arm and bowl `canopy` now, and within
  one `citycheck` run the delivered census found **eight advertising pillars
  standing inside a lamp column**, worst 0.072 m² of a 0.09 m² footprint, as old
  as the pillars.

---

## 4. The street at eye level

The camera that matters is a person standing on the pavement. Everything here
is judged from about 1.7 m.

- **Crossings. THE PAINT IS NOT ABSENT — THAT WAS THE THIRD FALSE CLAIM IN THIS
  FILE, FOUND IN SESSION 33.** This bullet read *"currently absent and conspicuous
  by it"*. Session 21 built crossing markings into `citygen.js`'s road-marking
  path, and over `citycheck`'s own 10 × 10 region the generator delivers **2 077
  crossing stripes, with 82 of 100 chunks carrying a full four-approach set**.
  They render, in the streamed props mesh, at no draw call of their own.
  **What is actually missing is everything the paint is for**: nobody walks on
  it — the pedestrian model is a per-island perimeter loop and no agent has ever
  left the pavement — and no vehicle yields to anyone standing on it. A crossing
  with no one crossing is a texture. Judge this bullet from the pavement, not
  from the marking census.

  **AND THE STOP BAR IS ON THE RIGHT SIDE OF IT, IN 392 OF 392 PLACES — SESSION
  46, AND THIS IS A QUESTION BECOMING A STATEMENT PER §8.** The operator's third
  defect is *"a vehicle would stop ON the crossing rather than behind it"*, and
  nobody had checked the ORDER since session 33 rebuilt the crossings and
  session 44 took `minStopLineM` to zero. Out of the pure generator over
  `citycheck`'s own 10 × 10 at seed 1337, as the near and far EDGES of the
  delivered paint from the junction centre:

  ```
    stop bar   8.800 .. 9.200 m        zebra   7.550 .. 8.750 m
    approaches carrying both                                    392
      zebra entirely NEARER the junction than the bar           392
      bar nearer                                                  0
      overlapping                                                 0
    gap, bar.near − zebra.far      min 0.050  mean 0.050  max 0.050 m
  ```

  A vehicle meets the bar at 9.0 m, stops, and the zebra at 8.15 m is then
  between it and the junction. `stoplineprobe` says the same from the vehicle's
  end: over 21 583 frames with someone held at a red, **no settled vehicle is
  ever past its own line.** **The claim is false and the geometry is right.**

  **WHAT IS TRUE IS THE FIFTY MILLIMETRES.** The gap is a constant in all 392,
  because both edges are solved against the same two numbers with the same
  0.05 m clearance every join in this project uses — so from a pavement the bar
  and the zebra are one continuous band of white 1.65 m deep and which half is
  which is not readable. Widening it means moving `CITY.stopLineFromJunctionM`,
  which has three readers. **A look decision nobody has taken.**
- **THE ROAD HAS TO READ AS A ROAD, AND FOR A THIRD OF THIS CITY IT DID NOT —
  SESSION 45.** The operator's words about a noon frame: *"the road is the same
  pale tone as the pavement, no kerb reads, markings barely visible, the whole
  street reads as a plaza with vehicles on it."* Measured as a scanline across
  the section at x = 384, z = 300, seed 1337:

  ```
    pavement      202 code values        the origin block, same measurement:
    carriageway   188      14 apart        pavement 212, carriageway 151 — 61 apart
    kerb band     158                      and its kerb is a real one
    lane line     230
  ```

  **TWO CAUSES, BOTH SINGLE VALUES, AND `block.js` WAS RIGHT ABOUT BOTH.**
  `citygen.js` gives 34.7% of chunks a CONCRETE carriageway on a smooth noise
  field — so it comes in districts, not scattered — and `city.js` drew it at
  0.19 linear against a 0.26 pavement, which is 1.368× and which ACES at that
  exposure turns into exactly the 14 code values delivered. It is 0.11714 now,
  from CIE's own R1/R3 road-surface classes anchored on this city's own asphalt.
  And the KERB was not a kerb: the pavement quad is at 0.160 and the carriageway
  quad is at 0 and **nothing joined them**, so what you saw at every road edge
  in the streamed city was the world's earth plane through a 0.180 m slot.
  Delivered after both: a 35 code-value step at the kerb line and a face at 82.
  `tools/shot-out/s45-road-{before,after}-t0_5-dry.png`.

  **AND THE ORIGIN BLOCK HAD NO ROAD MARKINGS AT ALL**, which is why its
  61-value step still read as a plaza from some angles: nothing drew the
  boundary. No centre line, no lane line, no edge line, no stop bar, no zebra,
  in 336 m of main street — and it is the street `lookcheck` stands in and
  `PLAYER.spawn` puts a person on. It is a GUARD doing its job rather than an
  oversight: `citygen`'s `paint()` refuses any mark not covered by a delivered
  `carriageway` claim, and `BLOCK_KEEPOUT` clips the lattice's carriageway out
  of this block so the authored asphalt wins. The block paints exactly the
  ground the keep-out took now, from the same `ROAD_MARKING` and `ROAD_PAINT`
  the lattice reads. One draw call.
  `tools/shot-out/s45-marks-{before,after}-t0_5-dry.png`.

  **IT TOOK A LOOK ASSERTION RED AND THE THRESHOLD WAS NOT TOUCHED.**
  `distinct:midnight|dusk` reads 0.02995 against a floor of 0.03 — paint is
  bright at both of those times, so it adds the same pixels to both frames.
  Five of the six pairs clear that floor by 0.02 to 0.17 and this one has never
  cleared it by more than **0.00007**, against an instrument that resolves
  0.00001. It is §7's case exactly, and STATE 45's list carries it.
- **Parks and planting.** Green in a dense city is punctuation — small squares,
  a strip of trees, a fenced garden between two blocks. Parks exist as a block
  type; they read as dark empty ground at night.
- **THE FIVE DEAD-ZONE KINDS NOW READ AS FIVE DIFFERENT KINDS OF DARK, AND
  THAT IS A LIGHTING FACT BEFORE IT IS A GEOMETRY ONE.** A park lamp is 4.2 m
  at 870 cd — 0.128× a street lamp's peak delivering 0.50× its illuminance — and
  a car park's column is 10.0 m at 6 200 cd, **0.91× the peak delivering 0.63×
  the illuminance** (`LIGHT.carParkColumnCandela`, session 40, derived from
  `E = I·cos³(57°)/h²` at a 10 lx surface-car-park class). So a park is a small
  soft pool with a lit column in it, a car park is a dimmer wash from higher up
  over rows of parked bodywork, and a yard is two site floods pointing down into
  it. Three parcels that used to be one empty rectangle.
- **AND THE LARGEST GREEN IN THE CITY IS THE ONE NOBODY HAD READ THE NAME OF —
  SESSION 42.** The `weir` is 44 100 m², **63% of all landmark ground**, and it
  read from the air as a blank pale lid: **100.0% of its own disc lay within ten
  code values of that disc's median.** Its own LANDMARKS comment has called it
  *"a stormwater basin and sunken park"* since session 4, and there was no park
  in it.

  **IT IS ALSO NOT A WEIR, AND THE NAME IS THE ONLY THING THAT SAYS IT IS.**
  Measured from the generator's own river: **417.04 m from the nearest bank**,
  468.70 m from the centreline, 3.26 chunk widths of city in between. That is
  not a misplacement — `kind` is `basin` and a detention basin belongs in its
  catchment rather than on a channel — so the PLACEMENT is right and the WORD
  misleads. It cost one session an item, asking for *"water, a spillway, a
  channel, banks"*.

  **WHAT WENT IN IT CAME OUT OF THE SECTION AND NOT OUT OF THE WORD.** The floor
  falls 0.40 m over its 102 m, a slope of 0.39%, so a metre of water would stand
  at r = 255 m — four times the bowl. This is a DRY detention basin, and the
  first pool derived at the depth the floor allows (0.10 m, r = 25.5 m) TORE,
  because a 40-gon cone's chords sag 0.077 m at r = 25 and **a depth under the
  mesh's own faceting is not a depth**. So the outlet was dug to hold a
  permanent pool at 20% of the floor area, 1.50 m deep on a 1:4 bank, and it
  carries the river's own water shader at one `lights.patch(m, { water: true })`.
  With four flights of steps and sixteen stands of planting at 4 m, the disc now
  reads **47.3%** within ten code values of its median against 100.0%.

  **AND IT COST FIVE OF THE SIX DRAW CALLS THIS PROJECT HAD SPARE**, because
  `addInstanced` emits one mesh per CHUNK that owns a box and a 210 m bowl spans
  four of them. `highway_speed` stands at **439 of 440**. A ring of ledge
  planters that would have made it six was built, measured at 441, and removed.
- **THE WALLS WERE SMOOTH BOXES WITH WINDOW RECTANGLES DRAWN ON THEM, AND THE
  ERA TABLE ALREADY KNEW WHAT EACH ONE CARRIES — SESSION 43.** §5's device list
  has asked for *"encrusted facades"* since it was written and nothing had ever
  been bolted to a wall in this city: the only boxes on an elevation were the
  window lintel, the cill and the era's own spandrel or mullion, all of which
  are the wall rather than things ON it.

  It is derived from `CITY_ERAS` and not from the genre, which is §5's test
  applied to a wall. A **prewar** elevation carries a fire escape because it is
  old and was required to, external soil stacks because its plumbing was added
  after it was built, and **no ducting at all** because it is not
  air-conditioned. A **corporate** one carries ducting, intake louvres and
  condenser banks because it is — and **no fire escape**, because a building
  with protected internal stairs does not have one, which is exactly why it
  could be sealed. A **postwar** `band` rhythm is a ribbon window and the
  spandrel under a ribbon is where a through-wall unit goes. **`infill`** is the
  era whose written identity is a building patched over decades. **`contemporary`
  carries nearly nothing**, and that is the point rather than an omission.

  Delivered: **7 010 boxes and 104 fire escapes over the resident ring**,
  **439 draw calls before and 439 after**, +8 299 instances and +0.07 M
  triangles against a 2 360 000 ceiling. The small units are on the `near` ring
  and the silhouettes on `detail`, which is `buildFacade`'s own sentence one
  level down: a 0.3 m cabinet is the facade's bollard. The fire escape's
  projecting part is claimed as `canopy` and the guard has fired.
- **Layered depth.** Three planes in every frame: a dark foreground shape, a lit
  mid-ground, a hazed distance. Frames with only two planes read flat.
- **Variation over repetition.** The market stalls are the current failure case
  — one form, ten in a row, varying only in canopy colour. Any object placed at
  intervals needs form variation, not colour variation.
- **Things that are near are detailed.** Vehicles and people are what a walker
  gets close to. Architecture can stay coarse. Session 31 measured that per-class
  vehicle shape already costs zero extra draw calls via row instancing — the box
  cars are an authoring gap, not a budget one.
- **Vehicle silhouettes — angular on purpose.** The operator's words: he is not
  happy with the vehicles, but *angular is fine if it is futuristic*. So the
  target is not more detail. More detail on a box is a detailed box.

  Four devices, and the first is the only one that survives distance:

  - **A WEDGE.** A decided diagonal through the side elevation — low nose and
    high tail, or one unbroken rake. At thirty metres the silhouette is the
    whole of what reads, which is the finding the train's raked nose produced
    in session 23.
  - **ENCLOSE THE WHEELS.** Free wheels under a box read as an *attempt* at a
    car. Skirts and fairings closing to the ground remove the reference, and
    what is left is a vehicle rather than a bad car.
  - **LIGHT AS FORM, NOT LIGHT ON FORM.** Session 33 built four light
    signatures and they sit ON the body. The light bar should BE the leading
    edge of the wedge — the shape and the emitter the same object.
  - **A DIFFERENT LANGUAGE PER CLASS.** The hauler industrial and slab-sided,
    the pod a closed shell, the bus one long unbroken volume. Today the seven
    types share one vocabulary and differ mainly in scale.

  Two gate reds already say the same thing from the other side, on
  `highway_speed`: only 73% of vehicles have a dark gap at the ground against a
  75% floor, and only 63% carry a non-monotone tone profile against 75%. A
  monotone tone profile is a body with no surfaces that catch light
  differently — a flat slab. Both move the right way under the four above,
  which is what makes them evidence rather than a coincidence.

---

## 5. What NOCTIS is not

- Not a Blade Runner reproduction. Reference, not target.
- Not a ruin or an abandoned city. It is busy.
- Not photoreal. Flat-shaded, deliberately. The look comes from light, colour
  and density — not from polygon count or texture detail.

**THE DEVICES ARE THE TARGET; THE QUOTATION IS NOT.** Session 34, because as it
stood a reader took the three bullets above as forbidding the aesthetic
outright, and they do not.

The **devices** are wanted: a wet road that doubles every light, cold against
warm, signs that light the air, angular vehicles, encrusted facades. Not
because they are cyberpunk — because that is what a dense night metropolis in
2049 looks like, and each of them is a consequence of something this city
already has.

The **quotation** is not wanted: no restaged shots, no genre signifier placed
because it signifies. The test is the one §2 already applies to density —
**anything here should be derivable from something the city already has**: the
river, the viaduct, the railway, the money, the weather, the age of a wall. A
device you can derive is content. A device you can only justify by naming the
film it came from is set dressing, and it will read as set dressing.

---

## 6. Already built, never *looked at*

`weather.js` implements wet film, puddle roughness, Fresnel reflectance for
water and a screen-space reflection gate. `ssr` defaults to 1.

**AND IT IMPLEMENTED THE RAIN ITSELF, WHICH IS THE SAME SENTENCE ONE LAYER OUT
AND TOOK ELEVEN MORE SESSIONS TO NOTICE.** Session 44: 500 streaks, 130 splash
crowns and 70 spray puffs, a Marshall–Palmer split at D = 3.28 mm deciding
which drops are billboards and which are the veil, and an extinction that takes
the meteorological visibility from 8.69 km to 1.95 km — all of it gated on
`rainfall`, which had a setter, a harness method, a HUD readout and no caller.
Every one of those layers renders, at **zero draw calls**, because the three
meshes are `frustumCulled = false` and are in the count whether it is raining or
not: 294 draws at rainfall 0 and 294 at full rain, measured in five arms of one
sweep. Delivered at r ≥ 0.15: **streaks 500 of 500, splashes 130 of 130, spray 0
to 4 of 70** depending on whether a vehicle is in the near field.

**AND "EVERY ONE OF THOSE LAYERS RENDERS" WAS TRUE AND WAS NOT ENOUGH — SESSION
45.** All three multiplied a MEAN radiance by a SHAPE whose mean over the same
quad is not 1, so all three shipped a fraction of their own derived flux for
eleven sessions: **streak 0.280, splash 0.481, spray 0.306.** A shape may
redistribute energy; it may not remove it. `makeLayer` takes the integral beside
the shape now and THROWS without it, because a default of 1 is how this comes
back. It is also half of STATE 44's *"the splash crowns are at the edge of
visible"* — the other half is that the crowns, like the streaks before them, are
the population above 3.28 mm and every smaller drop also splashes.

**THIS SECTION USED TO SAY "never seen", AND THAT WAS WRONG — MINE, AND CORRECTED
IN SESSION 33.** It read *"every frame in this project's history — every gate
frame, every screenshot in every STATE — is a dry street"*, and the
counter-example is a gate. `lookcheck` captures **dry and wet at all four times
of day** (`look-budget.json` → `wetness.value` = 1.0), writes
`tools/look-out/{midnight,dawn,noon,dusk}-wet.png`, and asserts four bars on the
wet side specifically — road specular spread ≥ 1.6× dry, a minimum dry↔wet MSD,
an elongated-SSR reflection count, and the per-frame quarantine and
cluster-overflow checks. `night_rain` has run at `wet: 0.85` for many sessions.

**The narrower truth, which is the whole point.** `main.js` → `wet: 0`, so the
running app and every `lookat` frame is dry. The water has been measured for many
sessions and never *looked at*.

**AND "EVERY SCREENSHOT IN EVERY STATE IS DRY" STOPPED BEING TRUE IN SESSION 41.**
That clause stood in the sentence above from session 33 to session 40 and is
corrected in place rather than left to go stale a fourth time (§8). Session 41's
walk was taken at `?wet=1` — six frames,
`tools/shot-out/s41-{before,after}-{walk,turned,run}.png`, at 1.7 m, midnight, on
the pavement, driven by real keys and a real mouse through the real pointer lock.
`s41-after-turned.png` is a wet street doubling four shopfronts with two
pedestrians in silhouette against them, and it is the frame this section has been
asking for since session 33. **The default in `main.js` is unchanged and is still
`wet: 0`** — what changed is that somebody stood in the water, which is all §6 ever
asked for. STATE 41 §6.2.

The same frame confirms §3's *"NOCTIS is currently monochrome amber"* by eye, which
that bullet has never had a frame for: **one green pedestrian-signal dot is the only
cold light in 1280 × 720.** A statement with a picture behind it now, per §8.

    localhost:5173/?player=1&wet=1&t=0.0

That default is what session 33 was told to change, and changing it moves every
band in `look-budget.json` at once — see §7 for what is owed when it does.

---

## 7. How this document relates to the gates

The gates were derived against earlier versions of this city. Several of their
thresholds now measure a city that no longer exists:

- the 6.00% bright-reserve floor, derived under a camera veil session 27
  removed, and since excluded by three independent mechanisms;
- `band:noon`, whose margin is smaller than its own run-to-run spread — **and it
  is now equal to it, measured, session 36: delivered 0.4281 against a floor of
  0.428, a margin of 0.0001, against a run-to-run spread of 0.0001 over three
  runs.** It lost 92% of that margin to 37 buildings.

  **AND THE MECHANISM SESSION 36 INFERRED FROM THAT DID NOT FIRE. THE
  INFERENCE WAS MINE AND IT IS WITHDRAWN.** This bullet went on to say *"at noon
  the sun is at 58° and more buildings mean more shadow, so a floor on the noon
  mean is a ceiling on density"*, and three consecutive briefs carried it as the
  reason density was blocked. **Session 37 added 161 buildings — 4.4× session
  36's 37, +30% over the region — and `band:noon` moved 0.4281 → 0.4281, a delta
  of 0.0000 against an instrument that resolves 0.0001 over three runs.** The
  other three moved by 0.0001, −0.0012 and −0.0003. So the noon floor is not a
  ceiling on density at any rate this project can reach with this knob, and the
  0.0011 session 36 attributed to 37 buildings has no surviving mechanism —
  `lookcheck` stands in the origin block, which `block.js` authors and the
  generator never touches (STATE 35). **`band:noon` is GREEN and nothing was
  owed on it.** What actually went red is in `tools/city-budget.json` and
  `tools/budget.json`, beside the numbers, dated.

  **AND THE BRIGHT RESERVE MOVED THE OTHER WAY, WHICH IS THE SAME CORRECTION
  FROM THE FRONT.** §2 spent four sessions being told that density costs light.
  `citycheck`'s 6.00% bright-reserve floor had been RED FOR SIX SESSIONS — 5.67%
  at s35, 5.33% at s36 — and at `d^0.50` it reads **6.37% and is GREEN**. More
  buildings on a night route is more lit windows. The gate that was supposed to
  argue against density was fixed by density;
- 76 of 189 bounds with no recorded derivation at all.

**A look threshold is evidence, not a verdict.** When a change moves the city
toward this document and moves a look band the wrong way, the correct response
is to ask what that band was derived from — not to abandon the change.

That is not permission to tune thresholds green. It is a statement about which
document wins: this one describes the goal, and the gates measure proxies for
it. A proxy that now argues against the goal is a proxy that needs re-deriving,
in the open, with the reason and the date written down.

The occupancy registry is a different matter and keeps its authority: nothing
may stand inside anything else, whatever it looks like.

### SHOULD A GATE EVER SEE RAIN? — A QUESTION, SESSION 44

Written as a question and not a statement, per §8. Session 44 made rainfall a
CONTRACT §6 parameter with a shower cycle behind it, and **no gate sees a drop
of it.** That is by construction rather than by luck: `runRoute` calls
`setTimeOfDay`, which pauses the simulated clock, so the longest route in the
project advances `time.now` by 5 s against a dry stretch 872 s wide. Every
threshold in `look-budget.json`, `city-budget.json` and `budget.json` therefore
still measures the clear-air city it was derived against, and **not one of the
four luminance bands moved** — 0.4288 / 0.3021 / 0.1393 / 0.0741, three runs
each, spread 0.0000.

Which is either exactly right or exactly wrong, and nobody has decided:

> This document's own §1 says the mood reference is **rain-lit** neon. A city
> measured only in clear air is a city whose instruments have never seen the
> weather it is supposed to look like. Against that: `budget.json` →
> `capture.params` is one line, and adding `rainfall` to it re-bases every
> millisecond, every band and every reserve this project has recorded against
> different content — which is the cost §7 spends its whole length being careful
> about.

It is the operator's decision. `?rainfall=` is how a frame gets rain today, and
`tools/shot-out/s44-{rain,lamp}-{before,after}-t0-wet.png` is what that looks
like.

---

## 8. How to use this

Sessions should cite the section they are serving. A session brief that cannot
name one is probably instrument work, and instrument work now needs a reason.

Edit this file when the picture changes — it is the operator's document, and
anything here he disagrees with is wrong by definition.

### A DEFECT GOES IN THIS FILE ONLY AFTER IT HAS BEEN MEASURED

Three claims in this document have been false and all three were written here
as statements of fact: the 23 empty chunks, "never seen", and "crossings
currently absent". Each cost a session — two of them cost a session that went
looking for a defect that was not there, and one of them (§4's crossings) had
been shipped thirteen sessions before the sentence saying it was missing.

The rule that follows from that is cheap:

> **A defect is written here as a STATEMENT only if a number has been printed
> for it. Anything entered on a guess is written as a QUESTION** — *"are
> crossings present?"*, not *"crossings are absent"* — and the session that
> answers it converts the question into a statement with the number attached.

A question in this file is not a weaker claim. It is an honest one, and it is
work somebody can pick up: a question costs the next session ten minutes with a
probe, where a wrong statement costs it a whole item.

The same rule applies to a number this file quotes from somewhere else. Cite
the instrument and the region — *"692 signs over `citycheck`'s 10 × 10 at seed
1337"* — because a count with no population behind it is a number that cannot
be checked and therefore cannot be wrong, which is the property §7 says a proxy
must never have.
