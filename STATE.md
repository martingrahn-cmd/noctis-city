# NOCTIS — STATE

*End of session 34. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`, 37 days of
uptime. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` WAS 2.45 AT THE FIRST COMMAND AND SAT BETWEEN 1.73 AND 2.45 FOR THE WHOLE
SESSION***, against CONTRACT §0.2's bar of **1.6**. **SO NO MILLISECOND IN THIS FILE IS
ADMISSIBLE AS AN ABSOLUTE**, and none is quoted as one. Everything below is a COUNT, a
DISTANCE, an AREA or a PIXEL STATISTIC — all load-independent, CONTRACT §9 rule 6's own
corollary — or a paired before/after taken through the same instrument on the same machine
within minutes of itself. `memory/noctis-quiet-bar.md` records that drift on this machine is
one-sided: a GREEN absolute under load is still a verdict and a RED one is not. **§8.2 has a
red absolute this session and it is NOT reported as a finding.**

---

## 0. THE FRAMES, IN ORDER, AND WHAT EACH ONE IS FOR

**This table is the session's report.** The gate table is §8 and it is not the verdict.

| # | frame | LOOK.md | did the city move toward it |
|---|---|---|---|
| 1 | `shot-out/s34-i1-weir-air-t0_5649-wet.png` → `s34-i1-weir-air-after-t0_5649-wet.png` | **§2, §4** | **YES, AND IT IS THE FRAME THIS SESSION EXISTS FOR.** Same pose, same instant, wet. The before is the operator's own report made visible: 44 100 m² of flat brown earth with a thin white arc on it, and rows of vehicles, lamp posts, market stalls and people standing on it. The after is a 210 m sunken basin with nothing standing in it and nothing crossing it. |
| 2 | `shot-out/s34-i1-air-before-t0_5649-wet.png` → `s34-i1-air-after-t0_5649-wet.png` | **§2** | **YES.** The same change from the reported spawn itself, 70 m up, at the district scale the complaint was made at. |
| 3 | `shot-out/s34-i7-blades-before-t0-wet.png` → `s34-i7-blades-after-t0-wet.png` | **§3** | **YES.** Along a street at midnight, wet. A small horizontal cyan plate on the left frontage becomes a tall vertical blade running down the elevation, with a second one beyond it. **Read with §6's re-phase caveat.** |
| 4 | `shot-out/s34-i5-veh-{before,after}-t0-wet.png` and `s34-i5-fleet-{before,after}-t0-wet.png` | **§4** | **PARTLY, AND IT IS A TRUE A/B — which almost nothing in this project can say.** The tails stop falling away. It is the smallest visible change of the four and it is recorded as such, and §5 says which two of item 5's four devices were not built. |

```
1  node tools/lookat.mjs --pos=-158.02,69.96,250.12 --target=-300,0,150 --fov=70 --t=0.5649
2  node tools/lookat.mjs --pos=-158.02,69.96,250.12 --target=-158,0,60  --fov=70 --t=0.5649
3  node tools/lookat.mjs --pos=5,1.74,52    --target=5,11,190   --fov=55 --t=0.0
4  node tools/lookat.mjs --pos=10.5,1.74,50 --target=5.6,0.9,64 --fov=40 --t=0.0
4  node tools/lookat.mjs --pos=5,1.74,52    --target=5,4,120    --fov=48 --t=0.0
```

All are `lookat` frames and therefore **frozen** — `?paused=1` stops the clock, so the traffic
and the crowd stand where they were seeded. STATE 33 §11 recorded that and it is still true.
Every "before" was taken by `git stash`ing the working tree and re-shooting the same pose
minutes later, so each pair is the same instrument on the same machine.

**FRAME 4 IS A TRUE A/B AND FRAME 3 IS NOT.** Item 5 is a change to a DATA TABLE that draws no
random numbers, so the fleet's positions, types, lanes and colours are identical on both
sides. Item 7 adds a draw to `signRng`, so its pair is two different signage populations —
the same caveat STATE 33 §0 had to give for the gait stream.

---

## 1. ITEM 1 — THE TRAFFIC WAS RUNNING ON THE WEIR, AND SIX READERS HAD SIX SPELLINGS

`b2ad696`. **Both of the brief's hypotheses are false and the measurement says what it is
instead.**

### 1.1 IT IS NOT AN EMISSION FAULT AND IT IS NOT LOW-DETAIL CHUNKS

The brief asked (1a) whether the registry carries `carriageway` and `pavement` claims that the
delivered census lacks, and (1b) whether low-detail chunks skip their ground surfaces.

```
  rastered claimed-vs-delivered, 16 m grid, 768 m square about the reported spawn
    cells with a carriageway or pavement claim                        711
    of those NOT delivered by city.surfaceAt                            0    0.0%
```

**Zero.** And (1b) was already answered in the source before it was asked: `citygen.js`'s
`groundRadius` comment records that *"every one of them emits pavement rectangles — all 66
lowDetail chunks and all 74 with zero buildings included — because the `ground` block in
`generateChunk` sits ABOVE its `if (!lowDetail)`"*. It still does.

