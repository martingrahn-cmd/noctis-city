# NOCTIS — STATE

*End of session 30. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
MacBook Air, Mac17,4, **Apple M5**, 10 cores, 32 GB, macOS 26.5.2, `node v25.9.0`. Every
gate that reads a pixel printed `ANGLE (Apple, ANGLE Metal Renderer: Apple M5)`.
**load1 was 1.22 at the first command of the session** — under CONTRACT §0.2's bar of 1.6
and also under its recorded floor of **1.32**, which §0.2 says prints a stale-floor note
rather than being silently accepted. By gate time it ran **2.0 to 5.9**, and the largest
third-party contributor is named rather than guessed: **ComfyUI's python at 84.5% CPU**,
which is the operator's own process and was not killed. So for the fifth session running
**NO MILLISECOND IN THIS PROJECT IS ADMISSIBLE**, and none is quoted as a verdict. Counts,
draw calls, instance counts and pixel fractions are quoted, because counts do not drift
(§9 rule 6's corollary).*

---

## 0. THE VERDICT ITEM 0 WAS ASKED FOR — AND THE MEASUREMENT THAT OVERTURNED IT

The brief asked, before anything was built: **can the origin block be brought to parity
with the streamed city inside the current bands — fully, partly, or not at all?** It asked
for the answer stated before building, and warned that "not achievable" would be the
session's most valuable result.

> **THE ANSWER IS YES, FULLY. Every one of session 28's three content systems now stands
> in the origin block — the lamp derivation half-repaired, the retail decoupled, the
> advertising pillars built — plus bus stops on both paths, and `band:midnight` ends the
> session at 0.1111 against a ceiling of 0.112 with 0.0009 of headroom left. `band:noon`,
> which session 29 broke, is GREEN, and `lookcheck` is down from three reds to the two it
> carried in from before session 27.**

**AND THE PRE-BUILD ESTIMATE SAID THE OPPOSITE, BY A FACTOR OF SIXTEEN.** That error is
the more useful half of this section, because it is CONTRACT §9's own failure mode
committed inside the instrument built to prevent it (§7.7).

### 0.1 What the estimate was, and why it was wrong

`tools/blockprobe.mjs` is new. It walks the live scene and reports every emitter as an
**AREA times a RADIANCE**, m²·cd/m², measured as the sum of each mesh's own triangle areas
under each delivered instance matrix. Item 0 calibrated that product against
`band:midnight` by zeroing four known emitters in turn — the only calibration available —
and predicted what parity would cost:

```
  emitter zeroed              area x nits    delta band:midnight    slope
  block lit windows  (558)         59 831         -0.0057           9.5e-8
  block lamp bowls    (16)          5 265         -0.0031           5.9e-7
  block shop bays     (37)          2 322         -0.0004           1.7e-7
  STATE 28's 210 -> 1952 arm      +43 700         +0.0096           2.2e-7   <- the only ADDITION
```

The lamp arm is the CONTROL (§7.7): it reproduces STATE 28 §3.2's independently measured
−0.0030 to within 0.0001, which is what says this instrument is measuring the thing it
claims to.

Predicted for ten pillars at 33 326 m²·cd/m²: **+0.0073** on the addition slope, +0.0196
on the steepest, +0.0032 on the shallowest — over a 0.0032 headroom on every one of the
four. Verdict recorded before building: *pillars not achievable, retail achievable.*

**Delivered: nine pillars at 29 993 m²·cd/m² cost +0.0004.**

The instrument's own header says why, and I used it as a predictor anyway: *"that product
is NOT a luminance and does not predict a mean on its own."* **The quantity a frame mean
responds to is PROJECTED SOLID ANGLE.** All four calibration points were emitters that are
either numerous and spread over the whole frame (558 lit windows) or bright, close and
large in the image (sixteen bowls at 8.4 m). An advertising pillar's face is 0.87 × 2.55 m,
stands 40 to 160 m down the street, and **faces across the pavement** — so a camera looking
along the street sees it edge-on. Look at frame 5: nine columns, almost no new light.

### 0.2 The headroom, and the brief's own arithmetic

The brief says `band:midnight` "sits at 0.1088 against a ceiling of 0.112 — 0.0024 of
headroom". **0.112 − 0.1088 = 0.0032**, 33% more than the brief claims. STATE 28 carried
the same slip in the same place (0.0021 quoted at 0.1091, where the arithmetic gives
0.0029), so this is an inherited number rather than a new one. **This is the eighth
consecutive brief with a false premise and the fifth caught by arithmetic.**

### 0.3 The assertion with no margin at all is not the one the brief named

Baseline, three runs each, on the branch as session 29 left it (`23434e5`):

| assertion | run 1 | run 2 | run 3 | bound | margin | spread |
|---|---|---|---|---|---|---|
| `band:midnight` | 0.1088 | 0.1088 | 0.1087 | ≤ 0.112 | +0.0032 | 0.0001 |
| `band:noon` | 0.4277 | 0.4276 | 0.4277 | ≥ 0.428 | −0.0004 **RED** | 0.0001 |
| `band:dusk` | 0.1444 | 0.1444 | 0.1444 | [0.140, 0.180] | +0.0044 | 0.0000 |
| `groundPools` | 11 | 11 | 11 | ≥ 6 | +5 | 0 |
| **`facadeAlbedo` clusters** | **4** | **4** | **4** | **≥ 4** | **0** | **0** |
| `facadeNeighbours` min | 0.611 | 0.613 | 0.611 | ≥ 0.3 | +0.311 | 0.002 |
| bright reserve | 4.88% | 4.73% | 4.91% | ≥ 6.00 | −1.12 **RED** | 0.18 |
| saturation peak | 2.98% | 3.01% | 2.95% | ≤ 12 | +9.0 | 0.06 |

`facadeVariation.minAlbedoClusters` delivers **4 over 5 walls against a floor of 4, with
zero margin and zero spread**. It survived this session untouched because it is measured at
dusk on five rects that run y 0.06–0.46 of the frame — the UPPER facade, above every
ground-floor treatment — and every content change here is below 3.5 m. That is luck with a
reason, not safety, and the next session that touches an upper facade should know it.

### 0.4 The deeper finding the brief asked about, and it holds

Of everything with a centroid inside the look camera's frustum, the origin block's own
emitters are **0.30%** of the area×radiance and the streamed city is **97.96%** — and yet
zeroing the streamed city's lamps moves `band:midnight` by **0.0000** (STATE 28 §3.2) while
zeroing the block's own windows moves it by **0.0057**. The city behind the block is
occluded by the block.

> **The 0.112 ceiling is a statement about a hand-built ten-building set piece, not about
> this city.** Same shape as the 6.00% bright-reserve floor derived under a veil that no
> longer exists, and as `band:noon`'s margin being smaller than its own spread. **No
> threshold was moved. This is evidence for the three open questions, not a licence.**

---

## 1. LOOK AT THESE FIRST, IN THIS ORDER

Every frame is the same seed. Frames 1–6 are the **operator's own street pose** — the one
he pointed at — and each is cumulative on the one above it. Frame 7 is the only new pose
and it was ray-tested with `tools/poseprobe.mjs` **pinned to one distance**
(`--dmin=--dmax=16`), which is the discipline session 27 established after reading an
aggregated azimuth line as an answer for a single stand-off.

| # | file | what changed | what it cost |
|---|---|---|---|
| 1 | `s30-street-before-t0.png` | The branch as session 29 left it. | — |
| 2 | `s30-paint-after-t0.png` | **Item 2.** Vehicle paint. The two nearest bodies go from near-black to cream and white. | Nothing on any bound. |
| 3 | `s30-retail-after-t0.png` | **Item 3b.** Ground-floor retail decoupled from era. 8 lit ground floors of 10 against 6. | +0.0005 of `band:midnight`. |
| 4 | `s30-pillar-after-t0.png` | **Item 3c.** Nine advertising pillars on the block's own pavements — the dark columns on both kerbs. | +0.0004, and `band:noon` went green. |
| 5 | `s30-lamp-after-t0.png` | **Item 3a.** The block's lamp bowl 210 → 420 cd/m². The lamp head top-right is visibly a lamp. | +0.0014, leaving 0.0008. |
| 6 | `s30-busstop-street-t0.png` | **Item 4.** Bus stops. At this pose the block's east stop is 48 m away on the right, the small bright mark on the near-right pavement. | Zero new box draws; one new mesh in the block. |
| 7 | `s30-busstop-block-t0.png` | **The bus stop, close.** Roof, post, bench, and the lit timetable case doing the work. | 196 draws. |

Two more, kept because they carry their own argument: `s30-paintoblique-after-t0.png` is
frame 2's subject at session 29's own oblique pose, so the paint can be compared against
`fleetoblique-after-t0.png` at the same camera; `s30-paint-noon-after-t0_5.png` is the noon
frame, where the white van is the only vehicle legible at range.

```
1-6  node tools/lookat.mjs --pos=70,1.74,0.9     --target=-70,1.0,-0.6   --fov=55 --t=0.0
7    node tools/lookat.mjs --pos=33.31,1.74,2.74 --target=22.0,1.6,-8.57 --fov=45 --t=0.0
 (2') node tools/lookat.mjs --pos=34,1.74,9.4    --target=-30,1.9,1.5    --fov=50 --t=0.0
```

---

## 2. WHAT WENT ON THE BRANCH

Session 27's branch, `claude/noctis-25-building-floors-89bqul`, above session 29's four.
**NOTHING MERGED TO MAIN**, as instructed. Each commit is independently revertible.

```
  cf5a112  item 4b — three defects the gates found, two of them item 1's trap again
  cc071f7  item 4  — bus stops, both content paths, and a datum the frame caught
  c092e90  item 3a — the block's bowl 210 -> 420, and the ratchet moved in behind it
  0fb29eb  item 3c — nine pillars, and the estimate that said they could not fit
  2e1ff1c  item 3b — retail is a property of the street here too
  3839b43  item 2  — the palette had the spread and the fleet did not
  aa51c9a  item 1  — the pillar's carriageway test ran before the carriageway existed
  f4ba145  item 0  — tools/blockprobe.mjs, the instrument
  23434e5  STATE 29  <- session 29's head
```

**ONE NUMBER MOVED IN A BUDGET FILE AND IT IS A TIGHTENING.** `city-budget.json` →
`lampBowl.minRatio`, **0.1075 → 0.2151**, which is the direction its own definition
compels: *"a session that repairs one moves its bound in and cannot move it back."* A
session that puts the origin bowl back at 210 now fails `citycheck`. `look-budget.json`,
`budget.json` and `input-budget.json` are **byte-identical to session 29**.

---

## 3. ITEM 1 — A GUARD THAT COULD NOT FIRE, AND NOW FIRES ON NOTHING

STATE 29 §7.2 found it by reading: `buildChunkBody` pushed the delivered ground rectangles
into `placed` at the END of the function, below the advertising pillar's `hitsClaim` test —
whose own comment says it refuses a pillar that would stand in a carriageway, and
`carriageway` is the one category `occupancy.js` forbids a freestanding `sign` from
sharing. **The single category the test existed for was the single category the list did
not contain.**

Moved to the top of the function. Safe for every other reader because there is only one:
`placed` is read twice in `city.js`, and the pylon's `signClash` filters `p.kind === 'sign'`
and cannot see a ground rect whatever the order.

**MEASURED IN BOTH DIRECTIONS (§7.3), because "the guard now runs" is itself a claim about
a guard and this project has shipped four that could not fire:**

```
  PILLAR_PAD   ordering   delivered   refused: block / building / claim / GROUND
  0.85 (ships)   new         190        0 / 1 / 14 / 0
  2.20           new         142        0 / 1 / 22 / 40
  2.20           old         176        0 / 1 / 28 / 0
```

At a pad wide enough to reach a kerb 4.2 m from the elevation it refuses **40** under the
new ordering and **0** under the old one, so the wiring is live. At the pad that ships it
refuses **zero**, and the geometry is why: 2.6 m of standoff plus 0.85 m of pad against
4.2 m of pavement clears the carriageway by **0.75 m**.

> **190 pillars before, 190 after. This change delivers no pixel, and that is the finding
> rather than a disappointment.** A guard that fires on nothing is worth knowing about.

Refusals are now counted **by cause** in the chunk census. One total cannot say which of
three tests did the refusing, and which test did it is the whole question.

---

## 4. ITEM 2 — THE PALETTE HAD THE SPREAD AND THE FLEET DID NOT

**The brief's premise is half wrong and the measurement says which half.** *"Paint is the
third axis and it has never been touched"* — session 9 built the table, and it already
carried silver at Rec.709 luminance 0.318 and off-white at 0.465. What it did not carry was
a **distribution**:

```
  luminance ladder, before   0.047 0.048 0.053 0.054 0.062 | 0.123 0.318 0.465
```

**Five of eight inside a 1.32× band at the bottom**, and `bodyAlbedo` walked the table at a
fixed stride — `PAINT[(vi*7 + type*3) % 8]` — so every entry was drawn equally often and
**62.5% of a 160-vehicle fleet was painted inside it**, against a night carriageway that
delivers 0.05–0.10. A stride cannot express a distribution. CONTRACT §7.2 with a palette
instead of a body type: the count of colours was right and the property it stood for was not.

**A LADDER AND A WEIGHTED DRAW.** Five new rungs — white 0.698, cream 0.421, mid grey
0.177, pale blue 0.148, livery red 0.095 — take it to thirteen entries over **14.9×**, and
`PAINT_WEIGHTS` gives each class its own distribution on a new named stream `traffic:paint`.

- **The car row is derived from the real European new-car colour census** (white 27 / black
  22 / grey 22 / silver 8 / blue 10 / red 5) and reproduces every band inside three points.
- **Commercial bodies carry two thirds of their weight at the light end**, because a van is
  bought white and signwritten afterwards.
- **A bus takes a LIVERY** — three entries, one dominant — because an operator paints a
  fleet and not a vehicle. Same argument session 29 used to give buses discrete lamp
  clusters rather than a styling light-line.

```
  delivered share    dark <0.07   mid    light >=0.30    fleet mean paint luminance
  before                 62.5%   12.5%       25.0%                   0.1461
  after                  30.1%   20.5%       49.4%                   0.3043
```

**AND THE COMMENT OVER THE TABLE CLAIMED A PROPERTY THE TABLE DID NOT HAVE.** *"the closest
pair is 0.088 apart, which is 4.4× the threshold"* — measured over all 28 pairs the closest
is **graphite/silver at 0.0082**, which is 0.41× it. They are meant to be: three entries are
NEUTRALS, and a neutral is defined by having no chromaticity to separate. The floor is now
stated over the pairs it can apply to (closest chromatic pair teal/pale blue, **0.0608**)
and the neutrals separate by luminance, which is the axis this session added.

### 4.1 THE RESERVE DOES NOT MOVE, AND THE ARITHMETIC SAID SO BEFORE THE MEASUREMENT

```
  bright reserve (floor 6.00)   before 4.88 / 4.73 / 4.91   after 4.82 / 4.43 / 4.88
  saturation peak (ceiling 12)  before 2.98 / 3.01 / 2.95   after 2.98 / 2.89 / 2.96
  band:midnight                 before 0.1088 x3            after 0.1087 / 0.1088 / 0.1088
  band:noon (floor 0.428)       before 0.4277 0.4276 0.4277 after 0.4279 0.4280 0.4279
  groundPools (min 6)           before 11                   after 11
```

The brief's hypothesis was that a white van differs from every lever sessions 28 and 29
tried because it is **large area AND high reflectance**. It is — and **reflectance is not
radiance**. A white flank at ρ = 0.70 under `LIGHT.streetAverageLux` = 16 lx delivers
**3.56 cd/m²**: thirteen times the graphite it replaces, and still **59× below** the block's
own lit window at 220. The reserve counts pixels above HSV value 0.5 in a frame metered for
emitters, and paint is two orders of magnitude from that line.

> **So the third axis fails for a DIFFERENT reason from the first two, rather than for the
> same one.** Sessions 28 and 29 established that emissive AREA does not move the reserve
> because the auto-exposure gives back what it adds. Paint does not move it because a
> reflective surface under street lighting never reaches the threshold at all. That is one
> more independent arm on the 6.00% floor question and it is still the operator's call.

`band:noon` moved the right way — median 0.4277 → 0.4279, red by 0.0001 where it was red by
0.0003 — and **the palette was chosen from the colour census, not tuned to that number**, as
the brief required. It is inside the assertion's own 0.0001–0.0004 spread and is therefore
not a verdict either (§0.1).

---

## 5. ITEM 3 — THE ORIGIN BLOCK, ALL THREE SYSTEMS, IN THE BRIEF'S OWN ORDER

Measured after each, three runs each. **Nothing broke a band, so nothing was stopped at.**

```
                            band:midnight   noon     dusk    pools  facadeAlbedo  headroom
  session 29 head             0.1088       0.4277   0.1444    11         4         0.0032
  + item 2, paint             0.1088       0.4279   0.1445    11         4         0.0032
  + item 3b, retail           0.1093       0.4280   0.1445    11         4         0.0027
  + item 3c, pillars          0.1098       0.4291   0.1448    11         4         0.0022
  + item 3a, lamp 210->420    0.1112       0.4291   0.1454    11         4         0.0008
  bound                       <= 0.112     >= 0.428 [.14,.18] >= 6      >= 4
```

**`band:noon` IS GREEN.** Session 29 put it red at 0.4277 against a 0.428 floor and
recorded the mechanism — longer bodies covering more bright road with dark paint. Item 2
gave back 0.0002 and item 3c gave back 0.0011. **No threshold was touched.**

### 5.1 3a — the lamp derivation: how far the block's factor can move, measured

Swept on this session's head, one `lookcheck` per arm:

```
  originNits       0      210      420      630      1952
  band:midnight  0.1057  0.1098   0.1112   0.1125   0.1187 (STATE 28)
  ceiling 0.112    ok      ok      SHIPS     RED      RED
```

**420 ships.** It leaves **0.0008** of headroom against a run-to-run spread of **0.0001** —
eight times the instrument's own resolution, which is a margin §0.1 permits a decision on.
The crossing is at about **550**, and shipping there would leave a margin smaller than the
spread, which is exactly what §0.1 forbids. **The last 30% of the available range is
deliberately not taken**, and that is stated here rather than left to be rediscovered.

The block's departure from the derived Φ/(πA) = 1952.19 cd/m² goes **9.30× → 4.65×**. The
streamed city's 4.61× is untouched — STATE 28 measured that correction as a *dimming* worth
1.39 points of a reserve already short, and nothing here changes that.

### 5.2 3b — retail, and session 28's rule did not transplant, twice

**THE BRIEF SAID TO CHECK THE ERA TABLES FIRST AND THEY MATCH.** `block.js`'s `ERAS`
carries prewar/shopfront, postwar/blankPlinth, corporate/colonnade, infill/recessed — the
same four ids against the same four treatments `CITY_ERAS` uses. What does *not* match is
how much was already lit: `glazedRun` is called by **three** of the four treatments here and
the fourth already gets a lit service door, so the origin block stood at **60% lit ground
floors** where the streamed city stood at 50.5%.

Both failures of the transplant are the **sample size**, and the block has FOUR frontages
where an island has four sides per island across the whole city:

1. **A BERNOULLI ROLL IS A LOTTERY AT n = 4.** Shipped first at p = 0.55; the delivered
   street was **5 lit of 10 against the 6 it replaced**. The expectation was 7.3; the
   count's standard deviation is 0.99 on a mean of 2.2, so one street in eleven trades
   everywhere and one in twenty nowhere. A **choose-k** has the same mean and zero variance
   in the count, and turns the floor from an expectation into a construction. **k = 2 of 4.**
2. **THE CORNER-SHOP EXCEPTION PASSED THE COUNT AND FAILED THE FRAME.** With session 28's
   rule — the unit at the end of the run where the cross street is — the draw put both
   trading runs west of the crossing, so the operator's own pose **lost the lit shopfront
   20.6 m in front of him** and gained two frontages 100–160 m away. 8 of 10 lit by count,
   and a street that got darker where he stands. §7.2 again, with a retail roll. The
   exception is now **architectural**: a prewar shopfront is a shop unit with no other use
   and lights whatever its run rolled; a blank plinth, a colonnade and a recessed front are
   the three whose ground floor may be let, and those are what the roll decides.

Delivered: **8 lit ground floors of 10** — 2 runs of 4 trading, **12 openings punched in
three blank plinths**, 19 shop lights against a cap of 23. **The floor over all six
pairings is 5 and not the 6 this session first wrote**, and that correction came from the
adversarial pass in §12: the three shopfronts sit in R0, R1 and R3, so **R2 has none**, and
trading exactly the two two-building runs leaves 2+2+1. Had the shopfront-free run been a
two-building one every pairing would give 6 or 7. **So the floor is a property of this
seed's era draw and not of the construction** — a bound asserted in prose with no check
behind it, which is CONTRACT §9.1's own class.

**IT RE-PHASES NOTHING, BY CONSTRUCTION.** The roll is its own named stream, and the
lit/unlit decision changes no `block:windows` draw: a bay that does not trade is still
GLAZED and consumes the same two numbers — what changes is which material its panes go into.
`windowsLit` is **558 before and 558 after**. An untraded shopfront is glass with nothing on
behind it, which is what an empty shop looks like anyway.

**THE REVERTED ARM IS EVIDENCE ABOUT AN OPEN THRESHOLD.** The corner rule measured
`band:noon` at **0.4292 green**; the architectural rule measures **0.4280**, at the floor.
Two content arrangements differing only in *which two frontages trade* move that assertion
by 0.0012 across its own line, on a spread of 0.0001. **`band:noon` cannot resolve which
street it is looking at.**

### 5.3 3c — the pillars, and the light budget bound that decided the shape

Nine of ten candidate stations, **one refused against a lamp column**, spaced by the
streamed city's own rule (`round(faceWidth / 19 m)`) over **214.0 m of frontage across ten
buildings of 16.72 to 27.32 m**. Two emissive faces each at the streamed city's own
`PILLAR_FACE_NITS` = 748, imported rather than re-authored, so the two content paths cannot
describe one object with two radiances the way the lamp bowl did for twenty-five sessions.

**`band:noon` going green here is REPORTED AND NOT EXPLAINED.** Nine dark boxes on a sunlit
pavement should lower a noon mean and it rose by 0.0011. Two candidates and nothing here
distinguishes them: nine new canyon occluders changing the §5.7 bake, and eighteen
near-vertical faces at roughness 0.05 returning a specular sky.

### 5.4 The block's own bounds, which nobody had written down

- **THE ORIGIN BLOCK HAS NO OCCUPANCY REGISTRY.** It has no props, no bollards, no benches,
  no planters — nothing but buildings, lamps, signs and ground — and it owns everything
  inside `BLOCK_KEEPOUT` by construction, because the streamed city refuses to place
  anything there. So "declare before you draw" on this path means testing against this
  file's own `occluders` and its sixteen lamp columns, and that is what both new systems do.
  `LAMP_STATIONS` was hoisted out of the lamp run so there is **one list read twice** rather
  than two copies of it (§9.1).
- **THE BLOCK'S CLUSTERED LIGHT POOL HAD 8 SPARE SLOTS AND NOW HAS 4.** `budget.json` →
  `lightRoles.ceilings.block` is 60; the block delivered 32 lamp + 15 shop + 5 sign = 52
  before and **32 + 19 + 5 = 56** now. `BLOCK_RETAIL.shopLightSlots` = 23 is that arithmetic
  written down beside the use (60 − 32 − 5), in the `HUD.budgets` arrangement — a copy that
  is CHECKED rather than trusted, and what checks it is `perfcheck`'s role census.

---

## 6. ITEM 4 — BUS STOPS, BOTH CONTENT PATHS, AND A DATUM THE FRAME CAUGHT

A shelter, a pole with a flag, a bench and a lit timetable panel, in `city.js` **and** in
`block.js`. The brief named this the item most likely to repeat session 28's mistake, and
every dimension and the panel's radiance live in **one place** — `citygen.js` → `BUS_STOP`,
imported by both — so a shelter here and a shelter three chunks away cannot become two
different objects.

**THE PLACEMENT RULE, WRITTEN DOWN, because the brief asked for a rule and not a scatter:**

- **ON THE PAVEMENT.** `kerbBands` already names the four pavement lines a chunk draws. The
  shelter's front face stands `kerbGapM` = 0.40 m clear of the kerb: centre at
  7.5 + 0.40 + 0.675 = **8.575 m** from the road centre, near face at 7.9, kerb at 7.5.
- **NEAR SIDE OF A JUNCTION.** The junction is the chunk's own corner where its two road
  lines cross; the stop stands **22 m** along the band from it. 22 m is a bus length
  (12.00 m) plus half of one for the vehicle behind it — the stopping zone a halted bus
  needs, measured from the thing it must not block — and it sits inside the band's own `t0`
  (`CORRIDOR` + 3 = 14.7 m) with 7.3 m to spare, so the shelter is clear of the crossing.
- **AT INTERVALS.** One per chunk at most, at p = 0.5, so a stop every **256 m** of route on
  average against a 128 m lattice — the bottom of the real 250–400 m range. Four a chunk,
  one per band, would be one every 128 m on every road line in the city.
- **THE ORIGIN BLOCK GETS TWO AND THERE IS NO ROLL**, because ten hand-placed buildings on
  one street is not a population and this session has already paid twice for transplanting a
  streamed-city roll onto a sample of four (§5.2). One per direction, mirrored through the
  block's single junction at x = 0: the south pavement's kerbside lane runs east so its stop
  is 22 m west of the crossing, and the north pavement's is the mirror.

**DECLARED BEFORE DRAWN, REFUSED RATHER THAN MOVED.** The streamed stop tests
`mayOverlap('prop', p.kind)` over everything already in `placed` — which, **because of item
1**, now includes the ground rectangles, so a shelter that would stand in a carriageway is
refused by the same table that refuses a bollard one. It runs after the pylons, props, park
features and pillars, so the list is full. `prop` and not `sign`, and the rows differ where
it matters: `prop × path` is forbidden and `sign × path` is not.

**THE CLAIM IS THE ROOF AND NOT THE POSTS** — the brief's own requirement, and session 24's
finding is the reason. 4.00 × 1.35 m folded through the stop's own yaw by the
|cos|·L + |sin|·W expression the pylon and the pillar already use. The posts are 0.09 m
square and stand inside it; claiming them would under-claim by 3.91 m on one axis.

```
  delivered   streamed city   27 stops,  9 refused   (25% refusal — the guard fires)
              origin block     2 stops,  0 refused
```

**AND THE FRAME CAUGHT A DATUM THE CODE READ BACKWARDS.** `kerbBands`' `side` is the sign
that takes you **away** from the road centre — `x = band.at + band.side * offset` is how a
kerbside prop is placed and `band.at` is the road line. The first draft named it `outDir`
and used it as *toward the carriageway* for every part inside the shelter, so the back panel,
both posts, the bench and the lit timetable were all mirrored: **a shelter with its back to
the pavement and its lit panel facing a wall.** CONTRACT §9 rule 7 — a right offset from the
wrong datum — found by looking at frame 7 and seeing no light in it. Repaired in both files
with the two directions named for what they point at.

**ZERO NEW BOX DRAWS.** The seven opaque parts ride in the chunk's existing box mesh and the
lit panel in its window mesh at a tint of `BUS_STOP.panelNits / LIGHT.windowNits`, exactly as
the pillar's face does. The origin block costs **one** new mesh, because this file's
brightest window is 30 cd/m² and its sign plate 38 against a 420 cd/m² timetable case, and
one material carries one radiance.

### 6.1 AND THEN `citycheck` FOUND THREE MORE, TWO OF THEM ITEM 1'S TRAP AGAIN

The first run with bus stops in it reported three failures. All three were real, and each is
an assertion doing exactly the job it was written for. They are recorded here rather than
folded silently into the item, because **the second and third are the ordering trap this
same session opened by fixing (§3), wearing a different object.**

1. **`sceneWalk`: `'-1,1:masses'` labels 898 and allocated 891.** The shelter's seven boxes
   were pushed straight into `bodies` ABOVE `massCensus`, so `buildingBoxes: bodies.length`
   already contained them and `busStopBoxes: busStops * 7` counted them again. The
   advertising pillar has had its own list merged BELOW the census since session 28 for
   precisely this reason and I did not copy it.
2. **`occupancy`: `prop(busstop) × landmark(stack)`, 5.4 m² DELIVERED.** The landmark claims
   were pushed at the END of `buildChunkBody`, below every reader — invisible while the only
   reader was the pillar, which is separately tested against `chunk.occluders`. Moved to the
   top beside the ground. **That alone did not close it**, and CONTRACT §9.1 says why in its
   own words: *"the landmarks the registry must know about are not the ones the chunk
   builds"*. `chunk.landmarks` is a DRAWING list padded by 4 m, and a shelter 22 m from a
   junction can stand inside a solid owned by the chunk next door. `LANDMARKS` is eight
   entries and both accessors are pure, so the shelter is tested against all of them.
3. **`occupancy`: `sign(adpillar) × prop(busstop)`, 0.733 m² DELIVERED.** `placed` is THE
   CHUNK'S OWN claim list — a bound the pylon's own comment already states, and it holds for
   two pylons because both members of a colliding pair are on one run of pavement inside one
   chunk. It does not hold for a pillar and a stop across a seam. **The pillar yields**,
   which is the right way round: a stop's position is determined by a junction and a
   pillar's is a scatter along a frontage. The declaration is now an exported pure function
   `busStopAt(rootSeed, cx, cz)` — called by `generateChunk`, so there is ONE definition —
   and the pillar loop sweeps the 3×3 neighbourhood with it for the cost of nine hashes.

```
  citycheck occupancy   2 forbidden overlaps -> 0 / 0, generator AND delivered
  citycheck sceneWalk   27 mismatched meshes -> green
  delivered bus stops   27 (9 refused) -> 28 (8 refused)
```

**THE BUILDINGS STAY AT THE BOTTOM** and that is a decision: their claim's `y1` is
`deliveredTopByBld`, what the chunk actually drew on the roof, which does not exist at the
top of the function. Every placement routine below already tests `chunk.occluders`.

---

## 7. GATE STATE

**Each gate was run individually rather than through `npm run gates`**, because that chain
is `&&`-joined and stops at `lookcheck`, which hides every gate after it — the reason
session 27 ended with two gates unreported.

```
  parsecheck   GREEN   94 files
  faultcheck   GREEN   7 cases
  lookcheck    RED AT 2   BOTH CARRIED FROM BEFORE SESSION 27. `band:noon`, which
                          session 29 created, is CLOSED BY CONTENT.
  windcheck    GREEN
  inputcheck   GREEN
  gateaudit    RED AT 3   all three are lookcheck's two restated one layer up. Every
                          --falsify self-test underneath passed at 100% coverage.
  citycheck    RED AT 2   the carried bright reserve, AND `sceneWalk` TIMING OUT rather
                          than failing — see §7.3.1. `occupancy` is GREEN at 0 / 0
                          forbidden overlaps over 50 forbidden pairs, generator AND
                          delivered, which is the number this session's two new
                          placement systems had to earn.
  perfcheck    RED AT 8   THREE are milliseconds and are INADMISSIBLE at this machine's
                          load (3.70 against a bar of 1.6). FOUR are the carried
                          stop-line datum. ONE is the tone profile, and it IMPROVED.
```

**`npm run gates` does not exit 0, and this session is not reported complete.**

### 7.1 `lookcheck` — the two that are left, and the one that closed

```
  ✗ [distinct:midnight|dusk]      0.02519 MSD against a 0.03 floor
  ✗ [midPatchSample:midWallPanel] 0.54 of its own median against a 0.45 ceiling,
                                  which suppresses two assertions downstream of it
```

Both were red on `main` before session 27 and neither is content this session touched.
Delivered on the final run: `band:midnight` **0.1111** (≤ 0.112), `band:noon` **0.4290**
(≥ 0.428), `band:dusk` **0.1453**, `groundPools` **11** (≥ 6), `facadeAlbedo` **4** (≥ 4),
`facadeNeighbours` **0.605** (≥ 0.3), mid-distance clusters **2** (≥ 2) at 0.746 (≥ 0.5).

### 7.2 `gateaudit`

```
  ✗ control failed
  ✗ midAlbedoClusters did not run on the control frames
  ✗ midAlbedoSeparation did not run on the control frames
```

Identical to sessions 28 and 29 and downstream of `midPatchSample`. **Every `--falsify`
self-test underneath passed**, which is what says the gates are healthy after a session
that changed the content they measure:

```
  perfcheck --falsify   74/74 rejected, 72 failure sites, coverage 100%
                        shape controls 15/16 views (floor 12), worst three-box 0.3216 clears,
                        worst prism 0.0108 does not — both directions held
                        width controls 11/24 views (floor 9), worst taper 0.1424 clears,
                        worst constant-width 0.0197 does not
  citycheck --falsify   61/61 rejected, 61 failure sites, coverage 100%
  inputcheck --falsify  13/13 rejected, coverage 100%
  windcheck, lookcheck  green
```

### 7.3.1 `citycheck` → `sceneWalk` IS A MACHINE READING, NOT A CONTENT READING

```
  ✗ [sceneWalk] the city had not finished arriving when the census was taken —
    Bound hit: wall after 2950 frames / 20 142.8 ms, with 16 bakes still queued.
```

**This is the load, and the assertion says so in its own message**: *"'wall' means a bake
is slow or stuck"*, and it warns in the same breath **not** to raise the frame budget for
it. Three invocations this session, at load 4.68, 3.54 and 3.58, and the earlier one on a
quieter machine returned the census cleanly. Its content half is what caught this session's
own double-count (§6.1) and it went green the moment that was repaired.

**The reserve's spread over those same runs is 4.54 / 4.66 / 4.74 / 5.26%**, which is 0.72
points against a 1.3-point deficit — STATE 28 recorded 0.23–1.04 for the same statistic and
this session adds a fourth invocation to that. No single `citycheck` run can resolve the
question §8 item 1 asks.

### 7.3 `perfcheck` — the counts, which ARE admissible

```
  route            draws  tris    instances  froxel margin  light roles
  downtown_dense    334   1.22M    121 711    62 of 96      aircraft 1, traffic 96,
  highway_speed     434   1.40M    158 675    79 of 96      stall 12, BLOCK 56, lamp 192
  night_rain        337   1.17M    147 961    60 of 96
  player            324   1.18M    121 711    60 of 96
```

Against `ceilings.drawCalls` **440**, `ceilings.triangles` 2 000 000 and
`floors.visibleInstances` 115 000. **`highway_speed` went 431 → 434, so the margin on the
tightest ceiling in this project is now SIX**, and the whole delivered cost of five content
systems is that plus one mesh in the origin block. `block` is **56 of a 60 ceiling** — 32
lamp + 19 shop + 5 sign — where it was 52.

**THE ONE CONTENT VIOLATION IMPROVED AND IS STILL RED.** `highway_speed`: **75% of 71
vehicles carry a non-monotone tone profile against a 75% floor**, worst 0.000. STATE 29
recorded 74.6% of 67 and STATE 28 recorded 71%. It is red on a strict comparison at exactly
the floor, and its population is not stable run to run — an intermediate run in this same
session measured **69% of 67** on the same commit range. Item 2's palette is the mechanism
in both directions: a light body has less tonal structure down its flank than a dark one, so
a fleet that is 49.4% light rather than 25% is a fleet with fewer non-monotone profiles, and
the assertion is measuring exactly what it was written to measure. **Not tuned to, and no
threshold moved.**

The four stop-line violations are 10.77 to 13.50 m against session 29's 10.81 to 13.07 m.
**Carried, diagnosed (STATE 25's datum disagreement), and NOT REPAIRED**, as the brief
required. Item 5 was not built, so nothing this session moved a queue.

---

## 7.4 AN ADVERSARIAL PASS OVER THE BRANCH, AND WHAT IT FOUND

Everything above was measured by the gates. **This section is a different
instrument**: five independent read-only lenses over the session's own diff —
arithmetic-in-comments, quantity confusion, placement and claims, determinism and
streams, gates and budgets — each finding then handed to a separate agent told to
REFUTE it. 43 candidates, **12 refuted, 28 confirmed**, and it reproduced this
project's RNG streams from `src/lib/rng.js` to check the block's era draw rather
than trusting the delivered census.

**It is not a gate and it must never become one** (§7's rule about `lookat.mjs`,
for the same reason: it measures whoever wrote its prompts). What it is good at is
the one thing every gate here is blind to — **a number in a comment that no code
reads**, which CONTRACT §9 rule 5 calls a guess and §9.1 calls the failure mode
that advertises a guarantee.

**Five confirmed findings changed delivered geometry and are repaired in
`<repair>`:**

1. **The flag pole stood up to 1.31 m outside the claim, and outside every test.**
   The claim was the roof, correctly; the pole is drawn a metre past its
   downstream end. Session 23's viaduct abutment with a bus stop instead — mass
   standing in the world that nothing had been told about. The claimed box now
   covers roof-plus-pole, about a centre shifted downstream, so it still contains
   the roof exactly.
2. **14 of 155 declared shelters had an 8.4 m lamp column inside the roof they
   claim.** The streamed lamps are emitted by `city.js` directly and are in NO
   occupancy band at all — STATE 23's `lampprobe` finding — so no `placed` test
   could ever have caught it. The stations are now one hoisted pure list read by
   the lamp run and by the shelter, and the shelter is refused against the 3×3
   neighbourhood of them.
3. **78 of 155 stops stood on the FAR side of their junction.** `along` was
   `corner + 22` for every band regardless of `side`, against a rule written as
   *"near side of a junction"*. A chunk has a junction at each end of the band and
   which is near depends on which way the lane beside that pavement runs — which
   is exactly what `side` is.
4. **`beforeJunctionM` = 22.0 under a derivation that computes 18.0.** *"A bus
   length plus half of one"* is 12.00 + 6.00. The number that is 22.0 is
   `CORRIDOR` 11.7 + half a bus 6.0 + half a shelter 2.0 + the pole's 0.3 = 20.0,
   rounded up for 2 m of kerb slack. §9 rule 5, and it is mine.
5. **`BLOCK_RETAIL`'s stated floor of 6 of 10 is 5.** Enumerated over all six
   pairings: 6, 8, 6, 7, **5**, 7. The first draft argued the 5 away with *"the
   three shopfronts sit in three different runs"*, which only guarantees ONE
   shopfront in the dark pair; what decides the bound is which run has none, and
   here it is a three-building run. §5.2.

**And a further sixteen were comment arithmetic**, all corrected in the same
change: the closest chromatic pair (0.098 → **0.0608**, teal/pale blue), the
whole-table minimum (0.0082 → **0.0022**, off-white/white), the count of neutrals
(three → **five**), the ladder's spacing (*"roughly every half-stop"* → **0.325 of
a stop a rung**), the commercial rows' light share (*"two thirds of each"* →
**0.78 / 0.68 / 0.70**), the census mapping's six-point shortfall on grey, a
twenty-one-session-old *"deep blue paint at reflectance 0.115"* that matches no
reading of that entry, livery-to-oxide 0.0977 → **0.0983**, *"one in twenty"* →
**one in twenty-four**, *"the last 30% of the range"* → **24%**, `originFactor`'s
own doc comment still saying 9.30× after this session made it 4.65×,
`blockprobe`'s bowl classifier still keyed on the literal 210 the same session
changed to 420, a stop-interval of *"256 m"* that is a per-CHUNK rate used as a
per-ROUTE spacing (delivered ~500 m per direction), a guard on `band.bank` that
cannot fire, *"`placed` is read in exactly two places"* that is now three, and a
`counts` comment still describing the corner rule §5.2 replaced.

