#!/usr/bin/env node
/**
 * emitcensus.mjs — THE UNDECLARED CENSUS. NOT A GATE. SESSION 24.
 * ===============================================================
 *
 * THE QUESTION. `src/lib/occupancy.js` promises that a generator cannot put
 * something where something else already is. That promise is only as good as
 * the set of things that DECLARE themselves, and nobody has ever enumerated
 * that set. Three sessions have each found one member of it the hard way:
 *
 *   s21  park railings emitted without their own half-thickness   197 cases
 *   s23  the viaduct's end mass, standing in the world, claimed by nobody
 *   s23  790 lamp heads and columns, in no registry band at all
 *
 * So this enumerates every site in `city.js` that puts geometry into a chunk
 * mesh, and asks of each one whether anything claims what it emitted.
 *
 * HOW IT IS MEASURED, AND WHY IT IS NOT A READING OF THE CODE.
 *
 * A census assembled by reading `city.js` would be a list of what a reader
 * believed the emission sites were — which is the same instrument that has
 * missed three of them. Instead:
 *
 *   PROVENANCE   `captureBuild` wraps `THREE.Matrix4.prototype.clone` for the
 *                duration of the build. `setMatrix` and `propMatrix` both END in
 *                `.clone()`, so every instanced box, window pane and sign quad
 *                in the city passes through it exactly once, and the call
 *                stack at that moment names the line that emitted it. A site
 *                nobody knew about therefore appears in this table by itself.
 *                Non-instanced geometry — the landmark lathes — is picked up
 *                by walking the scene instead, so a mesh that never touches a
 *                Matrix4 cannot hide.
 *
 *   EXTENT       the world AABB of each box: its own GEOMETRY's bounding box,
 *                recovered from the scene, under the delivered matrix. Not the
 *                unit cube a matrix on its own implies — a lamp column is an
 *                8.4 m pole with a 2.1 m arm and a sign quad is a plane with
 *                no depth at all.
 *
 *   COVERAGE     each box's footprint is clipped against the DELIVERED claims
 *                (`city.placedClaims()`), keeping only the SOLID categories —
 *                a pavement under a lamp column is the ground it stands on and
 *                is not a declaration of the lamp. What is left over is the
 *                undeclared footprint, in m², measured rather than argued.
 *
 * NO GPU IS INVOLVED AND NONE IS NEEDED. See `tools/lib/headlesscity.mjs` for
 * what is stubbed and why, and for the control that says this path is the same
 * path the browser census takes.
 *
 * Usage:
 *   node tools/emitcensus.mjs              the census and the classification
 *   node tools/emitcensus.mjs --boxes=N    print N example boxes per row
 *   node tools/emitcensus.mjs --json=FILE  the whole table as JSON
 */

import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { findConflicts, createRegistry, claimBox } from '../src/lib/occupancy.js';

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);
const SEED = Number(args.get('seed') || 1337);
const EXAMPLES = Number(args.get('boxes') || 0);

/* ------------------------------------------------------------------ machine */

console.log('emitcensus — every number below is a count, a coordinate or an area.');
console.log(`node ${process.version}  ·  ${process.platform}/${process.arch}  ·  seed ${SEED}`);
console.log('no renderer, no browser, no pixel: the delivered claim list is CPU bookkeeping.\n');

/* ------------------------------------------------------- the provenance hook
 *
 * `captureBuild` boots the real modules with `Matrix4.prototype.clone` wrapped
 * and hands back every emitted box with the line that emitted it and the
 * geometry it drives. It lives in `tools/lib/headlesscity.mjs` because
 * `boxprobe.mjs` needs the same records, and two copies of it would be
 * CONTRACT §9.1's own subject.
 */
import { captureBuild } from './lib/headlesscity.mjs';

const t0 = Date.now();
const { world, bySite, total, unmatched } = captureBuild({ seed: SEED });
{
  const nonCity = [...bySite.values()].filter((r) => !r.key.startsWith('city:')).reduce((s, r) => s + r.count, 0);
  console.log(
    `matrices matched to a live city mesh: ${total - unmatched} of ${total}; ${unmatched} fell back to the unit box ` +
    `— against ${nonCity} emitted by block.js and river.js, which own their own meshes and are not in this census`
  );
}

