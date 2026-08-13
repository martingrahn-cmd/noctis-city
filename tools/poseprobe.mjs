#!/usr/bin/env node
/**
 * poseprobe.mjs — WHERE TO STAND SO THE SUBJECT IS ACTUALLY IN FRAME.
 * NOT A GATE, and it must never become one. SESSION 26.
 *
 * WHY THIS EXISTS, AND IT IS A METHOD THIS PROJECT ALREADY PAID FOR TWICE.
 *
 * Two frame pairs in this project's history missed their subject entirely
 * because the camera was guessed and turned out to be pressed against a facade
 * — STATE 22 §3 records the second one ("a first wide pose earlier in the
 * session put a facade against the lens", CONTRACT §9.1's own recorded failure
 * met again). What finally put the bench in frame was not a better guess: it
 * was enumerating candidate stand-offs and RAY-TESTING each one against the
 * chunk occluders until one had an unobstructed view.
 *
 * That method existed only as prose in STATE 22. This is it as a tool, so the
 * next session does not re-derive it from a paragraph.
 *
 * WHAT IT RAY-TESTS AGAINST, AND WHY THAT SET AND NOT ANOTHER.
 *
 * `city.residentOccluders()` — the DELIVERED occluders, buildings only, with
 * `landmark` and `river` filtered out exactly as that method does. Three
 * reasons the filter is right here:
 *
 *   - A landmark's own boxes are usually THE SUBJECT. Ray-testing the viaduct
 *     against the viaduct refuses every pose that can see it.
 *   - The river's bridge decks are a `river` occluder, and a deck stops every
 *     ray to anything beyond it — including the sky, which is why
 *     `look-budget.json` records the same filter for the wall-albedo rects.
 *   - Buildings are what actually stands between a pavement and a structure,
 *     and they are the thing a guessed pose walks into.
 *
 * So this answers "is there a BUILDING in the way", which is the question the
 * two lost frame pairs answered wrongly. It does NOT answer "is the subject
 * big enough to read" — that is the `--fill` column, computed from the
 * subject's own extent, and it is advisory.
 *
 * THE OCCLUDER'S VERTICAL EXTENT IS [0, top] AND THAT IS AN ASSUMPTION WORTH
 * NAMING. `residentOccluders` returns `{x0,x1,z0,z1,top}` with no floor, and
 * every building in this city starts at the ground, so the box is treated as
 * standing on y = 0. A ray that passes UNDER a building is therefore reported
 * as blocked, which is the safe direction: it can refuse a pose, it cannot
 * admit a blind one. CONTRACT §9 — the datum is written down beside the
 * number rather than assumed to be shared.
 *
 * Usage:
 *   node tools/poseprobe.mjs --target=0,23,11 --subject=viaduct-portal
 *   node tools/poseprobe.mjs --target=0,23,11 --eye=1.74 --dmin=40 --dmax=110
 *   node tools/poseprobe.mjs --target=0,23,11 --half=12,8,12   subject extent
 *
 * Prints the clear poses, best first, each with the `lookat.mjs` command that
 * takes the frame. Asserts nothing.
 */

import { bootCity } from './lib/headlesscity.mjs';

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);

const num = (s) => String(s).split(',').map(Number);

const TARGET = num(args.get('target') || '0,10,0');
const EYE = Number(args.get('eye') || 1.74);
const DMIN = Number(args.get('dmin') || 30);
const DMAX = Number(args.get('dmax') || 120);
const DSTEP = Number(args.get('dstep') || 5);
const ASTEP = Number(args.get('astep') || 5); // degrees of azimuth
const HALF = num(args.get('half') || '6,6,6'); // subject half-extent, for --fill
const FOV = Number(args.get('fov') || 55);
const TOPN = Number(args.get('top') || 12);
const NAME = args.get('subject') || 'subject';
const CLEARANCE = Number(args.get('clearance') || 1.2); // m the ray must miss a box by

/**
 * Slab test — does the segment a→b intersect the AABB?
 *
 * The standard slab method, with the segment parameterised on t ∈ [0,1]. A
 * degenerate direction on an axis (dx === 0) is handled by testing containment
 * on that axis rather than dividing by zero, which is the case that matters
 * here because a camera at the same height as a target gives dy = 0 exactly.
 */
function segmentHitsBox(a, b, box) {
  let t0 = 0;
  let t1 = 1;
  const lo = [box.x0, 0, box.z0];
  const hi = [box.x1, box.top, box.z1];
  for (let i = 0; i < 3; i++) {
    const d = b[i] - a[i];
    if (Math.abs(d) < 1e-9) {
      if (a[i] < lo[i] || a[i] > hi[i]) return false;
      continue;
    }
    let n = (lo[i] - a[i]) / d;
    let f = (hi[i] - a[i]) / d;
    if (n > f) { const tmp = n; n = f; f = tmp; }
    if (n > t0) t0 = n;
    if (f < t1) t1 = f;
    if (t0 > t1) return false;
  }
  return true;
}

/** Is the point inside the box's footprint, at any height below its top? */
function pointInBox(p, box, pad = 0) {
  return p[0] > box.x0 - pad && p[0] < box.x1 + pad &&
    p[2] > box.z0 - pad && p[2] < box.z1 + pad &&
    p[1] < box.top;
}

