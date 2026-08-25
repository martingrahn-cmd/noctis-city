/**
 * constants.js — numbers that more than one module needs, and the reasons.
 *
 * A number that appears in two files eventually appears as two different
 * numbers. Anything here is authored once.
 *
 * THE ONE IMPORT, AND IT IS NOT A MODULE. `src/lib/**` is pure — numbers in,
 * numbers out, no state, no ctx, no three — so `core` may read it and
 * `parsecheck` allows exactly this (it forbids `src/core` importing a MODULE).
 * `LAMP_BOWL` below needs an INTEGRAL of the luminaire distribution to state
 * its own derivation, and a constant whose derivation is copied out by hand is
 * the thing this file exists to prevent.
 */

import { bowlRadianceNits, bowlZoneAreaM2 } from '../lib/luminaire.js';

/** Where the block is. Chosen, not arbitrary — see WHY_LATITUDE below. */
export const SITE = {
  latitudeDeg: 40.0,
  dayOfYear: 101,
};

/**
 * WHY_LATITUDE: docs/look-first-sequence.md fixes the four gate times at
 * dawn 0.25, noon 0.5, dusk 0.78, midnight 0.0. Latitude and day of year are
 * the only free parameters that decide what the sun is doing at those four
 * numbers, and they are not independent — at t = 0.25 the hour angle is exactly
 * −90°, so the dawn elevation is sin φ · sin δ alone, while t = 0.78 is
 * H = +100.8°, where the cos H term dominates. Pushing dusk below the horizon
 * therefore pulls dawn down with it. φ = 40.0°, δ = 8.0° (day 101, 11 April) is
 * the balance:
 *
 *   0.25  sun at  +5.1° ENE  — low warm light over the shoulder, long shadows
 *   0.50  sun at +58.0° S    — high, short hard shadows
 *   0.78  sun at  −3.0° WNW  — sun down, sky on fire, street lighting on
 *   0.00  sun at −42.0°      — real night, no twilight left
 *
 * The alternative was dusk with the sun still a degree or two up, which gives a
 * warm beam but an ambient of several thousand lux — far too bright for the
 * neon to read. Dawn already demonstrates warm low-angle direct light; dusk is
 * where the exposure system has to earn its keep, so dusk gets to be dusk.
 */

/** Physical light references, so nobody invents a unit halfway through. */
export const LIGHT = {
  /** lux, direct normal at the top of the atmosphere */
  solarConstantLux: 128000,
  /** lux, full moon at zenith */
  fullMoonLux: 0.267,
  /** cd/m², a lit office window seen from the street */
  windowNits: 220,
  /** cd/m², a neon tube */
  neonNits: 6500,
  /**
   * cd/m², THE AREA AVERAGE OF A SIGN PLATE — tubes plus the dark ground they
   * are mounted on. Session 14, and it is a quantity correction rather than a
   * dimming.
   *
   * The streamed city's `materials.sign` used `neonNits` — A TUBE'S RADIANCE —
   * for a quad that stands for a whole plate. That is CONTRACT §9's shape with
   * two radiances: both are cd/m², both are plausible, and the sign renders. It
   * was harmless for thirteen sessions because not one of those quads reached a
   * frame (they were buried a median 9.51 m inside their own buildings), and
   * the session that made them visible found `citycheck`'s saturation reserve
   * red at 12.49% against 12% in the same run.
   *
   * `block.js` HAS ALWAYS HAD THIS RIGHT AND SAYS WHY, in a comment older than
   * this constant: `neonTube: 230`, `signPlate: 38`, and *"the tube clips to
   * white and blooms; the plate behind it is what carries the colour. Sign
   * colour that lives only in a clipped emitter is sign colour ACES takes away
   * — a saturated glow needs an area that sits below white, not a brighter
   * core."* The origin block's signage is a plate at 38 with tubes at 230 laid
   * over it and it has read well in every look frame since session 3. The
   * generated city's sign is ONE quad and has to stand for both.
   *
   * So it is the area average, and the tube coverage is the only new number:
   *
   *     0.75 x 38  +  0.25 x 230  =  28.5 + 57.5  =  86 cd/m²
   *
   * 0.25 because a channel-letter fascia's letters cover a fifth to a third of
   * their plate; take the middle. Both terms are printed rather than only the
   * result (§9 rule 4), and both inputs come from `block.js` rather than being
   * invented here — 6500/86 = 76x, which is the size of the error and not a
   * taste.
   */
  signPlateNits: 86,

  /**
   * cd/m². THE FLOODLIT BAND AT THE CONDENSER'S FOOT — session 19, and it is a
   * RADIANCE standing in for sixteen floodlights that the renderer cannot have.
   *
   * WHY IT IS NOT SIXTEEN LIGHTS. `CLUSTER.far` is 320 m and `lights.assign()`
   * culls on `depth − radius > far` before it claims a slot. The condenser is at
   * (−430, −560), i.e. **706 m from the origin**, and the closest any route ever
   * comes to it is about 560 m. `560 − 30 = 530 > 320`, so **no clustered light
   * placed at the condenser can be assigned on any frame this project renders**,
   * whatever the pool has spare. (It has 28 spare, not 40: `roleCensus` reports
   * traffic 96 + stall 12 + block 52 + lamp 196 = 356 of 384, and STATE 18 §7.3's
   * "margin 40" predates the stall role. Both numbers are here because the
   * difference between a REGISTRATION count and a per-frame SLOT is CONTRACT §9's
   * shape with two light counts, and this constant exists because of it.)
   *
   * SO THE FLOODLIGHTING IS EMISSION, AND THE QUANTITY THAT SURVIVES FROM THE
   * LIGHTING DESIGN IS THE ILLUMINANCE IT WOULD HAVE PRODUCED.
   *
   *     E = 20 lx        CIE 94's level for a light-coloured surface in a
   *                      light-surround urban district. Anchored against this
   *                      project's own calibrated night level,
   *                      `streetAverageLux` = 16 lx, which it is 1.25× of.
   *     ρ = 0.394        `CITY_MATERIALS.concrete` albedo [0.4, 0.395, 0.378],
   *                      the same figure STATE 18 §3.2 uses for this shell.
   *     L = ρE/π = 0.394 × 20 / 3.1416 = **2.51 cd/m²**
   *
   * WHAT IT IS WORTH, BOTH WAYS. The night carriageway is ρE/π = 0.10 × 16 / π =
   * 0.509 cd/m², so the lit band is **4.93× the road** — which is what a
   * floodlit landmark looks like. The shaft as delivered receives the 0.27 lx of
   * upward glow STATE 18 §3.2 derived, i.e. about **0.034 cd/m²**, so this is
   * **74× what is there now**. That factor is the whole of item 12: §3.2's
   * structural proof is that no ambient term can bring an unlit wall within 5× of
   * the sky behind it, and 74× is not an ambient term.
   *
   * AND IT MUST NOT BLOOM, WHICH IS THE CHECK THAT SAYS IT IS A LIT SURFACE
   * RATHER THAN A SOURCE. At the exposure the night frame settles at (e ≈
   * 0.0141), 2.51 × 0.0141 = 0.0354 exposed linear, against a bright-pass onset
   * of `POST.bloomThreshold · (1 − knee)` = 0.92 × 0.45 = 0.414. It is **11.7×
   * BELOW** the onset. A floodlit wall that blooms is a wall somebody made into a
   * lamp.
   */
  condenserFloodNits: 2.51,

  /**
   * cd/m². RED AVIATION OBSTRUCTION LIGHTS on the two structures over 150 m.
   *
   * ICAO Annex 14 requires medium-intensity obstacle lighting above 150 m, and
   * Type B is **2000 cd** steady red. The emitter this project draws is a box, so
   * the radiance is that intensity over the box's own projected area rather than
   * over a real lens — the same conversion `signPlateNits` and the lamp bowl are
   * a list of getting wrong, done in the stated direction this time:
   *
   *     I = 2000 cd                       ICAO Annex 14 Type B, medium intensity
   *     A = 0.35² = 0.1225 m²             the beacon box, `city.js` → BEACON_M
   *     L = I / A = **16 327 cd/m²**      rounded to 16 300
   *
   * WHY THIS ONE IS ALLOWED TO BE FAR ABOVE THE BLOOM ONSET when the lamp bowl's
   * 9000 is recorded as a defect. Bloom energy is radiance × AREA, and that is
   * the term the lamp-bowl finding turns on: 98 bowls of 1.6115 m² at 9000 is
   * 1 422 000 cd·m²/m² of emitting product. The whole aviation set is **18 boxes
   * of 0.1225 m² at 16 300 = 35 900**, which is **2.5%** of it. An obstruction
   * light is *supposed* to be a point of glare at two kilometres — that is its
   * entire function — and it costs the frame a fortieth of what the streetlamps
   * already spend. §9 rule 4: both numbers, and the ratio.
   *
   * ZERO CLUSTER SLOTS, by the same argument as the tail lamps: the pool a 2000 cd
   * beacon throws at 260 m is invisible against the sky, and what makes it read
   * is the emitter itself.
   */
  aviationRedNits: 16300,
  /**
   * cd/m², THE AREA-AVERAGE RADIANCE OF THE FROSTED BOWL — MOVED TO
   * `LAMP_BOWL` IN THIS FILE, session 28, and it is no longer a value here at
   * all.
   *
   * It sat here as a bare `9000` for eighteen sessions while `block.js` held
   * `EMISSIVE.lampBowl = 210` for the same frosted bowl on the same column —
   * one quantity, two values, two files, 42.86× apart, and nothing comparing
   * them. That is CONTRACT §9's own class, so the repair is structural rather
   * than a third number: `LAMP_BOWL` holds the fixture's geometry, derives
   * Φ/(π·A) = 1952.2 cd/m² from `streetlampCandela` and `LUMINAIRE` through
   * `lib/luminaire.js`, and expresses BOTH delivered radiances as declared
   * factors of it. The full derivation, both measured arms and the reason
   * neither path can ship the correct value today are all written there.
   *
   * Readers take `LAMP_BOWL.streamedNits` (9000, the streamed city) or
   * `LAMP_BOWL.originNits` (**420**, the origin block — session 30 took it
   * from 210 and this sentence went on saying 210, which is exactly 2.0000×
   * the value a reader would actually have got). `citycheck` runs a ratchet
   * over both against the derivation.
   */
  /**
   * candela, PEAK intensity of a high-pressure sodium luminaire — reached at
   * LUMINAIRE.peakAngleRad off nadir, not on the axis.
   *
   * A real street lantern is not a bare bulb and it is not a downlight: it is a
   * cutoff optic that throws an elongated batwing along the carriageway to hold
   * 10–20 lux average with a min/avg uniformity above 0.4. Session 1 modelled a
   * bare bulb at 780 cd and got a 10 m spot under each lamp with black between.
   * Session 2 modelled a cone at 2200 cd with its maximum on the axis, aimed
   * nearly straight down, and got a lit *kerb*: measured on the shipped frame,
   * the brightest ground anywhere was directly under the lamp heads, on the
   * pavement, and the middle of the carriageway sat at about a fifth of it.
   *
   * The number changed with the model and the two are one decision. Under the
   * batwing, illuminance inside the peak angle is exactly
   * `peak · cos³(peakAngle) / h²` — constant across the pool, which is what the
   * 1/cos³ core is for. At h = 8.08 m and a 57° peak that is
   * 6800 × 0.161 / 65 ≈ 17 lux on the carriageway inside each pool, falling to
   * nothing past the cutoff, for a maintained average over the run near
   * `streetAverageLux` below — the figure the environment map is told the
   * carriageway is worth. Two numbers that have to agree, and now one is
   * derived from the other rather than both being authored.
   *
   * 6800 cd peak is a mid-range 150–250 W HPS lantern; real ones run 6 000 to
   * 14 000. src/lib/luminaire.js integrates the distribution and reports the
   * lumens at boot, so the two descriptions of the same fixture stay in step.
   */
  streetlampCandela: 6800,
  /**
   * Fraction of the luminaire's LUMENS that escape outside the beam.
   *
   * A fraction of lumens, and the emphasis is the whole point: sessions 1 and 2
   * both read this as a fraction of peak candela and shipped an isotropic
   * source emitting nearly half the fixture's output into a 26 m sphere hung
   * over the middle of the pattern. 9% is what a semi-cutoff optic leaks.
   */
  streetlampSpillFraction: 0.09,
  /**
   * lux, average maintained illuminance the installed street lighting puts on
   * the carriageway. Feeds the environment map's lower hemisphere at night:
   * the road is a lit surface, and everything facing down — canopy soffits,
   * spandrel undersides, the underside of a sign — is lit by it and by nothing
   * else. Without the term those surfaces render as pure black, which is the
   * one thing a night street's soffits never are.
   */
  streetAverageLux: 16,

  /**
   * cd, PEAK. A PARK LAMP — session 21, and it is `streetlampCandela` derived
   * for a different height and a different job rather than a second guess.
   *
   * The batwing's own relation (see `streetlampCandela` above) is
   * `E = peak · cos³(peakAngle) / h²`, exact inside the peak angle. A park
   * lamp's mounting height is `PARK.lampHeight` = **4.20 m** against the
   * street's 8.08, and BS 5489-1 puts a footpath class at about half a traffic
   * route's level — so the target is `streetAverageLux / 2` = **8 lx**:
   *
   *     I = E · h² / cos³(57°) = 8 × 17.64 / 0.1614 = 874 cd  →  870
   *
   * Both numbers, and the ratio (§9 rule 4): **870 / 6800 = 0.128× the street
   * lamp's peak, delivering 0.50× its illuminance**, because the pool is four
   * times closer to the ground. That factor is the whole reason a park at night
   * looks like a park and not like a car park: the same light level from half
   * the height is a smaller, softer pool with a lit column in the middle of it.
   */
  parkLampCandela: 870,

  /**
   * cd, PEAK. A CAR PARK'S LIGHTING COLUMN — session 40, and it is the same
   * relation `parkLampCandela` is, evaluated at a different height for a
   * different class of surface.
   *
   * `DEAD_ZONE.columnHeight` is **10.0 m** — the height a column has to be for
   * one of them to cover the 30 m square its spacing is derived from — against
   * a park lamp's 4.20 and a street lamp's 8.08. The target level is a surface
   * car park's: EN 12464-2 puts a public parking area between a footpath and a
   * traffic route, so `10 lx` against `streetAverageLux` 16 and the park's 8.
   * The batwing relation is `E = peak · cos³(peakAngle) / h²`:
   *
   *     I = E · h² / cos³(57°) = 10 × 100 / 0.1614 = 6 196 cd  →  6 200
   *
   * Both numbers and the ratio (§9 rule 4): **6 200 / 6 800 = 0.91× the street
   * lamp's peak, delivering 0.63× its illuminance**, because the pool is 1.24×
   * further from the ground and spread over 1.53× the area. So a car park at
   * night is DIMMER than the street beside it and lit from higher up — which
   * is the opposite of the park (0.128× peak, 0.50× illuminance, from half the
   * height), and the two together are why a park and a car park read as
   * different kinds of dark rather than as the same empty rectangle.
   */
  carParkColumnCandela: 6200,

  /**
   * cd, PEAK. A CONSTRUCTION FLOOD MAST — session 21, and it is the one light
   * type in this city that points DOWN INTO something.
   *
   * A site's task lighting is 50 lx (CDM / HSG38 general construction area, and
   * 3.1× `streetAverageLux` because people are working). The mast is
   * `SITE.floodHeightM` = 9.0 m and aims at the middle of the excavation, 18 to
   * 34 m away, so the slant range is `hypot(9, 26)` ≈ **27.5 m** at the middle
   * of that band:
   *
   *     I = E · d² = 50 × 27.5² = 37 800 cd  →  45 000 at the near end of the
   *     band (d = 20.1 m gives 20 000; d = 35.2 m gives 62 000)
   *
   * 45 000 cd is a 2 kW metal-halide site floodlight, which is what is on a
   * mast on a real site. **6.6× a street lamp's peak from a mast 0.53× the
   * height**, which is why it reads as a different KIND of light rather than as
   * a brighter one: hard, directional, downward, and with the excavation's own
   * spoil casting the long shadows a street lamp never makes.
   *
   * IT DOES NOT FOLLOW THE PHOTOCELL. A street lamp is switched by dusk; a site
   * flood is switched by whether anybody is working, and a site that is lit at
   * noon is what a real one looks like when the sky is not doing the job. It
   * costs the same slot either way — see `city.js` → `updateLampPool`.
   */
  siteFloodCandela: 60000,

  /**
   * m. THE FLOOD'S FALLOFF WINDOW, SIZED BEFORE THE INTENSITY WAS DERIVED
   * THROUGH IT — and the first version of `siteFloodCandela` was not, which is
   * CONTRACT §9 rows 6b and 20 for the THIRD time in three sessions.
   *
   * A pool slot is created with `radius: 30` and three's
   * `getDistanceAttenuation(d, R, 2)` carries a Frostbite window `(1 − d/R)²`.
   * A mast aiming 27.5 m from a 30 m window passes `(1 − 0.917)²` = **0.0069**
   * of its intensity: 45 000 cd arriving as **0.41 lx**, an unlit hole under a
   * crane. Measured by looking at the first site frame, which is the one thing
   * that finds this class of defect once the arithmetic has already been done
   * wrong.
   *
   * SIZE THE WINDOW FIRST. The farthest the beam has to reach is
   * `hypot(floodHeightM, 34)` = **35.2 m**, and a window that still passes half
   * its intensity there needs `(1 − d/R)² ≥ 0.5` → `R ≥ d/0.293` = **120 m**.
   * 130 m, so the far end passes 0.53 and the near end (20.1 m) passes 0.71.
   *
   * THEN DERIVE THE INTENSITY THROUGH IT. At the middle of the band, d = 27.5 m
   * and the window is `(1 − 27.5/130)²` = **0.622**, so
   * `I = E·d²/window = 50 × 756 / 0.622` = **60 800 cd** → 60 000, which is a
   * 3 kW metal-halide site floodlight. 45 000 was derived as though the window
   * were 1.
   */
  siteFloodRadiusM: 130,

  /**
   * lux, below which the photocell closes and the street lights up.
   *
   * Calibrated, not picked: this is the horizontal illuminance this atmosphere
   * model produces with the sun exactly on the horizon. Municipal lighting runs
   * on astronomical timers keyed to sunset, and this is what that threshold is
   * worth in lux. Measured with tools/lookcheck.mjs, not guessed.
   */
  photocellOnLux: 1150,
  /** lux, above which it opens again. Hysteresis, or it chatters at dusk. */
  photocellOffLux: 2400,

  /**
   * cd/m². THE FACE OF A ROOFTOP SIGN — session 20, item 3, and it is the
   * largest emissive source this project has ever added.
   *
   * WHY IT IS NOT `signPlateNits` = 86. That number is the area average of a
   * SHOPFRONT FASCIA: a dark plate with channel letters on it, 0.75 × 38 +
   * 0.25 × 230, and its two terms come from `block.js`. A rooftop sign is not
   * that object. It is a back-lit cabinet or an open frame of tubes designed to
   * be read from ANOTHER BLOCK — `citygen.js` puts it 300 to 800 m from the
   * eye that has to read it — and there is no dark plate between the letters to
   * average down, because the whole face is the emitter.
   *
   * THE NUMBER COMES FROM THE SIGNAGE STANDARD RATHER THAN FROM THIS PROJECT,
   * for the same reason `aviationRedNits` takes 2000 cd from ICAO: the quantity
   * is regulated and there is no point inventing one. ILP GN01 / CIE 150 set a
   * maximum average luminance for an externally-read illuminated sign of area
   * over 10 m²: **E3 (suburban) 600 cd/m², E4 (urban centre) 1000**. Every
   * rooftop sign this project builds is over 10 m² by construction — the
   * smallest is `ROOF_SIGN.minWidthM` 6.0 × 0.34 aspect = 12.2 m².
   *
   * IT SHIPPED AT E3's 600 AND IT IS E4's 1000, AND THE CORRECTION IS THE
   * DISTRICT RATHER THAN THE MEASUREMENT. 600 was the conservative end of the
   * band on the grounds that a conservative number is easier to defend; the
   * district these signs stand in is `downtown_dense` at 93% chunk occupancy
   * with a street lighting design of `streetAverageLux` = 16 lx, which is an
   * urban centre by every criterion the standard uses. E4 is the row this city
   * is on, and picking the row below it because it was smaller is choosing a
   * number for the wrong reason. Both are here so the next session disagrees
   * with the district rather than with the taste.
   *
   * THREE CROSS-CHECKS, ALL AGAINST NUMBERS ALREADY IN THIS FILE (§9 rule 4):
   *
   *     against a lit office window  1000 / 220  windowNits        =  4.55×
   *     against a shopfront fascia   1000 /  86  signPlateNits     = 11.63×
   *     against the lamp bowl        1000 / 9000 streetlampNits    =  0.111×
   *
   * A rooftop sign brighter than a window and fifteen times dimmer than a lamp
   * bowl is the right ordering, and it is the ordering the ELEVATED frame needs:
   * every bowl in the city is below the camera and behind a parapet, the windows
   * are the only thing in that frame today (measured — STATE 19 §8: 99.30%
   * shadow, median code 7), and this sits between them.
   *
   * BLOOM ENERGY, WHICH IS THE TERM THE LAMP-BOWL FINDING TURNS ON (§9 row 18b:
   * bloom energy is radiance × AREA, not radiance):
   *
   *     98 lamp bowls × 1.6115 m² × 9000  =  1 422 000 cd·m²/m²
   *     the delivered roof-sign set        =  N × A × 1000, printed once by
   *                                           `city.js` → `reportRoofSigns`
   *                                           when the residency ring is stable
   *
   * AND THAT COMPARISON IS AN UPPER BOUND RATHER THAN A MEASUREMENT, which the
   * printed line says in its own words: the 98 bowls are what the pool lights
   * within about 150 m of the camera and the roof-sign figure is everything
   * resident over a 1.4 km square, most of it behind something or under a pixel.
   * Delivered at seed 1337: 513 faces, 19 490 m², 19 490 k — 13.7× — over 121
   * chunks, i.e. 161 m² of emitter per chunk. What a FRAME actually receives is
   * `tools/levels.mjs` on a frame, and it measured the elevated night frame's
   * crushed fraction going 5.86% → 0.00%.
   *
   * AND IT IS FAR ABOVE THE BRIGHT-PASS ONSET, DELIBERATELY. At the night
   * exposure (e ≈ 0.0141) 1000 × 0.0141 = 14.1 exposed linear against an onset
   * of 0.414 — 34× over, so a roof sign blooms. `condenserFloodNits` is 11.7×
   * BELOW the onset and says in its own comment that a floodlit wall which
   * blooms is a wall somebody made into a lamp. The difference is not
   * inconsistency: that constant stands for a LIT SURFACE and this one stands
   * for a SOURCE, and a large lit sign that does not bloom at night is a sign
   * nobody photographed.
   */
  roofSignNits: 1000,

  /**
   * cd/m². AIRCRAFT NAVIGATION AND ANTI-COLLISION LIGHTS — session 20, item 5.
   *
   * ICAO Annex 6 / FAR 23.1389 set navigation-light intensities in candela by
   * sector; the emitter this project draws is a box, so the radiance is that
   * intensity over the box's own projected area — the same conversion
   * `aviationRedNits` does, and the same one `signPlateNits` and the lamp bowl
   * are a list of getting wrong:
   *
   *     position (red port, green starboard, white tail)
   *       I = 40 cd            FAR 23.1389 forward sector minimum
   *       A = 0.22² = 0.0484 m²  `aircraft.js` → NAV_M
   *       L = I / A = **826 cd/m²**, rounded to 830
   *
   *     anti-collision beacon and strobe
   *       I = 400 cd           FAR 23.1401 minimum effective intensity
   *       A = 0.0484 m²
   *       L = **8264 cd/m²**, rounded to 8300
   *
   * ZERO CLUSTER SLOTS for all five, by the tail-lamp argument (§9's traffic
   * note): the pool a 40 cd lamp throws at 400 m altitude is nothing at all, and
   * what makes an aircraft read is the emitter itself.
   *
   * THE SEARCHLIGHT IS THE ONE THAT IS A LIGHT, and it is a light because its
   * whole point is what it does to a facade rather than what it looks like.
   *
   * A Nightsun-class airborne searchlight is 30–50 million candela on axis at
   * about a 4° beam. That is not what this can spend: the cone would resolve
   * across one froxel of a 16 × 9 grid, and a 4° cone at 150 m is a 10.5 m pool
   * that a moving helicopter crosses a facade with in under a second. So the
   * DELIVERED number is derived from the illuminance it is asked to put on the
   * ground, which is the quantity that survives the design — `condenserFloodNits`
   * made exactly the same move for exactly the same reason.
   *
   * AND THE DERIVATION HAS TO INCLUDE THE FALLOFF WINDOW, WHICH THE FIRST
   * VERSION DID NOT. This project's punctual attenuation is three's own
   * `getDistanceAttenuation(d, R, 2)` — inverse square TIMES the Frostbite
   * window `(1 − d/R)²` — and that window is not a rounding error near the
   * cutoff. CONTRACT §9's table, row 6b, is this exact mistake with a headlamp:
   * "a 30 m headlight beam culled at 18.31 m and three times dimmer at 15 m".
   *
   * The first version of this constant set R = 260 m for a beam whose ground
   * point is 155–249 m down the axis, so the window delivered `(1 − 249/260)²`
   * = **0.0018** and the pool was 0.04 lx. The frame showed nothing at all, and
   * the arithmetic that was missing is one line.
   *
   *     THE WINDOW IS SIZED FIRST.  R = 850 m
   *       at the shallow end, d = 249 m:  (1 − 249/850)² = 0.5001
   *       at the steep end,   d = 155 m:  (1 − 155/850)² = 0.6607
   *     — i.e. the beam works in the half of the window where it is still
   *     roughly a half rather than in the tail where it is a thousandth.
   *
   *     THEN THE INTENSITY, against the steep end:
   *       E = I · window / d²  =  I · 0.6607 / 155²  =  I · 2.750e-5
   *       I = 3 300 000 cd   →   **E = 90.8 lx** at 155 m
   *                          →   **E = 26.6 lx** at 249 m
   *
   *     AGAINST WHAT IS ALREADY IN THIS FILE:
   *       `streetAverageLux` = 16 lx      5.7× at the steep end, 1.7× shallow
   *       a real Nightsun at 30 Mcd       this is 11% of it, and its own pool
   *                                       is near 1300 lx — so this is the
   *                                       conservative end of the real thing.
   *
   * The cone is opened to 7.5° half-angle rather than ICAO's 2°, giving a
   * 2·d·tan 7.5° pool of 65.6 m at the shallow end and 40.8 m at the steep one,
   * against a 15 m carriageway and a 23.4 m corridor — a street and a bit of the
   * buildings either side, which is what a searchlight looks like. Both numbers
   * are here because the second is a departure from the first.
   *
   * WHAT THE LARGE RADIUS COSTS, SAID PLAINLY: the bound sphere circumscribing
   * a 7.5° sector of range R has radius R/(2·cos 7.5°) = 0.504·R = 428 m, so
   * this one light claims froxels over a large part of the screen. That is
   * ONE slot and AT MOST +1 on any froxel's occupancy, against a
   * `minOccupancyMargin` of 40 and delivered margins of 55–85; the index-list
   * cost is bounded by the grid at 3 456 writes against `CLUSTER.maxIndices` =
   * 131 072. A large bound is cheap when there is one of it.
   */
  aircraftNavNits: 830,
  aircraftBeaconNits: 8300,
  searchlightCandela: 3300000,
  searchlightRadiusM: 850,
};