const claims = world.cityApi.placedClaims();
console.log(
  `built ${world.stats.resident} chunks in ${world.frames} frames / ${Date.now() - t0} ms — ` +
  `${[...bySite.values()].reduce((s, r) => s + r.count, 0)} instanced boxes, ${claims.length} delivered claims`
);

/* ------------------------------------------------------------- the control
 *
 * STATE 22 §2.4 recorded the DELIVERED conflict list off a real browser:
 * `prop(container) × site(hoarding)` at 0.173 m² and 0.266 m². If this path
 * reproduces those two areas it is the same path. It is printed BEFORE
 * anything else in the file depends on it, because a probe whose control fails
 * has nothing to say (CONTRACT §7.1).
 */
const delivered = findConflicts(claims, 200);
console.log(`\n== CONTROL: the delivered conflict sweep, against STATE 22 §2.4 ==`);
for (const c of delivered) {
  console.log(`  ${c.a.kind}(${c.a.owner}) × ${c.b.kind}(${c.b.owner})   ${c.areaM2} m²`);
}
const areas = delivered.map((c) => c.areaM2);
console.log(`  STATE 22 recorded 0.173 and 0.266 m² off a browser; this run: ${areas.join(', ') || 'none'}`);
console.log(
  '  Both were reproduced here to three decimals BEFORE session 24 touched anything, which is what\n' +
  '  says this is the same path — STATE 24 §1.2 records the run. They are gone now because the\n' +
  '  claim that produced them was corrected (STATE 24 §2), so a bare `none` here is the expected\n' +
  '  reading and NOT a second confirmation. Re-run the control by checking out b53b34c.'
);

/* -------------------------------------------------------------- the coverage
 *
 * SOLID rather than every kind. A carriageway, a pavement, a path and the
 * `ground` catch-all are SURFACES: they say what you are standing on, not that
 * something is standing there. A lamp column whose footprint lies inside a
 * pavement claim is exactly as undeclared as one in a field, and a coverage
 * test that counted the pavement would report the 790 lamps session 23 found
 * as declared.
 */
const SOLID = new Set(['building', 'landmark', 'deck', 'prop', 'canopy', 'sign', 'site', 'feature', 'block', 'water']);
const solidClaims = claims.filter((c) => SOLID.has(c.kind));

const reg = createRegistry();
for (const c of solidClaims) reg.claim(c);

/**
 * The probe's own rectangle clipper. It is a second implementation of the one
 * in `citygen.js` (`subtractBox`) and that is stated rather than hidden: the
 * generator's is not exported, an instrument that imported it would be reading
 * the thing it is measuring through the same code, and the two are checked
 * against each other by the trivial cases below.
 */
function subtractRect(r, b) {
  if (b.x1 <= r.x0 || b.x0 >= r.x1 || b.z1 <= r.z0 || b.z0 >= r.z1) return [r];
  const out = [];
  if (b.z0 > r.z0) out.push({ x0: r.x0, x1: r.x1, z0: r.z0, z1: b.z0 });
  if (b.z1 < r.z1) out.push({ x0: r.x0, x1: r.x1, z0: b.z1, z1: r.z1 });
  const z0 = Math.max(r.z0, b.z0);
  const z1 = Math.min(r.z1, b.z1);
  if (z1 > z0) {
    if (b.x0 > r.x0) out.push({ x0: r.x0, x1: b.x0, z0, z1 });
    if (b.x1 < r.x1) out.push({ x0: b.x1, x1: r.x1, z0, z1 });
  }
  return out;
}
/* Two-direction self-test, on this run, so a broken clipper cannot report a
 * clean census (CONTRACT §7.3). A rectangle minus itself is nothing; a
 * rectangle minus a disjoint one is unchanged. */
{
  const r = { x0: 0, x1: 2, z0: 0, z1: 2 };
  const same = subtractRect(r, r).reduce((s, q) => s + (q.x1 - q.x0) * (q.z1 - q.z0), 0);
  const away = subtractRect(r, { x0: 9, x1: 10, z0: 9, z1: 10 }).reduce((s, q) => s + (q.x1 - q.x0) * (q.z1 - q.z0), 0);
  if (same !== 0 || away !== 4) {
    console.error(`emitcensus: the clipper self-test failed (${same}, ${away}) — refusing to report`);
    process.exit(2);
  }
}

