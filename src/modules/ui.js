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
 *
 * ────────────────────────────────────────────────────────────────────────────
 * AND SINCE SESSION 79 IT IS A MAP OF THE WORLD AND NOT OF THE CITY.
 *
 * The operator, walking the running build: he has never seen the harbour or the
 * airfield, *"det ar langt att ga till dem"*, and the map could not take him
 * there. It was built in session 19 when the city WAS the world, so its extent
 * came from `LANDMARKS` — the furthest of which is the condenser at 706 m — and
 * `EXTENT_M` came out at 846. Sessions 62-77 then put a countryside, 179 hills,
 * an estuary, a harbour at x 4 128 and an airfield at x 4 750 outside it, and
 * none of it was on the map. He could teleport only to places he could already
 * walk to.
 *
 * **THE EXTENT IS DERIVED FROM THE WORLD'S OWN DATA, and it is 9 821 m across
 * and not 8 000.** The brief asked for 8 km; the airfield's platform runs
 * x 4 660 to 5 398 and its north approach row reaches z 4 150, so a map of
 * +-4 000 m centred on the origin CLIPS THE WHOLE AIRFIELD. `worldView()` below
 * takes the union of every authored feature and centres on it, so the number
 * moves when the world does rather than when somebody remembers to move it.
 *
 * **AND THE RELIEF IS WHAT MAKES IT A LANDSCAPE.** `terrainHeightAt` is exactly
 * 0.000000 inside `CITY.extentEdgeM` and runs -70.9 to +106.0 outside it, so
 * one scalar per pixel draws the hills, the estuary's cut, the airfield's
 * platform and the flat plate the city stands on, and the city becomes one
 * region of the map rather than the whole of it.
 */

import {
  CITY,
  LANDMARKS,
  RIVER,
  SEA,
  HARBOUR,
  AIRFIELD,
  EXIT_ROAD,
  riverEdges,
  riverEnvelope,
  bridgeX,
  landmarkAABB,
  viaductArc,
  viaductPiers,
  terrainHeightAt,
  seaCells,
  cityExtentAt,
  hillMasses,
  hillsideHouses,
  harbourSite,
  airfieldSite,
  exitRoadZ,
  exitRoadHalfM,
} from '../lib/citygen.js';
/**
 * `GROUND.earth` is the datum `block:ground`'s vertices are written at —
 * `GROUND.earth + terrainHeightAt(x, z)`, `block.js:1705` — so a destination
 * that wants to know how high its own eye is standing has to add it. CONTRACT
 * §2.2 allows `../core/**`; `src/lib` may not, which is why the constant lives
 * there and the terrain function lives in the lib.
 */
import { GROUND } from '../core/constants.js';

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

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE WEATHER ROW — SESSION 55, AND A PRESET IS A PAIR OF §6 PARAMETERS.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The operator: *"the only way to see the city clear, wet or raining is to edit
 * the URL and reload"*. `wet` and `rainfall` are both CONTRACT §6 parameters
 * and both have live setters, so a preset is two numbers and one button — the
 * same shape the time row already has.
 *
 * **THREE OF THE FOUR PIN, AND THE FOURTH IS THE WAY BACK.** Session 44 made
 * `rainfall = -1` defer to a derived shower cycle and `>= 0` pin it, and
 * `weather.js`'s own note says the pin is *"not 'writes the same value': does
 * not write"*. A row that only pinned would take the weather away from anybody
 * who pressed it once — the city would sit in whatever state the last button
 * left it in, for ever, and the shower cycle would be a thing that used to
 * happen. So `cycle` hands BOTH states back (`releaseRainfall`, `release`) and
 * the panel prints `pinned` beside the rainfall until somebody presses it.
 *
 * **AND "CLOUDY" IS NOT HERE, DELIBERATELY.** The brief asked for clear,
 * cloudy, wet and rain and said to establish what a cloud fraction would touch
 * before building one. It touches: the sky LUT's own integral (`sky.js` marches
 * a Rayleigh/Mie atmosphere with a sun disc and has no cloud term at all), the
 * CPU-side `skyIlluminance` that has to agree with it or the photocell and the
 * shader disagree about how many lux are on the street, the sun's own
 * `intensity` and `castShadow` (overcast is a sun you cannot see and a shadow
 * that is not there), the PMREM environment the whole city's specular reads,
 * and `ATM.hazeDensity`. **Every one of the four luminance bands in
 * `look-budget.json` was derived in clear air**, so it is not an hour's work —
 * it is a session, and a session that re-bases every threshold this project
 * has. Clear, wet and rain are built; cloudy is written up in STATE.
 *
 * THE THREE NUMBERS, AND NONE OF THEM IS NEW:
 *
 *   clear   rainfall 0, wetness 0            the dry city every gate renders
 *   wet     rainfall 0, wetness 0.85         `camera.js`'s own `night_rain`
 *                                            value, and it is eight minutes
 *                                            after full rain stops:
 *                                            `DRY_TAU_S`·ln(1/0.85) = 488 s
 *                                            against a drying constant of 3000
 *   rain    rainfall 1, wetness 1            full rain is `RAIN_FULL_MMH` =
 *                                            10 mm/h, and the equilibrium
 *                                            wetness is `rainfall^0.6` = 1
 *
 * `rain` releases the wetness pin after seeding it, so the road goes on being
 * driven by the water budget instead of being frozen at the value a button
 * chose — which is the difference between a preset and a mode.
 */
