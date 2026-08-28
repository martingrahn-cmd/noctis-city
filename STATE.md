# NOCTIS — STATE

*End of session 50. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`. The machine has
**NOT** rebooted since session 40 — 9 d 22 h of uptime at the last command, the same boot as
sessions 47, 48 and 49. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` RANGED 2.46 TO 3.41*** against CONTRACT §0.2's bar of **1.6**. **NO MILLISECOND IN THIS
FILE IS ADMISSIBLE IN EITHER DIRECTION** except a GREEN one, per §0.2. What is quoted is COUNTS,
draw calls, triangles, populations out of the pure generator, and the delivered conflict sweep.

---

## 0. WHETHER EACH ISLAND NOW READS AS USED TO ITS OWN EDGE

The brief: *"A block-scale programme puts a building-scale fixture set on a block-scale island, and
the remainder is what he sees."* **That is exactly what it was, and the cause is one table.**

```
  tools/shot-out/                     before  ->  after
  s50-church-{air,street}*.png        104.6 m of empty lawn with a nave at one edge
                                      -> a PATH crossing the island to the door, planting in
                                         CLUMPS, benches, a hedge
  s50-firestation-{air,street}*.png   an unbroken grey apron, one skip, two floods
                                      -> two bay rows the island's full width, hydrants and
                                         bollards on the apron, the appliance run left clear
  s50-school-{air,street}*.png        lawn, block, hard yard, nothing else
                                      -> a path across the island, trees clumped along the
                                         boundary, seating and bins
  s50-depot-{air,street}*.png         a grey apron with four vans on it
                                      -> three bay rows across the island, stacks and containers
                                         out to the fence line
  s50-industrial-{air,street}*.png    two sheds, a palisade, six containers in the middle
                                      -> containers to the FENCE LINE, 29.6 props a chunk
  s50-{hospital,market,port}-{air,street}*.png   the same change, measured in §1
```

`-before` is session 49's shipped build, re-photographed from the identical poses.

**THE CAUSE WAS NOT THE FIXTURES. IT WAS THAT TEN OF THE FIFTEEN LOW-DETAIL KINDS HAD NO FIXTURE
LAW AT ALL** — §1. The island-scale work in §2 is the smaller half of this session.

**AND THE COUNT IN THAT SENTENCE IS A CORRECTION.** STATE 49 §0 said *"THIRTEEN KINDS OF LOW-DETAIL
ISLAND WHERE SESSION 47 HAD FIVE AND SESSION 48 HAD SEVEN"*, and this session's brief inherited it.
`LOW_DETAIL_KINDS` is **fifteen** — seven before session 49 and eight added by it. Both my numbers
were wrong.

---

## 1. THE REAL DEFECT: TEN KINDS FELL THROUGH THE FLOOR SESSION 40 BUILT

`propCount` reads `deadZoneLaw = DEAD_ZONE[kind]`, and that table held **four rows**. Every kind
added after session 40 took the `96 · d³` fall-through — and a chunk is low-detail BECAUSE
`density < 0.34`, **which is the same field**, so that law cannot exceed `96 × 0.34³` = 3.8 objects
and rounds to ONE below `d = 0.216`.

**THE PARAGRAPH BESIDE `propCount` SAYS THIS, IN AS MANY WORDS, ABOUT THE PREVIOUS THREE KINDS.**
Session 40 wrote it after measuring that 84 of 131 `parking`, `lot` and `yard` chunks delivered
nothing at all. Sessions 48 and 49 then added ten more kinds and nobody re-read it. Measured over
twelve regions (seeds 1337–1348), props per chunk, **before**:

```
    WITH a floor              WITHOUT one
    yard          28.3        hospital       0.5     school       2.2
    park          27.8        firestation    1.0     carpark      3.0
    construction  17.7        recreation     1.2     industrial   4.1
    parking       15.5        depot          1.9     port         9.1
    lot           12.1        church         1.9     market      13.3
```