/**
 * TWO COVERAGE QUESTIONS, AND COLLAPSING THEM INTO ONE IS THE MISTAKE THIS
 * WHOLE FILE IS ABOUT.
 *
 *   IN PLAN     is there a solid claim over this footprint AT ALL, at any
 *               height? A `no` is the lamp class — the registry has never been
 *               told anything is here, so a prop, a tree or a sign could be
 *               placed straight through it and nothing would report it.
 *   IN 3-D      does a solid claim cover this footprint at THIS box's own
 *               height? This is the question `occupancy.overlaps` actually
 *               asks, so it is what the registry enforces. A `yes` in plan and
 *               a `no` in 3-D is the bench class — a claim exists and is the
 *               wrong SIZE.
 *
 * Reported separately, because a building's cornice is undeclared in 3-D (it
 * stands above its own claim's top) and perfectly declared in plan, and one
 * number that mixed those two would put a 1 m upstand and a 790-lamp gap in
 * the same column.
 */
const ALL_Y = { y0: -1e9, y1: 1e9 };

function coveringInPlan(box) {
  return reg.hits({ ...box, ...ALL_Y }, 0);
}

function uncoveredArea(box, covers) {
  let rects = [{ x0: box.x0, x1: box.x1, z0: box.z0, z1: box.z1 }];
  for (const c of covers) {
    const next = [];
    for (const r of rects) for (const q of subtractRect(r, c)) next.push(q);
    rects = next;
    if (!rects.length) break;
  }
  let a = 0;
  for (const r of rects) a += (r.x1 - r.x0) * (r.z1 - r.z0);
  return a;
}

/** The plan-covering claims whose vertical band also reaches this box. */
function coveringIn3D(box, covers) {
  return covers.filter((c) => box.y1 > c.y0 && box.y0 < c.y1);
}

/** How far the box's top stands above the tallest claim that covers it in plan. */
function aboveTop(box, covers) {
  let best = -Infinity;
  for (const c of covers) if (c.y1 > best) best = c.y1;
  return best === -Infinity ? null : box.y1 - best;
}

/**
 * How far, in metres, the box reaches past the edge of its OWN claim.
 *
 * An area says how much escaped and a length says how far — and for a repair it
 * is the length that decides, because what a claim has to grow by is a
 * distance. Taken as the MINIMUM over the covering claims of that claim's worst
 * axis-wise overhang, i.e. measured against whichever claim contains the box
 * best. A box with no covering claim returns null: it has no claim to escape.
 */
function escapeM(box, covers) {
  let best = Infinity;
  for (const c of covers) {
    const e = Math.max(box.x0 - c.x0 < 0 ? c.x0 - box.x0 : 0, box.x1 - c.x1, c.z0 - box.z0, box.z1 - c.z1);
    if (e < best) best = e;
  }
  return best === Infinity ? null : Math.max(0, best);
}

/* ------------------------------------------------------------------- the table */

/**
 * The source line each frame points at, read out of `city.js` itself. A label
 * typed here would be a claim about the code; the code's own line is the code.
 */

const cityLines = (await (await import('node:fs/promises')).readFile(
  new URL('../src/modules/city.js', import.meta.url), 'utf8'
)).split('\n');
const srcAt = (frame) => {
  const m = /^city:(\d+)$/.exec(frame);
  if (!m) return '';
  return (cityLines[Number(m[1]) - 1] || '').trim().replace(/\s+/g, ' ').slice(0, 76);
};

