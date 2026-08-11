#!/usr/bin/env node
/**
 * faultcheck.mjs — does quarantine actually work?
 *
 *   node tools/faultcheck.mjs
 *
 * Exit 0 = quarantine holds, 1 = it does not, 2 = the check could not run.
 *
 * CONTRACT §2.1 is the rule the whole module system exists to provide: a module
 * that throws is removed and the frame keeps rendering. Session 1 verified it
 * by hand — a throw pasted into block.update, a throw pasted into post.render,
 * both watched once — and then took the throws back out. Hand verification does
 * not survive the session that removes it.
 *
 * So this drives `?fault=<module>:<phase>` (src/main.js) and asserts four
 * things about each injection, which together are what the contract promises:
 *
 *   1. exactly one module is quarantined — the one that threw, in the phase it
 *      threw in. Not zero, which would mean the throw was swallowed somewhere
 *      it should not have been, and not two, which would mean the failure
 *      spread past its dependents.
 *   2. exactly one error is logged. §2.1 says once, with a stack. A module that
 *      throws every frame must not also log every frame — 4000 identical lines
 *      destroy the console as evidence.
 *   3. every module that does not depend on the faulted one is still live.
 *      Quarantine is meant to be surgical.
 *   4. the frame still renders: real pixels, more than one value in them.
 *
 * Case 4 (post.render) is the one that exercises the core's fallback path,
 * where there is no renderer left and it draws the untonemapped scene instead.
 * An untonemapped frame is a bug you can see, which is the entire idea.
 */

import { decodePNG } from './lib/png.mjs';
import { startServer, launchBrowser, openPage, readRendererString, rendererIsSoftware } from './lib/page.mjs';

/** Its own port, so a lookcheck left running cannot make this one flaky. */
const PORT = 5198;

/**
 * Each case names every module expected to go down and the phase it goes down
 * in, in order. Spelling out the whole set rather than a count is what makes
 * the two interesting cases distinguishable:
 *
 *   - `block:init` must take `canyon` with it, because canyon declares block in
 *     `needs` and CONTRACT §2 says a module whose dependency is unavailable is
 *     quarantined *before* init runs rather than partially initialised;
 *   - `block:update` must not, because by then canyon has already initialised
 *     and `needs` is an init-time contract, not a per-frame one. A street with
 *     no buildings still has a canyon field baked from the buildings that were
 *     there — stale, and visibly so, which is the honest outcome.
 *
 * A gate that only counted faults would call both of those "1 or 2" and never
 * notice if they swapped.
 */
const CASES = [
  { fault: '', label: 'control — no injection', down: [] },
  /**
   * SESSION 4 extended these. `city` declares `canyon` and `block` in `needs`,
   * so it goes down with either of them — and the cases were updated by adding
   * it to the expected sets, not by loosening them. The gate caught its own
   * staleness on the first run after the module was registered, which is what a
   * whole-set expectation is for: a gate that counted faults would have called
   * "1 or 2" correct and never noticed a third module leaving.
   */
  {
    fault: 'canyon:init',
    label: 'canyon.init throws',
    down: [
      ['canyon', 'init'],
      ['city', 'init'],
    ],
  },
  { fault: 'post:render', label: 'post.render throws', down: [['post', 'render']] },
  {
    fault: 'block:init',
    label: 'block.init throws',
    down: [
      ['block', 'init'],
      ['canyon', 'init'],
      ['city', 'init'],
    ],
  },
  /**
   * `block:update` still takes nothing with it, and that remains the case worth
   * having: by then both `canyon` and `city` have initialised, and `needs` is an
   * init-time contract rather than a per-frame one. A street with no buildings
   * still has a canyon field baked from the buildings that were there, and a
   * city that keeps streaming around the hole. Stale, and visibly so.
   */
  { fault: 'block:update', label: 'block.update throws', down: [['block', 'update']] },
  /**
   * SESSION 4. The streaming module is the one whose failure a player would
   * most likely never notice: the world simply stops growing. Asserted
   * explicitly so that "the city is gone" cannot be mistaken for "the city is
   * quiet", and so that the frame is proven to survive without it.
   */
  { fault: 'city:update', label: 'city.update throws', down: [['city', 'update']] },
  { fault: 'city:init', label: 'city.init throws', down: [['city', 'init']] },
];

const ALL_MODULES = [
  'time',
  'camera',
  'lights',
  'sky',
  'lighting',
  'block',
  'canyon',
  'city',
  'river',
  'exposure',
  'post',
  'traffic',
  'weather',
  'streetlife',
  /**
   * Session 20. `?aircraft=1` is the default, so this module is live in every
   * run that does not switch it off — and this list is a two-sided assertion:
   * `missing` catches a module that quarantined itself and `unexpected` catches
   * one nobody wrote down. The second half caught this addition within a minute
   * of the module existing, which is what a list of names is for.
   */
  'aircraft',
  'harness',
];

const failures = [];
const fail = (m) => failures.push(m);

let server;
try {
  server = await startServer(PORT);
} catch (e) {
  console.error('faultcheck: could not start the dev server —', e.message);
  process.exit(2);
}

let browser;
try {
  browser = await launchBrowser();
} catch (e) {
  server.child.kill('SIGKILL');
  console.error('faultcheck: could not launch chromium —', e.message);
  process.exit(2);
}

console.log('faultcheck: CONTRACT §2.1 — a module that throws is quarantined, and the frame keeps rendering\n');

