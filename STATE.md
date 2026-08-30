# NOCTIS — STATE

*End of session 55. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`. The machine has
**NOT** rebooted since session 40 — 11 d 13 h of uptime at the first command, the same boot as
sessions 47–54. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` READ 2.40 AT THE FIRST COMMAND — 0.80 OVER CONTRACT §0.2's BAR OF 1.6 — AND ROSE TO 5.70
BY THE GATE RUN.*** A browser was open for most of the session and one headless Chromium measures
130% CPU. **NO ABSOLUTE MILLISECOND IN THIS DOCUMENT IS A VERDICT** unless it is green. Everything
else quoted is CODE VALUES, cd/m², counts, areas, metres and reflectances — off a delivered frame,
off the buffers the composite itself reads, or out of the pure generator.

---
## 0. THE MIDNIGHT FRAMES, AND THE RADIANCE CHAIN THE BRIEF SAID TO OPEN WITH

The brief: *"FRAMES ARE THE VERDICT, and for items 1–3 they are MIDNIGHT frames, wet, at street
level. He judges this in the dark."* `tools/shot-out/`, and the `-before` arm of the headline pair
is a **paired git worktree pinned to `3d45bd0`** — session 54's HEAD — rather than a stash, so the
two frames are two builds and not one build twice.

```
  s55-church-{before,after}-t0-wet.png     HIS OWN CHURCHYARD SPAWN, at MIDNIGHT, WET, looking
                                            down at the ground he says he cannot see. THE FRAME.
  s55-lawn-{before,after}-t0-wet.png        ITEM 3's OWN A/B, same pose, one change: the lamp
                                            posts stop reflecting in the lawn and the road keeps
                                            reflecting, which is the whole of the item.
  s55-graves-dry-t0.png                     THE CONTROL THAT FOUND ITEM 3. The same churchyard
                                            DRY: the headstones read. Wet, they did not.
  s55-street-t0-wet.png                     `lookcheck`'s own street pose at midnight, wet — the
                                            frame the radiance chain below was second-measured on.
  s55-dome-portico-t0_5904-wet.png          ITEM 5. A roof on columns over a wet asphalt drive
                                            with the dome behind it, at HIS OWN dome time.
  s55-dome-nadir-t0_5.png                   The same from 150 m: four cardinal drives, the
                                            portico and the drop-off, at noon so the surfaces read.
  s55-dome-air-t0_5904-wet.png              The dome from 58 m at dusk, wet, for the setting.
  s55-hud-weather-rain.png                  ITEM 4. The new `weather clear | wet | rain | cycle`
                                            row with `rain` held, beside the `time` and `rate`
                                            rows it copies.
```

**AND THE HEADLINE PAIR MEASURED, BECAUSE A FRAME MEAN IS THE WRONG STATISTIC AND A DISTRIBUTION IS
THE RIGHT ONE.** `decodePNG` checked for THREE bytes per pixel first, per STATE 52 §2.2. Green code
value over all 1 166 400 pixels of `s55-church-{before,after}-t0-wet.png`:

```
                 mean     p05   p25   median   p75   p90    under 4/255   under 8/255
  before        0.0706      1     2       7     19    29       35.4%         50.5%
  after         0.0950      9    10      13     26    39        0.0%          0.0%
```

**A THIRD OF THAT FRAME WAS UNDER FOUR CODE VALUES AND NONE OF IT IS**, and the median surface has
nearly doubled. It is still a dark churchyard — that is what §0 asked for — and it is no longer a
black one.

**AND THE SESSION IN ONE SENTENCE:** four content increases had not answered *"it is no fun when you
cannot see anything"*, so this session wrote the goal down first (§1), measured the whole chain from
a lamp's candela to a byte and found that the meter takes 0.64 of every stop back (§2), gave the
night a floor that lands after the meter and cannot be taken back (§3), stopped a lawn being a
mirror (§4), put the weather on a row he can click (§5) and gave the dome a way in (§6) — at **+0
draw calls and +0.00 M triangles**, with the generator's own claims clean and the same four gates
red as sessions 53 and 54.

### 0.1 THE CHAIN, MEASURED — AND IT REPRODUCES THE FRAME TO ONE CODE VALUE

`tools/radianceprobe.mjs`, at the operator's own churchyard spawn, midnight, wet, 1440 × 810 so
that the internal buffer and the screenshot are ONE GRID (`RENDER.neverExceedNative`). It reads the
three buffers the composite adds together and the 1 × 1 the exposure multiplies by, then reproduces
the composite's own arithmetic in JS and **checks its last step against the delivered PNG byte** —
CONTRACT §9 rule 2, the same quantity two ways. **Worst disagreement over five points at two poses:
1 of 255**, which is the composite's own ±1 dither.

