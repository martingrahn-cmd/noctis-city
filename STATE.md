# NOCTIS — STATE

*End of session 67. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`, 14 d 14 h of
uptime — the same boot as sessions 47–66. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` RAN 2.99–5.67 THROUGH THIS SESSION***, over CONTRACT §0.2's bar of 1.6 for the
seventh session running, with `mediaanalysisd-access` at 92.4% and `mds_stores` at 58.3% at the
opening check. **No millisecond below is a verdict.** Every number here is a count, a length, a
reflectance, a saturation, a ratio or a pixel.

Branch `claude/noctis-67-the-ground-albedo`, off session 66's head, pushed as each item landed.

---
## 0. THE TWO FRAMES THE SESSION EXISTS TO ANSWER

**`tools/shot-out/sea-air-noquay-t0_42-wet.png`** against session 66's
**`sea-air-before-t0_42-wet.png`** — 180 m over the mouth, the same preset, the same hour.

**THE SEA IS LESS BROWN AND IT IS STILL BROWN**, and this session can now say exactly how much of
that was one wrong constant and exactly why the rest is not. Measured on the delivered pixels:

```
                        before                     after            change
  the sea at 2 km   (87.7, 77.3, 64.9) sat 0.260   (83.7, 74.9, 64.6) sat 0.228   -12%
  the sea at 500 m  (83.5, 75.7, 65.3) sat 0.218   (80.7, 74.5, 65.8) sat 0.184   -16%
  the river at 30 m (43.6, 49.4, 53.8) sat 0.189   (43.1, 49.5, 54.4) sat 0.207   b > g > r, unmoved
```

**And the second frame is the one no frame in this project has ever taken:**
**`tools/shot-out/viaduct-under-{before,after}67-t0_5-wet.png`** — standing on the carriageway
UNDER the viaduct deck at noon, looking up along the soffit. **A frame lit by this term and almost
nothing else, and no frame in this project's history has been pointed at one.** The same seed, the
same camera, the same second; the only difference in the world is the triple:

```
  rows (of 810)      mean |dY|   before Y   after Y      <- the camera looks UP
     0- 90             0.331       145.0      144.7         the deck's underside
    90-180             0.418       132.9      132.5         SOFFIT — the most-moved band
   180-270             0.304       114.5      114.2
   360-450             0.228       110.1      109.9
   540-630             0.204        98.3       98.1
   720-810             0.113        71.2       71.1         the carriageway. Sunlit.
  ---------------------------------------------------------------------------------
  whole frame          0.251                                strongest 16x16 tile 2.43
  pixels moving >= 1 code value    56 627 of 1 166 400  (4.9%)
  largest single-pixel move        10.28 code values
```

**A MONOTONE GRADIENT FROM THE SOFFIT DOWN TO THE ROAD, 3.7x TOP TO BOTTOM.** The term lights what
faces down; in this frame what faces down is up. And the whole-frame mean is **a quarter of one
code value in 255** — which is, in one number, why sixty-six sessions and six look bands never saw
it, and why it took a sea to.

---
## 1. THE CHAIN, END TO END, BECAUSE IT IS THREE FACES OF ONE MECHANISM

The brief said the brown sea, the missing ripple and the sky fill might be one thing. **They are,
and it is none of the three mechanisms anybody proposed.** Measured this session:

```
  1. THE FAR SEA'S PIXEL FOOTPRINT EXCEEDS ITS LONGEST WAVE.
     WATER.wavelengths are 2.4, 1.1 and 0.47 m. From 180 m looking 15 deg down at
     2 km the along-view footprint is about 5.1 m, over the 1.92-4.80 m band
     `WATER.cutoffLo/Hi` names.

  2. SO THE SHADER TURNS THE UNRESOLVED SLOPE INTO ROUGHNESS, DELIBERATELY.
     `alpha^2 = alpha_base^2 + 2 * residual`, and its own comment: *"at 300 m
     every component has gone and it reaches the Cox-Munk total, 0.1916 of alpha
     and 0.438 of roughness"*, then `WATER.cutoffRoughness` = 0.62 past the
     footprint band so the SSR march switches itself off.
     **The open sea is not mirror-flat. It is ROUGH, by design, and correctly.**

  3. A 0.62-ROUGHNESS WATER SURFACE INTEGRATES A WIDE LOBE OF THE ENVIRONMENT,
     and at a grazing view a wide lobe reaches well below the horizon.

  4. THE BELOW-HORIZON HEMISPHERE IS `ATM.groundAlbedo`, WHICH WAS 1.21x TOO
     BRIGHT AND 4.0x TOO SATURATED.
     So the sea came back the colour of an over-saturated ground.
```

