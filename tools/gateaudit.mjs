#!/usr/bin/env node
/**
 * gateaudit.mjs — is the look gate actually a gate?
 *
 *   node tools/gateaudit.mjs
 *
 * Exit 0 = every threshold bites, 1 = at least one does not, 2 = the audit
 * could not run (usually: lookcheck has not been run, so there are no frames).
 *
 * Session 1 raised every number in look-budget.json "until it sat just under
 * what the renderer delivers". That is the right instinct and it is unverified:
 * a threshold that has never been seen to fire is a comment with a colon in it.
 * So this takes the frames lookcheck just wrote, breaks them on purpose one way
 * at a time, and requires the corresponding assertion to fail.
 *
 * Two properties make it hard to fool:
 *
 *   1. It runs the real assertion code (tools/lib/lookassert.mjs), not a copy.
 *      There is no way for the gate and the audit to drift apart.
 *   2. It enumerates every numeric knob in look-budget.json and fails if any of
 *      them has no case. Adding a threshold without an audit case is itself a
 *      red gate, so the audit cannot rot behind a growing budget file.
 *
 * It also prints headroom — measured value against threshold — because a
 * threshold can technically bite and still be three times away from anything
 * the renderer produces, and that is the state session 1 left several of them
 * in.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { decodePNG } from './lib/png.mjs';
import { analyse, rectPixels, luma8 } from './lib/lookmetrics.mjs';
import { assertLook, validateBudget } from './lib/lookassert.mjs';
import { spawnSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = path.join(ROOT, 'tools', 'look-out');
const BUDGET = JSON.parse(await readFile(path.join(ROOT, 'tools', 'look-budget.json'), 'utf8'));

const NAMES = BUDGET.times.map((t) => t.name);

// ---------------------------------------------------------------------------
// image surgery
// ---------------------------------------------------------------------------

const clone = (png) => ({ ...png, data: Buffer.from(png.data) });

function eachPixel(png, rect, fn) {
  const { ax0, ay0, ax1, ay1 } = rect ? rectPixels(png, rect) : { ax0: 0, ay0: 0, ax1: png.width, ay1: png.height };
  const { width, channels, data } = png;
  for (let y = ay0; y < ay1; y++) {
    for (let x = ax0; x < ax1; x++) {
      const o = (y * width + x) * channels;
      fn(data, o, x, y);
    }
  }
}

const clamp8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

/** Multiply every channel. Preserves hue and B/R; moves mean and stddev. */
function scale(png, k) {
  const p = clone(png);
  eachPixel(p, null, (d, o) => {
    d[o] = clamp8(d[o] * k);
    d[o + 1] = clamp8(d[o + 1] * k);
    d[o + 2] = clamp8(d[o + 2] * k);
  });
  return p;
}

