#!/usr/bin/env node
/**
 * hullprobe.mjs — NOT A GATE. It measures the INSTRUMENT, not the content.
 *
 *   node tools/hullprobe.mjs
 *   node tools/hullprobe.mjs --angles=0,20,39,60,80 --dist=25 --width=1.80
 *
 * THE QUESTION. `tools/lib/silhouette.mjs` builds a subject's mask as the UNION
 * OF THE PER-BOX CONVEX HULLS with no depth test between a subject's own parts.
 * A box of length `l` and width `w`, seen at `theta` from broadside, projects to
 * an image-horizontal span of `l*cos(theta) + w*sin(theta)` — which GROWS as the
 * subject turns away from broadside, while the span of the sampled long axis
 * SHRINKS as `L*(1-2*trim)*cos(theta)`. Past some angle a tall box's hull is
 * wider in the image than the whole trimmed station range, so every station's
 * segment is covered by the tall box's hull and `measureRoofProfile` reads the
 * tall box's roof at every one of them. The profile reads FLAT on geometry that
 * is not flat.
 *
 * WHY §7.3's EXISTING CONTROL CANNOT ASK THIS. `measureShapeControl` rasterises
 * an ORTHOGRAPHIC SIDE ELEVATION: axis-aligned rectangles painted straight into
 * a byte mask, vertical station segments, no camera, no width, no convex hull
 * and no union of overlapping hulls. It exercises the STATISTIC over a supplied
 * mask, which is what its own header claims and no more. It has never exercised
 * the mask-BUILDING path, and that is the path production uses. §7.3 says the
 * control goes through the same code path; the render path is part of the code
 * path.
 *
 * WHAT THIS RUNS. The §7.3 control shapes, built as REAL 3D BOXES, placed in
 * the live scene in front of the gate's own camera pose, projected by the real
 * `harness.silhouettes()`, hulled and unioned and measured by the real
 * `measureSilhouettes` from `tools/lib/silhouette.mjs`. Nothing here is a second
 * copy of anything: the only new code is the placement of the control body.
 *
 * `?traffic=0&streetlife=0` so the control is the only silhouette subject in the
 * frame and no real vehicle can occlude it — occlusion by a nearer subject is a
 * separate, already-documented limitation and this probe is not about it.
 *
 * THE THIN ARM IS THE ATTRIBUTION. The same three-box shape is run at the same
 * angles with a width of 0.02 m. A 0.02 m box has essentially no lateral hull
 * span, so if the thin arm holds its span where the full-width arm collapses,
 * the collapse IS the lateral extent of the hull and not the statistic, the
 * projection, the sampling grid or the angle.
 */

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { startServer, launchBrowser, openPage } from './lib/page.mjs';
import { decodePNG } from './lib/png.mjs';
import { measureSilhouettes, SHAPE_CONTROLS, WIDTH_CONTROLS } from './lib/silhouette.mjs';

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);

const BUDGET = JSON.parse(await readFile(new URL('./budget.json', import.meta.url), 'utf8'));
const S = BUDGET.silhouettes;
const FLOOR = S.kinds.vehicle.minRoofSpan;
const WFLOOR = S.kinds.vehicle.minWidthSpan;
const VIEWPORT = BUDGET.capture.viewport;
const ROUTE = S.routes[0];
const POSE = Number(args.get('pose') || 0.6);
const DIST = Number(args.get('dist') || 25);
const WIDE = Number(args.get('width') || 1.8);
const ANGLES = String(args.get('angles') || '0,10,20,30,39,45,55,70,80')
  .split(',')
  .map(Number);

/**
 * THE ARITHMETIC, PRINTED BEFORE THE MEASUREMENT SO THE MEASUREMENT CAN REFUTE
 * IT. CONTRACT §9 rule 2: a quantity derived one way and measured another is
 * printed both ways. Both figures are image-horizontal spans expressed in the
 * metres of vehicle-frame length that project to them, so they are directly
 * comparable and the ratio is dimensionless.
 */
