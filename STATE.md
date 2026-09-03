# NOCTIS — STATE

*End of session 76. **The machine was checked first, printed, recorded — CONTRACT §0.1.**
**Mac mini, `Mac16,10`, Apple M4, 10 cores, 24 GB**, macOS 15.2, `node v22.22.0`, 16 d 1 h of
uptime — the same boot as sessions 47–76. Every gate that reads a pixel printed
`ANGLE (Apple, ANGLE Metal Renderer: Apple M4)`.*

***`load1` RAN 2.2–3.4 THROUGH THIS SESSION***, over CONTRACT §0.2's bar of 1.6 for the
sixteenth session running, and quieter than session 75's 3.2–7.0. **No millisecond below is a
verdict.**

Branch `claude/noctis-76-the-night`, off session 75's head.

**THE NIGHT. THE LIGHTS EXISTED AND NOTHING THEY SHONE ON WAS LIT.**

**THE FRAMES, AND `--t=0` OR THEY PROVE NOTHING:**

```
  node tools/lookat.mjs --preset=af-apron,af-hangar,af-forecourt,af-approach --t=0
  node tools/lookat.mjs --pos=5180,26,270  --target=5180,10,470 --fov=56 --t=0 --name=af-apron-back
  node tools/lookat.mjs --pos=5151,20,645  --target=5151,8,500  --fov=62 --t=0 --name=af-hangar-back
```

The last two are the OPPOSED BEARINGS and they are half of this session's method, not an
appendix. One of them found the defect the committed pose cannot see (§3).

---
## 0. WHAT LIGHTS THE GROUND IN THIS PROJECT — ITEM 1, AND THE BRIEF'S FIRST PREMISE IS FALSE

**THIS PROJECT HAS LOCAL GROUND ILLUMINATION AND HAS HAD IT SINCE SESSION 1.** The brief's
premise (i) — *"the city's night look is achieved by something other than local illumination, and
whatever it is can be extended outward"* — is **false in both halves**. There is no fake. There is
CONTRACT §5.6's clustered forward+ renderer, 384 slots in a data texture, and **two streamed pools
that hand those slots out**. Nothing needed extending. The airfield was simply never put on the
route.

There are exactly **two `THREE.Light`s in the whole project** — `lighting:sun` and `lighting:moon`,
both `DirectionalLight`, both in `src/modules/lighting.js`. No `PointLight`, no `SpotLight`, no
`RectAreaLight`, anywhere. That is not the absence of local lighting; it is §5.6 saying local lights
do not live in three's uniform array.

### 0a. THE THREE MECHANISMS, AND ONLY TWO OF THEM DEPOSIT LIGHT

```
  updateLampPool    city.js   98 slots x (beam + spill).  Candidates: rec.lamps, ranked by
                    DISTANCE.  Five luminaires ride it — street lamp, park lamp, car-park
                    column, site flood, yard flood.       *** REAL LIGHT ***

  updateSignPool    city.js   16 slots.  Candidates: rec.signEmitters, ranked by I·cosθ/d²,
                    which is the LUX each would put on the camera.  Six chromas.
                                                          *** REAL LIGHT ***

  glow()            city.js:4230.  Pushes a matrix into `signQuads`, a tint into `signTint`
                    and a `null` into `signTrade`.  That is the entire body.
                                                          *** NOTHING. ***
```

**`glow()` IS A LAMP-SHAPED HOLE IN THE DARK AND THAT IS EXACTLY WHAT THE WHOLE OUTER WORLD HAD.**
The function that claims a cluster slot for an emissive panel is `pushSignLight` (`city.js:3509`),
and **its only five callers are shop fascias, roof cabinets, blades and pylons** — `city.js:3758,
3767, 3800, 3874, 3908`. Every one of the airfield's ~570 emitters, and every villa window and quay
flood built since session 68, goes through `glow()` instead.

`city:bowls` deposits nothing either, and cannot: it is ring ≤ 2 on ONE GLOBAL EMISSIVE INTENSITY
with no per-instance channel. Session 71 named it and the naming still stands.

### 0b. AND `uGroundLighting`'s 16 LUX IS NOT THE NIGHT FILL — PREMISE (ii) IS FALSE TOO