**AND THE ROAD AT THE REPORTED SPAWN IS DRAWN.** `?spawn=-158.02,69.96,250.12` reports *"on
road at y 0.001"* and that is correct in both directions: `surfaceAt` returns `road`/0.001 and
the merged `city:ground` mesh carries **two triangles over that exact point**. The spawn is
about 100 m east of the hole, not in it.

### 1.2 IT IS THE WEIR, AND THE WEIR IS A DISTRICT

`landmarkAABB(weir)` is **210 × 210 m = 44 100 m², 2.69 chunks.** Rastered at 0.5 m, the union
of every landmark's ground claims is **69 658 m², and the weir is 63.3% of it — 4.28× the next
largest**, the condenser's stacked boxes at 10 302 m².

The road clip does its job: two north–south avenues (x = −384 and x = −256, 84 m and 44 m from
the basin's centre against its 105 m radius) and one east–west street (z = 128) lose 210 m
each. Over `citycheck`'s own 1 280 m region that is **1 050 m of 28 182 m of lattice
centreline, 3.73%, with no carriageway under it.** The fleet drove every metre of it.

### 1.3 SIX READERS OF "DOES A LANDMARK STAND HERE", AND THREE COULD NOT SEE THE BASIN

```
  traffic.js seed + recycle   no landmark test of any kind
  the street-lamp loop        river only — its own comment claims "the same predicate
                              the generator refuses buildings and props with"
  the bus shelter             landmarkOccluders + landmarkGroundBlockers    BOTH [] for a basin
  the road-patch loop         no test at all
  city.js placedClaims()      landmarkOccluders + landmarkGroundBlockers    BOTH [] for a basin
  streetlife walkBlockers     landmarkGroundBlockers                        [] for a basin
```

`landmarkGroundBlockers` returns `landmarkOccluders` **verbatim** for anything that is not a
viaduct, and `landmarkOccluders` returns `[]` for a `basin` — so three of the six were two
copies of one empty list. `landmarkBlocks()`, a seventh spelling that exists and is called by
nothing, disagrees with the registry twice over: it tests a CIRCLE where the registry claims
the AABB (34 636 m² against 44 100, 21% apart, all of it in the corners) and it counts the
viaduct's DECK segments, which a carriageway is explicitly allowed to sit under.

`landmarkGroundClaims()` is now the one list and `generateChunk` claims FROM it rather than
beside it. **Verified byte-identical over twelve chunks before and after the refactor** —
same carriageway, pavement, building, prop and landmark counts, same ground-rect counts.

```
  emitted boxes inside the weir's rim, by the line that emitted them
                                          before   after
    street lamps (columns + bowls)          34        0
    road patches, floating at y = 0.005      8        0
    a bus shelter and its lit panel          8        0
    TOTAL                                   50        0
```

**AND `placedClaims()` IS THE DELIVERED CENSUS.** The occupancy gate's second side has never
carried the weir or session 23's two viaduct end treatments, so the two halves of this
project's two-sided occupancy check have described two different worlds for eleven sessions.
It reported zero anyway, and that is the part worth knowing: nothing was ever placed inside
the weir for the census to catch **because the generator's half was right**. A two-sided check
whose second side is blind passes exactly as long as the first side never fails. CONTRACT §9
rule 7 says to assume both readers share an error; here they did not share it, and the
disagreement was still silent.

### 1.4 AND A PLANE ABOVE WATER HIDES WATER

```
  block:ground     mesh   y[-0.02, -0.02]   x[-4000, 4000]  z[-4000, 4000]
  landmark:weir    mesh   y[-9.40,  0.40]   x[ -405, -195]  z[  45,  255]
```

**9.40 m of the basin's 9.80 m — 96% of it — is drawn underneath an opaque 8 km plane.** What
a frame showed instead was flat earth with a thin white arc on it, which is the 0.42 m of
retaining ring standing proud — **and that arc is STATE §11's "unexplained ground arc near the
origin", carried as a known gap since session 8.** CONTRACT §9.1 already has the row (*geometry
authored and then drawn inside something else*); this is the largest instance in the project
by two orders of magnitude.

The plane is now cut on **the lathe's own 40-gon**, not on the AABB — a rectangular hole would
leave **9 464 m² of open void in the four corners**, which is the *"slot of nothing"*
`block.js`'s own earth comment already refuses for the river. Cost: **2 000 → 2 154 earth
triangles, +154.**

Three things had to follow it or the repair would be the same defect wearing the other hat:

- **the profile and the segment count moved to `citygen.js`**, so the cut edge and the drawn
  rim are the same polyline and cannot crack apart. Not one vertex moved;
- **`blockSurfaceAt` answers the basin's own floor, ledge and wall**, because that function's
  own comment says a second copy of its branches would be §9.1 — *"the api would answer one
  height and the geometry would stand at another"*;
