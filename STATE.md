# NOCTIS — STATE

*End of session 58. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`, 12 d 13 h of
uptime — the same boot as sessions 47–57. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` READ 2.33 AT THE FIRST COMMAND.*** Every number this session turns on is a COUNT —
buildings, trades, signs, triangles — and CONTRACT §0.1's corollary is that counts do not drift.

Branch `claude/noctis-58-trades-and-light`, three commits, all pushed as they landed.

---
## 0. ONE PAVEMENT AT FOUR TIMES OF DAY

`tools/shot-out/s58-block-{t0,t0_25,t0_5,t0_78}-wet.png` — the same eye-level pose on a trading
street at (−374, 1.7, 390), wet, looking east along the frontage of chunk (−3, 3), which carries
eleven trades of five kinds.

```
  t = 0      MIDNIGHT   a magenta blade over a BAR and a cyan sign over a HAIRDRESSER burn
                        over cold and warm shopfront glass, and every one of them doubles in
                        the wet asphalt. Red neon at two depths down the street.
  t = 0.25   DAWN       the bar is shut and its blade is dark; the cafes are coming up.
  t = 0.5    NOON       THE SAME MAGENTA BLADE IS A DARK PLATE. The bar does not open until
                        six, and for the first time in this project's history a sign says so.
  t = 0.78   DUSK       the street relights, and the trades that are open at dusk are not the
                        ones that were open at dawn.
```

**That is the session in four frames.** Before it, every lit bay in the city drew the same warm
tint at the same strength with a 25% cold share rolled from a hash, and every sign was an
arbitrary colour that came on with the photocell and went off with it.

---
## 1. ITEM 1 — TRADES, AND THE CUTS ARE MEASURED

Session 28 gave every frontage a boolean: `bld.retail` says the ground floor is glazed and lit,
and **nothing anywhere said what it sells.** `citygen.js` → `TRADES` is eight businesses now,
declared on the building record beside `retail` and `retailFrontage`, null where nothing trades
so a reader cannot mistake a dark plinth for a shut shop. Its own rng stream, so giving a shop a
trade cannot move a building, a sign, a prop or a pillar (CONTRACT §6).

**WHERE EACH GOES IS MEASURED, NOT ASSUMED.** Session 48 delivered seven playgrounds out of
seven by splitting a band it had not measured and that lesson has cost four sessions, so the
cuts are the terciles of **the trading population itself** over the gate's own 10 × 10 at seed
1337 — 433 trading buildings of 668, density 0.287 to 0.727, **p33 = 0.5056, p67 = 0.6495**. Not
the terciles of the density field and not of the low-detail band: three different populations,
and only one of them is the one being split.

**WEIGHTS AND NOT CONDITIONS**, so no cut can empty a district — session 49's fallback-chain rule
with a distribution instead of a chain. A corner doubles the bar and kiosk weights, because
`RETAIL.cornerM` already treats a corner as a different site and a corner pub is a real building
type. Delivered over the region:

```
  band     shop  bar  hairdr  takeaway  cafe  laundr  restaurant  kiosk
  quiet      37    4      18        18    16      29           9     13
  middle     33   23      25        20    17       9          11      8
  busy       36   32      10        14    17       5          19     10
```

**The laundrette runs 29 in the quiet tercile against 5 in the busy one and the bar runs 4
against 32**, which is the derivation doing exactly what the operator asked for: a bar where
people are at night, a laundrette where people live.

---
## 2. ITEM 2 — THE LIGHT RECIPE, AND `out` IS THE OPERATOR'S OWN AXIS

His observation is the whole design: *"different trades light in opposite directions."* Each
trade carries the recipe its nature implies, and `out` — the fraction of the bay's glow that
reaches the street — is the axis:

```
  trade        out    interior chroma     sign chroma      hours
  cafe        1.00    tungsten            neonGreen        07–19
  takeaway    0.95    fluorescentDirty    neonRed          11–02
  hairdresser 0.85    fluorescentCold     neonCyan         09–18
  restaurant  0.75    tungsten            neonRed          12–23
  laundrette  0.70    fluorescentDirty    fluorescentDirty 06–23
  kiosk       0.65    fluorescentCold     neonAmber        06–20
  shop        0.60    tungsten            neonAmber        09–18
  bar         0.20    neonMagenta         neonMagenta      17–02
```

