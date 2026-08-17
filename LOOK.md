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
- **Holograms.** Emissive, semi-transparent, above the street and at junctions.
  New content, not yet present in any form.
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

---

## 5. What NOCTIS is not

- Not a Blade Runner reproduction. Reference, not target.
- Not a ruin or an abandoned city. It is busy.
- Not photoreal. Flat-shaded, deliberately. The look comes from light, colour
  and density — not from polygon count or texture detail.

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