- **`worldSurface`'s maximum now defers to `block` where this module has no quad of its own.**
  `GROUND_Y.earth` on that branch is `city.js` asserting the height of a plane `block.js`
  owns, and a maximum keeps the borrowed description whenever the real one goes DOWN. It went
  down by 9.4 m.

Delivered census, three eyes, with the weir now in it: **0 forbidden overlaps** over 4 125 /
4 298 / 4 254 claims.

---

## 2. ITEM 2 — THE VEHICLES WERE PUT PAST THE BAR, NOT DRIVEN PAST IT

`f298cc8`. **−14.675 m → 0, and the gate is GREEN on all four routes.**

### 2.1 THE ARITHMETIC THE GATE ACCUSES IS CORRECT

The gate says *"the painted bar and the braking point are one number and this is the distance
between them"*, which reads as a datum error. `toStop` is nose-to-bar, `STOP_LINE` is the
painted bar, and `stoplineprobe`'s second column settles it over 25 920 frames:

```
  past junction   min -15.000   median -2.968   max -0.009 m
  ORIGIN inside the junction box, over 18 208 settled frames:  0
```

**Not one vehicle is ever inside the box.** Every one of these bodies really is standing nine
metres past its own bar, exactly as reported. Session 25 killed the exit reservation on this
evidence and the brief repeats the instruction; spillback still has zero cases.

### 2.2 SO IT IS THE RECYCLER, AND THE PROBE'S OWN CLASSIFIER HID IT

`seed()` draws `s` uniformly over the ring and sets `cleared = null`, so
`(STOP_LINE + len/2) / 128` = **8.9% of every re-seat** lands between a stop line and the
junction it protects, holding no permission — a vehicle that has run a red it never saw. The
hold clamps it to zero speed and it stands there for the rest of an 18 s red, so **one bad
seed contributes up to a thousand frames to a statistic that only ever decreases**.

`stoplineprobe` calls a vehicle *"settled"* 2 s after its re-seat, and one of these is still
standing where it was dropped sixteen seconds later. **18 208 "settled" frames, 0 spillback.**
Its own header names the alternative in its first paragraph and its two-second cut-off argued
against it.

### 2.3 THEN TWO SMALLER THINGS, AND BOTH ARE THIS PROJECT'S OWN RECORDED FAILURE MODE

**−0.00027777775946535854 m.** The hold is a SPEED limit, `sqrt(2·a·toStop)`, and a speed
limit integrated discretely overshoots by the last step. `traffic.js` carries session 18's
paragraph about the other end of this same profile, and STATE 33 §5.2 records session 33
repeating it 400 lines away with `toDoor <= 0` on a bus. The **position** is now clamped, not
the speed.

**−1.8207657603852567e-13 m.** Sterbenz's lemma makes `nextJ − s` exact and `floor(s/128)·128`
exact, so the residue is not the subtraction: **the bar sits at a real number the double
lattice does not contain**, and the clearance at the nearest representable `s` is up to half an
ulp — 4.5e-13 m with the camera 3.5 km down its route. Against a floor of exactly zero that is
a RED gate at 0.18 picometres. CONTRACT §0 rule 6 says remove the noise and never widen the
line, so `stopLineClearanceM` snaps below `EPSILON·|s|`. **NO THRESHOLD MOVED**: `minStopLineM`
is 0 before and after.

### 2.4 DELIVERED

```
                                              before      after
  worstStopLineM                            -14.675 m     0     (raw 0, not a rounded zero)
  frames whose worst held vehicle is past    22 893 /     0 /
    its line                                  22 952       21 610
  past junction, median                      -2.968 m    -11.700 m   = 9.00 + len/2, the bar
  perfcheck minStopLineM, all four routes        RED       ABSENT FROM THE VIOLATION LIST
```

**ITEM 2d — THE YIELD IS NOT BROKEN.** The clamp only ever applies to a vehicle WITHOUT
permission, and permission is never revoked from a vehicle inside its own braking distance
(`toStop > brakeDist` guards the revoke), so nothing can be pulled backwards out of a junction
it has entered. `stoplineprobe` stubs no `streetlife`, so the yield path is not exercised
there; `citycheck`'s pedestrian block is what watches it and §8 has its state.

---

## 3. ITEM 3 — THE CONDITION IS ANCIENT ON ONE ROUTE AND NOT ON THE OTHER, AND THE BRIEF'S PREMISE IS A FROZEN STRING

**The brief says perfcheck "says, in its own output, that this assertion HAS NEVER RUN
BEFORE". It does say that. It says it every time it runs, and it is a fixed literal:**

```js
`... THIS ASSERTION HAS NEVER RUN BEFORE THIS SESSION: it read compressed PNG bytes and
 returned ~0.49 for every frame including an all-black one. Read budget.json $meanLuminance_s16.`
```

A failure message written in the present tense of the session that fixed the instrument, and
printed unchanged ever since. It is CONTRACT §9.1's *"a comment that claims a check"* family
with a HISTORY instead of a check — and it has now cost a session brief.

