# NOCTIS — STATE

*End of session 47. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`. The machine has
**NOT** rebooted since session 40 — 9 d 14 h of uptime at the last command against session 46's
9 d 2 h, the same boot. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` RANGED 1.84 TO 4.2 ACROSS THE SESSION*** against CONTRACT §0.2's bar of **1.6**, and the
first reading of the day — **1.84**, the lowest an agent has recorded while working — is because
most of this session is `emitcensus`, which has no browser in it. **NO MILLISECOND IN THIS FILE IS
ADMISSIBLE IN EITHER DIRECTION.** What is quoted is COUNTS, AREAS in square metres, and the
delivered conflict sweep, none of which drift.

---

## 0. THE TABLE — WHAT THE REGISTRY DID NOT KNOW ABOUT, AND WHAT IT KNOWS NOW

`emitcensus.mjs` finds emission sites by wrapping `Matrix4.prototype.clone` for the duration of a
build, so a site nobody knew about appears by itself. Session 24 built it, counted **80 sites — 9
undeclared, 51 mismatched, 20 matching** — and **the list was never worked.** Twenty-three sessions
later it is the instrument that answers the brief.

```
                                        s24      s47 start    s47 end
  emission sites in city.js              80         138         140
    UNDECLARED                            9           9           5
    MISMATCHED                           51          61          62
    MATCHING                             20          68          73

  delivered claims over the resident ring              11 247     15 127
  delivered forbidden overlaps                              2          3
  generator claims over citycheck's 10 x 10             9 215     13 332
```

**THE NINE THAT WERE UNDECLARED AT THE START OF THIS SESSION, AND WHAT EACH ONE IS:**

```
  site         what it emits                       boxes   undeclared   verdict now
  city:3145    a road MARKING                      13324    8302.9 m2   NOT A SOLID — §3
  city:3229    a road PATCH                          244    8194.7 m2   NOT A SOLID — §3
  city:5077    facade CLUTTER, the small units      3503     498.8 m2   MEASURED, NOT SHIPPED F1
  city:5284    a colonnade PIER                      352     290.1 m2   DECLARED  `prop`
  city:2536    a FLUSH sign fascia                   256      55.0 m2   COSTED, NOT SHIPPED F2
  city:5058    facade CLUTTER, the pier run         1547      32.9 m2   MEASURED, NOT SHIPPED F1
  city:2575    a projecting blade's BRACKET          233      28.9 m2   DECLARED  `sign`
  city:2565    a projecting sign BLADE               466      14.0 m2   DECLARED  `sign`
  city:5646    the ARCH's nine HANGERS                 9       1.1 m2   DECLARED  `deck`
```

**AND ONE THAT WAS NOT IN THAT LIST AT ALL**, because it is MISMATCHED rather than UNDECLARED and
nobody had read that half of the table: **`city:5641`, the arch's TRANSIT DECK — 997.93 m² with no
solid claim over it at any height, reaching 47.53 m past the nearest one.** It is the largest single
undeclared object this session found, it is 108.6 × 12.75 m of structure at 99 m, and **the brief's
own framing would have missed it.**

**FOUR OBJECT CLASSES ARE DECLARED THAT WERE NOT. WHAT THAT COST, IN THE ORDER IT HAPPENED:**

```
  declaration                      cost, measured BEFORE it was written      delivered sweep
  the arch's deck + hangers  deck        0 new forbidden pairs                      2 -> 2
  the colonnade pier         prop        0    (as `building` it is 349)             2 -> 2
  the blade + its bracket    sign        6 over 3 objects                           2 -> 3
  the courtyard boundary     feature     0    (after two of its own were found)     3 -> 3
```

---

## 1. THE LIST

### REPAIRED — each on its own revertible commit

