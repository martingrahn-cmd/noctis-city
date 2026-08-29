#!/usr/bin/env node
/**
 * rungates.mjs — RUN ALL EIGHT GATES AND REPORT ALL EIGHT.
 *
 *   npm run gates
 *   node tools/rungates.mjs --only=citycheck,perfcheck
 *   node tools/rungates.mjs --from=lookcheck
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS, AND IT IS ITEM 1 ON STATE 49's, 50's, 51's AND 52's
 * LISTS — FOUR SESSIONS.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `npm run gates` was eight commands chained with `&&`. `lookcheck` has been
 * red since session 45, so `&&` stopped there and the three gates after it —
 * `gateaudit`, `citycheck`, `perfcheck` — never ran at all. **The suite has been
 * running three of eight for eight sessions**, and every one of those sessions
 * ran the last five by hand and wrote a note telling the next one to do the
 * same.
 *
 * THE FIX IS NOT A LOOSENING, AND THE DISTINCTION MATTERS BECAUSE CONTRACT §0
 * RULE 5 FORBIDS ONE. `&&` and this file agree exactly on the verdict — the
 * suite fails if any gate fails, and the process exit code is unchanged. What
 * differs is how much you know when it does: `&&` reports the FIRST failure and
 * nothing about the seven other gates, and this reports all eight. A suite that
 * hides seven results behind one is not stricter than one that prints them; it
 * is the same strictness with less evidence, which is CONTRACT §9's own subject
 * one level up — a signal that looks like a verdict and is a truncation.
 *
 * ORDER IS PRESERVED AND ONE DEPENDENCY IS REAL. `gateaudit` reads the frames
 * `lookcheck` writes and exits 2 if they are not there (its own header says so),
 * so it must run after it. Nothing else in the list depends on anything else,
 * but the order is kept as it was anyway: cheap-and-pure first, browser gates
 * last, which is the order `tools/quiet-gates.sh` wants and the order STATE's
 * gate table has been written in since session 20.
 *
 * SEQUENTIAL AND NOT PARALLEL, deliberately. Five of these eight spawn a
 * headless Chromium, one renderer measures 130% CPU, and CONTRACT §0.2 admits
 * an absolute only from a machine whose load is known. Two browser gates at once
 * is the arrangement that made session 43 read `cpu p95 19.60 ms` on a route
 * that measures 11.30 alone. A suite that runs faster and cannot be quoted is
 * not faster.
 *
 * IT PRINTS THE MACHINE'S LOAD BESIDE EVERY GATE, for the same reason: a red
 * absolute at `load1` 4.0 is not a verdict (CONTRACT §0.2) and the log should
 * carry what it needs to say so without anyone having to remember.
 * `LC_ALL=C` is exported by this file rather than required of the caller —
 * `uptime` prints `load averages: 1,32` in the operator's Swedish locale and a
 * parser that trusts the caller is CONTRACT §0.2's instrument defect 1.
 */

import { spawnSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const args = new Map(process.argv.slice(2).map((a) => {
  const s = a.replace(/^--/, '');
  const i = s.indexOf('=');
  return i < 0 ? [s, 'true'] : [s.slice(0, i), s.slice(i + 1)];
}));

/**
 * The eight, in the order they have always run. `browser` is whether the gate
 * spawns a renderer, which is what decides how to read a millisecond out of it.
 */
const GATES = [
  { name: 'parsecheck', file: 'parsecheck.mjs', browser: false },
  { name: 'faultcheck', file: 'faultcheck.mjs', browser: true },
  { name: 'lookcheck', file: 'lookcheck.mjs', browser: true },
  { name: 'windcheck', file: 'windcheck.mjs', browser: true },
  { name: 'inputcheck', file: 'inputcheck.mjs', browser: true },
  // Reads the frames lookcheck wrote. The one real ordering constraint.
  { name: 'gateaudit', file: 'gateaudit.mjs', browser: false },
  { name: 'citycheck', file: 'citycheck.mjs', browser: true },
  { name: 'perfcheck', file: 'perfcheck.mjs', browser: true },
];

function load1() {
  try {
    const out = execSync('uptime', { env: { ...process.env, LC_ALL: 'C' } }).toString();
    const m = out.match(/load averages?:\s*([0-9.]+)/);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

let list = GATES;
if (args.has('only')) {
  const want = new Set(args.get('only').split(','));
  list = GATES.filter((g) => want.has(g.name));
}
if (args.has('from')) {
  const i = GATES.findIndex((g) => g.name === args.get('from'));
  if (i >= 0) list = GATES.slice(i);
}

const results = [];
for (const g of list) {
  const before = load1();
  const t0 = Date.now();
  console.log(`\n${'='.repeat(72)}\n=== ${g.name}   load1 ${before === null ? '?' : before.toFixed(2)}\n${'='.repeat(72)}`);
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', g.file)], {
    stdio: 'inherit',
    env: { ...process.env, LC_ALL: 'C' },
  });
  const ms = Date.now() - t0;
  const code = r.status === null ? 1 : r.status;
  results.push({ ...g, code, ms, load: before, after: load1() });
}

const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);
console.log(`\n${'='.repeat(72)}\n=== ALL ${results.length} GATES\n${'='.repeat(72)}\n`);
console.log(`  ${pad('gate', 14)}${rpad('exit', 6)}${rpad('verdict', 10)}${rpad('seconds', 10)}${rpad('load1 in', 10)}${rpad('out', 8)}`);
for (const r of results) {
  console.log(`  ${pad(r.name, 14)}${rpad(r.code, 6)}${rpad(r.code === 0 ? 'GREEN' : 'RED', 10)}${rpad((r.ms / 1000).toFixed(1), 10)}${rpad(r.load === null ? '?' : r.load.toFixed(2), 10)}${rpad(r.after === null ? '?' : r.after.toFixed(2), 8)}`);
}

const red = results.filter((r) => r.code !== 0);
console.log('');
if (red.length) {
  console.log(`  ${red.length} of ${results.length} RED: ${red.map((r) => r.name).join(', ')}`);
  /**
   * The one sentence this file is for. `&&` would have printed the first of
   * these and nothing about the gates after it.
   */
  const ran = results.length;
  console.log(`  ALL ${ran} RAN. Under \`&&\` the suite would have stopped at ${red[0].name} and`);
  console.log(`  reported nothing about the ${results.length - results.indexOf(red[0]) - 1} gate(s) after it.`);
} else {
  console.log(`  ${results.length} of ${results.length} GREEN.`);
}
const loud = results.filter((r) => r.browser && r.load !== null && r.load > 1.6);
if (loud.length) {
  console.log(`\n  CONTRACT §0.2: ${loud.length} browser gate(s) started above the quiet bar of 1.6 —`);
  console.log(`  ${loud.map((r) => `${r.name} at ${r.load.toFixed(2)}`).join(', ')}.`);
  console.log('  A GREEN absolute from those is still a verdict (drift here is one-sided);');
  console.log('  a RED one is not. Counts are unaffected.');
}
process.exit(red.length ? 1 : 0);