```
  step                     the darkest surface   the median surface   the brightest
  1  scene radiance             0.0673 cd/m²         0.2604               8938.1
  2  x exposure 0.02508         0.00169              0.00652              223.6
  3  + bloom x 0.016            0.00058              0.00211              5.369
  4  + glare x 0.010            0.00008              0.00047              0.0014
  5  Purkinje mix                  0.47                 0.14              0.00
  6  ACES + toe                 0.00021              0.00119              1.0000
  7  sRGB encode                      1                    5                255
     the frame's own byte             1                    5                255
```

**41.9% OF EVERY SURFACE IN THAT FRAME WAS UNDER 4/255 AND 58.6% UNDER 8.** That is the operator's
sentence as a number, and `s55-graves-dry-t0.png` is the same statement as a picture.

### 0.2 WHERE THE FIVE HUNDRED LIGHTS WENT, AND IT IS NOT THE POOL

The brief's own hypothesis was the light pool, and **it is not saturated at either pose**: 75
active of 75 candidates in the churchyard, 29 of 29 on the main street, against a pool of 98. Nor
is it the `minEV` clamp: `EV_used` is 5.457 and 5.799 against a floor of 3.0, so the clamp is
nowhere near. Nor is it the §5.7 indirect field: `?indirect=0` moves the churchyard's median
surface 0.4809 → 0.5405 cd/m² and its code-value distribution **not at all** (median 9 both ways),
because at midnight there is nothing above to bounce.

**IT IS `EXPOSURE.adaptStrength`, AND THE ARITHMETIC IS ONE LINE.** §5.4's partial adaptation is
`EV_used = 11 + (EV_measured − 11) × 0.64`, so a GLOBAL stop of content arrives as **0.36 stops on
screen** and the meter takes the other 0.64 back. To move a black surface 4× therefore costs
**51× the scene radiance**. Session 54's five hundred lights were LOCAL, which is why they moved
0.85% of one frame by +0.031 and the whole-frame mean by −0.0005 — and why they moved
`distinct:midnight|dusk` by 0.00000.

**AND THE NIGHT'S OWN LIGHT HAS NO DIRECTION, WHICH IS THE OTHER HALF.** `sky.js`'s own terms,
evaluated at t = 0:

```
  urban skyglow (pollutionNits 3.2)     2.986 lx     92.1%   isotropic
  airglow                               0.147 lx      4.5%   isotropic
  sky scattering + THE MOON             0.107 lx      3.3%   the moon is the only directional part
  ───────────────────────────────────────────────────
  lighting.ambientLux                   3.240 lx
```

**96.7% of the light on a night surface in this city arrives from a dome with no direction in it**,
so every face of every object returns the same radiance and there is nothing for a shape to be made
of. That is a finding this session did not act on and §8 carries it.

---
## 1. ITEM 0 — LOOK.md §0, AND IT IS THE ONLY THING IN THIS SESSION THAT IS A DECISION

The brief: *"WRITE THE GOAL INTO LOOK.md FIRST — this is a decision, not a measurement."* Its own
commit, before any measurement, because it changes what every number after it is for.

**NOWHERE IN CONTRACT.md, STATE.md OR LOOK.md DID ANY LINE SAY THE PLAYER MUST BE ABLE TO SEE.**
Fifty-four sessions optimised faithful radiance against the only written targets there were — lamps
in candela, surfaces in albedo, air with a density, four luminance bands — and faithful radiance in
a graveyard at 3 a.m. is black. That is not a bug in any of the fifty-four; it is a goal that was
never stated. LOOK.md §0 states it, in the operator's own words:

> **THE CITY MUST BE LEGIBLE ANYWHERE A PLAYER CAN STAND, AND WHERE FAITHFUL LUMINANCE AND
> LEGIBILITY CONFLICT, LEGIBILITY WINS.**

It also states what it does NOT license, because that is the half a later session will need: it is
not a global lift, auto-exposure pays for anything added, the lever it asks for is a FLOOR that acts
where the picture is black and nowhere else, and the magnitude is derived from LEGIBILITY rather
than from lux.

---

## 2. ITEM 1 — THE INSTRUMENT, AND THE THREE HYPOTHESES IT KILLED

`tools/radianceprobe.mjs`. **NOT A GATE.** §0.1 is its output.

**THE READBACK IS IN THE TOOL AND NOT IN `src/`, AND THAT IS A RULE RATHER THAN A PREFERENCE.**
CONTRACT §5.4 forbids `readRenderTargetPixels` on the frame path and `parsecheck` enforces it as
*"forbidden in a module"* — stricter than the sentence it enforces, and the right strictness, since
a module that CAN read back is one frame away from doing it every frame. The first arm put the
readback in `post.js` and `parsecheck` refused it on the first run. `post.radianceBuffers()` and
`exposure.adaptedTarget()` hand out the render targets instead, which is the shape `motionTexture`
and `ssrSource` already have.

**HALF-FLOAT IS DECODED AND NOT ASSUMED.** Every target in `post.js` is `HalfFloatType` (§5.2), so
`readPixels` wants a `Uint16Array` and returns IEEE-754 binary16; reading it into a `Float32Array`
returns whatever the driver felt like. STATE 52 §2.2 is what assuming costs — a whole plausible and
entirely wrong table.