It is `LIGHT.streetAverageLux`, handed by `lighting.js:129` to `sky.setGroundLighting` when the
photocell closes, written into the **SKY LUT's LOWER HEMISPHERE** (`sky.js:355`) and thence through
PMREM into the scene's environment map. Its own comment says what it is for: *"the lower hemisphere
is a lit surface at night, not a hole"*. It is a **global ambient with no position** — the same
number at the apron as on the pavement it was derived for — and it is one of three terms, not the
whole. At midnight the measured horizontal ambient is **3.24 lx**, of which `moonRedistribution`
= 0.85 has moved 85% of the skyglow into the moon's directional term.

### 0c. SO THE MEASUREMENT, TAKEN BEFORE ONE LINE WAS WRITTEN

`tools/radianceprobe.mjs` standing at the committed `af-apron` pose, midnight, dry:

```
  lamp pool   0 active of 0 candidates within one chunk
  sign pool   0 active of 0 candidates
  clustered   1 resident, peak froxel 1 of 96
  roles       aircraft:1 traffic:96 stall:12 block:56 lamp:192 sign:16   373 of 384

  DARKEST surface   0.081 cd/m²  ->  code value 11 of 255
  MEDIAN  surface   0.203 cd/m²  ->  code value 10
  87.8% of every surface in the frame under 16/255
```

**192 lamp slots and 16 sign slots stood parked below the world at zero intensity while sessions 74
and 75 built a hundred and thirty emitters five kilometres away.** A terminal, two piers, three
hangars, a tower, six aeroplanes and 44 approach stations, and the field's own concrete was code
value 10.

### 0d. WHICH MAKES ITEM 1d's QUESTION ANSWER ITSELF

The brief asked *"if the project has no local ground illumination at all and the city fakes it, say
what the fake is, and then the item is to extend the fake."* There is no fake, so the item was never
to build lighting or to extend anything — **it was to emit nine `flood` features.** The whole of §1
below is a hundred lines of derivation around one existing call.

---
## 1. THE APRON, AND AN AEROPLANE ON A STAND

**THIRTEEN FLOODLIGHT MASTS, ON THE ROUTE THE CITY HAS HAD SINCE SESSION 21.** A `flood` feature
already carries a mast, a pad, a head, an emissive rack AND a record in the streamed lamp pool.
Session 21 built it for a construction site; session 54 gave it a second luminaire; session 71 put
three on the harbour. **The airfield is the only landscape in this project that never asked for one.**

> **A CORRECTION TO THIS SESSION'S OWN FIRST COMMIT MESSAGE**, which says *"Ten apron floodlight
> masts"* and *"Nine of ten are within reach"*. It was true of the layout when it was written and
> the siting changed twice after it under §1c. **Counted out of the generator at seed 1337: 13
> masts**, in four rows of 4 / 2 / 4 / 3, of which **10 stand within the 210 m reach of the
> `af-apron` eye and only 4 would have stood within the 128 m cut §2b replaced.** Every measured
> luminance figure in that commit message is from the delivered layout and stands.

```
                                        before        after
  lamp pool                        0 of 0         10 of 10 candidates
  clustered resident                    1              14
  peak froxel                      1 of 96        12 of 96
  draws AT THE APRON                   76              78     (+2, and see §5)

  DARKEST surface                  0.081           0.133  cd/m²    1.6x
  p10                              0.194           0.387           2.0x
  MEDIAN                           0.203           0.531           2.6x
  p90                              0.313           2.884           9.2x
  under 16/255                     87.8%           72.2%
```

Same pose, same seed, same hour, same wetness, both frames on disk:
`tools/shot-out/s76-apron-{before,after}-t0.png`.

### 1a. `LIGHT.apronFloodCandela` — THE FIFTH IN THE FAMILY, AND IT IS NOT A SITE FLOOD

Pushing an apron mast through the existing `flood` feature unchanged would have handed it
`siteFloodCandela` — because `city.js` discriminates its two floods by MOUNTING HEIGHT and a 25 m
mast clears every threshold there is. **That is CONTRACT §9.2 exactly**, a city default travelling
unquestioned into a fifth landscape, and it is the class session 72's rural spur and STATE 75 §3's
traffic signal both belong to. The discriminator is not wrong. The fixture is not in its table.

