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
- **THE LIMITER IS THE OCCUPANCY REGISTRY, NOT DRAW CALLS AND NOT BATCHING.**
  Session 32 measured the fill law one exponent further on (`d^1.4` → `d^1.2`,
  480 → 515 buildings) and the delivered scene carried **one forbidden overlap,
  `sign(adpillar) × prop(planter)`, 0.061 m²**. §7 reserves the registry's
  authority absolutely, so that is the stop. The three ceilings people expected
  are all slack: **+31% buildings cost +2 draw calls** (430 → 432 of 440), 1.57 M
  triangles of 2.00 M, and 2–3 ms of frame-time margin. And a merged building
  pool does not help: the frustum test **rejects 54–60% of the city's triangles**,
  so one pool would submit **1.90 M against the 2.00 M ceiling** before the sky,
  the traffic, the people and the stalls. The per-chunk meshes are doing the
  culling work.
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

  **AND THE OTHER KNOB IS STILL THE SHORT ONE.** Coverage is depth × frontage
  and they multiply: depth now stands at **0.73 of the reference ring** and
  frontage occupancy at **0.244** (STATE 32). Nothing about this bullet closes
  the bullet above it. **From the street the deepening is nearly invisible** —
  session 35's own frame pair says so — because a gap in a street wall is a
  frontage fact and depth grows the other way. What it changes is the view from
  the air and the view past a corner.
- **Heights are lognormal, not an even comb.** Mostly six to twelve storeys,
  with occasional towers standing well clear. `citygen.js` already carries the
  argument and both measured arms: sd/mean 0.664 against today's 0.425, p99
  134 m against 65.
- **Density has causes.** A river, a viaduct, an elevated railway with stations
  — the city already has all four and nothing reads them. Land by water and by
  transit gets built tall and to the line. Land under a viaduct gets sheds and
  yards. A station mouth concentrates frontage around it. A city generated from
  noise looks generated however dense it is.

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
- `band:noon`, whose margin is smaller than its own run-to-run spread;
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
