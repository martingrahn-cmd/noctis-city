#!/usr/bin/env node
/**
 * perfcheck.mjs — the gate.
 *
 *   node tools/perfcheck.mjs                 # all routes, assert against budget
 *   node tools/perfcheck.mjs --route=night_rain
 *   node tools/perfcheck.mjs --json          # machine-readable, for the agent loop
 *
 * Exit code 0 = green, 1 = a budget violation, 2 = the harness itself failed.
 * The distinction matters: an agent that cannot tell "too slow" from "the
 * server wasn't running" will happily optimise a crash.
 *
 * Requires the game to expose, when loaded with ?perf=1:
 *   window.__APEX_HARNESS__ = {
 *     ready: Promise<void>,           // resolves once the world is streamed in
 *     runRoute(name): Promise<void>,  // deterministic scripted camera/vehicle path
 *     setRenderScale(n): void,
 *   }
 * and window.__APEX_PROBE__ from perf-probe.js.
 */

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { startServer } from './lib/page.mjs';
import { decodePNG, encodePNG } from './lib/png.mjs';
import { luma8 } from './lib/lookmetrics.mjs';
import {
  measureSilhouettes, chromaClusters, measureShapeControl, SHAPE_CONTROLS, WIDTH_CONTROLS,
  stepsToBoxes,
} from './lib/silhouette.mjs';
/**
 * THE RENDERER'S OWN COPY OF SIX CEILINGS — session 20, item 6.
 *
 * `src/core/constants.js` → `HUD.budgets` holds them because a module may not
 * import `tools/budget.json` (CONTRACT §2.2), and a second copy of a number is
 * §9.1's failure. So the gate reads both and asserts they agree. Importing a
 * `src/` file from a gate is not new — `lookat.mjs` imports `citygen.js` for
 * the same reason: the alternative is transcribing it.
 */
import { HUD } from '../src/core/constants.js';

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);

const BUDGET = JSON.parse(await readFile(new URL('./budget.json', import.meta.url), 'utf8'));
const JSON_OUT = args.has('json');

const log = (...m) => { if (!JSON_OUT) console.log(...m); };

function percentile(xs, p) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

/**
 * THE ESTIMATOR. `budget.json` → `capture.$estimator`, CONTRACT §0 rule 6.
 *
 * The median of a statistic taken over N independent runs of the same route.
 * Not the mean, and not the p95 of frames pooled across runs, and both of those
 * were considered:
 *
 * - THE MEAN would be tighter — 0.32 ms against 0.37 ms of standard error at
 *   the measured sigma of 0.55 ms — and it carries a drifted run at full
 *   weight. Drift on this machine is one-sided: session 4b's three baseline
 *   runs rose monotonically on all six series as the load average went 2.62 to
 *   2.95. A median of three discards exactly one contaminated observation,
 *   which is the contamination pattern actually observed, and 16% of efficiency
 *   is the price of that.
 *
 * - P95 OVER POOLED FRAMES is a different quantity, and that is the whole
 *   objection. `wallFrameMsP95` was derived against a SINGLE RUN's p95. The p95
 *   of frames pooled from three runs is the 95th percentile of a MIXTURE, whose
 *   value depends on how far the runs drifted apart and whose upper tail is
 *   filled preferentially by whichever run caught the load spike. Comparing it
 *   to a ceiling written for the per-run p95 is CONTRACT §9's shape exactly: a
 *   number computed correctly and then used as though it were a different
 *   quantity, with the same units and a plausible magnitude.
 *
 * The median of per-run p95s changes only the number of draws, not what is
 * being estimated. No ceiling moved.
 */
function median(xs) {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}

/** One run's frame-time statistics, before anything is pooled. */
function runStats(report) {
  const gpu = report.frames.gpuMs;
  const cpu = report.frames.cpuMs;
  const wall = report.frames.wallMs || [];
  const usingGpuTimers = report.method === 'gpu-timer-query' && gpu.length > 30;
  return {
    usingGpuTimers,
    gpuP95: usingGpuTimers ? percentile(gpu, 95) : null,
    gpuMax: usingGpuTimers ? Math.max(...gpu) : null,
    cpuP95: percentile(cpu, 95),
    wallP95: wall.length > 30 ? percentile(wall, 95) : null,
    wallMax: wall.length > 30 ? Math.max(...wall) : null,
    longFrames: cpu.filter((m) => m > 33.3).length,
  };
}

/**
 * Pool per-run statistics into the numbers the ceilings are compared against.
 *
 * TIMING BY MEDIAN. COUNTS BY WORST CASE, and the asymmetry is deliberate:
 * §9 rule 6's corollary is that counts do not drift — froxel occupancy,
 * instance counts, draw calls and index writes are integers and are
 * reproducible under load — so there is nothing for a median to average away,
 * and taking the worst of three is strictly stricter than taking one. A pooled
 * estimator must never be a way of making a gate easier.
 */
function poolRuns(stats) {
  const pick = (k) => stats.map((s) => s[k]);
  return {
    runs: stats.length,
    usingGpuTimers: stats.some((s) => s.usingGpuTimers),
    gpuP95: median(pick('gpuP95')),
    gpuMax: median(pick('gpuMax')),
    cpuP95: median(pick('cpuP95')),
    wallP95: median(pick('wallP95')),
    wallMax: median(pick('wallMax')),
    longFrames: median(pick('longFrames')),
    perRun: {
      cpuP95: pick('cpuP95').map((v) => (v == null ? null : +v.toFixed(2))),
      wallP95: pick('wallP95').map((v) => (v == null ? null : +v.toFixed(2))),
    },
    /**
     * The spread the runs actually showed, printed beside the estimate. It is
     * the instrument's resolution measured on the same machine at the same
     * moment as the thing being measured, and without it "11.70 against 12.5"
     * is a number with no error bar — which is the state that produced a red
     * gate on a 0.10 ms breach against a 0.40 to 0.80 ms noise floor.
     */
    wallSpread: (() => {
      const v = pick('wallP95').filter((x) => Number.isFinite(x));
      return v.length > 1 ? +(Math.max(...v) - Math.min(...v)).toFixed(2) : null;
    })(),
    cpuSpread: (() => {
      const v = pick('cpuP95').filter((x) => Number.isFinite(x));
      return v.length > 1 ? +(Math.max(...v) - Math.min(...v)).toFixed(2) : null;
    })(),
  };
}

/**
 * Set once the gate has brought up its own vite. `budget.json` still records the
 * canonical url for a human running the route by hand; the gate does not depend
 * on somebody having started a server first, because a gate that only runs when
 * you remember to do something else is a gate that stops being run.
 */
let SERVER_URL = null;

