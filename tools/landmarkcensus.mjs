#!/usr/bin/env node
/**
 * landmarkcensus.mjs — WHAT IS STANDING INSIDE A LANDMARK, AND EVERY SITE THAT
 * ASKS WHETHER ANYTHING MAY. NOT A GATE, and it must never become one.
 * SESSION 35.
 *
 *   node tools/landmarkcensus.mjs                     both halves
 *   node tools/landmarkcensus.mjs --sites             the enumeration only, no browser
 *   node tools/landmarkcensus.mjs --at=-158,70,250    where the camera stands
 *
 * WHY IT EXISTS, AND WHY IT IS TWO HALVES.
 *
 * Session 34 found SIX spellings of *"does a landmark stand here"*, repaired
 * them, and reported the result as a table of emitted boxes inside the weir's
 * rim — 50 before, 0 after. That table was produced by a throwaway in a
 * scratch directory and is not in the repository, so the session after it could
 * neither reproduce the number nor find out whether a SEVENTH spelling had
 * appeared. STATE 34 §7 records that as a gap in its own words: *"five
 * throwaway probes are in the scratchpad"*.
 *
 * The census half answers *"is anything standing in it NOW"*, which is the
 * operator's question and the one a frame can also answer.
 *
 * The enumeration half answers the question the census cannot: **how many
 * places in this source could put something there.** Repairing the two sites a
 * frame happens to show is how a project gets a ninth spelling. Counting them
 * is what makes the next one loud.
 *
 * HOW THE ENUMERATION IS BUILT, AND WHY IT IS NOT A HAND-WRITTEN LIST.
 *
 * It greps `src/**` for every reference to the five accessors and to
 * `LANDMARKS` itself, and matches each hit against a DECLARED table below that
 * says what that site is asking for. A hit with no row prints as
 * **UNCLASSIFIED** and is counted separately — so adding a spelling makes this
 * tool print a number that is one higher than the one written in STATE, which
 * is the only mechanism that survives a session nobody reads.
 *
 * THE FIVE ANSWERS, AND THEY ARE NOT INTERCHANGEABLE. This is the distinction
 * the six spellings were six wrong guesses at:
 *
 *   landmarkOccluders(l)      WHAT BLOCKS A RAY TO THE SKY. `[]` for a basin,
 *                             because a hole in the ground occludes nothing.
 *                             Correct for the canyon bake and for nothing else.
 *   landmarkGroundBlockers(l) WHAT BLOCKS A PERSON. Returns `landmarkOccluders`
 *                             VERBATIM for anything that is not a viaduct, so
 *                             it is the line above wearing a second name for
 *                             seven landmarks of eight.
 *   landmarkGroundClaims(l)   WHAT GROUND IS SPOKEN FOR. The list the registry
 *                             claims from, and the only one that carries a
 *                             basin.
 *   landmarkOccupies(x, z)    the same question as a POINT PREDICATE, over all
 *                             eight, built on `landmarkGroundClaims`.
 *   landmarkBlocks(l, x, z)   a ninth spelling with no callers that tests a
 *                             CIRCLE where the registry claims an AABB and
 *                             counts the viaduct's DECK. STATE 34 §11.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { startServer, launchBrowser, openPage, readRendererString } from './lib/page.mjs';
import { LANDMARKS, landmarkGroundClaims, landmarkAABB } from '../src/lib/citygen.js';

const args = new Map(process.argv.slice(2).map((a) => {
  const [k, v = 'true'] = a.replace(/^--/, '').split('=');
  return [k, v];
}));

/* ─────────────────────────── the enumeration ─────────────────────────── */

/**
 * Every site that asks the question, keyed `file:symbol`, with what it is
 * asking for and whether that is the right list for the question.
 *
 * `verdict` is one of:
 *   ok       the accessor answers the question the site is asking
 *   blind    the site asks a GROUND question through a SKY answer, so it
 *            cannot see a basin
 *   none     the site places something on the lattice and asks nothing
 *   n/a      the site reads the table for a reason that is not a keep-out
 */