**A SEVEN- TO FIFTY-SIX-FOLD GAP, AND THE FOUR BOTTOM ROWS ARE EXACTLY THE FOUR ISLANDS SESSION
49'S OWN FRAMES SHOW AS BARE.** The frames and the generator agree, which is why this was one table
and not a look question.

**THE PALETTE WAS THE WORSE HALF.** The chain that picks what a low-detail island is furnished with
named four kinds and sent every other one to `['fence', 'stack', 'container', 'bollard']` — works
yard content. So a **CHURCHYARD AND A SCHOOL WERE FURNISHED WITH SHIPPING CONTAINERS**, and it went
unseen only because the count law was refusing all but one or two of them. Raising the floor alone
would have put thirty-four containers on a lawn.

Both are now tables keyed by the same `kind` — `DEAD_ZONE` and `LOW_DETAIL_PROPS`, side by side —
so a kind added later is missing from both in the same place.

**EVERY FLOOR IS `(104.6 / L)²` FOR A LENGTH `L` THAT BELONGS TO THE KIND**, which is the form the
three existing rows use, with the implied spacing printed beside it:

```
    recreation   L 36 m   floor  8    a playing field is empty by definition; furniture on the margin
    carpark      L 30 m   floor 12    the 30 m lighting square `parking` already derives
    hospital     L 30 m   floor 12    half a hospital site is visitors' parking
    school       L 26 m   floor 16    furniture rings the hard play area, it does not cross it
    firestation  L 24 m   floor 19    three appliance lengths — the turn a pump needs
    industrial   L 21 m   floor 24    `yard`'s own van apron, unchanged
    depot        L 21 m   floor 24    the same apron
    church       L 18 m   floor 34    a crown's spread plus a path's width
    market       L 17 m   floor 38    a stall pitch and its queue
    port         L 17 m   floor 38    a container is 12.2 m and needs a handler's width beside it
```

**THEY ARE DELIBERATELY UNEQUAL — 8 to 38 against the existing 9 to 24.** Levelling ten kinds onto
one number would flatten the prop-density spread `citycheck`'s clumping CV measures, and that
statistic had moved the right way for two sessions on VARIETY rather than fill. A church is not a
works yard and must not be furnished like one. **It cost clumping anyway — §5.1.**

After: **9.6 to 48.4 props per hectare across the fifteen kinds, and not one low-detail chunk in
twelve regions delivers zero.**

---

## 2. FIXTURES SIZED FROM THE ISLAND

Every fixture in the program branch took its extent from a constant — a flood ring at a flat 40 m,
a stack spread of 34, fourteen hospital bays from `-30 + i · 4.6`, ten depot marks from
`-24 + i · 5.4` — on an island that is 104.6 m square. `lay()` already covered the whole island;
nothing else did.

`halfU` and `halfV` are the island's own half-extents **on the axes `at(u, v)` uses**, so a fixture
written in `at` co-ordinates clamps against them without resolving `alongX` twice. That is the shape
of the defect that rotated session 48's stands ninety degrees off their own claim, and it is
CONTRACT §9's whole subject.

```
  layPath    two spines at the island's centre lines, cut round every solid on it and claimed
             `path` — which forbids `prop`, so the scatter that runs later puts its trees BESIDE
             the path without either routine knowing about the other. A churchyard was a lawn you
             could not walk across; the park has had this since session 19 and no other kind could
             reach it. Delivered `path` claims 24 -> 39.
  bayRows    the column count comes out of `2 · halfU / bayW` instead of a literal, and every mark
             is probed as `ground` — which forbids exactly `building`, `landmark` and `water` — so
             paint stops at what stands on the island, and a bay under a CANOPY is still a bay,
             which is what a covered depot stand is.
  floods     the ring is `halfU · 0.76`, not 40.
  stack      spreads to the fence line by default, not to 34.
```