```
  the standard   ICAO Annex 14 Vol I, apron floodlighting:  20 lx average horizontal on an
                 aircraft stand, uniformity not below 0.25.  It is the SAME 20 lx as
                 `yardFloodCandela`'s EN 12464-2 loading zone — an aircraft stand IS a loading
                 bay — and 0.40x a construction site's 50 lx, because nobody on an apron is
                 working in a hole.

  the geometry   mast `AIRFIELD.mastHeightM` = 25 m, aiming `AIRFIELD.mastAimM` = 55 m out.
                 slant  d = hypot(25, 55) = 60.42 m

  the window     FIRST, and this is the rule the project has now got wrong three times:
                 R >= 60.42 / 0.293 = 206.2  ->  210 m,  window (1 - 60.42/210)² = 0.5074

  the intensity  THROUGH it:  I = E·d²/window = 20 x 3650.6 / 0.5074 = 143 875  ->  144 000 cd

  checked backwards (§9 rule 2):  I·window/d² = 20.02 lx at the aim point.
  all three ratios (§9 rule 4):   2.40x a site flood, 40.0x a yard flood, 21.2x a street lamp,
                                  from a mast 2.78x a site mast's height.  The 40x against an
                                  IDENTICAL 20 lx is the throw and nothing else.
```

### 1b. AND ITS OPTIC, WHICH IS A SEPARATE HALF (CONTRACT §5.9)

A peak candela means nothing without the distribution it is the peak of. `APRON_FLOOD_OPTIC`:
**circular** (`alongAxis` zeroed — an apron is 320 × 300 m and a floodlight aimed across it is a
cone, not a lantern stretched along a road), **no batwing** (`peakCos` 0 — the 1/cos³ rise
compensates a road's distance from a lamp overhead, and a mast already aiming at the far end of its
own pool would brighten the edge and dim the middle), **36 degrees** solved from the pool rather
than picked (`atan(40 / 60.42)` = 33.5°, so 36 at the cutoff and 25 where the smoothstep starts —
a NEMA 4 floodlight), and **`fluorescentCold`**, which is free because `EMITTER_CHROMA` is
luminance-normalised and is LOOK.md §3's *"colour opposition"* asked of the one large cold ground
surface in a sodium world.

### 1c. THE SITING IS THE FRAMES', AND THREE ARMS WERE THROWN AWAY BY THEM

**This is the part worth reading.** Every one of these was found by looking, not by arithmetic.

1. **AN 82 / 114 / 82 PITCH SHOWED THE 114.** A 26 m stripe of black apron between two lit ones, at
   the exact x where the pools stopped meeting. The pitch is derived from the cone now — the pool is
   `60.42 × tan 36` = **43.9 m** either side, so the pitch must be under **87.8 m**, and it is 80.
2. **TWO ROWS ON ONE HEADING PUT THEIR DARK RINGS EITHER SIDE OF THE POSE.** A mast lights the
   ground in FRONT of it: the cone's near edge meets the concrete `25/tan(24.4 + 36)` = **14 m**
   out, so every mast stands in a ring of its own dark. Two rows 90 m apart both throwing south put
   one ring at z 391–419 and the other at 481–509, and `af-apron` stands at z 440 looking straight
   down the seam. The frame came back with a black band across its lower third. **The rows face each
   other now**, which is also how an apron is really lit, and it buys the aeroplanes as well as the
   concrete.
3. **AN 80 m PITCH STOOD A 25 m MAST 2.5 m OFF `af-apron`'s SIGHT LINE, 35 m IN FRONT OF IT.** A
   column up the middle of the frame from the sky to the apron. A pose is an instrument; a mast
   planted in one is a defect this session introduced and the frame is what found it. The middle row
   is on the **piers' own centrelines** now, which is where its pools wanted to be anyway — each
   mast's 43.9 m pool then lands on the two stands that pier serves.

Delivered: four masts on the apron's south edge throwing north, two on the piers' axes throwing
south at the north stand row, four on the north edge throwing south over the open apron, and three
in the gaps BETWEEN the hangars — the only ground on that apron no aeroplane crosses. Their pitch is
the hangar row's 123 m and not this derivation's 87.8, so the hangar apron is lit in three pools with
dark between them, and **that is a siting the buildings dictate rather than a number anybody chose.**

### 1d. DIRECTIONAL, AND IT SAYS SO — ITEM 3b

The rack is `glow` and **not** `glowOmni`. Session 75's repair exists for fixtures that are
omnidirectional IN THE WORLD — a runway edge light is a lens on a stalk in the middle of a field. A
floodlight has a reflector behind it and a glass front, and the back of one is a black box. Standing
behind an apron mast you should see the mast and not the lamp, and `materials.sign` being
`FrontSide` delivers exactly that. **Confirmed in `af-apron-back`**, where the whole south row shows
as dark bars on posts against the sky.

