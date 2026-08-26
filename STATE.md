# NOCTIS — STATE

*End of session 45. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`. The machine
has **NOT** rebooted since session 40 — 8 d 2 h of uptime at the last command against session
44's 8 d 0 h, the same boot. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` RANGED 2.48 TO 7.18 ACROSS THE SESSION*** against CONTRACT §0.2's bar of **1.6**, and
the session was almost entirely browser work — seventeen browser boots, three `perfcheck`
invocations and a full gate run. **NO RED MILLISECOND IN THIS FILE IS ADMISSIBLE.** What is
quoted is COUNTS (draw calls, triangles, instances, populations), PIXEL STATISTICS off delivered
PNGs, and arithmetic with no browser in it. One green absolute is quoted as green and marked as
such: drift on this machine is one-sided, so load can only make a frame slower.

**THIS SESSION WALKED THE CITY AND FIXED WHAT IT SAW.** **184 frames over sixteen poses**, four
times of day, wet and dry, at street level and from the air, in BOTH content paths — the origin
block and the streamed city, which session 28 showed is one place a session can build an item into
only one of. **Eight commits of code and three of documents.** The list below is the deliverable.

**AND THREE TIMES IN ONE SESSION THE TWO CONTENT PATHS TURNED OUT TO BE TWO DIFFERENT CITIES** —
the lamp radiance, the lamp population and the kerb, with `block.js` correct in all three; and a
fourth, the road markings, with the streamed city correct. That is the shape of what a walk finds
and no gate does: a gate reads one path or the other and never both at once.

---

## 0. THE LIST — EVERYTHING THAT LOOKED WRONG, REPAIRED OR NOT

Every entry has a `spawn=` link you can paste and a frame in `tools/shot-out/`. The links are
`localhost:5173/?player=1&spawn=…`; `&t=` is time of day, `&wet=` and `&rainfall=` are CONTRACT §6
parameters. Frames were taken with a scratchpad multi-pose tool (one boot, many poses) rather than
`lookat`, which is one boot per pose — §7 has the arrangement.

### REPAIRED — eight commits, each revertible on its own

| # | what looked wrong | what it was | frames |
|---|---|---|---|
| **R1** | **The rain does not fall.** `?rainfall=1` changes the frame time and nothing is visible. | 500 of 500 streaks live and INSIDE the frustum. A median streak arrived at **0.136 cd/m² against a lit road at 1.4 — 0.097× the surface it is seen against**, and the drawn population is **1.1%** of the rain's glinting cross-section. ×326.3. §1 | `s45-rain-{before,after}-t0-wet.png` |
| **R2** | **Street level is too dark at night.** | The origin block's lamp bowl was **0.2151× its own derivation** — 420 against 1952.19 cd/m² — and `PLAYER.spawn` is on that block's pavement. The thing that blocked the repair in session 30 stopped existing in session 31. **It also closed `band:dusk`, red since session 40.** §2 | `s45-lamp-{before,after}-t0-wet.png` |
| **R3** | **An entire pavement runs its whole length with no lamp on it at all.** | Every street in the streamed city was lit from **one side**, and the last **29–38 m of every block** from neither. `block.js` has always done it correctly. Merging the per-chunk lamp meshes paid for the repair and **46 draw calls** on top. §3 | `s45-junction-t0-wet.png`, `s45-viaduct-t0-wet.png` |
| **R4** | **The carriageway does not read as a road in daylight.** | Where the road is **concrete** — 34.7% of chunks, in districts — it delivered **14 code values** from its own pavement. 0.19 → 0.11714 from CIE's own R1/R3 classes. §4 | `s45-road-{before,after}-t0_5-dry.png` |
| **R5** | **The splash crowns are at the edge of visible** (STATE 44 item 5). | The same defect as R1 one layer over: all three particle layers multiplied a MEAN radiance by a SHAPE whose mean is not 1. splash ×2.081, spray ×3.273. §1.2 | as R1 |
| **R6** | **No kerb reads.** | The kerb was **a 0.180 m hole with the world's earth plane behind it**. Raycast at 14.13 m: `block:ground`, albedo `[0.1229, 0.1211, 0.1168]`. §5 | `s45-road-after-t0_5-dry.png` |
| **R7** | `city-budget.json`'s stall derivation quoted two laws that no longer exist. Carried since STATE 42. | Corrected in place; the argument survives its own stale facts and no threshold moved. | — |
| **R8** | **The origin block has no road markings at all.** No centre line, no lane line, no edge line, no stop bar, no zebra, in 336 m of main street — and it is the street `lookcheck` stands in and `PLAYER.spawn` puts the player on. | `citygen`'s `paint()` refuses any mark not on a delivered `carriageway` claim, and `BLOCK_KEEPOUT` clips the lattice's carriageway out of this block. **A guard doing its job, and nobody else ever painted here.** One draw call. **It took `lookcheck` red at 3 again** — see L15. §5.1 | `s45-marks-{before,after}-t0_5-dry.png` |

### FOUND AND NOT REPAIRED — the list the next session starts from

**L1. EVERY WINDOW IN THE STREAMED CITY IS 220 cd/m² AND THE ORIGIN BLOCK'S ARE 7 TO 30.**
This is CONTRACT §9's own class — one quantity, two files, nothing comparing them — and it is
**exactly the defect session 28 repaired for the lamp bowl and nobody checked for the window.**

```
  src/core/constants.js  LIGHT.windowNits          220     "a lit office window seen from
                                                            the street", read by city.js for
                                                            EVERY window in the streamed city
  src/modules/block.js   EMISSIVE.windowCold        30     under a table comment that says
                         EMISSIVE.windowWarm        21     "these are authored, not measured"
                         EMISSIVE.windowDirty       14     — the same sentence that produced
                         EMISSIVE.windowDim          7        the 210 cd/m² lamp bowl
```

**7.3× to 31.4× apart.** The delivered consequence is a frame: raycast through the scene at the
white rectangle that owns a fifth of `s45-window-blown-t0-wet.png` returns `2,2:windows` at
**5.87 m**, `emissiveIntensity` 220, `roughness` 0.05. At dusk the same panel is a flat pale
blue-grey slab with no structure (`s45-window-slab-t0_78.png`) because a 0.05-roughness surface
is a mirror and what it mirrors is the sky.

**NOT REPAIRED, and the reason is a number.** Dimming it is a subtraction from `citycheck`'s
bright reserve, a FLOOR that was RED for six sessions before density fixed it (LOOK.md §7).
`constants.js` records that the streamed lamp bowls alone carry 0.96 points of it; the windows
are the larger share and nobody has attributed them, and that attribution — zero each path in
turn, exactly as `$lampBowl_measured` did — is the first hour of this item.

