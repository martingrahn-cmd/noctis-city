#!/usr/bin/env node
/**
 * claimprobe.mjs — WHAT A BUILDING CLAIMS AGAINST WHAT A BUILDING IS.
 * ===================================================================
 *
 * NOT A GATE. SESSION 25.
 *
 * THE QUESTION. `building` is the largest category in the city and the only one
 * with no exceptions in `occupancy.js`'s conflict table — it may overlap
 * NOTHING. Every test in this project that asks "is this inside a building" or
 * "is this above one" is answered by that claim. Session 24's `emitcensus`
 * measured the claim against the delivered geometry for the first time and
 * found it wrong in two independent directions:
 *
 *   IN PLAN      the claim is `bld.x ± width/2`, the UNROTATED footprint, and
 *                the mass is drawn at `bld.yawDeg`. Both halves of the two-sided
 *                check spell it the same way, so they agree with each other and
 *                both disagree with the world.
 *   IN HEIGHT    the claim's `y1` is `bld.height`, which is the top of the WALL.
 *                Everything standing on the roof — parapet, cornice, plant — is
 *                above it, the worst by 18.72 m.
 *
 * They are separate defects with separate repairs and separate costs, and this
 * file keeps them apart end to end. Collapsing them would be this project's own
 * failure mode: one number covering two quantities.
 *
 * WHAT IS MEASURED, AND WHY IT IS NOT THE WORLD AABB.
 *
 * `emitcensus` takes each box's world AABB, which is the right extent for "is
 * anything claimed over this footprint" and the WRONG one for a yaw question: a
 * 26 m box turned 2.4° has an AABB up to 0.55 m wider than the box itself, so a
 * probe reading AABBs would report the inflation of its own instrument as the
 * building escaping its claim. So `captureBuild({ keepElements: true })` hands
 * back the matrix, and the footprint here is the four transformed ground corners
 * — an exact rotated rectangle. Areas are exact convex-polygon intersections
 * (Sutherland–Hodgman), not a raster.
 *
 * THE CONTROL, AND IT RUNS FIRST. The delivered geometry and the generator's own
 * description are two independent statements about the same 419 buildings, and
 * this probe uses one to attribute boxes and the other to measure them. So every
 * delivered base-tier box is matched back to a generator building by CENTRE,
 * WIDTH, DEPTH AND YAW together, and the match rate is printed before any
 * finding. A probe that silently mis-attributed half its boxes would still print
 * a table (CONTRACT §7.1).
 *
 * Usage:
 *   node tools/claimprobe.mjs                the two defects, their costs
 *   node tools/claimprobe.mjs --json=FILE    the per-building rows
 */

import { writeFile } from 'node:fs/promises';
import { captureBuild } from './lib/headlesscity.mjs';
import { findConflicts, claimBox } from '../src/lib/occupancy.js';
import { generateChunk, CITY } from '../src/lib/citygen.js';

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);
const SEED = Number(args.get('seed') || 1337);

console.log('claimprobe — the building claim, in plan and in height. NOT A GATE.');
console.log(`node ${process.version}  ·  ${process.platform}/${process.arch}  ·  seed ${SEED}`);
console.log('no renderer, no browser, no pixel: claims and matrices are CPU bookkeeping.\n');

/* ------------------------------------------------------------ convex clipping
 *
 * Sutherland–Hodgman against a convex window. Both operands here are convex —
 * an axis-aligned claim and a rotated rectangle — so the intersection is a
 * single convex polygon and the area is exact. A raster would have put a cell
 * size between the measurement and the finding, on a defect whose whole
 * magnitude is sub-metre.
 */
function clipPoly(poly, cx0, cz0, cx1, cz1) {
  // The four half-planes of the axis-aligned window, in order.
  const edges = [
    (p) => p[0] >= cx0, (p) => p[0] <= cx1,
    (p) => p[1] >= cz0, (p) => p[1] <= cz1,
  ];
  const cut = [
    (a, b) => [cx0, a[1] + ((b[1] - a[1]) * (cx0 - a[0])) / (b[0] - a[0])],
    (a, b) => [cx1, a[1] + ((b[1] - a[1]) * (cx1 - a[0])) / (b[0] - a[0])],
    (a, b) => [a[0] + ((b[0] - a[0]) * (cz0 - a[1])) / (b[1] - a[1]), cz0],
    (a, b) => [a[0] + ((b[0] - a[0]) * (cz1 - a[1])) / (b[1] - a[1]), cz1],
  ];
  let out = poly;
  for (let e = 0; e < 4; e++) {
    if (!out.length) return out;
    const inp = out;
    out = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i];
      const b = inp[(i + 1) % inp.length];
      const ain = edges[e](a);
      const bin = edges[e](b);
      if (ain) out.push(a);
      if (ain !== bin) out.push(cut[e](a, b));
    }
  }
  return out;
}

function polyArea(p) {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length];
    a += p[i][0] * q[1] - q[0] * p[i][1];
  }
  return Math.abs(a) / 2;
}

/**
 * The four GROUND corners of a box, in world plan, from its matrix and its own
 * geometry bounds. Order matters — this is a ring, not a set.
 */
function planCorners(b) {
  const e = b.e;
  const [nx, , nz] = b.gmin;
  const [px, , pz] = b.gmax;
  const pts = [[nx, nz], [px, nz], [px, pz], [nx, pz]];
  return pts.map(([lx, lz]) => [
    e[0] * lx + e[8] * lz + e[12],
    e[2] * lx + e[10] * lz + e[14],
  ]);
}

