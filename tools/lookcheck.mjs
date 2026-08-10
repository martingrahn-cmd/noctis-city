#!/usr/bin/env node
/**
 * lookcheck.mjs — the look gate.
 *
 *   node tools/lookcheck.mjs
 *   node tools/lookcheck.mjs --url=http://localhost:5173/   (use a running server)
 *   node tools/lookcheck.mjs --extra                        (also write ungated
 *                                                            reference frames)
 *
 * Exit 0 = green, 1 = the look is wrong, 2 = the harness itself failed.
 *
 * Renders one fixed camera at dawn, noon, dusk and midnight, dry and wet,
 * writes eight PNGs to tools/look-out/, and asserts against
 * tools/look-budget.json.
 *
 * The PNGs are decoded here rather than sampled through the browser, so every
 * number printed describes exactly the bytes on disk — the same bytes a human
 * opens. There is no path by which the metrics can describe a different image
 * from the one delivered.
 *
 * There is no mode that skips assertions. --extra only adds output.
 *
 * Session 2 moved the metrics to tools/lib/lookmetrics.mjs and the assertions
 * to tools/lib/lookassert.mjs, unchanged in meaning, so that tools/gateaudit.mjs
 * can run the same assertion code against deliberately broken frames. Capture
 * lives here; what counts as right lives there; nothing counts as right in two
 * places.
 */

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { decodePNG } from './lib/png.mjs';
import { analyse } from './lib/lookmetrics.mjs';
import { assertLook, validateBudget } from './lib/lookassert.mjs';
import { startServer, launchBrowser, openPage, readRendererString, rendererIsSoftware } from './lib/page.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = path.join(ROOT, 'tools', 'look-out');

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);

const BUDGET = JSON.parse(await readFile(path.join(ROOT, 'tools', 'look-budget.json'), 'utf8'));
const note = (...m) => console.log(...m);

// ---------------------------------------------------------------------------