**AND THIS SESSION MADE IT MORE AFFORDABLE THAN IT WAS.** The reserve reads **6.91% against the
6.00% floor** (per-run means 6.92 / 6.45 / 6.91, spread 0.47), against **6.24%** in session 44.
Brightening the origin block's sixteen bowls and painting its street put 0.67 points into the very
reserve the window repair has to spend, and that is the largest margin this floor has ever had.

    localhost:5173/?player=1&spawn=375.4,1.74,300&t=0.78
    localhost:5173/?player=1&spawn=375.4,1.74,300&t=0.0&wet=1

**L2. A STREET-LEVEL POSE AT THE ARCH DELIVERS 2 396 028 TRIANGLES AGAINST A 2 360 000 CEILING,
AND NO GATE ROUTE GOES THERE.** `s45-arch-triangles-t0_5.png`, 256 draws. The weir pose beside it
reads 2 340 700. Subtracting this session's own lamp delta (≈35 000 triangles, §3) still leaves
the arch pose at ≈2 361 000, so **it was at the ceiling before tonight** — this session did not
create it, it found it. The ceiling is asserted on the four `budget.json` routes and all four run
down the main street; `portalprobe` made the same point about the viaduct's ends in session 23.

    localhost:5173/?player=1&spawn=26,1.74,230&t=0.5&wet=1

**L3. THE WEIR IS STILL A PALE LID FROM THE PAVEMENT.** Session 42 took its disc from 100.0% to
47.3% within ten code values of its median, measured from the air. From the ground at noon the
bowl is one enormous featureless plane, the sixteen stands of planting read as **dark green
shipping containers evenly spaced on a rim**, and the permanent pool reads as a thin dark stain
rather than water. The aerial statistic is green and the street view is not, which is §7.3's own
shape: two views, one metric.

    localhost:5173/?player=1&spawn=-180,1.74,150&t=0.5&wet=1        s45-weir-lid-t0_5.png

**L4. DAYLIGHT RAIN IS INVISIBLE AT ANY GAIN, AND IT IS THE BLEND MODE.** At `rainfall=1` and
noon the streaks vanish even at ×326. `WATER_CHROMA` is white and the three layers are
**additive** (`blendSrc: OneFactor, blendDst: OneFactor`), so a drop can only ever ADD light.
Daylight rain reads because a drop REFRACTS: it is darker than a bright sky and brighter than a
dark wall, and an additive layer cannot be darker than what is behind it. Night rain is the case
additive gets right, which is why R1 works and this does not.

    localhost:5173/?player=1&spawn=384,1.74,300&t=0.5&rainfall=1    s45-rain-daylight-t0_5.png

**L5. THE SPLASH CROWNS' POPULATION SHARE IS UNSOLVED, AND THE STREAKS' IS NOT.** R1 gives the
streaks ×91.41 for the drops below `DROP_MM`; the crowns did not get it, deliberately. A streak
is a GLINT so its flux goes as the drop's projected disc and the D² moment is the right integral.
A crown is DIFFUSE FOAM at a size that also goes as D, so the right integral is over the impact
FLUX — `∫ N(D)·v(D)·A_crown(D) dD` with `v = 3.78·D^0.67` — and it is not the same number. One
evening's arithmetic, and `weather.js` already holds every term.

**L6. `rain_spray` DELIVERS 0 TO 4 OF 70.** Carried from STATE 44 item 6 and not measured this
session. `budget.json` sized 70 from *"6 vehicles in the near field × 2 wheel lines × 6 puffs"*
and `SPRAY_RANGE_M` is 25 m.

**L7. FROM 220 m UP AT MIDNIGHT ONLY THE STREET UNDER THE CAMERA HAS LAMP POOLS, AND THIS SESSION
MADE THAT TIGHTER.** `lampPool` is 96 slots handed to the nearest candidates; R3's 2.5× poles
shrink the lit radius by `1/√2.5` = **0.63×**. Within it both kerbs now lay a pool, which is the
right way round for a person on a pavement — but from the air the city is dark streets with lit
windows, and whether that is correct is a look decision nobody has taken. The pool is 96 of
`CLUSTER.maxLights` and `city.js` prints the margin at boot.

    localhost:5173/?player=1&spawn=384,220,300&t=0.0&wet=1

**L8. A SPARSE DISTRICT AT MIDNIGHT HAS ALMOST NO LIT WINDOWS.** *Written as a question, per
LOOK.md §8.* The left half of the midnight aerial is black over about five blocks while the right
half is full of lit windows. Is window lighting supposed to scale with district density, and
should a sparse block read as unbuilt at night rather than as a quiet one? A count per block
against the density field answers it in ten minutes.

**L9. TWO BLOWN-WHITE VERTICAL SLIVERS ON THE ORIGIN BLOCK'S ADVERTISING PILLAR AT MIDNIGHT.**
Not identified. They are pure white, about three pixels wide, and they are the brightest thing in
the lower half of the frame. *"This reads oddly and I do not know why."*

    localhost:5173/?player=1&spawn=44,1.74,9.4&t=0.0&wet=1          s45-pillar-slivers-t0-wet.png

**L10. A PEDESTRIAN WITHIN ~2 m OF THE LENS READS AS A DISEMBODIED PALE LIMB.** Consistently, in
three frames from two poses. Probably near-plane clipping through a body box rather than a gait
defect, and `gaitstrip` is the wrong instrument for it because it frames the figure whole.

**L11. THE ORIGIN BLOCK'S STREET READS AS A PLAZA AT NOON EVEN THOUGH ITS ALBEDOS ARE RIGHT.**
Measured 212 (pavement) against 151 (carriageway) — a **61 code-value step**, which reads, against
the concrete district's 14 before R4. What does not read is the BOUNDARY: no lane marking in the
frame at all, no crossing paint, and the kerb is a 0.16 m step seen almost edge-on. R4 and R6 do
not touch this path — `block.js` draws its own ground. **The origin block has no road markings.**

**L12. THE CITY IS ONE HUE AT DUSK.** Every roof, wall, road and vehicle in a 180 m aerial is the
same red-brown (`s45-one-hue-dusk.png`). LOOK.md §3's *"a third of emitters should be cold"* is
still the biggest unspent lever, and at dusk the sun does the same thing to every surface at once.

**L13. THE EMPTY DISTRICTS ARE STILL THERE FROM THE AIR.** Five consecutive blocks of paving with
scattered specks and no building (`s45-empty-districts-t0_25.png`). Not measured this session;
`bareprobe` and `fillprobe` are the instruments and LOOK.md §2 carries the whole argument.

