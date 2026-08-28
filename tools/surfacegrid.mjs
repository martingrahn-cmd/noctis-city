#!/usr/bin/env node
/**
 * surfacegrid.mjs — WHERE IN THE DELIVERED CITY IS THERE NO SURFACE UNDER YOU.
 * NOT A GATE, and it must never become one — `citycheck` owns the verdict.
 * SESSION 51.
 *
 *   node tools/surfacegrid.mjs                the bare share of the walkable ring
 *   node tools/surfacegrid.mjs --step=1       sample spacing, metres (default 2)
 *   node tools/surfacegrid.mjs --radius=5     half-width of the region in chunks
 *   node tools/surfacegrid.mjs --eye=x,z      where the ring is centred
 *   node tools/surfacegrid.mjs --kinds        the whole surface census, not just bare
 *   node tools/surfacegrid.mjs --patches      the bare regions as boxes, largest first
 *   node tools/surfacegrid.mjs --at=x,z       one point, the way the player asks
 *
 * WHY IT EXISTS, AND WHY IT IS NOT `bareprobe`.
 *
 * The operator walks the city and presses `P`, and `player.js` prints
 * `on <kind> at y <h>`. Twice in four positions after session 50 it printed
 * **`on earth at y -0.020`** — the `block.js` earth plane, inside the city.
 * That is a question the player already answers, one position at a time, when
 * somebody happens to walk past. This asks it on a lattice.
 *
 * `bareprobe.mjs` (session 42) measures the same word and it CANNOT see these
 * two positions, for two reasons that are both properties of what it reads:
 *
 *   1. IT READS THE GENERATOR, not the delivered city. `generateChunk` decides
 *      a rectangle; `city.js` decides whether that chunk is resident, whether
 *      its ring is inside `CITY.groundRadius`, and whether `BLOCK_KEEPOUT`
 *      clipped the rectangle away afterwards. The gap the operator stood in is
 *      in the THIRD of those and the generator has no opinion about it.
 *   2. ITS PRECEDENCE HIDES THE LANDMARKS. `bareprobe` attributes a square
 *      metre to the first SOLID that covers it — `building`, `landmark`,
 *      `water`, `block` — so every square metre inside a landmark's keep-out is
 *      owned by the landmark whether or not the landmark has any geometry
 *      standing on it. The weir claims a 210 x 210 m AABB and fills a 210 m
 *      CIRCLE, and the 9 464 m² in the four corners is bare earth that
 *      `bareprobe` prints as `landmark`.
 *
 * SO THIS READS `city.worldSurfaceAt` — THE PLAYER'S OWN QUERY, THE SAME
 * FUNCTION, through `tools/lib/headlesscity.mjs`, which boots the real
 * `city.js`, `block.js` and `river.js` in node. The control is that it
 * reproduces the operator's four readings to the millimetre; `--at` prints
 * them and it is the first thing to run after any change here.
 *
 * WHAT IS SAMPLED, AND WHAT IS DELIBERATELY NOT.
 *
 * A point inside a building is not a gap in the ground — nobody can stand
 * there and no surface is owed. So the denominator is `city.walkableAt(x, z)`,
 * the same predicate `player.js` moves against, and a point it refuses is
 * dropped rather than counted as covered. That makes the share printed here
 * **the share of the ground a person can actually reach**, which is the
 * quantity the operator's complaint is about.
 *
 * THE BASIN IS WALKABLE AND THAT IS CORRECT. `walkableAt` skips `kind ===
 * 'basin'` because a hole is something you walk down into, so the weir's bowl
 * is in the denominator — and `block.js`'s `basinSurfaceAt` answers for the
 * lathe's own floor, ledge and wall, so the bowl is NOT bare. The corners
 * outside the lathe are, and that is the finding rather than an artefact.
 *
 * SAMPLED, NOT EXACT, AND THE STEP IS PRINTED. `bareprobe`'s coordinate
 * compression is exact because it reads rectangles; this reads a function, so
 * it reads it on a lattice. An area here is `count x step²` and is quoted with
 * the step beside it. `--step=1` is four times the work and moves the headline
 * share by less than 0.1 point, which is printed by running both.
 */

import {
  CITY, CORRIDOR, BLOCK_KEEPOUT, LANDMARKS, landmarkGroundClaims, riverEnvelope,
} from '../src/lib/citygen.js';
import { bootCity, CITYCHECK_EYE } from './lib/headlesscity.mjs';

const args = new Map(process.argv.slice(2).map((a) => {
  const i = a.indexOf('=');
  return i < 0 ? [a.replace(/^--/, ''), 'true'] : [a.slice(0, i).replace(/^--/, ''), a.slice(i + 1)];
}));

const STEP = Number(args.get('step') || 2);
const R = Number(args.get('radius') || 5);
const SEED = Number(args.get('seed') || 1337);
const EYE = args.has('eye')
  ? (() => { const [x, z] = String(args.get('eye')).split(',').map(Number); return [x, 1.74, z]; })()
  : CITYCHECK_EYE;

const f1 = (n) => (Number.isFinite(n) ? n.toFixed(1) : '  —  ');
const f2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : '  —  ');
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

