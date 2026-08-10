/**
 * canyon.js — indirect light. CONTRACT §5.7.
 *
 * The gap this closes, in the words of the session that left it: at noon the
 * shadowed half of the road sees only the sky and renders a saturated navy,
 * because nothing carries light from the sunlit facades and pavement around it.
 * It is also why the model *over*-lights that road: with no canyon occlusion
 * the surface sees the whole sky hemisphere rather than the strip between the
 * buildings.
 *
 * Two symptoms, one cause, one structure. src/lib/canyon.js bakes a field of
 * pure geometry — how much sky each point can see, in which direction, and how
 * much of what it cannot see is a wall facing which way. This module owns that
 * bake, and owns turning the current sun into the four facade radiances the
 * shader multiplies the field by.
 *
 * WHY IT IS SPLIT THIS WAY
 *
 * The field never mentions the sun. That is the entire reason it is affordable:
 * the sun moves 0.35° about once a second at the default day length, and a bake
 * that stored radiance would have to be redone on that cadence. What is stored
 * is transfer. Bake once at load, and per sky rebuild the CPU does about forty
 * multiplies to produce five colours. That is the whole per-frame cost of
 * global illumination in this project.
 *
 * It is also why it scales. A chunk's field depends only on the boxes within
 * its own horizon march, so session 3's streaming is "bake on chunk load, bind
 * the chunk's texture" — no global solve, no propagation between chunks, no
 * bake that has to be redone because the time of day changed.
 *
 * WHAT IT IS NOT
 *
 * One bounce, no interreflection between facades, no coloured bleeding from a
 * red sign onto the wall beside it, and no shadowing of one facade by another
 * beyond the analytic canyon term below. Screen-space would give the last two
 * and cost the frame edges; see STATE.md for why that trade went the other way.
 */

import * as THREE from 'three';
import {
  bakeCanyonField,
  probeHorizon,
  horizonClearance,
  sunlitFacadeFraction,
  FACE_AXES,
} from '../lib/canyon.js';
import { skyIrradianceOnPlane } from '../lib/atmosphere.js';
// The lamps' chromaticity, for the facade term below. A sodium street lamp is
// not white and a facade lit by one is not neutral.
import { EMITTER_CHROMA } from '../lib/color.js';
import { CANYON } from '../core/constants.js';
import { CITY, LANDMARKS, landmarkOccluders } from '../lib/citygen.js';

/** Luminance-normalised sodium, so the term adds chroma and not brightness. */
const SODIUM = EMITTER_CHROMA.sodium;

const RECIP_PI = 1 / Math.PI;

/** Bytes one chunk's field occupies in one of the two array textures. */
const SLOT_BYTES = CITY.fieldRes * CITY.fieldRes * CITY.fieldSlices * 4;

