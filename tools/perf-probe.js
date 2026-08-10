/**
 * perf-probe.js — in-page instrument for Apex City.
 *
 * Import this from your entry point when ?perf=1 is present, and call
 * probe.attach(renderer) once, then probe.frameStart() / probe.frameEnd()
 * around your render call.
 *
 * Everything it collects lands on window.__APEX_PROBE__, which perfcheck.mjs
 * reads from the outside. It writes nothing to the DOM and allocates nothing
 * per frame — the instrument must not be the thing that blows the budget.
 */

const EXT_NAME = 'EXT_disjoint_timer_query_webgl2';
const POOL_SIZE = 8;

export class PerfProbe {
  constructor() {
    this.gl = null;
    this.ext = null;
    this.pool = [];
    this.inFlight = [];
    this.active = null;

    this.gpuMs = [];
    this.cpuMs = [];
    this.cpuStart = 0;

    /**
     * End-to-end frame interval, frameStart to frameStart.
     *
     * Session 4 added this because the fallback the gate had was measuring the
     * wrong thing. When timer queries are unavailable the committed fallback
     * re-runs a route at 1.5× render scale and checks the CPU p95 — but CPU time
     * barely moves with resolution, so a GPU that had fallen off a cliff would
     * pass it. With vsync and the frame-rate limiter both disabled, the interval
     * between animation frames is bounded below by whichever of the CPU and the
     * GPU is slower, which is the number a player experiences.
     *
     * It is an upper bound on GPU time and not a measurement of it. Where the
     * two disagree, the timer query is right and this is pessimistic.
     */
    this.wallMs = [];
    this.lastFrameStart = 0;

    /** Why the GPU timer path did or did not produce numbers. */
    this.queryStats = { issued: 0, drained: 0, disjoint: 0, starved: 0 };

    this.counters = { drawCalls: 0, triangles: 0, programs: 0 };
    this.peak = { drawCalls: 0, triangles: 0, programs: 0 };
    this.materials = new Set();
    this.visibleInstances = 0;

    this.errors = [];
    this.contextLost = 0;
    this.recording = false;
    this.rendererString = 'unknown';

    /**
     * Session 9c's GL profile: per-frame time inside the GL calls that can
     * plausibly BLOCK the CPU (uploads, draws, sync points), and the single
     * largest call with its name. The trace localised the doubled far-tail
     * to inside the frame callback with GC and the compositor excluded; if
     * the stall is one blocking call, the far frames' max column names it.
     * OFF unless enableGLProfile() is called — the wrap costs real time and
     * an instrument that is always on is a tax on every gate.
     */
    this.glProfiling = false;
    this.glFrame = { total: 0, max: 0, maxName: '' };
    this.glTotalMs = [];
    this.glMaxMs = [];
    this.glMaxName = [];

    /**
     * Session 9d: per-frame CALL COUNTS for the upload family, with
     * texSubImage3D split by its target argument — the §5.7 canyon field is
     * a DataArrayTexture (TEXTURE_2D_ARRAY) and the lights slots are
     * Data3DTextures (TEXTURE_3D), so the target names the owner without a
     * stack trace. The staging-pool theory's testable prediction (STATE §2)
     * is EQUAL call counts at a DOUBLED slow-call rate between the s9 and
     * s8 arms — and a broken counter that reports equal numbers everywhere
     * is indistinguishable from the confirming result, so
     * `loftprobe --falsifycounts` injects known calls through this same
     * wrap and requires every count to move by exactly the injected number,
     * land on exactly the injected frames, and nowhere else.
     *
     * Four slots per key per frame: calls, calls over slowMs, ms inside
     * the calls, bytes handed to them (the ArrayBufferView argument's
     * byteLength; bufferData's size-only form counts its numeric size).
     *
     * slowMs = 1: an order of magnitude below the ~9 ms stall this exists
     * to count (the settle session's glprof, STATE §2), and far above the
     * steady per-frame instance upload it must not count — 1 920 rows
     * × 64 B ≈ 123 KB a buffer, tens of microseconds at any plausible
     * copy rate. A threshold an order away from both measured populations
     * classifies neither by luck; the per-key ms totals are reported so
     * the threshold's own effect stays visible.
     */
    this.glSlowMs = 1;
    this.glCountKeys = ['texSub3D:array', 'texSub3D:3d', 'texSub3D:other', 'texSubImage2D', 'bufferSubData', 'bufferData'];
    this.glCountFrame = null; // Float64Array(keys.length * 4) once profiling is on
    this.glCountRows = [];
  }

