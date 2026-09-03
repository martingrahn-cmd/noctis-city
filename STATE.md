# NOCTIS — STATE

*End of session 74. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`, 15 d 19 h of
uptime — the same boot as sessions 47–73. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` RAN 3.62–4.61 THROUGH THIS SESSION***, over CONTRACT §0.2's bar of 1.6 for the
fourteenth session running. **No millisecond below is a verdict.**

Branch `claude/noctis-74-the-airports-ground`, off session 73's head.

**THE AIRFIELD'S HORIZONTAL WORK. No terminal, no hangars, no aircraft — that split was the brief's
and it held.**

---
## 0. THE FRAME THE BRIEF ASKED FOR CANNOT EXIST, AND THAT IS THE FIRST FINDING

> *"Write STATE.md … Open it with the aerial over the field, because whether an airfield fits in this
> landscape at all is the one question this session exists to answer."*

**There is no aerial over the field and there cannot be one.** `CITY.groundRadius` is 5 chunks, so
the `city:ground` mesh exists only within **640 m of the camera**. A single frame can therefore hold
at most **1 280 m of a 3 000 m runway — 43 %** — and a camera far enough back to see three
kilometres has none of it resident at all. The first two aerials this session shot came back as empty
farmland for exactly that reason, and they were right to.

**So the verdict frame is from over the runway itself**, 40 m up at the south end looking north:

`node tools/lookat.mjs --pos=4750,48,400 --target=4750,8,1300 --fov=55`

and it shows a runway — a dashed centreline running to a vanishing point, edge stripes, touchdown-zone
bars in pairs, two rows of edge lights, airfield grass either side, and the perimeter fence crossing
behind. **An airfield does fit in this landscape. It cannot be photographed whole.**

---
## 1. THE SITE WAS CHOSEN BY THE NUMBER — ITEM 0a

Every 3 000 × 620 m platform on a 250 m lattice from −7 500 to +7 500, on both axis-aligned
orientations, rejecting any that touched the city, the sea, the river or a hill. **3 851 clear
platforms**, each scored on the relief across its own 2 525 terrain samples:

```
  the WORST of the 3 851      32.03 m
  the MEDIAN                  17.29 m
  the BEST                     1.28 m     (4 750, 1 750), runway along z
```

**Choosing by the number is worth sixteen metres of earthworks.**

**AND THE OBVIOUS SITING IS THE ONE THE NUMBER REFUSES.** The instinct is to put it beside the road.
The best platform within 1 km of the exit road has **11.15 m of relief and needs a 7.70 m cut** —
worse than the wall item 0c warned about. So item 0c's *"if the site needs choosing again to keep the
cut plausible, choose again"* is what was done.

**IT IS STILL 280 m FROM THE ROAD, AND THE SURVEY NEARLY MOVED IT FOR THE WRONG REASON.** The ranking
reported |centre − road| = 1 780 m, which reads as a long way. The centre is the wrong end to measure
from: the runway runs from z = 250 to 3 250 and the exit road at this x is z = −30, so **the south
threshold is 280 m from the road** and the apron is at that end. A number computed correctly and used
as a different quantity — CONTRACT §9's own subject, caught in a survey instead of in a frame.

---
## 2. A GROUND RECTANGLE CANNOT CUT — AND THE FRAMES ARE WHAT FOUND IT

This is the session's real finding and it cost most of its time.

The first arm levelled the platform at the terrain's **median**, which balances cut against fill and
is the right answer to the earthworks question. **It is the wrong answer to the rendering one.** The
fence rendered. The lights rendered. The runway, the taxiway, the apron and the platform grass were
invisible **from directly above them**.

**A ground rect is a flat quad laid OVER the terrain, and `block.js`'s terrain IS the earth plane** —
session 63's own sentence, *"the terrain is the earth plane and not a surface over it"*. Every part of
a platform levelled below the ground it covers is simply underneath the world, and the ground wins.
At the median, half of it was.

`harbourSite` had this right in one word and nobody had needed to generalise it: `clearM`, *"metres a
platform stands above the highest ground along its own landward edge … enough that the terrain cannot
poke through a level plate"*. A quay privileges its landward edge because its seaward one is under
water; **a runway has no edge to privilege, so the maximum over the whole platform governs.**

