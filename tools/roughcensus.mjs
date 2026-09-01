#!/usr/bin/env node
/**
 * roughcensus.mjs — WHAT EVERY SURFACE IN THIS WORLD CLAIMS ABOUT WATER.
 * NOT A GATE, and it must never become one. SESSION 65.
 *
 *   node tools/roughcensus.mjs                    both halves
 *   node tools/roughcensus.mjs --sites            the enumeration only, no browser
 *   node tools/roughcensus.mjs --at=3260,180,0    where the camera stands first
 *   node tools/roughcensus.mjs --all              every mesh, not only the ground ones
 *
 * ════════════════════════════════════════════════════════════════════════════
 * WHY IT EXISTS: THE SAME DEFECT HAS NOW BEEN FOUND TWICE, ONE SURFACE APART.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `lights.js` → `noctisRough` is a **vec2**. `.x` is a roughness override and
 * `.y` is the POROSITY every wet term reads, and its own comment says the safe
 * default is zero *"twice over"*: a geometry with NO attribute reads the
 * generic `(0,0)`, and a geometry carrying the one-component `float` every mesh
 * in this project carried before session 55 reads `(x,0)`. **Both give
 * porosity 0, and porosity 0 is IMPERVIOUS** — `sheen = 1 - porosity` goes to
 * 1, the pond term is unattenuated and the surface is a mirror at `wet = 1`.
 *
 * That default is right for tarmac and silent everywhere else, and silence is
 * how it gets found by looking:
 *
 *   session 64  `block:ground` had never carried the attribute. It did not
 *               matter until session 63 made that plane the visible
 *               countryside, and then the first `--wet=1` frame came back with
 *               farmland reflecting the sky like a lake.
 *   session 65  the 8 km exit-road ribbon `block:road:main` had never carried
 *               it either. ONE SURFACE AWAY, the same omission, the next
 *               session, found the same way — by an operator looking at a
 *               frame and saying the road was polished water.
 *
 * **ONE CENSUS BEATS FOUR SESSIONS OF FINDING THESE ONE FRAME AT A TIME**, and
 * that sentence is the brief's, not this file's. So this asks the question of
 * every mesh at once, and it asks it of the DELIVERED BUFFER rather than of the
 * code that filled it — CONTRACT §9 rule 2. A porosity the generator chose and
 * the attribute does not carry is precisely the disagreement being looked for,
 * so no table is consulted for half B.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IT IS TWO HALVES, FOR `landmarkcensus.mjs`'s REASON.
 *
 * The census half answers *"what does the scene deliver NOW"*, which is the
 * operator's question and the one a frame can also answer.
 *
 * The enumeration half answers the one the census cannot: **how many places in
 * this source could put an unwatered surface in the world.** Repairing the two
 * a frame happens to show is how a project gets a third. It greps `src/**` for
 * every mesh-producing site and matches each against the DECLARED table below;
 * a site with no row prints as **UNCLASSIFIED** and is counted separately, so
 * adding a mesh makes this tool print a number one higher than the one in
 * STATE, which is the only mechanism that survives a session nobody reads.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT AN `itemSize` OF 0, 1 AND 2 EACH MEAN, BECAUSE THE THREE ARE NOT ONE
 * FINDING:
 *
 *   0   no attribute at all. The mesh reads the generic vertex default and has
 *       never expressed an opinion about water. `block:road:main` was this.
 *   1   the pre-session-55 float. It expresses a ROUGHNESS and its `.y` is the
 *       generic default, so it is impervious for a second reason. Every
 *       instanced prop and feature in this project is this, by construction:
 *       `city.js` → `addInstanced` writes a 1-component attribute.
 *   2   the mesh chose a porosity, and the histogram says which.
 *
 * A `2` is not automatically right and a `0` is not automatically wrong — a
 * kerb, a wall and a car are all correctly impervious. What the census
 * establishes is which surfaces have never been ASKED, and how much of the
 * world they are.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { startServer, launchBrowser, openPage, readRendererString, ROOT } from './lib/page.mjs';
import { CITY, TERRAIN } from '../src/lib/citygen.js';

const args = new Map(process.argv.slice(2).map((a) => {
  const s = a.replace(/^--/, '');
  const i = s.indexOf('=');
  return i < 0 ? [s, 'true'] : [s.slice(0, i), s.slice(i + 1)];
}));

const num = (s) => s.split(',').map(Number);
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

/* ─────────────────────────── the enumeration ─────────────────────────── */