**Every step is measured and step 4 is the only one that was wrong.** Steps 1 to 3 are the
anti-aliasing working; nothing there is repaired and nothing there should be.

**AND IT IS WHY THE RIVER IS BLUE.** The near river is at `WATER.baseRoughness` = 0.045 — a narrow
lobe, seen steeply, mirroring clear sky. Same mesh, same material, same level, opposite answer,
because roughness and view angle differ. The operator's *"a colour difference that cannot come from
the water"* was right that it does not come from the water's colour; it comes from the water's
ROUGHNESS, which is a function of distance.

---
## 2. ITEM 1 — TWO CONSTANTS, ONE QUANTITY, AND NEITHER KNEW

**`ATM.groundAlbedo` carried NO DERIVATION**, which CONTRACT §9 rule 5 calls a guess. Its comment
said *"Urban ground. Feeds the sky's bounce term and, through PMREM, the lower half of the
environment map — which is the only thing filling shadows from below."*

**`GROUND.earthAlbedo` carried one, and it is the same sentence** — *"the area-weighted mean of the
city's own drawn ground"*, session 42.

### 2a. THE MEASUREMENT, AND ITS CONTROLS RAN FIRST

`node tools/albedoprobe.mjs` — NOT A GATE. It reads the DELIVERED vertex colour times the material
colour, area-weighted by **PLAN footprint** because the question is what a ray pointing down sees
and a 45° hillside must not vote twice. **The instrument risk here is worse than session 66's** — a
colour term read through a render that the same term lights — so two §7.3 controls run before
anything is reported:

```
  BRIGHT  block:markings            [0.6200, 0.6150, 0.6000]  want ROAD_PAINT.albedo     ok
  DARK    block:ground inside disc  [0.1229, 0.1211, 0.1168]  want GROUND.earthAlbedo    ok
  5.1x apart, and the dark one exercises the vertex-colour multiply the bright one does not.
```

```
  region                          albedo                       Y       sat     order
  the city, r <= 1 280      [0.1178, 0.1168, 0.1118]        0.1167   0.051   r > g > b
  the city, r <= 3 232      [0.1208, 0.1192, 0.1148]        0.1192   0.049   r > g > b
  the countryside 3232-4000 [0.0986, 0.1024, 0.0760]        0.0997   0.258   g > r > b
  ----------------------------------------------------------------------------------
  GROUND.earthAlbedo        [0.1229, 0.1211, 0.1168]        0.1212   0.050   r > g > b
  the old ATM.groundAlbedo  [0.1550, 0.1450, 0.1250]        0.1442   0.194   r > g > b
```

**SESSION 42's DERIVATION SURVIVED TWENTY-FIVE SESSIONS.** `earthAlbedo` agrees with the delivered
city to **1.7% on every channel**, through session 45's carriageway change and five sessions of
countryside, hills, coast and sea.

### 2b. THE TWO ERRORS, KEPT APART, BECAUSE THEY ARE TWO QUANTITIES

**THE CHANNEL ORDER WAS NEVER WRONG.** Both triples are r > g > b and so is the delivered city.
Session 66's *"the sea's hue is this term's, channel order and all"* was a correct observation and
**not** the defect — and matching a channel ORDER is weak evidence, which is worth saying because
that inference is what named this session.

**THE SATURATION IS THE DEFECT: 0.194 against 0.049, a factor of 4.0.**

**AND THE LEVEL IS 1.21x, NOT THE 1.34x THREE STATEs HAVE CARRIED.** Session 64 measured 1.34x
against the COUNTRYSIDE's albedo. This constant's own first word is *"Urban"*. Against the surface it
names it is **1.21x**. The larger figure was the right measurement of the wrong pair, and it has been
quoted as the headline of §10 for three sessions.

### 2c. ONE SOURCE, AND THE ARROW POINTS THE WAY THE CONTRACT ALLOWS

The first arm made `atmosphere.js` read `GROUND.earthAlbedo` and **`parsecheck` refused it in one
line**: *"src/lib must not import outside src/lib — it is pure helpers only."* That is CONTRACT §2.2
and it is not routed around. So the value lives in `atmosphere.js` and `GROUND.earthAlbedo` reads
it — `core` may import `lib` and already imports `lib/luminaire.js`. **The value is unchanged by the
move**: session 42's triple is the one that survived, and the sky's undeviated copy is the one that
went.