function buildUrl(extra = {}) {
  const url = new URL(SERVER_URL || BUDGET.capture.url);
  for (const [k, v] of Object.entries({ ...BUDGET.capture.params, ...extra })) {
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

const SOFTWARE_RENDERERS = ['swiftshader', 'llvmpipe', 'software', 'lavapipe'];

async function launch() {
  return chromium.launch({
    // Without this, Playwright launches chrome-headless-shell, which has no GPU
    // and quietly renders through SwiftShader. Every measurement would then be
    // of a software rasteriser rather than of this machine.
    channel: 'chromium',
    headless: true,
    args: [
      // Metal-backed GPU rather than the software rasteriser. Without this the
      // numbers are meaningless — SwiftShader will fail every budget you set.
      '--use-angle=metal',
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--enable-webgl-draft-extensions', // timer queries
      '--disable-frame-rate-limit',      // otherwise vsync hides all headroom
      '--disable-gpu-vsync',
      '--force-device-scale-factor=' + BUDGET.capture.viewport.dpr,
    ],
  });
}

async function measureRoute(page, route, { renderScale = 1, silhouettes: wantSilhouettes = true } = {}) {
  await page.goto(buildUrl({ route }), { waitUntil: 'load', timeout: 90_000 });

  await page.waitForFunction(
    () => window.__APEX_HARNESS__ && window.__APEX_PROBE__,
    null,
    { timeout: 60_000 }
  );
  await page.evaluate(() => window.__APEX_HARNESS__.ready);

  if (renderScale !== 1) {
    await page.evaluate((s) => window.__APEX_HARNESS__.setRenderScale(s), renderScale);
  }

  // Warmup exists to get shader compilation and texture uploads out of the
  // measured window. A cold first frame can be 200ms; including it would let
  // the agent "fix" the p95 by making the run longer.
  await page.evaluate(
    (n) => new Promise((res) => {
      let i = 0;
      const step = () => (++i >= n ? res() : requestAnimationFrame(step));
      requestAnimationFrame(step);
    }),
    BUDGET.capture.warmupFrames
  );

  // The gate must measure what is actually rendered. Since session 4 the
  // internal render resolution is fixed and is NOT the drawing buffer
  // (CONTRACT §5.10), so this is checked rather than assumed — a per-pixel
  // budget measured against a different pixel count is not a budget, and the
  // failure would be completely invisible in every number below.
  const geometry = await page.evaluate(() => window.__APEX_HARNESS__.info());
  const want = BUDGET.capture.viewport;
  const got = geometry.internal;
  if (renderScale === 1 && (!got || got[0] !== want.width || got[1] !== want.height)) {
    throw new Error(
      `internal render resolution is ${got ? got.join('×') : 'unknown'} but ` +
      `budget.capture.viewport says ${want.width}×${want.height}. The gate would be ` +
      `measuring a different number of pixels from the one the budget is written against.`
    );
  }

  await page.evaluate(() => window.__APEX_PROBE__.startRecording());
  /**
   * PER-ROUTE MEASUREMENT WINDOW — session 17, and it is a capture parameter
   * rather than a threshold. `budget.json` → `capture.$framesByRoute` carries
   * the arithmetic: `floors.metresTravelled` is a DISTANCE and `measureFrames`
   * is a TIME, and the two are only consistent above 4.0 m/s. A route walked at
   * 1.40 m/s covers 42 m in the shared window and would be rejected for being
   * walked. Lengthening the window is the direction that makes the gate
   * stricter; lowering the floor for one route is CONTRACT §0 rule 5.
   */
  const byRoute = BUDGET.capture.framesByRoute || {};
  const frameCount = byRoute[route] != null ? byRoute[route] : BUDGET.capture.measureFrames;
  const routeInfo = await page.evaluate(
    ([r, frames]) => window.__APEX_HARNESS__.runRoute(r, { frames }),
    [route, frameCount]
  );

  const report = await page.evaluate(() => window.__APEX_PROBE__.report());
  const memory = await page.evaluate(() => {
    const i = window.__APEX_HARNESS__.info();
    return { targetMemoryMB: i.targetMemoryMB, chunkMemoryMB: i.chunkMemoryMB, internal: i.internal };
  });
  // Read off the live scene, after the route, never off a config. See
  // harness.particleLayers() and the §9 entry it exists for.
  const particles = await page.evaluate(() =>
    (window.__APEX_HARNESS__.particleLayers ? window.__APEX_HARNESS__.particleLayers() : null)
  );
  // The three instruments session 4b added, all of them descriptions of the
  // world rather than changes to it, which is what CONTRACT §8 allows a gate
  // to read.
  const motion = await page.evaluate(() =>
    (window.__APEX_HARNESS__.instanceMotionStats ? window.__APEX_HARNESS__.instanceMotionStats() : null)
  );
  const roles = await page.evaluate(() =>
    (window.__APEX_HARNESS__.lightRoleCensus ? window.__APEX_HARNESS__.lightRoleCensus() : null)
  );
  const traffic = await page.evaluate(() =>
    (window.__APEX_HARNESS__.trafficStats ? window.__APEX_HARNESS__.trafficStats() : null)
  );
  /**
   * THE WEATHER AT THE END OF THE ROUTE — session 44, and it asserts nothing.
   *
   * `rainfall` became a state driven by `time.now` this session, so EVERY
   * threshold in this file now depends on the route finishing inside the
   * cycle's dry stretch. That dependency is real, it is 872 simulated seconds
   * wide, and until this line nothing printed it — which is CONTRACT §7.1's
   * own shape: a check gone quiet is indistinguishable from one that passed.
   * `nextShowerS` and the layers' active counts are the two numbers that say
   * whether a route rained, and they now appear beside every measurement made
   * during it.
   */
  const weather = await page.evaluate(() =>
    (window.__APEX_HARNESS__.weatherStats ? window.__APEX_HARNESS__.weatherStats() : null)
  );
  /**
   * ═══════════════════════════════════════════════════════════════════════
   * AND THE FRAME IS SETTLED — SESSION 77. THIS WAS THE LAST CAPTURE PATH IN
   * THE PROJECT WITHOUT A `settle()`.
   * ═══════════════════════════════════════════════════════════════════════
   *
   * WHAT IT WAS CAPTURING. `waitForCity` polls a worker in blocks of ten
   * frames, so the frame index at capture is a wall-clock race — session 70
   * measured 2 808 to 3 038 over 35 runs of ONE source. `post.frameIndex`
   * drives an 8-sample Halton jitter, so the shot landed on whichever of eight
   * sub-pixel offsets the machine's milliseconds chose, and session 70
   * measured the eight phases of one unmodified source as differing pairwise
   * by **57 801 to 78 979 bytes of 3 499 200**. On top of that the TAA history
   * was an 1 800-frame MOVING-camera accumulation and the exposure meter was
   * wherever its 1.9 s time constant had got to.
   *
   * `settle()` pins all three: it pads to jitter residue 0, drops the history,
   * snaps the meter eight times, runs `TAA.settleFrames` = 32 static frames and
   * snaps again. That is what put ten pins and three unpinned races of
   * `viaduct-under` on ONE md5 in session 70.
   *
   * IT IS PLACED HERE, AFTER `report()` AND EVERY OTHER READ, AND THAT
   * PLACEMENT IS THE WHOLE OF WHY IT IS SAFE. Every millisecond, every draw
   * call, every triangle and every census on this route has already been read
   * into a variable by the line above. Nothing this does can move one of them
   * — and `highway_speed`'s 404 of 440 is four sessions old and is the number
   * this project compares everything against. The frame is a picture of the
   * route's end state 47 frames later, at rest; the timings are of the route.
   * They describe the same content and not the same instant, and saying so is
   * cheaper than pretending a moving capture was ever a still one.
   *
   * THE COST, BEFORE THE DECISION AND NOT AFTER IT (item 1a): `settle(4)`
   * renders `pad + 8 + 32 + 4` = 44 to 51 frames, mean 47.5. Twelve route
   * captures plus nine silhouette poses is 21 settles ≈ 1 000 frames, and at
   * the 13-26 ms this machine delivers that is **18-26 s on a gate that takes
   * 1 135** — under 2%.
   */
  await page.evaluate(() => window.__APEX_HARNESS__.settle(4));
  const shot = await page.screenshot({ type: 'png' });

  /**
   * THE SILHOUETTE MEASUREMENT, POOLED OVER SEVERAL POSES OF THIS ROUTE.
   *
   * TAKEN AFTER `report()`, so nothing here is inside the measured window and
   * no frame-time number moves because of it.
   *
   * WHY EACH SCREENSHOT AND ITS POLYGONS DESCRIBE THE SAME FRAME. `step()`
   * calls `loop.takeOver()`, so the rAF loop has been suspended since the first
   * frame of the route and the camera does not move between the last step and
   * the read. If the loop were free-running the polygons would belong to a
   * frame some unknown number of milliseconds after the pixels — which is why
   * `silhouettes()` reports the size it projected into and `measureSilhouettes`
   * refuses to proceed when it disagrees with the PNG.
   */
  const silhSamples = [];
  let paletteRaw = null;
  if (wantSilhouettes && BUDGET.silhouettes && BUDGET.silhouettes.routes.includes(route)) {
    for (const u of BUDGET.silhouettes.poses) {
      await page.evaluate(
        ([r, uu, f]) => window.__APEX_HARNESS__.poseRoute(r, uu, f),
        [route, u, BUDGET.silhouettes.poseFrames]
      );
      const poseShot = await page.screenshot({ type: 'png' });
      /**
       * The roofline sampling grid is passed IN rather than read by the
       * harness, so `budget.json` stays the one place the numbers live. The
       * harness is an instrument and an instrument that carried its own
       * thresholds would be a second copy of them (§9.1).
       */
      const silh = await page.evaluate(
        (o) => (window.__APEX_HARNESS__.silhouettes ? window.__APEX_HARNESS__.silhouettes(o) : null),
        {
          stations: BUDGET.silhouettes.stations,
          subSamples: BUDGET.silhouettes.subSamples,
          trim: BUDGET.silhouettes.trim,
          overshoot: BUDGET.silhouettes.overshoot,
          // §7.5. Passed IN for the same reason the four above are: an instrument
          // that held its own thresholds would be a second copy of them.
          latOvershoot: BUDGET.silhouettes.latOvershoot,
          latHeight: BUDGET.silhouettes.latHeight,
        }
      );
      silhSamples.push({ u, shot: poseShot, silh });
    }
    paletteRaw = await page.evaluate(() =>
      (window.__APEX_HARNESS__.instanceColourPalette ? window.__APEX_HARNESS__.instanceColourPalette() : null)
    );
  }
  const silhouettes = wantSilhouettes ? summariseSilhouettes(route, silhSamples, paletteRaw) : null;

  // A software-rendered run is not a slow run, it is a meaningless one. Fail as
  // a harness error (exit 2) so nobody — human or agent — reads it as a budget
  // violation and starts "optimising" against a rasteriser that isn't the target.
  const rs = String(report.rendererString || '').toLowerCase();
  if (SOFTWARE_RENDERERS.some((s) => rs.includes(s))) {
    throw new Error(
      `software renderer detected ("${report.rendererString}") — ` +
      `measurements are meaningless. Check that chromium.launch uses channel:'chromium' ` +
      `and that --use-angle=metal is being honoured.`
    );
  }

  return { route, report, shot, memory, routeInfo, particles, weather, motion, roles, traffic, silhouettes, silhSamples, paletteRaw };
}

/**
 * Decode the shot and measure the polygons against it. Kept out of
 * `assertRoute` on purpose: `--falsify` drives `assertRoute` with a synthetic
 * fixture, and a fixture that had to carry a 2560x1440 PNG would be a fixture
 * nobody maintains. What the assertion consumes is the SUMMARY, so that is what
 * the fixture supplies.
 *
 * Returns `null` for a route the block does not cover, which is not the same as
 * a failure and is not the same as a missing instrument — `assertSilhouettes`
 * distinguishes all three.
 */
function summariseSilhouettes(route, samples, palette) {
  const S = BUDGET.silhouettes;
  if (!S || !S.routes.includes(route)) return null;
  if (!samples.length || samples.some((s) => !s.silh)) {
    return { error: 'harness.silhouettes() is absent' };
  }

  const decoded = [];
  const problems = [];
  for (const s of samples) {
    try {
      decoded.push({ silh: s.silh, png: decodePNG(Buffer.from(s.shot)) });
    } catch (e) {
      return { error: `a pose screenshot could not be decoded — ${e.message}` };
    }
    problems.push(...(s.silh.problems || []));
  }

  const out = measureSilhouettes(decoded, S);
  out.problems = problems;

  /**
   * The palette as WRITTEN, clustered by the same rule and the same epsilon as
   * the palette as DELIVERED. Same rule on purpose: two numbers compared to
   * each other have to have been computed the same way or the comparison is
   * measuring the method (CONTRACT §9 rule 2).
   */
  out.palette = {};
  if (palette) {
    const byKind = {};
    for (const bucket of Object.values(palette)) {
      (byKind[bucket.kind] = byKind[bucket.kind] || []).push(...bucket.colours);
    }
    for (const [kind, colours] of Object.entries(byKind)) {
      const chromas = colours.map(([r, g, b]) => {
        const s = r + g + b;
        return s > 1e-9 ? [r / s, b / s] : [1 / 3, 1 / 3];
      });
      out.palette[kind] = chromaClusters(chromas, S.chromaEpsilon);
    }
  }
  return out;
}

/**
 * The particle fill bound. `tools/budget.json` → `particles`.
 *
 * A PAIR, and the assertion is on the PRODUCT. A count cap alone is not a fill
 * bound: 700 unbounded additive billboards are 700 large billboards the moment
 * one drifts past the lens, and the count would be inside its cap the whole
 * time. So the count comes off the live scene (`instanceMatrix.count`) and the
 * area comes off the shader's own `#define`, and what is checked is
 * count × maxArea against a fraction of the frame.
 *
 * RED WHILE NOTHING DECLARES A LAYER, and that is deliberate. An empty scene
 * trivially satisfies every bound, so "no layers" would be a green that means
 * nothing — the state CONTRACT §10 step 3 and §6 both name: a check that did
 * not run is not a check that passed.
 */
function assertParticles(route, layers, budget, viewport) {
  const P = budget.particles;
  const fails = [];
  const framePx = viewport.width * viewport.height;

  if (!Array.isArray(layers)) {
    fails.push(`${route}: harness.particleLayers() is missing — the particle bound is unmeasurable`);
    return { fails, layers: [], fillPx: 0 };
  }
  if (layers.length === 0) {
    fails.push(
      `${route}: NO PARTICLE LAYER DECLARES ITSELF, so the ${P.maxInstances}-instance cap and the ` +
      `${P.maxAreaPx} px screen clamp are both unmeasured. This is UNRUN, not passed — an empty ` +
      `scene satisfies every fill bound. Session 4b makes it green by shipping rain inside it.`
    );
    return { fails, layers, fillPx: 0 };
  }

  /**
   * EVERY NAMED LAYER, AND NOT JUST SOME. Without this the pair-bound is
   * satisfied by shipping one layer of the three: a fill of 2.28% with two
   * systems missing is a green that means nothing, which is the same shape as
   * an empty scene satisfying every fill bound, one level up.
   */
  if (Array.isArray(P.requireLayers)) {
    const have = new Set(layers.map((l) => l.name));
    for (const want of P.requireLayers) {
      if (!have.has(want)) {
        fails.push(
          `${route}: particle layer '${want}' does not exist. The three layers are one bound with a ` +
          `shared diameter threshold (budget.json -> particles.$derivation_split); shipping a subset ` +
          `means one of them is depicting water another says is not there.`
        );
      }
    }
  }

  let total = 0;
  let fillPx = 0;
  for (const l of layers) {
    const cap = P.layerCaps && P.layerCaps[l.name];
    if (cap) {
      if (l.allocated > cap.maxInstances) {
        fails.push(`${route}: particle layer '${l.name}' allocated ${l.allocated} > ${cap.maxInstances}`);
      }
      const declared = l.declaredDefine != null ? Number(l.declaredDefine) : l.maxAreaPx;
      if (declared > cap.maxAreaPx) {
        fails.push(`${route}: particle layer '${l.name}' clamps at ${declared} px² > its own ${cap.maxAreaPx} px²`);
      }
    }
    total += l.allocated;
    if (P.requireClampIsCompileTime && !l.clampCompileTime) {
      fails.push(
        `${route}: particle layer '${l.name}' has no NOCTIS_PARTICLE_MAX_AREA_PX define — its screen ` +
        `clamp is not compile-time, so the fill it can produce is not a number anybody can budget`
      );
    }
    const area = l.declaredDefine != null ? Number(l.declaredDefine) : l.maxAreaPx;
    if (!(area > 0)) {
      fails.push(`${route}: particle layer '${l.name}' declares no maximum screen area`);
      continue;
    }
    if (area > P.maxAreaPx) {
      fails.push(`${route}: particle layer '${l.name}' clamps at ${area} px² > ${P.maxAreaPx} px²`);
    }
    fillPx += l.allocated * area;
  }
  if (total > P.maxInstances) {
    fails.push(`${route}: ${total} particle instances > ${P.maxInstances} (read from instanceMatrix.count)`);
  }
  const fill = fillPx / framePx;
  if (fill > P.maxFillFraction) {
    fails.push(
      `${route}: particle fill ${(fill * 100).toFixed(2)}% of the frame > ` +
      `${(P.maxFillFraction * 100).toFixed(1)}% — ${total} instances × their clamped area`
    );
  }
  return { fails, layers, fillPx, fill };
}

/**
 * The clustered grid, with the traffic pool saturated. `budget.json` →
 * `trafficLights`.
 *
 * `clusterOverflow` false over a grid with no traffic in it is a statement
 * about a grid holding 248 lights, and 4b ships against one holding 344. So the
 * assertion requires the pool to be saturated FIRST and fails as unrun when it
 * is not — which it is not today, because nothing in the world declares a light
 * with role 'traffic'. `tools/clustercheck.mjs` is the instrument that answers
 * the same question with placeholders; this is the gate that will answer it
 * about the real thing.
 *
 * The MARGIN is asserted and not only the boolean. `clusterOverflow: false` at
 * 96 of 96 and at 31 of 96 are the same boolean and completely different
 * findings, and only one of them says there is room for the next thing.
 */
function assertCluster(route, cluster, budget) {
  const T = budget.trafficLights;
  const fails = [];
  if (!cluster) {
    fails.push(`${route}: the route reported no cluster statistics — the grid is unmeasured`);
    return fails;
  }
  if (cluster.trafficLights < T.lights) {
    fails.push(
      `${route}: the traffic light pool is not saturated — ${cluster.trafficLights} of ${T.lights} ` +
      `lights declare role 'traffic'. The grid measured ${cluster.peakOccupancy} of ` +
      `${cluster.maxPerCluster} in its worst froxel WITHOUT them, which says nothing about the grid ` +
      `4b ships. UNRUN, not passed.`
    );
    return fails;
  }
  if (T.requireNoOverflow && cluster.overflow) {
    fails.push(
      `${route}: clustered lighting overflowed — worst froxel ${cluster.peakOccupancy} of ` +
      `${cluster.maxPerCluster}, ${cluster.clustersAtCap} froxels at the cap, ` +
      `${cluster.lightCount} of ${cluster.maxLights} in the pool`
    );
  }
  if (cluster.occupancyMargin < T.minOccupancyMargin) {
    fails.push(
      `${route}: worst froxel ${cluster.peakOccupancy} of ${cluster.maxPerCluster} leaves a margin of ` +
      `${cluster.occupancyMargin} < ${T.minOccupancyMargin}`
    );
  }
  return fails;
}

/**
 * Per-instance motion vectors and the swap discipline. `budget.json` →
 * `motionVectors`. CONTRACT §5.12.
 *
 * READ OFF THE CPU AND NOT OFF THE ATTACHMENT, deliberately. CONTRACT §8
 * forbids a gate from rendering through `showMotion`, because that makes the
 * gate's subject something the operator created; the pixels are
 * `tools/motioncheck.mjs`'s job and it is an instrument. What a gate can have
 * is the bookkeeping, and the bookkeeping is the half that goes quiet: a swap
 * that reads the buffer it just wrote produces a motion field of exact zeros,
 * which is pixel-for-pixel identical to not having built any of this.
 */
function assertMotion(route, motion, budget) {
  const M = budget.motionVectors;
  const fails = [];
  if (!M) return fails;
  if (!motion) {
    fails.push(`${route}: harness.instanceMotionStats() is missing — the swap discipline is unmeasurable`);
    return fails;
  }
  if (motion.layers.length < M.minDoubleBufferedLayers) {
    fails.push(
      `${route}: ${motion.layers.length} double-buffered instance layers < ${M.minDoubleBufferedLayers}. ` +
      `Zero layers satisfies maxSameFrameViolations trivially — UNRUN, not passed.`
    );
    return fails;
  }
  if (M.requireSwapDiscipline && motion.sameFrameViolations > M.maxSameFrameViolations) {
    fails.push(
      `${route}: ${motion.sameFrameViolations} same-frame buffer reads. The previous transform equalled ` +
      `the current one, so every motion vector was exactly zero and traffic aliased — a defect whose ` +
      `signature is identical to the absence of the feature. CONTRACT §5.12.`
    );
  }
  if (!(motion.reads > 0)) {
    fails.push(`${route}: no instance layer was read this route — the buffers exist and nothing binds them`);
  }
  if (motion.written < M.minWrittenVectors) {
    fails.push(
      `${route}: only ${motion.written} instances carried a real previous transform (min ${M.minWrittenVectors}); ` +
      `${motion.carried} were suppressed. A working swap over a population that never moves is the same zeros.`
    );
  }
  return fails;
}

/**
 * The clustered pool, by declared role. `budget.json` → `lightRoles`.
 *
 * Until this session `role` was a free-form tag with one consumer and every
 * shipping light left it null, so the world could not say who was holding the
 * pool. `unrolled` is the number that matters: a slot nobody is accountable for
 * is how a pool fills up with no name attached to the failure.
 */
/**
 * THE HUD'S COPY OF THE CEILINGS, AGAINST THE CEILINGS — session 20, item 6.
 *
 * `budget.json` → `hudBudgets` names which keys the copy is required to carry
 * and `src/core/constants.js` → `HUD.budgets` is the copy. The HUD colours a
 * number green, amber or red against these, so a drifted copy would put a green
 * reading on screen for a value this file calls a breach — a gate and an
 * instrument disagreeing about the same machine, which is exactly what CONTRACT
 * §9.1 says a comment claiming a check must name a file to prevent.
 *
 * ONE FAILURE SITE AND IT REPORTS EVERY MISMATCH, deliberately: a per-key push
 * would make one drifted table read as six independent findings, and the
 * §7.1 coverage denominator would grow by six for one case.
 */
function assertHudBudgets(hudTable, budget) {
  const fails = [];
  const keys = budget.hudBudgets || [];
  if (!keys.length || !hudTable) return fails;
  const bad = [];
  for (const key of keys) {
    const mine = hudTable[key];
    const theirs = budget.ceilings ? budget.ceilings[key] : undefined;
    if (mine !== theirs) bad.push(`${key}: HUD ${mine} vs budget ${theirs}`);
  }
  if (bad.length) {
    fails.push(
      `HUD.budgets disagrees with budget.json ceilings on ${bad.length} of ${keys.length} keys — ` +
      `${bad.join('; ')}. The HUD colours against its copy, so a drift puts a green number on screen ` +
      `for a value this gate calls a breach.`
    );
  }
  return fails;
}

function assertLightRoles(route, census, budget) {
  const R = budget.lightRoles;
  const fails = [];
  if (!R) return fails;
  if (!census) {
    fails.push(`${route}: harness.lightRoleCensus() is missing — the pool cannot say who is holding it`);
    return fails;
  }
  if (R.requireEveryLightHasARole && census.unrolled > (R.maxUnrolled || 0)) {
    fails.push(
      `${route}: ${census.unrolled} of ${census.total} clustered lights declare no role. A slot nobody is ` +
      `accountable for is the one the pool overflows on.`
    );
  }
  for (const [role, cap] of Object.entries(R.ceilings || {})) {
    const n = census.byRole[role] || 0;
    if (n > cap) fails.push(`${route}: ${n} lights with role '${role}' > ${cap}`);
  }
  for (const [role, floor] of Object.entries(R.floors || {})) {
    const n = census.byRole[role] || 0;
    if (n < floor) {
      fails.push(
        `${route}: only ${n} lights with role '${role}' < ${floor}. A role that stopped being created reads ` +
        `as excellent pool margin, which is why the floor is here.`
      );
    }
  }
  if (census.total > census.maxLights) {
    fails.push(`${route}: ${census.total} lights in a pool of ${census.maxLights}`);
  }
  return fails;
}

/** The shipped traffic content. `budget.json` → `trafficLights` content fields. */
function assertTrafficContent(route, traffic, budget) {
  const T = budget.trafficLights;
  const fails = [];
  if (T.contentVehicles == null) return fails;
  if (!traffic) {
    fails.push(`${route}: no traffic module reported — the content bound is unmeasured. UNRUN, not passed.`);
    return fails;
  }
  if (traffic.vehicles !== T.contentVehicles) {
    fails.push(`${route}: ${traffic.vehicles} vehicles, budget says ${T.contentVehicles}`);
  }
  if (T.contentHeadlamps != null && traffic.headlamps !== T.contentHeadlamps) {
    fails.push(`${route}: ${traffic.headlamps} headlamp slots, budget says ${T.contentHeadlamps}`);
  }
  /**
   * THE STOP LINE — session 21, and the instrument has existed since 19.
   * `worstStopLineM` is a signed clearance from a held vehicle's FRONT to its
   * own painted line; its sign is the verdict, so the floor is zero.
   */
  if (T.minStopLineM != null) {
    if (traffic.worstStopLineM == null || !isFinite(traffic.worstStopLineM)) {
      fails.push(
        `${route}: no vehicle was held at a red anywhere on this route, so the stop-line clearance is ` +
        `UNRUN rather than passed — a check on a queue that never formed is CONTRACT §7.1's quiet gate`
      );
    } else if (traffic.worstStopLineM < T.minStopLineM) {
      fails.push(
        `${route}: a held vehicle's front stood ${(-traffic.worstStopLineM).toFixed(2)} m PAST its own ` +
        `stop line (floor ${T.minStopLineM}) — the painted bar and the braking point are one number ` +
        `(CITY.stopLineFromJunctionM) and this is the distance between them`
      );
    }
  }
  if (traffic.bodyTypes < T.minBodyTypes) {
    fails.push(
      `${route}: ${traffic.bodyTypes} body types < ${T.minBodyTypes} — a count of kinds, which is why ` +
      `CONTRACT §7.2 pairs it with the silhouette assertions that measure what the kinds look like`
    );
  }

  /**
   * THE MOTION-THRESHOLD TABLE, AGAINST THE GEOMETRY THAT WAS ACTUALLY BUILT.
   *
   * `traffic.js` carried the comment "It must equal tools/budget.json ->
   * motionVectors.kindMinExtentM, and `perfcheck` asserts the two agree" and
   * perfcheck did not. Nothing read both tables, and two of the five keys could
   * not have matched by name if anything had tried — the budget said `car` and
   * `motorcycle` where the module says `wedge` and `moto`. That is `pierEvery:
   * 34` beside `i % 3 === 0` with a false claim attached, and it was found by
   * changing the vehicle geometry and going to look for the check that should
   * have caught it.
   *
   * `traffic.stats().minExtentM` is COMPUTED from the delivered boxes and
   * wheels, so this compares geometry against a declaration rather than one
   * declaration against another. Both numbers are printed on failure, CONTRACT
   * §9 rule 2.
   */
  const table = budget.motionVectors && budget.motionVectors.kindMinExtentM;
  if (table && traffic.minExtentM) {
    for (const [kind, measured] of Object.entries(traffic.minExtentM)) {
      const declared = table[kind];
      if (declared == null) {
        fails.push(
          `${route}: body type '${kind}' has no entry in motionVectors.kindMinExtentM, so its motion ` +
          `cutoff is a number nobody wrote down`
        );
      } else if (Math.abs(declared - measured) > 0.01) {
        fails.push(
          `${route}: body type '${kind}' measures ${measured.toFixed(2)} m across its smallest overall ` +
          `dimension and the budget declares ${declared} m — a difference of ` +
          `${Math.abs(declared - measured).toFixed(2)} m, which moves its §5.12 motion cutoff by ` +
          `${(Math.abs(declared - measured) / (budget.motionVectors.minExtentPx * 6.4765e-4)).toFixed(0)} m`
        );
      }
    }
  }
  return fails;
}

/**
 * WHAT A VEHICLE LOOKS LIKE. `budget.json` → `silhouettes`. CONTRACT §7.1,
 * second rule.
 *
 * `trafficLights.minBodyTypes` counts kinds and passed at 5 while all five
 * kinds were flat-topped grey boxes. It was not broken and it did not go quiet:
 * it answered its question correctly, and its question was the wrong one. A
 * floor that counts categories cannot see that the categories are all the same
 * shape, so it has to be paired with one that measures the property the
 * categories are assumed to carry.
 *
 * Everything asserted here comes out of `page.screenshot()` — the delivered
 * frame, the bytes a person opens. The harness supplies only where the geometry
 * projects to.
 */
function assertSilhouettes(route, measured, budget, perRun) {
  const S = budget.silhouettes;
  const fails = [];
  if (!S) return fails;

  /**
   * THE ROUTE LIST IS ITSELF ASSERTED, and it is checked on every route rather
   * than only on the ones it names. An assertion block that silently applies to
   * no route is a quiet gate, which §7.1 says is indistinguishable from a green
   * one — and a `routes` list that drifted out of `capture.routes` after a
   * rename is exactly how it would happen.
   */
  const unknown = S.routes.filter((r) => !budget.capture.routes.includes(r));
  if (!S.routes.length || unknown.length) {
    fails.push(
      `${route}: silhouettes.routes is ${JSON.stringify(S.routes)} against capture.routes ` +
      `${JSON.stringify(budget.capture.routes)} — ${unknown.length ? `${unknown.join(', ')} is not a route` : 'the list is empty'}, ` +
      `so the silhouette block would assert on nothing`
    );
  }
  if (!S.routes.includes(route)) return fails;

  if (!measured) {
    fails.push(
      `${route}: harness.silhouettes() is missing — nothing measures whether a vehicle reads as a ` +
      `vehicle, which is the state minBodyTypes:4 passing at 5 was hiding. UNRUN, not passed.`
    );
    return fails;
  }
  if (measured.error) {
    fails.push(`${route}: silhouette measurement failed — ${measured.error}`);
    return fails;
  }
  if (Array.isArray(measured.problems) && measured.problems.length) {
    fails.push(
      `${route}: a silhouette label has drifted from its geometry — ${measured.problems.join('; ')}`
    );
  }

  /**
   * A COUNT FLOOR IS THE MEDIAN OF THE PER-RUN COUNTS, NOT THE POOLED COUNT.
   * §0 rule 6, and the distinction is what stops this pooling from being a
   * loosening: the medians and pass fractions above are estimates of a
   * population property and get the whole pooled sample, but a floor that asks
   * "did ONE run's poses see enough subjects to say anything" would be
   * multiplied by the number of runs if it read the pool. The estimator is the
   * one `capture.$estimator` derives — the median of three runs' per-run
   * statistic, which discards exactly one contaminated draw — and the
   * thresholds do not move.
   *
   * Falls back to the pooled count when there are no per-run summaries, which
   * is `--falsify`'s fixture and `--runs=1`. Both already say in their own
   * output that they are not the gate's verdict.
   */
  const perRunCount = (kind, key) => {
    const xs = (perRun || [])
      .map((s) => (s && s.kinds && s.kinds[kind] ? s.kinds[kind][key] : null))
      .filter((x) => Number.isFinite(x))
      .sort((a, b) => a - b);
    if (!xs.length) return null;
    return xs[Math.floor((xs.length - 1) / 2)];
  };
  /** The pooled reading, plus the per-run draws it was pooled from, for the message. */
  const countDetail = (kind, key) => {
    const xs = (perRun || [])
      .map((s) => (s && s.kinds && s.kinds[kind] ? s.kinds[kind][key] : null))
      .filter((x) => Number.isFinite(x));
    return xs.length ? ` (median of ${xs.length} runs: ${xs.join(' / ')})` : ' (single measurement)';
  };

  for (const [kind, cf] of Object.entries(S.kinds)) {
    const k = measured.kinds ? measured.kinds[kind] : null;
    const nMeasured = perRunCount(kind, 'n') ?? (k ? k.n : 0);
    if (!k || nMeasured < cf.minMeasured) {
      fails.push(
        `${route}: only ${nMeasured} '${kind}' silhouettes measurable within ${S.maxDistanceM} m ` +
        `(min ${cf.minMeasured})${countDetail(kind, 'n')}. Zero measured subjects satisfies every ` +
        `floor below trivially, so this is UNRUN, not passed.`
      );
      continue;
    }

    if (cf.minGroundContrast != null) {
      if (k.groundContrast.median < cf.minGroundContrast) {
        fails.push(
          `${route}: ${kind} ground-contact contrast median ${k.groundContrast.median.toFixed(3)} < ` +
          `${cf.minGroundContrast} — the bottom ${(S.groundBandFraction * 100).toFixed(0)}% of the ` +
          `silhouette reads ${(100 * (1 - k.groundContrast.median)).toFixed(0)}% as bright as the body ` +
          `band, which is a box sitting flat on the road rather than a body over wheels`
        );
      }
      if (k.groundContrastPassFraction < S.minPassFraction) {
        fails.push(
          `${route}: only ${(k.groundContrastPassFraction * 100).toFixed(0)}% of ${k.n} ${kind}s have ` +
          `a dark gap at the ground (min ${(S.minPassFraction * 100).toFixed(0)}%), worst ` +
          `${k.groundContrast.min.toFixed(3)}`
        );
      }
    }

    if (cf.minLumaRoughness != null) {
      if (k.lumaRoughness.median < cf.minLumaRoughness) {
        fails.push(
          `${route}: ${kind} tone-profile roughness median ${k.lumaRoughness.median.toFixed(3)} < ` +
          `${cf.minLumaRoughness} — the luminance down the silhouette is monotone, which is one ` +
          `material on flat faces. A box scores 0 here however many proportions it comes in, and no ` +
          `amount of contrast changes that: only a profile that doubles back scores above zero.`
        );
      }
      if (k.lumaRoughnessPassFraction < S.minPassFraction) {
        fails.push(
          `${route}: only ${(k.lumaRoughnessPassFraction * 100).toFixed(0)}% of ${k.n} ${kind}s carry ` +
          `a non-monotone tone profile (min ${(S.minPassFraction * 100).toFixed(0)}%), worst ` +
          `${k.lumaRoughness.min.toFixed(3)}`
        );
      }
    }

    /**
     * THE ROOFLINE. CONTRACT §7.3, and it is the assertion none of the three
     * above can make. A rectangular prism reads the same fraction of its own
     * height at every station along its length, so its span is exactly 0.000
     * from any distance, any heading and any sun angle — this fails on a box by
     * construction, which is the property `$DISCARDED_darkFraction` turned out
     * not to have. The level count is printed beside it and is deliberately not
     * asserted; see `silhouettes.$roofLevels_notAsserted`.
     */
    if (cf.minRoofSpan != null) {
      const nProf = perRunCount(kind, 'nProfile') ?? (k.nProfile || 0);
      if (nProf < (cf.minProfileMeasured || 0)) {
        fails.push(
          `${route}: only ${nProf} of ${nMeasured} '${kind}' silhouettes had a long axis long enough to ` +
          `sample a roofline along (min ${cf.minProfileMeasured}, at ${S.minStationPx} px per station over ` +
          `${S.stations} stations)${countDetail(kind, 'nProfile')}. An empty profile population satisfies ` +
          `the span floor trivially, so this is UNRUN, not passed.`
        );
      } else {
        if (k.roofSpan.median < cf.minRoofSpan) {
          fails.push(
            `${route}: ${kind} silhouette height span median ${k.roofSpan.median.toFixed(3)} < ` +
            `${cf.minRoofSpan} of the body's own height — the top edge is ONE LEVEL along the whole ` +
            `length, which is a rectangular prism however well it is coloured and however many wheels ` +
            `are under it. A prism reads exactly 0.000 here. Levels ${k.roofLevels}, top-level share ` +
            `${k.roofTopFraction} of the length over ${nProf} measured.`
          );
        }
        if (k.roofSpanPassFraction < S.minPassFraction) {
          fails.push(
            `${route}: only ${(k.roofSpanPassFraction * 100).toFixed(0)}% of ${nProf} ${kind}s have a ` +
            `roofline that changes height along their own length (min ` +
            `${(S.minPassFraction * 100).toFixed(0)}%), worst ${k.roofSpan.min.toFixed(3)}`
          );
        }
      }
    }

    /**
     * THE WIDTH ALONG THE LONG AXIS. CONTRACT §7.5, and it is the assertion the
     * roofline cannot make. A stack of axis-aligned rectangular prisms has
     * CONSTANT WIDTH BY DEFINITION, so a fleet can clear the ground gap, the tone
     * profile, the palette AND the roofline and still be boxes — which is what
     * sessions 5, 6 and 6b delivered. `widthSpan` is exactly 0.0000 for a body of
     * constant width, from any admissible view.
     *
     * ITS POPULATION IS NOT THE ROOFLINE'S. `budget.json` -> `$widthOverRead`: the
     * over-read this reading has to live with vanishes end-on, which is precisely
     * where the roofline's own long axis stops projecting. So the two counts are
     * separate floors and `nWidthDeclinedBias` is printed beside this one, because
     * a population that emptied because the camera never looked end-on and one
     * that emptied because every body's parts are too long to measure are two
     * different findings with the same count.
     */
    if (cf.minWidthSpan != null) {
      const nW = perRunCount(kind, 'nWidth') ?? (k.nWidth || 0);
      if (nW < (cf.minWidthMeasured || 0)) {
        fails.push(
          `${route}: only ${nW} of ${nMeasured} '${kind}' silhouettes could be measured for width along ` +
          `their own long axis (min ${cf.minWidthMeasured})${countDetail(kind, 'nWidth')}; ` +
          `${k.nWidthDeclinedBias || 0} were DECLINED because ` +
          `their own parts are too long along that axis for the over-read to cancel (maxWidthBias ` +
          `${S.maxWidthBias}, see budget.json -> silhouettes.$widthOverRead). An empty width population ` +
          `satisfies the span floor trivially, so this is UNRUN, not passed. A fleet of long boxes is ` +
          `expected to land here rather than on the span below — the two control arms 'longPrism' and ` +
          `'stepPrism' in perfcheck --falsify are what carry the claim about that geometry.`
        );
      } else {
        if (k.widthSpan.median < cf.minWidthSpan) {
          fails.push(
            `${route}: ${kind} width span median ${k.widthSpan.median.toFixed(3)} < ${cf.minWidthSpan} of ` +
            `the body's own width — the body is THE SAME WIDTH ALONG ITS WHOLE LENGTH, which is a stack of ` +
            `rectangular prisms however well it is coloured, however many wheels are under it and however ` +
            `much its roofline steps. A constant-width body reads exactly 0.000 here. Widest-level share ` +
            `${k.widthTopFraction} of the length, over-read spread ${k.widthBiasSpread}, narrowest probe ` +
            `${k.widthLatPxMin} px, over ${nW} measured.`
          );
        }
        if (k.widthSpanPassFraction < S.minPassFraction) {
          fails.push(
            `${route}: only ${(k.widthSpanPassFraction * 100).toFixed(0)}% of ${nW} ${kind}s narrow along ` +
            `their own length (min ${(S.minPassFraction * 100).toFixed(0)}%), worst ` +
            `${k.widthSpan.min.toFixed(3)}`
          );
        }
      }
    }

    if (cf.minWidthRoughness != null) {
      if (k.widthRoughness.median < cf.minWidthRoughness) {
        fails.push(
          `${route}: ${kind} width-profile roughness median ${k.widthRoughness.median.toFixed(3)} < ` +
          `${cf.minWidthRoughness} — the outline does not narrow and widen down its own height, which ` +
          `is a slab rather than a head over shoulders over two legs`
        );
      }
      if (k.widthRoughnessPassFraction < S.minPassFraction) {
        fails.push(
          `${route}: only ${(k.widthRoughnessPassFraction * 100).toFixed(0)}% of ${k.n} ${kind}s have ` +
          `an outline that varies (min ${(S.minPassFraction * 100).toFixed(0)}%), worst ` +
          `${k.widthRoughness.min.toFixed(3)}`
        );
      }
    }

    if (cf.minChromaClusters != null && k.chromaClusters < cf.minChromaClusters) {
      fails.push(
        `${route}: ${k.chromaClusters} distinguishable body chromaticities across ${k.n} ${kind}s < ` +
        `${cf.minChromaClusters} at epsilon ${S.chromaEpsilon} — every one of them is the same colour. ` +
        `Palette written into instanceColor: ${measured.palette && measured.palette[kind] != null ? measured.palette[kind] : '?'} ` +
        `distinct. If that number clears the floor and this one does not, the attribute is not ` +
        `reaching diffuseColor and no palette entry will change a pixel.`
      );
    }

    /**
     * THE SAME QUANTITY FROM THE OTHER END, CONTRACT §9 rule 2. The count above
     * is what ARRIVED in the frame; this is what was WRITTEN into the buffer.
     * They fail differently and the messages say which: a small palette is a
     * content bug, a large palette that delivers one cluster is a plumbing one.
     */
    if (S.requirePaletteAgreement && cf.minChromaClusters != null) {
      const written = measured.palette ? measured.palette[kind] : null;
      if (written == null) {
        fails.push(
          `${route}: harness.instanceColourPalette() reported no '${kind}' buffer, so the count that ` +
          `arrived in the frame has nothing to be compared against`
        );
      } else if (written < cf.minChromaClusters) {
        fails.push(
          `${route}: only ${written} distinct body colours were written into ${kind} instanceColor ` +
          `(min ${cf.minChromaClusters}) — the frame cannot show a palette the buffer does not hold`
        );
      }
    }
  }
  return fails;
}

/**
 * Shannon entropy and mean of the frame's LUMINANCE HISTOGRAM.
 *
 * SESSION 16 — THIS FUNCTION WAS HANDED A PNG AND INDEXED IT AS THOUGH IT WERE
 * PIXELS. `shot` is `page.screenshot({ type: 'png' })`, a DEFLATE stream with a
 * header on it, and the body of this function was:
 *
 *     for (let i = 0; i < png.length - 3; i += 997) hist[png[i]]++;
 *
 * Every 997th byte of a compressed stream, counted as an 8-bit luminance.
 * CONTRACT §9's failure mode in its purest form — a number computed correctly
 * and then used as a different quantity — inside the one floor whose comment
 * says it exists to stop the agent "hitting its frame budget by rendering an
 * empty world", and with `decodePNG` already imported four lines from the top
 * of this file.
 *
 * MEASURED, BOTH WAYS, ON THE SAME BYTES (§9 rule 2 and rule 4):
 *
 *   frame                  bytes as pixels   PNG decoded   what the floor says
 *   delivered midnight          0.4930          0.0829     [0.08, 0.55]
 *   delivered noon              0.4998          0.4382
 *   delivered downtown_dense    0.4956          0.0707     0.0707 IS BELOW 0.08
 *   CONTROL all-black           0.2799          0.0000     "black screen" — PASSED
 *   CONTROL all-white           0.1775          1.0000     "blown out"   — PASSED
 *   CONTROL noise               0.4893          0.4969
 *
 * DEFLATE output is very nearly uniform over 0..255, so its byte mean is very
 * nearly 0.5 and its byte entropy very nearly 8 — for ANY image. The two
 * controls are the §7.3 pair this floor never had: an all-black frame and an
 * all-white one both passed a band whose failure message names exactly those
 * two cases. The only thing the old reading could see was how large the file
 * was: a solid image compresses to 8 kB, which is eight samples at stride 997,
 * which is a low entropy. So `screenshotEntropy` was a proxy for
 * COMPRESSIBILITY and was accidentally serviceable at its stated job, while
 * `meanLuminance` was a constant with a rounding error on it.
 *
 * The luma is `lookmetrics.mjs`'s `luma8`, imported rather than retyped, so
 * that "mean luminance" means one thing in this project rather than two.
 */
function imageStats(shot) {
  const { width, height, channels, data } = decodePNG(shot);
  const n = width * height;
  const hist = new Array(256).fill(0);
  let sum = 0;
  for (let i = 0, o = 0; i < n; i++, o += channels) {
    const y = Math.min(255, Math.round(luma8(data[o], data[o + 1], data[o + 2]) * 255));
    hist[y]++;
    sum += y / 255;
  }
  let entropy = 0;
  for (let v = 0; v < 256; v++) {
    if (!hist[v]) continue;
    const p = hist[v] / n;
    entropy -= p * Math.log2(p);
  }
  /**
   * THE MIDDLE, MEASURED AND NOT ASSERTED — session 17, and it is STATE 16 §7's
   * fourth carried-forward gap turned into a number somebody can derive a floor
   * from next session.
   *
   * "The mean is not the middle, and nothing measures the middle": a frame can
   * hold its mean with a handful of emitters while the mid-tones collapse, and
   * both the band and the crush limit stay green through it. `median / mean` is
   * EXPOSURE-INVARIANT — scale every pixel by k and both scale by k — which is
   * what makes it a statement about the distribution rather than about the
   * level, and therefore the one statistic here that the exposure servo cannot
   * attenuate.
   *
   * Printed, never asserted. A floor on it would be a threshold nobody has
   * derived, and §9 rule 5 says a number without a derivation is a guess. What
   * this does is put four routes' worth of it in every report, so that the
   * session that derives one has a population to derive it from.
   */
  const half = n / 2;
  let acc = 0;
  let median = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= half) { median = v / 255; break; }
  }
  const meanLuminance = sum / n;
  return {
    entropy,
    meanLuminance,
    medianLuminance: median,
    medianOverMean: meanLuminance > 0 ? median / meanLuminance : null,
  };
}

