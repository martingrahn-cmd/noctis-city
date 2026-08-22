#!/usr/bin/env node
/**
 * funnelprobe.mjs — FROM THE FILL LAW TO A METRE OF STREET BEHIND A WALL.
 * NOT A GATE, and it must never become one. SESSION 38.
 *
 *   node tools/funnelprobe.mjs                 the funnel at the shipped law
 *   node tools/funnelprobe.mjs --power=1.10    one arm
 *   node tools/funnelprobe.mjs --sweep         every arm, both funnels
 *   node tools/funnelprobe.mjs --stages        the step ratios, pooled over regions
 *   node tools/funnelprobe.mjs --laws          every gap law against its own mean
 *   node tools/funnelprobe.mjs --quartiles     what a denser law can buy, and where
 *   node tools/funnelprobe.mjs --transfer      fill in, occupancy out, per chunk
 *   node tools/funnelprobe.mjs --identity      the instrumentation is inert
 *   node tools/funnelprobe.mjs --depth=band    session 34's depth, no corner clip
 *
 * WHY IT EXISTS.
 *
 * `fillprobe` measures the two ENDS of a chain — what the law evaluates to, and
 * what fraction of a block frontage carries a building — and nothing in
 * between. Session 38's brief puts the two side by side: the law reads 0.74 at
 * a mid-density chunk and the delivered occupancy reads 0.355, and asks whether
 * the difference is definitional or whether something is lost.
 *
 * IT CANNOT BE ANSWERED FROM THE ENDS. A ratio of two numbers that measure
 * different quantities is a number, and this project has spent sessions on
 * exactly that mistake (CONTRACT §9). So every stage is counted in
 * `citygen.js`'s own walk — see the `frontage` tally there — and this file only
 * sums, divides and prints.
 *
 * THE TWO FUNNELS, AND WHY IT TAKES TWO.
 *
 *   - THE COUNT FUNNEL. Candidate lots in, buildings out, with every refusal
 *     attributed. This is the one the fill law acts on: `rng.next() > fill` is
 *     a Bernoulli trial per candidate and nothing else.
 *   - THE LENGTH FUNNEL. Where the metres of island edge go. This is the one
 *     the delivered occupancy is a ratio of, and it is not the same funnel: a
 *     REFUSED candidate still consumes its own width plus a gap, so a refusal
 *     costs frontage rather than merely failing to buy any.
 *
 * The count funnel and the length funnel have different denominators and
 * different answers, and reading one as the other is this project's named
 * failure mode with a probability and a length.
 *
 * THE METRES CLOSE, AND THAT IS ASSERTED. For every side walked the buckets
 * below sum to the side's own length exactly. A funnel whose stages do not sum
 * to their parent is a list of numbers that happen to decrease.
 *
 * IT ASSERTS NOTHING ABOUT THE CITY. `citycheck` owns the verdicts.
 */

import { createHash } from 'node:crypto';
import {
  CITY, CORRIDOR, generateChunk, FRONTAGE_FILL, frontageFill, DEPTH_DISTRIBUTION, WALK,
} from '../src/lib/citygen.js';

const args = new Map(process.argv.slice(2).map((a) => {
  const i = a.indexOf('=');
  return i < 0 ? [a.replace(/^--/, ''), 'true'] : [a.slice(0, i).replace(/^--/, ''), a.slice(i + 1)];
}));

/**
 * THE DEPTH LAW AS AN ARM, exactly as `fillprobe --depth=band` offers it.
 * `--depth=band` restores session 34's `rng.range(15, 26)` with no corner clip —
 * the city session 32 swept its fill over. It is here because the funnel's
 * largest post-roll drop is the corner clip, and a knob that turns the clip off
 * is the only way to say whether that drop belongs to the DEPTH law rather than
 * to the fill law being followed down the chain.
 */
if (args.get('depth') === 'band') Object.assign(DEPTH_DISTRIBUTION, { mode: 'band', clip: false });

/**
 * THE TWO SESSION-39 ARMS, so the repair can be measured against the thing it
 * repairs from the command line rather than by editing the generator between
 * runs. `--overrun=abandon --refusal=step` is the walk exactly as session 38
 * measured it, and it is how every "before" figure in STATE 39 was taken.
 */
if (args.has('overrun')) WALK.overrun = args.get('overrun');
if (args.has('refusal')) WALK.refusal = args.get('refusal');

/** The same region `citycheck`, `fillprobe` and `depthprobe` report over. */
const R = Number(args.get('radius') || 5);
const SEED = args.get('seed') || '1337';
const ISLAND = CITY.chunkSize - 2 * CORRIDOR;

const f3 = (n) => (Number.isFinite(n) ? n.toFixed(3) : '  —  ');
const pc = (n, d) => (d ? (100 * n) / d : NaN);
const med = (a) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/**
 * THE MEAN OF EACH GAP LAW, WRITTEN OUT, so "more than its definition explains"
 * is a comparison and not a judgement. These are the uniform draws in the
 * perimeter walk, quoted from the walk itself; if a line there moves, the
 * corresponding row of the DEFINITION column below goes stale and the residual
 * is what says so.
 */
