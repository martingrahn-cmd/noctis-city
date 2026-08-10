/**
 * winding.mjs — the arithmetic behind `tools/windcheck.mjs`, and the place the
 * §7.3 controls' EXPECTATIONS live.
 *
 * The harness supplies measurements and no verdict (CONTRACT §8). This file
 * turns them into one, and it is separate from the gate for exactly the reason
 * `lib/silhouette.mjs` is: the falsifying cases have to sit beside the metric,
 * and a metric that lives inside its own gate cannot be handed a control
 * without also handing it the gate's exit code.
 *
 * THREE TESTS, AND WHY IT IS THREE.
 *
 * Session 12 found a lofted surface wound backwards. Session 13 found a ground
 * quad wound backwards and a reveal box rotated twice. Six gates and twelve
 * sessions saw none of them, and the reason is one sentence: THE SILHOUETTE OF
 * A CONVEX SOLID IS IDENTICAL WHICHEVER SHELL IS DRAWN. Every assertion in this
 * project reads an outline, a count, a colour or a millisecond, and a backwards
 * mesh changes none of those — it changes which of two surfaces the rasteriser
 * keeps, and on a closed solid both surfaces have the same outline.
 *
 * So the tests are chosen to have INDEPENDENT blind spots:
 *
 *   volume    reads the triangle order alone. Needs a closed mesh. Blind to
 *             every open surface in the project, which is most of the defects.
 *   normals   reads the authored normal against the geometric one. Needs
 *             authored normals. Blind wherever `computeVertexNormals()` derived
 *             them from the winding, where it is a tautology and says so.
 *   facing    reads the fraction of area presenting its front to an eye. Needs
 *             nothing but the delivered matrices, and is the only one of the
 *             three that would have caught all three known defects alone —
 *             but a legitimately one-sided surface can read low from one eye,
 *             so it is taken as a MAXIMUM over a spread of eyes and a surface
 *             fails only when NO eye in the spread can see any of it.
 *
 * A geometry passes when every test that applies to it passes, and the row
 * records which applied. A row on which no test applied is reported as
 * `unmeasured` and counted against a floor, because CONTRACT §7.1's quiet gate
 * is the failure this whole file exists to prevent and a census that declines
 * everything is that gate wearing a census.
 */

export const WINDING_TESTS = ['volume', 'normals', 'facing'];

/**
 * THE CONTROLS' EXPECTED VERDICTS. CONTRACT §7.3 — a metric that claims to
 * measure a property of a shape is run on a shape that HAS the property and one
 * that does NOT, and both directions are required before the metric is trusted.
 *
 * `harness.windingControls(true)` puts these four in the live scene and the
 * census walks them exactly as it walks the city, and each declares the EXACT
 * outcome of all three tests rather than only the ones it must fail. That is
 * deliberate and it is the part with teeth: "the negative control failed" is
 * not a finding if it failed on a test the defect it stands for would not have
 * tripped, and — the direction that actually bit — a test that PASSES a
 * negative control is a blind spot, and a blind spot is a fact about the
 * instrument that belongs in the gate rather than in a paragraph.
 *
 * THE BLIND SPOTS ARE ASSERTED, WHICH IS WHY THE TABLE READS THE WAY IT DOES:
 *
 *   `reversed`  facing PASSES it, at 0.667 against the good box's 0.500. A
 *               closed shell presents about half its area to any eye WHICHEVER
 *               shell is drawn — which is the sentence this whole gate exists
 *               because of. The facing test cannot see a reversed closed solid.
 *               Volume can, and does. This was written expecting a fail and the
 *               first run refuted it; the expectation moved to match the
 *               instrument rather than the other way round, because the
 *               instrument was right.
 *
 *   `quad-down` volume DECLINES it, because a quad encloses nothing. Facing and
 *               normals catch it. The volume test cannot see an open surface —
 *               which is where two of this project's three real defects lived.
 *
 * The two exclusions are close to complementary, and that is a property of the
 * two quantities rather than of these two shapes: it is CONTRACT §7.6's rule
 * about the roofline and the width, one metric family over. NO SINGLE TEST
 * VERIFIES BOTH A CLOSED SOLID AND AN OPEN SURFACE, so any claim that a mesh
 * "passed the winding gate" names which test decided it — which is what the
 * `vnf` column is.
 */
export const CONTROL_EXPECTATIONS = {
  'winding:control:good': {
    verdict: 'ok',
    expect: { volume: 'pass', normals: 'pass', facing: 'pass' },
    $why: 'a closed box in three\'s own order. If this fails, the metric rejects everything, ' +
      'which is session 4\'s walkability flood fill and is usually the check being wrong.',
  },
  'winding:control:reversed': {
    verdict: 'bad',
    expect: { volume: 'fail', normals: 'fail', facing: 'pass' },
    $why: 'the same box with each triangle\'s last two corners swapped and its NORMALS swapped ' +
      'with them rather than negated — an outward normal on an inward triangle, which is the ' +
      'defect rather than a mirror. Facing PASSES it and must: half the area faces you either way.',
  },
  'winding:control:quad-up': {
    verdict: 'ok',
    expect: { volume: 'declined', normals: 'pass', facing: 'pass' },
    $why: 'the road surface as `buildGround` emits it today.',
  },
  'winding:control:quad-down': {
    verdict: 'bad',
    expect: { volume: 'declined', normals: 'fail', facing: 'fail' },
    $why: 'the road surface as it shipped for thirteen sessions: (x0,z0) (x1,z0) (x1,z1) with ' +
      '(0,1,0) at every vertex. CONTRACT §9 row 26.',
  },
};