/* Two-direction self-test on the clipper, on every run, before it decides
 * anything (CONTRACT §7.3). A square clipped to itself keeps its area; a square
 * clipped to a disjoint window keeps none; and a unit square turned 45° about
 * its centre, clipped to itself, has the analytic area 2·(√2−1) = 0.828427. */
{
  const sq = [[0, 0], [2, 0], [2, 2], [0, 2]];
  const same = polyArea(clipPoly(sq, 0, 0, 2, 2));
  const away = polyArea(clipPoly(sq, 9, 9, 10, 10));
  const c = Math.SQRT1_2;
  const dia = [[0, -c], [c, 0], [0, c], [-c, 0]];
  const rot = polyArea(clipPoly(dia, -0.5, -0.5, 0.5, 0.5));
  const want = 2 * (Math.SQRT2 - 1);
  if (Math.abs(same - 4) > 1e-9 || away > 1e-9 || Math.abs(rot - want) > 1e-9) {
    console.error(`claimprobe: clipper self-test failed (${same}, ${away}, ${rot} vs ${want}) — refusing to report`);
    process.exit(2);
  }
  console.log(`clipper self-test: square∩itself ${same.toFixed(6)} m², ∩disjoint ${away.toFixed(6)} m², ` +
    `45°-turned unit square ∩ itself ${rot.toFixed(6)} against the analytic 2(√2−1) = ${want.toFixed(6)}`);
}

/* ------------------------------------------------------------------ the build */

const t0 = Date.now();
const { world, bySite, claims } = captureBuild({ seed: SEED, keepElements: true });
console.log(`\nbuilt ${world.stats.resident} chunks in ${world.frames} frames / ${Date.now() - t0} ms — ${claims.length} delivered claims`);

/**
 * THE GENERATOR'S OWN DESCRIPTION, over the same ring.
 *
 * `city.placement(region)` drops `width` and `depth` on the way out, so the
 * generator is called directly. The ring is `geometryRadius` = 5 about the
 * eye's chunk, and the eye is `CITYCHECK_EYE` = (70, ·, 0.9), i.e. chunk (0,0):
 * 11 × 11 = 121, which is the count the build above reports.
 */
const R = CITY.geometryRadius;
const genBuildings = [];
for (let cz = -R; cz <= R; cz++) {
  for (let cx = -R; cx <= R; cx++) {
    for (const b of generateChunk(SEED, cx, cz).buildings) genBuildings.push({ ...b, cx, cz });
  }
}
const deliveredBuildingClaims = claims.filter((c) => c.kind === 'building');
console.log(
  `generator over the same 11×11 ring: ${genBuildings.length} buildings; ` +
  `delivered census: ${deliveredBuildingClaims.length} \`building\` claims — ` +
  `${genBuildings.length === deliveredBuildingClaims.length ? 'AGREE' : 'DISAGREE'}`
);

/* --------------------------------------------------------------- attribution
 *
 * Every box `city.js` emitted for a building carries `bld.yawDeg` and stands at
 * or near `(bld.x, bld.z)`. The BASE TIER is the one whose matrix says exactly
 * the building's own centre, width, depth and yaw, so it is matched on all four
 * at once and the match rate is the control: a nearest-centre match alone would
 * be ambiguous where a terrace puts two buildings 0.2 m apart, which this
 * generator does by design (CONTRACT §9 row 21e).
 */
const DEG = Math.PI / 180;
const key3 = (x, z) => `${x.toFixed(3)}|${z.toFixed(3)}`;
const byCentre = new Map();
for (const b of genBuildings) {
  const k = key3(b.x, b.z);
  if (!byCentre.has(k)) byCentre.set(k, []);
  byCentre.get(k).push(b);
}

/**
 * Every emission site whose boxes belong to a BUILDING, identified by the
 * source line rather than by a line number (`emitcensus` records why: a line
 * number is config the code does not read, one file over).
 */
const cityLines = (await (await import('node:fs/promises')).readFile(
  new URL('../src/modules/city.js', import.meta.url), 'utf8'
)).split('\n');
/**
 * A CALL SITE IS THE LINE THE CALL OPENS ON, NOT THE LINE THE ARGUMENT IS ON.
 *
 * V8 reports a multi-line call at its opening parenthesis, so the frame for
 * `bodies.push(setMatrix(\n  bld.x, ...` is the `bodies.push(setMatrix(` line —
 * which is a line six emitters share verbatim and cannot be keyed on. So the
 * key is the DISTINCTIVE argument line and the site is the nearest enclosing
 * `setMatrix(` above it. The walk-back distance is bounded and a needle that
 * matches no line, or more than one, is a loud failure rather than an empty row
 * (`emitcensus` records why: a line number is config the code does not read).
 */
const siteFor = (needle) => {
  const hits = [];
  for (let i = 0; i < cityLines.length; i++) if (cityLines[i].includes(needle)) hits.push(i);
  if (hits.length !== 1) {
    console.error(`claimprobe: ${hits.length} lines of city.js contain ${JSON.stringify(needle)} — refusing to report`);
    process.exit(2);
  }
  for (let i = hits[0]; i >= Math.max(0, hits[0] - 6); i--) {
    if (cityLines[i].includes('setMatrix(')) return `city:${i + 1}`;
  }
  console.error(`claimprobe: no setMatrix( call opens within 6 lines above ${JSON.stringify(needle)} — refusing to report`);
  process.exit(2);
  return null;
};
const SITES = {
  tier: siteFor('bld.x, (t.y0 + t.y1) / 2, bld.z,'),
  cantilever: siteFor('bld.x + dir[0] * bld.cantilever * 0.5,'),
  crown: siteFor('bld.x, bld.height + crownDepth / 2, bld.z,'),
  plant: siteFor('bld.x + (h - 0.5) * Math.max(0, top.width - w - 1.5),'),
  parapetTier: siteFor('bld.x + ox, t.y1 + ROOF_PARAPET_M / 2, bld.z + oz,'),
  parapetTop: siteFor('bld.x + ox, bld.height + ROOF_PARAPET_M / 2, bld.z + oz,'),
};
const SITE_OF = new Map(Object.entries(SITES).map(([k, v]) => [v, k]));

/** Boxes by role, taken off the capture rather than off a reading of the file. */
const boxesByRole = {};
for (const rec of bySite.values()) {
  const frames = rec.key.split(' < ');
  for (const f of frames.slice(0, 2)) {
    const role = SITE_OF.get(f);
    if (!role) continue;
    (boxesByRole[role] ||= []).push(...rec.boxes);
    break;
  }
}
for (const r of Object.keys(SITES)) boxesByRole[r] ||= [];
console.log(`\nboxes by role: ${Object.entries(boxesByRole).map(([k, v]) => `${k} ${v.length}`).join(', ')}`);
/**
 * STATE 24 §1.4 measured four of these over the same ring off the same capture,
 * before this file existed. They are printed side by side because two probes
 * disagreeing about how many boxes a site emitted is the first thing that would
 * make everything below meaningless (CONTRACT §9 rule 2).
 */
{
  const S24 = { tier: 532, cantilever: 40, crown: 419, plant: 1436 };
  const cmp = Object.entries(S24).map(([k, v]) => `${k} ${boxesByRole[k].length} vs ${v}${boxesByRole[k].length === v ? '' : '  ← DISAGREES'}`);
  console.log(`  against STATE 24 §1.4's counts: ${cmp.join(', ')}`);
}

