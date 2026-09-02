#!/usr/bin/env node
/**
 * seamprobe.mjs — HOW WIDE IS THE LINE WHERE THE SEA STOPS BEING BROWN.
 * NOT A GATE, and it must never become one. SESSION 70.
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   node tools/seamprobe.mjs --preset=sea-edge
 *   node tools/seamprobe.mjs --preset=sea-road --png=tools/shot-out/sea-road-x-t0_42-wet.png
 *   node tools/seamprobe.mjs --preset=sea-edge --cols=13 --json=out.json
 *
 * WHY IT EXISTS. The operator's two frames show a HARD LINE where blue becomes
 * brown — straight across the water in the quay frame, and asymmetric in the
 * estuary one, brown on the right of the mouth and blue on the left. Session
 * 68's mechanism is not in question and is not reopened: `gNoctisSeaOpen` is a
 * `smoothstep` on `span`, the pixel's own footprint on the water, and the same
 * two numbers gate the roughness cutoff because the lobe going wide and the
 * fill going wrong are one event. THE QUESTION THIS ANSWERS IS HOW WIDE THAT
 * TRANSITION IS ON SCREEN, which is a different question from how wide it is in
 * `span` — and a cutoff that is gentle in `span` is sharp in PIXELS wherever
 * the footprint changes quickly, which is exactly at the grazing angles the sea
 * is seen from the city at.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IT COMPUTES THE SHADER'S OWN ARITHMETIC, FROM THE SHADER'S OWN CONSTANTS.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `span` and `gNoctisSeaOpen` are read off `WATER` and `waterWaves()` in
 * `src/core/constants.js` — the same objects `lights.js` emits its GLSL from —
 * so the two cannot drift into two thresholds with one name (CONTRACT §9.1).
 * What is reproduced here, and it is four lines of the fragment shader:
 *
 *     dpx  = dFdx(worldPos.xz)                     the pixel's footprint, as two
 *     dpy  = dFdy(worldPos.xz)                     world-space edge vectors
 *     span = max over the three wave components of |d_i . dpx| + |d_i . dpy|
 *     open = smoothstep(cutoffLo . lambdaMax, cutoffHi . lambdaMax, span)
 *
 * AND `span` IS DIRECTIONAL, WHICH IS THE PART NOBODY HAD SAID OUT LOUD. It is
 * not the pixel's footprint; it is the pixel's extent ALONG A WAVE'S OWN
 * DIRECTION OF TRAVEL, maxed over the three components — `lights.js` says so in
 * as many words and gives the reason (a plane wave is constant perpendicular to
 * its direction, so only the reach along it averages the wave away). The three
 * bearings span 61 degrees, so the same water at the same distance and the same
 * grazing angle reads a `span` that differs by up to 1/0.56 = 1.79x depending
 * on which way the camera is looking. That factor is most of a `smoothstep`
 * window 2.5x wide, and it is the first thing to test an asymmetry against.
 *
 * WHAT IS ASSUMED, SAID RATHER THAN BURIED. The water is the flat plane
 * `SEA.levelY` — the waves are a NORMAL, not a displacement, so the geometry
 * really is flat — and the prediction is for an unobstructed view of it. A
 * column whose water is behind a quay wall or a hill will not have the seam the
 * prediction puts there, which is why `--png` exists: the frame is the check on
 * the prediction and not the other way round.
 *
 * THE FRAME SIDE. With `--png` it also measures, on the delivered pixels, where
 * the hue leaves the ground-fill band and reaches the sea band, using
 * `lookmetrics.hueSat` — `lookcheck`'s own hue, imported rather than restated.
 * Two independent locations of one edge, printed side by side.
 *
 * ASSERTS NOTHING AND MUST NOT. `framebytes.mjs`'s rule and `lookdiff.mjs`'s
 * before it: a transition width is a fact about the world and the verdict about
 * whether it is too sharp belongs to a person looking at a frame.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { WATER, waterWaves } from '../src/core/constants.js';
import { SEA } from '../src/lib/citygen.js';
import { POSES } from './lib/poses.mjs';
import { decodePNG } from './lib/png.mjs';
import { hueSat } from './lib/lookmetrics.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const args = new Map(
  process.argv.slice(2).map((a) => {
    const s = a.replace(/^--/, '');
    const i = s.indexOf('=');
    return i < 0 ? [s, 'true'] : [s.slice(0, i), s.slice(i + 1)];
  })
);
const num = (s) => s.split(',').map(Number);

const W = Number(args.get('w') || 1440);
const H = Number(args.get('h') || 810);
const COLS = Number(args.get('cols') || 9);

/**
 * THE POSE COMES FROM `tools/lib/poses.mjs`, WHICH IS `lookat.mjs`'S OWN TABLE.
 * Not a second derivation of one camera — see that file's opening.
 */