/** The block. Session 1 only: one street, one cross street, one intersection. */
export const BLOCK = {
  /** Main street runs east-west, so the sun is down it at both dawn and dusk. */
  streetWidth: 15,
  sidewalkWidth: 4.2,
  kerbHeight: 0.16,
  crossStreetWidth: 13,
  /** Half-extent of the ground plane. Beyond this is sky and haze. */
  groundExtent: 4000,
  buildingCount: 10,
};

/**
 * THE GROUND DATUM — session 19.
 * ==============================
 *
 * **y = 0 IS THE CARRIAGEWAY SURFACE.**
 *
 * That sentence is a DECLARATION of something that was already true of every
 * object in this project and false of one file's ground quads, which is why it
 * is written here — in the file both `city.js` and `block.js` already import —
 * rather than invented as a new convention.
 *
 * WHAT WAS ACTUALLY WRONG, AND IT IS SMALLER AND WORSE THAN "NOBODY CHOSE A
 * DATUM". Every object that stands on the ground is authored with its base at
 * y = 0: a wheel's centre is its own radius (`traffic.js`), a pedestrian's
 * instance matrix writes `arr[13] = 0` (`streetlife.js`), a stall passes the
 * literal `0` as `composeScaledYaw`'s y, and so do a prop's box, a lamp column
 * and a signal mast.
 * `block.js` agrees — its `surfaceAt` returns **0.0** for the main street and
 * `BLOCK.kerbHeight` for the pavement, so THE ORIGIN BLOCK HAS OBEYED THIS
 * DATUM SINCE SESSION 1. `city.js`'s `GROUND_Y` did not: it put the streamed
 * carriageway at **0.020** and the streamed pavement at **0.030**, and both
 * numbers are a z-fighting offset above `earth` wearing a kerb's clothes (§9's
 * table, row 17a).
 *
 * SO THE DELIVERED ARITHMETIC, WHICH IS WHAT MAKES THIS THE FIRST ITEM:
 *
 *     160 vehicles, contact patch at y = 0, carriageway at 0.020
 *         → every wheel 20 mm INSIDE its own road, in every frame ever shipped
 *     streamed kerb  0.030 − 0.020 = 0.010 m
 *     block kerb     0.160 − 0.000 = 0.160 m           16× the streamed one
 *     block pavement over streamed pavement, |x| ∈ [168, 266.5]
 *                    0.160 − 0.030 = 0.130 m step, 98.5 m at each end
 *
 * ALL THREE ARE ONE NUMBER, AND MOVING THE DATUM CLOSES ALL THREE. The streamed
 * carriageway goes to 0 and the streamed pavement to `BLOCK.kerbHeight`, so the
 * wheels land on the road, the kerb becomes the kerb, and the 0.130 m step in
 * the middle of a pavement becomes 0.000 because the two pavements are now the
 * same height by construction rather than by coincidence.
 *
 * THE OBJECTION SESSION 18 RAISED, AND WHY IT DOES NOT APPLY. STATE 18 §7.2
 * showed that raising the pavement to **0.181** puts island interiors at
 * `0.181 − earth(−0.020)` = **0.201 m** against `PLAYER.stepUpM` = 0.200, i.e.
 * a hole a player falls into and cannot climb out of. That arithmetic is right
 * and its premise is not: 0.181 is `0.020 + 0.161`, which STACKS a real kerb on
 * top of the z-fighting offset instead of REPLACING it. Moving the datum gives
 *
 *     pavement − earth  =  0.160 − (−0.020)  =  **0.180 m  ≤  0.200 m**
 *
 * with 0.020 m of margin, 1.11×. And it needs no new evidence at all, because
 * **the origin block has had exactly that 0.180 m step since session 1** —
 * `block.js`'s pavement is 0.160 over the same earth plane at −0.020 — and it
 * is walked in every `walkprobe` run. The trap was created by the repair, not
 * by the world.
 *
 * WHAT STAYS BELOW ZERO, AND WHY THE GAP IS 0.020 AND NOT SOMETHING NEATER.
 * `earth` is `block.js`'s global ground plane and the carriageway quads have to
 * be clear of it or they z-fight. 0.020 m is not chosen here: it is the
 * separation `block.js`'s own main street (0.000) has always had from that
 * plane (−0.020), over 8 km of ribbon, without z-fighting. So the one piece of
 * evidence for the number is the geometry that has been shipping on it.
 *
 * WHAT THIS DATUM DOES **NOT** DO, SAID HERE SO THE NEXT SESSION DOES NOT LOOK
 * FOR IT. It makes y = 0 correct for anything standing on a CARRIAGEWAY, which
 * is the traffic and nothing else. Everything standing on a PAVEMENT — every
 * pedestrian, stall, bollard, bin, bench, planter, lamp column and signal mast
 * — is now 0.160 m out instead of 0.020 m out, i.e. the declaration makes the
 * remaining error EIGHT TIMES LARGER for those objects and there is no version
 * of a single datum that does otherwise. They read the ground instead:
 * `city.groundYAt(x, z)`, which is `surfaceAt` returning only the number.
 * A datum is what a query is measured FROM; it is not a substitute for one.
 */
