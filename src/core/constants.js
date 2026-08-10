/**
 * constants.js — numbers that more than one module needs, and the reasons.
 *
 * A number that appears in two files eventually appears as two different
 * numbers. Anything here is authored once.
 */

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
   * cd/m², THE AREA-AVERAGE RADIANCE OF THE FROSTED BOWL — 9000 → 1952 in
   * session 18, and it is `signPlateNits` again with a lamp instead of a sign.
   *
   * 9000 is not a radiance. It is an INTENSITY OVER A PROJECTION: the bowl is a
   * sphere of radius 0.42 m (`city.js` → `geometries.bowl`), whose projected
   * area is π·0.42² = 0.5542 m², and `streetlampCandela` / 0.5542 = 12 270
   * cd/m². 9000 is that quantity rounded down. Both are cd/m², both are
   * plausible, and the lamp renders — CONTRACT §9's shape exactly, and the
   * fourth time this project has made it with a photometric quantity after the
   * luminaire leak, the tyre reflectance and the sign plate.
   *
   * THE RADIANCE OF AN EMITTING SURFACE IS ITS FLUX OVER ITS OWN AREA, not its
   * peak intensity over its own shadow. `luminaire.js` integrates the §5.9
   * distribution and returns the fixture's flux; the bowl is a spherical zone
   * from 63° to 180°, so its emitting area is 2πR²(cos 63° − cos 180°):
   *
   *     Φ = luminaireFlux(6800 cd, LUMINAIRE)      =  9883.5 lm
   *     A = 2π·0.42²·(0.4540 + 1)                  =     1.6115 m²
   *     L = Φ / (π·A) = 9883.5 / 5.0627            =  1952 cd/m²
   *
   * and 9000 / 1952 = **4.61×**, which is the size of the error rather than a
   * taste. Every number in that derivation already existed in the project; none
   * of them had ever been written on the same line.
   *
   * WHAT IT WAS COSTING. At the night exposure the frame actually settles at
   * (e ≈ 0.0141), 9000 cd/m² is 127 in exposed linear against a bright-pass
   * onset of 0.414 — **307× over the bloom threshold**, on ninety-eight lamp
   * bowls at once. CONTRACT §5.5 says it in one line: "If the whole frame
   * glows, the threshold is wrong." The threshold was not wrong; what sat above
   * it was two and a half orders of magnitude over it, and `POST.glareStrength`
   * has been re-derived twice (0.15 → 0.075) against a veil that this constant
   * was filling. At 1952 the bowl is 66× the onset — still a lamp, still
   * blooming, no longer the frame's dominant source of glare energy.
   *
   * ────────────────────────────────────────────────────────────────────────
   * AND THE VALUE IS STILL 9000, BECAUSE THE CORRECTION WAS MEASURED AND IT
   * MADE THE FRAME WORSE. This is the finding, not the arithmetic above.
   *
   * Session 18 set it to 1952, re-shot the operator's own night street from the
   * pavement at [300, 1.77, 9.7] and read the histogram (`tools/levels.mjs`,
   * the Zone III–VII textured band):
   *
   *     9000 → 1952     textured 12.15% → 3.26%   (−8.89 points)
   *                     crushed   2.53% → 6.23%   (+3.70 points)
   *                     clipped   0.10% → 0.10%   (unchanged)
   *                     mean     0.1419 → 0.1042
   *
   * THE TOP END DID NOT MOVE AT ALL, and that is the whole explanation: a bowl
   * at 9000 and a bowl at 1952 are both far above white, so dividing by 4.61
   * removes no clipping. What it removes is BLOOM ENERGY — and the veiling
   * glare fed from that energy is the only thing holding 85% of a night frame
   * off zero. `POST.glareStrength` says so in its own derivation two blocks
   * down: it was re-derived 0.15 → 0.075 against a frame whose glare budget
   * this constant was filling. So the two numbers are one system, and 9000 is
   * load-bearing as LIGHTING even though it is wrong as a RADIANCE.
   *
   * The honest statement is therefore: **this is a real §9 quantity confusion,
   * the correct value is 1952 cd/m², and it cannot ship on its own** — the
   * 8.89 points of mid-tone it removes have to come back as light before it
   * goes in, not as camera veil. That is a lighting change (item 11's kind) and
   * a glare re-derivation together, measured on the same frames, and session 18
   * did not have room to land both honestly. Reverting a measured regression is
   * not the same as declining to fix the defect, and the arithmetic is left
   * here so the next session argues with the derivation rather than the taste.
   *
   * THE SPLIT IS ALSO STILL OPEN. `block.js` → `EMISSIVE.lampBowl` is **210**
   * for the same object, read only by `block.js`, while this is read only by
   * `city.js` — 42.9× = 5.42 stops between two paths, with the look gates
   * watching the 210 side and the night routes filling their frames from this
   * one. Neither number is Φ/(πA). See STATE.md.
   */
  streetlampNits: 9000,
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
   * 0.055, unchanged since session 1, and session 4 tried 0.030 and put it back.
   *
   * The theory was that bloom, being the term that spreads a source across its
   * neighbours, was the right half of the glow budget to cut — it would sharpen
   * the frame, which the dusk stddev floor wants, where cutting the veil instead
   * flattens the blacks the veil exists to hold off zero. The measurement said
   * the opposite: at 0.030 the dusk stddev went DOWN (0.1268 → 0.1258) and both
   * the dawn and dusk means fell out of their bands. Bloom is carrying real
   * brightness and real structure on a night frame, not just haze. Recorded so
   * the next session does not re-run the experiment.
   */
  bloomStrength: 0.055,
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
   */
  glareStrength: 0.075,
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
   * THE COST, NAMED RATHER THAN HIDDEN: 2.00 / 1.40 = **1.43× the crowd's
   * mean** and 1.05× its fastest walker at 1.90 m/s. A player therefore
   * overtakes the crowd slowly rather than sweeping past it, which is what
   * keeps the pedestrians reading as people walking rather than as scenery
   * standing still. The brief's own ceiling for a RUN was 3× the crowd; this
   * walk is less than half of that.
   */
  walkSpeedMps: 2.0,

  /**
   * m/s. Running, and it is derived from two bounds that nearly meet.
   *
   * FROM BELOW: anything at or under `RUN_TRANSITION_MPS` = 2.048 m/s (Froude
   * 0.5 at the model's own 0.855 m hip) is a walk, and `streetlife.js` already
   * draws walkers up to 1.90 m/s. A "run" under 2.05 m/s would be a word for
   * something the crowd is already doing.
   *
   * FROM ABOVE: the brief's own constraint is that a player who outpaces the
   * crowd by 3× reads wrong. 3 × 1.40 = 4.20 m/s is the ceiling. 3.5 m/s is
   * **2.50×** the crowd's mean, **1.84×** its fastest walker and **1.71×** the
   * walk–run transition — a jog, comfortably inside both bounds.
   *
   * AND THE NUMBER IT EXPOSES: `downtown_dense` runs its camera at 4.5 m/s and
   * calls it "a brisk walk" in `camera.js`. 4.5 m/s is 16.2 km/h and 3.21× the
   * crowd — i.e. past the ceiling the brief set for a RUN. Three of this
   * project's four route cameras have always moved faster than a player is
   * allowed to sprint.
   */
  runSpeedMps: 3.5,

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
   * WHAT IT ACTUALLY HAS TO DO TODAY, which is much less: the largest rise a
   * walker meets in the streamed city is 0.010 m (pavement 0.030 over
   * carriageway 0.020) and on a bridge 0.030 m (footway 0.060 over carriageway
   * 0.030). See `city.js` → `GROUND_Y`.
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
