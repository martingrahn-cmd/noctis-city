#!/usr/bin/env node
/**
 * radianceprobe.mjs — WHERE THE LIGHT GOES. NOT A GATE. SESSION 55, ITEM 1.
 *
 *   node tools/radianceprobe.mjs --pos=458.79,1.74,103.78 --target=... --t=0 --wet=1
 *   node tools/radianceprobe.mjs --spawn=458.79,-1.01,103.78 --yaw=140 --t=0
 *
 * THE QUESTION, AND IT IS THE OPERATOR'S. He has said the city is too dark four
 * times across ten sessions. Session 30 raised the lamps, session 45 lit 975
 * signs and doubled the kerbs, session 53 lit a kilometre of distant city,
 * session 54 added about five hundred lights to sixteen island kinds — and
 * `distinct:midnight|dusk` read 0.02953 before session 54 and 0.02953 after, on
 * an instrument whose run-to-run spread on that band is 0.00001. Four content
 * increases, and the last of them moved the picture by nothing anybody can
 * measure.
 *
 * A frame cannot say why. A dark pixel is the same dark pixel whether the light
 * never arrived or arrived and was compressed away downstream, and those two
 * findings want opposite repairs. So this walks the whole chain and prints a
 * number at every step:
 *
 *     emitted        the pool's own candela, and HOW MANY LIGHTS GOT A SLOT
 *     delivered      the scene radiance at a pixel, cd/m², off the TAA target
 *                    — CONTRACT §5.3's own unit, before exposure touches it
 *     metered        the adapted log-luminance the 1×1 target holds
 *     exposed        × 1/(1.2·2^EV_used), the §5.4 law with the measured EV
 *     + bloom        the mip the composite adds, × POST.bloomStrength
 *     + glare        the coarsest mip, × POST.glareStrength — §5.5's veil
 *     Purkinje       the mesopic mix, keyed on ABSOLUTE luminance
 *     ACES           the RRT+ODT fit with session 4's re-anchored toe
 *     sRGB           the one encode (§5.2), and the byte
 *
 * AND IT CHECKS ITSELF AGAINST THE FRAME. The last column is compared to the
 * byte at the same pixel of a screenshot taken in the same state. CONTRACT §9
 * rule 2 — the same quantity computed two ways — because a chain that agrees
 * with itself and not with the delivered PNG is a chain that has been mis-read,
 * and STATE 52 §2.2 is what that costs when nobody checks (a whole plausible
 * and entirely wrong table, from assuming four bytes per pixel).
 *
 * THE READBACK IS HERE AND NOT IN A MODULE, AND THAT IS A RULE RATHER THAN A
 * PREFERENCE. CONTRACT §5.4 forbids `readRenderTargetPixels` on the frame path;
 * `parsecheck.mjs` enforces it as *"forbidden in a module"*, which is stricter
 * than the sentence and is the right strictness — a module that CAN read back
 * is one frame away from doing it every frame. `harness.radianceBuffers()`
 * hands out the four render targets and the renderer, exactly as
 * `post.motionTexture` and `post.ssrSource` already hand out objects; the
 * `gl.readPixels` happens inside a `page.evaluate` written in THIS file, and
 * the half-float decode happens here too. Every target in `post.js` is
 * `HalfFloatType` (§5.2), so `readPixels` wants a `Uint16Array` and returns
 * IEEE-754 binary16; reading it into a `Float32Array` returns whatever the
 * driver felt like. The decode is eleven lines and is the difference between a
 * measurement and a plausible table (STATE 52 §2.2, which is this same mistake
 * with a PNG and cost a whole session's arithmetic).
 *
 * THE VIEWPORT IS THE INTERNAL RESOLUTION AND THAT IS NOT AN OPTIMISATION.
 * `RENDER.neverExceedNative` clamps the internal buffer to the drawing buffer,
 * so at any viewport under 2560×1440 the two are the same grid and a screenshot
 * pixel IS a TAA texel. The composite's `uUpscaling` is 0 there, so no
 * Catmull-Rom filtering stands between the buffer this reads and the byte it is
 * checked against.
 *
 * Asserts nothing and must not: `citycheck`, `lookcheck` and `perfcheck` own the
 * verdicts. This prints.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { decodePNG } from './lib/png.mjs';
import { startServer, launchBrowser, openPage, readRendererString } from './lib/page.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = path.join(ROOT, 'tools', 'shot-out');

const args = new Map(
  process.argv.slice(2).map((a) => {
    const s = a.replace(/^--/, '');
    const i = s.indexOf('=');
    return i < 0 ? [s, 'true'] : [s.slice(0, i), s.slice(i + 1)];
  })
);
const num = (s) => s.split(',').map(Number);
const f = (v, n = 4) => (Number.isFinite(v) ? v.toFixed(n) : String(v));

const W = Number(args.get('w') || 1440);
const H = Number(args.get('h') || 810);
const T = Number(args.get('t') ?? 0);
const WET = args.has('wet') ? Number(args.get('wet')) : 1;
const NAME = args.get('name') || 'radiance';

/**
 * A pose, from either a `--pos/--target` pair or a `--spawn/--yaw` pair. The
 * second form is how the operator reports a place: `?player=1&spawn=...` is what
 * `P` prints (CONTRACT §6), and it carries a foot position rather than an eye.
 */