const LAW = {
  width: (11 + 27) / 2,          // rng.range(11, 27)
  leadIn: (0 + 9) / 2,           // rng.range(0, 9), once per side
  fillGap: (1 + 7) / 2,          // after a fill-roll refusal
  refuseGap: (0 + 3) / 2,        // after a river / clip / registry refusal
  runGap: (0.2 + 1.4) / 2,       // between two buildings of one run
  endGap: (6 + 26) / 2,          // after the last building of a run
};

/** ONE ARM. Every field of the walk's own tally, summed over the region. */
function arm(power, seed = SEED) {
  const was = FRONTAGE_FILL.power;
  if (power != null) FRONTAGE_FILL.power = power;

  const T = {
    fill: 0, sides: 0, frontageM: 0, leadInM: 0, tailM: 0,
    runs: 0, candidates: 0, overrun: 0, overrunM: 0,
    overrunRoomMinM: Infinity, overrunRoomMaxM: 0,
    clamped: 0, clampedM: 0, overrunRoomM: 0, widthOverrunDrawnM: 0,
    clampedDelivered: 0, clampedDeliveredM: 0,
    fillRefused: 0, fillRefusedM: 0, riverRefused: 0, riverRefusedM: 0,
    clipRefused: 0, clipRefusedM: 0, regRefused: 0, regRefusedM: 0,
    delivered: 0, builtM: 0, runGapM: 0, endGapM: 0, endGaps: 0,
    widthDrawnM: 0, widthDeliveredM: 0, widthFillRefusedM: 0, widthHardRefusedM: 0,
  };
  const clipRefusedBy = {};
  const clipKeptBy = {};
  let fillWeighted = 0;      // Σ fill_chunk · rolls_chunk
  let fillVar = 0;           // Σ fill(1−fill) · rolls_chunk, the binomial spread
  let rollsTaken = 0;
  const perChunk = [];
  const chunkFills = [];
  const chunkDensities = [];
  let builtChunks = 0;

  for (let cx = -R; cx < R; cx++) {
    for (let cz = -R; cz < R; cz++) {
      const c = generateChunk(seed, cx, cz);
      const F = c.frontage;
      if (!F || !F.sides) continue;      // lowDetail: no perimeter walk at all
      builtChunks++;
      for (const k of Object.keys(T)) {
        if (k === 'fill') continue;
        if (k === 'overrunRoomMinM') { T[k] = Math.min(T[k], F[k]); continue; }
        if (k === 'overrunRoomMaxM') { T[k] = Math.max(T[k], F[k]); continue; }
        T[k] += F[k];
      }
      for (const [k, v] of Object.entries(F.clipRefusedBy)) clipRefusedBy[k] = (clipRefusedBy[k] || 0) + v;
      for (const [k, v] of Object.entries(F.clipKeptBy)) clipKeptBy[k] = (clipKeptBy[k] || 0) + v;
      const rolls = F.candidates - F.overrun;
      rollsTaken += rolls;
      fillWeighted += F.fill * rolls;
      fillVar += F.fill * (1 - F.fill) * rolls;
      chunkFills.push(F.fill);
      chunkDensities.push(c.density);
      perChunk.push({
        cx, cz, d: c.density, fill: F.fill, rolls,
        rollPass: rolls ? (rolls - F.fillRefused) / rolls : NaN,
        occ: F.frontageM ? F.builtM / F.frontageM : 0,
        delivered: F.delivered, candidates: F.candidates,
      });
    }
  }

  FRONTAGE_FILL.power = was;

  const rollsPassed = rollsTaken - T.fillRefused;
  const hardRefused = T.riverRefused + T.clipRefused + T.regRefused;
  const consumedM = T.leadInM + T.tailM + T.overrunM + T.fillRefusedM
    + T.riverRefusedM + T.clipRefusedM + T.regRefusedM
    + T.builtM + T.runGapM + T.endGapM;
  return {
    power: power ?? FRONTAGE_FILL.power, T, perChunk, builtChunks, chunkFills, chunkDensities,
    clipRefusedBy, clipKeptBy,
    rollsTaken, rollsPassed, hardRefused, consumedM,
    residualM: T.frontageM - consumedM,
    fillMeanWeighted: rollsTaken ? fillWeighted / rollsTaken : NaN,
    fillSd: rollsTaken ? Math.sqrt(fillVar) / rollsTaken : NaN,
    rollRate: rollsTaken ? rollsPassed / rollsTaken : NaN,
    occ: T.frontageM ? T.builtM / T.frontageM : NaN,
  };
}

/* ── --identity ─────────────────────────────────────────────────────────────
 * THE TALLY DRAWS NO RANDOM NUMBER AND ADDS NO BRANCH, so the delivered city
 * must be bit-identical with it and without it. This is the digest of the
 * delivered city at the commit BEFORE the tally was added, computed over
 * `citycheck`'s own region — geometry, era, material, condition, facing, yaw
 * and the retail/pillar/display flags of every building, then every sign and
 * every prop. A tally that moved a stream would move it.
 */