---
## 2. TWO DEFECTS FOUND ON THE WAY, BOTH CONTRACT §9 CLASSES

### 2a. THE OPTIC BELONGED TO THE POOL SLOT AND NOT TO THE LUMINAIRE

`updateLampPool` reassigns a fixed set of slots to whichever lamps are nearest and writes
`position`, `direction`, `radius`, `intensity` and `alongAxis` every frame. **It has never written
`coneOuter`, `coneInner`, `peakCos`, `alongScale`, `acrossScale`, `sourceRadius` or `color`.** Those
were set once at `lights.add` to a street lantern's values and have stood there for every fixture
that has taken a slot since.

**SO ALL NINE EXISTING FLOOD MASTS THROW A STREET LANTERN'S BEAM** — 60 000 cd through
`LUMINAIRE.alongRoadRad` = 68°, elongated 2.39× across a ROAD AXIS they do not have, with a 1/cos³
batwing peaking 57° off nadir, in sodium whatever the lamp is. Six site masts, three on the harbour.

**`updateSignPool` FORTY LINES DOWN GETS THIS RIGHT AND SAYS SO IN ITS OWN COMMENT**: *"a slot
reassigned from a cyan blade to a sodium fascia does not keep the cyan."* Two pools, one shape, one
written after the other, and only one carrying the rule. CONTRACT §9.1 with the reader missing rather
than the value.

Repaired **unconditionally** — all seven fields, every frame, from `l.optic` or from `LANTERN_OPTIC`.
Writing them conditionally would be worse than not writing them: a slot that kept an apron mast's
36° cone and then took a street lamp would light one pool of pavement and leave the kerb dark, *and
it would do it only when the player walked past a mast* — a defect that comes and goes with the
camera, which is what session 74 paid a whole session for. **The nine existing masts keep exactly the
beam they had** (`l.optic` undefined falls through to the lantern); moving them is §6 item 1.

### 2b. THE CANDIDATE CUT WAS A STREET LAMP'S 128 m ON A 320 m APRON

`d2 > CITY.chunkSize²` was the whole cut. For a street lamp 128 m is generous three times over — its
falloff window is 30 m, so a lamp at 128 m is already clipped to nothing. **The 128 is a STREAMING
number, not a photometric one.** Measured at the committed pose: four of the ten masts were being
refused at 144 m, sixteen metres outside a bound derived for a fixture that throws a sixth as far.

Counted out of the generator at the committed pose: **the 128 m cut passes 4 of the 13 masts. The
luminaire's own window passes 10**, and the three it still refuses are at 212, 214 and 221 m — past
where their own falloff has anything left to give.

It is the luminaire's own window now, floored at one chunk. **Provably inert in the city, and the
arithmetic says so rather than the intent**: `max` can only ADD, and it adds nothing for a street
lamp (30), a park lamp (30), a column (30) or a yard flood (40) — every one keeps 128 exactly. The
one city fixture it touches is the site flood, 128 → 130, whose own falloff delivers
`60 000 × (1 − 129/130)² / 129²` = **2.1e-7 lx** in the annulus. Not a small change — no change.

**AND IT WAS MEASURED AT THE STREET LOOK EYE, BEFORE AND AFTER, BECAUSE THE CITY'S POOL IS NOT
SATURATED** (29 candidates against 98 slots, so a new candidate WOULD light):

```
                     before          after
  lamp pool     29 of 29        29 of 29 candidates
  sign pool      3 of 3          3 of 3
  clustered        105             105 resident, peak froxel 26 of 96
  draws            296             296
```

Identical in every quantity.

---
## 3. THE OPPOSED BEARINGS, AND WHAT THE SECOND ONE FOUND

Item 3c cost two frames and it earned them. `af-apron-back` stands at z 270, south of the stands,
looking north — the reverse of the committed pose.

**THE AEROPLANES' SOUTH FACES ARE DARK, AND THE COMMITTED POSE CANNOT SHOW IT.** From `af-apron` the
north faces are lit and the frame is honest; from the other side every airframe is a silhouette with
a bright wing root. **It is not a bug in the masts and no aiming fixes it.** The south stand row sits
28 m from the south mast line, and a source 25 m up at 28 m away arrives at `atan(25/28)` = **41.8°
above horizontal** — it lights the TOP of a fuselage, not its side. Vertical illuminance on an
aircraft comes from a mast far enough away to be shallow, and the only thing 44 m south of that stand
row is the terminal.