**AND THE TRANSCRIPTION IS CHECKED EVERY RUN, WHICH IS THE PART WORTH KEEPING.** The tool carries a
second copy of the composite's arithmetic, which is §9.1's own failure mode — so it compares its
last step with the delivered byte and says so. When the black floor landed, the unchanged tool
reported **10 of 255 disagreement and "THE CHAIN DOES NOT REPRODUCE THE FRAME"**, which is exactly
what a checked transcription is for.

---

## 3. ITEM 2 — THE NIGHT GETS A FLOOR, AND IT IS THE FIRST ANSWER TO "TOO DARK" THAT IS NOT CONTENT

`POST.blackFloor` = **0.0025** display-linear, added after the ACES fit and before the sRGB encode,
in the same shape `ACES_TOE` already had one line above it — the toe repairs the FIT, this repairs
the PICTURE.

**WHY ADDING BEATS MULTIPLYING, MEASURED.** Near black sRGB is LINEAR at 12.92, so ×1.28 on a code
value of 8 is a code value of 10 while ADDING the same energy is 18. At the dark end an additive
floor is about **four times more efficient per unit of frame mean than any multiplicative lever in
the system**, and it is the ONLY lever the meter cannot take back, because it lands after it.

**WHERE 0.0025 COMES FROM, AND NO LUX APPEARS IN IT.** Below 0.04045 encoded, sRGB is linear, so one
code value is a FIXED luminance step and the contrast between neighbours at level `c` is `1/c`: at
c = 4 two neighbours differ by 25%, at c = 2 by 50%. A surface living between 1 and 8 has eight
steps to carry every shape in it and the steps are 12–100% apart — its form is not dark, it is
QUANTISED AWAY. A Lambertian box under a high moon shows three faces at about 1 : 0.6 : 0.3, and
`post.js` dithers ±1, so a face must clear its neighbour by 3 code values: **3 / 0.30 = 10 code
values is where a headstone starts to read.** The gates allow 9.

**THE SWEEP, against the four delivered `look-out` frames through a model that reproduces
`lookcheck`'s own means to four decimals at f = 0:**

```
  f         band:midnight    dusk     dawn     noon    dusk-noon R-B   spread(mid)
  0.0000       0.0837       0.1407   0.3018   0.4294      0.0745          0.141
  0.0025       0.1063       0.1546   0.3098   0.4338      0.0775          0.134
  0.0030       0.1103       0.1577   0.3114   0.4343      0.0790          0.133
  0.0035       0.1142 RED   0.1602   0.3125   0.4349      0.0786          0.131
```

`meanLuminanceBands.midnight` has a ceiling of 0.112 and the crossing is at about f = 0.0032.
**0.0025 leaves 0.0057 of margin against a band whose run-to-run spread is 0.0001** — fifty-seven
times the instrument's own resolution, which is the margin §0.1 permits a decision on and the same
test session 30 applied to the lamp bowl. **NO THRESHOLD MOVES.**

**A FLAT FLOOR WAS BUILT FIRST AND TURNED `warmth:dusk` RED — 0.0745 → 0.0615 against a floor of
0.07 — AND AN ACHROMATIC ONE OF THE SAME SIZE IS RED TOO, AT 0.0650.** Any additive lift
desaturates a dark pixel, because sRGB is concave, and dusk has more dark area than noon. The gate's
own comment says what it is for — *"something is tinting instead"* — and the sky model had not
changed at all; it was right to fire, because the flat floor really was making the picture greyer.

**SO THE FLOOR TAKES THE PIXEL'S OWN CHROMATICITY WHERE THE PIXEL HAS ONE**, and the rod
chromaticity where it does not, blended by `y/(y + f)` — 0 at true black, 1/2 at the floor's own
level, 1 above it, with no width in the ramp that is not the floor's own magnitude. It is the
physically-shaped choice rather than a repair: a veil that desaturates is a LENS artefact and §5.5
already models one; a FLOOR stands for light on a surface, and light on a surface comes back with
the surface's colour. Delivered: **`warmth:dusk` reads 0.0775 against 0.0745 unfloored** — the floor
makes the dusk frame measurably WARMER than the city it was added to.

**THE CAST IS THEREFORE FREE AND IT IS THE FULL ROD VECTOR**, acting only where the pixel has no
colour of its own. Delivered true black is **RGB 7, 8, 12** — a blue-over-red of 1.71, which is
LOOK.md §0's *"a slight cast so the dark reads as night"* at the one place in the picture where
nothing else has an opinion about the colour. `shadowHue:noon`, the gate on the other side of that
decision, moves **1.096 → 1.106 against a ceiling of 1.15**.

`POST.rodChroma` is hoisted out of the composite, where it was `vec3(0.805, 1.007, 1.510)` with no
derivation for twenty-eight sessions (§9 rule 5), and is read by both terms out of one uniform.