const IDENTITY_SHA = 'bc693636e24827b9c6de6b40a7f664dc49ef77d01cd2c5968b6710feec0b8b76';
if (args.has('identity')) {
  const h = createHash('sha256');
  let n = 0; let sg = 0; let pr = 0;
  for (let cx = -R; cx < R; cx++) {
    for (let cz = -R; cz < R; cz++) {
      const c = generateChunk(SEED, cx, cz);
      n += c.buildings.length; sg += c.signs.length; pr += c.props.length;
      for (const b of c.buildings) {
        h.update(`${b.x.toFixed(9)},${b.z.toFixed(9)},${b.width.toFixed(9)},${b.depth.toFixed(9)},`
          + `${b.height.toFixed(9)},${b.floors},${b.era},${b.material},${b.condition},${b.facing},`
          + `${b.yawDeg.toFixed(9)},${b.retail},${b.adPillar},${b.displayFacade}\n`);
      }
      for (const s of c.signs) h.update(`${s.x?.toFixed(9)},${s.z?.toFixed(9)},${s.width?.toFixed(9)},${s.mount},${s.state},${s.chroma}\n`);
      for (const p of c.props) h.update(`${p.kind},${p.x.toFixed(9)},${p.z.toFixed(9)}\n`);
    }
  }
  const got = h.digest('hex');
  console.log(`funnelprobe --identity — seed ${SEED}, ${2 * R} x ${2 * R} chunks`);
  console.log(`  buildings ${n}  signs ${sg}  props ${pr}`);
  console.log(`  delivered digest  ${got}`);
  console.log(`  pre-tally digest  ${IDENTITY_SHA}`);
  console.log(got === IDENTITY_SHA
    ? '  IDENTICAL — the frontage tally is inert.'
    : '  DIFFERENT — the tally has moved a stream. It is not inert and nothing below is a baseline.');
  process.exit(got === IDENTITY_SHA ? 0 : 1);
}

