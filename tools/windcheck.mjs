#!/usr/bin/env node
/**
 * windcheck.mjs — THE WINDING GATE. Session 14.
 *
 *   node tools/windcheck.mjs
 *   node tools/windcheck.mjs --falsify
 *   node tools/windcheck.mjs --table            (every row, not only the bad ones)
 *
 * WHY THIS EXISTS, IN ONE PARAGRAPH.
 *
 * Three winding defects in three places, found in two consecutive sessions by
 * three different accidents: a lofted pedestrian surface (s12, found by looking
 * at a coat), a ground quad (s13, found because a park would not appear), and a
 * window reveal rotated twice (s13, found by walking up to a facade). Each was
 * geometry SUBMITTED EVERY FRAME AND NEVER SEEN. Six gates and thirteen
 * sessions passed over all three, and the reason is not carelessness — it is
 * that the silhouette of a convex solid is identical whichever shell the
 * rasteriser keeps, and every assertion in this project reads an outline, a
 * count, a colour or a millisecond. None of those move.
 *
 * Three instances is not a coincidence and the first job is not a fix, it is a
 * search. This gate is the search, made permanent.
 *
 * WHAT IT ASSERTS. Every geometry in the live scene, walked, with three tests
 * whose blind spots do not overlap — signed volume, authored-normal agreement,
 * and front-facing area from a spread of eyes. `tools/lib/winding.mjs` holds
 * the arithmetic and the controls' expectations; this file drives the browser,
 * collects the census at every eye, and prints the table.
 *
 * THE CONTROLS ARE MESHES IN THE LIVE SCENE, NOT A FIXTURE IN NODE. CONTRACT
 * §7.3.1: a control that skips the render path certifies the arithmetic rather
 * than the instrument, and the part of `roofSpan` that was wrong was the part
 * its control had never touched. `harness.windingControls(true)` adds four —
 * a correct box, a reversed box, a correctly wound ground quad and the exact
 * quad `buildGround` shipped for thirteen sessions — and `--falsify` requires
 * the first and third to PASS and the second and fourth to FAIL, on the named
 * tests. A gate that only rejects is session 4's walkability flood fill.
 *
 * THE EYES. `facing` is a property of a placement seen from somewhere, so it is
 * measured from a spread of camera poses on the gate's OWN ROUTES — `poseRoute`,
 * which CONTRACT §8 permits a gate to drive, and never `setShotAt`, which it
 * does not. A geometry fails only when NO eye in the spread sees any of it,
 * which is what "submitted and never seen" means and is exactly 0.0000 for all
 * three known defects.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { startServer, launchBrowser, openPage, readRendererString, rendererIsSoftware, ROOT } from './lib/page.mjs';
import { foldCensuses, judge, formatRow, TABLE_HEADER, CONTROL_EXPECTATIONS } from './lib/winding.mjs';

const BUDGET = JSON.parse(await readFile(new URL('./budget.json', import.meta.url), 'utf8'));
const W = BUDGET.winding;
if (!W) {
  console.error('budget.json has no `winding` block — the thresholds are the gate and a gate with no thresholds is not one');
  process.exit(1);
}

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);
const FALSIFY = args.has('falsify');
const SHOW_ALL = args.has('table');

const failures = [];
const fail = (tag, msg) => failures.push([tag, msg]);

const server = await startServer(Number(args.get('port') || 5199));
const browser = await launchBrowser();
const { page, pageErrors } = await openPage(browser, {
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
});

let report = null;

try {
  const url = new URL(server.url);
  for (const [k, v] of Object.entries(BUDGET.capture.params)) url.searchParams.set(k, String(v));
  await page.goto(url.toString(), { waitUntil: 'load', timeout: 90_000 });
  await page.waitForFunction(() => window.__NOCTIS_HARNESS__, null, { timeout: 60_000 });
  const gpu = await readRendererString(page);
  if (rendererIsSoftware(gpu)) {
    throw new Error(`software renderer (${gpu}) — a rasteriser nobody ships`);
  }
  console.log(`GPU: ${gpu}`);
  await page.evaluate(() => window.__NOCTIS_HARNESS__.ready);

  const missing = await page.evaluate(() => {
    const h = window.__NOCTIS_HARNESS__;
    return ['windingCensus', 'windingControls', 'windingControlsActive', 'poseRoute']
      .filter((k) => typeof h[k] !== 'function');
  });
  if (missing.length) throw new Error(`harness is missing ${missing.join(', ')}`);

  /**
   * THE EYE SWEEP.
   *
   * `facing` needs a spread, and the spread has to be one a gate is allowed to
   * choose: CONTRACT §8 lets a gate drive `poseRoute` because the placement
   * comes from a path the gate already runs, and forbids `setShotAt` because a
   * gate whose camera the operator chooses measures the operator.
   *
   * Six poses over three routes, at both ends and the middle of each: the three
   * routes have different times of day, different wetness and — the part that
   * matters here — different chunks resident, so between them they bring the
   * whole vocabulary of the generator into the scene rather than one street's
   * worth of it.
   */
  const EYES = W.eyes;
  const censuses = [];
  const seenNames = new Set();

  for (const { route, u } of EYES) {
    await page.evaluate(([r, p]) => window.__NOCTIS_HARNESS__.poseRoute(r, p, 20), [route, u]);
    const c = await page.evaluate((mt) => window.__NOCTIS_HARNESS__.windingCensus({ maxTris: mt }), W.maxTris);
    censuses.push(c);
    for (const r of c.rows) seenNames.add(r.name);
    console.log(
      `  eye ${route}@${u.toFixed(2)}  (${c.eye.map((v) => v.toFixed(0)).join(', ')})  ` +
      `${c.meshes} meshes`
    );
  }

  /**
   * The controls are added AFTER the city census and measured in their own
   * pass, so no delivered row can be a control and no control can be counted as
   * coverage. `windingControlsActive()` is asserted false around the city pass
   * for the same reason `perfcheck` refuses `setInstanceUploadFrozen`.
   */
  const dirty = await page.evaluate(() => window.__NOCTIS_HARNESS__.windingControlsActive());
  if (dirty) fail('controls', 'the winding controls were live during the city census — every row is suspect');

  const rows = foldCensuses(censuses);
  const judged = rows.map((r) => ({ row: r, j: judge(r, W.thresholds) }));

  console.log(`\n${TABLE_HEADER}`);
  console.log('-'.repeat(TABLE_HEADER.length));
  for (const { row, j } of judged) {
    if (!SHOW_ALL && j.verdict === 'ok') continue;
    console.log(formatRow(row, j));
  }
  if (!SHOW_ALL) {
    console.log(`  (${judged.filter((x) => x.j.verdict === 'ok').length} rows verdict ok, hidden — --table shows every row)`);
  }

  const bad = judged.filter((x) => x.j.verdict === 'bad');
  const unmeasured = judged.filter((x) => x.j.verdict === 'unmeasured');
  const na = judged.filter((x) => x.j.verdict === 'n/a');

  console.log(
    `\n${judged.length} meshes: ${judged.filter((x) => x.j.verdict === 'ok').length} ok, ` +
    `${bad.length} wound backwards, ${unmeasured.length} unmeasured, ${na.length} double-sided (not culled)`
  );

  for (const { row, j } of bad) {
    fail('winding', `${row.name} — ${j.reasons.filter((r) => !/declined|tautology/.test(r)).join('; ')}`);
  }

  /**
   * COVERAGE, AND IT IS A FLOOR RATHER THAN A LIST OF NAMES.
   *
   * A census that walked an empty scene reports zero bad rows, which is
   * indistinguishable from a green one in every report this project produces
   * (CONTRACT §7.1). So the gate asserts that the vocabulary it was asked to
   * cover actually turned up: every pattern in `winding.requiredMeshes` must
   * match at least one mesh name in the census, and the total geometry count
   * carries its own floor.
   */
  const seen = [...seenNames];
  const absent = W.requiredMeshes.filter((pat) => !seen.some((n) => new RegExp(pat).test(n)));
  if (absent.length) {
    fail('coverage', `no mesh matched ${absent.map((a) => `/${a}/`).join(', ')} — the audit did not reach that content, so it says nothing about it`);
  }
  if (judged.length < W.thresholds.minMeshes) {
    fail('coverage', `${judged.length} meshes audited, under the floor of ${W.thresholds.minMeshes} — a census this small is a census of something else`);
  }
  /**
   * A CULL-ELIGIBLE MESH THAT NO TEST DECIDED HAS BEEN WALKED AND NOT AUDITED,
   * and the two are indistinguishable in the summary line. The three tests
   * between them must decide every one; which one did it is the `vnf` column,
   * because CONTRACT §7.6's rule applies here — no single test verifies both a
   * closed solid and an open surface, so "it passed" without naming the test is
   * half a statement.
   */
  const cullEligible = judged.filter((x) => x.row.side !== 'double');
  const decidedRows = cullEligible.filter((x) => x.j.decided > 0).length;
  const perTest = { volume: 0, normals: 0, facing: 0 };
  for (const x of cullEligible) for (const k of Object.keys(perTest)) if (x.j.tests[k] !== 'declined') perTest[k]++;
  console.log(
    `coverage: ${seen.length} mesh names, ${judged.length} meshes (floor ${W.thresholds.minMeshes}), ` +
    `${decidedRows} of ${cullEligible.length} cull-eligible decided ` +
    `(volume ${perTest.volume}, normals ${perTest.normals}, facing ${perTest.facing}); ` +
    `${unmeasured.length} unmeasured (ceiling ${W.thresholds.maxUnmeasured})`
  );
  if (unmeasured.length > W.thresholds.maxUnmeasured) {
    fail('coverage',
      `${unmeasured.length} cull-eligible mesh(es) decided by no test — ${unmeasured.map((x) => x.row.name).join(', ')} ` +
      `— a census that declines is §7.1's quiet gate wearing a census`);
  }

  // -----------------------------------------------------------------------
  // THE CONTROLS. CONTRACT §7.3, both directions, on the delivered code path.
  // -----------------------------------------------------------------------
  const controlNames = await page.evaluate(() => window.__NOCTIS_HARNESS__.windingControls(true));
  /**
   * THE CONTROLS ARE MEASURED AT `minEyes` EYES, LIKE EVERYTHING ELSE, and the
   * eyes are given explicitly rather than by moving the camera.
   *
   * CONTRACT §8's rule is about a gate that RENDERS through an instrument the
   * operator aimed. Nothing is rendered here: `windingCensus` walks matrices and
   * attributes, and `eye` is a point in the arithmetic. Moving the real camera
   * five kilometres to look at four control boxes would restream the residency
   * ring and change the city census that was already taken.
   *
   * The three eyes are ABOVE the controls and offset in x and z, which is the
   * one property that matters: the down-wound quad must read 0.0000 from every
   * eye above it and the up-wound one 1.0000, and a control cluster sampled
   * from a single point would certify a single point (§7.3.1).
   */
  const controlEyes = await page.evaluate(() => {
    const c = window.__NOCTIS_HARNESS__.windingControlCentre();
    return [
      [c[0], c[1] + 40, c[2] - 25],
      [c[0] - 30, c[1] + 22, c[2] + 30],
      [c[0] + 35, c[1] + 60, c[2] + 8],
    ];
  });
  const cRuns = [];
  for (const e of controlEyes) {
    cRuns.push(await page.evaluate(
      ([mt, eye]) => window.__NOCTIS_HARNESS__.windingCensus({ maxTris: mt, eye }),
      [W.maxTris, e]
    ));
  }
  const controlRows = foldCensuses(cRuns).filter((r) => r.name.startsWith('winding:control:'));
  await page.evaluate(() => window.__NOCTIS_HARNESS__.windingControls(false));
  const stillThere = await page.evaluate(() => window.__NOCTIS_HARNESS__.windingControlsActive());
  if (stillThere) fail('controls', 'windingControls(false) left meshes in the scene — a control in a delivered frame is content nobody authored');

  console.log(`\ncontrols — CONTRACT §7.3, ${controlNames.names.length} shapes through the same census:`);
  console.log(TABLE_HEADER);
  console.log('-'.repeat(TABLE_HEADER.length));
  const controlResults = [];
  for (const [name, exp] of Object.entries(CONTROL_EXPECTATIONS)) {
    const row = controlRows.find((r) => r.name === name);
    if (!row) {
      fail('controls', `control ${name} was not in the census — a control that is not measured is not a control`);
      continue;
    }
    const j = judge(row, W.thresholds);
    console.log(formatRow(row, j));
    controlResults.push({ name, verdict: j.verdict, tests: j.tests });
    if (j.verdict !== exp.verdict) {
      fail('controls', `${name}: verdict '${j.verdict}', expected '${exp.verdict}' — ${exp.$why}`);
    }
    /**
     * EVERY TEST'S OUTCOME IS ASSERTED, INCLUDING THE PASSES ON A NEGATIVE
     * CONTROL. Those passes are the instrument's declared blind spots, and a
     * blind spot that stops holding is as much a change as a fail that stops
     * failing: if `facing` ever started rejecting the reversed box, either the
     * box or the metric would have changed and nobody would be told.
     */
    for (const [t, want] of Object.entries(exp.expect)) {
      if (j.tests[t] !== want) {
        fail('controls',
          `${name}: test '${t}' reported '${j.tests[t]}' where '${want}' is required — ` +
          (want === 'fail' ? 'the metric cannot see the defect this control stands for'
            : want === 'declined' ? 'this control exists to show which tests carry this class of surface'
              : 'a declared blind spot or pass has moved, which is a change in the instrument'));
      }
    }
  }

  report = {
    gpu,
    eyes: censuses.map((c) => c.eye),
    meshes: judged.length,
    ok: judged.filter((x) => x.j.verdict === 'ok').length,
    bad: bad.map((x) => ({ name: x.row.name, reasons: x.j.reasons })),
    unmeasured: unmeasured.map((x) => x.row.name),
    doubleSided: na.map((x) => x.row.name),
    controls: controlResults,
    /**
     * The control rows ride in `rows` beside the city's, so `--falsify` can
     * perturb a threshold against a shape whose correct answer is known. A
     * self-test that can only read verdicts can check that the gate rejected
     * something; it cannot check that a THRESHOLD is what did the rejecting.
     */
    rows: [...judged, ...controlRows.map((r) => ({ row: r, j: judge(r, W.thresholds) }))].map(({ row, j }) => ({
      name: row.name,
      tris: row.tris,
      instances: row.instances,
      closed: row.closed,
      signedVolume: row.signedVolume,
      normalsDerived: row.normalsDerived,
      normalAgreement: row.normalAgreement,
      facingMax: row.facingMax,
      facingMin: row.facingMin,
      eyes: row.eyes,
      openEdges: row.openEdges,
      hasNormals: row.hasNormals,
      mirroredInstancesRaw: row.mirroredInstances,
      side: row.side,
      mirroredInstances: row.mirroredInstances,
      mirroredObjects: row.mirroredObjects,
      verdict: j.verdict,
      tests: j.tests,
    })),
  };

  if (pageErrors.length) fail('page', `page errors: ${pageErrors.join(' | ')}`);
  const faults = await page.evaluate(() => window.__NOCTIS_HARNESS__.faults());
  if (faults.length) fail('faults', `${faults.length} module(s) quarantined: ${faults.map((f) => f.name).join(', ')}`);
} catch (err) {
  fail('harness', String(err && err.stack ? err.stack : err));
} finally {
  await browser.close();
  server.child.kill('SIGKILL');
}