**AND THE FILE IT POINTS AT ANSWERS THE QUESTION.** `budget.json` → `$meanLuminance_s16`
records the decoded readings taken when the instrument was repaired, **in session 16**:

```
  measured session 16, PNG decoded      today (session 34)     floor
    downtown_dense   0.0707  RED          0.0638  RED          0.08
    night_rain       0.0851  green         0.0675  RED
    highway_speed    0.3771                0.3737
```

- **`downtown_dense` IS AN ANCIENT CONDITION.** It was 0.0093 under the floor at session 16
  with the same decoded instrument, seventeen sessions before the wet default. **It is not the
  wet street's fault and it never was.**
- **`night_rain` CROSSED.** It was 0.0851 — GREEN, 0.0051 clear — at session 16 and is 0.0675
  now. STATE 33 records 0.0639 at s32 and 0.0594 at s33, so **it fell between session 16 and
  session 32 and not in session 33**, which is the session that made the street wet.
  `night_rain` carries its own `wet: 0.85` and session 33 did not touch it.

**NOTHING WAS REPAIRED, WHICH IS WHAT THE BRIEF ASKED FOR.** And the statistic could not
resolve a repair anyway: `night_rain`'s three runs today read **[0.0609 0.0701 0.0675]**, a
spread of **0.0092 against a deficit of 0.0125** — the margin is 1.4× the spread, which is
CONTRACT §0 rule 6's own condition. `$meanLuminance_s16` already argues the number should be
per-route (*"one band applied to three routes whose legitimate delivered means span 5.3×"*)
and says building that is not the agent's call. It still is not.

**A worktree at session 30 was NOT built, and the substitution is deliberate:** session 16's
recorded decoded reading is strictly better evidence than re-running session 30 would be — it
is further back, it is in the repository, and it was taken by the same instrument.

---

## 4. ITEM 4 — LOOK.md, ITS OWN COMMIT, BEFORE ANY OF PART TWO

`52297a5`.

- **§5 gains the sentence the operator's two instructions need between them.** The DEVICES are
  the target — wet road, cold against warm, signs that light the air, angular vehicles,
  encrusted facades — because that is what a dense night metropolis in 2049 looks like. The
  QUOTATION is not. The test is §2's own: **anything here should be derivable from something
  the city already has.**
- **§3 gains haze**, and its neon and hologram bullets gain measurements (§6 below).
- **§4 gains the vehicle silhouette language**, with the two `highway_speed` gate reds beside
  it, because a target a gate already measures from the other side is evidence and not taste.
- **§8 gains the rule this file has now needed three times**: a defect is written there as a
  STATEMENT only if a number has been printed for it, and anything entered on a guess is
  written as a QUESTION.

---

## 5. ITEM 5 — EVERY VEHICLE ROSE TO A PEAK AND THEN FELL AWAY AT THE TAIL

`66c004d`. **5a and 5d delivered; 5b and 5c measured, argued and NOT BUILT.**

```
  wedge   0.74 0.74 1.06 1.28 1.28 1.28 1.20 1.04     peak mid, drops 0.24
  pod     0.98 0.98 1.36 1.66 1.66 1.66 1.56 1.34     peak mid, drops 0.32
  van     1.18 1.18 1.74 2.24 2.24 2.24 2.24 2.12     drops 0.12
  hauler  2.06 2.06 2.62 3.20 3.62 3.62 3.62 3.44     drops 0.18
  bus     1.80 1.98 3.20 3.20 3.20 3.20 3.14 2.92     drops 0.28
```

A bonnet, a cabin and a boot — **a 1990s saloon profile at seven scales**, which is LOOK.md
§4's fourth device (*"they share a vocabulary and differ only in scale"*) stated as a
measurement. Every curve is now **monotone from nose to tail**, so each body ends on a chopped
full-height face instead of a drawn-in boot, in three planes with two large steps. The wedge's
steps are 0.28 m on a 1.28 m body — 22% of its own height — because session 9's own note says
*"more sections is more steps is ribbing again"* and the answer to that is fewer and bigger.

**THE ROOF SPAN NEARLY CAUGHT IT.** `roofSpan` has a floor of 0.30 and the pod measured
0.3398, the tightest in the fleet. A FLAT roof is the shortest span there is, so the first
draft — pod and hauler as two-level slabs, which is the obvious reading of *"a closed shell"*
and *"slab-sided"* — was **reverted before it was measured**. Both are three-plane monotone
rakes instead. Delivered: `roofline over 36: span 0.3565, levels 3` and
`width over 15: span 0.1807`, both clear.

**WHAT WAS NOT BUILT, WITH THE ARITHMETIC THAT STOPPED IT.**

