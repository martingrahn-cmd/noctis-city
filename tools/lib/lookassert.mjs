/**
 * lookassert.mjs — every look assertion, as one pure function.
 *
 * Split out of lookcheck.mjs in session 2 so that tools/gateaudit.mjs can call
 * exactly the same code with deliberately wrong frames and prove each threshold
 * rejects them. Session 1's numbers were all "raised until they sat just under
 * what the renderer delivers", which is the right instinct, but nothing ever
 * demonstrated that any of them would fire. An assertion nobody has ever seen
 * fail is a comment.
 *
 * Every failure carries a stable `key`. The audit names keys, not message text,
 * so rewording a message cannot silently disable an audit case.
 *
 * Nothing is removed here. Session 1's checks are present in the same order and
 * with the same meaning; the session 2 checks are appended.
 */

import {
  analyse,
  countEmitterClusters,
  meanSquaredDifference,
  regionStats,
  regionHue,
  countGroundLightPools,
  countReflectionStreaks,
  wallPatch,
  patchFeature,
  featureDistance,
  clusterCount,
  angularDistanceDeg,
} from './lookmetrics.mjs';

/**
 * The budget file has to be honest before the frames are. A band wide enough to
 * accept any plausible result is not a gate, so the shape of the file is
 * asserted before a single pixel is rendered.
 */
