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

  It still cannot light the air around a SIGN, and that is a fact about the
  light list rather than a choice. Session 44 re-confirmed it against a better
  instrument than the one session 43 used — `perfcheck`'s own light-role census,
  which enumerates every light in the world by role and prints it beside each
  route: `aircraft:1  traffic:96  stall:12  block:56  lamp:192`. **THERE IS NO
  SIGN ROLE, AND THERE ARE 975 SIGNS.** They and every window are emissive
  materials with no candela attached, so there is nothing for a scattering model
  to integrate. The air glows around those 357 and around nothing else.
- **Colour opposition.** This is close to free and it is the biggest unspent
  lever. NOCTIS is currently monochrome amber — nearly every emitter is warm.
  The reference works because cold cyan fights warm sodium in the same frame.
  A third of emitters should be cold.
- **Wet streets.** The road reflecting its own light sources is what makes a
  dark frame read as full of light rather than empty. See §6 — this is already
  built.
- **Light at pavement height.** Shopfronts, stall lamps, bus shelters, pillar
  faces. A pedestrian should be lit by something at their own level, not only
  silhouetted.

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