| # | what it was | what happened |
|---|---|---|
| **R1** | **The arch has been carrying a transit deck that nothing knew about.** `LANDMARKS` calls it *"a 96 m parabolic arch carrying the transit deck across the arterial"*, `city.js` builds that deck, and `landmarkOccluders`'s arch case returned two legs. | Claimed `deck` — conflicts with `building` alone on `[y0, y1]`, so a 150 m tower under it is refused and a 40 m one is not. Session 23's viaduct end mass, one landmark over. |
| **R2** | **And the deck box leaked into two GROUND readers.** `landmarkGroundBlockers` splits on `kind === 'viaduct'` where the question is `o.deck` — a KIND standing in for a PROPERTY — and `landmarkBlocks` tested neither. | Without it the arch's soffit walls off the arterial in the walkability flood fill and in every prop test that reads those lists. Latent for the viaduct's 352 deck segments as well. |
| **R3** | **352 colonnade piers stand on a footway and nothing knew they were there.** `buildGroundFloor`'s own comment says *"a colonnade's piers are ALREADY 0.45 to 1.35 m proud of the wall"* — and proud of the wall is outside the building's claim. | Claimed `prop`. **The category is the whole cost**: as `building` 349 new pairs, 342 of them `pavement`; as `prop`, 0. §2.1 |
| **R4** | **`pushSign` pushes geometry and a tint and no claim**, so all five wall mountings have been invisible to the registry since signs existed. | The projecting BLADE and its BRACKET are one claim, `sign`. The first sign in `city.js` to claim anything. §2.2 |
| **R5** | **The courtyards get a boundary, a way in and a marked bay** — the operator's six-session complaint, answered with content and not with a density knob. | 3 556 wall segments = **10 668 m of boundary, 41.8% of the built island edge**, laid only where the registry says a building is not. 161 gate segments = 483 m of opening. §5 |
| **R6** | The courtyard wall took `yaw()` like every other scattered thing in the file, and **196 `feature(edge:wall) × pavement(ground:walk)` overlaps** said it should not. | A wall CONTINUING a frontage is square, because the buildings it joins are on the lot line. `boundaryRun`'s own `yawBulge` note arriving by the door it was written to close. |
| **R7** | The low wall's coping is drawn **2% longer than its segment** and that 1.02 was a literal in `city.js` while the claim was made in `citygen.js`. A uniform **0.013 m² = 0.03 × 0.44 m** at every segment end. | `LOW_WALL` — three numbers, exported, two readers. CONTRACT §9.1, found by a claim that had to cover a box somebody else drew. |
| **R8** | `emitcensus`'s four lamp candidate rows re-claimed objects session 46 had already declared, reporting **333 `prop(lamp:column)` self-collisions as a cost**. | `done: 's46'` skips the sweep and keeps the number. Two rows gained the category they actually want beside the one they had, so the file's own *"a wrong category makes a free repair look expensive"* is checkable rather than asserted. §2.1 |

### FOUND, MEASURED, NOT SHIPPED — the list the next session starts from

**F1. FACADE CLUTTER CANNOT BE DECLARED UNTIL THE BUILDING CLAIMS MOVE EARLIER, AND THE NUMBER IS
137.** `CLUTTER.standoffM` is the whole point of `buildFacadeClutter` — a cabinet BOLTED TO a wall
is proud of it — so all **5 050 boxes over the resident ring carry 529.5 m² with no solid claim over
them**, reaching 2.34 m past the nearest and standing 27.18 m above its top. Declared as `canopy`
(the category this file already chose for the fire escape) the delivered sweep goes **3 → 145**:

```
  142   canopy(facade:clutter) x building(bld)   0.004 to 0.081 m2
  137   after clamping the claim's inner face to the elevation plane, which is what the fire
        escape's own comment says it does
  137   after refusing any box that overlaps a `building` claim in `placed`
        — THE REFUSAL FIRED ZERO TIMES, and that is the finding
```

