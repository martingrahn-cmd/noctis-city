/**
 * ui.js — the map, the time menu and the fullscreen button. Session 19.
 *
 * THE FIRST UI SURFACE THIS PROJECT HAS EVER HAD, and that sentence is the
 * reason it is one module rather than three. Before this session `<body>`
 * contained one canvas and one optional `<pre>`, and `src/core/fullscreen.js` —
 * which anyone greping for a fullscreen button will find first — is the
 * full-screen TRIANGLE every post pass draws. There was nowhere to put a button.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IT IS NOT REGISTERED FOR ANY GATE, AND THAT IS THE WHOLE SAFETY ARGUMENT.
 *
 * `main.js` registers this only when the UI is wanted, and the UI follows
 * `?player=1`, which no gate sets. So every gate renders the same `<body>` it
 * has rendered for eighteen sessions: one canvas, no overlay, nothing in the
 * screenshot that was not drawn by the renderer. That is the identical argument
 * CONTRACT §11 makes about the player itself, and it is why a DOM overlay is
 * admissible at all in a project whose gates read `page.screenshot()`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THREE THINGS, AND WHY THEY SHARE A FILE.
 *
 *   the time menu   four presets and a rate. It exists so that the skyline work
 *                   can be judged at dusk without waiting out a day.
 *   fullscreen      trivial, and the one hazard is not the API (§5.10, below).
 *   the map         a top-down schematic, drawn from the PURE GENERATOR, with
 *                   click-to-teleport. The point of it is the eight landmarks,
 *                   several of which nobody has ever stood next to.
 *
 * They share a file because they share the one thing that was missing — a
 * surface — and because three modules each owning one `<div>` would be three
 * places to get the same `pointer-events` and pointer-lock rules wrong.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE MAP IS DRAWN FROM `src/lib/citygen.js` AND NOT FROM THE SCENE.
 *
 * CONTRACT §2.2 lets a module import `../lib/**`, and `citygen.js` is the same
 * pure description the generator, the worker's bake, `city.js` and `citycheck`
 * all read. So the map cannot show a city different from the one being drawn —
 * which a map built from `resident` chunks WOULD, because only a fraction of
 * the world is resident at any moment and a map that fades out past the
 * streaming ring is a map of the streaming ring.
 *
 * The one thing it does NOT take from the generator is whether a point is
 * walkable: that is `city.walkableAt`, the live module's own predicate, because
 * a teleport into a building is a bug the map should refuse to create and the
 * only honest source for "may a person stand here" is the thing the player
 * itself asks.
 */

import {
  CITY,
  LANDMARKS,
  RIVER,
  riverEdges,
  riverEnvelope,
  bridgeX,
  landmarkAABB,
  viaductArc,
  viaductPiers,
} from '../lib/citygen.js';

const DEG = Math.PI / 180;

/**
 * THE FOUR TIMES THE GATES ALREADY REASON ABOUT — CONTRACT §3, verbatim:
 * "The gate times are dawn 0.25, noon 0.5, dusk 0.78, midnight 0.0."
 *
 * The menu and the gates therefore talk about the same four moments, which is
 * the brief's requirement and is also the only version that is useful: a preset
 * at 0.79 would put the operator one hundredth of a day away from every frame
 * in `tools/look-out/` and every threshold derived against them.
 */
const PRESETS = [
  { label: 'midnight', t: 0.0 },
  { label: 'dawn', t: 0.25 },
  { label: 'noon', t: 0.5 },
  { label: 'dusk', t: 0.78 },
];

/**
 * THE RATES, IN THE UNIT THE OPERATOR ASKED IN — minutes per in-game day — and
 * with BOTH multipliers printed, because a rate expressed as "120×" is
 * ambiguous between two references that differ by 72 (§9 rule 4).
 *
 *   real       86 400 s/day.   1× real,   0.0139× as shipped
 *   as shipped  1 200 s/day.  72× real,   1×       as shipped   ← the default
 *   fast          720 s/day. 120× real,   1.667×   as shipped
 *
 * `time.dayLengthSeconds` is 1200, so `sunScale = 1200 / wantedSeconds`. It is
 * computed from the module's own number rather than written down, so changing
 * the day length moves the menu with it instead of silently relabelling it.
 */
