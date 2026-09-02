/**
 * lookmetrics.mjs — everything the look gate measures, as pure functions.
 *
 * These were inline in lookcheck.mjs through session 1. They are out here now
 * for one reason: tools/gateaudit.mjs feeds them deliberately wrong frames and
 * checks that the thresholds reject them. A threshold that cannot be shown to
 * reject anything is not measuring anything, and there is no way to show that
 * while the measurement and the capture are the same file.
 *
 * Nothing here touches the filesystem, the network or a browser. Input is a
 * decoded PNG; output is numbers.
 *
 * Regions are given as normalised [x0, y0, x1, y1] with y measured downward
 * from the top, so a rect means the same thing at any capture resolution.
 */

export const LUMA_R = 0.2126;
export const LUMA_G = 0.7152;
export const LUMA_B = 0.0722;

export const luma8 = (r, g, b) => (LUMA_R * r + LUMA_G * g + LUMA_B * b) / 255;

/** Pixel bounds of a normalised rect, clamped and guaranteed non-empty. */
export function rectPixels(png, rect) {
  const [x0, y0, x1, y1] = rect;
  const ax0 = Math.max(0, Math.min(png.width - 1, Math.round(x0 * png.width)));
  const ax1 = Math.max(ax0 + 1, Math.min(png.width, Math.round(x1 * png.width)));
  const ay0 = Math.max(0, Math.min(png.height - 1, Math.round(y0 * png.height)));
  const ay1 = Math.max(ay0 + 1, Math.min(png.height, Math.round(y1 * png.height)));
  return { ax0, ay0, ax1, ay1 };
}

/**
 * HSV hue in degrees plus saturation, from 8-bit sRGB. Hue is undefined for a
 * neutral pixel, which is why every hue statistic below is saturation-weighted:
 * a grey pixel has no opinion about hue and must not be allowed to vote.
 */
export function hueSat(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0 || max === 0) return { h: 0, s: 0, v: max / 255 };
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: d / max, v: max / 255 };
}