**The refusal cannot fire because no building claim is in `placed` when `buildFacadeClutter` runs.**
It is session 30's ordering defect exactly — *"these claims used to be pushed at the END of this
function, below every generator that reads `placed`"* — with the buildings instead of the ground
rectangles. **The 137 are two yawed AABBs' corner slop at a few centimetres of standoff, not units
inside masonry**, and until the building claims are hoisted there is no way to tell those apart from
inside that function. Reverted rather than shipped: 137 reds that all trace to one un-diagnosed
ordering question would bury the three real ones.

**F2. THE FLUSH FASCIA COSTS 7, ALL `building(bld)`, AND THEY ARE THE SAME DEFECT `citycheck`
ALREADY CARRIES.** 256 boxes, 54.77 m² undeclared, reaching 12.63 m past the nearest claim. As
`sign` it is 7 new pairs over 7 distinct objects, every one a panel intersecting a building — which
is `sceneWalk`'s carried *"2 of 2720 delivered sign quads are inside a building"* found by a
different test over a different population. Not shipped: it is the same finding twice and the second
copy costs seven gate reds. It belongs with F1, which shares its cause.

**F3. THE PAINT IS CORRECTLY UNDECLARED AND THE PATCH IS NOT CORRECTLY CLIPPED.** §3.

**F4. `landmarkOccluders` IS STILL THREE QUESTIONS IN ONE LIST.** R2 fixed two readers by testing
`o.deck`; the deeper problem is that this function answers *"what blocks a ray to the sky"* and four
callers ask it three other questions. LOOK.md and STATE 34 §11 have carried it since session 34, and
R2 is the third patch on it. **What is owed is a second list, not a fourth filter.**

**F5. `emitcensus` DOES NOT COVER `block.js` OR `river.js`.** Its own header says so — *"they own
their own meshes and are not in this census's scope"* — and it reports **2 070 matrices** falling
back to the unit box for exactly that reason. **Two whole modules have never been enumerated**, and
one of them is the origin block, the content path session 45 found five separate defects in. The
brief's question — *"what else is the registry blind to"* — is answered for one module of three.

**F6. TWO CATEGORIES IN THE CONFLICT TABLE HAVE ZERO DELIVERED CLAIMS: `water` AND `block`.** Printed
by `emitcensus` every run since session 24 and never acted on. `block` is `BLOCK_KEEPOUT`, which the
generator claims and the delivered census does not; `water` is the river. Both are authored, both
are large, and neither is in the list `citycheck` sweeps.

**CARRIED, UNTOUCHED:** everything on session 45's list of 28 and session 46's eight — the 220 cd/m²
window (L1), the arch pose over the triangle ceiling (L2), the blend mode (L4), `minPairMSD` (L15,
owed a derivation for a third session), the non-reproducing poses (L16), wetness above ground (L18),
the 0.050 m gap between stop bar and zebra (s46 F1), `perfcheck`'s `player` route that never
registers the player module, `clumping` CV 0.443 against 0.60 (seventh session, red by instruction),
the two sign quads inside a building, and the vehicle tone-profile bar (fourteenth session).

---

## 2. THE FOUR DECLARATIONS

### 2.1 THE CATEGORY IS THE COST, AND `emitcensus` NOW SAYS SO ON ONE ROW TWICE

Session 24 wrote the warning into the file — *"a wrong category makes a free repair look expensive
(`prop` for a road marking would collide with every carriageway in the city)"* — and left it as
prose. The colonnade pier is that sentence with a number on both sides, on the same 352 boxes:

```
  as `building`   349 new forbidden pairs   342 of them pavement(ground:walk), 7 ground
  as `prop`         0
```

`occupancy.js` explains it in one line: *"a pavement carries people AND street furniture, so
`pavement × prop` is absent — that pair is the whole point of a pavement."* **A pier is street
furniture that happens to hold a building up.** Both rows are in the candidate table now, so the
next reader gets the pair rather than the sentence.

### 2.2 THE BLADE FOUND TWO COLLISIONS AND REFUSED FOURTEEN PILLARS

`canopy` for the blade costs 0 and `sign` costs 6, and **`sign` is the one that ships**, because
`canopy` conflicts with solids only and would let a blade pass straight through an advertising
pillar and report nothing. The delivered sweep, before and after:

```
  prop(colonnade:pier) x sign(sign:blade)   0.223 m2   NEW — as old as the mountings, and
                                                       invisible until R3 gave the pier a claim
                                                       an hour earlier
  sign(sign:blade) x sign(pylon)            0.063 m2   NEW — as old as the mountings
  sign(adpillar) x prop(planter)            0.086 m2   carried from session 45, untouched
  sign(adpillar) x prop(tree)               0.013 m2   GONE
```

**The fourth one vanished because a claim is live in the GENERATOR and not only in the census.** The
advertising pillar's `hitsClaim` reads `placed`, `sign × sign` is forbidden, and a pillar standing
under a blade is now refused: **delivered pillar boxes 316 → 302, total instanced boxes 245 783 →
245 713.** Fourteen pillars, and the tree one of them was colliding with went with them.

That is the shape of the whole item. **A claim is not a report, it is a refusal**, and every one of
these four changes what the generator builds as well as what the census can see.

---

## 3. THE PAINT IS CORRECTLY UNDECLARED, AND THE PATCH IS NOT CORRECTLY CLIPPED

The two biggest undeclared areas in the table are the road markings (8 302.9 m²) and the road patches
(8 194.7 m²), and **neither should be declared.** `emitcensus`'s cost sweep is the argument:

```
  a road MARKING as `prop`   8000 new forbidden pairs   7889 of them carriageway(ground:road)
  a road PATCH   as `prop`    460                        446 of them carriageway(ground:road)
```

Paint is 4 mm thick and a patch is 10 mm, and both lie ON the carriageway that already claims that
ground. They read as undeclared because the census's SOLID filter deliberately excludes
`carriageway` — *"a pavement under a lamp column is the ground it stands on and is not a declaration
of the lamp"* — and for paint that exclusion is the right answer rather than a gap.

**WHAT IS ACTUALLY WRONG THERE IS THE EXTENT, WHICH IS THE OTHER HALF OF THE BRIEF'S OWN ITEM.**
`emitcensus`'s last section, over the 25 NEAR chunks that draw a road surface:

```
  road patches   244 emitted,  49 in the near ring,   2 reach off every delivered carriageway
                 0 lie wholly off one, worst 32.0% of a patch
  road markings  13 324 emitted, 2 662 in the near ring, 26 reach off, worst 59.4% of a mark
  `citygen.js` clips a marking to the delivered carriageway (`onRoad`, at HALF the mark's own
  half-extents); NOTHING CLIPS A PATCH AT ALL.
```

One cause each: `onRoad` tests at half the mark's extent, so a mark up to 59.4% overhanging is
accepted; and `onCarriageway(px, along)` tests the patch's CENTRE while the patch is 3–5 m by
5–12.5 m. **Not repaired** — both are one-line changes whose effect is a population (marks and
patches disappear) and want a frame beside them, and the session's time went where the brief put it.

---

## 4. THE RULE THIS SESSION ENDS WITH

The brief said to expect the overlap count to rise and to treat that as the instrument starting to
work. It is right, and it needs one qualification that cost an hour to learn:

> **A rising overlap count is the instrument working when the new pairs name DIFFERENT objects, and
> it is the instrument miscalibrated when they all name the same cause.** The blade's two are two
> objects in two places, as old as the mountings. The clutter's 137 are one ordering question
> reported 137 times, and shipping them would have buried the two.

---

## 5. THE COURTYARDS

Session 46 measured the operator's six-session complaint properly for the first time and the answer
was not the one anybody expected: **bare ground is 0.00% of the frame he was standing in**,
`coreGround` is **16.19%** and the largest single ground owner in it, and a `built` island already
carries **41.8 props per hectare against a yard's 29**. The courtyards are not under-scattered. They
are UNBOUNDED. The column that separates them from every other ground kind is FIXTURES:

```
  kind          props   feats    objects / ha of open ground
  park             45     278        275.1
  lot              49     495        202.4
  parking          82     894        178.2
  construction     54     518        174.6
  yard             85     410        150.8
  built          1898      55         43.8      <- 0.7 fixtures per chunk
```

**A yard is a yard because it has a wall round it, a gate, and something being done on it.**
`DEAD_ZONE.core`'s own comment already says *"a block interior IS a service yard"*, so the boundary
is the yard's boundary at the yard's own height (`palisadeHeight`, 2.20 m), drawn as masonry rather
than palisade because it faces a street rather than a compound.

**WHERE IT RUNS IS DECIDED BY THE REGISTRY AND NOT BY A RULE**, which is the part worth carrying.
Segments are laid along all four island edges and every one is offered to `reg.conflict` first, so
the wall appears exactly where a building does NOT — **which is the frontage gap**. Session 39
measured those gaps and named them: 267 at seed 1337, 15.0 m mean, 4 001 m, 11.5% of the island
edge, and **188 of them mid-side, *"where the walk goes on afterwards, which are the ones that read
as a hole in a street wall"***. This is that hole, closed, without one new building and without
touching the fill law LOOK.md §2 spends four bullets choosing.

```
  over 10 x 10 at seed 1337, 61 built chunks
    wall segments delivered   3 556   = 10 668 m    41.8% of the built island edge
    gate segments withheld      161   =    483 m
    loading-bay marks         1 636
```

The way in is **cut from the longest contiguous run** and not rolled: a gate rolled onto a random
side lands inside a building four times in five and is a way in nobody can see. Contiguity is in the
segment index, so a run broken by a building is two runs and a gate is never cut across masonry.

**COSTS: ZERO DRAW CALLS ON ALL SIX PAIRED FRAMES** — 114 / 156 / 138 before and after — because an
`edge` feature rides in the chunk's existing mass mesh and a `built` chunk always has one. Triangles
+0.017 to +0.053 M per frame. Delivered forbidden overlaps 3 → 3. Walkability **54 304 of 54 438**
free cells reached, identical to session 46: **the wall closed the street and blocked nobody.**

`s47-wall-{before,after}-court.png` is the pair to look at — a gap between two buildings opening
straight onto the street, with a van and two bins on pale ground behind it, closed — and
`s47-wall-{before,after}-front.png` is the same thing from the pavement, where the street gains a
second wall.

---

## 6. GATE STATE

Run individually and ALONE, which is STATE 45 §6.3's finding about this machine.

