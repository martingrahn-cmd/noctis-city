/**
 * silhouette.mjs — what a vehicle LOOKS like, measured off the delivered frame.
 *
 * CONTRACT §7.1, second rule. `trafficLights.minBodyTypes` counts kinds and
 * passed at 5 while all five kinds were boxes; this is the paired assertion
 * that measures the property the count was assumed to carry.
 *
 * THE DIVISION OF LABOUR, AND WHY IT IS THIS ONE. `harness.silhouettes()`
 * returns where the geometry is — the projected corners of every body box of
 * every visible subject, in screenshot pixels. It returns no colour and no
 * verdict. Everything asserted on comes out of `page.screenshot()`, the same
 * bytes a person opens. The obvious alternative is a mask render pass, and
 * CONTRACT §8 forbids it for the reason it forbids `showMotion`: a gate that
 * renders its own subject has stopped measuring the frame that ships.
 *
 * THE SILHOUETTE IS A UNION OF PER-BOX HULLS, NOT ONE HULL OF EVERYTHING. The
 * projected outline of a convex solid entirely in front of the eye is exactly
 * the convex hull of its projected vertices, so a per-box hull is exact. The
 * hull of ALL the boxes at once is not: for a body with a glasshouse standing
 * proud of the bonnet it spans the empty wedge between them, and every pixel of
 * that wedge is background being measured as vehicle.
 *
 * ---------------------------------------------------------------------------
 * ONE METRIC WAS WRITTEN, MEASURED, AND THROWN AWAY. It is recorded because the
 * next session should not write it again.
 *
 * The first version of the structure metric was `darkFraction`: the share of
 * the silhouette below 45% of its own 90th percentile. The reasoning was that
 * glazing and a wheel recess are both far darker than paint, so a body with
 * them scores high and a flat box scores near zero. MEASURED ON THE FLAT BOXES
 * THAT PROMPTED ALL OF THIS: 0.646 against a floor of 0.16 — four times green,
 * on the exact content the assertion existed to reject.
 *
 * The reason is that a box in sunlight has one face in the sun and two out of
 * it, so two thirds of its pixels sit below any threshold anchored to the
 * brightest. The metric was measuring WHICH FACE CAUGHT THE SUN, which every
 * convex solid does. It would have shipped green, and a green assertion nobody
 * can fail is the same defect as `minBodyTypes` one level down.
 *
 * WHAT REPLACED IT is `lumaProfileRoughness`, below, and the difference is that
 * it is a statement about the ORDER of the pixels rather than their histogram.
 * ---------------------------------------------------------------------------
 * WHAT THIS STILL CANNOT SEE, MEASURED RATHER THAN SUSPECTED, AND LEFT.
 *
 * There is no depth buffer, so the only occluder that can be subtracted is
 * another SUBJECT. Two kinds of occlusion therefore survive, and both were
 * found by rendering a failing subject's mask over the frame and looking at it:
 *
 *   - NON-SUBJECT GEOMETRY. A kerb, a stall, a railing, a lamp post. The
 *     band-visibility check below catches the common case — a crowd standing in
 *     front of a distant vehicle — because pedestrians ARE subjects, and it
 *     took the vehicle pass fraction from 0.72 to 0.82 on the same frames.
 *   - A SUBJECT'S OWN FAR BOXES. A hauler seen from behind hides its cab behind
 *     its trailer, and because the mask is a UNION the cab's hull still claims
 *     the pixels beside the trailer where the street shows through. Painting a
 *     subject's boxes nearest-first does not fix this: a union is a union
 *     whatever order it is built in. It needs a per-box depth from the harness
 *     and a real hidden-surface test between a subject's own parts.
 *
 * BOTH BIAS THE MEASUREMENT IN THE SAME DIRECTION — they put background into
 * the mask, and background is brighter than a wheel recess, so they LOWER the
 * ground contrast. The floor was not moved to accommodate them: the delivered
 * pass fraction clears 0.75 with them still in. Roughly three of seventeen
 * measured vehicles are affected per pooled sample, which is what the pass
 * fraction rather than the minimum exists to absorb.
 * ---------------------------------------------------------------------------
 */

/** sRGB byte to linear, the exact piecewise curve rather than a 2.2 power. */
const S2L = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  S2L[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Rec.709 luminance of a linear RGB triple. The same primaries §5.2 renders in. */
export const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Andrew's monotone chain. Returns the hull in counter-clockwise order. */
function convexHull(pts) {
  const p = pts.slice().sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Scanline-fill a convex polygon, calling `plot(x, y)` per covered pixel.
 *
 * Convex, so each scanline meets the boundary in exactly one interval and the
 * interval is [min, max] over the edge intersections — no sorting of crossings,
 * no parity rule, no ambiguity about a vertex that sits exactly on a row.
 */
function fillConvex(poly, W, H, plot) {
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const q of poly) {
    if (q[1] < y0) y0 = q[1];
    if (q[1] > y1) y1 = q[1];
  }
  const r0 = Math.max(0, Math.ceil(y0 - 0.5));
  const r1 = Math.min(H - 1, Math.floor(y1 - 0.5));
  for (let y = r0; y <= r1; y++) {
    const yc = y + 0.5;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
        const t = (yc - a[1]) / (b[1] - a[1]);
        const x = a[0] + t * (b[0] - a[0]);
        if (x < lo) lo = x;
        if (x > hi) hi = x;
      }
    }
    if (lo > hi) continue;
    const c0 = Math.max(0, Math.ceil(lo - 0.5));
    const c1 = Math.min(W - 1, Math.floor(hi - 0.5));
    for (let x = c0; x <= c1; x++) plot(x, y);
  }
}

/**
 * Does this convex polygon cover the pixel `(x, y)`?
 *
 * THE SAME RULE `fillConvex` RASTERISES BY, deliberately and not coincidentally.
 * That function plots `(x, y)` when `ceil(lo - 0.5) <= x <= floor(hi - 0.5)` at
 * the row centre, which is exactly `lo <= x + 0.5 <= hi`. The roofline reads
 * SOME of a subject's boxes while the occlusion mask is filled from ALL of
 * them, so the two have to agree about the boundary or a station could report a
 * pixel the mask does not contain. Written as one predicate rather than as a
 * second rasteriser for that reason.
 */
function coversPixel(poly, x, y) {
  const yc = y + 0.5;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
      const t = (yc - a[1]) / (b[1] - a[1]);
      const px = a[0] + t * (b[0] - a[0]);
      if (px < lo) lo = px;
      if (px > hi) hi = px;
    }
  }
  if (lo > hi) return false;
  const xc = x + 0.5;
  return xc >= lo && xc <= hi;
}

/**
 * Does this convex polygon cover the FLOAT image point `(x, y)`?
 *
 * SIGN-AGNOSTIC, so it does not depend on the hull's winding, and it is a
 * DIFFERENT PREDICATE FROM `coversPixel` ABOVE ON PURPOSE. That one quantises to
 * the pixel centre so that the roofline can never report a pixel the rasterised
 * mask does not contain. The width reading has no such obligation and cannot
 * afford the quantisation: the difference it exists to resolve is
 * `minWidthSpan` = 0.10 of a body's own width, which at the far end of
 * `maxDistanceM` is about 6 px of a 65 px probe, so a pixel-centre test would
 * spend a third of the quantity on rounding. The projected hull is a float
 * polygon and the probe point is computed in the subject's own metres, so
 * testing them against each other exactly costs nothing and rounds nothing.
 *
 * The occlusion test stays a pixel lookup, because occlusion IS a property of
 * the rasterised mask — which is what the half-pixel disagreement between the
 * two predicates is worth, and it is bounded by one pixel at each end of a
 * probe that is at least `minLatSegPx` long.
 */
function coversPointExact(poly, x, y) {
  let pos = 0;
  let neg = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (c > 1e-9) pos++;
    else if (c < -1e-9) neg++;
    if (pos && neg) return false;
  }
  return true;
}

/**
 * The image position of the point at parameter `t` along a 3D segment whose two
 * ends project to `(x0,y0)` and `(x1,y1)` at view depths `z0` and `z1`.
 *
 * PERSPECTIVE-CORRECT, AND THAT IS THE WHOLE REASON THE HARNESS SENDS THE TWO
 * DEPTHS. A lateral probe's ends are at different depths — that is what a
 * lateral probe IS, since the lateral axis has a component along the view
 * direction at every angle except exactly end-on — so the image is a rational
 * function of the segment's own parameter and not a linear one. Walking the
 * image uniformly and calling the result a fraction of the probe would put the
 * perspective into the reading as though it were shape, which is the same defect
 * §7.4 avoided by making the roofline segment vertical so that both its ends sit
 * at one depth.
 *
 * The weights are `(1-t)*z0` and `t*z1` over their sum. It is exact for a
 * pinhole camera and it is affine-invariant, so it holds in pixels as well as in
 * NDC: every step from clip space to pixels is affine and shares the denominator.
 */
function segPointAt(x0, y0, z0, x1, y1, z1, t) {
  const w0 = (1 - t) * z0;
  const w1 = t * z1;
  const den = w0 + w1;
  if (!(Math.abs(den) > 1e-9)) return null;
  return [(w0 * x0 + w1 * x1) / den, (w0 * y0 + w1 * y1) / den];
}

