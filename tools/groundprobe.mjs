#!/usr/bin/env node
/**
 * groundprobe.mjs — WHAT STANDS ON THE GROUND THAT IS NOT A BUILDING.
 * NOT A GATE, and it must never become one. SESSION 40.
 *
 *   node tools/groundprobe.mjs               objects per hectare, by block kind
 *   node tools/groundprobe.mjs --law         the prop-count law, arm by arm
 *   node tools/groundprobe.mjs --interiors   the built block's own core
 *   node tools/groundprobe.mjs --vocab       what each kind is actually made of
 *   node tools/groundprobe.mjs --seeds=a,b   pooled over regions
 *   node tools/groundprobe.mjs --radius=5    half-width of the region in chunks
 *
 * WHY IT EXISTS.
 *
 * The operator's read of session 39's frames: the density is liveable and
 * *everything which is not a building stands empty*. LOOK.md §2 says an empty
 * parcel is empty **for a reason** — a yard, a site, a park. The reason is
 * declared by `LOW_DETAIL_KINDS` and it is not drawn.
 *
 * PER HECTARE AND NOT PER CHUNK, WHICH IS THE WHOLE INSTRUMENT.
 *
 * Every chunk is the same 128 m square and every island is the same 104.6 m
 * square, so a per-chunk count looks comparable and is not: a `built` island
 * has 20–50% of itself under a building, a park island has a pond and a
 * pavilion on it, and a river chunk has water across a third of it. The ground
 * a prop could stand on is what differs, and it is what this divides by.
 *
 *   OPEN GROUND  the island, minus the union of every SOLID claim standing on
 *                it — `building`, `landmark`, `water`, `block`. Exact rather
 *                than sampled: the claims are clipped to the island and their
 *                union area is taken by coordinate compression, so a probe
 *                reading 0.0 m² of open ground is a fact and not a raster
 *                that missed.
 *
 * WHAT COUNTS AS AN OBJECT ON IT. `props` with their centre inside the island
 * (the kerbside ones stand in the corridor, outside it, and belong to the
 * street rather than to the block interior) plus `features` — a park's lamps,
 * edging and centre piece, a site's hoarding, frame, crane, floods and spoil.
 * Both are counted and both are printed, because a park that reads as
 * inhabited does it with features and a yard has none available to it.
 *
 * THE LIGHT WELL IS A DERIVED RECTANGLE AND NOT A GUESS. `lotDepthM()` is
 * 40.6 m — the deepest a perimeter building may ever reach — so the central
 * `104.6 − 2 × 40.6 = 23.4 m` square of every island is ground no building
 * of this generator can stand on by construction. That is the core LOOK.md §2
 * derived from `CORRIDOR`, and item (d) of session 40's brief is about it.
 *
 * IT ASSERTS NOTHING ABOUT THE CITY. `citycheck` owns the verdicts.
 */

import {
  CITY, CORRIDOR, generateChunk, lotDepthM, LOW_DETAIL_KINDS,
} from '../src/lib/citygen.js';

const args = new Map(process.argv.slice(2).map((a) => {
  const i = a.indexOf('=');
  return i < 0 ? [a.replace(/^--/, ''), 'true'] : [a.slice(0, i).replace(/^--/, ''), a.slice(i + 1)];
}));

const R = Number(args.get('radius') || 5);
const SEEDS = (args.get('seeds') || '1337').split(',').map(Number);

const f1 = (n) => (Number.isFinite(n) ? n.toFixed(1) : '  —  ');
const f2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : '  —  ');
const f3 = (n) => (Number.isFinite(n) ? n.toFixed(3) : '  —  ');
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

/** The solid categories: things a prop cannot stand on OR inside. */
const SOLID = new Set(['building', 'landmark', 'water', 'block']);

/**
 * The union area of a set of boxes, clipped to `clip`. EXACT, by coordinate
 * compression — every distinct x and z edge becomes a lattice line and each
 * cell of the lattice is covered or it is not. n is a few hundred at most, so
 * the n² cell sweep is cheaper than any raster fine enough to be trusted.
 */