/**
 * The maximum Shannon entropy any 8-bit luminance histogram with this mean can
 * have — the truncated geometric, solved for its ratio.
 *
 * It is here because the two floors above are NOT INDEPENDENT and nobody could
 * have known that while neither of them read a pixel. Entropy is maximised at a
 * given mean by the exponential distribution, so a floor on entropy is
 * implicitly a floor on mean, and the two numbers in `budget.json` disagree
 * about which frame is admissible. It is printed beside the entropy so that a
 * red entropy on a dark route is read as the arithmetic below rather than as a
 * frame that lost its detail.
 */
function maxEntropyAtMean(mean255) {
  const meanOf = (q) => {
    let s = 0;
    let w = 0;
    for (let v = 0; v < 256; v++) {
      const p = Math.pow(q, v);
      s += p * v;
      w += p;
    }
    return s / w;
  };
  let lo = 0;
  let hi = 1;
  for (let it = 0; it < 200; it++) {
    const mid = (lo + hi) / 2;
    if (meanOf(mid) < mean255) lo = mid;
    else hi = mid;
  }
  const q = (lo + hi) / 2;
  let w = 0;
  const ps = [];
  for (let v = 0; v < 256; v++) {
    const p = Math.pow(q, v);
    ps.push(p);
    w += p;
  }
  let H = 0;
  for (const p0 of ps) {
    const p = p0 / w;
    if (p > 0) H -= p * Math.log2(p);
  }
  return H;
}