**WHICH IS THE INTERESTING PART.** The terminal's apron elevation is five glazed panels of
58.6 × 12.3 m at 107.5 cd/m² — **3 600 m² of Lambertian emitter at half a city window's nits**,
44 m from the stands, at exactly the shallow angle a fuselage side needs. As `pushSignLight` it
would be `I = nits × A` ≈ 77 400 cd per module, comparable to an apron mast and shaped like a wall.
**`pushSignLight` is in scope at `glow()`** — both live in `buildChunkBody`, with no function
boundary between them — so this is a two-line change, not a mechanism.

**IT IS NOT MADE THIS SESSION AND THE REASON IS A NUMBER.** `SIGN_LIGHT.cutoffM` is 128 m from the
CAMERA, and `af-apron` stands 192 m from those panels — so the pool would refuse them at the one
pose that needs them. Widening it is §2b's repair on the sign pool, and unlike the lamp pool's it is
**not** provably inert: the street eye holds 3 sign candidates against 16 slots, so every new
candidate lights, and `band:midnight` sits **0.00243** below its ceiling on an instrument whose
run-to-run spread is 0.0001. That is a change that must be made with a look battery around it and it
is §6 item 1.

---
## 4. THE OTHER TWO DARK PLACES

### 4a. THE HARBOUR — THE BRIEF'S PREMISE IS HALF WRONG AND THE FRAME IS STILL DARK

*"Session 71 built quay lights as sign quads at no light slot. Check whether they light anything."*
**They do.** Session 71 also emitted **8 `lamp` features at 11 m and 3 `flood` masts at 14 m**
(`citygen.js:18478, 18490`), which are eleven real records in the streamed pool. The premise is
false and the harbour has had local light for five sessions.

**AND IT IS STILL DARKER THAN THE UNLIT AIRFIELD WAS.** At `sea-harbour`, midnight:

```
  lamp pool   2 active of 2 candidates       <- 2 of its 11 fixtures are within reach
  MEDIAN surface   0.129 cd/m²               <- against the unlit apron's 0.203
  96.6% of every surface under 16/255        <- against the unlit apron's 87.8%
  max 3.89 cd/m²  —  nothing in the frame is bright
```

The quay reads as silhouette only: two gantries against the horizon glow, a quay edge, one boat with
a lit cabin. Session 71's dark-steel decision is correct and holds — but with two fixtures in reach
and no fill, the working surface is unusable. **It is the same item as §1 with the same repair and it
was not reached.**

**ONE ALARM, REPRODUCED TWICE AND NOT CHASED.** Both harbour probes printed **`clustered 99
resident, peak froxel 96 of 96`** — identical on two separate runs, so it is deterministic and not a
streaming race. `lights.lightCount` is the number of lights actually packed into the data texture
that frame, so 99 lights are ON at a quay whose own fixtures contribute **2 lamp candidates and 0
sign candidates**. 97 of them come from somewhere this session did not identify.

**AND 96 IS TWO CONSTANTS AT ONCE**, which is exactly the coincidence CONTRACT §9 is about:
`CLUSTER.maxPerCluster` is 96 and `CLUSTER.trafficLightReserve` is 96. A froxel holding 96 is either
at its cap or holding the whole traffic pool, and the printed number cannot tell you which. For
scale, the same probe reads **14 resident / peak 12** at the apron and **105 resident / peak 26** at
the street eye — so it is the harbour that is odd, not the instrument. `lights.js` already keeps
`clustersAtCap`, `overflowEver` and `peakOccupancyEver`, and `tools/clustercheck.mjs` drives them.
§6 item 2.

### 4b. THE COUNTRY ROAD — IT DOES NOT READ, AND THERE ARE FOUR REASONS

The brief said *"if it reads, say so and leave it."* It does not read. `country-car`, midnight:

```
  green code value   min 9   p10 9   p25 10   MEDIAN 10   p75 11   p90 12
  99.0% of every surface in the frame under 16/255
  MEDIAN surface 0.172 cd/m²
```

The whole frame is four code values wide. There is no carriageway in it — no edge, no markings, no
distinction between the road and the field beside it. The reasons are all correct decisions:

1. **No lighting, and it should have none.** Session 62 was right, and the predicate is one line —
   `if (chunk.beyondCity) continue;` at `city.js:7386`.
