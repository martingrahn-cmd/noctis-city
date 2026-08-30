/**
 * post.js — the only module with render(), and the only place a colour is encoded.
 *
 * CONTRACT §5.1. Order matters and is not negotiable:
 *
 *   scene → HDR (linear, half-float, 4× MSAA)
 *         → meter + adaptation                (exposure.js, GPU-side)
 *         → bright pass on EXPOSED values → bloom pyramid
 *         → composite: exposed scene + bloom
 *         → mesopic (Purkinje) shift, per pixel, on absolute luminance
 *         → ACES RRT+ODT fit
 *         → dither
 *         → sRGB encode  ← the single encode in the project
 *
 * The bright pass being downstream of exposure is the whole reason bloom
 * behaves. A threshold on absolute radiance blooms the entire frame at noon and
 * nothing at all at midnight; a threshold on exposed radiance catches whatever
 * is bright *relative to what the viewer is adapted to*, which is what a lens
 * actually does.
 */

import * as THREE from 'three';
import { createFullscreen, FULLSCREEN_VERT } from '../core/fullscreen.js';
import { POST, HDR_CLAMP, SSR, RENDER, TAA } from '../core/constants.js';

/**
 * Halton(2,3) in [0,1)². The standard low-discrepancy jitter sequence: every
 * prefix of it covers the pixel more evenly than a random sequence of the same
 * length, which is the whole reason a 12-frame exponential window resolves an
 * edge instead of wobbling on one.
 */
function halton(index, base) {
  let f = 1;
  let r = 0;
  let i = index;
  while (i > 0) {
    f /= base;
    r += f * (i % base);
    i = Math.floor(i / base);
  }
  return r;
}

const JITTER = [];
for (let i = 1; i <= TAA.jitterSamples; i++) {
  JITTER.push([halton(i, 2) - 0.5, halton(i, 3) - 0.5]);
}

/**
 * Encoding gain for the motion debug view, §5.11. One copy, reported on the
 * api, never duplicated in the tool that decodes it.
 *
 * 64 puts the ±0.008 NDC/frame of a vehicle at 12 m/s at 30 m at 0.5 ± 0.51 of
 * an encoded unit — most of the range, so the quantisation is 6.1e-5 NDC, and
 * clipping only starts at 0.0078 NDC/frame per unit of gain, which is 9.8 px a
 * frame times eight. Both numbers here rather than only the constant, per
 * CONTRACT §9 rule 4.
 */
const MOTION_DEBUG_SCALE = 64;

/**
 * THE TWO CANDIDATES THE SESSION-13 SHIMMER DIAGNOSIS SEPARATED, AND WHICH ONE
 * IT WAS. Here, at the top of the file, with the arithmetic, rather than inline
 * in a shader string where nobody can find them (CONTRACT §9 rule 5).
 *
 * `TAA_JITTER_COMP` — 1 adds `uJitter` to the reprojected NDC before the
 * history fetch. **0 is what shipped through session 12 and it was the bug.**
 *
 *   The resolve reconstructs a fragment's world position from the UN-jittered
 *   NDC (`ndc = 2·vUv − 1 − uJitter`, correct), reprojects it through the
 *   previous un-jittered view-projection, and then used that NDC DIRECTLY as
 *   the history fetch. That is where the SURFACE was. It is not where this
 *   PIXEL's history lives, and those are two different NDCs. The displacement
 *   wanted is `prev − curUnjittered`, added to the pixel's own NDC:
 *
 *       (2·vUv − 1) + [ prevNdc − (2·vUv − 1 − uJitter) ]  =  prevNdc + uJitter
 *
 *   so the shipped expression was short by exactly `uJitter`. In pixels that is
 *   the Halton offset itself — up to half a pixel, A DIFFERENT HALF-PIXEL EVERY
 *   FRAME, cycling through eight. Every pixel of every frame fetched its
 *   history from the wrong place. On a flat surface the neighbours are equal
 *   and it costs nothing; on an edge it is the whole of the error, and the
 *   clamp then does its job on a value that is wrong but entirely plausible —
 *   which is why the accumulation was LOST rather than smeared, exactly as the
 *   note on `setClipGamma` predicts a reprojection failure looks here.
 *
 *   CONTRACT §9's shape with a sub-pixel offset in it: two NDCs, same units,
 *   both plausible, and only one of them is what a history buffer is indexed
 *   by.
 *
 * `TAA_KARIS_SCALE` — the luminance gain inside the blend weights. 1 is what
 * shipped and IS STILL WHAT SHIPS; 0 makes the blend the plain exponential
 * average its feedback constant is derived for.
 *
 *   `w = 1/(1 + L)` is the anti-firefly weighting and it is correct when it
 *   averages N samples OF EQUAL STATUS. These two are not of equal status, and
 *   L here is ABSOLUTE radiance (§5.3) rather than exposed. A window at
 *   8 000 cd/m² against a wall at 1: when the current sample MISSES the window,
 *   `wc = 0.08/1 = 0.08` against `wh = 0.92/8001 = 1.15e-4`, so the history
 *   keeps 0.14% of the result and the pixel snaps dark in one frame; when the
 *   sample HITS it the history keeps 96%. On any high-contrast pair the filter
 *   is a min-picker and its stated 12-frame window is not its behaviour.
 *
 *   That is an argument, and the measurement disagrees with how much it
 *   matters. Locked camera, paused clock, `filmshot --static`, two independent
 *   runs agreeing to 0.02 of a percentage point, fraction of pixels whose sRGB
 *   luma ranges 8 code values or more over a 12-frame window:
 *
 *       base                                   4.729 %
 *       clamp widened to 8 sigma               4.630 %   −0.10 pp
 *       weighting flattened                    4.517 %   −0.21 pp
 *       JITTER TERM RESTORED                   0.668 %   −4.06 pp
 *       both                                   0.616 %   −4.11 pp
 *       jitter off  (negative control)         0.000 %   max range 0 cv
 *       accumulation off (positive control)    3.441 %   the raw aliasing
 *
 *   So the weighting is worth 0.05 pp ON TOP OF the fix and the fix is worth
 *   4.06. It is left alone: it has a real anti-firefly job, changing it moves
 *   every resolved pixel and therefore every look assertion, and 0.05 pp is not
 *   a reason to move a look. The arm stays (`filmshot --static
 *   --arms=base,flatweight`) so the next session can disagree with the measurement rather
 *   than with the taste — which is the only kind of disagreement this project
 *   accepts about a number.
 */
const TAA_JITTER_COMP = 1;
const TAA_KARIS_SCALE = 1;