function assertRoute({ route, runs, silhouettes, silhouettesPerRun, hudBudgets = HUD.budgets }) {
  const { floors, hardFails } = BUDGET;
  /**
   * PER-ROUTE CEILINGS, AND ONLY WHERE A ROUTE HAS ITS OWN ENTRY — session 10.
   *
   * `budget.json` → `ceilingsByRoute` overrides the shared `ceilings` for one
   * route and one key at a time. It exists because the alternative offered for
   * `night_rain` was raising the shared `wallFrameMsP95` from 12.5 to 13.0,
   * which would have relaxed the bound on `downtown_dense` and
   * `highway_speed` as well — three gates loosened to settle one, and neither
   * of the other two asked for it. Every key not named per route still reads
   * the shared number, and every override carries the arithmetic that produced
   * it, exactly as §9 rule 5 requires of the shared ones.
   *
   * The failure message names the source, because "12.5" and "13.0" in two
   * different lines of the same report with no way to tell which route was
   * held to which is CONTRACT §9's shape wearing a threshold.
   */
  const perRoute = (BUDGET.ceilingsByRoute && BUDGET.ceilingsByRoute[route]) || {};
  const ceilings = { ...BUDGET.ceilings, ...perRoute };
  const ceilingSource = (key) =>
    Object.prototype.hasOwnProperty.call(perRoute, key) ? ` [${route}'s own ceiling]` : '';
  const fails = [];
  const last = runs[runs.length - 1];
  const { shot, memory, routeInfo, particles, weather, motion, roles, traffic } = last;
  /**
   * THE LEVEL STATISTICS ARE A SAMPLE OF ONE AND EVERY MILLISECOND BESIDE THEM
   * IS POOLED OVER THREE. SESSION 17 MEASURED THAT AND DID NOT REPAIR IT.
   *
   * `stats` is the LAST run's screenshot, unchanged, and it is what the two
   * floors below assert against — no verdict moves in this session. What is new
   * is that every run's frame is now measured and printed, because the spread
   * was unknown and CONTRACT §0 rule 6 cannot be applied to an unknown spread.
   *
   * MEASURED, five independent single-run invocations of `downtown_dense`:
   *   mean     0.0641 0.0711 0.0667 0.0660 0.0679   median 0.0667, range 0.0070
   *   entropy  5.068  5.197  5.141  5.139  5.203    median 5.141, range 0.135
   * and a sixth, the last run of a three-run gate invocation, read mean 0.0490
   * and entropy 4.751 — outside the range of the other five in both. That is
   * the same DISCRETE state STATE 16 §6 names for `citycheck`'s saturation
   * excursion (a vehicle coming to rest at the lens; `CAMERA_CLEARANCE` is a
   * hard test at seed time only), now visible in a second instrument: a large
   * dark body filling the frame lowers the mean by 26% and the entropy by
   * 0.39 bits, and both are exactly what it should do.
   *
   * So the entropy floor's margin on this route is 5.141 − 5.0 = 0.141 against
   * a five-run range of 0.135 — a margin the size of the noise, which is §0.1's
   * original incident with a statistic instead of a millisecond — and one run
   * in six lands under the floor outright. The repair is the one §0.1 already
   * describes: pool the level statistics by the median of per-run values, the
   * same estimator the milliseconds use, with its own two-sided falsifying
   * cases. That is a change to an ESTIMATOR and it is not made here, in the
   * session that found it, because an estimator arrives with the cases that
   * hold it honest or it does not arrive. STATE.md carries it.
   */
  const stats = imageStats(shot);
  const perRunLevel = runs.map((r) => imageStats(r.shot));

  const pooled = poolRuns(runs.map((r) => runStats(r.report)));
  const usingGpuTimers = pooled.usingGpuTimers;

  /**
   * COUNTS ARE COMBINED WORST-CASE ACROSS RUNS, not medianed and not taken
   * from one. CONTRACT §9 rule 6's corollary is that counts do not drift, so
   * a median has nothing to average away — and if one of the three runs DOES
   * disagree, the honest thing is for the ceiling to see the largest and the
   * floor the smallest. Strictly stricter than a single run, which is what a
   * pooled estimator is allowed to be.
   */
  const worstCeiling = (f) => Math.max(...runs.map(f).filter((v) => v != null));
  const worstFloor = (f) => Math.min(...runs.map(f).filter((v) => v != null));

  const metrics = {
    method: last.report.method,
    runs: pooled.runs,
    gpuP95: pooled.gpuP95,
    gpuMax: pooled.gpuMax,
    cpuP95: pooled.cpuP95,
    wallP95: pooled.wallP95,
    wallMax: pooled.wallMax,
    wallP95PerRun: pooled.perRun.wallP95,
    cpuP95PerRun: pooled.perRun.cpuP95,
    wallSpread: pooled.wallSpread,
    cpuSpread: pooled.cpuSpread,
    queryStats: last.report.queryStats || null,
    longFrames: pooled.longFrames,
    drawCalls: worstCeiling((r) => r.report.peak.drawCalls),
    triangles: worstCeiling((r) => r.report.peak.triangles),
    programs: worstCeiling((r) => r.report.peak.programs),
    /**
     * THE SAME COUNT COMBINED THE OTHER WAY, because `drawCalls` is read by a
     * ceiling AND by a floor and one combination cannot serve both. Taking the
     * maximum for a floor is the lenient direction: three runs of 380, 380 and
     * 12 would report 380 and the floor that exists to catch a deleted content
     * system would not see it. Each bound gets the run that is worst FOR IT.
     */
    drawCallsMin: worstFloor((r) => r.report.peak.drawCalls),
    trianglesMin: worstFloor((r) => r.report.peak.triangles),
    distinctMaterials: worstFloor((r) => r.report.distinctMaterials),
    visibleInstances: worstFloor((r) => r.report.visibleInstances),
    targetMemoryMB: worstCeiling((r) => (r.memory ? r.memory.targetMemoryMB : null)),
    chunkMemoryMB: worstCeiling((r) => (r.memory ? r.memory.chunkMemoryMB : null)),
    metresTravelled: worstFloor((r) => (r.routeInfo ? r.routeInfo.metresTravelled : null)),
    ...stats,
    /**
     * THE LEVEL ASSERTIONS, POOLED — session 21, and it is CONTRACT §0.1
     * applied to the last statistic in this gate that was still a sample of
     * one.
     *
     * §0.1 says of its own correction: *"It applies to every measurement in
     * this project and not only to this gate."* Three assertions read
     * `imageStats` off the LAST run's frame while every millisecond beside them
     * was already the median of three. STATE 20 §7 measured what that cost:
     * `downtown_dense`'s mean luminance was decided against a per-run range of
     * **0.0193** with a margin of **0.0063** — 33% of the instrument's own
     * noise floor, which is §0.1's original incident with a luminance instead
     * of a millisecond.
     *
     * THE ESTIMATOR IS THE MEDIAN OF THE PER-RUN VALUES, the same one
     * `capture.$estimator` names for the timings, and for the same reason: on a
     * machine whose drift is one-sided, a median of three discards exactly one
     * contaminated observation. It is NOT a mean and it is NOT a statistic over
     * pooled pixels — the second would be the p95-of-a-mixture substitution
     * `$estimator` already refuses, with a histogram instead of a percentile.
     *
     * IT CANNOT BE A LOOSENING, AND THAT IS WHY IT IS SAFE TO DO. Session 20
     * measured `downtown_dense` at [0.0760, 0.0567, 0.0737] against a floor of
     * 0.08: the median is 0.0737 and the last run's value was 0.0737, so the
     * gate is red before and after. NO THRESHOLD MOVED — `meanLuminance` is
     * [0.08, 0.55] and `screenshotEntropy` is 5.0, unchanged.
     *
     * `medianOverMean` stays on the LAST run's frame because it is a shape
     * statistic about one histogram rather than a level, and medianing a ratio
     * of two medianed quantities is a third quantity nobody derived.
     */
    meanLuminance: median(perRunLevel.map((s) => s.meanLuminance)),
    entropy: median(perRunLevel.map((s) => s.entropy)),
    /** Every run's frame, so the spread the assertion is decided against is visible. */
    meanLuminancePerRun: perRunLevel.map((s) => +s.meanLuminance.toFixed(4)),
    entropyPerRun: perRunLevel.map((s) => +s.entropy.toFixed(3)),
    /** The spread, printed beside the estimate — `poolRuns` does the same for a millisecond. */
    meanLuminanceSpread: +(Math.max(...perRunLevel.map((s) => s.meanLuminance))
      - Math.min(...perRunLevel.map((s) => s.meanLuminance))).toFixed(4),
    entropySpread: +(Math.max(...perRunLevel.map((s) => s.entropy))
      - Math.min(...perRunLevel.map((s) => s.entropy))).toFixed(3),
  };

  // Console errors and lost contexts from ANY run. One bad run out of three is
  // a bug that happens one run in three, not a run to be medianed away.
  const report = {
    ...last.report,
    errors: runs.flatMap((r) => r.report.errors),
    contextLost: Math.max(...runs.map((r) => r.report.contextLost)),
  };

  const fail = (m) => fails.push(`${route}: ${m}`);

  if (usingGpuTimers) {
    if (metrics.gpuP95 > ceilings.gpuFrameMsP95) fail(`GPU p95 ${metrics.gpuP95.toFixed(2)}ms > ${ceilings.gpuFrameMsP95}ms`);
    if (metrics.gpuMax > ceilings.gpuFrameMsMax) fail(`GPU max ${metrics.gpuMax.toFixed(2)}ms > ${ceilings.gpuFrameMsMax}ms`);
  }
  if (metrics.cpuP95 > ceilings.cpuFrameMsP95) {
    fail(
      `CPU p95 ${metrics.cpuP95.toFixed(2)}ms > ${ceilings.cpuFrameMsP95}ms ` +
      `(median of ${pooled.runs} runs: ${metrics.cpuP95PerRun.join(' / ')}, spread ${metrics.cpuSpread}ms)`
    );
  }
  // End-to-end frame interval, which with vsync disabled is bounded below by
  // whichever of the CPU and the GPU is slower. Asserted always, not only as a
  // fallback: it is the only number here that can catch a GPU regression on a
  // machine whose timer queries never retire, and this machine is one of those.
  if (metrics.wallP95 != null && metrics.wallP95 > ceilings.wallFrameMsP95) {
    fail(
      `frame interval p95 ${metrics.wallP95.toFixed(2)}ms > ${ceilings.wallFrameMsP95}ms` +
      `${ceilingSource('wallFrameMsP95')} ` +
      `(median of ${pooled.runs} runs: ${metrics.wallP95PerRun.join(' / ')}, spread ${metrics.wallSpread}ms)`
    );
  }
  if (metrics.longFrames > ceilings.longFrames) fail(`${metrics.longFrames} frames over 33ms (max ${ceilings.longFrames})`);
  if (metrics.drawCalls > ceilings.drawCalls) fail(`${metrics.drawCalls} draw calls > ${ceilings.drawCalls}`);
  if (metrics.triangles > ceilings.triangles) fail(`${metrics.triangles} tris > ${ceilings.triangles}`);
  if (metrics.programs > ceilings.programs) fail(`${metrics.programs} programs > ${ceilings.programs}`);

  // Memory. Both of these are exact rather than estimated: every byte counted
  // here is an allocation this project made and can measure. A ceiling on a
  // number nobody computes is not a ceiling — and an unbounded chunk cache is
  // the same class of mistake as an unbounded particle layer.
  if (metrics.targetMemoryMB != null && metrics.targetMemoryMB > ceilings.textureMemoryMB) {
    fail(`render targets ${metrics.targetMemoryMB} MB > ${ceilings.textureMemoryMB} MB`);
  }
  if (metrics.chunkMemoryMB != null && metrics.chunkMemoryMB > ceilings.chunkMemoryMB) {
    fail(`resident chunk data ${metrics.chunkMemoryMB} MB > ${ceilings.chunkMemoryMB} MB`);
  }
  // A route that stood still measures a screenshot. This is the floor that
  // stops a streaming bug from being reported as excellent performance.
  if (metrics.metresTravelled != null && metrics.metresTravelled < floors.metresTravelled) {
    fail(`route covered only ${metrics.metresTravelled} m (min ${floors.metresTravelled} m)`);
  }

  // Floors. These are the reason the agent cannot win by deletion.
  if (metrics.drawCallsMin < floors.drawCalls) fail(`only ${metrics.drawCallsMin} draw calls — world is too empty (min ${floors.drawCalls})`);
  if (metrics.trianglesMin < floors.triangles) fail(`only ${metrics.trianglesMin} tris — geometry was stripped (min ${floors.triangles})`);
  if (metrics.distinctMaterials < floors.distinctMaterials) fail(`only ${metrics.distinctMaterials} materials (min ${floors.distinctMaterials})`);
  if (metrics.visibleInstances < floors.visibleInstances) fail(`only ${metrics.visibleInstances} visible instances (min ${floors.visibleInstances})`);
  /**
   * SESSION 16. Both of these read a decoded frame for the first time; see
   * `imageStats`. Neither threshold moved, and both now carry the arithmetic
   * that says whether the frame could have met them at all — because a floor
   * that no correct frame can reach is a wish and not a ratchet, and this
   * project has shipped one of those before (the walkability flood fill that
   * reached one cell of 67 568).
   */
  const ceilingH = maxEntropyAtMean(metrics.meanLuminance * 255);
  /**
   * ═══════════════════════════════════════════════════════════════════════
   * IT SAID "THE SCREEN IS NEAR-EMPTY" AND IT CANNOT SEE EMPTINESS —
   * SESSION 77, AND THE NUMBER IS 0.030 AGAINST 0.244.
   * ═══════════════════════════════════════════════════════════════════════
   *
   * MEASURED, at the `trade` eye at midnight, dry, one pose, two runs of
   * `lookat --params=fill=0.0` and `fill=1.0`: the two extremes of the frontage-fill law are a
   * ~60% swing in the city's building population, the largest content change
   * this project can make with one parameter, and they move this statistic by
   *
   *     entropy 5.338 -> 5.308   =  **0.030 bits**
   *
   * The same statistic's own run-to-run spread on `downtown_dense`,
   * `highway_speed` and `night_rain` is **0.220, 0.269 and 0.233 bits**
   * (session 76, three runs each, printed above). **THE SIGNAL IS AN EIGHTH
   * OF THE NOISE.** No floor at any value separates a full city from a sparse
   * one on this instrument, so the sentence this message used to print was not
   * a threshold that was too tight — it was a claim the statistic cannot make.
   *
   * AND THE NOISE HAS A NAME, WHICH SESSION 17 ALREADY WROTE DOWN: a vehicle
   * coming to rest at the lens. `player` is the only one of the four routes
   * that walks the PAVEMENT rather than the crown of the road, so no vehicle
   * can pass its lens, and its entropy spread is **0.015** — a fifteenth of
   * the other three. Session 76's own `downtown_dense` frame has a car filling
   * the bottom fifth of it.
   *
   * SO THE FLOOR IS A DEGENERACY GUARD AND IS ASSERTED AS ONE. It catches the
   * failure it was always actually catching — a frame with almost no distinct
   * levels in it, which is what "the world did not load" looks like — and it
   * says in its own message that sparseness is not what it measures. The
   * derivation of 4.3, two-sided and measured, is `budget.json` →
   * `$screenshotEntropy_s77`.
   */
  if (metrics.entropy < floors.screenshotEntropy) {
    fail(
      `frame entropy ${metrics.entropy.toFixed(3)} < ${floors.screenshotEntropy} — ` +
      (ceilingH < floors.screenshotEntropy
        ? `AND NO FRAME AT THIS LEVEL COULD REACH IT: at mean ${metrics.meanLuminance.toFixed(4)} the ` +
          `maximum entropy any 8-bit histogram can carry is ${ceilingH.toFixed(3)}, so the floor forbids ` +
          `a night street rather than an empty one. Read budget.json $screenshotEntropy_s16.`
        : `the frame is DEGENERATE — almost no distinct levels in it, which is what a world that ` +
          `did not load looks like (${ceilingH.toFixed(3)} was available at this mean). This floor ` +
          `does NOT test whether the city is sparse and never could: a 60% swing in the building ` +
          `population moves this statistic 0.030 bits against a run-to-run spread of ` +
          `${metrics.entropySpread}. Read budget.json $screenshotEntropy_s77.`)
    );
  }
  const [lo, hi] = floors.meanLuminance;
  if (metrics.meanLuminance < lo || metrics.meanLuminance > hi) {
    fail(
      `mean luminance ${metrics.meanLuminance.toFixed(4)} outside [${lo}, ${hi}] — black screen or blown out. ` +
      `THIS ASSERTION HAS NEVER RUN BEFORE THIS SESSION: it read compressed PNG bytes and returned ~0.49 ` +
      `for every frame including an all-black one. Read budget.json $meanLuminance_s16.`
    );
  }

  if (report.errors.length > hardFails.consoleErrors) fail(`console errors: ${report.errors.slice(0, 3).join(' | ')}`);
  if (report.contextLost > hardFails.webglContextLost) fail(`WebGL context lost ${report.contextLost}×`);

  // --- bounds for content that does not exist yet --------------------------
  //
  // Both of these are red today and are supposed to be. They are written
  // before the thing they bound because a bound written after the content is a
  // bound fitted to it, and because CONTRACT §5 rule 5 forbids ever loosening
  // one afterwards. See budget.json → $SESSION_NOTE.
  const p = assertParticles(route, particles, BUDGET, BUDGET.capture.viewport);
  fails.push(...p.fails);
  metrics.particleLayers = p.layers.length;
  // Session 44. Reported, never asserted: this is a description of the state
  // the route was measured in, and the numbers above are what get asserted.
  metrics.weather = weather
    ? {
        rainfall: weather.rainfall,
        pinned: !!weather.rainPinned,
        nowS: weather.nowS,
        nextShowerS: weather.nextShowerS,
        activeParticles: weather.layers.reduce((a, l) => a + l.active, 0),
      }
    : null;
  metrics.particleFill = p.fill != null ? +p.fill.toFixed(5) : null;

  fails.push(...assertMotion(route, motion, BUDGET));
  metrics.motionLayers = motion ? motion.layers.length : null;
  metrics.motionWritten = motion ? motion.written : null;
  metrics.motionSuppressed = motion ? motion.carried : null;
  metrics.swapViolations = motion ? motion.sameFrameViolations : null;

  fails.push(...assertLightRoles(route, roles, BUDGET));
  fails.push(...assertHudBudgets(hudBudgets, BUDGET));
  metrics.lightRoles = roles ? roles.byRole : null;
  metrics.unrolledLights = roles ? roles.unrolled : null;

  fails.push(...assertTrafficContent(route, traffic, BUDGET));
  metrics.trafficVehicles = traffic ? traffic.vehicles : null;
  metrics.trafficBodyTypes = traffic ? traffic.bodyTypes : null;

  // The paired assertion minBodyTypes never had. See assertSilhouettes.
  if (BUDGET.silhouettes && BUDGET.silhouettes.routes.includes(route)) {
    fails.push(...assertSilhouettes(route, silhouettes, BUDGET, silhouettesPerRun));
    const v = silhouettes && silhouettes.kinds ? silhouettes.kinds.vehicle : null;
    const p = silhouettes && silhouettes.kinds ? silhouettes.kinds.pedestrian : null;
    metrics.silhouetteVehicles = v ? v.n : 0;
    metrics.silhouetteProfiles = v ? v.nProfile : 0;
    metrics.roofSpan = v && v.roofSpan ? v.roofSpan.median : null;
    metrics.roofSpanPassFraction = v ? v.roofSpanPassFraction : null;
    metrics.roofLevels = v ? v.roofLevels : null;
    metrics.roofTopFraction = v ? v.roofTopFraction : null;
    // §7.5. `silhouetteWidths` and `widthDeclinedBias` are printed together
    // because they are the two halves of one question: how many subjects the
    // width could be read on, and how many it could not be read on BECAUSE OF
    // THEIR OWN GEOMETRY rather than because of the camera.
    metrics.silhouetteWidths = v ? v.nWidth : 0;
    metrics.widthDeclinedBias = v ? v.nWidthDeclinedBias : null;
    metrics.widthSpan = v && v.widthSpan ? v.widthSpan.median : null;
    metrics.widthSpanPassFraction = v ? v.widthSpanPassFraction : null;
    metrics.widthTopFraction = v ? v.widthTopFraction : null;
    metrics.widthBiasSpread = v ? v.widthBiasSpread : null;
    metrics.groundContrast = v ? v.groundContrast.median : null;
    metrics.lumaRoughness = v ? v.lumaRoughness.median : null;
    metrics.bodyChromaClusters = v ? v.chromaClusters : null;
    metrics.paletteChromaClusters = silhouettes && silhouettes.palette ? silhouettes.palette.vehicle : null;
    metrics.silhouettePedestrians = p ? p.n : 0;
    metrics.pedestrianWidthRoughness = p ? p.widthRoughness.median : null;
    metrics.pedestrianChromaClusters = p ? p.chromaClusters : null;
  } else {
    // Checked on every route so a drifted route list cannot make the whole
    // block silently inapplicable.
    fails.push(...assertSilhouettes(route, silhouettes, BUDGET, silhouettesPerRun));
  }

  const cluster = routeInfo ? routeInfo.cluster : null;
  fails.push(...assertCluster(route, cluster, BUDGET));
  metrics.clusterPeak = cluster ? cluster.peakOccupancy : null;
  metrics.clusterMax = cluster ? cluster.maxPerCluster : null;
  metrics.clusterMargin = cluster ? cluster.occupancyMargin : null;
  metrics.trafficLights = cluster ? cluster.trafficLights : null;

  return { metrics, fails, usingGpuTimers };
}