---
## 3. ITEM 2 — THE LOOK GATE CANNOT SEE IT, AND THAT IS THE SESSION'S HARDEST RESULT

**PREMISE (iv) IS FALSE.** Predicted before the baseline ran and recorded in the branch:
`noon road B/R` would RISE (it sits at 96.2% of its ceiling, the tightest margin in the gate),
`warmth dusk-noon` would FALL, `stddev dusk` would move.

**THE NOISE FLOOR FIRST, AS THE BRIEF REQUIRED.** Three `gateaudit` runs on the unchanged head:

```
  band noon 0.4335   band dusk 0.1551   stddev noon 0.2145   stddev dusk 0.1291
  msd 0.0284   warmth dusk-noon 0.0769   warmth dawn-noon 0.0856   noon road B/R 1.1060
```

**identical to every printed digit across all three.** The floor is ZERO at this resolution — a
much harder baseline than the msd's, whose noise session 65 found in the fifth decimal.

**AND THREE RUNS AFTER THE CHANGE ARE IDENTICAL TO THE THREE BEFORE.** Not one band moved by one
digit. **The prediction is falsified and so is the premise.**

**WHY, AND IT IS THE ENUMERATION THAT SAYS SO** (item 1a, and it was worth more than the repair):

```
  THE CPU PATH IS DEAD. `skyIlluminance`, `skyIrradianceOnPlane`, the photocell,
    the canyon bake — all sample the UPPER hemisphere only, so the ground-bounce
    branch never executes. Verified numerically: setting the albedo to
    [0.9, 0.05, 0.9] leaves every one of them bit-identical.
  THE NIGHT FILL IS BINARY AND OFF BY DAY. `uGroundLighting` is
    `photocellOn ? LIGHT.streetAverageLux : 0` — 16 lux or 0 — so the
    below-horizon street-lighting fill is EXACTLY ZERO at dawn, noon and dusk.
  WHAT IS LEFT reaches only the sky LUT's below-horizon texels and, through
    PMREM, DOWNWARD-FACING surfaces. The look gate's bands measure roads,
    facades and whole-frame statistics. A road faces up. A facade faces sideways.
```

**So the term that STATE has called *"the most dangerous entry on the list"* for three sessions, and
that I was told wanted its own session with `lookcheck` as judge, is invisible to `lookcheck` by
construction.** The judge could not see the defendant. It took a 30.4 km2 sea to make it visible at
all, and it is a soffit's business.

**A red that is correct is a result and there was no red to have.** Nothing was re-derived, because
nothing moved.

---
## 4. ITEM 3 — THE RIPPLE, AND PREMISE (ii) IS FALSE IN AN INTERESTING WAY

The premise offered three candidates: a distance LOD, a normal map whose tiling runs out, or a mip
chain resolving to flat. **It is a fourth thing and it is not a defect.** §1 has the chain: the
shader converts unresolved wave slope into GGX roughness — `alpha² = alpha_base² + 2·residual` —
because that is what an unresolvable slope distribution IS, and raises it past
`WATER.cutoffRoughness` = 0.62 when even the 2.4 m component is sub-pixel so the SSR march stops
paying 24 fetches for a lobe one ray cannot describe.

**The open sea has no ripple because it has no resolvable ripple, and the shader says so in
roughness instead of lying about it in geometry.** Nothing here is repaired. What it COST is that a
0.62 lobe integrates the lower hemisphere, which is §2's subject.

---
## 5. ITEM 4 — THE SHORE IS SUB-RESOLUTION, NOT ABSENT

Session 66 built `SEA.strandM` = 3.0 m of height and measured the delivered strand at **8 to 24 m
wide** — narrow where the shore is steep, wide where it is gentle. STATE 66 §3 reported it.

**Measured this session on the delivered aerial**, scanning across the south shore:

```
    x      rgb              Y      sat
   990    86  78  68      79.1   0.209     water
  1032   104  95  76      95.2   0.273
  1080   117  97  79     100.0   0.324     land
```

The transition spans about 90 px and BOTH luminance and saturation rise **monotonically, with no
low-saturation plateau between them** — which is what a strand would be, because `GROUND.earthAlbedo`
is saturation 0.050 against the water's 0.21 and the vegetation's 0.32.

**So the strand is there and it is 2 to 6 px at 2 km.** It is not a knife edge and it is not a
beach: it is a correct strand on a shore too steep to show one. A strand that reads from the air
needs a shallower shore, which is the basin's shoulder gradient and not the strand's height. §9.

