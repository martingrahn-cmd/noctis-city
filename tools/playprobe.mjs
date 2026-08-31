#!/usr/bin/env node
/**
 * playprobe.mjs — THE PLAYING SURFACES, AND WHAT IS STANDING ON THEM.
 * NOT A GATE. SESSION 60.
 * ===================================================================
 *
 * THE QUESTION, AND IT WAS ASKED BY SOMEBODY WALKING RATHER THAN BY A GATE.
 * The operator, at `?player=1&spawn=580.12,0.14,1061.89&t=0.6017&seed=1337`:
 * two trees growing out of a basketball court. Chunk (4, 8), seed 1337.
 *
 * WHY NOTHING HAD SEEN IT, AND IT IS THE REASON THIS PROBE EXISTS RATHER THAN
 * A NEW ASSERTION. `city-budget.json` → `region` is cx, cz ∈ [−5, 4], and over
 * those hundred chunks at seed 1337 there is **exactly one recreation island**
 * — a playground, the variant whose palette is least likely to draw a tree.
 * `citycheck`'s delivered census is taken at `SHOTS.street`, so it sees the
 * same one. The operator's court is eight chunks north of the region's edge.
 *
 * So the gate's own region is not a population for this question, and a probe
 * that sweeps a wider one is the honest instrument. `citycheck` keeps the
 * verdict — `occupancy` → `maxDeliveredConflicts` is 0 and the `pitch` row in
 * `occupancy.js` is what makes a tree on a court one — and this prints the
 * population that verdict is taken over, the same arrangement `clustercheck`
 * has with `perfcheck` and `benchprobe` with `citycheck`.
 *
 * IT ALSO CARRIES THE TWO-SIDED CONTROL, per CONTRACT §7.7: an instrument is
 * checked against a case whose answer is known from OUTSIDE it. The three
 * cases are hand-computed from the conflict table and their expected outcomes
 * are written beside them, so a change to `occupancy.js` that quietly made the
 * `pitch` row inert would print FAIL here rather than a plausible zero.
 *
 * Usage:
 *   node tools/playprobe.mjs                 25 x 25 chunks at seed 1337
 *   node tools/playprobe.mjs --r=5 --seed=1338
 *   node tools/playprobe.mjs --list          every prop still standing on one
 */

import { generateChunk, recreationVariant, CITY, PLAY_HOURS, playOpen, PLAY_PEOPLE_PER_M2 } from '../src/lib/citygen.js';
import { claimBox, claimAt, findConflicts, mayOverlap } from '../src/lib/occupancy.js';

const args = new Map(
  process.argv.slice(2).map((a) => {
    const i = a.indexOf('=');
    return i < 0 ? [a.replace(/^--/, ''), true] : [a.slice(2, i), a.slice(i + 1)];
  })
);
const SEED = Number(args.get('seed') || 1337);
const R = Number(args.get('r') || 12);

/**
 * The ground kinds that ARE a play area, and the two that are not but look
 * like one. Kept as one list so the difference is visible: `sportGround` and
 * `playField` claim `pitch` and refuse a prop; `hardGround` is the same
 * macadam `sportGround` is made of, on a school yard and a church square,
 * and claims `ground` — which permits one.
 */
const PLAY_KINDS = ['sportGround', 'playField'];
const LOOKALIKE_KINDS = ['hardGround', 'parkingGround'];

