# NOCTIS — STATE

*End of session 40. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2 (24C101), `node v22.22.0`. The
machine has **NOT** rebooted since session 39 — 4 d 18 h of uptime at the first command against
session 39's 4 d 2 h, the same boot. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` WAS 1.77 AT THE FIRST COMMAND AND RANGED 1.77 TO 3.52 ACROSS THE SESSION***, against
CONTRACT §0.2's bar of **1.6**, and it was never once inside it. **SO NO MILLISECOND IN THIS FILE
IS ADMISSIBLE AS AN ABSOLUTE.** `perfcheck` ran twice for its COUNTS, which are load-independent
(CONTRACT §9 rule 6's corollary), and its wall-clock reds are quoted in §7 only to be refused as
evidence — with a worked example of why, because session 39's OWN code measured **19.6 ms faster
at load 3.5 than at load 1.8**, against a change whose whole delta on that route is 1.30 ms.

---

## 0. THE ONE ITEM: THE GROUND THAT IS NOT A BUILDING

The operator's words, and they were the brief: *the density is now something he can live with; what
is wrong is that everything which is not a building stands empty.*

### 0.1 The frames

Take these two first. They are the same camera over the same six blocks, at the same hour, one
seed apart in nothing but this session's change:

```
  tools/shot-out/s40-airD-before-t0_5649-wet.png     oblique aerial over six dead-zone parcels
  tools/shot-out/s40-airD-after-t0_5649-wet.png      fov 55, [330,330,250] → [560,0,400]
```

**BEFORE: a grid of roads with flat brown earth between them.** The parcels are not sparsely
furnished — they carry nothing at all, and they have no surface either, so what fills them is the
world's ground plane. **AFTER: a car park with rows of cars in it, a hoarded lot with a party wall
standing on it, a fenced yard with material stacked on it, and every ordinary block's courtyard
paved and serviced.**

The rest, in the order they answer questions:

```
  s40-carplan-after-t0_5649-wet.png     55 m over one car park — the layout, legible
  s40-carplan-after-t0-wet.png          the same at midnight — three pools and dark between them
  s40-carpark2-{before,after}-t0-wet.png    STREET, 1.7 m, midnight, wet, across the same car park
  s40-carpark2-{before,after}-t0_5649-wet.png   the same pair by day, where the geometry reads
  s40-airB-{before,after}-t0_5649-wet.png   950 m over the region centre, fov 50 — sessions
                                            35–39's own standing aerial pose
  s40-street-{before,after}-t0-wet.png   the road past six dead-zone parcels in a row
```

All fourteen frames have distinct md5s — the check session 37 had to add after `lookat` silently
truncated a parameter and delivered seven copies of one city. `tools/shot-out/` is gitignored and
regenerable; the commands are in §6. **The "before" arm of every pair was rendered from session
39's own `src/` at `866022a`**, in this tree, at this load — not quoted from a previous session's
file.

### 0.2 The per-hectare table, before and after

`tools/groundprobe.mjs` is new this session. It measures **objects per hectare of OPEN GROUND**,
not per chunk, because every chunk is the same 128 m square and every island the same 104.6 m
square while the ground a prop could stand on is not: a `built` island has half of itself under a
building and a park island has a pond on it. Open ground is the island minus the **exact** union of
every `building`, `landmark`, `water` and `block` claim standing on it — coordinate compression,
not a raster, so a reading of 0.0 is a fact and not a sampling miss.

**Pooled over twelve regions of 10 × 10 chunks, seeds 1337–1348, 1 200 chunks:**

```
  kind          chunks   open ha   objects per hectare of open ground   chunks with NOTHING
                          median    s39      s40                        s39      →   s40
  parking          41     1.094      0.0    180.1                       26/41    →    0/41
  lot              45     1.094      0.0    163.6                       29/45    →    0/45
  yard             45     1.094      0.0    149.9                       29/45    →    0/45
  built           963     0.538      7.0     46.0                      114/963   →   12/963
  park             47     1.094    187.4    187.4   unchanged             0/47    →    0/47
  construction     59     1.094    174.6    174.6   unchanged             0/59    →    0/59

  the block interior — the 23.4 m light well no building may reach
    wells with nothing standing in them                              659/963   →  187/963
    objects per hectare of open well, median                             0.0   →     54.8
```

**84 of the 131 `parking`, `lot` and `yard` chunks delivered nothing at all** on 1.094 hectares of
open ground, and the two kinds anybody had given a floor delivered 187 and 175 per hectare.

---

## 1. THE HYPOTHESIS IN THE BRIEF READS CORRECTLY OFF THE CODE, AND IT UNDERSTATES THE RESULT

The brief carried an arithmetic claim with a warning attached to it — *"I have written a false
premise into eighteen consecutive briefs; verify it first."* Verified. `citygen.js` computed prop
counts exactly as the brief said:

```
  park          22 + 26 · density        a floor of 22
  construction  14 + 16 · density        a floor of 14
  everything else   (lowDetail ? 26 : 96) · density³      no floor at all
```

**AND THE CUBIC LAW AND THE GATE THAT SELECTS THE KIND READ THE SAME FIELD.** `lowDetail` is
`density < CITY.lowDetailThreshold` = **0.34** — that is what makes a chunk `parking` in the first
place — so `26 · d³` on one of these chunks **cannot exceed `26 × 0.34³` = 1.022**, and it rounds
to **zero** below `d = 0.268`. The three kinds were not sparsely furnished. **They were capped at
ONE OBJECT PER CHUNK by construction**, and the delivered counts say so:

```
  over twelve regions, what the law ASKED FOR before this session
    parking    0 objects on 26 chunks, 1 on 15    highest density reached 0.337
    lot        0 on 28, 1 on 17                                          0.329
    yard       0 on 28, 1 on 17                                          0.338
```

So the brief's *"about three objects on a whole low-detail chunk at density 0.5"* and *"at 0.4 it
is one and six"* describe densities these kinds **cannot have**. (At 0.4 the cubic gives 2, not 1;
but 0.4 is unreachable for a low-detail chunk, so the whole sentence is about a case that does not
occur.) The premise is right and the number it implies is worse than the one it quoted.

