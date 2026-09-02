# NOCTIS — STATE

*End of session 68. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`, 14 d 15 h of
uptime — the same boot as sessions 47–67. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` RAN 2.76–6.92 THROUGH THIS SESSION***, over CONTRACT §0.2's bar of 1.6 for the
eighth session running, with `mediaanalysisd-access` at 97.4% at the opening check. **No millisecond
below is a verdict.** Every number here is a count, a length, a saturation, a hue angle, a depth or
a pixel.

Branch `claude/noctis-68-sea-lamps-harbour`, off session 67's head, pushed as each item landed.

---
## 0. THE FRAME THE SESSION EXISTS TO ANSWER

**`tools/shot-out/sea-edge-s68blue2-t0_42-wet.png`** against
**`sea-edge-s68base-t0_42-wet.png`** — the city's edge on the north bank, looking down the river to
the sea, the same preset and the same hour session 67 used.

**THE OPEN SEA IS BLUE AND THE RIVER UNDER YOUR FEET IS BYTE-IDENTICAL.**

The water in that frame was found by DIFFERENCING against a full-strength control rather than by
drawing a box on a picture, so every number below is over water pixels and only water pixels:

```
  rows        px      before  sat / hue        after   sat / hue
  380-423   11 216    0.240 /  30              0.059 / 334     the open sea
  423-466   43 115    0.234 /  31              0.085 / 250     the open sea
  466-509   31 815    0.202 /  31              0.122 / 234     the open sea
  509-552   12 941    0.107 / 219              0.120 / 219     the estuary
  552-595   17 225    0.128 / 217              0.124 / 217
  638-681   26 525    0.115 / 215              0.110 / 215
  767-810   40 385    0.230 / 211              0.230 / 211     the river — IDENTICAL
  ---------------------------------------------------------------------------------
  Y IS UNCHANGED IN EVERY ROW: 79 76 77 79 68 62 58 52 46 43, before and after.
```

**The hue crosses from 30° to 234–250° exactly where the open sea begins, and nothing had to be told
where that was.** §1.

---
## 1. ITEM 1 — THE SEA, AND THE GATE IS THE FOOTPRINT AND NOT A DISTANCE

**THE DECISION IS THE OPERATOR'S AND IT IS RECORDED IN HIS NAME.** LOOK.md now has a §0.1, which is
the first use of §0's own licence — *"games lie deliberately, and the lies have names"*, one of the
three named being **a cast toward blue**, and §0's closing line was *"this project has the physical
number for all three and has never made the choice."* It has made one.

### 1a. ALL THREE ARMS MEASURED FIRST, AND TWO LOST ON EVIDENCE

```
  ROUGHNESS     REFUSED. Capping the lobe reverses the anti-aliasing STATE 67 §4
                defends: alpha² = alpha_base² + 2·residual exists because the
                unresolved slope variance has to go somewhere, and capping it
                puts it back into geometry the pixel cannot resolve. The far sea
                sparkles under any temporal accumulation. A repair that undoes a
                correct thing is not a repair.

  WATER COLOUR  REFUSED AS A GLOBAL. WATER_BODY has one value, one material and
                one mesh, so it takes the whole river and the weir's outlet pool
                inside the city with it. `touchesQuayWater` is unavoidably TRUE
                and the operator's own principle says that has overshot.
                TAKEN AS A GATED TERM — which is this arm's idea inside the
                first arm's gate. §1c.

  DISTANCE      TAKEN, but NOT AS A DISTANCE.
```

**`span` — THE PIXEL FOOTPRINT — IS ALREADY IN THE SHADER AND IT IS THE THING ITSELF.** The brief
asked for the ground fill to be attenuated *with distance from the city*, and a distance is a proxy
for what actually goes wrong. The lobe goes wide and the fill goes wrong **at the same footprint,
because they are the same event**: once the 2.4 m component is sub-pixel the roughness reaches
`WATER.cutoffRoughness` and the lobe spills below the horizon. So the new term reads the same two
numbers the roughness cutoff reads — `WATER.cutoffLo/Hi × λmax` = 1.92 to 4.80 m. **One derivation,
two readers.** A second threshold would have been §9.1 with a wavelength in it.