> **CUT IN THIS ENGINE IS ALWAYS FILL.** There is no mechanism that removes ground. Item 0b's *"the
> ground yields, the runway does not"* is delivered entirely by session 65's cut face drawing a riser
> DOWN from the platform, and the number that matters is not the relief about the median but the drop
> to the lowest ground the platform covers.

```
  platform level      10.292 m        = the maximum over 1 007 samples, + 0.4 m clearance
  relief               2.865 m
  the riser at the lowest corner       3.265 m   — a bank, not a wall
```

**AND THE DELIVERED PLATFORM IS NOT THE SURVEYED ONE**, which is worth saying because the two numbers
differ. The survey scored 3 000 × 620 m strips; the built platform is 738 m wide because it carries
the taxiway and the apron as well, and a wider footprint picks up more relief — 1.28 m becomes 2.87 m.
The site is still the best of 3 851 and the riser is still a bank.

---
## 3. WHAT IS BUILT

All horizontal, all of it:

```
  runway      3 000 x 45 m with 7.5 m shoulders, centreline dashed 30 on 30 off,
              continuous edge stripes, touchdown-zone bars thinning with distance
  thresholds  eight piano keys, a threshold bar, an aiming point 400 m in, and
              fifteen housings carrying a GREEN wing bar out and a RED one in
  taxiway     parallel at 118 m, 23 m wide, three links
  apron       320 x 300 m at the threshold end the road arrives at
  perimeter   254 fence segments, a gate at the spur, a service road inside it
  approach    30 stations over 900 m beyond the south threshold, a five-light
              crossbar every 150 m — item 3a's "single most recognisable light
              pattern there is"
  and         a windsock and a beacon. The beacon is LIT AND DOES NOT SWEEP:
              nothing animates a feature, so a rotating beacon is `river.js`'s
              mover mesh and a different item. Said rather than implied.
```

**SIX NEW GROUND KINDS, EACH IN ALL THREE TABLES** — `GROUND_ALBEDO`, `porosityFor` and
`CATEGORY_FOR_GROUND`, whose fall-throughs are pavement, a mirror and claims-nothing respectively.
Porosity is `EXIT_ROAD`'s own MTD model, which is the one that can resolve sealed surfaces at all:

```
  afRunway    MTD 1.0 mm   0.40    grooved PQC — 6 mm grooves at 32 mm centres, and
                                   grooving EXISTS to stop a runway ponding
  afTaxi      MTD 0.8      0.25    plain asphalt, nearer the city anchor
  afApron     MTD 1.1      0.455   `portApron`'s brushed concrete
  afShoulder               0.60    asphalt-bound stone
  afGrass                  1.00    turf, session 55
```

The access spur is **`portRoad` and not `road`**, which is session 72's finding applied before the
defect rather than after it — CONTRACT §9.2's third instance was exactly this.

**NOTHING HERE REGISTERS AN OCCUPANCY CLAIM**, following the harbour's precedent — session 66's
*"water and its works are not claims"*, one landscape over.

---
## 4. THE FOUR PREMISES

| | premise | verdict |
|---|---|---|
| (i) | `city:signs`' ring ≤ 5 reaches the airport site | **TRUE, and the reason in the brief is not the reason.** The ring is measured from the CAMERA, not the origin, so distance from the city is irrelevant and the harbour's 3.5 km never mattered. The real constraint is the opposite one: the ring is only 640 m, so you must be AT the airfield to see any of it — §0. |
| (ii) | the site can be found where the cut riser stays plausible | **TRUE with room.** 1.28 m of relief on the surveyed strip, a 3.27 m riser on the delivered platform, against a 17.29 m median site. §1, §2 |
| (iii) | an axis-aligned runway needs no rotated ground claim | **TRUE, and it was never tested against an alternative.** Everything here is an axis-aligned rect and the ground record still has no orientation field. The cost of an angled runway is unpaid and unmeasured. |
| (iv) | runway edge rows, threshold and approach lighting fit in ONE draw | **HALF TRUE, AND THE HALF THAT FAILS IS THE ONE THAT MATTERS.** They fit — no new draw, no new mesh, no cluster slot. **They also do not appear.** §6 item 1. |

---
## 5. THE COST

**ALL EIGHT RAN. `perfcheck` COMPLETED THE WHOLE BATTERY FOR THE NINTH SESSION RUNNING.**