### 1.1 One number in the code disagreed with its own comment, and the comment loses

`SITE`'s clutter floor carries *"14 plus a density term over the 104.6 m island is one object every
26 m"*. The form is `104.6/√N`, which is what `PARK`'s own *"one object every 22 m"* is
(`104.6/√22` = 22.3). But `104.6/√14` is **28.0 m**; **26.15 m is `104.6/√16`, the SLOPE's spacing
rather than the FLOOR's.** The constant is unchanged and correct; the arithmetic quoted beside it
was one substitution out, and it is corrected in the open beside the new floors (CONTRACT §9
rule 5).

---

## 2. THE LAW WITH A FLOOR — BRIEF ITEM (b)

`DEAD_ZONE` in `citygen.js`, beside `PARK` and `SITE`. **The floor is what the kind IS, not what
the density field says**, and every one is derived from a length that belongs to that kind. The
form is stated once and it is `PARK`'s own: `104.6/√N` is the mean spacing N objects have over the
104.6 m island.

```
  kind      law           spacing   the length it comes from
  parking   12 + 16·d      30.2 m   the square a 10 m lighting column covers to a car park's
                                    10 lx — a surface lot's fixtures ARE its lighting
  yard      24 + 16·d      21.4 m   the apron a 7.0 m rigid van needs to back into a stack,
                                    three of its own lengths. The densest of the five,
                                    because a yard is the one dead zone that is WORKED
  lot        9 + 12·d      34.9 m   one object per THIRD of the island on each axis. There is
                                    no module to derive from because nothing operates here,
                                    and 9 is the smallest number that is a placement
  core      12 + 14·d      21.4 m   the SAME van apron, over the 0.538 ha of open island a
                                    built chunk actually has: 5 380 / 21.4² = 11.7 → 12
```

The `lowDetail ? 26` arm of the old law is gone, because nothing reaches it any more. The `built`
arm — `96 · d³` — is **untouched**: that is the law for an ordinary block's STREET furniture, 82%
of which goes kerbside, and what the block interior gets is a separate pass (§4).

---

## 3. WHAT EACH KIND IS MADE OF — BRIEF ITEM (c)

The tables the brief quoted, and what they are now. **The structured content is `features`; the
scatter is `props`. A thing is a feature if its placement is a RUN, a ROW or a GRID** — the
distinction `park` has always drawn between its trees (scattered) and its edging, lamps and centre
piece (structured). §5 prices that split, because it moves a gate.

```
  parking   was  bollard, lamppost, planter — not one of them a parked vehicle
            now  ASPHALT, first surface this kind has ever had
                 BAYS: two double-loaded 16.0 m modules (5.0 bay + 6.0 aisle + 5.0 bay)
                       across the middle of the island, painted as `markings` — a 4 mm box
                       like every other line in the city, claiming nothing, so a car may
                       stand on its own bay line
                 CARS: occupancy is the CHUNK'S OWN DENSITY. LOOK.md §2's "density has
                       causes", on the one surface in the city where the cause and the
                       field are literally the same quantity. The PAINT is there at every
                       density; that is the floor
                 COLUMNS: 10 m, on the 30 m grid the prop floor is derived from
                 A KNEE RAIL with one entrance
                 props  bollard, bollard, cabinet, bin, planter, fence

  yard      was  container, fence, bollard — the three-name DEFAULT, shared with `lot`
            now  CONCRETE HARDSTANDING
                 A 2.2 m PALISADE with a gate — a yard is a SECURED parcel, and that is
                       what distinguishes it from a lot
                 TWO FLOOD MASTS, reusing the site's own
                 ONE OR TWO VANS backed up to the material on a ring two thirds out
                 props  stack, stack, stack, container, bin, cabinet, fence

  lot       was  container, fence, bollard — the same three
            now  THE SITE'S OWN STRIPPED HARDCORE, its PLYWOOD HOARDING and its SPOIL
                       HEAPS, all reused: a cleared lot IS a site with nothing happening
                       on it
                 A PARTY WALL — the one thing a site does not have. The flank the last
                       building left, with the ghost of its floors and a chimney breast,
                       on a lot line, placed BEFORE the hoarding so the hoarding breaks
                       around it
                 props  fence, stack, container, bollard
```

**ONE NEW PROP KIND, AND THE TEST FOR ADDING ONE IS LOOK.md §5's.** `stack` — sawn timber and sheet
on bearers, steel drums, palletised blocks under a tarpaulin. `container` is a skip and a shipping
box, and both are what material arrives *in*; nothing in the nine kinds that existed was material
lying about. It is derivable from what the city already has (a `yard`, declared since session 4)
rather than placed because it signifies.

**ONE NEW CONSTANT.** `LIGHT.carParkColumnCandela` = 6 200, derived exactly the way
`parkLampCandela` was: `E = I·cos³(57°)/h²` at `h` = 10.0 m for a 10 lx surface car park.
**0.91× a street lamp's peak delivering 0.63× its illuminance**, against the park lamp's 0.128×
delivering 0.50× from half the height. So a park and a car park now read as different kinds of dark
rather than as the same empty rectangle — which is the point of the constant and is in LOOK.md §4.