/** Every pixel becomes the region's mean. Preserves mean, kills stddev. */
function flatten(png, rect = null) {
  const p = clone(png);
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  eachPixel(p, rect, (d, o) => {
    r += d[o];
    g += d[o + 1];
    b += d[o + 2];
    n++;
  });
  const m = [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  eachPixel(p, rect, (d, o) => {
    d[o] = m[0];
    d[o + 1] = m[1];
    d[o + 2] = m[2];
  });
  return p;
}

function fillRect(png, rect, rgb) {
  const p = clone(png);
  eachPixel(p, rect, (d, o) => {
    d[o] = rgb[0];
    d[o + 1] = rgb[1];
    d[o + 2] = rgb[2];
  });
  return p;
}

/** r = g = b = luma. Preserves luminance exactly, removes all chroma. */
function desaturate(png, rect = null) {
  const p = clone(png);
  eachPixel(p, rect, (d, o) => {
    const y = clamp8(luma8(d[o], d[o + 1], d[o + 2]) * 255);
    d[o] = y;
    d[o + 1] = y;
    d[o + 2] = y;
  });
  return p;
}

/** Neutralise R−B without touching luminance much. */
function neutraliseWarmth(png) {
  const p = clone(png);
  eachPixel(p, null, (d, o) => {
    const m = (d[o] + d[o + 2]) >> 1;
    d[o] = m;
    d[o + 2] = m;
  });
  return p;
}

/**
 * Replace a rect with a deterministic grid of bright blobs of a given shape.
 *
 * The reflection assertion is about *shape*, so breaking it means producing
 * bright regions that are the wrong shape rather than absent — round pools
 * where there should be streaks, or single-pixel spikes. `w` and `h` are in
 * full-resolution pixels.
 */
function blobs(png, rect, { w, h, pitchX, pitchY, rgb }) {
  const p = clone(png);
  const { ax0, ay0, ax1, ay1 } = rectPixels(p, rect);
  // Flatten first, so the region's own median is low and the blobs are what
  // stands above it.
  eachPixel(p, rect, (d, o) => {
    d[o] = 4;
    d[o + 1] = 4;
    d[o + 2] = 5;
  });
  for (let cy = ay0 + pitchY; cy < ay1 - h; cy += pitchY) {
    for (let cx = ax0 + pitchX; cx < ax1 - w; cx += pitchX) {
      for (let y = cy; y < cy + h && y < ay1; y++) {
        for (let x = cx; x < cx + w && x < ax1; x++) {
          const o = (y * p.width + x) * p.channels;
          p.data[o] = rgb[0];
          p.data[o + 1] = rgb[1];
          p.data[o + 2] = rgb[2];
        }
      }
    }
  }
  return p;
}

/** Paint a deterministic scatter of `frac` of the frame's pixels one colour. */
function speckle(png, frac, rgb) {
  const p = clone(png);
  const total = p.width * p.height;
  const stride = Math.max(1, Math.round(1 / frac));
  for (let i = 0; i < total; i += stride) {
    const o = i * p.channels;
    p.data[o] = rgb[0];
    p.data[o + 1] = rgb[1];
    p.data[o + 2] = rgb[2];
  }
  return p;
}

// ---------------------------------------------------------------------------
// load the frames lookcheck wrote
// ---------------------------------------------------------------------------

const missing = [];
for (const n of NAMES) {
  for (const f of [`${n}.png`, `${n}-wet.png`]) {
    if (!existsSync(path.join(OUT, f))) missing.push(f);
  }
}
if (missing.length) {
  console.error(
    `gateaudit: tools/look-out/ is missing ${missing.join(', ')} — run \`npm run lookcheck\` first.\n` +
      `The audit measures the frames the gate actually produced; there is no synthetic substitute.`
  );
  process.exit(2);
}

const dryPNG = {};
const wetPNG = {};
for (const n of NAMES) {
  dryPNG[n] = decodePNG(await readFile(path.join(OUT, `${n}.png`)));
  wetPNG[n] = decodePNG(await readFile(path.join(OUT, `${n}-wet.png`)));
}

/**
 * The harness state lookcheck recorded alongside the frames. Session 3's
 * structural assertions read it, and the audit breaks it the same way it breaks
 * a pixel. Fabricating it here would mean the audit and the gate disagreed
 * about what the block contains.
 */
if (!existsSync(path.join(OUT, 'capture.json'))) {
  console.error(
    `gateaudit: tools/look-out/capture.json is missing — run \`npm run lookcheck\` first.\n` +
      `It records what the harness reported at each capture, which is what the structural assertions measure.`
  );
  process.exit(2);
}
const CAPTURE = JSON.parse(await readFile(path.join(OUT, 'capture.json'), 'utf8'));

/** analyse() is the expensive step; cache it per identical buffer. */
const analysisCache = new Map();
function A(png) {
  if (!analysisCache.has(png)) analysisCache.set(png, analyse(png));
  return analysisCache.get(png);
}

function baseInput() {
  const frames = {};
  const wetFrames = {};
  const infoAt = {};
  for (const n of NAMES) {
    frames[n] = A(dryPNG[n]);
    wetFrames[n] = A(wetPNG[n]);
    const captured = CAPTURE.infoAt[n] || {};
    infoAt[n] = {
      faults: 0,
      clusterOverflow: false,
      photocellOn: BUDGET.photocell.onAt.includes(n),
      // Deep-copied so a case that mutates it cannot leak into the next case.
      block: captured.block ? JSON.parse(JSON.stringify(captured.block)) : undefined,
    };
  }
  return { budget: BUDGET, frames, wetFrames, infoAt, consoleErrors: [], pageErrors: [] };
}

// ---------------------------------------------------------------------------
// the cases
// ---------------------------------------------------------------------------

const R = BUDGET.regions;

/**
 * Each case names the budget knobs it exercises and the assertion key it must
 * provoke. A case may provoke more than one failure — breaking a frame rarely
 * breaks exactly one thing — and only the named key is required.
 */
const CASES = [
  // --- luminance bands ---
  {
    name: 'noon a third brighter',
    knobs: ['meanLuminanceBands.noon'],
    expect: 'band:noon',
    apply: (i) => { i.frames.noon = A(scale(dryPNG.noon, 1.3)); },
  },
  {
    name: 'midnight a stop darker',
    knobs: ['meanLuminanceBands.midnight'],
    expect: 'band:midnight',
    apply: (i) => { i.frames.midnight = A(scale(dryPNG.midnight, 0.5)); },
  },
  {
    name: 'dawn pushed toward noon',
    knobs: ['meanLuminanceBands.dawn'],
    expect: 'band:dawn',
    apply: (i) => { i.frames.dawn = A(scale(dryPNG.dawn, 1.4)); },
  },
  {
    name: 'dusk pushed toward dawn',
    knobs: ['meanLuminanceBands.dusk'],
    expect: 'band:dusk',
    apply: (i) => { i.frames.dusk = A(scale(dryPNG.dusk, 1.9)); },
  },

  // --- clipping and crush ---
  {
    name: 'noon with 1% blown highlights',
    knobs: ['clipping.maxClippedWhite'],
    expect: 'clipWhite:noon',
    apply: (i) => { i.frames.noon = A(speckle(dryPNG.noon, 0.01, [255, 255, 255])); },
  },
  {
    name: 'noon with 0.5% crushed shadows',
    knobs: ['clipping.maxCrushedBlackDay'],
    expect: 'crushBlack:noon',
    apply: (i) => { i.frames.noon = A(speckle(dryPNG.noon, 0.005, [0, 0, 0])); },
  },
  {
    name: 'midnight with 3% crushed shadows',
    knobs: ['clipping.maxCrushedBlackNight'],
    expect: 'crushBlack:midnight',
    apply: (i) => { i.frames.midnight = A(speckle(dryPNG.midnight, 0.03, [0, 0, 0])); },
  },

  // --- spread ---
  ...NAMES.map((n) => ({
    name: `${n} flattened to its own mean`,
    knobs: [`spread.minStdDev.${n}`],
    expect: `stddev:${n}`,
    apply: (i) => { i.frames[n] = A(flatten(dryPNG[n])); },
  })),

  // --- emitters ---
  {
    name: 'midnight with every emitter desaturated',
    knobs: [
      'emitterClusters.minCountNight',
      'emitterClusters.saturation',
      'emitterClusters.value',
      'emitterClusters.minAreaPx',
    ],
    expect: 'emitters:midnight',
    apply: (i) => { i.frames.midnight = A(desaturate(dryPNG.midnight)); },
  },

  // --- distinctness ---
  {
    name: 'dusk replaced by midnight',
    knobs: ['distinctness.minPairMSD'],
    expect: 'distinct:midnight|dusk',
    apply: (i) => { i.frames.dusk = A(dryPNG.midnight); },
  },

  // --- warmth ---
  {
    name: 'dusk with its red-blue difference removed',
    knobs: ['warmth.minDuskOverNoon'],
    expect: 'warmth:dusk',
    apply: (i) => { i.frames.dusk = A(neutraliseWarmth(dryPNG.dusk)); },
  },
  {
    name: 'dawn with its red-blue difference removed',
    knobs: ['warmth.minDawnOverNoon'],
    expect: 'warmth:dawn',
    apply: (i) => { i.frames.dawn = A(neutraliseWarmth(dryPNG.dawn)); },
  },

  // --- hard fails ---
  {
    name: 'a console error',
    knobs: ['hardFails.consoleErrors'],
    expect: 'hard:console',
    apply: (i) => { i.consoleErrors = ['WebGL: INVALID_OPERATION']; },
  },
  {
    name: 'an uncaught page error',
    knobs: ['hardFails.pageErrors'],
    expect: 'hard:page',
    apply: (i) => { i.pageErrors = ['TypeError: undefined is not a function']; },
  },
  {
    name: 'a quarantined module at noon',
    knobs: ['hardFails.quarantinedModules'],
    expect: 'hard:faults:noon',
    apply: (i) => { i.infoAt.noon.faults = 1; },
  },
  {
    name: 'clustered lighting overflowing at midnight',
    knobs: ['hardFails.clusterOverflow'],
    expect: 'hard:overflow:midnight',
    apply: (i) => { i.infoAt.midnight.clusterOverflow = true; },
  },

  // --- photocell ---
  {
    name: 'street lighting off at midnight',
    knobs: ['photocell.onAt'],
    expect: 'photocell:midnight',
    apply: (i) => { i.infoAt.midnight.photocellOn = false; },
  },
  {
    name: 'street lighting on at noon',
    knobs: ['photocell.offAt'],
    expect: 'photocell:noon',
    apply: (i) => { i.infoAt.noon.photocellOn = true; },
  },

  // --- session 2 ---
  {
    name: 'noon road painted the navy it used to be',
    knobs: ['shadowHue.maxBlueOverRed', 'shadowHue.at', 'shadowHue.region'],
    expect: 'shadowHue',
    apply: (i) => { i.frames.noon = A(fillRect(dryPNG.noon, R.road, [35, 44, 63])); },
  },
  {
    name: 'both noon facades painted the same colour',
    knobs: [
      'facadeHue.minSeparationDeg.noon',
      'facadeHue.topQuantile',
      'facadeHue.regions',
    ],
    expect: 'facadeHue:noon',
    apply: (i) => {
      let p = fillRect(dryPNG.noon, R.facadeLeft, [150, 128, 102]);
      p = fillRect(p, R.facadeRight, [150, 128, 102]);
      i.frames.noon = A(p);
    },
  },
  {
    name: 'noon facades with no chroma at all',
    knobs: ['facadeHue.minSampledFraction'],
    expect: 'facadeHueSample:noon',
    apply: (i) => {
      let p = fillRect(dryPNG.noon, R.facadeLeft, [128, 128, 128]);
      p = fillRect(p, R.facadeRight, [96, 96, 96]);
      i.frames.noon = A(p);
    },
  },
  {
    name: 'midnight roadway flattened to one wash',
    knobs: [
      'groundPools.minCount',
      'groundPools.overMedian',
      'groundPools.minAbsolute',
      'groundPools.minAreaPx',
      'groundPools.at',
      'groundPools.region',
    ],
    expect: 'groundPools',
    apply: (i) => { i.frames.midnight = A(flatten(dryPNG.midnight, R.roadway)); },
  },
  {
    name: 'wet noon road with one roughness everywhere',
    knobs: ['wetness.minRoadSpread', 'wetness.region'],
    expect: 'wetSpread:noon',
    apply: (i) => { i.wetFrames.noon = A(flatten(wetPNG.noon, R.road)); },
  },
  {
    name: 'wet dawn road no glossier than the dry one',
    knobs: ['wetness.minSpreadOverDry'],
    expect: 'wetOverDry:dawn',
    apply: (i) => { i.wetFrames.dawn = A(dryPNG.dawn); },
  },
  {
    name: 'wet midnight identical to dry',
    knobs: ['wetness.minDryWetMSD', 'wetness.value'],
    expect: 'wetDistinct:midnight',
    apply: (i) => { i.wetFrames.midnight = A(dryPNG.midnight); },
  },
  {
    name: 'no wet variant captured for dusk',
    knobs: [],
    expect: 'wetMissing:dusk',
    apply: (i) => { delete i.wetFrames.dusk; },
  },

  // --- session 3: reflections ---
  {
    name: 'wet midnight near road with no reflections at all',
    knobs: [
      'ssrReflections.minCount',
      'ssrReflections.at',
      'ssrReflections.wet',
      'ssrReflections.region',
      'ssrReflections.overMedian',
      'ssrReflections.minAbsolute',
    ],
    expect: 'ssrReflections',
    apply: (i) => { i.wetFrames.midnight = A(flatten(wetPNG.midnight, R.nearRoad)); },
  },
  {
    name: 'reflections replaced by round pools of the same brightness',
    knobs: ['ssrReflections.minAspect'],
    expect: 'ssrReflections',
    apply: (i) => {
      // 120×120 px blobs: plenty of area, plenty of vertical extent, aspect 1.0.
      i.wetFrames.midnight = A(
        blobs(wetPNG.midnight, R.nearRoad, { w: 120, h: 120, pitchX: 300, pitchY: 300, rgb: [190, 170, 120] })
      );
    },
  },
  {
    name: 'reflections replaced by short wide dashes',
    knobs: ['ssrReflections.minVerticalFrac'],
    expect: 'ssrReflections',
    apply: (i) => {
      // 24 px tall on an 1800 px frame is 1.3% — under the floor — but 8×24 px
      // of area and aspect 3:1 the wrong way round.
      i.wetFrames.midnight = A(
        blobs(wetPNG.midnight, R.nearRoad, { w: 90, h: 24, pitchX: 260, pitchY: 130, rgb: [190, 170, 120] })
      );
    },
  },
  {
    name: 'reflections replaced by sub-pixel spikes',
    knobs: ['ssrReflections.minAreaPx'],
    expect: 'ssrReflections',
    apply: (i) => {
      i.wetFrames.midnight = A(
        blobs(wetPNG.midnight, R.nearRoad, { w: 2, h: 6, pitchX: 40, pitchY: 40, rgb: [255, 240, 200] })
      );
    },
  },

  // --- session 3: facade variation ---
  {
    name: 'every dusk wall painted the same colour',
    knobs: [
      'facadeVariation.minAlbedoClusters',
      'facadeVariation.at',
      'facadeVariation.patches',
      'facadeVariation.albedoSeparation',
      'facadeVariation.chromaWeight',
      'facadeVariation.wallLow',
      'facadeVariation.wallHigh',
    ],
    expect: 'facadeAlbedo',
    apply: (i) => {
      let p = dryPNG.dusk;
      for (const name of BUDGET.facadeVariation.patches) p = fillRect(p, R[name], [96, 62, 48]);
      i.frames.dusk = A(p);
    },
  },
  {
    name: 'one pair of adjacent dusk walls made identical',
    knobs: ['facadeVariation.minNeighbourDelta', 'facadeVariation.neighbours'],
    expect: 'facadeNeighbours',
    apply: (i) => {
      const [a, b] = BUDGET.facadeVariation.neighbours[0];
      let p = fillRect(dryPNG.dusk, R[a], [96, 62, 48]);
      p = fillRect(p, R[b], [96, 62, 48]);
      i.frames.dusk = A(p);
    },
  },
  {
    name: 'a dusk wall patch with a sign across a third of it',
    knobs: ['facadeVariation.maxPatchSpread'],
    expect: `facadePatchSample:${BUDGET.facadeVariation.patches[0]}`,
    apply: (i) => {
      // A third of the patch is an emitter. A third rather than a half on
      // purpose: at exactly half the patch's own median lands on the bright
      // side and the span reads small, which is the metric behaving correctly
      // and the case testing nothing.
      const [x0, y0, x1, y1] = R[BUDGET.facadeVariation.patches[0]];
      i.frames.dusk = A(fillRect(dryPNG.dusk, [x0, y0, x1, y0 + (y1 - y0) / 3], [250, 240, 230]));
    },
  },
  {
    name: 'one facade roughness for the whole block',
    knobs: ['facadeVariation.minRoughnessClusters', 'facadeVariation.roughnessSeparation'],
    expect: 'facadeRoughness',
    apply: (i) => {
      for (const n of NAMES) {
        if (i.infoAt[n].block && i.infoAt[n].block.variation) {
          i.infoAt[n].block.variation.roughness = i.infoAt[n].block.variation.roughness.map(() => 0.82);
        }
      }
    },
  },

  // --- session 5: the mid-distance band ---
  {
    name: 'both mid-distance walls painted the same colour',
    knobs: [
      'midDistanceVariation.minAlbedoClusters',
      'midDistanceVariation.at',
      'midDistanceVariation.patches',
      'midDistanceVariation.albedoSeparation',
      'midDistanceVariation.chromaWeight',
      'midDistanceVariation.wallLow',
      'midDistanceVariation.wallHigh',
    ],
    expect: 'midAlbedoClusters',
    apply: (i) => {
      let p = dryPNG.dusk;
      for (const name of BUDGET.midDistanceVariation.patches) p = fillRect(p, R[name], [128, 84, 60]);
      i.frames.dusk = A(p);
    },
  },
  {
    /**
     * Not "the same colour" — that is the case above. This is the failure mode
     * the mid band actually has: two different materials washed toward each
     * other until what is left of the difference is under the floor. So the two
     * patches are filled with colours that are 0.36 apart in this feature space
     * — over `albedoSeparation` and therefore still two clusters, under
     * `minClosest`.
     */
    name: 'two mid-distance walls washed to within 0.36 of each other',
    knobs: ['midDistanceVariation.minClosest'],
    expect: 'midAlbedoSeparation',
    apply: (i) => {
      const [a, b] = BUDGET.midDistanceVariation.patches;
      let p = fillRect(dryPNG.dusk, R[a], [132, 86, 60]);
      p = fillRect(p, R[b], [128, 90, 63]);
      i.frames.dusk = A(p);
    },
  },
  {
    name: 'a mid-distance patch straddling a bright edge',
    knobs: ['midDistanceVariation.maxPatchSpread'],
    expect: `midPatchSample:${BUDGET.midDistanceVariation.patches[0]}`,
    apply: (i) => {
      const [x0, y0, x1, y1] = R[BUDGET.midDistanceVariation.patches[0]];
      i.frames.dusk = A(fillRect(dryPNG.dusk, [x0, y0, x1, y0 + (y1 - y0) / 3], [250, 240, 230]));
    },
  },

  // --- session 3: structural variation ---
  ...[
    { field: 'eras', knob: 'structuralVariation.minEras', key: 'structureEras', fill: () => 0 },
    { field: 'rhythms', knob: 'structuralVariation.minWindowRhythms', key: 'structureRhythms', fill: () => 'grid' },
    { field: 'groundFloors', knob: 'structuralVariation.minGroundFloorKinds', key: 'structureGroundFloors', fill: () => 'shopfront' },
    {
      field: 'floorHeights',
      knob: 'structuralVariation.minFloorHeights',
      key: 'structureFloorHeights',
      fill: () => 3.5,
      sepKnob: 'structuralVariation.floorHeightSeparation',
    },
    {
      field: 'corniceDepths',
      knob: 'structuralVariation.minCorniceDepths',
      key: 'structureCornices',
      fill: () => 0.35,
      sepKnob: 'structuralVariation.corniceDepthSeparation',
    },
    {
      field: 'windowWallRatios',
      knob: 'structuralVariation.minWindowWallRatios',
      key: 'structureWindowWall',
      fill: () => 0.3,
      sepKnob: 'structuralVariation.windowWallSeparation',
    },
  ].map((c) => ({
    name: `every building given the same ${c.field.replace(/([A-Z])/g, ' $1').toLowerCase()}`,
    knobs: c.sepKnob ? [c.knob, c.sepKnob] : [c.knob],
    expect: c.key,
    apply: (i) => {
      for (const n of NAMES) {
        const v = i.infoAt[n].block && i.infoAt[n].block.variation;
        if (v && Array.isArray(v[c.field])) v[c.field] = v[c.field].map(c.fill);
      }
    },
  })),
  {
    name: 'a block that reports no variation at all',
    knobs: ['structuralVariation.at'],
    expect: 'structureMissing',
    apply: (i) => {
      for (const n of NAMES) if (i.infoAt[n].block) delete i.infoAt[n].block.variation;
    },
  },
];

/** Cases against validateBudget rather than against a frame. */
const BUDGET_CASES = [
  {
    name: 'a luminance band wide enough to accept anything',
    knobs: ['bandRules.maxBandWidth'],
    match: /is 0\.\d+ wide, over the/,
    apply: (b) => { b.meanLuminanceBands.noon = [0.3, 0.55]; },
  },
  {
    name: 'two bands touching',
    knobs: ['bandRules.minBandGap'],
    match: /gap .* is under the/,
    apply: (b) => { b.meanLuminanceBands.dawn = [0.171, 0.2]; },
  },
  {
    name: 'a band outside the global range',
    knobs: ['bandRules.globalRange'],
    match: /leaves the global range/,
    apply: (b) => { b.meanLuminanceBands.noon = [0.72, 0.78]; },
  },
  {
    name: 'a band that is inverted',
    knobs: [],
    match: /empty or inverted/,
    apply: (b) => { b.meanLuminanceBands.noon = [0.462, 0.408]; },
  },
  {
    name: 'an ordering that names a time nobody captures',
    knobs: ['bandRules.order'],
    match: /which is not a captured time/,
    apply: (b) => { b.bandRules.order = ['midnight', 'dusk', 'dawn', 'noon', 'teatime']; },
  },
  {
    name: 'a captured time with no band',
    knobs: [],
    match: /has no band/,
    apply: (b) => { b.bandRules.order = ['midnight', 'dusk', 'dawn']; },
  },
  {
    name: 'an assertion region that is inverted',
    knobs: [],
    match: /empty or inverted/,
    apply: (b) => { b.regions.road = [0.62, 0.735, 0.3, 0.665]; },
  },
  {
    name: 'an assertion region that is most of the frame',
    knobs: [],
    match: /that is not a region/,
    apply: (b) => { b.regions.road = [0.0, 0.0, 1.0, 0.9]; },
  },
  {
    name: 'an assertion region that does not exist',
    knobs: [],
    match: /is not a \[x0,y0,x1,y1\] rect/,
    apply: (b) => { delete b.regions.roadway; },
  },
  {
    name: 'more albedo clusters demanded than there are patches to measure',
    knobs: [],
    match: /unsatisfiable/,
    apply: (b) => { b.facadeVariation.minAlbedoClusters = b.facadeVariation.patches.length + 1; },
  },
  {
    name: 'a neighbour pair naming a patch nobody measures',
    knobs: [],
    match: /which is not one of the patches/,
    apply: (b) => { b.facadeVariation.neighbours[0] = ['wallSouthNear', 'facadeLeft']; },
  },
];

// ---------------------------------------------------------------------------
// knob coverage — every number in the budget must have a case
// ---------------------------------------------------------------------------

/**
 * Descriptive fields rather than thresholds: they say what to capture, not what
 * counts as right. Everything else in look-budget.json has to be exercised.
 */
const NOT_A_THRESHOLD = new Set(['capture', 'times', 'regions', '$comment']);

function knobsOf(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k === '$comment') continue;
    const key = prefix ? `${prefix}.${k}` : k;
    if (!prefix && NOT_A_THRESHOLD.has(k)) continue;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...knobsOf(v, key));
    else out.push(key);
  }
  return out;
}