A bar at 0.20 is not a dark shop — it is a shop whose light is behind something, which is what
dark glass and a screen at the back of a bar are, and its SIGN carries the street instead.

**THE DIFFERENCE BETWEEN TWO TRADES AT THE SAME LEVEL IS HUE ALONE.** `matchedTint` returns the
tint that delivers each chroma *at the luminance the warm pair already delivered*, so the colour
carries none of the level and `out` carries all of it — CONTRACT §5's own rule, and what stops
this being a brightness change wearing a colour change's clothes.

**THE COLD SHARE IS NO LONGER A CONSTANT.** It used to be `unitHash(...) < COLD_SHOP_SHARE` —
one bay in four, decided by three multiplied coordinates: the right statistic from no fact about
the world. It is now however many of the trades on this street happen to be cold ones.

**AND THE CHROMA IS NAMED IN THE GENERATOR AND MIXED IN THE MODULE**, because `citygen.js` has
never imported `color.js` — the arrangement `DISTANT.nightMix` already uses, in the same words.

---
## 3. ITEM 3 — OPENING HOURS, AND WHY THEY LAND ON THE SIGN

`tradeOpen(trade, t)` returns a **ramp** over `TRADE_RAMP_H` = 0.75 h rather than a boolean, so
a street at closing time has some windows still on and **no capture ever lands on a
discontinuity**. Hours wrap past midnight, which is the whole reason a bar and a cafe are
different objects at 01:00.