- **5b, ENCLOSE THE WHEELS.** `floorY` cannot simply fall. The arch crown is
  `floorY + ARCH_RISE` and it must clear the wheel, so with `ARCH_RISE` at a global 0.24 each
  type's floor is `wheelDiameter − 0.24`: **wedge 0.34 against a shipped 0.44, pod 0.28
  against 0.42, van 0.40 against 0.50, and hauler 0.66 against a shipped 0.66 — already at its
  limit.** Without making `ARCH_RISE` per-type there is 0.10–0.14 m of skirt available on
  three types and none at all on the largest, which is not "closing to the ground". Raising
  `ARCH_RISE` moves the sill, whose top `loftBody` derives from the highest arch crown, and
  that is a third thing in one session on geometry two gate floors read.
- **5c, LIGHT AS FORM.** `writeRow` puts every light row on the vehicle's CENTRELINE — the
  hauler's marker comment in `traffic.js` carries the whole derivation and the saturation
  measurement that goes with it — so making a light bar BE a leading edge means giving a light
  row a lateral offset, which is a change to the instanced light path and not to this table.

**AND THE TWO GATE REDS DID NOT BOTH GO THE RIGHT WAY.**

```
                          brief      s34        floor
  dark gap at the ground  73% of 59  68% of 62  75%    WORSE by 5 points
  non-monotone tone       63% of 59  66% of 62  75%    BETTER by 3 points
```

**NEITHER IS RESOLVED AND THE POPULATION IS NOT THE SAME POPULATION.** Items 1 and 2 both
changed where the fleet seeds, so these 62 vehicles are not the brief's 59. STATE 33 already
records this statistic as one that *"flaps on a re-phased population"*, and a run taken
mid-session read **86% and 83%** on the same 62 — that run is discarded because source was
being edited under a live dev server while it ran, which is its own finding (§11). **The
change that would actually move `ground contrast` is 5b, and 5b is the half that was not
built.**

---

## 6. ITEM 7 — NOT ONE SIGN IN THIS CITY COULD BE TALLER THAN IT WAS WIDE

`d7ccce4`. The brief said *"widen the size distribution hard"*. The measurement says the
widths were never the problem.

```
  over citycheck's own 10 x 10 region at seed 1337, headless
                              before     after
    signs                        692       710
    mountings                      5         5
    taller than wide (aspect>1)    0        85
    width  p50 / max          5.08 / 22.11   4.81 / 22.11 m
    height p50                  1.73      2.08 m
    height p90                  3.70      5.08 m
    height p99                  5.17     12.31 m
    height max                  5.98     14.89 m
    >= 3.5 m tall (one storey)    88       167
    >= 12 m tall (four storeys)    0         8
```

A rooftop sign already reached **22 m across**. What no sign could be was TALL: `aspect` is
drawn 0.24–0.62 for a shop sign and 0.28–0.42 for a building-scale one, so a vertical sign was
not rare here — **it was unreachable**, and the tallest object in the entire signage vocabulary
was 5.98 m against the four storeys LOOK.md §3 asks for. So this is an ASPECT band and not a
size band, and every bound on it is derived:

- **width 0.9–2.2 m** — for a projecting blade the narrow dimension IS the cantilever over the
  pavement, and `city.js`'s projecting mount already caps projection at 2.4 m with its own
  derivation, so 2.2 sits UNDER that cap and a blade is never silently clipped by a constant
  in another file;
- **aspect 2.6–7.0** — **the floor of this band is the ceiling of everything shipped**: the
  widest blade at the lowest aspect is 5.72 m against a delivered maximum sign height of
  5.98 m, so a blade is never mistakable for a fascia. The ceiling reaches 15.4 m against the
  12.2 m that four storeys at the shortest era's 3.05 m floor comes to;
- **clear 3.05 m** — the first-floor slab, which is what a blade is bolted to, clearing
  `HEAD_CLEAR_M` 2.10 by 0.95 m;
- **p 0.34 / 0.12** on a trading building and on one merely standing on a retail frontage —
  LOOK.md §5's test is that a device be derivable from something the city already has, and what
  a blade is derivable from is session 28's retail frontage roll. A street with no shops has no
  reason to carry one.

**RE-PHASE CAVEAT.** The blade roll and the hoisted aspect draw move `signRng`, so the
delivered signage is a DIFFERENT population and not the old one with blades added — which is
why the count moves 692 → 710 without a sign being added anywhere. It is `signRng`'s own
stream and nothing else reads it.

---

## 7. WHAT WAS NOT BUILT AT ALL, AND WHY

- **ITEM 6, FACADE CLUTTER. NOT STARTED.** It is the largest remaining Part Two item and it
  needs its own registry work — item 6a asks for the projecting pieces to be declared, and this
  session has just found that six readers of the landmark keep-out disagreed. Adding a new
  declared category on top of that in the same session is how the seventh spelling gets
  written.
- **ITEM 8, HAZE. NOT STARTED, AND THE BRIEF SAID DO IT LAST.** It was last and the session
  ended first. Its LOOK.md §3 bullet is written (§4 above) with the band arithmetic beside it,
  so the next session starts from the target rather than from the idea.
- **`gateaudit` was not run.** Same reason as STATE 33: it is the most expensive gate in the
  project and it reports `lookcheck`'s state one layer up. **It is recorded as a gate that did
  not run, not as a pass.**