  enableGLProfile(slowMs) {
    if (this.glProfiling || !this.gl) return this.glProfiling;
    if (Number.isFinite(slowMs) && slowMs > 0) this.glSlowMs = slowMs;
    const suspects = [
      'bufferData', 'bufferSubData', 'texImage2D', 'texImage3D',
      'texSubImage2D', 'texSubImage3D', 'drawElementsInstanced',
      'drawArraysInstanced', 'drawElements', 'drawArrays', 'readPixels',
      'getError', 'getParameter', 'clientWaitSync', 'fenceSync', 'finish', 'flush',
      'compileShader', 'linkProgram',
    ];
    // Key index per counted name; texSubImage3D resolves per call from its
    // target argument. Names absent here (draws, syncs) still feed the
    // total/max profile above but are not counted — the question the counts
    // answer is about uploads, and a per-frame row per draw call would be
    // the instrument blowing the budget it measures.
    const countBase = { texSubImage2D: 3, bufferSubData: 4, bufferData: 5 };
    const GL_TEXTURE_2D_ARRAY = 0x8c1a;
    const GL_TEXTURE_3D = 0x806f;
    this.glCountFrame = new Float64Array(this.glCountKeys.length * 4);
    const self = this;
    for (const name of suspects) {
      const orig = this.gl[name];
      if (typeof orig !== 'function') continue;
      const isTexSub3D = name === 'texSubImage3D';
      const base = countBase[name];
      this.gl[name] = function wrapped(...a) {
        const t0 = performance.now();
        const r = orig.apply(this, a);
        const dt = performance.now() - t0;
        const f = self.glFrame;
        f.total += dt;
        if (dt > f.max) { f.max = dt; f.maxName = name; }
        let k = base;
        if (isTexSub3D) k = a[0] === GL_TEXTURE_2D_ARRAY ? 0 : a[0] === GL_TEXTURE_3D ? 1 : 2;
        if (k !== undefined) {
          const c = self.glCountFrame;
          const o = k * 4;
          c[o] += 1;
          if (dt > self.glSlowMs) c[o + 1] += 1;
          c[o + 2] += dt;
          for (let i = a.length - 1; i >= 0; i--) {
            const v = a[i];
            if (ArrayBuffer.isView(v)) { c[o + 3] += v.byteLength; break; }
          }
          if (name === 'bufferData' && typeof a[1] === 'number') c[o + 3] += a[1];
        }
        return r;
      };
    }
    this.glProfiling = true;
    return true;
  }

  attach(renderer) {
    this.renderer = renderer;
    this.gl = renderer.getContext();

    // Which GPU are we actually on? Playwright's headless shell has no GPU and
    // silently falls back to SwiftShader — every number below would then be
    // measuring a software rasteriser instead of the machine in the budget.
    // perfcheck aborts on this, but it has to be able to see it first.
    const dbg = this.gl.getExtension('WEBGL_debug_renderer_info');
    this.rendererString = dbg
      ? String(this.gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
      : String(this.gl.getParameter(this.gl.RENDERER) || 'unknown');

    // Timer queries are frequently gated off (Chrome disabled them for a long
    // stretch over Spectre). Absence is not an error — perfcheck falls back to
    // the render-scale headroom probe. But we report which path we took, so a
    // green run can never be silently CPU-only.
    this.ext = this.gl.getExtension(EXT_NAME);
    if (this.ext) {
      for (let i = 0; i < POOL_SIZE; i++) this.pool.push(this.gl.createQuery());
    }

    const canvas = renderer.domElement;
    canvas.addEventListener('webglcontextlost', () => { this.contextLost++; });

    window.addEventListener('error', (e) => this.errors.push(String(e.message)));
    window.addEventListener('unhandledrejection', (e) => this.errors.push('unhandled: ' + String(e.reason)));

    window.__APEX_PROBE__ = this;
    return this;
  }

  /** Called by perfcheck after warmup, so shader compilation is excluded. */
  startRecording() {
    this.gpuMs.length = 0;
    this.cpuMs.length = 0;
    this.wallMs.length = 0;
    // Per-frame JS heap (Chrome-only API; 0 elsewhere). Session 9c: the
    // night_rain tail is evenly-spaced CPU-long frames, and whether those
    // coincide with heap DROPS (collections) is the difference between a GC
    // story and a driver story. Additive — nothing that reads report()
    // requires this key.
    if (!this.heapBytes) this.heapBytes = [];
    this.heapBytes.length = 0;
    this.glTotalMs.length = 0;
    this.glMaxMs.length = 0;
    this.glMaxName.length = 0;
    this.glCountRows.length = 0;
    this.lastFrameStart = 0;
    this.materials.clear();
    this.queryStats = { issued: 0, drained: 0, disjoint: 0, starved: 0 };
    this.peak = { drawCalls: 0, triangles: 0, programs: 0 };
    this.recording = true;
  }

  frameStart() {
    const now = performance.now();
    if (this.recording && this.lastFrameStart) this.wallMs.push(now - this.lastFrameStart);
    this.lastFrameStart = now;
    this.cpuStart = now;
    if (!this.ext) return;
    if (this.pool.length === 0) {
      // The pool is finite, so a driver that never retires a query starves it
      // permanently and every subsequent frame silently goes unmeasured. Count
      // it: "no GPU numbers" and "no GPU numbers because the pool is empty" are
      // different findings and only one of them is about the renderer.
      if (this.recording) this.queryStats.starved++;
      return;
    }
    this.active = this.pool.pop();
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, this.active);
    if (this.recording) this.queryStats.issued++;
  }