const EYE = 1.74;
let pos;
let target;
if (args.has('spawn')) {
  const s = num(args.get('spawn'));
  const yaw = ((Number(args.get('yaw') || 0) * Math.PI) / 180);
  const pitch = ((Number(args.get('pitch') || -4) * Math.PI) / 180);
  pos = [s[0], (s.length > 2 ? s[1] : 0) + EYE, s.length > 2 ? s[2] : s[1]];
  target = [
    pos[0] + Math.sin(yaw) * Math.cos(pitch) * 40,
    pos[1] + Math.sin(pitch) * 40,
    pos[2] + Math.cos(yaw) * Math.cos(pitch) * 40,
  ];
} else {
  pos = num(args.get('pos') || '0,1.74,0');
  target = num(args.get('target') || '40,4,0');
}
const FOV = Number(args.get('fov') || 55);

/* ─────────────────────────────────────────────────────────────────────────
 * THE DOWNSTREAM HALF OF THE CHAIN, IN JS, FROM THE SAME CONSTANTS THE
 * SHADER USES.
 *
 * These are transcriptions of `post.js`'s composite fragment. That is two
 * copies of one law, which is §9.1's own failure mode — so the LAST STEP IS
 * CHECKED AGAINST THE DELIVERED BYTE on every point this tool prints, and a
 * disagreement is reported rather than hidden. A transcription nobody checks is
 * a transcription that drifts; one that is checked every run is an instrument.
 * ───────────────────────────────────────────────────────────────────────── */

const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

const ACES_IN = [
  [0.59719, 0.35458, 0.04823],
  [0.0760, 0.90834, 0.01566],
  [0.02840, 0.13383, 0.83777],
];
const ACES_OUT = [
  [1.60475, -0.53108, -0.07367],
  [-0.10208, 1.10813, -0.00605],
  [-0.00327, -0.07276, 1.07602],
];
const ACES_TOE = 0.000090537 / 0.238081;
const mul3 = (m, v) => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];

function rrtOdtFit(v) {
  return v.map((x) => {
    const a = x * (x + 0.0245786) - 0.000090537;
    const b = x * (0.983729 * x + 0.4329510) + 0.238081;
    return a / b;
  });
}
function acesFitted(c) {
  let v = mul3(ACES_IN, c);
  v = rrtOdtFit(v).map((x) => (x + ACES_TOE) / (1 + ACES_TOE));
  v = mul3(ACES_OUT, v);
  return v.map((x) => Math.min(1, Math.max(0, x)));
}
function srgbEncode(x) {
  return x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}