- **No new instrument was committed** beyond two lines in `stoplineprobe` (§11). Five throwaway
  probes are in the scratchpad: the claimed-vs-delivered raster, the landmark-area union, the
  in-basin provenance census, the sign census, and the delivered-conflict check.

---

## 8. GATE STATE

Each gate run individually, because `npm run gates` is `&&`-joined and stops at the first red.

```
  parsecheck   GREEN   105 files, contract-clean
  faultcheck   GREEN   7 cases; quarantine surgical, frame survives all seven
  windcheck    GREEN
  inputcheck   GREEN
  gateaudit    NOT RUN — see §7
```

### 8.1 THE DRAW CALLS WENT DOWN, WHICH THE BRIEF ASKED TO BE CHECKED RATHER THAN ASSUMED

```
  route            s33 draws   s34 draws   s33 inst    s34 inst    s34 tris
  downtown_dense       333         332      152 521     152 474      1.40M
  highway_speed        432         431      201 866     201 761      1.58M
  night_rain           334         333      186 276     186 258      1.33M
  player               322         321      152 521     152 474      1.34M
```

**Every route is one draw call LOWER than session 33 and every instance count is slightly
lower.** Four items of content — a 210 m basin cut into an 8 km plane, 85 vertical blades, five
re-lofted vehicle profiles and a landmark refusal in four placement loops — cost **−1 draw**
and **−18 to −105 instances**. `highway_speed` stands at **431 of 440, nine spare**, up from
eight.

### 8.2 THE FRAME TIMES ARE NOT ADMISSIBLE THIS SESSION AND ARE NOT REPORTED AS A FINDING

`perfcheck` is RED at 17, and **twelve of those are milliseconds** — a GPU p95, a GPU
max and a frame interval on each of the four routes:

```
  route            cpu p95   wall p95   ceiling    gpu p95   s33 wall p95
  downtown_dense     1.00     22.90      12.5       30.90      11.90
  highway_speed      1.30     26.90      12.5       25.43      10.90
  night_rain         1.10     25.50      13.0       37.72      12.80
  player             0.90     23.70      12.5       33.11      11.80
```

**CPU p95 fell by a factor of nine and wall p95 roughly doubled, at IDENTICAL triangle,
instance and draw counts.** A scene that is the same size cannot get twice as slow from
content, so this is the machine or the instrument and not the city — and CONTRACT §0.2 plus
`memory/noctis-quiet-bar.md` are explicit that a RED absolute under `load1` 2.2 is **not a
verdict**. It is recorded and it is not attributed. **The GPU timer queries retired this time**
— `queries issued 2117 drained 2117 disjoint 0 starved 0` — which closes a STATE §11 gap
carried since session 8, and gives the next session on a quiet machine the attribution nobody
has ever had.

### 8.3 THE CONTENT REDS

```
  ✓ minStopLineM        ABSENT FROM THE VIOLATION LIST ON ALL FOUR ROUTES.  CLOSED. §2
  ✗ downtown_dense mean luminance 0.0638 (min 0.08)   ANCIENT — session 16 measured 0.0707. §3
  ✗ night_rain     mean luminance 0.0675 (min 0.08)   CROSSED between s16 and s32.        §3
  ✗ downtown_dense frame entropy 4.862 (min 5)        carried; s32 §7.1's argument stands
  ✓ night_rain     frame entropy 5.030 (min 5)        CLOSED, from 4.824 at s33. Nothing was
                     aimed at it. s32 §7.1 argued that tonal entropy falls when more of the
                     frame is one dark value; this session took 34 lamps, 8 patches and a bus
                     shelter out of a 44 100 m2 hole and put a lit 34 636 m2 concrete floor
                     into it, which is that argument running backwards. NOT ESTABLISHED —
                     it is one draw, and the same run's mean luminance moved 0.008 the other
                     way.
  ✗ highway_speed  dark gap at the ground 68% (75%)   moved 5 points the WRONG way, on a
                     re-phased population, and 5b is the change that addresses it.  §5
  ✗ highway_speed  tone profile 66% (75%)             moved 3 points the RIGHT way.  §5
```

### 8.4 `citycheck` — RED AT 1, AND THE OCCUPANCY IS THE ONE THAT MATTERED

```
  occupancy    5 465 generator claims over the region, 4 108 delivered (min 1200)
               0 / 0 forbidden overlaps over 53 forbidden pairs (max 0)
```

**Zero, with the weir's 44 100 m² claim newly present on BOTH sides for the first time** —
§1.3. The headless equivalent agreed at three separate eyes before the gate ran.

```
  clumping     CV 0.632 (min 0.6), 94% populated (min 55%)
  pedestrians  360 over 9 chunks, CV 1.0479 (min 0.7), 67% populated
  walkability  69 514 of 69 515 free cells reached
  crossings    3 structures over the region's crossings (min 3), above-deck spread 28.33 m
  ✗ saturation 5.08% of night-route pixels above 0.5 value (min 6.00%)
```

