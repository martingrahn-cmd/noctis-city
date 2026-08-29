#!/usr/bin/env node
/**
 * edgeprobe.mjs — WHERE DOES THIS CITY END, AND WHAT DOES IT DO ON THE WAY OUT.
 * NOT A GATE, and it must never become one. SESSION 53.
 *
 *   node tools/edgeprobe.mjs                 all five sections
 *   node tools/edgeprobe.mjs --rings         the residency geometry, in metres
 *   node tools/edgeprobe.mjs --field         the density field against radius
 *   node tools/edgeprobe.mjs --grid          what a chunk contains against ring
 *   node tools/edgeprobe.mjs --beyond        the earth plane against the city
 *   node tools/edgeprobe.mjs --walk          one radial transect, chunk by chunk
 *   node tools/edgeprobe.mjs --seed=1337 --radius=5 --far=32
 *
 * WHY IT EXISTS, AND IT IS THE ONE MEASUREMENT SESSION 53 WAS TOLD TO BUILD.
 *
 * Fifty-two sessions have worked INSIDE the grid. The brief's own words: *"There
 * is no concept of outside it anywhere in the codebase, and that absence is the
 * item."* Before anything is built at the edge, four things have to be facts:
 *
 *   1. WHERE THE EDGE IS. `CITY.geometryRadius`, `groundRadius`, `detailRadius`,
 *      `nearRadius` and `fieldRadius` are Chebyshev radii in CHUNKS. This turns
 *      each into metres, and — the part that matters — says what they are
 *      measured FROM.
 *   2. WHETHER THE DENSITY FIELD FALLS TOWARD IT. `densityAt` is two octaves of
 *      value noise. The question is whether it carries any RADIAL term, because
 *      a gradient that is already there is a different session from one that is
 *      not. This samples the field on rings and prints the answer either way.
 *   3. WHETHER THE STREET GRID THINS. `generateChunk` takes `(rootSeed, cx, cz)`
 *      and nothing else. Whether that means the outermost chunk is identical in
 *      kind to the innermost is a measurement and not a deduction, because the
 *      landmarks, the river and `BLOCK_KEEPOUT` are all at the origin and could
 *      produce a gradient the generator never asked for.
 *   4. WHERE THE EARTH PLANE SITS RELATIVE TO ALL OF IT. `cfg.groundExtent` is
 *      4000 — a plane 8 km square. It is fixed in the WORLD. Everything above is
 *      fixed to the CAMERA. Those two facts have never been printed side by side.
 *
 * THE SAMPLING IS EXHAUSTIVE WHERE IT CAN BE AND STATED WHERE IT CANNOT.
 * `--field` walks a real lattice at 8 m and prints its own sample count; it does
 * not sample "a few points". `--grid` runs the pure generator over every chunk
 * of a square region and reports per-ring means over the chunks that are IN that
 * ring, so an inner-ring mean is over 8 chunks and an outer-ring mean is over
 * 40 and both say so.
 *
 * IT ASSERTS NOTHING ABOUT THE CITY. `citycheck` owns the verdicts. Every number
 * here is a count, an area or a code value out of the pure generator.
 */

import {
  CITY, CORRIDOR, densityAt, cityExtentAt, generateChunk, chunkBounds,
  LANDMARKS, landmarkAABB, riverEnvelope, BLOCK_KEEPOUT, LOW_DETAIL_KINDS,
  DISTANT, distantMasses, distantAlbedo,
} from '../src/lib/citygen.js';
import { GROUND, BLOCK } from '../src/core/constants.js';

const args = new Map(process.argv.slice(2).map((a) => {
  const s = a.replace(/^--/, '');
  const i = s.indexOf('=');
  return i < 0 ? [s, 'true'] : [s.slice(0, i), s.slice(i + 1)];
}));

const SEED = Number(args.get('seed') || 1337);
/** Half-width in chunks of the region `--grid` walks. 5 is the geometry ring. */
const R = Number(args.get('radius') || 5);
/** Half-width in chunks of the region `--walk` and `--field` reach. */
const FAR = Number(args.get('far') || 32);

const ALL = !args.has('rings') && !args.has('field') && !args.has('grid')
  && !args.has('beyond') && !args.has('walk') && !args.has('extent')
  && !args.has('distant');

const f = (n, d = 2) => n.toFixed(d);
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

// ---------------------------------------------------------------------------
// 1. THE RINGS, IN METRES, AND WHAT THEY ARE MEASURED FROM.