/**
 * THE FOUR POSITIONS THE OPERATOR PHOTOGRAPHED AFTER SESSION 50, with what his
 * console printed beside each. This probe's control (CONTRACT §7.1): a run that
 * does not reproduce these is reading something other than what he was standing
 * on, and its areas are not comparable with his frames.
 */
const OPERATOR_POSITIONS = [
  { x: 109.94, z: -13.60, saw: 'earth', y: -0.020, note: 'ground missing in the core' },
  { x: 146.89, z: -23.32, saw: 'earth', y: -0.020, note: 'ground missing in the core' },
  { x: 190.64, z: -11.25, saw: 'walk', y: 0.161, note: 'traffic over a pale surface' },
  { x: -163.75, z: 129.28, saw: 'road', y: 0.001, note: 'a street ends in the square' },
];

/**
 * WHOSE GAP IT IS. One owner per bare sample, and the order is the order in
 * which a reader can DO something about it: the origin block owns its own
 * keep-out whatever else is true of a point inside it, a landmark owns the
 * ground its claim took off the network, and what is left is the streamed
 * city's own.
 *
 * `outside the ground ring` is separated out because it is not a defect at
 * all — `CITY.groundRadius` is 5 and the ring has to end somewhere. It is
 * printed so that the rest of the table can be read as the part that is.
 */
function ownerOf(x, z, camChunk) {
  const s = CITY.chunkSize;
  const ring = Math.max(Math.abs(Math.floor(x / s) - camChunk.cx), Math.abs(Math.floor(z / s) - camChunk.cz));
  if (ring > CITY.groundRadius) return 'outside the ground ring';
  if (x > BLOCK_KEEPOUT.x0 && x < BLOCK_KEEPOUT.x1 && z > BLOCK_KEEPOUT.z0 && z < BLOCK_KEEPOUT.z1) {
    return 'origin block keep-out';
  }
  for (const l of LANDMARKS) {
    for (const g of landmarkGroundClaims(l)) {
      if (x > g.x0 && x < g.x1 && z > g.z0 && z < g.z1) return `landmark:${l.name}`;
    }
  }
  const env = riverEnvelope(String(SEED));
  if (env && z > env.z0 && z < env.z1) return 'river envelope';
  // Inside the island (the 104.6 m square) or in the 23.4 m road corridor
  // around it — two different repairs, so two different rows.
  const lx = ((x % s) + s) % s;
  const lz = ((z % s) + s) % s;
  const inIsland = lx > CORRIDOR && lx < s - CORRIDOR && lz > CORRIDOR && lz < s - CORRIDOR;
  return inIsland ? 'island, no surface' : 'corridor, no surface';
}

const world = bootCity({ seed: SEED, eye: EYE });
const api = world.cityApi;
const camChunk = {
  cx: Math.floor(EYE[0] / CITY.chunkSize),
  cz: Math.floor(EYE[2] / CITY.chunkSize),
};

if (args.has('at')) {
  const [x, z] = String(args.get('at')).split(',').map(Number);
  const su = api.worldSurfaceAt(x, z);
  const w = api.walkableAt(x, z);
  console.log(`(${x}, ${z})  on ${su.kind} at y ${su.y.toFixed(3)}  known=${su.known}  `
    + `walkable=${w.walkable}${w.by ? ` (${w.by})` : ''}  owner=${ownerOf(x, z, camChunk)}`);
  process.exit(0);
}

console.log('');
console.log('surfacegrid — where the delivered city has no surface under you. NOT A GATE.');
console.log(`  region      ${2 * R} x ${2 * R} chunks about the eye, ${2 * R * CITY.chunkSize} m square`);
console.log(`  eye         ${EYE[0]}, ${EYE[2]}  (chunk ${camChunk.cx},${camChunk.cz})  seed ${SEED}`);
console.log(`  step        ${STEP} m — every area below is count x ${(STEP * STEP).toFixed(2)} m²`);
console.log(`  resident    ${world.stats ? world.stats.resident : '?'} chunks after ${world.frames} frames`);
console.log(`  bare        worldSurfaceAt().kind === 'earth' — the block.js plane at -0.02 m`);
console.log('');

console.log('  THE OPERATOR\'S OWN FOUR POSITIONS — the control');
for (const p of OPERATOR_POSITIONS) {
  const w = bootCity({ seed: SEED, eye: [p.x, 1.74, p.z] });
  const su = w.cityApi.worldSurfaceAt(p.x, p.z);
  const ok = su.kind === p.saw && Math.abs(su.y - p.y) < 0.0015;
  console.log(`  ${ok ? 'OK  ' : 'DIFF'} (${lpad(p.x.toFixed(2), 8)}, ${lpad(p.z.toFixed(2), 8)})  `
    + `saw ${pad(p.saw, 6)} y ${p.y.toFixed(3)}   now ${pad(su.kind, 6)} y ${su.y.toFixed(3)}   ${p.note}`);
}
console.log('');

const x0 = (camChunk.cx - R) * CITY.chunkSize;
const x1 = (camChunk.cx + R) * CITY.chunkSize;
const z0 = (camChunk.cz - R) * CITY.chunkSize;
const z1 = (camChunk.cz + R) * CITY.chunkSize;

