#!/usr/bin/env node
/**
 * lookat.mjs — stand somewhere and look at something. Not a gate.
 *
 *   node tools/lookat.mjs                          every preset, at noon
 *   node tools/lookat.mjs --preset=viaduct-street
 *   node tools/lookat.mjs --pos=40,1.74,-30 --target=-20,18,10 --t=0.5
 *   node tools/lookat.mjs --t=0.78 --wet=1 --fov=60
 *
 * CONTRACT §10 step 4: "Look at the frames. The numbers are necessary and not
 * sufficient." Until session 5 the only way to look at anything was one of three
 * named shots, all of them at eye height in the middle of the origin block — so
 * a structure the gate camera sees at 26° of elevation had never been seen from
 * underneath, from the side, or from anywhere it could be judged as a structure.
 * That is how three white slabs stayed in the centre of every delivered frame
 * for a session.
 *
 * Writes PNGs to tools/shot-out/. Asserts nothing, and must not: a gate whose
 * camera the operator chooses is measuring the operator.
 *
 * Presets are derived from LANDMARKS in src/lib/citygen.js — the same data the
 * generator and the bake read — so a preset cannot drift from where the thing
 * actually is.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { POSES } from './lib/poses.mjs';
import { startServer, launchBrowser, openPage, readRendererString } from './lib/page.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = path.join(ROOT, 'tools', 'shot-out');

/**
 * SPLIT ON THE FIRST `=` ONLY — SESSION 37, AND IT WAS BROKEN FOR THIRTY-TWO
 * SESSIONS BEFORE ANYTHING NEEDED IT.
 *
 * `split('=')` destructured into `[k, v]` silently DROPS everything after the
 * second `=`: `--params=fill=0.90` arrived as `params` → `fill`, with the 0.90
 * gone. `loftprobe.mjs` carries this same note because the same line cost it a
 * refusal in session 10, and this file was written with the broken form and
 * never passed a value containing an `=` until the fill sweep did.
 *
 * WHAT IT COST HERE: seven aerial frames swept across seven fill laws, all
 * seven rendered the SHIPPED law, and the sweep looked like a finding — the
 * city does not change with the fill — because every frame was the same city.
 * It failed the right way only by luck: two of the seven differed anyway, which
 * is what sent somebody to the hashes. CONTRACT §9's failure mode with a string
 * instead of a length.
 */
const args = new Map(
  process.argv.slice(2).map((a) => {
    const s = a.replace(/^--/, '');
    const i = s.indexOf('=');
    return i < 0 ? [s, 'true'] : [s.slice(0, i), s.slice(i + 1)];
  })
);

const num = (s) => s.split(',').map(Number);

/**
 * THE PRESETS LIVE IN `tools/lib/poses.mjs` SINCE SESSION 70, UNCHANGED.
 *
 * They were moved out of this file, not rewritten: every derivation, every
 * comment and every number is the one that was here. What changed is that
 * `stepprobe.mjs` and `seamprobe.mjs` now import the same object instead of
 * re-deriving a pose beside it — CONTRACT §9.1, which is about two
 * descriptions of one quantity and does not stop being about it because the
 * quantity is a camera.
 */
const PRESETS = POSES;

const shots = [];
if (args.has('pos')) {
  shots.push({
    name: args.get('name') || 'custom',
    pos: num(args.get('pos')),
    target: num(args.get('target') || '0,10,0'),
    fov: Number(args.get('fov') || 55),
  });
} else if (args.has('preset')) {
  for (const name of args.get('preset').split(',')) {
    if (!PRESETS[name]) {
      console.error(`lookat: no preset '${name}'. Have: ${Object.keys(PRESETS).join(', ')}`);
      process.exit(2);
    }
    shots.push({ name, ...PRESETS[name] });
  }
} else {
  for (const [name, s] of Object.entries(PRESETS)) shots.push({ name, ...s });
}
if (args.has('fov')) for (const s of shots) s.fov = Number(args.get('fov'));

const times = (args.get('t') || '0.5').split(',').map(Number);
/**
 * `--wet` PINS the surface wetness. ABSENT, IT NO LONGER PINS AT ALL — session 33.
 *
 * IT USED TO READ `Number(args.get('wet') || 0)` AND THEN CALL `setWetness(0)`
 * UNCONDITIONALLY, and that one line is why session 32 could report that the
 * wet street was "already built, never looked at" and still not fix it by
 * moving the app's default. Every frame-producing path in this project pins its
 * own wetness — `lookcheck` pins 0 then `look-budget.json`'s 1.0, each
 * `camera.js` route carries its own `wet`, `filmshot.mjs` carries one per shot,
 * and this tool pinned 0 — so `main.js`'s default was read by NOTHING that
 * makes a frame anybody looks at. Changing it alone would have delivered
 * exactly zero frames.
 *
 * `null` means "do not pin": the page keeps whatever `main.js` configured, and
 * `--paused=1` (which this tool always sets) freezes `time.now`, so the drying
 * law never advances and the delivered value is the configured one exactly.
 * `--wet=0` still gives the dry arm, which is what an A/B needs.
 */
const wetArg = args.has('wet') ? Number(args.get('wet')) : null;
const tag = args.get('tag') || '';