const median = (xs) => {
  if (!xs.length) return NaN;
  const s = Float64Array.from(xs).sort();
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};

/**
 * TOTAL VARIATION OVER RANGE, MINUS ONE. The shape of the profile, not its
 * extent.
 *
 * A monotone profile has TV exactly equal to its range and scores 0, whatever
 * its contrast — which is what a flat-sided box produces down every column,
 * with or without a sunlit top face and with or without the §5.7 indirect
 * gradient that makes the bottom of a wall darker than its top. A profile that
 * goes bright, dark, mid, dark — roof, glazing, body side, wheel recess — has
 * TV greater than its range by exactly the amount it doubles back, and doubling
 * back is the thing a single-material box cannot do.
 *
 * Scale-free and exposure-free: multiply every sample by any constant and both
 * TV and range scale with it.
 */
function profileRoughness(profile, floorRange) {
  if (profile.length < 4) return 0;
  let tv = 0;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < profile.length; i++) {
    if (profile[i] < lo) lo = profile[i];
    if (profile[i] > hi) hi = profile[i];
    if (i) tv += Math.abs(profile[i] - profile[i - 1]);
  }
  const range = Math.max(hi - lo, floorRange);
  return Math.max(0, tv / range - 1);
}

/** Nearest-rank with linear interpolation, on an already-sorted array. */
function percentile(sorted, p) {
  if (!sorted.length) return NaN;
  const r = p * (sorted.length - 1);
  const lo = Math.floor(r);
  const hi = Math.min(sorted.length - 1, lo + 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (r - lo);
}

/**
 * THE ROOFLINE, SAMPLED ALONG THE SUBJECT'S OWN LONG AXIS. CONTRACT §7.3.
 *
 * `sub.profile.segments` is what the harness supplied: at each of N stations
 * along the vehicle's length, K image segments running from the bottom of the
 * subject to `overshoot` times its own height, on its longitudinal mid-plane.
 * The harness supplied no colour and no verdict — the reading below is taken
 * from the mask rasterised out of the DELIVERED screenshot's geometry, the same
 * mask every other statistic in this file is taken from.
 *
 * WHAT IS READ AT A STATION: the highest point of the segment that is inside the
 * subject's own mask, as a fraction of the subject's own height. A rectangular
 * prism reads the same number at every station whatever its size, its distance,
 * its heading or which face caught the sun — that invariance is the whole reason
 * this is a segment fraction rather than a pixel height, and it is what makes
 * the statistic below fail on a box by construction rather than by calibration.
 *
 * OCCLUSION IS AN EXCLUSION AND NEVER A READING. If the topmost own-mask pixel
 * at a station is claimed by a NEARER subject, the roofline at that station is
 * behind something and the station is dropped rather than read low — a dropped
 * station cannot manufacture a height change, which is the direction that would
 * make this assertion easier to pass. `minStationFraction` drops the subject
 * when too many stations go, and `minMeasured` in the budget is what stops that
 * from emptying the population quietly.
 *
 * A STATION IS READ AGAINST THE BOXES THAT SPAN IT AND NOT AGAINST THE WHOLE
 * SUBJECT'S UNION. This is the correction of session 6b and it is the reason
 * `P.boxAlong` exists. The first version read the topmost pixel of the union of
 * every one of the subject's own box hulls, and at three-quarter view a tall
 * box's hull is WIDER IN THE IMAGE than the whole trimmed station range — a box
 * of length `l` and width `w` at `theta` from broadside spans
 * `l*cos(theta) + w*sin(theta)`, which grows as the subject turns, against a
 * sampled axis that projects `L*(1-2*trim)*cos(theta)`, which shrinks. So the
 * cabin was read as the roofline at the bonnet's stations and the profile came
 * back FLAT on geometry that was not.
 *
 * MEASURED THROUGH THE WHOLE RENDER PATH, `tools/hullprobe.mjs`: the §7.3
 * three-box positive control scored 0.319 / 0.318 / 0.172 / 0.021 at 0 / 25 /
 * 30 / 39 degrees against a 0.30 floor, and the same shape with its width taken
 * from 1.80 m to 0.02 m — no lateral hull span, everything else identical —
 * held 0.344 to 0.349 at every angle out to 65. At three-quarter view a prism,
 * a reference-era saloon and the delivered wedge all returned about 0.02.
 * THREE SHAPES, ONE ANSWER, which is `$DISCARDED_darkFraction`'s defect one
 * level down: in the mask rather than in the statistic.
 *
 * WHY NOT A DEPTH-ORDERED MASK, which is the obvious repair and cannot work.
 * `own` is a UNION and the reading is set membership in it; ordering the pixels
 * by depth gives each an owner and changes the set by nothing, so it cannot
 * move `roofSpan` by any amount. Nor is there a spurious pixel to remove: the
 * projected outline of a convex box IS the hull of its projected vertices, so
 * those pixels genuinely are cabin. What was wrong was attributing a pixel
 * above station `a` to station `a`.
 *
 * IT IS STILL THE DELIVERED PROJECTION AND NOT THE BODY TABLE. The harness
 * supplies where each box's own geometry reaches along the subject's own axis,
 * taken off the same instance matrices the polygons are projected from — not
 * off `BODY_TYPES`. §9.1: a gate that reads config verifies the config.
 *
 * IT MOVES READINGS IN THE LENIENT DIRECTION, which is what §0 rule 5 exists to
 * be suspicious of — the delivered wedge goes from 0.021 to about 0.208. NO
 * THRESHOLD MOVES, and the guard against an instrument that got quieter is that
 * §7.3's controls are now run over a SWEEP of view angles rather than at one
 * view: the negative direction has to hold at every angle too, and a prism
 * scored 0.000 to 0.014 across the whole sweep. See `measureShapeControl`.
 */
function measureRoofProfile(sub, hulls, occluded, W, H, cfg) {
  const P = sub.profile;
  if (!P || !Array.isArray(P.segments) || !P.segments.length) return null;
  /**
   * NO `boxAlong` MEANS NO READING, RATHER THAN A READING TAKEN THE OLD WAY.
   * A harness that has not been updated is a harness whose roofline cannot be
   * trusted, and silently falling back to the union would be this project's
   * oldest failure — a check that went quiet being indistinguishable from a
   * check that passed (§7.1). Dropping the subject makes `minProfileMeasured`
   * go red, which is loud.
   */
  if (!Array.isArray(P.boxAlong) || P.boxAlong.length !== hulls.length) return null;
  if (!Array.isArray(P.stationAlong) || P.stationAlong.length !== P.segments.length) return null;
  /**
   * A LONG AXIS THAT PROJECTS TO NOTHING IS NOT A LONG AXIS. A vehicle seen
   * end-on has its whole length inside a few columns, and a roofline squeezed
   * into them is a measurement of the resampler. `minStationPx` is 4, which is
   * the third independent arrival of the same number: §5.12 derived it from the
   * TAA 3x3 clamp under half-pixel jitter and `maxDistanceM` derived it from the
   * ground gap's angular size. Excluded on geometry alone, before any pixel is
   * read.
   */
  if (!(P.alongPx >= cfg.minStationPx * P.stations)) return null;

  const N = P.stations;
  const K = Math.max(1, P.subSamples || 1);
  const roof = new Array(N).fill(null);

  for (let i = 0; i < N; i++) {
    let best = null;
    for (let j = 0; j < K; j++) {
      const idxSeg = i * K + j;
      const seg = P.segments[idxSeg];
      if (!seg) continue;
      /**
       * THE BOXES THAT SPAN THIS STATION, and nothing else. A box whose own
       * geometry does not reach this far along the subject cannot be this
       * station's roofline however much of the image its hull covers.
       */
      const a = P.stationAlong[idxSeg];
      const spanning = [];
      for (let b = 0; b < hulls.length; b++) {
        const r = P.boxAlong[b];
        if (a >= r[0] && a <= r[1]) spanning.push(hulls[b]);
      }
      if (!spanning.length) continue;

      const [x0, y0, x1, y1] = seg;
      const len = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.max(8, Math.ceil(len));
      let top = -1;
      let topOccluded = false;
      /**
       * Walked DOWNWARD from the top of the segment and stopped at the first
       * hit, which is the topmost. The previous version walked up and kept the
       * last hit for the same reason — the covered set need not be contiguous
       * down the line, and a motorcycle's is not — and the two are the same
       * answer over the same sample points.
       */
      for (let s = steps; s >= 0; s--) {
        const t = s / steps;
        const x = Math.floor(x0 + (x1 - x0) * t);
        const y = Math.floor(y0 + (y1 - y0) * t);
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        let hit = false;
        for (let k = 0; k < spanning.length; k++) {
          if (coversPixel(spanning[k], x, y)) { hit = true; break; }
        }
        if (!hit) continue;
        top = t;
        topOccluded = !!occluded[y * W + x];
        break;
      }
      if (top < 0 || topOccluded) continue;
      const h = top * P.overshoot;
      if (best === null || h > best) best = h;
    }
    roof[i] = best;
  }

  const used = roof.filter((r) => r != null);
  if (used.length < Math.ceil(cfg.minStationFraction * N)) return null;

  const sorted = Float64Array.from(used).sort();
  const hi = percentile(sorted, 0.9);
  const lo = percentile(sorted, 0.1);

  /**
   * THE LEVELS, single-linkage over the station heights at `levelTolerance`,
   * counting only clusters that occupy `minPlateauFraction` of the surviving
   * stations. REPORTED AND NOT ASSERTED, and the reason is written in
   * budget.json: single linkage chains, so a roofline that RAMPS continuously
   * from a low nose to a high cabin — which is the raked front this section
   * exists to ask for — collapses into one cluster and would be failed by a
   * count for having exactly the property the count was meant to reward. The
   * span below has no such edge and is what carries the assertion.
   */
  const need = Math.max(1, Math.ceil(cfg.minPlateauFraction * used.length));
  let levels = 0;
  let runStart = 0;
  for (let i = 1; i <= sorted.length; i++) {
    if (i === sorted.length || sorted[i] - sorted[i - 1] > cfg.levelTolerance) {
      if (i - runStart >= need) levels++;
      runStart = i;
    }
  }

  return {
    roof: roof.map((r) => (r == null ? null : +r.toFixed(4))),
    stationsUsed: used.length,
    stations: N,
    lengthM: P.lengthM,
    heightM: P.heightM,
    alongPx: P.alongPx,
    /**
     * P90 MINUS P10 OF THE STATION HEIGHTS, in units of the subject's own
     * height. EXACTLY ZERO FOR A RECTANGULAR PRISM from any view, because every
     * station of a prism reads the same fraction of its own height. Percentiles
     * rather than max minus min, so one station that caught a wing mirror or the
     * antialiased edge of a neighbour cannot be the whole finding.
     */
    roofSpan: +(hi - lo).toFixed(4),
    /** How much of the length sits at the roofline. A prism reads 1.000. */
    roofTopFraction: +(used.filter((r) => r >= hi - cfg.levelTolerance).length / used.length).toFixed(3),
    roofLevels: levels,
  };
}

/**
 * THE WIDTH ALONG THE SUBJECT'S OWN LONG AXIS. CONTRACT §7.5.
 *
 * THE CLAIM, AND WHY IT IS NOT A FOURTH PROPERTY. The three metrics above and the
 * roofline all pass on a stack of axis-aligned rectangular prisms that is well
 * coloured, stands on wheels and steps in height — which is exactly what the
 * fleet is. A stack of prisms has CONSTANT WIDTH BY DEFINITION: every corner is
 * 90 degrees, every face is planar, nothing tapers and nothing is chamfered. So
 * this reads the one quantity none of the others looks at, and it reads it the
 * same way the roofline reads height: per station, against the boxes that span
 * that station.
 *
 * WHAT IS READ AT A STATION. The harness supplies a segment ACROSS the subject at
 * `latHeightM`, reaching `latHalfM` either side of the subject's own lateral
 * mid-plane, where `latHalfM` is `widthM/2 * latOvershoot`. The gate walks that
 * segment in ITS OWN PARAMETER — perspective-correctly, from the two endpoint
 * depths — and records the outermost covered parameter at each end. The reading is
 * `(tMax - tMin) * latOvershoot`, which is the covered width IN UNITS OF THE
 * SUBJECT'S OWN MAXIMUM WIDTH. A body of constant width reads the same number at
 * every station, so `widthSpan` is exactly 0.0000 for one — the assertion fails on
 * a prism by construction rather than by calibration, which is the property
 * `$DISCARDED_darkFraction` did not have and the property `roofSpan` has.
 *
 * A STATION IS READ AGAINST THE BOXES THAT SPAN IT ALONG THE AXIS **AND STRADDLE
 * THE PROBE HEIGHT**. The along restriction is session 6b's, unchanged and for the
 * same reason. The height restriction is this metric's own and it is not
 * decoration: a wheel's lateral centre sits at nearly the body's own half-width
 * and its along extent is short, so at a wheel station a wheel's hull reaches
 * FURTHER out than the panel above it and the reading would jump. That is a
 * spurious width CHANGE, in the lenient direction — the metric would reward a
 * body for having wheels rather than for tapering. `profile.boxUp` is what
 * excludes them, and it also excludes the glazing above and the sill below, so
 * what is measured is the body side and nothing else.
 *
 * ---------------------------------------------------------------------------
 * THE OVER-READ, DERIVED, BECAUSE IT IS THE ONE THING THAT CAN MAKE THIS METRIC
 * LIE AND IT IS THE REASON FOR TWO OF THE FOUR EXCLUSIONS BELOW.
 *
 * There is no depth test between a subject's own parts, so a probe point OUTSIDE
 * the true width can still be covered if some other point of the same box
 * projects to the same image position. Put the camera at the origin looking down
 * -Z, the subject's long axis at `theta` from broadside, and let the probe stand
 * `dh` below the eye at depth `d`. A point at (along a', lateral l', height
 * offset v) has the probe point's image position exactly when
 *
 *     l' = l + (v/dh) * (d*cos(theta) - l)      and      a' = a + (l - l')*tan(theta)
 *
 * Two things fall out of that pair and they point in opposite directions:
 *
 *   - THE HEIGHT TRADE IS FREE. Covering a probe point 0.30 m outside the width
 *     at 25 m needs v = 0.011 m — one centimetre — and every box here is at
 *     least 0.20 m tall. So there is no bounding this by height.
 *   - THE ALONG TRADE IS BOUNDED BY THE BOX'S OWN LENGTH. `a'` must stay inside
 *     the box, so the over-read on the plus side is at most (boxEnd - a)*cot(theta)
 *     and on the minus side (a - boxStart)*cot(theta). TOTAL OVER-READ IS
 *     THEREFORE `boxLength * cot(theta)`, WHATEVER THE STATION.
 *
 * The second is why this works at all: a constant additive inflation cancels out
 * of a P90-minus-P10 span. A body whose parts are all the same length along the
 * axis reads `(trueWidth_i + boxLength*cot(theta))/maxWidth` at station i, and
 * the span of that is the span of the true widths, EXACTLY, at any angle where
 * the probe is long enough to contain it. What does NOT cancel is a spread in
 * box lengths — a bonnet of 1.85 m beside a rear deck of 1.45 m inflates their
 * two stations by different amounts, and a constant-width body can report a span
 * it does not have. `maxWidthBias` is the bound on that, `biasSpread` is the
 * measurement of it, and both are printed.
 *
 * WHAT THAT MAKES THIS METRIC: A NEAR-END-ON READING, and the roofline is a
 * broadside one. `cot(theta)` goes to zero as the subject turns end-on, which is
 * exactly where the roofline's own long axis projects under `minStationPx` and it
 * declines. The two populations are close to complementary, which is a finding
 * rather than a convenience and is why each carries its own `minMeasured`.
 * ---------------------------------------------------------------------------
 *
 * FOUR EXCLUSIONS, ALL COMPUTED FROM GEOMETRY BEFORE ANY VERDICT, ALL IN THE
 * DIRECTION THAT MAKES THE ASSERTION HARDER TO PASS:
 *
 *   1. NO SPANNING-AND-STRADDLING BOX — nothing to read. The station is dropped.
 *   2. THE PROBE PROJECTS UNDER `minLatSegPx` — at broadside the lateral axis
 *      points down the line of sight and projects to nothing, and a width read
 *      off a handful of columns is a measurement of the resampler. Dropped on
 *      geometry, exactly as `minStationPx` drops an end-on roofline.
 *   3. THE READING SATURATES — the covered interval reaches an END of the probe,
 *      so the over-read exceeded `latOvershoot` and what came back is a lower
 *      bound rather than a reading. Dropped. This is what excludes low angles for
 *      a body whose parts ARE uniform, where `biasSpread` is zero and would
 *      otherwise admit everything.
 *   4. THE OUTERMOST COVERED POINT IS CLAIMED BY A NEARER SUBJECT — the width at
 *      that station is behind something. Dropped rather than read narrow, because
 *      a dropped station cannot manufacture a width change and a station read
 *      narrow can. Same choice, same reason, as the roofline's.
 *
 * IT IS A STATISTIC ABOUT WHERE THE DELIVERED GEOMETRY PROJECTS, NOT ABOUT WHAT
 * THE FRAME SHOWS, AND SAYING SO IS §7.4's OWN CORRECTION APPLIED IN ADVANCE.
 * This function is handed hulls and an occlusion mask and never indexes the
 * decoded PNG. What makes it a measurement of the delivered artefact rather than
 * of the body-type table is that every polygon comes off the live instance
 * matrices (§9.1) — the same standing this file's `measureRoofProfile` has, and
 * the block's `$mechanism` claimed otherwise once already.
 */
function measureWidthProfile(sub, hulls, occluded, W, H, cfg) {
  const P = sub.profile;
  if (!P || !Array.isArray(P.latSegments) || !P.latSegments.length) return null;
  /**
   * NO `boxUp` MEANS NO READING, RATHER THAN A READING TAKEN WITHOUT IT. §7.1: a
   * harness that has not been updated must make a floor go red, which is loud,
   * rather than fall back to a reading that includes the wheels, which is quiet
   * and lenient.
   */
  if (!Array.isArray(P.boxUp) || P.boxUp.length !== hulls.length) return null;
  if (!Array.isArray(P.boxAlong) || P.boxAlong.length !== hulls.length) return null;
  if (!Array.isArray(P.stationAlong) || P.stationAlong.length !== P.latSegments.length) return null;
  if (!(P.latHalfM > 0) || !(P.widthM > 0) || !(P.latOvershoot > 1)) return null;

  const N = P.stations;
  const K = Math.max(1, P.subSamples || 1);
  const wide = new Array(N).fill(null);
  const biasAt = new Array(N).fill(null);
  const perspAt = new Array(N).fill(null);
  let latPxMin = Infinity;

  // Pixels of projected axis per metre of the subject's own length. The lateral
  // counterpart is computed per station below, and their ratio is cot(theta):
  // one goes as cos(theta) and the other as sin(theta) off the same local scale.
  const alongSpanM = P.lengthM * (1 - 2 * cfg.trim);
  const pxPerMAlong = alongSpanM > 1e-6 ? P.alongPx / alongSpanM : 0;

  for (let i = 0; i < N; i++) {
    const readings = [];
    const biases = [];
    const persps = [];
    for (let j = 0; j < K; j++) {
      const idx = i * K + j;
      const seg = P.latSegments[idx];
      const zs = P.latZ && P.latZ[idx];
      if (!seg || !zs || !(zs[0] > 0) || !(zs[1] > 0)) continue;

      const a = P.stationAlong[idx];
      const spanning = [];
      let boxLenM = 0;
      for (let b = 0; b < hulls.length; b++) {
        const r = P.boxAlong[b];
        const u = P.boxUp[b];
        if (a < r[0] || a > r[1]) continue;
        if (P.latHeightM < u[0] || P.latHeightM > u[1]) continue;
        spanning.push(hulls[b]);
        boxLenM = Math.max(boxLenM, r[1] - r[0]);
      }
      if (!spanning.length) continue;

      const [x0, y0, x1, y1] = seg;
      const latPx = Math.hypot(x1 - x0, y1 - y0);
      if (latPx < latPxMin) latPxMin = latPx;
      if (!(latPx >= cfg.minLatSegPx)) continue;

      /**
       * THE WALK IS IN THE PROBE'S OWN PARAMETER AND ITS STEP IS BOUNDED BELOW BY
       * 256 RATHER THAN BY THE PIXEL COUNT. The reading is a float polygon test,
       * so the only quantisation left is the step, and one step is
       * `latOvershoot/steps` of the subject's own width — 0.00625 at 256. A
       * P90-minus-P10 span can lose one step at each end, so 256 puts the walk's
       * contribution to `minWidthSpan`'s margin at 0.0125, which is the 0.013
       * `budget.json` -> `silhouettes.$minWidthSpan` takes off. At 64 it would
       * have been 0.050, which is a third of the floor.
       */
      const steps = Math.min(4096, Math.max(256, Math.ceil(latPx * 4)));
      const covered = (t) => {
        const p = segPointAt(x0, y0, zs[0], x1, y1, zs[1], t);
        if (!p) return null;
        for (let k = 0; k < spanning.length; k++) {
          if (coversPointExact(spanning[k], p[0], p[1])) return p;
        }
        return null;
      };

      let tLo = -1;
      let pLo = null;
      for (let s = 0; s <= steps; s++) {
        const p = covered(s / steps);
        if (p) { tLo = s / steps; pLo = p; break; }
      }
      if (tLo < 0) continue;
      let tHi = -1;
      let pHi = null;
      for (let s = steps; s >= 0; s--) {
        const p = covered(s / steps);
        if (p) { tHi = s / steps; pHi = p; break; }
      }
      if (tHi < 0) continue;
      // Exclusion 3: the probe was not long enough to contain the apparent width.
      if (tLo <= 0 || tHi >= 1) continue;
      // Exclusion 4: the outermost covered point is behind a nearer subject.
      const occl = (p) => {
        const px = Math.floor(p[0]);
        const py = Math.floor(p[1]);
        if (px < 0 || py < 0 || px >= W || py >= H) return true;
        return !!occluded[py * W + px];
      };
      if (occl(pLo) || occl(pHi)) continue;

      readings.push((tHi - tLo) * P.latOvershoot);
      /**
       * `cot(theta)` FROM THE PROJECTION AND NOT FROM A CAMERA POSE. The along
       * axis projects `pxPerMAlong` pixels per metre and the lateral probe
       * projects `latPx/(2*latHalfM)`; the first goes as `cos(theta)` and the
       * second as `sin(theta)` off the same local scale, so their ratio is
       * `cot(theta)` and the scale cancels. At exactly end-on `pxPerMAlong` is
       * zero and so is the bias, which is the right answer rather than a
       * degenerate one: the along trade that produces the over-read needs the
       * along axis to project somewhere.
       */
      const cot = (pxPerMAlong * 2 * P.latHalfM) / latPx;
      biases.push((boxLenM * cot) / P.widthM);
      /**
       * THE OVER-READ'S OWN PERSPECTIVE DRIFT, DERIVED, AND IT IS THE TERM THE
       * FIRST DRAFT OF THIS METRIC DID NOT HAVE. The §7.3.1 sweep is what found
       * it: `segPrism`, a body of exactly constant width, scored 0.0576 at
       * 45 degrees / 15 m where the derivation said 0.0000, and 0.0057 at
       * 75 degrees / 45 m where it said the same thing. A metric whose negative
       * control reads half the floor at one view and a twentieth of it at another
       * has a systematic error, and the honest response is to derive it rather
       * than to raise the floor over it (§0 rule 5).
       *
       * WHERE IT COMES FROM. `$widthOverRead` solves the covering condition to
       * FIRST order and gets `boxLength*cot(theta)`, a constant. Solved exactly,
       * the reach on the plus side of a station at `a` whose box ends at `a1` is
       *
       *     reach+ = [d*cos(theta)*(a1-a) + (w/2)*Q] / (Q + (a1-a)),  Q = a + d*sin(theta)
       *
       * and the minus side is the mirror of it. Expanding to SECOND order, the
       * total picks up a term `-boxLength*cot(theta)*a/(d*sin(theta))` — the
       * over-read shrinks as the station moves along the axis, because `Q` grows.
       * That term is LINEAR IN `a`, so across the trimmed sampled length it
       * spreads the readings by `boxLength*cot(theta)*alongSpan/(d*sin(theta))`,
       * and a P90-minus-P10 span sees 0.8 of a linear ramp.
       *
       * CHECKED AGAINST THE CONTROL RATHER THAN ASSERTED (§9 rule 2). Predicted
       * against measured on `segPrism`: 0.0574 against 0.0576 at 45 deg / 15 m,
       * 0.0347 against 0.0329 at 55 deg / 15 m, 0.0209 against 0.0197 at 65 deg,
       * 0.0192 against 0.0188 at 45 deg / 45 m. The bound is the quantity.
       *
       * `d` is the mean of the probe's two endpoint depths, which is why the
       * harness sends them; `sin(theta)` comes out of the same `cot(theta)` the
       * first-order term uses, so no new input crosses the boundary.
       */
      const sinT = 1 / Math.sqrt(1 + cot * cot);
      const depth = (zs[0] + zs[1]) / 2;
      persps.push(
        depth > 1e-6
          ? (0.8 * boxLenM * cot * alongSpanM) / (depth * sinT) / P.widthM
          : Infinity
      );
    }
    if (!readings.length) continue;
    /**
     * THE MEDIAN OVER SUB-SAMPLES, AND THE ROOFLINE TAKES THE MAXIMUM. The
     * difference is not an inconsistency and it is worth the paragraph, because
     * copying the roofline's aggregator here cost 0.069 of the reference span in
     * the first draft.
     *
     * The roofline's maximum exists to discard a sub-sample that fell in the
     * 0.15 m gap between a hauler's cab and its trailer and read the SILL as the
     * roofline — a spuriously LOW reading, which the maximum throws away. The
     * width has no such case: a sub-sample with no box straddling the probe
     * height contributes nothing at all rather than a narrow reading, so the
     * failure the maximum protects against cannot happen here.
     *
     * What the maximum DOES do here is take the widest point of each 0.33 m band,
     * which pulls every narrowing station toward its wider neighbour. Measured on
     * the reference-era saloon in `WIDTH_TAPER`: span 0.087 under the maximum
     * against 0.156 under the median — the aggregator was eating 44% of the
     * quantity. The direction is conservative, so it was not WRONG, but a floor
     * derived from a reference that the aggregator has flattened is a floor
     * measuring the aggregator.
     *
     * The median of three discards one contaminated sub-sample in either
     * direction, which is the same argument `capture.$estimator_whyMedian` makes
     * about three runs, and it neither sharpens nor compresses the profile.
     */
    wide[i] = median(readings);
    biasAt[i] = median(biases);
    perspAt[i] = median(persps);
  }

  const used = [];
  const bias = [];
  const persp = [];
  for (let i = 0; i < N; i++) {
    if (wide[i] == null) continue;
    used.push(wide[i]);
    bias.push(biasAt[i]);
    persp.push(perspAt[i]);
  }
  if (used.length < Math.ceil(cfg.minStationFraction * N)) return null;

  /**
   * THE TWO WAYS THE OVER-READ CAN PUT A SPAN ON A CONSTANT-WIDTH BODY, ADDED,
   * AND THE SUBJECT IS DECLINED RATHER THAN CORRECTED.
   *
   *   `biasSpread`  the measured spread of the first-order over-read across the
   *                 stations, which is non-zero when the subject's parts differ in
   *                 length along the axis — a 1.85 m bonnet beside a 1.45 m rear
   *                 deck. Measured, not derived.
   *   `perspMax`    the derived second-order drift of a COMMON over-read, which is
   *                 non-zero even when every part is the same length. Derived, and
   *                 checked against the control above.
   *
   * ADDED RATHER THAN MAXED. They are different mechanisms and can both be
   * present, and the sum slightly double-counts because `bias` is computed per
   * station off that station's own projected probe and therefore already carries
   * a little of the drift. Double-counting makes the exclusion fire EARLIER, which
   * is the direction that cannot flatter the content.
   *
   * DECLINED RATHER THAN SUBTRACTED. Subtracting a computed bias from a measured
   * reading would make the reading partly a calculation, and a calculation that
   * over-corrected would MANUFACTURE a span — the lenient direction, on a metric
   * whose whole job is to refuse one.
   */
  const biasSpread = Math.max(...bias) - Math.min(...bias);
  const perspMax = Math.max(...persp);
  const biasTotal = biasSpread + perspMax;
  if (!(biasTotal <= cfg.maxWidthBias)) {
    return {
      declined: 'bias',
      biasSpread: +biasSpread.toFixed(4),
      perspMax: +perspMax.toFixed(4),
      biasTotal: +biasTotal.toFixed(4),
      biasMax: +Math.max(...bias).toFixed(4),
      stationsUsed: used.length,
      stations: N,
      latPxMin: Number.isFinite(latPxMin) ? +latPxMin.toFixed(1) : null,
    };
  }

  const sorted = Float64Array.from(used).sort();
  const hi = percentile(sorted, 0.9);
  const lo = percentile(sorted, 0.1);

  return {
    wide: wide.map((r) => (r == null ? null : +r.toFixed(4))),
    stationsUsed: used.length,
    stations: N,
    widthM: P.widthM,
    latHeightM: P.latHeightM,
    latOvershoot: P.latOvershoot,
    latPxMin: Number.isFinite(latPxMin) ? +latPxMin.toFixed(1) : null,
    biasSpread: +biasSpread.toFixed(4),
    perspMax: +perspMax.toFixed(4),
    biasTotal: +biasTotal.toFixed(4),
    biasMax: +Math.max(...bias).toFixed(4),
    /**
     * P90 MINUS P10 OF THE STATION WIDTHS, in units of the subject's own maximum
     * width. EXACTLY ZERO FOR A BODY OF CONSTANT WIDTH from any admissible view,
     * because the over-read is a constant additive term and cancels out of a
     * difference of percentiles. Percentiles rather than max minus min for the
     * same reason as `roofSpan`: one station that caught a mirror or a neighbour's
     * antialiased edge must not be the whole finding. Readings above 1.000 are
     * expected and are the over-read, not an error.
     */
    widthSpan: +(hi - lo).toFixed(4),
    /** How much of the length sits at the widest reading. A prism reads 1.000. */
    widthTopFraction: +(used.filter((r) => r >= hi - cfg.levelTolerance).length / used.length).toFixed(3),
    widthMedian: +median(used).toFixed(4),
  };
}

/**
 * A METRIC THAT MEASURES A PROPERTY OF A SHAPE IS CHECKED AGAINST A SHAPE THAT
 * HAS THE PROPERTY AND ONE THAT DOES NOT. CONTRACT §7.3.
 *
 * This is the rule the discarded `darkFraction` did not have. That metric was
 * measured against the boxes it existed to reject and scored 0.646 against a
 * 0.16 floor, and the only reason anybody found out is that §7.1 says to confirm
 * red before building. NOBODY HAD A POSITIVE CONTROL — nothing in the project
 * had ever fed the metric a shape that HAD the property, so nothing could have
 * shown that its two answers were the same answer.
 *
 * THE FIRST VERSION OF THIS CONTROL WAS TWO-DIMENSIONAL AND THAT IS WHY IT
 * MISSED THE DEFECT SESSION 6b FOUND. It rasterised an ORTHOGRAPHIC SIDE
 * ELEVATION: axis-aligned rectangles painted straight into a byte mask,
 * vertical station segments, no camera, no width, no convex hull, and no union
 * of overlapping hulls. It controlled the STATISTIC — given a mask and the
 * segments, does the number separate a prism from a profiled body — and its own
 * header said so. It had never exercised the mask-BUILDING path, and that is
 * the path production uses. §7.3 says the control goes through the same code
 * path; the render path is part of the code path.
 *
 * SO THE CONTROL NOW BUILDS REAL BOXES AND LOOKS AT THEM FROM A REAL ANGLE.
 * `boxes` is `[centreAlong, len, wide, height, centreHeight]` in metres; the
 * eight corners of each are projected through a pinhole camera, hulled with the
 * SAME `convexHull` the gate uses, and read by the SAME `measureRoofProfile`.
 * `runShapeControls` sweeps `angleDeg` and `distanceM` and requires BOTH
 * directions at EVERY view — which is the check that would have caught the
 * union, because the positive control passed at broadside and collapsed to
 * 0.021 at 39 degrees.
 *
 * THE PROJECTION HERE IS STILL A SECOND COPY OF THE HARNESS'S AND STILL
 * DELIBERATELY SO. A control that shared the projection could not fail when the
 * projection was wrong. What it now shares with production is the part that was
 * wrong: the hulls, their union, and the reading off them.
 *
 * `fovYDeg` DEFAULTS TO 60 BECAUSE THAT IS WHAT `highway_speed` DELIVERS —
 * `camera.js` gives the route `fov: 60`, not the 50 the camera is constructed
 * with. `budget.json` -> `silhouettes.$maxDistanceM` derives its 60 m from
 * `2*tan(25 deg)/1440`, which is the 50. See `$fovYDrift` there.
 */
export function measureShapeControl(boxes, cfg, opts = {}) {
  const W = opts.width || 2560;
  const H = opts.height || 1440;
  const fovY = ((opts.fovYDeg || 60) * Math.PI) / 180;
  const d = opts.distanceM || 25;
  const th = ((opts.angleDeg || 0) * Math.PI) / 180;
  const OVER = cfg.overshoot;
  const N = cfg.stations;
  const K = cfg.subSamples;

  /**
   * THETA IS FROM BROADSIDE: 0 puts the long axis across the line of sight and
   * 90 puts it along it. The camera sits at the origin looking down -Z, so
   * `fwd` at theta = 0 is the world X axis.
   */
  const fwd = [Math.cos(th), 0, -Math.sin(th)];
  const up = [0, 1, 0];
  const right = [fwd[2], 0, -fwd[0]];
  const O = [0, -1.5, -d];

  const f = (H / 2) / Math.tan(fovY / 2);
  // The view depth comes back as a third element, for the same reason the
  // harness's projector returns it: the width probe's two ends are at different
  // depths and the gate has to walk it in its own parameter. §7.5.
  const project = (a, u, l) => {
    const x = O[0] + fwd[0] * a + up[0] * u + right[0] * l;
    const y = O[1] + fwd[1] * a + up[1] * u + right[1] * l;
    const z = O[2] + fwd[2] * a + up[2] * u + right[2] * l;
    const zv = -z;
    return [W / 2 + (x / zv) * f, H / 2 - (y / zv) * f, zv];
  };

  const hulls = [];
  const boxAlong = [];
  const boxUp = [];
  let a0 = Infinity; let a1 = -Infinity;
  let u0 = Infinity; let u1 = -Infinity;
  let l0 = Infinity; let l1 = -Infinity;
  for (const [along, len, wide, h, cy] of boxes) {
    const pts = [];
    for (const sa of [-1, 1]) {
      for (const su of [-1, 1]) {
        for (const sl of [-1, 1]) {
          pts.push(project(along + (sa * len) / 2, cy + (su * h) / 2, (sl * wide) / 2));
        }
      }
    }
    hulls.push(convexHull(pts));
    boxAlong.push([along - len / 2, along + len / 2]);
    boxUp.push([cy - h / 2, cy + h / 2]);
    if (along - len / 2 < a0) a0 = along - len / 2;
    if (along + len / 2 > a1) a1 = along + len / 2;
    if (cy - h / 2 < u0) u0 = cy - h / 2;
    if (cy + h / 2 > u1) u1 = cy + h / 2;
    if (-wide / 2 < l0) l0 = -wide / 2;
    if (wide / 2 > l1) l1 = wide / 2;
  }

  const lengthM = a1 - a0;
  const heightM = u1 - u0;
  const widthM = l1 - l0;
  const LATOVER = cfg.latOvershoot || 1.60;
  const LATH = cfg.latHeight != null ? cfg.latHeight : 0.50;
  const latHalfM = (widthM / 2) * LATOVER;
  const latHeightM = u0 + heightM * LATH;
  const aLo = a0 + lengthM * cfg.trim;
  const aHi = a1 - lengthM * cfg.trim;
  const band = (aHi - aLo) / N;
  const segments = [];
  const stationAlong = [];
  const latSegments = [];
  const latZ = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < K; j++) {
      const a = aLo + band * (i + (j + 0.5) / K);
      const b = project(a, u0, 0);
      const t = project(a, u0 + heightM * OVER, 0);
      segments.push([b[0], b[1], t[0], t[1]]);
      stationAlong.push(a);
      const p0 = project(a, latHeightM, -latHalfM);
      const p1 = project(a, latHeightM, latHalfM);
      latSegments.push([p0[0], p0[1], p1[0], p1[1]]);
      latZ.push([p0[2], p1[2]]);
    }
  }
  const e0 = project(aLo, u0, 0);
  const e1 = project(aHi, u0, 0);

  const sub = {
    profile: {
      stations: N, subSamples: K, overshoot: OVER,
      lengthM, heightM, widthM,
      alongPx: Math.hypot(e1[0] - e0[0], e1[1] - e0[1]),
      segments, boxAlong, boxUp, stationAlong,
      latOvershoot: LATOVER, latHalfM, latHeightM, latHeightFraction: LATH,
      latSegments, latZ,
    },
  };
  const zero = ZERO_OCCLUSION(W * H);
  /**
   * BOTH READINGS OFF ONE PLACEMENT, RETURNED AS A PAIR AND NEVER COLLAPSED INTO
   * ONE.
   *
   * The two metrics decline at OPPOSITE ends of the same sweep — the roofline
   * where the subject's long axis stops projecting, the width where its lateral
   * axis has not started — so `roof` being null says nothing about `width` and
   * vice versa. An earlier draft returned the roof profile with the width hung on
   * it, which made "no roofline here" and "no reading at all here" the same value
   * and would have crashed §7.3's sweep on the views where only the width is
   * measurable. Two named fields, and each caller checks its own.
   */
  return {
    roof: measureRoofProfile(sub, hulls, zero, W, H, cfg),
    width: measureWidthProfile(sub, hulls, zero, W, H, cfg),
  };
}

