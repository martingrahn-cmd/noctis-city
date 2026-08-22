#!/usr/bin/env node
/**
 * padprobe.mjs — WHAT REFUSES A PERIMETER BUILDING, BY NAME AND BY GEOMETRY.
 * NOT A GATE, and it must never become one. SESSION 39.
 *
 *   node tools/padprobe.mjs                 who refuses, and how much frontage
 *   node tools/padprobe.mjs --power=0       the same at the walk's ceiling
 *   node tools/padprobe.mjs --shape         every claim's box against its mass
 *   node tools/padprobe.mjs --endgaps       what the end-of-run gaps are
 *   node tools/padprobe.mjs --seeds=a,b,c   pooled over regions
 *
 * WHY IT EXISTS.
 *
 * `funnelprobe` (session 38) attributes every metre of island edge to a stage,
 * and its largest post-roll loss is the depth clip: 17.4% of the edge, refused
 * by `hit.kind` — `landmark 78, building 143, water 34, block 29, deck 12` at
 * the shipped law. STATE 38 §1.5 reads that as *"a landmark refuses 87% of what
 * it meets and a block 100%, because both pads run ALONG the frontage and the
 * clip can only shorten"*, and STATE 38 §7.3 asks why.
 *
 * A KIND IS NOT A PAD. `landmark` is eight structures with four different
 * shapes, and a repair to a pad has to name the pad, its owner and the metres
 * it costs. So the walk carries `FRONTAGE_TRACE` (`citygen.js`, session 39,
 * inert and off by default) and this file reads it.
 *
 * THE THREE QUESTIONS, AND THEY ARE SEPARABLE — WHICH IS THE POINT.
 *
 *   1. WHOSE PAD. Owner by owner, with the metres of frontage each refuses.
 *   2. IS IT THE MASS OR THE MARGIN? A candidate refused by a claim it
 *      OVERLAPS is refused by the thing. A candidate refused by a claim it does
 *      not overlap is refused by `BUILDING_SETBACKS.landmark` — 4.2 m of clear
 *      ground, one pavement wide — and that is a different fact with a
 *      different repair.
 *   3. IS IT THE SHAPE? A claim is an AABB and several of the things it stands
 *      for are not. The basin is a 210 m disc claimed as a 210 m square: 21% of
 *      what it refuses is ground the basin is not standing on. `--shape`
 *      prints claimed area against mass area for every landmark in the region.
 *
 * AND THE FOURTH, WHICH IS THE WALK'S RATHER THAN THE PAD'S. When a pad refuses
 * a candidate the walk advances `width + rng.range(0, 3)` ≈ 20.5 m and tries
 * again. That advance knows nothing about where the pad ENDS, so it can stop
 * short of it (another refusal, correct) or step past it (frontage skipped for
 * nothing). Both are measured here as `lead` and `overshoot`.
 *
 * IT ASSERTS NOTHING ABOUT THE CITY. `citycheck` owns the verdicts.
 */

import {
  CITY, CORRIDOR, generateChunk, FRONTAGE_FILL, FRONTAGE_TRACE,
  LANDMARKS, landmarkGroundClaims, landmarkAABB, BLOCK_KEEPOUT,
} from '../src/lib/citygen.js';

const args = new Map(process.argv.slice(2).map((a) => {
  const i = a.indexOf('=');
  return i < 0 ? [a.replace(/^--/, ''), 'true'] : [a.slice(0, i).replace(/^--/, ''), a.slice(i + 1)];
}));

const R = Number(args.get('radius') || 5);
const SEEDS = (args.get('seeds') || '1337').split(',');
const POWER = args.has('power') ? Number(args.get('power')) : null;

const f1 = (n) => (Number.isFinite(n) ? n.toFixed(1) : '  —  ');
const f3 = (n) => (Number.isFinite(n) ? n.toFixed(3) : '  —  ');