function unionAreaM2(boxes, clip) {
  const xs = new Set([clip.x0, clip.x1]);
  const zs = new Set([clip.z0, clip.z1]);
  const kept = [];
  for (const b of boxes) {
    const x0 = Math.max(b.x0, clip.x0);
    const x1 = Math.min(b.x1, clip.x1);
    const z0 = Math.max(b.z0, clip.z0);
    const z1 = Math.min(b.z1, clip.z1);
    if (x1 <= x0 || z1 <= z0) continue;
    kept.push({ x0, x1, z0, z1 });
    xs.add(x0); xs.add(x1); zs.add(z0); zs.add(z1);
  }
  if (!kept.length) return 0;
  const X = [...xs].sort((a, b) => a - b);
  const Z = [...zs].sort((a, b) => a - b);
  let area = 0;
  for (let i = 0; i < X.length - 1; i++) {
    for (let j = 0; j < Z.length - 1; j++) {
      const cx = (X[i] + X[i + 1]) / 2;
      const cz = (Z[j] + Z[j + 1]) / 2;
      for (const b of kept) {
        if (cx > b.x0 && cx < b.x1 && cz > b.z0 && cz < b.z1) {
          area += (X[i + 1] - X[i]) * (Z[j + 1] - Z[j]);
          break;
        }
      }
    }
  }
  return area;
}

const inBox = (x, z, b) => x >= b.x0 && x < b.x1 && z >= b.z0 && z < b.z1;

/** One chunk, reduced to the quantities this file is about. */
function measure(seed, cx, cz) {
  const c = generateChunk(seed, cx, cz);
  const s = CITY.chunkSize;
  const b = { x0: cx * s, x1: (cx + 1) * s, z0: cz * s, z1: (cz + 1) * s };
  const island = {
    x0: b.x0 + CORRIDOR, x1: b.x1 - CORRIDOR,
    z0: b.z0 + CORRIDOR, z1: b.z1 - CORRIDOR,
  };
  const islandM2 = (island.x1 - island.x0) * (island.z1 - island.z0);

  const solids = c.registry.all().filter((q) => SOLID.has(q.kind));
  const solidM2 = unionAreaM2(solids, island);
  const openM2 = Math.max(0, islandM2 - solidM2);

  /** The light well: the square no perimeter building may reach. */
  const d = lotDepthM();
  const well = {
    x0: island.x0 + d, x1: island.x1 - d,
    z0: island.z0 + d, z1: island.z1 - d,
  };
  const wellM2 = Math.max(0, (well.x1 - well.x0) * (well.z1 - well.z0));
  const wellOpenM2 = Math.max(0, wellM2 - unionAreaM2(solids, well));

  const interior = c.props.filter((p) => inBox(p.x, p.z, island));
  const kerbside = c.props.length - interior.length;
  const feats = (c.features || []).filter((p) => inBox(p.x, p.z, island));
  const inWell = interior.filter((p) => inBox(p.x, p.z, well)).length
    + feats.filter((p) => inBox(p.x, p.z, well)).length;

  const vocab = {};
  for (const p of interior) vocab[p.kind] = (vocab[p.kind] || 0) + 1;
  for (const p of feats) vocab[`~${p.kind}`] = (vocab[`~${p.kind}`] || 0) + 1;

  return {
    cx, cz, kind: c.kind, density: c.density, lowDetail: c.lowDetail,
    islandM2, openM2, wellM2, wellOpenM2,
    objects: interior.length + feats.length,
    props: interior.length, features: feats.length, kerbside, inWell,
    asked: c.propsAsked, gaveUp: c.propsGaveUp,
    buildings: c.buildings.length,
    vocab,
  };
}

function region(seed) {
  const out = [];
  for (let cx = -R; cx < R; cx++) for (let cz = -R; cz < R; cz++) out.push(measure(seed, cx, cz));
  return out;
}

const q = (sorted, p) => {
  if (!sorted.length) return NaN;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};

const KINDS = ['built', ...LOW_DETAIL_KINDS];

// ---------------------------------------------------------------------------

const rows = [];
for (const seed of SEEDS) rows.push(...region(seed));