**AND PLANTING THAT CLUMPS.** The condition read `kind === 'park'`, so the two other kinds whose
ground is grass got the uniform island scatter — and the paragraph beside it already says what that
looks like: *"trees scattered uniformly over an island read as an orchard."* The first church frame
at the floor alone is that sentence as a picture.

### 2.1 THE KERB LINE WAS BUILT, LOOKED AT, AND TAKEN OUT AGAIN

The brief asks for *"an apron, a kerb line, a gate"*. `kerbLine` laid four island-length painted
runs inset 4 m, segmented and probed exactly as `bayRows` is — about **fifty marks an island** — and
**it is invisible in both frames.** From 78 m a 0.16 m line is about one pixel; from the pavement it
is white paint on pale hardstanding, which is white on near-white.

**THE RULE THIS ITEM ACTUALLY YIELDS, AND IT IS WORTH MORE THAN THE FIXTURE WAS: on pale ground the
thing that reads is a change of SURFACE or an object with HEIGHT, not paint.** `bayRows` survives
because a bay is read as a RHYTHM of many marks rather than as one line, and the eye finds a repeat
where it cannot find an edge. The reasoning is in `citygen.js` where the helper used to be.

---

## 3. A SHED WAS DRAWN OUTSIDE ITS OWN CLAIM, THREE WAYS

The delivered sweep went **3 → 12** forbidden overlaps the moment §2 put a path and a container next
to a shed. Nothing about the shed changed; what changed is that something finally stood where it had
always been overhanging.

```
    parapet   w · 1.01 by d · 1.02 against a claim of exactly w by d — 0.22 m on a 44 m shed.
              THE THIRD COPING IN THIS PROJECT WIDER THAN THE THING IT COPES: the pond's was 2%
              (session 48) and the park centre's arrived through a yaw (session 49). Flush now.
    dock      a loading platform at d/2 + 0.9, 1.8 m deep, standing 1.8 m OUTSIDE the wall.
              `prop(container) × feature(shed:)` at 0.773 m². A platform outside the wall is
              CORRECT — that is what a loading dock is — so the claim grows to meet the draw.
    face      a ribbon window at d/2 + 0.04 and an appliance door at d/2 + 0.06.
              `path(ground:path) × feature(shed:)` at 0.364 m², eight of them. These CANNOT be
              inset: buried in an opaque body they would not be drawn at all. The claim grows here
              too, by the deepest of the three.
```

Both grows are **SYMMETRIC**. Which side `+v` is on after `alongX` is exactly the question §9 has
caught this file on three times, and a conservative claim costs a little placement freedom and
cannot be wrong. `SHED` is exported and read by both sides — the arrangement `LOW_WALL` has used
since session 47 — so there is one number per overhang rather than two.

**Delivered forbidden overlaps: 12 → 3, the three carried ones only.**

---

## 4. WHAT WAS NOT REACHED

**THE ARENA.** Session 49 left it first on its list and this session did not reach it either. It is
not hard any more and the next session should do it in half an hour: `shed` for the shell, `canopy`
for the roof, a `sportGround` plaza in front, one row in `LOW_DETAIL_KINDS`, `PROGRAM_KINDS`,
`PROGRAM`, `DEAD_ZONE` and `LOW_DETAIL_PROPS` each. What made this session run out was §1 turning
out to be a generator defect rather than a content item, and §3 falling out of it.

---

## 5. GATE STATE

Run individually, because `npm run gates` chains with `&&` and lookcheck's six-session-old red stops
everything after it. **That is still item 1 on STATE 49's list and it is still true.**

