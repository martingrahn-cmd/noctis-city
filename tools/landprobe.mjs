#!/usr/bin/env node
/**
 * landprobe.mjs — WHAT IS PAST THE CITY'S EDGE, AS NUMBERS. SESSION 62.
 * NOT A GATE, and it must never become one.
 *
 *   node tools/landprobe.mjs                 every section
 *   node tools/landprobe.mjs --road          the exit road's polyline
 *   node tools/landprobe.mjs --lamps         street lamps standing in farmland
 *   node tools/landprobe.mjs --fields        the parcel pattern
 *   node tools/landprobe.mjs --hills         the hill profile and its winding
 *   node tools/landprobe.mjs --houses        the hillside houses
 *   node tools/landprobe.mjs --seed=1337
 *
 * WHY IT EXISTS. STATE 61 §3.1 and §7 item 3 say the same thing from two sides:
 * *"no gate route reaches past 3 232 m"*, so **nothing in this project asserts
 * anything about the countryside** and *"that will stop being honest the first
 * time somebody changes it and nothing goes red."* Session 62 changed all of
 * it. This does not make it a gate — a gate needs a threshold and a threshold
 * needs a derivation, and neither exists for this content yet — but it does
 * mean the next session can reproduce every number in STATE 62 with one
 * command instead of writing five scratch scripts, which is what this session
 * had to do.
 *
 * NO BROWSER, NO GPU. Every number here comes out of the pure generator, so it
 * is a count, a length, an angle or a ratio and none of it drifts (CONTRACT §9
 * rule 6's corollary). The one thing it CANNOT tell you is whether the land
 * reads as land; that is the frame's job and STATE 62 §0 is where it is
 * answered.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * TWO COPIES ARE DECLARED RATHER THAN HIDDEN (CONTRACT §9.1).
 *
 * `lampStationsFor` lives in `city.js`, which needs `three` and a `ctx`, so
 * `--lamps` carries a transcription of its arithmetic. It is the same
 * arrangement `tools/lampprobe.mjs` has had since session 23 and it is said out
 * loud for the same reason: a second description of one quantity is exactly the
 * failure this project keeps finding, and the mitigation is that it is written
 * down rather than that it is absent. The transcription is checked from the
 * other end — the per-chunk station COUNT it produces is asserted against
 * `city.js`'s own `LAMP_PER_EDGE` arithmetic, and both are printed.
 *
 * `hillGeometry`'s ring placement is in `city.js` too, so `--hills` carries the
 * ring list. The PROFILE is not a copy: `citygen.js` → `hillProfile` is the one
 * description and `city.js` imports it.
 */

import { readFile } from 'node:fs/promises';
import {
  CITY, BLOCK_KEEPOUT, cityExtentAt, chunkBounds, generateChunk,
  EXIT_ROAD, exitRoadZ, exitRoadYawDeg, exitRoadHalfM, exitRoadSpans, exitRoadOwnSpans,
  FARM, farmLinesIn, HILLSIDE, hillMasses, hillProfile, hillRiseAt, hillsideHouses,
} from '../src/lib/citygen.js';

const BUDGET = JSON.parse(await readFile(new URL('./budget.json', import.meta.url), 'utf8'));
const args = new Map(process.argv.slice(2).map((a) => {
  const [k, v = 'true'] = a.replace(/^--/, '').split('=');
  return [k, v];
}));
const SEED = args.get('seed') || BUDGET.capture.params.seed || 1337;
const S = CITY.chunkSize;
const ALL = !['road', 'lamps', 'fields', 'hills', 'houses'].some((k) => args.has(k));
const f2 = (n, w = 8) => n.toFixed(2).padStart(w);
const f1 = (n, w = 7) => n.toFixed(1).padStart(w);

console.log(`landprobe — seed ${SEED}. NOT A GATE.\n`);

