import * as THREE from 'three';

/**
 * Per-instance motion vectors: the double buffer, and the invariant that makes
 * the swap a fact rather than a habit. CONTRACT §5.12.
 *
 * WHY THIS EXISTS. §5.11 closed motion vectors for rigid non-instanced objects
 * and wrote down its own limit: one `uNoctisPrevDelta` per material is one per
 * draw call, so an `InstancedMesh` whose instances move independently — which
 * is what a traffic system is — cannot use it. The general answer is a second
 * instanced attribute holding the previous frame's `instanceMatrix`. 64 bytes
 * an instance: 6.0 KiB for 96 vehicles, 22.5 KiB for 360 pedestrians.
 *
 * The alternative — reconstructing the previous position analytically in the
 * vertex shader from a spline parameter and dt — is cheaper and works for
 * traffic and does not work for a person walking to a shop. Two mechanisms for
 * one thing are worse than one that costs slightly more.
 *
 * WHY IT IS A SWAP AND NOT A COPY. `memcpy(prev, cur)` before overwriting `cur`
 * is the obvious implementation; the swap avoids the copy by letting the two
 * arrays trade roles.
 *
 * THE HALF-THE-BANDWIDTH CLAIM THAT WAS HERE IS WITHDRAWN. It said a swap
 * uploads one buffer where a copy uploads two, because the buffer becoming
 * `previous` was already uploaded last frame as `current`. That is true only if
 * the two ATTRIBUTE OBJECTS are exchanged, and exchanging them costs a VAO
 * rebuild per draw per frame that is worth far more than the bytes — measured
 * at 1.05 ms a frame for two draw calls, against 0.10 ms for the whole traffic
 * simulation. See the note on `curAttr` below. Identity is now fixed, both
 * buffers upload every frame, and the swap's remaining and sufficient
 * justification is that it does not copy 30 kB per mesh per frame.
 *
 * THE INVARIANT, AND WHY IT IS ENFORCED RATHER THAN DOCUMENTED
 * ------------------------------------------------------------
 * A buffer that is written and read in the same frame is the same class of
 * mistake as a value in config the code does not read (CONTRACT §9.1), and it
 * fails the same way. If `read()` hands back the buffer `begin()` just handed
 * out, then previous equals current for every instance, every motion vector is
 * exactly zero, and the symptom is that traffic aliases — which is precisely
 * the symptom of not having built any of this. A bug whose signature is
 * identical to the absence of the feature will not be found by looking.
 *
 * So `read(frame)` THROWS when the buffer it is about to return carries this
 * frame's write. A module that throws is quarantined (CONTRACT §2.1), the frame
 * keeps rendering, `ctx.faults` becomes non-empty — and every gate in the
 * project already asserts that array is empty. One invariant, six gates, and no
 * new gate needed to hold it up. `tools/faultcheck.mjs` case `swap` exercises
 * it, per the CONTRACT §7 rule this session adds: a gate without a known case
 * that makes it fail does not count as a gate.
 *
 * THREE BUFFER STATES, NOT TWO. `NEVER` is a buffer nobody has written, and
 * reading one is a fault — it is four columns of zeros, a singular matrix, and
 * the vertex shader would send every instance to the origin. `PRIMED` is a
 * buffer seeded at construction with the initial transforms, which is older
 * than any frame and is the correct `previous` for frame zero: nothing has
 * moved yet, so previous really does equal current, and the motion vector is
 * zero for the right reason rather than by luck.
 */

/** Floats in a mat4. The attribute's itemSize. */
export const MATRIX_FLOATS = 16;

/** A buffer nobody has written. Reading one is a fault. */
const NEVER = -2;

/** Seeded at construction. Older than any frame, so frame 0 may read it. */
const PRIMED = -1;

