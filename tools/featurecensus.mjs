#!/usr/bin/env node
/**
 * featurecensus.mjs — WHAT THE SHARED FEATURE TRANSFORM PLACES, AND HOW FAR
 * ITS ENDS ARE OFF THE GROUND. NOT A GATE, and it must never become one.
 * SESSION 65.
 *
 *   node tools/featurecensus.mjs                  both halves
 *   node tools/featurecensus.mjs --sites          the enumeration only, no browser
 *   node tools/featurecensus.mjs --at=3260,180,0  where the camera stands
 *   node tools/featurecensus.mjs --ring=40        half-width of the counted region, chunks
 *
 * ════════════════════════════════════════════════════════════════════════════
 * WHY IT EXISTS: ONE TRANSFORM, EIGHTEEN KINDS, AND A YAW WHERE A PITCH IS OWED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `city.js`'s feature loop defines ONE closure, `put(dx, dy, dz, sx, sy, sz,
 * albedo, rough, yawDeg)`, and every feature kind in this project becomes boxes
 * through it. It takes its base from a SINGLE `worldSurface(f.x, f.z).y` sample
 * at the feature's centre and it composes a YAW AND NOTHING ELSE. On level
 * ground that is exact. On a slope it is a rigid box held level over ground
 * that is not, so the object's ends leave the surface by `L · g / 2` — and the
 * further from the centre a box is put, the worse it is.
 *
 * SESSION 64 MEASURED ONE KIND OF IT AND SAID SO: **5 174 hedgerow segments on
 * hill shoulders, ends a median 1.04 m off the ground on a 1.8 m object**, p90
 * 2.59, max 6.84. It named the repair — a pitch in the shared transform — and
 * declined it as its own session's work. Its brief had asked for the same
 * number for the HOUSES and its report does not contain it.
 *
 * **THAT IS WHY THIS IS A CENSUS AND NOT A HEDGE MEASUREMENT.** `put` is the
 * `city.js` analogue of `block.js`'s markings `put`, which was the ONE y-source
 * for 221 road marks and mirrored every feature's yaw for eight sessions before
 * anybody counted what went through it. CONTRACT §9 rule 7 territory: a shared
 * transform is where a wrong datum reaches the most objects, and the
 * enumeration is worth more than any one repair.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IT IS TWO HALVES, THE SAME ARRANGEMENT `landmarkcensus.mjs` HAS.
 *
 * **HALF A, no browser.** Every `f.kind` branch of the loop, greppped out of
 * `city.js`, matched against a DECLARED table saying where that kind is placed
 * and what it is; a branch with no row prints **UNCLASSIFIED**. Then the pure
 * generator counts every feature over a region, split by whether it stands
 * inside the disc where `terrainHeightAt` is exactly zero.
 *
 * **HALF B, in the browser.** For every feature the DELIVERED scene claims, the
 * base the transform used against the ground under its own drawn footprint —
 * `city.worldSurfaceAt` at the centre against the same query at the four
 * corners of the claim `city.js` recorded for it. That query is the player's
 * own (`occupancyCensus` says why), so what is measured is the surface a boot
 * stands on and not a second description of it.
 *
 * THE CORNERS ARE THE MEASUREMENT AND THE CENTRE IS THE DATUM, which is the
 * whole shape of the defect: `put` is right about the centre by construction
 * and can be arbitrarily wrong at the ends.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * AND IT ASKS WHETHER ANYTHING STANDS ON THE ROAD, because that decides whether
 * a pitch may read `terrainNormalAt` at all. Session 64 hoisted the exit road's
 * stations and found the smooth function differs from the drawn strip by up to
 * 0.0149 m; anything on the ribbon must read the stations. `worldSurfaceAt`
 * returns the `kind` it answered from, so the count of features standing on
 * `road` is a number here rather than an assumption in the repair.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { startServer, launchBrowser, openPage, readRendererString, ROOT } from './lib/page.mjs';
import { CITY, generateChunk, terrainHeightAt, terrainNormalAt } from '../src/lib/citygen.js';

const args = new Map(process.argv.slice(2).map((a) => {
  const s = a.replace(/^--/, '');
  const i = s.indexOf('=');
  return i < 0 ? [s, 'true'] : [s.slice(0, i), s.slice(i + 1)];
}));

const SEED = args.get('seed') || '1337';
const RING = Number(args.get('ring') || 34);
const num = (s) => s.split(',').map(Number);
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);
const f2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : '  —  ');

/* ─────────────────────────── the enumeration ─────────────────────────── */