### 1b. AND THAT IS WHY THE HARBOUR KEPT ITS LIGHT FOR FREE

**PREMISE (iv) IS TRUE, AND THE MECHANISM IS NOT THE ONE THE BRIEF IMAGINED.** It asked whether an
arm exists that blues the open sea without bluing the quay water. One does, and it needs no test for
where the harbour is: **a fragment of basin thirty metres off the quay has a footprint of
centimetres**, reads 0, and is not touched by one bit. §0's table is the proof — the river at rows
767–810 is byte-identical.

### 1c. WHAT SHIPPED, AND THE LUMINANCE IS THE WHOLE SAFETY ARGUMENT

Two terms, both gated on `gNoctisSeaOpen`, both **rotating chromaticity at constant luminance**:

* the **reflected** term, `noctisReflected`, whose below-horizon share is `ATM.groundAlbedo`;
* the **body** colour, because `WATER_BODY` names its own opposite in its own comment — *"in an
  urban river that is silt rather than **the deep-ocean blue**"* — and session 66 put 30.4 km² of
  deep ocean in the same mesh and handed it the silt. **§9 row 74.** Measured with a §7.3 control at
  `[0.900, 0.020, 0.020]`: the open sea goes to saturation **0.654**, so the diffuse reaches the far
  water and reaches it hard. The reflected term alone could not have finished this.

**KEEPING Y IS THREE ARGUMENTS IN ONE LINE.** The amount of light returning from below the horizon
was never what was wrong with it; `exposure.js` meters the whole frame, so a term that moved the
sea's luminance would move every city pixel in any frame containing sea; and a luminance-preserving
rotation cannot blow a highlight or crush a shadow, so `clipWhite` and `crushBlack` cannot move on
its account.

**AND THE CITY DID NOT MOVE BY ONE BIT — MEASURED TWICE, THE SECOND TIME BECAUSE THE FIRST ANSWER
STOPPED BEING TRUE.** Session 67's own city-interior frame, the viaduct soffit pair, read 0 of
3 499 200 bytes when item 1 landed. At the END of the session it read **73 373**, so the claim was
re-tested rather than restated:

```
  the noise floor: three runs of one source        0 bytes   ← zero, so the 73 373 is real
  session 67  ->  session 68 with the water term OFF   73 373 bytes
  water term OFF  ->  water term ON                         0 bytes   ← item 1 is not in it
```

**Item 1 contributes exactly zero of it.** What does is §4 — and §4 says which line and how it was
found.

**Zero draws, zero triangles, zero attributes**, so `river:water`'s 4 094 triangles at
`frustumCulled = false` are untouched, as the brief required.

### 1d. AND A TERM THE SURVEY FOUND, THE CONTROL REFUTED, AND IT IS WORTH RECORDING

A reader of the shader argued that `noctisWallShare` substitutes **over half** the open sea's
specular with the mean radiance of a CITY FACADE, because the canyon field falls through to an
analytic default that describes a 15 m street with 26 m walls, and returns `vis ≈ 0.44`. The
arithmetic is right and the conclusion was wrong. **Forcing `noctisWallShare = 0` on water moves the
far sea's hue by ONE DEGREE**, 31 → 30, and its saturation from 0.228 to 0.203. The wall radiance
and the environment radiance are nearly the same colour at that geometry, so substituting one for
the other changes almost nothing.

**It was flagged UNVERIFIED and it was right to be.** CONTRACT §7.3's whole argument, and the reason
the control ran before the change.

---
## 2. ITEM 2 — THE LAMPS, AND BOTH OF THE BRIEF'S CANDIDATES ARE FALSE

**PREMISE (i) ASKED WHICH OF TWO MECHANISMS IT WAS. IT IS NEITHER.**

