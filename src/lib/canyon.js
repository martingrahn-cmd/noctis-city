/**
 * canyon.js — the bake behind the indirect light. Pure: boxes in, bytes out.
 *
 * WHAT THIS IS
 *
 * A street is a canyon, and almost everything that was wrong with session 1's
 * noon frame follows from the renderer not knowing that. A horizontal surface
 * in an open field sees the whole sky hemisphere; the same surface between two
 * thirty-metre buildings sees the strip they leave it, and the rest of what it
 * sees is *facade*. Session 1 gave every surface the open field: too much sky,
 * and no facade at all. The road came out over-lit and navy, which is exactly
 * what a horizontal surface lit by nothing but a clear sky looks like.
 *
 * Sky occlusion and bounce are therefore not two problems. They are one
 * integral over the hemisphere, split at the horizon: above it is sky, below it
 * is a wall. Solve them separately and the two approximations disagree, and
 * they disagree along the line where the road meets the building, which is the
 * line the eye is on.
 *
 * WHAT IT STORES, AND WHY NONE OF IT MENTIONS THE SUN
 *
 * Per voxel, six numbers:
 *
 *   skyVis      cosine-weighted fraction of the hemisphere that reaches sky
 *   bentNormal  the mean unoccluded direction
 *   face[4]     cosine-weighted fraction subtended by surfaces whose outward
 *               normal is +X, −X, +Z or −Z
 *
 * All six are pure geometry. That is the whole design. A probe grid storing
 * *radiance* is invalid the moment the sun moves, and here the sun moves 0.35°
 * about once a second at the default day length — a bake that has to be redone
 * on that cadence is not a bake, it is a per-frame cost with a latency. What is
 * stored here is *transfer*: bake once, valid at every hour. At runtime the CPU
 * turns the current sun into four facade radiances and the shader does
 * `Σ face[d] · L_d`, which is four multiplies.
 *
 * It is also why this survives session 3. A chunk's field depends only on the
 * boxes within the horizon-march radius, so streaming is "bake on chunk load".
 * Nothing about it is global.
 *
 * HOW THE MARCH WORKS
 *
 * Thirty-two azimuths per column. For each, the ray is tested against every
 * occluder footprint and the hits are kept as (distance, top, face).
 *
 * The hits do not depend on height — the ray is horizontal — so the expensive
 * part runs once per (x, z) column and all forty-odd vertical samples are then
 * closed-form: the horizon in azimuth k at height y is
 * `max over hits of atan((top − y) / distance)`. That single observation is
 * what makes the bake cheap enough to run at load: a few thousand ray-box tests
 * instead of a few million.
 *
 * TWO APPROXIMATIONS, STATED
 *
 *   1. Every occluder is treated as reaching down to the ground. A canopy is a
 *      slab in the air, so a point beside one "sees" it as a wall rather than
 *      as a band. For a canopy bolted to a facade this is nearly true — the
 *      wall really is underneath it — and it is what makes the space under an
 *      overhang darken without a separate term. For a free-floating occluder it
 *      would be wrong, and there are none.
 *
 *   2. Footprints are axis-aligned. The buildings sit up to 0.7° off axis
 *      (authored-city.md §3), which moves a 25 m facade by 30 cm — a fifth of a
 *      voxel.
 */

/** Azimuthal resolution of the horizon march. 32 wedges = 11.25° each. */
const AZIMUTHS = 32;

/** Channel order of the face buckets. Must match the shader. */
export const FACE_AXES = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
];

/**
 * Vertical sample positions are warped so resolution follows the camera.
 *
 * A uniform ladder over ninety metres spends most of its samples on empty air
 * above the parapets and leaves the canopy soffit — four metres up, one metre
 * deep, and the one overhang anybody stands under — sharing a voxel with the
 * shopfront below it. Square-root warping puts sub-metre spacing under six
 * metres and three-metre spacing at fifty, where the field is nearly constant.
 *
 * The shader applies the same warp; there is one function and it is here.
 */
export const yToSlice = (y, yMax) => Math.sqrt(Math.max(0, Math.min(1, y / yMax)));
export const sliceToY = (v, yMax) => v * v * yMax;