function sweep() {
  const rows = new Map();
  const offenders = [];
  let chunks = 0;
  const variants = {};
  for (let cz = -R; cz <= R; cz++) {
    for (let cx = -R; cx <= R; cx++) {
      const ch = generateChunk(SEED, cx, cz);
      chunks++;
      if (ch.kind === 'recreation') {
        const v = recreationVariant(ch.density);
        variants[v] = (variants[v] || 0) + 1;
      }
      for (const g of ch.ground) {
        const watched = PLAY_KINDS.includes(g.kind) || LOOKALIKE_KINDS.includes(g.kind);
        if (!watched) continue;
        const key = `${ch.kind}/${g.kind}`;
        let r = rows.get(key);
        if (!r) rows.set(key, (r = { chunks: new Set(), rects: 0, m2: 0, props: {} }));
        r.chunks.add(`${cx},${cz}`);
        r.rects++;
        r.m2 += (g.x1 - g.x0) * (g.z1 - g.z0);
        for (const p of ch.props) {
          if (p.x <= g.x0 || p.x >= g.x1 || p.z <= g.z0 || p.z >= g.z1) continue;
          r.props[p.kind] = (r.props[p.kind] || 0) + 1;
          offenders.push(`${key} (${cx},${cz}) ${p.kind} at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
        }
      }
    }
  }
  return { rows, offenders, chunks, variants };
}

/**
 * THE GENERATOR'S OWN REGISTRY, SWEPT FOR CONFLICTS OVER THE SAME REGION.
 *
 * `citycheck` runs this over its own 10 × 10 and over the DELIVERED scene at
 * one camera. Here it is the pure generator over a region wide enough to
 * contain a recreation island, which is the population the question needs.
 */
function generatorConflicts() {
  let total = 0;
  const byPair = {};
  for (let cz = -R; cz <= R; cz++) {
    for (let cx = -R; cx <= R; cx++) {
      for (const c of findConflicts(generateChunk(SEED, cx, cz).registry.all(), 50)) {
        total++;
        const k = `${c.a.kind}(${c.a.owner}) x ${c.b.kind}(${c.b.owner})`;
        byPair[k] = (byPair[k] || 0) + 1;
      }
    }
  }
  return { total, byPair };
}

/**
 * THE CONTROL — three cases whose answers come from the conflict table read by
 * a person, not from running the table.
 *
 * The boxes are the ones the defect was actually measured on: the pad the
 * operator's court delivers, and the two trees that stood on it before
 * session 60. A positive case, a negative case OF THE SAME KIND at a
 * different place, and a case that must be permitted because the court is
 * made of it.
 */
function control() {
  /** The delivered pad of chunk (4, 8) at seed 1337. */
  const pad = claimBox('pitch', 558, 1067, 594, 1109, { owner: 'sport:court' });
  /** The first of the two trees, at its measured claim. */
  const treeOn = claimBox('prop', 574.0, 1075.8, 577.0, 1078.7, { owner: 'tree' });
  /** The same tree, moved twenty metres off the pad. */
  const treeOff = claimBox('prop', 574.0, 1115.8, 577.0, 1118.7, { owner: 'tree' });
  /** A hoop, which stands ON the pad by design. */
  const hoop = claimAt('feature', 561.4, 1088, 1.32, 0.90, { y0: 0, y1: 4.1, owner: 'sport:hoop' });
  /** A floodlight mast, which stands on the pad's run-off by design. */
  const flood = claimAt('site', 559, 1068, 0.7, 0.7, { y0: 0, y1: 18, owner: 'sport:flood' });

  const cases = [
    ['a tree ON the pad', [pad, treeOn], 1],
    ['the same tree BESIDE it', [pad, treeOff], 0],
    ['the hoop that belongs on it', [pad, hoop], 0],
    ['the floodlight mast on its run-off', [pad, flood], 0],
  ];
  const out = [];
  for (const [name, claims, want] of cases) {
    const got = findConflicts(claims, 10).length;
    out.push({ name, want, got, ok: got === want });
  }
  /** And the table itself, read directly — the answer nobody has to run. */
  out.push({
    name: 'the table says pitch x prop is forbidden',
    want: 0, got: mayOverlap('pitch', 'prop') ? 1 : 0, ok: !mayOverlap('pitch', 'prop'),
  });
  out.push({
    name: 'the table says pitch x feature is permitted',
    want: 0, got: mayOverlap('pitch', 'feature') ? 0 : 1, ok: mayOverlap('pitch', 'feature'),
  });
  return out;
}

const { rows, offenders, chunks, variants } = sweep();

console.log(`playprobe — ${chunks} chunks, cx,cz in [${-R}, ${R}], seed ${SEED}\n`);
console.log(`recreation variants: ${JSON.stringify(variants)}`);
console.log(`citycheck's own region is cx,cz in [-5, 4] — ${
  (2 * 5) ** 2 === 100 ? '100 chunks' : ''} — and holds one of them at seed 1337.\n`);

console.log('SURFACE                      chunks rects       area   props standing on it');
for (const [key, r] of [...rows.entries()].sort()) {
  const play = PLAY_KINDS.includes(key.split('/')[1]);
  console.log(
    `${(play ? '* ' : '  ') + key.padEnd(26)} ${String(r.chunks.size).padStart(5)} ${
      String(r.rects).padStart(5)} ${(r.m2 / 10000).toFixed(2).padStart(8)} ha  ${
      Object.keys(r.props).length ? JSON.stringify(r.props) : '—'}`
  );
}
console.log('\n  * = claims `pitch` and refuses a prop. The rest claim `ground`, which permits one.');

if (args.get('list')) {
  console.log('\nEVERY PROP STANDING ON A WATCHED SURFACE');
  for (const o of offenders) console.log(`  ${o}`);
}

const gc = generatorConflicts();
console.log(`\nGENERATOR conflicts over the same region: ${gc.total}`);
for (const [k, n] of Object.entries(gc.byPair)) console.log(`   ${n}x ${k}`);

console.log('\nCONTROL — the answers are hand-computed from the conflict table (CONTRACT §7.7)');
let bad = 0;
for (const c of control()) {
  if (!c.ok) bad++;
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.name}`);
}
console.log(bad
  ? `  ${bad} control case(s) FAILED — the pitch row is not doing what this file says it does.`
  : '  all control cases hold, in both directions.');

console.log('\nWHEN A PLAY AREA IS IN USE (citygen.js → PLAY_HOURS), and the second factor');
console.log('is streetlife.js\'s own diurnal crowd curve, which acts on top of this one.');
console.log('  t      hour   pitch  court  playground');
for (const t of [0, 0.125, 0.25, 0.3333, 0.5, 0.6667, 0.78, 0.875]) {
  console.log(`  ${t.toFixed(4)} ${String((t * 24).toFixed(1)).padStart(5)}   ${
    ['pitch', 'court', 'playground'].map((v) => playOpen(v, t).toFixed(2).padStart(5)).join('  ')}`);
}
console.log(`  hours: ${Object.entries(PLAY_HOURS).map(([k, v]) => `${k} ${v.openH}-${v.closeH}`).join(', ')}`);
console.log(`  PLAY_PEOPLE_PER_M2 = ${PLAY_PEOPLE_PER_M2.toFixed(5)} (ten players over a 60 x 38 m five-a-side pitch)`);
for (const [key, r] of [...rows.entries()].sort()) {
  if (!PLAY_KINDS.includes(key.split('/')[1])) continue;
  const per = r.m2 / Math.max(1, r.rects);
  console.log(`  ${key.padEnd(26)} mean area ${per.toFixed(0).padStart(5)} m2 -> ${
    (per * PLAY_PEOPLE_PER_M2).toFixed(1)} people at the open hour, before the ring's apportionment`);
}
console.log(`\nchunk size ${CITY.chunkSize} m; the operator's court is chunk (4, 8).`);
