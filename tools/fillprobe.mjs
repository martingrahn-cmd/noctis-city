#!/usr/bin/env node
/**
 * fillprobe.mjs — HOW MUCH OF EACH BLOCK FRONTAGE CARRIES A BUILDING.
 * NOT A GATE, and it must never become one. SESSION 36.
 *
 *   node tools/fillprobe.mjs
 *   node tools/fillprobe.mjs --sweep
 *   node tools/fillprobe.mjs --sweep --powers=1.4,1.0,0.6
 *   node tools/fillprobe.mjs --power=0.8         one arm, in full
 *
 * WHY IT EXISTS.
 *
 * `tools/depthprobe.mjs` measures the OTHER knob. LOOK.md §2 says island
 * coverage is depth times frontage and that the two multiply; session 35 raised
 * depth to 0.73 of its derived ring and left coverage at 28.1% against a 95.0%
 * full-ring reference, because frontage occupancy stands at 0.244.
 *
 * The frontage numbers this project quotes — *"median block frontage occupancy
 * 0.162 before the raise and 0.244 after, with 148 of 400 block sides still
 * bare end to end"* — come from a session-32 throwaway that is not in the
 * repository. LOOK.md §8: a number with no instrument behind it cannot be
 * checked and therefore cannot be wrong. So the numbers are re-derived here,
 * with the population written down, and the sweep is a first-class argument
 * rather than an edit to the generator.
 *
 * WHAT A SIDE'S OCCUPANCY IS, AND WHY IT IS A UNION.
 *
 * A block side is one island edge, 104.6 m of frontage. Its occupancy is the
 * length of that edge standing behind a building, as the UNION of the
 * buildings' projections onto it — not the sum of their widths. Two buildings
 * that overlap in projection are a wall with a bulge, not 1.3 walls, and at the
 * fills this session is sweeping they do overlap: a corner building on side one
 * projects onto side three's run as well.
 *
 * WHICH SIDE A BUILDING FRONTS IS `bld.facing`, NOT ITS POSITION. `facing` is
 * `z−`/`z+` for a building on a side running along x and `x−`/`x+` for one on a
 * side running along z — the same reading `depthprobe.perpendicular` makes, and
 * for the same reason: `bld.width` and `bld.depth` are WORLD-AXIS extents and
 * reading one of them as "the frontage" gets half the city backwards (CONTRACT
 * §9's table with two lengths, STATE 35 §1.1).
 *
 * THE RIVER-BANK TERRACE IS NOT ON A BLOCK SIDE and is excluded from the
 * occupancy statistic, exactly as `depthprobe` excludes it from the depth one:
 * its lot line is the water. It is counted separately, because the quay walk
 * has a fill law of its own and this instrument is the only place the two can
 * be seen together.
 *
 * IT ASSERTS NOTHING AND IT MUST NOT. `citycheck` owns the verdicts.
 */

import {
  CITY, CORRIDOR, generateChunk, chunkBounds, FRONTAGE_FILL, frontageFill,
  DEPTH_DISTRIBUTION, densityAt,
} from '../src/lib/citygen.js';

const args = new Map(process.argv.slice(2).map((a) => {
  const [k, v = 'true'] = a.replace(/^--/, '').split('=');
  return [k, v];
}));

/** The same region `citycheck` and `depthprobe` report over: 10 × 10 chunks. */
const R = Number(args.get('radius') || 5);
const SEED = args.get('seed') || '1337';
/** Raster cell, metres. The coverage figure is a union area and so is a raster. */
const CELL = Number(args.get('cells') || 0.5);
const ISLAND = CITY.chunkSize - 2 * CORRIDOR;

const pct = (n, d) => (d ? (100 * n) / d : 0);
const q = (sorted, p) => {
  if (!sorted.length) return NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[i];
};

