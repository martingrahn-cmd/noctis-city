#!/usr/bin/env node
/**
 * destshot.mjs — SHOOT THE SHIPPED DESTINATIONS. NOT A GATE, and it must not
 * become one. SESSION 80, items 1f and 1g.
 *
 *   node tools/destshot.mjs                            every destination, at its own t
 *   node tools/destshot.mjs --keys=harbour-quay --t=0  one of them, forced to midnight
 *   node tools/destshot.mjs --group=the world --t=0 --opposed
 *
 * ════════════════════════════════════════════════════════════════════════════
 * WHY IT EXISTS, AND WHY IT DOES NOT REBUILD THE POSE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Session 79 shipped seventeen named destinations and shot every one of them
 * before it committed — by hand, one `lookat.mjs --pos --target` at a time,
 * with the pose retyped from the source. Three of them carry `t = 0.78`
 * because the midnight arm was judged black, and item 1g of session 80 is
 * *"the verdict is session 79's own destinations, reshot at midnight"*. A
 * verdict that cannot be re-run in one command is a verdict nobody re-runs.
 *
 * IT READS `ui.destinationList()` AND DOES NOT RE-DERIVE IT. `ui.js`'s own
 * comment beside that method says why, and it is CONTRACT §9.1: *"a
 * verification that rebuilt the pose beside the thing it verifies is §9.1's
 * own subject with a camera"*. So the pose here is the object the map button
 * calls `goTo` with, reached through `harness.destinations()`, and the module
 * is registered with `?ui=1` — which follows `?player=1` by default and can be
 * set alone (`main.js` → `uiOn`).
 *
 * THE FOV IS 75 AND THAT IS NOT A CHOICE. A destination lands the PLAYER, so
 * the frame the operator gets is the player camera's, and `main.js` declares
 * 75°. `lookat.mjs` defaults to 55 because its presets are authored for a
 * fixed shot. Shooting a destination at 55 would be a frame nobody can reach
 * from the map.
 *
 * ── TWO OPPOSED BEARINGS — LOOK.md §7 AND SESSION 75's 82 LIGHTS ──
 *
 * `materials.sign` is `THREE.FrontSide` and a PlaneGeometry's front is local
 * +Z, so a whole population can draw perfectly and show its backs to the only
 * camera the geometry made anybody point. Session 75 lost a session to it.
 * `--opposed` mirrors the eye through the subject — `E' = 2L − E`, same range,
 * same eye altitude — and looks back at the same point. It can land over water
 * or inside a stack; that is a camera and not a spawn, and the line beside the
 * frame says what it cost.
 *
 * ASSERTS NOTHING. `lookcheck`, `citycheck` and `perfcheck` own the verdicts.
 * This prints, and the numbers are the ones a night frame is argued with:
 * the lamp-pool occupancy that says how many fixtures got a slot, and the
 * green-channel distribution that says whether anything arrived.
 *
 * `decodePNG` RETURNS THREE BYTES PER PIXEL. Written down because STATE 52
 * §2.2 is a whole plausible and entirely wrong table produced by assuming four.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { decodePNG } from './lib/png.mjs';
import { startServer, launchBrowser, openPage, readRendererString } from './lib/page.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = path.join(ROOT, 'tools', 'shot-out');

/** Split on the FIRST `=` only — `lookat.mjs` records what the other form cost. */
const args = new Map(
  process.argv.slice(2).map((a) => {
    const s = a.replace(/^--/, '');
    const i = s.indexOf('=');
    return i < 0 ? [s, 'true'] : [s.slice(0, i), s.slice(i + 1)];
  })
);

const W = Number(args.get('w') || 1440);
const H = Number(args.get('h') || 810);
const FOV = Number(args.get('fov') || 75);
const EYE = 1.74;
const TAG = args.get('tag') || '';
const OPPOSED = args.has('opposed');
/** `--t` FORCES a time on every destination; absent, each keeps its own. */
const T_FORCED = args.has('t') ? Number(args.get('t')) : null;
const WET = args.has('wet') ? Number(args.get('wet')) : null;

await mkdir(OUT, { recursive: true });

let server = null;
let baseUrl = args.get('url');
if (!baseUrl) {
  server = await startServer(5211);
  baseUrl = server.url;
}
const browser = await launchBrowser();
const { page } = await openPage(browser, { viewport: { width: W, height: H }, deviceScaleFactor: 1 });

const rows = [];