---
## 6. ITEM 5 — A CROSSING NEEDS TWO BANKS

**PREMISE (iii) IS TRUE AND BETTER THAN STATED.** The severed span is not one of session 66's 90 cut
edges, so that session's *"nearest 2 016 m from the harbour, 0 within 2 km"* stands unrestated. It
is a bridge standing in open water:

```
  crossing        x       north bank            south bank
  arch          2 048    h   0.00  land        h   0.00  land
  girder        2 560    h   0.00  land        h   0.00  land
  arch          3 072    h   0.00  land        h   0.00  land
  cable         3 584    h -17.34  SEA         h -15.84  SEA
  girder        4 096    h -62.67  SEA         h -55.83  SEA   (no land within 3 km)
```

`bridgeX` has put a crossing every 512 m for as far as anything asked and **nothing had ever asked
whether there was a bank there**. It did not matter for fifty sessions because the only water was a
100 m river in a cut channel.

`crossingIsLanded` is the ONE predicate, asked in two places twenty lines apart: `bridgesTouching`
stops DRAWING a span with no abutment, and `onBridgeDeck` stops the walkability mask, the road clip,
the craft placement and the promenade lamps believing in it. A drawn deck and a walkable deck that
disagree is §9.1's own arrangement.

**AND TAKING THE BRIDGE OUT REVEALED THE NEXT LAYER.** The frame then showed two quay walls running
into open water and stopping — hidden behind the bridge until the bridge went. `pushQuays` walled
every station of `riverBankStations` because for fifty sessions every station had a bank. It asks
the same predicate now, 8 m behind the wall face: the ground the wall retains, not the water it
stands in.

Every crossing from −4 096 to 3 072 survives, including session 56's extra at −256. Three are
drowned: 3 584, 4 096, 4 608. **The city is byte-identical** — 1 908 chunks wholly inside r ≤ 3 232
hash `6f192b75fb42ae2a5545ca17` either side.

---
## 7. THE BRIEF'S FOUR PREMISES

| | premise | verdict |
|---|---|---|
| (i) | the brown sea and the §10 sky fill are ONE quantity | **TRUE, through a mechanism nobody named.** Not a shared hue — a shared path: the far sea is rough by design, a rough lobe integrates the lower hemisphere, and that hemisphere is the term. An extreme-albedo control turns the sea bright red and leaves the sky untouched. §1 |
| (ii) | the missing ripple is distance or tiling rather than material | **FALSE, and not a defect.** It is distance, but as a deliberate slope-variance-to-roughness conversion; the open sea is not flat, it is rough. §4 |
| (iii) | the bridge stub is not one of the 90 cut edges | **TRUE.** It is a bridge with no bank. Session 66's distances stand. §6 |
| (iv) | changing the ground albedo moves at least one look band | **FALSE.** Six bands, three runs each side, identical to every digit against a ZERO noise floor. The look gate cannot see this term at all. §3 |

---
## 8. THE COST

```
  highway_speed   401 draws of 440        UNCHANGED — nothing was added to the city
                  2 451 648 tris of 2 630 000   <- THE FIRST EXACT FIGURE IN THIS PROJECT
                  347 833 instances, 73 materials
```

**`perfcheck` HAS READ "2.45M tris" SINCE SESSION 64** — two decimals of a megatriangle, which
rounds to the nearest ten thousand. A countryside, a ring of hills, a harbour, cranes, container
stacks and boats all landed inside that digit, and STATE 66 had to write that the sea's 4 094
triangles were *"under one hundredth of the gate's own resolution"*. It prints the count now. **The
headroom is 178 352 and can be said out loud.** Display only — not a threshold, so CONTRACT §0
rule 5 is untouched. This was the brief's optional item and it was worth more than a feature.

**THE SESSION'S OWN COST IS 531 LINES ACROSS 9 FILES, AND THREE BRIDGES REMOVED.** No triangle was
added to the city. `src/lib/atmosphere.js` +66 (the derivation), `src/lib/citygen.js` +58
(`crossingIsLanded`), `src/modules/harness.js` +117 (`groundAlbedoCensus`),
`tools/albedoprobe.mjs` +172 (new), `src/modules/river.js` +22, `src/core/constants.js` +32.

---
## 9. GATE STATE

**ALL EIGHT RAN. `perfcheck` COMPLETED THE WHOLE BATTERY AGAIN — the second session running,
against three sessions before that where it died after the first route.**

