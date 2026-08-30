/**
 * river.js — the water, the quays and the bridges. Session 15.
 *
 * WHAT IS HERE AND WHAT IS IN `citygen`
 *
 * The DECISION is `src/lib/citygen.js` → `RIVER`: where the channel runs, how
 * wide it is, what it takes out of the buildable city, where the crossings are
 * and which structure each one carries. That has to be in the pure generator
 * because the worker bakes the canyon field from `generateChunk`'s occluders
 * (CONTRACT §8.1) and a river the bake does not know about is a field that
 * describes a hundred metres of masonry where the water is.
 *
 * The GEOMETRY is here, and it is a module rather than part of `city.js` for
 * one reason: CONTRACT §6 says every content system gets a bisecting switch
 * registered in `main.js`, and a switch is `register()` not being called.
 * `?river=0` therefore removes the water, the quay walls and every bridge in
 * one predicate, and `ctx.get('river')` returning undefined is what quarantine
 * already looks like from the outside.
 *
 * WHAT `?river=0` DOES NOT REMOVE, STATED HERE RATHER THAN DISCOVERED IN AN
 * A/B. The blocks the river cleared stay cleared. The cut lives in the pure
 * generator, is baked into the canyon field by a worker that is never told
 * about URL parameters, and making it conditional would give the main thread
 * and the worker two different cities — the one failure §8.1 says has no stack
 * trace. So this is a RENDERING bisect: arm B is the same city with the river's
 * surfaces not drawn, and the delta is what the water, the walls and the
 * bridges cost to shade. The earth plane's own cut follows the switch
 * (`block.js`) so that arm B is not shading a hole.
 *
 * THREE MESHES, AND THE ARITHMETIC FOR WHY IT IS THREE
 *
 *   river:water      one quad strip, world extent, the NOCTIS_WATER material
 *   river:structure  every concrete box (wall, coping, promenade, deck, pier,
 *                    abutment, arch rib, tower) as one InstancedMesh with a
 *                    per-instance albedo and roughness
 *   river:steel      the metallic parts — stay cables, arch hangers, rails
 *
 * The split between the last two is `metalness`, which is the one surface
 * property that CANNOT ride in an instance attribute: albedo rides in
 * `instanceColor` and roughness in `noctisRough`, and `city.js` learned the
 * same lesson when a 186 m lattice mast rendered as grey plastic. Everything
 * else is one draw call because it is one material.
 */

import * as THREE from 'three';
import { WATER, WATER_BODY, GROUND, waterWaves } from '../core/constants.js';
import {
  CITY,
  CORRIDOR,
  RIVER,
  riverBankStations,
  riverEnvelope,
  riverBudget,
  bridgesTouching,
  BRIDGE_STRUCTURES,
  // Session 17: `surfaceAt` reads the deck's own cross-section, so it needs the
  // same three pure functions the deck was placed from.
  riverEdges,
  onBridgeDeck,
  bridgeIndexAt,
  bridgeX,
  nearestCrossingX,
} from '../lib/citygen.js';

const DEG = Math.PI / 180;

/**
 * Metres. How far the river's structural geometry is built either side of the
 * camera.
 *
 * `CITY.detailRadius · CITY.chunkSize` = 4 × 128 = 512, the same ring the city
 * builds its facades, windows and street furniture in — because a quay wall and
 * a bridge parapet are detail of exactly that kind. Beyond it the water and the
 * earth are still there (both are world-extent meshes) and what is missing is
 * the wall, which at 512 m is 1.3 m of concrete subtending a fifth of a pixel.
 */
const BUILD_RADIUS = CITY.detailRadius * CITY.chunkSize;

/**
 * Linear reflectances. Measurements, not colours — the same convention every
 * other surface in this project uses.
 */
const CONCRETE = [0.34, 0.336, 0.325];
/** A river wall is wet at the base, weathered above, and never as pale as new concrete. */
const WALL = [0.22, 0.216, 0.205];
const COPING = [0.30, 0.297, 0.288];
/** The promenade: the same 0.26 the city's pavements are. */
const PAVING = [0.26, 0.257, 0.248];
const ASPHALT = [0.082, 0.082, 0.086];
const PAINTED_STEEL = [0.20, 0.205, 0.212];
// `WATER_BODY` moved to core/constants.js in session 42 — the weir's outlet
// pool is the second water surface and a module may not import another.

