#!/usr/bin/env node
/**
 * parsecheck.mjs — is every source file syntactically *complete*?
 *
 *   node tools/parsecheck.mjs
 *   node tools/parsecheck.mjs --verbose
 *
 * Exit 0 = clean, 1 = at least one file is broken, 2 = the checker itself failed.
 *
 * "Valid" is not the bar. A file can parse cleanly and still be truncated — cut
 * after a complete statement, missing the export the rest of the project imports.
 * So this runs three passes:
 *
 *   1. SYNTAX      node --check, which parses without executing. Browser code
 *                  cannot be import()ed here; it would try to touch WebGL.
 *   2. COMPLETENESS heuristics for the ways generated files actually get cut off:
 *                  ending on an operator, unbalanced delimiters, no trailing
 *                  newline, merge markers, elision markers.
 *   3. CONTRACT    the structural rules from CONTRACT.md that can be checked
 *                  statically. Chiefly: modules never import each other. A rule
 *                  nobody enforces is a rule that decays.
 *   4. CONSTANTS   every `NAMESPACE.key` naming an object imported from
 *                  `core/constants.js` exists on that object. SESSION 42.
 *
 * WHY PASS 4 EXISTS, AND IT IS ONE LINE OF EVIDENCE.
 *
 * `moving.js` set the train's window emitter from `LIGHT.windowLitNits` from
 * session 21 to session 42. No such constant has ever existed — `constants.js`
 * has `windowNits` — so the assignment delivered `undefined`, three.js made the
 * emissive uniform NaN, and the clamp in `lights.js` resolved it to 60 000
 * cd/m²: every window on the elevated train blew out to a solid white band, 273x
 * the 220 the line's own comment computes with, in every night frame for
 * twenty-one sessions.
 *
 * Nothing could have caught it. It is CONTRACT §9.1's *"a value written in
 * config that the code does not read"* with the two halves swapped — a NAME the
 * config does not have — and JavaScript answers `undefined` rather than
 * throwing, exactly as §9.1's forwarder hands `undefined` to arithmetic that
 * yields NaN. The check is a string scan and it costs nothing: over `src/` it
 * reads 324 references in 19 files and, once that one line is repaired, all 324
 * resolve.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as CONSTANTS from '../src/core/constants.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VERBOSE = process.argv.includes('--verbose');

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'look-out', 'perf-out', 'shot-out']);

// ---------------------------------------------------------------------------
// file collection

async function walk(dir, out = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      await walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

const CHECKED_EXT = new Set(['.js', '.mjs', '.cjs']);
const JSON_EXT = new Set(['.json']);

// ---------------------------------------------------------------------------
// pass 2 — completeness

/**
 * Strip comments, strings, template literals and regex literals, replacing each
 * with a placeholder of the same "shape" for bracket counting. Deliberately
 * tolerant: this runs *after* node --check has already proved the file parses,
 * so it only has to be right about files that are already valid.
 */
