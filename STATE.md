# NOCTIS — STATE

*End of session 59. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`, 12 d 17 h of
uptime — the same boot as sessions 47–58. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` READ 1.88 AT THE FIRST COMMAND AND RAN 3.3–5.0 THROUGH THE GATES — over CONTRACT
§0.2's bar of 1.6 throughout, so no millisecond here is a verdict.*** Every number this session
turns on is a COUNT or a RATIO OF TWO FRAMES, and §0.1's corollary is that counts do not drift.

Branch `claude/noctis-59-second-eye`, three commits, all pushed as they landed.

---
## 0. THE TWO POSES, SIDE BY SIDE

The look gate has graded one camera since session 1. It now grades two, and this is what each
one can see. **Measured by positive control** — the same pose rendered at `?fill=1.0` and
`?fill=0.0`, the two extremes of the frontage-fill law, which is a **60% swing in the city's
building population**:

```
                              pixels differing    mean green moves
                              >2cv     >8cv       (of 255)
  ORIGIN EYE  street          2.74%    0.87%      0.05     midnight
  (70, 1.74, 0.9)             4.66%    2.59%      0.03     noon

  SECOND EYE  trade          93.20%   61.91%     11.87     midnight
  (-251.94, 1.7, 291.58)
```

**237× the sensitivity by mean, 34× by changed pixels.** That is the size of what the look gate
has not been able to see. `BLOCK_KEEPOUT` is x ∈ [−168, 168], z ∈ [−46, 46] and the origin shot
stands inside it looking along it; the streamed generator is clipped out of that box, so every
frame the gate graded for twenty-three sessions was of a district the generator never touches.

**The frames:** `tools/look-out/{midnight,dawn,noon,dusk}.png` (origin, and its `-wet` pair) and
`tools/look-out/trade-{midnight,dawn,noon,dusk}.png` (the second eye). `s59-neon-midnight-t0-wet.png`
is the second eye at 1600 × 900 with this session's signage in it.

---
## 1. WHICH RECORDED FINDINGS REST ON A FRAME THE GATE COULD NOT SEE

The brief asked for this list and said it is worth more than any repair. It is four entries, and
they are not all the same kind of wrong.

**1. SESSION 54's FIVE HUNDRED LIGHTS — SUSPECT, AND THE CONCLUSION SHOULD NOT BE RELIED ON.**
LOOK.md §7's second re-derivation reads: *"Session 54 put a lamp and a work light in every
courtyard in the city, lit `lot`, `carpark`, `church` and all four landmark aprons, and
`midnight ↔ dusk` reads 0.02953 against session 53's lit 0.02953 — unmoved to five decimal
places. So the band is not sensitive to street-level light in the near city."* **Every one of
those lights is in the streamed city.** The frame that measured "unmoved" contains none of them,
so what was demonstrated is that the CAMERA cannot see courtyard lighting, not that the BAND
cannot. The claim needs re-running at the second eye before anyone leans on it.

**2. SESSION 37's DENSITY SWEEP — CORRECT IN EFFECT, WRONG IN ITS STATED REASON.** *"Session 37
added 161 buildings — +30% over the region — and `band:noon` moved 0.4281 → 0.4281, a delta of
0.0000."* The conclusion drawn (the noon floor is not a ceiling on density) is TRUE for that
camera, and this session says why with a number: the FULL fill swing, four times larger than
session 37's, moves that frame's mean by **0.03 of 255**. LOOK.md §7 already half-knew this — it
cites STATE 35's *"lookcheck stands in the origin block, which the generator never touches"* in
the same paragraph — and then went on treating the band as evidence about density anyway.

**3. SESSION 53's DISTANT CITY — STANDS, AND IT IS THE COUNTER-EXAMPLE THAT MAKES THE LIST
HONEST.** That session attributed a −0.00045 move in `distinct:midnight|dusk` to the distant
silhouette and measured **516 956 of 5 760 000 pixels changed, 8.97%**. The distant ring is the
HORIZON at the end of the street, so it is inside the origin frame — more of it, in fact, than
the near streamed city is. The gate is not blind to everything the generator makes: it is blind
to everything the generator makes *within about 300 m*, which is where all the content of the
last ten sessions lives.

**4. SESSION 58's TRADES — UNSEEN BY CONSTRUCTION, AND SAID SO AT THE TIME.** Eight trades, four
colour temperatures and opening hours, and `distinct:midnight|dusk` read 0.02840 before and
after. That was blindness, not neutrality, and it is what bought this session.

**What is NOT on this list, and why:** session 55's black floor and session 56's moon are terms
in the post-process and the sky, so they act on every pixel of every frame including the origin
block's; session 43's haze is the same. Their measurements stand.

---
## 2. THE SECOND EYE — WHERE IT STANDS AND WHY

