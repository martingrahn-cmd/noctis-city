#!/usr/bin/env node
/**
 * albedoprobe.mjs — WHAT IS THE GROUND'S REFLECTANCE, AND WHAT DOES THE SKY
 * THINK IT IS? NOT A GATE, and it must never become one. SESSION 67.
 *
 *   node tools/albedoprobe.mjs
 *   node tools/albedoprobe.mjs --at=0,60,0
 *
 * ════════════════════════════════════════════════════════════════════════════
 * WHY IT EXISTS: TWO CONSTANTS, ONE QUANTITY, AND NEITHER IS MEASURED.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `ATM.groundAlbedo` feeds the sky's bounce term and, through PMREM, the lower
 * half of the environment map — *"the only thing filling shadows from below"*,
 * in its own words. It carries **no derivation at all**, which CONTRACT §9
 * rule 5 calls a guess.
 *
 * `GROUND.earthAlbedo` carries one, and it is the same sentence: *"the
 * area-weighted mean of the city's own drawn ground"*, session 42. **The two
 * differ by 1.19x in luminance and 3.9x in saturation.**
 *
 * Session 42 is twenty-five sessions ago and the city has moved underneath it:
 * session 45 took a third of the carriageways from 0.19 to 0.1171, and sessions
 * 61 to 66 added a countryside, hills, a coast and 30.4 km2 of sea. **So neither
 * constant is trusted here.** This measures the surface the scene actually
 * draws.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * AND IT PROVES IT CAN TELL RIGHT FROM WRONG BEFORE IT SAYS RIGHT.
 *
 * CONTRACT §9 row 71 is this project's newest and hardest-won: `waterprobe`
 * reported *"8 of 8 matched, worst 0.00 m"* while its own discriminator could
 * not discriminate, and only its §7.3 control said so. **The instrument risk
 * here is the same shape and worse** — a colour term read through a render that
 * the same term lights.
 *
 * So this reads the BUFFER and not the frame, and it carries two controls whose
 * answers are known by construction and are 5x apart:
 *
 *   BRIGHT   `block:markings` is `ROAD_PAINT.albedo` on the material with no
 *            vertex colour. The census must return that triple.
 *   DARK     `block:ground` INSIDE `TERRAIN.rampStartM` is `GROUND.earthAlbedo`
 *            on the material times a per-vertex tint that is exactly (1,1,1)
 *            there by construction. The census must return `earthAlbedo` — and
 *            this one exercises the vertex-colour multiply, which the bright
 *            control does not.
 *
 * An instrument that returns both is reading a reflectance. One that returns
 * either alone is reading half a path.
 */

import { startServer, launchBrowser, openPage, readRendererString } from './lib/page.mjs';
import { CITY, TERRAIN, SEA } from '../src/lib/citygen.js';
import { GROUND, ROAD_PAINT, WATER_BODY } from '../src/core/constants.js';
import { ATM } from '../src/lib/atmosphere.js';

const args = new Map(process.argv.slice(2).map((a) => {
  const s = a.replace(/^--/, '');
  const i = s.indexOf('=');
  return i < 0 ? [s, 'true'] : [s.slice(0, i), s.slice(i + 1)];
}));
const AT = (args.get('at') || '0,80,0').split(',').map(Number);
const SEED = args.get('seed') || '1337';

const Y = (a) => 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
const SAT = (a) => {
  const M = Math.max(...a);
  const m = Math.min(...a);
  return M > 0 ? (M - m) / M : 0;
};
const ORDER = (a) => {
  const n = ['r', 'g', 'b'];
  return n.map((k, i) => [k, a[i]]).sort((p, q) => q[1] - p[1]).map((p) => p[0]).join(' > ');
};
const trip = (a) => a.map((v) => v.toFixed(4)).join(', ');
const line = (name, a, extra = '') => console.log(
  `  ${name.padEnd(30)} [${trip(a)}]  Y ${Y(a).toFixed(4)}  sat ${SAT(a).toFixed(3)}  ${ORDER(a)}${extra}`
);

console.log('albedoprobe — NOT A GATE.\n');
console.log('  THE TWO CONSTANTS THAT CLAIM THE SAME QUANTITY');
line('ATM.groundAlbedo', ATM.groundAlbedo, '   <- no derivation');
line('GROUND.earthAlbedo', GROUND.earthAlbedo, '   <- session 42, derived');
console.log(`  ratio  Y ${(Y(ATM.groundAlbedo) / Y(GROUND.earthAlbedo)).toFixed(3)}x`
  + `   saturation ${(SAT(ATM.groundAlbedo) / SAT(GROUND.earthAlbedo)).toFixed(2)}x\n`);
console.log('  FOR CONTEXT — the other things in this world that reflect');
line('ROAD_PAINT.albedo', ROAD_PAINT.albedo);
line('WATER_BODY', WATER_BODY);
for (const [k, v] of Object.entries(GROUND.cropAlbedo)) line(`GROUND.cropAlbedo.${k}`, v);
console.log('');