function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** The whole composite, per point, with every intermediate kept. */
function walk(pt, chain, ev) {
  const e = 1 / (1.2 * Math.pow(2, ev));
  const hdr = pt.scene;
  const exposed = hdr.map((v) => v * e);
  const withBloom = exposed.map((v, i) => v + pt.bloom[i] * chain.bloomStrength);
  const withGlare = withBloom.map((v, i) => v + pt.glare[i] * chain.glareStrength);
  const absL = lum(hdr);
  const purk = smoothstep(chain.purkinje[2], chain.purkinje[1], absL) * chain.purkinje[0];
  let c = withGlare;
  if (purk > 0) {
    const rod = 0.08 * c[0] + 0.62 * c[1] + 0.30 * c[2];
    const rodColor = [0.805, 1.007, 1.510];
    c = c.map((v, i) => v + (rod * rodColor[i] - v) * purk);
  }
  const toned = acesFitted(c.map((v) => Math.max(0, v)));
  const encoded = toned.map(srgbEncode);
  return {
    sceneL: absL,
    exposureMul: e,
    exposedL: lum(exposed),
    bloomAdd: lum(pt.bloom) * chain.bloomStrength,
    glareAdd: lum(pt.glare) * chain.glareStrength,
    preToneL: lum(c),
    purk,
    tonedL: lum(toned),
    byte: encoded.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)),
    depth: pt.depth,
  };
}

await mkdir(OUT, { recursive: true });

let server = null;
let baseUrl = args.get('url');
if (!baseUrl) {
  server = await startServer(5207);
  baseUrl = server.url;
}
const browser = await launchBrowser();
const { page } = await openPage(browser, { viewport: { width: W, height: H }, deviceScaleFactor: 1 });

