#!/usr/bin/env node
/**
 * stepprobe.mjs — WHAT THE CAPTURE PATH DID BEFORE IT TOOK THE PICTURE.
 * =====================================================================
 * NOT A GATE, and it must never become one.
 *
 *   node tools/stepprobe.mjs --tag=base
 *   node tools/stepprobe.mjs --tag=arm --pin=2000
 *
 * WHY IT EXISTS. STATE 68 §8 item 1 records 73 373 bytes of difference in a
 * frame at the origin after a landedness test changed on a quay 3.5 km away,
 * and proposes a mechanism — a shared placement stream — from the SHAPE of the
 * difference in the picture. A picture is the last thing in a long chain and
 * it cannot say which link moved. This reads the links.
 *
 * IT TAKES THE SAME FRAME `tools/lookat.mjs` TAKES, by the same calls in the
 * same order, and the pose is derived from `LANDMARKS` by the same three lines
 * rather than transcribed — CONTRACT §9.1's "two descriptions of one camera"
 * is exactly the failure a second frame tool invites. The pose is printed so
 * it can be read against `lookat`'s own printed pose.
 *
 * WHAT IT ADDS, and each one is a link in that chain:
 *
 *   FRAMES     `waitForCity` polls a WORKER. It steps ten frames, asks whether
 *              the bake queue has drained, and steps ten more if it has not —
 *              so the number of frames rendered before a capture is a function
 *              of how long the worker took in WALL-CLOCK MILLISECONDS. Every
 *              module that integrates `dt` has therefore advanced by an amount
 *              nobody chose. CONTRACT §4.2 says a harness-driven `dt` is fixed
 *              "so that a capture is reproducible"; a fixed `dt` over a
 *              variable number of frames is not.
 *   CROWD      every InstancedMesh in the scene, by name, with its instance
 *              count and a hash of the matrices it delivered. A difference
 *              that shows up in `streetlife:*` and nowhere else is a crowd that
 *              moved; one that shows up in the traffic meshes too is a clock
 *              that moved; one that shows up in neither is neither.
 *   EXPOSURE   the adapted log-luminance the frame was divided by, read the
 *              way `tools/radianceprobe.mjs` reads it. `exposure.js` meters the
 *              WHOLE frame (STATE 68 §1c), so a change anywhere moves every
 *              pixel — which makes "every tile is touched" evidence for the
 *              exposure and for a reshuffled crowd equally, and a probe that
 *              could not separate them would agree with whichever the reader
 *              already believed.
 *
 * `--pin=N` IS THE CONTROL AND IT IS THE WHOLE POINT OF THE TOOL. After the
 * city has arrived it steps until the frame counter reaches N, so both arms of
 * an A/B enter `settle()` having rendered exactly the same number of frames.
 * If a difference survives a pin it is not the frame count. If it does not, it
 * was never anything else.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { POSES } from './lib/poses.mjs';
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

/**
 * THE POSE COMES FROM `tools/lib/poses.mjs` — SESSION 70.
 *
 * This file used to re-derive `viaduct-under` off `LANDMARKS` and `viaductArc`
 * by the same three lines `lookat.mjs` used, and printed the pose so a reader
 * could check the two by eye. That is a mitigation, not a fix: two derivations
 * of one camera is CONTRACT §9.1 with a matrix in it. There is one now, in
 * `lookat.mjs`'s own table, and both tools import it.
 *
 * ── AND `viaduct-under` DOES NOT SHOW A VIADUCT. READ THIS BEFORE USING IT. ──
 *
 * STATE 69 §8 item 4 measured it: 60.3% of the frame is one building wall a few
 * metres from the lens, and session 70 looked at the frame — there is no
 * viaduct in it at all, no deck, no pier, no soffit. It is kept as the DEFAULT
 * here for one reason only, and it is not a good one about the picture: every
 * byte comparison this project has recorded since session 68 is against this
 * frame, so changing the default would make session 69's and 70's own artefacts
 * incomparable. **For a frame that actually shows a soffit use
 * `--preset=viaduct-side`**, which is a committed pose with its own derivation
 * and which delivers the deck's underside, the girder edge and the piers on
 * both sides.
 */