const WEATHER = [
  { label: 'clear', rainfall: 0, wetness: 0, pinWet: true },
  { label: 'wet', rainfall: 0, wetness: 0.85, pinWet: true },
  { label: 'rain', rainfall: 1, wetness: 1, pinWet: false },
  { label: 'cycle', rainfall: null, wetness: null, pinWet: false },
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
#noctis-map .dests{width:236px;max-height:88vh;overflow-y:auto;margin-right:14px;font:12px/1.4 ui-monospace,Menlo,monospace;color:#cfd4da}
#noctis-map .dests h4{margin:10px 0 4px 2px;font:11px/1.4 ui-monospace,Menlo,monospace;color:#7d858e;text-transform:uppercase;letter-spacing:.08em}
#noctis-map .dests h4:first-child{margin-top:0}
#noctis-map .dests button{display:block;width:100%;text-align:left;font:inherit;color:#cfd4da;background:#14171b;border:1px solid #2a2f36;border-radius:3px;padding:5px 8px;margin:0 0 3px 0;cursor:pointer}
#noctis-map .dests button:hover{background:#242a31;border-color:#4b5661}
#noctis-map .dests button .t{float:right;color:#8b939c}
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
  let activeWeather = -1;
  /**
   * `ctx.config.seed` as a STRING, the same value `city.js` hands
   * `generateChunk` — the generator hashes its argument, so `1337` and `'1337'`
   * are two different worlds and the map must be shown the one being drawn.
   */
  let rootSeed = '1337';
  /** `worldView`'s answer, the relief raster and the destinations. All per-seed. */
  let worldCache = null;
  let reliefCache = null;
  let destCache = null;
  /** The time-preset button row, so an arrival can mark the preset it chose. */
  let presetRow = null;
  let destPanel = null;

  /**
   * THE MAPPED WORLD — CENTRE AND HALF-WIDTH IN METRES, FROM THE DATA.
   * ==================================================================
   * SESSION 79. Session 19's version took the maximum over `LANDMARKS` alone
   * and got ±846 m, which was the whole world when it was written and is now
   * the middle 8.6% of one.
   *
   * THE UNION OF EVERY AUTHORED FEATURE, and each term is here because
   * dropping it clips something the operator asked to be able to reach:
   *
   *   the city rim        `CITY.extentEdgeM` = 3 232, the disc every road is in
   *   the landmarks       unchanged from session 19, still the point of the city
   *   the hills           179 masses at seed 1337, centres 3 354–4 010 m out,
   *                       footprints reaching 418 m past their own centres
   *   the harbour         x 3 904–4 352 and its branch road back to z −132
   *   the airfield        the platform x 4 660–5 398, PLUS `approachM` past the
   *                       north threshold — the approach row runs to z 4 150 and
   *                       is the thing that is worth flying at midnight
   *   the exit road       to `rimM` = 4 000 both ways
   *   the villas          22 of them, x −3 985 to 3 854
   *
   * **MEASURED: bbox x [−4 063, 5 398], z [−4 323, 4 210], centre (667, −57),
   * half 4 731.** The margin is 180 m — more than the largest hill footprint
   * this leaves at the rim — so the half is 4 911 and the map is 9 821 m across.
   *
   * IT IS NOT CENTRED ON THE ORIGIN AND THAT IS THE POINT. The world is
   * asymmetric: everything session 62–77 added is east. Centring on the origin
   * would need a half of 5 398 to hold the airfield and would spend 1 335 m of
   * the west edge on empty skirt. The centre is where the world is.
   */
  function worldView(seed) {
    if (worldCache && worldCache.seed === seed) return worldCache;
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    const add = (ax0, ax1, az0, az1) => {
      x0 = Math.min(x0, ax0, ax1);
      x1 = Math.max(x1, ax0, ax1);
      z0 = Math.min(z0, az0, az1);
      z1 = Math.max(z1, az0, az1);
    };
    add(-CITY.extentEdgeM, CITY.extentEdgeM, -CITY.extentEdgeM, CITY.extentEdgeM);
    for (const l of LANDMARKS) {
      const a = landmarkAABB(l);
      add(a.x0, a.x1, a.z0, a.z1);
    }
    // `ecc` stretches a hill along `bearingDeg`; the reach is the long axis, so
    // this is a bound and not the shape.
    for (const h of hillMasses(seed)) {
      const r = h.foot * (h.ecc || 1);
      add(h.x - r, h.x + r, h.z - r, h.z + r);
    }
    const hb = harbourSite(seed);
    add(hb.x0, hb.x1, hb.quayZ, hb.branchZ1);
    const af = airfieldSite(seed);
    add(af.x0, af.x1, Math.min(af.z0, af.spurZ0), af.z1 + AIRFIELD.approachM);
    add(-EXIT_ROAD.rimM, EXIT_ROAD.rimM, -80, 80);
    for (const v of hillsideHouses(seed)) add(v.x - 20, v.x + 20, v.z - 20, v.z + 20);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const half = Math.max(x1 - cx, cx - x0, z1 - cz, cz - z0) + 180;
    worldCache = { seed, cx, cz, half, bbox: { x0, x1, z0, z1 } };
    return worldCache;
  }

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
  // the destinations

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * NAMED DESTINATIONS — SESSION 79, ITEM 2. A LIST, NOT PIXEL-HUNTING.
   * ═══════════════════════════════════════════════════════════════════════════
   * Clicking a point on a map of a 9 821 m world means guessing: one map pixel
   * is 19.2 m and the airfield's apron is 320 m wide, which is seventeen pixels
   * somewhere in the bottom-right eighth of the frame. A list means arriving.
   *
   * ── EVERY DESTINATION IS A POSE AND IS STATED WITH WHAT IT PROVES ──────────
   *
   * LOOK.md §7, and the rule was bought at a high price: three of the
   * twenty-three committed poses did not show their subject. `country-air`
   * looked at the villas' deliberately blank backs from 710 m and STATE
   * repeated its wrong answer for five sessions; `condenser-street` is the
   * underside of a different landmark across 60% of frame; `af-hangar-back`
   * opposes nothing but a corridor between two hangars. So each entry below
   * carries `proves`, and each was SHOT before it was shipped.
   *
   * ── THE SEVEN INSIDE THE CITY CAME OUT OF `poseprobe` ──────────────────────
   *
   * CONTRACT §9.3's seventh row is *"`tools/poseprobe.mjs` has ray-tested
   * landmark stand-offs since session 26 and the pose generator does not call
   * it"*. It is still not called by the generator — that is a separate item —
   * but it WAS called to author these, once per landmark, and the eye each one
   * carries is a pose it returned as clear. Its own advisory `fill` column is
   * quoted beside each. Three of the seven have narrow clear runs and are worth
   * naming: the weir has exactly ONE clear azimuth of the twenty-four tested
   * (315 degrees, 3 poses of 79), the condenser has three, and the arch has
   * four — which is the same street canyon `arch-street` and `stack-street`
   * have been blocked by since session 73.
   *
   * ── AND A DESTINATION CARRIES ITS OWN GROUND HEIGHT WHERE A STRUCTURE
   *    STANDS, AND ONLY THERE ─────────────────────────────────────────────────
   *
   * Item 2d. `player.teleport(x, null, z)` asks `city.worldSurfaceAt`, which
   * falls through to `block.surfaceAt` = `GROUND.earth + groundHeightAt(x, z)`
   * — a PURE function of position — wherever no chunk is resident. So on
   * ordinary terrain, `null` is right on the first frame and needs nothing
   * streamed.
   *
   * **WHERE A STRUCTURE STANDS IT IS NOT.** Measured in the running page, the
   * same query before and after the world arrived:
   *
   *     harbour quay   pre-stream  −11.918 m   arrived   2.117 m   (apronY)
   *     harbour yard   pre-stream    8.042 m   arrived   8.576 m   (yardY)
   *     airfield apron pre-stream    9.279 m   arrived  10.296 m   (level)
   *
   * A teleport reads the surface at the instant it happens, which is the world
   * the player is LEAVING; the quay is fourteen metres out. `player.js` lifts
   * the feet when the plate arrives and prints `player:bigstep` — *"a spawn or
   * a teleport into something solid"* — so nobody is trapped, but the arrival
   * is a lurch and the warning is a lie about its own cause. The four
   * destinations that stand on a built plate therefore carry `harbourSite`'s
   * and `airfieldSite`'s own levels, which are camera-independent.
   */
  function destinations(seed) {
    if (destCache && destCache.seed === seed) return destCache.list;
    const H = harbourSite(seed);
    const A = airfieldSite(seed);
    const eyeH = 1.74;
    const L = (name) => LANDMARKS.find((l) => l.name === name);

    /**
     * A POSE FROM AN EYE AND A TARGET, which is the shape `lookat.mjs --pos
     * --target` takes and therefore the shape a verifying frame can be shot in.
     * The yaw is CONTRACT §3.1's: −z is north and three.js looks down local −z,
     * so `atan2(-dx, -dz)` is the heading that puts the target on the axis.
     */
    const pose = (eye, look, extra) => {
      /**
       * A `null` FEET HEIGHT MEANS "the terrain", AND THE PITCH STILL HAS TO
       * KNOW IT. `teleport(x, null, z)` resolves it against the live world; this
       * resolves the same number in closed form so the pitch is computed from
       * where the eye will actually be. Inside `CITY.extentEdgeM` this is
       * exactly `GROUND.earth`, because `terrainHeightAt` is exactly 0 there.
       *
       * **IT IS THE TERRAIN AND NOT THE LANDMARK GROUND, and the weir is the
       * one place that shows.** Standing on the basin's rim the live surface is
       * −0.80 m and this says −0.02: `basinSurfaceAt` is a landmark's own
       * ground and no pure terrain function carries it. The teleport is
       * unaffected — it passes `null` and the live query answers — and the
       * error reaches only the pitch, at 0.78 m over a 208 m sightline, which
       * is 0.21 degrees. Written down rather than fixed, because fixing it
       * means giving this function a second ground model and CONTRACT §9.1 is a
       * list of what two ground models cost.
       */
      const feetY = eye[1] == null ? GROUND.earth + terrainHeightAt(seed, eye[0], eye[2]) : eye[1];
      const dx = look[0] - eye[0];
      const dy = look[1] - (feetY + eyeH);
      const dz = look[2] - eye[2];
      const flat = Math.hypot(dx, dz);
      return {
        eye,
        look,
        /** Where the eye will stand, for the map marker and the printed line. */
        feetY,
        yawDeg: Math.atan2(-dx, -dz) / DEG,
        pitchDeg: Math.atan2(dy, flat) / DEG,
        ...extra,
      };
    };

    const list = [
      // ── the world ────────────────────────────────────────────────────────
      pose([H.x0 + 26, H.apronY, H.quayZ + 18], [H.x1 - 52, H.apronY + 16, H.quayZ + 12], {
        key: 'harbour-quay',
        group: 'the world',
        label: 'harbour quay',
        t: 0,
        proves: 'the working quay east along the apron: three portal cranes on their rails, '
          + 'the container stacks either side and the open sea past the quay face. '
          + 'MIDNIGHT, AND SESSION 80 MEASURED WHY IT CAN BE — session 79 gave this pose dusk '
          + 'on the grounds that `glow()` deposits no light and the quay floods light nothing. '
          + 'The floods are not glow(): they are six `flood` features routed to the lamp pool '
          + 'by session 77, and at this eye the pool reads 6 active of 6 candidates with a '
          + 'median surface luminance of 3.404 cd/m2 — 17.9x session 77’s own figure at '
          + 'session 77’s own point, and 41.6% of the frame under 16/255 against 93.1% there. '
          + 'The apron is lit and the machinery is dark against it, which is what a working '
          + 'quay after dark is.',
      }),
      pose([H.branchX - 60, H.yardY, H.yardZ - 8], [H.x1 - 30, H.yardY + 12, H.shedZ + 6], {
        key: 'harbour-yard',
        group: 'the world',
        label: 'harbour yard',
        t: 0.78,
        proves: 'the container yard and the four transit sheds from the branch road, '
          + '6.35 m above the apron. Dusk, because the yard is the one part of the harbour '
          + 'that reads by its own colour rather than by a lamp.',
      }),
      pose([A.cx, A.level, A.runZ0 + 450], [A.cx, A.level + 1.7, A.runZ0 - 900], {
        key: 'airfield-threshold',
        group: 'the world',
        label: 'airfield — north threshold',
        t: 0.78,
        proves: 'standing ON the runway 450 m inside the NORTH threshold, looking out over '
          + 'it: the centreline, the two edge rows, the terminal frontage on the right and '
          + 'the hills past the coast. `runZ0` = 250 is the north end — CONTRACT §3.1 is '
          + '−Z north — so this is the row the sea cuts to 14 masts of 30. '
          + 'DUSK, AND SESSION 80 MEASURED THE REASON, WHICH IS NOT §9.3’s FIFTH ROW. At this '
          + 'eye the lamp pool reads 0 active of 0 CANDIDATES: there is no fixture within '
          + 'reach to be routed or not routed. A runway edge light, a centreline light and an '
          + 'approach light are lenses aimed at a pilot’s eye — they are lit surfaces by '
          + 'design and light nothing by design — and the nearest routed mast is on the apron '
          + '1.5 km south. Dusk is what shows the row AND the runway, and it always would be.',
      }),
      pose([(A.apX0 + A.apX1) / 2, A.level, A.apZ0 + 270], [(A.apX0 + A.apX1) / 2, A.level + 10, A.apZ0 - 20], {
        key: 'airfield-apron',
        group: 'the world',
        label: 'airfield — apron',
        t: 0.78,
        proves: 'the apron looking north at the terminal: its 302 m of modular frontage, the '
          + 'two piers reaching into the stands, the four apron floodlight masts and the '
          + '34 m control tower on the right. DUSK, AND SESSION 80 MEASURED WHY — not §9.3’s '
          + 'fifth row: at midnight this eye has 9 active lamps of 9 candidates and the '
          + 'frontage, the tower and the masts all read. What does not is the concrete, '
          + 'because session 76 solved the mast pitch so the pools land on the STANDS and '
          + 'this pose stands 270 m south of the nearest row. Midnight here is a lit building '
          + 'across a black plane; dusk is the apron this destination claims to show.',
      }),
      pose([3420, null, -450], [3900, 10, -560], {
        key: 'estuary-mouth',
        group: 'the world',
        label: 'estuary mouth',
        t: 0.5,
        proves: 'the last quay wall on the north bank running out into open water, with the '
          + 'harbour cranes on the far shore. `SEA.mouthM` is 3 300 and `flareM` 760, so this '
          + 'is where the river stops being a channel — and it is the frame `bankIsLanded` '
          + 'was written for in session 68, when this wall used to carry on over the sea.',
      }),
      pose([3283, null, 725], [3300, 12, 930], {
        key: 'hillside-villas',
        group: 'the world',
        label: 'hillside villas',
        t: 0.5,
        proves: 'FIVE of the twenty-two villas at once, on one hill shoulder, from 205 m '
          + 'downhill and in front of them — the tightest cluster at this seed, centred '
          + '(3 283, 925). `country-air` stood 710 m off their deliberately blank BACKS and '
          + 'STATE read "the villas are dark" off it for five sessions; this is the other '
          + 'side, at noon, where the shoulder band `HILLSIDE.shoulderMin/Max` puts them.',
      }),
      pose([3616, null, exitRoadZ(3616) + 10], [4100, 14, exitRoadZ(4100) - 6], {
        key: 'country-road',
        group: 'the world',
        label: 'the country road out',
        t: 0.5,
        proves: 'the exit road at its extreme bend — z −64.84 at x 3 616, the deepest of the '
          + 'three shifts — looking east down the straight toward the harbour branch.',
      }),

      // ── the city ─────────────────────────────────────────────────────────
      pose([70, null, 0.9], [-160, 22, 0.9], {
        key: 'origin-block',
        group: 'the city',
        label: 'the origin block',
        t: 0.5,
        proves: "the gate's own eye — the street every fixed shot in this project is taken "
          + 'from, and the street LOOK.md §0 calls an empty slab.',
      }),
      pose([-251.94, null, 291.58], [-270, 3.4, 394], {
        key: 'trading-street',
        group: 'the city',
        label: 'a trading street',
        t: 0.78,
        proves: "`camera.js` SHOTS.trade EXACTLY — the gate's second eye, a north-south "
          + 'street in chunk (−3, 3) carrying eleven trades of five kinds. Its target is '
          + 'the gate\u2019s own, at azimuth 280 of nine clear of thirty-nine tested by '
          + '`poseprobe`. A first arm here aimed EAST instead of down the street and '
          + 'delivered a blank brick wall with pedestrians against it.',
      }),
      pose([-430, null, -940], [L('condenser').x, 130, L('condenser').z], {
        key: 'condenser',
        group: 'the city',
        label: 'condenser  260 m',
        proves: 'poseprobe, d 380 m az 270 deg, fill 65.3%. Three clear azimuths of 24.',
      }),
      pose([248.24, null, -493.19], [L('stack').x, 66, L('stack').z], {
        key: 'stack',
        group: 'the city',
        label: 'stack  132 m',
        proves: 'poseprobe, d 200 m az 255 deg, fill 63.4%. The stepped terrace session 78 '
          + 'gave floor bands, galleries and corner piers to.',
      }),
      pose([-22.59, null, 35.45], [L('arch').x, 48, L('arch').z], {
        key: 'arch',
        group: 'the city',
        label: 'arch  96 m',
        proves: 'poseprobe, d 160 m az 285 deg, fill 70.9%. AND THE AZIMUTH IS THE ITEM: '
          + 'the arch spans 118 m along X, so its own clear azimuth 0 — which is the fullest '
          + 'frame poseprobe reports — looks straight down the span and delivers a column. '
          + 'A stand-off test answers "is anything in the way" and not "is this broadside", '
          + 'which is why the frame is still the check.',
      }),
      pose([200, null, -110], [L('exchange').x, 23, L('exchange').z], {
        key: 'exchange',
        group: 'the city',
        label: 'exchange  46 m',
        proves: 'poseprobe, d 80 m az 0 deg, fill 87.6%. Its lantern cap drew nothing at all '
          + 'until session 78 fixed an eight-argument call.',
      }),
      pose([-24.43, null, -126.35], [L('dish').x, 29, L('dish').z], {
        key: 'dish',
        group: 'the city',
        label: 'dish  58 m',
        proves: 'poseprobe, d 130 m az 15 deg, fill 72.2%.',
      }),
      pose([670, null, 430], [L('mast').x, 93, L('mast').z], {
        key: 'mast',
        group: 'the city',
        label: 'mast  186 m',
        t: 0.78,
        proves: 'poseprobe, d 200 m az 0 deg, fill 83.4%. DUSK AND NOT MIDNIGHT: a 91-member '
          + 'lattice reads by silhouette, and the midnight arm is a black sky with a city '
          + 'glow under it and no mast in it. `LANDMARKS` calls it guyed and the word "guy" '
          + 'appears nowhere in `src/`.',
      }),
      pose([L('weir').x, null, L('weir').z - L('weir').radius + 1], [L('weir').x, -8, L('weir').z + L('weir').radius - 1], {
        key: 'weir',
        group: 'the city',
        label: 'weir basin',
        proves: 'ON THE RIM, looking across and down. `basinProfile` is a 105 m lip at '
          + '+0.4 m over a floor at −10.9, and a bowl cannot be seen into from outside it: '
          + "poseprobe's own best pose, 320 m out at its one clear azimuth of 24, delivers a "
          + 'street with people on it and no basin at all. The line of sight from an eye at '
          + '1.74 over a lip at 0.4 does not reach a floor 10.9 m down until 424 m past it, '
          + 'and the bowl is 210 m across. 26 149 m2 and 4 999 m2 of jointless concrete, '
          + 'the two biggest single surfaces in the city.',
      }),
      pose([0, null, 121], [0, 16, 11], {
        key: 'viaduct',
        group: 'the city',
        label: 'the viaduct',
        t: 0.78,
        proves: 'UNDER THE DECK, from the south, looking north along the street it crosses: '
          + 'the soffit at 18.2 m, the piers and the whole arc going over. The one structure '
          + 'in the city that is not orthogonal to the grid and the most articulated object '
          + 'in the project. A first arm stood 240 m east on poseprobe\u2019s fullest '
          + 'azimuth and delivered a shopfront wall.',
      }),
    ];
    destCache = { seed, list };
    return list;
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

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * THE RELIEF — ONE SCALAR PER PIXEL, AND IT IS WHAT MAKES THIS A LANDSCAPE.
   * ═══════════════════════════════════════════════════════════════════════════
   * SESSION 79, item 1c. `terrainHeightAt(rootSeed, x, z)` is the same function
   * `block:ground` builds its vertices from, so shading by it shows the hills,
   * the estuary's cut, the airfield's platform shoulder and the flat plate the
   * city stands on — the landform, not a diagram of it.
   *
   * MEASURED: **exactly 0.000000 inside `CITY.extentEdgeM`** (the function's own
   * early return at `citygen.js:3380`), and **−70.9 to +106.0 m outside it** over
   * 63 001 samples at 32 m stations. So the city reads as one flat region and
   * everything session 62–77 built has shape.
   *
   * ── WHY IT IS A CACHED RASTER AND NOT A PER-FRAME LOOP ──────────────────────
   *
   * `update()` redraws the map on every frame it is open. `terrainHeightAt`
   * costs **1 027 ns outside the city and 24 ns inside it** (measured, warm, 200 k
   * iterations), so a 512² sample of the world is about 165 ms — a fifth of a
   * second, once, and eleven frames a second for ever if it were done per frame.
   * The world is static and the seed does not change, so this is built on the
   * first `M` and blitted afterwards.
   *
   * **512 IS DERIVED AND NOT CHOSEN.** The canvas is capped at 1 100 px, so a
   * raster cell at 512 is 2.15 map pixels — the coarsest that cannot show its own
   * grid once `imageSmoothingEnabled` interpolates it. Doubling to 1 024 costs
   * 660 ms for a cell nobody can see.
   *
   * ── THE SEA IS THE TERRAIN'S OWN CONTOUR AND THE FLOOD FILL'S OWN CELL ──────
   *
   * `river.js` draws the water as one quad per `seaCells` cell and lets the LAND
   * occlude it — its own note: *"the coast is wherever the terrain rises through
   * that plane"*, and the fill is *"dilated by one cell"* so the quad edge is
   * always under ground. A map that drew the cells as-is would therefore put
   * 128 m of water on dry land. So a pixel is sea when BOTH hold: its own
   * terrain is under `SEA.levelY` (the contour, at map resolution) AND its cell
   * is in the fill (which is what keeps an inland hollow from becoming a lake —
   * `seaCells`'s own first arm had 1 377 of 2 541 exit-road samples come back as
   * sea for exactly that reason). The fill test is one array index, so this
   * costs one `terrainHeightAt` per pixel and nothing else.
   */
  const RELIEF_N = 512;

  /**
   * THE HYPSOMETRIC RAMP. Six stops over the measured range, and the hues are
   * the world's own: `SEA` blue for water, `COUNTRYSIDE`'s olive field for the
   * low ground, `HILLS.woodAlbedo`'s dark green for the wooded flanks and its
   * `hillAlbedo` grey-brown for the crowns. Lifted well off the linear
   * reflectances those constants carry — a map is UI and is read in sRGB on a
   * dark ground, not lit — but ordered the same way, so a wooded hill reads
   * darker than the field it stands in exactly as it does in the world.
   */
  const LAND_STOPS = [
    { h: -70, c: [13, 13, 12] },
    { h: -12, c: [22, 22, 18] },
    { h: 0, c: [31, 31, 25] },
    { h: 18, c: [42, 45, 29] },
    { h: 55, c: [35, 44, 27] },
    { h: 108, c: [72, 70, 55] },
  ];

  function rampAt(h) {
    if (h <= LAND_STOPS[0].h) return LAND_STOPS[0].c;
    for (let i = 1; i < LAND_STOPS.length; i++) {
      const b = LAND_STOPS[i];
      if (h > b.h) continue;
      const a = LAND_STOPS[i - 1];
      const u = (h - a.h) / (b.h - a.h);
      return [
        a.c[0] + (b.c[0] - a.c[0]) * u,
        a.c[1] + (b.c[1] - a.c[1]) * u,
        a.c[2] + (b.c[2] - a.c[2]) * u,
      ];
    }
    return LAND_STOPS[LAND_STOPS.length - 1].c;
  }

  /**
   * A HILLSHADE OFF THE RASTER ITSELF, from the north-west, so the landform has
   * a direction. Not `terrainNormalAt` — that is a central difference at 0.5 m
   * and would resolve nothing at a 19 m cell; the gradient that matters here is
   * the one between neighbouring PIXELS, which is the shape the eye is being
   * shown. It is the only term in this file that is a picture rather than a
   * measurement, and it is applied as a multiplier so the ramp still carries the
   * height.
   */
  function reliefCanvas(seed, world) {
    if (reliefCache && reliefCache.seed === seed) return reliefCache.canvas;
    const N = RELIEF_N;
    const cv = document.createElement('canvas');
    cv.width = N;
    cv.height = N;
    const g = cv.getContext('2d');
    const img = g.createImageData(N, N);
    const d = img.data;
    const cells = seaCells(seed);
    const step = (world.half * 2) / N;
    const x0 = world.cx - world.half;
    const z0 = world.cz - world.half;
    const h = new Float32Array(N * N);
    for (let j = 0; j < N; j++) {
      const z = z0 + (j + 0.5) * step;
      for (let i = 0; i < N; i++) {
        h[j * N + i] = terrainHeightAt(seed, x0 + (i + 0.5) * step, z);
      }
    }
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const k = j * N + i;
        const y = h[k];
        // The flood fill, as an index. `seaCells` lays cells on centres.
        const ci = Math.round((x0 + (i + 0.5) * step - cells.x0) / cells.cell);
        const cj = Math.round((z0 + (j + 0.5) * step - cells.z0) / cells.cell);
        const inFill = ci >= 0 && ci < cells.nx && cj >= 0 && cj < cells.nz
          && cells.on[cj * cells.nx + ci];
        let r;
        let gg;
        let b;
        if (y < SEA.levelY && inFill) {
          // Depth below the water plane, over `SEA.deepM` = 62 m, which is what
          // the generator itself calls deep water.
          const u = Math.min(1, (SEA.levelY - y) / SEA.deepM);
          r = 16 + (5 - 16) * u;
          gg = 44 + (14 - 44) * u;
          b = 66 + (34 - 66) * u;
        } else {
          const c = rampAt(y);
          // Hillshade: the pixel-to-pixel gradient, lit from the north-west.
          const hx = h[k + (i + 1 < N ? 1 : 0)] - h[k - (i > 0 ? 1 : 0)];
          const hz = h[k + (j + 1 < N ? N : 0)] - h[k - (j > 0 ? N : 0)];
          const shade = Math.max(0.45, Math.min(1.95, 1 + (hx + hz) * 0.024));
          r = c[0] * shade;
          gg = c[1] * shade;
          b = c[2] * shade;
        }
        const o = k * 4;
        d[o] = r;
        d[o + 1] = gg;
        d[o + 2] = b;
        d[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    reliefCache = { seed, canvas: cv };
    return cv;
  }

  /** A world-space rectangle, as canvas pixels. */
  function worldRect(g, x0, z0, x1, z1, fill, stroke) {
    const a = toPx(Math.min(x0, x1), Math.min(z0, z1));
    const b = toPx(Math.max(x0, x1), Math.max(z0, z1));
    const w = Math.max(1, b.x - a.x);
    const h = Math.max(1, b.y - a.y);
    if (fill) { g.fillStyle = fill; g.fillRect(a.x, a.y, w, h); }
    if (stroke) { g.strokeStyle = stroke; g.strokeRect(a.x, a.y, w, h); }
  }

  function drawMap(ctx) {
    if (!mapCanvas) return;
    const size = Math.min(
      Math.floor(window.innerWidth * 0.94),
      Math.floor(window.innerHeight * 0.86),
      1100
    );
    mapCanvas.width = size;
    mapCanvas.height = size;
    const world = worldView(rootSeed);
    view = { cx: world.cx, cz: world.cz, mpp: (world.half * 2) / size, size };
    const EXTENT_M = world.half;

    const g = mapCanvas.getContext('2d');
    g.fillStyle = '#07080a';
    g.fillRect(0, 0, size, size);

    /**
     * --- THE LANDFORM, FIRST AND UNDER EVERYTHING. One blit of the cached
     * raster. `imageSmoothingEnabled` is left on: the raster is a sampling of a
     * continuous field and nearest-neighbour would draw its own 19 m lattice,
     * which is the map claiming a resolution the sampling does not have.
     */
    g.imageSmoothingEnabled = true;
    g.drawImage(reliefCanvas(rootSeed, world), 0, 0, size, size);

    /**
     * --- THE CITY'S OWN GROUND. `terrainHeightAt` is 0 over the whole disc, so
     * the relief cannot distinguish the city from the flat country beside it —
     * `cityExtentAt` can, and it is the same falloff `densityAt` multiplies by.
     * Drawn as the disc's rim rather than as a fill, because filling it would
     * hide the relief the ramp already put there.
     */
    {
      const c = toPx(0, 0);
      const r = CITY.extentEdgeM / view.mpp;
      const grad = g.createRadialGradient(c.x, c.y, (CITY.extentCoreM / view.mpp) * 0.6, c.x, c.y, r);
      grad.addColorStop(0, 'rgba(112,104,92,0.42)');
      grad.addColorStop(1, 'rgba(112,104,92,0.04)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(c.x, c.y, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(168,158,132,0.42)';
      g.lineWidth = 1;
      g.beginPath(); g.arc(c.x, c.y, r, 0, Math.PI * 2); g.stroke();
    }

    /**
     * --- the street grid. Roads run on every chunk boundary in both axes, and
     * the lattice is CLIPPED TO THE CITY DISC since session 79: `cityExtentAt`
     * is 0 past `extentEdgeM` and there is no carriageway out there, so drawing
     * the arithmetic lattice over the whole 9.8 km would be the map making the
     * same claim `traffic.js`'s signal loop made until session 75 — a lattice
     * asserted over a world it was never laid on.
     */
    g.strokeStyle = 'rgba(126,134,146,0.34)';
    g.lineWidth = Math.max(0.5, (CITY.roadHalfWidth * 2) / view.mpp);
    const E = CITY.extentEdgeM;
    const first = Math.ceil(-E / CITY.chunkSize);
    const last = Math.floor(E / CITY.chunkSize);
    for (let i = first; i <= last; i++) {
      const w = i * CITY.chunkSize;
      // Chord of the disc at this offset, so a road stops where the city does.
      const halfChord = Math.sqrt(Math.max(0, E * E - w * w));
      if (halfChord < 1) continue;
      const a = toPx(w, -halfChord);
      const b = toPx(w, halfChord);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      const c = toPx(-halfChord, w);
      const d = toPx(halfChord, w);
      g.beginPath(); g.moveTo(c.x, c.y); g.lineTo(d.x, d.y); g.stroke();
    }

    /**
     * THE RIVER, FROM ITS OWN BANK FUNCTIONS. `riverEdges(x)` is what the
     * generator cuts buildings and roads against and what `river.js` builds the
     * quay walls on, so the map's water is the water — not a straight band
     * through `riverEnvelope()`, which is a BOUND and is 147.6 m wide where the
     * channel's mean is 104.6.
     */
    /**
     * AND IT IS CLIPPED TO +-4 000 SINCE SESSION 79, WHICH IS WHERE THE WATER
     * IS. `riverEdges(x)` is a sinusoid and answers everywhere; the drawn strip
     * is `river.js:1174`'s `const extent = 4000` — the earth plane's own
     * half-width — and east of `SEA.mouthM` the estuary is already in the relief
     * raster's sea. Running the polygon to the map's own +-4 911 would draw a
     * 900 m canal across dry countryside, which is a map asserting geometry
     * nobody emits.
     */
    const RIVER_X = 4000;
    g.fillStyle = '#12303f';
    g.beginPath();
    for (let x = -RIVER_X; x <= RIVER_X; x += 8) {
      const e = riverEdges(x);
      const p = toPx(x, e.north);
      if (x === -RIVER_X) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
    }
    for (let x = RIVER_X; x >= -RIVER_X; x -= 8) {
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
    const crossingXsOnMap = [];
    for (let i = -6; i <= 6; i++) crossingXsOnMap.push(bridgeX(i));
    for (const ex of RIVER.extraCrossingsX) crossingXsOnMap.push(ex);
    for (const bx of crossingXsOnMap) {
      if (Math.abs(bx) > CITY.extentEdgeM) continue;
      const a = toPx(bx, env.z0 - 12);
      const b = toPx(bx, env.z1 + 12);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    }

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * THE COUNTRY ROAD, THE HARBOUR AND THE AIRFIELD — SESSION 79, ITEM 1.
     * ═══════════════════════════════════════════════════════════════════════
     * The three things the operator has never seen, and the reason he has never
     * seen them is that they were not on this map. Every number below is read
     * out of `citygen.js` at this seed by the same functions `block.js` and
     * `river.js` build the geometry from, so the map cannot show a harbour
     * somewhere the harbour is not.
     */
    const harbour = harbourSite(rootSeed);
    const airfield = airfieldSite(rootSeed);

    /**
     * --- THE EXIT ROAD. `exitRoadZ(x)` is tabulated once at module scope in the
     * generator and read by `block.js` for the ribbon, so this is the road's own
     * centreline including its three shifts — the bend reaches z = −64.84 at
     * x = 3 616, which is the only feature between the city and the coast.
     *
     * PAST `rimM` = 4 000 THE TABLE CLAMPS and the road is dead straight at
     * z = −30.0188 out to `TERRAIN.skirtM`. That constant z is exactly what
     * `harbourSite.branchZ0` and `airfieldSite.spurZ0` both inherit — the branch
     * and the spur hang off the straight section — so drawing the road to the
     * map edge is drawing the ribbon `block.js` actually emits.
     */
    g.strokeStyle = '#9b937f';
    g.lineJoin = 'round';
    // The map's own two edges in x, so neither arm is drawn past the frame.
    const edgeE = world.cx + EXTENT_M;
    const edgeW = -(world.cx - EXTENT_M);
    for (const [side, far] of [[-1, edgeW], [1, edgeE]]) {
      g.beginPath();
      for (let ax = CITY.extentEdgeM; ax <= far; ax += 16) {
        const x = side * ax;
        const p = toPx(x, exitRoadZ(x));
        if (ax === CITY.extentEdgeM) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
      }
      // `exitRoadHalfM` tapers 7.5 → 3.5 over `taperM`; at 19 m a pixel this is
      // sub-pixel either way, so the line is drawn at a legible minimum and the
      // taper is not a claim this map makes.
      g.lineWidth = Math.max(1.4, (exitRoadHalfM(EXIT_ROAD.rimM) * 2) / view.mpp);
      g.stroke();
    }

    // --- the harbour branch and the airfield spur, both off the straight road.
    g.lineWidth = Math.max(1.2, (HARBOUR.branchHalfM * 2) / view.mpp);
    {
      const a = toPx(harbour.branchX, harbour.branchZ0);
      const b = toPx(harbour.branchX, harbour.branchZ1);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      const c = toPx(airfield.spurX, airfield.spurZ0);
      const d = toPx(airfield.spurX, airfield.spurZ1);
      g.beginPath(); g.moveTo(c.x, c.y); g.lineTo(d.x, d.y); g.stroke();
    }

    /**
     * --- THE HARBOUR. Three terraces at three levels — quay face at
     * `quayZ` −224, apron to `apronZ` −188 at y 2.117, container yard to
     * `yardZ` −132 at y 8.470 — over a 448 m run. The three cranes stand on the
     * apron at `craneEveryM` 140 and the four transit sheds at `shedZ` −108.
     */
    worldRect(g, harbour.x0, harbour.quayZ, harbour.x1, harbour.apronZ, '#4a5058', null);
    worldRect(g, harbour.x0, harbour.apronZ, harbour.x1, harbour.yardZ, '#585b52', null);
    worldRect(g, harbour.x0, harbour.quayZ, harbour.x1, harbour.yardZ, null, '#98a2ac');
    g.fillStyle = '#c8ad72';
    for (let c = 0; c < HARBOUR.cranes; c++) {
      const cx2 = harbour.x0 + (harbour.x1 - harbour.x0) * ((c + 0.5) / HARBOUR.cranes);
      worldRect(g, cx2 - 6, harbour.quayZ, cx2 + 6, harbour.quayZ + HARBOUR.craneGaugeM, '#c8ad72', null);
    }
    for (let i = 0; i < HARBOUR.sheds; i++) {
      const sx = harbour.x0 + (harbour.x1 - harbour.x0) * ((i + 0.5) / HARBOUR.sheds);
      worldRect(g, sx - HARBOUR.shedLenM / 2, harbour.shedZ - HARBOUR.shedWideM / 2,
        sx + HARBOUR.shedLenM / 2, harbour.shedZ + HARBOUR.shedWideM / 2, '#6b6f66', null);
    }

    /**
     * --- THE AIRFIELD, WHICH IS ABOUT THE SIZE OF THE CITY. A 3 000 m runway
     * against a 3 232 m city radius: at world scale it is a real object and not
     * a dot, which is item 1d and is the reason the extent had to grow rather
     * than the airfield shrink.
     *
     * The platform, the runway, the parallel taxiway at `taxiOffM` = 118 and the
     * apron are all `airfieldSite`'s own rectangles. The APPROACH ROWS are drawn
     * because they are the reason to go there at midnight, and because they are
     * asymmetric in a way no map has ever shown.
     *
     * **AND THE ASYMMETRY GOES THE OTHER WAY FROM THE OBVIOUS READING.**
     * CONTRACT §3.1 is `+X east, −Z north`, so `runZ0` = 250 is the NORTH
     * threshold and `runZ1` = 3 250 is the SOUTH one — the smaller z is the
     * further north. The sea is north (its cells run z −5 248 to −128), so it is
     * the NORTH row that walks into the water and breaks: **14 masts of 30,
     * stopping at z −170**, against the south row's full 30 reaching z 4 150.
     * Counted here, in Node, against the generator's own break rule, because a
     * threshold called by the wrong compass point is exactly CONTRACT §9's
     * shape with a bearing.
     */
    worldRect(g, airfield.x0, airfield.z0, airfield.x1, airfield.z1, 'rgba(120,124,110,0.30)', 'rgba(160,168,150,0.45)');
    worldRect(g, airfield.runX0 - AIRFIELD.shoulderM, airfield.runZ0,
      airfield.runX1 + AIRFIELD.shoulderM, airfield.runZ1, '#3e4247', null);
    worldRect(g, airfield.runX0, airfield.runZ0, airfield.runX1, airfield.runZ1, '#5b6068', null);
    worldRect(g, airfield.tX - AIRFIELD.taxiWideM / 2, airfield.runZ0,
      airfield.tX + AIRFIELD.taxiWideM / 2, airfield.runZ1, '#4a4f55', null);
    worldRect(g, airfield.apX0, airfield.apZ0, airfield.apX1, airfield.apZ1, '#54585c', '#8d949c');
    g.fillStyle = '#d8c48a';
    for (const [z0a, dir] of [[airfield.runZ0, -1], [airfield.runZ1, 1]]) {
      for (let i = 1; i <= AIRFIELD.approachM / AIRFIELD.approachStepM; i++) {
        const z = z0a + dir * i * AIRFIELD.approachStepM;
        // The row walks out and BREAKS at the first station that is not dry —
        // `citygen.js`'s own emission rule, and it is why the south row is 14
        // masts and the north row is 30.
        if (terrainHeightAt(rootSeed, airfield.cx, z) < SEA.levelY + AIRFIELD.approachDryM) break;
        const p = toPx(airfield.cx, z);
        const w = i % 5 === 0 ? 3 : 1.4;
        g.fillRect(p.x - w, p.y - 0.7, w * 2, 1.4);
      }
    }

    /**
     * --- THE HILLSIDE VILLAS. 22 of them at this seed, on the shoulders of the
     * hills at 3 293–4 079 m. They are on the map because `country-air` is one
     * of the three committed poses LOOK.md §7 records as lying about its own
     * subject — it looked at their deliberately blank backs from 710 m and STATE
     * repeated *"the villas are dark"* for five sessions on its authority.
     */
    g.fillStyle = '#d6b98a';
    for (const v2 of hillsideHouses(rootSeed)) {
      const p = toPx(v2.x, v2.z);
      g.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
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

    /**
     * --- the eight landmarks, marked AND NAMED. They are the point of the city
     * half of this map, and SESSION 79 HAD TO STAGGER THE LABELS.
     *
     * All eight stand inside r = 706 m. At session 19's 11.2 m a pixel that was
     * 126 px of separation and the names sat beside their own boxes; at this
     * map's 19.2 m a pixel it is 74 px and seven of the eight names overlapped
     * into one illegible block — which the first frame of this item showed
     * plainly. So the label is lifted onto a stack ordered by z, with a leader
     * back to its own marker: the marker stays where the landmark is and the
     * name is somewhere it can be read, which is the ordinary answer and is why
     * every printed map does it.
     */
    const named = LANDMARKS.filter((l) => l.kind !== 'viaduct')
      .slice()
      .sort((a, b) => a.z - b.z);
    g.textBaseline = 'middle';
    g.font = '11px ui-monospace, Menlo, monospace';
    {
      const anchor = toPx(0, 0);
      const rowH = 14;
      const top = anchor.y - ((named.length - 1) * rowH) / 2;
      const labelX = anchor.x + CITY.extentCoreM / view.mpp * 0.55;
      named.forEach((l, i) => {
        const a = landmarkAABB(l);
        const p0 = toPx(a.x0, a.z0);
        const p1 = toPx(a.x1, a.z1);
        g.fillStyle = 'rgba(206,158,88,0.30)';
        g.fillRect(p0.x, p0.y, Math.max(2, p1.x - p0.x), Math.max(2, p1.y - p0.y));
        g.strokeStyle = '#c49656';
        g.lineWidth = 1;
        g.strokeRect(p0.x, p0.y, Math.max(2, p1.x - p0.x), Math.max(2, p1.y - p0.y));
        const c = toPx(l.x, l.z);
        const ly = top + i * rowH;
        g.strokeStyle = 'rgba(196,150,86,0.45)';
        g.beginPath(); g.moveTo(c.x, c.y); g.lineTo(labelX - 4, ly); g.stroke();
        g.fillStyle = '#e8d7b4';
        g.fillText(`${l.name}  ${Math.round(l.height)} m`, labelX, ly);
      });
    }

    /**
     * --- and the three places outside the city are named where they stand,
     * because out here there is nothing to collide with.
     */
    g.fillStyle = '#cfd8e0';
    g.fillText('harbour', toPx(harbour.x1, harbour.apronZ).x + 8, toPx(harbour.x1, harbour.apronZ).y);
    // Placed INSIDE the platform: `airfield.x1` is 180 m from the map's own east
    // edge — which is the derived margin — so a label hung outside it is cut off.
    g.fillText('airfield', toPx(airfield.x0, airfield.cz).x - 62, toPx(airfield.x0, airfield.cz).y);
    g.fillText('estuary', toPx(SEA.mouthM + 320, riverEdges(SEA.mouthM + 320).north - 90).x,
      toPx(SEA.mouthM + 320, riverEdges(SEA.mouthM + 320).north - 90).y);

    // --- the origin block, which is where every fixed shot in the project is.
    const o0 = toPx(-168, -46);
    const o1 = toPx(168, 46);
    g.strokeStyle = '#3d5a3d';
    g.setLineDash([4, 3]);
    g.strokeRect(o0.x, o0.y, o1.x - o0.x, o1.y - o0.y);
    g.setLineDash([]);

    /**
     * --- THE DESTINATIONS, MARKED WHERE THEY STAND AND POINTING WHERE THEY
     * LOOK. A destination is a pose and not a place, so the marker carries the
     * bearing too — which is also the cheapest check on the list itself: a
     * tick whose whisker points away from its own subject is a pose that has
     * stopped proving what it says it proves, and LOOK.md §7 says that is a
     * defect somebody can notice.
     */
    for (const d of destinations(rootSeed)) {
      const p = toPx(d.eye[0], d.eye[2]);
      const q = toPx(d.look[0], d.look[2]);
      const dl = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      g.strokeStyle = 'rgba(122,196,214,0.55)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x + ((q.x - p.x) / dl) * 13, p.y + ((q.y - p.y) / dl) * 13);
      g.stroke();
      g.fillStyle = '#7ac4d6';
      g.beginPath(); g.arc(p.x, p.y, 2.6, 0, Math.PI * 2); g.fill();
    }

    /**
     * --- WHERE THE EYE IS NOW, AND ITEM 3's PREMISE IS FALSE: THIS HAS BEEN
     * HERE SINCE SESSION 19. The brief asked for the player's own position and
     * heading on the map "so a teleport is orientation rather than
     * disorientation"; the circle and the whisker were in the first version.
     *
     * WHAT SESSION 79 CHANGED IS THAT THE MAP GREW UNDER THEM. At session 19's
     * 11.2 m a pixel the eye was a 5 px ring on a 1 692 m map and there was
     * nothing else on it; at 19.2 m a pixel there are seventeen cyan
     * destination ticks and the white ring reads as an eighteenth. So the ring
     * is filled, the whisker is 22 px, and both get a dark halo — one stroke
     * under each, which is what makes a marker legible over a relief raster
     * whose local value it cannot know.
     */
    const cam = ctx.camera;
    const me = toPx(cam.position.x, cam.position.z);
    // Heading, off the camera's own basis rather than off a stored yaw.
    const e = cam.matrixWorld.elements;
    const fx = -e[8];
    const fz = -e[10];
    const fl = Math.hypot(fx, fz) || 1;
    for (const [colour, width, grow] of [['rgba(6,7,9,0.85)', 4.5, 1.6], ['#ffffff', 1.8, 0]]) {
      g.strokeStyle = colour;
      g.lineWidth = width;
      g.beginPath(); g.arc(me.x, me.y, 5.5 + grow, 0, Math.PI * 2); g.stroke();
      g.beginPath();
      g.moveTo(me.x + (fx / fl) * 5.5, me.y + (fz / fl) * 5.5);
      g.lineTo(me.x + (fx / fl) * 22, me.y + (fz / fl) * 22);
      g.stroke();
    }
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(me.x, me.y, 2.4, 0, Math.PI * 2); g.fill();

    /**
     * --- north, because a map without one is a picture, AND A SCALE BAR,
     * because at 9 821 m across "how far is that" stopped being obvious. The
     * bar is a round number of kilometres chosen so it is between a fifth and a
     * third of the frame, so it is a bar and not a hairline.
     */
    g.fillStyle = '#c3cbd4';
    g.font = '12px ui-monospace, Menlo, monospace';
    g.fillText('N', size / 2 - 4, 16);
    const barM = [500, 1000, 2000, 5000].find((m) => m / (EXTENT_M * 2) > 0.18) || 5000;
    const barPx = barM / view.mpp;
    const bx0 = 16;
    const by = size - 22;
    g.strokeStyle = '#c3cbd4';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(bx0, by - 4); g.lineTo(bx0, by); g.lineTo(bx0 + barPx, by); g.lineTo(bx0 + barPx, by - 4);
    g.stroke();
    g.fillText(`${barM >= 1000 ? `${barM / 1000} km` : `${barM} m`}`, bx0 + barPx + 8, by - 1);
    g.fillStyle = '#8b939c';
    g.fillText(
      `${Math.round(EXTENT_M * 2)} m across   eye ${cam.position.x.toFixed(0)}, ${cam.position.z.toFixed(0)}`,
      16, size - 40
    );
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
    /**
     * AND THE SEA, WHICH `walkableAt` DOES NOT BLOCK — SESSION 79, and it is a
     * defect this map created by growing.
     *
     * `city.walkableAt` blocks buildings, landmark ground, the origin block and
     * `inRiver`. It has never blocked `isSeaAt`, because until this session no
     * map could put a click on the sea: session 19's extent was +-846 m and the
     * estuary starts at x 3 300. Measured before this guard: a click at
     * (4 500, −600) was accepted and put the player on the seabed at
     * **y −60.451 m** under 55 m of water.
     *
     * THE TEST IS THE RASTER'S OWN, not `isSeaAt`. `isSeaAt` reads the fill's
     * 128 m cell, which is dilated by one cell on purpose (`river.js`'s note),
     * so it says "sea" up to 128 m inland — a predicate that refuses dry land is
     * the wrong direction for a thing that only ever says no. The pair used
     * here — under `SEA.levelY` AND in the fill — is the coast the terrain
     * itself draws, which is where `river.js` says the shoreline is.
     */
    const seaGrid = seaCells(rootSeed);
    const si = Math.round((x - seaGrid.x0) / seaGrid.cell);
    const sj = Math.round((z - seaGrid.z0) / seaGrid.cell);
    const inFill = si >= 0 && si < seaGrid.nx && sj >= 0 && sj < seaGrid.nz
      && seaGrid.on[sj * seaGrid.nx + si];
    if (inFill && terrainHeightAt(rootSeed, x, z) < SEA.levelY) {
      mapFoot.textContent =
        `refused: ${x.toFixed(0)}, ${z.toFixed(0)} is open water ` +
        `${(SEA.levelY - terrainHeightAt(rootSeed, x, z)).toFixed(1)} m deep — ` +
        `the map will not teleport somewhere the player could not have walked`;
      return;
    }
    player.teleport(x, null, z);
    const line = player.line ? player.line() : '';
    mapFoot.textContent = line.split('\n').pop().trim();
    setMapOpen(ctx, false);
  }

  /**
   * ARRIVING. One call, and the three things a destination carries.
   *
   * `resetHistory` is `teleport`'s own (`player.js`), and `setTimeOfDay` emits
   * `discontinuous: true` for the same reason — CONTRACT §5.10, a previous
   * frame that describes a different world.
   */
  function goTo(ctx, d) {
    const player = ctx.get('player');
    if (!player || !player.teleport) {
      mapFoot.textContent = 'no player module — add ?player=1 to the URL';
      return;
    }
    player.teleport(d.eye[0], d.eye[1], d.eye[2], d.yawDeg, d.pitchDeg);
    /**
     * A DESTINATION MAY CARRY A TIME OF DAY AS A SUGGESTION — item 2c, and it
     * is a suggestion in the plainest sense: it sets the four-preset menu that
     * already exists and the operator can press any other one. The airfield's
     * approach row at noon shows nothing.
     */
    if (d.t != null) {
      const time = ctx.get('time');
      if (time) {
        time.setTimeOfDay(d.t);
        const i = PRESETS.findIndex((pp) => pp.t === d.t);
        if (i >= 0 && presetRow) { activePreset = i; markGroup(presetRow, i); }
      }
    }
    mapFoot.textContent =
      `${d.label} — ${d.eye[0].toFixed(0)}, ${d.feetY.toFixed(2)}, ${d.eye[2].toFixed(0)}  ` +
      `yaw ${d.yawDeg.toFixed(0)}\u00b0 pitch ${d.pitchDeg.toFixed(0)}\u00b0` +
      `${d.t == null ? '' : `  t ${d.t}`}\n${d.proves}`;
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

      /**
       * THE SEED, AS A STRING, AND IT IS THE SAME LINE `city.js:11162` AND
       * `river.js:1170` BOTH WRITE. The generator hashes its `rootSeed`
       * argument, so `1337` and `'1337'` are two different worlds — a map that
       * defaulted to the module-scope literal would be right at 1337 and would
       * silently draw a different world at any other seed, which is
       * `harbourSite`'s own recorded lesson (`aircraft.js:177`).
       */
      rootSeed = String(ctx.config.seed);

      const style = el('style');
      style.textContent = CSS;
      document.head.appendChild(style);

      root = el('div');
      root.id = 'noctis-ui';

      // --- time presets ----------------------------------------------------
      const timeRow = el('div', 'row');
      timeRow.appendChild(el('span', 'lbl', 'time'));
      const presetBox = el('span', 'row');
      presetRow = presetBox;
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

      // --- weather ----------------------------------------------------------
      const wxRow = el('div', 'row');
      wxRow.appendChild(el('span', 'lbl', 'weather'));
      const wxBox = el('span', 'row');
      wxBox.style.background = 'none';
      wxBox.style.padding = '0';
      WEATHER.forEach((w, i) => {
        const b = button(w.label, () => {
          const weather = ctx.get('weather');
          const lights = ctx.get('lights');
          /**
           * `?rain=0` leaves `weather` unregistered — an ordinary bisecting
           * switch (CONTRACT §6) — and `ctx.get()` returning undefined is what
           * quarantine looks like from the outside, so this must work without
           * it. Wetness still can be set, because it is `lights`'s uniform and
           * not the weather module's state; rainfall cannot, because there are
           * no particles to rain.
           */
          if (w.rainfall == null) {
            if (weather) {
              weather.releaseRainfall();
              weather.release();
            }
            activeWeather = i;
            markGroup(wxBox, i);
            return;
          }
          if (weather) weather.setRainfall(w.rainfall);
          if (weather) weather.override(w.wetness);
          else if (lights) lights.setWetness(w.wetness);
          /**
           * `rain` seeds the wetness and then hands it back, so the road keeps
           * being driven by the water budget rather than frozen at the number a
           * button chose. `clear` and `wet` are STATES of the surface and stay
           * pinned: releasing them would let the drying law walk `wet` back to
           * zero while the operator is looking at it.
           */
          if (!w.pinWet && weather) weather.release();
          activeWeather = i;
          markGroup(wxBox, i);
        });
        b.title = w.rainfall == null
          ? 'hand rainfall and wetness back to the shower cycle'
          : `pins rainfall ${w.rainfall.toFixed(2)} (${(w.rainfall * 10).toFixed(1)} mm/h)` +
            `, wetness ${w.wetness.toFixed(2)}${w.pinWet ? ' (pinned)' : ' then released'}`;
        wxBox.appendChild(b);
      });
      wxRow.appendChild(wxBox);
      root.appendChild(wxRow);

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
      mapFoot = el('div', 'foot',
        'click a walkable place to teleport, or pick a destination — M or Esc to close');

      /**
       * THE DESTINATION PANEL. Plain buttons in two groups, and the groups are
       * "the world" first because the world is what the operator has never
       * seen. Each button's `title` is the pose's own `proves` sentence, so the
       * claim travels with the thing that makes it.
       */
      destPanel = el('div', 'dests');
      let lastGroup = null;
      for (const d of destinations(rootSeed)) {
        if (d.group !== lastGroup) {
          destPanel.appendChild(el('h4', null, d.group));
          lastGroup = d.group;
        }
        const b = button(d.label, () => goTo(ctx, d));
        b.title = d.proves;
        if (d.t != null) {
          const t = el('span', 't', PRESETS.find((pp) => pp.t === d.t).label);
          b.appendChild(t);
        }
        destPanel.appendChild(b);
      }

      mapWrap.appendChild(destPanel);
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
      console.log(
        '[noctis] ui: weather — clear/wet/rain PIN rainfall off session 44\'s shower cycle ' +
        '(rainfall 0/0/1 = 0.0/0.0/10.0 mm/h, wetness 0/0.85/1); "cycle" hands both back and the ' +
        'city goes on raining every 48.4 min on its own. The HUD prints "pinned" beside the rate ' +
        'while one of the first three is held. NO CLOUDY: overcast is not a parameter in this ' +
        'project — it would need a cloud term in the sky LUT, a matching skyIlluminance, the sun\'s ' +
        'own intensity and shadow, the PMREM environment and the haze, and all four look bands were ' +
        'derived in clear air'
      );

      return {
        /** For the console and for a probe. No verdicts. */
        state: () => ({
          mapOpen,
          rate: RATES[activeRate].label,
          preset: activePreset,
          weather: activeWeather < 0 ? null : WEATHER[activeWeather].label,
        }),
        openMap: (on) => setMapOpen(ctx, on !== false),
        /**
         * The destinations, for a probe. No verdicts — and it hands out the
         * SAME objects the buttons call `goTo` with, so a frame shot from this
         * list is a frame of the pose that ships. A verification that rebuilt
         * the pose beside the thing it verifies is CONTRACT §9.1's own subject
         * with a camera, which is the mistake `tools/lib/poses.mjs` was created
         * in session 70 to stop.
         */
        destinationList: () => destinations(rootSeed),
        goTo: (key) => {
          const d = destinations(rootSeed).find((q) => q.key === key);
          if (!d) return false;
          goTo(ctx, d);
          return true;
        },
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