/** Union length of a set of [lo,hi] intervals clipped to [from,to]. */
function unionLength(spans, from, to) {
  const s = spans
    .map(([a, b]) => [Math.max(from, Math.min(a, b)), Math.min(to, Math.max(a, b))])
    .filter(([a, b]) => b > a)
    .sort((p, r) => p[0] - r[0]);
  let total = 0;
  let cur = null;
  for (const [a, b] of s) {
    if (!cur || a > cur[1]) { if (cur) total += cur[1] - cur[0]; cur = [a, b]; continue; }
    cur[1] = Math.max(cur[1], b);
  }
  if (cur) total += cur[1] - cur[0];
  return total;
}

/**
 * ONE ARM. Everything a change to the fill law can move without saying so, over
 * the whole region, read off `generateChunk` rather than predicted.
 */
function arm(power, quayPower, seed = SEED) {
  const was = FRONTAGE_FILL.power;
  const wasQ = FRONTAGE_FILL.quayPower;
  if (power != null) FRONTAGE_FILL.power = power;
  if (quayPower != null) FRONTAGE_FILL.quayPower = quayPower;

  let buildings = 0; let quay = 0; let props = 0; let gaveUp = 0; let signs = 0;
  let chunksWithBuildings = 0; let builtChunks = 0;
  let islandCells = 0; let coveredCells = 0;
  let popIslandCells = 0; let popCoveredCells = 0;
  const counts = [];
  const refused = {};
  const clipped = {};
  let clipM = 0;
  /** Per-side occupancy over every island edge in the region, and the bare ones. */
  const sideOcc = [];
  let bareSides = 0;
  /**
   * THE SAME QUANTITY PER BLOCK RATHER THAN PER SIDE, and a third arm that sums
   * widths instead of unioning them. Session 32 reports *"median block frontage
   * occupancy 0.162 before the raise and 0.244 after"* with no instrument and
   * no population, and "block" and "side" are not the same denominator. All
   * three are printed so that the figure this file quotes can be attributed to
   * one of them rather than argued about (LOOK.md §8).
   */
  const blockOcc = [];
  const sideOccSum = [];
  /** Chunks carrying no building at all, by chunk kind — LOOK.md §2's list. */
  const emptyByKind = new Map();
  const kindChunks = new Map();
  /**
   * PER-`built`-CHUNK COVERAGE AND THE CHUNK'S OWN DENSITY — SESSION 37, and it
   * is the only column in this file that measures LOOK.md §2's LAST bullet
   * rather than its first. "Density has causes" is a claim that a sparse block
   * and a dense block look different, and until now this project had no number
   * for it at all — every figure here says how MUCH city there is, none said
   * whether it varies. See `districtContrast` below.
   */
  const perChunk = [];

  for (let cx = -R; cx < R; cx++) {
    for (let cz = -R; cz < R; cz++) {
      const c = generateChunk(seed, cx, cz);
      const b = chunkBounds(cx, cz);
      const island = {
        x0: b.x0 + CORRIDOR, x1: b.x1 - CORRIDOR, z0: b.z0 + CORRIDOR, z1: b.z1 - CORRIDOR,
      };
      if (c.kind === 'built') builtChunks++;
      kindChunks.set(c.kind, (kindChunks.get(c.kind) || 0) + 1);
      if (!c.buildings.length) emptyByKind.set(c.kind, (emptyByKind.get(c.kind) || 0) + 1);
      else chunksWithBuildings++;

      /**
       * The quay terrace off the GENERATOR'S OWN LABEL — the registry's `quay:`
       * owner — and not off a geometric guess about which lot line a building
       * stands on. `depthprobe --sweep` counts it the same way.
       */
      const quayHere = new Set(
        c.registry.all()
          .filter((cl) => cl.kind === 'building' && String(cl.owner).startsWith('quay:'))
          .map((cl) => `${cl.x0.toFixed(3)},${cl.z0.toFixed(3)}`)
      );
      quay += quayHere.size;
      buildings += c.buildings.length;
      props += c.props.length;
      gaveUp += c.propsGaveUp;
      signs += c.signs.length;
      counts.push(c.objectCount);
      for (const [k, v] of Object.entries(c.refused)) refused[k] = (refused[k] || 0) + v;
      for (const [k, v] of Object.entries(c.clipped || {})) {
        clipped[k] = (clipped[k] || 0) + v.n;
        clipM += v.lostM;
      }

      /** Frontage occupancy, one entry per island edge, four per chunk. */
      const sides = [
        ['z-', 'x', island.x0, island.x1],
        ['z+', 'x', island.x0, island.x1],
        ['x-', 'z', island.z0, island.z1],
        ['x+', 'z', island.z0, island.z1],
      ];
      let blockBuilt = 0;
      let blockRun = 0;
      for (const [facing, axis, from, to] of sides) {
        const spans = [];
        for (const bld of c.buildings) {
          if (bld.facing !== facing) continue;
          const half = (axis === 'x' ? bld.width : bld.depth) / 2;
          const centre = axis === 'x' ? bld.x : bld.z;
          spans.push([centre - half, centre + half]);
        }
        const built = unionLength(spans, from, to);
        const summed = spans.reduce((t, [lo, hi]) => t + Math.min(to, hi) - Math.max(from, lo), 0);
        sideOcc.push(built / (to - from));
        sideOccSum.push(Math.max(0, summed) / (to - from));
        blockBuilt += built;
        blockRun += to - from;
        if (!spans.length) bareSides++;
      }
      blockOcc.push(blockRun ? blockBuilt / blockRun : 0);
      const chunkDensity = densityAt(seed, (b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);

      /** Island coverage: the UNION area of building claims over the island. */
      const claims = c.registry.all().filter((cl) => cl.kind === 'building');
      const nx = Math.round((island.x1 - island.x0) / CELL);
      const nz = Math.round((island.z1 - island.z0) / CELL);
      let chunkCells = 0;
      let chunkCovered = 0;
      for (let ix = 0; ix < nx; ix++) {
        const x = island.x0 + (ix + 0.5) * CELL;
        const row = claims.filter((cl) => x >= cl.x0 && x <= cl.x1);
        for (let iz = 0; iz < nz; iz++) {
          const z = island.z0 + (iz + 0.5) * CELL;
          islandCells++;
          if (c.buildings.length) popIslandCells++;
          let built = false;
          for (const cl of row) { if (z >= cl.z0 && z <= cl.z1) { built = true; break; } }
          if (built) {
            coveredCells++;
            if (c.buildings.length) popCoveredCells++;
            if (c.kind === 'built') chunkCovered++;
          }
          if (c.kind === 'built') chunkCells++;
        }
      }
      if (c.kind === 'built' && chunkCells) {
        perChunk.push({ d: chunkDensity, cov: chunkCovered / chunkCells });
      }
    }
  }

  FRONTAGE_FILL.power = was;
  FRONTAGE_FILL.quayPower = wasQ;

  sideOcc.sort((a, b) => a - b);
  sideOccSum.sort((a, b) => a - b);
  blockOcc.sort((a, b) => a - b);
  const m = counts.reduce((a, v) => a + v, 0) / counts.length;
  const objCV = Math.sqrt(counts.reduce((a, v) => a + (v - m) ** 2, 0) / counts.length) / m;
  /**
   * DISTRICT CONTRAST — the median delivered island coverage of the DENSEST
   * quarter of `built` chunks over that of the SPARSEST quarter, both ranked by
   * the chunk's own `densityAt`. 1.00 means a sparse block and a dense block are
   * the same block, which is the state `fill = 1.0` delivers by construction.
   *
   * IT IS NOT A THRESHOLD AND MUST NOT BECOME ONE — this file asserts nothing.
   * It is here because session 37 chose a fill law by looking at aerial frames,
   * and this is the quantity those frames were being read for.
   */
  perChunk.sort((a, b) => a.d - b.d);
  const k = Math.floor(perChunk.length / 4);
  const covQ1 = perChunk.slice(0, k).map((r) => r.cov).sort((a, b) => a - b);
  const covQ4 = perChunk.slice(perChunk.length - k).map((r) => r.cov).sort((a, b) => a - b);
  const mQ1 = q(covQ1, 0.5);
  const mQ4 = q(covQ4, 0.5);
  return {
    perChunk,
    builtChunkSample: perChunk.length, covQ1: mQ1, covQ4: mQ4,
    districtContrast: mQ1 > 0 ? mQ4 / mQ1 : NaN,
    power, quayPower, buildings, quay, props, gaveUp, signs, objCV,
    chunksWithBuildings, builtChunks, refused, clipped, clipM,
    coverAll: pct(coveredCells, islandCells),
    coverPop: pct(popCoveredCells, popIslandCells),
    occMed: q(sideOcc, 0.5), occMean: sideOcc.reduce((a, v) => a + v, 0) / sideOcc.length,
    occP90: q(sideOcc, 0.9), bareSides, sides: sideOcc.length,
    occSumMed: q(sideOccSum, 0.5),
    blockMed: q(blockOcc, 0.5), blockMean: blockOcc.reduce((a, v) => a + v, 0) / blockOcc.length,
    blockMedBuilt: q(blockOcc.filter((v) => v > 0), 0.5),
    emptyByKind, kindChunks,
    cellArea: CELL * CELL, coveredCells, islandCells,
  };
}

const fmt = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' ');

