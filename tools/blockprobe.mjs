#!/usr/bin/env node
/**
 * blockprobe.mjs — WHAT EMITS, AND HOW MUCH OF IT THE LOOK CAMERA SEES.
 * NOT A GATE, and it must never become one. SESSION 30.
 *
 * WHY IT EXISTS.
 *
 * Session 28 built lit retail and 190 advertising pillars into the STREAMED
 * city while the operator was looking at the ORIGIN BLOCK, and the frame he
 * pointed at moved by 0.145% of its pixels. Session 30 was asked to bring that
 * content to the block — into the one camera every `lookcheck` luminance
 * assertion measures, whose `band:midnight` ceiling has 0.0032 of headroom.
 *
 * So the question that decides the session is: **how much emitter does that
 * camera already see, and what would a new one add?** That is an AREA times a
 * RADIANCE, and until now nothing in the project could print either.
 *
 * `harness.info().block` counts shop bays and lit windows. A count is not an
 * area (CONTRACT §7.2) and an area is not a delivered radiance, so this walks
 * the live scene and measures both off the geometry that was actually emitted.
 *
 * HOW THE AREA IS MEASURED, AND WHY NOT FROM THE MATRIX SCALE.
 *
 * Summing `sx * sy` off each instance matrix is the obvious route and it is
 * wrong for two of the emitters here: a lamp bowl is a sphere zone, not a
 * quad, and a shop-bay pane's matrix carries a `z` of 1 that means nothing.
 * So the area is the sum of the mesh's own TRIANGLE areas, transformed by each
 * delivered instance matrix — exact for a plane, a box and a lathe alike, and
 * it reads the geometry the renderer binds rather than a description of it.
 *
 * The number reported per row is `area * emissiveIntensity`, in m²·cd/m². That
 * product is what a distant camera integrates: two emitters with the same
 * product deliver the same flux toward the eye, whatever their size. It is NOT
 * a luminance and it does not predict a mean on its own — the exposure system
 * (CONTRACT §5.4) is a log-average with partial adaptation, so the map from
 * this quantity to `band:midnight` is strongly sublinear and has to be
 * CALIBRATED by zeroing a known emitter. See STATE 30 §0.
 *
 * FRUSTUM. The `visible` column is the share of each row's product whose
 * instance centroid falls inside the look gate's own `street` shot — the
 * camera every luminance band in `look-budget.json` is measured through. It is
 * a centroid test and it says so: a 40 m facade half in frame counts whole or
 * not at all. Read it as "does this row reach that camera", not as a coverage.
 *
 * Usage:
 *   node tools/blockprobe.mjs
 *   node tools/blockprobe.mjs --t=0.0          time of day for the census
 */

import { startServer, launchBrowser, openPage, readRendererString } from './lib/page.mjs';

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);

const T = Number(args.get('t') || 0.0);
const SEED = Number(args.get('seed') || 1337);

const { child: server, url: base } = await startServer(5199);
const browser = await launchBrowser();
const { page } = await openPage(browser, { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });

const url = new URL(base);
url.searchParams.set('perf', '1');
url.searchParams.set('seed', String(SEED));
url.searchParams.set('t', String(T));
url.searchParams.set('paused', '1');

