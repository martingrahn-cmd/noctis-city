/**
 * hud.js — the on-screen instrument panel. Session 20, item 6.
 *
 * THE OPERATOR ASKED FOR AN FPS METER. This project computes far more than that
 * and throws almost all of it at a console nobody has open: the river's
 * Cox–Munk figures, the headlamp's lux against the ambient, the gait's 4.5 mm
 * foot creep, the canyon field's 51% sky openness, §5.12's motion cutoffs, this
 * session's roof-sign bloom energy. An FPS meter is one number; the fourth
 * level below is all of them.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * TWO THINGS SEPARATE A HUD FROM A GOOD ONE, AND BOTH ARE STRUCTURAL.
 *
 * 1. IT SHOWS THE CEILING BESIDE THE VALUE AND COLOURS AGAINST IT.
 *    `11.8 / 12.5 ms` says more than `11.8`, and green/amber/red says it
 *    without arithmetic. The ceilings come from `HUD.budgets` in
 *    `constants.js`, which `perfcheck` asserts equals `tools/budget.json →
 *    ceilings` — see that constant's own note for why a checked copy beats
 *    both an unchecked one and a `fetch`.
 *
 * 2. IT DOES NOT LIE ABOUT ITSELF, AND THAT IS THE HARDER HALF.
 *
 *    - The frame time is measured around the **rAF callback** in `loop.js`,
 *      not around `ctx.render()`. A timer around the draw omits every
 *      `update()` in the frame — the traffic simulation, the streaming, the
 *      crowd, the chunk builder — which on this project is most of the CPU
 *      cost, and a HUD that reported it would disagree with `perfcheck` about
 *      the same machine.
 *    - The HUD's OWN cost is measured and subtracted. This panel writes DOM and
 *      strokes a canvas inside `update()`, which is inside the callback, so
 *      without the subtraction the number on screen would include the cost of
 *      putting it there. That is exactly what `filmshot` caught when a PNG
 *      readback landed inside the frame interval and the tool reported a PNG
 *      encoder as the renderer. `loop.reportOverhead(ms)` is the channel and
 *      the subtracted total is displayed, so the correction is visible rather
 *      than silent.
 *    - The GRAPH is the interval, not the callback, and it is the thing that
 *      shows a stutter. A smoothed number never does, and this project's whole
 *      story is the tail rather than the mean.
 *    - **IT WILL NOT COLOUR A NUMBER AGAINST A CEILING THAT NUMBER CANNOT
 *      EXPRESS — session 23, item 1.** The operator ran the live build in a
 *      browser and read `frame p50 16.7 / 12.5 ms` in red. 16.7 ms is 60 Hz:
 *      under vsync the interval is `max(work, T)` and cannot go below `T`
 *      however fast the city renders, so that cell was red for every possible
 *      state of the world and carried no information about any of them. A gate
 *      that cannot go green in the context it is displayed in teaches its
 *      reader to ignore it, which is CONTRACT §7's own concern applied to a
 *      panel instead of to a check — and §0 rule 5's remedy is NOT available
 *      here, because the ceiling is real: `perfcheck` measures it unlocked and
 *      12.5 does not move.
 *
 *      What moved is the READING. `detectVsyncLock` below decides from the
 *      delivered intervals whether the period is being set by a refresh, and
 *      `bandCensored` colours the cell against what a censored observation
 *      actually establishes. See `HUD.vsync` in `constants.js` for the
 *      arithmetic and for the three options this was chosen over.
 *    - **THE EXPOSURE IS THE ONE THING IT WILL NOT SHOW, AND IT SAYS SO.** The
 *      brief asks for exposure in EV. The measured EV lives in a 1×1 GPU target
 *      (CONTRACT §5.4: log-average down a chain, *no readback* — "it stalls the
 *      pipeline and would make the instrument the thing that blows the budget"),
 *      and a per-second `readRenderTargetPixels` would stall inside the frame
 *      this panel is measuring. So the panel prints the exposure LAW and its
 *      declared window, and a line saying where the measured number is and why
 *      it is not here. A HUD that quietly stalled the pipeline to fill a field
 *      would be the second requirement broken to satisfy the first.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IT IS NOT REGISTERED FOR ANY GATE. `?hud` follows `?player=1` exactly as the
 * map does, and `main.js` is where that is decided. Every gate therefore renders
 * the same `<body>` it has rendered for nineteen sessions: one canvas, no
 * overlay, nothing in `page.screenshot()` that the renderer did not draw. That
 * is `ui.js`'s argument and CONTRACT §11's, and it is what makes a DOM overlay
 * admissible at all in a project whose gates read pixels.
 */

