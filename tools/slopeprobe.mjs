#!/usr/bin/env node
/**
 * slopeprobe.mjs — DOES A NON-VERTICAL NORMAL SHADE? NOT A GATE. SESSION 63.
 *
 *   node tools/slopeprobe.mjs                    t 0.42 wet, the session-62 hour
 *   node tools/slopeprobe.mjs --t=0 --wet=1      midnight, the moon's case
 *   node tools/slopeprobe.mjs --alt=700 --hill=3
 *
 * THE QUESTION THIS ANSWERS, AND IT GATES A WHOLE SESSION. Session 62 refused
 * terrain on two independent blocks, and the second was that `buildGround`'s
 * `quad()` writes a hard-coded `(0, 1, 0)` normal into all six vertices, so a
 * displaced ground surface *"renders with no shading change at all"*. Session
 * 63 builds a mesh that does NOT go through `quad()` — but *"the lighting will
 * read a real normal"* is an assumption about `lights.js`'s material injection,
 * not a measurement of it. **A terrain mesh that renders as a flat colour is
 * worth nothing**, and finding that out here costs twenty minutes instead of a
 * session.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY IT MEASURES A HILL AND DOES NOT ADD A TEST SURFACE.
 *
 * CONTRACT §8 lets exactly one instrument put geometry in the live scene —
 * `windingControls`, for `windcheck --falsify` — and the reason is §7's:
 * *"a gate whose subject the operator creates measures the operator."* This
 * probe needs no such thing, because **the subject is already there and it is
 * already at the angle the question is about.** Session 62 replaced the hills'
 * hemisphere profile with smoothstep's complement, whose delivered band slopes
 * at the median hill are 14.7° / 18.7° / **7.1°** — and 7.1° is the shoulder
 * the brief asks about, to the tenth of a degree, by coincidence of two
 * unrelated derivations. `--slope` picks the instance that delivers a wanted
 * shoulder angle, so the probe answers for the angle asked rather than for
 * whichever hill happens to be biggest.
 *
 * ONE HILL, ONE ALBEDO, EIGHT AZIMUTHS — AND SESSION 64 MOVED WHERE THAT
 * ALBEDO COMES FROM, SO THIS PARAGRAPH IS RE-STATED RATHER THAN LEFT.
 *
 * It read: *"`city:hills` carries a per-instance albedo, so two facets of ONE
 * hill differ in exactly one thing"*. THERE IS NO `city:hills`. The dome is a
 * term of `terrainHeightAt` and `block:ground` draws it, per-vertex, so the
 * control has to be re-argued on the surface that is actually there:
 *
 *   INSIDE `TERRAIN.hillCoverToU` = 0.60 THE CONTROL STILL HOLDS EXACTLY. The
 *   ground's tint there is `HILLS.hillAlbedo x hs.tone` with `hs.tone` constant
 *   over one mass, so the inner two bands are still one albedo and the only
 *   thing that differs across azimuth is the normal.
 *
 *   OUTSIDE IT THE TINT BLENDS TO THE CROP, which varies by parcel. So the
 *   0.82-1.00 band's correlation is a FLOOR and not a measurement of the
 *   shading alone: albedo variation can only add scatter, never manufacture
 *   agreement with `n.l`. Read the inner bands as the answer and the outer as
 *   a bound.
 *
 * CONTRACT §7.7 — an instrument written to detect a failure mode is where that
 * failure mode hides — and the mode here is exactly the one this file exists
 * for: a probe still reporting a correlation after its own controlled variable
 * has quietly become two.
 *
 * THE CAMERA IS A NADIR, AND THAT IS WHAT MAKES THE BINNING EXACT. Looking
 * straight down from `alt`, a pixel's AZIMUTH about the image centre is the
 * world azimuth about the hill's axis and carries **no parallax at all** —
 * height only scales radius. So the azimuthal bin is exact and the radial bin
 * is good to `(h·prof(u))/alt`, which on the outer band is 9 m in 600 and is
 * printed rather than assumed.
 *
 * WHAT IS COMPARED, AND IT IS TWO NUMBERS AND NOT ONE (CONTRACT §9 rule 2):
 * the DELIVERED mean code value per azimuth octant, and the `max(0, n·l)` that
 * Lambert predicts for that octant's own facet normal, taken through the
 * instance's own non-uniform scale by the inverse transpose. If the delivered
 * curve is flat where the prediction swings, the normal is not read. If the two
 * curves have the same shape, it is.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { startServer, launchBrowser, openPage, readRendererString, ROOT } from './lib/page.mjs';
import { decodePNG } from './lib/png.mjs';
import { hillMasses, hillProfile, terrainNormalAt } from '../src/lib/citygen.js';
import { dirFromAzEl, DEG as SOLAR_DEG } from '../src/lib/solar.js';

const args = new Map(process.argv.slice(2).map((a) => {
  const [k, v = 'true'] = a.replace(/^--/, '').split('=');
  return [k, v];
}));
const T = Number(args.get('t') ?? 0.42);
const WET = args.has('wet') ? Number(args.get('wet')) : 1;
const SEED = args.get('seed') || '1337';
const ALT = Number(args.get('alt') || 600);
const W = Number(args.get('w') || 1440);
const H = Number(args.get('h') || 810);
const FOV = 55;
const OUT = path.join(ROOT, 'tools', 'shot-out');
const DEG = Math.PI / 180;

/**
 * `city.js` → `hillGeometry`'s ring list, TRANSCRIBED, and declared rather than
 * hidden (CONTRACT §9.1). It is the same copy `tools/landprobe.mjs --hills`
 * carries and for the same reason: that function needs `three` and a `ctx`. The
 * PROFILE is not a copy — `citygen.js` → `hillProfile` is imported above and is
 * the one description.
 */