// ---------------------------------------------------------------------------
// CONTRACT §7 — every gate has a known case that makes it fail, and that case
// is exercised.
//
// WHY THIS EXISTS AND WHY IT IS HERE RATHER THAN IN gateaudit. Three checks in
// this project went QUIET rather than red: `facadeAlbedoClusters` was
// suppressed rather than passing, `distinctMaterials` was a floor a no-op moved
// by 30%, and the headroom probe renders the same 3 686 400 pixels twice and
// calls the second one headroom. None of them broke. A quiet gate is
// indistinguishable from a green one in every report this project produces.
//
// `gateaudit` already perturbs `lookcheck`'s captures and requires each
// threshold to reject. Nothing did that for the assertions here, because they
// read harness instruments rather than frames — so the falsifying case lives
// beside the assertion it falsifies, which is the only place it stays in step,
// and `gateaudit` runs this as a subprocess so there is still one meta-gate.
//
// THE TEST IS TWO-SIDED. Each case must (a) leave the good fixture with zero
// failures and (b) produce at least one failure when perturbed. One-sided would
// pass an assertion that rejects EVERYTHING, and session 4 already found one of
// those: a walkability flood fill that reached one cell of 67 568. When a check
// rejects everything, the check is usually what is wrong.

/** A synthetic route result that is inside every bound. Nothing renders. */
function goodRun() {
  return {
    report: {
      method: 'cpu',
      frames: { cpuMs: new Array(200).fill(8), gpuMs: [], wallMs: new Array(200).fill(8.4) },
      // DERIVED FROM THE BUDGET, not authored. The floors ratcheted this
      // session and a hand-written fixture silently fell below two of them,
      // which would have made every case below meaningless. A fixture that
      // has to be maintained alongside the thresholds is a second copy of
      // them (CONTRACT §9 rule 3).
      peak: {
        drawCalls: Math.round((BUDGET.floors.drawCalls + BUDGET.ceilings.drawCalls) / 2),
        triangles: Math.round((BUDGET.floors.triangles + BUDGET.ceilings.triangles) / 2),
        programs: Math.round(BUDGET.ceilings.programs / 2),
      },
      distinctMaterials: BUDGET.floors.distinctMaterials + 6,
      visibleInstances: BUDGET.floors.visibleInstances + 20000,
      errors: [], contextLost: 0,
      rendererString: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M4)',
    },
    /**
     * SESSION 16: A REAL PNG, BECAUSE THE FIXTURE THIS REPLACES WAS BUILT TO
     * SATISFY THE DEFECT.
     *
     * It was `new Uint8Array(997 * 400)` with every 997th byte set, under a
     * comment that read "`imageStats` samples every 997th byte, so only those
     * matter" — a fixture written from the implementation rather than from the
     * quantity, so the fixture and the bug certified each other and
     * `--falsify` reported 70/70 while the assertion had never seen a pixel.
     * CONTRACT §7.7: an instrument written to detect a failure mode is where
     * that failure mode hides, and this is the second half of it — the CHECK on
     * the instrument was written by the same hand, in the same hour, from the
     * same wrong idea of what the input was.
     *
     * The replacement is a 420 × 500 greyscale PNG, 210 000 pixels, whose value
     * at pixel i is `20 + (i·173 mod 210)`. gcd(173, 210) = 1 and 210 000 is
     * 1 000 × 210, so the 210 distinct values are hit exactly 1 000 times each.
     * Hand-computed before it was run, and both numbers are exact rather than
     * approximate:
     *
     *   entropy  log2(210)            = 7.714  against the 6.8 floor
     *   mean     (20 + 104.5) / 255   = 0.4882 inside [0.08, 0.55]
     *
     * Grey, so Rec.709 luma is the channel value itself and the arithmetic
     * above needs no weighting. It goes through `encodePNG` and back through
     * `decodePNG` — the same round trip the real screenshot takes.
     */
    shot: (() => {
      const W = 420;
      const H = 500;
      const data = new Uint8Array(W * H * 4);
      for (let i = 0; i < W * H; i++) {
        const v = 20 + ((i * 173) % 210);
        data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
      }
      return encodePNG({ width: W, height: H, channels: 4, data });
    })(),
    memory: { targetMemoryMB: 130.4, chunkMemoryMB: 54, internal: [2560, 1440] },
    routeInfo: {
      metresTravelled: 400,
      cluster: {
        trafficLights: BUDGET.trafficLights.lights, maxPerCluster: 96,
        peakOccupancy: 96 - (BUDGET.trafficLights.minOccupancyMargin + 10),
        occupancyMargin: BUDGET.trafficLights.minOccupancyMargin + 10,
        clustersAtCap: 0, lightCount: 340, maxLights: 384, overflow: false,
      },
    },
    particles: BUDGET.particles.requireLayers.map((name) => ({
      name, allocated: BUDGET.particles.layerCaps[name].maxInstances, drawn: BUDGET.particles.layerCaps[name].maxInstances,
      maxAreaPx: BUDGET.particles.layerCaps[name].maxAreaPx, clampCompileTime: true,
      declaredDefine: BUDGET.particles.layerCaps[name].maxAreaPx,
    })),
    motion: {
      layers: [{ label: 'a' }, { label: 'b' }, { label: 'c' }, { label: 'd' }],
      written: 600, carried: 40, sameFrameViolations: 0, reads: 1800,
    },
    /**
     * SESSION 45 — `sign: 16`, AND THE REASON IT IS HERE IS THAT `gateaudit`
     * REFUSED THE RUN WITHOUT IT.
     *
     * `budget.json` -> `lightRoles.floors` gained a `sign` floor of 1 when the
     * sign pool landed, and this fixture is the GOOD world every falsify case
     * is measured against. A floor for a role the good world does not declare
     * fails the control, which correctly makes every case below meaningless —
     * so the fixture is what had to move, not the floor. That is the same rule
     * `$floors` states in its own words: a role that stopped being created
     * reads as excellent pool margin.
     *
     * The other five rows are NOT re-synced to the delivered city (which reads
     * block 56, lamp 192, stall 12) and that is deliberate: they carry only
     * ceilings, this fixture is a description of a world that PASSES rather
     * than a snapshot of today's, and moving them would be a change no failing
     * assertion asked for.
     */
    roles: {
      total: 360, unrolled: 0, maxLights: 384,
      byRole: { block: 52, lamp: 196, traffic: 96, stall: 8, aircraft: 1, sign: 16 },
      enabledByRole: { block: 52, lamp: 196, traffic: 96, stall: 8, aircraft: 1, sign: 16 },
    },
    traffic: {
      vehicles: BUDGET.trafficLights.contentVehicles,
      headlamps: BUDGET.trafficLights.contentHeadlamps,
      /** Session 21 — a held vehicle short of its own line, which is correct. */
      worstStopLineM: BUDGET.trafficLights.minStopLineM + 0.4,
      bodyTypes: 5,
      // Straight off the budget, so the fixture agrees by construction and the
      // two falsifying cases below are the only way this block goes red.
      minExtentM: { ...BUDGET.motionVectors.kindMinExtentM },
    },
  };
}

/**
 * A whole route result: `capture.runs` runs of `goodRun()` plus the silhouette
 * summary, which is measured once and is not per-run.
 *
 * THE ROUTE NAME IS THE ONE THE SILHOUETTE BLOCK COVERS, and it is read out of
 * the budget rather than typed. `assertSilhouettes` returns early for a route
 * it does not cover, so a fixture called 'falsify' would have exercised none of
 * it — the self-test would have reported 100% coverage over a block that never
 * ran, which is the quiet gate §7.1 is about, one level up.
 */
function goodFixture(runs = Math.max(1, BUDGET.capture.runs || 1)) {
  return {
    route: BUDGET.silhouettes.routes[0],
    runs: Array.from({ length: runs }, () => goodRun()),
    /**
     * A COPY OF THE COPY, so the fixture agrees by construction and the
     * falsifying case below is the only way this block goes red — the same
     * arrangement `traffic.minExtentM` uses two fields down.
     */
    hudBudgets: { ...HUD.budgets },
    /**
     * Every number derived from the floor it has to clear, for the same reason
     * the peak counts above are: a fixture with hand-written silhouette numbers
     * is a second copy of the thresholds, and it falls quietly below one of them
     * the first time the ratchet turns (CONTRACT §9 rule 3).
     */
    silhouettes: (() => {
      const S = BUDGET.silhouettes;
      const kinds = {};
      const above = (floor, by) => ({ median: (floor || 0) + by, min: (floor || 0) + by / 2 });
      for (const [kind, cf] of Object.entries(S.kinds)) {
        kinds[kind] = {
          n: cf.minMeasured + 6,
          nProfile: (cf.minProfileMeasured || 0) + 4,
          roofSpan: above(cf.minRoofSpan, 0.2),
          roofSpanPassFraction: cf.minRoofSpan == null ? null : 1,
          roofLevels: 3,
          roofTopFraction: 0.45,
          nWidth: (cf.minWidthMeasured || 0) + 4,
          nWidthDeclinedBias: 0,
          widthSpan: above(cf.minWidthSpan, 0.1),
          widthSpanPassFraction: cf.minWidthSpan == null ? null : 1,
          widthBiasSpread: 0.01,
          widthTopFraction: 0.4,
          widthLatPxMin: S.minLatSegPx * 2,
          groundContrast: above(cf.minGroundContrast, 0.2),
          groundContrastPassFraction: cf.minGroundContrast == null ? null : 1,
          lumaRoughness: above(cf.minLumaRoughness, 0.2),
          lumaRoughnessPassFraction: cf.minLumaRoughness == null ? null : 1,
          widthRoughness: above(cf.minWidthRoughness, 0.2),
          widthRoughnessPassFraction: cf.minWidthRoughness == null ? null : 1,
          chromaClusters: (cf.minChromaClusters || 0) + 2,
          medianAreaPx: S.minAreaPx * 4,
          medianVisibleFraction: 0.95,
          nearestM: 12,
        };
      }
      const palette = {};
      for (const [kind, cf] of Object.entries(S.kinds)) {
        if (cf.minChromaClusters != null) palette[kind] = cf.minChromaClusters + 2;
      }
      return { kinds, palette, problems: [], seen: 90, eligible: 40, measured: 30 };
    })(),
  };
}

/** A solid greyscale PNG, for the two frame fixtures below. */
function solidPNG(v, W = 64, H = 64) {
  const data = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
  }
  return encodePNG({ width: W, height: H, channels: 4, data });
}

/**
 * A frame with exactly `k` equally-populated grey levels, so its Shannon
 * entropy is `log2(k)` EXACTLY — session 77.
 *
 * WHY A SECOND CASE FOR ONE FLOOR. `solidPNG(128)` reads entropy 0, which
 * rejects at a floor of 4.3 and would reject just as happily at 0.5. A case
 * three orders away from the threshold proves the assertion is WIRED and
 * proves nothing about its VALUE — and the value is what session 77 moved. At
 * `k = 16` this reads exactly 4.000 bits, so it rejects at 4.3 and would pass
 * anything at or under 4.0: it is the case that notices the floor being
 * lowered out of usefulness, which is the direction CONTRACT §0 rule 5 cares
 * about and the direction `solidPNG` cannot see.
 *
 * The levels are spread over the full range so the frame's MEAN lands near
 * 0.5, inside `floors.meanLuminance` — this case must falsify the entropy
 * floor and not borrow a rejection from the band beside it.
 */
function levelsPNG(k, W = 64, H = 64) {
  const data = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const v = Math.round((255 * (i % k)) / (k - 1));
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
  }
  return encodePNG({ width: W, height: H, channels: 4, data });
}

/**
 * One entry per assertion. `id` names the thing being falsified and `mutate`
 * breaks exactly it. Adding an assertion without adding a case here fails the
 * coverage check below, which is the whole point.
 */
