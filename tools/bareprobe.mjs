#!/usr/bin/env node
/**
 * bareprobe.mjs — HOW MUCH OF THE GROUND IS NOTHING, AND WHOSE NOTHING IT IS.
 * NOT A GATE, and it must never become one. SESSION 42.
 *
 *   node tools/bareprobe.mjs                  the region's ground, by owner
 *   node tools/bareprobe.mjs --why            the bare share, by REASON
 *   node tools/bareprobe.mjs --camera=0,0     with the ground ring applied
 *   node tools/bareprobe.mjs --frame=0,950,0  the footprint an aerial frame sees
 *   node tools/bareprobe.mjs --seeds=a,b      pooled over regions
 *   node tools/bareprobe.mjs --radius=5       half-width of the region in chunks
 *
 * WHY IT EXISTS.
 *
 * Session 40 filled parking, lots and yards from 0.0 to 150–180 objects per
 * hectare and cut empty light wells from 659 to 187 of 963, and from the air
 * the ground between buildings still reads as wide brown fields. Session 42's
 * brief says so in the operator's own words: *"still too much empty land, and
 * it is not realistic"*.
 *
 * PER-HECTARE OBJECT COUNTS CANNOT ANSWER THAT AND THIS IS WHY.
 * `groundprobe` divides objects by OPEN GROUND — the island minus the solids
 * standing on it — and open ground is exactly the quantity that says nothing
 * about whether a SURFACE was drawn on it. A parcel with 180 objects a hectare
 * and no surface under them is 180 objects standing on the world's earth plane.
 * What the operator is looking at is the surface, so this measures the surface.
 *
 * ONE SQUARE METRE HAS ONE OWNER, AND THE PRECEDENCE IS WHAT A LOOK DOWN SEES.
 * A roof hides the ground under it, so a building's footprint is owned by the
 * building and not by the carriageway the generator clipped away beneath it.
 * The order is solids first — `building`, `landmark`, `water`, `block` — then
 * the drawn surface rectangles `city.js` triangulates out of `chunk.ground`,
 * and what no rectangle covers is BARE: the `block.js` earth plane at
 * `GROUND.earth` = −0.02 m, 0x4a4640, which is the brown.
 *
 * THE RING IS PART OF THE ANSWER AND IT IS NOT A PROPERTY OF THE GENERATOR.
 * `city.js` builds a chunk's ground only when `detail && ring <= CITY.ground
 * Radius` (4), while building massing is drawn to `CITY.geometryRadius` (5) and
 * the landmarks stand further out still. So beyond 512 m from the camera every
 * island, every carriageway and every courtyard IS the earth plane, whatever
 * the generator decided for it. `--camera` and `--frame` apply that rule; the
 * default does not, and the difference between the two readings is the whole
 * distinction between what this city GENERATES and what a frame SHOWS.
 *
 * EXACT, NOT SAMPLED. Areas come from `groundprobe`'s own coordinate
 * compression: every rectangle edge in the 3×3 neighbourhood becomes a lattice
 * line and each lattice cell is attributed to exactly one owner by the
 * precedence above. A share printed here is a fact about the rectangles rather
 * than a raster that missed a strip.
 *
 * IT ASSERTS NOTHING ABOUT THE CITY. `citycheck` owns the verdicts.
 */

import {
  CITY, CORRIDOR, generateChunk, riverEnvelope, landmarkAABB, LANDMARKS,
} from '../src/lib/citygen.js';

const args = new Map(process.argv.slice(2).map((a) => {
  const i = a.indexOf('=');
  return i < 0 ? [a.replace(/^--/, ''), 'true'] : [a.slice(0, i).replace(/^--/, ''), a.slice(i + 1)];
}));

const R = Number(args.get('radius') || 5);
const SEEDS = (args.get('seeds') || '1337').split(',').map(Number);

const f1 = (n) => (Number.isFinite(n) ? n.toFixed(1) : '  —  ');
const f2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : '  —  ');
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

/** Solids, in the order a look down resolves them. */
const SOLID = ['building', 'landmark', 'water', 'block'];

/**
 * What each `chunk.ground` kind is called in this table. `city.js`'s
 * `albedoFor()` is the other half of the same mapping and the names are its
 * names, so a row here can be read against a colour there.
 */
const SURFACE_LABEL = {
  road: 'carriageway',
  walk: 'pavement',
  grass: 'grass',
  path: 'path',
  siteGround: 'site',
  parkingGround: 'parking',
  yardGround: 'yard',
  coreGround: 'core',
};

const chunkCache = new Map();
function chunkAt(seed, cx, cz) {
  const key = `${seed}:${cx}:${cz}`;
  let c = chunkCache.get(key);
  if (!c) { c = generateChunk(seed, cx, cz); chunkCache.set(key, c); }
  return c;
}