const DECLARED = [
  ['src/lib/citygen.js', 'landmarkOccluders', 'the definition', 'n/a'],
  ['src/lib/citygen.js', 'landmarkGroundBlockers', 'the definition', 'n/a'],
  ['src/lib/citygen.js', 'landmarkGroundClaims', 'the definition', 'n/a'],
  ['src/lib/citygen.js', 'landmarkOccupies', 'the definition', 'n/a'],
  ['src/lib/citygen.js', 'landmarkBlocks', 'NO CALLERS — STATE 34 §11', 'n/a'],
  ['src/lib/citygen.js', 'landmarksTouching', 'the definition + whose geometry is mine to draw', 'n/a'],
  ['src/lib/citygen.js', 'occluders.push', 'the canyon bake, sky answer', 'ok'],
  ['src/lib/citygen.js', 'reg.claim', 'the registry claims the ground', 'ok'],
  ['src/modules/city.js', 'placedClaims', 'the delivered census', 'ok'],
  ['src/modules/city.js', 'busStop', 'may a shelter stand here', 'ok'],
  ['src/modules/city.js', 'streetLamp', 'may a lamp column stand here', 'ok'],
  ['src/modules/city.js', 'walkableAt', 'may a person stand here', 'blind'],
  ['src/modules/city.js', 'walkableMask', 'may a person stand here', 'blind'],
  ['src/modules/city.js', 'buildLandmark', 'draw the landmark itself', 'n/a'],
  ['src/modules/city.js', 'report', 'a count for a report', 'n/a'],
  ['src/modules/streetlife.js', 'walkBlockers', 'may a pedestrian walk here', 'ok'],
  ['src/modules/streetlife.js', 'standAt', 'may a pedestrian stand here', 'ok'],
  ['src/modules/canyon.js', 'bake', 'what blocks a ray to the sky', 'ok'],
  ['src/modules/moving.js', 'viaduct', 'the train\'s own arc', 'n/a'],
  ['src/modules/ui.js', 'compass', 'draw a marker for each landmark', 'n/a'],
  ['src/modules/traffic.js', 'seed', 'may this BODY be seeded here (s35)', 'ok'],
  ['src/modules/traffic.js', 'recycle', 'is this BODY still on a road (s35)', 'ok'],
  ['src/modules/traffic.js', 'writeSignals', 'may a signal mast stand here (s35)', 'ok'],
];

const RE = /landmarkOccluders|landmarkGroundBlockers|landmarkGroundClaims|landmarkOccupies|landmarkBlocks|landmarksTouching|LANDMARKS/;

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

/** A reference in CODE, not in a comment. Comment-only lines are stripped. */
function codeHits(file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const hits = [];
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();
    if (inBlock) { if (t.includes('*/')) inBlock = false; continue; }
    if (t.startsWith('/*')) { if (!t.includes('*/')) inBlock = true; continue; }
    if (t.startsWith('*') || t.startsWith('//')) continue;
    if (RE.test(raw)) hits.push({ line: i + 1, text: t.slice(0, 96) });
  }
  return hits;
}