> **The pattern is worth more than the list. Every one of the sixteen is a number
> beside a number, and this project's own §9 rule 2 — *anything derived two ways
> must be printed both ways* — is what would have caught them at the moment each
> was written.** The gates caught the five that reached the geometry within one
> run each. Nothing in this project reads a comment.

---

## 8. THE THREE OPEN QUESTIONS, AND WHAT THIS SESSION ADDED TO EACH

**No threshold was moved, lowered, raised or re-derived. All three remain the operator's.**

1. **THE 6.00% BRIGHT-RESERVE FLOOR, derived in session 16 against a frame carrying 4.49
   points of veiling glare that session 27 removed as a defect.** Carried verbatim from
   STATE 28 §8.1 and STATE 29 §7.1. **This session adds a fifth arm and it fails for a NEW
   reason** — §4.1. Sessions 28 and 29 showed emissive area cannot move it because
   auto-exposure gives back what it adds; this session shows *reflective* content cannot
   move it because a surface under 16 lx never reaches the value threshold at all. Two
   independent mechanisms, one conclusion.
2. **`band:noon` WITH A MARGIN SMALLER THAN ITS OWN SPREAD.** **It is GREEN now** — 0.4291
   against a 0.428 floor, three runs, spread 0.0000 — and §5.2 is the sharper evidence:
   two content arrangements differing only in which two frontages trade moved it by 0.0012
   *across its own line*. A floor that flips on which shops are open is not resolving the
   quantity it names.
