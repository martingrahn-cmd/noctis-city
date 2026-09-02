# NOCTIS — STATE

*End of session 69. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`, 14 d 20 h of
uptime — the same boot as sessions 47–68. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` RAN 1.66–6.49 THROUGH THIS SESSION***, over CONTRACT §0.2's bar of 1.6 for the ninth
session running. **No millisecond below is a verdict.** Every number in this file is a byte count, a
frame count, a hash or a site count — and the one quantity that is neither, the number of frames the
capture path renders before it takes a picture, is the SUBJECT rather than a result.

Branch `claude/noctis-69-walkable-predicate-hypothesis`, off session 68's head.

**NOTHING SHIPPED. `src/` IS BYTE-IDENTICAL TO SESSION 68's HEAD.** The session's whole output is two
instruments and one answer.

---
## 0. THE ANSWER, WHICH IS THE WHOLE OF WHY THIS SESSION EXISTED

**KILLED.** A change to a walkable predicate does **not** reshuffle every pedestrian in the city, and
STATE 68 §8's 73 373 bytes were never a difference between two source states. **They are the
difference between two TAA sub-pixel jitter phases of ONE source, and the same 73 373 was reproduced
from session 68's own head with no code change at all.**

```
  the SAME source, capture frame counts 4046 and 4050          73 373 bytes    <- STATE 68's figure
  the SAME source, capture frame counts 4046 and 4054               0 bytes    <- 8 apart. TAA.jitterSamples is 8.
  the SAME source, three runs, arrivals 2939 / 2968 / 3018,
       all stepped to one capture frame count                       0 bytes
  session 68's item 4 UNGATED vs GATED, at each of the eight
       phases in turn, eight pairs                                  0 bytes    <- the predicate contributes nothing
  the SAME source, two capture frame counts, TAA jitter OFF          7 bytes
```

**The noise floor at that instrument is not zero.** Over the eight phases of one source it is
**57 801 to 78 979 bytes**, and over the four phases a capture actually lands on it is **59 868 to
75 852**. 73 373 sits in the middle of that band. Session 68 measured the floor three times in
sixty-five seconds, got the same phase three times, wrote down zero, and read the band as a finding.

---
## 1. THE MECHANISM, NAMED RATHER THAN GUESSED

**`post.js` jitters the projection matrix by `JITTER[frameIndex % 8]` — the Halton(2,3) sequence
CONTRACT §5.10 requires — and `frameIndex` is the absolute count of frames this page has rendered.
So the sub-pixel offset the captured frame was drawn at is set by HOW MANY FRAMES WERE RENDERED
BEFORE IT.**

That number is a wall-clock race:

* `harness.waitForCity` steps **ten frames**, asks the canyon **worker** whether its bake queue has
  drained, and steps ten more if it has not. It returns `i + 14`, where `i` is however many tens of
  frames the worker happened to need.
* Over **35 runs of one source on one machine this session** it returned a total of **2 808 to
  3 038** frames — a spread of **230**, i.e. twenty-three of those ten-frame blocks.
* `harness.settle()` then runs a fixed 44 more. **44 ≡ 4 (mod 8) and `TAA.settleFrames` is 32 ≡ 0**,
  so the settle preserves the phase exactly rather than normalising it.

`TAA.settleFrames`' own comment says *"A capture that depends on how many frames the machine happened
to render is not a capture — CONTRACT §8."* **It discharges that obligation for the temporal
ACCUMULATION and not for the jitter PHASE**, because 32 is a multiple of 8. The frame is 93 % of the
way to the supersampled image, as promised — and it is at one of eight sub-pixel offsets, chosen by
the worker.

**IT IS CONTRACT §9's TABLE WITH A FRAME COUNTER.** A readiness poll — a number computed correctly,
"the city has arrived" — is used as though it were a capture schedule.

---
## 2. HOW IT WAS ESTABLISHED, AND EVERY NUMBER HAS A CONTROL

