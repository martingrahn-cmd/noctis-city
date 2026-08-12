# NOCTIS — STATE

*End of session 24. **The machine has no GPU. Checked first, printed, recorded — §0.**
This is the fourth consecutive session on a container with no display hardware, and
nothing that needs one was attempted. There is not one millisecond in this file.*

*The session was the UNDECLARED CENSUS: enumerate every site that puts geometry
into a chunk mesh and ask, of each, whether anything claims what it emitted.
Nobody had ever done that, and three sessions running had each found one member
of the set the hard way.*

- ***80 emission sites. 9 UNDECLARED, 51 MISMATCHED, 20 MATCHING.*** Found by
  wrapping `Matrix4.prototype.clone` and reading the call stack, not by reading
  the file — a census assembled by reading `city.js` is the same instrument that
  has missed three of them. §1.
- ***The two remaining overlaps were three.*** On a fully built resident ring the
  delivered sweep reports **3**, not the 2 session 22 recorded. Session 22's
  browser census was taken over a **partially built ring**, and `citycheck`'s
  floor of 1 200 delivered claims cannot notice — it was derived from the near
  ring alone. §1.2.
- ***And all three were the instrument.*** `prop(container) × site(hoarding)` is
  not two containers on a hoarding's foot. **No two solids touch at all** —
  nearest approach 0.84 m, 0.87 m, 0.55 m. The delivered claim for a park or
  site feature accumulated `Math.max(sx, sz) / 2` on BOTH axes, so a
  **2.4 × 0.06 m hoarding panel was recorded as a 2.4 × 2.4 m square**. Session
  22's two candidate repairs were aimed at the generator's claim; the red number
  is on the delivered side. **A wrong aim, and it is the finding.** §2.
- ***The first `sign` claim this project has ever made.*** `occupancy.js` has
  carried the category since session 21, it appears in eight rows of the
  conflict table, and **nothing on either side had ever written one**. Declaring
  the freestanding pylon costs **0 placements** — and its first run found a real
  defect: **two pylons 0.32 m apart, one's panel drawn through the other's
  post.** The gate is RED AT 1 and the repair is costed and NOT built, because
  refusing a pylon changes the city. §1.5.

Read `CONTRACT.md` before this file, and before any source file.

---

## 0. THE MACHINE — CHECKED, NOT ASSUMED. AND THE BRIEF'S PREMISES, CHECKED.

The brief said not to take its word for it, including its own. First commands of
the session:

```
$ uname -a          Linux vm 6.18.5-fc-v20 #1 SMP PREEMPT_DYNAMIC @0 x86_64 GNU/Linux
$ grep 'model name' /proc/cpuinfo   Intel(R) Xeon(R) Processor @ 2.80GHz
$ nproc             4
$ free -h           15 GiB total, 14 GiB free
$ cat /etc/os-release   Ubuntu 24.04.4 LTS (noble)
$ cat /proc/loadavg  0.40 0.10 0.03
$ ls /dev/dri       No such file or directory
$ lspci             not present
$ node --version    v22.22.2      $ npm --version  10.9.7
$ df -h /           252 G, 30 G available
```

**No GPU.** Same container shape as sessions 21, 22 and 23: a 4-core Xeon with
no display hardware, where a browser falls back to SwiftShader. `budget.json` →
`machine` is untouched and the M4 series stands. **This is the fourth session
asking for a machine.**

`node_modules` was empty at session start; `npm install` fetched 22 packages in
4 s. Nothing else about the environment changed.

### 0.1 The brief's own claims, tested

The brief asked to be treated as a hypothesis with a name attached. Four of its
factual claims were checkable here:

| the brief said | measured |
|---|---|
| no GPU for three sessions running | **TRUE**, and this is the fourth |
| two remaining overlaps | **WRONG — there are three.** §1.2 |
| `prop(container) × site(hoarding)` diagnosed to 0.170 m² against a measured 0.173 | the arithmetic is right and the **attribution is wrong**: 0.170 m² is a hoarding foot's footprint and the overlap is not between the feet. §2 |
| 790 lampposts emitted from city.js at 8.08 m, in no registry band | **TRUE and confirmed independently.** Over this session's 121-chunk resident ring the number is 181 columns and 181 heads (session 23's 790 is over `city-budget.json`'s own 10 × 10 region and includes the promenade line); the point stands either way — **not one of them is claimed** |

**So one premise of three was wrong, and the wrong one was the count.** That is
the fourth consecutive brief with a false premise in it and the fourth caught by
checking rather than by reading.

### 0.2 What ran