**WHAT THE OPERATOR GETS.** At his own churchyard spawn, midnight, wet, over 2 011 surface samples:

```
                     min   p10   p25   median   p75   p90    under 4/255   under 8/255
  before               1     1     2       5     20    30       41.9%         58.6%
  after                9     9    10      12     19    28        0.0%          0.0%
```

**AND THE BRIEF'S OTHER ITEM-2 QUESTION IS ANSWERED AND THE PREMISE IS STALE.** *"Session 30 left
the block lamps at 420 cd/m² against a derived 1952.2 … If that is still 0.2151×, check it."*
**It is not. `BOWL_ORIGIN_FACTOR` has been 1.0 since session 45** — the origin block's bowl IS the
derivation, and `city-budget.json` → `lampBowl.minRatio` moved to 0.9999 with it. What was still
wrong is a COMMENT: `LAMP_BOWL.originFactor`'s own paragraph still read *"0.2151× the derivation,
i.e. 4.65× too dim since session 30"* seventy-seven lines below the change that repealed it. Fixed,
in the past tense, per §8's rule about a stale sentence.

---
## 4. ITEM 3 — WET GRASS IS NOT A MIRROR, AND A KERB WAS TWO FLOATS OUT OF STEP

The operator's frame is a lamp post reflecting in a lawn
(`?player=1&wet=1&spawn=458.79,-1.01,103.78&t=0.0409&seed=1337`). Session 52 measured that
`SURFACE.wetDarkening` multiplies every diffuse surface by the same 0.5 and predicted the specular
half was built the same way. **It was**: `gNoctisWetPond` is `uNoctisWet × faceUp × openness` — the
WEATHER and the GEOMETRY, with no term that asks what the surface is made of — so a churchyard, a
park, a gravel path and a carriageway all became the same mirror.

**THE PHYSICAL QUESTION IS NOT "IS IT WET", IT IS "DOES IT POND"**, and that has a standard answer:
`porosity = min(1, K / R)`, K the saturated infiltration capacity and R this project's own
`RAIN_FULL_MMH` = 10 mm/h. Turf over topsoil takes 20–30 mm/h, so **a mown lawn infiltrates two to
three times this city's heaviest rain and never ponds at all.** grass and gravel path 1.00, site
hardcore 0.30, every sealed surface 0.00 — which is what every surface in this city was before, so
nothing else moves.

**IT COSTS NO ATTRIBUTE SLOT.** `noctisRough` was a `float` occupying a whole four-component slot
and is a `vec2` now, `.y` being the porosity — the same trick session 14 used to get a third colour
zone out of two attributes. A geometry supplying the old one-component attribute, or none, reads
`.y = 0`. The pedestrian program is at 16 of 16 and is untouched, because this attribute is not
declared on it.

**THE DARKENING IS DELIBERATELY NOT SCALED BY IT.** Wet grass is DARKER than dry grass; scaling it
would have repaired a mirror by making a lawn paler.

**AND THE FIRST ARM DID NOTHING, WHICH IS THE FINDING WORTH KEEPING.** `buildGround` emits into four
parallel arrays and `riser` — the kerb upstand — pushed to three of them. Every vertex after the
first kerb read a porosity **two floats out of step**, so a car park read as a lawn and a lawn as a
car park, and the frame showed a churchyard that was still a mirror. Parallel arrays are CONTRACT
§9's own shape: two descriptions of one vertex that nothing compares. It was found by an arm that
made EVERY ground kind porous, which worked, against one that named grass, which did not — the
positive control §7.3 asks for, arriving as a debugging step.

`s55-lawn-{before,after}-t0-wet.png` is the pair: the lamp posts stop reflecting in the lawn and the
road behind them goes on reflecting, which is the whole of the item in one picture.

---

## 5. ITEM 4 — A WEATHER ROW, AND CLOUDY IS COSTED RATHER THAN BUILT

`ui.js`, beside the `time` and `rate` rows, through the same `button()` that releases the pointer
lock. `wet` and `rainfall` are both CONTRACT §6 parameters with live setters, so a preset is two
numbers and one button.

**MIND THE SHOWER CYCLE, AND THE ROW DOES.** Session 44 made `rainfall = -1` defer to a derived
cycle and `>= 0` pin it, and `weather.js` says the pin is *"not 'writes the same value': does not
write"*. A row that only pinned would take the weather away from anybody who pressed it once. So
`cycle` hands BOTH states back, each button's `title` says whether it pins, and the HUD prints
`pinned` beside the rate while one of the first three is held. Measured through the real buttons:

```
  button   rainfall   mm/h   pinned   wetness   overridden   visibility   next shower
  boot       0.00      0.0    false     0.549      false        8693 m       868 s
  clear      0.00      0.0    TRUE      0.000      TRUE         8693 m         —
  wet        0.00      0.0    TRUE      0.850      TRUE         8693 m         —
  rain       1.00     10.0    TRUE      1.000      false        1951 m         —
  cycle      0.00      0.0    false     1.000      false        8693 m       863 s
```