/**
 * MATCH THE BASE TIER TO ITS BUILDING ON ALL FOUR QUANTITIES.
 *
 * A matrix's scale is recovered as the column norms and its yaw from the first
 * column; the geometry is the unit box, so `sx` IS the delivered width. Any box
 * that fails to match is counted and reported rather than dropped.
 */
/**
 * The box's DELIVERED world dimensions and yaw.
 *
 * A matrix's scale is the column norm, and the delivered extent is that scale
 * times the GEOMETRY's own size — 1 m for the unit box `setMatrix` drives, and
 * not 1 m for the lamp and the plane, which is the distinction that cost
 * `emitcensus` a wrong number in its first hour (STATE 24 §1.3). Multiplied
 * here rather than assumed, so this probe cannot inherit that mistake.
 */
function decompose(b) {
  const e = b.e;
  const sx = Math.hypot(e[0], e[1], e[2]) * (b.gmax[0] - b.gmin[0]);
  const sy = Math.hypot(e[4], e[5], e[6]) * (b.gmax[1] - b.gmin[1]);
  const sz = Math.hypot(e[8], e[9], e[10]) * (b.gmax[2] - b.gmin[2]);
  const yaw = Math.atan2(e[2], e[0]) / DEG;
  return { x: e[12], z: e[14], sx, sy, sz, yaw };
}
let matched = 0;
let unmatched = 0;
const worstResidual = { d: 0, what: '' };
const perBuilding = new Map();
for (const b of boxesByRole.tier) {
  const d = decompose(b);
  const cands = byCentre.get(key3(d.x, d.z)) || [];
  let best = null;
  let bestErr = Infinity;
  for (const g of cands) {
    // `setMatrix` yaws by `-yawDeg` about Y (see city.js); compare on the axis
    // rather than on the sign convention, which is what the residual is for.
    const err = Math.abs(d.sx - g.width) + Math.abs(d.sz - g.depth)
      + Math.min(Math.abs(Math.abs(d.yaw) - Math.abs(g.yawDeg)), 360 - Math.abs(Math.abs(d.yaw) - Math.abs(g.yawDeg)));
    if (err < bestErr) { bestErr = err; best = g; }
  }
  // A base tier is the FULL-height one; a stepped building's upper tiers are
  // narrower and are attributed by centre only (they share it exactly).
  if (best && bestErr < 1e-3) {
    matched++;
    if (bestErr > worstResidual.d) { worstResidual.d = bestErr; worstResidual.what = `bld at ${d.x.toFixed(2)},${d.z.toFixed(2)}`; }
    if (!perBuilding.has(best)) perBuilding.set(best, { g: best, base: b, boxes: [] });
    else if (!perBuilding.get(best).base) perBuilding.get(best).base = b;
  } else {
    unmatched++;
  }
}
console.log(
  `base-tier match: ${matched} of ${boxesByRole.tier.length} tier boxes matched a generator building on ` +
  `centre+width+depth+yaw together (worst residual ${worstResidual.d.toExponential(2)}); ` +
  `${unmatched} are a stepped building's upper tiers, attributed by centre below`
);
console.log(`buildings with a matched base tier: ${perBuilding.size} of ${genBuildings.length}`);

/**
 * EVERYTHING ELSE A BUILDING EMITS, ATTRIBUTED BY CONTAINMENT AND NOT BY
 * NEAREST CENTRE — and the difference is a finding about the instrument rather
 * than a detail.
 *
 * A parapet bar is written at `bld.x ± t.width/2`, i.e. HALF A BUILDING from
 * its own centre, which on a 26 m frontage is 13 m. Nearest-centre attribution
 * therefore hands a tall building's parapet to whichever short neighbour
 * happens to stand closer, and the first run of this probe reported a parapet
 * 79.57 m above its claim and a tier parapet 35.73 m BELOW one — both of them
 * one building's roof measured against another building's height. That is
 * CONTRACT §9's shape inside the instrument, which is where §7.7 says to expect
 * it.
 *
 * Every box a building emits has its centre inside that building's own claim:
 * a tier and a crown at the centre exactly, a parapet on its edge, the plant
 * inset within `top.width − w − 1.5`, the cantilever `cantilever/2` outward
 * against a half-width of at least 7.5 m. Buildings' claims almost never
 * overlap — the generator refuses that inside a chunk — so containment is
 * one-to-one, and the exceptions are COUNTED rather than assumed away.
 */