---

## 4. THE BLOCK INTERIOR — BRIEF ITEM (d)

`lotDepthM()` is **40.6 m**, so the central `104.6 − 2 × 40.6` = **23.4 m** square of every island
is ground no perimeter building may reach by construction. **659 of 963 built chunks had nothing
standing in it.**

**AND A BUILT ISLAND EMITTED NO GROUND RECTANGLE AT ALL.** The courtyard was the world's earth
plane, `GROUND.earth` = −0.02 m, which is what is under a road where there is no road. **There was
no floor under the block interior**, and that is why it read as nothing from the air even where
something stood in it. It now carries one: the island minus every solid on it, which is *exactly*
the quantity `groundprobe` calls open ground, so the surface and the measurement are the same
rectangle set.

**WHAT A LIGHT-WELL CORE CONTAINS IS THE BLOCK'S OWN SERVICING** — bin stores, plant, stacked
material, a skip, and a delivery bay with a van on it. That is the answer to *"what is this ground
for"* rather than a decoration, and it is what makes the count derivable at all.

**SCATTERED OVER THE WHOLE ISLAND AND NOT OVER THE 23.4 m WELL**, and the registry is what makes
that right: `reg.conflict` refuses every spot a building stands on, so what is left is the
courtyard AND the gaps in the perimeter run. Session 39 measured those gaps — 188 of 267 fall
mid-side and *"every one of them is a yard"* — so a service yard is exactly what belongs in them,
and confining this to the well would have left the part a walker can actually see empty.

```
                                          s39        s40
  built, objects per ha of open ground    7.0        46.0
  built chunks with nothing on them     114/963     12/963
  light wells with nothing in them      659/963    187/963
  objects per ha of open light well       0.0        54.8
  core props asked / given up                    18 930 / 1 386   (7.3%)
```

---

## 5. THE RE-PHASE — AND THIS TIME THE NAMED STREAM DOES REACH IT

**NOT ONE BUILT CHUNK MOVED.** Session 39 had to re-phase the whole city and said so; this session
did not, and the digest is the proof. Over `citycheck`'s own 10 × 10 at seed 1337, before and after
the whole change:

```
                       session 39 tip        session 40          verdict
  built buildings      3085ddbfc3a768c1      3085ddbfc3a768c1    IDENTICAL   687 buildings
  built signs          2a653e66aa1bcc55      2a653e66aa1bcc55    IDENTICAL   976 signs
  built STREET props   8fd12075147a7c24      8fd12075147a7c24    IDENTICAL   1 483 props
  built road ground    5ad528912f5c4c43      5ad528912f5c4c43    IDENTICAL
  low-detail props     6c5f741edbe606b6      632ea65f29ded2b3    changed     106 → 316
```

**WHY IT WORKED HERE AND NOT IN SESSION 39.** CONTRACT §6: *"Streams are independent, so adding a
new system cannot shift an existing one's sequence."* Session 39 recorded that a named stream could
NOT help with the walk's re-phase, because the extra draws there belonged to the added BUILDINGS
and had always come from the chunk stream. Here the opposite holds — **every draw belongs to an
object that did not exist** — so `chunkRng(rootSeed, cx, cz, 'core')` and its own yaw leave
everything above them untouched. `featRng` needed no new stream at all: it is per chunk, a chunk is
exactly one kind, and the three new branches draw where no park has ever reached.

`citycheck`'s registry-refusal line is the same evidence from the other side: **building 190,
landmark 102, block 40, water 31, pavement 9, deck 9, carriageway 6 — every one of them identical
to session 39.** So is `walkability`, at 54 511 of 54 653.

### 5.1 THE PRICE, AND IT IS THE CLUMPING GATE

**`citycheck`'s prop-density CV fell 0.566 → 0.431** against a floor of 0.60 it has been under for
six sessions, and the twelve-region population went from **9 of 12 below the floor to 12 of 12**:

```
  s39   median 0.574   min 0.249   max 0.964    9 of 12 below 0.60
  s40   median 0.437   min 0.217   max 0.576   12 of 12 below 0.60
        0.431 0.310 0.471 0.222 0.448 0.471 0.472 0.576 0.435 0.217 0.361 0.439
```

**THIS IS THE PREDICTED COST AND IT WAS MEASURED BEFORE ANYTHING WAS BUILT.** The park's own
comment already says it: *"filling a low-density chunk is exactly what a coefficient of variation
punishes"*, and it prices the three parks in the region at 0.046 of CV. This change fills the
emptiest chunks in the city on purpose.

**THE STATISTIC CORRELATES 0.92 WITH HOW MANY CHUNKS IN THE WINDOW ARE EMPTY** (STATE 37 §4.2), and
what this change did is make fewer chunks empty. Its own second assertion moved the other way:
**`populatedFraction` 94% → 99% against a floor of 55%**, and the gate's own message for that
conjunct reads *"a high CV bought by emptiness is not clumping"*.

**NO THRESHOLD WAS MOVED** (CONTRACT §0 rule 5) and **no re-derivation was attempted**, because
LOOK.md §7 and STATE 39 §10 both say the same thing: a threshold re-derived by the session whose
change breached it is indistinguishable from a threshold tuned green. It is item 2 on §11's list.