`rain` seeds the wetness and hands it back, so the road goes on being driven by the water budget
instead of frozen at the number a button chose — which is the difference between a preset and a
mode. The three numbers are the project's own: `night_rain`'s 0.85 (which is `DRY_TAU_S·ln(1/0.85)`
= 488 s after full rain stops), and full rain's equilibrium `rainfall^0.6` = 1.

**NO CLOUDY, AND WHAT IT WOULD COST IS WRITTEN DOWN RATHER THAN GUESSED.** `sky.js` marches a
Rayleigh/Mie atmosphere with a sun disc and has **no cloud term at all**. Overcast would need one in
the LUT, a matching CPU-side `skyIlluminance` (or the photocell and the shader disagree about how
many lux are on the street), the sun's own `intensity` and `castShadow`, the PMREM environment every
specular in the city reads, and `ATM.hazeDensity` — against **four luminance bands every one of
which was derived in clear air**. That is a session, not an hour.

**ITEM 4(d): EVERY UNIT CHECKED, AND THE BRIEF'S PREMISE IS STALE.** The defect it names — *"hud.js
printed a 0..1 fraction labelled mm/h for forty sessions"* — was repaired in session 44 and the line
now prints both quantities with both labels. All five read correctly against what they read:
`rain 1.00 (10.0 mm/h)` off `rainfall × RAIN_FULL_MMH`, `next shower 14.4 min` off `nextShowerS/60`,
`wetness 1.00` dimensionless, `visibility 1951 m` off `KOSCHMIEDER / hazeDensity` — which is the
same 1951 m `weather.js`'s own boot log derives — and `lamps on` off the photocell.

---

## 6. ITEM 5 — THE DOME HAS A WAY IN

STATE 54 §8 item 3 specified this and did not build it. `LANDMARK_APRON` gains `approaches`,
`portico`, `dropOff` and `approachGround`, one sentence a row: the condenser gets ONE approach and
no portico (a works compound has a gate), the two halls get four and a portico and a drop-off, the
weir gets four walks and neither.

**CARDINAL IS GEOMETRY AND NOT TASTE**: every ground rectangle here is axis-aligned, so a radial at
37° is drawn as a comb. They are claimed `path` **BEFORE the boundary run**, which makes the gate
free — `occupancy.js` forbids `feature × path`, so the railing bays a drive crosses are refused by
the paving and the opening appears without either routine knowing the other exists.

**THE FIRST ARM RAN FROM `landmarkGroundRadius` AND EVERY BEARING CAME BACK `conflict with
landmark`.** The registry's claim is a 2.1 m STAIRCASE containing the arc, not a circle of that
radius, so along the centreline it reaches further out than the radius does. The run now starts at
the landmark's own centre and the staircase is SUBTRACTED — the residue is exactly the apron, which
is the definition of the precinct. A length computed twice is a length that disagrees with itself.

**THE PORTICO IS THE AMBULANCE BAY'S OWN THREE NUMBERS.** STATE 54 designed *"16.0 × 13.0 m at
5.4 m — three car lengths long, one bay plus a footway deep, and high enough for a van"*, and
`PROGRAM.hospBay{Long,Deep,High}M` is **16 × 9 at 4.6**, described in its own comment as *"a canopy
a vehicle turns under"*. 16 agrees exactly; **the 13.0 counts the footway twice** — one bay
(`DEAD_ZONE.bayL` = 5.0) plus one footway (`CITY.sidewalkWidth` = 4.2) is 9.2, which is the 9
already there — and the 5.4 was authored where a derived 4.6 existed.

**THE FRONT IS DERIVED RATHER THAN CHOSEN**: the bearing that faces the city centre, so the exchange
fronts west and the dish south. It has to be a function of the LANDMARK and not of the chunk — each
chunk lays only the approaches inside it, so taking `approachDirs[0]` gave **three canopies across
three chunks on a building with one door**, measured before it shipped.

`approachGround` is the surface and it is a contrast decision session 50 already measured: gravel at
0.19 on a forecourt at 0.26 is a 27% step and reads as nothing, so three of the four are DRIVES in
the car park's own asphalt at **3.2×**, and the weir's are WALKS in the park path's gravel, which is
2–3× against grass by itself.

Delivered over 13 × 13 chunks at seed 1337: **+54 ground quads, +1 345 m² of approach, +2 porticos,
+8 drop-off dividers**, and `s55-dome-portico-t0_5904-wet.png` is what it looks like from the drive.

### 6.1 AND A SEAM, WHICH `citycheck` FOUND AND WHICH TOOK THREE ARMS