function strip(src, { keepComments = false } = {}) {
  let out = '';
  let i = 0;
  const n = src.length;
  // Tracks whether a '/' can start a regex (after an operator/open bracket) or
  // is division (after a value). Crude but adequate post-parse.
  let prevSignificant = '';

  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];

    if (c === '/' && c2 === '/') {
      const start = i;
      while (i < n && src[i] !== '\n') i++;
      if (keepComments) out += src.slice(start, i);
      continue;
    }
    if (c === '/' && c2 === '*') {
      const start = i;
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      out += keepComments ? src.slice(start, Math.min(i, n)) : ' ';
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      i++;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === quote) { i++; break; }
        if (src[i] === '\n') break; // unterminated; node --check would have caught it
        i++;
      }
      out += '0';
      prevSignificant = '0';
      continue;
    }
    if (c === '`') {
      // Template literal. ${...} may contain arbitrary code including nested
      // templates, so recurse on depth rather than scanning naively.
      i++;
      let depth = 0;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (depth === 0 && src[i] === '`') { i++; break; }
        if (depth === 0 && src[i] === '$' && src[i + 1] === '{') { depth = 1; i += 2; out += '('; continue; }
        if (depth > 0) {
          // Inside interpolation: emit it so brackets inside still balance.
          if (src[i] === '{') depth++;
          else if (src[i] === '}') {
            depth--;
            if (depth === 0) { i++; out += ')'; continue; }
          }
          out += src[i];
          i++;
          continue;
        }
        i++;
      }
      out += '0';
      prevSignificant = '0';
      continue;
    }
    if (c === '/' && /[=(,:[{;!&|?+\-*%~^<>]/.test(prevSignificant)) {
      // regex literal
      i++;
      let inClass = false;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '[') inClass = true;
        else if (src[i] === ']') inClass = false;
        else if (src[i] === '/' && !inClass) { i++; break; }
        else if (src[i] === '\n') break;
        i++;
      }
      while (i < n && /[a-z]/.test(src[i])) i++;
      out += '0';
      prevSignificant = '0';
      continue;
    }

    out += c;
    if (!/\s/.test(c)) prevSignificant = c;
    i++;
  }
  return out;
}

const OPEN = { '(': ')', '[': ']', '{': '}' };
const CLOSE = { ')': '(', ']': '[', '}': '{' };

function bracketBalance(stripped) {
  const stack = [];
  let line = 1;
  const openLines = [];
  for (let i = 0; i < stripped.length; i++) {
    const c = stripped[i];
    if (c === '\n') { line++; continue; }
    if (OPEN[c]) { stack.push(c); openLines.push(line); continue; }
    if (CLOSE[c]) {
      if (!stack.length) return { ok: false, reason: `stray '${c}' at line ${line}` };
      const top = stack.pop();
      openLines.pop();
      if (top !== CLOSE[c]) return { ok: false, reason: `'${top}' closed by '${c}' at line ${line}` };
    }
  }
  if (stack.length) {
    return {
      ok: false,
      reason: `${stack.length} unclosed '${stack[stack.length - 1]}' — outermost opened at line ${openLines[0]}`,
    };
  }
  return { ok: true };
}

