/**
 * benchprobe.mjs — NOT A GATE. SESSION 22.
 *
 * THE CLAIMED BOX BESIDE THE DELIVERED ONE, for the props `citycheck` →
 * `occupancy` reports as overlapping a carriageway. CONTRACT §9 rule 2: a
 * quantity derived two ways is printed both ways at least once, in the session
 * that derives it, with the two numbers next to each other.
 *
 * STATE 21 §1.3 handed over a disagreement rather than a repair: the
 * GENERATOR's registry reported 0 forbidden overlaps among 5 349 claims and
 * the DELIVERED census reported 60, every one a kerbside bench overlapping its
 * own carriageway. Two rounds of that check were closed by correcting the
 * instrument, so the third is owed a look at the geometry — and the only way
 * to look at the geometry is to put the two rectangles side by side and read
 * them.
 *
 * It asserts nothing and it must not. `citycheck` owns the verdict; this is
 * the instrument its numbers can be reproduced from, the same arrangement
 * `clustercheck` has with `perfcheck`.
 *
 * Three things it prints that a conflict count cannot:
 *
 *   1. The generator's claim and the delivered union, as (half-x, half-z)
 *      pairs. A transposition is visible in one glance and in no other form —
 *      two boxes whose half-extents are each other's swapped is not something
 *      an area or an overlap can say.
 *   2. `yawDeg` and `refDeg` off the generator's own prop record, beside the
 *      band the claim implies. The claim says which axis the prop is long on;
 *      the yaw says which axis it was DRAWN long on; a gate that reads only
 *      one of them cannot report a disagreement between them.
 *   3. `--claims=FILE`, which writes the generator registry's claims over the
 *      region as sorted JSON lines, so two runs either side of a change can be
 *      diffed. A change that touches only an emitted matrix must leave the
 *      registry bit-for-bit identical, and asserting that is cheaper than
 *      believing it.
 *
 * Usage:
 *   node tools/benchprobe.mjs                     the pair, for up to 8 props
 *   node tools/benchprobe.mjs --claims=out.jsonl  registry dump, no browser
 *   node tools/benchprobe.mjs --nobrowser         generator half only
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { startServer, launchBrowser, openPage, readRendererString, ROOT } from './lib/page.mjs';
import { generateChunk } from '../src/lib/citygen.js';
import { findConflicts } from '../src/lib/occupancy.js';

const BUDGET = JSON.parse(await readFile(new URL('./budget.json', import.meta.url), 'utf8'));
const CITY_BUDGET = JSON.parse(await readFile(new URL('./city-budget.json', import.meta.url), 'utf8'));

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);

const SEED = Number(args.get('seed') || BUDGET.capture.params.seed || 1337);
const R = CITY_BUDGET.region;
const LIMIT = Number(args.get('limit') || 8);

/* ---------------------------------------------------------------- generator */

/**
 * The generator's own registry over the gate's own region, plus the prop
 * records that produced it. `generateChunk` is pure in `(rootSeed, cx, cz)`
 * (CONTRACT §8.1), so this needs no browser and is identical on any machine.
 */
const genClaims = [];
const genProps = [];
for (let cz = R.cz[0]; cz <= R.cz[1]; cz++) {
  for (let cx = R.cx[0]; cx <= R.cx[1]; cx++) {
    const c = generateChunk(SEED, cx, cz);
    if (c.registry) for (const q of c.registry.all()) genClaims.push(q);
    for (const p of c.props || []) genProps.push(p);
  }
}
console.log(
  `generator: ${genClaims.length} claims, ${genProps.length} props over ` +
  `cx ${R.cx[0]}..${R.cx[1]} × cz ${R.cz[0]}..${R.cz[1]} at seed ${SEED}`
);

/**
 * THE REGISTRY DUMP, and it is sorted rather than emission-ordered.
 *
 * The claim this exists to test is *the set of claims is unchanged*, not *the
 * order of the array is unchanged*. Sorting removes an ordering difference
 * that would read as a content difference, and the coordinates are printed at
 * full precision because a rounded dump can only prove a rounded equality.
 */
if (args.has('claims')) {
  const lines = genClaims
    .map((q) => JSON.stringify([q.kind, q.owner, q.x0, q.z0, q.x1, q.z1, q.y0, q.y1]))
    .sort();
  await writeFile(args.get('claims'), `${lines.join('\n')}\n`, 'utf8');
  console.log(`wrote ${lines.length} sorted claim lines to ${args.get('claims')}`);
}

/** The generator's own conflict sweep, for the half `citycheck` calls clean. */
const genConflicts = findConflicts(genClaims, 200);
console.log(`generator registry: ${genConflicts.length} forbidden overlaps`);

if (args.has('claims') && args.has('nobrowser')) process.exit(0);
if (args.has('nobrowser')) process.exit(0);

/* ---------------------------------------------------------------- delivered */

const server = await startServer(Number(args.get('port') || 5203));
const browser = await launchBrowser();
const { page } = await openPage(browser, { viewport: { width: 960, height: 540 } });

