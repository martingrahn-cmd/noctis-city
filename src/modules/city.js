/**
 * city.js — the streaming city. CONTRACT §11.
 *
 * WHAT THIS MODULE IS RESPONSIBLE FOR
 *
 * Deciding which chunks should be resident, building their geometry, giving
 * their bytes back when they leave, and keeping the total under a ceiling that
 * is counted rather than hoped for. The *content* of a chunk is decided by
 * `lib/citygen.js`, which is pure and knows nothing about three.js; the canyon
 * field is baked by a worker and owned by `canyon.js`. This module is the part
 * that has to happen on the main thread, and so it is the part that has a frame
 * budget.
 *
 * THE THREE RINGS, AND WHY THEY ARE DIFFERENT SIZES
 *
 *   detail (3)    everything: facades, windows, signage, props, street lighting
 *   geometry (6)  massing only — the building boxes and the road surface
 *   field (2)     a baked canyon field; beyond it, the analytic default
 *
 * The field ring is the smallest and that is not a compromise, it is the right
 * answer. Indirect light is a low-frequency term on surfaces near the camera; at
 * 400 m a facade is a few pixels wide and the difference between a bake and the
 * analytic profile is below a quantisation step. Making the most expensive thing
 * the largest ring is how a streaming budget gets spent on what nobody can see.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *
 * The origin block. `block.js` builds a hand-tuned street around the origin that
 * the look gate measures frame by frame, and the generator does not place
 * buildings inside its keep-out. That is not a special case bolted on: the block
 * is the authored core of the city, it is where the camera spends its time, and
 * it keeps its own higher-resolution canyon field for the same reason.
 */

import * as THREE from 'three';
import { LIGHT, LAMP_BOWL, LUMINAIRE, CLUSTER, GROUND } from '../core/constants.js';
import { EMITTER_CHROMA } from '../lib/color.js';
import { luminaireFlux } from '../lib/luminaire.js';
import {
  CITY,
  generateChunk,
  chunkBounds,
  chunkKey,
  CITY_ERAS,
  CITY_MATERIALS,
  LANDMARKS,
  landmarkOccluders,
  landmarkGroundBlockers,
  landmarkFootprint,
  landmarkAABB,
  riverEnvelope,
  riverEdges,
  riverBlocks,
  riverTouchesChunk,
  promenadeLamps,
  inRiver,
  onBridgeDeck,
  viaductArc,
  viaductPiers,
  viaductEnds,
  generatorCanProduce,
  CORRIDOR,
  BLOCK_KEEPOUT,
  propHalfWidth,
  PROP_HALF_WIDTH,
  PROP_MODELS,
  propBoxBudget,
  buildingTiers,
  ROOF_PARAPET_M,
  ROOF_PLANT_MAX_M,
  ROOF_SIGN,
  HEIGHT_DISTRIBUTION,
  HEAD_CLEAR_M,
} from '../lib/citygen.js';

const DEG = Math.PI / 180;

/**
 * Bytes one instance costs on the GPU: a mat4 (64) plus an instanceColor (12)
 * plus a `noctisRough` float (4), rounded up for the driver's own bookkeeping.
 * Used for the memory accounting, which is why it is a named constant with its
 * derivation attached rather than a number in an expression.
 */
const BYTES_PER_INSTANCE = 96;

/**
 * Chebyshev ring inside which a chunk's masses are submitted to the sun's depth
 * pass. See `casts` in `buildChunk` for the arithmetic: `lighting.shadowExtent`
 * is 170 m and ring 1 already reaches at least 128 m in every direction from a
 * camera standing anywhere in its own chunk, so ring 2 is a shell that pays a
 * draw call a chunk to be outside the shadow camera.
 */
const CAST_RADIUS = 1;

/**
 * Parapet wall thickness, m. The height is `ROOF_PARAPET_M` and lives in the
 * pure generator because a roof sign's world position is derived from it
 * (`citygen.js` → `pushRoofSign`); the THICKNESS is a rendering decision that
 * nothing outside this file needs, so it stays here.
 */
const PARAPET_T = 0.3;

/**
 * Sign chromaticities. Six, and no more — docs/authored-city.md's saturation
 * reserve is spent by the *number of different saturated things*, not by their
 * individual brightness, and a palette of twenty is how a near-future street
 * becomes a cyberpunk one by accident.
 */
const SIGN_CHROMA = [
  EMITTER_CHROMA.neonRed,
  EMITTER_CHROMA.neonCyan,
  EMITTER_CHROMA.sodium,
  EMITTER_CHROMA.fluorescentCold,
  EMITTER_CHROMA.tungsten,
  EMITTER_CHROMA.neonGreen,
];

