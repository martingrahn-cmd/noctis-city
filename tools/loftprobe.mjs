#!/usr/bin/env node
/**
 * loftprobe.mjs — NOT A GATE.
 *
 *   node tools/loftprobe.mjs --b=/path/to/traffic-before.js
 *   node tools/loftprobe.mjs --b=... --route=downtown_dense --arms=8 --frames=1800
 *
 * THE QUESTION. `night_rain` and `downtown_dense` each clear their 12.5 ms wall
 * ceiling by exactly 0.20 ms (STATE §5). That is the whole performance reserve
 * on two of three routes, and CONTRACT §0 rule 6 says a difference smaller than
 * the instrument's own drift is not a measurement. So any content change that
 * lands on those routes has to be measured as a DIFFERENCE inside one run
 * rather than as two absolutes from two runs — session 4b's one sequential
 * bisect measured REMOVING a whole subsystem as 1.3 ms slower than leaving it
 * in, which is what a drifting machine does to a pair of absolutes.
 *
 * WHAT THE ARMS ARE, AND WHY THEY ARE FILES. `trafficprobe.mjs` can switch its
 * arms with a query parameter because `?traffic=0` is a switch main.js already
 * owns. There is no query parameter for "the vehicle bodies as they were before
 * this session", and adding one would mean carrying the previous geometry in
 * the shipped module for ever — dead content that no frame draws, which is
 * CONTRACT §9.1's own failure class. So the arm here is the SOURCE FILE: this
 * probe copies one of two files over `src/modules/traffic.js` between arms and
 * lets vite serve it. Both paths are given on the command line and neither is
 * baked in, so nothing in the repository rots when the comparison is over.
 *
 * THE ARM FILE IS A SESSION ARTEFACT AND THE PROBE IS NOT. Whoever runs this
 * next supplies their own `--b`, from whatever the previous geometry was for
 * them. A frozen copy of a whole module living in `tools/` would be stale the
 * first time `src/core/**` moved under it, and it would be stale silently.
 *
 * ARMS ARE INTERLEAVED, A/B/A/B, WITH A FRESH PAGE PER ARM — the same regime
 * `perfcheck.measureRoute` measures in, and the reason is `uploadprobe.mjs`'s:
 * several arms inside one page re-streams the residency ring under the measured
 * window and measures a frame nobody ships.
 *
 * IT RESTORES THE ORIGINAL FILE ON EVERY EXIT PATH, including a throw and a
 * SIGINT, because a probe that leaves the source tree holding the wrong arm has
 * turned an instrument into a content change.
 */

import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { startServer, launchBrowser, openPage, readRendererString, rendererIsSoftware, ROOT } from './lib/page.mjs';

const BUDGET = JSON.parse(await readFile(new URL('./budget.json', import.meta.url), 'utf8'));

/**
 * SPLIT ON THE FIRST `=` ONLY. `split('=')` destructured into [k, v] silently
 * truncates a value that contains one, so `--aparams=fieldDrip=4` arrived as
 * `fieldDrip` with the 4 dropped — and the two param arms then compared equal
 * and the probe refused to run. It failed loudly, which is luck: the same
 * truncation on a path or a route would have measured the wrong thing quietly.
 */
const args = new Map(
  process.argv.slice(2).map((a) => {
    const s = a.replace(/^--/, '');
    const i = s.indexOf('=');
    return i < 0 ? [s, 'true'] : [s.slice(0, i), s.slice(i + 1)];
  })
);

const TARGET = path.join(ROOT, 'src', 'modules', 'traffic.js');
const ARM_A = args.get('a') ? path.resolve(args.get('a')) : TARGET;
const ARM_B = args.get('b') ? path.resolve(args.get('b')) : null;
const ROUTE = args.get('route') || 'night_rain';
const FRAMES = Number(args.get('frames') || BUDGET.capture.measureFrames);
const ARMS = Number(args.get('arms') || 6);
const CEILING = BUDGET.ceilings.wallFrameMsP95;
const CPU_CEILING = BUDGET.ceilings.cpuFrameMsP95;

/**
 * --trace — session 9c's attribution instrument. Chrome tracing around each
 * arm's measured window, written to tools/loft-out/, and a composition
 * analysis of the LONG animation-frame tasks against the normal ones. The
 * settle run measured s9's tail as evenly-spaced CPU-long frames at double
 * s8's rate with grime, GC and the per-frame code all exonerated; whatever
 * remains does not appear in this project's own numbers, so the next
 * instrument down is the browser's: the slices inside a long frame name the
 * subsystem. TRACING ADDS OVERHEAD — a traced arm's absolute numbers and
 * deltas are for composition only, and the probe says so when it runs.
 * Falsification, per CONTRACT §7.1: the trace's long-task count must
 * reproduce the same arm's far-frame count measured by the wall clock (two
 * instruments, one quantity), and a known-null arm pair must show matching
 * compositions.
 */
const TRACE = args.get('trace') === 'true';
const TRACE_DIR = path.join(ROOT, 'tools', 'loft-out');
// Driven over CDP with a modern traceConfig, and filtered WHILE STREAMING.
// Measured on this Chrome before believing any of it: 'toplevel' (and the
// timeline's own RunTask wrappers) emit ~1.5 MILLION scheduler ticks per
// 300-frame window — 1.44 GB per arm whatever else is set. The events the
// composition analysis reads (FunctionCall, MinorGC/MajorGC, GPU/layer
// work, and the >2 ms RunTask wrappers that ARE the frames) are a few MB;
// the stream filter in stopTrace keeps those and drops the tick flood.
// BOTH timeline categories: the base one carries FunctionCall, TimerFire,
// FireAnimationFrame and the GC events; the disabled-by-default one carries
// the frame/layer detail. The first readable run captured only the second
// and its composition was two commit slices and nothing else.
const TRACE_CATEGORIES = ['devtools.timeline', 'disabled-by-default-devtools.timeline'];
const TRACE_LONG_US = 13_000;
const TRACE_MAX_BYTES = 400 * 1024 * 1024;

/**
 * --glprof — the step past the trace. The trace put the whole far-frame
 * excess inside the rAF callback; this wraps the GL calls that can block
 * (perf-probe.enableGLProfile) and reports, per far frame, the time inside
 * GL and the single biggest call by name. Adds real overhead per call —
 * composition only, like --trace.
 */
const GLPROF = args.get('glprof') === 'true';
const GL_SLOW_MS = Number(args.get('slowms') || 1);

/**
 * --falsifycounts — the counter's own falsification, run BEFORE the counter
 * is believed (CONTRACT §7.1 for a probe: the case lives beside the thing it
 * falsifies). The staging-pool theory's confirming result is "equal call
 * counts in both arms" — which is exactly what a broken counter reports, so
 * the counter must first be shown to move. This mode boots ONE page on the
 * live arm (no --b), records a baseline window, then injects a KNOWN number
 * of texSubImage3D / bufferSubData calls through the SAME wrapped context on
 * KNOWN frames, and requires: the count moves by exactly the injected
 * number, on exactly the injected rows, and nowhere else — two-sided, per
 * §7.1, because a counter that reports everything would also pass a
 * one-sided check. Bytes and the slow-call counter are exercised too (one
 * deliberately large upload per 40 frames must trip slow>1ms).
 */
const FALSIFY_COUNTS = args.get('falsifycounts') === 'true';

/**
 * --aparams / --bparams — URL-PARAMETER ARMS, session 10.
 *
 *   node tools/loftprobe.mjs --aparams=fieldDrip=4 --bparams=fieldDrip=0
 *
 * The file-swap arms above exist because session 8's two lofts were two
 * different modules. A SCHEDULE is not: `?fieldDrip=` changes one integer in
 * one live file (CONTRACT §6), and swapping two copies of `canyon.js` that
 * differ in that integer is exactly the arrangement §9.1 warns about — two
 * files that have to be kept in step, where the failure mode is that they
 * drift and the probe measures the drift. Param arms also remove the vite
 * watcher from the loop entirely: no write, no reload broadcast, no stale
 * transform, and the arm is verified the same way it always was — off the
 * live module rather than off the file.
 *
 * Semicolon-separated `k=v`. Both sides are required together and they must
 * differ, for the same reason two byte-identical files are fatal below.
 */
