# NOCTIS — STATE

*End of session 70. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`, 15 d 1 h of
uptime — the same boot as sessions 47–69. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` RAN 1.86–3.79 THROUGH THIS SESSION***, over CONTRACT §0.2's bar of 1.6 for the tenth
session running, though the battery started at **1.88** — the closest this project has come to the
bar since session 32. **No millisecond below is a verdict.**

Branch `claude/noctis-70-jitter-phase-and-seam`, off session 69's head.

**WHAT SHIPPED IS EIGHT LINES AND TWO GETTERS IN `src/`** — `git diff 995a7b7 -- src/` is 77
insertions and no deletions across two files, of which **14 are code and 63 are the comment that
says why**. Everything else this session produced is instruments and measurement. `draws`,
`triangles` and the occupancy registry are untouched — §7.

---
## 0. THE SWEEP, WHICH IS WHY THIS FILE OPENS WITH IT

**Whether two frames in this project can be compared at all is the question that governs every other
measurement in it.** Session 69 established that they could not: `post.js` draws frame *n* at
`JITTER[n % 8]`, *n* is the absolute count of frames the page has rendered, and `harness.waitForCity`
sets it by polling a **worker** in blocks of ten frames — a wall-clock race. Two captures of ONE
unmodified source at two of the eight phases differ by **57 801 to 78 979 bytes** of 3 499 200.

`tools/stepprobe.mjs --pin=N` across 4000–4009, one unmodified source, `viaduct-under`:

```
   pin      4000   4001   4002   4003   4004   4005   4006   4007   4008   4009

   SESSION 69, before anything was changed
   md5      5664   b35f   e731   007b   d93b   89fb   0537   8453   5664   b35f
                                                                    ^4000  ^4001    period 8

   §4c AS COSTED — pad to a fixed jitter phase before the last step
   capture  4049   4049   4049   4049   4057   4057   4057   4057   4057   4057
   md5      4d0a   f229   3d77   007b   e512   6605   57aa   7610   4d0a   f229
                                                                    ^4000  ^4001    STILL period 8

   SHIPPED — pad to the phase, then drop the TAA history there
   capture  4049   4049   4049   4049   4057   4057   4057   4057   4057   4057
   md5      e37d2383e9564dfa066062383942b0b3  — ALL TEN, 871 770 bytes each
```

And the three runs that matter more than the pins, because they are the thing the pin was standing
in for — **no pin at all, three genuinely different races:**

```
   free a   city arrived 2718   captured at frame 2769   e37d2383e9564dfa066062383942b0b3
   free b   city arrived 2718   captured at frame 2769   e37d2383e9564dfa066062383942b0b3
   free c   city arrived 2698   captured at frame 2745   e37d2383e9564dfa066062383942b0b3
```

**THIRTEEN RUNS, FOUR DISTINCT CAPTURE FRAME COUNTS, THREE DISTINCT ARRIVALS, ONE IMAGE.**
`adaptedLogL` **7.582031250** in all thirteen. **The floor with the jitter ON is 0 of 3 499 200
bytes**, and it is not three draws of one phase — the ten pins are the control session 68's own zero
never had.

---
## 1. THE REPAIR, AND WHY IT IS NOT THE ONE THAT WAS COSTED

STATE 69 §4c proposed *"one accessor and about four lines"*: before `settle()`'s last `step`, advance
to a fixed residue of `frameIndex` modulo `TAA.jitterSamples`. **That was built first, swept first,
and it is not enough.** The middle block of §0's table is its result: eight distinct images and a
period of still exactly **8**, differing by **13 774 to 33 813 bytes** — four times better than
57 801–78 979 and not a repair. Pin 4008 reproducing pin 4000's md5 bit for bit is the control that
names the surviving variable: **the equivalence class became `pin mod 8`, which is the PAD, and the
pad is 0 to 7 extra frames of TAA accumulation.** 0.92^46 = 2.19 % of the first frame survives
against 0.92^53 = 1.20 %, and that gap is `|Δ| = 1` over half a percent of the frame. Fixing the
phase moved the race from WHICH of eight offsets to HOW MANY frames had been averaged.

