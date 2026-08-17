#!/usr/bin/env node
/**
 * budgetaudit.mjs — WHERE EVERY THRESHOLD CAME FROM, AND WHETHER IT CAN FAIL.
 * ===========================================================================
 *
 * NOT A GATE. SESSION 25. It moves no number and it is not allowed to: this is
 * an audit, and a threshold that cannot fail is RECORDED rather than adjusted.
 *
 * THE QUESTION, AND WHY IT IS WORTH A FILE. Two sessions running have found a
 * threshold that could not fail, and both times for the same reason — the
 * threshold was derived from the very data it guards:
 *
 *   s23  the HUD's 12.5 ms frame ceiling, unreachable under a 60 Hz vsync lock.
 *        `budget.json` → `$wallFrameMsP95_rebaseline` records that it USED to be
 *        16.67 "because that was the vsync line", so the red number on the
 *        operator's screen was this ceiling's own discarded value.
 *   s24  `citycheck`'s 1 200-claim floor, derived from the near ring, and
 *        therefore unable to notice that the census it guards had run on a
 *        half-built ring and that the red was 3 rather than 2.
 *
 * Two is a pattern. So every leaf of every budget file is enumerated here and
 * asked four questions, three of which are machine-checkable:
 *
 *   1. IS THERE A DERIVATION?   a sibling `$key` — CONTRACT §9 rule 5 says a
 *                               number without one is a guess.
 *   2. DOES ANYTHING READ IT?   a leaf nothing reads is §9.1's first variant,
 *                               config the code does not read, and this project
 *                               has shipped that four times.
 *   3. IS THE ASSERTION WIRED?  does a `--falsify` case name it? CONTRACT §7.1.
 *   4. CAN A REAL RUN CROSS IT? NOT machine-checkable, and it is the one that
 *                               matters. See the note below.
 *
 * QUESTION 3 IS NOT QUESTION 4, AND CONFLATING THEM IS HOW BOTH DEFECTS ABOVE
 * SURVIVED. A falsifying case MUTATES THE MEASUREMENT — `r.roles.byRole.aircraft
 * = 0` — and asserts the gate goes red. That proves the assertion is WIRED. It
 * says nothing about whether the instrument, run against the real world, can
 * ever produce a number on the far side of the line. The vsync ceiling had a
 * falsify case and passed it for nineteen sessions while being unreachable in
 * the one direction that mattered. So column 3 is printed and column 4 is
 * argued, per threshold, in STATE 25 §2.
 *
 * Usage:
 *   node tools/budgetaudit.mjs             the table
 *   node tools/budgetaudit.mjs --unread    only the leaves nothing reads
 *   node tools/budgetaudit.mjs --json=F
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);

const HERE = new URL('.', import.meta.url);
const FILES = ['budget.json', 'city-budget.json', 'look-budget.json', 'input-budget.json'];

console.log('budgetaudit — every floor and ceiling, what it was derived from, and whether it can fail.');
console.log('NOT A GATE. This session moves none of them (CONTRACT §0 rule 5, and the brief\'s own rule).\n');

/* ------------------------------------------------------------- the sources */
const sources = [];
for (const dir of ['tools', 'src/modules', 'src/lib', 'src/core', 'src/workers']) {
  const d = new URL(`../${dir}/`, HERE);
  for (const f of await readdir(d)) {
    if (!/\.(mjs|js)$/.test(f)) continue;
    sources.push({ path: `${dir}/${f}`, text: await readFile(new URL(f, d), 'utf8') });
  }
}
console.log(`${sources.length} source files scanned for readers.\n`);

/**
 * The falsifying case identifiers, read out of the gates rather than listed
 * here — a hand-kept copy of a list in another file is the arrangement this
 * whole audit is about.
 */