`tools/stepprobe.mjs` takes the same `viaduct-under` frame `lookat.mjs` takes, by the same calls in
the same order and off the same `LANDMARKS` derivation, and additionally records the frames
`waitForCity` stepped, the frame counter at capture, the adapted log-luminance, and a hash of every
InstancedMesh's delivered matrices. **`--pin=N` steps to a fixed frame count before `settle`**;
`--jitter=0` takes the sub-pixel offset away through `post.js`'s own arm.
`tools/framebytes.mjs` is the byte difference, with four discriminators a count cannot carry.

**BOTH TOOLS WERE VALIDATED AGAINST SESSION 68's OWN ARTEFACTS BEFORE ANYTHING NEW WAS RENDERED.**
`framebytes` reproduces 73 373 exactly from the two PNGs session 68 left in `tools/shot-out`; the
first `stepprobe` run reproduced `s68final`'s md5 bit for bit.

**AND THE OTHER TWO CANDIDATES WERE KILLED BEFORE THE JITTER WAS REACHED, BY THE DISCRIMINATORS
RATHER THAN BY PREFERENCE.** *The exposure* — STATE 68 §1c's own observation that `exposure.js`
meters the whole frame, which makes "every tile is touched" its signature too — reads
`adaptedLogL` **7.58203125 in every one of the 35 runs**, and the best scalar gain that maps one
frame onto the other is **1.000056**, after which 38 % of the difference is still there. *The
aircraft*, the only mesh that moves with the frame count, is at a different position in frames that
are byte-identical and at the same position in frames that are not. Neither survived.

### 2a. THE EIGHT PHASES OF ONE SOURCE — no code change anywhere in this table

```
  pin      4000     4001     4002     4003     4004     4005     4006     4007     4008     4009
  capture  4046     4047     4048     4049     4050     4051     4052     4053     4054     4055
  phase       6        7        0        1        2        3        4        5        6        7
  md5      5664..   b35f..   e731..   007b..   d93b..   89fb..   0537..   8453..   5664..   b35f..
                                                                                    ^ = 4000  ^ = 4001
  differing bytes, phase against phase:
             p6       p7       p0       p1       p2       p3       p4       p5
    p6        -    64178    75852    68641    73373    62206    59868    70434
    p7    64178        -    62317    64866    74256    66959    71955    66810
    p0    75852    62317        -    60409    64055    78979    73199    63951
    p1    68641    64866    60409        -    59940    67265    69999    63442
    p2    73373    74256    64055    59940        -    76953    71378    64258
    p3    62206    66959    78979    67265    76953        -    57801    69939
    p4    59868    71955    73199    69999    71378    57801        -    66373
    p5    70434    66810    63951    63442    64258    69939    66373        -
```

**`d93b…` AND `5664…` ARE SESSION 68's TWO FILES.** `viaduct-under-isosurf` (the ungated arm) is
`d93b…`, which is phase 2; `viaduct-under-s68iso` (the gated arm) is `5664…`, which is phase 6; and
the whole 73 373 is the p6–p2 cell of a table produced from one unmodified source. Its three
zero-floor runs — `s68final`, `s68noiseA`, `s68noiseB` — are all `5664…`, three draws of phase 6.
So is `bisced33d2`. Its other zero — *"session 67 → session 68 with `surfaceAt` UNGATED, 0 bytes"* —
is `after67` against `isosurf`, taken an hour and fifty minutes apart and both phase 2.

**Every one of session 68's five observations is one cell of that table.** Nothing else is needed to
explain any of them.

### 2b. THE PIN, WHICH IS THE CONTROL FROM ONE SIDE

Three runs whose city arrived at frames **2939, 2968 and 3018** — genuinely different races — all
stepped to capture frame 4046: **byte-identical, three of three.** The pin removes the difference
that the frame count creates, which is what makes the frame count the cause rather than a
correlate.

### 2c. THE JITTER, WHICH IS THE CONTROL FROM THE OTHER SIDE