**BOTH CANNOT BE FIXED BY PADDING, AND THE ARITHMETIC SAYS WHY.** Holding the captured frame's phase
fixed REQUIRES the frame count since the TAA history was dropped to be congruent to −(that frame's
index) mod 8 — and that index is the race. One knob, two constraints. So the history is dropped
**at** the normalised phase, and everything after it is a constant `8 + TAA.settleFrames + frames`
frames from a defined start:

```js
  const post = ctx.get('post');
  if (post && typeof post.frameIndex === 'number') {
    const period = post.jitterPeriod || TAA.jitterSamples;
    const after = 8 + TAA.settleFrames + frames;      // the frames rendered below
    const pad = (((-(post.frameIndex + after - 1)) % period) + period) % period;
    if (pad > 0) await step(pad);
    if (post.resetHistory) post.resetHistory();
  }
```

Eight lines in `harness.settle()` — STATE 69 §4c costed *"about four"* — and `post.frameIndex` /
`post.jitterPeriod` as **getters with no setters** — a counter a caller may write is CONTRACT §9.1, and the written copy would be the one the
jitter table is actually indexed by.

**WHAT IT COSTS, STATED RATHER THAN DISCOVERED LATER.** Every caller reaches `settle()` either
straight after `setTimeOfDay`, which drops the history itself two frames earlier (`post.js`'s
`timeOfDay` handler), or straight after `sampleRouteAt`'s own `resetHistory` — so for every capture
in the project this replaces a reset that had just happened with one three frames later. The
exception is `sampleRouteAt`, which had 30 further frames of accumulation on top and now does not:
0.92^74 = 0.2 % of the first frame surviving becomes 0.92^44 = 2.6 %.

**`citycheck`'s saturation reserve is the only reader of `sampleRouteAt`, and it is the one number in
the project this change could have moved that NO SESSION HAS EVER WRITTEN DOWN.** It is GREEN today —
saturation **1.96 % mean / 4.00 % pooled peak**, bright reserve **7.49 %** against a floor of 6.00 —
and every COUNT `citycheck` reports is identical to sessions 57–69 (§8). But the last bright-reserve
figure recorded anywhere is **6.37 %**, in LOOK.md §7, from session 37. **So this session cannot say
whether the saturation moved, only that it did not go red**, and the three numbers above are written
here so the next one can. That is the shape of defect this project keeps finding, caught before it
was quoted rather than after.

**AND THE 32-FRAME PROMISE BECAME TRUE.** `TAA.settleFrames`' comment says *"32 frames leaves
0.92^32 = 7 % of the initial frame"*. Until now "the initial frame" was whatever happened to be in
the history buffer. It is now a frame this function defines.

### 1a. WHICH EARLIER COMPARISONS ARE VOID — THE HALF THAT PAYS FOR THE ITEM

**A frame-to-frame byte comparison taken before this repair is evidence only if both frames were
captured at the same frame count.** Nothing before session 69's `--pin` ever was, so:

| claim | where | verdict |
|---|---|---|
| *"73 373 bytes of 3 499 200"* between session 68's ungated and gated `surfaceAt` arms | STATE 68 §8 item 1 | **VOID.** `d93b…` is phase 2, `5664…` is phase 6; 73 373 is the p6↔p2 cell of a table produced from one source. Already killed in session 69. |
| *"three runs, zero noise floor"* — `s68final`, `s68noiseA`, `s68noiseB` | STATE 68 §1c | **VOID.** Three draws of phase 6. A floor that only ever sampled itself reads as zero. |
| *"session 67 → session 68 with `surfaceAt` UNGATED, 0 bytes"* | STATE 68 §1c | **VOID.** `after67` against `isosurf`, an hour and fifty minutes apart, both phase 2. |
| *"the viaduct soffit pair is byte-identical at 0 of 3 499 200"* — session 68's sea-tint control | LOOK.md §0.1 | **NOT VOID, AND NOT A CONTROL EITHER.** The two frames really were identical — a zero is only reachable at equal content. What fails is the inference: session 69 rendered five `river.surfaceAt` arms, one of them moving twenty-two chunk meshes, and got a byte-identical `viaduct-under` from every one. **A frame that returns 0 whatever you do to the world is not evidence that you did nothing to it.** Corrected in place in LOOK.md §0.1; the conclusion stands on the band rows and on this session's mask. |
| *"three `gateaudit` runs either side of the repair, identical to every printed digit against a noise floor that is ZERO"* | LOOK.md §6, session 67 | **UNCERTAIN, and it is B3's shape again.** `gateaudit` does not capture its own frames — it re-reads the PNGs `lookcheck` already wrote to `tools/look-out/`. Three runs over ONE PNG set are identical by construction, so that zero measures the file system. Whether a re-capturing `npm run gates` ran between them is not recorded. **The claim it supports may well be true; the floor under it is not a floor.** |
| *"`lookat` frames are byte-deterministic — three runs, 0 of 3 499 200"* | the operator's memory note, session 68 | **VOID**, and corrected there. |
| the look-frame drift session 69 measured between its own and session 68's frames — 416 580 to 978 114 bytes | STATE 69 §8 item 2 | **REAL, and now explained and repaired.** §2. |
| *"1 908 chunks lying wholly inside r ≤ 3 232 m hash `6f192b75fb42ae2a5545ca17`"* | STATE 65, STATE 67 | **SURVIVES.** A digest of the GENERATOR's city, not a pixel comparison. Still unreproducible for a different reason: the instrument was never committed. |
| the occupancy registry, 18 799 / 19 087 | STATE 66 onward | **SURVIVES.** Counts. |
| `citycheck` byte-identical to sessions 57–70 | every STATE since 57 | **SURVIVES**, with STATE 69 §4b's caveat about what it actually guarantees. |
| every `lookcheck` band, `distinct:midnight|dusk` included | LOOK.md §7 | **SURVIVES.** Means and cluster statistics over 5.76 M pixels; measured stable to 1e-5 across a phase change. |
| the 344 InstancedMesh matrix hashes, `pedestrianStats`, the per-chunk census | STATE 69 §3 | **SURVIVES.** Not pixels. |

**NO GATE ASSERTS ON A FRAME-TO-FRAME BYTE COMPARISON.** Every look threshold is computed WITHIN one
frame; `distinct:midnight|dusk` is a mean-squared difference between two frames but is a statistic
over 5.76 M pixels, not a byte count, and it is stable to 1e-5 across the change. **So no gate
threshold was ever contaminated by this, and none moves now.**

---
## 2. THE LOOK GATE — THE SAME MECHANISM FOR EIGHT FRAMES AND A DIFFERENT ONE FOR FOUR

STATE 69 §8 item 2 recorded that `tools/look-out` differs between two sessions at identical source
by 416 580 to 978 114 bytes of 17 280 000, and asked whether that is the same mechanism. **It is,
for two thirds of the frames, and item 1 fixed them.** `lookcheck` captures through
`setWetness` → `setTimeOfDay` → `settle(4)` → screenshot, which is exactly the path §1 repaired.
Two `lookcheck` runs on this session's head:

```
   midnight  dawn  noon  dusk  and all four -wet          BYTE-IDENTICAL, 8 of 8

   trade-dawn       3 146 609 bytes differing of 17 280 000   mean |Δ| 11.9   max 232
   trade-noon       5 794 202                                 mean |Δ|  9.8   max 232
   trade-midnight   6 258 010                                 mean |Δ|  6.1   max 245
   trade-dusk       8 130 200                                 mean |Δ|  2.6   max 254
```