const FALSIFY = [
    // THE TIMING CASES PERTURB EVERY RUN, and that is the estimator being
  // exercised rather than a convenience. A case that made one run of three
  // slow would NOT be rejected, because the median of three discards it —
  // which is the entire change this session makes. That direction is tested
  // explicitly, and two-sidedly, by ESTIMATOR_CASES below.
  ['ceiling.cpuP95', (g) => { for (const x of g.runs) x.report.frames.cpuMs = new Array(200).fill(99); }],
  ['ceiling.wallP95', (g) => { for (const x of g.runs) x.report.frames.wallMs = new Array(200).fill(99); }],
  ['ceiling.longFrames', (g) => { for (const x of g.runs) for (let i = 0; i < 40; i++) x.report.frames.cpuMs[i] = 50; }],
  ['ceiling.drawCalls', (g, r) => { r.report.peak.drawCalls = 9999; }],
  ['ceiling.triangles', (g, r) => { r.report.peak.triangles = 9e9; }],
  ['ceiling.programs', (g, r) => { r.report.peak.programs = 9999; }],
  ['ceiling.targetMemory', (g, r) => { r.memory.targetMemoryMB = 9999; }],
  ['ceiling.chunkMemory', (g, r) => { r.memory.chunkMemoryMB = 9999; }],
  ['floor.metresTravelled', (g, r) => { r.routeInfo.metresTravelled = 1; }],
  ['floor.drawCalls', (g, r) => { r.report.peak.drawCalls = 1; }],
  ['floor.triangles', (g, r) => { r.report.peak.triangles = 1; }],
  ['floor.distinctMaterials', (g, r) => { r.report.distinctMaterials = 1; }],
  ['floor.visibleInstances', (g, r) => { r.report.visibleInstances = 1; }],
  /**
   * SESSION 16: real PNGs, and each one is the case the assertion's own failure
   * message names. The two they replace were raw `Uint8Array`s that were never
   * PNGs at all — so the old cases proved the comparison worked and could not
   * have proved the input did.
   *
   * `solidPNG(128)` is a flat grey frame: entropy 0 by construction (one bin
   * holds everything), mean 128/255 = 0.502, which is INSIDE the [0.08, 0.55]
   * band on purpose — it must fail the entropy floor and nothing else, or the
   * case is testing two assertions and identifying neither.
   *
   * `solidPNG(2)` is the "black screen" the mean assertion names. It fails the
   * mean floor at 2/255 = 0.0078 and it also fails entropy, which is not a
   * defect in the case but the arithmetic in `$screenshotEntropy_s16`: no
   * histogram with a mean that low can carry 6.8 bits, so a frame that
   * breaches the mean floor CANNOT be constructed to pass the entropy one. The
   * two floors are not independent and the fixtures are where that shows.
   */
  /**
   * SESSION 21 — THEY PERTURB EVERY RUN NOW, and that is not cosmetic.
   *
   * Both statistics are the MEDIAN of the per-run frames as of this session
   * (see `metrics.meanLuminance`), so a case that darkened the LAST run's shot
   * and left the other two alone would be outvoted 2:1 and would report the
   * assertion as unfalsifiable — which is CONTRACT §7.1's quiet gate arriving
   * by way of an estimator change. STATE 20 §7 named this in advance: *"the two
   * falsifying cases would have to perturb every run rather than the last,
   * exactly as the timing cases do."* `ceiling.cpuP95` above is the shape.
   */
  ['floor.screenshotEntropy', (g) => { for (const x of g.runs) x.shot = solidPNG(128); }],
  /** The near-floor case. `levelsPNG(16)` is exactly 4.000 bits — see its own
   *  comment for why one case three orders from the threshold is not enough. */
  ['floor.screenshotEntropy.nearFloor', (g) => { for (const x of g.runs) x.shot = levelsPNG(16); }],
  ['floor.meanLuminance', (g) => { for (const x of g.runs) x.shot = solidPNG(2); }],
  /**
   * SESSION 20. The HUD's copy of the ceilings, drifted by one key. It mutates
   * the GROUP rather than a run because the table is not a per-route quantity —
   * it is one file against another, checked once per route because that is
   * where `assertRoute` runs and running it four times costs nothing.
   */
  ['hud.budgetDrift', (g) => {
    g.hudBudgets = { ...HUD.budgets, drawCalls: HUD.budgets.drawCalls + 1 };
    return () => { g.hudBudgets = { ...HUD.budgets }; };
  }],
  /**
   * SESSION 20. The searchlight stopped being created — which reads as one more
   * spare slot, which is the shape of failure `$floors` exists for.
   */
  ['floor.role.aircraft', (g, r) => {
    const was = r.roles.byRole.aircraft;
    r.roles.byRole.aircraft = 0;
    return () => { r.roles.byRole.aircraft = was; };
  }],
  ['hard.consoleErrors', (g, r) => { r.report.errors = ['boom']; }],
  ['hard.contextLost', (g, r) => { r.report.contextLost = 1; }],
  ['particles.missingInstrument', (g, r) => { r.particles = null; }],
  ['particles.noLayers', (g, r) => { r.particles = []; }],
  ['particles.layerMissing', (g, r) => { r.particles = r.particles.slice(1); }],
  ['particles.layerCount', (g, r) => { r.particles[0].allocated = 5000; }],
  ['particles.layerArea', (g, r) => { r.particles[1].declaredDefine = 999; }],
  ['particles.totalCount', (g, r) => { for (const l of r.particles) l.allocated = 400; }],
  ['particles.runtimeClamp', (g, r) => { r.particles[0].clampCompileTime = false; }],
  ['particles.noArea', (g, r) => { r.particles[0].declaredDefine = 0; r.particles[0].maxAreaPx = 0; }],
  ['particles.fill', (g, r) => { for (const l of r.particles) { l.allocated = 230; l.declaredDefine = 168; } }],
  // A layer with no cap entry, so only the GLOBAL maxAreaPx site can catch it.
  ['particles.globalArea', (g, r) => {
    r.particles.push({ name: 'rain_extra', allocated: 1, drawn: 1, maxAreaPx: 999, clampCompileTime: true, declaredDefine: 999 });
  }],
  // The two GPU-timer branches. They are inert on this machine — ANGLE-Metal
  // never retires a query — but an inert assertion is still an assertion, and
  // one nobody can falsify is exactly what CONTRACT §7 is about.
  ['ceiling.gpuP95', (g) => {
    for (const x of g.runs) {
      x.report.method = 'gpu-timer-query';
      x.report.frames.gpuMs = new Array(200).fill(99);
    }
  }],
  ['ceiling.gpuMax', (g) => {
    for (const x of g.runs) {
      x.report.method = 'gpu-timer-query';
      x.report.frames.gpuMs = new Array(200).fill(1);
      x.report.frames.gpuMs[0] = 999;
    }
  }],
  ['cluster.missing', (g, r) => { r.routeInfo.cluster = null; }],
  ['cluster.unsaturated', (g, r) => { r.routeInfo.cluster.trafficLights = 0; }],
  /**
   * SESSION 21. The defect exactly as session 19 measured it — a hauler's nose
   * 3.30 m past its own line — and the UNRUN case, which is the one an
   * inequality alone would pass.
   */
  ['traffic.stopLinePast', (g, r) => { r.traffic.worstStopLineM = -3.3; }],
  ['traffic.stopLineUnrun', (g, r) => { r.traffic.worstStopLineM = Infinity; }],
  ['cluster.overflow', (g, r) => { r.routeInfo.cluster.overflow = true; }],
  ['cluster.margin', (g, r) => { r.routeInfo.cluster.occupancyMargin = 0; }],
  ['motion.missingInstrument', (g, r) => { r.motion = null; }],
  ['motion.tooFewLayers', (g, r) => { r.motion.layers = [{ label: 'a' }]; }],
  ['motion.swapViolation', (g, r) => { r.motion.sameFrameViolations = 1; }],
  ['motion.neverRead', (g, r) => { r.motion.reads = 0; }],
  ['motion.nothingWritten', (g, r) => { r.motion.written = 0; }],
  ['roles.missingInstrument', (g, r) => { r.roles = null; }],
  ['roles.unrolled', (g, r) => { r.roles.unrolled = 3; }],
  ['roles.ceiling', (g, r) => { r.roles.byRole.traffic = 500; }],
  ['roles.floor', (g, r) => { r.roles.byRole.traffic = 0; }],
  ['roles.poolOverfull', (g, r) => { r.roles.total = 9999; }],
  ['traffic.missing', (g, r) => { r.traffic = null; }],
  ['traffic.vehicles', (g, r) => { r.traffic.vehicles = 1; }],
  ['traffic.headlamps', (g, r) => { r.traffic.headlamps = 1; }],
  ['traffic.bodyTypes', (g, r) => { r.traffic.bodyTypes = 1; }],
  ['traffic.minExtentUnknownKind', (g, r) => { r.traffic.minExtentM.a_new_body_type = 1.2; }],
  ['traffic.minExtentDisagrees', (g, r) => { r.traffic.minExtentM.wedge += 0.5; }],
  // The silhouette block. Every one of these is a frame in which the vehicles
  // are boxes and every count-based floor in this file is still green.
  /**
   * This one perturbs the BUDGET rather than the fixture, because the failure
   * it models is a budget that has drifted: a route renamed in `capture.routes`
   * and not in `silhouettes.routes` leaves the whole block applying to nothing.
   * A mutate may return a restore, which the loop calls.
   */
  ['silhouette.routeListDrifted', () => {
    const S = BUDGET.silhouettes;
    const saved = S.routes;
    S.routes = ['a_route_that_was_renamed'];
    return () => { S.routes = saved; };
  }],
  ['silhouette.missingInstrument', (g, r) => { g.silhouettes = null; }],
  ['silhouette.measurementError', (g, r) => { g.silhouettes = { error: 'size mismatch' }; }],
  ['silhouette.labelDrift', (g, r) => { g.silhouettes.problems = ['ped: partVertices 36 does not divide 200']; }],
  ['silhouette.tooFewMeasured', (g, r) => { g.silhouettes.kinds.vehicle.n = 0; }],
  ['silhouette.groundContrastMedian', (g, r) => { g.silhouettes.kinds.vehicle.groundContrast.median = 0.02; }],
  ['silhouette.groundContrastSpread', (g, r) => { g.silhouettes.kinds.vehicle.groundContrastPassFraction = 0.3; }],
  ['silhouette.lumaRoughnessMedian', (g, r) => { g.silhouettes.kinds.vehicle.lumaRoughness.median = 0.01; }],
  ['silhouette.lumaRoughnessSpread', (g, r) => { g.silhouettes.kinds.vehicle.lumaRoughnessPassFraction = 0.2; }],
  // The roofline, CONTRACT §7.3. 0.000 is what a rectangular prism reads and
  // is therefore the honest perturbation rather than a small number chosen to
  // be under the floor.
  ['silhouette.roofSpanMedian', (g, r) => { g.silhouettes.kinds.vehicle.roofSpan.median = 0.0; }],
  ['silhouette.roofSpanSpread', (g, r) => { g.silhouettes.kinds.vehicle.roofSpanPassFraction = 0.4; }],
  ['silhouette.roofProfileTooFew', (g, r) => { g.silhouettes.kinds.vehicle.nProfile = 0; }],
  // The width along the long axis, CONTRACT §7.5. 0.000 is what a body of
  // constant width reads, so it is the honest perturbation rather than a small
  // number picked to sit under the floor.
  ['silhouette.widthSpanMedian', (g, r) => { g.silhouettes.kinds.vehicle.widthSpan.median = 0.0; }],
  ['silhouette.widthSpanSpread', (g, r) => { g.silhouettes.kinds.vehicle.widthSpanPassFraction = 0.4; }],
  // The population floor and the decline count are ONE failure site with two
  // causes, and the case perturbs the cause the delivered fleet actually has:
  // every subject declined because its own parts are too long to measure.
  ['silhouette.widthTooFew', (g, r) => {
    g.silhouettes.kinds.vehicle.nWidth = 0;
    g.silhouettes.kinds.vehicle.nWidthDeclinedBias = g.silhouettes.kinds.vehicle.n;
  }],
  ['silhouette.chromaClusters', (g, r) => { g.silhouettes.kinds.vehicle.chromaClusters = 1; }],
  ['silhouette.paletteMissing', (g, r) => { g.silhouettes.palette = {}; }],
  ['silhouette.paletteTooSmall', (g, r) => { g.silhouettes.palette.vehicle = 1; }],
  // The pedestrian kind on its own, so a vehicle-only fix cannot leave it green.
  ['silhouette.widthRoughnessMedian', (g, r) => { g.silhouettes.kinds.pedestrian.widthRoughness.median = 0.005; }],
  ['silhouette.widthRoughnessSpread', (g, r) => { g.silhouettes.kinds.pedestrian.widthRoughnessPassFraction = 0.1; }],
  ['silhouette.pedestrianTooFew', (g, r) => { g.silhouettes.kinds.pedestrian.n = 1; }],
];

/**
 * THE ESTIMATOR ITSELF, TESTED TWO-SIDEDLY. CONTRACT §0 rule 6, §7.1.
 *
 * Every case above asks "does this assertion reject a bad world". This block
 * asks the question the estimator change makes necessary and which no other
 * case can ask: does the gate now REFUSE to reject a world whose only problem
 * is one drifted run, and does it still reject one that is genuinely over?
 *
 * A one-sided test would pass an estimator that rejects everything, and it
 * would also pass one that rejects nothing — this change could go wrong in
 * either direction and the second is the dangerous one, because a ceiling that
 * can no longer be breached is CONTRACT §0 rule 5 violated by an estimator
 * rather than by a number.
 *
 * The observations are the five this session inherited, verbatim from
 * STATE.md: 11.20, 11.40, 11.70, 12.20, 12.60 ms against a 12.5 ms ceiling.
 */
const ESTIMATOR_CASES = [
  {
    id: 'oneDriftedRunDoesNotFail',
    wall: [11.2, 11.4, 12.6],
    expectFail: false,
    why:
      'the single breaching run out of three is the observation that made this gate red one run in ' +
      'three; the median of 11.40 is 1.10 ms under the ceiling and the gate must be green',
  },
  {
    id: 'genuineBreachStillFails',
    wall: [12.6, 12.7, 12.8],
    expectFail: true,
    why:
      'three runs over the ceiling is not drift, it is a regression, and an estimator that cannot ' +
      'see it has replaced a coin toss with a rubber stamp',
  },
  {
    id: 'twoOfThreeOverFails',
    wall: [11.2, 12.6, 12.7],
    expectFail: true,
    why:
      'the median of three tolerates exactly ONE contaminated observation and no more — that is the ' +
      'property it was chosen for, and it is the boundary of the claim',
  },
  {
    id: 'atTheCeilingIsNotOverIt',
    wall: [12.5, 12.5, 12.5],
    expectFail: false,
    why: 'the comparison is strictly greater-than, as it was before; equality was never a breach',
  },
];

/**
 * THE SHAPE CONTROLS. CONTRACT §7.3, and it is a different question from every
 * case in `FALSIFY`.
 *
 * Those cases ask "does this assertion reject a bad world" by handing the
 * assertion a number. They cannot ask whether the number MEANS anything,
 * because they never compute one. `darkFraction` would have passed every one of
 * them: set it to 0.01 and the gate goes red exactly as it should, while the
 * metric itself scored 0.646 on flat grey boxes and 0.6-something on everything
 * else, and the two answers were the same answer.
 *
 * So the metric is run twice, over the SAME code path, on a shape that has the
 * property and a shape that does not, and both directions are required. A
 * one-sided control passes a metric that says yes to everything, which is the
 * failure `gateaudit` already guards against one level up.
 *
 * AND IT IS RUN AT EVERY VIEW IN `silhouettes.shapeControlViews`, WHICH IS THE
 * PART SESSION 6b ADDED AND THE PART THAT WOULD HAVE CAUGHT THE LAST DEFECT.
 * The previous control was a single orthographic side elevation and BOTH its
 * directions held — prism 0.0000, three-box 0.3403 — while the delivered metric
 * returned about 0.02 for a prism, a three-box saloon AND the fleet's own wedge
 * at three-quarter view, because the mask is a union of per-box hulls and a
 * tall box's hull covers its neighbours' stations as the subject turns. A
 * control at one view can only certify one view. `budget.json` ->
 * `silhouettes.$UNION_DEFECT` carries the measurement.
 */
