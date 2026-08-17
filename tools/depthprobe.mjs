#!/usr/bin/env node
/**
 * depthprobe.mjs — HOW DEEP THE BUILDINGS GO, AND WHAT IS BEHIND THEM.
 * NOT A GATE, and it must never become one. SESSION 35.
 *
 *   node tools/depthprobe.mjs
 *   node tools/depthprobe.mjs --radius=5 --seed=1337
 *   node tools/depthprobe.mjs --cells=0.5        raster cell for the coverage
 *
 * WHY IT EXISTS.
 *
 * STATE 33 §6 measured the block interiors and reported three numbers —
 * median depth 19.4 m into a 52.3 m half-block, 0.0% built past 31 m, and
 * 20.8% island coverage against 96.3% for a lower Manhattan ring. Those three
 * numbers are the whole argument for session 35's building item, and they were
 * produced by a throwaway script that is not in the repository. A number with
 * no instrument behind it cannot be checked and therefore cannot be wrong,
 * which is the property LOOK.md §8 says a figure quoted in that file must
 * never have. So the first thing this session does is build the instrument.
 *
 * AND IT ANSWERS THE SECOND QUESTION, WHICH IS THE ONE THAT DECIDES THE SHAPE
 * OF THE CHANGE: what is in the block interiors NOW. Deepening a building
 * takes interior land, and the registry (`src/lib/occupancy.js`) is the one
 * authority on what is already standing there. A park's pond, a construction
 * site's hoarding, a yard's containers and a landmark's keep-out are all
 * interior land that is occupied for a reason; a courtyard with three bollards
 * in it is not. Those two cases need different answers and a coverage
 * percentage cannot tell them apart.
 *
 * HOW THE COVERAGE IS MEASURED, AND WHY IT IS A RASTER.
 *
 * Summing footprint areas double-counts every overlap, and buildings on two
 * frontages of a narrow island DO overlap in the limit this session is aiming
 * at — that is the whole point of a solid perimeter. So coverage is the area
 * of the UNION, rasterised at `--cells` metres over each chunk's own island.
 * The same raster answers the interior question, because a cell can be labelled
 * by every registry claim that covers it rather than only by the first.
 *
 * THE DEPTH IS MEASURED PERPENDICULAR TO THE FRONTAGE, NOT AS `bld.depth`.
 * `bld.width` and `bld.depth` are WORLD-AXIS extents: for a building on a side
 * running along x the into-island extent is `bld.depth`, and for one on a side
 * running along z it is `bld.width`. `bld.facing` is what says which — it is
 * `z±` for the first and `x±` for the second. Reading `bld.depth` for all of
 * them would report the frontage width of half the city as its depth, which is
 * CONTRACT §9's table with two lengths.
 *
 * IT ASSERTS NOTHING AND IT MUST NOT. `citycheck` owns the verdicts about the
 * city; this is the instrument the verdicts' numbers come from, the same
 * arrangement `clustercheck` has with `perfcheck`.
 */

import {
  CITY, CORRIDOR, generateChunk, chunkBounds, DEPTH_DISTRIBUTION, lotDepthM,
} from '../src/lib/citygen.js';

const args = new Map(process.argv.slice(2).map((a) => {
  const [k, v = 'true'] = a.replace(/^--/, '').split('=');
  return [k, v];
}));

/** The same region `citycheck` reports over: a 10 × 10 chunk block. */
const R = Number(args.get('radius') || 5);
const SEED = args.get('seed') || '1337';
/** Raster cell, metres. 0.5 m over 100 chunks is 4.4 M cells and runs in seconds. */
const CELL = Number(args.get('cells') || 0.5);
const ISLAND = CITY.chunkSize - 2 * CORRIDOR;
const HALF = ISLAND / 2;

const pct = (n, d) => (d ? (100 * n) / d : 0);
const q = (sorted, p) => {
  if (!sorted.length) return NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[i];
};