**AND THE FEATURE/PROP SPLIT IS DECLARED RATHER THAN LEFT TO BE INFERRED, because it moves this
number.** `objectCount` is `buildings + props + signs` and does **not** count features, so a row of
parked cars (a feature) does not enter the CV while a scatter of stacks (a prop) does. The split
was made on the PLACEMENT — run, row or grid is a feature; scatter is a prop — which is the rule
`park` already followed. Both halves are printed above so nobody has to take it on trust.

---

## 6. THE FRAMES, AND WHAT THEY SAY

```
D  node tools/lookat.mjs --pos=330,330,250 --target=560,0,400 --fov=55 --t=0.5649 --wet=1 \
     --name=s40-airD --tag=<before|after>
B  node tools/lookat.mjs --pos=0,950,0 --target=-200,0,-200 --fov=50 --t=0.5649 --wet=1 \
     --name=s40-airB --tag=<before|after>
P  node tools/lookat.mjs --pos=576,55,86 --target=576,0,196 --fov=60 --t=0.5649,0 --wet=1 \
     --name=s40-carplan --tag=after
C  node tools/lookat.mjs --pos=521,1.7,168 --target=605,2.0,196 --fov=60 --t=0,0.5649 --wet=1 \
     --name=s40-carpark2 --tag=<before|after>
S  node tools/lookat.mjs --pos=505,1.9,100 --target=512,6,560 --fov=55 --t=0 --wet=1 \
     --name=s40-street --tag=<before|after>
```

The `before` arms were taken with `git checkout 866022a -- src/` in place and the tree restored
after each; `git status --short` was read clean before every commit.

- **(D) is the pair the item is judged on and it is not close.** Before: six parcels of flat brown
  earth in a grid of roads, the parks and the construction sites the only ground in frame with
  anything on it. After: a car park with four rows of cars behind a rail, two hoarded lots, two fenced
  yards, and every ordinary block's courtyard a paved service yard instead of a hole.
- **(P) is what says the car park is a car park**: bay lines, rows, columns, and the parcel's own
  circulation round the outside.
- **(B), 950 m straight down over the dense core, barely moves — and that is honest.** In the core
  the block interiors are small and mostly roofed over; what changes is a slight greying and a
  speckle. The change reads where the cores are big, which is where the operator's complaint was.
- **(C) from the pavement**: before, an empty wet plain to the horizon. After, a knee rail, bay
  paint, and rows of parked bodywork. At MIDNIGHT the same parcel is three pools of light with dark
  between them, which is what 10 lx from 10 m columns at 3× mounting-height spacing looks like —
  the derivation is in `LIGHT.carParkColumnCandela` and the frame is the check on it.

### 6.1 Three things the frames say that no number here does

1. **THE PARKED VEHICLES WERE SLABS ON THE FIRST TRY AND THE FRAME IS WHAT CAUGHT IT.** Five boxes
   stacked concentrically is a loaf however carefully the heights are chosen — LOOK.md §4's *"more
   detail on a box is a detailed box"*, from the other side. The repair is that **a wedge is
   something the SIDE ELEVATION does**, so the masses are offset ALONG the length: the car's body
   stops 1.2 m short of its own nose and a bonnet 0.20 m lower fills the gap. One step down at the
   front reads at forty metres; four concentric steps do not read at four.
2. **THE YARD IS THE WEAKEST OF THE THREE FROM THE AIR.** Its 24 stacks are scattered uniformly over
   the island by the low-detail scatter, and a real works yard stacks its material AGAINST THE
   BOUNDARY with a clear apron in the middle. The count is derived and was not changed to flatter a
   frame; the PLACEMENT is the thing worth changing and it is §11 item 4.
3. **A CAR PARK'S NEAR TWO THIRDS IS BARE FROM THE PAVEMENT.** `DEAD_ZONE.modules` is 2, using
   32.0 m of the 104.6 m island, and the rest is circulation. It reads from the air and it is empty
   at eye level. Also §11 item 4.

---

## 7. GATE STATE

Run individually, because `npm run gates` is `&&`-joined and stops at the first red.

```
  parsecheck   GREEN   111 files (110 + tools/groundprobe.mjs), contract-clean
  windcheck    GREEN
  faultcheck   GREEN   7 cases; quarantine surgical, frame survives all seven
  gateaudit    RAN. Every perturbation case passes and all four --falsify suites are green
               (perfcheck 74/74, citycheck 61/61, inputcheck 13/13, thresholds). Its ONLY
               failure is the CONTROL, which is lookcheck's own four reds restated:
               "the unperturbed frames do not pass their own gate". NO THRESHOLD DRIFT.
  citycheck    RED at 3 — was RED at 4. §7.1
  lookcheck    RED at 4 — byte-identical to session 39 in all four bands. §7.2
  inputcheck   RED at 4 — carried, unrepaired by instruction. FIFTH session. §7.3
  perfcheck    RAN for its COUNTS on highway_speed, twice, on both arms. Its wall-clock
               reds are INADMISSIBLE and §7.4 shows why with a number.
```

### 7.1 `citycheck` — RED AT THREE, AND ONE OF SESSION 39's FOUR IS NOW GREEN

```
                                   session 39        session 40
  clumping CV                        0.566             0.431      RED, floor 0.60, WORSE — §5.1
  forbidden overlaps, delivered        3                 3        RED, max 0 — carried, §7.1.1
  sign quads inside a building         2                 2        RED, max 0 — carried
  bright reserve                     6.00%             6.14%      GREEN, floor 6.00% — was RED
  generator claims                   5 670             9 276
  delivered claims                   4 458             9 457
  props inside a building footprint  0 of 1 589        0 of 3 340
  walkability                    54 511 / 54 653   54 511 / 54 653   identical
  registry refusals   building 190, landmark 102, block 40, water 31, pavement 9, deck 9,
                      carriageway 6 — every one identical to session 39
```