const declared = new Set([...CASES, ...BUDGET_CASES].flatMap((c) => c.knobs));
const present = knobsOf(BUDGET);
const uncovered = present.filter((k) => !declared.has(k));
const stale = [...declared].filter((k) => !present.includes(k));

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

const problems = [];
console.log('gateaudit: every threshold in look-budget.json, fed a frame that should fail it\n');

// The control. If the unperturbed frames do not pass, everything below is
// measuring the wrong thing.
const control = assertLook(baseInput());
if (control.failures.length) {
  console.log('  ✗ CONTROL — the unperturbed frames do not pass their own gate:');
  for (const f of control.failures) console.log(`      ${f.key}: ${f.message}`);
  problems.push('control failed');
} else {
  console.log('  ok  control — the captured frames pass unperturbed');
}
/**
 * SUPPRESSION IS NOT PASSING, AND THE CONTROL IS WHERE IT HIDES.
 *
 * An assertion that sits downstream of another is skipped when that other one
 * fails. On the control run nothing is supposed to fail, so nothing is supposed
 * to be skipped — and if something is, the suite has an assertion that has never
 * been evaluated on a real frame while reporting nothing. That is exactly the
 * state `facadeAlbedo` was in for two sessions.
 */
if (control.suppressed.length) {
  console.log('  ✗ CONTROL — assertions that did not run at all:');
  for (const s of control.suppressed) console.log(`      ${s.key}: ${s.because}`);
  for (const s of control.suppressed) {
    problems.push(`${s.key} did not run on the control frames — a gate that cannot run is not a green gate`);
  }
} else {
  console.log('  ok  control — every assertion ran\n');
}