let shot;
if (args.has('pos')) {
  shot = {
    name: args.get('name') || 'custom',
    pos: num(args.get('pos')),
    target: num(args.get('target') || '0,10,0'),
    fov: Number(args.get('fov') || 55),
  };
} else {
  const name = args.get('preset') || 'sea-edge';
  if (!POSES[name]) {
    console.error(`seamprobe: no preset '${name}'. Have: ${Object.keys(POSES).join(', ')}`);
    process.exit(2);
  }
  shot = { name, ...POSES[name] };
}
if (args.has('fov')) shot.fov = Number(args.get('fov'));

// ── the shader's constants, read and not restated ──────────────────────────
const WAVES = waterWaves();
const LAMBDA_MAX = Math.max(...WATER.wavelengths);
const EDGE_LO = WATER.cutoffLo * LAMBDA_MAX;
const EDGE_HI = WATER.cutoffHi * LAMBDA_MAX;
const DIRS = WAVES.waves.map((w) => w.dir);

const smoothstep = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// ── the camera, built the way three builds it ──────────────────────────────
// `setShotAt` does `cam.up.set(0,1,0); cam.lookAt(target)`, and `fov` is
// VERTICAL degrees with `aspect = width / height` (src/main.js:326, :337).
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

const eye = shot.pos;
const fwd = norm(sub(shot.target, eye));
const right = norm(cross(fwd, [0, 1, 0]));
const up = cross(right, fwd);
const aspect = W / H;
const tanHalfY = Math.tan(((shot.fov * 0.5) * Math.PI) / 180);

/** The world point this pixel centre sees on the water plane, or null. */
function waterAt(px, py) {
  const ndcX = ((px + 0.5) / W) * 2 - 1;
  const ndcY = 1 - ((py + 0.5) / H) * 2;
  const dx = ndcX * tanHalfY * aspect;
  const dy = ndcY * tanHalfY;
  const d = [
    fwd[0] + right[0] * dx + up[0] * dy,
    fwd[1] + right[1] * dx + up[1] * dy,
    fwd[2] + right[2] * dx + up[2] * dy,
  ];
  // Down through the plane only. A ray at or above the horizon never meets it.
  if (d[1] >= -1e-9) return null;
  const t = (SEA.levelY - eye[1]) / d[1];
  if (!(t > 0)) return null;
  return { x: eye[0] + d[0] * t, z: eye[2] + d[2] * t, t, dy: d[1] / Math.hypot(d[0], d[1], d[2]) };
}

/**
 * `span` and the open-sea share at one pixel, by forward difference — which is
 * what a GPU's `dFdx`/`dFdy` are over a 2x2 quad.
 *
 * At 1440x810 with `deviceScaleFactor: 1` the internal buffer IS the screenshot:
 * `RENDER.neverExceedNative` clamps `internalSize` to the drawing buffer, and
 * 1440x810 is under 2560x1440. So one pixel here is one shaded pixel there and
 * the derivative needs no rescaling. At any other viewport it would.
 */
function spanAt(px, py) {
  const p = waterAt(px, py);
  if (!p) return null;
  const px1 = waterAt(px + 1, py);
  const py1 = waterAt(px, py + 1);
  if (!px1 || !py1) return null;
  const dpx = [px1.x - p.x, px1.z - p.z];
  const dpy = [py1.x - p.x, py1.z - p.z];
  let span = 0;
  let which = 0;
  for (let i = 0; i < DIRS.length; i++) {
    const d = DIRS[i];
    const along = Math.abs(d[0] * dpx[0] + d[1] * dpx[1]) + Math.abs(d[0] * dpy[0] + d[1] * dpy[1]);
    if (along > span) { span = along; which = i; }
  }
  return {
    ...p,
    span,
    which,
    open: smoothstep(EDGE_LO, EDGE_HI, span),
    dist: Math.hypot(p.x - eye[0], SEA.levelY - eye[1], p.z - eye[2]),
  };
}

/**
 * Where a column crosses a given share, to sub-pixel precision by linear
 * interpolation between the two rows that straddle it. Scanned from the BOTTOM
 * of the frame upward: the near water is at the bottom and `span` grows toward
 * the horizon, so `open` is monotonically increasing as the row index falls.
 */
function crossingRow(px, level) {
  let prev = null;
  for (let py = H - 1; py >= 0; py--) {
    const s = spanAt(px, py);
    if (!s) { prev = null; continue; }
    if (prev && prev.open < level && s.open >= level) {
      const f = (level - prev.open) / (s.open - prev.open);
      return { row: prev.py + (py - prev.py) * f, world: s, prevWorld: prev.s };
    }
    prev = { py, open: s.open, s };
  }
  return null;
}

