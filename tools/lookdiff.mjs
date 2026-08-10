#!/usr/bin/env node
/**
 * lookdiff.mjs — NOT A GATE. What moved between two sets of look frames, and
 * by how much.
 *
 *   node tools/lookdiff.mjs --before=/some/dir --after=tools/look-out
 *
 * WHY THIS EXISTS. Session 13 made three changes to the city that no look
 * threshold was derived against: half the windows became visible, the road
 * surface was rasterised for the first time, and 24 907 fins came off the east
 * and west elevations. `lookcheck` was green before and green after, and a gate
 * that stays green through a change that large is a gate worth being suspicious
 * of — CONTRACT §7.1 is a whole section about a check that has gone quiet being
 * indistinguishable from one that passed.
 *
 * The cheap way to be suspicious is to hold the METRIC constant and change the
 * FRAMES. Both sets are decoded and run through the same `lib/lookmetrics.mjs`
 * this session ships, so the difference is the scene and not the instrument.
 * Re-rendering the old city would compare two renderers as well as two cities.
 *
 * IT ASSERTS NOTHING AND MUST NOT. A movement is a fact about the world, not a
 * failure, and the decision about whether a threshold derived against the old
 * scene still means anything belongs to a person reading the numbers. Same rule
 * `lookat.mjs` carries: a gate whose subject the operator chooses measures the
 * operator.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { decodePNG } from './lib/png.mjs';
import {
  analyse, meanSquaredDifference, regionStats, regionHue, countGroundLightPools, angularDistanceDeg,
} from './lib/lookmetrics.mjs';
import { ROOT } from './lib/page.mjs';

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);
const BEFORE = args.get('before');
const AFTER = args.get('after') || path.join(ROOT, 'tools', 'look-out');
if (!BEFORE) {
  console.error('usage: node tools/lookdiff.mjs --before=<dir of look PNGs> [--after=<dir>]');
  process.exit(2);
}

const FRAMES = ['midnight', 'dawn', 'noon', 'dusk'];
const VARIANTS = ['', '-wet'];

const load = async (dir, name) => {
  try {
    return decodePNG(await readFile(path.join(dir, `${name}.png`)));
  } catch {
    return null;
  }
};

const pad = (s, n) => String(s).padEnd(n);
const num = (v, d = 4) => (v == null || Number.isNaN(v) ? '     —' : v.toFixed(d).padStart(d + 4));

console.log(`before: ${BEFORE}`);
console.log(`after:  ${AFTER}`);
console.log('\nPer-frame statistics, same metric code over both sets.');
console.log(
  `${pad('frame', 15)} ${pad('mean', 20)} ${pad('sd', 20)} ${pad('clipWhite %', 20)} ${pad('blackCrush %', 20)}  msd(before,after)`
);
console.log('-'.repeat(112));

const rows = [];
for (const f of FRAMES) {
  for (const v of VARIANTS) {
    const name = f + v;
    const [A, B] = await Promise.all([load(BEFORE, name), load(AFTER, name)]);
    if (!A || !B) {
      console.log(`${pad(name, 15)} MISSING in ${!A ? 'before' : 'after'}`);
      continue;
    }
    const a = analyse(A);
    const b = analyse(B);
    const msd = meanSquaredDifference(a, b);
    const cell = (x, y, d = 4) => `${num(x, d)} →${num(y, d)}`;
    console.log(
      `${pad(name, 15)} ${pad(cell(a.meanLuminance, b.meanLuminance), 20)} ${pad(cell(a.stdDev, b.stdDev), 20)} ` +
      `${pad(cell(100 * a.clippedWhite, 100 * b.clippedWhite, 3), 20)} ` +
      `${pad(cell(100 * a.crushedBlack, 100 * b.crushedBlack, 3), 20)}  ${msd.toFixed(6)}`
    );
    rows.push({ name, a, b, msd });
  }
}

/**
 * The single number a reader wants first: how far the frame moved compared with
 * how far the four times of day are apart from each other. A change smaller
 * than the smallest gap between two look frames is a change no look threshold
 * derived from those gaps can resolve — which is CONTRACT §0 rule 6 with an
 * image statistic instead of a millisecond.
 */