const parseParams = (s) => {
  const out = new Map();
  if (!s || s === 'true') return out;
  for (const pair of s.split(';')) {
    if (!pair) continue;
    const [k, v = ''] = pair.split('=');
    out.set(k.trim(), v.trim());
  }
  return out;
};
const A_PARAMS = parseParams(args.get('aparams'));
const B_PARAMS = parseParams(args.get('bparams'));
const PARAM_ARMS = A_PARAMS.size > 0 || B_PARAMS.size > 0;
const paramLabel = (m) => [...m].map(([k, v]) => `${k}=${v}`).join('&') || '(defaults)';

if (PARAM_ARMS) {
  if (!A_PARAMS.size || !B_PARAMS.size) {
    console.error('loftprobe: --aparams and --bparams are required together.');
    process.exit(2);
  }
  if (paramLabel(A_PARAMS) === paramLabel(B_PARAMS)) {
    console.error('loftprobe: the two param arms are identical. A delta of zero would mean nothing.');
    process.exit(2);
  }
  if (args.get('b')) {
    console.error('loftprobe: --b and --bparams are different arm mechanisms; pass one or the other.');
    process.exit(2);
  }
}

if (!FALSIFY_COUNTS && !PARAM_ARMS && (!ARM_B || !existsSync(ARM_B))) {
  console.error(
    'loftprobe: --b=<path to the OTHER arm> is required and must exist.\n' +
    'Arm A defaults to the live src/modules/traffic.js. Two identical arms would\n' +
    'measure no effect and report it as a settlement, so this is fatal rather than\n' +
    'a warning.'
  );
  process.exit(2);
}

const sorted = (xs) => [...xs].filter(Number.isFinite).sort((a, b) => a - b);
const pct = (xs, p) => {
  const s = sorted(xs);
  return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : NaN;
};
const median = (xs) => {
  const s = sorted(xs);
  if (!s.length) return NaN;
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};
const spread = (xs) => (xs.length > 1 ? Math.max(...xs) - Math.min(...xs) : NaN);

/**
 * Chrome trace → the composition of LONG animation-frame tasks against the
 * composition of normal ones, on the renderer main thread. The mechanism of
 * an episodic slow frame is whatever slice class is present in the long
 * tasks and absent (or small) in the normal ones — reported as excess ms
 * per task so two arms with different long-task counts compare directly.
 */
function summarizeTrace(text) {
  const parsed = JSON.parse(text);
  const events = Array.isArray(parsed) ? parsed : parsed.traceEvents;

  // The renderer main thread: named CrRendererMain, and if several renderer
  // processes are alive (about:blank parking leaves husks), the one that did
  // the most timed work in this trace is the page that ran the route.
  const mains = new Map();
  for (const e of events) {
    if (e.ph === 'M' && e.name === 'thread_name' && e.args && e.args.name === 'CrRendererMain') {
      mains.set(`${e.pid}:${e.tid}`, 0);
    }
  }
  for (const e of events) {
    const key = `${e.pid}:${e.tid}`;
    if (e.ph === 'X' && mains.has(key)) mains.set(key, mains.get(key) + (e.dur || 0));
  }
  let mainKey = null;
  for (const [k, v] of mains) if (mainKey === null || v > mains.get(mainKey)) mainKey = k;
  if (mainKey === null) throw new Error('no CrRendererMain thread in trace');

  // Flatten this thread's events to closed slices: X directly, B/E paired.
  const slices = [];
  const beStack = [];
  const threadEvents = events
    .filter((e) => `${e.pid}:${e.tid}` === mainKey && (e.ph === 'X' || e.ph === 'B' || e.ph === 'E'))
    .sort((a, b) => a.ts - b.ts);
  for (const e of threadEvents) {
    if (e.ph === 'X') slices.push({ name: e.name, cat: e.cat || '', ts: e.ts, dur: e.dur || 0 });
    else if (e.ph === 'B') beStack.push(e);
    else if (e.ph === 'E' && beStack.length) {
      const b = beStack.pop();
      slices.push({ name: b.name, cat: b.cat || '', ts: b.ts, dur: e.ts - b.ts });
    }
  }
  slices.sort((a, b) => a.ts - b.ts);

  // Frame tasks: RunTask wrappers big enough to be a frame's work (the
  // stream filter already dropped the scheduler-tick RunTasks).
  const tasks = slices.filter((s) => s.name === 'RunTask' && s.dur > 2000);
  const long = tasks.filter((t) => t.dur > TRACE_LONG_US);
  const normal = tasks.filter((t) => t.dur <= TRACE_LONG_US);

  // Assign every non-wrapper slice to the task containing its start.
  const acc = new Map(); // name -> { longMs, longN, normMs, normN }
  let ti = 0;
  for (const s of slices) {
    if (s.name === 'RunTask') continue;
    while (ti < tasks.length && tasks[ti].ts + tasks[ti].dur <= s.ts) ti++;
    const t = tasks[ti];
    if (!t || s.ts < t.ts) continue;
    const isLong = t.dur > TRACE_LONG_US;
    let a = acc.get(s.name);
    if (!a) acc.set(s.name, (a = { longMs: 0, longN: 0, normMs: 0, normN: 0 }));
    if (isLong) { a.longMs += s.dur / 1000; a.longN++; }
    else { a.normMs += s.dur / 1000; a.normN++; }
  }

  const excess = [...acc.entries()]
    .map(([name, a]) => ({
      name,
      ...a,
      excessPerTask:
        (long.length ? a.longMs / long.length : 0) - (normal.length ? a.normMs / normal.length : 0),
    }))
    .sort((x, y) => y.excessPerTask - x.excessPerTask);

  return { nFrames: tasks.length, nLong: long.length, excess };
}

/**
 * THE TWO ARMS MUST DIFFER, AND THE CHECK IS ON THE BYTES RATHER THAN ON THE
 * PATHS. Two paths that resolve to the same content give a delta of zero and a
 * confident settlement of whatever was being asked — `trafficprobe`'s live-module
 * arm check, one level up.
 */
const original = await readFile(TARGET);
const bytesA = await readFile(ARM_A);
const bytesB = FALSIFY_COUNTS || PARAM_ARMS ? null : await readFile(ARM_B);
if (!FALSIFY_COUNTS && !PARAM_ARMS && bytesA.equals(bytesB)) {
  console.error('loftprobe: the two arms are byte-identical. A delta of zero would mean nothing.');
  process.exit(2);
}

let restored = false;
const restore = async () => {
  if (restored) return;
  restored = true;
  await writeFile(TARGET, original);
};
// TERM and HUP restore too, not only INT: the unattended wrapper's watchdog
// and a closed terminal deliver exactly those, and node's default for both
// skips the finally below. The refs exist so a signal also reaps the vite
// child and the browser — process.exit skips the finally, and an orphaned
// vite is exactly what the §0 bar's orphan check would then refuse past.
let serverRef = null;
let browserRef = null;
const bail = (code) => async () => {
  await restore();
  try { if (browserRef) await browserRef.close(); } catch { /* dying anyway */ }
  try { if (serverRef) serverRef.child.kill('SIGKILL'); } catch { /* dying anyway */ }
  process.exit(code);
};
process.on('SIGINT', bail(130));
process.on('SIGTERM', bail(143));
process.on('SIGHUP', bail(129));

const server = await startServer(5197);
serverRef = server;
const browser = await launchBrowser();
browserRef = browser;
const PAGE_OPTS = {
  viewport: { width: BUDGET.capture.viewport.width, height: BUDGET.capture.viewport.height },
  deviceScaleFactor: BUDGET.capture.viewport.dpr,
};
let { page } = await openPage(browser, PAGE_OPTS);