/**
 * One shared all-zero occlusion mask. The control has one subject, so nothing
 * can occlude it; allocating 3.7 MB for each of the sweep's several dozen views
 * would be the only expensive thing in `--falsify`.
 */
let zeroBuf = null;
function ZERO_OCCLUSION(n) {
  if (!zeroBuf || zeroBuf.length < n) zeroBuf = new Uint8Array(n);
  return zeroBuf;
}

/** A §7.3 side elevation to the box form: every step standing on the ground. */
export function stepsToBoxes(steps, wideM) {
  const len = Math.max(...steps.map((s) => s[1]));
  return steps.map(([s0, s1, h]) => [(s0 + s1) / 2 - len / 2, s1 - s0, wideM, h, h / 2]);
}

/**
 * THE TWO CONTROL SHAPES, written here beside the metric they control rather
 * than in the gate, which is where §7.1 says a falsifying case belongs.
 *
 * NEGATIVE: a rectangular prism, which is what `perf-out/highway_speed-u0_85.png`
 * delivers fifteen of. POSITIVE: reference-era three-box proportions — a bonnet
 * at 0.93 m, a cabin at 1.42 m and a rear deck at 1.14 m, which is a 1995 saloon
 * measured off its own side elevation and is where `minRoofSpan` comes from.
 *
 * STILL SIDE ELEVATIONS, `[alongStart, alongEnd, height]`, because that is what
 * a reference is measured off and it is what CONTRACT §7.3 quotes. The width
 * the control gives them is `shapeControlViews.wideM`, and it is not decoration:
 * at 0.02 m these two shapes pass the sweep at every angle, and at 1.80 m the
 * old reading collapsed. The width is the axis the defect lived on.
 */