/**
 * @param {number} count      instances. Fixed: the census reads
 *                            `instanceMatrix.count` as the population and
 *                            `citycheck` separately fails a mesh that draws
 *                            fewer than it allocated, so a pool that
 *                            over-allocates is wrong twice.
 * @param {string} label      what the harness reports this layer as.
 */
export function createInstanceMotion(count, label) {
  const floats = count * MATRIX_FLOATS;
  const arrays = [new Float32Array(floats), new Float32Array(floats)];

  /**
   * TWO ATTRIBUTES WITH FIXED IDENTITY, AND THE SWAP MOVES THE ARRAYS UNDER
   * THEM. This is the second version and the first one was measured wrong.
   *
   * The obvious double buffer keeps two attribute OBJECTS and rebinds which is
   * which each frame — `mesh.instanceMatrix = attrs[w]` and
   * `geometry.setAttribute('noctisPrevInstanceMatrix', attrs[w ^ 1])`. It is
   * correct, it uploads half as many bytes, and it cost 1.05 ms a frame at the
   * median on `downtown_dense` for TWO draw calls.
   *
   * Why: three caches vertex-attribute setup per (geometry, program) and
   * invalidates it by comparing attribute OBJECT IDENTITY
   * (WebGLBindingStates.needsUpdate). Swapping the objects changes identity
   * every frame, so three re-runs `setupVertexAttributes` for the ENTIRE
   * geometry — position, normal, uv, instanceColor, noctisRough and both mat4s
   * at four slots each — on every draw. Profiled: `vertexAttribPointer` 2.97
   * ms/frame and `uniformMatrix4fv` 2.21 ms/frame, against 0.10 ms/frame for
   * all of traffic's own simulation put together. The cost of a double buffer
   * was never the bytes.
   *
   * So identity is fixed and `.array` is reassigned. Both attributes are then
   * re-uploaded each frame rather than one, which is 245 kB a frame for 960
   * vehicle instances and is the trade that was worth making: a `bufferSubData`
   * of 30 kB is microseconds and a VAO rebuild is not. The SWAP survives — no
   * `memcpy(prev, cur)` happens, which is what the double buffer was for — and
   * the invariant below is untouched, because the stamps follow the ARRAYS and
   * never followed the attributes.
   */
  const curAttr = new THREE.InstancedBufferAttribute(arrays[0], MATRIX_FLOATS);
  const prevAttr = new THREE.InstancedBufferAttribute(arrays[1], MATRIX_FLOATS);
  curAttr.setUsage(THREE.DynamicDrawUsage);
  prevAttr.setUsage(THREE.DynamicDrawUsage);

  /** Which of the two the producer is currently filling. */
  let writeIx = 0;
  /** Frame id each buffer was last committed on, or NEVER / PRIMED. */
  const stamp = [NEVER, NEVER];

  let openFrame = NEVER;
  let committed = false;

  /**
   * Rows whose previous transform must be forced equal to their current one
   * this frame, so their motion vector is exactly zero. Two callers and one
   * mechanism:
   *
   *   - an instance below the `motionVectors.minExtentPx` threshold, which
   *     cannot express reprojection error the neighbourhood clamp would catch;
   *   - an instance that was RECYCLED this frame — a vehicle that reached the
   *     end of its spline and reappeared at the start, a pedestrian re-seated
   *     as the ring moved. Its genuine previous transform is hundreds of metres
   *     away and the vector across that gap is not motion, it is bookkeeping.
   *
   * The second is the one that would have been found late and blamed on the
   * traffic system. It is the same defect §5.11 named for the camera — history
   * that describes a different world — one level down.
   */
  let carried = [];

  const stats = {
    label,
    count,
    frames: 0,
    reads: 0,
    /**
     * Reads that asked for a buffer written this frame. Zero in any healthy
     * run because `read` throws before it can increment past one — the counter
     * exists so the fault is a NUMBER in `harness.instanceMotionStats()` and
     * not only a stack trace in a console nobody captured.
     */
    sameFrameViolations: 0,
    neverWrittenReads: 0,
    /** Instances that got a real previous transform on the last committed frame. */
    written: 0,
    /** Of which suppressed: below threshold or recycled. */
    carried: 0,
    /** Frames on which the read buffer had to be patched and re-uploaded. */
    patchedFrames: 0,
  };

  /**
   * Seed both buffers with the initial transforms. Call once, after the
   * producer has composed instance 0..count-1 into `src`.
   *
   * PRIMED rather than stamped with a frame: frame 0 must be allowed to read
   * this, and it must not be confused with a buffer that a frame wrote.
   */
  function prime(src) {
    arrays[0].set(src);
    arrays[1].set(src);
    curAttr.array = arrays[writeIx];
    prevAttr.array = arrays[writeIx ^ 1];
    curAttr.needsUpdate = true;
    prevAttr.needsUpdate = true;
    stamp[0] = PRIMED;
    stamp[1] = PRIMED;
  }

  /**
   * Open a frame and swap. Returns the Float32Array the producer fills with
   * this frame's transforms.
   *
   * Throws on a repeated or out-of-order frame id. A gap is not an error — a
   * paused clock delivers one — but going backwards means two systems disagree
   * about what frame it is, and then `previous` means whatever the disagreement
   * happens to produce.
   */
  function begin(frame) {
    if (frame === openFrame) {
      throw new Error(
        `[instmotion:${label}] begin(${frame}) twice in one frame. ` +
        'Two producers are writing one buffer and only one of them is in the frame.'
      );
    }
    if (openFrame !== NEVER && frame < openFrame) {
      throw new Error(
        `[instmotion:${label}] begin(${frame}) after frame ${openFrame} — time ran backwards.`
      );
    }
    writeIx ^= 1;
    // The swap, and the only place it happens. Identity is fixed; the arrays
    // move. `curAttr` is what the mesh draws from, `prevAttr` is what the
    // vertex shader reads as the previous transform, and next frame they trade
    // storage without either object being replaced.
    curAttr.array = arrays[writeIx];
    prevAttr.array = arrays[writeIx ^ 1];
    openFrame = frame;
    committed = false;
    carried.length = 0;
    return arrays[writeIx];
  }

  /**
   * Force instance `i`'s previous transform equal to its current one, so its
   * motion vector is exactly zero. Must be called between `begin` and `commit`.
   */
  function carry(i) {
    carried.push(i);
  }

  /**
   * THE UPLOAD A/B, AND IT IS AN INSTRUMENT RATHER THAN A MODE.
   *
   * The one hypothesis about traffic's +1.05 ms median and +2.0 ms p95 that
   * nothing had tested: `.array` is reassigned every frame in `begin()`, so
   * three re-uploads the WHOLE attribute with `bufferSubData` into a buffer the
   * GPU may still be reading from the previous frame's draw. A driver resolves
   * that by orphaning the storage or by stalling until the read completes, and
   * both of those are TAIL costs rather than mean ones — which is the signature
   * that was measured.
   *
   * With this true, `commit()` stops marking the attributes dirty. Everything
   * else is unchanged: the simulation runs, the swap swaps, the stamps advance,
   * `read()` still throws on a same-frame read, the meshes are still drawn and
   * still visible, and the draw calls, triangle count and instance count are
   * bit-identical. What stops is the per-frame buffer rewrite.
   *
   * IT MAKES THE FRAME WRONG — the vehicles stop moving on screen — and that is
   * what makes it an isolation rather than an optimisation. `tools/uploadprobe.mjs`
   * is the only caller. No gate may set it, for the same reason §8 gives about
   * `setConeBound`: an A/B arm that changes content is not an A/B.
   */
  let uploadFrozen = false;
  function setUploadFrozen(b) {
    uploadFrozen = !!b;
  }

  /** Close the frame: apply the carries, upload what changed. */
  function commit() {
    if (committed) throw new Error(`[instmotion:${label}] commit() twice in frame ${openFrame}`);
    const readIx = writeIx ^ 1;
    if (carried.length) {
      // prev := cur, row by row, in the buffer that is about to be read. This
      // is the only write to the read side and it is what costs the second
      // upload; it happens on a frame where something was recycled or fell
      // below the size threshold, and on no other.
      const w = arrays[writeIx];
      const r = arrays[readIx];
      for (let k = 0; k < carried.length; k++) {
        const base = carried[k] * MATRIX_FLOATS;
        for (let j = 0; j < MATRIX_FLOATS; j++) r[base + j] = w[base + j];
      }
      stats.patchedFrames++;
    }
    // Both, every frame: each attribute's `.array` was reassigned in `begin`,
    // so each needs its buffer refreshed. This is the upload the fixed-identity
    // form trades for the VAO rebuild it removes — and it is the quantity
    // `setUploadFrozen` withholds.
    if (!uploadFrozen) {
      curAttr.needsUpdate = true;
      prevAttr.needsUpdate = true;
    }
    stamp[writeIx] = openFrame;
    committed = true;
    stats.frames++;
    stats.carried = carried.length;
    stats.written = count - carried.length;
  }

  /** The buffer holding THIS frame's transforms. Bind as `instanceMatrix`. */
  function current() {
    return curAttr;
  }

  /**
   * The buffer holding the PREVIOUS frame's transforms. Bind as
   * `noctisPrevInstanceMatrix`. Throws rather than returning the wrong one.
   */
  function read(frame) {
    const readIx = writeIx ^ 1;
    if (stamp[readIx] === frame) {
      stats.sameFrameViolations++;
      throw new Error(
        `[instmotion:${label}] read(${frame}) would return the buffer written in frame ${frame}. ` +
        'Previous would equal current, every motion vector would be exactly zero, and the ' +
        'symptom would be indistinguishable from having no per-instance motion at all. ' +
        'CONTRACT §5.12: the swap is an invariant, not a convention.'
      );
    }
    if (stamp[readIx] === NEVER) {
      stats.neverWrittenReads++;
      throw new Error(
        `[instmotion:${label}] read(${frame}) before prime(). An unwritten mat4 attribute is ` +
        'four columns of zeros, which is singular and puts every instance at the origin.'
      );
    }
    stats.reads++;
    return prevAttr;
  }

  function dispose() {
    curAttr.array = null;
    prevAttr.array = null;
    arrays[0] = null;
    arrays[1] = null;
  }

  return {
    prime, begin, carry, commit, current, read, dispose, setUploadFrozen,
    get stats() {
      return { ...stats };
    },
    /** Bytes the SECOND attribute costs. The first replaces one that existed. */
    get addedBytes() {
      return floats * 4;
    },
  };
}

/**
 * One pixel of the internal buffer, in radians, from the live projection.
 *
 * Not baked: the threshold below is in pixels of the render target, and the
 * target's height and the camera's field of view are both things a shot can
 * change. `RENDER.pixels` is fixed at 2560x1440 today and the gate's fov is
 * 50 degrees, giving 2*tan(25 deg)/1440 = 6.4765e-4 rad, but deriving it here
 * costs one divide a frame and removes a constant that would be right until
 * somebody changed a camera.
 */
export function pixelAngle(camera, internalHeight) {
  return (2 * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, internalHeight);
}

/**
 * The distance beyond which an instance of smallest body dimension
 * `minExtentM` gets no motion vector. CONTRACT §5.12,
 * `tools/budget.json` -> `motionVectors`.
 *
 * minExtentM / (minExtentPx * theta). Printed with its inputs by every caller
 * at init, per CONTRACT §9 rule 4 — a cutoff distance derived from a pixel
 * count and an angle, consumed in a different file, is exactly the shape that
 * rule exists for.
 */
export function motionCutoffDistance(minExtentM, minExtentPx, theta) {
  return minExtentM / (minExtentPx * theta);
}