export const GROUND = {
  /**
   * THE DATUM. Metres. A wheel's contact patch, a foot, a column base, a mast
   * base and a prop's underside are all at this height in their own frames.
   */
  carriageway: 0,

  /**
   * Metres. Where a north–south strip crosses an east–west one, one of the two
   * coplanar quads has to win or they z-fight. The east–west strip is laid this
   * much higher and wins every crossing in the city.
   *
   * 1 mm, and it is a rendering artefact rather than a feature: a tyre 1 mm
   * into an east–west carriageway is 1/20th of the error this whole section
   * exists to remove, and 1 mm is under the 4 mm a 0.58 m wheel subtends at one
   * pixel from 12 m at the internal resolution. Recorded rather than hidden —
   * the datum is exact on a north–south road and 1 mm out on an east–west one.
   */
  crossingBias: 0.001,

  /**
   * Metres. The pavement top. `BLOCK.kerbHeight` above the carriageway BY
   * DEFINITION, which is what makes the kerb one quantity instead of two:
   * before this line `BLOCK.kerbHeight` was imported by `block.js` and by
   * nothing else, while `city.js` had 0.010 m of its own in a different file.
   */
  pavement: BLOCK.kerbHeight,

  /**
   * Metres. Mown grass on a park island, 20 mm below the pavement that encloses
   * it — the relation `city.js` has always delivered (0.028 against 0.030),
   * carried over rather than re-chosen, because nothing measured it and a new
   * number here would be a guess (§9 rule 5).
   */
  grass: BLOCK.kerbHeight - 0.02,

  /**
   * Metres. The two gravel paths across a park, proud of the grass they cross.
   * 4 mm and 5 mm, the delivered relation (0.032/0.033 over 0.028), with the
   * north–south one upper so that it wins its crossing — the same rule
   * `crossingBias` states for roads, one surface family over, and it is a
   * different sign because `city.js` has always drawn it that way.
   */
  pathEW: BLOCK.kerbHeight - 0.02 + 0.004,
  pathNS: BLOCK.kerbHeight - 0.02 + 0.005,

  /**
   * Metres. The world's earth plane — `block.js`'s ground quad, and what
   * `surfaceAt` answers wherever no road, pavement, park or deck was emitted.
   *
   * BELOW THE DATUM, and the two numbers that bound it are on opposite sides:
   * it must be far enough below `carriageway` not to z-fight (0.020 m,
   * attested by eight kilometres of `block.js` ribbon) and close enough that
   * `pavement − earth` = 0.180 m stays under `PLAYER.stepUpM` = 0.200 m. The
   * window is [−0.040, −0.020] and this sits on the tight end of it, which is
   * the end with the rendering evidence.
   */
  earth: -0.02,
};

/** Exposure model. CONTRACT §5.4. */
export const EXPOSURE = {
  /** Reflected-light meter calibration constant. */
  K: 12.5,
  /**
   * Partial adaptation. 1.0 would render midnight and noon identically —
   * a day/night cycle you cannot see is not a day/night cycle.
   */
  adaptStrength: 0.64,
  anchorEV: 11.0,
  minEV: 3.0,
  maxEV: 16.0,
  /** Seconds. Light adaptation is fast, dark adaptation is slow. Like an eye. */
  tauUp: 0.32,
  tauDown: 1.9,
  /** cd/m². Absolute clamps on the meter so a sun disc cannot own the average. */
  meterMin: 1e-3,
  meterMax: 2.4e4,
  /**
   * Histogram clipping, as a multiple of the currently adapted luminance.
   *
   * A geometric mean is robust to a few outliers but not to a night street's
   * worth of them: lit windows, shopfronts, sign faces and lamp bowls together
   * cover a tenth of the frame at two orders of magnitude above the asphalt,
   * and they pull the meter up until the exposure renders every wall black.
   * Clipping each pixel into a window around the current adaptation makes the
   * meter measure the mid-tones, which is what it is for. Every camera does a
   * version of this; the ones that do not are the ones you correct by hand.
   */
  meterClipHigh: 6.0,
  meterClipLow: 0.02,
};

/** Post chain. CONTRACT §5.5. */
export const POST = {
  /** Threshold on EXPOSED linear values, so it tracks adaptation. */
  bloomThreshold: 0.92,
  bloomSoftKnee: 0.55,
  /**
   * 0.055 from session 1 to 26. **0.016 in session 27**, and the reason is that
   * SIXTY-ONE PER CENT OF THE MIDNIGHT FRAME WAS CAMERA GLOW RATHER THAN CITY.
   *
   * Session 4 tried 0.030 and put it back: "at 0.030 the dusk stddev went DOWN
   * (0.1268 → 0.1258) and both the dawn and dusk means fell out of their bands."
   * THAT MEASUREMENT NO LONGER REPRODUCES, and the re-measurement is the licence
   * for this change rather than a preference against it. On today's content,
   * 0.030 delivers dawn 0.3118 and dusk 0.1518 — both comfortably inside
   * [0.299, 0.353] and [0.14, 0.18]. Session 4 measured an origin block; the
   * frame now contains a streamed city, traffic, pedestrians and aircraft, and
   * the finding was right about a world that has moved on (§9 rule 7).
   *
   * THE DECOMPOSITION, `lookcheck` at the gate's own camera and seed. Each arm
   * is one constant changed from the shipped value, everything else held:
   *
   *     bloom  glare   midnight mean   ground pools   albedo clusters
   *     0.055  0.075        0.1744            5              3        ← shipped
   *     0.055  0.000        0.1505            8              3
   *     0.000  0.075        0.1115            9              4
   *     0.000  0.000        0.0682            9              3
   *
   * The exposed scene with NO camera glow at all is 0.0682, against a band of
   * [0.072, 0.112] centred 0.092. So the city was never the thing that was too
   * bright: bloom and veil together were adding 0.106 to a 0.068 frame, and
   * CONTRACT §5.5 names the symptom in one line — "if the whole frame glows, the
   * threshold is wrong."
   *
   * WHY THE THRESHOLD WAS NOT THE LEVER, measured before this one was touched.
   * `bloomThreshold` 0.92 → 2.0 → 4.0 moves midnight only 0.1744 → 0.1712 →
   * 0.1672, because the emitters this frame is full of sit ~300× over the onset
   * (§9's `streetlampNits` row) and a 4.3× onset does not reach them. What it
   * DOES reach is the daytime mid-tones: noon fell to 0.4277 and 0.4261, i.e.
   * THROUGH its own 0.428 floor. The obvious repair was the wrong one and is
   * recorded so it is not tried again.
   *
   * WHY BLOOM AND NOT EXPOSURE. `EXPOSURE.minEV` 3.0 → 7.0 puts midnight at
   * 0.0923 — dead centre of the band — and leaves dawn, noon and dusk identical
   * to four decimals, which makes it the only midnight-selective lever in the
   * system. It was rejected on the frame it produces: darkening by exposure
   * multiplies the near-black pixels down through the ACES toe, and midnight's
   * crushed-black fraction went to **6.63% against a 2% ceiling** with emitter
   * clusters at 58 against a floor of 60. Removing bloom removes halos without
   * moving the toe: at the value below the crush is 0.88% and the clusters 83.
   *
   * THE COST, AND IT IS THE TIGHT PART OF THIS CHANGE. Bloom is also what holds
   * NOON above its own floor: the noon scene without glow is 0.4255 against a
   * band floor of 0.428. So bloom cannot go to zero, and the feasible window
   * between "midnight under 0.112" and "noon over 0.428" is about 0.003 wide in
   * this constant. 0.016 sits in it with midnight at 0.1101 (0.0019 of margin)
   * and noon at 0.4293 (0.0013). Both are ~15× the run-to-run spread of these
   * means, which is 0.0001 — resolvable under §0.1 rule 6, and thin. **The two
   * bands were both re-centred on session 2's content and neither has been
   * re-derived since; that they now bracket a 0.003 window is a fact about the
   * bands, and it is STATE 27 §1.5's question for the operator.**
   */
  bloomStrength: 0.016,
  bloomMips: 8,
  /**
   * Veiling glare, as a fraction of the coarsest bloom mip added uniformly.
   * Physically the light a lens scatters across its own image; practically the
   * only honest way to keep a high-contrast night frame off pure black.
   *
   * Eight mips rather than six specifically so the coarsest one is 1/256 of the
   * frame and therefore nearly flat. At six mips the veil still had structure,
   * so it lifted the blacks next to a neon sign and left the blacks in the far
   * corner exactly where they were — which is the opposite of what glare does.
   */
  /**
   * 0.15 in sessions 1–3, halved in session 4 — RE-DERIVED, not relaxed.
   *
   * The veil is a fraction of the coarsest bloom mip, which is the total energy
   * of everything in frame that is above the bright-pass threshold. That is the
   * right physical shape: a lens scatters a fraction of the light falling on it,
   * so more sources means more glare. But the coefficient was chosen on a frame
   * with roughly fifty emitters in it, and a city street has several hundred —
   * so the same coefficient produced several times the veil it was calibrated to
   * produce.
   *
   * Measured on the night route's worst sample: of 15.3% of pixels that were
   * both saturated and bright, the city's own emitters accounted for 0.10% and
   * bloom-plus-veil for the rest. The veil alone was 9.7 percentage points. That
   * is docs/authored-city.md's saturation reserve being spent by the camera
   * rather than by the city, and CONTRACT §5.5 names the symptom exactly: "if
   * the whole frame glows, the threshold is wrong".
   *
   * Swept: 0.15 → 15.3%, 0.11 → 13.0%, 0.09 → 11.8%, 0.075 → 10.9%, 0.05 → 8.5%
   * against a 12% reserve. 0.075 is the value with real margin rather than the
   * first one that passed.
   *
   * The term still does its job, and that is the constraint this was re-derived
   * under rather than an afterthought: midnight's crushed-black fraction is what
   * the veil exists to hold off zero, and it stays far under its 2% ceiling.
   *
   * ────────────────────────────────────────────────────────────────────────
   * SESSION 27: 0.075 → 0.010, RE-DERIVED A THIRD TIME, AND THIS TIME AGAINST
   * THE GROUND POOLS RATHER THAN AGAINST THE SATURATION RESERVE.
   *
   * `groundPools` asks whether the streetlights lay a pattern on the asphalt. It
   * counts regions on the roadway brighter than **3.0 × the roadway's own
   * median**. That ratio is the whole argument:
   *
   *   - A MULTIPLICATIVE change — exposure, a global gain — scales the pool and
   *     the median together. `P > 3·median` is unchanged, and the count does not
   *     move. Measured: `minEV` 3.0 → 6.0 lowered the roadway median 7.6% and
   *     left the count at 5.
   *   - An ADDITIVE change — this term, added uniformly to every pixel — raises
   *     the median by Δ and therefore the bar by 3Δ, so a pool must now clear
   *     `3·median + 2Δ`. **The veil makes its own test harder by twice what it
   *     adds.** Measured: 0.075 → 0.000 lowered the median only 6.9% — less than
   *     the exposure arm did — and took the count from 5 to 8.
   *
   * So the pool count was never about the light level. It was about what was
   * being added on top of it, and this constant was the thing adding it.
   *
   *     glareStrength   0.075   0.035   0.022   0.010
   *     ground pools        5       6      10      10     (floor 6)
   *     albedo clusters     3       4       4       4     (floor 4)
   *
   * THE ALBEDO COLUMN IS THE SAME MECHANISM AND IT IS WHY THE PALETTE WAS NOT
   * TOUCHED. `facadeAlbedo` measures chromaticity against log-luminance, and a
   * uniform lift drives every ratio in a frame toward 1. The five walls it
   * samples are two concretes, two bricks and a stucco: brick and concrete sit
   * **2.255** apart in that metric as base reflectances and the frame was
   * delivering them **0.294** apart. The materials were never the same; the veil
   * was making them look it. A palette widening was built, measured, and
   * reverted — it moved the closest pair 0.259 → 0.278 and tipped `warmth:dusk`
   * red, which is what repairing the wrong cause looks like.
   *
   * WHAT BOUNDS IT FROM BELOW, so this is a window and not a direction. The veil
   * is what holds the ACES toe off zero (§5.5), and with bloom also cut it is
   * the only thing doing so: at 0.000, with `bloomStrength` at 0.000, midnight's
   * crushed-black fraction is **5.89% against a 2% ceiling**. At 0.010 against
   * the bloom value above it is **0.88%**. The term is kept, small, and still
   * load-bearing — it is not switched off.
   *
   * The saturation reserve that produced the 0.15 → 0.075 re-derivation moves
   * the safe way throughout (0.075 → 10.9%, 0.05 → 8.5% against a 12% reserve),
   * so nothing that argument protected is put at risk by going further down it.
   */
  glareStrength: 0.01,
  /**
   * Rod vision below ~3 cd/m². Applied per-pixel on absolute luminance, so a
   * neon sign stays photopic and saturated while the asphalt beside it goes
   * blue. This is a perceptual model, not a night-time colour grade.
   */
  purkinjeStrength: 0.5,
  purkinjeLow: 0.006,
  purkinjeHigh: 0.4,
};

/** Half-float ceiling. The sun disc is ~1.9e9 cd/m²; unclamped it becomes Inf. */
export const HDR_CLAMP = 60000.0;

/**
 * Internal render resolution — session 4, and settled before the session began.
 *
 * Everything upstream of the composite runs at this many pixels regardless of
 * how large the window is; the composite is the one pass that runs at the
 * display's own resolution, and it is where the upscale happens. The reason to
 * fix it rather than to track the window is that every light budget downstream
 * is a per-pixel cost, and a budget measured against a window somebody happened
 * to have open is not a budget.
 *
 * `pixels` rather than a width and a height, because the internal buffer has to
 * match the display's aspect ratio or the image is stretched. At 16:9 it is
 * exactly 2560×1440; at 16:10 it is 2416×1510, which is the same amount of
 * shading work. `tools/budget.json` captures at 16:9, so the gate measures
 * 2560×1440 exactly and `harness.info().internal` reports it.
 */
export const RENDER = {
  internalWidth: 2560,
  internalHeight: 1440,
  pixels: 2560 * 1440,
  /**
   * Never render more pixels than the display has. Upscaling is the point; a
   * fixed internal resolution that *super*sampled a small window would be a
   * different and much more expensive decision arrived at by accident.
   */
  neverExceedNative: true,
};

/**
 * Temporal antialiasing, and the upscale. CONTRACT §5.10.
 *
 * TAA rather than FSR, and the reason is SSR. A spatial upscaler has no history:
 * EASU reconstructs an edge and RCAS sharpens it, and both would amplify the
 * frame-to-frame instability of a single-ray screen-space reflection rather than
 * resolve it. TAA's accumulation is simultaneously the antialiasing, the SSR
 * denoiser and the upscale, out of one buffer.
 *
 * It is also close to free here, and that is a consequence of two decisions made
 * for other reasons. §5.8 put linear view depth in the alpha of the HDR target,
 * so the reprojection needs no G-buffer and no velocity target; and every object
 * in this world is static, so camera reprojection from that depth *is* the
 * complete motion field rather than an approximation of one.
 *
 * It replaces 4× MSAA, which it more than pays for: at 2560×1440 RGBA16F, 4×
 * MSAA is 4 × 3.686 M × 8 B = 118 MB against 29.5 MB for a single sample and
 * 59 MB for two history buffers — 29.5 MB saved and one resolve per frame gone.
 * It also fixes a defect MSAA was causing: multisample resolve averages the
 * alpha channel, and the alpha channel is a *depth*, so every silhouette in the
 * SSR source buffer carried a depth that was between the two surfaces and on
 * neither of them.
 */
export const TAA = {
  /**
   * Halton(2,3), the standard low-discrepancy sequence for this. Eight samples
   * rather than sixteen: the history is exponential rather than a box filter, so
   * beyond about 1/(1−feedback) frames the oldest samples contribute nothing,
   * and at feedback 0.92 that is twelve.
   */
  jitterSamples: 8,
  /**
   * Weight kept from the history each frame. 0.92 is a 12-frame effective
   * window: long enough for eight jitter positions to average, short enough that
   * a clamp failure decays out of the image in a fifth of a second.
   */
  feedback: 0.92,
  /**
   * Neighbourhood clip width, in standard deviations of the 3×3 current-frame
   * colour distribution, in YCoCg. Below about 1.0 the clamp eats the
   * antialiasing it is supposed to protect; above about 2.0 it stops catching
   * ghosts. 1.25 is the usual place to sit.
   */
  clipGamma: 1.25,
  /**
   * Frames `harness.settle()` runs to converge the accumulation before a
   * capture. 0.92^32 = 0.07, so the captured frame is 93% of the way to the
   * fully supersampled image and the remaining 7% is below a quantisation step.
   * A capture that depends on how many frames the machine happened to render is
   * not a capture — CONTRACT §8.
   */
  settleFrames: 32,
};

/**
 * The canyon field — the indirect-light structure, CONTRACT §5.7.
 *
 * Everything here is geometry, not light. The bake is deliberately independent
 * of the sun so that it stays valid as the sun moves and can be done per chunk
 * when session 3 has chunks.
 */