/** Smallest angle between two hues, in degrees. Hue is circular; 350° and 10° are 20° apart. */
export function angularDistanceDeg(a, b) {
  let d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// ---------------------------------------------------------------------------
// the tonal distribution (session 18)
// ---------------------------------------------------------------------------

/**
 * THE BAND EDGES, DERIVED RATHER THAN PICKED — CONTRACT §9 rule 5.
 *
 * `analyse()` has counted the two ENDS of the distribution since session 1
 * (`clippedWhite` at code ≥ 254, `crushedBlack` at ≤ 2) and has never said
 * anything about the middle. Session 18's night frames are the case that needs
 * it: a frame can be 4.6% clipped and 0.3% crushed — both inside their own
 * bounds — and still have almost nothing between the two, which is exactly what
 * "the dark is very dark and the bright is blown" describes. Two endpoint counts
 * cannot see a hole in the middle, and a mean cannot either: the mean of a
 * bimodal distribution sits where there are no pixels.
 *
 * The middle is the Zone System's TEXTURED range, Zones III to VII, which is the
 * standard photographic definition of "detail a print holds" and is checkable
 * rather than tasteful. Zone V is an 18% diffuse reflector; each zone is a stop.
 * Through the sRGB OETF (`1.055·L^(1/2.4) − 0.055`):
 *
 *     Zone III   L = 0.18/4 = 0.045   → code  59.9
 *     Zone V     L = 0.18            → code 117.7   (the familiar "middle grey is 118")
 *     Zone VII   L = 0.18×4 = 0.72    → code 220.6
 *
 * Computed here from 0.18 and ±2 stops rather than written down as 60 and 221,
 * so the two numbers cannot drift from the definition that produced them.
 */
export const ZONE_V_LINEAR = 0.18;
export const ZONE_TEXTURED_STOPS = 2;

const srgbEncode = (L) => (L <= 0.0031308 ? 12.92 * L : 1.055 * Math.pow(L, 1 / 2.4) - 0.055);

export const TONAL_BANDS = {
  zoneIIILinear: ZONE_V_LINEAR / Math.pow(2, ZONE_TEXTURED_STOPS),
  zoneVLinear: ZONE_V_LINEAR,
  zoneVIILinear: ZONE_V_LINEAR * Math.pow(2, ZONE_TEXTURED_STOPS),
  get lowCode() {
    return srgbEncode(this.zoneIIILinear) * 255;
  },
  get midCode() {
    return srgbEncode(this.zoneVLinear) * 255;
  },
  get highCode() {
    return srgbEncode(this.zoneVIILinear) * 255;
  },
};

/**
 * The whole distribution, not two ends of it.
 *
 * 256 bins on the delivered sRGB luma, because the delivered byte is what a
 * person opens and what every other level statistic in this project reads
 * (CONTRACT §7.2: the paired assertion measures the delivered artefact). A
 * histogram of the HDR buffer would be a statement about the renderer; this is
 * a statement about the frame.
 *
 * Reports, in one place: how much mass is stuck at each end, how much is in the
 * textured middle, and where the quantiles sit. `texturedFraction` is the number
 * the session-18 brief asks for — "mass in the middle rather than at both ends".
 */
export function tonalHistogram(png) {
  const { width, height, channels, data } = png;
  const n = width * height;
  const bins = new Uint32Array(256);

  for (let i = 0, o = 0; i < n; i++, o += channels) {
    const y = luma8(data[o], data[o + 1], data[o + 2]) * 255;
    bins[Math.max(0, Math.min(255, Math.round(y)))]++;
  }

  /** Fraction of pixels with luma at or below `code`. */
  const cdf = new Float64Array(256);
  let acc = 0;
  for (let i = 0; i < 256; i++) {
    acc += bins[i];
    cdf[i] = acc / n;
  }
  const quantile = (q) => {
    for (let i = 0; i < 256; i++) if (cdf[i] >= q) return i;
    return 255;
  };
  const massBetween = (loCode, hiCode) => {
    const lo = Math.max(0, Math.ceil(loCode));
    const hi = Math.min(255, Math.floor(hiCode));
    if (hi < lo) return 0;
    return (cdf[hi] - (lo > 0 ? cdf[lo - 1] : 0));
  };

  const lowCode = TONAL_BANDS.lowCode;
  const highCode = TONAL_BANDS.highCode;

  return {
    bins,
    /** Mass below Zone III — present, but with no texture left in it. */
    shadowFraction: massBetween(0, lowCode - 1),
    /** Zones III–VII. The half of the frame a print can actually hold. */
    texturedFraction: massBetween(lowCode, highCode),
    /** Above Zone VII, on its way to clipping. */
    highlightFraction: massBetween(highCode + 1, 255),
    /** The two ends, at `analyse()`'s own thresholds so the numbers are comparable. */
    crushedFraction: massBetween(0, 2),
    clippedFraction: massBetween(254, 255),
    p01: quantile(0.01),
    p05: quantile(0.05),
    p10: quantile(0.1),
    p25: quantile(0.25),
    p50: quantile(0.5),
    p75: quantile(0.75),
    p90: quantile(0.9),
    p95: quantile(0.95),
    p99: quantile(0.99),
    bandEdges: { lowCode, midCode: TONAL_BANDS.midCode, highCode },
  };
}

// ---------------------------------------------------------------------------
// whole-frame statistics (session 1)
// ---------------------------------------------------------------------------

/**
 * Full-resolution statistics, plus a half-resolution RGB buffer for the
 * measurements where a box-filtered image is the honest one: cluster counting
 * (so single-pixel dither cannot form a component) and frame-to-frame
 * difference (so resampling noise cannot inflate it).
 *
 * Clipping and crush are counted at full resolution, deliberately. Downsampling
 * hides exactly the failure those two are looking for.
 */
export function analyse(png) {
  const { width, height, channels, data } = png;
  const n = width * height;

  let clippedWhite = 0;
  let crushedBlack = 0;
  // Where the crush is matters more than how much of it there is: black sky is
  // a different bug from black facades, and the number alone cannot tell you.
  const crushedBand = [0, 0, 0];
  let sumY = 0;
  let sumY2 = 0;
  let sumRB = 0;

  for (let i = 0, o = 0; i < n; i++, o += channels) {
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    if (r >= 254 && g >= 254 && b >= 254) clippedWhite++;
    if (r <= 2 && g <= 2 && b <= 2) {
      crushedBlack++;
      crushedBand[Math.min(2, Math.floor((i / width / height) * 3))]++;
    }
    const y = luma8(r, g, b);
    sumY += y;
    sumY2 += y * y;
    sumRB += (r - b) / 255;
  }

  const meanY = sumY / n;
  const variance = Math.max(0, sumY2 / n - meanY * meanY);

  const hw = width >> 1;
  const hh = height >> 1;
  const half = new Float32Array(hw * hh * 3);
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < hw; x++) {
      const o0 = ((y * 2) * width + x * 2) * channels;
      const o1 = o0 + channels;
      const o2 = o0 + width * channels;
      const o3 = o2 + channels;
      const d = (y * hw + x) * 3;
      for (let c = 0; c < 3; c++) {
        half[d + c] = (data[o0 + c] + data[o1 + c] + data[o2 + c] + data[o3 + c]) / (4 * 255);
      }
    }
  }

  return {
    width,
    height,
    meanLuminance: meanY,
    stdDev: Math.sqrt(variance),
    clippedWhite: clippedWhite / n,
    crushedBlack: crushedBlack / n,
    crushedBand: crushedBand.map((v) => v / n),
    meanRminusB: sumRB / n,
    half,
    halfW: hw,
    halfH: hh,
    /** Kept so the region metrics below can work from the same object. */
    source: png,
  };
}