/**
 * The into-island extent of a building, and where its near face stands relative
 * to the island edge it faces.
 *
 * WHICH EXTENT IS THE DEPTH IS DECIDED BY `facing`, NOT BY THE FIELD NAME.
 * `bld.width` and `bld.depth` are WORLD-AXIS extents. A building whose frontage
 * runs along x has `facing` `z±` and its into-island extent is `bld.depth`; one
 * whose frontage runs along z has `facing` `x±` and its into-island extent is
 * `bld.width`. Reading `bld.depth` for both reports the FRONTAGE WIDTH of half
 * the city as its depth — see the `$asShipped_bldDepth` arm below, which is
 * what that mistake measures.
 *
 * `standoff` IS WHAT SEPARATES THE TWO POPULATIONS. A perimeter building's near
 * face sits ON the island edge (`cxb`/`czb` are `side.at − side.out·depth/2`),
 * so its standoff is 0 to within a float. The river-bank walk places its
 * terrace against the WATER, which meanders, so a quay building's standoff is
 * whatever the bank happens to be — up to the width of the island. Its lot line
 * is the river and not the island edge, so its reach is not comparable and is
 * reported separately rather than pooled.
 */
function perpendicular(bld, island) {
  const alongZ = bld.facing[0] === 'z';
  const into = alongZ ? bld.depth : bld.width;
  const c = alongZ ? bld.z : bld.x;
  const lot = alongZ
    ? (bld.facing === 'z-' ? island.z0 : island.z1)
    : (bld.facing === 'x-' ? island.x0 : island.x1);
  const inward = bld.facing === 'z-' || bld.facing === 'x-' ? 1 : -1;
  const near = (c - inward * into / 2 - lot) * inward;
  return { into, near, far: near + into };
}

/**
 * THE SWEEP — one arm per depth law, through the SAME generator.
 *
 * The quantities are the ones a change to depth can move without saying so:
 * the building count (`perfcheck`'s `floors.visibleInstances` floor reads it),
 * the props the scatter gave up (fewer props is a smaller `objectCount`, which
 * is what `citycheck`'s clumping CV is computed from and that floor has 0.032
 * of margin), and the quay terrace, which is the population a deep island
 * frontage takes land from.
 */
if (args.has('sweep')) {
  const arms = [
    ['AS SHIPPED s34: band, no clip', { mode: 'band', clip: false }],
    ['band, clip', { mode: 'band', clip: true }],
    ['lot, NO clip', { mode: 'lot', clip: false }],
    ['lot, clip   <- ships', { mode: 'lot', clip: true }],
    ['lot, clip, deepPower 1.4', { mode: 'lot', clip: true, deepPower: 1.4 }],
    ['lot, clip, deepPower 0.7', { mode: 'lot', clip: true, deepPower: 0.7 }],
    ['lot, clip, yard 2·CORRIDOR', { mode: 'lot', clip: true, deepYardCorridors: 2 }],
    ['lot, clip, yard 0', { mode: 'lot', clip: true, deepYardCorridors: 0 }],
    ['lot, clip, core 3·CORRIDOR', { mode: 'lot', clip: true, coreCorridors: 3 }],
    ['lot, clip, core 1·CORRIDOR', { mode: 'lot', clip: true, coreCorridors: 1 }],
  ];
  const was = { ...DEPTH_DISTRIBUTION };
  console.log(`depthprobe --sweep — seed ${SEED}, ${2 * R} x ${2 * R} chunks, island ${ISLAND.toFixed(1)} m\n`);
  console.log('  arm                          bldgs   quay   medDepth   cover%   props   gaveUp   objCV   refused  clipped(m)');
  for (const [label, over] of arms) {
    Object.assign(DEPTH_DISTRIBUTION, was, over);
    const d = [];
    let n = 0; let qy = 0; let props = 0; let gaveUp = 0;
    let area = 0;
    const counts = [];
    const ref = {};
    const clp = {};
    let clipM = 0;
    for (let cx = -R; cx < R; cx++) {
      for (let cz = -R; cz < R; cz++) {
        const c = generateChunk(SEED, cx, cz);
        const b = chunkBounds(cx, cz);
        const island = { x0: b.x0 + CORRIDOR, x1: b.x1 - CORRIDOR, z0: b.z0 + CORRIDOR, z1: b.z1 - CORRIDOR };
        /**
         * The quay terrace counted off the GENERATOR'S OWN LABEL — the
         * registry's `quay:` owner — rather than off a geometric guess about
         * which lot line a building stands on. It is the population a deep
         * island frontage takes land from, so it is the one number in this
         * table that must not be a heuristic.
         */
        qy += c.registry.all().filter((cl) => cl.kind === 'building' && String(cl.owner).startsWith('quay:')).length;
        for (const bld of c.buildings) {
          n++;
          const p = perpendicular(bld, island);
          if (Math.abs(p.near) > 0.5) continue;
          d.push(p.into);
          area += bld.width * bld.depth;
        }
        props += c.props.length;
        gaveUp += c.propsGaveUp;
        counts.push(c.objectCount);
        for (const [k, v] of Object.entries(c.refused)) ref[k] = (ref[k] || 0) + v;
        for (const [k, v] of Object.entries(c.clipped || {})) {
          clp[k] = (clp[k] || 0) + v.n;
          clipM += v.lostM;
        }
      }
    }
    d.sort((a, b) => a - b);
    const m = counts.reduce((a, v) => a + v, 0) / counts.length;
    const cv = Math.sqrt(counts.reduce((a, v) => a + (v - m) ** 2, 0) / counts.length) / m;
    const fmt = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' ');
    console.log(
      `  ${label.padEnd(27)} ${String(n).padStart(5)}  ${String(qy).padStart(5)}   ${q(d, 0.5).toFixed(1).padStart(6)}   ` +
      `${pct(area, 100 * ISLAND * ISLAND).toFixed(1).padStart(6)}   ${String(props).padStart(5)}   ${String(gaveUp).padStart(6)}   ` +
      `${cv.toFixed(3)}   ${fmt(ref).padEnd(24)} ${Math.round(clipM)} ${fmt(clp)}`
    );
  }
  Object.assign(DEPTH_DISTRIBUTION, was);
  console.log('\n  cover% is the SUM of footprint areas over the 100 islands, not the union —');
  console.log('  a sweep column, comparable across arms, and larger than the union figure the');
  console.log('  main report prints wherever two footprints meet.');
  process.exit(0);
}