function runShapeControls() {
  const problems = [];
  const S = BUDGET.silhouettes;
  const floor = S.kinds.vehicle.minRoofSpan;
  const V = S.shapeControlViews;
  if (!V || !V.anglesDeg || !V.anglesDeg.length || !V.distancesM || !V.distancesM.length) {
    problems.push(
      'shape control: silhouettes.shapeControlViews is missing or empty, so the controls would run at no ' +
      'view at all — an assertion that applies to nothing is CONTRACT §7.1 exactly'
    );
    return problems;
  }

  const rows = [];
  let worstPositive = Infinity;
  let worstNegative = -Infinity;
  let tested = 0;
  const testedAt = new Map(V.distancesM.map((d) => [d, 0]));
  for (const distanceM of V.distancesM) {
    for (const angleDeg of V.anglesDeg) {
      const opts = { angleDeg, distanceM };
      // `.roof`, because `measureShapeControl` now returns the roofline and the
      // §7.5 width reading as a NAMED PAIR: the two decline at opposite ends of
      // the same angle range, so collapsing them into one value would make "no
      // roofline here" and "no reading at all here" the same answer.
      const prism = measureShapeControl(stepsToBoxes(SHAPE_CONTROLS.prism, V.wideM), S, opts).roof;
      const threeBox = measureShapeControl(stepsToBoxes(SHAPE_CONTROLS.threeBox, V.wideM), S, opts).roof;

      /**
       * DECLINED IS NOT UNTESTED, AND ONE OF EACH IS A BUG.
       *
       * Past about 64 degrees at 45 m the trimmed long axis projects under
       * `minStationPx * stations` = 48 px and `measureRoofProfile` excludes the
       * subject on geometry before it reads a pixel — which is the instrument
       * working, not the control failing, and a sweep that stopped short of it
       * would never exercise the exclusion. So BOTH shapes returning null at a
       * view is recorded and skipped.
       *
       * ONE of them returning null is not: the two controls are the same 4.90 m
       * long and are seen from the same place, so they are admissible or not
       * together, and a view where only one is measured is a view where the
       * comparison being made is not the one being reported.
       *
       * `minViewsTested` below is what stops "declined" becoming the answer
       * everywhere, which would be §7.1's quiet gate wearing a sweep.
       */
      if (!prism && !threeBox) {
        rows.push(
          `${String(distanceM).padStart(3)} m ${String(angleDeg).padStart(3)}°  ` +
          `declined — trimmed axis under minStationPx x stations = ` +
          `${S.minStationPx * S.stations} px`
        );
        continue;
      }
      if (!prism || !threeBox) {
        problems.push(
          `shape control at ${angleDeg}° from broadside / ${distanceM} m: ${prism ? 'the three-box' : 'the prism'} ` +
          `was excluded and ${prism ? 'the prism' : 'the three-box'} was not, at the same view of two ` +
          `shapes of the same length — so the two directions were compared at different views`
        );
        continue;
      }
      tested++;
      testedAt.set(distanceM, testedAt.get(distanceM) + 1);
      if (!(prism.roofSpan < floor)) {
        problems.push(
          `shape control NEGATIVE at ${angleDeg}° from broadside / ${distanceM} m: a rectangular prism ` +
          `scored roofSpan ${prism.roofSpan.toFixed(4)} against a floor of ${floor} and must score under ` +
          `it. A prism reads the same fraction of its own height at every station, so anything but ~0 ` +
          `means the metric is measuring the sampling and not the shape — which is exactly what ` +
          `silhouettes.$DISCARDED_darkFraction did.`
        );
      }
      if (!(threeBox.roofSpan >= floor)) {
        problems.push(
          `shape control POSITIVE at ${angleDeg}° from broadside / ${distanceM} m: reference-era three-box ` +
          `proportions scored roofSpan ${threeBox.roofSpan.toFixed(4)} against a floor of ${floor} and ` +
          `must clear it AT EVERY VIEW. A floor no real body can reach is CONTRACT §7.1's other ` +
          `direction: a check that rejects everything. A floor a real body clears at broadside and not ` +
          `at three-quarter view is silhouettes.$UNION_DEFECT arriving again — the mask, not the body.`
        );
      }
      worstPositive = Math.min(worstPositive, threeBox.roofSpan);
      worstNegative = Math.max(worstNegative, prism.roofSpan);
      rows.push(
        `${String(distanceM).padStart(3)} m ${String(angleDeg).padStart(3)}°  ` +
        `prism ${prism.roofSpan.toFixed(4)}  three-box ${threeBox.roofSpan.toFixed(4)} ` +
        `(levels ${threeBox.roofLevels}, top share ${threeBox.roofTopFraction})`
      );
    }
  }

  const views = V.anglesDeg.length * V.distancesM.length;
  if (tested < V.minViewsTested) {
    problems.push(
      `shape control: only ${tested} of ${views} views were measurable against a floor of ` +
      `${V.minViewsTested} — the sweep has gone quiet, and a control that certifies nothing is ` +
      `indistinguishable from one that certifies everything (CONTRACT §7.1)`
    );
  }
  for (const [d, n] of testedAt) {
    if (!n) {
      problems.push(
        `shape control: no view at ${d} m was measurable, so the sweep covers one distance and the ` +
        `near-edge lift the overshoot exists for was never exercised`
      );
    }
  }

  console.log(
    `perfcheck --falsify: shape controls over ${V.anglesDeg.length} angles x ${V.distancesM.length} ` +
    `distances at ${V.wideM} m wide — ${tested}/${views} views measurable (floor ${V.minViewsTested}), ` +
    `floor ${floor}, worst three-box ${worstPositive.toFixed(4)} (must clear), ` +
    `worst prism ${worstNegative.toFixed(4)} (must not)`
  );
  if (args.has('verbose')) console.log(rows.map((r) => '    ' + r).join('\n'));
  return problems;
}

/**
 * THE WIDTH CONTROLS. CONTRACT §7.3, §7.3.1 and §7.5.
 *
 * A SEPARATE SWEEP FROM `runShapeControls` AND NOT A LOOP INSIDE IT, because the
 * two metrics are admissible at opposite ends of the same angle range: the
 * roofline declines end-on where the long axis stops projecting, and the width
 * declines at broadside where the lateral axis points down the line of sight and
 * has not started. One sweep would have had to decline for two unrelated reasons
 * and would have made `minViewsTested` meaningless for both.
 *
 * FOUR ARMS, AND THE PAIR THAT CARRIES THE VERDICT IS THE MIDDLE TWO. §7.3 asks
 * for a shape with the property and one without; for this metric that pair is not
 * enough, because `budget.json` -> `$widthOverRead` shows the reading responds to
 * how LONG a body's parts are as well as to how WIDE they are, and a one-box prism
 * against a fourteen-segment loft differs in both at once. So `segPrism` and
 * `taper` are the same 14 segments of the same length at the same maximum width,
 * differing in the width profile and in nothing else — the same construction as
 * `hullprobe`'s 0.02 m arm, which attributed the union defect by holding
 * everything but the width fixed.
 *
 * `longPrism` and `stepPrism` are the delivered fleet's own two structures — one
 * long box, and unequal long boxes — at constant width. They are required to be
 * under the floor WHERE THEY ARE MEASURABLE and they mostly are not measurable,
 * which is the finding rather than a gap: a body of long boxes cannot be measured
 * this way except near end-on. `$maxWidthBias_isLoadBearing` carries what they
 * read with the exclusion switched off, and two of them clear the floor there.
 */
function runWidthControls() {
  const problems = [];
  const S = BUDGET.silhouettes;
  const floor = S.kinds.vehicle.minWidthSpan;
  const V = S.widthControlViews;
  if (!V || !V.anglesDeg || !V.anglesDeg.length || !V.distancesM || !V.distancesM.length) {
    problems.push(
      'width control: silhouettes.widthControlViews is missing or empty, so the §7.5 controls would run at ' +
      'no view at all — an assertion that applies to nothing is CONTRACT §7.1 exactly'
    );
    return problems;
  }
  if (floor == null) {
    problems.push(
      'width control: silhouettes.kinds.vehicle.minWidthSpan is absent, so there is no floor for the ' +
      'controls to be checked against in either direction'
    );
    return problems;
  }

  const rows = [];
  let worstPositive = Infinity;
  let worstNegative = -Infinity;
  let worstNegativeAt = '';
  let tested = 0;
  const testedAt = new Map(V.distancesM.map((d) => [d, 0]));
  const read = (id, opts) => measureShapeControl(WIDTH_CONTROLS[id], S, opts).width;
  const ok = (w) => !!(w && !w.declined && w.widthSpan != null);

  for (const distanceM of V.distancesM) {
    for (const angleDeg of V.anglesDeg) {
      const opts = { angleDeg, distanceM };
      const seg = read('segPrism', opts);
      const tap = read('taper', opts);
      const why = (w) =>
        !w ? `no reading — probe under minLatSegPx ${S.minLatSegPx} px, or every station saturated latOvershoot ${S.latOvershoot}`
          : `declined — over-read spread ${w.biasTotal} > maxWidthBias ${S.maxWidthBias}`;

      /**
       * DECLINED IS NOT UNTESTED, AND ONE OF EACH IS A BUG. Three exclusions can
       * fire here and all three are the instrument working rather than the control
       * failing: the probe under `minLatSegPx`, the reading saturating
       * `latOvershoot`, and `maxWidthBias`. So BOTH shapes declining at a view is
       * recorded and skipped.
       *
       * ONE of them declining is not. The two are the same 4.90 m long and the same
       * 1.80 m wide seen from the same place, so they are admissible together or
       * not at all, and a view where only one is measured is a view where the
       * comparison being reported is not the one being made. MEASURED: zero
       * mismatches over all 24 views and over six values of `maxWidthBias` from
       * 0.015 to 0.05.
       */
      if (!ok(seg) && !ok(tap)) {
        rows.push(
          `${String(distanceM).padStart(3)} m ${String(angleDeg).padStart(3)}°  ${why(seg)}`
        );
        continue;
      }
      if (!ok(seg) || !ok(tap)) {
        problems.push(
          `width control at ${angleDeg}° from broadside / ${distanceM} m: ${ok(seg) ? 'the taper' : 'the segmented prism'} ` +
          `was excluded and ${ok(seg) ? 'the segmented prism' : 'the taper'} was not, at the same view of two shapes ` +
          `of the same length and the same maximum width — so the two directions were compared at ` +
          `different views. Excluded one: ${why(ok(seg) ? tap : seg)}`
        );
        continue;
      }
      tested++;
      testedAt.set(distanceM, testedAt.get(distanceM) + 1);

      if (!(seg.widthSpan < floor)) {
        problems.push(
          `width control NEGATIVE at ${angleDeg}° from broadside / ${distanceM} m: a body of exactly CONSTANT ` +
          `width scored widthSpan ${seg.widthSpan.toFixed(4)} against a floor of ${floor} and must score under ` +
          `it. A constant-width body reads the same fraction of its own width at every station, so anything ` +
          `approaching the floor means the metric is measuring the over-read and not the shape — which is ` +
          `what silhouettes.$maxWidthBias_isLoadBearing measured happening with the exclusion off.`
        );
      }
      if (!(tap.widthSpan >= floor)) {
        problems.push(
          `width control POSITIVE at ${angleDeg}° from broadside / ${distanceM} m: reference-era plan taper ` +
          `scored widthSpan ${tap.widthSpan.toFixed(4)} against a floor of ${floor} and must clear it AT EVERY ` +
          `ADMISSIBLE VIEW. A floor no real body can reach is CONTRACT §7.1's other direction: a check that ` +
          `rejects everything.`
        );
      }
      if (tap.widthSpan < worstPositive) worstPositive = tap.widthSpan;
      for (const id of ['segPrism', 'longPrism', 'stepPrism']) {
        const w = read(id, opts);
        if (!ok(w)) continue;
        /**
         * THE TWO ATTRIBUTION ARMS ARE HELD TO THE NEGATIVE DIRECTION TOO, where
         * they are measurable. They are constant-width bodies with the delivered
         * fleet's own part structure, so either of them clearing the floor would
         * mean the metric rewards part length rather than taper.
         */
        if (id !== 'segPrism' && !(w.widthSpan < floor)) {
          problems.push(
            `width control NEGATIVE arm '${id}' at ${angleDeg}° / ${distanceM} m: a CONSTANT-WIDTH body with ` +
            `the delivered fleet's part structure scored ${w.widthSpan.toFixed(4)} against a floor of ${floor}. ` +
            `The metric is responding to how long the parts are rather than to how the width varies, which is ` +
            `silhouettes.$widthOverRead escaping its own bound.`
          );
        }
        if (w.widthSpan > worstNegative) {
          worstNegative = w.widthSpan;
          worstNegativeAt = `${id} @${angleDeg}°/${distanceM} m`;
        }
      }
      rows.push(
        `${String(distanceM).padStart(3)} m ${String(angleDeg).padStart(3)}°  ` +
        `segPrism ${seg.widthSpan.toFixed(4)}  taper ${tap.widthSpan.toFixed(4)} ` +
        `(over-read ${tap.biasTotal}, widest share ${tap.widthTopFraction}, probe ${tap.latPxMin} px)`
      );
    }
  }

  const views = V.anglesDeg.length * V.distancesM.length;
  if (tested < V.minViewsTested) {
    problems.push(
      `width control: only ${tested} of ${views} views were measurable against a floor of ` +
      `${V.minViewsTested} — the sweep has gone quiet, and a control that certifies nothing is ` +
      `indistinguishable from one that certifies everything (CONTRACT §7.1)`
    );
  }
  for (const [d, n] of testedAt) {
    if (!n) {
      problems.push(
        `width control: no view at ${d} m was measurable, so the sweep covers fewer distances than it ` +
        `declares — and silhouettes.$widthControlDistances says the admissible angle band MOVES with ` +
        `distance, so a missing distance is a missing part of the band rather than a repeated one`
      );
    }
  }

  console.log(
    `perfcheck --falsify: §7.5 width controls over ${V.anglesDeg.length} angles x ${V.distancesM.length} ` +
    `distances at ${V.wideM} m wide — ${tested}/${views} views measurable (floor ${V.minViewsTested}), ` +
    `floor ${floor}, worst taper ${worstPositive === Infinity ? 'n/a' : worstPositive.toFixed(4)} (must clear), ` +
    `worst constant-width ${worstNegative === -Infinity ? 'n/a' : worstNegative.toFixed(4)} (must not) ${worstNegativeAt}`
  );
  if (args.has('verbose')) console.log(rows.map((r) => '    ' + r).join('\n'));
  return problems;
}

function runEstimatorCases() {
  const problems = [];
  for (const c of ESTIMATOR_CASES) {
    const g = goodFixture(c.wall.length);
    c.wall.forEach((ms, i) => { g.runs[i].report.frames.wallMs = new Array(200).fill(ms); });
    const out = assertRoute(g);
    const wallFails = out.fails.filter((f) => /frame interval p95/.test(f));
    if (c.expectFail && !wallFails.length) {
      problems.push(
        `estimator '${c.id}': runs ${c.wall.join(' / ')} ms produced NO wall failure and should have — ${c.why}`
      );
    }
    if (!c.expectFail && wallFails.length) {
      problems.push(
        `estimator '${c.id}': runs ${c.wall.join(' / ')} ms produced ${wallFails.length} wall failure(s) ` +
        `and should have produced none — ${c.why}`
      );
    }
  }
  return problems;
}

