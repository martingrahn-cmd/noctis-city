#!/usr/bin/env node
/**
 * filmshot.mjs — the film. NOT A GATE, and no gate may read through it.
 *
 *   node tools/filmshot.mjs                      the whole cut
 *   node tools/filmshot.mjs --shots=rain-street  one shot
 *   node tools/filmshot.mjs --preview            3 stills per shot, for composing
 *   node tools/filmshot.mjs --dry                timing pass only, no PNGs, no film
 *   node tools/filmshot.mjs --offline=1.5        a SECOND, SEPARATELY LABELLED file
 *   node tools/filmshot.mjs --static             the shimmer diagnostic: locked
 *                                                camera, paused clock, four arms
 *                                                two of which are controls
 *
 * It asserts nothing about the city. It asserts two things about ITSELF — the
 * internal render resolution and the renderer string — and it fails hard on
 * either, for `perfcheck`'s reason: a capture at a different pixel count, or off
 * a software rasteriser, is a film of something nobody is paying for.
 *
 *
 * THE HONEST LABEL, which is the point of the exercise
 * ---------------------------------------------------
 * Written to `tools/film-out/<stamp>.label.txt` beside the file, and printed at
 * the end of the run. It carries the machine, the internal resolution, the
 * quality tier, the measured wall frame time per shot, and whether the §0 quiet
 * bar was met while the capture ran. Everyone's demo reel is an offline render
 * that does not say so. This one says so.
 *
 *
 * THE FFMPEG COMMAND, so the cut is reproducible from the frames
 * -------------------------------------------------------------
 *     ffmpeg -y -framerate 60 -start_number 0 -i frames/f_%05d.png \
 *       -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p \
 *       -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
 *       -movflags +faststart noctis-<stamp>.mp4
 *
 * yuv420p rather than yuv444p because the file has to play everywhere, and the
 * cost is chroma resolution on the neon — stated here rather than discovered
 * later. `-crf 17` and `-preset slow`: this is 25 seconds, not a pipeline.
 *
 *
 * WHY THERE ARE TWO PASSES OVER EVERY SHOT, AND WHY THAT IS THE HONEST DESIGN
 * --------------------------------------------------------------------------
 * `perf-probe` measures wall frame time as beforeRender(i) → beforeRender(i+1).
 * A capture that screenshots between frames puts a 2560×1440 PNG readback and a
 * CDP round trip INSIDE that interval, so a naive recorder reports 200 ms
 * frames and calls the renderer slow. Reporting that number as the city's frame
 * time would be CONTRACT §9's failure mode with a camera in it: a quantity
 * measured correctly and then used as though it were a different one.
 *
 * So each shot is rendered twice:
 *
 *   TIMING PASS   the whole shot inside ONE page.evaluate, no readback, no
 *                 round trips — byte for byte the loop `runRoute` runs and
 *                 `perfcheck` measures. This pass produces the milliseconds.
 *   CAPTURE PASS  the same shot, same frames, stepping from node so each frame
 *                 can be written out. This pass produces the pixels.
 *
 * Everything that moves is driven by the frame INDEX and a fixed dt of 1/60 —
 * camera, traffic, pedestrians, gait, weather, time of day — and nothing in this
 * file reads a wall clock, so the whole run reproduces from the seed. Two things
 * are nevertheless NOT identical between the passes, and both are named here
 * rather than left for somebody to find:
 *
 *   THE ARRIVAL ORDER OF STREAMED CHUNKS, which is asynchronous by design
 *   (CONTRACT §8.1). Both passes open only after `waitForCity` has drained the
 *   residency ring, so neither is measuring the streaming system.
 *
 *   THE PHASE OF THE TRAFFIC AND THE CROWD. The simulated clock runs forward
 *   only, and rewinding it would mean touching `src/`, so the capture pass opens
 *   on a world one shot-length older than the timing pass opened on: the same
 *   vehicles and the same people, further along the same paths. What is checked
 *   instead is that both passes were doing the same amount of WORK — draw calls
 *   and triangles, the quantities §9 rule 6's corollary says do not drift — and
 *   every shot's pair is printed in the log and the label. A disagreement there
 *   is reported as a failure of the claim, not smoothed over. The clustered-light
 *   count is printed but NOT asserted on, and the comment at the check says why
 *   at length: it was in the equality for one run, fired on three shots that had
 *   identical geometry, and was §9's own failure mode inside the instrument
 *   written to detect §9's failure mode.
 *
 * The number this reports is therefore the frame time of the pass that did NOT
 * produce the pixels. That is stated in the label rather than hidden, and it is
 * the right way round: the alternative is a number that includes a PNG encoder.
 *
 *
 * WHAT "HOLDS" MEANS, AND WHAT HAPPENS TO A SHOT THAT DOES NOT
 * -----------------------------------------------------------
 * `--hold` (default 16.67 ms — one frame at 60 fps) against the shot's own wall
 * p95, POOLED AS THE MEDIAN OF `--runs` (default 3) TIMING PASSES — the same
 * estimator `perfcheck` uses, taken from `budget.json` → `capture.$estimator`
 * rather than invented here. A shot over it is CUT, not down-tiered: the film's
 * whole claim is that this is what the machine actually delivers at the settings
 * the gates measure, and a shot that only holds at a lower tier is a different
 * claim. Which shots were cut, and on what numbers, is in the log — all three
 * p95s and their spread, never just the pooled one.
 *
 * The first full run of this tool is why the estimator is pooled at all: it cut
 * `rain-street` at 19.40 ms twenty-five minutes after the identical, deterministic
 * shot measured 13.70 ms, with nothing changed but what else the machine was
 * doing. One draw against a fixed threshold was deciding on drift. The HOLD did
 * not move; the number of draws did.
 *
 * THE OBSERVER IS THE LOAD, AND THE DRIFT IS ONE-SIDED. This machine's absolute
 * frame times are only a verdict under the CONTRACT §0.2 bar — load1 ≤ 1.6,
 * nothing over 15% CPU — which is not met while the agent that wrote this file
 * is running. It matters less here than it does for a gate, and the asymmetry is
 * why: load can only make a frame SLOWER, so a shot measured GREEN under load is
 * green, full stop. A shot measured RED under load is a bound and not a verdict,
 * and the log says so rather than quietly cutting on a number nobody can read.
 * The bar is sampled before and after every capture, by the same three checks
 * `quiet-gates.sh` makes, and both readings go in the log.
 *
 * `export LC_ALL=C` before reading `uptime` or `ps`, here as everywhere: the
 * operator's shell is a Swedish locale where load1 prints as `1,32`, and both of
 * quiet-gates' numeric checks broke on it in opposite directions. Set by the
 * tool, never required of the caller.
 *
 *
 * WHERE THIS STEPS OUTSIDE THE HARNESS, AND WHY IT IS ALLOWED TO
 * -------------------------------------------------------------
 * Three places, all of them through `window.__NOCTIS__.ctx`, all of them
 * unavailable on the harness and none of them permitted to a gate:
 *
 *   time.setPaused(false)        THE FROZEN-WORLD FIX, and the one that matters
 *                                most. `harness.setTimeOfDay` pauses the clock
 *                                and nothing in `src/` ever unpauses it, while
 *                                `traffic`, `streetlife` and `weather` all
 *                                advance on `time.now` — so every harness-driven
 *                                capture in this project renders a still world.
 *                                The full argument, the measurement that found
 *                                it and why it costs no determinism are at
 *                                `prepare()`.
 *   camera.setRouteAt(name, u)   the harness exposes `poseRoute`, which waits
 *                                for the city and burns 24 frames per call —
 *                                correct for a gate pooling three samples,
 *                                useless at 60 placements a second. This is the
 *                                same call `runRoute` makes on every one of its
 *                                1800 frames.
 *   camera.routeLength(name)     so `u` advances at the ROUTE'S OWN metres per
 *                                second and the film moves at the speed the
 *                                gate measures.
 *   time.advance(seconds)        the sweep shot. `harness.setTimeOfDay` is
 *                                discontinuous by construction and drops the TAA
 *                                history (CONTRACT §5.10), so driving a sweep
 *                                through it renders every frame un-accumulated —
 *                                a sweep of the antialiasing rather than of the
 *                                sky. `advance` emits `discontinuous: false`.
 *
 * CONTRACT §8's rule is that no GATE may render through the operator's own
 * placements, because a gate whose subject the operator chooses measures the
 * operator. This is a film. It chooses its subject on purpose, and it asserts
 * nothing.
 *
 * Shots 1, 4 and 5's camera is on a route spline; shots 2 and 3 are operator
 * placements through `setShotAt`, and the log labels each one with which.
 */