**L14. A WET ROAD AT NOON IS A HARD MIRROR.** At `wet=1` the carriageway returns sharp inverted
building images and reads as polished stone rather than wet asphalt. `main.js` ships `wet: 0.55`
so nobody normally stands in it — but `lookcheck` pins **1.0** in four of its eight frames, so
half the look gate measures that surface.

**L15. `distinct:midnight|dusk` HAD A MARGIN OF 0.0002 OF ITSELF AND R8 SPENT IT.** The bound is
`look-budget.json` -> `distinctness.minPairMSD` = 0.03 over all six pairs of the four times, and
its whole note is one sentence saying what it measures — one of LOOK.md §7's *"76 of 189 bounds
with no recorded derivation at all"*. Three readings today:

```
  midnight <-> dusk      0.03008    0.03007    0.02995   floor 0.030   RED after R8
  midnight <-> dawn      0.12903    0.12898    0.12877
  midnight <-> noon      0.20447    0.20443    0.20404
  dawn     <-> noon      0.11378    0.11378    0.11319
  dawn     <-> dusk      0.05799    0.05798    0.05806
  noon     <-> dusk      0.13813    0.13813    0.13806
```

**Five of the six clear the floor by 0.02 to 0.17 and the sixth cleared it by 0.00007**, against a
run-to-run resolution of 0.00001. Paint is bright at midnight AND at dusk — they are the two
`lampsOn` times — so it adds the same pixels to both frames and shrinks the one difference that
had nothing to spare. **THE THRESHOLD WAS NOT TOUCHED**, and lowering it to make R8 pass would be
CONTRACT §0 rule 5 wearing a re-derivation's clothes. What is owed is LOOK.md §7's own discipline
applied to `minPairMSD` in the open: what is a pair of times supposed to differ BY, and is 0.03
the answer for the one pair where both are lit by the same lamps? That is the next session's, not
the session that broke it.

**CARRIED, UNTOUCHED, AND NOT RE-DISCOVERED HERE:** `clumping` CV 0.443 against a 0.60 floor (red
by instruction, fifth session of asking); the vehicle tone-profile bar (eleventh session); the
generator registry containing no sign claims; `perfcheck`'s `player` route never registering the
player module; a `citycheck` assertion that delivered may not exceed claimed; and everything in
STATE 44 §9 item 11 and §10.

---

## 1. THE RAIN DID NOT FALL, AND IT WAS TWO FACTORS AND NOT A MYSTERY

The brief said to establish whether the layers render at all, what drives their count, and whether
that driver is session 44's rainfall or a second dormant one. **All three were answered at HEAD
before a line was written**, and the answer is that there is one driver, it is session 44's, and
it works:

```
  weather:rain_streak   500 instances   500 with a non-zero gain   500 INSIDE THE FRUSTUM
                        distances 0.88 m to 12.00 m, median 9.40 m
                        gain mean 0.497   uNits 1.8887   uGain 1.00   uViewportPx 1280x720
  weather:rain_splash   130 instances   130 non-zero gain    0 in frustum (all on the road
                                                                behind and beside the camera)
  weather:rain_spray     70 instances    70 non-zero gain    0 in frustum
```

So the layer is fed, seeded, unsheltered, in front of the camera and drawn — and the delivered
frame is indistinguishable from `rainfall = 0`. **The uniform was then swept live in one boot** at
×1, ×8, ×25, ×70, ×180 and ×400 with the clock paused and the pose held: nothing at ×8, a light
shower at ×25, a heavy one at ×70, a downpour at ×400.

### 1.1 THE TWO FACTORS

**THE COVERAGE PROFILE WAS NEVER NORMALISED — ×3.570.** `STREAK_NITS` is a MEAN radiance: the
drop's flux over the whole quad's area, which is what the module's own two dilution factors
compute. The fragment shader then multiplies it by `coverage`, which is a SHAPE, and the shape's
mean over that same quad is not 1:

```
  across   mean of exp(-6·q.x²)                 over q.x in [-1, 1]    0.36152
  along    mean of smoothstep(1, 0.55, |q.y|)   over q.y in [-1, 1]    0.77481
  product                                                              0.28011
```

**72% of every drop's flux went into the profile's own falloff.** A shape may redistribute energy;
it may not remove it.

**THE BILLBOARDS ARE 1.1% OF THE RAIN'S GLINTING CROSS-SECTION — ×91.41.** `budget.json` splits at
`DROP_MM` = 3.28 mm and says of everything below it *"it is not missing, it is the veil"*. That is
true of EXTINCTION, which is what light passing THROUGH the small drops loses over a kilometre. It
is not true of BACK-SCATTER, which is what a drop three metres from the eye sends into it: the
3 164 drops per m³ below the split are inside the same 12 m volume and are glinting at the same
lamps, sub-pixel each and four thousand to one. The share is the D² moment of the same
Marshall–Palmer distribution the counts came from, because a glint's flux is its drop's projected
disc:

```
  all D            N0·2/Λ³                                    = 990.3
  D >= 3.28 mm     N0·e^(-ΛD)·(D²/Λ + 2D/Λ² + 2/Λ³)           =  10.83
  ratio                                                        =  91.41
```

The numerator is `RAIN_SIGMA_FULL`'s own integral with `Qext·π/4` divided back out, so the two
terms cannot disagree about the distribution.

**3.570 × 91.41 = 326.3, AND THE ARM CHOSEN BY LOOKING WAS 70–400.** The derivation lands inside
the bracket the eye picked, which is the only reason it ships rather than the number 70. What
changes about what the layer MEANS is written in the module: a streak was the image of one drop
above the split and is now that drop **carrying its column's water**. The compromise is in the
shape rather than the energy — small drops fall slower and streak shorter, so the honest rendering
of their share would be a denser field of shorter streaks, and 500 is the instance ceiling.

**NO COUNT MOVED.** 500 instances, a 168 px² clamp, one draw call already in the frame at
`rainfall = 0`. `budget.json` → `particles` is byte-identical, because every bound there is a
count or an area and this is a radiance.

### 1.2 THE OTHER TWO LAYERS HAD THE SAME DEFECT

`makeLayer` now takes `coverageMean` and **throws without it** — a default of 1 would let the
defect back in silently, and a layer that declares a shape but not its integral is the same
mistake again.

```
  streak  exp(-6q.x²)·smoothstep(1, 0.55, |q.y|)            0.28011    shipped 28% of its flux
  splash  two smoothsteps making an annulus, over phase     0.48064    shipped 48%
  spray   exp(-|q|²·mix(3.4, 1.6, phase)), over phase       0.30554    shipped 31%
```

