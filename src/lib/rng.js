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
  };
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