import { writeFile, mkdir, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { LANDMARKS, viaductArc } from '../src/lib/citygen.js';
import { startServer, launchBrowser, openPage, readRendererString } from './lib/page.mjs';
import { decodePNG, encodePNG } from './lib/png.mjs';

const execFileAsync = promisify(execFile);
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = path.join(ROOT, 'tools', 'film-out');
const BUDGET = JSON.parse(await readFile(new URL('./budget.json', import.meta.url), 'utf8'));

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);

/** CONTRACT §6. One seed, so the same film can be re-cut and compared. */
const SEED = args.get('seed') || BUDGET.capture.params.seed;
const DT = 1 / 60;
const FPS = 60;
const HOLD_MS = Number(args.get('hold') || 16.67);
/** `budget.json` → `capture.$runs`. Three, for the reason written there. */
const RUNS = Math.max(1, Number(args.get('runs') || BUDGET.capture.runs || 3));
const VIEWPORT = BUDGET.capture.viewport;
const SOFTWARE_RENDERERS = ['swiftshader', 'llvmpipe', 'software', 'lavapipe'];

const stamp = (() => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
})();

const lines = [];
const log = (...m) => {
  const s = m.join(' ');
  lines.push(s);
  console.log(s);
};

// ---------------------------------------------------------------------------
// The bar. The same three checks quiet-gates.sh makes, read rather than enforced.
// ---------------------------------------------------------------------------

/**
 * `LC_ALL=C` on every one of these, set here rather than required of the
 * caller — see the header. `uptime` prints `load averages: 1,32` under sv_SE
 * and `Number('1,32')` is NaN, which is the failure that cost three sessions.
 */
async function readBar() {
  const env = { ...process.env, LC_ALL: 'C' };
  const out = {};
  try {
    const { stdout } = await execFileAsync('uptime', [], { env });
    const m = stdout.match(/load averages?:\s*([0-9.]+)/);
    out.load1 = m ? Number(m[1]) : NaN;
  } catch {
    out.load1 = NaN;
  }
  try {
    const { stdout } = await execFileAsync(
      '/bin/sh',
      ['-c', "pgrep -fl 'vite|playwright|Chromium.*--use-angle' | grep -v filmshot | wc -l"],
      { env }
    );
    out.orphans = Number(String(stdout).trim());
  } catch {
    out.orphans = NaN;
  }
  try {
    const { stdout } = await execFileAsync('/bin/sh', ['-c', 'ps -A -o %cpu,comm'], { env });
    out.bigCpu = String(stdout)
      .split('\n')
      .slice(1)
      .map((l) => l.trim().split(/\s+/, 2))
      .filter((r) => r.length === 2 && Number(r[0]) > 15)
      .map((r) => `${r[0]}% ${r[1].split('/').pop()}`);
  } catch {
    out.bigCpu = [];
  }
  out.met = Number.isFinite(out.load1) && out.load1 <= 1.6 && out.orphans === 0 && out.bigCpu.length === 0;
  return out;
}

const describeBar = (b) =>
  `load1 ${Number.isFinite(b.load1) ? b.load1.toFixed(2) : '??'}` +
  `  orphan render processes ${b.orphans}` +
  `  over 15% CPU: ${b.bigCpu.length ? b.bigCpu.join(', ') : 'none'}` +
  `  → §0.2 bar ${b.met ? 'MET' : 'NOT met'}`;

// ---------------------------------------------------------------------------
// The shot list. Lead with the strongest material.
// ---------------------------------------------------------------------------

const viaduct = LANDMARKS.find((l) => l.name === 'viaduct');
const crown = viaductArc(viaduct).stations.reduce((b, s) => (Math.abs(s.s) < Math.abs(b.s) ? s : b));

/**
 * `kind: 'route'` follows a route spline at that route's own metres per second,
 * which is what `runRoute` does. `u0` is where on the path the shot opens;
 * `seconds` is how long it runs, and the distance covered falls out of the two.
 *
 * `kind: 'path'` is an operator dolly through `setShotAt`. Constant velocity,
 * no ease: every cut in this film is a hard cut, and an ease-out into a hard cut
 * reads as a stall.
 *
 * `kind: 'sweep'` holds a placement and advances the clock.
 */
const SHOTS = [
  {
    /**
     * 1. The best thing the project has, and it opens the film. Walking west
     * through the origin block at midnight with the road wet: headlight pools,
     * tail-light lines in the asphalt, neon in the standing water, and the
     * screen-space reflection march over a third of the frame. This is the
     * route `perfcheck` gates at 13.0 ms and the only one that is gated wet.
     */
    name: 'rain-street',
    kind: 'route',
    route: 'night_rain',
    u0: 0.325,
    seconds: 7.0,
    t: 0.0,
    wet: 0.85,
    note: 'night_rain route spline, walking pace 6 m/s, standing water',
  },
  {
    /**
     * 2. Dusk, the viaduct. The gate camera's own vantage, widened, pushing in:
     * two piers on the kerbs at z = ±11 frame the street and the horizon burns
     * through the gap between them. STATE 5 re-aimed this bridge precisely so
     * that its piers would stand on ground you can see, and this is the shot
     * that shows it.
     */
    name: 'dusk-viaduct',
    kind: 'path',
    from: { pos: [88, 1.74, 1.4], target: [crown.x, viaduct.height * 0.74, crown.z], fov: 58 },
    to: { pos: [52, 1.74, 0.6], target: [crown.x, viaduct.height * 0.74, crown.z], fov: 58 },
    seconds: 5.5,
    t: 0.78,
    wet: 0,
    note: 'operator dolly (setShotAt), 36 m at 6.5 m/s, target pinned to the deck crown',
  },
  {
    /**
     * 3. Elevation at dusk — the shot that has to say "city" and not "block".
     * Landmarks are drawn out to CITY.geometryRadius = 5 chunks = 640 m, so an
     * elevated camera near the origin is the only place several of them are in
     * one frame at once. A slow truck, so the parallax between the near blocks
     * and the far ones does the work a still frame cannot.
     */
    name: 'dusk-elevation',
    kind: 'path',
    from: { pos: [330, 128, 300], target: [-70, 46, -110], fov: 47 },
    to: { pos: [232, 118, 356], target: [-70, 40, -110], fov: 47 },
    seconds: 5.5,
    t: 0.78,
    wet: 0,
    note: 'operator dolly (setShotAt), elevated, slow truck and descent',
  },
  {
    /**
     * 4. Noon, street level, with the things that move. On the pavement rather
     * than in the carriageway: pedestrians walk on the pavement, the stalls and
     * market tables are on the pavement, and the traffic then reads across the
     * frame instead of away down the middle of it.
     */
    name: 'noon-pavement',
    kind: 'path',
    /**
     * Walking east to west and ENDING on the strong frame rather than starting
     * on it: 30 m further west the pavement runs out along a blank flank, which
     * is a fact about the block and not something to fix in the camera.
     */
    from: { pos: [96, 1.68, 9.6], target: [-64, 5.6, 7.2], fov: 52 },
    to: { pos: [66, 1.68, 9.6], target: [-94, 5.6, 7.2], fov: 52 },
    seconds: 6.0,
    t: 0.5,
    wet: 0,
    note: 'operator dolly (setShotAt), pavement, 30 m at 5 m/s',
  },
  {
    /**
     * 5. Dawn through dusk on one fixed view. The street runs east–west
     * (CONTRACT §3.1) so the sun comes down it from both ends, and the exposure
     * meter is deliberately slow (§5.4) — which is the thing being shown.
     *
     * Driven by `time.advance`, NOT `setTimeOfDay`: the latter is discontinuous
     * and drops the TAA history every frame. Nothing here snaps the exposure;
     * a settled sweep would be a sweep with the subject removed.
     *
     * Expected to be the expensive shot and it is last for that reason: the sky
     * rebuilds whenever the sun elevation moves 0.35°, and a dawn-to-dusk sweep
     * spends most of its frames doing that. If it cannot hold, it is cut — see
     * the header, and STATE §6's PMREM hitch.
     */
    name: 'sweep-dawn-dusk',
    kind: 'sweep',
    shot: { pos: [70, 1.74, 0.9], target: [-104, 17.5, -1.4], fov: 50 },
    seconds: 6.0,
    t: 0.22,
    tEnd: 0.80,
    wet: 0,
    note: 'fixed placement, time.advance() per frame, no exposure snap',
  },
];