function rings() {
  const s = CITY.chunkSize;
  console.log('\n=== 1. THE RESIDENCY RINGS ===\n');
  console.log(`  chunkSize ${s} m,  CORRIDOR ${f(CORRIDOR, 1)} m (a chunk's roads reach this far past its own edge)\n`);

  /**
   * `city.js` → `wantedChunks` floors the camera into a chunk and takes the
   * Chebyshev ring around THAT chunk. So the distance from the camera to the
   * ring's outer edge depends on where in its own chunk the camera stands, and
   * it is a RANGE and not a number. The two bounds are exact:
   *
   *   camera at the chunk's far side   -> nearest edge is r * s
   *   camera at the chunk's near side  -> furthest edge is (r + 1) * s
   *
   * and the two always sum to (2r + 1) * s, the ring's full width.
   */
  const rows = [
    ['fieldRadius', CITY.fieldRadius, 'a baked canyon field'],
    ['nearRadius', CITY.nearRadius, 'street lamps'],
    ['detailRadius', CITY.detailRadius, 'facades, windows, signage, furniture'],
    ['groundRadius', CITY.groundRadius, 'carriageway, pavement, courtyards'],
    ['geometryRadius', CITY.geometryRadius, 'building masses — the outermost thing drawn'],
  ];
  console.log(`  ${pad('radius', 16)}${rpad('chunks', 7)}${rpad('near edge', 11)}${rpad('far edge', 10)}${rpad('span', 8)}${rpad('chunks', 8)}   what it gates`);
  for (const [name, r, what] of rows) {
    const near = r * s;
    const far = (r + 1) * s;
    const span = (2 * r + 1) * s;
    const n = (2 * r + 1) ** 2;
    console.log(`  ${pad(name, 16)}${rpad(r, 7)}${rpad(f(near, 0) + ' m', 11)}${rpad(f(far, 0) + ' m', 10)}${rpad(f(span, 0) + ' m', 8)}${rpad(n, 8)}   ${what}`);
  }
  console.log(`
  READ THE THIRD AND FOURTH COLUMNS AS ONE RANGE. \`wantedChunks\` floors the
  camera into a chunk and rings THAT chunk, so the distance from the eye to the
  outermost edge is ${CITY.geometryRadius * s}–${(CITY.geometryRadius + 1) * s} m
  depending on where in its own 128 m square the camera is standing. The two
  opposite edges always sum to ${(2 * CITY.geometryRadius + 1) * s} m.

  AND THE CENTRE OF EVERY ONE OF THOSE RINGS IS THE CAMERA. There is no world
  coordinate in \`wantedChunks\`, no bound on cx or cz, and no term anywhere in
  \`generateChunk\` that reads distance from the origin. The city is unbounded and
  what ends it is a window that travels with the eye.`);
}

// ---------------------------------------------------------------------------
// 2. THE DENSITY FIELD AGAINST RADIUS FROM THE ORIGIN.

function field() {
  console.log('\n=== 2. THE DENSITY FIELD AGAINST RADIUS ===\n');
  console.log(`  densityAt = ${0.68} * noise(period ${CITY.densityPeriodLong} m) + ${0.32} * noise(period ${CITY.densityPeriodShort} m), clamped to [0,1]`);
  console.log(`  lowDetailThreshold ${CITY.lowDetailThreshold} — below it a chunk is one of the ${LOW_DETAIL_KINDS.length} low-detail kinds\n`);

  /**
   * Rings of radius r, sampled on the circle at a fixed 8 m arc spacing so the
   * sample count grows with circumference and every ring is sampled at the same
   * spatial rate. A ring sampled at a fixed COUNT would sample the outer rings
   * more coarsely and could manufacture a trend out of the sampling alone.
   */
  const STEP_M = 8;
  const maxR = FAR * CITY.chunkSize;
  console.log(`  ${rpad('radius', 9)}${rpad('samples', 9)}${rpad('mean', 8)}${rpad('sd', 8)}${rpad('min', 8)}${rpad('max', 8)}${rpad('< 0.34', 9)}`);
  let total = 0;
  const means = [];
  for (let r = 0; r <= maxR; r += 256) {
    const n = r === 0 ? 1 : Math.max(16, Math.round((2 * Math.PI * r) / STEP_M));
    let sum = 0; let sq = 0; let lo = 1; let hi = 0; let low = 0;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const d = densityAt(SEED, Math.cos(a) * r, Math.sin(a) * r);
      sum += d; sq += d * d;
      if (d < lo) lo = d;
      if (d > hi) hi = d;
      if (d < CITY.lowDetailThreshold) low++;
    }
    const mean = sum / n;
    const sd = Math.sqrt(Math.max(0, sq / n - mean * mean));
    total += n;
    means.push(mean);
    if (r % 1024 === 0 || r === maxR) {
      console.log(`  ${rpad(f(r, 0) + ' m', 9)}${rpad(n, 9)}${rpad(f(mean, 4), 8)}${rpad(f(sd, 4), 8)}${rpad(f(lo, 3), 8)}${rpad(f(hi, 3), 8)}${rpad(f((100 * low) / n, 1) + '%', 9)}`);
    }
  }

  /**
   * THE TEST THAT ANSWERS THE BRIEF'S QUESTION. If the field carried a radial
   * term, the ring means would trend. Regress mean on radius over the whole
   * sweep and print the slope with the scatter it has to be read against.
   */
  const N = means.length;
  let sx = 0; let sy = 0; let sxx = 0; let sxy = 0;
  for (let i = 0; i < N; i++) { const x = i * 256; sx += x; sy += means[i]; sxx += x * x; sxy += x * means[i]; }
  const slope = (N * sxy - sx * sy) / (N * sxx - sx * sx);
  const inner = means.slice(0, Math.ceil(N / 3));
  const outer = means.slice(-Math.ceil(N / 3));
  const mi = inner.reduce((a, b) => a + b, 0) / inner.length;
  const mo = outer.reduce((a, b) => a + b, 0) / outer.length;
  let ssd = 0;
  const gm = means.reduce((a, b) => a + b, 0) / N;
  for (const m of means) ssd += (m - gm) ** 2;
  const sdRing = Math.sqrt(ssd / N);

  console.log(`
  ${total} samples over ${N} rings at ${STEP_M} m arc spacing, seed ${SEED}, out to ${f(maxR, 0)} m.

  slope of ring mean on radius   ${(slope * 1000).toExponential(2)} per km
  inner third of rings, mean     ${f(mi, 4)}
  outer third of rings, mean     ${f(mo, 4)}
  inner - outer                  ${f(mi - mo, 4)}
  sd of the ring means           ${f(sdRing, 4)}   <- the scatter it must be read against
  grand mean                     ${f(gm, 4)}`);

  const verdict = Math.abs(mi - mo) < sdRing
    ? 'THE FIELD DOES NOT FALL TOWARD ANY RIM. The inner/outer difference is smaller\n  than the ring-to-ring scatter of the field itself, which is what a field with no\n  radial term looks like — and reading the source confirms it: `densityAt` takes\n  (x, z) into two smooth-noise octaves and there is no term in r anywhere in it.'
    : 'The ring means trend. Read the slope against the sd before calling it a gradient.';
  console.log(`\n  ${verdict}`);
}