export function createCity(options = {}) {
  const cfg = { ...CITY, ...options };

  const root = new THREE.Group();
  root.name = 'city';

  const disposables = [];
  const track = (x) => {
    disposables.push(x);
    return x;
  };

  /** key → { cx, cz, data, group, bytes, detail, lastWanted, lamps } */
  const resident = new Map();
  /** Chunk descriptions, memoised separately from geometry: cheap and reused by the bake path. */
  const described = new Map();

  let materials = null;
  let geometries = null;
  /** The lights api, kept because `buildLandmark` has to re-patch cloned materials. */
  let lightsApi = null;
  let rootSeed = '1337';
  /** §6 `?quayLamps=0`. Read here rather than in `main.js` — see the note on it there. */
  let quayLamps = 1;
  let bytesResident = 0;
  let peakBytes = 0;
  let evictions = 0;
  let builtCount = 0;
  let lampPool = [];
  let lampCandidates = [];
  let meanFacadeHeight = 26;
  let generateQueue = [];
  let frameStamp = 0;
  /** The one merged ground mesh, and whether it still describes the near ring. */
  let groundMesh = null;
  let groundDirty = false;
  /** The one merged signage mesh, same arrangement. */
  let signMesh = null;
  let signsDirty = false;

  const tmpMatrix = new THREE.Matrix4();
  const tmpQuat = new THREE.Quaternion();
  const tmpPos = new THREE.Vector3();
  const tmpScale = new THREE.Vector3();
  /** Hoisted for `propMatrix`: chunk build must not allocate per box. */
  const tmpLeanAxis = new THREE.Vector3();
  const tmpLeanQuat = new THREE.Quaternion();
  const tmpColor = new THREE.Color();
  const tmpEuler = new THREE.Euler();

  // -------------------------------------------------------------------------

  function buildMaterials(ctx) {
    const lights = ctx.get('lights');
    const surface = ({ color, roughness, metalness = 0, linear = false }) => {
      const m = new THREE.MeshStandardMaterial({
        roughness: Math.max(0.05, roughness),
        metalness,
        envMapIntensity: 1,
      });
      if (linear) m.color.setRGB(color[0], color[1], color[2], THREE.LinearSRGBColorSpace);
      else m.color.set(color);
      lights.patch(m);
      return track(m);
    };

    const emissive = ({ chroma, nits, color = 0x16181c, roughness = 0.075 }) => {
      const m = new THREE.MeshStandardMaterial({ roughness, metalness: 0 });
      m.color.set(color);
      m.emissive.setRGB(chroma[0], chroma[1], chroma[2], THREE.LinearSRGBColorSpace);
      m.emissiveIntensity = nits;
      lights.patch(m);
      return track(m);
    };

    return {
      /**
       * Linear white, because the albedo rides in `instanceColor` and three
       * multiplies it into `diffuseColor`. So the buffer *is* the reflectance
       * rather than a multiplier on one — the same decision block.js made, for
       * the same reason, and measured rather than assumed: forcing the buffer
       * red moves the frame's mean by 25 counts.
       */
      facade: surface({ color: [1, 1, 1], roughness: 0.7, linear: true }),
      /** Road and pavement in one mesh; the difference rides in vertex colours. */
      ground: (() => {
        const m = surface({ color: [1, 1, 1], roughness: 0.78, linear: true });
        // Road-versus-pavement reflectance rides in vertex colours, and three
        // only defines USE_COLOR — and therefore only emits the multiply — from
        // this flag. Set where the material is made, not where it is used.
        m.vertexColors = true;
        return m;
      })(),
      patch: surface({ color: [1, 1, 1], roughness: 0.82, linear: true }),
      metal: surface({ color: 0x2a2d31, roughness: 0.42, metalness: 1 }),
      /**
       * Landmark steel, and it is a correctness fix rather than a variety one.
       *
       * `l.material === 'steel'` on the mast, and steel is what the hyperboloid's
       * crown fins, the arch's hangers and the viaduct's rails are made of — and
       * every one of them was drawn with `materials.facade`, which is
       * `metalness: 0`. Albedo and roughness ride per instance; **metalness
       * cannot**, so a 186 m lattice mast rendered as grey plastic and no
       * per-instance attribute could have fixed it. One material, shared by every
       * steel part of every landmark.
       */
      landmarkSteel: surface({ color: [0.56, 0.57, 0.58], roughness: 0.42, metalness: 1, linear: true }),
      /**
       * One window material for the whole city. Brightness and chroma ride in
       * `instanceColor`, which the §5.6 injection now multiplies into the
       * emissive as well as into the diffuse — so a lit window, a dim window and
       * a dark one are three instances rather than three draw calls.
       */
      window: emissive({ chroma: EMITTER_CHROMA.tungsten, nits: LIGHT.windowNits, roughness: 0.05 }),
      /**
       * Ditto for signage — at a PLATE's radiance and not a TUBE's. See
       * `LIGHT.signPlateNits`: this read `LIGHT.neonNits` for thirteen sessions,
       * which is 76x too high for a quad standing for a whole sign, and it went
       * unnoticed because not one of these quads reached a frame.
       */
      sign: emissive({ chroma: [1, 1, 1], nits: LIGHT.signPlateNits, color: 0x101216, roughness: 0.1 }),
      /** Facade advertising: a display panel is a window-sized emitter, not a neon tube. */
      display: emissive({ chroma: EMITTER_CHROMA.fluorescentCold, nits: 900, color: 0x0a0b0d, roughness: 0.06 }),
      /**
       * TAGGED FOR `harness.lampBowlCensus()` — session 28. The tag is what
       * lets a gate find this material in the DELIVERED scene and read the
       * radiance that ARRIVED, rather than re-reading the constant that was
       * supposed to produce it (CONTRACT §9.1).
       */
      lampBowl: (() => {
        const m = emissive({ chroma: EMITTER_CHROMA.sodium, nits: LAMP_BOWL.streamedNits, roughness: 0.35 });
        // Assigned INTO userData rather than over it: `lights.patch()` has run
        // by now and a whole-object replacement would silently drop whatever it
        // put there.
        m.userData.noctisLampPath = 'streamed';
        return m;
      })(),
      /**
       * RED AVIATION OBSTRUCTION LIGHTS — session 19, item 12. One material for
       * every beacon on every landmark; the FLASH rides in `instanceColor`,
       * exactly as a traffic signal's lit lens does, so a lamp on and a lamp off
       * are two instances rather than two materials or two draw calls.
       */
      beacon: emissive({ chroma: EMITTER_CHROMA.neonRed, nits: LIGHT.aviationRedNits, color: 0x0e0a0a, roughness: 0.2 }),
    };
  }

  function buildGeometries() {
    const box = track(new THREE.BoxGeometry(1, 1, 1));
    const plane = track(new THREE.PlaneGeometry(1, 1));

    /**
     * The whole street lantern as one geometry — pole, arm and bracket merged
     * into a single instanced draw. Three meshes per lamp was three draws per
     * chunk before culling; at a hundred lamps in view it was the largest single
     * line in the draw-call budget.
     */
    const pole = new THREE.CylinderGeometry(0.11, 0.15, 8.4, 6);
    pole.translate(0, 4.2, 0);
    const arm = new THREE.BoxGeometry(2.1, 0.12, 0.12);
    arm.translate(-1.05, 8.2, 0);
    const lamp = mergeGeometries([pole, arm]);
    pole.dispose();
    arm.dispose();

    return {
      box,
      plane,
      lamp: track(lamp),
      /** Shape from `LAMP_BOWL` (s28); 8x6 is this path's own tessellation. */
      bowl: track(new THREE.SphereGeometry(
        LAMP_BOWL.radiusM, 8, 6,
        LAMP_BOWL.phiStart, LAMP_BOWL.phiLength, LAMP_BOWL.thetaStart, LAMP_BOWL.thetaLength
      )),
    };
  }

  /**
   * Minimal geometry merge — position and normal only, non-indexed.
   *
   * three ships BufferGeometryUtils for this, but it lives under
   * `three/examples/jsm` and pulls in a module that knows about morph targets,
   * groups and draw ranges, none of which any geometry here has. Twenty lines
   * that do exactly what is needed is smaller than the import.
   */
  function mergeGeometries(list) {
    let total = 0;
    const parts = list.map((g) => {
      const nonIndexed = g.index ? g.toNonIndexed() : g;
      total += nonIndexed.attributes.position.count;
      return nonIndexed;
    });
    const pos = new Float32Array(total * 3);
    const nrm = new Float32Array(total * 3);
    let o = 0;
    for (const g of parts) {
      pos.set(g.attributes.position.array, o * 3);
      nrm.set(g.attributes.normal.array, o * 3);
      o += g.attributes.position.count;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    out.computeBoundingSphere();
    return out;
  }

  // -------------------------------------------------------------------------

  function describe(cx, cz) {
    const key = chunkKey(cx, cz);
    let d = described.get(key);
    if (!d) {
      d = generateChunk(rootSeed, cx, cz);
      described.set(key, d);
      // The description cache is unbounded in principle and bounded in practice
      // by how far a player can walk; 4096 chunks is 67 km square, and each one
      // is a few kilobytes of plain objects. Capped anyway, because "bounded in
      // practice" is what an unbounded cache always says about itself.
      if (described.size > 4096) {
        const oldest = described.keys().next().value;
        described.delete(oldest);
      }
    }
    return d;
  }

  /**
   * Add one instanced mesh to a chunk group.
   *
   * `skin` carries the per-instance albedo and roughness — the albedo through
   * `instanceColor` and the roughness through a `noctisRough` instanced
   * attribute, exactly as block.js does. A geometry with a skin gets a clone,
   * because instance attributes live on the geometry and every chunk shares one
   * box.
   */
  /**
   * @param census  What went into this mesh, by kind, in the order it was
   *   pushed. Written onto the mesh so that a gate can walk the LIVE SCENE and
   *   ask what is actually in it, rather than asking the config what it meant.
   *
   *   It exists because the merge that saved four draw calls a chunk also
   *   erased four categories: buildings, crowns, props and road patches all end
   *   up in one InstancedMesh called `masses`, and after that the scene has no
   *   way to say how many props it drew. The generator's number and the scene's
   *   number were the same number for four sessions because nothing ever asked
   *   them separately — which is exactly the arrangement that let `pierEvery:
   *   34` sit in the data while `i % 3 === 0` sat in the code and 48 shipped.
   *
   *   The declared breakdown is not the measurement. `instanceMatrix.count` is.
   *   This is the label that lets the measurement be compared to something.
   */
  function addInstanced(group, geo, mat, matrices, name, skin, shadows, census) {
    if (!matrices.length) return 0;
    let g = geo;
    if (skin) {
      g = geo.clone();
      const rough = new Float32Array(matrices.length);
      for (let i = 0; i < matrices.length; i++) rough[i] = skin[i].roughness;
      g.setAttribute('noctisRough', new THREE.InstancedBufferAttribute(rough, 1));
    }
    const im = new THREE.InstancedMesh(g, mat, matrices.length);
    for (let i = 0; i < matrices.length; i++) im.setMatrixAt(i, matrices[i]);
    im.instanceMatrix.needsUpdate = true;
    if (skin) {
      for (let i = 0; i < matrices.length; i++) {
        const a = skin[i].albedo;
        // setRGB in linear: measured reflectances, not authored sRGB colours.
        // Letting ColorManagement decode them would bend every one through a
        // 2.2 power — CONTRACT §5.2.
        tmpColor.setRGB(a[0], a[1], a[2], THREE.LinearSRGBColorSpace);
        im.setColorAt(i, tmpColor);
      }
      im.instanceColor.needsUpdate = true;
    }
    im.castShadow = !!shadows;
    im.receiveShadow = !!shadows;
    im.name = name;
    if (census) im.userData.noctisCensus = census;
    /**
     * Culled, and this is the difference between a city that fits in the draw
     * budget and one that does not. A resident ring of 169 chunks with nine
     * meshes each is 1521 potential draws; at a 55° field of view roughly a
     * seventh of them are in front of the camera. The bounding sphere has to be
     * computed explicitly — three only does it lazily, for raycasting.
     */
    im.frustumCulled = true;
    im.computeBoundingSphere();
    group.add(im);
    // Instance buffers, plus the cloned geometry's own attribute when there is
    // a skin. The geometry itself is shared and counted once, at init.
    return matrices.length * BYTES_PER_INSTANCE;
  }

  function setMatrix(x, y, z, sx, sy, sz, yawDeg) {
    tmpPos.set(x, y, z);
    tmpEuler.set(0, yawDeg * DEG, 0);
    tmpQuat.setFromEuler(tmpEuler);
    tmpScale.set(sx, sy, sz);
    return tmpMatrix.compose(tmpPos, tmpQuat, tmpScale).clone();
  }

  /**
   * One box of one prop model, placed in the world.
   *
   * The prop's whole model is scaled by `p.scale`, yawed by `p.yawDeg` and — if
   * its variant declares a lean — tipped by `leanDeg` about a HORIZONTAL axis
   * at `p.leanAzDeg`, THROUGH ITS OWN BASE. Tipping about the base and not
   * about each box's centre is the only version that keeps a leaning tree in
   * one piece: the crown has to travel with the trunk, and a per-box rotation
   * would rotate each box where it stands.
   *
   * The lean is applied on the OUTSIDE of the yaw so that `leanAzDeg` is a
   * world bearing. It is seeded independently of the yaw, so which of the two
   * composes first cannot be seen — the sentence is here because a reader
   * should not have to work that out to know it does not matter.
   */
  function propMatrix(p, b, leanDeg, baseY) {
    const s = p.scale;
    tmpQuat.setFromEuler(tmpEuler.set(0, (p.yawDeg || 0) * DEG, 0));
    if (leanDeg) {
      const az = (p.leanAzDeg || 0) * DEG;
      tmpLeanAxis.set(Math.cos(az), 0, Math.sin(az));
      tmpLeanQuat.setFromAxisAngle(tmpLeanAxis, leanDeg * DEG);
      tmpQuat.premultiply(tmpLeanQuat);
    }
    tmpPos.set(b.x * s, b.y * s, b.z * s).applyQuaternion(tmpQuat);
    /**
     * `baseY` is the ground under this prop, session 19. Every `PROP_MODELS`
     * box is authored with the model's base at y = 0 (a bollard's own bottom, a
     * tree's root collar), which is the ground datum — so the whole model is
     * lifted by whatever the surface at its feet is. The LEAN is applied through
     * the prop's own base before this, so a leaning tree still pivots on the
     * pavement it is planted in rather than about a point 0.160 m under it.
     */
    tmpPos.set(p.x + tmpPos.x, baseY + tmpPos.y, p.z + tmpPos.z);
    tmpScale.set(b.w * s, b.h * s, b.d * s);
    /**
     * THE BOX'S OWN TILT, INSIDE the model frame — session 21.
     *
     * `citygen`'s `bxt()` declares it and the canopy masses use it. Composed on
     * the RIGHT of the model quaternion, so it is a rotation in the model's own
     * axes: a canopy mass tilted 9° about a bearing of 24° stays tilted 9°
     * about that bearing when the whole tree is yawed or leaned, which is what
     * makes a leaning tree read as one object. Composing on the left would make
     * `tiltAz` a WORLD bearing and every tree of a given variant would lean its
     * foliage the same way whatever its yaw — a stamp rather than a species.
     */
    if (b.tilt) {
      const az = (b.tiltAz || 0) * DEG;
      tmpLeanAxis.set(Math.cos(az), 0, Math.sin(az));
      tmpLeanQuat.setFromAxisAngle(tmpLeanAxis, b.tilt * DEG);
      tmpQuat.multiply(tmpLeanQuat);
    }
    return tmpMatrix.compose(tmpPos, tmpQuat, tmpScale).clone();
  }

  // -------------------------------------------------------------------------

  /**
   * EVERY HEIGHT THE STREAMED GROUND IS EMITTED AT, IN ONE TABLE, BECAUSE
   * SOMETHING NOW HAS TO STAND ON IT.
   *
   * These six numbers were literals inside `buildGround` for thirteen sessions
   * and nothing else needed them, because nothing else ever asked how high the
   * ground was — the camera flew along a spline at a fixed `eye`. Session 17's
   * player follows the surface, and a second copy of these numbers in the
   * controller is §9.1's arrangement: two tables that have to be kept in step,
   * failing silently as an eye that floats a centimetre over the pavement.
   * `buildGround` emits from this table and `surfaceAt()` reads from it.
   *
   * SESSION 19 — THIS TABLE IS NO LONGER A TABLE. It is a view onto
   * `constants.js` → `GROUND`, which is where the datum is declared, and every
   * number below is now an expression rather than a literal.
   *
   * WHAT WAS WRONG, KEPT BECAUSE THE NEXT SESSION MUST NOT RE-DERIVE IT:
   * **the streamed city's kerb was 0.010 m high.** The pavement was 0.030 and
   * the carriageway 0.020, and the gap between them was a z-fighting offset
   * rather than a kerb — the comment two paragraphs down has always said
   * "slightly above the global ground plane so there is no z-fighting with it",
   * which is exactly what those numbers were for and is not what a kerb is.
   * `BLOCK.kerbHeight` is 0.16 m and the origin block builds a real one, so the
   * city had a 0.16 m kerb over 336 m of its main street and a 0.01 m kerb over
   * every other metre of road it owned. 0.16 / 0.01 = 16×. It also put 160
   * vehicles 0.020 m inside their own carriageway, because a wheel's contact
   * patch is at y = 0 and so is everything else in this project — see `GROUND`.
   *
   * NOTHING HERE IS A NEW DECISION. The carriageway drops 0.020 to the datum,
   * the pavement rises 0.130 to `BLOCK.kerbHeight` above it, and the RELATIONS
   * between grass, paths and the crossing bias are carried over unchanged, so
   * the only quantity that moved is the one that was standing in for a kerb.
   *
   * The two `NS`/`EW` pairs still differ by `GROUND.crossingBias` — where a
   * north–south strip crosses an east–west one, one of them has to win. A
   * walker cannot feel 1 mm and `surfaceAt` returns the higher of whatever
   * applies, which is what a walker would be standing on.
   */
  const GROUND_Y = {
    /** Carriageway, the chunk's west (north–south) corridor. THE DATUM. */
    roadNS: GROUND.carriageway,
    /** Carriageway, the chunk's north (east–west) corridor. Wins the crossing. */
    roadEW: GROUND.carriageway + GROUND.crossingBias,
    /** Pavement either side of the north–south carriageway. A REAL kerb now. */
    walkNS: GROUND.pavement,
    /** Pavement either side of the east–west carriageway. Wins the crossing. */
    walkEW: GROUND.pavement + GROUND.crossingBias,
    /** Mown grass on a `park` block's island. */
    grass: GROUND.grass,
    /** The two gravel paths across a park. */
    pathEW: GROUND.pathEW,
    pathNS: GROUND.pathNS,
    /**
     * A construction site's hardcore — session 21. At the carriageway's own
     * datum rather than the grass's: a site is a stripped surface, which is
     * what the ground UNDER a road is, and it is the one low-detail block whose
     * surface is lower than the pavement around it rather than higher.
     */
    site: GROUND.carriageway,
    /** The world's earth plane, in `block.js`. Everything not listed above. */
    earth: GROUND.earth,
  };

  /**
   * Metres. A road marking's own thickness — session 21.
   *
   * Thermoplastic screed is laid 2 to 3 mm thick and a hot-applied line with
   * beads rolled in reads about 4 mm proud. It is emitted as a BOX rather than
   * as a ground quad for two reasons and both are load-bearing: coplanar
   * surfaces z-fight, and the 4 mm edge is what a headlight catches at a
   * grazing angle. A wheel does not climb 4 mm, which is the same argument
   * `PATCH_THICKNESS_M` makes at 10 mm.
   */
  const MARKING_THICKNESS_M = 0.004;
  /**
   * `HEAD_CLEAR_M` IS IMPORTED NOW, AND THE COMMENT THAT WAS HERE CLAIMED A
   * CHECK THAT DID NOT EXIST — session 22.
   *
   * It said: *"Duplicated as a literal here rather than exported and imported,
   * and that is a deliberate exception with its reason: it is a PROPERTY OF A
   * PERSON rather than of the generator, and the two readers use it for two
   * different questions. `citycheck` prints both when they disagree."*
   *
   * `citycheck` does not mention `HEAD_CLEAR_M` anywhere, and neither does
   * `harness.js`. That is CONTRACT §9.1's own rule — *a comment that claims a
   * check names the file the check is in, or it does not claim one* — and §9.1
   * says why it is the worst variant: the silent ones are silent, and this one
   * ADVERTISES a guarantee to the next reader.
   *
   * AND THE DISTINCTION IT DREW WAS FALSE. The two readers ask the SAME
   * question: `derivePropHalfAcross` asks "is this box overhead" to decide the
   * across-pad, and the loop below asks "is this box overhead" to decide which
   * band to claim. They are the two halves of one split, and §2 of STATE 22 is
   * what happens when they disagree — the generator claimed a trunk's worth of
   * ground and this file delivered a crown's. Two literals for the two sides of
   * one comparison is the arrangement `pierEvery: 34` sat in.
   *
   * One number, one owner, no gate needed — the same remedy CONTRACT §9's
   * session-20 row applied to `ROOF_PARAPET_M`, which is imported two lines up.
   */
  /** Linear. Fresh white marking material, 0.55-0.70; the middle of the band. */
  const MARKING_ALBEDO = [0.62, 0.615, 0.60];

  /**
   * THE ONE WALK OVER THE EMITTED GROUND RECTANGLES. Session 19.
   *
   * `surfaceAt` and `groundYAt` are two questions about one scan, and this is
   * the scan. Two copies of it is §9.1's subject — a description of a thing and
   * a second description of the same thing, drifting — and the drift here would
   * be silent in the worst way: the player standing on one surface and the crowd
   * beside them standing on another.
   *
   * Fills a preallocated result rather than returning one, because the caller
   * that made this worth extracting runs it 360 times a frame and an allocation
   * per pedestrian per frame is 21 600 objects a second.
   *
   * THE 3×3 NEIGHBOURHOOD IS NOT AN APPROXIMATION. A chunk emits the corridors
   * on its own WEST and NORTH edges, so a point one metre west of a road line
   * lies in chunk `cx − 1` and stands on chunk `cx`'s quad. Testing only the
   * containing chunk would report bare earth along every west and north kerb in
   * the city — a 4.2 m band, 128 m long, on every chunk boundary.
   */
  const scanOut = { best: null, anyGround: false };

  /**
   * THE CHUNK CURRENTLY BEING BUILT, VISIBLE TO THE QUERY BEFORE IT IS
   * RESIDENT — session 19.
   *
   * `buildChunk` places this chunk's lamps and props, and each of them needs to
   * know how high the pavement under it is. Its own ground quads exist by then
   * (`buildGround` is hoisted to the top of that function for exactly this
   * reason) but the chunk is not in `resident` until the build RETURNS, so the
   * query would answer "bare earth" for every prop in the chunk that is asking.
   *
   * The alternative was a second height lookup inside `buildChunk` over the
   * rectangles it has in hand, which is §9.1's subject — two descriptions of one
   * surface, drifting — and its failure mode is a lamp column standing at a
   * different height from the pavement quad drawn under it, by a number nobody
   * would think to print. Four lines here instead.
   *
   * A prop only ever needs its OWN chunk's quads: the four kerb bands
   * `citygen.js` furnishes are at `b.x0` and `b.z0` on both sides, and those are
   * precisely the two corridors this chunk emits. Neighbours are still consulted
   * through `resident` for anything that straddles.
   */
  let buildingKey = '';
  let buildingGround = null;

  /**
   * THE LIVE AVIATION BEACON MESHES AND THEIR PER-LAMP PHASES — session 19.
   *
   * Held here rather than walked out of the scene graph each frame, because
   * `update()` would otherwise have to traverse every resident chunk to find two
   * meshes. Entries are dropped when their mesh leaves the scene; a chunk that
   * streams out and back rebuilds its beacons with the same phases, because the
   * phase is a hash of the lamp's own position and not a random draw.
   */
  const beaconMeshes = [];

  /**
   * Per-chunk delivered occupancy records, keyed the same way `resident` is.
   * Dropped in `unbind`/`unbuild` with everything else the chunk owns.
   */
  const chunkClaims = new Map();

  /**
   * THE FLASH — slow, asynchronous, and on the one clock.
   *
   * ICAO Annex 14 §6.3 puts medium-intensity Type B at **20 to 60 flashes a
   * minute**; 30/min is the middle and is what an obstruction light on a tower
   * actually does. So the period is **2.0 s** and the ON fraction is 0.25 —
   * a half-second pulse, which is what reads as a beacon rather than as a
   * strobe or as a lamp somebody forgot to switch off.
   *
   * `time.now` and not `dt`, for the reason `traffic`, `weather`, `streetlife`
   * and `player` all carry: a system integrating wall-clock seconds arrives at a
   * given capture in a different state on every run, and `?paused=1` must freeze
   * this exactly as it freezes everything else that moves.
   *
   * OFF IS NOT ZERO. A dark obstruction light is a red lens with a filter still
   * in front of it, seen against a sky — the same sentence `traffic.js` writes
   * about `NITS_SIGNAL_OFF`. 0.006 of full is 98 cd/m², which is under the bloom
   * onset and above nothing at all.
   */
  const BEACON_PERIOD_S = 2.0;
  const BEACON_DUTY = 0.25;
  const BEACON_OFF_GAIN = 0.006;

  function updateBeacons(now) {
    if (!beaconMeshes.length) return;
    for (let m = beaconMeshes.length - 1; m >= 0; m--) {
      const rec = beaconMeshes[m];
      const im = rec.mesh;
      if (!im.parent) {
        beaconMeshes.splice(m, 1);
        continue;
      }
      if (!im.instanceColor) continue;
      const arr = im.instanceColor.array;
      for (let i = 0; i < rec.phase.length; i++) {
        const u = ((now / BEACON_PERIOD_S) + rec.phase[i]) % 1;
        /**
         * A raised cosine over the ON window rather than a square wave. A real
         * beacon's flash has a rise and a fall — and a square wave at 60 fps
         * would alias into the TAA history as a one-frame step on a sub-pixel
         * emitter, which is the exact input §5.10's neighbourhood clamp rejects.
         */
        const g = u < BEACON_DUTY
          ? BEACON_OFF_GAIN + (1 - BEACON_OFF_GAIN) * (0.5 - 0.5 * Math.cos((u / BEACON_DUTY) * Math.PI * 2))
          : BEACON_OFF_GAIN;
        arr[i * 3] = g;
        arr[i * 3 + 1] = g;
        arr[i * 3 + 2] = g;
      }
      im.instanceColor.needsUpdate = true;
    }
  }

  function scanGround(x, z) {
    const s = CITY.chunkSize;
    const cx = Math.floor(x / s);
    const cz = Math.floor(z / s);
    let best = null;
    let anyGround = false;
    for (let jz = cz - 1; jz <= cz + 1; jz++) {
      for (let jx = cx - 1; jx <= cx + 1; jx++) {
        const k = chunkKey(jx, jz);
        let g;
        if (k === buildingKey) {
          g = buildingGround;
        } else {
          const rec = resident.get(k);
          g = rec ? rec.ground : null;
        }
        if (!g || !g.rects) continue;
        anyGround = true;
        // The chunk's own union bound — four comparisons that reject the eight
        // neighbours which cannot contain the point. See `buildGround`.
        const bb = g.bounds;
        if (bb && (x < bb.x0 || x > bb.x1 || z < bb.z0 || z > bb.z1)) continue;
        const rects = g.rects;
        for (let i = 0; i < rects.length; i++) {
          const q = rects[i];
          if (x < q.x0 || x > q.x1 || z < q.z0 || z > q.z1) continue;
          if (!best || q.y > best.y) best = q;
        }
      }
    }
    scanOut.best = best;
    scanOut.anyGround = anyGround;
    return scanOut;
  }

  /**
   * WHAT IS UNDER (x, z) ANYWHERE IN THE WORLD — session 19, and this is THE
   * ONE FUNCTION the ground datum points everything at.
   *
   * `api.surfaceAt` answers for THIS MODULE'S OWN QUADS and is deliberately
   * left that way: `tools/walkprobe.mjs --agreement` compares it against the
   * rasterised mask, and a query that quietly included two other modules'
   * geometry would stop being a statement about the streamed city. This one is
   * the WORLD query, and the difference between the two names is the difference
   * between "what did `buildGround` emit here" and "what would a boot be
   * resting on".
   *
   * THE MAXIMUM OVER THE THREE MODULES THAT EMIT GROUND, and a maximum rather
   * than a precedence order for the reason session 17 wrote down in
   * `player.js`: the topmost surface is the one you stand on, and a precedence
   * order would have to be right about which of six overlaps is which — and
   * would be wrong the first time one moved. On a bridge this module leaves its
   * north–south corridor whole and `river.js` lays a deck across it, so both
   * answer and the deck wins because it is higher, which is also what is drawn.
   *
   * IT IS THE ONLY COPY. `player.js` carried its own max-over-three from
   * session 17 and now calls this; `streetlife.js` had no query at all and
   * wrote a literal 0; `buildChunk` places lamps and props through it. Two
   * implementations of "which surface am I on" is §9.1's subject with a height,
   * and its failure mode is the worst kind — the walker standing on one surface
   * and the crowd beside them standing on another, in the same frame, both
   * looking plausible.
   *
   * No allocation: `worldOut` is filled and returned, because the caller that
   * made this worth having runs it once per pedestrian per frame. THE RESULT IS
   * TRANSIENT — copy what you keep.
   */
  const worldOut = { y: 0, kind: 'earth', known: false };

  function worldSurface(ctx, x, z) {
    const r = scanGround(x, z);
    worldOut.y = r.best ? r.best.y : GROUND_Y.earth;
    worldOut.kind = r.best ? r.best.kind : 'earth';
    worldOut.known = r.best ? true : r.anyGround;

    /**
     * `ctx.get()` may return undefined for either neighbour: that is what
     * quarantine looks like from the outside (CONTRACT §1.2), and a missing
     * module removes its surfaces rather than throwing.
     */
    const blockApi = ctx.get('block');
    if (blockApi && blockApi.surfaceAt) {
      const b = blockApi.surfaceAt(x, z);
      if (b && b.y > worldOut.y) {
        worldOut.y = b.y;
        worldOut.kind = b.kind;
        worldOut.known = b.known;
      }
    }
    const riverApi = ctx.get('river');
    if (riverApi && riverApi.surfaceAt) {
      const v = riverApi.surfaceAt(x, z);
      if (v && v.y > worldOut.y) {
        worldOut.y = v.y;
        worldOut.kind = v.kind;
        worldOut.known = v.known;
      }
    }
    return worldOut;
  }

  /**
   * The road surface for one chunk: the two corridors on its west and north
   * edges, as one merged mesh with vertex colours.
   *
   * Each chunk owns two of the four roads around it, so no road is built twice.
   * Vertex colours rather than two materials, because road and pavement differ
   * by reflectance and barely at all by finish, and one mesh is one draw.
   */
  function buildGround(chunk) {
    const positions = [];
    const normals = [];
    const colors = [];
    /** Every quad this chunk emitted, for `surfaceAt`. See `quad` below. */
    const rects = [];

    /**
     * A HORIZONTAL QUAD, WOUND SO THAT ITS FRONT FACE POINTS UP.
     *
     * IT DID NOT, AND NOT ONE SQUARE METRE OF THIS CITY'S ROAD SURFACE HAD
     * REACHED A FRAME UNTIL SESSION 19. The old order was
     *
     *     (x0,z0) (x1,z0) (x1,z1)   and   (x0,z0) (x1,z1) (x0,z1)
     *
     * whose first triangle has edges e1 = (dx, 0, 0) and e2 = (dx, 0, dz), so
     * e1 x e2 = (0, -dx*dz, 0) — with x1 > x0 and z1 > z0 that is straight
     * DOWN. `materials.ground` is `FrontSide`, three's front face is
     * counter-clockwise, and so every carriageway, every pavement and every
     * road patch in the streamed city was rasterised as a back face and
     * discarded. The `normal` attribute says (0,1,0) at every vertex and is
     * believed by the lighting — which is why nothing looked lit from
     * underneath and nothing looked wrong. CONTRACT §9.1 carries it.
     */
    const quad = (x0, z0, x1, z1, y, albedo, kind) => {
      const v = [
        [x0, y, z0], [x1, y, z1], [x1, y, z0],
        [x0, y, z0], [x0, y, z1], [x1, y, z1],
      ];
      for (const p of v) {
        positions.push(p[0], p[1], p[2]);
        normals.push(0, 1, 0);
        colors.push(albedo[0], albedo[1], albedo[2]);
      }
      /**
       * THE SAME RECTANGLE, RECORDED, SO THAT `surfaceAt` READS THE SURFACE
       * THAT WAS EMITTED RATHER THAN A SECOND DESCRIPTION OF IT. 48 bytes a
       * quad, about ten quads a chunk, twenty-five near chunks — 12 kB — and it
       * cannot disagree with the mesh because it IS the mesh.
       */
      rects.push({ x0, z0, x1, z1, y, kind });
    };

    /**
     * THIS FUNCTION NO LONGER DECIDES WHERE THE GROUND IS — SESSION 21.
     *
     * It used to compute the six corridor strips itself and clip them against
     * the two things it knew by name: `BLOCK_KEEPOUT` and the river. It knew
     * nothing about the landmarks, so the delivered city carried 2 906 m2 of
     * carriageway inside the exchange's dome, 2 113 inside the condenser and
     * 1 201 inside the dish — and the operator walked into the first of those.
     *
     * The rectangles are now `chunk.ground`, computed in `citygen.js` beside
     * the keep-out registry they are clipped against (`src/lib/occupancy.js`).
     * What is left here is the part that was always this module's: turning a
     * rectangle into triangles, and choosing the reflectance.
     *
     * THE REFLECTANCES ARE STILL DECIDED HERE and that is deliberate. They are
     * physical quantities the exposure system reads (CONTRACT §5.3), the
     * generator is `three`-free and unit-free, and a linear albedo in a
     * placement file is a number in the wrong file.
     */
    const Y = GROUND_Y;
    const roadAlbedo = chunk.roadMaterials[0] === 'concrete' ? [0.19, 0.19, 0.185] : [0.082, 0.082, 0.086];
    const walkAlbedo = [0.26, 0.257, 0.248];
    /**
     * Mown grass integrates to about 0.10 photopic with a strong green bias,
     * which is the same order as the 0.082 asphalt beside it and half the 0.26
     * pavement — so a park reads as a hole in the block at noon and as a very
     * dark hole at night, which is what a park is at both hours.
     */
    const grassAlbedo = [0.062, 0.094, 0.045];
    /** Pale gravel: the same reflectance as the concrete road variant. */
    const pathAlbedo = [0.19, 0.186, 0.176];
    /**
     * Site hardcore — crushed concrete and clay, wet more often than not.
     * 0.115 sits between asphalt's 0.082 and the pavement's 0.26, and the
     * green channel leads the blue because the clay in it is warm.
     */
    const siteAlbedo = [0.115, 0.107, 0.092];

    const albedoFor = (kind) => (
      kind === 'road' ? roadAlbedo
        : kind === 'walk' ? walkAlbedo
          : kind === 'grass' ? grassAlbedo
            : kind === 'path' ? pathAlbedo
              : kind === 'siteGround' ? siteAlbedo
                : walkAlbedo);

    for (const g of chunk.ground) {
      quad(g.x0, g.z0, g.x1, g.z1, Y[g.yKey] !== undefined ? Y[g.yKey] : Y.earth,
        albedoFor(g.kind), g.kind === 'siteGround' ? 'site' : g.kind);
    }

    /**
     * THE UNION AABB OF THIS CHUNK'S OWN QUADS — session 19, and it exists so
     * that `surfaceAt` can be called 360 times a frame instead of once.
     *
     * `surfaceAt` walks a 3x3 neighbourhood because a chunk emits the corridors
     * on its WEST and NORTH edges, so a point can stand on a neighbour's quad.
     * That is nine chunks x about ten rectangles = ~90 containment tests per
     * query, which is nothing at one query a frame (the player) and is 32 400
     * at one per pedestrian. Eight of the nine chunks cannot contain the point
     * at all, and this bound rejects each of them in four comparisons.
     *
     * Empty chunks — everything clipped away by the keep-out or the river —
     * get an inverted box that fails every test, which is the correct answer
     * for a chunk with no ground in it.
     */
    let bx0 = Infinity;
    let bz0 = Infinity;
    let bx1 = -Infinity;
    let bz1 = -Infinity;
    for (const q of rects) {
      if (q.x0 < bx0) bx0 = q.x0;
      if (q.z0 < bz0) bz0 = q.z0;
      if (q.x1 > bx1) bx1 = q.x1;
      if (q.z1 > bz1) bz1 = q.z1;
    }
    const bounds = { x0: bx0, z0: bz0, x1: bx1, z1: bz1 };

    return { positions, normals, colors, rects, bounds, bytes: positions.length * 4 * 3 };
  }

  /**
   * ONE GROUND MESH FOR THE WHOLE NEAR RING, NOT ONE PER CHUNK.
   *
   * The same move session 4 made on the four per-chunk box meshes, for the same
   * reason and against the same ceiling. Twenty-five near chunks is twenty-five
   * draw calls describing one thing — a flat, opaque, vertex-coloured surface on
   * one material — and `highway_speed` measured 476 against a 440 ceiling the
   * moment the winding fix above made any of them visible. CONTRACT §0 rule 5
   * forbids raising a ceiling instead of making the rendering fix, and the
   * `$drawCalls_rebaseline` note in `budget.json` says the same thing about the
   * last time this number moved.
   *
   * Rebuilt whole whenever the near set changes, which is on a chunk crossing —
   * a few times a minute at walking pace, and never inside a frame that is not
   * already building a chunk. It is 9 to 11 quads a chunk, so 25 chunks is about
   * 1 650 vertices: cheaper to rebuild than to keep in step.
   */
  function rebuildGroundMesh() {
    let n = 0;
    for (const rec of resident.values()) if (rec.ground) n += rec.ground.positions.length;
    const pos = new Float32Array(n);
    const nrm = new Float32Array(n);
    const col = new Float32Array(n);
    let o = 0;
    for (const rec of resident.values()) {
      if (!rec.ground) continue;
      pos.set(rec.ground.positions, o);
      nrm.set(rec.ground.normals, o);
      col.set(rec.ground.colors, o);
      o += rec.ground.positions.length;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    if (groundMesh) {
      groundMesh.geometry.dispose();
      groundMesh.geometry = geo;
    } else {
      groundMesh = new THREE.Mesh(geo, materials.ground);
      groundMesh.name = 'city:ground';
      groundMesh.receiveShadow = true;
      // One mesh spanning the whole near ring: a bound that is always in view.
      groundMesh.frustumCulled = false;
      root.add(groundMesh);
    }
    groundDirty = false;
  }

  /**
   * One signage mesh for every resident detail chunk. The same move as the
   * ground above and for the same ceiling; signage is small enough — 408 quads
   * over the whole resident ring — that rebuilding it whole on a chunk change
   * is cheaper than keeping twenty of them in step.
   */
  function rebuildSignMesh() {
    if (signMesh) {
      root.remove(signMesh);
      if (signMesh.geometry.getAttribute('noctisRough')) signMesh.geometry.dispose();
      signMesh.dispose();
      signMesh = null;
    }
    const matrices = [];
    const skin = [];
    for (const rec of resident.values()) {
      if (!rec.signs) continue;
      for (let i = 0; i < rec.signs.matrices.length; i++) {
        matrices.push(rec.signs.matrices[i]);
        skin.push(rec.signs.skin[i]);
      }
    }
    signsDirty = false;
    if (!matrices.length) return;
    addInstanced(
      root, geometries.plane, materials.sign, matrices, 'city:signs', skin, false,
      { chunk: 'city', signQuads: matrices.length }
    );
    for (const o of root.children) if (o.name === 'city:signs') signMesh = o;
  }

  /**
   * The resident roof-sign population, summed off the chunks that are actually
   * in the scene. Session 20.
   *
   * NOT A RUNNING TOTAL. A counter incremented on build would keep counting
   * chunks that have since been evicted, and the number this feeds — the
   * bloom-energy comparison against the street lamps — is a claim about ONE
   * frame. §9's shape with a lifetime total used as a resident one.
   */
  function roofSignCensus() {
    let faces = 0;
    let area = 0;
    for (const rec of resident.values()) {
      faces += rec.roofSignFaces || 0;
      area += rec.roofSignArea || 0;
    }
    return { faces, area };
  }

  /**
   * ONE LINE, ONCE, WHEN THE CITY HAS ARRIVED — the derivation
   * `LIGHT.roofSignNits` asks for, discharged at the point of USE (§9.1: a value
   * that crosses two module boundaries to reach a shader is printed at the far
   * end).
   *
   * What it prints is the pair the lamp-bowl finding turns on: bloom energy is
   * radiance × AREA, and 98 bowls of 1.6115 m² at 9000 cd/m² is the number this
   * project already knows. The roof signs' side of that comparison cannot be
   * written in a comment because it depends on how many buildings the generator
   * gave one to, which is a measurement.
   */
  let roofSignReported = false;
  let lastResidentForReport = -1;
  function reportRoofSigns(ctx) {
    if (roofSignReported) return;
    /**
     * WAIT FOR THE RING TO STOP GROWING, AND THE FIRST VERSION DID NOT.
     *
     * It printed as soon as 24 faces were resident, which on a cold start is
     * about a fifth of the ring — so it reported **47 faces and 1992 m²** and
     * called the ratio against the street lamps 140%, on a city that was still
     * arriving. The delivered figure at full residency is an order of magnitude
     * different. A snapshot taken at an arbitrary moment of streaming, printed
     * as though it were the delivered total, is §9's shape with a partial
     * population — and it was caught by reading the HUD's own derivations panel
     * against `city.stats()` in the same frame, which is the whole reason that
     * panel exists.
     *
     * The condition is that the resident count did not change since the last
     * call, which is true on the first frame the ring is stable and needs no
     * knowledge of how many chunks the ring wants.
     */
    const resid = resident.size;
    const stable = resid > 0 && resid === lastResidentForReport;
    lastResidentForReport = resid;
    if (!stable) return;
    const c = roofSignCensus();
    if (c.faces < 24) return;
    roofSignReported = true;
    const bowls = 98 * LAMP_BOWL.areaM2 * LAMP_BOWL.streamedNits;
    const signsEnergy = c.area * LIGHT.roofSignNits;
    ctx.log(
      `city: ${c.faces} roof-sign faces over ${resid} resident chunks, ` +
      `${c.area.toFixed(0)} m² emitting at ${LIGHT.roofSignNits} cd/m² = ` +
      `${(signsEnergy / 1000).toFixed(0)} k cd·m²/m², i.e. ` +
      `${(c.area / resid).toFixed(1)} m² of emitter per chunk. ` +
      `AGAINST 98 lamp bowls × ${LAMP_BOWL.areaM2.toFixed(4)} m² × ${LAMP_BOWL.streamedNits.toFixed(0)} = ${(bowls / 1000).toFixed(0)} k, ` +
      `${((signsEnergy / bowls)).toFixed(1)}× — AND THAT RATIO IS AN UPPER BOUND RATHER THAN A ` +
      'MEASUREMENT, because the two populations are not the same one: the 98 bowls are what the ' +
      'pool lights within about 150 m of the camera, and these faces are everything resident over ' +
      'a 1.4 km square, most of it behind something or under a pixel. What a FRAME sees is ' +
      'measured by tools/levels.mjs on a frame, not here.'
    );
  }

  // -------------------------------------------------------------------------

  function buildChunk(ctx, cx, cz, detail, ring) {
    const chunk = describe(cx, cz);
    const group = new THREE.Group();
    group.name = `city:${cx},${cz}`;
    let bytes = 0;

    /**
     * THE GROUND IS BUILT FIRST, BECAUSE EVERYTHING ELSE IN THIS FUNCTION
     * STANDS ON IT — session 19.
     *
     * It used to be built two-thirds of the way down, after the buildings, the
     * lamps and the props, which was harmless while nothing asked how high the
     * ground was: every object in the chunk was authored with its base at
     * y = 0 and the quads were 0.020 m above it. Declaring the datum
     * (`constants.js` → `GROUND`) put the pavement at 0.160 m, so a lamp
     * column, a bollard and a bin now have to READ their own pavement — and a
     * query cannot answer before the surface exists.
     *
     * `buildingKey`/`buildingGround` make this chunk's quads visible to
     * `scanGround` before the chunk is resident, which is what lets the lamps
     * and props below go through the SAME `worldSurface` the player and the
     * crowd use rather than through a second height lookup written here. See
     * `scanGround`. Cleared in `finally` so a throw mid-build cannot leave a
     * stale chunk shadowing a real one for the rest of the session.
     */
    const near = detail && ring <= CITY.nearRadius;
    let ground = null;
    if (near) {
      ground = buildGround(chunk);
      bytes += ground.bytes;
    }
    buildingKey = chunkKey(cx, cz);
    buildingGround = ground;
    try {
      return buildChunkBody(ctx, cx, cz, detail, ring, chunk, group, bytes, near, ground);
    } finally {
      buildingKey = '';
      buildingGround = null;
    }
  }

  function buildChunkBody(ctx, cx, cz, detail, ring, chunk, group, bytesIn, near, ground) {
    /**
     * WHAT THIS CHUNK ACTUALLY PUT ON THE GROUND — session 21, and it is the
     * gate's half of the keep-out registry.
     *
     * `src/lib/occupancy.js` holds the registry the GENERATOR writes and reads.
     * This is the same shape of record built from the DELIVERED geometry, at
     * the point of emission, so `citycheck` can run the same conflict table
     * over what was drawn rather than over what was decided. CONTRACT §9.1:
     * *a gate that reads config verifies the config* — and this project has
     * twice had a generator that decided correctly and a module that drew
     * something else (the buried signs, the one-metre road slabs).
     */
    const placed = [];
    let bytes = bytesIn;

    const bodies = [];
    const bodySkin = [];
    const crowns = [];
    const crownSkin = [];
    const windows = [];
    const windowTint = [];
    const signQuads = [];
    const signTint = [];
    /**
     * Session 20. The delivered roof-sign face count and total emitting AREA
     * for this chunk, so the bloom-energy comparison `LIGHT.roofSignNits` asks
     * for is a MEASUREMENT off the geometry rather than that comment's own
     * estimate (§9 rule 4). Summed over resident chunks by `roofSignCensus()`.
     */
    let roofSignFaces = 0;
    let roofSignArea = 0;
    const props = [];
    const propSkin = [];
    const patches = [];

    const rngKey = `${cx},${cz}`;

    /**
     * THE HIGHEST POINT EACH BUILDING ACTUALLY DREW — session 25.
     *
     * The delivered claim below used `bld.height`, the top of the wall, while
     * the crown, the parapet and the roof plant all stand above it. Accumulated
     * HERE, where the boxes are emitted, rather than re-derived in the claim
     * loop: a second expression for the same elevation is CONTRACT §9.1's
     * config-the-code-does-not-read with a height in it, and this file has
     * already paid for that once with `ROOF_PARAPET_M`.
     */
    const deliveredTopByBld = new Map();

    for (const bld of chunk.buildings) {
      const mat = CITY_MATERIALS[bld.material];
      const era = CITY_ERAS[bld.era];
      let deliveredTop = bld.height;

      /**
       * THE MASSING, AND SINCE SESSION 20 IT IS A STACK RATHER THAN A BOX.
       *
       * `buildingTiers()` returns exactly one full-height entry for a building
       * with no setback, so this loop delivers byte-for-byte what the single
       * `bodies.push` above it used to — the un-stepped path is unchanged by
       * ARITHMETIC and not by a branch, which is the same discipline §5.11 uses
       * for a static world's motion vectors.
       *
       * Two or three boxes where there was one, on the ~30% of buildings over
       * 34 m that get a setback. Instances, not draws: they ride in the chunk's
       * existing merged box mesh, which is what makes this affordable at 428 of
       * 440 draw calls on `highway_speed`.
       */
      const tiers = buildingTiers(bld);
      for (const t of tiers) {
        bodies.push(setMatrix(
          bld.x, (t.y0 + t.y1) / 2, bld.z,
          t.width, t.y1 - t.y0, t.depth, bld.yawDeg
        ));
        bodySkin.push({ albedo: mat.albedo, roughness: mat.roughness });
      }

      /**
       * The cantilever, on the contemporary era only. The upper two thirds
       * oversail the base — form rather than material, which is the distinction
       * the setting rests on: a 2049 building is not a 2020 building in a
       * different colour, it is one that could not have been framed in 1960.
       *
       * SUPPRESSED WHERE THERE IS A SETBACK — session 20 — because a mass
       * cannot both oversail and step in at the same level, and it would: the
       * cantilever starts at 0.66 of the height and the first setback lands at
       * 0.45–0.66 of it. A building gets one form or the other, and the setback
       * wins because it is the taller building's form and the cantilever is
       * already restricted to one era.
       */
      if (bld.cantilever > 0 && !bld.setbacks) {
        const dir = bld.facing[0] === 'x' ? [bld.facing[1] === '+' ? 1 : -1, 0] : [0, bld.facing[1] === '+' ? 1 : -1];
        bodies.push(setMatrix(
          bld.x + dir[0] * bld.cantilever * 0.5,
          bld.height * 0.66 + (bld.height * 0.34) / 2,
          bld.z + dir[1] * bld.cantilever * 0.5,
          bld.width + (dir[0] ? bld.cantilever : 0),
          bld.height * 0.34,
          bld.depth + (dir[1] ? bld.cantilever : 0),
          bld.yawDeg
        ));
        bodySkin.push({ albedo: mat.albedo, roughness: mat.roughness * 0.75 });
      }

      /**
       * THE CROWN, AND `bld.crown` IS NOW READ — session 19.
       *
       * `citygen.js` has written `crown: eraName === 'contemporary' ?
       * rng.range(0.15, 0.45) : 0` on every building since the eras were added,
       * and **a tree-wide grep found no reader anywhere in `src/` or `tools/`.**
       * §9.1's first variant — a value in config the code does not read — and it
       * lands on exactly the wrong era: `CITY_ERAS.contemporary` sets
       * `cornice: 0.0`, so the ONE era whose written identity is "cantilevered
       * upper floors, a chamfered or stepped crown" is the one era that got no
       * crown box at all. 51 of 497 buildings in the geometry ring, flat-topped
       * by omission, and the field that was written to fix it never arrived.
       *
       * The gate is now the SUM, so a contemporary building's crown comes from
       * `bld.crown` and every other era's from `era.cornice` exactly as before —
       * 446 of 497 crowns unchanged, +51 new ones. The width factor is 1.6 for a
       * cornice, which OVERSAILS, and 0.55 for a contemporary crown, which is a
       * chamfer and therefore steps IN. That sign is the whole difference
       * between the two forms and it is why one number could not serve both.
       */
      const crownDepth = era.cornice + (bld.crown || 0);
      if (crownDepth > 0.02) {
        const oversail = era.cornice > 0.02 ? era.cornice * 1.6 : -bld.crown * 0.55;
        /**
         * ON THE TOP TIER — session 20. A cornice belongs to the elevation it
         * crowns, and after a setback that elevation is narrower than the base.
         * Left on `bld.width` a 0.9 m prewar cornice would have oversailed the
         * step by the inset as well, i.e. up to 3.5 m of stone hanging in the
         * air over the lower roof.
         */
        const top = tiers[tiers.length - 1];
        crowns.push(setMatrix(
          bld.x, bld.height + crownDepth / 2, bld.z,
          top.width + oversail, crownDepth, top.depth + oversail, bld.yawDeg
        ));
        crownSkin.push({ albedo: mat.albedo, roughness: Math.min(1, mat.roughness + 0.05) });
        deliveredTop = Math.max(deliveredTop, bld.height + crownDepth);
      }

      /**
       * THE ROOFSCAPE IS BUILT ON EVERY RING, NOT ONLY THE DETAIL ONE — session
       * 19, and it is the largest single reason the skyline read as a comb.
       *
       * `if (detail)` wrapped the facade, the ground floor AND the roof plant.
       * `detail` is `ring <= CITY.detailRadius` = 4 against `geometryRadius` = 5,
       * so **ring 5 — 40 chunks, 148 buildings, 576 to 768 m out — was a bare box
       * plus a cornice.** That ring IS the skyline: it is the furthest thing the
       * city draws, it is what an elevated frame is mostly made of, and it is the
       * one ring that had nothing on top of it. The facade and the ground floor
       * are right to stay gated — nobody can see a window reveal at 700 m — and
       * a roof profile is precisely what survives that distance.
       *
       * THE COST IS INSTANCES AND NOT DRAWS, which is what makes it affordable:
       * these boxes ride in the chunk's existing merged box mesh. 148 buildings
       * over four floors × about 8 boxes is ~1 200 instances and ~14 000
       * triangles against a delivered 1.45 M and a 2.00 M ceiling — 0.7%. The
       * draw budget, which is the tight one at 438 of 440 on `highway_speed`,
       * does not move at all.
       */
      deliveredTop = Math.max(deliveredTop, buildRoofscape(bld, mat, bodies, bodySkin, tiers));
      deliveredTopByBld.set(bld, deliveredTop);

      if (detail) {
        /**
         * ONE PASS PER TIER, and `floorBase` accumulates so the display band
         * stays a fraction of the BUILDING. See `buildFacade`'s own note.
         */
        let floorBase = 0;
        for (const t of tiers) {
          buildFacade(bld, era, windows, windowTint, bodies, bodySkin,
            mat.albedo, mat.roughness, t, floorBase, bld.floors);
          floorBase += Math.max(0, Math.round((t.y1 - t.y0) / era.floor));
        }
        buildGroundFloor(bld, era, mat, windows, windowTint, bodies, bodySkin);
      }
    }

    /**
     * SIGNAGE, AND UNTIL THIS SESSION EVERY SIGN IN THE STREAMED CITY WAS
     * BURIED INSIDE ITS OWN BUILDING.
     *
     * `citygen` writes a sign's position as the BUILDING'S CENTRE — the same
     * `cxb, czb` it writes into `occluders` — and this loop offset it by 0.5 m
     * along the outward normal and called that the wall. A building is 15 to 26
     * m deep, so 0.5 m from its centre is 7 to 12 m INSIDE it. Measured over
     * the 49 chunks around the origin at seed 1337, straight out of the pure
     * generator: **208 of 208 signs inside their own building, a median 9.51 m
     * deep, minimum 7.05 m, maximum 12.43 m.** Not one sign of the streamed
     * city's 408 has ever reached a frame.
     *
     * CONTRACT §9's table again, and the pair of quantities is named in one
     * line: A BUILDING'S CENTRE USED AS ITS ELEVATION. Both are a position in
     * metres on the same axis with the same sign convention, and the offset
     * that should have been `depth/2` was 0.5 — which is a plausible number for
     * "stand a fascia slightly proud of the wall" and is exactly what the
     * comment above it said it was doing.
     *
     * WHY THE WINDING CENSUS DID NOT FIND IT and the sign probe did: `city:signs`
     * reads facingMax 0.5381, i.e. half its quads face any given eye, which is
     * correct — the quads are not backwards, they are OCCLUDED. "Submitted and
     * never seen" has two causes and the facing test sees one of them. The
     * other one is `citycheck`'s territory, which already asserts that no PROP
     * is inside a building footprint, and now asserts the same of every sign.
     */
    const halfOutOf = (s) => (s.facing[0] === 'x' ? s.buildingWidth : s.buildingDepth) / 2;
    const halfTanOf = (s) => (s.facing[0] === 'x' ? s.buildingDepth : s.buildingWidth) / 2;
    /**
     * A PlaneGeometry's normal is +Z and `setMatrix` yaws about +Y, so a yaw θ
     * takes the normal to (sin θ, 0, cos θ): +z is 0°, −z is 180°, +x is 90°,
     * −x is −90°. Session 3 had two of those the wrong way round and half the
     * city's signage faced into brickwork; the arithmetic is written out here
     * rather than restated, because a claim is not checkable and this is.
     */
    const yawForNormal = (nx, nz) => (nx ? nx * 90 : nz > 0 ? 0 : 180);
    const pushSign = (m, s, nitsGain = 1) => {
      signQuads.push(m);
      /**
       * State rides in the tint, which the emissive injection multiplies into
       * the emission. A dead sign is not a different mesh or a different
       * material — it is the same sign with the power off, which is what a dead
       * sign is.
       *
       * AND SO DOES THE RADIANCE — session 20, `nitsGain`.
       *
       * A rooftop sign is `LIGHT.roofSignNits` = 1000 cd/m² and a shopfront
       * fascia is `LIGHT.signPlateNits` = 86. Two materials would be two draw
       * calls on a budget sitting at 428 of 440, so the ratio rides in the
       * instance tint instead: `lights.js` injects `totalEmissiveRadiance *=
       * vColor` (§5.6's per-instance emissive tint) and three multiplies the
       * same `instanceColor` into `diffuseColor`, so ONE material at 86 nits
       * carries both populations and the delivered radiance is the product.
       *
       * BOTH NUMBERS, AND THE PRODUCT, because a gain is exactly the kind of
       * quantity §9's table is made of: 86 × 11.63 = 1000.0 cd/m². The DIFFUSE
       * side of the same multiply is checked rather than assumed — the sign
       * material's `color` is 0x101216, i.e. about 0.0056 in linear, so an
       * 11.63× gain puts its reflectance at 0.065. That is a dark grey and not
       * a reflectance above 1, which is what would make this trick a defect.
       */
      const c = SIGN_CHROMA[s.chroma % SIGN_CHROMA.length];
      const gain = (s.state === 'lit' ? 1 : s.state === 'half' ? 0.28 : 0.015) * nitsGain;
      signTint.push({ albedo: [c[0] * gain, c[1] * gain, c[2] * gain], roughness: 0.1 });
    };
    /** 1000 / 86 = 11.63. Computed, not typed, so neither constant can drift alone. */
    const ROOF_SIGN_GAIN = LIGHT.roofSignNits / LIGHT.signPlateNits;
    /** Structure — masts, brackets, pylon posts — into the chunk's own box mesh, so no mounting costs a draw call. */
    const pushStruct = (x, y, z, sx, sy, sz, yawDeg) => {
      bodies.push(setMatrix(x, y, z, sx, sy, sz, yawDeg));
      bodySkin.push({ albedo: [0.13, 0.132, 0.138], roughness: 0.5 });
    };

    for (const s of chunk.signs) {
      const out = s.facing[0] === 'x' ? [s.facing[1] === '+' ? 1 : -1, 0] : [0, s.facing[1] === '+' ? 1 : -1];
      /** Along the elevation, perpendicular to `out` in the horizontal plane. */
      const tan = out[0] ? [0, 1] : [1, 0];
      const height = s.width * s.aspect;
      const halfOut = halfOutOf(s);
      const along = s.along * halfTanOf(s) * 0.82;
      /** The point ON the elevation, at the sign's own station along it. */
      const wx = s.x + out[0] * halfOut + tan[0] * along;
      const wz = s.z + out[1] * halfOut + tan[1] * along;
      const faceYaw = yawForNormal(out[0], out[1]);

      let mount = s.mount;

      /**
       * THE PYLON'S PLACEMENT TEST, AND IT IS A TEST RATHER THAN A HOPE.
       * CONTRACT §9.1: anything placed procedurally is tested against the
       * existing occupancy, or it is not placed. A pylon stands `PYLON_STANDOFF`
       * clear of the elevation, which is on the pavement between the facade and
       * the kerbside prop line — `CITY.roadHalfWidth` is 7.5 and `CORRIDOR` is
       * 11.7, so the pavement is 4.2 m wide and the props sit 0.35 m inside the
       * kerb at the far side of it. 1.7 m from the facade is inside that band
       * with 2.15 m to the prop line. Where the chunk's own occupancy says
       * otherwise — a landmark, a neighbouring building on a corner — the sign
       * is refused back to `flush` rather than moved, because a moved sign is a
       * sign somewhere nobody decided.
       */
      const PYLON_STANDOFF = 1.7;
      const PYLON_HALF = 0.55;
      if (mount === 'freestanding') {
        const px = s.x + out[0] * (halfOut + PYLON_STANDOFF) + tan[0] * along;
        const pz = s.z + out[1] * (halfOut + PYLON_STANDOFF) + tan[1] * along;
        const clash = (chunk.occluders || []).some((o) =>
          px + PYLON_HALF > o.x0 && px - PYLON_HALF < o.x1 &&
          pz + PYLON_HALF > o.z0 && pz - PYLON_HALF < o.z1);
        const inBlock = px > BLOCK_KEEPOUT.x0 && px < BLOCK_KEEPOUT.x1 &&
          pz > BLOCK_KEEPOUT.z0 && pz < BLOCK_KEEPOUT.z1;
        /**
         * AND AGAINST THE PYLONS ALREADY STANDING — SESSION 27, AND IT CLOSES
         * THE ONE TRUE RED THIS PROJECT HAS CARRIED SINCE SESSION 24.
         *
         * The test above asks the chunk's OCCLUDERS, which are buildings. A
         * pylon is not a building and never entered that list, so two pylons
         * could be decided independently and stand on the same square metre of
         * pavement. Delivered, over the resident ring: **two pylons 0.322 m
         * apart at (10.000, 163.966) and (10.000, 163.644), overlapping by
         * 0.366 m²** — one's panel through the other's post, and the only
         * forbidden overlap in `citycheck`'s delivered sweep. CONTRACT §9.1's
         * placement rule with the object's own category as the thing it was not
         * tested against: *"anything placed procedurally is tested against the
         * existing occupancy, or it is not placed."*
         *
         * `placed` IS THE CHUNK'S OWN CLAIM LIST and that is the right scope
         * here rather than a limitation to apologise for — measured, both
         * members of the pair are in chunk (0, 1), and a pylon's 1.7 m standoff
         * puts it against its own building's elevation, so two that can collide
         * are two on the same run of pavement. A cross-chunk pair would need
         * two elevations 0.3 m apart across a chunk seam, which the 4.2 m
         * pavement and the perimeter walk's own spacing do not produce. Stated
         * so the next session knows the bound rather than discovering it.
         *
         * THE PAD IS `PYLON_HALF` AND THE CLAIM BELOW IS TIGHTER, DELIBERATELY.
         * 0.55 m is a placement clearance — the same square this routine already
         * offers a building — while the claim is the post and panel's own
         * rotated extent (0.13–1.30 m half). So the test refuses a little more
         * ground than the claim occupies, which is the safe direction for a
         * keep-out: it can refuse a pylon, it cannot admit an overlapping one.
         * Two pylons 1.2 m apart do not overlap and are still refused, and that
         * is wanted — a sign you cannot walk between is not a sign.
         *
         * REFUSED BACK TO `flush`, not moved, for the reason the comment above
         * already gives: a moved sign is a sign somewhere nobody decided.
         */
        const signClash = placed.some((p) =>
          p.kind === 'sign' &&
          px + PYLON_HALF > p.x0 && px - PYLON_HALF < p.x1 &&
          pz + PYLON_HALF > p.z0 && pz - PYLON_HALF < p.z1);
        if (clash || inBlock || signClash) mount = 'flush';
      }

      if (mount === 'rooftop') {
        /**
         * ROOF SIGNS — SESSION 20, ITEM 3, AND THE LARGEST UNBUILT EMISSIVE
         * SOURCE THIS CITY HAD.
         *
         * WHY IT IS THE FIX FOR THE MEAN-LUMINANCE RED AND NOTHING IN THE
         * LIGHTING MODEL IS. STATE 19 §4 and STATE 18 §3.2 are two
         * impossibility proofs with the same ending: lifting a night facade one
         * stop needs the road's own illuminance ON THE WALL, a cutoff optic
         * delivers a tenth of that by design, and no ambient term brings an
         * unlit wall within 5× of the sky behind it. Both end at "what moves
         * that frame is EMISSION". This is emission, at the one height the city
         * has none — STATE 19 §8 measured the elevated frame at 99.30% shadow
         * and median code 7 with a roofscape that had just landed, because at
         * night a cluttered black silhouette and a plain one are both black.
         *
         * ZERO DRAW CALLS AND ZERO CLUSTER SLOTS. The faces ride in the merged
         * `city:signs` mesh at a tint gain (see `pushSign`); the frames, legs
         * and brackets ride in the chunk's own box mesh through `pushStruct`.
         * The pool has 28 spare slots and this asks for none of them, by the
         * same argument the vehicles' tail lamps make: a sign read from 600 m
         * is worth its own radiance and not the pool it throws.
         *
         * THREE MOUNTINGS, and the vertical arrangement is the whole variation:
         * one sits ON the roof line, one stands clear of it against the sky,
         * and one hangs over the edge and reads from the pavement below.
         */
        const roofMount = s.roofMount || 'parapet';
        const two = s.doubleSided ? [1, -1] : [1];
        /** How far in from the elevation the sign's own plane stands. */
        const inset = roofMount === 'cantilever' ? -0.55 : roofMount === 'frame' ? 1.35 : 0.18;
        const cx3 = wx - out[0] * inset;
        const cz3 = wz - out[1] * inset;

        /**
         * TESTED AGAINST THE CHUNK'S OWN OCCUPANCY, OR IT IS NOT PLACED —
         * CONTRACT §9.1's rule, and the FIRST RUN OF THIS SESSION'S CONTENT IS
         * WHY IT IS HERE.
         *
         * `citycheck` reported **1 of 908 delivered sign quads inside a
         * building**, against a ceiling of 0. It is not this sign's own
         * building: a roof sign's centre is `bld.height + ROOF_PARAPET_M + more`,
         * which is above its own occluder's `top` by construction on all three
         * mountings. What it is, is STATE §10's carried gap — *"the four island
         * frontages overlapping at the corners"*. The generator walks each side
         * of an island independently and tests a building against the ones
         * already placed on its own run; at a corner two runs meet and their
         * footprints can overlap, so a roof sign on the shorter of the two
         * stands inside the taller one, forty metres up, at the corner.
         *
         * REFUSED RATHER THAN MOVED, which is the same decision the pylon above
         * makes and for the same reason: a moved sign is a sign somewhere
         * nobody decided. The condition is the gate's own — inside the footprint
         * in plan AND below that box's top — so the two cannot drift apart.
         *
         * IT DOES NOT REPAIR THE CORNER OVERLAP, and that is the honest
         * statement: the overlapping BUILDINGS are still overlapping and are
         * still STATE §10's gap. This stops one session's new content from
         * standing inside the consequence.
         */
        let blocked = false;
        for (const o of chunk.occluders || []) {
          if (o.landmark != null || o.river != null) continue;
          if (cx3 > o.x0 && cx3 < o.x1 && cz3 > o.z0 && cz3 < o.z1 && s.y < o.top) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;
        for (const dir of two) {
          pushSign(setMatrix(
            cx3 + out[0] * 0.06 * dir, s.y, cz3 + out[1] * 0.06 * dir,
            s.width, height, 1,
            s.yawDeg + yawForNormal(out[0] * dir, out[1] * dir)
          ), s, ROOF_SIGN_GAIN);
        }

        /**
         * THE STRUCTURE, AND IT IS WHAT MAKES THE MOUNTING READ RATHER THAN
         * DECORATION. A lit rectangle floating over a roof is a decal; the legs
         * under it are what say how far above the roof it is, and at night they
         * are silhouetted against their own sign, which is the one place in this
         * frame where unlit geometry is legible.
         */
        const roofTop = s.buildingHeight + ROOF_PARAPET_M;
        if (roofMount === 'frame') {
          // Two legs from the roof to the sign's bottom edge, and a brace at
          // mid-height. The legs are set in from the face's ends by a sixth,
          // which is where a real lattice tower stands under a hoarding.
          const legY0 = s.buildingHeight;
          const legTop = s.y - height / 2;
          for (const k of [-1, 1]) {
            pushStruct(
              cx3 + tan[0] * k * s.width * 0.33, (legY0 + legTop) / 2, cz3 + tan[1] * k * s.width * 0.33,
              out[0] ? 0.34 : 0.26, Math.max(0.4, legTop - legY0), out[0] ? 0.26 : 0.34, 0
            );
          }
          pushStruct(
            cx3, legY0 + (legTop - legY0) * 0.55, cz3,
            out[0] ? 0.2 : s.width * 0.66, 0.16, out[0] ? s.width * 0.66 : 0.2, 0
          );
        } else if (roofMount === 'cantilever') {
          // Two brackets from the parapet out to the sign's inner edge, at the
          // sign's own top, so the load path reads the way a real one does.
          for (const k of [-1, 1]) {
            pushStruct(
              wx - out[0] * 0.28 + tan[0] * k * s.width * 0.36,
              s.y + height / 2 - 0.15,
              wz - out[1] * 0.28 + tan[1] * k * s.width * 0.36,
              out[0] ? 1.1 : 0.16, 0.16, out[0] ? 0.16 : 1.1, 0
            );
          }
        } else {
          // A parapet sign is bolted to the upstand: one rail along its foot.
          pushStruct(
            cx3, roofTop - 0.1, cz3,
            out[0] ? 0.24 : s.width, 0.2, out[0] ? s.width : 0.24, 0
          );
        }
        roofSignFaces += two.length;
        roofSignArea += s.width * height * two.length;
      } else if (mount === 'flush') {
        /** A fascia stands proud of the masonry it is bolted to; 0.12 m is a channel-letter box. */
        pushSign(setMatrix(
          wx + out[0] * 0.12, s.y, wz + out[1] * 0.12,
          s.width, height, 1, s.yawDeg + faceYaw
        ), s);
      } else if (mount === 'projecting') {
        /**
         * A BLADE. Its plane is perpendicular to the elevation, so its normal
         * is ±`tan`, and it reads ALONG the street — which is how a street is
         * seen and is the whole reason this mounting exists.
         *
         * THE PROJECTION IS CLAMPED AND THE CLAMP IS DERIVED. The pavement is
         * `CORRIDOR − CITY.roadHalfWidth` = 11.7 − 7.5 = 4.2 m wide. A blade
         * that reached across it would hang over the carriageway at 4.2 m,
         * which is under the 4.5 m a vehicle needs, so the projection is capped
         * at 2.4 m — the sign plus its 0.35 m standoff is 2.75 m, leaving
         * 1.45 m of pavement clear beneath its outer edge.
         */
        const proj = Math.min(s.width, 2.4);
        const cx2 = wx + out[0] * (0.35 + proj / 2);
        const cz2 = wz + out[1] * (0.35 + proj / 2);
        /**
         * BOTH FACES, ROTATED AND NOT MIRRORED. `block.js` mirrored its sign
         * back faces with a negative x scale for thirteen sessions: three
         * compensates the culling and not the normal, so the far face was
         * visible and lit from behind. A rotation is a proper transform.
         */
        for (const dir of [1, -1]) {
          pushSign(setMatrix(
            cx2 + tan[0] * 0.05 * dir, s.y, cz2 + tan[1] * 0.05 * dir,
            proj, height, 1,
            s.yawDeg + yawForNormal(tan[0] * dir, tan[1] * dir)
          ), s);
        }
        // The bracket, at the sign's own top edge, from the wall to its inner edge.
        pushStruct(
          wx + out[0] * (0.35 + proj / 2) * 0.5, s.y + height / 2 + 0.1, wz + out[1] * (0.35 + proj / 2) * 0.5,
          out[0] ? 0.35 + proj / 2 : 0.1, 0.1, out[0] ? 0.1 : 0.35 + proj / 2, 0
        );
      } else if (mount === 'roof') {
        /**
         * ON THE PARAPET, WHICH IS 1.05 m HIGH AND IS BUILT ABOVE — the same
         * `ph` the facade loop uses, read from there rather than guessed, so a
         * change to the upstand cannot leave a sign floating over it.
         */
        // `ROOF_PARAPET_M`, not a second literal 1.05 — session 20. The comment
        // that used to sit here claimed this was "read from" the facade loop's
        // upstand so that a change to one could not leave the other floating.
        // It was not read from anything; both were literals. Now both are this.
        const legs = 1.1;
        const y = s.buildingHeight + ROOF_PARAPET_M + legs + height / 2;
        pushSign(setMatrix(
          wx - out[0] * 0.05, y, wz - out[1] * 0.05,
          s.width, height, 1, s.yawDeg + faceYaw
        ), s);
        for (const k of [-1, 1]) {
          pushStruct(
            wx + tan[0] * k * s.width * 0.34 - out[0] * 0.2,
            s.buildingHeight + ROOF_PARAPET_M + legs / 2 + 0.1,
            wz + tan[1] * k * s.width * 0.34 - out[1] * 0.2,
            0.14, legs + height * 0.5, 0.14, 0
          );
        }
      } else {
        // freestanding — a pylon on the pavement, on its own post.
        const px = s.x + out[0] * (halfOut + PYLON_STANDOFF) + tan[0] * along;
        const pz = s.z + out[1] * (halfOut + PYLON_STANDOFF) + tan[1] * along;
        /** A pylon is read from both directions along the pavement; both faces, rotated. */
        const py = Math.max(2.6, Math.min(s.y, 7.5));
        /**
         * THE WHOLE PYLON STANDS ON ITS PAVEMENT — session 19.
         *
         * `py` is a MOUNTING HEIGHT, not a world coordinate: it is clamped to
         * 2.6–7.5 m, which are heights above the footway a sign is legible from,
         * and the post below runs from the ground up to the sign's lower edge.
         * Both were measured from y = 0, so the post was 0.030 m buried before
         * the datum moved and would be 0.160 m buried after it. The sign and the
         * post lift together, or the post stops reaching the sign.
         */
        const baseY = worldSurface(ctx, px, pz).y;
        for (const dir of [1, -1]) {
          pushSign(setMatrix(
            px + out[0] * 0.06 * dir, baseY + py, pz + out[1] * 0.06 * dir,
            Math.min(s.width, 2.6), height, 1,
            s.yawDeg + yawForNormal(out[0] * dir, out[1] * dir)
          ), s);
        }
        const POST_M = 0.26;
        pushStruct(px, baseY + (py - height / 2) / 2, pz, POST_M, py - height / 2, POST_M, 0);
        /**
         * AND IT IS CLAIMED — SESSION 24, AND IT IS THE FIRST `sign` CLAIM THIS
         * PROJECT HAS EVER MADE.
         *
         * `occupancy.js` has carried the category since session 21 and says in
         * its own comment what it is for: *"a FREESTANDING sign pylon. A flush
         * or projecting sign is part of its building and claims nothing."* Both
         * halves of that sentence were true of the code except the first —
         * `sign` appears in eight rows of the conflict table and NOTHING, in
         * either the generator or the delivered census, has ever written one.
         * A whole category with no claims in it is CONTRACT §9.1's
         * config-the-code-does-not-read with a conflict rule instead of a
         * value, and `tools/emitcensus.mjs` prints the empty categories for
         * exactly this reason.
         *
         * A pylon is a post on a pavement carrying a panel over it, and the
         * conflict table already says what that must not share ground with: a
         * building, a landmark, a carriageway, the block, water, a prop, a
         * site, a feature and another sign.
         *
         * THE EXTENT IS THE PYLON'S OWN, ROTATED, AND NOT THE MATRICES'.
         * `pushSign` passes `sz = 1` into `setMatrix` against a `PlaneGeometry`,
         * which has NO depth — so a claim read off that matrix would be a metre
         * deep where nothing is. What is actually solid here is the post,
         * `POST_M` square, with the two faces at ±0.06 inside it. The
         * along-axis extent is the panel's, clamped exactly as the emission
         * clamps it. The rotation is folded in the same way `citygen.js`'s
         * `paint()` and its kerbside prop claim fold theirs — |cos|·L + |sin|·W
         * — which is the third reader of that expression and is spelt the same
         * way in all three.
         *
         * COST, MEASURED BEFORE IT WAS BUILT (`tools/emitcensus.mjs`): 36
         * pylons over the resident ring, **0 new forbidden overlaps**. This
         * declares what is there and refuses nothing.
         */
        const panelM = Math.min(s.width, 2.6);
        const ca = Math.abs(Math.cos(s.yawDeg * DEG));
        const sa = Math.abs(Math.sin(s.yawDeg * DEG));
        const halfAlong = (ca * panelM + sa * POST_M) / 2;
        const halfAcross = (sa * panelM + ca * POST_M) / 2;
        const hxW = tan[0] ? halfAlong : halfAcross;
        const hzW = tan[1] ? halfAlong : halfAcross;
        placed.push({
          kind: 'sign', owner: 'pylon',
          x0: px - hxW, x1: px + hxW, z0: pz - hzW, z1: pz + hzW,
          y0: 0, y1: Math.max(0.05, py + height / 2),
        });
      }
    }

    if (detail) {
      /**
       * STREET FURNITURE AND PLANTING, FROM `PROP_MODELS`.
       *
       * Until this session every one of the nine kinds was ONE box — `1.1 ·
       * scale` tall, `2 · propHalfWidth · scale` square, in one of two colours
       * — so a tree was a green cube and a bin, a bollard, a cabinet and a
       * planter were the same grey cube at the same height. The models, the
       * variant count, the four spread axes and the arithmetic for the pad are
       * all in `src/lib/citygen.js`, which is where the pad has to live because
       * the scatter tests occupancy with it (§9 rule 3).
       *
       * These boxes ride in the chunk's ONE box mesh — the same argument the
       * window reveals ride on — so the whole thing costs no draw call. What it
       * costs is instances, and the census below counts BOXES rather than props
       * because the census's numeric fields must sum to the mesh's instance
       * count; the prop count goes beside it as a string so the two quantities
       * cannot be mistaken for each other, which is exactly the confusion
       * CONTRACT §9 is a list of.
       */
      for (const p of chunk.props) {
        const model = PROP_MODELS[p.kind];
        if (!model || !model.length) continue;
        /**
         * THE DELIVERED EXTENT, ACCUMULATED FROM THE MATRICES THAT WERE
         * ACTUALLY PUSHED — session 21.
         *
         * `citycheck`'s occupancy gate must read the ARTEFACT and not the
         * generator's description of it (CONTRACT §9.1: a gate that reads
         * config verifies the config). The generator claimed a square of
         * `propHalfWidth`; what is DRAWN is a set of boxes under a scale, a
         * yaw, a lean and a per-box tilt, and the two are only the same number
         * if every one of those transforms does what its author thought. Twice
         * now one has not.
         *
         * Same argument, and the same 48-bytes-a-record price, as
         * `buildGround`'s `rects`: it cannot disagree with the mesh because it
         * IS the mesh.
         */
        /**
         * TWO BANDS, SPLIT AT HEAD HEIGHT, AND THE SPLIT IS WHAT MAKES THE
         * CHECK CORRECT RATHER THAN LOUD.
         *
         * One AABB per prop, claimed from the ground to its own top, reported
         * **60 forbidden overlaps between a street tree and the carriageway it
         * stands beside** — every one of them a canopy at 3.4 to 5.8 m
         * overhanging a road surface at 0.05 m. A tree overhanging a
         * carriageway is what a street tree IS; the conflict was the
         * instrument's, from collapsing a three-dimensional object into a
         * footprint and then testing it against a vertical extent.
         *
         * The split is `HEAD_CLEAR_M` = 2.10 m, which is `citygen`'s own number
         * for exactly this distinction (`propHalfAcross` counts only what is
         * below it, because the question a pavement asks is "what is in my
         * way" and not "what is over my head"). Two bands rather than one box
         * per model box, because a prop's own boxes overlap each other by
         * construction and would report a tree as colliding with itself.
         */
        const band = [
          { kind: 'prop', x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, y0: Infinity, y1: -Infinity },
          { kind: 'canopy', x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, y0: Infinity, y1: -Infinity },
        ];
        const v = model[Math.min(model.length - 1, p.variant || 0)];
        const leanDeg = v.leanRange ? v.leanRange * (p.lean || 0) : 0;
        const soil = p.soil == null ? 1 : p.soil;
        /**
         * ONE QUERY PER PROP, AT BUILD TIME — session 19. A prop does not move,
         * so there is nothing for the frame loop to ask; what there was until
         * this session was no query at all, and every bollard, bin, cabinet,
         * bench, planter, hydrant and tree in the city stood on the plane y = 0
         * while its own pavement was somewhere else.
         *
         * `p.kerb` says WHICH BAND the scatter chose (`citygen.js`), and it is
         * deliberately not used here: a kerbside prop is on a pavement at
         * `GROUND.pavement` in the streamed city, on the origin block's
         * pavement inside the keep-out and on the river's promenade on a quay,
         * and the query answers all three from the geometry that was emitted.
         * Reading the boolean instead would be a rule about where the scatter
         * MEANT to put it (§9.1's "a gate that reads config verifies the
         * config"), and it would be wrong at exactly the two places that are
         * interesting.
         */
        const baseY = worldSurface(ctx, p.x, p.z).y;
        for (const b of v.boxes) {
          const m = propMatrix(p, b, leanDeg, baseY);
          props.push(m);
          propSkin.push({
            albedo: [b.albedo[0] * soil, b.albedo[1] * soil, b.albedo[2] * soil],
            roughness: b.rough,
          });
          // The box's own world half-extents, off the delivered matrix: the
          // sum of |basis column| * 0.5 per axis, which is exact for a box
          // under any rotation and scale.
          const e = m.elements;
          const hx = (Math.abs(e[0]) + Math.abs(e[4]) + Math.abs(e[8])) / 2;
          const hy = (Math.abs(e[1]) + Math.abs(e[5]) + Math.abs(e[9])) / 2;
          const hz = (Math.abs(e[2]) + Math.abs(e[6]) + Math.abs(e[10])) / 2;
          const lo = e[13] - hy - baseY;
          const bd = band[lo < HEAD_CLEAR_M ? 0 : 1];
          if (e[12] - hx < bd.x0) bd.x0 = e[12] - hx;
          if (e[12] + hx > bd.x1) bd.x1 = e[12] + hx;
          if (e[14] - hz < bd.z0) bd.z0 = e[14] - hz;
          if (e[14] + hz > bd.z1) bd.z1 = e[14] + hz;
          if (lo < bd.y0) bd.y0 = lo;
          if (e[13] + hy - baseY > bd.y1) bd.y1 = e[13] + hy - baseY;
        }
        for (const bd of band) {
          if (bd.x1 <= bd.x0) continue;
          placed.push({
            kind: bd.kind, owner: p.kind,
            x0: bd.x0, x1: bd.x1, z0: bd.z0, z1: bd.z1,
            y0: Math.max(0, bd.y0), y1: Math.max(0.05, bd.y1),
          });
        }
      }

      /**
       * WHAT A PARK AND A SITE BUILD — session 21.
       *
       * `chunk.features` is decided in the generator, beside the registry that
       * refused the ones that did not fit. Nothing here places anything: this
       * turns a list of decisions into boxes, exactly as the prop loop above
       * turns `chunk.props` into boxes.
       *
       * All of it rides in the chunk's own box mesh at ZERO extra draw calls,
       * which is the same arrangement the props and the window reveals already
       * have and is the reason a park can afford lighting columns at all.
       */
      for (const f of chunk.features) {
        const y0 = worldSurface(ctx, f.x, f.z).y;
        let fx0 = Infinity; let fx1 = -Infinity; let fz0 = Infinity; let fz1 = -Infinity; let fTop = 0;
        const put = (dx, dy, dz, sx, sy, sz, albedo, rough, yawDeg) => {
          const c = Math.cos(((f.yawDeg || 0) * Math.PI) / 180);
          const s = Math.sin(((f.yawDeg || 0) * Math.PI) / 180);
          const wx = f.x + dx * c - dz * s;
          const wz = f.z + dx * s + dz * c;
          const m = setMatrix(wx, y0 + dy, wz, sx, sy, sz,
            (yawDeg === undefined ? (f.yawDeg || 0) : yawDeg));
          props.push(m);
          propSkin.push({ albedo, roughness: rough });
          /**
           * THE BOX'S OWN WORLD HALF-EXTENTS, OFF THE DELIVERED MATRIX — and
           * this line was `Math.max(sx, sz) / 2`, USED ON BOTH AXES, until
           * session 24.
           *
           * A hoarding panel is `SITE.hoardingSegment` = 2.4 m long and 0.06 m
           * deep. `max(2.4, 0.06) / 2` is 1.2, applied to x AND z, so the
           * delivered census recorded a **2.4 × 2.4 m square** where a
           * **2.4 × 0.06 m panel** was drawn — 40× the depth, on the axis that
           * faces the street. CONTRACT §9's shape with two extents: the LONGER
           * of a box's two horizontal dimensions used as BOTH of them.
           *
           * IT IS WHAT `citycheck` → `occupancy` HAS BEEN RED ON SINCE SESSION
           * 22. `prop(container) × site(hoarding)` at 0.173 and 0.266 m²:
           * session 22 diagnosed it to the hoarding's FEET (0.34 × 0.5 =
           * 0.170 m², against 0.173 measured — an arithmetic coincidence),
           * built two candidate repairs on the GENERATOR's claim, measured both
           * as changing nothing, and reverted them. `tools/boxprobe.mjs` puts
           * the delivered SUB-BOXES side by side and the answer is that **no
           * two solids touch at all**: nearest approach 0.84 m, 0.87 m and
           * 0.55 m on the three pairs. The overlap was between two RECORDS.
           *
           * AND IT IS NOT ONLY A LOOSENING, WHICH IS WHY IT IS A CORRECTION
           * RATHER THAN A GATE WEAKENED TO PASS. A square of `max(sx, sz)` is
           * larger than the true AABB on the short axis and SMALLER than it on
           * a rotated box's long axis — a box yawed 45° reaches `hypot(sx, sz)`
           * where the square stops at `max(sx, sz)`, i.e. the old record
           * UNDER-claimed a spoil heap by up to √2. `citycheck`'s own numbers
           * either side of this change are in STATE 24 §2.
           *
           * The prop loop sixty lines above has computed exactly this, off
           * exactly this matrix, since session 21 — with a comment saying why.
           * This is the copy that did not. Spelt the same way on purpose.
           */
          const e = m.elements;
          const hx = (Math.abs(e[0]) + Math.abs(e[4]) + Math.abs(e[8])) / 2;
          const hy = (Math.abs(e[1]) + Math.abs(e[5]) + Math.abs(e[9])) / 2;
          const hz = (Math.abs(e[2]) + Math.abs(e[6]) + Math.abs(e[10])) / 2;
          if (e[12] - hx < fx0) fx0 = e[12] - hx;
          if (e[12] + hx > fx1) fx1 = e[12] + hx;
          if (e[14] - hz < fz0) fz0 = e[14] - hz;
          if (e[14] + hz > fz1) fz1 = e[14] + hz;
          if (e[13] + hy - y0 > fTop) fTop = e[13] + hy - y0;
        };
        if (f.kind === 'edge') {
          /**
           * THREE TREATMENTS OFF ONE DESCRIPTION. A railing is standards and a
           * top rail; a hedge is one clipped mass; a low wall is a course and a
           * coping. The reflectances are the same physical ones the props use —
           * cast iron 0.055, foliage 0.085, concrete 0.30 — because a park
           * railing is the same iron as a bollard.
           */
          if (f.edge === 'railing') {
            put(0, f.height * 0.5, 0, f.length * 0.96, 0.05, 0.05, [0.055, 0.055, 0.058], 0.7);
            put(0, f.height * 0.62, 0, f.length * 0.96, 0.04, 0.04, [0.055, 0.055, 0.058], 0.7);
            for (const e of [-0.48, 0, 0.48]) put(f.length * e, f.height * 0.5, 0, 0.06, f.height, 0.06, [0.055, 0.055, 0.058], 0.7);
          } else if (f.edge === 'hedge') {
            put(0, f.height * 0.5, 0, f.length, f.height, 0.44, [0.062, 0.098, 0.052], 0.95);
            put(0, f.height * 0.88, 0, f.length * 0.94, f.height * 0.3, 0.36, [0.074, 0.112, 0.058], 0.95);
          } else {
            put(0, f.height * 0.44, 0, f.length, f.height * 0.88, 0.36, [0.30, 0.298, 0.288], 0.9);
            put(0, f.height * 0.94, 0, f.length * 1.02, f.height * 0.14, 0.44, [0.33, 0.325, 0.31], 0.82);
          }
        } else if (f.kind === 'centre') {
          /**
           * THE THING IN THE MIDDLE. Four kinds, and they differ in SILHOUETTE
           * rather than in decoration, because at the distance a park is read
           * from that is the only channel there is: a pond is a horizontal
           * plane below the eye, a pavilion is a roof on posts, a monument is a
           * vertical, and a square is a level of paving with seating on it.
           */
          const r = f.half;
          if (f.centre === 'pond') {
            put(0, 0.10, 0, r * 2.02, 0.20, r * 2.02, [0.33, 0.325, 0.31], 0.75);
            /**
             * The water. Reflectance 0.02 and roughness 0.06 — Fresnel does the
             * work, which is what makes a still pond read as a mirror of the
             * sky at dusk and as black at midnight. It is a POND rather than
             * `river.js`'s water: no flow, no Cox–Munk, no SSR source, because
             * a 10 m dish does not need a wave model.
             */
            put(0, 0.16, 0, r * 1.86, 0.06, r * 1.86, [0.02, 0.022, 0.026], 0.06);
          } else if (f.centre === 'pavilion') {
            for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(sx * r * 0.7, 1.6, sz * r * 0.7, 0.22, 3.2, 0.22, [0.18, 0.148, 0.108], 0.85);
            put(0, 3.45, 0, r * 1.9, 0.30, r * 1.9, [0.18, 0.148, 0.108], 0.86);
            put(0, 3.85, 0, r * 1.4, 0.55, r * 1.4, [0.16, 0.132, 0.098], 0.86);
            put(0, 0.10, 0, r * 1.7, 0.20, r * 1.7, [0.30, 0.298, 0.288], 0.9);
          } else if (f.centre === 'monument') {
            put(0, 0.30, 0, r * 1.5, 0.60, r * 1.5, [0.30, 0.298, 0.288], 0.9);
            put(0, 1.05, 0, r * 0.9, 0.95, r * 0.9, [0.33, 0.325, 0.31], 0.86);
            put(0, 3.8, 0, r * 0.34, 4.6, r * 0.34, [0.35, 0.345, 0.33], 0.8);
            put(0, 6.4, 0, r * 0.5, 0.5, r * 0.5, [0.32, 0.33, 0.35], 0.44);
          } else {
            put(0, 0.09, 0, r * 2.0, 0.18, r * 2.0, [0.22, 0.216, 0.204], 0.85);
            for (const e of [-1, 1]) put(e * r * 0.66, 0.42, 0, 2.6, 0.44, 0.5, [0.30, 0.298, 0.288], 0.9);
          }
        } else if (f.kind === 'lamp') {
          /**
           * A PARK LAMP, and the head is where the light comes from — the
           * emissive gain and the cluster slot are attached in the lamp pool
           * below, exactly as a street lamp's are, so a park lamp is not a
           * second lighting system.
           */
          put(0, 0.09, 0, 0.42, 0.18, 0.42, [0.30, 0.298, 0.288], 0.9);
          put(0, f.height * 0.5, 0, 0.13, f.height, 0.13, [0.22, 0.222, 0.228], 0.5);
        } else if (f.kind === 'hoarding') {
          put(0, f.height * 0.5, 0, f.length, f.height, 0.06,
            f.printed ? [0.30, 0.26, 0.20] : [0.24, 0.245, 0.235], 0.82);
          for (const e of [-0.42, 0.42]) put(f.length * e, 0.06, 0.18, 0.34, 0.12, 0.5, [0.30, 0.298, 0.288], 0.9);
        } else if (f.kind === 'spoil') {
          /**
           * A HEAP IS THE ONE THING ON A SITE THAT IS NOT RECTANGULAR, so it is
           * three boxes of falling size rotated against each other — the same
           * trick the trees use, and for the same reason: a stack of prisms
           * cannot become a cone, but three of them at different yaws reads as
           * a pile rather than as a crate.
           */
          put(0, f.height * 0.22, 0, f.radius * 1.9, f.height * 0.45, f.radius * 1.8, [0.17, 0.152, 0.126], 0.95, (f.yawDeg || 0));
          put(0, f.height * 0.56, 0, f.radius * 1.35, f.height * 0.45, f.radius * 1.25, [0.16, 0.143, 0.118], 0.95, (f.yawDeg || 0) + 34);
          put(0, f.height * 0.86, 0, f.radius * 0.72, f.height * 0.36, f.radius * 0.66, [0.15, 0.134, 0.11], 0.95, (f.yawDeg || 0) - 21);
        } else if (f.kind === 'frame') {
          /**
           * THE PART-BUILT FRAME. Columns on a grid, slabs over every level but
           * the top, and the top level left as bare columns — which is what
           * says "unfinished" rather than "unskinned".
           */
          const half = (f.bays * f.bayM) / 2;
          for (let i = 0; i <= f.bays; i++) {
            for (let j = 0; j <= f.bays; j++) {
              const dx = -half + i * f.bayM;
              const dz = -half + j * f.bayM;
              put(dx, (f.levels * f.storey) / 2, dz, 0.42, f.levels * f.storey, 0.42, [0.36, 0.355, 0.34], 0.86);
            }
          }
          for (let k = 1; k < f.levels; k++) {
            put(0, k * f.storey, 0, half * 2 + 0.6, 0.26, half * 2 + 0.6, [0.33, 0.325, 0.31], 0.9);
          }
        } else if (f.kind === 'flood') {
          put(0, 0.14, 0, 0.9, 0.28, 0.9, [0.30, 0.298, 0.288], 0.9);
          put(0, f.height * 0.5, 0, 0.20, f.height, 0.20, [0.34, 0.345, 0.352], 0.55);
        } else if (f.kind === 'crane') {
          /**
           * THE CRANE'S STATIC HALF: a ballast pad and the mast. What SLEWS —
           * the jib, the counter-jib, the cab, the hoist and its load — is
           * `moving.js`, because a chunk mesh is rebuilt on a residency change
           * and a jib has to turn every frame.
           */
          put(0, 0.35, 0, 7.0, 0.7, 7.0, [0.33, 0.325, 0.31], 0.9);
          put(0, f.mast / 2, 0, 1.9, f.mast, 1.9, [0.52, 0.34, 0.09], 0.62);
          for (let k = 1; k * 12 < f.mast; k++) {
            put(0, k * 12, 0, 2.4, 0.35, 2.4, [0.52, 0.34, 0.09], 0.62);
          }
        }
        if (fx1 > fx0) {
          placed.push({
            kind: f.kind === 'hoarding' || f.kind === 'spoil' || f.kind === 'frame'
              || f.kind === 'crane' || f.kind === 'flood' ? 'site' : 'feature',
            owner: `${f.kind}:${f.edge || f.centre || ''}`,
            x0: fx0, x1: fx1, z0: fz0, z1: fz1, y0: 0, y1: Math.max(0.05, fTop),
          });
        }
      }

      /**
       * THE PAINT — session 21, item 6.
       *
       * `chunk.markings` is decided in the generator against the same
       * `CITY.stopLineFromJunctionM` that `traffic.js` brakes to, and clipped
       * to the carriageway claims that were actually emitted. This turns it
       * into boxes.
       *
       * WHAT A MARKING IS MADE OF, AND WHY IT IS NOT A GROUND QUAD. A line
       * painted into the ground mesh would be one more vertex-coloured
       * rectangle at the road's own height, and coplanar surfaces z-fight. A
       * 4 mm box standing on the road is what a thermoplastic line actually is
       * — 2 to 3 mm of screed with beads rolled into it — and its EDGE is what
       * catches a headlight at a grazing angle, which is the whole reason to
       * spend a box rather than a colour.
       *
       * REFLECTANCE 0.62 LINEAR, against the carriageway's 0.082. Fresh white
       * road-marking material runs 0.55 to 0.70 diffuse; 0.62 is the middle,
       * and the contrast that matters is the RATIO: **7.6x the asphalt it lies
       * on**, which is what makes a line read under a street lamp at all.
       *
       * WHAT IS NOT MODELLED, STATED RATHER THAN FAKED. A real marking is
       * RETROREFLECTIVE — glass beads return light toward its source — and the
       * standard measure is RL, the coefficient of retroreflected luminance, at
       * a 1.05 deg observation angle and an 88.76 deg entrance angle. A class
       * R2 marking gives RL = 100 mcd/(m2*lx). The diffuse surface here
       * delivers, at that same grazing entrance,
       * `E*cos(88.76 deg)*0.62/pi` = **4.1 mcd/(m2*lx)**, i.e. **24x less**.
       * So a line seen far down a headlight beam is dimmer here than it would
       * be in the world, and a line seen from ten metres — where the entrance
       * angle is 79 deg and the diffuse term is 23 mcd/(m2*lx) — is within 4.3x
       * of it. This project has no retroreflective BRDF and adding one is a
       * shader change with no gate behind it, so the gap is written down with
       * its arithmetic instead. It is the honest half of "retroreflective under
       * headlights is the detail that pays".
       */
      for (const mk of chunk.markings) {
        const y = worldSurface(ctx, mk.x, mk.z).y;
        props.push(setMatrix(mk.x, y + MARKING_THICKNESS_M / 2, mk.z,
          mk.length, MARKING_THICKNESS_M, mk.width, mk.yawDeg));
        propSkin.push({ albedo: MARKING_ALBEDO, roughness: 0.62 });
      }

      /**
       * Road-surface patches — the third material variant, and the one that
       * makes a road look maintained rather than manufactured. Rectangles of
       * different asphalt laid over the base at a shallow angle to the kerb,
       * which is what a utility trench reinstatement looks like.
       *
       * ────────────────────────────────────────────────────────────────────
       * THIS IS ITEM 9. THE OPERATOR SAW "A CUBE IN THE CARRIAGEWAY, NORTH OF
       * THE VIADUCT", AND IT IS THIS LINE — session 19.
       *
       * The `y` argument to `setMatrix` was 0.025 and the `sy` argument was
       * **`1`**. Every other `sy` in this file is a LENGTH IN METRES (the
       * cornice is `era.cornice`, a building is `bld.height`), and this one was
       * a unit scale standing in for a thickness. `geometries.box` is a UNIT
       * box, so `sy = 1` is a **one-metre-tall slab**: the patch spanned
       *
       *     y ∈ [0.025 − 0.5, 0.025 + 0.5] = [−0.475, +0.525]
       *
       * i.e. it stood **0.505 m proud of its own carriageway**, 3 to 6 times in
       * every chunk whose `roadMaterials` includes `patched`, 3–5 m wide and
       * 5–12.5 m long. A dark asphalt slab half a metre out of the road, at a
       * shallow angle to the kerb, is exactly a cube in the carriageway — and
       * traffic drives through it, because a patch is not an occluder and
       * nothing in the placement chain has ever been told about it.
       *
       * CONTRACT §9's shape with a SCALE and a THICKNESS: both are dimensionless
       * to `Matrix4.compose`, both are plausible at 1, and the frame renders. It
       * survived because the centre was RIGHT — 0.025 was chosen as
       * `roadNS(0.020) + t/2` for a 10 mm reinstatement — so the arithmetic that
       * would have exposed it had already been done correctly one argument
       * earlier. It is row 19b.
       *
       * The thickness is now stated, once, and the centre is derived FROM it and
       * from the datum rather than being a second literal that has to agree.
       */
      const b = chunkBounds(cx, cz);
      /**
       * Metres. A utility trench reinstatement stands proud of the surface it
       * was cut into by the thickness of the wearing course laid back over it —
       * 10 mm is the low end of a 10–40 mm surface course and is the value the
       * old 0.025 centre was already derived for (`0.025 − 0.020 = 0.005 = t/2`).
       * Thin enough that a wheel does not visibly climb it; thick enough that
       * the edge catches a headlight, which is the whole reason the patch is a
       * BOX rather than another ground quad.
       */
      const PATCH_THICKNESS_M = 0.01;
      const patchCount = chunk.roadMaterials.includes('patched') ? 3 + (chunk.objectCount % 4) : 0;
      for (let i = 0; i < patchCount; i++) {
        const t = ((i * 37) % 100) / 100;
        const along = b.z0 + t * CITY.chunkSize;
        patches.push(setMatrix(
          b.x0 + (i % 2 ? 3.2 : -3.4),
          GROUND.carriageway + PATCH_THICKNESS_M / 2,
          along,
          3 + (i % 3), PATCH_THICKNESS_M, 5 + (i % 4) * 2.5, ((i * 13) % 5) - 2
        ));
      }
    }

    /**
     * ONE box mesh per chunk, not four.
     *
     * Building masses, cornices, street furniture and road patches are all boxes
     * with a per-instance albedo and a per-instance roughness, and the material
     * they were split across differed only in a roughness that the instance
     * attribute overrides anyway. Four draw calls describing one thing.
     *
     * This is the single largest line item in the draw budget: measured at 471
     * calls on the dense route against a ceiling of 400, with the detail ring
     * spending four of its nine calls per chunk on boxes that could share one.
     * The answer to a draw-call ceiling is a rendering fix, not less city.
     */
    // Counted BEFORE the merge, because after it there is one mesh and no
    // categories. See the `census` parameter on addInstanced.
    const massCensus = {
      chunk: rngKey,
      buildingBoxes: bodies.length,
      crowns: crowns.length,
      /**
       * BOXES, NOT PROPS, and the two are named apart on purpose. Since the
       * models landed a prop is 2 to 5 boxes, and the census's numeric fields
       * have to sum to the mesh's instance count (`harness.sceneCensus`), so
       * the number that sums is the box count. The prop count rides beside it
       * as a STRING, which `sceneCensus` skips — a count of props reported
       * under a key that sums as boxes is exactly CONTRACT §9's failure mode,
       * with the right units and a plausible magnitude.
       */
      propBoxes: props.length,
      $props: `${detail ? chunk.props.length : 0} props`,
      patches: patches.length,
    };
    for (let i = 0; i < crowns.length; i++) { bodies.push(crowns[i]); bodySkin.push(crownSkin[i]); }
    for (let i = 0; i < props.length; i++) { bodies.push(props[i]); bodySkin.push(propSkin[i]); }
    for (let i = 0; i < patches.length; i++) {
      bodies.push(patches[i]);
      bodySkin.push({ albedo: [0.055, 0.055, 0.058], roughness: 0.88 });
    }
    /**
     * Shadow casters, bounded to the NEAREST ring, and the bound is arithmetic.
     *
     * The sun's shadow map covers a fixed area around the camera, so a building
     * three hundred metres away is submitted to the depth pass and then falls
     * outside the shadow camera entirely — it costs a draw call and contributes
     * nothing. Measured: the noon route ran 530 draws against 400 while the two
     * midnight routes ran 400, and the whole difference was the depth pass,
     * because at midnight the sun is below the horizon and there is no sun
     * shadow to render.
     *
     * TIGHTENED FROM `ring <= 2` IN SESSION 13, and only after the fix that
     * made the bound bite. `lighting.shadowExtent` is **170 m**, so the shadow
     * camera is a 340 m box centred on the view camera. Ring 1 is the 3x3 of
     * 128 m chunks around the camera's own, and the camera stands somewhere
     * inside the middle one — so ring 1 reaches **at least 128 m and at most
     * 256 m** in every direction and already contains the whole 170 m half-
     * extent. Ring 2 spans 128 to 384 m: a shell whose near edge is inside the
     * box and whose bulk is not, and it is submitting a mesh per chunk for it.
     *
     * Why it only became a cost now: `casts` WAS decided at BUILD time, and
     * until the ring-upgrade fix in `update()` a chunk on a moving route was
     * built once at ring 4 and never rebuilt, so on `highway_speed` NOTHING
     * cast a shadow at all. Making the rebuild correct made 25 chunks start
     * paying for a depth pass most of them are outside. That is a rendering
     * fix owed to the ceiling rather than a ceiling owed to the content
     * (CONTRACT §0 rule 5, and `budget.json` → `$drawCalls_rebaseline`).
     *
     * IT IS NOW A PER-FRAME PROPERTY AND NOT A BUILD DECISION, which is the
     * other half of the same fix. A flag baked at build time can only ever be
     * corrected by a rebuild, and a rebuild that only ever UPGRADES leaves a
     * receding chunk casting to the end of the geometry ring — 121 chunks
     * paying for a 170 m box. `castShadow` is one boolean on one mesh, so
     * `update()` sets it from the ring the chunk is in THIS FRAME and nothing
     * has to be rebuilt in either direction.
     */
    const casts = detail && ring <= CAST_RADIUS;
    /**
     * The near ring, inside the detail ring.
     *
     * Facades, windows and signage are what a building contributes at four
     * hundred metres; a bollard, a lamp post and the join between the asphalt
     * and the kerb are not. Splitting the two is worth 168 potential meshes —
     * measured, from the census in `tools/_draws`-style instrumentation that
     * produced the scene/post breakdown `harness.info()` now reports.
     */
    /**
     * `CITY.nearRadius` and not a literal 2, because `update()` has to make the
     * same decision to know whether a resident chunk is out of date, and a
     * threshold written in two files is the arrangement CONTRACT §9.1 is a list
     * of. It was written twice — as a `2` here and as nothing at all there —
     * and the road surface was missing from 96% of the city for four sessions.
     */
    bytes += addInstanced(
      group, geometries.box, materials.facade, bodies, `${rngKey}:masses`, bodySkin, casts, massCensus
    );

    // Boxes, not planes. A punched opening in masonry has a reveal, and a plane
    // flush with the wall reads as a decal at any angle off normal — which on a
    // street you walk down is most of them. It is also where the city's triangle
    // count comes from: twelve triangles a window against two, on the one
    // element there are tens of thousands of.
    bytes += addInstanced(
      group, geometries.box, materials.window, windows, `${rngKey}:windows`, windowTint, false,
      { chunk: rngKey, windows: windows.length }
    );
    /**
     * SIGNAGE IS MERGED ACROSS CHUNKS, for the reason the ground above is: one
     * instanced mesh a chunk holding one to ten quads is a draw call an
     * in-frustum chunk for 408 instances city-wide. The bytes are counted here,
     * where the chunk owns them; the MESH is `city:signs` and there is one.
     */
    bytes += signQuads.length * BYTES_PER_INSTANCE;

    /**
     * The road surface, on detail chunks only — BUILT AT THE TOP OF
     * `buildChunk` since session 19, because the lamps and props above stand on
     * it and have to be able to ask how high it is. The bytes were counted
     * there; `ground` is the same object, passed in.
     *
     * Beyond the detail ring the global ground plane is what is left, and that
     * is the right trade: a road four hundred metres away is a slightly darker
     * strip on a dark plane, and it was costing one draw call per chunk across
     * a hundred and twenty chunks — the single largest line in the draw budget,
     * for the least visible thing in it.
     */

    // --- landmarks ---------------------------------------------------------
    for (const name of chunk.landmarks) {
      const l = LANDMARKS.find((x) => x.name === name);
      if (l) bytes += buildLandmark(group, l, chunkBounds(cx, cz));
    }

    // --- street lighting ---------------------------------------------------
    const lamps = [];
    if (near) {
      const b = chunkBounds(cx, cz);
      const lampBodies = [];
      const bowls = [];
      // Staggered on the two roads this chunk owns, at a 30 m pitch. Offset by
      // chunk so the pattern does not line up across the whole city.
      for (let i = 0; i < 4; i++) {
        const off = ((cx * 7 + cz * 13) % 10) + i * 30;
        if (off > CITY.chunkSize) continue;
        const a = { x: b.x0 + CITY.roadHalfWidth + 1.3, z: b.z0 + off, axis: 'x', side: 1 };
        const c = { x: b.x0 + off, z: b.z0 + CITY.roadHalfWidth + 1.3, axis: 'z', side: 1 };
        for (const spot of [a, c]) {
          if (spot.x > BLOCK_KEEPOUT.x0 && spot.x < BLOCK_KEEPOUT.x1 &&
              spot.z > BLOCK_KEEPOUT.z0 && spot.z < BLOCK_KEEPOUT.z1) continue;
          /**
           * A lamp on a road the river took is a lamp in the water, and it is
           * a lamp with a 4 000 cd optic pointed at it — the one object in this
           * loop whose mistake would be visible from half a kilometre. Tested
           * with the same predicate the generator refuses buildings and props
           * with, so the three cannot disagree (§9.1).
           */
          if (riverBlocks(spot.x, spot.z, 0.6)) continue;
          const yawJitter = (((spot.x * 31 + spot.z * 17) % 100) / 100 - 0.5) * 1.6;
          const rot = spot.axis === 'x' ? 0 : 90;
          /**
           * THE COLUMN STANDS ON ITS OWN PAVEMENT — session 19. The base was
           * the literal 0 and the mounting height 8.08 was measured from it, so
           * both the column and the optic it carries were referenced to the
           * world origin rather than to the footway. `spot.x` is
           * `roadHalfWidth + 1.3`, which is 1.3 m outside the kerb and firmly on
           * the pavement, so this lifts by `GROUND.pavement` in the streamed
           * city — and by whatever the origin block or a quay actually has,
           * because it is read rather than assumed.
           *
           * 8.08 m is a MOUNTING HEIGHT and mounting heights are measured from
           * the ground the column is planted in, which is why the head moves
           * with the base rather than staying put. The optic's whole
           * illuminance derivation (`LIGHT.streetAverageLux`, §5.9) is stated
           * against that height, so leaving the head at 8.08 absolute while the
           * base rose would have quietly shortened every lamp in the city by
           * `GROUND.pavement` and changed the road's lighting level with it.
           */
          const baseY = worldSurface(ctx, spot.x, spot.z).y;
          lampBodies.push(setMatrix(spot.x, baseY, spot.z, 1, 1, 1, rot + yawJitter));
          const head = spot.axis === 'x'
            ? { x: spot.x - 2.1, z: spot.z }
            : { x: spot.x, z: spot.z - 2.1 };
          bowls.push(setMatrix(head.x, baseY + 8.08, head.z, 1, 1, 1, 0));
          lamps.push({ x: head.x, y: baseY + 8.08, z: head.z, axis: spot.axis, side: spot.side });
        }
      }
      /**
       * THE PROMENADE, WHICH IS NOT A ROAD AND THEREFORE HAD NO LIGHTING.
       * Session 16. The placement is `citygen.promenadeLamps` — the pure
       * generator, on the shared bank lattice — for the same reason the quay
       * wall's stations are: three meshes already take their edge from that
       * curve and a fourth consumer sampling it differently is a lamp standing
       * inside its own parapet. The instancing below is the road's, unchanged.
       */
      if (quayLamps && riverTouchesChunk(cx, cz)) {
        for (const L of promenadeLamps(rootSeed, b.x0, b.x1)) {
          /**
           * ONE CHUNK OWNS EACH LAMP. `promenadeLamps` returns BOTH banks over
           * an x range, and `riverTouchesChunk` is true for every row the
           * ENVELOPE reaches — which for this river is rows −4 and −3 — so
           * without this the two rows each emit both banks and every lamp is
           * built twice, in the same place, with two entries in the pool
           * competing for one slot. Ownership by z is the same rule the rest of
           * this function uses, and `citycheck`'s scene walk is what would have
           * found it: the census counts the instances.
           */
          if (L.z < b.z0 || L.z >= b.z1) continue;
          // The promenade's own surface, not the road's — session 19, same
          // mounting-height argument as the kerbside lamps above. `river.js`
          // answers for the quay, and `worldSurface` is where the two meet.
          const baseY = worldSurface(ctx, L.x, L.z).y;
          lampBodies.push(setMatrix(L.x, baseY, L.z, 1, 1, 1, L.rotDeg));
          bowls.push(setMatrix(L.headX, baseY + 8.08, L.headZ, 1, 1, 1, 0));
          lamps.push({ x: L.headX, y: baseY + 8.08, z: L.headZ, axis: L.axis, side: L.side });
        }
      }
      /**
       * PARK LAMPS AND SITE FLOOD MASTS JOIN THE SAME POOL — session 21.
       *
       * ONE POOL, THREE LUMINAIRES. The columns are already drawn (the
       * `chunk.features` loop above builds them as boxes, at no draw cost); all
       * that is added here is the emitting head and the pool candidate. A
       * second pool would be a second reservation against `CLUSTER.maxLights`
       * and a second set of distance rules, and the pool's whole argument —
       * *"only the lamps near the camera are lit"* — is exactly as true of a
       * park lamp as of a street one.
       *
       * A lamp record now carries its own `candela`, its own aim and its own
       * bowl scale. Before this session all three were literals inside
       * `updateLampPool`, which is fine for one kind of lamp and is CONTRACT
       * §9.1's arrangement the moment there are three.
       */
      for (const f of chunk.features) {
        const baseY = worldSurface(ctx, f.x, f.z).y;
        if (f.kind === 'lamp') {
          bowls.push(setMatrix(f.x, baseY + f.height, f.z, 0.52, 0.52, 0.52, 0));
          lamps.push({
            x: f.x, y: baseY + f.height, z: f.z, axis: 'x', side: 1,
            candela: LIGHT.parkLampCandela,
            /** Post-top: straight down, no lateral tilt, because a park path
             *  has no kerb to throw the pool toward. */
            dir: [0, -1, 0],
          });
        } else if (f.kind === 'flood') {
          const px = f.x;
          const pz = f.z;
          const py = baseY + f.height;
          const dx = f.aimX - px;
          const dz = f.aimZ - pz;
          const dy = -f.height;
          const len = Math.hypot(dx, dy, dz) || 1;
          bowls.push(setMatrix(px, py, pz, 0.66, 0.42, 0.66, 0));
          lamps.push({
            x: px, y: py, z: pz, axis: 'x', side: 1,
            candela: LIGHT.siteFloodCandela,
            radius: LIGHT.siteFloodRadiusM,
            dir: [dx / len, dy / len, dz / len],
          });
        }
      }
      bytes += addInstanced(
        group, geometries.lamp, materials.metal, lampBodies, `${rngKey}:lamps`, null, true,
        { chunk: rngKey, lampColumns: lampBodies.length }
      );
      bytes += addInstanced(
        group, geometries.bowl, materials.lampBowl, bowls, `${rngKey}:bowls`, null, false,
        { chunk: rngKey, lampBowls: bowls.length }
      );
    }

    /**
     * The ground, the buildings and the landmark solids, from the same three
     * sources the geometry came from: `ground.rects` IS the emitted mesh,
     * `masses` is what `buildingTiers` produced, and the landmark boxes are the
     * ones `buildLandmark` drew.
     */
    /**
     * `ground` IS NULL FOR EVERY CHUNK OUTSIDE THE NEAR RING — `buildGround` is
     * only called for those, and a geometry-ring chunk has massing and no road
     * surface. The first version of this walk did not check and quarantined
     * `city` on the first chunk past ring 2, which `faultcheck`'s empty-faults
     * assertion and `citycheck`'s own harness call both caught within a minute
     * of each other. A claim list that is short because the chunk drew no
     * ground is the correct answer, not a missing one.
     */
    for (const q of (ground && ground.rects) || []) {
      placed.push({
        kind: q.kind === 'road' ? 'carriageway'
          : q.kind === 'walk' ? 'pavement'
            : q.kind === 'path' ? 'path' : q.kind === 'site' ? 'site' : 'ground',
        owner: `ground:${q.kind}`, x0: q.x0, x1: q.x1, z0: q.z0, z1: q.z1, y0: 0, y1: 0.05,
      });
    }
    for (const bld of chunk.buildings) {
      /**
       * `y1` IS WHAT THIS CHUNK DREW ON THE ROOF — session 25 — and it was
       * `bld.height`, which is where the wall stops. `deck × building` is the
       * one pair `occupancy.js` decides on the vertical extent, so the claim
       * that answers "does the viaduct pass through this building" stopped at
       * the eaves and the plant above it was outside every test.
       *
       * THE FALLBACK IS `bld.height` AND IT IS REACHED ONLY BY A BUILDING THIS
       * CHUNK DID NOT DRAW A ROOFSCAPE FOR — which is none of them today, since
       * `buildRoofscape` runs on every ring (session 19). Left explicit rather
       * than asserted because a claim that is too SHORT shows up as a missing
       * conflict, which is the direction `claimBox`'s own comment says to fail
       * in.
       *
       * The generator's own claim uses `citygen.buildingTopM`, a BOUND on this
       * same quantity — see there for why the two differ on purpose.
       */
      placed.push({
        kind: 'building', owner: `bld`,
        x0: bld.x - bld.width / 2, x1: bld.x + bld.width / 2,
        z0: bld.z - bld.depth / 2, z1: bld.z + bld.depth / 2,
        y0: 0, y1: deliveredTopByBld.get(bld) || bld.height,
      });
    }
    for (const name of chunk.landmarks) {
      const l = LANDMARKS.find((q) => q.name === name);
      if (!l) continue;
      for (const o of landmarkOccluders(l)) {
        if (o.deck) placed.push({ kind: 'deck', owner: l.name, x0: o.x0, x1: o.x1, z0: o.z0, z1: o.z1, y0: o.base, y1: o.top });
        else if (l.kind !== 'viaduct') placed.push({ kind: 'landmark', owner: l.name, x0: o.x0, x1: o.x1, z0: o.z0, z1: o.z1, y0: 0, y1: o.top });
      }
      if (l.kind === 'viaduct') {
        for (const g of landmarkGroundBlockers(l)) {
          placed.push({ kind: 'landmark', owner: `${l.name}:leg`, x0: g.x0, x1: g.x1, z0: g.z0, z1: g.z1, y0: 0, y1: g.top });
        }
      }
    }
    chunkClaims.set(chunkKey(cx, cz), placed);

    root.add(group);
    builtCount++;
    /**
     * The meshes whose BOUND is a ring rather than a build decision, so
     * `update()` can move them in both directions without a rebuild.
     *
     * `casts` is one boolean on the masses mesh. The street lamps are the same
     * shape of problem one step along: they are `near`-gated, the rebuild in
     * `update()` only ever UPGRADES a chunk, and a chunk that was near keeps
     * what it was given as it recedes — so after the ring-upgrade fix a moving
     * route accumulated lamp and bowl meshes out to the geometry ring, 121
     * chunks paying two draw calls each for a bound that says 25. Visibility is
     * free and a rebuild is not.
     */
    let massMesh = null;
    const nearMeshes = [];
    group.traverse((o) => {
      if (o.name === `${rngKey}:masses`) massMesh = o;
      if (o.name === `${rngKey}:lamps` || o.name === `${rngKey}:bowls`) nearMeshes.push(o);
    });
    return {
      group, bytes, lamps, chunk, ground, massMesh, nearMeshes,
      signs: signQuads.length ? { matrices: signQuads, skin: signTint } : null,
      roofSignFaces,
      roofSignArea,
    };
  }

  /**
   * Windows, and the minority of facades given over to display.
   *
   * One instanced plane per opening, tinted per instance. The rhythm comes from
   * the era — that is the whole point of the era table — and the *lit* fraction
   * comes from the hour, so a night city has a scatter of dark windows in it and
   * a day city has none that read at all.
   */
  /**
   * ONE TIER OF ONE BUILDING'S ELEVATION — session 20.
   *
   * It used to take the whole building, because a building was one box. A
   * setback makes it two or three, and the failure of NOT threading the tier
   * through is precise and ugly: the upper windows would be laid out on the
   * BASE's half-width, i.e. floating one inset clear of the wall they belong to,
   * over the roof of the tier below. That is CONTRACT §9's shape with two
   * half-widths and it is exactly what session 14's buried signage was.
   *
   * `tier` is `{ y0, y1, width, depth }` out of `citygen.buildingTiers()` — the
   * one function that turns a setback description into boxes, so the windows,
   * the masses, the parapets, the roof plant and the signage all ask the same
   * thing where a wall is. `floorBase` is the ABSOLUTE floor index this tier
   * starts at and `floorTotal` the building's own floor count; both exist only
   * so `fracUp` — which drives the display-advertising band — stays a fraction
   * of the BUILDING rather than of the tier. A display band that restarted at
   * every setback would put an advertising panel at three separate heights on
   * one elevation.
   */
  function buildFacade(bld, era, out, tint, masses, massSkin, albedo, roughness,
    tier, floorBase, floorTotal) {
    /** The base tier stands on the street and has a ground floor; the others do not. */
    const plinth = tier.y0 > 0 ? tier.y0 : (era.ground === 'shopfront' ? 5.4 : 4.2);
    const usable = Math.max(0, tier.y1 - plinth);
    if (usable < 2) return;
    /**
     * THE ROW CAP, AND IT IS DERIVED FROM THE HEIGHT DISTRIBUTION RATHER THAN
     * BEING THE LITERAL 34 IT WAS — session 20.
     *
     * 34 was written when the generator's tallest possible building was
     * `rng.range(12, 64)` over the shortest era's 3.05 m storey, i.e. 21
     * storeys: the cap could not bite and it was a safety bound. The log-normal
     * puts p99 at 134 m and clamps at 150, so 34 rows would have left **nine
     * buildings of 432 with blank walls above about 108 m** — on precisely the
     * towers this session added, which are the ones anybody looks at.
     *
     * So it is `maxM / era.floor`, which is the tallest building this generator
     * can produce expressed in THIS era's storeys. The loop below breaks on the
     * tier's own top anyway, so the cap is a bound and not a budget — which is
     * the state it was in before the distribution changed, restored by
     * derivation instead of by a number nobody re-checked.
     */
    const floors = Math.min(
      Math.floor(usable / era.floor) + 1,
      Math.ceil(HEIGHT_DISTRIBUTION.maxM / era.floor)
    );

    const faces = [
      { dir: [0, -1], w: tier.width, off: tier.depth / 2 },
      { dir: [0, 1], w: tier.width, off: tier.depth / 2 },
      { dir: [-1, 0], w: tier.depth, off: tier.width / 2 },
      { dir: [1, 0], w: tier.depth, off: tier.width / 2 },
    ];

    for (let f = 0; f < faces.length; f++) {
      const face = faces[f];
      /**
       * The street elevation and the courtyard elevation behind it.
       *
       * Not the two side faces: buildings in a run touch, so a window on a side
       * face is a window inside the neighbour. The party walls of a perimeter
       * block are blank, which is also what makes a gap in the run read as a gap
       * rather than as a missing building. The rear elevation onto the courtyard
       * is real and gets openings at a lower density, which is what the back of
       * a perimeter block looks like.
       */
      const front =
        (bld.facing === 'z-' && face.dir[1] === -1) || (bld.facing === 'z+' && face.dir[1] === 1) ||
        (bld.facing === 'x-' && face.dir[0] === -1) || (bld.facing === 'x+' && face.dir[0] === 1);
      const rear =
        (bld.facing === 'z-' && face.dir[1] === 1) || (bld.facing === 'z+' && face.dir[1] === -1) ||
        (bld.facing === 'x-' && face.dir[0] === 1) || (bld.facing === 'x+' && face.dir[0] === -1);
      if (!front && !rear) continue;

      const cols = Math.max(1, Math.floor(face.w / (era.rhythm === 'vertical' ? 2.8 : 2.0)));
      const colW = face.w / cols;
      const winW = colW * (era.rhythm === 'band' ? 0.9 : era.rhythm === 'panel' ? 0.95 : 0.55);
      const winH = era.floor * (era.windowWall > 0.4 ? 0.62 : 0.44);

      /**
       * Facade relief — the thing that makes an elevation read as built rather
       * than as printed.
       *
       * A spandrel is the band of solid wall between the head of one window and
       * the sill of the one above, and on a postwar ribbon or a contemporary
       * panel facade it stands proud of the glass line. A mullion is the
       * vertical equivalent on a corporate bay. Both are a box per floor per
       * face, which is cheap in draws (they share the chunk's one box mesh) and
       * is most of the geometry a facade actually has.
       */
      const relief = era.rhythm === 'band' || era.rhythm === 'panel'
        ? 'spandrel' : era.rhythm === 'vertical' ? 'mullion' : null;

      for (let fl = 0; fl < floors; fl++) {
        const y = plinth + fl * era.floor + era.floor * 0.5;
        if (y + winH / 2 > tier.y1 - 0.4) break;

        if (relief === 'spandrel' && masses) {
          const by = y + winH / 2 + (era.floor - winH) / 2;
          if (by < tier.y1 - 0.5) {
            masses.push(setMatrix(
              bld.x + (face.dir[0] ? face.dir[0] * (face.off + 0.11) : 0),
              by,
              bld.z + (face.dir[1] ? face.dir[1] * (face.off + 0.11) : 0),
              face.dir[0] ? 0.22 : face.w * 0.98,
              Math.max(0.3, era.floor - winH - 0.1),
              face.dir[0] ? face.w * 0.98 : 0.22,
              bld.yawDeg
            ));
            massSkin.push({ albedo, roughness: Math.min(1, roughness + 0.04) });
          }
        }

        for (let c = 0; c < cols; c++) {
          // Irregular skips a quarter of the columns and nudges the rest off the
          // line — the era's whole identity, and the reason it does not read as
          // one of the other four with a different colour.
          const h = Math.abs(Math.sin((c * 12.9898 + fl * 78.233 + bld.x * 0.1) * 43758.5453) % 1);
          if (era.rhythm === 'irregular' && h < 0.25) continue;
          // The courtyard elevation is real but plainer: fewer openings, no
          // display facade. Half the windows of the street front.
          if (rear && h < 0.22) continue;

          if (relief === 'mullion' && masses && fl === 0) {
            const mu = -face.w / 2 + colW * c;
            masses.push(setMatrix(
              bld.x + (face.dir[0] ? face.dir[0] * (face.off + 0.13) : mu),
              plinth + (tier.y1 - plinth) / 2,
              bld.z + (face.dir[1] ? face.dir[1] * (face.off + 0.13) : mu),
              face.dir[0] ? 0.26 : 0.34, tier.y1 - plinth, face.dir[0] ? 0.34 : 0.26,
              bld.yawDeg
            ));
            massSkin.push({ albedo, roughness: Math.min(1, roughness + 0.02) });
          }
          const jitter = era.rhythm === 'irregular' ? (h - 0.5) * 0.5 : 0;
          const u = -face.w / 2 + colW * (c + 0.5) + jitter;

          // Set back into the wall rather than laid on it: the box straddles the
          // facade plane so a third of its depth is proud and two thirds are
          // recessed, which is what gives the opening a shadow line at grazing
          // incidence.
          const px = bld.x + (face.dir[0] ? face.dir[0] * (face.off - 0.08) : u);
          const pz = bld.z + (face.dir[1] ? face.dir[1] * (face.off - 0.08) : u);
          const yaw = face.dir[0] ? face.dir[0] * 90 : face.dir[1] > 0 ? 0 : 180;

          out.push(setMatrix(px, y, pz, winW, winH, 0.34, yaw + bld.yawDeg));

          /**
           * THE HEAD BAND, WHICH WAS A SOLID SLAB OVER THE GLASS UNTIL THIS
           * SESSION, AND WHICH WAS TURNED NINETY DEGREES ON HALF THE CITY.
           *
           * What was here was called a reveal — "the surround the pane sits
           * inside, standing slightly proud of the wall and slightly larger
           * than the opening" — and it was ONE BOX `(winW + 0.34) × (winH +
           * 0.34) × 0.16` centred 0.05 m outside the wall. A box larger than
           * the pane in both directions, sitting in front of it, is not a
           * surround. IT IS A LID. Measured off the live instance matrices with
           * `sceneCensus`'s own arithmetic: the pane's outer face stands 0.098 m
           * proud of the wall, the "reveal"'s stands 0.139 m, and the reveal is
           * 0.34 m larger on both axes — so it covered the pane completely, at
           * every angle, on every elevation where it was correctly oriented.
           * **25 880 of 26 501 z-facing panes, 97.7%, could not be seen at
           * all.** Half the city had no windows and eleven sessions of gates
           * did not notice, because no assertion in the project counts a window
           * that reached the frame.
           *
           * ON THE OTHER HALF IT WAS ROTATED TWICE. The scale was written with
           * the axes pre-swapped for an x-facing elevation AND the ±90° yaw was
           * applied on top, so the 0.16 m thickness went ALONG the wall and the
           * (winW + 0.34) went THROUGH it: 24 907 fins, median 2.15 m long and
           * 0.16 m wide, projecting out of every east and west elevation in the
           * city. Thin, high-contrast, sub-pixel at distance — and the leading
           * suspect for the shimmer until the static probe named the resolve
           * instead. The same double rotation was in the ground-floor helper
           * (fascias up to 25.6 m deep) and in the sign quads (every sign on an
           * x-facing wall drawn on its end). All three are fixed above and
           * below; this is CONTRACT §9's shape for the twenty-sixth time, with
           * a rotation in it, and the tell was the same as always — two
           * conventions for one quantity, each correct on its own.
           *
           * WHAT REPLACES IT IS A HEAD BAND AND NOT A FRAME, and the reason is
           * arithmetic rather than taste. A frame is four boxes; there are
           * 51 401 panes resident, so four boxes a pane is 200 000 instances
           * and 2.4 M triangles against a 2 M ceiling. Two boxes is 617 000
           * triangles on top of a measured 0.9–1.35 M and still lands on the
           * ceiling. ONE box it stays, and the one that earns its place is the
           * lintel: it is what casts the shadow line across the glass at a low
           * sun, which is the whole visual job the old comment claimed. The
           * cill below is already a separate box on the eras that have one.
           *
           * It rides in the chunk's one box mesh, so it costs no draw call.
           */
          if (masses) {
            masses.push(setMatrix(
              bld.x + (face.dir[0] ? face.dir[0] * (face.off + 0.05) : u),
              y + winH / 2 + 0.09,
              bld.z + (face.dir[1] ? face.dir[1] * (face.off + 0.05) : u),
              winW + 0.34,
              0.18,
              0.16,
              yaw + bld.yawDeg
            ));
            massSkin.push({ albedo, roughness: Math.min(1, roughness + 0.06) });

            /**
             * A stone sill, on the eras that have punched openings. A ribbon or
             * a curtain-wall panel does not have one and does not get one —
             * which is another axis on which the five eras differ in structure
             * rather than in colour.
             */
            if (era.rhythm === 'grid' || era.rhythm === 'irregular') {
              masses.push(setMatrix(
                bld.x + (face.dir[0] ? face.dir[0] * (face.off + 0.13) : u),
                y - winH / 2 - 0.1,
                bld.z + (face.dir[1] ? face.dir[1] * (face.off + 0.13) : u),
                winW + 0.5,
                0.14,
                0.32,
                yaw + bld.yawDeg
              ));
              massSkin.push({ albedo: [albedo[0] * 1.25, albedo[1] * 1.25, albedo[2] * 1.2], roughness: 0.66 });
            }
          }

          /**
           * How bright this particular window is. Deterministic in its own
           * position, so the same window is lit every time the chunk is
           * rebuilt — a streaming city where the lights change when you turn
           * around is worse than one with no lights at all.
           */
          const lit = Math.abs(Math.sin((c * 3.7 + fl * 9.1 + bld.z * 0.07) * 12345.678) % 1);
          /**
           * A FRACTION OF THE BUILDING, NOT OF THIS TIER. See the note on the
           * signature: `floorBase` is where this tier starts in the building's
           * own floor count, so a stepped tower has ONE display band rather
           * than one per step.
           */
          const fracUp = floorTotal > 1 ? (floorBase + fl) / (floorTotal - 1) : 0;
          const display = bld.displayFacade && front &&
            fracUp >= bld.displayFrom && fracUp <= bld.displayTo;
          const on = display ? 1 : lit > 0.42 ? 1 : lit > 0.3 ? 0.35 : 0.02;
          const base = display
            ? SIGN_CHROMA[(fl + c) % SIGN_CHROMA.length]
            : [1, 0.88, 0.72];
          tint.push({ albedo: [base[0] * on, base[1] * on, base[2] * on], roughness: 0.05 });
        }
      }
    }
  }

  /**
   * The ground floor — the only part of a building the camera is ever level
   * with, and until now the only part with nothing on it.
   *
   * The five eras differ here more than they differ anywhere else, because the
   * ground floor is where a building meets the street and the street is what
   * changed between 1910 and 2049:
   *
   *   shopfront    glazed bays between slender piers, with a fascia over
   *   colonnade    deep piers on a setback, the wall behind in shadow
   *   blankPlinth  a solid base with a service door and nothing else
   *   recessed     the wall set back under a soffit, so the floor above oversails
   *
   * It is also where the triangles are most worth spending. The routes walk at
   * 1.74 m, and a facade that is beautifully modelled from the fourth floor up
   * and blank below it is a facade nobody in the world can see the good part of.
   */
  /**
   * WHAT A ROOF IS MADE OF — session 19, item 11, and the brief's first item in
   * its own order of return.
   *
   * THE PREMISE CORRECTION FIRST, because it changes what the repair is: this
   * city already had a roofscape. Every building over four floors carried two to
   * five plant boxes and a four-box parapet, and over the detail ring that is
   * 1 232 plant boxes and 1 244 parapet boxes — 2 476 in all. A flat roof was
   * never the problem.
   *
   * THEY WERE ALL ONE SHAPE AND ONE COLOUR. Every unit was a rectangular box
   * with a size roll, `w = 2.2 + h·4.5` square-ish, and every one of them was
   * albedo `[0.3, 0.3, 0.31]` at roughness 0.82. §7.2's rule with a roof instead
   * of a vehicle: a COUNT of roof boxes says nothing about whether the roof
   * reads as a roof, and 2 476 identical grey blocks read as noise on top of a
   * box rather than as plant.
   *
   * SO THE REPAIR IS KINDS, AND THE FIVE ARE CHOSEN BY WHAT THEY DO TO A
   * SILHOUETTE AT DISTANCE rather than by what they are:
   *
   *   plantRoom   wide, low, grey       the existing box, kept — it is right
   *   tank        NARROW AND TALL       breaks the horizontal; the one kind that
   *                                     puts a vertical accent on a flat roof
   *   stairHouse  tall, deep, same
   *               material as the wall  reads as part of the building, which is
   *                                     what a stair enclosure is
   *   duct        LONG AND VERY LOW     a horizontal run; galvanised, so it
   *                                     catches a low sun where grey does not
   *   aerial      very thin, very tall  the only sub-pixel-at-distance element,
   *                                     and the one that says "occupied"
   *
   * Aspect ratio is the quantity, not size: `tank` is 0.45 as wide as it is
   * tall and `duct` is 4.2 times as long as it is high, so the two are
   * distinguishable in a 3-pixel silhouette. A size roll cannot do that, which
   * is the whole finding.
   *
   * DETERMINISTIC IN THE BUILDING'S OWN POSITION, unchanged: `Math.sin(...) % 1`
   * on `(bld.x, bld.z)`, so a chunk that streams out and back has the same roof,
   * and no `ctx.rng` stream is consumed (CONTRACT §8.1 — the worker bakes this
   * city without being told what the main thread holds).
   *
   * COSTS NO DRAW CALL. Every box rides in the chunk's one merged box mesh.
   */
  const ROOF_KINDS = [
    /** Wide and low. The existing unit, and still the commonest. */
    { name: 'plantRoom', wide: 1.00, tall: 1.00, deep: 0.85, albedo: [0.30, 0.30, 0.31], rough: 0.82, w: 4 },
    /** Narrow and tall — a water tank on its own legs. Breaks the horizontal. */
    { name: 'tank', wide: 0.45, tall: 2.30, deep: 0.45, albedo: [0.26, 0.215, 0.175], rough: 0.88, w: 3 },
    /** A stair or lift enclosure: the building's own material, carried up. */
    { name: 'stairHouse', wide: 0.72, tall: 1.75, deep: 0.95, albedo: null, rough: null, w: 3 },
    /** A long, low duct run. Galvanised, so a low sun finds it. */
    { name: 'duct', wide: 1.55, tall: 0.34, deep: 0.42, albedo: [0.46, 0.47, 0.475], rough: 0.44, w: 3 },
    /** An aerial. Thin enough to be one pixel at 700 m, which is the point. */
    { name: 'aerial', wide: 0.10, tall: 3.60, deep: 0.10, albedo: [0.42, 0.43, 0.45], rough: 0.5, w: 2 },
  ];
  const ROOF_KIND_TOTAL = ROOF_KINDS.reduce((a, k) => a + k.w, 0);

  /**
   * RETURNS THE HIGHEST POINT IT DREW — session 25.
   *
   * The delivered building claim's `y1` used to be `bld.height`, the top of the
   * wall, so everything this function emits stood outside its own building's
   * claim: measured over the resident ring, 1 436 plant boxes on 357 of 419
   * buildings, the median 16.50 m above and the worst 18.72 m. `deck × building`
   * is the one pair `occupancy.js` decides on the vertical extent, so a viaduct
   * at 18.2–21.9 m could have passed through a roof and nothing would have said
   * so.
   *
   * THE RETURN IS WHAT WAS DRAWN, NOT WHAT COULD BE. `citygen.buildingTopM` is
   * the generator's BOUND on the same quantity and is deliberately looser — the
   * registry records what was tested and the census records what arrived
   * (CONTRACT §9.1). The two are printed against each other at init.
   */
  function buildRoofscape(bld, mat, bodies, bodySkin, tiers) {
    let topY = -Infinity;
    /**
     * A PARAPET ON EVERY TIER'S ROOF — session 20, and it is what makes a
     * setback read at all.
     *
     * A step with no upstand is a change of width and nothing else: from any
     * angle where the lower roof is not visible it is indistinguishable from a
     * building of the narrower width standing behind a shorter one. The upstand
     * is the horizontal line that says *this is a roof*, and putting one on
     * every tier costs four boxes a step, in the mesh that is already drawn.
     *
     * IT RUNS BEFORE THE `floors > 4` GATE, deliberately: a stepped building is
     * over 34 m by construction and therefore always over four floors, but the
     * intermediate roofs belong to the MASSING rather than to the plant, and a
     * future change to the plant gate must not silently take them away.
     */
    const stack = tiers || [{ y0: 0, y1: bld.height, width: bld.width, depth: bld.depth }];
    for (let i = 0; i < stack.length - 1; i++) {
      const t = stack[i];
      for (const [ox, oz, sx, sz] of [
        [0, -t.depth / 2, t.width, PARAPET_T], [0, t.depth / 2, t.width, PARAPET_T],
        [-t.width / 2, 0, PARAPET_T, t.depth], [t.width / 2, 0, PARAPET_T, t.depth],
      ]) {
        bodies.push(setMatrix(
          bld.x + ox, t.y1 + ROOF_PARAPET_M / 2, bld.z + oz,
          sx, ROOF_PARAPET_M, sz, bld.yawDeg
        ));
        bodySkin.push({ albedo: mat.albedo, roughness: mat.roughness });
        topY = Math.max(topY, t.y1 + ROOF_PARAPET_M);
      }
    }

    if (!(bld.floors > 4)) return topY;
    /** The plant and the top parapet stand on the TOP tier, not on the base's plan. */
    const top = stack[stack.length - 1];
    const seed = Math.abs(Math.sin((bld.x * 0.37 + bld.z * 0.11) * 4711.13) % 1);
    const units = 2 + Math.floor(seed * 4);
    for (let u = 0; u < units; u++) {
      const h = Math.abs(Math.sin((bld.x + bld.z + u * 19.7) * 1237.7) % 1);
      /**
       * A SECOND, INDEPENDENT HASH FOR THE KIND. Deriving the kind from `h` —
       * the same number that already sets the size — would tie one to the other,
       * so every tank would be the same size as every other tank and the
       * variation would be one axis wearing two hats. Different multipliers and
       * a different constant make them independent in the only sense that
       * matters here: they do not correlate over the population.
       */
      const kr = Math.abs(Math.sin((bld.x * 0.53 - bld.z * 0.29 + u * 8.31) * 3391.7) % 1) * ROOF_KIND_TOTAL;
      let acc = 0;
      let kind = ROOF_KINDS[0];
      for (const k of ROOF_KINDS) {
        acc += k.w;
        if (kr <= acc) { kind = k; break; }
      }
      /** The base unit the kind's aspect ratios multiply. Unchanged from s4. */
      const base = 2.2 + h * 4.5;
      const w = base * kind.wide;
      const ph = (1.8 + h * 3.4) * kind.tall;
      const d = base * kind.deep;
      /**
       * KEPT INSIDE THE PARAPET. `bld.width - w - 1.5` is the old expression and
       * it used the unit's own width for both axes; a `duct` is 1.55× as wide as
       * it is deep, so using `w` for the depth inset would hang a long duct over
       * the edge of a narrow building. Each axis is inset by its own extent.
       */
      bodies.push(setMatrix(
        bld.x + (h - 0.5) * Math.max(0, top.width - w - 1.5),
        bld.height + ph / 2,
        bld.z + ((u / units) - 0.5) * Math.max(0, top.depth - d - 1.5),
        w, ph, d, bld.yawDeg + (h - 0.5) * 4
      ));
      topY = Math.max(topY, bld.height + ph);
      bodySkin.push({
        albedo: kind.albedo || mat.albedo,
        roughness: kind.rough == null ? mat.roughness : kind.rough,
      });
    }
    /**
     * The top parapet, as four thin boxes. A roof with no upstand reads as a
     * sliced-off box, which is exactly what it is without one.
     *
     * ITS HEIGHT IS `ROOF_PARAPET_M` OUT OF THE PURE GENERATOR AND NOT A
     * LITERAL — session 20. It was 1.05 here and 1.05 again in the `roof` sign
     * mounting forty lines below, under a comment claiming the second was read
     * from the first. It was not: they were two literals, and a roof sign's
     * world height is now part of the chunk's own description (`citygen.js` →
     * `pushRoofSign`), so the number has to be somewhere all three can see it.
     */
    for (const [ox, oz, sx, sz] of [
      [0, -top.depth / 2, top.width, PARAPET_T], [0, top.depth / 2, top.width, PARAPET_T],
      [-top.width / 2, 0, PARAPET_T, top.depth], [top.width / 2, 0, PARAPET_T, top.depth],
    ]) {
      bodies.push(setMatrix(
        bld.x + ox, bld.height + ROOF_PARAPET_M / 2, bld.z + oz,
        sx, ROOF_PARAPET_M, sz, bld.yawDeg
      ));
      bodySkin.push({ albedo: mat.albedo, roughness: mat.roughness });
      topY = Math.max(topY, bld.height + ROOF_PARAPET_M);
    }
    return topY;
  }

  function buildGroundFloor(bld, era, mat, windows, windowTint, masses, massSkin) {
    const front = bld.facing;
    const dir = front[0] === 'x' ? [front[1] === '+' ? 1 : -1, 0] : [0, front[1] === '+' ? 1 : -1];
    const faceW = dir[0] ? bld.depth : bld.width;
    const off = (dir[0] ? bld.width : bld.depth) / 2;
    const yaw = dir[0] ? dir[0] * 90 : dir[1] > 0 ? 0 : 180;
    const plinth = era.ground === 'shopfront' ? 5.4 : 4.2;

    /**
     * `sw` is the extent ALONG the elevation, `sd` the depth into it. THE SCALE
     * IS LOCAL AND `setMatrix` ROTATES IT — see the note at `buildFacade` on
     * what happened when this function swapped the two AND applied the yaw.
     */
    const at = (u, outward, y, sw, sh, sd, extraYaw = 0) =>
      setMatrix(
        bld.x + (dir[0] ? dir[0] * (off + outward) : u),
        y,
        bld.z + (dir[1] ? dir[1] * (off + outward) : u),
        sw, sh, sd,
        yaw + bld.yawDeg + extraYaw
      );

    // The fascia: the band over the shopfronts that a sign is fixed to.
    masses.push(at(0, 0.16, plinth - 0.45, faceW * 0.99, 0.9, 0.3));
    massSkin.push({ albedo: mat.albedo, roughness: Math.min(1, mat.roughness + 0.05) });

    const bays = Math.max(1, Math.round(faceW / 5.2));
    const bayW = faceW / bays;

    /**
     * SESSION 28 — THE FORM IS THE ERA'S AND THE TRADE IS THE STREET'S.
     *
     * `era.ground` still decides the piers, the plinth, the soffit and the
     * fascia; `bld.retail` decides whether the bays are GLAZED AND LIT. Before
     * this they were one field, so a postwar block could not have shops in its
     * sockel and a prewar terrace could not stop having them — and which side
     * of a street was lit was decided by which decade it happened to roll.
     *
     * EVERY TREATMENT CARRIES BOTH VARIANTS, and each is drawn for its own era
     * rather than borrowing the shopfront's (the brief's own test: a colonnade
     * with lit bays behind the piers is correct, a postwar ribbon block wearing
     * prewar shopfront pilasters is not):
     *
     *   shopfront   + retail   tall glazed bays, slender piers, stallriser
     *               − retail   the same piers, the bays infilled solid
     *   colonnade   + retail   the piers UNCHANGED and lit bays set BEHIND them
     *               − retail   piers, and the covered walk dark
     *   blankPlinth + retail   openings PUNCHED in the sockel — narrower than a
     *                          shopfront bay, deeper set, the base returning at
     *                          each side. No pilasters: it is a plinth with
     *                          shops in it, not a shopfront.
     *               − retail   solid base, one service door
     *   recessed    + retail   glazed bays under the soffit
     *               − retail   solid wall under the soffit, one door
     */
    const G = era.ground;
    const lit = !!bld.retail;
    /**
     * Where the glass sits, measured OUTWARD FROM THE ELEVATION — and the datum
     * is named because the first version of this line got it wrong by doubling
     * the recess (CONTRACT §9 rule 7).
     *
     * A colonnade's piers are ALREADY 0.45 to 1.35 m proud of the wall, so
     * "behind the piers" is delivered by the piers standing forward and not by
     * pushing the glass back. The first draft set it to −0.92, which put the
     * shop window 0.92 m INSIDE the building — 1.37 to 2.27 m behind the pier
     * face — and the bays were invisible from the street. Measured on the
     * delivered frame before it shipped.
     *
     * So all three are shallow reveals at the wall plane, and only the depth of
     * the reveal differs by era: a punched sockel opening sits deeper in its
     * own masonry than a slender-piered shopfront does.
     */
    const glassOut = G === 'colonnade' ? -0.10 : G === 'blankPlinth' ? -0.14 : -0.06;
    /** A punched opening in a sockel is narrower than a shopfront's full bay. */
    const glassW = G === 'blankPlinth' ? 0.60 : 0.82;

    for (let i = 0; i < bays; i++) {
      const u = -faceW / 2 + bayW * (i + 0.5);
      const h = Math.abs(Math.sin((bld.x * 0.21 + bld.z * 0.13 + i * 7.7) * 8123.31) % 1);

      // ---- the era's own form, built whether or not anybody trades here ----
      if (G === 'colonnade') {
        // Piers, and a covered walk behind them.
        masses.push(at(-faceW / 2 + bayW * i, 0.9, (plinth - 0.9) / 2, 0.9, plinth - 0.9, 0.9));
        massSkin.push({ albedo: mat.albedo, roughness: mat.roughness });
      } else if (G === 'blankPlinth') {
        // A solid base. One service door per building, not per bay — and only
        // where a shop has not taken that bay.
        if (i === Math.floor(bays / 2) && !lit) {
          masses.push(at(u, 0.1, 1.15, 1.3, 2.3, 0.24));
          massSkin.push({ albedo: [0.09, 0.09, 0.1], roughness: 0.7 });
        }
      } else {
        // shopfront and recessed: slender piers between the bays either way —
        // they are the building's structure, not its shopfittings.
        masses.push(at(-faceW / 2 + bayW * i, 0.12, (plinth - 0.9) / 2, 0.34, plinth - 0.9, 0.42));
        massSkin.push({ albedo: mat.albedo, roughness: mat.roughness });
      }

      if (!lit) {
        /**
         * NO TRADE HERE. `shopfront` and `recessed` get their bays infilled
         * solid rather than left as a hole — a bay with nothing in it is a
         * missing wall, and this city's ground floors are what the routes walk
         * past at 1.74 m. `colonnade` and `blankPlinth` are already solid.
         */
        if (G === 'shopfront' || G === 'recessed') {
          masses.push(at(u, 0.02, (plinth - 1.1) / 2 + 0.55, bayW * 0.86, plinth - 1.7, 0.26));
          massSkin.push({
            albedo: [mat.albedo[0] * 0.86, mat.albedo[1] * 0.86, mat.albedo[2] * 0.86],
            roughness: Math.min(1, mat.roughness + 0.08),
          });
          if (i === Math.floor(bays / 2)) {
            masses.push(at(u, 0.1, 1.15, 1.3, 2.3, 0.24));
            massSkin.push({ albedo: [0.09, 0.09, 0.1], roughness: 0.7 });
          }
        }
        continue;
      }

      // ---- the trade ----
      // Glazed bay. Emissive, because a shopfront at night is the brightest
      // thing at street level and the reason the pavement is lit at all.
      const shutDown = bld.condition === 'neglected' ? h < 0.55 : bld.condition === 'worn' ? h < 0.24 : h < 0.06;
      const glow = shutDown ? 0.01 : 0.55 + h * 0.75;
      windows.push(at(u, glassOut, (plinth - 1.1) / 2 + 0.55, bayW * glassW, plinth - 1.7, 0.3));
      windowTint.push({ albedo: [glow * 1.0, glow * 0.9, glow * 0.76], roughness: 0.05 });

      // A stallriser under the glass — the low solid panel every shopfront has.
      // A punched sockel opening keeps the plinth's own face instead.
      if (G !== 'blankPlinth') {
        masses.push(at(u, 0.1, 0.34, bayW * 0.86, 0.68, 0.28));
        massSkin.push({ albedo: [mat.albedo[0] * 0.7, mat.albedo[1] * 0.7, mat.albedo[2] * 0.7], roughness: 0.62 });
      } else {
        // The sockel returning at each side of the opening, so the base still
        // reads as a base rather than as a ribbon of glass.
        for (const sgn of [-1, 1]) {
          masses.push(at(u + sgn * bayW * 0.4, 0.06, (plinth - 0.9) / 2, bayW * 0.2, plinth - 0.9, 0.3));
          massSkin.push({ albedo: mat.albedo, roughness: mat.roughness });
        }
      }
    }

    if (era.ground === 'recessed') {
      // The soffit the floor above oversails on. A downward-facing surface, and
      // the one the §5.7 field's ground-bounce term exists to light.
      masses.push(at(0, -0.6, plinth + 0.2, faceW * 0.99, 0.4, 1.6));
      massSkin.push({ albedo: mat.albedo, roughness: mat.roughness });
    }
  }

  /**
   * Landmarks, as parametric masses. Silhouette, not detail: what a landmark
   * does for a city it does from four hundred metres away, and at that distance
   * it is a shape against the sky.
   */
  function buildLandmark(group, l, bounds) {
    const albedo = l.material === 'brick' ? [0.164, 0.086, 0.062]
      : l.material === 'steel' ? [0.32, 0.33, 0.35]
      : l.material === 'stucco' ? [0.49, 0.452, 0.39]
      : [0.4, 0.395, 0.378];
    const rough = l.material === 'steel' ? 0.44 : l.material === 'brick' ? 0.9 : 0.74;

    /**
     * ONE CHUNK OWNS EACH PART, DECIDED BY WHERE THE PART IS.
     *
     * `landmarksTouching` says "so a chunk builds its share" and session 4's
     * code built the whole landmark in every chunk the AABB reached. For seven
     * of the eight that is one chunk and the sentence was true by accident. The
     * viaduct's AABB reaches ten, so 480 m of bridge was submitted ten times —
     * ten sets of instances, ten lots of memory, and ten draws where the depth
     * test threw nine of them away. Owning a part by its own position is exact:
     * every box belongs to exactly one chunk, and a box on a boundary belongs to
     * the chunk its centre is in.
     */
    const owns = bounds
      ? (x, z) => x >= bounds.x0 && x < bounds.x1 && z >= bounds.z0 && z < bounds.z1
      : () => true;

    const boxes = [];
    const skin = [];
    /** The steel parts, which need a metallic material rather than an attribute. */
    const steel = [];
    const steelSkin = [];
    const push = (x, y, z, sx, sy, sz, yaw = 0, a = albedo, r = rough) => {
      if (!owns(x, z)) return;
      boxes.push(setMatrix(x, y, z, sx, sy, sz, yaw));
      skin.push({ albedo: a, roughness: r });
    };
    const pushSteel = (x, y, z, sx, sy, sz, yaw = 0, a = [0.56, 0.57, 0.58], r = 0.42) => {
      if (!owns(x, z)) return;
      steel.push(setMatrix(x, y, z, sx, sy, sz, yaw));
      steelSkin.push({ albedo: a, roughness: r });
    };
    /**
     * A RED AVIATION OBSTRUCTION LIGHT — session 19, item 12.
     *
     * `BEACON_M` is the box the radiance is derived over (`LIGHT
     * .aviationRedNits` = I/A), so the two must not drift: the size is the
     * denominator of that constant's arithmetic and changing it here without
     * changing it there is §9 with a length.
     *
     * A PHASE PER LAMP, AND IT IS SPATIAL RATHER THAN RANDOM. The brief asks for
     * slow and asynchronous, and real obstruction lights on one structure flash
     * together while separate structures drift — but a whole ring blinking in
     * unison at 260 m reads as a UI element rather than as infrastructure. The
     * phase is a hash of the lamp's own position, so it is deterministic in the
     * geometry (no `ctx.rng` stream to keep in step across a chunk that streams
     * out and back, CONTRACT §8.1) and no two lamps on one ring share it.
     */
    const beacons = [];
    const beaconPhase = [];
    const BEACON_M = 0.35;
    const pushBeacon = (x, y, z) => {
      if (!owns(x, z)) return;
      beacons.push(setMatrix(x, y, z, BEACON_M, BEACON_M, BEACON_M, 0));
      beaconPhase.push(Math.abs(Math.sin((x * 0.317 + y * 0.113 + z * 0.221) * 4177.7) % 1));
    };
    let bytes = 0;

    /**
     * A surface of revolution, as one mesh.
     *
     * The first version built every round landmark out of stacked axis-aligned
     * boxes, and it was wrong in a way that only looking found: a 58 m inverted
     * cone made of twelve square slabs does not read as a cone, it reads as
     * twelve white shelves flying over the city, because from below you see the
     * underside of every step. Boxes are right for the ziggurat, which really is
     * stepped, and wrong for everything that is round.
     *
     * A lathe is also the cheaper answer here. Landmarks are eight hand-placed
     * structures, not a streamed population — one mesh each is eight draw calls
     * for the most legible objects in the city, and they are frustum-culled like
     * everything else.
     */
    const lathe = (profile, segments, y0 = 0, floodNits = 0, suffix = '') => {
      // A lathe is one mesh, so it cannot be split between chunks: the chunk
      // holding its axis owns it.
      if (!owns(l.x, l.z)) return 0;
      const pts = profile.map((p) => new THREE.Vector2(Math.max(0.01, p[0]), p[1] + y0));
      const geo = track(new THREE.LatheGeometry(pts, segments));
      geo.computeVertexNormals();
      /**
       * DECLARED FOR `windingCensus`, and it is a declaration that can only
       * make this mesh's row WEAKER.
       *
       * The winding gate's normal test compares the authored normal against the
       * triangle's own geometric normal — CONTRACT §9.1's "two statements about
       * the same thing". Here the first statement was COMPUTED FROM the second
       * one line above, so the comparison is a tautology and a green from it is
       * a green nobody earned. Saying so leaves the lathes to be decided by the
       * facing test, which reads the delivered matrices and knows nothing about
       * any attribute.
       */
      geo.userData.noctisNormalsDerived = true;
      const mesh = new THREE.Mesh(geo, materials.facade);
      mesh.position.set(l.x, 0, l.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = true;
      mesh.name = `landmark:${l.name}${suffix}`;
      // The albedo of a non-instanced mesh cannot ride in instanceColor, so it
      // gets its own material clone. Eight of them, once, at init.
      const m = materials.facade.clone();
      m.color.setRGB(albedo[0], albedo[1], albedo[2], THREE.LinearSRGBColorSpace);
      m.roughness = rough;
      /**
       * THE FLOODLIT BAND — session 19, item 12, and it rides on THIS CLONE
       * rather than on a shared emissive material for one reason: the band is
       * still concrete. It reflects the sun at noon exactly as the rest of the
       * shell does, and a material whose diffuse was replaced by an emitter's
       * would be a tower that is black by day and glows at night.
       *
       * The emissive chroma is the shell's OWN ALBEDO, not a lamp's, because
       * this radiance stands for REFLECTED light (`LIGHT.condenserFloodNits` =
       * ρE/π). Giving it a source's chromaticity is what makes a floodlit wall
       * read as a lamp, and it is the same distinction `city.js` already keeps
       * between a stall's awning cloth and its strip light.
       *
       * IT DOES NOT SWITCH OFF AT NOON, and that is a stated limitation rather
       * than an oversight: 2.51 cd/m² against a sunlit concrete shell at tens of
       * thousands of lux is under one part in ten thousand, so the daytime error
       * is smaller than the dither. A photocell would be correct and would cost
       * a per-frame uniform write on a non-instanced material; it is not worth
       * it until something dimmer than the sun needs one.
       */
      if (floodNits > 0) {
        m.emissive.setRGB(albedo[0], albedo[1], albedo[2], THREE.LinearSRGBColorSpace);
        m.emissiveIntensity = floodNits;
      }
      /**
       * RE-PATCHED, BECAUSE `clone()` DOES NOT CARRY THE PATCH.
       *
       * three's `Material.copy` copies the documented property list and stops;
       * `onBeforeCompile` and `customProgramCacheKey` are instance functions and
       * are not on it, so a clone of a patched material compiles to the *stock*
       * shader. Verified rather than assumed:
       * `new MeshStandardMaterial().clone().onBeforeCompile === Material.prototype.onBeforeCompile`.
       *
       * Every round landmark is a lathe, every lathe is one non-instanced mesh,
       * and every one of them took its material this way — so the condenser, the
       * exchange dome, the basin and the civic hall have been drawn since session
       * 4 with no clustered lights, no canyon field and no wetness, which
       * CONTRACT §5.6 and §5.7 both say is what an unpatched material gets. It
       * showed as an inverted cone whose downward-facing skin was as bright as
       * the sunlit pavement under it: no visibility term, no bent normal, stock
       * IBL. These are the most legible objects in the city and four of them
       * were outside the lighting model.
       */
      if (lightsApi) lightsApi.patch(m);
      track(m);
      mesh.material = m;
      group.add(mesh);
      return geo.attributes.position.count * 24;
    };

    switch (l.kind) {
      case 'hyperboloid': {
        /**
         * A hyperboloid of revolution: r(t) = waist + (base−waist)(1−t)² below
         * the waist and waist + (top−waist)t² above it. That is the real
         * generating curve of a natural-draught cooling tower, and it is why one
         * is legible in silhouette from two kilometres — nothing else in a city
         * has a waist.
         */
        const n = 24;
        const prof = [];
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const w = 2 * t - 1;
          const r = l.radiusWaist + (w < 0 ? (l.radiusBase - l.radiusWaist) * w * w : (l.radiusTop - l.radiusWaist) * w * w);
          prof.push([r, l.height * t]);
        }
        /**
         * TWO LATHES, SPLIT AT A PROFILE VERTEX — session 19, item 12.
         *
         * A hyperboloid only reads as CURVED under raking light: lit flat it is
         * a pale trapezoid, which is exactly what the elevated frame delivers
         * (STATE 18 §3.2 measured its shaft at code 5.7–6.7 against a sky at
         * 16.8 — a silhouette). Floodlighting the lower band puts a gradient
         * across the one surface in this city whose whole point is its section.
         *
         * SPLIT AT INDEX 4, WHICH IS A VERTEX BOTH HALVES SHARE, so the two
         * lathes meet on the same ring and there is no seam to see. That is
         * y = height · 4/24 = **43.33 m**, i.e. the bottom sixth — where the
         * shell is widest (r = 46.4 m against 62 m at grade) and where a
         * ground-mounted flood can actually reach. `slice(0, 5)` and
         * `slice(4)` overlap on that vertex deliberately.
         *
         * THE COST IS ONE DRAW CALL, and it is the honest price: the alternative
         * was a height-dependent emissive term in the shared facade shader,
         * which would put a condenser-shaped branch in every material in the
         * city. Landmarks are eight hand-placed structures and one more mesh
         * among them is the cheapest place in this project to spend a draw.
         */
        const split = 4;
        bytes += lathe(prof.slice(0, split + 1), 28, 0, LIGHT.condenserFloodNits, ':flood');
        bytes += lathe(prof.slice(split), 28);
        // The open lattice crown, as a ring of fins.
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          pushSteel(l.x + Math.cos(a) * l.radiusTop, l.height + 5, l.z + Math.sin(a) * l.radiusTop,
            1.1, 10, 2.6, (-a * 180) / Math.PI);
        }
        /**
         * RED AVIATION OBSTRUCTION LIGHTS. ICAO Annex 14 §6.3: intermediate
         * levels at intervals not exceeding 105 m, so a 260 m structure needs
         * `ceil(260 / 105)` = **3** levels — the crown, and two below it at
         * 173.3 m and 86.7 m. Six lamps at the crown and four at each
         * intermediate level, which is the Annex's "spaced so that at least
         * three are visible from any direction" on a shell 70–90 m around.
         *
         * The radius at each level comes from the SAME profile expression the
         * shell is lathed from, so a lamp cannot end up inside or outside the
         * concrete it is bolted to.
         */
        for (const lvl of [{ t: 1, k: 6 }, { t: 173.3 / l.height, k: 4 }, { t: 86.7 / l.height, k: 4 }]) {
          const w = 2 * lvl.t - 1;
          const r = l.radiusWaist +
            (w < 0 ? (l.radiusBase - l.radiusWaist) * w * w : (l.radiusTop - l.radiusWaist) * w * w);
          for (let i = 0; i < lvl.k; i++) {
            const a = (i / lvl.k) * Math.PI * 2 + lvl.t;
            pushBeacon(l.x + Math.cos(a) * (r + 0.4), l.height * lvl.t, l.z + Math.sin(a) * (r + 0.4));
          }
        }
        break;
      }
      case 'ziggurat': {
        // Stepped, so boxes are the truth rather than an approximation of it.
        for (let i = 0; i < l.steps; i++) {
          const hx = l.footprint[0] - i * l.setback * 2;
          const hz = l.footprint[1] - i * l.setback * 2;
          if (hx <= 6 || hz <= 6) break;
          const h = l.height / l.steps;
          push(l.x, h * (i + 0.5), l.z, hx, h, hz, i % 2 ? 0.8 : -0.6);
          // The planted terrace on each setback.
          push(l.x, h * (i + 1) + 0.5, l.z, hx - 1.5, 1.0, hz - 1.5, i % 2 ? 0.8 : -0.6,
            [0.07, 0.11, 0.05], 0.95);
        }
        break;
      }
      case 'arch': {
        /**
         * A parabola of segments, each rotated to its own tangent.
         *
         * The first version pushed a box from the ground up to the curve at each
         * station, which fills the opening in — an arch with no hole in it is a
         * wall. Here each segment is a short chord placed at the curve and
         * pitched along it, so the span underneath is open, which is also what
         * the canyon bake already assumed when it emitted only the two legs.
         */
        const n = 22;
        for (let i = 0; i < n; i++) {
          const u = (i + 0.5) / n;
          const x = (u - 0.5) * l.span;
          const y = l.height * (1 - Math.pow(2 * u - 1, 2));
          // dy/dx of the parabola, for the pitch of this chord.
          const slope = (-4 * l.height * (2 * u - 1)) / l.span;
          const pitch = Math.atan(slope);
          const segLen = (l.span / n) / Math.max(0.35, Math.cos(pitch));
          const t = l.thickness * (0.55 + 0.45 * Math.pow(2 * u - 1, 2));
          const mtx = new THREE.Matrix4().compose(
            new THREE.Vector3(l.x + x, y, l.z),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, pitch)),
            new THREE.Vector3(segLen * 1.06, t, l.thickness * 1.5)
          );
          boxes.push(mtx);
          skin.push({ albedo, roughness: rough });
        }
        // The transit deck the arch carries, on hangers.
        push(l.x, l.height + 3.2, l.z, l.span * 0.92, 1.4, l.thickness * 1.7);
        for (let i = 0; i < 9; i++) {
          const x = (i / 8 - 0.5) * l.span * 0.86;
          const u = x / l.span + 0.5;
          const y = l.height * (1 - Math.pow(2 * u - 1, 2));
          pushSteel(l.x + x, (y + l.height + 3.2) / 2, l.z, 0.4, Math.abs(l.height + 3.2 - y), 0.4);
        }
        break;
      }
      case 'viaduct': {
        /**
         * A BRIDGE, NOT A ROW OF SLABS.
         *
         * Session 4 drew one 2.4 m box per station, two parapets, and a stick
         * every third station. Three things were wrong with it and all three
         * are visible from the pavement:
         *
         *   1. Both parapets were pushed at the same (x, z) with yaws 180°
         *      apart. A box is symmetric under a half turn, so the second call
         *      drew the first one again — coincident, at the deck's centreline,
         *      nowhere near an edge. The deck had no parapets at all.
         *   2. The underside was one flat plane. A flat plane 9.5 m wide with
         *      no relief has nothing for a grazing light to catch and reads as
         *      the back of a card.
         *   3. Piers "every third station" — see `viaductArc`, where the count
         *      that was standing in for a length is written up.
         *
         * What is here is the real section: a slab with cantilevered edges, a
         * box girder under the middle of it, transverse ribs across the
         * cantilever every 5.7 m, and edge parapets standing on the slab. From
         * below that is four planes at three depths, which is what makes an
         * overhead structure read as a structure — and what gives the §5.7
         * ground bounce something to model.
         */
        const arc = viaductArc(l);
        const h = l.height;
        const halfDeck = l.deck / 2;
        /** Slab: top at `height`, so `height` is rail level rather than a mystery datum. */
        const slabTop = h;
        const slabThick = 0.9;
        const slabMid = slabTop - slabThick / 2;
        /** The box girder hanging under the middle of the slab. */
        const boxDepth = 1.9;
        const boxHalf = halfDeck * 0.52;
        const boxMid = slabTop - slabThick - boxDepth / 2;
        const soffitY = slabTop - slabThick - boxDepth;
        /** Weathering: a soffit is never washed and a parapet always is. */
        const soffitAlbedo = [albedo[0] * 0.86, albedo[1] * 0.86, albedo[2] * 0.85];
        const parapetAlbedo = [albedo[0] * 1.1, albedo[1] * 1.1, albedo[2] * 1.09];

        for (let i = 0; i < arc.stations.length - 1; i++) {
          const a = arc.stations[i];
          const b = arc.stations[i + 1];
          const x = (a.x + b.x) / 2;
          const z = (a.z + b.z) / 2;
          const yaw = (-Math.atan2(b.z - a.z, b.x - a.x) * 180) / Math.PI;
          // 1.02 rather than 1.14: the overlap only has to close the polygonal
          // gap on the inside of a 700 m curve, which is millimetres.
          const segLen = Math.hypot(b.x - a.x, b.z - a.z) * 1.02;
          const c = Math.cos((yaw * Math.PI) / -180);
          const s = Math.sin((yaw * Math.PI) / -180);
          /** Offset transverse to the deck, in world XZ. */
          const across = (t) => [x - s * t, z + c * t];

          push(x, slabMid, z, segLen, slabThick, l.deck, yaw);
          push(x, boxMid, z, segLen, boxDepth, boxHalf * 2, yaw, soffitAlbedo, 0.8);

          // Transverse ribs under the cantilevered edges, one every ~5.5 m —
          // the spacing at which a soffit reads as coffered rather than as a
          // sheet. Derived from the chord rather than a fixed count per span,
          // so a change to the station spacing does not silently change the
          // thing the soffit is made of.
          const ribs = Math.max(1, Math.round(arc.chord / 5.5));
          for (let r = 0; r < ribs; r++) {
            const f = (r + 0.5) / ribs - 0.5;
            const rx = x + (b.x - a.x) * f;
            const rz = z + (b.z - a.z) * f;
            push(rx, slabTop - slabThick - 0.3, rz, 0.5, 0.6, l.deck * 0.97, yaw, soffitAlbedo, 0.8);
          }

          // Parapets, at the deck EDGES this time.
          for (const side of [-1, 1]) {
            const [px, pz] = across(side * (halfDeck - 0.25));
            push(px, slabTop + 0.6, pz, segLen, 1.2, 0.4, yaw, parapetAlbedo, 0.7);
          }

          /**
           * THE TRACK. An elevated railway with nothing on its deck is a
           * flyover, and this one has been a flyover since it was placed.
           *
           * Two tracks on a 9.5 m deck at 1.435 m gauge, on a ballast trough,
           * with a walkway outside each running line — which is what the space
           * between the rails and the parapet is for on a real viaduct. The
           * rails are steel and go in the steel bucket, because that is the one
           * property `instanceColor` and `noctisRough` cannot carry.
           */
          for (const track of [-1, 1]) {
            const centre = track * l.deck * 0.235;
            const [bx, bz] = across(centre);
            // Ballast trough: the raised bed the sleepers sit in.
            push(bx, slabTop + 0.22, bz, segLen, 0.44, 3.1, yaw,
              [albedo[0] * 0.62, albedo[1] * 0.6, albedo[2] * 0.56], 0.95);
            for (const rail of [-1, 1]) {
              const [rx, rz] = across(centre + rail * 0.7175);
              pushSteel(rx, slabTop + 0.53, rz, segLen, 0.18, 0.14, yaw);
            }
          }
          // The walkway kerb along each edge, between the running line and the
          // parapet. Also what stops the deck reading as one flat plate on top.
          for (const side of [-1, 1]) {
            const [wx, wz] = across(side * (halfDeck - 1.05));
            push(wx, slabTop + 0.12, wz, segLen, 0.24, 1.0, yaw,
              [albedo[0] * 0.92, albedo[1] * 0.92, albedo[2] * 0.9], 0.86);
          }
        }

        /**
         * Catenary masts, every third bay. An electrified railway carries its
         * contact wire on a mast with a cantilever arm, and from the street they
         * are the vertical rhythm ON the deck that answers the piers under it.
         */
        for (const p of arc.stations) {
          if (!p.pier || p.i % (arc.segsPerBay * 3) !== 0) continue;
          const c = Math.cos((p.yawDeg * Math.PI) / -180);
          const sn = Math.sin((p.yawDeg * Math.PI) / -180);
          const at = (t) => [p.x - sn * t, p.z + c * t];
          const [mx, mz] = at(halfDeck - 0.75);
          pushSteel(mx, slabTop + 3.1, mz, 0.3, 6.2, 0.3, p.yawDeg);
          const [ax, az] = at(halfDeck * 0.15);
          pushSteel(ax, slabTop + 5.9, az, 0.22, 0.22, halfDeck * 1.45, p.yawDeg);
        }

        /**
         * PORTAL FRAMES, NOT COLUMNS — SESSION 21, AND IT IS THE FIX FOR THE
         * FINDING SESSION 5's ARGUMENT COULD NOT REACH.
         *
         * Measured before this session: **8 of 23 piers stood in a carriageway
         * and 2 on a pavement.** Session 5 re-aimed the arc so its piers would
         * stand on ground you can see and reasoned entirely about the origin
         * block's EAST–WEST street; nothing asked what the arc does to the
         * streamed lattice, and a 1.7 m column on a road centreline is a column
         * on a road centreline whichever street it crosses.
         *
         * A column cannot be made to fit a 15.0 m carriageway. The support has
         * to STRADDLE the road, which is what an elevated railway over a street
         * is built as everywhere it exists: two legs outside the kerbs and a
         * crosshead spanning between them. `citygen.viaductPiers` decides where
         * the legs stand — see `LANDMARKS` → viaduct for the offset's
         * derivation and the search that places them — and this draws what it
         * decided. Two legs is a portal; ONE leg is a hammerhead, which two
         * stations need because the deck runs INSIDE the x = 0 corridor there
         * and no portal fits at any offset.
         */
        for (const p of viaductPiers(arc, l)) {
          const capTop = soffitY;
          const capH = 1.1;
          const footH = 0.65;
          const shaftTop = capTop - capH;
          const c = Math.cos((p.yawDeg * Math.PI) / -180);
          const sn = Math.sin((p.yawDeg * Math.PI) / -180);
          /** Transverse offset from the deck centreline, in world XZ. */
          const at = (t) => [p.x - sn * t, p.z + c * t];

          for (const leg of p.legs) {
            push(leg.x, footH / 2, leg.z, 2.6, footH, 2.6, p.yawDeg,
              [albedo[0] * 0.8, albedo[1] * 0.8, albedo[2] * 0.79], 0.86);
            /**
             * A LEG IS SLIMMER THAN THE OLD SHAFT AND THAT IS THE POINT. The
             * single column was 1.90 x 4.42 m because it carried the whole
             * deck; a portal shares the load between two, so each is
             * `pierLegHalf` = 0.80 m across — and a 1.6 m column on a kerb is
             * something you walk past rather than something you walk round.
             */
            push(leg.x, (footH + shaftTop) / 2, leg.z, arc.legHalf * 2, shaftTop - footH, arc.legHalf * 2.2,
              p.yawDeg, [albedo[0] * 0.94, albedo[1] * 0.94, albedo[2] * 0.93], 0.8);
          }

          /**
           * THE CROSSHEAD. It spans from the outermost leg to the deck's far
           * edge, so a portal reads as one beam on two columns and a hammerhead
           * reads as a cantilever off one — which is the honest picture of what
           * is holding the deck up in each case.
           */
          const offs = p.legs.map((leg) => leg.side * leg.offset);
          const lo = Math.min(...offs, -halfDeck);
          const hi = Math.max(...offs, halfDeck);
          const mid = (lo + hi) / 2;
          const [hx, hz] = at(mid);
          push(hx, capTop - capH / 2, hz, 2.2, capH, hi - lo + arc.legHalf * 2, p.yawDeg, soffitAlbedo, 0.8);

          /**
           * Bearings. A deck does not sit on a crosshead, it sits on four pads
           * on a crosshead, and the 0.1 m gap between the two is the one place
           * on this structure where you can see that it is two things rather
           * than one casting. They are directly under the soffit at eye level
           * from the pavement, which is the only reason they are worth four
           * boxes.
           */
          for (const t of [-l.deck * 0.235, l.deck * 0.235]) {
            for (const along of [-0.85, 0.85]) {
              const [bx, bz] = at(t);
              push(
                bx + c * along, capTop + 0.055, bz + sn * along,
                0.7, 0.11, 0.7, p.yawDeg, [0.09, 0.09, 0.1], 0.55
              );
            }
          }
        }

        /**
         * THE ABUTMENTS — session 21, and until now the deck ENDED IN MID-AIR.
         *
         * STATE 19 and 20 both carried the diagnosis *"deck ending inside
         * buildings at z ≈ −229 and +251"*. Measured this session against the
         * actual curve, the deck ends at **(−91.0, −204.2) and (−91.0, +226.2)**
         * and the nearest building to either is **21.0 m and 23.5 m away**. The
         * carried numbers are `l.z ± arcLength/2` = 11 ± 240 — a **straight-line
         * extent in z computed from an ARC LENGTH**, which is CONTRACT §9's
         * table exactly, in a diagnosis rather than in the code. Nothing had to
         * be moved out of the way; what was missing was a thing to terminate on.
         *
         * A portal wall and a wing on each side: a railway on a viaduct comes
         * down to an embankment at an abutment, and an abutment is the one part
         * of the structure that is a WALL rather than a frame — which is what
         * makes it read as an end rather than as a break.
         */
        /**
         * SESSION 23 FINISHED IT, AND THE DEFECT WAS SHARPER THAN "UNBUILT".
         *
         * The abutment above tops out at `soffitY` = 18.20 m, which is exactly
         * the soffit — it is the BEARING the deck sits on, and nothing rose
         * past the deck to close it. Everything from 18.20 to 22.20 m (box
         * girder, slab, ballast, rail, parapet) simply ended, and the only
         * geometry in that band was two 0.40 m parapet returns FLOATING 2.80 m
         * above the abutment. 8.60 m of the deck's 9.50 m width was a
         * cross-section in mid air, which is what the operator was looking at.
         *
         * `citygen.viaductEnds` decides the whole treatment now and this draws
         * what it decided — the arrangement `viaductPiers` already has, and the
         * reason is `viaductArc`'s: three consumers had three curves once. Every
         * dimension is derived there; the two that matter here are that the head
         * tops out at the CATENARY MASTS' own 27.20 m, so the portal adds no new
         * silhouette height, and that the opening is the deck's OWN width, so
         * everything on the deck passes through it by construction.
         *
         * The parapet returns are gone: the portal does their job, and kept they
         * would float inside the opening.
         */
        for (const e of viaductEnds(arc, l)) {
          const c = Math.cos((e.yawDeg * Math.PI) / -180);
          const sn = Math.sin((e.yawDeg * Math.PI) / -180);
          /** Transverse offset from the deck centreline, in world XZ. */
          const at = (t) => [e.x - sn * t, e.z + c * t];
          const abutAlbedo = [albedo[0] * 0.9, albedo[1] * 0.9, albedo[2] * 0.89];

          push(e.x, e.abutTop / 2, e.z, e.abutDepth, e.abutTop, e.abutHalfAcross * 2, e.yawDeg,
            abutAlbedo, 0.84);
          // The wing walls, splayed by the deck's own half-width either side.
          for (const side of [-1, 1]) {
            const [wx, wz] = at(side * e.wingHalfAcross);
            push(wx, e.wingTop / 2, wz, e.wingDepth, e.wingTop, e.wingHalfT * 2, e.yawDeg,
              [albedo[0] * 0.86, albedo[1] * 0.86, albedo[2] * 0.85], 0.86);
          }

          /**
           * THE PORTAL HEAD: two jambs and a lintel, standing on the abutment.
           * A jamb runs the full height so the frame reads as one opening cut
           * through a mass rather than as a lintel resting on two posts.
           */
          for (const side of [-1, 1]) {
            const [jx, jz] = at(side * e.jambCentreAcross);
            push(jx, (e.abutTop + e.headTop) / 2, jz, e.abutDepth, e.headTop - e.abutTop,
              e.jambHalfAcross * 2, e.yawDeg, abutAlbedo, 0.84);
          }
          push(e.x, (e.openTop + e.headTop) / 2, e.z, e.abutDepth, e.headTop - e.openTop,
            e.openHalfAcross * 2, e.yawDeg, abutAlbedo, 0.84);

          /**
           * THE RECESS, AND IT IS THE ONE BOX THAT DOES THE WORK.
           *
           * A frame with nothing in it is a hole to the sky and reads as a gap
           * in a wall. What makes a line appear to CONTINUE is a dark plane set
           * back inside the frame, so the eye reads depth it cannot resolve. Set
           * back by `reveal` = 0.30 m from the inner face, and inset by the same
           * across and at the head, so the jamb and lintel edges catch light and
           * the hole sits behind them.
           *
           * The albedo is 0.10 of the concrete's rather than a black constant:
           * CONTRACT §5 is physical throughout, a real tunnel mouth is a dim
           * surface and not a void, and a true black would be the one thing in
           * this city with no bounce at all. At the night exposure the veil
           * (§5.5) lifts it off zero exactly as it lifts every other unlit wall.
           */
          const [rx, rz] = at(0);
          push(
            rx + c * e.sgn * (e.reveal / 2), (e.abutTop + e.openTop - e.reveal) / 2,
            rz + sn * e.sgn * (e.reveal / 2),
            e.abutDepth - e.reveal, e.openTop - e.reveal - e.abutTop,
            (e.openHalfAcross - e.reveal) * 2, e.yawDeg,
            [albedo[0] * 0.10, albedo[1] * 0.10, albedo[2] * 0.10], 0.95
          );
        }
        break;
      }
      case 'dome': {
        const prof = [];
        prof.push([l.radius, 0]);
        prof.push([l.radius, l.drum]);
        const n = 16;
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          prof.push([l.radius * 0.94 * Math.cos((t * Math.PI) / 2), l.drum + (l.height - l.drum) * Math.sin((t * Math.PI) / 2)]);
        }
        bytes += lathe(prof, 32);
        break;
      }
      case 'basin': {
        // A hole in the ground: a retaining ring and a floor, nothing above grade.
        const prof = [
          [l.radius, 0.4], [l.radius, -0.6],
          [l.radius - 3, -1.2], [l.radius - 3, -l.depth],
          [0.02, -l.depth - 0.4],
        ];
        bytes += lathe(prof, 40);
        break;
      }
      case 'mast': {
        // A tapered lattice: four legs and a bracing pattern, not a solid.
        const legs = 4;
        const n = 18;
        for (let i = 0; i < n; i++) {
          const t0 = i / n;
          const t1 = (i + 1) / n;
          const w0 = (l.baseWidth * (1 - t0 * 0.62)) / 2;
          for (let k = 0; k < legs; k++) {
            const a = (k / legs) * Math.PI * 2 + Math.PI / 4;
            pushSteel(l.x + Math.cos(a) * w0, l.height * (t0 + t1) / 2, l.z + Math.sin(a) * w0,
              0.42, l.height / n, 0.42);
          }
          // One diagonal per bay, alternating, which is what reads as lattice.
          const a = ((i % legs) / legs) * Math.PI * 2 + Math.PI / 4;
          pushSteel(l.x + Math.cos(a) * w0 * 0.7, l.height * (t0 + t1) / 2, l.z + Math.sin(a) * w0 * 0.7,
            w0 * 2, 0.3, 0.3, (i * 47) % 360);
        }
        /**
         * THE BEACON — a 1.2 m steel cube that has stood at the top of a 186 m
         * mast, UNLIT, since session 4. A beacon is the one part of a mast that
         * is not structure, and it was drawn as structure.
         *
         * It keeps its housing and gains the lamp: `ceil(186 / 105)` = **2**
         * levels under ICAO Annex 14 §6.3, so the top and one intermediate at
         * 93 m. One lamp at the apex — the mast is 3.4 m across up there, so a
         * single lamp is visible from every direction — and three at 93 m, where
         * the lattice is `baseWidth·(1 − 0.62·0.5)` = 6.4 m across and one lamp
         * would be hidden behind a leg from two bearings out of four.
         */
        pushSteel(l.x, l.height + 1.4, l.z, 1.2, 1.2, 1.2, 0);
        pushBeacon(l.x, l.height + 2.3, l.z);
        {
          const t = 93 / l.height;
          const w = (l.baseWidth * (1 - t * 0.62)) / 2;
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2 + Math.PI / 4;
            pushBeacon(l.x + Math.cos(a) * (w + 0.35), 93, l.z + Math.sin(a) * (w + 0.35));
          }
        }
        break;
      }
      case 'cone': {
        // An inverted cone: narrow at the base, wide at the top. A civic hall
        // with no windows at all, which is the whole of its character.
        bytes += lathe([
          [l.radiusBase, 0], [l.radiusBase * 1.05, 1.2],
          [l.radiusTop * 0.98, l.height - 2.5], [l.radiusTop, l.height - 1.2],
          [l.radiusTop * 0.9, l.height], [0.02, l.height],
        ], 44);
        break;
      }
      default:
        break;
    }

    bytes += addInstanced(
      group, geometries.box, materials.facade, boxes, `landmark:${l.name}`, skin, true,
      { chunk: `landmark:${l.name}`, landmarkBoxes: boxes.length }
    );
    bytes += addInstanced(
      group, geometries.box, materials.landmarkSteel, steel, `landmark:${l.name}:steel`, steelSkin, true,
      { chunk: `landmark:${l.name}`, landmarkSteelBoxes: steel.length }
    );
    /**
     * THE BEACON MESH, AND IT IS REGISTERED FOR THE FLASH — session 19.
     *
     * One `InstancedMesh` per beacon-bearing landmark, which today is two of the
     * eight (the 260 m condenser and the 186 m mast; nothing else in the world
     * reaches ICAO's 150 m). That is **+1 draw call each**, and only in a frame
     * that already contains the structure.
     *
     * `addInstanced` writes `noctisCensus` from the label, so `sceneCensus`
     * counts these — CONTRACT §9.1's rule that a category has to be labelled
     * where it still exists, rather than after a merge has erased it.
     */
    if (beacons.length) {
      /**
       * A SKIN IS PASSED SO THAT `instanceColor` EXISTS. `addInstanced` only
       * allocates that buffer when there is a per-instance albedo, and the flash
       * is written into it every frame — the same mechanism a traffic signal's
       * lit lens uses (`traffic.js` → `writeSignals`), which is why a lamp on
       * and a lamp off cost one draw call between them rather than two.
       */
      const beaconSkin = beacons.map(() => ({ albedo: [1, 1, 1], roughness: 0.2 }));
      bytes += addInstanced(
        group, geometries.box, materials.beacon, beacons, `landmark:${l.name}:beacons`, beaconSkin, false,
        { chunk: `landmark:${l.name}`, landmarkBeacons: beacons.length }
      );
      const mesh = group.children[group.children.length - 1];
      if (mesh && mesh.isInstancedMesh) {
        beaconMeshes.push({ mesh, phase: beaconPhase.slice() });
      }
    }
    return bytes;
  }


  // -------------------------------------------------------------------------
  // residency

  function wantedChunks(camera) {
    const s = CITY.chunkSize;
    const ccx = Math.floor(camera.position.x / s);
    const ccz = Math.floor(camera.position.z / s);
    const out = [];
    for (let dz = -CITY.geometryRadius; dz <= CITY.geometryRadius; dz++) {
      for (let dx = -CITY.geometryRadius; dx <= CITY.geometryRadius; dx++) {
        const r = Math.max(Math.abs(dx), Math.abs(dz));
        out.push({ cx: ccx + dx, cz: ccz + dz, ring: r, detail: r <= CITY.detailRadius });
      }
    }
    // Nearest first, so a frame that can only afford one chunk builds the one
    // the camera is about to walk into rather than one behind it.
    out.sort((a, b) => a.ring - b.ring);
    return out;
  }

  function unbuild(key) {
    const rec = resident.get(key);
    if (!rec) return;
    chunkClaims.delete(key);
    root.remove(rec.group);
    rec.group.traverse((o) => {
      if (o.isInstancedMesh) {
        // Only the clones. The shared box and plane are disposed at module
        // dispose, and disposing them here would delete the geometry every other
        // chunk in the city is drawing.
        if (o.geometry.getAttribute('noctisRough')) o.geometry.dispose();
        o.dispose();
      }
    });
    // The ground and the signage live in merged city-wide meshes, so losing a
    // chunk that had either means that mesh no longer describes the ring.
    if (rec.ground) groundDirty = true;
    if (rec.signs) signsDirty = true;
    bytesResident -= rec.bytes;
    resident.delete(key);
    evictions++;
  }

  /**
   * Enforce the ceiling. Least-recently-wanted first, and it runs *before*
   * admission rather than after, so the budget is never briefly exceeded — which
   * is the difference between a ceiling and a report.
   */
  function enforceBudget(ctx, canyon) {
    const limit = CITY.memoryBudgetMB * 1048576;
    const fieldBytes = canyon && canyon.fieldBytes ? canyon.fieldBytes() : 0;
    let guard = 0;
    while (bytesResident + fieldBytes > limit && resident.size > 1 && guard++ < 512) {
      let worstKey = null;
      let worstAt = Infinity;
      for (const [key, rec] of resident) {
        if (rec.lastWanted < worstAt) {
          worstAt = rec.lastWanted;
          worstKey = key;
        }
      }
      if (!worstKey) break;
      ctx.warnOnce(
        'city-budget',
        `resident chunk data reached ${((bytesResident + fieldBytes) / 1048576).toFixed(1)} MB ` +
        `against a ${CITY.memoryBudgetMB} MB ceiling — evicting least-recently-wanted chunks`
      );
      unbuild(worstKey);
    }
  }

  /**
   * The active punctual-light set.
   *
   * A pool of fixed size rather than add/remove churn, so the clustered light
   * count is bounded by construction and `CLUSTER.maxLights` can never overflow
   * — CONTRACT §5.6 says overflow drops the furthest and warns, and lookcheck
   * asserts the warning never fires. With a city that has to be true by design
   * and not by luck.
   *
   * The radius is physical, not tuned. One 6800 cd luminaire at 128 m delivers
   * 6800/128² = 0.41 lux, which is within a factor of two of full moonlight —
   * so beyond a chunk a street lamp stops being a light and becomes what it
   * already is in the frame, an emissive bowl.
   */
  function updateLampPool(ctx) {
    const camera = ctx.camera;
    /**
     * CONTRACT §3: a photocell, not a clock. The same signal the origin block's
     * lamps run on, read from the same module, so the city and the block cannot
     * disagree about whether it is dark. Two street-lighting systems switching
     * on at two different times is exactly the kind of thing nobody notices
     * until a frame is captured at the moment between them.
     */
    const lighting = ctx.get('lighting');
    const lampsOn = lighting ? lighting.photocellOn : true;
    if (materials) materials.lampBowl.emissiveIntensity = lampsOn ? LAMP_BOWL.streamedNits : 0.5;

    lampCandidates.length = 0;
    for (const rec of resident.values()) {
      for (const lamp of rec.lamps) {
        const d2 = (lamp.x - camera.position.x) ** 2 + (lamp.z - camera.position.z) ** 2;
        if (d2 > CITY.chunkSize * CITY.chunkSize) continue;
        lampCandidates.push({ lamp, d2 });
      }
    }
    lampCandidates.sort((a, b) => a.d2 - b.d2);

    for (let i = 0; i < lampPool.length; i++) {
      const slot = lampPool[i];
      const cand = lampCandidates[i];
      if (!cand) {
        // Parked below the world with zero intensity rather than removed. A
        // light that comes and goes from the array changes every froxel's index
        // list; one that sits still and goes dark changes nothing.
        slot.beam.intensity = 0;
        slot.spill.intensity = 0;
        continue;
      }
      const l = cand.lamp;
      /**
       * THE LUMINAIRE'S OWN NUMBERS, off the record — session 21. A park lamp
       * is 870 cd at 4.20 m and a site flood is 45 000 cd aimed into a hole;
       * both were `LIGHT.streetlampCandela` at whatever tilt a road wanted
       * until the record started carrying them.
       */
      const candela = l.candela === undefined ? LIGHT.streetlampCandela : l.candela;
      /**
       * THE FALLOFF WINDOW IS SIZED BEFORE THE INTENSITY IS DERIVED THROUGH IT
       * — CONTRACT §9, rows 6b and 20, for the THIRD time.
       *
       * A pool slot is created with `radius: 30`, which is the right window for
       * a street lamp whose pool is 12 m across and the wrong one for anything
       * that throws further. three's `getDistanceAttenuation(d, R, 2)` carries
       * a Frostbite window `(1 − d/R)²`, so a flood mast aiming 27.5 m from a
       * 30 m window delivers `(1 − 0.917)²` = **0.0069 of its intensity** —
       * 45 000 cd arriving as **0.41 lx**, which is why the first site frame
       * showed a crane against the sky and an unlit hole under it.
       *
       * Session 20's searchlight was the same window with the same arithmetic
       * and its repair is the one applied here: size R so the far end of the
       * throw is still inside the window, then derive the intensity through it.
       * `l.radius` is per-luminaire and the default is the street lamp's 30.
       */
      slot.beam.radius = l.radius === undefined ? 30 : l.radius;
      slot.beam.position.set(l.x, l.y, l.z);
      slot.beam.intensity = lampsOn || l.candela === LIGHT.siteFloodCandela ? candela : 0;
      if (l.dir) slot.beam.direction.set(l.dir[0], l.dir[1], l.dir[2]).normalize();
      else slot.beam.direction.set(l.axis === 'x' ? -l.side * 0.3 : 0, -1, l.axis === 'x' ? 0 : -l.side * 0.3).normalize();
      slot.beam.alongAxis.set(l.axis === 'x' ? 0 : 1, 0, l.axis === 'x' ? 1 : 0);
      slot.spill.position.set(l.x, l.y, l.z);
      /** The spill scales with the beam, so a park lamp does not carry a
       *  street lamp's bounce. */
      slot.spill.intensity = lampsOn ? slot.spillCandela * (candela / LIGHT.streetlampCandela) : 0;
    }
  }

  // -------------------------------------------------------------------------

  return {
    name: 'city',
    needs: ['lights', 'canyon', 'block', 'time'],

    init(ctx) {
      rootSeed = String(ctx.config.seed);
      quayLamps = Number(ctx.config.quayLamps ?? 1);
      const lights = ctx.get('lights');
      const block = ctx.get('block');
      const canyon = ctx.get('canyon');

      lightsApi = lights;
      materials = buildMaterials(ctx);
      geometries = buildGeometries();
      ctx.scene.add(root);

      /**
       * The lamp pool. A RESERVATION, not the remainder.
       *
       * Until this session this was `floor((maxLights − blockLights − 8) / 2)`,
       * which is every slot nobody else had claimed. That was correct while
       * nothing else was ever going to claim any — and it silently made the
       * lamp count a function of the cap, so raising the cap from 256 to 384 to
       * make room for headlights would have produced 114 lamps instead of 98
       * and no room for headlights at all. The change would have been invisible
       * in every gate except as sixteen more lamps in the frames.
       *
       * Both terms are now explicit and both are printed at boot beside what
       * they were derived from (CONTRACT §9 rule 4).
       */
      const blockLights = block && block.counts
        ? (block.counts.streetlights || 0) + (block.counts.signs || 0) + (block.counts.shopLights || 0)
        : 52;
      const spare = Math.max(
        0,
        CLUSTER.maxLights - blockLights - CLUSTER.trafficLightReserve - 8
      );
      // Pinned to what the old cap delivered, computed the same way it was
      // computed then, so that raising `maxLights` cannot move a single lamp.
      const legacyPool = Math.floor((CLUSTER.lampPoolLegacyCap - blockLights - 8) / 2);
      const poolLamps = Math.min(legacyPool, Math.floor(spare / 2));
      const beamLumens = luminaireFlux(LIGHT.streetlampCandela, LUMINAIRE);
      const spillCandela = (LIGHT.streetlampSpillFraction * beamLumens) / (4 * Math.PI);

      for (let i = 0; i < poolLamps; i++) {
        const beam = lights.add({
          role: 'lamp',
          position: new THREE.Vector3(0, -1000, 0),
          color: EMITTER_CHROMA.sodium,
          intensity: 0,
          radius: 30,
          type: 'spot',
          direction: new THREE.Vector3(0, -1, 0),
          coneOuter: LUMINAIRE.alongRoadRad,
          coneInner: LUMINAIRE.alongRoadRad - LUMINAIRE.edgeRad,
          sourceRadius: 0.42,
          alongAxis: new THREE.Vector3(1, 0, 0),
          alongScale: 1,
          acrossScale: Math.tan(LUMINAIRE.alongRoadRad) / Math.tan(LUMINAIRE.acrossRoadRad),
          peakAngle: LUMINAIRE.peakAngleRad,
        });
        const spill = lights.add({
          role: 'lamp',
          position: new THREE.Vector3(0, -1000, 0),
          color: EMITTER_CHROMA.sodium,
          intensity: 0,
          radius: 26,
          type: 'point',
          sourceRadius: 0.42,
        });
        lampPool.push({ beam, spill, spillCandela });
      }

      ctx.log(
        `city: ${CITY.chunkSize} m chunks, rings detail ${CITY.detailRadius} / geometry ${CITY.geometryRadius} / ` +
        `field ${CITY.fieldRadius}, ${poolLamps} pooled lamps (${poolLamps * 2} clustered lights of ` +
        `${CLUSTER.maxLights}), ceiling ${CITY.memoryBudgetMB} MB`
      );
      /**
       * The street-furniture spread, and the box count it costs, printed
       * together — §9 rule 4, and the pair matters here because the two are in
       * tension: variation is bought in instances and this is the line that
       * says how many.
       */
      /**
       * THE ROOF ENVELOPE, DERIVED BOTH WAYS AND PRINTED SIDE BY SIDE — session
       * 25, CONTRACT §9 rule 2.
       *
       * `citygen.ROOF_PLANT_MAX_M` is what the GENERATOR claims a building
       * reaches; the number beside it is that same envelope recomputed from
       * THIS file's own `ROOF_KINDS` table, which is what actually gets drawn.
       * They are one number in two files, which is the arrangement
       * `ROOF_PARAPET_M` was in until session 20 — and the failure mode is
       * silent in exactly the wrong direction: add a kind with a taller aspect
       * and the generator's claim quietly stops containing its own roof, so
       * `deck × building` goes back to being decided by a box that is too
       * short. A warning rather than a throw, because a claim that is too short
       * under-reports a conflict and a quarantined `city` module renders no
       * city at all (CONTRACT §2.1).
       */
      {
        const drawn = (1.8 + 3.4) * Math.max(...ROOF_KINDS.map((k) => k.tall));
        ctx.log(
          `city: roof envelope — citygen.ROOF_PLANT_MAX_M ${ROOF_PLANT_MAX_M.toFixed(2)} m claimed, ` +
          `ROOF_KINDS' own worst (1.8+3.4)·${Math.max(...ROOF_KINDS.map((k) => k.tall)).toFixed(2)} = ${drawn.toFixed(2)} m drawn` +
          `${Math.abs(drawn - ROOF_PLANT_MAX_M) < 1e-9 ? ' — agree' : ' — DISAGREE'}`
        );
        if (drawn > ROOF_PLANT_MAX_M + 1e-9) {
          ctx.warnOnce('roofEnvelope',
            `city: ROOF_KINDS can draw ${drawn.toFixed(2)} m of plant against citygen.ROOF_PLANT_MAX_M ` +
            `${ROOF_PLANT_MAX_M.toFixed(2)} — the generator's building claim no longer contains its own roof`);
        }
      }
      {
        const pb = propBoxBudget();
        const kinds = Object.keys(PROP_MODELS).length;
        ctx.log(
          `city: prop models ${kinds} kinds, ${Object.values(PROP_MODELS).reduce((s, v) => s + v.length, 0)} variants, ` +
          `${pb.min}–${pb.max} boxes each — ${pb.parts.join(', ')}`
        );
        ctx.log(
          `city: prop pads derived from those models — ` +
          Object.entries(PROP_HALF_WIDTH).filter(([k]) => k !== 'default')
            .map(([k, v]) => `${k} ${v}`).join(', ') + ' m half-width at scale 1'
        );
      }
      /**
       * The pool reservation, written out in full. CONTRACT §9 rule 4: a number
       * derived from another number is printed beside it, at the moment of
       * derivation. Every one of these was a term in the argument for raising
       * the cap, and none of them was printed anywhere before this session.
       */
      ctx.log(
        `city: light pool ${blockLights} block + ${poolLamps * 2} lamp + ` +
        `${CLUSTER.trafficLightReserve} traffic reserved = ` +
        `${blockLights + poolLamps * 2 + CLUSTER.trafficLightReserve} of ${CLUSTER.maxLights}, ` +
        `margin ${CLUSTER.maxLights - blockLights - poolLamps * 2 - CLUSTER.trafficLightReserve}; ` +
        `lamp pool pinned at ${legacyPool} by the old ${CLUSTER.lampPoolLegacyCap} cap, ` +
        `remainder would have allowed ${Math.floor(spare / 2)}`
      );

      /**
       * CONTRACT §9 rule 4: a derived number is printed beside the number it was
       * derived from. Session 4's pier spacing was a count ("every third
       * station") standing in for a length, and nothing anywhere said what the
       * length came out at — 48 m, against the 34 in the landmark data. One line
       * at boot is the whole cost of never doing that again.
       */
      {
        const v = LANDMARKS.find((x) => x.kind === 'viaduct');
        if (v) {
          const arc = viaductArc(v);
          ctx.log(
            `city: viaduct ${arc.arcLength} m of deck at R ${v.arcRadius} m — ` +
            `${arc.bays} bays × ${arc.pierSpacing.toFixed(2)} m asked ${arc.pierSpacingAsked} m ` +
            `(${viaductPiers(arc, v).length} piers, ${viaductPiers(arc, v).filter((p) => p.hammerhead).length} hammerhead, ${viaductPiers(arc, v).filter((p) => p.nudgeM).length} nudged), ${arc.stations.length - 1} spans × ${arc.chord.toFixed(2)} m chord, ` +
            `sagitta over the block's own depth (38 m) ${(38 * 38 / (2 * v.arcRadius)).toFixed(2)} m ` +
            `against ${(10.5 - v.deck / 2).toFixed(2)} m of freedom in the cross-street corridor`
          );
        }
      }

      /**
       * The analytic default's two parameters, measured off what the generator
       * actually placed rather than authored. Sampled over a 9×9 chunk region so
       * it describes the city and not whichever chunk happens to be first.
       */
      {
        let sum = 0;
        let n = 0;
        for (let cz = -4; cz <= 4; cz++) {
          for (let cx = -4; cx <= 4; cx++) {
            for (const bld of describe(cx, cz).buildings) {
              sum += bld.height;
              n++;
            }
          }
        }
        meanFacadeHeight = n ? sum / n : 26;

        /**
         * CALIBRATED AGAINST THE MEASURED FIELD, NOT AGAINST THE KERB.
         *
         * The default's closed form is the sky view factor at the floor of an
         * infinite canyon, sin(atan(w / (H − y))). Handing it the literal
         * kerb-to-kerb half-width, 11.7 m, gives 0.30 at ground level — but the
         * origin block's *baked* field measures the road at 0.51, because a real
         * street has intersections, gaps between buildings, setbacks and
         * shopfront recesses, and an infinite unbroken canyon has none of them.
         *
         * So the distant city was being lit at sixty percent of what the near
         * city gets, and the whole vista at the end of the street went dark. It
         * moved the dusk frame's mean luminance below its band and flattened it
         * — a look regression with no visible cause, three hundred metres from
         * the code that caused it.
         *
         * Solving sin(atan(w/H)) = roadSkyVis for w gives the EFFECTIVE aperture
         * the real geometry has, which is the number the default should use: the
         * default's whole job is to agree with the bake about the average.
         */
        const measuredVis = canyon && canyon.roadSkyVis ? canyon.roadSkyVis : 0.5;
        const effectiveHalfWidth = meanFacadeHeight * Math.tan(Math.asin(Math.min(0.999, measuredVis)));
        /**
         * THE SECOND MEASUREMENT, WHICH SESSION 4 HAD AND DID NOT USE.
         *
         * Two free parameters were fitted to one number — the roadway's
         * openness — and the closed form was then trusted at every height. It
         * is monotonically rising in height, so at a facade it returned 0.93
         * where the block's own facade probes measure 0.244. Both figures come
         * off the same horizon march at the same points the bake samples, and
         * both are printed here, because a derived number next to the number it
         * was derived from is the whole of CONTRACT §9 rule 4.
         */
        const facadeVis = canyon && canyon.facadeSkyVis ? canyon.facadeSkyVis : 0.25;
        if (canyon && canyon.setFieldDefault) {
          canyon.setFieldDefault(effectiveHalfWidth, meanFacadeHeight, facadeVis);
        }
        const atFacade = Math.sin(Math.atan(effectiveHalfWidth / Math.max(0.35, meanFacadeHeight - 20)));
        ctx.log(
          `city: mean facade height ${meanFacadeHeight.toFixed(1)} m over ${n} buildings; ` +
          `analytic field default calibrated to the block's measured roadway openness ` +
          `${(measuredVis * 100).toFixed(0)}% → effective half-width ${effectiveHalfWidth.toFixed(1)} m ` +
          `(kerb-to-kerb is ${(CITY.roadHalfWidth + CITY.sidewalkWidth).toFixed(1)} m). ` +
          `The same closed form at 20 m of height gives ${(atFacade * 100).toFixed(0)}% where the ` +
          `measured facade openness is ${(facadeVis * 100).toFixed(0)}% — a factor of ` +
          `${(atFacade / Math.max(facadeVis, 1e-3)).toFixed(1)}, which is why the default is now ` +
          `selected by the surface normal rather than by height alone.`
        );
      }

      return {
        get bytes() {
          return bytesResident;
        },
        stats: () => ({
          resident: resident.size,
          built: builtCount,
          evictions,
          bytesMB: +(bytesResident / 1048576).toFixed(2),
          peakMB: +(peakBytes / 1048576).toFixed(2),
          lampsActive: Math.min(lampCandidates.length, lampPool.length),
          lampPool: lampPool.length,
          /**
           * Session 20. Resident roof-sign faces and their total emitting area,
           * so `citycheck` can assert the population and the HUD can show it.
           * A measurement off the delivered chunks, not off the description.
           */
          roofSigns: roofSignCensus(),
        }),
        describe,
        chunkSize: CITY.chunkSize,
        meanFacadeHeight: () => meanFacadeHeight,
        landmarks: () => LANDMARKS,

        /**
         * The placement dataset `citycheck` asserts against.
         *
         * Generated on demand for an arbitrary region rather than read off what
         * happens to be resident, and that is the point: the authored-city
         * criteria are claims about the *generator*, not about the twenty chunks
         * the camera is standing in. A clumping coefficient measured over the
         * resident ring would be measuring the ring.
         */
        /**
         * The occluder boxes of every RESIDENT chunk, plus the origin block's,
         * for the delivered-placement tests. Resident rather than generated:
         * this one is a claim about what is on screen, which is the opposite of
         * `placement()` above and is why it is a second method rather than an
         * argument to that one.
         */
        residentOccluders() {
          const boxes = [];
          for (const rec of resident.values()) {
            if (!rec.chunk || !rec.chunk.occluders) continue;
            for (const o of rec.chunk.occluders) {
              // Buildings only. A landmark's boxes and the river's bridge decks
              // are in the same array — the bake needs all three — and this
              // list answers "is a sign buried in its own BUILDING", which
              // neither of the other two can be.
              if (o.landmark != null || o.river != null) continue;
              boxes.push({ x0: o.x0, x1: o.x1, z0: o.z0, z1: o.z1, top: o.top });
            }
          }
          return boxes;
        },

        /**
         * WHAT A PERSON STANDING AT (x, z) IS STANDING ON.
         *
         * Read off the rectangles `buildGround` ACTUALLY EMITTED for the
         * resident chunks (see `quad`), never recomputed from the corridor
         * arithmetic — so the origin block's keep-out, the bank cut and the
         * bridge crossings are all answered by the clip that decided them.
         *
         * The 3×3 neighbourhood, because a chunk emits the corridors on its own
         * WEST and NORTH edges, so a point one metre west of a road line lies
         * in chunk `cx − 1` and stands on chunk `cx`'s quad. Testing only the
         * containing chunk would report bare earth along every west and north
         * kerb in the city — a 4.2 m band, 128 m long, on every chunk boundary.
         *
         * `known: false` means no near-ring ground has been built here yet
         * (the chunk is outside `CITY.nearRadius`, or is queued). The caller is
         * told rather than handed the earth plane, because a walker dropped
         * 0.05 m and lifted back a frame later reads as a fault in the
         * controller and is a fault in the streaming.
         *
         * Returns the HIGHEST covering rectangle. Where a north–south strip
         * crosses an east–west one they differ by 0.001 m and one of them has
         * to win; the one you would be standing on is the upper.
         */
        surfaceAt(x, z) {
          const r = scanGround(x, z);
          if (r.best) return { y: r.best.y, kind: r.best.kind, known: true };
          return { y: GROUND_Y.earth, kind: 'earth', known: r.anyGround };
        },

        /**
         * THE DELIVERED OCCUPANCY — session 21. Every claim this module put on
         * the ground, from the geometry it emitted rather than from the
         * generator's description of it. Read by `harness.occupancyCensus()`
         * and asserted by `citycheck` against `occupancy.js`'s conflict table.
         */
        placedClaims() {
          const out = [];
          for (const list of chunkClaims.values()) for (const c of list) out.push(c);
          return out;
        },

        /** Resident construction cranes, so `moving.js` can turn their jibs. */
        cranes() {
          const out = [];
          for (const rec of resident.values()) {
            if (!rec.chunk || !rec.chunk.features) continue;
            for (const f of rec.chunk.features) {
              if (f.kind !== 'crane') continue;
              out.push(f);
            }
          }
          return out;
        },

        /**
         * THE ONE WORLD GROUND QUERY. See `worldSurface` in the closure above —
         * it takes `ctx` because it consults `block` and `river`, and the api
         * binds this module's own.
         */
        worldSurfaceAt: (x, z) => worldSurface(ctx, x, z),

        /**
         * The same answer as a bare number, which is what everything standing
         * on a pavement actually wants — a pedestrian, a stall, a bollard, a
         * lamp column, a signal mast. `worldSurfaceAt`'s `kind` and `known` are
         * for the controller, which has to tell "I am on grass" and "the chunk
         * under me has not streamed in yet" apart.
         */
        groundYAt: (x, z) => worldSurface(ctx, x, z).y,

        /**
         * THE WALKABILITY PREDICATE AT A POINT, AND ITS RELATION TO THE MASK
         * `placement()` BUILDS — which is the whole of what makes this
         * defensible rather than a second collision system.
         *
         * `placement()` rasterises the same four rules into a 4 m grid for
         * `citycheck`'s flood fill: buildings, landmark ground blockers, the
         * origin block's own boxes, water — and bridge decks unblock. This
         * evaluates those four rules at one point, because a player standing
         * still needs an answer at 60 Hz and cannot carry a 102 400-cell grid
         * that moves with them.
         *
         * THE TWO ARE NOT IDENTICAL AND THE DIFFERENCE HAS A SIGN. The
         * rasteriser blocks every cell a blocker TOUCHES (`floor`/`ceil`), so
         * it is conservative by up to 4 m; this test is exact. Every cell the
         * mask calls free therefore has a free centre here, and the reverse
         * does not hold. That direction is the safe one — the mask can only
         * ever claim LESS reachable city than there is, which is why the flood
         * fill's "every landmark reachable" remains a statement about the
         * player and not merely about the grid. Printed both ways once, by
         * `tools/walkprobe.mjs`, per CONTRACT §9 rule 2.
         *
         * WHAT IT DOES NOT KNOW ABOUT, said here rather than discovered on
         * foot: props. `citygen.js` scatters bollards, bins and cabinets on the
         * kerb line and `placement()` has never blocked one — the mask is
         * buildings, landmarks, the block and the water. So is this. See
         * STATE.md; the number is 838 props a region.
         */
        walkableAt(x, z, pad = 0) {
          const s = CITY.chunkSize;
          const cx = Math.floor(x / s);
          const cz = Math.floor(z / s);
          for (let jz = cz - 1; jz <= cz + 1; jz++) {
            for (let jx = cx - 1; jx <= cx + 1; jx++) {
              for (const b of describe(jx, jz).buildings) {
                if (
                  x > b.x - b.width / 2 - pad && x < b.x + b.width / 2 + pad &&
                  z > b.z - b.depth / 2 - pad && z < b.z + b.depth / 2 + pad
                ) return { walkable: false, by: 'building' };
              }
            }
          }
          for (const l of LANDMARKS) {
            // The basin is a hole, not a wall: you walk down into it. Same
            // sentence as `placement()`, and the same reason.
            if (l.kind === 'basin') continue;
            for (const o of landmarkGroundBlockers(l)) {
              if (x > o.x0 - pad && x < o.x1 + pad && z > o.z0 - pad && z < o.z1 + pad) {
                return { walkable: false, by: `landmark:${l.name}` };
              }
            }
          }
          const block = ctx.get('block');
          if (block && block.occluders) {
            for (const o of block.occluders) {
              if (x > o.x0 - pad && x < o.x1 + pad && z > o.z0 - pad && z < o.z1 + pad) {
                return { walkable: false, by: 'block' };
              }
            }
          }
          // The river blocks and the bridges unblock, in that order — session
          // 15's claim, and the order is load-bearing here for the same reason
          // it is in `placement()`.
          if (inRiver(x, z, pad) && !onBridgeDeck(rootSeed, x, z)) {
            return { walkable: false, by: 'water' };
          }
          return { walkable: true, by: null };
        },

        placement(region) {
          const [cx0, cx1] = region.cx;
          const [cz0, cz1] = region.cz;
          const chunks = [];
          for (let cz = cz0; cz <= cz1; cz++) {
            for (let cx = cx0; cx <= cx1; cx++) {
              const d = describe(cx, cz);
              chunks.push({
                cx, cz,
                density: +d.density.toFixed(4),
                lowDetail: d.lowDetail,
                kind: d.kind,
                objectCount: d.objectCount,
                roadMaterials: d.roadMaterials,
                buildings: d.buildings.map((b) => ({
                  x: +b.x.toFixed(2), z: +b.z.toFixed(2),
                  height: +b.height.toFixed(2),
                  era: b.era, material: b.material, condition: b.condition,
                  yawDeg: +b.yawDeg.toFixed(4),
                  displayFacade: b.displayFacade,
                })),
                /**
           * `refDeg` IS PART OF THE PLACEMENT AND WAS BEING PROJECTED AWAY.
           * `citycheck`'s alignment check measures a prop's deviation from the
           * axis it is ALIGNED TO, and this map decides what the gate can see:
           * dropping the field left the gate reading a promenade bollard's
           * 11.46° world yaw as 11.46° of deviation, which is the same defect
           * one layer further out. A projection that silently loses a field the
           * consumer needs is §9.1's forwarder-arity problem with an object
           * literal.
           */
          props: d.props.map((p) => ({
            x: +p.x.toFixed(2), z: +p.z.toFixed(2), yawDeg: +p.yawDeg.toFixed(4),
            refDeg: +(p.refDeg || 0).toFixed(4), kind: p.kind,
          })),
                signs: d.signs.map((s) => ({
                  x: +s.x.toFixed(2), y: +s.y.toFixed(2), z: +s.z.toFixed(2),
                  state: s.state, scale: s.scale, yawDeg: +s.yawDeg.toFixed(4),
                  /**
                   * `mount` and `width` are the session-14 spread axes. They
                   * are the GENERATOR'S description and citycheck reads them
                   * only to count the vocabulary — where the sign ENDED UP is
                   * `harness.signPlacement()`, off the delivered matrices,
                   * because `x, z` here is the building's centre and using it
                   * as an elevation is the defect that made this necessary.
                   */
                  mount: s.mount, width: +s.width.toFixed(2), aspect: +s.aspect.toFixed(3),
                })),
                occluders: d.occluders,
              });
            }
          }

          /**
           * The walkable mask, for the landmark reachability check.
           *
           * A 4 m grid over the region: blocked where a building or a landmark
           * footprint stands, walkable everywhere else. Roads run on every chunk
           * boundary and the buildings sit inside the islands, so the road
           * network is what is left over — which is how a real street plan
           * works and why this does not need a separate graph.
           */
          const cell = 4;
          const originX = cx0 * CITY.chunkSize;
          const originZ = cz0 * CITY.chunkSize;
          const width = Math.ceil(((cx1 - cx0 + 1) * CITY.chunkSize) / cell);
          const height = Math.ceil(((cz1 - cz0 + 1) * CITY.chunkSize) / cell);
          const mask = new Uint8Array(width * height);
          const blockRect = (x0, z0, x1, z1) => {
            const i0 = Math.max(0, Math.floor((x0 - originX) / cell));
            const i1 = Math.min(width - 1, Math.ceil((x1 - originX) / cell));
            const j0 = Math.max(0, Math.floor((z0 - originZ) / cell));
            const j1 = Math.min(height - 1, Math.ceil((z1 - originZ) / cell));
            for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) mask[j * width + i] = 1;
          };
          for (const c of chunks) {
            for (const b of describe(c.cx, c.cz).buildings) {
              blockRect(b.x - b.width / 2, b.z - b.depth / 2, b.x + b.width / 2, b.z + b.depth / 2);
            }
          }
          for (const l of LANDMARKS) {
            // The basin is a hole, not a wall: you walk down into it.
            if (l.kind === 'basin') continue;
            /**
             * The landmark's real boxes, not a square of side `footprint`.
             *
             * `landmarkFootprint` returns the viaduct's ARC LENGTH, 480 m, and
             * squaring that around its centre walled off a 480 m block of city
             * containing the start of every route — the flood fill reached one
             * cell out of 67 568 and reported all eight landmarks unreachable.
             * The same confusion as the generator's keep-out had, surviving in a
             * second place because it was written from the same wrong idea about
             * what that function returns. CONTRACT §9, again: one quantity used
             * as though it were another.
             *
             * SESSION 5: and `landmarkOccluders` was still the wrong list, for
             * the same reason one step further out. This asks what blocks a
             * PERSON; that function answers what blocks a ray to the sky. The
             * two coincide for a tower and separate for a bridge, and the
             * viaduct now runs 480 m down the main street at 21 m. See
             * `landmarkGroundBlockers`.
             */
            for (const o of landmarkGroundBlockers(l)) blockRect(o.x0, o.z0, o.x1, o.z1);
          }
          // The origin block is a solid street of buildings the generator did
          // not place; its own occluders are what block it.
          const block = ctx.get('block');
          if (block && block.occluders) {
            for (const o of block.occluders) blockRect(o.x0, o.z0, o.x1, o.z1);
          }

          /**
           * THE RIVER BLOCKS AND THE BRIDGES UNBLOCK, IN THAT ORDER.
           *
           * This is the whole of session 15's walkability claim and it is two
           * loops. The first says a hundred metres of open water is not a
           * pavement; the second says a bridge deck is. Delete the second and
           * `citycheck` reports the condenser unreachable and nothing else,
           * because the condenser is the one landmark the river puts on the far
           * bank — which is why it was put there.
           *
           * PER CELL AND NOT PER RECTANGLE, because the bank is a curve and a
           * bounding rectangle over it would block up to 43 m of dry
           * embankment on each side — the promenade the whole north bank walks
           * on. The mask is 4 m cells over a 1 280 m region, so this is 320
           * columns × the 37 rows the envelope covers, which is 11 840 tests
           * once per gate run.
           *
           * The water is tested with a HALF-CELL pad. A cell whose centre is
           * 1.9 m from the bank is a cell a person cannot stand in, and the
           * flood fill would otherwise walk along a line of half-submerged
           * cells from one bank to the other wherever the river narrows to
           * under 4 m — which it never does, but a mask that is right by
           * arithmetic beats one that is right by the seed.
           */
          const env = riverEnvelope();
          const half = cell / 2;
          const jStart = Math.max(0, Math.floor((env.z0 - originZ) / cell));
          const jEnd = Math.min(height - 1, Math.ceil((env.z1 - originZ) / cell));
          for (let j = jStart; j <= jEnd; j++) {
            const z = originZ + (j + 0.5) * cell;
            for (let i = 0; i < width; i++) {
              const x = originX + (i + 0.5) * cell;
              if (inRiver(x, z, half)) mask[j * width + i] = 1;
            }
          }
          for (let j = jStart; j <= jEnd; j++) {
            const z = originZ + (j + 0.5) * cell;
            for (let i = 0; i < width; i++) {
              const x = originX + (i + 0.5) * cell;
              // No pad here, and the asymmetry is deliberate: padding the water
              // is conservative in the safe direction (fewer walkable cells)
              // and padding the deck would be conservative in the other one.
              if (onBridgeDeck(rootSeed, x, z)) mask[j * width + i] = 0;
            }
          }

          // Where the routes begin, which is where a player begins.
          const startWorldX = 300;
          const startWorldZ = 0;
          const startX = Math.max(0, Math.min(width - 1, Math.round((startWorldX - originX) / cell)));
          const startZ = Math.max(0, Math.min(height - 1, Math.round((startWorldZ - originZ) / cell)));
          mask[startZ * width + startX] = 0;

          return {
            chunkSize: CITY.chunkSize,
            chunks,
            /**
             * The origin block's own boxes, which the generator does not place
             * and `chunks` therefore does not contain.
             *
             * Needed by anything that has to answer "is this surface visible
             * from the gate camera" — deriving a sample rect by projecting a
             * building through the camera is only half the job, and the half
             * that was missing is that ten hand-authored buildings stand between
             * the camera and most of the city. A rect derived without them lands
             * on whatever is in front, and the patch-spread self-check cannot
             * tell, because the thing in front is also a flat wall.
             */
            blockOccluders: block && block.occluders ? block.occluders : [],
            /**
             * "From elevation" means from somewhere you can see the city, which
             * is above it and outside it. 120 m over the middle of a district
             * was neither: the eye sat among 60 m towers and most rays to a
             * landmark grazed a nearer building, so three of eight counted. This
             * is 200 m up at the region's corner, which is the viewpoint an
             * establishing shot would use and the one a player gets from the
             * viaduct or the top of the stack.
             */
            elevatedEye: [430, 200, 470],
            landmarks: LANDMARKS.map((l) => ({
              name: l.name,
              x: l.x, z: l.z,
              height: l.height,
              kind: l.kind,
              footprint: +landmarkFootprint(l).toFixed(1),
              aabb: landmarkAABB(l),
              outsideGeneratorRange: !generatorCanProduce(l),
              occluders: landmarkOccluders(l).length,
            })),
            walkable: {
              cell, width, height, originX, originZ,
              startX, startZ, startWorldX, startWorldZ,
              mask: Array.from(mask),
            },
          };
        },
      };
    },

    update(ctx) {
      frameStamp++;
      // Session 19, item 12. The one clock (CONTRACT §3) — `?paused=1` stops the
      // beacons with everything else. See `updateBeacons`.
      const timeApi = ctx.get('time');
      updateBeacons(timeApi ? timeApi.now : 0);
      const canyon = ctx.get('canyon');
      const wanted = wantedChunks(ctx.camera);
      const wantedKeys = new Set();

      generateQueue.length = 0;
      for (const w of wanted) {
        const key = chunkKey(w.cx, w.cz);
        wantedKeys.add(key);
        const rec = resident.get(key);
        if (rec) {
          rec.lastWanted = frameStamp;
          /**
           * A chunk is rebuilt when what would be built NOW differs from what
           * was built THEN, and there are TWO things that differ by ring rather
           * than one.
           *
           * THE ROAD SURFACE OF THIS CITY HAS NEVER BEEN DRAWN EXCEPT ON THE
           * NINE CHUNKS RESIDENT AT BOOT, and this line is why. It read
           * `if (w.detail && !rec.detail)`, and `rec.detail` is a boolean about
           * ONE of the two ring thresholds `buildChunk` branches on:
           *
           *     detail = ring <= 4    facades, windows, signage, props
           *     near   = detail && ring <= 2    THE CARRIAGEWAY AND PAVEMENT
           *
           * A chunk enters the resident set at ring 5 as massing, is upgraded
           * once when it reaches ring 4, and is NEVER LOOKED AT AGAIN — so a
           * chunk the camera walks into at ring 0 still holds the geometry it
           * was given at ring 4, which has no ground in it. At boot the camera
           * is at the origin, so the 3x3 around it is built at ring <= 2 and has
           * roads; every other chunk in the world, for ever, is bare earth with
           * traffic driving over it.
           *
           * CONTRACT §9's shape for the twenty-seventh time, and this one is a
           * BOOLEAN standing in for a THRESHOLD: `rec.detail` answers "was this
           * built with detail" and was asked "was this built for the ring it is
           * in now". Both are booleans, both are true of the same chunks most of
           * the time, and the difference is 96% of the city's road surface. It
           * was found by adding a green park and being unable to see it, then
           * being unable to see the road beside it either.
           *
           * The fix stores what the chunk was BUILT FOR rather than one fact
           * about it, and compares both. Queued like any other build, so it
           * costs the same budgeted slot rather than a free one.
           */
          const near = w.detail && w.ring <= CITY.nearRadius;
          if ((w.detail && !rec.detail) || (near && !rec.near)) generateQueue.push(w);
          // Both directions, every frame, no rebuild. See `casts` in buildChunk.
          if (rec.massMesh) rec.massMesh.castShadow = w.detail && w.ring <= CAST_RADIUS;
          if (rec.nearMeshes) for (const m of rec.nearMeshes) m.visible = near;
        } else {
          generateQueue.push(w);
        }
      }

      for (const [key, rec] of resident) {
        if (!wantedKeys.has(key)) unbuild(key);
        else rec.lastWanted = frameStamp;
      }

      /**
       * The frame budget. At most `generateBudget` chunks are built per frame —
       * generation is arithmetic over a few dozen buildings and measures well
       * under a millisecond, but forty of them arriving at once is a visible
       * hitch, and forty of them arriving at once is exactly what happens when
       * the camera is teleported by a gate.
       */
      let built = 0;
      for (const w of generateQueue) {
        if (built >= CITY.generateBudget) break;
        const key = chunkKey(w.cx, w.cz);
        const existing = resident.get(key);
        if (existing) unbuild(key);
        const made = buildChunk(ctx, w.cx, w.cz, w.detail, w.ring);
        if (made.ground) groundDirty = true;
        if (made.signs) signsDirty = true;
        resident.set(key, {
          cx: w.cx, cz: w.cz,
          group: made.group,
          ground: made.ground,
          signs: made.signs,
          massMesh: made.massMesh,
          nearMeshes: made.nearMeshes,
          bytes: made.bytes,
          detail: w.detail,
          /** What `buildChunk` decided about the road surface. See above. */
          near: w.detail && w.ring <= CITY.nearRadius,
          /**
           * The chunk's own description, so `residentOccluders()` can answer
           * "what buildings are on screen" from the resident set rather than by
           * re-describing. `describe` caches, so this is a reference and not a
           * copy.
           */
          chunk: made.chunk,
          lamps: made.lamps,
          /** Session 20 — see `roofSignCensus()`. */
          roofSignFaces: made.roofSignFaces,
          roofSignArea: made.roofSignArea,
          lastWanted: frameStamp,
        });
        bytesResident += made.bytes;
        built++;
      }
      if (bytesResident > peakBytes) peakBytes = bytesResident;

      enforceBudget(ctx, canyon);
      // After eviction, so a chunk dropped this frame is out of the mesh too.
      if (groundDirty) rebuildGroundMesh();
      if (signsDirty) rebuildSignMesh();
      reportRoofSigns(ctx);

      // --- the canyon field ring ---
      if (canyon && canyon.requestChunk) {
        const s = CITY.chunkSize;
        const ccx = Math.floor(ctx.camera.position.x / s);
        const ccz = Math.floor(ctx.camera.position.z / s);
        for (let dz = -CITY.fieldRadius; dz <= CITY.fieldRadius; dz++) {
          for (let dx = -CITY.fieldRadius; dx <= CITY.fieldRadius; dx++) {
            const cx = ccx + dx;
            const cz = ccz + dz;
            /**
             * The origin block's occluders go into the bake of any chunk whose
             * march can reach them. Without this the buildings the look gate
             * measures would cast no indirect shadow into the streets around
             * them — the block would sit in a hole of its own making.
             */
            const b = chunkBounds(cx, cz);
            const near =
              b.x1 + CITY.fieldMargin > BLOCK_KEEPOUT.x0 && b.x0 - CITY.fieldMargin < BLOCK_KEEPOUT.x1 &&
              b.z1 + CITY.fieldMargin > BLOCK_KEEPOUT.z0 && b.z0 - CITY.fieldMargin < BLOCK_KEEPOUT.z1;
            const block = ctx.get('block');
            canyon.requestChunk(cx, cz, near && block ? block.occluders : [], frameStamp);
          }
        }
      }

      updateLampPool(ctx);
    },

    dispose(ctx) {
      for (const key of [...resident.keys()]) unbuild(key);
      // The two merged meshes are owned by the module rather than by a chunk,
      // so `unbuild` above cannot reach them.
      for (const m of [groundMesh, signMesh]) {
        if (!m) continue;
        root.remove(m);
        m.geometry.dispose();
        if (m.dispose) m.dispose();
      }
      groundMesh = null;
      signMesh = null;
      ctx.scene.remove(root);
      for (const d of disposables) if (d && d.dispose) d.dispose();
      disposables.length = 0;
      const lights = ctx.get('lights');
      if (lights) for (const slot of lampPool) { lights.remove(slot.beam); lights.remove(slot.spill); }
      lampPool = [];
      described.clear();
      materials = null;
      lightsApi = null;
      geometries = null;
    },
  };
}