STATE 44 item 5 recorded the crowns as *"present and very faint … at the edge of visible"* with
130 of 130 rendering. This is half of why. The other half is L5.

---

## 2. THE ORIGIN BLOCK'S LAMPS ARE THE DERIVATION NOW, AND `band:dusk` WENT GREEN

`citycheck` has printed *"origin block delivers 420.0 = 0.2151× derived"* every run for fifteen
sessions. `PLAYER.spawn` is `[70, 9.7]`, which is that block's north pavement, so **the lamps the
operator walks under at night are these sixteen and not the streamed city's 790.**

**WHAT BLOCKED IT STOPPED EXISTING IN SESSION 31.** Session 30 swept this factor against
`band:midnight`'s 0.112 ceiling, put the crossing near 550 cd/m² and shipped 420 because that left
0.0008 of margin against an instrument spread of 0.0001. **That sweep was taken at a delivered
`band:midnight` of 0.1112.** Session 31 put the station in the same frame and the band read
0.0745; every STATE since has recorded 0.0741–0.0745, three runs each, spread 0.0000. The comment
in `constants.js` has said *"nothing here is what that assertion is balanced against any more"*
since session 31 and **no session went back to re-ask the sweep.**

```
                    before        after       band              headroom
  band:midnight     0.0741        0.0826      [0.072, 0.112]    0.0294 of ceiling
  band:dusk         0.1393  RED   0.1410      [0.140, 0.180]    GREEN by 0.0010
  band:dawn         0.3021        0.3020      [0.299, 0.353]
  band:noon         0.4288        0.4287      [0.428, 0.482]
  crushed black     0.869%        0.571%      ceiling 2.0%
  road pools        —             9           floor 6
```

Session 30's own measurement of this exact step — 420 → 1952 — was **+0.0075** of frame mean on
its content. Predicted 0.0741 + 0.0075 = 0.0816; **delivered 0.0826**, and the prediction is left
in `constants.js` to be wrong against.

**`band:dusk` HAS BEEN RED SINCE SESSION 40 AND THIS CLOSED IT.** Dusk is one of the two
`lampsOn` times (`look-budget.json` → `onAt`), so these bowls are in that frame. The margin is
0.0010 against a run-to-run resolution of 0.0001 — ten times the instrument's own noise, which is
the margin CONTRACT §0.1 permits a decision on.

**IT ALSO MOVED THE FLOOR THE RIGHT WAY.** `band:midnight` is `[0.072, 0.112]` and 0.0741 sat
**0.0021 above its FLOOR**: for fourteen sessions the frame has been closer to being too dark than
to being too bright, which is the operator's complaint in the gate's own units.

`city-budget.json` → `lampBowl.minRatio` moves **0.2151 → 0.9999**, the only direction that bound's
definition allows. **`maxRatio` is NOT touched**: correcting the streamed city's 4.611× is a
DIMMING that `constants.js` records at 1.39 points of a bright reserve standing at 6.24 against a
floor of 6.00. Moving the ratchet toward 1.0 "as far as the bands allow" allows one end and not
the other, and the frames say the same thing — the streamed city at night already reads.

---

## 3. EVERY STREET WAS LIT FROM ONE SIDE, AND MERGING THE MESHES PAID 46 DRAW CALLS FOR THE FIX

The operator's daylight frame: *"an entire pavement runs its whole length with no lamp on it at
all."* It is not a stream gap. `lampStationsFor` emitted both stations at
`b.x0 + roadHalfWidth + 1.3` and `b.z0 + roadHalfWidth + 1.3` — the **+x and +z** pavement of the
chunk's own two roads. A road runs on the chunk BOUNDARY, so its other pavement belongs to the
neighbour, whose loop puts its poles on ITS +x edge 128 m away. **No road in the streamed city has
ever had a lamp on its −x or −z pavement.**

**AND THE PROJECT'S OWN CONSTANTS SAY OTHERWISE, IN WORDS.** `constants.js` → `LUMINAIRE` derives
the whole elongated optic from *"a Type II semi-cutoff lantern, which is what a 15 m street with
**staggered poles both sides** is lit with"*, and goes on: *"the lamps are staggered at an
effective 15 m, so consecutive pools overlap along the road … and stop short of each other across
it (which is what makes the two kerbs read as two rows instead of one carpet)"*. Two kerbs. And
`block.js` → `LAMP_STATIONS` is `-108 + i*30` on one kerb and `-93 + i*30` on the other:
**staggered, both sides, effective 15 m, since session 3.** Two content paths, and again the
authored one was right.

**TWO MORE, BOTH ARITHMETIC.** `i < 4` at a 30 m pitch reaches `phase + 90` of a 128 m edge, so
**29 to 38 m of every block front — 23–30% of the city's kerb length — had no pole by
construction**, and the `off > chunkSize` guard beside it could never fire (99 < 128), which is
CONTRACT §7.1's shape. And `(cx·7 + cz·13) % 10` is negative for half the city, so those chunks'
first pole stands up to 9 m inside the neighbour and the guard only tests the upper end.

### 3.1 THE DRAW-CALL BUDGET WENT FROM ONE SPARE TO FORTY-FIVE

Stations per chunk go 8 → 20. Measured on `highway_speed`, the tightest budget in the project:

```
  arm                                     draws    triangles    verdict
  shipped, session 44                       439        2.13 M   one spare
  + the far kerb, per-chunk meshes          441        2.15 M   BREACH of 440
  + the far kerb, MERGED meshes             395        2.18 M   45 spare
```

The +2 was not new meshes — the scene walk reads 430 either way — it was more of the **same 70
per-chunk lamp meshes** passing the frustum test, because each one's bounding sphere now reaches
the other pavement. The near ring is 35 chunks and each emitted a `:lamps` and a `:bowls` mesh, so
**street lighting alone could ask for 70 of the 440.** Merged city-wide it asks for **2**, which is
the move `rebuildGroundMesh` and `rebuildSignMesh` already make and for the same ceiling. Scene
meshes **430 → 362**.

`nearVisible` replaces the per-chunk `.visible = near` toggle; the census labels become city-wide
totals, which is what `harness.sceneCensus()` sums anyway, and the per-chunk breakdown it loses is
read by nothing.

**THE COST IS TRIANGLES AND IT IS NAMED.** A merged mesh spanning the near ring is effectively
never culled, so the lamps are in every frame: `highway_speed` 2.13 M → 2.18 M against a
2 360 000 ceiling, **7.6% spare**. L2 is the pose where that matters.

---

## 4. THE CONCRETE CARRIAGEWAY WAS FOURTEEN CODE VALUES FROM ITS OWN PAVEMENT