```
  (A) put()'s MIRROR       A street lamp's yaw is
                             rot = (axis === 'x' ? 0 : -90) + (side < 0 ? 180 : 0)
                           a CARDINAL LITERAL, pushed through `setMatrix`
                           DIRECTLY. `put()` never touched a street lamp, so
                           eight sessions of a mirrored yaw could not have
                           reached one.

  (B) THE BENT ROAD        `exitRoadZ` is 0 for |x| ≤ EXIT_ROAD.startM = 3 232
                           — "zero everywhere the lattice still exists" — and
                           the lamp stations are culled at that same ring. THE
                           ROAD NEVER BENDS UNDER A LAMP. Delivered heads
                           outside the city: 0.
```

**AND THE HEADINGS ARE RIGHT.** `tools/lampprobe.mjs`, new this session, off the two delivered
matrices: **95.11% of 368 delivered arm bearings sit in four cardinal 5° buckets** (98 / 85 / 85 /
82), the remainder being `yawJitter` straddling a bucket edge. An independent reader walking the
generator over a 7.2 km square found **32 119 of 32 146 arm tips over a drawn `ground:road`
rectangle — 99.92%.**

### 2a. WHAT IT ACTUALLY IS, AND IT IS SESSION 62's OWN SENTENCE IN THE OTHER POPULATION

Session 62 repaired **563 street lamps standing in farmland** and wrote: *"`cityExtentAt` is one
statement about where the city is, in every place that asks."*

**THE PROMENADE LAMPS WERE NEVER ASKED.** `promenadeLamps` is arithmetic on `riverBankStations`,
which runs the whole window, and the river runs to the world's rim. Measured out of the pure
generator over −4 400 to 4 400 at seed 1337:

```
  promenade lamp stations                                  412
  COLUMNS standing outside the ring, on open farmland       112    27.2%
    of those, columns standing IN THE SEA                    42
    the seabed under them                       −57 to −61 m
```

**Forty-two street lamps in fifty-five metres of open water**, and the operator's frame is what found
them: *"the arms hang out over the water and the fields on both sides instead of over the
carriageway."* There is no carriageway out there and no promenade either — the arm reaches 2.1 m
over a 6.4 m walk that stops at the ring, so past it the arm reaches over a field.

They read **`chunk.beyondCity`** now: the generator's own answer, already in that function, already
read by the kerbside stations twenty lines up and by the lattice that decides whether a road is
drawn at all. **Three readers, one statement**, and not one station inside the ring moves — which is
why this is a repair and not a content change.

### 2b. THE CLASS, WHICH THE BRIEF ASKED FOR BEFORE REPAIRING

The class is **not** "asymmetric features through `put()`" — no lamp goes through `put()`. It is
**populations laid along the river that never asked where the city is**, and there were two more:
`pushQuays` and `river.surfaceAt`, both in §4.

---
## 3. ITEM 3 — THE HARBOUR MOVES, AND THE YARD READS AS A YARD

### 3a. THE MOVER DOES NOT GENERALISE — PREMISE (ii) IS THE BRIEF'S FIRST TRUE ONE

`traffic.js` is splines and not pathfinding **by design**; its own header says *"there is no road
graph in this project"*. A vehicle's entire state is `{ axis, line, dir, lane, s }` and its position
is computed, never looked up:

```
  axis 0:   x = s,                     z = line · 128 + dir · off
  axis 1:   x = line · 128 − dir · off, z = s
```

A quay apron is an open rectangle at x 3 904–4 352, z −188 to −132. **It is not a chunk boundary and
it has no lanes at 128 m.** Generalising the mover would mean giving this project its first road
graph, for four vehicles. So it is the small fixed circuit the brief authorises, and says so.

### 3b. THE STACKS — THE OPERATOR'S WORD WAS "THIN" AND HE WAS RIGHT

A block was **one container deep**, seen end-on: three across, three up. From the fairway that reads
as a fence.

```
                  session 66      now      delivered
    blocks            6            8       4 columns × 2 rows
    bays (x)          1            3       39.6 m per block
    rows (z)          3            4       11.2 m per block
    high              3            4
    ───────────────────────────────────────────────────────
    boxes            54          384       4 608 triangles
```

**AND PREMISE (iii) IS CONSERVATIVE: A CONTAINER YARD DOES NOT COST ONE DRAW, IT COSTS NONE.** Every
box rides the chunk's own `:masses` InstancedMesh through `put()` — session 53's
5 936-buildings-in-one-draw mechanism. 4 608 triangles against 178 352 of headroom.