const depths = [];
const reaches = [];
const fractions = [];
/** The arm: `bld.depth` read for every building, which is what STATE 33 reports. */
const shipped = [];
const quayDepths = [];
let quay = 0;
let builtChunks = 0;
let chunksWithBuildings = 0;
let buildings = 0;
/** Building-covered cells and island cells restricted to chunks that carry buildings. */
let popIslandCells = 0;
let popCoveredCells = 0;
/** Depth-band histogram: metres from the lot line, in 4 m bands, over BUILT chunks. */
const BANDS = 14;
const bandCells = new Array(BANDS).fill(0);
const bandBuilt = new Array(BANDS).fill(0);

/** Island coverage: union area of building footprints over each chunk's island. */
let islandCells = 0;
let coveredCells = 0;

/**
 * WHAT OCCUPIES THE CORE, at each candidate ring depth. A cell is in the core
 * of a chunk when it is more than D metres from EVERY island edge. For each D
 * the raster records how many core cells carry a claim, and of which category.
 */
const CORE_DS = [19.4, 26, 32, 38, 42.3];
const core = CORE_DS.map(() => ({ cells: 0, claimed: 0, byKind: new Map() }));

/** Chunk-kind census, so "interior land" can be split by what the block IS. */
const kindCells = new Map();

for (let cx = -R; cx < R; cx++) {
  for (let cz = -R; cz < R; cz++) {
    const c = generateChunk(SEED, cx, cz);
    const b = chunkBounds(cx, cz);
    const island = { x0: b.x0 + CORRIDOR, x1: b.x1 - CORRIDOR, z0: b.z0 + CORRIDOR, z1: b.z1 - CORRIDOR };
    if (c.kind === 'built') builtChunks++;

    for (const bld of c.buildings) {
      buildings++;
      const p = perpendicular(bld, island);
      shipped.push(bld.depth);
      if (Math.abs(p.near) > 0.5) {
        quay++;
        quayDepths.push(p.into);
        continue;
      }
      depths.push(p.into);
      reaches.push(p.far);
      fractions.push(p.into / HALF);
    }
    if (c.buildings.length) chunksWithBuildings++;

    /**
     * The registry's own claims, clipped to this chunk's island. `reg.all()` is
     * every claim the generator made — its buildings, its roads, its props, a
     * park's paths and pond, a site's hoarding, the landmarks that touch it and
     * the river. That is the set a deeper building would have to be refused by,
     * which is why it is read here rather than a filtered copy of it.
     */
    const claims = c.registry.all();
    const nx = Math.round((island.x1 - island.x0) / CELL);
    const nz = Math.round((island.z1 - island.z0) / CELL);
    const kindKey = c.kind;
    if (!kindCells.has(kindKey)) kindCells.set(kindKey, { chunks: 0, cells: 0, claimedCore32: 0, core32: 0 });
    const kc = kindCells.get(kindKey);
    kc.chunks++;

    for (let ix = 0; ix < nx; ix++) {
      const x = island.x0 + (ix + 0.5) * CELL;
      for (let iz = 0; iz < nz; iz++) {
        const z = island.z0 + (iz + 0.5) * CELL;
        islandCells++;
        kc.cells++;
        if (c.buildings.length) popIslandCells++;

        /** Distance to the nearest island edge — the depth this cell sits at. */
        const d = Math.min(x - island.x0, island.x1 - x, z - island.z0, island.z1 - z);
        const band = Math.min(BANDS - 1, Math.floor(d / 4));

        let built = false;
        const kinds = new Set();
        for (const cl of claims) {
          if (x < cl.x0 || x > cl.x1 || z < cl.z0 || z > cl.z1) continue;
          kinds.add(cl.kind);
          if (cl.kind === 'building') built = true;
        }
        if (built) {
          coveredCells++;
          if (c.buildings.length) popCoveredCells++;
        }
        if (c.kind === 'built') {
          bandCells[band]++;
          if (built) bandBuilt[band]++;
        }

        for (let k = 0; k < CORE_DS.length; k++) {
          if (d <= CORE_DS[k]) continue;
          core[k].cells++;
          /**
           * WHAT WOULD REFUSE A BUILDING HERE. `pavement`, `carriageway` and
           * `ground` are surfaces a building would replace rather than stand
           * in, so they are recorded separately from the solids — but they are
           * recorded, because the conflict table decides and this instrument
           * does not.
           */
          if (kinds.size) {
            core[k].claimed++;
            for (const kk of kinds) core[k].byKind.set(kk, (core[k].byKind.get(kk) || 0) + 1);
          }
          if (CORE_DS[k] === 32) {
            kc.core32++;
            if (kinds.size) kc.claimedCore32++;
          }
        }
      }
    }
  }
}