if (report) {
  const dir = path.join(ROOT, 'tools', 'wind-out');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'winding.json'), JSON.stringify(report, null, 1));
  console.log(`\nwritten: tools/wind-out/winding.json`);
}

/**
 * `--falsify` is CONTRACT §7.1's self-test and it is TWO-SIDED. The fixture is
 * the four live controls above; this adds the other half — a perturbation of
 * each threshold that must produce a failure, so that a threshold nobody can
 * breach cannot sit here looking like a bound.
 */
if (FALSIFY) {
  console.log('\n--falsify: perturbing each threshold against the control rows\n');
  const cases = [];
  const record = (name, ok, detail) => {
    cases.push({ name, ok, detail });
    console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) fail('falsify', `${name}: ${detail}`);
  };
  if (!report) {
    record('report exists', false, 'the run produced no report, so there is nothing to perturb');
  } else {
    const good = report.rows.find((r) => r.name === 'winding:control:good')
      || report.controls.find((c) => c.name === 'winding:control:good');
    const ctl = (n) => report.controls.find((c) => c.name === n);
    record('positive control passes', ctl('winding:control:good')?.verdict === 'ok',
      `a closed box in three's own order judged '${ctl('winding:control:good')?.verdict}'`);
    record('open positive control passes', ctl('winding:control:quad-up')?.verdict === 'ok',
      `a correctly wound ground quad judged '${ctl('winding:control:quad-up')?.verdict}'`);
    record('negative control fails on volume', ctl('winding:control:reversed')?.tests.volume === 'fail',
      'a reversed closed box must be caught by the signed volume');
    record('negative control fails on normals', ctl('winding:control:reversed')?.tests.normals === 'fail',
      'an outward normal on an inward triangle must be caught by the normal test');
    record('facing is BLIND to a reversed closed solid', ctl('winding:control:reversed')?.tests.facing === 'pass',
      'a closed shell presents about half its area to any eye whichever shell is drawn — the ' +
      'declared blind spot, asserted so that it cannot change unnoticed');
    record('open negative control fails on normals', ctl('winding:control:quad-down')?.tests.normals === 'fail',
      'the s13 ground defect, exactly as it shipped');
    record('open negative control fails on facing', ctl('winding:control:quad-down')?.tests.facing === 'fail',
      'a down-wound quad presents 0% of its area to an eye above it');
    record('open controls decline volume', ctl('winding:control:quad-down')?.tests.volume === 'declined'
      && ctl('winding:control:quad-up')?.tests.volume === 'declined',
      'a quad encloses nothing — this is what proves the other two tests carry the open surfaces');
    /**
     * The perturbations, on the JUDGE rather than on the world: each threshold
     * is moved to a value that must change a control's verdict. A threshold
     * whose movement changes nothing is not a threshold.
     */
    /**
     * The row as the judge sees it, straight out of the report — not a
     * reconstruction. An earlier version rebuilt it with `eyes: 1` and
     * `openEdges: 0` hard-coded, which is a fixture pretending to be a
     * measurement and would have passed whatever the run measured.
     */
    const rowOf = (n) => report.rows.find((x) => x.name === n);
    const goodRow = rowOf('winding:control:good') || null;
    if (!goodRow) {
      record('good control row recoverable', false, 'the control rows are not in the report');
    } else {
      const strict = { ...W.thresholds, minNormalAgreement: 1.0000001 };
      record('minNormalAgreement is load-bearing',
        judge(goodRow, strict).tests.normals === 'fail',
        'raising it above 1 must reject the shape that passes it');
      const strictF = { ...W.thresholds, minFrontFacing: 0.999 };
      record('minFrontFacing is load-bearing',
        judge(goodRow, strictF).tests.facing === 'fail',
        'a closed box cannot present 99.9% of its area, so this must reject it');
      const manyEyes = { ...W.thresholds, minEyes: 99 };
      record('minEyes is load-bearing',
        judge(goodRow, manyEyes).tests.facing === 'declined',
        'a facing verdict on too few eyes must decline rather than pass');
    }
    void good;
  }
  const passed = cases.filter((c) => c.ok).length;
  console.log(`\n  ${passed}/${cases.length} falsifying cases`);
}

if (failures.length) {
  console.error(`\n${failures.length} failure(s):`);
  for (const [tag, msg] of failures) console.error(`  ✗ ${tag}: ${msg}`);
  process.exit(1);
}
console.log('\nwindcheck ✓');