/**
 * THE DEPTH LAW AS AN ARM, so that "depth and fill multiply" can be MEASURED
 * rather than asserted. `--depth=band` restores session 34's `rng.range(15, 26)`
 * with no corner clip — the city session 32 swept its fill over.
 */
if (args.get('depth') === 'band') Object.assign(DEPTH_DISTRIBUTION, { mode: 'band', clip: false });

/**
 * `--districts` — LOOK.md §2's LAST BULLET, WHICH HAS NEVER HAD A NUMBER.
 *
 *   node tools/fillprobe.mjs --districts
 *   node tools/fillprobe.mjs --districts --seeds=1337,1338,1339 --powers=1.4,0.5
 *
 * *"Density has causes... a city generated from noise looks generated however
 * dense it is."* Every other column in this file says how MUCH city there is.
 * This one says whether it VARIES: the median delivered island coverage of the
 * densest quarter of `built` chunks over that of the sparsest quarter.
 *
 * POOLED OVER SEEDS BY CONCATENATION, not by averaging twelve ratios. The
 * quantity is a property of the GENERATOR and each region is a sample of it, so
 * the quartiles are taken over the pooled population of chunks — which is also
 * the only way the sparse quarter has enough chunks in it to have a median that
 * means anything. Twelve regions is 963 `built` chunks; one is 83.
 *
 * IT ASSERTS NOTHING. `citycheck` owns the verdicts, and this number is a
 * description of a choice rather than a bound on one.
 */
