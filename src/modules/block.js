/**
 * block.js — ten buildings, one street, one intersection. Nothing else.
 *
 * docs/look-first-sequence.md: "If you find yourself building a street grid,
 * stop — that is session 3." So this is one corridor and one crossing, and the
 * geometry exists to give the light something to do:
 *
 *   - pilasters and spandrels, because low light across a flat box is a flat
 *     box, and across a 13 cm rib it is architecture
 *   - a parapet, because the silhouette against a dusk sky is half the frame
 *   - kerbs, because the one horizontal line that reads at night is the kerb
 *   - canopies, because they are what the shop light bounces off
 *
 * Materials are deliberately plain grey. Session 2 owns materials; if dusk only
 * looks good once there is wet asphalt and glass, the lighting is not finished.
 *
 * Two nods forward to docs/authored-city.md, cheap here and expensive to
 * retrofit: buildings sit slightly off their lot line and a degree or two off
 * axis (§3), and the spacing comes from clumping rather than from a grid with
 * jitter (§1). Neither is a "handmade feel" pass — they are how the placement
 * loop works from the first building it puts down.
 */

import * as THREE from 'three';
import { BLOCK, LIGHT, LAMP_BOWL, LUMINAIRE, GROUND, ROAD_PAINT } from '../core/constants.js';
import { EMITTER_CHROMA, kelvinToLinearRGB } from '../lib/color.js';
import { weightedIndex } from '../lib/rng.js';
import {
  riverBankStations, BUS_STOP, riverEdges,
  sunkenLandmarks, basinRimStations, basinSurfaceAt,
  ROAD_MARKING, BLOCK_KEEPOUT, CITY as CITYGEN,
  EXIT_ROAD as CITYGEN_ROAD, exitRoadZ, exitRoadHalfM, exitRoadYawDeg,
} from '../lib/citygen.js';
import { luminaireFlux } from '../lib/luminaire.js';

const DEG = Math.PI / 180;

/**
 * Emissive levels, in nits. These are authored, not measured, and the reason is
 * worth writing down: a real lit window seen from the street runs 20–200 cd/m²
 * and a bare neon tube runs several thousand. Against a night street metering
 * at well under 1 cd/m², physically-correct emitters clip to white and ACES
 * takes the colour with them. Curtains, blinds, grime and oblique angles all
 * argue for the low end of the real range, and that is where these sit.
 */
const EMISSIVE = {
  windowWarm: 21,
  windowDirty: 14,
  windowCold: 30,
  windowDim: 7,
  shopBright: 15,
  shopWarm: 9,
  shopCold: 17,
  shopDim: 4.5,
  /**
   * `lampBowl: 210` LIVED HERE FOR TWENTY-FIVE SESSIONS AND IS NOW IN
   * `constants.js` → `LAMP_BOWL.originNits` — session 28.
   *
   * It was the origin block's half of a 42.86× split: the same frosted bowl on
   * the same column carrying the same 6800 cd lantern was 210 cd/m² here and
   * 9000 cd/m² in `city.js`, with nothing in the project comparing the two and
   * neither of them equal to the Φ/(πA) = 1952.2 that both describe. CONTRACT
   * §9's own class — one quantity, two values, two files.
   *
   * It belongs in `constants.js` rather than in this table because this table's
   * own comment is the reason it went wrong: "these are authored, not
   * measured". That is the right sentence for a lit window behind a curtain and
   * the wrong one for a luminaire whose flux this project integrates.
   */
  /**
   * The tube clips to white and blooms; the plate behind it is what carries the
   * colour. Sign colour that lives only in a clipped emitter is sign colour ACES
   * takes away — a saturated glow needs an area that sits below white, not a
   * brighter core.
   */
  neonTube: 230,
  signPlate: 38,
  deadSignPlate: 1.4,
};

/** Shop bay interior colours, indexed to match the materials built below. */
const SHOP_CHROMA = [
  EMITTER_CHROMA.fluorescentDirty,
  EMITTER_CHROMA.tungsten,
  EMITTER_CHROMA.fluorescentCold,
  EMITTER_CHROMA.sodium,
];

/**
 * BASE MATERIALS — session 3.
 *
 * Albedo in LINEAR sRGB, not hex, because these are measured reflectances
 * rather than authored colours and running them through an sRGB decode would
 * be a second interpretation of a number that already means something.
 *
 * Roughness matters at least as much as albedo, and for a reason worth stating
 * once: a colour grade, a change of exposure, a different time of day all move
 * albedo differences around and can flatten them. They do not touch roughness.
 * A panel wall and a brick wall differ in how the light comes *off* them —
 * where the sky's reflection sits, whether the surface takes the procedural
 * mineral grain at all (lights.js gates that on roughness above 0.42) — and
 * that difference survives everything.
 *
 * There is one material in the renderer. These ride on it per instance:
 * `instanceColor` for the albedo, a `noctisRough` instanced attribute for the
 * roughness. Four materials would be four InstancedMeshes per element type and
 * four times the draw calls, which is the wrong trade at ten buildings and a
 * disastrous one at a thousand.
 */
const FACADE_MATERIALS = [
  {
    id: 'brick',
    /** Fired clay with mortar joints. 0.14 reflectance, strongly red. */
    albedo: [0.235, 0.115, 0.088],
    roughness: 0.9,
  },
  {
    id: 'concrete',
    /** Weathered cast concrete. Session 2's one material, kept as one of four. */
    albedo: [0.415, 0.395, 0.36],
    roughness: 0.76,
  },
  {
    id: 'panel',
    /** Precast or coated metal curtain panel: light, cool, and nearly smooth. */
    albedo: [0.56, 0.57, 0.575],
    roughness: 0.36,
  },
  {
    id: 'stucco',
    /** Painted render over block. Warm, mid-bright, mid-rough. */
    albedo: [0.51, 0.455, 0.36],
    roughness: 0.58,
  },
];

/**
 * ERAS — authored-city.md §2, "everything the same age is the strongest tell".
 *
 * Session 2 gave every building a per-instance hue offset and the block still
 * read as one material with window patterns on it, because a hue offset is the
 * one thing a viewer discounts: it looks like lighting. What distinguishes a
 * 1920s masonry front from a 1960s slab is not its colour, it is its floor
 * height, the shape and rhythm of its openings, how much of the wall is glass,
 * what happens where it meets the pavement, and what happens where it meets the
 * sky. All five of those are here, and colour is the sixth.
 *
 * `floorHeight` is a fixed value per era with a small per-building jitter,
 * rather than a range, and that is deliberate: buildings of one period really
 * do share a floor height, because they shared a building code and a beam
 * depth. It is also what makes the number legible — four spaced values with
 * jitter reads as four periods, four overlapping ranges reads as noise.
 *
 * The `materials` array is a per-era distribution, not a single choice, so an
 * era is a family rather than a swatch.
 */
const ERAS = [
  {
    id: 'prewar',
    /** c. 1900–1930 load-bearing masonry. Tall floors, small punched openings. */
    weight: 1.0,
    floorHeight: 4.3,
    /** Where the upper facade starts, metres. A tall ground floor with a transom. */
    plinth: 5.6,
    rhythm: 'grid',
    colSpacing: 2.95,
    windowWidth: 1.15,
    windowHeightFrac: 0.4,
    pilasters: true,
    spandrelHeight: 0.5,
    /** The cornice: how far it projects and how deep it is, metres. */
    cornice: { project: 0.9, height: 1.5 },
    ground: 'shopfront',
    materials: [0, 0, 3],
  },
  {
    id: 'postwar',
    /** 1950–70. Low floors, horizontal ribbon glazing, no cornice at all. */
    weight: 1.0,
    floorHeight: 3.05,
    plinth: 4.5,
    rhythm: 'band',
    /** Metres of solid wall at each end of a ribbon. */
    bandInset: 0.95,
    windowHeightFrac: 0.52,
    pilasters: false,
    spandrelHeight: 0.28,
    cornice: { project: 0.08, height: 0.5 },
    ground: 'blankPlinth',
    materials: [1, 1, 2],
  },
  {
    id: 'corporate',
    /** 1975–95. Vertical bays between full-height mullion strips, set on piers. */
    weight: 0.9,
    floorHeight: 3.85,
    plinth: 6.3,
    rhythm: 'vertical',
    colSpacing: 3.35,
    windowWidth: 1.75,
    windowHeightFrac: 0.72,
    pilasters: true,
    spandrelHeight: 0.22,
    cornice: { project: 0.55, height: 0.95 },
    ground: 'colonnade',
    materials: [2, 2, 1],
  },
  {
    id: 'infill',
    /** 2005+. Irregular punched openings, flush coping, rendered. */
    weight: 0.8,
    floorHeight: 3.45,
    plinth: 5.0,
    rhythm: 'irregular',
    colSpacing: 2.6,
    windowWidth: 1.5,
    windowHeightFrac: 0.58,
    pilasters: false,
    spandrelHeight: 0.16,
    cornice: { project: 0.28, height: 0.4 },
    ground: 'recessed',
    materials: [3, 3, 2],
  },
];

/**
 * RETAIL IS A PROPERTY OF THE STREET, NOT OF THE DECADE — session 28 for the
 * streamed city, session 30 for this block, and the block is where the operator
 * has been standing the whole time.
 *
 * `era.ground` decided both what a ground floor LOOKS like and whether it is
 * LIT. Those are independent facts: the architecture is when the building went
 * up, the commerce is which street it stands on. Session 28 separated them in
 * `citygen.js`; this is the same separation here, and it had to be made twice
 * because the two files are two content paths and always have been.
 *
 * THE BRIEF SAID TO CHECK WHETHER THE ERA TABLES EVEN MATCH BEFORE ASSUMING THE
 * SAME CHANGE APPLIES. **They do**, and more than the brief expected: this
 * file's `ERAS` carries prewar/shopfront, postwar/blankPlinth,
 * corporate/colonnade and infill/recessed — the same four ids against the same
 * four treatments `CITY_ERAS` uses. What is NOT the same is how much was
 * already lit. `glazedRun` is called by THREE of the four treatments here, and
 * the fourth already gets a lit service door, so the origin block was at
 * **60% lit ground floors** where the streamed city was at 50.5%. The lever is
 * real and it is smaller than it was in `city.js`.
 *
 * THE UNIT IS A RUN, NOT A SIDE, AND THAT IS THIS FILE'S OWN CORRECTION.
 * Session 28 rolls once per SIDE of each island because an island has four of
 * them. This block has TWO sides, so a per-side roll is a coin flip on the
 * operator's own street — all-or-nothing, which is the mirror of the salt-and-
 * pepper failure session 28 rejected a per-building roll for. But `placeRun`
 * has recorded `b.run` since session 3, and the block has FOUR runs: three
 * buildings west of the cross street and two east of it, per side. A run is
 * bounded by the cross street, which is exactly where a real shopping frontage
 * ends, so it is the right unit for a reason rather than for a count.
 *
 * AND THE ROLL IS A CHOOSE-k, NOT FOUR COIN FLIPS, WHICH IS THE SECOND PLACE
 * SESSION 28'S DESIGN DOES NOT SURVIVE A SAMPLE OF FOUR. This shipped as a
 * per-run Bernoulli at p = 0.55 first, and the delivered street was **5 lit
 * ground floors of 10 against the 6 the model it replaced delivered** — one
 * run of the four traded. The expectation was 7.3 and the draw was 5, which is
 * not a bad seed, it is the estimator: over four runs a Bernoulli count has
 * standard deviation 0.99 on a mean of 2.2, so **one street in eleven has every
 * frontage trading (0.55⁴ = 0.092) and one in twenty-four has none
 * (0.45⁴ = 0.041)**, and the operator has exactly one street.
 *
 * A choose-k draw has the same mean and **zero variance in the count**, and it
 * turns the floor from an expectation into a construction. **k = 2 of 4** is
 * half, which is what *"a shopping street and, round the corner, a terrace with
 * nothing at street level"* means.
 *
 * WHAT SURVIVES ON A RUN THAT DOES NOT TRADE IS THE SHOPFRONT ERA, AND THAT IS
 * THIS FILE'S SECOND CORRECTION TO SESSION 28'S RULE. Session 28 keeps the
 * CORNER unit — *"at the end of the run where the cross street is"* — and that
 * shipped here first. The count it delivered was fine and the FRAME was not:
 * at this seed the two runs that traded were both west of the crossing, so the
 * operator's own pose at x = 70 looking west LOST the lit shopfront nearest him
 * (b9, 20.6 m from the camera) and GAINED two frontages 100–160 m away. The
 * before/after pair at his own pose is a street that got darker where he stands
 * — 8 of 10 lit by count, and a regression in the picture. CONTRACT §7.2 with a
 * retail roll instead of a body type: **a count of lit frontages is not a
 * measurement of the light in front of the camera.**
 *
 * So the exception is a statement about the architecture instead of about the
 * geometry: **a prewar SHOPFRONT is a shop.** Its ground floor is a shop unit,
 * tall glazed bays between slender piers with a stallriser, and it has no other
 * use — a run of them with the lights off is a dead high street rather than a
 * terrace. A blank plinth, a colonnade and a recessed front are all buildings
 * whose ground floor MAY be let, and those are the three the roll decides. Over
 * runs of 3, 2, 3 and 2 carrying three shopfronts:
 *
 *     lit  =  (the two trading runs)  +  (the shopfronts on the other two)
 *
 * ENUMERATED OVER ALL SIX PAIRINGS RATHER THAN ARGUED, because the first
 * version of this paragraph argued it and was wrong. Runs are R0={b0,b1,b2},
 * R1={b3,b4}, R2={b5,b6,b7}, R3={b8,b9}; the three shopfronts are b2 in R0, b3
 * in R1 and b9 in R3, so **R2 has none**:
 *
 *     {R0,R1} 6    {R0,R2} 8    {R0,R3} 6
 *     {R1,R2} 7    {R1,R3} 5    {R2,R3} 7
 *
 * **FLOOR 5, CEILING 8.** The floor is FIVE and not six, and the reason the
 * first draft said six is instructive: it wrote *"2+2+1 = 5 cannot occur,
 * because the three shopfronts sit in three different runs"*, which is not
 * sufficient — three shopfronts in three runs only guarantees at least ONE in
 * the dark pair. What decides the bound is WHICH run has none, and here it is
 * a three-building run, so both two-building runs carry a shopfront and
 * trading exactly those two leaves 2+2+1. Had the empty run been a
 * two-building one every pairing would give 6 or 7. **The floor is therefore a
 * property of this seed's era draw and not of the construction**, and saying
 * otherwise was a bound asserted in prose with no check behind it — CONTRACT
 * §9.1's own class, twice recorded. The ceiling of 8 is right, so a dark
 * stretch exists in every draw and the uniformly-interesting street
 * `docs/authored-city.md` §5 names is unreachable rather than merely unlikely.
 * The delivered draw at seed 1337 is {R0,R2} = **8**.
 *
 * IT RE-PHASES NOTHING, AND THAT IS A CONSTRUCTION RATHER THAN A HOPE. The roll
 * is on its own named stream (CONTRACT §6). The lit/unlit decision does NOT
 * change how many numbers `block:windows` draws: a bay that does not trade is
 * still GLAZED and still consumes the same two draws, and what changes is which
 * material its panes are pushed into. An untraded shopfront is glass with
 * nothing on behind it, which is what an empty shop looks like anyway — and it
 * means the upper facade of every building in this block is bit-identical
 * whatever the frontages roll.
 */
const BLOCK_RETAIL = {
  /**
   * How many of the block's four runs trade. A COUNT, not a probability —
   * bounded above and below in the header, and the bound is a construction
   * rather than an expectation because four is too small a sample to have one.
   */
  tradingRuns: 2,
  /**
   * CLUSTERED LIGHT SLOTS THIS FILE MAY SPEND ON SHOPFRONTS, and it is an
   * arithmetic rather than a budget: `tools/budget.json` → `lightRoles
   * .ceilings.block` is **60**, this file delivers **32** lamp beams and **5**
   * sign lights, and 60 − 32 − 5 = **23**. A module may not import a gate's
   * contract (CONTRACT §2.2), so this is the `HUD.budgets` arrangement — a copy
   * that is CHECKED rather than trusted, and what checks it is `perfcheck`'s
   * own role census going red and naming the role if any of the three numbers
   * drifts.
   *
   * It binds for the first time this session: before the decoupling the block
   * delivered 15 shop lights against 23, and a street where all four frontages
   * trade wants more than that.
   */
  shopLightSlots: 23,
  /**
   * A punched sockel opening: width, height, and metres of frontage per
   * opening. A blank plinth that trades does not become a shopfront — it gets
   * HOLES CUT IN ITS BASE, which is session 28's own word for the blankPlinth
   * variant and is what a 1960s slab looks like when the ground floor is let.
   * 4.6 m of pitch over a 16.7–23.3 m elevation gives three to five of them.
   */
  punchW: 1.15,
  punchH: 2.05,
  punchPitchM: 4.6,
};

/**
 * ITEM 3c — THE ADVERTISING PILLARS, ON THE BLOCK'S OWN PAVEMENT.
 *
 * SHIPPED, AND ITEM 0 SAID IT COULD NOT BE. That estimate is the session's own
 * largest error and it is recorded rather than quietly corrected, because it is
 * CONTRACT §9's failure mode committed inside the instrument written to avoid
 * it (§7.7). `blockprobe.mjs` reports every emitter as an AREA times a
 * RADIANCE; item 0 calibrated four slopes of that product against
 * `band:midnight` by zeroing known emitters, and predicted that nine pillars
 * at 29 993 m2*cd/m2 would cost **+0.0066** of a 0.0027 headroom — over by
 * 2.4x on the most generous of the four and by 6x on the tightest.
 *
 * MEASURED: **+0.0004**. The estimate was 16x high.
 *
 * WHY, AND THE INSTRUMENT'S OWN HEADER SAYS IT: *"that product is NOT a
 * luminance and does not predict a mean on its own"*. The quantity a frame mean
 * responds to is PROJECTED SOLID ANGLE, and the four calibration points were
 * all emitters that are either numerous and spread across the whole frame (558
 * lit windows) or bright, large in the image and close (sixteen lamp bowls at
 * 8.4 m). A 0.87 x 2.55 m panel standing against a building 40 to 160 m down
 * the street, seen nearly edge-on from a camera on the crown of the road, is
 * neither. Area times radiance was computed correctly and used as a different
 * quantity.
 *
 * WHAT IT DELIVERS. Nine pillars of ten candidate stations — one refused
 * against a lamp column — spaced by the streamed city's own rule
 * (`round(faceWidth / perFrontageM)` at 19 m) over 214.0 m of frontage across
 * ten buildings of 16.72 to 27.32 m. Two emissive faces each at the streamed
 * city's own `PILLAR_FACE_NITS`, so the two content paths cannot end up
 * describing one object with two radiances the way the lamp bowl did for
 * twenty-five sessions.
 *
 * THERE IS NO `conflict()` HERE AND THAT IS A FACT ABOUT THIS FILE RATHER THAN
 * AN OMISSION: **the origin block has no occupancy registry.** It owns
 * everything inside `BLOCK_KEEPOUT` — the streamed city refuses to place
 * anything there — so what a pillar must miss is this file's own `occluders`
 * list and its sixteen lamp columns, and that is what it is tested against,
 * before it is drawn, and refused rather than moved.
 */