/** Walk the region with the trace on and hand back every row. */
function trace(seed, power) {
  const was = FRONTAGE_FILL.power;
  if (power != null) FRONTAGE_FILL.power = power;
  FRONTAGE_TRACE.on = true;
  FRONTAGE_TRACE.rows = [];
  let edgeM = 0;
  for (let cx = -R; cx < R; cx++) {
    for (let cz = -R; cz < R; cz++) {
      const c = generateChunk(seed, cx, cz);
      if (c.frontage && c.frontage.sides) edgeM += c.frontage.frontageM;
    }
  }
  const rows = FRONTAGE_TRACE.rows;
  FRONTAGE_TRACE.on = false;
  FRONTAGE_TRACE.rows = [];
  FRONTAGE_FILL.power = was;
  return { rows, edgeM };
}

/**
 * THE CANDIDATE'S OWN FRONTAGE SPAN AGAINST THE CLAIM THAT REFUSED IT, both
 * projected onto the side's along-axis. This is the whole of question 2 and 4:
 *
 *     t ────────────────── t+width          the candidate's frontage
 *          [ hit.lo ── hit.hi ]             the claim, projected
 *     |lead|                |after|
 *
 * `lead` is buildable frontage between the candidate's start and the pad;
 * `after` is buildable frontage between the pad and the candidate's end.
 * Either at 11 m or more is a building the walk could have had without moving
 * the pad by a millimetre — the walk refuses the whole 19 m lot because one
 * metre of it is under something.
 */
function project(row) {
  const lo = row.axis === 'x' ? row.hit.x0 : row.hit.z0;
  const hi = row.axis === 'x' ? row.hit.x1 : row.hit.z1;
  const a = row.t;
  const b = row.t + row.width;
  return {
    lo, hi,
    lead: Math.max(0, Math.min(hi, lo) - a),
    after: Math.max(0, b - Math.max(lo, hi)),
    coverM: Math.max(0, Math.min(b, hi) - Math.max(a, lo)),
    /** Where the walk lands after the fixed advance, against the pad's far edge. */
    landsAt: row.t + row.consumed,
  };
}

/* ── --shape: every claim's box against the mass it stands for ─────────────── */
if (args.has('shape')) {
  console.log('padprobe --shape — every landmark ground claim, claimed area against mass area');
  console.log('  A claim is an AABB. Where the thing is not, the difference is ground the pad');
  console.log('  refuses a building on and protects nothing at.\n');
  console.log('  landmark            kind        claims   claimed m2    mass m2    slack     AABB m2');
  let totalClaimed = 0;
  let totalMass = 0;
  for (const l of LANDMARKS) {
    const gs = landmarkGroundClaims(l);
    const claimed = gs.reduce((t, g) => t + (g.x1 - g.x0) * (g.z1 - g.z0), 0);
    // The mass: for a basin the disc it is lathed from, otherwise the boxes are
    // the mass by construction (they come off `landmarkOccluders`).
    const mass = l.kind === 'basin' ? Math.PI * l.radius * l.radius : claimed;
    const a = landmarkAABB(l);
    totalClaimed += claimed;
    totalMass += mass;
    console.log(`  ${String(l.name).padEnd(18)}${String(l.kind).padEnd(12)}${String(gs.length).padStart(4)}`
      + `${Math.round(claimed).toString().padStart(13)}${Math.round(mass).toString().padStart(11)}`
      + `${(claimed - mass ? `${(100 * (claimed - mass) / claimed).toFixed(1)}%` : '—').padStart(9)}`
      + `${Math.round((a.x1 - a.x0) * (a.z1 - a.z0)).toString().padStart(12)}`);
  }
  console.log(`  ${'TOTAL'.padEnd(30)}    ${Math.round(totalClaimed).toString().padStart(13)}`
    + `${Math.round(totalMass).toString().padStart(11)}`
    + `${(100 * (totalClaimed - totalMass) / totalClaimed).toFixed(1)}%`.padStart(9));
  console.log(`\n  the origin block  ${BLOCK_KEEPOUT.x1 - BLOCK_KEEPOUT.x0} x ${BLOCK_KEEPOUT.z1 - BLOCK_KEEPOUT.z0} m`
    + ` = ${(BLOCK_KEEPOUT.x1 - BLOCK_KEEPOUT.x0) * (BLOCK_KEEPOUT.z1 - BLOCK_KEEPOUT.z0)} m2,`
    + ' authored by block.js — see --pads for what it refuses.');
  process.exit(0);
}