**THE GENERATOR'S OWN REGISTRY IS CLEAN: 0 forbidden overlaps over 9 276 claims and 53 forbidden
pairs**, which is brief item (e) answered with a number. Everything this session placed — a bay
marking, a parked car, a palisade segment, a party wall, a core bin store — was tested before it
was placed and refused rather than moved.

**THE BRIGHT RESERVE WENT GREEN AND THE MECHANISM IS PLAUSIBLY THIS SESSION'S.** Its history:
red for six sessions to s36 (5.67% at s35, 5.33% at s36), green at s37 on session 37's fill raise
(6.37%), red again at s39 (6.00%). Three surfaces that were the earth plane are now lit ground and
**39 luminaires were added over the region** — 33 ten-metre car-park columns and 6 yard flood
masts, against the 37 park lamps that were already there — so a rise is the expected direction. Per-run means
`[6.52 6.00 6.14]` against session 39's `[6.32 6.00 6.00]`. **The margin over the floor is 0.14
points against a printed spread of 0.53, so it is inside the noise and is reported as a colour
change rather than as a result** (CONTRACT §0 rule 6). No number moved.

#### 7.1.1 The delivered overlaps: two were mine, and repairing them found a defect from session 21

The first run after the content landed read **5** forbidden overlaps against session 39's 3, and
the two new ones were `prop(container) × site(hoarding)` at 0.133 and 0.105 m². The generator's own
registry said 0, so the claim and the delivery disagreed — CONTRACT §9.1's arrangement.

**MEASURED: `city.js` draws a hoarding panel 0.06 m thick AND TWO FEET.** `put(±0.42·L, 0.06, 0.18,
0.34, 0.12, 0.5)` — a 0.5 m brace offset 0.18 m to one side — so the delivered footprint runs
`z ∈ [−0.07, +0.43]` about the panel's centreline. **The claim was a symmetric ±0.12. It did not
contain the feet at all**, and a hoarding's feet are the part of it something stands next to.

> **STATE 22 DIAGNOSED THIS TO THE FEET AND COULD NOT CLOSE IT.** It computed `0.34 × 0.5` =
> 0.170 m² against 0.173 measured, built two candidate repairs on the generator's claim, measured
> both as changing nothing, and reverted them. Session 24 then found the delivered census reading a
> 2.4 × 0.06 panel as a 2.4 × 2.4 SQUARE and repaired that — which removed the false half of the
> pair and left the true half standing for sixteen sessions. **The measurement that closes it is
> the one both sessions already had in front of them: the claim is 3.6× narrower than the boxes.**

`SITE.hoardingHalfDepth` = 0.43, read by the site's own run and by the cleared lot's. Symmetric, so
it over-claims on the panel side, which is `occupancy.js`'s stated safe direction. **Delivered
overlaps 5 → 3, and no hoarding panel was lost** (984 delivered, 495 construction + 489 lot, both
unchanged): a hoarding runs first on an empty parcel, so a wider claim refuses no panel and only
refuses the props that come after it.

The three that remain are all `sign × prop` and `sign × sign` — `sign(adpillar) × prop(tree)`
0.013 m², `sign(pylon) × sign(pylon)` 0.095 m², `sign(adpillar) × prop(planter)` 0.094 m². That is
STATE 39 §11 item 6 unchanged: **the generator's registry contains no `sign` claims and no `prop`
claims**, so which signs collide is a lottery on the stream, and this session re-rolled it with
more props.

### 7.2 `lookcheck` — RED AT FOUR, THREE RUNS, ZERO SPREAD, AND IDENTICAL TO SESSION 39

```
              run 1     run 2     run 3     band             session 39
  midnight    0.0752    0.0752    0.0752    [0.072, 0.112]   0.0752  green
  dawn        0.3023    0.3023    0.3023    [0.299, 0.353]   0.3023  green
  noon        0.4278    0.4278    0.4278    [0.428, 0.482]   0.4278  RED by 0.0002
  dusk        0.1392    0.1392    0.1392    [0.140, 0.180]   0.1392  RED by 0.0008
```

**ALL FOUR BANDS MOVED BY 0.0000 ON A CHANGE THAT ADDED 39 LUMINAIRES AND THREE NEW GROUND
SURFACES OVER THE REGION.** That is not a surprise and it is worth recording as a confirmation:
`lookcheck` stands in the ORIGIN BLOCK, which `block.js` authors and the generator never touches
(STATE 35). It is the cleanest demonstration this project has had that the four look bands are
blind to the generated city. `facadeAlbedo` and `facadeNeighbours` are the other two reds, both
carried from session 31 and both about the origin block's own walls.

### 7.3 `inputcheck` — RED AT FOUR, FIFTH SESSION, STILL NOT THIS SESSION'S

Carried forward unrepaired by instruction. The numbers are within 0.03 m/s and 0.08 °/s of session
39's, session 38's, session 37's and session 36's:

```
  ✗ keyboard:walk   3.238 m/s   against PLAYER.walkSpeedMps 3.500      7.5% off, tol 6%
  ✗ keyboard:run    6.210 m/s   against PLAYER.runSpeedMps 7.000      11.3% off
  ✗ gamepad:walk    3.238 m/s   against 3.500
  ✗ gamepad:look  160.16 °/s    against PLAYER.maxLookRateDegPerS 180
```