### 3c/3d. WHAT MOVES: ONE MESH, TWO DRAWS, AND NET ZERO FOR THE SESSION

A harbour launch under way in the fairway and **two straddle carriers on the apron, each with a
container slung inside its own portal**. Fifteen instances, 180 triangles, in one `river:moving`
mesh whose matrices are rewritten every frame off the shared clock.

**NO STATE.** Every position is a pure function of `time.now`, so nothing is seeded, saved or
stepped; a paused harness sees a still harbour **at a defined instant** rather than a frozen one at
an undefined one, and two runs at the same clock are identical. That is what keeps `lookcheck` and
`perfcheck` reproducible with a moving object in frame.

**IT COSTS 2 DRAWS — one to draw it and one for the shadow it casts — AND THE SESSION'S NET IS
ZERO**, because item 2 gave two back when the farmland promenade lamps went.

**SESSION 57's BARGES DO NOT MOVE AND THE BRIEF'S (d) RESTS ON A MOVER THAT DOES NOT EXIST.**
`riverCraft` is moored and static; `river.js` integrates nothing and reads no clock. The launch is
new, not a reuse.

### 3e. AND SESSION 57's OCCLUSION LESSON LANDED AGAIN, ON THIS QUAY, EXACTLY AS FORETOLD

The brief: *"A FRAME THAT DOES NOT SHOW ITS SUBJECT IS NOT EVIDENCE THE SUBJECT IS ABSENT — session
57 shot three empty river frames before finding its own barges, occluded by the quay wall from every
camera on the bank. That was this harbour's own quay and item 3 will meet it again."*

**It met it twice.**

1. The launch was berthed at `quayZ − 150`, which is **behind the `sea-harbour` camera** — a preset
   that stands off the quay looking back, which is session 57's lesson made permanent. It is at
   `quayZ − 60` now, a working fairway off a berth, in front of that camera.
2. **The moving mesh was given a bounding sphere computed from its build-time sentinel pose**, a
   hundred kilometres under the world, so `frustumCulled` threw the whole thing away — a mesh that
   existed, cost nothing and drew nothing, **and the draw count did not move to say so.** A silent
   zero, the same shape as session 45's sign pool shipping with 16 slots and 0 candidates. The
   sphere is the **circuit's** now — every position the plant can reach — so it culls correctly at
   every instant instead of at one. **§9 row 75.**

---
## 4. ITEM 4 — ONE PREDICATE FOR ONE PROPERTY, AND THE THIRD READER HAD NONE

**`crossingIsLanded` IS NOT THE GENERAL PREDICATE.** Session 67 wrote a second test for the same
property twenty lines away, sharing only the `isSeaAt` primitive:

```
    crossingIsLanded            pushQuays, as session 67 left it
    AND over BOTH banks         one bank, independently
    20 m setback                8 m setback
    any x                       lattice stations only
    gates a POINT               gates a 16 m SEGMENT, tested at ONE END
```

**The last row is a defect and not a style difference.** Two wall segments — north and south, x 3 504
to 3 520 — were drawn with their seaward ends in **4.52 m and 4.83 m of water**. Session 67 did not
remove those walls; it shortened them.

**AND A THIRD READER HAD NO TEST AT ALL.** `river.surfaceAt` answers *"what is a person standing
on"* from bare geometry, and past the last landed station it returned `parapet` and `walk` **over
open water — 644 band samples on the sea, the deepest under 56.80 m of it.** That is STATE 67 §6's
own sentence — *"a drawn deck and a walkable deck that disagree is §9.1's own arrangement"* —
reproduced one object along, in the session that wrote it.

`bankIsLanded` is the primitive now and all three compositions read it. **The two setbacks survive,
named**, because an abutment carrying a deck 20 m back and a quay wall retaining the fill behind its
own face ask about two different pieces of ground; one setback would be one number meaning two
things, which is the failure this is ending rather than repeating.

