#!/usr/bin/env node
/**
 * gaitstrip.mjs — one pedestrian, one fixed close camera, the whole gait cycle
 * laid out side by side. A DIAGNOSTIC, NOT A GATE, and it asserts nothing.
 *
 *   node tools/gaitstrip.mjs                        every build, both views
 *   node tools/gaitstrip.mjs --build=coated
 *   node tools/gaitstrip.mjs --build=coated --phases=12 --views=side
 *   node tools/gaitstrip.mjs --dist=4 --t=0.5 --tag=after
 *
 * WHY THIS EXISTS, which is the only part worth reading.
 *
 * Session 11 opened on two defects in `custom-s10-close-t0_5.png` that eleven
 * sessions of gates had not seen: a coat standing off the torso as a separate
 * wing, and a leg passing through the other hip at full stride. Neither is
 * visible from any assertion in the project. Neither should GET an assertion
 * either — "the coat does not clip" is a floor on a quantity nobody can name,
 * and CONTRACT §9.1 records seven gates that went quiet because the quantity
 * they measured was not the property they were named after.
 *
 * What both defects have in common is that they are properties of the CYCLE.
 * A single pose is a photograph of one phase, and every frame this project has
 * ever captured shows each figure at exactly one phase — whichever one it
 * happened to be at. A self-intersection at u = 0.25 is invisible at u = 0 and
 * at u = 0.5, so a rest-pose check passes, a gate sampling one frame passes,
 * and the defect ships. Eight phases in one image is the smallest thing that
 * shows the property that is actually wrong.
 *
 * So: no numbers, no thresholds, no pass or fail. It renders the cycle and a
 * person looks at it. That is the correct instrument for "does this read as a
 * body", and the wrong instrument is a metric that says it does.
 *
 * IT GOES THROUGH THE RENDER PATH (CONTRACT §7.3.1). The displacement is
 * computed by `lights.js`'s injected `GAIT_GLSL` on the GPU, from
 * `src/lib/gait.js`'s constants, on the same material with the same garment
 * mask the frame draws. Re-deriving the pose in node here would be §9.1's
 * two-copies-of-a-formula, and the copy that drifts is always the one nobody
 * is looking at.
 *
 * Writes to `tools/gait-out/`.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { decodePNG, encodePNG } from './lib/png.mjs';
import { startServer, launchBrowser, openPage, readRendererString } from './lib/page.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = path.join(ROOT, 'tools', 'gait-out');

const args = new Map(
  process.argv.slice(2).map((a) => {
    const i = a.indexOf('=');
    return i < 0 ? [a.replace(/^--/, ''), 'true'] : [a.slice(2, i), a.slice(i + 1)];
  })
);

/**
 * Where the camera stands, in the FIGURE's own frame, and 4 m is the number
 * the brief names rather than one picked to flatter.
 *
 * A defect that reads at 4 m and not at 10 is still a defect: the player can
 * walk, so 4 m is the ordinary case and 10 m is the far one. The strip is
 * therefore shot at the distance the defect is worst, which is the distance a
 * person standing next to the subject sees.
 *
 * `azDeg` is the camera's bearing off the figure's OWN HEADING: the instance
 * matrix maps local +Z onto the heading, so a camera displaced along the
 * heading stands in front of the figure and looks at its face. 0° is dead
 * ahead, 90° broadside, 180° from behind.
 *
 * Broadside is where the fore/aft shear lives — a hem that does not clear a
 * swinging knee — and dead ahead is where anything lateral lives, a leg over
 * the other hip or a garment narrower than the pelvis inside it. One view
 * cannot show both, which is why the default is both. The three-quarter is
 * the one a player actually gets and is what the crowd shot was.
 */
const VIEWS = {
  side: { azDeg: 90, label: 'broadside' },
  front: { azDeg: 0, label: 'dead ahead' },
  quarter: { azDeg: 35, label: 'three-quarter front' },
  back: { azDeg: 180, label: 'from behind' },
};

const num = (k, d) => (args.has(k) ? Number(args.get(k)) : d);
const PHASES = Math.max(2, Math.round(num('phases', 8)));
const DIST = num('dist', 4);
/** Eye height. `lookat.mjs`'s figure, and the routes': a person on a pavement. */
const EYE = num('eye', 1.66);
/** Mid-body, so the hem, the hips and the feet are all well inside the frame. */
const AIM = num('aim', 0.95);
const FOV = num('fov', 40);
const T = num('t', 0.5);
const WET = num('wet', 0);
const AMP = num('amp', 1);
const W = Math.round(num('w', 560));
const H = Math.round(num('h', 900));
const TAG = args.get('tag') || '';

const wantViews = (args.get('views') || 'side,front').split(',').filter((v) => {
  if (VIEWS[v]) return true;
  console.error(`gaitstrip: no view '${v}'. Have: ${Object.keys(VIEWS).join(', ')}`);
  process.exit(2);
  return false;
});

await mkdir(OUT, { recursive: true });

let server = null;
let baseUrl = args.get('url');
if (!baseUrl) {
  server = await startServer(5203);
  baseUrl = server.url;
}
const browser = await launchBrowser();
const { page } = await openPage(browser, {
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
});

/**
 * Tile frames left to right with a one-pixel rule between them.
 *
 * The rule is not decoration: without it two adjacent phases of the same
 * figure against the same background read as one wide image, and the eye
 * stops registering where one pose ends and the next begins — which is the
 * whole reading the strip is for.
 */