/**
 * The subject's angular size in the frame, as a fraction of frame height.
 * Advisory only — it says whether the thing is worth photographing from here,
 * not whether it is visible, and those are different questions.
 */
function fillFraction(pos, target, half, fovDeg) {
  const d = Math.hypot(pos[0] - target[0], pos[1] - target[1], pos[2] - target[2]);
  const r = Math.max(half[0], half[1], half[2]);
  const ang = 2 * Math.atan(r / Math.max(1, d));
  return ang / (fovDeg * Math.PI / 180);
}

console.log(`poseprobe — ${NAME}`);
console.log(`  target [${TARGET.join(', ')}]  eye ${EYE} m  d ${DMIN}..${DMAX} m  fov ${FOV}°`);

// Boot the city with the eye near the subject so the residency ring covers it.
const boot = bootCity({
  seed: Number(args.get('seed') || 1337),
  eye: [TARGET[0], EYE, TARGET[2]],
  maxFrames: Number(args.get('frames') || 400),
});
/**
 * `bootCity` returns BOTH the module and its API, and only the API carries
 * `residentOccluders`. Reaching for `boot.city` — the module — yields
 * `undefined`, an empty occluder list, and a ray test that passes every pose:
 * this tool's own subject, in this tool, on its first run. The guard below is
 * what turned it into a refusal instead of twelve confident wrong poses.
 */
const cityApi = boot.cityApi;
const occ = (cityApi && cityApi.residentOccluders ? cityApi.residentOccluders() : []) || [];
const resident = cityApi && cityApi.stats ? cityApi.stats().resident : -1;
console.log(`  ${occ.length} building occluders over ${resident} resident chunks around the target`);
if (!occ.length) {
  console.log('  NO OCCLUDERS — the ring did not stream here. The ray test would pass everything,');
  console.log('  which is the failure this tool exists to prevent. Refusing to report poses.');
  process.exit(2);
}

const cands = [];
for (let d = DMIN; d <= DMAX; d += DSTEP) {
  for (let az = 0; az < 360; az += ASTEP) {
    const r = az * Math.PI / 180;
    const pos = [TARGET[0] + d * Math.cos(r), EYE, TARGET[2] + d * Math.sin(r)];

    // The camera must not be standing inside a building.
    let inside = false;
    for (const o of occ) if (pointInBox(pos, o, 0.5)) { inside = true; break; }
    if (inside) continue;

    // The sightline must not be interrupted, and must clear by CLEARANCE:
    // four rays, the centre and the subject's own corners in elevation, so a
    // pose that sees only the top of the thing is not reported as clear.
    const probes = [
      TARGET,
      [TARGET[0], TARGET[1] - HALF[1], TARGET[2]],
      [TARGET[0], TARGET[1] + HALF[1], TARGET[2]],
    ];
    let blocked = 0;
    let blocker = null;
    for (const p of probes) {
      for (const o of occ) {
        const grown = { x0: o.x0 - CLEARANCE, x1: o.x1 + CLEARANCE, z0: o.z0 - CLEARANCE, z1: o.z1 + CLEARANCE, top: o.top };
        if (segmentHitsBox(pos, p, grown)) { blocked++; blocker = o; break; }
      }
    }
    if (blocked) { cands.push({ pos, d, az, clear: false, blocked, blocker }); continue; }

    cands.push({ pos, d, az, clear: true, blocked: 0, fill: fillFraction(pos, TARGET, HALF, FOV) });
  }
}

const clear = cands.filter((c) => c.clear);
console.log(`  ${cands.length} candidate poses tested, ${clear.length} with an unobstructed sightline`);
if (!clear.length) {
  console.log('  NONE CLEAR. Widen --dmin/--dmax, lower --clearance, or the subject is walled in.');
  process.exit(1);
}

// Best = fullest frame, which for a fixed fov means closest with a clear line.
clear.sort((a, b) => b.fill - a.fill);
const t = TARGET.map((v) => v.toFixed(2)).join(',');
console.log('');
console.log('  the clear poses, fullest frame first');
console.log('  ' + 'dist'.padStart(6) + 'az'.padStart(6) + 'fill'.padStart(8) + '   lookat command');
for (const c of clear.slice(0, TOPN)) {
  const p = c.pos.map((v) => v.toFixed(2)).join(',');
  console.log(
    '  ' + c.d.toFixed(0).padStart(6) + c.az.toFixed(0).padStart(6) +
    (c.fill * 100).toFixed(1).padStart(7) + '%' +
    `   node tools/lookat.mjs --pos=${p} --target=${t} --fov=${FOV} --name=${NAME}`
  );
}

// The azimuths that are clear, as ranges — a single number is a pose, a range
// is a direction the subject can be approached from, and the second is what
// tells you whether the pose is robust or lucky.
const azs = [...new Set(clear.map((c) => c.az))].sort((a, b) => a - b);
const runs = [];
for (const a of azs) {
  const last = runs[runs.length - 1];
  if (last && a - last[1] <= ASTEP) last[1] = a; else runs.push([a, a]);
}
console.log('');
console.log(`  clear azimuths: ${runs.map(([a, b]) => (a === b ? `${a}°` : `${a}–${b}°`)).join(', ')}`);
console.log(`  (a wide run is a robust pose; a lone azimuth is one the ray test barely allowed)`);
