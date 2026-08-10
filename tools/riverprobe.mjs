#!/usr/bin/env node
/**
 * riverprobe.mjs — what the river costs to shade. NOT A GATE.
 *
 *   node tools/riverprobe.mjs
 *   node tools/riverprobe.mjs --pairs=4 --frames=180
 *
 * WHY THIS EXISTS RATHER THAN A ROUTE.
 *
 * The brief for session 15 says: *"Grazing incidence is the expensive case. A
 * road is seen at 82–88° in a narrow band near the camera; a river fills the
 * frame at grazing angles across its whole width. Whatever the SSR step count
 * and max distance are, they were tuned for asphalt. Measure the cost before
 * assuming it transfers, and state the per-frame budget."*
 *
 * The three gate routes all run down the main street at z ≈ 0 and the river is
 * 424 m north of it, so `perfcheck` sees the water only at long range and never
 * at the angle this is about. A fourth route would need its own millisecond
 * bounds in `budget.json`, and this machine cannot produce a trustworthy
 * absolute with the agent running on it (CONTRACT §0.2 — the quiet bar has not
 * been met in seven sessions). What it CAN produce is an interleaved paired
 * delta, which is the honest instrument for "how much does this cost" and does
 * not need a quiet machine to be read.
 *
 * SO: THREE ARMS, INTERLEAVED, ONE PAGE LOAD EACH.
 *
 *   full   ?river=1            the water, the quay walls, the bridges, SSR on
 *   nossr  ?river=1&ssr=0      the same geometry with the march switched off
 *   none   ?river=0            no river surfaces at all, and the earth whole
 *
 * `full − nossr` is the SSR march at grazing incidence, which is the number the
 * brief asks for. `nossr − none` is the geometry: 1 000 water triangles, ~460
 * structure boxes and ~44 steel ones, and the fragments they shade. `full −
 * none` is the whole river.
 *
 * INTERLEAVED AND PAIRED, because CONTRACT §6 records that on this machine five
 * sequential arms drifted far enough that removing a whole system measured
 * 1.3 ms SLOWER than leaving it in. Each pair is three page loads in
 * immediate succession and the difference is taken WITHIN the pair; the
 * reported figure is the mean of the per-pair differences with its own standard
 * error, so a drift that moves all three arms together cancels.
 *
 * THE POSE IS THE WORST CASE AND IT IS FIXED. Eye height on the promenade,
 * three metres behind the parapet, looking across the water at the far bank:
 * the water then runs from 20 m to 120 m at 3.2° to 18.6° below the horizontal
 * and fills the lower third of the frame at grazing incidence. `setShotAt` is
 * how a NON-GATE instrument places a camera (CONTRACT §8 forbids a gate from
 * doing it, for the reason §7 gives about `lookat.mjs`); this asserts nothing
 * and must not.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { startServer, launchBrowser, openPage, readRendererString } from './lib/page.mjs';

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);

const PAIRS = Number(args.get('pairs') || 3);
const FRAMES = Number(args.get('frames') || 240);
const WARMUP = Number(args.get('warmup') || 60);
const PORT = Number(args.get('port') || 5241);

/**
 * The pose. See the header: the promenade on the north bank at x = 64, three
 * metres behind the quay parapet, looking south across the channel into the
 * city. `riverEdges(64)` puts the north bank at z = −478.9, so an eye at
 * z = −483 clears the 1.05 m parapet at 4.1 m and sees water from 40 m out.
 */
const POSE = {
  pos: [64, 1.74, -483],
  target: [40, 16, -300],
  fov: 55,
};

const ARMS = [
  { key: 'full', params: 'river=1' },
  { key: 'nossr', params: 'river=1&ssr=0' },
  { key: 'none', params: 'river=0' },
];

function p95(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))];
}
function mean(xs) { return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length); }
function sem(xs) {
  if (xs.length < 2) return null;
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1);
  return Math.sqrt(v / xs.length);
}

const server = await startServer(PORT);
const browser = await launchBrowser();

/** One arm: load the page, place the camera, settle, record `FRAMES` frames. */
async function runArm(arm) {
  /**
   * THE SAME PIXEL COUNT `perfcheck` MEASURES, and it is not a detail.
   *
   * `budget.capture.viewport` is 2560x1440 because CONTRACT §5.10 fixes the
   * internal render resolution there and the internal buffer NEVER EXCEEDS THE
   * DRAWING BUFFER — so a probe run at 1280x720 renders a quarter of the
   * pixels and understates every per-fragment cost by 4x. The first run of
   * this file did exactly that and reported the whole river at -0.13 ms, which
   * is a measurement of a quarter of the frame dressed as a measurement of the
   * frame. Same failure family as CONTRACT §9's table: a number measured
   * correctly and then read as a different quantity.
   */
  const { context, page, consoleErrors, pageErrors } = await openPage(browser, {
    viewport: { width: 2560, height: 1440 },
  });
  // Night and wet: the case the river exists for, and the one in which the
  // march runs on every water fragment rather than on a sunlit few.
  await page.goto(
    `${server.url}?perf=1&seed=1337&t=0.0&wet=1&paused=1&${arm.params}`,
    { waitUntil: 'load', timeout: 90_000 }
  );
  await page.waitForFunction(() => window.__NOCTIS_HARNESS__ && window.__NOCTIS_HARNESS__.ready, null, { timeout: 90_000 });
  await page.evaluate(() => window.__NOCTIS_HARNESS__.ready);
  const renderer = await readRendererString(page);
  await page.evaluate((p) => window.__NOCTIS_HARNESS__.setShotAt(p.pos, p.target, p.fov), POSE);
  // Let the streaming ring and the exposure converge before anything is
  // recorded; a first frame is a compile and a bake, not a frame.
  await page.evaluate((n) => window.__NOCTIS_HARNESS__.step(n, 1 / 60), WARMUP);
  await page.evaluate(() => window.__NOCTIS_HARNESS__.settle());
  await page.evaluate(() => window.__APEX_PROBE__.startRecording());
  await page.evaluate((n) => window.__NOCTIS_HARNESS__.step(n, 1 / 60), FRAMES);
  const report = await page.evaluate(() => window.__APEX_PROBE__.report());
  const info = await page.evaluate(() => window.__NOCTIS_HARNESS__.info());
  const river = await page.evaluate(() =>
    (window.__NOCTIS_HARNESS__.riverCensus ? window.__NOCTIS_HARNESS__.riverCensus() : null)
  );
  await context.close();
  return {
    renderer,
    wall: report.frames.wallMs,
    cpu: report.frames.cpuMs,
    draws: report.peak.drawCalls,
    tris: report.peak.triangles,
    programs: report.peak.programs,
    bridges: river ? river.bridges.length : 0,
    errors: consoleErrors.concat(pageErrors),
  };
}