`path(exchange:approach) × prop(bench)` at 0.287 m² **among the GENERATOR's own claims** on the
first run. It is a CHUNK SEAM: a scatter draws a prop's CENTRE from a rectangle clipped to its own
chunk and then claims the prop's full half-width, so a bench half a metre inside one chunk's edge
reaches into the next — where the approach is, and where that chunk's registry has never heard of
it. The gate pools every chunk's claims, so it sees the pair neither generator could.

Session 52 met this exactly once before, with `latticeCorridor` and a tree, and wrote the rule down:
**the guard is the sentence rather than the seam.** `inLandmarkApproach(x, z, pad)` reads nothing
but `LANDMARKS`, `LANDMARK_APRON` and the point — the same answer in every chunk in every order.

**IT TOOK THREE ARMS AND THE THIRD IS THE FINDING.** Guarding the apron's own scatter left it;
guarding the island's and the core's left it; **the bench came from the KERB BAND**, because an
approach reaches sixteen metres past the claim, which is exactly where the footway furniture is.
Delivered: **0 generator conflicts over 11 × 11 chunks**, and the delivered sweep back to the
IDENTICAL FOUR sessions 52, 53 and 54 carry (6 → 4).

---
## 7. GATE STATE

Run through `tools/rungates.mjs`, all eight, in **24 minutes**. **`load1` ran 4.58 to 6.11 across it
and was never inside §0.2's bar of 1.6** — a browser was open for most of the session.

```
  gate            exit   verdict   seconds  load1 in     out
  parsecheck         0     GREEN       3.6      5.15    5.15     117 files, contract-clean
  faultcheck         0     GREEN      11.0      5.15    4.91
  lookcheck          1       RED      34.6      4.91    5.33     THE IDENTICAL THREE
  windcheck          0     GREEN      38.3      5.33    5.75     568 names / 568 meshes
  inputcheck         0     GREEN      14.3      5.75    5.45
  gateaudit          1       RED      71.6      5.45    6.11     the carried control
  citycheck          1       RED     115.0      6.11    4.58     THE IDENTICAL FOUR, minus two
  perfcheck          1       RED    1234.4      4.58    3.47     15 over four routes
                                  -------
                                    24 min for the whole suite

  4 of 8 RED — lookcheck, gateaudit, citycheck, perfcheck. The same four as sessions 53 and 54.
```

**ONE EDIT WAS MADE AFTER THIS RUN AND IT IS NAMED**, because a suite run that describes a tree that
no longer exists is worse than no run at all: **a COMMENT in `constants.js`** — `LAMP_BOWL
.originFactor`'s stale paragraph (§3). No behaviour, no number, no threshold. `parsecheck` was
re-run on it.

### 7.1 CITYCHECK — THE GENERATOR'S OWN CLAIMS ARE CLEAN FOR THE FIRST TIME THIS SESSION

```
  0 forbidden overlaps among the GENERATOR's own claims — 2 on the first run of item 5's
    content, and §6.1 is what closed them
  4 delivered overlaps — THE IDENTICAL FOUR (planter x lamp:column, colonnade:pier x
    sign:blade, adpillar x planter, sign:blade x pylon)
  generator claims 17 668, delivered 18 099 — session 54 read 17 655 / 18 082
  clumping CV 0.389 against 0.60 — session 54 read 0.389
  2 of 2666 sign quads inside a building — the same two, seven sessions
  1004 of 284 382 walkable samples on bare earth (0.40 ha) — IDENTICAL to sessions 52, 53 and 54
  342 instanced meshes, 342 labelled, 0 not; 0 whose label does not sum to their instance count
  bright reserve GREEN. 195 stalls, 360 pedestrians, 5 eras, 5 sign mountings
```

### 7.2 LOOKCHECK — THE IDENTICAL THREE, AND EVERY BAND MOVED AND STAYED INSIDE

```
  frame        mean      sd      clipW    crushed black    R-B     clusters
  midnight    0.1063   0.134    0.007%      0.000%        0.096      80
  dawn        0.3097   0.227    0.000%      0.000%        0.128     139
  noon        0.4337   0.215    0.000%      0.000%        0.044      44
  dusk        0.1550   0.129    0.000%      0.000%        0.121      64

  distinct:midnight|dusk   0.02621 against 0.03000 — §3, and LOOK.md §7 carries the THIRD
                           re-derivation, dated 2026-08-30
  facadeAlbedo:dusk        3 clusters over 5 walls against 4     unchanged
  facadeNeighbours:dusk    2 of 3 adjacent pairs                 unchanged
```

**MIDNIGHT'S CRUSHED BLACK WENT 0.639% → 0.000%**, which is the floor doing exactly what it is for,
and every one of the four bands is inside with margin: midnight 0.0057 under its ceiling, dusk
0.0150 over its floor (it was 0.0005 over), dawn 0.0107 over, noon 0.0057 over. **`warmth:dusk`
reads 0.077 against a floor of 0.07 where the unfloored city read 0.075.**

### 7.3 PERFCHECK — AND THE TWO NUMBERS THIS SESSION COST ARE +0 DRAWS AND +0.00 M TRIANGLES