**`saturation` is the one red and it moved 0.90 points the WRONG way** — 5.98% at s33 → 5.08%
now. That is **about one run-to-run spread**: CONTRACT §0.1 records this statistic's spread as
**0.60–0.80 points**, so it is **NOT RESOLVED IN EITHER DIRECTION**, which is the same sentence
STATE 33 had to write when it moved 0.27 points the other way. A mechanism exists and is *not*
established: this session removed 34 lamp instances from inside the weir and re-phased the
whole signage population. It is one draw against a noisy statistic and it is recorded as that.

### 8.5 `lookcheck` — RED AT 3, ALL THREE CARRIED, AND NOT ONE BAND MOVED

```
  ✗ band:dusk        0.1392  (band [0.14, 0.18])   0.1393 at s33 — unmoved
  ✗ facadeAlbedo     3 clusters (min 4)            carried from the station, s31
  ✗ facadeNeighbours 0.211   (min 0.3)             carried from the station, s31
```

`band:midnight`, `band:dawn` and `band:noon` all passed. **`band:dawn` STAYED CLOSED** — session
33 closed it and this session's content did not reopen it. **NO LOOK BAND WENT RED THAT WAS
NOT RED BEFORE, so nothing was owed and no budget file was touched.** The brief reserved a
re-derivation for exactly this and the owed work is again zero — this time because the one
item that would have moved a band (item 8, haze) was not built.

---

## 9. THE BRIEF'S PREMISES, MEASURED

| # | the brief said | measured |
|---|---|---|
| — | draw calls stand at **432–434 of 440**, six to eight spare | **TRUE at 432**, and every item cost instances rather than draws — it is now **431, nine spare**. §8.1 |
| 1 | claims but no mesh is an **emission fault** | **NO FAULT.** 711 claimed cells, **0** undelivered. §1.1 |
| 1b | **low-detail chunks skip their ground surfaces** | **FALSE**, and `citygen.js`'s own `groundRadius` comment already said so. §1.1 |
| 1 | the road **exists logically** at the spawn but is not drawn | **IT IS DRAWN.** Two triangles over that exact point. The hole is 100 m west and it is the weir. §1.2 |
| 1d | it is the same defect as *"the pavement just disappears"* | **NO — that one was fixed in session 31** (`groundRadius`). This is a landmark keep-out with nothing put back into it. |
| 2 | one constant applied to **two different datums** | **FALSE. The arithmetic is correct** and the vehicles really are past their bars. The recycler puts them there. §2.1–2.2 |
| 2b | do **not** build an exit reservation | **CONFIRMED AGAIN.** 0 of 18 208 settled frames have a body inside a junction box. |
| 2c | this should go **to zero, not to "better"** | **ZERO.** Raw 0, and green on all four routes. §2.4 |
| 3 | the mean-luminance assertion **has never run before** | **FALSE — it is a frozen string.** `budget.json` records the decoded values from **session 16**. §3 |
| 3 | if it was already below 0.08, it is **not the wet street's fault** | **`downtown_dense` yes, `night_rain` no.** They are two different histories. §3 |
| 5 | both silhouette reds **go the right way** | **ONE DID.** Tone profile +3, ground gap −5, on a population that is not the brief's. §5 |
| 5e | per-class shape costs **zero extra draw calls** | **TRUE, and better**: −1 per route. §8.1 |
| 7 | citycheck reports **692 signs in 5 mountings** | **EXACT.** And the sharper fact is that **0 of the 692 were taller than wide**. §6 |

---

## 10. WHAT WENT ON THE BRANCH, AND ONE THING THAT WENT SOMEWHERE ELSE

Branch `claude/noctis-34-landmark-ground`, from `2b04ace`.

```
  66c004d  item 5 — the vehicle profiles stop falling away at the tail
  d7ccce4  item 7 — the blade, and 0 of 692 signs could be taller than wide
  52297a5  item 4 — LOOK.md
  f298cc8  item 2 — the stop line
  b2ad696  item 1 — one description of what a landmark takes
  2b04ace  <- session 33's merge, the branch point
```

**NO BUDGET FILE CHANGED.** `budget.json`, `look-budget.json`, `city-budget.json` and
`input-budget.json` are byte-identical to session 33. **No threshold moved, lowered, raised or
re-derived.** No look band went red that was not red before, so nothing was owed.

> ### ⚠ `b2ad696` WAS PUSHED TO `origin/main` BEFORE THE BRANCH EXISTED, AND IT IS STILL THERE.
>
> The brief says *"No merge to main — the operator decides that"*, and the session began on
> `main` because that is where session 33's merge left the checkout. Item 1 was committed and
> pushed there before the mistake was noticed. **The branch was then created at that same
> commit and everything since is on the branch; `origin/main` still carries `b2ad696` and
> nothing after it.** Undoing it needs a force-push to `main`, which was refused by this
> environment and is the operator's call in any case. **The repair is one command and it is
> his to run:**
>
> ```
> git push --force-with-lease origin 2b04ace:main
> ```