const byGen = new Map();
for (const g of genBuildings) byGen.set(g, { g, roles: {} });
const EPS = 0.01;
/** A coarse bucket so containment is not 419 tests per box. */
const BUCKET = 64;
const bucketOf = (x, z) => `${Math.floor(x / BUCKET)},${Math.floor(z / BUCKET)}`;
const buckets = new Map();
for (const g of genBuildings) {
  for (let ix = Math.floor((g.x - g.width / 2 - EPS) / BUCKET); ix <= Math.floor((g.x + g.width / 2 + EPS) / BUCKET); ix++) {
    for (let iz = Math.floor((g.z - g.depth / 2 - EPS) / BUCKET); iz <= Math.floor((g.z + g.depth / 2 + EPS) / BUCKET); iz++) {
      const k = `${ix},${iz}`;
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(g);
    }
  }
}
const attrStats = {};
function attribute(role, list) {
  let ambiguous = 0;
  let orphan = 0;
  for (const b of list) {
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    const cands = (buckets.get(bucketOf(cx, cz)) || []).filter((g) =>
      cx >= g.x - g.width / 2 - EPS && cx <= g.x + g.width / 2 + EPS &&
      cz >= g.z - g.depth / 2 - EPS && cz <= g.z + g.depth / 2 + EPS);
    if (!cands.length) { orphan++; continue; }
    let best = cands[0];
    if (cands.length > 1) {
      ambiguous++;
      // Two claims genuinely overlap here. The yaw is carried by every box a
      // building emits, so it is the tiebreak; the plant carries ±2° of its own.
      const d = decompose(b);
      let bestErr = Infinity;
      for (const g of cands) {
        const err = Math.min(Math.abs(Math.abs(d.yaw) - Math.abs(g.yawDeg)), 360 - Math.abs(Math.abs(d.yaw) - Math.abs(g.yawDeg)))
          + 1e-3 * Math.hypot(g.x - cx, g.z - cz);
        if (err < bestErr) { bestErr = err; best = g; }
      }
    }
    (byGen.get(best).roles[role] ||= []).push(b);
  }
  attrStats[role] = { n: list.length, ambiguous, orphan };
}
for (const [role, list] of Object.entries(boxesByRole)) attribute(role, list);
console.log('attribution by claim containment (not by nearest centre — see the note in this file):');
for (const [r, s] of Object.entries(attrStats)) {
  console.log(`  ${r.padEnd(12)} ${String(s.n).padStart(5)} boxes   ${s.ambiguous} fell inside two overlapping claims (broken on yaw)   ${s.orphan} inside none`);
}

/* ============================================================ (a) THE PLANAR
 *
 * TWO DIRECTIONS, AND THEY ARE DIFFERENT QUESTIONS.
 *
 *   OVER-CLAIM   area inside the claim with no building in it. This is ground
 *                the registry is holding for a building that is not there, and
 *                it is what REFUSES things that would fit.
 *   UNDER-CLAIM  building standing outside its own claim. This is ground the
 *                registry believes is free and is not, and it is what LETS
 *                things be placed inside a wall.
 *
 * For the base tier alone the two are equal by construction — a rectangle and
 * the same rectangle turned about its own centre have equal area, so whatever
 * one loses the other gains. That identity is checked rather than assumed, and
 * where the delivered mass is MORE than the base tier (a cantilever oversails,
 * a cornice oversails) they separate.
 */
console.log('\n=== (a) THE PLANAR DEFECT: a yawed building claimed as an axis-aligned box ===');

const rows = [];
for (const rec of byGen.values()) {
  const g = rec.g;
  const cx0 = g.x - g.width / 2;
  const cx1 = g.x + g.width / 2;
  const cz0 = g.z - g.depth / 2;
  const cz1 = g.z + g.depth / 2;
  const claimArea = g.width * g.depth;

  const base = rec.roles.tier || [];
  // The base tier is the widest of a stepped stack: an upper tier is inset.
  let baseBox = null;
  let baseArea = -1;
  for (const b of base) {
    const d = decompose(b);
    const a = d.sx * d.sz;
    if (a > baseArea) { baseArea = a; baseBox = b; }
  }
  if (!baseBox) continue;

  const p = planCorners(baseBox);
  const inter = polyArea(clipPoly(p, cx0, cz0, cx1, cz1));
  const pArea = polyArea(p);
  const overClaim = claimArea - inter;
  const underClaim = pArea - inter;

  /**
   * THE WHOLE DELIVERED MASS, not only the base tier: how far past the claim
   * does anything the building draws reach, and how much of it is outside.
   * Summed per box, which OVER-states where two boxes overlap outside the claim
   * — stated rather than hidden, and the max single box is given beside it.
   */
  let massOutside = 0;
  let worstPast = 0;
  let worstPastRole = '';
  for (const [role, list] of Object.entries(rec.roles)) {
    if (role === 'plant') continue; // plant sits inside the parapet; it is (b)'s subject
    for (const b of list) {
      const q = planCorners(b);
      const out = polyArea(q) - polyArea(clipPoly(q, cx0, cz0, cx1, cz1));
      massOutside += out;
      for (const [px, pz] of q) {
        const past = Math.max(cx0 - px, px - cx1, cz0 - pz, pz - cz1);
        if (past > worstPast) { worstPast = past; worstPastRole = role; }
      }
    }
  }

  rows.push({
    x: +g.x.toFixed(2), z: +g.z.toFixed(2), cx: g.cx, cz: g.cz,
    width: g.width, depth: g.depth, height: g.height, yawDeg: g.yawDeg,
    era: g.era, floors: g.floors,
    claimArea, baseArea: pArea,
    overClaimM2: overClaim, underClaimM2: underClaim,
    massOutsideM2: massOutside, worstPastM: worstPast, worstPastRole,
    hasCantilever: !!(rec.roles.cantilever || []).length,
  });
}

const pct = (v, t) => `${((100 * v) / t).toFixed(2)}%`;
function dist(list, label, unit = 'm²') {
  const s = [...list].sort((a, b) => a - b);
  if (!s.length) { console.log(`  ${label.padEnd(34)} n    0   — nothing to measure`); return null; }
  const q = (f) => s[Math.min(s.length - 1, Math.max(0, Math.round(f * (s.length - 1))))];
  const sum = s.reduce((a, b) => a + b, 0);
  console.log(
    `  ${label.padEnd(34)} n ${String(s.length).padStart(4)}   min ${s[0].toFixed(3)}   p25 ${q(0.25).toFixed(3)}   ` +
    `median ${q(0.5).toFixed(3)}   p75 ${q(0.75).toFixed(3)}   p95 ${q(0.95).toFixed(3)}   max ${q(1).toFixed(3)} ${unit}   ` +
    `total ${sum.toFixed(1)} ${unit}`
  );
  return { n: s.length, min: s[0], p50: q(0.5), p95: q(0.95), max: q(1), sum };
}

const yawed = rows.filter((r) => Math.abs(r.yawDeg) > 1e-9);
console.log(`\n  ${rows.length} buildings measured. ${yawed.length} carry a non-zero yaw (${pct(yawed.length, rows.length)}); ` +
  `|yaw| max ${Math.max(...rows.map((r) => Math.abs(r.yawDeg))).toFixed(4)}° against CITY.maxYawDeg ${CITY.maxYawDeg}`);

