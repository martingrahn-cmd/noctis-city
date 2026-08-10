#!/usr/bin/env node
/**
 * walkprobe.mjs — WALK THE CITY. NOT A GATE.
 *
 *   node tools/walkprobe.mjs                          the four scripted walks
 *   node tools/walkprobe.mjs --walk=quay
 *   node tools/walkprobe.mjs --spawn=64,1.74,-483 --seconds=40 --t=0
 *   node tools/walkprobe.mjs --agreement                 the mask cross-check
 *
 * Session 17. Sixteen sessions of frames came from a fixed shot, a spline or a
 * pose — from somewhere somebody had already decided was worth standing. This
 * drives the SAME controller a person drives: synthetic stick deflections
 * through the same dead zone, the same response curve, the same walkability
 * mask and the same ground query, and it writes down where it ended up.
 *
 * It asserts nothing and it must not. CONTRACT §7 on `lookat.mjs`: a gate whose
 * camera the operator chooses is measuring the operator, and this one chooses
 * where to walk. What it produces is evidence — frames, positions, and a table
 * of the surface under the feet — for a person to read.
 *
 * TWO THINGS IT DOES THAT ARE NOT LOOKING:
 *
 *  --agreement   Prints `city.walkableAt()` (the player's point query) against
 *                `city.placement().walkable` (the 4 m mask `citycheck` floods)
 *                over the mask's own grid, cell by cell. CONTRACT §9 rule 2:
 *                anything derived two ways is printed both ways at least once,
 *                in the session that derives it. The expected relation is an
 *                INCLUSION rather than an equality — the rasteriser blocks
 *                every cell a blocker touches, the point test is exact — so the
 *                interesting number is how many cells the mask calls BLOCKED
 *                whose centre is free, and whether any cell goes the other way.
 *                A single cell the other way is a defect in one of the two.
 *
 *  --heights     The delivered ground height along a transect across a street,
 *                which is how the kerb finding was measured rather than read.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { startServer, launchBrowser, openPage, readRendererString } from './lib/page.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = path.join(ROOT, 'tools', 'walk-out');

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);

/**
 * The four walks, and each one exists to go somewhere no route has been.
 *
 * `hold` is a sequence of {seconds, moveX, moveY, lookX, lookY, run} handed
 * straight to `player.setSynthetic()` — the same three numbers a thumb pushes.
 * The stick magnitudes are pre-dead-zone, so 1.0 is a stick against the gate.
 */
const WALKS = {
  /**
   * Straight down the south pavement of the main street, west, out of the
   * origin block and into the streamed city. It crosses `BLOCK_KEEPOUT.x0` at
   * x = −168, which is where the block's 0.160 m pavement stops and the
   * streamed city's 0.030 m one starts — the one genuine kerb transition the
   * world contains, walked over rather than reasoned about.
   */
  pavement: {
    spawn: [330, null, 9.7],
    yawDeg: 90,
    t: 0.78,
    hold: [{ seconds: 200, moveY: 1 }],
    shots: [0, 30, 46, 60, 120, 199],
  },
  /**
   * Off the pavement, across the carriageway, into the facade. Walks north
   * until the mask stops it, then keeps pushing — which is how you find out
   * whether "stopped" means stopped or means vibrating against a rectangle.
   */
  wall: {
    spawn: [40, null, 9.7],
    yawDeg: 0,
    t: 0.5,
    hold: [{ seconds: 30, moveY: 1 }],
    shots: [0, 10, 29],
  },
  /**
   * The quay. Spawned on the north promenade and walked at the water, which is
   * the edge `RIVER.depth` says is 4.99 m above it. Nothing in this project has
   * ever tested what a person standing at that edge sees, and STATE 16 §4.2's
   * whole sightline argument is about an eye at 1.74 m standing exactly here.
   */
  quay: {
    spawn: [64, null, -483],
    yawDeg: 180,
    t: 0.0,
    hold: [{ seconds: 40, moveY: 1 }],
    shots: [0, 15, 30, 39],
  },
  /**
   * The bridge. Walked across the water on the deck the walkability mask has
   * carried the flood fill over since session 15 — the only crossing a person
   * has, and one nobody has ever crossed.
   */
  bridge: {
    spawn: [512, null, -350],
    yawDeg: 0,
    t: 0.78,
    hold: [{ seconds: 150, moveY: 1 }],
    shots: [0, 45, 60, 75, 90, 145],
  },
};

