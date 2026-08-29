#!/usr/bin/env node
/**
 * placeprobe.mjs — WHAT THE FIFTEEN ISLAND KINDS ACTUALLY DELIVER. Not a gate.
 *
 *   node tools/placeprobe.mjs --light --program --grid
 *   node tools/placeprobe.mjs --light --radius=10 --seeds=1337,1338,1339
 *
 * SESSION 54, and it exists for one item and one rule. The brief's item 5 says
 * in as many words *"MEASURE THE SPREAD OF ALL THREE — height, tone, block
 * dimension — before changing anything"*, and the brief's own standing rule is
 * DO NOT BUILD AN INSTRUMENT unless something cannot be judged without one. A
 * spread cannot be judged from a frame: three candidate causes of *"it looks a
 * bit boring"* are three distributions, and an aerial photograph of a district
 * is one draw from all three at once.
 *
 * It also carries the census item 1 needs, for the same reason and in the same
 * file: *"is this kind of place lit"* is a property of the same fifteen rows,
 * and asking it in a second tool would be two lists of fifteen kinds that can
 * go out of step with each other (CONTRACT §9.1).
 *
 * Everything here comes out of the PURE GENERATOR. No browser, no frame, no
 * absolute milliseconds — counts, metres and reflectances, which are the
 * quantities CONTRACT §0.2 admits from a loud machine.
 *
 * IT ASSERTS NOTHING AND MUST NOT. `citycheck` owns the verdicts about content;
 * this is the instrument its numbers can be reproduced from, the same
 * arrangement `clustercheck` has with `perfcheck`.
 */

import {
  generateChunk, chunkBounds, densityAt, latticeCarriageway,
  LOW_DETAIL_KINDS, PROGRAM_KINDS, LANDMARK_APRON, LANDMARKS, LOW_DETAIL_PROPS,
  CITY_MATERIALS, CITY_ERAS, CITY,
} from '../src/lib/citygen.js';

const args = new Map(
  process.argv.slice(2).map((a) => {
    const s = a.replace(/^--/, '');
    const i = s.indexOf('=');
    return i < 0 ? [s, 'true'] : [s.slice(0, i), s.slice(i + 1)];
  })
);

const RADIUS = Number(args.get('radius') || 8);
const SEEDS = (args.get('seeds') || '1337').split(',').map((s) => s.trim());
const ALL = !args.has('light') && !args.has('program') && !args.has('grid');

const n2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '  -  ');
const n3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : '  -  ');

/** Mean, sd and the extremes of a sample, in the one shape every table prints. */
function stats(xs) {
  const n = xs.length;
  if (!n) return { n: 0, mean: NaN, sd: NaN, min: NaN, max: NaN, p10: NaN, p90: NaN };
  const s = [...xs].sort((a, b) => a - b);
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const varr = n > 1 ? xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
  const q = (p) => s[Math.min(n - 1, Math.max(0, Math.round(p * (n - 1))))];
  return { n, mean, sd: Math.sqrt(varr), min: s[0], max: s[n - 1], p10: q(0.10), p90: q(0.90) };
}

/** Every chunk in the square of `RADIUS` rings about the origin, one seed. */
function* chunks(seed) {
  for (let cx = -RADIUS; cx <= RADIUS; cx++) {
    for (let cz = -RADIUS; cz <= RADIUS; cz++) yield generateChunk(seed, cx, cz);
  }
}

// ---------------------------------------------------------------------------
// 1 — THE LIGHTING CENSUS
//
// `city.js` turns a `lamp` or a `flood` feature into a lamp-pool candidate and
// an emissive bowl, and turns nothing else into either. So "is this kind of
// place lit" has exactly one delivered answer and it is a count of two feature
// kinds. Everything else on an island — a fence, a stack, a shed, a bay
// marking — is an unlit dark object at midnight.