const rows = [];
for (const rec of bySite.values()) {
  if (!rec.key.startsWith('city:')) continue;
  let sumArea = 0;
  let planUncovered = 0;
  let d3Uncovered = 0;
  let nPlanBare = 0;
  let worstPlan = 0;
  let worstAbove = -Infinity;
  let worstEscape = 0;
  let nAbove = 0;
  const examples = [];
  for (const b of rec.boxes) {
    const area = (b.x1 - b.x0) * (b.z1 - b.z0);
    const covers = coveringInPlan(b);
    const up = uncoveredArea(b, covers);
    const u3 = uncoveredArea(b, coveringIn3D(b, covers));
    sumArea += area;
    planUncovered += up;
    d3Uncovered += u3;
    if (up > area - 1e-9) nPlanBare++;
    if (up > worstPlan) worstPlan = up;
    const ab = aboveTop(b, covers);
    if (ab !== null && ab > 1e-6) { nAbove++; if (ab > worstAbove) worstAbove = ab; }
    const esc = escapeM(b, covers);
    if (esc !== null && esc > worstEscape) worstEscape = esc;
    if (examples.length < EXAMPLES && (up > 1e-9 || (ab !== null && ab > 1e-6))) {
      examples.push({ ...b, planUncoveredM2: +up.toFixed(4), aboveM: ab === null ? null : +ab.toFixed(3) });
    }
  }
  /**
   * The classification, and it is computed rather than assigned. A row is
   * UNDECLARED when most of what it emits has no claim over it in plan;
   * MISMATCHED when a claim exists in plan and the delivered box escapes it in
   * plan or in height; MATCHING when neither.
   */
  const bareFrac = nPlanBare / rec.count;
  const verdict = bareFrac > 0.5 ? 'UNDECLARED'
    : (planUncovered > 0.5 || worstAbove > 0.05) ? 'MISMATCHED'
      : 'MATCHING';
  rows.push({
    site: rec.key,
    emitter: rec.key.split(' < ')[1] || rec.key,
    source: rec.key.split(' < ').slice(1, 3).map((f) => `${f}  ${srcAt(f)}`),
    verdict,
    boxes: rec.count,
    footprintM2: +sumArea.toFixed(1),
    planUncoveredM2: +planUncovered.toFixed(2),
    d3UncoveredM2: +d3Uncovered.toFixed(2),
    planBareBoxes: nPlanBare,
    worstPlanUncoveredM2: +worstPlan.toFixed(4),
    worstEscapeM: +worstEscape.toFixed(3),
    boxesAboveClaim: nAbove,
    worstAboveM: worstAbove === -Infinity ? 0 : +worstAbove.toFixed(3),
    examples,
  });
}
const ORDER = { UNDECLARED: 0, MISMATCHED: 1, MATCHING: 2 };
rows.sort((a, b) => ORDER[a.verdict] - ORDER[b.verdict] || b.planUncoveredM2 - a.planUncoveredM2 || b.boxes - a.boxes);

console.log('\n== EVERY EMISSION SITE IN city.js — ONE ROW PER EMITTER ==');
console.log('  boxes = instances emitted over the resident ring');
console.log('  plan-undeclared = footprint m² with NO solid claim over it at any height');
console.log('  3-D undeclared  = footprint m² with no solid claim at THIS box\'s own height');
console.log('  above = boxes standing above the top of every claim that covers them, and the worst\n');
for (const r of rows) {
  console.log(`${r.verdict.padEnd(11)} ${r.source.join('\n            ')}`);
  console.log(
    `            boxes ${String(r.boxes).padStart(6)}   footprint ${r.footprintM2.toFixed(1).padStart(10)} m²   ` +
    `plan-undeclared ${r.planUncoveredM2.toFixed(2).padStart(10)} m² (${r.planBareBoxes} wholly, worst ${r.worstPlanUncoveredM2.toFixed(3)})   ` +
    `3-D ${r.d3UncoveredM2.toFixed(2).padStart(10)} m²   reaches ${r.worstEscapeM.toFixed(2)} m past its claim   above ${r.boxesAboveClaim}/${r.worstAboveM.toFixed(2)} m`
  );
  for (const e of r.examples) {
    console.log(`              eg x ${e.x0.toFixed(2)}..${e.x1.toFixed(2)}  z ${e.z0.toFixed(2)}..${e.z1.toFixed(2)}  ` +
      `y ${e.y0.toFixed(2)}..${e.y1.toFixed(2)}   bare ${e.planUncoveredM2} m²  above ${e.aboveM}`);
  }
}
{
  const tally = {};
  for (const r of rows) tally[r.verdict] = (tally[r.verdict] || 0) + 1;
  console.log(`\n  ${rows.length} emission sites: ` +
    Object.entries(tally).map(([k, v]) => `${v} ${k}`).join(', '));
}