3. **THE 76 OF 189 BOUNDS IN `budget.json` WITH NO DERIVATION AT ALL** (`node
   tools/budgetaudit.mjs`, STATE 25 §2.2). Untouched. This session added derivations for
   every number it introduced — `BUS_STOP`, `BLOCK_RETAIL`, `PAINT_WEIGHTS`,
   `AD_PILLAR_BLOCK` — and moved none of the 76.

---

## 9. WHAT WAS NOT BUILT

**ITEMS 5 AND 6 WERE NOT STARTED AND NOTHING OF THEM IS ON THE BRANCH.** No half-built
dwell, no half-built platform. Item 5 was explicitly conditional — *"only if 1–4 are landed
and committed"* — and by the time they were, the session had spent its room. `minStopLineM`
was therefore **not touched**: it is measured by `perfcheck` at 12.51 m past the stop line
on `highway_speed` against session 29's 10.81–13.07 m, unmoved and unrepaired, and STATE
25's datum diagnosis stands.

**Item 6, the station's Stage 1**, is not started for the fifth session running. STATE 27
§8.1 holds the five-stage design.

---

## 10. KNOWN GAPS CARRIED FORWARD

**Unchanged from s8–s29**: `stats().cutoffM` hard-codes 0.8, the headroom probe inert, GPU
timer queries advertised and never retiring, `saturation-peak.png` overwritten every run,
`$fovYDrift`, `camera.setRouteAt(name, 1.0)` at the sky, rain streaks near-invisible wide at
night, `rain_spray` 0 static, **right turns only**, sun shadows to ~170 m, the bake blind to
elevated slabs, the PMREM hitch, the too-red dawn horizon, one worker at queue depth one,
the far half of the river handing back to the night sky past ~300 m, grime authored, the
near-field washboard on the water, the quay wall inside the walkable mask, props absent from
the walkability mask, the 3.5°–10.4° route camera pitch, the frozen/running A/B,
`materials.display` drawn by nothing, the hauler's marker row buried inside its own body,
the seeding fallback's untested placement, and **a bus never turns**.

