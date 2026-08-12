/**
 * vsyncprobe.mjs — NOT A GATE. SESSION 23, item 1.
 *
 * THE VSYNC-LOCK DETECTOR RUN OVER SEQUENCES WHOSE ANSWER IS KNOWN BY
 * CONSTRUCTION, IN BOTH DIRECTIONS.
 *
 * CONTRACT §7.7: *"An instrument is checked against a case whose answer is known
 * from outside the instrument, and the check is written in the same change as
 * the instrument."* And §7.3: a metric that claims to measure a property of a
 * shape is run over a shape that HAS the property and one that does NOT, and
 * both directions are required before the metric is trusted. The shape here is a
 * sequence of frame intervals and the property is *"this period is imposed by a
 * display rather than by the work"*.
 *
 * IT ASSERTS NOTHING AND IT MUST NOT. `hud.js` displays; it does not gate. There
 * is no threshold in the project that reads this, so a gate case here would be
 * inventing an assertion in order to have something to falsify — which is the
 * opposite of §7.1's point. What this does is make the detector's two directions
 * REPRODUCIBLE, the same arrangement `clustercheck` has with `perfcheck` and
 * `motioncheck` has with §5.11.
 *
 * NO BROWSER, NO GPU, NO RENDERER. Every input is synthesised here and the
 * detector is pure, so this runs anywhere and its numbers are counts.
 *
 *   node tools/vsyncprobe.mjs
 *   node tools/vsyncprobe.mjs --verbose
 */

import { HUD } from '../src/core/constants.js';
import { detectVsyncLock, bandCensored, pct } from '../src/modules/hud.js';
import { mulberry32 } from '../src/lib/rng.js';

const VERBOSE = process.argv.includes('--verbose');

const W = HUD.budgets.wallFrameMsP95;
const C = HUD.budgets.cpuFrameMsP95;

/** Seeded, because CONTRACT §6 forbids `Math.random()` and a control that moves is not a control. */
const rng = mulberry32(1337);
const jitter = (amp) => (rng() - 0.5) * 2 * amp;
const spread = (lo, hi) => lo + rng() * (hi - lo);

/**
 * A LOCKED SEQUENCE. `n` frames at period `T`, of which `dropped` are delivered
 * a whole period late — which is what a missed vsync IS, and the reason a lock
 * is detectable at all: the late frame lands on 2T rather than on 1.3T.
 *
 * `jitterMs` is the compositor's own wobble about the grid. 0.15 ms is a sixth
 * of the 1.00 ms tolerance `HUD.vsync.tolFrac` admits at 60 Hz, so a correctly
 * delivered frame is on the grid with margin rather than by rounding.
 */
function locked(n, T, dropped = 0, jitterMs = 0.15) {
  const out = [];
  const every = dropped > 0 ? Math.floor(n / dropped) : 0;
  for (let i = 0; i < n; i++) {
    const m = every > 0 && i > 0 && i % every === 0 ? 2 : 1;
    out.push(m * T + jitter(jitterMs));
  }
  return out;
}

/** An UNLOCKED sequence: a continuous spread, which is what an unthrottled machine delivers. */
function unlocked(n, lo, hi) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(spread(lo, hi));
  return out;
}

const constant = (n, v, amp = 0) => Array.from({ length: n }, () => v + jitter(amp));

/**
 * The cases. `expectLock` is written down BEFORE the detector runs, from the
 * construction of the sequence and not from what the detector said about it —
 * that is the whole of §7.7's rule. Where an expectation and the instrument
 * disagree, the run says which of the two was wrong rather than quietly
 * adopting the instrument's answer (§7.7's second consequence).
 */