const shot = args.has('pos')
  ? {
      name: args.get('name') || 'custom',
      pos: args.get('pos').split(',').map(Number),
      target: (args.get('target') || '0,10,0').split(',').map(Number),
      fov: Number(args.get('fov') || 55),
    }
  : (() => {
      const name = args.get('preset') || 'viaduct-under';
      if (!POSES[name]) {
        console.error(`stepprobe: no preset '${name}'. Have: ${Object.keys(POSES).join(', ')}`);
        process.exit(2);
      }
      return { name, ...POSES[name] };
    })();

const TAG = args.get('tag') || 'stepprobe';
const T = Number(args.get('t') || 0.5);
const PIN = args.has('pin') ? Number(args.get('pin')) : null;
const SHOOT = args.get('shot') !== '0';
const wetArg = args.has('wet') ? Number(args.get('wet')) : null;

const passParams = new Map();
for (const pair of (args.get('params') || '').split(';')) {
  if (!pair || pair === 'true') continue;
  const i = pair.indexOf('=');
  if (i < 0) continue;
  passParams.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
}

await mkdir(OUT, { recursive: true });

/**
 * READ ON THE PAGE, NOT HERE. Everything below runs inside the browser and
 * returns plain data: `window.__NOCTIS__` is what `main.js` exposes and it is
 * the only door to the scene graph that does not require a new method under
 * `src/`. This session ships nothing, so it opens no new doors.
 */
const PAGE_STATE = `(() => {
  const N = window.__NOCTIS__;
  const H = window.__NOCTIS_HARNESS__;
  const ctx = N.ctx;
  const time = ctx.get('time');

  // FNV-1a over the raw IEEE-754 bytes of a Float32Array. The matrices are
  // compared as they are DELIVERED — no rounding, because a hash that tolerated
  // a rounding would be an instrument with a noise floor nobody derived.
  const fnv = (f32) => {
    const u = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
    let h = 0x811c9dc5;
    for (let i = 0; i < u.length; i++) { h ^= u[i]; h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).padStart(8, '0');
  };

  const meshes = [];
  ctx.scene.traverse((o) => {
    if (!o.isInstancedMesh || !o.instanceMatrix) return;
    const m = o.instanceMatrix.array;
    const count = o.count;
    const used = m.subarray(0, Math.min(m.length, count * 16));
    let sx = 0, sy = 0, sz = 0;
    for (let i = 0; i + 15 < used.length; i += 16) { sx += used[i + 12]; sy += used[i + 13]; sz += used[i + 14]; }
    meshes.push({
      name: o.name || '(unnamed)',
      count,
      capacity: m.length / 16,
      hash: fnv(used),
      sum: [+sx.toFixed(4), +sy.toFixed(4), +sz.toFixed(4)],
      ped: !!(o.userData && o.userData.noctisPedestrians),
      visible: o.visible,
    });
  });
  meshes.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.count - b.count));

  const sl = ctx.get('streetlife');
  const rv = ctx.get('river');
  return {
    frame: time ? time.frame : null,
    now: time ? +time.now.toFixed(6) : null,
    timeOfDay: time ? time.timeOfDay : null,
    paused: time ? time.paused : null,
    meshes,
    pedestrians: sl && sl.pedestrianStats ? sl.pedestrianStats() : null,
    traffic: H.trafficStats ? H.trafficStats() : null,
    river: rv && rv.stats ? rv.stats() : null,
    pedestrianCensus: H.pedestrianCensus ? H.pedestrianCensus() : null,
  };
})()`;

/**
 * The adapted log-luminance, read the way `tools/radianceprobe.mjs` reads it —
 * the SAME half-float decode and the SAME bottom-row convention, because two
 * decodes of one texel is CONTRACT §9.1 with a pixel format.
 */