/** The last meaningful character of a truncated file is almost always one of these. */
const DANGLING_TAIL = /(?:[,+\-*/%&|^~<>=!?:([{]|=>|&&|\|\||\?\?|\.\.\.|\bnew\b|\breturn\b|\bconst\b|\blet\b|\bvar\b|\bfunction\b|\bclass\b|\bimport\b|\bexport\b|\bfrom\b|\bawait\b|\bcase\b)$/;

const TRUNCATION_MARKERS = [
  { re: /^<{7}|^>{7}|^={7}$/m, why: 'unresolved merge marker' },
  { re: /\/\/\s*\.\.\.\s*(rest|remaining|unchanged|continues|omitted|snip)/i, why: 'elision comment' },
  { re: /\/\*\s*\.\.\.\s*(rest|remaining|unchanged|continues|omitted|snip)/i, why: 'elision comment' },
  { re: /\.\.\.\s*\(unchanged\)/i, why: 'elision comment' },
  { re: /…/, why: 'ellipsis character — probable elision' },
  { re: /\bTODO\s*:?\s*(truncated|finish this file)/i, why: 'truncation TODO' },
];

function completenessCheck(rel, src) {
  const fails = [];

  if (!src.trim().length) {
    fails.push('file is empty');
    return fails;
  }
  if (!src.endsWith('\n')) {
    fails.push('no trailing newline — file may have been cut mid-write');
  }

  // Elision markers live in comments, so comments are kept — but string and
  // regex literals are blanked first, or this file would flag its own patterns.
  const commentary = strip(src, { keepComments: true });
  for (const { re, why } of TRUNCATION_MARKERS) {
    const m = commentary.match(re);
    if (m) fails.push(`${why}: ${JSON.stringify(m[0].slice(0, 60))}`);
  }

  const stripped = strip(src);
  const bal = bracketBalance(stripped);
  if (!bal.ok) fails.push(`unbalanced delimiters — ${bal.reason}`);

  const tail = stripped.replace(/\s+$/, '');
  const m = tail.match(DANGLING_TAIL);
  if (m) fails.push(`ends on ${JSON.stringify(m[0])} — statement is incomplete`);

  return fails;
}

// ---------------------------------------------------------------------------
// pass 3 — contract structure

const IMPORT_RE = /^\s*(?:import|export)\b[^'"\n]*?from\s*['"]([^'"]+)['"]/gm;
const BARE_IMPORT_RE = /^\s*import\s*['"]([^'"]+)['"]/gm;

function importsOf(src) {
  const out = [];
  for (const re of [IMPORT_RE, BARE_IMPORT_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) out.push(m[1]);
  }
  return out;
}

function contractCheck(rel, src) {
  const fails = [];
  const posix = rel.split(path.sep).join('/');
  const imports = importsOf(src);
  // Pattern bans below are about what the file *does*, so they run against code
  // with comments and literals removed. A rule that fires on prose describing
  // the rule teaches people to stop reading the checker.
  const code = strip(src);

  const isModule = posix.startsWith('src/modules/');
  const isLib = posix.startsWith('src/lib/');
  const isCore = posix.startsWith('src/core/');
  const inSrc = posix.startsWith('src/');

  // CONTRACT §0.1 / §2.2 — modules never import each other.
  if (isModule) {
    for (const spec of imports) {
      if (!spec.startsWith('.')) continue;
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(posix), spec));
      if (resolved.startsWith('src/modules/')) {
        fails.push(
          `imports another module (${spec}) — CONTRACT §2.2 forbids it. Use ctx.get('<name>').`
        );
      }
    }
  }

  // Layering: lib is pure; core must not depend on modules.
  if (isLib) {
    for (const spec of imports) {
      if (spec.startsWith('.') && !path.posix.normalize(path.posix.join(path.posix.dirname(posix), spec)).startsWith('src/lib/')) {
        fails.push(`src/lib must not import outside src/lib (${spec}) — it is pure helpers only`);
      }
    }
  }
  if (isCore) {
    for (const spec of imports) {
      if (!spec.startsWith('.')) continue;
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(posix), spec));
      if (resolved.startsWith('src/modules/')) {
        fails.push(`src/core must not import a module (${spec}) — the core knows no module by name`);
      }
    }
  }

  // CONTRACT §2 — every module file exports exactly one create<Name> factory,
  // and that factory declares a name. A file that lost its export to truncation
  // still parses; this is what catches it.
  if (isModule) {
    const factories = [...code.matchAll(/export\s+function\s+(create[A-Z][A-Za-z0-9]*)\s*\(/g)].map((m) => m[1]);
    if (factories.length !== 1) {
      fails.push(
        `expected exactly one \`export function create<Name>(\`, found ${factories.length}${factories.length ? ` (${factories.join(', ')})` : ''}`
      );
    }
    if (!/\bname\s*:\s*['"][a-z][a-zA-Z0-9]*['"]/.test(src.replace(/\/\*[\s\S]*?\*\//g, ' '))) {
      fails.push("no `name: '<moduleName>'` field — the module has no ctx.get() key");
    }
  }

  // CONTRACT §6 — determinism.
  if (inSrc) {
    if (/\bMath\s*\.\s*random\s*\(/.test(code)) {
      fails.push('Math.random() — CONTRACT §6 requires ctx.rng(stream)');
    }
    if (/\bDate\s*\.\s*now\s*\(/.test(code)) {
      fails.push('Date.now() — non-deterministic; use the time module or performance.now() in core/loop.js');
    }
  }

  // CONTRACT §5.4 — no GPU readback on the frame path.
  if (isModule && /readRenderTargetPixels/.test(code)) {
    fails.push('readRenderTargetPixels — CONTRACT §5.4 forbids readback in a module; it stalls the pipeline');
  }

  // CONTRACT §5.2 — one encode, in the final pass.
  if (inSrc && !posix.endsWith('src/modules/post.js')) {
    if (/pow\s*\([^)]*,\s*(?:vec3\s*\()?\s*(?:1\.0\s*\/\s*2\.2|0\.4545)/.test(code)) {
      fails.push('manual gamma encode outside post.js — CONTRACT §5.2 allows exactly one encode point');
    }
  }

  // §9.1 — a constant reference that resolves to nothing. See the header.
  if (inSrc) fails.push(...constantsCheck(src, code));

  return fails;
}

// ---------------------------------------------------------------------------
// pass 4 — constants references

/** The exported objects of constants.js that are plain namespaces of values. */
const CONSTANT_NAMESPACES = Object.fromEntries(
  Object.entries(CONSTANTS).filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v))
);

const CONSTANTS_IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*['"][^'"]*core\/constants\.js['"]/g;

/**
 * Which constants.js namespaces this file actually imports. It has to be the
 * import and not the bare name, because `citygen.js` has a local `SITE` of its
 * own that has nothing to do with `constants.js`'s — checking by name alone
 * reports 28 references that are not references to this object at all.
 */
function constantsImportedBy(src) {
  const live = [];
  CONSTANTS_IMPORT_RE.lastIndex = 0;
  let m;
  while ((m = CONSTANTS_IMPORT_RE.exec(src))) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name && CONSTANT_NAMESPACES[name]) live.push(name);
    }
  }
  return live;
}