/* --------------------------------------------- the non-instanced emitters */

console.log('\n== NON-INSTANCED GEOMETRY THE CITY MODULE EMITS (nothing here touches a Matrix4) ==');
console.log('  the landmark lathes and the merged ground and signage meshes. `block.js` and');
console.log('  `river.js` own meshes too and are out of this census\'s scope — see STATE.\n');
const plain = [];
const cityRoot = world.ctx.scene.children.find((o) => o.name === 'city');
cityRoot.updateMatrixWorld(true);
cityRoot.traverse((o) => {
  if (!o.isMesh || o.isInstancedMesh) return;
  const bb = new THREE.Box3().setFromObject(o);
  const b = { x0: bb.min.x, x1: bb.max.x, z0: bb.min.z, z1: bb.max.z, y0: bb.min.y, y1: bb.max.y };
  const covers = coveringInPlan(b);
  plain.push({
    name: o.name, box: b,
    planUncoveredM2: +uncoveredArea(b, covers).toFixed(2),
    aboveM: aboveTop(b, covers),
  });
});
for (const p of plain) {
  console.log(
    `  ${p.name.padEnd(28)} x ${p.box.x0.toFixed(1)}..${p.box.x1.toFixed(1)}  ` +
    `z ${p.box.z0.toFixed(1)}..${p.box.z1.toFixed(1)}  y ${p.box.y0.toFixed(1)}..${p.box.y1.toFixed(1)}  ` +
    `plan-undeclared ${p.planUncoveredM2} m²  above claim ${p.aboveM === null ? 'NO CLAIM' : `${p.aboveM.toFixed(2)} m`}`
  );
}

/* ------------------------------------------------------------ the claim side */