```
✓ parsecheck              86 files, syntactically complete and contract-clean
✓ citycheck --falsify     56/56 cases rejected, 56 failure sites, coverage 100%
✓ generator half          5 364 claims over the gate's region, 0 forbidden
                          overlaps — unchanged from session 23
✓ emitcensus              NEW. 121 chunks, 124 007 boxes, 80 emission sites. §1
✓ boxprobe                NEW. The delivered SUB-BOXES of every conflicting
                          pair, beside their claims. §2
✓ headlesscity            NEW. `city.js` + `block.js` + `river.js` booted in
                          node, no browser, no GPU. §1.1
GATE-RUNS-NEEDING-A-BROWSER — see §4.
```

---

## 1. THE UNDECLARED CENSUS

`tools/emitcensus.mjs` (new, NOT A GATE), `tools/lib/headlesscity.mjs` (new).

### 1.1 First, an instrument that can ask the question at all

The delivered occupancy census — `city.placedClaims()` — is what CONTRACT §9.1
requires: *the gate reads the DELIVERED scene, not the registry*. It has only
ever been reachable through a browser, and a browser here means SwiftShader,
which session 23 watched lose its execution context three times.

**None of that bookkeeping touches a pixel.** `buildChunkBody` accumulates a
claim per emitted object from the matrices it pushed: `Matrix4.compose`, a few
additions and a `Math.max`. What needs a GPU is *rendering* those matrices.

So `tools/lib/headlesscity.mjs` boots the **real** `city.js`, the **real**
`block.js` and the **real** `river.js` in node against a stub `ctx`, and drives
the real `update()` until the ring stops growing. **121 chunks in 63 frames,
about 5 seconds.** It re-implements no placement, no emission and no claim. What
it substitutes is four neighbours, each listed in the file with the reason:
`lights` (a shader injection and a data-texture slot — neither changes a
matrix), `lighting` (one boolean), `canyon` (two scalars for the analytic
default), `time` (a beacon phase).

**THE CONTROL, AND IT IS WHY ANY OF THE NUMBERS BELOW ARE COMPARABLE.** STATE 22
§2.4 recorded the delivered conflict list off a real browser: two overlaps at
**0.173 m² and 0.266 m²**. This path reproduced **both, to three decimals**,
before the session touched anything. Same path.

### 1.2 THE FIRST THING IT FOUND: THE RED WAS NEVER 2

On a fully built ring the sweep reports **three**:

```
prop(container) × site(hoarding)   0.173 m²
prop(container) × site(hoarding)   0.266 m²
prop(cabinet)   × site(hoarding)   0.129 m²   <- never reported before
```

The third is at (571, 14), chunk (4, 0), **ring 4**. The two containers are at
(399, 27), chunk (3, 0), **ring 3**. Building the ring progressively:

```
resident chunks   8    16    26    50    82   121
delivered claims 840  1268  1589  2273  3161 3294
conflicts          0     0     0     2     3    3
```

**Between 50 and 82 chunks the count goes from 2 to 3.** Session 22's browser
census was taken somewhere in that band. `harness.waitForCity()` returns when
the canyon field queue has drained and `resident > 0` — it never asserts that
the geometry ring is complete — and `citycheck`'s `minDeliveredClaims` is
**1 200**, which a 50-chunk ring clears at 2 273. The floor's own derivation says
it is computed from the near ring alone and *"does NOT stand in for
completeness"*. It does not, and nothing else did either.

> **A conflict count over a partially streamed ring is a count of the ring.**
> It is CONTRACT §9's shape with a residency instead of a length, and it is the
> reason `occupancy` has been "red at 2" for two sessions when the city has
> three.

### 1.3 (a) EVERY EMISSION SITE, AND HOW THEY WERE FOUND

`setMatrix` and `propMatrix` both END in `Matrix4.clone()`. Wrapping that
prototype method for the duration of the build catches **every** instanced box,
window pane and sign quad exactly once, and the call stack at that moment names
the line that emitted it. **A site nobody knew about appears in the table by
itself.** Non-instanced geometry — the landmark lathes and the merged ground and
signage meshes — is picked up by walking the scene instead.

**The extent is the box's own GEOMETRY under the delivered matrix, and that
distinction cost a wrong number once already in this session.** A matrix does not
say how big a thing is: `setMatrix(x, y, z, 1, 1, 1, yaw)` is a 1 m cube against
the unit box, an **8.4 m column with a 2.1 m arm** against `geometries.lamp`, and
a **plane with no depth at all** against `geometries.plane`. The first run
assumed the unit box and reported a sign blade's footprint as 1.85 m² where it is
0.03. So each matrix is matched back to the mesh it was written into and the
mesh's own bounding box is used. **The match key goes through `Math.fround`**
because `Matrix4.elements` is doubles and `instanceMatrix.array` is a
Float32Array: keyed at full precision it matched 35 574 of 124 007 and sent the
other 71% to a fabricated fallback.

**80 emission sites in `city.js`, 124 007 boxes over the resident ring.** The
classification is computed, not assigned: **UNDECLARED** where most of what a
site emits has no solid claim over its footprint at any height; **MISMATCHED**
where a claim exists and the delivered box escapes it in plan or in height;
**MATCHING** where neither.