/**
 * Every `f.kind` the shared transform serves, with where it is placed and how
 * long the thing is. `extentM` is the LONGEST horizontal dimension of what the
 * kind draws, because that is what multiplies the gradient: an object of length
 * L on gradient g has its ends `L · g / 2` off a level base.
 *
 * `where` is one of `city`, `country` or `both`, and it is the scope question
 * the repair has to answer.
 */
const DECLARED = [
  ['edge', 'a park railing, a hedgerow or a low wall', 'both', 12.0],
  ['goal', "a pitch's goal frame", 'city', 7.32],
  ['hoop', 'a basketball hoop', 'city', 1.8],
  ['play', "a playground's own equipment", 'city', 6.0],
  ['centre', "a park's centre piece — a pavilion, a pond, a bandstand", 'city', 16.0],
  ['lamp', 'a lighting column and its head', 'both', 2.1],
  ['graves', "a churchyard's grave rows", 'city', 2.2],
  ['hoarding', "a site's hoarding panel", 'city', 2.4],
  ['spoil', "a site's spoil heap", 'city', 9.0],
  ['frame', "a site's steel frame", 'city', 18.0],
  ['shed', 'a farmhouse, a barn, a country house, a depot', 'both', 24.0],
  ['villa', 'a hillside house', 'country', 24.0],
  ['canopy', 'a market hall or a depot cover', 'city', 26.0],
  ['tower', 'a farm silo', 'country', 4.4],
  ['stand', "a stadium's stands", 'city', 96.0],
  ['deckpark', 'a multi-storey car park', 'city', 65.0],
  ['parked', 'a parked vehicle', 'both', 4.6],
  ['stub', 'a surviving party wall on a cleared site', 'city', 12.0],
  ['flood', 'a site mast or a yard work light', 'both', 1.2],
  ['crane', "a site's tower crane", 'city', 42.0],
];

const BRANCH_RE = /f\.kind === '([a-zA-Z]+)'/g;