```
  parsecheck   GREEN   112 files, contract-clean. Unchanged from sessions 42-47: this session
                       added no file, and its one scratchpad probe is a shot tool.
  windcheck    GREEN   567 mesh names over 567 meshes (floor 400), 563 of 563 cull-eligible
                       decided, 0 wound backwards, 0 unmeasured. The 3 556 wall segments are
                       boxes in a mesh that already existed and are in that count.
  faultcheck   GREEN   7 cases — quarantine surgical, the frame survives every one.
  inputcheck   GREEN   keyboard, mouse and gamepad each deliver their own constant.
  lookcheck    RED at 3 — THE SAME THREE AS SESSIONS 45-47, and no band moved by more than the
                       instrument's own resolution:
                         band:midnight 0.0828 (s46 0.0829)   band:dusk 0.1412 (0.1412)
                         band:dawn     0.3023 (0.3026)       band:noon 0.4288 (0.4286)
                         crushed black 0.579% (0.577%)       102 local lights at both lamps-on times
                         distinct:midnight|dusk 0.02993 against 0.03000 — L15, third session owed
                       `facadeAlbedo` and `facadeNeighbours` at dusk are the other two, both
                       carried and both about the origin block's own facade.
  citycheck    RED at 3 — THE SAME THREE as sessions 40-47, and `city arrived` did not time out
                       (15 976 ms at load1 4.16, against session 46's 20 031 ms at 12.38 — the
                       check the brief asked for).
                         clumping CV 0.443 against 0.60, seventh session, untouched by instruction
                         2 of 2720 sign quads inside a building, the same two
                         3 delivered overlaps (was 2) — §2.2 names all four, two of them new,
                           one of them gone
                         generator claims 9 215 -> 13 332, delivered 11 247 -> 15 127
                         bright reserve 6.81% against 6.00 — the most margin this floor has had
                         walkability 54 304 of 54 438 free cells, IDENTICAL to session 46
                         viaduct 23 piers, 2 hammerhead, 7 nudged, 0 blocked, 0 legs on a
                           carriageway, worst |x| inside the block 9.94 m against 10.5
  perfcheck    RED at 14 — one more than session 46, and it is a CARRIED content bar that
                       changed sides rather than anything new. Every count, against session 46:

                            draws  s46     tris   tris s46   instances   inst s46   froxel  s46
    downtown_dense            317  318    1.95M     1.91M     244 553   238 336      44     43
    highway_speed             396  396    2.23M     2.18M     320 429   312 410      79     79
    night_rain                317  317    1.92M     1.88M     300 281   292 666      46     49
    player                    306  307    1.90M     1.86M     244 553   238 336      41     45

    roles  aircraft:1  traffic:96  stall:12  block:56  lamp:192  sign:16   — identical

                       **`highway_speed` IS 396 OF 440, UNCHANGED — the courtyard boundary cost
                       ZERO draw calls on every route** and two routes went DOWN by one, which is
                       the fourteen pillars §2.2's blade claim refused. Triangles +0.04 to +0.05 M
                       on every route; `highway_speed` reads 2.23 M against a 2 360 000 ceiling,
                       **5.5% spare**. Instances +6 200 to +8 000, which is the wall.
  gateaudit    RED at 1, THE SAME ONE AS SESSIONS 45-47 — the carried control, "the unperturbed
                       frames do not pass their own gate", naming exactly lookcheck's three.
                       Everything else green: `ok control — every assertion ran`, perfcheck
                       --falsify 74/74 at 100% coverage over 72 failure sites, citycheck 61/61 at
                       100% over 61, inputcheck 13/13 at 100% over 12 with its good fixture clean,
                       and both control sweeps.
```

**THE FOURTEEN PERFCHECK REDS SPLIT ELEVEN / ONE / TWO.**

**ELEVEN ARE FRAME TIME** — three cpu p95, four wall p95, three "frames over 33 ms" and the headroom
probe, at `load1` 3.5–4.2 with a browser rendering. Not admissible in either direction. The closest
to a reading is `highway_speed` wall p95 **12.90 against 12.5**, with a three-run spread of **0.1 ms**
— the tightest spread this route has recorded outside the one attested quiet battery, and still a
0.40 ms breach that CONTRACT §0.2 says only a quiet machine can adjudicate.

**ONE IS THE MEAN-LUMINANCE FLOOR, AND IT DID EXACTLY WHAT SESSION 46's F8 SAID IT WOULD.** That
finding was *"the 0.08 floor is inside its own run-to-run spread and this run swapped which route it
fails"*. This run swapped it back: `night_rain` per-run means **[0.0785, 0.0846, 0.0787]**, asserted
on the last, RED at 0.0787 — where session 46 had `night_rain` green at 0.0856 and `downtown_dense`
red. **Two sessions, two different routes, one floor, and the gate prints its own warning beside the
number: "ASSERTED ON THE LAST OF THESE, NOT POOLED."** It is CONTRACT §0.1's original incident with
a luminance instead of a millisecond and it is now confirmed rather than suspected.

**TWO ARE CONTENT AND BOTH ARE CARRIED.** `highway_speed`'s vehicle bars — 68% with a dark gap at
the ground against 75%, and 55% with a non-monotone tone profile against 75%. The tone-profile bar
is in its **fourteenth** session; the ground-gap bar was green last session at a different vehicle
population (56 vehicles this run against 69). LOOK.md §4 records both as evidence for the same
finding — *"a monotone tone profile is a body with no surfaces that catch light differently"* — and
neither was touched here.