function hullArithmetic(boxes, deg) {
  const th = (deg * Math.PI) / 180;
  const L = Math.max(...boxes.map((b) => Math.abs(b[0]) + b[1] / 2)) * 2;
  // The box whose TOP is highest: the one whose hull, if it spans the stations,
  // becomes the reading at every one of them.
  const tall = boxes.reduce((a, b) => (b[4] + b[3] / 2 > a[4] + a[3] / 2 ? b : a));
  const hullSpanM = tall[1] * Math.cos(th) + tall[2] * Math.sin(th);
  const stationSpanM = L * (1 - 2 * S.trim) * Math.cos(th);
  return {
    tallestBoxLenM: +tall[1].toFixed(3),
    tallestBoxWideM: +tall[2].toFixed(3),
    hullSpanM: +hullSpanM.toFixed(3),
    stationSpanM: +stationSpanM.toFixed(3),
    coversStations: hullSpanM >= stationSpanM,
    ratio: +(hullSpanM / stationSpanM).toFixed(3),
  };
}

/**
 * THE WIDTH SPAN THE BOXES IMPLY, COMPUTED FROM THE GEOMETRY AND NOT FROM ANY
 * PROJECTION. CONTRACT §9 rule 2: a quantity derived one way is printed beside
 * the same quantity derived another, and if they disagree you have found the bug.
 *
 * This is the ground truth `widthSpan` is trying to recover — the same 12 stations,
 * the same 3 sub-samples medianed, the same "boxes that span the station and
 * straddle the probe height" rule, but reading each box's own `wide` straight out
 * of the table instead of walking a projected probe. It exists to answer the one
 * question the projection cannot answer when it declines: what IS the width
 * variation of this body?
 *
 * IT IS A SECOND COPY OF THE SAMPLING AND THAT IS WHY IT LIVES IN A PROBE. §9.1
 * says a second copy drifts and the two stop agreeing while the number stays
 * plausible — which is exactly why a GATE may not have one. A probe whose whole
 * purpose is the comparison may, and this one prints both numbers on every row so
 * a drift shows up as a disagreement rather than as a silence.
 */
function widthSpanFromBoxes(boxes, S) {
  const N = S.stations;
  const K = S.subSamples;
  let a0 = Infinity; let a1 = -Infinity;
  let u0 = Infinity; let u1 = -Infinity;
  let l0 = Infinity; let l1 = -Infinity;
  for (const [along, len, wide, h, cy, lat = 0] of boxes) {
    a0 = Math.min(a0, along - len / 2); a1 = Math.max(a1, along + len / 2);
    u0 = Math.min(u0, cy - h / 2); u1 = Math.max(u1, cy + h / 2);
    l0 = Math.min(l0, lat - wide / 2); l1 = Math.max(l1, lat + wide / 2);
  }
  const lengthM = a1 - a0;
  const widthM = l1 - l0;
  const probeH = u0 + (u1 - u0) * S.latHeight;
  const aLo = a0 + lengthM * S.trim;
  const band = (a1 - lengthM * S.trim - aLo) / N;
  const med = (xs) => {
    const s = xs.slice().sort((x, y) => x - y);
    const h = s.length >> 1;
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
  };
  const per = [];
  for (let i = 0; i < N; i++) {
    const vals = [];
    for (let j = 0; j < K; j++) {
      const a = aLo + band * (i + (j + 0.5) / K);
      let lo = Infinity; let hi = -Infinity;
      for (const [along, len, wide, h, cy, lat = 0] of boxes) {
        if (a < along - len / 2 || a > along + len / 2) continue;
        if (probeH < cy - h / 2 || probeH > cy + h / 2) continue;
        lo = Math.min(lo, lat - wide / 2); hi = Math.max(hi, lat + wide / 2);
      }
      if (hi > lo) vals.push((hi - lo) / widthM);
    }
    if (vals.length) per.push(med(vals));
  }
  if (per.length < Math.ceil(S.minStationFraction * N)) {
    return { span: null, stations: per.length, widthM: +widthM.toFixed(3), probeH: +probeH.toFixed(3) };
  }
  const sorted = per.slice().sort((x, y) => x - y);
  const pc = (p) => {
    const r = p * (sorted.length - 1);
    const lo = Math.floor(r);
    const hi = Math.min(sorted.length - 1, lo + 1);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (r - lo);
  };
  return {
    span: +(pc(0.9) - pc(0.1)).toFixed(4),
    stations: per.length,
    widthM: +widthM.toFixed(3),
    probeH: +probeH.toFixed(3),
    wide: per.map((v) => +v.toFixed(4)),
  };
}

/** `steps` -> the general `[centreAlong, len, wide, height, centreHeight]` form. */
function stepsToBoxes(steps, wide) {
  const len = Math.max(...steps.map((s) => s[1]));
  return steps.map(([a0, a1, h]) => [(a0 + a1) / 2 - len / 2, a1 - a0, wide, h, h / 2]);
}