export const CANYON = {
  /**
   * DIMENSIONLESS. THE FRACTION OF THE ROAD'S MAINTAINED ILLUMINANCE THAT THE
   * STREET LAMPS ALSO PUT ON A FACADE — session 19, item 10.
   *
   * WHY IT IS A RATIO AND NOT A LUX FIGURE. The canyon field stores TRANSFER,
   * not radiance (CONTRACT §5.7): the whole reason it is baked once and valid at
   * every hour is that nothing in it mentions a source. This is the same
   * discipline one level up — a maintenance factor, a lamp count or a photocell
   * state changes the road's lux and must change the facade's by the same
   * factor, so what is stored is the coupling and the source stays in `sky
   * .groundLightingLux`, which is where the sky LUT's lower hemisphere already
   * reads it from. One number for how many lamps are lit, two consumers.
   *
   * DERIVED BY INTEGRATING THIS PROJECT'S OWN OPTIC OVER ITS OWN STREET, not
   * chosen. `luminaire.js`'s distribution — `I(γ) = streetlampCandela ·
   * smoothstep(cos 68°, cos 61°, ĉ) · min(1, (cos 57°/ĉ)³)` with the elliptical
   * shaping `tan 68°/tan 46°` = 2.391 — evaluated over the delivered geometry:
   *
   *     lamp head        y = 8.08 m       `city.js`, `block.js` (8.4 − 0.32)
   *     head offset      6.7 m off centre pole at 8.8, arm reach 2.1
   *     facade plane     11.7 m           `CORRIDOR` = 7.5 + 4.2
   *     pitch            30 m, staggered  both rows
   *     isotropic spill  70.8 cd          0.09 × 9883.5 lm / 4π
   *
   *     carriageway, both rows      E_road   = 24.58 lx
   *     facade 0–26 m, area mean    E_facade =  2.464 lx
   *     ratio                                =  **0.1002**
   *
   * **A semi-cutoff optic over a 15 m carriageway puts one tenth as much on the
   * wall as on the road**, and the shape is why: the across-road cutoff lands
   * about 3 m up, so the facade sees ~20 lx at the plinth and 1.2 lx at lamp
   * height — the latter carried entirely by the isotropic spill, checked in
   * closed form as `2·70.8/(30·5.0) + 2·70.8/(30·18.4)` = 0.944 + 0.257 =
   * 1.20 lx. Above 8.08 m the cutoff optic contributes exactly nothing, by
   * construction (`luminaire.js`: "the upper hemisphere is empty").
   *
   * WHAT IT IS WORTH, AND IT IS THE HONEST HALF OF THIS ITEM. At
   * `LIGHT.streetAverageLux` = 16 lx the facade gains 1.60 lx, i.e.
   * `albedo · E / π` = **+0.19 cd/m² on a facade at 2.2** — **+8.5%, or +0.118
   * stops.** The night frame's median is code 24 and Zone III is code 60, a gap
   * of **+2.2 stops**. So this term is real, correctly shaped, sun-independent
   * and nearly free, AND IT IS NOT THE FIX FOR THE DARK NIGHT — it is 5% of it.
   *
   * The ceiling is structural, exactly as STATE 18 §3.2's is for the sky term
   * and arriving through the lamps instead: lifting a facade one stop needs
   * `E_facade ≈ 2.2·π/0.4` = **17 lx** on the wall, which is the ROAD's own
   * illuminance, and a cutoff optic delivers a tenth of that BY DESIGN. There is
   * no lamp specification that closes it, because the optic that would is the
   * one nobody fits to a street light.
   *
   * SO IT CANNOT PAY FOR THE LAMP-BOWL CORRECTION, and that is written here
   * rather than discovered next session. STATE 18 §6 measured correcting
   * `LIGHT.streetlampNits` 9000 → 1952 as **12.15% → 3.26%** of Zone III–VII
   * mass, i.e. −8.89 points, and left the correction unshipped pending
   * "replacement energy in before the correction". +0.118 stops is not 8.89
   * points. The bowl stays at 9000 for a nineteenth session, and what would pay
   * for it is EMISSION, not transfer — item 11's roof signs and item 12's
   * beacons and floodlighting.
   *
   * A CAVEAT THAT BOUNDS ITS OWN VALIDITY. `uNoctisFaceL` is one global vec3[4]
   * for the whole city, so this lifts every facade everywhere — including an
   * unlit alley and a wall 100 m up, where the true lamp term is zero. The
   * solid-angle-weighted mean falls from 1.74 lx at a receiver on the road to
   * 0.67 lx at y = 5 m, so a single scalar over-lights a high receiver by about
   * 2.6×. At 0.19 cd/m² against 2.2 that is 7% of a facade nobody is looking at;
   * at any larger magnitude it would need a height falloff, and that sentence is
   * the bound on how far this number may be raised.
   */
  facadeLampShare: 0.1002,

  /** Metres. Horizontal voxel spacing. */
  voxelXZ: 1.6,
  /**
   * Vertical samples, square-root warped so spacing follows the camera: about
   * 0.6 m under six metres, three metres at fifty. A uniform ladder spends most
   * of itself on empty air above the parapets and lets the canopy soffit — the
   * one overhang anybody stands under — share a voxel with the shopfront.
   */
  slicesY: 48,
  /** Metres. Top of the baked volume; above it every surface is open sky. */
  height: 96,
  /** Metres of margin around the block's own extent. */
  margin: 14,
  /**
   * Hard ceiling on voxel count. Resolution is coarsened to fit rather than
   * allocating whatever the spacing implies and finding out on another machine.
   * 900k × 2 × RGBA8 is 7.2 MB.
   */
  maxVoxels: 900000,
  /**
   * A facade seen from the street spans elevations from the kerb to the
   * parapet; the cosine-weighted mean of that sits near 45°, which is the
   * direction the bounce is treated as arriving from. Used to reweight the
   * field — baked for an up-facing surface — for surfaces facing other ways.
   */
  bounceElevationRad: Math.PI / 4,
  /**
   * There is no vertical-sky fudge factor here, and there was one for about an
   * hour. `skyIrradianceOnPlane` in lib/atmosphere.js integrates the real sky
   * over the real hemisphere for each facade orientation, which costs about
   * twenty thousand inner steps per sky rebuild — a fraction of a millisecond,
   * roughly once a second — and is the difference between a dawn where the two
   * sides of the street are lit by different halves of the sky and a dawn where
   * they are lit by the same average of it.
   */
};

/**
 * The streaming city's constants live in `src/lib/citygen.js`, with the
 * generator that owns them — the same arrangement as `ATM` in lib/atmosphere.js.
 * They are layout and memory decisions rather than physical ones, `src/lib` may
 * not import from here (CONTRACT §2.2), and one source of truth in the file that
 * uses it beats two that agree today.
 */

/** Procedural surface response. Session 2 materials; session 4's weather drives `wet`. */
export const SURFACE = {
  /**
   * Roughness of a damp but not ponded surface. Wet asphalt is not a mirror
   * everywhere — a film of water on a rough aggregate is still rough, it is the
   * standing water in the low spots that mirrors.
   */
  wetFilmRoughness: 0.24,
  /** Roughness inside standing water. Near-specular, but not zero: see below. */
  puddleRoughness: 0.045,
  /**
   * Wet surfaces are darker: water fills the pores, and light that enters is
   * trapped by total internal reflection at the water-air boundary instead of
   * scattering back out. Real wet asphalt retains 50-70% of its dry diffuse
   * reflectance.
   *
   * Session 2 set this at 0.60 and rejected 0.42 for a stated reason: at 0.42
   * "the lamp pools are diffuse, and darkening them by 58% while adding a
   * smooth sheen on top replaced a patterned road with a flat one". That
   * reason no longer holds, and it is worth being explicit about why rather
   * than just moving the number. In session 2 the road's only structure *was*
   * the diffuse pools, so darkening the diffuse erased the structure. It now
   * has two more sources that did not exist then — the batwing optic, which
   * took the pool count from 5 to 8, and screen-space reflection, which puts
   * the windows and signs in the road — and neither is diffuse. Darkening the
   * diffuse now increases the road's structure rather than erasing it, because
   * what it darkens is the part *between* the reflections.
   *
   * 0.50 is the bottom of the measured range rather than below it, which is
   * where 0.42 sat. The shader also applied an undocumented extra factor of
   * 0.85 to the blend, so the value the frame actually saw was 0.66 — outside
   * the range at the other end. That factor is gone; this number now means
   * what it says.
   */
  wetDarkening: 0.5,
  /** Amplitude of the procedural mineral grain on rough dielectrics. */
  grainStrength: 0.2,
  /** Metres. Period of the largest puddle features. */
  puddleScale: 7.0,
  /**
   * How wet a vertical surface gets, relative to a horizontal one.
   *
   * Sessions 2 wet only what faced up: `level = smoothstep(0.55, 0.93, n.y)`,
   * which is right about where water *pools* and wrong about where rain
   * *lands*. Measured on the shipped frames, it meant the top six-tenths of the
   * midnight frame — every facade in the block — was bit-for-bit identical wet
   * and dry, and the only thing that changed when it rained was the road. A
   * wall in the open is visibly darker in the wet and takes a sheen; that is
   * why buildings read almost black in rain photographs.
   *
   * Not 1.0: water runs off a wall and sits on a road, so a wall keeps a film
   * and a road keeps a pond. The two are separated in the shader —
   * `gNoctisWetFilm` is the film and drives darkening and roughness on
   * anything the rain reaches, `gNoctisWetPond` is standing water and is what
   * puddles and screen-space reflection are gated on. A vertical surface gets
   * the first and not the second.
   *
   * Downward-facing surfaces get neither. A canopy soffit stays dry in rain,
   * and it did before this change too.
   */
  verticalFilm: 0.45,
};

/**
 * OPEN WATER — session 15. The river's surface.
 *
 * NOT A SECOND WETNESS MODEL. Everything below `SURFACE` already describes rain
 * on a road: a film, a pond, a darkening and a roughness. The river needs
 * exactly one thing that is not in that list — a surface that is standing water
 * whether or not it is raining — and one thing that is not in this project at
 * all, which is a surface that MOVES. `NOCTIS_WATER` supplies both, and reuses
 * `SURFACE.puddleRoughness` for the still-water finish rather than authoring a
 * second number for the same physical quantity.
 *
 * THE AMPLITUDE IS DERIVED AND THE SPEED IS NOT FREE, WHICH IS THE WHOLE OF THE
 * DESIGN. A wave field tuned by eye has two knobs — how big and how fast — and
 * both of them are already determined by physics that has been measured:
 *
 *  - **How big.** Cox & Munk (1954, *J. Opt. Soc. Am.* 44, 838) fitted the
 *    mean-square SLOPE of a wind-roughened water surface to sun-glitter
 *    photographs and got `σ² = 0.003 + 0.00512·U`, U being the wind at 12.5 m
 *    in m/s, summed over both components. Slope is the right quantity because
 *    slope is what bends a reflection; height is not visible on water at all.
 *  - **How fast.** Deep-water gravity waves obey `ω = √(g·k)`. A wave of a given
 *    length has exactly one speed and nobody gets to choose it. `waterDepth` in
 *    the river is 4.99 m and the longest component is 2.4 m, so `kh` = 13 and
 *    `tanh(kh)` is 1.0000 to four figures: the deep-water form is exact here
 *    rather than an approximation.
 *
 * WIND SPEED 3.0 m/s, and it is a statement about the SITE rather than a knob:
 * a river 105 m wide running between five- to twenty-storey buildings has a
 * fetch of a hundred metres and a canopy over it. 3 m/s is a gentle breeze
 * (Beaufort 2) and gives `σ² = 0.003 + 0.01536 = 0.01836`, i.e. an RMS slope of
 * **0.1355 rad = 7.76°**. `weather.js` owns a wind DIRECTION and no speed; when
 * it grows one, this number is what it replaces, and the reason it is not read
 * from there today is that a constant nobody can vary is honest and a coupling
 * to a value that does not exist is not.
 */
/**
 * Water's own diffuse. Almost all of what a river returns is specular; the body
 * colour is what comes back out of the top few centimetres, and in an urban
 * river that is silt rather than the deep-ocean blue. 0.024 photopic,
 * green-biased.
 *
 * IT LIVED IN `river.js` UNTIL SESSION 42, when the weir's outlet pool became
 * the second water surface in the project and `city.js` may not import a module
 * (CONTRACT §2.2). Two literals in two files is `pierEvery: 34` beside
 * `i % 3 === 0` with a colour, so it is declared once here and both read it.
 */
export const WATER_BODY = [0.019, 0.026, 0.023];

export const WATER = {
  /** m/s at 12.5 m. See above. */
  windSpeed: 3.0,
  /** Cox & Munk's two coefficients, kept apart from the result they produce. */
  coxMunk: { c0: 0.003, c1: 0.00512 },
  /**
   * Metres. Three components spanning a decade of the wind-sea spectrum, in
   * ratios that are not harmonic (2.4 / 1.1 = 2.18, 1.1 / 0.47 = 2.34) so the
   * sum has no period a player can see. Three rather than one because one sine
   * is a corrugation, and rather than eight because each costs a sin and a cos
   * per fragment on a surface that can fill the frame.
   */
  wavelengths: [2.4, 1.1, 0.47],
  /**
   * Degrees off the wind. A wind sea is not unidirectional — the directional
   * spread of a fully developed sea is roughly ±30° about the wind at the peak
   * — and three collinear components make a travelling corrugation rather than
   * a chop.
   */
  spreadDeg: [0, 34, -27],
  /** Bearing the wind blows toward, degrees clockwise from north (CONTRACT §3.1). */
  windBearingDeg: 292,
  /** m/s². Standard gravity, for the dispersion relation. */
  gravity: 9.81,
  /**
   * The still-water finish. `SURFACE.puddleRoughness`, not a new number: this
   * project already decided what standing water's roughness is and why it is
   * not zero, and open water is the same physics at a larger scale.
   */
  baseRoughness: SURFACE.puddleRoughness,
  /**
   * How much of the wave slope survives at a given pixel footprint, and what
   * happens to the rest.
   *
   * A 0.47 m wave seen at 300 m at 5° of grazing covers a fraction of a pixel,
   * and evaluating its slope there is the definition of aliasing — it is also
   * exactly the quantity a roughness is: the statistics of slopes inside one
   * pixel. So each component is faded out as the footprint approaches its own
   * wavelength and the variance it carried is added to the roughness instead.
   * The surface does not get smoother with distance and it does not sparkle;
   * the same energy moves from geometry into the BRDF, which is where it
   * belongs.
   *
   * `fadeLo`/`fadeHi` are multiples of the component's own wavelength: full
   * amplitude below `fadeLo`, gone above `fadeHi`.
   */
  fadeLo: 0.35,
  fadeHi: 1.0,
  /**
   * Where one traced ray stops describing the lobe, expressed as a footprint
   * rather than as a roughness — the same bound §5.8 draws for SSR, one
   * quantity over. Past `cutoffHi · λmax` metres per pixel every component has
   * faded and the surface is a statistical mirror that a single reflected ray
   * cannot represent, so the roughness is taken over `SSR.maxRoughness` and the
   * march switches itself off. At the gate's own field of view and internal
   * resolution one pixel subtends 6.06e-4 rad, so at 5° of grazing this is
   * reached at about 660 m of water — which is past the far bank of a 105 m
   * river by a factor of six and is therefore a bound rather than an
   * optimisation.
   */
  cutoffLo: 0.8,
  cutoffHi: 2.0,
  cutoffRoughness: 0.62,
};

/**
 * The wave components, with every number that was derived from another printed
 * beside it. CONTRACT §9 rule 4 — and the shader cannot log, so this is the
 * object `river.js` prints at init and the source the GLSL is emitted from.
 *
 * `amp·k` is a component's own RMS slope contribution × √2; the three are equal
 * by construction (equal share of the variance), so
 * `Σ (amp·k)²/2 = 3(amp·k)²/2 = σ²` and `amp = σ·√(2/3)/k`.
 */
export function waterWaves() {
  const msSlope = WATER.coxMunk.c0 + WATER.coxMunk.c1 * WATER.windSpeed;
  const rmsSlope = Math.sqrt(msSlope);
  const s = rmsSlope * Math.sqrt(2 / WATER.wavelengths.length);
  const bearing = (WATER.windBearingDeg * Math.PI) / 180;
  const out = WATER.wavelengths.map((lambda, i) => {
    const k = (2 * Math.PI) / lambda;
    const omega = Math.sqrt(WATER.gravity * k);
    const a = (bearing + (WATER.spreadDeg[i] * Math.PI) / 180);
    // CONTRACT §3.1: azimuth clockwise from north, so a bearing maps to
    // (sin a, −cos a) in the xz plane.
    return {
      lambda,
      k,
      omega,
      /** Phase speed, m/s. ω/k, printed because it is the number a person can check against the frame. */
      c: omega / k,
      periodS: (2 * Math.PI) / omega,
      amp: s / k,
      dir: [Math.sin(a), -Math.cos(a)],
      /** This component's own slope amplitude, `amp·k`. Equal for all three by construction. */
      slope: s,
    };
  });
  const hSig = 4 * Math.sqrt(out.reduce((acc, w) => acc + (w.amp * w.amp) / 2, 0));
  return { msSlope, rmsSlope, rmsSlopeDeg: (rmsSlope * 180) / Math.PI, perComponentSlope: s, waves: out, significantHeightM: hSig };
}

/**
 * The luminaire distribution — session 3.
 *
 * `THREE.SpotLight`'s cone is circular, and a circular cone cannot express what
 * a street lantern does. A real cutoff optic throws an *elongated* pattern:
 * two and a half to three mounting heights along the carriageway, barely more
 * than one across it. That asymmetry is the whole reason a lit street reads as
 * a row of overlapping ellipses rather than as one wash — and with a circular
 * cone the pool from a lamp on one kerb reaches past the centreline and merges
 * with the pool from the lamp opposite, which is exactly why session 2 measured
 * five distinct bright regions where the gate asks for six.
 *
 * Modelled as an *anisotropic scaling of the direction cosines* rather than as
 * a sampled IES file: decompose the fragment-to-light direction into the beam
 * axis and the two transverse axes, scale the transverse parts, renormalise,
 * and hand the result to the same cone attenuation three already uses. One
 * cheap analytic function, no table to load or stream, and the circular case
 * falls out at scale 1 — so a light that does not declare an axis behaves
 * exactly as it did before.
 *
 * The two numbers are effective half-angles, converted here so the constants
 * are the thing an engineer would actually specify:
 *
 *   scale = tan(coneOuter) / tan(effective half-angle in that plane)
 *
 * At the shipped 54° cone from 8.06 m that gives a pool 36 m long by 13 m wide,
 * against 22 m circular. The lamps are staggered at an effective 15 m, so
 * consecutive pools overlap along the road (which is what a lit street looks
 * like) and stop short of each other across it (which is what makes the two
 * kerbs read as two rows instead of one carpet).
 *
 * Peak candela is unchanged: an IES distribution is intensity per direction,
 * and the peak is on the axis either way. Total flux falls about 7% because the
 * solid angle inside the ellipse is slightly smaller than inside the circle.
 */