if (args.has('districts')) {
  const powers = (args.get('powers') || '1.4,1.1,0.9,0.7,0.5,0.3,0.15,0.0')
    .split(',').map(Number);
  const seeds = (args.get('seeds') || SEED).split(',');
  console.log(`fillprobe --districts — ${seeds.length} region(s) of ${2 * R} x ${2 * R} chunks, seeds ${seeds.join(',')}`);
  console.log('  delivered island coverage of the `built` chunks, split at the quartiles of the');
  console.log('  chunk\'s own densityAt. CONTRAST 1.00 = a sparse block and a dense block are the');
  console.log('  same block, which is what fill = 1.0 delivers by construction.\n');
  console.log('  power   built chunks   cov Q1 sparse   cov Q4 dense   CONTRAST');
  for (const p of powers) {
    const pooled = [];
    for (const sd of seeds) pooled.push(...arm(p, null, sd).perChunk);
    pooled.sort((a, b) => a.d - b.d);
    const k = Math.floor(pooled.length / 4);
    const c1 = q(pooled.slice(0, k).map((r) => r.cov).sort((a, b) => a - b), 0.5);
    const c4 = q(pooled.slice(pooled.length - k).map((r) => r.cov).sort((a, b) => a - b), 0.5);
    console.log(
      `  ${p.toFixed(2).padStart(5)}      ${String(pooled.length).padStart(6)}        ` +
      `${(100 * c1).toFixed(1).padStart(5)}%          ${(100 * c4).toFixed(1).padStart(5)}%       ` +
      `${(c4 / c1).toFixed(2)}x`
    );
  }
  process.exit(0);
}