/* ── the report ────────────────────────────────────────────────────────────*/
function report(a) {
  const { T } = a;
  const walkedFrontage = T.frontageM;

  console.log(`funnelprobe — seed ${SEED}, ${2 * R} x ${2 * R} chunks, fill = ${FRONTAGE_FILL.atZero} + `
    + `${(FRONTAGE_FILL.atOne - FRONTAGE_FILL.atZero).toFixed(2)} · d^${a.power}`);
  console.log(`  the island perimeter only. The quay walk has its own law and is not in this funnel.`);
  console.log(`  ${a.builtChunks} chunks carry a perimeter walk; ${T.sides} sides of ${ISLAND.toFixed(1)} m`);
  console.log(`  = ${walkedFrontage.toFixed(0)} m of island edge. The other ${4 * R * R - a.builtChunks} chunks are`);
  console.log(`  lowDetail and have no walk, so no fill law can reach them.\n`);

  /* ---- 1. THE LAW ------------------------------------------------------- */
  const fs = [...a.chunkFills].sort((x, y) => x - y);
  console.log('  1. THE LAW — what `frontageFill(density)` evaluates to, per walked chunk');
  console.log(`     min ${f3(fs[0])}   median ${f3(med(fs))}   max ${f3(fs[fs.length - 1])}`);
  console.log(`     mean weighted by the candidates it is rolled against   ${f3(a.fillMeanWeighted)}`);
  const ds = [...a.chunkDensities].sort((x, y) => x - y);
  console.log(`     at d = 0.5 the law reads ${f3(frontageFill(0.5, a.power))};  at d = 0.9, ${f3(frontageFill(0.9, a.power))}`);
  console.log(`     BUT THE REGION'S WALKED CHUNKS RUN d = ${f3(ds[0])} TO ${f3(ds[ds.length - 1])}, median ${f3(med(ds))}.`);
  console.log('     Below CITY.lowDetailThreshold a chunk has no perimeter walk unless a landmark');
  console.log('     touches it, and the field never reaches 0.9 here — so a fill quoted at d = 0.9');
  console.log('     is a value of the law at a density this region does not contain.\n');

  /* ---- 2. THE COUNT FUNNEL --------------------------------------------- */
  const rows = [
    ['candidate lots drawn', T.candidates, T.candidates],
    ['  − too wide for the frontage left', -T.overrun, T.candidates - T.overrun],
    ['fill roll taken', a.rollsTaken, a.rollsTaken],
    ['  − refused by the fill roll', -T.fillRefused, a.rollsPassed],
    ['passed the fill roll', a.rollsPassed, a.rollsPassed],
    ['  − refused: no land between lot and water', -T.riverRefused, a.rollsPassed - T.riverRefused],
    ['  − refused: clipped under the minimum depth', -T.clipRefused, a.rollsPassed - T.riverRefused - T.clipRefused],
    ['  − refused: registry conflict, no clip', -T.regRefused, T.delivered],
    ['DELIVERED BUILDINGS', T.delivered, T.delivered],
  ];
  console.log('  2. THE COUNT FUNNEL — one candidate lot is one draw of `width`');
  console.log('     stage                                          n      surviving   of candidates   step');
  let prev = null;
  for (const [label, n, surv] of rows) {
    const step = prev == null || prev === 0 ? NaN : surv / prev;
    console.log(`     ${label.padEnd(44)}${String(n > 0 ? n : n).padStart(6)}     ${String(surv).padStart(6)}      `
      + `${pc(surv, T.candidates).toFixed(1).padStart(6)}%      ${Number.isFinite(step) ? `${step.toFixed(3)}x` : ''}`);
    prev = surv;
  }
  console.log(`     the fill roll's own pass rate  ${f3(a.rollRate)}   against the law's `
    + `${f3(a.fillMeanWeighted)} ± ${(3 * a.fillSd).toFixed(4)} (3 sd, binomial)`);
  const dev = Math.abs(a.rollRate - a.fillMeanWeighted);
  console.log(`     deviation ${dev.toFixed(4)} — ${dev <= 3 * a.fillSd ? 'INSIDE the roll\'s own spread. The law is applied as written.'
    : 'OUTSIDE the roll\'s own spread. THE LAW IS NOT APPLIED AS WRITTEN.'}\n`);

  /* ---- 3. THE LENGTH FUNNEL -------------------------------------------- */
  const buckets = [
    ['STANDING BEHIND A BUILDING', T.builtM, T.delivered, LAW.width],
    ['lost: refused by the fill roll', T.fillRefusedM, T.fillRefused, LAW.width + LAW.fillGap],
    ['lost: end-of-run gaps', T.endGapM, T.endGaps, LAW.endGap],
    ['lost: registry refusals (conflict, no clip)', T.regRefusedM, T.regRefused, LAW.width + LAW.refuseGap],
    ['lost: tail — the last 12 m the while loop never enters', T.tailM, T.sides, NaN],
    ['lost: clip refusals (under the minimum depth)', T.clipRefusedM, T.clipRefused, LAW.width + LAW.refuseGap],
    ['lost: lead-in at the head of each side', T.leadInM, T.sides, LAW.leadIn],
    ['lost: within-run gaps between two buildings', T.runGapM, T.delivered - T.endGaps, LAW.runGap],
    ['lost: river refusals (no land at the bank)', T.riverRefusedM, T.riverRefused, LAW.width + LAW.refuseGap],
    ['lost: overrun — a candidate wider than what is left', T.overrunM, T.overrun, NaN],
  ].sort((x, y) => y[1] - x[1]);
  console.log('  3. THE LENGTH FUNNEL — every metre of island edge is in exactly one bucket.');
  console.log('     This is the funnel the delivered occupancy is a ratio of, and it is NOT the');
  console.log('     one above: a refused candidate consumes its own width and a gap.');
  console.log('     bucket                                                   metres    of edge     n    m/n   DEFINITION');
  for (const [label, m, n, def] of buckets) {
    console.log(`     ${label.padEnd(52)}${m.toFixed(0).padStart(8)}   ${pc(m, walkedFrontage).toFixed(1).padStart(5)}%  `
      + `${String(n).padStart(5)}  ${n ? (m / n).toFixed(1).padStart(5) : '    —'}  ${Number.isFinite(def) ? def.toFixed(1) : ''}`);
  }
  console.log(`     ${'TOTAL'.padEnd(52)}${a.consumedM.toFixed(0).padStart(8)}   ${pc(a.consumedM, walkedFrontage).toFixed(1).padStart(5)}%`);
  console.log(`     ${'RESIDUAL against the island edge itself'.padEnd(52)}${a.residualM.toFixed(6).padStart(8)} m`
    + `   ${Math.abs(a.residualM) < 1e-6 ? '— the funnel closes.' : '— THE FUNNEL DOES NOT CLOSE. A bucket is missing.'}\n`);

  /* ---- 3b. WHAT REFUSED IT --------------------------------------------- */
  console.log('  3b. THE LARGEST DROP, BY WHAT REFUSED IT — the depth clip. `hit.kind` is the');
  console.log('      claim the candidate met; KEPT is a candidate that met the same kind and');
  console.log('      survived at a shorter depth, which is what the clip was built to do.');
  console.log('      kind             REFUSED   KEPT (clipped)   refused share');
  const kinds = [...new Set([...Object.keys(a.clipRefusedBy), ...Object.keys(a.clipKeptBy)])]
    .sort((x, y) => (a.clipRefusedBy[y] || 0) - (a.clipRefusedBy[x] || 0));
  for (const k of kinds) {
    const r = a.clipRefusedBy[k] || 0;
    const kp = a.clipKeptBy[k] || 0;
    console.log(`      ${k.padEnd(16)}${String(r).padStart(6)}   ${String(kp).padStart(12)}   ${pc(r, r + kp).toFixed(0).padStart(11)}%`);
  }
  const totR = Object.values(a.clipRefusedBy).reduce((x, y) => x + y, 0);
  const totK = Object.values(a.clipKeptBy).reduce((x, y) => x + y, 0);
  console.log(`      ${'TOTAL'.padEnd(16)}${String(totR).padStart(6)}   ${String(totK).padStart(12)}   ${pc(totR, totR + totK).toFixed(0).padStart(11)}%\n`);

  /* ---- 3c. SELECTION ON WIDTH ------------------------------------------ */
  const overrunWidthM = T.widthDrawnM - T.widthDeliveredM - T.widthFillRefusedM - T.widthHardRefusedM;
  console.log('  3c. THE WIDTH DRAWN, BY OUTCOME — `rng.range(11, 27)` has a mean of 19.0 m by');
  console.log('      construction. An outcome whose mean is not 19.0 is SELECTING on width.');
  console.log('      outcome                        n     mean width   against 19.0');
  const wrows = [
    ['delivered', T.delivered, T.widthDeliveredM],
    ['refused by the fill roll', T.fillRefused, T.widthFillRefusedM],
    ['refused hard (river/clip/reg)', a.hardRefused, T.widthHardRefusedM],
    ['dropped by the overrun test', T.overrun, overrunWidthM],
    ['every candidate drawn', T.candidates, T.widthDrawnM],
  ];
  for (const [label, n, m] of wrows) {
    const mw = n ? m / n : NaN;
    console.log(`      ${label.padEnd(30)}${String(n).padStart(5)}   ${f3(mw).padStart(10)} m   ${(mw - LAW.width >= 0 ? '+' : '') + (mw - LAW.width).toFixed(2)} m`);
  }
  console.log('');

  /* ---- 3d. THE OVERRUN ------------------------------------------------- */
  console.log('  3d. THE OVERRUN — the one stage that ABANDONS frontage rather than walking past it.');
  console.log('      Every other refusal advances `t` by the candidate and a gap and keeps going.');
  console.log('      This one sets `t = side.to` and ends the side. The outer guard is');
  console.log('      `t < side.to - 12` and the narrowest building the walk can draw is 11.0 m, so');
  console.log('      a building fits in EVERY one of them by construction.');
  console.log(`      sides walked                                   ${String(T.sides).padStart(6)}`);
  console.log(`      sides that end this way                        ${String(T.overrun).padStart(6)}   ${pc(T.overrun, T.sides).toFixed(1)}% of all sides`);
  console.log(`      frontage abandoned                             ${T.overrunM.toFixed(0).padStart(6)} m  ${pc(T.overrunM, T.frontageM).toFixed(1)}% of the island edge`);
  console.log(`      room left when it fires: min ${T.overrunRoomMinM.toFixed(1)} m, mean ${(T.overrunM / (T.overrun || 1)).toFixed(1)} m, max ${T.overrunRoomMaxM.toFixed(1)} m`);
  console.log(`      the walk's own minimum building width          ${'11.0'.padStart(6)} m\n`);

  /* ---- 4. THE RECONCILIATION ------------------------------------------- */
  const p = a.fillMeanWeighted;
  console.log('  4. WHAT THE TWO NUMBERS ARE');
  console.log(`     the law                            ${f3(p)}   a PROBABILITY, per candidate lot`);
  console.log(`     the fill roll's delivered rate     ${f3(a.rollRate)}   the same probability, measured`);
  console.log(`     candidates that become a building  ${f3(T.delivered / T.candidates)}   a COUNT ratio`);
  console.log(`     frontage standing behind a wall    ${f3(a.occ)}   a LENGTH ratio — the occupancy`);
  const perCand = a.consumedM / T.candidates;
  console.log(`\n     a candidate lot is ${LAW.width.toFixed(1)} m of frontage by definition; it consumes `
    + `${perCand.toFixed(1)} m on average,`);
  console.log(`     because every candidate is followed by a gap whether it is built on or not.`);
  console.log(`     so the ceiling on occupancy at fill = 1.0 is not 1.0 — see --sweep.\n`);
}