**THE SECOND MECHANISM IS NAMED AND NOT REPAIRED, WHICH IS WHAT THE BRIEF ASKED FOR.** It is not the
jitter — the signature is wrong for it (`|Δ|` up to 254, best scalar gain 0.991, 47 % to 129 %
of the difference surviving a gain). **It is THE VEHICLES.** Looked at: in `trade-noon` the
buildings, road, pavement, kerb, pedestrians, street furniture and sky are identical to the byte and
the cars are at different positions along the street; at `trade-midnight` the same, with their
headlight pools moving over the tarmac, which is why that frame's difference spreads furthest.
`lookcheck`'s own log carries the variable — *"second eye: city re-streamed over 234 frames"* against
*"244 frames"* — and `setShot('trade')` moves the residency ring three chunks, which is what
`traffic.js` reseeds against. **That is STATE 69 §8 item 3's traffic race seen from the front**, and
it has a third sighting: `sea-edge` differs run to run by **543 bytes over 316 pixels, every one of
them in the sky**, which is the aircraft.

So the rule for a reader with no memory of this: **a frame with no vehicles and no aircraft in it is
now exactly reproducible. A frame with them is reproducible everywhere except on them.**

**AND STATE 69 §8 ITEM 3 IS CORRECTED BY THIS.** It said of the traffic race *"It is invisible in
every frame taken so far — the PNG was identical across all of them — so it is a determinism question
and not a look one."* That was true of `viaduct-under`, which has no vehicles in it. It is **false**:
the race is 3.1 to 8.1 MB of a look frame, and it is now the largest thing standing between this
project and frame-level A/B.

**AND THE REPAIR MOVED EVERY DELIVERED LOOK FRAME, ONCE.** Session 69's frames against this
session's, at a `src/` that differs only by §1:

```
   midnight 1.79 %   dusk 3.57 %   midnight-wet 3.20 %   dawn 4.77 %
   noon 5.00 %       dusk-wet 5.08 %   noon-wet 7.54 %   dawn-wet 7.76 %      mean |Δ| 1.7–2.7
```

STATE 69 predicted 2.4 % to 5.7 %; the measured range is a little wider. **The metrics did not
move**: `distinct:midnight|dusk` read **0.02846** against 0.02845 in sessions 68 and 69, which is the
1e-5 that instrument resolves, and `lookcheck` returned the identical three violations.

**AND THERE IS A STRUCTURAL REASON THE BANDS WERE NEVER AT RISK, which is not written down anywhere
else.** `distinct:X|Y` is a mean squared difference of half-resolution luma between two look frames
of ONE run (`lookassert.mjs:304`), and `lookcheck` calls `waitForCity` once per eye and then runs the
same fixed-length `capture()` for every time of day — 46 frames, and 46 ≡ 6 (mod 8). **So the
ABSOLUTE phase of a run was the race and the RELATIVE phase between two captures inside it was a
constant**: `midnight|dusk` always compared two frames exactly two phases apart. The four
`distinctness` pairs and the four `wetness` pairs were never comparing two randomly-phased frames.
That is on top of the MSD's own robustness, and it is why a repair that changed the offset from a
fixed 2 to a fixed 0 moved the number by **0.00001**.

---
## 3. THE SEAM — MEASURED IN FULL, AND NOTHING SHIPPED

`tools/seamprobe.mjs` computes the shader's own arithmetic from the shader's own constants: `dpx`
and `dpy` off the water plane by ray intersection, `span` as the max over the three wave components
of `|d_i·dpx| + |d_i·dpy|`, and `gNoctisSeaOpen` as `smoothstep(cutoffLo·λmax, cutoffHi·λmax, span)`
— `smoothstep(1.920, 4.800, span)` in metres per pixel. It renders nothing and asserts nothing.

### 3a. HOW WIDE THE TRANSITION IS