/**
 * Connected components that are both bright and chromatic. 8-connectivity,
 * iterative flood fill — a recursive one blows the stack on a 1600×900 frame
 * with a large sky region above threshold.
 */
export function countEmitterClusters(m, cfg) {
  const { half, halfW: w, halfH: h } = m;
  const n = w * h;
  const mask = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    const r = half[i * 3];
    const g = half[i * 3 + 1];
    const b = half[i * 3 + 2];
    const max = Math.max(r, g, b);
    if (max < cfg.value) continue;
    const min = Math.min(r, g, b);
    const sat = (max - min) / Math.max(max, 1e-6);
    if (sat < cfg.saturation) continue;
    mask[i] = 1;
  }

  return floodCount(mask, w, h, cfg.minAreaPx);
}

/**
 * Every 8-connected component of a 0/1 mask, with its area and bounding box.
 *
 * Session 3 split this out of `floodCount`: counting components answers "is
 * there a pattern", and the reflection gate has to ask a second question —
 * "what *shape* is each one" — which needs the box. One traversal, two callers,
 * so the two can never disagree about what a component is.
 *
 * `mask` is consumed (visited cells are marked 2).
 */
function floodComponents(mask, w, h) {
  const n = w * h;
  const stack = new Int32Array(n);
  const out = [];

  for (let start = 0; start < n; start++) {
    if (mask[start] !== 1) continue;
    let sp = 0;
    stack[sp++] = start;
    mask[start] = 2;
    let area = 0;
    let x0 = w;
    let x1 = -1;
    let y0 = h;
    let y1 = -1;

    while (sp > 0) {
      const idx = stack[--sp];
      area++;
      const x = idx % w;
      const y = (idx / w) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const nIdx = ny * w + nx;
          if (mask[nIdx] !== 1) continue;
          mask[nIdx] = 2;
          stack[sp++] = nIdx;
        }
      }
    }

    out.push({ area, x0, x1, y0, y1, width: x1 - x0 + 1, height: y1 - y0 + 1 });
  }

  return out;
}