import { HUD, EXPOSURE, CLUSTER, RENDER } from '../core/constants.js';

const CSS = `
#noctis-hud{position:fixed;left:12px;top:12px;z-index:11;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;
  color:#c8ced5;background:rgba(6,8,10,.72);border:1px solid #23282e;border-radius:4px;padding:8px 10px;
  white-space:pre;pointer-events:none;min-width:250px;max-width:560px}
#noctis-hud .k{color:#7d868f}
#noctis-hud .g{color:#7fd17f}
#noctis-hud .a{color:#e2c268}
#noctis-hud .r{color:#e8776b}
#noctis-hud .h{color:#e8eef4}
#noctis-hud canvas{display:block;margin:5px 0 3px;border:1px solid #23282e;background:#0a0c0e}
#noctis-hud .scroll{max-height:44vh;overflow:hidden;white-space:pre-wrap;color:#9aa3ac}
`;

const GRAPH_W = 236;
const GRAPH_H = 42;

/** Percentile of an unsorted copy. p in [0,1]. */
export function pct(arr, p) {
  if (!arr.length) return 0;
  const a = arr.slice().sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.max(0, Math.round(p * (a.length - 1))))];
}

/**
 * IS THE FRAME INTERVAL BEING SET BY A DISPLAY REFRESH RATHER THAN BY THE
 * WORK? See `HUD.vsync` in `constants.js` for why the question has to be
 * asked at all and for every number below.
 *
 * Returns `{ periodMs, hz, onGrid, duty }` or `null`. Three conditions, and
 * they are ordered cheapest-first:
 *
 *   1. enough samples to make a fraction a statistic
 *   2. QUANTISED — the intervals lie on integer multiples of a candidate
 *      period. This is what carries the claim: a lock drops a frame to
 *      exactly 2T, never to 1.3T.
 *   3. SLACK — the callback does not fill the period, so the period is not
 *      simply the work.
 *
 * THE PERIOD IS SEEDED FROM `p05` AND THEN RE-CENTRED, and the second half is
 * not tidiness — the first version of this shipped without it and reported a
 * 60 Hz display as **60.5 Hz**. `p05` is a LOW QUANTILE of the held cluster, so
 * it sits in that cluster's low tail and is biased down by about the
 * compositor's own jitter: 16.534 measured against 16.667 true, over intervals
 * built at exactly 1000/60 with ±0.15 ms of wobble. The seed is still the right
 * way IN — the minimum would let one early timestamp become T and push every
 * honest frame off the grid — but a seed is not an estimate. So T is the MEDIAN
 * of the frames the seed collects at `m = 1`, which is a central statistic of
 * the cluster rather than an edge of it, and it costs one pass.
 *
 * It matters twice. The displayed rate is the reader's whole check on this
 * detector's declared limit below, and "60.5 Hz" on a 60 Hz display invites
 * exactly the doubt the limit paragraph asks the reader to apply for real. And
 * the bias runs toward SHORTER periods, which is the direction that makes
 * `bandCensored` claim more: a period biased low can only move a cell toward
 * green. `tools/vsyncprobe.mjs` prints the recovered period beside the
 * constructed one for every case (CONTRACT §9 rule 2).
 *
 * ITS DECLARED LIMIT, because CONTRACT §7.7 says an instrument written to
 * detect a failure mode is where that mode hides. This cannot distinguish a
 * display lock from a machine that is steadily GPU-bound at the same period,
 * because `callback` stops when the rAF body returns and the GPU retires
 * after it. What it can do is PRINT THE PERIOD IT MEASURED, so a reader
 * looking at "locked 20.00 ms (50.0 Hz)" on a 60 Hz display knows within one
 * second that it is not a lock. A detector that silently picked one of the two
 * would be the thing this comment exists to prevent.
 */