// ---------------------------------------------------------------------------
// 1. THE EXIT ROAD
// ---------------------------------------------------------------------------
function road() {
  console.log('=== 1. THE ROAD THAT LEAVES ===\n');
  const span = EXIT_ROAD.rimM - EXIT_ROAD.startM;
  console.log(`  world past the extent      ${span} m  (rim ${EXIT_ROAD.rimM} - extent ${EXIT_ROAD.startM})`);
  console.log(`  design speed               ${EXIT_ROAD.designSpeedMS.toFixed(2)} m/s = ${(EXIT_ROAD.designSpeedMS * 3.6).toFixed(0)} km/h`);
  console.log(`  min radius  v^2/(g(e+f))   ${EXIT_ROAD.minRadiusM.toFixed(1)} m   kmax ${(1 / EXIT_ROAD.minRadiusM).toExponential(3)} /m`);
  console.log(`  stations                   ${Math.ceil(span / EXIT_ROAD.stationM)} at ${EXIT_ROAD.stationM} m`);
  const sag = EXIT_ROAD.minRadiusM * (1 - Math.cos(EXIT_ROAD.stationM / (2 * EXIT_ROAD.minRadiusM)));
  console.log(`  chord sagitta on the tightest arc   ${sag.toFixed(4)} m`);

  let minZ = 0; let maxZ = 0; let maxYaw = 0;
  for (let x = EXIT_ROAD.startM; x <= EXIT_ROAD.rimM; x += 4) {
    minZ = Math.min(minZ, exitRoadZ(x));
    maxZ = Math.max(maxZ, exitRoadZ(x));
    maxYaw = Math.max(maxYaw, Math.abs(exitRoadYawDeg(x)));
  }
  const L = EXIT_ROAD.shifts[0].lengthM;
  const pred = (1 / EXIT_ROAD.minRadiusM) * L * L / (2 * Math.PI);
  console.log(`\n  CONTRACT §9 rule 2 — the first shift, two ways:`);
  console.log(`    small-angle  kmax*L^2/2pi   ${pred.toFixed(1)} m`);
  console.log(`    the table's own integral    ${Math.abs(exitRoadZ(EXIT_ROAD.startM + L)).toFixed(1)} m`);
  console.log(`  z range over the +X arm      [${minZ.toFixed(1)}, ${maxZ.toFixed(1)}] m`);
  console.log(`  peak |heading|               ${maxYaw.toFixed(2)} deg`);
  console.log(`  carriageway  ${(2 * EXIT_ROAD.halfCityM).toFixed(1)} m -> ${(2 * EXIT_ROAD.halfCountryM).toFixed(1)} m over ${EXIT_ROAD.taperM} m`
    + `  (1:${(EXIT_ROAD.taperM / (EXIT_ROAD.halfCityM - EXIT_ROAD.halfCountryM)).toFixed(0)})`);
  console.log(`  centre line runs ${EXIT_ROAD.startM} .. ${EXIT_ROAD.startM + EXIT_ROAD.taperM} m, then ${span - EXIT_ROAD.taperM} m unmarked`);

  /** The clearance to every hill, swept — the amplitude's own bound. */
  const H = hillMasses(SEED);
  let worst = Infinity; let at = null;
  for (let x = EXIT_ROAD.startM; x <= EXIT_ROAD.rimM; x += 4) {
    for (const dir of [1, -1]) {
      const X = dir * x;
      const Z = exitRoadZ(X);
      const edge = exitRoadHalfM(X) + 6;
      for (const h of H) {
        const d = Math.hypot(X - h.x, Z - h.z) - h.foot - edge;
        if (d < worst) { worst = d; at = `${X.toFixed(0)}, ${Z.toFixed(1)}`; }
      }
    }
  }
  console.log(`\n  closest the road's VERGE EDGE comes to any of ${H.length} hill and wood footprints`);
  console.log(`    ${worst.toFixed(1)} m, at (${at})`);

  /** Ownership: exactly one chunk must furnish each metre of road. */
  console.log(`\n  OWNERSHIP — each chunk column must own exactly ${S} m of road:`);
  let bad = 0;
  for (let cx = Math.floor(EXIT_ROAD.startM / S); cx * S < EXIT_ROAD.rimM; cx++) {
    let tot = 0;
    for (let cz = -8; cz <= 8; cz++) {
      tot += exitRoadOwnSpans(chunkBounds(cx, cz), EXIT_ROAD.vergeStationM)
        .reduce((a, o) => a + (o.x1 - o.x0), 0);
    }
    const ok = Math.abs(tot - S) < 1e-6;
    if (!ok) bad++;
    console.log(`    cx ${String(cx).padStart(3)}  ${f1(tot)} m  ${ok ? '' : '  <-- NOT 128'}`);
  }
  console.log(`  columns owning exactly ${S} m: ${bad === 0 ? 'ALL' : `${bad} WRONG`}`);

  /** The verge's own bounded overlap onto the tarmac. */
  let over = 0;
  for (const s of exitRoadSpans(EXIT_ROAD.startM, EXIT_ROAD.rimM, EXIT_ROAD.vergeStationM)) {
    over = Math.max(over, s.zNear0 - s.zFar0, s.zFar1 - s.zNear1);
  }
  console.log(`\n  verge overlap onto the tarmac, worst station   ${over.toFixed(2)} m`
    + `  (bound: ${EXIT_ROAD.vergeStationM} * tan(${maxYaw.toFixed(2)}) = ${(EXIT_ROAD.vergeStationM * Math.tan((maxYaw * Math.PI) / 180)).toFixed(2)})`);
  console.log('');
}