```
   pose            width px      width m    half-way row spread    dir factor
   river-along      14 (13-15)     46            5.0 px             1.19x
   sea-road         19 (19-23)     66            9.8 px             1.31x
   sea-harbour      30 (27-33)     92           15.2 px             1.07x
   sea-edge         34 (34-41)    118           16.5 px             1.37x
   sea-air          74 (67-93)    241           67.0 px             1.74x
```

Rows 0.05 → 0.95 of the share, at 1440×810 — which is also the internal shading resolution, because
`RENDER.neverExceedNative` clamps `internalSize` to the drawing buffer, so one predicted pixel is one
shaded pixel.

**CONFIRMED ON THE DELIVERED FRAME AND NOT ONLY PREDICTED.** A pure-red `SEA_OPEN_TINT` arm in a
scratchpad worktree gives an exact mask of where the term acts — the blue channel of the armed frame
is the base's times (1 − share). At the one column of `sea-edge` with open water below the seam, the
observed ramp runs rows 490 → 528 against a predicted 0.50 crossing at **495.1**. Columns 1162 and
1384 carry no tinted pixel at all, which is the mask saying what the eye could not: **the brown on
the right of that frame is LAND, not untinted sea.**

### 3b. THE ARM THE BRIEF EXPECTED IS REFUTED, WITH THE SWEEP

*"The arm is almost certainly a softer function of the same quantity."* It is — and not the softening
anyone would reach for. **Widening the smoothstep upward does not soften the seam on screen; it peaks
and then narrows**, because `span` diverges at the horizon and a wider window crams the ramp into the
rows where it changes fastest:

```
   hi (m/px)    4.8    9.6   12.0   24.5     48    100
   sea-edge    34.1   44.9   46.0   43.5   36.6   27.9   px
   sea-air     74.3   95.3   97.1   90.7   75.5   57.0   px
   sea-road    19.3   25.2   25.8   24.5   20.6   15.7   px
```

The best that edge can do is **1.34×**, at `hi ≈ 12`. **The only edge that widens the transition is
the LOWER one** — `lo` 1.92 → 1.20 → 0.80 gives sea-edge 34 → 54 → 71 px, monotonically. And that is
where the session stops, because of §3c.

### 3c. THE RIVER IS NOT BYTE-IDENTICAL, AND HAS NOT BEEN SINCE SESSION 68

Item 3d asked for the river guarantee to be re-run. **It fails, on the shipped code, and the failure
is older than this session.** LOOK.md §0.1's *"767-810 the river — BYTE-IDENTICAL"* was measured on a
frame that sees the river ACROSS, from 40 m up at the city's edge, where its footprint is 0.23 to
0.36 m/px against a gate at 1.92. Seen ALONG the water from the promenade at the routes' own 1.74 m
eye:

```
   span reaches 1.92 m/px at    111-135 m        saturates at    157-189 m
   the seam is                  13-15 px         and             43-54 m       — the sharpest measured
   term-off arm vs shipped      71 650 bytes     37 347 px       mean |Δ| 19.4
   the affected band's hue      356 deg  ->  255 deg
```

`node tools/lookat.mjs --pos=-2000,1.74,-475 --target=3000,-4,-412 --fov=55 --name=river-along` is
the frame and the same arguments to `seamprobe` are the arithmetic. **`span` cannot tell far water
from near water seen at a grazing angle, because at 1.74 m of eye height a river 130 m away IS
grazing water.** The gate is a good proxy for "open sea" from 40 m up and a bad one from a pavement —
CONTRACT §9's 77th row.

**THAT IS WHY NO BLEND CHANGE SHIPPED.** Softening the seam means lowering the low edge; lowering the
low edge moves the river's own onset from 130 m to about 65 m. **That trade is not one to make in the
session that discovered the river bleed**, and the operator's blue is not in question either way —
LOOK.md §0.1 §0's licence stands and this session did not touch it.

### 3d. THE ASYMMETRY IS `span` ALONE, FOR A REASON NOBODY HAD STATED