**New gaps this session opened, stated rather than left to be found:**

- **`highway_speed` DRAW MARGIN IS NOW THE TIGHTEST BOUND IN THE PROJECT.** **431 → 434 of
  a 440 ceiling** measured before the §7.4 repairs (which only ever refuse content, so it
  cannot have risen), six of margin, and five content systems landed inside it only because
  every one of them rides in a mesh that was already drawn. The next session should assume
  it has no room for a new mesh in the streamed city at all.
- **`band:midnight` HAS 0.0009 LEFT.** The block is at parity and the budget is spent. Any
  further origin-block emitter needs the ceiling question answered first.
- **THE TONE-PROFILE ASSERTION'S POPULATION IS NOT STABLE RUN TO RUN.** Two runs on the same
  commit range measured **69% of 67 vehicles** and **75% of 71** against a 75% floor. It has
  been red since session 28 and nobody has established its own spread; a session that
  intends to decide it should measure that first (§0.1).
- **`facadeAlbedo` SITS ON ITS FLOOR AT 4 OF 4 WITH ZERO SPREAD** (§0.3). It survived
  because every change this session is below 3.5 m and its rects are above it.
- **THE ORIGIN BLOCK STILL HAS NO OCCUPANCY REGISTRY** (§5.4). Two systems now place
  themselves there against ad-hoc lists. A third should not.