`post.js` documents this arm in as many words — *"the jitter off, the accumulation still on"*. With
`setJitterScale(0)`, the three capture-frame pairs that differed by 64 178, 75 852 and **73 373**
bytes differ by **11, 9 and 7**. Seven bytes is five pixels in one tile of 256, every one of them
one level, and it is the last 2.6 % of pre-switch history bleeding through the settle.

**A factor of ten thousand.** The jitter phase is 99.99 % of it.

---
## 3. AND THEN THE BRIEF'S QUESTION, ASKED WITH AN INSTRUMENT THAT CAN ANSWER IT

The frame is the wrong instrument twice over: its noise floor is 57 801 to 78 979 bytes, and **it
cannot see the signal at all** — §3c. So the question was put to the delivered artefact: **344 InstancedMesh
matrix hashes, the per-chunk pedestrian census, `pedestrianStats()` and the traffic and river
stats**, all at one pinned frame count.

### 3a. FOUR ARMS, ONE EXTRA CLAUSE EACH, AND THE SITES COUNTED BEFORE THE PREDICTION WAS WRITTEN

```
  arm      the extra clause on river.surfaceAt        bank-stations removed   distance from the eye
  U        session 67's behaviour, the gate removed        9 346 restored      3.5 km and beyond
  B500     refuse over |x - 500| <= 64                             258         0.5 km, INSIDE the ring
  B3392    refuse over |x - 3392| <= 64                            258         3.4 km, outside it
  B8000    refuse over |x - 8000| <= 64                              0         8.0 km — already sea
  ALL      refuse everywhere                                    23 424         everywhere
```

**B500 AND B3392 REMOVE THE SAME 258 STATIONS AT DIFFERENT DISTANCES**, counted at 1 m over both
banks by `bankIsLanded` itself. That pair is premise (ii) — *the effect is independent of distance* —
stated as an experiment. **B8000 is §2b's control**: it touches the predicate and removes nothing,
because the last landed station on either bank is x = 3 519 and everything past it is sea. **ALL is the instrument's own control** — if a
predicate change everywhere moves nothing, the comparison is blind and no other arm means anything.

The prediction was written down before the arms were rendered: a shared stream requires
B500 = B3392 ≠ 0 and B8000 = 0; no shared stream requires B3392 = 0 and only B500 and ALL to move.

### 3b. WHAT HAPPENED

```
  arm      meshes identical   what moved
  U         344 of 344        NOTHING. Session 68's item 4 does not move the delivered city at all.
  B500      339 of 344        five chunk meshes across chunks (3,-3) (3,-4) (4,-3) (4,-4) — the
                              four chunks the 128 m band lies in, and no mesh in any other chunk.
                              ONLY THE y SUM MOVED; every x and z sum is identical to the digit.
  B3392     344 of 344        NOTHING, on two runs of three. The third differed in the three
                              traffic meshes only, at a hash that also occurred on unmodified
                              HEAD — §8 item 3 — so it is not the arm's.
  B8000     344 of 344        NOTHING. The control behaves.
  ALL       322 of 344        twenty-two chunk meshes, EVERY ONE of them in chunk rows z = -3 and
                              z = -4 — the two rows the river runs through — from chunk x -4 to +4.
                              ONLY THE y SUM MOVED. Not one mesh outside those two rows.
```

**No instance count changed in any arm. No pedestrian moved in any arm.** `pedestrianStats()` —
total 280, per-chunk map, reseats 366, chromatic garments 93, suppressed 152 — is identical to the
last digit in all five, and so is the per-chunk census.

**THE MECHANISM IS NOT A STREAM AND IT HAS A NAME.** `city.js`'s `put()` seats a feature at
`worldSurfaceAt(x, z).y`, and `worldSurface` takes the maximum over the three modules that emit
ground. Take the promenade away at a point and whatever stands at that point drops to the next
surface down. **One property, one place, one axis, no draw consumed and no candidate removed from
any sequence.** A shared stream would have moved x and z as well, and would have reached chunks the
band does not touch. Neither happened.

