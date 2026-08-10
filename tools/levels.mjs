#!/usr/bin/env node
/**
 * levels.mjs — the tonal distribution of a delivered frame. NOT A GATE.
 *
 *   node tools/levels.mjs tools/shot-out/*.png
 *   node tools/levels.mjs --a=before.png --b=after.png     paired, with the deltas
 *
 * WHY THIS EXISTS. `analyse()` has counted the two ENDS of the histogram since
 * session 1 — `clippedWhite` at code ≥ 254 and `crushedBlack` at ≤ 2 — and
 * `perfcheck` asserts a mean and an entropy. Not one of those four can see the
 * failure session 18's walkthrough reported: a night frame whose windows clip to
 * white while the facade two metres away is near black. Both ENDS can be inside
 * their bounds while there is nothing in the middle, and the mean of a bimodal
 * distribution sits where there are no pixels at all — `downtown_dense` delivers
 * a mean 2.01× its own median and STATE 17 §6 says so.
 *
 * So this prints the whole distribution, with the Zone III–VII textured band
 * (`lookmetrics.TONAL_BANDS`, derived from an 18% reflector ±2 stops) as the
 * "mass in the middle" the brief asks for.
 *
 * IT ASSERTS NOTHING AND IT MUST NOT. The camera is the operator's — CONTRACT §7
 * says a gate whose camera the operator chooses is measuring the operator, and
 * the frames this reads come from `lookat.mjs`, which is the same rule one file
 * over. What it is for is the before/after in a session report, and for deciding
 * whether a change moved the histogram or moved the mean past it.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { decodePNG } from './lib/png.mjs';
import { analyse, tonalHistogram, TONAL_BANDS } from './lib/lookmetrics.mjs';

const args = new Map(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);
const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const pct = (v) => `${(v * 100).toFixed(2)}%`;

async function measure(file) {
  const png = decodePNG(await readFile(file));
  const m = analyse(png);
  const h = tonalHistogram(png);
  return { file, m, h };
}

function report(r) {
  const { file, m, h } = r;
  console.log(`\n${path.basename(file)}  ${m.width}×${m.height}`);
  console.log(
    `  crushed ≤2      ${pct(h.crushedFraction).padStart(8)}` +
      `      shadow  <${h.bandEdges.lowCode.toFixed(0).padStart(3)}   ${pct(h.shadowFraction).padStart(8)}`
  );
  console.log(
    `  clipped ≥254    ${pct(h.clippedFraction).padStart(8)}` +
      `      TEXTURED ${h.bandEdges.lowCode.toFixed(0)}–${h.bandEdges.highCode.toFixed(0)}  ` +
      `${pct(h.texturedFraction).padStart(8)}   ← the number that matters`
  );
  console.log(
    `  mean  ${m.meanLuminance.toFixed(4)}   stddev ${m.stdDev.toFixed(4)}` +
      `      highlight >${h.bandEdges.highCode.toFixed(0)}  ${pct(h.highlightFraction).padStart(8)}`
  );
  console.log(
    `  quantiles (sRGB code)  p01 ${String(h.p01).padStart(3)}  p05 ${String(h.p05).padStart(3)}  ` +
      `p10 ${String(h.p10).padStart(3)}  p25 ${String(h.p25).padStart(3)}  p50 ${String(h.p50).padStart(3)}  ` +
      `p75 ${String(h.p75).padStart(3)}  p90 ${String(h.p90).padStart(3)}  p95 ${String(h.p95).padStart(3)}  ` +
      `p99 ${String(h.p99).padStart(3)}`
  );
  const median = h.p50 / 255;
  console.log(
    `  mean/median ${median > 0 ? (m.meanLuminance / median).toFixed(3) : 'n/a'}` +
      `   (>1 means the mean is being carried by a few bright things)`
  );

  // A 32-bucket sparkline over the 256 bins, log-scaled, because a night frame's
  // shadow bin is three orders of magnitude over its highlight bins and a linear
  // bar chart of it is one spike and thirty-one empty columns.
  const buckets = new Array(32).fill(0);
  for (let i = 0; i < 256; i++) buckets[i >> 3] += h.bins[i];
  const total = buckets.reduce((a, b) => a + b, 0);
  const ramp = ' ▁▂▃▄▅▆▇█';
  const bar = buckets
    .map((c) => {
      if (!c) return ' ';
      const f = c / total;
      const s = Math.min(8, Math.max(1, Math.round((Math.log10(f) + 4) * 2)));
      return ramp[s];
    })
    .join('');
  console.log(`  0 |${bar}| 255`);
}

if (!files.length && !args.has('a')) {
  console.error('usage: node tools/levels.mjs <png>... | --a=before.png --b=after.png');
  process.exit(2);
}

console.log(
  `Zone bands from an ${TONAL_BANDS.zoneVLinear} reflector ±2 stops through the sRGB OETF: ` +
    `III ${TONAL_BANDS.zoneIIILinear.toFixed(4)} lin → code ${TONAL_BANDS.lowCode.toFixed(1)}, ` +
    `V ${TONAL_BANDS.zoneVLinear} → ${TONAL_BANDS.midCode.toFixed(1)}, ` +
    `VII ${TONAL_BANDS.zoneVIILinear.toFixed(2)} → ${TONAL_BANDS.highCode.toFixed(1)}`
);

if (args.has('a') && args.has('b')) {
  const a = await measure(args.get('a'));
  const b = await measure(args.get('b'));
  report(a);
  report(b);
  const d = (k, f = (v) => pct(v)) => {
    const av = a.h[k];
    const bv = b.h[k];
    const sign = bv - av >= 0 ? '+' : '';
    return `${f(av)} → ${f(bv)}  (${sign}${((bv - av) * 100).toFixed(2)} pts)`;
  };
  console.log('\nPAIRED');
  console.log(`  textured   ${d('texturedFraction')}`);
  console.log(`  crushed    ${d('crushedFraction')}`);
  console.log(`  clipped    ${d('clippedFraction')}`);
  console.log(`  shadow     ${d('shadowFraction')}`);
  console.log(`  highlight  ${d('highlightFraction')}`);
  console.log(
    `  mean       ${a.m.meanLuminance.toFixed(4)} → ${b.m.meanLuminance.toFixed(4)}   ` +
      `median code ${a.h.p50} → ${b.h.p50}`
  );
} else {
  for (const f of files) report(await measure(f));
}