/**
 * PLACE A CONTROL BODY IN THE LIVE SCENE. Runs in the page.
 *
 * `steps` is §7.3's side elevation, `[alongStart, alongEnd, height]` in metres,
 * turned into real boxes of width `wide`. Placed on the camera's own forward
 * axis at `distanceM`, so the angle between the vehicle's long axis and the line
 * of sight IS `angleDeg` from broadside with no parallax correction to argue
 * about. `distanceM` and the drop below the eye are irrelevant to `roofSpan` by
 * construction — the reading is a fraction of the subject's OWN height along a
 * segment built from the subject's OWN frame — and they are here so the frame
 * can be looked at.
 *
 * The instance rows are `compose(position, yaw, scale)` with LOCAL +Z AS THE
 * HEADING, which is `traffic.js`'s convention and is the one the harness reads
 * its basis off. Getting that pair the wrong way round makes the control drive
 * sideways, and the printed `alongPx` is what would show it.
 */
function placeControl(cfg) {
  const { ctx, THREE } = window.__NOCTIS__;
  const old = ctx.scene.getObjectByName('__hullprobe__');
  if (old) {
    ctx.scene.remove(old);
    old.geometry.dispose();
    old.material.dispose();
  }
  if (!cfg) return null;

  const cam = ctx.camera;
  cam.updateMatrixWorld();
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
  fwd.y = 0;
  fwd.normalize();

  const origin = cam.position.clone().addScaledVector(fwd, cfg.distanceM);
  origin.y = cam.position.y - cfg.dropM;

  // theta from BROADSIDE: 0 is the long axis across the line of sight, 90 is
  // end-on. heading = line of sight rotated by (90 - theta) about Y.
  const phi = ((90 - cfg.angleDeg) * Math.PI) / 180;
  const heading = fwd.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), phi);
  const yaw = Math.atan2(heading.x, heading.z);

  /**
   * TWO WAYS IN, AND THE SECOND IS WHY THE PROBE IS WORTH MORE THAN THE FIRST.
   * `steps` is §7.3's side elevation — `[alongStart, alongEnd, height]`, every
   * box standing on the ground at a common width — and is what the existing
   * controls are written as. `boxes` is the general form,
   * `[centreAlong, len, wide, height, centreHeight]`, which is what a delivered
   * `BODY_TYPES` entry actually is: boxes at different widths, at different
   * heights, not all touching the ground.
   */
  const boxes = cfg.boxes
    ? cfg.boxes
    : (() => {
        const len = Math.max(...cfg.steps.map((s) => s[1]));
        return cfg.steps.map(([a0, a1, h]) => [(a0 + a1) / 2 - len / 2, a1 - a0, cfg.wide, h, h / 2]);
      })();
  const L = Math.max(...boxes.map((b) => Math.abs(b[0]) + b[1] / 2)) * 2;

  const geo = new THREE.BoxGeometry(1, 1, 1);
  /**
   * UNLIT, AND ON PURPOSE. `roofSpan` is read from the MASK — the union of the
   * projected hulls — and never from a pixel, so what the control is shaded
   * with cannot move the number, and the first version proved it: a lit
   * material at the route's own noon and the same material at the default dusk
   * returned 0.3187 / 0.3180 / 0.1723 / 0.0212 at 0 / 25 / 30 / 39 degrees, the
   * same four figures to four decimals. What the shading IS for is looking at
   * the frame, and a standard material with no local light in reach of it was
   * not distinguishable from the road. Flat red is.
   */
  const mat = new THREE.MeshBasicMaterial();
  /**
   * THE CONTROL IS NOT LEGIBLE IN THE DELIVERED FRAME AND THAT WAS NOT FIXED.
   * Written down rather than left as a surprise for the next reader.
   *
   * Three materials were tried — a `MeshStandardMaterial` at 0x9aa0a6, a
   * `MeshBasicMaterial` at 0xd81e00, and the radiance below — and in all three
   * the control adds its draw call (`info().drawCalls` 237 -> 238) and cannot
   * be picked out of the screenshot: a whole-frame scan for a red pixel finds
   * none. The likely cause is the scene pass writing into `post.js`'s two-
   * attachment `hdrRT` and the TAA resolve reading a motion vector this
   * material never writes; it was NOT chased to the bottom, because it cannot
   * touch the reading.
   *
   * IT CANNOT TOUCH THE READING, AND THAT IS THE POINT WORTH TAKING AWAY.
   * `measureRoofProfile` is handed `(sub, own, occluded, W, H, cfg)` and its
   * body never indexes `png.data` — `roofSpan` is a statistic about where
   * geometry PROJECTS, not about what the frame SHOWS. The four figures below
   * came back identical to four decimals across all three materials and across
   * two times of day: 0.3187 / 0.3180 / 0.1723 / 0.0212 at 0 / 25 / 30 / 39
   * degrees. A metric that returns the same number for a body the frame draws
   * and a body the frame does not is a metric with no pixel in it.
   */
  mat.color.setRGB(4.0e4, 0.4e4, 0.2e4);
  const mesh = new THREE.InstancedMesh(geo, mat, boxes.length);
  mesh.name = '__hullprobe__';
  mesh.frustumCulled = false;

  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const m = new THREE.Matrix4();
  /**
   * A SIXTH ELEMENT, LATERAL OFFSET, AND IT IS OPTIONAL SO THE OLD ARMS ARE
   * UNCHANGED. The §7.3 controls are all on the longitudinal mid-plane and take
   * the default 0. A DELIVERED body's wheels are not — they sit at plus and minus
   * the half-track — and putting them on the centreline would have shrunk the
   * subject's own measured width, which is the denominator of every §7.5 reading.
   * `right` is the vehicle's own lateral axis, the same convention traffic.js uses
   * fifty lines into its own placement: heading rotated -90 degrees about Y.
   */
  const right = new THREE.Vector3(-heading.z, 0, heading.x);
  for (let i = 0; i < boxes.length; i++) {
    const [along, len, wide, h, cy, lat = 0] = boxes[i];
    p.copy(origin).addScaledVector(heading, along).addScaledVector(right, lat);
    p.y = origin.y + cy;
    s.set(wide, h, len);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;

  /**
   * The same label `traffic.js` puts on its body mesh, written here for the
   * same reason: the only place that knows these rows are one subject is the
   * place that assembled them.
   */
  mesh.userData.noctisSilhouette = {
    kind: 'vehicle', group: boxes.length, subject: 'hullprobe:control', profile: true,
  };
  ctx.scene.add(mesh);

  return { yawDeg: +((yaw * 180) / Math.PI).toFixed(2), lengthM: L };
}