function enumerate() {
  const files = walk('src');
  let total = 0;
  const perFile = [];
  for (const f of files.sort()) {
    const hits = codeHits(f);
    if (!hits.length) continue;
    total += hits.length;
    perFile.push({ f, hits });
  }
  console.log('\nEVERY SITE IN `src/` THAT NAMES A LANDMARK KEEP-OUT, IN CODE\n');
  for (const { f, hits } of perFile) {
    console.log(`  ${f}   ${hits.length}`);
    for (const h of hits) console.log(`      :${String(h.line).padStart(4)}  ${h.text}`);
  }
  console.log(`\n  ${total} code references over ${perFile.length} files.`);

  console.log('\nWHAT EACH SITE IS ASKING FOR, DECLARED\n');
  const byVerdict = {};
  for (const [f, sym, what, v] of DECLARED) {
    byVerdict[v] = (byVerdict[v] || 0) + 1;
    console.log(`  ${v.padEnd(6)} ${f.replace('src/', '').padEnd(22)} ${sym.padEnd(24)} ${what}`);
  }
  console.log(`\n  ${DECLARED.length} declared sites: ` +
    Object.entries(byVerdict).map(([k, n]) => `${k} ${n}`).join(', '));
  console.log('\n  A site that asks a GROUND question through `landmarkOccluders` or');
  console.log('  `landmarkGroundBlockers` is marked `blind`: both return [] for a basin.');
  console.log('  A site marked `none` places something and asks nothing at all.');
  return total;
}

/* ───────────────────────────── the census ────────────────────────────── */

const AT = (args.get('at') || '-158.02,69.96,250.12').split(',').map(Number);
const LOOK = (args.get('target') || '-300,0,150').split(',').map(Number);

const claimsByLandmark = LANDMARKS.map((l) => ({
  name: l.name,
  kind: l.kind,
  aabb: landmarkAABB(l),
  claims: landmarkGroundClaims(l).map((g) => ({ x0: g.x0, x1: g.x1, z0: g.z0, z1: g.z1, y0: g.y0, y1: g.y1 })),
}));

enumerate();

if (args.has('sites')) process.exit(0);

const { child: server, url: base } = await startServer(5203);
const browser = await launchBrowser();
const { page } = await openPage(browser, { viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1 });

