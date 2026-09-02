#!/usr/bin/env node
/**
 * framebytes.mjs — HOW MUCH OF ONE FRAME IS NOT THE OTHER FRAME. NOT A GATE.
 * =========================================================================
 *
 *   node tools/framebytes.mjs A.png B.png
 *   node tools/framebytes.mjs A.png B.png C.png       (every pair, for a floor)
 *
 * WHY IT EXISTS. Session 68 measured "73 373 bytes of 3 499 200" between two
 * renders of `viaduct-under` and STATE 68 §8 item 1 turned that one number into
 * a hypothesis about the whole city. The number was produced by an
 * uncommitted one-liner, so the next session could not re-run the instrument
 * that produced it — which makes the figure a memory rather than a
 * measurement. This is that one-liner with a name.
 *
 * IT REPORTS A COUNT AND FOUR DISCRIMINATORS, AND THE DISCRIMINATORS ARE THE
 * POINT. A count alone cannot tell "the crowd moved" from "the exposure
 * moved", and STATE 68 §1c already records that `exposure.js` meters the whole
 * frame — so a difference spread over every tile is the signature of BOTH, and
 * a probe that reported only the spread would agree with whichever hypothesis
 * its reader already held (CONTRACT §7.3).
 *
 *   SIGN        the mean SIGNED delta over every byte. A gain change is
 *               one-signed almost everywhere; geometry that moved is not.
 *   MAGNITUDE   the |delta| histogram. A frame re-metered by half a stop
 *               differs by one or two levels over a huge area; a pedestrian
 *               who took another step differs by 60 levels over a small one.
 *   SHAPE       the best scalar gain g minimising ||B - g.A||^2 and the bytes
 *               that still differ after B is divided by it. If a gain explains
 *               the frame, that residual collapses. If it does not, it does
 *               not move.
 *   PLACE       the tile map, and the share of the difference in the busiest
 *               tiles. 256 tiles all touched is not the same fact as 256 tiles
 *               each carrying 1/256th of it.
 *
 * ASSERTS NOTHING AND MUST NOT — `lookdiff.mjs`'s rule, one instrument along:
 * a movement is a fact about the world and the verdict belongs to a person.
 *
 * `decodePNG` RETURNS THREE BYTES PER PIXEL for the colour type the capture
 * path writes, and the byte count in every STATE that quotes one is a byte
 * count and not a pixel count. Both are printed here so the two can never be
 * read for each other (CONTRACT §9's whole subject).
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { decodePNG } from './lib/png.mjs';

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const args = new Map(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const s = a.replace(/^--/, '');
    const i = s.indexOf('=');
    return i < 0 ? [s, 'true'] : [s.slice(0, i), s.slice(i + 1)];
  })
);
if (files.length < 2) {
  console.error('usage: node tools/framebytes.mjs A.png B.png [C.png ...] [--tiles=16] [--quiet]');
  process.exit(2);
}
const TILES = Number(args.get('tiles') || 16);
const QUIET = args.has('quiet');

const load = async (f) => {
  const img = decodePNG(await readFile(f));
  return { ...img, file: f, name: path.basename(f) };
};

/** Least squares through the origin: the single gain that best maps a onto b. */
function bestGain(a, b) {
  let num = 0;
  let den = 0;
  for (let i = 0; i < a.length; i++) {
    num += a[i] * b[i];
    den += a[i] * a[i];
  }
  return den > 0 ? num / den : 1;
}