Bisected in session 36 to **`0f60c9a`**, machine and collision ruled out, mechanism still unknown.
**Carried five times now.** See §11 item 1.

### 7.4 `perfcheck` — THE COUNTS, AND A WORKED EXAMPLE OF WHY THE MILLISECONDS ARE NOT

`--route=highway_speed`, the binding route. **Both arms were run in this tree at this load**, the
"before" arm with `git checkout 866022a -- src/` in place, so the comparison is paired rather than
quoted:

```
  ADMISSIBLE (counts; CONTRACT §9 rule 6's corollary)      s39 arm      s40 arm      bound
    draw calls                                               434          434        ceiling 440
    triangles                                            2 090 000    2 130 000      ceiling 2 360 000
    visible instances                                      295 103      309 095      floor 115 000
    distinct materials                                          67           67      floor 48
    chunk memory                                          66.69 MB     68.45 MB      ceiling 96 MB

  INADMISSIBLE — quoted only to be refused
    wall p95                                               71.60 ms     72.90 ms
```

**THE TRIANGLE CEILING DOES NOT BIND.** +40 000 triangles is **+1.9%**, and the headroom against
session 37's honestly re-derived 2 360 000 goes from **13.0% to 9.8%**. **DRAW CALLS DID NOT MOVE
AT ALL** — every prop, feature and marking rides in the chunk's own box mesh, which is the
arrangement that makes this affordable. Instances +4.7%, chunk memory +2.6% of its ceiling.

**AND HERE IS WHY NO MILLISECOND IS QUOTED AS A RESULT.** The FIRST `perfcheck` of the session, on
session 39's own code at `load1 ≈ 1.8`, measured **wall p95 91.20 ms**. The paired arm of the SAME
code two hours later at `load1 ≈ 3.5` measured **71.60 ms** — **19.6 ms faster on identical code**,
against a bar this session never met. The change's own delta over that arm is 1.30 ms, i.e. **7% of
the spread the same code produced against itself.** CONTRACT §0.2 in one table.

#### 7.4.1 The silhouette bars have a spread nobody had printed, and it is larger than the arms

`highway_speed` reports two vehicle-silhouette bars LOOK.md §4 tracks. Three observations this
session:

```
   arm        load1     vehicles   ground contrast   ground-gap %   tone-profile %
   s39 code    ~1.8        71          0.885           (green)          59%
   s39 code    ~3.5        68          0.7339          (green)          57%
   s40 code    ~3.4        70          0.7011           70% RED         51%
```

**THE SAME CODE PRODUCED 0.885 AND 0.7339 — a spread of 0.151 — while the two ARMS differ by
0.033.** The sampled population itself moves with the load: 71 vehicles at `load1` 1.8 and 68 at
3.5, on identical code, and the route delivered a different number of frames at the two loads
(1 877 against 1 867 GPU queries issued). **The two PAIRED arms issued the same 1 867 and still
sampled 68 against 70**, which this session cannot attribute either way. So the honest reading is
that these percentages are read off whichever vehicles a sampler caught, against a spread larger
than any difference anybody has compared with them, and **neither bar is evidence about this change
in either direction.** This is the first session to print the population that says so. CONTRACT §0
rule 6, applied to a statistic nobody had pooled. §11 item 5.

---

## 8. WHAT THE INSTRUMENT IS AND WHAT IT ASSERTS

`tools/groundprobe.mjs`, **and it asserts nothing about the city — `citycheck` owns the verdicts.**

```
  node tools/groundprobe.mjs               objects per hectare of open ground, by block kind
  node tools/groundprobe.mjs --law         the prop-count law, arm by arm, with the ceiling
  node tools/groundprobe.mjs --interiors   the built block's own light well
  node tools/groundprobe.mjs --vocab       what each kind is actually made of
  node tools/groundprobe.mjs --seeds=a,b   pooled over regions
```

Three things about it are worth carrying forward:

- **PER HECTARE AND NOT PER CHUNK**, for the reason §0.2 gives. A per-chunk count made `built` and
  `parking` look comparable when their usable ground differs by 2×.
- **THE OPEN AREA IS EXACT, NOT SAMPLED.** Coordinate compression over the solid claims clipped to
  the island. A raster fine enough to be trusted here would be 4.4 M point queries per region; this
  is a few hundred rectangles per chunk and it cannot miss a gap.
- **IT REPORTS THE DISTRIBUTION, NOT A MEAN** — min, p25, median, p75, p90, max and the count of
  chunks delivering ZERO, which is the column the whole finding lives in.

---

## 9. WHAT WENT ON THE BRANCH

Branch `claude/noctis-40-ground`, cut from `866022a` (the tip of session 39's
`claude/noctis-39-walk-ceiling`), pushed after every commit. **No merge to main.**

```
  5d0e6b4  the parked vehicles were slabs, and the frames said so before any number did
  94f2760  LOOK.md §2: the reason a parcel is empty was declared and never drawn
  214c46c  the hoarding's claim was 3.6x narrower than its own feet, and had been since s21
  f523445  the block interior: a light well is a service yard, and it had nothing in it
  9dd7148  parking, yard and lot: a law with a floor, and the things that belong to the kind
  901df4f  groundprobe: what stands on the ground that is not a building, per hectare
  866022a  <- session 39's tip, the branch point
```

**ONE REVERTIBLE COMMIT PER STAGE.** `f523445` (the block interiors) can be reverted on its own
without touching the three dead-zone kinds, and `214c46c` (the hoarding claim) on its own without
touching either.