function lightCensus() {
  console.log('=== 1. WHAT IS LIT, BY KIND ================================================');
  console.log(`    the pure generator, ${(2 * RADIUS + 1) ** 2} chunks a seed, seeds ${SEEDS.join(' ')}`);
  console.log('    a `lamp` or `flood` feature is the ONLY thing city.js turns into a');
  console.log('    lamp-pool candidate and an emissive bowl. Nothing else on an island is lit.');
  console.log('');
  const rows = new Map();
  for (const seed of SEEDS) {
    for (const c of chunks(seed)) {
      const r = rows.get(c.kind) || { kind: c.kind, chunks: 0, lamp: 0, flood: 0, feats: 0, props: 0, zero: 0 };
      let lamp = 0;
      let flood = 0;
      for (const f of c.features) {
        if (f.kind === 'lamp') lamp++;
        else if (f.kind === 'flood') flood++;
      }
      r.chunks++;
      r.lamp += lamp;
      r.flood += flood;
      r.feats += c.features.length;
      r.props += c.props.length;
      if (lamp + flood === 0) r.zero++;
      rows.set(c.kind, r);
    }
  }
  const order = ['built', ...LOW_DETAIL_KINDS];
  console.log('  kind          chunks   lamp/ch  flood/ch  LIT/ch   features/ch  props/ch  chunks with NO light');
  let unlitKinds = 0;
  for (const k of order) {
    const r = rows.get(k);
    if (!r) continue;
    const lit = (r.lamp + r.flood) / r.chunks;
    if (lit === 0) unlitKinds++;
    console.log(
      `  ${k.padEnd(13)} ${String(r.chunks).padStart(6)}   ${n2(r.lamp / r.chunks).padStart(7)}  ` +
      `${n2(r.flood / r.chunks).padStart(8)}  ${n2(lit).padStart(6)}   ` +
      `${n2(r.feats / r.chunks).padStart(11)}  ${n2(r.props / r.chunks).padStart(8)}  ` +
      `${String(r.zero).padStart(6)} of ${r.chunks}` + (lit === 0 ? '   <- NO LIGHT AT ALL' : '')
    );
  }
  console.log('');
  console.log(`  ${unlitKinds} of ${order.length} kinds deliver no lamp and no flood on any chunk.`);

  console.log('');
  console.log('  THE LANDMARK APRONS. `LANDMARK_APRON` is the whole table: a ground, an edge');
  console.log('  treatment, a prop list, a furnishing pitch and — since session 54 — a light.');
  for (const [name, a] of Object.entries(LANDMARK_APRON)) {
    console.log(
      `    ${name.padEnd(11)} ground ${String(a.ground).padEnd(11)} edge ${String(a.edge).padEnd(9)} ` +
      `spacing ${String(a.spacingM).padStart(3)} m  props [${a.props.join(', ')}]`
    );
    console.log(
      `    ${' '.repeat(11)} light  ${a.light ? `${a.light} at ${a.lightHeightM} m every ${a.lightEveryM} m of arc` : 'NONE   <- unlit'}`
    );
  }
  const lm = LANDMARKS.map((l) => l.name).join(', ');
  console.log(`    ${Object.keys(LANDMARK_APRON).length} of ${LANDMARKS.length} landmarks have an apron at all (${lm}).`);

  console.log('');
  console.log('  AND THE PROP PALETTES, so item 4 can be read off the same page.');
  console.log('  A palette without the thing that MAKES the place is a place furnished as');
  console.log('  something else (STATE 50: a churchyard furnished with shipping containers).');
  for (const k of order) {
    if (k === 'built') continue;
    const p = LOW_DETAIL_PROPS[k] || LOW_DETAIL_PROPS.$default;
    const uniq = [...new Set(p)];
    console.log(`    ${k.padEnd(13)} ${uniq.length} kinds, ${p.length} faces: ${p.join(' ')}`);
  }
}

// ---------------------------------------------------------------------------
// 2 — ITEM 5's THREE SPREADS
//
// (a) height   the delivered mass heights, program against residential
// (b) tone     the delivered facade reflectance, the same two populations
// (c) block    the run length of un-roaded ground along a transect

/** A program island's masses, as { height, albedo } — what city.js draws. */
function programMasses(c) {
  const out = [];
  for (const f of c.features) {
    if (f.kind === 'shed' || f.kind === 'canopy') {
      out.push({ owner: c.kind, kind: f.kind, height: f.height, albedo: f.albedo || null });
    } else if (f.kind === 'tower') {
      out.push({ owner: c.kind, kind: f.kind, height: f.height, albedo: f.albedo || null });
    } else if (f.kind === 'deckpark') {
      out.push({ owner: c.kind, kind: f.kind, height: f.levels * f.storey + f.upstand, albedo: null });
    }
  }
  return out;
}