if (args.has('falsify')) {
  const control = assertRoute(goodFixture());
  const problems = [];
  if (control.fails.length) {
    problems.push(
      `the GOOD fixture failed ${control.fails.length} assertion(s), so every case below is ` +
      `meaningless: ${control.fails.slice(0, 4).join(' | ')}`
    );
  }
  const messages = new Set();
  let rejected = 0;
  problems.push(...runEstimatorCases());
  problems.push(...runShapeControls());
  problems.push(...runWidthControls());

  for (const [id, mutate] of FALSIFY) {
    const g = goodFixture();
    // The LAST run, which is the one `assertRoute` reads every non-timing field
    // from. Timing cases take `g` and perturb all of them.
    const restore = mutate(g, g.runs[g.runs.length - 1]);
    const out = assertRoute(g);
    if (typeof restore === 'function') restore();
    if (out.fails.length === 0) {
      problems.push(`'${id}' was NOT rejected — the assertion it falsifies does not reject anything`);
    } else {
      rejected++;
      for (const f of out.fails) messages.add(f.replace(/[0-9][0-9.]*/g, 'N'));
    }
  }

  /**
   * COVERAGE. Count the failure sites in this file's own assertion functions
   * and require a case for each. A registry that only lists the cases somebody
   * remembered is the rule with an exception in it.
   */
  const src = await readFile(new URL(import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('function assertParticles'), src.indexOf('function goodFixture'));
  // Count only the sites that PRODUCE a failure. A `fails.push(...somethingElse)`
  // line aggregates somebody else's, and `const fail = (m) =>` is the helper's
  // own definition; counting those inflates the denominator, which makes the
  // coverage number a lie in the flattering direction — and the first run of
  // this did exactly that, reporting 83% against six lines that assert nothing.
  const siteLines = body.split('\n').filter((l) =>
    /fails\.push\(|[^.\w]fail\(/.test(l) &&
    !/fails\.push\(\.\.\./.test(l) &&
    !/const fail = /.test(l)
  );
  const sites = siteLines.length;
  const coverage = sites ? Math.min(1, FALSIFY.length / sites) : 0;
  if (coverage < (BUDGET.falsify ? BUDGET.falsify.requireCoverage : 1)) {
    problems.push(
      `${FALSIFY.length} falsifying cases against ${sites} failure sites in the assertion functions ` +
      `— coverage ${(coverage * 100).toFixed(0)}%. A gate without a known case that makes it fail ` +
      `does not count as a gate (CONTRACT §7).`
    );
  }

  console.log(
    `perfcheck --falsify: ${rejected}/${FALSIFY.length} cases rejected, ` +
    `${messages.size} distinct failure messages, ${sites} failure sites, ` +
    `coverage ${(coverage * 100).toFixed(0)}%; ` +
    `${ESTIMATOR_CASES.length} estimator cases, ` +
    `${ESTIMATOR_CASES.filter((c) => c.expectFail).length} must reject and ` +
    `${ESTIMATOR_CASES.filter((c) => !c.expectFail).length} must not`
  );
  if (problems.length) {
    console.log('\nFALSIFY PROBLEMS\n' + problems.map((p) => '  ✗ ' + p).join('\n'));
    process.exit(1);
  }
  console.log('Every assertion in perfcheck has a known case that makes it fail, and it was exercised.');
  process.exit(0);
}

// ---------------------------------------------------------------------------

let server;
let browser;
try {
  server = await startServer(5179);
  SERVER_URL = server.url;
  browser = await launch();
} catch (e) {
  if (server) server.child.kill('SIGKILL');
  console.error('harness: could not start —', e.message);
  process.exit(2);
}

const page = await browser.newPage({
  viewport: { width: BUDGET.capture.viewport.width, height: BUDGET.capture.viewport.height },
});

const routes = args.has('route') ? [args.get('route')] : BUDGET.capture.routes;
const results = [];
const allFails = [];
let anyGpuTimers = false;

/**
 * RUNS PER ROUTE. `budget.json` → `capture.runs`, CONTRACT §0 rule 6.
 *
 * `--runs=1` exists for iterating on content, prints that it is doing so, and
 * is NOT what `npm run gates` does: `capture.runs` is the number the gate
 * decides on and the flag cannot raise it above what the budget asks for
 * without saying so in the output.
 */
const RUNS = Math.max(1, Number(args.get('runs') || BUDGET.capture.runs || 1));

try {
  for (const route of routes) {
    const runsRaw = [];
    for (let r = 0; r < RUNS; r++) {
      /**
       * THE SILHOUETTE POSES ARE TAKEN ON EVERY RUN — session 10, and it is
       * §0 rule 6 applied to a population instead of to a frame time.
       *
       * They used to be taken once, on the last run, to save wall clock, with
       * a comment recording that the population is NOT identical between runs:
       * same code, same seed, same three pose parameters, `--runs=1` reported
       * 19 vehicles and 57 pedestrians measurable and `--runs=3` reported 17
       * and 55, with the vehicle ground contrast moving 0.6561 to 0.7293 and
       * its pass fraction across the 0.75 floor. The camera positions ARE
       * identical; how much of the world had streamed in behind them by the
       * time the poses were taken is not, because `waitForCity` is bounded in
       * wall time and the page carries three routes of browser state by the
       * third run instead of one.
       *
       * That comment named the defect and then measured one draw of it anyway.
       * Five sessions of reports have carried `highway_speed` reds that are
       * this and nothing else — tone profile 10 of 14 against a 0.75 floor,
       * width population 4 against a floor of 5 — on content nobody had
       * changed. Three poses is a sample of fourteen, and a fraction over
       * fourteen has a standard error of 12 points against a floor 4 points
       * away.
       *
       * SO THE SUBJECTS ARE POOLED AND THE COUNTS ARE NOT, and the reason they
       * are pooled differently is the reason each threshold exists:
       *
       * - A FRACTION and a MEDIAN are estimates of a population property. Nine
       *   poses estimate the same property as three, with 1/sqrt(3) of the
       *   error. The floor does not scale with the sample, so pooling the
       *   subjects moves no threshold — it moves the noise.
       * - A COUNT FLOOR asks "did one run's poses see enough subjects to say
       *   anything at all". Pooling three runs' subjects would multiply it by
       *   three and satisfy `minWidthMeasured: 5` with the arithmetic instead
       *   of with the route, which is rule 5 broken by an estimator. So the
       *   count floors take the MEDIAN OF THE PER-RUN COUNTS — the same
       *   estimator `capture.$estimator` uses, for the same reason, over the
       *   same number of draws.
       *
       * The cost is 6 more pose captures on one route (`silhouettes.routes` is
       * `["highway_speed"]`), which is 144 pose frames and 6 screenshots.
       */
      runsRaw.push(await measureRoute(page, route, { silhouettes: true }));
    }
    const last = runsRaw[runsRaw.length - 1];
    /**
     * The pooled population: every run's poses through the same measurement,
     * summarised once. `summariseSilhouettes` takes the samples and does not
     * care which run each came from, which is what makes this a bigger sample
     * of one quantity rather than an average of three quantities.
     */
    const pooledSil = summariseSilhouettes(
      route,
      runsRaw.flatMap((x) => x.silhSamples || []),
      last.paletteRaw
    );
    const checked = assertRoute({
      route,
      runs: runsRaw,
      silhouettes: pooledSil,
      silhouettesPerRun: runsRaw.map((x) => x.silhouettes),
    });
    anyGpuTimers ||= checked.usingGpuTimers;
    results.push({ route, ...checked.metrics });
    allFails.push(...checked.fails);

    await mkdir(new URL('./perf-out/', import.meta.url), { recursive: true });
    /**
     * ═══════════════════════════════════════════════════════════════════════
     * THE FRAME WRITTEN IS THE ONE THE ASSERTION IS ABOUT — SESSION 77.
     * ═══════════════════════════════════════════════════════════════════════
     *
     * This wrote `last.shot` while the two level statistics have been the
     * MEDIAN of three runs since session 21, so the PNG on disk and the number
     * in the report could come from different runs — and in session 76 they
     * did. `downtown_dense` delivered entropy [4.814 4.898 5.034], failed on
     * the median 4.898, and wrote the 5.034 frame. The last line of this gate
     * says *"look at them before changing any numbers in budget.json"*, and a
     * reader who did was looking at the run that PASSED.
     *
     * The median run by entropy is the one both level assertions are decided
     * on, so it is the one a person has to be able to look at. Ties and an
     * absent metric fall back to the last run, which is what this always did.
     */
    const medianRun = (() => {
      /** `entropyPerRun` is `runsRaw`'s own order — both are `runs.map(...)`. */
      const H = checked.metrics.entropyPerRun;
      if (!Array.isArray(H) || H.length !== runsRaw.length || !H.every(Number.isFinite)) return last;
      const order = H.map((h, i) => [h, i]).sort((a, b) => a[0] - b[0]);
      return runsRaw[order[H.length >> 1][1]];
    })();
    await writeFile(new URL(`./perf-out/${route}.png`, import.meta.url), medianRun.shot);
    // The poses the silhouette assertions were measured on, written beside the
    // route frame. §10 step 4: a gate that asserts on pixels has to put the
    // pixels somewhere a person can look at them.
    for (const s of last.silhSamples || []) {
      await writeFile(
        new URL(`./perf-out/${route}-u${String(s.u).replace('.', '_')}.png`, import.meta.url),
        s.shot
      );
    }

    if (results.length === 1) {
      const q = last.report.queryStats;
      log(
        `GPU: ${last.report.rendererString}  (${last.report.method})` +
        (q ? `  queries issued ${q.issued} drained ${q.drained} disjoint ${q.disjoint} starved ${q.starved}` : '') +
        '\n'
      );
      log(`internal render resolution ${last.memory.internal ? last.memory.internal.join('×') : '?'}`);
      log(
        `estimator: ${BUDGET.capture.estimatorLabel} over ${RUNS} run${RUNS === 1 ? '' : 's'} per route` +
        (RUNS < (BUDGET.capture.runs || 1)
          ? `  ** --runs=${RUNS} OVERRIDES budget.capture.runs=${BUDGET.capture.runs}; this is not the gate's verdict **`
          : '') +
        '\n'
      );
    }

    log(
      `${checked.fails.length ? '✗' : '✓'} ${route.padEnd(16)} ` +
      `gpu p95 ${checked.metrics.gpuP95 ? checked.metrics.gpuP95.toFixed(2) + 'ms' : '  —  '}  ` +
      `cpu p95 ${checked.metrics.cpuP95.toFixed(2)}ms [${checked.metrics.cpuP95PerRun.join(' ')}]  ` +
      `wall p95 ${checked.metrics.wallP95 ? checked.metrics.wallP95.toFixed(2) + 'ms' : '  —  '} ` +
      `[${checked.metrics.wallP95PerRun.join(' ')}] spread ${checked.metrics.wallSpread ?? '—'}  ` +
      /**
       * THE EXACT COUNT, NOT TWO DECIMALS OF A MEGATRIANGLE — SESSION 67.
       * At 2.45M this printed to the nearest 10 000, so a feature under
       * 10 000 triangles landed and left without moving the digit. Sessions 62
       * to 66 added a countryside, hills, a harbour, cranes, container stacks
       * and boats and the line read 2.45M throughout. A budget is checked
       * against `triangles` either way — this changes what a READER can see,
       * which is §7.7's own subject, and it cannot weaken a gate because it is
       * not a threshold.
       */
      `${checked.metrics.drawCalls} draws  ${checked.metrics.triangles.toLocaleString('en-US')} tris  ` +
      `${checked.metrics.visibleInstances} inst  ${checked.metrics.distinctMaterials} mats  ` +
      `rt ${checked.metrics.targetMemoryMB}MB  chunks ${checked.metrics.chunkMemoryMB ?? '—'}MB  ` +
      `${checked.metrics.metresTravelled}m  ` +
      `froxel ${checked.metrics.clusterPeak}/${checked.metrics.clusterMax} ` +
      `(margin ${checked.metrics.clusterMargin}, ${checked.metrics.trafficLights} traffic)  ` +
      `${checked.metrics.particleLayers} particle layers  ` +
      `${checked.metrics.weather
        ? `rain ${checked.metrics.weather.rainfall.toFixed(2)}` +
          `${checked.metrics.weather.pinned ? ' pinned' : ` (now ${checked.metrics.weather.nowS.toFixed(0)}s, next shower ` +
            `${checked.metrics.weather.nextShowerS == null ? '—' : `${checked.metrics.weather.nextShowerS.toFixed(0)}s`})`}` +
          `, ${checked.metrics.weather.activeParticles} drops  `
        : ''}` +
      `mv ${checked.metrics.motionWritten}/${(checked.metrics.motionWritten || 0) + (checked.metrics.motionSuppressed || 0)} ` +
      `(${checked.metrics.motionLayers} layers, ${checked.metrics.swapViolations} swap viol)  ` +
      `roles ${checked.metrics.lightRoles ? Object.entries(checked.metrics.lightRoles).map(([k, v]) => k + ':' + v).join(' ') : '—'}` +
      `${checked.metrics.unrolledLights ? ' UNROLLED ' + checked.metrics.unrolledLights : ''}`
    );
    /**
     * THE TWO LEVEL FLOORS, PRINTED — session 17, and it is the same omission
     * §7.5's width had. Both have been asserted since session 16 and neither
     * has ever appeared in the report unless it FAILED, so a green run said
     * nothing about how close it was, and `$screenshotEntropy_s16`'s whole
     * argument had to be reconstructed from a failure message.
     *
     * `maxEntropyAtMean` is printed beside the entropy because the pair is the
     * argument: a floor above the ceiling the mean allows is an impossibility
     * rather than a threshold, and that fact is invisible from either number
     * alone. CONTRACT §9 rule 4 — when a number is derived from another, print
     * both.
     */
    log(
      `  level        mean luminance ${checked.metrics.meanLuminance.toFixed(4)} ` +
      `[${BUDGET.floors.meanLuminance[0]}, ${BUDGET.floors.meanLuminance[1]}]  |  ` +
      `entropy ${checked.metrics.entropy.toFixed(3)} ≥ ${BUDGET.floors.screenshotEntropy} ` +
      `(the most any 8-bit histogram at this mean can carry is ` +
      `${maxEntropyAtMean(checked.metrics.meanLuminance * 255).toFixed(3)})  |  ` +
      `median/mean ${checked.metrics.medianOverMean != null ? checked.metrics.medianOverMean.toFixed(3) : '—'}`
    );
    /**
     * ═══════════════════════════════════════════════════════════════════════
     * THIS LINE SAID "ASSERTED ON THE LAST OF THESE, NOT POOLED" FOR
     * FIFTY-SIX SESSIONS AND THE NUMBER BESIDE IT REFUTED IT — SESSION 77.
     * ═══════════════════════════════════════════════════════════════════════
     *
     * Session 21 moved both level statistics onto the median of three runs
     * (`meanLuminance` and `entropy`, about eighty lines above `imageStats`,
     * where the change is written out at length). This log line was not
     * updated, and it printed its contradiction in its own output every run:
     * session 76 delivered `entropy [4.814 4.898 5.034]` and asserted
     * **4.898**, which is the median and not the last.
     *
     * WHICH ONE WAS LYING WAS ESTABLISHED FROM THE CODE AND NOT FROM THE
     * OUTPUT, because an output that agrees with a comment by coincidence is
     * how this survives: `assertRoute` reads `metrics.entropy`, and
     * `metrics.entropy` is `median(perRunLevel.map(s => s.entropy))`. The code
     * pools. The sentence was the lie.
     *
     * A COMMENT THAT CONTRADICTS ITS OWN PRINTED NUMBER IS WORSE THAN A SILENT
     * ONE. This one put "asserted on a single draw" into a session brief and
     * two STATE files, and every reader for fifty-six sessions had both halves
     * in front of them at once.
     */
    log(
      `               per run: mean [${checked.metrics.meanLuminancePerRun.join(' ')}]  ` +
      `entropy [${checked.metrics.entropyPerRun.join(' ')}]  ` +
      `spread ${checked.metrics.entropySpread}  ` +
      `— ASSERTED ON THE MEDIAN OF THESE (session 21). See budget.json $screenshotEntropy_s77.`
    );
    if (checked.metrics.silhouetteVehicles != null) {
      log(
        `  silhouettes  ${checked.metrics.silhouetteVehicles} vehicles: ` +
        `ground contrast ${checked.metrics.groundContrast}  tone roughness ${checked.metrics.lumaRoughness}  ` +
        `chroma clusters ${checked.metrics.bodyChromaClusters} delivered / ` +
        `${checked.metrics.paletteChromaClusters} written  |  ` +
        `roofline over ${checked.metrics.silhouetteProfiles}: span ${checked.metrics.roofSpan} ` +
        `(pass ${checked.metrics.roofSpanPassFraction}, levels ${checked.metrics.roofLevels}, ` +
        `top share ${checked.metrics.roofTopFraction})  |  ` +
        /**
         * THE WIDTH, WHICH THIS LINE ASSERTED AND DID NOT PRINT.
         *
         * §7.5's assertion has been in `assertSilhouettes` since it was written
         * and every number it reads was in `metrics`; the human-readable line
         * stopped at the roofline. A gate that asserts a quantity and reports
         * nothing about it is one step from §7.1's quiet gate — the run says
         * "within budget" and a reader cannot tell whether the width population
         * was 12 or 0, because zero measurable subjects and a comfortable
         * median print the same thing, which is nothing.
         *
         * `declined` is printed BESIDE the count and not instead of it, because
         * the two failures the count cannot separate are a camera that never
         * looked end-on and a fleet whose parts are too long for the over-read
         * to cancel — `budget.json` -> `silhouettes.$minWidthMeasured` says so
         * in as many words, and until this session the delivered fleet was the
         * second one.
         */
        `width over ${checked.metrics.silhouetteWidths}` +
        `${checked.metrics.widthDeclinedBias ? ` (${checked.metrics.widthDeclinedBias} declined for bias)` : ''}` +
        `: span ${checked.metrics.widthSpan} (pass ${checked.metrics.widthSpanPassFraction})  |  ` +
        `${checked.metrics.silhouettePedestrians} pedestrians: ` +
        `width roughness ${checked.metrics.pedestrianWidthRoughness}  ` +
        `chroma clusters ${checked.metrics.pedestrianChromaClusters}`
      );
    }
  }

  // If timer queries were unavailable everywhere, the CPU numbers alone can't
  // prove headroom — vsync-free CPU time says nothing about GPU saturation.
  // So we re-run the heaviest route at 1.5x scale and require it to hold.
  //
  // POOLED BY THE SAME ESTIMATOR AS EVERY OTHER TIMING NUMBER HERE, and that is
  // NOT a fix for this probe. §0 rule 6 is a rule about instruments and applies
  // to every measurement in the project, so applying it here is consistency
  // rather than a favour: measured on identical work this probe read
  // 8.70 / 8.70 / 22.80 ms, a 14.1 ms spread across its own 16.67 ms
  // requirement. Its OTHER defect — `neverExceedNative` clamps the render scale
  // so it shades the same 3 686 400 pixels twice and calls the second one
  // headroom — is untouched, is out of scope for this session, and is why the
  // number below is not evidence of headroom whatever it says.
  if (!anyGpuTimers) {
    log('\nGPU timer queries unavailable — falling back to render-scale headroom probe.');
    const { renderScale, requireP95MsBelow } = BUDGET.headroomProbe;
    const probes = [];
    for (let r = 0; r < RUNS; r++) {
      const raw = await measureRoute(page, routes[0], { renderScale, silhouettes: false });
      probes.push(percentile(raw.report.frames.cpuMs, 95));
    }
    const p95 = median(probes);
    log(
      `  ${routes[0]} @ ${renderScale}× → cpu p95 ${p95.toFixed(2)}ms ` +
      `(median of ${probes.map((v) => v.toFixed(2)).join(' / ')})`
    );
    if (p95 > requireP95MsBelow) {
      allFails.push(
        `headroom probe: ${p95.toFixed(2)}ms at ${renderScale}× > ${requireP95MsBelow}ms ` +
        `(median of ${probes.map((v) => v.toFixed(2)).join(' / ')})`
      );
    }
    results.push({ route: `${routes[0]}@${renderScale}x`, cpuP95: p95, perRun: probes });
  }
} catch (e) {
  await browser.close();
  server.child.kill('SIGKILL');
  console.error('harness: run failed —', e.message);
  process.exit(2);
}

await browser.close();
server.child.kill('SIGKILL');

if (JSON_OUT) {
  console.log(JSON.stringify({ pass: allFails.length === 0, results, failures: allFails }, null, 2));
} else if (allFails.length) {
  console.log('\nBUDGET VIOLATIONS\n' + allFails.map((f) => '  ✗ ' + f).join('\n'));
  console.log('\nFrames written to tools/perf-out/ — look at them before changing any numbers in budget.json.');
} else {
  console.log('\nAll routes within budget.');
}

process.exit(allFails.length ? 1 : 0);