export function detectVsyncLock(intervals, callbacks) {
  const n = intervals.length;
  if (n < HUD.vsync.minSamples) return null;
  const seed = pct(intervals, 0.05);
  if (!(seed > 0)) return null;

  // Re-centre: the median of the frames the seed collects at m = 1. See above
  // for why a low quantile is a way in and not an estimate.
  const held = intervals.filter((v) => Math.abs(v - seed) <= HUD.vsync.tolFrac * seed);
  if (!held.length) return null;
  const T = pct(held, 0.5);
  if (!(T > 0)) return null;

  const tol = HUD.vsync.tolFrac * T;
  let onGrid = 0;
  for (let i = 0; i < n; i++) {
    const m = Math.round(intervals[i] / T);
    if (m >= 1 && Math.abs(intervals[i] - m * T) <= tol) onGrid++;
  }
  const frac = onGrid / n;
  if (frac < HUD.vsync.lockedFraction) return null;

  const duty = pct(callbacks, 0.95) / T;
  if (duty > HUD.vsync.maxDutyFraction) return null;

  return { periodMs: T, hz: 1000 / T, onGrid: frac, duty };
}

/**
 * THE BAND OF A CENSORED READING. An interval of `m·T` under a lock says the
 * work lies in `((m-1)·T, m·T]` and says nothing finer, so a verdict against
 * `ceiling` is available exactly when that whole band is on one side of it.
 *
 * The `g` branch is not decoration and it is not unreachable: at a 120 Hz lock
 * T is 8.33, m = 1 bounds the work at 8.33 ms, and 8.33 is under the 12.5 ms
 * ceiling — so the same rule that prints neutral at 60 Hz prints GREEN at 120.
 * That is the demonstration that this reads a censored observation rather than
 * hiding an inconvenient one.
 */
export function bandCensored(value, periodMs, ceiling) {
  if (!(ceiling > 0) || !(periodMs > 0)) return 'h';
  const m = Math.max(1, Math.round(value / periodMs));
  if ((m - 1) * periodMs >= ceiling) return 'r';   // certainly over
  if (m * periodMs <= ceiling) return 'g';          // certainly under
  return 'h';                                       // the ceiling is inside the band
}