**Surfaces are not declarations.** A `carriageway`, a `pavement`, a `path` and
the `ground` catch-all say what you are standing ON. A lamp column inside a
pavement claim is exactly as undeclared as one in a field, and a coverage test
that counted the pavement would have reported session 23's 790 lamps as declared.

### 1.4 (b) THE TABLE

`plan-undeclared` is footprint m² with no solid claim over it at any height.
`3-D` is the same against a claim at the box's own height — which is what
`occupancy.overlaps` actually enforces. `past` is how far, in metres, the box
reaches beyond the edge of its own claim.

**UNDECLARED — 9 sites**

| what it emits | boxes | plan-undeclared m² | past | note |
|---|---|---|---|---|
| road patches | 274 | 9 130 | 3.87 | a 10 mm reinstatement — see §1.6 |
| road markings | 10 780 | 7 407 | 15.95 | paint — see §1.6 |
| **colonnade piers** | 196 | 162 | 0.00 | **1.35 m of masonry standing on the pavement, outside its own building's claim** |
| **kerbside lamp columns** | 181 | 129 | 1.46 | the 8.4 m column and its 2.1 m arm |
| **kerbside lamp heads** | 181 | 119 | 0.55 | the 0.42 m bowl at 8.08 m |
| flush sign fascias | 121 | 22 | **2.78** | stands 0.12 m proud — but see below |
| projecting blade brackets | 116 | 15 | 0.00 | bolted to the wall; part of the building |
| projecting blades | 232 | 6.9 | 2.35 | over the pavement at 3.4–7.2 m, and 2.4 m is the authored clamp |
| a mast's guy steel | 9 | 1.1 | 0.00 | one landmark |

**The flush row is not what its own comment says it is, and that is a finding
rather than a caption.** A flush fascia stands 0.12 m off the masonry, so it
should escape its building by 0.12 m and no more. It escapes by **2.78 m**,
because a sign is `s.width` wide along the elevation (0.9–6.2 m for a shopfront,
9–17 m for a building-scale one) and is placed at `along = s.along ·
halfTan · 0.82` with `s.along` in ±0.62 — so a wide sign near the end of a narrow
elevation **hangs past its own building's corner**. 119 of the 121 have no solid
claim under them at all. Nobody has looked at that from the pavement; it is one
`lookat` pose for whoever next has a GPU, and it is not this session's item.

**MISMATCHED — 51 sites. The four that matter:**

| what it emits | boxes | plan-undeclared m² | past its claim | above its claim |
|---|---|---|---|---|
| **building tier masses** | 532 | 2 942 | **0.47 m** | — |
| **the cantilever** | 40 | 1 538 | **2.48 m** | — |
| **cornices and crowns** | 419 | 10 543 | 1.14 m | 400 boxes, **0.90 m** |
| **roof plant** | 1 436 | 0 | 0.00 m | 1 436 boxes, **18.72 m** |

- **The building's own mass reaches 0.47 m outside its own claim, and the reason
  is the YAW.** `placedClaims` writes `bld.x ± width/2`, the UNROTATED footprint,
  and the mass is drawn at `bld.yawDeg` — up to ±`CITY.maxYawDeg` = 2.4°. A 26 m
  building turned 2.4° has a world AABB half-extent of `w/2·cos + d/2·sin`, which
  is `d/2·sin(2.4°)` = up to 0.55 m wider than claimed. **The generator's claim
  ignores it too**, so the two halves agree with each other and both disagree with
  the world. It is CONTRACT §9 row 21b — a rotated box's AABB computed as
  though it were unrotated — with a building instead of a stop bar, and
  `citygen.js`'s `paint()`, its kerbside prop claim and this session's new pylon
  claim all already spell the correct expression.
- **The cantilever oversails by up to 2.48 m over the pavement, claimed by
  nobody**, on the contemporary era only (40 boxes over the ring).
- **1 436 roof-plant boxes stand up to 18.72 m above the top of their own
  building's claim.** `y1` is `bld.height`; the parapet is at `height + 1.05` and
  a plant unit reaches `height + ph`. **A viaduct deck at 18.2–21.9 m may
  therefore pass through the roof plant of a building that claims 20 m** —
  `deck × building` is decided by the vertical extent and the vertical extent is
  short. Nothing in the delivered world does this today; it is a bound that is
  wrong rather than a defect that is showing.

**MATCHING — 20 sites**, including every ground rectangle (`buildGround`'s
`rects` IS the claim, by construction, since session 21), the viaduct deck slab
and box girder, the crane pad and mast, the park pond and pavilion, the site
frame columns, and — after §2's repair — the hoarding panel and its feet.

### 1.5 (c) AND (d) WHAT DECLARING WOULD COST, AND THE ONE THAT COST NOTHING