let occupancy = null;
try {
  const url = new URL(server.url);
  for (const [k, v] of Object.entries(BUDGET.capture.params)) url.searchParams.set(k, String(v));
  await page.goto(url.toString(), { waitUntil: 'load', timeout: 90_000 });
  await page.waitForFunction(() => window.__NOCTIS_HARNESS__, null, { timeout: 60_000 });
  console.log(`GPU: ${await readRendererString(page)}`);
  await page.evaluate(() => window.__NOCTIS_HARNESS__.ready);
  await page.evaluate(() => window.__NOCTIS_HARNESS__.takeOver());
  const streamed = await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity());
  console.log(`streamed: ${JSON.stringify(streamed)}`);
  occupancy = await page.evaluate(() => window.__NOCTIS_HARNESS__.occupancyCensus());
  await page.evaluate(() => window.__NOCTIS_HARNESS__.release());
} finally {
  await browser.close();
  server.child.kill('SIGKILL');
}

const delivered = findConflicts(occupancy.claims, 200);
console.log(`delivered census: ${occupancy.total} claims, ${delivered.length} forbidden overlaps`);

const byPair = {};
for (const c of delivered) {
  const k = [c.a.kind, c.b.kind].sort().join(' × ');
  byPair[k] = (byPair[k] || 0) + 1;
}
for (const [k, v] of Object.entries(byPair).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(24)} ${v}`);
}

/* ------------------------------------------------------------------ the pair */

const fmt = (n) => (n >= 0 ? ' ' : '') + n.toFixed(3);
const half = (b) => [(b.x1 - b.x0) / 2, (b.z1 - b.z0) / 2];
const centre = (b) => [(b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2];

/** Every generator claim that is a prop, so a delivered prop can find its own. */
const genProp = genClaims.filter((q) => q.kind === 'prop');

/**
 * The generator's claim for a delivered prop, matched by OWNER and then by
 * nearest centre. Matching on the centre alone would pair a bench with the bin
 * beside it whenever the two are within a metre, which on a 3.2 m kerb spacing
 * they can be; matching on the owner alone is ambiguous by construction.
 */
function matchGen(box) {
  const [cx, cz] = centre(box);
  let best = null;
  let bestD = Infinity;
  for (const q of genProp) {
    if (q.owner !== box.owner) continue;
    const [qx, qz] = centre(q);
    const d = (qx - cx) ** 2 + (qz - cz) ** 2;
    if (d < bestD) { bestD = d; best = q; }
  }
  return { claim: best, distM: Math.sqrt(bestD) };
}

/** Same, for the prop RECORD, which carries the yaw the claim cannot. */
function matchRecord(box) {
  const [cx, cz] = centre(box);
  let best = null;
  let bestD = Infinity;
  for (const p of genProps) {
    if (p.kind !== box.owner) continue;
    const d = (p.x - cx) ** 2 + (p.z - cz) ** 2;
    if (d < bestD) { bestD = d; best = p; }
  }
  return { rec: best, distM: Math.sqrt(bestD) };
}

const offenders = delivered.filter(
  (c) => (c.a.kind === 'prop' && c.b.kind === 'carriageway')
    || (c.b.kind === 'prop' && c.a.kind === 'carriageway')
);

console.log(`\nprop × carriageway: ${offenders.length} of ${delivered.length}`);

const kinds = {};
for (const c of offenders) {
  const p = c.a.kind === 'prop' ? c.a : c.b;
  kinds[p.owner] = (kinds[p.owner] || 0) + 1;
}
console.log(`  by prop kind: ${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(', ')}`);

for (const c of offenders.slice(0, LIMIT)) {
  const p = c.a.kind === 'prop' ? c.a : c.b;
  const road = c.a.kind === 'prop' ? c.b : c.a;
  const g = matchGen(p);
  const r = matchRecord(p);
  const [dhx, dhz] = half(p);
  const [dcx, dcz] = centre(p);
  console.log(`\n  ${p.owner}  overlap ${c.areaM2} m² with ${road.kind} (${road.owner})`);
  if (!g.claim) { console.log('    no generator claim of the same owner anywhere'); continue; }
  const [ghx, ghz] = half(g.claim);
  const [gcx, gcz] = centre(g.claim);
  console.log(`    claimed    centre (${fmt(gcx)}, ${fmt(gcz)})   half (x ${fmt(ghx)}, z ${fmt(ghz)})` +
    `   y ${fmt(g.claim.y0)}..${fmt(g.claim.y1)}`);
  console.log(`    delivered  centre (${fmt(dcx)}, ${fmt(dcz)})   half (x ${fmt(dhx)}, z ${fmt(dhz)})` +
    `   y ${fmt(p.y0)}..${fmt(p.y1)}`);
  console.log(`    Δcentre    ${(Math.hypot(gcx - dcx, gcz - dcz)).toFixed(4)} m` +
    `    Δhalf      (x ${fmt(dhx - ghx)}, z ${fmt(dhz - ghz)})`);
  console.log(`    transposed (x ${fmt(dhx - ghz)}, z ${fmt(dhz - ghx)})` +
    `   ← claimed half SWAPPED against delivered`);
  if (r.rec) {
    console.log(`    record     yawDeg ${r.rec.yawDeg.toFixed(3)}  refDeg ${r.rec.refDeg.toFixed(3)}` +
      `  kerb ${r.rec.kerb}  variant ${r.rec.variant}  scale ${r.rec.scale.toFixed(3)}` +
      `  lean ${r.rec.lean.toFixed(3)} @ ${r.rec.leanAzDeg.toFixed(1)}°` +
      `  (matched ${r.distM.toFixed(4)} m away)`);
  }
  console.log(`    road       x ${fmt(road.x0)}..${fmt(road.x1)}   z ${fmt(road.z0)}..${fmt(road.z1)}`);
}