/** 8-connected component count over a 0/1 mask, plus the largest area found. */
function floodCount(mask, w, h, minAreaPx) {
  let clusters = 0;
  let largest = 0;
  for (const c of floodComponents(mask, w, h)) {
    if (c.area >= minAreaPx) clusters++;
    if (c.area > largest) largest = c.area;
  }
  return { clusters, largest };
}

export function meanSquaredDifference(a, b) {
  if (a.halfW !== b.halfW || a.halfH !== b.halfH) throw new Error('frame size mismatch');
  const n = a.halfW * a.halfH;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const ya = LUMA_R * a.half[i * 3] + LUMA_G * a.half[i * 3 + 1] + LUMA_B * a.half[i * 3 + 2];
    const yb = LUMA_R * b.half[i * 3] + LUMA_G * b.half[i * 3 + 1] + LUMA_B * b.half[i * 3 + 2];
    const d = ya - yb;
    acc += d * d;
  }
  return acc / n;
}

// ---------------------------------------------------------------------------
// region statistics (session 2)
// ---------------------------------------------------------------------------

/**
 * Mean RGB and a sorted luminance ladder over a rect.
 *
 * `blueOverRed` is the noon road's whole problem in one number: a horizontal
 * surface that sees an unoccluded blue sky and nothing else renders with far
 * more blue in it than red, and no amount of exposure fixes that because it is
 * a chromaticity, not a level.
 */
export function regionStats(m, rect) {
  const png = m.source;
  const { channels, data, width } = png;
  const { ax0, ay0, ax1, ay1 } = rectPixels(png, rect);

  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const lum = [];
  for (let y = ay0; y < ay1; y++) {
    for (let x = ax0; x < ax1; x++) {
      const o = (y * width + x) * channels;
      r += data[o];
      g += data[o + 1];
      b += data[o + 2];
      lum.push(luma8(data[o], data[o + 1], data[o + 2]));
      n++;
    }
  }
  lum.sort((p, q) => p - q);
  const pct = (f) => lum[Math.min(lum.length - 1, Math.max(0, Math.round(f * (lum.length - 1))))];

  return {
    pixels: n,
    mean: [r / n, g / n, b / n],
    blueOverRed: b / Math.max(r, 1e-6),
    p05: pct(0.05),
    p50: pct(0.5),
    p95: pct(0.95),
    /**
     * The spread of luminance inside one material's region. On a dry road it is
     * small — one roughness, one response, one value. Water turns the same
     * surface into a mix of near-mirror and near-matte, and that shows up here
     * as a wider spread before it shows up anywhere else.
     */
    spread: pct(0.95) - pct(0.05),
  };
}

/**
 * Saturation-weighted circular hue statistics over a rect.
 *
 * `topQuantile` keeps only the brightest fraction of the rect. On a facade band
 * that is the wall rather than the windows, the sign, the lamp post and the
 * shadow under the canopy — all of which are in the rect and none of which are
 * the surface being asked about.
 *
 * `minValue` drops pixels too dark for hue to mean anything. Below a few counts
 * out of 255, hue is quantisation noise with a direction.
 */