2. **The centre line stops 568 m short.** 34 dashes over the 200 m taper (`block.js:3246`), then
   768 m of unmarked road to the rim.
3. **Nothing out there carries a headlight.** `traffic.js:2978` refuses a vehicle at
   `cityExtentAt(x, z) <= 0` — the SAME boundary that keeps the lamps off. The 96 slots of
   `CLUSTER.trafficLightReserve` are 48 vehicles × 2 headlights and none of them may come here.
4. **And the paint's retroreflection is explicitly not modelled** — `ROAD_PAINT.albedo`'s own
   comment: *"glass beads send a headlight's own light back along the beam, which is most of what
   makes a line read at night from a car. This project has no retroreflective BRDF."*

**So the road is unlit by design, unmarked for three quarters of its length by omission, unvisited by
the only fixture that could light it, and made of paint whose night behaviour is a stated gap.** All
four are defensible alone. The frame is what shows what they are together, and the repair is a
headlight on the eye — a `player.js` question, not a night-content one.

---
## 5. THE COST, AND WHAT DID NOT MOVE

**THE LOOK GATE IS NOT THE JUDGE, AND THE BRIEF'S STRUCTURAL CLAIM IS FALSE.** The brief opened
*"THIS SESSION IS DIFFERENT FROM THE LAST FOURTEEN IN ONE STRUCTURAL WAY: THE LOOK GATE IS THE JUDGE
... both look eyes stand inside the city and both see midnight and dusk. A moved band is real
evidence here for the first time in a long while."*

Both eyes do see midnight. **Neither can see the airfield.** `street` is at (70, 1.74, 0.9) and
`trade` at (−251.94, 1.70, 291.58); the apron's centre is (5178, 400). Computed, not recalled:
**5 124 m and 5 431 m to the apron, 4 594 m and 4 912 m to the nearest edge of the platform** —
outside the 640 m ground ring, outside `CLUSTER.far` = 320 m, and no gate route, pose or census
sample names the airfield. Session 75 measured the same thing twice. **A band moving in this session
would have been a defect, not evidence**, and the one change that could have moved one (§2b) was
proved inert at the eye before it was committed.

**ALL EIGHT RAN, ONCE, AND THERE WAS NO SECOND BATTERY BECAUSE THERE WAS NO FIFTH RED.**

```
  highway_speed   404 draws of 440              IDENTICAL TO SESSIONS 73, 74 AND 75
                  2 466 960 tris of 2 630 000   IDENTICAL TO SESSIONS 73, 74 AND 75
                  wall p95 13.00 ms [13.0 13.0 13.2]  spread 0.2   froxel 17 of 96

  gate            exit   verdict   seconds  load1 in
  parsecheck         0     GREEN       3.7      2.67
  faultcheck         0     GREEN      28.2      2.61
  lookcheck          1       RED      50.4      3.27    THE IDENTICAL THREE
  windcheck          0     GREEN      40.9      3.14
  inputcheck         0     GREEN      17.5      3.40
  gateaudit          1       RED      78.1      3.64    downstream of lookcheck, as always
  citycheck          1       RED     127.0      3.85    IDENTICAL TO SESSIONS 57-75
  perfcheck          1       RED    1134.8      3.91

  4 of 8 RED — the same four as sessions 53-75. NO FIFTH RED.
```

**AN AIRFIELD LIT FROM THIRTEEN MASTS COST THE BINDING ROUTE THE SAME TWO INTEGERS FOR THE FOURTH
SESSION RUNNING.** `roles` on every route still reads `lamp:192 sign:16` — the pools are the same
size and the masts took slots that were already allocated.

**`lookcheck` IS THE IDENTICAL THREE AND ONE NUMBER PROVES THE SESSION IS INERT THERE.**
`distinct:midnight|dusk` delivered **0.02846** against its floor of 0.03 — **the same five decimals
as before the session**, on an instrument LOOK.md §7 has re-derived three times and measured as
deterministic to 1e-5 for a fixed build. `band:midnight` mean **0.1096** against its 0.112 ceiling,
unmoved. The other two are `facadeAlbedo` and `facadeNeighbours`, both dusk material findings, both
unchanged since session 53.