const AD_PILLAR_BLOCK = {
  /** Session 30's bisecting switch for this content, in the `?quayLamps` shape. */
  enabled: true,
  standoff: 2.6,
  baseAlong: 1.40, baseDeep: 0.74, baseH: 0.18,
  colAlong: 1.04, colDeep: 0.44, colH: 3.40,
  browH: 0.14,
  faceH: 2.55, faceFrac: 0.84,
  /** cd/m², the streamed city's own `PILLAR_FACE_NITS`. */
  faceNits: 748,
  /** Metres of frontage per pillar — `AD_PILLAR.perFrontageM`. */
  perFrontageM: 19.0,
};

export function createBlock(options = {}) {
  const cfg = { ...BLOCK, ...options };

  const disposables = [];
  const root = new THREE.Group();
  root.name = 'block';

  let shopLights = [];
  let lampLights = [];
  let signLights = [];
  let lampMaterial = null;
  let shopMaterials = [];
  let windowMaterials = [];
  let lampsOn = null;

  function track(x) {
    disposables.push(x);
    return x;
  }

  function surfaceMaterial(ctx, { color, roughness, metalness = 0 }) {
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      // Below ~0.05 a GGX lobe becomes a sub-pixel spike that half-float cannot
      // hold and that bloom turns into a permanent white dot.
      roughness: Math.max(0.05, roughness),
      metalness,
      envMapIntensity: 1,
    });
    ctx.get('lights').patch(m);
    return track(m);
  }

  /**
   * @param roughness  Glass, not black card. By day the emissive is invisible
   *   against 100 klx and all that is left is the base, which had better
   *   reflect the sky or every facade becomes a grid of holes. Session 1 had
   *   this at 0.28 with metalness 0.05, and 0.28 is a satin finish: the noon
   *   frame's windows were flat navy rectangles because a satin surface has no
   *   sharp reflection to give. Real float glass is 0.02-0.05 rough and a pure
   *   dielectric — the reflection comes from Fresnel at grazing incidence, and
   *   any metalness at all tints it with the pane's own colour, which glass
   *   does not do.
   */
  function emissiveMaterial(ctx, { chroma, nits, color = 0x16181c, roughness = 0.075, metalness = 0.0 }) {
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness,
      metalness,
    });
    m.emissive.setRGB(chroma[0], chroma[1], chroma[2], THREE.LinearSRGBColorSpace);
    m.emissiveIntensity = nits;
    ctx.get('lights').patch(m);
    return track(m);
  }

  return {
    name: 'block',
    needs: ['lights', 'lighting'],

    init(ctx) {
      /**
       * CONTRACT §6's `river` switch, read HERE rather than branched inside the
       * geometry below, because it decides exactly one thing: whether the earth
       * plane has the river cut out of it. See the ground mesh.
       */
      const riverEnabled = String(ctx.config.river ?? 1) !== '0';
      const rngLayout = ctx.rng('block:layout');
      const rngWindows = ctx.rng('block:windows');
      const rngSigns = ctx.rng('block:signs');
      const lights = ctx.get('lights');

      // ---- materials ------------------------------------------------------

      /**
       * Asphalt is dark and, at the grazing angles a standing camera sees it
       * at, surprisingly specular: Fresnel takes a dielectric to near-total
       * reflectance past 80° of incidence.
       *
       * Session 1's colour was 0x4f4f55, which has more blue in it than red.
       * Bitumen and crushed aggregate do not: a dry road is a warm-neutral
       * grey, and half of "the noon road is navy" was the road's own albedo
       * agreeing with the sky rather than arguing with it. The reflectance is
       * unchanged — 0.09 linear, which is what a weathered carriageway
       * measures — only the chromaticity is corrected.
       *
       * Roughness rises from 0.66 to 0.70 because the procedural grain now
       * varies it by ±0.1 and because water, not dry asphalt, is what makes a
       * road mirror-like. The wet variant is a roughness change, not a
       * different material.
       */
      const matAsphalt = surfaceMaterial(ctx, { color: 0x55524d, roughness: 0.7 });
      const matAsphaltWorn = surfaceMaterial(ctx, { color: 0x5e5a53, roughness: 0.66 });
      /** Cast concrete paving: 0.26 linear, mid-range for a weathered slab. */
      const matPavement = surfaceMaterial(ctx, { color: 0x8b8780, roughness: 0.9 });
      const matKerb = surfaceMaterial(ctx, { color: 0x99958e, roughness: 0.84 });
      /**
       * Road paint — session 45. `ROAD_PAINT.albedo` is LINEAR and carries its
       * own derivation in `constants.js`; `city.js` reads the same object, so
       * the paint on this street and the paint three chunks away cannot become
       * two different whites.
       */
      const matMarking = surfaceMaterial(ctx, { color: 0xffffff, roughness: ROAD_PAINT.roughness });
      matMarking.color.setRGB(
        ROAD_PAINT.albedo[0], ROAD_PAINT.albedo[1], ROAD_PAINT.albedo[2],
        THREE.LinearSRGBColorSpace,
      );
      /**
       * The world's earth plane. `GROUND.earthAlbedo` is LINEAR and carries the
       * derivation — it is the area-weighted mean of the city's own drawn
       * ground, and it replaced 0x4a4640, which had none and was half as bright
       * and a third redder. Session 42.
       */
      const matGround = surfaceMaterial(ctx, { color: 0xffffff, roughness: 0.95 });
      matGround.color.setRGB(
        GROUND.earthAlbedo[0], GROUND.earthAlbedo[1], GROUND.earthAlbedo[2],
        THREE.LinearSRGBColorSpace,
      );
      /**
       * THE BACK OF THIS BLOCK — SESSION 51. `GROUND.coreAlbedo` is the same
       * triple `city.js` surfaces every other `built` island's core with, and
       * the two meet at `BLOCK_KEEPOUT.x1`. Roughness is the streamed core's
       * own 0.9: a service court is laid in the same weathered slab the
       * pavement is, which is why it is `matPavement`'s number and not
       * asphalt's.
       */
      const matCore = surfaceMaterial(ctx, { color: 0xffffff, roughness: 0.9 });
      matCore.color.setRGB(
        GROUND.coreAlbedo[0], GROUND.coreAlbedo[1], GROUND.coreAlbedo[2],
        THREE.LinearSRGBColorSpace,
      );

      /**
       * ONE facade material, and it is white.
       *
       * Session 1 authored five greys and picked one per building; session 2
       * replaced them with one grey and a per-instance hue offset. Neither
       * scaled and neither read: five tones is a palette, and a hue offset on
       * one tone is a palette with more steps.
       *
       * This material's own colour is linear (1, 1, 1) and its own roughness is
       * a placeholder, because both are supplied per instance — the albedo
       * through `instanceColor`, which three multiplies into `diffuseColor` in
       * its own chunk, and the roughness through a `noctisRough` instanced
       * attribute that the patched shader reads. So `instanceColor` *is* the
       * albedo rather than a multiplier on one, which means the gate can read
       * the buffer and see the number the GPU sees, with no product to
       * reconstruct.
       *
       * One material means one draw call per element type no matter how many
       * materials the city contains. Four materials would be four
       * InstancedMeshes per element type — twenty-four draw calls for this
       * block instead of six, and the same multiplier at a thousand buildings.
       */
      const matFacade = surfaceMaterial(ctx, { color: 0xffffff, roughness: 0.8 });
      /**
       * Shopfront glazing behind the lit panes, and the dark glass of a closed
       * unit. A pure smooth dielectric: metalness on glass tints its reflection
       * with the pane colour, and glass does not do that.
       */
      const matDarkGlass = surfaceMaterial(ctx, { color: 0x1a1e24, roughness: 0.07, metalness: 0.0 });
      /** Galvanised steel. Metalness is a material class, not a dial: 1 or 0. */
      const matMetal = surfaceMaterial(ctx, { color: 0x53525a, roughness: 0.38, metalness: 1.0 });

      /**
       * ═════════════════════════════════════════════════════════════════════
       * THE COLD ONE WAS NOT COLD — LOOK.md §3, SESSION 32.
       * ═════════════════════════════════════════════════════════════════════
       *
       * This block already had four window kinds and one of them was called
       * `windowCold`, so on a reading of the code the origin block was 15.95%
       * of panes and 25.8% of emitted light cold, and LOOK.md §3's complaint
       * did not apply to it. THE FRAME SAYS OTHERWISE, and the arithmetic says
       * why: `fluorescentCold` is [0.80, 0.92, 1.0], which normalises to
       * [0.889, 1.022, 1.111] and carries **R−B = −0.111**. Against a 2450 K
       * pane at **+0.938** that does not read as another colour of light. It
       * reads as grey.
       *
       * And the slot it was filling was already occupied. `fluorescentDirty`
       * at [0.86, 1.0, 0.80] is 29% of the panes and is the pale, neutral,
       * slightly-green thing a cool office window looks like from across a
       * street. So this block had **two near-neutral classes and no cold one**,
       * and the name on the second one is why nobody looked.
       *
       * `mercuryBlue` [0.30, 0.55, 1.0] normalises to [0.567, 1.039, 1.889] —
       * **R−B = −0.538**, five times the separation. Old mercury-vapour stair
       * and landing lighting, still in service in 2049 in the buildings nobody
       * has re-fitted, and the one lamp in the real world that is genuinely
       * cyan without being a sign. `windowCold` is also the BRIGHTEST of the
       * four at 30 nits, so the colour that arrives is the one that carries.
       *
       * NOT a fifth material. Five window kinds is a fifth `InstancedMesh` on
       * a block that is in every gate frame, and the draw-call ceiling is at
       * 430 of 440. This is a chroma swap on a material that already exists:
       * zero meshes, zero draw calls, zero instances. `windowDirty` keeps the
       * neutral role it was always doing.
       */
      windowMaterials = [
        emissiveMaterial(ctx, { chroma: kelvinToLinearRGB(2450), nits: EMISSIVE.windowWarm }),
        emissiveMaterial(ctx, { chroma: EMITTER_CHROMA.fluorescentDirty, nits: EMISSIVE.windowDirty }),
        emissiveMaterial(ctx, { chroma: EMITTER_CHROMA.mercuryBlue, nits: EMISSIVE.windowCold }),
        emissiveMaterial(ctx, { chroma: EMITTER_CHROMA.sodium, nits: EMISSIVE.windowDim }),
      ];
      /**
       * The unlit ones. authored-city.md §2: a row where every window is on is
       * the strongest tell that nobody lives there.
       *
       * "Unlit" is not "black". Real dark glass at night carries a hallway
       * light, a standby LED, a television two rooms away, and reflects the
       * street back at you. Modelled as dirty glass with a trace of interior
       * emission — without it these panes are the single largest source of
       * pure-black pixels in the night frame.
       */
      const matWindowOff = emissiveMaterial(ctx, {
        chroma: kelvinToLinearRGB(2900),
        nits: 1.1,
        color: 0x2b2f36,
        roughness: 0.3,
        metalness: 0.08,
      });

      // Four kinds of open shop with a four-to-one spread of brightness, so a
      // row of bays reads as separate businesses rather than one lit ribbon.
      shopMaterials = [
        emissiveMaterial(ctx, { chroma: SHOP_CHROMA[0], nits: EMISSIVE.shopBright }),
        emissiveMaterial(ctx, { chroma: SHOP_CHROMA[1], nits: EMISSIVE.shopWarm }),
        emissiveMaterial(ctx, { chroma: SHOP_CHROMA[2], nits: EMISSIVE.shopCold }),
        emissiveMaterial(ctx, { chroma: SHOP_CHROMA[3], nits: EMISSIVE.shopDim }),
      ];
      const matShutter = surfaceMaterial(ctx, { color: 0x6a6660, roughness: 0.58, metalness: 0.2 });
      /**
       * Item 3c's arm. A DISPLAY PANEL at the streamed city's own
       * `PILLAR_FACE_NITS`, so the two paths cannot describe the same object
       * with two radiances the way the lamp bowl did for twenty-five sessions.
       */
      const matPillarFace = emissiveMaterial(ctx, {
        chroma: SHOP_CHROMA[2],
        nits: AD_PILLAR_BLOCK.faceNits,
        color: 0x16181c,
        roughness: 0.05,
      });
      /**
       * ITEM 4. The backlit timetable case, at `BUS_STOP.panelNits` — the
       * STREAMED CITY'S OWN NUMBER, imported rather than authored here, for the
       * reason `LAMP_BOWL` exists at all: one object described in two files
       * with two radiances is CONTRACT §9's own class and this project carried
       * one for twenty-five sessions.
       */
      const matTimetable = emissiveMaterial(ctx, {
        chroma: EMITTER_CHROMA.fluorescentCold,
        nits: BUS_STOP.panelNits,
        color: 0x1a1d22,
        roughness: 0.08,
      });
      const matShopFrame = surfaceMaterial(ctx, { color: 0x35322e, roughness: 0.55, metalness: 0.25 });
      lampMaterial = emissiveMaterial(ctx, {
        chroma: EMITTER_CHROMA.sodium,
        nits: LAMP_BOWL.originNits,
        color: 0x121212,
        roughness: 0.5,
        metalness: 0,
      });
      /** Tagged for `harness.lampBowlCensus()` — session 28. See city.js. */
      lampMaterial.userData.noctisLampPath = 'origin';

      // ---- ground, road, sidewalk ----------------------------------------

      const halfStreet = cfg.streetWidth / 2;
      const halfCross = cfg.crossStreetWidth / 2;
      const walkOuter = halfStreet + cfg.sidewalkWidth;

      /**
       * THE WORLD'S EARTH PLANE, WITH THE RIVER CUT OUT OF IT.
       *
       * This one mesh is the bare ground under everything — 8 km square at
       * y = −0.02, under the block's own road, under every chunk the streaming
       * city builds, and out to the horizon past both. Session 15 puts a river
       * 4.99 m below it, and a plane above water hides water: the earth had to
       * gain a hole or the river would be a river nobody could see.
       *
       * IT IS CUT ALONG THE BANK AND NOT ALONG A RECTANGLE. The envelope is a
       * straight band 147.6 m wide and the water inside it is a curve, so a
       * rectangular hole would leave up to 43 m of open void between the earth's
       * edge and the water's — a slot of nothing along both banks for the whole
       * length of the river. Cutting on the bank itself costs one mesh either
       * way, because the earth is emitted as a quad strip on the SAME station
       * lattice `river.js` builds the water and the quay wall from
       * (`RIVER.bankStationM`), so the three edges are the same polyline and
       * cannot crack apart.
       *
       * `?river=0` gets the plain plane back. That is CONTRACT §6's bisecting
       * switch and it is the arm the river's frame-time cost is measured
       * against: with the hole left in, arm B would be shading a void where arm
       * A shades water, and the difference would be the hole rather than the
       * river.
       *
       * WINDING, DERIVED HERE RATHER THAN GUESSED (CONTRACT §9.1). A quad
       * (A0, B1, B0) with A0 = (xA, zN(A)), B0 = (xB, zN(B)), B1 = (xB, zS(B)),
       * xB > xA and zS > zN has e1 = B1 − A0 = (dx, 0, p) and
       * e2 = B0 − A0 = (dx, 0, q); e1 × e2 = (0, dx·(p − q), 0) and
       * p − q = zS(B) − zN(B) > 0, so the face normal is +Y. The second
       * triangle (A0, A1, B1) gives (0, dx·(zS(A) − zN(A)), 0), also +Y. Both
       * front faces point up, which is what `materials.ground`'s FrontSide
       * needs and what `buildGround` in city.js got wrong for thirteen
       * sessions.
       */
      const groundGeo = new THREE.BufferGeometry();
      {
        const E = cfg.groundExtent;
        const pos = [];
        // `GROUND.earth`, not a literal: this plane is the reference the whole
        // datum is stated against (constants.js → GROUND), and it was the same
        // −0.02 in four places across two files until session 19.
        const EY = GROUND.earth;
        const quad = (xa, za0, za1, xb, zb0, zb1) => {
          if (za1 - za0 <= 0 || zb1 - zb0 <= 0) return;
          pos.push(xa, EY, za0, xb, EY, zb1, xb, EY, zb0);
          pos.push(xa, EY, za0, xa, EY, za1, xb, EY, zb1);
        };

        /**
         * AND THE SUNKEN LANDMARKS GET THE SAME TREATMENT AS THE RIVER —
         * SESSION 34, AND IT IS THIS COMMENT'S OWN ARGUMENT ARRIVING NINETEEN
         * SESSIONS LATE.
         *
         * *"A plane above water hides water"* is the sentence above. A plane
         * above a **9 m stormwater basin** hides the basin, and it has:
         * `city.js` lathes the weir from +0.40 m to −9.40 m and this plane sits
         * across it at −0.02, so **9.40 m of 9.80 — 96% — has never reached a
         * frame**. What the frame shows instead is 44 100 m² of flat earth with
         * a thin white arc on it, which is the 0.42 m of retaining ring that
         * stands proud, and that arc is STATE §11's *"unexplained ground arc
         * near the origin"* carried as a known gap since session 8.
         *
         * CUT ON THE RIM AND NOT ON THE AABB, for exactly the reason the river
         * is cut on the bank: a 210 × 210 m rectangular hole around a 105 m
         * circle leaves **9 464 m² of open void in the four corners** — 21% of
         * the claim — which is the *"slot of nothing"* this comment already
         * refuses for the river, in four triangles instead of two strips.
         *
         * The stations are the LATHE'S OWN vertices (`basinRimStations`), so
         * the cut edge and the drawn rim are the same polyline and cannot crack
         * apart. `?river=0` still gets the river's plane back; the basin's hole
         * is in both arms, because it is not the river's cost.
         */
        const basins = sunkenLandmarks();
        const rims = basins.map((l) => basinRimStations(l));
        /** The removed z-interval of basin `k` at x, or null outside its span. */
        const rimBandAt = (k, x) => {
          const st = rims[k];
          if (x < st[0].x || x > st[st.length - 1].x) return null;
          for (let i = 0; i < st.length - 1; i++) {
            if (x < st[i].x || x > st[i + 1].x) continue;
            const a = st[i];
            const b = st[i + 1];
            const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
            return { north: a.north + (b.north - a.north) * t, south: a.south + (b.south - a.south) * t };
          }
          return null;
        };

        /**
         * One station list for both cuts. The river's stations are anchored at
         * `i · RIVER.bankStationM` and a basin's are at its own lathe angles, so
         * the union is what a trapezoid strip needs: every vertex of every cut
         * edge is a station, and between two stations both edges are straight.
         */
        const xs = new Set();
        if (riverEnabled) for (const s of riverBankStations(-E, E)) xs.add(s.x);
        xs.add(-E);
        xs.add(E);
        for (const st of rims) for (const s of st) xs.add(s.x);
        const stations = [...xs].filter((x) => x >= -E && x <= E).sort((a, b) => a - b);

        for (let i = 0; i < stations.length - 1; i++) {
          const xa = stations[i];
          const xb = stations[i + 1];
          /**
           * The intervals removed at each end, PAIRED and in the same order at
           * both. A cut present at one end and absent at the other would pair a
           * trapezoid against nothing; a basin's own extreme station is in the
           * list, and there its band is a single point, so the pairing is
           * always well formed and the end trapezoid degenerates to zero width.
           */
          const cuts = [];
          if (riverEnabled) {
            const ea = riverEdges(xa);
            const eb = riverEdges(xb);
            cuts.push([{ north: ea.north, south: ea.south }, { north: eb.north, south: eb.south }]);
          }
          for (let k = 0; k < basins.length; k++) {
            const ba = rimBandAt(k, xa);
            const bb = rimBandAt(k, xb);
            if (!ba && !bb) continue;
            const pt = (b) => b || { north: basins[k].z, south: basins[k].z };
            cuts.push([pt(ba), pt(bb)]);
          }
          cuts.sort((p, q) => p[0].north - q[0].north);
          let za = -E;
          let zb = -E;
          for (const [ca, cb] of cuts) {
            quad(xa, za, ca.north, xb, zb, cb.north);
            za = ca.south;
            zb = cb.south;
          }
          quad(xa, za, E, xb, zb, E);
        }
        const arr = new Float32Array(pos);
        groundGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        const nrm = new Float32Array(arr.length);
        for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
        groundGeo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
        groundGeo.computeBoundingSphere();
      }
      const ground = new THREE.Mesh(track(groundGeo), matGround);
      ground.position.y = 0;
      ground.receiveShadow = true;
      // The bound is the whole world; culling it is a wasted test that can only
      // ever answer "visible".
      ground.frustumCulled = false;
      ground.name = 'block:ground';
      root.add(ground);

      /**
       * ═══════════════════════════════════════════════════════════════════════
       * THE BACK OF THE BLOCK, WHICH HAS BEEN THE EARTH PLANE FOR FIFTY-ONE
       * SESSIONS — SESSION 51. IT IS THE OPERATOR'S FIRST DEFECT.
       * ═══════════════════════════════════════════════════════════════════════
       *
       * Two of the four positions he walked to after session 50 printed
       * `on earth at y -0.020` — the plane above — INSIDE the city:
       *
       *     ?player=1&spawn=109.94,52.24,-13.60&t=0.5904&seed=1337
       *     ?player=1&spawn=146.89,34.75,-23.32&t=0.6059&seed=1337
       *
       * BOTH ARE IN HERE, and `tools/surfacegrid.mjs` says how much of the city
       * is: **1.68 ha, 58.2% of all the bare ground a person can reach in the
       * resident ring**, in FOUR patches each 162 x 34 m. It is the largest
       * single gap in the world and it is at the origin, which is where the
       * player spawns and where every calibration camera stands.
       *
       * THE MECHANISM IS TWO CORRECT DECISIONS MEETING. `city.js` clips every
       * streamed ground quad out of `BLOCK_KEEPOUT` — 336 x 92 m — *"so that
       * this one wins"*, which is `blockSurfaceAt`'s own comment and is right:
       * the block authors its own street. And what this module authored was a
       * street CROSS: a carriageway, a cross street and four pavement boxes.
       * The four quadrants BEHIND the kerb were authored by nobody, and the
       * only thing left under them is the 8 km earth plane.
       *
       * SO IT IS NOT A NEW SURFACE, IT IS THE MISSING HALF OF ONE. Every other
       * `built` island in this city has a core — `citygen.js` emits
       * `coreGround` over the island inside its perimeter ring and `city.js`
       * lays it at `GROUND.carriageway` in `GROUND.coreAlbedo`, which is 40.96%
       * of all the ground the city draws. The origin block is a `built` block.
       * It gets the same core, at the same height, in the same reflectance,
       * read from the same constant — so the seam at `BLOCK_KEEPOUT.x1` = 168,
       * where this surface meets the streamed one, cannot be a seam.
       *
       * FOUR QUADS AND ONE DRAW CALL. The extent is DERIVED from the four
       * numbers the street is built from rather than transcribed: outside the
       * cross street in x, outside the pavement in z, in to the keep-out's own
       * edges. `halfCross` and `walkOuter` are the same two the pavement boxes
       * and `blockSurfaceAt` use, so widening the street moves the core with
       * it. Nothing is cut around the ten buildings: a surface under a building
       * is hidden by the building, and the four rectangles are 8 triangles
       * where a cut would be dozens.
       *
       * WHY IT DOES NOT Z-FIGHT WITH ANYTHING. It is at `GROUND.carriageway`,
       * the datum, and it shares an EDGE with all three surfaces it meets and
       * an area with none: the main street ends at `halfStreet` and the
       * pavement carries on to `walkOuter`, where this begins; the cross street
       * ends at `halfCross`, where this begins. The pavement's top is
       * `kerbHeight` above it, which is a kerb and is what you step down.
       */
      const CORE_QUADS = [];
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const x0 = sx < 0 ? BLOCK_KEEPOUT.x0 : halfCross;
          const x1 = sx < 0 ? -halfCross : BLOCK_KEEPOUT.x1;
          const z0 = sz < 0 ? BLOCK_KEEPOUT.z0 : walkOuter;
          const z1 = sz < 0 ? -walkOuter : BLOCK_KEEPOUT.z1;
          if (x1 <= x0 || z1 <= z0) continue;
          CORE_QUADS.push({ x0, x1, z0, z1 });
        }
      }
      {
        const CY = GROUND.carriageway;
        const pos = [];
        for (const q of CORE_QUADS) {
          /**
           * WINDING, DERIVED THE SAME WAY THE EARTH PLANE'S IS. For a quad
           * (x0,z0), (x1,z1), (x1,z0) with x1 > x0 and z1 > z0:
           * e1 = (dx, 0, dz), e2 = (dx, 0, 0), e1 x e2 = (0, dx*dz, 0) = +Y.
           * The second triangle (x0,z0), (x0,z1), (x1,z1) gives the same sign.
           * `windcheck` reads authored normal against triangle facing over
           * every generated mesh, so this is derived rather than tried.
           */
          pos.push(q.x0, CY, q.z0, q.x1, CY, q.z1, q.x1, CY, q.z0);
          pos.push(q.x0, CY, q.z0, q.x0, CY, q.z1, q.x1, CY, q.z1);
        }
        const geo = new THREE.BufferGeometry();
        const arr = new Float32Array(pos);
        geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        const nrm = new Float32Array(arr.length);
        for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
        geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
        geo.computeBoundingSphere();
        const core = new THREE.Mesh(track(geo), matCore);
        core.receiveShadow = true;
        core.name = 'block:core';
        root.add(core);
      }

      /**
       * ═════════════════════════════════════════════════════════════════════
       * THE MAIN STREET, AND PAST THE CITY'S EDGE IT BENDS — SESSION 62.
       * ═════════════════════════════════════════════════════════════════════
       *
       * IT WAS `PlaneGeometry(groundExtent * 2, streetWidth)` — one 8 km
       * rectangle, two triangles, dead straight from rim to rim. Session 61
       * painted a centre line on the far half of it and the operator's verdict
       * on the frame was that *"the road runs straight through the fields in
       * the same lattice as downtown"*. It did. The one road in this world
       * that leaves the grid was the straightest object in it.
       *
       * `citygen.js` → `EXIT_ROAD` carries the whole derivation: a curvature
       * schedule bounded by a 100 km/h design radius, a 1:50 taper from the
       * arterial's 15.0 m to a country road's 7.0 m, and 768 m of world to do
       * it in. THIS FILE DRAWS IT AND DECIDES NOTHING. `exitRoadZ`,
       * `exitRoadHalfM` and `exitRoadYawDeg` are the only description; the
       * markings below, `blockSurfaceAt`, the registry's `carriageway` claim
       * and the countryside's field cut all read the same three functions, so
       * there is no second road anywhere (CONTRACT §9.1).
       *
       * A STRIP, AND IT IS THE SAME ONE DRAW CALL. `matAsphalt` is unchanged
       * and the mesh keeps its name, so nothing downstream can tell the
       * difference except by looking. **193 quads against 1**: one for the
       * straight middle between the two extents, and 96 a side at
       * `EXIT_ROAD.stationM` = 8 m — **+384 triangles** against the 40 000 this
       * session has spare, and this is the one piece of it that every gate
       * route pays for, because the origin block is resident everywhere.
       *
       * WINDING, DERIVED HERE AND NOT TRIED, exactly as the earth plane above
       * derives its own: for a quad (xa, za0), (xb, zb1), (xb, zb0) with
       * xb > xa, za1 > za0 and zb1 > zb0, e1 = (dx, 0, zb1 − za0) and
       * e2 = (dx, 0, zb0 − za0), so e1 × e2 = (0, dx·(zb1 − zb0), 0) — +Y. The
       * second triangle (xa, za0), (xa, za1), (xb, zb1) gives
       * (0, dx·(za1 − za0), 0), also +Y. Both front faces point up, which is
       * what `matAsphalt`'s FrontSide needs.
       */
      const roadGeo = new THREE.BufferGeometry();
      {
        const E = cfg.groundExtent;
        const RY = GROUND.carriageway;
        const pos = [];
        /** The stations, west rim to east rim, in increasing x. */
        const xs = [];
        for (let x = -E; x < -CITYGEN_ROAD.startM; x += CITYGEN_ROAD.stationM) xs.push(x);
        xs.push(-CITYGEN_ROAD.startM, CITYGEN_ROAD.startM);
        for (let x = CITYGEN_ROAD.startM + CITYGEN_ROAD.stationM; x < E; x += CITYGEN_ROAD.stationM) xs.push(x);
        xs.push(E);
        for (let i = 0; i < xs.length - 1; i++) {
          const xa = xs[i];
          const xb = xs[i + 1];
          const ca = exitRoadZ(xa);
          const cb = exitRoadZ(xb);
          const ha = exitRoadHalfM(xa);
          const hb = exitRoadHalfM(xb);
          const za0 = ca - ha;
          const za1 = ca + ha;
          const zb0 = cb - hb;
          const zb1 = cb + hb;
          pos.push(xa, RY, za0, xb, RY, zb1, xb, RY, zb0);
          pos.push(xa, RY, za0, xa, RY, za1, xb, RY, zb1);
        }
        const arr = new Float32Array(pos);
        roadGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        const nrm = new Float32Array(arr.length);
        for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
        roadGeo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
        roadGeo.computeBoundingSphere();
      }
      const roadMain = new THREE.Mesh(track(roadGeo), matAsphalt);
      /**
       * THE DATUM ITSELF. `constants.js` → `GROUND.carriageway` = 0, and this
       * 8 km ribbon is the surface that sentence is about: it has sat at exactly
       * zero over an earth plane at −0.02 since session 1, without z-fighting,
       * which is the only evidence anywhere in the project for the 0.020 m
       * separation the streamed city now also uses. It is baked into the strip's
       * own vertices now rather than carried on the mesh's transform, so a
       * reader of the geometry and a reader of `blockSurfaceAt` cannot disagree.
       */
      roadMain.receiveShadow = true;
      roadMain.name = 'block:road:main';
      root.add(roadMain);

      const roadCross = new THREE.Mesh(
        track(new THREE.PlaneGeometry(cfg.crossStreetWidth, 460)),
        matAsphaltWorn
      );
      roadCross.rotation.x = -Math.PI / 2;
      /**
       * The block's own crossing bias, and it is 0.005 rather than the streamed
       * city's `GROUND.crossingBias` = 0.001 because these two are whole PLANES
       * overlapping over 13 × 15 m, not two strips meeting at an edge — a
       * larger coplanar area needs a larger separation at the same depth
       * precision. Kept at its delivered value; the datum it is measured from is
       * the one that moved.
       */
      roadCross.position.y = GROUND.carriageway + 0.005;
      roadCross.receiveShadow = true;
      roadCross.name = 'block:road:cross';
      root.add(roadCross);

      // Sidewalks: four runs along the main street, broken at the intersection.
      /**
       * `cfg.kerbHeight`, NOT A LITERAL 0.16 — session 19, and it was a literal
       * until this line was read.
       *
       * The box was `BoxGeometry(1, 0.16, 1)` while its centre was placed at
       * `cfg.kerbHeight / 2`, so the two agreed only because the constant
       * happened to be 0.16. Change `BLOCK.kerbHeight` to anything else and the
       * pavement's CENTRE moves while its HEIGHT does not, which puts its top
       * at `(kerbHeight + 0.16) / 2` — a pavement whose surface is no longer the
       * kerb height, in the one place in the world with a real kerb, silently.
       * §9.1's "a value in config the code does not read", with a box extent.
       *
       * It is load-bearing now rather than latent: `GROUND.pavement` IS
       * `BLOCK.kerbHeight`, and the streamed city's pavement is emitted at that
       * height, so this box and 25 chunks of quads have to agree.
       */
      const walkGeo = track(new THREE.BoxGeometry(1, cfg.kerbHeight, 1));
      let walkIndex = 0;
      const addWalk = (cx, cz, sx, sz) => {
        const wi = walkIndex++;
        const m = new THREE.Mesh(walkGeo, matPavement);
        m.position.set(cx, cfg.kerbHeight / 2, cz);
        m.scale.set(sx, 1, sz);
        m.receiveShadow = true;
        m.castShadow = true;
        m.name = `block:pavement:${wi}`;
        root.add(m);
        // Kerb edge: a thin lighter strip. At night it is the only line that
        // tells you where the road stops.
        const k = new THREE.Mesh(walkGeo, matKerb);
        k.position.set(cx, cfg.kerbHeight / 2 + 0.005, cz + (cz > 0 ? -sz / 2 + 0.16 : sz / 2 - 0.16));
        k.scale.set(sx, 1.02, 0.32);
        k.receiveShadow = true;
        k.name = `block:kerb:${wi}`;
        root.add(k);
      };

      const walkSpan = 260;
      for (const side of [-1, 1]) {
        const cz = side * (halfStreet + cfg.sidewalkWidth / 2);
        addWalk(-(halfCross + walkSpan / 2), cz, walkSpan, cfg.sidewalkWidth);
        addWalk(halfCross + walkSpan / 2, cz, walkSpan, cfg.sidewalkWidth);
      }

      /**
       * THE BLOCK'S OWN GROUND, HOISTED OUT OF THE API — session 19, so that
       * the sixteen lamp columns below can stand on it.
       *
       * It was a method on the returned api and therefore unavailable to the
       * geometry that had to obey it: `addLamp` put every column's group at
       * `y = 0`, and thirteen of the sixteen stand on a 0.160 m pavement. They
       * were buried by exactly one kerb height in every frame this project has
       * shipped. Two of the remaining three stand over bare earth at −0.020 and
       * were floating 0.020 m; the sixteenth is in the cross-street gap.
       *
       * Hoisting rather than duplicating, because a second copy of these four
       * branches is §9.1 — the api would answer one height and the geometry
       * would stand at another, and the two would be a centimetre apart in a
       * way nobody would think to print.
       */
      const blockSurfaceAt = (x, z) => {
        const az = Math.abs(z);
        const ax = Math.abs(x);
        // Pavement: the four boxes, broken at the cross street.
        if (az >= halfStreet && az <= walkOuter && ax >= halfCross && ax <= halfCross + walkSpan) {
          return { y: cfg.kerbHeight, kind: 'walk', known: true };
        }
        // Cross street, which is laid 0.005 m over the main one where they
        // meet. The same expression `roadCross.position.y` is built from.
        if (ax <= halfCross && az <= 230) {
          return { y: GROUND.carriageway + 0.005, kind: 'road', known: true };
        }
        /**
         * Main street. The strip is `groundExtent * 2` long, so it answers for
         * the whole 8 km ribbon and not only for the block. THE DATUM.
         *
         * AND SINCE SESSION 62 IT IS THE ONE EXPRESSION THAT KNOWS THE ROAD
         * BENDS. `az <= halfStreet` was the whole of it, and it is the sentence
         * STATE 61 §5 predicted would be the entire cost of a road you can WALK
         * on — *"one new function, because the ground query is the one
         * axis-aligned thing left"*. It was not one function anywhere else (the
         * ground pipeline assumes an axis-aligned rectangle in 33 places, see
         * `citygen.js` → `EXIT_ROAD`), but for THIS surface, which `block.js`
         * emits by hand and never puts in a `rects` list, it is exactly one
         * comparison — and both halves of it read the same two functions the
         * strip above is built from, so the geometry and the query cannot
         * disagree about where the road is.
         */
        if (Math.abs(z - exitRoadZ(x)) <= exitRoadHalfM(x) && ax <= cfg.groundExtent) {
          return { y: GROUND.carriageway, kind: 'road', known: true };
        }
        /**
         * THE BACK OF THE BLOCK — session 51, and it is read off `CORE_QUADS`
         * rather than re-derived from `halfCross` and `walkOuter` a second
         * time. The comment over this function is emphatic that a second copy
         * of its branches would be CONTRACT §9.1; that applies to the surface
         * that was just added as much as to the four that were already here.
         *
         * `kind` is `'ground'` and not `'core'`, because that is the word the
         * streamed core answers with: `city.js` maps `coreGround` through
         * `CATEGORY_FOR_GROUND` to the `ground` category and `surfaceAt`
         * returns the category. A walker crossing x = 168 must not see the
         * name of the surface change under them.
         */
        for (const q of CORE_QUADS) {
          if (x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1) {
            return { y: GROUND.carriageway, kind: 'ground', known: true };
          }
        }
        /**
         * AND WHERE THE EARTH HAS A HOLE IN IT, THIS SAYS SO — SESSION 34.
         *
         * The comment over this function is emphatic that a second copy of its
         * branches would be §9.1: *"the api would answer one height and the
         * geometry would stand at another"*. Cutting the basin out of the earth
         * plane above and leaving this line returning −0.02 m is that failure
         * committed by the repair — a walker standing at the old earth height
         * over a hole the same module has just opened.
         *
         * `basinSurfaceAt` reads the lathe's own profile, so this answers the
         * drawn floor, the drawn ledge and the drawn wall rather than a second
         * description of them. Consulted BEFORE `earth` and not after, because
         * inside the rim there is no earth left to be the fallback.
         */
        const basin = basinSurfaceAt(x, z);
        if (basin) return basin;
        return { y: GROUND.earth, kind: 'earth', known: true };
      };

      // ---- buildings ------------------------------------------------------

      const buildings = [];
      const windowInstances = windowMaterials.map(() => []);
      const windowOffInstances = [];
      const pilasterInstances = [];
      const spandrelInstances = [];
      const canopyInstances = [];
      const shopBayInstances = [[], [], [], []];
      /**
       * GLAZED AND UNLIT — session 30. A bay on a frontage that does not trade
       * is not shuttered and it is not a hole: it is the same glass with
       * nothing on behind it, which is both what an empty shop looks like and
       * the reason the lit/unlit decision costs `block:windows` no draw.
       * `matWindowOff`'s own comment already says why "unlit" is not "black".
       */
      const shopBayOffInstances = [];
      const shutterInstances = [];
      /** Openings cut in a trading blank plinth. Counted for `harness.info()`. */
      let plinthOpenings = 0;
      /**
       * REFUSED SHOPFRONT LIGHTS. `BLOCK_RETAIL.shopLightSlots` is this file's
       * share of `lightRoles.ceilings.block`, and a budget that silently drops
       * the light nobody asked about is the failure `lights.js` writes down
       * about its own cap. Counted here and printed in `info()`.
       */
      let shopLightsRefused = 0;
      const shopFrameInstances = [];
      /** Session 3 ground floors: a solid plinth, a colonnade pier, a soffit. */
      const plinthInstances = [];
      const pierInstances = [];
      const soffitInstances = [];
      /** Linear albedo and roughness, one entry per matrix, in the same order. */
      const pilasterSkin = [];
      const spandrelSkin = [];
      const canopySkin = [];
      const plinthSkin = [];
      const pierSkin = [];
      const soffitSkin = [];

      /**
       * A run of buildings filling [xStart, xEnd] exactly, with clumped gaps:
       * most neighbours touching, one or two real breaks. A grid with jitter
       * reads as noise; runs and gaps read as a street that grew (see
       * authored-city.md §1).
       *
       * The count is exact rather than "however many fit". A walk that stops
       * when it runs out of road quietly delivers nine buildings when the brief
       * says ten, and nothing downstream notices.
       */
      /** Which run a building belongs to. Buildings in one run touch; the two
       * runs on a side are separated by the cross street, so the last building
       * of one and the first of the next are not neighbours. */
      let runIndex = 0;
      function placeRun(side, xStart, xEnd, count, heightRange) {
        const widths = [];
        for (let i = 0; i < count; i++) widths.push(rngLayout.range(15, 28));
        let totalW = widths.reduce((a, b) => a + b, 0);
        const span = xEnd - xStart;
        if (totalW > span * 0.92) {
          const k = (span * 0.92) / totalW;
          for (let i = 0; i < count; i++) widths[i] *= k;
          totalW = widths.reduce((a, b) => a + b, 0);
        }

        const gaps = [];
        let gapTotal = 0;
        for (let i = 0; i <= count; i++) {
          const g =
            i === 0 || i === count
              ? rngLayout.range(0.15, 0.8)
              : rngLayout.chance(0.62)
                ? rngLayout.range(0.04, 0.3)
                : rngLayout.range(1.6, 3.4);
          gaps.push(g);
          gapTotal += g;
        }
        const scale = (span - totalW) / gapTotal;

        let x = xStart;
        for (let i = 0; i < count; i++) {
          x += gaps[i] * scale;
          const width = widths[i];
          const depth = rngLayout.range(17, 26);
          const height = rngLayout.range(heightRange[0], heightRange[1]);
          const zFace = side * (walkOuter + rngLayout.range(0.15, 0.9));

          buildings.push({
            x: x + width / 2,
            z: zFace + (side * depth) / 2,
            width,
            depth,
            height,
            side,
            // authored-city.md §3: small, consistent deviation reads as real;
            // large randomness reads as broken. Under three degrees, always.
            yaw: rngLayout.gauss() * 0.7 * DEG,
            run: runIndex,
            /**
             * THREE DRAWS THAT MUST NOT BE REMOVED.
             *
             * Session 1 used `toneStep` to index five authored concrete tones
             * and `pilasters` and `floorHeight` directly. All three are now
             * decided by the building's era instead — but the *draws* stay,
             * because taking one out shifts every subsequent number in
             * `block:layout` and silently rebuilds the street. Same seed, same
             * ten buildings, same widths, same gaps, same heights: session 2
             * changed the light and session 3 changes the skin, and neither is
             * allowed to move a wall.
             *
             * They are not dead. Session 2 made `toneStep` the coarse step of
             * the albedo; session 3 makes `floorHeight` the *within-era* jitter
             * (see below), so the draw still varies the thing it is named
             * after. That is the pattern to follow when a fourth session wants
             * one of these for something else: reinterpret the draw, never
             * delete it.
             */
            toneStep: rngLayout.int(0, 4),
            pilastersDraw: rngLayout.chance(0.6),
            litFraction: rngLayout.range(0.24, 0.66),
            floorHeightDraw: rngLayout.range(3.1, 4.1),
          });

          x += width;
        }
        runIndex++;
      }

      /**
       * Three buildings west of the crossing, two east of it, per side. The
       * western three are the tall ones: the corridor gets taller as it
       * recedes, which closes the far end of the street without a city behind
       * it and gives the perspective something to converge on.
       */
      for (const side of [1, -1]) {
        placeRun(side, -122, -halfCross - 4, 3, [30, 74]);
        placeRun(side, halfCross + 4, 60, 2, [16, 42]);
      }

      /**
       * DOES THIS FRONTAGE TRADE? A choose-k over the RUNS, on its own named
       * stream. See `BLOCK_RETAIL` for the unit, the count and both bounds.
       *
       * On a run that does not trade, what survives is the SHOPFRONT ERA —
       * a ground floor that is a shop unit and has no other use. That is this
       * file's correction to session 28's corner rule, and the header says what
       * the corner rule delivered when it was measured in the frame rather than
       * in the count.
       */
      /**
       * One place that claims a clustered slot for a shopfront, so the cap is
       * enforced once rather than at each of the three call sites. Over budget
       * it REFUSES and counts, never truncates silently — the same discipline
       * `lights.js` applies to `maxClusterLights`.
       */
      const addShopLight = (spec) => {
        if (shopLights.length >= BLOCK_RETAIL.shopLightSlots) { shopLightsRefused++; return; }
        shopLights.push(lights.add({ role: 'block', type: 'point', ...spec }));
      };

      const retailRng = ctx.rng('block:retail');
      const runCount = runIndex;
      /**
       * WHICH runs trade is a shuffle-and-take, so the COUNT is exact and only
       * the identity is random. Fisher-Yates on the run indices; the first
       * `tradingRuns` of them trade.
       */
      const runOrder = [];
      for (let r = 0; r < runCount; r++) runOrder.push(r);
      for (let i = runOrder.length - 1; i > 0; i--) {
        const j = retailRng.int(0, i);
        const t = runOrder[i]; runOrder[i] = runOrder[j]; runOrder[j] = t;
      }
      const trading = new Set(runOrder.slice(0, Math.min(BLOCK_RETAIL.tradingRuns, runCount)));
      const runTrades = [];
      for (let r = 0; r < runCount; r++) runTrades.push(trading.has(r));
      /**
       * `b.era` is not assigned until the era walk below, so the shopfront
       * exception is applied there rather than here; this records the run's own
       * decision and the walk reads it. Two statements, one place each.
       */

      /**
       * WHERE THE FACADE SPILL WENT
       *
       * Session 1 put four point lights per building out in the roadway, forty
       * in all, standing in for the light a facade full of lit windows throws
       * back onto its own wall and onto the building opposite. It was the right
       * problem: without something there, every square metre of wall between
       * the windows renders black.
       *
       * It was a fake, and the canyon field now computes the real thing — the
       * facade's own emitted radiance is one of the four terms in
       * `canyon`'s per-orientation radiance, alongside the sun and the sky it
       * reflects (see `surfaces.facadeEmissive` below, which is measured off
       * these very instances rather than authored).
       *
       * Keeping both would double-count. Worse, the forty of them were most of
       * why midnight's road was a uniform wash: forty 270 cd sources hanging in
       * the carriageway flood it evenly, and no streetlight can lay a pattern
       * on a floor that is already lit from everywhere. Removing them is not
       * removing content to make a gate pass — it is deleting the approximation
       * now that the thing it approximated exists.
       */

      /**
       * ERA AND CONDITION.
       *
       * Its own stream. Session 2 hit exactly this and wrote the rule down:
       * adding draws to `block:layout` shifts every building. `block:era` is
       * new, so nothing that existed before it moves (CONTRACT §6).
       *
       * The assignment is constrained rather than sampled: no two touching
       * buildings share an era *or* a base material, and all four eras have to
       * appear. Both constraints are the point rather than polish. A street
       * where the generator happened to put two brick fronts side by side has a
       * seam nobody can see, which is the failure the brief describes — "a
       * viewer can tell where one building ends and the next begins without
       * relying on the seam" is a constraint on the *placement*, not something
       * a later pass can add.
       *
       * TOUCHING IS NOT THE SAME AS ADJACENT, AND THAT IS STILL TRUE HERE.
       * `touches` means "the previous building in the same run", which is a fact
       * about the ground; what a viewer sees is a fact about the street, and two
       * buildings on opposite kerbs at the same station are side by side in the
       * frame. Session 5 built the wider constraint — material banned across
       * everything within 52 m along the street, either side — and MEASURED it,
       * and it is not what shipped. It works: four distinct materials among the
       * five gated walls instead of three. It also re-rolls the block, because
       * the search consumes a variable number of draws and every building's era,
       * condition and skin moves with it, and the measured cost of that was
       * three assertions that had been green — `facadeHue:noon` 155.8° → 2.3°,
       * `wetOverDry:midnight` 1.6× → 1.18×, and `wallNorthMid`'s sample rect no
       * longer on one wall at a spread of 1.96.
       *
       * The albedo collapse turned out not to need it (see the soiling term
       * below, which is the actual cause and costs no draws), so the wider ban
       * is written down in STATE.md as the structural fix, to be done in a
       * session that can afford to re-derive the five rects and re-check the
       * hue separation. Fixing one assertion by breaking three is not a fix.
       *
       * Rejection with a bounded retry and a deterministic fallback. An
       * unbounded loop here would be a hang that only happens on some seeds,
       * which is the worst kind.
       */
      const rngEra = ctx.rng('block:era');
      const eraOf = (() => {
        const touches = (i) => i > 0 && buildings[i - 1].run === buildings[i].run;
        for (let attempt = 0; attempt < 64; attempt++) {
          const eras = [];
          const mats = [];
          for (let i = 0; i < buildings.length; i++) {
            const banEra = touches(i) ? eras[i - 1] : -1;
            const banMat = touches(i) ? mats[i - 1] : -1;
            const w = ERAS.map((e, k) => (k === banEra ? 0 : e.weight));
            const e = weightedIndex(rngEra.next, w);
            const choices = ERAS[e].materials;
            const m = choices[rngEra.int(0, choices.length - 1)];
            eras.push(e);
            mats.push(m);
            if (m === banMat) {
              // Same material as the building it touches. Abandon this attempt
              // rather than patch it: patching biases the distribution toward
              // whatever the patch picks.
              eras.length = 0;
              break;
            }
          }
          if (eras.length === buildings.length && new Set(eras).size === ERAS.length) {
            return { eras, mats };
          }
        }
        ctx.warnOnce(
          'era-fallback',
          'could not place four eras with no repeated neighbour in 64 tries — falling back to round robin'
        );
        return {
          eras: buildings.map((_, i) => i % ERAS.length),
          mats: buildings.map((_, i) => ERAS[i % ERAS.length].materials[0]),
        };
      })();

      for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        b.era = ERAS[eraOf.eras[i]];
        b.eraIndex = eraOf.eras[i];
        b.baseMaterial = FACADE_MATERIALS[eraOf.mats[i]];
        b.baseMaterialIndex = eraOf.mats[i];

        /**
         * DOES THIS GROUND FLOOR TRADE — session 30. The run's own decision,
         * OR the architecture overriding it: a prewar shopfront is a shop unit
         * and has no other use, so it lights whatever its run rolled. See
         * `BLOCK_RETAIL` for why that exception replaced session 28's corner
         * one and what the corner one delivered in the frame.
         */
        b.retail = runTrades[b.run] || b.era.ground === 'shopfront';

        /**
         * Condition: 1 is a building somebody looks after, 0.35 is one nobody
         * has. Skewed toward the good end rather than uniform, because a street
         * where every building is half-derelict is its own kind of uniform, and
         * because the mean of this number is a multiplier on every square metre
         * of bounce light in the canyon.
         */
        b.condition = 0.35 + 0.65 * rngEra.next();

        // The era sets the floor height; the layout stream's own draw, which
        // used to *be* the floor height, is now the jitter within it. ±0.05 m,
        // so the four era values stay four values.
        b.floorHeight = b.era.floorHeight + (b.floorHeightDraw - 3.6) * 0.1;
        b.plinth = b.era.plinth;
        b.pilasters = b.era.pilasters;
        b.litFraction = b.litFraction * (0.55 + 0.55 * b.condition);

        /**
         * Albedo, absolute and linear. Soiling darkens everything a little and
         * the warm end least — dirt is warm — plus a small per-building cast so
         * two brick buildings are not the same brick.
         */
        const soil = 0.82 + 0.18 * b.condition;
        const cast = 1 + rngEra.gauss() * 0.05;
        /**
         * SOILING ONLY WARMS. The comment above says so — "dirt is warm" — and
         * until session 5 the term was a signed gaussian, so half the buildings
         * in the block were being made *cooler* than the material they are made
         * of. On a warm material that is not variation, it is cancellation: the
         * block's stucco at (0.51, 0.455, 0.36) drew warm = −0.077 and rendered
         * at (0.393, 0.380, 0.312), which is concrete. Two of the five walls the
         * look gate measures were then the same colour by arithmetic, sat 0.153
         * apart in a space with a 0.35 floor, and took the albedo cluster count
         * to 3 where 4 are required.
         *
         * `Math.abs` rather than a different draw: the same number is consumed
         * in the same order, so no other building moves (CONTRACT §6). It also
         * halves the term's expected magnitude, which is the right direction —
         * this is soiling, not repainting.
         */
        const warm = Math.abs(rngEra.gauss()) * 0.045;
        const a = b.baseMaterial.albedo;
        b.albedo = [
          a[0] * soil * cast * (1 + warm),
          a[1] * soil * cast,
          a[2] * soil * cast * (1 - warm) * (0.94 + 0.06 * b.condition),
        ];
        /** Weathering roughens. Never smoother than the material's own finish. */
        b.roughness = Math.min(1, b.baseMaterial.roughness + (1 - b.condition) * 0.05);
      }

      /**
       * A little per-unit variation on top of the building's own skin: precast
       * panels and cast bands vary from the wall they sit on, and a parapet is
       * the one surface on a building that rain washes.
       */
      const unitSkin = (b, value = 1, amount = 0.035) => {
        const j = 1 + rngEra.gauss() * amount;
        const w = rngEra.gauss() * amount * 0.5;
        return {
          albedo: [
            b.albedo[0] * j * value * (1 + w),
            b.albedo[1] * j * value,
            b.albedo[2] * j * value * (1 - w),
          ],
          roughness: b.roughness,
        };
      };

      const boxGeo = track(new THREE.BoxGeometry(1, 1, 1));
      const planeGeo = track(new THREE.PlaneGeometry(1, 1));
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const s3 = new THREE.Vector3();

      /**
       * Occluders for the canyon bake (src/lib/canyon.js).
       *
       * Axis-aligned footprints with a height, collected as the block is built
       * rather than reconstructed afterwards from the scene graph — a second
       * traversal that inferred boxes from meshes would be a second source of
       * truth for the shape of the street, and the field and the geometry would
       * eventually disagree about it.
       *
       * Session 3 hands one of these lists per chunk to the same bake.
       */
      const occluders = [];
      const addOccluder = (cx, cz, sx, sz, top) =>
        occluders.push({ x0: cx - sx / 2, x1: cx + sx / 2, z0: cz - sz / 2, z1: cz + sz / 2, top });

      const bodyMatrices = [];
      const capMatrices = [];
      const roofMatrices = [];
      const bodySkin = [];
      const capSkin = [];
      const roofSkin = [];

      for (const b of buildings) {
        q.setFromEuler(new THREE.Euler(0, b.yaw, 0));
        /**
         * Glazed area, accumulated as the openings are placed rather than
         * derived from the era's intent. If a rhythm quietly places nothing —
         * a building too short for a single floor above its plinth, say — the
         * ratio says so instead of reporting what it was supposed to be.
         */
        b.windowArea = 0;

        bodyMatrices.push(
          new THREE.Matrix4().compose(
            new THREE.Vector3(b.x, b.height / 2, b.z),
            q,
            new THREE.Vector3(b.width, b.height, b.depth)
          )
        );
        bodySkin.push({ albedo: b.albedo, roughness: b.roughness });

        /**
         * The cornice, and it is the era's rather than the block's.
         *
         * This is the line the building draws against the sky, and it is what
         * tells a viewer at a glance that the thing on the left is not the
         * thing on the right. A 1920s masonry front carries a 0.9 m projecting
         * cornice a metre and a half deep; a 1960s slab has an 8 cm coping and
         * nothing else. Session 2 gave all ten the same 0.35 m by 0.9 m band,
         * which is why the skyline in every frame is one repeated profile.
         *
         * Lighter than its wall on purpose: the top of a parapet is the one
         * surface on a building that rain washes.
         */
        const corn = b.era.cornice;
        capMatrices.push(
          new THREE.Matrix4().compose(
            new THREE.Vector3(b.x, b.height + corn.height / 2, b.z),
            q,
            new THREE.Vector3(b.width + corn.project * 2, corn.height, b.depth + corn.project * 2)
          )
        );
        capSkin.push({
          albedo: b.albedo.map((v) => v * (1.02 + 0.08 * b.condition)),
          roughness: b.roughness,
        });

        // The cornice is what the canyon sees, so it sets the occluder.
        addOccluder(
          b.x,
          b.z,
          b.width + corn.project * 2,
          b.depth + corn.project * 2,
          b.height + corn.height
        );

        // A roof box on some. Breaks the flat-top rhythm for free.
        if (rngLayout.chance(0.6)) {
          const rw = rngLayout.range(3, 7);
          const rh = rngLayout.range(2, 4.5);
          const rx = b.x + rngLayout.range(-b.width * 0.25, b.width * 0.25);
          const rz = b.z + rngLayout.range(-b.depth * 0.2, b.depth * 0.2);
          const rd = rw * rngLayout.range(0.7, 1.3);
          const rBase = b.height + corn.height;
          roofMatrices.push(
            new THREE.Matrix4().compose(
              new THREE.Vector3(rx, rBase + rh / 2, rz),
              q,
              new THREE.Vector3(rw, rh, rd)
            )
          );
          roofSkin.push({ albedo: b.albedo.map((v) => v * 0.94), roughness: b.roughness });
          addOccluder(rx, rz, rw, rd, rBase + rh);
        }

        // ---- facades ----
        // Street-facing plus both ends. The back is never visible from the
        // street and costs the same to draw as the front.
        const facades = [
          { n: new THREE.Vector3(0, 0, -b.side), w: b.width, along: new THREE.Vector3(1, 0, 0) },
          { n: new THREE.Vector3(1, 0, 0), w: b.depth, along: new THREE.Vector3(0, 0, 1) },
          { n: new THREE.Vector3(-1, 0, 0), w: b.depth, along: new THREE.Vector3(0, 0, -1) },
        ];

        const cosY = Math.cos(b.yaw);
        const sinY = Math.sin(b.yaw);
        const rotate = (v) => new THREE.Vector3(v.x * cosY + v.z * sinY, v.y, -v.x * sinY + v.z * cosY);

        for (const f of facades) {
          const n = rotate(f.n).normalize();
          const along = rotate(f.along).normalize();
          const half = (f.n.x !== 0 ? b.depth : b.width) / 2;
          const outward = (f.n.x !== 0 ? b.width : b.depth) / 2;

          const centre = new THREE.Vector3(b.x, 0, b.z).add(n.clone().multiplyScalar(outward));
          const facing = Math.atan2(n.x, n.z);

          /**
           * WINDOW RHYTHM.
           *
           * Four of them, one per era, and the difference is structural rather
           * than decorative: how many openings there are, how wide, how tall,
           * how much of the wall they cover, and whether they line up. Session 2
           * had one rhythm on every building and let the *lit fraction* vary,
           * which is why "the only visual variation between buildings is the
           * window pattern" was true and still not enough — a different random
           * subset of the same grid is the same grid.
           *
           * `windowArea` accumulates as they are placed, so the window-to-wall
           * ratio the gate reads is measured off the instances rather than
           * derived from the intent. If a rhythm quietly places nothing, the
           * number says so.
           */
          const era = b.era;
          const colSpacing = era.colSpacing || 2.75;
          const cols = Math.max(2, Math.floor((half * 2 - 1.6) / colSpacing));
          const colStart = -((cols - 1) * colSpacing) / 2;
          const floors = Math.max(1, Math.floor((b.height - b.plinth) / b.floorHeight));
          const winH = b.floorHeight * era.windowHeightFrac;

          /** Place one pane and account for it. */
          const placeWindow = (u, y, w, h) => {
            const p = centre.clone().add(along.clone().multiplyScalar(u));
            p.y = y;
            // Just proud of the wall. The building is a solid box, so a pane
            // set *into* it is a pane inside a solid — invisible, and the
            // whole facade goes dark at night with nothing to show for it.
            // The relief comes from the pilasters and spandrels instead.
            p.add(n.clone().multiplyScalar(0.045));
            q.setFromEuler(new THREE.Euler(0, facing, 0));
            s3.set(w, h, 1);
            m4.compose(p, q, s3);
            b.windowArea += w * h;

            if (rngWindows.next() < b.litFraction) {
              const type = rngWindows.chance(0.42)
                ? 0
                : rngWindows.chance(0.5)
                  ? 1
                  : rngWindows.chance(0.55)
                    ? 2
                    : 3;
              windowInstances[type].push(m4.clone());
            } else {
              windowOffInstances.push(m4.clone());
            }
          };

          for (let fl = 0; fl < floors; fl++) {
            const y = b.plinth + fl * b.floorHeight + b.floorHeight * 0.5;
            if (y > b.height - 1.4) continue;

            if (era.rhythm === 'band') {
              /**
               * A continuous ribbon, broken into segments. One pane the width
               * of the facade would be a single emitter the length of the
               * building — the same failure as a shop bay that is one lit strip
               * — so it is split, and the segments are lit independently.
               */
              const ribbon = half * 2 - era.bandInset * 2;
              const segs = Math.max(2, Math.round(ribbon / 5.5));
              const mullion = 0.14;
              const segW = (ribbon - mullion * (segs - 1)) / segs;
              for (let s = 0; s < segs; s++) {
                placeWindow(-ribbon / 2 + segW / 2 + s * (segW + mullion), y, segW, winH);
              }
            } else if (era.rhythm === 'irregular') {
              /**
               * The grid with holes in it and the columns off the line. A
               * refurbished frontage does not have a repeating bay, and an
               * exactly-repeating bay is the second strongest tell in a
               * generated city after everything being the same age.
               */
              for (let c = 0; c < cols; c++) {
                if (rngWindows.chance(0.26)) continue;
                const jitter = rngWindows.range(-0.38, 0.38);
                const w = era.windowWidth * rngWindows.range(0.78, 1.22);
                placeWindow(colStart + c * colSpacing + jitter, y, w, winH);
              }
            } else {
              // grid and vertical: a regular bay, differing in how much of it
              // is glass and how tall each opening is.
              for (let c = 0; c < cols; c++) {
                placeWindow(colStart + c * colSpacing, y, era.windowWidth, winH);
              }
            }
          }

          /**
           * Pilasters: vertical ribs standing proud of the wall. Under a low
           * sun these throw the shadow lines that turn a box into a facade.
           *
           * The corporate era's are full-height mullion strips between the
           * glazing bays and are deeper; the prewar era's are masonry piers.
           * Both start at the era's own plinth rather than at a fixed 4.6 m,
           * so they meet whatever the ground floor is.
           */
          if (b.pilasters && f.n.z !== 0) {
            const base = b.plinth - 0.6;
            const deep = era.rhythm === 'vertical' ? 0.22 : 0.13;
            const wide = era.rhythm === 'vertical' ? 0.62 : 0.5;
            for (let c = 0; c <= cols; c++) {
              const u = colStart + (c - 0.5) * colSpacing;
              const p = centre.clone().add(along.clone().multiplyScalar(u));
              p.y = (b.height + base) / 2;
              p.add(n.clone().multiplyScalar(deep));
              q.setFromEuler(new THREE.Euler(0, facing, 0));
              s3.set(wide, b.height - base, deep * 2);
              pilasterInstances.push(m4.clone().compose(p, q, s3));
              pilasterSkin.push(unitSkin(b, 1.0, 0.03));
            }
          }

          /**
           * Spandrels: one horizontal band per floor, standing proud of the
           * wall. Together with the pilasters this is what gives the openings a
           * frame to sit in, and it is the horizontal shadow line that does the
           * most work at 5° of sun elevation.
           *
           * The depth is the era's. A postwar ribbon has a shallow band under
           * it; a prewar masonry front has a deep one; the infill era barely
           * has one at all. Depth 0 means no spandrel, and that is a legitimate
           * facade rather than a missing feature.
           */
          if (f.n.z !== 0 && era.spandrelHeight > 0.01) {
            for (let fl = 0; fl < floors; fl++) {
              const y = b.plinth + fl * b.floorHeight;
              if (y > b.height - 1.4) continue;
              const p = centre.clone();
              p.y = y;
              p.add(n.clone().multiplyScalar(0.09));
              q.setFromEuler(new THREE.Euler(0, facing, 0));
              s3.set(half * 2 - 0.4, era.spandrelHeight, 0.2);
              spandrelInstances.push(m4.clone().compose(p, q, s3));
              spandrelSkin.push(unitSkin(b, 1.0, 0.045));
            }
          }

          // Ground floor, street side only: individual shop bays rather than one
          // continuous band. A single lit strip the length of the block reads as
          // a glowing ribbon, and every bay being open is the same tell as every
          // window being lit (authored-city.md §2) — so roughly a third are shut.
          /**
           * GROUND-FLOOR TREATMENT.
           *
           * Where a building meets the pavement is where a person standing on
           * it actually looks, and session 2 gave all ten the same answer: a
           * row of glazed shop bays under a canopy at 4.05 m. Four answers now,
           * one per era, and they differ in silhouette rather than in trim —
           * a colonnade has piers and a metre of shadow behind them, a blank
           * plinth has neither shop nor canopy, a recessed front has a soffit
           * two metres back. From the street these read as different buildings
           * before any of the colour does.
           *
           * `glazedRun` is shared by the three treatments that have glazing, so
           * "a shop bay" means one thing. The differences between them are
           * where the glass sits, what is in front of it, and what is over it.
           */
          if (f.n.z !== 0) {
            q.setFromEuler(new THREE.Euler(0, facing, 0));
            const ground = era.ground;
            /** How far the glazing sits back from the wall plane, metres. */
            const setBack = ground === 'colonnade' ? 1.15 : ground === 'recessed' ? 0.95 : -0.05;
            const glassTop = Math.min(b.plinth - 1.35, 3.4);

            const glazedRun = () => {
              const usable = half * 2 - 1.2;
              const bays = Math.max(1, Math.round(usable / rngWindows.range(5.2, 7.4)));
              const bayPitch = usable / bays;
              const pier = 0.65;

              for (let bi = 0; bi < bays; bi++) {
                const u = -usable / 2 + bayPitch * (bi + 0.5);
                const p = centre.clone().add(along.clone().multiplyScalar(u));
                p.add(n.clone().multiplyScalar(-setBack));
                p.y = glassTop / 2 + 0.75;
                s3.set(bayPitch - pier, glassTop, 1);

                // A shut unit is likelier on a building nobody looks after.
                const closed = rngWindows.next() < 0.5 - 0.28 * b.condition;
                const kind = closed ? -1 : rngWindows.int(0, shopMaterials.length - 1);

                if (closed) {
                  shutterInstances.push(m4.clone().compose(p, q, s3));
                  continue;
                }

                /**
                 * SESSION 30: DOES THIS FRONTAGE TRADE? Both draws above have
                 * already been made and both are unconditional, so a run going
                 * dark cannot move a window three storeys up — see
                 * `BLOCK_RETAIL`. What changes below is which material the
                 * panes are pushed into and whether the bay gets a light.
                 */
                const lit = b.retail;

                // Glazed in panes with mullions between them. One plane the
                // width of the whole bay reads as a backlit panel; three panes
                // with dark frames between them read as a shop.
                const bayW = bayPitch - pier;
                const panes = bayW > 4.6 ? 3 : 2;
                const mullion = 0.17;
                const paneW = (bayW - mullion * (panes - 1)) / panes;
                for (let pi = 0; pi < panes; pi++) {
                  const pu = -bayW / 2 + paneW / 2 + pi * (paneW + mullion);
                  const pp = centre.clone().add(along.clone().multiplyScalar(u + pu));
                  pp.add(n.clone().multiplyScalar(-setBack));
                  pp.y = glassTop / 2 + 0.75;
                  s3.set(paneW, glassTop, 1);
                  (lit ? shopBayInstances[kind] : shopBayOffInstances)
                    .push(m4.clone().compose(pp, q, s3));
                }

                // A sill under the glazing rather than a frame around it: a
                // frame box proud of the panes occludes them at exactly the
                // grazing angles a standing camera sees a shopfront from. The
                // mullions and the wall between bays already give the vertical
                // divisions.
                const fp = centre.clone().add(along.clone().multiplyScalar(u));
                fp.add(n.clone().multiplyScalar(0.14 - setBack));
                fp.y = 0.6;
                s3.set(bayW + 0.3, 0.36, 0.3);
                shopFrameInstances.push(m4.clone().compose(fp, q, s3));

                // Interior spill onto the pavement. This is most of why a night
                // street has a floor at all — and a bay with nothing on behind
                // it throws none, which is the whole of what an unlit frontage
                // costs the pavement in front of it.
                if (!lit) continue;
                const lp = centre.clone().add(along.clone().multiplyScalar(u));
                lp.add(n.clone().multiplyScalar(1.9 - setBack));
                lp.y = glassTop * 0.8;
                addShopLight({
                  position: lp,
                  color: SHOP_CHROMA[kind],
                  intensity: 165,
                  radius: 14,
                  // A lit shopfront is a wall of glass, not a bulb. Its
                  // reflection in a wet pavement is a broad soft band, and at
                  // zero radius it would be a pinprick.
                  sourceRadius: 1.3,
                });
              }
            };

            if (ground === 'shopfront') {
              glazedRun();

              // A canopy over the bays: the lintel that separates shop from
              // building, and at night the thing the shop light bounces off.
              const cp = centre.clone().add(n.clone().multiplyScalar(0.45));
              cp.y = glassTop + 0.95;
              s3.set(half * 2 - 0.4, 0.34, 1.05);
              canopyInstances.push(m4.clone().compose(cp, q, s3));
              canopySkin.push(unitSkin(b, 1.0, 0.03));

              // The one overhang anybody stands under, and the reason the field
              // is sampled at sub-metre spacing near the ground.
              addOccluder(cp.x, cp.z, half * 2 - 0.4, 1.05, cp.y + 0.17);
            } else if (ground === 'colonnade') {
              // The facade steps back and stands on piers, with the glazing in
              // shadow behind them. Deep relief for nothing: the piers are six
              // boxes and the shadow between them does the work.
              glazedRun();
              const piers = Math.max(3, Math.round((half * 2) / 4.2));
              const pitch = (half * 2 - 1.0) / piers;
              for (let i = 0; i <= piers; i++) {
                const u = -(half * 2 - 1.0) / 2 + i * pitch;
                const p = centre.clone().add(along.clone().multiplyScalar(u));
                p.add(n.clone().multiplyScalar(0.42));
                p.y = (glassTop + 0.9) / 2;
                s3.set(0.78, glassTop + 0.9, 0.9);
                pierInstances.push(m4.clone().compose(p, q, s3));
                pierSkin.push(unitSkin(b, 0.97, 0.02));
              }
              const cp = centre.clone().add(n.clone().multiplyScalar(0.42));
              cp.y = glassTop + 1.15;
              s3.set(half * 2, 0.5, 1.05);
              canopyInstances.push(m4.clone().compose(cp, q, s3));
              canopySkin.push(unitSkin(b, 1.0, 0.02));
              addOccluder(cp.x, cp.z, half * 2, 1.05, cp.y + 0.25);
            } else if (ground === 'recessed') {
              // Glazing set back with a soffit over it. The soffit is what
              // makes this read at all: a deep horizontal shadow the full width
              // of the building, which no other treatment here has.
              glazedRun();
              const sp = centre.clone().add(n.clone().multiplyScalar(-setBack / 2));
              sp.y = glassTop + 0.6;
              s3.set(half * 2 - 0.5, 0.55, setBack + 0.4);
              soffitInstances.push(m4.clone().compose(sp, q, s3));
              soffitSkin.push(unitSkin(b, 0.95, 0.02));
              addOccluder(sp.x, sp.z, half * 2 - 0.5, setBack + 0.4, sp.y + 0.28);
            } else {
              /**
               * A blank plinth: a solid base with one recessed service door and
               * no shop at all. authored-city.md §5 — a street where every
               * ground floor is a lit shopfront is uniformly interesting, which
               * is its own tell.
               *
               * The door gets a light. A stretch of frontage with nothing on it
               * is negative space; a stretch with *no light on it* is a hole in
               * the night frame, and midnight has 1.1% of its pixels crushed to
               * black already.
               */
              const pp = centre.clone().add(n.clone().multiplyScalar(0.22));
              pp.y = (b.plinth - 0.7) / 2;
              s3.set(half * 2 - 0.3, b.plinth - 0.7, 0.44);
              plinthInstances.push(m4.clone().compose(pp, q, s3));
              plinthSkin.push(unitSkin(b, 0.9, 0.025));

              const du = rngWindows.range(-half * 0.45, half * 0.45);
              const dp = centre.clone().add(along.clone().multiplyScalar(du));
              dp.add(n.clone().multiplyScalar(0.16));
              dp.y = 1.25;
              s3.set(1.9, 2.5, 1);
              shopBayInstances[3].push(m4.clone().compose(dp, q, s3));

              const dl = centre.clone().add(along.clone().multiplyScalar(du));
              dl.add(n.clone().multiplyScalar(1.1));
              dl.y = 2.8;
              addShopLight({
                position: dl,
                color: SHOP_CHROMA[3],
                intensity: 42,
                radius: 9,
                sourceRadius: 0.5,
              });

              /**
               * AND IF THIS FRONTAGE TRADES, THE SOCKEL IS PUNCHED — session
               * 30, and this is the whole of the decoupling for the treatment
               * the operator was actually looking at.
               *
               * STATE 28 §0.2 measured his frame and named the near-left mass:
               * *"the block's building 4, a `blankPlinth`"*. A blank plinth
               * that lets its ground floor does not become a shopfront — it
               * gets openings CUT IN ITS BASE, no pilasters, no canopy, the
               * solid base still reading as a solid base between them. That is
               * session 28's own blankPlinth variant, here.
               *
               * THE GEOMETRY IS DRAWN FROM `retailRng` AND FROM NOTHING ELSE,
               * so adding it consumes no `block:windows` number and the upper
               * facade of every building in this block is unmoved (§6, and the
               * determinism control is in STATE 30 §3).
               */
              if (b.retail) {
                const runW = half * 2 - 1.6;
                const nOpen = Math.max(2, Math.round(runW / BLOCK_RETAIL.punchPitchM));
                const pitch = runW / nOpen;
                for (let oi = 0; oi < nOpen; oi++) {
                  const ou = -runW / 2 + pitch * (oi + 0.5) + retailRng.range(-0.18, 0.18);
                  const op = centre.clone().add(along.clone().multiplyScalar(ou));
                  op.add(n.clone().multiplyScalar(0.10));
                  op.y = 0.95 + BLOCK_RETAIL.punchH / 2;
                  s3.set(BLOCK_RETAIL.punchW, BLOCK_RETAIL.punchH, 1);
                  shopBayInstances[retailRng.int(0, shopMaterials.length - 1)]
                    .push(m4.clone().compose(op, q, s3));
                  plinthOpenings++;
                }
                /**
                 * TWO LIGHTS FOR THE WHOLE FRONTAGE, not one per opening, and
                 * the reason is a measured bound rather than taste: the block
                 * delivers 32 lamp beams and 5 sign lights against a role
                 * ceiling of 60, so there are 23 slots for shopfronts and a
                 * street where all four runs trade wants more than that if
                 * every punched opening claims one. A 1.15 m hole in a plinth
                 * is a window, not a shopfront, and session 20's own argument
                 * about navigation lamps applies: what makes it read is the
                 * emitter, not the pool it throws.
                 */
                for (const k of [-1, 1]) {
                  const wl = centre.clone().add(along.clone().multiplyScalar(k * runW * 0.26));
                  wl.add(n.clone().multiplyScalar(1.4));
                  wl.y = 2.2;
                  addShopLight({
                    position: wl,
                    color: SHOP_CHROMA[1],
                    intensity: 74,
                    radius: 11,
                    sourceRadius: 0.8,
                  });
                }
              }
            }
          }
        }
      }

      /**
       * WHERE THE SIXTEEN LAMP COLUMNS STAND — [x, z, side, aimAxis].
       *
       * Hoisted out of the lamp run below in session 30, because item 3c's
       * pillar arm has to test against them and it runs first. ONE list, read
       * twice: a second copy of these stations is exactly the arrangement
       * `pierEvery: 34` sat in (CONTRACT §9.1).
       */
      const LAMP_STATIONS = [];
      for (let i = 0; i < 7; i++) {
        LAMP_STATIONS.push([-108 + i * 30, halfStreet + 1.3, 1, 'z']);
        LAMP_STATIONS.push([-93 + i * 30, -(halfStreet + 1.3), -1, 'z']);
      }
      LAMP_STATIONS.push([halfCross + 1.3, -34, 1, 'x']);
      LAMP_STATIONS.push([-(halfCross + 1.3), 30, -1, 'x']);

      /**
       * ITEM 4 — THE ORIGIN BLOCK'S OWN BUS STOPS.
       *
       * BOTH CONTENT PATHS, WHICH IS THE HALF OF THIS ITEM THE BRIEF SAID WAS
       * MOST LIKELY TO BE MISSED, and session 28 is why it said so: it built a
       * whole session of content into `city.js` while the operator was standing
       * in `block.js`. Every dimension and the panel's radiance come from
       * `BUS_STOP` in `citygen.js` — IMPORTED, not re-authored — so a shelter
       * here and a shelter three chunks away cannot become two different
       * objects the way one lamp bowl became 210 and 9000.
       *
       * THE PLACEMENT RULE, and it is the streamed city's rule with this
       * street's own geometry substituted rather than a second rule:
       *
       *   ON THE PAVEMENT.   z = side * (halfStreet + kerbGap + roofDeep/2) =
       *                      +/-8.575 m, inside a footway that runs 7.5 to 11.7.
       *   NEAR SIDE OF THE JUNCTION.  This block has exactly one junction — the
       *                      cross street at x = 0 — and `beforeJunctionM` = 22
       *                      is the same 22 m. Which SIDE of it depends on which
       *                      way the near lane runs: with right-hand traffic the
       *                      kerbside lane on the south pavement runs east, so
       *                      its stop is 22 m WEST of the crossing; the north
       *                      pavement's runs west, so its stop is 22 m EAST.
       *                      One per direction, mirrored through the junction,
       *                      which is what a real pair of stops is.
       *   AT INTERVALS.      TWO on 214 m of frontage. There is no roll here and
       *                      there should not be: ten hand-placed buildings on
       *                      one street is not a population, and session 30
       *                      has already paid twice for transplanting a
       *                      streamed-city roll onto a sample of four
       *                      (`BLOCK_RETAIL`).
       *
       * DECLARED BEFORE DRAWN AND REFUSED RATHER THAN MOVED, against the only
       * registry this file has: its own `occluders` and its sixteen
       * `LAMP_STATIONS`. The claim is recorded in `counts` and its footprint is
       * THE ROOF — 4.00 x 1.35 m — and not the 0.09 m posts, which is the
       * brief's own requirement and session 24's finding.
       */
      const timetablePanels = [];
      let busStops = 0;
      let busStopsRefused = 0;
      {
        const A = BUS_STOP;
        const half = A.roofAlongM / 2;
        for (const side of [1, -1]) {
          /** South pavement's near lane runs east, so its stop is west of the
           *  crossing; the north pavement's is the mirror. */
          const sx = side > 0 ? -A.beforeJunctionM : A.beforeJunctionM;
          const sz = side * (halfStreet + A.kerbGapM + A.roofDeepM / 2);
          const hx = half;
          const hz = A.roofDeepM / 2;
          const hitsBuilding = occluders.some((o) =>
            sx + hx > o.x0 && sx - hx < o.x1 && sz + hz > o.z0 && sz - hz < o.z1);
          const hitsLamp = LAMP_STATIONS.some((l) =>
            Math.abs(l[0] - sx) < hx + 0.4 && Math.abs(l[1] - sz) < hz + 0.4);
          if (hitsBuilding || hitsLamp) { busStopsRefused++; continue; }

          const baseS = blockSurfaceAt(sx, sz).y;
          /**
           * `side` TAKES YOU AWAY FROM THE ROAD CENTRE, which is the same
           * convention `citygen`'s `kerbBands` uses and the opposite of what
           * this first read as. The shelter's back is therefore at `sz + side *
           * delta` and the carriageway is at `-side`. `city.js` carries the
           * same correction and the same comment — CONTRACT §9 rule 7, and the
           * delivered frame is what caught it: a shelter with its back to the
           * pavement and its lit timetable facing a wall.
           */
          const yawS = side > 0 ? 0 : Math.PI;
          const qs = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yawS, 0));
          const grey = { albedo: [0.088, 0.090, 0.096], roughness: 0.44 };
          const glass = { albedo: [0.052, 0.056, 0.061], roughness: 0.10 };
          const put = (x, y, z, sxx, syy, szz, skin) => {
            s3.set(sxx, syy, szz);
            plinthInstances.push(
              m4.clone().compose(new THREE.Vector3(x, y, z), qs, s3));
            plinthSkin.push(skin);
          };
          /** roof — the claimed footprint */
          put(sx, baseS + A.roofY + A.roofThickM / 2, sz,
            A.roofAlongM, A.roofThickM, A.roofDeepM, grey);
          /** two posts at the BACK corners, inside the roof's own footprint */
          for (const k of [-1, 1]) {
            put(sx + k * (half - 0.22), baseS + A.roofY / 2,
              sz + side * (A.roofDeepM / 2 - 0.14), A.postM, A.roofY, A.postM, grey);
          }
          /** the glazed back panel, on the building side */
          put(sx, baseS + (A.backBottomY + A.backTopY) / 2,
            sz + side * (A.roofDeepM / 2 - A.backThickM / 2),
            A.roofAlongM - 0.18, A.backTopY - A.backBottomY, A.backThickM, glass);
          /** the bench against it, facing the road */
          put(sx, baseS + A.benchY,
            sz + side * (A.roofDeepM / 2 - A.backThickM - A.benchDeepM / 2 - 0.04),
            A.benchAlongM, 0.07, A.benchDeepM, grey);
          /** the pole and its flag, a metre past the downstream end */
          const px2 = sx + (side > 0 ? half + 1.0 : -(half + 1.0));
          const baseP = blockSurfaceAt(px2, sz).y;
          put(px2, baseP + A.flagY / 2, sz, A.poleM, A.flagY, A.poleM, grey);
          put(px2, baseP + A.flagY, sz, A.flagAlongM, 0.34, A.flagDeepM, grey);

          /**
           * The lit timetable case, on the back panel and FACING THE ROAD —
           * which is where a person waiting stands and where the light has to
           * land. `PlaneGeometry` faces +z, so it wants yaw PI on the pavement
           * at +z and yaw 0 on the one at -z.
           */
          s3.set(A.panelAlongM, A.panelH, 1);
          timetablePanels.push(m4.clone().compose(
            new THREE.Vector3(
              sx + (side > 0 ? half - A.panelAlongM / 2 - 0.12 : -(half - A.panelAlongM / 2 - 0.12)),
              baseS + A.panelY,
              sz + side * (A.roofDeepM / 2 - A.backThickM - 0.05)
            ),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, side > 0 ? Math.PI : 0, 0)),
            s3));

          addOccluder(sx, sz, A.roofAlongM, A.roofDeepM, baseS + A.roofY + A.roofThickM);
          busStops++;
        }
      }

      /** ITEM 3c. The whole argument is over `AD_PILLAR_BLOCK`; this is the wiring. */
      const pillarInstances = [];
      const pillarSkin = [];
      const pillarFaces = [];
      let pillarsRefused = 0;
      if (AD_PILLAR_BLOCK.enabled) {
        const P = AD_PILLAR_BLOCK;
        for (const b of buildings) {
          const zFace = b.z - b.side * (b.depth / 2);
          const nP = Math.max(1, Math.round(b.width / P.perFrontageM));
          for (let k = 0; k < nP; k++) {
            const px = b.x + (-b.width / 2) + (b.width * (k + 0.5)) / nP;
            const pz = zFace - b.side * P.standoff;
            const pad = 0.85;
            const hitsBuilding = occluders.some((o) =>
              px + pad > o.x0 && px - pad < o.x1 && pz + pad > o.z0 && pz - pad < o.z1);
            const hitsLamp = LAMP_STATIONS.some((l) =>
              Math.abs(l[0] - px) < pad + 0.3 && Math.abs(l[1] - pz) < pad + 0.3);
            if (hitsBuilding || hitsLamp) { pillarsRefused++; continue; }

            const baseY = blockSurfaceAt(px, pz).y;
            const yaw = b.side > 0 ? 0 : Math.PI;
            q.setFromEuler(new THREE.Euler(0, yaw, 0));
            const put = (y, sx, sy, sz) => {
              s3.set(sx, sy, sz);
              pillarInstances.push(m4.clone().compose(new THREE.Vector3(px, baseY + y, pz), q, s3));
              pillarSkin.push({ albedo: [0.055, 0.056, 0.062], roughness: 0.42 });
            };
            put(P.baseH / 2, P.baseAlong, P.baseH, P.baseDeep);
            put(P.baseH + P.colH / 2, P.colAlong, P.colH, P.colDeep);
            put(P.baseH + P.colH + P.browH / 2, P.baseAlong * 0.86, P.browH, P.baseDeep * 0.80);

            const faceY = baseY + P.baseH + 0.42 + P.faceH / 2;
            for (const sgn of [1, -1]) {
              const fq = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(0, sgn > 0 ? yaw : yaw + Math.PI, 0));
              s3.set(P.colAlong * P.faceFrac, P.faceH, 1);
              pillarFaces.push(m4.clone().compose(
                new THREE.Vector3(px, faceY, pz - b.side * sgn * (P.colDeep / 2 + 0.03)), fq, s3));
            }
            addOccluder(px, pz, P.baseAlong, P.baseDeep, baseY + P.baseH + P.colH + P.browH);
          }
        }
      }

      /**
       * Window-to-wall ratio, per building: glazed area over the area of the
       * upper facade the glazing is spread across. Measured, not authored — see
       * `b.windowArea` above.
       */
      for (const b of buildings) {
        const upperWall = (b.width + 2 * b.depth) * Math.max(1, b.height - b.plinth);
        b.windowWallRatio = b.windowArea / upperWall;
      }

      // ---- instanced facade detail ---------------------------------------

      /**
       * @param skin  optional per-instance `{ albedo, roughness }`.
       *
       *   The albedo rides in `instanceColor`, which three multiplies into
       *   `diffuseColor` in its own `color_fragment` chunk — no shader of ours
       *   involved. Since the facade material's own colour is linear white, the
       *   value in that buffer *is* the albedo rather than a multiplier on one.
       *
       *   The roughness rides in a `noctisRough` instanced attribute that the
       *   patched shader reads (lights.js, SURFACE_FRAGMENT). It needs the
       *   geometry to itself — instance attributes live on the geometry, and
       *   half a dozen InstancedMeshes here share one box — so a geometry with
       *   a skin gets a clone. Six clones of a 24-vertex box against six extra
       *   draw calls per material, which is the trade at a thousand buildings
       *   rather than at ten.
       *
       *   Zero in `noctisRough` means "no override", which is what a mesh with
       *   no such attribute reads, so the emitters and the metal are untouched.
       */
      const skinColor = new THREE.Color();
      const addInstanced = (geo, mat, matrices, name, shadows = false, skin = null) => {
        if (!matrices.length) return null;
        let g = geo;
        if (skin) {
          g = track(geo.clone());
          const rough = new Float32Array(matrices.length);
          for (let i = 0; i < matrices.length; i++) rough[i] = skin[i].roughness;
          g.setAttribute('noctisRough', new THREE.InstancedBufferAttribute(rough, 1));
        }
        const im = new THREE.InstancedMesh(g, mat, matrices.length);
        for (let i = 0; i < matrices.length; i++) im.setMatrixAt(i, matrices[i]);
        im.instanceMatrix.needsUpdate = true;
        if (skin) {
          for (let i = 0; i < matrices.length; i++) {
            const a = skin[i].albedo;
            // setRGB in linear: these are measured reflectances, not authored
            // sRGB colours, and letting ColorManagement decode them would bend
            // every one through a 2.2 power (CONTRACT §5.2).
            skinColor.setRGB(a[0], a[1], a[2], THREE.LinearSRGBColorSpace);
            im.setColorAt(i, skinColor);
          }
          im.instanceColor.needsUpdate = true;
        }
        im.castShadow = shadows;
        im.receiveShadow = shadows;
        im.name = name;
        /**
         * What this mesh holds, so `harness.sceneCensus()` can compare the
         * live scene against what was written down rather than asking the
         * config what it meant. Derived from the name because every mesh here
         * is a single kind — unlike `city.js`, where four kinds share one
         * InstancedMesh and the breakdown has to be recorded before the merge.
         */
        im.userData.noctisCensus = {
          chunk: 'block',
          [`block_${name.replace(/^block:/, '').replace(/[^a-z0-9]+/gi, '_')}`]: matrices.length,
        };
        /**
         * Culled since session 4. With ten buildings and nothing else in the
         * world it did not matter and `false` was the safe default; with a city
         * around it the block's fifteen meshes were fifteen draw calls being
         * submitted from a kilometre away with the camera facing the other
         * direction. The bounding sphere has to be computed explicitly — three
         * only does it lazily, for raycasting — and shadow casters are culled
         * against the light's frustum rather than this one, so a building behind
         * the camera still casts into the frame.
         */
        im.frustumCulled = true;
        im.computeBoundingSphere();
        root.add(im);
        return im;
      };

      addInstanced(boxGeo, matFacade, bodyMatrices, 'block:bodies', true, bodySkin);
      addInstanced(boxGeo, matFacade, capMatrices, 'block:cornices', true, capSkin);
      addInstanced(boxGeo, matFacade, roofMatrices, 'block:roofboxes', true, roofSkin);

      windowInstances.forEach((list, i) =>
        addInstanced(planeGeo, windowMaterials[i], list, `block:windows:${i}`)
      );
      addInstanced(planeGeo, matWindowOff, windowOffInstances, 'block:windows:off');
      shopBayInstances.forEach((list, i) =>
        addInstanced(planeGeo, shopMaterials[i], list, `block:shopbay:${i}`)
      );
      addInstanced(planeGeo, matWindowOff, shopBayOffInstances, 'block:shopbay:off');
      addInstanced(planeGeo, matShutter, shutterInstances, 'block:shutters');
      addInstanced(boxGeo, matShopFrame, shopFrameInstances, 'block:shopframes', true);
      addInstanced(boxGeo, matFacade, pilasterInstances, 'block:pilasters', true, pilasterSkin);
      addInstanced(boxGeo, matFacade, spandrelInstances, 'block:spandrels', true, spandrelSkin);
      addInstanced(boxGeo, matFacade, canopyInstances, 'block:canopies', true, canopySkin);
      addInstanced(boxGeo, matFacade, pierInstances, 'block:piers', true, pierSkin);
      addInstanced(boxGeo, matFacade, soffitInstances, 'block:soffits', true, soffitSkin);
      /**
       * ITEM 3c'S DARK BOXES RIDE IN THE PLINTH MESH — same geometry, same
       * material, same per-instance skin, same shadow flag — so nine pillars
       * cost ONE draw call and not two. `counts.adPillars` is written BEFORE
       * the merge, which is `city.js`'s own arrangement and the reason it is
       * written down there: after a merge there is one mesh and no categories,
       * and a refactor that erases a category erases the check on it
       * (CONTRACT §9.1).
       *
       * The FACES cannot join anything. A window is 21–30 cd/m² and a sign
       * plate 38; this is 748, and one material carries one radiance.
       */
      for (let i = 0; i < pillarInstances.length; i++) {
        plinthInstances.push(pillarInstances[i]);
        plinthSkin.push(pillarSkin[i]);
      }
      addInstanced(boxGeo, matFacade, plinthInstances, 'block:plinths', true, plinthSkin);
      addInstanced(planeGeo, matPillarFace, pillarFaces, 'block:adpillar:faces');
      /**
       * ITEM 4'S SHELTERS. The seven opaque boxes of each stop ride in
       * `block:plinths` above — same geometry, material, skin and shadow flag —
       * so a stop costs ZERO new box draws here exactly as it does in the
       * streamed city. The lit timetable panel cannot join anything: this
       * file's brightest window is 30 cd/m2 and its sign plate 38, against
       * `BUS_STOP.panelNits` = 420, and one material carries one radiance.
       */
      addInstanced(planeGeo, matTimetable, timetablePanels, 'block:busstop:panels');

      // ---- streetlights ---------------------------------------------------

      const poleGeo = track(new THREE.CylinderGeometry(0.11, 0.15, 1, 8));
      /**
       * THE SHAPE COMES FROM `LAMP_BOWL`, THE TESSELLATION DOES NOT — s28.
       * The radius and the zone angles are what the radiance is divided by
       * (`LAMP_BOWL.areaM2`), so a literal here would be a second copy of the
       * derivation's denominator. 12x8 is this path's own business: sixteen
       * bowls at 30 m, against the streamed city's 790 at up to a kilometre.
       */
      const bowlGeo = track(new THREE.SphereGeometry(
        LAMP_BOWL.radiusM, 12, 8,
        LAMP_BOWL.phiStart, LAMP_BOWL.phiLength, LAMP_BOWL.thetaStart, LAMP_BOWL.thetaLength
      ));
      const armGeo = track(new THREE.BoxGeometry(1, 0.12, 0.12));

      const lampHeight = 8.4;
      /**
       * What one luminaire actually emits, from the distribution the shader
       * evaluates. Computed once, used for the leak below — and printed,
       * because "how many lumens is a streetlight in this city" is a question
       * session 3 will need an answer to when it multiplies them.
       */
      const beamLumens = luminaireFlux(LIGHT.streetlampCandela, LUMINAIRE);
      const addLamp = (x, z, side, aimAxis = 'z') => {
        const g = new THREE.Group();
        /**
         * THE COLUMN STANDS ON WHATEVER IS UNDER IT — session 19. This was
         * `set(x, 0, z)`, and thirteen of the sixteen columns are on the
         * block's own 0.160 m pavement, so thirteen columns were buried by a
         * whole kerb height. `lampHeight` = 8.4 m is a MOUNTING HEIGHT, and the
         * whole group — pole, arm, bowl and the light's `worldHead` below —
         * hangs off this one position, so lifting the group lifts the optic
         * with it and the road's illuminance derivation is unchanged.
         */
        const baseY = blockSurfaceAt(x, z).y;
        g.position.set(x, baseY, z);
        // Not parallel to the road. authored-city.md §3.
        g.rotation.y = rngLayout.gauss() * 0.9 * DEG;

        const pole = new THREE.Mesh(poleGeo, matMetal);
        pole.position.y = lampHeight / 2;
        pole.scale.y = lampHeight;
        pole.castShadow = true;
        g.add(pole);

        const reach = 2.1;
        const arm = new THREE.Mesh(armGeo, matMetal);
        arm.position.set(aimAxis === 'z' ? 0 : (-side * reach) / 2, lampHeight - 0.2, aimAxis === 'z' ? (-side * reach) / 2 : 0);
        arm.scale.x = reach;
        if (aimAxis === 'z') arm.rotation.y = Math.PI / 2;
        arm.castShadow = true;
        g.add(arm);

        const headPos = new THREE.Vector3(
          aimAxis === 'z' ? 0 : -side * reach,
          lampHeight - 0.32,
          aimAxis === 'z' ? -side * reach : 0
        );
        const bowl = new THREE.Mesh(bowlGeo, lampMaterial);
        bowl.position.copy(headPos);
        g.add(bowl);

        root.add(g);

        // The same `baseY` the group was placed at — the light and the mesh it
        // is inside must not be able to disagree about where the lamp is.
        const worldHead = new THREE.Vector3(x, baseY, z).add(headPos);

        const beam = lights.add({
          role: 'block',
          position: worldHead,
          color: EMITTER_CHROMA.sodium,
          intensity: LIGHT.streetlampCandela,
          radius: 30,
          type: 'spot',
          // Aimed back over the carriageway. The head hangs on an arm that
          // already reaches out over the road; tilting the beam the other way
          // lights the shopfronts and leaves the road black.
          direction: new THREE.Vector3(aimAxis === 'z' ? 0 : -side * 0.3, -1, aimAxis === 'z' ? -side * 0.3 : 0),
          /**
           * The optic. Every number here comes from LUMINAIRE in constants,
           * where the reasoning lives; this is only the wiring.
           *
           * Session 1 opened the cone to 76°, which from 8.4 m is a pool 67 m
           * across — wider than the gap between lamps and wider than the
           * street — and got a carpet with no gradient on it. Session 2
           * narrowed it to 54° and got a gradient, but the maximum was still on
           * the axis and the axis still pointed at the pavement, so the
           * brightest ground in the frame was the kerb under each lamp head and
           * the carriageway was at a fifth of it.
           *
           * The cone is now the *cutoff* of a distribution whose peak sits at
           * 52° off nadir, elongated along the road and cut short across it.
           * The along-road axis is X for the main street and Z for the cross
           * street, which is exactly the `aimAxis` the arm is already built
           * with — one fact, one place.
           */
          coneOuter: LUMINAIRE.alongRoadRad,
          coneInner: LUMINAIRE.alongRoadRad - LUMINAIRE.edgeRad,
          /** The frosted bowl above is 0.42 m across, and that is what a wet road reflects. */
          sourceRadius: 0.42,
          alongAxis: aimAxis === 'z' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1),
          /**
           * The cutoff angle above is the along-road one, so along the road the
           * shaping is the identity and only the across-road direction is
           * squeezed. One scale doing the work rather than two fighting.
           */
          alongScale: 1,
          acrossScale: Math.tan(LUMINAIRE.alongRoadRad) / Math.tan(LUMINAIRE.acrossRoadRad),
          peakAngle: LUMINAIRE.peakAngleRad,
        });
        beam.userData = { candela: LIGHT.streetlampCandela };
        lampLights.push(beam);

        // Luminaire spill. No real streetlight puts all its output inside the
        // beam — the bowl leaks in every direction, and that leak is what puts
        // any direct light at all on the lower facades and into the gaps.
        //
        // A leak is a fraction of LUMENS, and sessions 1 and 2 both took it as
        // a fraction of peak CANDELA. See src/lib/luminaire.js: the "9% leak"
        // was emitting 2488 lm against a beam of 5700, which is 44% of the
        // luminaire arriving as an unshaped 26 m sphere hung exactly where the
        // pattern is supposed to be. Same class of error as session 2's
        // mean-of-angles-then-threshold — the fraction was right and the thing
        // it was a fraction of was not.
        const spillCandela = (LIGHT.streetlampSpillFraction * beamLumens) / (4 * Math.PI);
        const spill = lights.add({
          role: 'block',
          position: worldHead,
          color: EMITTER_CHROMA.sodium,
          intensity: spillCandela,
          radius: 26,
          type: 'point',
          sourceRadius: 0.42,
        });
        spill.userData = { candela: spillCandela };
        lampLights.push(spill);
      };

      // The run has to cover the whole visible corridor including the ground in
      // front of the camera. Lighting only the far half leaves the foreground —
      // a third of the frame — black, which is what the first pass did.
      // `LAMP_STATIONS` is built above rather than here, because item 3c's
      // pillar arm has to miss these columns and two copies of a station list
      // is CONTRACT §9.1's config-the-code-does-not-read with a position.
      for (const st of LAMP_STATIONS) addLamp(st[0], st[1], st[2], st[3]);

      // ---- road markings ---------------------------------------------------

      let markingCount = 0;

      /**
       * ═════════════════════════════════════════════════════════════════════
       * SESSION 45 — THE ONE STREET IN THIS CITY WITH NO PAINT ON IT IS THE
       * ONE THE LOOK GATE STANDS IN AND THE ONE THE PLAYER SPAWNS ON.
       * ═════════════════════════════════════════════════════════════════════
       *
       * `citygen.js` delivers 2 077 crossing stripes over `citycheck`'s 10 x 10
       * (LOOK.md §4) and this file delivered NONE — no centre line, no lane
       * line, no edge line, no stop bar, no zebra, in 336 m of main street and
       * 92 m of cross street. Searching this file for "marking" before this
       * session returned nothing; the word "crossing" in it means the cross
       * STREET.
       *
       * AND IT IS NOT AN OVERSIGHT, IT IS A GUARD DOING ITS JOB. `citygen`'s
       * `paint()` refuses any mark whose footprint is not covered by a
       * DELIVERED `carriageway` claim, so that *"a road the river took, the
       * block took or a dome took has no lines painted in the air over where it
       * used to be"*. `BLOCK_KEEPOUT` clips the lattice's carriageway out of
       * this block so that the asphalt above wins — so the lattice correctly
       * paints nothing here, and nothing else ever painted anything.
       *
       * THIS PAINTS EXACTLY THE GROUND THE KEEP-OUT TOOK, which is why the two
       * cannot double up: the marks run to `BLOCK_KEEPOUT`'s own edges and the
       * lattice's start outside them. Every dimension is `ROAD_MARKING`,
       * IMPORTED — the same arrangement `BUS_STOP` has had since session 30 —
       * and the thickness and reflectance are `ROAD_PAINT`, which `city.js`
       * reads from the same place.
       *
       * ONE DRAW CALL, and this session is why there is room for it: the merged
       * lamp meshes took `highway_speed` from 439 of 440 to 395.
       */
      {
        const P = ROAD_MARKING;
        const paintGeo = track(new THREE.BoxGeometry(1, 1, 1));
        const marks = [];
        const mq = new THREE.Quaternion();
        const mp = new THREE.Vector3();
        const ms = new THREE.Vector3();
        /** `length` is the box's local X, `width` its local Z; yaw takes X onto the road. */
        const put = (x, z, length, width, yawDeg) => {
          mp.set(x, GROUND.carriageway + ROAD_PAINT.thicknessM / 2, z);
          mq.setFromEuler(new THREE.Euler(0, yawDeg * DEG, 0));
          ms.set(length, ROAD_PAINT.thicknessM, width);
          marks.push(new THREE.Matrix4().compose(mp, mq, ms));
        };
        /**
         * The junction box. A mark inside it is a mark across whichever axis
         * has green, which is the defect session 33 found in the streamed
         * city's own crossings. Cleared by half the crossing street plus the
         * same 0.05 m every join in this block uses.
         */
        const clearX = halfCross + 0.05;
        const clearZ = halfStreet + 0.05;
        const inJunction = (x, z) => Math.abs(x) < clearX && Math.abs(z) < clearZ;

        // --- the main street, along x, centreline z = 0 --------------------
        const x0 = BLOCK_KEEPOUT.x0;
        const x1 = BLOCK_KEEPOUT.x1;
        for (let t = x0 + P.centreCycleM / 2; t < x1; t += P.centreCycleM) {
          if (!inJunction(t, 0)) put(t, 0, P.centreMarkM, P.lineWidthM, 0);
        }
        for (const side of [-1, 1]) {
          const zl = side * P.laneOffsetM;
          for (let t = x0 + P.laneCycleM / 2; t < x1; t += P.laneCycleM) {
            if (!inJunction(t, zl)) put(t, zl, P.laneMarkM, P.lineWidthM, 0);
          }
          const ze = side * (halfStreet - P.edgeInsetM);
          for (let t = x0; t < x1; t += P.edgeSegmentM) {
            const c = t + P.edgeSegmentM / 2;
            if (!inJunction(c, ze)) put(c, ze, P.edgeSegmentM, P.lineWidthM, 0);
          }
        }

        /**
         * ═════════════════════════════════════════════════════════════════
         * AND THE SAME MARKS ON THE 8 km RIBBON PAST THE CITY'S EDGE —
         * SESSION 61, AND IT IS THE ONLY THING THAT SAYS *ROAD* OUT THERE.
         * ═════════════════════════════════════════════════════════════════
         *
         * `roadMain` above is one `groundExtent * 2` plane and it has always
         * run to the world's rim. Session 54 stopped the LATTICE at
         * `CITY.extentEdgeM`, and from that line outward the ribbon is asphalt
         * at 0.11714 over `GROUND.earthAlbedo`'s 0.1229 — **a 4.7% step** — so
         * the delivered frame at x = 3260 shows no road at all. Measured
         * before this existed: `s61-past-before-t0_42-wet.png` is a filling
         * station standing on an undifferentiated plane.
         *
         * IT PAINTS EXACTLY THE GROUND THE EXTENT LEFT, which is the same
         * join the block's own marks already make with the keep-out: the
         * lattice's last delivered carriageway on cz = 0 reaches **3 211.7 m**
         * and this starts at `CITY.extentEdgeM` = 3 232, so the two cannot
         * double up and the 20 m between them is unpainted road at a hundred
         * kilometres an hour. One number, and it is the number the lattice,
         * the lamps, the traffic and the countryside are all gated on.
         *
         * NO EDGE LINE AND NO LANE LINE — a two-lane country road has a centre
         * line and nothing else, and this is where the arterial becomes one.
         * The dashes also stretch: `P.centreCycleM` is an urban cycle, and the
         * standard ratio out of town is the same mark on a LONGER gap, so the
         * cycle doubles and the mark does not. It is the cheapest thing in
         * this session that changes what the road IS rather than what is
         * beside it.
         *
         * ONE DRAW CALL, because it is the same `block:markings` mesh: the
         * marks below are pushed into the same array and the count goes from
         * 218 to what STATE 61 records.
         */
        /**
         * ═════════════════════════════════════════════════════════════════
         * AND SINCE SESSION 62 THE LINE BENDS WITH THE ROAD AND THEN STOPS.
         * ═════════════════════════════════════════════════════════════════
         *
         * Two changes, and both are read off `citygen.js` → `EXIT_ROAD` rather
         * than decided here.
         *
         * IT FOLLOWS THE CENTRELINE. Each dash sits at `exitRoadZ(x)` and takes
         * `exitRoadYawDeg(x)` — the same two functions the ribbon's own vertices
         * and `blockSurfaceAt` are built from. `put` has taken a yaw since
         * session 45 and the streamed city's `paint()` has taken one since
         * session 21, so a mark on a curve costs nothing new: it is the same
         * box in the same `block:markings` mesh at the same one draw call.
         *
         * AND IT ENDS AT THE TAPER, WHICH IS THE BRIEF'S *"a centre line that
         * stops"* falling out of a number that already exists rather than being
         * a second one. A marked centre line belongs to the arterial's
         * cross-section; `EXIT_ROAD.taperM` = 200 m is where that section has
         * finished narrowing to a country lane's 7.0 m, and past it the road is
         * unmarked. So the paint runs from 3 232 to 3 432 and there is 568 m of
         * road after it with nothing on it at all — which is what a road that
         * has left a city looks like from a car.
         *
         * The dashes keep session 61's doubled cycle: `P.centreCycleM` is an
         * urban cycle and the standard rural ratio is the same mark on a longer
         * gap.
         */
        {
          const outFrom = CITYGEN.extentEdgeM;
          const outTo = CITYGEN.extentEdgeM + CITYGEN_ROAD.taperM;
          const cycle = P.centreCycleM * 2;
          for (const dir of [-1, 1]) {
            for (let t = outFrom + cycle / 2; t < outTo; t += cycle) {
              const x = dir * t;
              /**
               * THE SIGN, DERIVED RATHER THAN TRIED. `put`'s yaw is a rotation
               * about +Y, whose matrix takes the box's local +X to
               * `(cos y, 0, −sin y)`. The road's tangent is `(1, 0, m)` with
               * `m = dz/dx = tan(exitRoadYawDeg)`, so `−sin y = m·cos y` and
               * `y = −exitRoadYawDeg(x)`. The 90° the cross street below uses
               * is the same expression at `m = ∞` and agrees: local +X goes to
               * −Z, which is the axis that street runs along.
               */
              put(x, exitRoadZ(x), P.centreMarkM, P.lineWidthM, -exitRoadYawDeg(x));
            }
          }
        }

        // --- the cross street, along z, centreline x = 0 -------------------
        const z0 = BLOCK_KEEPOUT.z0;
        const z1 = BLOCK_KEEPOUT.z1;
        for (let t = z0 + P.centreCycleM / 2; t < z1; t += P.centreCycleM) {
          if (!inJunction(0, t)) put(0, t, P.centreMarkM, P.lineWidthM, 90);
        }
        for (const side of [-1, 1]) {
          const xe = side * (halfCross - P.edgeInsetM);
          for (let t = z0; t < z1; t += P.edgeSegmentM) {
            const c = t + P.edgeSegmentM / 2;
            if (!inJunction(xe, c)) put(xe, c, P.edgeSegmentM, P.lineWidthM, 90);
          }
        }

        /**
         * THE STOP BARS AND THE ZEBRAS, AT THE ONE JUNCTION THIS BLOCK HAS.
         *
         * `CITY.stopLineFromJunctionM` is the SAME 9.0 m `traffic.js` brakes a
         * nose to and `citygen` paints the lattice's bars at, so a vehicle
         * stopped at this block's line has its bumper on the paint exactly as
         * it does three chunks away. The zebra's band is solved the way session
         * 33 solved the lattice's, with THIS street's numbers substituted:
         *
         *   near edge >= halfCross + 0.05 = 6.55   outside the crossing carriageway
         *   far edge  <= d - barWidth/2 - 0.05 = 8.75   inside the line vehicles stop at
         *
         * which is 2.20 m of depth centred on 7.65 — wider than the lattice's
         * 1.20 m because this block's cross street is 13 m and not 15, and
         * derived rather than copied for exactly that reason.
         */
        const d = CITYGEN.stopLineFromJunctionM;
        const near = clearX;
        const far = d - P.barWidthM / 2 - 0.05;
        const zebraDepth = far - near;
        const zebraAt = (near + far) / 2;
        const span = halfStreet - P.edgeInsetM;
        for (const sgn of [-1, 1]) {
          // The approach half: with right-hand traffic the lane approaching the
          // junction from `sgn` on an x-running road is the `-sgn` half in z.
          const half = -sgn;
          put(sgn * d, half * (halfStreet / 2 + 0.15), P.barWidthM, halfStreet - P.edgeInsetM, 0);
          for (let k = 0; k < P.crossingStripes; k++) {
            const u = (k + 0.5) / P.crossingStripes;
            put(sgn * zebraAt, (2 * u - 1) * span, zebraDepth, P.crossingStripeWidthM, 0);
          }
        }

        addInstanced(paintGeo, matMarking, marks, 'block:markings');
        markingCount = marks.length;
      }

      // ---- signage --------------------------------------------------------

      /**
       * authored-city.md §4: reserve saturation. Six signs on a whole block,
       * mostly warm, one dead. The neon reads because everything around it is
       * grey concrete and sodium, not because there is a lot of it.
       */
      const signPalette = [
        // building index, so the six are spread down both sides of the corridor
        // rather than landing wherever the modulo put them. `blade` signs hang
        // perpendicular to the facade, out over the pavement — a flat sign on a
        // wall is edge-on to anyone walking down the street, which is why real
        // ones project.
        { chroma: EMITTER_CHROMA.neonAmber, dead: false, at: 3, blade: true },
        { chroma: EMITTER_CHROMA.neonCyan, dead: false, at: 8, blade: false },
        { chroma: EMITTER_CHROMA.neonRed, dead: false, at: 9, blade: true },
        { chroma: EMITTER_CHROMA.neonGreen, dead: false, at: 4, blade: false },
        { chroma: EMITTER_CHROMA.mercuryBlue, dead: false, at: 2, blade: true },
        { chroma: EMITTER_CHROMA.neonMagenta, dead: true, at: 7, blade: false },
      ];

      const plateMat = surfaceMaterial(ctx, { color: 0x1b1b1e, roughness: 0.7 });

      signPalette.forEach((sign, i) => {
        const b = buildings[sign.at % buildings.length];
        const n = new THREE.Vector3(0, 0, -b.side);
        const outward = b.depth / 2;
        const centre = new THREE.Vector3(b.x, 0, b.z).add(n.clone().multiplyScalar(outward));

        const w = rngSigns.range(3.4, 7.5);
        const h = rngSigns.range(1.5, 3.2);
        const y = rngSigns.range(6.5, Math.max(9, Math.min(b.height - 4, 22)));
        const u = rngSigns.range(-b.width * 0.3, b.width * 0.3);

        const p = centre.clone().add(new THREE.Vector3(u, 0, 0));
        p.y = y;
        p.add(n.clone().multiplyScalar(sign.blade ? 0.9 + w / 2 : 0.55));

        const group = new THREE.Group();
        group.position.copy(p);
        group.rotation.y = Math.atan2(n.x, n.z) + (sign.blade ? Math.PI / 2 : 0);
        // Signs hang a degree or two off level. authored-city.md §3.
        group.rotation.z = rngSigns.gauss() * 0.8 * DEG;

        const plate = new THREE.Mesh(boxGeo, plateMat);
        plate.scale.set(w, h, 0.22);
        plate.castShadow = true;
        plate.name = `block:sign:${i}:plate`;
        group.add(plate);

        const glow = emissiveMaterial(ctx, {
          chroma: sign.chroma,
          nits: sign.dead ? EMISSIVE.deadSignPlate : EMISSIVE.signPlate,
        });
        /**
         * Both faces. A blade sign is read from both directions along the
         * street, and the back of a wall sign is never seen anyway.
         *
         * THE BACK FACE IS ROTATED AND NOT MIRRORED, AND FOR THIRTEEN SESSIONS
         * IT WAS MIRRORED. Session 14, found by `tools/windcheck.mjs`.
         *
         * It read `face.scale.set((w - 0.35) * dir, h - 0.3, 1)` — a NEGATIVE X
         * SCALE to turn the plane round. That does turn it round, and it is
         * still wrong, in the way this project keeps finding:
         *
         *   three DOES compensate the culling. `renderBufferDirect` computes
         *   `frontFaceCW = object.matrixWorld.determinant() < 0` and
         *   `setMaterial` flips `flipSided` from it, so the mirrored plane is
         *   rasterised the right way round and nothing vanishes.
         *
         *   three does NOT compensate the normal. `vNormal` is
         *   `normalMatrix * objectNormal`, the inverse transpose, and a mirror
         *   in x leaves a normal along z exactly where it was; `FLIP_SIDED` in
         *   `defaultnormal_vertex` comes from `material.side === BackSide` and
         *   never from `frontFaceCW`.
         *
         * So six sign faces were VISIBLE AND LIT FROM BEHIND — shading normal
         * pointing into the plate, sun on the front reading as no sun at all,
         * §5.7's canyon term sampling the hemisphere on the wrong side. It did
         * not show as a missing sign, which is why looking never found it: a
         * sign plate is dominated by its own emissive term, and emissive does
         * not use the normal. Only the lit component was wrong, on the one
         * element of the frame whose lit component is the smallest part of it.
         *
         * A rotation is a proper transform: determinant +1, winding preserved,
         * normal carried round with the geometry rather than left behind by it.
         *
         * AND EVERY MESH IN THIS FUNCTION IS NAMED NOW, which is half of why it
         * took thirteen sessions. The winding census keys its rows by mesh
         * name; six unnamed planes, two unnamed roads and sixteen unnamed
         * pavement slabs all folded into one row called `(unnamed)`, and a row
         * that says "six of ninety-seven of these are mirrored" cannot be
         * chased. CONTRACT §9.1's "a refactor that erases a category also
         * erases the check on it", with a missing string instead of a merge.
         */
        /**
         * AND THE BACK FACE IS EMITTED ONLY ON A BLADE SIGN, WHICH THE OLD
         * COMMENT SAID AND THE OLD CODE DID NOT DO.
         *
         * It read "the back of a wall sign is never seen anyway" and then built
         * one. Three of the six signs are `blade: false`, so three emissive
         * quads sat flush against a facade with their fronts pointing into the
         * masonry: three draw calls a frame, zero pixels, for thirteen
         * sessions. Measured by the same census, at the best of six poses on
         * three routes: `block:sign:1|3|5:face:back` present 0.0000 of their
         * area to the eye, against 0.5 to 1.0 for every face that is seen.
         *
         * It is the ground quad's defect with a different cause — that one was
         * wound the wrong way, this one is aimed the wrong way — and it has the
         * identical signature, which is the argument for having measured the
         * signature rather than the cause: a draw call whose count does not
         * change the frame.
         */
        for (const dir of sign.blade ? [1, -1] : [1]) {
          const face = new THREE.Mesh(planeGeo, glow);
          face.scale.set(w - 0.35, h - 0.3, 1);
          face.rotation.y = dir > 0 ? 0 : Math.PI;
          face.position.z = 0.125 * dir;
          face.name = `block:sign:${i}:face:${dir > 0 ? 'front' : 'back'}`;
          group.add(face);
        }

        // The bracket that holds a blade sign off the wall.
        if (sign.blade) {
          const bracket = new THREE.Mesh(boxGeo, matMetal);
          bracket.scale.set(0.14, 0.14, w + 1.6);
          bracket.position.set(0, h / 2 - 0.2, 0);
          bracket.name = `block:sign:${i}:bracket`;
          group.add(bracket);
        }

        const tubeMat = emissiveMaterial(ctx, {
          chroma: sign.chroma,
          nits: sign.dead ? 0.0 : EMISSIVE.neonTube,
        });
        const tubes = rngSigns.int(2, 4);
        for (let t = 0; t < tubes; t++) {
          const tube = new THREE.Mesh(boxGeo, tubeMat);
          const th = 0.16;
          tube.scale.set(w * rngSigns.range(0.45, 0.86), th, 0.1);
          tube.position.set(
            rngSigns.range(-w * 0.12, w * 0.12),
            (t - (tubes - 1) / 2) * (h / (tubes + 0.6)),
            0
          );
          tube.scale.z = 0.42;
          tube.name = `block:sign:${i}:tube:${t}`;
          group.add(tube);
        }

        group.name = `block:sign:${i}`;
        root.add(group);

        if (!sign.dead) {
          signLights.push(
            lights.add({
              role: 'block',
              position: p.clone().add(n.clone().multiplyScalar(1.1)),
              color: sign.chroma,
              intensity: 55,
              radius: 11,
              type: 'point',
              sourceRadius: Math.max(w, h) * 0.4,
            })
          );
        }
      });

      ctx.scene.add(root);

      // ---- what the block is worth, as light ------------------------------

      /**
       * The facade's own average emitted radiance, in cd/m².
       *
       * Measured off the instances that were actually placed, not authored: sum
       * (area × nits × chromaticity) over every lit window, shop pane and sign
       * face, divided by the facade area they are spread across. If a third of
       * the shop bays are shuttered and the lit fraction of a building's
       * windows came out at 0.31, this number knows.
       *
       * It is the term that replaces session 1's forty facade-spill lights, and
       * it is on all four frames rather than only at night: office and shop
       * lighting burns through the working day, and it is the exposure system's
       * job to express that you cannot see it against 100 klx.
       */
      const emissiveFlux = [0, 0, 0];
      const sv = new THREE.Vector3();
      const accumulate = (matrices, chroma, nits) => {
        for (const m of matrices) {
          const a =
            sv.setFromMatrixColumn(m, 0).length() * sv.setFromMatrixColumn(m, 1).length();
          emissiveFlux[0] += a * chroma[0] * nits;
          emissiveFlux[1] += a * chroma[1] * nits;
          emissiveFlux[2] += a * chroma[2] * nits;
        }
      };
      const windowChroma = [
        kelvinToLinearRGB(2450),
        EMITTER_CHROMA.fluorescentDirty,
        EMITTER_CHROMA.fluorescentCold,
        EMITTER_CHROMA.sodium,
      ];
      const windowNits = [
        EMISSIVE.windowWarm,
        EMISSIVE.windowDirty,
        EMISSIVE.windowCold,
        EMISSIVE.windowDim,
      ];
      const shopNits = [EMISSIVE.shopBright, EMISSIVE.shopWarm, EMISSIVE.shopCold, EMISSIVE.shopDim];
      windowInstances.forEach((list, i) => accumulate(list, windowChroma[i], windowNits[i]));
      accumulate(windowOffInstances, kelvinToLinearRGB(2900), 1.1);
      /** Session 30. Same material, same radiance, so the same row. */
      accumulate(shopBayOffInstances, kelvinToLinearRGB(2900), 1.1);
      shopBayInstances.forEach((list, i) => accumulate(list, SHOP_CHROMA[i], shopNits[i]));

      let facadeArea = 0;
      let heightSum = 0;
      /**
       * The block's mean facade albedo, AREA-WEIGHTED.
       *
       * This is the number the canyon field multiplies to turn sunlight into
       * the bounce that lights the shadowed half of the street, and it used to
       * be one material's colour. With four base materials it has to be the
       * mean of what is actually on the walls, weighted by how much wall each
       * one covers — a tall brick building contributes more than a short
       * rendered one. Getting this wrong would not look like an error, it would
       * look like the noon road drifting blue again, which is the gate with the
       * least margin in the project (B/R 1.148 against a 1.15 ceiling).
       */
      const albedoSum = [0, 0, 0];
      for (const b of buildings) {
        // The three facades that carry detail: the street face and both ends.
        const area = (b.width + 2 * b.depth) * b.height;
        facadeArea += area;
        heightSum += b.height;
        for (let c = 0; c < 3; c++) albedoSum[c] += b.albedo[c] * area;
      }
      const facadeEmissive = emissiveFlux.map((v) => v / Math.max(facadeArea, 1));
      const facadeAlbedo = albedoSum.map((v) => v / Math.max(facadeArea, 1));

      const lin = (m) => [m.color.r, m.color.g, m.color.b];
      const carriage = cfg.streetWidth;
      const walks = cfg.sidewalkWidth * 2;
      const asphaltA = lin(matAsphalt);
      const paveA = lin(matPavement);
      const groundAlbedo = asphaltA.map(
        (v, i) => (v * carriage + paveA[i] * walks) / (carriage + walks)
      );

      /**
       * Points the canyon module re-marches on the CPU for the two answers a
       * texture lookup cannot give it: how open the carriageway is to the sky,
       * and how open a facade is. Both feed the facade and ground radiances.
       */
      const roadProbes = [];
      for (let i = -3; i <= 3; i++) roadProbes.push([i * 22, 0.05, 0]);
      const facadeProbes = [];
      for (const b of buildings) {
        for (const f of [0.3, 0.6]) {
          facadeProbes.push([b.x, b.height * f, b.z - b.side * (b.depth / 2 + 0.5)]);
        }
      }

      return {
        root,
        buildings,
        get lampsOn() {
          return lampsOn;
        },
        /** Axis-aligned footprints with a height, for src/lib/canyon.js. */
        occluders,

        /**
         * WHAT A PERSON STANDING AT (x, z) INSIDE THE ORIGIN BLOCK IS STANDING
         * ON, in the same shape `city.surfaceAt` returns.
         *
         * The block authors its own street — `city.js` clips every streamed
         * ground quad out of `BLOCK_KEEPOUT` so that this one wins — and until
         * session 19 it was the only place in the world with a REAL kerb: the
         * pavement is a box whose top is `BLOCK.kerbHeight` = 0.160 m, against
         * the 0.030 m the streamed pavement used to sit at.
         *
         * SESSION 19 MADE THE REST OF THE CITY AGREE WITH THIS FUNCTION RATHER
         * THAN THE OTHER WAY ROUND, and that direction is the finding. Every
         * height here — 0.000 for the carriageway, `kerbHeight` for the
         * pavement, −0.020 for the earth — was already the datum every OBJECT
         * in the project is authored against; `city.js`'s `GROUND_Y` was the one
         * table that disagreed. It now reads `constants.js` → `GROUND`, and so
         * does this. Two consequences worth stating:
         *
         *   the streamed kerb   0.010 m → 0.160 m, i.e. the same kerb as here
         *   the 98.5 m overlap  the walk spans |x| ∈ [6.5, 266.5] and
         *                       `BLOCK_KEEPOUT.x1` is 168, so for 98.5 m at each
         *                       end this pavement stands over the streamed one.
         *                       That overlap still EXISTS — it is a geometry
         *                       overlap and nothing here removed it — but the
         *                       0.130 m STEP it produced at x = ±266.5 is now
         *                       0.000, because both pavements are
         *                       `GROUND.pavement` by construction. A walker
         *                       crosses it and feels nothing.
         *
         * Derived from the same four numbers the meshes above are built from
         * (`halfStreet`, `halfCross`, `walkOuter`, `walkSpan`) rather than from
         * a transcription of them, so a change to the street's width moves both
         * the geometry and this together.
         */
        surfaceAt: blockSurfaceAt,
        /** Horizontal extent of everything that occludes. The canyon module adds its own margin. */
        extent: occluders.reduce(
          (e, o) => ({
            min: [Math.min(e.min[0], o.x0), Math.min(e.min[1], o.z0)],
            max: [Math.max(e.max[0], o.x1), Math.max(e.max[1], o.z1)],
          }),
          { min: [Infinity, Infinity], max: [-Infinity, -Infinity] }
        ),
        surfaces: {
          facadeAlbedo,
          facadeEmissive,
          groundAlbedo,
          /** Facade to facade, not kerb to kerb: the canyon is wider than the road. */
          canyonWidth: carriage + walks,
          meanFacadeHeight: heightSum / buildings.length,
        },
        roadProbes,
        facadeProbes,
        /**
         * WHAT THE BLOCK ACTUALLY VARIES — session 3's structural gate reads
         * this, and every number in it is read back off the buffers that were
         * uploaded rather than off the intent that produced them.
         *
         * `roughness` and `albedo` come out of the live `block:bodies` mesh:
         * the instanced attribute and `instanceColor` are exactly what the GPU
         * is handed, so a gate reading them cannot be satisfied by an era table
         * that nobody wired up. Everything else is a fact about the generator's
         * decisions — a floor height is not a thing a screenshot can measure
         * without measuring the camera too.
         */
        get variation() {
          const bodies = root.getObjectByName('block:bodies');
          const rough = bodies && bodies.geometry.getAttribute('noctisRough');
          const color = bodies && bodies.instanceColor;
          return {
            eras: buildings.map((b) => b.era.id),
            materials: buildings.map((b) => b.baseMaterial.id),
            conditions: buildings.map((b) => +b.condition.toFixed(3)),
            floorHeights: buildings.map((b) => +b.floorHeight.toFixed(3)),
            rhythms: buildings.map((b) => b.era.rhythm),
            groundFloors: buildings.map((b) => b.era.ground),
            corniceDepths: buildings.map((b) => b.era.cornice.project),
            windowWallRatios: buildings.map((b) => +b.windowWallRatio.toFixed(4)),
            /** Straight off the instanced attribute the shader samples. */
            roughness: rough ? Array.from(rough.array, (v) => +v.toFixed(3)) : null,
            albedo: color
              ? buildings.map((_, i) => [
                  +color.array[i * 3].toFixed(3),
                  +color.array[i * 3 + 1].toFixed(3),
                  +color.array[i * 3 + 2].toFixed(3),
                ])
              : null,
            /** The area-weighted mean the canyon bounce is computed from. */
            meanAlbedo: facadeAlbedo.map((v) => +v.toFixed(3)),
            /** Lumens per streetlight, from the distribution the shader evaluates. */
            luminaireLumens: Math.round(beamLumens),
          };
        },
        counts: {
          buildings: buildings.length,
          windowsLit: windowInstances.reduce((a, l) => a + l.length, 0),
          windowsOff: windowOffInstances.length,
          shopBays: shopBayInstances.reduce((a, l) => a + l.length, 0),
          /** Session 30. Glazed on a frontage that does not trade. */
          shopBaysUnlit: shopBayOffInstances.length,
          shopsClosed: shutterInstances.length,
          /**
           * Session 30, and it is the pair CONTRACT §7.2 asks for: `retailRuns`
           * is a COUNT of frontages that trade and `retailBuildings` is how many
           * ground floors that actually lit, which is the quantity the count
           * stands for and is not derivable from it — a run carries two or three
           * buildings, and a run that does not trade still lights whichever of
           * them is a shopfront era. (The corner-shop exception this comment
           * used to name was replaced; see `BLOCK_RETAIL`.)
           */
          retailRuns: runTrades.filter(Boolean).length,
          retailRunsTotal: runTrades.length,
          retailBuildings: buildings.filter((b) => b.retail).length,
          plinthOpenings,
          shopLightsRefused,
          adPillars: pillarInstances.length / 3,
          adPillarsRefused: pillarsRefused,
          busStops,
          busStopsRefused,
          streetlights: lampLights.length,
          signs: signLights.length,
          shopLights: shopLights.length,
          occluders: occluders.length,
          /** Session 45. The block's own paint; `city.js` counts the lattice's. */
          markings: markingCount,
        },
      };
    },

    update(ctx) {
      const lighting = ctx.get('lighting');
      if (!lighting) return;

      // CONTRACT §3: a photocell, not a clock. The street lights up because the
      // ambient illuminance fell below 260 lux, which happens to be dusk.
      const on = lighting.photocellOn;
      if (on === lampsOn) return;
      lampsOn = on;

      // Only the street lighting is on the photocell. Shop interiors, office
      // lights and signage are lit through the working day too — you simply
      // cannot see them against 100 000 lux, which is the exposure system's job
      // to express, not the emitter's.
      for (const l of lampLights) l.intensity = on ? l.userData.candela : 0;
      lampMaterial.emissiveIntensity = on ? LAMP_BOWL.originNits : 0.5;
    },

    dispose(ctx) {
      ctx.scene.remove(root);
      for (const d of disposables) d.dispose && d.dispose();
      disposables.length = 0;
      const lights = ctx.get('lights');
      if (lights) {
        for (const l of [...lampLights, ...signLights, ...shopLights]) lights.remove(l);
      }
      lampLights = [];
      signLights = [];
      shopLights = [];
    },
  };
}