Premise (iv) is **TRUE**, and the mechanism is worth more than the verdict. **`span` is
DIRECTIONAL.** It is not the pixel's footprint; it is the pixel's reach ALONG A WAVE'S OWN DIRECTION
OF TRAVEL, maxed over three components whose bearings are 292°, 326° and 265° — a 61° spread.
`lights.js` says so in as many words and gives the reason (a plane wave is constant perpendicular to
its direction, so only the reach along it averages the wave away). **So the same water at the same
distance and the same grazing angle reads a `span` differing by up to 1.79× with the view azimuth**,
against a smoothstep window that is only 2.50× wide. Measured within single frames: **1.07× to
1.74×**, which tilts the half-way row by 5 to 67 pixels across a frame.

### 3e. AND `sea-road` DOES NOT SHOW THE SEA

*"Judge it from the quay at car height."* The pose that name belongs to delivers a green field, the
container terminal and its gantry, and **no water at all**. It is `viaduct-under`'s defect in a
second preset. `sea-edge`, `sea-harbour` and `sea-air` all show the sea and were used instead.

### 3f. Y, RE-RUN — AND ONE CORRECTION TO LOOK.md §0.1

Against a term-off arm at `sea-edge`: **`Y` is unchanged in the band the term acts on**, 0.34166 →
0.34170. **But every band it does NOT act on rose by 0.25 to 0.38 of 255** — the whole-frame meter
re-metering. LOOK.md §0.1 says *"`exposure.js`, which meters the whole frame, cannot see it."* It
can, at about a third of a code value. Small, one-signed, and not zero.

---
## 4. THE TWO DEAD THINGS

**`funnelprobe --identity` — REPAIRED, and it is not a gate.** It asserted against a constant pinned
in session 38 to prove that session's frontage tally was inert. The generator has moved a great deal
in the thirty-two sessions since, so the mode exited 1 and printed *"the tally has moved a stream"*,
which is **false** — the tally is still inert and the city is a different city. It now prints the
digest and exits 0; `--expect=<sha>` asserts and `--expect=session38` keeps the historical baseline
reachable. Both directions exercised (CONTRACT §7.1): matching **0**, stale **1**, malformed **2**.
`funnelprobe` is not one of the eight gates, so nothing red was made green.

**`viaduct-under` — RETIRED AS AN INSTRUMENT, AND ITS REPLACEMENT IS `viaduct-side`.** STATE 69 §8
item 4 measured it 60.3 % one building wall. **Looked at: it is not 60 % wall with a viaduct behind
it. There is no viaduct in the frame at all** — no deck, no pier, no soffit, just a red facade a few
metres from the lens and a slice of street. `viaduct-side` is already a committed pose with its own
derivation off `viaductArc` and it delivers the deck's underside, the girder edge and the piers on
both sides. **`stepprobe` keeps `viaduct-under` as its DEFAULT** — every byte comparison recorded
since session 68 is against that frame, and changing the default would make sessions 69's and 70's
own artefacts incomparable — and gains `--preset=`.

---
## 5. THE INSTRUMENTS, AND ONE §9.1 FIX THAT WAS OVERDUE

* **`tools/lib/poses.mjs`** — `lookat.mjs`'s seventeen presets, moved UNCHANGED. `stepprobe` had
  re-derived `viaduct-under` beside them in session 69 and `seamprobe` would have been the third.
  **Proved identical by loading both and comparing the JSON**, and proved byte-neutral by re-running
  the pinned `stepprobe`: md5 `e37d2383…`, the same frame as all thirteen earlier runs.
* **`tools/seamprobe.mjs`** — §3. Predicts the seam analytically, reads the frame's own edge with
  `--png`, re-runs LOOK.md §0.1's row-band table with `--bands=A.png,B.png`, and sweeps a candidate
  softening with `--lo`/`--hi` **without touching `src/`**. Asserts nothing.
* `hueSat` exported from `tools/lib/lookmetrics.mjs` so `seamprobe` uses `lookcheck`'s hue rather
  than a second one.

---
## 6. THE PREMISES