```
                    draws  s54    tris   tris s54   instances  wall p95   cpu p95   froxel
  highway_speed       398  398   2.29M     2.29M     327 303   12.10 ms  10.80 ms   17/96
  downtown_dense      320  320   2.01M     2.01M     250 700   25.10     23.70      59/96
  night_rain          319  319   1.98M     1.98M     307 046   26.60     25.20      56/96
  player              309  309   1.96M     1.96M     250 700   26.00     24.70      59/96
```

**EVERY FIXTURE THIS SESSION ADDED RIDES IN A MESH THAT ALREADY EXISTED**: the black floor and the
porosity are shader terms, the approaches are ground quads in `city:ground`, the two porticos are
`canopy` features in the chunk's own masses, and the weather row is DOM that no gate renders.
2.29 M against a `ceilings.triangles` of 2 360 000 leaves **70 000**, unchanged.

**FIFTEEN VIOLATIONS, THE SAME COUNT AS SESSION 54, AND FOUR OF THEM ARE NOT FRAME TIMES:**

- **`night_rain` MEAN LUMINANCE IS NO LONGER ONE.** Session 54 recorded it as CONTRACT §0.1's own
  incident — 0.0797 against a floor of 0.08, per-run [0.0797 0.0949 0.0786], *"a straddle, not a
  finding"*. It reads **0.1078, per-run [0.1168 0.1078 0.104], every run clear**. The black floor
  closed it, and that is attributable because the floor is the only thing in this session that
  touches that route's level.
- **`downtown_dense` FRAME ENTROPY 4.969 AGAINST A FLOOR OF 5 — RED, AND IT IS THE SAME STRADDLE
  OSCILLATING.** Session 53 read 4.880 RED, session 54 read 5.215 GREEN and said in as many words
  *"do not read that as a repair — the estimator's spread is what session 53 said it was"*, which
  was 0.42. This session's three runs are [4.969 5.005 4.74], spread 0.265, and the assertion is
  made **on one run and not pooled** (`budget.json` → `$screenshotEntropy_s17`). A floor that lifts
  a histogram's bottom into fewer bins would lower entropy, so this session has a MECHANISM as well
  as a straddle — **and no paired run, so it is not attributable and is not claimed.**
- **`player` AND `downtown_dense` WORST FROXEL 59 of 96, margin 37 < 40.** Session 54 read 61 and a
  margin of 35 on `player` and named it a cost it had spent. It is **two slots better** and still
  red. A count, so §0.2's load caveat does not apply.
- **`highway_speed` SILHOUETTES: 66% of 64 vehicles with a dark ground gap and 53% non-monotone,
  both against 75%.** Session 54 read 69% and 55%; session 49 measured the population moving 55–74
  across four runs of one session. **SEVEN SESSIONS UNACTED.** The ground-gap number is the one a
  black floor could plausibly move — it lifts the ground a vehicle is seen against — and 69 → 66 is
  inside the six-session spread, so it is written down and not attributed.

---
## 8. WHAT TO DO FIRST NEXT TIME

1. **THE NIGHT'S LIGHT HAS NO DIRECTION IN IT, AND THAT IS WHY THE CHURCHYARD STILL HAS NO FORM.**
   §0.2 measured it: **96.7% of the 3.24 lx on a night surface is the sky dome** — 2.986 lx of urban
   skyglow (`sky.js` → `pollutionNits` 3.2) and 0.147 of airglow, both ISOTROPIC — against **0.107 lx
   for the sky's own scattering and the moon together**. An isotropic source returns the same
   radiance off every face of every object, so there is nothing for a shape to be made of. The floor
   moved the churchyard out of the range the encoding throws away (median 7 → 13 code values, 35.4%
   of the frame under 4/255 → 0.0%) and **it added no contrast, because a floor cannot.**

   **THE LEVER IS THE MOON, AND LOOK.md §0 ALREADY LICENSES IT** — *"moonlight far above the real
   figure"* is the first of the three lies it names. `solar.js` → `moonIlluminance` delivers
   0.2055 lx at the top of the atmosphere and **0.099 lx horizontal at the moon's 40°**, i.e. 3.1%
   of the ambient. What a directional key costs is the thing to measure first: a face at cosθ = 1
   against one at 0 differs by `E·ρ/π`, the delivered mapping is about **10.5 code values per
   cd/m²** at this exposure, and three code values of face separation therefore wants about
   **4.5 lx** — which is 45× the moon and a quarter of `LUMINAIRE.streetAverageLux`. The catch is
   §0.2's other finding: it is METERED, so 0.64 of every stop comes back, and the arithmetic above
   is what a paired run has to check rather than assume. **A REDISTRIBUTION IS THE ARM WORTH TRYING
   FIRST** — move light out of `pollutionNits` into the moon at constant total lux, which costs the
   frame mean nothing and buys the whole of the direction.

   **AND `0.267` IS IN TWO FILES.** `LIGHT.fullMoonLux` = 0.267 in `constants.js` and a bare `0.267`
   inside `solar.js` → `moonIlluminance`. One quantity, two copies, nothing comparing them —
   CONTRACT §9.1, and it is the constant the item above would move.