The claim a row *would* make is built from the delivered boxes, added to the
census, and the sweep re-run. What was not there before is the cost. Where a
claim laid down in `generateChunk` would REFUSE what comes after it, the two
counts are the same set counted from opposite ends, and where the number is zero
they agree exactly.

```
                              boxes   NEW forbidden pairs   objects refused
  freestanding pylon face+post   108        0               0   <- BUILT
  promenade lamp column/head       0        —               not in this ring
  projecting blade as `sign`     232        0               0   <- category wrong, §1.7
  lamp HEAD as `canopy`          181       39               4   landmarks
  colonnade pier as `building`   196       56              16   its own pavement
  sign structure boxes as `sign` 832       71              51   38 pylon, 33 building
  lamp COLUMN as `prop`          181      113              52   72 carriageway, 28 exchange
  road patch as `prop`           274      142              53   110 carriageway
  road marking as `prop`      10 780    5 677              69   5 625 carriageway
```

**THE ONE WITH A MEASURED COST OF ZERO IS BUILT: the freestanding sign pylon is
now claimed as `sign`.** 36 pylons over the ring, 0 new forbidden overlaps, 0
placements changed. `occupancy.js` has said since session 21 what the category is
for — *"a FREESTANDING sign pylon. A flush or projecting sign is part of its
building and claims nothing"* — and **nothing in the project had ever written
one**. It appears in eight rows of the conflict table and had zero claims on
either side: CONTRACT §9.1's config-the-code-does-not-read with a conflict rule
instead of a value.

**AND ITS FIRST RUN FOUND A REAL DEFECT, WHICH IS CONTRACT §7.1's REQUIREMENT
THAT A CHECK BE CONFIRMED RED AGAINST THE CONTENT.**

```
sign(pylon) × sign(pylon)   0.366 m²
```

Two freestanding pylons on the same building, **0.32 m apart**, at x = 10,
z = 163.6 and 163.97. `boxprobe` confirms it on the delivered SOLIDS and not
only on the claims: **pylon B's sign panel (z 163.004–164.285, y 3.515–4.056)
passes straight through pylon A's post (z 163.836–164.096, y 0.160–4.715)**,
0.0064 m² per face, twice. A building may draw 1–2 signs, both written at the
building's own centre with `along` drawn independently, and the freestanding
branch tests the chunk's `occluders` and the origin block — **not the other
pylons**.

**NOT REPAIRED, AND THE NUMBER IS WHY.** Refusing the second pylon back to
`flush` is one line and costs **1 pylon of 36** over this ring. That is a content
change, and the brief's own rule — and CONTRACT §0 rule 5's spirit — is that a
placement refusal is the operator's to see. So `citycheck` → `occupancy` is
**RED AT 1**, and it is red on something true for the first time since session
21.

### 1.6 PAINT AND ASPHALT: THE ROW WHERE DECLARING IS THE WRONG ANSWER

The two biggest undeclared rows are the road markings (10 780 boxes) and the
road patches (274). Both are **4 mm and 10 mm boxes lying ON the carriageway**,
not obstructions, and the cost table says so with a number: declaring a marking
as `prop` produces **5 625 conflicts with the carriageway it is painted on**.
A road marking should claim nothing. That is the right answer and it is now
measured rather than assumed.

**What it leaves is the other question, and there the two differ.**

```
                  emitted   in the near ring   reach off every delivered
                                               carriageway    lie WHOLLY off one
  road markings    10 780         2 371            24                0
  road patches        274            58            14               10
```

- `citygen.js` clips a marking to the delivered carriageway (`onRoad`) — but it
  tests at **HALF the mark's own half-extents**, so a mark may overhang by up to
  **59.4%** of its own area. Small, bounded, and now written down.
- **Nothing clips a road patch at all.** `patches.push` runs off `b.x0 ± 3.2/3.4`
  with no test of any kind, so **10 of the 58 near-ring patches lie wholly off
  every carriageway the city drew** — on a pavement, inside the origin block's
  keep-out, or where a landmark took the road away. It is the one ground-related
  emitter that did not move into the generator in session 21, and it is the same
  line CONTRACT §9 row 19b already records for having been a metre tall.

  **Repairing it removes content** (up to 10 patches of 58) and is therefore
  written up and left. `chunk.markings`'s own `onRoad` is the mechanism; a patch
  needs the same clip in the same place.

*Counted over the 25 near chunks only, and with a corridor's margin inside them:
`buildGround` runs on `near` chunks alone, so a carriageway claim exists for 25
of the 121 resident chunks, and asking whether a ring-3 marking is on a delivered
carriageway measures the RESIDENCY RING. Run without that filter it reported
7 237 of 10 780 markings off the road. Two quantities, same units, plausible
magnitudes — CONTRACT §9, inside the instrument.*

### 1.7 THREE MORE FINDINGS THE CENSUS PRODUCED ON ITS OWN