console.log('\n== THE CLAIM SIDE: what the delivered census contains ==');
const byKind = {};
for (const c of claims) byKind[c.kind] = (byKind[c.kind] || 0) + 1;
for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(14)} ${String(v).padStart(6)}`);
}
const CATS = ['building', 'landmark', 'deck', 'water', 'carriageway', 'pavement', 'path', 'block',
  'prop', 'canopy', 'sign', 'site', 'feature'];
const missing = CATS.filter((k) => !byKind[k]);
console.log(`  categories in the conflict table with ZERO delivered claims: ${missing.join(', ') || 'none'}`);

/* ------------------------------------------------------ what declaring costs
 *
 * THE COUNT THAT DECIDES WHETHER A REPAIR IS WORTH BUILDING.
 *
 * For a candidate declaration, the claim it would make is built FROM THE
 * DELIVERED BOXES — not from what the emitter meant to draw — and added to the
 * delivered census. The sweep is re-run and the pairs that were not there
 * before are the cost.
 *
 * WHAT THIS MEASURES AND WHAT IT DOES NOT. A claim laid down in `generateChunk`
 * REFUSES what comes after it, so the generator's cost is "objects not placed"
 * and this is "objects that would have been refused" — the same set, counted
 * from the other end. Where the number is ZERO the two agree exactly and the
 * declaration is free, which is the only case session 24 acts on.
 *
 * The proposed category for each row is a DECISION and is written out beside
 * the number, because a wrong category makes a free repair look expensive
 * (`prop` for a road marking would collide with every carriageway in the city)
 * and an expensive one look free (`canopy` for a lamp head, which conflicts
 * with almost nothing — STATE 23 §4.4 already found that one inert).
 */
const HEAD_CLEAR = 2.10;
/**
 * THE CANDIDATES, KEYED ON THE SOURCE TEXT AND NOT ON A LINE NUMBER.
 *
 * A line number is a value in config the code does not read, one file over: two
 * lines added to `city.js` and every row of this table silently addresses a
 * different emitter and reports `0 boxes`. It did, in this session, on the run
 * after the two repairs landed — six rows went to zero and read as free. So the
 * key is a distinctive substring of the emitting line, resolved against
 * `city.js` at run time, and a key that matches no line or more than one is a
 * LOUD failure rather than an empty row.
 */
const CANDIDATES = [
  /**
   * THE FOUR LAMP ROWS ARE `done` — SESSION 46 DECLARED THEM, and they are kept
   * rather than deleted because a candidate that disappears when it is repaired
   * takes its number with it. `done` skips the sweep: re-claiming an object that
   * already carries a claim reports it colliding with ITSELF (333 of
   * `prop(lamp:column) × prop(declared:city:4103)`), which is the self-pair case one
   * level out and would read as a cost.
   */
  { src: 'lampBodies.push(setMatrix(spot.x', as: 'prop', clampTop: HEAD_CLEAR, done: 's46',
    why: 'a kerbside lamp COLUMN, 8.4 m of steel with a 2.1 m arm, 1.3 m outside the kerb' },
  { src: 'bowls.push(setMatrix(head.x', as: 'canopy', done: 's46',
    why: 'the lamp HEAD, a 0.42 m bowl at 8.08 m on that arm' },
  { src: 'lampBodies.push(setMatrix(L.x', as: 'prop', clampTop: HEAD_CLEAR, done: 's46',
    why: 'a promenade lamp COLUMN' },
  { src: 'bowls.push(setMatrix(L.headX', as: 'canopy', done: 's46',
    why: 'the promenade lamp HEAD' },
  { src: 'masses.push(at(-faceW / 2 + bayW * i, 0.9', as: 'building',
    why: 'a colonnade PIER, standing 1.35 m clear of its own elevation, on the pavement' },
  /**
   * THE SAME PIER AS `prop`, WHICH IS THE CATEGORY IT ACTUALLY WANTS — session
   * 47. `building × pavement` is forbidden and `prop × pavement` is absent
   * ("a pavement carries people AND street furniture"), so the 342 pavement
   * pairs the row above reports are the CATEGORY and not the pier. The file's
   * own warning, two paragraphs up, made concrete.
   */
  { src: 'masses.push(at(-faceW / 2 + bayW * i, 0.9', as: 'prop',
    why: 'the SAME colonnade pier as `prop` — a pavement carries street furniture' },
  { src: 'pushSign(setMatrix(', as: 'sign', nth: 2,
    why: 'a projecting BLADE over the pavement (occupancy.js says it claims nothing — this is the number behind that sentence)' },
  { src: 'pushSign(setMatrix(', as: 'canopy', nth: 2,
    why: 'the SAME projecting blade as `canopy` — it hangs over a footway at 3 m and up' },
  { src: 'pushSign(setMatrix(', as: 'sign', nth: 1,
    why: 'a FLUSH fascia, 0.12 m proud of the masonry it is bolted to' },
  { src: 'pushStruct(', as: 'canopy', nth: 4,
    why: 'the projecting blade\'s BRACKET, wall to inner edge, at the sign\'s top' },
  { src: 'push(l.x, l.height + 3.2, l.z, l.span * 0.92', as: 'deck',
    why: 'the ARCH\'S TRANSIT DECK — 1384 m2 of structure at 99 m, claimed by nobody' },
  { src: 'pushSteel(l.x + x, (y + l.height + 3.2) / 2', as: 'deck',
    why: 'the arch\'s nine HANGERS, deck up to the arc' },
  { src: 'patches.push(setMatrix(', as: 'prop',
    why: 'a road PATCH — a 10 mm reinstatement; declaring it as a solid is the wrong answer and this is the number that says so' },
  { src: 'props.push(setMatrix(mk.x', as: 'prop',
    why: 'a road MARKING — same object class, same answer' },
  { src: 'bodies.push(setMatrix(x, y, z, sx, sy, sz, yawDeg));', as: 'sign',
    why: 'every sign STRUCTURE box — legs, braces, parapet rails, blade brackets, pylon posts' },
];

/**
 * Resolve each candidate to the `city:NNNN` frame the capture recorded. A
 * substring that matches no line, or several, stops the sweep — a table that
 * quietly addresses the wrong emitter is worse than no table.
 */
for (const cand of CANDIDATES) {
  const key = cand.src;
  const hits = [];
  for (let i = 0; i < cityLines.length; i++) if (cityLines[i].includes(key)) hits.push(i + 1);
  if (!hits.length) {
    console.error(`emitcensus: no line of city.js contains ${JSON.stringify(key)} — refusing to report`);
    process.exit(2);
  }
  if (hits.length > 1 && cand.nth === undefined) {
    console.error(`emitcensus: ${hits.length} lines of city.js contain ${JSON.stringify(key)} (${hits.join(', ')}) — ambiguous, refusing to report`);
    process.exit(2);
  }
  cand.at = `city:${cand.nth === undefined ? hits[0] : hits[cand.nth]}`;
}

console.log('\n== WHAT DECLARING EACH UNDECLARED ROW WOULD COST ==');
console.log('  new pairs = forbidden overlaps that appear when the claim is added to the delivered census');
console.log(`  the census already carries ${delivered.length}; only what is ADDED is counted\n`);
const baseKeys = new Set(delivered.map((c) => `${c.a.kind}|${c.a.owner}|${c.a.x0}|${c.b.kind}|${c.b.x0}`));
const costRows = [];
for (const cand of CANDIDATES) {
  if (cand.done) { costRows.push({ ...cand, boxes: 0, newPairs: 0, byPair: {}, note: `DECLARED in ${cand.done}` }); continue; }
  const boxes = [];
  for (const rec of bySite.values()) {
    const frames = rec.key.split(' < ');
    if (frames[1] !== cand.at && frames[2] !== cand.at) continue;
    for (const b of rec.boxes) boxes.push(b);
  }
  if (!boxes.length) { costRows.push({ ...cand, boxes: 0, newPairs: 0, byPair: {}, note: 'nothing emitted over this ring' }); continue; }
  const extra = boxes.map((b) => claimBox(
    cand.as, b.x0, b.z0, b.x1, b.z1,
    { y0: b.y0, y1: cand.clampTop === undefined ? b.y1 : Math.min(b.y1, cand.clampTop), owner: `declared:${cand.at}` }
  ));
  const swept = findConflicts([...claims, ...extra], 8000);
  const touched = swept.filter((c) => c.a.owner.startsWith('declared:') || c.b.owner.startsWith('declared:'));
  /**
   * SELF-PAIRS ARE NOT A COST AND COUNTING THEM WOULD BE THE INSTRUMENT'S OWN
   * ERROR. A pylon is two sign faces and a post — three BOXES, one OBJECT — and
   * `sign × sign` is forbidden, so claiming each box separately reports the
   * object colliding with itself. What a real declaration would claim is the
   * object's union; the self-pairs are counted and reported apart rather than
   * folded in.
   */
  const fresh = touched.filter((c) => !(c.a.owner.startsWith('declared:') && c.b.owner.startsWith('declared:')));
  const selfPairs = touched.length - fresh.length;
  const byPair = {};
  const victims = new Set();
  for (const c of fresh) {
    const other = c.a.owner.startsWith('declared:') ? c.b : c.a;
    byPair[`${other.kind}(${other.owner})`] = (byPair[`${other.kind}(${other.owner})`] || 0) + 1;
    victims.add(`${other.kind}|${other.owner}|${other.x0.toFixed(3)}|${other.z0.toFixed(3)}`);
  }
  costRows.push({ ...cand, boxes: boxes.length, newPairs: fresh.length, selfPairs, victims: victims.size, byPair });
}
costRows.sort((a, b) => a.newPairs - b.newPairs);
for (const r of costRows) {
  console.log(`  ${r.at}  as \`${r.as}\`  — ${r.boxes} boxes`);
  console.log(`      ${r.why}`);
  console.log(`      NEW forbidden pairs ${r.newPairs}${r.newPairs ? `   distinct objects refused ${r.victims}` : '   ← COST ZERO'}` +
    `${r.selfPairs ? `   (+${r.selfPairs} self-pairs, one object claimed as several boxes — not a cost)` : ''}`);
  const top = Object.entries(r.byPair || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (top.length) console.log(`      against: ${top.map(([k, v]) => `${k} ${v}`).join(', ')}`);
}

