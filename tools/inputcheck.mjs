#!/usr/bin/env node
/**
 * inputcheck.mjs — SESSION 18 GATE. Does the input layer deliver what it says?
 *
 *   node tools/inputcheck.mjs
 *   node tools/inputcheck.mjs --falsify
 *
 * Exit 0 = every device delivers its own constant, 1 = one does not, 2 = the
 * check could not run.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS, AND WHY IT IS NOT `walkprobe` WITH ASSERTIONS BOLTED ON.
 *
 * Session 17 specified a keyboard, a mouse and a gamepad, and session 18's
 * walkthrough reported two of the three dead. Nothing in the project could
 * adjudicate that, and the reason is structural rather than an oversight:
 * `tools/walkprobe.mjs` drives `player.setSynthetic()`, which enters the module
 * BELOW the listeners. It exercises the dead zone, the curve, the mask and the
 * ground query — everything except the layer that was reported broken. An input
 * path with no test is how a specified path ships broken, and CONTRACT §7.1 is
 * the section named after that.
 *
 * So this drives REAL BROWSER EVENTS at the REAL LISTENER TARGETS — playwright's
 * `keyboard.down` and `mouse.move` go through Chrome's own input pipeline, not
 * through `dispatchEvent` — and reads the result out of the live player module.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * AND IT ASSERTS THE MAGNITUDE, WHICH IS THE WHOLE DESIGN.
 *
 * The obvious test is "press W, assert the player moved". That test PASSES ON
 * THE BUILD THAT WAS REPORTED BROKEN — session 18 measured it: W moved the
 * player 1.39 m/s, the mouse acquired its lock and turned the view, and the
 * gamepad worked, on this machine, in the dev server and in the built bundle,
 * with and without a pad connected. A boolean instrument cannot tell "not
 * wired" from "wired and imperceptible", and those need different repairs.
 *
 * Every assertion below therefore compares a DELIVERED quantity against the
 * constant that is supposed to produce it — CONTRACT §9.1's own remedy, the one
 * `stats().minExtentM` uses: comparing the module's declaration to the budget
 * would compare two declarations and verify neither. `player.state()` reports
 * what `update()` will actually use this frame; this file measures what the
 * world actually did; the budget holds the tolerance and its derivation.
 *
 * The pointer lock is exercised for the same reason. Session 17 requested it
 * and never asked whether it arrived, so a browser that refuses produces the
 * same silence as a listener that was never attached.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { startServer, launchBrowser, openPage } from './lib/page.mjs';

/** Its own port, so anything else left running cannot make this flaky. */
const PORT = 5197;