- **`'ground'` IS NOT A CATEGORY AND TWO GROUND KINDS FALL THROUGH TO IT.** Carried from
  STATE 29 §9 and now load-bearing: `city.js` maps `q.kind === 'site'` to `site` and
  `citygen` emits `siteGround` and `grass`, so every park-grass and construction-site ground
  rectangle in the delivered census **conflicts with nothing** — including with the bus stop
  and pillar tests item 1 just made live.

**Resolved this session**: the pillar's dead carriageway guard; the fleet's clustered paint
distribution; the origin block's era-coupled retail; the origin block's absent advertising
pillars; half of the origin block's lamp-bowl error; the absence of bus stops on either
content path; and `band:noon`, which session 29 broke and content closed.

---

## 11. OFFERED FOR CONTRACT §9's TABLE

Offered rather than added, because `parsecheck`'s `contractDocCheck` counts the rows and the
count is a gate — sessions 24, 25, 27, 28 and 29 left rows on the same terms and they are
still owed.

- **an EMITTER'S AREA × RADIANCE used as a predictor of a FRAME MEAN** — the two differ by
  projected solid angle, and calibrating the first against the second on four emitters that
  are all either numerous-and-spread or bright-close-and-large predicted **+0.0066** for
  nine advertising pillars that delivered **+0.0004**. 16×, in the instrument written for
  §9, by the session that wrote it (§7.7);