for (const c of CASES) {
  const input = baseInput();
  c.apply(input);
  const { failures, suppressed } = assertLook(input);
  const keys = failures.map((f) => f.key);
  const hit = keys.includes(c.expect);
  /**
   * A perturbation that makes the target assertion UNRUNNABLE rather than red
   * is the failure mode this audit existed to catch and could not: the case
   * looks like it did nothing, the operator reads "did not fire", and the
   * actual state — the check was never performed — is not on the screen.
   */
  const gagged = suppressed.find((s) => s.key === c.expect);
  const extra = keys.filter((k) => k !== c.expect);
  console.log(
    `  ${hit ? 'ok ' : gagged ? '‼  ' : '✗  '} ${c.name.padEnd(46)} → ${c.expect}` +
      (hit && extra.length ? `   (also ${extra.length} other${extra.length > 1 ? 's' : ''})` : '') +
      (!hit && gagged ? '   SUPPRESSED, not failed' : '')
  );
  if (!hit) {
    if (gagged) {
      console.log(`        suppressed by: ${gagged.because}`);
      problems.push(
        `${c.expect} was suppressed rather than fired for "${c.name}" — the perturbation broke the check ` +
          `that guards it, so the threshold is still unmeasured`
      );
    } else {
      problems.push(`${c.expect} did not fire for "${c.name}" — that threshold does not measure anything`);
    }
    if (keys.length) console.log(`        fired instead: ${keys.join(', ')}`);
  }
}