```
  gate            exit   verdict   seconds  load1 in     out
  parsecheck         0     GREEN       3.9      2.99    2.99    124 files, contract-clean
  faultcheck         0     GREEN      27.7      2.99    3.64
  lookcheck          1       RED      50.8      3.64    3.53    THE IDENTICAL THREE
  windcheck          0     GREEN      41.4      3.53    3.90
  inputcheck         0     GREEN      17.5      3.90    3.78
  gateaudit          1       RED      79.6      3.78    4.55    the carried `control failed`
  citycheck          1       RED     128.6      4.55    5.67    IDENTICAL TO SESSIONS 57-66
  perfcheck          1       RED    1090.3      5.67    4.58    AND IT FINISHED AGAIN

  4 of 8 RED — the same four as sessions 53-66. NO FIFTH RED.
```

**A FIFTH RED WOULD HAVE BEEN A REAL RESULT AND THERE WAS NONE.** `lookcheck`'s three are
`distinct:midnight|dusk` (0.02844 against 0.03), `facadeAlbedo` and `facadeNeighbours` — the same
three, and `gateaudit`'s sole failure is those three reported back as *"the unperturbed frames do
not pass their own gate"*. Every falsify suite at full coverage: `perfcheck` 74/74,
`citycheck` 67/67, `inputcheck` 13/13.

**`citycheck` IS BYTE-IDENTICAL TO SESSIONS 57–66 ON EVERY COUNT** — clumping CV 0.393, **5**
delivered forbidden overlaps, **2 of 2 647** signs inside a building, **1 004 of 284 918** bare
walkable samples. **The occupancy registry is untouched**, as the brief required, and removing
three bridges did not move it: all three stood beyond x = 3 500, outside `citycheck`'s r ≤ 1 280.

**EVERY `perfcheck` VIOLATION IS CARRIED OR IS A TIMING ABSOLUTE FROM A LOADED MACHINE**, at
`load1` **5.67** against CONTRACT §0.2's bar of **1.6**. The non-timing ones are the known
straddles: `downtown_dense` frame entropy 4.910 against a floor of 5 (session 66 read 4.940 and
4.848), and the vehicle silhouette bars at 61–71% against 75%. **No millisecond in this file is a
verdict** and none is quoted as one.

---
## 10. WHAT TO DO FIRST NEXT TIME

**1. THE SEA STILL WANTS ITS OWN COLOUR, AND THAT IS NOW A SEPARATE, HONEST CHANGE.** The brief
said *"DO NOT FIX THE BROWN BY TINTING THE SEA — if the sea needs its own colour afterwards that is
a second, separate change"*, and it was right to. The shared term is repaired on its own merits and
the sea moved 12–18%. What is left is not a bug in the albedo: it is a rough water surface honestly
integrating a ground-lit hemisphere, plus haze, plus `WATER_BODY`. **A real estuary at 2 km IS
grey-brown.** Whether NOCTIS wants that is the operator's call and not a defect to be fixed
quietly. §1, §2.

**2. THE SOFFIT FRAME IS THE NEW INSTRUMENT AND NOTHING GATES IT.** §0's before/after pair
localised this term to a class of surface in one measurement, at four seconds a frame, where six
look bands and three `gateaudit` runs saw nothing. **If the below-horizon hemisphere is ever
changed again, that pair is the only thing in this project that can tell.** It is not a gate and
this session did not make it one — but a band that watches a downward-facing surface is the honest
answer to §3, and LOOK.md §7 says what re-deriving one costs.

**3. THE SHORE NEEDS A SHALLOWER SHOULDER, NOT A TALLER STRAND.** §5: the strand is correct at 8 to
24 m and is 2 to 6 px at 2 km. `SEA.strandM` is not the knob; the basin's shoulder gradient is.
That is a terrain change and it was out of scope for a colour session.

**4. `distinct:midnight|dusk` READ 0.02844 AND SESSION 65 MEASURED THE NOISE AT 0.02836–0.02838.**
That is 6 in the fifth decimal ABOVE the band session 65 established over 14 draws — small, but the
band was established before a 30.4 km2 sea entered the frame. **It should be re-measured against
the current source before anyone quotes either number as a constant**, which is the mistake session
65 caught three STATEs making.

**5. THE PERFCHECK BATTERY HAS NOW SURVIVED TWICE.** Sessions 63–65 lost it after the first route;
66 and 67 ran all four. The death is intermittent, not fixed — try the battery first, fall back to
`--route=` only when it actually dies.