const num = (s) => String(s).split(',').map((v) => (v === '' || v === 'null' ? null : Number(v)));

async function main() {
  await mkdir(OUT, { recursive: true });
  const { child, url } = await startServer(5199);
  const browser = await launchBrowser();
  const { page, consoleErrors, pageErrors } = await openPage(browser, {
    viewport: { width: 1600, height: 900 },
  });

  const lines = [];
  const say = (s) => {
    lines.push(s);
    console.log(s);
  };

  try {
    if (args.has('agreement')) {
      await agreement(page, url, say);
    } else if (args.has('heights')) {
      await heights(page, url, say);
    } else {
      const want = args.has('walk') ? [args.get('walk')] : Object.keys(WALKS);
      for (const name of want) {
        const w = WALKS[name];
        if (!w) {
          say(`no walk named '${name}' — have ${Object.keys(WALKS).join(', ')}`);
          continue;
        }
        await walk(page, url, name, w, say);
      }
    }
  } finally {
    if (consoleErrors.length) say(`\nCONSOLE ERRORS (${consoleErrors.length}):\n  ${consoleErrors.slice(0, 8).join('\n  ')}`);
    if (pageErrors.length) say(`\nPAGE ERRORS (${pageErrors.length}):\n  ${pageErrors.slice(0, 8).join('\n  ')}`);
    /**
     * ONE LOG PER MODE, NOT ONE LOG. `saturation-peak.png overwritten every
     * run` has been on the carried-gaps list since session 8 and this is the
     * same mistake being invited: the agreement table and the height transects
     * are the evidence behind two of this session's findings, and a fourth walk
     * would have erased both.
     */
    const mode = args.has('agreement') ? 'agreement' : args.has('heights') ? 'heights' : (args.get('walk') || 'walks');
    await writeFile(path.join(OUT, `walkprobe-${mode}.log`), lines.join('\n') + '\n');
    await browser.close();
    child.kill('SIGKILL');
  }
}

async function boot(page, url, params) {
  const q = new URLSearchParams({ player: '1', perf: '1', seed: '1337', ...params });
  await page.goto(`${url}?${q}`, { waitUntil: 'load', timeout: 90_000 });
  await page.waitForFunction(() => window.__NOCTIS_HARNESS__, null, { timeout: 60_000 });
  await page.evaluate(() => window.__NOCTIS_HARNESS__.ready);
  return readRendererString(page);
}