Measured as a scanline across the section rather than as patches, at noon, standing on the
carriageway at x = 384, z = 300, seed 1337:

```
  pavement      202 cv          kerb band   158 cv        lane line   230 cv
  carriageway   188 cv          14 cv apart, 1.176x in display-linear
```

**AND IT IS NOT THE TONE CURVE**, which is what a 0.45-display-linear road at noon invites you to
assume. 0.19 against the pavement's 0.26 is 1.368×, and ACES at that exposure turns 1.368× into
204/188 predicted against **202/188 delivered**. The albedo is the whole of it. The same
measurement in the ORIGIN BLOCK reads **212 against 151, a 61 cv step**, because `block.js` draws
its carriageway at 0.0908.

**A THIRD OF THE CITY, AND IN DISTRICTS RATHER THAN SCATTERED.** `citygen.js` picks `concrete` on
`age < 0.36` where `age` is a SMOOTH noise field: **42 of 121 chunks (34.7%)** over an 11 × 11
region at seed 1337, and the pose above stands on chunk (3,2) with **all eight of its neighbours
concrete too**. A walker in one of those districts sees no road anywhere.

0.19 had no derivation beside it in a block where every other surface carries one (§9 rule 5). The
ratio is CIE's standard road-surface classes, which exist to say exactly how much brighter one
carriageway is than another under one lighting geometry: **R1** cement concrete Q0 = 0.10 against
**R3** dark-aggregate asphalt Q0 = 0.07. Only the RATIO is borrowed — `π·Q0` would put R3 at 0.22
and this project's asphalt is 0.082 — so the anchor is this city's own road:

    0.082 × 10/7 = 0.11714       [0.11714, 0.11714, 0.11405]

It lands between this file's own `core` 0.105 (*"asphalt patched over concrete"*) and `yard` 0.172
(*"worn concrete hardstanding"*), which is where a trafficked concrete carriageway belongs. And it
repairs the markings the same observation complains about: `city.js`'s own parking note calls the
0.62 bay paint against asphalt *"a ratio of 7.6×, which is what makes a bay read at night"* — on a
0.19 road that ratio was 3.3× and it is now **5.3×**.

**DELIVERED**, same pose, same exposure: carriageway 188 → **170**, pavement 202 → **206**
(auto-exposure pays back what was removed), a **35 cv step against 14**.

---

## 5. THE KERB WAS A HOLE AND WHAT YOU SAW IN IT WAS THE EARTH PLANE

`GROUND_Y` in `city.js` has said *"Pavement either side of the north–south carriageway. **A REAL
kerb now.**"* since session 19, and the HEIGHT is real: the pavement quad is at `GROUND.pavement`
= 0.160 and the carriageway quad is at 0. **Nothing joined them.** Two horizontal quads at
different heights abutting in plan leave a 0.180 m vertical slot, and from a standing eye you look
straight through it. Raycast through the delivered scene at the kerb band of the §4 frame:

```
  block:ground    at 14.13 m    albedo [0.1229, 0.1211, 0.1168]
```

That is `GROUND.earthAlbedo` — the surface session 42 identified as *"a field beside a city"* and
calibrated so the far ring would stop reading as a ploughed one. **It was also the kerb of every
street in the streamed city.** The darker line at a road edge in every frame this project has
taken was never a kerb face catching less sky; it was the ground UNDER the city showing through a
gap. `block.js` has drawn a real one since session 3. That is the third time in this session that
two content paths disagreed and `block.js` was the correct one.

The repair is one riser on the ROAD-FACING edge of each `walk` rect — the other three edges abut a
pavement, a building line or a corridor at the same height, and a face there would be a wall
across the footway. Which edge that is comes off `yKey` rather than a guess, and it reproduces on
chunk (3,2)'s delivered rects: **391.5 and 376.5, both exactly `roadHalfWidth` from 384**. The
albedo is the origin block's own ratio and not a new number: `matKerb` 0.3185 over `matPavement`
0.2582 = **1.2335×**, because an upstand is the same cast concrete and is not walked on.

**DELIVERED** at the same scanline: the band at the road edge goes **163 → 82** code values against
a pavement of 207 and a carriageway of 172. It is DARKER than the earth plane it replaces, not
lighter, because a vertical west-facing face under a 57.9° southern sun sees no sun and a fraction
of the sky — which is what a kerb looks like and is why it now reads.

**+954 triangles over the whole ground ring, ZERO draw calls, and NOTHING added to `rects`.** A
riser is not a surface anything stands on, and `rects` is what `surfaceAt` and the delivered
occupancy census read — a vertical face in that list would give the player a floor at the
pavement's height 0.18 m out into the carriageway. `windcheck` green: 563 of 563 cull-eligible
meshes decided, 0 wound backwards.

### 5.1 AND THE ONE STREET THE LOOK GATE STANDS IN HAD NO PAINT ON IT

`citygen.js` delivers **2 077 crossing stripes** over `citycheck`'s 10 × 10 (LOOK.md §4) and
`block.js` delivered **none**: no centre line, no lane line, no edge line, no stop bar, no zebra,
in 336 m of main street and 92 m of cross street. Searching that file for *"marking"* returns
nothing; the word *"crossing"* in it means the cross STREET. And that street is where `lookcheck`'s
camera stands, at `[70, 1.74, 0.9]`, and where `PLAYER.spawn` puts a person.

**IT IS A GUARD DOING ITS JOB.** `citygen`'s `paint()` refuses any mark whose footprint is not
covered by a DELIVERED `carriageway` claim, so that *"a road the river took, the block took or a
dome took has no lines painted in the air over where it used to be"*. `BLOCK_KEEPOUT` clips the
lattice's carriageway out of this block so that the authored asphalt wins — **so the lattice
correctly paints nothing here, and nothing else ever painted anything.** That is the third
different mechanism this session by which the origin block and the streamed city ended up as two
different cities, and the first one where the streamed city was the correct half.

The repair paints **exactly the ground the keep-out took**, so the two cannot double up, and every
dimension is `ROAD_MARKING` — eleven numbers exported from `citygen.js` where they were local
`const`s — with the thickness and reflectance in `constants.js` → `ROAD_PAINT`, which `city.js`
now reads from the same place. The zebra band is SOLVED with this street's own numbers rather than
copied: near ≥ `halfCross + 0.05` = 6.55, far ≤ `9.0 − 0.20 − 0.05` = 8.75, so **2.20 m of depth
centred on 7.65** — wider than the lattice's 1.20 m because this cross street is 13 m and not 15.