| | premise | verdict |
|---|---|---|
| (i) | §4c's four lines fix the phase without changing what `settle()` guarantees about accumulation | **HALF FALSE.** They fix the phase and leave 13 774–33 813 bytes, because fixing the phase necessarily varies the accumulation length. What shipped changes that guarantee deliberately — from "≥32 frames on top of whatever was there" to "exactly 44 from a defined start" — and says so. §1 |
| (ii) | the look gate's irreproducibility is the same mechanism as the capture harness's | **TRUE for 8 frames of 12 and FALSE for 4.** The first eye is fixed; the second eye is the traffic. §2 |
| (iii) | the seam is a sharp function of `span` rather than a second term | **TRUE as a description, REFUTED as a remedy.** The function is a 2.50× smoothstep and is gentle; the sharpness is geometric, and widening it upward makes the on-screen band NARROWER past `hi ≈ 12`. §3b |
| (iv) | the estuary asymmetry is explained by `span` alone | **TRUE, and the reason is new: `span` is directional.** Up to 1.79× with the view azimuth against a 2.50× window. §3d |

---
## 7. THE COST

```
  highway_speed   401 draws of 440              IDENTICAL TO SESSIONS 67, 68 AND 69
                  2 451 648 tris of 2 630 000   IDENTICAL TO SESSIONS 67, 68 AND 69
```

**The occupancy registry is untouched: 18 799 generator claims, 19 087 delivered.** `src/` differs
from session 69's head by two getters in `post.js` and five lines plus a comment in `harness.js`;
`git diff 995a7b7 -- src/` is those and nothing else. No shader term changed, so nothing could have
moved either count — and both are read off the gate rather than asserted.

---
## 8. GATE STATE

**ALL EIGHT RAN. `perfcheck` COMPLETED THE WHOLE BATTERY FOR THE FIFTH SESSION RUNNING.**

```
  gate            exit   verdict   seconds  load1 in     out
  parsecheck         0     GREEN       3.7      1.88    1.89
  faultcheck         0     GREEN      28.5      1.89    2.08
  lookcheck          1       RED      50.7      2.08    3.79    THE IDENTICAL THREE
  windcheck          0     GREEN      40.3      3.79    3.52
  inputcheck         0     GREEN      17.4      3.52    3.63
  gateaudit          1       RED      79.2      3.63    2.93    the carried `control failed`
  citycheck          1       RED     127.3      2.93    3.31    IDENTICAL TO SESSIONS 57-69
  perfcheck          1       RED    1101.3      3.31    2.46

  4 of 8 RED — the same four as sessions 53-69. NO FIFTH RED.
```

The battery ran on the `src/` that ships and that `src/` did not change afterwards; the document
edits below it landed after, and `parsecheck` is the only gate that reads any of them. It was re-run
green after each — and it caught one of them, refusing a CONTRACT §9 table with 77 rows under a
sentence saying 76.

`lookcheck`'s three are `distinct:midnight|dusk` at **0.02846** against a floor of 0.03,
`facadeAlbedo` (3 clusters of 5 walls, need 4) and `facadeNeighbours` (2 of 3 adjacent pairs).

**EVERY `perfcheck` VIOLATION IS CARRIED OR IS A TIMING ABSOLUTE FROM A LOADED MACHINE**, at `load1`
**3.31** against CONTRACT §0.2's bar of 1.6, and the battery's own footer says six browser gates
started above it. Nothing in `src/` changed that could reach a millisecond. The non-timing ones:

```
  downtown_dense  frame entropy  4.975   per run 4.946 / 4.976 / 4.975   floor 5
  night_rain      frame entropy  4.972   per run 4.947 / 4.972 / 5.095   floor 5
  highway_speed   dark gap at the ground   75% of 71 vehicles   floor 75%
  highway_speed   non-monotone tone        52% of 71 vehicles   floor 75%
```

