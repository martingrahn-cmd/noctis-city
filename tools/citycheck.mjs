#!/usr/bin/env node
/**
 * citycheck.mjs — the authored-city gate. docs/authored-city.md, all six items.
 *
 *   node tools/citycheck.mjs
 *   node tools/citycheck.mjs --json
 *
 * Exit 0 = green, 1 = a criterion violated, 2 = the harness itself failed.
 *
 * WHAT THIS GATE READS
 *
 * Placement data, not pixels — with one stated exception. Five of the six
 * criteria are properties of *how the world is generated*, and a screenshot can
 * only ever be evidence about them. "60% of objects are off-axis by under three
 * degrees" is a fact about the generator's output; measuring it from a render
 * would mean detecting objects in an image in order to recover a number the
 * generator already knows. So the harness hands over the placement dataset and
 * the assertions run on that.
 *
 * The exception is the saturation reserve, which is inherently about pixels: it
 * is a claim about what fraction of the *frame* is allowed to be saturated, and
 * there is no placement-data equivalent. It is sampled along the night route.
 *
 * WHAT IT DOES NOT DO
 *
 * It does not check that the city is beautiful, and it cannot. Every threshold
 * here rejects a specific, named way of looking generated; passing all six is
 * necessary and nowhere near sufficient. Look at the frames.
 */

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { startServer, launchBrowser, openPage, readRendererString, rendererIsSoftware } from './lib/page.mjs';
import { decodePNG } from './lib/png.mjs';
/**
 * The pure generator, imported so the river's clearance from the authored
 * landmarks is measured from the same functions the world is built from rather
 * than from a transcription of them (CONTRACT §9.1).
 */
import {
  CITY, LANDMARKS, landmarkAABB, riverEdges, bridgeSpec, bridgeIndexAt,
  generateChunk, viaductArc, viaductPiers, latticeCarriageway, BLOCK_KEEPOUT,
} from '../src/lib/citygen.js';
/**
 * The conflict table itself, so the gate and the generator judge an overlap by
 * ONE rule. A gate carrying its own copy of "which categories may not overlap"
 * is CONTRACT §9.1's arrangement with a table instead of a spacing, and it is
 * how `pierEvery: 34` sat beside `i % 3 === 0` for a session.
 */
import { findConflicts, conflictPairs } from '../src/lib/occupancy.js';
/**
 * The DERIVATION side of the lamp-bowl check. `harness.lampBowlCensus()` is the
 * delivered side; these are the geometry the radiance was divided by, so the
 * two can disagree and the disagreement is the finding (CONTRACT §9 rule 7).
 */
import { LAMP_BOWL } from '../src/core/constants.js';

/**
 * The seed the pages below are opened with, in one place, so the gate's own
 * generator calls and the world it is measuring cannot be seeded differently.
 */
const SEED = '1337';

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);
const JSON_OUT = args.has('json');
const log = (...m) => { if (!JSON_OUT) console.log(...m); };

const BUDGET = JSON.parse(await readFile(new URL('./city-budget.json', import.meta.url), 'utf8'));
/** Session 14: this block existed from 4b and nothing read it. See `$UNREAD_UNTIL_S14`. */
const SL = BUDGET.streetLevel;

const fails = [];
const notes = [];
const fail = (tag, msg) => fails.push(`[${tag}] ${msg}`);

// ---------------------------------------------------------------------------
// budget sanity, before a single frame is rendered
//
// The same rule the look gate has: a threshold nobody has thought about is not
// a threshold. These reject a city-budget.json that could not fail.

{
  const b = BUDGET;
  if (!(b.clumping.minDensityCV > 0.2)) fail('budget', 'minDensityCV below 0.2 would pass grid-with-jitter');
  if (!(b.alignment.maxDeviationDeg <= 5)) fail('budget', 'maxDeviationDeg above 5° is not "imperfect alignment", it is broken');
  if (!(b.alignment.minOffAxisFraction >= 0.5)) fail('budget', 'minOffAxisFraction below 0.5 is a minority');
  if (!(b.saturation.maxFraction <= 0.2)) fail('budget', 'a saturation reserve above 20% is not a reserve');
  if (!(b.saturation.threshold >= 0.6)) fail('budget', 'the saturation threshold is the addendum\'s 0.6 and may not be raised');
  if (!(b.saturation.valueThreshold <= 0.6)) fail('budget', 'a value threshold above 0.6 would exclude most real signage and make the reserve unmeasurable');
  /**
   * `glows ⊆ bright` — the conjunction implies its own second conjunct — so a
   * bright floor at or below the glow floor is implied by it and can never
   * fire on its own. That is a floor that cannot fail, which is the thing §7.1
   * exists to prevent, and it is arithmetic rather than taste.
   */
  if (!(b.saturation.minBrightFraction > b.saturation.minFraction)) {
    fail('budget', `minBrightFraction ${b.saturation.minBrightFraction} must exceed minFraction ${b.saturation.minFraction} — ` +
      'every glowing pixel is a bright one, so a bright floor under the glow floor is implied and inert');
  }
  if (!(b.saturation.minBrightFraction < b.saturation.maxFraction)) {
    fail('budget', 'a bright floor at or above the glow ceiling asks for more bright pixels than the reserve allows glowing ones to sit inside');
  }
  if (!(b.landmarks.min >= 6 && b.landmarks.max <= 10)) fail('budget', 'landmark count must stay inside the 6–10 the addendum specifies');
  if (!(b.negativeSpace.minLowDetailFraction >= 0.08)) fail('budget', 'negative space floor below the 8% the addendum specifies');
  if (!(b.vintage.minEras >= 4)) fail('budget', 'fewer than the 4 eras the addendum specifies');
  // The two blocks added this session get the same treatment as the six: a
  // threshold nobody has thought about is not a threshold.
  if (!(b.pedestrians.minDensityCV >= b.clumping.minDensityCV)) {
    fail('budget', 'a pedestrian clumping floor below the props\' is a crowd distributed like street furniture');
  }
  if (!(b.sceneWalk.maxPropsInsideBuildings === 0)) {
    fail('budget', 'any number of props inside buildings above zero is a placement test that was not run');
  }
}

// ---------------------------------------------------------------------------
// every threshold this gate applies to a measurement, in one pure function
//
// The measuring takes a server, a browser, a streamed city and forty seconds.
// The judging is arithmetic on the two dozen numbers that come out of it. They
// are separated here so that `--falsify` below can perturb one number at a time
// and require the gate to notice, without rendering anything — CONTRACT §7.1,
// and the reason it is a rule is that three checks in this project went quiet
// rather than red and a quiet gate reads as a green one in every report.
//
// `M` is the whole measured state and the only thing this reads besides the
// budget. No globals, no page, no frames. The `notes.push` lines stay beside the
// measurements that produced them, because a note describes and this decides.
//
// The budget-sanity block above is deliberately NOT in here. It compares the
// thresholds against each other rather than the city against the thresholds, so
// there is no measured value to perturb: its falsifying case is a budget file,
// not a city.
//
// @param  {object} M       every measured aggregate, and nothing else
// @param  {object} BUDGET  tools/city-budget.json
// @return {Array<[string, string]>} one [tag, message] per violation, gate order