/* ── --laws ────────────────────────────────────────────────────────────────
 * BRIEF (d): "if a stage loses more than its definition explains, that is a
 * defect". Every bucket in the length funnel except two has a DEFINITION — the
 * mean of the uniform the walk draws for it — so the test is arithmetic and not
 * a judgement. Pooled over seeds because a single region draws each of these a
 * few hundred times and the uniforms are wide: `rng.range(6, 26)` has a
 * standard deviation of 5.8 m, so its mean over 261 draws carries ±0.36 m of
 * standard error and a one-region reading of 15.1 against 16.0 is 2.4 sd —
 * exactly CONTRACT §0 rule 6's forbidden state if it were read as a verdict.
 */
if (args.has('laws')) {
  const seeds = (args.get('seeds') || '1337,1338,1339,1340,1341,1342,1343,1344,1345,1346,1347,1348').split(',');
  const power = args.has('power') ? Number(args.get('power')) : null;
  const acc = {};
  const add = (k, m, n, def, sd) => {
    const e = acc[k] || (acc[k] = { m: 0, n: 0, def, sd });
    e.m += m; e.n += n;
  };
  const sdU = (lo, hi) => (hi - lo) / Math.sqrt(12);
  const sdSum = (a, b) => Math.sqrt(a * a + b * b);
  let clampedN = 0;
  let clampedM = 0;
  let clampedDelN = 0;
  let clampedDelM = 0;
  for (const sd of seeds) {
    const { T } = arm(power, sd);
    clampedN += T.clamped; clampedM += T.clampedM;
    clampedDelN += T.clampedDelivered; clampedDelM += T.clampedDeliveredM;
    add('lead-in  rng.range(0, 9)', T.leadInM, T.sides, LAW.leadIn, sdU(0, 9));
    add('width    rng.range(11, 27), delivered', T.widthDeliveredM, T.delivered, LAW.width, sdU(11, 27));
    add('width    rng.range(11, 27), every draw', T.widthDrawnM, T.candidates, LAW.width, sdU(11, 27));
    add('fill refusal   width + rng.range(1, 7)', T.fillRefusedM, T.fillRefused, LAW.width + LAW.fillGap, sdSum(sdU(11, 27), sdU(1, 7)));
    add(WALK.refusal === 'resume'
      ? 'hard refusal   min(width + range(0,3), pad end)'
      : 'hard refusal   width + rng.range(0, 3)', T.clipRefusedM + T.riverRefusedM + T.regRefusedM,
      T.clipRefused + T.riverRefused + T.regRefused, LAW.width + LAW.refuseGap, sdSum(sdU(11, 27), sdU(0, 3)));
    add('within-run gap rng.range(0.2, 1.4)', T.runGapM, T.delivered - T.endGaps, LAW.runGap, sdU(0.2, 1.4));
    add('end-of-run gap rng.range(6, 26)', T.endGapM, T.endGaps, LAW.endGap, sdU(6, 26));
    /**
     * THE WIDTH BY OUTCOME, POOLED. Every candidate draws the same uniform, so
     * the four outcomes below must agree with each other and with 19.0 unless
     * something is SELECTING on width. Exactly one thing is allowed to: the
     * overrun test refuses a candidate for being too wide, by definition. The
     * rows are here so that the delivered row's deficit can be attributed to it
     * rather than asserted away.
     */
    const overrunWidth = T.widthOverrunDrawnM;
    add('  width of a fill-refused candidate', T.widthFillRefusedM, T.fillRefused, LAW.width, sdU(11, 27));
    add('  width of a hard-refused candidate', T.widthHardRefusedM, T.clipRefused + T.riverRefused + T.regRefused, LAW.width, sdU(11, 27));
    add('  width of an overrun candidate', overrunWidth, T.overrun, LAW.width, sdU(11, 27));
  }
  console.log(`funnelprobe --laws — ${seeds.length} regions of ${2 * R} x ${2 * R}, seeds ${seeds[0]}–${seeds[seeds.length - 1]}`);
  console.log(`  power ${power ?? FRONTAGE_FILL.power}. Each row is a uniform the walk draws; DEFINITION is its own`);
  console.log('  mean. A stage that loses more than its definition explains reads outside 3 se.\n');
  console.log('  what is drawn                                n      measured   DEFINITION    delta    3 se   verdict');
  if (WALK.refusal === 'resume') {
    /**
     * SAID BEFORE THE ROW IS READ RATHER THAN AFTER. Under
     * `WALK.refusal = 'resume'` a registry refusal advances to the LESSER of
     * `width + rng.range(0, 3)` and the far edge of the claim that refused it,
     * so 20.5 m is an upper bound on that row and not its mean. The row is
     * printed against 20.5 anyway, because the DISTANCE below it is the
     * frontage the repair hands back.
     */
    console.log('  NOTE: `refusal = resume`, so the hard-refusal row\'s 20.5 m is an UPPER BOUND and');
    console.log('  the deficit below it is what the repair returns rather than what it loses.\n');
  }
  if (WALK.overrun !== 'abandon') {
    /**
     * THE SECOND ARM'S OWN NOTE, AND IT IS OWED FOR THE SAME REASON. A clamped
     * candidate carries a NARROWER width than it drew into whichever bucket it
     * lands in, so every width row below reads under 19.0 by construction — the
     * fill-refusal and hard-refusal rows included. The paragraph after the table
     * gives the exact metres and where they went.
     */
    console.log(`  NOTE: \`overrun = ${WALK.overrun}\`, so a candidate whose draw did not fit carries a`);
    console.log('  NARROWER width into whichever bucket it lands in. Every width row below reads');
    console.log('  under 19.0 for that reason and not for another one.\n');
  }
  for (const [k, e] of Object.entries(acc)) {
    const mean = e.m / e.n;
    const se = e.sd / Math.sqrt(e.n);
    const d = mean - e.def;
    console.log(`  ${k.padEnd(42)}${String(e.n).padStart(6)}  ${mean.toFixed(3).padStart(9)}  ${e.def.toFixed(3).padStart(9)}  `
      + `${(d >= 0 ? '+' : '') + d.toFixed(3)}`.padStart(9) + `  ${(3 * se).toFixed(3).padStart(6)}   `
      + (Math.abs(d) <= 3 * se ? 'as defined' : 'OUTSIDE — a stage takes more than its definition'));
  }
  {
    const drawn = acc['width    rng.range(11, 27), every draw'];
    const over = acc['  width of an overrun candidate'];
    const dl = acc['width    rng.range(11, 27), delivered'];
    const poolN = drawn.n - over.n;
    const poolMean = (drawn.m - over.m) / poolN;
    const se = drawn.sd / Math.sqrt(dl.n);
    const d = dl.m / dl.n - poolMean;
    console.log(`\n  THE ONE ROW THAT IS OUTSIDE BY DESIGN, AND THE ONE THAT FOLLOWS FROM IT.`);
    console.log(`  The overrun test refuses a candidate FOR BEING TOO WIDE, so +${(over.m / over.n - LAW.width).toFixed(2)} m is its`);
    console.log(`  definition and not a defect. Removing those ${over.n} draws leaves a pool of ${poolN} at`);
    console.log(`  ${poolMean.toFixed(3)} m, and the delivered mean of ${(dl.m / dl.n).toFixed(3)} m stands ${(d >= 0 ? '+' : '') + d.toFixed(3)} m from it against 3 se`);
    console.log(`  of ${(3 * se).toFixed(3)} — ${Math.abs(d) <= 3 * se ? 'INSIDE. Nothing else selects on width.' : 'OUTSIDE. Something else selects on width.'}`);
    /**
     * AND UNDER `WALK.overrun = 'clamp'` SOMETHING ELSE DOES, BY CONSTRUCTION.
     * The clamp cuts a too-wide draw down to the frontage that remains, so a
     * clamped candidate is delivered NARROWER than it was drawn. That is the
     * repair working, not a defect — but it is a selection on width and this
     * instrument exists to name every one of them.
     */
    if (clampedN) {
      console.log(`\n  AND THE CLAMP SELECTS ON WIDTH BY CONSTRUCTION — \`WALK.overrun = '${WALK.overrun}'\`.`);
      console.log(`  ${clampedN} candidates were cut to the frontage that remained, ${clampedM.toFixed(0)} m in total at`);
      console.log(`  ${(clampedM / clampedN).toFixed(3)} m each. ${clampedDelN} of them became BUILDINGS, carrying ${clampedDelM.toFixed(0)} m of that cut`);
      console.log(`  into the delivered row: ${(clampedDelM / dl.n).toFixed(3)} m per delivered building against the ${(-d).toFixed(3)} m`);
      console.log(`  deficit measured above. The rest of the cut is on candidates the roll or the`);
      console.log('  registry refused afterwards, where it costs nothing.');
    }
  }

  console.log('\n  The two buckets with no DEFINITION are the overrun (`side.to - t` when a');
  console.log('  candidate is wider than what is left) and the tail (`side.to - t` when the');
  console.log('  while loop declines to start another run). Both are consequences of the walk\'s');
  console.log('  shape rather than draws, so there is no mean to compare them against.');
  process.exit(0);
}

