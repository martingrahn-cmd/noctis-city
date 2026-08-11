#!/usr/bin/env node
/**
 * airprobe.mjs — where the aircraft are, and what the module says about itself.
 * NOT A GATE, and it must not be: it puts the camera where the answer is, which
 * is CONTRACT §7's rule about `lookat.mjs` one file over.
 *
 * It exists because the first sky frame of session 20 came back empty and there
 * were three candidate reasons — the module quarantined, the fleet seeded
 * somewhere else, or the emitters sub-pixel — and looking at a picture
 * distinguishes none of them. Printing the fleet's own positions beside the
 * camera's distinguishes all three in one line each.
 *
 *   node tools/airprobe.mjs
 *   node tools/airprobe.mjs --shots      also writes a frame aimed at each one
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { startServer, launchBrowser, openPage, readRendererString } from './lib/page.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = path.join(ROOT, 'tools', 'shot-out');
const args = new Map(process.argv.slice(2).map((a) => {
  const [k, v = 'true'] = a.replace(/^--/, '').split('=');
  return [k, v];
}));

await mkdir(OUT, { recursive: true });
const server = await startServer(5233);
const browser = await launchBrowser();
const { page } = await openPage(browser, {
  viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1,
});

try {
  const url = new URL(server.url);
  url.searchParams.set('seed', '1337');
  url.searchParams.set('paused', args.get('paused') || '1');
  url.searchParams.set('t', args.get('t') || '0');
  await page.goto(url.toString(), { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!window.__NOCTIS_HARNESS__, null, { timeout: 60000 });
  await page.evaluate(() => window.__NOCTIS_HARNESS__.ready);
  await page.evaluate(() => window.__NOCTIS_HARNESS__.takeOver());
  console.log(`GPU: ${await readRendererString(page)}`);

  const state = await page.evaluate(() => {
    const h = window.__NOCTIS_HARNESS__;
    const ctx = window.__NOCTIS__ ? window.__NOCTIS__.ctx : null;
    const air = ctx ? ctx.get('aircraft') : null;
    return {
      live: h.live(),
      faults: h.faults(),
      camera: h.info().cameraPos,
      stats: air ? air.stats() : null,
      fleet: air ? air.fleetState() : null,
      logs: (ctx && ctx.logLines ? ctx.logLines : []).filter((l) => /aircraft|roof-sign/.test(l)),
    };
  });

  console.log(`faults ${state.faults.length}`);
  for (const f of state.faults) console.log(`  ✗ ${f.name}/${f.phase}: ${f.message}`);
  console.log(`aircraft module ${state.live.includes('aircraft') ? 'LIVE' : 'ABSENT'}`);
  for (const l of state.logs) console.log(`  ${l}`);
  if (state.stats) {
    console.log(
      `  count ${state.stats.count}  suppressed ${state.stats.suppressedByThreshold}  ` +
      `bodyCutoff ${state.stats.bodyCutoffM} m  searchlight ${state.stats.searchlightOn ? 'on' : 'off'}`
    );
  }
  const cam = state.camera;
  for (const a of state.fleet || []) {
    const d = Math.hypot(a.x - cam[0], a.y - cam[1], a.z - cam[2]);
    const el = (Math.atan2(a.y - cam[1], Math.hypot(a.x - cam[0], a.z - cam[2])) * 180) / Math.PI;
    console.log(
      `  ${a.role.padEnd(8)} ${String(a.x).padStart(8)} ${String(a.y).padStart(7)} ` +
      `${String(a.z).padStart(8)}   ${d.toFixed(0).padStart(5)} m   elevation ${el.toFixed(1).padStart(5)}°`
    );
  }

  /**
   * THE SEARCHLIGHT'S OWN FRAME. The pool is the point of the whole light, and
   * a shot aimed AT the helicopter shows a helicopter and no pool — the beam is
   * pointing away from the camera by construction. So this stands beside the
   * beam and looks along it.
   */
  if (state.stats && state.stats.searchlightOn) {
    const tgt = state.stats.searchTarget;
    const heli = (state.fleet || []).find((a) => a.role === 'orbiter');
    if (tgt && heli) {
      const bx = tgt[0] - heli.x;
      const bz = tgt[2] - heli.z;
      const bl = Math.hypot(bx, bz) || 1;
      /**
       * ABOVE AND BEHIND THE POOL, LOOKING DOWN AT IT. The first version stood
       * at 40 m and 120 m back "looking along the beam" and returned an all-
       * black frame, because at 40 m in a city of 30 m buildings the eye is
       * inside the next block. The pool is on the GROUND; the honest place to
       * photograph it from is above.
       */
      const pos = [tgt[0] - (bx / bl) * 150, 110, tgt[2] - (bz / bl) * 150];
      await page.evaluate((s2) => window.__NOCTIS_HARNESS__.setShotAt(s2.pos, s2.target, 55), {
        pos, target: [tgt[0], 0, tgt[2]],
      });
      await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity(1800));
      await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity(1800));
      await page.evaluate(() => window.__NOCTIS_HARNESS__.settle(4));
      const f = path.join(OUT, 's20-air-searchlight.png');
      await writeFile(f, await page.screenshot({ type: 'png' }));
      console.log(
        `  searchlight ${state.stats.searchTargetM} m slant, pool at ` +
        `${tgt[0].toFixed(0)}, ${tgt[2].toFixed(0)} — wrote ${path.basename(f)}`
      );
    }
  }

  if (args.has('shots')) {
    for (let i = 0; i < (state.fleet || []).length; i++) {
      const a = state.fleet[i];
      await page.evaluate((s) => window.__NOCTIS_HARNESS__.setShotAt(s.pos, s.target, 40), {
        pos: [cam[0], Math.max(40, cam[1]), cam[2]], target: [a.x, a.y, a.z],
      });
      await page.evaluate(() => window.__NOCTIS_HARNESS__.settle(4));
      const f = path.join(OUT, `s20-air-${i}-${a.role}.png`);
      await writeFile(f, await page.screenshot({ type: 'png' }));
      console.log(`  wrote ${path.basename(f)}`);
    }
  }
} finally {
  await browser.close();
  server.child.kill('SIGKILL');
}