export const SHAPE_CONTROLS = {
  prism: [[0.00, 4.90, 1.42]],
  threeBox: [[0.00, 1.47, 0.93], [1.47, 3.43, 1.42], [3.43, 4.90, 1.14]],
};

/**
 * THE WIDTH CONTROLS. CONTRACT §7.3 and §7.5, and there are FOUR of them because
 * the naive pair could not have attributed the answer.
 *
 * §7.3 asks for a shape that has the property and one that does not. For the
 * roofline the negative control is a prism and that is the whole story. For the
 * width it is not, and the reason is the over-read `measureWidthProfile` derives:
 * a subject's own box lets a probe point `boxLength * cot(theta)` outside the true
 * width find a covering point, so a body's reading depends on HOW LONG ITS PARTS
 * ARE as well as on how wide they are. A one-box prism and a many-segment tapered
 * loft differ in both at once, and a pair made of those two proves nothing:
 * the metric would separate them whether or not it can see taper.
 *
 * So the pair that carries the verdict is `segPrism` against `taper` — THE SAME
 * SEGMENTATION, THE SAME LENGTH, THE SAME MAXIMUM WIDTH, differing in the width
 * profile and in nothing else. That is the same construction as `hullprobe`'s
 * 0.02 m arm, which attributed the union defect to the lateral hull span by
 * holding everything but the width fixed.
 *
 *   segPrism   negative, and the one the floor is judged against. 14 equal
 *              segments at a constant 1.80 m. Reads its own over-read at every
 *              station, so its span is 0.0000 by construction.
 *   taper      positive. The same 14 segments, plan-tapered — see `WIDTH_TAPER`
 *              for where the profile comes from.
 *   longPrism  attribution. ONE box, 4.90 m, 1.80 m wide: the structure the
 *              delivered fleet has. Its over-read is 4.90*cot(theta) rather than
 *              0.35*cot(theta), so it saturates the probe and declines over most
 *              of the sweep — which is the honest statement that a body made of
 *              long boxes cannot be measured this way except near end-on, and it
 *              is why the fleet's own red has to be read at the end-on views.
 *   stepPrism  attribution, and the one that matters most. THREE segments at the
 *              delivered wedge's own along-lengths — bonnet 1.85, cabin 1.60, rear
 *              deck 1.45, which is every box of that body that straddles the probe
 *              height — at a CONSTANT width and a constant height. UNEQUAL PART
 *              LENGTHS ARE EXACTLY THE CASE WHERE THE OVER-READ DOES NOT CANCEL
 *              OUT OF THE SPAN, so this is the shape that could make a
 *              constant-width body read as tapered: 0.40 m of length spread times
 *              cot(theta), which at 45 degrees is 0.22 of the body's own width
 *              against a 0.12 floor. It must stay under the floor or decline at
 *              every view, and `maxWidthBias` is the bound that makes it decline.
 *              The wedge's glazing and its 4.30 m sill are NOT here, because
 *              neither straddles the probe height in the delivered geometry and
 *              including them would have given every station the same 4.30 m
 *              maximum and a bias spread of zero — an attribution control that
 *              controlled nothing.
 *
 * `[centreAlong, len, wide, height, centreHeight]`, the general form, because a
 * width control needs per-box widths and §7.3's side-elevation `steps` form
 * cannot express one.
 */