/* ── --endgaps: what the end-of-run gap actually is ────────────────────────── */
if (args.has('endgaps')) {
  console.log(`padprobe --endgaps — seed ${SEEDS[0]}, power ${POWER ?? FRONTAGE_FILL.power}`);
  console.log('  `rng.range(6, 26)` after the last building of every run of 1–4. LOOK.md §2 asks');
  console.log('  that an empty parcel be empty FOR A REASON; this asks what these are.\n');
  const { rows, edgeM } = trace(SEEDS[0], POWER);
  const built = rows.filter((r) => r.what === 'built');
  const end = built.filter((r) => r.gapKind === 'end');
  const run = built.filter((r) => r.gapKind === 'run');
  const gapM = end.reduce((t, r) => t + r.gap, 0);
  // Where does the gap FALL? A gap whose far end is past the side's own tail is
  // not a gap in a street wall at all — it is the tail, counted twice by eye.
  const spent = end.filter((r) => r.roomAfter > 12);
  const atEnd = end.filter((r) => r.roomAfter <= 12);
  const spentM = spent.reduce((t, r) => t + r.gap, 0);
  const atEndM = atEnd.reduce((t, r) => t + r.gap, 0);
  console.log(`  buildings delivered            ${built.length}`);
  console.log(`  runs that ended with one       ${end.length}   gaps of ${f1(gapM / end.length)} m mean, `
    + `${f1(gapM)} m total, ${f1((100 * gapM) / edgeM)}% of the island edge`);
  console.log(`  within-run gaps                ${run.length}   ${f1(run.reduce((t, r) => t + r.gap, 0) / run.length)} m mean`);
  console.log('');
  console.log('  WHERE THE END-OF-RUN GAP FALLS — the walk continues only while `t < side.to - 12`.');
  console.log(`    mid-side, the walk goes on   ${spent.length.toString().padStart(4)}   ${f1(spentM).padStart(7)} m   `
    + `${f1((100 * spentM) / edgeM)}% of the edge   <- a hole in a street wall`);
  console.log(`    at the end, the side stops   ${atEnd.length.toString().padStart(4)}   ${f1(atEndM).padStart(7)} m   `
    + `${f1((100 * atEndM) / edgeM)}% of the edge   <- the corner, and the tail is beyond it`);
  console.log('');
  const hist = new Map();
  for (const r of end) {
    const b = Math.floor(r.gap / 4) * 4;
    hist.set(b, (hist.get(b) || 0) + 1);
  }
  console.log('  THE GAP ITSELF, IN 4 m BINS — an alley is 3–6 m and a yard is 20 m.');
  for (const b of [...hist.keys()].sort((x, y) => x - y)) {
    console.log(`    ${String(b).padStart(3)}–${String(b + 4).padEnd(3)} m  ${'#'.repeat(Math.round((60 * hist.get(b)) / end.length))} ${hist.get(b)}`);
  }
  const alley = end.filter((r) => r.gap < 6).length;
  const meanW = built.reduce((t, r) => t + r.width, 0) / built.length;
  const wide = end.filter((r) => r.gap > meanW).length;
  console.log(`\n  under 6 m — the width of an alley: ${alley} of ${end.length} (${f1((100 * alley) / end.length)}%)`);
  console.log(`  the law is \`rng.range(6, 26)\`, so a gap under 6 m is UNREACHABLE and the comment`);
  console.log('  at it — *"where the side alleys, the yards and the blank end walls live"* — names');
  console.log('  a thing this law cannot produce.');
  console.log(`  wider than the MEAN DELIVERED BUILDING (${f1(meanW)} m): ${wide} of ${end.length} `
    + `(${f1((100 * wide) / end.length)}%)`);
  process.exit(0);
}

/* ── the default: whose pad, and is it the mass or the margin ──────────────── */
console.log(`padprobe — ${SEEDS.length} region(s) of ${2 * R} x ${2 * R}, seeds ${SEEDS.join(',')}, `
  + `power ${POWER ?? FRONTAGE_FILL.power}`);