const kinds = new Map();
const owners = new Map();
const bareCells = [];
let sampled = 0;
let unwalkable = 0;
let unknown = 0;

for (let z = z0 + STEP / 2; z < z1; z += STEP) {
  for (let x = x0 + STEP / 2; x < x1; x += STEP) {
    sampled++;
    if (!api.walkableAt(x, z).walkable) { unwalkable++; continue; }
    const su = api.worldSurfaceAt(x, z);
    if (!su.known) unknown++;
    kinds.set(su.kind, (kinds.get(su.kind) || 0) + 1);
    if (su.kind === 'earth') {
      const o = ownerOf(x, z, camChunk);
      owners.set(o, (owners.get(o) || 0) + 1);
      bareCells.push([x, z, o]);
    }
  }
}

const cell = STEP * STEP;
const walkable = sampled - unwalkable;
const bare = bareCells.length;

console.log(`  ${lpad(sampled, 9)} samples  ${lpad(unwalkable, 9)} inside a solid  `
  + `${lpad(walkable, 9)} walkable = ${f2((walkable * cell) / 1e4)} ha`);
console.log('');
console.log(`  BARE: ${bare} of ${walkable} walkable samples = ${f1((100 * bare) / walkable)}% `
  + `= ${f2((bare * cell) / 1e4)} ha`);
console.log('');
console.log('  WHOSE GAP IT IS');
console.log(`  ${pad('owner', 26)} ${lpad('samples', 8)} ${lpad('hectares', 10)} ${lpad('% of bare', 10)} ${lpad('% walkable', 11)}`);
for (const [k, v] of [...owners].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${pad(k, 26)} ${lpad(v, 8)} ${lpad(f2((v * cell) / 1e4), 10)} `
    + `${lpad(f1((100 * v) / bare), 10)} ${lpad(f2((100 * v) / walkable), 11)}`);
}
console.log('');

if (args.has('kinds')) {
  console.log('  EVERY SURFACE, NOT ONLY THE MISSING ONE');
  console.log(`  ${pad('kind', 14)} ${lpad('samples', 9)} ${lpad('hectares', 10)} ${lpad('% walkable', 11)}`);
  for (const [k, v] of [...kinds].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pad(k, 14)} ${lpad(v, 9)} ${lpad(f2((v * cell) / 1e4), 10)} ${lpad(f2((100 * v) / walkable), 11)}`);
  }
  console.log(`  ${pad('(not known)', 14)} ${lpad(unknown, 9)}   streaming, no near-ring ground yet`);
  console.log('');
}

if (args.has('patches')) {
  /**
   * THE GAPS AS PLACES RATHER THAN AS A TOTAL. A 0.9 ha total spread over the
   * whole region as a 2 m fringe is a rounding artefact; the same 0.9 ha in
   * three rectangles is three things to build. Flood-filled on the sample
   * lattice with 4-connectivity, which is the coarsest connectivity that
   * cannot join two patches across a diagonal touch.
   */
  const key = (x, z) => `${Math.round(x / STEP)},${Math.round(z / STEP)}`;
  const grid = new Map(bareCells.map((c) => [key(c[0], c[1]), c]));
  const seen = new Set();
  const patches = [];
  for (const [k, c] of grid) {
    if (seen.has(k)) continue;
    const stack = [c];
    seen.add(k);
    const p = { n: 0, x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, owner: new Map() };
    while (stack.length) {
      const [x, z, o] = stack.pop();
      p.n++;
      p.x0 = Math.min(p.x0, x); p.x1 = Math.max(p.x1, x);
      p.z0 = Math.min(p.z0, z); p.z1 = Math.max(p.z1, z);
      p.owner.set(o, (p.owner.get(o) || 0) + 1);
      for (const [dx, dz] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) {
        const nk = key(x + dx, z + dz);
        if (grid.has(nk) && !seen.has(nk)) { seen.add(nk); stack.push(grid.get(nk)); }
      }
    }
    patches.push(p);
  }
  patches.sort((a, b) => b.n - a.n);
  console.log(`  THE GAPS AS PLACES — ${patches.length} connected patches`);
  console.log(`  ${lpad('m²', 9)} ${lpad('x', 9)} ${lpad('z', 9)} ${lpad('w', 7)} ${lpad('d', 7)}  owner`);
  for (const p of patches.slice(0, 24)) {
    const top = [...p.owner].sort((a, b) => b[1] - a[1])[0];
    console.log(`  ${lpad((p.n * cell).toFixed(0), 9)} ${lpad(((p.x0 + p.x1) / 2).toFixed(1), 9)} `
      + `${lpad(((p.z0 + p.z1) / 2).toFixed(1), 9)} ${lpad((p.x1 - p.x0 + STEP).toFixed(1), 7)} `
      + `${lpad((p.z1 - p.z0 + STEP).toFixed(1), 7)}  ${top[0]}`);
  }
  if (patches.length > 24) console.log(`  ... and ${patches.length - 24} more`);
  console.log('');
}