**ONE DRAW CALL, and §3.1 is why there was room for it.** Midnight road pools 9 → **12** against a
floor of 6. The four bands moved by 0.0002 to 0.0005 and all four are inside. **`lookcheck` went
back to RED at 3** and the third one is L15 — a bound with a margin of 0.0002 of itself, which the
paint spent.

---

## 6. GATE STATE

Run individually, because `npm run gates` is `&&`-joined and stops at the first red.

```
  parsecheck   GREEN   112 files, contract-clean. Unchanged from sessions 42-44 — this session
                       added no file; its five probes are in the scratchpad.
  faultcheck   GREEN   7 cases, quarantine surgical, the frame survives every one.
  windcheck    GREEN   567 meshes, 563 ok, 0 wound backwards, 0 unmeasured. The kerb risers of
                       §5 are inside `city:ground` and are in that count.
  inputcheck   GREEN   keyboard 3.477 / 3.500 m/s, gamepad look 177.88 / 180.00 deg/s,
                       mouse 40.0 cm/360 inside the 27.2-60 band, lock acquired.
  lookcheck    RED at 3. `band:dusk` CLOSED (§2) after four sessions red, and R8's road
                       markings opened `distinct:midnight|dusk` (L15) — a different assertion,
                       not the same one back. The other two, `facadeAlbedo` and
                       `facadeNeighbours`, are carried, are both about the origin block's facade
                       MATERIALS, and neither was touched this session.
                         band:midnight 0.0829   band:dusk 0.1412   band:dawn 0.3025
                         band:noon 0.4285       crushed black 0.576%   road pools 12 of 6
                         (before R8: 0.0826 / 0.1410 / 0.3020 / 0.4287, black 0.571%, pools 9)
  citycheck    RED at 3, THE SAME THREE as sessions 40-44, no new violation of any kind. §6.1
  perfcheck    RED at 13, of which ELEVEN are frame time at load1 2.48-7.18 and are not
               admissible, one is `night_rain`'s straddling frame mean, and ONE IS CONTENT —
               the carried vehicle tone-profile bar, eleventh session. NOT ONE IS A COUNT. §6.2
  gateaudit    RED at 1, AND IT IS TWO NAMES WHERE IT WAS THREE. "the unperturbed frames do not
               pass their own gate" now names facadeAlbedo and facadeNeighbours only —
               `band:dusk` is out of that list. Everything else green: `ok control — every
               assertion ran` (nothing suppressed), 74/74 perfcheck falsify cases at 100%
               coverage over 72 failure sites, 61/61 citycheck, 13/13 inputcheck, and both
               the §7.3 shape and §7.5 width control sweeps.
```

**WHICH GATE SAW WHICH COMMIT, SAID RATHER THAN ASSUMED.** All eight ran in one uninterrupted
block with nothing else launched, in `npm run gates`' own order, at commit **`b757a37`** — the
seventh code commit. **R8, the road markings, landed after that**, so `lookcheck`, `windcheck` and
`citycheck` were re-run against it (they are the three it can move) and their numbers above are
the post-R8 ones. `perfcheck` and `gateaudit` were NOT re-run: R8 is one instanced mesh of 340
boxes and one draw call, measured at every pose in §5.1, and the four routes have 45 draw calls
and 180 000 triangles of margin. `gateaudit`'s control will now name three assertions rather than
two, and L15 says which.

### 6.1 CITYCHECK — RED AT 3, THE SAME THREE AS SESSIONS 40–44, NO NEW VIOLATION

```
  clumping             CV 0.443    floor 0.60    untouched by instruction, fifth session
  sign quads inside    2 of 2720   max 0         the same two
  delivered overlaps   2           max 0         sign(adpillar) x prop(tree) 0.013 m2 and
                                                 sign(adpillar) x prop(planter) 0.086 m2
```

**AND THE LAMP-BOWL RATCHET PASSED AT ITS NEW BOUND**, which is the assertion §2's change had to
clear:

```
  lamp bowls   derived 1952.2 cd/m2 = phi/(pi*A) over a 0.42 m bowl, photocell on
               origin     delivered 1952.2 = 1.0000x derived, 16 meshes   ratchet [0.9999, 4.611]
               streamed   delivered 9000.0 = 4.6102x derived,  1 mesh     ratchet [0.9999, 4.611]
```

**TWO NUMBERS MOVED A LONG WAY AND BOTH MOVED THE RIGHT WAY:**

- **bright reserve 6.24% -> 6.83% -> 6.91%** against a 6.00% floor (per-run 6.92 / 6.45 / 6.91,
  spread 0.47, after R8). Attributable to §2 and §5.1: the origin block's sixteen bowls are 4.65x
  brighter and its street now has white paint on it, and `night_rain` runs through that block.
  **That is the largest margin this floor has ever had**, and it is the budget L1's window repair
  has to spend.
- **saturation peak 4.01% -> 4.57% -> 4.61%** against a 12% ceiling (per-run maxima 4.74 / 4.47 /
  4.61, spread 0.27, after R8). STATE 44 asked *"what took a third off the saturation peak, and does the estimator
  note still describe the gate it was written for"* — it has come back 0.56 points, still against
  a `$estimator` note recording six per-run maxima of 8.64 to 11.74 and calling the gate *"green
  by less than its own resolution"*. **It is green by 7.4 points now and the note is still wrong
  about which gate it describes.** Carried, unanswered, and the question is unchanged.

Everything else green: 0 of 3333 props inside a building, 5 sign mountings over 975 signs, 195
stalls of a floor of 60, 8 landmarks placed and 8 visible and 0 unreachable on foot, worst detour
1.46x, 5 eras, 3 road materials, 74.1% of 4982 objects off-axis, 341 instanced meshes with 341
labelled and 0 not.

### 6.2 PERFCHECK — EVERY COUNT, AND THE MILLISECONDS ARE NOT ADMISSIBLE

```
                       draws   draws s44      tris   tris s44   instances    inst s44
   downtown_dense        317         343     1.91M      1.87M     238 242     237 836
   highway_speed         395         439     2.18M      2.13M     312 306     312 006
   night_rain            316         342     1.88M      1.84M     292 561     292 225
   player                306         330     1.86M      1.81M     238 242     237 836
```

**THE DRAW-CALL CEILING IS NO LONGER THE LIMITER.** `highway_speed` reads **395 of 440** where it
read 439 for three sessions — **45 spare where there was one** — and every other route fell by
24 to 44. §3.1 is where that came from and it is one structural change, not a content cut: 2.5×
the street lamps went IN at the same time. **Every one of the four routes is down and every one
of the four carries more content than it did.**