/**
 * THE ARM SWAP IS CONFIRMED BY CONTENT, NOT BY A TIMER AND NOT BY CHANGE
 * DETECTION — and a swap to bytes already on disk is not written at all.
 *
 * The five arm-boot deaths across two days ("Execution context was destroyed,
 * most likely because of a navigation", always at the first evaluate after a
 * boot or mid-route) were vite's own file watcher arriving LATE: writeFile
 * fires chokidar/fsevents on its own schedule — usually under a second,
 * multiple seconds under load — and when that event landed after the page had
 * navigated back and reconnected its HMR client, the full-reload broadcast
 * destroyed the context mid-measurement. A fixed settle is a guess about
 * watcher latency; two days of runs measured the guess at 1500 ms and wrong.
 *
 * Every real swap is stamped with a NONCE COMMENT and the module is fetched
 * from the dev server until the served body CONTAINS that nonce. vite serves
 * the stale transform until its watcher has invalidated the module graph, and
 * the full-reload broadcast happens in that same handler — while the page is
 * parked on about:blank with no HMR client connected to receive it. Served-
 * nonce therefore means THIS write's reload has already been broadcast to
 * nobody and none is pending for it. A changed-body poll is not enough: a
 * LATE event from the previous arm changes the body too and would confirm a
 * swap whose own event is still in flight — content, not change, is the test.
 * The nonce is a trailing comment: it never executes, the in-page fingerprint
 * reads the live module's own table, and restore() writes the untouched
 * original.
 *
 * Bytes already on disk are never rewritten (no write, no watcher event, no
 * reload — which is the arm-0 boot when --a is the live file; an mtime-only
 * change still broadcasts) EXCEPT when a retry demands a forced re-swap,
 * which re-stamps a fresh nonce precisely to regenerate the event.
 */
const MODULE_URL = new URL('/src/modules/traffic.js', server.url).toString();
const fetchServed = async () => {
  try {
    const res = await fetch(MODULE_URL);
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
};
let cleanOnDisk = original;
let nonceCounter = 0;
const setArm = async (bytes, label, force = false) => {
  if (!force && bytes.equals(cleanOnDisk)) return;
  const nonce = `noctis-loftprobe-swap-${++nonceCounter}`;
  await writeFile(TARGET, Buffer.concat([bytes, Buffer.from(`\n// ${nonce}\n`)]));
  cleanOnDisk = bytes;
  const deadline = Date.now() + 15_000;
  for (;;) {
    const now = await fetchServed();
    if (now !== null && now.includes(nonce)) break;
    if (Date.now() > deadline) {
      console.log(`  (${label}: vite did not serve nonce ${nonceCounter} inside 15 s — proceeding; the per-arm fingerprint check is the guard)`);
      break;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  await new Promise((r) => setTimeout(r, 300));
};

const urlFor = (extra) => {
  const u = new URL(server.url);
  for (const [k, v] of Object.entries(BUDGET.capture.params)) u.searchParams.set(k, String(v));
  u.searchParams.set('route', ROUTE);
  if (extra) for (const [k, v] of extra) u.searchParams.set(k, v);
  return u.toString();
};
const url = urlFor(null);

if (FALSIFY_COUNTS) {
  let failures = 0;
  const check = (label, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures++;
  };
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 90_000 });
    await page.waitForFunction(() => window.__APEX_HARNESS__ && window.__APEX_PROBE__, null, { timeout: 60_000 });
    await page.evaluate(() => window.__APEX_HARNESS__.ready);
    const gpu = await readRendererString(page);
    if (rendererIsSoftware(gpu)) throw new Error(`software renderer (${gpu})`);
    console.log(`GPU: ${gpu}`);
    console.log(`falsifying the glprof call counter (slow threshold ${GL_SLOW_MS} ms), camera parked, no route:`);
    const on = await page.evaluate((s) => window.__APEX_PROBE__.enableGLProfile(s), GL_SLOW_MS);
    check('enableGLProfile', on === true);

    // Window totals per key: [n, slow, ms, bytes] × keys, plus the raw rows.
    const runWindow = (frames) => page.evaluate(async (f) => {
      window.__APEX_PROBE__.startRecording();
      await window.__APEX_HARNESS__.step(f, 1 / 60);
      const gc = window.__APEX_PROBE__.report().glCounts;
      const sums = gc.keys.map((_, ki) => {
        const t = [0, 0, 0, 0];
        for (const row of gc.rows) for (let j = 0; j < 4; j++) t[j] += row[ki * 4 + j];
        return t;
      });
      return { keys: gc.keys, sums, rows: gc.rows };
    }, frames);

    // Baseline must be QUIET on texSubImage3D — with the camera parked the
    // residency ring is stable and nothing should upload a layer. Late field
    // bakes from boot can still be landing, so settle up to three times
    // rather than calling a late bake a broken counter.
    const WINDOW = 240;
    let c1 = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.evaluate(() => window.__APEX_HARNESS__.step(300, 1 / 60));
      c1 = await runWindow(WINDOW);
      const tex3 = c1.sums[0][0] + c1.sums[1][0] + c1.sums[2][0];
      if (tex3 === 0) break;
      console.log(`  (baseline window ${attempt} saw ${tex3} texSubImage3D calls — late bakes still landing, settling again)`);
      c1 = null;
    }
    if (!c1) throw new Error('baseline never went quiet on texSubImage3D — cannot falsify against a moving background');
    const KI = Object.fromEntries(c1.keys.map((k, i) => [k, i]));

    // The injector: known calls, on known frames, through the SAME wrapped
    // context three.js renders with. Bindings are saved and restored around
    // every injection so three's own state cache never sees the canaries.
    // COPY_WRITE_BUFFER for the buffer arm: a binding point three does not
    // track at all.
    await page.evaluate(() => {
      const ctx = window.__NOCTIS__.ctx;
      const gl = ctx.renderer.getContext();
      const texA = gl.createTexture();
      let prev = gl.getParameter(gl.TEXTURE_BINDING_2D_ARRAY);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, texA);
      gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, 4, 4, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, prev);
      const tex3 = gl.createTexture();
      prev = gl.getParameter(gl.TEXTURE_BINDING_3D);
      gl.bindTexture(gl.TEXTURE_3D, tex3);
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, 4, 4, 4, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindTexture(gl.TEXTURE_3D, prev);
      const buf = gl.createBuffer();
      prev = gl.getParameter(gl.COPY_WRITE_BUFFER_BINDING);
      gl.bindBuffer(gl.COPY_WRITE_BUFFER, buf);
      gl.bufferData(gl.COPY_WRITE_BUFFER, 48 * 1024 * 1024, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.COPY_WRITE_BUFFER, prev);
      const small = new Uint8Array(4 * 4 * 4);
      const smallBuf = new Uint8Array(4096);
      const big = new Uint8Array(48 * 1024 * 1024);
      const st = { frames: 0, arr: 0, t3: 0, sub: 0, subBytes: 0, big: 0, rowsHit: [], bigRows: [], off: null };
      window.__GLCF__ = st;
      st.off = ctx.on('beforeRender', () => {
        if (!window.__APEX_PROBE__.recording) return;
        const m = st.frames++;
        if (m % 10 === 3) {
          let p = gl.getParameter(gl.TEXTURE_BINDING_2D_ARRAY);
          gl.bindTexture(gl.TEXTURE_2D_ARRAY, texA);
          gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 0, 4, 4, 1, gl.RGBA, gl.UNSIGNED_BYTE, small);
          gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 1, 4, 4, 1, gl.RGBA, gl.UNSIGNED_BYTE, small);
          gl.bindTexture(gl.TEXTURE_2D_ARRAY, p);
          st.arr += 2;
          p = gl.getParameter(gl.TEXTURE_BINDING_3D);
          gl.bindTexture(gl.TEXTURE_3D, tex3);
          gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0, 4, 4, 4, gl.RGBA, gl.UNSIGNED_BYTE, small);
          gl.bindTexture(gl.TEXTURE_3D, p);
          st.t3 += 1;
          p = gl.getParameter(gl.COPY_WRITE_BUFFER_BINDING);
          gl.bindBuffer(gl.COPY_WRITE_BUFFER, buf);
          gl.bufferSubData(gl.COPY_WRITE_BUFFER, 0, smallBuf);
          gl.bindBuffer(gl.COPY_WRITE_BUFFER, p);
          st.sub += 1;
          st.subBytes += smallBuf.byteLength;
          st.rowsHit.push(m);
        }
        if (m % 40 === 7) {
          const p = gl.getParameter(gl.COPY_WRITE_BUFFER_BINDING);
          gl.bindBuffer(gl.COPY_WRITE_BUFFER, buf);
          gl.bufferSubData(gl.COPY_WRITE_BUFFER, 0, big);
          gl.bindBuffer(gl.COPY_WRITE_BUFFER, p);
          st.sub += 1;
          st.subBytes += big.byteLength;
          st.big += 1;
          st.bigRows.push(m);
        }
      });
    });
    const c2 = await runWindow(WINDOW);
    const st = await page.evaluate(() => {
      const s = window.__GLCF__;
      s.off();
      return { frames: s.frames, arr: s.arr, t3: s.t3, sub: s.sub, subBytes: s.subBytes, big: s.big, rowsHit: s.rowsHit, bigRows: s.bigRows };
    });

    const d = (key, slot) => c2.sums[KI[key]][slot] - c1.sums[KI[key]][slot];
    check(`texSub3D:array count moved by exactly the ${st.arr} injected`, d('texSub3D:array', 0) === st.arr,
      `baseline ${c1.sums[KI['texSub3D:array']][0]}, injected window ${c2.sums[KI['texSub3D:array']][0]}`);
    check(`texSub3D:3d count moved by exactly the ${st.t3} injected`, d('texSub3D:3d', 0) === st.t3,
      `baseline ${c1.sums[KI['texSub3D:3d']][0]}, injected window ${c2.sums[KI['texSub3D:3d']][0]}`);
    check(`bufferSubData count moved by exactly the ${st.sub} injected over the app's own steady rate`,
      d('bufferSubData', 0) === st.sub,
      `baseline ${c1.sums[KI.bufferSubData][0]}, injected window ${c2.sums[KI.bufferSubData][0]}, delta ${d('bufferSubData', 0)}`);
    check(`texSub3D:array bytes moved by exactly ${st.arr * 64} B (4×4×1 RGBA × ${st.arr})`, d('texSub3D:array', 3) === st.arr * 64,
      `delta ${d('texSub3D:array', 3)} B`);
    check(`bufferSubData bytes moved by exactly ${st.subBytes} B`, d('bufferSubData', 3) === st.subBytes,
      `delta ${d('bufferSubData', 3)} B`);
    /**
     * The slow counter is asserted WITHIN the injected window, per row, not
     * as a cross-window delta: a slow count is a timing event, and the
     * app's own steady uploads pick up machine-preemption slow calls at a
     * rate that varies between windows (the first run of this file asserted
     * the delta and measured the machine: −110). A 48 MB bufferSubData
     * cannot complete under 1 ms on any path, so its own row must carry a
     * slow call — that is a property of the counter, not of the window.
     */
    const bi = KI.bufferSubData * 4;
    const bigSlow = st.bigRows.filter((m) => ((c2.rows[m] || [])[bi + 1] || 0) >= 1).length;
    check(`every one of the ${st.big} big (48 MB) injection rows carries a slow bufferSubData call`, bigSlow === st.big,
      `${bigSlow}/${st.big} rows show one`);

    // Row attribution, two-sided: the injected rows and ONLY the injected
    // rows carry array-target calls. A counter with an off-by-one frame, or
    // one that smears counts across frames, fails here and nowhere else.
    const ai = KI['texSub3D:array'] * 4;
    const hit = new Set(st.rowsHit);
    let wrongRow = 0;
    c2.rows.forEach((row, fi) => {
      const want = hit.has(fi) ? 2 : 0;
      if ((row[ai] || 0) !== want) wrongRow++;
    });
    check(`array-target calls land on exactly the ${st.rowsHit.length} injected rows and nowhere else`, wrongRow === 0,
      `${wrongRow} rows disagree`);
    const arrSlow = d('texSub3D:array', 1);
    console.log(`  note: slow texSub3D:array delta ${arrSlow} (64 B uploads; expected 0 — nonzero here is machine preemption, not a counter defect)`);

    console.log(failures ? `\nFALSIFY-COUNTS: ${failures} FAILURE(S) — do not trust the counter` : '\nFALSIFY-COUNTS: all cases held');
  } finally {
    await restore();
    await browser.close().catch(() => {});
    server.child.kill('SIGKILL');
  }
  process.exit(failures ? 1 : 0);
}