/**
 * Every site in `src/**` that constructs a mesh, keyed `file:construct`, with
 * what surface it makes and what it does about porosity.
 *
 * `verdict` is one of:
 *   chosen     the site writes a 2-component `noctisRough` and the `.y` is a
 *              decision somebody made and can be read
 *   float      the site writes the 1-component attribute — a roughness, and an
 *              implicit porosity of 0 that nobody chose
 *   absent     the site writes no `noctisRough` at all
 *   n/a        the mesh is not lit by `lights.js`'s injected surface code, so
 *              the attribute would do nothing (the sky dome, the fullscreen
 *              triangle, the instrument's own controls)
 *
 * `water` is the JUDGEMENT, written down so it can be disagreed with rather
 * than left implicit in whether a repair happened. It says what an impervious
 * default MEANS for that surface:
 *
 *   wrong   the surface is one rain lands on and cannot hold on top, so the
 *           default makes it a mirror it should not be
 *   right   the surface really is sealed — a kerb, a pavement, a city
 *           carriageway — and the default is the correct answer that nobody
 *           happened to write down
 *   moot    the material is not lit through the wet terms at all
 *
 * A `right` is not a licence to leave it absent forever: `block:ground` was a
 * `right` for sixty-two sessions, under the city, and became a `wrong` the
 * session the countryside was drawn on it. What the column records is which
 * surfaces would change if the default changed, not which ones are finished.
 */
const DECLARED = [
  // ── the ground, and it is the whole of the argument ────────────────────
  ['src/modules/block.js', 'matGround', 'block:ground — terrain, crops, hills, skirt', 'chosen', 'wrong', '^block:ground$'],
  ['src/modules/city.js', 'materials.ground', 'the streamed chunk ground', 'chosen', 'wrong', '^city:ground$'],
  ['src/modules/block.js', 'matAsphalt', 'block:road:main — the 8 km exit-road ribbon', 'chosen', 'wrong', '^block:road:main$'],
  ['src/modules/block.js', 'matAsphaltWorn', 'block:road:cross — city asphalt, inside the block', 'absent', 'right', '^block:road:cross$'],
  ['src/modules/block.js', 'matPavement', "the origin block's footways — cast paving", 'absent', 'right'],
  ['src/modules/block.js', 'matKerb', "the origin block's kerbs — cast concrete", 'absent', 'right'],
  ['src/modules/block.js', 'matCore', "the block's core — asphalt over concrete", 'absent', 'right'],
  ['src/modules/river.js', 'materials.water', 'the river — NOCTIS_WATER overwrites both terms', 'n/a', 'moot'],
  ['src/modules/city.js', 'landmark:.*:pool', "a landmark's ornamental pool — the same water path", 'n/a', 'moot'],

  // ── things standing on it ──────────────────────────────────────────────
  ['src/modules/city.js', 'g, mat, matrices', 'every streamed prop, feature and building box', 'float', 'right'],
  ['src/modules/block.js', 'InstancedMesh', "the origin block's own instanced boxes", 'float', 'right'],
  ['src/modules/city.js', 'materials.distant', 'the distant box field', 'float', 'right'],
  ['src/modules/city.js', 'materials.facade', 'the facade shells', 'absent', 'right'],
  ['src/modules/river.js', 'InstancedMesh', "the river's quay and bank boxes", 'float', 'right'],
  ['src/modules/streetlife.js', 'materials.pedestrian', 'the pedestrians — 16 of 16 attribute slots', 'n/a', 'moot'],
  ['src/modules/streetlife.js', 'materials.stallBody', 'the street stalls', 'float', 'right'],
  ['src/modules/streetlife.js', 'materials.stallGlow', "the stalls' emissive panes", 'n/a', 'moot'],
  ['src/modules/traffic.js', 'InstancedMesh', 'the vehicles, their glazing and their wheels', 'float', 'right'],
  ['src/modules/moving.js', 'InstancedMesh', 'the trains and the crane jibs', 'float', 'right'],
  ['src/modules/aircraft.js', 'InstancedMesh', 'the airframes and their navigation lamps', 'float', 'right'],
  ['src/modules/weather.js', 'InstancedMesh', 'the three rain particle layers', 'n/a', 'moot'],
  ['src/modules/block.js', 'matMetal', "the block's lamp columns and arms", 'absent', 'right'],
  ['src/modules/block.js', 'lampMaterial', 'the lamp bowls', 'n/a', 'moot'],
  ['src/modules/block.js', 'plateMat', "the block's sign plates", 'absent', 'right'],
  ['src/modules/block.js', 'tubeMat', "the block's neon tubes", 'n/a', 'moot'],
  ['src/modules/block.js', 'glow', "the block's emissive panes", 'n/a', 'moot'],

  // ── not surfaces ───────────────────────────────────────────────────────
  ['src/modules/sky.js', 'bgMaterial', 'the sky dome', 'n/a', 'moot'],
  ['src/core/fullscreen.js', 'geometry, null', 'the one triangle every post pass draws', 'n/a', 'moot'],
  ['src/modules/harness.js', 'mat()', "windcheck's four winding controls, §8's one exception", 'n/a', 'moot'],
  ['src/modules/harness.js', 'BoxGeometry', "motioncheck's scripted probe box", 'n/a', 'moot'],
];