/**
 * Fold a per-eye census into one row per geometry.
 *
 * `volume`, `normals` and closedness are properties of the geometry and are
 * identical at every eye, so they are taken from the first census that carries
 * the row. `facing` is a property of the placement AND the eye, so it is kept
 * per eye and reduced by MAXIMUM — see the header on why the max and not the
 * mean.
 */
export function foldCensuses(censuses) {
  const byName = new Map();
  for (const c of censuses) {
    for (const r of c.rows) {
      let rec = byName.get(r.name);
      if (!rec) {
        rec = { ...r, facingByEye: [], names: [r.name] };
        byName.set(r.name, rec);
      } else {
        /**
         * The same mesh seen at a second eye. `city:ground` and `city:signs`
         * are REBUILT on a chunk crossing, so the geometry behind one name
         * genuinely differs between eyes — and the row keeps the WORST reading
         * of each geometry test rather than the last one, because a mesh that
         * was correct at one pose and backwards at another is backwards.
         */
        rec.instances = Math.max(rec.instances, r.instances);
        rec.mirroredInstances = Math.max(rec.mirroredInstances, r.mirroredInstances);
        rec.mirroredObjects = Math.max(rec.mirroredObjects, r.mirroredObjects);
        rec.tris = Math.max(rec.tris, r.tris);
        rec.signedVolume = Math.min(rec.signedVolume, r.signedVolume);
        rec.closed = rec.closed === true && r.closed === true ? true
          : rec.closed === null || r.closed === null ? null : false;
        rec.openEdges = Math.max(rec.openEdges, r.openEdges);
        rec.normalsDerived = rec.normalsDerived || r.normalsDerived;
        rec.hasNormals = rec.hasNormals && r.hasNormals;
        if (r.normalAgreement != null) {
          rec.normalAgreement = rec.normalAgreement == null
            ? r.normalAgreement
            : Math.min(rec.normalAgreement, r.normalAgreement);
        }
      }
      if (r.frontFacing != null) rec.facingByEye.push({ eye: c.eye, f: r.frontFacing });
    }
  }
  for (const rec of byName.values()) {
    rec.eyes = rec.facingByEye.length;
    rec.facingMax = rec.eyes ? Math.max(...rec.facingByEye.map((e) => e.f)) : null;
    rec.facingMin = rec.eyes ? Math.min(...rec.facingByEye.map((e) => e.f)) : null;
    delete rec.frontFacing;
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The verdict for one folded row.
 *
 * Returns `{ verdict, tests, reasons }` where `tests` maps each of the three to
 * `'pass' | 'fail' | 'declined'`. `declined` is not `pass`: a test that could
 * not run has said nothing, and the difference between those two is CONTRACT
 * §7.1's whole subject.
 */
export function judge(row, T) {
  const tests = { volume: 'declined', normals: 'declined', facing: 'declined' };
  const reasons = [];

  /**
   * A DOUBLE-SIDED MATERIAL DOES NOT CULL, so its winding cannot make it
   * invisible and none of the three tests is a statement about anything a
   * person sees. Reported, never asserted. Two meshes in the project are here:
   * the sky background and the rain layers.
   */
  if (row.side === 'double') {
    return { verdict: 'n/a', tests, reasons: ['DoubleSide — winding is not culled'] };
  }

  /**
   * MIRRORING, IN TWO KINDS, BECAUSE THREE COMPENSATES FOR ONE OF THEM.
   *
   * The first version of this file had one count and called it "drawn
   * inside-out", which is CONTRACT §9's own failure mode inside the instrument
   * meant to find it: a determinant computed correctly and then used as a
   * statement about the rasteriser, which it is only half of. Read out of
   * three's source (`WebGLRenderer.renderBufferDirect` → `frontFaceCW`,
   * `WebGLState.setMaterial` → `flipSided`, `defaultnormal_vertex`):
   *
   *   MIRRORED OBJECT — `matrixWorld.determinant() < 0`. three flips the
   *     winding convention for the whole draw, so the face is rasterised the
   *     right way round. It does NOT flip the normal: `normalMatrix` is the
   *     inverse transpose and leaves a normal perpendicular to the mirror axis
   *     exactly where it was, and `FLIP_SIDED` comes from `material.side` and
   *     never from `frontFaceCW`. So the surface is VISIBLE AND LIT FROM THE
   *     WRONG SIDE. Symptom: a facade-lit sign that is dark when the sun is on
   *     it, not a sign that vanishes.
   *
   *   MIRRORED INSTANCE — a per-instance matrix with a negative determinant.
   *     `matrixWorld` does not contain it, so nothing is compensated: the face
   *     is drawn inside-out AND the normal is mirrored by `im`.
   *
   * Both fail, and the message says which, because a reader who goes looking
   * for an invisible sign when the sign is merely unlit will not find it.
   */
  if (row.mirroredInstances > 0) {
    reasons.push(
      `${row.mirroredInstances} of ${row.instances} INSTANCE matrices have a negative ` +
      `determinant (min ${row.determinantMin.toExponential(2)}): three's frontFaceCW reads ` +
      'matrixWorld, which does not contain the instance matrix, so these are rasterised inside-out'
    );
  }
  if (row.mirroredObjects > 0) {
    reasons.push(
      `${row.mirroredObjects} mesh(es) with this name have a mirroring WORLD matrix ` +
      `(det ${row.determinantMin.toExponential(2)}): three flips the culling and not the ` +
      'normal, so the face is drawn and lit from its far side'
    );
  }

  if (row.closed === true) {
    tests.volume = row.signedVolume > 0 ? 'pass' : 'fail';
    if (tests.volume === 'fail') {
      reasons.push(
        `closed mesh with signed volume ${row.signedVolume.toFixed(4)} m³ — negative is an ` +
        'inward winding, and the divergence theorem is the whole of the argument'
      );
    }
  } else if (row.closed === false) {
    reasons.push(`open mesh (${row.openEdges} unpaired directed edges) — volume declined`);
  } else {
    reasons.push(`${row.tris} triangles: over the closedness budget, volume declined`);
  }

  if (row.hasNormals && !row.normalsDerived && row.normalAgreement != null) {
    tests.normals = row.normalAgreement >= T.minNormalAgreement ? 'pass' : 'fail';
    if (tests.normals === 'fail') {
      reasons.push(
        `${(100 * (1 - row.normalAgreement)).toFixed(1)}% of the shaded area has an authored ` +
        'normal pointing against its own triangle — CONTRACT §9.1, the two statements disagreeing'
      );
    }
  } else if (row.normalsDerived) {
    reasons.push('normals derived from the winding — the normal test is a tautology here');
  } else if (!row.hasNormals) {
    reasons.push('no normal attribute — normal test declined');
  }

  if (row.facingMax != null && row.eyes >= T.minEyes) {
    tests.facing = row.facingMax >= T.minFrontFacing ? 'pass' : 'fail';
    if (tests.facing === 'fail') {
      reasons.push(
        `presents ${(100 * row.facingMax).toFixed(2)}% of its area to the eye at the BEST of ` +
        `${row.eyes} viewpoints — this geometry is submitted every frame and cannot be seen`
      );
    }
    if (row.closed === true && tests.facing === 'pass' && (row.facingMax > T.maxClosedFacing)) {
      reasons.push(
        `closed solid presenting ${(100 * row.facingMax).toFixed(1)}% front-facing area, above ` +
        `the ${(100 * T.maxClosedFacing).toFixed(0)}% a closed shell can reach — reported, not asserted`
      );
    }
  } else {
    reasons.push(`facing measured at ${row.eyes} eye(s), under the ${T.minEyes} required — declined`);
  }

  const failed = Object.values(tests).filter((v) => v === 'fail').length;
  const decided = Object.values(tests).filter((v) => v !== 'declined').length;
  const verdict = failed > 0 || row.mirroredInstances > 0 || row.mirroredObjects > 0 ? 'bad'
    : decided === 0 ? 'unmeasured'
      : 'ok';
  return { verdict, tests, reasons, decided, failed };
}

/** A one-line rendering of a judged row, for the table. */
export function formatRow(row, j) {
  const num = (v, d = 3) => (v == null ? '   —  ' : v.toFixed(d));
  const t = (k) => (j.tests[k] === 'pass' ? '+' : j.tests[k] === 'fail' ? 'X' : '.');
  return [
    row.name.padEnd(26).slice(0, 26),
    String(row.tris).padStart(7),
    String(row.instances).padStart(7),
    (row.closed === true ? 'closed' : row.closed === false ? 'open  ' : ' ?    '),
    (row.signedVolume >= 0 ? ' ' : '') + row.signedVolume.toExponential(2).padStart(9),
    row.normalsDerived ? '  derived' : num(row.normalAgreement, 4).padStart(9),
    num(row.facingMax, 4).padStart(8),
    ` ${t('volume')}${t('normals')}${t('facing')} `,
    j.verdict.padEnd(10),
  ].join(' ');
}

export const TABLE_HEADER = [
  'mesh'.padEnd(26),
  'tris'.padStart(7),
  'inst'.padStart(7),
  'shell ',
  'signedVol'.padStart(9),
  'nrmAgree'.padStart(9),
  'facing'.padStart(8),
  ' vnf ',
  'verdict',
].join(' ');