if (args.has('sweep')) {
  const powers = (args.get('powers') || '1.4,1.2,1.0,0.8,0.6,0.4,0.2,0.0')
    .split(',').map(Number);
  /**
   * MORE THAN ONE SEED, BECAUSE `objCV` IS THE COLUMN A DECISION GETS MADE ON
   * AND IT IS ONE DRAW.
   *
   * `citycheck`'s clumping floor is 0.60 and the delivered margin is hundredths.
   * Read at seed 1337 alone this column moves NON-MONOTONICALLY with the power
   * — 1.40 reads 0.626, 1.35 reads 0.630, 1.20 reads 0.621 and 1.10 reads 0.626
   * on a strictly increasing building count — so a choice between two adjacent
   * arms made on that column alone is CONTRACT §0 rule 6's own failure: a
   * decision on a difference smaller than the instrument's spread. `--seeds`
   * runs the same arm over several regions and prints the WORST, because a
   * floor's worst case is the run that is worst FOR IT (CONTRACT §0.1's
   * counts-are-pooled-worst-case corollary). The gate itself runs at 1337, so
   * 1337 is printed as well and never averaged away.
   */
  const seeds = (args.get('seeds') || SEED).split(',');
  console.log(`fillprobe --sweep — seed ${SEED}, ${2 * R} x ${2 * R} chunks, raster ${CELL} m`);
  console.log('  fill = 0.12 + 0.88 · density^power, the island perimeter only; the quay keeps its own\n');
  console.log('  power   fill@.3  fill@.7   bldgs  quay   cover%  cover%pop   occSide  occBlk  bare/400   props  gaveUp   objCV  contrast   refused');
  for (const p of powers) {
    const a = arm(p, null);
    if (seeds.length > 1) {
      const cvs = seeds.map((sd) => ({ sd, cv: arm(p, null, sd).objCV }));
      const worst = cvs.reduce((x, y) => (y.cv < x.cv ? y : x));
      const mn = cvs.reduce((t, v) => t + v.cv, 0) / cvs.length;
      a.seedNote = `  objCV over ${cvs.length} seeds: worst ${worst.cv.toFixed(3)} (seed ${worst.sd}), mean ${mn.toFixed(3)}, spread ${(Math.max(...cvs.map((v) => v.cv)) - worst.cv).toFixed(3)}`;
    }
    console.log(
      `  ${p.toFixed(2).padStart(5)}   ${frontageFill(0.3, p).toFixed(3)}    ${frontageFill(0.7, p).toFixed(3)}   ` +
      `${String(a.buildings).padStart(5)}  ${String(a.quay).padStart(4)}   ${a.coverAll.toFixed(1).padStart(5)}%   ` +
      `${a.coverPop.toFixed(1).padStart(6)}%     ${a.occMed.toFixed(3)}   ${a.blockMed.toFixed(3)}   ` +
      `${String(a.bareSides).padStart(3)}/400   ${String(a.props).padStart(5)}  ${String(a.gaveUp).padStart(5)}   ` +
      `${a.objCV.toFixed(3)}   ${a.districtContrast.toFixed(2)}x   ${fmt(a.refused)}`
    );
    if (a.seedNote) console.log(a.seedNote);
  }
  console.log('\n  cover% is the UNION area of building claims over the islands, rastered at');
  console.log(`  ${CELL} m — comparable with depthprobe's headline and NOT with its --sweep column,`);
  console.log('  which is a sum of footprints. cover%pop is over the chunks carrying a building.');
  console.log('  objCV is buildings+props+signs per chunk — the quantity `citycheck`\'s clumping');
  console.log('  floor of 0.60 is computed from. It is the knob\'s price and not a side effect.');
  process.exit(0);
}