**STAGED BY NAME AT EVERY COMMIT.** `git status --short` was read before each one and never showed
more than the files named in it; **`git add -A` was not used**, and `parsecheck` counted 111 files
where session 39 counted 110 — the one file being `tools/groundprobe.mjs`. That count is the only
thing that caught the iCloud sync-conflict copy of `citygen.js` in session 37.

**NO THRESHOLD MOVED. NO BUDGET FILE WAS TOUCHED.** `budget.json`, `city-budget.json`,
`look-budget.json` and `input-budget.json` are byte-identical to session 39. `clumping` stays red
and no value was proposed for it.

`origin/main` still carries session 34's `b2ad696` and nothing after it — the repair STATE 34 §10
names is still one command and still the operator's:

```
git push --force-with-lease origin 2b04ace:main
```

---

## 10. WHAT WAS NOT BUILT, AND WHY

- **The yard's placement.** §6.1 item 2 — its stacks scatter uniformly where a works yard stacks
  against its boundary. The COUNT is derived and was not touched to flatter a frame; the placement
  is the thing worth changing and it is not this item's floor.
- **More bay modules.** §6.1 item 3 — `DEAD_ZONE.modules` is 2 with an argument beside it, and
  raising it to fill the parcel would be a number chosen from a frame rather than derived.
- **The clumping statistic.** §5.1 — measured, printed, made worse on purpose, and left exactly
  where it was. A re-derivation by the session that breached it is a threshold tuned green.
- **Anything about signs.** §7.1.1 — the three remaining delivered overlaps are all `sign ×`
  something and the mechanism is that signs are not in the registry. Not this item.
- **A pedestrian that a palisade stops.** §12 — the walkability mask blocks buildings, landmark
  ground blockers, the origin block and the water, and nothing else. A yard is secured in the
  geometry and open in the mask, exactly as a park railing has been since session 21. Recorded, not
  repaired.
- **No quiet battery, no admissible millisecond.** `load1` ran 1.77–3.52 against a bar of 1.6.
- **Nothing else was started.**

---

## 11. WHAT TO DO FIRST NEXT TIME

1. **`inputcheck`, AND IT HAS NOW BEEN CARRIED FIVE TIMES. IT MUST BE THE NEXT SESSION'S ONLY
   ITEM.** §7.3. Red since `0f60c9a`, which STATE 35 reported as green; bisected in session 36,
   machine and collision ruled out, reproducible to 0.03 m/s across five sessions, mechanism
   unknown. **It is the only gate in this project that went from green to red without anybody
   noticing, it is a shipped control regression, and it has now outranked everything on this list
   four times without being done.** Nothing below this line should be started before it.

2. **THE CLUMPING STATISTIC, REPLACED RATHER THAN RE-NUMBERED — and this session made the case
   unavoidable.** §5.1. It correlates 0.92 with how many chunks in the window are EMPTY (STATE 37
   §4.2), and a change whose entire purpose was to make fewer chunks empty took it from 9 of 12
   regions below the floor to 12 of 12 while its own populated-fraction conjunct moved 94% → 99%.
   **A statistic that gets worse when the thing it measures gets better is not measuring it.** The
   gate's own message for the second conjunct already says so: *"a high CV bought by emptiness is
   not clumping"*. STATE 37 §4.2 hands over the twelve-region population and the reason a number
   cannot fix it.

3. **THE NARROWING VERDICT — the largest remaining honest gain in the walk.** Carried from STATE 39
   §11 item 2, untouched. 51 refusals with 11 m or more of clear frontage beside the claim, 845 m,
   2.4% of the island edge, and the pads stay exactly as they are. `padprobe` prints the population
   and `WALK` is where the arm goes.

4. **THE YARD STACKS AGAINST ITS BOUNDARY, AND A CAR PARK'S APRON IS TWO THIRDS OF IT.** §6.1.
   Both are PLACEMENT questions with the counts already derived, and both are what the frames say
   is left. `groundprobe --vocab` is the instrument; judge it from (D) and (C), not from a number.

5. **THE TWO VEHICLE-SILHOUETTE BARS HAVE A SPREAD LARGER THAN ANY ARM ANYBODY HAS COMPARED WITH
   THEM.** §7.4.1 — the same code measured ground contrast 0.885 and 0.7339, and the sampled
   population moved 71 / 68 / 70 vehicles. LOOK.md §4 quotes these as 73% and 63%, STATE 39 quoted
   68% and 52%, this session read 70% and 51%. **Pool them or stop quoting them**, and note that
   `perfcheck` already pools its COUNTS worst-case and does not pool these.

6. **`band:noon` AND `band:dusk` HAVE NO SURVIVING MECHANISM, AND THIS SESSION IS THE STRONGEST
   EVIDENCE YET.** §7.2 — 39 new luminaires and three new lit ground surfaces moved all four bands
   by **0.0000**. The bands are blind to the generated city because `lookcheck` stands in the
   origin block. Ask what they are actually measuring before moving anything.

7. **The two sign quads inside a building and the three delivered `sign ×` overlaps.** §7.1.1 —
   **the generator's registry contains no `sign` claims and no `prop` claims.** Until a sign is a
   claim, this gate's count is a lottery on the stream, and every session that adds props re-rolls
   it.

8. **The condenser's ground claim is NARROWER than the tower it stands for.** Carried from STATE 39
   §11 item 7, untouched. `landmarkOccluders` scales a hyperboloid's radius by 0.82 for the canyon
   bake, so the claim's half-width is 50.8 m against a 62 m base radius. A question, not a finding.