try {
  const url = new URL(baseUrl);
  url.searchParams.set('seed', args.get('seed') || '1337');
  url.searchParams.set('paused', '1');
  if (args.has('params')) {
    for (const pair of args.get('params').split(';')) {
      const i = pair.indexOf('=');
      if (i > 0) url.searchParams.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  }
  await page.goto(url.toString(), { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!window.__NOCTIS_HARNESS__, null, { timeout: 60000 });
  await page.evaluate(() => window.__NOCTIS_HARNESS__.ready);
  await page.evaluate(() => window.__NOCTIS_HARNESS__.takeOver());
  console.log(`GPU: ${await readRendererString(page)}`);
  await page.evaluate((w) => window.__NOCTIS_HARNESS__.setWetness(w), WET);

  await page.evaluate((s) => window.__NOCTIS_HARNESS__.setShotAt(s.pos, s.target, s.fov), {
    pos,
    target,
    fov: FOV,
  });
  let arrival = await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity(1800));
  let waits = 1;
  while (waits < 4 && arrival.field && arrival.field.ready < arrival.field.slots) {
    arrival = await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity(1800));
    waits++;
  }
  await page.evaluate((tt) => window.__NOCTIS_HARNESS__.setTimeOfDay(tt), T);
  await page.evaluate(() => window.__NOCTIS_HARNESS__.settle(6));

  const info = await page.evaluate(() => window.__NOCTIS_HARNESS__.info());
  const roles = await page.evaluate(() => window.__NOCTIS_HARNESS__.lightRoleCensus());

  const shot = await page.screenshot({ type: 'png' });
  const png = decodePNG(shot);
  const file = path.join(OUT, `${NAME}-t${String(T).replace('.', '_')}${info.wetness > 0 ? '-wet' : ''}.png`);
  await writeFile(file, shot);

  /**
   * WHICH PIXELS. A GRID, PLUS THE EXTREMES THE GRID FOUND — because the
   * question is about the DARK and a mean over a frame is exactly the statistic
   * STATE 54 §0 says is wrong for a local light. The grid is dense enough that
   * the darkest cell it finds is a surface and not a lucky texel: 64 × 36 is
   * one sample per 22 × 22 pixels at this viewport.
   */
  const GX = 64;
  const GY = 36;
  const grid = [];
  for (let j = 0; j < GY; j++) {
    for (let i = 0; i < GX; i++) {
      grid.push([Math.round(((i + 0.5) / GX) * png.width), Math.round(((j + 0.5) / GY) * png.height)]);
    }
  }
  const chain = await page.evaluate((pts) => {
    const b = window.__NOCTIS_HARNESS__.radianceBuffers();
    if (!b) return null;
    /** binary16 -> Number. Subnormals included: the dark end is the subject. */
    const half = (h) => {
      const s = h & 0x8000 ? -1 : 1;
      const e = (h >> 10) & 0x1f;
      const f = h & 0x3ff;
      if (e === 0) return s * f * 5.9604644775390625e-8;
      if (e === 31) return f ? NaN : s * Infinity;
      return s * Math.pow(2, e - 15) * (1 + f / 1024);
    };
    const buf = new Uint16Array(4);
    const read = (rt, px, py) => {
      const x = Math.max(0, Math.min(rt.width - 1, Math.round(px)));
      const y = Math.max(0, Math.min(rt.height - 1, Math.round(py)));
      // readPixels counts rows from the bottom; a screenshot counts from the top.
      b.renderer.readRenderTargetPixels(rt, x, rt.height - 1 - y, 1, 1, buf);
      return [half(buf[0]), half(buf[1]), half(buf[2]), half(buf[3])];
    };
    const out = [];
    for (const [px, py] of pts) {
      const scene = read(b.scene, px, py);
      const bl = read(b.bloom, (px / b.width) * b.bloom.width, (py / b.height) * b.bloom.height);
      const gl = read(b.glare, (px / b.width) * b.glare.width, (py / b.height) * b.glare.height);
      out.push({
        x: px,
        y: py,
        scene: [scene[0], scene[1], scene[2]],
        depth: scene[3],
        bloom: [bl[0], bl[1], bl[2]],
        glare: [gl[0], gl[1], gl[2]],
      });
    }
    return {
      width: b.width,
      height: b.height,
      bloomStrength: b.bloomStrength,
      glareStrength: b.glareStrength,
      purkinje: b.purkinje,
      exposureParams: b.exposureParams,
      adaptedLogL: b.adapted ? read(b.adapted, 0, 0)[0] : null,
      points: out,
    };
  }, grid);
  if (!chain) throw new Error('radianceBuffers returned null - is post registered?');

  const evOf = (logL, p) => {
    const L = Math.exp(logL);
    let ev = Math.log2(Math.max(L, 1e-6) * 100 / p.K);
    ev = p.anchorEV + (ev - p.anchorEV) * p.adaptStrength;
    return Math.min(p.maxEV, Math.max(p.minEV, ev));
  };
  const P = chain.exposureParams;
  const adaptedL = Math.exp(chain.adaptedLogL);
  const evRaw = Math.log2(Math.max(adaptedL, 1e-6) * 100 / P.K);
  const evPartial = P.anchorEV + (evRaw - P.anchorEV) * P.adaptStrength;
  const ev = evOf(chain.adaptedLogL, P);

  const walked = chain.points.map((pt) => ({ pt, w: walk(pt, chain, ev) }));
  /** Sky is not a surface. `depth` is the linear view depth §5.8 puts in alpha. */
  const SKY_DEPTH = Math.max(...walked.map((r) => r.w.depth));
  const surfaces = walked.filter((r) => r.w.depth < SKY_DEPTH * 0.98);

  const byteAt = (x, y) => {
    const o = (y * png.width + x) * png.channels;
    return [png.data[o], png.data[o + 1], png.data[o + 2]];
  };

  const sortedL = [...surfaces].sort((a, b) => a.w.sceneL - b.w.sceneL);
  const pick = (name, r) => ({ name, ...r });
  const chosen = [
    pick('DARKEST surface', sortedL[0]),
    pick('p10 surface', sortedL[Math.floor(sortedL.length * 0.10)]),
    pick('MEDIAN surface', sortedL[Math.floor(sortedL.length * 0.50)]),
    pick('p90 surface', sortedL[Math.floor(sortedL.length * 0.90)]),
    pick('BRIGHTEST surface', sortedL[sortedL.length - 1]),
  ].filter((c) => c.pt);

  console.log('');
  console.log(`  pose      [${pos.map((v) => v.toFixed(2)).join(', ')}] -> [${target.map((v) => v.toFixed(1)).join(', ')}]  fov ${FOV}`);
  console.log(`  state     t=${T}  wet ${f(info.wetness, 2)}  ${info.drawCalls} draws  ${info.city ? `${info.city.resident} chunks` : ''}  ${arrival.field ? `${arrival.field.ready}/${arrival.field.slots} field` : ''}`);
  console.log(`  buffer    internal ${chain.width}x${chain.height}, screenshot ${png.width}x${png.height}, ${png.channels} bytes/px` +
    `${chain.width === png.width && chain.height === png.height ? '   ONE GRID' : '   *** GRIDS DIFFER — the byte check is meaningless ***'}`);
  console.log('');
  console.log('  ── STEP 1: WHAT IS EMITTING, AND HOW MANY GOT A SLOT ────────────────────');
  console.log(`  ambientLux ${f(info.ambientLux, 5)}   sunLux ${f(info.sunLux, 5)}   photocell ${info.photocellOn ? 'ON' : 'off'}`);
  console.log(`  moon elev ${f(info.moonElevationDeg, 2)} deg   sun elev ${f(info.sunElevationDeg, 2)} deg`);
  if (info.city) {
    console.log(`  lamp pool  ${info.city.lampsActive} active of ${info.city.lampCandidates} candidates within one chunk` +
      (info.city.lampCandidates > info.city.lampsActive
        ? `   -> ${info.city.lampCandidates - info.city.lampsActive} EMIT NOTHING`
        : '   (pool not saturated)'));
    console.log(`  sign pool  ${info.city.signsActive} active of ${info.city.signCandidates} candidates` +
      (info.city.signCandidates > info.city.signsActive
        ? `   -> ${info.city.signCandidates - info.city.signsActive} EMIT NOTHING`
        : '   (pool not saturated)'));
  }
  if (roles && roles.byRole) {
    console.log(`  roles      ${Object.entries(roles.byRole).map(([k, v]) => `${k}:${v}`).join('  ')}   total ${roles.total} of ${roles.maxLights}, unrolled ${roles.unrolled}`);
  }
  console.log(`  clustered  ${info.clusteredLights} resident, peak froxel ${info.clusterPeakOccupancy} of ${info.clusterMaxPerCluster}`);
  console.log('');
  console.log('  ── STEP 2: WHAT THE METER READ, AND WHAT THE EXPOSURE DID WITH IT ───────');
  console.log(`  adapted L        ${f(adaptedL, 6)} cd/m2      (log ${f(chain.adaptedLogL, 5)})`);
  console.log(`  EV_measured      ${f(evRaw, 4)}              = log2(L*100/K), K=${P.K}`);
  console.log(`  EV_partial       ${f(evPartial, 4)}              = ${P.anchorEV} + (EV-${P.anchorEV})*${P.adaptStrength}`);
  console.log(`  EV_used          ${f(ev, 4)}              clamped to [${P.minEV}, ${P.maxEV}]${ev === P.minEV ? '   *** AT THE minEV FLOOR ***' : ''}`);
  console.log(`  exposure x       ${f(1 / (1.2 * Math.pow(2, ev)), 6)}`);
  console.log(`  A GLOBAL STOP OF CONTENT ARRIVES AS ${f(1 - P.adaptStrength, 3)} STOPS ON SCREEN (x${f(Math.pow(2, 1 - P.adaptStrength), 4)}) — the meter takes back ${f(P.adaptStrength, 2)} of every one`);
  console.log(`  so a global lift of ${f(Math.pow(2, 2.04 / (1 - P.adaptStrength)), 0)}x is what it takes to move a black surface 4x on screen. THAT IS WHERE FIVE HUNDRED LIGHTS WENT.`);
  console.log('');
  console.log('  ── STEP 3: THE CHAIN, PER PIXEL, AND THE LAST STEP CHECKED ──────────────');
  console.log('  point                 x     y   scene cd/m2   exposed   +bloom   +glare   purk   ACES    sRGB  frame  d   scene%');
  let worst = 0;
  for (const c of chosen) {
    const b = byteAt(c.pt.x, c.pt.y);
    const d = Math.max(...c.w.byte.map((v, i) => Math.abs(v - b[i])));
    if (d > worst) worst = d;
    console.log(
      `  ${c.name.padEnd(18)} ${String(c.pt.x).padStart(5)} ${String(c.pt.y).padStart(5)}   ` +
        `${f(c.w.sceneL, 5).padStart(9)}  ${f(c.w.exposedL, 5).padStart(8)} ${f(c.w.bloomAdd, 5).padStart(8)} ` +
        `${f(c.w.glareAdd, 5).padStart(8)} ${f(c.w.purk, 2).padStart(6)} ${f(c.w.tonedL, 4).padStart(6)}  ` +
        `${String(c.w.byte[1]).padStart(5)} ${String(b[1]).padStart(6)}  ${d}   ` +
        `${f((100 * c.w.exposedL) / Math.max(1e-12, c.w.exposedL + c.w.bloomAdd + c.w.glareAdd), 1).padStart(5)}%`
    );
  }
  console.log('');
  console.log(`  WORST BYTE DISAGREEMENT ${worst} of 255 over ${chosen.length} points` +
    `${worst <= 2 ? '   — the chain above IS the chain the frame took (±1 dither, §5.5)' : '   *** THE CHAIN DOES NOT REPRODUCE THE FRAME ***'}`);
  console.log('');
  console.log('  ── STEP 4: THE DISTRIBUTION, WHICH IS WHAT "TOO DARK" IS ABOUT ──────────');
  const bytes = surfaces.map((r) => r.w.byte[1]).sort((a, b) => a - b);
  const q = (p) => bytes[Math.min(bytes.length - 1, Math.floor(bytes.length * p))];
  const under = (v) => (100 * bytes.filter((b) => b < v).length) / bytes.length;
  console.log(`  ${surfaces.length} surface samples of ${walked.length} (${walked.length - surfaces.length} sky)`);
  console.log(`  green code value   min ${bytes[0]}   p10 ${q(0.1)}   p25 ${q(0.25)}   median ${q(0.5)}   p75 ${q(0.75)}   p90 ${q(0.9)}   max ${bytes[bytes.length - 1]}`);
  console.log(`  under 4/255  ${f(under(4), 1)}%    under 8/255  ${f(under(8), 1)}%    under 16/255  ${f(under(16), 1)}%    under 24/255  ${f(under(24), 1)}%`);
  const sceneLs = surfaces.map((r) => r.w.sceneL).sort((a, b) => a - b);
  const qs = (p) => sceneLs[Math.min(sceneLs.length - 1, Math.floor(sceneLs.length * p))];
  console.log(`  scene cd/m2        min ${f(sceneLs[0], 5)}   p10 ${f(qs(0.1), 5)}   median ${f(qs(0.5), 4)}   p90 ${f(qs(0.9), 3)}   max ${f(sceneLs[sceneLs.length - 1], 2)}`);
  console.log(`  dynamic range across the surfaces in this frame: ${f(sceneLs[sceneLs.length - 1] / Math.max(1e-9, sceneLs[0]), 0)}x`);
  console.log('');
  console.log('  ── STEP 5: WHAT LEGIBILITY COSTS, DERIVED FROM THE CODE VALUE AND NOT FROM LUX ─');
  /**
   * The inverse of the chain, at the dark end, where ACES and sRGB are both
   * LINEAR — the fit's numerator is `v·0.0245786 − 0.000090537` over a
   * denominator that is 0.238081 at v = 0, and sRGB is 12.92·x below
   * 0.0031308. So a target byte converts to a target display-linear value
   * exactly, and the ratio to today's is the ratio the picture needs. No lux
   * appears anywhere in it, which is LOOK.md §0's own rule.
   */
  const toLinear = (b) => {
    const x = b / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  for (const targetByte of [16, 24, 32]) {
    const want = toLinear(targetByte);
    const rows = [chosen[0], chosen[1], chosen[2]].filter(Boolean);
    const parts = rows.map((c) => {
      const have = Math.max(1e-9, c.w.tonedL);
      const need = want / have;
      const preTone = c.w.exposedL + c.w.bloomAdd + c.w.glareAdd;
      /** As an ADDITION after exposure, which is the only lever the meter cannot take back. */
      const addAfter = preTone * (need - 1);
      return `${c.name.split(' ')[0].toLowerCase()} ${f(need, 2)}x (+${f(addAfter, 5)} post-exposure)`;
    });
    console.log(`  to reach ${targetByte}/255:  ${parts.join('   ')}`);
  }
  console.log('');
  console.log(`  frame written to ${path.relative(ROOT, file)}`);
} finally {
  await browser.close();
  if (server) server.child.kill('SIGKILL');
}