const WIDTH_SEGMENTS = 14;
const WIDTH_LENGTH_M = 4.90;
const WIDTH_MAX_M = 1.80;
const WIDTH_HEIGHT_M = 1.42;

/**
 * THE PLAN HALF-WIDTH OF THE POSITIVE CONTROL, AS A FRACTION OF ITS MAXIMUM, AND
 * IT IS A REFERENCE-ERA SALOON RATHER THAN THE FLEET THIS SESSION WILL BUILD.
 *
 * Measured off the plan view of a 4.90 m x 1.80 m three-box saloon at door-handle
 * height: the body holds full width from the front wheel arch to the rear one —
 * about the middle half of the length — and narrows into a radiused bumper corner
 * at each end, the front slightly tighter than the rear. The 14 entries are the
 * segment centres over the whole 4.90 m, so the outer ones fall inside the 10%
 * `trim` discarded at each end.
 *
 * INDEXED FROM THE REAR FORWARD, because `uniformSegments` maps index 0 to the
 * most negative `centreAlong` and `traffic.js`'s convention is that +along is the
 * FRONT. So the last entry, 0.72, is the nose. Written down because the array
 * reads like a nose-first list and is not one.
 *
 * WHY A REFERENCE AND NOT THE DELIVERED BODY: `minWidthSpan` is derived from this
 * profile, and a floor derived from what the session delivers is a floor fitted to
 * it (§0 rule 5). The arithmetic is in `budget.json` -> `silhouettes.$minWidthSpan`
 * and the two must be read together.
 */