const out = new URL('./hull-out/', import.meta.url);
await mkdir(out, { recursive: true });

const server = await startServer(5194);
const browser = await launchBrowser();
const { page, consoleErrors, pageErrors } = await openPage(browser, {
  viewport: { width: VIEWPORT.width, height: VIEWPORT.height },
  deviceScaleFactor: VIEWPORT.dpr,
});

const url = new URL(server.url);
for (const [k, v] of Object.entries(BUDGET.capture.params)) url.searchParams.set(k, String(v));
url.searchParams.set('route', ROUTE);
url.searchParams.set('traffic', '0');
url.searchParams.set('streetlife', '0');

const results = [];
let failed = false;

/**
 * THE DELIVERED BODY TYPES, FETCHED ON A FIRST LOAD WITH TRAFFIC ON, BECAUSE THE
 * MEASURING LOAD HAS IT OFF.
 *
 * This probe runs `?traffic=0` so the control body is the only silhouette subject
 * in the frame and no real vehicle can occlude it. But `traffic=0` omits the
 * `register()` call (CONTRACT §6), so `ctx.get('traffic')` is `undefined` and the
 * table cannot be read on the load that measures. THE FIRST VERSION OF THIS DID
 * EXACTLY THAT AND SILENTLY DROPPED EVERY DELIVERED ARM — one printed line and
 * five missing rows, which is §7.1's quiet gate wearing a probe. So the table is
 * fetched on its own load, first, and the absence is FATAL rather than a warning.
 *
 * READ OFF THE LIVE MODULE AND NEVER TRANSCRIBED. §9.1, and it is session 6b's
 * frozen-label lesson from the other side: a copy of a table drifts the moment the
 * table moves, so the way to measure the fleet's own geometry at an arbitrary view
 * is to ask the module. `traffic.js` puts `BODY_TYPES` on `api._internal`; the
 * conversion below is that table's own documented row order — `[len, height,
 * width, centreHeight, albedo, roughness, centreAlong]` — into the general
 * `[centreAlong, len, wide, height, centreHeight]` this probe places.
 *
 * THE WHEELS ARE INCLUDED AS INDIVIDUAL BOXES rather than as one bounding slab,
 * because §7.5's width reading picks the boxes that STRADDLE its probe height and
 * a slab spanning the whole body would straddle every station. Their own
 * `[along, lateral, diameter, width]` becomes a box of that diameter standing on
 * the road, at that lateral offset.
 */
