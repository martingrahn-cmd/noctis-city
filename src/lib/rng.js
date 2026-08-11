/**
 * rng.js — deterministic pseudo-random numbers.
 *
 * CONTRACT §6: every random number in the project comes from ctx.rng(stream).
 * Streams are independent so that adding a system cannot shift an existing
 * system's sequence — the tenth building stays where it was when you add
 * street furniture in session 4.
 */

/** FNV-1a, 32-bit. Stable across runs and platforms, unlike hashing objects. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, and good enough that its artefacts are invisible. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convenience wrappers built on a raw generator. */
export function rngHelpers(next) {
  return {
    next,
    /** Uniform in [lo, hi). */
    range: (lo, hi) => lo + next() * (hi - lo),
    /** Integer in [lo, hi]. */
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    /** True with probability p. */
    chance: (p) => next() < p,
    /** Uniform element. */
    pick: (arr) => arr[Math.min(arr.length - 1, Math.floor(next() * arr.length))],
    /**
     * Approximately normal, mean 0, stddev 1 — sum of 3 uniforms, rescaled.
     * Cheap, bounded at ±3σ, which is what you want for placement jitter:
     * an unbounded gaussian eventually puts a building in the road.
     */
    gauss: () => (next() + next() + next() - 1.5) * 2,
    /**
     * Log-normal, by the INVERSE CDF and therefore from EXACTLY ONE uniform.
     * Session 20, for the building height distribution.
     *
     * WHY THE INVERSE CDF AND NOT BOX–MULLER OR `gauss()`. Both of those draw
     * more than one uniform, and a draw count is a position in a stream: every
     * random number after the one that changed would land somewhere else, so
     * changing a distribution would silently re-scatter the props, re-roll the
     * eras and move the signs. CONTRACT §6's determinism rule is about streams
     * being independent; this is the same argument INSIDE a stream. One
     * uniform in, one uniform's worth of stream consumed, and the substitution
     * is confined to the quantity it is about.
     *
     * `gauss()` is also the wrong shape here for a second reason: it is a sum
     * of three uniforms bounded at ±3σ, which is fine for placement jitter (an
     * unbounded normal eventually puts a building in the road) and is exactly
     * wrong for a heavy tail, which is the whole point of a log-normal.
     *
     * @param median  the 50th percentile, in the value's own units
     * @param sigma   the standard deviation of ln(value)
     */
    logNormal: (median, sigma) => median * Math.exp(sigma * normalQuantile(next())),
  };
}

/**
 * Φ⁻¹ — the standard normal quantile. Acklam's rational approximation, whose
 * stated maximum relative error is 1.15e-9 over the open interval, which is
 * eight orders below anything this project measures with it.
 *
 * IT IS CHECKED AGAINST VALUES KNOWN FROM OUTSIDE IT (CONTRACT §7.7): Φ⁻¹(0.5)
 * = 0, Φ⁻¹(0.975) = 1.959964, Φ⁻¹(0.99) = 2.326348, and the function is odd,
 * so Φ⁻¹(p) = −Φ⁻¹(1−p). `tools/parsecheck.mjs` does not run code, so the
 * check lives in `tools/citycheck.mjs --falsify`, beside the assertion that
 * reads the distribution it produces.
 */
const A = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
  1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
const B = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
  6.680131188771972e+01, -1.328068155288572e+01];
const C = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
  -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
const D = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
  3.754408661907416e+00];
const P_LOW = 0.02425;

export function normalQuantile(p) {
  // The open interval. A uniform generator can return exactly 0, and ln(0) is
  // not a height.
  const u = Math.min(1 - 1e-12, Math.max(1e-12, p));
  if (u < P_LOW) {
    const q = Math.sqrt(-2 * Math.log(u));
    return (((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) /
      ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1);
  }
  if (u > 1 - P_LOW) {
    const q = Math.sqrt(-2 * Math.log(1 - u));
    return -(((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) /
      ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1);
  }
  const q = u - 0.5;
  const r = q * q;
  return (((((A[0] * r + A[1]) * r + A[2]) * r + A[3]) * r + A[4]) * r + A[5]) * q /
    (((((B[0] * r + B[1]) * r + B[2]) * r + B[3]) * r + B[4]) * r + 1);
}

/**
 * Weighted pick. weights need not sum to 1.
 * Used for era/condition distributions, which are never uniform.
 */
export function weightedIndex(next, weights) {
  let total = 0;
  for (const w of weights) total += w;
  let r = next() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}
