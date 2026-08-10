/**
 * profileprobe.mjs — NOT A GATE.
 *
 * The §7.3 roofline measurement with its working shown: the per-vehicle station
 * heights printed as numbers, and the same stations drawn over the delivered
 * frame so a person can see whether the instrument is reading the top edge of
 * the silhouette or reading something else.
 *
 * WHY THIS EXISTS RATHER THAN A `--verbose` ON THE GATE. `perfcheck` reports the
 * pooled median and the pass fraction, which is the verdict; when the verdict is
 * a surprise the question is never "what is the median" but "which pixels did it
 * read". Session 5's ground-contact assertion was corrected — a wheel's bounding
 * box is not a wheel's silhouette, and the bottom rows of the box mask were 69%
 * road — by cropping a failing subject out of the frame and looking at it, and
 * nothing in the project made that easy. This does.
 *
 * It asserts NOTHING and it must not. It poses the route through
 * `harness.poseRoute`, which is the same placement the gate uses, but everything
 * it prints is for a reader.
 *
 *   node tools/profileprobe.mjs                       # highway_speed, all three poses
 *   node tools/profileprobe.mjs --pose=0.85 --top=6   # one pose, six worst subjects
 */

import { readFile } from 'node:fs/promises';
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import path from 'node:path';
import { chromium } from 'playwright';
import { startServer, ROOT } from './lib/page.mjs';
import { decodePNG } from './lib/png.mjs';
import { measureSilhouettes } from './lib/silhouette.mjs';

const BUDGET = JSON.parse(await readFile(new URL('./budget.json', import.meta.url), 'utf8'));
const S = BUDGET.silhouettes;

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v === undefined ? '1' : v];
  })
);

const ROUTE = args.get('route') || S.routes[0];
const POSES = args.has('pose') ? [Number(args.get('pose'))] : S.poses;
const TOP = Number(args.get('top') || 8);
const OUT = path.join(ROOT, 'tools', 'profile-out');

// --- a minimal PNG encoder, for the overlay only ---------------------------
// Dependency-free for the same reason png.mjs's decoder is. Filter 0 on every
// row: this writes one debug image, not a pipeline.
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return (buf) => {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgb) {
  const raw = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- the overlay -----------------------------------------------------------

function cropWithOverlay(png, sub, m, pad = 24) {
  const [ax0, ay0, ax1, ay1] = m.aabb;
  const x0 = Math.max(0, ax0 - pad);
  const y0 = Math.max(0, ay0 - pad);
  const x1 = Math.min(png.width - 1, ax1 + pad);
  const y1 = Math.min(png.height - 1, ay1 + pad);
  const W = x1 - x0 + 1;
  const H = y1 - y0 + 1;
  const out = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = ((y + y0) * png.width + (x + x0)) * png.channels;
      const q = (y * W + x) * 3;
      out[q] = png.data[p];
      out[q + 1] = png.data[p + 1];
      out[q + 2] = png.data[p + 2];
    }
  }
  const put = (x, y, r, g, b) => {
    const px = Math.round(x) - x0;
    const py = Math.round(y) - y0;
    if (px < 0 || py < 0 || px >= W || py >= H) return;
    const q = (py * W + px) * 3;
    out[q] = r; out[q + 1] = g; out[q + 2] = b;
  };

  const P = sub.profile;
  const K = P.subSamples;
  for (let i = 0; i < P.stations; i++) {
    const roof = m.profile ? m.profile.roof[i] : null;
    for (let j = 0; j < K; j++) {
      const [sx0, sy0, sx1, sy1] = P.segments[i * K + j];
      // The station segment in dim grey, so the frame stays readable under it.
      const steps = Math.ceil(Math.hypot(sx1 - sx0, sy1 - sy0));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        put(sx0 + (sx1 - sx0) * t, sy0 + (sy1 - sy0) * t, 90, 90, 110);
      }
    }
    if (roof == null) continue;
    // The reading: a magenta cross where the silhouette's top edge was found on
    // the middle sub-station. Red when it sits at the segment's own top, which
    // is the one failure mode that would make every station read alike.
    const [sx0, sy0, sx1, sy1] = P.segments[i * K + (K >> 1)];
    const t = Math.min(1, roof / P.overshoot);
    const cx = sx0 + (sx1 - sx0) * t;
    const cy = sy0 + (sy1 - sy0) * t;
    const clipped = roof >= P.overshoot - 1e-3;
    for (let d = -4; d <= 4; d++) {
      put(cx + d, cy, clipped ? 255 : 255, clipped ? 40 : 0, clipped ? 40 : 255);
      put(cx, cy + d, clipped ? 255 : 255, clipped ? 40 : 0, clipped ? 40 : 255);
    }
  }
  return { buf: encodePNG(W, H, out), W, H };
}