export function createHud(options = {}) {
  const loop = options.loop || null;

  let root = null;
  let body = null;
  let canvas = null;
  let g2 = null;
  let detach = null;
  let level = 1;
  /** Wall-clock ms this panel's own update cost, last frame. */
  let selfMs = 0;
  /** DOM is rebuilt at this rate, not every frame. See `update`. */
  let sinceRefresh = 1e9;

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  /**
   * GREEN / AMBER / RED AGAINST A CEILING, and the value is always printed with
   * the ceiling beside it. `HUD.amberFraction` is 0.90 and its derivation is in
   * `constants.js`: a 95% band would put amber inside this machine's own
   * run-to-run spread, and a colour that flickers on an unchanged machine is
   * CONTRACT §0 rule 6 with a colour instead of a verdict.
   */
  function band(value, ceiling) {
    if (!(ceiling > 0)) return 'h';
    if (value > ceiling) return 'r';
    if (value >= ceiling * HUD.amberFraction) return 'a';
    return 'g';
  }

  const cell = (value, ceiling, unit = '', dp = 1) => {
    const v = typeof value === 'number' ? value.toFixed(dp) : String(value);
    const c = typeof ceiling === 'number' ? ceiling.toFixed(dp) : ceiling;
    return `<span class="${band(value, ceiling)}">${v} / ${c}${unit}</span>`;
  };

  const k = (s) => `<span class="k">${s}</span>`;

  /** `cell`, with the censoring rule in place of the direct comparison. */
  const cellCensored = (value, ceiling, periodMs, unit = '', dp = 1) =>
    `<span class="${bandCensored(value, periodMs, ceiling)}">` +
    `${value.toFixed(dp)} / ${ceiling.toFixed(dp)}${unit}</span>`;

  function drawGraph(intervals, targetMs, lock) {
    if (!g2) return;
    g2.clearRect(0, 0, GRAPH_W, GRAPH_H);
    /**
     * THE LAST SECOND, at whatever rate the frames actually arrived — the
     * sample count is derived from the delivered intervals rather than assumed
     * to be 60. A graph that always drew 60 columns would draw a second of a
     * machine running at 60 Hz and something else of a machine that is not, and
     * this panel exists for the second case.
     */
    let acc = 0;
    let from = intervals.length;
    while (from > 0 && acc < HUD.graphSeconds * 1000) {
      from--;
      acc += intervals[from];
    }
    const win = intervals.slice(from);
    if (!win.length) return;
    /**
     * THE REFERENCE LINE IS THE ONE THE BARS CAN ACTUALLY CROSS. Unlocked that
     * is the ceiling; under a lock it is the refresh period, because under a
     * lock EVERY bar clears 12.5 ms and a graph whose every column is red shows
     * a person nothing. What a locked graph can still show is the DROPPED FRAME
     * — a bar at 2T where its neighbours are at T — and that is the stutter this
     * graph was built for.
     */
    const ref = lock ? lock.periodMs : targetMs;
    /**
     * The vertical scale is TWICE the reference, fixed. An autoscaled graph
     * rescales when the thing it is showing gets worse, so a stutter and a
     * calm second look identical — which is the one failure a stutter graph
     * cannot have. It also puts a dropped frame at exactly full height under a
     * lock, since a dropped frame IS 2T.
     */
    const top = ref * 2;
    g2.strokeStyle = '#3a4048';
    g2.beginPath();
    const yc = GRAPH_H - (ref / top) * GRAPH_H;
    g2.moveTo(0, yc + 0.5);
    g2.lineTo(GRAPH_W, yc + 0.5);
    g2.stroke();

    /**
     * AMBER IS SUPPRESSED UNDER A LOCK, and it is the same defect as the
     * headline's one level down: a held frame is `T`, `HUD.amberFraction` is
     * 0.90, and `16.7 >= 0.9 · 16.7` is true — so every correctly delivered
     * frame would paint amber. A quantised signal has no "approaching": it
     * either holds the refresh or it misses it.
     */
    const miss = ref * (1 + (lock ? HUD.vsync.tolFrac : 0));
    const bw = Math.max(1, GRAPH_W / win.length);
    for (let i = 0; i < win.length; i++) {
      const v = win[i];
      const h = Math.max(1, Math.min(GRAPH_H, (v / top) * GRAPH_H));
      g2.fillStyle = v > miss ? '#e8776b'
        : (!lock && v >= ref * HUD.amberFraction) ? '#e2c268' : '#5f8f5f';
      g2.fillRect(i * bw, GRAPH_H - h, Math.max(1, bw - 0.5), h);
    }
  }

  function renderMinimal(ctx, t) {
    const iv = t.intervals;
    const cb = t.callbacks;
    const p50 = pct(iv, 0.5);
    const p95 = pct(iv, 0.95);
    const cpu95 = pct(cb, 0.95);
    const fps = p50 > 0 ? 1000 / p50 : 0;
    const W = HUD.budgets.wallFrameMsP95;
    const C = HUD.budgets.cpuFrameMsP95;
    const lock = detectVsyncLock(iv, cb);
    drawGraph(iv, W, lock);

    /**
     * THE FRAME LINE, AND WHICH NUMBER IS THE HEADLINE. Unlocked, the interval
     * is the ceiling's own quantity and leads. Locked, the interval is a
     * censored reading of it and the CPU p95 is the one number on this panel
     * that still carries information about the city — so it moves up, and the
     * line below says why in the panel rather than in a session log.
     */
    const frameLine = lock
      ? `${k('frame  p50')} ${cellCensored(p50, W, lock.periodMs, ' ms')}` +
        `   ${k('p95')} ${cellCensored(p95, W, lock.periodMs, ' ms')}`
      : `${k('frame  p50')} ${cell(p50, W, ' ms')}   ${k('p95')} ${cell(p95, W, ' ms')}`;

    const lines = [frameLine];
    if (lock) {
      /**
       * WHAT THE LOCK ESTABLISHES, not a fixed sentence about it. "the ceiling
       * is unreadable here" is true at 60 Hz and FALSE at 120, where a held
       * 8.33 ms lock proves the work is under 12.5 — and a panel that said the
       * same thing at both would be making the mistake this whole change is
       * about one level up. The band is read off `bandCensored`, which is the
       * function that coloured the cell, so the words and the colour cannot
       * disagree.
       */
      const b = bandCensored(p50, lock.periodMs, W);
      const says = b === 'g' ? `work <= ${lock.periodMs.toFixed(2)} <= ${W} ms, ceiling MET`
        : b === 'r' ? `frames are being dropped, so work > ${lock.periodMs.toFixed(2)} ms`
          : `work <= ${lock.periodMs.toFixed(2)} ms; ${W} is inside that band, no verdict`;
      lines.push(
        `${k('       ')} <span class="a">vsync-locked ${lock.periodMs.toFixed(2)} ms ` +
        `(${lock.hz.toFixed(1)} Hz)</span> ${k(`- ${says}`)}`
      );
    }
    lines.push(
      `${k('cpu    p95')} ${cell(cpu95, C, ' ms')}   ${k('fps')} <span class="h">${fps.toFixed(0)}</span>` +
        `   ${k('n')} ${iv.length}` + (lock ? `   ${k('(the number that reads)')}` : '')
    );
    lines.push(
      `${k('hud    own')} ${selfMs.toFixed(2)} ms subtracted  ${k('(run)')} ${(t.overheadTotalMs / 1000).toFixed(2)} s`
    );
    return lines.join('\n');
  }

  function renderRender(ctx) {
    const info = ctx.renderer.info;
    const lights = ctx.get('lights');
    const post = ctx.get('post');
    const city = ctx.get('city');
    const canyon = ctx.get('canyon');
    let instances = 0;
    ctx.scene.traverse((o) => { if (o.isInstancedMesh) instances += o.count; });
    const targetMB = post && post.targetBytes
      ? (post.targetBytes() + (lights && lights.bytes ? lights.bytes() : 0)) / 1048576 : 0;
    const chunkMB = ((city ? city.bytes : 0) +
      (canyon && canyon.fieldBytes ? canyon.fieldBytes() : 0)) / 1048576;
    const inte = post && post.internalSize ? post.internalSize : null;
    const gl = ctx.renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'renderer string withheld';
    const lit = lights ? lights.lightCount : 0;
    return [
      `${k('draws  ')} ${cell(info.render.calls, HUD.budgets.drawCalls, '', 0)}` +
        `   ${k('programs')} <span class="h">${info.programs ? info.programs.length : 0}</span>`,
      `${k('tris   ')} ${cell(info.render.triangles / 1e6, HUD.budgets.triangles / 1e6, ' M', 2)}` +
        `   ${k('instances')} <span class="h">${instances}</span>`,
      `${k('lights ')} ${cell(lit, CLUSTER.maxLights, ' clustered', 0)}` +
        `   ${k('peak froxel')} <span class="h">${lights ? lights.peakOccupancy : '—'}` +
        `/${lights && lights.clusterConfig ? lights.clusterConfig().maxPerCluster : '—'}</span>`,
      `${k('target ')} ${cell(targetMB, HUD.budgets.textureMemoryMB, ' MB')}` +
        `   ${k('chunks')} ${cell(chunkMB, HUD.budgets.chunkMemoryMB, ' MB')}`,
      `${k('render ')} <span class="h">${inte ? `${inte.width}x${inte.height}` : '—'}</span> internal` +
        ` → ${ctx.renderer.domElement.width}x${ctx.renderer.domElement.height} buffer` +
        ` (${RENDER.pixels.toLocaleString('en')} px budgeted)`,
      `${k('gpu    ')} ${esc(gpu)}`,
    ].join('\n');
  }

  function renderWorld(ctx) {
    const time = ctx.get('time');
    const city = ctx.get('city');
    const canyon = ctx.get('canyon');
    const traffic = ctx.get('traffic');
    const sl = ctx.get('streetlife');
    const weather = ctx.get('weather');
    const lights = ctx.get('lights');
    const air = ctx.get('aircraft');
    const cam = ctx.camera;
    const e = cam.matrixWorld.elements;
    // Heading off the camera's own basis rather than off a stored yaw, the same
    // way `ui.js`'s map arrow is: a stored yaw is a second copy of a quantity.
    const headingDeg = (Math.atan2(-e[8], -e[10]) * 180) / Math.PI;
    const compass = ((headingDeg + 360) % 360).toFixed(0);
    const cs = city ? city.stats() : null;
    const fs = canyon && canyon.streamStats ? canyon.streamStats() : null;
    const ts = traffic ? traffic.stats() : null;
    const ps = sl && sl.pedestrianStats ? sl.pedestrianStats() : null;
    const ws = weather && weather.particleStats ? weather.particleStats() : null;
    const as = air ? air.stats() : null;
    return [
      `${k('at     ')} <span class="h">${cam.position.x.toFixed(1)}, ${cam.position.y.toFixed(2)}, ` +
        `${cam.position.z.toFixed(1)}</span>   ${k('heading')} ${compass}° (0=N)   ${k('fov')} ${cam.fov.toFixed(0)}°`,
      `${k('clock  ')} <span class="h">${time ? time.clockString() : '—'}</span>  t=` +
        `${time ? time.timeOfDay.toFixed(4) : '—'}   ${k('sun')} ` +
        `${time ? ((time.sun.elevationRad * 180) / Math.PI).toFixed(1) : '—'}°`,
      /**
       * The exposure, and the missing field is named rather than left blank.
       * See this file's header: §5.4 forbids the readback that would fill it.
       */
      `${k('exposure')} anchor ${EXPOSURE.anchorEV} EV, adapt ${EXPOSURE.adaptStrength}, ` +
        `clamp [${EXPOSURE.minEV}, ${EXPOSURE.maxEV}] EV`,
      `         <span class="k">measured EV is a 1x1 GPU target — §5.4 forbids the readback that would print it</span>`,
      `${k('chunks ')} <span class="h">${cs ? cs.resident : '—'}</span> resident, ` +
        `${cs ? cs.bytesMB : '—'} MB   ${k('field')} ${fs ? `${fs.ready}/${fs.slots} ready, ` +
        `${fs.queued} queued, ${fs.inFlight} in flight` : '—'}`,
      `${k('traffic')} <span class="h">${ts ? ts.vehicles : '—'}</span> in ring, ` +
        `${ts ? ts.litVehicles : '—'} lit   ${k('crowd')} <span class="h">${ps ? ps.total : '—'}</span>` +
        `   ${k('roof signs')} <span class="h">${cs && cs.roofSigns ? cs.roofSigns.faces : '—'}</span>`,
      `${k('weather')} rain ${ws ? ws.rainfall.toFixed(2) : '—'} mm/h, wetness ` +
        `${lights ? lights.getWetness().toFixed(2) : '—'}, visibility ` +
        `${ws ? ws.visibilityM.toFixed(0) : '—'} m   ${k('lamps')} ` +
        `${ctx.get('lighting') ? (ctx.get('lighting').photocellOn ? 'on' : 'off') : '—'}`,
      `${k('air    ')} ${as ? `${as.count} airframes, ${as.suppressedByThreshold} past the §5.12 cutoff ` +
        `(${as.bodyCutoffM} m), searchlight ${as.searchlightOn ? `on, ${as.searchTargetM} m slant` : 'off'}` : '—'}`,
    ].join('\n');
  }

  function renderDerivations(ctx) {
    const lines = ctx.logLines || [];
    return `<div class="scroll">${esc(lines.join('\n'))}</div>`;
  }

  return {
    name: 'hud',

    init(ctx) {
      if (typeof document === 'undefined') return {};

      const style = document.createElement('style');
      style.textContent = CSS;
      document.head.appendChild(style);

      root = document.createElement('div');
      root.id = 'noctis-hud';
      body = document.createElement('div');
      canvas = document.createElement('canvas');
      canvas.width = GRAPH_W;
      canvas.height = GRAPH_H;
      g2 = canvas.getContext('2d');
      const head = document.createElement('div');
      head.className = 'k';
      head.textContent = 'H — cycle';
      root.appendChild(head);
      root.appendChild(canvas);
      root.appendChild(body);
      document.body.appendChild(root);

      const onKey = (ev) => {
        if (ev.code !== 'KeyH') return;
        level = (level + 1) % HUD.levels.length;
        root.style.display = HUD.levels[level] === 'off' ? 'none' : '';
        sinceRefresh = 1e9;
      };
      window.addEventListener('keydown', onKey);
      detach = () => window.removeEventListener('keydown', onKey);

      ctx.log(
        `hud: H cycles ${HUD.levels.join(' → ')}. Frame time is measured around the rAF CALLBACK in ` +
        'loop.js (not around the draw), and this panel\'s own cost is measured and subtracted — ' +
        'otherwise the meter measures the meter.'
      );

      return {
        level: () => HUD.levels[level],
        setLevel: (name) => {
          const i = HUD.levels.indexOf(name);
          if (i >= 0) level = i;
          root.style.display = HUD.levels[level] === 'off' ? 'none' : '';
          return HUD.levels[level];
        },
        /** For a probe: what the panel would print, without the markup. */
        text: () => body.textContent,
      };
    },

    update(ctx, dt) {
      if (!root || HUD.levels[level] === 'off') return;
      const t0 = performance.now();

      /**
       * SIX HZ, NOT SIXTY. A DOM write and a canvas stroke every frame is real
       * cost on the very number this is showing, and a value that changes sixty
       * times a second is unreadable anyway — which is the argument `main.js`'s
       * original 200 ms `setInterval` HUD already made, kept, and moved inside
       * the frame so the cost is attributable instead of landing wherever the
       * timer fired.
       */
      sinceRefresh += dt;
      if (sinceRefresh < 1 / 6) {
        // Still declare the (near-zero) cost: an instrument that reports its
        // overhead only on the frames it is expensive under-reports itself.
        if (loop) loop.reportOverhead(performance.now() - t0);
        return;
      }
      sinceRefresh = 0;

      const t = loop ? loop.timing() : { intervals: [], callbacks: [], overheadTotalMs: 0 };
      const name = HUD.levels[level];
      let html = '';
      if (name === 'minimal') html = renderMinimal(ctx, t);
      else if (name === 'render') {
        html = `${renderMinimal(ctx, t)}\n${k('─'.repeat(52))}\n${renderRender(ctx)}`;
      } else if (name === 'world') {
        html = `${renderMinimal(ctx, t)}\n${k('─'.repeat(52))}\n${renderWorld(ctx)}`;
      } else {
        html = `${renderMinimal(ctx, t)}\n${k('─'.repeat(52))}\n${renderDerivations(ctx)}`;
      }
      body.innerHTML = html;
      canvas.style.display = '';

      selfMs = performance.now() - t0;
      if (loop) loop.reportOverhead(selfMs);
    },

    dispose() {
      if (detach) detach();
      detach = null;
      if (root && root.parentNode) root.parentNode.removeChild(root);
      root = null;
      body = null;
      canvas = null;
      g2 = null;
    },
  };
}