const server = await startServer(5213);
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
  console.log(`  GPU: ${await readRendererString(page)}`);
  await page.evaluate((p) => window.__NOCTIS_HARNESS__.setShotAt(p, [p[0] + 100, 0, p[2]], 55), AT);
  await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity(1800));
  await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity(1800));
  await page.evaluate(() => window.__NOCTIS_HARNESS__.settle(4));

  /* ───────────────────────── the controls, first ───────────────────────── */
  console.log(`\n  ── THE CONTROLS (§7.3), AND THEY RUN BEFORE ANYTHING IS READ ──\n`);
  const bright = await page.evaluate(
    () => window.__NOCTIS_HARNESS__.groundAlbedoCensus({ name: 'block:markings' })
  );
  const dark = await page.evaluate(
    (r) => window.__NOCTIS_HARNESS__.groundAlbedoCensus({ name: 'block:ground', maxR: r }),
    TERRAIN.rampStartM - 200
  );
  const near = (a, b, tol) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
  const bA = bright.rows.length ? bright.rows[0].albedo : null;
  const dA = dark.rows.length ? dark.rows[0].albedo : null;
  const okB = bA && near(bA, ROAD_PAINT.albedo, 0.002);
  const okD = dA && near(dA, GROUND.earthAlbedo, 0.002);
  if (bA) line('BRIGHT  block:markings', bA, `   want [${trip(ROAD_PAINT.albedo)}]  ${okB ? 'ok' : 'XX'}`);
  else console.log('  BRIGHT  block:markings        NOT IN SCENE  XX');
  if (dA) line('DARK    block:ground inside', dA, `   want [${trip(GROUND.earthAlbedo)}]  ${okD ? 'ok' : 'XX'}`);
  else console.log('  DARK    block:ground inside   NOT IN SCENE  XX');
  console.log(
    `\n  The two controls are ${bA && dA ? (Y(bA) / Y(dA)).toFixed(1) : '—'}x apart in luminance, so an instrument`
  );
  console.log('  that returns both is discriminating and not collapsing onto one answer.');
  if (!okB || !okD) {
    console.log('\n  A CONTROL FAILED. NOTHING BELOW IS A VERDICT — read the raw rows first.\n');
  } else {
    console.log('  Both hold.\n');
  }

  /* ─────────────────────────── the measurement ─────────────────────────── */
  const regions = [
    ['the city, r <= 1280 (citycheck\'s own)', { maxR: 1280 }],
    ['the city, r <= 3232 (the zero disc)', { maxR: CITY.extentEdgeM }],
    ['the countryside, 3232 < r <= 4000', { minR: CITY.extentEdgeM, maxR: 4000 }],
    ['everything drawn', {}],
  ];
  console.log('  ── THE DELIVERED GROUND, AREA-WEIGHTED BY PLAN FOOTPRINT ──\n');
  for (const [label, opt] of regions) {
    const cen = await page.evaluate((o) => window.__NOCTIS_HARNESS__.groundAlbedoCensus(o), opt);
    /**
     * GROUND MESHES ONLY. A facade is not what a ray pointing down sees, and a
     * roof is not what a soffit three metres over a pavement sees — which is
     * the consumer `ATM.groundAlbedo`'s own comment names. The filter is by
     * mesh NAME and it is printed, so a reader can disagree with it.
     */
    const G = cen.rows.filter((r) => /:ground$|road:main|road:cross|markings|water$/.test(r.name));
    let area = 0; const s = [0, 0, 0];
    for (const r of G) { area += r.planM2; for (let i = 0; i < 3; i++) s[i] += r.albedo[i] * r.planM2; }
    if (!area) { console.log(`  ${label.padEnd(38)} (nothing)`); continue; }
    const a = s.map((v) => v / area);
    line(label, a, `   ${(area / 1e6).toFixed(2)} km2`);
  }

  console.log('\n  ── BY MESH, EVERYTHING DRAWN ──\n');
  const all = await page.evaluate(() => window.__NOCTIS_HARNESS__.groundAlbedoCensus({}));
  console.log(`  ${'mesh'.padEnd(30)} ${'plan m2'.padStart(11)}  ${'albedo'.padEnd(26)}  Y      sat`);
  console.log(`  ${'─'.repeat(30)} ${'─'.repeat(11)}  ${'─'.repeat(26)}  ─────  ─────`);
  for (const r of all.rows.slice(0, 16)) {
    console.log(`  ${r.name.slice(0, 30).padEnd(30)} ${r.planM2.toLocaleString('en-US').padStart(11)}`
      + `  [${trip(r.albedo)}]  ${Y(r.albedo).toFixed(4)}  ${SAT(r.albedo).toFixed(3)}`);
  }
} finally {
  await browser.close();
  server.child.kill('SIGKILL');
}
