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

---

## 2. Density — what it concretely means

The single largest gap between NOCTIS today and the reference is not detail.
It is that the street wall is broken.

- **Buildings meet the lot line.** A block's frontage is continuous. Where a
  parcel is empty, it is empty *for a reason* — a yard, a site, a park — not
  because a noise field came out low.
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
- **Holograms.** Emissive, semi-transparent, above the street and at junctions.
  New content, not yet present in any form — checked, session 34: nothing in
  `citygen.js` or `city.js` emits a transmissive or additively-blended quad
  anywhere, so this bullet is a statement about absence and not a guess.

  What makes a hologram read is that it does not obey the street: it hangs in
  air nothing supports, it is brighter than the wall behind it, and you can see
  through it to the wall. A hologram that reads as a lit billboard is a lit
  billboard, and this project already has 692 of those.
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
running app, every `lookat` frame and every screenshot in every STATE is dry. The
water has been measured for many sessions and never *looked at*.

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