```
  highway_speed   404 draws of 440              IDENTICAL TO SESSION 73
                  2 466 960 tris of 2 630 000   IDENTICAL TO SESSION 73

  gate            exit   verdict   seconds  load1 in
  parsecheck         0     GREEN       3.9      4.30
  faultcheck         0     GREEN      28.5      4.12
  lookcheck          1       RED      50.6      3.93    THE IDENTICAL THREE
  windcheck          0     GREEN      41.2      3.62    and session 73's lesson held
  inputcheck         0     GREEN      17.5      3.77
  gateaudit          1       RED      77.9      3.96
  citycheck          1       RED     125.7      4.03    IDENTICAL TO SESSIONS 57-73
  perfcheck          1       RED    1095.5      3.95

  4 of 8 RED — the same four as sessions 53-73. NO FIFTH RED.
```

**AN ENTIRE AIRFIELD COST NOTHING ON THE BINDING ROUTE**, which is what being 5 km out and off every
route buys: the runway, the taxiway, the apron, 254 fence segments, 82 lighting features and six new
ground kinds move neither number by one.

**`windcheck` STAYED GREEN**, and that is session 73's lesson holding rather than luck: its fifth red
was a lathe and a box mesh sharing `landmark:<name>`, and the constraint list named an airfield as
*"the exact shape of that collision"*. Nothing here adds a mesh at all — every surface is a rect in
`city:ground`, every box is a chunk `:masses` instance and every light is a `city:signs` quad.

**`citycheck` IS BYTE-IDENTICAL TO SESSIONS 57–73**: CV 0.393, 5 forbidden overlaps, 2 of 2 647 signs,
1 004 of 284 918 bare samples, occupancy 18 799 / 19 087.

---
## 6. WHAT TO DO FIRST NEXT TIME

**1. THE AIRFIELD LIGHTS ARE BUILT AND THEY DO NOT APPEAR. THIS IS THE FIRST THING TO FIX.**

The night frame WAS taken —
`node tools/lookat.mjs --pos=4750,30,-430 --target=4750,10,400 --fov=55 --t=0.0` — and it is black.
Not dim: black, at full resolution, along the centreline where thirty approach stations stand.

What is established:

```
  the features generate           30 afapproach, 50 afstrip, 2 afthresh, counted off
                                  `generateChunk` in the chunks the camera has resident
  the features RENDER             the perimeter fence is in a daylight frame, and the
                                  fence and the lights come out of the same feature loop
  the daylight runway renders     centreline, edge stripes, TDZ bars, edge-light housings
  the cost is zero                404 draws and 2 466 960 triangles, both identical to
                                  session 73 — so the quads are in `city:signs` as intended
```

Three causes ruled out. **Opening hours**: `signHourFactor(ctx, null)` returns 1 and `glow()` pushes
`signTrade.push(null)`, so a nightfall dimming is not it. **Brightness**: these are 258 to 645 nits
against the villas' 73, which session 73 saw at 380 m. **Generation**: counted.

What is NOT established is why. **The next session should start here**, and the cheapest instrument is
the villa comparison — session 73's `villa-city` pose lights through the identical route, so an A/B
between a villa glow and an airfield glow at one camera separates the route from the site.

**2. SESSION 75's HALF: the terminal, the hangars and the aircraft.** The apron has stand markings
and nothing on them, which is the state the split intended.

**3. `country-air`-CLASS POSES.** Session 73 found three of nineteen committed poses that do not show
their subject. This session added no committed pose at all; the three frames above are `--pos`
arguments in a STATE file, which is exactly the *"a frame produced by a command in a shell nobody
kept"* that `poses.mjs` exists to prevent. **Put them in `poses.mjs`.**

**4. THE 640 m GROUND RING IS NOW A DESIGN CONSTRAINT AND NOT A DETAIL.** Anything longer than
1 280 m cannot be seen whole. The runway is the first object in this world that exceeds it; the
viaduct at 480 m and the harbour at 448 m never did.

**5. THE THREE STANDING ITEMS.** `perfcheck` captures with no `settle()`; its entropy floor is a
§0.1 case in the open; the four `trade-*` look frames differ run to run by 3.1–8.1 MB, entirely in
the vehicles.