/* ── --quartiles ──────────────────────────────────────────────────────────
 * WHAT A DENSER LAW CAN STILL BUY, AND WHERE.
 *
 * Session 38's brief proposes replacing the one-parameter power law with a
 * sigmoid on the grounds that a power law "cannot deliver a saturated core AND
 * a sparse periphery". That is a claim about the LAW. This table is the claim
 * about the CHAIN: delivered frontage occupancy per chunk, split at the
 * quartiles of the chunk's own density, at every arm from the shipped law to
 * `fill = 1.0` — which is the most any law of any shape can ask for.
 *
 * If the densest quarter is already flat across the arms, then the core is not
 * fill-limited and no law can saturate it, whatever its shape.
 */
/* ── --stages ─────────────────────────────────────────────────────────────
 * THE COUNT FUNNEL'S STEP RATIOS OVER SEVERAL REGIONS.
 *
 * One region walks ~1400 candidate lots, and every step ratio below is a
 * proportion read off that one draw. CONTRACT §0 rule 6 says a difference is
 * not read against a fixed line until its own spread is known, and the same
 * applies to a funnel: a stage that drops 0.696x in one region and 0.62x to
 * 0.75x across twelve has not been measured until the range is printed. This
 * mode prints the pooled ratio and the per-region min and max beside it.
 */