for (const a of [depths, reaches, fractions, shipped, quayDepths]) a.sort((x, y) => x - y);
const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);

const cellArea = CELL * CELL;

console.log(`depthprobe — seed ${SEED}, ${2 * R} x ${2 * R} chunks, raster ${CELL} m`);
console.log(`  island ${ISLAND.toFixed(1)} m square, half-depth ${HALF.toFixed(1)} m`);
console.log(`  ${builtChunks} chunks of kind 'built', ${chunksWithBuildings} carrying at least one building, ${buildings} buildings`);
console.log(`  of those, ${depths.length} stand on an island edge and ${quay} on the river bank\n`);

console.log('  building DEPTH into the island, perpendicular to the frontage (m)');
console.log(`    island frontage, ${depths.length}   p10 ${q(depths, 0.10).toFixed(1)}   median ${q(depths, 0.5).toFixed(1)}   p90 ${q(depths, 0.90).toFixed(1)}   max ${q(depths, 1).toFixed(1)}   mean ${mean(depths).toFixed(1)}`);
console.log(`    river bank,      ${quayDepths.length}   p10 ${q(quayDepths, 0.10).toFixed(1)}   median ${q(quayDepths, 0.5).toFixed(1)}   p90 ${q(quayDepths, 0.90).toFixed(1)}   max ${q(quayDepths, 1).toFixed(1)}   mean ${mean(quayDepths).toFixed(1)}`);
console.log(`    ARM: \`bld.depth\` read for every building, ignoring \`facing\` — the frontage`);
console.log(`         width of half the city counted as its depth`);
console.log(`         p10 ${q(shipped, 0.10).toFixed(1)}   median ${q(shipped, 0.5).toFixed(1)}   p90 ${q(shipped, 0.90).toFixed(1)}   max ${q(shipped, 1).toFixed(1)}   mean ${mean(shipped).toFixed(1)}`);
console.log(`  as a fraction of the island's ${HALF.toFixed(1)} m half-depth   median ${q(fractions, 0.5).toFixed(3)}   p90 ${q(fractions, 0.9).toFixed(3)}`);
console.log(`  far face reach from the lot line (m), island frontage only`);
console.log(`         p10 ${q(reaches, 0.1).toFixed(1)}  median ${q(reaches, 0.5).toFixed(1)}  p90 ${q(reaches, 0.9).toFixed(1)}  max ${q(reaches, 1).toFixed(1)}`);
console.log(`  island footprint covered by buildings`);
console.log(`    over all ${4 * R * R} islands                       ${pct(coveredCells, islandCells).toFixed(1)}%   (${(coveredCells * cellArea / 1e3).toFixed(1)} of ${(islandCells * cellArea / 1e3).toFixed(1)} thousand m2)`);
console.log(`    over the ${chunksWithBuildings} that carry a building      ${pct(popCoveredCells, popIslandCells).toFixed(1)}%   (${(popCoveredCells * cellArea / 1e3).toFixed(1)} of ${(popIslandCells * cellArea / 1e3).toFixed(1)} thousand m2)\n`);