1. **FIVE OF THE THIRTEEN CATEGORIES ARE CLAIMED ON ONLY ONE SIDE OF A
   TWO-SIDED CHECK.** The registry's whole design is that the generator's claims
   and the delivered census run the SAME conflict table over two independent
   descriptions. Measured:

   ```
   generator only   water 652,  path 19,  block 100
   delivered only   canopy 183, sign 36 (new this session)
   both             building, landmark, deck, carriageway, pavement, prop, site, feature
   ```

   So `canopy × building` can only ever be caught on the delivered side and
   `prop × water` only on the generator side. **Neither half is a check on the
   other for five of the thirteen categories**, and no gate says so.

2. **`placedClaims` CAN EMIT A KIND THAT IS NOT A CATEGORY, AND NOTHING CHECKS
   IT.** `buildGround`'s grass quads map to `kind: 'ground'`, which is not in
   `CATEGORIES`. `buildConflictTable` **throws** on an unknown name in
   `FORBIDDEN` — the file's own comment explains why — and a *claim* with an
   unknown kind is silently permitted against everything, because
   `mayOverlap('ground', anything)` is `true` by absence. Measured over the
   11 × 11 ring: **25 grass rectangles** carry it. Inert today (a park's grass
   should conflict with nothing much), and it is a hole in the one structure
   this project built to stop holes.

3. **The `sign` category's own doc sentence is now measured in both
   directions.** *"A flush or projecting sign is part of its building and claims
   nothing"* — declaring the 232 projecting blades as `sign` costs **0** today,
   so the decision is free to reverse and should not be: `sign × prop` is
   forbidden, and a bollard standing under a blade at 3.4 m is what a blade is
   for. The sentence is right; it now has a number under it.

### 1.8 WHERE THE LINE FELL

The brief said to split the census if it was bigger than one session. **It was
not split.** `city.js` is the only file that puts geometry into a chunk mesh —
`citygen.js` emits *descriptions* (`ground`, `features`, `markings`, `props`) and
*claims*, and every one of those is covered here from the delivered end. What is
NOT in this census, and is stated rather than implied:

- **`block.js` and `river.js` emit their own meshes** (1 997 matrices over this
  ring) and are outside it. The origin block writes **no delivered claim at
  all** — the `block` claim exists only in the generator's registry, as the
  authored keep-out.
- **The landmark lathes** are in the scene walk but not the box table: the
  `weir` reads 44 100 m² of plan-undeclared footprint against **NO CLAIM**
  (a basin's `landmarkOccluders` returns `[]` by design and its `landmark`
  claim is made in the generator, not delivered), and the `dish` 3 923 m².

---

## 2. THE OVERLAP, DECOMPOSED — AND THE TWO REPAIRS WERE AIMED AT THE WRONG BOX

`tools/boxprobe.mjs` (new, NOT A GATE), `src/modules/city.js`'s feature loop.

### 2.1 (a) and (b) The delivered box list, and which pair produces the overlap

```
CLAIM A  prop(container)  x 397.644..400.459  z 26.486..28.078  half (x 1.408, z 0.796)
  x 397.644..400.459  z 26.486..28.078  y 0.041..1.877   the body
  x 397.644..400.459  z 26.584..26.756  y -0.020..0.078  a skid
  x 397.644..400.459  z 27.808..27.980  y -0.020..0.078  a skid
  DELIVERED UNION  half (x 1.408, z 0.796)      CLAIMED − DELIVERED  0.000 on all four edges

CLAIM B  site(hoarding)   x 395.500..397.900  z 24.648..27.163  half (x 1.200, z 1.258)
  x 396.635..396.765  z 24.700..27.100  y -0.020..2.380  the PANEL, 0.13 m thick
  x 396.236..396.746  z 24.720..25.075  y -0.020..0.100  a foot
  x 396.295..396.804  z 26.736..27.090  y -0.020..0.100  a foot
  DELIVERED UNION  half (x 0.284, z 1.200)
  CLAIMED − DELIVERED  x0 -0.736  x1 +1.096  z0 -0.052  z1 +0.062
```

**The container's claim is EXACT — zero on all four edges. The hoarding's claim
is 4.2× too deep.** And:

```
  SOLID-AGAINST-SOLID: 3 × 3 sub-box pairs tested
    NONE.  NEAREST APPROACH 0.8394 m
```

Same on the other two: **0.8698 m** and **0.5538 m**. **No two solids touch.
The overlap is between two RECORDS.**

### 2.2 (c) What each side claims against what it delivers

`city.js`'s feature loop accumulated its claim as

```js
const hx = Math.max(sx, sz) / 2;      // and used hx on BOTH axes
```

A hoarding panel is `SITE.hoardingSegment` = **2.4 m** long and **0.06 m** deep.
`max(2.4, 0.06) / 2` is 1.2, applied to x AND z, so the delivered census recorded
a **2.4 × 2.4 m square where a 2.4 × 0.06 m panel was drawn** — 40× the depth, on
the axis that faces the street. **CONTRACT §9's shape with two extents: the
longer of a box's two horizontal dimensions used as both of them.**