export function validateBudget(BUDGET) {
  const problems = [];
  const { meanLuminanceBands: bands, bandRules: rules } = BUDGET;
  const [gLo, gHi] = rules.globalRange;

  let previousHi = -Infinity;
  for (const name of rules.order) {
    const band = bands[name];
    if (!band) {
      problems.push(`no luminance band for '${name}'`);
      continue;
    }
    const [lo, hi] = band;
    if (!(hi > lo)) problems.push(`band '${name}' is empty or inverted: [${lo}, ${hi}]`);
    if (hi - lo > rules.maxBandWidth + 1e-9) {
      problems.push(
        `band '${name}' is ${(hi - lo).toFixed(3)} wide, over the ${rules.maxBandWidth} limit — ` +
          `a band that wide would accept almost anything`
      );
    }
    if (lo < gLo || hi > gHi) problems.push(`band '${name}' [${lo}, ${hi}] leaves the global range [${gLo}, ${gHi}]`);
    if (lo - previousHi < rules.minBandGap - 1e-9) {
      problems.push(
        `band '${name}' starts at ${lo} but the previous band ends at ${previousHi} — ` +
          `gap ${(lo - previousHi).toFixed(3)} is under the ${rules.minBandGap} minimum`
      );
    }
    previousHi = hi;
  }

  /**
   * SESSION 59 — THE SECOND EYE'S BANDS ARE CHECKED FOR SHAPE TOO, and for one
   * fewer property than the first eye's. Width and range are asserted; the
   * ORDER and the GAP are not, and `$tradeBands` carries why: `minBandGap`
   * encodes "the four times are separated in level", which is true of the
   * origin block and false of a trading street, where midnight and dusk
   * measure 0.1926 and 0.1965. A rule that a place cannot satisfy is not a
   * stricter gate, it is a broken one (CONTRACT §0.2's own argument about the
   * 1.2 quiet bar).
   */
  if (BUDGET.tradeBands) {
    for (const name of rules.order) {
      const band = BUDGET.tradeBands[name];
      if (!band) { problems.push(`no trade band for '${name}'`); continue; }
      const [lo, hi] = band;
      if (!(hi > lo)) problems.push(`trade band '${name}' is empty or inverted: [${lo}, ${hi}]`);
      if (hi - lo > rules.maxBandWidth + 1e-9) {
        problems.push(`trade band '${name}' is ${(hi - lo).toFixed(3)} wide, over the ${rules.maxBandWidth} limit`);
      }
      if (lo < gLo || hi > gHi) {
        problems.push(`trade band '${name}' [${lo}, ${hi}] leaves the global range [${gLo}, ${gHi}]`);
      }
    }
  }

  const named = new Set(BUDGET.times.map((t) => t.name));
  for (const name of rules.order) {
    if (!named.has(name)) problems.push(`bandRules.order names '${name}', which is not a captured time`);
  }
  for (const name of named) {
    if (!rules.order.includes(name)) problems.push(`time '${name}' has no band`);
  }

  // Session 2: every region the assertions reference must exist and be a sane
  // rect. A gate that silently measures a zero-width region reports whatever
  // the clamp happened to produce.
  const needed = new Set([
    BUDGET.shadowHue.region,
    BUDGET.groundPools.region,
    BUDGET.facadeHue.regions[0],
    BUDGET.facadeHue.regions[1],
    BUDGET.wetness.region,
    BUDGET.ssrReflections.region,
    ...BUDGET.facadeVariation.patches,
    ...BUDGET.midDistanceVariation.patches,
  ]);
  for (const name of needed) {
    const r = BUDGET.regions[name];
    if (!Array.isArray(r) || r.length !== 4) {
      problems.push(`region '${name}' is referenced by an assertion but is not a [x0,y0,x1,y1] rect`);
      continue;
    }
    const [x0, y0, x1, y1] = r;
    if (!(x1 > x0 && y1 > y0)) problems.push(`region '${name}' is empty or inverted: ${JSON.stringify(r)}`);
    if (x0 < 0 || y0 < 0 || x1 > 1 || y1 > 1) problems.push(`region '${name}' leaves the frame: ${JSON.stringify(r)}`);
    if ((x1 - x0) * (y1 - y0) > 0.6) {
      problems.push(`region '${name}' covers ${(((x1 - x0) * (y1 - y0)) * 100).toFixed(0)}% of the frame — that is not a region`);
    }
  }

  // Session 3: the facade patches are a set, and the assertions over them have
  // to be satisfiable. Asking for more distinct albedo clusters than there are
  // patches is a gate nothing can ever pass, which reads as a hard problem in
  // the renderer rather than as a mistake in this file.
  {
    const F = BUDGET.facadeVariation;
    const patches = new Set(F.patches);
    if (F.patches.length !== patches.size) problems.push('facadeVariation.patches repeats a region');
    if (F.minAlbedoClusters > F.patches.length) {
      problems.push(
        `facadeVariation asks for ${F.minAlbedoClusters} distinct albedo clusters from ` +
          `${F.patches.length} patches — unsatisfiable`
      );
    }
    for (const pair of F.neighbours) {
      if (!Array.isArray(pair) || pair.length !== 2) {
        problems.push(`facadeVariation.neighbours entry ${JSON.stringify(pair)} is not a pair`);
        continue;
      }
      for (const n of pair) {
        if (!patches.has(n)) problems.push(`facadeVariation.neighbours names '${n}', which is not one of the patches`);
      }
    }
  }

  {
    const M = BUDGET.midDistanceVariation;
    const mp = new Set(M.patches);
    if (M.patches.length !== mp.size) problems.push('midDistanceVariation.patches repeats a region');
    if (M.minAlbedoClusters > M.patches.length) {
      problems.push(
        `midDistanceVariation asks for ${M.minAlbedoClusters} clusters from ${M.patches.length} patches — unsatisfiable`
      );
    }
    // The whole point of this assertion is that it is NOT the near band. A rect
    // shared with facadeVariation would make it a second reading of the first.
    for (const n of M.patches) {
      if (BUDGET.facadeVariation.patches.includes(n)) {
        problems.push(`midDistanceVariation names '${n}', which facadeVariation already samples — that is the near band`);
      }
    }
  }

  return problems;
}

/**
 * @param {object} input
 * @param {object} input.budget      parsed look-budget.json
 * @param {object} input.frames      name → analyse() result, dry
 * @param {object} input.wetFrames   name → analyse() result, wet. May be empty.
 * @param {object} input.infoAt      name → harness.info() at capture time
 * @param {string[]} input.consoleErrors
 * @param {string[]} input.pageErrors
 * @returns {{failures: Array<{key: string, message: string}>, report: object}}
 */