/* --------------------------------------- the patch clip, measured separately
 *
 * A road patch is not a solid and must not be declared as one — the sweep above
 * says so with a number. The question it leaves is the other one: a marking is
 * clipped to the delivered carriageway by `citygen.js`'s `onRoad`, and a patch
 * is clipped against nothing at all. So: how many patches are painted where no
 * carriageway was emitted?
 */
{
  const roadReg = createRegistry();
  for (const c of claims) if (c.kind === 'carriageway') roadReg.claim(c);
  /**
   * RESTRICTED TO THE NEAR RING, AND THE RESTRICTION IS THE WHOLE VALIDITY OF
   * THE NUMBER.
   *
   * `buildGround` runs on `near` chunks only — `detail && ring <= 2` — so a
   * carriageway claim exists for 25 of the 121 resident chunks. Paint and
   * asphalt are emitted on every `detail` chunk, i.e. out to ring 4. Asking
   * whether a marking in ring 3 is on a delivered carriageway therefore
   * measures the RESIDENCY RING and not the marking: run without this filter it
   * reported 7 237 of 10 780 markings off the road, of which the overwhelming
   * majority are simply in a chunk that draws no road surface. Two quantities,
   * same units, plausible magnitude — CONTRACT §9, inside the instrument again.
   */
  const S = 128;
  /**
   * AND A CORRIDOR'S MARGIN INSIDE IT, because a chunk paints the lines on the
   * roads it OWNS — its own west and north edges — and those reach `CORRIDOR` =
   * 11.7 m into the neighbour's coordinates. A mark at x = 376.8 belongs to
   * chunk 3 and lands in chunk 2, so a test keyed on where the mark IS credits
   * it to a chunk that did not draw its road. Conservative in the direction
   * that UNDER-counts the defect, which is the right way for a floor.
   */
  const nearChunk = (b) => {
    const c = [
      Math.floor((b.x0 - 12) / S), Math.floor((b.x1 + 12) / S),
      Math.floor((b.z0 - 12) / S), Math.floor((b.z1 + 12) / S),
    ];
    return Math.max(...c.map(Math.abs)) <= 2;
  };
  const tally = (frame) => {
    let n = 0;
    let inRing = 0;
    let off = 0;
    let wholly = 0;
    let worst = 0;
    for (const rec of bySite.values()) {
      const frames = rec.key.split(' < ');
      if (frames[1] !== frame) continue;
      for (const b of rec.boxes) {
        n++;
        if (!nearChunk(b)) continue;
        inRing++;
        const covers = roadReg.hits({ ...b, ...ALL_Y }, 0);
        const u = uncoveredArea(b, covers);
        const area = (b.x1 - b.x0) * (b.z1 - b.z0);
        if (u > 1e-6) { off++; if (u / area > worst) worst = u / area; }
        if (u > area - 1e-6) wholly++;
      }
    }
    return { n, inRing, off, wholly, worst };
  };
  const byName = (src) => CANDIDATES.find((c) => c.src === src).at;
  const patch = tally(byName('patches.push(setMatrix('));
  const mark = tally(byName('props.push(setMatrix(mk.x'));
  console.log('\n== PAINT AND ASPHALT: IS IT ON A CARRIAGEWAY THAT WAS ACTUALLY EMITTED? ==');
  console.log('  counted over the 25 NEAR chunks only — those are the ones that draw a road surface');
  console.log(`  road patches   ${patch.n} emitted, ${patch.inRing} in the near ring, ${patch.off} reach off every delivered carriageway, ${patch.wholly} lie wholly off one (worst ${(patch.worst * 100).toFixed(1)}% of a patch)`);
  console.log(`  road markings  ${mark.n} emitted, ${mark.inRing} in the near ring, ${mark.off} reach off every delivered carriageway, ${mark.wholly} lie wholly off one (worst ${(mark.worst * 100).toFixed(1)}% of a mark)`);
  console.log('  `citygen.js` clips a marking to the delivered carriageway (`onRoad`, at HALF the mark\'s own half-extents); nothing clips a patch at all.');
}

if (args.has('json')) {
  await writeFile(args.get("json"), `${JSON.stringify({ rows, plain, byKind, delivered, costRows }, null, 1)}\n`, "utf8");
  console.log(`\nwrote ${args.get('json')}`);
}