**`citycheck` IS BYTE-IDENTICAL TO SESSIONS 57–75**: CV 0.393, 5 forbidden overlaps, **2 647 sign
quads** of which 2 are inside a building, 1 004 of 284 918 bare samples, occupancy **18 799 / 19 087**.
The airfield's thirteen new emissive racks do not appear in that 2 647 because they are 4 594 m
outside its region, which is what a change 5 km out should do.

**`windcheck` GREEN, 570 rows all `ok`.** The masts add no mesh: the column and pad are chunk
`:masses` instances, the head is one more, and the rack is a `city:signs` quad.

**AND `perfcheck`'s ENTROPY FLOOR IS §0.1 IN THE OPEN, ON TWO ROUTES, AND IT IS NOT THIS SESSION'S
CONTENT.** Item 4b asked which it was. It is the assertion.

```
  night_rain       entropy 4.921 < 5      per run 4.899 / 5.132 / 4.921   spread 0.233
  downtown_dense   entropy 4.898 < 5      per run 4.814 / 4.898 / 5.034   spread 0.220
```

**The breaches are 0.079 and 0.102 against within-battery spreads of 0.233 and 0.220 — 34% and 46%
of the instrument's own noise**, and in both cases one of the three runs cleared the floor outright.
Neither route can see the airfield: `night_rain` runs from (300, 0, −2) to (−400, 0, 1) and
`downtown_dense` is the origin block. Both were red before this session.

**AND THE TOOL PRINTS A SENTENCE THAT ITS OWN NUMBER REFUTES, IN THE SAME BLOCK.** Under
`downtown_dense` it printed `per run: entropy [4.814 4.898 5.034] — ASSERTED ON THE LAST OF THESE,
NOT POOLED`, and then asserted **4.898**, which is the median. `perfcheck.mjs:1297` has taken the
median of three since session 21; the sentence at `perfcheck.mjs:2522` has been false for
fifty-five sessions and is what put "asserted on a single draw" into this session's brief. §6 item 6.

**NO MILLISECOND HERE IS A VERDICT.** Six of the eight browser gates started above CONTRACT §0.2's
quiet bar of 1.6, at 2.61 to 3.91, and the suite says so itself. `highway_speed`'s 13.00 ms is the
same figure session 75's first battery reported and 3.2 ms below its second, on identical content.

<!-- GATES -->

**AND THE APRON'S OWN NUMBERS, RE-MEASURED ON THE SHIPPED THIRTEEN-MAST LAYOUT** — because the
reading quoted in the first commit message came from an intermediate one, and a number nobody
re-measured after the last edit is a number nobody measured:

```
  lamp pool   10 active of 10 candidates      (13 masts stand; 3 are past their own falloff)
  sign pool    0 active of 0
  clustered   14 resident, peak froxel 12 of 96
  draws       78
```

---
## 6. WHAT TO DO FIRST NEXT TIME

**1. THE TERMINAL GLAZING IS A 3 600 m² LAMP AND IT LIGHTS NOTHING — §3.** Two lines through
`pushSignLight`, which is already in scope at `glow()`. What it costs is `SIGN_LIGHT.cutoffM`, and
that one is NOT inert: 3 candidates against 16 slots at the street eye means every new candidate
lights, and `band:midnight` has 0.00243 of headroom against a 0.0001 spread. Do it with a look
battery around it and a paired A/B — and note that `distinct:midnight|dusk` is **deterministic to
1e-5 for a fixed build** (LOOK.md §7, three re-derivations), so that A/B is admissible.

**2. `clustered 99 resident, peak froxel 96 of 96` AT THE HARBOUR — §4a.** Reproduced on two runs.
96 is both `CLUSTER.maxPerCluster` and `CLUSTER.trafficLightReserve`, so the print cannot say whether
that froxel is at its cap or holding the traffic pool — and either answer is a finding 3.5 km from
the nearest city light. The apron reads 14/12 and the street 105/26 at the same instrument. Start at
`lights.clustersAtCap` and `lights.overflowEver`, which are already kept, and at whether
`traffic.js`'s 96 headlight slots are dark out there — `cityExtentAt(x, z) <= 0` refuses the
VEHICLES (`traffic.js:2978`), and whether it also refuses their lights was not established.

**3. NINE FLOOD MASTS THROW A STREET LANTERN'S BEAM — §2a.** The mechanism to fix it shipped this
session (`l.optic`); what did not ship is the two optics — a construction mast's and a quay mast's —
because deriving them is a session's work and doing it badly would move the harbour and two block
interiors in a session that was about the airfield.