/**
 * Every rectangle that can cover ground inside cell (cx,cz), gathered from the
 * 3×3 neighbourhood because a chunk emits only its OWN west and north corridor
 * strips — the cell's east and south strips belong to its neighbours.
 */
function coverFor(seed, cx, cz) {
  const solids = [];
  const surfaces = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const c = chunkAt(seed, cx + dx, cz + dz);
      for (const q of c.registry.all()) {
        if (SOLID.includes(q.kind)) solids.push(q);
      }
      for (const g of c.ground) {
        if (g.own === false) continue;
        surfaces.push(g);
      }
    }
  }
  return { solids, surfaces };
}

/**
 * The area of `clip` attributed to each owner, exactly, by coordinate
 * compression. Precedence: solids in SOLID order, then a drawn surface, then
 * bare. `drawn` false means the ring rule has switched this cell's surfaces
 * off — the solids still stand, because they are drawn one ring further out.
 */
function attribute(clip, cover, drawn, massing) {
  const xs = new Set([clip.x0, clip.x1]);
  const zs = new Set([clip.z0, clip.z1]);
  const solids = [];
  const surfaces = [];
  const take = (b, into) => {
    const x0 = Math.max(b.x0, clip.x0);
    const x1 = Math.min(b.x1, clip.x1);
    const z0 = Math.max(b.z0, clip.z0);
    const z1 = Math.min(b.z1, clip.z1);
    if (x1 <= x0 || z1 <= z0) return;
    into.push({ ...b, x0, x1, z0, z1 });
    xs.add(x0); xs.add(x1); zs.add(z0); zs.add(z1);
  };
  for (const q of cover.solids) take(q, solids);
  if (drawn) for (const g of cover.surfaces) take(g, surfaces);

  const X = [...xs].sort((a, b) => a - b);
  const Z = [...zs].sort((a, b) => a - b);
  const owner = {};
  const add = (k, a) => { owner[k] = (owner[k] || 0) + a; };

  for (let i = 0; i < X.length - 1; i++) {
    for (let j = 0; j < Z.length - 1; j++) {
      const a = (X[i + 1] - X[i]) * (Z[j + 1] - Z[j]);
      if (a <= 0) continue;
      const cx = (X[i] + X[i + 1]) / 2;
      const cz = (Z[j] + Z[j + 1]) / 2;
      let who = null;
      for (const kind of SOLID) {
        for (const q of solids) {
          if (q.kind === kind && cx > q.x0 && cx < q.x1 && cz > q.z0 && cz < q.z1) { who = kind; break; }
        }
        if (who) break;
      }
      if (!who) {
        for (const g of surfaces) {
          if (cx > g.x0 && cx < g.x1 && cz > g.z0 && cz < g.z1) {
            who = SURFACE_LABEL[g.kind] || g.kind;
            break;
          }
        }
      }
      add(who || 'BARE', a);
      if (!who) add(`why:${whyBare(cx, cz, drawn, massing)}`, a);
    }
  }
  return owner;
}

/**
 * WHY a square metre is bare. One reason each, in the order that a repair
 * would have to reach them: the ring is not the generator's doing at all, a
 * landmark's clip hole has no replacement surface by construction, the river
 * envelope refuses whole east–west strips, and what is left is ground the
 * generator simply drew nothing on.
 */
function whyBare(x, z, drawn, massing) {
  // The band that matters is the one where a BUILDING stands and its ground
  // does not: `city.js` draws massing to `CITY.geometryRadius` and ground only
  // to `CITY.groundRadius`, so between the two a city block stands on the
  // world's earth plane. Past the geometry ring there is simply nothing yet.
  if (!drawn) return massing ? 'massing ring, ground not drawn' : 'past the geometry ring';
  for (const l of LANDMARKS) {
    const a = landmarkAABB(l);
    if (a && x > a.x0 && x < a.x1 && z > a.z0 && z < a.z1) return 'landmark clip hole';
  }
  const env = riverEnvelope();
  if (z > env.z0 && z < env.z1) return 'river envelope';
  const s = CITY.chunkSize;
  const ix = ((x % s) + s) % s;
  const iz = ((z % s) + s) % s;
  const inIsland = ix > CORRIDOR && ix < s - CORRIDOR && iz > CORRIDOR && iz < s - CORRIDOR;
  return inIsland ? 'island, no surface drawn' : 'corridor, no surface drawn';
}

/** Chebyshev ring distance in chunks — `city.js`'s own residency measure. */
const ringOf = (cx, cz, camx, camz) => Math.max(Math.abs(cx - camx), Math.abs(cz - camz));