const all = [];
let edge = 0;
for (const sd of SEEDS) {
  const r = trace(sd, POWER);
  all.push(...r.rows);
  edge += r.edgeM;
}
const clip = all.filter((r) => r.what === 'clip');
const kept = all.filter((r) => r.what === 'clipKept');
const built = all.filter((r) => r.what === 'built');
console.log(`  ${all.length} traced rows: ${built.length} delivered, ${clip.length} clip refusals, `
  + `${kept.length} clipped shorter and kept, over ${Math.round(edge)} m of island edge.\n`);

/** 1. WHOSE PAD. */
const byOwner = new Map();
for (const r of clip) {
  const k = `${r.kind}:${r.owner}`;
  const e = byOwner.get(k) || { kind: r.kind, owner: r.owner, n: 0, m: 0, kept: 0, overlap: 0, margin: 0, lead: 0, after: 0, land: 0 };
  const p = project(r);
  e.n++;
  e.m += r.consumed;
  if (p.coverM > 0) e.overlap++; else e.margin++;
  if (p.lead >= 11) e.lead++;
  if (p.after >= 11) e.after++;
  if (p.landsAt > p.hi) e.land += p.landsAt - p.hi;
  byOwner.set(k, e);
}
for (const r of kept) {
  const k = `${r.kind}:${r.owner}`;
  const e = byOwner.get(k) || { kind: r.kind, owner: r.owner, n: 0, m: 0, kept: 0, overlap: 0, margin: 0, lead: 0, after: 0, land: 0 };
  e.kept++;
  byOwner.set(k, e);
}
console.log('  1. WHOSE PAD. Every claim that refused a perimeter candidate, by its own owner.');
console.log('     `refused%` is this owner\'s refusals over everything it met — STATE 38 §1.5\'s');
console.log('     87% and 100%, split by the thing rather than by the category.\n');
console.log('     kind      owner                    refused    kept   refused%    metres   % of edge');
const rows = [...byOwner.values()].sort((a, b) => b.m - a.m);
for (const e of rows) {
  console.log(`     ${e.kind.padEnd(10)}${String(e.owner).padEnd(24)}${String(e.n).padStart(5)}`
    + `${String(e.kept).padStart(8)}${`${((100 * e.n) / (e.n + e.kept)).toFixed(0)}%`.padStart(10)}`
    + `${f1(e.m).padStart(11)}${f1((100 * e.m) / edge).padStart(11)}%`);
}
console.log(`     ${'TOTAL'.padEnd(34)}${String(clip.length).padStart(5)}${String(kept.length).padStart(8)}`
  + `${`${((100 * clip.length) / (clip.length + kept.length)).toFixed(0)}%`.padStart(10)}`
  + `${f1(clip.reduce((t, r) => t + r.consumed, 0)).padStart(11)}`
  + `${f1((100 * clip.reduce((t, r) => t + r.consumed, 0)) / edge).padStart(11)}%`);

/** 2. THE MASS OR THE MARGIN. */
const overlap = clip.filter((r) => project(r).coverM > 0);
const margin = clip.filter((r) => project(r).coverM <= 0);
console.log('\n  2. IS IT THE MASS OR THE MARGIN? A candidate whose own frontage span does not');
console.log('     reach the claim at all was refused by `BUILDING_SETBACKS` — 4.2 m of clear');
console.log('     ground — or by the claim standing BEHIND it in depth rather than across it.');
console.log(`     refused by a claim its frontage OVERLAPS   ${String(overlap.length).padStart(4)}   `
  + `${f1((100 * overlap.length) / clip.length)}%`);
console.log(`     refused with no overlap along the frontage ${String(margin.length).padStart(4)}   `
  + `${f1((100 * margin.length) / clip.length)}%`);

/** 3. WHAT A NARROWER OR SLID CANDIDATE WOULD HAVE FOUND. */
const lead = clip.map(project).filter((p) => p.lead >= 11);
const after = clip.map(project).filter((p) => p.after >= 11);
const leadM = lead.reduce((t, p) => t + p.lead, 0);
const afterM = after.reduce((t, p) => t + p.after, 0);
console.log('\n  3. WHAT A NARROWED CANDIDATE WOULD HAVE FOUND, with the pad untouched. The walk');
console.log('     refuses the WHOLE lot when any part of it is under something; the clip can');
console.log('     only shorten a building, never narrow it or slide it along the frontage.');
console.log(`     refusals with >= 11 m clear BEFORE the claim   ${String(lead.length).padStart(4)}   ${f1(leadM).padStart(8)} m`);
console.log(`     refusals with >= 11 m clear AFTER the claim    ${String(after.length).padStart(4)}   ${f1(afterM).padStart(8)} m`);
console.log(`     either                                        ${String(clip.map(project).filter((p) => p.lead >= 11 || p.after >= 11).length).padStart(4)}`);