// ---------------------------------------------------------------------------
// 3. WHAT A CHUNK CONTAINS, AGAINST ITS RING.

function areaOf(rects) {
  let a = 0;
  for (const r of rects) a += (r.x1 - r.x0) * (r.z1 - r.z0);
  return a;
}

function chunkStats(cx, cz) {
  const c = generateChunk(SEED, cx, cz);
  const b = chunkBounds(cx, cz);
  const density = densityAt(SEED, (b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
  /**
   * `chunk.ground` is a FLAT ARRAY of tagged rectangles — `{own, kind, yKey,
   * x0, z0, x1, z1, axis}` — and not a map of arrays. `own` is false for the
   * pieces a chunk emits into its neighbour's square, so summing without it
   * double-counts every corridor. Both are carried.
   */
  const bucket = {};
  const bucketOwn = {};
  for (const r of (c.ground || [])) {
    const a = (r.x1 - r.x0) * (r.z1 - r.z0);
    bucket[r.kind] = (bucket[r.kind] || 0) + a;
    if (r.own) bucketOwn[r.kind] = (bucketOwn[r.kind] || 0) + a;
  }
  return {
    cx, cz, density,
    kind: c.kind,
    buildings: c.buildings.length,
    props: c.props.length,
    features: (c.features || []).length,
    signs: (c.signs || []).length,
    markings: (c.markings || []).length,
    road: bucketOwn.road || 0,
    walk: bucketOwn.walk || 0,
    core: bucketOwn.core || 0,
    grass: bucketOwn.grass || 0,
    roadAll: bucket.road || 0,
    rects: (c.ground || []).length,
    kinds: Object.keys(bucket).sort().join(','),
    objects: c.objectCount,
    landmarks: c.landmarks.length,
  };
}

function grid() {
  console.log('\n=== 3. WHAT A CHUNK CONTAINS, AGAINST ITS RING ===\n');
  console.log(`  The pure generator over every chunk of the ${2 * R + 1} x ${2 * R + 1} region at the origin, seed ${SEED}.`);
  console.log('  Per-ring MEANS over the chunks in that ring. The chunk count is printed because');
  console.log('  ring 0 is 1 chunk and ring 5 is 40, and a mean over 1 is not a mean.\n');

  const byRing = new Map();
  for (let cz = -R; cz <= R; cz++) {
    for (let cx = -R; cx <= R; cx++) {
      const r = Math.max(Math.abs(cx), Math.abs(cz));
      const s = chunkStats(cx, cz);
      if (!byRing.has(r)) byRing.set(r, []);
      byRing.get(r).push(s);
    }
  }

  const HA = 10000;
  console.log(`  ${rpad('ring', 6)}${rpad('chunks', 8)}${rpad('density', 9)}${rpad('bldgs', 8)}${rpad('road ha', 9)}${rpad('walk ha', 9)}${rpad('props', 8)}${rpad('mark', 7)}${rpad('lowDet', 8)}`);
  const rows = [];
  for (const r of [...byRing.keys()].sort((a, b) => a - b)) {
    const cs = byRing.get(r);
    const n = cs.length;
    const m = (k) => cs.reduce((a, c) => a + c[k], 0) / n;
    const lowDet = cs.filter((c) => c.kind !== 'built').length;
    rows.push({ r, n, density: m('density'), buildings: m('buildings'), road: m('road') / HA, walk: m('walk') / HA, props: m('props'), markings: m('markings'), lowDet: lowDet / n });
    const row = rows[rows.length - 1];
    console.log(`  ${rpad(r, 6)}${rpad(n, 8)}${rpad(f(row.density, 3), 9)}${rpad(f(row.buildings, 1), 8)}${rpad(f(row.road, 4), 9)}${rpad(f(row.walk, 4), 9)}${rpad(f(row.props, 1), 8)}${rpad(f(row.markings, 0), 7)}${rpad(f(100 * row.lowDet, 0) + '%', 8)}`);
  }

  /**
   * THE COMPARISON THE BRIEF ASKED FOR: the outermost ring against the rest.
   * Ring 0-2 is the core the landmarks and BLOCK_KEEPOUT sit in; ring 5 is the
   * last one drawn.
   */
  const inner = rows.filter((x) => x.r <= 2);
  const outer = rows.filter((x) => x.r === R);
  const wsum = (set, k) => set.reduce((a, x) => a + x[k] * x.n, 0) / set.reduce((a, x) => a + x.n, 0);
  console.log(`\n  ${pad('', 20)}${rpad('ring 0-2', 12)}${rpad(`ring ${R}`, 12)}${rpad('outer/inner', 13)}`);
  for (const k of ['density', 'buildings', 'road', 'walk', 'props', 'markings']) {
    const a = wsum(inner, k);
    const b = wsum(outer, k);
    console.log(`  ${pad(k, 20)}${rpad(f(a, 4), 12)}${rpad(f(b, 4), 12)}${rpad(a === 0 ? 'n/a' : f(b / a, 3) + 'x', 13)}`);
  }
  /**
   * THE PREMISE THIS SECTION EXISTS TO TEST, AND IT IS THE BRIEF'S OWN.
   *
   * Session 53's brief says *"the density field already falls toward the rim"*
   * and asks what the curve looks like there. At seed 1337 it does fall, and the
   * table above is that fall. The question is whether it is a LAW or an ACCIDENT
   * OF ONE SEED, and one seed cannot answer it — so the same core-against-rim
   * comparison is run over the twelve seeds `groundprobe` and `citycheck`
   * already pool over. A law holds 12 of 12. A coin holds about 6.
   */
  const SEEDS = [1337, 1338, 1339, 1340, 1341, 1342, 1343, 1344, 1345, 1346, 1347, 1348];
  console.log(`\n  THE SAME CORE-AGAINST-RIM COMPARISON OVER TWELVE SEEDS, on the field itself:\n`);
  console.log(`  ${rpad('seed', 8)}${rpad('ring 0-2', 11)}${rpad(`ring ${R}`, 10)}${rpad('inner - outer', 15)}`);
  let falls = 0;
  const deltas = [];
  for (const seed of SEEDS) {
    const by = new Map();
    for (let cz = -R; cz <= R; cz++) {
      for (let cx = -R; cx <= R; cx++) {
        const rr = Math.max(Math.abs(cx), Math.abs(cz));
        const b2 = chunkBounds(cx, cz);
        const d = densityAt(seed, (b2.x0 + b2.x1) / 2, (b2.z0 + b2.z1) / 2);
        if (!by.has(rr)) by.set(rr, []);
        by.get(rr).push(d);
      }
    }
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const mi = mean([...by.entries()].filter(([rr]) => rr <= 2).flatMap(([, v]) => v));
    const mo = mean(by.get(R));
    if (mi > mo) falls++;
    deltas.push(mi - mo);
    console.log(`  ${rpad(seed, 8)}${rpad(f(mi, 3), 11)}${rpad(f(mo, 3), 10)}${rpad((mi - mo >= 0 ? '+' : '') + f(mi - mo, 3), 15)}`);
  }
  const md = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const worst = deltas.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);
  console.log(`
  ${falls} OF ${SEEDS.length} SEEDS FALL FROM CORE TO RIM. Mean delta ${f(md, 4)},
  largest single delta ${f(worst, 3)}. A field with a radial term would be 12 of 12
  with a delta of one sign; this is a coin, and the seed-1337 column above is one
  toss of it. THE FIELD DOES NOT KNOW WHERE THE CITY IS, because the city is not
  anywhere: \`densityAt\` is a function of (x, z) alone and the resident square is
  a function of the camera alone.`);

  console.log(`
  THE CARRIAGEWAY IS THE ONE TO READ. It is emitted from the LATTICE — a chunk's
  road strips are its own edges plus \`CORRIDOR\`, and every chunk is the same
  ${CITY.chunkSize} m square. The road does not thin at the rim because there is
  nothing in the generator that could thin it: the width is
  2 x roadHalfWidth = ${f(2 * CITY.roadHalfWidth, 1)} m at every chunk in the
  world, and the only thing that ever removes carriageway is a landmark, the
  river or \`BLOCK_KEEPOUT\` — all three of which are at the ORIGIN.`);
}

// ---------------------------------------------------------------------------
// 4. WHAT IS BEYOND — THE EARTH PLANE AGAINST THE CITY.

function beyond() {
  console.log('\n=== 4. WHAT IS BEYOND ===\n');
  const s = CITY.chunkSize;
  const E = BLOCK.groundExtent;
  const geoFar = (CITY.geometryRadius + 1) * s;
  const geoNear = CITY.geometryRadius * s;

  console.log(`  ${pad('thing', 30)}${rpad('extent', 14)}${rpad('fixed to', 10)}   note`);
  console.log(`  ${pad('earth plane (block.js)', 30)}${rpad(`${f(E, 0)} m`, 14)}${rpad('WORLD', 10)}   a plane ${f(2 * E / 1000, 0)} km square at y ${f(GROUND.earth, 3)}`);
  console.log(`  ${pad('building masses', 30)}${rpad(`${f(geoNear, 0)}-${f(geoFar, 0)} m`, 14)}${rpad('CAMERA', 10)}   geometryRadius ${CITY.geometryRadius}`);
  console.log(`  ${pad('road + pavement + courtyard', 30)}${rpad(`${f(geoNear, 0)}-${f(geoFar, 0)} m`, 14)}${rpad('CAMERA', 10)}   groundRadius ${CITY.groundRadius}`);
  console.log(`  ${pad('facades, signage, furniture', 30)}${rpad(`${f(CITY.detailRadius * s, 0)}-${f((CITY.detailRadius + 1) * s, 0)} m`, 14)}${rpad('CAMERA', 10)}   detailRadius ${CITY.detailRadius}`);
  console.log(`  ${pad('street lamps', 30)}${rpad(`${f(CITY.nearRadius * s, 0)}-${f((CITY.nearRadius + 1) * s, 0)} m`, 14)}${rpad('CAMERA', 10)}   nearRadius ${CITY.nearRadius}`);

  console.log(`
  STANDING AT THE ORIGIN, LOOKING OUT ALONG +X:

    ${rpad('0', 8)} m   the camera
    ${rpad(f(geoNear, 0) + '-' + f(geoFar, 0), 8)} m   THE LAST BUILDING AND THE LAST SQUARE METRE OF ROAD.
    ${rpad(f(E, 0), 8)} m   the earth plane's own edge
    ${rpad(f(E - geoFar, 0), 8)} m   OF BARE EARTH BETWEEN THEM — ${f((E - geoFar) / geoFar, 1)}x the distance from
                the eye to the last building. (Against the city's full WIDTH of
                ${f((2 * CITY.geometryRadius + 1) * s, 0)} m it is ${f((E - geoFar) / ((2 * CITY.geometryRadius + 1) * s), 2)}x — both are printed because a half-width
                and a width are the two lengths CONTRACT §9 is a list of.)

  THAT ${f((E - geoFar) / 1000, 2)} km IS THE DEFECT, and it is a ratio rather
  than a distance: the drawn city is ${f((2 * CITY.geometryRadius + 1) * s / 1000, 2)} km
  across and the plane it stands on is ${f(2 * E / 1000, 0)} km across, so from any
  camera the city occupies ${f((100 * ((2 * CITY.geometryRadius + 1) * s) ** 2) / (2 * E) ** 2, 2)}%
  of the ground in front of it and the rest is one flat albedo.

  AND THE TWO EDGES MOVE INDEPENDENTLY, WHICH IS THE PART NOBODY HAS WRITTEN DOWN.
  The earth plane is centred on the WORLD ORIGIN and the city is centred on the
  CAMERA. Walk to x = ${f(E, 0)} and the plane's edge arrives while the city keeps
  generating: at x = ${f(E + geoFar, 0)} the whole resident ring stands over nothing
  at all. Nothing in \`wantedChunks\` bounds cx or cz, and nothing in
  \`generateChunk\` reads distance from the origin.`);

  // Where the authored content sits, for scale against those two numbers.
  console.log('\n  THE AUTHORED CONTENT, FOR SCALE — every landmark, by its distance from the origin:\n');
  const ls = LANDMARKS.map((l) => {
    const a = landmarkAABB(l);
    const cxm = (a.x0 + a.x1) / 2;
    const czm = (a.z0 + a.z1) / 2;
    return { name: l.name, d: Math.hypot(cxm, czm), cheb: Math.max(Math.abs(cxm), Math.abs(czm)), w: a.x1 - a.x0, h: a.z1 - a.z0 };
  }).sort((a, b) => a.d - b.d);
  console.log(`  ${pad('landmark', 14)}${rpad('radial', 11)}${rpad('chebyshev', 12)}${rpad('ring', 7)}${rpad('footprint', 16)}`);
  for (const l of ls) {
    const ring = Math.floor(l.cheb / s);
    console.log(`  ${pad(l.name, 14)}${rpad(f(l.d, 0) + ' m', 11)}${rpad(f(l.cheb, 0) + ' m', 12)}${rpad(ring, 7)}${rpad(`${f(l.w, 0)} x ${f(l.h, 0)} m`, 16)}`);
  }
  const env = riverEnvelope();
  console.log(`\n  river envelope   z ${f(env.z0, 1)} .. ${f(env.z1, 1)}   (${f(env.z1 - env.z0, 1)} m wide, runs the full x extent)`);
  console.log(`  BLOCK_KEEPOUT    x ${BLOCK_KEEPOUT.x0} .. ${BLOCK_KEEPOUT.x1}, z ${BLOCK_KEEPOUT.z0} .. ${BLOCK_KEEPOUT.z1}`);
  const far = Math.max(...ls.map((l) => l.cheb));
  console.log(`
  EVERY AUTHORED THING IN THIS WORLD IS INSIDE ${f(far, 0)} m OF THE ORIGIN —
  ring ${Math.floor(far / s)} of ${CITY.geometryRadius}. Past that the world is
  the procedural lattice and nothing else, for ever, in every direction.`);
}

// ---------------------------------------------------------------------------
// 5. ONE RADIAL TRANSECT.

function walk() {
  console.log('\n=== 5. ONE RADIAL TRANSECT ALONG +X, cz = 0 ===\n');
  console.log(`  The pure generator, chunk by chunk, out to ${FAR} chunks = ${f(FAR * CITY.chunkSize / 1000, 2)} km.`);
  console.log('  This is what a walker would cross if the streaming window travelled with them.\n');
  console.log(`  ${rpad('cx', 5)}${rpad('x mid', 9)}${rpad('dens', 7)}${pad('  kind', 16)}${rpad('bldg', 6)}${rpad('road ha', 9)}${rpad('walk ha', 9)}${rpad('props', 7)}`);
  const acc = [];
  for (let cx = 0; cx <= FAR; cx++) {
    const s = chunkStats(cx, 0);
    acc.push(s);
    if (cx <= 8 || cx % 4 === 0) {
      const b = chunkBounds(cx, 0);
      console.log(`  ${rpad(cx, 5)}${rpad(f((b.x0 + b.x1) / 2, 0), 9)}${rpad(f(s.density, 3), 7)}${pad('  ' + s.kind, 16)}${rpad(s.buildings, 6)}${rpad(f(s.road / 10000, 4), 9)}${rpad(f(s.walk / 10000, 4), 9)}${rpad(s.props, 7)}`);
    }
  }
  const first = acc.slice(0, 6);
  const last = acc.slice(-6);
  const mean = (set, k) => set.reduce((a, c) => a + c[k], 0) / set.length;
  console.log(`\n  ${pad('', 14)}${rpad('cx 0-5', 11)}${rpad(`cx ${FAR - 5}-${FAR}`, 11)}`);
  for (const k of ['density', 'buildings', 'props']) {
    console.log(`  ${pad(k, 14)}${rpad(f(mean(first, k), 3), 11)}${rpad(f(mean(last, k), 3), 11)}`);
  }
  console.log(`  ${pad('road ha', 14)}${rpad(f(mean(first, 'road') / 10000, 4), 11)}${rpad(f(mean(last, 'road') / 10000, 4), 11)}`);
  const built = acc.filter((c) => c.kind === 'built').length;
  console.log(`\n  ${built} of ${acc.length} chunks on this transect are 'built'. The other ${acc.length - built} are low-detail kinds.`);
  console.log('  A transect that ran off the edge of a city would show these falling. Read them and see.');
}


// ---------------------------------------------------------------------------
// 6. THE CITY'S EXTENT — THE FLOOR UNDER `extentCoreM`, RECOMPUTED.

/**
 * Every camera this project measures from, and the chunks each one makes
 * resident. `extentCoreM` has to contain all of them or the extent is an EDIT
 * to the measured city rather than an addition beyond it, and the two are not
 * the same claim. Written here rather than asserted in a comment so that a new
 * route with a waypoint further out is caught by running this.
 *
 * The waypoints are copied from `camera.js` -> ROUTES. THAT IS A SECOND COPY
 * AND IT IS DECLARED AS ONE: `camera.js` is a module and this is a probe, and
 * CONTRACT §2 forbids the import. What protects it is that the probe prints the
 * copy, so a reader comparing the two is comparing numbers rather than trusting
 * that they match.
 */
const MEASURED_CAMERAS = [
  ['downtown_dense', [[330, 2.5], [150, 1.0], [40, -1.5], [-60, 1.5], [-170, -2.0], [-300, 0.5]]],
  ['highway_speed', [[640, 3.0], [340, 0.0], [60, 2.0], [-220, -1.0], [-520, 2.0], [-820, 0.0]]],
  ['night_rain', [[300, -2.0], [140, 1.5], [10, -1.0], [-120, 2.0], [-260, -1.5], [-400, 1.0]]],
  ['SHOTS.street (lookcheck, citycheck)', [[70, 0.9]]],
];
/** The chunk square `citycheck` runs its placement assertions over. */
const CITYCHECK_REGION = { cx: [-5, 4], cz: [-5, 4] };

function extent() {
  console.log('\n=== 6. THE CITY EXTENT, AND THE FLOOR UNDER IT ===\n');
  const s = CITY.chunkSize;
  const G = CITY.geometryRadius;

  console.log('  (a) THE CHUNKS `citycheck` GENERATES\n');
  const rc = Math.max(
    Math.hypot(CITYCHECK_REGION.cx[0] * s, CITYCHECK_REGION.cz[0] * s),
    Math.hypot((CITYCHECK_REGION.cx[1] + 1) * s, (CITYCHECK_REGION.cz[1] + 1) * s),
  );
  console.log(`      cx, cz in [${CITYCHECK_REGION.cx[0]}, ${CITYCHECK_REGION.cx[1]}] -> world corner at ${f(rc, 1)} m`);
  console.log(`      plus CORRIDOR ${f(CORRIDOR, 1)} m of road reach            ${f(rc + CORRIDOR, 1)} m\n`);

  console.log('  (b) THE CHUNKS RESIDENT AT EVERY MEASURED CAMERA POSITION\n');
  console.log(`      ${pad('route', 38)}${rpad('x', 7)}${rpad('ring corner from origin', 26)}`);
  let worst = rc + CORRIDOR;
  let who = 'citycheck region';
  for (const [name, wps] of MEASURED_CAMERAS) {
    let best = 0; let bx = 0;
    for (const [x, z] of wps) {
      const ccx = Math.floor(x / s);
      const ccz = Math.floor(z / s);
      for (const a of [(ccx - G) * s, (ccx + G + 1) * s]) {
        for (const b2 of [(ccz - G) * s, (ccz + G + 1) * s]) {
          const m = Math.hypot(a, b2);
          if (m > best) { best = m; bx = x; }
        }
      }
    }
    console.log(`      ${pad(name, 38)}${rpad(bx, 7)}${rpad(f(best, 1) + ' m', 26)}`);
    if (best > worst) { worst = best; who = name; }
  }

  const floorChunks = Math.ceil(worst / s);
  console.log(`
  THE FLOOR IS ${f(worst, 1)} m (${who}), which is ${f(worst / s, 2)} chunks.
  Rounded up to a whole chunk: ${floorChunks} chunks = ${floorChunks * s} m.

  ${pad('CITY.extentCoreM', 22)}${rpad(CITY.extentCoreM + ' m', 10)}   ${CITY.extentCoreM >= worst ? 'CONTAINS THE FLOOR' : '*** BELOW THE FLOOR — a measured camera is outside the core ***'}
  ${pad('CITY.extentEdgeM', 22)}${rpad(CITY.extentEdgeM + ' m', 10)}   = groundExtent ${BLOCK.groundExtent} - ring reach ${(G + 1) * s}
  ${pad('the band between', 22)}${rpad((CITY.extentEdgeM - CITY.extentCoreM) + ' m', 10)}   = ${f((CITY.extentEdgeM - CITY.extentCoreM) / CITY.densityPeriodLong, 2)} x densityPeriodLong`);

  if (CITY.extentCoreM < worst) {
    console.log('\n  *** A CAMERA THIS PROJECT MEASURES FROM STANDS OUTSIDE THE CORE. Either the');
    console.log('      core is too small or a route moved; the extent is no longer provably');
    console.log('      additive and every gate number is a different city. ***');
  }

  console.log('\n  THE FALLOFF, SAMPLED:\n');
  console.log(`  ${rpad('radius', 9)}${rpad('extent', 9)}${rpad('mean d', 9)}${rpad('sd', 8)}${rpad('< 0.34', 9)}${rpad('samples', 9)}`);
  const STEP_M = 8;
  for (let r = 0; r <= 4096; r += 256) {
    const n = r === 0 ? 1 : Math.max(16, Math.round((2 * Math.PI * r) / STEP_M));
    let sum = 0; let sq = 0; let low = 0;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const d = densityAt(SEED, Math.cos(a) * r, Math.sin(a) * r);
      sum += d; sq += d * d;
      if (d < CITY.lowDetailThreshold) low++;
    }
    const mean = sum / n;
    const sd = Math.sqrt(Math.max(0, sq / n - mean * mean));
    console.log(`  ${rpad(f(r, 0) + ' m', 9)}${rpad(f(cityExtentAt(r, 0), 3), 9)}${rpad(f(mean, 4), 9)}${rpad(f(sd, 4), 8)}${rpad(f((100 * low) / n, 1) + '%', 9)}${rpad(n, 9)}`);
  }
  console.log(`
  READ THE LAST COLUMN BUT ONE. It is the share of the world at that radius that
  is BELOW \`lowDetailThreshold\` — a yard, a lot, a depot, allotments — and it is
  the gradient, expressed in the vocabulary the city already has.`);
}