/**
 * `code` is the comment- and literal-stripped source: a doc comment naming a
 * constant that has since moved is prose, not a read, and a checker that fires
 * on prose teaches people to stop reading it (the same reasoning the pattern
 * bans above are written with).
 */
function constantsCheck(src, code) {
  const fails = [];
  for (const ns of constantsImportedBy(src)) {
    const re = new RegExp(`\\b${ns}\\.([A-Za-z_$][A-Za-z0-9_$]*)`, 'g');
    const missing = new Set();
    let m;
    while ((m = re.exec(code))) {
      if (!Object.prototype.hasOwnProperty.call(CONSTANT_NAMESPACES[ns], m[1])) missing.add(m[1]);
    }
    for (const key of missing) {
      fails.push(
        `${ns}.${key} does not exist on the ${ns} imported from core/constants.js — `
        + 'it reads as undefined and JavaScript will not say so (the train\'s windows were NaN for 21 sessions)'
      );
    }
  }
  return fails;
}

// ---------------------------------------------------------------------------

let files;
try {
  files = await walk(ROOT);
} catch (e) {
  console.error('parsecheck: could not walk the tree —', e.message);
  process.exit(2);
}

const results = [];
let checkedCount = 0;

for (const abs of files) {
  const rel = path.relative(ROOT, abs);
  const ext = path.extname(abs);
  const fails = [];

  if (JSON_EXT.has(ext)) {
    const src = await readFile(abs, 'utf8');
    try {
      JSON.parse(src);
    } catch (e) {
      fails.push(`invalid JSON — ${e.message}`);
    }
    checkedCount++;
    if (fails.length) results.push({ rel, fails });
    continue;
  }

  if (!CHECKED_EXT.has(ext)) continue;

  const src = await readFile(abs, 'utf8');
  checkedCount++;

  const syntax = spawnSync(process.execPath, ['--check', abs], { encoding: 'utf8' });
  if (syntax.status !== 0) {
    const msg = (syntax.stderr || '').split('\n').filter(Boolean).slice(0, 6).join('\n      ');
    fails.push(`syntax error —\n      ${msg}`);
    // A file that does not parse will fail every other check noisily; stop here.
    results.push({ rel, fails });
    continue;
  }

  fails.push(...completenessCheck(rel, src));
  fails.push(...contractCheck(rel, src));

  if (fails.length) results.push({ rel, fails });
  else if (VERBOSE) console.log(`  ok  ${rel}`);
}