The triangle ceiling is what moved the other way: 2.13 M -> **2.18 M of 2 360 000**, 7.6% spare,
because a city-wide merged mesh is effectively never culled. L2 is the pose where that matters.

`night_rain`'s frame ENTROPY went green on its own — 4.933 -> **5.184** against a floor of 5.0 —
and its frame MEAN is 0.0793 against a floor of 0.08 with per-run values 0.0793 / 0.0782 / 0.0813,
which is `$screenshotEntropy_s17`'s own straddling statistic doing exactly what that note says it
does. Neither has anything to do with rain: every route printed `rain 0.00 (now 5s, next shower
868s), 0 drops`, which is session 44's own print and §4 of that STATE explaining why.

**THIRTEEN VIOLATIONS, SORTED BY WHAT THEY ARE, AND NOT ONE IS A COUNT:**

- **ELEVEN ARE FRAME TIME** — four cpu p95, four wall p95, three "frames over 33 ms" — measured at
  `load1` 2.48 to 7.18 with a browser rendering. None is admissible in either direction. The
  closest to a real reading is `highway_speed` wall p95 **12.70 against 12.5**, which is 0.20 ms
  over: CONTRACT §0.1's founding incident is 0.10 ms over against a measured noise floor of
  0.40-0.80, and this run's own three-run spread on that statistic is 0.2.
- **ONE IS A FRAME-LEVEL STATISTIC**, `night_rain` mean luminance, above.
- **ONE IS CONTENT**, and it is the carried vehicle bar: *"only 63% of 70 vehicles carry a
  non-monotone tone profile (min 75%)"*. **Eleventh session.** Session 44's population went 23 ->
  68 -> 78 between runs of one gate; this run reads 70 and 63%, which is inside that spread.
- **NOT ONE IS A DRAW CALL, A TRIANGLE, AN INSTANCE OR A CLUSTER SLOT.** The 441 of 440 this
  session created at §3 is gone, and so are 44 draw calls that were there before it.

---

## 7. HOW EVERY FRAME AND EVERY NUMBER IN THIS FILE WAS TAKEN

All at seed 1337, all `?paused=1`, all at 1.70–1.74 m on the street unless the pose says otherwise,
1280 × 720.

**FIVE PROBES, ALL IN THE SCRATCHPAD, NONE IN THE TREE.** `parsecheck` still counts 112 files.

```
  walkshot.mjs    MANY POSES, MANY TIMES, ONE BOOT — this session's camera. `lookat.mjs` takes one
                  pose per boot, and this session's job was fifty frames across four times of day
                  in two content paths, which is fifty boots through lookat and one through this.
                  It writes the draw call, triangle, wetness, clock, field-slot and chunk counts
                  beside every frame, so a frame taken mid-stream says so.
  patch.mjs       named rectangles as mean sRGB code values, and scanlines across a section. The
                  §4 and §5 numbers are scanlines rather than patches on purpose: a patch
                  straddling a boundary reports the boundary, and that is exactly the mistake the
                  first read of the origin block made here (a "1.20x" that was two shadow states).
  rainsweep45.mjs one boot, one pose, sweeping the three layers' `uNits` uniform live with the
                  clock paused. It is what produced §1's ×1/×8/×25/×70/×180/×400 arm, and its
                  FIRST version silently changed nothing because the regex was `/^rain_/` against
                  mesh names that begin `weather:rain_` — twelve frames of an unmodified build
                  that looked like a finding. CONTRACT §9's failure mode with a string again, and
                  `lookat.mjs`'s own header carries the same story about `split('=')`.
  raindiag.mjs    the instance census that answered §1's first question: how many streaks are
                  live, how many carry a gain, how many are IN THE FRUSTUM, and at what distance.
                  It is the probe that turned "the rain does not render" into "the rain renders at
                  8% of its own derived radiance".
  pick.mjs        raycast the delivered scene through one pixel and print what is there, with its
                  material. Two of this session's findings are one line of its output each: the
                  kerb is `block:ground`, and the white rectangle is a window at 220 cd/m².
```

**EVERY FRAME WAS CHECKED FOR ITS SUBJECT BEFORE ANYTHING WAS MEASURED OFF IT**, which is STATE 43
§6's lesson. Three poses from the first batch were discarded for being blocked by a stall or a
sign panel at the lens, and they are why `walkshot` prints its counts per frame.

---

## 8. WHERE THE BRIEF DISAGREES WITH THE CODE

The brief asked for this section explicitly. **All three of its numbered claims are TRUE**, which
is the first time in several sessions, and two of them are true with a mechanism the brief did not
have:

1. **"The rain does not fall."** True, and the reason is not that the layers are dormant — STATE
   44's *"500 of 500 delivered"* is also true. A median streak renders at **7.2% of the radiance the
   module's own derivation names** — 0.497 scintillation × 0.517 min-extent widening × 0.280
   un-normalised profile = **0.136 cd/m² against a lit road at 1.4**, i.e. **0.097× the surface
   it is seen against**. Only the third of those three is a defect; the other two are the model
   doing what it says it does. §1.
2. **"The street lamps are four and a half times too dim."** True of the origin block exactly:
   0.2151× is 4.65×. **The brief's instruction to move the ratchet toward 1.0 "as far as the bands
   allow" allows ONE END AND NOT THE OTHER**, and the reason is printed in `constants.js`: the
   streamed city's correction is a DIMMING that costs 1.39 points of a bright reserve with 0.24 of
   margin. §2.
3. **"The carriageway does not read as a road in daylight."** True, and it is neither the earth
   plane (session 42 fixed that) nor a wet material nor the tone curve. It is **one albedo on a
   third of the city's chunks**, plus a kerb that was a hole. §4, §5.
4. **"Check whether the lamp POPULATION along a pavement is right, not only each lamp's
   brightness."** This was the largest of the four and the brief only asked it as an aside. §3.

---

## 9. WHAT WAS NOT DONE

- **The window radiance.** L1, and it is the biggest single finding of the session. Not repaired
  because it is a subtraction from a reserve with 0.24 points of margin.
- **No re-derivation of any threshold.** `look-budget.json`, `budget.json` and `input-budget.json`
  are byte-identical. `city-budget.json` moves ONE number, `lampBowl.minRatio` 0.2151 → 0.9999,
  which is the tightening direction its own definition names.
- **`clumping` was not touched.** Red by instruction.
- **No quiet battery.** `load1` 2.48–7.18, never inside 1.6.
- **No merge to main.** Eight commits of code and three of documents on
  `claude/noctis-44-make-it-rain`, all pushed.
- **`minPairMSD` was NOT re-derived**, and R8 took it red by 0.00005. L15.