async function fetchDeliveredArms() {
  const u = new URL(url.toString());
  u.searchParams.set('traffic', '1');
  await page.goto(u.toString(), { waitUntil: 'load', timeout: 90_000 });
  await page.waitForFunction(() => window.__APEX_HARNESS__ && window.__NOCTIS__, null, { timeout: 60_000 });
  await page.evaluate(() => window.__APEX_HARNESS__.ready);
  return page.evaluate(() => {
    const t = window.__NOCTIS__.ctx.get('traffic');
    const BT = t && t._internal && t._internal.BODY_TYPES;
    if (!BT) return null;
    return BT.map((ty) => ({
      name: ty.name,
      boxes: [
        ...ty.boxes.map(([len, h, wide, cy, , , along]) => [along || 0, len, wide, h, cy]),
        ...ty.wheels.map(([along, lat, dia, w]) => [along, dia, w, dia, dia / 2, lat]),
      ],
    }));
  });
}

try {
  const deliveredArms = await fetchDeliveredArms();
  if (!deliveredArms || !deliveredArms.length) {
    throw new Error(
      'traffic._internal.BODY_TYPES is unreachable, so the delivered arms would be silently absent — ' +
      'which is the failure this probe exists to make loud rather than to commit'
    );
  }

  await page.goto(url.toString(), { waitUntil: 'load', timeout: 90_000 });
  await page.waitForFunction(() => window.__APEX_HARNESS__ && window.__NOCTIS__, null, { timeout: 60_000 });
  await page.evaluate(() => window.__APEX_HARNESS__.ready);

  const info = await page.evaluate(() => window.__APEX_HARNESS__.info());
  if (!info.internal || info.internal[0] !== VIEWPORT.width || info.internal[1] !== VIEWPORT.height) {
    // The same check perfcheck makes, for the same reason: a mask projected
    // into one pixel grid and read against another is CONTRACT §9's shape.
    throw new Error(
      `internal render resolution is ${info.internal ? info.internal.join('x') : 'unknown'} but the gate ` +
      `viewport is ${VIEWPORT.width}x${VIEWPORT.height}`
    );
  }

  /**
   * THE ROUTE'S OWN TIME OF DAY AND WETNESS, WHICH `poseRoute` DOES NOT SET.
   * `runRoute` does, and the gate always runs the route before it poses, so a
   * probe that only posed would be standing in the same place under a different
   * sun. It cannot move `roofSpan` — the mask is projected geometry and carries
   * no light — and that is exactly why it is set: an instrument test that
   * differed from the gate in ANY respect is an instrument test somebody can
   * dismiss without reading it. The `t=0.5` frames are also the only ones worth
   * looking at, and looking at the frame is how this project's last two
   * instrument defects were found.
   */
  await page.evaluate(async (name) => {
    const cam = window.__NOCTIS__.ctx.get('camera');
    const r = cam.route(name);
    await window.__APEX_HARNESS__.setTimeOfDay(r.t);
    window.__APEX_HARNESS__.setWetness(r.wet);
  }, ROUTE);

  await page.evaluate(
    ([r, u, f]) => window.__APEX_HARNESS__.poseRoute(r, u, f),
    [ROUTE, POSE, S.poseFrames]
  );

  /**
   * THE PRE-REBUILD WEDGE AND POD, FROZEN. Transcribed from `traffic.js` ->
   * BODY_TYPES as that table stood when this probe found the union defect —
   * one plateau with a glasshouse on it. BODY_TYPES has since been rebuilt
   * into five longitudinal segments and no longer matches these rows, and
   * that is deliberate: these are the real shapes the broken union misread
   * to 0.02 at three-quarter view, and re-transcribing them would delete the
   * historical failing case this probe exists to keep reproducible. They are
   * CONTROLS now, not a reading of the fleet — the delivered fleet is
   * measured by perfcheck, not here.
   *
   * `[centreAlong, len, wide, height, centreHeight]`, from that table's
   * `[len, height, width, centreHeight, albedo, roughness, centreAlong]`.
   *
   * THE LAST ROW OF EACH IS THE WHEEL ENVELOPE AND IT IS AN APPROXIMATION,
   * SAID PLAINLY: four ten-sided cylinders replaced by the slab that bounds
   * them. It is here because the wheels are what put the subject's own bottom
   * at the road — `heightM` is 1.42 m with them and 1.26 m without — and every
   * reading below is a fraction of that height. It cannot affect the roofline
   * itself, which is the TOPMOST mask pixel on a station segment, and a slab at
   * the road is the furthest thing in the subject from its top edge.
   *
   * These two arms answer the question the §7.3 controls cannot: how much of
   * the fleet's measured 0.021 is a flat body and how much is the instrument.
   */
  const WEDGE = [
    [0, 4.90, 1.95, 0.66, 0.77],
    [-0.15, 2.70, 1.80, 0.44, 1.20],
    [0, 4.30, 1.66, 0.30, 0.31],
    [0, 4.74, 1.99, 0.10, 0.47],
    [0, 3.72, 1.94, 0.62, 0.31],
  ];
  const POD = [
    [0, 3.40, 1.62, 1.02, 0.95],
    [-0.10, 2.55, 1.52, 0.46, 1.63],
    [0, 2.96, 1.36, 0.28, 0.30],
    [0, 3.28, 1.66, 0.09, 0.60],
    [0, 2.70, 1.60, 0.58, 0.29],
  ];

  const ARMS = [
    { id: 'threeBox', boxes: stepsToBoxes(SHAPE_CONTROLS.threeBox, WIDE), why: 'the §7.3 POSITIVE control, in 3D' },
    { id: 'threeBox-thin', boxes: stepsToBoxes(SHAPE_CONTROLS.threeBox, 0.02), why: 'the same shape with no lateral hull span' },
    { id: 'prism', boxes: stepsToBoxes(SHAPE_CONTROLS.prism, WIDE), why: 'the §7.3 NEGATIVE control, in 3D' },
    { id: 'wedge', boxes: WEDGE, why: 'the PRE-REBUILD wedge, frozen — the shape the union misread' },
    { id: 'pod', boxes: POD, why: 'the PRE-REBUILD pod, frozen — the shape that honestly read 0.0' },
    // §7.5's own two negative controls, placed here through the whole render path
    // as well as through `measureShapeControl`'s second projection.
    { id: 'w:segPrism', boxes: WIDTH_CONTROLS.segPrism, why: 'the §7.5 NEGATIVE control — 14 equal segments, constant width' },
    { id: 'w:taper', boxes: WIDTH_CONTROLS.taper, why: 'the §7.5 POSITIVE control — the same 14 segments, plan-tapered' },
    ...deliveredArms.map((a) => ({
      id: `live:${a.name}`,
      boxes: a.boxes,
      why: 'the DELIVERED body type, read off traffic._internal.BODY_TYPES in the page',
    })),
  ];

  console.log(
    `hullprobe: ${ROUTE} pose u=${POSE}, control at ${DIST} m, ` +
    `stations ${S.stations} x ${S.subSamples}, trim ${S.trim}, overshoot ${S.overshoot}, ` +
    `roofSpan floor ${FLOOR}; latOvershoot ${S.latOvershoot}, latHeight ${S.latHeight}, ` +
    `minLatSegPx ${S.minLatSegPx}, maxWidthBias ${S.maxWidthBias}, widthSpan floor ${WFLOOR}\n`
  );

  const ONLY = args.get('only');
  for (const arm of ARMS.filter((a) => !ONLY || a.id === ONLY)) {
    for (const angleDeg of ANGLES) {
      const placed = await page.evaluate(placeControl, {
        // 1.74 m below the eye is the road height `harness.updateTraffic()`
        // already uses under this camera, so the control stands where a vehicle
        // would. Irrelevant to `roofSpan`; it makes the frame worth looking at.
        boxes: arm.boxes, angleDeg, distanceM: DIST, dropM: 1.74,
      });
      await page.evaluate(() => window.__APEX_HARNESS__.step(2, 1 / 60));

      const shot = await page.screenshot({ type: 'png' });
      const silh = await page.evaluate(
        (o) => window.__APEX_HARNESS__.silhouettes(o),
        {
          stations: S.stations, subSamples: S.subSamples,
          trim: S.trim, overshoot: S.overshoot,
          latOvershoot: S.latOvershoot, latHeight: S.latHeight,
        }
      );
      const png = decodePNG(shot);
      const measured = measureSilhouettes([{ silh, png }], S, true);
      const sub = measured.perSubject && measured.perSubject[0];
      const prof = sub && sub.profile;
      const wid = sub && sub.widthAlong;
      const arith = hullArithmetic(arm.boxes, angleDeg);

      const row = {
        arm: arm.id,
        angleDeg,
        yawDeg: placed && placed.yawDeg,
        subjects: silh.subjects.length,
        measured: measured.measured,
        alongPx: prof ? prof.alongPx : null,
        stationsUsed: prof ? prof.stationsUsed : null,
        roofSpan: prof ? prof.roofSpan : null,
        roofTopFraction: prof ? prof.roofTopFraction : null,
        roofLevels: prof ? prof.roofLevels : null,
        roof: prof ? prof.roof : null,
        heightM: prof ? prof.heightM : null,
        lengthM: prof ? prof.lengthM : null,
        aabb: sub ? sub.aabb : null,
        // §7.5, alongside the roofline rather than in a second run: the two
        // metrics decline at opposite ends of this same angle sweep, and one
        // table is where that is visible.
        widthSpan: wid && wid.widthSpan != null ? wid.widthSpan : null,
        widthDeclined: wid && wid.declined ? wid.declined : null,
        widthBiasTotal: wid ? wid.biasTotal : null,
        widthTopFraction: wid && wid.widthTopFraction != null ? wid.widthTopFraction : null,
        widthLatPx: wid ? wid.latPxMin : null,
        wide: wid && wid.wide ? wid.wide : null,
        arith,
        // §9 rule 2, the same quantity from the geometry rather than from the
        // projection. Printed on every row beside the measured one.
        boxWidth: widthSpanFromBoxes(arm.boxes, S),
      };
      results.push(row);

      const verdict = row.roofSpan == null
        ? 'DROPPED'
        : row.roofSpan >= FLOOR ? 'over floor' : 'UNDER FLOOR';
      const wCell = row.widthSpan != null
        ? `${row.widthSpan.toFixed(4)}${row.widthSpan >= WFLOOR ? ' over ' : ' UNDER'}`
        : (row.widthDeclined ? `dec ${row.widthBiasTotal}`.padEnd(11) : '  n/a      ');
      console.log(
        `${arm.id.padEnd(14)} ${String(angleDeg).padStart(3)}°  ` +
        `roofSpan ${row.roofSpan == null ? '  n/a ' : row.roofSpan.toFixed(4)}  ` +
        `top-share ${row.roofTopFraction == null ? ' n/a' : row.roofTopFraction.toFixed(3)}  ` +
        `levels ${row.roofLevels == null ? '-' : row.roofLevels}  ` +
        `axis ${row.alongPx == null ? '   -' : String(row.alongPx).padStart(6)} px  ` +
        `widthSpan ${wCell}  ` +
        `fromBoxes ${row.boxWidth.span == null ? ' n/a  ' : row.boxWidth.span.toFixed(4)}  ` +
        `hull ${arith.hullSpanM.toFixed(2)} m vs stations ${arith.stationSpanM.toFixed(2)} m ` +
        `(${arith.ratio.toFixed(2)}x)  ${verdict}`
      );

      if (arm.id === 'threeBox' && Math.abs(angleDeg - 39) < 0.5) {
        await writeFile(new URL('./threeBox-39deg.png', out), shot);
      }
      if (arm.id === 'threeBox' && angleDeg === 0) {
        await writeFile(new URL('./threeBox-0deg.png', out), shot);
      }
    }
    console.log('');
  }

  await page.evaluate(placeControl, null);
} catch (e) {
  failed = true;
  console.error(`hullprobe: harness error — ${e && e.message ? e.message : e}`);
} finally {
  await writeFile(
    new URL('./hullprobe.json', out),
    JSON.stringify({ route: ROUTE, pose: POSE, distM: DIST, floor: FLOOR, results }, null, 2)
  );
  await browser.close();
  server.child.kill('SIGKILL');
}

if (consoleErrors.length) console.error(`page console errors: ${consoleErrors.slice(0, 5).join(' | ')}`);
if (pageErrors.length) console.error(`page errors: ${pageErrors.slice(0, 5).join(' | ')}`);

console.log(`hullprobe: wrote ${new URL('./hullprobe.json', out).pathname}`);
process.exit(failed ? 2 : 0);