async function walk(page, url, name, w, say) {
  const spawn = args.has('spawn') ? num(args.get('spawn')) : w.spawn;
  const t = args.has('t') ? Number(args.get('t')) : w.t;
  const renderer = await boot(page, url, {
    t: String(t),
    spawn: spawn.map((v) => (v == null ? '' : v)).filter((v) => v !== '').length === 3
      ? spawn.join(',')
      : `${spawn[0]},${spawn[2]}`,
  });

  say(`\n=== walk: ${name} ===`);
  say(`renderer ${renderer}`);

  // Let the world arrive before the walk begins, for `lookat.mjs`'s reason
  // (STATE 16 §5): a frame captured the instant after a teleport is lit by the
  // canyon field of somewhere else.
  const ready = await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity());
  say(`field slots ready: ${JSON.stringify(ready)}`);

  await page.evaluate(([yawDeg]) => {
    const p = window.__NOCTIS__.ctx.get('player');
    if (yawDeg != null) p.teleport(...p.position.toArray(), yawDeg);
  }, [w.yawDeg]);

  const total = args.has('seconds') ? Number(args.get('seconds')) : w.hold.reduce((s, h) => s + h.seconds, 0);
  const shots = new Set((w.shots || []).map((s) => Math.round(s)));
  const trail = [];
  const dt = 1 / 60;
  const hold = w.hold[0];

  await page.evaluate((h) => {
    window.__NOCTIS__.ctx.get('player').setSynthetic({
      moveX: h.moveX || 0, moveY: h.moveY || 0,
      lookX: h.lookX || 0, lookY: h.lookY || 0,
      run: !!h.run,
    });
  }, hold);

  for (let s = 0; s < total; s++) {
    // One simulated second per step, driven by the harness so the walk is
    // reproducible: `step()` fixes dt and the player integrates `time.now`.
    await page.evaluate((n) => window.__NOCTIS_HARNESS__.step(n, 1 / 60), Math.round(1 / dt));
    const st = await page.evaluate(() => window.__NOCTIS__.ctx.get('player').state());
    trail.push({ s, ...st });
    if (shots.has(s)) {
      const shot = await page.screenshot({ type: 'png' });
      const tag = `${name}-${String(s).padStart(3, '0')}s`;
      await writeFile(path.join(OUT, `${tag}.png`), shot);
    }
  }
  await page.evaluate(() => window.__NOCTIS__.ctx.get('player').setSynthetic(null));

  // The trail, compressed to what a person reads: where the surface CHANGED,
  // where the walk stopped, and where it fell.
  const first = trail[0];
  const last = trail[trail.length - 1];
  const dist = Math.hypot(last.position[0] - first.position[0], last.position[2] - first.position[2]);
  say(
    `from ${first.position.join(',')} to ${last.position.join(',')} — ` +
    `${dist.toFixed(1)} m over ${total} s = ${(dist / total).toFixed(3)} m/s ` +
    `(walk speed is 1.400 m/s; a straight walk should read 1.400)`
  );

  let prev = null;
  const events = [];
  for (const p of trail) {
    const key = `${p.surface}@${p.surfaceY}`;
    if (key !== prev) {
      events.push(`  t=${String(p.s).padStart(3)}s  x ${p.position[0].toFixed(1).padStart(8)}  z ${p.position[2].toFixed(1).padStart(7)}  y ${p.position[1].toFixed(3).padStart(6)}  ${p.surface} at ${p.surfaceY}${p.surfaceKnown ? '' : '  STREAMING'}`);
      prev = key;
    }
    if (!p.grounded) events.push(`  t=${String(p.s).padStart(3)}s  FALLING at ${p.fallVel} m/s, y ${p.position[1].toFixed(3)}`);
  }
  say('surface transitions:');
  say(events.join('\n'));

  // Stalls: a walk that stopped moving is a walk that hit something, and where
  // it hit is the finding.
  let stalled = 0;
  for (let i = 1; i < trail.length; i++) {
    const d = Math.hypot(
      trail[i].position[0] - trail[i - 1].position[0],
      trail[i].position[2] - trail[i - 1].position[2]
    );
    if (d < 0.05) {
      if (stalled === 0) {
        say(`STOPPED at ${trail[i].position.join(',')} after ${i} s — ${d.toFixed(4)} m in that second`);
      }
      stalled++;
    }
  }
  if (stalled) say(`stalled for ${stalled} of ${trail.length} seconds`);

  await writeFile(path.join(OUT, `${name}-trail.json`), JSON.stringify(trail, null, 1));
}

/**
 * THE POINT QUERY AGAINST THE RASTERISED MASK — the same quantity two ways,
 * printed both ways once, per CONTRACT §9 rule 2.
 */