/**
 * THE STATIC SHOTS — `--static`. A DIAGNOSTIC, not part of the cut.
 * ==================================================================
 *
 * The camera does not move, the clock is paused, and the same thirty seconds
 * are rendered. Everything that changes between two of those frames is the
 * RENDERER changing its mind, because nothing else in the world can have moved.
 *
 * WHY THIS EXISTS. Watching the film, the windows shimmer, in almost every
 * shot. Three mechanisms could do that and they are not distinguishable by
 * looking:
 *
 *   1. TAA rejecting history on thin high-contrast detail. A window band at
 *      distance is near-subpixel and emissive, which is the worst case for a
 *      neighbourhood clamp: at the jitter phases that miss the band, all nine
 *      taps are dark, sigma collapses, and the bright history is clipped to the
 *      dark neighbourhood — full-amplitude flicker rather than a residual.
 *   2. Depth fighting between the window boxes and the facade they sit in.
 *   3. Streaming pop as the detail ring brings chunks in and out.
 *
 * A LOCKED CAMERA SEPARATES THEM, AND TWO OF THE THREE FALL OUT OF THE
 * ARRANGEMENT RATHER THAN OUT OF AN ARM.
 *
 *   Streaming is decided by `wantedChunks(camera)`, which is a pure function of
 *   the camera's chunk coordinate (city.js). A camera that does not move cannot
 *   change the wanted set, so nothing streams — and this tool does not assume
 *   that, it MEASURES it: `resident`, `built` and `evictions` are read before
 *   and after every window and printed, and a difference is reported as one.
 *   That is strictly better than an arm that pins the ring, because pinning it
 *   would prove the ring can be pinned rather than that it moved.
 *
 *   Depth fighting needs two surfaces at nearly the same depth, and whether
 *   there are any is a question about geometry that a picture cannot answer and
 *   arithmetic can. It is answered in STATE.md with the delivered numbers off
 *   the live instance matrices rather than off the source.
 *
 * WHAT THE ARMS ARE, AND THE TWO CONTROLS AMONG THEM. CONTRACT §7.3 — a metric
 * that claims to measure a property is run on something that has it and on
 * something that does not, through the same code path, or its two answers are
 * the same answer.
 *
 *   base       nothing touched.
 *   nojitter   `setJitterScale(0)`. THE NEGATIVE CONTROL. With the camera
 *              locked, the clock paused and the sub-pixel offset removed, every
 *              input to every frame is bit-identical, so the delivered frames
 *              must be identical too — apart from the composite's own ±1
 *              code-value dither, which is why the reported floor is not zero
 *              and why the flicker threshold is derived from it below. A run in
 *              which this arm does NOT come out at the dither floor is a run in
 *              which the instrument is measuring itself.
 *   noaccum    `setTaaFeedback(0)`. THE POSITIVE CONTROL, and also the reading
 *              that gives the other arms a scale: it is the raw per-frame
 *              aliasing amplitude, i.e. exactly what the temporal filter is
 *              being asked to remove. An arm that reads near this is a frame
 *              with no working temporal filter on it.
 *   widegamma  `setClipGamma(8)`. The clamp made permissive. If the shimmer is
 *              mechanism 1, this is the arm that stops it, because the clamp is
 *              the only thing in the resolve that can reject a correctly
 *              reprojected history. If it is mechanism 2, this arm changes
 *              nothing.
 *
 * THE METRIC, AND ITS UNITS. Per pixel, over a window of consecutive delivered
 * frames: the RANGE of the sRGB luma, max minus min, in CODE VALUES out of 255.
 * Delivered luma and not linear radiance, because shimmer is a property of the
 * image a person watches and that image is sRGB-encoded — the encode is
 * non-linear, so a range taken before it is a different quantity.
 *
 * The reported figure is `flicker8`: the fraction of pixels whose range reaches
 * **8 code values**. The derivation, because a threshold without one is a guess
 * (§9 rule 5): the composite adds a triangular dither of ±1 code value
 * (`post.js`, the last line of the composite shader), so the range of a
 * perfectly static pixel over any window is at most 2 code values by
 * construction. 8 is 4× that floor. Nothing rests on the exact number — the
 * whole distribution is printed at 2, 4, 8, 16 and 32, so a reader can see
 * whether the finding survives the choice.
 */
const STATIC_SHOTS = [
  {
    /**
     * The x-facing elevations at noon, from the middle of a north-south street.
     * Chosen because this is where the window openings are actually visible:
     * see STATE.md on what the reveal boxes do to the other elevation.
     */
    name: 'static-noon-xfacade',
    shot: { pos: [-22, 10, 162.4], target: [11.6, 14, 162.4], fov: 55 },
    t: 0.5,
    wet: 0,
    note: 'locked, noon, two x-facing elevations at 20 and 35 m',
  },
  {
    /** The film's own elevation shot, held still. Thousands of distant windows. */
    name: 'static-dusk-elevation',
    shot: { pos: [330, 128, 300], target: [-70, 46, -110], fov: 47 },
    t: 0.78,
    wet: 0,
    note: 'locked, dusk, elevated — the greatest number of near-subpixel windows',
  },
  {
    /** The film's opening frame, held still. Wet, emissive, SSR over a third of it. */
    name: 'static-night-street',
    shot: { pos: [70, 1.74, 0.9], target: [-104, 17.5, -1.4], fov: 50 },
    t: 0.0,
    wet: 0.85,
    note: 'locked, midnight, wet street — emissive windows and the SSR march',
  },
];

/**
 * `oldreproj` and `flatweight` are the two arms inside the RESOLVE, added once
 * the first run had refuted the clamp: `widegamma` moved the reading by 0.10 of
 * a percentage point on 4.73, which is nothing, so whatever was rejecting the
 * history was not the neighbourhood clip. The derivations are at
 * TAA_JITTER_COMP and TAA_KARIS_SCALE in `src/modules/post.js`, and the table
 * of what each arm measured is there too.
 *
 * `oldreproj` RESTORES THE DEFECT rather than fixing it, because the fix now
 * ships: it is the arm that reproduces session 12's frames, and it is the only
 * reason the 4.729 → 0.668 in that table can be re-measured rather than quoted.
 */
const STATIC_ARMS = {
  base: {},
  nojitter: { jitterScale: 0 },
  noaccum: { feedback: 0 },
  widegamma: { clipGamma: 8 },
  oldreproj: { jitterComp: 0 },
  flatweight: { karisScale: 0 },
  oldboth: { jitterComp: 0, karisScale: 0 },
};

for (const s of SHOTS) s.frames = Math.round(s.seconds * FPS);
for (const s of STATIC_SHOTS) {
  s.kind = 'static';
  s.frozen = true;
  s.seconds = Number(args.get('seconds') || 30);
  s.frames = Math.round(s.seconds * FPS);
}

const STATIC = args.has('static');
const POOL = STATIC ? STATIC_SHOTS : SHOTS;