export const LUMINAIRE = {
  /**
   * Cutoff half-angle along the carriageway, radians. 2.48 mounting heights —
   * a Type II semi-cutoff lantern, which is what a 15 m street with staggered
   * poles both sides is lit with.
   *
   * Chosen from a measured 1-D sweep rather than from the first value that
   * passed: at 63° the roadway gate finds 5 distinct pools, at 65 to 70 it
   * finds 6 or 7, and at 71 it collapses to 4 as consecutive pools merge into a
   * continuous ribbon. 68 sits in the middle of that plateau, five degrees from
   * the failure below and three from the one above. A number one degree from a
   * cliff is a number that passes on this machine.
   */
  alongRoadRad: (68.0 * Math.PI) / 180,
  /** Cutoff half-angle across it, radians. 1.04 mounting heights. */
  acrossRoadRad: (46.0 * Math.PI) / 180,
  /**
   * THE PART THAT MATTERS MOST, AND THE PART SESSION 2 DID NOT HAVE.
   *
   * A street luminaire's peak intensity is not at nadir. It is thrown out at
   * 50–70° from vertical, and the reason is arithmetic: illuminance on a flat
   * road from a source at height h is I(γ)·cos³γ/h², so an optic with constant
   * intensity puts eight times as much light under the pole as it does one
   * mounting height away. To light a *road* rather than a spot you need
   * I(γ) ∝ 1/cos³γ, and every cutoff optic ever made is an approximation of
   * exactly that, rolled off at a cutoff angle so the light does not go into
   * bedroom windows.
   *
   * So the distribution here is: 1/cos³ from nadir up to `peakAngleRad`, where
   * it reaches `LIGHT.streetlampCandela`; flat at the peak from there to the
   * cutoff; then a short roll-off to nothing. Inside the peak angle the
   * illuminance on the road is *exactly constant* — that is what the 1/cos³
   * buys — and outside it, it falls as cos³γ to the cutoff and then stops.
   *
   * Session 2 modelled the optic as a cone with its maximum on the axis,
   * pointed nearly straight down. That is a floodlight aimed at a pavement:
   * measured on the shipped frame, the brightest points on the ground were
   * directly under the lamp heads, on the kerb, and the middle of the
   * carriageway — the thing a street light exists to illuminate — sat at
   * roughly a fifth of that and never rose above the pool gate's threshold.
   * Narrowing the cone across the road made that worse, not better, which is
   * how the missing term announced itself.
   */
  peakAngleRad: (57.0 * Math.PI) / 180,
  /** Width of the roll-off at the cutoff, radians. A semi-cutoff optic, not a hard edge. */
  edgeRad: (7.0 * Math.PI) / 180,
};

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE LAMP BOWL — ONE FIXTURE, ONE DERIVATION, AND THE TWO DELIVERED VALUES
 * WRITTEN AS WHAT THEY ARE: DECLARED DEPARTURES FROM IT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * SESSION 28. What this replaces is CONTRACT §9's own class, and it had been
 * standing for ten sessions: ONE QUANTITY WITH TWO VALUES IN TWO FILES AND
 * NOTHING COMPARING THEM.
 *
 *     src/modules/block.js  EMISSIVE.lampBowl      210     the origin block
 *     src/core/constants.js LIGHT.streetlampNits   9000    the streamed city
 *     derived, and in neither file                 1952.2
 *
 * 9000 / 210 = **42.86×**, 5.42 stops, for the same frosted bowl on the same
 * column carrying the same 6800 cd lantern. Neither number was Φ/(πA); one was
 * an intensity over a projection (§9 row 18) and the other was authored into a
 * table whose own comment says "these are authored, not measured".
 *
 * ── WHAT IS NOW SINGLE-SOURCE, BY CONSTRUCTION RATHER THAN BY A CHECK ──────
 *
 * The bowl's geometry lives HERE and both emitters build from it, so the area
 * in the derivation and the area on the screen cannot diverge. The derivation
 * reads `LIGHT.streetlampCandela` and `LUMINAIRE`, so a change to the lantern
 * moves both delivered radiances with it. Before this, changing the candela
 * left two stale radiances behind and the bowl stopped being the same lamp as
 * its own beam — silently, in two files, in opposite directions.
 *
 * ── WHAT IS CHECKED, BECAUSE CONSTRUCTION CANNOT REACH IT ─────────────────
 *
 * `tools/city-budget.json` → `lampBowl` carries a RATCHET on how far each path
 * may sit from the derivation, and `citycheck` runs it over the DELIVERED
 * materials off the live scene (§9.1: a gate that reads config verifies the
 * config). The bounds sit at today's measured departures and MAY ONLY EVER
 * MOVE TOWARD 1.0 — the same shape as `floors.visibleInstances` and
 * `saturation.minBrightFraction`, with an error instead of a count.
 *
 * ── WHY BOTH VALUES ARE STILL WRONG, WITH THE ARITHMETIC THAT SAYS SO ─────
 *
 * Session 28 measured the correction from both ends at once. It cannot ship on
 * either path today, and the two failures are in OPPOSITE directions:
 *
 *   arm                            look band:midnight   citycheck bright reserve
 *   ---------------------------------------------------------------------------
 *   shipped (210 / 9000)              0.1091  ✓            4.95%  ✗ (floor 6.00)
 *   origin block  210 → 1952          0.1187  ✗ RED        —
 *   streamed city 9000 → 1952         0.1090               3.56%  ✗
 *
 * ATTRIBUTION FIRST, because it is the fact the two arms turn on. Zeroing each
 * path in turn: the origin block's bowls carry **0.0030** of the look frame's
 * 0.1091 mean and **0.06** points of the reserve; the streamed city's carry
 * **0.0000** of the look frame — to four decimals, nothing — and **0.96**
 * points of the reserve. The look gate watches one path and the night route
 * watches the other, 16:1, and neither can see what the other is measuring.
 *
 *   - ON THE STREAMED CITY THE CORRECTION IS A DIMMING. 9000 → 1952 is ÷4.61,
 *     and it costs **1.39 points** of bright reserve against a floor the city
 *     already misses by 1.05. The only path the reserve can see is the one
 *     where the correct value subtracts light.
 *   - ON THE ORIGIN BLOCK IT IS A BRIGHTENING OF 9.30×, worth **+0.0096** of
 *     midnight mean against **0.0021** of band ceiling — red by 0.0067, i.e.
 *     4.6× the room that exists.
 *
 * SO THE BLOCK SIDE IS BLOCKED ON A NUMBER STATE 27 §8.3 ITEM 1 ALREADY NAMED
 * AS THIS PROJECT'S FIRST OPEN QUESTION: `band:midnight`'s ceiling was
 * re-centred on session 2's content and has not been re-derived in 25
 * sessions. The lamp correction needs 0.0067 of ceiling that does not exist.
 * Those are one question, and this comment is where they meet.
 *
 * Session 18 wrote "it cannot ship on its own — the mid-tone it removes has to
 * come back as light before it goes in". That is still the answer. What is new
 * is that the sentence now has a number on both ends, and that the two ends
 * disagree about which direction "more light" even points.
 */
const BOWL_RADIUS_M = 0.42;
const BOWL_THETA_START = Math.PI * 0.35;
const BOWL_THETA_LENGTH = Math.PI * 0.65;
/** Φ/(π·A) = 1952.2 cd/m². The one number both delivered values are a factor of. */
const BOWL_DERIVED_NITS = bowlRadianceNits(
  LIGHT.streetlampCandela, LUMINAIRE, BOWL_RADIUS_M, BOWL_THETA_START, BOWL_THETA_LENGTH
);
/**
 * THE TWO FACTORS ARE MEASURED DEPARTURES, NOT AUTHORED SETTINGS, so they are
 * quoted at the precision that reproduces what shipped rather than rounded to
 * something that reads well:
 *
 *     9000 / 1952.1892 = 4.61020889     ->  4.610209 x 1952.1892 = 9000.00000
 *      210 / 1952.1892 = 0.10757154     ->  0.1075715 x 1952.1892 = 209.99999
 *
 * So this refactor delivers the same two radiances the branch already shipped,
 * to five decimal places, and every gate reading is therefore attributable to
 * the CONTENT changes that follow rather than to the single-sourcing.
 */
const BOWL_STREAMED_FACTOR = 4.610209;
/**
 * SESSION 30: 0.1075715 -> 0.2151430, i.e. 210.0 -> 420.0 cd/m2, AND THE
 * RATCHET MOVES IN WITH IT.
 *
 * Session 28 built this as a one-way ratchet on an ERROR — the two departures
 * from the derived 1952.19 that could not be repaired then — and said in
 * `city-budget.json` that *"a session that repairs one moves its bound in and
 * cannot move it back."* This is the first session that repairs one, and it
 * repairs half of it: the origin block's departure goes from **9.30x too dim
 * to 4.65x too dim**, and `lampBowl.minRatio` goes 0.1075 -> 0.2151.
 *
 * WHY 2x AND NOT THE DERIVATION, AND THE NUMBER IS MEASURED RATHER THAN
 * CHOSEN. `band:midnight` has a ceiling of 0.112 and the look gate's camera
 * stands in this block, so the block's own emitters are the only thing that
 * spends it. Swept on this session's head, three runs at the shipped value and
 * one per arm:
 *
 *     originNits      0     210      420      630      840     1952
 *     band:midnight  --   0.1098   0.1112   0.1125   (0.1127 pre-3b)  0.1187 (s28)
 *     verdict              ships    SHIPS    RED       RED             RED
 *
 * 420 leaves **0.0008** of headroom against a run-to-run spread of **0.0001**,
 * which is eight times the instrument's own resolution and is therefore a
 * margin CONTRACT §0.1 permits a decision on. 630 is red by 0.0005. The
 * crossing is at about **550**, so what is deliberately not taken is
 * (550 − 420) / 550 = **24% of the range that exists**, or 31% of the step up
 * from the shipped value — and it is not taken because shipping at the
 * crossing leaves a margin smaller than the spread, which is the thing §0.1
 * forbids.
 *
 * NO THRESHOLD MOVED IN THE FORBIDDEN DIRECTION. `look-budget.json` is
 * byte-identical; `band:midnight` is [0.072, 0.112] before and after. The one
 * number that moves in a budget file is `lampBowl.minRatio`, and it moves
 * TOWARD 1.0, which is the only direction its own definition allows and is a
 * tightening: a future session that puts this bowl back at 210 now FAILS
 * `citycheck`.
 */
const BOWL_ORIGIN_FACTOR = 0.2151430;

export const LAMP_BOWL = {
  /**
   * The geometry BOTH emitters build. The tessellation is each emitter's own
   * business (the origin block draws 12×8, the streamed city 8×6, because one
   * is sixteen bowls at 30 m and the other is 790 at up to a kilometre); the
   * SHAPE is not, because the shape is what the radiance is divided by.
   *
   * THETA, NOT PHI, AND THE NAMES ARE THREE'S OWN. `SphereGeometry(R, wSeg,
   * hSeg, phiStart, phiLength, thetaStart, thetaLength)` sweeps PHI around the
   * equator and THETA pole to pole. This bowl is a THETA zone from 63° to 180°
   * over a FULL phi revolution. Session 28 first wrote these as `phiStart` and
   * `phiLength`, built the geometry correctly anyway (the values went into the
   * theta slots), and then had the delivered census read three's `phiStart` —
   * 0 and 2π — and compare it with 0.35π and 0.65π. The gate caught it on its
   * first real run. CONTRACT §9 rule 7, one letter wide.
   */
  radiusM: BOWL_RADIUS_M,
  thetaStart: BOWL_THETA_START,
  thetaLength: BOWL_THETA_LENGTH,
  /**
   * The azimuthal sweep, and it is here because `bowlZoneAreaM2` ASSUMES it.
   * A bowl swept over less than a full revolution has a proportionally smaller
   * emitting area and the derivation would be silently wrong by that factor,
   * which is the same defect one axis over. `citycheck` checks the delivered
   * geometry against it.
   */
  phiStart: 0,
  phiLength: Math.PI * 2,

  /**
   * m², the EMITTING area of that zone — 2πR²(cos φ0 − cos φ1) = 1.6115.
   *
   * It is the denominator of the derivation and it was also a bare `1.6115`
   * literal in `city.js`'s own boot log, written out by hand from a comment in
   * this file. Two copies of an area, one of which would not have moved if the
   * bowl had. §9 rule 2: derived once, read everywhere.
   */
  areaM2: bowlZoneAreaM2(BOWL_RADIUS_M, BOWL_THETA_START, BOWL_THETA_LENGTH),

  /**
   * cd/m². Φ/(π·A) for the fixture above — 9883.5 lm over 1.6115 m². Computed
   * at load from `luminaire.js`, never authored: §9 rule 4 wants both numbers
   * printed at the moment of derivation, and `city.js` prints this one beside
   * each delivered value at init.
   */
  derivedNits: BOWL_DERIVED_NITS,

  /**
   * THE STREAMED CITY'S 790 BOWLS. 4.610× the derivation.
   *
   * This is `LIGHT.streetlampCandela / (π·0.42²)` = 12 270 rounded down to
   * 9000 — an intensity over a projected area, used as a radiance. §9 row 18.
   * It is load-bearing as LIGHTING while it is wrong as a RADIANCE: it carries
   * 0.96 of the 4.95 points of bright reserve this city delivers, and the
   * corrected value costs 1.39 of them.
   */
  streamedFactor: BOWL_STREAMED_FACTOR,
  /** cd/m² AS DELIVERED to the streamed city's bowl material. 9000.0. */
  streamedNits: BOWL_DERIVED_NITS * BOWL_STREAMED_FACTOR,

  /**
   * THE ORIGIN BLOCK'S 16 BOWLS. **0.2151× the derivation, i.e. 4.65× too dim**
   * since session 30, and 0.1076× / 9.30× before it — see `BOWL_ORIGIN_FACTOR`
   * above for the sweep that moved it and for why the remaining **24%** of the
   * available range was not taken. (550 - 420) / 550 = 23.64%; the 30% this
   * line carried is the figure from before the bowl moved, and the corrected
   * value has been 77 lines above it since session 30.)
   *
   * ITS HISTORY, IN THE PAST TENSE, BECAUSE SESSION 31 FOUND THIS PARAGRAPH
   * STILL WRITTEN IN THE PRESENT FIVE LINES BELOW ITS OWN 210 -> 420
   * CORRECTION. The value **was** 210 and is 420; it **was** authored in
   * `block.js`'s EMISSIVE table and has not lived there since session 2 — see
   * `block.js`'s own note, which says so. So it was never a wrong derivation,
   * it was an absent one (§9 rule 5: a number without a derivation is a
   * guess), and session 30 gave it one. The claim that it "is the value the
   * look gate's `band:midnight` was last balanced against" was true of 210 and
   * is not true of 420: session 30 measured 420 at `band:midnight` 0.1112 and
   * shipped it, and session 31 measured 0.0745 with the station standing in
   * the same frame. Nothing here is what that assertion is balanced against
   * any more, and §8 of STATE 31 is where that balance now lives.
   */
  originFactor: BOWL_ORIGIN_FACTOR,
  /** cd/m² AS DELIVERED to the origin block's bowl material. 420.0 — session 30. */
  originNits: BOWL_DERIVED_NITS * BOWL_ORIGIN_FACTOR,
};

/**
 * Screen-space reflection — session 3, and only for water.
 *
 * Session 1 rejected screen-space for the noon road and the reasoning was
 * right and specific: the occlusion that road was missing comes from facades
 * *above the top edge of the frame*, which no screen-space pass can sample.
 * At night, reflected in a wet road, the case inverts. The lit windows, the
 * shopfronts and the signs are all in frame — they are the brightest things in
 * it — and nothing else in the project can supply them: an environment map has
 * no windows, and a punctual light has no extent.
 *
 * Everything here is a hard bound. An unbounded screen-space pass is the same
 * class of mistake as an unbounded particle layer: it costs whatever the scene
 * happens to be, which is a number nobody can budget.
 *
 *   steps · refine    fixed, compile-time. 24 marching + 5 bisection.
 *   maxDistance       a ray that has travelled this far has left the block.
 *   maxRoughness      above it the prefiltered environment is already the
 *                     right answer and the march is switched off entirely, so
 *                     a dry road at 0.7 never enters the loop.
 *
 * Degradation is graceful by construction: when the ray leaves the screen,
 * runs out of steps or hits nothing, the weight is zero and the existing
 * canyon-wall-versus-sky term (§5.7) is what remains. SSR only ever *replaces*
 * a fallback that is already there.
 */