async function enumerateBranches() {
  const src = await readFile(path.join(ROOT, 'src', 'modules', 'city.js'), 'utf8');
  /**
   * The feature loop, bounded by its own `for` and the claim it pushes at the
   * end. Bounding it matters: `f.kind` is also tested in the census mapping
   * eight hundred lines down, and counting those as branches would report a
   * transform serving kinds it does not draw.
   */
  const start = src.indexOf('for (const f of chunk.features)');
  const end = src.indexOf('THE PAINT — session 21', start);
  if (start < 0 || end < 0) throw new Error('featurecensus: could not bound the feature loop in city.js');
  const body = src.slice(start, end);
  const kinds = new Set();
  BRANCH_RE.lastIndex = 0;
  let m;
  while ((m = BRANCH_RE.exec(body))) kinds.add(m[1]);
  const putCalls = (body.match(/\bput\(/g) || []).length;
  const line = src.slice(0, start).split('\n').length;
  return { kinds: [...kinds].sort(), putCalls, line };
}

async function enumeratePushSites() {
  const src = await readFile(path.join(ROOT, 'src', 'lib', 'citygen.js'), 'utf8');
  const out = new Map();
  const re = /features\.push\(\{\s*kind: '([a-zA-Z]+)'/g;
  let m;
  while ((m = re.exec(src))) {
    const line = src.slice(0, m.index).split('\n').length;
    if (!out.has(m[1])) out.set(m[1], []);
    out.get(m[1]).push(line);
  }
  return out;
}

/** Every feature the generator produces over the region, by kind. */
function countFeatures() {
  const rows = new Map();
  let chunks = 0;
  for (let cx = -RING; cx <= RING; cx++) {
    for (let cz = -RING; cz <= RING; cz++) {
      const ch = generateChunk(SEED, cx, cz);
      chunks++;
      for (const f of (ch.features || [])) {
        if (!rows.has(f.kind)) {
          rows.set(f.kind, { inside: 0, outside: 0, onSlope: 0, worstDeg: 0, insideSlope: 0, insideWorst: 0 });
        }
        const r = rows.get(f.kind);
        const rad = Math.hypot(f.x, f.z);
        const inDisc = rad <= CITY.extentEdgeM;
        if (inDisc) r.inside++;
        else r.outside++;
        const n = terrainNormalAt(SEED, f.x, f.z);
        if (n[1] < 1) {
          r.onSlope++;
          const deg = (Math.acos(Math.min(1, n[1])) * 180) / Math.PI;
          if (deg > r.worstDeg) r.worstDeg = deg;
          /**
           * INSIDE THE DISC AND STILL NOT VERTICAL — and it is not a hole in
           * the zero guarantee, it is the INSTRUMENT'S OWN FOOTPRINT.
           * `terrainNormalAt` is a central difference at `TERRAIN.stationM / 2`
           * = 16 m, so a query 16 m inside `rampStartM` straddles the boundary
           * and one of its four samples is outside the flat disc. The HEIGHT at
           * those points is still exactly 0; it is the SLOPE that is not, and
           * it is the slope this session's repair reads. Counted separately
           * because a scope decision that quietly moved geometry inside the
           * city would be exactly what CONTRACT §9 asks about.
           */
          if (inDisc) {
            r.insideSlope++;
            if (deg > r.insideWorst) r.insideWorst = deg;
          }
        }
      }
    }
  }
  return { rows, chunks };
}

/* ──────────────────────────────── output ─────────────────────────────── */

function printSites(branches, pushes, counted) {
  console.log('\n  ── HALF A: WHAT GOES THROUGH THE SHARED TRANSFORM ─────────────────────\n');
  console.log(`  city.js's feature loop starts at line ${branches.line} and makes ${branches.putCalls} put() calls`);
  console.log(`  across ${branches.kinds.length} kinds. Every one of them is one yaw and no pitch.\n`);
  console.log(`  ${pad('kind', 10)} ${pad('what it is', 46)} ${lpad('extent m', 9)} ${lpad('inside', 7)} ${lpad('outside', 8)} ${lpad('on slope', 9)} ${lpad('worst', 6)}`);
  console.log(`  ${'─'.repeat(10)} ${'─'.repeat(46)} ${'─'.repeat(9)} ${'─'.repeat(7)} ${'─'.repeat(8)} ${'─'.repeat(9)} ${'─'.repeat(6)}`);
  let unclassified = 0;
  let onSlope = 0;
  let insideOnSlope = 0;
  for (const k of branches.kinds) {
    const d = DECLARED.find((r) => r[0] === k);
    const c = counted.rows.get(k) || { inside: 0, outside: 0, onSlope: 0, worstDeg: 0, insideSlope: 0, insideWorst: 0 };
    onSlope += c.onSlope;
    if (!d) {
      unclassified++;
      console.log(`  ${pad(k, 10)} ${pad('** UNCLASSIFIED — add it to DECLARED **', 46)}`);
      continue;
    }
    console.log(
      `  ${pad(k, 10)} ${pad(d[1], 46)} ${lpad(d[3].toFixed(1), 9)} ${lpad(c.inside, 7)} `
      + `${lpad(c.outside, 8)} ${lpad(c.onSlope, 9)} ${lpad(c.worstDeg.toFixed(1) + '°', 6)}`
    );
  }
  for (const k of counted.rows.keys()) {
    if (!branches.kinds.includes(k)) {
      console.log(`  ${pad(k, 10)} ${pad('** the generator pushes it and the loop DRAWS NOTHING **', 46)}`);
      unclassified++;
    }
  }
  const totalIn = [...counted.rows.values()].reduce((a, r) => a + r.inside, 0);
  const totalOut = [...counted.rows.values()].reduce((a, r) => a + r.outside, 0);
  insideOnSlope = [...counted.rows.values()].reduce((a, r) => a + r.insideSlope, 0);
  const insideWorst = [...counted.rows.values()].reduce((a, r) => Math.max(a, r.insideWorst), 0);
  const insideR = [...counted.rows.values()].reduce((a, r) => a + 0, 0);
  console.log(`\n  ${(2 * RING + 1) ** 2} chunks generated, ${((2 * RING + 1) * CITY.chunkSize / 1000).toFixed(1)} km square.`);
  console.log(`  ${totalIn + totalOut} features: ${totalIn} inside r <= ${CITY.extentEdgeM} m, ${totalOut} outside it.`);
  console.log(`  ${onSlope} stand where terrainNormalAt is not exactly vertical.`);
  console.log(`  OF THOSE, ${insideOnSlope} ARE INSIDE THE DISC, worst ${insideWorst.toFixed(3)}°.`);
  console.log('  That is the instrument\'s own 16 m central difference straddling `rampStartM`,');
  console.log('  not a hole in the zero guarantee: the HEIGHT at those points is still exactly 0.');
  console.log(`  ${insideR}`.replace(/.*/, ''));
  console.log('\n  WHERE EACH KIND IS PUSHED (citygen.js line numbers):');
  for (const k of branches.kinds) {
    const p = pushes.get(k);
    console.log(`      ${pad(k, 10)} ${p ? p.join(' ') : '(pushed nowhere in citygen.js — city.js draws it from elsewhere)'}`);
  }
  return { unclassified, onSlope };
}

function printMeasured(rows) {
  console.log('\n  ── HALF B: HOW FAR THE ENDS ARE OFF THE GROUND, IN THE DELIVERED SCENE ─\n');
  console.log('  Base = city.worldSurfaceAt at the feature CENTRE, which is what the');
  console.log('  transform used. Error = the worst |ground − base| over the four corners');
  console.log("  of the claim city.js recorded for that feature's own drawn boxes.\n");
  const by = new Map();
  for (const r of rows) {
    const k = r.owner;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(r);
  }
  const q = (a, p) => (a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : NaN);
  /**
   * The `kind`s `worldSurfaceAt` answers with when the surface under a point is
   * the TERRAIN MESH and not a rectangle laid on it. Only these can be pitched:
   * everything else is a flat plate whose own extent is the question.
   */
  const ON_TERRAIN = new Set(['earth']);
  console.log('  `pitchable` is the share of the error a pitch could take out, and it is ZERO');
  console.log('  unless the feature is STANDING ON THE TERRAIN. That distinction is the whole');
  console.log('  of the reading and it is easy to lose:\n');
  console.log('    a hedge stands on `earth`, the terrain mesh itself, and a rigid 12 m box on');
  console.log('      a 22° shoulder has its ends in the air because the transform has no pitch.');
  console.log('      A pitch removes it.');
  console.log('    a VILLA stands on `grass` — its own plot rectangle, which `citygen.js` lays');
  console.log('      FLAT at one `yAdd`, because a house\'s plot IS a terrace cut into a');
  console.log('      hillside. **Pitching a house standing on a level terrace would tip the');
  console.log('      house.** Its corners hang off the ground because the PLOT is smaller than');
  console.log('      the rotated house — STATE 64 §9 item 4, already named and costed.');
  console.log('    a LAMP HEAD\'s claim spans a 0.160 m kerb on a perfectly vertical post.\n');
  console.log('  Two defects with one symptom. `stands on` is the column that separates them.\n');
  console.log(`  ${pad('owner', 22)} ${lpad('n', 6)} ${lpad('over .05', 9)} ${lpad('p50', 7)} ${lpad('p90', 7)} ${lpad('max', 7)} ${lpad('span m', 7)} ${lpad('slope', 7)} ${pad('stands on', 9)} ${lpad('pitchable', 10)}`);
  console.log(`  ${'─'.repeat(22)} ${'─'.repeat(6)} ${'─'.repeat(9)} ${'─'.repeat(7)} ${'─'.repeat(7)} ${'─'.repeat(7)} ${'─'.repeat(7)} ${'─'.repeat(7)} ${'─'.repeat(9)} ${'─'.repeat(10)}`);
  const order = [...by.entries()].sort((a, b) => b[1].length - a[1].length);
  let total = 0;
  let bad = 0;
  for (const [k, list] of order) {
    const e = list.map((r) => r.err).sort((a, b) => a - b);
    const span = list.map((r) => r.span).sort((a, b) => a - b);
    const slope = list.map((r) => r.slopeDeg).sort((a, b) => a - b);
    const over = e.filter((v) => v > 0.05).length;
    /** Summed rather than averaged: it is a share of the total departure. */
    const sumE = list.reduce((a, r) => a + r.err, 0);
    const sumP = list.reduce((a, r) => a + (ON_TERRAIN.has(r.baseKind) ? Math.min(r.err, r.predicted) : 0), 0);
    const bases = new Map();
    for (const r of list) bases.set(r.baseKind, (bases.get(r.baseKind) || 0) + 1);
    const topBase = [...bases.entries()].sort((a, b) => b[1] - a[1])[0][0];
    total += list.length;
    bad += over;
    console.log(
      `  ${pad(k, 22)} ${lpad(list.length, 6)} ${lpad(over, 9)} ${lpad(f2(q(e, 0.5)), 7)} `
      + `${lpad(f2(q(e, 0.9)), 7)} ${lpad(f2(e[e.length - 1]), 7)} ${lpad(f2(q(span, 0.9)), 7)} `
      + `${lpad(q(slope, 0.9).toFixed(2) + '°', 7)} ${pad(topBase, 9)} `
      + `${lpad(sumE > 1e-6 ? `${((100 * sumP) / sumE).toFixed(0)}%` : '—', 10)}`
    );
  }
  const sumE = rows.reduce((a, r) => a + r.err, 0);
  const sumP = rows.reduce((a, r) => a + (ON_TERRAIN.has(r.baseKind) ? Math.min(r.err, r.predicted) : 0), 0);
  console.log(`\n  ${total} features measured, ${bad} with an end over 0.05 m off the ground`
    + ` — the join tolerance every other surface in this project uses.`);
  console.log(`  ${sumE.toFixed(1)} m of departure in total, of which a pitch can take out`
    + ` ${sumP.toFixed(1)} m — ${((100 * sumP) / Math.max(1e-9, sumE)).toFixed(0)}%.`);
  const onRoad = rows.filter((r) => r.baseKind === 'road');
  console.log(`  ${onRoad.length} of them stand on a surface \`worldSurfaceAt\` answers \`road\` for.`);
  if (onRoad.length) {
    console.log('  THOSE MAY NOT TAKE A PITCH FROM `terrainNormalAt`: the ribbon draws straight');
    console.log('  lines between 8 m stations and the smooth function departs from it by up to');
    console.log('  0.0149 m (STATE 64 §5a). Two datums, one quantity — CONTRACT §9 rule 7.');
  }
  const outside = rows.filter((r) => Math.hypot(r.x, r.z) > CITY.extentEdgeM);
  const inside = rows.filter((r) => Math.hypot(r.x, r.z) <= CITY.extentEdgeM);
  const worstIn = inside.reduce((a, r) => Math.max(a, r.err), 0);
  console.log(`\n  inside  r <= ${CITY.extentEdgeM} m: ${inside.length} features, worst end error ${f2(worstIn)} m`);
  console.log(`  outside r >  ${CITY.extentEdgeM} m: ${outside.length} features, worst end error `
    + `${f2(outside.reduce((a, r) => Math.max(a, r.err), 0))} m`);
  return { total, bad, onRoad: onRoad.length, worstIn };
}


function printBoxes(rows) {
  console.log('\n  ── THE DELIVERED BOXES: WORST BOTTOM CORNER OFF THE GROUND ────────────\n');
  console.log('  Every instanced box whose bottom-face CENTRE is within 0.30 m of the surface,');
  console.log('  measured off its own delivered instanceMatrix. This is the quantity a pitch');
  console.log('  in the shared transform actually moves.\n');
  const q = (a, p) => (a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : NaN);
  const groups = [
    ['inside  r <= ' + CITY.extentEdgeM, rows.filter((r) => r.r <= CITY.extentEdgeM)],
    ['outside r >  ' + CITY.extentEdgeM, rows.filter((r) => r.r > CITY.extentEdgeM)],
  ];
  console.log(`  ${pad('region', 22)} ${lpad('boxes', 7)} ${lpad('over .05', 9)} ${lpad('p50', 7)} ${lpad('p90', 7)} ${lpad('p99', 7)} ${lpad('max', 7)} ${lpad('sum m', 9)}`);
  console.log(`  ${'─'.repeat(22)} ${'─'.repeat(7)} ${'─'.repeat(9)} ${'─'.repeat(7)} ${'─'.repeat(7)} ${'─'.repeat(7)} ${'─'.repeat(7)} ${'─'.repeat(9)}`);
  for (const [label, list] of groups) {
    const w = list.map((r) => r.worst).sort((a, b) => a - b);
    console.log(
      `  ${pad(label, 22)} ${lpad(list.length, 7)} ${lpad(w.filter((v) => v > 0.05).length, 9)} `
      + `${lpad(f2(q(w, 0.5)), 7)} ${lpad(f2(q(w, 0.9)), 7)} ${lpad(f2(q(w, 0.99)), 7)} `
      + `${lpad(f2(w[w.length - 1]), 7)} ${lpad(w.reduce((a, b) => a + b, 0).toFixed(1), 9)}`
    );
  }
  const worstRows = rows.slice().sort((a, b) => b.worst - a.worst).slice(0, 6);
  console.log('\n  the six worst boxes in the scene:');
  for (const r of worstRows) {
    console.log(`      ${pad(r.name, 20)} at (${lpad(r.x, 8)}, ${lpad(r.z, 8)})  r ${lpad(r.r, 5)}  `
      + `diag ${lpad(r.diag.toFixed(1), 6)} m  worst ${r.worst.toFixed(2)} m`);
  }
}

/* ──────────────────────────────── run ────────────────────────────────── */

const branches = await enumerateBranches();
const pushes = await enumeratePushSites();
const counted = countFeatures();
printSites(branches, pushes, counted);

if (args.has('sites')) process.exit(0);

const AT = args.has('at') ? num(args.get('at')) : [CITY.extentEdgeM + 28, 180, 0];
const LOOK = args.has('look') ? num(args.get('look')) : [CITY.extentEdgeM + 900, 0, 700];

const server = await startServer(5209);
const browser = await launchBrowser();
const { page } = await openPage(browser, { viewport: { width: 800, height: 450 } });
try {
  const url = new URL(server.url);
  url.searchParams.set('seed', SEED);
  url.searchParams.set('paused', '1');
  await page.goto(url.toString(), { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!window.__NOCTIS_HARNESS__, null, { timeout: 60000 });
  await page.evaluate(() => window.__NOCTIS_HARNESS__.ready);
  await page.evaluate(() => window.__NOCTIS_HARNESS__.takeOver());
  console.log(`\n  GPU: ${await readRendererString(page)}`);
  await page.evaluate(
    (s) => window.__NOCTIS_HARNESS__.setShotAt(s.pos, s.target, 55),
    { pos: AT, target: LOOK }
  );
  await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity(1800));
  await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity(1800));
  console.log(`  camera: [${AT.join(', ')}] → [${LOOK.join(', ')}]`);
  /**
   * THE KIND LIST IS THIS FILE'S, GREPPED OUT OF `city.js`'s OWN LOOP, and it
   * is passed IN rather than known by the harness — so a kind added to the
   * transform appears in this census without anything else being edited, and
   * the two sides cannot hold different lists (CONTRACT §9.1).
   */
  const rows = await page.evaluate(
    (ks) => window.__NOCTIS_HARNESS__.featureGround(ks),
    branches.kinds
  );
  printMeasured(rows);

  /**
   * ── AND THE EFFECT, WHICH IS THE ONE A REPAIR MOVES ───────────────────────
   *
   * `printMeasured` above reports how much the GROUND varies under a feature's
   * footprint. That is the cause and it is a property of the landscape: a pitch
   * does not change it, and the first arm of this session's item 2 measured
   * exactly that and reported no improvement from a repair that works.
   *
   * This is the delivered geometry: every instanced box whose bottom face sits
   * on the ground at its own centre, and how far its worst bottom CORNER is
   * from the ground under that corner. Level box on a slope: `d/2 · g`. Box
   * raked with the ground: the residual only.
   */
  const boxes = await page.evaluate(() => window.__NOCTIS_HARNESS__.boxGroundCensus());
  printBoxes(boxes);
} finally {
  await browser.close();
  server.child.kill('SIGKILL');
}