await page.goto(url.toString(), { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__NOCTIS_HARNESS__, null, { timeout: 60000 });
await page.evaluate(() => window.__NOCTIS_HARNESS__.ready);
await page.evaluate(() => window.__NOCTIS_HARNESS__.takeOver());
await page.evaluate((t) => window.__NOCTIS_HARNESS__.setTimeOfDay(t), T);
await page.evaluate(() => window.__NOCTIS_HARNESS__.setShot('street'));
await page.evaluate(() => window.__NOCTIS_HARNESS__.settle(4));

console.log(`GPU: ${await readRendererString(page)}`);

const census = await page.evaluate(() => {
  const { ctx, THREE } = window.__NOCTIS__;
  const cam = ctx.camera;
  cam.updateMatrixWorld(true);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)
  );

  /** The sum of a geometry's own triangle areas, under one instance matrix. */
  const areaUnder = (geo, mat, a, b, c, ab, ac, cross) => {
    const pos = geo.attributes.position;
    const idx = geo.index;
    const n = idx ? idx.count : pos.count;
    let sum = 0;
    for (let i = 0; i < n; i += 3) {
      const i0 = idx ? idx.getX(i) : i;
      const i1 = idx ? idx.getX(i + 1) : i + 1;
      const i2 = idx ? idx.getX(i + 2) : i + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(mat);
      b.fromBufferAttribute(pos, i1).applyMatrix4(mat);
      c.fromBufferAttribute(pos, i2).applyMatrix4(mat);
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      sum += cross.crossVectors(ab, ac).length() * 0.5;
    }
    return sum;
  };

  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), cross = new THREE.Vector3();
  const m4 = new THREE.Matrix4(), centre = new THREE.Vector3();

  const rows = [];
  ctx.scene.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const nits = Math.max(...mats.map((m) => (m && m.emissiveIntensity) || 0));
    if (!(nits > 0)) return;
    const em = mats.find((m) => (m.emissiveIntensity || 0) === nits);
    if (em && em.emissive && em.emissive.r + em.emissive.g + em.emissive.b === 0) return;

    o.updateMatrixWorld(true);
    let area = 0, seen = 0, count = 0;
    if (o.isInstancedMesh) {
      count = o.count;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m4);
        m4.premultiply(o.matrixWorld);
        const A = areaUnder(o.geometry, m4, a, b, c, ab, ac, cross);
        area += A;
        centre.setFromMatrixPosition(m4);
        if (frustum.containsPoint(centre)) seen += A;
      }
    } else {
      count = 1;
      area = areaUnder(o.geometry, o.matrixWorld, a, b, c, ab, ac, cross);
      centre.setFromMatrixPosition(o.matrixWorld);
      if (frustum.containsPoint(centre)) seen = area;
    }
    if (area <= 0) return;
    rows.push({
      name: o.name || `${o.type}#${o.id}`,
      owner: o.name && o.name.startsWith('block') ? 'block'
        : (o.name && /^city|^chunk/.test(o.name)) ? 'city' : 'other',
      count, nits, area, seen,
    });
  });

  /** Which root each mesh hangs off, so `block` and `city` are separable. */
  const rootOf = new Map();
  for (const child of ctx.scene.children) {
    child.traverse((o) => { if (o.isMesh) rootOf.set(o.id, child.name || child.type); });
  }
  ctx.scene.traverse((o) => { if (o.isMesh) o.userData.__root = rootOf.get(o.id); });
  for (const r of rows) {
    const mesh = ctx.scene.getObjectByProperty('name', r.name);
    if (mesh) r.root = mesh.userData.__root;
  }

  const info = window.__NOCTIS_HARNESS__.info();
  /**
   * The block's ten buildings as the frontage they present. `width` is along
   * the street and `side` is which side of it they stand on, so "how many
   * pillars would this block take" is arithmetic rather than a guess.
   */
  const blk = ctx.get('block');
  const buildings = (blk && blk.buildings ? blk.buildings : []).map((b) => ({
    x: b.x, z: b.z, width: b.width, depth: b.depth, side: b.side,
    plinth: b.plinth, height: b.height, ground: b.era && b.era.ground, era: b.era && b.era.id,
  }));
  return { rows, block: info.block, buildings, cam: { pos: cam.position.toArray(), fov: cam.fov } };
});

const rows = census.rows.sort((x, y) => y.area * y.nits - x.area * x.nits);
const fmt = (n, w, d = 1) => n.toFixed(d).padStart(w);