function region(seed, cam) {
  const total = {};
  const cells = [];
  for (let cx = -R; cx < R; cx++) {
    for (let cz = -R; cz < R; cz++) {
      const s = CITY.chunkSize;
      const clip = { x0: cx * s, x1: (cx + 1) * s, z0: cz * s, z1: (cz + 1) * s };
      const r = cam ? ringOf(cx, cz, cam.cx, cam.cz) : 0;
      const drawn = !cam || r <= CITY.groundRadius;
      const massing = !!cam && r > CITY.groundRadius && r <= CITY.geometryRadius;
      const owner = attribute(clip, coverFor(seed, cx, cz), drawn, massing);
      for (const [k, v] of Object.entries(owner)) total[k] = (total[k] || 0) + v;
      cells.push({ cx, cz, kind: chunkAt(seed, cx, cz).kind, drawn, owner });
    }
  }
  return { total, cells };
}

// ---------------------------------------------------------------------------

const camArg = args.get('camera');
const frameArg = args.get('frame');
let cam = null;
if (camArg) {
  const [cx, cz] = camArg.split(',').map(Number);
  cam = { cx, cz };
} else if (frameArg) {
  const [x, , z] = frameArg.split(',').map(Number);
  cam = { cx: Math.floor(x / CITY.chunkSize), cz: Math.floor(z / CITY.chunkSize) };
}

console.log('');
console.log('bareprobe — the ground of a region, by owner. NOT A GATE.');
console.log(`  region      ${2 * R} x ${2 * R} chunks, cx,cz in [${-R},${R}), `
  + `${2 * R * CITY.chunkSize} m square = ${((2 * R * CITY.chunkSize) ** 2 / 1e4).toFixed(0)} ha`);
console.log(`  seeds       ${SEEDS.join(', ')}`);
console.log(`  ring rule   ${cam ? `APPLIED, camera chunk (${cam.cx},${cam.cz}), ground drawn to ring ${CITY.groundRadius}` : 'not applied — this is what the GENERATOR decides'}`);
console.log('  bare        no solid and no drawn surface: the block.js earth plane, y = -0.02, 0x4a4640');
console.log('');

for (const seed of SEEDS) {
  const { total, cells } = region(seed, cam);
  const area = Object.entries(total).filter(([k]) => !k.startsWith('why:'))
    .reduce((a, [, v]) => a + v, 0);
  const bare = total.BARE || 0;
  const underSolid = SOLID.reduce((a, k) => a + (total[k] || 0), 0);
  const visible = area - underSolid;

  console.log(`SEED ${seed}`);
  console.log(`  ${pad('owner', 14)} ${lpad('hectares', 10)} ${lpad('% of ground', 12)} ${lpad('% of visible', 13)}`);
  const rows = Object.entries(total).filter(([k]) => !k.startsWith('why:'))
    .sort((a, b) => b[1] - a[1]);
  for (const [k, v] of rows) {
    const vis = SOLID.includes(k) ? NaN : (100 * v) / visible;
    console.log(`  ${pad(k, 14)} ${lpad(f2(v / 1e4), 10)} ${lpad(f2((100 * v) / area), 12)} ${lpad(f2(vis), 13)}`);
  }
  console.log(`  ${pad('', 14)} ${lpad('', 10)} ${lpad('', 12)}`);
  console.log(`  BARE GROUND IS ${f1((100 * bare) / visible)}% OF THE GROUND YOU CAN SEE `
    + `(${f2(bare / 1e4)} ha of ${f2(visible / 1e4)} ha), ${f1((100 * bare) / area)}% of the region`);
  console.log('');

  if (args.has('why')) {
    console.log('  WHY IT IS BARE');
    const why = Object.entries(total).filter(([k]) => k.startsWith('why:'))
      .sort((a, b) => b[1] - a[1]);
    for (const [k, v] of why) {
      console.log(`  ${pad(k.slice(4), 26)} ${lpad(f2(v / 1e4), 9)} ha  ${lpad(f1((100 * v) / bare), 6)}% of bare  ${lpad(f1((100 * v) / visible), 6)}% of visible`);
    }
    console.log('');

    const byKind = {};
    for (const c of cells) {
      const b = c.owner.BARE || 0;
      byKind[c.kind] = byKind[c.kind] || { bare: 0, n: 0 };
      byKind[c.kind].bare += b;
      byKind[c.kind].n += 1;
    }
    console.log('  BARE BY CHUNK KIND');
    for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1].bare - a[1].bare)) {
      const cellM2 = CITY.chunkSize * CITY.chunkSize;
      console.log(`  ${pad(k, 14)} ${lpad(v.n, 4)} chunks  ${lpad(f2(v.bare / 1e4), 8)} ha  ${lpad(f1((100 * v.bare) / (v.n * cellM2)), 6)}% of each cell`);
    }
    console.log('');
  }
}