console.log('');
for (const c of BUDGET_CASES) {
  const b = JSON.parse(JSON.stringify(BUDGET));
  c.apply(b);
  const found = validateBudget(b);
  const hit = found.some((p) => c.match.test(p));
  console.log(`  ${hit ? 'ok ' : '✗  '} budget: ${c.name}`);
  if (!hit) {
    problems.push(`validateBudget accepted "${c.name}"`);
    if (found.length) console.log(`        reported instead: ${found.join('; ')}`);
  }
}

// ---------------------------------------------------------------------------
// headroom
// ---------------------------------------------------------------------------

console.log('\nheadroom — how far the delivered frames sit from each threshold\n');
const base = baseInput();
const { report } = assertLook(base);

const row = (label, measured, threshold, dir) => {
  const m = Number(measured);
  const t = Number(threshold);
  const ratio = dir === 'floor' ? m / (t || 1e-9) : t === 0 ? Infinity : m / t;
  const slack = dir === 'floor' ? `${(ratio).toFixed(2)}× the floor` : `${(ratio * 100).toFixed(1)}% of the ceiling`;
  console.log(`  ${label.padEnd(34)} ${m.toFixed(4).padStart(9)}  vs ${t.toFixed(4).padStart(9)}  ${slack}`);
};

for (const n of NAMES) {
  const [lo, hi] = BUDGET.meanLuminanceBands[n];
  const v = base.frames[n].meanLuminance;
  const edge = Math.min(v - lo, hi - v);
  console.log(`  ${`band ${n}`.padEnd(34)} ${v.toFixed(4).padStart(9)}  in [${lo}, ${hi}]  nearest edge ${edge.toFixed(4)}`);
}
for (const n of NAMES) row(`stddev ${n}`, base.frames[n].stdDev, BUDGET.spread.minStdDev[n], 'floor');
for (const n of NAMES) {
  const isNight = n === 'midnight' || n === 'dusk';
  row(
    `crushed black ${n}`,
    base.frames[n].crushedBlack,
    isNight ? BUDGET.clipping.maxCrushedBlackNight : BUDGET.clipping.maxCrushedBlackDay,
    'ceiling'
  );
}
for (const n of NAMES) row(`clipped white ${n}`, base.frames[n].clippedWhite, BUDGET.clipping.maxClippedWhite, 'ceiling');
row('emitter clusters midnight', report.clusters.midnight.clusters, BUDGET.emitterClusters.minCountNight, 'floor');
{
  const worst = Object.entries(report.msd).sort((a, b) => a[1] - b[1])[0];
  row(`msd (tightest: ${worst[0]})`, worst[1], BUDGET.distinctness.minPairMSD, 'floor');
}
row('warmth dusk-noon', base.frames.dusk.meanRminusB - base.frames.noon.meanRminusB, BUDGET.warmth.minDuskOverNoon, 'floor');
row('warmth dawn-noon', base.frames.dawn.meanRminusB - base.frames.noon.meanRminusB, BUDGET.warmth.minDawnOverNoon, 'floor');
row('noon road B/R', report.regions.shadowRoad.blueOverRed, BUDGET.shadowHue.maxBlueOverRed, 'ceiling');
for (const [n, floor] of Object.entries(BUDGET.facadeHue.minSeparationDeg)) {
  row(`facade hue sep ${n} (deg)`, report.regions[`facadeHue:${n}`].sep, floor, 'floor');
}
row('midnight ground pools', report.regions.pools.clusters, BUDGET.groundPools.minCount, 'floor');
for (const n of NAMES) {
  row(`wet road spread ${n}`, report.wet[n].wet, BUDGET.wetness.minRoadSpread, 'floor');
  row(`wet/dry spread ratio ${n}`, report.wet[n].wet / Math.max(report.wet[n].dry, 1e-9), BUDGET.wetness.minSpreadOverDry, 'floor');
  row(`wet/dry msd ${n}`, report.wet[n].msd, BUDGET.wetness.minDryWetMSD, 'floor');
}
if (report.reflections) {
  row('midnight-wet reflections', report.reflections.streaks, BUDGET.ssrReflections.minCount, 'floor');
  row('tallest reflection (frame)', report.reflections.tallestFrac, BUDGET.ssrReflections.minVerticalFrac, 'floor');
}
if (report.facade) {
  row('dusk albedo clusters', report.facade.clusters.clusters, BUDGET.facadeVariation.minAlbedoClusters, 'floor');
  row('closest wall pair', report.facade.clusters.closest, BUDGET.facadeVariation.albedoSeparation, 'floor');
  const weakest = Object.entries(report.facade.neighbours).sort((a, b) => a[1] - b[1])[0];
  if (weakest) row(`weakest neighbour pair`, weakest[1], BUDGET.facadeVariation.minNeighbourDelta, 'floor');
  if (report.facade.roughness) {
    row('facade roughness clusters', report.facade.roughness.clusters.clusters, BUDGET.facadeVariation.minRoughnessClusters, 'floor');
  }
}
if (report.midFacade) {
  const M = BUDGET.midDistanceVariation;
  row('mid-distance albedo clusters', report.midFacade.clusters.clusters, M.minAlbedoClusters, 'floor');
  row('closest mid-distance pair', report.midFacade.clusters.closest, M.minClosest, 'floor');
}
if (report.structure) {
  const V = BUDGET.structuralVariation;
  row('eras', report.structure.eras, V.minEras, 'floor');
  row('floor heights', report.structure['floor heights'], V.minFloorHeights, 'floor');
  row('window rhythms', report.structure['window rhythms'], V.minWindowRhythms, 'floor');
  row('ground-floor treatments', report.structure['ground-floor treatments'], V.minGroundFloorKinds, 'floor');
  row('cornice depths', report.structure['cornice depths'], V.minCorniceDepths, 'floor');
  row('window-to-wall ratios', report.structure['window-to-wall ratios'], V.minWindowWallRatios, 'floor');
}