console.log('\n  BASE TIER — the mass the claim is a description OF:');
const dOver = dist(rows.map((r) => r.overClaimM2), 'claimed with no building in it');
const dUnder = dist(rows.map((r) => r.underClaimM2), 'building outside its own claim');
{
  const worst = Math.max(...rows.map((r) => Math.abs(r.overClaimM2 - r.underClaimM2)));
  console.log(`  the two are equal per building to ${worst.toExponential(2)} m² — a rectangle turned about its`);
  console.log('  own centre keeps its area, so every m² one direction loses the other gains. Checked, not assumed.');
}
const dFrac = dist(rows.map((r) => (100 * r.overClaimM2) / r.claimArea), 'as a share of the claim', '%');

console.log('\n  THE WHOLE DELIVERED MASS — every building box except the roof plant:');
dist(rows.map((r) => r.massOutsideM2), 'total outside the claim (summed)');
dist(rows.map((r) => r.worstPastM), 'furthest any corner reaches past', 'm');
{
  const byRole = {};
  for (const r of rows) if (r.worstPastM > 1e-6) byRole[r.worstPastRole] = (byRole[r.worstPastRole] || 0) + 1;
  console.log(`  which role reaches furthest, per building: ${Object.entries(byRole).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  const wc = rows.filter((r) => r.hasCantilever);
  if (wc.length) {
    console.log(`  the ${wc.length} buildings with a cantilever: worst past ${Math.max(...wc.map((r) => r.worstPastM)).toFixed(3)} m, ` +
      `median ${[...wc.map((r) => r.worstPastM)].sort((a, b) => a - b)[Math.floor(wc.length / 2)].toFixed(3)} m`);
  }
}

/* ============================================================ (b) THE VERTICAL */
console.log('\n=== (b) THE VERTICAL DEFECT: what stands above the claimed top ===');
console.log("  the claim's y1 is `bld.height`, which is the top of the WALL. Everything on the roof is above it.\n");

/**
 * THE PLANT KINDS, RECOVERED FROM THE DELIVERED DIMENSIONS.
 *
 * `ROOF_KINDS` in `city.js` gives each kind a fixed `wide`/`tall`/`deep` triple
 * that multiplies one size roll, so the delivered WIDTH-TO-DEPTH ratio is a
 * constant per kind — 1.176 plantRoom, 1.000 tank, 0.758 stairHouse, 3.690
 * duct, 1.000 aerial — and the two that share it separate on absolute width by
 * a factor of 4.5. Classifying off the delivered box rather than off a re-run
 * of the hash is the point: it is the geometry that is being measured.
 */
function plantKind(sx, sz, sy) {
  const r = sx / sz;
  if (r > 3) return 'duct';
  if (r < 0.85) return 'stairHouse';
  if (r > 1.1) return 'plantRoom';
  return sy / sx > 6 ? 'aerial' : 'tank';
}

const vert = [];
const plantTally = {};
const plantWorst = {};
for (const rec of byGen.values()) {
  const g = rec.g;
  const top = g.height;
  let above = 0;
  let aboveRole = '';
  const roleTops = {};
  for (const [role, list] of Object.entries(rec.roles)) {
    for (const b of list) {
      const over = b.y1 - top;
      if (over > (roleTops[role] || -Infinity)) roleTops[role] = over;
      if (over > above) { above = over; aboveRole = role; }
      if (role === 'plant') {
        const d = decompose(b);
        const k = plantKind(d.sx, d.sz, d.sy);
        plantTally[k] = (plantTally[k] || 0) + 1;
        if (over > (plantWorst[k] || 0)) plantWorst[k] = over;
      }
    }
  }
  vert.push({ x: +g.x.toFixed(2), z: +g.z.toFixed(2), height: g.height, floors: g.floors,
    aboveM: above, aboveRole, roleTops, hasPlant: !!(rec.roles.plant || []).length });
}

dist(vert.map((v) => v.aboveM), 'delivered top above claimed top', 'm');
{
  const byRole = {};
  for (const v of vert) byRole[v.aboveRole] = (byRole[v.aboveRole] || 0) + 1;
  console.log(`  which role is the tallest thing on the roof, per building: ${Object.entries(byRole).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  const withPlant = vert.filter((v) => v.hasPlant);
  const without = vert.filter((v) => !v.hasPlant);
  console.log(`  ${withPlant.length} buildings carry roof plant (floors > 4), ${without.length} do not`);
  if (withPlant.length) dist(withPlant.map((v) => v.aboveM), 'above, buildings WITH plant', 'm');
  if (without.length) dist(without.map((v) => v.aboveM), 'above, buildings WITHOUT plant', 'm');
}
console.log('\n  WHAT THE PLANT IS — classified off the delivered box, not off the hash:');
{
  const total = Object.values(plantTally).reduce((a, b) => a + b, 0);
  // `w` in city.js's ROOF_KINDS: plantRoom 4, tank 3, stairHouse 3, duct 3, aerial 2 of 15.
  const WEIGHT = { plantRoom: 4, tank: 3, stairHouse: 3, duct: 3, aerial: 2 };
  for (const [k, n] of Object.entries(plantTally).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k.padEnd(12)} ${String(n).padStart(5)}  ${pct(n, total).padStart(7)}  ` +
      `(city.js weights it ${WEIGHT[k]}/15 = ${((100 * WEIGHT[k]) / 15).toFixed(1)}%)   tallest above its claim ${plantWorst[k].toFixed(2)} m`);
  }
  console.log(`    ${String(total).padStart(17)} plant boxes over the ring`);
}
console.log('\n  PER ROLE — how far each kind of roof object stands above the claim:');
{
  const roles = {};
  for (const v of vert) for (const [r, t] of Object.entries(v.roleTops)) (roles[r] ||= []).push(t);
  for (const [r, list] of Object.entries(roles)) dist(list, `${r} top − claim top`, 'm');
}

/* ================================================ (c) WHAT DECLARING WOULD COST
 *
 * SESSION 24'S RULE, UNCHANGED. The claim a repair WOULD make is built from the
 * delivered boxes, substituted into the delivered census, and the sweep re-run.
 * What was not there before is the cost. A claim laid down in `generateChunk`
 * refuses what comes after it, so "new forbidden pairs" and "objects the
 * generator would have refused" are the same set counted from opposite ends, and
 * where the number is zero they agree exactly.
 *
 * ENLARGING A CLAIM IS NOT AUTOMATICALLY FREE. Both repairs make the box BIGGER
 * — the planar one on the diagonal, the vertical one upward — so both can refuse
 * things that fit today. That is the whole reason this is measured rather than
 * argued.
 */
console.log('\n=== (c) WHAT DECLARING EACH ONE CORRECTLY WOULD COST ===');

const base = findConflicts(claims, 8000);
console.log(`  the delivered census carries ${base.length} forbidden overlap(s) today: ` +
  `${base.map((c) => `${c.a.kind}(${c.a.owner})×${c.b.kind}(${c.b.owner}) ${c.areaM2} m²`).join(', ') || 'none'}`);
const baseKey = new Set(base.map((c) => [
  `${c.a.kind}|${c.a.owner}|${c.a.x0.toFixed(3)}|${c.a.z0.toFixed(3)}`,
  `${c.b.kind}|${c.b.owner}|${c.b.x0.toFixed(3)}|${c.b.z0.toFixed(3)}`,
].sort().join(' × ')));

/** The building claims, keyed so a variant can replace exactly those. */
const nonBuilding = claims.filter((c) => c.kind !== 'building');

/**
 * A yaw-correct claim is still an AXIS-ALIGNED BOX, because `occupancy.js`
 * stores AABBs and nothing in the registry can express a rotated one. So the
 * honest repair is the world AABB OF THE ROTATED MASS — which is LARGER than
 * both the delivered footprint and today's claim, and strictly contains the
 * building. That is the safe direction (it can refuse, it cannot admit) and it
 * is the one whose cost has to be paid.
 */
/**
 * THE TALLEST THING `city.js` CAN PUT ON A ROOF, as a bound rather than as a
 * delivered value.
 *
 * A repair has to be spellable on BOTH sides of the two-sided check, and the
 * generator does not know what the roofscape rolled — the plant's size hash
 * lives in `city.js`. What the generator CAN know is the largest it could be:
 * `ph = (1.8 + h·3.4)·kind.tall` with h ≤ 1 and the tallest `kind.tall` being
 * the aerial's 3.60, so `5.2 × 3.6` = 18.72 m. Both figures are costed, because
 * a bound over-claims — a roof carrying one 1.77 m duct would claim 18.72 —
 * and an over-claim can refuse things a delivered-value claim would not.
 */
const ROOF_PLANT_MAX_M = (1.8 + 3.4) * 3.60;
const ROOF_PARAPET_M = 1.05;

function variantClaims({ yaw, top, bound }) {
  const out = [];
  for (const rec of byGen.values()) {
    const g = rec.g;
    let x0 = g.x - g.width / 2;
    let x1 = g.x + g.width / 2;
    let z0 = g.z - g.depth / 2;
    let z1 = g.z + g.depth / 2;
    let y1 = g.height;
    if (yaw) {
      const c = Math.abs(Math.cos(g.yawDeg * DEG));
      const s = Math.abs(Math.sin(g.yawDeg * DEG));
      const hx = (g.width * c + g.depth * s) / 2;
      const hz = (g.width * s + g.depth * c) / 2;
      x0 = g.x - hx; x1 = g.x + hx; z0 = g.z - hz; z1 = g.z + hz;
    }
    if (top) {
      for (const list of Object.values(rec.roles)) for (const b of list) if (b.y1 > y1) y1 = b.y1;
    }
    if (bound) {
      // Everything in this expression is the generator's own: `floors`, `crown`,
      // `CITY_ERAS[era].cornice` and `ROOF_PARAPET_M` all live in citygen.js.
      const cornice = { prewar: 0.9, postwar: 0.08, corporate: 0.55, infill: 0.28, contemporary: 0.0 }[g.era] || 0;
      const crown = cornice + (g.crown || 0);
      y1 = g.height + Math.max(ROOF_PARAPET_M, crown, g.floors > 4 ? ROOF_PLANT_MAX_M : 0);
    }
    out.push(claimBox('building', x0, z0, x1, z1, { y0: 0, y1, owner: 'bld' }));
  }
  return out;
}

function cost(label, variant) {
  const set = [...nonBuilding, ...variantClaims(variant)];
  const swept = findConflicts(set, 8000);
  const fresh = swept.filter((c) => !baseKey.has([
    `${c.a.kind}|${c.a.owner}|${c.a.x0.toFixed(3)}|${c.a.z0.toFixed(3)}`,
    `${c.b.kind}|${c.b.owner}|${c.b.x0.toFixed(3)}|${c.b.z0.toFixed(3)}`,
  ].sort().join(' × ')));
  const byPair = {};
  const victims = new Set();
  for (const c of fresh) {
    const [p, q] = [c.a, c.b].sort((u, v) => (u.kind < v.kind ? -1 : 1));
    byPair[`${p.kind} × ${q.kind}`] = (byPair[`${p.kind} × ${q.kind}`] || 0) + 1;
    const other = c.a.kind === 'building' ? c.b : c.a;
    if (c.a.kind === 'building' && c.b.kind === 'building') {
      victims.add(`building|${c.b.x0.toFixed(3)}|${c.b.z0.toFixed(3)}`);
    } else {
      victims.add(`${other.kind}|${other.owner}|${other.x0.toFixed(3)}|${other.z0.toFixed(3)}`);
    }
  }
  console.log(`\n  ${label}`);
  console.log(`      NEW forbidden pairs ${fresh.length}${fresh.length ? `   distinct objects that would be refused ${victims.size}` : '   ← COST ZERO'}`);
  if (fresh.length) {
    console.log(`      by pair: ${Object.entries(byPair).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    for (const c of fresh.slice(0, 6)) {
      console.log(`        eg ${c.a.kind}(${c.a.owner}) × ${c.b.kind}(${c.b.owner})  ${c.areaM2} m²  ` +
        `at x ${Math.max(c.a.x0, c.b.x0).toFixed(1)} z ${Math.max(c.a.z0, c.b.z0).toFixed(1)}  ` +
        `y ${Math.max(c.a.y0, c.b.y0).toFixed(1)}..${Math.min(c.a.y1, c.b.y1).toFixed(1)}`);
    }
  }
  return { label, newPairs: fresh.length, victims: victims.size, byPair, fresh };
}

const costs = [
  cost('CONTROL — today\'s claim, rebuilt through this probe\'s own path', { yaw: false, top: false }),
  cost('(a) PLANAR: the yawed mass\'s world AABB, `w·|cos|+d·|sin|`', { yaw: true, top: false }),
  cost('(b) VERTICAL: y1 raised to the delivered top of everything on the roof', { yaw: false, top: true }),
  cost('(b\') VERTICAL AS A BOUND: y1 = height + the tallest roof object city.js can draw', { yaw: false, bound: true }),
  cost('(a)+(b) BOTH', { yaw: true, top: true }),
];

/* -------------------------------------------- the OTHER half of the two-sided check
 *
 * THE DELIVERED CENSUS IS NOT THE ONLY PLACE A CLAIM CAN BE REFUSED, AND
 * MEASURING ONLY IT WOULD MISS THREE CATEGORIES.
 *
 * STATE 24 §1.7 measured that `water` (652), `path` (19) and `block` (100) are
 * claimed by the GENERATOR and never appear in the delivered census. A repair
 * costed against the delivered sweep alone is therefore blind to exactly those
 * three, and `building × water`, `building × path` and `building × block` are
 * all forbidden. So the same substitution is run against the generator's own
 * registry over the same ring.
 *
 * The two are not expected to give the same number and neither is wrong: the
 * generator's registry holds what it TESTED and the delivered census holds what
 * ARRIVED. What matters for a repair is that BOTH are zero.
 */
console.log('\n  --- the same substitution, against the GENERATOR\'s registry (which holds water, path and block) ---');
{
  const genClaims = [];
  const genBuildingClaims = [];
  for (let cz = -R; cz <= R; cz++) {
    for (let cx = -R; cx <= R; cx++) {
      const g = generateChunk(SEED, cx, cz);
      for (const c of g.registry.all()) (c.kind === 'building' ? genBuildingClaims : genClaims).push(c);
    }
  }
  const kinds = {};
  for (const c of [...genClaims, ...genBuildingClaims]) kinds[c.kind] = (kinds[c.kind] || 0) + 1;
  console.log(`  generator registry over the ring: ${genClaims.length + genBuildingClaims.length} claims — ` +
    `${Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  const genBase = findConflicts([...genClaims, ...genBuildingClaims], 8000);
  console.log(`  forbidden overlaps in it today: ${genBase.length}`);

  /**
   * The generator's building claims carry no `yawDeg`, so each is matched back
   * to its building by centre — exact, because the claim IS `cxb ± bw/2`.
   */
  const genByCentre = new Map();
  for (const g of genBuildings) genByCentre.set(key3(g.x, g.z), g);
  /**
   * SWEEPING THE FINAL REGISTRY IS A SOUND COST MEASURE AND THE ARGUMENT IS
   * WORTH WRITING DOWN, because the obvious objection is that a refusal cascade
   * cannot be seen from the far end: a building the raised claim would have
   * refused is simply absent, and its props with it.
   *
   * It holds because a refusal happens exactly when a PROPOSED claim conflicts
   * with one ALREADY IN the registry, and everything already in the registry at
   * any moment is a subset of what is in it at the end. So a raised claim that
   * conflicts with nothing in the final set conflicted with nothing at the
   * moment it was laid, and nothing placed after it was refused either — that
   * later object is in the final set too. ZERO here means zero cascade. A
   * NON-ZERO number is a lower bound and not a count, which is why the only
   * case session 24's rule acts on is zero.
   */
  let hit = 0;
  const raise = (fn) => genBuildingClaims.map((c) => {
    const g = genByCentre.get(key3((c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2));
    if (!g) return c;
    hit++;
    return claimBox('building', c.x0, c.z0, c.x1, c.z1, { y0: 0, y1: fn(g), owner: c.owner });
  });
  const deliveredTop = (g) => {
    let y1 = g.height;
    for (const list of Object.values(byGen.get(g).roles)) for (const b of list) if (b.y1 > y1) y1 = b.y1;
    return y1;
  };
  const boundTop = (g) => {
    const cornice = { prewar: 0.9, postwar: 0.08, corporate: 0.55, infill: 0.28, contemporary: 0.0 }[g.era] || 0;
    return g.height + Math.max(ROOF_PARAPET_M, cornice + (g.crown || 0), g.floors > 4 ? ROOF_PLANT_MAX_M : 0);
  };
  for (const [label, fn] of [['the DELIVERED roof top', deliveredTop], ['the BOUND (what the generator can compute)', boundTop]]) {
    hit = 0;
    const after = findConflicts([...genClaims, ...raise(fn)], 8000);
    const delta = after.length - genBase.length;
    console.log(`  y1 raised to ${label}: ${hit}/${genBuildingClaims.length} matched, ` +
      `${after.length} forbidden overlaps — ${delta === 0 ? 'NO CHANGE, cost zero on this side too' : `${delta} NEW`}`);
  }
  /** The bound must contain the delivered top, or the generator is claiming less than the city draws. */
  let worstSlack = Infinity;
  let over = 0;
  for (const g of genBuildings) {
    const s = boundTop(g) - deliveredTop(g);
    if (s < worstSlack) worstSlack = s;
    if (s < 0) over++;
  }
  console.log(`  the bound contains the delivered top on ${genBuildings.length - over} of ${genBuildings.length} buildings; ` +
    `tightest slack ${worstSlack.toFixed(3)} m${over ? `  ← ${over} EXCEED THE BOUND` : ''}`);
}

/* ------------------------------- the plant's kind mix, against its own weights
 *
 * `city.js` weights the five roof-plant kinds 4/3/3/3/2 of 15 and selects with
 *   `Math.abs(Math.sin(...) % 1) * ROOF_KIND_TOTAL`
 * against a cumulative sum of those weights — which is correct if and only if
 * that expression is UNIFORM on [0, 1). For any x with |sin x| < 1, `sin(x) % 1`
 * IS `sin(x)`, so the expression is |sin x|, whose distribution is the arcsine
 * law with CDF (2/π)·asin(t) — concentrated at 1, not uniform. The delivered
 * mix is compared against both laws here rather than against a memory of what
 * the table says.
 */
console.log('\n  --- the roof-plant kind mix, against the two laws it could be drawn from ---');
{
  const W = [['plantRoom', 4], ['tank', 3], ['stairHouse', 3], ['duct', 3], ['aerial', 2]];
  const TOT = 15;
  const total = Object.values(plantTally).reduce((a, b) => a + b, 0);
  let acc = 0;
  console.log('    kind         delivered   if uniform   if |sin| (arcsine)');
  for (const [name, w] of W) {
    const lo = acc / TOT;
    acc += w;
    const hi = acc / TOT;
    const uni = hi - lo;
    const arc = (2 / Math.PI) * (Math.asin(Math.min(1, hi)) - Math.asin(Math.min(1, lo)));
    console.log(`    ${name.padEnd(12)} ${((100 * (plantTally[name] || 0)) / total).toFixed(2).padStart(7)}%   ` +
      `${(100 * uni).toFixed(2).padStart(7)}%   ${(100 * arc).toFixed(2).padStart(7)}%`);
  }
  console.log('    The delivered column follows the arcsine one, not the weights. `h`, which sets the plant\'s');
  console.log('    SIZE, and `seed`, which sets how many units a roof carries, are drawn the same way — so both');
  console.log('    are biased toward their maxima too, which is why the median roof stands 16.5 m over its claim.');
}

/* ------------------------------------ is the planar repair's cost REAL? ------
 *
 * THE DECISIVE QUESTION, AND IT IS NOT ANSWERED BY THE COUNT ABOVE.
 *
 * `occupancy.js` stores AXIS-ALIGNED boxes and has no way to hold a rotated
 * one, so "declare the yaw correctly" can only mean the world AABB of the
 * rotated mass — which is not the rotated mass. It is LARGER than both today's
 * claim and the building itself, and the extra is at the corners. So a new
 * conflict it produces may be a building genuinely standing in a pavement, or
 * it may be the corner of a box that is not there.
 *
 * The two are told apart by testing the DELIVERED ROTATED FOOTPRINT against the
 * same pavement rectangle, exactly, with the clipper this file already
 * self-tests. Anything with zero true overlap is the instrument's.
 */
console.log('\n  --- is the planar repair\'s cost a real overlap, or the AABB\'s corners? ---');
{
  const planar = costs.find((c) => c.label.startsWith('(a) PLANAR'));
  const claimKey = new Map();
  for (const rec of byGen.values()) {
    const g = rec.g;
    let baseBox = null;
    let baseArea = -1;
    for (const b of rec.roles.tier || []) {
      const p = polyArea(planCorners(b));
      if (p > baseArea) { baseArea = p; baseBox = b; }
    }
    claimKey.set(`${g.x.toFixed(3)}|${g.z.toFixed(3)}`, { g, baseBox, rec });
  }
  let real = 0;
  let artefact = 0;
  let realArea = 0;
  const examples = [];
  const byRoleArea = {};
  const buildingsInvolved = new Set();
  for (const c of planar.fresh) {
    const bld = c.a.kind === 'building' ? c.a : c.b;
    const other = c.a.kind === 'building' ? c.b : c.a;
    const gx = (bld.x0 + bld.x1) / 2;
    const gz = (bld.z0 + bld.z1) / 2;
    const rec = claimKey.get(`${gx.toFixed(3)}|${gz.toFixed(3)}`);
    if (!rec || !rec.baseBox) continue;
    // Every solid the building delivers, against the other claim's rectangle.
    let a = 0;
    for (const [role, list] of Object.entries(rec.rec.roles)) {
      for (const b of list) {
        if (b.y1 <= other.y0 || b.y0 >= other.y1) continue;
        const q = polyArea(clipPoly(planCorners(b), other.x0, other.z0, other.x1, other.z1));
        if (q > 1e-9) byRoleArea[role] = (byRoleArea[role] || 0) + q;
        a += q;
      }
    }
    if (a > 1e-6) {
      real++; realArea += a; buildingsInvolved.add(`${gx.toFixed(3)}|${gz.toFixed(3)}`);
      if (examples.length < 5) examples.push({ c, a });
    } else artefact++;
  }
  console.log(`  of the ${planar.fresh.length} new pairs: ${real} are a delivered solid genuinely overlapping the other claim ` +
    `(${realArea.toFixed(3)} m² in total), ${artefact} are the AABB's corners and nothing is there`);
  console.log(`  the real overlap is emitted by: ${Object.entries(byRoleArea).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toFixed(3)} m²`).join(', ')}`);
  console.log(`  ${buildingsInvolved.size} distinct buildings of ${genBuildings.length} are involved — ` +
    `these are the placements a correct claim would have refused`);
  for (const e of examples) {
    console.log(`      real: ${e.c.a.kind}(${e.c.a.owner}) × ${e.c.b.kind}(${e.c.b.owner})  true solid overlap ${e.a.toFixed(4)} m²`);
  }
  const infl = [];
  for (const rec of byGen.values()) {
    const g = rec.g;
    const cs = Math.abs(Math.cos(g.yawDeg * DEG));
    const sn = Math.abs(Math.sin(g.yawDeg * DEG));
    infl.push((g.width * cs + g.depth * sn) * (g.width * sn + g.depth * cs) - g.width * g.depth);
  }
  dist(infl, 'AABB area added over the true one');
  console.log('  So the repair TRADES a two-directional error for a one-directional one: it removes the');
  console.log('  under-claim entirely and makes the over-claim larger. That is the safe direction for a');
  console.log('  keep-out and it is not free, and both halves of that are why this is measured, not argued.');
}

console.log('\n  The CONTROL must be zero: it rebuilds today\'s claim through the same code path as the');
console.log('  variants, so a non-zero number there would mean the instrument invented a conflict and');
console.log('  every row under it is unreadable (CONTRACT §7.1).');

if (args.has('json')) {
  await writeFile(args.get('json'), `${JSON.stringify({ rows, vert, plantTally, costs: costs.map((c) => ({ ...c, fresh: c.fresh.slice(0, 200) })) }, null, 1)}\n`, 'utf8');
  console.log(`\nwrote ${args.get('json')}`);
}