/**
 * @typedef {{x0:number, x1:number, z0:number, z1:number, top:number}} Occluder
 */

/**
 * Entry distance and entry face of a horizontal ray against a footprint.
 * Returns null on a miss. `face` indexes FACE_AXES.
 */
function rayFootprint(ox, oz, dx, dz, box) {
  const inside = ox >= box.x0 && ox <= box.x1 && oz >= box.z0 && oz <= box.z1;
  if (inside) return { d: 0, face: -1, inside: true };

  const invX = dx !== 0 ? 1 / dx : Infinity;
  const invZ = dz !== 0 ? 1 / dz : Infinity;

  let tx0 = (box.x0 - ox) * invX;
  let tx1 = (box.x1 - ox) * invX;
  if (tx0 > tx1) {
    const t = tx0;
    tx0 = tx1;
    tx1 = t;
  }
  let tz0 = (box.z0 - oz) * invZ;
  let tz1 = (box.z1 - oz) * invZ;
  if (tz0 > tz1) {
    const t = tz0;
    tz0 = tz1;
    tz1 = t;
  }

  const tEnter = Math.max(tx0, tz0);
  const tExit = Math.min(tx1, tz1);
  if (!(tExit >= Math.max(tEnter, 0))) return null;

  // Which slab produced the entry decides which face was struck, and the face's
  // outward normal is what the bounce is bucketed by: it is the surface that
  // will be facing the sun, or not.
  const face = tx0 > tz0 ? (dx > 0 ? 1 : 0) : dz > 0 ? 3 : 2;
  return { d: Math.max(tEnter, 1e-3), face, inside: false };
}

/**
 * Bake the field.
 *
 * @param {object} spec
 * @param {Occluder[]} spec.occluders
 * @param {{min:[number,number,number], max:[number,number,number]}} spec.bounds  world-space extent to cover
 * @param {number} spec.voxelXZ    target horizontal spacing, metres
 * @param {number} spec.slicesY    vertical samples (warped, see yToSlice)
 * @param {number} spec.maxVoxels  hard ceiling; resolution is reduced to fit
 * @returns {{dims:number[], bounds:object, yMax:number, skyBent:Uint8Array, faces:Uint8Array, stats:object}}
 */