function judgeCity(M, BUDGET) {
  const out = [];
  const SW = BUDGET.sceneWalk;
  const PED = BUDGET.pedestrians;
  const SL = BUDGET.streetLevel;
  const L = BUDGET.landmarks;
  const RV = BUDGET.river;

  // 1. clumping, not uniform distribution
  if (M.propCV < BUDGET.clumping.minDensityCV) {
    out.push(['clumping', `prop density CV ${M.propCV.toFixed(3)} < ${BUDGET.clumping.minDensityCV} — the city is spread evenly, which is grid-with-jitter no matter how it was generated`]);
  }
  if (M.populatedFraction < BUDGET.clumping.minPopulatedFraction) {
    out.push(['clumping', `only ${(M.populatedFraction * 100).toFixed(0)}% of chunks have anything in them — a high CV bought by emptiness is not clumping`]);
  }

  // 1a. the scene walk — what was BUILT, against what was written down
  if (!M.hasCensus) {
    out.push(['sceneWalk', 'harness.sceneCensus() returned nothing — the live scene is unmeasured']);
  } else {
    // Both halves, because the original condition was `streamed &&
    // streamed.timedOut` and the message reads five fields off the object. The
    // live path cannot set the flag without the object, but a judging function
    // that throws on a state it was handed is not a judging function.
    if (M.streamedTimedOut && M.streamed) {
      out.push([
        'sceneWalk',
        `the city had not finished arriving when the census was taken — it measures the streaming ` +
        `system, not the city. Bound hit: ${M.streamed.timedOutOn} after ${M.streamed.frames} frames / ` +
        `${M.streamed.ms} ms, with ${M.streamed.field ? M.streamed.field.queued : '?'} bakes still queued and ` +
        `${M.streamed.field ? M.streamed.field.inFlight : '?'} in flight. 'wall' means a bake is slow or ` +
        `stuck; 'frames' means the renderer stopped. Do NOT raise the frame budget for a 'wall' ` +
        `timeout — the frame count is not what governs here (CONTRACT §9 row 18).`,
      ]);
    }
    if (SW.requireEveryInstancedMeshLabelled && M.unlabelled > 0) {
      out.push([
        'sceneWalk',
        `${M.unlabelled} of ${M.instancedMeshes} instanced meshes carry no census label, so ` +
        `what they contain cannot be compared against what was written down. A gate that reads config ` +
        `verifies the config.`,
      ]);
    }
    if (M.mismatches.length) {
      const m = M.mismatches[0];
      out.push([
        'sceneWalk',
        `${M.mismatches.length} mesh(es) hold a different number of instances from the number they ` +
        `describe — e.g. '${m.name}' labels ${m.labelled} and allocated ${m.allocated}`,
      ]);
    }
    if (M.underdrawnFraction > SW.maxUnderdrawnFraction) {
      out.push([
        'sceneWalk',
        `${M.underdrawn} of ${M.instancedMeshes} meshes draw fewer instances than they ` +
        `allocated (${(M.underdrawnFraction * 100).toFixed(1)}% > ${(SW.maxUnderdrawnFraction * 100).toFixed(0)}%) — ` +
        `instance buffers resident and not used`,
      ]);
    }
    if (SW.requireSignCollisionTest) {
      if (!M.signQuadTotal) {
        out.push([
          'sceneWalk',
          `harness.signPlacement() returned no sign quads, so where the city's signage ENDED UP is ` +
          `unmeasured. That is a failure and not a pass: it is exactly the state the city was in for ` +
          `thirteen sessions, when all 208 signs sat a median 9.51 m inside their own buildings.`,
        ]);
      } else {
        if (M.signsInsideBuildings > SW.maxSignsInsideBuildings) {
          out.push([
            'sceneWalk',
            `${M.signsInsideBuildings} of ${M.signQuadTotal} delivered sign quads (` +
            `${((M.signsInsideBuildings / M.signQuadTotal) * 100).toFixed(1)}%) are inside a building — ` +
            `a sign buried in masonry is submitted every frame and never seen, which is the same ` +
            `class of defect as a surface wound the wrong way and is invisible to every other gate here.`,
          ]);
        }
        if (M.signStandoffSpread < SW.minSignStandoffSpreadM) {
          out.push([
            'sceneWalk',
            `sign standoff spread ${M.signStandoffSpread} m (p10 ${M.signStandoffP10}, p90 ${M.signStandoffP90}) ` +
            `under the ${SW.minSignStandoffSpreadM} m floor — every sign is at the same distance from its ` +
            `elevation, so the mounting vocabulary is a table of names rather than four things a person ` +
            `can tell apart. CONTRACT §7.2: the category count is paired with this and not trusted alone.`,
          ]);
        }
      }
      if (M.signMountings < SW.minSignMountings) {
        out.push([
          'sceneWalk',
          `${M.signMountings} distinct sign mounting(s) (${(M.signMountingList || []).join(', ')}), under the ` +
          `${SW.minSignMountings} floor — session 3 shipped one mounting and a colour roll.`,
        ]);
      }
    }
    if (SW.requirePropCollisionTest && M.propsInsideBuildings > SW.maxPropsInsideBuildings) {
      out.push([
        'sceneWalk',
        `${M.propsInsideBuildings} of ${M.propTotal} props (${((M.propsInsideBuildings / Math.max(1, M.propTotal)) * 100).toFixed(1)}%) stand ` +
        `inside a building — anything placed procedurally is tested against the existing occupancy, or ` +
        `it is not placed. citygen.js scatters over the whole island and tests only the landmark keep-outs.`,
      ]);
    }
  }

  // 1a-iii. street level — the block city-budget.json has carried unread since 4b
  if (!M.hasStalls) {
    out.push([
      'streetLevel',
      `harness.stallCensus() returned nothing, so the whole streetLevel block is unmeasured. ` +
      `UNRUN, not passed — that is the state it was in from session 4b to session 14.`,
    ]);
  } else {
    if (M.stallTotal < SL.minStallsNearRing) {
      out.push(['streetLevel', `${M.stallTotal} stalls in the ring, under the ${SL.minStallsNearRing} floor`]);
    }
    if (M.stallKinds < SL.minStallKinds) {
      out.push([
        'streetLevel',
        `${M.stallKinds} stall kinds delivered, under the ${SL.minStallKinds} floor — a count of kinds, ` +
        `paired with the awning spread below because a count cannot see that every kind is the same shape.`,
      ]);
    }
    if (M.stallLightSlots > SL.maxStallLightSlots) {
      out.push(['streetLevel', `${M.stallLightSlots} stall light slots over the ${SL.maxStallLightSlots} allowance`]);
    }
    if (M.awningCloths < SL.minAwningCloths) {
      out.push(['streetLevel', `${M.awningCloths} awning cloths delivered, under the ${SL.minAwningCloths} floor`]);
    }
    if (M.awningChromaSpread < SL.minAwningChromaSpreadLinear) {
      out.push([
        'streetLevel',
        `widest pair of delivered awning reflectances is ${M.awningChromaSpread} apart in linear RGB, under ` +
        `the ${SL.minAwningChromaSpreadLinear} floor — the canopies are one colour with several names, which is ` +
        `what shipped through session 13 and reads exactly 0.000 here.`,
      ]);
    }
  }

  // 1b. pedestrian clumping — the same claim as §1, about a different population
  if (!M.hasPedestrians) {
    out.push([
      'pedestrians',
      `no pedestrian population exists, so its density CV cannot be measured against the ` +
      `${PED.minDensityCV} floor. UNRUN, not passed — an empty city trivially satisfies every ` +
      `distribution. Session 4b makes it green by shipping a crowd that clumps.`,
    ]);
  } else {
    if (M.pedTotal < PED.minTotal) {
      out.push(['pedestrians', `${M.pedTotal} pedestrians < ${PED.minTotal} — a CV over that many people is a CV over that many people`]);
    }
    if (M.pedCV < PED.minDensityCV) {
      out.push([
        'pedestrians',
        `pedestrian density CV ${M.pedCV} < ${PED.minDensityCV} — a crowd no more clumped ` +
        `than the props (0.712 delivered) is bollards that walk`,
      ]);
    }
    if (M.pedPopulatedFraction < PED.minPopulatedFraction) {
      out.push(['pedestrians', `only ${(M.pedPopulatedFraction * 100).toFixed(0)}% of chunks have anybody in them — a high CV bought by emptiness is not clumping`]);
    }
  }

  // 2. age, wear and mixed vintage
  if (M.eras < BUDGET.vintage.minEras) out.push(['vintage', `${M.eras} eras < ${BUDGET.vintage.minEras}`]);
  if (!M.signCount) out.push(['vintage', 'no signage at all — the non-working fraction is undefined']);
  else if (M.deadSignFraction < BUDGET.vintage.minDeadSignageFraction) {
    out.push(['vintage', `${(M.deadSignFraction * 100).toFixed(1)}% of signage is non-working < ${(BUDGET.vintage.minDeadSignageFraction * 100).toFixed(0)}% — everything works, which nothing does`]);
  } else if (M.deadSignFraction > BUDGET.vintage.maxDeadSignageFraction) {
    out.push(['vintage', `${(M.deadSignFraction * 100).toFixed(1)}% of signage is non-working > ${(BUDGET.vintage.maxDeadSignageFraction * 100).toFixed(0)}% — that is a blackout, not wear`]);
  }
  if (M.roadVariants < BUDGET.vintage.minRoadMaterialVariants) {
    out.push(['vintage', `${M.roadVariants} road material variants < ${BUDGET.vintage.minRoadMaterialVariants}`]);
  }

  // 3. imperfect alignment — both bounds matter
  if (!M.placedCount) out.push(['alignment', 'no placed objects to measure']);
  if (M.offAxisFraction < BUDGET.alignment.minOffAxisFraction) {
    out.push(['alignment', `only ${(M.offAxisFraction * 100).toFixed(1)}% of objects deviate from the axis < ${(BUDGET.alignment.minOffAxisFraction * 100).toFixed(0)}%`]);
  }
  if (M.maxDeviation > BUDGET.alignment.maxDeviationDeg) {
    out.push(['alignment', `largest deviation ${M.maxDeviation.toFixed(2)}° > ${BUDGET.alignment.maxDeviationDeg}° — that reads as broken, not as hand-placed`]);
  }

  // 4. the saturation reserve — the one pixel measurement
  //
  // UNRUN IS A FAILURE, NOT A SKIP — session 21. The refusal on a software
  // renderer moved from the top of the run (where it suppressed every other
  // assertion in this gate) to here (where it suppresses only itself). It still
  // fails: CONTRACT §10, *a gate that cannot run is not a green gate*.
  if (M.softwareRenderer) {
    out.push(['saturation',
      'UNRUN — the saturation sample needs a hardware rasteriser and this run had SwiftShader. ' +
      'Every placement assertion in this gate ran; this one did not, and an unrun assertion is red.']);
  } else if (M.satMax > BUDGET.saturation.maxFraction) {
    out.push(['saturation', `${(M.satMax * 100).toFixed(2)}% of pixels above ${BUDGET.saturation.threshold} saturation > ${(BUDGET.saturation.maxFraction * 100).toFixed(0)}% — if everything glows, nothing glows`]);
  }
  if (!M.softwareRenderer && M.satMax < BUDGET.saturation.minFraction) {
    out.push(['saturation', `only ${(M.satMax * 100).toFixed(3)}% of pixels are saturated anywhere on the night route — the reserve has been spent on nothing`]);
  }
  /**
   * THE OTHER HALF OF THE SAME PREDICATE. See `isBright`. A ceiling on
   * saturated-and-bright pixels is satisfied by darkening, so the thing it is
   * paired with is a floor on bright pixels regardless of their chromaticity.
   */
  if (!M.softwareRenderer && M.brightMean < BUDGET.saturation.minBrightFraction) {
    out.push(['saturation', `only ${(M.brightMean * 100).toFixed(2)}% of pixels on the night route are above ` +
      `${BUDGET.saturation.valueThreshold} value < ${(BUDGET.saturation.minBrightFraction * 100).toFixed(2)}% — ` +
      `the reserve's ceiling is being met by turning the lights down`]);
  }

  /**
   * 4a. THE LAMP BOWL RATCHET — session 28, CONTRACT §9 rule 7 and §9.1.
   *
   * One object had two radiances in two files and nothing compared them. The
   * derivation is now single-sourced in `constants.js` → `LAMP_BOWL`; this is
   * the check on the OTHER end, over `harness.lampBowlCensus()`, which reads
   * the `emissiveIntensity` that arrived on the live material and the
   * sphere-zone parameters of the geometry it is drawn on.
   *
   * A gate that read the constants would verify the constants. These four
   * sites can only fail on a disagreement between the derivation and what the
   * scene actually got.
   */
  const LB = BUDGET.lampBowl;
  if (!M.lampBowl) {
    out.push(['lampBowl',
      'harness.lampBowlCensus() returned nothing — the delivered lamp radiances are unmeasured. ' +
      'UNRUN, not passed.']);
  } else if (M.lampBowl.lampsOn === false) {
    out.push(['lampBowl',
      'the photocell is OFF in the census page, so every bowl carries its 0.5 standby radiance and ' +
      'this check cannot tell a dark lamp from a wrong one. UNRUN, not passed.']);
  } else {
    if (M.lampBowl.paths.length < LB.minPaths) {
      out.push(['lampBowl',
        `only ${M.lampBowl.paths.length} tagged lamp-bowl path(s) in the delivered scene, expected at ` +
        `least ${LB.minPaths} — a path that stops declaring itself stops being compared, which is how ` +
        `the 42.86× split survived ten sessions`]);
    }
    for (const p of M.lampBowl.paths) {
      const ratio = p.deliveredNits / M.lampBowl.derivedNits;
      if (ratio < LB.minRatio || ratio > LB.maxRatio) {
        out.push(['lampBowl',
          `lamp path '${p.path}' delivers ${p.deliveredNits.toFixed(1)} cd/m² against a derived ` +
          `${M.lampBowl.derivedNits.toFixed(1)} — ${ratio.toFixed(4)}×, outside the ratchet ` +
          `[${LB.minRatio}, ${LB.maxRatio}]. These bounds may only ever move toward 1.0`]);
      }
      /**
       * BOTH ANGLE PAIRS. `theta` is what `bowlZoneAreaM2` integrates; `phi` is
       * the full revolution it assumes and would be silently wrong without.
       */
      const g = [['radiusM', LAMP_BOWL.radiusM],
        ['thetaStart', LAMP_BOWL.thetaStart], ['thetaLength', LAMP_BOWL.thetaLength],
        ['phiStart', LAMP_BOWL.phiStart], ['phiLength', LAMP_BOWL.phiLength]];
      for (const [k, want] of g) {
        if (p[k] == null || Math.abs(p[k] - want) > Math.abs(want) * LB.geometryTolerance) {
          out.push(['lampBowl',
            `lamp path '${p.path}' is drawn on a bowl whose ${k} is ${p[k]} where the radiance was ` +
            `derived over ${want} — the area on the screen is not the area in the derivation`]);
        }
      }
    }
  }

  // 5. negative space and dead zones
  if (M.lowDetailFraction < BUDGET.negativeSpace.minLowDetailFraction) {
    out.push(['negativeSpace', `${(M.lowDetailFraction * 100).toFixed(1)}% low-detail < ${(BUDGET.negativeSpace.minLowDetailFraction * 100).toFixed(0)}% — a uniformly interesting city is a generated one`]);
  }
  if (M.lowKinds < BUDGET.negativeSpace.minDistinctKinds) {
    out.push(['negativeSpace', `${M.lowKinds} kinds of dead zone < ${BUDGET.negativeSpace.minDistinctKinds}`]);
  }

  // 5a. the river — session 15. The §7.2 pair, plus the occupancy test §9.1
  // requires of anything placed, authored or not.
  if (!M.hasRiver) {
    out.push([
      'river',
      'harness.riverCensus() returned nothing, so nothing about the river is measured. UNRUN, not passed.',
    ]);
  } else {
    if (M.bridgesBuilt < RV.minBridgesBuilt) {
      out.push([
        'river',
        `${M.bridgesBuilt} bridge(s) built in the ${M.riverWindowM} m window, under the ` +
        `${RV.minBridgesBuilt} floor — the crossings are 512 m apart and the window is 1024 m, so ` +
        `anything under two is the bridge builder not running, which is also why the flood fill fails.`,
      ]);
    }
    if (M.bridgeStructures < RV.minBridgeStructures) {
      out.push([
        'river',
        `${M.bridgeStructures} bridge structure(s) delivered (${(M.bridgeStructureList || []).join(', ')}), ` +
        `under the ${RV.minBridgeStructures} floor — a count of kinds, paired with the above-deck spread ` +
        `below because a count cannot see that all three are flat decks.`,
      ]);
    }
    if (M.bridgeAboveDeckSpread < RV.minBridgeAboveDeckSpreadM) {
      out.push([
        'river',
        `bridge silhouette above the deck spans ${M.bridgeAboveDeckSpread.toFixed(2)} m across the ` +
        `delivered crossings, under the ${RV.minBridgeAboveDeckSpreadM} m floor — three names in a table ` +
        `do not make three structures, and above the deck is the only part of a bridge that reads at distance.`,
      ]);
    }
    if (M.landmarksAcrossWater < RV.minLandmarksAcrossWater) {
      out.push([
        'river',
        `${M.landmarksAcrossWater} landmark(s) visible across the water from eye height on a bank ` +
        `(${(M.landmarksAcrossWaterList || []).join(', ') || 'none'}), under the ${RV.minLandmarksAcrossWater} floor — ` +
        `a hundred metres of open water is the one place in this city a street-level eye has a long ` +
        `line, and a river nobody can see anything across is a gap in the block grid.`,
      ]);
    }
    if (M.riverLandmarkClearance < RV.minLandmarkClearanceM) {
      out.push([
        'river',
        `the water passes ${M.riverLandmarkClearance.toFixed(2)} m from ${M.riverLandmarkClearanceName}'s own ` +
        `boxes, under the ${RV.minLandmarkClearanceM} m floor — anything placed procedurally is tested ` +
        `against the existing occupancy, and an authored course is not exempt from that.`,
      ]);
    }
  }

  // 6. authored landmarks
  if (M.landmarkCount < L.min || M.landmarkCount > L.max) {
    out.push(['landmarks', `${M.landmarkCount} landmarks outside ${L.min}–${L.max}`]);
  }
  if (M.visibleFromElevation < L.minVisibleFromElevation) {
    out.push(['landmarks', `only ${M.visibleFromElevation} landmarks visible from elevation < ${L.minVisibleFromElevation} — a city you cannot orient yourself in feels generated`]);
  }
  if (L.requireAllReachable && M.unreachable.length) {
    out.push(['landmarks', `${M.unreachable.length} landmark(s) not reachable on foot: ${M.unreachable.join(', ')} — a landmark you cannot walk to is scenery`]);
  }
  if (M.worstDetourRatio != null && M.worstDetourRatio > L.maxPathDetourRatio) {
    out.push(['landmarks', `${M.worstDetourName} is ${M.worstDetourRatio.toFixed(2)}× the straight-line distance on foot > ${L.maxPathDetourRatio}×`]);
  }
  // `generatorProducible` is the landmarks WITHOUT `outsideGeneratorRange`, so a
  // non-empty list is exactly the old `outside.length !== landmarks.length`:
  // the two counts always sum to the total, so one of them being short is the
  // other one being non-empty.
  if (L.requireOutsideGeneratorRange && M.generatorProducible.length) {
    out.push(['landmarks', `${M.generatorProducible.join(', ')} could have been produced by the generator — a landmark the generator can make is not a landmark`]);
  }

  // 7. THE KEEP-OUT REGISTRY — session 21, and it is the check that generalises
  //    the two that were already here (`maxPropsInsideBuildings` and
  //    `maxSignsInsideBuildings`) and the six other instances neither of them
  //    could see. CONTRACT §9.1: anything placed procedurally is tested against
  //    the existing occupancy, or it is not placed.
  const OC = BUDGET.occupancy;
  if (OC) {
    if (M.genConflicts == null) {
      out.push(['occupancy', 'the generator produced no registry — `generateChunk` did not return `registry`']);
    } else if (M.genConflicts.length > OC.maxGeneratorConflicts) {
      out.push(['occupancy',
        `${M.genConflicts.length} forbidden overlap(s) among the GENERATOR's own claims (max ` +
        `${OC.maxGeneratorConflicts}). A generator that writes to the registry and does not read it is ` +
        `the defect this structure exists to make impossible. Worst: ` +
        M.genConflicts.slice(0, 4).map((c) => `${c.a.kind}(${c.a.owner}) x ${c.b.kind}(${c.b.owner}) ${c.areaM2} m2`).join('; ')]);
    }
    if (M.deliveredConflicts == null) {
      out.push(['occupancy', 'harness.occupancyCensus() returned nothing — the delivered world is unmeasured']);
    } else if (M.deliveredConflicts.length > OC.maxDeliveredConflicts) {
      out.push(['occupancy',
        `${M.deliveredConflicts.length} forbidden overlap(s) in the DELIVERED scene (max ` +
        `${OC.maxDeliveredConflicts}). This reads the emitted geometry, not the generator's description ` +
        `of it (§9.1). Worst: ` +
        M.deliveredConflicts.slice(0, 4).map((c) => `${c.a.kind}(${c.a.owner}) x ${c.b.kind}(${c.b.owner}) ${c.areaM2} m2`).join('; ')]);
    }
    if (M.deliveredClaims != null && M.deliveredClaims < OC.minDeliveredClaims) {
      out.push(['occupancy',
        `only ${M.deliveredClaims} delivered claims (min ${OC.minDeliveredClaims}) — a conflict check over ` +
        `an empty list passes for free, which is CONTRACT §7.1's quiet gate`]);
    }
    /**
     * SESSION 51 — A WALKABLE POINT WITH NO SURFACE UNDER IT.
     *
     * Three sessions have repaired this class in three places and every one of
     * them was found by the operator standing on it. See the budget's
     * `$surface` for the derivation of the zero and for the four places the
     * residue is.
     */
    if (M.surfaceCensus == null) {
      out.push(['occupancy', 'harness.surfaceCensus() returned nothing — nothing asked whether the city has a floor']);
    } else {
      if (M.surfaceCensus.walkable < OC.minWalkableSamples) {
        out.push(['occupancy',
          `only ${M.surfaceCensus.walkable} walkable samples (min ${OC.minWalkableSamples}) — a surface ` +
          `census over an empty lattice passes for free, which is CONTRACT §7.1's quiet gate`]);
      }
      if (M.surfaceCensus.bare > OC.maxBareWalkableSamples) {
        out.push(['occupancy',
          `${M.surfaceCensus.bare} of ${M.surfaceCensus.walkable} walkable samples ` +
          `(${(M.surfaceCensus.bareFraction * 100).toFixed(2)}%, ` +
          `${((M.surfaceCensus.bare * M.surfaceCensus.step * M.surfaceCensus.step) / 1e4).toFixed(2)} ha) ` +
          `stand on the block.js EARTH PLANE with no surface drawn over it (max ` +
          `${OC.maxBareWalkableSamples}). This is the player's own \`worldSurfaceAt\` on a ` +
          `${M.surfaceCensus.step} m lattice — the query that printed \`on earth at y -0.020\` twice ` +
          `in four positions after session 50. \`node tools/surfacegrid.mjs --patches\` says where.`]);
      }
    }
    if (M.viaductLegsOnCarriageway == null) {
      out.push(['occupancy', 'the viaduct reported no legs — `viaductPiers` did not return them']);
    } else if (M.viaductLegsOnCarriageway > OC.maxViaductLegsOnCarriageway) {
      out.push(['occupancy',
        `${M.viaductLegsOnCarriageway} viaduct portal leg(s) stand in a carriageway (max ` +
        `${OC.maxViaductLegsOnCarriageway}) — measured against the ideal road lattice, which is what ` +
        `viaductPiers places them against`]);
    }
    if (M.viaductPiersBlocked > OC.maxViaductPiersBlocked) {
      out.push(['occupancy',
        `${M.viaductPiersBlocked} pier(s) could not be placed clear at any offset or nudge (max ` +
        `${OC.maxViaductPiersBlocked}) — a flagged pier is a pier in the road that the search gave up on`]);
    }
    if (M.viaductLegMaxInBlockM != null && M.viaductLegMaxInBlockM > OC.viaductLegsInsideBlockClearBandM) {
      out.push(['occupancy',
        `a viaduct leg reaches |x| = ${M.viaductLegMaxInBlockM.toFixed(2)} m inside the origin block against ` +
        `the ${OC.viaductLegsInsideBlockClearBandM} m band session 5's placement argument is justified by. ` +
        `That sentence was prose and nothing checked it; measured before this session, a leg reached 12.18 m.`]);
    }
  }

  return out;
}