const MESH_RE = /new THREE\.(?:Instanced)?Mesh\(/g;

async function walk(dir, out = []) {
  for (const e of await readdir(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue;
    const p = path.join(dir, e);
    const s = await stat(p);
    if (s.isDirectory()) await walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

async function enumerateSites() {
  const files = await walk(path.join(ROOT, 'src'));
  files.sort();
  const hits = [];
  for (const abs of files) {
    const rel = path.relative(ROOT, abs);
    const src = await readFile(abs, 'utf8');
    const lines = src.split('\n');
    MESH_RE.lastIndex = 0;
    let m;
    while ((m = MESH_RE.exec(src))) {
      const line = src.slice(0, m.index).split('\n').length;
      /**
       * THE WINDOW IS SIX LINES AND NOT THE MATCH, AND THE FIRST ARM WAS THE
       * MATCH. `new THREE.Mesh\(\s*([^)]*)` stops at the first `)`, which for
       * `new THREE.Mesh(track(new THREE.PlaneGeometry(w, h)), matAsphaltWorn)`
       * is inside the FIRST argument — so the material, which is the identity
       * of the surface, was never in the captured text and three sites came
       * back UNCLASSIFIED for a reason that had nothing to do with them. The
       * window spans the call however it is wrapped, plus the two lines after
       * it where `.name =` is set.
       */
      const win = lines.slice(Math.max(0, line - 2), line + 5).join(' ').replace(/\s+/g, ' ');
      /**
       * LONGEST SYMBOL FIRST, because `matAsphalt` is a prefix of
       * `matAsphaltWorn` and a first-match would file the country road and the
       * block's cross street under one row — two surfaces, one description,
       * which is the shape this whole file is about.
       */
      const decl = DECLARED
        .filter(([f, sym]) => f === rel && new RegExp(sym).test(win))
        .sort((a, b) => b[1].length - a[1].length)[0];
      hits.push({ rel, line, win: win.slice(0, 78), decl: decl || null });
    }
  }
  return hits;
}

/* ──────────────────────────────── output ─────────────────────────────── */

function printSites(hits) {
  console.log('\n  ── THE ENUMERATION: EVERY MESH THIS SOURCE CONSTRUCTS ─────────────────\n');
  const byDecl = new Map();
  for (const h of hits) {
    const key = h.decl ? `${h.decl[0]}|${h.decl[1]}` : `UNCLASSIFIED|${h.rel}:${h.line}`;
    if (!byDecl.has(key)) byDecl.set(key, { decl: h.decl, sites: [] });
    byDecl.get(key).sites.push(`${h.rel}:${h.line}`);
  }
  const order = { absent: 0, float: 1, chosen: 2, 'n/a': 3 };
  const rows = [...byDecl.values()].sort((a, b) => {
    const va = a.decl ? order[a.decl[3]] : -1;
    const vb = b.decl ? order[b.decl[3]] : -1;
    if (va !== vb) return va - vb;
    return (a.decl ? a.decl[2] : '').localeCompare(b.decl ? b.decl[2] : '');
  });
  console.log(`  ${pad('what it draws', 52)} ${pad('noctisRough', 10)} ${pad('water?', 7)} sites`);
  console.log(`  ${'─'.repeat(52)} ${'─'.repeat(10)} ${'─'.repeat(7)} ${'─'.repeat(5)}`);
  let unclassified = 0;
  let wrong = 0;
  for (const r of rows) {
    if (!r.decl) {
      unclassified++;
      console.log(`  ${pad('** UNCLASSIFIED **', 52)} ${pad('?', 10)} ${pad('?', 7)} ${r.sites.join(' ')}`);
      continue;
    }
    const [, , what, verdict, water] = r.decl;
    const bad = water === 'wrong' && verdict !== 'chosen';
    if (bad) wrong++;
    console.log(
      `  ${pad(what, 52)} ${pad(verdict, 10)} ${pad(water, 7)} ${r.sites.length}${bad ? '   <<< IMPERVIOUS BY DEFAULT' : ''}`
    );
  }
  console.log(`\n  ${rows.length} distinct surfaces, ${hits.length} construction sites, `
    + `${unclassified} UNCLASSIFIED, ${wrong} where an impervious default is WRONG and no porosity was chosen.`);
  if (unclassified) {
    console.log('  An UNCLASSIFIED row is a mesh nobody has asked this question of. Add it to DECLARED.');
  }
  return { rows: rows.length, sites: hits.length, unclassified, wrong };
}

function printCensus(cen, showAll) {
  console.log('\n  ── THE DELIVERED CENSUS: WHAT IS IN THE SCENE RIGHT NOW ───────────────\n');
  const rows = cen.rows.slice().sort((a, b) => {
    if (a.itemSize !== b.itemSize) return a.itemSize - b.itemSize;
    return b.triangles - a.triangles;
  });
  const shown = showAll ? rows : rows.filter((r) => r.triangles >= 12 || r.itemSize < 2);
  console.log(`  ${pad('mesh', 26)} ${lpad('tris', 9)} ${lpad('size', 4)} ${lpad('reach m', 8)}  porosity`);
  console.log(`  ${'─'.repeat(26)} ${'─'.repeat(9)} ${'─'.repeat(4)} ${'─'.repeat(8)}  ${'─'.repeat(40)}`);
  for (const r of shown) {
    let p;
    if (r.itemSize === 0) p = 'ABSENT — reads the generic (0,0): IMPERVIOUS';
    else if (r.itemSize === 1) p = 'float — .y is the generic 0: IMPERVIOUS';
    else if (!r.porosity) p = '(no vertices)';
    else if (r.porosity.distinct === 1) p = `${r.porosity.min.toFixed(2)} everywhere`;
    else {
      p = `${r.porosity.min.toFixed(2)}..${r.porosity.max.toFixed(2)}  `
        + r.porosity.bins.slice(0, 4).map(([v, n]) => `${v.toFixed(2)}×${n}`).join(' ');
    }
    console.log(
      `  ${pad(r.name.slice(0, 26), 26)} ${lpad(r.triangles.toLocaleString('en-US'), 9)} `
      + `${lpad(r.itemSize, 4)} ${lpad(r.reachM.toFixed(0), 8)}  ${p}`
    );
  }
  if (!showAll && shown.length < rows.length) {
    console.log(`\n  ${rows.length - shown.length} further meshes under 12 triangles with a chosen porosity, hidden. --all shows them.`);
  }

  /**
   * THE ONE NUMBER THIS IS FOR: how much of the surface a camera out here can
   * see has never chosen a porosity. Triangles, not meshes — one mesh is the
   * whole countryside and another is a bollard.
   */
  const country = rows.filter((r) => r.reachM > CITY.extentEdgeM);
  const sum = (rs) => rs.reduce((a, r) => a + r.triangles, 0);
  const blind = country.filter((r) => r.itemSize < 2);
  console.log('\n  ── THE COUNTRYSIDE, WHICH IS WHAT THE OPERATOR IS LOOKING AT ──────────\n');
  console.log('  A TRIANGLE SHARE IS THE WRONG DENOMINATOR AND IS PRINTED ANYWAY. Most of');
  console.log('  what reaches out here is BUILDING and LAMP geometry, correctly impervious,');
  console.log('  and the ribbon that was the whole of session 65 item 1 is 482 triangles of');
  console.log('  the most-looked-at surface in the countryside. The list below is the answer;');
  console.log("  the percentage is context. Half A's `water` column carries the judgement.\n");
  console.log(`  meshes reaching past CITY.extentEdgeM = ${CITY.extentEdgeM} m      ${country.length}`);
  console.log(`  their triangles                                    ${sum(country).toLocaleString('en-US')}`);
  console.log(`  of those, triangles with NO chosen porosity        ${sum(blind).toLocaleString('en-US')}`
    + `  (${((100 * sum(blind)) / Math.max(1, sum(country))).toFixed(1)}%)`);
  for (const r of blind) {
    console.log(`      ${pad(r.name.slice(0, 26), 26)} ${lpad(r.triangles.toLocaleString('en-US'), 9)}  itemSize ${r.itemSize}`);
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * AND THE TWO HALVES ARE CHECKED AGAINST EACH OTHER — CONTRACT §9 rule 2.
   * ═══════════════════════════════════════════════════════════════════════
   *
   * Half A is a hand table and half B is the delivered buffer. A hand table
   * that nothing compares is §9.1's *"a value in config the code does not
   * read"*, and this file would be the second instrument in this project to
   * become the place its own failure mode hides (§7.7). So every DECLARED row
   * that names a delivered mesh has its `verdict` read back off the geometry,
   * and a disagreement is printed rather than resolved: the table is edited to
   * match the world, never the other way round.
   */
  const named = DECLARED.filter((d) => d[5]);
  const seen = [];
  for (const d of named) {
    const re = new RegExp(d[5]);
    const hit = cen.rows.find((r) => re.test(r.name));
    const delivered = !hit ? 'NOT IN SCENE' : hit.itemSize === 0 ? 'absent' : hit.itemSize === 1 ? 'float' : 'chosen';
    seen.push({ what: d[2], declared: d[3], delivered, agree: delivered === d[3] });
  }
  console.log('\n  ── THE TABLE, CHECKED FROM THE OTHER END ──────────────────────────────\n');
  for (const s of seen) {
    console.log(`  ${pad(s.what, 52)} declared ${pad(s.declared, 8)} delivered ${pad(s.delivered, 12)} ${s.agree ? 'ok' : '<<< DISAGREES'}`);
  }
  const bad = seen.filter((s) => !s.agree).length;
  console.log(`\n  ${seen.length} rows crossed, ${bad} disagreement${bad === 1 ? '' : 's'}.`);

  return { country: country.length, blind: blind.length, disagreements: bad };
}

/* ──────────────────────────────── run ────────────────────────────────── */

const hits = await enumerateSites();
printSites(hits);

if (args.has('sites')) process.exit(0);

const AT = args.has('at') ? num(args.get('at')) : [CITY.extentEdgeM + 28, 180, 0];
const LOOK = args.has('look') ? num(args.get('look')) : [TERRAIN.skirtM / 2, 0, 0];

const server = await startServer(5208);
const browser = await launchBrowser();
const { page } = await openPage(browser, { viewport: { width: 800, height: 450 } });
try {
  const url = new URL(server.url);
  url.searchParams.set('seed', args.get('seed') || '1337');
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
  await page.evaluate(() => window.__NOCTIS_HARNESS__.settle(4));
  console.log(`  camera: [${AT.join(', ')}] → [${LOOK.join(', ')}]`);
  const cen = await page.evaluate(() => window.__NOCTIS_HARNESS__.roughCensus());
  printCensus(cen, args.has('all'));
} finally {
  await browser.close();
  server.child.kill('SIGKILL');
}