export function bakeCanyonField(spec) {
  const { occluders, bounds } = spec;
  const voxelXZ = spec.voxelXZ != null ? spec.voxelXZ : 1.5;
  const slicesY = spec.slicesY != null ? spec.slicesY : 48;
  const maxVoxels = spec.maxVoxels != null ? spec.maxVoxels : 900000;

  const spanX = bounds.max[0] - bounds.min[0];
  const spanZ = bounds.max[2] - bounds.min[2];
  const yMax = bounds.max[1];

  let step = voxelXZ;
  let nx = Math.max(2, Math.ceil(spanX / step) + 1);
  let nz = Math.max(2, Math.ceil(spanZ / step) + 1);
  let coarsened = 1;

  /**
   * `dimsXZ` asks for an exact sample count instead of a target spacing.
   *
   * The streaming field (§11) packs every chunk into fixed-size slots of one
   * array texture, so every chunk's field must have identical dimensions — not
   * nearly identical. Deriving them from `ceil(span / spacing)` would leave that
   * invariant standing on whether a division came out at 63.0 or 63.0000001,
   * which is a thing that is true on one machine and false on another. When a
   * caller knows the count it wants, it says so.
   */
  if (spec.dimsXZ) {
    nx = Math.max(2, spec.dimsXZ | 0);
    nz = nx;
    // Texel spacing, not node spacing: the samples below sit at (i + 0.5)/n, so
    // the distance between two of them is span/n. `voxelXZ` is what the shader
    // pushes its probe out of the wall by, and a probe offset derived from the
    // wrong spacing samples the middle of the street.
    step = spanX / nx;
    if (nx * nz * slicesY > maxVoxels) {
      throw new Error(`bakeCanyonField: dimsXZ ${nx} × ${slicesY} slices exceeds maxVoxels ${maxVoxels}`);
    }
  } else {
    // A ceiling rather than a guess: if a caller asks for a resolution that would
    // not fit in memory, coarsen until it does and say so, instead of allocating
    // whatever was asked for and discovering it on a different machine.
    while (nx * nz * slicesY > maxVoxels) {
      coarsened *= 1.25;
      step = voxelXZ * coarsened;
      nx = Math.max(2, Math.ceil(spanX / step) + 1);
      nz = Math.max(2, Math.ceil(spanZ / step) + 1);
    }
  }

  const skyBent = new Uint8Array(nx * nz * slicesY * 4);
  const faces = new Uint8Array(nx * nz * slicesY * 4);
  /** 1 = this sample stands inside a solid. See the dilation pass below. */
  const buried = new Uint8Array(nx * nz * slicesY);

  // Per-azimuth scratch, reused across columns.
  const dirX = new Float64Array(AZIMUTHS);
  const dirZ = new Float64Array(AZIMUTHS);
  for (let k = 0; k < AZIMUTHS; k++) {
    const a = ((k + 0.5) / AZIMUTHS) * Math.PI * 2;
    dirX[k] = Math.cos(a);
    dirZ[k] = Math.sin(a);
  }

  const hitD = [];
  const hitTop = [];
  const hitFace = [];
  const hitCount = new Int32Array(AZIMUTHS);
  const MAX_HITS = 12;
  for (let k = 0; k < AZIMUTHS; k++) {
    hitD.push(new Float64Array(MAX_HITS));
    hitTop.push(new Float64Array(MAX_HITS));
    hitFace.push(new Int32Array(MAX_HITS));
  }

  // Samples sit at texel *centres*, not at grid nodes. A 3D texture filters
  // about its texel centres, so a field baked on nodes is half a voxel out of
  // register with the thing that reads it — a constant, invisible, wrong-in-one-
  // direction bias, which is the worst kind.
  const yOf = new Float64Array(slicesY);
  for (let s = 0; s < slicesY; s++) yOf[s] = sliceToY((s + 0.5) / slicesY, yMax);

  let insideColumns = 0;
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;

  for (let iz = 0; iz < nz; iz++) {
    const wz = bounds.min[2] + (spanZ * (iz + 0.5)) / nz;
    for (let ix = 0; ix < nx; ix++) {
      const wx = bounds.min[0] + (spanX * (ix + 0.5)) / nx;

      // ---- horizontal march, once per column ----
      let solidTop = 0;
      for (let k = 0; k < AZIMUTHS; k++) {
        let n = 0;
        const dx = dirX[k];
        const dz = dirZ[k];
        for (let b = 0; b < occluders.length; b++) {
          const box = occluders[b];
          const hit = rayFootprint(wx, wz, dx, dz, box);
          if (!hit) continue;
          if (hit.inside) {
            if (box.top > solidTop) solidTop = box.top;
            continue;
          }
          if (n < MAX_HITS) {
            hitD[k][n] = hit.d;
            hitTop[k][n] = box.top;
            hitFace[k][n] = hit.face;
            n++;
          }
        }
        hitCount[k] = n;
      }
      if (solidTop > 0) insideColumns++;

      // ---- closed-form vertical sweep ----
      for (let s = 0; s < slicesY; s++) {
        const y = yOf[s];

        let visAcc = 0;
        let bx = 0;
        let by = 0;
        let bz = 0;
        const f0 = [0, 0, 0, 0];

        const isBuried = y < solidTop;

        for (let k = 0; k < AZIMUTHS; k++) {
          let hmax = 0;
          let face = -1;
          if (isBuried) {
            hmax = Math.PI / 2;
          } else {
            const n = hitCount[k];
            const dArr = hitD[k];
            const tArr = hitTop[k];
            const fArr = hitFace[k];
            for (let h = 0; h < n; h++) {
              const dy = tArr[h] - y;
              if (dy <= 0) continue;
              const e = Math.atan2(dy, dArr[h]);
              if (e > hmax) {
                hmax = e;
                face = fArr[h];
              }
            }
          }

          const sn = Math.sin(hmax);
          const cs = Math.cos(hmax);
          const sn2 = sn * sn;

          // Cosine-weighted solid angle of the wedge above the horizon,
          // normalised so an unoccluded hemisphere sums to 1:
          //   ∫∫ cosθ dω / π  over el ∈ [h, 90°]  =  (Δφ / 2π)(1 − sin²h)
          visAcc += 1 - sn2;

          // Mean unoccluded direction, same weighting. The vertical part is
          // (1 − sin³h)/3 and the horizontal part cos³h/3; the shared constants
          // fall out of the normalise at the end.
          by += 1 - sn * sn2;
          const hw = cs * cs * cs;
          bx += hw * dirX[k];
          bz += hw * dirZ[k];

          // Below the horizon in this wedge is a wall, and we know which way it
          // faces. This is the same integral as above, taken over the other
          // half of the split.
          if (face >= 0) f0[face] += sn2;
        }

        const inv = 1 / AZIMUTHS;
        const skyVis = visAcc * inv;
        let blen = Math.hypot(bx, by, bz);
        if (blen < 1e-9) {
          bx = 0;
          by = 1;
          bz = 0;
          blen = 1;
        }

        const cell = (s * nz + iz) * nx + ix;
        if (isBuried) buried[cell] = 1;
        const o = cell * 4;
        skyBent[o + 0] = Math.round(((bx / blen) * 0.5 + 0.5) * 255);
        skyBent[o + 1] = Math.round(((by / blen) * 0.5 + 0.5) * 255);
        skyBent[o + 2] = Math.round(((bz / blen) * 0.5 + 0.5) * 255);
        skyBent[o + 3] = Math.round(Math.min(1, Math.max(0, skyVis)) * 255);

        for (let c = 0; c < 4; c++) {
          faces[o + c] = Math.round(Math.min(1, Math.max(0, f0[c] * inv)) * 255);
        }
      }
    }
  }

  /**
   * Grow the exterior into the solids.
   *
   * A facade stands on the boundary between a voxel that is outside the
   * building and one that is inside it, and a trilinear fetch reads both. Left
   * as baked, "inside" says fully occluded and no walls anywhere, so every
   * facade in the city got roughly half the sky visibility and half the bounce
   * it should have — the walls stayed the colour of the sky and the whole point
   * of the exercise was lost on the vertical surfaces while working fine on the
   * road. Pushing the shader's lookup out along the normal is necessary and not
   * sufficient: at a metre of bias the far side of the filter kernel is still
   * in the wall.
   *
   * So the exterior is dilated a few voxels into the solid. What ends up behind
   * a facade is the field a step in front of it, which is the value that facade
   * should read. Deeper than the dilation reaches, the voxels stay fully
   * occluded, which is correct — there is nothing in there to light.
   */
  let dilated = 0;
  const NEIGHBOURS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let pass = 0; pass < 3; pass++) {
    let filled = 0;
    for (let s = 0; s < slicesY; s++) {
      for (let iz = 0; iz < nz; iz++) {
        for (let ix = 0; ix < nx; ix++) {
          const i = (s * nz + iz) * nx + ix;
          if (buried[i] !== 1) continue;
          for (const [dx, dz] of NEIGHBOURS) {
            const jx = ix + dx;
            const jz = iz + dz;
            if (jx < 0 || jx >= nx || jz < 0 || jz >= nz) continue;
            const j = (s * nz + jz) * nx + jx;
            // Only from a voxel that was already exterior before this pass, so
            // the dilation advances one voxel per pass rather than racing
            // across a whole building in the first one.
            if (buried[j] !== 0) continue;
            for (let c = 0; c < 4; c++) {
              skyBent[i * 4 + c] = skyBent[j * 4 + c];
              faces[i * 4 + c] = faces[j * 4 + c];
            }
            buried[i] = 2;
            filled++;
            break;
          }
        }
      }
    }
    for (let i = 0; i < buried.length; i++) if (buried[i] === 2) buried[i] = 0;
    dilated += filled;
    if (!filled) break;
  }

  const t1 = typeof performance !== 'undefined' ? performance.now() : 0;

  return {
    dims: [nx, nz, slicesY],
    bounds,
    yMax,
    voxelXZ: step,
    skyBent,
    faces,
    stats: {
      voxels: nx * nz * slicesY,
      columns: nx * nz,
      occluders: occluders.length,
      azimuths: AZIMUTHS,
      insideColumns,
      dilatedVoxels: dilated,
      coarsenedBy: coarsened,
      bakeMs: t1 - t0,
      bytes: skyBent.length + faces.length,
    },
  };
}

