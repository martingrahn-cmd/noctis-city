/**
 * loop.js — the frame, and who owns time.
 *
 * CONTRACT §4. The loop clamps dt and calls ctx.update then ctx.render. It
 * knows about no module by name, including `time` — time is just the first
 * module in the topological order.
 *
 * When the harness drives (CONTRACT §8) the rAF loop is suspended and dt comes
 * from step(). A capture that depends on wall-clock timing is not a capture.
 */

export const DT_MAX = 0.1;

/**
 * Samples kept. 240 at 60 Hz is four seconds, which covers the HUD's own
 * one-second graph with room for a p95 that is not four frames wide: the 95th
 * percentile of 60 samples is the third-worst, and the third-worst of a second
 * is a number that jumps every time one frame hitches.
 */
const TIMING_CAP = 240;

export function createLoop(ctx) {
  let raf = 0;
  let last = 0;
  let running = false;
  let driven = false;

  /**
   * THE FRAME TIMES, MEASURED AROUND THE rAF CALLBACK — session 20.
   *
   * TWO QUANTITIES AND THEY ARE NOT THE SAME ONE, which is the whole reason
   * both are kept:
   *
   *   interval  the delivered frame period, `now − previous now` off the rAF
   *             timestamp. It includes the vsync wait, so at 60 Hz on an
   *             unloaded machine it is 16.7 ms whatever the work costs. This is
   *             what a person means by "frame time" and what a stutter shows up
   *             in.
   *   callback  `performance.now()` either side of the callback's own body:
   *             every module's `update`, the render, and both events. It does
   *             NOT include the vsync wait, and it is what "am I inside the
   *             12 ms budget" is about.
   *
   * MEASURED AROUND THE CALLBACK AND NOT AROUND THE DRAW, deliberately. A timer
   * around `ctx.render()` alone omits every `update()` in the frame, which on
   * this project is the traffic simulation, the streaming, the crowd and the
   * chunk builder — i.e. most of the CPU cost. `perfcheck` has measured the
   * whole callback since session 3 and a HUD that measured something narrower
   * would disagree with the gate about the same machine.
   *
   * IT IS IN `loop.js` BECAUSE THIS IS THE ONLY PLACE THE CALLBACK'S BOUNDARY
   * EXISTS. A module cannot see it: `beforeRender` and `afterRender` bracket
   * the render pass, not the callback, and anything reading them would be
   * measuring the narrower quantity above and calling it the wider one — §9's
   * shape with two frame times. Core knows no module by name and this adds no
   * knowledge of one; `main.js` hands the loop to whoever wants it, exactly as
   * it already hands it to `createHarness`.
   *
   * `harnessOverheadMs` is what a CONSUMER says its own presence cost this
   * frame, subtracted before the sample is stored. Otherwise the HUD's own DOM
   * work lands inside the number the HUD is displaying — which is precisely
   * what `filmshot` caught when a PNG readback landed inside the frame interval
   * and the tool reported an encoder as the renderer.
   */
  const intervals = new Float32Array(TIMING_CAP);
  const callbacks = new Float32Array(TIMING_CAP);
  let samples = 0;
  let head = 0;
  let overheadMs = 0;
  /** Callback milliseconds attributed to instrumentation, summed for the run. */
  let overheadTotalMs = 0;

  function frame(dt) {
    ctx.update(dt);
    ctx.emit('beforeRender', { dt });
    ctx.render();
    ctx.emit('afterRender', { dt });
  }

  function record(intervalMs, callbackMs) {
    intervals[head] = intervalMs;
    // Never below zero: a consumer that over-reports its own cost would
    // otherwise make the loop look free, which is the failure this subtraction
    // exists to prevent, inverted.
    callbacks[head] = Math.max(0, callbackMs - overheadMs);
    overheadTotalMs += overheadMs;
    overheadMs = 0;
    head = (head + 1) % TIMING_CAP;
    if (samples < TIMING_CAP) samples++;
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    // A backgrounded tab delivers one enormous delta on return. Thirty seconds
    // of simulation in one frame is how a day/night cycle teleports to noon.
    const raw = last ? now - last : 0;
    const dt = Math.max(0, Math.min(DT_MAX, raw / 1000));
    last = now;
    const t0 = performance.now();
    frame(dt);
    record(raw, performance.now() - t0);
  }

  return {
    start() {
      if (running || driven) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    },

    stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },

    get running() {
      return running;
    },

    /**
     * A consumer declaring what its own presence cost this frame, in ms. Added
     * to whatever else has already been declared, so two instruments can each
     * report their own without either having to know about the other, and
     * cleared when the sample is stored.
     */
    reportOverhead(ms) {
      if (ms > 0) overheadMs += ms;
    },

    /**
     * The last `TIMING_CAP` frames, oldest first. Copies rather than views: a
     * caller holding a live view of a ring buffer reads a different second on
     * every access, and a percentile taken over one of those is a statistic of
     * nothing.
     *
     * Empty while the harness is driving, and that is correct rather than a
     * gap — `step()` renders on its own schedule with a fixed dt, so a frame
     * INTERVAL measured through it would be a measurement of the harness.
     */
    timing() {
      const iv = new Array(samples);
      const cb = new Array(samples);
      for (let k = 0; k < samples; k++) {
        const ix = (head - samples + k + TIMING_CAP * 2) % TIMING_CAP;
        iv[k] = intervals[ix];
        cb[k] = callbacks[ix];
      }
      return { intervals: iv, callbacks: cb, overheadTotalMs, driven };
    },

    /** Hand the frame clock to the harness. Idempotent. */
    takeOver() {
      this.stop();
      driven = true;
    },

    release() {
      driven = false;
      this.start();
    },

    /**
     * Render exactly n frames with a fixed dt, one per animation frame so the
     * GPU actually retires the work between them. Returns when all n are done.
     */
    step(n = 1, dt = 1 / 60) {
      return new Promise((resolve) => {
        let i = 0;
        const one = () => {
          frame(dt);
          if (++i >= n) {
            resolve();
            return;
          }
          requestAnimationFrame(one);
        };
        requestAnimationFrame(one);
      });
    },
  };
}