const RINGS = [0, 0.50, 0.82, 1.0];
const RAD = 8;

const masses = hillMasses(SEED).filter((m) => !m.wood);
/**
 * THE HILL IS CHOSEN BY ITS SHOULDER SLOPE AND NOT BY ITS SIZE, and the first
 * arm picked the biggest by FOOT — 300 m across and 34.8 m tall, whose shoulder
 * is **3.2°**. That is a fine surface and it is not the one the brief asks
 * about. `--slope` names the angle wanted (7° by default, session 62's median
 * shoulder) and this takes the hill that delivers it closest; a big footprint
 * is then a tie-break, because more pixels is a better mean.
 */
const WANT = Number(args.get('slope') || 7);
const shoulderOf = (m) => (Math.atan2((hillProfile(0.82) - hillProfile(1.0)) * m.h,
  (1.0 - 0.82) * m.foot) * 180) / Math.PI;
const pick = args.has('hill')
  ? masses[Number(args.get('hill')) % masses.length]
  : masses.slice().sort((a, b) => {
    const da = Math.abs(shoulderOf(a) - WANT);
    const db = Math.abs(shoulderOf(b) - WANT);
    if (Math.abs(da - db) > 0.25) return da - db;
    return b.foot - a.foot;
  })[0];
const AX = pick.foot * (pick.ecc || 1);
const AZ = pick.foot / (pick.ecc || 1);
const BEAR = (pick.bearingDeg || 0) * DEG;

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE CAMERA BASIS IS DERIVED AND NOT ASSUMED, AND THE FIRST ARM ASSUMED IT.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The first version aimed 0.5 m off a true nadir, on the argument that
 * `lookAt` with an up vector parallel to the view direction is singular and
 * 0.048° of tilt is negligible. Both halves are true and the conclusion was
 * wrong: at that tilt the basis is not negligible-ly wrong, it is
 * ILL-CONDITIONED, and three's own fallback orientation is not the one this
 * file then assumed (image right = +X, image up = −Z).
 *
 * **THE CORRELATION IT ADDED IS WHAT CAUGHT IT.** The delivered azimuthal curve
 * peaked at sector 2 and the Lambert prediction at sector 4 — a **90° phase
 * offset** — and `r` came back 0.001 / 0.219 / 0.384 on three bands whose swings
 * were 48.0, 38.7 and 40.5 code values. A swing that large with no correlation
 * is not "the normal is not read"; it is an instrument reading the right pixels
 * and calling them by the wrong name. CONTRACT §7.7 in as many words: *an
 * instrument written to detect a failure mode is where that failure mode hides*,
 * and this is §9 rule 7 — a quantity measured from the wrong datum — inside the
 * probe written to answer a question about geometry.
 *
 * SO THE BASIS COMES OUT OF `lookAt`'s OWN ARITHMETIC. `z = normalize(eye −
 * target)`, `x = normalize(up × z)`, `y = z × x`; a pixel's ray is
 * `nx·tanX·x + ny·tanY·y − z` and the ground point is where it meets `y = 0`.
 * That is exact for any pose and assumes nothing about which way is right.
 *
 * The aim is offset 30 m rather than 0.5 — a 2.86° tilt, well clear of the
 * singularity — and the lateral error that tilt costs on a surface 4.1 m up is
 * `4.1·tan(2.86°)` = **0.20 m** against a radius of 200.
 */
const EYE = [pick.x, ALT, pick.z];
const AIM = [pick.x + 30, 0, pick.z];
const norm = (v) => { const L = Math.hypot(...v) || 1; return [v[0] / L, v[1] / L, v[2] / L]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const CZ = norm([EYE[0] - AIM[0], EYE[1] - AIM[1], EYE[2] - AIM[2]]);
const CX = norm(cross([0, 1, 0], CZ));
const CY = cross(CZ, CX);

/**
 * THE FACET NORMAL FOR ONE BAND AND ONE AZIMUTH SECTOR, in world space.
 *
 * The geometry is authored on a unit disc: a ring vertex at parameter `u` and
 * angle `t` is `(cos t · u, hillProfile(u), sin t · u)`. `city.js` composes the
 * instance with scale `(foot·ecc, h, foot/ecc)` and a yaw, and **a normal under
 * a non-uniform scale transforms by the inverse transpose** — which for a
 * diagonal scale is the reciprocal of each component. Getting that wrong is
 * CONTRACT §9 row 14's *"a negative x scale used to turn a plane round"* with a
 * scale instead of a mirror, so it is written out rather than assumed.
 */
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AND SINCE SESSION 64 THE PREDICTION IS THE DELIVERED NORMAL — `facetNormal`
 * BELOW IS KEPT AS THE ANALYTIC DOME AND IS NO LONGER WHAT IS COMPARED.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * MEASURED, AND IT IS THE WHOLE REASON THIS PARAGRAPH EXISTS. Run unchanged
 * against the merged terrain, this probe reported r = 0.003 / 0.052 / −0.073
 * where session 63 read 0.906 / 0.974 / 0.942 — and the delivered code value
 * still swung 17.6, 28.4 and 34.2 of 255 across the eight azimuths of one
 * albedo, so the surface was shading perfectly well and the PREDICTION had
 * stopped describing it. The measured peak sat two sectors round from the
 * predicted one, which is the signature.
 *
 * WHY. `hillRiseAt` is a maximum over 179 masses and `terrainHeightAt` adds two
 * octaves of 13 m over 1 024 m and 5 m over 384 m ON TOP OF IT. On a 259 m
 * footprint those octaves are comparable to the dome's own band relief, and a
 * neighbouring mass can raise a whole sector. The surface a pixel is on is the
 * SUM; the analytic dome is one term of it.
 *
 * So the prediction samples `terrainNormalAt` — the same central difference at
 * `stationM / 2` that `block.js` writes into the mesh — over the sector's own
 * annulus in the hill's own frame, and averages it. That is not a softer test:
 * it is the same test against the surface that is actually there, and it can
 * still fail. CONTRACT §7.7 in its own file: this instrument was written to
 * detect a shading failure and it had become a place where one could hide.
 */
function deliveredNormal(band, sector) {
  const u0 = RINGS[band];
  const u1 = RINGS[band + 1];
  const t0 = (sector / RAD) * Math.PI * 2;
  const t1 = ((sector + 1) / RAD) * Math.PI * 2;
  const n = [0, 1, 0];
  let ax = 0;
  let ay = 0;
  let az = 0;
  const N = 7;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const u = u0 + ((i + 0.5) / N) * (u1 - u0);
      const t = t0 + ((j + 0.5) / N) * (t1 - t0);
      /** The hill's own frame out to world — `hillRiseAt`'s inverse, exactly. */
      const lx = Math.cos(t) * AX * u;
      const lz = Math.sin(t) * AZ * u;
      const x = pick.x + lx * Math.cos(BEAR) - lz * Math.sin(BEAR);
      const z = pick.z + lx * Math.sin(BEAR) + lz * Math.cos(BEAR);
      terrainNormalAt(SEED, x, z, n);
      ax += n[0];
      ay += n[1];
      az += n[2];
    }
  }
  const L = Math.hypot(ax, ay, az) || 1;
  return [ax / L, ay / L, az / L];
}

function facetNormal(band, sector) {
  const u0 = RINGS[band];
  const u1 = RINGS[band + 1];
  const t0 = (sector / RAD) * Math.PI * 2;
  const t1 = ((sector + 1) / RAD) * Math.PI * 2;
  const p = [Math.cos(t0) * u0, hillProfile(u0), Math.sin(t0) * u0];
  const q = [Math.cos(t1) * u1, hillProfile(u1), Math.sin(t1) * u1];
  const r = [Math.cos(t0) * u1, hillProfile(u1), Math.sin(t0) * u1];
  const e1 = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
  const e2 = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
  /** `(a, b, r)` is the winding session 62 derived; its cross product is +Y. */
  let n = [
    e1[1] * e2[2] - e1[2] * e2[1],
    e1[2] * e2[0] - e1[0] * e2[2],
    e1[0] * e2[1] - e1[1] * e2[0],
  ];
  // inverse transpose of diag(AX, h, AZ)
  n = [n[0] / AX, n[1] / pick.h, n[2] / AZ];
  // the instance yaw, about +Y: (x,z) -> (x cos + z sin, -x sin + z cos)
  const wx = n[0] * Math.cos(BEAR) + n[2] * Math.sin(BEAR);
  const wz = -n[0] * Math.sin(BEAR) + n[2] * Math.cos(BEAR);
  const L = Math.hypot(wx, n[1], wz) || 1;
  return [wx / L, n[1] / L, wz / L];
}

/**
 * The band's own slope in degrees at this instance's proportions — THE
 * ANALYTIC DOME'S, and since session 64 that is one term of the delivered
 * surface rather than all of it. It is printed to say what shape was ASKED
 * for; `deliveredNormal` above is what is compared against.
 */
function bandSlopeDeg(band) {
  const dy = (hillProfile(RINGS[band]) - hillProfile(RINGS[band + 1])) * pick.h;
  const dr = (RINGS[band + 1] - RINGS[band]) * pick.foot;
  return (Math.atan2(dy, dr) * 180) / Math.PI;
}

await mkdir(OUT, { recursive: true });
const server = await startServer(5203);
const browser = await launchBrowser();
const { page } = await openPage(browser, { viewport: { width: W, height: H }, deviceScaleFactor: 1 });

let png = null;
let info = null;
try {
  const url = new URL(server.url);
  url.searchParams.set('seed', SEED);
  url.searchParams.set('paused', '1');
  await page.goto(url.toString(), { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!window.__NOCTIS_HARNESS__, null, { timeout: 60000 });
  await page.evaluate(() => window.__NOCTIS_HARNESS__.ready);
  await page.evaluate(() => window.__NOCTIS_HARNESS__.takeOver());
  console.log(`GPU: ${await readRendererString(page)}\n`);
  await page.evaluate((w) => window.__NOCTIS_HARNESS__.setWetness(w), WET);
  await page.evaluate(
    (s) => window.__NOCTIS_HARNESS__.setShotAt(s.pos, s.target, s.fov),
    { pos: EYE, target: AIM, fov: FOV }
  );
  let arrival = await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity(1800));
  let waits = 1;
  while (waits < 4 && arrival.field && arrival.field.ready < arrival.field.slots) {
    arrival = await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity(1800));
    waits++;
  }
  await page.evaluate((tt) => window.__NOCTIS_HARNESS__.setTimeOfDay(tt), T);
  await page.evaluate(() => window.__NOCTIS_HARNESS__.settle(4));
  info = await page.evaluate(() => window.__NOCTIS_HARNESS__.info());
  const shot = await page.screenshot({ type: 'png' });
  png = decodePNG(shot);
  await writeFile(path.join(OUT, `slope-t${String(T).replace('.', '_')}${WET > 0 ? '-wet' : ''}.png`), shot);
} finally {
  await browser.close();
  if (server) server.child.kill('SIGKILL');
}

/**
 * THE SUN COMES OUT OF THE LIVE `time` MODULE AND IS NOT RECOMPUTED HERE.
 * `harness.info()` reports `sunAzimuthDeg` and `sunElevationDeg` off
 * `time.sun`, which is the one clock in this project (CONTRACT §3), and
 * `dirFromAzEl` is the same `solar.js` function `time.js` itself calls. A
 * second solar model in a probe is CONTRACT §9.1's config-the-code-does-not-read
 * with an ephemeris, and it would agree until somebody moved `SITE.latitudeDeg`.
 */
/**
 * AND AT NIGHT THE PREDICTION IS AGAINST THE MOON, because `max(0, n·l)` for a
 * sun 30° under the horizon is zero on every facet and a prediction of all
 * zeroes correlates with nothing. Session 56 moved 85% of the pollution dome's
 * horizontal illuminance into a directional moon term precisely so that a night
 * frame has shape, and this is the reader that finds out whether it reaches the
 * countryside. Which light is being predicted against is printed.
 */
const useMoon = info.sunElevationDeg <= 0 && info.moonElevationDeg > 0;
const LIGHT_NAME = useMoon ? 'MOON' : (info.sunElevationDeg > 0 ? 'SUN' : 'SUN (below the horizon — the prediction is degenerate)');
const sd = useMoon
  ? dirFromAzEl(info.moonAzimuthDeg * SOLAR_DEG, info.moonElevationDeg * SOLAR_DEG)
  : dirFromAzEl(info.sunAzimuthDeg * SOLAR_DEG, info.sunElevationDeg * SOLAR_DEG);
const L = [sd.x, sd.y, sd.z];

console.log(`hill (${pick.x.toFixed(0)}, ${pick.z.toFixed(0)})  foot ${pick.foot.toFixed(0)} m  h ${pick.h.toFixed(1)} m`
  + `  ecc ${(pick.ecc || 1).toFixed(2)}  bearing ${(pick.bearingDeg || 0).toFixed(0)}°  tone ${pick.tone.toFixed(3)}`);
console.log(`camera nadir at ${ALT} m, fov ${FOV}, ${W}x${H}, t ${T}, wet ${WET}, ${info.drawCalls} draws`);
console.log(`sun direction (${L.map((v) => v.toFixed(3)).join(', ')})  elevation ${info.sunElevationDeg.toFixed(1)}°`
  + `  azimuth ${info.sunAzimuthDeg.toFixed(1)}°   sunLux ${info.sunLux == null ? '—' : info.sunLux.toFixed(0)}`
  + `  ambientLux ${info.ambientLux == null ? '—' : info.ambientLux.toFixed(1)}`
  + `  moon elevation ${info.moonElevationDeg == null ? '—' : info.moonElevationDeg.toFixed(1)}°`);
console.log(`band slopes at THIS hill: ${[0, 1, 2].map((b) => `${bandSlopeDeg(b).toFixed(1)}°`).join(' / ')}\n`);

/**
 * PIXEL -> WORLD, BY RAY-PLANE INTERSECTION THROUGH THE DERIVED BASIS ABOVE.
 * The ray is `nx·tanX·CX + ny·tanY·CY − CZ` and the ground point is where it
 * meets `y = 0`. A surface `h` metres up is nearer along the ray, so its true
 * position is pulled toward the eye by `h/(−d.y)`; the AZIMUTH about a
 * near-nadir eye barely moves under that (0.20 m at the outer band) and the
 * RADIUS does, which is the error printed below.
 */
const tanY = Math.tan((FOV / 2) * DEG);
const tanX = tanY * (W / H);
const lum = (i) => (0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2]);

const BANDS = [
  { name: 'crown  0.00-0.50', u0: 0.05, u1: 0.45, band: 0 },
  { name: 'flank  0.50-0.82', u0: 0.55, u1: 0.78, band: 1 },
  { name: 'SHOULDER 0.82-1.0', u0: 0.86, u1: 0.97, band: 2 },
];
const flat = [];
const cells = BANDS.map(() => Array.from({ length: RAD }, () => []));

for (let py = 0; py < png.height; py++) {
  for (let px = 0; px < png.width; px++) {
    const nx = ((px + 0.5) / png.width) * 2 - 1;
    const ny = 1 - ((py + 0.5) / png.height) * 2;
    const rx = nx * tanX * CX[0] + ny * tanY * CY[0] - CZ[0];
    const ry = nx * tanX * CX[1] + ny * tanY * CY[1] - CZ[1];
    const rz = nx * tanX * CX[2] + ny * tanY * CY[2] - CZ[2];
    if (ry >= -1e-6) continue;
    const k = EYE[1] / -ry;
    const dx = EYE[0] + k * rx - pick.x;
    const dz = EYE[2] + k * rz - pick.z;
    /** Into the hill's frame: the inverse of the instance's yaw. */
    const lx = dx * Math.cos(BEAR) + dz * Math.sin(BEAR);
    const lz = -dx * Math.sin(BEAR) + dz * Math.cos(BEAR);
    const u = Math.hypot(lx / AX, lz / AZ);
    const i = (py * png.width + px) * png.channels;
    if (u > 1.25 && u < 1.9) { flat.push(lum(i)); continue; }
    if (u >= 1) continue;
    let t = Math.atan2(lz, lx);
    if (t < 0) t += Math.PI * 2;
    const sector = Math.min(RAD - 1, Math.floor((t / (Math.PI * 2)) * RAD));
    for (let b = 0; b < BANDS.length; b++) {
      if (u >= BANDS[b].u0 && u <= BANDS[b].u1) cells[b][sector].push(lum(i));
    }
  }
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const flatMean = mean(flat);
console.log(`FLAT GROUND BESIDE IT (u 1.25-1.9, ${flat.length} px): mean code value ${flatMean.toFixed(2)}\n`);

/**
 * PEARSON r BETWEEN THE DELIVERED CURVE AND THE PREDICTED ONE, over the eight
 * sectors. The SWING says the normal changes something; `r` says it changes it
 * IN THE SHAPE LAMBERT PREDICTS, which is the difference between "a normal is
 * read" and "something else varies with azimuth". A per-instance albedo cannot
 * produce an azimuthal pattern at all, so the two statements together leave the
 * normal as the only surviving explanation.
 */
const pearson = (a, b) => {
  const n = a.length;
  const ma = a.reduce((x, y) => x + y, 0) / n;
  const mb = b.reduce((x, y) => x + y, 0) / n;
  let sab = 0; let saa = 0; let sbb = 0;
  for (let i = 0; i < n; i++) {
    sab += (a[i] - ma) * (b[i] - mb);
    saa += (a[i] - ma) ** 2;
    sbb += (b[i] - mb) ** 2;
  }
  return sab / Math.sqrt(Math.max(1e-12, saa * sbb));
};
console.log('  band              sector:      0      1      2      3      4      5      6      7   |  swing  ratio');
let verdict = null;
for (let b = 0; b < BANDS.length; b++) {
  const meas = cells[b].map((c) => mean(c));
  const pred = Array.from({ length: RAD }, (_, s) => {
    const n = deliveredNormal(BANDS[b].band, s);
    return Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
  });
  const ok = meas.filter((v) => Number.isFinite(v));
  const swing = ok.length ? Math.max(...ok) - Math.min(...ok) : NaN;
  const ratio = ok.length ? Math.max(...ok) / Math.max(1e-6, Math.min(...ok)) : NaN;
  console.log(`  ${BANDS[b].name.padEnd(18)} measured  ${meas.map((v) => (Number.isFinite(v) ? v.toFixed(1).padStart(6) : '     —')).join(' ')}   |  ${swing.toFixed(1).padStart(5)}  ${ratio.toFixed(2)}x`);
  const pmin = Math.min(...pred);
  const pmax = Math.max(...pred);
  console.log(`  ${''.padEnd(18)} max(0,n·l) ${pred.map((v) => v.toFixed(3).padStart(6)).join(' ')}   |  ${(pmax - pmin).toFixed(3)}`);
  const r = ok.length === RAD ? pearson(meas, pred) : NaN;
  console.log(`  ${''.padEnd(18)} slope ${bandSlopeDeg(BANDS[b].band).toFixed(1)}°, ${cells[b].reduce((a, c) => a + c.length, 0)} px,`
    + `  Pearson r(measured, predicted) = ${r.toFixed(3)}`);
  if (BANDS[b].band === 2) verdict = { swing, ratio, pred: pmax - pmin, r };
}

console.log('');
console.log('  RADIAL BIN ERROR: the outer band stands at most'
  + ` ${(pick.h * hillProfile(0.86)).toFixed(1)} m up, which at ${ALT} m of altitude is`
  + ` ${((pick.h * hillProfile(0.86) * 100) / ALT).toFixed(1)}% of its radius. The AZIMUTHAL bin has no such term.`);
console.log('');
if (verdict) {
  /**
   * TWO CONDITIONS AND NOT ONE. A swing says the normal changes SOMETHING; the
   * correlation says it changes it in the shape Lambert predicts. The first arm
   * asserted on the swing alone and would have called a 48-code-value swing at
   * `r = 0.001` a success — which is exactly what the 90° basis error produced.
   */
  const shades = verdict.swing > 2 && verdict.r > 0.7;
  console.log(`  THE ANSWER, ON THE ${bandSlopeDeg(2).toFixed(1)}° SHOULDER — the angle the brief asks about:`);
  console.log(`    the delivered code value swings ${verdict.swing.toFixed(1)} of 255 (${verdict.ratio.toFixed(2)}x) across the eight`);
  console.log(`    azimuths of ONE HILL, i.e. at one albedo, one material and one mesh,`);
  console.log(`    against a ${LIGHT_NAME} Lambert prediction that swings ${verdict.pred.toFixed(3)} in max(0, n·l),`);
  console.log(`    and the two curves correlate at r = ${verdict.r.toFixed(3)} over the eight sectors.`);
  console.log(`    ${shades ? 'A NON-VERTICAL NORMAL SHADES.' : '*** NOT ESTABLISHED AT THIS HOUR — see the r column. ***'}`);
}
