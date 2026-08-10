/**
 * canyon-worker.js — the canyon bake, off the main thread. CONTRACT §11.
 *
 * WHY THIS EXISTS AT ALL, IN ONE NUMBER
 *
 * Session 3 measured the bake at 455 ms for the origin block. That is fine in a
 * worker and fatal on the main thread: at a walking pace a new chunk crosses the
 * horizon every few seconds, and a 455 ms hitch every few seconds is not a
 * frame budget being missed, it is a slideshow with gaps.
 *
 * WHY IT CAN BE A WORKER AT ALL
 *
 * Because `lib/canyon.js` is pure — boxes in, bytes out, imports nothing but
 * arithmetic — and because `lib/citygen.js` is deterministic per chunk in
 * `(rootSeed, cx, cz)` and nothing else. So this worker can generate the nine
 * chunks of a bake neighbourhood itself, without being told what the main thread
 * happens to hold, and get byte-identical occluders. If generation depended on
 * order or on shared state, the field would describe a slightly different city
 * from the one being drawn, and that mismatch has no stack trace: it looks like
 * indirect light that is subtly wrong everywhere.
 *
 * WHAT COMES BACK
 *
 * Two Uint8Arrays, transferred rather than copied. Everything else in the
 * message is a number.
 */

import { bakeCanyonField } from '../lib/canyon.js';
import { bakeOccluders, chunkBounds, CITY } from '../lib/citygen.js';

self.onmessage = (e) => {
  const msg = e.data;
  if (!msg || msg.type !== 'bake') return;

  const { rootSeed, cx, cz, jobId, extraOccluders } = msg;

  try {
    const t0 = performance.now();
    const b = chunkBounds(cx, cz);
    const m = CITY.fieldMargin;
    const bounds = {
      min: [b.x0 - m, 0, b.z0 - m],
      max: [b.x1 + m, CITY.fieldHeight, b.z1 + m],
    };

    const occluders = bakeOccluders(rootSeed, cx, cz, extraOccluders || []);

    const field = bakeCanyonField({
      occluders,
      bounds,
      dimsXZ: CITY.fieldRes,
      slicesY: CITY.fieldSlices,
      maxVoxels: CITY.fieldRes * CITY.fieldRes * CITY.fieldSlices,
    });

    // The slot allocator assumes every chunk's field is the same shape. Say so
    // here rather than letting a mismatched upload corrupt a neighbour's slot,
    // which would render as indirect light from the wrong part of the city.
    const [nx, nz, ny] = field.dims;
    if (nx !== CITY.fieldRes || nz !== CITY.fieldRes || ny !== CITY.fieldSlices) {
      throw new Error(`field dims ${field.dims.join('×')} ≠ ${CITY.fieldRes}×${CITY.fieldRes}×${CITY.fieldSlices}`);
    }

    self.postMessage(
      {
        type: 'baked',
        jobId,
        cx,
        cz,
        dims: field.dims,
        bounds: field.bounds,
        yMax: field.yMax,
        voxelXZ: field.voxelXZ,
        occluderCount: occluders.length,
        bakeMs: performance.now() - t0,
        skyBent: field.skyBent,
        faces: field.faces,
      },
      [field.skyBent.buffer, field.faces.buffer]
    );
  } catch (err) {
    // A bake that throws must not take the streaming system with it. The chunk
    // falls back to the analytic default, which is what an unarrived chunk
    // renders with anyway — CONTRACT §11 and the same reasoning as §2.1.
    self.postMessage({
      type: 'bakeFailed',
      jobId,
      cx,
      cz,
      message: err && err.message ? err.message : String(err),
    });
  }
};