try {
  const url = new URL(baseUrl);
  url.searchParams.set('seed', args.get('seed') || '1337');
  url.searchParams.set('paused', '1');
  /** The module that owns the list. `?ui=1` alone, no player: nothing here walks. */
  url.searchParams.set('ui', '1');
  await page.goto(url.toString(), { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!window.__NOCTIS_HARNESS__, null, { timeout: 60000 });
  await page.evaluate(() => window.__NOCTIS_HARNESS__.ready);
  await page.evaluate(() => window.__NOCTIS_HARNESS__.takeOver());
  console.log(`GPU: ${await readRendererString(page)}`);
  if (WET != null) await page.evaluate((w) => window.__NOCTIS_HARNESS__.setWetness(w), WET);

  /**
   * THE PANEL IS THE PRICE OF THE LIST, AND IT IS PAID HERE RATHER THAN IN THE
   * MODULE. `?ui=1` is what registers the module that owns `destinationList`,
   * and the same registration puts a DOM panel in the top-right corner —
   * which lands in every screenshot and, on the first arm of this tool,
   * covered a quarter of the harbour's sky with four rows of buttons.
   *
   * Hidden from the TOOL and not by a new module flag: a `?ui=1&panel=0`
   * would be a second switch on a module that already has one, and CONTRACT
   * §6's parameter list is not the place to record what a screenshot wants.
   * `#noctis-ui` and `#noctis-map` are `ui.js`'s own two ids.
   */
  await page.evaluate(() => {
    for (const id of ['noctis-ui', 'noctis-map']) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    }
  });

  const list = await page.evaluate(() => window.__NOCTIS_HARNESS__.destinations());
  if (!list) {
    console.error('destshot: harness.destinations() returned null — is the ui module registered?');
    process.exit(2);
  }

  let want = list;
  if (args.has('keys')) {
    const keys = new Set(args.get('keys').split(','));
    want = list.filter((d) => keys.has(d.key));
    const missing = [...keys].filter((k) => !list.some((d) => d.key === k));
    if (missing.length) {
      console.error(`destshot: no destination '${missing.join("', '")}'. Have: ${list.map((d) => d.key).join(', ')}`);
      process.exit(2);
    }
  } else if (args.has('group')) {
    want = list.filter((d) => d.group === args.get('group'));
  }

  console.log(`  ${want.length} destination${want.length === 1 ? '' : 's'} of ${list.length}` +
    `${T_FORCED == null ? ', each at its own t' : `, all forced to t ${T_FORCED}`}` +
    `${OPPOSED ? ', from two opposed bearings' : ''}   fov ${FOV}`);
  console.log('');

  for (const d of want) {
    const eyeY = d.feetY + EYE;
    const bearings = [{ suffix: '', pos: [d.eye[0], eyeY, d.eye[2]], target: d.look }];
    if (OPPOSED) {
      /**
       * MIRRORED THROUGH THE SUBJECT. The same range and the same eye altitude,
       * looking back at the same point — so whatever the first bearing saw the
       * front of, this one sees the back of.
       */
      bearings.push({
        suffix: '-opp',
        pos: [2 * d.look[0] - d.eye[0], eyeY, 2 * d.look[2] - d.eye[2]],
        target: [d.eye[0], eyeY, d.eye[2]],
      });
    }
    const t = T_FORCED == null ? (d.t == null ? 0.5 : d.t) : T_FORCED;

    for (const b of bearings) {
      await page.evaluate((s) => window.__NOCTIS_HARNESS__.setShotAt(s.pos, s.target, s.fov),
        { pos: b.pos, target: b.target, fov: FOV });
      /** The residency ring follows the camera; `lookat.mjs` records why one wait is not enough. */
      let arrival = await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity(1800));
      let waits = 1;
      while (waits < 4 && arrival.field && arrival.field.ready < arrival.field.slots) {
        arrival = await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity(1800));
        waits++;
      }
      await page.evaluate((tt) => window.__NOCTIS_HARNESS__.setTimeOfDay(tt), t);
      await page.evaluate(() => window.__NOCTIS_HARNESS__.settle(6));

      const info = await page.evaluate(() => window.__NOCTIS_HARNESS__.info());
      const shot = await page.screenshot({ type: 'png' });
      const file = path.join(OUT, `dest-${d.key}${b.suffix}${TAG ? `-${TAG}` : ''}-t${String(t).replace('.', '_')}.png`);
      await writeFile(file, shot);

      /**
       * THE GREEN CHANNEL OVER THE WHOLE FRAME, SKY INCLUDED — and that is said
       * rather than corrected. `radianceprobe` excludes sky by depth because it
       * is reasoning about surfaces; this is reasoning about the PICTURE, and a
       * night sky is part of what the operator is looking at. A frame whose
       * median rises because the sky brightened is a frame that says so in the
       * time of day beside it.
       */
      const png = decodePNG(shot);
      const g = new Uint8Array(png.width * png.height);
      for (let i = 0; i < g.length; i++) g[i] = png.data[i * png.channels + 1];
      const sorted = Uint8Array.prototype.slice.call(g).sort();
      const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
      let under16 = 0;
      for (let i = 0; i < g.length; i++) if (g[i] < 16) under16++;
      const city = info.city || {};
      const row = {
        key: d.key + b.suffix,
        label: d.label,
        t,
        lampsActive: city.lampsActive ?? null,
        lampCandidates: city.lampCandidates ?? null,
        signsActive: city.signsActive ?? null,
        signCandidates: city.signCandidates ?? null,
        draws: info.drawCalls,
        tris: info.triangles || 0,
        p10: q(0.1), median: q(0.5), p90: q(0.9),
        under16: (100 * under16) / g.length,
        file: path.basename(file),
      };
      rows.push(row);
      console.log(
        `  ${row.key.padEnd(26)} t ${String(t).padEnd(5)} ` +
        `[${b.pos.map((v) => v.toFixed(0)).join(',')}] -> [${b.target.map((v) => v.toFixed(0)).join(',')}]  ` +
        `lamps ${String(row.lampsActive).padStart(3)}/${String(row.lampCandidates).padEnd(3)} ` +
        `signs ${String(row.signsActive).padStart(2)}/${String(row.signCandidates).padEnd(3)} ` +
        `${String(row.draws).padStart(4)} draws ${String(row.tris).padStart(9)} tris  ` +
        `green p10 ${String(row.p10).padStart(3)} median ${String(row.median).padStart(3)} p90 ${String(row.p90).padStart(3)}  ` +
        `under16 ${row.under16.toFixed(1).padStart(5)}%  ${waits} wait${waits === 1 ? '' : 's'}`
      );
    }
  }
} finally {
  await browser.close();
  if (server) server.child.kill('SIGKILL');
}

console.log('');
console.log(`  ${rows.length} frame${rows.length === 1 ? '' : 's'} in tools/shot-out/`);