// ---------------------------------------------------------------------------

function mean(xs) { return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length); }
function stddev(xs) {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) * (x - m))));
}

/**
 * Does this pixel GLOW? Saturated and bright, both.
 *
 * HSV saturation alone is scale-invariant, so a road surface lit to 12 counts by
 * a sodium lamp measures 0.94 exactly as the lamp's own bowl does. See the
 * arithmetic in city-budget.json: the addendum's literal check cannot be passed
 * by any physically correct HPS-lit night frame, and what it is reaching for is
 * chromatic things bright enough to compete for attention.
 */
function glows(r, g, b, satMin, valMin) {
  const mx = Math.max(r, g, b);
  if (mx === 0) return false;
  const mn = Math.min(r, g, b);
  return (mx - mn) / mx > satMin && mx / 255 > valMin;
}

/**
 * THE SECOND CONJUNCT OF `glows`, ON ITS OWN. Session 16, and it is the floor
 * that pairs with the reserve's ceiling.
 *
 * `glows` is a CONJUNCTION, so there are two ways to lower it and the check is
 * only asking for one of them:
 *
 *   desaturate  — the chromaticity moves toward grey, `max(r,g,b)` does not.
 *                 `glows` falls, `bright` does not. This is what the reserve
 *                 is for: the addendum's "a few saturated signs that pop
 *                 precisely because everything around them is drab".
 *   darken      — the value falls under `valMin`. BOTH fall. The pixel leaves
 *                 the numerator not because it stopped competing for attention
 *                 but because it stopped being visible.
 *
 * A ceiling on the conjunction cannot tell those apart, and every reduction
 * this project made in answer to a saturation red was of the second kind:
 * `POST.glareStrength` 0.15 → 0.075, `LIGHT.signPlateNits` 6500 → 86,
 * `NITS_TAIL/BRAKE/FRONT` 555/2220/4400 → 45/180/70, the 2.78 m marker line
 * declined. Each is defensible on its own and the sum of them has no
 * instrument, because the only thing watching was a ceiling that a darker
 * frame satisfies by construction.
 *
 * So the two halves of one predicate are read as two bounds and written
 * together (CONTRACT §7.2): the ceiling asks whether the frame glows too much,
 * the floor asks whether there is anything left to look at. Neither can be
 * satisfied at the other's expense, because `glows ⊆ bright` — every glowing
 * pixel is a bright one — so raising the ceiling's numerator raises the
 * floor's, and the only way to fail one while passing the other is to move the
 * chromaticity, which is the move the reserve exists to encourage.
 */
const isBright = (r, g, b, valMin) => Math.max(r, g, b) / 255 > valMin;

/**
 * CONTRACT §7.3: the metric is run over the same code path on a frame that has
 * the property and on frames that do not, and both directions are required
 * before it is trusted. The "shape" here is a frame rather than a solid, so the
 * controls are transforms of a DELIVERED frame — the same bytes, through the
 * same `glows`/`isBright`, with one thing changed at a time.
 *
 * The expectations are derived, not observed, which is what makes them a check
 * on the instrument rather than the instrument grading its own homework (§7.7):
 *
 *   scaleValue(k>1)  every `max(r,g,b)` scales by k, so pixels cross `valMin`
 *                    upward and nothing crosses down. BOTH fractions rise. The
 *                    HSV saturation `(mx-mn)/mx` is scale-invariant, so no
 *                    pixel changes its saturation verdict except through the
 *                    8-bit clamp.
 *   scaleValue(k<1)  the mirror. BOTH fall — and this is the ratchet performed
 *                    on purpose: the ceiling is satisfied and the floor is not.
 *   desaturate(k)    each channel moves toward the pixel's own `mx`, which is
 *                    therefore a FIXED POINT of the transform. `bright` cannot
 *                    move at all — not approximately, exactly — and `glows`
 *                    falls. Measured on the delivered peak sample: glow
 *                    12.286% → 0.000%, bright 19.690% → 19.690%.
 *
 * The third is the one that makes this a pair rather than two floors. Without
 * it a reader could believe `bright` is just `glows` again with a looser
 * threshold, and the invariance is the proof that it is a different quantity.
 */
const cloneImage = (img) => ({ ...img, data: Uint8Array.from(img.data) });

function scaleValue(img, k) {
  const o = cloneImage(img);
  for (let i = 0; i + 2 < o.data.length; i += o.channels) {
    for (let c = 0; c < 3; c++) o.data[i + c] = Math.max(0, Math.min(255, Math.round(o.data[i + c] * k)));
  }
  return o;
}

function desaturate(img, k) {
  const o = cloneImage(img);
  for (let i = 0; i + 2 < o.data.length; i += o.channels) {
    const mx = Math.max(o.data[i], o.data[i + 1], o.data[i + 2]);
    for (let c = 0; c < 3; c++) o.data[i + c] = Math.round(o.data[i + c] + (mx - o.data[i + c]) * k);
  }
  return o;
}

/**
 * The two fractions off one decoded frame, at one stride. Shared by the sample
 * loop and by the §7.3 controls so that "what the gate measures" and "what the
 * control measures" cannot drift apart (§9.1).
 */
function glowPair(img, satMin, valMin) {
  const stride = img.channels * 7;
  let glow = 0;
  let bright = 0;
  let total = 0;
  for (let p = 0; p + 2 < img.data.length; p += stride) {
    const r = img.data[p];
    const g = img.data[p + 1];
    const b = img.data[p + 2];
    if (glows(r, g, b, satMin, valMin)) glow++;
    if (isBright(r, g, b, valMin)) bright++;
    total++;
  }
  const n = Math.max(1, total);
  return { glow: glow / n, bright: bright / n, total };
}

/**
 * Is `target` visible from `eye`, given axis-aligned boxes as occluders?
 *
 * Slab test against every box along the segment. Deliberately geometric rather
 * than rendered: "visible from elevation" is a claim about the city's layout,
 * and a rendered test would also be measuring the fog, the exposure and the
 * far plane. The landmark counts as visible if any of its sampled silhouette
 * points is both inside the frustum and unoccluded — a tower half-hidden behind
 * a nearer building is still something you can navigate by.
 */
function segmentClear(eye, target, boxes, ignoreBoxes) {
  const d = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
  for (const b of boxes) {
    if (ignoreBoxes && ignoreBoxes.includes(b)) continue;
    let t0 = 0;
    let t1 = 1;
    const lo = [b.x0, 0, b.z0];
    const hi = [b.x1, b.top, b.z1];
    let hit = true;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-9) {
        if (eye[a] < lo[a] || eye[a] > hi[a]) { hit = false; break; }
        continue;
      }
      let ta = (lo[a] - eye[a]) / d[a];
      let tb = (hi[a] - eye[a]) / d[a];
      if (ta > tb) { const s = ta; ta = tb; tb = s; }
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 > t1) { hit = false; break; }
    }
    if (hit) return false;
  }
  return true;
}

/** Breadth-first over a walkable mask. Returns cells → path length in cells. */
function floodFill(mask, w, h, startIx) {
  const dist = new Int32Array(w * h).fill(-1);
  dist[startIx] = 0;
  const queue = [startIx];
  for (let qi = 0; qi < queue.length; qi++) {
    const c = queue[qi];
    const cx = c % w;
    const cz = (c / w) | 0;
    const d = dist[c] + 1;
    for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + ox;
      const nz = cz + oz;
      if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
      const n = nz * w + nx;
      if (mask[n] !== 0 || dist[n] >= 0) continue;
      dist[n] = d;
      queue.push(n);
    }
  }
  return dist;
}

// ---------------------------------------------------------------------------
// CONTRACT §7.1 — every gate has a known case that makes it fail, and that case
// is exercised.
//
// The same self-test perfcheck carries, against `judgeCity` instead of
// `assertRoute`. It runs BEFORE the server starts, because a self-test that
// needs a browser is a self-test nobody runs on a red build.
//
// TWO-SIDED. Each case must (a) leave the good fixture with zero failures and
// (b) produce at least one failure when perturbed. One-sided would pass an
// assertion that rejects EVERYTHING, and this file already shipped one of
// those: the walkability reach scanned six cells around a landmark's centre,
// the condenser is 102 m across, so every cell it looked at was inside the
// tower and all eight landmarks came back unreachable.

/**
 * A measured state that is inside every bound. Nothing renders.
 *
 * Derived from the budget wherever there is a threshold to derive it from, so
 * that raising a floor moves the fixture with it rather than silently turning
 * the control run red. The numbers that are not derived — 40 meshes, 4 000
 * props, 9 000 placed objects, 600 signs — are population sizes no threshold
 * reads; only the ratios computed from them are compared against anything.
 */
function goodCityFixture() {
  const C = BUDGET.clumping;
  const SW = BUDGET.sceneWalk;
  const PED = BUDGET.pedestrians;
  const V = BUDGET.vintage;
  const A = BUDGET.alignment;
  const S = BUDGET.saturation;
  const N = BUDGET.negativeSpace;
  const L = BUDGET.landmarks;
  const RV = BUDGET.river;
  return {
    propCV: C.minDensityCV + 0.1,
    populatedFraction: C.minPopulatedFraction + 0.1,

    /** Session 21 — the keep-out registry, inside every bound. */
    genConflicts: [],
    deliveredConflicts: [],
    deliveredClaims: BUDGET.occupancy.minDeliveredClaims + 500,
    surfaceCensus: {
      step: BUDGET.occupancy.surfaceSampleStepM,
      sampled: BUDGET.occupancy.minWalkableSamples * 2,
      unwalkable: 0,
      walkable: BUDGET.occupancy.minWalkableSamples * 2,
      unknown: 0,
      byKind: { ground: BUDGET.occupancy.minWalkableSamples * 2 },
      bare: BUDGET.occupancy.maxBareWalkableSamples,
      bareFraction: 0,
    },
    viaductLegsOnCarriageway: 0,
    viaductPiersBlocked: 0,
    viaductLegMaxInBlockM: BUDGET.occupancy.viaductLegsInsideBlockClearBandM - 0.1,
    softwareRenderer: false,

    hasCensus: true,
    instancedMeshes: 40,
    unlabelled: 0,
    mismatches: [],
    underdrawn: 0,
    underdrawnFraction: 0,
    propsInsideBuildings: SW.maxPropsInsideBuildings,
    propTotal: 4000,
    streamedTimedOut: false,
    streamed: {
      frames: 1724, ms: 5464, timedOut: false, timedOutOn: null,
      field: { baked: 25, resident: 25, queued: 0, inFlight: 0 },
    },

    hasStalls: true,
    stallTotal: 341,
    stallKinds: SL.minStallKinds,
    stallLightSlots: SL.maxStallLightSlots - 1,
    awningCloths: SL.minAwningCloths,
    awningChromaSpread: SL.minAwningChromaSpreadLinear + 0.1,

    signQuadTotal: 400,
    signsInsideBuildings: 0,
    signStandoffP10: 0.12,
    signStandoffP90: 0.12 + SW.minSignStandoffSpreadM + 0.4,
    signStandoffSpread: SW.minSignStandoffSpreadM + 0.4,
    signMountings: SW.minSignMountings,
    signMountingList: ['flush', 'freestanding', 'projecting', 'roof'],

    hasRiver: true,
    bridgesBuilt: RV.minBridgesBuilt + 1,
    riverWindowM: 1024,
    bridgeStructures: RV.minBridgeStructures,
    bridgeStructureList: ['arch', 'girder', 'cable'],
    bridgeAboveDeckSpread: RV.minBridgeAboveDeckSpreadM + 8,
    riverLandmarkClearance: RV.minLandmarkClearanceM + 6,
    riverLandmarkClearanceName: 'stack',
    landmarksAcrossWater: RV.minLandmarksAcrossWater + 1,
    landmarksAcrossWaterList: ['condenser(from south)', 'mast(from north)', 'stack(from north)'],

    hasPedestrians: true,
    pedTotal: PED.minTotal + 100,
    pedCV: PED.minDensityCV + 0.05,
    pedPopulatedFraction: PED.minPopulatedFraction + 0.1,

    eras: V.minEras + 1,
    signCount: 600,
    // Midway between the two bounds, so neither the floor nor the ceiling is
    // cleared by a hair — 0.285 today, against 0.15 and 0.42.
    deadSignFraction: (V.minDeadSignageFraction + V.maxDeadSignageFraction) / 2,
    roadVariants: V.minRoadMaterialVariants + 1,

    placedCount: 9000,
    offAxisFraction: A.minOffAxisFraction + 0.1,
    maxDeviation: A.maxDeviationDeg - 0.5,

    satMax: (S.minFraction + S.maxFraction) / 2,
    brightMean: S.minBrightFraction + 0.02,

    /**
     * The lamp-bowl census as it arrives from a healthy scene: both paths
     * tagged, the photocell on, each delivered radiance exactly its declared
     * factor of the derivation, and both drawn on the derivation's own bowl.
     * Built from `LAMP_BOWL` rather than from literals, so a change to the
     * fixture cannot leave a green fixture behind describing the old one.
     */
    lampBowl: {
      derivedNits: LAMP_BOWL.derivedNits,
      lampsOn: true,
      paths: [
        {
          path: 'streamed', meshes: 25, deliveredNits: LAMP_BOWL.streamedNits,
          radiusM: LAMP_BOWL.radiusM,
          thetaStart: LAMP_BOWL.thetaStart, thetaLength: LAMP_BOWL.thetaLength,
          phiStart: LAMP_BOWL.phiStart, phiLength: LAMP_BOWL.phiLength,
        },
        {
          path: 'origin', meshes: 16, deliveredNits: LAMP_BOWL.originNits,
          radiusM: LAMP_BOWL.radiusM,
          thetaStart: LAMP_BOWL.thetaStart, thetaLength: LAMP_BOWL.thetaLength,
          phiStart: LAMP_BOWL.phiStart, phiLength: LAMP_BOWL.phiLength,
        },
      ],
    },

    lowDetailFraction: N.minLowDetailFraction + 0.05,
    lowKinds: N.minDistinctKinds + 1,

    landmarkCount: L.min + 1,
    visibleFromElevation: L.minVisibleFromElevation + 1,
    unreachable: [],
    worstDetourRatio: L.maxPathDetourRatio - 1,
    worstDetourName: 'condenser',
    generatorProducible: [],
  };
}

/**
 * One entry per failure site in `judgeCity`. `id` names the thing being
 * falsified and `mutate` breaks exactly it. Adding a check without adding a case
 * here fails the coverage arithmetic below, which is the whole point.
 */