function compare(A, B) {
  if (A.width !== B.width || A.height !== B.height || A.channels !== B.channels) {
    throw new Error(
      `not the same shape: ${A.name} is ${A.width}x${A.height}x${A.channels}, ` +
      `${B.name} is ${B.width}x${B.height}x${B.channels}`
    );
  }
  const a = A.data;
  const b = B.data;
  const n = a.length;
  const ch = A.channels;
  const W = A.width;
  const H = A.height;

  let diffBytes = 0;
  let signedSum = 0;
  let absSum = 0;
  let maxAbs = 0;
  let maxAt = -1;
  const hist = { 1: 0, 2: 0, 3: 0, '4-7': 0, '8-15': 0, '16-63': 0, '64+': 0 };
  const tiles = new Int32Array(TILES * TILES);
  const pixelSeen = new Uint8Array(Math.ceil(n / ch));

  for (let i = 0; i < n; i++) {
    const d = b[i] - a[i];
    if (d === 0) continue;
    diffBytes++;
    signedSum += d;
    const m = d < 0 ? -d : d;
    absSum += m;
    if (m > maxAbs) { maxAbs = m; maxAt = i; }
    if (m === 1) hist[1]++;
    else if (m === 2) hist[2]++;
    else if (m === 3) hist[3]++;
    else if (m < 8) hist['4-7']++;
    else if (m < 16) hist['8-15']++;
    else if (m < 64) hist['16-63']++;
    else hist['64+']++;
    const p = (i / ch) | 0;
    pixelSeen[p] = 1;
    const px = p % W;
    const py = (p / W) | 0;
    const tx = Math.min(TILES - 1, ((px * TILES) / W) | 0);
    const ty = Math.min(TILES - 1, ((py * TILES) / H) | 0);
    tiles[ty * TILES + tx]++;
  }

  let diffPixels = 0;
  for (let p = 0; p < pixelSeen.length; p++) diffPixels += pixelSeen[p];

  /**
   * THE GAIN CONTROL. `g` is the exposure hypothesis stated as a number: if the
   * whole difference is one scalar on the whole frame, dividing B by g leaves
   * nothing but rounding. The residual is counted at a tolerance of ONE level,
   * because a gain applied before an 8-bit quantisation cannot be undone
   * exactly and a residual of exactly zero is not the prediction.
   */
  const g = bestGain(a, b);
  let residual = 0;
  for (let i = 0; i < n; i++) {
    const pred = Math.round(a[i] * g);
    const d = b[i] - pred;
    if (d > 1 || d < -1) residual++;
  }

  const sorted = [...tiles].sort((x, y) => y - x);
  const touched = sorted.filter((v) => v > 0).length;
  const top16 = sorted.slice(0, 16).reduce((s, v) => s + v, 0);

  return {
    width: W, height: H, channels: ch, totalBytes: n, totalPixels: n / ch,
    diffBytes, diffPixels, signedSum, absSum, maxAbs, maxAt, hist, tiles,
    touched, top16, gain: g, residual,
  };
}

const pad = (s, w) => String(s).padStart(w);

function report(A, B, r) {
  console.log(`\n${A.name}`);
  console.log(`${B.name}`);
  console.log(
    `  ${r.width}x${r.height}x${r.channels}   ` +
    `${r.totalPixels.toLocaleString('en-US')} px   ${r.totalBytes.toLocaleString('en-US')} bytes`
  );
  console.log(
    `  DIFFERING   ${pad(r.diffBytes.toLocaleString('en-US'), 12)} bytes  ` +
    `(${((100 * r.diffBytes) / r.totalBytes).toFixed(4)}%)   ` +
    `${r.diffPixels.toLocaleString('en-US')} px`
  );
  if (r.diffBytes === 0) {
    console.log('  IDENTICAL TO EVERY BYTE.');
    return;
  }
  const meanSigned = r.signedSum / r.totalBytes;
  const meanAbsOnDiff = r.absSum / r.diffBytes;
  console.log(
    `  SIGN        mean signed delta over ALL bytes ${meanSigned.toExponential(3)}   ` +
    `over differing bytes ${(r.signedSum / r.diffBytes).toFixed(3)}`
  );
  console.log(
    `  MAGNITUDE   mean |delta| on differing bytes ${meanAbsOnDiff.toFixed(3)}   ` +
    `max ${r.maxAbs} at byte ${r.maxAt}`
  );
  const h = r.hist;
  console.log(
    `              |d|=1 ${pad(h[1], 9)}   =2 ${pad(h[2], 8)}   =3 ${pad(h[3], 8)}   ` +
    `4-7 ${pad(h['4-7'], 8)}   8-15 ${pad(h['8-15'], 8)}   16-63 ${pad(h['16-63'], 8)}   ` +
    `64+ ${pad(h['64+'], 8)}`
  );
  console.log(
    `  SHAPE       best scalar gain ${r.gain.toFixed(9)}   ` +
    `bytes still differing by >1 level after it: ${r.residual.toLocaleString('en-US')}   ` +
    `(${((100 * r.residual) / Math.max(1, r.diffBytes)).toFixed(1)}% of the difference)`
  );
  console.log(
    `  PLACE       ${r.touched} of ${TILES * TILES} tiles touched   ` +
    `busiest 16 tiles carry ${((100 * r.top16) / r.diffBytes).toFixed(1)}% of it`
  );
  if (!QUIET) {
    console.log(`  the ${TILES}x${TILES} tile map, differing bytes per tile:`);
    for (let ty = 0; ty < TILES; ty++) {
      const row = [];
      for (let tx = 0; tx < TILES; tx++) row.push(pad(r.tiles[ty * TILES + tx], 7));
      console.log(`    ${row.join('')}`);
    }
  }
}

const imgs = [];
for (const f of files) imgs.push(await load(f));

for (let i = 0; i < imgs.length; i++) {
  for (let j = i + 1; j < imgs.length; j++) {
    report(imgs[i], imgs[j], compare(imgs[i], imgs[j]));
  }
}
console.log('');