const args = new Set(process.argv.slice(2).map((a) => a.replace(/^--/, '')));
const BUDGET = JSON.parse(
  await readFile(new URL('./input-budget.json', import.meta.url), 'utf8')
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// THE VERDICT, AS A PURE FUNCTION.
//
// Separated from the capture for the reason `lookmetrics.mjs` is separated from
// `lookcheck.mjs`: `--falsify` has to be able to hand it a deliberately wrong
// measurement and require a rejection, and there is no way to do that while the
// measuring and the judging are the same code.
// ---------------------------------------------------------------------------

/**
 * @param {object} m  the measured input response — see `measure()`
 * @param {object} b  input-budget.json
 * @returns {Array<[string, string]>} one entry per failure
 */
function judgeInput(m, b) {
  const out = [];
  const rel = (got, want) => Math.abs(got - want) / Math.max(1e-9, Math.abs(want));

  // --- the three devices deliver their own speed --------------------------

  if (rel(m.keyboardWalkMps, m.declaredWalkMps) > b.speed.toleranceFraction) {
    out.push([
      'keyboard:walk',
      `holding W delivered ${m.keyboardWalkMps.toFixed(3)} m/s against PLAYER.walkSpeedMps ` +
      `${m.declaredWalkMps.toFixed(3)} m/s — ${(rel(m.keyboardWalkMps, m.declaredWalkMps) * 100).toFixed(1)}% off, ` +
      `over a tolerance of ${(b.speed.toleranceFraction * 100).toFixed(0)}%`,
    ]);
  }

  if (rel(m.keyboardRunMps, m.declaredRunMps) > b.speed.toleranceFraction) {
    out.push([
      'keyboard:run',
      `Shift+W delivered ${m.keyboardRunMps.toFixed(3)} m/s against PLAYER.runSpeedMps ` +
      `${m.declaredRunMps.toFixed(3)} m/s — ${(rel(m.keyboardRunMps, m.declaredRunMps) * 100).toFixed(1)}% off`,
    ]);
  }

  if (rel(m.padWalkMps, m.declaredWalkMps) > b.speed.toleranceFraction) {
    out.push([
      'gamepad:walk',
      `a full left stick delivered ${m.padWalkMps.toFixed(3)} m/s against ${m.declaredWalkMps.toFixed(3)} m/s. ` +
      `The pad is the device that WAS working when this gate was written, so it is the control: ` +
      `if this fails with the keyboard green, the fault is in the walk, not in the listeners`,
    ]);
  }

  // --- the look devices deliver their own rate ----------------------------

  if (rel(m.mouseDegPerCount, m.declaredMouseDegPerCount) > b.look.toleranceFraction) {
    out.push([
      'mouse:rate',
      `the mouse delivered ${m.mouseDegPerCount.toFixed(5)}°/count against PLAYER.mouseRadPerCount ` +
      `= ${m.declaredMouseDegPerCount.toFixed(5)}°/count — ` +
      `${(rel(m.mouseDegPerCount, m.declaredMouseDegPerCount) * 100).toFixed(1)}% off`,
    ]);
  }

  if (rel(m.padDegPerSec, m.declaredPadDegPerSec) > b.look.toleranceFraction) {
    out.push([
      'gamepad:look',
      `a full look stick delivered ${m.padDegPerSec.toFixed(2)}°/s against ` +
      `PLAYER.maxLookRateDegPerS ${m.declaredPadDegPerSec.toFixed(2)}°/s`,
    ]);
  }

  // --- the mouse is USABLE, not merely wired ------------------------------
  //
  // The band, and the reason it is the assertion this gate was written for, is
  // in input-budget.json → look.$cmPer360.

  const cm360 = m.mouseCmPer360;
  if (cm360 < b.look.minCmPer360) {
    out.push([
      'mouse:tooFast',
      `${cm360.toFixed(1)} cm of desk per 360° is under the ${b.look.minCmPer360} cm floor: one count ` +
      `moves more than one pixel at fov ${m.fovDeg.toFixed(0)}, so the aim is quantised`,
    ]);
  }
  if (cm360 > b.look.maxCmPer360) {
    out.push([
      'mouse:tooSlow',
      `${cm360.toFixed(1)} cm of desk per 360° is over the ${b.look.maxCmPer360} cm ceiling: a 180° turn ` +
      `needs ${(cm360 / 2).toFixed(1)} cm and a comfortable sweep is 30 cm, so looking behind you takes ` +
      `${(cm360 / 2 / 30).toFixed(1)} sweeps. This is the difference between "the mouse does not work" ` +
      `and "the mouse works and nobody can use it"`,
    ]);
  }

  if (m.deviceAuthorityRatio > b.look.maxDeviceAuthorityRatio) {
    out.push([
      'look:authority',
      `one second of full stick turns ${m.padDegPerSec.toFixed(0)}° and one 30 cm mouse sweep turns ` +
      `${(30 / cm360 * 360).toFixed(0)}°, a ratio of ${m.deviceAuthorityRatio.toFixed(2)} over the ` +
      `${b.look.maxDeviceAuthorityRatio} bound — the two devices are not the same control`,
    ]);
  }

  // --- the lock, which is the difference between refused and unwired ------

  if (!m.pointerLockAcquired) {
    out.push([
      'mouse:lock',
      'clicking the canvas did not acquire pointer lock, so mouse look cannot work at all. ' +
      'This is the state session 17 could not distinguish from a missing listener',
    ]);
  }
  if (m.lockError) {
    out.push([
      'mouse:lockError',
      'the browser raised pointerlockerror — the lock was requested and refused. The keyboard and ' +
      'the gamepad are unaffected; only the mouse needs it',
    ]);
  }

  // --- the geometry of a strafe -------------------------------------------

  if (Math.abs(m.strafeForwardDot) > b.geometry.strafeDotMax) {
    out.push([
      'keyboard:strafe',
      `holding A moved ${(Math.asin(Math.min(1, Math.abs(m.strafeForwardDot))) * 180 / Math.PI).toFixed(2)}° ` +
      `off perpendicular (dot ${m.strafeForwardDot.toFixed(4)}), over ${b.geometry.strafeDotMax}`,
    ]);
  }

  // --- the field the player actually got ----------------------------------

  if (Math.abs(m.fovDeg - m.declaredFovDeg) > b.field.toleranceDeg) {
    out.push([
      'camera:fov',
      `the camera is at fov ${m.fovDeg.toFixed(3)}° and PLAYER.fovDeg is ${m.declaredFovDeg.toFixed(3)}° — ` +
      `something other than the player wrote the camera, which is what camera.setDriven exists to prevent`,
    ]);
  }

  return out;
}

// ---------------------------------------------------------------------------
// §7.1 — the fixture that passes, and one perturbation per failure site.
// ---------------------------------------------------------------------------

/** Every number inside every bound. The control for a two-sided self-test. */
function goodInputFixture() {
  return {
    declaredWalkMps: 2.0,
    declaredRunMps: 3.5,
    declaredMouseDegPerCount: 0.028576,
    declaredPadDegPerSec: 180,
    declaredFovDeg: 75,
    keyboardWalkMps: 1.98,
    keyboardRunMps: 3.47,
    padWalkMps: 1.99,
    mouseDegPerCount: 0.02857,
    padDegPerSec: 179.4,
    mouseCmPer360: 40,
    deviceAuthorityRatio: 1.5,
    pointerLockAcquired: true,
    lockError: false,
    strafeForwardDot: 0.001,
    fovDeg: 75,
  };
}

/**
 * One case per failure site in `judgeInput`. Each lives beside the assertion it
 * falsifies, which is the only place it stays in step (CONTRACT §7.1).
 *
 * Note what several of them ARE: `keyboardReadsTheCrowdsConstant` is session
 * 18's own change failing to land, `mouseAtSession17Rate` is the mouse wired at
 * 40 cm/360 when the fov moved under it, and `mouseNeverWired` is the reported
 * defect. A registry of cases that are all synthetic is a registry nobody
 * checked against a real failure.
 */
const FALSIFY_INPUT = [
  ['keyboardDead', (m) => { m.keyboardWalkMps = 0; }],
  ['keyboardReadsTheCrowdsConstant', (m) => { m.keyboardWalkMps = 1.4; }],
  ['runIsAWalk', (m) => { m.keyboardRunMps = 2.0; }],
  ['padDead', (m) => { m.padWalkMps = 0; }],
  ['mouseAtCameraFreeLookRate', (m) => { m.mouseDegPerCount = 0.1490; }],
  ['padLookDead', (m) => { m.padDegPerSec = 0; }],
  ['mouseTooFast', (m) => { m.mouseCmPer360 = 8; }],
  ['mouseTooSlowToUse', (m) => { m.mouseCmPer360 = 200; }],
  ['devicesDisagree', (m) => { m.deviceAuthorityRatio = 9; }],
  ['mouseNeverWired', (m) => { m.pointerLockAcquired = false; }],
  ['browserRefusedTheLock', (m) => { m.lockError = true; }],
  ['strafeWalksForward', (m) => { m.strafeForwardDot = 0.7; }],
  ['fieldInheritedFromARoute', (m) => { m.fovDeg = 50; }],
];

if (args.has('falsify')) {
  const problems = [];
  const control = judgeInput(goodInputFixture(), BUDGET);
  if (control.length) {
    problems.push(
      `the GOOD fixture failed ${control.length} assertion(s), so every case below is meaningless: ` +
      control.map(([t, msg]) => `[${t}] ${msg}`).join(' | ')
    );
  }

  let rejected = 0;
  for (const [id, mutate] of FALSIFY_INPUT) {
    const m = goodInputFixture();
    mutate(m);
    if (judgeInput(m, BUDGET).length === 0) {
      problems.push(`'${id}' was NOT rejected — the assertion it falsifies does not reject anything`);
    } else {
      rejected++;
    }
  }

  /**
   * Coverage, counted from this file's own source rather than declared. The
   * denominator is `judgeInput`'s body and nothing else — the same arithmetic
   * `citycheck` uses, and the same trap it names: an aggregating
   * `out.push(...list)` would inflate the denominator in the flattering
   * direction.
   */
  const src = await readFile(new URL(import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('function judgeInput'), src.indexOf('function goodInputFixture'));
  const sites = body.split('\n').filter((l) => /out\.push\(\[/.test(l)).length;
  const coverage = sites ? Math.min(1, FALSIFY_INPUT.length / sites) : 0;
  if (coverage < BUDGET.falsify.requireCoverage) {
    problems.push(
      `${FALSIFY_INPUT.length} falsifying cases against ${sites} failure sites in judgeInput — ` +
      `coverage ${(coverage * 100).toFixed(0)}%. A gate without a known case that makes it fail is not a gate.`
    );
  }

  if (problems.length) {
    for (const p of problems) console.log('  ✗ ' + p);
    console.log(`inputcheck --falsify: FAILED (${problems.length})`);
    process.exit(1);
  }
  console.log(
    `inputcheck --falsify: ${rejected}/${FALSIFY_INPUT.length} rejected at ` +
    `${(coverage * 100).toFixed(0)}% coverage of ${sites} failure sites, and the good fixture passed clean.`
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// The capture.
// ---------------------------------------------------------------------------

/**
 * A synthetic gamepad, injected before any script runs so `readPad()` sees it
 * from the first frame.
 *
 * It is not a substitute for a real pad and does not claim to be: what it
 * exercises is `navigator.getGamepads()` → dead zone → curve → the same walk
 * the keyboard reaches, which is every line of the pad path except the driver.
 * The pad is in here as the CONTROL — it is the device that was working when
 * this gate was written, so a run where it fails alongside the keyboard says
 * the fault is in the walk rather than in the listeners.
 */
const PAD_INIT = () => {
  const pad = {
    connected: true,
    index: 0,
    id: 'noctis inputcheck synthetic pad',
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  navigator.getGamepads = () => [pad, null, null, null];
  window.__INPUTCHECK_PAD__ = pad;
};

async function measure() {
  const server = await startServer(PORT);
  const browser = await launchBrowser();
  const { page, pageErrors } = await openPage(browser, {
    viewport: { width: 1280, height: 720 },
  });

  try {
    await page.addInitScript(PAD_INIT);
    const url = new URL(server.url);
    url.searchParams.set('player', '1');
    url.searchParams.set('seed', '1337');
    // Midnight, because that is when somebody walks it, and because a route
    // never runs with the player registered — this is the one gate that does.
    url.searchParams.set('t', '0.0');
    await page.goto(url.toString(), { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(
      () => !!window.__NOCTIS__ && !!window.__NOCTIS__.ctx.get('player'),
      null,
      { timeout: 60000 }
    );
    // Let the residency ring arrive: a player standing on ground that has not
    // streamed in is falling, and a fall is not a walk.
    await sleep(3000);

    const st = () => page.evaluate(() => window.__NOCTIS__.ctx.get('player').state());
    const now = () => page.evaluate(() => window.__NOCTIS__.ctx.get('time').now);

    /** Hold something, and return what the world actually did. */
    const hold = async (down, up, ms = 1500) => {
      const a = await st();
      const t0 = await now();
      await down();
      await sleep(ms);
      const b = await st();
      const t1 = await now();
      await up();
      await sleep(150);
      const dx = b.position[0] - a.position[0];
      const dz = b.position[2] - a.position[2];
      return {
        dist: Math.hypot(dx, dz),
        dt: t1 - t0,
        mps: Math.hypot(dx, dz) / Math.max(1e-6, t1 - t0),
        dx,
        dz,
        yawA: a.yawDeg,
        yawB: b.yawDeg,
        state: b,
      };
    };

    const declared = await st();

    const walk = await hold(
      () => page.keyboard.down('w'),
      () => page.keyboard.up('w')
    );
    const run = await hold(
      async () => { await page.keyboard.down('Shift'); await page.keyboard.down('w'); },
      async () => { await page.keyboard.up('w'); await page.keyboard.up('Shift'); }
    );

    /**
     * The strafe, taken against the facing the player actually had, not against
     * an assumed one. yaw is measured in degrees and CONTRACT §3.1 puts forward
     * at (−sin yaw, −cos yaw), which is what `player.js` builds.
     */
    const strafe = await hold(
      () => page.keyboard.down('a'),
      () => page.keyboard.up('a')
    );
    const yawRad = (strafe.yawB * Math.PI) / 180;
    const fwd = { x: -Math.sin(yawRad), z: -Math.cos(yawRad) };
    const sLen = Math.max(1e-9, Math.hypot(strafe.dx, strafe.dz));
    const strafeForwardDot = (strafe.dx / sLen) * fwd.x + (strafe.dz / sLen) * fwd.z;

    // --- the pad, both sticks ----------------------------------------------

    const padWalk = await hold(
      () => page.evaluate(() => { window.__INPUTCHECK_PAD__.axes = [0, -1, 0, 0]; }),
      () => page.evaluate(() => { window.__INPUTCHECK_PAD__.axes = [0, 0, 0, 0]; })
    );

    /**
     * ACCUMULATED, NOT DIFFERENCED, AND THE FIRST DRAFT OF THIS GATE GOT IT
     * WRONG — CONTRACT §7.7, in the gate written to catch exactly this.
     *
     * `yawDeg` is reported wrapped into (−180, 180]. A full look stick turns
     * `maxLookRateDegPerS` = 180 °/s, so a 1.2 s sweep turns 216° and the
     * difference of the two endpoints wraps to 216 − 360 = −144. The gate duly
     * reported 117.4 °/s against a declared 180 and failed the pad — the one
     * device the walkthrough said WAS working. An instrument that measures an
     * angle by subtracting two wrapped angles is measuring the wrap.
     *
     * So the sweep is sampled in short legs and the wrapped deltas summed: each
     * leg is well under half a turn, so each wrap is unambiguous, and the total
     * is free to exceed 180°.
     */
    const wrap = (d) => ((d + 540) % 360) - 180;
    const padT0 = await now();
    let padYawDeg = 0;
    let prevYaw = (await st()).yawDeg;
    await page.evaluate(() => { window.__INPUTCHECK_PAD__.axes = [0, 0, -1, 0]; });
    for (let leg = 0; leg < 6; leg++) {
      await sleep(200);
      const y = (await st()).yawDeg;
      padYawDeg += wrap(y - prevYaw);
      prevYaw = y;
    }
    const padT1 = await now();
    await page.evaluate(() => { window.__INPUTCHECK_PAD__.axes = [0, 0, 0, 0]; });
    await sleep(150);
    const padDegPerSec = Math.abs(padYawDeg) / Math.max(1e-6, padT1 - padT0);

    // --- the mouse, which needs the lock ------------------------------------

    await page.mouse.click(640, 360);
    await sleep(500);
    const locked = await st();

    const mouseA = await st();
    // Count what the browser actually delivered rather than what was asked for:
    // pointer events coalesce, and a test that assumed one event per step would
    // measure the coalescing rather than the sensitivity.
    await page.evaluate(() => {
      window.__INPUTCHECK_DX__ = 0;
      window.__INPUTCHECK_SPY__ = (e) => { window.__INPUTCHECK_DX__ += e.movementX || 0; };
      document.addEventListener('mousemove', window.__INPUTCHECK_SPY__);
    });
    await page.mouse.move(640, 360);
    for (let i = 1; i <= 20; i++) await page.mouse.move(640 + i * 30, 360);
    await sleep(300);
    const dxCounts = await page.evaluate(() => {
      document.removeEventListener('mousemove', window.__INPUTCHECK_SPY__);
      return window.__INPUTCHECK_DX__;
    });
    const mouseB = await st();
    const mouseDegPerCount =
      Math.abs(wrap(mouseB.yawDeg - mouseA.yawDeg)) / Math.max(1e-9, Math.abs(dxCounts));

    const cfg = await page.evaluate(() => ({
      cmPer360: window.__NOCTIS__.ctx.get('player') ? null : null,
    }));
    void cfg;

    const mouseCmPer360 = 360 / (mouseDegPerCount * (800 / 2.54));
    const padSweepDeg = declared.padDegPerSec * 1.0;
    const mouseSweepDeg = (30 / mouseCmPer360) * 360;
    const deviceAuthorityRatio =
      Math.max(padSweepDeg, mouseSweepDeg) / Math.max(1e-9, Math.min(padSweepDeg, mouseSweepDeg));

    return {
      m: {
        declaredWalkMps: declared.walkSpeedMps,
        declaredRunMps: declared.runSpeedMps,
        declaredMouseDegPerCount: declared.mouseDegPerCount,
        declaredPadDegPerSec: declared.padDegPerSec,
        declaredFovDeg: declared.fovDeg,
        keyboardWalkMps: walk.mps,
        keyboardRunMps: run.mps,
        padWalkMps: padWalk.mps,
        mouseDegPerCount,
        padDegPerSec,
        mouseCmPer360,
        deviceAuthorityRatio,
        pointerLockAcquired: !!locked.pointerLocked,
        lockError: !!mouseB.lockError,
        strafeForwardDot,
        fovDeg: mouseB.fovDeg,
      },
      dxCounts,
      pageErrors,
    };
  } finally {
    await browser.close();
    server.child.kill('SIGKILL');
  }
}

let captured;
try {
  captured = await measure();
} catch (e) {
  console.log(`inputcheck: could not run — ${e && e.message ? e.message : e}`);
  process.exit(2);
}

const { m, dxCounts, pageErrors } = captured;

console.log('inputcheck — delivered response, through the real listeners');
console.log(
  `  keyboard  walk ${m.keyboardWalkMps.toFixed(3)} m/s / declared ${m.declaredWalkMps.toFixed(3)}   ` +
  `run ${m.keyboardRunMps.toFixed(3)} / ${m.declaredRunMps.toFixed(3)}   ` +
  `strafe dot ${m.strafeForwardDot.toFixed(4)}`
);
console.log(
  `  gamepad   walk ${m.padWalkMps.toFixed(3)} m/s   look ${m.padDegPerSec.toFixed(2)}°/s / ` +
  `declared ${m.declaredPadDegPerSec.toFixed(2)}`
);
console.log(
  `  mouse     ${m.mouseDegPerCount.toFixed(5)}°/count / declared ${m.declaredMouseDegPerCount.toFixed(5)}   ` +
  `= ${m.mouseCmPer360.toFixed(1)} cm/360° (band ${BUDGET.look.minCmPer360}–${BUDGET.look.maxCmPer360})   ` +
  `over ${dxCounts} delivered counts   lock ${m.pointerLockAcquired ? 'acquired' : 'REFUSED'}` +
  `${m.lockError ? ' (pointerlockerror)' : ''}`
);
console.log(
  `  authority 1 s of stick = ${(m.declaredPadDegPerSec).toFixed(0)}°, one 30 cm sweep = ` +
  `${((30 / m.mouseCmPer360) * 360).toFixed(0)}°, ratio ${m.deviceAuthorityRatio.toFixed(2)} ` +
  `(bound ${BUDGET.look.maxDeviceAuthorityRatio})`
);
console.log(`  field     fov ${m.fovDeg.toFixed(2)}° / declared ${m.declaredFovDeg.toFixed(2)}°`);

const failures = judgeInput(m, BUDGET);
if (pageErrors.length) {
  failures.push(['page', `the page raised ${pageErrors.length} error(s): ${pageErrors.slice(0, 3).join(' | ')}`]);
}

console.log('');
if (failures.length) {
  for (const [tag, msg] of failures) console.log(`  ✗ [${tag}] ${msg}`);
  console.log(`\ninputcheck: ${failures.length} failure(s).`);
  process.exit(1);
}

console.log(
  'inputcheck: keyboard, mouse and gamepad each deliver their own constant, the lock is acquired, ' +
  'and the mouse is inside the usable band.'
);
process.exit(0);