export function createCanyon(options = {}) {
  const cfg = { ...CANYON, ...options };

  let field = null;
  /** One horizon profile per carriageway probe. Gates the sun in the ground bounce. */
  let roadProfiles = [];
  let roadSkyVis = 1;
  let facadeSkyVis = 0.5;
  let lastSkyVersion = -1;

  // --- the streamed chunk field, CONTRACT §11 -------------------------------
  //
  // A fixed pool of identically shaped slots in two array textures, plus a small
  // table that says which chunk is in which slot. The pool is preallocated, so
  // the field's memory is bounded by construction — there is no policy here that
  // could have a bug in it and grow without limit.
  //
  // Toroidal addressing: the table is indexed by (chunk coordinate mod slotGrid)
  // rather than by a search, so the shader's lookup is one texture fetch and no
  // branching. It is unambiguous because the resident window is never as wide as
  // the wrap — two chunks that map to the same cell can never both be resident.

  let arrayA = null;
  let arrayB = null;
  let slotTex = null;
  let slotTable = null;
  /** slot index → { cx, cz, key, lastWanted } or null */
  const slots = new Array(CITY.fieldSlots).fill(null);
  const residentByKey = new Map();
  let worker = null;
  let workerBroken = false;
  let nextJobId = 1;
  const inFlight = new Map();
  const queue = [];
  let bakedCount = 0;
  let failedCount = 0;
  let lastBakeMs = 0;

  /**
   * Bakes whose bytes are in `image.data` and whose LAYERS have not all been
   * handed to the driver yet. See `drainUploads` and `CITY.fieldLayersPerFrame`.
   *
   * FIFO, because the order the bakes landed in is the order the chunks were
   * wanted in, and a chunk that has waited longer for its field should not be
   * overtaken by one that has waited less.
   */
  const uploads = [];
  let dripFrames = 0;
  let dripLayersDone = 0;
  let maxConcurrentDrips = 0;
  /**
   * Layers per frame per array. `CITY.fieldLayersPerFrame` unless
   * `?fieldDrip=` overrides it; 0 is the pre-session-10 burst, which is the
   * B arm of the measurement that chose the constant. Read once at init, so a
   * frozen config cannot be half-applied.
   */
  let layersPerFrame = CITY.fieldLayersPerFrame;

  const api = {
    stats: null,
    roadSkyVis: 1,
    facadeSkyVis: 0.5,
    faceRadiance: [],
    groundRadiance: [0, 0, 0],
    enabled: true,
  };

  /**
   * The four facade radiances and the ground radiance, in cd/m², linear.
   *
   * Everything here comes from something measured rather than authored: the
   * illuminances from the atmosphere model, the albedos and the emissive from
   * the materials the block actually placed, and the two openness figures from
   * re-marching the same horizon the field was baked from.
   */
  function computeRadiance(ctx) {
    const sky = ctx.get('sky');
    const time = ctx.get('time');
    const block = ctx.get('block');
    const lights = ctx.get('lights');
    if (!sky || !time || !block || !lights) return;

    const S = block.surfaces;
    const eSun = sky.sunIlluminance;
    const eSky = sky.skyIlluminance;
    const d = time.sun.direction;
    const sunAz = Math.atan2(d.z, d.x);
    const sunEl = time.sun.elevationRad;

    const faceL = [];
    for (const ax of FACE_AXES) {
      const ndl = Math.max(0, d.x * ax[0] + d.y * ax[1] + d.z * ax[2]);
      /**
       * How much of this facade the sun still reaches. Without it the bounce is
       * computed as though every wall were lit to the pavement, and at noon in
       * a deep canyon most of one is not — the building opposite is standing in
       * its light. It is analytic rather than sampled because the field is
       * deliberately blind to the sun, and this is the one place that blindness
       * has to be paid for.
       */
      const lit = sunlitFacadeFraction(
        sunEl,
        sunAz - Math.atan2(ax[2], ax[0]),
        S.canyonWidth,
        S.meanFacadeHeight
      );

      /**
       * The sky this particular orientation sees, not the dome average.
       *
       * A facade's skylight is not half the horizontal figure with a fudge
       * factor on it — at dawn the wall facing the sun sees the amber half of
       * the sky and the wall opposite sees the blue half, and collapsing the
       * dome to one number throws away exactly the difference that keeps a
       * low-sun street from being one colour with a brightness ramp.
       */
      const eFaceSky = skyIrradianceOnPlane(ax[0], ax[1], ax[2], d.x, d.y, d.z);

      /**
       * THE STREET LAMPS, ON THE FACADE — session 19, item 10, and it is the
       * one term in this function that is not natural light.
       *
       * At midnight `eSun` is exactly [0,0,0] (the transmittance integral
       * returns zero for any negative elevation) and `eFaceSky` excludes the
       * urban glow, so before this line the four facade radiances collapsed to
       * `S.facadeEmissive` and NOTHING the city itself emits reached a wall.
       * Ninety-eight lamps threw their pools on the road and the road threw
       * nothing back, because the only path from a lamp to a facade in this
       * renderer was a clustered light within `CLUSTER.far`.
       *
       * `sky.groundLightingLux` IS THE SOURCE, AND IT IS SHARED ON PURPOSE. It
       * is already "lamps on × the maintained road lux" — `lighting.js` sets it
       * on the photocell edge and `sky.js`'s lower hemisphere reads it — so the
       * canyon and the sky LUT cannot disagree about how many lamps are lit. One
       * number, two consumers, which is the arrangement §9.1 asks for wherever
       * two systems describe one state.
       *
       * `CANYON.facadeLampShare` carries the integration of this project's own
       * optic over its own street (0.1002) and the honest statement of what the
       * term is worth: **+8.5% on a facade, +0.118 stops**, against the +2.2
       * stops the night frame is short. Read it before expecting this to have
       * fixed the dark.
       *
       * NOTHING HERE TOUCHES THE BAKE. The field stores transfer; this changes
       * what it is multiplied by, once per sky rebuild, three multiplies and
       * three adds. CONTRACT §5.7's sun-independence survives because the term
       * is not the sun.
       */
      const eLamp = (sky.groundLightingLux || 0) * CANYON.facadeLampShare;
      const L = [0, 0, 0];
      for (let c = 0; c < 3; c++) {
        const e = eSun[c] * ndl * lit + eFaceSky[c] * facadeSkyVis;
        L[c] = S.facadeAlbedo[c] * RECIP_PI * (e + eLamp * SODIUM[c]) + S.facadeEmissive[c];
      }
      faceL.push(L);
    }

    /**
     * The ground. Natural light only: the artificial street lighting already
     * reaches downward-facing surfaces through the sky LUT's lower hemisphere
     * (sky.js, setGroundLighting), and counting it here as well would put it on
     * every soffit twice.
     *
     * SESSION 19 CHECKED THIS RATHER THAN TRUSTING IT, because item 10's brief
     * asked for a lamp term on the ground as well as on the facades and the
     * answer is that one is already here. §9 rule 2 — the same quantity two
     * ways:
     *
     *     sky LUT lower hemisphere  [0.155,0.145,0.125] × 16/π
     *                                              = [0.789, 0.738, 0.637] cd/m²
     *     block.surfaces.groundAlbedo × 16/π       = [0.769, 0.718, 0.637] cd/m²
     *
     * **They agree to 3%.** So the lamp bounce off the road IS in the frame, and
     * a second term here would be the same light counted twice on every soffit,
     * every underside and every downward-facing surface in the city. The facade
     * term above was missing; this one was not.
     */
    /**
     * What fraction of the carriageway the sun actually reaches.
     *
     * Averaged over the probes as a *clearance*, not as a horizon angle. Those
     * are not the same operation and the difference is not subtle: this block
     * has three road probes that are genuinely open — the intersection, and the
     * stretch past the east end of the run — and four that are walled in at
     * 70-77°. Averaging the angles gives 42°, the noon sun at 58° clears it,
     * and the model concludes the whole road is in sunlight while the shadow
     * map is drawing it entirely in shade. Averaging the answers gives 3/7,
     * which is what the street looks like from above.
     */
    let clear = 0;
    for (const p of roadProfiles) clear += horizonClearance(p, sunAz, sunEl);
    clear /= Math.max(roadProfiles.length, 1);
    const cosZ = Math.max(0, d.y);
    const groundL = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const e = eSun[c] * cosZ * clear + eSky[c] * roadSkyVis;
      groundL[c] = S.groundAlbedo[c] * RECIP_PI * e;
    }

    lights.setCanyonLight(faceL, groundL);
    api.faceRadiance = faceL;
    api.groundRadiance = groundL;
  }

  /**
   * The neutral default, written into every slot at allocation.
   *
   * A slot that has been allocated but not yet filled is sampled by the shader
   * on the very next frame, and what it must contain is the same thing an
   * unallocated chunk gets: an open-canyon default, not zeroes. Zeroes in this
   * field mean "sees no sky and is surrounded by nothing", which renders as a
   * black hole in the shape of a chunk.
   */
  function fillNeutral(dst, offset, isSkyBent) {
    const n = CITY.fieldRes * CITY.fieldRes * CITY.fieldSlices;
    for (let i = 0; i < n; i++) {
      const o = offset + i * 4;
      if (isSkyBent) {
        // Bent normal straight up, encoded as (v+1)/2 → 127.5, and full sky.
        dst[o] = 128;
        dst[o + 1] = 255;
        dst[o + 2] = 128;
        dst[o + 3] = 255;
      } else {
        dst[o] = dst[o + 1] = dst[o + 2] = dst[o + 3] = 0;
      }
    }
  }

  function allocateSlotPool(ctx) {
    const total = SLOT_BYTES * CITY.fieldSlots;
    const dataA = new Uint8Array(total);
    const dataB = new Uint8Array(total);
    for (let s = 0; s < CITY.fieldSlots; s++) {
      fillNeutral(dataA, s * SLOT_BYTES, true);
      fillNeutral(dataB, s * SLOT_BYTES, false);
    }

    const mk = (data) => {
      const t = new THREE.DataArrayTexture(
        data, CITY.fieldRes, CITY.fieldRes, CITY.fieldSlices * CITY.fieldSlots
      );
      t.format = THREE.RGBAFormat;
      t.type = THREE.UnsignedByteType;
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.needsUpdate = true;
      return t;
    };
    arrayA = mk(dataA);
    arrayB = mk(dataB);

    slotTable = new Uint8Array(CITY.slotGrid * CITY.slotGrid);
    slotTex = new THREE.DataTexture(slotTable, CITY.slotGrid, CITY.slotGrid, THREE.RedFormat);
    slotTex.minFilter = THREE.NearestFilter;
    slotTex.magFilter = THREE.NearestFilter;
    slotTex.wrapS = slotTex.wrapT = THREE.ClampToEdgeWrapping;
    slotTex.needsUpdate = true;

    const lights = ctx.get('lights');
    if (lights && lights.setChunkField) {
      lights.setChunkField({
        arrayA,
        arrayB,
        slots: slotTex,
        chunkSize: CITY.chunkSize,
        margin: CITY.fieldMargin,
        slices: CITY.fieldSlices,
        height: CITY.fieldHeight,
        slotGrid: CITY.slotGrid,
        slotCount: CITY.fieldSlots,
      });
    }
  }

  /** Wrapped table index for a chunk. Must match the shader's `mod`. */
  function tableIndex(cx, cz) {
    const g = CITY.slotGrid;
    const gx = ((cx % g) + g) % g;
    const gz = ((cz % g) + g) % g;
    return gz * g + gx;
  }

  function setTable(cx, cz, slotOrMinusOne) {
    slotTable[tableIndex(cx, cz)] = slotOrMinusOne + 1;
    slotTex.needsUpdate = true;
  }

  function evictSlot(s) {
    const rec = slots[s];
    if (!rec) return;
    // Only clear the table cell if it still points at this slot. Another chunk
    // may already own the cell through the wrap, and clearing it then would make
    // a live chunk invisible — the kind of bug that looks like a lighting glitch
    // three hundred metres away from the code that caused it.
    if (slotTable[tableIndex(rec.cx, rec.cz)] === s + 1) setTable(rec.cx, rec.cz, -1);
    residentByKey.delete(rec.key);
    slots[s] = null;
  }

  /** Least-recently-wanted slot. Never one whose bake is still in flight. */
  function claimSlot(ctx, cx, cz, key, wantedAt) {
    for (let s = 0; s < slots.length; s++) if (!slots[s]) return s;
    let worst = -1;
    let worstAt = Infinity;
    for (let s = 0; s < slots.length; s++) {
      const rec = slots[s];
      if (rec.pending) continue;
      if (rec.lastWanted < worstAt) {
        worstAt = rec.lastWanted;
        worst = s;
      }
    }
    if (worst < 0) {
      ctx.warnOnce('canyon-slots-full', 'every field slot has a bake in flight — request dropped');
      return -1;
    }
    evictSlot(worst);
    return worst;
  }

  function pump(ctx) {
    while (inFlight.size < CITY.bakeConcurrency && queue.length) {
      const job = queue.shift();
      const rec = residentByKey.get(job.key);
      if (!rec || !rec.pending) continue;
      const jobId = nextJobId++;
      inFlight.set(jobId, job);
      rec.jobId = jobId;
      worker.postMessage({
        type: 'bake',
        jobId,
        rootSeed: String(ctx.config.seed),
        cx: job.cx,
        cz: job.cz,
        extraOccluders: job.extraOccluders,
      });
    }
  }

  function onBaked(ctx, msg) {
    inFlight.delete(msg.jobId);
    const key = `${msg.cx},${msg.cz}`;
    const rec = residentByKey.get(key);
    // The chunk may have been evicted while its bake was in the air. Dropping
    // the result is correct; writing it would corrupt whichever chunk now owns
    // the slot.
    if (!rec || rec.jobId !== msg.jobId) return;

    const offset = rec.slot * SLOT_BYTES;
    arrayA.image.data.set(msg.skyBent, offset);
    arrayB.image.data.set(msg.faces, offset);

    /**
     * THE LAYERS ARE QUEUED, NOT FLAGGED — session 10, and the whole of the
     * `night_rain` fix.
     *
     * Per-layer upload is still the point: without it every chunk arrival
     * would re-upload the whole pool, 20 MB across the bus for 0.67 MB of new
     * data. What changed is that flagging all `fieldSlices` layers of both
     * arrays here asked ONE frame for 56 `texSubImage3D` calls, and session
     * 9d measured the driver's conserved once-per-frame stall costing ~9.2 ms
     * when it caught that burst against ~0.01–0.04 ms on the fast path.
     * `drainUploads` hands them over `CITY.fieldLayersPerFrame` at a time.
     *
     * `rec.pending` STAYS TRUE until the last layer lands, which is what
     * makes this safe rather than merely later: `claimSlot` refuses to evict
     * a pending slot and `releaseChunk` refuses to drop one, so nothing can
     * take the slot out from under a half-uploaded field. It also keeps
     * `requestChunk` and `hasChunk` honest — the field is not ready, and
     * saying so is what routes the chunk to the analytic default meanwhile.
     */
    if (layersPerFrame > 0) {
      uploads.push({ slot: rec.slot, key, jobId: msg.jobId, cx: msg.cx, cz: msg.cz, next: 0 });
      if (uploads.length > maxConcurrentDrips) maxConcurrentDrips = uploads.length;
    } else {
      /**
       * `?fieldDrip=0` — the burst, kept as a live arm rather than as a copy
       * of this file. It is the behaviour every session up to 9d shipped and
       * the B side of the measurement in STATE.md, and it is four lines: flag
       * every layer of both arrays now, flip the table now.
       */
      const base = rec.slot * CITY.fieldSlices;
      for (let l = 0; l < CITY.fieldSlices; l++) {
        arrayA.addLayerUpdate(base + l);
        arrayB.addLayerUpdate(base + l);
      }
      arrayA.needsUpdate = true;
      arrayB.needsUpdate = true;
      rec.pending = false;
      setTable(msg.cx, msg.cz, rec.slot);
      bakedCount++;
      dripFrames++;
      dripLayersDone += CITY.fieldSlices;
    }
    lastBakeMs = msg.bakeMs;
    pump(ctx);
  }

  /**
   * Hand the driver `CITY.fieldLayersPerFrame` layers of each array, and flip
   * the slot table for any chunk whose last layer went with them.
   *
   * `needsUpdate` IS SET ONLY WHEN A LAYER WAS ACTUALLY QUEUED, and that is not
   * bookkeeping. three's `WebGLTextures` uploads the layers in `layerUpdates`
   * when the set is non-empty and **the whole texture** when it is empty, so a
   * `needsUpdate = true` on an empty queue would upload 20.1 MB of array
   * texture — the exact cost this whole structure exists to avoid, arriving on
   * every frame instead of on chunk arrival. It is the CONTRACT §9 shape one
   * flag over: a signal that means "I changed some layers" used as though it
   * meant "I changed something".
   */
  function drainUploads() {
    if (!uploads.length || !arrayA || !arrayB) return;
    /**
     * THE BUDGET IS GLOBAL, NOT PER CHUNK, and that is the property being
     * bought. Twenty-five chunks arriving inside a cold start would otherwise
     * ask for 25 × 2N calls in one frame, which is the burst this replaces
     * wearing a smaller number. A global budget makes the per-frame call count
     * exactly 2N whatever the backlog is, and pays for it in latency: a chunk
     * behind k others waits (k+1)·ceil(slices/N) frames rather than
     * ceil(slices/N). Measured on a cold start, that backlog reaches 8 (see
     * `CITY.fieldLayersPerFrame`), so the latency is real and bounded and the
     * call count is the thing held flat.
     */
    let budget = layersPerFrame;
    let queued = 0;
    while (budget > 0 && uploads.length) {
      const u = uploads[0];
      const rec = residentByKey.get(u.key);
      // The chunk cannot have been evicted while pending, so this is a guard
      // rather than a path. If it ever fires, dropping the remaining layers is
      // right: writing them would upload one chunk's field into whatever now
      // owns the slot.
      if (!rec || rec.jobId !== u.jobId || rec.slot !== u.slot) {
        uploads.shift();
        continue;
      }
      const base = u.slot * CITY.fieldSlices;
      while (budget > 0 && u.next < CITY.fieldSlices) {
        arrayA.addLayerUpdate(base + u.next);
        arrayB.addLayerUpdate(base + u.next);
        u.next++;
        budget--;
        queued++;
      }
      if (u.next >= CITY.fieldSlices) {
        uploads.shift();
        rec.pending = false;
        setTable(u.cx, u.cz, u.slot);
        bakedCount++;
      }
    }
    if (queued) {
      arrayA.needsUpdate = true;
      arrayB.needsUpdate = true;
      dripFrames++;
      dripLayersDone += queued;
    }
  }

  function onBakeFailed(ctx, msg) {
    inFlight.delete(msg.jobId);
    const key = `${msg.cx},${msg.cz}`;
    const rec = residentByKey.get(key);
    if (rec && rec.jobId === msg.jobId) {
      // Give the slot back. The chunk renders with the analytic default, which
      // is what it was already rendering with — CONTRACT §11.
      evictSlot(rec.slot);
    }
    failedCount++;
    ctx.warnOnce(`canyon-bake-failed`, `chunk bake failed at ${msg.cx},${msg.cz}: ${msg.message}`);
    pump(ctx);
  }

  return {
    name: 'canyon',
    needs: ['lights', 'block', 'sky', 'time'],

    init(ctx) {
      const block = ctx.get('block');
      const lights = ctx.get('lights');

      if (!block.occluders || !block.occluders.length) {
        // Not a quarantine-worthy failure, but it is worth saying out loud: an
        // empty occluder list bakes a field that says "open field everywhere",
        // which renders exactly like session 1 and looks like the field not
        // working rather than like the field having nothing to work with.
        ctx.warnOnce('canyon-empty', 'no occluders — the canyon field will describe an open plain');
      }

      const m = cfg.margin;
      const ext = block.extent;
      const bounds = {
        min: [ext.min[0] - m, 0, ext.min[1] - m],
        max: [ext.max[0] + m, cfg.height, ext.max[1] + m],
      };

      /**
       * The block's field bakes against the block AND anything standing in it.
       *
       * Until session 5 nothing but `block.occluders` went in, and for three
       * sessions that was every solid inside the bake bounds. It stopped being
       * true when the viaduct was routed down the main street: 480 m of deck at
       * 21 m over the block's own carriageway, and the field said the road was
       * as open to the sky as it had ever been. The sun shadow map darkened the
       * road under it and the indirect term did not, which is the signature of a
       * bridge that casts a shadow and no shade.
       */
      const landmarkBoxes = [];
      for (const lm of LANDMARKS) {
        for (const o of landmarkOccluders(lm)) {
          if (o.x1 < bounds.min[0] || o.x0 > bounds.max[0]) continue;
          if (o.z1 < bounds.min[2] || o.z0 > bounds.max[2]) continue;
          landmarkBoxes.push(o);
        }
      }

      field = bakeCanyonField({
        occluders: block.occluders.concat(landmarkBoxes),
        bounds,
        voxelXZ: cfg.voxelXZ,
        slicesY: cfg.slicesY,
        maxVoxels: cfg.maxVoxels,
      });
      lights.setCanyonField(field);
      api.stats = field.stats;

      if (field.stats.coarsenedBy > 1.001) {
        ctx.warnOnce(
          'canyon-coarsened',
          `canyon field coarsened ${field.stats.coarsenedBy.toFixed(2)}× to ${field.voxelXZ.toFixed(2)} m ` +
            `to stay under ${cfg.maxVoxels} voxels`
        );
      }

      /**
       * The two openness figures the CPU side needs — from the BUILDINGS ONLY,
       * and that is a deliberate difference from the bake above.
       *
       * These two numbers do not describe this street. `roadSkyVis` calibrates
       * the analytic default (city.js), which stands in for every chunk in the
       * city that has no field, and it feeds the mean ground radiance that every
       * downward-facing surface in the world is lit by. Both consumers are
       * asking "how open is a typical street to the sky". Marching them through
       * the viaduct would answer "how open is the one street with a bridge over
       * it", and would then dim the whole distant city by the shading of a
       * single block — the exact regression session 4 traced when it calibrated
       * the default off the kerb instead of off the measured field.
       *
       * The bake answers the other question — what does *this point* see — and
       * that is where the viaduct belongs. Both numbers are printed below so the
       * difference is on the record rather than in somebody's head.
       *
       * Re-marched rather than read back out of the texture: the texture is 8
       * bits per channel and lives on the GPU, and this is the same model at
       * full precision for a few dozen points.
       */
      roadProfiles = block.roadProbes.map((p) => probeHorizon(block.occluders, p[0], p[1], p[2]));
      roadSkyVis = roadProfiles.reduce((a, r) => a + r.skyVis, 0) / Math.max(roadProfiles.length, 1);

      const withLandmarks = block.occluders.concat(landmarkBoxes);
      const roadSkyVisHere =
        block.roadProbes.reduce((a, p) => a + probeHorizon(withLandmarks, p[0], p[1], p[2]).skyVis, 0) /
        Math.max(block.roadProbes.length, 1);

      const facadeHits = block.facadeProbes.map((p) => probeHorizon(block.occluders, p[0], p[1], p[2]));
      facadeSkyVis =
        facadeHits.reduce((a, r) => a + r.skyVis, 0) / Math.max(facadeHits.length, 1);

      api.roadSkyVis = roadSkyVis;
      api.roadSkyVisHere = roadSkyVisHere;
      api.facadeSkyVis = facadeSkyVis;

      /**
       * The aerosol haze's in-scatter is the medium's own radiance, and the
       * medium in a street sees what the street sees. Same number as the ground
       * bounce uses, from the same march — not a second constant that agrees
       * with this one today. See HAZE_FRAGMENT in lights.js for the arithmetic
       * that made this necessary.
       */
      if (lights.setHazeOpenness) lights.setHazeOpenness(roadSkyVis);

      ctx.log(
        `canyon: ${field.dims.join('×')} voxels at ${field.voxelXZ.toFixed(2)} m from ` +
          `${block.occluders.length} block + ${landmarkBoxes.length} landmark occluders in ` +
          `${field.stats.bakeMs.toFixed(0)} ms (${(field.stats.bytes / 1048576).toFixed(2)} MB) — ` +
          `roadway sees ${(roadSkyVis * 100).toFixed(0)}% of the sky from the buildings alone, ` +
          `${(roadSkyVisHere * 100).toFixed(0)}% counting what stands over it; ` +
          `facades ${(facadeSkyVis * 100).toFixed(0)}%. The first figure is what calibrates the ` +
          `analytic default and the ground radiance; the second is what this block's own field bakes.`
      );

      computeRadiance(ctx);
      lastSkyVersion = ctx.get('sky').version;

      /**
       * THE THREE TERMS OF A FACADE'S RADIANCE, SEPARATELY — session 19, and
       * CONTRACT §9 rule 4 in its strongest form: a value that crosses two
       * module boundaries to reach a shader is printed at the point of USE.
       *
       * The lamp term added this session is 8.5% of a facade at midnight; the
       * sum alone would hide both that it is small and that it is there at all,
       * which is exactly how `uNoctisFieldDefault.z` was NaN for four sessions
       * while the boot log printed the correct 0.244 the whole time.
       */
      {
        const sky = ctx.get('sky');
        const S = block.surfaces;
        const eLampLog = (sky.groundLightingLux || 0) * CANYON.facadeLampShare;
        const lampL = S.facadeAlbedo.map((a, c) => a * RECIP_PI * eLampLog * SODIUM[c]);
        const lum = (v) => 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
        const total = api.faceRadiance && api.faceRadiance[0] ? lum(api.faceRadiance[0]) : 0;
        ctx.log(
          `canyon facade radiance, +X wall: total ${total.toFixed(4)} cd/m² = ` +
            `emissive ${lum(S.facadeEmissive).toFixed(4)} + ` +
            `LAMPS ${lum(lampL).toFixed(4)} (session 19: ` +
            `${sky.groundLightingLux.toFixed(1)} lx road × CANYON.facadeLampShare ` +
            `${CANYON.facadeLampShare} = ${eLampLog.toFixed(3)} lx on the wall) + ` +
            `sun and sky, the remainder. The lamp term is ` +
            `${total > 0 ? ((lum(lampL) / total) * 100).toFixed(1) : '0.0'}% of the total here — ` +
            `read CANYON.facadeLampShare before expecting it to have fixed the night.`
        );
      }

      /**
       * Read the baked field at a world point, on the CPU, in full precision.
       *
       * Not used by the frame. It exists because "the road is still too blue"
       * is a question about the ratio of two numbers — how much sky this point
       * sees against how much wall — and guessing at that ratio from a rendered
       * pixel is how a session loses a day. The shader reads the same bytes.
       */
      api.sampleField = (x, y, z) => {
        const [nx, nz, ny] = field.dims;
        const b = field.bounds;
        const u = (x - b.min[0]) / (b.max[0] - b.min[0]);
        const v = (z - b.min[2]) / (b.max[2] - b.min[2]);
        const w = Math.sqrt(Math.max(0, Math.min(1, y / field.yMax)));
        const ix = Math.max(0, Math.min(nx - 1, Math.floor(u * nx)));
        const iz = Math.max(0, Math.min(nz - 1, Math.floor(v * nz)));
        const iy = Math.max(0, Math.min(ny - 1, Math.floor(w * ny)));
        const o = ((iy * nz + iz) * nx + ix) * 4;
        return {
          bent: [
            field.skyBent[o] / 127.5 - 1,
            field.skyBent[o + 1] / 127.5 - 1,
            field.skyBent[o + 2] / 127.5 - 1,
          ].map((q) => +q.toFixed(3)),
          skyVis: +(field.skyBent[o + 3] / 255).toFixed(3),
          faces: [
            field.faces[o] / 255,
            field.faces[o + 1] / 255,
            field.faces[o + 2] / 255,
            field.faces[o + 3] / 255,
          ].map((q) => +q.toFixed(3)),
        };
      };

      api.setEnabled = (on) => {
        api.enabled = !!on;
        lights.setIndirect(api.enabled);
      };
      if (ctx.config && Number(ctx.config.indirect) === 0) api.setEnabled(false);

      // --- streaming --------------------------------------------------------

      allocateSlotPool(ctx);

      /**
       * The drip, with both ends of its derivation printed beside it —
       * CONTRACT §9 rule 4, and this constant is exactly the case that rule
       * describes: a number derived from a measured cadence in one file and
       * consumed in another.
       */
      {
        const asked = ctx.config ? Number(ctx.config.fieldDrip) : -1;
        layersPerFrame = Number.isFinite(asked) && asked >= 0 ? asked : CITY.fieldLayersPerFrame;
        const n = layersPerFrame;
        const kib = (CITY.fieldRes * CITY.fieldRes * 4) / 1024;
        const burstWas = 2 * CITY.fieldSlices;
        if (n <= 0) {
          ctx.log(
            `canyon: field layers BURST — all ${CITY.fieldSlices} layers × 2 arrays = ${burstWas} ` +
              `texSubImage3D calls in the frame a bake lands, ${(burstWas * kib).toFixed(1)} KiB at once. ` +
              `This is ?fieldDrip=0, the pre-session-10 arm, and it is the schedule session 9d measured ` +
              `the driver's conserved once-per-frame stall catching at ~9.2 ms.`
          );
        } else {
          const dripFramesPerChunk = Math.ceil(CITY.fieldSlices / n);
          const callsPerDripFrame = 2 * n;
          ctx.log(
            `canyon: field layers drip ${n}/frame/array = ${callsPerDripFrame} texSubImage3D calls a ` +
              `frame, ${dripFramesPerChunk} frames a chunk with nothing else queued ` +
              `(${(dripFramesPerChunk / 60).toFixed(3)} s at 60 fps), against ${burstWas} calls in one ` +
              `frame before. Per layer ${CITY.fieldRes}×${CITY.fieldRes}×4 = ${kib.toFixed(2)} KiB, so a ` +
              `drip frame moves ${(callsPerDripFrame * kib).toFixed(1)} KiB where the burst moved ` +
              `${(burstWas * kib).toFixed(1)} KiB. Totals unchanged: ${CITY.fieldSlices} × 2 = ` +
              `${burstWas} calls per bake either way. The budget is GLOBAL, so ${callsPerDripFrame} is ` +
              `the per-frame call count at any backlog and the backlog is paid in latency instead — ` +
              `streamStats().maxConcurrentDrips is the high-water mark, measured at 8 on a cold start ` +
              `and 1–2 in steady traverse.` +
              (asked >= 0 ? ` Overridden from ${CITY.fieldLayersPerFrame} by ?fieldDrip=${asked}.` : '')
          );
        }
      }

      try {
        worker = new Worker(new URL('../workers/canyon-worker.js', import.meta.url), {
          type: 'module',
        });
        worker.onmessage = (e) => {
          const msg = e.data;
          if (msg.type === 'baked') onBaked(ctx, msg);
          else if (msg.type === 'bakeFailed') onBakeFailed(ctx, msg);
        };
        worker.onerror = (e) => {
          workerBroken = true;
          ctx.warnOnce('canyon-worker', `canyon worker failed (${e.message}) — every chunk will use the analytic default`);
        };
      } catch (e) {
        workerBroken = true;
        // Not a quarantine: the module still does its job, at lower fidelity.
        // Baking on the main thread instead would trade a plausible default for
        // a 200 ms hitch every few seconds, which is the trade this whole
        // structure exists to avoid.
        ctx.warnOnce('canyon-worker', `no worker available (${e.message}) — every chunk will use the analytic default`);
      }

      /**
       * Ask for a chunk's field. Idempotent, and cheap to call every frame for
       * every chunk in the ring — which is how the caller uses it, because that
       * is also how the least-recently-wanted eviction order gets maintained.
       */
      api.requestChunk = (cx, cz, extraOccluders, wantedAt) => {
        if (workerBroken || !worker) return false;
        const key = `${cx},${cz}`;
        const existing = residentByKey.get(key);
        if (existing) {
          existing.lastWanted = wantedAt;
          return !existing.pending;
        }
        const slot = claimSlot(ctx, cx, cz, key, wantedAt);
        if (slot < 0) return false;
        const rec = { cx, cz, key, slot, pending: true, lastWanted: wantedAt, jobId: 0 };
        slots[slot] = rec;
        residentByKey.set(key, rec);
        queue.push({ cx, cz, key, extraOccluders: extraOccluders || [] });
        pump(ctx);
        return false;
      };

      /** Drop a chunk's field. The chunk falls back to the analytic default. */
      api.releaseChunk = (cx, cz) => {
        const rec = residentByKey.get(`${cx},${cz}`);
        if (rec && !rec.pending) evictSlot(rec.slot);
      };

      api.hasChunk = (cx, cz) => {
        const rec = residentByKey.get(`${cx},${cz}`);
        return !!rec && !rec.pending;
      };

      /**
       * Bytes the field costs, counted twice on purpose.
       *
       * three uploads a changed layer out of `image.data`, so the array texture's
       * full contents stay resident on the CPU as well as on the GPU. Counting
       * only the GPU side would report exactly half the truth, which is the
       * failure mode CONTRACT §9 is about.
       */
      api.fieldBytes = () => 2 * (SLOT_BYTES * CITY.fieldSlots * 2) + slotTable.length;

      /**
       * THREE ARGUMENTS, AND THE THIRD ONE WAS BEING DROPPED HERE — session 18.
       *
       * `city.js` measures the facade openness off its own horizon march, logs
       * it beside the roadway figure and the ratio between them (the boot line
       * that ends "a factor of 3.3, which is why the default is now selected by
       * the surface normal rather than by height alone"), and passes all three
       * numbers to `canyon.setFieldDefault`. This forwarder took two.
       *
       * `lights.setFieldDefault` therefore evaluated
       * `Math.min(1, Math.max(0.04, undefined))` = **NaN** into
       * `uNoctisFieldDefault.z`, which `lights.js`'s `noctisDefaultField` mixes
       * into the sky visibility of every surface in every chunk WITHOUT A BAKED
       * FIELD — i.e. everything past the 30-slot field ring, which at the
       * elevated night view is most of the city and all of the skyline. The
       * measured 0.244 that `city.js` prints at boot has never reached a shader.
       *
       * It is CONTRACT §9.1's "a value in config the code does not read" with a
       * forwarder instead of config, and it survived because the number it
       * carries is only READ far away: the near city has a baked field and looks
       * right, so nothing near the camera ever showed it.
       */
      api.setFieldDefault = (halfWidth, meanHeight, facadeVis) =>
        lights.setFieldDefault(halfWidth, meanHeight, facadeVis);

      api.streamStats = () => ({
        slots: CITY.fieldSlots,
        resident: residentByKey.size,
        ready: [...residentByKey.values()].filter((r) => !r.pending).length,
        queued: queue.length,
        inFlight: inFlight.size,
        baked: bakedCount,
        failed: failedCount,
        lastBakeMs: +lastBakeMs.toFixed(1),
        workerBroken,
        /**
         * The drip, reported so that a run can say what it actually did rather
         * than what the constant asks for. `layersPerFrame` is the ask;
         * `dripFrames` × `layersPerFrame` × 2 arrays is the call count the ask
         * predicts and `dripLayers` × 2 is the count it delivered, so the two
         * are printable side by side (CONTRACT §9 rule 4). `dripsInFlight` at
         * its high-water mark is the bound the constant's derivation claims:
         * above 1 the drips are overlapping and the per-frame burst is a
         * multiple of the ask.
         */
        layersPerFrame,
        dripping: uploads.length,
        maxConcurrentDrips,
        dripFrames,
        dripLayers: dripLayersDone,
      });

      return api;
    },

    update(ctx) {
      /**
       * BEFORE THE TWO EARLY RETURNS BELOW, and that ordering is the bug this
       * function would otherwise have. The sky-version guard skips almost every
       * frame — that is its job, the radiances only change when the sun has
       * moved 0.35° — and a drip that ran after it would advance on the handful
       * of frames a day when the sun ticks, which is a chunk arriving some
       * seconds later and looking like the streaming having stalled.
       */
      drainUploads();

      const sky = ctx.get('sky');
      if (!sky) return;
      // The sky module already decides when the sun has moved enough to matter
      // (0.35°, sky.js). Recomputing on its version rather than on our own test
      // means there is one answer to "has the sun moved" in the project.
      if (sky.version === lastSkyVersion) return;
      lastSkyVersion = sky.version;
      computeRadiance(ctx);
    },

    dispose(ctx) {
      const lights = ctx.get('lights');
      if (lights) {
        lights.setIndirect(true);
        if (lights.setChunkField) lights.setChunkField(null);
      }
      if (worker) worker.terminate();
      worker = null;
      if (arrayA) arrayA.dispose();
      if (arrayB) arrayB.dispose();
      if (slotTex) slotTex.dispose();
      arrayA = arrayB = slotTex = null;
      slots.fill(null);
      residentByKey.clear();
      queue.length = 0;
      uploads.length = 0;
      inFlight.clear();
      field = null;
    },
  };
}