```
  wall segments drawn               1 038
  of those ending in open water          0     was 2
  promenade samples over open sea        0     was 644, deepest 56.80 m
```

---
## 5. THE BRIEF'S FOUR PREMISES

| | premise | verdict |
|---|---|---|
| (i) | the lamp headings are a constant error (the mirror) rather than one growing with curvature (the datum) | **FALSE, AND SO ARE BOTH ITS CANDIDATES.** The headings are right — 99.92% of arm tips over drawn tarmac, 95.11% of bearings in four cardinal buckets. It is a SURVIVAL defect in a second population that never asked where the city ends. §2 |
| (ii) | the city's vehicle mover does not generalise to a quay apron | **TRUE — the brief's first true premise in this session.** `traffic.js` is arithmetic on the 128 m lattice by design and an apron is not a chunk boundary. §3a |
| (iii) | a container yard costs one draw call and many instances | **TRUE AND CONSERVATIVE. It costs NONE.** 384 boxes ride the chunk's own `:masses` mesh. §3b |
| (iv) | an arm exists which blues the open sea without bluing the quay water | **TRUE, by a mechanism the brief did not name.** Not a distance and not a harbour test — the pixel footprint, which is the thing that causes the defect. The river is byte-identical. §1b |

---
## 6. THE COST

```
  highway_speed   401 draws of 440              IDENTICAL TO SESSION 67
                  2 451 648 tris of 2 630 000   IDENTICAL TO SESSION 67
                  347 833 instances, 73 materials
```

**THE BINDING CONSTRAINT DID NOT MOVE, AND THAT IS A RESULT RATHER THAN A COINCIDENCE.** Every
addition this session is at the harbour — x 3 904 to 4 352 — and every `perfcheck` route runs in the
city. The container yard's 4 608 triangles and the moving plant's 2 draws are real and are simply
not on the route that binds. **A session that added them to the city would have had 39 draws and
178 352 triangles to spend; this one spent none of the budget that is measured.**

**WHERE THE 2 DRAWS ARE PAID, MEASURED ON THE `sea-harbour` PRESET:**

```
  session 67's head                              87 draws
  after item 2 removed the farmland promenade    85 draws     -2
  after item 3 added river:moving                87 draws     +2   one to draw, one to shadow
  ────────────────────────────────────────────────────────────────
  NET FOR THE SESSION                             0
```

**THE SESSION'S SOURCE COST IS 913 LINES ADDED ACROSS 9 FILES.** `src/modules/river.js` +231 (the
moving plant, the landedness readers), `src/lib/citygen.js` +136 (`bankIsLanded`, the setbacks, the
yard and circuit constants), `src/modules/lights.js` +109 (the two gated rotations),
`src/modules/harness.js` +97 (`lampAimCensus`), `src/core/constants.js` +54 (`SEA_OPEN_TINT`),
`src/modules/city.js` +61, plus `tools/lampaimprobe.mjs`.

---
## 7. GATE STATE

**ALL EIGHT RAN. `perfcheck` COMPLETED THE WHOLE BATTERY FOR THE THIRD SESSION RUNNING.**

```
  gate            exit   verdict   seconds  load1 in     out
  parsecheck         0     GREEN       4.1      4.21    4.43
  faultcheck         0     GREEN      28.0      4.43    5.26
  lookcheck          1       RED      51.8      5.26    4.05    THE IDENTICAL THREE
  windcheck          0     GREEN      41.6      4.05    4.26
  inputcheck         0     GREEN      17.4      4.26    4.66
  gateaudit          1       RED      79.7      4.66    4.71    the carried `control failed`
  citycheck          1       RED     131.9      4.71    6.92    IDENTICAL TO SESSIONS 57-67
  perfcheck          1       RED    1088.3      6.92    3.52    AND IT FINISHED AGAIN

  4 of 8 RED — the same four as sessions 53-67. NO FIFTH RED.
```