console.log('  built fraction by distance from the lot line, 4 m bands, BUILT chunks only');
for (let i = 0; i < BANDS; i++) {
  if (!bandCells[i]) continue;
  const f = pct(bandBuilt[i], bandCells[i]);
  const lo = i * 4;
  const hi = Math.min(HALF, lo + 3.99);
  console.log(`    ${String(lo).padStart(3)}–${hi.toFixed(0).padStart(3)} m  ${f.toFixed(1).padStart(5)}%  ${'#'.repeat(Math.round(f / 2))}`);
}

console.log('\n  WHAT A RING OF DEPTH D LEAVES, on this island, at FULL frontage');
console.log('    ring depth   light-well   ring coverage');
for (const d of [q(depths, 0.5), 26, 32, 38, 42.3]) {
  const well = Math.max(0, ISLAND - 2 * d);
  const cov = 100 * (1 - (well * well) / (ISLAND * ISLAND));
  console.log(`      ${d.toFixed(1).padStart(5)} m     ${well.toFixed(1).padStart(5)} m       ${cov.toFixed(1).padStart(5)}%`);
}

console.log('\n  WHAT IS IN THE CORE ALREADY — cells past D m from every island edge');
console.log('    D (m)     core area       claimed      by category');
for (let k = 0; k < CORE_DS.length; k++) {
  const c = core[k];
  const kinds = [...c.byKind.entries()].sort((a, b) => b[1] - a[1])
    .map(([kk, n]) => `${kk} ${pct(n, c.cells).toFixed(1)}%`).join('  ');
  console.log(`    ${CORE_DS[k].toFixed(1).padStart(5)}   ${(c.cells * cellArea / 1e3).toFixed(1).padStart(8)} k m2   ${pct(c.claimed, c.cells).toFixed(1).padStart(6)}%   ${kinds}`);
}

console.log('\n  INTERIOR LAND BY CHUNK KIND — the core past 32 m');
console.log('    kind            chunks    island area     core past 32 m    of that, claimed');
for (const [k, v] of [...kindCells.entries()].sort((a, b) => b[1].chunks - a[1].chunks)) {
  console.log(`    ${k.padEnd(14)}  ${String(v.chunks).padStart(5)}   ${(v.cells * cellArea / 1e3).toFixed(1).padStart(9)} k m2   ${(v.core32 * cellArea / 1e3).toFixed(1).padStart(9)} k m2   ${pct(v.claimedCore32, v.core32).toFixed(1).padStart(7)}%`);
}