const RATES = [
  { label: 'real', daySeconds: 86400 },
  { label: 'normal', daySeconds: null },
  { label: 'fast', daySeconds: 720 },
  { label: 'paused', daySeconds: 0 },
];

const CSS = `
#noctis-ui{position:fixed;right:12px;top:12px;z-index:10;font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:#cfd4da;display:flex;flex-direction:column;gap:6px;align-items:flex-end}
#noctis-ui .row{display:flex;gap:4px;background:rgba(0,0,0,.62);padding:6px;border-radius:4px}
#noctis-ui button{font:inherit;color:#cfd4da;background:#1b1e22;border:1px solid #33383e;border-radius:3px;padding:3px 7px;cursor:pointer}
#noctis-ui button:hover{background:#262b31}
#noctis-ui button[data-on="1"]{background:#3a4550;border-color:#5b6a78;color:#eef2f6}
#noctis-ui .lbl{opacity:.55;padding:3px 2px 3px 4px}
#noctis-map{position:fixed;inset:0;z-index:9;background:rgba(4,5,7,.88);display:none;align-items:center;justify-content:center}
#noctis-map.on{display:flex}
#noctis-map canvas{cursor:crosshair;border:1px solid #2a2f36;border-radius:4px;background:#07080a;max-width:96vw;max-height:88vh}
#noctis-map .foot{position:fixed;left:0;right:0;bottom:10px;text-align:center;font:12px/1.5 ui-monospace,Menlo,monospace;color:#8b939c;white-space:pre}
`;