/**
 * The same horizon march at one point, for the handful of places the CPU needs
 * an answer the texture cannot give it: how open the roadway is to the sky, how
 * open a facade is, and — for the sun term in the ground bounce — whether the
 * sun clears the buildings from down there at all.
 *
 * Thirty-two numbers rather than a shadow map. It is the same model the field
 * is baked from, so the CPU and the GPU cannot disagree about the shape of the
 * street, which is the class of bug that cost session 1 two of its four days.
 */
export function probeHorizon(occluders, x, y, z) {
  const horizon = new Float64Array(AZIMUTHS);
  let visAcc = 0;

  for (let k = 0; k < AZIMUTHS; k++) {
    const a = ((k + 0.5) / AZIMUTHS) * Math.PI * 2;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    let hmax = 0;
    for (let b = 0; b < occluders.length; b++) {
      const box = occluders[b];
      const hit = rayFootprint(x, z, dx, dz, box);
      if (!hit) continue;
      if (hit.inside) {
        if (box.top > y) hmax = Math.PI / 2;
        continue;
      }
      const dy = box.top - y;
      if (dy <= 0) continue;
      const e = Math.atan2(dy, hit.d);
      if (e > hmax) hmax = e;
    }
    horizon[k] = hmax;
    const sn = Math.sin(hmax);
    visAcc += 1 - sn * sn;
  }

  return { skyVis: visAcc / AZIMUTHS, horizon, azimuths: AZIMUTHS };
}