/** Luminance of a linear-sRGB reflectance triple — Rec.709, one number a facade. */
const lum = (a) => (a ? 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2] : NaN);

function programSpread() {
  console.log('');
  console.log('=== 2. ITEM 5 (a) HEIGHT and (b) TONE ======================================');
  const res = [];
  const resTone = [];
  const byKind = new Map();
  const resEra = new Map();
  const resMat = new Map();
  for (const seed of SEEDS) {
    for (const c of chunks(seed)) {
      if (c.kind === 'built') {
        for (const b of c.buildings) {
          res.push(b.height);
          const mat = CITY_MATERIALS[b.material];
          if (mat) resTone.push(lum(mat.albedo));
          resEra.set(b.era, (resEra.get(b.era) || 0) + 1);
          resMat.set(b.material, (resMat.get(b.material) || 0) + 1);
        }
      } else {
        for (const m of programMasses(c)) {
          const r = byKind.get(m.owner) || { h: [], t: [], kinds: new Set() };
          r.h.push(m.height);
          if (m.albedo) r.t.push(lum(m.albedo));
          r.kinds.add(m.kind);
          byKind.set(m.owner, r);
        }
      }
    }
  }

  console.log('');
  console.log('  (a) HEIGHT of every mass the generator delivers, metres');
  console.log('  population            n      mean     sd     min     p10     p50     p90     max');
  const printH = (label, xs) => {
    const s = stats(xs);
    const sorted = [...xs].sort((a, b) => a - b);
    const p50 = sorted.length ? sorted[Math.floor(sorted.length / 2)] : NaN;
    console.log(
      `  ${label.padEnd(20)} ${String(s.n).padStart(5)}  ${n2(s.mean).padStart(7)} ${n2(s.sd).padStart(6)} ` +
      `${n2(s.min).padStart(7)} ${n2(s.p10).padStart(7)} ${n2(p50).padStart(7)} ${n2(s.p90).padStart(7)} ${n2(s.max).padStart(7)}`
    );
  };
  printH('residential', res);
  const progAll = [];
  for (const k of LOW_DETAIL_KINDS) {
    const r = byKind.get(k);
    if (!r || !r.h.length) continue;
    printH(`${k} (${[...r.kinds].join('+')})`, r.h);
    progAll.push(...r.h);
  }
  printH('ALL non-built mass', progAll);
  console.log('');
  const sR = stats(res);
  const sP = stats(progAll);
  console.log(`  residential sd ${n2(sR.sd)} m over ${sR.n}; non-built sd ${n2(sP.sd)} m over ${sP.n}.`);
  console.log(`  residential max ${n2(sR.max)} m; non-built max ${n2(sP.max)} m.`);

  console.log('');
  console.log('  (b) TONE — the delivered facade reflectance as a Rec.709 luminance');
  console.log('  population            n      mean     sd     min     max   distinct values');
  const printT = (label, xs) => {
    const s = stats(xs);
    const d = new Set(xs.map((v) => v.toFixed(5))).size;
    console.log(
      `  ${label.padEnd(20)} ${String(s.n).padStart(5)}  ${n3(s.mean).padStart(7)} ${n3(s.sd).padStart(6)} ` +
      `${n3(s.min).padStart(7)} ${n3(s.max).padStart(7)}   ${String(d).padStart(6)}`
    );
  };
  printT('residential', resTone);
  const progTone = [];
  for (const k of LOW_DETAIL_KINDS) {
    const r = byKind.get(k);
    if (!r || !r.t.length) continue;
    printT(k, r.t);
    progTone.push(...r.t);
  }
  printT('ALL non-built mass', progTone);
  console.log('');
  console.log('  the residential population reaches those tones through FOUR MATERIALS and FIVE ERAS:');
  console.log(`    materials  ${[...resMat].map(([k, v]) => `${k} ${v}`).join('  ')}`);
  console.log(`    eras       ${[...resEra].map(([k, v]) => `${k} ${v}`).join('  ')}`);
  console.log(`    rhythms    ${[...new Set(Object.values(CITY_ERAS).map((e) => e.rhythm))].join(' ')}`);
}