export function createRiver(options = {}) {
  const cfg = { buildRadius: BUILD_RADIUS, ...options };

  const root = new THREE.Group();
  root.name = 'river';

  const disposables = [];
  const track = (x) => {
    disposables.push(x);
    return x;
  };

  let materials = null;
  let boxGeo = null;
  let waterMesh = null;
  let structureMesh = null;
  let steelMesh = null;
  /** Which build window is currently up, as an integer chunk index in x. */
  let builtWindow = null;
  let rootSeed = '1337';
  /** What the last rebuild put in the scene, for `harness.bridgeCensus()`. */
  let bridgeRecords = [];

  const tmpMatrix = new THREE.Matrix4();
  const tmpQuat = new THREE.Quaternion();
  const tmpPos = new THREE.Vector3();
  const tmpScale = new THREE.Vector3();
  const tmpEuler = new THREE.Euler();
  const tmpColor = new THREE.Color();

  function setMatrix(x, y, z, sx, sy, sz, yawDeg, pitchRad = 0) {
    tmpPos.set(x, y, z);
    // Yaw about Y, then pitch about the LOCAL Z — the order the arch's chords
    // need, and the same composition `city.js` uses for the parabolic landmark.
    tmpEuler.set(0, yawDeg * DEG, pitchRad, 'YXZ');
    tmpQuat.setFromEuler(tmpEuler);
    tmpScale.set(sx, sy, sz);
    return tmpMatrix.compose(tmpPos, tmpQuat, tmpScale).clone();
  }

  /**
   * Yaw, in degrees, that takes a box's +X axis onto the chord (dx, dz).
   *
   * DERIVED HERE AND WRITTEN OUT, because it is the sign this project has got
   * wrong twice. A yaw θ about +Y takes +X to (cos θ, 0, −sin θ), so matching
   * (dx, dz)/L needs cos θ = dx/L and sin θ = −dz/L, i.e. θ = atan2(−dz, dx).
   * `city.js` derives the same expression for the viaduct's deck chords; two
   * copies of one formula is the arrangement CONTRACT §9.1 is a list of, and
   * the reason there are two here is that neither module may import the other.
   */
  const chordYaw = (dx, dz) => (Math.atan2(-dz, dx) * 180) / Math.PI;

  // -------------------------------------------------------------------------

  function buildMaterials(ctx) {
    const lights = ctx.get('lights');

    /**
     * One concrete material for every structural box. Linear white, because the
     * reflectance rides in `instanceColor` and three multiplies it into
     * `diffuseColor` — so the buffer IS the reflectance rather than a
     * multiplier on one, which is what `city.js` and `block.js` both do and for
     * the same reason.
     */
    const structure = new THREE.MeshStandardMaterial({ roughness: 0.72, metalness: 0 });
    structure.color.setRGB(1, 1, 1, THREE.LinearSRGBColorSpace);
    lights.patch(structure);

    const steel = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 1 });
    steel.color.setRGB(1, 1, 1, THREE.LinearSRGBColorSpace);
    lights.patch(steel);

    /**
     * The water. Everything that makes it water is in the define — see
     * `lights.js` → `WATER_GLSL` and the `NOCTIS_WATER` block of
     * `SURFACE_FRAGMENT`. The material itself carries only the body colour and
     * a roughness that the shader immediately overwrites with the one it
     * derives from the resolved wave slope; it is set here anyway so that a
     * frame drawn before the first compile is dark water rather than a mirror.
     */
    const water = new THREE.MeshStandardMaterial({
      roughness: WATER.baseRoughness,
      metalness: 0,
      envMapIntensity: 1,
    });
    water.color.setRGB(WATER_BODY[0], WATER_BODY[1], WATER_BODY[2], THREE.LinearSRGBColorSpace);
    lights.patch(water, { water: true });

    return {
      structure: track(structure),
      steel: track(steel),
      water: track(water),
    };
  }

  // -------------------------------------------------------------------------

  /**
   * The water surface: one quad strip on the shared station lattice, at
   * `-RIVER.depth`.
   *
   * IT REACHES `RIVER.wallThickness + 0.5` PAST EACH BANK, UNDER THE QUAY WALL.
   * The wall stands on the last 1.3 m of the earth plane and its water-side
   * face is exactly on the bank line, so a water surface that stopped at the
   * bank would meet the wall along a line three surfaces share — and any
   * disagreement of a millimetre between the three would be a hairline of
   * background showing through, for kilometres. Running the water under the
   * wall makes the join an overlap instead of a coincidence. The extra area is
   * never shaded: it is behind an opaque box.
   *
   * WINDING. Quad (A0, B1, B0) has e1 = (dx, 0, p), e2 = (dx, 0, q) and
   * e1 × e2 = (0, dx·(p − q), 0) with p − q = the river's own width at B, which
   * is positive by construction; quad (A0, A1, B1) gives (0, dx·width(A), 0).
   * Both +Y, which is up, which is what `FrontSide` needs. The same derivation
   * as `block.js`'s earth strip and `city.js`'s `buildGround`, written out
   * because CONTRACT §9.1 says a hand-emitted winding is derived in a comment
   * beside the emission or it is a guess.
   */
  function buildWater(extent) {
    const over = RIVER.wallThickness + 0.5;
    const y = -RIVER.depth;
    const st = riverBankStations(-extent, extent);
    const pos = [];
    for (let i = 0; i < st.length - 1; i++) {
      const a = st[i];
      const b = st[i + 1];
      const a0 = a.north - over;
      const a1 = a.south + over;
      const b0 = b.north - over;
      const b1 = b.south + over;
      pos.push(a.x, y, a0, b.x, y, b1, b.x, y, b0);
      pos.push(a.x, y, a0, a.x, y, a1, b.x, y, b1);
    }
    const arr = new Float32Array(pos);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const nrm = new Float32Array(arr.length);
    for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.computeBoundingSphere();
    return geo;
  }

  // -------------------------------------------------------------------------

  /**
   * The quay wall, the coping and the promenade, one segment per station pair,
   * both banks.
   *
   * A SEGMENT IS 6% LONGER THAN ITS CHORD. The wall follows a curve as a
   * polyline and a box is a rectangle: where the polyline turns, two adjacent
   * boxes leave a wedge open on the outside of the bend. The bank's sharpest
   * turn is 0.0029 m⁻¹, so over a 16 m chord the tangent swings 0.046 rad and
   * the wedge is `thickness · tan(0.023)` = 0.030 m wide. Six per cent of 16 m
   * is 0.96 m of overlap at each joint, which closes it thirty times over and
   * costs nothing — the overlap is inside opaque concrete.
   */
  function pushQuays(x0, x1, push) {
    const st = riverBankStations(x0, x1);
    const t = RIVER.wallThickness;
    const top = RIVER.parapet;
    /**
     * How far the wall reaches below the water. It only has to be far enough
     * that no view finds its underside, and the water above it is opaque, so
     * 0.8 m is the drafting allowance rather than a structural depth — the
     * foundation is not modelled because nothing can see it.
     */
    const toe = -(RIVER.depth + 0.8);
    const h = top - toe;

    for (let i = 0; i < st.length - 1; i++) {
      const a = st[i];
      const b = st[i + 1];
      for (const bank of [-1, 1]) {
        // −1 is the north bank (smaller z), where the land is on the −z side
        // and the wall sits at [north − t, north]; +1 is the south bank.
        const za = bank < 0 ? a.north - t / 2 : a.south + t / 2;
        const zb = bank < 0 ? b.north - t / 2 : b.south + t / 2;
        const dx = b.x - a.x;
        const dz = zb - za;
        const len = Math.hypot(dx, dz) * 1.06;
        const yaw = chordYaw(dx, dz);
        const cx = (a.x + b.x) / 2;
        const cz = (za + zb) / 2;
        push('wall', cx, (toe + top) / 2, cz, len, h, t, yaw, 0, WALL, 0.82);
        // The coping: a capping course, 0.12 m proud on each face, which is the
        // overhang `RIVER.bankStationM`'s sagitta bound is written against.
        push('coping', cx, top - 0.09, cz, len, 0.18, t + 0.24, yaw, 0, COPING, 0.66);
        // The promenade behind it. A slab rather than a ground quad because it
        // rides in this mesh for nothing, where a ground quad would be a fourth
        // material and a fourth draw call.
        const off = (bank < 0 ? -1 : 1) * (t / 2 + RIVER.promenade / 2);
        /**
         * THE PROMENADE IS A FOOTWAY AND THEREFORE SITS AT `GROUND.pavement` —
         * session 19. Its centre was the literal −0.03, chosen so that its
         * 0.12 m slab topped out at 0.030, "which is where `buildGround` puts
         * the carriageway either side of it" — a transcription of a z-fighting
         * offset into a structural height. The datum moved the pavement to
         * `BLOCK.kerbHeight`; the top is now derived from that and the slab's
         * own thickness, so the two cannot drift again.
         */
        const promSlab = 0.12;
        push('promenade', cx, GROUND.pavement - promSlab / 2, cz + off, len, promSlab, RIVER.promenade, yaw, 0, PAVING, 0.8);
      }
    }
  }

  // -------------------------------------------------------------------------

  /**
   * One bridge.
   *
   * THE THREE STRUCTURES ARE THREE ANSWERS TO ONE PROBLEM AND NOT THREE SKINS.
   * `BRIDGE_STRUCTURES` in `citygen.js` carries which era each belongs to and
   * why; what is here is the geometry each era's answer produces, and the only
   * thing they share is the deck, because the deck is the street and the street
   * is the same street on all three.
   *
   * Every part is placed from `s.clearSpan` — the water's own width at THIS
   * crossing — and never from `RIVER.halfWidth`. The half-width varies by 5.5 m
   * either way, so a bridge built to the mean lands 5 m short of the bank at the
   * wide stations. That is CONTRACT §9's failure mode with a nominal standing in
   * for a measurement, and `bridgeSpec` returns both numbers so a caller can
   * print them together.
   */
  function pushBridge(s, push, pushSteel) {
    const halfW = s.deckHalf;
    const mid = (s.deckZ0 + s.deckZ1) / 2;
    const len = s.deckLength;
    /** Deck slab: top at street grade, 0.85 m thick. `RIVER.depth`'s first term. */
    const slab = 0.85;
    const deckTop = 0.0;
    push('deck', s.x, deckTop - slab / 2, mid, halfW * 2, slab, len, 0, 0, CONCRETE, 0.74);
    /**
     * The running surface, so a bridge IS the same asphalt as the street it
     * continues — and session 19 made that true rather than nearly true. The
     * old expression topped this out at 0.030 under a comment saying that is
     * "where `buildGround` puts the carriageway either side of it"; the street
     * carriageway was at 0.020, so every bridge in the city had a 10 mm lip at
     * each end that nothing measured. The top is now `GROUND.carriageway`
     * exactly, i.e. the datum, and the lip is 0.000 by construction.
     */
    const wearing = 0.03;
    push('carriageway', s.x, GROUND.carriageway - wearing / 2, mid, CITY.roadHalfWidth * 2, wearing, len, 0, 0, ASPHALT, 0.8);
    for (const side of [-1, 1]) {
      // Footway and parapet, one each side.
      // The deck's footway, at the same `GROUND.pavement` as every other
      // pavement in the world — so the kerb ONTO a bridge is the same 0.160 m
      // kerb as the kerb off it. It was 0.060, i.e. a 0.030 m kerb on a bridge
      // against 0.010 m on a street and 0.160 m in the origin block: three
      // kerbs for one quantity, which is session 17's finding and is now one.
      const deckWalk = 0.06;
      push('footway', s.x + side * (CITY.roadHalfWidth + CITY.sidewalkWidth / 2), GROUND.pavement - deckWalk / 2,
        mid, CITY.sidewalkWidth, deckWalk, len, 0, 0, PAVING, 0.8);
      push('parapet', s.x + side * (halfW - 0.22), deckTop + RIVER.parapet / 2, mid,
        0.44, RIVER.parapet, len, 0, 0, CONCRETE, 0.7);
    }
    /**
     * Abutments. A box under each end of the deck, from the riverbed up to the
     * slab soffit, standing on the ground `riverBlocks` already keeps clear of
     * buildings.
     */
    const abutH = RIVER.depth + 0.8 - slab;
    for (const end of [-1, 1]) {
      const z = end < 0 ? s.deckZ0 + 5 : s.deckZ1 - 5;
      push('abutment', s.x, -(RIVER.depth + 0.8) + abutH / 2, z, halfW * 2 + 1.2, abutH, 10, 0, 0,
        CONCRETE, 0.8);
    }

    if (s.structure === 'girder') {
      /**
       * A continuous plate girder on two river piers. Three spans, and the
       * girder depth is `span / 22` — the ratio `RIVER.depth` was derived from,
       * so the water level and the structure agree by construction rather than
       * by coincidence.
       */
      const span = s.clearSpan / 3;
      const depth = span / 22;
      for (let g = -1; g <= 1; g++) {
        push('girder', s.x + g * (halfW - 2.2) * 0.72, -slab - depth / 2, mid,
          0.9, depth, len, 0, 0, PAINTED_STEEL, 0.52);
      }
      for (let p = 0; p < 2; p++) {
        const z = s.north + s.clearSpan * ((p + 1) / 3);
        // Pier shaft and cap. The shaft is a blade — long across the flow and
        // thin along it, which is what a pier in a river is and what makes it
        // read as one from the bank.
        push('pier', s.x, -(RIVER.depth + 0.8) + (RIVER.depth + 0.8 - slab - depth) / 2, z,
          halfW * 1.1, RIVER.depth + 0.8 - slab - depth, 3.4, 0, 0, CONCRETE, 0.8);
        push('piercap', s.x, -slab - depth - 0.35, z, halfW * 1.6, 0.7, 4.6, 0, 0, CONCRETE, 0.76);
      }
    } else if (s.structure === 'arch') {
      /**
       * A steel bowstring, one rib each side of the deck, as chords pitched
       * along a parabola — the construction `city.js` uses for the arch
       * landmark, and for the same reason: pushing a box from the deck up to
       * the curve at every station fills the opening in, and an arch with no
       * hole in it is a wall.
       */
      const rise = s.aboveDeck;
      const n = 18;
      for (const side of [-1, 1]) {
        const rx = s.x + side * (halfW - 0.6);
        for (let k = 0; k < n; k++) {
          const u = (k + 0.5) / n;
          const z = s.north + u * s.clearSpan;
          const y = rise * (1 - Math.pow(2 * u - 1, 2));
          // dy/dz of the parabola, for this chord's pitch. The box's long axis
          // is its local +X and the chord runs in z, so the yaw is 90° and the
          // pitch is about the box's own local Z after that yaw.
          const slope = (-4 * rise * (2 * u - 1)) / s.clearSpan;
          const pitch = Math.atan(slope);
          const segLen = (s.clearSpan / n) / Math.max(0.35, Math.cos(pitch));
          push('archrib', rx, y, z, segLen * 1.06, 1.5, 1.0, 90, pitch, PAINTED_STEEL, 0.46);
        }
        // Hangers, from the rib down to the deck edge.
        for (let k = 1; k < 9; k++) {
          const u = k / 9;
          const z = s.north + u * s.clearSpan;
          const y = rise * (1 - Math.pow(2 * u - 1, 2));
          pushSteel('hanger', rx, y / 2, z, 0.18, y, 0.18, 0, 0);
        }
      }
      // The tie: the deck IS the tie of a bowstring, and saying so is why there
      // is an edge beam here heavier than the girder bridge's parapet.
      for (const side of [-1, 1]) {
        push('tie', s.x + side * (halfW - 0.6), -slab - 0.55, mid, 1.1, 1.1, s.clearSpan, 0, 0,
          PAINTED_STEEL, 0.5);
      }
    } else {
      /**
       * Cable-stayed: one tower on each bank, standing on the abutment, with a
       * fan of stays to the deck. No pier touches the water, which is the whole
       * argument for the form and the reason it is the one that reads from
       * furthest away.
       */
      const tower = s.aboveDeck;
      const stays = 7;
      for (const end of [-1, 1]) {
        const tz = end < 0 ? s.north - 3.5 : s.south + 3.5;
        push('towerbase', s.x, -(RIVER.depth + 0.8) + (RIVER.depth + 0.8) / 2, tz,
          halfW * 2 + 1.0, RIVER.depth + 0.8, 7.0, 0, 0, CONCRETE, 0.78);
        for (const side of [-1, 1]) {
          const tx = s.x + side * (halfW - 1.1);
          // The leg tapers: two stacked boxes rather than one, because a
          // constant-section tower reads as a post.
          push('towerleg', tx, tower * 0.28, tz, 2.4, tower * 0.56, 3.0, 0, 0, CONCRETE, 0.6);
          push('towerhead', tx, tower * 0.78, tz, 1.7, tower * 0.44, 2.2, 0, 0, CONCRETE, 0.6);
          for (let k = 1; k <= stays; k++) {
            /**
             * A stay from the tower head to the deck at `k/stays` of the way to
             * midspan. Its length and pitch are the geometry's, not a
             * parameter: the cable is the hypotenuse of (tower height, distance
             * along the deck) and there is nothing to choose.
             */
            const along = (k / stays) * (s.clearSpan / 2 + 4);
            const dz = end < 0 ? along : -along;
            const y0 = tower * 0.96;
            const my = y0 / 2;
            const mz = tz + dz / 2;
            const l = Math.hypot(y0, dz);
            const pitch = Math.atan2(y0, Math.abs(dz)) * (dz < 0 ? 1 : -1);
            pushSteel('stay', tx, my, mz, 0.16, l, 0.16, 90, pitch - Math.PI / 2);
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------

  function rebuild(ctx, centreX) {
    const x0 = centreX - cfg.buildRadius;
    const x1 = centreX + cfg.buildRadius;

    const boxes = [];
    const skin = [];
    const steel = [];
    const steelSkin = [];
    /**
     * TWO KIND MAPS, ONE PER MESH, AND THE FIRST VERSION HAD ONE.
     *
     * `harness.sceneCensus` requires a mesh's declared breakdown to SUM to its
     * own `instanceMatrix.count` — that is the whole mechanism, and it is what
     * catches a refactor that erases a category (CONTRACT §9.1). Counting the
     * stays and the hangers into the same map as the walls declared 445 boxes
     * on a mesh holding 417, and `citycheck` said so in its first run. A label
     * that describes two meshes describes neither.
     */
    const kinds = {};
    const steelKinds = {};

    /**
     * ONE SIGNATURE, ELEVEN ARGUMENTS, NO OPTIONAL TAIL.
     *
     * The first draft let a caller pass either (yaw, albedo, rough) or
     * (yaw, pitch, albedo, rough) and sniffed the type to tell them apart.
     * An argument list that means two things is how a pitch becomes an albedo,
     * and this project has a table of exactly that mistake — so the pitch is
     * always there, always in radians, and always in the same slot.
     */
    const push = (kind, x, y, z, sx, sy, sz, yawDeg, pitchRad, albedo, rough) => {
      boxes.push(setMatrix(x, y, z, sx, sy, sz, yawDeg, pitchRad));
      skin.push({ albedo, roughness: rough });
      kinds[kind] = (kinds[kind] || 0) + 1;
    };
    const pushSteel = (kind, x, y, z, sx, sy, sz, yawDeg, pitchRad) => {
      steel.push(setMatrix(x, y, z, sx, sy, sz, yawDeg, pitchRad));
      steelSkin.push({ albedo: [0.56, 0.57, 0.58], roughness: 0.38 });
      steelKinds[kind] = (steelKinds[kind] || 0) + 1;
    };

    pushQuays(x0, x1, push);

    bridgeRecords = [];
    for (const s of bridgesTouching(rootSeed, x0, x1)) {
      bridgeRecords.push({
        i: s.i, x: s.x, structure: s.structure, era: s.era,
        clearSpan: +s.clearSpan.toFixed(2),
        nominalSpan: s.nominalSpan,
        deckLength: +s.deckLength.toFixed(2),
        aboveDeck: +s.aboveDeck.toFixed(2),
        riverPiers: s.riverPiers,
      });
      pushBridge(s, push, pushSteel);
    }

    replaceInstanced('river:structure', materials.structure, boxes, skin, kinds, (m) => {
      structureMesh = m;
    });
    replaceInstanced('river:steel', materials.steel, steel, steelSkin, steelKinds, (m) => {
      steelMesh = m;
    });
    builtWindow = centreX;
  }

  function replaceInstanced(name, material, matrices, skin, census, assign) {
    for (const o of [...root.children]) {
      if (o.name !== name) continue;
      root.remove(o);
      o.geometry.dispose();
      o.dispose();
    }
    if (!matrices.length) {
      assign(null);
      return;
    }
    const geo = boxGeo.clone();
    const rough = new Float32Array(matrices.length);
    for (let i = 0; i < matrices.length; i++) rough[i] = skin[i].roughness;
    geo.setAttribute('noctisRough', new THREE.InstancedBufferAttribute(rough, 1));
    const im = new THREE.InstancedMesh(geo, material, matrices.length);
    for (let i = 0; i < matrices.length; i++) {
      im.setMatrixAt(i, matrices[i]);
      const a = skin[i].albedo;
      tmpColor.setRGB(a[0], a[1], a[2], THREE.LinearSRGBColorSpace);
      im.setColorAt(i, tmpColor);
    }
    im.instanceMatrix.needsUpdate = true;
    im.instanceColor.needsUpdate = true;
    im.name = name;
    im.castShadow = true;
    im.receiveShadow = true;
    im.frustumCulled = true;
    im.computeBoundingSphere();
    /**
     * The label CONTRACT §9.1 asks for. `instanceMatrix.count` is the
     * measurement; this is what it gets compared to, and it has to be written
     * where the categories still exist — after the merge into one mesh there
     * are no walls and no piers, only boxes.
     */
    im.userData.noctisCensus = { chunk: 'river', ...census };
    root.add(im);
    assign(im);
  }

  // -------------------------------------------------------------------------

  return {
    name: 'river',
    needs: ['lights'],

    init(ctx) {
      rootSeed = String(ctx.config.seed);
      materials = buildMaterials(ctx);
      boxGeo = track(new THREE.BoxGeometry(1, 1, 1));

      const extent = 4000;
      const waterGeo = track(buildWater(extent));
      waterMesh = new THREE.Mesh(waterGeo, materials.water);
      waterMesh.name = 'river:water';
      waterMesh.receiveShadow = true;
      // Its bound is the world; culling it is a test that can only answer
      // "visible", exactly as `city:ground` and `block:ground` decided.
      waterMesh.frustumCulled = false;
      root.add(waterMesh);

      ctx.scene.add(root);
      rebuild(ctx, Math.round(ctx.camera.position.x / CITY.chunkSize) * CITY.chunkSize);

      /**
       * CONTRACT §9 rule 4: every number derived from another, printed beside
       * the one it came from, at the moment of derivation. The shader cannot
       * log, so the wave field's derivation is printed here — this is the only
       * place in the project where a reader can check that 3.0 m/s of wind
       * produced 7.76° of RMS slope and that a 2.4 m wave travels at 1.94 m/s
       * because √(g/k) says so and not because it looked right.
       */
      const b = riverBudget();
      const w = waterWaves();
      const env = riverEnvelope();
      console.log(
        `[noctis] river: width ${b.widthMin}–${b.widthMax} m about a mean of ${b.meanWidth} ` +
        `(= chunkSize ${CITY.chunkSize} − 2·CORRIDOR ${CORRIDOR} = ${b.island}); ` +
        `envelope z ${b.envelopeZ0} to ${b.envelopeZ1} (${b.envelopeWidth} m); ` +
        `water at −${b.depth} m = −(slab ${b.depthTerms.deckSlab} + girder ${b.depthTerms.girder} + freeboard ${b.depthTerms.freeboard}); ` +
        `bridges every ${b.bridgeSpacing} m (${RIVER.bridgeEvery} × ${CITY.chunkSize})`
      );
      console.log(
        `[noctis] river waves: Cox–Munk at U ${WATER.windSpeed} m/s → msSlope ` +
        `${w.msSlope.toFixed(5)} → rms ${w.rmsSlope.toFixed(4)} rad = ${w.rmsSlopeDeg.toFixed(2)}°, ` +
        `H_sig ${w.significantHeightM.toFixed(3)} m; ` +
        w.waves
          .map((c) => `λ${c.lambda} k${c.k.toFixed(3)} ω${c.omega.toFixed(3)} c${c.c.toFixed(2)}m/s a${c.amp.toFixed(4)}m`)
          .join('  ')
      );

      return {
        envelope: env,
        depth: RIVER.depth,
        budget: b,
        waves: w,
        /**
         * The DELIVERED bridges, off the records the last rebuild actually
         * pushed into the scene — not off `BRIDGE_STRUCTURES`, which is the
         * vocabulary and has no opinion about what was built. CONTRACT §7.2's
         * pair reads this for the measured half.
         */
        bridges: () => bridgeRecords.slice(),
        structures: () => BRIDGE_STRUCTURES.map((s) => s.name),

        /**
         * WHAT A PERSON STANDING AT (x, z) ON THE RIVER'S OWN SURFACES IS
         * STANDING ON, in the same shape `city.surfaceAt` returns, or `null`
         * where the river owns nothing and the caller should ask the city.
         *
         * Three surfaces and their heights are the ones `pushQuays` and
         * `pushBridge` above emit, derived from the same expressions rather
         * than transcribed:
         *
         *   promenade           top **`GROUND.pavement`**
         *   bridge carriageway  top **`GROUND.carriageway`** — the datum
         *   bridge footway      top **`GROUND.pavement`**
         *
         * ALL THREE WERE LITERALS UNTIL SESSION 19 and all three were wrong in
         * the same direction: 0.030, 0.030 and 0.060, transcribed from the
         * z-fighting offsets `city.js` used to emit its ground at. That gave a
         * bridge a 0.030 m kerb where the street either side had 0.010 m and the
         * origin block had 0.160 — three kerbs for one quantity, which is
         * session 17's finding — and it left a 10 mm lip at every bridge
         * approach, because the deck's asphalt topped out 10 mm above the
         * street's. Both are now zero by construction: these read `GROUND`, and
         * so does `buildGround`.
         *
         * `null` rather than a height when the point is not on the river's
         * geometry, because "the river has no opinion here" and "the ground is
         * at zero here" are different statements and conflating them is exactly
         * CONTRACT §9's shape.
         */
        surfaceAt(x, z) {
          const e = riverEdges(x);
          const t = RIVER.wallThickness;
          // On a bridge deck first: a deck crosses the water and the promenade
          // both, and where they overlap the deck is what you are standing on.
          if (onBridgeDeck(rootSeed, x, z)) {
            // The footway bands sit at ±(roadHalfWidth + sidewalkWidth/2) in
            // X, which is the axis the deck runs ACROSS: a bridge carries a
            // north–south street, so its cross-section is in x and not in z.
            const ax = Math.abs(x - nearestCrossingX(x));
            const half = CITY.roadHalfWidth;
            if (ax > half && ax <= half + CITY.sidewalkWidth) {
              return { y: GROUND.pavement, kind: 'walk', known: true };
            }
            return { y: GROUND.carriageway, kind: 'road', known: true };
          }
          /**
           * THE QUAY WALL, WHOSE TOP IS AT `RIVER.parapet` = 1.05 m AND WHICH
           * NOTHING BEFORE THIS SESSION HAD TO KNOW THE HEIGHT OF.
           *
           * `pushQuays` builds it from the waterline up to `top = RIVER.parapet`
           * with the coping capping it, 0.12 m proud on each face — so the
           * topmost surface over the band [north − t − 0.12, north + 0.12] is
           * at 1.05 m, standing 1.02 m over the promenade behind it.
           *
           * IT IS THE THING THAT STOPS A WALKER REACHING THE WATER, and it does
           * so through `PLAYER.stepUpM` = 0.20 m rather than through the mask:
           * 1.02 m is 5.1× the step height. The mask blocks the WATER and has
           * never blocked the WALL, which is 1.3 m of dry land nobody can stand
           * on that the flood fill has always counted as promenade. Recorded in
           * STATE.md; it makes `citycheck`'s walk 7.7 m wide where it is 6.4.
           */
          const cope = 0.12;
          if (z >= e.north - t - cope && z <= e.north + cope) {
            return { y: RIVER.parapet, kind: 'parapet', known: true };
          }
          if (z >= e.south - cope && z <= e.south + t + cope) {
            return { y: RIVER.parapet, kind: 'parapet', known: true };
          }
          // Promenade: a band `RIVER.promenade` wide behind each quay wall.
          const northOuter = e.north - t;
          const southOuter = e.south + t;
          if (z <= northOuter && z >= northOuter - RIVER.promenade) {
            return { y: GROUND.pavement, kind: 'walk', known: true };
          }
          if (z >= southOuter && z <= southOuter + RIVER.promenade) {
            return { y: GROUND.pavement, kind: 'walk', known: true };
          }
          return null;
        },
        stats: () => ({
          structureInstances: structureMesh ? structureMesh.count : 0,
          steelInstances: steelMesh ? steelMesh.count : 0,
          waterTriangles: waterGeo.attributes.position.count / 3,
          builtWindow,
        }),
      };
    },

    update(ctx) {
      /**
       * Rebuilt on a chunk crossing in x and never inside a frame that is not
       * already crossing one, which is a few times a minute at walking pace and
       * once every five seconds at the highway route's 24 m/s. The same cadence
       * `city.js` rebuilds its merged ground and signage meshes on, and for the
       * same reason: 600 boxes are cheaper to rebuild whole than to keep in
       * step.
       */
      const want = Math.round(ctx.camera.position.x / CITY.chunkSize) * CITY.chunkSize;
      if (want !== builtWindow) rebuild(ctx, want);
    },

    dispose(ctx) {
      ctx.scene.remove(root);
      for (const o of [...root.children]) {
        root.remove(o);
        if (o.isInstancedMesh) {
          o.geometry.dispose();
          o.dispose();
        }
      }
      for (const d of disposables) d.dispose && d.dispose();
      disposables.length = 0;
      waterMesh = structureMesh = steelMesh = null;
      builtWindow = null;
    },
  };
}