export function createPost(options = {}) {
  const cfg = { ...POST, ...options };

  let fs = null;
  let hdrRT = null;
  let bloom = [];
  let prefilterMat = null;
  let downMat = null;
  let upMat = null;
  let compositeMat = null;
  let lastDt = 1 / 60;
  let renderScale = 1;

  /**
   * The temporal accumulation, ping-ponged. CONTRACT §5.10.
   *
   * rgb is the resolved frame; alpha is the *current* frame's linear view depth,
   * carried through unblended. Blending a depth is meaningless — halfway between
   * two surfaces is on neither of them — and it is exactly the mistake 4× MSAA
   * was making with this channel before TAA replaced it.
   */
  let taaRT = [null, null];
  let taaMat = null;
  let taaIndex = 0;
  /** False until a history exists that describes this buffer at this size. */
  let taaHistory = false;
  let frameIndex = 0;
  /** Internal render resolution — fixed pixel count, display aspect. */
  let internal = { width: RENDER.internalWidth, height: RENDER.internalHeight };
  const taaPrevViewProj = new THREE.Matrix4();
  const jitterNdc = new THREE.Vector2();
  /** Hoisted: render() runs every frame and must not allocate. */
  const scratchSize = new THREE.Vector2();
  /** Draw calls the scene pass cost, separated from the post chain's fixed cost. */
  let sceneCalls = 0;
  /** 'motion' replaces the composite with the motion attachment. §5.11. */
  let debugView = null;
  let motionDebugMat = null;
  /**
   * Multiplier on the Halton offset. 1 always, except under the static-camera
   * shimmer probe's negative-control arm — see `setJitterScale` on the api.
   */
  let jitterScale = 1;

  /**
   * The reflection source, ping-ponged.
   *
   * Two half-resolution RGBA16F targets with mipmaps: rgb is the frame's raw
   * HDR radiance, a is linear view depth in metres (written by the material
   * injection in lights.js and by the sky background). The forward pass cannot
   * read the target it is writing, so it reads the one written last frame.
   *
   * Half resolution because the reflection of a 1.5 m window across thirty
   * metres of wet road is not a sharp image, and because at the gate's
   * 3200×1800 capture a full-resolution pair would be 92 MB of texture to
   * write and read every frame for a term that is a correction to the
   * environment map.
   */
  let ssrRT = [null, null];
  let ssrCopyMat = null;
  let ssrIndex = 0;
  let ssrMaxMip = 0;
  /** Null until the first frame has been drawn — SSR is simply off until then. */
  let ssrReady = null;
  const ssrViewProj = [new THREE.Matrix4(), new THREE.Matrix4()];
  const ssrView = [new THREE.Matrix4(), new THREE.Matrix4()];

  const EXPOSURE_GLSL = /* glsl */ `
uniform sampler2D uAdapted;
uniform vec4 uExposureParams;   // K, adaptStrength, anchorEV, unused
uniform vec2 uExposureClamp;    // minEV, maxEV

float noctisExposure() {
  float logL = texture2D(uAdapted, vec2(0.5)).r;
  float L = exp(logL);
  float ev = log2(max(L, 1e-6) * 100.0 / uExposureParams.x);
  // Partial adaptation. CONTRACT §5.4 — one law, no per-time-of-day authoring.
  ev = uExposureParams.z + (ev - uExposureParams.z) * uExposureParams.y;
  ev = clamp(ev, uExposureClamp.x, uExposureClamp.y);
  return 1.0 / (1.2 * exp2(ev));
}
`;

  /**
   * @param motion  Attach a second colour target for motion vectors. §5.11.
   *
   *   RG16F at the internal resolution: 2560 × 1440 × 2 channels × 2 bytes =
   *   14 745 600 B, which is 14.06 MiB — the unit `targetBytes()` is divided by
   *   downstream — so the total goes 116.3 → 130.4 MB against a 192 MB ceiling,
   *   not the 131.0 the decimal arithmetic gives. Two channels and not four because a screen
   *   -space displacement has two components and half float because the
   *   quantity is an NDC delta in [−2, 2] — half-float relative precision at 1
   *   is 4.9e-4, which at 1440 lines is 0.35 of a pixel of reprojection error
   *   in the worst case and under a hundredth of a pixel at the ±18 px/frame
   *   this exists to carry.
   *
   *   three gives every MRT attachment the same descriptor, so the second one's
   *   format is overridden after construction. `setupFrameBufferTexture` reads
   *   `texture.format` and `texture.type` per attachment, so this is honoured
   *   rather than ignored — verified by reading three's own source rather than
   *   assumed, which is the §9 habit applied to somebody else's internals.
   */
  function makeRT(w, h, { msaa = 0, depth = false, mipmaps = false, motion = false } = {}) {
    const rt = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      count: motion ? 2 : 1,
      // Mipmaps are how the reflection gets its roughness blur: one textureLod
      // at a level chosen from the surface's roughness, rather than a second
      // blur chain. three regenerates them at the end of the pass that writes
      // the target, which is one glGenerateMipmap on a quarter-area texture.
      minFilter: mipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: depth,
      stencilBuffer: false,
      generateMipmaps: mipmaps,
      samples: msaa,
      colorSpace: THREE.LinearSRGBColorSpace,
    });
    if (motion) {
      const m = rt.textures[1];
      m.format = THREE.RGFormat;
      m.type = THREE.HalfFloatType;
      m.minFilter = THREE.NearestFilter;
      m.magFilter = THREE.NearestFilter;
      m.generateMipmaps = false;
      m.name = 'noctis:motion';
    }
    return rt;
  }

  /**
   * The internal render resolution for a given drawing buffer.
   *
   * A fixed *pixel count* rather than a fixed width and height, because the
   * buffer has to match the display's aspect ratio or the image is stretched.
   * At 16:9 this is exactly 2560×1440; at 16:10 it is 2416×1510, which is the
   * same amount of shading work and the same budget.
   *
   * Never larger than the drawing buffer: upscaling is the point, and a fixed
   * internal resolution that quietly *super*sampled a small window would be a
   * much more expensive decision arrived at by accident.
   */
  function internalSize(bufferW, bufferH) {
    const aspect = bufferW / Math.max(1, bufferH);
    const target = RENDER.pixels * renderScale * renderScale;
    let h = Math.round(Math.sqrt(target / aspect));
    let w = Math.round(h * aspect);
    if (RENDER.neverExceedNative && w * h > bufferW * bufferH) {
      w = bufferW;
      h = bufferH;
    }
    // Even dimensions, so the half-resolution SSR buffer and the eight bloom
    // mips divide without a half-texel drift creeping in at each level.
    return { width: Math.max(2, w - (w % 2)), height: Math.max(2, h - (h % 2)) };
  }

  function resize(ctx) {
    const size = ctx.renderer.getDrawingBufferSize(new THREE.Vector2());
    internal = internalSize(Math.max(1, size.x), Math.max(1, size.y));
    const w = internal.width;
    const h = internal.height;

    if (hdrRT) hdrRT.dispose();
    // No MSAA: TAA is the antialiasing now, and multisample resolve averaged the
    // alpha channel, which is a depth. CONTRACT §5.10.
    //
    // Two attachments since §5.11: radiance-and-depth, and the motion vector.
    hdrRT = makeRT(w, h, { msaa: 0, depth: true, motion: true });

    for (const rt of taaRT) if (rt) rt.dispose();
    taaRT = [makeRT(w, h), makeRT(w, h)];
    taaHistory = false;

    for (const rt of bloom) rt.dispose();
    bloom = [];
    let bw = Math.max(1, w >> 1);
    let bh = Math.max(1, h >> 1);
    for (let i = 0; i < cfg.bloomMips; i++) {
      bloom.push(makeRT(bw, bh));
      bw = Math.max(1, bw >> 1);
      bh = Math.max(1, bh >> 1);
    }

    const sw = Math.max(1, Math.floor(w * SSR.sourceScale));
    const sh = Math.max(1, Math.floor(h * SSR.sourceScale));
    for (const rt of ssrRT) if (rt) rt.dispose();
    ssrRT = [makeRT(sw, sh, { mipmaps: true }), makeRT(sw, sh, { mipmaps: true })];
    ssrMaxMip = Math.floor(Math.log2(Math.max(sw, sh)));
    // Every buffer just changed identity; nothing from before the resize
    // describes this frame.
    ssrReady = null;

    // Anything that divides gl_FragCoord by a screen size needs this one, not
    // the drawing buffer's. `lights` does, for the froxel lookup.
    ctx.emit('post:internal', { width: w, height: h });
  }

  return {
    name: 'post',
    needs: ['exposure'],

    init(ctx) {
      fs = createFullscreen();

      const exposure = ctx.get('exposure');
      const exposureUniforms = exposure.uniforms;

      prefilterMat = new THREE.ShaderMaterial({
        uniforms: {
          uScene: { value: null },
          uTexelSize: { value: new THREE.Vector2() },
          uThreshold: { value: new THREE.Vector2(cfg.bloomThreshold, cfg.bloomSoftKnee) },
          ...exposureUniforms,
        },
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: `${EXPOSURE_GLSL}
uniform sampler2D uScene;
uniform vec2 uTexelSize;
uniform vec2 uThreshold;
varying vec2 vUv;

float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
  float e = noctisExposure();
  vec2 o = uTexelSize;
  vec3 s0 = texture2D(uScene, vUv + vec2(-o.x, -o.y)).rgb * e;
  vec3 s1 = texture2D(uScene, vUv + vec2( o.x, -o.y)).rgb * e;
  vec3 s2 = texture2D(uScene, vUv + vec2(-o.x,  o.y)).rgb * e;
  vec3 s3 = texture2D(uScene, vUv + vec2( o.x,  o.y)).rgb * e;

  // Karis average: weight each tap by 1/(1+luma) before averaging. Without it,
  // one sub-pixel specular hit becomes a permanent flickering star.
  float w0 = 1.0 / (1.0 + lum(s0));
  float w1 = 1.0 / (1.0 + lum(s1));
  float w2 = 1.0 / (1.0 + lum(s2));
  float w3 = 1.0 / (1.0 + lum(s3));
  vec3 c = (s0 * w0 + s1 * w1 + s2 * w2 + s3 * w3) / max(w0 + w1 + w2 + w3, 1e-5);

  // Soft-knee threshold, on exposed values.
  float threshold = uThreshold.x;
  float knee = threshold * uThreshold.y + 1e-5;
  float br = max(c.r, max(c.g, c.b));
  float rq = clamp(br - threshold + knee, 0.0, 2.0 * knee);
  rq = rq * rq / (4.0 * knee + 1e-5);
  c *= max(rq, br - threshold) / max(br, 1e-5);

  gl_FragColor = vec4(max(c, vec3(0.0)), 1.0);
}`,
        depthTest: false,
        depthWrite: false,
      });

      downMat = new THREE.ShaderMaterial({
        uniforms: { uSrc: { value: null }, uTexelSize: { value: new THREE.Vector2() } },
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: /* glsl */ `
uniform sampler2D uSrc;
uniform vec2 uTexelSize;
varying vec2 vUv;
void main() {
  vec2 t = uTexelSize;
  vec3 A = texture2D(uSrc, vUv + t * vec2(-2.0,  2.0)).rgb;
  vec3 B = texture2D(uSrc, vUv + t * vec2( 0.0,  2.0)).rgb;
  vec3 C = texture2D(uSrc, vUv + t * vec2( 2.0,  2.0)).rgb;
  vec3 D = texture2D(uSrc, vUv + t * vec2(-1.0,  1.0)).rgb;
  vec3 E = texture2D(uSrc, vUv + t * vec2( 1.0,  1.0)).rgb;
  vec3 F = texture2D(uSrc, vUv + t * vec2(-2.0,  0.0)).rgb;
  vec3 G = texture2D(uSrc, vUv).rgb;
  vec3 H = texture2D(uSrc, vUv + t * vec2( 2.0,  0.0)).rgb;
  vec3 I = texture2D(uSrc, vUv + t * vec2(-1.0, -1.0)).rgb;
  vec3 J = texture2D(uSrc, vUv + t * vec2( 1.0, -1.0)).rgb;
  vec3 K = texture2D(uSrc, vUv + t * vec2(-2.0, -2.0)).rgb;
  vec3 L = texture2D(uSrc, vUv + t * vec2( 0.0, -2.0)).rgb;
  vec3 M = texture2D(uSrc, vUv + t * vec2( 2.0, -2.0)).rgb;

  vec3 o = (D + E + I + J) * 0.125;
  o += (A + B + G + F) * 0.03125;
  o += (B + C + H + G) * 0.03125;
  o += (F + G + L + K) * 0.03125;
  o += (G + H + M + L) * 0.03125;
  gl_FragColor = vec4(o, 1.0);
}`,
        depthTest: false,
        depthWrite: false,
      });

      upMat = new THREE.ShaderMaterial({
        uniforms: {
          uSrc: { value: null },
          uTexelSize: { value: new THREE.Vector2() },
          uRadius: { value: 1.0 },
        },
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: /* glsl */ `
uniform sampler2D uSrc;
uniform vec2 uTexelSize;
uniform float uRadius;
varying vec2 vUv;
void main() {
  vec4 d = vec4(uTexelSize.x, uTexelSize.y, -uTexelSize.x, 0.0) * uRadius;
  vec3 s  = texture2D(uSrc, vUv - d.xy).rgb;
  s += texture2D(uSrc, vUv - d.wy).rgb * 2.0;
  s += texture2D(uSrc, vUv - d.zy).rgb;
  s += texture2D(uSrc, vUv + d.zw).rgb * 2.0;
  s += texture2D(uSrc, vUv       ).rgb * 4.0;
  s += texture2D(uSrc, vUv + d.xw).rgb * 2.0;
  s += texture2D(uSrc, vUv + d.zy).rgb;
  s += texture2D(uSrc, vUv + d.wy).rgb * 2.0;
  s += texture2D(uSrc, vUv + d.xy).rgb;
  gl_FragColor = vec4(s * 0.0625, 1.0);
}`,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      /**
       * The HDR frame into the reflection source, at half resolution.
       *
       * Not a box filter. Each output texel takes the *brightest* of its four
       * inputs and that input's depth, so a lit window one pixel wide survives
       * the downsample instead of being averaged into the wall beside it — and
       * the colour and the depth always describe the same fragment, which a box
       * filter cannot promise. The bias is toward emitters, which is precisely
       * what a wet road at night is reflecting; it very slightly enlarges them
       * in the depth buffer, and therefore in their own reflections.
       */
      ssrCopyMat = new THREE.ShaderMaterial({
        uniforms: { uScene: { value: null }, uTexelSize: { value: new THREE.Vector2() } },
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: /* glsl */ `
uniform sampler2D uScene;
uniform vec2 uTexelSize;
varying vec2 vUv;
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
  vec2 o = uTexelSize * 0.5;
  vec4 a = texture2D(uScene, vUv + vec2(-o.x, -o.y));
  vec4 b = texture2D(uScene, vUv + vec2( o.x, -o.y));
  vec4 c = texture2D(uScene, vUv + vec2(-o.x,  o.y));
  vec4 d = texture2D(uScene, vUv + vec2( o.x,  o.y));
  vec4 best = a;
  if (lum(b.rgb) > lum(best.rgb)) best = b;
  if (lum(c.rgb) > lum(best.rgb)) best = c;
  if (lum(d.rgb) > lum(best.rgb)) best = d;
  gl_FragColor = best;
}`,
        depthTest: false,
        depthWrite: false,
      });

      /**
       * The temporal resolve. CONTRACT §5.10.
       *
       * Three things happen here and they are not separable:
       *
       * 1. REPROJECTION, IN TWO PARTS SINCE §5.11. The fragment's linear view
       *    depth is already in the alpha of the HDR target (§5.8), so its world
       *    position follows from the un-jittered NDC and the camera basis, and
       *    where the CAMERA would have seen that world position last frame
       *    follows from the previous frame's view-projection. That was the whole
       *    motion field while every object was static.
       *
       *    It is no longer the whole field, and this comment predicted it:
       *    "when session 5 adds something that moves, this is the function that
       *    has to learn about it". The second part is the OBJECT's own
       *    displacement, which the scene pass writes into the motion attachment
       *    and which is exactly zero for everything static — so a world with
       *    nothing moving in it reprojects bit for bit as it did before. The
       *    two are added, not chosen between: a moving object seen from a
       *    moving camera needs both, and an engine that picks one is right in
       *    one of the two cases nobody tests.
       *
       * 2. NEIGHBOURHOOD CLIPPING. History that lies outside the colour
       *    distribution of the current 3×3 is clipped into it, in YCoCg because
       *    the luma/chroma axes are where the distribution actually is — an RGB
       *    box around a saturated sign is mostly empty and clips nothing. This
       *    is what stops a disoccluded edge from smearing.
       *
       * 3. WEIGHTED BLENDING. Values in this buffer span 1e-3 to 6e4 and a
       *    straight average of that is owned by whichever pixel caught the sun,
       *    so each sample is weighted by 1/(1+luma) — the Karis weighting, the
       *    difference between antialiasing and a permanent flickering star on
       *    every specular highlight.
       *
       *    A WEIGHTED AVERAGE, not the reversible tonemap c/(1+luma) that the
       *    published versions of this use, and the reason is that those buffers
       *    are pre-exposed and this one is absolute (§5.3). Inverting that
       *    tonemap divides by 1 − luma(c/(1+L)) = 1/(1+L), which for a noon sky
       *    at 5000 cd/m² is 2.0e-4 — while half-float relative precision at that
       *    magnitude is 4.9e-4. The reconstruction divides by a quantity smaller
       *    than its own error bar, and the measured result was a noon frame
       *    covered in noise, worst in the sky, absent at midnight where L is of
       *    order one. A weighted average has no such divide.
       */
      taaMat = new THREE.ShaderMaterial({
        uniforms: {
          uCurrent: { value: null },
          uHistory: { value: null },
          uMotion: { value: null },
          uTexel: { value: new THREE.Vector2() },
          uJitter: { value: new THREE.Vector2() },
          uPrevViewProj: { value: new THREE.Matrix4() },
          uInvView: { value: new THREE.Matrix4() },
          uTanHalf: { value: new THREE.Vector2() },
          uFeedback: { value: TAA.feedback },
          uHistoryValid: { value: 0 },
          uClipGamma: { value: TAA.clipGamma },
          /**
           * The two arms of the static-camera shimmer A/B. Both are set below
           * to the value the diagnosis chose; the OTHER value of each restores
           * the behaviour that was measured, so the run that named the cause is
           * one command away for ever (`filmshot --static`). Nothing but that
           * tool moves them. See TAA_JITTER_COMP / TAA_KARIS_SCALE.
           */
          uJitterComp: { value: TAA_JITTER_COMP },
          uKarisScale: { value: TAA_KARIS_SCALE },
        },
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: /* glsl */ `
uniform sampler2D uCurrent;
uniform sampler2D uHistory;
uniform sampler2D uMotion;
uniform vec2 uTexel;
uniform vec2 uJitter;
uniform mat4 uPrevViewProj;
uniform mat4 uInvView;
uniform vec2 uTanHalf;
uniform float uFeedback;
uniform float uHistoryValid;
uniform float uClipGamma;
uniform float uJitterComp;
uniform float uKarisScale;
varying vec2 vUv;

float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 rgb2ycocg(vec3 c) {
  return vec3(0.25 * c.r + 0.5 * c.g + 0.25 * c.b,
              0.5  * c.r - 0.5 * c.b,
             -0.25 * c.r + 0.5 * c.g - 0.25 * c.b);
}
vec3 ycocg2rgb(vec3 c) {
  float t = c.x - c.z;
  return vec3(t + c.y, c.x + c.z, t - c.y);
}

void main() {
  vec4 cur = texture2D(uCurrent, vUv);

  // --- where was this fragment last frame ---
  float depth = cur.a;
  vec2 ndc = (vUv * 2.0 - 1.0) - uJitter;
  vec3 viewPos = vec3(ndc.x * uTanHalf.x * depth, ndc.y * uTanHalf.y * depth, -depth);
  vec3 world = (uInvView * vec4(viewPos, 1.0)).xyz;
  vec4 prevClip = uPrevViewProj * vec4(world, 1.0);
  /**
   * Camera reprojection, then the object's own motion on top of it. §5.11.
   *
   * The attachment holds prevNdc(where this surface WAS) minus prevNdc(where
   * it IS), both through the SAME previous view-projection — so the camera's
   * contribution cancels inside it and what is left is the object's alone. Add
   * it to the camera term and the sum is where this fragment's surface actually
   * was on screen last frame.
   *
   * Zero for every static surface, arithmetically rather than by a branch: the
   * scene pass computes it as a difference of two identical expressions when
   * the object has not moved. So a world in which nothing moves reprojects
   * exactly as it did before this attachment existed.
   *
   * The FRAMES are not bit-identical even so, and the reason is not this line:
   * adding a second fragment output recompiles every patched material, and the
   * driver's codegen is not obliged to produce the same last digit. Measured
   * drift across the four look frames is at most 0.0003 in mean luma. See
   * CONTRACT §5.11.
   */
  vec2 motion = texture2D(uMotion, vUv).rg;
  /**
   * The + uJitter * uJitterComp term: the history buffer is indexed by PIXEL,
   * and prevClip is where the SURFACE was. Those are two different NDCs and the
   * difference between them is exactly this frame's jitter. The derivation is
   * at TAA_JITTER_COMP at the top of this file; uJitterComp = 0 restores what
   * shipped through session 12, which is the A/B arm and nothing else.
   */
  vec2 prevUv = (prevClip.xy / max(prevClip.w, 1e-4) + motion + uJitter * uJitterComp) * 0.5 + 0.5;

  // Off the edge of the previous frame, or behind its camera: there is no
  // history for this pixel and inventing one is what ghosting is.
  float valid = uHistoryValid
    * step(0.0, prevClip.w)
    * step(0.0, prevUv.x) * step(prevUv.x, 1.0)
    * step(0.0, prevUv.y) * step(prevUv.y, 1.0);

  // --- the colour distribution this pixel is allowed to be in ---
  // In YCoCg of the raw linear radiance. Not tonemapped: an exact linear
  // transform round-trips, and sigma already scales with the local mean, so the
  // window is relative without anything being compressed into it.
  vec3 m1 = vec3(0.0);
  vec3 m2 = vec3(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec3 s = rgb2ycocg(texture2D(uCurrent, vUv + vec2(float(x), float(y)) * uTexel).rgb);
      m1 += s;
      m2 += s * s;
    }
  }
  vec3 mean = m1 / 9.0;
  vec3 sigma = sqrt(max(m2 / 9.0 - mean * mean, vec3(0.0)));
  vec3 lo = mean - uClipGamma * sigma;
  vec3 hi = mean + uClipGamma * sigma;

  vec3 hist = ycocg2rgb(clamp(rgb2ycocg(texture2D(uHistory, prevUv).rgb), lo, hi));
  hist = max(hist, vec3(0.0));

  // Karis-weighted average. On a static camera cur and hist agree, the weights
  // are equal and this is an unbiased mean — which is why the gate's captures
  // converge on the supersampled image rather than on a darkened version of it.
  /**
   * uKarisScale is the luminance gain in the weights. At 1 this is the shipped
   * anti-firefly weighting; at 0 both weights are 1 and this is the plain
   * exponential average that TAA.feedback = 0.92 is derived for. See
   * TAA_KARIS_SCALE at the top of this file for why the weighting, applied to
   * ABSOLUTE radiance across a pair of unequal status, is a min-picker rather
   * than an average.
   */
  float f = uFeedback * valid;
  float wc = (1.0 - f) / (1.0 + lum(cur.rgb) * uKarisScale);
  float wh = f / (1.0 + lum(hist) * uKarisScale);
  vec3 rgb = (cur.rgb * wc + hist * wh) / max(wc + wh, 1e-8);

  // Alpha is a depth, not a colour. It is the current frame's, unblended.
  gl_FragColor = vec4(max(rgb, vec3(0.0)), cur.a);
}`,
        depthTest: false,
        depthWrite: false,
      });

      /**
       * The motion attachment, made visible. §5.11.
       *
       * NOT A READBACK, AND THAT IS THE WHOLE DESIGN. The obvious way to check
       * a buffer is `readRenderTargetPixels`, and there are two reasons it is
       * not what happens here. CONTRACT §5.4 forbids readback in a module and
       * `parsecheck` machine-checks it. And three's own readback rejects
       * anything that is not RGBA — so a readback of an RG16F attachment
       * returns a zero-filled buffer and logs a console error, which is a
       * verification that reports "no motion anywhere" whether or not there is
       * any. It was written that way first and it passed the static case
       * vacuously, which is CONTRACT §6's lesson in a new place: a check that
       * did not run is not a check that passed.
       *
       * So the buffer is encoded into the frame instead and read out of a PNG
       * by the same path every other gate already uses. The encoding is
       * 0.5 + motion · MOTION_DEBUG_SCALE per channel, and the scale is
       * reported on the api rather than duplicated in the tool — a constant
       * authored in one file and consumed in another is §9 rule 3, and the way
       * to keep it honest is to have one copy.
       *
       * Resolution: 1/255 of an encoded unit is 1/(255 · 64) = 6.1e-5 NDC,
       * which at 1440 lines is 0.044 of a pixel. The displacement this exists
       * to carry is ten pixels a frame. There is no encode of the output colour
       * space here and there must not be: the bytes in the screenshot have to
       * be the bytes that were written.
       */
      motionDebugMat = new THREE.ShaderMaterial({
        uniforms: {
          uMotion: { value: null },
          uScale: { value: MOTION_DEBUG_SCALE },
        },
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: /* glsl */ `
uniform sampler2D uMotion;
uniform float uScale;
varying vec2 vUv;
void main() {
  vec2 m = texture2D(uMotion, vUv).rg;
  gl_FragColor = vec4(0.5 + m.x * uScale, 0.5 + m.y * uScale, 0.5, 1.0);
}`,
        depthTest: false,
        depthWrite: false,
      });

      compositeMat = new THREE.ShaderMaterial({
        uniforms: {
          uScene: { value: null },
          uSceneTexel: { value: new THREE.Vector2() },
          uUpscaling: { value: 0 },
          uBloom: { value: null },
          uGlare: { value: null },
          uBloomStrength: { value: cfg.bloomStrength },
          uGlareStrength: { value: cfg.glareStrength },
          uPurkinje: { value: new THREE.Vector3(cfg.purkinjeStrength, cfg.purkinjeLow, cfg.purkinjeHigh) },
          /**
           * The rod chromaticity is read by TWO terms — the Purkinje mix and
           * the black floor — out of one uniform, because two copies of a
           * colour in one shader is §9.1 with the compiler's help.
           */
          uRodChroma: { value: new THREE.Vector3(...POST.rodChroma) },
          /** LOOK.md §0's floor, as a display-linear LUMINANCE. */
          uBlackFloorY: { value: POST.blackFloor },
          ...exposureUniforms,
        },
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: `${EXPOSURE_GLSL}
uniform sampler2D uScene;
uniform vec2 uSceneTexel;
uniform float uUpscaling;
uniform sampler2D uBloom;
uniform sampler2D uGlare;
uniform float uBloomStrength;
uniform float uGlareStrength;
uniform vec3 uPurkinje;
uniform vec3 uRodChroma;
uniform float uBlackFloorY;
varying vec2 vUv;

float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

/**
 * The upscale, and the only place the internal resolution meets the display's.
 *
 * Catmull-Rom rather than the bilinear the sampler would give for free: a
 * temporally accumulated image is sharp, and stretching it bilinearly throws
 * away exactly the detail TAA spent twelve frames recovering. The 9-tap form is
 * factored into 5 bilinear fetches — the standard trick — so it costs four extra
 * fetches on one fullscreen pass and nothing anywhere else.
 *
 * At a 1:1 scale the output and input grids coincide, the fractional offset is
 * zero, the outer weights vanish and this is exactly a single centre tap. So the
 * gate, which captures at the internal resolution, measures no filtering at all.
 */
vec3 catmullRom(sampler2D tex, vec2 uv, vec2 texel) {
  vec2 size = 1.0 / texel;
  vec2 samplePos = uv * size;
  vec2 texPos1 = floor(samplePos - 0.5) + 0.5;
  vec2 f = samplePos - texPos1;

  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);

  vec2 w12 = w1 + w2;
  vec2 offset12 = w2 / max(w12, vec2(1e-5));

  vec2 texPos0 = (texPos1 - 1.0) * texel;
  vec2 texPos3 = (texPos1 + 2.0) * texel;
  vec2 texPos12 = (texPos1 + offset12) * texel;

  vec3 r = vec3(0.0);
  r += texture2D(tex, vec2(texPos12.x, texPos0.y)).rgb  * w12.x * w0.y;
  r += texture2D(tex, vec2(texPos0.x,  texPos12.y)).rgb * w0.x  * w12.y;
  r += texture2D(tex, vec2(texPos12.x, texPos12.y)).rgb * w12.x * w12.y;
  r += texture2D(tex, vec2(texPos3.x,  texPos12.y)).rgb * w3.x  * w12.y;
  r += texture2D(tex, vec2(texPos12.x, texPos3.y)).rgb  * w12.x * w3.y;
  // Catmull-Rom overshoots into negatives around a hard edge, and a negative
  // radiance becomes a NaN in the Purkinje term two lines later.
  return max(r, vec3(0.0));
}

// ACES RRT+ODT, Stephen Hill's fit, with the sRGB↔AP1 matrices rather than the
// cheap single-curve approximation. The difference shows on exactly what this
// project is full of: saturated emitters, which the cheap fit hue-shifts.
const mat3 ACES_IN = mat3(
  0.59719, 0.07600, 0.02840,
  0.35458, 0.90834, 0.13383,
  0.04823, 0.01566, 0.83777);
const mat3 ACES_OUT = mat3(
   1.60475, -0.10208, -0.00327,
  -0.53108,  1.10813, -0.07276,
  -0.07367, -0.00605,  1.07602);

vec3 rrtOdtFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}

/**
 * The fit's numerator is negative below v = 0.00325, so a straight
 * clamp(rrtOdtFit(v), 0, 1) maps everything darker than that to exact zero —
 * a hard black point three stops above where it belongs. On a daylit frame it
 * is invisible; on a night street it turns every wall between the windows into
 * a hole. Re-anchoring the curve at its own value for v = 0 costs 3.8e-4 in the
 * highlights, which is nothing, and restores a monotonic toe.
 */
const float ACES_TOE = 0.000090537 / 0.238081;

vec3 acesFitted(vec3 c) {
  c = ACES_IN * c;
  c = (rrtOdtFit(c) + ACES_TOE) / (1.0 + ACES_TOE);
  c = ACES_OUT * c;
  /**
   * THE BLACK FLOOR — LOOK.md section 0, SESSION 55. The same shape as the toe
   * one line up and for a different reason: the toe repairs the FIT, this
   * repairs the PICTURE. constants.js -> POST.blackFloor carries the whole
   * derivation, the sweep it came from and the two gates that bound it.
   *
   * APPLIED HERE, IN DISPLAY-LINEAR sRGB, AND NOT IN AP1 WITH THE TOE. The
   * floor's magnitude is derived from what an 8-bit sRGB code value can carry,
   * so it belongs in the space that code value lives in: the number in
   * constants.js is then the delivered black point exactly, and a reader can
   * check it with an sRGB encode and no matrices.
   *
   * IT TAKES THE PIXEL'S OWN HUE WHERE THE PIXEL HAS ONE. A flat floor was
   * built first and turned warmth:dusk RED — any additive lift desaturates a
   * dark pixel, because sRGB is concave, and dusk has more dark area than noon.
   * Light on a surface comes back with the surface's colour; a veil that
   * desaturates is a LENS and this renderer already has one. The blend is
   * y/(y+f): zero at true black, a half at the floor's own level, one above it,
   * and the floor's magnitude is the only scale in that ramp.
   */
  float fy = max(lum(c), 0.0);
  vec3 tint = fy > 1e-7 ? max(c, vec3(0.0)) / fy : uRodChroma;
  vec3 f = uBlackFloorY * mix(uRodChroma, tint, fy / (fy + uBlackFloorY));
  c = (c + f) / (1.0 + uBlackFloorY);
  return clamp(c, 0.0, 1.0);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec3 hdr = uUpscaling > 0.5
    ? catmullRom(uScene, vUv, uSceneTexel)
    : texture2D(uScene, vUv).rgb;
  float e = noctisExposure();
  vec3 c = hdr * e;
  c += texture2D(uBloom, vUv).rgb * uBloomStrength;

  // Veiling glare. A real lens scatters a small fraction of everything it is
  // looking at uniformly across the frame, which is why no photograph of a
  // neon street has a true black in it. Taken from the coarsest bloom mip, so
  // it is the low-frequency energy of the bright sources and nothing else —
  // and so it costs one texture fetch rather than a second blur chain.
  c += texture2D(uGlare, vUv).rgb * uGlareStrength;

  // Mesopic vision. Rods take over below a few cd/m², and they are blind to
  // red and biased blue. Keyed on ABSOLUTE per-pixel luminance, not on the
  // frame average, so the asphalt goes blue while the sign above it stays
  // saturated orange — which is what a night street actually looks like.
  float absL = lum(hdr);
  float purk = smoothstep(uPurkinje.z, uPurkinje.y, absL) * uPurkinje.x;
  if (purk > 0.0) {
    float rod = dot(c, vec3(0.08, 0.62, 0.30));
    c = mix(c, rod * uRodChroma, purk);
  }

  c = acesFitted(max(c, vec3(0.0)));

  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>

  // Triangular-PDF dither at one LSB, after encoding. Half-float HDR into an
  // 8-bit framebuffer bands visibly in a sky gradient, and a sky gradient is
  // most of three of these four frames.
  float d = hash12(gl_FragCoord.xy) + hash12(gl_FragCoord.yx + 17.0) - 1.0;
  gl_FragColor.rgb += d * (1.0 / 255.0);
}`,
        depthTest: false,
        depthWrite: false,
      });

      resize(ctx);
      ctx.on('resize', () => resize(ctx));
      /**
       * A discontinuous time change rebuilds the sky and every radiance derived
       * from it, so the previous frame describes a world that no longer exists.
       * Accumulating across it would ghost noon into midnight for a dozen frames
       * — which is exactly what a capture would then record.
       */
      ctx.on('timeOfDay', (p) => {
        if (p && p.discontinuous) taaHistory = false;
      });

      return {
        get hdrTexture() {
          return hdrRT.texture;
        },
        /** The scene pass's own draw calls, excluding the post chain. */
        get sceneDrawCalls() {
          return sceneCalls;
        },
        /** Internal render resolution, which is not the drawing buffer. §5.10. */
        get internalSize() {
          return { width: internal.width, height: internal.height };
        },
        /**
         * Bytes of render target this module owns, exactly rather than
         * estimated: every allocation here is one we made and can measure.
         * `perfcheck` asserts the total against `ceilings.textureMemoryMB`, and a
         * ceiling on a number nobody computes is not a ceiling.
         */
        targetBytes() {
          const rt = (t) => (t ? t.width * t.height * 8 : 0);
          let n = rt(hdrRT) + rt(taaRT[0]) + rt(taaRT[1]);
          // The motion attachment is RG16F — two channels, not four. Counted
          // at its own width because an MRT attachment that is assumed to cost
          // what its neighbour costs is the §9 mistake with a texture in it,
          // and session 4 already made the array-texture version of it.
          if (hdrRT && hdrRT.textures.length > 1) n += hdrRT.width * hdrRT.height * 4;
          for (const b of bloom) n += rt(b);
          // Mipmapped, so 4/3 of the base level.
          for (const s of ssrRT) n += Math.round(rt(s) * 4 / 3);
          return n;
        },
        /**
         * ═══════════════════════════════════════════════════════════════════
         * THE THREE BUFFERS THE COMPOSITE ADDS TOGETHER. SESSION 55, ITEM 1.
         * ═══════════════════════════════════════════════════════════════════
         *
         * Four content increases across ten sessions did not answer *"it is no
         * fun when you cannot see anything"*, and session 54 added ~500 lights
         * and moved `distinct:midnight|dusk` by 0.00000. Either something
         * downstream compresses the picture after the light has been counted,
         * or the light never reaches the surface — and no frame can tell those
         * apart, because both deliver the same dark pixel. Answering it means
         * reading the RADIANCE, in cd/m², before exposure touches it.
         *
         * WHY THIS HANDS OUT TARGETS AND DOES NOT READ THEM. CONTRACT §5.4
         * forbids `readRenderTargetPixels` on the frame path and
         * `parsecheck.mjs` enforces it as *"forbidden in a module"*, which is
         * stricter than the sentence it enforces and is the right strictness:
         * a module that CAN read back is one frame away from doing it every
         * frame. So the readback lives in `tools/radianceprobe.mjs`, which is
         * not a module, and this returns the objects it reads — the same shape
         * `motionTexture` already has, one step up from a texture.
         *
         * `scene` is the TAA-resolved radiance the composite samples as `hdr`;
         * `bloom` is the mip it adds at `bloomStrength`; `glare` is the
         * coarsest mip, which the upsample never writes, so it still holds the
         * fully downsampled bright pass that §5.5's veil is taken from.
         */
        radianceBuffers() {
          const target = taaRT[taaIndex];
          if (!target || !bloom.length) return null;
          return {
            renderer: ctx.renderer,
            scene: target,
            bloom: bloom[0],
            glare: bloom[bloom.length - 1],
            width: target.width,
            height: target.height,
            bloomStrength: compositeMat.uniforms.uBloomStrength.value,
            glareStrength: compositeMat.uniforms.uGlareStrength.value,
            purkinje: [
              compositeMat.uniforms.uPurkinje.value.x,
              compositeMat.uniforms.uPurkinje.value.y,
              compositeMat.uniforms.uPurkinje.value.z,
            ],
          };
        },
        /** The motion attachment, for the instrument that verifies it. §5.11. */
        get motionTexture() {
          return hdrRT && hdrRT.textures.length > 1 ? hdrRT.textures[1] : null;
        },
        /**
         * Replace the composite with a view of a buffer. `'motion'` or null.
         * An instrument, not a mode: no gate renders through it and none may,
         * for the reason CONTRACT §7 gives about `setShotAt`.
         */
        setDebugView(name) {
          debugView = name || null;
        },
        get debugView() {
          return debugView;
        },
        /** The gain the motion debug view encodes with. One copy. */
        get motionDebugScale() {
          return MOTION_DEBUG_SCALE;
        },
        /**
         * The neighbourhood clip width, for an instrument that needs to see
         * reprojection error rather than have it suppressed. §5.10, §5.11.
         *
         * The clamp's whole job is to make wrong history harmless — it clips it
         * into the current 3×3 distribution, so history fetched from the wrong
         * place comes back as approximately the current colour. That is why a
         * reprojection failure in this renderer shows up as LOST ACCUMULATION
         * and not as a smear, and it is exactly what `post.js` predicted about
         * traffic: it aliases rather than ghosts. It also means an A/B on the
         * resolved frame cannot see a reprojection change while the clamp is
         * on. Widening it is how the instrument separates the two.
         *
         * Not a mode. Nothing ships with this touched and no gate renders
         * through it.
         */
        setClipGamma(v) {
          taaMat.uniforms.uClipGamma.value = v == null ? TAA.clipGamma : v;
          return taaMat.uniforms.uClipGamma.value;
        },
        /**
         * The history weight, and the sub-pixel jitter amplitude. Two more
         * instruments of `setClipGamma`'s kind, added for the static-camera
         * shimmer probe (`filmshot --static`) and subject to the same rule: not
         * modes, nothing ships with them touched, and no gate renders through
         * them.
         *
         * They are the two halves TAA is made of and they separate two
         * different questions, which is why there are two and not one:
         *
         *   setFeedback(0)     the accumulation off, the jitter still on. This
         *                      is the RAW per-frame aliasing amplitude — what
         *                      the temporal filter is being asked to remove.
         *                      It is the shimmer probe's POSITIVE control: an
         *                      arm that does not read high here is measuring
         *                      nothing (CONTRACT §7.3).
         *   setJitterScale(0)  the jitter off, the accumulation still on. With
         *                      a locked camera and a paused clock, every input
         *                      to the frame is then identical frame to frame,
         *                      so the delivered image must be identical too
         *                      apart from the composite's ±1 code-value dither.
         *                      It is the probe's NEGATIVE control, and it is a
         *                      control on the WHOLE path rather than on the
         *                      metric alone.
         *
         * Both return what they actually set, for the reason
         * `setInstanceUploadFrozen` does: an instrument that silently declines
         * is an arm that quietly is not an arm.
         */
        setFeedback(v) {
          taaMat.uniforms.uFeedback.value = v == null ? TAA.feedback : Math.max(0, Math.min(0.99, v));
          return taaMat.uniforms.uFeedback.value;
        },
        setJitterScale(v) {
          jitterScale = v == null ? 1 : Math.max(0, Math.min(4, v));
          return jitterScale;
        },
        get jitterScale() {
          return jitterScale;
        },
        /**
         * The two arms of the session-13 shimmer A/B. `null` restores the
         * shipped value, which is the constant at the top of this file — never
         * a literal here, so the arm and the ship cannot drift apart.
         */
        setJitterComp(v) {
          taaMat.uniforms.uJitterComp.value = v == null ? TAA_JITTER_COMP : (v ? 1 : 0);
          return taaMat.uniforms.uJitterComp.value;
        },
        setKarisScale(v) {
          taaMat.uniforms.uKarisScale.value = v == null ? TAA_KARIS_SCALE : Math.max(0, v);
          return taaMat.uniforms.uKarisScale.value;
        },
        /**
         * Drop the accumulation. For anything that makes the previous frame a
         * description of a different world — a teleport, a chunk arriving in
         * front of the camera, a material rebuild.
         */
        resetHistory() {
          taaHistory = false;
        },
        /**
         * The previous frame's radiance-and-depth buffer, with the matrices it
         * was drawn with. `lights` pulls this in its update(), which runs
         * before this module's render(), so what it gets is always a complete
         * frame rather than the one being assembled. Null until one has been
         * drawn.
         */
        ssrSource() {
          return ssrReady;
        },
        setRenderScale(s) {
          renderScale = Math.max(0.25, Math.min(2, s));
          resize(ctx);
        },
        get renderScale() {
          return renderScale;
        },
        setBloomStrength(v) {
          compositeMat.uniforms.uBloomStrength.value = v;
        },
        setGlareStrength(v) {
          compositeMat.uniforms.uGlareStrength.value = v;
        },
        /**
         * THE BLACK FLOOR'S ARM. `setBloomStrength`'s shape, and subject to
         * the same rule: not a mode, nothing ships with it touched, and no
         * gate renders through it. `null` restores the shipped value, so an
         * arm and the ship cannot drift apart (`setJitterComp`'s own note).
         *
         * The floor is one number — a display-linear luminance — so an arm is
         * one number too, and the hue it takes is the pixel's own at any level.
         */
        setBlackFloor(v) {
          const y = v == null ? POST.blackFloor : Math.max(0, v);
          compositeMat.uniforms.uBlackFloorY.value = y;
          return y;
        },
        config: cfg,
      };
    },

    update(ctx, dt) {
      lastDt = dt;
    },

    render(ctx) {
      const renderer = ctx.renderer;
      const camera = ctx.camera;
      const exposure = ctx.get('exposure');

      renderer.info.reset();

      // --- jitter -----------------------------------------------------------
      // Applied to the projection matrix for the scene pass only, and taken off
      // again before anything else reads it. Adding d to element 8 shifts NDC.x
      // by −d (clip.x gains d·z_view while clip.w is −z_view), so the sign here
      // is the one that makes uJitter below the offset that was actually applied.
      const [jxPx, jyPx] = JITTER[frameIndex % JITTER.length];
      jitterNdc.set((2 * jxPx * jitterScale) / hdrRT.width, (2 * jyPx * jitterScale) / hdrRT.height);
      const e = camera.projectionMatrix.elements;
      e[8] -= jitterNdc.x;
      e[9] -= jitterNdc.y;

      // No setViewport here. renderer.setViewport() takes CSS pixels and
      // multiplies by the pixel ratio internally, so handing it drawing-buffer
      // dimensions sets a viewport twice too large on a 2× display and renders
      // the bottom-left quarter of the frame, magnified. setRenderTarget already
      // sets the viewport to the target's full size, and setRenderTarget(null)
      // restores the one setSize established.
      /**
       * The previous frame's un-jittered view-projection, handed to the scene
       * pass so every fragment can write its own motion. §5.11.
       *
       * Set HERE and not in `lights.update()`, and the ordering is the whole
       * reason: `taaPrevViewProj` is overwritten at the bottom of this function
       * with the matrix this frame was drawn with, so at this line it still
       * holds the previous frame's — which is the one the motion vector is
       * measured against. Reading it one function earlier would get the same
       * value; reading it one line later would get this frame's, and the motion
       * field would be identically zero with nothing to show for it.
       *
       * On the first frame it is the identity and the motion is meaningless,
       * which costs nothing: `uHistoryValid` is 0 on that frame, so the resolve
       * never reads it.
       */
      const lightsMod = ctx.get('lights');
      if (lightsMod && lightsMod.setPrevViewProj) lightsMod.setPrevViewProj(taaPrevViewProj);

      renderer.setRenderTarget(hdrRT);
      renderer.clear(true, true, true);
      renderer.render(ctx.scene, camera);

      /**
       * The scene's own draw calls, separated from the post chain's.
       *
       * `renderer.info.render.calls` is a frame total across every pass, and the
       * post chain is twenty-six of them regardless of what is in the world. A
       * draw-call budget that cannot tell the city from the bloom pyramid is a
       * budget nobody can act on — and this number is what told us that the
       * 130-call gap between the noon route and the midnight ones was the sun's
       * shadow pass rather than anything about the geometry.
       */
      sceneCalls = renderer.info.render.calls;

      camera.updateMatrixWorld();
      // The reflection source was drawn *with* the jitter, so the matrix that
      // describes where things are in it is the jittered one. Captured before
      // the projection matrix is restored, for that reason and only that reason.
      ssrIndex ^= 1;
      ssrView[ssrIndex].copy(camera.matrixWorldInverse);
      ssrViewProj[ssrIndex].multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

      e[8] += jitterNdc.x;
      e[9] += jitterNdc.y;

      // --- temporal resolve -------------------------------------------------
      const prev = taaIndex;
      taaIndex ^= 1;
      const taaTarget = taaRT[taaIndex];
      const tu = taaMat.uniforms;
      tu.uCurrent.value = hdrRT.texture;
      tu.uHistory.value = taaRT[prev].texture;
      tu.uMotion.value = hdrRT.textures[1];
      tu.uTexel.value.set(1 / hdrRT.width, 1 / hdrRT.height);
      tu.uJitter.value.copy(jitterNdc);
      tu.uPrevViewProj.value.copy(taaPrevViewProj);
      tu.uInvView.value.copy(camera.matrixWorld);
      const tanHalfY = Math.tan(((camera.fov * 0.5) * Math.PI) / 180);
      tu.uTanHalf.value.set(tanHalfY * camera.aspect, tanHalfY);
      tu.uHistoryValid.value = taaHistory ? 1 : 0;
      fs.render(renderer, taaMat, taaTarget);

      // Un-jittered, because the history buffer this will be reprojected into is
      // itself un-jittered: every texel of a TAA output is at its pixel centre.
      taaPrevViewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      taaHistory = true;
      frameIndex++;

      if (exposure) {
        exposure.measure(renderer, taaTarget.texture, taaTarget.width, taaTarget.height, lastDt);
      }

      // --- reflection source for the next frame ---
      // One half-resolution pass over the frame, before bloom touches
      // anything: what a wet road reflects is the scene, not the scene plus its
      // own glow.
      //
      // Sourced from the raw HDR target rather than from the resolve, and
      // deliberately: the resolve contains last frame's reflection, so feeding it
      // back in would make a wet road reflect a wet road reflecting a wet road.
      // The accumulation still denoises the march, one step later — the jitter
      // moves the ray origin every frame and TAA averages the results.
      const ssrTarget = ssrRT[ssrIndex];
      ssrCopyMat.uniforms.uScene.value = hdrRT.texture;
      ssrCopyMat.uniforms.uTexelSize.value.set(1 / hdrRT.width, 1 / hdrRT.height);
      fs.render(renderer, ssrCopyMat, ssrTarget);

      ssrReady = {
        texture: ssrTarget.texture,
        view: ssrView[ssrIndex],
        viewProj: ssrViewProj[ssrIndex],
        maxMip: ssrMaxMip,
      };

      // --- bloom ---
      prefilterMat.uniforms.uScene.value = taaTarget.texture;
      prefilterMat.uniforms.uTexelSize.value.set(1 / hdrRT.width, 1 / hdrRT.height);
      fs.render(renderer, prefilterMat, bloom[0]);

      for (let i = 1; i < bloom.length; i++) {
        downMat.uniforms.uSrc.value = bloom[i - 1].texture;
        downMat.uniforms.uTexelSize.value.set(1 / bloom[i - 1].width, 1 / bloom[i - 1].height);
        fs.render(renderer, downMat, bloom[i]);
      }
      for (let i = bloom.length - 1; i > 0; i--) {
        upMat.uniforms.uSrc.value = bloom[i].texture;
        upMat.uniforms.uTexelSize.value.set(1 / bloom[i].width, 1 / bloom[i].height);
        fs.render(renderer, upMat, bloom[i - 1]);
      }

      // --- composite, and the upscale ---
      const buf = renderer.getDrawingBufferSize(scratchSize);
      compositeMat.uniforms.uScene.value = taaTarget.texture;
      compositeMat.uniforms.uSceneTexel.value.set(1 / taaTarget.width, 1 / taaTarget.height);
      compositeMat.uniforms.uUpscaling.value =
        buf.x > taaTarget.width || buf.y > taaTarget.height ? 1 : 0;
      compositeMat.uniforms.uBloom.value = bloom[0].texture;
      // The last mip is never written by the upsample pass, so it still holds
      // the fully downsampled bright pass — the veiling term.
      compositeMat.uniforms.uGlare.value = bloom[bloom.length - 1].texture;
      fs.render(renderer, compositeMat, null);

      // The debug view replaces the composite rather than being blended over
      // it: half of a motion buffer is not a motion buffer, and the point of
      // looking at one is to read numbers off it.
      if (debugView === 'motion' && hdrRT.textures.length > 1) {
        motionDebugMat.uniforms.uMotion.value = hdrRT.textures[1];
        fs.render(renderer, motionDebugMat, null);
      }
    },

    dispose() {
      hdrRT && hdrRT.dispose();
      for (const rt of taaRT) if (rt) rt.dispose();
      taaRT = [null, null];
      taaHistory = false;
      taaMat && taaMat.dispose();
      for (const rt of bloom) rt.dispose();
      bloom = [];
      for (const rt of ssrRT) if (rt) rt.dispose();
      ssrRT = [null, null];
      ssrReady = null;
      fs && fs.dispose();
      prefilterMat && prefilterMat.dispose();
      downMat && downMat.dispose();
      upMat && upMat.dispose();
      compositeMat && compositeMat.dispose();
      ssrCopyMat && ssrCopyMat.dispose();
      motionDebugMat && motionDebugMat.dispose();
    },
  };
}