const PAGE_EXPOSURE = `(() => {
  const H = window.__NOCTIS_HARNESS__;
  const b = H.radianceBuffers ? H.radianceBuffers() : null;
  if (!b || !b.adapted) return null;
  const half = (h) => {
    const s = h & 0x8000 ? -1 : 1;
    const e = (h >> 10) & 0x1f;
    const f = h & 0x3ff;
    if (e === 0) return s * f * 5.9604644775390625e-8;
    if (e === 31) return f ? NaN : s * Infinity;
    return s * Math.pow(2, e - 15) * (1 + f / 1024);
  };
  const buf = new Uint16Array(4);
  b.renderer.readRenderTargetPixels(b.adapted, 0, b.adapted.height - 1, 1, 1, buf);
  return { adaptedLogL: half(buf[0]), params: b.exposureParams };
})()`;

let server = null;
let baseUrl = args.get('url');
if (!baseUrl) {
  server = await startServer(5202);
  baseUrl = server.url;
}
const browser = await launchBrowser();
const { page } = await openPage(browser, {
  viewport: { width: Number(args.get('w') || 1440), height: Number(args.get('h') || 810) },
  deviceScaleFactor: 1,
});

const record = { tag: TAG, shot, t: T, pin: PIN, stages: [] };

try {
  const url = new URL(baseUrl);
  for (const [k, v] of passParams) url.searchParams.set(k, v);
  url.searchParams.set('seed', args.get('seed') || '1337');
  url.searchParams.set('paused', '1');
  await page.goto(url.toString(), { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!window.__NOCTIS_HARNESS__, null, { timeout: 60000 });
  await page.evaluate(() => window.__NOCTIS_HARNESS__.ready);
  await page.evaluate(() => window.__NOCTIS_HARNESS__.takeOver());
  record.gpu = await readRendererString(page);
  if (wetArg != null) await page.evaluate((w) => window.__NOCTIS_HARNESS__.setWetness(w), wetArg);

  const stage = async (label) => {
    const s = await page.evaluate(PAGE_STATE);
    record.stages.push({ label, frame: s.frame, now: s.now });
    return s;
  };

  await stage('after boot');
  await page.evaluate(
    (s) => window.__NOCTIS_HARNESS__.setShotAt(s.pos, s.target, s.fov),
    { pos: shot.pos, target: shot.target, fov: shot.fov }
  );

  record.waits = [];
  let arrival = await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity(1800));
  record.waits.push(arrival);
  let waits = 1;
  while (waits < 4 && arrival.field && arrival.field.ready < arrival.field.slots) {
    arrival = await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity(1800));
    record.waits.push(arrival);
    waits++;
  }
  record.waitCount = waits;
  const afterWait = await stage('after waitForCity');
  record.frameAfterWait = afterWait.frame;

  /**
   * THE PIN. Both arms enter `setTimeOfDay` + `settle` at the same frame count
   * or the comparison is between two different amounts of simulated walking.
   * It REFUSES to go backwards rather than silently doing nothing: a pin below
   * the frame the city arrived at is a pin that cannot be honoured, and a
   * control that quietly did not run is worse than no control (CONTRACT §7.1).
   */
  if (PIN != null) {
    const gap = PIN - afterWait.frame;
    if (gap < 0) {
      throw new Error(
        `--pin=${PIN} is below the frame the city arrived at (${afterWait.frame}). ` +
        'Pick a pin above every arm\'s arrival frame.'
      );
    }
    if (gap > 0) await page.evaluate((n) => window.__NOCTIS_HARNESS__.step(n), gap);
    const pinned = await stage('after pin');
    record.pinnedTo = pinned.frame;
    if (pinned.frame !== PIN) throw new Error(`pin missed: asked ${PIN}, got ${pinned.frame}`);
  }

  /**
   * `--jitter=0` IS THE MECHANISM'S OWN CONTROL, and it is the second side of
   * the pin. If the difference between two capture frame counts is the TAA
   * sub-pixel offset, then taking the offset away must collapse every frame
   * count to ONE image; if something else is moving, it will not. `post.js`
   * offers this arm in as many words — *"the jitter off, the accumulation
   * still on"* — and `harness.setJitterScale` is how a tool reaches it.
   */
  if (args.has('jitter')) {
    const got = await page.evaluate((v) => window.__NOCTIS_HARNESS__.setJitterScale(v), Number(args.get('jitter')));
    record.jitterScale = got;
    if (got !== Number(args.get('jitter'))) throw new Error(`setJitterScale refused: asked ${args.get('jitter')}, got ${got}`);
  }

  await page.evaluate((tt) => window.__NOCTIS_HARNESS__.setTimeOfDay(tt), T);
  await stage('after setTimeOfDay');
  await page.evaluate(() => window.__NOCTIS_HARNESS__.settle(4));
  const final = await stage('after settle');

  record.state = final;
  record.info = await page.evaluate(() => window.__NOCTIS_HARNESS__.info());
  record.exposure = await page.evaluate(PAGE_EXPOSURE);

  if (SHOOT) {
    const info = record.info;
    record.png = path.join(
      OUT,
      `${shot.name}-${TAG}-t${String(T).replace('.', '_')}${info.wetness > 0 ? '-wet' : ''}.png`
    );
    await writeFile(record.png, await page.screenshot({ type: 'png' }));
  }
} finally {
  await browser.close();
  if (server) server.child.kill('SIGKILL');
}