const dry = rows.filter((r) => !r.name.includes('-wet'));
let smallestPairwise = Infinity;
for (let i = 0; i < dry.length; i++) {
  for (let j = i + 1; j < dry.length; j++) {
    smallestPairwise = Math.min(smallestPairwise, meanSquaredDifference(dry[i].b, dry[j].b));
  }
}
const biggestMove = rows.reduce((m, r) => Math.max(m, r.msd), 0);
console.log(
  `\nlargest before→after msd  ${biggestMove.toFixed(6)}\n` +
  `smallest pairwise msd between two DIFFERENT times of day (after)  ${smallestPairwise.toFixed(6)}\n` +
  `ratio  ${(biggestMove / smallestPairwise).toFixed(3)} — under 1 means the change is smaller than the ` +
  'gap every look assertion about time of day is derived from'
);

console.log('\nMean luma in code values out of 255, which is what a person sees:');
for (const r of rows) {
  const d = (r.b.meanLuminance - r.a.meanLuminance) * 255;
  console.log(
    `  ${pad(r.name, 15)} ${(r.a.meanLuminance * 255).toFixed(2)} → ${(r.b.meanLuminance * 255).toFixed(2)}   ` +
    `${d >= 0 ? '+' : ''}${d.toFixed(2)} cv`
  );
}

/**
 * THE THREE REGION ASSERTIONS, BOTH SETS, THROUGH THE SAME CONFIGURATION.
 *
 * The whole-frame statistics above answer "did the picture change". These
 * answer the question that actually matters for a threshold: did the QUANTITY
 * THE THRESHOLD READS change. A frame can move by a fifth of a code value in
 * the mean and by four counts in the pool census, because a pool census is an
 * extreme-value statistic and the mean is not — CONTRACT §0.1 says exactly this
 * about `citycheck`'s saturation peak.
 *
 * The regions and the thresholds come out of `look-budget.json`, never out of a
 * copy here: a rect transcribed into a diagnostic is §9.1's config-the-code-
 * does-not-read with two decimal places instead of a pier spacing.
 */
const BUDGET = JSON.parse(await readFile(path.join(ROOT, 'tools', 'look-budget.json'), 'utf8'));
const byName = new Map(rows.map((r) => [r.name, r]));
/** The rects are normalised [x0,y0,x1,y1] and every metric takes them raw. */
const rectOf = (key) => BUDGET.regions[key];

console.log('\nThe assertions that read a REGION rather than the frame:');
{
  const r = byName.get(BUDGET.shadowHue.at);
  if (r) {
    const sa = regionStats(r.a, rectOf(BUDGET.shadowHue.region));
    const sb = regionStats(r.b, rectOf(BUDGET.shadowHue.region));
    console.log(
      `  shadowHue      B/R ${sa.blueOverRed.toFixed(4)} → ${sb.blueOverRed.toFixed(4)}   ` +
      `ceiling ${BUDGET.shadowHue.maxBlueOverRed}   margin ${(BUDGET.shadowHue.maxBlueOverRed - sb.blueOverRed).toFixed(4)}`
    );
  }
}
{
  const r = byName.get(BUDGET.groundPools.at);
  if (r) {
    const pa = countGroundLightPools(r.a, rectOf(BUDGET.groundPools.region), BUDGET.groundPools);
    const pb = countGroundLightPools(r.b, rectOf(BUDGET.groundPools.region), BUDGET.groundPools);
    console.log(
      `  groundPools    ${pa.clusters} → ${pb.clusters} pools   floor ${BUDGET.groundPools.minCount}   ` +
      `threshold ${pa.threshold.toFixed(4)} → ${pb.threshold.toFixed(4)} over a median of ` +
      `${pa.median.toFixed(4)} → ${pb.median.toFixed(4)}`
    );
  }
}
for (const [name, floor] of Object.entries(BUDGET.facadeHue.minSeparationDeg)) {
  const r = byName.get(name);
  if (!r) continue;
  const opts = { topQuantile: BUDGET.facadeHue.topQuantile };
  const sep = (m) => angularDistanceDeg(
    regionHue(m, rectOf(BUDGET.facadeHue.regions[0]), opts).hueDeg,
    regionHue(m, rectOf(BUDGET.facadeHue.regions[1]), opts).hueDeg
  );
  console.log(
    `  facadeHue@${name.padEnd(5)} separation ${sep(r.a).toFixed(1)}° → ${sep(r.b).toFixed(1)}°   floor ${floor}°`
  );
}