const falsifyIds = [];
for (const s of sources) {
  const m = s.text.match(/^\s{2}\['([a-zA-Z0-9._]+)',/gm);
  if (m) for (const q of m) falsifyIds.push(q.replace(/^\s*\['/, '').replace(/',$/, ''));
}
console.log(`${falsifyIds.length} falsifying case identifiers found across the gates.\n`);

/* -------------------------------------------------------------- the leaves */

/**
 * Budget keys are plain identifiers, so they go into a `RegExp` as they are —
 * and that is ASSERTED rather than assumed, because a key with a `.` in it
 * would silently become a wildcard and match a reader that is not one. The
 * escaping this replaced was a regex literal whose own character class
 * `parsecheck`'s stripper could not parse, which flagged this file as
 * truncated: an instrument that could not be checked by the gate that checks
 * every file.
 */
const safe = (k) => {
  if (!/^[A-Za-z0-9_]+$/.test(k)) {
    console.error(`budgetaudit: key ${JSON.stringify(k)} is not a plain identifier — refusing to report`);
    process.exit(2);
  }
  return k;
};
const rows = [];
for (const file of FILES) {
  const json = JSON.parse(await readFile(new URL(file, HERE), 'utf8'));
  const walk = (obj, path, ancestors) => {
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('$')) continue;
      const p = path ? `${path}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) { walk(v, p, [obj, ...ancestors]); continue; }
      /**
       * THE DERIVATION, AND THE FIRST VERSION OF THIS TEST PRODUCED A FALSE
       * FINDING — recorded because it is this session's own subject.
       *
       * Looking only for a sibling `$key` reported "116 of 189 bounds have no
       * derivation", which is not true: `particles.maxStreakLengthPx` is
       * derived over four lines inside `$derivation_area`, and
       * `ceilings.wallFrameMsP95` inside `capture.$estimator` one object up. A
       * number is documented if its NAME is argued about in prose that a reader
       * of that number would find, so all three scopes count and each is
       * reported separately rather than merged:
       *
       *   direct    a `$key` or `$key_*` sibling
       *   sibling   the key is named inside some other `$note` in the same object
       *   ancestor  the key is named inside a `$note` on an enclosing object
       *
       * NONE now means nothing anywhere in the file argues about this number,
       * which is CONTRACT §9 rule 5's actual claim.
       */
      const direct = Object.keys(obj).filter((q) => q === `$${k}` || q.startsWith(`$${k}_`));
      const notesIn = (o) => Object.entries(o).filter(([q]) => q.startsWith('$')).map(([, v2]) => String(v2)).join('\n');
      const named = (text) => new RegExp(`\\b${safe(k)}\\b`).test(text);
      const siblingNote = !direct.length && named(notesIn(obj));
      const ancestorNote = !direct.length && !siblingNote && ancestors.some((a) => named(notesIn(a)));
      const docs = direct;
      const docKind = direct.length ? 'direct' : siblingNote ? 'sibling' : ancestorNote ? 'ancestor' : 'NONE';
      const docLen = direct.reduce((s2, q) => s2 + String(obj[q]).length, 0);
      /**
       * A reader is a source file naming this leaf's own key. Matched as a
       * whole word so `drawCalls` does not match `maxDrawCalls`, and the
       * budget files themselves are not readers of themselves.
       */
      const re = new RegExp(`\\b${safe(k)}\\b`);
      const readers = sources.filter((s) => re.test(s.text)).map((s) => s.path);
      /** A falsify id that names this leaf, by its own key or by its parent's. */
      const leafKey = k.toLowerCase();
      const parent = (path.split('.').pop() || '').toLowerCase();
      const cases = falsifyIds.filter((id) => {
        const tail = id.split('.').pop().toLowerCase();
        return tail.includes(leafKey.replace(/^(min|max)/, '')) && leafKey.length > 4
          ? true
          : tail === leafKey || (parent && id.toLowerCase().startsWith(`${parent}.`) && tail.includes(leafKey.replace(/^(min|max)/, '')));
      });
      const dir = /^min/.test(k) ? 'floor'
        : /^max/.test(k) ? 'ceiling'
          : /^require/.test(k) ? 'assertion'
            : path.endsWith('ceilings') || path.includes('ceilings.') ? 'ceiling'
              : path.endsWith('floors') || path.includes('floors.') ? 'floor'
                : path.startsWith('hardFails') ? 'ceiling'
                  : 'parameter';
      rows.push({
        file, path: p, key: k, value: v, dir,
        docs, docLen, docKind,
        readers, nReaders: readers.length,
        cases: [...new Set(cases)],
      });
    }
  };
  walk(json, '', []);
}

const isThreshold = (r) => r.dir !== 'parameter';
const thresholds = rows.filter(isThreshold);
console.log(`${rows.length} leaves across ${FILES.length} budget files; ${thresholds.length} are a floor, a ceiling or an assertion.\n`);

/* --------------------------------------------------------------- the table */
if (args.has('unread')) {
  console.log('== LEAVES NOTHING IN src/ OR tools/ READS (CONTRACT §9.1, first variant) ==\n');
  for (const r of rows.filter((q) => !q.nReaders)) {
    console.log(`  ${r.file.padEnd(18)} ${r.path.padEnd(46)} = ${JSON.stringify(r.value)}`);
  }
} else {
  for (const file of FILES) {
    const mine = rows.filter((r) => r.file === file);
    if (!mine.length) continue;
    console.log(`\n===== ${file} — ${mine.length} leaves, ${mine.filter(isThreshold).length} of them a bound =====`);
    console.log('  kind      value            path                                       derivation  readers');
    for (const r of mine) {
      console.log(
        `  ${r.dir.padEnd(9)} ${String(JSON.stringify(r.value)).slice(0, 15).padEnd(16)} ${r.path.padEnd(42)} ` +
        `${(r.docKind === 'direct' ? `direct ${r.docLen}ch` : r.docKind).padEnd(11)} ` +
        `${String(r.nReaders).padStart(3)}`
      );
    }
  }
}

/* ------------------------------------------------------------ the summaries */
console.log('\n\n== WHAT THE THREE MACHINE-CHECKABLE COLUMNS SAY ==\n');
{
  const tally = {};
  for (const r of thresholds) tally[r.docKind] = (tally[r.docKind] || 0) + 1;
  console.log(`  where each bound's derivation lives: ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(', ')} — of ${thresholds.length}`);
  const noDoc = thresholds.filter((r) => r.docKind === 'NONE');
  console.log(`\n  bounds NOTHING in their own file argues about (CONTRACT §9 rule 5): ${noDoc.length}`);
  for (const r of noDoc) console.log(`      ${r.file} → ${r.path} = ${JSON.stringify(r.value)}`);
}
{
  const unread = rows.filter((r) => !r.nReaders);
  console.log(`\n  leaves NOTHING in src/ or tools/ names:  ${unread.length} of ${rows.length}`);
  for (const r of unread) console.log(`      ${r.file} → ${r.path} = ${JSON.stringify(r.value)}`);
}
/**
 * NO PER-THRESHOLD FALSIFY COLUMN, AND DROPPING IT IS A FINDING RATHER THAN A
 * GAP. The first version matched a falsifying case to a threshold by name and
 * reported "140 of 189 bounds have no case", which is meaningless: cases are
 * named by ASSERTION, one case can cover several bounds, and a bound can be
 * covered by a case sharing none of its letters. The project already answers
 * the question properly and globally — `falsify.requireCoverage: 1` makes each
 * gate count its own `fail()` SITES and refuse to pass unless it has at least
 * that many cases. So the honest statement is the gates' own, and it is quoted
 * from a run rather than from this file.
 */
console.log(`\n  falsifying cases found across the gates: ${falsifyIds.length}. Per-threshold matching by NAME was`);
console.log('  tried and removed — it reported 140 of 189 bounds "uncovered" and every one of those was a');
console.log('  naming mismatch. `falsify.requireCoverage: 1` is the real answer: each gate counts its own');
console.log('  fail() sites and refuses to pass with fewer cases than sites. Run the gates to read it.');

console.log('\n\n== THE COLUMN NO PROGRAM CAN FILL ==');
console.log('  Whether a REAL run can land on the far side of the line. A falsifying case mutates the');
console.log('  measurement and proves the assertion is wired; it cannot prove the instrument is capable of');
console.log('  producing the number. The HUD\'s 12.5 ms ceiling had a case, passed it for nineteen sessions,');
console.log('  and was unreachable under a 60 Hz lock the whole time. That column is argued per threshold in');
console.log('  STATE 25 §2 and this file exists to make the argument cheap, not to replace it.');

if (args.has('json')) {
  await writeFile(args.get('json'), `${JSON.stringify(rows, null, 1)}\n`, 'utf8');
  console.log(`\nwrote ${args.get('json')}`);
}