const regionLabel = `${2 * R} x ${2 * R} chunks, seed${SEEDS.length > 1 ? 's' : ''} ${SEEDS.join(',')}`;

if (args.has('vocab')) {
  console.log(`\nWHAT EACH KIND IS ACTUALLY MADE OF — ${regionLabel}`);
  console.log('  ~name is a FEATURE (a park or site fixture); everything else is a prop.\n');
  for (const k of KINDS) {
    const mine = rows.filter((r) => r.kind === k);
    if (!mine.length) continue;
    const tot = {};
    for (const r of mine) for (const [n, v] of Object.entries(r.vocab)) tot[n] = (tot[n] || 0) + v;
    const all = Object.values(tot).reduce((a, v) => a + v, 0);
    const list = Object.entries(tot).sort((a, b) => b[1] - a[1])
      .map(([n, v]) => `${n} ${v} (${(100 * v / all).toFixed(0)}%)`).join('   ');
    console.log(`  ${pad(k, 13)}${mine.length} chunks, ${all} objects`);
    console.log(`      ${list || '— nothing —'}\n`);
  }
}

if (args.has('law')) {
  console.log(`\nTHE PROP-COUNT LAW AS WRITTEN, AND WHAT IT ASKS FOR — ${regionLabel}\n`);
  console.log('  kind          law                            chunks   density med   asked med   asked min/max');
  for (const k of KINDS) {
    const mine = rows.filter((r) => r.kind === k);
    if (!mine.length) continue;
    const law = k === 'park' ? '22 + 26·d'
      : k === 'construction' ? '14 + 16·d'
        : k === 'built' ? '96·d³' : '26·d³';
    const dens = mine.map((r) => r.density).sort((a, b) => a - b);
    const ask = mine.map((r) => r.asked).sort((a, b) => a - b);
    console.log(`  ${pad(k, 13)} ${pad(law, 30)} ${lpad(mine.length, 5)} ${lpad(f3(q(dens, 0.5)), 12)} ${lpad(f1(q(ask, 0.5)), 11)} ${lpad(`${ask[0]}/${ask[ask.length - 1]}`, 14)}`);
  }
  console.log('\n  d is the chunk\'s own density field. A cubic law with no constant term');
  console.log('  delivers an EIGHTH of its objects for half the density; a law with a');
  console.log('  floor delivers the floor whatever the field says.');
  const th = CITY.lowDetailThreshold;
  console.log('\n  AND THE CUBIC LAW AND THE GATE THAT SELECTS THE KIND READ THE SAME FIELD.');
  console.log(`  A chunk is low-detail BECAUSE density < ${f2(th)} — that is what put it there —`);
  console.log(`  so 26·d³ on a parking, lot or yard chunk cannot exceed 26 x ${f2(th)}³ = ${f3(26 * th ** 3)}.`);
  console.log(`  THE CEILING IS ONE OBJECT PER CHUNK, by construction, and it is ZERO below`);
  console.log(`  d = ${f3(Math.cbrt(0.5 / 26))}, where the round goes down. Delivered over this region:`);
  for (const k of ['parking', 'lot', 'yard']) {
    const mine = rows.filter((r) => r.kind === k);
    if (!mine.length) continue;
    const hist = {};
    for (const r of mine) hist[r.asked] = (hist[r.asked] || 0) + 1;
    console.log(`    ${pad(k, 10)} asked ${Object.entries(hist).sort().map(([n, v]) => `${n}x${v}`).join('  ')}`
      + `   d max ${f3(Math.max(...mine.map((r) => r.density)))}`);
  }
  console.log();
}

