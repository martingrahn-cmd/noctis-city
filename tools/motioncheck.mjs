#!/usr/bin/env node
/**
 * motioncheck.mjs — NOT A GATE. The motion-vector attachment, verified on one
 * scripted moving object. CONTRACT §5.11.
 *
 *   node tools/motioncheck.mjs
 *   node tools/motioncheck.mjs --json
 *
 * WHY THIS EXISTS AND WHY IT IS NOT PART OF perfcheck
 *
 * `src/modules/post.js` predicted, in writing and before anything moved, that
 * the first moving object would break TAA — and gave the arithmetic: a vehicle
 * at 12 m/s at 30 m crosses the frame at about eighteen pixels a frame against
 * a ±1 px neighbourhood clamp, so the history is rejected and traffic aliases
 * rather than ghosts. A prediction made in writing is closed in writing, and
 * this is the closing.
 *
 * It is not a gate because there is nothing in the shipping world for it to
 * assert about: the probe is an instrument the harness creates on request and
 * removes afterwards, and a gate whose subject the operator creates measures
 * the operator (CONTRACT §7, on `lookat.mjs`, for the same reason).
 *
 * WHAT IT CHECKS, IN THE ORDER THAT MATTERS
 *
 *   1. THE ATTACHMENT IS ZERO WITH NOTHING MOVING. Not "small" — zero. The
 *      motion is computed as a difference of two identical expressions when the
 *      object has not moved, so any non-zero reading over a static world means
 *      a matrix is wrong, and the failure would otherwise show up as a
 *      city-wide softening that looks like a TAA tuning problem.
 *   2. IT IS NON-ZERO EXACTLY WHERE THE BOX IS, AND NOWHERE ELSE. A field that
 *      is non-zero everywhere is a camera term that failed to cancel.
 *   3. ITS MAGNITUDE IS THE ONE THE GEOMETRY PREDICTS. The expected NDC
 *      displacement per frame is computable on paper from the speed, the
 *      distance and the fov; the measurement is compared against it rather than
 *      merely inspected. This is the only kind of check that has ever found
 *      anything in CONTRACT §9.
 *   4. THE RESOLVE USES IT. Captured twice — once with the probe's previous
 *      transform supplied and once with it withheld — and the two frames are
 *      compared. Withheld is exactly the session-5 behaviour, so the difference
 *      between them IS the thing this session added.
 *
 *      WITH THE NEIGHBOURHOOD CLAMP WIDENED, and finding that out was the
 *      afternoon. At the shipping 1.25σ the two frames differ by 1.5/255 and
 *      the difference is not concentrated at the box at all — because the
 *      clamp's job is to clip wrong history into the current colour, so wrong
 *      history and right history resolve to nearly the same image. That is the
 *      clamp working, and it is exactly what `post.js` predicted traffic would
 *      look like: aliasing, not ghosting, because a failed reprojection here
 *      costs the accumulation rather than the colour. It also means the
 *      resolved frame cannot answer this question while the clamp is on.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { startServer, launchBrowser, openPage, readRendererString, rendererIsSoftware } from './lib/page.mjs';
import { decodePNG } from './lib/png.mjs';

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);
const JSON_OUT = args.has('json');
const log = (...m) => { if (!JSON_OUT) console.log(...m); };

/**
 * How much of the frame the box occupies, roughly, so the "non-zero exactly
 * where the box is" check has something to compare against. A 2.4 m box at
 * 30 m through a 50° vertical fov subtends 2.4/30 = 0.08 rad, against a frame
 * 2·tan(25°) = 0.933 rad tall — so about 8.6% of the height and, at 16:9, 4.8%
 * of the width: 0.41% of the pixels. Bounds rather than a value, because the
 * box is a cube seen at an angle and its silhouette is between one and √2
 * faces wide.
 */
const EXPECTED_COVERAGE = [0.002, 0.02];

/** Per-frame NDC displacement the measurement has to land inside, as a ratio. */
const MAGNITUDE_TOLERANCE = 0.15;

/** TAA.clipGamma, mirrored only so check 4 can say what it widened from. */
const TAA_CLIP_GAMMA = 1.25;


let server;
let browser;
let opened;
const findings = [];
const report = {};