export function regionHue(m, rect, { topQuantile = 1, minValue = 0.02 } = {}) {
  const png = m.source;
  const { channels, data, width } = png;
  const { ax0, ay0, ax1, ay1 } = rectPixels(png, rect);

  let cut = 0;
  if (topQuantile < 1) {
    const lum = [];
    for (let y = ay0; y < ay1; y++) {
      for (let x = ax0; x < ax1; x++) {
        const o = (y * width + x) * channels;
        lum.push(luma8(data[o], data[o + 1], data[o + 2]));
      }
    }
    lum.sort((p, q) => p - q);
    cut = lum[Math.min(lum.length - 1, Math.round((1 - topQuantile) * (lum.length - 1)))];
  }

  let sx = 0;
  let sy = 0;
  let sw = 0;
  let used = 0;
  const total = (ax1 - ax0) * (ay1 - ay0);
  for (let y = ay0; y < ay1; y++) {
    for (let x = ax0; x < ax1; x++) {
      const o = (y * width + x) * channels;
      const R = data[o];
      const G = data[o + 1];
      const B = data[o + 2];
      if (luma8(R, G, B) < cut) continue;
      const { h, s, v } = hueSat(R, G, B);
      if (v < minValue || s <= 0) continue;
      const rad = (h * Math.PI) / 180;
      sx += s * Math.cos(rad);
      sy += s * Math.sin(rad);
      sw += s;
      used++;
    }
  }

  if (sw <= 0 || used === 0) return { hueDeg: 0, spreadDeg: 0, weight: 0, used, total, usedFraction: 0 };

  const meanRad = Math.atan2(sy / sw, sx / sw);
  let hueDeg = (meanRad * 180) / Math.PI;
  if (hueDeg < 0) hueDeg += 360;

  // Circular standard deviation. R → 1 means every pixel agrees about hue,
  // which is what "monochrome amber" looks like as a number.
  const Rlen = Math.min(1, Math.hypot(sx / sw, sy / sw));
  const spreadRad = Math.sqrt(Math.max(0, -2 * Math.log(Math.max(Rlen, 1e-9))));

  return {
    hueDeg,
    spreadDeg: (spreadRad * 180) / Math.PI,
    weight: sw,
    used,
    total,
    /** Resolution-independent: what share of the rect had a hue to contribute. */
    usedFraction: used / total,
  };
}

/**
 * Distinct bright regions on the ground.
 *
 * Threshold is relative to the region's own median, not absolute: a pool of
 * lamplight is defined by being brighter than the road around it, and an
 * absolute floor would either find everything at noon or nothing at midnight.
 * Measured at half resolution so dither cannot form a component.
 */
/**
 * A rect's luminance at half resolution, box-filtered. Shared by every metric
 * that flood-fills the ground, so "a bright region" means one thing.
 */
function regionLumaHalf(png, rect) {
  const { channels, data, width } = png;
  const { ax0, ay0, ax1, ay1 } = rectPixels(png, rect);
  const w = (ax1 - ax0) >> 1;
  const h = (ay1 - ay0) >> 1;
  if (w < 2 || h < 2) return null;

  const buf = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = ax0 + x * 2;
      const py = ay0 + y * 2;
      const o0 = (py * width + px) * channels;
      const o1 = o0 + channels;
      const o2 = o0 + width * channels;
      const o3 = o2 + channels;
      buf[y * w + x] =
        (luma8(data[o0], data[o0 + 1], data[o0 + 2]) +
          luma8(data[o1], data[o1 + 1], data[o1 + 2]) +
          luma8(data[o2], data[o2 + 1], data[o2 + 2]) +
          luma8(data[o3], data[o3 + 1], data[o3 + 2])) /
        4;
    }
  }
  return { buf, w, h };
}

export function countGroundLightPools(m, rect, cfg) {
  const png = m.source;
  const r = regionLumaHalf(png, rect);
  if (!r) return { clusters: 0, largest: 0, threshold: 0, median: 0 };
  const { buf, w, h } = r;

  const sorted = Float32Array.from(buf).sort();
  const median = sorted[sorted.length >> 1];
  const threshold = Math.max(cfg.minAbsolute, median * cfg.overMedian);

  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = buf[i] >= threshold ? 1 : 0;

  const res = floodCount(mask, w, h, cfg.minAreaPx);
  return { ...res, threshold, median };
}

// ---------------------------------------------------------------------------
// session 3
// ---------------------------------------------------------------------------