const j = path.join(OUT, `stepprobe-${TAG}.json`);
await writeFile(j, JSON.stringify(record, null, 2));

const s = record.state;
console.log(`\nstepprobe  tag=${TAG}  ${record.gpu}`);
console.log(
  `  pose  [${shot.pos.map((v) => v.toFixed(1)).join(',')}] -> ` +
  `[${shot.target.map((v) => v.toFixed(1)).join(',')}]  fov ${shot.fov}`
);
for (const w of record.waits) {
  console.log(
    `  wait  frames ${String(w.frames).padStart(5)}  ${String(w.ms).padStart(8)} ms  ` +
    `field ${w.field ? `${w.field.ready}/${w.field.slots}` : '-'}  ` +
    `resident ${w.city ? w.city.resident : '-'}${w.timedOut ? `  TIMED OUT on ${w.timedOutOn}` : ''}`
  );
}
for (const st of record.stages) console.log(`  stage ${String(st.frame).padStart(6)}  now ${String(st.now).padStart(10)}  ${st.label}`);
console.log(
  `  FRAME AT CAPTURE ${s.frame}   now ${s.now} s   ` +
  `draws ${record.info.drawCalls}   tris ${Number(record.info.triangles).toLocaleString('en-US')}`
);
if (record.exposure) {
  console.log(`  EXPOSURE adaptedLogL ${record.exposure.adaptedLogL.toFixed(9)}`);
}
if (s.pedestrians) {
  const p = s.pedestrians;
  console.log(
    `  CROWD total ${p.total}/${p.allocated}  straightness ${p.straightness}  ` +
    `reseats ${p.reseats}  crossingsStarted ${p.crossingsStarted}  arrivals/min ${p.arrivalsPerMinute}`
  );
}
console.log(`  INSTANCED MESHES (${s.meshes.length}):`);
for (const m of s.meshes) {
  console.log(
    `    ${m.hash}  ${String(m.count).padStart(7)}/${String(m.capacity).padStart(7)}  ` +
    `[${m.sum.map((v) => String(v).padStart(14)).join(' ')}]  ${m.ped ? 'PED ' : '    '}${m.name}`
  );
}
console.log(`  written ${path.relative(ROOT, j)}${record.png ? ` and ${path.relative(ROOT, record.png)}` : ''}\n`);