export const SSR = {
  steps: 24,
  refineSteps: 5,
  /**
   * Metres. Tried at 220 with the same step count, on the theory that a
   * grazing reflection down a street needs to travel further before it meets
   * anything, and MEASURED WORSE: the midnight wet-versus-dry difference fell
   * from 0.00159 to 0.00130. The extra reach buys hits on the far end of the
   * street, which at night is dimmer than the fallback it replaced, and pays
   * for them with coarser steps everywhere nearer. Left at 110.
   */
  maxDistance: 110,
  /**
   * Metres, and steps, FOR OPEN WATER ONLY. Session 15.
   *
   * THE ROAD'S 110 m IS NOT A PROPERTY OF THE MARCH, IT IS A PROPERTY OF THE
   * ROAD. A wet carriageway is 15 m wide and its reflections are the shopfronts
   * on the other side of it — every one of them inside 40 m. A river is 104.6 m
   * wide and its reflections are the far bank's skyline, and the arithmetic for
   * how far the ray has to travel is not close:
   *
   *   eye 1.74 m on a promenade 4.99 m above the water            e = 6.73 m
   *   the far bank's facade, one block back, at the mean height   H = 30.99 m
   *     (`city.meanFacadeHeight` 26 m + the 4.99 m of quay)
   *   horizontal distance from the eye to it                      D = 245 m
   *   the mirror point is at D·e/(e+H)                              43.7 m
   *   so the ray runs sqrt((D−43.7)² + H²)                          203.7 m
   *
   * against a reach of 110. The reflection of the skyline was therefore OUT OF
   * RANGE at every station of the river, and the delivered night frame showed
   * a hundred metres of black water under a lit city. Measured before the
   * number moved: with the march at 110 the water's reflection weight is zero
   * over the whole band the reflection would occupy.
   *
   * 210 m rounds 203.7 up. The road's number does NOT move: CONTRACT §5.8
   * records that 220 was tried for the road and measured WORSE — the extra
   * reach buys hits on the far end of the street, which at night is dimmer than
   * the fallback it replaced, and pays for them with coarser steps everywhere
   * nearer. That argument is about a road and it is still right about a road.
   *
   * 30 STEPS, AND THE NUMBER IS CHOSEN TO KEEP THE FIRST STEP THE SAME LENGTH.
   * The ladder is geometric, so it spans `s0·(g^N − 1)/(g − 1)`; the road's
   * first step is `110 / ((1.13²⁴ − 1)/0.13)` = 110 / 136.8 = **0.804 m**, and
   * 30 steps at 210 m gives `210 / ((1.13³⁰ − 1)/0.13)` = 210 / 293.3 =
   * **0.716 m**. So the water's near field is resolved at least as finely as
   * the road's and the six extra steps are what buys 1.9× the reach — which is
   * the trade §5.8 says 220-at-24-steps got wrong.
   */
  waterMaxDistance: 210,
  waterSteps: 30,
  /**
   * Metres of ray before the first sample. The reflected ray leaves the road
   * going up, so it separates from the surface immediately, but a first sample
   * at t = 0 is on the surface itself and reads as a hit at grazing angles.
   */
  startOffset: 0.45,
  /**
   * Geometric step growth. The reflection of a facade fifty metres away needs
   * coarse steps out there and fine ones near the camera, and a uniform ladder
   * spends 24 samples on the first ten metres.
   */
  stepGrowth: 1.13,
  /**
   * How far behind the depth buffer a sample may be and still count as a hit,
   * as a multiple of the current step length. Without an upper bound every ray
   * that passes behind anything reports a hit on it.
   */
  thicknessScale: 1.6,
  /** Metres. Floor under the above, for the short first steps. */
  minThickness: 0.8,
  /**
   * Metres. Ceiling on it, for the long last ones. The step length grows to
   * tens of metres at the far end of the ladder, and a thickness that grew
   * with it would call anything behind anything a hit.
   */
  maxThickness: 10,
  /**
   * Roughness at which the reflection is fully handed back to the prefiltered
   * environment, with the fade beginning at 55% of it.
   *
   * The bound is where one traced ray plus a mip stops describing the lobe.
   * GGX alpha is roughness squared, so the lobe half-angle goes as roughly
   * alpha: 0.045 (standing water) is 0.1°, 0.24 (the damp film) is 3.3°, 0.5
   * is 14°, and dry asphalt at 0.7 is 26°. A single ray is a good model at
   * three degrees and a bad one at twenty-six.
   *
   * Session 3 first set this at 0.34 by eye, which put the fade's midpoint at
   * 0.19 — below the film's own roughness — so the damp two-thirds of the road
   * got almost no reflection and only the puddles did. The measured
   * consequence was a wet midnight frame whose difference from the dry one was
   * confined to the puddle noise. 0.5 is where the physics puts the boundary,
   * and the wet road that results is a wet road rather than a dry road with
   * mirrors scattered on it.
   */
  maxRoughness: 0.5,
  /** Mip levels of blur per unit roughness at the hit. 0.24 → about 2 mips. */
  blurPerRoughness: 9.0,
  /** Fraction of the source buffer's width/height over which the hit fades out at the edge. */
  edgeFade: 0.12,
  /**
   * Resolution of the colour-plus-depth buffer the march reads, as a fraction
   * of the drawing buffer. Half means a quarter of the memory and a quarter of
   * the fetch bandwidth, and the reflection of a 1.5 m window across thirty
   * metres of road is not a sharp image in the first place.
   */
  sourceScale: 0.5,
  /**
   * Metres. What the sky writes into the depth channel. Nothing in the block is
   * within four orders of magnitude of it, so a ray can never hit the sky.
   */
  skyDepth: 20000,
};

/**
 * Clustered forward+ grid. CONTRACT §5.6.
 *
 * `maxPerCluster` LIVES HERE, NEXT TO `maxLights`, BECAUSE THE TWO WERE
 * CONFUSED FOR EACH OTHER. Until this session the per-froxel cap was a module
 * -local `const MAX_PER_CLUSTER = 48` in `lights.js` and `maxLights: 256` was
 * the only number in this file, so every conversation about "the light cap"
 * was about 256 — which is not the cap that binds. A light in the pool costs
 * five texels; a light in a froxel costs a fragment-shader iteration for every
 * pixel of that froxel, and the shader loop is bounded by `maxPerCluster`.
 * 256 is the size of the car park, 48 was the size of the lift. They are
 * adjacent now so that a change to one is a change nobody can miss — the same
 * reason `FACE_AXIS` sits beside its two copies in `lights.js`.
 */
export const CLUSTER = {
  tilesX: 16,
  tilesY: 9,
  slicesZ: 24,
  /** Exponential depth slicing needs a near that is not zero. */
  near: 0.5,
  far: 320,
  /**
   * Size of the light pool — how many lights may be resident in the data
   * texture at once, in view. NOT the number a fragment evaluates.
   *
   * 256 → 384 this session, to make room for traffic. The pool has to hold the
   * static lights plus whatever moves through the frustum: measured, the block
   * contributes 52 and the streamed lamp pool 196, which is 248 before a single
   * vehicle exists. 248 + 96 traffic slots = 344, and 384 leaves 40 spare
   * rather than 8 — a pool that is exactly full is a pool that drops a light
   * the first time a lamp comes round a corner.
   *
   * The cost is the data texture, and it is small enough that it was never the
   * constraint: 384 lights × 5 texels × RGBA float32 = 30 720 B = 30.7 kB,
   * against 256 × 5 × 16 = 20 480 B = 20.5 kB. Both numbers printed, per
   * CONTRACT §9 rule 4 — the second is derived from the first by 384/256.
   */
  maxLights: 384,
  /**
   * Slots held back for traffic, and the reason `maxLights` going up is not
   * the same thing as room for traffic.
   *
   * `city.js` sized its streetlamp pool as `floor((maxLights − blockLights − 8) / 2)`
   * — the WHOLE remainder. So raising the cap from 256 to 384 to make room for
   * headlights would have spent all 128 new slots on more streetlamps and left
   * traffic exactly where it started, with the frames changed and nothing
   * gained. A spare budget used as though it were a reservation: CONTRACT §9,
   * one quantity standing in for another, caught by writing the arithmetic out
   * before believing it.
   *
   * 96 = 48 vehicles × 2 headlights. See `tools/budget.json` →
   * `trafficLights.$derivation` for where 48 comes from.
   */
  trafficLightReserve: 96,
  /**
   * The cap the lamp pool was sized against before `maxLights` moved. 256.
   *
   * It exists only to hold the lamp count still, and it is a CAP rather than
   * the resulting count of 98 on purpose. Writing `lampPoolMax: 98` would have
   * frozen a result: `city.js` derives the pool from `maxLights` minus the
   * block's own lights, and the block's own lights are measured at runtime, so
   * a literal 98 would silently stop matching the old formula the first time
   * anybody added a streetlight to `block.js`. Keeping the input rather than
   * the output makes "this change altered no content" an invariant instead of a
   * coincidence — and §9 rule 5, added this session, is exactly the rule that
   * caught it: 98 had a derivation in a comment and no derivation in the code.
   *
   * Delivered today: (256 − 52 − 8) / 2 = 98 lamps = 196 lights. Reservation
   * 52 block + 196 lamp + 96 traffic = 344 of 384, margin 40. All printed at
   * boot.
   */
  lampPoolLegacyCap: 256,
  /**
   * THE BINDING LIMIT. How many lights one froxel may hold, and therefore the
   * length of the loop every lit fragment runs.
   *
   * 48 → 96 this session. The derivation is in `tools/budget.json` under
   * `trafficLights.$derivation`, and the condition on shipping it was measured
   * rather than argued: 96 does not ship until `clusterOverflow` is false on
   * all three routes with the pool saturated by 96 placeholder headlights at
   * the cone bound below. See STATE.md for the measured worst-cluster
   * occupancy and the margin.
   *
   * This is a `#define` in every patched material (`NOCTIS_MAX_CLUSTER_LIGHTS`),
   * so it is a compile-time loop bound and not a runtime one. A step count that
   * could change at runtime is a step count nobody can budget — the same rule
   * §5.8 applies to the SSR march.
   */
  maxPerCluster: 96,
  /**
   * Half-angle, radians, at or above which a spot light is bounded by a sphere
   * centred on the light rather than by the sphere that circumscribes its cone.
   *
   * The circumscribing sphere of a spherical sector of range R and half-angle θ
   * has radius R/(2·cos θ), centred R/(2·cos θ) along the axis. Its volume is
   * 1/(8·cos³θ) of the light's own radius sphere, so the bound is a win for
   * every θ below 60° and a loss above it — at exactly 60°, R/(2·cos 60°) = R
   * and the two coincide. π/3 is that crossover, and it is geometry rather than
   * a tuned number.
   */
  coneBoundMaxHalfAngle: Math.PI / 3,
  /** Worst case indices; overflow drops the furthest lights and warns once. */
  maxIndices: 131072,
};

/**
 * The first-person controller. CONTRACT §11, session 17.
 *
 * Every number here is a length, a speed, an angle or a ratio with a derivation
 * beside it, per CONTRACT §9 rule 5. Two of them — the stick dead zone and the
 * look curve's exponent — are the ones session 17 was explicitly asked to
 * justify rather than to choose, and both are bounded from BOTH sides below.
 */