**NOT ONE RED IS A DRAW CALL, A TRIANGLE, AN INSTANCE, A CLUSTER SLOT OR A ROLE.**

---

## 7. HOW EVERY NUMBER IN THIS FILE WAS TAKEN

**NO NEW INSTRUMENT WAS BUILT.** The brief said not to and there was no need: `emitcensus.mjs`
answers the whole of item 1 and has been in the tree since session 24. It gained a `done` flag and
six candidate rows and lost nothing. `parsecheck` counts **112 files**, unchanged from sessions
42–47.

```
  emitcensus.mjs   the census, the classification, the cost of each candidate declaration, and the
                   paint-on-carriageway check. No browser: the delivered claim list is CPU
                   bookkeeping, and its own CONTROL reproduces STATE 22 §2.4's conflict areas.
  shot.mjs         (scratchpad) many poses, one boot, with `--root` so the same code shoots a
                   second worktree — because R3, R4 and R5 landed in one sitting and a before frame
                   taken afterwards is not a before frame. `git worktree add` at `b8cb5e9` with
                   `node_modules` symlinked; the worktree is removed at the end.
```

**THE FRAMES THIS FILE CITES**, all in `tools/shot-out/`, all regenerable, the directory gitignored:

```
  s47-core-{before,after}-{air,street,gap}.png    the block from 120 m and from the pavement
  s47-wall-{before,after}-{front,at,court}.png    chunk (2,2)'s north frontage, close
```

---

## 8. WHERE THE BRIEF DISAGREES WITH THE CODE

The brief asked to verify everything in it. Three corrections, none large:

1. **"Session 24 … counted 80 sites: 9 undeclared, 51 mismatched, 20 matching. That list has never
   been worked."** The counts are right for session 24 and the city has grown since — **138 sites at
   the start of this session, still 9 undeclared.** The second half of the sentence is exactly right.
   But one of this session's four declarations — **the arch's transit deck, the largest object it
   found** — was in the MISMATCHED column, not the UNDECLARED one, so **the brief's own framing
   would have missed it.**
2. **"The generator registry also contains no sign claims at all."** Not quite: it carries **378**,
   every one a `pylon` or an `adpillar`. What it carries none of is a sign on a WALL, which is all
   five of the mountings `pushSign` draws. The distinction matters because it says where to look.
3. **"Draw calls 396 of 440 … forty-four spare, and item 2 may want some."** Item 2 wanted **none**:
   114 / 156 / 138 draws before and after on three paired poses, because an `edge` feature rides in
   a mesh that already exists. The spare is unchanged.

---

## 9. WHAT TO DO FIRST NEXT TIME

1. **HOIST THE BUILDING CLAIMS IN `buildChunkBody`, THEN SHIP F1 AND F2 TOGETHER.** Session 30 did
   exactly this for the ground rectangles and wrote down why; the buildings are the same move. It
   unblocks 5 050 clutter boxes and 256 flush fascias — the two largest remaining undeclared classes
   — and it is the only thing standing between the census and `UNDECLARED 5 → 3`.
2. **`emitcensus` OVER `block.js` AND `river.js`** (F5). The brief asked what else the registry is
   blind to; two whole modules have never been asked, and one of them is the content path session 45
   found five defects in.
3. **THE PATCH AND MARKING CLIPS** (§3). Two one-line extent fixes with a population effect, so take
   a frame with them.
4. **`water` AND `block` HAVE ZERO DELIVERED CLAIMS** (F6).
5. **L1, THE WINDOW.** Carried from session 45 and still the largest single finding in this project.
   The bright reserve reads **6.81%** this session against a 6.00% floor — the most margin it has
   ever had — and L22 still says one run in three lands under.
6. **L15, `minPairMSD`.** Owed a derivation for a third session. Do not lower it to 0.029.
7. Everything else in §1's carried list.