**WHY THE SIGN AND NOT THE GLASS — measured, not preferred.** A shopfront's glazing is an
instance colour in a **per-chunk** mesh, baked when the chunk streams in, and **chunks do not
rebuild on the clock**: there is no `timeOfDay` listener in `city.js` at all. Making the glass
follow the hours means either a per-instance attribute plus a shader term (`noctisRough` is a
`vec2` in a slot that holds four floats, so `.z` is free — session 55's own trick) or a rebuild
of the resident ring every simulated hour. **The sign mesh is already merged city-wide and
already rebuilt on every camera chunk crossing**, so re-tinting it on a clock band costs one
rebuild it was built to do anyway. The trigger is the trade hour quantised to `TRADE_TICK_H` =
0.25 h — three steps inside the ramp, so nothing snaps.

What the street gets is the half that reads at night, and the frames in §0 are the proof.

---
## 4. ITEM 4 — THE SIGN IS THE TRADE'S

`s.chroma` was an index rolled from the sign stream and that was the whole story: a laundrette
could carry the same red neon as the bar three doors down. A sign over a trading ground floor
advertises that trade now, so its chroma comes from `TRADES[trade].sign`. **342 of the 966 signs
over the gate's region carry a trade; the other 624 keep the rolled index and are
byte-identical.**

The per-sign trade rides a **parallel array**, which is CONTRACT §9's own shape — so it is
pushed on every path `signTint` is (there is exactly one such site), and the rebuild checks the
two lengths agree before using it. Session 55 paid for a kerb that pushed to three parallel
arrays instead of four.

**WHAT IS NOT DONE FROM ITEM 4**, and it is the larger half: the sizes and mountings are
untouched. `TRADES[*].signScale` is written down and **nothing reads it yet** — a bar's blade
should be 1.45× and a kiosk's 0.60×, and that is a change to `bladeHeightM`'s inputs rather than
to a tint. Nothing was added on gable ends, roofs, the viaduct, the bridges or the waterfront,
and the 53 holograms are untouched for a sixth session.

---
## 5. GATE STATE

`npm run gates`, all eight, 21 minutes, load1 3.79–5.20 throughout — **over CONTRACT §0.2's bar
for every browser gate, so no millisecond below is a verdict.** The counts are.

```
  gate            exit   verdict   seconds  load1 in   out
  parsecheck         0     GREEN       3.4     3.86    3.79    117 files, contract-clean
  faultcheck         0     GREEN       9.8     3.79    4.29
  lookcheck          1       RED      34.4     4.29    4.79    THE IDENTICAL THREE
  windcheck          0     GREEN      35.7     4.79    4.53
  inputcheck         0     GREEN      14.3     4.53    4.50
  gateaudit          1       RED      69.7     4.50    4.56    the carried control
  citycheck          1       RED     116.1     4.56    5.20    IDENTICAL TO SESSION 57
  perfcheck          1       RED    1024.2     5.20    4.95

  4 of 8 RED — the same four as sessions 53–57. NOT ONE NEW RED THIS SESSION.
```

**THE HEADLINE COUNT: `highway_speed` reads 2.30 M triangles and 401 draws, which is session
57's figure to three digits** (336 577 instances against 336 562). **This session cost ZERO
triangles and ZERO draw calls** — trades are a string on a record, the light recipe is a tint
and a multiplier on an instance colour that already existed, the hours are a factor applied
during a rebuild that already happened, and the sign chroma is a different entry in a palette
already in memory. The ~60 000 of headroom session 57 bought is intact, and the ceiling was not
touched (STATE 57 §0.1 still awaits the operator).

**Session 57's own new red is closed:** `120 vehicles, budget says 160` is gone from all four
routes — `contentVehicles` was corrected in that session's last commit and this run confirms it.

**`citycheck` is identical to session 57 in every line**: clumping 0.393, the same two buried
sign quads, the same five delivered overlaps (the carried four plus session 57's
`sign(adpillar) × prop(cyclestand)` chunk seam), 1 004 bare walkable samples. The trades added
no claim and moved none.

### 5.1 AND THE GAP THAT MATTERS: NO PIXEL-READING GATE CAN SEE THIS SESSION'S WORK

`lookcheck` reads `distinct:midnight|dusk` at **0.02840, identical to session 57's 0.02840** —
and that is not the trades being neutral, it is the gate being blind to them. Its `street` shot
stands at **(70, 1.74, 0.9) looking to (−104, 17.5, −1.4)**, and `BLOCK_KEEPOUT` is
**x ∈ [−168, 168], z ∈ [−46, 46]** — so the whole frame is inside the ORIGIN BLOCK, which
`block.js` authors and out of which the streamed generator's buildings are clipped. Every trade,
every trade-coloured sign and every opening hour built this session is in the STREAMED city, and
the four look frames contain none of it.

**So the verdict on this session is the frames in §0 and nothing else** — which is what
CONTRACT §10 step 4 says the numbers are for, and it is also a real hole: a session could now
change every shopfront in the city and no gate that reads a pixel would move by a digit. The
cheapest closure is a second `lookcheck` shot placed OUTSIDE `BLOCK_KEEPOUT` on a trading
street; it would need its own four bands derived from scratch, which is a session's work and is
why it is written here rather than started at the end of one.


---
## 6. WHAT TO DO FIRST NEXT TIME

1. **THE SIZES, WHICH IS THE REST OF ITEM 4.** `signScale` exists on every trade and no reader
   uses it. A bar wants a tall blade and a kiosk a small plate, and session 34's own finding
   applies: *a band whose top touches the target delivers the target never* — so a scale that
   multiplies the existing roll needs its ceiling re-solved from how often the target must
   arrive, not from the largest value it can reach.
2. **THE GLASS AND THE CLOCK** (§3). The cheap path is written down: `noctisRough` is a `vec2`
   in a four-float slot, so `.z` carries an hours class per instance and the window material's
   injection multiplies emissive by a uniform indexed on it. Zero draws, zero triangles, one
   shader term — and it would make the shopfronts themselves keep hours, which is the half this
   session could not afford.
3. **A SHOP LIGHT POOL.** The trades now say which frontages throw light OUT, and nothing in the
   streamed city gives a shopfront a clustered light — the role census reads
   `aircraft:1 traffic:96 stall:12 block:56 lamp:192 sign:16`, i.e. **373 of 384 slots used and
   11 spare.** Eleven is enough for the nearest few cafes, and it is the one thing that would
   put real directional light on the pavement rather than emissive on the glass. It must be
   weighed against `minOccupancyMargin`, which is red and must not be judged on one run.
4. **CARRIED**: STATE 57 §0.1, the triangle ceiling re-derivation at 2 630 000, still awaiting
   the operator; the `sign(adpillar) × prop(cyclestand)` chunk seam, whose fix is to widen the
   pillar's existing 3 × 3 sweep from lamps and bus stops to props; the platform stairs; a
   curved road needing a new ground kind; 128 blocks with 2 distinct lengths; cloudy.
5. **`decodePNG` RETURNS THREE BYTES PER PIXEL.**