const CASES = [
  {
    name: '60 Hz held',
    why: 'the operator\'s own reading: a browser on a 60 Hz display, city well inside budget',
    intervals: locked(240, 1000 / 60),
    callbacks: constant(240, 4.1, 0.4),
    trueT: 1000 / 60,
    expectLock: true,
    expectP50Band: 'h',
    note: 'p50 16.7: work in (0, 16.67], the 12.5 ceiling is INSIDE that band — no verdict',
  },
  {
    name: '60 Hz, 1 frame in 10 dropped',
    why: 'a lock that is being missed — the one thing a locked context can still resolve',
    intervals: locked(240, 1000 / 60, 24),
    trueT: 1000 / 60,
    callbacks: constant(240, 4.1, 0.4),
    expectLock: true,
    expectP95Band: 'r',
    note: 'p95 33.3: m = 2, so work > 16.67 > 12.5 — a breach, certainly, and it stays RED',
  },
  {
    name: '120 Hz held',
    why: 'THE POSITIVE DIRECTION. The same rule must turn the cell GREEN where the lock proves the work',
    intervals: locked(240, 1000 / 120),
    trueT: 1000 / 120,
    callbacks: constant(240, 4.1, 0.4),
    expectLock: true,
    expectP50Band: 'g',
    note: 'p50 8.33: work in (0, 8.33], entirely under 12.5 — the lock PROVES the ceiling is met',
  },
  {
    name: 'unlocked, inside the ceiling',
    why: 'a gate-style run (--disable-gpu-vsync), comfortably under budget',
    intervals: unlocked(240, 7.5, 10.5),
    callbacks: unlocked(240, 7.0, 9.8),
    expectLock: false,
    expectP50Band: 'g',
    note: 'no lock, so the ordinary comparison stands and it is green on its own merits',
  },
  {
    name: 'unlocked, BREACHING',
    why: 'THE NEGATIVE DIRECTION THAT MATTERS. A genuinely slow machine must not be excused as locked',
    intervals: unlocked(240, 13.0, 19.0),
    callbacks: unlocked(240, 12.6, 18.0),
    expectLock: false,
    expectP50Band: 'r',
    note: 'not quantised AND the callback fills the period — both conditions refuse, the red survives',
  },
  {
    name: 'too few samples',
    why: 'a panel opened half a second ago must not claim a lock it has not seen',
    intervals: locked(30, 1000 / 60),
    trueT: 1000 / 60,
    callbacks: constant(30, 4.1, 0.4),
    expectLock: false,
    note: `30 < HUD.vsync.minSamples (${HUD.vsync.minSamples})`,
  },
  {
    name: 'steady GPU-bound at 20 ms, vsync OFF',
    why: 'THE DECLARED LIMIT, run rather than merely written down',
    intervals: constant(240, 20.0, 0.2),
    trueT: 20.0,
    callbacks: constant(240, 4.0, 0.3),
    expectLock: true,
    limit: true,
    note: 'reported as a 50.0 Hz lock. `callback` cannot see GPU time, so the detector cannot '
      + 'tell this from a display lock — it prints the period so a reader on a 60 Hz display can',
  },
];

let disagreements = 0;

console.log('vsyncprobe — the lock detector over sequences whose answer is known by construction');
console.log(`  ceilings: wallFrameMsP95 ${W} ms, cpuFrameMsP95 ${C} ms`);
console.log(`  HUD.vsync: minSamples ${HUD.vsync.minSamples}, tolFrac ${HUD.vsync.tolFrac}, `
  + `lockedFraction ${HUD.vsync.lockedFraction}, maxDutyFraction ${HUD.vsync.maxDutyFraction}`);
console.log('');

for (const c of CASES) {
  const lock = detectVsyncLock(c.intervals, c.callbacks);
  const p50 = pct(c.intervals, 0.5);
  const p95 = pct(c.intervals, 0.95);
  const bandOf = (v) => (lock ? bandCensored(v, lock.periodMs, W) : plainBand(v, W));
  const got = { lock: !!lock, p50Band: bandOf(p50), p95Band: bandOf(p95) };

  const bad = [];
  if (got.lock !== c.expectLock) bad.push(`lock ${got.lock} expected ${c.expectLock}`);
  if (c.expectP50Band && got.p50Band !== c.expectP50Band) {
    bad.push(`p50 band ${got.p50Band} expected ${c.expectP50Band}`);
  }
  if (c.expectP95Band && got.p95Band !== c.expectP95Band) {
    bad.push(`p95 band ${got.p95Band} expected ${c.expectP95Band}`);
  }
  if (bad.length) disagreements++;

  const mark = bad.length ? 'DISAGREES' : (c.limit ? 'limit' : 'as constructed');
  console.log(`${bad.length ? 'x' : (c.limit ? '!' : 'v')} ${c.name}`);
  console.log(`    ${c.why}`);
  console.log(`    p50 ${p50.toFixed(2)} ms  p95 ${p95.toFixed(2)} ms  `
    + `cpu p95 ${pct(c.callbacks, 0.95).toFixed(2)} ms`);
  console.log(`    lock ${lock ? `YES  T ${lock.periodMs.toFixed(3)} ms (${lock.hz.toFixed(1)} Hz)  `
    + `onGrid ${(lock.onGrid * 100).toFixed(1)}%  duty ${(lock.duty * 100).toFixed(1)}%` : 'no'}`);
  // CONTRACT §9 rule 2: the period recovered, beside the period it was built at.
  if (lock && c.trueT) {
    const err = lock.periodMs - c.trueT;
    console.log(`    period  built ${c.trueT.toFixed(3)} ms (${(1000 / c.trueT).toFixed(1)} Hz)  `
      + `recovered ${lock.periodMs.toFixed(3)} ms (${lock.hz.toFixed(1)} Hz)  `
      + `error ${err >= 0 ? '+' : ''}${err.toFixed(3)} ms (${((err / c.trueT) * 100).toFixed(2)}%)`);
  }
  console.log(`    bands: p50 ${legend(got.p50Band)}  p95 ${legend(got.p95Band)}   [${mark}]`);
  console.log(`    ${c.note}`);
  if (bad.length) console.log(`    -> ${bad.join('; ')}`);
  console.log('');
}