async function agreement(page, url, say) {
  await boot(page, url, { t: '0.5' });
  await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity());

  const r = await page.evaluate(() => {
    const city = window.__NOCTIS__.ctx.get('city');
    const pl = city.placement({ cx: [-1, 1], cz: [-1, 1] });
    const w = pl.walkable;
    let both = 0, neither = 0, maskOnlyBlocked = 0, pointOnlyBlocked = 0;
    const examples = [];
    for (let j = 0; j < w.height; j++) {
      for (let i = 0; i < w.width; i++) {
        const x = w.originX + (i + 0.5) * w.cell;
        const z = w.originZ + (j + 0.5) * w.cell;
        const maskBlocked = w.mask[j * w.width + i] === 1;
        const pt = city.walkableAt(x, z, 0);
        const pointBlocked = !pt.walkable;
        if (maskBlocked && pointBlocked) both++;
        else if (!maskBlocked && !pointBlocked) neither++;
        else if (maskBlocked) maskOnlyBlocked++;
        else {
          pointOnlyBlocked++;
          if (examples.length < 8) examples.push({ x, z, by: pt.by });
        }
      }
    }
    return { cells: w.width * w.height, cell: w.cell, both, neither, maskOnlyBlocked, pointOnlyBlocked, examples };
  });

  say('\n=== walkability: the point query against the rasterised mask ===');
  say(`${r.cells} cells of ${r.cell} m over a 3x3-chunk region`);
  say(`  both blocked            ${r.both}`);
  say(`  both free               ${r.neither}`);
  say(`  mask blocked, point free  ${r.maskOnlyBlocked}   EXPECTED: the rasteriser blocks every cell a blocker TOUCHES`);
  say(`  point blocked, mask free  ${r.pointOnlyBlocked}   EXPECTED ZERO: a cell the mask calls free whose centre is inside a blocker`);
  if (r.pointOnlyBlocked) say(`  examples: ${JSON.stringify(r.examples)}`);
  say(
    `  conservatism: the mask over-blocks ${((r.maskOnlyBlocked / Math.max(1, r.both + r.maskOnlyBlocked)) * 100).toFixed(1)}% ` +
    `of what it calls blocked, i.e. up to one 4 m cell of edge, which is the direction that makes ` +
    `"every landmark reachable" a statement about the player rather than about the grid.`
  );
}

/** The ground height across a street, delivered rather than read off a table. */
async function heights(page, url, say) {
  await boot(page, url, { t: '0.5' });
  await page.evaluate(() => window.__NOCTIS_HARNESS__.waitForCity());
  const r = await page.evaluate(() => {
    const ctx = window.__NOCTIS__.ctx;
    const city = ctx.get('city');
    const block = ctx.get('block');
    const rows = [];
    const at = (x, z) => {
      const c = city.surfaceAt(x, z);
      const b = block && block.surfaceAt ? block.surfaceAt(x, z) : null;
      const top = b && b.y > c.y ? b : c;
      return { x, z, city: `${c.kind}@${c.y}`, block: b ? `${b.kind}@${b.y}` : '—', top: `${top.kind}@${top.y}` };
    };
    /**
     * THREE TRANSECTS ACROSS THE SAME EAST–WEST STREET, and the third is the
     * one that matters:
     *
     *   x = 40    inside `BLOCK_KEEPOUT` — the origin block's own street
     *   x = 210   outside the keep-out (x1 = 168) but INSIDE the block's own
     *             pavement, which runs to |x| = 266.5. Both are emitted here.
     *   x = 300   past both — the streamed city on its own
     */
    for (let z = -16; z <= 16; z += 1) rows.push({ where: 'block x=40', ...at(40, z) });
    for (let z = -16; z <= 16; z += 1) rows.push({ where: 'overlap x=210', ...at(210, z) });
    for (let z = -16; z <= 16; z += 1) rows.push({ where: 'streamed x=300', ...at(300, z) });
    return rows;
  });
  say('\n=== ground height across the main street, two transects ===');
  say('where            z      city surface      block surface     delivered');
  for (const row of r) {
    say(
      `${row.where.padEnd(16)} ${String(row.z).padStart(4)}   ${String(row.city).padEnd(16)} ` +
      `${String(row.block).padEnd(16)}  ${row.top}`
    );
  }
}

await main();