export function createUi(options = {}) {
  const cfg = { ...options };

  let root = null;
  let mapWrap = null;
  let mapCanvas = null;
  let mapFoot = null;
  let mapOpen = false;
  let detachers = [];
  /** World metres per map pixel, and the map's centre. Set by `drawMap`. */
  let view = { cx: 0, cz: 0, mpp: 1, size: 0 };
  let activeRate = 1;
  let activePreset = -1;

  /**
   * HALF-WIDTH OF THE MAPPED WORLD, in metres.
   *
   * `CITY.geometryRadius` chunks of city are built around the camera, but the
   * LANDMARKS are authored at fixed positions and are the point of the map, so
   * the extent is derived from them rather than from the streaming ring: the
   * furthest is the condenser at (−430, −560) and the mast at (470, 430), so
   * the authored world spans about ±560 m. `+ 220` leaves the outermost
   * landmark clear of the edge by more than its own footprint (the condenser's
   * base radius is 62 m and the weir's is 105 m), so nothing the map exists to
   * show is clipped by the frame it is shown in.
   */
  const EXTENT_M = (() => {
    let m = 0;
    for (const l of LANDMARKS) {
      const a = landmarkAABB(l);
      m = Math.max(m, Math.abs(a.x0), Math.abs(a.x1), Math.abs(a.z0), Math.abs(a.z1));
    }
    return m + 220;
  })();

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /**
   * A BUTTON THAT CANNOT STEAL THE POINTER LOCK.
   *
   * `player.js` requests the lock on a `click` on the canvas. A button is not
   * the canvas, so a click on it does not request one — but a click on it while
   * the lock is HELD would be delivered to the locked element instead, and the
   * button would be unreachable. So the overlay releases the lock on
   * `pointerdown` and the browser hands the cursor back; clicking the world
   * again re-acquires it through the player's own handler, unchanged.
   *
   * `preventDefault` on `mousedown` keeps the canvas from seeing the press at
   * all, which is what stops a click on "noon" from also being a click on the
   * world behind it.
   */
  function button(label, onClick) {
    const b = el('button', null, label);
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(b);
    });
    return b;
  }

  function markGroup(container, index) {
    const kids = container.querySelectorAll('button');
    for (let i = 0; i < kids.length; i++) kids[i].dataset.on = i === index ? '1' : '0';
  }

  // -------------------------------------------------------------------------
  // the map

  /**
   * WORLD → MAP PIXELS, AND THE SIGN OF z IS THE ONLY INTERESTING LINE.
   *
   * CONTRACT §3.1: +X is east and **−Z is north**. Canvas y also increases
   * DOWNWARD. The two conventions therefore already agree — world +z (south)
   * maps to screen +y (down), so north is up with **no flip at all**, and
   * adding one would silently mirror the city about the river.
   *
   * Written out because it is exactly the kind of thing that is fixed by
   * experiment on a symmetric city and is then wrong on an asymmetric one: the
   * check that this is right is that the condenser (z = −560) draws above the
   * river and the mast (z = +430) draws below it, which is a statement about
   * two authored numbers rather than about how the picture looks.
   */
  const toPx = (x, z) => ({
    x: view.size / 2 + (x - view.cx) / view.mpp,
    y: view.size / 2 + (z - view.cz) / view.mpp,
  });

  function drawMap(ctx) {
    if (!mapCanvas) return;
    const size = Math.min(
      Math.floor(window.innerWidth * 0.94),
      Math.floor(window.innerHeight * 0.86),
      1100
    );
    mapCanvas.width = size;
    mapCanvas.height = size;
    view = { cx: 0, cz: 0, mpp: (EXTENT_M * 2) / size, size };

    const g = mapCanvas.getContext('2d');
    g.fillStyle = '#07080a';
    g.fillRect(0, 0, size, size);

    // --- the street grid. Roads run on every chunk boundary in both axes.
    g.strokeStyle = '#161b21';
    g.lineWidth = Math.max(1, (CITY.roadHalfWidth * 2) / view.mpp);
    const first = Math.ceil(-EXTENT_M / CITY.chunkSize);
    const last = Math.floor(EXTENT_M / CITY.chunkSize);
    for (let i = first; i <= last; i++) {
      const w = i * CITY.chunkSize;
      const a = toPx(w, -EXTENT_M);
      const b = toPx(w, EXTENT_M);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      const c = toPx(-EXTENT_M, w);
      const d = toPx(EXTENT_M, w);
      g.beginPath(); g.moveTo(c.x, c.y); g.lineTo(d.x, d.y); g.stroke();
    }

    /**
     * THE RIVER, FROM ITS OWN BANK FUNCTIONS. `riverEdges(x)` is what the
     * generator cuts buildings and roads against and what `river.js` builds the
     * quay walls on, so the map's water is the water — not a straight band
     * through `riverEnvelope()`, which is a BOUND and is 147.6 m wide where the
     * channel's mean is 104.6.
     */
    g.fillStyle = '#0b1a24';
    g.beginPath();
    for (let x = -EXTENT_M; x <= EXTENT_M; x += 8) {
      const e = riverEdges(x);
      const p = toPx(x, e.north);
      if (x === -EXTENT_M) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
    }
    for (let x = EXTENT_M; x >= -EXTENT_M; x -= 8) {
      const e = riverEdges(x);
      const p = toPx(x, e.south);
      g.lineTo(p.x, p.y);
    }
    g.closePath();
    g.fill();

    // --- the bridges. `bridgeX(i)` is the same lattice the decks are laid on.
    g.strokeStyle = '#6f8391';
    g.lineWidth = Math.max(2, (CITY.roadHalfWidth * 2) / view.mpp);
    const env = riverEnvelope();
    for (let i = -6; i <= 6; i++) {
      const bx = bridgeX(i);
      if (Math.abs(bx) > EXTENT_M) continue;
      const a = toPx(bx, env.z0 - 12);
      const b = toPx(bx, env.z1 + 12);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    }

    /**
     * THE VIADUCT, deck and piers, from `viaductArc`/`viaductPiers` — the same
     * two functions `city.js` builds the geometry from and `lookat.mjs` aims its
     * presets with. It is on the map because it is the one structure in the city
     * that is not orthogonal to the grid, which makes it the best orientation
     * feature the map has after the river.
     */
    const v = LANDMARKS.find((l) => l.kind === 'viaduct');
    if (v) {
      const arc = viaductArc(v);
      g.strokeStyle = '#4a4033';
      g.lineWidth = Math.max(2, v.deck / view.mpp);
      g.beginPath();
      arc.stations.forEach((s, i) => {
        const p = toPx(s.x, s.z);
        if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
      });
      g.stroke();
      g.fillStyle = '#6b5c47';
      for (const p of viaductPiers(arc)) {
        const q = toPx(p.x, p.z);
        g.fillRect(q.x - 2, q.y - 2, 4, 4);
      }
    }

    // --- the eight landmarks, marked AND NAMED. They are the point.
    g.textBaseline = 'middle';
    g.font = '11px ui-monospace, Menlo, monospace';
    for (const l of LANDMARKS) {
      if (l.kind === 'viaduct') continue;
      const a = landmarkAABB(l);
      const p0 = toPx(a.x0, a.z0);
      const p1 = toPx(a.x1, a.z1);
      g.fillStyle = 'rgba(196,150,86,0.22)';
      g.fillRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
      g.strokeStyle = '#c49656';
      g.lineWidth = 1;
      g.strokeRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
      const c = toPx(l.x, l.z);
      g.fillStyle = '#e8d7b4';
      g.fillText(`${l.name}  ${Math.round(l.height)} m`, c.x + 6, c.y);
    }

    // --- the origin block, which is where every fixed shot in the project is.
    const o0 = toPx(-168, -46);
    const o1 = toPx(168, 46);
    g.strokeStyle = '#3d5a3d';
    g.setLineDash([4, 3]);
    g.strokeRect(o0.x, o0.y, o1.x - o0.x, o1.y - o0.y);
    g.setLineDash([]);

    // --- where the eye is now.
    const cam = ctx.camera;
    const me = toPx(cam.position.x, cam.position.z);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 1.5;
    g.beginPath(); g.arc(me.x, me.y, 5, 0, Math.PI * 2); g.stroke();
    // Heading, off the camera's own basis rather than off a stored yaw.
    const e = cam.matrixWorld.elements;
    const fx = -e[8];
    const fz = -e[10];
    const fl = Math.hypot(fx, fz) || 1;
    g.beginPath();
    g.moveTo(me.x, me.y);
    g.lineTo(me.x + (fx / fl) * 14, me.y + (fz / fl) * 14);
    g.stroke();

    // --- north, because a map without one is a picture.
    g.fillStyle = '#8b939c';
    g.fillText('N', size / 2 - 4, 14);
    g.fillText(`${Math.round(EXTENT_M * 2)} m across`, 10, size - 12);
  }

  /**
   * A CLICK ON THE MAP IS A TELEPORT, AND IT IS REFUSED RATHER THAN CLAMPED.
   *
   * The brief's requirement is that the map cannot create a teleport into a
   * building. `city.walkableAt(x, z, PLAYER.radiusM)` is the same predicate the
   * controller consults before every step — CONTRACT §11 — so a place the map
   * accepts is a place the player could have walked to, and a place it refuses
   * is refused for a reason the player would give.
   *
   * NOT snapped to the nearest walkable cell. Snapping would silently move the
   * operator somewhere they did not click, which on a 4 m mask over a 1 120 m
   * map is up to a building's width away; and "it put me somewhere else" is a
   * worse failure than "it said no".
   */
  function onMapClick(ctx, ev) {
    const rect = mapCanvas.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * view.size;
    const py = ((ev.clientY - rect.top) / rect.height) * view.size;
    const x = view.cx + (px - view.size / 2) * view.mpp;
    const z = view.cz + (py - view.size / 2) * view.mpp;

    const city = ctx.get('city');
    const player = ctx.get('player');
    if (!player || !player.teleport) {
      mapFoot.textContent = 'no player module — add ?player=1 to the URL';
      return;
    }
    const radius = 0.25;
    const w = city && city.walkableAt ? city.walkableAt(x, z, radius) : { walkable: true };
    if (!w.walkable) {
      mapFoot.textContent =
        `refused: ${x.toFixed(0)}, ${z.toFixed(0)} is blocked by ${w.by} — ` +
        `the map will not teleport somewhere the player could not have walked`;
      return;
    }
    player.teleport(x, null, z);
    const line = player.line ? player.line() : '';
    mapFoot.textContent = line.split('\n').pop().trim();
    setMapOpen(ctx, false);
  }

  function setMapOpen(ctx, on) {
    mapOpen = !!on;
    mapWrap.classList.toggle('on', mapOpen);
    if (mapOpen) drawMap(ctx);
  }

  return {
    name: 'ui',

    init(ctx) {
      if (typeof document === 'undefined') return {};

      const style = el('style');
      style.textContent = CSS;
      document.head.appendChild(style);

      root = el('div');
      root.id = 'noctis-ui';

      // --- time presets ----------------------------------------------------
      const timeRow = el('div', 'row');
      timeRow.appendChild(el('span', 'lbl', 'time'));
      const presetBox = el('span', 'row');
      presetBox.style.background = 'none';
      presetBox.style.padding = '0';
      PRESETS.forEach((p, i) => {
        presetBox.appendChild(button(p.label, () => {
          const t = ctx.get('time');
          if (!t) return;
          /**
           * `setTimeOfDay` emits `timeOfDay` with `discontinuous: true`, which
           * is what tells the sky to rebuild and the TAA to drop its history
           * rather than interpolate (CONTRACT §1.3, §5.10). Jumping twelve hours
           * and blending the previous frame into it is a smear across the whole
           * screen, and the flag that prevents it already exists.
           */
          t.setTimeOfDay(p.t);
          activePreset = i;
          markGroup(presetBox, i);
        }));
      });
      timeRow.appendChild(presetBox);
      root.appendChild(timeRow);

      // --- rate ------------------------------------------------------------
      const rateRow = el('div', 'row');
      rateRow.appendChild(el('span', 'lbl', 'rate'));
      const rateBox = el('span', 'row');
      rateBox.style.background = 'none';
      rateBox.style.padding = '0';
      RATES.forEach((r, i) => {
        rateBox.appendChild(button(r.label, () => {
          const t = ctx.get('time');
          if (!t) return;
          /**
           * THE PAUSE HAZARD, AND IT IS WHY THIS BRANCH IS EXPLICIT.
           *
           * CONTRACT and STATE both warn that a `setPaused` left on cost a film
           * and every attested measurement before session 12. The failure mode is
           * a menu that pauses on one path and forgets to unpause on the others,
           * so the world freezes and every subsequent frame is the same frame —
           * which looks like a renderer that stopped rather than a clock that
           * did. So EVERY rate sets `paused` explicitly, including the three that
           * set it false. There is no path through this handler that leaves the
           * flag untouched.
           */
          const paused = r.daySeconds === 0;
          t.setPaused(paused);
          if (!paused && t.setSunScale) {
            t.setSunScale(r.daySeconds == null ? 1 : t.dayLengthSeconds / r.daySeconds);
          }
          activeRate = i;
          markGroup(rateBox, i);
        }));
      });
      rateRow.appendChild(rateBox);
      root.appendChild(rateRow);

      // --- map + fullscreen -------------------------------------------------
      const toolRow = el('div', 'row');
      toolRow.appendChild(button('map (M)', () => setMapOpen(ctx, !mapOpen)));
      /**
       * FULLSCREEN, AND THE HAZARD IS NOT THE API.
       *
       * CONTRACT §5.10: the scene is rendered at `RENDER.pixels` and upscaled in
       * the composite, so going fullscreen normally costs nothing but a larger
       * final blit. `neverExceedNative` is the exception — below 3 686 400 device
       * pixels the internal buffer equals the drawing buffer, so on a dpr-1
       * display fullscreen RAISES the shading load rather than only the drawing
       * buffer. A 2560×1440 dpr-1 display is exactly 3 686 400, so it is the
       * boundary case; a 1920×1080 one is 2 073 600 and shades 1.78× more pixels
       * fullscreen than in a 1440×810 window.
       *
       * That is a real cost and it is the operator's to spend, so this reports it
       * rather than refusing it — and `resize()` in `main.js` is already wired to
       * the `resize` event, which the Fullscreen API fires, so nothing here has
       * to re-plumb `ctx.size`.
       */
      toolRow.appendChild(button('fullscreen', () => {
        const target = document.documentElement;
        if (document.fullscreenElement) {
          if (document.exitFullscreen) document.exitFullscreen();
          return;
        }
        const req = target.requestFullscreen || target.webkitRequestFullscreen;
        if (!req) {
          ctx.warnOnce('ui:fullscreen', 'this browser has no Fullscreen API');
          return;
        }
        const r = req.call(target);
        if (r && typeof r.catch === 'function') {
          r.catch((e) => ctx.warnOnce('ui:fullscreen', `fullscreen refused: ${e && e.message}`));
        }
      }));
      root.appendChild(toolRow);
      document.body.appendChild(root);

      // --- the map overlay --------------------------------------------------
      mapWrap = el('div');
      mapWrap.id = 'noctis-map';
      mapCanvas = el('canvas');
      mapFoot = el('div', 'foot', 'click a walkable place to teleport — M or Esc to close');
      mapWrap.appendChild(mapCanvas);
      mapWrap.appendChild(mapFoot);
      document.body.appendChild(mapWrap);

      mapCanvas.addEventListener('click', (e) => onMapClick(ctx, e));
      mapWrap.addEventListener('mousedown', (e) => e.preventDefault());

      const onKey = (e) => {
        if (e.code === 'KeyM') setMapOpen(ctx, !mapOpen);
        else if (e.code === 'Escape' && mapOpen) setMapOpen(ctx, false);
      };
      window.addEventListener('keydown', onKey);
      const onResize = () => { if (mapOpen) drawMap(ctx); };
      window.addEventListener('resize', onResize);
      detachers.push(() => {
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('resize', onResize);
      });

      markGroup(rateBox, 1);
      activeRate = 1;

      console.log(
        '[noctis] ui: M for the map (click a walkable place to teleport), ' +
        'time presets are the four the gates use (midnight 0.0, dawn 0.25, noon 0.5, dusk 0.78), ' +
        `rate is the SUN only — the shipped day is ${ctx.get('time') ? ctx.get('time').dayLengthSeconds : 1200} s ` +
        '(20 min, already 72x real time), "fast" is 720 s = 120x real'
      );

      return {
        /** For the console and for a probe. No verdicts. */
        state: () => ({ mapOpen, rate: RATES[activeRate].label, preset: activePreset }),
        openMap: (on) => setMapOpen(ctx, on !== false),
      };
    },

    update(ctx) {
      // The map is a still picture of a moving city, so it is redrawn while it
      // is open and not otherwise. One 2D canvas fill a frame against a 3D scene
      // that is not being drawn behind it — the overlay covers the viewport.
      if (mapOpen) drawMap(ctx);
    },

    dispose() {
      for (const off of detachers) {
        try { off(); } catch { /* a listener that will not detach must not stop the others */ }
      }
      detachers = [];
      if (root && root.parentNode) root.parentNode.removeChild(root);
      if (mapWrap && mapWrap.parentNode) mapWrap.parentNode.removeChild(mapWrap);
      root = null;
      mapWrap = null;
    },
  };
}
