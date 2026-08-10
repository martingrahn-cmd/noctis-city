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

export function createLoop(ctx) {
  let raf = 0;
  let last = 0;
  let running = false;
  let driven = false;

  function frame(dt) {
    ctx.update(dt);
    ctx.emit('beforeRender', { dt });
    ctx.render();
    ctx.emit('afterRender', { dt });
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    // A backgrounded tab delivers one enormous delta on return. Thirty seconds
    // of simulation in one frame is how a day/night cycle teleports to noon.
    const dt = Math.max(0, Math.min(DT_MAX, (now - last) / 1000));
    last = now;
    frame(dt);
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