### 3c. AND THE FRAME COULD NOT HAVE SEEN IT ANYWAY

At one pinned frame count, **every one of the five arms — including ALL, which moved twenty-two
chunk meshes — delivers a byte-identical `viaduct-under` PNG.** The frame session 68 used to detect a
walkable predicate change has **zero sensitivity to a walkable predicate change** and a noise floor
of fifty-eight to seventy-nine thousand bytes. Even if the hypothesis had been true, that frame could not have been the
evidence for it.

---
## 4. WHAT THIS MEANS FOR THE CLAIMS ALREADY IN STATE

### 4a. WHICH SESSIONS WERE ENTITLED TO "THE CITY DID NOT MOVE" — three of four, and the fourth is 68

* **SESSION 65 and SESSION 67 were entitled.** Both measured *"1 908 chunks lying wholly inside
  r ≤ 3 232 m hash `6f192b75fb42ae2a5545ca17`"* — a digest of the GENERATOR's city, which is where a
  reshuffle would show. **The instrument was never committed**, so no later session can re-run it;
  that is the same failure that put session 68's byte count in a shell one-liner and put session
  23's tree-crown probe under session 68's lamp probe. `tools/funnelprobe.mjs --identity` computes
  the same kind of digest and IS committed — a SHA-256 over every building's geometry, era,
  material, condition, facing, yaw and flags, plus every sign and prop, over `citycheck`'s own
  region, widenable with `--radius`, in **0.17 s**. **Its ASSERTION is dead** — §8 item 5 — but the
  digest it prints is the instrument, and two arms are compared by running it twice.
* **SESSION 66 was entitled.** Its "byte-identical" is about the occupancy registry's counts
  (18 799 / 19 087) and about two config files. Those are statements about the things they name.
* **SESSION 68 WAS NOT.** It is the only one of the four that used pixels, and its floor and its
  finding are two cells of one table.

**AND SESSION 67 HAD ALREADY FALSIFIED THE HYPOTHESIS WITHOUT NOTICING.** `onBridgeDeck` gained
`crossingIsLanded` in session 67 — the function's own comment says it *"stops the walkability mask,
the road clip, the craft placement and the promenade lamps from believing in it"* — and it removed
three whole bridges at x 3 584, 4 096 and 4 608. **That is a walkable predicate change of far greater
reach than item 4's, and STATE 67 records the city byte-identical either side on the 1 908-chunk
hash.** Premise (iii) — *that no session before 68 had changed a walkable predicate* — is false, and
the measurement that refutes it was already in the previous STATE.

### 4b. WHAT `citycheck` ACTUALLY GUARANTEES — for LOOK.md or CONTRACT, in one paragraph

> `citycheck` is a fixed list of about twenty counts and statistics computed over **one 10 × 10 chunk
> square, `region.cx/cz` = [−5, 4], which is 1 280 m of world at one seed, 1337**. Five of its six
> criteria read the **generator's placement data** — the clumping CV, the occupancy conflicts, the
> feature facings, the sign vocabulary and standoff, the walkable-surface census; the sixth, the
> saturation reserve, reads pixels along the night route; and `sceneWalk` reads the live scene's
> instance counts and labels. **"`citycheck` is byte-identical to sessions 57–68" therefore means
> that those numbers are unchanged, and nothing more.** It is not a hash of the city: two
> different cities agreeing on clumping CV 0.393, 5 forbidden overlaps, 2 signs inside buildings and
> 1 004 bare walkable samples read identically to it. It says nothing at all about the world outside
> that square — STATE 67 said so itself of three drowned bridges *"beyond x = 3 500, outside
> `citycheck`'s r ≤ 1 280"* — nothing about any other seed, and nothing about where any individual
> building, prop or person is. **For "the city did not move" the instrument is
> `funnelprobe --identity` on the generator's side and a delivered-matrix hash on the scene's side.
> `citycheck` is a floor under a dozen properties, not a statement of identity.**