/**
 * Elongated bright regions on a wet road — the reflections of the emitters
 * above it.
 *
 * A pool of lamplight and a reflection are both "a bright region on the road",
 * and counting components alone cannot tell them apart. What distinguishes a
 * reflection is its *shape*: the mirror image of something standing up from the
 * street, seen at 80-plus degrees of incidence, is stretched along the view
 * direction — which on screen is vertical. So each component has to clear three
 * separate bars:
 *
 *   area          it is not noise
 *   vertical      its bounding box is a real fraction of the frame's height,
 *                 which a sub-pixel specular spike can never be
 *   aspect        it is taller than it is wide
 *
 * The third is what makes this a reflection gate rather than a brightness gate.
 * A road covered in round blobs of lamplight fails it, and so does the frame
 * this session started from, whose "reflections" were single-pixel glints.
 *
 * `minVerticalFrac` is a fraction of the *frame* height, not of the region, so
 * the threshold means the same thing at any capture resolution and does not
 * silently loosen if the region is made taller.
 */
export function countReflectionStreaks(m, rect, cfg) {
  const png = m.source;
  const r = regionLumaHalf(png, rect);
  if (!r) return { streaks: 0, components: 0, rejected: 0, threshold: 0, median: 0, tallestFrac: 0, sample: [] };
  const { buf, w, h } = r;

  const sorted = Float32Array.from(buf).sort();
  const median = sorted[sorted.length >> 1];
  const threshold = Math.max(cfg.minAbsolute, median * cfg.overMedian);

  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = buf[i] >= threshold ? 1 : 0;

  // Half-res rows are two full-res rows, so a component's height in frame
  // fractions is 2·height / png.height.
  const toFrac = 2 / png.height;

  const kept = [];
  let rejected = 0;
  const all = floodComponents(mask, w, h);
  for (const c of all) {
    const vertical = c.height * toFrac;
    const aspect = c.height / Math.max(c.width, 1);
    if (c.area >= cfg.minAreaPx && vertical >= cfg.minVerticalFrac && aspect >= cfg.minAspect) {
      kept.push({ area: c.area, vertical: +vertical.toFixed(4), aspect: +aspect.toFixed(2) });
    } else if (c.area >= cfg.minAreaPx) {
      rejected++;
    }
  }
  kept.sort((a, b) => b.area - a.area);

  return {
    streaks: kept.length,
    components: all.length,
    /** Bright enough and big enough, but round or short — a pool, or a spike. */
    rejected,
    threshold,
    median,
    tallestFrac: kept.length ? kept[0].vertical : 0,
    sample: kept.slice(0, 6),
  };
}

/**
 * The wall of a facade patch, as one colour.
 *
 * A trimmed mean between two luminance quantiles of the patch's own
 * distribution. Below `wallLow` are the windows and whatever is in shadow;
 * above `wallHigh` are the emitters — a sign face, a lamp bowl, a sliver of
 * sky. Between them, on a patch that is mostly one building's wall, is the
 * wall.
 *
 * Session 3 wrote this the obvious way first — keep the bright pixels, drop
 * the saturated ones, on the grounds that neon is saturated and concrete is
 * not — and it was wrong in a way worth recording, because it looked right.
 * Brick under a dusk sky is *more* saturated than a green neon tube: measured,
 * 0.72 against a cap set at 0.55. The filter meant to exclude signage excluded
 * the one material in the palette that most needed measuring, reported that 3%
 * of the patch was wall, and computed a colour from the 3%. Nothing about the
 * frame said so. A quantile band assumes only that the patch is mostly wall,
 * which is a property of where the rect was put and can be checked — see
 * `spread` below — rather than a property of what walls are made of.
 *
 * Returned as chromaticity (u, v) plus luminance rather than as RGB, because
 * chromaticity is what survives a change of exposure and luminance is the part
 * that does not — and the assertion weighs them explicitly.
 */