const columns = [];
for (let c = 0; c < COLS; c++) {
  const px = Math.round(((c + 0.5) / COLS) * (W - 1));
  const lo = crossingRow(px, 0.05);
  const mid = crossingRow(px, 0.5);
  const hi = crossingRow(px, 0.95);
  const entry = { px, lo: null, mid: null, hi: null };
  if (lo && hi && mid) {
    const pLo = spanAt(px, Math.round(lo.row));
    const pHi = spanAt(px, Math.round(hi.row));
    entry.lo = lo.row;
    entry.mid = mid.row;
    entry.hi = hi.row;
    entry.widthPx = lo.row - hi.row;
    entry.distLo = pLo ? pLo.dist : null;
    entry.distHi = pHi ? pHi.dist : null;
    entry.widthM = pLo && pHi ? Math.hypot(pLo.x - pHi.x, pLo.z - pHi.z) : null;
    entry.grazeDeg = pLo ? (Math.asin(Math.abs(pLo.dy)) * 180) / Math.PI : null;
    entry.which = pLo ? pLo.which : null;
    /**
     * The directional factor on its own, so the asymmetry can be attributed or
     * not: `span` divided by what it would have been for an isotropic footprint
     * of the same two edge vectors. 1.00 means the view runs along a wave; the
     * floor is 0.56 and it is 90 degrees off all three.
     */
    if (pLo) {
      const iso = Math.hypot(pLo.dist, 0); // placeholder, replaced below
      entry.iso = iso;
    }
  }
  columns.push(entry);
}

/**
 * THE DIRECTIONAL FACTOR, COMPUTED PROPERLY: the ratio of the maximum `along`
 * to the LARGEST EDGE VECTOR of the same pixel. An anti-aliasing footprint
 * would use that largest edge; `span` uses the reach along a wave. The ratio is
 * therefore exactly the part of `span` that depends on which way the camera is
 * pointing rather than on how far away the water is.
 */
function directional(px, py) {
  const p = waterAt(px, py);
  const px1 = waterAt(px + 1, py);
  const py1 = waterAt(px, py + 1);
  if (!p || !px1 || !py1) return null;
  const dpx = [px1.x - p.x, px1.z - p.z];
  const dpy = [py1.x - p.x, py1.z - p.z];
  const isoLen = Math.hypot(dpx[0], dpx[1]) + Math.hypot(dpy[0], dpy[1]);
  let span = 0;
  for (const d of DIRS) {
    span = Math.max(span, Math.abs(d[0] * dpx[0] + d[1] * dpx[1]) + Math.abs(d[0] * dpy[0] + d[1] * dpy[1]));
  }
  return { ratio: span / Math.max(isoLen, 1e-9), isoLen, span };
}
for (const c of columns) {
  delete c.iso;
  if (c.mid == null) continue;
  const d = directional(c.px, Math.round(c.mid));
  c.dirRatio = d ? d.ratio : null;
}

// ── the frame's own answer, if one was given ───────────────────────────────
/**
 * THE SEA BAND AND THE GROUND-FILL BAND ARE READ OFF LOOK.md §0.1's OWN TABLE,
 * which is session 68's measurement and not a fresh choice: hue 30-31 before
 * the term and 234-250 after it, over open-sea rows. So a pixel counts as
 * FILLED at hue below 70 and as SEA at hue between 200 and 280, saturation
 * over 0.04 either way, and everything else — a hull, a light, a gull, the
 * quay — is neither and votes for nothing.
 */
const FILL_HUE_MAX = 70;
const SEA_HUE = [200, 280];
const MIN_SAT = 0.04;

let observed = null;
if (args.has('png')) {
  const png = decodePNG(await readFile(args.get('png')));
  if (png.width !== W || png.height !== H) {
    console.error(
      `seamprobe: --png is ${png.width}x${png.height} and the prediction is for ${W}x${H}. ` +
      'Pass --w/--h to match, or the two are not describing the same pixels.'
    );
    process.exit(2);
  }
  observed = [];
  for (const c of columns) {
    const kinds = [];
    for (let py = 0; py < H; py++) {
      const o = (py * png.width + c.px) * png.channels;
      const { h, s } = hueSat(png.data[o], png.data[o + 1], png.data[o + 2]);
      let k = 0;
      if (s >= MIN_SAT && h <= FILL_HUE_MAX) k = -1;
      else if (s >= MIN_SAT && h >= SEA_HUE[0] && h <= SEA_HUE[1]) k = 1;
      kinds.push(k);
    }
    // The lowest row that is SEA above a run of FILL: the edge as the eye sees
    // it. Scanned upward for the same reason the prediction is.
    let lastFill = null;
    let firstSea = null;
    for (let py = H - 1; py >= 0; py--) {
      if (kinds[py] === -1 && firstSea === null) lastFill = py;
      if (kinds[py] === 1 && lastFill !== null) { firstSea = py; break; }
    }
    const fill = kinds.filter((k) => k === -1).length;
    const sea = kinds.filter((k) => k === 1).length;
    observed.push({ px: c.px, lastFill, firstSea, gapPx: lastFill !== null && firstSea !== null ? lastFill - firstSea : null, fill, sea });
  }
}