const check = (ok, msg) => {
  findings.push({ ok, msg });
  log(`  ${ok ? '✓' : '✗'} ${msg}`);
};

try {
  server = await startServer(5185);
  browser = await launchBrowser();
  opened = await openPage(browser, { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
  const page = opened.page;

  await page.goto(`${server.url}?perf=1&seed=1337&t=0.5`, { waitUntil: 'load', timeout: 90_000 });
  await page.waitForFunction(() => window.__NOCTIS_HARNESS__, null, { timeout: 60_000 });
  await page.evaluate(() => window.__NOCTIS_HARNESS__.ready);

  const gpu = await readRendererString(page);
  if (rendererIsSoftware(gpu)) throw new Error(`software renderer (${gpu})`);
  log(`GPU: ${gpu}\n`);

  const faults = await page.evaluate(() => window.__NOCTIS_HARNESS__.faults());
  if (faults.length) {
    throw new Error(`${faults.length} module(s) quarantined: ${faults.map((f) => `${f.name}/${f.phase}: ${f.message}`).join(' | ')}`);
  }

  await page.evaluate(() => window.__NOCTIS_HARNESS__.takeOver());
  await page.evaluate(() => window.__NOCTIS_HARNESS__.setShot('street'));
  await page.evaluate(() => window.__NOCTIS_HARNESS__.settle());

  const geometry = await page.evaluate(() => {
    const i = window.__NOCTIS_HARNESS__.info();
    return { internal: i.internal, fov: i.cameraFov };
  });
  const cameraFov = geometry.fov;
  log(`internal render resolution ${geometry.internal.join('×')}, camera fov ${cameraFov}°\n`);

  await mkdir(new URL('./motion-out/', import.meta.url), { recursive: true });

  /**
   * Decode a screenshot of the motion debug view back into NDC.
   *
   * The encoder writes 0.5 + motion·scale per channel with no output colour
   * -space encode, so the bytes in the PNG are the bytes that were written and
   * this is the exact inverse. The scale comes from `post` through the harness
   * — one copy, never a second constant here (CONTRACT §9 rule 3).
   */
  function decodeMotion(png, scale) {
    const img = decodePNG(png);
    const px = Math.floor(img.data.length / img.channels);
    // One encoded step is 1/255; the zero point is 128/255 rather than exactly
    // 0.5, so the noise floor is half a step either side.
    const floor = 1.5 / 255 / scale;
    let nonZero = 0;
    let maxX = 0;
    let maxMag = 0;
    let sumX = 0;
    let minPx = Infinity;
    let maxPx = -Infinity;
    let minPy = Infinity;
    let maxPy = -Infinity;
    for (let i = 0, p = 0; i + 2 < img.data.length; i += img.channels, p++) {
      const mx = (img.data[i] / 255 - 128 / 255) / scale;
      const my = (img.data[i + 1] / 255 - 128 / 255) / scale;
      const mag = Math.hypot(mx, my);
      if (mag > floor) {
        nonZero++;
        sumX += mx;
        if (Math.abs(mx) > Math.abs(maxX)) maxX = mx;
        const x = p % img.width;
        const y = Math.floor(p / img.width);
        if (x < minPx) minPx = x;
        if (x > maxPx) maxPx = x;
        if (y < minPy) minPy = y;
        if (y > maxPy) maxPy = y;
      }
      if (mag > maxMag) maxMag = mag;
    }
    return {
      pixels: px,
      width: img.width,
      height: img.height,
      nonZero,
      nonZeroFraction: +(nonZero / px).toFixed(6),
      meanX: nonZero ? +(sumX / nonZero).toFixed(6) : 0,
      maxX: +maxX.toFixed(6),
      maxMagnitude: +maxMag.toFixed(6),
      noiseFloorNdc: +floor.toFixed(7),
      bbox: nonZero ? [minPx, minPy, maxPx, maxPy] : null,
    };
  }

  const view = await page.evaluate(() => window.__NOCTIS_HARNESS__.showMotion(true));
  const SCALE = view.scale;
  log(`motion debug view: gain ${SCALE}, one encoded step = ${(1 / 255 / SCALE).toExponential(2)} NDC\n`);

  // --- 1. nothing moves -----------------------------------------------------
  log('1. the attachment over a world in which nothing moves');
  await page.evaluate(() => window.__NOCTIS_HARNESS__.step(4));
  const stillPng = await page.screenshot({ type: 'png' });
  await writeFile(new URL('./motion-out/motion-static.png', import.meta.url), stillPng);
  const still = decodeMotion(stillPng, SCALE);
  report.still = still;
  log(
    `   ${still.nonZero} of ${still.pixels} texels above the ${still.noiseFloorNdc} NDC ` +
    `encoding floor, largest magnitude ${still.maxMagnitude}`
  );
  check(
    still.nonZero === 0,
    `static world writes zero motion to within the encoding floor ` +
    `(${still.noiseFloorNdc} NDC, ${(still.noiseFloorNdc * 1440 / 2).toFixed(3)} px) — ` +
    `${still.nonZero} texels above it`
  );

  // --- 2 & 3. one box on a fixed path --------------------------------------
  log('\n2. one box, 12 m/s across the view at 30 m');
  const expect = await page.evaluate(() => window.__NOCTIS_HARNESS__.motionProbe());
  report.expected = expect;
  log(
    `   predicted: ${expect.metresPerFrame} m/frame at ${expect.distance} m → ` +
    `${expect.pixelsPerFrame} px/frame, ${expect.ndcPerFrame} NDC/frame`
  );

  // Several frames, so the probe has a previous transform that is not its
  // initial one and the motion is a steady-state reading rather than a start
  // transient.
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.__NOCTIS_HARNESS__.updateMotionProbe());
    await page.evaluate(() => window.__NOCTIS_HARNESS__.step(1));
  }
  const movingPng = await page.screenshot({ type: 'png' });
  await writeFile(new URL('./motion-out/motion-moving.png', import.meta.url), movingPng);
  const moving = decodeMotion(movingPng, SCALE);
  report.moving = moving;
  log(
    `   measured:  ${moving.nonZero} of ${moving.pixels} texels non-zero ` +
    `(${(moving.nonZeroFraction * 100).toFixed(3)}% of the frame), ` +
    `mean ${moving.meanX} NDC in x, largest ${moving.maxX}, ` +
    `bounding box ${moving.bbox ? moving.bbox.join(',') : '—'}`
  );

  check(
    moving.nonZero > 0,
    `a moving object writes motion at all (${moving.nonZero} texels)`
  );
  check(
    moving.nonZeroFraction >= EXPECTED_COVERAGE[0] && moving.nonZeroFraction <= EXPECTED_COVERAGE[1],
    `motion is confined to the box: ${(moving.nonZeroFraction * 100).toFixed(3)}% of the frame, ` +
    `expected ${(EXPECTED_COVERAGE[0] * 100).toFixed(1)}–${(EXPECTED_COVERAGE[1] * 100).toFixed(1)}%`
  );

  log('\n3. magnitude against the geometry');
  const ratio = Math.abs(moving.maxX) / Math.max(1e-9, Math.abs(expect.ndcPerFrame));
  report.magnitudeRatio = +ratio.toFixed(4);
  log(`   measured / predicted = ${ratio.toFixed(4)}`);
  check(
    Math.abs(ratio - 1) <= MAGNITUDE_TOLERANCE,
    `magnitude matches the prediction within ${(MAGNITUDE_TOLERANCE * 100).toFixed(0)}%: ` +
    `${Math.abs(moving.maxX).toFixed(6)} measured vs ${Math.abs(expect.ndcPerFrame).toFixed(6)} predicted`
  );

  await page.evaluate(() => window.__NOCTIS_HARNESS__.showMotion(false));
  await page.evaluate(() => window.__NOCTIS_HARNESS__.clearMotionProbe());

  // --- 4. the resolve uses it ----------------------------------------------
  //
  // With the probe's previous transform withheld the motion is zero and the
  // resolve is exactly session 5's: camera reprojection only, moving edge
  // rejected by the neighbourhood clamp. The difference between the two frames
  // is what this session added.
  log('\n4. the resolve reads it — with the neighbourhood clamp out of the way');

  /**
   * BOTH RUNS START FROM THE SAME STATE, and the first version of this did not.
   *
   * Without the `settle()`, capture B began where capture A's twenty-five
   * frames had left the exposure meter and the temporal accumulation, so 6.4%
   * of the pixels OUTSIDE the box differed between them — a difference that had
   * nothing to do with motion vectors and would have been reported as though it
   * did. `settle()` snaps the adaptation and converges the history, so the two
   * runs differ in exactly one thing: whether the probe's previous transform
   * was supplied.
   *
   * The probe is recreated first so `probeT` restarts, which puts the box in
   * the same place at the same frame in both runs. The difference is then the
   * resolve's, not the path's.
   */
  const capture = async (withMotion) => {
    await page.evaluate(() => window.__NOCTIS_HARNESS__.motionProbe());
    await page.evaluate(() => window.__NOCTIS_HARNESS__.settle());
    for (let i = 0; i < 24; i++) {
      // The probe advances along its path either way; only the transform it
      // reports having had is withheld. The box is therefore in the same place
      // in both runs and the only difference is what the resolve is told.
      await page.evaluate(
        (on) => window.__NOCTIS_HARNESS__.updateMotionProbe(1 / 60, on),
        withMotion
      );
      await page.evaluate(() => window.__NOCTIS_HARNESS__.step(1));
    }
    const shot = await page.screenshot({ type: 'png' });
    // Where the box actually is in that frame, read off the attachment rather
    // than predicted from the path. One extra frame; the composite is already
    // captured, so moving the probe on costs nothing.
    await page.evaluate(() => window.__NOCTIS_HARNESS__.showMotion(true));
    await page.evaluate(() => window.__NOCTIS_HARNESS__.updateMotionProbe(1 / 60, true));
    await page.evaluate(() => window.__NOCTIS_HARNESS__.step(1));
    const where = decodeMotion(await page.screenshot({ type: 'png' }), SCALE);
    await page.evaluate(() => window.__NOCTIS_HARNESS__.showMotion(false));
    return { shot, bbox: where.bbox };
  };

  /**
   * THE CLAMP IS WIDENED FOR THIS CHECK, AND THAT IS THE FINDING AS MUCH AS THE
   * RESULT.
   *
   * With the neighbourhood clamp at its shipping 1.25σ, history fetched from
   * the wrong place is clipped into the current 3×3 distribution and comes back
   * as approximately the current colour — so a reprojection that is wrong by
   * ten pixels a frame, or by forty percent of the screen, resolves to nearly
   * the same image either way. Measured: 1.5/255 mean, and no concentration at
   * the box at all. THAT IS THE CLAMP WORKING, and it is precisely what
   * `post.js` predicted about traffic — it aliases rather than ghosts, because
   * what a failed reprojection costs in this renderer is the accumulation, not
   * the colour.
   *
   * It also means the resolved frame cannot answer "does the resolve read the
   * buffer" while the clamp is on. Widening it to 40σ removes the suppression
   * and leaves the reprojection, which is the thing under test.
   */
  const wideGamma = await page.evaluate(() => window.__NOCTIS_HARNESS__.setClipGamma(40));
  log(`   neighbourhood clip widened from ${TAA_CLIP_GAMMA}σ to ${wideGamma}σ for this check only`);
  const A = await capture(true);
  const B = await capture(false);
  await page.evaluate(() => window.__NOCTIS_HARNESS__.setClipGamma(null));
  const withPng = A.shot;
  const withoutPng = B.shot;
  await writeFile(new URL('./motion-out/probe-with-motion.png', import.meta.url), withPng);
  await writeFile(new URL('./motion-out/probe-without-motion.png', import.meta.url), withoutPng);

  const a = decodePNG(withPng);
  const b = decodePNG(withoutPng);

  /**
   * WHERE the frame changed, not only how much.
   *
   * "7.6% of pixels changed" would be a satisfying number and a misleading one:
   * the exposure meter reads the resolved buffer, so a box that resolves
   * differently shifts the log-average and every pixel in the frame moves by a
   * count or two. That is a real consequence and it is not evidence that the
   * motion vector reached the resolve. What is evidence is that the change is
   * CONCENTRATED where the box swept — so the changed pixels inside the sweep
   * band are counted separately from the ones outside it, and the ratio between
   * the two densities is the finding.
   *
   * The band is the box's OWN SILHOUETTE, read off the motion attachment in the
   * captured frame rather than predicted from the path — dilated by a quarter
   * of its width so the resolved edge and its immediate history are inside it.
   * The first version used the whole swept path, which at ±12 m of travel seen
   * from 30 m is 96% of the frame width, so "inside the band" meant "in the
   * frame" and the test could not discriminate. A band that covers everything
   * measures nothing.
   */
  const px = Math.floor(Math.min(a.data.length, b.data.length) / a.channels);
  if (!A.bbox) throw new Error('the motion attachment reported no box — nothing to localise against');
  const pad = Math.round((A.bbox[2] - A.bbox[0]) * 0.25);
  const bandX = [Math.max(0, A.bbox[0] - pad), Math.min(a.width - 1, A.bbox[2] + pad)];
  const bandY = [Math.max(0, A.bbox[1] - pad), Math.min(a.height - 1, A.bbox[3] + pad)];

  let diff = 0;
  let changedIn = 0;
  let changedOut = 0;
  let pxIn = 0;
  for (let p = 0; p < px; p++) {
    const i = p * a.channels;
    const d =
      Math.abs(a.data[i] - b.data[i]) +
      Math.abs(a.data[i + 1] - b.data[i + 1]) +
      Math.abs(a.data[i + 2] - b.data[i + 2]);
    diff += d / 3;
    const x = p % a.width;
    const y = Math.floor(p / a.width);
    const inside = x >= bandX[0] && x <= bandX[1] && y >= bandY[0] && y <= bandY[1];
    if (inside) pxIn++;
    if (d > 6) {
      if (inside) changedIn++;
      else changedOut++;
    }
  }
  const pxOut = px - pxIn;
  const densityIn = changedIn / Math.max(1, pxIn);
  const densityOut = changedOut / Math.max(1, pxOut);
  report.frameDiff = {
    mean255: +(diff / px).toFixed(4),
    band: { x: bandX, y: bandY, pixels: pxIn },
    changedInside: changedIn,
    changedOutside: changedOut,
    densityInside: +densityIn.toFixed(5),
    densityOutside: +densityOut.toFixed(5),
    concentration: +(densityIn / Math.max(1e-9, densityOut)).toFixed(2),
  };
  log(
    `   with vs without: ${(diff / px).toFixed(3)}/255 mean over the frame\n` +
    `   box silhouette x ${bandX[0]}–${bandX[1]}, y ${bandY[0]}–${bandY[1]} (${pxIn} px, ` +
    `${((pxIn / px) * 100).toFixed(2)}% of the frame)\n` +
    `   changed density: ${(densityIn * 100).toFixed(2)}% inside the band, ` +
    `${(densityOut * 100).toFixed(2)}% outside — ${(densityIn / Math.max(1e-9, densityOut)).toFixed(1)}× concentrated`
  );
  check(
    changedIn > 0 && densityIn > 4 * densityOut,
    `the motion vector reaches the resolve, and only where it is written: ` +
    `${(densityIn * 100).toFixed(2)}% of the box silhouette changed against ` +
    `${(densityOut * 100).toFixed(2)}% elsewhere (needs 4× concentration; anything less ` +
    `is the exposure meter moving rather than the reprojection)`
  );

  await page.evaluate(() => window.__NOCTIS_HARNESS__.clearMotionProbe());

  const errs = opened.consoleErrors.concat(opened.pageErrors);
  check(errs.length === 0, `no console or page errors (${errs.length})${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`);
} catch (e) {
  if (opened) await opened.context.close();
  if (browser) await browser.close();
  if (server) server.child.kill('SIGKILL');
  console.error('harness: run failed —', e.message);
  process.exit(2);
}

await opened.context.close();
await browser.close();
server.child.kill('SIGKILL');

await writeFile(
  new URL('./motion-out/motion.json', import.meta.url),
  JSON.stringify({ findings, report }, null, 1)
);

const bad = findings.filter((f) => !f.ok);
if (JSON_OUT) {
  console.log(JSON.stringify({ pass: bad.length === 0, findings, report }, null, 2));
} else if (bad.length) {
  console.log('\nMOTION VECTORS NOT VERIFIED\n' + bad.map((f) => '  ✗ ' + f.msg).join('\n'));
  console.log('\nFrames in tools/motion-out/.');
} else {
  console.log('\nMotion vectors verified on a scripted moving object. Frames in tools/motion-out/.');
}
process.exit(bad.length ? 1 : 0);