function gridSpread() {
  console.log('');
  console.log('=== 3. ITEM 5 (c) BLOCK DIMENSION ==========================================');
  console.log('  `latticeCarriageway(x, z)` is the road network as a predicate. Walked at');
  console.log('  0.25 m along four transects, this is the run length of every stretch of');
  console.log('  ground that is NOT carriageway — which is what a block is, measured off the');
  console.log('  same function the generator clips its ground with.');
  console.log('');
  const step = 0.25;
  const runsAll = [];
  for (const [label, axis, fixed] of [
    ['x at z = 300', 'x', 300], ['x at z = -700', 'x', -700],
    ['z at x = 300', 'z', 300], ['z at x = -700', 'z', -700],
  ]) {
    const runs = [];
    let run = 0;
    for (let t = -2000; t <= 2000; t += step) {
      const x = axis === 'x' ? t : fixed;
      const z = axis === 'x' ? fixed : t;
      if (latticeCarriageway(x, z)) {
        if (run > 0) runs.push(run);
        run = 0;
      } else run += step;
    }
    if (run > 0) runs.push(run);
    const inner = runs.filter((r) => r > 5);
    const s = stats(inner);
    runsAll.push(...inner);
    console.log(
      `  ${label.padEnd(14)} ${String(s.n).padStart(4)} blocks   mean ${n2(s.mean)} m   sd ${n3(s.sd)} m   ` +
      `min ${n2(s.min)}   max ${n2(s.max)}   distinct ${new Set(inner.map((v) => v.toFixed(2))).size}`
    );
  }
  const s = stats(runsAll);
  console.log('');
  console.log(
    `  POOLED: ${s.n} blocks, mean ${n2(s.mean)} m, sd ${n3(s.sd)} m, ` +
    `${new Set(runsAll.map((v) => v.toFixed(2))).size} distinct lengths.`
  );
  console.log(`  CITY.chunkSize is ${CITY.chunkSize} m and it is a constant read by every lattice term.`);

  console.log('');
  console.log('  AND THE SAME QUESTION ASKED OF THE BUILDABLE ISLAND, which is what a');
  console.log('  perimeter block actually occupies: chunkBounds inset by CORRIDOR.');
  const areas = [];
  for (const seed of SEEDS) {
    for (const c of chunks(seed)) {
      const b = chunkBounds(c.cx, c.cz);
      areas.push((b.x1 - b.x0) * (b.z1 - b.z0));
    }
  }
  const sa = stats(areas);
  console.log(`    ${sa.n} chunks, area mean ${n2(sa.mean)} m2, sd ${n3(sa.sd)}, distinct ${new Set(areas).size}`);
}

function densityBand() {
  console.log('');
  console.log('=== 4. WHERE THE LOW-DETAIL KINDS SIT IN THE FIELD =========================');
  const rows = new Map();
  for (const seed of SEEDS) {
    for (const c of chunks(seed)) {
      const b = chunkBounds(c.cx, c.cz);
      const d = densityAt(seed, (b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
      const r = rows.get(c.kind) || [];
      r.push(d);
      rows.set(c.kind, r);
    }
  }
  console.log('  kind          chunks   share   density mean    min    max');
  const total = [...rows.values()].reduce((a, b) => a + b.length, 0);
  for (const k of ['built', ...LOW_DETAIL_KINDS]) {
    const r = rows.get(k);
    if (!r) continue;
    const s = stats(r);
    console.log(
      `  ${k.padEnd(13)} ${String(s.n).padStart(6)}  ${n2((100 * s.n) / total).padStart(5)}%   ` +
      `${n3(s.mean).padStart(11)}  ${n3(s.min).padStart(5)}  ${n3(s.max).padStart(5)}` +
      (PROGRAM_KINDS.has(k) ? '   program' : '')
    );
  }
}

if (ALL || args.has('light')) lightCensus();
if (ALL || args.has('program')) programSpread();
if (ALL || args.has('grid')) gridSpread();
if (ALL || args.has('bands')) densityBand();