// ── report ─────────────────────────────────────────────────────────────────
const f = (n, d = 1) => (n == null || !Number.isFinite(n) ? '     —' : n.toFixed(d).padStart(6));
console.log(`\nseamprobe  ${shot.name}  ${W}x${H}  fov ${shot.fov}`);
console.log(
  `  eye  [${eye.map((v) => v.toFixed(1)).join(', ')}]  ->  [${shot.target.map((v) => v.toFixed(1)).join(', ')}]`
);
console.log(
  `  gate  gNoctisSeaOpen = smoothstep(${EDGE_LO.toFixed(3)}, ${EDGE_HI.toFixed(3)}, span)   ` +
  `window ${(EDGE_HI - EDGE_LO).toFixed(3)} m/px, ratio ${(EDGE_HI / EDGE_LO).toFixed(2)}x`
);
console.log(
  `  waves  ${WATER.wavelengths.map((l, i) => `${l} m @ ${(WATER.windBearingDeg + WATER.spreadDeg[i]).toFixed(0)}deg`).join(',  ')}`
);
console.log('');
console.log('  col     row@.05  row@.50  row@.95   width px   width m    dist@.05   dist@.95  graze deg  dir  comp');
for (const c of columns) {
  console.log(
    `  ${String(c.px).padStart(4)}   ${f(c.lo)}   ${f(c.mid)}   ${f(c.hi)}   ` +
    `${f(c.widthPx)}   ${f(c.widthM, 0)}   ${f(c.distLo, 0)}   ${f(c.distHi, 0)}   ` +
    `${f(c.grazeDeg, 2)}  ${f(c.dirRatio, 2)}  ${c.which == null ? ' —' : `${WATER.wavelengths[c.which]}m`}`
  );
}

if (observed) {
  console.log(`\n  THE FRAME'S OWN EDGE — ${path.relative(ROOT, args.get('png'))}`);
  console.log('  col    last fill row   first sea row   gap px    fill px   sea px   predicted .50');
  for (let i = 0; i < observed.length; i++) {
    const o = observed[i];
    console.log(
      `  ${String(o.px).padStart(4)}   ${f(o.lastFill, 0)}          ${f(o.firstSea, 0)}     ` +
      `${f(o.gapPx, 0)}    ${f(o.fill, 0)}   ${f(o.sea, 0)}    ${f(columns[i].mid)}`
    );
  }
}

const widths = columns.map((c) => c.widthPx).filter((v) => Number.isFinite(v));
if (widths.length) {
  widths.sort((a, b) => a - b);
  const ms = columns.map((c) => c.widthM).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  console.log(
    `\n  TRANSITION WIDTH over ${widths.length} columns:  ` +
    `${widths[0].toFixed(1)} to ${widths[widths.length - 1].toFixed(1)} px, ` +
    `median ${widths[Math.floor(widths.length / 2)].toFixed(1)} px  |  ` +
    `${ms[0].toFixed(0)} to ${ms[ms.length - 1].toFixed(0)} m, median ${ms[Math.floor(ms.length / 2)].toFixed(0)} m`
  );
  const rows = columns.map((c) => c.mid).filter((v) => Number.isFinite(v));
  console.log(
    `  THE HALF-WAY ROW runs ${Math.min(...rows).toFixed(1)} to ${Math.max(...rows).toFixed(1)} ` +
    `across the frame — a spread of ${(Math.max(...rows) - Math.min(...rows)).toFixed(1)} px.`
  );
  const dr = columns.map((c) => c.dirRatio).filter((v) => Number.isFinite(v));
  if (dr.length) {
    console.log(
      `  THE DIRECTIONAL FACTOR runs ${Math.min(...dr).toFixed(3)} to ${Math.max(...dr).toFixed(3)} ` +
      `(${(Math.max(...dr) / Math.min(...dr)).toFixed(2)}x), against a smoothstep window of ` +
      `${(EDGE_HI / EDGE_LO).toFixed(2)}x.`
    );
  }
}

if (args.has('json')) {
  await writeFile(args.get('json'), JSON.stringify({ shot, W, H, edgeLo: EDGE_LO, edgeHi: EDGE_HI, columns, observed }, null, 2));
  console.log(`  written ${args.get('json')}`);
}
console.log('');