const rows = [];
try {
  await setArm(bytesA, 'initial');
  await page.goto(url, { waitUntil: 'load', timeout: 90_000 });
  await page.waitForFunction(() => window.__APEX_HARNESS__ && window.__APEX_PROBE__, null, { timeout: 60_000 });
  const gpu = await readRendererString(page);
  if (rendererIsSoftware(gpu)) {
    throw new Error(`software renderer (${gpu}) — every number below would be of a rasteriser nobody ships`);
  }
  console.log(`GPU: ${gpu}`);
  if (PARAM_ARMS) {
    console.log(`arm A  ?${paramLabel(A_PARAMS)}   (one file: ${path.relative(ROOT, TARGET)} untouched)`);
    console.log(`arm B  ?${paramLabel(B_PARAMS)}`);
  } else {
    console.log(`arm A  ${path.relative(ROOT, ARM_A)}`);
    console.log(`arm B  ${ARM_B}`);
  }
  console.log(
    `route ${ROUTE}, ${ARMS} arms x ${FRAMES} frames, interleaved A/B, fresh page per arm, ` +
    `wall ceiling ${CEILING} ms, cpu ceiling ${CPU_CEILING} ms\n`
  );
  if (FRAMES !== BUDGET.capture.measureFrames) {
    console.log(
      `NOTE: the ${FRAMES}-frame window differs from the gate's ${BUDGET.capture.measureFrames} — the ceilings ` +
      'above were derived for the gate\'s window, so comparisons against them below are indicative only\n'
    );
  }

  /**
   * THE PAGE IS PARKED ON about:blank BEFORE THE FILE MOVES, AND THE FIRST
   * VERSION OF THIS WAS NOT. vite's HMR client is connected to the page, a
   * plain module with no accept handler is a FULL RELOAD, and a reload that
   * arrives while `page.evaluate` is running destroys the execution context
   * mid-measurement — which is what arm 1 did on the first run of this probe.
   * Parking disconnects the client, so the broadcast lands on nobody; setArm
   * (above) then holds the boot until vite has demonstrably re-served the
   * module, which is the moment the broadcast has already happened. The fixed
   * 1500 ms settle this replaces was a guess about watcher latency, and five
   * dead runs in two days measured the guess wrong.
   */
  let traceCdp = null;
  const startTrace = async () => {
    traceCdp = await page.context().newCDPSession(page);
    await traceCdp.send('Tracing.start', {
      transferMode: 'ReturnAsStream',
      traceConfig: {
        recordMode: 'recordUntilFull',
        includedCategories: TRACE_CATEGORIES,
        excludedCategories: ['*'],
      },
    });
  };
  const stopTrace = async (outPath) => {
    const done = new Promise((res) => traceCdp.once('Tracing.tracingComplete', res));
    await traceCdp.send('Tracing.end');
    const { stream } = await done;
    // The raw stream is line-per-event; filter as it arrives rather than
    // landing a gigabyte and filtering after. Kept: metadata lines (thread
    // names — the summariser needs CrRendererMain), every real timeline
    // event, and the RunTask wrappers big enough to be frames. Dropped: the
    // sub-2 ms RunTask scheduler ticks, which are 99% of the bytes.
    const kept = [];
    let rem = '';
    const keepIfEvent = (s) => {
      if (!s.startsWith('{') || !s.endsWith('}')) return;
      // Fast path for the tick flood: a SHORT line naming RunTask with a
      // small dur is a scheduler tick. Length-gated so the final flush —
      // a single ~60 KB blob of thousands of events with no newlines,
      // which also contains "RunTask" — cannot be rejected by its first
      // event's dur.
      if (s.length < 2000 && s.includes('RunTask"')) {
        const m = s.match(/"dur":(\d+)/);
        if (!m || Number(m[1]) < 2000) return;
      }
      let ev;
      try {
        ev = JSON.parse(s);
      } catch {
        const pieces = s.split(/(?<=\}),(?=\{)/);
        if (pieces.length > 1) for (const p of pieces) keepIfEvent(p.trim());
        return;
      }
      if (ev.ph !== 'M' && typeof ev.name === 'string' && ev.name.includes('RunTask') && (!ev.dur || ev.dur < 2000)) return;
      kept.push(s);
    };
    const consider = (line) => keepIfEvent(line.trim().replace(/,$/, ''));
    for (;;) {
      const { data, base64Encoded, eof } = await traceCdp.send('IO.read', { handle: stream, size: 1 << 20 });
      rem += base64Encoded ? Buffer.from(data, 'base64').toString('utf8') : data;
      const lines = rem.split('\n');
      rem = lines.pop();
      for (const l of lines) consider(l);
      if (eof) { consider(rem); break; }
    }
    await traceCdp.send('IO.close', { handle: stream }).catch(() => {});
    await traceCdp.detach().catch(() => {});
    traceCdp = null;
    await writeFile(outPath, `[${kept.join(',\n')}]`);
  };
  const abandonTrace = async () => {
    if (!traceCdp) return;
    await traceCdp.send('Tracing.end').catch(() => {});
    await traceCdp.detach().catch(() => {});
    traceCdp = null;
  };

  const expectedKey = {};
  let internalChecked = false;
  const measureArm = async (a, isA, forceSwap) => {
    await page.goto('about:blank', { waitUntil: 'load', timeout: 30_000 });
    if (!PARAM_ARMS) await setArm(isA ? bytesA : bytesB, `arm ${a}`, forceSwap);
    await page.goto(PARAM_ARMS ? urlFor(isA ? A_PARAMS : B_PARAMS) : url, { waitUntil: 'load', timeout: 90_000 });
    await page.waitForFunction(() => window.__APEX_HARNESS__ && window.__APEX_PROBE__, null, { timeout: 60_000 });
    await page.evaluate(() => window.__APEX_HARNESS__.ready);
    if (!internalChecked) {
      // perfcheck's own §5.10 assertion, carried here because a mismatch is
      // invisible in every number below: the ceilings are per-pixel budgets
      // against exactly this internal resolution.
      const internal = await page.evaluate(() => window.__APEX_HARNESS__.info().internal);
      const want = [BUDGET.capture.viewport.width, BUDGET.capture.viewport.height];
      if (!internal || internal[0] !== want[0] || internal[1] !== want[1]) {
        throw new Error(
          `internal render resolution is ${internal ? internal.join('×') : 'unknown'} but the budget's ` +
          `ceilings are derived at ${want.join('×')} — nothing measured here would be the gated quantity`
        );
      }
      internalChecked = true;
    }
    await page.evaluate(
      (n) => new Promise((res) => {
        let i = 0;
        const step = () => (++i >= n ? res() : requestAnimationFrame(step));
        requestAnimationFrame(step);
      }),
      BUDGET.capture.warmupFrames
    );

    /**
     * THE ARM IS VERIFIED AGAINST THE LIVE MODULE'S OWN TABLE, not against the
     * file that was written. vite serves from disk but it also caches, and a
     * page that reloaded before the write landed would give two identical arms
     * wearing different labels. The 7c version of this check used the instance
     * row count alone, which differed between its arms by construction — and
     * SESSION 8'S ARMS MATCH ON EVERY COUNT BY DESIGN (both are 14-row lofts;
     * zero delta in rows, draws and triangles is the session's own claim), so
     * a count can no longer distinguish a swapped arm from a cached one. The
     * fingerprint is therefore the pair (row count, type-0 length + min
     * extent): a failed swap agrees on all of them, a real geometry change
     * disagrees on at least one, and none can agree by accident.
     */
    const bodyRows = await page.evaluate(() => {
      const t = window.__NOCTIS__.ctx.get('traffic');
      const BT = t && t._internal && t._internal.BODY_TYPES;
      if (!BT) return null;
      let n = 0;
      let defs = '';
      window.__NOCTIS__.ctx.scene.traverse((o) => {
        if (o.isInstancedMesh && o.name === 'traffic:bodies') {
          n = o.instanceMatrix.count;
          // The body material's defines join the fingerprint: two arms that
          // differ ONLY in a shader define (the 9c grime bisect is exactly
          // that) are identical in rows and geometry, and a fingerprint
          // blind to defines would refuse to verify a swap that changed one.
          const d = o.material && o.material.defines;
          defs = d ? Object.keys(d).sort().map((k) => `${k}=${d[k]}`).join(',') : '';
        }
      });
      const dHash = defs.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0).toString(36);
      /**
       * The canyon's upload schedule joins the fingerprint — session 10, and
       * it is what makes a PARAM arm verifiable at all. Two param arms are
       * one file, so rows, geometry and defines are identical between them by
       * construction and the guard below would refuse to tell them apart. The
       * schedule is read off the LIVE module's own `streamStats`, which is the
       * same discipline as reading the body table rather than the file: it
       * says what the page is doing, not what was asked for.
       */
      const c = window.__NOCTIS__.ctx.get('canyon');
      const s = c && c.streamStats ? c.streamStats() : null;
      const drip = s && s.layersPerFrame !== undefined ? s.layersPerFrame : 'n/a';
      /**
       * The pedestrian population joins the fingerprint too, and for the same
       * reason the canyon's schedule does: an arm that removes a whole content
       * system through `?streetlife=0` leaves traffic's rows, geometry and
       * defines identical, so a fingerprint blind to it would refuse to verify
       * the swap it exists to verify. Read off the live scene, never off a
       * config the arm just set — a fingerprint that reads the URL confirms the
       * URL (§9.1).
       */
      let peds = 0;
      window.__NOCTIS__.ctx.scene.traverse((o) => {
        if (o.isInstancedMesh && o.name && o.name.startsWith('streetlife:body:')) {
          peds += o.instanceMatrix.count;
        }
      });
      return { perType: BT[0].boxes.length, meshRows: n, fp: `${BT[0].len}/${BT[0].min}/d${dHash}/drip${drip}/ped${peds}` };
    });
    if (!bodyRows || !bodyRows.meshRows) {
      throw new Error(`arm ${a}: traffic:bodies was not found in the live scene — the arm drew nothing`);
    }

    /**
     * EVERY ARM IS VERIFIED AGAINST ITS OWN POOL'S FIRST ARM, not only arm 0
     * against arm 1. The one-pair check this replaces was §9.1's advertised-
     * guarantee shape: both setArm fallbacks named "the fingerprint check" as
     * their backstop, and the check did not cover arms 2..n — a failed swap
     * on any later arm would have measured the wrong file undetected. A
     * mismatch against the arm's own pool is thrown as a RETRYABLE stale
     * swap: the file on disk is right and the served transform is stale, so
     * the cure is a forced re-stamp and a fresh boot, not an abort. On the
     * first arm of a pool, a fingerprint equal to the OTHER pool's is thrown
     * the same way — it is either a stale swap (retry cures it) or two arms
     * this guard cannot tell apart (retries exhaust and the run aborts,
     * which is right: an unverifiable swap must not be measured).
     */
    const key = `${bodyRows.meshRows}|${bodyRows.fp}`;
    const pool = isA ? 'A' : 'B';
    const other = isA ? 'B' : 'A';
    if (expectedKey[pool] === undefined) {
      if (expectedKey[other] !== undefined && expectedKey[other] === key) {
        const e = new Error(
          `arm ${a}: fingerprint ${key} equals pool ${other}'s — either the swap did not reach ` +
          'the page, or the two arms are indistinguishable by (rows, type-0) and cannot be verified'
        );
        e.staleSwap = true;
        throw e;
      }
      expectedKey[pool] = key;
    } else if (expectedKey[pool] !== key) {
      const e = new Error(
        `arm ${a}: fingerprint ${key} does not match pool ${pool}'s established ${expectedKey[pool]} — ` +
        'the swap did not reach the page (stale transform)'
      );
      e.staleSwap = true;
      throw e;
    }

    if (GLPROF) {
      const on = await page.evaluate((s) => window.__APEX_PROBE__.enableGLProfile(s), GL_SLOW_MS);
      if (!on) throw new Error('enableGLProfile returned false — the probe has no GL context to wrap');
    }
    let tracePath = null;
    if (TRACE) {
      await mkdir(TRACE_DIR, { recursive: true });
      // .trace, not .json: parsecheck censuses every tools/**/*.json, and a
      // half-written trace from a killed run must not turn a GATE red.
      tracePath = path.join(TRACE_DIR, `trace-arm${a}-${isA ? 'A' : 'B'}.trace`);
      await startTrace();
    }
    await page.evaluate(() => window.__APEX_PROBE__.startRecording());
    await page.evaluate(([r, f]) => window.__APEX_HARNESS__.runRoute(r, { frames: f }), [ROUTE, FRAMES]);
    const rep = await page.evaluate(() => window.__APEX_PROBE__.report());
    if (TRACE) await stopTrace(tracePath);

    const wall = rep.frames.wallMs.filter(Number.isFinite);
    /**
     * GC CORRELATION. A collection is a frame-to-frame heap DROP (Chrome's
     * performance.memory, sampled per frame by the probe since 9c). If the
     * far frames land on the drops, the tail is an allocation story and the
     * next question is who allocates; if they do not, it is a driver story.
     * ±2 frames of slack because heapBytes and wallMs are offset by one
     * frame and a collection's cost can land on the frame after the drop.
     */
    const FAR2 = CEILING + 2;
    const farIdx = [];
    wall.forEach((v, i) => { if (v > FAR2) farIdx.push(i); });
    const heap = rep.frames.heapBytes || [];
    const gcIdx = [];
    for (let i = 1; i < heap.length; i++) if (heap[i - 1] - heap[i] > 1_000_000) gcIdx.push(i);
    const gcSet = new Set();
    for (const g of gcIdx) for (let s = -2; s <= 2; s++) gcSet.add(g + s);
    const gcGaps = gcIdx.slice(1).map((v, i) => v - gcIdx[i]);
    // GL profile: wallMs[i] and glTotalMs[i] are the same frame (both begin
    // counting at the first recorded frame), so a far wall index reads its
    // own frame's GL numbers directly.
    let glLine = null;
    if (GLPROF && rep.frames.glTotalMs && rep.frames.glTotalMs.length) {
      const gt = rep.frames.glTotalMs;
      const gm = rep.frames.glMaxMs;
      const gn = rep.frames.glMaxName;
      const allMean = gt.reduce((s, v) => s + v, 0) / gt.length;
      const farMean = farIdx.reduce((s, i) => s + (gt[i] || 0), 0) / (farIdx.length || 1);
      const byName = new Map();
      for (const i of farIdx) {
        const k = gn[i] || '-';
        const e = byName.get(k) || { n: 0, ms: 0 };
        e.n++;
        e.ms += gm[i] || 0;
        byName.set(k, e);
      }
      const top = [...byName.entries()]
        .sort((x, y) => y[1].ms - x[1].ms)
        .slice(0, 3)
        .map(([k, v]) => `${k} x${v.n} (mean biggest call ${(v.ms / v.n).toFixed(2)}ms)`)
        .join(',  ');
      glLine =
        `    gl: far-frame mean ${farMean.toFixed(2)}ms inside GL vs all-frame mean ${allMean.toFixed(2)}ms; ` +
        `biggest call on far frames: ${top || 'none'}`;
    }
    /**
     * THE COUNTS — the session-9d readout. Per counted key: total calls,
     * frames carrying at least one, the cadence of those frames, slow calls
     * past the threshold, ms and bytes. Counts are integers off a fixed
     * route and do not drift (§9 rule 6 corollary), so equal-vs-unequal
     * across arms is decidable without a quiet machine; the slow-call RATE
     * is timing and reads like every other timing number here.
     *
     * The alignment check is the counter held against the OTHER half of the
     * same instrument: a far frame whose biggest call is texSubImage3D must
     * show >=1 texSubImage3D in its own count row (and a slow one when the
     * biggest call itself crossed the threshold). Misalignment means the
     * count rows are off by a frame and every per-frame claim below is
     * garbage — reported per arm rather than assumed away.
     */
    let glCountSummary = null;
    let glCountLines = [];
    if (GLPROF && rep.glCounts && rep.glCounts.rows.length) {
      const { keys, rows: crows, slowMs } = rep.glCounts;
      glCountSummary = keys.map((k, ki) => {
        let n = 0, slow = 0, ms = 0, bytes = 0;
        const withIdx = [];
        crows.forEach((row, fi) => {
          const o = ki * 4;
          if (row[o]) { n += row[o]; slow += row[o + 1]; ms += row[o + 2]; bytes += row[o + 3]; withIdx.push(fi); }
        });
        const gaps = withIdx.slice(1).map((v, i) => v - withIdx[i]);
        return { key: k, n, slow, ms, bytes, framesWith: withIdx.length, gapMedian: median(gaps) };
      });
      let misaligned = 0;
      let checked = 0;
      for (const i of farIdx) {
        if ((rep.frames.glMaxName[i] || '') !== 'texSubImage3D') continue;
        checked++;
        const row = crows[i] || [];
        const nHere = (row[0] || 0) + (row[4] || 0) + (row[8] || 0);
        const slowHere = (row[1] || 0) + (row[5] || 0) + (row[9] || 0);
        if (!nHere || (rep.frames.glMaxMs[i] > slowMs && !slowHere)) misaligned++;
      }
      const fmt = (s) =>
        `${s.key} ${s.n} calls` +
        (s.n
          ? ` (${s.framesWith} frames, gap med ${Number.isFinite(s.gapMedian) ? s.gapMedian : '-'}), ` +
            `slow>${slowMs}ms ${s.slow}, ${s.ms.toFixed(1)} ms, ${(s.bytes / 1e6).toFixed(1)} MB`
          : '');
      glCountLines.push(`    counts: ${glCountSummary.filter((s) => s.key.startsWith('texSub3D')).map(fmt).join(';  ')}`);
      glCountLines.push(`    counts: ${glCountSummary.filter((s) => !s.key.startsWith('texSub3D')).map(fmt).join(';  ')}`);
      glCountLines.push(
        `    count-alignment vs maxName: ${misaligned} mismatches on ${checked} texSubImage3D-topped far frames` +
        (misaligned ? ' — COUNT ROWS ARE OFF BY A FRAME, nothing per-frame below is trustworthy' : '')
      );
    }
    return {
      glCountSummary,
      glCountLines,
      glLine,
      gcCount: gcIdx.length,
      gcGapMedian: median(gcGaps),
      farAtGc: farIdx.filter((i) => gcSet.has(i)).length,
      arm: a,
      isA,
      cpuP50: median(rep.frames.cpuMs),
      cpuP95: pct(rep.frames.cpuMs, 95),
      cpuP99: pct(rep.frames.cpuMs, 99),
      cpuMax: Math.max(...rep.frames.cpuMs.filter(Number.isFinite)),
      wallP50: median(rep.frames.wallMs),
      wallP95: pct(rep.frames.wallMs, 95),
      wallP99: pct(rep.frames.wallMs, 99),
      wallMax: Math.max(...wall),
      // The tail's SHAPE, not only its quantiles: how many frames sit past
      // the ceiling at all, and how many are far past it. A few frames at
      // 2× the ceiling is an episodic spike (GC, upload, bake landing); the
      // same p95 from many frames just over it is a fattened shoulder —
      // different causes, different fixes, indistinguishable by p95 alone.
      wallOverCeil: wall.filter((v) => v > CEILING).length,
      wallFarOver: wall.filter((v) => v > CEILING + 2).length,
      // The far frames' RHYTHM, because a doubled count has two different
      // stories: twice as many events (median gap halves, few consecutive),
      // or the same events each spilling into a second frame (gap holds,
      // consecutive pairs appear). The arrays are already here; the two
      // numbers cost nothing and discriminate what a quantile cannot.
      ...(() => {
        const far = [];
        wall.forEach((v, i) => { if (v > CEILING + 2) far.push(i); });
        const gaps = far.slice(1).map((v, i) => v - far[i]);
        return {
          farGapMedian: median(gaps),
          farConsecutive: gaps.filter((g) => g === 1).length,
        };
      })(),
      frames: wall.length,
      draws: rep.peak.drawCalls,
      tris: rep.peak.triangles,
      bodyRows: bodyRows.meshRows,
      perType: bodyRows.perType,
      fp: bodyRows.fp,
      tracePath,
    };
  };

  /**
   * A FLAKE COSTS AN ATTEMPT, NOT THE SESSION. Two retries per arm, and only
   * on the transient class — a destroyed context, a closed target, a
   * navigation failure, a timeout. Anything else (an arm that drew nothing, a
   * software renderer) is a finding and still aborts the run. A retried
   * attempt is REPORTED, because a probe that hides its own failures is a
   * probe whose "6 clean arms" and "6 arms, 4 crashes" read identically.
   * The measurement itself is unaffected: an arm either completes its full
   * warmup + route on one page boot, or its partial numbers are discarded
   * with the attempt.
   */
  const RETRIES_PER_ARM = 3;
  const transient = (e) =>
    /Execution context was destroyed|Target page, context or browser has been closed|Target closed|Page crashed|Target crashed|page\.goto|frame was detached|Timeout \d+ms exceeded|net::ERR/i
      .test(String((e && e.message) || e));

  for (let a = 0; a < ARMS; a++) {
    const isA = a % 2 === 0;
    let row = null;
    for (let attempt = 0; ; attempt++) {
      try {
        // Any retry forces a re-stamped swap: harmless after a transient
        // failure, curative after a stale one.
        row = await measureArm(a, isA, attempt > 0);
        break;
      } catch (e) {
        const msg = String((e && e.message) || e).split('\n')[0];
        // A failed attempt may have left tracing running; a second start
        // would then fail every retry for a reason that is not the flake.
        if (TRACE) await abandonTrace();
        if (!(e.staleSwap || transient(e)) || attempt >= RETRIES_PER_ARM) throw e;
        console.log(`arm ${a} attempt ${attempt + 1} FAILED (${msg}) — retrying, ${RETRIES_PER_ARM - attempt} left`);
        if (page.isClosed()) ({ page } = await openPage(browser, PAGE_OPTS));
        // Let any in-flight reload storm settle before re-parking; the
        // observed second-attempt failure is the about:blank goto timing out
        // underneath one.
        await new Promise((res) => setTimeout(res, 2000));
      }
    }
    rows.push(row);
    const r = row;
    console.log(
      `arm ${a} ${isA ? 'A' : 'B'}  cpu p50 ${r.cpuP50.toFixed(2)}  cpu p95 ${r.cpuP95.toFixed(2)}  ` +
      `wall p50 ${r.wallP50.toFixed(2)}  wall p95 ${r.wallP95.toFixed(2)}  ` +
      `p99 ${r.wallP99.toFixed(2)}/${r.cpuP99.toFixed(2)}cpu  max ${r.wallMax.toFixed(2)}/${r.cpuMax.toFixed(2)}cpu  ` +
      `tail ${r.wallOverCeil}/${r.frames} over ${CEILING}, ${r.wallFarOver} past ${(CEILING + 2).toFixed(1)} ` +
      `(gap med ${Number.isFinite(r.farGapMedian) ? r.farGapMedian : '-'}, ${r.farConsecutive} consecutive)  ` +
      `gc ${r.gcCount} (gap med ${Number.isFinite(r.gcGapMedian) ? r.gcGapMedian : '-'}) far∩gc ${r.farAtGc}/${r.wallFarOver}  ` +
      `${r.draws} draws  ${(r.tris / 1e6).toFixed(3)}M tris  ${r.bodyRows} body rows  type0 ${r.fp}`
    );
    if (r.glLine) console.log(r.glLine);
    if (r.glCountLines) for (const l of r.glCountLines) console.log(l);
  }

  const A = rows.filter((r) => r.isA);
  const B = rows.filter((r) => !r.isA);
  // No post-hoc A[0]/B[0] fingerprint comparison here: the per-arm guard in
  // measureArm already threw before any unverifiable arm could be recorded,
  // and a check that cannot fire is §7.1's quiet gate wearing a belt.

  console.log('');
  const cmp = (k, label) => {
    const a = median(A.map((r) => r[k]));
    const b = median(B.map((r) => r[k]));
    console.log(
      `${label.padEnd(9)} A ${a.toFixed(2)} ms [${A.map((r) => r[k].toFixed(2)).join(' ')}] spread ${spread(A.map((r) => r[k])).toFixed(2)}   ` +
      `B ${b.toFixed(2)} ms [${B.map((r) => r[k].toFixed(2)).join(' ')}] spread ${spread(B.map((r) => r[k])).toFixed(2)}   ` +
      `A-B ${(a - b >= 0 ? '+' : '') + (a - b).toFixed(2)} ms`
    );
    return a - b;
  };
  const dWall = cmp('wallP95', 'wall p95');
  const dCpu = cmp('cpuP95', 'cpu p95');
  cmp('wallP50', 'wall p50');
  cmp('cpuP50', 'cpu p50');

  /**
   * THE PAIRED DELTA — the estimator this interleaved design actually
   * licenses, printed since the settle run had to compute it by hand.
   * Consecutive A/B arms share whatever the machine was doing in that
   * two-minute slot, so d_i = A_i − B_i cancels drift pair by pair; the SE
   * of mean d is the resolution ACHIEVED, not the resolution planned, and
   * it is the number to hold the wrapper header's arithmetic against. The
   * pool-median comparison above is kept because it is what the gate's own
   * estimator resembles; when the two disagree, the paired one is finer.
   */
  const nPairs = Math.min(A.length, B.length);
  if (nPairs >= 3) {
    for (const k of ['wallP95', 'cpuP95', 'wallP50']) {
      const d = [];
      for (let i = 0; i < nPairs; i++) d.push(A[i][k] - B[i][k]);
      const meanD = d.reduce((s, v) => s + v, 0) / d.length;
      const sd = Math.sqrt(d.reduce((s, v) => s + (v - meanD) ** 2, 0) / (d.length - 1));
      const se = sd / Math.sqrt(d.length);
      console.log(
        `paired ${k.padEnd(7)} A_i−B_i over ${d.length} pairs: mean ${(meanD >= 0 ? '+' : '') + meanD.toFixed(3)} ms, ` +
        `SD ${sd.toFixed(3)}, SE ${se.toFixed(3)}, |mean|/SE ${se > 0 ? (Math.abs(meanD) / se).toFixed(1) : 'inf'}, ` +
        `${d.filter((v) => v > 0).length}/${d.length} positive`
      );
    }
  }

  /**
   * THE COUNT VERDICT — the question this session's run exists to answer.
   * The staging-pool theory (STATE §2) predicts EQUAL texSubImage3D call
   * counts between the arms with a DOUBLED slow-call rate on the same
   * calls; UNEQUAL call counts falsify it. Counts are integers off a fixed
   * route (§9 rule 6 corollary): within a pool they should agree exactly
   * arm to arm, and a within-pool spread is itself a finding — it means
   * the upload schedule is not deterministic and "equal counts" has to be
   * read as a distribution rather than a number. The slow-call rate IS
   * timing: it reads under the same rules as every other timing number
   * here, and the paired structure is what makes the ratio usable.
   */
  if (GLPROF && A.length && B.length && A[0].glCountSummary && B[0].glCountSummary) {
    console.log('\nGL CALL COUNTS, per pool (equal counts + doubled slow rate proves the staging-pool theory; unequal counts kill it):');
    const keys = A[0].glCountSummary.map((s) => s.key);
    for (let ki = 0; ki < keys.length; ki++) {
      const an = A.map((r) => r.glCountSummary[ki].n);
      const bn = B.map((r) => r.glCountSummary[ki].n);
      if (!an.some((v) => v) && !bn.some((v) => v)) continue;
      const as = A.map((r) => r.glCountSummary[ki].slow);
      const bs = B.map((r) => r.glCountSummary[ki].slow);
      const aRate = as.reduce((s, v) => s + v, 0) / Math.max(1, an.reduce((s, v) => s + v, 0));
      const bRate = bs.reduce((s, v) => s + v, 0) / Math.max(1, bn.reduce((s, v) => s + v, 0));
      const aBytes = median(A.map((r) => r.glCountSummary[ki].bytes));
      const bBytes = median(B.map((r) => r.glCountSummary[ki].bytes));
      console.log(
        `${keys[ki].padEnd(14)} calls A [${an.join(' ')}] B [${bn.join(' ')}]   ` +
        `slow A [${as.join(' ')}] B [${bs.join(' ')}]   ` +
        `slow rate A ${(aRate * 100).toFixed(1)}% vs B ${(bRate * 100).toFixed(1)}%   ` +
        `bytes/arm A ${(aBytes / 1e6).toFixed(1)} MB vs B ${(bBytes / 1e6).toFixed(1)} MB`
      );
    }
    const gaps = (rs, ki) => rs.map((r) => r.glCountSummary[ki].gapMedian).filter(Number.isFinite);
    const kiArr = keys.indexOf('texSub3D:array');
    if (kiArr >= 0) {
      console.log(
        `texSub3D:array upload cadence, gap median per arm: A [${gaps(A, kiArr).join(' ')}] B [${gaps(B, kiArr).join(' ')}]`
      );
    }
    const mis = rows.reduce((s, r) => s + ((r.glCountLines || []).some((l) => l.includes('OFF BY A FRAME')) ? 1 : 0), 0);
    if (mis) console.log(`COUNT ALIGNMENT FAILED on ${mis} arm(s) — the per-frame attribution is broken; treat every count above as suspect`);
  }

  /**
   * THE DELTA AGAINST THE RESERVE, AND THE NOISE FLOOR PRINTED BESIDE IT.
   * §0 rule 6: a delta smaller than the per-arm spread is not a reading, and
   * saying so here is cheaper than a reader deciding it later.
   */
  const noise = Math.max(spread(A.map((r) => r.wallP95)), spread(B.map((r) => r.wallP95)));
  const triDelta = (median(A.map((r) => r.tris)) - median(B.map((r) => r.tris)));
  console.log(
    `\ntriangles A-B ${(triDelta / 1000).toFixed(1)}k, draws ${median(A.map((r) => r.draws))} vs ${median(B.map((r) => r.draws))}, ` +
    `body rows ${A[0].bodyRows} vs ${B[0].bodyRows}`
  );
  console.log(
    `wall delta ${(dWall >= 0 ? '+' : '') + dWall.toFixed(2)} ms against a per-arm spread of ` +
    `${Number.isFinite(noise) ? noise.toFixed(2) + ' ms' : 'n/a (one arm per side)'}; ` +
    `cpu delta ${(dCpu >= 0 ? '+' : '') + dCpu.toFixed(2)} ms`
  );
  if (!Number.isFinite(noise)) {
    console.log('one arm per side gives no noise floor — nothing above is a measurement (CONTRACT §0 rule 6)');
  } else if (Math.abs(dWall) < noise) {
    console.log('the delta is INSIDE the per-arm spread — it is a bound, not a measurement (CONTRACT §0 rule 6)');
  }

  /**
   * THE STRADDLE COUNT, for the verdict this probe exists to feed: a route
   * whose own variance straddles its ceiling shows arms on both sides of the
   * line in BOTH pools at a delta near zero. Per-arm wall p95 is the same
   * statistic the gate computes per run, so these counts are draws of the
   * ESTIMATOR'S INPUT — the quantity whose median-of-three is the gate's
   * verdict, not the verdict itself — printed per side with each pool's
   * range, both numbers, so nobody re-derives them from the rows above.
   * They are ABSOLUTES: unlike the interleaved delta they do not cancel
   * machine drift, so they are evidence only from a quiet machine, and the
   * drift check below is the run showing its own trend.
   */
  const rng = (rs, k) => `${Math.min(...rs.map((r) => r[k])).toFixed(2)}..${Math.max(...rs.map((r) => r[k])).toFixed(2)}`;
  const over = (rs, k, c) => rs.filter((r) => r[k] > c).length;
  console.log(
    `arms over the wall ceiling ${CEILING} ms: A ${over(A, 'wallP95', CEILING)}/${A.length} (range ${rng(A, 'wallP95')})   ` +
    `B ${over(B, 'wallP95', CEILING)}/${B.length} (range ${rng(B, 'wallP95')})`
  );
  console.log(
    `arms over the cpu ceiling ${CPU_CEILING} ms:  A ${over(A, 'cpuP95', CPU_CEILING)}/${A.length} (range ${rng(A, 'cpuP95')})   ` +
    `B ${over(B, 'cpuP95', CPU_CEILING)}/${B.length} (range ${rng(B, 'cpuP95')})`
  );
  if (A.length >= 4 && B.length >= 4) {
    const halves = (rs, k) => {
      const h = rs.length >> 1;
      return [median(rs.slice(0, h).map((r) => r[k])), median(rs.slice(h).map((r) => r[k]))];
    };
    const [a1, a2] = halves(A, 'wallP95');
    const [b1, b2] = halves(B, 'wallP95');
    console.log(
      `drift check, wall p95 first-half vs second-half median: ` +
      `A ${a1.toFixed(2)} -> ${a2.toFixed(2)} (${(a2 - a1 >= 0 ? '+' : '') + (a2 - a1).toFixed(2)})   ` +
      `B ${b1.toFixed(2)} -> ${b2.toFixed(2)} (${(b2 - b1 >= 0 ? '+' : '') + (b2 - b1).toFixed(2)}) — ` +
      'a shared trend here is the machine, and the over-ceiling counts above are not evidence if it is large'
    );
  }

  if (TRACE) {
    console.log(
      '\nTRACE COMPOSITION — slices inside LONG frame tasks (>13 ms) against normal ones, per arm.\n' +
      '(tracing adds overhead: composition only — never read a traced arm as a delta)'
    );
    for (const r of rows) {
      if (!r.tracePath) continue;
      let s;
      try {
        const { statSync } = await import('node:fs');
        const bytes = statSync(r.tracePath).size;
        if (bytes > TRACE_MAX_BYTES) {
          console.log(`arm ${r.arm}: trace is ${(bytes / 1e6).toFixed(0)} MB — too big to parse; narrow the categories`);
          continue;
        }
        s = summarizeTrace(await readFile(r.tracePath, 'utf8'));
      } catch (e) {
        console.log(`arm ${r.arm}: trace unreadable — ${String((e && e.message) || e).split('\n')[0]}`);
        continue;
      }
      console.log(
        `arm ${r.arm} ${r.isA ? 'A' : 'B'}  frame tasks ${s.nFrames}, long ${s.nLong} ` +
        `(wall clock counted ${r.wallFarOver} far frames — the instruments should roughly agree)`
      );
      for (const x of s.excess.slice(0, 8)) {
        console.log(
          `    ${x.name.slice(0, 46).padEnd(46)} long ${x.longMs.toFixed(1)}ms/${x.longN}   ` +
          `normal ${x.normMs.toFixed(1)}ms/${x.normN}   excess ${x.excessPerTask.toFixed(2)}ms/task`
        );
      }
    }
    console.log(`traces kept in ${path.relative(ROOT, TRACE_DIR)} — delete them when the question closes`);
  }
} finally {
  await restore();
  await browser.close().catch(() => {});
  server.child.kill('SIGKILL');
  console.log(`\n${path.relative(ROOT, TARGET)} restored to the arm it started as.`);
}