if (args.has('stages')) {
  const seeds = (args.get('seeds') || '1337,1338,1339,1340,1341,1342,1343,1344,1345,1346,1347,1348').split(',');
  const power = args.has('power') ? Number(args.get('power')) : null;
  const runs = seeds.map((sd) => arm(power, sd));
  const step = (num, den) => runs.map((a) => (den(a) ? num(a) / den(a) : NaN));
  const pooled = (num, den) => runs.reduce((t, a) => t + num(a), 0) / runs.reduce((t, a) => t + den(a), 0);
  const rows = [
    ['survive the overrun test', (a) => a.T.candidates - a.T.overrun, (a) => a.T.candidates],
    ['survive the fill roll', (a) => a.rollsPassed, (a) => a.rollsTaken],
    ['survive the river depth', (a) => a.rollsPassed - a.T.riverRefused, (a) => a.rollsPassed],
    ['survive the depth clip', (a) => a.T.delivered, (a) => a.rollsPassed - a.T.riverRefused],
    ['DELIVERED / candidates', (a) => a.T.delivered, (a) => a.T.candidates],
    ['OCCUPANCY = builtM / edge', (a) => a.T.builtM, (a) => a.T.frontageM],
    ['the law itself, weighted', (a) => a.fillMeanWeighted * a.rollsTaken, (a) => a.rollsTaken],
  ];
  console.log(`funnelprobe --stages — ${seeds.length} regions of ${2 * R} x ${2 * R}, power ${power ?? FRONTAGE_FILL.power}`);
  console.log(`  ${runs.reduce((t, a) => t + a.T.candidates, 0)} candidate lots pooled. `
    + 'The per-region min and max are what say whether a step ratio is a finding.\n');
  console.log('  step                              pooled     min     max    spread');
  for (const [label, num, den] of rows) {
    const v = step(num, den).filter(Number.isFinite);
    console.log(`  ${label.padEnd(32)}${f3(pooled(num, den)).padStart(6)}  ${f3(Math.min(...v)).padStart(6)}  `
      + `${f3(Math.max(...v)).padStart(6)}   ${f3(Math.max(...v) - Math.min(...v)).padStart(6)}`);
  }
  process.exit(0);
}