/**
 * `--params=k=v;k=v` — ANY CONTRACT §6 PARAMETER, PASSED THROUGH TO THE PAGE.
 *
 * Session 37, and the reason is `?fill=`. Choosing a fill law BY LOOKING means
 * one aerial frame per arm at one pose, and until this existed the only way to
 * get one was to edit `citygen.js` between shots — which makes each frame a
 * frame nobody can retake, and makes the sweep a claim rather than a result.
 * Semicolon-separated, and the split is on the FIRST `=` only, for the reason
 * `loftprobe` records: `split('=')` destructured into [k, v] drops everything
 * after a second `=` silently.
 *
 * `seed` and `paused` are set below and win, because this tool's determinism
 * and its frozen clock are not arms.
 */
const passParams = new Map();
for (const pair of (args.get('params') || '').split(';')) {
  if (!pair || pair === 'true') continue;
  const i = pair.indexOf('=');
  if (i < 0) continue;
  passParams.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
}

await mkdir(OUT, { recursive: true });

let server = null;
let baseUrl = args.get('url');
if (!baseUrl) {
  server = await startServer(5201);
  baseUrl = server.url;
}
const browser = await launchBrowser();
const { page } = await openPage(browser, {
  viewport: { width: Number(args.get('w') || 1440), height: Number(args.get('h') || 810) },
  deviceScaleFactor: 1,
});

try {
  const url = new URL(baseUrl);
  for (const [k, v] of passParams) url.searchParams.set(k, v);
  url.searchParams.set('seed', args.get('seed') || '1337');
  url.searchParams.set('paused', '1');
  if (passParams.size) console.log(`  params: ${[...passParams].map(([k, v]) => `${k}=${v}`).join(' ')}`);
  await page.goto(url.toString(), { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!window.__NOCTIS_HARNESS__, null, { timeout: 60000 });
  await page.evaluate(() => window.__NOCTIS_HARNESS__.ready);
  await page.evaluate(() => window.__NOCTIS_HARNESS__.takeOver());
  console.log(`GPU: ${await readRendererString(page)}`);
  if (wetArg != null) await page.evaluate((w) => window.__NOCTIS_HARNESS__.setWetness(w), wetArg);

  for (const shot of shots) {
    await page.evaluate(
      (s) => window.__NOCTIS_HARNESS__.setShotAt(s.pos, s.target, s.fov),
      { pos: shot.pos, target: shot.target, fov: shot.fov }
    );
    // The residency ring follows the camera, so a teleport needs the world to
    // arrive before anything is worth looking at.
    let arrival = await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity(1800));
    /**
     * AND ONE CALL IS NOT ENOUGH AFTER A TELEPORT. Session 16.
     *
     * `waitForCity` returns when the bake queue is EMPTY — `queued === 0 &&
     * inFlight === 0 && !dripping && resident > 0`. The instant after
     * `setShotAt` every one of those is satisfied by the city the camera just
     * LEFT: nothing is queued because the ring has not asked yet, and chunks
     * are resident from the old position. So it returns immediately and the
     * shot is taken with the canyon field of somewhere else, which at a new
     * location means no field at all and every surface lit by the analytic
     * default — the exact failure `lookcheck` records in its own note about
     * pale soffits, arriving through a different door.
     *
     * MEASURED at the river, `--pos=64,1.74,-483`: the first call returns
     * `0/30 field slots ready` and the second returns a baked one. Bounded at
     * four passes rather than looped, and the pass count is printed, so a frame
     * that is still mid-stream says so in the line beside it instead of looking
     * like a lighting decision.
     */
    let waits = 1;
    while (waits < 4 && arrival.field && arrival.field.ready < arrival.field.slots) {
      arrival = await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity(1800));
      waits++;
    }
    for (const t of times) {
      await page.evaluate((tt) => window.__NOCTIS_HARNESS__.setTimeOfDay(tt), t);
      await page.evaluate(() => window.__NOCTIS_HARNESS__.settle(4));
      const info = await page.evaluate(() => window.__NOCTIS_HARNESS__.info());
      const file = path.join(
        OUT,
        // The suffix names WHAT WAS DELIVERED, not what was asked for, so a
        // default frame carries it too. That is the whole change: `-wet` used
        // to mean "somebody passed --wet" and now means "the road was wet".
        `${shot.name}${tag ? `-${tag}` : ''}-t${String(t).replace('.', '_')}${info.wetness > 0 ? '-wet' : ''}.png`
      );
      await writeFile(file, await page.screenshot({ type: 'png' }));
      console.log(
        `  ${path.basename(file).padEnd(38)} [${shot.pos.map((v) => v.toFixed(1)).join(',')}] → ` +
          `[${shot.target.map((v) => v.toFixed(1)).join(',')}]  fov ${shot.fov}  ` +
          `wet ${Number(info.wetness).toFixed(2)}${wetArg == null ? '' : ' (pinned)'}  ` +
          /**
           * AND THE TRIANGLE COUNT — session 65. `perfcheck`'s ceiling is
           * measured on four routes that all run inside the city, so a change
           * that only adds geometry PAST `CITY.extentEdgeM` costs exactly zero
           * there and is invisible to every gate (STATE 61 §7, carried since).
           * This is the only place a countryside frame's own cost is a number,
           * and a session that plants 6 093 trees out there should be able to
           * say what they cost in the frame that shows them.
           */
          `${info.drawCalls} draws  ${Number(info.triangles || 0).toLocaleString('en-US')} tris  ` +
          `${info.city ? `${info.city.resident} chunks` : ''}  ` +
          `${arrival.field ? `${arrival.field.ready}/${arrival.field.slots} field in ${waits} wait${waits === 1 ? '' : 's'}` : ''}`
      );
    }
  }
} finally {
  await browser.close();
  if (server) server.child.kill('SIGKILL');
}