- **a kerb band's `side`, which takes you AWAY from the road centre, used as the direction
  TOWARD the carriageway** — every part inside a bus shelter mirrored about its own roof: a
  glazed back panel on the pavement side, both posts in front, the bench facing a wall and
  the lit timetable case pointing at the building. Invisible to a claim (the roof is
  symmetric about both), invisible to a count (seven boxes either way), and obvious in the
  first frame taken of it;
- **a per-frontage Bernoulli roll transplanted from a 400-island generator to a 4-run set
  piece** — the same expectation, a standard deviation of 0.99 on a mean of 2.2, and a
  delivered street with **5 lit ground floors of 10 against the 6 it replaced**. A rule that
  is right about a population and wrong about the one street the operator walks;
- **a COUNT of lit frontages used as a measurement of the light in front of the camera** —
  session 28's corner-shop rule delivered 8 of 10 lit and took the lit shopfront 20.6 m from
  the operator's own eye and put two 100–160 m away. §7.2 with a retail roll instead of a
  body type, and it was caught by the FRAME rather than by the number;
- **A DRAWING LIST USED AS A KEEP-OUT LIST** — `chunk.landmarks` is `landmarksTouching`
  padded by 4 m and answers *"whose geometry is mine to draw"*; a bus shelter 22 m from a
  junction was tested against it and stood in **5.4 m² of a landmark owned by the chunk next
  door**. CONTRACT §9.1 states the distinction in its own words for the registry and this is
  the same substitution one consumer over;
- **A CHUNK-SCOPED CLAIM LIST used as THE occupancy** — `placed` holds one chunk's claims,
  which is sound for two sign pylons on one run of pavement and unsound for a pillar and a
  bus stop across a seam: **0.733 m² of `sign` inside `prop`** in the delivered census, with
  both halves of the two-sided check reporting zero because neither half can see the other
  chunk. §9 rule 7's *"both sides shared the assumption"*, with a chunk boundary;
- **a comment claiming a chromaticity floor over a set containing NEUTRALS** —
  *"the closest pair is 0.088 apart, which is 4.4× the threshold"* against a measured
  **0.0082** for graphite/silver. The table was right and the sentence over it was a claim
  about a property the table does not have and does not need.