const WIDTH_TAPER = [
  0.76, 0.84, 0.91, 0.96, 0.99, 1.00, 1.00, 1.00, 1.00, 0.98, 0.94, 0.88, 0.80, 0.72,
];

function uniformSegments(widths) {
  const n = widths.length;
  const len = WIDTH_LENGTH_M / n;
  return widths.map((w, i) => [
    -WIDTH_LENGTH_M / 2 + len * (i + 0.5),
    len,
    WIDTH_MAX_M * w,
    WIDTH_HEIGHT_M,
    WIDTH_HEIGHT_M / 2,
  ]);
}

export const WIDTH_CONTROLS = {
  segPrism: uniformSegments(new Array(WIDTH_SEGMENTS).fill(1)),
  taper: uniformSegments(WIDTH_TAPER),
  longPrism: [[0, WIDTH_LENGTH_M, WIDTH_MAX_M, WIDTH_HEIGHT_M, WIDTH_HEIGHT_M / 2]],
  /**
   * The delivered wedge's own along-lengths and centres, at a constant width and a
   * constant height. TRANSCRIBED ON PURPOSE AND LABELLED AS FROZEN, which is the
   * lesson session 6b's `hullprobe` labels record: this is a CONTROL for the
   * metric — "unequal part lengths, no taper" — and not a reading of the fleet.
   * The fleet is read by `perfcheck` off the live instance matrices and by
   * `hullprobe`'s live-BODY_TYPES arm; if `traffic.js` changes, these five numbers
   * are still the falsifying case they were written to be.
   */
  stepPrism: [
    [1.525, 1.85, WIDTH_MAX_M, WIDTH_HEIGHT_M, WIDTH_HEIGHT_M / 2],
    [-0.20, 1.60, WIDTH_MAX_M, WIDTH_HEIGHT_M, WIDTH_HEIGHT_M / 2],
    [-1.725, 1.45, WIDTH_MAX_M, WIDTH_HEIGHT_M, WIDTH_HEIGHT_M / 2],
  ],
};