export function wallPatch(m, rect, cfg) {
  const png = m.source;
  const { channels, data, width } = png;
  const { ax0, ay0, ax1, ay1 } = rectPixels(png, rect);

  const lum = [];
  for (let y = ay0; y < ay1; y++) {
    for (let x = ax0; x < ax1; x++) {
      const o = (y * width + x) * channels;
      lum.push(luma8(data[o], data[o + 1], data[o + 2]));
    }
  }
  lum.sort((p, q) => p - q);
  const at = (f) => lum[Math.min(lum.length - 1, Math.max(0, Math.round(f * (lum.length - 1))))];
  const lo = at(cfg.wallLow);
  const hi = at(cfg.wallHigh);
  const median = at(0.5);

  let R = 0;
  let G = 0;
  let B = 0;
  let used = 0;
  for (let y = ay0; y < ay1; y++) {
    for (let x = ax0; x < ax1; x++) {
      const o = (y * width + x) * channels;
      const l = luma8(data[o], data[o + 1], data[o + 2]);
      if (l < lo || l > hi) continue;
      R += data[o];
      G += data[o + 1];
      B += data[o + 2];
      used++;
    }
  }

  const total = (ax1 - ax0) * (ay1 - ay0);
  /**
   * How far the kept band spans, relative to the patch's own middle. On one
   * wall this is the shading gradient across it and is small. On a patch that
   * straddles a sign, a window mullion grid or two buildings it is not, and the
   * colour below is then a blend of things that are not the same surface — so
   * the assertion refuses it rather than reporting the blend.
   */
  const spread = (hi - lo) / Math.max(median, 1e-4);

  if (!used) return { u: 0, v: 0, luma: 0, used: 0, total, spread };
  const mean = [R / used, G / used, B / used];
  const sum = Math.max(mean[0] + mean[1] + mean[2], 1e-6);
  return {
    u: mean[0] / sum,
    v: mean[1] / sum,
    luma: luma8(mean[0], mean[1], mean[2]),
    mean,
    used,
    total,
    spread,
  };
}

/**
 * A patch's position in the space the albedo assertion measures distance in.
 *
 * Two chromaticity axes and one log-luminance axis. Log, because what the eye
 * reads is the *ratio* of two walls' brightness and because a global exposure
 * change then cancels exactly in every distance — the metric cannot be moved by
 * regrading the frame, only by changing what the buildings are made of.
 *
 * `chromaWeight` is the exchange rate between the two: at 10, a chromaticity
 * difference of 0.03 counts the same as a luminance ratio of 2^0.3 ≈ 1.23.
 */
export function patchFeature(p, chromaWeight) {
  return [p.u * chromaWeight, p.v * chromaWeight, Math.log2(Math.max(p.luma, 1e-4))];
}

export function featureDistance(a, b) {
  let acc = 0;
  for (let i = 0; i < a.length; i++) acc += (a[i] - b[i]) * (a[i] - b[i]);
  return Math.sqrt(acc);
}

/**
 * How many distinct groups a set of points falls into, where "distinct" means
 * every member of one group is at least `separation` from every member of any
 * other. Single-linkage, union-find, no iteration count and no initialisation —
 * so the answer does not depend on the order the points arrive in, which a
 * k-means would.
 *
 * Works on any dimension, including one: the floor-height and roughness
 * assertions pass it plain numbers wrapped as `[x]`.
 */
export function clusterCount(points, separation) {
  const n = points.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i) => {
    let r = i;
    while (parent[r] !== r) r = parent[r];
    while (parent[i] !== r) {
      const next = parent[i];
      parent[i] = r;
      i = next;
    }
    return r;
  };
  let closest = Infinity;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = featureDistance(points[i], points[j]);
      if (d < closest) closest = d;
      if (d < separation) {
        const a = find(i);
        const b = find(j);
        if (a !== b) parent[a] = b;
      }
    }
  }
  const roots = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    roots.set(r, (roots.get(r) || 0) + 1);
  }
  return { clusters: roots.size, sizes: [...roots.values()].sort((a, b) => b - a), closest };
}