const pairs = [];
let renderer = '';
for (let i = 0; i < PAIRS; i++) {
  const row = {};
  for (const arm of ARMS) {
    const r = await runArm(arm);
    renderer = r.renderer;
    row[arm.key] = r;
  }
  pairs.push(row);
  process.stdout.write(
    `pair ${i + 1}/${PAIRS}  ` +
    ARMS.map((a) => `${a.key} p95 ${p95(row[a.key].wall).toFixed(2)}ms ${row[a.key].draws} draws`).join('  ') +
    '\n'
  );
}

await browser.close();
server.child.kill('SIGKILL');

const per = (k) => pairs.map((r) => p95(r[k].wall));
const perCpu = (k) => pairs.map((r) => p95(r[k].cpu));
const diffs = (a, b) => pairs.map((r) => p95(r[a].wall) - p95(r[b].wall));
const diffsCpu = (a, b) => pairs.map((r) => p95(r[a].cpu) - p95(r[b].cpu));

const line = (label, a, b) => {
  const d = diffs(a, b);
  const dc = diffsCpu(a, b);
  const pos = d.filter((x) => x > 0).length;
  return (
    `  ${label.padEnd(34)} wall ${mean(d) >= 0 ? '+' : ''}${mean(d).toFixed(3)} ms ` +
    `(SE ${sem(d) == null ? '—' : sem(d).toFixed(3)}, ${pos}/${d.length} pairs positive)   ` +
    `cpu ${mean(dc) >= 0 ? '+' : ''}${mean(dc).toFixed(3)} ms (SE ${sem(dc) == null ? '—' : sem(dc).toFixed(3)})`
  );
};

console.log('');
console.log(`riverprobe — NOT A GATE. ${PAIRS} interleaved pairs x ${FRAMES} frames, 2560x1440 — budget.capture.viewport.`);
console.log(`GPU: ${renderer}`);
console.log(`pose ${JSON.stringify(POSE.pos)} -> ${JSON.stringify(POSE.target)} fov ${POSE.fov}, t=0.0 wet=1`);
console.log('');
for (const a of ARMS) {
  const w = per(a.key);
  const c = perCpu(a.key);
  const r0 = pairs[0][a.key];
  console.log(
    `  ${a.key.padEnd(6)} wall p95 [${w.map((x) => x.toFixed(2)).join(' ')}]  cpu p95 [${c.map((x) => x.toFixed(2)).join(' ')}]  ` +
    `${r0.draws} draws  ${(r0.tris / 1e6).toFixed(2)}M tris  ${r0.programs} programs  ${r0.bridges} bridges`
  );
}
console.log('');
console.log('  the three differences, each taken WITHIN a pair:');
console.log(line('SSR march at grazing (full-nossr)', 'full', 'nossr'));
console.log(line('the river geometry (nossr-none)', 'nossr', 'none'));
console.log(line('the whole river (full-none)', 'full', 'none'));
console.log('');
console.log(
  '  Absolutes on this machine are not verdicts while the agent is the load\n' +
  '  (CONTRACT §0.2). The differences are, because drift moves all three arms\n' +
  '  of a pair together and cancels out of a within-pair difference — and\n' +
  '  shared load dilutes a true ratio toward 1, so a separation reported here\n' +
  '  is a FLOOR on the real one.'
);

const errs = pairs.flatMap((r) => ARMS.flatMap((a) => r[a.key].errors));
if (errs.length) {
  console.log('');
  console.log(`  ${errs.length} console/page error(s): ${JSON.stringify(errs.slice(0, 4))}`);
}

await mkdir(new URL('./perf-out/', import.meta.url), { recursive: true });
await writeFile(
  new URL('./perf-out/riverprobe.json', import.meta.url),
  JSON.stringify(
    {
      pose: POSE, pairs: PAIRS, frames: FRAMES, renderer,
      wallP95: Object.fromEntries(ARMS.map((a) => [a.key, per(a.key)])),
      cpuP95: Object.fromEntries(ARMS.map((a) => [a.key, perCpu(a.key)])),
      draws: Object.fromEntries(ARMS.map((a) => [a.key, pairs.map((r) => r[a.key].draws)])),
      triangles: Object.fromEntries(ARMS.map((a) => [a.key, pairs.map((r) => r[a.key].tris)])),
    },
    null,
    2
  ) + '\n'
);
console.log('\nwritten: tools/perf-out/riverprobe.json');