  frameEnd() {
    if (this.recording) {
      this.cpuMs.push(performance.now() - this.cpuStart);
      this.heapBytes.push(performance.memory ? performance.memory.usedJSHeapSize : 0);
      if (this.glProfiling) {
        this.glTotalMs.push(this.glFrame.total);
        this.glMaxMs.push(this.glFrame.max);
        this.glMaxName.push(this.glFrame.maxName);
        this.glCountRows.push(Array.from(this.glCountFrame));
      }
    }
    if (this.glProfiling) {
      this.glFrame.total = 0; this.glFrame.max = 0; this.glFrame.maxName = '';
      this.glCountFrame.fill(0);
    }

    if (this.ext && this.active) {
      this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
      this.inFlight.push(this.active);
      this.active = null;
      this._drainQueries();
    }

    const info = this.renderer.info;
    this.counters.drawCalls = info.render.calls;
    this.counters.triangles = info.render.triangles;
    this.counters.programs = info.programs ? info.programs.length : 0;

    if (this.recording) {
      this.peak.drawCalls = Math.max(this.peak.drawCalls, this.counters.drawCalls);
      this.peak.triangles = Math.max(this.peak.triangles, this.counters.triangles);
      this.peak.programs = Math.max(this.peak.programs, this.counters.programs);
    }
  }

  /**
   * Results are a few frames behind the GPU, so we poll rather than block.
   * A disjoint result means the GPU was interrupted (power state change,
   * another process) and the timing is garbage — we throw those away instead
   * of letting them flatter or ruin the run.
   */
  _drainQueries() {
    const gl = this.gl;
    const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT);

    if (disjoint && this.recording) this.queryStats.disjoint++;

    for (let i = this.inFlight.length - 1; i >= 0; i--) {
      const q = this.inFlight[i];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) continue;

      if (!disjoint && this.recording) {
        this.gpuMs.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
        this.queryStats.drained++;
      }
      this.inFlight.splice(i, 1);
      this.pool.push(q);
    }
  }

  /** Walk the scene once per route to collect content-floor evidence. */
  sampleScene(scene, camera) {
    let instances = 0;
    scene.traverse((o) => {
      if (!o.visible) return;
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) this.materials.add(m.uuid);
      }
      if (o.isInstancedMesh) instances += o.count;
      else if (o.isMesh) instances += 1;
    });
    this.visibleInstances = Math.max(this.visibleInstances, instances);
  }

  report() {
    return {
      method: this.ext ? 'gpu-timer-query' : 'cpu-only',
      rendererString: this.rendererString,
      frames: {
        gpuMs: this.gpuMs.slice(),
        cpuMs: this.cpuMs.slice(),
        wallMs: this.wallMs.slice(),
        heapBytes: this.heapBytes ? this.heapBytes.slice() : [],
        glTotalMs: this.glTotalMs.slice(),
        glMaxMs: this.glMaxMs.slice(),
        glMaxName: this.glMaxName.slice(),
      },
      glProfiling: this.glProfiling,
      glCounts: this.glCountFrame
        ? { keys: this.glCountKeys.slice(), slowMs: this.glSlowMs, rows: this.glCountRows.slice() }
        : null,
      queryStats: { ...this.queryStats },
      peak: this.peak,
      distinctMaterials: this.materials.size,
      visibleInstances: this.visibleInstances,
      errors: this.errors.slice(),
      contextLost: this.contextLost,
    };
  }
}

export const probe = new PerfProbe();