const FALSIFY_CITY = [
  /**
   * SESSION 21 — the keep-out registry's own falsifying cases, one per failure
   * site, which is what `falsify.requireCoverage: 1.0` demands.
   *
   * Each perturbation is the SHAPE OF A REAL DEFECT rather than a nonsense
   * value: a building overlapping a carriageway is the dome across the road, a
   * prop overlapping a building is session 4b's 146 of 838, a leg on a
   * carriageway is the 8 of 23 this session measured.
   */
  ['occupancy.generatorConflict', (m) => {
    m.genConflicts = [{
      a: { kind: 'carriageway', owner: 'road:roadNS' },
      b: { kind: 'landmark', owner: 'exchange' }, areaM2: 2906.3,
    }];
  }],
  ['occupancy.noRegistry', (m) => { m.genConflicts = null; }],
  ['occupancy.deliveredConflict', (m) => {
    m.deliveredConflicts = [{ a: { kind: 'prop', owner: 'tree' }, b: { kind: 'building', owner: 'bld' }, areaM2: 1.9 }];
  }],
  ['occupancy.noCensus', (m) => { m.deliveredConflicts = null; }],
  ['occupancy.bareSurface', (m) => { m.surfaceCensus = { ...m.surfaceCensus, bare: 42, bareFraction: 42 / m.surfaceCensus.walkable }; }],
  ['occupancy.noSurfaceCensus', (m) => { m.surfaceCensus = null; }],
  ['occupancy.emptySurfaceLattice', (m) => { m.surfaceCensus = { ...m.surfaceCensus, walkable: 10, sampled: 10 }; }],
  ['occupancy.emptyCensus', (m) => { m.deliveredClaims = 12; }],
  ['occupancy.legOnCarriageway', (m) => { m.viaductLegsOnCarriageway = 8; }],
  ['occupancy.noLegs', (m) => { m.viaductLegsOnCarriageway = null; }],
  ['occupancy.pierBlocked', (m) => { m.viaductPiersBlocked = 2; }],
  ['occupancy.legOutsideBlockBand', (m) => { m.viaductLegMaxInBlockM = 12.18; }],
  ['saturation.unrun', (m) => { m.softwareRenderer = true; }],
  /**
   * SESSION 28 — the lamp-bowl ratchet's five sites. Each perturbation is the
   * shape of a real defect rather than a nonsense value.
   */
  ['lampBowl.noCensus', (m) => { m.lampBowl = null; }],
  /** The daylight run, where every bowl carries its 0.5 standby radiance. */
  ['lampBowl.photocellOff', (m) => { m.lampBowl = { ...m.lampBowl, lampsOn: false }; }],
  /** A path that stops tagging itself is a path nothing compares — the defect. */
  ['lampBowl.pathVanished', (m) => {
    m.lampBowl = { ...m.lampBowl, paths: m.lampBowl.paths.slice(0, 1) };
  }],
  /**
   * THE DEFECT AS IT ACTUALLY STOOD: the origin block at 210 while the
   * streamed city ran at 9000 is inside the ratchet by construction, so the
   * case that must fail is one MOVING AWAY from the derivation. 42.86x on one
   * path is the split with both halves' error loaded onto one of them.
   */
  ['lampBowl.ratioWorse', (m) => {
    m.lampBowl = {
      ...m.lampBowl,
      paths: [{ ...m.lampBowl.paths[0], deliveredNits: m.lampBowl.derivedNits * 42.86 },
        m.lampBowl.paths[1]],
    };
  }],
  /** A bowl re-authored in one file only: the area on screen leaves the derivation. */
  ['lampBowl.geometryDiverged', (m) => {
    m.lampBowl = {
      ...m.lampBowl,
      paths: [{ ...m.lampBowl.paths[0], radiusM: 0.5 }, m.lampBowl.paths[1]],
    };
  }],
  ['clumping.cv', (m) => { m.propCV = 0.1; }],
  ['clumping.populated', (m) => { m.populatedFraction = 0.1; }],
  ['sceneWalk.noCensus', (m) => { m.hasCensus = false; }],
  ['sceneWalk.streamTimedOut', (m) => {
    m.streamedTimedOut = true;
    m.streamed = { frames: 5000, ms: 30000, timedOut: true, timedOutOn: 'wall', field: { baked: 3, resident: 25, queued: 18, inFlight: 4 } };
  }],
  ['sceneWalk.unlabelled', (m) => { m.unlabelled = 3; }],
  ['sceneWalk.mismatch', (m) => { m.mismatches = [{ name: 'props', labelled: 757, allocated: 904 }]; }],
  /**
   * The three session-14 signage sites. `signsInside` is the defect exactly as
   * it shipped — every quad buried — and `signStandoff` is the flush-only city
   * session 3 delivered, which is the NEGATIVE CONTROL for the standoff metric:
   * every sign at the same 0.12 m off its wall reads a spread of exactly zero.
   */
  /**
   * The five street-level sites. `awningSpread` is the negative control for the
   * §7.2 pair and it is the delivered world of session 13: one cloth on every
   * canopy, a widest pair of exactly 0.
   */
  ['streetLevel.absent', (m) => { m.hasStalls = false; }],
  ['streetLevel.count', (m) => { m.stallTotal = 3; }],
  ['streetLevel.kinds', (m) => { m.stallKinds = 1; }],
  ['streetLevel.lightSlots', (m) => { m.stallLightSlots = SL.maxStallLightSlots + 40; }],
  ['streetLevel.awningCloths', (m) => { m.awningCloths = 1; }],
  ['streetLevel.awningSpread', (m) => { m.awningChromaSpread = 0; }],
  ['sceneWalk.signsUnmeasured', (m) => { m.signQuadTotal = 0; }],
  ['sceneWalk.signsInside', (m) => { m.signsInsideBuildings = 208; }],
  ['sceneWalk.signStandoff', (m) => { m.signStandoffP10 = 0.12; m.signStandoffP90 = 0.12; m.signStandoffSpread = 0; }],
  ['sceneWalk.signMountings', (m) => { m.signMountings = 1; m.signMountingList = ['flush']; }],
  // Nine of forty is 22.5%, against the 5% ceiling.
  ['sceneWalk.underdrawn', (m) => { m.underdrawn = 9; m.underdrawnFraction = 9 / m.instancedMeshes; }],
  ['sceneWalk.propsInside', (m) => { m.propsInsideBuildings = 512; }],
  ['pedestrians.absent', (m) => { m.hasPedestrians = false; }],
  ['pedestrians.total', (m) => { m.pedTotal = 3; }],
  ['pedestrians.cv', (m) => { m.pedCV = 0.1; }],
  ['pedestrians.populated', (m) => { m.pedPopulatedFraction = 0.02; }],
  ['vintage.eras', (m) => { m.eras = 1; }],
  ['vintage.noSignage', (m) => { m.signCount = 0; }],
  ['vintage.deadTooFew', (m) => { m.deadSignFraction = 0; }],
  ['vintage.deadTooMany', (m) => { m.deadSignFraction = 0.95; }],
  ['vintage.roadVariants', (m) => { m.roadVariants = 1; }],
  ['alignment.nothingPlaced', (m) => { m.placedCount = 0; }],
  ['alignment.offAxis', (m) => { m.offAxisFraction = 0.05; }],
  ['alignment.maxDeviation', (m) => { m.maxDeviation = 27; }],
  ['saturation.tooMuch', (m) => { m.satMax = 0.9; }],
  ['saturation.tooLittle', (m) => { m.satMax = 0; }],
  /**
   * The ratchet, as a fixture. `satMax` is left inside the reserve and only the
   * bright fraction falls — which is exactly the state a session reaches by
   * answering a saturation red with a dimming, and exactly the state the
   * ceiling alone reports as green.
   */
  ['saturation.wentDark', (m) => { m.brightMean = 0; }],
  ['negativeSpace.fraction', (m) => { m.lowDetailFraction = 0; }],
  ['negativeSpace.kinds', (m) => { m.lowKinds = 1; }],
  ['river.unrun', (m) => { m.hasRiver = false; }],
  ['river.bridgesBuilt', (m) => { m.bridgesBuilt = 0; }],
  ['river.structures', (m) => { m.bridgeStructures = 1; }],
  ['river.aboveDeckSpread', (m) => { m.bridgeAboveDeckSpread = 0.4; }],
  ['river.landmarkClearance', (m) => { m.riverLandmarkClearance = 0; }],
  ['river.acrossWater', (m) => { m.landmarksAcrossWater = 0; }],
  ['landmarks.count', (m) => { m.landmarkCount = 2; }],
  ['landmarks.visible', (m) => { m.visibleFromElevation = 0; }],
  ['landmarks.unreachable', (m) => { m.unreachable = ['weir', 'dish']; }],
  ['landmarks.detour', (m) => { m.worstDetourRatio = 9.4; }],
  ['landmarks.generatorProducible', (m) => { m.generatorProducible = ['stack']; }],
];

/**
 * THE SATURATION ESTIMATOR. CONTRACT §0 rule 6, and it is the last gate in this
 * project that decided a threshold from a single draw.
 *
 * WHAT WAS WRONG. `satMax` is the maximum over `samples` = 12 frames of one
 * route — an extreme-value statistic, dominated by whichever bloom halo happened
 * to be nearest the lens. Measured across three separate `citycheck`
 * invocations in session 5: **10.15 / 10.19 / 11.10 percent** against a 12%
 * ceiling. The run-to-run spread is **0.95 points** and the margin at the worst
 * draw is **0.90 points**, so the gate was deciding a question on a difference
 * smaller than its own noise floor — the same shape as `downtown_dense`'s
 * 0.10 ms breach against a 0.40–0.80 ms resolution, which is what rule 6 was
 * written for.
 *
 * THE SAMPLE POSITIONS ARE DETERMINISTIC — `sampleRouteAt(route, i/(n-1))` at
 * fixed parameters — so the spread is NOT sampling noise in the route. It is
 * everything else that differs between two loads of the same page: which chunks
 * had streamed in, what the TAA history had converged to, where the rain
 * particles were. That is why a run here is a FRESH PAGE LOAD and not another
 * twelve samples off the page already open: repeating the loop in one page
 * would pool over the one thing that is already deterministic and average away
 * nothing.
 *
 * THE MEDIAN OF PER-RUN MAXIMA, AND NOT THE MAXIMUM OVER POOLED FRAMES. This is
 * §0.1's estimand argument with a percentage instead of a percentile, and it is
 * the whole reason the estimator is written down rather than just "run it three
 * times". The ceiling of 12% was derived against the max over TWELVE samples.
 * The max over 36 samples pooled from three runs is a DIFFERENT QUANTITY — it
 * is stochastically larger by construction, it grows with the number of runs,
 * and comparing it to a ceiling written for the max of twelve would be CONTRACT
 * §9's failure with a statistic instead of a length. The median of the per-run
 * maxima estimates exactly what the single draw estimated, with a third of the
 * variance.
 *
 * NOT THE MEAN. Same reason as `capture.$estimator`: the median of three
 * discards exactly one contaminated observation, and the observed contamination
 * IS one-sided and one-of-three — 10.15 / 10.19 / 11.10 is two agreeing draws
 * and one high one, which is the pattern the median is chosen for.
 *
 * NO THRESHOLD MOVES. `maxFraction` is 0.12 before and after and `minFraction`
 * is 0.004 before and after. An estimator change that also moved a number would
 * be indistinguishable from a loosening (§0 rule 5 is not suspended by rule 6).
 *
 * THE FRAME WRITTEN OUT IS THE WORST ONE SEEN, not the worst of the run that
 * happened to be the median. The verdict is pooled; the picture is the failing
 * run, because that is the one worth looking at.
 */
function poolSaturation(runs) {
  const perRun = runs.map((r) => (r.length ? Math.max(...r) : 1));
  const sorted = [...perRun].sort((a, b) => a - b);
  const h = sorted.length >> 1;
  return {
    perRun,
    pooled: sorted.length % 2 ? sorted[h] : (sorted[h - 1] + sorted[h]) / 2,
    spread: perRun.length > 1 ? Math.max(...perRun) - Math.min(...perRun) : null,
  };
}

/**
 * THE BRIGHT FLOOR'S ESTIMATOR, AND IT IS NOT THE CEILING'S MIRRORED.
 *
 * The ceiling pools the per-run MAXIMUM because its question is "does anywhere
 * on this route glow too much" — one frame is enough to convict, and the
 * failure it is looking for is local: a bloom halo, a hauler at the lens.
 *
 * The floor's question is the opposite shape. "The city has gone dark" is a
 * shift of the WHOLE distribution, not one frame in it, and the per-run
 * MINIMUM over twelve samples would be set by whichever sample happened to
 * face a wall or a bridge soffit — an extreme-value statistic on the dark side,
 * which is precisely the defect `$estimator` was written to remove from the
 * ceiling. So the per-run statistic is the MEAN over the route's samples, and
 * the runs are pooled by the median exactly as the ceiling's are.
 *
 * Mirroring the ceiling's construction would have been the tidy choice and it
 * would have measured a different quantity from the one the floor is about
 * (§9's failure mode, with a statistic instead of a length). The two estimators
 * differ because the two questions do; both are stated at their threshold.
 */
function poolBright(runs) {
  const perRun = runs.map((r) => (r.length ? r.reduce((a, v) => a + v, 0) / r.length : 0));
  const sorted = [...perRun].sort((a, b) => a - b);
  const h = sorted.length >> 1;
  return {
    perRun,
    pooled: sorted.length % 2 ? sorted[h] : (sorted[h - 1] + sorted[h]) / 2,
    spread: perRun.length > 1 ? Math.max(...perRun) - Math.min(...perRun) : null,
  };
}

/**
 * THE ESTIMATOR'S OWN FALSIFYING CASES, TWO-SIDED, and they exist for the
 * reason `perfcheck`'s do: a pooled estimator is a way of making a gate
 * quieter, and quieter is one step from unfailable — §0 rule 5 broken by an
 * estimator rather than by a number. The boundary of the claim is that the
 * median of three tolerates EXACTLY ONE contaminated observation.
 */
const SAT_ESTIMATOR_CASES = [
  {
    id: 'oneHighRunIsDrift',
    runs: [0.1015, 0.1019, 0.1310],
    expectFail: false,
    why:
      'one draw of three above the ceiling is the case this estimator exists for — it is exactly the ' +
      '10.15 / 10.19 / 11.10 pattern session 5 measured, with the high draw pushed over the line',
  },
  {
    id: 'genuineBreachStillFails',
    runs: [0.1260, 0.1270, 0.1280],
    expectFail: true,
    why:
      'three runs over the ceiling is a scene that glows too much, not a draw that caught a halo, and ' +
      'an estimator that cannot see it has replaced a coin toss with a rubber stamp',
  },
  {
    id: 'twoOfThreeOverFails',
    runs: [0.1015, 0.1260, 0.1270],
    expectFail: true,
    why: 'the median of three tolerates exactly ONE contaminated observation and no more',
  },
  {
    id: 'atTheCeilingIsNotOverIt',
    runs: [0.12, 0.12, 0.12],
    expectFail: false,
    why: 'the comparison is strictly greater-than, as it was before; equality was never a breach',
  },
  {
    id: 'anEmptyReserveStillFails',
    runs: [0.0001, 0.0002, 0.0003],
    expectFail: true,
    why:
      'pooling must not rescue the FLOOR either — a night route where nothing glows is the reserve spent ' +
      'on nothing, and a two-sided estimator has to keep both directions',
  },
];