let rendererString = 'unknown';

try {
  for (const c of CASES) {
    const { page, consoleErrors, pageErrors, context } = await openPage(browser, {
      viewport: { width: 640, height: 360 },
      deviceScaleFactor: 1,
    });

    const url = new URL(server.url);
    url.searchParams.set('seed', '1337');
    url.searchParams.set('shot', 'street');
    url.searchParams.set('paused', '1');
    if (c.fault) url.searchParams.set('fault', c.fault);

    await page.goto(url.toString(), { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => !!window.__NOCTIS_HARNESS__, null, { timeout: 60000 });
    await page.evaluate(() => window.__NOCTIS_HARNESS__.ready);
    await page.evaluate(() => window.__NOCTIS_HARNESS__.takeOver());

    if (rendererString === 'unknown') rendererString = await readRendererString(page);

    // Several frames, so an update-phase fault has actually been reached and a
    // render-phase fault has had a chance to fall through to the core's own
    // renderer more than once.
    await page.evaluate(() => window.__NOCTIS_HARNESS__.step(6, 1 / 60));

    const faults = await page.evaluate(() => window.__NOCTIS_HARNESS__.faults());
    const live = await page.evaluate(() => window.__NOCTIS_HARNESS__.live());
    const info = await page.evaluate(() => window.__NOCTIS_HARNESS__.info());
    const shot = await page.screenshot({ type: 'png' });
    const png = decodePNG(shot);

    // Frame statistics, computed here rather than in the page: the question is
    // whether pixels came out, and the page is the thing under suspicion.
    let min = 255;
    let max = 0;
    let sum = 0;
    const n = png.width * png.height;
    for (let i = 0, o = 0; i < n; i++, o += png.channels) {
      const y = 0.2126 * png.data[o] + 0.7152 * png.data[o + 1] + 0.0722 * png.data[o + 2];
      if (y < min) min = y;
      if (y > max) max = y;
      sum += y;
    }
    const mean = sum / n / 255;
    const range = (max - min) / 255;

    const expectedFaults = c.down.length;
    const downNames = c.down.map(([n]) => n);
    const expectedLive = ALL_MODULES.filter((m) => !downNames.includes(m));

    const tag = `${c.label.padEnd(24)}`;
    const bits = [];

    // 1. exactly the right modules, in the right phases
    const got = faults.map((f) => `${f.name}/${f.phase}`).sort();
    const want = c.down.map(([n, p]) => `${n}/${p}`).sort();
    if (got.join() !== want.join()) {
      fail(
        `${c.label}: quarantined ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`
      );
    }
    for (const f of faults) {
      if (!f.stack) fail(`${c.label}: ${f.name} was recorded without a stack — CONTRACT §2.1 requires one`);
    }
    bits.push(`${faults.length} fault${faults.length === 1 ? '' : 's'}`);

    // 2. one error each, logged once
    if (consoleErrors.length !== expectedFaults) {
      fail(
        `${c.label}: ${consoleErrors.length} console error(s), expected ${expectedFaults} — ` +
          `${JSON.stringify(consoleErrors.slice(0, 3))}`
      );
    }
    if (pageErrors.length) {
      fail(`${c.label}: ${pageErrors.length} uncaught page error(s) — a quarantined module escaped its try/catch: ${pageErrors[0]}`);
    }
    bits.push(`${consoleErrors.length} error${consoleErrors.length === 1 ? '' : 's'}`);

    // 3. surgical
    const missing = expectedLive.filter((m) => !live.includes(m));
    const unexpected = live.filter((m) => !expectedLive.includes(m));
    if (missing.length) fail(`${c.label}: ${missing.join(', ')} went down with it — quarantine is meant to be surgical`);
    if (unexpected.length) fail(`${c.label}: ${unexpected.join(', ')} is live but should not be`);
    bits.push(`${live.length} live`);

    // 4. the frame still renders
    if (!(n > 0)) fail(`${c.label}: no pixels`);
    if (!(info.drawCalls > 0)) fail(`${c.label}: the frame drew ${info.drawCalls} calls — nothing was rendered`);
    if (range < 0.02) {
      fail(
        `${c.label}: the frame is uniform (luma range ${range.toFixed(4)}, mean ${mean.toFixed(4)}) — ` +
          `the world stopped rendering rather than losing one module`
      );
    }
    bits.push(`${info.drawCalls} draws`);
    bits.push(`frame mean ${mean.toFixed(3)} range ${range.toFixed(3)}`);

    console.log(`  ${tag} ${bits.join('  ')}`);

    await context.close();
  }
} catch (e) {
  await browser.close();
  server.child.kill('SIGKILL');
  console.error('faultcheck: could not drive the page —', e.message);
  if (e.stack) console.error(e.stack.split('\n').slice(1, 5).join('\n'));
  process.exit(2);
}

await browser.close();
server.child.kill('SIGKILL');

console.log(`\n  GPU: ${rendererString}`);
if (rendererIsSoftware(rendererString)) {
  console.error(`faultcheck: software renderer ("${rendererString}") — this is not this machine's pipeline.`);
  process.exit(2);
}

if (failures.length) {
  console.log('\nQUARANTINE VIOLATIONS');
  for (const f of failures) console.log('  ✗ ' + f);
  console.log('');
  process.exit(1);
}

console.log(`\nfaultcheck: ${CASES.length} cases — quarantine is surgical, logged once, and the frame survives it.`);
process.exit(0);