export const PLAYER = {
  /**
   * Metres. Eye height above whatever the feet are standing on.
   *
   * 1.74 is the figure this project has stood at since session 1: the `street`
   * shot, `downtown_dense`, `night_rain`, every `-street` preset in
   * `lookat.mjs`, and STATE 16 §4.2's sightline arithmetic across the river.
   * Using anything else would make a player's view of the city a different view
   * from the one every frame in the project was judged at.
   *
   * SAID PLAINLY BECAUSE THE BRIEF SAID OTHERWISE: it is NOT the pedestrians'
   * figure height. `streetlife.js` → `BODY_REF_HEIGHT` is 1.72 m and each
   * instance is drawn from N(1.72, sd) — a reference BODY, whose eyes would sit
   * near 1.60 m. So the player's eye is 0.14 m above the median pedestrian's,
   * and a frame at 1.74 looks very slightly down on the crowd. Both numbers are
   * defensible and they are not the same number; this one is kept because the
   * whole project's look is calibrated on it.
   */
  eyeHeightM: 1.74,

  /**
   * m/s. The player's WALKING TRAVERSAL RATE — session 18, and it is a
   * DIFFERENT QUANTITY from `GAIT.walkSpeedMps`, which is why it is allowed to
   * be a different number.
   *
   * READ THIS BEFORE CALLING IT THE SPLIT-CONSTANT DEFECT, because it looks
   * exactly like one and is not. `GAIT.walkSpeedMps` = 1.40 m/s is an input to
   * a BIOMECHANICAL MODEL: `gait.js` derives `stepM` = 0.75 m from it, the
   * cycle frequency 0.93 Hz from that, and the vertical bob from the cycle. A
   * figure drawn at a speed its step length was not derived for slides its feet.
   * This number is a CAMERA TRAVERSAL RATE with no gait attached — the player
   * has no legs and nothing is derived from it. Session 17 made the player read
   * `GAIT.walkSpeedMps` directly, which coupled the two, and the coupling is
   * why "make the player faster" reads as "make the crowd faster" and could not
   * be done. They are separated here, and the RELATIONSHIP is printed at the
   * point of use (`player.js` init) so the two can never drift silently.
   *
   * 2.00 m/s, BOUNDED FROM BOTH SIDES:
   *
   * FROM ABOVE by `RUN_TRANSITION_MPS` = 2.048 m/s — Froude 0.5 on the gait
   * model's own 0.855 m hip. Above that a gait is a RUN, so 2.048 is the
   * fastest a thing called "walk" may go without the word being wrong. 2.00 is
   * 0.976× of it, i.e. the fastest walk this project's own physics allows.
   *
   * FROM BELOW by the observation that started this: 1.40 m/s felt wrong to the
   * one person who has walked the city. Session 18 measured why, and MOST OF IT
   * WAS NOT THE SPEED — see `fovDeg` below, where 50° → 75° doubles the optic
   * flow at the bottom of the frame on its own. The two are recorded separately
   * because they were measured separately.
   *
   * SESSION 19: 2.00 → 3.50, AND THE BOUND THAT USED TO HOLD IT IS NOW
   * DELIBERATELY BROKEN. Read the next four paragraphs before restoring it.
   *
   * THE CITY'S OWN SCALE IS THE ARGUMENT, AND IT IS ARITHMETIC RATHER THAN
   * FEEL. `citygen.js` → `CITY.chunkSize` is 128 m and the bridges are
   * `RIVER.bridgeEvery · chunkSize` = 4 · 128 = **512 m** apart. So:
   *
   *     traversal            2.00 m/s     3.50 m/s     7.00 m/s
   *     one chunk   128 m      64.0 s       36.6 s       18.3 s
   *     bridge to bridge 512 m 256.0 s      146.3 s      73.1 s
   *                          = 4 min 16 s = 2 min 26 s = 1 min 13 s
   *
   * Four and a quarter minutes to reach the next river crossing is not a pace,
   * it is a commute, and the operator has now walked it twice. The city was
   * dimensioned by its street grid (a 128 m block is an ordinary city block)
   * and never by how long a person would spend inside one.
   *
   * IT IS NO LONGER A WALK BY THIS PROJECT'S OWN BIOMECHANICS, AND THAT IS THE
   * COST, STATED. `RUN_TRANSITION_MPS` = 2.048 m/s is Froude 0.5 on the gait
   * model's 0.855 m hip, i.e. the speed above which a human gait IS a run.
   * 3.50 m/s is **1.71×** that. Session 18 used 2.048 as an upper bound on this
   * constant and 2.00 sat at 0.976× of it; that bound has been removed rather
   * than quietly exceeded, and the removal is licensed by exactly one fact:
   * **nothing is derived from this number.** `GAIT.walkSpeedMps` is an input to
   * a model — `stepM`, the cycle frequency and the bob all come out of it, and a
   * figure drawn at a speed its step length was not derived for slides its feet.
   * The player has no legs. This is a CAMERA TRAVERSAL RATE, and Froude 0.5 is a
   * statement about legs.
   *
   * SO IT IS A DELIBERATE EXAGGERATION, RECORDED AS ONE — the same shape as the
   * fleet's plan taper, which is steeper than any real bodyside for a reason
   * written down beside it. A traversal rate chosen for the size of the world is
   * not a measurement of a person, and the two must not be confused: the crowd
   * still walks at `GAIT.walkSpeedMps` = 1.40 m/s and nothing here touches it.
   *
   * THE COST, NAMED RATHER THAN HIDDEN: 3.50 / 1.40 = **2.50× the crowd's mean**
   * and 1.84× its fastest walker at 1.90 m/s. The player now overtakes the crowd
   * visibly rather than slowly. That is a genuine loss — session 18's reason for
   * 2.00 was that a slow overtake keeps the pedestrians reading as people — and
   * it is spent knowingly, because a city you cannot cross is worse than a crowd
   * you pass. The 2.50× is still inside the brief's own 3× ceiling for a RUN,
   * and three of this project's four route cameras have always exceeded it
   * (`downtown_dense` at 4.5 m/s is 3.21×).
   *
   * AND THE FIELD IS STILL WORTH MORE THAN THE SPEED. At `fovDeg` 75 the optic
   * flow at the bottom edge is 2.07× what it was at 50 (see below), so the
   * delivered apparent pace against session 17's 1.40 m/s at fov 50 is
   * 2.07 × 2.50 = **5.18×**. The two are multiplied, not chosen between, and
   * they are still recorded separately because they were measured separately.
   */
  walkSpeedMps: 3.5,

  /**
   * m/s. Running, and it is derived from two bounds that nearly meet.
   *
   * FROM BELOW: anything at or under `RUN_TRANSITION_MPS` = 2.048 m/s (Froude
   * 0.5 at the model's own 0.855 m hip) is a walk, and `streetlife.js` already
   * draws walkers up to 1.90 m/s. A "run" under 2.05 m/s would be a word for
   * something the crowd is already doing.
   *
   * SESSION 19: 3.50 → 7.00, because `walkSpeedMps` took the 3.50 and a run
   * that equals the walk is not a run.
   *
   * THE RATIO IS THE QUANTITY, NOT THE SPEED. 7.00 / 3.50 = **2.00×**, and a
   * factor of two is what a run has to be worth to be worth a key: session 18's
   * pair was 3.50/2.00 = 1.75× and the difference was reported as marginal. It
   * is also the ratio between a human's comfortable walk (1.4 m/s) and their
   * comfortable jog (2.8 m/s), which is the one place a real number survives
   * this constant's exaggeration.
   *
   * WHAT IT DELIVERS AGAINST THE WORLD: 512 m bridge to bridge in **73 s**, a
   * 128 m chunk in **18.3 s**. 7.00 m/s is 25.2 km/h, which is a bicycle and is
   * not a person — see `walkSpeedMps` for why that sentence is acceptable here
   * and would not be in `gait.js`.
   *
   * BOUNDED ABOVE BY THE COLLISION SUBSTEP AND NOT BY BIOMECHANICS.
   * `player.js` → `moveWithSlide` splits a frame's displacement into substeps of
   * at most `radiusM` = 0.25 m, so the number of mask queries a frame costs is
   * `ceil(v · dt / 0.25)`. At 60 fps that is `ceil(7.00/60/0.25)` = **1** — the
   * same single query session 17 shipped. At the loop's clamped worst-case
   * `dt` = 0.1 s it is `ceil(2.8)` = **3**. Doubling this constant again would
   * make the worst case 6, which is the point at which a stalled frame starts
   * paying for the speed twice. The bound is therefore about 28 m/s and is
   * nowhere near binding; it is written down because it is the only real one
   * left after the Froude bound was removed.
   *
   * AND THE NUMBER IT EXPOSES, UNCHANGED AND NOW LARGER: `downtown_dense` runs
   * its camera at 4.5 m/s and calls it "a brisk walk" in `camera.js`. That is
   * 16.2 km/h and 3.21× the crowd — faster than the player's WALK and slower
   * than the player's RUN, which is the first session in which the routes and
   * the player have straddled rather than one dominating.
   */
  runSpeedMps: 7.0,

  /**
   * m/s. THE FLY CAMERA'S BASE TRAVERSAL RATE — session 19.
   *
   * 24 m/s, AND IT IS NOT A NEW NUMBER: it is `camera.js` → `ROUTES
   * .highway_speed.speed`, the rate this project has flown a camera through this
   * city at since session 0, and the one speed at which the streaming system has
   * ever been deliberately stressed ("at this speed a 128 m chunk crosses the
   * horizon every five seconds"). Reusing it means the fly camera cannot ask the
   * chunk loader for anything the perf gate has not already measured.
   *
   * What it delivers: the authored world is about 1 120 m across (the condenser
   * at −430,−560 to the mast at 470,430), so corner to corner is **58 s** at the
   * base rate and **19 s** boosted. Against the walk's 3.50 m/s that is 6.9×,
   * which is the ratio that makes a fly camera worth having at all — at anything
   * under about 3× it is a walk that ignores walls.
   */
  flySpeedMps: 24,

  /**
   * Multiplier on `flySpeedMps` while the run modifier is held. 3.0, so the
   * boosted rate is 72 m/s and the whole map is 15.6 s corner to corner.
   *
   * Bounded above by the streaming rather than by taste: `CITY.generateBudget`
   * builds at most a few chunks a frame, and at 72 m/s a 128 m chunk crosses the
   * near ring in 1.8 s. Faster than this and the eye outruns the generator,
   * which does not crash — the analytic default covers a chunk with no field
   * (CONTRACT §8.1) — but it does mean flying through a city that is visibly
   * assembling, and that is a different tool from the one this is.
   */
  flyBoost: 3.0,

  /**
   * Metres. The tallest rise the feet will step up without a fall or a block.
   *
   * BOUNDED ABOVE by what a person steps up without hands: the maximum stair
   * riser in habitable building codes is 0.19–0.20 m (IBC 7 in = 0.178 m;
   * European practice 0.18–0.20 m). BOUNDED BELOW by the tallest kerb in this
   * city, which is `BLOCK.kerbHeight` = 0.160 m — a step height under it would
   * strand a player in the origin block's roadway, unable to get onto its own
   * pavement, which is the one place in the world with a real kerb.
   *
   * 0.20 m clears 0.160 by 1.25× and is 5.25× under the shortest thing in the
   * world that is meant to stop you: the quay parapet at `RIVER.parapet` =
   * 1.05 m. So one number separates the two populations with margin on both
   * sides, and there is nothing between 0.20 and 1.05 for it to get wrong.
   *
   * WHAT IT ACTUALLY HAS TO DO — SESSION 19, AND IT IS NOW THE WHOLE JOB
   * RATHER THAN A TENTH OF IT. This paragraph used to read "the largest rise a
   * walker meets in the streamed city is 0.010 m (pavement 0.030 over
   * carriageway 0.020) and on a bridge 0.030 m", i.e. the bound was derived
   * against the origin block's kerb and exercised against a z-fighting offset.
   * Declaring the ground datum (`GROUND`) makes every kerb in the world the
   * same kerb, so the delivered population is now:
   *
   *     kerb, anywhere       `GROUND.pavement` − `GROUND.carriageway` = 0.160
   *     pavement → earth     0.160 − (−0.020) = **0.180**, the binding case
   *     quay parapet         1.05, which must stay REFUSED
   *
   * 0.180 is 0.90× of this constant — 0.020 m of margin, 1.11×. That is the
   * tightest this bound has ever been and it is the number to check before
   * moving `BLOCK.kerbHeight` or `GROUND.earth`: the window for the pair is
   * `pavement − earth ≤ stepUpM`. It is not a new risk — `block.js` has
   * delivered exactly that 0.180 m step at the edge of its own pavement since
   * session 1, and `walkprobe` has walked it — but before session 19 it existed
   * over 336 m of one street and now it exists everywhere.
   */
  stepUpM: 0.2,

  /**
   * m/s². Gravity. Not tuned: it is the value `RUN_TRANSITION_MPS` is derived
   * with, and a controller whose fall used a different g from the gait model's
   * would be CONTRACT §9's shape with an acceleration.
   *
   * What it delivers: the quay is `RIVER.depth` = 4.99 m above the water, so a
   * step off it takes sqrt(2·4.99/9.81) = 1.009 s and arrives at 9.90 m/s.
   */
  gravityMps2: 9.81,

  /**
   * Metres. How far the eye is kept from anything the walkability mask blocks.
   *
   * BOUNDED BELOW BY THE NEAR PLANE, and that is the bound that matters. The
   * camera's near is 0.1 m, but the near plane's CORNER is further from the eye
   * than its centre, and it MOVES WITH THE FIELD OF VIEW — so this bound was
   * re-derived in session 18 when `fovDeg` went 50 → 75 rather than left
   * pointing at a field nothing uses any more:
   *
   *     fov 50°   half-height 0.1·tan25°   = 0.0466 m, half-width 0.0829 m
   *               corner sqrt(0.1² + 0.0466² + 0.0829²) = 0.138 m   → 1.81× clear
   *     fov 75°   half-height 0.1·tan37.5° = 0.0767 m, half-width 0.1364 m
   *               corner sqrt(0.1² + 0.0767² + 0.1364²) = **0.1857 m** → 1.346× clear
   *
   * A radius under the corner lets a wall clip through the corner of the frame.
   * 0.25 m still clears it, by 1.346× instead of 1.811×, and the margin is
   * written down because the next widening is the one that would spend it: at
   * fov 90° the corner is 0.2272 m and the clearance is 1.101×.
   *
   * BOUNDED BELOW ALSO BY THE BODY: `budget.json` → `motionVectors
   * .kindMinExtentM.pedestrian` is 0.45 m, so half a person is 0.225 m.
   *
   * 0.25 m is above both — 1.81× the near-plane corner and 1.11× half a
   * pedestrian — and small enough that a 4.2 m pavement is still 3.7 m of
   * usable width.
   */
  radiusM: 0.25,

  /**
   * Radians. Pitch clamp, and it is NOT `camera.js`'s free-look clamp of 1.45.
   *
   * 1.45 rad is 83.08°, and the reason that has never mattered is that no fixed
   * shot in this project looks up. A player standing on the pavement does: the
   * facade is 2.0 m from the pavement's own walking line and the origin block's
   * buildings reach 25–40 m, so the roofline of the building you are standing
   * under subtends atan(30/2.0) = **86.2°** — outside 83.08°, i.e. the existing
   * clamp makes the top of the nearest building unreachable by the eye.
   *
   * 1.5533 rad = **89.0°**, which covers atan(60/1.05) = 88.999° — a 60 m tower
   * seen from the 1.05 m parapet at its foot — and still leaves the up vector
   * 1.0° clear of degenerate, where the `YXZ` euler would gimbal.
   */
  maxPitchRad: 1.5533,

  /**
   * PLAYER field of view, degrees. 50 → 75 in session 18, and it is the larger
   * half of the "movement feels far too slow" report rather than a taste.
   *
   * THE ROUTE CAMERAS DO NOT MOVE. `lookcheck`, `perfcheck`, `citycheck`,
   * `filmshot` and `lookat` all set their own fov on every placement (52–58 on
   * the routes, 46–72 on the presets), so this number is read by `player.js`
   * and by nothing a gate drives. That separation is the whole reason the
   * player may have a different field: a route capture is a photograph and
   * should stay filmic; a player's field is an ergonomic quantity and belongs
   * to the person, not to the frame.
   *
   * THE DERIVATION IS OPTIC FLOW, WHICH IS THE CUE THE BRAIN ACTUALLY READS AS
   * SPEED. A first-person walker judges pace from how fast the ground sweeps
   * through the bottom of the frame, not from a number. With the eye at
   * `eyeHeightM` = 1.74 m and a level gaze, the ground point on the bottom edge
   * of the frame is at `d = h / tan(fov/2)`, and as the walker advances at `v`
   * that point's elevation changes at `dθ/dt = v·h / (h² + d²)`:
   *
   *     fov 50°   d = 3.73 m   flow  8.23 °/s     1.00×
   *     fov 70°   d = 2.48 m   flow 15.17 °/s     1.84×
   *     fov 75°   d = 2.27 m   flow 17.08 °/s     2.07×   ← here
   *     fov 90°   d = 1.74 m   flow 23.05 °/s     2.80×
   *
   * So **the field alone is worth 2.07× the apparent pace** — at 1.40 m/s and
   * 75° the frame flows exactly as fast as 2.90 m/s did at 50°, which is
   * already inside the 2.5–4 m/s band first-person games use. That is why the
   * walk speed only had to move to 2.00 and not to 4.
   *
   * BOUNDED ABOVE at 90°, where `d` falls to 1.74 m — the eye height itself,
   * i.e. the bottom of the frame reaches the walker's own feet and the ground
   * immediately below the camera is in shot, which reads as looking down. 75°
   * is the middle of the 70–90° first-person convention and 1.20× clear of
   * that bound.
   *
   * WHAT IT COSTS, SAID OUT LOUD: a wider field puts more of the world in
   * frame, so `player`'s route — already the most expensive of the four
   * (STATE 17 §4) — gets more expensive. It is measured rather than assumed;
   * see STATE.md. And `PLAYER.radiusM`'s near-plane-corner derivation moves
   * with it: at 75° and 16:9 the near plane's half-height is 0.1·tan37.5° =
   * 0.0767 m and its half-width 0.1364 m, so the corner is at
   * sqrt(0.1² + 0.0767² + 0.1364²) = **0.1857 m**, and the 0.25 m radius clears
   * it by 1.346× where it used to clear 0.1380 m by 1.811×. Still clear, by
   * less, and the number is written down so the next widening has to check it.
   */
  fovDeg: 75,

  /**
   * RADIAL STICK DEAD ZONES, from the XInput SDK's own constants rather than
   * from feel: `XINPUT_GAMEPAD_LEFT_THUMB_DEADZONE` = 7849 and
   * `..._RIGHT_THUMB_DEADZONE` = 8689, both out of 32767.
   *
   *   left  7849 / 32767 = 0.2395
   *   right 8689 / 32767 = 0.2651
   *
   * They are different because the two sticks are not asked the same question:
   * the right one steers an angular RATE that integrates, so a drift the left
   * stick would merely translate into a slow walk the right one turns into a
   * camera that never stops rotating. Microsoft's two numbers already encode
   * that and there is no reason to invent a third.
   *
   * RADIAL, ON THE MAGNITUDE OF THE PAIR, NOT PER AXIS. A per-axis dead zone
   * squares the dead region into a box: a stick pushed diagonally to
   * (0.25, 0.25) has magnitude 0.354 — well outside the zone — and a per-axis
   * test would zero BOTH axes and deliver nothing. Measured against the left
   * stick's own 0.2395, the box excludes a disc of radius 0.2395 and a square
   * of half-width 0.2395, whose corner is at 0.339: **41.6% further out on the
   * diagonal than on the axes**, which is exactly the direction a player pushes
   * to walk diagonally.
   *
   * AND RESCALED, which is the half that makes the size harmless. The response
   * uses (m − d)/(1 − d), so it is continuous at the boundary. Without the
   * rescale the first movement past the dead zone is a step of `d`: at 0.2395
   * on the left stick that is an instant 0.335 m/s of walk speed, appearing
   * from nothing — a quarter of full walking pace as a discontinuity.
   */
  stickDeadzoneMove: 7849 / 32767,
  stickDeadzoneLook: 8689 / 32767,

  /**
   * THE LOOK STICK'S RESPONSE EXPONENT, `rate = maxRate · m^k`, AND IT IS
   * BOUNDED FROM BOTH SIDES. Neither bound is a preference.
   *
   * THE DISPLAY'S OWN ANGULAR RESOLUTION IS WHAT BOTH BOUNDS ARE IN TERMS OF,
   * AND IT MOVES WITH `fovDeg` — WHICH IS WHY THIS NUMBER CHANGED IN SESSION 18
   * WITHOUT ANYBODY TOUCHING THE STICK.
   *
   * At the gate's internal 2560×1440, the horizontal field is
   * 2·atan(tan(fov/2)·16/9) and one pixel is that over 2560:
   *
   *     fov 50°   h-fov  79.32°   → 0.0310° per pixel
   *     fov 75°   h-fov 107.51°   → 0.0420° per pixel      ← the field now
   *
   * FROM BELOW — half deflection must not be unusable. At `maxLookRateDegPerS`
   * = 180 °/s a LINEAR stick at m = 0.5 turns at 90 °/s, which at 60 Hz is
   * 1.5° a frame. Requiring half deflection to stay at or under one degree a
   * frame (60 °/s) gives 0.5^k ≤ 1/3, i.e. **k ≥ 1.585**. This bound is in
   * degrees and does NOT move with the field.
   *
   * FROM ABOVE — the smallest deflection a thumb can hold, call it 0.1 of the
   * post-dead-zone range, must still MOVE AT LEAST ONE PIXEL. That bound is in
   * PIXELS, so it moves with the field: `180·0.1^k / 60 ≥ °/px` gives
   * **k ≤ 1.986 at fov 50** and **k ≤ 1.854 at fov 75**.
   *
   * SO k = 2 WAS INSIDE ITS BOUNDS AT FOV 50 AND IS OUTSIDE THEM AT FOV 75:
   * 180·0.1²/60 = 0.030 °/frame is 0.97 px at 0.0310°/px and **0.71 px at
   * 0.0420°/px** — the second dead zone the bound exists to forbid, created by
   * a change in another constant. CONTRACT §9.1's shape with a derivation
   * instead of a value: the number did not move, the thing it was derived from
   * did, and nothing linked them.
   *
   *     k = 1.585  half 1.000 °/frame   0.1-deflection 1.86 px/frame
   *     k = 1.75   half 0.892 °/frame   0.1-deflection 1.27 px/frame   ← here
   *     k = 1.854  half 0.830 °/frame   0.1-deflection 1.00 px/frame
   *     k = 2      half 0.750 °/frame   0.1-deflection 0.71 px/frame   REFUSED
   *
   * **k = 1.75**, 1.10× above the lower bound and 1.06× below the upper, which
   * is the first value in this block's history to sit inside both with margin
   * rather than exactly on one. A cubic is not "smoother"; it is a second dead
   * zone that does not announce itself, and so, now, is a square.
   *
   * THE MOVE STICK HAS NO CURVE AND THAT IS ALSO A DECISION. Its output is a
   * SPEED and the brief asks for speed to follow deflection. Squared, a
   * half-pushed stick walks at 0.25 · 1.40 = 0.35 m/s — 1.26 km/h, slower than
   * anybody walks and slower than every pedestrian in frame. Linear gives
   * 0.70 m/s, which is a dawdle rather than a shuffle.
   */
  lookCurveExponent: 1.75,

  /**
   * Degrees per second at full stick deflection.
   *
   * 180 °/s is a half-turn in one second, which is the rate at which a
   * first-person camera stops reading as a head turn and starts reading as a
   * spin. It is also what makes the exponent bounds above arithmetic rather
   * than rhetorical: both are stated in pixels per frame at 60 Hz, and both
   * scale with this number.
   */
  maxLookRateDegPerS: 180,

  /**
   * MOUSE SENSITIVITY, EXPRESSED THE ONE WAY THAT IS COMPARABLE BETWEEN MICE:
   * centimetres of desk travel per 360° turn, at a stated counts-per-inch.
   *
   * 40 cm/360° at 800 cpi is the middle of the 30–50 cm band that people who
   * aim for a living use. The arithmetic: 40 cm = 15.748 in × 800 cpi =
   * 12 598 counts for 360°, so **0.028576 ° per count** = 4.988e-4 rad. The
   * browser reports `movementX` in CSS pixels, which on this display at
   * `devicePixelRatio` 1 is one count per pixel.
   *
   * FOR COMPARISON, AND IT IS A FINDING: `camera.js`'s free-look uses
   * 0.0026 rad per pixel, which is 0.1490 °/px — **5.21× faster**, i.e. a full
   * turn in 2 416 px, i.e. **7.7 cm/360°**. That is why looking around with the
   * mouse in this project has always felt like a flick rather than a look.
   */
  mouseCmPer360: 40,
  mouseCpi: 800,
  /** 2π / (40 cm / 2.54 cm·in⁻¹ × 800 cpi) = 6.28319 / 12 598.4 = 4.9873e-4. */
  get mouseRadPerCount() {
    // READ FROM THE TWO CONSTANTS ABOVE, NOT RETYPED FROM THEM — session 18.
    // This line held the literals 40 and 800 a second time, so editing
    // `mouseCmPer360` changed what `player.js` PRINTS and not what the mouse
    // DOES. One physical quantity, declared twice, two lines apart, with only
    // one of the copies wired to anything: CONTRACT §9.1 at its shortest range.
    return (2 * Math.PI) / ((this.mouseCmPer360 / 2.54) * this.mouseCpi);
  },

  /**
   * Where a player stands when nothing says otherwise, and it is not the
   * middle of the map.
   *
   * [70, 9.7] is the south pavement of the main street beside the `street`
   * shot's own eye at [70, 1.74, 0.9] — the one placement every look frame in
   * this project has ever been judged from. So the first thing a player sees on
   * foot is the frame the project knows best, from two metres to its right and
   * standing on the pavement rather than in the road. `?spawn=x,y,z` overrides.
   */
  spawn: [70, 9.7],
};