const p = args.has('power') ? Number(args.get('power')) : null;
const qp = args.has('quayPower') ? Number(args.get('quayPower')) : null;
const a = arm(p, qp);

console.log(`fillprobe — seed ${SEED}, ${2 * R} x ${2 * R} chunks, raster ${CELL} m`);
console.log(`  fill = ${FRONTAGE_FILL.atZero} + ${(FRONTAGE_FILL.atOne - FRONTAGE_FILL.atZero).toFixed(2)} · density^${a.power ?? FRONTAGE_FILL.power}   perimeter`);
console.log(`  quay                              density^${a.quayPower ?? FRONTAGE_FILL.quayPower}`);
console.log(`  island ${ISLAND.toFixed(1)} m square, ${a.sides} block sides over ${4 * R * R} chunks\n`);
console.log(`  buildings ${a.buildings}   of which river bank ${a.quay}   props ${a.props} (gave up ${a.gaveUp})   signs ${a.signs}`);
console.log(`  chunks of kind 'built' ${a.builtChunks}   carrying at least one building ${a.chunksWithBuildings}`);
console.log(`  objectCount CV ${a.objCV.toFixed(3)}   registry refusals  ${fmt(a.refused) || 'none'}`);
console.log(`  depth clipped at corners ${Math.round(a.clipM)} m  ${fmt(a.clipped) || ''}\n`);

console.log('  FRONTAGE OCCUPANCY — union of building projections onto the island edges');
console.log(`    per SIDE,  ${a.sides} of them    median ${a.occMed.toFixed(3)}   mean ${a.occMean.toFixed(3)}   p90 ${a.occP90.toFixed(3)}`);
console.log(`    per BLOCK, ${4 * R * R} of them    median ${a.blockMed.toFixed(3)}   mean ${a.blockMean.toFixed(3)}   median over the ${a.chunksWithBuildings} built ${a.blockMedBuilt.toFixed(3)}`);
console.log(`    ARM: widths SUMMED rather than unioned, per side   median ${a.occSumMed.toFixed(3)}`);
console.log(`    bare end to end  ${a.bareSides} of ${a.sides} sides  (${pct(a.bareSides, a.sides).toFixed(1)}%)\n`);

console.log(`  DISTRICT CONTRAST — LOOK.md §2's "density has causes", over the ${a.builtChunkSample} 'built' chunks`);
console.log(`    sparsest quarter by densityAt  ${(100 * a.covQ1).toFixed(1)}% covered`);
console.log(`    densest quarter                ${(100 * a.covQ4).toFixed(1)}% covered`);
console.log(`    CONTRAST                       ${a.districtContrast.toFixed(2)}x   (1.00x = no districts at all)`);
console.log('    One region is a small sample of this; `--districts --seeds=` pools it.\n');

console.log('  ISLAND COVERAGE — union area of building claims');
console.log(`    over all ${4 * R * R} islands                  ${a.coverAll.toFixed(1)}%   (${(a.coveredCells * a.cellArea / 1e3).toFixed(1)} of ${(a.islandCells * a.cellArea / 1e3).toFixed(1)} thousand m2)`);
console.log(`    over the ${a.chunksWithBuildings} that carry a building   ${a.coverPop.toFixed(1)}%\n`);

console.log('  CHUNKS CARRYING NO BUILDING, BY KIND — LOOK.md §2 asks that these be empty');
console.log('  for a reason, and the reason is the kind. The perimeter walk runs only where');
console.log('  `lowDetail` is false, so no fill law can reach a park, a yard, a lot, a car');
console.log('  park or a building site: they have no perimeter walk at all.');
console.log('    kind            chunks in region    of them, empty');
for (const [k, n] of [...a.kindChunks.entries()].sort((x, y) => y[1] - x[1])) {
  console.log(`    ${k.padEnd(14)}  ${String(n).padStart(9)}         ${String(a.emptyByKind.get(k) || 0).padStart(9)}`);
}