```
  parsecheck   GREEN   112 files, contract-clean. Unchanged from sessions 42-50.
  faultcheck   GREEN   7 cases.
  windcheck    GREEN   567 mesh names over 567 meshes (floor 400), 563 of 563 cull-eligible
                       decided, 0 wound backwards. IDENTICAL to sessions 48 and 49: this session
                       added not one mesh either.
  inputcheck   GREEN   keyboard, mouse and gamepad each deliver their own constant.
  lookcheck    RED at 3 — THE SAME THREE AS SESSIONS 45-50, AND NOT ONE BAND MOVED, for the SIXTH
                       session: band:midnight 0.0828, dusk 0.1412, dawn 0.3023, noon 0.4288,
                       crushed black 0.579%, distinct:midnight|dusk 0.02993 against 0.03000.
                       Byte-for-byte. L15 is owed a derivation for a sixth session.
  gateaudit    RED at 1, the carried control, naming exactly lookcheck's three.
  citycheck    RED at 3 — one FEWER than the pre-§3 run, and the same three as session 49.
                         3 delivered overlaps — the three carried. §3 took it 12 -> 3.
                         2 of 2720 sign quads inside a building, the same two
                         clumping CV 0.400 against 0.60 — WAS 0.528. §5.1
                         generator claims 13 128 (was 12 801), delivered 15 060 (was 14 788)
                         prop 3713 (was 3473), path 39 (was 24), canopy 704
                         bright reserve 6.70% against 6.00 — GREEN. §5.2
                         negative space 17.0% low-detail, 9 kinds (min 3)
                         prop placement 0 of 3471 props inside a building
                         walkability 54 304 of 54 438 — IDENTICAL to sessions 46-49. Four
                           sessions of new content and the city is walkable to the cell.
  perfcheck    RED at 15 — two more than session 49. Every count is flat:

                            draws  s49    tris   tris s49   instances   inst s49
    downtown_dense            317  317   1.95M     1.95M     244 137   242 818
    highway_speed             396  396   2.23M     2.23M     319 848   318 491
    night_rain                317  317   1.92M     1.92M     299 768   298 411
    player                    306  306   1.90M     1.90M     244 137   242 818

    roles  aircraft:1  traffic:96  stall:12  block:56  lamp:192  sign:16   — identical

                       **NOT ONE DRAW CALL AND NOT ONE TRIANGLE TO THREE FIGURES.** `highway_speed`
                       is 396 of 440 and 2.23 M of 2 360 000, as it was in sessions 48 and 49.
                       Instances are up 0.5% — that is the entire cost of §1 and §2.
```

**THE FIFTEEN SPLIT TEN / TWO / THREE.**

**TEN ARE FRAME TIME**, at `load1` 2.46–3.27 with a browser rendering. Not admissible in either
direction. **`highway_speed`'s is NOT among them for the THIRD session running**: wall p95
**12.10 ms against 12.5** with a three-run spread of 0.2, cpu p95 **10.80 against 12.00**. §0.2 says
a GREEN absolute under load IS a verdict.

**TWO ARE THE VEHICLE SILHOUETTE BARS**, which session 49 measured across four runs and found
straddling. This run reads `tone roughness 0.7675` — GREEN, against 0.2882 and 0.4786 on the same
statistic last session. Confirmed unstable; not acted on.

**THREE ARE NEW, THEY ARE MINE, AND THEY ARE §5.3.**

### 5.1 THE FIXTURE FLOORS COST 0.128 OF CLUMPING CV, AND THAT IS THE SAME TRADE SESSION 40 MADE

`clumping` CV **0.528 → 0.400** against a floor of 0.60. Filling ten previously-empty kinds narrows
the spread of objects-per-chunk by construction: `objects/chunk min 0 max 92` is unchanged in both
runs, so the tails did not move — the middle filled in.

**SESSION 40 PAID EXACTLY THIS FOR EXACTLY THIS FIX**, and LOOK.md §2 records it: *"IT COST THE
CLUMPING GATE AND THE NUMBER IS PRINTED RATHER THAN ARGUED AWAY"*, CV 0.566 → 0.430 when the first
three kinds got their floor. This is 0.128 against that 0.136, for ten kinds instead of three.

**NO THRESHOLD WAS MOVED** (CONTRACT §0 rule 5) and the unequal floors in §1 are the only mitigation
taken. The brief's *"clumping stays untouched"* is honoured as written — the gate is untouched — but
**the statistic moved the wrong way and this session is the reason.**