console.log(`\ncamera  [${census.cam.pos.map((v) => v.toFixed(2)).join(', ')}]  fov ${census.cam.fov}`);
console.log(`block counts  ${JSON.stringify(census.block)}\n`);
console.log('  root            mesh                                inst      nits       area m²    area×nits     in frustum');
let tA = 0, tP = 0, tS = 0;
for (const r of rows) {
  const p = r.area * r.nits;
  const s = r.seen * r.nits;
  tA += r.area; tP += p; tS += s;
  console.log(
    `  ${(r.root || '?').padEnd(14)}  ${r.name.slice(0, 34).padEnd(34)}  ${String(r.count).padStart(5)}  ${fmt(r.nits, 8, 1)}  ${fmt(r.area, 12, 2)}  ${fmt(p, 12, 0)}  ${fmt(s, 12, 0)}`
  );
}
console.log(`  ${''.padEnd(14)}  ${'TOTAL'.padEnd(34)}  ${''.padStart(5)}  ${''.padStart(8)}  ${fmt(tA, 12, 2)}  ${fmt(tP, 12, 0)}  ${fmt(tS, 12, 0)}`);

/**
 * THE SUMMARY IS THE POINT AND THE TABLE ABOVE IS ITS WORKING. Rolled up by
 * root and, inside the origin block, by the FAMILY of emitter — because the
 * question item 0 asks is not "how much emitter is there" but "how much of it
 * does the look camera stand in front of".
 */
const family = (r) => {
  if (r.root !== 'block') return r.root || '?';
  if (/windows:off/.test(r.name)) return 'block:windows unlit';
  if (/windows:/.test(r.name)) return 'block:windows lit';
  if (/shopbay/.test(r.name)) return 'block:shop bays';
  if (/sign:.*tube/.test(r.name)) return 'block:sign tubes';
  if (/sign:/.test(r.name)) return 'block:sign plates';
  return 'block:other';
};
/** The 16 lamp bowls are separate lathes with no name; they are 210 cd/m². */
const key = (r) => (r.root === undefined && Math.abs(r.nits - 210) < 0.5 ? 'block:lamp bowls' : family(r));
const roll = new Map();
for (const r of rows) {
  const k = key(r);
  const e = roll.get(k) || { n: 0, area: 0, p: 0, s: 0 };
  e.n += r.count; e.area += r.area; e.p += r.area * r.nits; e.s += r.seen * r.nits;
  roll.set(k, e);
}
console.log('\n  BY OWNER                       inst       area m²    area×nits     in frustum   share of frustum');
for (const [k, e] of [...roll].sort((a, b) => b[1].s - a[1].s)) {
  console.log(
    `  ${k.padEnd(28)}  ${String(e.n).padStart(5)}  ${fmt(e.area, 12, 2)}  ${fmt(e.p, 12, 0)}  ${fmt(e.s, 12, 0)}  ${fmt((100 * e.s) / Math.max(tS, 1), 12, 2)}%`
  );
}

await browser.close();
server.kill();

/**
 * THE FRONTAGE, because item 0's estimate needs a COUNT and a count of
 * pillars is `round(faceWidth / AD_PILLAR.perFrontageM)` per elevation — the
 * streamed city's own rule, applied to the block's own widths.
 */
console.log('\n  BLOCK FRONTAGE');
console.log('    #   era         ground        x        z     width    depth   height   side');
let front = 0;
census.buildings.forEach((b, i) => {
  front += b.width;
  console.log(
    `  ${String(i).padStart(3)}   ${String(b.era).padEnd(10)}  ${String(b.ground).padEnd(12)}` +
    `${b.x.toFixed(1).padStart(7)}  ${b.z.toFixed(1).padStart(7)}  ${b.width.toFixed(2).padStart(7)}` +
    `  ${b.depth.toFixed(2).padStart(6)}  ${b.height.toFixed(2).padStart(6)}  ${String(b.side).padStart(5)}`
  );
});
console.log(`    total street frontage ${front.toFixed(1)} m over ${census.buildings.length} buildings`);