`camera.js` → `SHOTS.trade`, at (−251.94, 1.7, 291.58) looking to (−270, 3.4, 394), **fov 50 —
the origin shot's**, because two eyes that differ in field of view differ in how much sky they
carry and sky is most of what a mean luminance band measures. The one thing that may differ
between them is where they stand.

A north–south street in chunk (−3, 3), which carries **eleven trades of five kinds** — the
densest trading frontage near the origin. Chosen with
`poseprobe --target=-270,3.4,394 --eye=1.7 --dmin=104 --dmax=104`, which ray-tests candidate
stand-offs against the **1 146 delivered building occluders** and reported nine clear of
forty-one. **It refused the azimuth the session had picked by eye** (270°, which grazes a
building) and endorsed 280°, which is the tool earning its place.

**IT WAITS FOR THE CITY A SECOND TIME.** The camera moves about 570 m, so the entire resident
ring is replaced — every chunk in frame is one the page has never generated. Without a second
`waitForCity` the gate would grade a frame lit by the analytic default instead of the baked
field, which is the defect the first one's own comment records. Delivered: re-streamed over
254–264 frames, **30/30 field slots ready**.

**DRY ONLY.** The wet set exists to assert that water doubles the light, and that is a claim
about a MATERIAL rather than about a place; asserting it twice at two poses would be one claim
wearing two names.

---
## 3. THE FOUR NEW BANDS ARE A DERIVATION, NOT A RE-DERIVATION

No threshold is moved. Four are written for a place that has never had any, dated 2026-08-31,
with the whole argument in `look-budget.json` → `$tradeBands`.

```
  time       measured   band            what the band rejects
  midnight    0.1926    [0.158, 0.228]  a half stop is ±0.056 — outside
  dusk        0.1965    [0.162, 0.232]  ±0.058 — outside
  dawn        0.3177    [0.283, 0.353]  ±0.093 — outside
  noon        0.4472    [0.412, 0.482]  ±0.131 — outside
```

**THE WIDTH IS ±0.035 AND IT IS BOUNDED ON BOTH SIDES.** From below it must not fire on content:
the full fill swing moves this frame by 0.047 and a session-scale change is about half of that,
so 0.035 clears a realistic session with margin, and it also declines to fire on a legibility
change the size of session 55's black floor (+0.023). From above it must still catch a break in
the exposure or tonemap chain, and a half stop is outside it at every time of day. Total width
0.07, inside `bandRules.maxBandWidth` 0.1.

**AND THERE IS NO ORDERING OR GAP RULE HERE, WHICH IS A FINDING RATHER THAN AN OMISSION.**
`bandRules.minBandGap` asserts that the four times are separated in LEVEL. That is a property of
the origin block — dark at night because almost nothing lights it. **On a trading street
midnight and dusk differ by 0.0039** (0.1926 against 0.1965) where the origin eye reads them
0.046 apart, because the shopfronts and their neon light this street at midnight to very nearly
its dusk level. A rule the place demonstrably cannot satisfy is not a stricter gate.

---
## 4. gateaudit — FIVE NEW CASES, AND A TRAP IN ITS OWN WALKER

Every new band has a falsifying case: each of the four scaled until it leaves its band, plus
**"the trade frames never arrived"**, which matters here in a way it does not for a camera that
never moves — this eye re-streams the whole ring, so *the capture silently produced nothing* is
a real failure mode. All five are rejected as required.

**AND THE COVERAGE WALKER HAD A TRAP.** `knobsOf` skipped exactly one key by name, `$comment`,
so the first `$`-prefixed key ever added to `look-budget.json` — `$tradeBands`, this session —
was counted as a threshold and the audit demanded a falsifying case **for a paragraph**. All
three budget files carry their derivations under `$` keys (`$derivation_zero`, `$surface`,
`$estimator`, `$triangles_s37_LOD_MEASURED`), so the walker knew one spelling of a convention
used everywhere. It skips any `$` key now; adding `$tradeBands` to the hardcoded set would have
moved the trap one key along rather than removing it, which is the shape CONTRACT §9.1 records
for `pierEvery`.

---
## 5. ITEM 2 — `signScale` DOES SOMETHING

Session 58 wrote it onto all eight trades and nothing read it. It does two things now, and both
are the same fact about the business: **a bar's whole shopfront strategy IS its sign**, because
`TRADES.bar.out` is 0.20 and almost no light leaves its glass, while a laundrette's is a lit
window. `signScale` runs 0.60 (kiosk) to 1.45 (bar).

- **The blade probability** scales with it, clamped at 0.85 so no trade is certain to hang one:
  bar 0.34 × 1.45 = 0.49, kiosk 0.34 × 0.60 = 0.20.
- **The width** scales with it, and through `bladeHeightM`'s own `width × aspect` that makes a
  bar's blade TALLER as well as wider — "bigger and more vertical where the trade would have it"
  by one multiplier rather than a second roll.