### 5.2 THE BRIGHT RESERVE, AND THE BRIEF WAS RIGHT NOT TO LET ME ACT ON ONE RUN

The pre-§3 `citycheck` run read **5.74%** against a 6.00 floor and failed. The post-§3 run read
**6.70%** and passed. The code between them changed a parapet by 1% and two claim boxes; neither
touches a pixel's brightness. The brief's *"the bright reserve spans 5.73–6.92 across a floor of
6.00 — do not act on one run"* is now confirmed by two runs a quarter of an hour apart, and **it was
not acted on.**

### 5.3 THE TWO NIGHT ROUTES GOT DARKER, AND IT IS THE FILL

Three new reds: `downtown_dense` mean luminance **0.0757** and entropy **4.817**, `night_rain` mean
luminance **0.0779**, all against a floor of 0.08 and 5. **Attributed, with the per-run spread on
both sides**, which is session 49 §5.1's own method:

```
                          session 49 per run              session 50 per run
    downtown_dense mean   0.0889  0.0778  0.0903          0.0689  0.0808  0.0757
    downtown_dense entropy 5.203  4.900   5.195           4.714   4.981   4.817
    night_rain mean       0.0801  0.0896  0.0819          0.0772  0.0779  0.0837
```

**The two sets barely overlap and the shift is one-directional** — every s50 downtown reading is at
or below every s49 one but for a single point. Session 49 called this floor *"a draw, not a
verdict"*, and on that session's numbers it was; on this session's it is a **shift of about 0.010
on `downtown_dense` and 0.005 on `night_rain`.**

**THE MECHANISM IS THE ONLY CONTENT CHANGE THERE IS, AND ITS DIRECTION IS RIGHT.** §1 added hundreds
of UNLIT DARK OBJECTS — containers, stacks, trees — to low-detail islands. At night an unlit mass
occludes lit ground and returns almost nothing, so mean luminance falls and the histogram narrows,
which is the entropy reading too.

**IT IS ALSO THE FIX, AND IT IS PHYSICAL RATHER THAN A THRESHOLD.** A worked yard with
twenty-four stacks on it **is lit** — that is why `floods()` exists — and the program kinds call it
with a hard-coded 2 or 3 whatever they now carry. Tying the flood count to the fixture count would
restore the luminance and be right about the world at the same time. §6.

---

## 6. WHAT TO DO FIRST NEXT TIME

1. **LIGHT THE FILL.** §5.3. `floods(n)` takes a constant 2–3 while §1 put up to 38 objects on the
   same island. Derive `n` from the fixture count the way §1 derives the fixture count from the
   island, and the two night routes get their luminance back for a physical reason. Watch the 96
   light slots: `perfcheck` reports `froxel 53/96` on `downtown_dense`, so there is room but not
   unlimited room.
2. **`npm run gates` STILL RUNS THREE GATES OF EIGHT.** Item 1 on STATE 49's list, unmoved.
3. **THE ARENA.** §4 — half an hour, and the recipe is written there.
4. **THE SCHOOL'S COURT MARKINGS RUN OFF THEIR OWN PAD** onto the lawn, in both the before and
   after frames, so it is older than this session. Visible in `s50-school-air*.png`.
5. **CLUMPING IS 0.400 AGAINST 0.60** and two sessions of gains are spent. It is not fixable by
   removing §1; the way back is variety — more KINDS, not more objects, which is what sessions 48
   and 49 demonstrated and what the arena would continue.
6. **SESSION 49'S UNATTRIBUTED GROUND-CONTRAST MOVEMENT** — 0.713 to 0.93, mechanism unknown, the
   obvious one ruled out by distance. Untouched this session.
7. **HOIST THE BUILDING CLAIMS IN `buildChunkBody`** — session 47's item 1, still what blocks facade
   clutter.
8. **L1, THE WINDOW**, and **L15, `minPairMSD`**, owed a derivation for a sixth session. Do not
   lower it to 0.029.