/** Box-smooth in place-safe fashion. `w` is forced odd and at least 3. */
function smooth(xs, w) {
  const k = Math.max(3, w | 1);
  const h = k >> 1;
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    let s = 0;
    let n = 0;
    for (let j = Math.max(0, i - h); j <= Math.min(xs.length - 1, i + h); j++) { s += xs[j]; n++; }
    out[i] = s / n;
  }
  return out;
}

/** Screen AABB of a subject, from every box it owns. */
function subjectAABB(sub) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const box of sub.boxes) {
    for (let i = 0; i < box.length; i += 2) {
      if (box[i] < x0) x0 = box[i];
      if (box[i] > x1) x1 = box[i];
      if (box[i + 1] < y0) y0 = box[i + 1];
      if (box[i + 1] > y1) y1 = box[i + 1];
    }
  }
  return [x0, y0, x1, y1];
}

/**
 * Measure one subject against the frame.
 *
 * `occluded` carries every pixel already claimed by a NEARER subject and those
 * pixels are excluded rather than the subject being dropped. There is no depth
 * buffer here — asking for one would mean a second pass over the geometry — so
 * this handles the only occluder the instrument can see, which is another
 * subject. A queue of vehicles down a street is the common case and dropping
 * every one of them but the first, which the first version of this did, left
 * two measurable vehicles out of fourteen.
 */
function measureSubject(sub, png, occluded, cfg) {
  const { width: W, height: H, channels: ch, data } = png;
  const aabb = subjectAABB(sub);
  const w = aabb[2] - aabb[0];
  const h = aabb[3] - aabb[1];
  if (!(w > 0) || !(h > 0)) return null;

  const own = new Uint8Array(W * H);
  let ownArea = 0;
  /**
   * KEPT, because the roofline reads the boxes that span a station rather than
   * the union of all of them and therefore needs them individually. Everything
   * else on this subject — the ground band, the tone profile, the width profile
   * — is about the whole silhouette and reads the union, which is what `own`
   * still is.
   */
  const hulls = [];
  for (const box of sub.boxes) {
    const pts = [];
    for (let i = 0; i < box.length; i += 2) pts.push([box[i], box[i + 1]]);
    const hull = convexHull(pts);
    hulls.push(hull);
    fillConvex(hull, W, H, (x, y) => {
      const i = y * W + x;
      if (!own[i]) { own[i] = 1; ownArea++; }
    });
  }
  if (!ownArea) return null;

  const x0 = Math.max(0, Math.floor(aabb[0]));
  const x1 = Math.min(W - 1, Math.ceil(aabb[2]));
  const y0 = Math.max(0, Math.floor(aabb[1]));
  const y1 = Math.min(H - 1, Math.ceil(aabb[3]));

  const rows = y1 - y0 + 1;
  const rowLum = [];
  const rowCount = new Float64Array(rows);
  for (let i = 0; i < rows; i++) rowLum.push([]);

  const ground = [];
  const bodyL = [];
  let bodyR = 0; let bodyG = 0; let bodyB = 0;
  let visible = 0;
  /**
   * THE SAME BAND BEFORE ANYTHING IS SUBTRACTED. A subject can be 82% visible
   * overall and have its ground band 85% hidden — a hauler thirty metres away
   * with a crowd in front of it is exactly that, and what survives in the band
   * is the PAVEMENT SEEN BETWEEN PEOPLE'S LEGS. Measured on one: 948 surviving
   * pixels out of a 6240-pixel band, and a ground contrast of -0.561, on a
   * vehicle whose wheels are the darkest thing in the frame and are simply not
   * in it.
   *
   * That is the blind spot this file's header names — occlusion by anything
   * that is not itself a subject — arriving in the one place it does the most
   * damage. It cannot be seen directly without a depth buffer, but its
   * SYMPTOM can: a band whose own pixels have mostly gone is a band nobody
   * should be judged on.
   */
  let ownGround = 0;
  let ownBody = 0;

  const groundTop = aabb[3] - h * cfg.groundBandFraction;
  const bodyTop = aabb[1] + h * cfg.bodyBand[0];
  const bodyBot = aabb[1] + h * cfg.bodyBand[1];

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (!own[i]) continue;
      const yBand = y + 0.5;
      if (yBand >= groundTop) ownGround++;
      if (yBand >= bodyTop && yBand <= bodyBot) ownBody++;
      if (occluded[i]) continue;
      visible++;
      const p = i * ch;
      const r = S2L[data[p]];
      const g = S2L[data[p + 1]];
      const b = S2L[data[p + 2]];
      const L = luma(r, g, b);
      rowLum[y - y0].push(L);
      rowCount[y - y0]++;
      const yc = y + 0.5;
      if (yc >= groundTop) ground.push(L);
      if (yc >= bodyTop && yc <= bodyBot) {
        bodyL.push(L);
        bodyR += r; bodyG += g; bodyB += b;
      }
    }
  }

  const visibleFraction = visible / ownArea;
  /**
   * EVERY BAND THE SUBJECT IS JUDGED ON MUST BE AS VISIBLE AS THE SUBJECT IS.
   * Same threshold as `minVisibleFraction` and deliberately not a new one: the
   * claim is identical one level down, and a second constant would be a second
   * thing to derive. NOTE THE DIRECTION — this EXCLUDES subjects from the
   * population rather than passing them, and the criterion is computed from
   * masks alone and never touches a luminance, so it cannot become "drop the
   * ones that fail". `minMeasured` is what stops it excluding everything.
   */
  const groundVisible = ownGround ? ground.length / ownGround : 0;
  const bodyVisible = ownBody ? bodyL.length / ownBody : 0;
  if (
    visible < (cfg.minAreaPx || 0) ||
    visibleFraction < cfg.minVisibleFraction ||
    groundVisible < cfg.minVisibleFraction ||
    bodyVisible < cfg.minVisibleFraction ||
    ground.length < cfg.minRowSamples ||
    bodyL.length < cfg.minRowSamples
  ) return null;

  /**
   * ROW MEDIANS AND NOT ROW MEANS. A row of a three-quarter view crosses a lit
   * face and a shaded one, and the mean of those two slides continuously as
   * the vehicle turns, which would put a rotation into a metric that is
   * supposed to be about the body. The median is whichever face owns the row,
   * and it is constant down a box's side — which is exactly the profile a box
   * has to produce for `profileRoughness` to score it zero.
   */
  const lumProfile = [];
  const widProfile = [];
  for (let i = 0; i < rows; i++) {
    if (rowCount[i] < cfg.minRowSamples) continue;
    lumProfile.push(median(rowLum[i]));
    widProfile.push(rowCount[i]);
  }
  if (lumProfile.length < 8) return null;

  const win = Math.max(3, Math.round(lumProfile.length / 24));
  const lumS = smooth(lumProfile, win);
  const widS = smooth(widProfile, win);

  const bodyLuma = median(bodyL);
  const groundLuma = median(ground);
  const sum = bodyR + bodyG + bodyB;

  /**
   * The roofline. `null` when the harness declared no long axis for this kind,
   * when the axis projects to fewer than `minStationPx` per station, or when
   * too many stations are behind a nearer subject. NULL DROPS THE SUBJECT FROM
   * THE PROFILE POPULATION AND NOT FROM THE OTHERS: the ground gap and the tone
   * profile are readable on a vehicle seen end-on and the roofline is not, and
   * failing the whole subject would throw away three good measurements to
   * protect one that was never taken.
   */
  const profile = measureRoofProfile(sub, hulls, occluded, W, H, cfg);
  /**
   * The width along the axis, §7.5. `null` for the same class of reasons the
   * roofline is null and for one more of its own — a subject at broadside has a
   * lateral axis that projects to nothing. ITS POPULATION IS NOT THE ROOFLINE'S
   * and the two are counted separately: `cot(theta)` vanishes end-on, where the
   * roofline's own axis has stopped projecting, so the subject that is measurable
   * for one is often the subject that is not measurable for the other.
   */
  const widthAlong = measureWidthProfile(sub, hulls, occluded, W, H, cfg);

  return {
    kind: sub.kind,
    profile,
    widthAlong,
    near: sub.near,
    /** Screen AABB, so an operator can crop the frame and LOOK at a subject. */
    aabb: aabb.map((v) => Math.round(v)),
    areaPx: visible,
    visibleFraction: +visibleFraction.toFixed(3),
    widthPx: +w.toFixed(1),
    heightPx: +h.toFixed(1),
    bodyLuma,
    groundLuma,
    /**
     * ONE MINUS THE RATIO, so a bigger number is a better vehicle and the
     * assertion is a floor like every other content assertion in this project.
     */
    groundContrast: bodyLuma > 1e-6 ? 1 - groundLuma / bodyLuma : 0,
    /**
     * The tone profile doubling back. Roof bright, glazing dark, body mid,
     * wheels dark: a box cannot produce it with one material and flat faces.
     * The range floor is a fraction of the body luminance, so a subject whose
     * whole profile is within noise of flat cannot divide by nearly zero and
     * report a large number.
     */
    lumaProfileRoughness: profileRoughness(lumS, bodyLuma * cfg.profileRangeFloor),
    /**
     * The same statistic on the SHAPE. Narrow head, wide shoulders, two legs
     * with a gap: a width profile that doubles back. A slab is a rectangle and
     * scores 0. This is the pedestrian assertion — a person has no ground
     * clearance and no glazing, and what separates one from a bollard is an
     * outline.
     */
    widthProfileRoughness: profileRoughness(widS, Math.max(...widProfile) * cfg.profileRangeFloor),
    /** Chromaticity of the body band. Neutral is (1/3, 1/3) by construction. */
    chroma: sum > 1e-9 ? [bodyR / sum, bodyB / sum] : [1 / 3, 1 / 3],
  };
}