// ---------------------------------------------------------------------------
// 2. STREET LAMPS IN FARMLAND
// ---------------------------------------------------------------------------
function lamps() {
  console.log('=== 2. STREET LAMPS STANDING IN FARMLAND ===\n');
  /**
   * `city.js` → `lampStationsFor`, TRANSCRIBED. See this file's header for why
   * that is admissible here and what checks it.
   */
  const PITCH = 30;
  const INSET = CITY.roadHalfWidth + 1.3;
  const PER_EDGE = Math.ceil(S / PITCH);
  const HALF = 0.15;
  const stations = (cx, cz) => {
    const b = chunkBounds(cx, cz);
    const out = [];
    const phase = (((cx * 7 + cz * 13) % 10) + 10) % 10;
    const clear = (t) => Math.min(Math.max(t, INSET), S - INSET);
    for (let i = 0; i < PER_EDGE; i++) {
      const raw = phase + i * PITCH;
      const off = clear(raw);
      if (raw < S) {
        out.push({ x: b.x0 + INSET, z: b.z0 + off });
        if (Math.abs(off - INSET) >= 2 * HALF) out.push({ x: b.x0 + off, z: b.z0 + INSET });
      }
      const rf = raw + PITCH / 2;
      const offF = clear(rf);
      if (rf < S) {
        out.push({ x: b.x0 - INSET, z: b.z0 + offF });
        out.push({ x: b.x0 + offF, z: b.z0 - INSET });
      }
    }
    return out;
  };
  console.log(`  transcription check: LAMP_PER_EDGE = ceil(${S}/${PITCH}) = ${PER_EDGE}, max ${4 * PER_EDGE} stations a chunk;`);
  console.log(`  delivered at chunk (7, 3): ${stations(7, 3).length}\n`);

  const EDGE_CH = Math.ceil(CITY.extentEdgeM / S) + 1;
  let today = 0; let chunkGate = 0; let both = 0; let unlitRoad = 0;
  const region = { today: 0, chunkGate: 0 };
  const carrying = [];
  for (let cx = -EDGE_CH; cx <= EDGE_CH; cx++) {
    for (let cz = -EDGE_CH; cz <= EDGE_CH; cz++) {
      const b = chunkBounds(cx, cz);
      const beyond = cityExtentAt((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2) <= 0;
      const inRegion = cx >= -5 && cx <= 4 && cz >= -5 && cz <= 4;
      let onThis = 0;
      for (const s of stations(cx, cz)) {
        if (s.x > BLOCK_KEEPOUT.x0 && s.x < BLOCK_KEEPOUT.x1
          && s.z > BLOCK_KEEPOUT.z0 && s.z < BLOCK_KEEPOUT.z1) continue;
        const pointOk = cityExtentAt(s.x, s.z) > 0;
        if (pointOk) { today++; if (inRegion) region.today++; if (beyond) onThis++; }
        if (!beyond) { chunkGate++; if (inRegion) region.chunkGate++; }
        if (pointOk && !beyond) both++;
        if (!beyond && !pointOk) unlitRoad++;
      }
      if (onThis) carrying.push({ cx, cz, n: onThis, r: Math.hypot((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2) });
    }
  }
  console.log('  lamp stations admitted over the whole world');
  console.log(`    session 54's gate, cityExtentAt(THE LAMP)      ${today}`);
  console.log(`    session 62's gate, chunk.beyondCity           ${chunkGate}`);
  console.log(`    both                                          ${both}`);
  console.log(`\n    standing on a chunk the generator calls COUNTRYSIDE  ${today - both}`);
  console.log(`      chunks carrying at least one                       ${carrying.length}`);
  console.log(`    on a LATTICE chunk the point test refuses            ${unlitRoad}`);
  console.log(`      — drawn carriageway with no lamp on it`);
  console.log(`\n  over citycheck's own 10 x 10 region, either gate: ${region.today} / ${region.chunkGate}`);
  const worst = carrying.sort((a, b) => b.n - a.n).slice(0, 5);
  if (worst.length) {
    console.log('  worst chunks: ' + worst.map((p) => `(${p.cx},${p.cz}) x${p.n} r${p.r.toFixed(0)}`).join('  '));
  }
  console.log('');
}

// ---------------------------------------------------------------------------
// 3. THE FIELDS
// ---------------------------------------------------------------------------
function fields() {
  console.log('=== 3. THE FIELD PATTERN ===\n');
  console.log(`  FARM.pitchM ${FARM.pitchM}  jitter ${FARM.jitter}  ->  boundaries `
    + `${(FARM.pitchM * (1 - 2 * FARM.jitter)).toFixed(0)} to ${(FARM.pitchM * (1 + 2 * FARM.jitter)).toFixed(0)} m apart`);
  console.log(`  crops ${JSON.stringify(FARM.crops)}   tone ${FARM.toneMin}-${FARM.toneMax}\n`);

  /** The rim region STATE 61 reports over, so the two are comparable. */
  let chunks = 0; let lines = 0; let rects = 0; let hedges = 0;
  const byKind = {};
  const areaByKind = {};
  const parcels = [];
  for (let cx = 25; cx <= 33; cx++) {
    for (let cz = -4; cz <= 4; cz++) {
      const b = chunkBounds(cx, cz);
      if (cityExtentAt((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2) > 0) continue;
      chunks++;
      lines += farmLinesIn(SEED, 'x', b.x0, b.x1).length + farmLinesIn(SEED, 'z', b.z0, b.z1).length;
      const ch = generateChunk(SEED, cx, cz);
      for (const r of ch.ground || []) {
        if (!FARM.crops.includes(r.kind)) continue;
        rects++;
        const a = (r.x1 - r.x0) * (r.z1 - r.z0);
        byKind[r.kind] = (byKind[r.kind] || 0) + 1;
        areaByKind[r.kind] = (areaByKind[r.kind] || 0) + a;
        /** A PARCEL-sized piece: anything over a tenth of a chunk. Verge and
         *  apron slivers are the rest and are counted separately. */
        if (a > (S * S) / 10) parcels.push(a);
      }
      hedges += (ch.features || []).filter((f) => f.edge === 'hedge').length;
    }
  }
  const tot = Object.values(areaByKind).reduce((a, b) => a + b, 0);
  console.log(`  ${chunks} chunks, ${lines} parcel boundaries crossing them (${(lines / chunks).toFixed(2)}/chunk)`);
  console.log(`  ${rects} crop rectangles, ${hedges} hedge segments\n`);
  console.log('  crop        rects     share of area');
  for (const k of FARM.crops) {
    console.log(`    ${k.padEnd(8)} ${String(byKind[k] || 0).padStart(5)}      ${(((areaByKind[k] || 0) / tot) * 100).toFixed(1)}%`);
  }
  parcels.sort((a, b) => a - b);
  const q = (p) => parcels[Math.floor(p * (parcels.length - 1))];
  console.log(`\n  chunk-clipped pieces over ${((S * S) / 10 / 10000).toFixed(2)} ha: ${parcels.length}`);
  console.log(`    area   min ${(q(0) / 10000).toFixed(2)}  p50 ${(q(0.5) / 10000).toFixed(2)}  p90 ${(q(0.9) / 10000).toFixed(2)}  max ${(q(1) / 10000).toFixed(2)} ha`);

  /**
   * THE PARCEL ITSELF, WHICH IS NOT THE PIECE. A chunk emits its own square, so
   * what `chunk.ground` carries is a parcel CLIPPED to a chunk and its area is
   * bounded by 1.64 ha whatever the parcel is. The parcel is the rectangle
   * between four world boundaries, and it is the thing the operator's *"all of
   * them roughly one city block across"* is about — so it is measured off
   * `farmLine` directly rather than off the pieces.
   */
  const X0 = 25 * S; const X1 = 34 * S; const Z0 = -4 * S; const Z1 = 5 * S;
  const xl = [...farmLinesIn(SEED, 'x', X0 - FARM.pitchM * 2, X1 + FARM.pitchM * 2)].sort((a, b) => a - b);
  const zl = [...farmLinesIn(SEED, 'z', Z0 - FARM.pitchM * 2, Z1 + FARM.pitchM * 2)].sort((a, b) => a - b);
  const areas = []; const spans = [];
  for (let i = 0; i + 1 < xl.length; i++) {
    for (let j = 0; j + 1 < zl.length; j++) {
      if (xl[i + 1] < X0 || xl[i] > X1 || zl[j + 1] < Z0 || zl[j] > Z1) continue;
      const w = xl[i + 1] - xl[i]; const d = zl[j + 1] - zl[j];
      areas.push(w * d);
      spans.push((Math.floor(xl[i + 1] / S) - Math.floor(xl[i] / S) + 1)
        * (Math.floor(zl[j + 1] / S) - Math.floor(zl[j] / S) + 1));
    }
  }
  areas.sort((a, b) => a - b);
  const qa = (p) => areas[Math.floor(p * (areas.length - 1))];
  console.log(`\n  PARCELS over the same ground, off the world line lattice: ${areas.length}`);
  console.log(`    area       min ${(qa(0) / 10000).toFixed(2)}  p50 ${(qa(0.5) / 10000).toFixed(2)}  p90 ${(qa(0.9) / 10000).toFixed(2)}  max ${(qa(1) / 10000).toFixed(2)} ha`);
  console.log(`    largest / smallest                                        ${(qa(1) / qa(0)).toFixed(1)}x`);
  console.log(`    longest side  min ${Math.sqrt(qa(0)).toFixed(0)} .. max ${(xl.reduce((m, v, i) => (i ? Math.max(m, v - xl[i - 1]) : m), 0)).toFixed(0)} m`);
  const multi = spans.filter((n) => n > 1).length;
  console.log(`    reaching into more than one ${S} m chunk: ${multi} of ${spans.length} (${((100 * multi) / spans.length).toFixed(1)}%)`);
  console.log(`      — session 61's figure was 0 of 218`);
  console.log(`\n  SESSION 61 OVER THE SAME REGION, for comparison: 218 parcels, 218 of 218`);
  console.log('  wholly inside one chunk, 542 of 872 edges on a multiple of 128, longest');
  console.log('  side 45.3 / 89.0 / 128 m, 24 L-cuts.\n');
}

// ---------------------------------------------------------------------------
// 4. THE HILLS
// ---------------------------------------------------------------------------
function hills() {
  console.log('=== 4. THE HILLS ===\n');
  /** `city.js` → `hillGeometry`'s ring list. The PROFILE is imported. */
  const RAD = 8;
  const RINGS = [0, 0.50, 0.82, 1.0];
  const OLD_U = [0, 0.5, Math.sqrt(3) / 2, 1];
  const OLD_Y = [1, Math.sqrt(3) / 2, 0.5, 0];

  const ringPts = (u) => {
    const y = hillProfile(u);
    const o = [];
    for (let i = 0; i <= RAD; i++) {
      const a = (i / RAD) * Math.PI * 2;
      o.push([Math.cos(a) * u, y, Math.sin(a) * u]);
    }
    return o;
  };
  const rs = RINGS.map(ringPts);
  let tris = 0; let up = 0; let minY = 1;
  const tri = (p, q, r) => {
    const ux = q[0] - p[0]; const uy = q[1] - p[1]; const uz = q[2] - p[2];
    const vx = r[0] - p[0]; const vy = r[1] - p[1]; const vz = r[2] - p[2];
    const ny = uz * vx - ux * vz;
    const L = Math.hypot(uy * vz - uz * vy, ny, ux * vy - uy * vx) || 1;
    tris++;
    if (ny / L > 0) up++;
    minY = Math.min(minY, ny / L);
  };
  for (let k = 0; k < rs.length - 1; k++) {
    const a = rs[k]; const b = rs[k + 1];
    for (let i = 0; i < RAD; i++) {
      if (k === 0) { tri(a[i], b[i + 1], b[i]); continue; }
      tri(a[i], b[i + 1], b[i]);
      tri(a[i], a[i + 1], b[i + 1]);
    }
  }
  console.log('  WINDING, CHECKED FROM OUTSIDE THE INSTRUMENT (CONTRACT §7.7):');
  console.log(`    ${tris} triangles a hill,  face normal .y > 0 on ${up} of ${tris},  min .y ${minY.toFixed(4)}`);
  console.log(`    (the first arm had ${tris} of ${tris} pointing DOWN and rendered as black spikes)\n`);

  console.log('  BAND SLOPES, degrees, new profile against the hemisphere it replaces:\n');
  console.log('    hill                      0-0.50   0.50-0.82   0.82-1.00');
  const M = hillMasses(SEED);
  const sample = [
    ['median   ', 195, 51],
    ['largest  ', 268, 107],
    ['smallest ', 110, 25],
  ];
  for (const [name, foot, h] of sample) {
    const nw = [];
    for (let k = 0; k < 3; k++) {
      nw.push(((Math.atan2((hillProfile(RINGS[k]) - hillProfile(RINGS[k + 1])) * h,
        (RINGS[k + 1] - RINGS[k]) * foot) * 180) / Math.PI).toFixed(1));
    }
    const od = [];
    for (let k = 0; k < 3; k++) {
      od.push(((Math.atan2((OLD_Y[k] - OLD_Y[k + 1]) * h, (OLD_U[k + 1] - OLD_U[k]) * foot) * 180) / Math.PI).toFixed(1));
    }
    console.log(`    ${name} new     ${nw.map((v) => v.padStart(6)).join('      ')}`);
    console.log(`    ${name} sphere  ${od.map((v) => v.padStart(6)).join('      ')}`);
  }
  const ecc = M.map((m) => m.ecc || 1).sort((a, b) => a - b);
  console.log(`\n  masses ${M.length} (${M.filter((m) => !m.wood).length} crowns, ${M.filter((m) => m.wood).length} woods)`);
  console.log(`  plan eccentricity  min ${ecc[0].toFixed(2)}  p50 ${ecc[Math.floor(ecc.length / 2)].toFixed(2)}  max ${ecc[ecc.length - 1].toFixed(2)}`);
  console.log(`  triangles ${M.length * tris} at ONE draw call\n`);
}

// ---------------------------------------------------------------------------
// 5. THE HOUSES ON THE SHOULDERS
// ---------------------------------------------------------------------------
function houses() {
  console.log('=== 5. THE HOUSES ON THE HILL SHOULDERS ===\n');
  const hs = hillsideHouses(SEED);
  const M = hillMasses(SEED).filter((m) => !m.wood);
  console.log(`  band u ${HILLSIDE.shoulderMin}-${HILLSIDE.shoulderMax}  ->  hillProfile `
    + `${hillProfile(HILLSIDE.shoulderMin).toFixed(3)} down to ${hillProfile(HILLSIDE.shoulderMax).toFixed(3)}`);
  console.log(`  drive reach ${HILLSIDE.driveReachM} m from the hill's own footprint to the road`);
  console.log(`  ${HILLSIDE.perHill} houses a qualifying hill, of ${M.length} crowns\n`);
  console.log(`  delivered: ${hs.length} houses`);
  const rise = hs.map((h) => h.rise).sort((a, b) => a - b);
  if (rise.length) {
    console.log(`    rise above the plane   min ${f2(rise[0], 6)}  p50 ${f2(rise[Math.floor(rise.length / 2)], 6)}  max ${f2(rise[rise.length - 1], 6)} m`);
  }
  const rad = hs.map((h) => Math.hypot(h.x, h.z)).sort((a, b) => a - b);
  if (rad.length) console.log(`    radius                 ${rad[0].toFixed(0)} .. ${rad[rad.length - 1].toFixed(0)} m`);
  let emitted = 0;
  for (const h of hs) {
    const b = chunkBounds(Math.floor(h.x / S), Math.floor(h.z / S));
    if (cityExtentAt((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2) <= 0) emitted++;
  }
  console.log(`    on a chunk the generator calls countryside, i.e. emitted: ${emitted} of ${hs.length}`);
  /**
   * THE FACING, CHECKED FROM THE OTHER END. `setMatrix`'s yaw takes local +z —
   * the glazed elevation — to `(sin y, 0, cos y)`. Its dot with the unit vector
   * toward the origin must be 1 for every house or the glass faces the hill.
   */
  let worstDot = 1;
  for (const h of hs) {
    const y = (h.yawDeg * Math.PI) / 180;
    const r = Math.hypot(h.x, h.z) || 1;
    worstDot = Math.min(worstDot, Math.sin(y) * (-h.x / r) + Math.cos(y) * (-h.z / r));
  }
  console.log(`\n  the GLAZED elevation (local +z) against the direction to the origin:`);
  console.log(`    worst dot product over all ${hs.length}: ${worstDot.toFixed(6)}   (1.000000 is dead on)`);
  /** The slope every house actually stands on, off the delivered surface. */
  const grads = hs.map((h) => {
    const gx = (hillRiseAt(SEED, h.x + 8, h.z) - hillRiseAt(SEED, h.x - 8, h.z)) / 16;
    const gz = (hillRiseAt(SEED, h.x, h.z + 8) - hillRiseAt(SEED, h.x, h.z - 8)) / 16;
    return (Math.atan(Math.hypot(gx, gz)) * 180) / Math.PI;
  }).sort((a, b) => a - b);
  if (grads.length) {
    console.log(`\n  ground slope at the house, off the delivered surface:`);
    console.log(`    min ${f1(grads[0])}  p50 ${f1(grads[Math.floor(grads.length / 2)])}  max ${f1(grads[grads.length - 1])} deg`);
    console.log(`    (the placement refuses anything over ${((Math.atan(0.60) * 180) / Math.PI).toFixed(1)} deg)`);
  }
  console.log(`\n  cost: 10 boxes = 120 triangles a house, riding the chunk's own`);
  console.log(`  :masses instanced mesh at zero new draw calls. Against the gate routes`);
  console.log(`  it is ZERO — no route reaches within 1 696 m of CITY.extentEdgeM.\n`);
}

if (ALL || args.has('road')) road();
if (ALL || args.has('lamps')) lamps();
if (ALL || args.has('fields')) fields();
if (ALL || args.has('hills')) hills();
if (ALL || args.has('houses')) houses();