- **Capped at 0.85 of its own frontage**, because session 43 found two signs wider than the
  buildings they are bolted to when an absolute width roll met a narrower elevation, and a scale
  that multiplies a width has exactly that failure mode.

Delivered over the gate's 10 × 10 at seed 1337: **113 blades against session 34's 85, all 113
taller than wide, and the tallest sign in the city is 34.31 m** where session 34 left it at
14.89 and called that a start. By trade: bar 22, shop 23, cafe 15, takeaway 13, restaurant 9,
hairdresser 8, laundrette 7, kiosk 4 — a bar hangs one at three times a kiosk's rate.

---
## 6. GATE STATE

```
  gate            exit   verdict   seconds  load1 in   out
  parsecheck         0     GREEN       3.5     3.45    3.45    117 files, contract-clean
  faultcheck         0     GREEN       9.8     3.45    3.61
  lookcheck          1       RED      46.7     3.61    4.18    THE IDENTICAL THREE
  windcheck          0     GREEN      36.1     4.18    4.61
  inputcheck         0     GREEN      14.3     4.61    4.78
  gateaudit          1       RED      73.5     4.78    5.03    the carried control
  citycheck          1       RED     115.6     5.03    4.76    IDENTICAL TO SESSIONS 57–58
  perfcheck          1       RED    1022.9     4.76    3.31

  4 of 8 RED — the same four as sessions 53–58. NOT ONE NEW RED THIS SESSION.
```

**THE FOUR NEW BANDS PASS, AND THEY PASSED A TEST NOBODY DESIGNED.** They were derived from
measurements taken BEFORE item 2 changed the signage; item 2 then added 28 blades and took the
tallest sign in the city from 14.89 m to 34.31 m. Re-measured through the gate afterwards:

```
  time       derived from   delivered after item 2   band
  midnight     0.1926            0.1906              [0.158, 0.228]
  dusk         0.1965            0.1975              [0.162, 0.232]
  dawn         0.3177            0.3176              [0.283, 0.353]
  noon         0.4472            0.4472              [0.412, 0.482]
```

The largest move is 0.0020 against a half-width of 0.035 — **the band tolerating a session's
content change, which is precisely the lower bound it was derived against**, demonstrated in the
live direction rather than argued.

**`lookcheck` is red on the IDENTICAL THREE**, all of them origin-block assertions:
`distinct:midnight|dusk` 0.02841, `facadeAlbedo` and `facadeNeighbours` at dusk. `gateaudit`'s
only failure is that same control, which it NAMES rather than swallowing — and all five new
trade cases are rejected as required.

**`citycheck` is identical to sessions 57 and 58**: clumping 0.393, the same five delivered
overlaps, 1 004 bare walkable samples. Its sign census reads **2 of 2 647** quads inside a
building against session 58's 2 of 2 645 — the two extra quads are this session's blades and
neither is buried.

**`perfcheck`: 2.30 M triangles and 401 draws, session 58's figure to three digits** (336 587
instances against 336 577). Twenty-eight more blades and a sign three times taller cost **56
triangles**, because a sign is a plane quad and scaling one adds no geometry. The ~60 000 of
headroom stands and the ceiling was not touched.


---
## 7. WHAT TO DO FIRST NEXT TIME

1. **RE-RUN SESSION 54's CLAIM AT THE SECOND EYE** (§1 entry 1). Five hundred courtyard lights
   were measured as moving `distinct:midnight|dusk` by 0.00000 on a frame containing none of
   them. The gate can see them now. That is one command and it settles whether LOOK.md §7's
   second re-derivation is describing the band or describing the camera.
2. **THE REST OF ITEM 2, WHICH THIS SESSION DID NOT REACH**: signs beyond the shopfront — gable
   ends, roofs, the viaduct, the bridges, the waterfront — and the **53 holograms**, untouched
   since session 43 and now placeable over commercial frontage, which the city knows the
   location of. Session 45's sign light role has 16 slots and the census reads 373 of 384 used,
   so **11 spare** before anything is spent.
3. **A SECOND EYE FOR THE OTHER GATES.** This session fixed the LOOK gate. `citycheck`'s census
   region and `perfcheck`'s four routes all run down the same main street; whether they carry
   the same blindness is not established, and the positive control in §0 is the cheap way to
   ask.
4. **CARRIED**: STATE 57 §0.1, the triangle ceiling at 2 630 000, still awaiting the operator;
   shopfront glass following the clock (`noctisRough.z` is free); the
   `sign(adpillar) × prop(cyclestand)` chunk seam; the platform stairs; a curved road needing a
   new ground kind; 128 blocks with 2 distinct lengths; cloudy.
5. **`decodePNG` RETURNS THREE BYTES PER PIXEL.**