**THE TWO CANDIDATE REPAIRS WERE AIMED AT THE WRONG BOX, AND SAYING SO IS THE
FINDING.** Both of session 22's arms — widening the generator's hoarding claim
from 0.12 to 0.43, and replacing the interior prop claim's circumscribing square
with its radius — changed the GENERATOR's claims. The red number is computed
from the DELIVERED census. Neither could have moved it, and neither did.
STATE 22 §2.4's arithmetic is also a coincidence worth naming: a hoarding foot's
footprint is 0.34 × 0.5 = **0.170 m²** against a measured **0.173 m²**, which is
a 1.8% agreement between two unrelated quantities and read as a confirmation.

### 2.3 (d) One repair, red first, and the content cost

The claim is now the box's own world half-extents off the delivered matrix —
`(|e0| + |e4| + |e8|)/2` and its z twin — **spelt exactly the way the prop loop
sixty lines above has spelt it since session 21**, with a comment that says why.
This is the copy that did not.

```
                              before   after
  delivered claims             3 294   3 294     identical
  forbidden overlaps               3       0
  building / prop / canopy / deck / landmark / carriageway / pavement claims
                                       BYTE-IDENTICAL
  site claims                    344     344     9 unchanged, 4 wider, 334 narrower
  feature claims                 105     105    13 unchanged, 67 wider, 92 narrower
  every claim's y0 and y1                UNCHANGED
```

**Content cost: zero. No matrix moved, no placement changed, no geometry
touched.** What changed is what `city.js` says it drew.

**AND IT IS NOT ONLY A LOOSENING, WHICH IS WHAT MAKES IT A CORRECTION RATHER
THAN A GATE WEAKENED TO PASS (CONTRACT §0 rule 5).** A square of `max(sx, sz)` is
larger than the true AABB on the short axis and **smaller** than it on a rotated
box's long axis — a box yawed 45° reaches `hypot(sx, sz)`. Measured, both
directions on the same run: **71 claims got WIDER** (largest +0.200 m, a spoil
heap at 34° of yaw) and **426 narrower** (largest −1.900 m, a hoarding's
2.4 m square becoming its 0.50 m depth). The old record under-claimed a rotated
feature by up to √2, and that is now closed in the same change.

---

## 3. THE STOP LINE — NOT STARTED, DELIBERATELY

The brief: *"DO NOT START THIS unless items 1 and 2 are finished and written up.
A half-built traffic change is worse than an unstarted one."*

Items 1 and 2 are finished and written up, and **item 3 was not started** — the
census turned out to be three instruments and two repairs, and there was not
enough left to build a reservation on a junction exit, measure it and revert it
cleanly if it did not finish. **`minStopLineM` is still 0 and `worstStopLineM` is
still −10.45 m, untouched, exactly as session 22 left it.** No line of
`traffic.js` was read or changed this session.

The design the brief handed over is unchanged and is repeated here so the next
session does not have to reconstruct it: **a reservation on the EXIT of the
junction box — a vehicle claims the far side before entering and yields if it
cannot.** The one-line measurement that should precede it is still STATE 22 §5's:
record `veh.recycled` alongside the vehicle that sets `worstStopLineM`, because a
recycled vehicle is a teleport and its stop-line distance is bookkeeping.

---

## 4. WHAT COULD NOT BE RUN HERE

Unchanged in kind from sessions 21, 22 and 23: there is no GPU, so every gate
that reads a pixel refuses or is unmeasurably slow. **Nothing that needs one was
attempted, on instruction, and no time was spent proving it again.**

| gate | state this session |
|---|---|
| `parsecheck` | **green**, 86 files (83 + the three new files) |
| `citycheck --falsify` | **green**, 56/56, coverage 100% |
| `citycheck` (generator half) | **green**, run directly: 5 364 claims over the gate's region, **0 forbidden overlaps**, unchanged by this session |
| `citycheck` (delivered half) | **run headlessly, and RED AT 1** — `sign(pylon) × sign(pylon)`, §1.5. It was red at 3 before this session's repair and every one of those three was the instrument |
| `citycheck` (full) | needs a browser; `sceneWalk` and `saturation` were red on this machine in session 22 for machine reasons and nothing here changes that |
| `windcheck` | **not attempted.** Session 23 got three of six eyes before the SwiftShader context died. Still owed — see §5 |
| `faultcheck`, `lookcheck`, `perfcheck` | need a browser. Not attempted |

**`npm run gates` did not run green end to end and could not have on this
machine.** Same honest state sessions 21–23 recorded. Nothing was weakened:
`budget.json`, `city-budget.json` and `look-budget.json` are untouched, no
threshold moved, no assertion was deleted, and the one gate whose number changed
went from red-on-an-artefact to red-on-a-real-defect.