### 4c. THE REPAIR — PROPOSED, COSTED, AND NOT MADE

**Normalise the jitter phase inside `harness.settle()`.** Before its last `step`, advance to a fixed
residue of `frameIndex` modulo `TAA.jitterSamples`. Every capture then draws its final frame at the
same sub-pixel offset whatever the worker did.

* **Cost: one accessor and about four lines.** `post.js` keeps `frameIndex` private and needs a
  getter; `harness.settle()` needs to read it and step the remainder. `time.frame` would serve as a
  proxy — this session measured the two to be in lockstep, since the delivered image is a pure
  function of `time.frame mod 8` over eleven pins — but two counters for one quantity is CONTRACT
  §9.1's own arrangement and the accessor is the honest version.
* **It changes every delivered frame in the project, once**, by up to the phase differences above:
  ~2 % of the bytes of a `viaduct-under` frame and **2.4 % to 5.7 %** of a look frame. So it belongs
  in a session with the look gate as judge and nothing else in it, with every look threshold re-read
  either side. The risk looks low and is not zero: this session measured `distinct:midnight|dusk` at
  **0.02845** on a run whose frames differ from session 68's by 416 580 bytes, so the MSD statistic
  is robust to the phase where the pixels are not.
* **Two alternatives, both rejected with reasons.** *Fix the frame count itself* — a deterministic
  number of frames before capture — needs a bake bound that holds on every machine, and a slow
  machine would then photograph an unbaked city, which is worse than a jittered one. *Average the
  eight phases* is 8× the capture cost and is supersampling by another name.
* **NOTHING NEEDS TO WAIT FOR IT.** `stepprobe --pin` gives any session a two-arm frame comparison
  today without touching `src/`.

---
## 5. THE BRIEF'S FOUR PREMISES

| | premise | verdict |
|---|---|---|
| (i) | the mechanism is a shared deterministic stream | **FALSE, and there was no effect for a mechanism to explain.** The 73 373 is one source at two jitter phases. The real dependency `worldSurfaceAt` creates is local, vertical, and consumes no draw: §3b. |
| (ii) | the effect is independent of distance from the origin | **FALSE, and measured with the distance as the only variable.** 258 stations removed at 0.5 km moves exactly the four chunks it lies in; the same 258 removed at 3.4 km moves nothing at all. |
| (iii) | no session before 68 actually changed a walkable predicate | **FALSE, and session 67 is the counter-example.** It gated `onBridgeDeck` and drowned three bridges, and measured the city byte-identical either side. §4a |
| (iv) | `citycheck`'s byte-identity is consistent with the hypothesis rather than evidence against it | **TRUE, and for a larger reason than the brief gave.** `citycheck` is a score of aggregates over a 1 280 m square at one seed; it was never evidence either way about where anything is. §4b |

**AND THE BRIEF'S OWN SUSPICION WAS THE RIGHT ONE, POINTED AT THE RIGHT OBJECT.** *"A test that
cannot distinguish the hypothesis from its negation will agree with whichever one you already
believe."* The `viaduct-under` frame is that test: 256 of 256 tiles touched is the signature of a
reshuffled crowd, of a re-metered exposure and of a sub-pixel shift alike, and it was the third.

---
## 6. THE COST

**ZERO, AND IT IS CHECKED RATHER THAN ASSERTED.** `src/` is byte-identical to session 68's head —
`git diff 9fb4f56 -- src/` is empty. The two new files are `tools/framebytes.mjs` and
`tools/stepprobe.mjs`. `src/modules/river.js` carried five temporary arms during §3 and was
`git checkout`-ed back after each; the working tree was clean before the gate battery ran.

```
  highway_speed   401 draws of 440              IDENTICAL TO SESSIONS 67 AND 68
                  2 451 648 tris of 2 630 000   IDENTICAL TO SESSIONS 67 AND 68
                  347 833 instances, 73 materials
```