// index.html gets a shape check too — a truncated entry point is invisible
// everywhere else until the page renders nothing.
try {
  const html = await readFile(path.join(ROOT, 'index.html'), 'utf8');
  const htmlFails = [];
  if (!/<\/html>\s*$/.test(html)) htmlFails.push('does not end with </html> — truncated?');
  if (!/<script[^>]*type=["']module["']/.test(html)) htmlFails.push('no <script type="module"> entry point');
  checkedCount++;
  if (htmlFails.length) results.push({ rel: 'index.html', fails: htmlFails });
} catch {
  results.push({ rel: 'index.html', fails: ['missing'] });
}

/**
 * CONTRACT.md's §9 TABLE COUNTS ITSELF — session 19.
 *
 * §9's opening line has carried a hand-maintained count of its own rows and has
 * been wrong THREE times, most memorably inside the sentence claiming the count
 * "is now derived by counting the rows, which is the only way it stays right".
 * A number maintained in prose beside the thing it counts is §9.1's "a value in
 * config the code does not read" with a document instead of a config file, and
 * it fails the same way: quietly, and only to a reader who happens to count.
 *
 * So the number is generated against rather than maintained. Both quantities
 * are printed on disagreement, per §9 rule 4.
 *
 * THE ROWS ARE THE CONTIGUOUS BLOCK, and that is the whole of the arithmetic
 * this replaces. Session 18's `python3` snippet counted every line beginning
 * with `|` from the header to the end of the file — a count of pipe-leading
 * lines in the REMAINDER OF THE DOCUMENT, used as the number of rows in ONE
 * table. It agrees at 42 today only because §9's table is currently the last
 * table in the file; a table added below it would make the derivation
 * over-count without saying so. That is §9's own shape, in the derivation
 * printed to defend against §9, which is §7.7 exactly.
 */
const CONTRACT_TABLE_HEADER = '| session | what was computed';
const CONTRACT_COUNT_RE = /\*\*The (\d+) so far\*\*/;

function contractDocCheck(md) {
  const fails = [];
  const lines = md.split('\n');
  const h = lines.findIndex((l) => l.startsWith(CONTRACT_TABLE_HEADER));
  if (h < 0) {
    fails.push(`§9's table header ("${CONTRACT_TABLE_HEADER}…") is missing — the section was renamed or truncated`);
    return fails;
  }
  // +2 skips the header row and the |---|---| separator beneath it.
  let rows = 0;
  for (let i = h + 2; i < lines.length && lines[i].startsWith('|'); i++) rows++;

  const m = md.match(CONTRACT_COUNT_RE);
  if (!m) {
    fails.push(
      `§9's row count sentence is missing — expected "**The <n> so far**", ` +
      `and the table has ${rows} contiguous rows`
    );
    return fails;
  }
  const declared = Number(m[1]);
  if (declared !== rows) {
    fails.push(
      `§9 says "**The ${declared} so far**" and the table has ${rows} contiguous rows ` +
      `(counted from the line after "${CONTRACT_TABLE_HEADER}…" to the first line not ` +
      `starting with "|"). Write ${rows}.`
    );
  }
  return fails;
}

/**
 * §7.3 / §7.7 — the instrument is run over a case that HAS the property and one
 * that does not, both answers known from outside the instrument, in the same
 * change as the instrument. A checker whose two answers are the same answer is
 * the failure this whole section is about, and a count is exactly the kind of
 * check that quietly returns "fine" for everything.
 *
 * The trailing table in the disagreeing fixture is the session-18 snippet's
 * blind spot made explicit: a second table below §9's. `contractDocCheck`
 * must stop at the blank line and read 2, not 4.
 */
function contractDocSelfTest() {
  const body = (n) =>
    `**The ${n} so far** (prose)\n\n` +
    `${CONTRACT_TABLE_HEADER} | what it was used as | how far off |\n` +
    '|---|---|---|---|\n' +
    '| 1 | a | b | c |\n' +
    '| 2 | d | e | f |\n' +
    '\n' +
    'Some prose, and then a SECOND table further down the document:\n\n' +
    '| x | y |\n|---|---|\n| 1 | 2 |\n';
  const bad = [];
  if (contractDocCheck(body(2)).length !== 0) {
    bad.push('a fixture whose count agrees (2 rows, says 2) was rejected');
  }
  const wrong = contractDocCheck(body(4));
  if (wrong.length === 0) {
    bad.push('a fixture whose count disagrees (2 rows, says 4 — the count a to-EOF scan gives) was accepted');
  }
  if (contractDocCheck('no table here').length === 0) {
    bad.push('a document with no §9 table was accepted');
  }
  return bad;
}

/**
 * §7.3 again, for pass 4, and the positive direction is the one that matters:
 * a name check that rejected everything would be as useless as one that
 * rejected nothing, and this project has shipped a check that rejected
 * everything (the walkability flood fill, one cell of 67 568).
 *
 * The fixtures name a REAL key and a fabricated one off the same real
 * namespace, so the two arms differ in exactly the property under test. The
 * third arm is the reason the scan reads stripped code: a module's own local
 * object of the same name must not be checked against constants.js's.
 */
function constantsSelfTest() {
  const bad = [];
  const ns = Object.keys(CONSTANT_NAMESPACES)[0];
  const realKey = Object.keys(CONSTANT_NAMESPACES[ns])[0];
  if (!ns || !realKey) return ['constants.js exported no namespace with a key — nothing to check against'];

  const imp = `import { ${ns} } from '../core/constants.js';\n`;
  const good = `${imp}const a = ${ns}.${realKey};\n`;
  const bad1 = `${imp}const a = ${ns}.thisKeyDoesNotExist;\n`;
  const localOnly = `const ${ns} = { thisKeyDoesNotExist: 1 };\nconst a = ${ns}.thisKeyDoesNotExist;\n`;

  if (constantsCheck(good, strip(good)).length !== 0) {
    bad.push(`a file reading the real ${ns}.${realKey} was rejected`);
  }
  if (constantsCheck(bad1, strip(bad1)).length === 0) {
    bad.push(`a file reading ${ns}.thisKeyDoesNotExist was accepted`);
  }
  if (constantsCheck(localOnly, strip(localOnly)).length !== 0) {
    bad.push(`a file with its OWN local ${ns} was checked against constants.js's`);
  }
  const inComment = `${imp}/** ${ns}.thisKeyDoesNotExist was renamed in session 9 */\nconst a = ${ns}.${realKey};\n`;
  if (constantsCheck(inComment, strip(inComment)).length !== 0) {
    bad.push('a constant named only in a doc comment was reported as a read');
  }
  return bad;
}

const selfTestFails = [...contractDocSelfTest(), ...constantsSelfTest()];
if (selfTestFails.length) {
  console.error('parsecheck: the CONTRACT.md row-count check failed its own self-test —');
  for (const f of selfTestFails) console.error(`      ${f}`);
  process.exit(2);
}

try {
  const md = await readFile(path.join(ROOT, 'CONTRACT.md'), 'utf8');
  const mdFails = contractDocCheck(md);
  checkedCount++;
  if (mdFails.length) results.push({ rel: 'CONTRACT.md', fails: mdFails });
} catch {
  results.push({ rel: 'CONTRACT.md', fails: ['missing — every session is required to read it first'] });
}

// A green run over zero files is the most dangerous possible result.
if (checkedCount < 5) {
  console.error(`parsecheck: only ${checkedCount} files found — the tree looks wrong, refusing to report green`);
  process.exit(2);
}

if (!results.length) {
  console.log(`parsecheck: ${checkedCount} files, all syntactically complete and contract-clean.`);
  process.exit(0);
}

console.log(`parsecheck: ${checkedCount} files checked, ${results.length} with problems\n`);
for (const { rel, fails } of results) {
  console.log(`  ✗ ${rel}`);
  for (const f of fails) console.log(`      ${f}`);
}
console.log('');
process.exit(1);