/**
 * Count distinguishable body chromaticities across the population.
 *
 * CHROMATICITY AND NOT COLOUR, and the reason is the failure this is here to
 * catch. Two vehicles differ in delivered luminance for two quite different
 * causes: their paint differs, or one of them is in shade. A cluster count that
 * used luminance would therefore pass a fleet of identical grey boxes parked
 * half in sunlight, which is the exact frame that prompted the assertion.
 * Chromaticity is invariant to the sun going behind a building; it is not
 * invariant to the paint.
 *
 * `epsilon` is the distance in (r, b) chromaticity below which two paints are
 * called the same. Single linkage, so the count is the number of connected
 * components and a palette smeared evenly along one axis does not score as many
 * clusters as its endpoints suggest.
 */
export function chromaClusters(chromas, epsilon) {
  const n = chromas.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const e2 = epsilon * epsilon;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dr = chromas[i][0] - chromas[j][0];
      const db = chromas[i][1] - chromas[j][1];
      if (dr * dr + db * db <= e2) parent[find(i)] = find(j);
    }
  }
  return new Set(Array.from({ length: n }, (_, i) => find(i))).size;
}

/**
 * Measure every subject the harness reported against the frame it was reported
 * for, POOLED OVER SEVERAL SAMPLES OF THE SAME ROUTE.
 *
 * `samples` is a list of `{ silh, png }`, one per camera pose. The end of a
 * route is one camera position and a content assertion read off it is a claim
 * about wherever the path happened to stop — deterministic, because the route
 * is, and still a sample of one. Pooling three poses of the same route triples
 * the population and removes the lottery, which is the same correction this
 * session makes to the frame-time estimator one system across.
 *
 * Returns per-kind populations; asserting is the gate's job.
 */
export function measureSilhouettes(samples, cfg, keepPerSubject) {
  if (!Array.isArray(samples) || !samples.length) {
    return { error: 'no silhouette samples were taken' };
  }
  const byKind = {};
  let seen = 0;
  let eligibleN = 0;

  for (const { silh, png } of samples) {
    if (!silh || !Array.isArray(silh.subjects)) {
      return { error: 'harness.silhouettes() is missing or returned no subject list' };
    }
    if (silh.width !== png.width || silh.height !== png.height) {
      // The whole method is projecting geometry into the pixel grid of a
      // specific image. Two grids is CONTRACT §9's shape exactly — a number
      // computed correctly against one quantity and used against another — so
      // it is a hard error rather than a budget failure.
      return {
        error:
          `harness.silhouettes() projected into ${silh.width}x${silh.height} but the screenshot is ` +
          `${png.width}x${png.height}; every polygon would be measured against the wrong pixels`,
      };
    }

    const occluded = new Uint8Array(png.width * png.height);
    const eligible = silh.subjects
      .filter((s) => s.near > 0 && s.near <= cfg.maxDistanceM)
      .sort((a, b) => a.near - b.near);
    seen += silh.subjects.length;
    eligibleN += eligible.length;

    for (const s of eligible) {
      const cf = cfg.kinds[s.kind];
      if (!cf) continue;
      const m = measureSubject(s, png, occluded, { ...cfg, ...cf });
      // Whether or not it was measurable, everything it covers is now behind
      // something for every subject further away.
      for (const box of s.boxes) {
        const pts = [];
        for (let i = 0; i < box.length; i += 2) pts.push([box[i], box[i + 1]]);
        fillConvex(convexHull(pts), png.width, png.height, (x, y) => { occluded[y * png.width + x] = 1; });
      }
      if (m) { m.sample = samples.indexOf(samples.find((x) => x.silh === silh)); (byKind[s.kind] = byKind[s.kind] || []).push(m); }
    }
  }

  const out = { kinds: {}, samples: samples.length, seen, eligible: eligibleN, measured: 0 };
  if (keepPerSubject) out.perSubject = Object.values(byKind).flat();
  for (const [kind, pop] of Object.entries(byKind)) {
    const cf = cfg.kinds[kind];
    const gc = pop.map((p) => p.groundContrast);
    const lr = pop.map((p) => p.lumaProfileRoughness);
    const wr = pop.map((p) => p.widthProfileRoughness);
    out.measured += pop.length;
    /**
     * A pass fraction against a threshold that was not declared is not zero and
     * is not one — it is a question nobody asked. `null`, so the gate skips the
     * assertion rather than failing a kind on a claim its budget never made.
     */
    const passFrac = (xs, floor) =>
      floor == null ? null : +(xs.filter((v) => v >= floor).length / pop.length).toFixed(3);
    const stat = (xs) => ({
      median: +median(xs).toFixed(4),
      min: +Math.min(...xs).toFixed(4),
    });
    /**
     * THE PROFILE POPULATION IS ITS OWN POPULATION AND IS COUNTED SEPARATELY.
     * A vehicle seen end-on is measurable for the ground gap and unmeasurable
     * for the roofline, so `nProfile <= n` always, and reporting one number for
     * both would let a route on which nothing is ever seen broadside satisfy
     * the roofline floor with an empty set — the shape §7.1 exists for.
     */
    const prof = pop.map((p) => p.profile).filter(Boolean);
    const rs = prof.map((p) => p.roofSpan);
    /**
     * THE WIDTH POPULATION IS A THIRD POPULATION AND IS COUNTED SEPARATELY, for
     * the same reason the profile one is and with the opposite exclusion: a
     * subject seen BROADSIDE is measurable for the roofline and not for the
     * width, and a subject seen END-ON is measurable for the width and not for
     * the roofline. One count for both would let a route on which nothing is ever
     * seen end-on satisfy the width floor with an empty set. Subjects that were
     * declined for `biasSpread` carry no `widthSpan` and are counted in
     * `nWidthDeclinedBias`, so a population that emptied because the geometry is
     * unmeasurable is distinguishable from one that emptied because the camera
     * never looked.
     */
    const wal = pop.map((p) => p.widthAlong).filter((w) => w && w.widthSpan != null);
    const wsDeclined = pop.filter((p) => p.widthAlong && p.widthAlong.declined).length;
    const ws = wal.map((w) => w.widthSpan);

    out.kinds[kind] = {
      n: pop.length,
      nProfile: prof.length,
      nWidth: wal.length,
      nWidthDeclinedBias: wsDeclined,
      widthSpan: wal.length ? stat(ws) : null,
      widthSpanPassFraction:
        wal.length && cf.minWidthSpan != null
          ? +(ws.filter((v) => v >= cf.minWidthSpan).length / wal.length).toFixed(3)
          : null,
      /** Reported, not asserted: the over-read the exclusion bounds. */
      widthBiasSpread: wal.length ? +median(wal.map((w) => w.biasSpread)).toFixed(4) : null,
      widthTopFraction: wal.length ? +median(wal.map((w) => w.widthTopFraction)).toFixed(3) : null,
      widthLatPxMin: wal.length ? Math.round(Math.min(...wal.map((w) => w.latPxMin || 0))) : null,
      roofSpan: prof.length ? stat(rs) : null,
      roofSpanPassFraction:
        prof.length && cf.minRoofSpan != null
          ? +(rs.filter((v) => v >= cf.minRoofSpan).length / prof.length).toFixed(3)
          : null,
      /** Reported, not asserted. See `measureRoofProfile` on why. */
      roofLevels: prof.length ? +median(prof.map((p) => p.roofLevels)).toFixed(2) : null,
      roofTopFraction: prof.length ? +median(prof.map((p) => p.roofTopFraction)).toFixed(3) : null,
      groundContrast: stat(gc),
      groundContrastPassFraction: passFrac(gc, cf.minGroundContrast),
      lumaRoughness: stat(lr),
      lumaRoughnessPassFraction: passFrac(lr, cf.minLumaRoughness),
      widthRoughness: stat(wr),
      widthRoughnessPassFraction: passFrac(wr, cf.minWidthRoughness),
      chromaClusters: chromaClusters(pop.map((p) => p.chroma), cfg.chromaEpsilon),
      medianAreaPx: Math.round(median(pop.map((p) => p.areaPx))),
      medianVisibleFraction: +median(pop.map((p) => p.visibleFraction)).toFixed(3),
      nearestM: +Math.min(...pop.map((p) => p.near)).toFixed(1),
    };
  }
  return out;
}