**No frame was taken. No judgement about whether anything reads better is in
this file.**

---

## 5. WHAT THE NEXT SESSION STARTS FROM

### 5.1 The operator's own list — these cannot be done by a session

Listed separately because four sessions have written them as though a session
could do them, and it cannot.

1. **LOOK AT THE VIADUCT'S PORTAL AND THE TRAIN'S RAKED NOSE.** Both are on
   `claude/noctis-23-hud-vsync-ceiling-9fu4nf`, both unmerged, **neither has ever
   been looked at by a human**. The nose's pose is
   `node tools/lookat.mjs --pos=70,1.74,0.9 --target=0,23,11 --fov=52` and it
   died twice on this container. On a real GPU it is seconds.
2. **DECIDE THE SHOULDER CHAMFER.** One line, once the nose has been seen: if the
   nose alone settles the silhouette, the chamfer is cost without benefit and
   should be written off rather than deferred a fourth time.
3. **RUN THE M5 BASELINE.** `budget.json` → `machine.series.m5` is an empty slot
   with the three steps that fill it. `tools/quiet-gates.sh` measures the machine
   it runs on and this is not that machine. **Nothing in this project has had a
   millisecond measured since session 20.**
4. **DELETE TWO MERGED REFS.** `claude/generator-occupancy-registry-6pbuer` and
   `claude/noctis-22-machine-residual-t3u3px`, both verified ancestors of
   `origin/main`. `git push --delete` returns HTTP 403 through this
   environment's proxy and the GitHub tool surface has no delete-branch call.
   **It needs a click, not a retry, and it has been retried enough.**
5. **RUN `npm run gates` ON A MACHINE WITH A GPU.** Every visual gate in this
   project is four sessions stale.

### 5.2 The session's list — these can be done here, without a GPU

1. **THE PYLON-ON-PYLON OVERLAP IS THE ONE RED NUMBER AND IT IS ONE LINE.**
   §1.5. Two pylons 0.32 m apart; the freestanding branch tests the chunk's
   occluders and not the other pylons. Refusing the second back to `flush` costs
   **1 pylon of 36** over the resident ring. `node tools/boxprobe.mjs` prints the
   pair. **It is a content change, which is why this session did not make it.**
2. **THE ROAD PATCH IS CLIPPED AGAINST NOTHING.** §1.6. 10 of 58 near-ring
   patches lie wholly off every carriageway the city drew. `chunk.markings`'s
   `onRoad` is the mechanism and it belongs in `citygen.js` beside it. Cost: up
   to 10 patches of 58 — a content reduction, so it is the operator's call.
3. **THE BUILDING CLAIM IGNORES THE YAW, ON BOTH SIDES.** §1.4. The delivered
   mass reaches 0.47 m outside its own claim and the cantilever 2.48 m.
   `citygen.js` already spells the correct expression three times
   (`paint()`, the kerbside prop claim, this session's pylon). **Measure the cost
   before building it**: widening a building's claim by half a metre may refuse
   buildings, and that is exactly the number `tools/emitcensus.mjs` is for.
4. **THE ROOF PLANT STANDS UP TO 18.72 m ABOVE ITS OWN BUILDING'S CLAIMED TOP.**
   §1.4. `deck × building` is decided by the vertical extent, so a viaduct could
   pass through a roof. Nothing does today. Raising `y1` to the delivered top is
   a claim change with a measurable cost.
5. **FIVE OF THIRTEEN CATEGORIES ARE CLAIMED ON ONE SIDE ONLY.** §1.7 item 1.
   `water`, `path` and `block` never appear in the delivered census; `canopy` and
   `sign` never appear in the generator's. The two-sided check is one-sided for
   those five and no gate says so.
6. **A CLAIM MAY CARRY A KIND THAT IS NOT A CATEGORY.** §1.7 item 2. `'ground'`
   is silently permitted against everything; 25 grass rectangles carry it.
   `buildConflictTable` throws on an unknown name in `FORBIDDEN` and there is no
   equivalent guard on a claim. **This one is genuinely free** — a validation in
   `claimBox` costs nothing and refuses nothing today.
7. **`citycheck`'s DELIVERED SWEEP HAS NEVER RUN OVER A COMPLETE RING.** §1.2.
   `waitForCity` does not assert the geometry ring is built and
   `minDeliveredClaims` = 1 200 cannot notice. Either the harness waits for
   `resident === (2·geometryRadius+1)²` or the gate asserts it. **This is why the
   answer was 2 for two sessions and is 3.**
8. **`tools/lib/headlesscity.mjs` MAKES SEVERAL CARRIED ITEMS REACHABLE HERE.**
   Anything that reads `city.placedClaims()`, `city.stats()`, `chunk.*` or an
   instance matrix now runs in 5 seconds in node with no browser. That includes
   items 3, 4 and 6 above and STATE 22 §6's bench-back question.
9. **`windcheck` IS STILL THE GATE THIS GEOMETRY MOST OWES**, and it needs no
   GPU (STATE 22 §3.1) — it needs a machine that can stream the origin block
   without losing the SwiftShader context, which this one demonstrably cannot.
   Session 23's portal boxes and raked nose have never been through it.

### 5.3 Carried, unchanged, from session 23 and earlier

10. **`PROP_MODELS.lamppost` is placed zero times** over the gate's region. Dead
    content or it should reach the street scatter; today it is neither.
11. **The 790 lamps are in no registry band at all** — §1.4 measures 181 columns
    and 181 heads over this ring and confirms it. Declaring the column as `prop`
    costs 113 forbidden pairs, 72 of them against the carriageway the arm reaches
    over. **The arm is the reason**: 2.1 m of it hangs over the road by design.
    A column and its arm need two bands, not one, and that is the repair.
12. **`floors.visibleInstances` and `drawCalls` on a real route** — counts, so no
    quiet machine needed, but a route `perfcheck` can finish.
13. **The saturation reserve, still unmeasured.** STATE 20 recorded 1.53 points.
14. **The stop line stays at −10.45 m and stays red.** §3.
15. **`index.html`'s `#bootfail`** has still not been through `lookcheck` or
    `gateaudit`. Carried from STATE 21 §9.
16. **A bench's BACK faces nowhere in particular.** STATE 22 §1.2. `band.side` is
    known at the placement and is not read in the yaw. **Reachable headlessly now.**
17. **STATE 21's off-axis fraction of 0.665 does not reproduce** (the gate prints
    0.739). STATE 22 §1.4.