export function assertLook({ budget, frames, wetFrames = {}, tradeFrames = {}, infoAt, consoleErrors = [], pageErrors = [] }) {
  const failures = [];
  const fail = (key, message) => failures.push({ key, message });

  /**
   * ASSERTIONS THAT COULD NOT RUN. A gate that cannot run is not a green gate.
   *
   * Some checks sit downstream of another: `facadeAlbedo` is only meaningful if
   * every patch it reads is sitting on one wall, so `facadePatchSample` runs
   * first and the albedo checks are skipped when it fails. Skipping is right —
   * a cluster count over a blend of surfaces is a number about nothing. What was
   * wrong is that the skip was silent, so `facadeAlbedo` had been *suppressed*
   * for two sessions and read as passing. It was not passing; it was not being
   * asked. Session 4 found that out by accident, when correcting an unrelated
   * sample rect let the albedo checks run for the first time and they failed
   * immediately.
   *
   * So every suppression is recorded with what suppressed it. `lookcheck`
   * prints them under their own heading and `gateaudit` treats a suppressed
   * assertion as a distinct outcome from a passing one — including on its
   * control run, where an assertion that does not run is an audit failure even
   * though nothing is red.
   */
  const suppressed = [];
  const cannotRun = (key, because) => suppressed.push({ key, because });

  const report = { clusters: {}, msd: {}, regions: {}, wet: {} };

  const names = budget.times.map((t) => t.name);
  const R = budget.regions;

  // ---- session 1 -----------------------------------------------------------

  for (const name of names) {
    report.clusters[name] = countEmitterClusters(frames[name], budget.emitterClusters);
  }

  // bands
  for (const name of names) {
    const [lo, hi] = budget.meanLuminanceBands[name];
    const v = frames[name].meanLuminance;
    if (v < lo || v > hi) {
      fail(`band:${name}`, `${name}: mean luminance ${v.toFixed(4)} outside its band [${lo}, ${hi}]`);
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * THE SECOND EYE'S BANDS — SESSION 59.
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * The four above grade a frame standing inside `BLOCK_KEEPOUT`, which the
   * streamed generator is clipped out of; these grade a street the generator
   * built. `look-budget.json` → `$tradeBands` carries where each number comes
   * from, and it is a DERIVATION rather than a re-derivation: no threshold is
   * being moved, four are being written for a place that has never had any.
   *
   * ABSENT IS UNRUN AND NOT PASSED. If the capture did not produce the frames
   * — the shot missing, the city not re-streamed — this says so in its own
   * voice instead of asserting over an empty object, which is CONTRACT §7.1's
   * quiet gate exactly.
   */
  if (budget.tradeBands) {
    for (const name of names) {
      const m = tradeFrames[name];
      if (!m) {
        fail(`band:trade:${name}`,
          `trade eye: no ${name} frame was captured — UNRUN, not passed`);
        continue;
      }
      const [lo, hi] = budget.tradeBands[name];
      const v = m.meanLuminance;
      report.tradeBands = report.tradeBands || {};
      report.tradeBands[name] = +v.toFixed(4);
      if (v < lo || v > hi) {
        fail(`band:trade:${name}`,
          `trade eye ${name}: mean luminance ${v.toFixed(4)} outside its band [${lo}, ${hi}]`);
      }
    }
  }

  // clipping and crush
  for (const name of names) {
    const m = frames[name];
    if (m.clippedWhite > budget.clipping.maxClippedWhite) {
      fail(
        `clipWhite:${name}`,
        `${name}: ${(m.clippedWhite * 100).toFixed(3)}% of pixels fully clipped white ` +
          `(max ${(budget.clipping.maxClippedWhite * 100).toFixed(3)}%)`
      );
    }
    const isNight = name === 'midnight' || name === 'dusk';
    const limit = isNight ? budget.clipping.maxCrushedBlackNight : budget.clipping.maxCrushedBlackDay;
    if (m.crushedBlack > limit) {
      fail(
        `crushBlack:${name}`,
        `${name}: ${(m.crushedBlack * 100).toFixed(3)}% of pixels crushed to black (max ${(limit * 100).toFixed(3)}%)`
      );
    }
  }

  // spread
  for (const name of names) {
    const floor = budget.spread.minStdDev[name];
    const v = frames[name].stdDev;
    if (v < floor) {
      fail(`stddev:${name}`, `${name}: luminance stddev ${v.toFixed(4)} below the ${floor} floor — the frame is flat`);
    }
  }

  // emitters
  {
    const got = report.clusters.midnight.clusters;
    const need = budget.emitterClusters.minCountNight;
    if (got < need) fail('emitters:midnight', `midnight: ${got} distinct saturated emitter clusters, need ${need}`);
  }

  // distinctness
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const msd = meanSquaredDifference(frames[names[i]], frames[names[j]]);
      report.msd[`${names[i]}|${names[j]}`] = msd;
      if (msd < budget.distinctness.minPairMSD) {
        fail(
          `distinct:${names[i]}|${names[j]}`,
          `${names[i]} and ${names[j]} differ by only ${msd.toFixed(5)} MSD (min ${budget.distinctness.minPairMSD})`
        );
      }
    }
  }

  // warmth — the physical sky's fingerprint
  {
    const noon = frames.noon.meanRminusB;
    const dusk = frames.dusk.meanRminusB;
    const dawn = frames.dawn.meanRminusB;
    if (dusk - noon < budget.warmth.minDuskOverNoon) {
      fail(
        'warmth:dusk',
        `dusk is not warmer than noon: R-B ${dusk.toFixed(3)} vs ${noon.toFixed(3)} (need +${budget.warmth.minDuskOverNoon})`
      );
    }
    if (dawn - noon < budget.warmth.minDawnOverNoon) {
      fail(
        'warmth:dawn',
        `dawn is not warmer than noon: R-B ${dawn.toFixed(3)} vs ${noon.toFixed(3)} (need +${budget.warmth.minDawnOverNoon})`
      );
    }
  }

  // photocell
  for (const name of budget.photocell.onAt) {
    if (!infoAt[name].photocellOn) fail(`photocell:${name}`, `${name}: street lighting is off but should be on`);
  }
  for (const name of budget.photocell.offAt) {
    if (infoAt[name].photocellOn) fail(`photocell:${name}`, `${name}: street lighting is on but should be off`);
  }

  // hard fails
  if (consoleErrors.length > budget.hardFails.consoleErrors) {
    fail('hard:console', `console errors: ${consoleErrors.slice(0, 4).join(' | ')}`);
  }
  if (pageErrors.length > budget.hardFails.pageErrors) {
    fail('hard:page', `page errors: ${pageErrors.slice(0, 4).join(' | ')}`);
  }
  for (const name of names) {
    const i = infoAt[name];
    if (i.faults > budget.hardFails.quarantinedModules) {
      fail(`hard:faults:${name}`, `${name}: ${i.faults} quarantined module(s) — the frame rendered without part of the pipeline`);
    }
    if (i.clusterOverflow !== budget.hardFails.clusterOverflow) {
      fail(`hard:overflow:${name}`, `${name}: clustered lighting overflowed — lights were silently dropped`);
    }
  }

  // ---- session 2 -----------------------------------------------------------

  /**
   * The shadowed road at noon.
   *
   * A horizontal surface that sees an unoccluded blue sky and nothing else is
   * genuinely that blue — the sky model is not wrong. What is missing is the
   * canyon: the road should see the strip of sky the buildings leave it, plus
   * the light the sunlit facades bounce down. Both are chromaticity, not level,
   * so no exposure change can pass this and no exposure change can fail it.
   */
  {
    const name = budget.shadowHue.at;
    const s = regionStats(frames[name], R[budget.shadowHue.region]);
    report.regions.shadowRoad = s;
    if (s.blueOverRed > budget.shadowHue.maxBlueOverRed) {
      fail(
        'shadowHue',
        `${name}: shadowed road is blue — mean B/R ${s.blueOverRed.toFixed(3)} over the ${budget.shadowHue.maxBlueOverRed} ceiling ` +
          `(mean RGB ${s.mean.map((v) => v.toFixed(0)).join(',')})`
      );
    }
  }

  /**
   * RETIRED IN SESSION 3 — `hueVariance` at dawn, and `facadeHue` at dawn.
   *
   * Both encoded the same claim: that indirect light would separate a warm sun
   * from a cool sky and make the dawn frame less monochrome. In a canyon that
   * claim is false. The fill on a shadowed surface at dawn is not cool sky, it
   * is the sunlit wall opposite, which is warm — so indirect light correctly
   * makes dawn *more* monochrome, and the measurement showed exactly that:
   * 16.9° in session 1, 12.9° once the canyon field was carrying the fill.
   *
   * This is a SPECIFICATION CORRECTION, not a threshold reduction, and the two
   * are not allowed to be confused in this repo. A threshold reduction leaves
   * the assertion standing and moves the number, because the property is real
   * and the renderer fell short of it. A specification correction deletes the
   * assertion, because the property was never true of the thing being built.
   * The test for which one you are doing: if the renderer got *better* and the
   * number got *worse*, the assertion was measuring something else.
   *
   * `hueVariance` existed only at dawn, so the whole block is gone.
   * `facadeHue` keeps its noon entry unchanged (20°, delivered 137.9°); only
   * the dawn floor is removed, and with it dawn's `facadeHueSample` check,
   * which existed to prove the dawn separation was not measured on noise.
   *
   * What does NOT go with it: the multiple-scattering table in the doc comment
   * on `ATM.multiScatterPathNeutral`. That table is the argument for a
   * second-order scattering LUT, which is a real gap and a session of its own.
   */

  /**
   * Sunlit against shadowed.
   *
   * The two facade bands are the north and south sides of the same street, so
   * whichever one the sun is on, the other is the shadow. Asserted as an
   * unsigned angular distance for that reason: at noon the sun is on the right
   * band, and a gate that hardcoded which was which would be asserting the time
   * of day rather than the lighting.
   */
  for (const [name, floor] of Object.entries(budget.facadeHue.minSeparationDeg)) {
    const opts = { topQuantile: budget.facadeHue.topQuantile };
    const a = regionHue(frames[name], R[budget.facadeHue.regions[0]], opts);
    const b = regionHue(frames[name], R[budget.facadeHue.regions[1]], opts);
    const sep = angularDistanceDeg(a.hueDeg, b.hueDeg);
    report.regions[`facadeHue:${name}`] = { a, b, sep };

    const floorFrac = budget.facadeHue.minSampledFraction;
    if (a.usedFraction < floorFrac || b.usedFraction < floorFrac) {
      fail(
        `facadeHueSample:${name}`,
        `${name}: only ${(a.usedFraction * 100).toFixed(1)}%/${(b.usedFraction * 100).toFixed(1)}% of each facade band ` +
          `carried enough saturation to have a hue (need ${(floorFrac * 100).toFixed(0)}%) — ` +
          `the separation below is measured on noise`
      );
    }
    if (sep < floor) {
      fail(
        `facadeHue:${name}`,
        `${name}: sunlit and shadowed facades are ${sep.toFixed(1)}° apart in hue, under the ${floor}° floor ` +
          `(${a.hueDeg.toFixed(0)}° vs ${b.hueDeg.toFixed(0)}°)`
      );
    }
  }

  /**
   * Pools of light on the road at midnight.
   *
   * Threshold is relative to the roadway's own median, so this asks the only
   * question that matters — is the lamplight laying a pattern on the asphalt,
   * or is the street one flat wash with glowing bowls hanging over it.
   */
  {
    const name = budget.groundPools.at;
    const p = countGroundLightPools(frames[name], R[budget.groundPools.region], budget.groundPools);
    report.regions.pools = p;
    if (p.clusters < budget.groundPools.minCount) {
      fail(
        'groundPools',
        `${name}: ${p.clusters} distinct bright regions on the roadway, need ${budget.groundPools.minCount} — ` +
          `the streetlights are not laying light on the asphalt`
      );
    }
  }

  /**
   * Wet variants.
   *
   * Water is a roughness change, so the honest test is whether the surface's
   * specular response gained a *range*: mirror where it has pooled, damp matte
   * where it has not. A uniform gloss over the whole road is the same failure
   * as a uniform matte, one value everywhere, and would pass any test that only
   * looked at the mean.
   */
  for (const name of names) {
    const wet = wetFrames[name];
    if (!wet) {
      fail(`wetMissing:${name}`, `${name}: no wet variant was captured`);
      continue;
    }
    const dryS = regionStats(frames[name], R[budget.wetness.region]);
    const wetS = regionStats(wet, R[budget.wetness.region]);
    const msd = meanSquaredDifference(frames[name], wet);
    report.wet[name] = { dry: dryS.spread, wet: wetS.spread, msd };

    if (wetS.spread < budget.wetness.minRoadSpread) {
      fail(
        `wetSpread:${name}`,
        `${name} wet: road specular spread ${wetS.spread.toFixed(4)} under the ${budget.wetness.minRoadSpread} floor — ` +
          `one roughness everywhere`
      );
    }
    if (wetS.spread < dryS.spread * budget.wetness.minSpreadOverDry) {
      fail(
        `wetOverDry:${name}`,
        `${name} wet: road spread ${wetS.spread.toFixed(4)} is only ${(wetS.spread / Math.max(dryS.spread, 1e-6)).toFixed(2)}× ` +
          `the dry ${dryS.spread.toFixed(4)} (need ${budget.wetness.minSpreadOverDry}×)`
      );
    }
    if (msd < budget.wetness.minDryWetMSD) {
      fail(
        `wetDistinct:${name}`,
        `${name}: the wet frame differs from the dry one by only ${msd.toFixed(5)} MSD ` +
          `(min ${budget.wetness.minDryWetMSD}) — wetness is close to a no-op`
      );
    }
  }

  // ---- session 3 -----------------------------------------------------------

  /**
   * Reflections of the emitters, in the wet road under them.
   *
   * The three bars are in lookmetrics.countReflectionStreaks and the reasoning
   * for each is there. What matters here is that they are conjunctive: one
   * component has to be large, tall and elongated at the same time, so neither
   * a round pool of lamplight nor a scatter of sub-pixel specular spikes can
   * satisfy this by being numerous.
   */
  {
    const S = budget.ssrReflections;
    const frame = S.wet ? wetFrames[S.at] : frames[S.at];
    if (!frame) {
      fail('ssrFrameMissing', `${S.at}${S.wet ? ' wet' : ''}: no frame captured for the reflection assertion`);
    } else {
      const r = countReflectionStreaks(frame, R[S.region], S);
      report.reflections = r;
      if (r.streaks < S.minCount) {
        fail(
          'ssrReflections',
          `${S.at}${S.wet ? ' wet' : ''}: ${r.streaks} elongated reflections on the near road, need ${S.minCount} ` +
            `(${r.components} bright components in the region, ${r.rejected} of them large enough but round or short; ` +
            `tallest kept spans ${(r.tallestFrac * 100).toFixed(1)}% of the frame, floor ${(S.minVerticalFrac * 100).toFixed(1)}%)`
        );
      }
    }
  }

  /**
   * Facades that differ as materials rather than as window patterns.
   *
   * Measured at dusk with no direct sun on anything, so the five walls are
   * under one illumination and the only thing left to separate them is what
   * they are made of. See the budget's comment for why that choice is the
   * whole gate.
   */
  {
    const F = budget.facadeVariation;
    const frame = frames[F.at];
    const patches = {};
    let sampled = true;
    for (const name of F.patches) {
      const p = wallPatch(frame, R[name], F);
      patches[name] = p;
      if (p.spread > F.maxPatchSpread) {
        sampled = false;
        fail(
          `facadePatchSample:${name}`,
          `${F.at}: patch '${name}' spans ${p.spread.toFixed(2)} of its own median between the ` +
            `${F.wallLow} and ${F.wallHigh} quantiles (max ${F.maxPatchSpread}) — it is not sitting on one wall, ` +
            `so the colour measured from it is a blend of surfaces`
        );
      }
    }
    const order = F.patches;
    const features = order.map((n) => patchFeature(patches[n], F.chromaWeight));
    const cl = clusterCount(features, F.albedoSeparation);
    report.facade = { patches, clusters: cl, neighbours: {} };

    if (!sampled) {
      cannotRun('facadeAlbedo', 'facadePatchSample failed — at least one wall rect is not on one wall');
      cannotRun('facadeNeighbours', 'facadePatchSample failed — at least one wall rect is not on one wall');
    }
    if (sampled && cl.clusters < F.minAlbedoClusters) {
      fail(
        'facadeAlbedo',
        `${F.at}: the ${order.length} visible walls fall into ${cl.clusters} distinct albedo cluster(s), ` +
          `need ${F.minAlbedoClusters} — the block is one material with windows drawn on it ` +
          `(closest pair ${cl.closest.toFixed(3)}, separation ${F.albedoSeparation})`
      );
    }

    let distinctPairs = 0;
    for (const [a, b] of F.neighbours) {
      const d = featureDistance(
        patchFeature(patches[a], F.chromaWeight),
        patchFeature(patches[b], F.chromaWeight)
      );
      report.facade.neighbours[`${a}|${b}`] = d;
      if (d >= F.minNeighbourDelta) distinctPairs++;
    }
    if (sampled && distinctPairs < F.neighbours.length) {
      fail(
        'facadeNeighbours',
        `${F.at}: ${distinctPairs} of ${F.neighbours.length} adjacent building pairs differ by ` +
          `${F.minNeighbourDelta} or more — where they meet, the two walls are the same wall ` +
          `(${Object.entries(report.facade.neighbours).map(([k, v]) => `${k} ${v.toFixed(3)}`).join(', ')})`
      );
    }

    /**
     * THE SAME QUESTION, TWO BLOCKS FURTHER OUT.
     *
     * Everything above samples the origin block, 30 to 100 m from the camera —
     * inside every residency ring the renderer has and inside the distance at
     * which the aerosol haze does anything. It can therefore be green on a
     * frame whose entire mid-distance is one grey, which is what session 4
     * delivered and what nothing measured. These two patches are on the
     * streamed city at 378 m and 542 m; see look-budget.json regions.$midWalls
     * for how they were derived and why there are two of them.
     *
     * Reported whether it passes or fails, and with the retained fraction
     * spelled out — the delivered separation next to the separation the two
     * materials would have with no atmosphere between them, which is the pair
     * of numbers that says how much of the city's material survives the trip.
     */
    {
      const M = budget.midDistanceVariation;
      const mid = frames[M.at];
      const mps = {};
      let midSampled = true;
      for (const name of M.patches) {
        const p = wallPatch(mid, R[name], M);
        mps[name] = p;
        if (!p.used || p.spread > M.maxPatchSpread) {
          midSampled = false;
          fail(
            `midPatchSample:${name}`,
            `${M.at}: mid-distance patch '${name}' spans ${p.spread.toFixed(2)} of its own median ` +
              `(max ${M.maxPatchSpread}) over ${p.used} of ${p.total} px — it is not sitting on one wall, ` +
              `so nothing downstream of it can be trusted`
          );
        }
      }
      const midFeatures = M.patches.map((n) => patchFeature(mps[n], M.chromaWeight));
      const midCl = clusterCount(midFeatures, M.albedoSeparation);
      report.midFacade = { patches: mps, clusters: midCl, sampled: midSampled };

      if (!midSampled) {
        cannotRun('midAlbedoClusters', 'midPatchSample failed — a mid-distance rect is not on one wall');
        cannotRun('midAlbedoSeparation', 'midPatchSample failed — a mid-distance rect is not on one wall');
      }
      if (midSampled && midCl.clusters < M.minAlbedoClusters) {
        fail(
          'midAlbedoClusters',
          `${M.at}: the ${M.patches.length} mid-distance walls fall into ${midCl.clusters} distinct albedo ` +
            `cluster(s), need ${M.minAlbedoClusters} — past the near band the city is one material ` +
            `(closest pair ${midCl.closest.toFixed(3)}, separation ${M.albedoSeparation})`
        );
      }
      if (midSampled && midCl.closest < M.minClosest) {
        fail(
          'midAlbedoSeparation',
          `${M.at}: the closest pair of mid-distance walls is ${midCl.closest.toFixed(3)} apart, ` +
            `floor ${M.minClosest} — the atmosphere and the rings between here and there are eating ` +
            `the material difference faster than the geometry is shrinking it`
        );
      }
    }

    /**
     * Roughness, from the buffer the renderer binds rather than from pixels.
     * A still frame cannot separate a rough dark wall from a smooth dark wall;
     * this reads the per-instance roughness attribute off the live mesh.
     */
    const variation = infoAt[F.at] && infoAt[F.at].block && infoAt[F.at].block.variation;
    if (!variation || !Array.isArray(variation.roughness)) {
      fail(
        'facadeRoughness',
        `${F.at}: harness.info().block.variation.roughness is missing — nothing reports what roughness ` +
          `the facades are actually drawn with`
      );
    } else {
      const rc = clusterCount(variation.roughness.map((v) => [v]), F.roughnessSeparation);
      report.facade.roughness = { values: variation.roughness, clusters: rc };
      if (rc.clusters < F.minRoughnessClusters) {
        fail(
          'facadeRoughness',
          `${F.at}: ${rc.clusters} distinct facade roughness value(s) in the block, need ${F.minRoughnessClusters} ` +
            `— one finish everywhere (${variation.roughness.map((v) => v.toFixed(2)).join(', ')})`
        );
      }
    }
  }

  /**
   * Structure, not colour.
   *
   * Read from the generator's own decisions because that is what they are: a
   * screenshot of a floor height is a screenshot of the camera as well. Each is
   * a count of distinct values under single linkage, so a block whose ten
   * buildings differ in the third decimal counts as one value, which is what it
   * looks like.
   */
  {
    const V = budget.structuralVariation;
    const variation = infoAt[V.at] && infoAt[V.at].block && infoAt[V.at].block.variation;
    if (!variation) {
      fail(
        'structureMissing',
        `${V.at}: harness.info().block.variation is missing — the block reports no era, floor height, ` +
          `rhythm, ground floor or cornice for any building`
      );
    } else {
      report.structure = {};
      const distinctSet = (arr) => new Set(arr).size;

      const checks = [
        {
          key: 'structureEras',
          got: distinctSet(variation.eras || []),
          need: V.minEras,
          what: 'eras',
          detail: () => (variation.eras || []).join(','),
        },
        {
          key: 'structureRhythms',
          got: distinctSet(variation.rhythms || []),
          need: V.minWindowRhythms,
          what: 'window rhythms',
          detail: () => (variation.rhythms || []).join(','),
        },
        {
          key: 'structureGroundFloors',
          got: distinctSet(variation.groundFloors || []),
          need: V.minGroundFloorKinds,
          what: 'ground-floor treatments',
          detail: () => (variation.groundFloors || []).join(','),
        },
      ];
      for (const c of checks) {
        report.structure[c.what] = c.got;
        if (c.got < c.need) {
          fail(c.key, `${V.at}: ${c.got} distinct ${c.what} across the block, need ${c.need} (${c.detail()})`);
        }
      }

      const numeric = [
        {
          key: 'structureFloorHeights',
          values: variation.floorHeights,
          sep: V.floorHeightSeparation,
          need: V.minFloorHeights,
          what: 'floor heights',
          unit: ' m',
        },
        {
          key: 'structureCornices',
          values: variation.corniceDepths,
          sep: V.corniceDepthSeparation,
          need: V.minCorniceDepths,
          what: 'cornice depths',
          unit: ' m',
        },
        {
          key: 'structureWindowWall',
          values: variation.windowWallRatios,
          sep: V.windowWallSeparation,
          need: V.minWindowWallRatios,
          what: 'window-to-wall ratios',
          unit: '',
        },
      ];
      for (const c of numeric) {
        if (!Array.isArray(c.values) || !c.values.length) {
          fail(c.key, `${V.at}: the block reports no ${c.what}`);
          continue;
        }
        const cl = clusterCount(c.values.map((v) => [v]), c.sep);
        report.structure[c.what] = cl.clusters;
        if (cl.clusters < c.need) {
          fail(
            c.key,
            `${V.at}: ${cl.clusters} distinct ${c.what} across the block, need ${c.need} at ${c.sep}${c.unit} apart ` +
              `(${c.values.map((v) => v.toFixed(2)).join(', ')})`
          );
        }
      }
    }
  }

  return { failures, report, suppressed };
}