2. **ITEM 2a — PEDESTRIANS CANNOT LEAVE THE GROUND PLANE.** Untouched this session. STATE 54 §8
   item 1 established everything needed before deciding: `city.walkableAt(x, z, pad)` **has no `y`
   in it at all**, `streetlife.js` is allocated per chunk by `footfallWeight` and every agent's `y`
   comes off the ground, so the change is a **DECK** record — a walkable surface with a height, a
   footprint and a way on — through streetlife's allocator, its destination table and its instance
   write, plus one new record in `city.js`. The station's platform at 22.72 m is the first one, the
   stair cores are the ways on, and the train has stopped there since session 54. **It is the
   operator's oldest unbuilt wish and it is a session of its own.**

3. **ITEM 5(c) — EVERY BLOCK IN THE WORLD IS THE SAME SIZE, MEASURED.** STATE 54 §4.4: 128 blocks,
   2 distinct lengths, and one of the two is a single outlier, because
   `island = CITY.chunkSize − 2 × CORRIDOR` and both terms are constants. The cheap repair is NOT
   the lattice — it is splitting an island into two parcels with a service lane, so the grid reads
   as two block sizes without moving one road. Unchanged, and still the largest single thing the
   operator has named.

4. **THE LAST TWO CODE VALUES OF THE FLOOR, AND THE BAND THAT HOLDS THEM.** `POST.blackFloor`'s
   derivation asks for 10 at true black and the gates allow 9; the crossing is at about f = 0.0032
   and it is `meanLuminanceBands.midnight`'s ceiling of **0.112** that stops it. That ceiling was
   *"recentred on the session 2 measurements at the session 1 widths"* and has never been
   re-derived — session 2's city had no streamed city, no station, no traffic, no crowd, no signs
   and no distant city. **It is GREEN, so this session did not touch it**, and `bandRules
   .minBandGap` caps it at 0.12 whatever happens. LOOK.md §7 carries the sweep and the arithmetic.
   **It is a question for the operator rather than a decision for a session.**

5. **CLOUDY.** §5 costs it: a cloud term in the sky LUT, a matching CPU-side `skyIlluminance`, the
   sun's `intensity` and `castShadow`, the PMREM environment and `ATM.hazeDensity` — against four
   luminance bands all derived in clear air. The row is built with three presets and a way back to
   the cycle; the fourth button is the session.

6. **THE 8 km MAIN STREET IS STILL THE ONLY ROAD THAT LEAVES THE GRID** (STATE 54 §8 item 4), **THE
   ATMOSPHERE AT 1500 m IS STILL BROWN SOUP** (item 5 — and §0.2 now says that soup is 92% of the
   night's light, so the two are one item), **THE TURNING HEAD** and **THE 47 m OF LANE ON
   PAVEMENT** (STATE 52 §7), and **`SURFACE_TOP_M`'s DERIVATION IS STILL FALSE BY 3.2×** (STATE 53
   §5.2). All untouched.

7. **THE VEHICLE SILHOUETTE BARS, SEVEN SESSIONS UNACTED** — 66% and 53% of 64 against a 75% floor.
   `budget.json` → `silhouettes.$estimator` already derives why a single reading is not a verdict.

8. **CLUMPING IS UNMOVED AT 0.389 AGAINST 0.60 FOR EIGHTEEN SESSIONS**, and STATE 53 §7 item 9's
   experiment — *"a window at 2300 m would move it"* — is STILL NOT RUN.

9. **THE APRON STAIRCASE'S RESIDUE**: still 0.40 ha of bare walkable ground, 1004 of 284 382
   samples, identical to sessions 52, 53 and 54 to the sample.

10. **HOIST THE BUILDING CLAIMS IN `buildChunkBody`** — session 47's item 1, still what blocks
    facade clutter. **THE ARENA** (STATE 49 §4). Both still unspent.

11. **`decodePNG` RETURNS THREE BYTES PER PIXEL.** STATE 52 §2.2, and it cost that session a whole
    plausible and entirely wrong table. `radianceprobe` prints the channel count in its own header
    for that reason.

12. **AND THE ONE RULE THIS SESSION WOULD ADD TO THAT LIST.** Three of its five items were found by
    an arm that did nothing: the flat black floor that turned `warmth:dusk` red, the porosity that
    left the churchyard a mirror because a kerb pushed to three parallel arrays instead of four, and
    the approach guard that took three sites to land. **In every case the thing that found it was a
    POSITIVE CONTROL — make every ground kind porous, and see whether the picture changes at all.**
    §7.3 already asks for one per metric; this session is the argument for reaching for one first
    when a change delivers nothing rather than last.