// ---------------------------------------------------------------------------

console.log('');
if (uncovered.length) {
  for (const k of uncovered) {
    problems.push(`look-budget.json has '${k}' and no audit case exercises it`);
  }
}
if (stale.length) {
  for (const k of stale) {
    problems.push(`an audit case claims to exercise '${k}', which is not in look-budget.json`);
  }
}

// ---------------------------------------------------------------------------
// CONTRACT §7.1 — the other gates' self-tests.
//
// This file has always audited `lookcheck`, because lookcheck's thresholds are
// read off captured frames and a frame can be perturbed. `perfcheck` and
// `citycheck` read harness instruments instead, so their falsifying cases have
// to live beside their own assertions — but there must still be exactly ONE
// meta-gate, or "every gate has an exercised failing case" becomes a rule that
// each gate grades itself against. So they are run here, as subprocesses, and
// this gate fails if either of them does.
//
// The three gates that went quiet rather than red are named in CONTRACT §7.1.
// `faultcheck` is not in this list and needs no registry: it is fault injection
// end to end and every one of its cases IS a known failing case.

const SELF_TESTS = ['perfcheck.mjs', 'citycheck.mjs', 'windcheck.mjs', 'inputcheck.mjs'];

for (const tool of SELF_TESTS) {
  const url = new URL(`./${tool}`, import.meta.url);
  const res = spawnSync(process.execPath, [fileURLToPath(url), '--falsify'], {
    encoding: 'utf8',
    cwd: fileURLToPath(new URL('..', import.meta.url)),
  });
  const out = String(res.stdout || '').trim();
  /**
   * EVERY `--falsify:` LINE, NOT THE FIRST ONE.
   *
   * This was `.find(...)` and it printed one line per subprocess. `perfcheck`
   * prints three — the §7.3 shape controls, the §7.5 width controls and the
   * coverage summary — so the moment a second control sweep was added, two thirds
   * of what the meta-gate had proved stopped appearing in the meta-gate's report.
   * The exit code still enforced them, so nothing was UNGATED; what was lost was
   * the number, and CONTRACT §7.1 is a whole section about a check whose result
   * has gone quiet being indistinguishable from one that passed IN EVERY REPORT
   * THIS PROJECT PRODUCES. A summary that silently drops a sweep is that failure
   * in the one file whose job is to catch it.
   */
  const lines = out.split('\n').filter((l) => l.includes('--falsify:'));
  if (!lines.length) lines.push(out.split('\n')[0] || `${tool} produced no output`);
  console.log('  ' + (res.status === 0 ? '✓' : '✗') + ' ' + lines[0]);
  for (const l of lines.slice(1)) console.log('    ' + l.trim());
  if (res.status !== 0) {
    problems.push(
      `${tool} --falsify exited ${res.status}: ${out.split('\n').filter((l) => l.includes('✗')).join(' | ') ||
        String(res.stderr || '').slice(0, 300)}`
    );
  }
}
console.log('');

if (problems.length) {
  console.log('GATE AUDIT FAILURES');
  for (const p of problems) console.log('  ✗ ' + p);
  console.log('');
  process.exit(1);
}

console.log(
  `gateaudit: ${CASES.length + BUDGET_CASES.length} cases, every threshold in look-budget.json bites, ` +
  `and ${SELF_TESTS.length} other gates proved every assertion of their own can be made to fail.`
);
process.exit(0);