9. **The end-of-run gap.** Carried from STATE 39 §11 item 3, untouched, and it is now **partly
   answered from the other side**: every one of those gaps is a yard, and a yard now has a surface
   and things standing on it, so the gap reads as a parcel rather than as a hole. The sweep STATE 37
   §7.2 asks for is still unrun.

10. **A quiet battery.** Every millisecond in the last eight STATE files is inadmissible. This one
    needs the operator and `tools/quiet-gates.sh`.

---

## 12. KNOWN GAPS CARRIED FORWARD

**Unchanged from s8–s39**: `stats().cutoffM` hard-codes 0.8, the headroom probe inert,
`saturation-peak.png` overwritten every run, `$fovYDrift`, `camera.setRouteAt(name, 1.0)` at the
sky, rain streaks near-invisible wide at night, `rain_spray` 0 static, **right turns only**, sun
shadows to ~170 m, the bake blind to elevated slabs, the PMREM hitch, the too-red dawn horizon, one
worker at queue depth one, the far half of the river handing back to the night sky past ~300 m,
grime authored, the near-field washboard on the water, the quay wall inside the walkable mask,
props absent from the walkability mask, the 3.5°–10.4° route camera pitch, the frozen/running A/B,
`materials.display` drawn by nothing, the hauler's marker row buried inside its own body, the
seeding fallback's untested placement, **a bus never turns**, the origin block's absent occupancy
registry, `facadeAlbedo` on its floor with zero spread, the station's cores reading as an open
frame, **nobody can climb the station**, the 0.10 m margin at the core's outer face, `poseprobe`'s
blindness to the origin block, the pavement's missing kerb, `tools/city-budget.json:84`'s stale
`$derivation_count`, one merged building pool breaching the triangle ceiling, the station's platform
slab hiding the train, `traffic.js:2346`'s claimed draw-call margin of one, `minStraightness` and
`minArrivalsPerMinute` having no gate reader, the zero-second protected pedestrian phase, **44 100 m²
of the city is an empty concrete bowl**, `landmarkBlocks` still exported and still disagreeing with
the registry two ways, **the basin is walkable in the mask and unwalkable in the geometry**, the two
`walkableAt` sites still blind to a basin, the dish delivering 88 m of structure against a 62 m
keep-out, the quay walk's ulp exposure on four named chunks, **`walkability` unreachable cells at
216 with no threshold reading it**, **`tone profile` red on every reading for eight sessions**, and
a gate message frozen in the present tense of the session that wrote it.

**CLOSED THIS SESSION:**

- **`prop(container) × site(hoarding)`**, on the gate since session 22 and half-repaired in session
  24. The hoarding's claim was ±0.12 against a delivered `z ∈ [−0.07, +0.43]`. §7.1.1.
- **The bright reserve**, red at s39 and for six sessions before s37. 6.14% against a floor of
  6.00% — inside the printed spread, reported as a colour change rather than as a result. §7.1.

**NEW THIS SESSION — all of it measured, none of it inferred:**

- **THE THREE NEGLECTED KINDS WERE CAPPED AT ONE OBJECT PER CHUNK BY CONSTRUCTION**, because the
  cubic prop law and the gate that selects the kind read the same density field: `26 × 0.34³` =
  1.022, zero below `d = 0.268`. 84 of 131 delivered nothing at all on 1.094 ha. §1.
- **A `built` ISLAND EMITTED NO GROUND RECTANGLE AT ALL** — the block interior was the world's earth
  plane, and there was no floor under the largest bare surface in the city. §4.
- **659 OF 963 LIGHT WELLS WERE EMPTY**, and the well is 23.4 m square by construction from
  `lotDepthM()`. Now 187 of 963. §4.
- **`SITE`'s OWN COMMENT QUOTES THE SLOPE'S SPACING AS THE FLOOR'S.** `104.6/√14` is 28.0 m, not the
  26 m it claims; 26.15 m is `104.6/√16`. The constant is right. §1.1.
- **NOT ONE BUILT CHUNK MOVED**, and CONTRACT §6's named stream is why — the opposite of session
  39's finding, and for a stateable reason: here the new draws belong to objects that did not exist.
  Four digests identical. §5.
- **THE CLUMPING CV FELL 0.566 → 0.431 AND 12 OF 12 REGIONS ARE NOW BELOW ITS FLOOR**, while the
  populated fraction it is paired with moved 94% → 99%. No threshold moved. §5.1.
- **THE HOARDING'S CLAIM WAS 3.6× NARROWER THAN ITS OWN FEET**, and sessions 22 and 24 both had the
  measurement that closes it. §7.1.1.
- **THE FOUR LOOK BANDS MOVED BY 0.0000 ON 39 NEW LUMINAIRES AND THREE NEW LIT SURFACES.** §7.2.
- **THE TRIANGLE CEILING DID NOT BIND**: 2.13 M against 2 360 000, **0 extra draw calls**, 309 095
  instances. Headroom 13.0% → 9.8%. §7.4.
- **THE SAME CODE MEASURED wall p95 91.20 ms AND 71.60 ms TWO HOURS APART**, and the change's own
  delta is 7% of that spread. §7.4.
- **THE VEHICLE-SILHOUETTE BARS HAVE A LARGER SPREAD THAN THE ARMS ANYBODY COMPARES WITH THEM**:
  ground contrast 0.885 and 0.7339 on identical code, sampled population 71 / 68 / 70. §7.4.1.
- **A PALISADE DOES NOT STOP A PEDESTRIAN.** The walkability mask blocks buildings, landmark ground
  blockers, the origin block and the water, so a secured yard is open in the mask — the same gap
  the park railings have had since session 21. §10.