Session 69 read entropy 4.923 and 4.952 and the two silhouette bars at 70 % and 69 %. **The bars
moved to 75 % and 52 % and nothing in `src/` moved**, which is the sampling population the
`silhouettes.$estimator` note already describes — whichever vehicles are in frame at the pose.

---
## 9. WHAT TO DO FIRST NEXT TIME

**1. THE RIVER TAKES THE OPEN-SEA BLUE FROM A PAVEMENT AT 130 m — §3c.** This is the largest live
defect this session found and it is the thing that must be solved before the seam is softened,
because the only softening that works makes it worse. It is not a bug in session 68's mechanism:
`span` is the right quantity for the roughness and a proxy for "open sea", and the proxy parts from
the thing on a pavement. `tools/seamprobe.mjs` and the `river-along` pose are the instruments and
both are committed.

**2. THE TRAFFIC IS THE LAST RACE IN THE CAPTURE PATH — §2.** Three sightings now: the four
`trade-*` look frames (3.1–8.1 MB), `sea-edge`'s sky (543 bytes), and STATE 69 §8 item 3's
`traffic:bodies/lights/wheels` hash (2 of 35 runs). `traffic.js` reseeds against the resident ring,
which arrives on the worker's schedule. **A frame with vehicles in it is still not comparable to
another frame with vehicles in it**, and that is now the only thing standing between this project and
frame-level A/B on any pose.

**3. `perfcheck` CAPTURES WITH NO `settle()` AT ALL, AND ITS ENTROPY FLOOR IS A CONTRACT §0.1 CASE.**
Its route screenshot is taken after `runRoute(..., {frames: 1800})` and its pose shots after
`poseRoute(..., 24)`; neither calls `settle()`, so **neither is phase-normalised even now** — they
are the only capture paths left in the repo that are not. `screenshotEntropy` and `meanLuminance` are
asserted on those frames. And this session's own battery hands over the case:

```
  night_rain      entropy per run   4.947   4.972   5.095      floor 5      spread 0.148
                  the gate reports  4.972                                   breach 0.028
  downtown_dense  entropy per run   4.946   4.976   4.975      floor 5      spread 0.030
  across sessions 67, 68, 69, 70:   4.910   4.887   4.923   4.975
```

**One of night_rain's three runs CLEARS the floor, the spread is five times the breach, and the
statistic is asserted on a single draw rather than pooled** — `budget.json`'s
`$screenshotEntropy_s17` says so in as many words. That is §0.1's incident with an entropy instead of
a millisecond, and §0.1's own rule is that it *"applies to every measurement in this project and not
only to this gate"*. Whether the phase is part of that spread is now a cheap question, because
`settle()` can normalise it and `stepprobe --pin` can pin it. **Nobody has asked either.**

**4. `sea-road` SHOWS A FIELD AND `viaduct-under` SHOWS A WALL.** Two of seventeen committed poses
do not show their subject, and both were found by looking rather than by measuring. The others have
not been looked at as a set since they were written.

**5. `citycheck`'s SATURATION RESERVE HAS NO RECORDED HISTORY SINCE SESSION 37.** It is the only
pixel statistic in the eight gates that this session's `settle()` change could have moved, and there
was nothing to compare it against — §1. Today: 1.96 % / 4.00 % / 7.49 %. Two runs on one head would
say what its own spread is, which is the thing CONTRACT §0.1 exists to make somebody do.

**6. THE UNCOMMITTED INSTRUMENT.** Session 65 and 67's 1 908-chunk city hash is still lost.
`framebytes`, `stepprobe`, `seamprobe` and `poses` are committed and each was validated against a
prior session's own artefacts before it was used on anything new.

**7. EVERYTHING ON STATE 69 §8 ITEMS 3 AND 5, AND STATE 68's §9 AND §10, IS UNTOUCHED.**
`viaduct-under` never reaches a fully baked canyon field (25 of 30 slots, every run); the sea's
farthest band and the haze; the fifteen uncounted `river:moving` instances; the straddle carriers'
0.42 m legs.