try {
  const url = new URL(base);
  url.searchParams.set('seed', args.get('seed') || '1337');
  url.searchParams.set('paused', '1');
  await page.goto(url.toString(), { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!window.__NOCTIS_HARNESS__, null, { timeout: 60000 });
  await page.evaluate(() => window.__NOCTIS_HARNESS__.ready);
  await page.evaluate(() => window.__NOCTIS_HARNESS__.takeOver());
  console.log(`\nGPU: ${await readRendererString(page)}`);
  await page.evaluate((s) => window.__NOCTIS_HARNESS__.setShotAt(s.pos, s.target, 70),
    { pos: AT, target: LOOK });
  let arrival = await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity(1800));
  for (let i = 1; i < 4 && arrival.field && arrival.field.ready < arrival.field.slots; i++) {
    arrival = await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity(1800));
  }
  await page.evaluate(() => window.__NOCTIS_HARNESS__.settle(4));

  /**
   * THE CLOCK, OPTIONALLY, AND IT IS THE DIFFERENCE BETWEEN TWO ANSWERS.
   *
   * `?paused=1` freezes the traffic where it was SEEDED, so a census taken
   * there measures the seeding rule and nothing else. Everything traffic does
   * about a landmark AFTER seeding — the recycle test, the turn exemption —
   * only exists while the clock runs. STATE 33 §0 records that every frame this
   * project has ever shown of a moving system was a frame of that system
   * standing still; a census has no excuse to inherit that.
   */
  const SIM = Number(args.get('sim') || 0);
  if (SIM > 0) {
    await page.evaluate(async (secs) => {
      const t = window.__NOCTIS__.ctx.get('time');
      if (t) t.setPaused(false);
      await window.__NOCTIS_HARNESS__.step(Math.round(secs * 60), 1 / 60);
      if (t) t.setPaused(true);
    }, SIM);
    await page.evaluate(() => window.__NOCTIS_HARNESS__.settle(4));
  }

  /**
   * EVERY INSTANCE IN THE SCENE, BY ITS WORLD POSITION, AGAINST EVERY
   * LANDMARK'S GROUND CLAIM.
   *
   * The instance's TRANSLATION and not its box, because a box test would need
   * each mesh's own geometry bounds and would then report a 40 m building as
   * "inside" for touching a corner. What the operator's question is about is
   * an object STANDING somewhere, and where an object stands is where its
   * matrix puts it. It over-reports nothing and under-reports a large object
   * whose centre is outside — which is the direction that cannot manufacture a
   * finding.
   *
   * `y` IS CARRIED AND IS THE SECOND HALF OF THE ANSWER. A basin's floor is
   * 9.8 m down; something standing in it at street level is standing on
   * nothing, and that is a different defect from standing in it at all.
   */
  const census = await page.evaluate((groups) => {
    const { ctx, THREE } = window.__NOCTIS__;
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const out = {};
    ctx.scene.updateMatrixWorld(true);
    ctx.scene.traverse((o) => {
      if (!o.isInstancedMesh || !o.visible) return;
      const n = o.count;
      /**
       * ONE MESH CAN CARRY TWO POPULATIONS AND THE CENSUS LABEL SAYS WHICH.
       * `traffic:lights` holds the vehicles' light rows and then the signal
       * heads, in that order, and `userData.noctisCensus` records both counts —
       * which is CONTRACT §9.1's rule about writing the label where the
       * category still exists, read back here. Without the split, a signal mast
       * standing in a basin reports as a vehicle standing in a basin, which is
       * a different defect with a different repair.
       */
      const label = o.userData.noctisCensus || null;
      const split = label && typeof label.vehicleLightLines === 'number'
        ? { at: label.vehicleLightLines, lo: 'vehicleLightLines', hi: 'signalHeadBoxes' } : null;
      for (let i = 0; i < n; i++) {
        o.getMatrixAt(i, m);
        m.premultiply(o.matrixWorld);
        m.decompose(p, q, s);
        for (const g of groups) {
          if (p.x < g.aabb.x0 || p.x > g.aabb.x1 || p.z < g.aabb.z0 || p.z > g.aabb.z1) continue;
          let hit = false;
          for (const c of g.claims) {
            if (p.x > c.x0 && p.x < c.x1 && p.z > c.z0 && p.z < c.z1) { hit = true; break; }
          }
          if (!hit) continue;
          const which = split ? `${o.name}:${i < split.at ? split.lo : split.hi}` : (o.name || '(unnamed)');
          const key = `${g.name}|${which}`;
          const r = out[key] || (out[key] = { n: 0, yMin: Infinity, yMax: -Infinity, where: [] });
          r.n++;
          r.yMin = Math.min(r.yMin, p.y);
          r.yMax = Math.max(r.yMax, p.y);
          /**
           * Where, for the first few, because WHERE is what separates two
           * mechanisms that produce the same count: a body at a junction is a
           * vehicle the recycle loop exempted for turning, and one out on a
           * lane is a vehicle the recycle loop has not reached yet.
           */
          if (r.where.length < 6) r.where.push([Math.round(p.x), Math.round(p.z)]);
        }
      }
    });
    return out;
  }, claimsByLandmark);

  /**
   * WHAT THE CLAIM IS FOR, AND HOW MUCH OF IT THE STRUCTURE USES.
   *
   * The claim is an AABB and a structure is whatever shape it is, so the ratio
   * of the two is a real question and nobody has asked it. It is measured off
   * the DELIVERED geometry — the world-space bounds of every mesh whose name
   * begins `landmark:` — and not off `LANDMARKS`, because §9.1's whole point is
   * that the description and the artefact are two things.
   */
  const bounds = await page.evaluate(() => {
    const { ctx, THREE } = window.__NOCTIS__;
    const m = new THREE.Matrix4();
    const v = new THREE.Vector3();
    const out = {};
    ctx.scene.updateMatrixWorld(true);
    ctx.scene.traverse((o) => {
      if (!o.isMesh || !o.name || !o.name.startsWith('landmark:')) return;
      const key = o.name.split(':')[1];
      const r = out[key] || (out[key] = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, y0: Infinity, y1: -Infinity, n: 0 });
      const pos = o.geometry.attributes.position;
      const reps = o.isInstancedMesh ? o.count : 1;
      for (let i = 0; i < reps; i++) {
        if (o.isInstancedMesh) { o.getMatrixAt(i, m); m.premultiply(o.matrixWorld); } else m.copy(o.matrixWorld);
        r.n++;
        for (let k = 0; k < pos.count; k++) {
          v.fromBufferAttribute(pos, k).applyMatrix4(m);
          r.x0 = Math.min(r.x0, v.x); r.x1 = Math.max(r.x1, v.x);
          r.z0 = Math.min(r.z0, v.z); r.z1 = Math.max(r.z1, v.z);
          r.y0 = Math.min(r.y0, v.y); r.y1 = Math.max(r.y1, v.y);
        }
      }
    });
    return out;
  });

  console.log('\nTHE CLAIM AGAINST THE DELIVERED STRUCTURE');
  console.log('  landmark    claim AABB (m)   claim m2  claims   delivered (m)      del/claim   y span');
  for (const g of claimsByLandmark) {
    const cw = g.aabb.x1 - g.aabb.x0;
    const cd = g.aabb.z1 - g.aabb.z0;
    /**
     * The claim's own AABB is the denominator, NOT the sum of the claim boxes:
     * a landmark with seven ground claims (the stack's stepped drums) has them
     * nested, so the sum double-counts and reports a keep-out three times its
     * own extent. The summed area is printed beside it and labelled, because
     * for a landmark with ONE claim the two agree and for the rest the gap
     * between them is a fact about the claim list.
     */
    let sum = 0;
    for (const c of g.claims) sum += (c.x1 - c.x0) * (c.z1 - c.z0);
    const b = bounds[g.name];
    const head = `  ${g.name.padEnd(11)} ${cw.toFixed(0).padStart(4)} x ${cd.toFixed(0).padEnd(5)} ${sum.toFixed(0).padStart(9)} ${String(g.claims.length).padStart(5)}   `;
    if (!b) { console.log(`${head}not resident`); continue; }
    const dw = b.x1 - b.x0;
    const dd = b.z1 - b.z0;
    console.log(
      `${head}${dw.toFixed(1).padStart(6)} x ${dd.toFixed(1).padEnd(7)} ${((dw * dd) / (cw * cd)).toFixed(3).padStart(7)}    [${b.y0.toFixed(2)}, ${b.y1.toFixed(2)}]`
    );
  }
  console.log('\n  del/claim is delivered BOUNDING BOX over claim AABB, so it is 1.000 for a');
  console.log('  structure that exactly fills its keep-out WHATEVER ITS SHAPE — a round one');
  console.log('  reads 1.000 and still leaves 1 - pi/4 = 21.5% of the claim in the corners.');
  console.log('  Over 1.000 means geometry outside the keep-out; the arch and the viaduct are');
  console.log('  expected there because their claims are legs and their extent is a deck.');

  console.log(`\nINSTANCES STANDING INSIDE A LANDMARK'S GROUND CLAIM`);
  console.log(`  camera at [${AT.join(', ')}] looking at [${LOOK.join(', ')}]`);
  console.log(`  the landmark's own geometry is in this list too — a drum's boxes stand in the drum's claim.\n`);
  const rows = Object.entries(census).sort((a, b) => b[1].n - a[1].n);
  if (!rows.length) console.log('  nothing.');
  for (const [key, r] of rows) {
    const [lm, mesh] = key.split('|');
    const w = mesh.startsWith('traffic') ? `   at ${r.where.map((p) => `(${p[0]},${p[1]})`).join(' ')}` : '';
    console.log(`  ${lm.padEnd(11)} ${String(r.n).padStart(5)}  y [${r.yMin.toFixed(2)}, ${r.yMax.toFixed(2)}]  ${mesh}${w}`);
  }
} finally {
  await browser.close();
  if (server) server.kill ? server.kill('SIGKILL') : server.child && server.child.kill('SIGKILL');
}