---

## 10. WHAT TO DO FIRST NEXT TIME

1. **L1, THE WINDOW.** 220 against 7–30, one quantity in two files, and the same class session 28
   spent a session on for the lamp bowl. The first hour is the attribution: zero each path in turn
   and read the bright reserve, exactly as `$lampBowl_measured` did. **This session left it 0.91
   points of margin where session 44 left 0.24.**
2. **L15, `minPairMSD`.** R8 took it red by 0.00005 and it is owed a derivation, not a number: what
   is a pair of times supposed to differ BY, and is one figure right for `midnight ↔ dusk` — the
   only pair where both frames are lit by the same lamps — as well as for `midnight ↔ noon`? Five
   of the six pairs clear 0.03 by 0.02 to 0.17 and this one has never cleared it by more than
   0.0002 of itself. **Do not lower it to 0.029.**
3. **L2, THE TRIANGLE CEILING OFF-ROUTE.** A street pose at the arch is over it and no gate goes
   there. Either the four routes are not a sample of this city or the ceiling is not a ceiling.
4. **L4, THE BLEND MODE.** Daylight rain cannot work additively. This is a decision about what the
   layer is, not a measurement.
5. **THE DRAW-CALL BUDGET IS NO LONGER THE LIMITER.** 395 of 440, and 44 of the 45 spare were
   bought by ONE structural change (§3.1) rather than by cutting anything. Five sessions of items
   have been deferred with *"it costs a draw call"* beside them — the landmark/mass split (five
   calls, STATE 44 §9 item 11), the hologram's transparency (LOOK.md §3), the weir's ledge planters
   (LOOK.md §4, built and removed at 441). **They are affordable now, and the same merge is
   available again**: `#,#:masses` is 116 meshes and `#,#:windows` is 50.
6. **L12, COLOUR OPPOSITION.** Still the biggest unspent lever in LOOK.md §3 and now with a frame
   behind it.
7. Everything else in §0's list, then STATE 44 §9 items 3, 4, 6, 7, 8, 9, 10 and 11, all carried.

---

## 11. KNOWN GAPS CARRIED FORWARD

**Unchanged from s8–s44**: `stats().cutoffM` hard-codes 0.8, the headroom probe inert,
`saturation-peak.png` overwritten every run, `$fovYDrift`, `camera.setRouteAt(name, 1.0)` at the
sky, **right turns only**, sun shadows to ~170 m, the bake blind to elevated slabs, the PMREM
hitch, the too-red dawn horizon, one worker at queue depth one, the far half of the river handing
back to the night sky past ~300 m, grime authored, the near-field washboard on the water, the quay
wall inside the walkable mask, props absent from the walkability mask, the 3.5°–10.4° route camera
pitch, the frozen/running A/B, `materials.display` drawn by nothing, the hauler's marker row buried
inside its own body, the seeding fallback's untested placement, **a bus never turns**, the origin
block's absent occupancy registry, `facadeAlbedo` on its floor with zero spread, the station's
cores reading as an open frame, **nobody can climb the station**, the 0.10 m margin at the core's
outer face, `poseprobe`'s blindness to the origin block, one merged building pool breaching the
triangle ceiling, the station's platform slab hiding the train, `traffic.js:2346`'s claimed
draw-call margin of one, `minStraightness` and `minArrivalsPerMinute` having no gate reader, the
zero-second protected pedestrian phase, `landmarkBlocks` still exported and still disagreeing with
the registry two ways, **the basin is walkable in the mask and unwalkable in the geometry**, the
two `walkableAt` sites still blind to a basin, the quay walk's ulp exposure on four named chunks,
**`walkability` unreachable cells at 134 with no threshold reading it**, **the vehicle silhouette
tone-profile bar red on every reading for eleven sessions**, a gate message frozen in the present
tense of the session that wrote it, **a palisade that does not stop a pedestrian**, and **the two
delivered `sign ×` overlaps and the two sign quads inside a building**.

**CLOSED THIS SESSION:**

- **`band:dusk`**, red since session 40, closed by the origin block's lamp correction. §2.
- **"the pavement's missing kerb"**, carried since session 17's `walkprobe` — it was missing in the
  streamed city and it is a riser now. §5.
- **`tools/city-budget.json:84`'s stale `$derivation_count`**, carried since STATE 42.
- **The origin block having no road markings**, which nobody had noticed in forty-four sessions
  because the gate that counts markings counts the LATTICE's. §5.1.
- **The draw-call ceiling as the project's limiter.** 439 of 440 for three sessions; 395 now.

**NEW THIS SESSION — all of it measured, none of it inferred:**

- **A MEDIAN STREAK RENDERED AT 0.136 cd/m² AGAINST A ROAD AT 1.4** — 0.097× the surface it is
  seen against, and 7.2% of the radiance its own derivation names. §1.
- **ALL THREE PARTICLE LAYERS WERE DELETING ENERGY WITH THEIR OWN SHAPE** — 0.280, 0.481, 0.306.
  §1.2.
- **THE BILLBOARDS ARE 1.1% OF THE RAIN'S GLINTING CROSS-SECTION**, because `budget.json`'s split
  is about extinction and this is back-scatter. §1.1.
- **NO ROAD IN THE STREAMED CITY HAD EVER HAD A LAMP ON ITS −x OR −z PAVEMENT**, and 23–30% of its
  kerb length had no pole at all. §3.
- **STREET LIGHTING WAS ASKING FOR UP TO 70 OF 440 DRAW CALLS** and now asks for 2. §3.1.
- **THE CONCRETE CARRIAGEWAY IS 34.7% OF CHUNKS AND CAME IN DISTRICTS**, 14 code values from its
  own pavement. §4.
- **THE KERB WAS THE EARTH PLANE**, seen through a 0.180 m slot, on every street in the streamed
  city. §5.
- **EVERY WINDOW IN THE STREAMED CITY IS 220 cd/m² AND THE ORIGIN BLOCK'S ARE 7 TO 30.** L1.
- **A STREET POSE AT THE ARCH IS OVER THE TRIANGLE CEILING AND NO GATE GOES THERE.** L2.
- **FOUR TIMES IN ONE SESSION THE TWO CONTENT PATHS TURNED OUT TO BE TWO DIFFERENT CITIES** — the
  lamp radiance, the lamp population and the kerb, with `block.js` correct; and the road markings,
  with the streamed city correct. Every one was found by looking and none by a gate.
- **`distinct:midnight|dusk` HAD A MARGIN OF 0.00007 AGAINST AN INSTRUMENT THAT RESOLVES 0.00001**,
  and one street's worth of white paint spent it. L15.