/**
 * 5. THE THING, OR ITS BOUNDING BOX?
 *
 * Only the basin is decided here, and that is deliberate. A claim is an AABB
 * and a `basin` is a disc — a hole in the ground with a rim, nothing
 * overhanging — so a candidate whose own footprint clears the disc is refused
 * by the CORNER OF A SQUARE and by nothing else. The other round landmarks are
 * NOT decided: a `cone` is an inverted cone whose 44 m crown overhangs a 13 m
 * base, a `hyperboloid`'s ground claim is already NARROWER than its own 62 m
 * base radius (`landmarkOccluders` scales by 0.82 for the bake), and a `dome`
 * sits on a drum. Each of those is a question about a solid rather than about a
 * pad, and answering it wrongly puts a building inside a landmark.
 */
const discOf = (owner) => {
  const l = LANDMARKS.find((x) => x.name === owner);
  return l && l.kind === 'basin' ? l : null;
};
/** Does the candidate's own full-depth footprint reach the disc at all? */
function reachesDisc(row, l, pad) {
  const along0 = row.t;
  const along1 = row.t + row.width;
  const far = row.at - row.out * (row.wanted ?? 0);
  const a0 = Math.min(row.at, far);
  const a1 = Math.max(row.at, far);
  const x0 = row.axis === 'x' ? along0 : a0;
  const x1 = row.axis === 'x' ? along1 : a1;
  const z0 = row.axis === 'x' ? a0 : along0;
  const z1 = row.axis === 'x' ? a1 : along1;
  // Closest point of the box to the disc centre.
  const dx = Math.max(x0 - l.x, 0, l.x - x1);
  const dz = Math.max(z0 - l.z, 0, l.z - z1);
  return Math.hypot(dx, dz) <= l.radius + pad;
}
const PAD = CITY.sidewalkWidth;
const discRows = clip.filter((r) => r.kind === 'landmark' && discOf(r.owner));
const cornerOnly = discRows.filter((r) => !reachesDisc(r, discOf(r.owner), PAD));
const cornerM = cornerOnly.reduce((t, r) => t + r.consumed, 0);
console.log('\n  5. THE THING, OR ITS BOUNDING BOX? A `basin` is a disc claimed as a square, so');
console.log('     21.5% of what it refuses is ground it is not standing on. A candidate whose own');
console.log(`     footprint clears the disc by the ${PAD} m setback was refused by a corner.`);
console.log(`     refusals by a basin                       ${String(discRows.length).padStart(4)}   `
  + `${f1(discRows.reduce((t, r) => t + r.consumed, 0)).padStart(8)} m`);
console.log(`     of those, clear of the disc + setback     ${String(cornerOnly.length).padStart(4)}   `
  + `${f1(cornerM).padStart(8)} m   ${f1((100 * cornerM) / edge)}% of the island edge`);
console.log('     the other landmarks are NOT decided here — a cone overhangs its own base, a');
console.log('     hyperboloid\'s claim is already narrower than its base, and a dome has a drum.');

/** 4. WHERE THE FIXED ADVANCE LANDS. */
const past = clip.map(project).filter((p) => p.landsAt > p.hi);
const short = clip.map(project).filter((p) => p.landsAt <= p.hi);
const pastM = past.reduce((t, p) => t + (p.landsAt - p.hi), 0);
console.log('\n  4. WHERE THE WALK LANDS AFTER A REFUSAL. `t += width + rng.range(0, 3)` knows');
console.log('     nothing about where the claim ENDS.');
console.log(`     lands PAST the claim's far edge   ${String(past.length).padStart(4)}   ${f1(pastM).padStart(8)} m skipped `
  + `beyond it, ${f1(pastM / Math.max(1, past.length))} m each`);
console.log(`     lands short of it, tries again    ${String(short.length).padStart(4)}   (correct: the claim is still there)`);