const budgetProblems = validateBudget(BUDGET);
if (budgetProblems.length) {
  console.error('lookcheck: tools/look-budget.json is not a usable gate —');
  for (const p of budgetProblems) console.error('  ✗ ' + p);
  process.exit(2);
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

let server = null;
let baseUrl = args.get('url');
if (!baseUrl) {
  try {
    server = await startServer(5199);
    baseUrl = server.url;
  } catch (e) {
    console.error('lookcheck: could not start the dev server —', e.message);
    process.exit(2);
  }
}

let browser;
try {
  browser = await launchBrowser();
} catch (e) {
  if (server) server.child.kill('SIGKILL');
  console.error('lookcheck: could not launch chromium —', e.message);
  process.exit(2);
}

const { page, consoleErrors, pageErrors } = await openPage(browser, {
  viewport: BUDGET.capture.viewport,
  deviceScaleFactor: BUDGET.capture.deviceScaleFactor,
});

const frames = {};
const wetFrames = {};
let rendererString = 'unknown';
const infoAt = {};
const wetInfoAt = {};

try {
  const url = new URL(baseUrl);
  url.searchParams.set('seed', BUDGET.capture.seed);
  url.searchParams.set('shot', BUDGET.capture.shot);
  url.searchParams.set('paused', '1');

  await page.goto(url.toString(), { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!window.__NOCTIS_HARNESS__, null, { timeout: 60000 });
  await page.evaluate(() => window.__NOCTIS_HARNESS__.ready);
  await page.evaluate(() => window.__NOCTIS_HARNESS__.takeOver());

  rendererString = await readRendererString(page);
  note(`GPU: ${rendererString}\n`);

  /**
   * Dry first, all four times, then wet, all four times — rather than
   * alternating. Wetness is a uniform, but the sky LUT and its PMREM are
   * throttled on sun movement, so walking the four times twice costs two sets
   * of rebuilds either way and this ordering keeps the dry set contiguous.
   */
  const capture = async (name, t, wet, into, infoInto) => {
    await page.evaluate((w) => window.__NOCTIS_HARNESS__.setWetness(w), wet);
    await page.evaluate((tt) => window.__NOCTIS_HARNESS__.setTimeOfDay(tt), t);
    await page.evaluate((n) => window.__NOCTIS_HARNESS__.settle(n), BUDGET.capture.settleFrames);
    infoInto[name] = await page.evaluate(() => window.__NOCTIS_HARNESS__.info());

    const shot = await page.screenshot({ type: 'png' });
    const file = path.join(OUT, `${name}${wet > 0 ? '-wet' : ''}.png`);
    await writeFile(file, shot);
    into[name] = analyse(decodePNG(shot));
    into[name].file = file;
  };

  /**
   * Let the world finish arriving before anything is measured.
   *
   * Streaming is asynchronous, and the canyon field for a chunk takes about
   * 150 ms in a worker. `settle()` steps about forty-five frames, which at the
   * harness's uncapped rate is well under a second — so without this the gate
   * captured a city whose fields had not landed and every surface in it was lit
   * by the analytic default. It was visible in the frame once it was looked for:
   * the underside of the elevated rail deck rendered *pale*, because the default
   * has no way to know it is a soffit. The look gate must measure the settled
   * world, not the streaming system.
   */
  const arrival = await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity(1800));
  console.log(
    `  city streamed in over ${arrival.frames} frames — ${arrival.field.ready}/${arrival.field.slots} field slots ready` +
    (arrival.timedOut ? '  ** TIMED OUT: frames below were captured mid-stream **' : '')
  );

  for (const { name, t } of BUDGET.times) await capture(name, t, 0, frames, infoAt);
  for (const { name, t } of BUDGET.times) await capture(name, t, BUDGET.wetness.value, wetFrames, wetInfoAt);
  await page.evaluate(() => window.__NOCTIS_HARNESS__.setWetness(0));

  if (args.has('extra')) {
    const extraDir = path.join(OUT, 'extra');
    await mkdir(extraDir, { recursive: true });
    for (const t of [0.2, 0.22, 0.3, 0.62, 0.72, 0.75, 0.81, 0.84, 0.88, 0.94]) {
      await page.evaluate((tt) => window.__NOCTIS_HARNESS__.setTimeOfDay(tt), t);
      await page.evaluate(() => window.__NOCTIS_HARNESS__.settle(6));
      await writeFile(path.join(extraDir, `t${String(t).replace('.', '_')}.png`), await page.screenshot({ type: 'png' }));
    }
    for (const shotName of ['elevated', 'cross']) {
      await page.evaluate((s) => window.__NOCTIS_HARNESS__.setShot(s), shotName);
      for (const t of [0.5, 0.78, 0.0]) {
        await page.evaluate((tt) => window.__NOCTIS_HARNESS__.setTimeOfDay(tt), t);
        await page.evaluate(() => window.__NOCTIS_HARNESS__.settle(6));
        await writeFile(
          path.join(extraDir, `${shotName}-t${String(t).replace('.', '_')}.png`),
          await page.screenshot({ type: 'png' })
        );
      }
    }
    await page.evaluate((s) => window.__NOCTIS_HARNESS__.setShot(s), BUDGET.capture.shot);
  }
} catch (e) {
  await browser.close();
  if (server) server.child.kill('SIGKILL');
  console.error('lookcheck: capture failed —', e.message);
  if (e.stack) console.error(e.stack.split('\n').slice(1, 5).join('\n'));
  process.exit(2);
}

await browser.close();
if (server) server.child.kill('SIGKILL');

/**
 * The harness state that went with each frame, written beside the PNGs.
 *
 * Session 3 added assertions over things a PNG cannot carry — how many eras the
 * block placed, what roughness the facades are drawn with — and `gateaudit.mjs`
 * has to be able to break those the same way it breaks a pixel. It cannot
 * fabricate them plausibly, so the capture writes down what it saw and the
 * audit perturbs that. Same rule as the frames: the audit measures what the
 * gate actually produced, and there is no synthetic substitute.
 */
await writeFile(
  path.join(OUT, 'capture.json'),
  JSON.stringify({ renderer: rendererString, infoAt, wetInfoAt }, null, 1)
);

// ---------------------------------------------------------------------------
// assertions
// ---------------------------------------------------------------------------

const { failures, report, suppressed } = assertLook({
  budget: BUDGET,
  frames,
  wetFrames,
  infoAt,
  consoleErrors,
  pageErrors,
});

// The wet pass runs different shader branches from the dry one. If wetness
// throws, only the wet captures would show it, and assertLook only sees the dry
// harness state — so the wet side is asserted here, against the same threshold.
for (const { name } of BUDGET.times) {
  const i = wetInfoAt[name];
  if (!i) continue;
  if (i.faults > BUDGET.hardFails.quarantinedModules) {
    failures.push({ key: `hard:faults:${name}-wet`, message: `${name} wet: ${i.faults} quarantined module(s)` });
  }
  if (i.clusterOverflow !== BUDGET.hardFails.clusterOverflow) {
    failures.push({ key: `hard:overflow:${name}-wet`, message: `${name} wet: clustered lighting overflowed` });
  }
}

note('frame                mean     sd    clipW    blackK   R-B     clusters  lamps');
for (const { name } of BUDGET.times) {
  const m = frames[name];
  const c = report.clusters[name];
  note(
    `  ${name.padEnd(18)} ${m.meanLuminance.toFixed(4)}  ${m.stdDev.toFixed(3)}  ` +
      `${(m.clippedWhite * 100).toFixed(3)}%  ${(m.crushedBlack * 100).toFixed(3)}%  ` +
      `${m.meanRminusB.toFixed(3).padStart(6)}  ${String(c.clusters).padStart(6)}    ` +
      `${infoAt[name].photocellOn ? 'on ' : 'off'}   ` +
      `crush top/mid/low ${m.crushedBand.map((v) => (v * 100).toFixed(1)).join('/')}%`
  );
}
note('');
{
  const i = infoAt[BUDGET.times[0].name];
  note(
    `  shot '${i.shot}' at [${i.cameraPos.join(', ')}]  fov ${i.cameraFov}  aspect ${i.cameraAspect}  ` +
      `viewport ${i.viewport.join('×')}  buffer ${i.drawingBuffer.join('×')}`
  );
}
for (const { name } of BUDGET.times) {
  const i = infoAt[name];
  note(
    `  ${name.padEnd(10)} sun ${i.sunElevationDeg.toFixed(1)}° az ${i.sunAzimuthDeg.toFixed(0)}°  ` +
      `moon ${i.moonElevationDeg.toFixed(1)}°  ${Math.round(i.sunLux)} lx direct  ` +
      `${i.ambientLux.toFixed(1)} lx ambient  ${i.drawCalls} draws  ${i.clusteredLights} local lights`
  );
}
note('');
for (const [pair, msd] of Object.entries(report.msd)) {
  note(`  msd ${pair.replace('|', ' ↔ ')}: ${msd.toFixed(5)}`);
}
note('');

// The session 2 measurements, printed whether they pass or not — a gate that
// only speaks when it is angry teaches nobody anything about the frame.
note('indirect light and materials');
note(`  noon shadowed road      mean RGB ${report.regions.shadowRoad.mean.map((v) => v.toFixed(0)).join(',')}  ` +
  `B/R ${report.regions.shadowRoad.blueOverRed.toFixed(3)} (max ${BUDGET.shadowHue.maxBlueOverRed})`);
for (const [name, floor] of Object.entries(BUDGET.facadeHue.minSeparationDeg)) {
  const f = report.regions[`facadeHue:${name}`];
  note(
    `  ${name} facade hue      left ${f.a.hueDeg.toFixed(0)}°  right ${f.b.hueDeg.toFixed(0)}°  ` +
      `separation ${f.sep.toFixed(1)}° (min ${floor}°)`
  );
}
note(
  `  midnight road pools     ${report.regions.pools.clusters} (min ${BUDGET.groundPools.minCount}), ` +
    `threshold ${report.regions.pools.threshold.toFixed(4)} over a median of ${report.regions.pools.median.toFixed(4)}`
);
note('  wet road specular spread');
for (const { name } of BUDGET.times) {
  const w = report.wet[name];
  note(
    `    ${name.padEnd(10)} dry ${w.dry.toFixed(4)}  wet ${w.wet.toFixed(4)}  ` +
      `${(w.wet / Math.max(w.dry, 1e-9)).toFixed(2)}× (min ${BUDGET.wetness.minSpreadOverDry}×)  ` +
      `msd vs dry ${w.msd.toFixed(5)}`
  );
}
note('');

// The session 3 measurements, printed pass or fail for the same reason as
// session 2's: a gate that only speaks when it is angry teaches nobody
// anything about the frame.
note('reflections and facade variation');
if (report.reflections) {
  const r = report.reflections;
  note(
    `  midnight-wet reflections  ${r.streaks} elongated (min ${BUDGET.ssrReflections.minCount}), ` +
      `${r.components} bright components, ${r.rejected} too round or short, ` +
      `tallest ${(r.tallestFrac * 100).toFixed(1)}% of frame (min ${(BUDGET.ssrReflections.minVerticalFrac * 100).toFixed(1)}%)`
  );
  if (r.sample.length) {
    note(`    largest: ${r.sample.map((s) => `${s.area}px ${(s.vertical * 100).toFixed(1)}%h ${s.aspect}:1`).join('   ')}`);
  }
}
{
  const f = report.facade;
  note(
    `  dusk wall albedo          ${f.clusters.clusters} distinct cluster(s) over ${BUDGET.facadeVariation.patches.length} walls ` +
      `(min ${BUDGET.facadeVariation.minAlbedoClusters}), closest pair ${f.clusters.closest.toFixed(3)} ` +
      `vs separation ${BUDGET.facadeVariation.albedoSeparation}`
  );
  for (const name of BUDGET.facadeVariation.patches) {
    const p = f.patches[name];
    note(
      `    ${name.padEnd(14)} u ${p.u.toFixed(3)}  v ${p.v.toFixed(3)}  luma ${p.luma.toFixed(3)}  ` +
        `span ${p.spread.toFixed(2)}`
    );
  }
  note(
    `    neighbours: ${Object.entries(f.neighbours)
      .map(([k, v]) => `${k.split('|')[0]}→${k.split('|')[1]} ${v.toFixed(3)}`)
      .join('   ')}  (min ${BUDGET.facadeVariation.minNeighbourDelta})`
  );
  if (f.roughness) {
    note(
      `  facade roughness          ${f.roughness.clusters.clusters} distinct ` +
        `(min ${BUDGET.facadeVariation.minRoughnessClusters}): ${f.roughness.values.map((v) => v.toFixed(2)).join(', ')}`
    );
  }
}
if (report.midFacade) {
  const M = BUDGET.midDistanceVariation;
  const g = report.midFacade;
  note(
    `  mid-distance wall albedo  ${g.clusters.clusters} distinct cluster(s) over ${M.patches.length} walls ` +
      `(min ${M.minAlbedoClusters}), closest pair ${g.clusters.closest == null ? 'n/a' : g.clusters.closest.toFixed(3)} ` +
      `vs floor ${M.minClosest}`
  );
  for (const name of M.patches) {
    const p = g.patches[name];
    note(
      `    ${name.padEnd(14)} u ${p.u.toFixed(3)}  v ${p.v.toFixed(3)}  luma ${p.luma.toFixed(3)}  ` +
        `span ${p.spread.toFixed(2)}`
    );
  }
}
if (report.structure) {
  note(
    `  structure                 ${Object.entries(report.structure)
      .map(([k, v]) => `${v} ${k}`)
      .join(', ')}`
  );
  const v = infoAt[BUDGET.structuralVariation.at].block.variation;
  note(`    era per building      ${v.eras.join(' ')}`);
  note(`    rhythm per building   ${v.rhythms.join(' ')}`);
  note(`    ground floor          ${v.groundFloors.join(' ')}`);
  note(`    floor height (m)      ${v.floorHeights.map((q) => q.toFixed(2)).join(' ')}`);
}
note('');

if (rendererIsSoftware(rendererString)) {
  console.error(
    `lookcheck: software renderer ("${rendererString}") — the frames are not this machine's frames.`
  );
  process.exit(2);
}

if (suppressed.length) {
  console.log('ASSERTIONS THAT DID NOT RUN — these are not passes');
  for (const s of suppressed) console.log(`  ‼ [${s.key}] ${s.because}`);
  console.log('');
}

if (failures.length) {
  console.log('LOOK VIOLATIONS');
  for (const f of failures) console.log(`  ✗ [${f.key}] ${f.message}`);
  console.log(`\nFrames are in tools/look-out/. Open them before changing any number in look-budget.json.`);
  process.exit(1);
}

if (suppressed.length) {
  // Nothing is red and something never ran. That is not green.
  console.log(
    `${suppressed.length} assertion(s) were suppressed by an upstream failure and nothing else failed — ` +
    `the suite cannot report green on a check it did not perform.`
  );
  process.exit(1);
}

console.log(`All eight frames within the look budget. PNGs in tools/look-out/`);
process.exit(0);