if (args.has('interiors')) {
  const built = rows.filter((r) => r.kind === 'built');
  const wellOpen = built.map((r) => r.wellOpenM2).sort((a, b) => a - b);
  const inWell = built.map((r) => r.inWell).sort((a, b) => a - b);
  const perHa = built.filter((r) => r.wellOpenM2 > 0)
    .map((r) => r.inWell / (r.wellOpenM2 / 10000)).sort((a, b) => a - b);
  console.log(`\nTHE BLOCK INTERIOR — THE LIGHT WELL NO BUILDING MAY REACH — ${regionLabel}\n`);
  console.log(`  lotDepthM() ${f1(lotDepthM())} m into a ${f1((CITY.chunkSize - 2 * CORRIDOR) / 2)} m half-block,`);
  console.log(`  so the well is ${f1(CITY.chunkSize - 2 * CORRIDOR - 2 * lotDepthM())} m square = ${f1(built[0].wellM2)} m² per built chunk.\n`);
  console.log(`  built chunks                      ${built.length}`);
  console.log(`  well ground still open, median    ${f1(q(wellOpen, 0.5))} m²   (${f1(100 * q(wellOpen, 0.5) / built[0].wellM2)}% of the well)`);
  console.log(`  objects standing in the well      total ${inWell.reduce((a, v) => a + v, 0)}, median ${f1(q(inWell, 0.5))}, max ${inWell[inWell.length - 1]}`);
  console.log(`  chunks with an EMPTY well         ${inWell.filter((v) => v === 0).length} of ${built.length}`);
  console.log(`  objects per hectare of open well  median ${f1(q(perHa, 0.5))}   p90 ${f1(q(perHa, 0.9))}\n`);
}

// The main table, always printed last so it is what a reader ends on.
console.log(`\nOBJECTS PER HECTARE OF OPEN GROUND, BY BLOCK KIND — ${regionLabel}`);
console.log('  open ground = the 104.6 m island minus the union of every building,');
console.log('  landmark, water and block claim standing on it. Exact, not sampled.\n');
console.log('  kind          chunks   open ha       objects        per hectare of open ground');
console.log('                          median    props feats   min   p25   med   p75   p90   max   zero');
for (const k of KINDS) {
  const mine = rows.filter((r) => r.kind === k);
  if (!mine.length) continue;
  const openHa = mine.map((r) => r.openM2 / 10000).sort((a, b) => a - b);
  const live = mine.filter((r) => r.openM2 > 1);
  const per = live.map((r) => r.objects / (r.openM2 / 10000)).sort((a, b) => a - b);
  const zero = mine.filter((r) => r.objects === 0).length;
  console.log(
    `  ${pad(k, 13)} ${lpad(mine.length, 4)} ${lpad(f3(q(openHa, 0.5)), 9)}`
    + ` ${lpad(mine.reduce((a, r) => a + r.props, 0), 8)} ${lpad(mine.reduce((a, r) => a + r.features, 0), 5)}`
    + ` ${lpad(f1(per[0]), 5)} ${lpad(f1(q(per, 0.25)), 5)} ${lpad(f1(q(per, 0.5)), 5)}`
    + ` ${lpad(f1(q(per, 0.75)), 5)} ${lpad(f1(q(per, 0.9)), 5)} ${lpad(f1(per[per.length - 1]), 5)}`
    + ` ${lpad(`${zero}/${mine.length}`, 6)}`,
  );
}
const all = rows.filter((r) => r.openM2 > 1);
const allPer = all.map((r) => r.objects / (r.openM2 / 10000)).sort((a, b) => a - b);
console.log(`  ${pad('ALL', 13)} ${lpad(rows.length, 4)} ${lpad('', 9)}`
  + ` ${lpad(rows.reduce((a, r) => a + r.props, 0), 8)} ${lpad(rows.reduce((a, r) => a + r.features, 0), 5)}`
  + ` ${lpad(f1(allPer[0]), 5)} ${lpad(f1(q(allPer, 0.25)), 5)} ${lpad(f1(q(allPer, 0.5)), 5)}`
  + ` ${lpad(f1(q(allPer, 0.75)), 5)} ${lpad(f1(q(allPer, 0.9)), 5)} ${lpad(f1(allPer[allPer.length - 1]), 5)}`
  + ` ${lpad(`${rows.filter((r) => r.objects === 0).length}/${rows.length}`, 6)}`);
console.log(`\n  kerbside props (outside the island, on the pavement): ${rows.reduce((a, r) => a + r.kerbside, 0)}`);
console.log(`  props asked for and given up: ${rows.reduce((a, r) => a + r.gaveUp, 0)} of ${rows.reduce((a, r) => a + r.asked, 0)}\n`);