**The occupancy registry is untouched: 18 799 generator claims, 19 087 delivered.**

---
## 7. GATE STATE

**ALL EIGHT RAN. `perfcheck` COMPLETED THE WHOLE BATTERY FOR THE FOURTH SESSION RUNNING.**

```
  gate            exit   verdict   seconds  load1 in     out
  parsecheck         0     GREEN       3.7      2.86    2.95
  faultcheck         0     GREEN      28.4      2.95    3.30
  lookcheck          1       RED      50.7      3.30    6.49    THE IDENTICAL THREE
  windcheck          0     GREEN      43.8      6.49    4.97
  inputcheck         0     GREEN      17.5      4.97    4.91
  gateaudit          1       RED      80.9      4.91    4.72    the carried `control failed`
  citycheck          1       RED     126.8      4.72    4.30    IDENTICAL TO SESSIONS 57-68
  perfcheck          1       RED    1158.3      4.30    3.16    AND IT FINISHED AGAIN

  4 of 8 RED — the same four as sessions 53-68. NO FIFTH RED.
```

**`citycheck` IS BYTE-IDENTICAL TO SESSIONS 57–68 ON EVERY COUNT** — clumping CV **0.393**, **5**
delivered forbidden overlaps, **2 of 2 647** signs inside a building, **1 004 of 284 918** bare
walkable samples, occupancy **18 799 / 19 087**. That is what §4b says it is, and no more.

**EVERY `perfcheck` VIOLATION IS CARRIED OR IS A TIMING ABSOLUTE FROM A LOADED MACHINE**, at `load1`
**4.30** against CONTRACT §0.2's bar of **1.6**, and the battery's own footer says six browser gates
started above the bar. Nothing in `src/` changed, so nothing in that gate could have. The non-timing
ones are the known straddles: `downtown_dense` frame entropy **4.923** and `night_rain` **4.952**
against a floor of 5 (session 68 read 4.887 and 4.883, session 67 4.910 and green), and the vehicle
silhouette bars at **70% and 69%** against 75%.

**`lookcheck`'s `distinct:midnight|dusk` READ 0.02845**, against 0.02845 in session 68, 0.02844 in
session 67 and session 65's band of 0.02836–0.02838. **That is the independent re-reading STATE 68
§8 item 4 asked for**, and it says the figure has not moved between 68 and 69 at 1e-5 — on a run
whose frames differ from session 68's by 416 580 of 17 280 000 bytes.

---
## 8. WHAT TO DO FIRST NEXT TIME

**1. NORMALISE THE JITTER PHASE — §4c, AND IT IS THE ONLY REPAIR THIS SESSION PROPOSES.** One
accessor in `post.js`, four lines in `harness.settle()`, a session with the look gate as judge and
nothing else in it, and every look threshold re-read either side. Until it lands, **no frame-to-frame
byte comparison in this project is evidence unless both frames were captured at the same frame count**
— `stepprobe --pin` is how.

**2. THE LOOK GATE'S OWN FRAMES ARE NOT REPRODUCIBLE, AND NOBODY HAD LOOKED.** Session 68's
`tools/look-out` against session 69's, at a source that did not change by one byte:

```
  midnight  416 580     dusk  458 947     noon  978 114
  dawn      880 415     midnight-wet 649 496     dusk-wet 702 630        of 17 280 000
```

2.4 % to 5.7 %, with the phase signature — whole frame, `|Δ|=1` dominant, best scalar gain 0.9998.
`lookcheck` runs the same `waitForCity` + `settle(4)` path (44 frames, ≡ 4 mod 8), and it PRINTS its
own arrival — *"city streamed in over 1014 frames"* — so the variable is already in the log. **The
metrics survive this and the pixels do not**, which is why the gate has never noticed. Anyone
diffing look frames — `lookdiff.mjs` included — needs to know it first.