/** `hud.js`'s ordinary band, restated here so the no-lock path is exercised too. */
function plainBand(value, ceiling) {
  if (!(ceiling > 0)) return 'h';
  if (value > ceiling) return 'r';
  if (value >= ceiling * HUD.amberFraction) return 'a';
  return 'g';
}

function legend(b) {
  return { g: 'GREEN', a: 'AMBER', r: 'RED', h: 'neutral (no verdict)' }[b] || b;
}

/**
 * THE TOLERANCE'S OWN ARITHMETIC, CHECKED RATHER THAN QUOTED. `HUD.vsync`'s
 * derivation claims that bands of width `2·tolFrac·T` repeating every `T` cover
 * 12% of the line, so an UNQUANTISED distribution lands on the grid about 12% of
 * the time by luck, against the 0.90 required. CONTRACT §9 rule 2: a number
 * derived one way is printed beside the same number measured another.
 */
{
  const T = 1000 / 60;
  const tol = HUD.vsync.tolFrac * T;
  const n = 20000;
  let onGrid = 0;
  for (let i = 0; i < n; i++) {
    const v = spread(T, 3 * T);
    const m = Math.round(v / T);
    if (m >= 1 && Math.abs(v - m * T) <= tol) onGrid++;
  }
  const predicted = 2 * HUD.vsync.tolFrac;
  console.log('the tolerance, derived and measured (CONTRACT §9 rule 2)');
  console.log(`  predicted on-grid share of an unquantised spread   ${(predicted * 100).toFixed(2)}%`);
  console.log(`  measured over ${n} uniform draws on [T, 3T]        ${((onGrid / n) * 100).toFixed(2)}%`);
  console.log(`  required for a lock claim                          ${(HUD.vsync.lockedFraction * 100).toFixed(2)}%`);
  console.log(`  separation                                         ${(HUD.vsync.lockedFraction / predicted).toFixed(1)}x`);
  console.log('');
}

if (VERBOSE) {
  console.log('the censoring rule over a sweep of refresh periods, at the 12.5 ms ceiling');
  console.log('  Hz     T (ms)   m=1 band            what the lock establishes');
  for (const hz of [50, 60, 75, 90, 100, 120, 144, 165, 240]) {
    const T = 1000 / hz;
    const b = bandCensored(T, T, W);
    const claim = T <= W ? `work <= ${T.toFixed(2)} <= ${W}, ceiling MET`
      : `work <= ${T.toFixed(2)}, ${W} is inside the band`;
    console.log(`  ${String(hz).padStart(3)}    ${T.toFixed(3).padStart(6)}   ${legend(b).padEnd(20)}${claim}`);
  }
  console.log('');
  console.log(`  the crossover is at ${(1000 / W).toFixed(1)} Hz: at or above it a held lock proves the ceiling.`);
  console.log('');
}

console.log(disagreements
  ? `vsyncprobe: ${disagreements} case(s) disagree with their construction`
  : `vsyncprobe: ${CASES.length} cases, all as constructed (1 of them a declared limit)`);