function strip(frames, gap = 2) {
  const w = frames[0].width;
  const h = frames[0].height;
  const ch = 3;
  const width = frames.length * w + (frames.length - 1) * gap;
  const data = Buffer.alloc(width * h * ch, 20);
  for (let f = 0; f < frames.length; f++) {
    const src = frames[f];
    if (src.width !== w || src.height !== h) {
      throw new Error(`gaitstrip: frame ${f} is ${src.width}x${src.height}, expected ${w}x${h}`);
    }
    const x0 = f * (w + gap);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const s = (y * src.width + x) * src.channels;
        const d = (y * width + x0 + x) * ch;
        data[d] = src.data[s];
        data[d + 1] = src.data[s + 1];
        data[d + 2] = src.data[s + 2];
      }
    }
  }
  return { width, height: h, channels: ch, data };
}

/** Stack strips vertically, one view per row, same rule between them. */
function stack(rows, gap = 2) {
  const width = Math.max(...rows.map((r) => r.width));
  const height = rows.reduce((t, r) => t + r.height, 0) + (rows.length - 1) * gap;
  const data = Buffer.alloc(width * height * 3, 20);
  let y0 = 0;
  for (const r of rows) {
    for (let y = 0; y < r.height; y++) {
      r.data.copy(data, ((y0 + y) * width) * 3, y * r.width * 3, (y * r.width + r.width) * 3);
    }
    y0 += r.height + gap;
  }
  return { width, height, channels: 3, data };
}

try {
  const url = new URL(baseUrl);
  url.searchParams.set('seed', args.get('seed') || '1337');
  url.searchParams.set('paused', '1');
  await page.goto(url.toString(), { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!window.__NOCTIS_HARNESS__, null, { timeout: 60000 });
  await page.evaluate(() => window.__NOCTIS_HARNESS__.ready);
  await page.evaluate(() => window.__NOCTIS_HARNESS__.takeOver());
  console.log(`GPU: ${await readRendererString(page)}`);
  await page.evaluate((w) => window.__NOCTIS_HARNESS__.setWetness(w), WET);
  await page.evaluate((t) => window.__NOCTIS_HARNESS__.setTimeOfDay(t), T);

  const builds = await page.evaluate(() => window.__NOCTIS_HARNESS__.pedestrianBuilds());
  const wantBuilds = args.has('build')
    ? args.get('build').split(',')
    : builds.filter((b) => b.instances > 0).map((b) => b.name);
  console.log(`builds: ${builds.map((b) => `${b.name}(${b.instances})`).join(', ')}`);
  console.log(
    `${PHASES} phases x ${wantViews.length} view(s) at ${DIST} m, eye ${EYE} m, fov ${FOV}, t=${T}`
  );

  for (const build of wantBuilds) {
    // Pose FIRST and read the pose back: posing freezes the population, so the
    // camera below is placed against where the subject actually is rather than
    // where it was asked to be, and a build that is not in the population is an
    // error here instead of eight photographs of an empty pavement.
    const pose = await page.evaluate(
      (s) => window.__NOCTIS_HARNESS__.poseOnePedestrian(s),
      { build, u: 0, amp: AMP }
    );
    const rows = [];
    for (const view of wantViews) {
      const az = (VIEWS[view].azDeg * Math.PI) / 180;
      /**
       * The figure's own frame: `writeMatrices` composes yaw about Y with
       * local +Z on the heading, so the camera's bearing is the figure's yaw
       * plus the view's azimuth and the offset is that bearing at `dist`.
       */
      const bearing = pose.yaw + az;
      const cam = [
        pose.x + DIST * Math.sin(bearing),
        EYE,
        pose.z + DIST * Math.cos(bearing),
      ];
      await page.evaluate(
        (s) => window.__NOCTIS_HARNESS__.setShotAt(s.pos, s.target, s.fov),
        { pos: cam, target: [pose.x, AIM, pose.z], fov: FOV }
      );
      await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity(1800));

      const frames = [];
      for (let i = 0; i < PHASES; i++) {
        const u = i / PHASES;
        await page.evaluate(
          (s) => window.__NOCTIS_HARNESS__.poseOnePedestrian(s),
          { build, u, amp: AMP }
        );
        await page.evaluate(() => window.__NOCTIS_HARNESS__.settle(4));
        frames.push(decodePNG(await page.screenshot({ type: 'png' })));
      }
      const row = strip(frames);
      const file = path.join(OUT, `gait-${build}-${view}${TAG ? `-${TAG}` : ''}.png`);
      await writeFile(file, encodePNG(row));
      rows.push(row);
      console.log(
        `  ${path.basename(file).padEnd(34)} ${PHASES} phases  ${row.width}x${row.height}  ` +
          `${VIEWS[view].label}, bearing ${((bearing * 180) / Math.PI).toFixed(0)}°  ` +
          `figure at [${pose.x.toFixed(1)}, ${pose.z.toFixed(1)}] yaw ` +
          `${((pose.yaw * 180) / Math.PI).toFixed(0)}° scale ${pose.scale.toFixed(2)}`
      );
    }
    if (rows.length > 1) {
      const file = path.join(OUT, `gait-${build}${TAG ? `-${TAG}` : ''}.png`);
      await writeFile(file, encodePNG(stack(rows)));
      console.log(`  ${path.basename(file).padEnd(34)} ${rows.length} views stacked`);
    }
  }

  await page.evaluate(() => window.__NOCTIS_HARNESS__.releasePosedPedestrian());
} finally {
  await browser.close();
  if (server) server.child.kill('SIGKILL');
}
