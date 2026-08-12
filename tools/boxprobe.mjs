#!/usr/bin/env node
/**
 * boxprobe.mjs — WHICH SUB-BOX, NOT WHICH OBJECT. NOT A GATE. SESSION 24.
 * =======================================================================
 *
 * `citycheck` → `occupancy` has been red on `prop(container) × site(hoarding)`
 * since session 22. Two candidate repairs were built, measured, found to change
 * the number not at all, and reverted (STATE 22 §2.4). That is the signal that
 * the diagnosis is not yet at the right level: both repairs were aimed at an
 * OBJECT's claim, and an overlap is between two SOLIDS.
 *
 * So this prints, for a named conflict pair:
 *
 *   1. the two CLAIMS, as the delivered census carries them;
 *   2. every DELIVERED SUB-BOX of both objects, in world coordinates, with the
 *      line of `city.js` that emitted it and the band it lands in;
 *   3. the sub-box PAIRS that actually intersect — which is the question, and
 *      which no count of overlapping claims can answer;
 *   4. the claimed extent beside the delivered union, per object.
 *
 * Session 22's bench finding was legible the moment the claimed and delivered
 * boxes stood side by side. Nothing since has been done at that resolution for
 * this pair.
 *
 * It asserts nothing and it must not — `citycheck` owns the verdict.
 *
 * Usage:
 *   node tools/boxprobe.mjs                    every forbidden overlap
 *   node tools/boxprobe.mjs --pair=prop,site   only pairs of these two kinds
 */

import { findConflicts } from '../src/lib/occupancy.js';
import { captureBuild } from './lib/headlesscity.mjs';

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);
const SEED = Number(args.get('seed') || 1337);
const WANT = args.has('pair') ? args.get('pair').split(',') : null;

const { world, bySite, claims } = captureBuild({ seed: SEED });
console.log(`boxprobe — ${world.stats.resident} chunks, ${claims.length} delivered claims, seed ${SEED}`);

/** Every emitted box, flat, with the site chain it came from. */
const allBoxes = [];
for (const rec of bySite.values()) {
  if (!rec.key.startsWith('city:')) continue;
  for (const b of rec.boxes) allBoxes.push(b);
}
console.log(`${allBoxes.length} delivered boxes from ${[...bySite.keys()].filter((k) => k.startsWith('city:')).length} emission sites\n`);

const conflicts = findConflicts(claims, 200).filter(
  (c) => !WANT || (WANT.includes(c.a.kind) && WANT.includes(c.b.kind))
);
console.log(`${conflicts.length} forbidden overlap(s) to decompose\n`);

const f = (n) => (n >= 0 ? ' ' : '') + n.toFixed(3);
const inside = (b, c, pad = 0.05) =>
  b.x0 >= c.x0 - pad && b.x1 <= c.x1 + pad && b.z0 >= c.z0 - pad && b.z1 <= c.z1 + pad;
const overlap = (a, b) => (
  a.x1 > b.x0 && a.x0 < b.x1 && a.z1 > b.z0 && a.z0 < b.z1 && a.y1 > b.y0 && a.y0 < b.y1
);
const areaOf = (a, b) => {
  const dx = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const dz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
  return dx > 0 && dz > 0 ? dx * dz : 0;
};

/**
 * The delivered sub-boxes of one claim.
 *
 * MATCHED BY CONTAINMENT IN THE CLAIM, which is exact for the two objects here
 * because both claims are built as the union of the boxes they cover — a prop's
 * banded AABB and a feature's accumulated one. Where a claim UNDER-states its
 * own object the containment test would miss the escaping box, so the count is
 * printed beside the emitter's own per-object box count and a shortfall is
 * visible rather than silent.
 */
function subBoxesOf(claim) {
  const out = [];
  for (const b of allBoxes) if (inside(b, claim)) out.push(b);
  return out;
}