18. **Session 20's items 8 and 14** — vehicle light signatures, vehicle pop-in —
    not started. Diagnosis carried.
19. **`player`'s ceiling at the quiet bar** (STATE 20 §5.3) and **the
    retroreflective BRDF for the markings** (STATE 21 §5.2, 24× at the standard
    entrance angle).
20. **Decide whether `machine` gets an assertion.** The field is inert, which is
    why four sessions have had to remember not to fake it.

---

## 6. KNOWN GAPS CARRIED FORWARD

**Unchanged from s8–s23**: `stats().cutoffM` hard-codes 0.8, the headroom probe
inert, GPU timer queries advertised and never retiring, `saturation-peak.png`
overwritten every run, `$fovYDrift`, `camera.setRouteAt(name, 1.0)` at the sky,
rain streaks near-invisible wide at night, `rain_spray` 0 static, right turns
only, sun shadows to ~170 m, the bake blind to elevated slabs, the PMREM hitch,
the too-red dawn horizon, one worker at queue depth one, the far half of the
river handing back to the night sky past ~300 m, grime authored, the near-field
washboard on the water, the quay wall inside the walkable mask, **props absent
from the walkability mask**, the 3.5°–10.4° route camera pitch, the
frozen/running A/B, and `downtown_dense`'s mean luminance under its floor.

**Resolved this session**: a delivered feature claim that recorded a 2.4 × 0.06 m
panel as a 2.4 × 2.4 m square, and with it all three of the delivered census's
forbidden overlaps; the `sign` category having no claims in it anywhere; the
absence of any enumeration of what does and does not declare itself; the
impossibility of reaching the delivered occupancy census without a GPU.

**Still red and unchanged**: `minStopLineM` at 0, `worstStopLineM` at −10.45 m.
`floors.visibleInstances` unmeasured.

**Newly red, and red on something true**: `occupancy`'s delivered half at **1** —
two sign pylons 0.32 m apart, one's panel through the other's post. §1.5.

**New in CONTRACT §9's table** (four rows, offered for the next session to add
rather than added here, because `parsecheck`'s `contractDocCheck` counts the rows
and the count is a gate):

- a delivered feature claim's `Math.max(sx, sz)` — the LONGER of a box's two
  horizontal extents — used as BOTH of them, so a 2.4 × 0.06 m hoarding panel was
  recorded as a 2.4 × 2.4 m square and `citycheck` was red for two sessions on a
  pair whose solids are 0.84 m apart;
- a conflict count taken over a PARTIALLY STREAMED residency ring read as a count
  over the city, so the answer was 2 where it is 3, with a claim floor derived
  from the near ring alone and therefore unable to notice;
- a building's UNROTATED footprint used as its claim while the mass is drawn at
  up to `CITY.maxYawDeg`, so every yawed building in the city delivers up to
  0.47 m outside what both halves of the two-sided check agree it occupies;
- a matrix's SCALE argument read as an EXTENT — inside the census instrument
  itself, in its first hour: `setMatrix(x, y, z, 1, 1, 1, yaw)` is a unit cube
  against `geometries.box` and an 8.4 m column with a 2.1 m arm against
  `geometries.lamp`, and a sign quad is a plane with no depth at all. Caught by
  the delivered blade footprint reading 1.85 m² where it is 0.03.