if (args.has('quartiles')) {
  const powers = (args.get('powers') || '1.40,1.10,0.90,0.70,0.50,0.30,0.00').split(',').map(Number);
  const seeds = (args.get('seeds') || '1337,1338,1339,1340,1341,1342,1343,1344').split(',');
  console.log(`funnelprobe --quartiles — ${seeds.length} regions, seeds ${seeds[0]}–${seeds[seeds.length - 1]}`);
  console.log('  Delivered FRONTAGE OCCUPANCY per walked chunk (the length ratio, not the area),');
  console.log('  pooled over the regions and split at the quartiles of the chunk\'s own density.');
  console.log('  `fill` is the candidate-weighted law; Q4 is the core.\n');
  console.log('  power    fill    occ Q1 sparse   occ Q2    occ Q3    occ Q4 core   Q4/Q1');
  for (const p of powers) {
    const pooled = [];
    let fw = 0; let rw = 0;
    for (const sd of seeds) {
      const a = arm(p, sd);
      pooled.push(...a.perChunk);
      fw += a.fillMeanWeighted * a.rollsTaken; rw += a.rollsTaken;
    }
    pooled.sort((x, y) => x.d - y.d);
    const k = Math.floor(pooled.length / 4);
    const Q = [0, 1, 2, 3].map((i) => med(pooled.slice(i * k, i === 3 ? pooled.length : (i + 1) * k).map((r) => r.occ)));
    console.log(`  ${p.toFixed(2).padStart(5)}   ${f3(fw / rw)}       ${f3(Q[0])}     ${f3(Q[1])}     ${f3(Q[2])}     `
      + `${f3(Q[3])}        ${f3(Q[3] / Q[0])}x`);
  }
  console.log('\n  Read the Q4 column down: it is what the core does as the law is opened all the');
  console.log('  way to `fill = 1.0`. Read Q1 down beside it: it is what the periphery does.');
  process.exit(0);
}

if (args.has('transfer')) {
  const a = arm(args.has('power') ? Number(args.get('power')) : null);
  console.log(`funnelprobe --transfer — seed ${SEED}, fill in, delivered per-chunk occupancy out`);
  console.log('  Each row is a decile of the walked chunks ranked by the law\'s own output.\n');
  console.log('   fill band      chunks   mean fill   roll pass   delivered occ   occ/fill');
  const s = [...a.perChunk].sort((x, y) => x.fill - y.fill);
  const k = Math.ceil(s.length / 10);
  for (let i = 0; i < s.length; i += k) {
    const g = s.slice(i, i + k);
    const mf = g.reduce((t, r) => t + r.fill, 0) / g.length;
    const rp = g.reduce((t, r) => t + r.rollPass * r.rolls, 0) / g.reduce((t, r) => t + r.rolls, 0);
    const mo = g.reduce((t, r) => t + r.occ, 0) / g.length;
    console.log(`   ${f3(g[0].fill)}–${f3(g[g.length - 1].fill)}   ${String(g.length).padStart(6)}      `
      + `${f3(mf)}       ${f3(rp)}          ${f3(mo)}       ${f3(mo / mf)}`);
  }
  process.exit(0);
}

if (args.has('sweep')) {
  const powers = (args.get('powers') || '1.40,1.10,0.90,0.70,0.50,0.30,0.00')
    .split(',').map(Number);
  console.log(`funnelprobe --sweep — seed ${SEED}, ${2 * R} x ${2 * R} chunks`);
  console.log('  Every column is over the walked frontage only. `occ` is the LENGTH ratio and');
  console.log('  `fill` is the PROBABILITY the law hands the walk — the gap between them is what');
  console.log('  this file exists to attribute.\n');
  console.log('  power    fill   rollPass   cands   built  fillRef  hardRef   occ    occ/fill   built%  fillRef%  endGap%  reg%   tail%');
  for (const p of powers) {
    const a = arm(p);
    const { T } = a;
    const F = T.frontageM;
    console.log(
      `  ${p.toFixed(2).padStart(5)}   ${f3(a.fillMeanWeighted)}    ${f3(a.rollRate)}   ${String(T.candidates).padStart(5)}   `
      + `${String(T.delivered).padStart(5)}   ${String(T.fillRefused).padStart(5)}    ${String(a.hardRefused).padStart(5)}  `
      + `${f3(a.occ)}    ${f3(a.occ / a.fillMeanWeighted)}    ${pc(T.builtM, F).toFixed(1).padStart(5)}%   `
      + `${pc(T.fillRefusedM, F).toFixed(1).padStart(5)}%   ${pc(T.endGapM, F).toFixed(1).padStart(5)}%  `
      + `${pc(T.regRefusedM, F).toFixed(1).padStart(5)}%  ${pc(T.tailM, F).toFixed(1).padStart(5)}%`
    );
  }
  console.log('\n  `occ/fill` is the TRANSFER RATIO — how much delivered frontage one unit of the');
  console.log('  law\'s probability buys. If it were 1.00 the two numbers would be the same');
  console.log('  quantity. It is not, and it is not constant either.');
  process.exit(0);
}

report(arm(args.has('power') ? Number(args.get('power')) : null));
