#!/usr/bin/env node
/**
 * heightprobe.mjs — the building height distribution, both arms, through the
 * PURE GENERATOR and no browser. NOT A GATE, and it asserts nothing.
 *
 *   node tools/heightprobe.mjs
 *   node tools/heightprobe.mjs --sweep=28,30,31.4,33,35
 *
 * WHY IT EXISTS. Session 20 replaced a uniform 12–64 m height roll with a
 * log-normal, and `perfcheck` went red on `floors.visibleInstances` — 106 501
 * against 115 000. That floor is a CONTENT floor and it did exactly its job:
 * it caught a content system getting smaller. CONTRACT §0 rule 5 says the
 * answer is to put the content back, never to move the floor, and to do that
 * you have to know WHICH content and BY HOW MUCH.
 *
 * THE QUANTITY IS Σ FLOORS OVER A REGION, not the mean height, and the two are
 * not the same statistic:
 *
 *   - the window count is `rows × cols` per elevation, and `rows` is
 *     `(height − plinth) / era.floor` — so it is a sum over buildings of a
 *     CLIPPED height, with a plinth taken off each one and a 3-storey minimum
 *     underneath. A distribution with the same mean and a different shape does
 *     not deliver the same sum.
 *   - `floors = max(3, round(h / era.floor))`, so the short tail is FLOORED and
 *     the tall tail is capped by `buildFacade`'s own row limit.
 *
 * AND IT IS THE CORRECTION TO STATE 19 §9.5's ARITHMETIC. That entry proposed
 * "a log-normal at median 30 m, σ = 0.62 gives mean **36.4 against the
 * delivered 36.55**, i.e. the mean is preserved to 0.4%". Those are two
 * different quantities: 36.4 is the log-normal's mean BEFORE flooring and 36.55
 * is what the uniform delivered AFTER it. The like-for-like comparison is
 * pre-floor against pre-floor — uniform 12–64 has mean 38.00 — so median 30
 * was 4.3% SHORT of preserving it before any of the flooring is considered.
 * CONTRACT §9's shape with two means, and the gate that caught it was a content
 * floor rather than a reader.
 */

import { fileURLToPath } from 'node:url';
import {
  CITY, generateChunk, chunkBounds, HEIGHT_DISTRIBUTION, buildingTiers,
} from '../src/lib/citygen.js';

const args = new Map(process.argv.slice(2).map((a) => {
  const [k, v = 'true'] = a.replace(/^--/, '').split('=');
  return [k, v];
}));

/** The same region `citycheck` reports over: a 10 × 10 chunk block. */
const R = Number(args.get('radius') || 5);
const SEED = args.get('seed') || '1337';

function measure() {
  let n = 0;
  let sumH = 0;
  let sumFloors = 0;
  let sumTierFacade = 0;
  let capped = 0;
  let setback = 0;
  let roofSigns = 0;
  const heights = [];
  for (let cx = -R; cx < R; cx++) {
    for (let cz = -R; cz < R; cz++) {
      const c = generateChunk(SEED, cx, cz);
      for (const b of c.buildings) {
        n++;
        sumH += b.height;
        sumFloors += b.floors;
        heights.push(b.height);
        if (b.setbacks) setback++;
        if (b.floors > 34) capped++;
        /**
         * THE FACADE AREA A TIERED BUILDING ACTUALLY PRESENTS, which is what a
         * window count is proportional to and which the mean height is not:
         * each tier contributes its own perimeter times its own height, and a
         * setback takes both down together.
         */
        for (const t of buildingTiers(b)) {
          sumTierFacade += 2 * (t.width + t.depth) * (t.y1 - t.y0);
        }
      }
      for (const s of c.signs) if (s.mount === 'rooftop') roofSigns++;
    }
  }
  heights.sort((a, b) => a - b);
  const q = (p) => heights[Math.min(heights.length - 1, Math.floor(p * heights.length))];
  return {
    n,
    meanH: sumH / n,
    medianH: q(0.5),
    p90: q(0.9),
    p99: q(0.99),
    maxH: heights[heights.length - 1],
    sdOverMean: Math.sqrt(heights.reduce((a, h) => a + (h - sumH / n) ** 2, 0) / n) / (sumH / n),
    sumFloors,
    facadeM2: sumTierFacade,
    capped,
    setback,
    roofSigns,
  };
}

const row = (label, m, ref) => {
  const rel = (v, r) => (ref ? `  ${((v / r - 1) * 100 >= 0 ? '+' : '')}${((v / r - 1) * 100).toFixed(1)}%` : '');
  return (
    `  ${label.padEnd(16)} n ${String(m.n).padStart(4)}   mean ${m.meanH.toFixed(2)} m` +
    `${rel(m.meanH, ref && ref.meanH)}   median ${m.medianH.toFixed(1)}   p99 ${m.p99.toFixed(0)}` +
    `   max ${m.maxH.toFixed(0)}   sd/mean ${m.sdOverMean.toFixed(3)}\n` +
    `  ${''.padEnd(16)} Σfloors ${String(m.sumFloors).padStart(6)}${rel(m.sumFloors, ref && ref.sumFloors)}` +
    `   facade ${(m.facadeM2 / 1000).toFixed(1)} km²/1000${rel(m.facadeM2, ref && ref.facadeM2)}` +
    `   >34 floors ${m.capped}   setbacks ${m.setback}   roof signs ${m.roofSigns}`
  );
};

console.log(
  `heightprobe: ${2 * R} × ${2 * R} chunks at seed ${SEED}, straight out of the pure generator.\n` +
  '  Σfloors and facade area are what the window and box counts are proportional to.\n' +
  '  The uniform arm is session 19\'s shipped band and is the reference.\n'
);

const was = HEIGHT_DISTRIBUTION.mode;
const wasMedian = HEIGHT_DISTRIBUTION.medianM;

HEIGHT_DISTRIBUTION.mode = 'uniform';
const ref = measure();
console.log(row('uniform 12–64', ref, null));

HEIGHT_DISTRIBUTION.mode = 'logNormal';
const medians = args.has('sweep')
  ? args.get('sweep').split(',').map(Number)
  : [wasMedian];
for (const m of medians) {
  HEIGHT_DISTRIBUTION.medianM = m;
  console.log(row(`lognormal ${m}`, measure(), ref));
}

HEIGHT_DISTRIBUTION.mode = was;
HEIGHT_DISTRIBUTION.medianM = wasMedian;
console.log(
  '\n  A log-normal with the same PRE-FLOOR mean does not deliver the same Σfloors: ' +
  '`floors = max(3, round(h/era.floor))` floors the short tail and `buildFacade` caps the tall\n' +
  '  one at 34 rows, and a setback removes upper-tier perimeter as well as height. ' +
  'The number to match is Σfloors, not the mean.'
);
void fileURLToPath;