---

## 11. KNOWN GAPS CARRIED FORWARD

**Unchanged from s8–s33**: `stats().cutoffM` hard-codes 0.8, the headroom probe inert,
`saturation-peak.png` overwritten every run, `$fovYDrift`, `camera.setRouteAt(name, 1.0)` at
the sky, rain streaks near-invisible wide at night, `rain_spray` 0 static, **right turns
only**, sun shadows to ~170 m, the bake blind to elevated slabs, the PMREM hitch, the too-red
dawn horizon, one worker at queue depth one, the far half of the river handing back to the
night sky past ~300 m, grime authored, the near-field washboard on the water, the quay wall
inside the walkable mask, props absent from the walkability mask, the 3.5°–10.4° route camera
pitch, the frozen/running A/B, `materials.display` drawn by nothing, the hauler's marker row
buried inside its own body, the seeding fallback's untested placement, **a bus never turns**,
the origin block's absent occupancy registry, `facadeAlbedo` on its floor with zero spread,
the station's cores reading as an open frame, **nobody can climb the station**, the 0.10 m
margin at the core's outer face, `poseprobe`'s blindness to the origin block, the pavement's
missing kerb, `tools/city-budget.json:84`'s stale `$derivation_count`, the
`sign(adpillar) × prop(planter)` overlap that stops the fill raise, one merged building pool
breaching the triangle ceiling, the station's platform slab hiding the train,
`traffic.js:2346`'s claimed draw-call margin of one where it is eight, `minStraightness` and
`minArrivalsPerMinute` having no gate reader, the zero-second protected pedestrian phase, and
**buildings 19.4 m deep into a 52.3 m half-block with nothing built past 31 m** (STATE 33 §6 —
still the largest single change left, and still free in draws, triangles and instances).

**CLOSED THIS SESSION:**

- **"the unexplained ground arc near the origin"** — it is the weir's retaining ring, the
  0.42 m of a 9.80 m basin that stood above the earth plane. §1.4.
- **"GPU timer queries advertised and never retiring"** — they retired 2 117 of 2 117 with 0
  disjoint and 0 starved. §8.2.

**NEW THIS SESSION:**

- **A GATE MESSAGE FROZEN IN THE PRESENT TENSE OF THE SESSION THAT WROTE IT.** *"THIS
  ASSERTION HAS NEVER RUN BEFORE THIS SESSION"* has printed on every run since session 16 and
  it put a false premise into this session's brief. §3.
- **SEVEN SPELLINGS OF "DOES A LANDMARK STAND HERE", AND `landmarkBlocks()` IS AN EIGHTH WITH
  NO CALLERS.** Six are now one function; `landmarkBlocks` is still exported and still
  disagrees with the registry two ways. §1.3.
- **THE DELIVERED OCCUPANCY CENSUS HAD NEVER CARRIED THE WEIR OR THE VIADUCT'S END
  TREATMENTS**, and reported zero anyway for eleven sessions. §1.3.
- **A DOUBLE-PRECISION FLOOR OF EXACTLY ZERO IS UNSATISFIABLE AT KILOMETRE COORDINATES.** The
  bar is not representable; the clearance at the nearest representable position is half an ulp.
  Every other exact-zero bound in `budget.json` has the same exposure and none has been looked
  at. §2.3.
- **A BROWSER GATE RUN WHILE SOURCE IS BEING EDITED IS A DISCARDED RUN.** Vite's full reload
  destroys the execution context mid-route; the run dies with *"Execution context was
  destroyed"* and the routes that completed before it report numbers from a mixed tree. One
  perfcheck run was lost this way and its silhouette figures (86% / 83%) differ from the clean
  run's (68% / 66%) by more than any content change in this session. **Do not edit while a
  browser gate runs.**
- **THE BASIN IS WALKABLE IN THE MASK AND UNWALKABLE IN THE GEOMETRY.** `city.js` says *"the
  basin is a hole, not a wall: you walk down into it"* and skips it in the walkability mask —
  but the profile has a **7.8 m vertical drop** at r = 102. Nothing can walk down into it. Now
  that the hole is visible, that disagreement is reachable.
- **44 100 m² OF THE CITY IS AN EMPTY CONCRETE BOWL.** The weir now reads as a structure
  rather than as a bug, and it is still 2.69 chunks of nothing in a document whose §1 asks for
  lower Manhattan. Its own `LANDMARKS` comment calls it *"a stormwater basin and sunken
  park"*; there is no park in it. That is content, and it is the cheapest large frame in the
  city to improve now that you can see into it.
- **THE WEIR'S CLAIM IS THE AABB AND ITS GEOMETRY IS THE INSCRIBED CIRCLE**, so **9 464 m² —
  21% of the claim — is corner land that refuses buildings, roads and props for no reason
  anything draws. No lattice road is recoverable (both avenues pass inside the 105 m radius),
  but the frontage might be.