/**
 * Is the sun above the local horizon, in the azimuth it is actually in?
 *
 * `azimuthRad` is measured the way the bake measures it: atan2(dz, dx) in world
 * XZ, which is not the compass azimuth the time module reports — the caller
 * converts. Softened over a couple of degrees so a surface does not switch
 * between lit and unlit between one frame and the next as the sun creeps.
 */
export function horizonClearance(profile, azimuthRad, elevationRad) {
  const n = profile.azimuths;
  let a = azimuthRad % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  const f = (a / (Math.PI * 2)) * n - 0.5;
  const i0 = Math.floor(f);
  const t = f - i0;
  const h0 = profile.horizon[((i0 % n) + n) % n];
  const h1 = profile.horizon[((i0 + 1) % n + n) % n];
  const h = h0 + (h1 - h0) * t;
  const over = elevationRad - h;
  const soft = 2.5 * (Math.PI / 180);
  return Math.max(0, Math.min(1, over / soft + 0.5));
}

/**
 * The fraction of a facade of height H, across a street of width W, that the
 * sun still reaches — the rest is in the shadow of the building opposite.
 *
 * The bake is deliberately sun-independent, so this correction has to live on
 * the CPU side and be applied to the facade radiance rather than to the field.
 * Without it the bounce is computed as though every facade were lit to the
 * pavement, and at noon in a deep canyon most of one is not.
 *
 * @param sunElevationRad   above the horizon
 * @param deltaAzimuthRad   between the sun and the facade's outward normal
 */
export function sunlitFacadeFraction(sunElevationRad, deltaAzimuthRad, streetWidth, facadeHeight) {
  if (sunElevationRad <= 0) return 0;
  const facing = Math.cos(deltaAzimuthRad);
  if (facing <= 1e-3) return 0;
  // Shadow cast by the opposite building reaches this far up the facade.
  const litHeight = (streetWidth * Math.tan(sunElevationRad)) / facing;
  return Math.max(0, Math.min(1, litHeight / Math.max(facadeHeight, 1e-3)));
}