// --- run -------------------------------------------------------------------

let server;
let browser;
try {
  server = await startServer(5181);
  browser = await chromium.launch({
    channel: 'chromium',
    headless: true,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync'],
  });
} catch (e) {
  if (server) server.child.kill('SIGKILL');
  console.error('profileprobe: could not start —', e.message);
  process.exit(2);
}

mkdirSync(OUT, { recursive: true });
const page = await browser.newPage({ viewport: { ...BUDGET.capture.viewport } });

try {
  const url = new URL(server.url);
  for (const [k, v] of Object.entries(BUDGET.capture.params)) url.searchParams.set(k, String(v));
  url.searchParams.set('route', ROUTE);
  await page.goto(url.toString(), { waitUntil: 'load', timeout: 90_000 });
  await page.waitForFunction(() => window.__APEX_HARNESS__, null, { timeout: 60_000 });
  await page.evaluate(() => window.__APEX_HARNESS__.ready);

  const samples = [];
  for (const u of POSES) {
    await page.evaluate(
      ([r, uu, f]) => window.__APEX_HARNESS__.poseRoute(r, uu, f),
      [ROUTE, u, S.poseFrames]
    );
    const shot = await page.screenshot({ type: 'png' });
    const silh = await page.evaluate(
      (o) => window.__APEX_HARNESS__.silhouettes(o),
      { stations: S.stations, subSamples: S.subSamples, trim: S.trim, overshoot: S.overshoot }
    );
    samples.push({ u, silh, png: decodePNG(Buffer.from(shot)) });
  }

  const measured = measureSilhouettes(
    samples.map((s) => ({ silh: s.silh, png: s.png })),
    S,
    true
  );

  const v = measured.kinds.vehicle;
  console.log(`\nroute ${ROUTE}, poses ${POSES.join(' / ')}, ${S.stations} stations x ${S.subSamples} sub-samples`);
  console.log(
    `vehicles measured ${v.n}, of which roofline-measurable ${v.nProfile} ` +
    `(long axis >= ${S.minStationPx * S.stations} px)`
  );
  console.log(
    `roofSpan  median ${v.roofSpan.median}  min ${v.roofSpan.min}  ` +
    `pass ${v.roofSpanPassFraction} against floor ${S.kinds.vehicle.minRoofSpan}   ` +
    `levels ${v.roofLevels}   top share ${v.roofTopFraction}\n`
  );

  const withProfile = measured.perSubject
    .filter((m) => m.kind === 'vehicle' && m.profile)
    .sort((a, b) => a.profile.roofSpan - b.profile.roofSpan);

  console.log('the station heights, as fractions of each subject\'s own height:');
  for (const m of withProfile) {
    const P = m.profile;
    console.log(
      `  ${String(P.lengthM).padStart(5)}m x ${String(P.heightM).padStart(5)}m  at ${String(m.near).padStart(5)}m  ` +
      `axis ${String(P.alongPx).padStart(6)}px  span ${P.roofSpan.toFixed(4)}  lvl ${P.roofLevels}  ` +
      `[${P.roof.map((r) => (r == null ? '  —  ' : r.toFixed(3))).join(' ')}]`
    );
  }

  // The N worst, cropped out of the frame with their stations drawn on. The
  // clipping check is the reason this exists: a station that reads the very top
  // of its own segment is a station that ran out of segment, and a subject all
  // of whose stations do that would report a span of zero for a reason that has
  // nothing to do with its shape.
  let clipped = 0;
  let written = 0;
  for (const m of withProfile.slice(0, TOP)) {
    for (const s of samples) {
      const sub = s.silh.subjects.find(
        (x) => x.profile && Math.abs(x.near - m.near) < 1e-6 && x.kind === 'vehicle'
      );
      if (!sub) continue;
      const { buf } = cropWithOverlay(s.png, sub, m);
      const name = `veh-${m.near.toFixed(1)}m-span${m.profile.roofSpan.toFixed(3)}.png`;
      writeFileSync(path.join(OUT, name), buf);
      written++;
      break;
    }
    clipped += m.profile.roof.filter((r) => r != null && r >= S.overshoot - 1e-3).length;
  }
  const stationsSeen = withProfile.slice(0, TOP).reduce((a, m) => a + m.profile.stationsUsed, 0);
  console.log(
    `\n${written} crops written to tools/profile-out/. Of the ${stationsSeen} stations in them, ` +
    `${clipped} read the very top of their own segment (overshoot ${S.overshoot}) — a station that ` +
    `does is a station that ran out of segment, and a subject all of whose stations do would report ` +
    `a flat roofline for a reason that is not its shape.`
  );
} finally {
  await browser.close();
  server.child.kill('SIGKILL');
}