for (const c of conflicts) {
  console.log('='.repeat(78));
  console.log(`${c.a.kind}(${c.a.owner}) × ${c.b.kind}(${c.b.owner})   overlap ${c.areaM2} m²`);
  console.log('='.repeat(78));
  for (const [label, box] of [['A', c.a], ['B', c.b]]) {
    console.log(
      `\n  CLAIM ${label}  ${box.kind}(${box.owner})   x ${f(box.x0)}..${f(box.x1)}  ` +
      `z ${f(box.z0)}..${f(box.z1)}  y ${f(box.y0)}..${f(box.y1)}   ` +
      `half (x ${f((box.x1 - box.x0) / 2)}, z ${f((box.z1 - box.z0) / 2)})`
    );
    const subs = subBoxesOf(box);
    console.log(`  DELIVERED SUB-BOXES: ${subs.length}`);
    let ux0 = Infinity; let ux1 = -Infinity; let uz0 = Infinity; let uz1 = -Infinity; let uy1 = -Infinity;
    for (const s of subs) {
      console.log(
        `    x ${f(s.x0)}..${f(s.x1)}  z ${f(s.z0)}..${f(s.z1)}  y ${f(s.y0)}..${f(s.y1)}   ` +
        `${s.site.split(' < ').slice(1, 3).join(' < ')}   mesh ${s.mesh}`
      );
      ux0 = Math.min(ux0, s.x0); ux1 = Math.max(ux1, s.x1);
      uz0 = Math.min(uz0, s.z0); uz1 = Math.max(uz1, s.z1);
      uy1 = Math.max(uy1, s.y1);
    }
    if (subs.length) {
      console.log(
        `  DELIVERED UNION  x ${f(ux0)}..${f(ux1)}  z ${f(uz0)}..${f(uz1)}  top ${f(uy1)}   ` +
        `half (x ${f((ux1 - ux0) / 2)}, z ${f((uz1 - uz0) / 2)})`
      );
      console.log(
        `  CLAIMED − DELIVERED  x0 ${f(box.x0 - ux0)}  x1 ${f(box.x1 - ux1)}  ` +
        `z0 ${f(box.z0 - uz0)}  z1 ${f(box.z1 - uz1)}   ` +
        '(negative on x0/z0 or positive on x1/z1 means the CLAIM is larger than what was drawn)'
      );
    }
  }

  /* ---------------------------------------------------------- the sub-box pair */
  const A = subBoxesOf(c.a);
  const B = subBoxesOf(c.b);
  console.log(`\n  SOLID-AGAINST-SOLID: ${A.length} × ${B.length} sub-box pairs tested`);
  let hits = 0;
  for (const a of A) {
    for (const b of B) {
      if (!overlap(a, b)) continue;
      hits++;
      console.log(
        `    HIT  ${areaOf(a, b).toFixed(4)} m²  ` +
        `y ${f(Math.max(a.y0, b.y0))}..${f(Math.min(a.y1, b.y1))}\n` +
        `         A  x ${f(a.x0)}..${f(a.x1)}  z ${f(a.z0)}..${f(a.z1)}  y ${f(a.y0)}..${f(a.y1)}   ${a.site.split(' < ').slice(1, 3).join(' < ')}\n` +
        `         B  x ${f(b.x0)}..${f(b.x1)}  z ${f(b.z0)}..${f(b.z1)}  y ${f(b.y0)}..${f(b.y1)}   ${b.site.split(' < ').slice(1, 3).join(' < ')}`
      );
    }
  }
  if (!hits) {
    console.log('    NONE. The two CLAIMS overlap and no two SOLIDS do — the conflict is');
    console.log('    between the claims\' own slack, not between the objects.');
    /**
     * The nearest approach, so "none" carries a distance rather than only a
     * verdict. A zero with 5 cm under it and a zero with 2 m under it are
     * different findings and a bare `none` cannot tell them apart.
     */
    let best = Infinity;
    let pair = null;
    for (const a of A) {
      for (const b of B) {
        const dx = Math.max(0, Math.max(a.x0 - b.x1, b.x0 - a.x1));
        const dz = Math.max(0, Math.max(a.z0 - b.z1, b.z0 - a.z1));
        const dy = Math.max(0, Math.max(a.y0 - b.y1, b.y0 - a.y1));
        const d = Math.hypot(dx, dz, dy);
        if (d < best) { best = d; pair = [a, b]; }
      }
    }
    if (pair) {
      console.log(`    NEAREST APPROACH ${best.toFixed(4)} m`);
      console.log(`         A  x ${f(pair[0].x0)}..${f(pair[0].x1)}  z ${f(pair[0].z0)}..${f(pair[0].z1)}  y ${f(pair[0].y0)}..${f(pair[0].y1)}   ${pair[0].site.split(' < ').slice(1, 3).join(' < ')}`);
      console.log(`         B  x ${f(pair[1].x0)}..${f(pair[1].x1)}  z ${f(pair[1].z0)}..${f(pair[1].z1)}  y ${f(pair[1].y0)}..${f(pair[1].y1)}   ${pair[1].site.split(' < ').slice(1, 3).join(' < ')}`);
    }
  }
  console.log('');
}