**`citycheck` IS BYTE-IDENTICAL TO SESSIONS 57–67 ON EVERY COUNT** — clumping CV **0.393**, **5**
delivered forbidden overlaps, **2 of 2 647** signs inside a building, **1 004 of 284 918** bare
walkable samples. **The occupancy registry is untouched**, and the brief asked which of this
session's additions were treated as claims: **the container yard IS one** — a `containers` feature
declares its own box and always has, and widening the block widened the claim without creating an
overlap — and **the moving plant is NOT**, because a vehicle is not a claim, which is the same rule
`traffic.js` has always run under. Both are outside `citycheck`'s r ≤ 1 280 region, which is why the
counts do not move.

**`windcheck` IS GREEN**, which matters this session because 384 container boxes and 15 moving boxes
are all new hand-emitted geometry.

**EVERY `perfcheck` VIOLATION IS CARRIED OR IS A TIMING ABSOLUTE FROM A LOADED MACHINE**, at `load1`
**6.92** against CONTRACT §0.2's bar of **1.6** — the highest reading of any session so far. The
non-timing ones are the known straddles: `downtown_dense` frame entropy **4.887** and `night_rain`
**4.883** against a floor of 5 (session 66 read 4.940 and 4.848, session 67 read 4.910 and green),
and the vehicle silhouette bars at 55–74% against 75%. **No millisecond in this file is a verdict**
and none is quoted as one.

**`lookcheck`'s `distinct:midnight|dusk` READ 0.02845**, against 0.02844 in session 67 and session
65's noise band of 0.02836–0.02838 over 14 draws. §8 item 4.

---
## 8. WHAT TO DO FIRST NEXT TIME

**1. THE VIADUCT SOFFIT MOVED AND ITEM 4's `surfaceAt` GATING IS WHY — 73 373 BYTES, AND I DID NOT
FINISH RUNNING IT DOWN.** The isolation is exact and two-sided:

```
  the noise floor, three runs of one source              0 bytes
  session 67  ->  session 68 with surfaceAt UNGATED      0 bytes   ← byte-identical
  surfaceAt UNGATED  ->  surfaceAt GATED             73 373 bytes  ← the whole difference
```

So a landedness test on a quay 3.5 km away changes a frame under the viaduct at the origin, in all
256 of its 16×16 tiles by small amounts — which is the signature of a shared placement stream
moving, not of a local geometry change. **The most likely mechanism is that `surfaceAt` returning
`null` where it used to return a surface removes a candidate from the crowd's walkable set, and the
crowd is drawn from one sequence.** THAT IS A HYPOTHESIS AND NOT A MEASUREMENT. It should be
confirmed or killed before anything is built on it, because if it is right then **every future
change to a walkable predicate anywhere in the world reshuffles every pedestrian in the city**, and
that is a much bigger fact than this session's four items.

**2. THE SEA'S FARTHEST BAND IS NEARLY NEUTRAL AND THAT IS THE HAZE, NOT THE WATER.** §0's table:
rows 380–423 land at saturation 0.059, hue 334. A full-strength control puts the same band at the
same value, so the reflected and body terms are already at their ceiling there and the residual is
aerial perspective. If the operator wants that band bluer it is a haze question and belongs to
`atmosphere.js`, not to the water.

**3. `river:moving` HAS FIFTEEN INSTANCES AND NO GATE COUNTS THEM.** `harness.stats()` reports
`movingInstances` and nothing asserts on it. A mesh whose bounding sphere silently culled the whole
thing to zero once already this session (§3e, CONTRACT §9 row 75) is exactly the object that should
have a count with a floor under it. `citycheck`'s scene walk is where it would go.

**4. `distinct:midnight|dusk` HAS NOW READ 0.02836–0.02838 (s65), 0.02844 (s67) AND 0.02845 (s68).**
Session 65 established the noise band over 14 draws across three source states, and the last two
sessions both sit ABOVE it. The band was established before a 30.4 km² sea and before this session's
blue. **Re-measure it before anyone quotes either figure as a constant** — which is the mistake
session 65 caught three STATEs making.

**5. THE STRADDLE CARRIERS' LEGS ARE 0.42 m AND READ AS WIRE AT 500 m.** The silhouette is right and
the section is thin. A real machine's legs are nearer a metre. It is a one-constant change and it
was not made because the frame that judges it — `custom-carrier` — was shot at 80 m, not 500.