/**
 * THE HUD'S OWN NUMBERS — session 20, item 6.
 *
 * WHY THE CEILINGS ARE COPIED HERE AT ALL, AND WHAT STOPS THE COPY DRIFTING.
 *
 * The HUD's whole point is that a number means something without the reader
 * remembering the threshold: green under the ceiling, amber within ten percent,
 * red over, and the ceiling printed beside the value — `11.8 / 12.5 ms` says
 * more than `11.8`. So it needs the ceilings, and the ceilings live in
 * `tools/budget.json`, which a module may not import: CONTRACT §2.2 permits
 * `three`, `../core/**` and `../lib/**` and nothing else, and for a good reason
 * — the gates' contract is not a runtime dependency of the renderer.
 *
 * A SECOND COPY OF A NUMBER IS EXACTLY §9.1's FAILURE, so it is not left as a
 * copy: `perfcheck` reads this table and `budget.json → ceilings` and fails
 * when they disagree, printing both. That is the same remedy `traffic.js`'s
 * `stats().minExtentM` got — a comment that claims a check names the file the
 * check is in, and this one does.
 *
 * The alternative was fetching `budget.json` over HTTP at boot, which works in
 * `vite dev` and not in `vite build`, and would make the HUD's colours depend
 * on whether the operator was running the dev server. A checked copy is worse
 * than one number and better than a number that is sometimes absent.
 */
export const HUD = {
  budgets: {
    cpuFrameMsP95: 12,
    wallFrameMsP95: 12.5,
    drawCalls: 440,
    /** Session 37: 2 000 000 -> 2 360 000, derived against a MEASURED broken LOD. budget.json $triangles_s37_LOD_MEASURED. */
    triangles: 2360000,
    textureMemoryMB: 192,
    chunkMemoryMB: 96,
  },
  /**
   * Amber from 90% of the ceiling. A tenth is what "within ten percent" means
   * and it is also roughly this machine's own run-to-run spread on the tightest
   * quantity the HUD shows: CONTRACT §0.2 measures wall p95 at a 0.45 ms median
   * spread against a 12.5 ms ceiling, i.e. 3.6% — so amber starts at about
   * 2.8 spreads out and a green reading is green by more than the instrument's
   * own noise. A 95% band would put amber inside the noise floor and the colour
   * would flicker on an unchanged machine, which is §0 rule 6 with a colour
   * instead of a verdict.
   */
  amberFraction: 0.90,
  /** Seconds of history in the graph. The brief's own number. */
  graphSeconds: 1.0,
  /** Levels, in cycle order. `off` is a level so `H` always has somewhere to go. */
  levels: ['off', 'minimal', 'render', 'world', 'derivations'],

  /**
   * THE VSYNC LOCK — session 23, item 1. WHY A CEILING NEEDS A DETECTOR AT ALL.
   *
   * `wallFrameMsP95` is 12.5 and `budget.json` says what it is a ceiling ON, in
   * its own words: *"End-to-end animation-frame interval WITH VSYNC AND THE
   * FRAME-RATE LIMITER DISABLED, so it is bounded below by whichever of the CPU
   * and the GPU is slower."* `page.mjs` and `perfcheck` both launch with
   * `--disable-gpu-vsync --disable-frame-rate-limit` for exactly that reason.
   *
   * A BROWSER ON THE OPERATOR'S DESK HAS NEITHER FLAG. There the delivered
   * interval is `max(work, T)` for a refresh period `T`, and the ceiling is on
   * `work`. Those are two different quantities with the same units and plausible
   * magnitudes, which is CONTRACT §9's entire subject — and the tell is written
   * in the budget file already: `$wallFrameMsP95_rebaseline` records that this
   * ceiling USED TO BE 16.67 and that *"16.67 was the vsync line"*. The red
   * number the operator read, 16.7, is the ceiling's own discarded value.
   *
   * Under a lock the reading is CENSORED rather than wrong. An interval of
   * `m·T` establishes `work` in `((m-1)·T, m·T]` and nothing finer, so a verdict
   * against a ceiling `W` is available exactly when that whole band lies on one
   * side of `W`:
   *
   *     m = 1, T = 16.67   work in (0, 16.67]   W = 12.5 is INSIDE   no verdict
   *     m = 2, T = 16.67   work in (16.67, 33]  W is BELOW           breach
   *     m = 1, T =  8.33   work in (0, 8.33]    W is ABOVE           clear
   *
   * So this is not a suppression: at 120 Hz the same rule turns the cell GREEN,
   * because a held 8.33 ms lock PROVES the work is under 12.5 ms. At 60 Hz it
   * turns the cell neutral, because nothing is proved either way. And a dropped
   * frame stays RED at every refresh rate, which is the one thing a locked
   * context can still resolve and the thing a person actually sees.
   *
   * NO GATE READS ANY OF THIS. `perfcheck` runs unlocked and asserts the same
   * 12.5 it always has; `HUD.budgets` above is byte-identical and still checked
   * against `budget.json` key for key. This changes what a panel says about a
   * measurement it cannot make, and nothing about the measurement.
   */
  vsync: {
    /**
     * Frames before a lock may be claimed. 60 is one second at 60 Hz, and it is
     * the granularity that makes `lockedFraction` a statistic: with 60 samples
     * the fraction moves in steps of 1/60 = 1.67%, so the 0.90 threshold below
     * sits 6 whole frames clear of 1.0 and a single hitch cannot flip the claim.
     */
    minSamples: 60,
    /**
     * How close to an integer multiple of the candidate period counts as ON the
     * grid: `|interval - m·T| <= tolFrac·T`. 0.06 is 1.00 ms at T = 16.67 —
     * an order of magnitude above the rAF timestamp's own coarsening (Chrome
     * clamps `performance.now()` to 100 us cross-origin-isolated, 5 us
     * otherwise) and a sixth of the 8.33 ms half-gap to the next multiple, so
     * the bands cannot touch. THE DISCRIMINATION IS ARITHMETIC: bands of width
     * `2·tolFrac·T` repeating every `T` cover 12% of the line, so a distribution
     * that is NOT quantised puts about 12% of its samples on the grid by luck,
     * against the 0.90 required below — a separation of 7.5x.
     */
    tolFrac: 0.06,
    /**
     * The share of intervals that must lie on the grid. 0.90 over the loop's
     * 240-frame buffer is 24 frames of slack: a machine dropping more than one
     * frame in ten is not holding its refresh, and the lock claim should lapse
     * rather than explain away a stutter.
     */
    lockedFraction: 0.90,
    /**
     * The callback must not FILL the period, or the period is explained by the
     * work and there is no lock to attribute it to. `p95(callback) <= 0.75·T`.
     *
     * It is a NECESSARY condition and not a sufficient one, and the reason is
     * worth the line: `callback` ends when the rAF body returns, so it does not
     * contain the GPU work that retires afterwards or the compositor's own. The
     * measured duty therefore UNDERSTATES the true one, and 0.75 leaves the
     * unmeasured remainder a quarter of the period to live in. What carries the
     * claim is the quantisation above; this only removes the case where the
     * work alone already accounts for the period.
     */
    maxDutyFraction: 0.75,
  },
};

/**
 * AIRCRAFT — session 20, item 5. The first content in this project that moves
 * freely in three dimensions rather than along a spline or a lane lattice.
 *
 * WHY IT IS CHEAP, WHICH IS THE WHOLE ARGUMENT FOR BUILDING IT. Six instances,
 * high up, small in frame, no collision, no walkability, no shadow, no LOD, and
 * two draw calls. It carries its own night legibility through navigation lights
 * — emissive geometry at zero cluster slots — which is the same argument that
 * gave the vehicles' tail lamps theirs.
 *
 * AND IT FINISHES A THOUGHT SESSION 19 STARTED. The red beacons on the
 * condenser and the mast exist for air traffic; `LIGHT.aviationRedNits` derives
 * them from ICAO Annex 14 and says so. Built without anything in the air they
 * are a decoration. Built with it they are one idea.
 *
 * EVERY NUMBER BELOW IS A REAL AIRCRAFT'S, so the next session can disagree
 * with the aircraft rather than with the taste.
 */
export const AIRCRAFT = {
  /**
   * THE POPULATION, AND WHY IT IS SIX.
   *
   * It is a density argument rather than a taste. A large city's control zone
   * carries on the order of 40–60 movements an hour at night across its whole
   * terminal area; what matters here is how many are inside the 1 662 m the map
   * spans and under the 900 m this draws to. Taking 50 movements/h over a
   * 20 km-radius zone at 150–250 kt, the expected count inside a 1.7 km disc is
   * well under one — so a strict density model puts ZERO aeroplanes in frame
   * and this is a deliberate exaggeration, recorded as one, the same shape as
   * `PLAYER.walkSpeedMps` = 3.50 being 1.71× the Froude bound. The licence is
   * the same: nothing is derived from this number.
   *
   * Helicopters are the honest half. A police or news helicopter orbiting a
   * city centre at 150–300 m is one aircraft over one city for an hour at a
   * time, which is exactly what `orbiters: 1` says.
   */
  planes: 3,
  cruisers: 2,
  orbiters: 1,

  /**
   * ALTITUDE BANDS, m AGL. A city's own minimum safe altitude is 300 m over a
   * congested area (ICAO Annex 2 / FAR 91.119: 1000 ft above the highest
   * obstacle within 600 m), which is what separates the two bands: an aeroplane
   * transiting is above it and a helicopter on task is below it under a police
   * or HEMS exemption. The tallest thing in this world is the condenser at
   * 260 m, so `planeLow` clears it by 160 m.
   */
  planeLow: 420,
  planeHigh: 900,
  cruiserLow: 180,
  cruiserHigh: 320,
  orbitAltitude: 150,

  /**
   * SPEEDS, m/s. 150 kt = 77.2 m/s is a light twin's cruise and the bottom of a
   * jet's approach speed; 60 kt = 30.9 m/s is a helicopter transiting; 25 kt =
   * 12.9 m/s is one orbiting a scene, which is the speed that keeps a 240 m
   * orbit at a bank angle a passenger would sit through (v²/(g·r) = 12.9²/(9.81
   * × 240) = 0.0707, i.e. 4.0° of bank).
   */
  planeSpeedMps: 77.2,
  cruiserSpeedMps: 30.9,
  orbitSpeedMps: 12.9,
  orbitRadiusM: 240,

  /**
   * THE FLASH RATES, AND THEY ARE THE REGULATION'S.
   *
   * FAR 23.1401 / ICAO Annex 6: an anti-collision light system flashes at
   * **40 to 100 cycles per minute**. The red rotating beacon sits at the bottom
   * of that band and the white strobes at the top, which is what makes the two
   * distinguishable in the same frame — a beacon you can count and a strobe you
   * cannot. 45/min = 1.333 s and 90/min = 0.667 s.
   *
   * A RAISED COSINE RATHER THAN A SQUARE WAVE, exactly as the landmark beacons
   * are, and for the reason `city.js` records: a sub-pixel emitter that steps on
   * in one frame steps into the TAA history in one frame. The strobe's duty is
   * short because a real strobe's is — 0.12 of the period is about 80 ms, which
   * is a capacitor discharge plus the eye's own persistence.
   */
  beaconPeriodS: 1.333,
  beaconDuty: 0.28,
  strobePeriodS: 0.667,
  strobeDuty: 0.12,

  /**
   * The searchlight's sweep. A helicopter on task does not hold its light still:
   * it walks it along a street or round a block. This is a slow sinusoid in the
   * light's depression angle and a slower one in its bearing relative to the
   * airframe, so the pool crosses facades rather than sitting on one.
   *
   * 17 s and 29 s are chosen COPRIME so the two never re-phase into a repeating
   * figure — 17 and 29 are both prime, so the combined period is 493 s, which is
   * 8 minutes 13 seconds and is longer than anyone watches one helicopter.
   */
  searchSweepS: 17,
  searchBearingS: 29,
  /**
   * DEPRESSION BELOW THE HORIZON, radians, AND THE SHALLOW END IS SET BY THE
   * LIGHT'S OWN FALLOFF RATHER THAN BY TASTE.
   *
   * The first version swept 25°–75° and the first frame of it showed NO POOL AT
   * ALL. The arithmetic that was never done: at `orbitAltitude` = 150 m a 25°
   * depression puts the ground 150/sin 25° = **355 m** down the beam, and
   * `aircraft.js` gives the light a falloff radius of 260 m — chosen from the
   * distance at which its own illuminance falls to floodlighting level. So the
   * beam's far end was 95 m outside the light's own support and the shallow half
   * of every sweep landed on nothing. CONTRACT §9's shape with two DISTANCES:
   * a slant range and a falloff radius, both in metres, both plausible.
   *
   *     shallow end:  asin(150 / 260) = 35.2°, so the beam reaches the ground
   *                   exactly at the falloff radius. 37° for margin → 249 m
   *                   slant, and 1 350 000 / 249² = **21.8 lx** on the ground,
   *                   which is still 1.36x `LIGHT.streetAverageLux`.
   *     steep end:    75° → 155 m slant, 56.2 lx, near enough the 60 lx at
   *                   150 m that `searchlightCandela` was derived from.
   *
   * The pool's own size falls out of the same pair: 2·d·tan 7.5° is 65.6 m at
   * the shallow end and 40.8 m at the steep one, against a 15 m carriageway and
   * a 23.4 m corridor — so the beam covers a street and a bit of the buildings
   * either side, which is what a searchlight looks like.
   */
  searchMinDepressionRad: 0.6458,
  searchMaxDepressionRad: 1.3090,
};