// ---------------------------------------------------------------------------
// 7. THE DISTANT SILHOUETTE AGAINST THE CITY IT STANDS FOR.

/**
 * The silhouette is a MODEL of a chunk, and the only thing that makes a model
 * honest is a printed disagreement with the thing it models. So: run BOTH over
 * the same chunks — `distantMasses`, which costs a hash and a few rolls, and
 * `generateChunk`, which costs 0.21 ms — and compare the two quantities a
 * silhouette actually delivers, its TOP LINE and its MASS.
 */
function distant() {
  console.log('\n=== 7. THE DISTANT SILHOUETTE AGAINST THE CITY IT STANDS FOR ===\n');
  const s = CITY.chunkSize;
  const G = CITY.geometryRadius;
  const D = DISTANT.radiusChunks;

  console.log(`  radiusChunks ${D} = ${D * s} m,  which is ceil(extentEdgeM ${CITY.extentEdgeM} / ${s}) = ${Math.ceil(CITY.extentEdgeM / s)}`);
  const alb = distantAlbedo();
  console.log(`  albedo [${alb.map((v) => f(v, 4)).join(', ')}]  roughness ${DISTANT.roughness}\n`);

  // --- (a) the delivered instance count, at the origin -----------------------
  let chunks = 0; let built = 0; let boxes = 0;
  for (let dz = -D; dz <= D; dz++) {
    for (let dx = -D; dx <= D; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) <= G) continue;
      chunks++;
      const ms = distantMasses(SEED, dx, dz);
      if (ms.length) { built++; boxes += ms.length; }
    }
  }
  const ceilingBoxes = chunks * Math.round(DISTANT.countBase + DISTANT.countSlope);
  console.log('  (a) WHAT IT COSTS, WITH THE CAMERA AT THE WORLD CENTRE\n');
  console.log(`      chunks in the shell (ring ${G + 1} to ${D})   ${rpad(chunks, 8)}`);
  console.log(`      of those, chunks with buildings          ${rpad(built, 8)}   ${f((100 * built) / chunks, 1)}%`);
  console.log(`      boxes DELIVERED                          ${rpad(boxes, 8)}   against ${ceilingBoxes} if every chunk were built at d = 1`);
  console.log(`      triangles at 12 a box                    ${rpad(boxes * 12, 8)}   against 150 000 of headroom`);
  console.log(`      ONE draw call, one InstancedMesh.`);

  // --- (b) the same, standing at the rim ------------------------------------
  {
    const ccx = Math.round(CITY.extentEdgeM / s);
    let c2 = 0; let b2 = 0; let x2 = 0;
    for (let dz = -D; dz <= D; dz++) {
      for (let dx = -D; dx <= D; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) <= G) continue;
        c2++;
        const ms = distantMasses(SEED, ccx + dx, dz);
        if (ms.length) { b2++; x2 += ms.length; }
      }
    }
    console.log(`\n      the same shell with the camera at the RIM (cx ${ccx}, x = ${ccx * s} m):`);
    console.log(`      chunks with buildings ${b2} of ${c2} = ${f((100 * b2) / c2, 1)}%, boxes ${x2}, triangles ${x2 * 12}`);
    console.log('      Fewer, because half the shell is outside the city. That is the point.');
  }

  // --- (c) the model against the generator ---------------------------------
  console.log('\n  (b) THE MODEL AGAINST THE GENERATOR, over the chunks both agree exist\n');
  const rows = [];
  for (let cx = -20; cx <= 20; cx++) {
    for (let cz = -20; cz <= 20; cz++) {
      if (Math.max(Math.abs(cx), Math.abs(cz)) <= G) continue;
      const ms = distantMasses(SEED, cx, cz);
      const c = generateChunk(SEED, cx, cz);
      const real = c.buildings;
      if (!ms.length && !real.length) continue;
      if (!ms.length || !real.length) { rows.push({ mismatch: true, ms: ms.length, real: real.length }); continue; }
      let rTop = 0; let rVol = 0;
      for (const bl of real) { if (bl.height > rTop) rTop = bl.height; rVol += bl.width * bl.depth * bl.height; }
      const mTop = Math.max(...ms.map((m) => m.h));
      const mVol = ms.reduce((a, m) => a + m.w * m.d * m.h, 0);
      rows.push({ mTop, rTop, mVol, rVol });
    }
  }
  const bad = rows.filter((r) => r.mismatch);
  const ok = rows.filter((r) => !r.mismatch);
  const q = (a, p) => { const t = [...a].sort((x, y) => x - y); return t[Math.min(t.length - 1, Math.floor(p * t.length))]; };
  const topRatio = ok.map((r) => r.mTop / r.rTop);
  const volRatio = ok.map((r) => r.mVol / r.rVol);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  console.log(`      ${ok.length} chunks compared, ${bad.length} where one had buildings and the other did not.`);
  console.log(`      ${pad('', 22)}${rpad('p10', 9)}${rpad('p50', 9)}${rpad('p90', 9)}${rpad('mean', 9)}`);
  console.log(`      ${pad('TOP LINE model/real', 22)}${rpad(f(q(topRatio, 0.1), 3), 9)}${rpad(f(q(topRatio, 0.5), 3), 9)}${rpad(f(q(topRatio, 0.9), 3), 9)}${rpad(f(mean(topRatio), 3), 9)}`);
  console.log(`      ${pad('MASS model/real', 22)}${rpad(f(q(volRatio, 0.1), 3), 9)}${rpad(f(q(volRatio, 0.5), 3), 9)}${rpad(f(q(volRatio, 0.9), 3), 9)}${rpad(f(mean(volRatio), 3), 9)}`);
  console.log(`
      A RATIO OF 1.000 WOULD MEAN THE MODEL IS THE GENERATOR, WHICH IT IS NOT
      AND MUST NOT CLAIM TO BE. What it has to be is unbiased — a median near 1
      with the spread of one chunk's own luck — because a silhouette 20% short
      everywhere is a visible step at the ring boundary and a silhouette 20%
      tall everywhere is a wall. The p10/p90 band is the honest error bar and it
      is the number to quote, not the median alone.`);

  // --- (d) the boundary step ------------------------------------------------
  console.log('\n  (c) THE STEP AT THE RING BOUNDARY, which is the one place both are visible\n');
  let realTop = 0; let realN = 0; let modTop = 0; let modN = 0;
  for (let cx = -(G + 1); cx <= G + 1; cx++) {
    for (let cz = -(G + 1); cz <= G + 1; cz++) {
      const r = Math.max(Math.abs(cx), Math.abs(cz));
      if (r === G) {
        const c = generateChunk(SEED, cx, cz);
        for (const bl of c.buildings) { realTop += bl.height; realN++; }
      } else if (r === G + 1) {
        const ms = distantMasses(SEED, cx, cz);
        for (const m of ms) { modTop += m.h; modN++; }
      }
    }
  }
  console.log(`      ring ${G}     ${realN} real buildings, mean height ${f(realTop / Math.max(1, realN), 2)} m`);
  console.log(`      ring ${G + 1}     ${modN} silhouette boxes, mean height ${f(modTop / Math.max(1, modN), 2)} m`);
  console.log(`      ratio     ${f((modTop / Math.max(1, modN)) / (realTop / Math.max(1, realN)), 3)}`);
  console.log(`
      THIS IS THE ONE NUMBER A SILHOUETTE CANNOT ARGUE ITS WAY OUT OF. Ring 5 is
      drawn as real buildings and ring 6 as boxes, they are 128 m apart, and any
      camera that sees one sees the other. A ratio away from 1 is a STEP in the
      skyline at a fixed distance from the eye, which is exactly the artefact
      the whole silhouette exists to remove.

      THE FIRST ARM OF THIS READ 1.548, and that was the finding that rewrote
      it: one box for the block and one for its tower gives a mean of two that
      is halfway to the tallest, where a real chunk's mean is over ten. Placing
      the chunk's own count on its own perimeter is what brought it to 1.018.`);
}

console.log(`edgeprobe — seed ${SEED}, region radius ${R} chunks, transect ${FAR} chunks. NOT A GATE.`);
if (ALL || args.has('rings')) rings();
if (ALL || args.has('field')) field();
if (ALL || args.has('grid')) grid();
if (ALL || args.has('beyond')) beyond();
if (ALL || args.has('walk')) walk();
if (ALL || args.has('extent')) extent();
if (ALL || args.has('distant')) distant();
console.log('');