const wanted = args.has('shots') ? new Set(args.get('shots').split(',')) : null;
const shots = POOL.filter((s) => !wanted || wanted.has(s.name));
if (!shots.length) {
  console.error(`filmshot: no shot matched. Have: ${POOL.map((s) => s.name).join(', ')}`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// The in-page driver. Installed once; both passes call the same `place`, which
// is the only reason the pixels and the milliseconds describe the same frames.
// ---------------------------------------------------------------------------

const INSTALL_DRIVER = () => {
  const H = window.__NOCTIS_HARNESS__;
  const ctx = window.__NOCTIS__.ctx;
  const lerp = (a, b, f) => a + (b - a) * f;
  const lerp3 = (a, b, f) => [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];

  const film = {
    /** Frame index → camera. Called identically by both passes. */
    place(spec, i) {
      const f = spec.frames > 1 ? i / (spec.frames - 1) : 0;
      if (spec.kind === 'route') {
        const cam = ctx.get('camera');
        const len = cam.routeLength(spec.route);
        const r = cam.route(spec.route);
        // The same metres per second `runRoute` walks, so the film moves at the
        // speed the gate measures rather than at a speed chosen for the film.
        const du = (r.speed * spec.dt) / Math.max(len, 1e-6);
        cam.setRouteAt(spec.route, Math.min(1, Math.max(0, spec.u0 + i * du)));
        return;
      }
      if (spec.kind === 'path') {
        H.setShotAt(lerp3(spec.from.pos, spec.to.pos, f), lerp3(spec.from.target, spec.to.target, f), lerp(spec.from.fov, spec.to.fov, f));
        return;
      }
      if (spec.kind === 'sweep' || spec.kind === 'static') {
        H.setShotAt(spec.shot.pos, spec.shot.target, spec.shot.fov);
      }
    },

    /**
     * Apply a static-arm's overrides, and RETURN WHAT WAS ACTUALLY SET rather
     * than what was asked for. Every one of these instruments clamps its
     * argument, and an arm reported as applied when it was clamped away is an
     * arm that silently is not an arm — which is the shape of every quiet gate
     * in CONTRACT §7.1. `base` is passed through here too, so it resets any
     * previous arm on the same page rather than inheriting it.
     */
    setArm(arm) {
      const got = {};
      got.jitterScale = H.setJitterScale(arm.jitterScale == null ? 1 : arm.jitterScale);
      got.feedback = H.setTaaFeedback(arm.feedback == null ? null : arm.feedback);
      got.clipGamma = H.setClipGamma(arm.clipGamma == null ? null : arm.clipGamma);
      got.jitterComp = H.setJitterComp(arm.jitterComp == null ? null : arm.jitterComp);
      got.karisScale = H.setKarisScale(arm.karisScale == null ? null : arm.karisScale);
      return got;
    },

    /**
     * The streaming witness. Read before and after a measurement window: a
     * locked camera cannot change `wantedChunks`, so these three integers must
     * be identical across the window, and if they are not then mechanism 3 was
     * live and the reading is about the streaming system.
     */
    cityWitness() {
      const c = ctx.get('city');
      if (!c) return null;
      const s = c.stats();
      return { resident: s.resident, built: s.built, evictions: s.evictions };
    },

    /**
     * Everything that has to be true before the first frame of a shot, and
     * nothing that has to be true after it. `waitForCity` first, because the
     * residency ring follows the camera and a shot that opens mid-stream is a
     * film of the streaming system.
     */
    async prepare(spec) {
      H.takeOver();
      await H.setTimeOfDay(spec.t);
      H.setWetness(spec.wet);
      this.place(spec, 0);
      const arrival = await H.waitForCity(4000, 30000);
      this.place(spec, 0);
      const post = ctx.get('post');
      if (post) post.resetHistory();

      /**
       * LET THE WORLD RUN. This line is the whole of the first cut's defect.
       *
       * `harness.setTimeOfDay` — every capture's first call, including
       * `runRoute`'s — does `time.setPaused(true)`. Nothing anywhere calls
       * `setPaused(false)`; it is the only `setPaused` in `src/` outside
       * `time.js` itself. And since the determinism fix that each of
       * `traffic.js`, `streetlife.js` and `weather.js` carries in its header,
       * all three advance on `time.now - lastNow` rather than on the frame's
       * `dt` — so a paused clock hands every one of them a step of exactly
       * zero. The camera then flies through a photograph.
       *
       * Measured before this line existed, 60 stepped frames per case: 0
       * simulated seconds elapsed, 0 of 360 pedestrians displaced, and 36 of
       * 1920 vehicles displaced by 280 m — which is not motion, it is a chunk
       * reseat, and the distinction is why this was measured as DISPLACEMENT
       * rather than as change. With the clock running: 1704 of 1920 vehicles
       * and 359 of 360 pedestrians, the latter by 1.75 m in one simulated
       * second, which is a walking pace. It was frozen on the ROUTE shot too,
       * so this was never about `setShotAt`.
       *
       * IT DOES NOT COST DETERMINISM, and that is the reason it is safe. The
       * clock advances inside `time.update` by the frame's own `dt`, which
       * `step()` fixes at 1/60 — so `time.now` at frame i is exactly i/60,
       * a function of the frame INDEX and nothing else. No wall clock enters.
       *
       * PLACED HERE, between `waitForCity` and `settle`, on purpose:
       * `waitForCity` is bounded by WALL CLOCK (CONTRACT §8.1, and §9 row 18),
       * so the number of frames it burns differs from run to run and the world
       * must not be moving through them. `settle`'s frame count is fixed, so
       * the world may — and should — move through those, or the shot opens with
       * a TAA history accumulated over a still frame and every moving object
       * pops on frame 0.
       *
       * The sun now creeps too, at `dt / dayLengthSeconds` — 8.4 minutes of
       * solar time across a 7 s shot at the authored 1200 s day. That is not a
       * side effect to be suppressed; it is exactly what the app does when it
       * is running, and CONTRACT §3 has one clock.
       */
      if (!spec.frozen) ctx.get('time').setPaused(false);

      await H.settle(4);
      const info = H.info();
      return { arrival, info, simNow: +ctx.get('time').now.toFixed(3) };
    },

    /** One frame. Both passes go through here. */
    async frame(spec, i) {
      if (spec.kind === 'sweep' && i > 0) {
        const time = ctx.get('time');
        /**
         * `advance` and not `setTimeOfDay`: continuous, so the TAA history and
         * the exposure meter both survive the step (CONTRACT §5.10).
         *
         * ON TOP OF the 1× the running clock is already contributing, and the
         * two are not the same quantity, which is the only reason a time-lapse
         * of the sky over a city moving at walking pace is possible at all:
         * `time.update` advances BOTH `now` and `timeOfDay`, and `advance`
         * moves `timeOfDay` ONLY. So the traffic and the pedestrians keep their
         * real speed while the sun crosses a day. `timeScale` cannot do this —
         * it scales the pair — and at the 116× this shot needs it would have
         * put the pedestrians at 200 m/s.
         */
        const perFrame = (spec.tEnd - spec.t) / Math.max(1, spec.frames - 1);
        time.advance(perFrame * time.dayLengthSeconds);
      }
      this.place(spec, i);
      // What `runRoute` does before every step. A no-op unless the placeholder
      // headlights are up, and they are not — the traffic here is the real one.
      H.updateTraffic();
      await H.step(1, spec.dt);
    },

    /**
     * THE TIMING PASS. The whole shot inside one call, so nothing between two
     * frames but the renderer and a rAF — which is exactly the interval
     * `perf-probe` reports and `perfcheck` compares to a ceiling.
     */
    async timeShot(spec) {
      window.__APEX_PROBE__.startRecording();
      for (let i = 0; i < spec.frames; i++) await this.frame(spec, i);
      const r = window.__APEX_PROBE__.report();
      const inf = H.info();
      return {
        wallMs: r.frames.wallMs,
        cpuMs: r.frames.cpuMs,
        method: r.method,
        rendererString: r.rendererString,
        /**
         * The load-bearing counts at the END of the pass. §9 rule 6's
         * corollary: counts do not drift, so if the timing pass and the capture
         * pass finish on the same ones they drew the same amount of work — see
         * the header on why they cannot finish on the same traffic POSITIONS.
         */
        counts: { drawCalls: inf.drawCalls, triangles: inf.triangles, clusteredLights: inf.clusteredLights },
        simNow: +ctx.get('time').now.toFixed(3),
      };
    },
  };

  window.__FILM__ = film;
  return true;
};

const percentile = (xs, p) => {
  const s = [...xs].filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return NaN;
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

/** `budget.json` → `capture.$estimator_whyMedian`, the same pooling perfcheck does. */
const median = (xs) => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return NaN;
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};

// ---------------------------------------------------------------------------
// `--static` — the shimmer instrument. See STATIC_SHOTS above for what it is
// for and which of the three candidate mechanisms each arm separates.
// ---------------------------------------------------------------------------

/**
 * The dither floor, in code values, and it is DERIVED rather than assumed.
 *
 * The composite's last line is `rgb += (hash12(p) + hash12(p') - 1) / 255`, a
 * triangular dither on [−1, +1] code values. Two frames of a perfectly static
 * pixel therefore differ by at most 2 code values, whatever else is true. Every
 * threshold below is a multiple of this number and is printed as one.
 */
const DITHER_RANGE_CV = 2;

/** Per-pixel temporal accumulator over one window of consecutive frames. */
function makeAccum(n) {
  return {
    n: 0,
    min: new Float32Array(n).fill(Infinity),
    max: new Float32Array(n).fill(-Infinity),
    sum: new Float64Array(n),
    sumsq: new Float64Array(n),
    reset() {
      this.n = 0;
      this.min.fill(Infinity);
      this.max.fill(-Infinity);
      this.sum.fill(0);
      this.sumsq.fill(0);
    },
  };
}

/**
 * Fold one delivered frame into the accumulator.
 *
 * sRGB luma, in code values out of 255, NOT linear radiance: shimmer is a
 * property of the image a person watches, the encode is non-linear, and a range
 * taken before it is a different quantity (CONTRACT §9's whole subject).
 */
function foldFrame(acc, png) {
  const { data, channels } = png;
  const n = acc.min.length;
  for (let i = 0, p = 0; i < n; i++, p += channels) {
    const y = 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2];
    if (y < acc.min[i]) acc.min[i] = y;
    if (y > acc.max[i]) acc.max[i] = y;
    acc.sum[i] += y;
    acc.sumsq[i] += y * y;
  }
  acc.n++;
}

function summarise(acc) {
  const n = acc.min.length;
  const bins = [2, 4, 8, 16, 32];
  const over = new Array(bins.length).fill(0);
  let sumRange = 0;
  let maxRange = 0;
  let sumSd = 0;
  const hist = new Float64Array(256);
  for (let i = 0; i < n; i++) {
    const r = acc.max[i] - acc.min[i];
    sumRange += r;
    if (r > maxRange) maxRange = r;
    const mean = acc.sum[i] / acc.n;
    sumSd += Math.sqrt(Math.max(0, acc.sumsq[i] / acc.n - mean * mean));
    hist[Math.min(255, Math.round(r))]++;
    for (let b = 0; b < bins.length; b++) if (r >= bins[b]) over[b]++;
  }
  let cum = 0;
  let p999 = 0;
  const target = n * 0.999;
  for (let v = 0; v < 256; v++) {
    cum += hist[v];
    if (cum >= target) { p999 = v; break; }
  }
  const out = { frames: acc.n, pixels: n, meanRange: sumRange / n, meanSd: sumSd / n, maxRange, p999 };
  for (let b = 0; b < bins.length; b++) out[`flicker${bins[b]}`] = over[b] / n;
  return out;
}

/**
 * The heat map. Range in code values, ×8, clamped — so a pixel at the 32-code
 * threshold is already white and the picture is about WHERE rather than how
 * much. The gain is written into the filename so nobody has to guess it.
 */
function heatPng(acc, width, height, gain = 8) {
  const n = width * height;
  const data = Buffer.alloc(n * 3);
  for (let i = 0; i < n; i++) {
    const v = Math.min(255, Math.round((acc.max[i] - acc.min[i]) * gain));
    data[i * 3] = v;
    data[i * 3 + 1] = v;
    data[i * 3 + 2] = v;
  }
  return encodePNG({ width, height, channels: 3, data });
}

async function runStatic() {
  const WINDOW = Math.max(8, Number(args.get('window') || 32));
  const armNames = (args.get('arms') || 'base,nojitter,noaccum,widegamma').split(',');
  for (const a of armNames) {
    if (!STATIC_ARMS[a]) {
      throw new Error(`--arms: no arm '${a}'. Have: ${Object.keys(STATIC_ARMS).join(', ')}`);
    }
  }

  log('=== --static: the shimmer instrument. NOT A GATE, and no gate may read through it. ===');
  log(`  camera locked, clock paused, ${shots[0].frames} frames (${shots[0].seconds.toFixed(0)} s) per arm,`);
  log(`  measured over ${WINDOW}-frame windows at the start, middle and end of each run.`);
  log(`  metric: per-pixel RANGE of sRGB luma in CODE VALUES; flickerN = fraction of pixels reaching N.`);
  log(`  the composite's dither is ±1 code value, so a perfectly static pixel ranges ≤ ${DITHER_RANGE_CV}.`);
  log(`  arms: ${armNames.join(', ')}   (nojitter = negative control, noaccum = positive control)`);
  log('');

  const rows = [];
  for (const shot of shots) {
    const spec = { ...shot, dt: DT };
    log(`${shot.name}  ·  ${shot.note}`);

    for (const armName of armNames) {
      const arm = STATIC_ARMS[armName];
      const { info } = await page.evaluate((s) => window.__FILM__.prepare(s), spec);
      const got = await page.evaluate((a) => window.__FILM__.setArm(a), arm);
      // The arm changes the resolve, so the accumulation that existed before it
      // describes a different filter. Drop it and re-converge under the arm.
      await page.evaluate(() => {
        const p = window.__NOCTIS__.ctx.get('post');
        if (p) p.resetHistory();
      });
      await page.evaluate((n) => window.__NOCTIS_HARNESS__.step(n, 1 / 60), 48);

      const starts = [0, Math.floor((shot.frames - WINDOW) / 2), shot.frames - WINDOW];
      const acc = makeAccum(VIEWPORT.width * VIEWPORT.height);
      const windows = [];
      let at = 0;
      for (const s of starts) {
        if (s > at) {
          await page.evaluate((n) => window.__NOCTIS_HARNESS__.step(n, 1 / 60), s - at);
          at = s;
        }
        const witnessBefore = await page.evaluate(() => window.__FILM__.cityWitness());
        acc.reset();
        for (let k = 0; k < WINDOW; k++) {
          foldFrame(acc, decodePNG(await page.screenshot({ type: 'png' })));
          await page.evaluate(() => window.__NOCTIS_HARNESS__.step(1, 1 / 60));
          at++;
        }
        const witnessAfter = await page.evaluate(() => window.__FILM__.cityWitness());
        const streamed =
          !witnessBefore || !witnessAfter ||
          witnessBefore.resident !== witnessAfter.resident ||
          witnessBefore.built !== witnessAfter.built ||
          witnessBefore.evictions !== witnessAfter.evictions;
        const sum = summarise(acc);
        sum.startFrame = s;
        sum.streamed = streamed;
        windows.push(sum);
        if (s === starts[1] && armName === 'base') {
          const f = path.join(OUT, `static-${stamp}-${shot.name}-${armName}-heat-x8.png`);
          await writeFile(f, heatPng(acc, VIEWPORT.width, VIEWPORT.height, 8));
          log(`    heat map → ${path.relative(ROOT, f)}`);
          const g = path.join(OUT, `static-${stamp}-${shot.name}-${armName}-frame.png`);
          await writeFile(g, await page.screenshot({ type: 'png' }));
          log(`    the frame it is of → ${path.relative(ROOT, g)}`);
        }
      }

      // Pooled across the three windows by MAX, not by median: these are three
      // samples of the same still world under the same arm, so a difference
      // between them is the instrument finding something, and averaging it away
      // is the one thing a diagnostic must not do.
      const worst = windows.reduce((a, b) => (b.flicker8 > a.flicker8 ? b : a));
      rows.push({ shot: shot.name, arm: armName, got, worst, windows, info });
      log(
        `  ${armName.padEnd(10)} jitter×${got.jitterScale} feedback ${got.feedback} gamma ${got.clipGamma}  ` +
        `flicker≥8cv ${(worst.flicker8 * 100).toFixed(3)}%  ` +
        `[2cv ${(worst.flicker2 * 100).toFixed(2)} · 4cv ${(worst.flicker4 * 100).toFixed(2)} · ` +
        `16cv ${(worst.flicker16 * 100).toFixed(2)} · 32cv ${(worst.flicker32 * 100).toFixed(2)}]  ` +
        `mean range ${worst.meanRange.toFixed(2)} cv  p99.9 ${worst.p999} cv  max ${worst.maxRange.toFixed(0)} cv` +
        `${windows.some((w) => w.streamed) ? '   STREAMED DURING A WINDOW — mechanism 3 was live' : ''}`
      );
    }

    // The two controls have to hold, or nothing above them means anything.
    const neg = rows.find((r) => r.shot === shot.name && r.arm === 'nojitter');
    const pos = rows.find((r) => r.shot === shot.name && r.arm === 'noaccum');
    if (neg) {
      const ok = neg.worst.maxRange <= DITHER_RANGE_CV + 0.5;
      log(
        `  negative control: jitter off, camera locked, clock paused → max range ` +
        `${neg.worst.maxRange.toFixed(1)} cv against the ${DITHER_RANGE_CV} cv dither floor  → ` +
        `${ok ? 'holds' : 'DOES NOT HOLD — something else in the frame is moving, and every arm above is contaminated'}`
      );
    }
    if (pos && neg) {
      log(
        `  positive control: accumulation off → flicker≥8cv ` +
        `${(pos.worst.flicker8 * 100).toFixed(2)}%, which is the raw per-frame aliasing the filter is asked to remove.`
      );
    }
    log('');
  }

  const jsonFile = path.join(OUT, `static-${stamp}.json`);
  await writeFile(jsonFile, `${JSON.stringify({ stamp, renderer, viewport: VIEWPORT, window: WINDOW, rows }, null, 1)}\n`);
  log(`  numbers → ${path.relative(ROOT, jsonFile)}`);
}

// ---------------------------------------------------------------------------

await mkdir(OUT, { recursive: true });
const FRAMES = path.join(OUT, `frames-${stamp}`);

const barBefore = await readBar();

log(`filmshot ${stamp} — NOT A GATE`);
log(`  seed ${SEED}   ${VIEWPORT.width}×${VIEWPORT.height} internal at dpr ${VIEWPORT.dpr}   ${FPS} fps fixed dt ${DT.toFixed(5)}`);
log(`  hold ${HOLD_MS} ms wall p95 — a shot over it is cut, never down-tiered`);
log(`  machine ${os.cpus()[0].model} ${os.cpus().length}-core, ${os.platform()} ${os.release()}`);
log(`  bar before: ${describeBar(barBefore)}`);
if (!barBefore.met) {
  log('  · the §0.2 bar is not met, so an absolute measured now is one-sided:');
  log('    load can only make a frame slower, so GREEN here is a verdict and RED is a bound.');
}
log('');

let server = null;
let baseUrl = args.get('url');
if (!baseUrl) {
  server = await startServer(Number(args.get('port') || 5311));
  baseUrl = server.url;
}
const browser = await launchBrowser();
const { page, pageErrors } = await openPage(browser, {
  viewport: { width: VIEWPORT.width, height: VIEWPORT.height },
  deviceScaleFactor: VIEWPORT.dpr,
});

const results = [];
let renderer = 'unknown';
let assembled = null;
let frameNo = 0;

try {
  const url = new URL(baseUrl);
  for (const [k, v] of Object.entries(BUDGET.capture.params)) url.searchParams.set(k, String(v));
  url.searchParams.set('seed', String(SEED));
  await page.goto(url.toString(), { waitUntil: 'load', timeout: 120_000 });
  await page.waitForFunction(() => window.__APEX_HARNESS__ && window.__APEX_PROBE__ && window.__NOCTIS__, null, { timeout: 90_000 });
  await page.evaluate(() => window.__APEX_HARNESS__.ready);

  renderer = await readRendererString(page);
  if (SOFTWARE_RENDERERS.some((s) => renderer.toLowerCase().includes(s))) {
    throw new Error(`software renderer ("${renderer}") — a film of SwiftShader is a film of nothing. Check --use-angle=metal.`);
  }

  /**
   * The §5.10 check `perfcheck` makes, made here for the same reason: the
   * internal buffer is not the drawing buffer, and a capture at a different
   * pixel count is not a capture of what the ceilings are written against.
   */
  const geom = await page.evaluate(() => window.__APEX_HARNESS__.info());
  const got = geom.internal;
  if (!got || got[0] !== VIEWPORT.width || got[1] !== VIEWPORT.height) {
    throw new Error(
      `internal render resolution is ${got ? got.join('×') : 'unknown'}, budget.capture.viewport says ` +
      `${VIEWPORT.width}×${VIEWPORT.height}. The film would not be of the settings the gates measure.`
    );
  }
  const offline = args.has('offline') ? Number(args.get('offline')) : null;
  if (offline) {
    await page.evaluate((s) => window.__APEX_HARNESS__.setRenderScale(s), offline);
    const now = await page.evaluate(() => window.__APEX_HARNESS__.info());
    log(`  OFFLINE PASS: renderScale ${offline} → internal ${now.internal.join('×')}. This is NOT the gated tier`);
    log('  and its file must be labelled separately. Never cut together with the real-time pass.');
  }

  log(`  GPU ${renderer}`);
  log(`  quality tier: renderScale ${offline || 1.0}, ${offline ? 'OFFLINE' : 'the tier `npm run perfcheck` runs'}`);
  log(`  warmup ${BUDGET.capture.warmupFrames} frames (shader compilation and uploads, out of every measured window)`);
  log('');

  await page.evaluate(
    (n) => new Promise((res) => { let i = 0; const s = () => (++i >= n ? res() : requestAnimationFrame(s)); requestAnimationFrame(s); }),
    BUDGET.capture.warmupFrames
  );
  await page.evaluate(INSTALL_DRIVER);

  if (STATIC) {
    await runStatic();
  } else {

  if (!args.has('preview')) await mkdir(FRAMES, { recursive: true });

  for (const shot of shots) {
    const spec = { ...shot, dt: DT };
    const t0 = Date.now();
    const { arrival, info } = await page.evaluate((s) => window.__FILM__.prepare(s), spec);

    log(`${shot.name}  ${shot.frames} frames / ${shot.seconds.toFixed(1)} s  ·  ${shot.note}`);
    log(
      `  world: t ${info.timeOfDay.toFixed(3)} (${info.clock})  sun ${info.sunElevationDeg.toFixed(1)}°  wet ${info.wetness}  ` +
      `${info.drawCalls} draws  ${(info.triangles / 1e6).toFixed(2)}M tris  ${info.city ? `${info.city.resident} chunks` : ''}  ` +
      `${arrival.field ? `${arrival.field.ready}/${arrival.field.slots} field` : ''}${arrival.timedOutOn ? `  TIMED OUT ON ${arrival.timedOutOn}` : ''}`
    );

    /**
     * `--paired` — WHAT THE MOVING WORLD ACTUALLY COSTS, MEASURED AS AN
     * INTERLEAVED PAIRED DELTA AND NOT AS TWO BATTERIES.
     *
     * The question this answers is the obvious objection to the frozen-world
     * fix: a city with the traffic and the crowd actually simulating must cost
     * more than a photograph of the same city, so the label's old numbers were
     * too low. Comparing this run against the previous cut cannot answer it —
     * the two were measured under different load, and on this machine load
     * dominates a difference of tenths.
     *
     * So both arms are run in ONE page, alternating A B A B A B, which is the
     * one comparison this machine supports while the agent is the load: the
     * drift is shared, so it cancels in the difference even when it swamps
     * either absolute. The arms differ in ONE line — whether `prepare` unpauses
     * the clock — and in nothing else: same seed, same camera path, same frame
     * indices, same dt, same population, same draw calls.
     *
     * What the difference is NOT is a verdict on the ceiling. It is a
     * separation, and if it comes out under this instrument's resolution the
     * honest report is "under the resolution", not "zero".
     */
    if (args.has('paired')) {
      const arms = { running: [], frozen: [] };
      for (let k = 0; k < RUNS; k++) {
        for (const arm of ['running', 'frozen']) {
          await page.evaluate((s) => window.__FILM__.prepare(s), { ...spec, frozen: arm === 'frozen' });
          const t = await page.evaluate((s) => window.__FILM__.timeShot(s), { ...spec, frozen: arm === 'frozen' });
          arms[arm].push(percentile(t.wallMs, 95));
        }
      }
      const mr = median(arms.running);
      const mf = median(arms.frozen);
      log(`  paired A/B, ${RUNS} interleaved pairs, wall p95:`);
      log(`    world RUNNING  ${mr.toFixed(2)} ms  [${arms.running.map((v) => v.toFixed(1)).join(' ')}]`);
      log(`    world FROZEN   ${mf.toFixed(2)} ms  [${arms.frozen.map((v) => v.toFixed(1)).join(' ')}]`);
      log(`    the simulation costs ${(mr - mf >= 0 ? '+' : '')}${(mr - mf).toFixed(2)} ms of wall p95 on this shot`);
      log('');
      continue;
    }

    if (args.has('preview')) {
      for (const i of [0, Math.floor(shot.frames / 2), shot.frames - 1]) {
        await page.evaluate(([s, k]) => window.__FILM__.frame(s, k), [spec, i]);
        // Two extra settle frames so a preview still is not a half-accumulated
        // frame; the real capture pass never does this — it would be a cheat.
        await page.evaluate(() => window.__NOCTIS_HARNESS__.step(8, 1 / 60));
        const f = path.join(OUT, `preview-${shot.name}-${String(i).padStart(4, '0')}.png`);
        await writeFile(f, await page.screenshot({ type: 'png' }));
        log(`  preview → ${path.relative(ROOT, f)}`);
      }
      log('');
      continue;
    }

    /**
     * THE TIMING PASS, RUN `--runs` TIMES AND POOLED BY MEDIAN.
     *
     * The estimator is `budget.json` → `capture.$estimator`, adopted verbatim
     * rather than invented here, and for the reason written there: drift on this
     * machine is ONE-SIDED and arrives in bursts, so a single run compared
     * against a fixed threshold decides on a difference the instrument cannot
     * resolve. This tool learned that the expensive way — the first full run cut
     * `rain-street` at 19.40 ms wall p95 twenty-five minutes after the same
     * deterministic shot measured 13.70 ms, with nothing changed but what else
     * the machine happened to be doing. A median of three discards exactly one
     * contaminated observation, which is the contamination pattern actually
     * observed here.
     *
     * THIS IS NOT A LOOSENING, and the same test `perfcheck` applies holds: the
     * HOLD did not move, only the number of draws. A shot over 16.67 ms in two
     * runs of three is still cut. All three p95s are printed, so a median that
     * is hiding a spread is visible in the log rather than inferred from it.
     */
    const runs = [];
    for (let k = 0; k < RUNS; k++) {
      if (k > 0) await page.evaluate((s) => window.__FILM__.prepare(s), spec);
      const timing = await page.evaluate((s) => window.__FILM__.timeShot(s), spec);
      runs.push({
        p95: percentile(timing.wallMs, 95),
        max: Math.max(...timing.wallMs),
        cpuP95: percentile(timing.cpuMs, 95),
        over60: timing.wallMs.filter((m) => m > 16.67).length,
        over30: timing.wallMs.filter((m) => m > 33.3).length,
        n: timing.wallMs.length,
        counts: timing.counts,
      });
    }
    const timingCounts = runs[runs.length - 1].counts;
    const med = (k) => median(runs.map((r) => r[k]));
    const wallP95 = med('p95');
    const wallMax = med('max');
    const cpuP95 = med('cpuP95');
    const over60 = med('over60');
    const over30 = med('over30');
    const spread = Math.max(...runs.map((r) => r.p95)) - Math.min(...runs.map((r) => r.p95));
    const held = wallP95 <= HOLD_MS;

    log(
      `  timing (no readback, median of ${RUNS}): wall p95 ${wallP95.toFixed(2)} ms ` +
      `[${runs.map((r) => r.p95.toFixed(1)).join(' ')}] spread ${spread.toFixed(1)}  ` +
      `max ${wallMax.toFixed(2)}  cpu p95 ${cpuP95.toFixed(2)}  ` +
      `${over60}/${runs[0].n} frames over 16.67 ms, ${over30} over 33.3  →  ${held ? 'HOLDS 60 fps' : 'DOES NOT HOLD'}`
    );

    const record = {
      name: shot.name, frames: shot.frames, seconds: shot.seconds, note: shot.note,
      kind: shot.kind, t: info.timeOfDay, clock: info.clock, wet: info.wetness,
      drawCalls: info.drawCalls, triangles: info.triangles,
      wallP95, wallMax, cpuP95, over60, over30, held, kept: held,
      runsP95: runs.map((r) => r.p95), spread,
      firstFrame: null, lastFrame: null,
    };

    if (args.has('dry')) {
      record.kept = false;
      log('  --dry: timing only, no frames written.');
      log('');
      results.push(record);
      continue;
    }

    if (!held) {
      record.kept = false;
      log(`  CUT — ${wallP95.toFixed(2)} ms wall p95 is over the ${HOLD_MS} ms hold. The tier is not lowered to keep it.`);
      if (!barBefore.met) {
        log('    (measured off the §0.2 bar, so this is a BOUND. A quiet re-run may restore this shot.)');
      }
      log('');
      results.push(record);
      continue;
    }

    // --- the capture pass ---------------------------------------------------
    await page.evaluate((s) => window.__FILM__.prepare(s), spec);
    record.firstFrame = frameNo;
    for (let i = 0; i < shot.frames; i++) {
      await page.evaluate(([s, k]) => window.__FILM__.frame(s, k), [spec, i]);
      await writeFile(path.join(FRAMES, `f_${String(frameNo).padStart(5, '0')}.png`), await page.screenshot({ type: 'png' }));
      frameNo++;
    }
    record.lastFrame = frameNo - 1;

    /**
     * THE ONE THING THE TWO PASSES CANNOT SHARE, MEASURED RATHER THAN ASSUMED.
     *
     * The simulated clock only runs forward and cannot be rewound without
     * touching `src/`, so the capture pass opens on a world that is one
     * shot-length older than the one the timing pass opened on: the same
     * vehicles and the same people, somewhere else on the same paths. What CAN
     * be checked is that both passes were drawing the same amount of work, and
     * §9 rule 6's corollary says which quantities are allowed to carry that
     * check — the ones that do not drift. If these disagree, the milliseconds
     * do not describe the pixels and the tool says so instead of the label.
     *
     * `clusteredLights` IS NOT ONE OF THEM, AND THE FIRST VERSION OF THIS CHECK
     * PUT IT IN THE EQUALITY. It fired on three of five shots — 96 against 102,
     * 140 against 139, 135 against 136 — with every draw call and every triangle
     * identical, and printed "the milliseconds do not describe these pixels"
     * about a claim that was sound. The count is the number of lights currently
     * ASSIGNED TO FROXELS, so a headlight entering or leaving the grid changes
     * it: it is a function of where the traffic IS, which is the one thing these
     * two passes are known not to share. Asserting on it is CONTRACT §9's shape
     * exactly — a quantity measured correctly and asked the wrong question, with
     * the right units and a plausible magnitude — and it was caught by reading a
     * failure that named three shots and no mechanism.
     *
     * So the check is draw calls and triangles, which are properties of WHAT is
     * drawn; the light count is printed beside them as the phase indicator it
     * actually is, and a difference there is expected rather than reported.
     */
    const capCounts = await page.evaluate(() => {
      const i = window.__NOCTIS_HARNESS__.info();
      return { drawCalls: i.drawCalls, triangles: i.triangles, clusteredLights: i.clusteredLights };
    });
    const countsAgree =
      capCounts.drawCalls === timingCounts.drawCalls &&
      capCounts.triangles === timingCounts.triangles;
    record.countsAgree = countsAgree;
    record.timingCounts = timingCounts;
    record.captureCounts = capCounts;
    log(
      `  passes: draws ${timingCounts.drawCalls}→${capCounts.drawCalls}, ` +
      `tris ${(timingCounts.triangles / 1e6).toFixed(2)}M→${(capCounts.triangles / 1e6).toFixed(2)}M  →  ` +
      `${countsAgree ? 'same work' : 'DIFFERENT WORK — the milliseconds do not describe these pixels'}` +
      `   (clustered lights ${timingCounts.clusteredLights}→${capCounts.clusteredLights}, phase-dependent, not checked)`
    );
    log(`  captured frames ${record.firstFrame}–${record.lastFrame}  (${((Date.now() - t0) / 1000).toFixed(0)} s wall for both passes)`);
    log('');
    results.push(record);
  }

  if (!args.has('preview') && !args.has('dry') && frameNo > 0) {
    const outFile = path.join(OUT, `noctis-${stamp}${offline ? `-offline-x${offline}` : ''}.mp4`);
    const ff = [
      '-y', '-framerate', String(FPS), '-start_number', '0',
      '-i', path.join(FRAMES, 'f_%05d.png'),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '17',
      '-pix_fmt', 'yuv420p',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
      '-movflags', '+faststart',
      outFile,
    ];
    log(`assembling ${frameNo} frames → ${path.basename(outFile)}`);
    log(`  ffmpeg ${ff.map((a) => (a.includes(' ') ? `'${a}'` : a)).join(' ')}`);
    await execFileAsync('ffmpeg', ff);
    assembled = { file: outFile, frames: frameNo, seconds: frameNo / FPS };
    log('');
  }

  } // end of the non-static branch
} finally {
  await browser.close();
  if (server) server.child.kill('SIGKILL');
}

const barAfter = await readBar();
log(`bar after:  ${describeBar(barAfter)}`);
if (pageErrors && pageErrors.length) log(`page errors: ${pageErrors.length} — ${pageErrors.slice(0, 3).join(' | ')}`);

// ---------------------------------------------------------------------------
// The label. One line that separates this from a demo reel, plus its workings.
// ---------------------------------------------------------------------------

if (assembled) {
  const kept = results.filter((r) => r.kept);
  const cut = results.filter((r) => !r.kept);
  const worst = kept.reduce((a, b) => (b.wallP95 > a.wallP95 ? b : a), kept[0]);
  const cpu = os.cpus()[0].model;
  const offline = args.has('offline') ? Number(args.get('offline')) : null;

  const headline =
    `NOCTIS — ${offline ? `OFFLINE render at ${offline}× internal scale` : 'real-time capture'}, ` +
    `${cpu} (${os.cpus().length}-core), Chromium/ANGLE-Metal, ` +
    `${VIEWPORT.width}×${VIEWPORT.height} internal — the resolution tools/budget.json gates — ` +
    `at the quality tier \`npm run perfcheck\` runs${offline ? ' EXCEPT for the render scale' : ' (renderScale 1.0, nothing lowered)'}; ` +
    `60 fps, fixed dt; measured wall frame time p95 per shot ` +
    `${kept.map((r) => `${r.name} ${r.wallP95.toFixed(2)}`).join(' / ')} ms ` +
    `(worst ${worst.wallP95.toFixed(2)} ms against 16.67 ms for 60 fps); ` +
    `captured ${stamp} with load1 ${barBefore.load1.toFixed(2)} — ` +
    `CONTRACT §0.2's quiet bar (load1 ≤ 1.6) ${barBefore.met ? 'MET' : 'NOT met, so every figure here is an upper bound and the film is at least this fast'}.`;

  const label = [
    headline,
    '',
    '--- how to read that line ------------------------------------------------',
    `file            ${path.relative(ROOT, assembled.file)}`,
    `length          ${assembled.seconds.toFixed(2)} s, ${assembled.frames} frames at ${FPS} fps`,
    `seed            ${SEED} — deterministic; \`node tools/filmshot.mjs\` re-cuts the same film`,
    `renderer        ${renderer}`,
    `internal        ${VIEWPORT.width}×${VIEWPORT.height} at dpr ${VIEWPORT.dpr}, asserted against budget.capture.viewport before the first frame`,
    `tier            ${offline ? `renderScale ${offline} — NOT the gated tier` : 'renderScale 1.0 — the tier perfcheck measures. No shot was down-tiered to survive.'}`,
    `timing          measured on a second pass with no screenshot readback in the frame interval — a readback`,
    '                inside the frame interval would put a PNG encoder in the number. The pass that produced',
    '                the pixels is not the pass that produced the milliseconds. Both run the same camera path',
    '                on the same frame indices at the same fixed dt; the capture pass opens on a world one',
    '                shot-length further along, because the simulated clock only runs forward. Whether the two',
    '                were doing the same WORK is checked per shot on draw calls and triangles — the counts',
    '                §9 rule 6 says do not drift. The clustered-light count is printed beside them and',
    '                deliberately NOT checked: it counts lights assigned to froxels, so it moves with the',
    '                traffic, which is the one thing the two passes are known not to share.',
    `world           RUNNING. The clock is unpaused for the measured frames, so traffic, pedestrians, gait and`,
    '                rain all advance — `harness.setTimeOfDay` pauses it and nothing in src/ unpauses it, which',
    '                froze the first cut of this film solid. These frame times are for a moving city, and an',
    '                interleaved paired A/B put the simulation cost under this instrument\'s own resolution:',
    '                rain-street 13.50 running against 13.70 frozen, noon-pavement 9.70 against 9.60, over',
    '                three alternating pairs each. Opposite signs, both well under the 0.4-0.8 ms the run-to-run',
    '                resolution is quiet. The crowd and the traffic were always DRAWN; only their transforms',
    '                had stopped being updated.',
    ...results
      .filter((r) => r.kept)
      .map(
        (r) =>
          `                ${r.name.padEnd(17)} draws ${r.timingCounts.drawCalls}→${r.captureCounts.drawCalls}, ` +
          `tris ${(r.timingCounts.triangles / 1e6).toFixed(2)}M→${(r.captureCounts.triangles / 1e6).toFixed(2)}M ` +
          `→ ${r.countsAgree ? 'same work' : 'DIFFERENT WORK'}  (lights ${r.timingCounts.clusteredLights}→` +
          `${r.captureCounts.clusteredLights}, phase-dependent, not checked)`
      ),
    `hold            ${HOLD_MS} ms wall p95. ${cut.length ? `${cut.length} shot(s) cut for going over it: ${cut.map((c) => `${c.name} (${c.wallP95.toFixed(2)} ms)`).join(', ')}` : 'No shot was cut.'}`,
    `bar             before ${describeBar(barBefore)}`,
    `                after  ${describeBar(barAfter)}`,
    ...(barBefore.met
      ? []
      : ['                The observer is the load and the drift is one-sided: load can only make a frame',
         '                slower, so these p95s are ceilings on the quiet numbers, not estimates of them.']),
    '',
    '--- the shots ------------------------------------------------------------',
    ...results.map(
      (r) =>
        `${r.kept ? 'kept' : 'CUT '}  ${r.name.padEnd(17)} ${String(r.frames).padStart(4)}f ${r.seconds.toFixed(1)}s  ` +
        `t ${r.t.toFixed(3)} (${r.clock})  wet ${r.wet}  ${r.drawCalls} draws  ${(r.triangles / 1e6).toFixed(2)}M tris  ` +
        `wall p95 ${r.wallP95.toFixed(2)} ms [${r.runsP95.map((p) => p.toFixed(1)).join(' ')}] spread ${r.spread.toFixed(1)}  ` +
        `max ${r.wallMax.toFixed(2)}  ${r.over60} frame(s) over 16.67, ${r.over30} over 33.3`
    ),
    '',
    /**
     * The p95 is the estimator the ceilings in budget.json are written against,
     * so it is the one the hold is decided on. The max is printed beside it
     * because a p95 cannot see a single 300 ms frame, and a single 300 ms frame
     * is a real-time claim briefly failing. Both, always, in the same line.
     */
    `Worst single frame in the cut: ${kept.reduce((a, b) => (b.wallMax > a.wallMax ? b : a), kept[0]).wallMax.toFixed(2)} ms, in ` +
    `${kept.reduce((a, b) => (b.wallMax > a.wallMax ? b : a), kept[0]).name}. Frames over 33.3 ms across the whole cut: ` +
    `${kept.reduce((n, r) => n + r.over30, 0)} of ${kept.reduce((n, r) => n + r.frames, 0)}.`,
    '',
    '--- what this is not -----------------------------------------------------',
    'Not a gate. Nothing here asserts anything about the city, and no gate may read through it.',
    'The frame times above are this tool\'s own measurement of these five camera paths; the',
    'project\'s gated numbers are the three routes in tools/perf-out/quiet-gates-*.log and',
    'they are the ones README.md quotes.',
  ].join('\n');

  const labelFile = path.join(OUT, `noctis-${stamp}.label.txt`);
  await writeFile(labelFile, `${label}\n`);
  log('');
  log(label);
  log('');
  log(`label: ${path.relative(ROOT, labelFile)}`);

  if (!args.has('keep-frames')) {
    await rm(FRAMES, { recursive: true, force: true });
    log(`${frameNo} PNGs removed — they are deterministic from the seed; keep them with --keep-frames`);
  }
}

const logFile = path.join(OUT, `${STATIC ? 'static' : 'filmshot'}-${stamp}.log`);
await writeFile(logFile, `${lines.join('\n')}\n`);
console.log(`log: ${path.relative(ROOT, logFile)}`);