if (args.has('falsify')) {
  const control = judgeCity(goodCityFixture(), BUDGET);
  const problems = [];
  if (control.length) {
    problems.push(
      `the GOOD fixture failed ${control.length} assertion(s), so every case below is ` +
      `meaningless: ${control.slice(0, 4).map(([t, m]) => `[${t}] ${m}`).join(' | ')}`
    );
  }
  const messages = new Set();
  let rejected = 0;
  for (const [id, mutate] of FALSIFY_CITY) {
    const m = goodCityFixture();
    mutate(m);
    const verdict = judgeCity(m, BUDGET);
    if (verdict.length === 0) {
      problems.push(`'${id}' was NOT rejected — the assertion it falsifies does not reject anything`);
    } else {
      rejected++;
      for (const [tag, msg] of verdict) messages.add(`[${tag}] ${msg}`.replace(/[0-9][0-9.]*/g, 'N'));
    }
  }

  /**
   * COVERAGE. Count the failure sites in `judgeCity`'s own source and require a
   * case for each. A registry that only lists the cases somebody remembered is
   * the rule with an exception in it. The denominator is judgeCity's body and
   * nothing else — the budget-sanity block is excluded on purpose, and counting
   * an aggregating `out.push(...someOtherList)` would inflate the denominator in
   * the flattering direction, which is the arithmetic error perfcheck's first
   * run made when it reported 83% against six lines that assert nothing.
   */
  const src = await readFile(new URL(import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('function judgeCity'), src.indexOf('function mean('));
  const siteLines = body.split('\n').filter((l) => /out\.push\(/.test(l) && !/out\.push\(\.\.\./.test(l));
  const sites = siteLines.length;
  const coverage = sites ? Math.min(1, FALSIFY_CITY.length / sites) : 0;
  if (coverage < (BUDGET.falsify ? BUDGET.falsify.requireCoverage : 1)) {
    problems.push(
      `${FALSIFY_CITY.length} falsifying cases against ${sites} failure sites in judgeCity ` +
      `— coverage ${(coverage * 100).toFixed(0)}%. A gate without a known case that makes it fail ` +
      `does not count as a gate (CONTRACT §7.1).`
    );
  }

  /**
   * The estimator's cases run through `poolSaturation` and then through the
   * SAME `judgeCity` the gate uses, so what is tested is the pooled number
   * arriving at the real assertion rather than a second copy of the comparison.
   */
  for (const c of SAT_ESTIMATOR_CASES) {
    const m = goodCityFixture();
    m.satMax = poolSaturation(c.runs.map((v) => [v])).pooled;
    const verdict = judgeCity(m, BUDGET).filter(([tag]) => tag === 'saturation');
    if (c.expectFail && !verdict.length) {
      problems.push(
        `saturation estimator '${c.id}': runs ${c.runs.map((v) => (v * 100).toFixed(2)).join(' / ')}% produced ` +
        `NO failure and should have — ${c.why}`
      );
    }
    if (!c.expectFail && verdict.length) {
      problems.push(
        `saturation estimator '${c.id}': runs ${c.runs.map((v) => (v * 100).toFixed(2)).join(' / ')}% FAILED and ` +
        `should not have — ${c.why}`
      );
    }
  }

  /**
   * CONTRACT §7.3 AND §7.7: the glow/bright pair, run over a frame whose answer
   * is known from OUTSIDE the instrument.
   *
   * The frame is 70 × 10 = 700 pixels built from a repeating 10-pixel period.
   * `glowPair` samples every 7th pixel; 7 is coprime to 10, so the 100 samples
   * hit each residue class mod 10 exactly ten times and the sampled proportions
   * are the period's proportions EXACTLY. That coprimality is not decoration —
   * a period of 7 would have made every sample the same pixel and the control
   * would have read 0 or 1 for everything while looking like it worked, which
   * is §7.3's whole complaint about a metric whose two answers are the same
   * answer. The base row below is what catches that: 20% and 50% are only
   * reachable if the sampler is walking the period.
   *
   *   2 px  (140, 30, 10)   sat (140−10)/140 = 0.929 > 0.6 ✓   value 0.549 > 0.5 ✓   glow + bright
   *   3 px  (140,140,140)   sat 0                              value 0.549 > 0.5 ✓   bright only
   *   5 px  (110, 25,  8)   sat (110−8)/110 = 0.927 > 0.6 ✓    value 0.431 < 0.5 ✗   neither
   *
   * Every expectation below is arithmetic on those three rows and none of it was
   * read off a run:
   *
   *   base      glow 2/10 = 0.20                  bright 5/10 = 0.50
   *   × 1.25    140→175 (0.686), 110→138 (0.541): the dark row crosses `valMin`
   *             and brings its saturation with it, so glow 7/10 = 0.70 and
   *             bright 10/10 = 1.00. BOTH RISE.
   *   × 0.60    140→84 (0.329), 110→66 (0.259): nothing clears `valMin`, so
   *             glow 0.00 and bright 0.00. BOTH FALL — this is the ratchet
   *             performed on purpose, and the row that shows the ceiling being
   *             satisfied while the floor is not.
   *   desat     every channel → the pixel's own max, which is a FIXED POINT, so
   *             `valMin` verdicts cannot move: glow 0.00 and bright 0.50
   *             UNCHANGED. This is the row that proves `bright` is a different
   *             quantity from `glows` and not a looser copy of it.
   */
  {
    const PERIOD = [
      [140, 30, 10], [140, 30, 10],
      [140, 140, 140], [140, 140, 140], [140, 140, 140],
      [110, 25, 8], [110, 25, 8], [110, 25, 8], [110, 25, 8], [110, 25, 8],
    ];
    const W = 70;
    const H = 10;
    const data = new Uint8Array(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      const [r, g, b] = PERIOD[i % PERIOD.length];
      data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
    }
    const control = { width: W, height: H, channels: 4, data };
    const S = BUDGET.saturation;

    const SHAPE_CONTROLS = [
      { id: 'base', img: control, glow: 0.20, bright: 0.50 },
      { id: 'scaleValue×1.25', img: scaleValue(control, 1.25), glow: 0.70, bright: 1.00 },
      { id: 'scaleValue×0.60', img: scaleValue(control, 0.60), glow: 0.00, bright: 0.00 },
      { id: 'desaturate', img: desaturate(control, 1.0), glow: 0.00, bright: 0.50 },
    ];

    for (const c of SHAPE_CONTROLS) {
      const got = glowPair(c.img, S.threshold, S.valueThreshold);
      if (got.total !== 100) {
        problems.push(`glowPair control '${c.id}': sampled ${got.total} pixels of an expected 100 — the stride and the period no longer line up`);
      }
      if (Math.abs(got.glow - c.glow) > 1e-9) {
        problems.push(`glowPair control '${c.id}': glow ${(got.glow * 100).toFixed(2)}% against a hand-computed ${(c.glow * 100).toFixed(2)}%`);
      }
      if (Math.abs(got.bright - c.bright) > 1e-9) {
        problems.push(`glowPair control '${c.id}': bright ${(got.bright * 100).toFixed(2)}% against a hand-computed ${(c.bright * 100).toFixed(2)}%`);
      }
    }

    /**
     * The DIRECTIONS, asserted separately from the values, because the values
     * could all be right and the pairing still be pointless. These three are
     * the reason the floor is worth having, and each one is a statement about
     * the two metrics' relationship rather than about either alone.
     */
    const at = (id) => glowPair(SHAPE_CONTROLS.find((c) => c.id === id).img, S.threshold, S.valueThreshold);
    const base = at('base');
    const dim = at('scaleValue×0.60');
    const desat = at('desaturate');
    if (!(dim.glow < base.glow && dim.bright < base.bright)) {
      problems.push('the dimming control did not lower BOTH fractions — the floor cannot catch a ratchet it does not see');
    }
    if (!(desat.glow < base.glow)) {
      problems.push('the desaturation control did not lower the glow fraction — the ceiling is not measuring chromaticity');
    }
    if (desat.bright !== base.bright) {
      problems.push(
        `the desaturation control moved the bright fraction from ${(base.bright * 100).toFixed(2)}% to ` +
        `${(desat.bright * 100).toFixed(2)}% — max(r,g,b) is a fixed point of that transform, so this is ` +
        'the instrument disagreeing with its own arithmetic'
      );
    }
    /** glows ⊆ bright, on every control. The subset relation the budget check assumes. */
    for (const c of SHAPE_CONTROLS) {
      const got = glowPair(c.img, S.threshold, S.valueThreshold);
      if (got.glow > got.bright + 1e-12) {
        problems.push(`glowPair control '${c.id}': glow ${got.glow} exceeds bright ${got.bright}, but a glowing pixel is bright by definition`);
      }
    }
    console.log(
      `  §7.3 glow/bright controls: ${SHAPE_CONTROLS.length} frames, ` +
      `base ${(base.glow * 100).toFixed(0)}/${(base.bright * 100).toFixed(0)}%, ` +
      `dimmed ${(dim.glow * 100).toFixed(0)}/${(dim.bright * 100).toFixed(0)}%, ` +
      `desaturated ${(desat.glow * 100).toFixed(0)}/${(desat.bright * 100).toFixed(0)}% ` +
      `(glow/bright; the third pair is the one that has to keep its second number)`
    );
  }

  console.log(
    `citycheck --falsify: ${rejected}/${FALSIFY_CITY.length} cases rejected, ` +
    `${messages.size} distinct failure messages, ${sites} failure sites, ` +
    `coverage ${(coverage * 100).toFixed(0)}%; ` +
    `${SAT_ESTIMATOR_CASES.length} saturation estimator cases, ` +
    `${SAT_ESTIMATOR_CASES.filter((c) => c.expectFail).length} must reject and ` +
    `${SAT_ESTIMATOR_CASES.filter((c) => !c.expectFail).length} must not`
  );
  if (problems.length) {
    console.log('\nFALSIFY PROBLEMS\n' + problems.map((p) => '  ✗ ' + p).join('\n'));
    process.exit(1);
  }
  console.log('Every assertion in citycheck has a known case that makes it fail, and it was exercised.');
  process.exit(0);
}

// ---------------------------------------------------------------------------

let server;
let browser;
let ctxPage;
try {
  server = await startServer(5181);
  browser = await launchBrowser();
} catch (e) {
  if (server) server.child.kill('SIGKILL');
  console.error('harness: could not start —', e.message);
  process.exit(2);
}

let placement = null;
let census = null;
let lampBowl = null;
let pedestrians = null;
let signQuads = null;
let riverCensus = null;
let occupancy = null;
/** The delivered surface census — session 51. See `harness.surfaceCensus`. */
let surfaceCensus = null;
/** Hoisted out of the try: the metrics below and `judgeCity` both read it. */
let softwareRenderer = false;
let stalls = null;
let streamed = null;
let satSamples = [];
/** One array of per-sample fractions per RUN. §0 rule 6; see `poolSaturation`. */
let satRuns = [];
/** What `waitForCity` reported for each run. A run whose city had not arrived is
 *  not a second sample of the same quantity — see the note at the reload. */
let satStreamed = [];
/** Kept so the worst sample can be written out. A number nobody can look at is a number nobody can act on. */
let satFrames = [];
/** The other half of the same predicate, off the same pixels of the same frames. See `isBright`. */
let brightSamples = [];
let brightRuns = [];

try {
  const opened = await openPage(browser, { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  ctxPage = opened;
  const page = opened.page;

  await page.goto(`${server.url}?perf=1&seed=${SEED}&paused=1`, { waitUntil: 'load', timeout: 90_000 });
  await page.waitForFunction(() => window.__NOCTIS_HARNESS__, null, { timeout: 60_000 });
  await page.evaluate(() => window.__NOCTIS_HARNESS__.ready);

  const gpu = await readRendererString(page);
  /**
   * THE REFUSAL IS SCOPED TO THE MEASUREMENT IT INVALIDATES — session 21.
   *
   * It used to throw here, before anything was gathered, so a machine without a
   * GPU produced NO verdict at all — not on the clumping, not on the scene
   * walk, not on the landmarks, not on the new occupancy check, none of which
   * reads a pixel. CONTRACT §9 rule 6's corollary is that counts do not drift;
   * a placement is a count and an instance matrix is exact on any rasteriser,
   * and the ONE measurement here that is not is the saturation sample.
   *
   * THIS CANNOT MAKE A RED GATE GREEN. `softwareRenderer` is carried into `M`
   * and `judgeCity` fails on it — the gate still exits 1, with the saturation
   * reported as UNRUN rather than as passed (CONTRACT §10: *a gate that cannot
   * run is not a green gate*). What changes is that the other twenty-odd
   * assertions now report, which is strictly more information for a gate that
   * was already failing.
   */
  softwareRenderer = rendererIsSoftware(gpu);
  log(`GPU: ${gpu}${softwareRenderer ? '  — SOFTWARE: the saturation sample will be UNRUN' : ''}\n`);

  const faults = await page.evaluate(() => window.__NOCTIS_HARNESS__.faults());
  if (faults.length) throw new Error(`${faults.length} module(s) quarantined: ${faults.map((f) => f.name).join(', ')}`);

  placement = await page.evaluate(
    (region) => {
      const h = window.__NOCTIS_HARNESS__;
      if (!h.cityPlacement) throw new Error('harness.cityPlacement() is missing — the generator does not exist yet');
      return h.cityPlacement(region);
    },
    BUDGET.region
  );

  /**
   * The live scene, walked. Everything above this line is the generator's own
   * description of what it decided; this is what was built.
   *
   * Taken AFTER the city has finished arriving, because a census taken
   * mid-stream measures the streaming system. `waitForCity` is bounded rather
   * than a spin, so a bake that never returns fails this on its numbers instead
   * of hanging it.
   */
  await page.evaluate(() => window.__NOCTIS_HARNESS__.takeOver());
  streamed = await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity());
  census = await page.evaluate(() => {
    const h = window.__NOCTIS_HARNESS__;
    if (!h.sceneCensus) throw new Error('harness.sceneCensus() is missing');
    return h.sceneCensus();
  });
  /**
   * The DELIVERED lamp radiances — session 28. Taken on this page, which boots
   * at `ctx.config.t` = 0.78, so the photocell is on and `emissiveIntensity`
   * carries the lit value rather than the 0.5 standby. The census reports the
   * photocell state rather than inferring it, and `judgeCity` refuses rather
   * than passing if it is off.
   */
  lampBowl = await page.evaluate(() => {
    const h = window.__NOCTIS_HARNESS__;
    return h.lampBowlCensus ? h.lampBowlCensus() : null;
  });
  pedestrians = await page.evaluate(() => {
    const h = window.__NOCTIS_HARNESS__;
    return h.pedestrianCensus ? h.pedestrianCensus() : null;
  });
  /**
   * WHERE THE SIGN QUADS ENDED UP, off the delivered instance matrices.
   * Session 14. See `harness.signPlacement()` for why this is not read from
   * `chunk.signs`: the generator writes a sign's position as its BUILDING'S
   * CENTRE, so the placement data cannot say whether the sign is on the wall or
   * nine metres inside it — and for thirteen sessions it was nine metres inside
   * it, all 208 of them.
   */
  stalls = await page.evaluate(() => {
    const h = window.__NOCTIS_HARNESS__;
    return h.stallCensus ? h.stallCensus() : null;
  });
  signQuads = await page.evaluate(() => {
    const h = window.__NOCTIS_HARNESS__;
    return h.signPlacement ? h.signPlacement() : null;
  });
  /**
   * THE DELIVERED KEEP-OUT CLAIMS — session 21. Taken inside the same
   * `takeOver()` window as the scene census, for the same reason: a census
   * taken mid-stream measures the streaming system.
   */
  occupancy = await page.evaluate(() => {
    const h = window.__NOCTIS_HARNESS__;
    return h.occupancyCensus ? h.occupancyCensus() : null;
  });
  /**
   * AND WHETHER ANY OF IT HAS A FLOOR — session 51. Same window, same reason:
   * `worldSurfaceAt` reads the resident chunks' emitted rectangles, so a
   * census taken mid-stream measures the streaming system rather than the
   * city.
   */
  surfaceCensus = await page.evaluate(([region, step]) => {
    const h = window.__NOCTIS_HARNESS__;
    return h.surfaceCensus ? h.surfaceCensus(region, step) : null;
  }, [BUDGET.region, BUDGET.occupancy.surfaceSampleStepM]);
  /**
   * The river's DELIVERED bridges, session 15. Off the records `river.js`
   * wrote as it pushed the boxes, never off `BRIDGE_STRUCTURES` — the second
   * is the vocabulary and a gate that read it would be verifying the config
   * (CONTRACT §9.1).
   */
  riverCensus = await page.evaluate(() => {
    const h = window.__NOCTIS_HARNESS__;
    return h.riverCensus ? h.riverCensus() : null;
  });
  await page.evaluate(() => window.__NOCTIS_HARNESS__.release());

  /**
   * --- the one pixel measurement, RUN `saturation.runs` TIMES ---
   *
   * CONTRACT §0 rule 6. See `poolSaturation` above for why it is the median of
   * the per-run maxima rather than the maximum over the pooled frames, and why
   * a run is a fresh page load rather than another twelve samples off this one.
   * The first run reuses the page the census was taken on, so the added cost is
   * `runs - 1` loads and not `runs`.
   */
  const S = BUDGET.saturation;
  const RUNS = softwareRenderer ? 0 : Math.max(1, Number(args.get('satruns') || S.runs || 1));
  for (let run = 0; run < RUNS; run++) {
    if (run > 0) {
      await page.goto(`${server.url}?perf=1&seed=${SEED}&paused=1`, { waitUntil: 'load', timeout: 90_000 });
      await page.waitForFunction(() => window.__NOCTIS_HARNESS__, null, { timeout: 60_000 });
      await page.evaluate(() => window.__NOCTIS_HARNESS__.ready);
      /**
       * THE SAME `waitForCity` RUN 1 GOT FOR FREE FROM THE CENSUS, AND LEAVING
       * IT OUT COST A MEASUREMENT. The first version of this reloaded the page
       * and went straight to sampling, and the three runs came back
       * 10.93 / 6.82 / 9.03 — a 4.10-point spread against the 0.95 points three
       * separate invocations showed in session 5. The low draws were not
       * variance in the scene, they were an unbaked one: `sampleRouteAt` settles
       * for 30 frames and no more, which is enough to move to a position on an
       * ALREADY STREAMED city and is not enough to build one. A run that
       * measures a half-lit city is not a second sample of the same quantity,
       * and pooling it in would have made the estimator LOOK better than the
       * single draw while measuring something else.
       */
      await page.evaluate(() => window.__NOCTIS_HARNESS__.takeOver());
      satStreamed.push(await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity()));
      await page.evaluate(() => window.__NOCTIS_HARNESS__.release());
    } else {
      satStreamed.push(streamed);
    }
    await page.evaluate((r) => window.__NOCTIS_HARNESS__.prepareRoute(r), S.route);
    const runSamples = [];
    const runBright = [];
    for (let i = 0; i < S.samples; i++) {
      await page.evaluate(
        ([r, u]) => window.__NOCTIS_HARNESS__.sampleRouteAt(r, u),
        [S.route, i / Math.max(1, S.samples - 1)]
      );
      const png = await page.screenshot({ type: 'png' });
      const pair = glowPair(decodePNG(png), S.threshold, S.valueThreshold);
      runSamples.push(pair.glow);
      runBright.push(pair.bright);
      satFrames.push(png);
    }
    satRuns.push(runSamples);
    satSamples.push(...runSamples);
    brightRuns.push(runBright);
    brightSamples.push(...runBright);
  }
} catch (e) {
  if (ctxPage) await ctxPage.context.close();
  await browser.close();
  server.child.kill('SIGKILL');
  console.error('harness: run failed —', e.message);
  process.exit(2);
}

await ctxPage.context.close();
await browser.close();
server.child.kill('SIGKILL');

// ---------------------------------------------------------------------------
// Every aggregate a threshold is applied to, in one object. `judgeCity` reads
// this and nothing else; the code below computes it and reports it, and does not
// decide anything.

const M = {};

// ---------------------------------------------------------------------------
// THE KEEP-OUT REGISTRY, BOTH HALVES — session 21.
//
// Half one runs the PURE GENERATOR over the budget's own region and asks
// whether the claims it made conflict with each other. That is a check on
// whether every generator reads the registry it writes to.
//
// Half two reads the DELIVERED scene through `harness.occupancyCensus()` and
// asks the same question of the geometry that arrived. CONTRACT §9.1: a gate
// that reads config verifies the config, and this project has twice had a
// generator that decided correctly and a module that drew something else.
{
  const R = BUDGET.region;
  const genClaims = [];
  let refusedTotal = {};
  for (let cz = R.cz[0]; cz <= R.cz[1]; cz++) {
    for (let cx = R.cx[0]; cx <= R.cx[1]; cx++) {
      const c = generateChunk(Number(SEED), cx, cz);
      if (!c.registry) { M.genConflicts = null; break; }
      for (const q of c.registry.all()) genClaims.push(q);
      for (const [k, v] of Object.entries(c.refused || {})) refusedTotal[k] = (refusedTotal[k] || 0) + v;
    }
  }
  if (M.genConflicts !== null) M.genConflicts = findConflicts(genClaims, 60);
  M.genClaims = genClaims.length;
  M.refused = refusedTotal;
  M.surfaceCensus = surfaceCensus;
  M.deliveredConflicts = occupancy ? findConflicts(occupancy.claims, 60) : null;
  M.deliveredClaims = occupancy ? occupancy.total : null;
  M.deliveredCounts = occupancy ? occupancy.counts : null;
  M.conflictPairs = conflictPairs().length;

  /**
   * THE VIADUCT'S OWN THREE NUMBERS. They are separate assertions rather than
   * part of the conflict sweep because the sweep tests the DELIVERED lattice
   * and the pier search runs against the IDEAL one (see `latticeCarriageway`),
   * so a leg standing where the river happened to take the road away would
   * pass the sweep and still be a leg placed in a running lane.
   */
  const via = LANDMARKS.find((l) => l.kind === 'viaduct');
  if (via && via.pierLegOffset !== undefined) {
    const arc = viaductArc(via);
    const piers = viaductPiers(arc, via);
    let onCar = 0;
    let blocked = 0;
    let maxInBlock = 0;
    for (const p of piers) {
      if (p.blocked) blocked++;
      for (const leg of p.legs) {
        if (latticeCarriageway(leg.x, leg.z, via.pierLegHalf)) onCar++;
        const inBlock = leg.x > BLOCK_KEEPOUT.x0 && leg.x < BLOCK_KEEPOUT.x1
          && leg.z > BLOCK_KEEPOUT.z0 && leg.z < BLOCK_KEEPOUT.z1;
        if (inBlock) maxInBlock = Math.max(maxInBlock, Math.abs(leg.x) + via.pierLegHalf);
      }
    }
    M.viaductLegsOnCarriageway = onCar;
    M.viaductPiersBlocked = blocked;
    M.viaductLegMaxInBlockM = maxInBlock;
    M.viaductPiers = piers.length;
    M.viaductHammerheads = piers.filter((p) => p.hammerhead).length;
    M.viaductNudged = piers.filter((p) => p.nudgeM).length;
  } else {
    M.viaductLegsOnCarriageway = null;
    M.viaductPiersBlocked = 0;
    M.viaductLegMaxInBlockM = null;
  }
}
M.softwareRenderer = softwareRenderer;

notes.push(
  `surface          ${M.surfaceCensus ? `${M.surfaceCensus.bare} of ${M.surfaceCensus.walkable} walkable samples on the `
    + `${M.surfaceCensus.step} m lattice stand on bare earth `
    + `(${(M.surfaceCensus.bareFraction * 100).toFixed(2)}%, `
    + `${((M.surfaceCensus.bare * M.surfaceCensus.step * M.surfaceCensus.step) / 1e4).toFixed(2)} ha, max `
    + `${BUDGET.occupancy.maxBareWalkableSamples})\n`
    + `                 by surface: `
    + Object.entries(M.surfaceCensus.byKind).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')
    : 'harness.surfaceCensus() returned nothing'}`);

notes.push(
  `occupancy        ${M.genClaims} generator claims over the region, ` +
  `${M.deliveredClaims == null ? 'no' : M.deliveredClaims} delivered (min ${BUDGET.occupancy.minDeliveredClaims}) — ` +
  `${M.genConflicts == null ? 'n/a' : M.genConflicts.length} / ` +
  `${M.deliveredConflicts == null ? 'n/a' : M.deliveredConflicts.length} forbidden overlaps ` +
  `over ${M.conflictPairs} forbidden pairs (max ${BUDGET.occupancy.maxGeneratorConflicts})\n` +
  `                 delivered by category: ` +
  Object.entries(M.deliveredCounts || {}).map(([k, v]) => `${k} ${v}`).join(', ') + `\n` +
  `                 the registry REFUSED, by the category that refused it: ` +
  (Object.keys(M.refused).length
    ? Object.entries(M.refused).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')
    : 'nothing') +
  ` — a cap nobody prints reads as "everything fitted"\n` +
  `                 viaduct ${M.viaductPiers} piers (${M.viaductHammerheads} hammerhead, ` +
  `${M.viaductNudged} nudged, ${M.viaductPiersBlocked} blocked), ` +
  `${M.viaductLegsOnCarriageway} leg(s) on a carriageway (max ` +
  `${BUDGET.occupancy.maxViaductLegsOnCarriageway}), worst |x| inside the block ` +
  `${M.viaductLegMaxInBlockM == null ? 'n/a' : M.viaductLegMaxInBlockM.toFixed(2)} m (band ` +
  `${BUDGET.occupancy.viaductLegsInsideBlockClearBandM} m)`
);

// ---------------------------------------------------------------------------
// 1. clumping, not uniform distribution

const chunks = placement.chunks;
const densities = chunks.map((c) => c.objectCount / (placement.chunkSize * placement.chunkSize));
const cv = stddev(densities) / Math.max(1e-9, mean(densities));
const populated = chunks.filter((c) => c.objectCount > 0).length / Math.max(1, chunks.length);
M.propCV = cv;
M.populatedFraction = populated;

notes.push(
  `clumping         CV ${cv.toFixed(3)} (min ${BUDGET.clumping.minDensityCV}) over ${chunks.length} chunks, ` +
  `${(populated * 100).toFixed(0)}% populated (min ${(BUDGET.clumping.minPopulatedFraction * 100).toFixed(0)}%), ` +
  `objects/chunk min ${Math.min(...chunks.map((c) => c.objectCount))} max ${Math.max(...chunks.map((c) => c.objectCount))}`
);

/**
 * THE POPULATION THIS VERDICT IS ONE DRAW FROM — SESSION 37. IT ASSERTS
 * NOTHING, DELIBERATELY, AND THAT IS THE PRECEDENT IT IS FOLLOWING.
 *
 * CONTRACT §0 rule 6 forbids a decision on a difference smaller than the
 * instrument's own spread. The line above is the CV of ONE region at ONE seed
 * compared against a fixed floor, and its delivered margin has been hundredths
 * for six sessions. Session 36 recorded that the same statistic reads 0.626 at
 * seed 1337 and 0.466 at the worst of five, *"a spread of 0.160 against a floor
 * margin of 0.026"*, and did not act on it. Over the twelve regions below the
 * spread is larger still.
 *
 * WHY THE ESTIMATOR IS NOT CHANGED HERE, IN THE WORDS THIS PROJECT ALREADY
 * USED. `budget.json`'s `$screenshotEntropy_s17`: *"perfcheck now PRINTS every
 * run's mean and entropy so that session has a population. An estimator arrives
 * with the cases that hold it honest or it does not arrive."* This is the same
 * move on the same kind of statistic. A pooled median here would leave the
 * shipped city red exactly as the single draw does — measured, session 37 —
 * so it would buy no verdict, and `city-budget.json`'s derivation beside
 * `minDensityCV` records the reason it would buy no MEANING either: this
 * statistic correlates at r = 0.92 with how much park, yard and building site
 * the window happens to contain, which `negativeSpace` already asserts. Pooling
 * a contaminated statistic measures the wrong thing precisely.
 *
 * IT RUNS THE PURE GENERATOR, so it costs no frame and no browser, and it is
 * CONTROLLED against the page: the region at the gate's own seed must reproduce
 * the placement CV above exactly, or this block says so instead of quietly
 * measuring a second, different city (CONTRACT §9.1).
 */
{
  const R = BUDGET.region;
  const seeds = [String(SEED), ...Array.from({ length: 11 }, (_, i) => String(Number(SEED) + 1 + i))];
  const rows = [];
  for (const sd of seeds) {
    const counts = [];
    for (let cz = R.cz[0]; cz <= R.cz[1]; cz++) {
      for (let cx = R.cx[0]; cx <= R.cx[1]; cx++) counts.push(generateChunk(Number(sd), cx, cz).objectCount);
    }
    const mu = counts.reduce((a, v) => a + v, 0) / counts.length;
    rows.push({
      sd,
      cv: Math.sqrt(counts.reduce((a, v) => a + (v - mu) ** 2, 0) / counts.length) / mu,
    });
  }
  const cvs = rows.map((r) => r.cv).sort((a, b) => a - b);
  const med = cvs.length % 2 ? cvs[(cvs.length - 1) / 2] : (cvs[cvs.length / 2 - 1] + cvs[cvs.length / 2]) / 2;
  const control = Math.abs(rows[0].cv - cv);
  const floor = BUDGET.clumping.minDensityCV;
  const below = cvs.filter((v) => v < floor).length;
  notes.push(
    `                 THE POPULATION, asserted on nothing: the same statistic over ${rows.length} regions ` +
    `(seeds ${seeds[0]}–${seeds[seeds.length - 1]})
` +
    `                 ${rows.map((r) => r.cv.toFixed(3)).join(' ')}
` +
    `                 median ${med.toFixed(3)}  min ${cvs[0].toFixed(3)}  max ${cvs[cvs.length - 1].toFixed(3)}  ` +
    `spread ${(cvs[cvs.length - 1] - cvs[0]).toFixed(3)}  — ${below} of ${rows.length} below the ${floor} floor
` +
    `                 control: the gate's own seed reproduces the placement CV to ${control.toExponential(1)}` +
    `${control > 1e-9 ? '  ← IT DOES NOT; this block and the line above are measuring different cities' : ''}`
  );
}

// ---------------------------------------------------------------------------
// 1a. the scene walk — what was BUILT, against what was written down
//
// Everything else in this file reads placement data, which is the generator's
// own description of what it decided. That is the right source for a claim
// about the generator and the wrong one for a claim about the city, and it is
// the arrangement in which `pierEvery: 34` sat in the data while `i % 3 === 0`
// sat in the code and 48 metres shipped past six green gates.

const SW = BUDGET.sceneWalk;
// Filled unconditionally, including for the run where the census came back
// empty, so that `M` has one shape rather than one per outcome. `hasCensus` is
// what judgeCity branches on; the zeros below are never read once it is false.
M.hasCensus = !!census;
M.lampBowl = lampBowl;
M.streamed = streamed;
M.streamedTimedOut = !!(streamed && streamed.timedOut);
M.instancedMeshes = census ? census.instancedMeshes : 0;
M.unlabelled = census ? census.unlabelled : 0;
M.mismatches = census ? census.mismatches : [];
M.underdrawn = census ? census.underdrawn.length : 0;
M.underdrawnFraction = 0;
M.propsInsideBuildings = 0;
M.propTotal = 0;

if (census) {
  const labelled = census.instancedMeshes - census.unlabelled;
  const underdrawnFraction = census.underdrawn.length / Math.max(1, census.instancedMeshes);
  M.underdrawnFraction = underdrawnFraction;
  notes.push(
    `scene walk       ${census.instancedMeshes} instanced meshes (${labelled} labelled, ` +
    `${census.unlabelled} not), ${census.plainMeshes} plain\n` +
    `                 delivered by kind: ` +
    Object.entries(census.totals).filter(([k]) => k !== 'chunk')
      .map(([k, v]) => `${k} ${v}`).join(', ') + '\n' +
    `                 ${census.mismatches.length} mesh(es) whose label does not sum to ` +
    `instanceMatrix.count, ${census.underdrawn.length} drawing fewer than they allocated` +
    (streamed ? `\n                 city arrived over ${streamed.frames} frames / ${streamed.ms} ms` +
      (streamed.field ? ` (${streamed.field.baked} of ${streamed.field.resident} field bakes landed)` : '') +
      (streamed.timedOut ? ` — TIMED OUT on ${streamed.timedOutOn}, the census is of a partial city` : '') : '')
  );

  /**
   * Props inside buildings.
   *
   * Measured from placement data on purpose, and stated as such: this is the
   * one part of the scene walk that a census of instance COUNTS cannot answer,
   * because a prop inside a building is drawn exactly like a prop beside one.
   * `src/lib/citygen.js` scatters props uniformly over `island` — the whole
   * chunk interior — and tests them against the landmark keep-outs and nothing
   * else, while the perimeter buildings occupy 15 to 26 m of that interior on
   * every side. So the bollards, bins and cabinets are inside buildings and in
   * back courts. The same defect as session 5's piers, in a second place, which
   * is what makes it a rule rather than an incident.
   */
  let inside = 0;
  let propTotal = 0;
  for (const c of chunks) {
    // Buildings only. Since session 15 the same array also carries the river's
    // bridge-deck boxes (the canyon bake needs them), and a prop standing on a
    // quay 20 m from a deck is not a prop inside a building. `river` labels
    // them for exactly this reason, the way `landmark` already did.
    const boxes = (c.occluders || []).filter((o) => o.landmark == null && o.river == null);
    for (const p of c.props || []) {
      propTotal++;
      for (const b of boxes) {
        if (p.x >= b.x0 && p.x <= b.x1 && p.z >= b.z0 && p.z <= b.z1) { inside++; break; }
      }
    }
  }
  M.propsInsideBuildings = inside;
  M.propTotal = propTotal;
  notes.push(
    `prop placement   ${inside} of ${propTotal} props inside a building footprint ` +
    `(${((inside / Math.max(1, propTotal)) * 100).toFixed(1)}%, max ${SW.maxPropsInsideBuildings})`
  );
}

// ---------------------------------------------------------------------------
// 1a-ii. SIGNAGE: where the quads ended up, and how far off the wall they stand.
//
// TWO QUESTIONS, AND THEY ARE THE §7.2 PAIR.
//
// The category floor is "how many mountings does the generator have", which is
// a statement about the generator's vocabulary. The paired measurement is "do
// the delivered quads actually STAND OFF the elevation", which is the property
// the mountings were assumed to carry — a sign flat on a wall is edge-on to
// anyone walking down the street, and four names in a table do not make one
// project. CONTRACT §7.2: a floor that counts categories is paired with one
// that measures the property, and the pair is written together.
//
// Both read the DELIVERED matrices. `chunk.signs` carries the building's centre
// and can say nothing about either.

if (signQuads && signQuads.quads && signQuads.occluders) {
  const boxes = signQuads.occluders;
  /** 3-D distance from a point to an axis-aligned box; 0 inside. */
  const distToBox = (p, b) => {
    const dx = Math.max(b.x0 - p[0], 0, p[0] - b.x1);
    const dy = Math.max(0, p[1] - b.top);
    const dz = Math.max(b.z0 - p[2], 0, p[2] - b.z1);
    return Math.hypot(dx, dy, dz);
  };
  const standoffs = [];
  let inside = 0;
  for (const q of signQuads.quads) {
    let best = Infinity;
    let buried = false;
    for (const b of boxes) {
      if (q[0] > b.x0 && q[0] < b.x1 && q[2] > b.z0 && q[2] < b.z1 && q[1] < b.top) { buried = true; break; }
      const d = distToBox(q, b);
      if (d < best) best = d;
    }
    if (buried) { inside++; continue; }
    if (Number.isFinite(best)) standoffs.push(best);
  }
  standoffs.sort((a, b) => a - b);
  const pct = (p) => (standoffs.length ? standoffs[Math.min(standoffs.length - 1, Math.floor(p * standoffs.length))] : 0);
  M.signQuadTotal = signQuads.quads.length;
  M.signsInsideBuildings = inside;
  M.signStandoffP10 = +pct(0.10).toFixed(3);
  M.signStandoffP90 = +pct(0.90).toFixed(3);
  M.signStandoffSpread = +(M.signStandoffP90 - M.signStandoffP10).toFixed(3);
  notes.push(
    `sign placement   ${inside} of ${M.signQuadTotal} delivered sign quads inside a building ` +
    `(max ${SW.maxSignsInsideBuildings}); standoff from the nearest elevation p10 ${M.signStandoffP10} m ` +
    `p90 ${M.signStandoffP90} m, spread ${M.signStandoffSpread} m (min ${SW.minSignStandoffSpreadM})`
  );
} else {
  M.signQuadTotal = 0;
}

// The generator's own mounting vocabulary, from the placement data, which is
// the right source for a claim about the generator (§9.1) and the wrong one for
// the claim above.
{
  const mounts = new Set();
  let n = 0;
  for (const c of placement.chunks) for (const s of c.signs || []) { n++; if (s.mount) mounts.add(s.mount); }
  M.signMountings = mounts.size;
  M.signMountingList = [...mounts].sort();
  notes.push(
    `sign mountings   ${M.signMountings} distinct (${M.signMountingList.join(', ') || 'none'}) over ${n} generated signs ` +
    `(min ${SW.minSignMountings})`
  );
}

// ---------------------------------------------------------------------------
// 1a-iii. STREET LEVEL: the stalls, and the §7.2 pair over their awnings.
//
// `city-budget.json` → `streetLevel` has carried `minStallsNearRing`,
// `minStallKinds` and `maxStallLightSlots` since session 4b AND NO GATE READ
// ANY OF THEM. That is CONTRACT §9.1's "a value written in config that the code
// does not read" with a whole block instead of one number, and it is worse than
// the pier spacing was: a reader opening that file sees three derivations and a
// `$comment` explaining the light-slot arithmetic, and every one of them is a
// claim nothing has ever checked.
//
// THE PAIR. `minStallKinds` and `minAwningCloths` COUNT categories.
// `minAwningChromaSpreadLinear` MEASURES the property those categories were
// assumed to carry — that the awnings are colours a person can tell apart. Its
// negative control is exact and is what shipped through session 13: one cloth
// reflectance shared by every canopy in the city reads a spread of EXACTLY
// 0.000, by construction rather than by calibration.

if (stalls) {
  M.hasStalls = true;
  M.stallTotal = stalls.total;
  M.stallKinds = stalls.kindsDelivered;
  M.stallLightSlots = stalls.lightSlots;
  M.awningCloths = stalls.clothsDelivered;
  const cols = stalls.clothColours || [];
  let worst = 0;
  for (let i = 0; i < cols.length; i++) {
    for (let j = i + 1; j < cols.length; j++) {
      worst = Math.max(worst, Math.hypot(cols[i][0] - cols[j][0], cols[i][1] - cols[j][1], cols[i][2] - cols[j][2]));
    }
  }
  M.awningChromaSpread = +worst.toFixed(4);
  notes.push(
    `street level     ${M.stallTotal} stalls (min ${SL.minStallsNearRing}) over ${stalls.ringChunks} chunks, ` +
    `${M.stallKinds} kinds (min ${SL.minStallKinds}), ${M.stallLightSlots} light slots (max ${SL.maxStallLightSlots}), ` +
    `${stalls.gaveUp} pitches abandoned\n` +
    `                 awnings ${M.awningCloths} cloths (min ${SL.minAwningCloths}), widest pair ` +
    `${M.awningChromaSpread} in linear RGB (min ${SL.minAwningChromaSpreadLinear})`
  );
} else {
  M.hasStalls = false;
}

// ---------------------------------------------------------------------------
// 1b. pedestrian clumping — the same claim as §1, about a different population

const PED = BUDGET.pedestrians;
M.hasPedestrians = !!pedestrians;
M.pedTotal = pedestrians ? pedestrians.total : 0;
M.pedCV = pedestrians ? pedestrians.densityCV : 0;
M.pedPopulatedFraction = 0;

if (!pedestrians) {
  notes.push(
    `pedestrians      none — nothing in the scene declares a pedestrian population, so the ` +
    `${PED.minDensityCV} clumping floor is unmeasured`
  );
} else {
  const popFraction = pedestrians.populated / Math.max(1, pedestrians.chunks);
  M.pedPopulatedFraction = popFraction;
  notes.push(
    `pedestrians      ${pedestrians.total} over ${pedestrians.chunks} chunks, CV ` +
    `${pedestrians.densityCV} (min ${PED.minDensityCV}), ${(popFraction * 100).toFixed(0)}% populated ` +
    `(min ${(PED.minPopulatedFraction * 100).toFixed(0)}%)`
  );
}

// ---------------------------------------------------------------------------
// 2. age, wear and mixed vintage

const eras = new Set();
for (const c of chunks) for (const b of c.buildings) eras.add(b.era);
const roadVariants = new Set(chunks.flatMap((c) => c.roadMaterials || []));
const signs = chunks.flatMap((c) => c.signs || []);
const dead = signs.filter((s) => s.state !== 'lit').length;
const deadFraction = signs.length ? dead / signs.length : 0;
M.eras = eras.size;
M.signCount = signs.length;
M.deadSignFraction = deadFraction;
M.roadVariants = roadVariants.size;

notes.push(
  `vintage          ${eras.size} eras (min ${BUDGET.vintage.minEras}): ${[...eras].join(', ')}\n` +
  `                 ${signs.length} signs, ${dead} not working = ${(deadFraction * 100).toFixed(1)}% ` +
  `(min ${(BUDGET.vintage.minDeadSignageFraction * 100).toFixed(0)}%, max ${(BUDGET.vintage.maxDeadSignageFraction * 100).toFixed(0)}%)\n` +
  `                 ${roadVariants.size} road materials (min ${BUDGET.vintage.minRoadMaterialVariants}): ${[...roadVariants].join(', ')}`
);

// ---------------------------------------------------------------------------
// 3. imperfect alignment — both bounds matter

const placed = [];
for (const c of chunks) {
  for (const b of c.buildings) placed.push([b.yawDeg, 0]);
  for (const p of c.props || []) placed.push([p.yawDeg, p.refDeg || 0]);
  for (const s of c.signs || []) placed.push([s.yawDeg, 0]);
}
/**
 * DEVIATION FROM THE AXIS THE OBJECT IS ALIGNED TO — and until session 21 that
 * was assumed to be the grid, for everything.
 *
 * WHAT WAS WRONG, AND IT IS CONTRACT §9's TABLE WITH AN ANGLE. This computed
 * the delivered yaw's distance from the nearest right angle and used it as
 * "how far off its own alignment is this object". Those are the same quantity
 * for every object on the lattice and a different one for anything on a CURVE:
 * the river's promenade runs at up to **11.46°** to the grid where the meander
 * is steepest, so a bollard perfectly lined up with its own quay read as
 * 11.46° of deviation. `river.js` derives the quay wall's segments from exactly
 * the same tangent and nothing complains, because a wall is not in this list.
 *
 * It was inert until this session: the promenade band admitted almost nothing,
 * because `propHalfAcross` was the MAXIMUM over a kind's variants and the
 * promenade's clearance test used it. Making that pad per-variant (see
 * `PROP_HALF_ACROSS_VARIANT`) let the narrow variants onto the quay, and the
 * measured maximum went 2.27° → 11.46° with no change to any yaw expression.
 *
 * THE THRESHOLD DOES NOT MOVE. `maxDeviationDeg` is 3 before and after, and the
 * negative direction is what makes this a correction rather than a licence
 * (CONTRACT §7.3.1): a prop misaligned with its OWN kerb by more than 3° still
 * fails, which is what `alignment.maxDeviation` falsifies, and `refDeg` is 0
 * for every building, every sign and every prop not on a kerb — so for those
 * populations the reading is unchanged, bit for bit.
 */
const deviations = placed.map(([y, ref]) => {
  const m = (((y - ref) % 90) + 90) % 90;
  return Math.min(m, 90 - m);
});
const offAxis = deviations.filter((d) => d >= BUDGET.alignment.minDeviationDeg);
const offAxisFraction = placed.length ? offAxis.length / placed.length : 0;
const maxDeviation = deviations.length ? Math.max(...deviations) : 0;
M.placedCount = placed.length;
M.offAxisFraction = offAxisFraction;
M.maxDeviation = maxDeviation;

notes.push(
  `alignment        ${(offAxisFraction * 100).toFixed(1)}% of ${placed.length} objects off-axis ` +
  `(min ${(BUDGET.alignment.minOffAxisFraction * 100).toFixed(0)}%), largest deviation ${maxDeviation.toFixed(2)}° ` +
  `(max ${BUDGET.alignment.maxDeviationDeg}°)`
);

// ---------------------------------------------------------------------------
// 4. the saturation reserve — the one pixel measurement

/**
 * CONTRACT §0 rule 6. The verdict is the MEDIAN of the per-run maxima; the
 * per-run maxima and their spread are printed beside it, because "10.19%
 * against 12%" with no error bar is the state that let a 0.90-point margin be
 * decided by a 0.95-point noise floor. See `poolSaturation`.
 */
const satPool = satRuns.length ? poolSaturation(satRuns) : { perRun: [], pooled: 1, spread: null };
const satMax = satPool.pooled;
const satMean = mean(satSamples);
M.satMax = satMax;
notes.push(
  `saturation       ${(satMean * 100).toFixed(2)}% mean / ${(satMax * 100).toFixed(2)}% pooled peak of pixels above ` +
  `${BUDGET.saturation.threshold} saturation and ${BUDGET.saturation.valueThreshold} value\n` +
  `                 ${BUDGET.saturation.estimatorLabel || 'median of per-run maxima'} over ` +
  `${satRuns.length} run${satRuns.length === 1 ? '' : 's'} x ${BUDGET.saturation.samples} samples of the ` +
  `${BUDGET.saturation.route} route: [${satPool.perRun.map((v) => (v * 100).toFixed(2)).join(' ')}]` +
  (satPool.spread != null ? ` spread ${(satPool.spread * 100).toFixed(2)} points` : '') +
  `, ceiling ${(BUDGET.saturation.maxFraction * 100).toFixed(0)}%\n` +
  `                 per-run city: ` +
  satStreamed.map((v, i) =>
    `run${i} ${v && v.field ? `${v.field.baked}/${v.field.baked + (v.field.queued || 0) + (v.field.inFlight || 0)} bakes, ` +
    `${v.field.resident} resident` : 'unknown'}${v && v.timedOut ? ' TIMED OUT' : ''}`
  ).join('  ')
);

/**
 * THE OTHER HALF OF THE PREDICATE, PRINTED BESIDE IT (CONTRACT §9 rule 4: when
 * one number is derived from another, print both). `glowMean / brightMean` is
 * what share of the bright pixels are also chromatic — the reserve's own
 * question expressed as a ratio, and the number that says which of the two ways
 * of lowering the ceiling a session took.
 */
const brightPool = brightRuns.length ? poolBright(brightRuns) : { perRun: [], pooled: 0, spread: null };
const brightMean = brightPool.pooled;
M.brightMean = brightMean;
notes.push(
  `bright reserve   ${(brightMean * 100).toFixed(2)}% of pixels above ${BUDGET.saturation.valueThreshold} value, ` +
  `floor ${(BUDGET.saturation.minBrightFraction * 100).toFixed(2)}%  ` +
  `— the SECOND CONJUNCT of the same predicate, on the same pixels\n` +
  `                 median of per-run means over ${brightRuns.length} run${brightRuns.length === 1 ? '' : 's'}: ` +
  `[${brightPool.perRun.map((v) => (v * 100).toFixed(2)).join(' ')}]` +
  (brightPool.spread != null ? ` spread ${(brightPool.spread * 100).toFixed(2)} points` : '') + '\n' +
  `                 chromatic share ${(satMean * 100).toFixed(2)} / ${(mean(brightSamples) * 100).toFixed(2)} = ` +
  `${(satMean / Math.max(1e-9, mean(brightSamples))).toFixed(3)} of bright pixels also clear ${BUDGET.saturation.threshold} saturation\n` +
  `                 a ceiling on the first number is met by lowering EITHER conjunct; this floor is the second one`
);

/**
 * THE LAMP BOWL, DERIVED AND DELIVERED ON ONE LINE — session 28, and the line
 * is the point. These two numbers existed in two files for ten sessions and
 * nothing ever printed them together; CONTRACT §9 rule 2 says a quantity
 * derived two ways is printed both ways at least once, and this is the once.
 */
if (lampBowl) {
  notes.push(
    `lamp bowls       derived ${lampBowl.derivedNits.toFixed(1)} cd/m² = Φ/(π·A) over a ` +
    `${lampBowl.paths[0] ? lampBowl.paths[0].radiusM : '?'} m bowl, photocell ` +
    `${lampBowl.lampsOn ? 'on' : 'OFF'}\n` +
    lampBowl.paths.map((p) =>
      `                 ${p.path.padEnd(9)} delivered ${p.deliveredNits.toFixed(1).padStart(7)} cd/m² = ` +
      `${(p.deliveredNits / lampBowl.derivedNits).toFixed(4)}× derived, on ${p.meshes} mesh(es) ` +
      `(ratchet [${BUDGET.lampBowl.minRatio}, ${BUDGET.lampBowl.maxRatio}], toward 1.0 only)`).join('\n')
  );
} else {
  notes.push('lamp bowls       UNRUN — harness.lampBowlCensus() returned nothing');
}

// ---------------------------------------------------------------------------
// 5. negative space and dead zones

const low = chunks.filter((c) => c.lowDetail);
const lowFraction = low.length / Math.max(1, chunks.length);
const lowKinds = new Set(low.map((c) => c.kind));
M.lowDetailFraction = lowFraction;
M.lowKinds = lowKinds.size;
notes.push(
  `negative space   ${(lowFraction * 100).toFixed(1)}% of chunks low-detail (min ${(BUDGET.negativeSpace.minLowDetailFraction * 100).toFixed(0)}%), ` +
  `${lowKinds.size} kinds (min ${BUDGET.negativeSpace.minDistinctKinds}): ${[...lowKinds].join(', ')}`
);

// ---------------------------------------------------------------------------
// 6. authored landmarks

const L = BUDGET.landmarks;
const landmarks = placement.landmarks || [];
const boxes = chunks.flatMap((c) => c.occluders || []);

const eye = placement.elevatedEye;
const visible = landmarks.filter((lm) => {
  const own = boxes.filter((b) => b.landmark === lm.name);
  /**
   * Sampled across the landmark's EXTENT, not down one column at its centre.
   *
   * A 480 m viaduct is visible if any part of it is, and testing only the point
   * at its centroid asks a question about a place the structure barely occupies.
   * Likewise the top and two thirds of the height, because a landmark whose base
   * is hidden behind a nearer building is still something you can navigate by.
   */
  const a = lm.aabb;
  const xs = [lm.x, a.x0 + (a.x1 - a.x0) * 0.15, a.x0 + (a.x1 - a.x0) * 0.85];
  const zs = [lm.z, a.z0 + (a.z1 - a.z0) * 0.15, a.z0 + (a.z1 - a.z0) * 0.85];
  for (const y of [lm.height, lm.height * 0.66]) {
    for (let i = 0; i < xs.length; i++) {
      if (segmentClear(eye, [xs[i], y, zs[i]], boxes, own)) return true;
    }
  }
  return false;
});

// ---------------------------------------------------------------------------
// 5a. the river — session 15
//
// TWO QUESTIONS AND THEY ARE THE §7.2 PAIR, plus the occupancy test §9.1 asks
// of anything placed.
//
// The category floor is "how many structures does the river carry", which is a
// statement about the generator's vocabulary. The paired measurement is "do
// those structures actually differ ABOVE THE DECK", which is the property the
// three names were assumed to carry — a girder, an arch and a cable-stayed span
// that all read as a flat line at half a kilometre are one bridge with three
// labels, which is `trafficLights.minBodyTypes: 4` passing at 5 on five
// flat-topped grey boxes.
//
// The clearance is measured HERE from the pure generator rather than read off
// the module, because it is a claim about where the water IS and the module
// draws where it is told.

M.hasRiver = !!riverCensus;
if (riverCensus) {
  const built = riverCensus.bridges || [];
  const above = built.map((b) => b.aboveDeck);
  M.bridgesBuilt = built.length;
  M.riverWindowM = 2 * CITY.detailRadius * CITY.chunkSize;
  M.bridgeAboveDeckSpread = above.length ? Math.max(...above) - Math.min(...above) : 0;

  /**
   * THE VOCABULARY IS COUNTED OVER THE REGION AND THE PROPERTY IS MEASURED OVER
   * WHAT WAS BUILT, AND THE SPLIT IS §7.2's OWN SENTENCE.
   *
   * "A category floor on its own is a statement about the generator's
   * vocabulary. The paired assertion is the statement about the world." The
   * crossings are 512 m apart and `river.js` builds a 1 024 m window, so any
   * one camera position sees two or three of them — counting the structures off
   * the built window would make this floor a statement about where the gate's
   * camera happened to stand. So the COUNT walks the region's own crossings
   * through the pure generator, and the SPREAD is read off the bridges that
   * were actually pushed into the scene.
   */
  const region = BUDGET.region;
  const seen = [];
  for (let i = bridgeIndexAt(region.cx[0] * CITY.chunkSize); i <= bridgeIndexAt(region.cx[1] * CITY.chunkSize); i++) {
    const b = bridgeSpec(SEED, i);
    if (!seen.includes(b.structure)) seen.push(b.structure);
  }
  M.bridgeStructures = seen.length;
  M.bridgeStructureList = seen;

  /**
   * The smallest gap between the water's two edges and any landmark's own
   * boxes, walked in x at 1 m over each landmark's own AABB. Negative would be
   * water through masonry; the assertion is on the minimum.
   */
  let worst = Infinity;
  let worstName = null;
  for (const lm of LANDMARKS) {
    const a = landmarkAABB(lm);
    for (let x = Math.floor(a.x0) - 2; x <= Math.ceil(a.x1) + 2; x += 1) {
      const e = riverEdges(x);
      // Outside the landmark's own x span the two do not interact at all.
      if (x < a.x0 || x > a.x1) continue;
      const gap = e.south <= a.z0 ? a.z0 - e.south : e.north >= a.z1 ? e.north - a.z1 : -1;
      if (gap < worst) { worst = gap; worstName = lm.name; }
    }
  }
  M.riverLandmarkClearance = worst === Infinity ? 999 : worst;
  M.riverLandmarkClearanceName = worstName || 'none';

  /**
   * ORIENTATION: WHAT YOU CAN SEE ACROSS THE WATER, FROM THE PAVEMENT.
   *
   * `visibleFromElevation` above asks the question from 200 m up at the corner
   * of the region, which is the establishing shot. This asks it from eye height
   * on a bank, which is where a person stands — and it is the whole reason the
   * river is worth a session: a hundred metres of open water is the only place
   * in this city where a street-level eye has an unobstructed line to something
   * a kilometre away. Every other view is a canyon.
   *
   * TWO EYES, ONE ON EACH BANK, at x = 64 — a station between crossings, so
   * neither eye is standing on a bridge and looking down it. Each counts the
   * landmarks on the OTHER side of the water, so the pair measures the river as
   * a divider rather than the city as a whole: from the south bank that is the
   * condenser and nothing else, and from the north bank it is whatever of the
   * seven southern landmarks the far frontage leaves visible.
   */
  const eyeX = 64;
  const eyeEdges = riverEdges(eyeX);
  const promenade = 3.2;
  const banks = [
    { name: 'north', z: eyeEdges.north - promenade, wants: (lm) => lm.z > eyeEdges.south },
    { name: 'south', z: eyeEdges.south + promenade, wants: (lm) => lm.z < eyeEdges.north },
  ];
  const across = [];
  for (const bank of banks) {
    const bankEye = [eyeX, 1.74, bank.z];
    for (const lm of landmarks) {
      if (!bank.wants(lm)) continue;
      const own = boxes.filter((b) => b.landmark === lm.name);
      const a = lm.aabb;
      const xs = [lm.x, a.x0 + (a.x1 - a.x0) * 0.15, a.x0 + (a.x1 - a.x0) * 0.85];
      const zs = [lm.z, a.z0 + (a.z1 - a.z0) * 0.15, a.z0 + (a.z1 - a.z0) * 0.85];
      let seen = false;
      for (const y of [lm.height, lm.height * 0.66]) {
        for (let i = 0; i < xs.length && !seen; i++) {
          if (segmentClear(bankEye, [xs[i], y, zs[i]], boxes, own)) seen = true;
        }
      }
      if (seen) across.push(`${lm.name}(from ${bank.name})`);
    }
  }
  M.landmarksAcrossWater = across.length;
  M.landmarksAcrossWaterList = across;

  notes.push(
    `river            ${riverCensus.budget.widthMin}–${riverCensus.budget.widthMax} m of water ` +
    `(mean ${riverCensus.budget.meanWidth} = chunkSize − 2·CORRIDOR), ${riverCensus.depth} m below grade, ` +
    `envelope ${riverCensus.budget.envelopeWidth} m\n` +
    `                 ${built.length} bridge(s) built in the ${M.riverWindowM} m window (min ${BUDGET.river.minBridgesBuilt}): ` +
    built.map((b) => `${b.structure}@x${b.x} span ${b.clearSpan} above-deck ${b.aboveDeck}`).join('  ') + `\n` +
    `                 ${seen.length} structure(s) over the region's crossings (min ${BUDGET.river.minBridgeStructures}): ${seen.join(', ')}, ` +
    `above-deck spread ${M.bridgeAboveDeckSpread.toFixed(2)} m (min ${BUDGET.river.minBridgeAboveDeckSpreadM})\n` +
    `                 nearest landmark ${M.riverLandmarkClearance.toFixed(2)} m clear (${M.riverLandmarkClearanceName}, min ${BUDGET.river.minLandmarkClearanceM})\n` +
    `                 ${across.length} landmark sighting(s) across the water at eye height (min ${BUDGET.river.minLandmarksAcrossWater}): ${across.join(', ') || 'none'}`
  );
} else {
  M.bridgesBuilt = 0;
  M.riverWindowM = 0;
  M.bridgeStructures = 0;
  M.bridgeStructureList = [];
  M.bridgeAboveDeckSpread = 0;
  M.riverLandmarkClearance = 0;
  M.riverLandmarkClearanceName = 'none';
  M.landmarksAcrossWater = 0;
  M.landmarksAcrossWaterList = [];
}

// Walkability. The mask is a coarse occupancy grid the city hands over; BFS from
// where the routes start.
const wm = placement.walkable;
const startIx = wm.startZ * wm.width + wm.startX;
const dist = wm.mask[startIx] === 0 ? floodFill(wm.mask, wm.width, wm.height, startIx) : new Int32Array(wm.width * wm.height).fill(-1);
const unreachable = [];
const detours = [];
for (const lm of landmarks) {
  const gx = Math.round((lm.x - wm.originX) / wm.cell);
  const gz = Math.round((lm.z - wm.originZ) / wm.cell);
  // Nearest walkable cell to the landmark's footprint — you walk *to* a tower,
  // not into it.
  /**
   * Search outward from the landmark's own FOOTPRINT, not from its centre.
   *
   * The first version scanned a fixed six cells — 24 m — around the centre
   * point. The condenser is 102 m across, so every cell it looked at was inside
   * the tower, and it concluded that a structure with a road running past its
   * door was unreachable. All eight landmarks failed, which is the tell: when a
   * check rejects everything, the check is usually what is wrong.
   */
  const reach = Math.ceil((lm.footprint / 2 + 44) / wm.cell);
  let best = -1;
  for (let r = 1; r <= reach && best < 0; r++) {
    for (let oz = -r; oz <= r && best < 0; oz++) {
      for (let ox = -r; ox <= r && best < 0; ox++) {
        if (Math.max(Math.abs(ox), Math.abs(oz)) !== r) continue;
        const nx = gx + ox;
        const nz = gz + oz;
        if (nx < 0 || nz < 0 || nx >= wm.width || nz >= wm.height) continue;
        const d = dist[nz * wm.width + nx];
        if (d >= 0) best = d;
      }
    }
  }
  if (best < 0) unreachable.push(lm.name);
  else {
    const straight = Math.hypot(lm.x - wm.startWorldX, lm.z - wm.startWorldZ) / wm.cell;
    detours.push({ name: lm.name, ratio: best / Math.max(1, straight) });
  }
}
const worstDetour = detours.length ? detours.reduce((a, b) => (b.ratio > a.ratio ? b : a)) : null;
const reachedCells = dist.reduce((a, d) => a + (d >= 0 ? 1 : 0), 0);
const freeCells = wm.mask.reduce((a, m) => a + (m === 0 ? 1 : 0), 0);
notes.push(
  `walkability      ${reachedCells} of ${freeCells} free cells reached from (${wm.startWorldX}, ${wm.startWorldZ}) ` +
  `on a ${wm.width}×${wm.height} grid at ${wm.cell} m — ${((100 * freeCells) / wm.mask.length).toFixed(0)}% of the region is free`
);

notes.push(
  `landmarks        ${landmarks.length} placed (${L.min}–${L.max}), ${visible.length} visible from elevation (min ${L.minVisibleFromElevation}), ` +
  `${unreachable.length} unreachable on foot` +
  (worstDetour ? `, worst detour ${worstDetour.ratio.toFixed(2)}× (${worstDetour.name})` : '') +
  `\n                 ${landmarks.map((l) => `${l.name}@${Math.round(l.height)}m`).join('  ')}`
);

M.landmarkCount = landmarks.length;
M.visibleFromElevation = visible.length;
M.unreachable = unreachable;
M.worstDetourRatio = worstDetour ? worstDetour.ratio : null;
M.worstDetourName = worstDetour ? worstDetour.name : null;
M.generatorProducible = landmarks.filter((l) => !l.outsideGeneratorRange).map((l) => l.name);

// ---------------------------------------------------------------------------
// Every threshold, applied at once, to the state measured above. The order the
// verdicts come back in is the order the sections appear in judgeCity, which is
// the order they appear here, so the failure list reads the same as it did when
// the comparisons were interleaved with the measurements.

for (const [tag, msg] of judgeCity(M, BUDGET)) fail(tag, msg);

// ---------------------------------------------------------------------------

await mkdir(new URL('./city-out/', import.meta.url), { recursive: true });
if (satFrames.length) {
  const worst = satSamples.indexOf(Math.max(...satSamples));
  await writeFile(new URL('./city-out/saturation-peak.png', import.meta.url), satFrames[worst]);
  notes.push(`                 peak sample ${worst} of ${satSamples.length} written to tools/city-out/saturation-peak.png`);
}
await writeFile(
  new URL('./city-out/placement.json', import.meta.url),
  JSON.stringify({ summary: notes, saturation: satSamples, placement }, null, 1)
);

if (JSON_OUT) {
  console.log(JSON.stringify({ pass: fails.length === 0, notes, failures: fails }, null, 2));
} else {
  log('citycheck: docs/authored-city.md, all six items\n');
  for (const n of notes) log('  ' + n);
  if (fails.length) {
    console.log('\nCITY VIOLATIONS\n' + fails.map((f) => '  ✗ ' + f).join('\n'));
    console.log('\nPlacement data written to tools/city-out/placement.json.');
  } else {
    console.log('\nAll six authored-city criteria met. The numbers are necessary and not sufficient — look at the frames.');
  }
}

process.exit(fails.length ? 1 : 0);