**3. THE TRAFFIC MATRICES ARE NOT REPRODUCIBLE EITHER, AND THE PIN DOES NOT FIX THEM.** At one
source, one seed and one pinned capture frame count, `traffic:bodies/lights/wheels` delivered
**`dcaf38bd` in 33 of 35 runs and `b82faa08` in 2** — once on unmodified HEAD, once on an arm. The
other 341 meshes were identical every time. It is a second race and a smaller one; `traffic.js`
reports `seedRejects 102, seedFallbacks 4` and reseeds against the resident ring, which arrives on
the worker's schedule. **It is invisible in every frame taken so far** — the PNG was identical
across all of them — so it is a determinism question and not a look one.

**4. AND THE FRAME ITSELF IS NOT A PICTURE OF A VIADUCT SOFFIT. LOOK AT IT.** CONTRACT §10 step 4
is *"look at the frames — the numbers are necessary and not sufficient"*, and it is what finds this:
**the left two-thirds of `viaduct-under` is one flat building wall a few metres from the lens**, with
a slice of street and pavement down the right-hand side. **60.3 % of its 1 166 400 pixels lie in that
wall's colour band**, and the difference splits along the same line: tile columns 1 to 9 of 16 are
144 of the 256 tiles and carry **25 %** of the differing bytes at a median of **121** each — a smooth
gradient losing its least significant bit to a sub-pixel shift — while the other seven columns carry
**75 %** at a median of 290 and a maximum of 3 658. The August 10 capture at the same preset is a
lorry filling the frame. **The pose is `lookat.mjs`'s own derivation
off `viaductArc` and nothing has looked at what it delivers since it was written**, and a frame that
is 60 % flat wall is a poor instrument for anything. Session 57's lesson — *"a frame that does not show its
subject is not evidence the subject is absent"* — has now been met a fourth time, and this time by
the frame a hypothesis about the whole city was built on.

**5. `viaduct-under` NEVER REACHES A FULLY BAKED CANYON FIELD.** Every one of 35 runs printed
**25 of 30 field slots ready**, with `waitForCity`'s first call exhausting its whole 1 800-frame
budget and the second draining at 974–1 204. Five slots never arrive at that pose. `lookcheck`'s
second eye reaches 30/30, so it is not a general failure of the streamer. Nobody has asked why.

**6. `funnelprobe --identity` ASSERTS AGAINST A CONSTANT THIRTY SESSIONS STALE, AND EXITS 1 TODAY.**
Its `IDENTITY_SHA` was pinned in session 38 to prove that session's frontage tally was inert. The
generator has changed a great deal since, so it prints
`delivered 43df168f…` against `pre-tally bc693636…` and *"DIFFERENT — the tally has moved a
stream"*. **The digest itself is exactly the right instrument** — 668 buildings, 966 signs and
4 657 props over `citycheck`'s region, in 0.17 s — and two arms are compared by running it twice and
reading the two digests. What is dead is the comparison against a constant nobody has revisited.
Deciding what that constant should be, or whether it should be a constant at all, is a real item and
it is not this session's.

**7. THE UNCOMMITTED INSTRUMENT IS THIS PROJECT'S REAL RECURRING DEFECT.** Session 65 and 67's
1 908-chunk city hash, and session 68's byte count, were both one-liners that no later session could
re-run — and session 68 additionally overwrote `tools/lampprobe.mjs`, session 23's tree-crown probe,
because it wrote to a tool path without looking. **Three instruments lost or unreproducible in four
sessions**, and a fourth — item 5 — kept but left asserting against a dead baseline — item 6.
`framebytes.mjs` and `stepprobe.mjs` are committed, and both were validated against a prior
session's own artefacts before they were used on anything new.

**8. WHAT THIS SESSION DID NOT DO.** It settled one question and built no feature, which is what its
brief asked for. Everything on STATE 68 §8 items 2, 3 and 5, and everything on §9 and §10, is
untouched and still waiting: the sea's farthest band and the haze, the fifteen uncounted
`river:moving` instances, and the straddle carriers' 0.42 m legs.