**4. THE HARBOUR QUAY IS DARKER THAN THE UNLIT AIRFIELD WAS — §4a.** Median 0.129 cd/m², 96.6%
under 16/255, two fixtures in reach of eleven. Same item as §1, same repair, not reached.

**5. TWO CORRECTIONS TO STATE 75, BOTH CODE-AGAINST-COMMENT.**
   - **THERE ARE SIX AEROPLANES ON THE STANDS, NOT FIVE.** `citygen.js`'s own comment says *"FIVE OF
     EIGHT, and the empty ones are the point"*; the line under it is
     `occupied: n % 8 === 3 || n % 8 === 6 ? 0 : 1`, which refuses exactly two. Measured out of the
     generator: 8 stands, **6 occupied, 2 empty** (n = 3 and n = 6). STATE 75 §2 and its commit
     message both repeat the comment.
   - **`AIRFIELD.edgeStepM` = 60 IS DECLARED AND NEVER READ.** The runway edge lights come one per
     `afstrip` station and that pitch is `runM / stationM`. The two agree at 60 by coincidence of two
     constants, not by derivation. CONTRACT §9.1's *"a value the code does not read"*, and it is the
     same shape as session 75's own `onAirfieldAt`. `afPaint` is a second instance: an albedo row, a
     porosity row and a documented absence from `CATEGORY_FOR_GROUND`, and **nothing anywhere pushes
     a ground rect of that kind.**

**6. THE BRIEF'S §4 WAS WRONG ABOUT `night_rain`, IN A WAY WORTH FIXING IN THE TOOL.** It is not a
look-gate band — there is no `entropy` anywhere in `lookcheck`, `lookassert`, `lookmetrics` or
`look-budget.json`. It is `tools/budget.json` → `floors.screenshotEntropy` = 5.0, asserted in
`perfcheck.mjs`, and **it has been the MEDIAN OF THREE RUNS since session 21**
(`perfcheck.mjs:1297`), not a single draw. `perfcheck.mjs:2522` still prints *"ASSERTED ON THE LAST
OF THESE, NOT POOLED"*, which has been false for fifty-five sessions. One line, and it is the kind of
stale sentence that put this claim in a brief.

**7. THE APRON PEDESTRIANS ARE STILL A CITY DEFAULT THAT TRAVELS.** STATE 75 §6 item 3 flagged them
by eye. They are now LIT, which makes them countable: `af-hangar` has four people standing in a flood
pool on the airside of a fence at midnight. Same class as §5 above.

**8. THE THREE STANDING ITEMS, UNCHANGED.** `perfcheck` captures with no `settle()`; its entropy
floor's margin is smaller than its spread (§0.1 with a statistic instead of a millisecond); the four
`trade-*` look frames differ run to run entirely in the vehicles.

---
## 7. THE FOUR PREMISES

| | premise | verdict |
|---|---|---|
| (i) | the city's night look is achieved by something other than local illumination, and that can be extended outward | **FALSE, both halves.** CONTRACT §5.6's clustered forward+ has been the night look since session 1: 384 slots, a 98-slot lamp pool and a 16-slot sign pool. There is no fake and nothing to extend — the airfield was never put on the route. §0 |
| (ii) | `uGroundLighting`'s 16 lux is the whole of the night fill | **FALSE.** It is `LIGHT.streetAverageLux` written into the SKY LUT's lower hemisphere and delivered through PMREM as a positionless global ambient. It is one of three terms; the measured horizontal ambient at midnight is 3.24 lx, and 85% of that is the moon after `moonRedistribution`. §0b |
| (iii) | apron floodlighting costs no draw by the harbour's route | **TRUE ON THE BINDING ROUTE, AND +2 WHERE IT STANDS.** `highway_speed` does not move — it is 4 117 m away. At the apron itself the frame goes 76 → 78 draws, because the two merged lamp meshes did not exist out there until something emitted a lamp. Zero light slots were added: the masts in reach take theirs from the 98 that were parked below the world at zero intensity. §1, §5 |
| (iv) | adding light at midnight moves at least one look band, and the paired A/B can separate that from the entropy floor's spread | **FALSE, AND IT COULD NOT HAVE BEEN OTHERWISE.** Both look eyes are ~5 km from the airfield. No band can move; a band that DID move would have been a defect. The entropy floor is not a look band at all — it is `perfcheck`'s, and it is a median of three rather than the single draw the brief describes. §5, §6 item 6 |
