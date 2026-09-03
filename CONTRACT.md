# NOCTIS — CONTRACT

**Read this file first, in every session, before `STATE.md` and before any source file.**

This is not documentation of what the code does. It is the set of rules the code is
required to obey. Where the code and this file disagree, the code is wrong.

Nothing in here may be relaxed to make a gate pass. If a rule here is genuinely
impossible, say so and stop — do not route around it.

---

## 0. The six rules, in one place

1. **Modules never import each other.** They register on a context object and reach
   each other by name: `ctx.get('time')`. Machine-checked by `tools/parsecheck.mjs`.
2. **A module that throws is quarantined, and the frame keeps rendering.** A broken
   subsystem must never take down the world.
3. **One source of truth for time.** `ctx.get('time')` owns `timeOfDay`. Nothing else
   keeps a clock, and nothing hardcodes a light colour, a sun angle or a "night" flag.
4. **One colour space, one conversion.** Everything is linear from the first shader to
   the last. sRGB encoding happens exactly once, in the final post pass.
5. **No gate may be weakened to pass.** No floor lowered, no assertion deleted, no
   `if (process.env.CI)`, no content removed to hit a frame budget.
6. **No decision on a difference smaller than the instrument's own noise floor.**
   A threshold is compared against a *pooled* estimate whenever the measurement's
   run-to-run spread is of the same order as the margin. The estimator is written
   down beside the number, and changing it never moves the threshold.

### 0.1 Rule 6, in full, because it is the newest and it applies everywhere

An instrument cannot resolve a difference smaller than its own noise floor, so a
rule that compares one draw against a fixed line reports noise as a result. It
does not report it as noise — it reports it as a verdict, with a number and a
tick or a cross, and every downstream reader treats it as a finding.

The incident: `downtown_dense` wall p95 measured **11.20 / 11.40 / 11.70 / 12.20 /
12.60 ms** across five observations against a **12.5 ms** ceiling. The breach is
**0.10 ms**. The measured run-to-run resolution on a quiet machine is
**0.40–0.80 ms**. The breach is **12.5% to 25% of the noise floor** and the gate
was red about one run in three. The pooled median is **11.70 ms**, clear by
**0.80 ms**.

- **Which estimator, and it is stated at the threshold.** `tools/budget.json` →
  `capture.$estimator`. The median of three runs' per-run statistic. Not the
  mean, which is 16% tighter (0.32 ms of standard error against 0.37 ms at the
  measured σ = 0.55 ms) and carries a drifted run at full weight — and drift on
  this machine is one-sided, so contamination is one-sided, and a median of
  three discards exactly one contaminated observation. Not a percentile over
  frames pooled across runs, which is **a different quantity**: the p95 of a
  mixture, whose upper tail is filled preferentially by whichever run caught the
  load spike, compared against a ceiling derived for a single run's p95. That
  substitution is §9's failure mode with a statistic instead of a length.
- **The threshold does not move.** `wallFrameMsP95` is 12.5 before and after.
  Rule 5 is not suspended by rule 6; an estimator change that also moved a
  number would be indistinguishable from a loosening.
- **Pooling is two-sided or it is a rubber stamp.** A quieter gate is one step
  from an unfailable one, which is rule 5 broken by an estimator rather than by
  a number. So the estimator itself carries falsifying cases in both directions:
  one drifted run of three **must not** fail, three runs over **must** fail, two
  of three over **must** fail (the median tolerates exactly one contaminated
  observation — that is the boundary of the claim), and a run exactly at the
  ceiling **must not** fail. `perfcheck --falsify` runs all four.
- **Counts are not pooled by median, they are pooled worst-case.** §9 rule 6's
  corollary is that counts do not drift, so there is nothing for a median to
  average away and each bound takes the run that is worst *for it* — the maximum
  for a ceiling, the minimum for a floor. That is strictly stricter than the
  single run it replaced. A quantity read by both a ceiling and a floor is
  combined twice, because one combination cannot serve both and the maximum is
  the lenient direction for a floor.
- **It applies to every measurement in this project and not only to this gate.**
  The headroom probe is pooled by the same estimator, which is consistency and
  not a repair: its own defect — `neverExceedNative` clamps the render scale so
  it shades the same 3 686 400 pixels twice and calls the second one headroom —
  is untouched and is why its number is not evidence of headroom whatever it
  says. `citycheck`'s saturation peak is an extreme-value statistic with a
  0.8-point spread and belongs here too.

### 0.2 The quiet bar — `load1 ≤ 1.6`, and where that number comes from

Rule 6 says a threshold is compared against an estimate whose spread is known.
The quiet bar is the same statement about the *machine*: an absolute is admitted
only from a load at which the instrument's spread has been measured. It is
enforced by `tools/quiet-gates.sh` and it is **1.6**, derived here.

**The evidence is one attested battery.** 2026-08-08, 08:08–08:21, the app
closed, admitted by that script's own gate of `load1 < 2.0` with `top < 12%` over
two consecutive 30 s samples. The two samples that admitted it measured
**load1 = 1.46** and **load1 = 1.56**. It ran both arms of s8/s9 over three
routes and is the tightest regime this project has recorded:

| arm | route | wall p95 (ms) | the three runs | spread (ms) |
|---|---|---|---|---|
| s9 | `highway_speed` | 9.00 | 9.0 · 9.0 · 9.0 | **0.0** |
| s8 | `highway_speed` | 9.20 | 9.2 · 9.2 · 9.1 | 0.1 |
| s9 | `night_rain` | 12.70 | 12.7 · 12.9 · 12.5 | 0.4 |
| s8 | `night_rain` | 12.30 | 12.1 · 12.6 · 12.3 | 0.5 |
| s8 | `downtown_dense` | 12.40 | 12.4 · 12.9 · 12.4 | 0.5 |
| s9 | `downtown_dense` | 12.40 | 12.4 · 11.4 · 13.3 | **1.9** |

Median spread **0.45 ms**, range **0.0–1.9 ms**. `citycheck`'s saturation in the
same window: per-run maxima [10.59 10.59 11.19], **spread 0.60 points** against
the 2.46 of the same statistic drawn loud.

**The arithmetic. Attested-quiet maximum load1 = 1.56 → bar = 1.6** (1.56 rounded
up to the next 0.1). The bar cannot sit below 1.56 or it refuses the run it is
derived from, which is what **1.2** did: 1.2 was set stricter than any attested
reading and without support, and over 77 consecutive invocations it admitted
**zero** — 68 parsed refusals with a minimum of 1.32, and nine more lost to the
locale defect below. A gate that can never pass produces no measurements, and no
measurements is not stricter than imperfect ones. It is nothing.

**This is a threshold correction, not a floor lowered, and the distinction is
load-bearing.** Rule 5 forbids weakening a gate to make it pass. The quiet bar
gates the *instrument's operating conditions*, not the content: no content
threshold moves with it — `wallFrameMsP95` is 12.5, `night_rain`'s is 13.0, every
floor in `silhouettes` is unchanged. It is nonetheless a loosening of an
admission criterion, so it is paid for by three tightenings in the same change,
all of which make the bar harder to satisfy falsely: the locale is fixed, an
unparseable load now refuses instead of passing, and the bar is floor-checked.

**What 1.6 licenses, and what it does not.** The claim is *"this load yields a
spread small enough to resolve the margin"*, and it is a claim about one route at
a time. Of the three, **it holds for one**:

- **`highway_speed`** — spread 0.0–0.1 ms. Resolved, comfortably.
- **`night_rain`** — spread 0.4–0.5 ms against a margin of **13.0 − 12.70 =
  0.30 ms**. The margin is **0.60–0.75×** the spread. **Not resolved**, and §1 of
  session 10's STATE says so in its own derivation of 13.0.
- **`downtown_dense`** — spread 0.5 ms on one arm and **1.9 ms** on the other,
  against a margin of **12.5 − 12.40 = 0.10 ms**. The margin is **5–20%** of the
  spread. **Not resolved.** This is §0.1's original incident restated on a quiet
  machine, and it is the reason a green `downtown_dense` in a quiet log is not on
  its own a verdict about that route. Resolving 0.10 ms needs the pooled paired
  instrument, not a quieter afternoon.

So the bar admits a measurement; it does not by itself make every margin
readable. Read it with the spread the run printed beside it.

**The floor, and why a bar has one.** `load1` cannot go below what the machine
costs to exist — WindowServer draws the screen and does not go away. The best
reading on record with the app closed and the machine idle overnight is **1.32**
(`tools/perf-out/quiet-gates-20260809-084928.log`, no process over 15% CPU), and
it is the minimum of **68** parsed readings across 77 refusals. It is therefore
an **upper bound** on the true floor, not the floor itself — which is the safe
direction for a rejection test and the wrong one for a bar, so a reading that
comes in *under* 1.32 prints a note that the floor is stale rather than being
silently accepted. **Bar 1.6 − floor 1.32 = 0.28 of load1** of headroom. `quiet-gates.sh` refuses a
configured bar below the floor in one line before it reads the machine at all,
because unmeetable-by-construction should be a message and not a night of
waiting. Re-derive the floor with `tools/quiet-gates.sh --measure-floor 10` and
cite the log; never lower it by assertion.

**Three instrument defects, recorded because each one produced a refusal that
read as a machine fault.**

1. **Locale.** The operator's shell is Swedish, where `uptime` prints
   `load averages: 1,32` and `ps -o %cpu` prints `6,9`. `tr -d ','` turned
   `1,32` into `132`, and `132 > 1.2` refuses forever — nine logs carry
   comma-stripped loads of 185 … 363. Worse and silently: `awk '$1 > 15'` cannot
   read `6,9` as a number, so it falls back to a **string** comparison in which
   `"6,9" > "15"` is true on the first character. Measured at one instant on this
   machine: **27 processes flagged as over 15% CPU under `sv_SE.UTF-8` against 9
   genuinely over it**, the false ones at 2,0 and 3,0 percent — WindowServer at
   6,9% trips it every time. Both checks were unmeetable. `LC_ALL=C` is now
   exported by the script itself; requiring it of the caller is how the
   session-9 battery was run and is exactly the knowledge a script should not
   need its operator to carry.
2. **Fail-open on a parse failure.** `awk "BEGIN { exit !(${LOAD} > 1.2) }"` with
   an empty `LOAD` is a syntax error; awk exits 2; `&&` reads that as *not over
   the bar* and **runs the gates with the bar declared met**. A number that looks
   attested and is not is worse than the refusal loop that hid it. An unparseable
   load now refuses and prints the `uptime` line it could not read.
3. **The 15% CPU bar has an unexamined floor of its own.** WindowServer was
   logged at **18.2%** in `quiet-gates-20260809-002246.log`, i.e. above the bar,
   on a machine with nothing else running. One observation is not a derivation,
   so **the number is not moved** — but the same argument that produced 1.6 has
   not been run for it, and until it is, a CPU refusal naming only WindowServer
   should be read as this gap rather than as a dirty machine.

---

## 1. The context object

`ctx` is created once by `src/core/context.js` and passed to every module. It is the
only channel between modules.

### 1.1 Core-owned handles

These exist before any module initialises and are never replaced:

| Field | Type | Notes |
|---|---|---|
| `ctx.renderer` | `THREE.WebGLRenderer` | Created by the bootstrap. Modules must not construct another. |
| `ctx.scene` | `THREE.Scene` | The world root. Modules add to it and remove what they added on `dispose`. |
| `ctx.camera` | `THREE.PerspectiveCamera` | The one camera that renders. A module may move it; none may replace it. |
| `ctx.config` | frozen object | Merged defaults + URL query params. See §6. |
| `ctx.size` | `{ width, height, dpr }` | Drawing-buffer size in device pixels is `width*dpr`. Updated before the `resize` event fires. |

### 1.2 Methods

```
ctx.register(module)      // see §2. Returns void. Never throws for a bad module —
                          // it quarantines instead.
ctx.get(name)             // → the module's api object, or undefined if the module is
                          // absent or quarantined. Callers MUST handle undefined.
ctx.has(name)             // → boolean. True only for live, non-quarantined modules.
ctx.rng(stream)           // → () => float in [0,1). Deterministic, seeded from
                          // ctx.config.seed and the stream name. See §7.
ctx.on(event, fn)         // → unsubscribe fn. Handler throws are caught and logged
                          // once; a bad listener never breaks the emitter.
ctx.emit(event, payload)  // synchronous.
ctx.warnOnce(key, ...msg) // logs at most once per key for the process lifetime.
ctx.faults               // → readonly array of { name, phase, message, stack }.
                          // Empty array means every module is live. Gates read this.
```

`ctx.get()` returning `undefined` is a normal, expected condition — it is what
quarantine looks like from the outside. Code that assumes a module is present is
in breach of rule 2.

### 1.3 Events

Emitted by the core, listened to by modules. Modules may emit their own; namespace
them with the module name (`'sky:rebuilt'`).

| Event | Payload | When |
|---|---|---|
| `resize` | `{ width, height, dpr }` | After `ctx.size` is updated, before the next frame. |
| `beforeRender` | `{ dt }` | After all `update()` calls, before the render pass. |
| `afterRender` | `{ dt }` | After the render pass. Instrumentation only. |
| `timeOfDay` | `{ t, previous, discontinuous }` | Emitted by the `time` module. `discontinuous` is true when time was set rather than advanced — consumers must rebuild rather than interpolate. |

---

## 2. The module interface

A module is a plain object. It is produced by a factory function exported from its
own file, named `create<Name>`:

```js
// src/modules/sky.js
export function createSky(options = {}) {
  return {
    name: 'sky',            // required. Unique. This is the ctx.get() key.
    needs: ['time'],        // optional. Hard dependencies, by name.
    init(ctx) { ... },      // optional. May return the api object.
    update(ctx, dt) { ... },// optional. dt in seconds, already clamped (§4.2).
    render(ctx) { ... },    // optional. At most one live module may define this.
    dispose(ctx) { ... },   // optional. Must remove everything the module added.
    api: { ... },           // optional. What ctx.get('sky') returns.
  };
}
```

Rules:

- **`name` is required and unique.** A duplicate registration is a fault; the second
  registration is quarantined.
- **`needs` is a hard dependency.** If a needed module is absent or quarantined, this
  module is quarantined *before* `init` runs. It is never partially initialised.
  Optional dependencies are not declared in `needs`; look them up with `ctx.get()`
  and handle `undefined`.
- **Boot order is a topological sort of `needs`,** with registration order as the
  stable tiebreak. `update()` runs in the same order every frame. A dependency cycle
  quarantines every module in the cycle.
- **The api object** is whatever `init()` returns, else `module.api`, else `{}`. It is
  the module's entire public surface. Anything not on the api does not exist to other
  modules.
- **`dispose()` must be idempotent** and must leave `ctx.scene` as it found it.

### 2.1 Quarantine

| Phase | On throw |
|---|---|
| `register` | Module is recorded as a fault and never boots. |
| `init` | Fault recorded, `dispose()` attempted (its own throw is swallowed), module removed. Modules that `needs` it are quarantined in turn. |
| `update` | Fault recorded, module removed from the update list. **The frame completes.** |
| `render` | Fault recorded, module removed. The core falls back to `renderer.render(scene, camera)` — an untonemapped frame is a bug you can see, which is the point. |

Each fault is logged **once**, with a stack, prefixed `[noctis] quarantined <name> during <phase>`.
Repeats are suppressed. A module is never retried within a session.

`ctx.faults.length === 0` is an assertion in the gates. Quarantine keeps the frame
alive so you can see what broke; it is not a way to ship something broken.

### 2.2 What a module may import

Only:

- `three` (and `three/examples/jsm/**`)
- `../core/**` — the context, the loop, shared constants
- `../lib/**` — pure, stateless helpers (noise, colour maths, PRNG). No module state.

Importing `../modules/**` from `src/modules/**` is a contract breach and
`parsecheck.mjs` fails on it. If you need another module's data, `ctx.get()` it.

---

## 3. Time

`ctx.get('time')` is the only clock in the project.

```
timeOfDay        float in [0,1). 0.0 = local solar midnight, 0.5 = solar noon.
                 The gate times are dawn 0.25, noon 0.5, dusk 0.78, midnight 0.0.
now              seconds of simulated time since boot.
dt               last frame's clamped delta, seconds.
frame            integer frame counter.
paused           boolean.
dayLengthSeconds real seconds per in-game day.
latitudeDeg      observer latitude. Positive north.
dayOfYear        1..365. With latitudeDeg it determines solar declination.
sun              { direction, elevationRad, azimuthRad, aboveHorizon }
moon             { direction, elevationRad, phase, illuminatedFraction }
setTimeOfDay(t)  sets absolutely; emits 'timeOfDay' with discontinuous: true.
advance(seconds) advances; emits with discontinuous: false.
setPaused(b)
```

`sun.direction` is a unit `Vector3` pointing **from the world origin toward the sun**.
It is derived from `timeOfDay`, `latitudeDeg` and `dayOfYear` by a solar position
model — not authored, not keyframed, not tinted. Sunset light is warm because the sun
is at 2° and the path length through the atmosphere is long. If you find yourself
adding a colour ramp keyed on `timeOfDay`, you have broken rule 3.

Simplifications, stated so nobody looks for them later: solar time only (no equation
of time, no longitude, no timezone), and declination from the standard
`23.44° · sin(2π(N−81)/365)` approximation. Both are documented in `time.js`.

### 3.1 Coordinates

Right-handed, Y up, **metres**.

```
+X = east     −X = west
−Z = north    +Z = south
+Y = up
```

Azimuth is measured clockwise from north as seen from above, so
`dir = (sin(az)·cos(el), sin(el), −cos(az)·cos(el))`.

The block's main street runs east–west. This is an authored choice: it puts the sun
down the street at both dawn and dusk, from opposite ends.

---

## 4. The frame

### 4.1 Order

```
1. core: compute dt, clamp it
2. time.update(dt)                     ← advances timeOfDay, emits if changed
3. every other module's update(dt), in topological order
4. ctx.emit('beforeRender', { dt })
5. the one module with render() draws the frame
```

Modules must not render inside `update()`. Modules must not read another module's
state that is updated later in the order — if you need that, declare it in `needs`
so the sort puts it first.

### 4.2 dt

`dt` is wall-clock seconds, clamped to `[0, 0.1]`. A tab that was backgrounded for
thirty seconds must not deliver a 30-second frame to anything. Simulated time is
`dt · timeScale`; `timeScale` lives on the `time` module, not on each consumer.

When the harness drives the frame (§8), `dt` is a fixed value supplied by the
harness, so a capture is reproducible.

---

## 5. Rendering, colour and units

### 5.1 The pipeline

Everything above the composite runs at the **internal render resolution** (§5.10),
which is not the drawing buffer. The composite is the one pass that runs at the
display's resolution, and it is where the upscale happens.

```
scene (jittered projection) ──▶ HDR target (HalfFloat, linear, 1 sample)
            │                        rgb = radiance, a = linear view depth
            │
            ├─▶ TAA resolve ──▶ history (ping-pong)   ◀── §5.10
            │       │              rgb = accumulated, a = THIS frame's depth
            │       │
            │       ├─▶ luminance downsample chain ──▶ 1×1 adapted-luminance
            │       │        (log-average, GPU-side ping-pong, no readback)
            │       │
            │       ├─▶ exposure ──▶ bright-pass (soft-knee on EXPOSED linear)
            │       │                   └─▶ bloom pyramid (down 8, up 8, tent)
            │       │
            │       └─▶ composite: Catmull-Rom upscale of exposed scene
            │                      + bloom·strength + glare
            │               └─▶ ACES (RRT+ODT fit, sRGB↔AP1 matrices)
            │                       └─▶ sRGB encode ◀── the only encode
            │                               └─▶ default framebuffer
            │
            └─▶ half-res max-luminance copy ──▶ SSR source for the NEXT frame
                    (from the raw HDR target, never from the resolve — §5.10)
```

### 5.2 Colour space rules

- `THREE.ColorManagement.enabled = true`. It stays true.
- Every render target is `LinearSRGBColorSpace` + `HalfFloatType`.
- `renderer.outputColorSpace = SRGBColorSpace`, and the final pass includes
  `#include <colorspace_fragment>`. That include is the single encode point. Any
  other `pow(c, 1/2.2)` in the codebase is a bug.
- `renderer.toneMapping = NoToneMapping`. Tonemapping is ours, in the composite pass,
  because it must happen after bloom and after exposure. Setting three's built-in
  tonemapping would apply it twice.
- Colours authored as hex are sRGB and are converted on assignment by ColorManagement.
  Colours computed from physics (sun transmittance, sky radiance) are already linear
  and must be assigned with `setRGB(r, g, b, LinearSRGBColorSpace)`.

### 5.3 Units

Physical, because auto-exposure is meaningless otherwise. three.js ≥ r165 has no
legacy lighting mode, so these are the renderer's native units:

| Quantity | Unit | Reference values |
|---|---|---|
| `DirectionalLight.intensity` | lux (illuminance) | noon sun ≈ 100 000, sun at 2° ≈ 2 000, full moon ≈ 0.25 |
| `PointLight.intensity` | candela (lm/sr) | 10 000 lm sodium lamp ≈ 800 cd |
| `SpotLight.intensity` | candela | |
| emissive | nits (cd/m²) | office window ≈ 300, neon tube ≈ 8 000 |
| `material.emissiveIntensity` | multiplier on the above | |
| sky / env map | cd/m² | noon zenith ≈ 5 000, overcast horizon ≈ 2 000 |

`decay = 2` on every punctual light. Always. Inverse-square or the exposure system
is lying to you.

### 5.4 Exposure

Auto-exposure is mandatory and is what makes neon read as bright.

- Scene luminance is the **log-average** (geometric mean) of the HDR frame, computed
  on the GPU by a downsample chain into a 1×1 target. Per-pixel luminance is clamped
  before averaging so a sun disc cannot own the meter, and **clipped into a window
  around the current adaptation** so that a night street's worth of lit windows and
  neon cannot own it either. Metering is centre-weighted.
- `EV100 = log2(L · 100 / K)`, `K = 12.5`.
- **Partial adaptation**, one law, no per-time-of-day authoring:
  `EV_used = EV_anchor + (EV_measured − EV_anchor) · adaptStrength`, `0 < adaptStrength < 1`,
  then clamped to `[minEV, maxEV]`. This is why night stays dark: a fully adapting
  eye would render midnight and noon identically, and a game where those two frames
  match is a game with no day/night cycle.
- **Asymmetric adaptation**: `tau_up` (getting brighter) is short, `tau_down` is long.
  `adapted += (target − adapted)·(1 − exp(−dt/tau))`.
- Exposure multiplier `= 1 / (1.2 · 2^EV_used)`.
- No readback. `readRenderTargetPixels` on the hot path is forbidden — it stalls the
  pipeline and would make the instrument the thing that blows the budget.
- The harness may call `snap()` to set adapted luminance directly to the measured
  value. That is for determinism in capture, not a tuning knob. Because the meter
  clips around its own previous reading, `settle()` snaps repeatedly until the
  window has walked the full range.

### 5.5 Bloom

Thresholded, not smeared. The threshold is applied to **exposed** linear values, so
it tracks adaptation: at night the same absolute emitter is far above threshold, in
daylight it is not. A fixed pre-exposure threshold blooms everything at noon and
nothing at midnight.

If the whole frame glows, the threshold is wrong. Bloom does not compensate for weak
lighting; it reads as haze.

**Veiling glare** is a separate term and is not bloom: a small, nearly flat fraction
of the coarsest bloom mip, added uniformly. It is the light a real lens scatters
across its own image, and it is why no photograph of a neon street contains a true
black. Without it the ACES toe drops every unlit wall to 0/255 and the night frame
fails its own gate. The ACES fit's toe is re-anchored so that zero maps to zero —
the published polynomial's numerator goes negative below 0.0033 and clamps three
stops of shadow to exact black.

### 5.6 Local lights — the strategy, decided in session 1

**Clustered forward+.** Not stock three.js forward lighting, which puts every light in
a fixed-size uniform array and evaluates all of them for every fragment of every
material.

- Lights live in a `DataTexture`, not in uniforms.
- The view frustum is divided into a froxel grid — screen tiles × exponentially
  distributed depth slices.
- Cluster assignment runs on the CPU each frame (WebGL2 has no compute) from light
  bounding spheres; per-cluster `(offset, count)` and a flat index list go to two more
  data textures.
- `MeshStandardMaterial` is patched via `onBeforeCompile` to loop over its cluster's
  lights and accumulate through three's own `RE_Direct_Physical`, so clustered lights
  and the sun use one BRDF.

This exists on ten buildings, where it is unnecessary, because retrofitting it in
session 3 means rewriting every material — which is exactly what the brief says not
to do. The cap is `config.maxClusterLights`; exceeding it drops the furthest lights
and raises a `warnOnce`, never a silent truncation.

Materials that need clustered light must be created through `ctx.get('lights').patch(material)`.
An unpatched material is not lit by local lights. This is deliberate and visible.

### 5.7 Indirect light — the strategy, decided in session 2

**A baked, sun-independent directional-occlusion field.** Not screen-space, not
irradiance probes.

Per voxel of a coarse world-space grid, six numbers, all of them pure geometry:
cosine-weighted sky visibility, a bent normal, and the cosine-weighted fraction
of the hemisphere subtended by surfaces facing each of +X, −X, +Z and −Z.

- **Nothing in the bake mentions the sun.** That is the load-bearing decision.
  The sun moves 0.35° about once a second at the default day length; a field
  storing *radiance* would have to be rebuilt on that cadence. This stores
  *transfer*. Bake once, valid at every hour.
- At runtime the CPU turns the current sun into four facade radiances and one
  ground radiance, once per sky rebuild. The shader multiplies the field by
  them. That is the entire per-frame cost of global illumination here.
- Sky occlusion and bounce are **one integral split at the horizon**, not two
  systems. Above the horizon is sky, below it is a wall whose orientation the
  bake recorded. Solving them separately produces two approximations that
  disagree along the line where the road meets the building.
- The same field supplies specular occlusion, tells a grazing reflection that it
  is looking at a wall rather than at the sky, and decides where rain can reach.

A chunk's field depends only on the occluders within its own horizon march, so
the scaling story is "bake on chunk load, bind the chunk's texture". There is no
global solve and nothing to propagate between chunks.

Owned by `src/modules/canyon.js`; the bake is `src/lib/canyon.js`; the shader
half lives in `lights.js` because that module already owns the one material
injection. A material that is not patched gets no indirect light, by the same
rule as §5.6.

### 5.8 Screen-space reflection — the strategy, decided in session 3

**Only for water, only in the forward pass, and hard-bounded.**

Session 1 rejected screen space for the noon road and the reasoning was right
and *specific*: the occlusion that road was missing comes from facades above the
top edge of the frame, which no screen-space pass can sample. At night, reflected
in a wet road, the case inverts. The lit windows, the shopfronts and the signs
are in frame — they are the brightest things in it — and nothing else in the
project can supply them: an environment map has no windows and a punctual light
has no extent. Both statements are true at once; the pass is correct for one
case and wrong for the other, and it is switched on for exactly one.

- **In the forward pass, not a post pass.** A post pass knows the colour and the
  depth and nothing about the surface it is reflecting off. Recovering the
  roughness and the wetness would mean a G-buffer — a second pass over the
  geometry — or a height test in screen space, which is a material flag written
  down somewhere else. In the material both are already in registers, so the
  march is masked to the fragments that have a mirror on them.
- **Against the previous frame.** A forward pass cannot read the target it is
  writing. Colour and linear view depth come from the frame before, reprojected
  through that frame's own view-projection, so a moving camera is handled rather
  than ignored.
- **Depth rides in the alpha of the HDR target.** Every material in this project
  is opaque and the composite reads `.rgb`; attaching a DepthTexture to a 4×
  multisampled target is a second surface, a second resolve and a per-backend
  behaviour. The sky background writes a sentinel depth so a ray that leaves the
  geometry can never report a hit on the sky.
- **Bounded, and the bounds are compile-time.** Fixed step count, fixed
  refinement count, fixed maximum distance, a roughness above which the pass is
  switched off entirely. An unbounded screen-space pass costs whatever the scene
  happens to be, which is a number nobody can budget.
- **Degradation is graceful by construction.** Off the screen, out of steps, or
  no hit all give weight zero, and what remains is the §5.7 canyon term that was
  there before. SSR only ever *replaces* a fallback that already exists; there is
  no path by which it produces a black pixel.

Constants in `SSR` (`core/constants.js`), source buffer owned by `post.js`,
march owned by `lights.js` — the module that owns the one material injection.
`?ssr=0` restores the session 2 reflections exactly.

### 5.9 Luminaire distribution

A local light may declare an **angular distribution**: two transverse scales
about a named axis, and an angle off that axis at which the optic reaches its
peak candela. Below the peak angle the intensity follows 1/cos³, which is the
profile that puts equal illuminance on every point of a flat road; above it the
intensity holds until a cutoff.

A light that declares none is circular with its maximum on its own axis, which
is what a bulb behind a shop window is. `LIGHT.streetlampCandela` is the **peak**
of the distribution and is not reached at nadir. Any fraction of a luminaire's
output — a leak, a spill — is a fraction of its **lumens**, computed from the
distribution by `src/lib/luminaire.js`, never a fraction of its peak candela.

### 5.10 Internal resolution and temporal antialiasing — session 4

**The scene is rendered at a fixed pixel count and upscaled in the composite.**
`RENDER.pixels` is 2560×1440. The internal buffer matches the display's aspect
ratio at that pixel count, and never exceeds the drawing buffer. Every per-pixel
budget in `tools/budget.json` is a budget against *this* number, and
`capture.viewport` in that file is the internal resolution for exactly that
reason: a gate that measures a different number of pixels from the one the
renderer shades is measuring something nobody is paying for.

**TAA, not FSR.** A spatial upscaler has no history — it reconstructs and
sharpens an edge, which would amplify the frame-to-frame instability of a
single-ray screen-space reflection rather than resolve it. TAA's accumulation is
simultaneously the antialiasing, the SSR denoiser and the upscale.

- **Reprojection came from the depth already in the alpha channel** (§5.8) and
  from nothing else, because every object in this world was static, so camera
  reprojection *was* the complete motion field. That sentence was true through
  session 5 and it said of itself: *the first thing that moves breaks this, and
  it will break it visibly.* **Superseded by §5.11**, which adds the object's
  own displacement as a second term. The camera term is unchanged and the sum
  is exactly the old value wherever nothing moves.
- **It replaces 4× MSAA**, which it more than pays for: 118 MB of multisampled
  RGBA16F against 29.5 MB plus 59 MB of history. It also removes a defect —
  multisample resolve averaged the alpha channel, and the alpha channel is a
  depth, so every silhouette in the SSR source carried a depth that was between
  two surfaces and on neither.
- **The history's alpha is the current frame's depth, unblended.** A blended
  depth is meaningless.
- **The history is fetched at the PIXEL's previous position, not the SURFACE's,
  and the difference is one frame's jitter.** Added in session 13 after the
  static-camera probe named it. The resolve reconstructs the fragment's world
  position from the un-jittered NDC and reprojects it, which gives where the
  surface was; the history buffer is indexed by pixel, so the displacement has
  to be added to *this pixel's own* NDC:

      (2·vUv − 1) + [ prevNdc − (2·vUv − 1 − uJitter) ]  =  prevNdc + uJitter

  Session 12 and every session before it omitted the `+ uJitter`, so every
  pixel of every frame fetched its history up to half a pixel away, cycling
  through the eight Halton offsets. Zero cost on a flat surface, the whole of
  the error on an edge, and invisible to a gate because the clamp turns wrong
  history into *lost accumulation* rather than a smear. Measured: **4.729% of
  pixels flickering ≥8 code values against 0.668% with the term restored**, with
  the neighbourhood clamp and the blend weighting both refuted as causes on the
  same instrument. `post.js` → `TAA_JITTER_COMP`, and the arm that restores the
  defect is kept.

- **Neighbourhood clipping is in YCoCg**, tonemapped by `c/(1+luma)` before the
  blend and inverted after. Without the weighting the average of a buffer that
  spans 1e-3 to 6e4 belongs to whichever pixel caught the sun.
- **The SSR source is copied from the raw HDR target, never from the resolve.**
  The resolve contains the previous frame's reflection; feeding it back makes a
  wet road reflect a wet road reflecting a wet road.
- **History is dropped** on resize, on a discontinuous `timeOfDay`, and by
  `post.resetHistory()` for anything else that makes the previous frame a
  description of a different world.
- **`harness.settle()` converges it** over `TAA.settleFrames`. A capture that
  depends on how many frames the machine happened to render is not a capture.
- **AND IT NORMALISES THE PHASE, WHICH THAT SENTENCE DID NOT COVER — session
  70.** `TAA.settleFrames` is 32 and 32 is a MULTIPLE of `jitterSamples`, so
  converging the AVERAGE preserved the sub-pixel OFFSET exactly: the captured
  frame was drawn at `JITTER[n % 8]` for an `n` that `waitForCity` set by
  polling a worker in wall-clock milliseconds. Measured over 35 runs of one
  source: arrivals 2 808 to 3 038, and two captures at two of the eight phases
  differing by 57 801 to 78 979 bytes of 3 499 200 where two at one phase differ
  by 0. `settle()` now pads to a fixed residue of `post.frameIndex` and drops
  the history there, so what follows is a constant `8 + settleFrames + frames`
  frames from a defined start at a fixed sequence of offsets. **Padding alone
  was built first and measured first, and it is NOT enough** — it left 13 774 to
  33 813 bytes and a period of still exactly 8, because holding the final phase
  fixed requires the frame count since the history was dropped to be congruent
  to −(that frame's index) mod 8, and that index is the race. One knob, two
  constraints; the history drop is the second knob. Ten pins across 4000–4009
  plus three unpinned races now deliver one md5.

### 5.11 Motion vectors — the strategy, decided in this session

**A second attachment on the HDR target, carrying the object's own screen-space
displacement and nothing else.**

This is the entry §5.10 predicted in writing. It was written before anything
moved and it is closed before anything moves — deliberately, because if it
landed after the traffic system there would be two new systems and one symptom,
and the symptom would look like a traffic bug.

- **The arithmetic that made it necessary.** A vehicle at 12 m/s at 30 m crosses
  the frame at about ten pixels a frame at the gate's 50° fov and internal
  resolution, against a ±1 px neighbourhood clamp. Camera-only reprojection puts
  the history lookup ten pixels away from where that surface actually was, so the
  clamp rejects it every frame and the object never accumulates. It does not
  ghost — the clamp guarantees that — it **aliases**, which is the harder defect
  to attribute because it looks like a missing antialiasing setting rather than a
  broken reprojection.

- **RG16F at the internal resolution.** 2560 × 1440 × 2 × 2 = 14 745 600 B,
  which is 14.06 **MiB** — the unit `harness.info()` reports in — so the
  delivered total is 116.3 → **130.4 MB** against a 192 MB ceiling, and not the
  131.0 the decimal arithmetic gives. Both are written down because the two
  units were mixed once already. Two channels
  because a screen displacement has two components; half float because the
  quantity is an NDC delta whose relative precision at 1 is 4.9e-4, which is a
  third of a pixel in the worst case and a hundredth of one at the displacements
  this exists to carry.

- **It holds the OBJECT's motion, not the total.** `prevNdc(where this surface
  was) − prevNdc(where it is)`, both through the same previous view-projection,
  so the camera's contribution cancels inside it. The resolve adds it to the
  camera reprojection it already computed. The two are summed, never chosen
  between: a moving object seen from a moving camera needs both, and an engine
  that picks one is correct in whichever of the two cases nobody tests.

- **Exactly zero over a static world, arithmetically and not by a branch.** The
  object's previous transform enters as `prevModel · inverse(model)`, which is
  the identity for everything in the project today, so the shader computes a
  difference of two identical expressions. Measured: **0 of 5 760 000 texels**
  above the debug view's 6.1e-5 NDC encoding floor.

  **The TERM is bit-exact; the FRAMES are not, and the difference between those
  two sentences is worth the paragraph.** Adding a second fragment output
  changes the shader source, so every patched material and the sky background
  recompile, and the driver's codegen — fma contraction, reassociation — is not
  obliged to produce the same last digit. Measured against session 5 across the
  four look frames: mean luma moved by at most 0.0003 (dusk, 0.08 of 255), the
  largest pairwise MSD by 1.7e-4, and three emitter components of thirty-two
  crossed a threshold at noon. No assertion changed side; the tightest, `dusk
  mean` against a 0.140 floor, went 0.1431 → 0.1428. **Do not write "bit for
  bit" about a change that recompiles a shader.**

- **One mat4 uniform, per material, and no new varying.** The delta maps this
  frame's world position to last frame's, and `vNoctisWorldPos` is already a
  perspective-correct varying. The alternative was two clip-space varyings —
  eight floats on every vertex of a million-triangle city to carry a value that
  is currently zero everywhere.

- **Every material that draws into the HDR target must write location 1.** A
  fragment shader that writes location 0 and not location 1 leaves location 1
  *undefined* — not cleared, not preserved. This is the same rule §5.6 and §5.7
  state about unpatched materials, with one difference that matters: "outside
  the lighting model" is visible and "outside the motion field" is undefined
  memory. The sky background is the one unpatched material in the scene and it
  writes zero by hand.

- **The limit, stated here rather than discovered in 4b.** One delta per material
  is one delta per draw call, so an `InstancedMesh` whose instances move
  independently — which is what a traffic system is — cannot use this. Rigid
  non-instanced objects are covered. Per-instance motion needs a previous
  `instanceMatrix`, which is a second instanced attribute and a decision 4b has
  to make.

Attachment owned by `post.js`, written by the material injection in `lights.js`,
verified by `tools/motioncheck.mjs` on one scripted box. Not a gate: the probe is
an instrument the harness creates on request, and a gate whose subject the
operator creates measures the operator (§7, on `lookat.mjs`, for the same
reason).

### 5.12 Per-instance motion vectors — the strategy, decided in session 4b

**A second instanced attribute holding the previous frame's `instanceMatrix`,
double-buffered, and the swap is an invariant rather than a convention.**

This is the limit §5.11 wrote down for itself, closed. 64 bytes an instance:
6.0 KiB for 96 vehicle bodies, 22.5 KiB for 360 pedestrians. Negligible, and
that is the point — the cheaper alternative was rejected on generality rather
than on cost.

- **Why not reconstruct the previous position analytically.** A vertex shader
  can recover where a vehicle was from its spline parameter and dt, for nothing.
  It works for traffic and it does not work for a person walking to a shop,
  whose path is a destination and a steering term rather than a curve with a
  parameter. Two mechanisms for one thing are worse than one that costs slightly
  more, and the one that generalises is the one that survives the next system.

- **Why a swap and not a copy.** `memcpy(prev, cur)` before overwriting `cur`
  uploads both buffers every frame. A swap uploads one: the buffer that becomes
  *previous* was uploaded last frame as *current* and its GPU copy is already
  correct.

- **It suppresses something for the first time in session 20, and the sentence
  below about "a bound, not an optimisation" is now historical.** `aircraft.js`
  flies at 150 to 900 m against a fuselage cutoff of 521 m, so an aeroplane at
  cruise is past its own threshold and is carried; and every navigation lamp on
  every airframe is carried on every frame, because a 0.22 m housing's cutoff is
  85 m and nothing flies that low. That is the threshold working rather than a
  gap — a 0.22 m box at 400 m is a fifth of a pixel and there is no history for
  a clamp to reject — and it is the first system where the bound is a decision
  rather than a bound.

  **It is also where the OTHER pixel floor turned up.** 4 px is the size at
  which an object can express reprojection error; **3 px**
  (`particles.maxStreakWidthPx`, derived a session earlier from what an
  antialiased line needs under the same jitter) is the size at which one can be
  DRAWN at all. A nav lamp qualifies for the second and not the first, and the
  quantity conserved when it is grown to that floor is its INTENSITY rather than
  its radiance — §9's table, session 20, row 1.

- **The size threshold: 4 px, and it comes from the clamp.** An instance whose
  smallest projected extent is under four pixels gets no motion vector at all.
  A motion vector exists to stop the TAA neighbourhood clamp rejecting an
  object's own history every frame, and the clamp can only reject displaced
  history when the clip box *excludes the background* — the box is built from a
  3×3 neighbourhood, so the fragment's whole 3×3 must lie inside the silhouette.
  Under the ±0.5 px Halton jitter the silhouette's sub-pixel phase is arbitrary,
  and a 1-D interval of length *w* at arbitrary phase covers at least ⌊w⌋−1
  pixels completely; three consecutive fully covered pixels therefore need
  ⌊w⌋−1 ≥ 3, i.e. **w ≥ 4**. Both screen dimensions must satisfy it, so the
  binding quantity is the instance's *smallest* extent and not its bounding
  sphere. The number is a property of a 3×3 filter under half-pixel jitter and
  is independent of resolution and field of view.

  **It is reached from the other end too.** `particles.maxStreakWidthPx` is 3,
  derived a session earlier from what an antialiased line needs under the same
  jitter. 3 < 4, so a rain streak can never qualify — rain's exclusion is an
  arithmetic consequence of two independent derivations agreeing rather than a
  special case somebody remembered to write.

  Stated plainly, it suppresses nothing today: traffic is simulated inside
  190 m and pedestrians inside 120 m against cutoffs of 560 m and 174 m. It is
  a bound, not an optimisation.

- **The swap discipline is enforced, not documented.** A buffer written and read
  in the same frame is the same class of mistake as a value in config the code
  does not read (§9.1) and it fails the same way: previous equals current, every
  vector is exactly zero, and the symptom — traffic aliasing — is
  indistinguishable from never having built this. So `src/core/instmotion.js`
  stamps every write with its frame id and `read()` **throws** when handed the
  buffer written this frame. A module that throws is quarantined (§2.1),
  `ctx.faults` stops being empty, and every gate in the project already asserts
  that array is empty. One invariant, six gates, no new gate.

- **Three buffer states and not two.** `NEVER` is a buffer nobody has written,
  and reading one is a fault rather than a zero: an unbound `mat4` attribute is
  four columns of (0,0,0,1), which is **singular, not the identity**, and would
  collapse every instance onto the origin. `PRIMED` is seeded at construction,
  is older than any frame, and is the correct *previous* for frame zero.

- **A recycled instance is a teleport and gets no vector.** A vehicle re-seeded
  at the far edge of the ring, a pedestrian re-seated as the ring moves: its
  genuine previous transform is hundreds of metres away and the vector across
  that gap is bookkeeping, not motion. Same mechanism as the size threshold —
  `carry(i)` forces previous equal to current for that row.

- **The offset is a difference of matrices, not of positions.** The vertex
  injection emits `(prevInstanceMatrix − instanceMatrix) · vertex`, which is
  exactly the zero vector for a stationary instance, so §5.11's guarantee —
  exactly zero over a static world, arithmetically and not by a branch —
  survives one level down. Building a parallel `prev · vertex → model` chain
  instead gives two expressions that are equal in exact arithmetic and are not
  obliged to be equal in the driver's. It also costs 3 varying floats rather
  than 6, because one world position is already a varying and only the delta is
  new.

- **The attribute is gated on a define and lives on the geometry.** `noctisRough`
  gets away with "absent means zero" because a float's default generic attribute
  is 0 and that is a usable sentinel; there is no value of an unbound `mat4`
  that means "no override". So `lights.patch(m, { prevInstance: true })` sets
  `NOCTIS_PREV_INSTANCE`, which forks a second program through three's own cache
  key, and the city's million triangles never compile the branch.

Owned by `src/core/instmotion.js`, injected by `lights.js`, asserted by
`perfcheck` from `harness.instanceMotionStats()` — the CPU bookkeeping, not the
attachment, because §8 forbids a gate from rendering through `showMotion`.

---

## 6. Config and determinism

`ctx.config` is frozen at boot: defaults overridden by URL query params.

| Param | Default | Meaning |
|---|---|---|
| `seed` | `1337` | Root seed for every PRNG stream. |
| `t` | `0.78` | Initial `timeOfDay`. |
| `perf` | `0` | `1` attaches `perf-probe.js` and exposes the harness. |
| `paused` | `0` | `1` boots with time paused. |
| `debug` | `''` | Comma-separated module names to log verbosely. |
| `wet` | `0` | Surface wetness, 0..1. Session 4's weather owns it; the look gate captures both ends. |
| `indirect` | `1` | `0` turns off every §5.7 term. The session 2 bisecting switch. |
| `ssr` | `1` | `0` turns off §5.8. The session 3 bisecting switch. |
| `traffic` | `1` | `0` removes the traffic module. Session 4b bisecting switch. |
| `rain` | `1` | `0` removes the weather module and its three particle layers. |
| `rainfall` | `-1` | How hard it is raining, 0..1, where 1 is `RAIN_FULL_MMH` = 10 mm/h. **`-1` defers to `weather.js`'s shower cycle**; `>= 0` pins it and the cycle does not run. Session 44, and the reason it is a parameter is that for forty-three sessions rainfall had a setter, a harness method, a HUD readout and NO CALLER — `night_rain` is a route carrying `wet: 0.85` with no rain in it, and every frame this project had taken was a frame in clear air (STATE 43 §1.3). The cycle is derived in `weather.js` from that module's own wetting and drying constants plus one climatological citation, and it is phased so that `now = 0` is thirty minutes past a shower — which is where `main.js`'s `wet: 0.55` already came from, so the two defaults describe one city instead of drifting apart. NO GATE PASSES IT: `budget.json`'s `capture.params` does not carry it, and the next shower is 872 simulated seconds after boot against a longest measurement window of 100, so every gate renders `rainfall` exactly 0 as it always has. `tools/lookat.mjs --params=rainfall=0.6` is the sweep, the same arrangement `fill` uses. |
| `streetlife` | `1` | `0` removes pedestrians and street-level stalls. |
| `fault` | `''` | `module:phase` fault injection, comma-separated. Drives `faultcheck`. |
| `quayLamps` | `1` | `0` removes the promenade lamp line from both quays. A SUB-CONTENT switch read inside `city.js`, not a `register()` that does not happen: a bisecting switch omits a *module*, and this is one band of furniture inside one, so there is no module to leave unregistered. Same arrangement as `fieldDrip`. Session 16's arm, and arm B is the frame that made the operator ask why the far bank was dark. |
| `player` | `0` | `1` registers the first-person controller (§11) and hands it `ctx.camera`. OFF by default, and that is what keeps the harness safe: `runRoute`, `poseRoute` and `setShotAt` drive every gate and both film tools, and a second writer of `ctx.camera` is not a race with a winner but a frame that alternates between two answers at whatever the update order happens to be. An ordinary bisecting switch — the `register()` does not happen — so every gate runs in the state it has run in for sixteen sessions. |
| `spawn` | `''` | `x,y,z` — where the player stands. Empty means `PLAYER.spawn`. Two components stand on the ground; three are honoured as written, including a `y` in the air. It exists because free movement goes places no route has been and what it turns up is a POSITION: `P` prints a paste-ready URL carrying this, `t` and `seed`, which is the whole of what it takes to get back. A find nobody can return to is a memory. |
| `moving` | `1` | `0` removes the viaduct's trains and the cranes' slewing assemblies. Session 21's bisecting switch, an ordinary one: the `register()` does not happen. |
| `fill` | `-1` | The frontage fill law's power — `citygen.js`'s `FRONTAGE_FILL.power`, the fraction of a block frontage that carries a building. **`-1` defers to the shipped law**; `>= 0` overrides it, applied in `main.js` before the first `generateChunk`. Session 37's arm, and the reason it is a parameter is the one this section already gives: choosing a fill BY LOOKING means one frame per arm, and every session before this one got those frames by editing the generator between shots — two states of one file that have to be kept in step, §9.1's own failure mode, and a frame nobody can retake. NO GATE PASSES IT: `budget.json`'s `capture.params` does not carry it and `lookcheck`, `citycheck` and `perfcheck` render the shipped law. `tools/lookat.mjs --params=fill=0.5` is the sweep. |
| `moonshare` | `-1` | The moon redistribution's k — the fraction of the pollution dome's horizontal illuminance handed to the moon's directional term at constant total lux (session 56, `sky.js` → `computeRedistribution`, LOOK.md §0's "moonlight far above the real figure"). **`-1` defers to `LIGHT.moonRedistribution`** = 0.85; `>= 0` pins, and `0` is the bisecting arm that restores the pre-56 sky. It is a parameter for the same reason `fill` is: the value is a LOOK decision, chosen by sweeping delivered midnight frames (`tools/lookat.mjs --params=moonshare=K`), and an arm must be a URL rather than an edit. NO GATE PASSES IT: `budget.json`'s `capture.params` does not carry it, so every gate renders the shipped constant. |
| `fieldDrip` | `-1` | Canyon field layers uploaded per frame per array. `-1` defers to `CITY.fieldLayersPerFrame`; **`0` is the burst** — every layer of a landed bake flagged in the frame it lands; `N > 0` overrides. A SCHEDULE, not content: every value delivers the same bytes to the same slots and flips the same table entries, and what differs is how many `texSubImage3D` calls one frame is asked for. Session 10's `night_rain` A/B is two arms of this parameter (`loftprobe --aparams=fieldDrip=4 --bparams=fieldDrip=0`), which is why it is a number here rather than two copies of `canyon.js` that would have to be kept in step (§9.1). |

**Every content system gets a bisecting switch, and it is registered in
`main.js` rather than branched inside the module.** `indirect` and `ssr` exist
because sessions 2 and 3 each needed to attribute a look change to one term;
session 4b needed to attribute a *cost* to one of three systems that landed
together and could not, because it had shipped all three without switches. A
switch omits the `register()` call — `ctx.get()` returning `undefined` is
already what quarantine looks like from the outside (§1.2), every consumer must
handle it, and `main.js` is the one file allowed to know a module by name (§0.1),
so the alternative would put an `if (enabled)` in three files instead of a
predicate in one. **Arms must be interleaved when measured**: on this machine
five sequential arms drifted far enough that removing a whole system measured
1.3 ms *slower* than leaving it in (§9 rule 6, and STATE.md records the run).

**Determinism rule:** every random number comes from `ctx.rng(stream)`. Streams are
independent, so adding a new system cannot shift an existing one's sequence. Never
call `Math.random()`. Never seed from `Date.now()`.

---

## 7. Files

```
CONTRACT.md              this file
STATE.md                 rewritten at the end of every session
index.html
src/
  main.js                bootstrap only: renderer, scene, camera, ctx, register, loop
  core/                  infrastructure. Knows no module by name.
    constants.js         shared physical constants, and why each one is that number
    context.js           ctx: registry, quarantine, events, rng
    fullscreen.js        the one triangle every post pass draws
    instmotion.js        §5.12. The per-instance previous-transform double
                         buffer, and the swap invariant that THROWS rather than
                         returning the buffer it just wrote.
    loop.js              the frame loop, dt clamping, harness stepping
  lib/                   pure helpers. No state, no ctx, no three-scene objects.
    atmosphere.js        the scattering model + the GLSL emitted from it
    color.js             blackbody and emitter chromaticities, linear sRGB
    rng.js               seeded streams
    solar.js             sun and moon position from timeOfDay
    canyon.js            the indirect-light bake, §5.7. Pure: boxes in, bytes out.
    gait.js              the walking model + the GLSL emitted from it, the same
                         arrangement atmosphere.js has. ONE copy, because the
                         vertex shader displaces the limbs and `harness.
                         silhouettes` must project the SAME displaced vertices
                         or a gate measures a figure the frame does not draw.
    luminaire.js         the flux of the §5.9 distribution. Pure: an integral.
    occupancy.js         SESSION 21. THE ONE KEEP-OUT REGISTRY. A list of
                         axis-aligned claims, each carrying a CATEGORY, a
                         footprint and a VERTICAL EXTENT, plus the table of
                         which categories may not overlap which. Every
                         generator writes to it and reads from it; `citycheck`
                         runs the same table over the DELIVERED scene. It
                         exists because §9.1's placement rule had been broken
                         seven times in seven placement routines, each with its
                         own private idea of what "already there" meant, and
                         seven instances is not seven bugs.
  modules/               one file per module, factory named create<Name>
    block.js camera.js canyon.js exposure.js harness.js
    lighting.js lights.js post.js sky.js time.js
    traffic.js           §5.12 content. 160 vehicles on the chunk lattice, 96
                         headlamp slots assigned by distance, five body types,
                         signalised junctions. Splines, not pathfinding.
                         Four body boxes and four wheels an instance since the
                         §7.2 session: a hull, a glazing band, a SILL that is a
                         reflectance standing in for an occlusion the §5.7 field
                         cannot resolve, and a fourth box that is a trailer on
                         the hauler and an upper body elsewhere.
    weather.js           rainfall and wetness as TWO states. Three bounded
                         particle layers; the far field is `setHaze` extinction
                         and not a mist system.
    streetlife.js        pedestrians with destinations, and street-level stalls.
    aircraft.js          SESSION 20, item 5. Six airframes over the city — three
                         aeroplanes, two transiting helicopters and one
                         orbiting with a searchlight. THE FIRST CONTENT IN THE
                         PROJECT THAT MOVES IN THREE DIMENSIONS, so it is the
                         first thing §5.12's 4 px threshold actually suppresses
                         rather than bounds. 2 draws, 54 instances, 648
                         triangles, ONE cluster slot — the searchlight; the
                         thirty navigation lamps are emissive geometry at zero
                         slots, by the tail-lamp argument. `?aircraft=0`.
    moving.js            SESSION 21, items 2 and 4. The two things in this
                         city that move and are not vehicles: the viaduct's
                         trains and the construction cranes' slewing jibs.
                         ONE module because they are one piece of engineering —
                         rigid boxes on a scripted path, above eye level, both
                         needing §5.12's previous transform — and two draw
                         calls instead of four against a ceiling
                         `highway_speed` sits 9 under. `?moving=0`. SESSION 23:
                         the train gains a RAKED NOSE at each end of each unit —
                         one box a car allocated, four drawn, +48 triangles and
                         no new draw call — and its turn-round clamp now uses
                         the train's EXTENT rather than its body length, because
                         the two stopped being the same number the moment the
                         nose existed. The roof cap the same brief asked for was
                         already the second box of every car and is measured
                         rather than added twice (`tools/trainprobe.mjs`).
    hud.js               SESSION 20, item 6. The instrument panel, four levels
                         on `H`. Colours against `HUD.budgets`, which
                         `perfcheck` asserts equals `budget.json`'s ceilings —
                         a module may not import a gate's contract (§2.2), so
                         the copy is checked rather than trusted. It measures
                         the rAF CALLBACK through `loop.timing()` and subtracts
                         its own cost through `loop.reportOverhead()`, because
                         a meter that measures the meter is what `filmshot`
                         caught when a PNG readback landed inside the frame
                         interval. It will NOT print a measured EV: that number
                         is a 1x1 GPU target and §5.4 forbids the readback, so
                         the panel prints the exposure LAW and says where the
                         measurement is. SESSION 23: it also refuses to
                         COLOUR a number against a ceiling that number
                         cannot express. `wallFrameMsP95` is defined on
                         the interval with vsync DISABLED; in a browser
                         the interval is `max(work, T)`, so the cell was
                         red for every possible state of the world. It
                         reads the CENSORED observation instead —
                         neutral at 60 Hz, GREEN at 120 where a held
                         lock PROVES the work, RED on a dropped frame at
                         every rate. No ceiling moved and no gate
                         changed; `HUD.budgets` is byte-identical.
    player.js            §11, SESSION 17. The first-person controller. ONE
                         state — no interiors, no vehicle to enter, no second
                         mode. Reads the session-3 walkability mask through
                         `city.walkableAt` rather than carrying a collision
                         system of its own, follows the ground through
                         `city`/`block`/`river`'s own `surfaceAt`, and
                         integrates `time.now` like the four other things in
                         this world that move. Registered only with `?player=1`.
tools/
  budget.json            performance + content contract (sessions 3+)
  walkprobe.mjs          NOT A GATE. SESSION 17. Walks the city through the
                         PLAYER — synthetic stick deflections through the same
                         dead zone, curve, mask and ground query a thumb drives
                         — and writes down where it ended up. Also prints
                         `walkableAt` against the rasterised mask cell by cell
                         (§9 rule 2, the same quantity two ways) and the ground
                         height across a street, which is how the kerb finding
                         was measured rather than read.
  walk-out/              walkprobe's frames, trails and log. Nothing reads them
                         but a person.
  look-budget.json       the look contract
  parsecheck.mjs         syntactic completeness + contract structure
  faultcheck.mjs         session 2 gate: quarantine (§2.1), machine-checked
  lookcheck.mjs          look gate: four times of day, dry and wet, asserted
  gateaudit.mjs          session 2 gate: does every threshold in look-budget
                         actually reject a frame that violates it — and, since
                         session 5, does every assertion actually RUN
  perfcheck.mjs          session 3 gate. Since this session it also asserts the
                         particle fill bound and the clustered grid's occupancy
                         margin — both against content that does not exist yet,
                         and both therefore red. See budget.json $SESSION_NOTE.
  input-budget.json      the input contract, session 18
  inputcheck.mjs         SESSION 18 GATE. Does the input layer DELIVER what it
                         declares? Real browser key and mouse events at the real
                         listener targets, plus a synthetic gamepad, and every
                         assertion compares a DELIVERED quantity against the
                         constant that is supposed to produce it — never against
                         another declaration (§9.1). It exists because
                         `walkprobe` drives `setSynthetic()`, which enters the
                         module BELOW the listeners, so the whole input layer
                         had no test at all: session 17 specified three devices
                         and session 18's walkthrough reported two of them dead.
                         THE MAGNITUDE IS THE POINT. "Press W, assert it moved"
                         passes on the build that was reported broken, because a
                         boolean cannot tell "not wired" from "wired and
                         imperceptible" and those need different repairs — so
                         the mouse also carries a USABILITY BAND in cm/360°,
                         bounded below by one count per pixel and above by a
                         180° turn in one 30 cm sweep.
  windcheck.mjs          SESSION 14 GATE. THE WINDING OF EVERY GENERATED MESH,
                         three tests whose blind spots do not overlap: signed
                         volume over closed meshes, authored normal against
                         triangle facing, and front-facing area from a spread
                         of eyes on the gate's own routes. Four §7.3 controls
                         live IN THE SCENE — a correct box, a reversed box, a
                         correctly wound ground quad, and the exact quad
                         `buildGround` shipped for thirteen sessions.
  lib/winding.mjs        the arithmetic and the controls' EXPECTED outcomes for
                         all three tests, including the two declared blind
                         spots: facing cannot see a reversed CLOSED solid,
                         volume cannot see an OPEN surface. Both asserted, so
                         neither can move unnoticed. §7.6's rule, one metric
                         family over.
  lookdiff.mjs           NOT A GATE. Two sets of look frames through ONE metric
                         — what moved and by how much — so a threshold derived
                         against an older scene can be read against a newer
                         one. Asserts nothing and must not.
  clustercheck.mjs       NOT A GATE. The froxel grid with the light pool
                         saturated by placeholder headlights, and the cone
                         bound's A/B. perfcheck owns the assertion; this is the
                         instrument the assertion's numbers came from, so that
                         they can be reproduced rather than quoted.
  motioncheck.mjs        NOT A GATE. §5.11 on one scripted moving box: the
                         attachment is zero over a static world, non-zero
                         exactly on the box, the right magnitude, and read by
                         the resolve.
  uploadprobe.mjs        NOT A GATE. The §5.12 per-frame instance upload,
                         interleaved on/off with a fresh page per arm and the
                         counts asserted identical across arms. The third
                         hypothesis about traffic's frame-time tail, and the
                         run that refuted it.
  lib/silhouette.mjs     Shared by perfcheck: the §7.2 and §7.4 measurements.
                         Rasterises the union of a subject's per-box convex
                         hulls against the DELIVERED screenshot and reports
                         ground-contact contrast, tone- and width-profile
                         roughness, chromaticity clusters and the roofline's
                         height span along the subject's own long axis. Carries
                         §7.3's two control shapes. Asserts nothing itself.
  profileprobe.mjs       NOT A GATE. The §7.4 roofline with its working shown:
                         the per-vehicle station heights as numbers, and the
                         stations drawn over the delivered frame so a person can
                         see which pixels were read. It exists because session
                         5's ground-contact defect was found by cropping a
                         failing subject out of the frame and looking at it, and
                         nothing made that easy.
  filmshot.mjs           NOT A GATE. The film, and — since session 13 —
                         `--static`, the shimmer instrument: camera locked,
                         clock paused, thirty seconds, and a per-pixel temporal
                         RANGE in sRGB code values. Two of its arms are the
                         controls §7.3 requires (jitter off must read the
                         dither floor, accumulation off must read the raw
                         aliasing), and two of the three candidate mechanisms
                         are excluded by the ARRANGEMENT rather than by an arm —
                         a locked camera cannot stream, and it measures that
                         rather than assuming it.
  gaitstrip.mjs          NOT A GATE. One pedestrian, the whole gait cycle, four
                         views, tiled. Both of session 12's defects and this
                         session's feet were judged here.
  routeprobe.mjs         NOT A GATE. SESSION 20. Two routes, or one route and
                         one changed camera parameter, INTERLEAVED and PAIRED —
                         a fresh page per arm, A B A B, and the reported
                         statistic is the mean of the per-pair differences with
                         its standard error, so drift common to a pair cancels
                         instead of being attributed to whichever arm ran
                         second. `--decompose` applies `player`'s five camera
                         parameters to `downtown_dense` ONE AT A TIME through
                         `camera.setRouteOverride`, plus a sixth arm with all
                         five, whose disagreement with the sum of the five is
                         the interaction a five-way difference hides.
  heightprobe.mjs        NOT A GATE. SESSION 20. The building height
                         distribution, BOTH ARMS, through the pure generator
                         and no browser: Σ floors and facade area, which are
                         what a window count is proportional to and which a
                         mean is not. `HEIGHT_DISTRIBUTION.mode` is the arm, in
                         the `?fieldDrip` shape — one parameter with two arms
                         rather than two copies of a module.
  benchprobe.mjs         NOT A GATE. SESSION 22. The GENERATOR's claim for a
                         prop printed beside the box that was DELIVERED for it,
                         as (half-x, half-z) pairs — CONTRACT §9 rule 2, and a
                         transposition is legible in that form and in no other.
                         `citycheck` → `occupancy` had been reporting 0 on the
                         generator's registry and 60 on the delivered census for
                         a session, which is a COUNT of a disagreement and says
                         nothing about which of the two rectangles is wrong.
                         Also `--claims=FILE`, a sorted full-precision dump of
                         the registry over the gate's own region, so a change
                         that touches only an emitted matrix can be ASSERTED to
                         leave the registry byte-identical rather than argued to.
                         Asserts nothing; `citycheck` owns the verdict, the same
                         arrangement `clustercheck` has with `perfcheck`.
  vsyncprobe.mjs         NOT A GATE. SESSION 23. The HUD's vsync-lock detector
                         over frame-interval sequences whose answer is known BY
                         CONSTRUCTION, in both directions (§7.3) — a held 60 Hz
                         lock, a lock dropping one frame in ten, a held 120 Hz
                         lock, an unlocked machine inside the ceiling, an
                         unlocked machine BREACHING it, and a steady GPU-bound
                         machine that the detector CANNOT tell from a lock and
                         says so. No browser: the detector is pure and every
                         input is synthesised. It asserts nothing and must not —
                         `hud.js` displays, it does not gate, so a gate case
                         here would be inventing an assertion to have something
                         to falsify.
  portalprobe.mjs        NOT A GATE. SESSION 23. Where the viaduct's two ends
                         land, what the registry says is on that ground, who can
                         see them, and a `conflict()` sweep of candidate portal
                         footprints — all printed BEFORE anything is built
                         there, because session 5 re-aimed a whole arc for want
                         of exactly this. It is also where the answer *"no gate
                         camera in this project sees either end"* is a number
                         rather than an impression: all four routes run down the
                         main street at |z| <= 3.0 and the ends are 202 m and
                         224 m off that axis.
  trainprobe.mjs         NOT A GATE. SESSION 23. The train's section as numbers
                         — which is how *"the roof cap the brief asked for has
                         been there since session 21"* became a column rather
                         than a sentence — and the raked nose's corners against
                         the two points the design specifies, through the
                         module's OWN `Matrix4.compose`, swept over four yaws
                         (§7.3.1). Its negative arms REFUTED the comment they
                         were written to confirm, which is §7.7 working.
  lampprobe.mjs          NOT A GATE. SESSION 23. Tree crowns against lamp heads,
                         and the reason the answer is a count and not a repair:
                         the `lamppost` PROP the question was asked about is
                         placed ZERO times over the gate's region, and the 790
                         lamps that do light this city are emitted by `city.js`
                         directly and are in NO registry band at all — not their
                         column, not their head. Measures and stops there.
  queueprobe.mjs         NOT A GATE. SESSION 21. The traffic queue at every
                         junction over several full signal cycles, so the
                         distinction that decides item 5 can be made: a queue
                         that empties every cycle is CONGESTION and the
                         question is the density; one that grows without bound
                         is a DEADLOCK and the question is the mechanism. A
                         single frame cannot tell those apart, which is why the
                         operator's aerial shot could not. Asserts nothing.
  airprobe.mjs           NOT A GATE. SESSION 20. Where the aircraft are, what
                         the module says about itself, and one frame down the
                         searchlight's own beam. It exists because an empty sky
                         has three candidate causes — quarantined, seeded
                         elsewhere, or sub-pixel — and a picture distinguishes
                         none of them while three printed lines distinguish all
                         three.
  lampaimprobe.mjs       NOT A GATE. SESSION 68. IS THE LAMP HEAD OVER THE
                         THING IT LIGHTS? It exists because a street lamp's yaw
                         is `(axis === 'x' ? 0 : -90) + (side < 0 ? 180 : 0)` —
                         CARDINAL, off the chunk lattice, with no road tangent
                         in it — so a heading measured against a tangent ALSO
                         derived from that lattice would agree with itself and
                         prove nothing. It reads the two DELIVERED matrices,
                         `city:lamps` and `city:bowls`, and judges them with
                         `inRiver`, a predicate no lamp has ever consulted. Its
                         two-sided control is that `columnsOverWater` must be 0
                         — the generator has refused those since session 19 —
                         and that `aimed` must be most of `bowls`, because a run
                         that paired nothing would report "0 heads over water"
                         and read as a pass. NAMED `lampaimprobe` AND NOT
                         `lampprobe` because session 23 already owns that name
                         for a different question — a tree crown growing into a
                         lamp head. This session overwrote that file and
                         restored it; the near-miss is recorded here because a
                         filename is a name like any other.
  albedoprobe.mjs        NOT A GATE. SESSION 67. WHAT IS THE GROUND'S
                         REFLECTANCE, AND WHAT DOES THE SKY THINK IT IS? It
                         exists because `ATM.groundAlbedo` and
                         `GROUND.earthAlbedo` were two constants carrying the
                         same sentence — *"the area-weighted mean of the city's
                         own drawn ground"* — one with a derivation and one
                         without, disagreeing by 1.21x in luminance and 4.0x in
                         saturation. It reads the DELIVERED vertex colour times
                         the material colour, area-weighted by PLAN footprint
                         because the question is what a ray pointing down sees,
                         and it runs two §7.3 controls 5.1x apart BEFORE it
                         reports anything: `block:markings` must return
                         `ROAD_PAINT.albedo`, and `block:ground` inside the flat
                         disc must return `GROUND.earthAlbedo` — the second
                         exercising the vertex-colour multiply the first does
                         not.
  waterprobe.mjs         NOT A GATE. SESSION 66. DOES A HULL SIT IN THE
                         WATER? It reads the DELIVERED `instanceMatrix` and not
                         the generator's return value, because a hull the
                         generator described correctly and `river.js` drew at
                         the wrong y is invisible to the generator. And it
                         carries §7.3's two-sided control on the KINDS rather
                         than on a guess: its own first arm split hull from quay
                         wall by their waterline signatures and the wall
                         population came back EMPTY, because a wall's toe is
                         0.80 m under the water and a launch draws 0.80 m. The
                         control fired, which is the control working. Session
                         65's first false pass is the reason this file exists at
                         all rather than a census of the placement.
  roughcensus.mjs        NOT A GATE. SESSION 65. WHAT EVERY SURFACE IN THIS
                         WORLD CLAIMS ABOUT WATER, in two halves: every mesh
                         this source CONSTRUCTS against a DECLARED table, and
                         every mesh in the DELIVERED scene with its porosity
                         read off its own `noctisRough` buffer. It exists
                         because the same defect has now been found twice one
                         surface apart — `block:ground` in session 64 and the
                         exit-road ribbon in session 65 — and both times by an
                         operator looking at a frame. An `itemSize` of 0 (no
                         attribute), 1 (the pre-session-55 float) and 2 (a
                         chosen porosity) are three different findings and it
                         prints which. The two halves are crossed against each
                         other, because a hand table nothing compares is
                         §9.1's own subject.
  featurecensus.mjs      NOT A GATE. SESSION 65. WHAT THE SHARED FEATURE
                         TRANSFORM PLACES, AND HOW FAR ITS ENDS ARE OFF THE
                         GROUND. `city.js`'s feature loop is ONE `put` closure
                         taking ONE ground sample at a feature's centre and
                         composing a yaw and no pitch; this greps every
                         `f.kind` branch out of that loop, counts the
                         population, and measures TWO quantities that are easy
                         to confuse — how much the ground varies under a
                         footprint (the CAUSE, which no repair moves) and how
                         far a delivered box's own bottom corners are from the
                         ground (the EFFECT, which is what a pitch moves). It
                         also reports what each feature is STANDING ON, which
                         is what separates a hedge on a slope from a house on
                         a level terrace that is too small for it.
  lookat.mjs             NOT A GATE. Stand anywhere, look at anything, write a
                         PNG. §10 step 4 says the numbers are necessary and not
                         sufficient, and until session 5 the only way to look at
                         this world was three fixed shots at eye height in the
                         middle of one block — which is how three unsupported
                         slabs stayed in the centre of every delivered frame for
                         a session. It asserts nothing and it must not: a gate
                         whose camera the operator chooses measures the operator.
  perf-probe.js          in-page instrument
  lib/                   shared by the gates: png.mjs, lookmetrics.mjs,
                         lookassert.mjs, page.mjs
  motion-out/            motioncheck's PNGs, including the motion attachment
                         itself: flat 128,128 everywhere and coloured on the one
                         thing that moves.
  look-out/              lookcheck's PNGs — eight of them, dry and wet — and
                         capture.json, the harness state that went with each,
                         which the structural assertions read and gateaudit
                         perturbs
  shot-out/              lookat.mjs's PNGs. Nothing reads them but a person.
```

`npm run gates` = `parsecheck && faultcheck && lookcheck && windcheck &&
inputcheck && gateaudit && citycheck && perfcheck`. It must exit 0 before any
session ends. Later sessions append gates to it; none are ever removed.

`inputcheck` runs before `gateaudit` for the same reason `windcheck` does:
`gateaudit` runs every gate's `--falsify` as a subprocess, so a gate whose own
self-test is broken should say so in its own voice first.

### 7.1 Every gate has a known case that makes it fail, and that case is exercised

**A gate without one does not count as a gate.** Added in session 4b, and it is a
rule rather than an incident because it is the third time:

| | what it was | how it went quiet |
|---|---|---|
| `facadeAlbedoClusters` | a look assertion | suppressed rather than passing |
| `distinctMaterials` | a content floor | a no-op change moved it by 30% |
| `headroomProbe` | a render-scale probe | `neverExceedNative` clamps the scale, so it renders the same 3 686 400 pixels twice and calls the second one headroom |

None of the three *broke*. Each went quiet, and **a quiet gate is
indistinguishable from a green one in every report this project produces.**

`gateaudit` already did this for `lookcheck`: it perturbs the captures and
requires each threshold to reject, and it fails if any assertion did not run on
the control frames. Nothing did it for `perfcheck` or `citycheck`, whose
assertions read harness instruments rather than frames.

The mechanism:

- Each gate gains a `--falsify` self-test. It builds a fixture that is inside
  every bound, asserts that the fixture produces **zero** failures, then
  perturbs one thing at a time and requires each perturbation to produce at
  least one. **Two-sided**, because a one-sided test passes an assertion that
  rejects everything — and session 4 shipped one of those: a walkability flood
  fill that reached one cell of 67 568. When a check rejects everything, the
  check is usually what is wrong.
- The falsifying case lives **beside the assertion it falsifies**, which is the
  only place it stays in step.
- Coverage is machine-checked, not declared: the self-test scans its own source
  for failure sites and requires a case for each. `budget.json` →
  `falsify.requireCoverage` is 1.0. Anything less is the rule with an exception
  in it. The first run of `perfcheck --falsify` reported 83% against a
  denominator that included six lines which assert nothing — the coverage
  number itself needs its arithmetic checked.
- `gateaudit` runs every gate's `--falsify` as a subprocess, so there is still
  exactly one meta-gate.
- `faultcheck` needs no registry. It is fault injection end to end and every one
  of its cases *is* a known failing case.

### 7.2 A floor that counts categories is paired with one that measures the property

**A count of kinds is not a measurement of the thing the kinds were for.** Added
in this session, as a sibling to §7.1 rather than a special case of it, because
it is a different failure: §7.1 is about a gate that went *quiet*, and this is
about a gate that answered its question correctly and whose question was the
wrong one.

`trafficLights.minBodyTypes: 4` passed at 5. There were five body types and their
roof heights spanned 1.28 to 3.10 m, a 2.4× spread, so the assertion was true.
Every one of the five was a flat-topped box with no wheels, no glazing, no dark
gap at the ground and the same grey paint, and in daylight they read as skips.
**A floor that counts kinds cannot see that all the kinds are the same shape.**
That is the fourth instance of this project's other failure mode, after
`facadeAlbedoClusters`, `distinctMaterials` and the headroom probe — and it
happened in the session that added §7.1.

The rule:

> **Whenever a floor counts categories — body types, material kinds, albedo
> clusters, layers, roles — it is paired with an assertion that measures the
> property the categories were assumed to carry, and the pair is written
> together.** A category floor on its own is a statement about the generator's
> vocabulary. The paired assertion is the statement about the world.

Three things make the pairing real rather than decorative:

- **The paired assertion measures the DELIVERED ARTEFACT, not the description
  that produced it.** §9.1 already says a gate that reads config verifies the
  config; a gate that reads the body-type table verifies the table. The
  silhouette assertions read `page.screenshot()` — the bytes a person opens —
  and the harness supplies only where the geometry projects to. It supplies no
  colour and no verdict.
- **A mask render pass is not allowed, and the reason is §8's about
  `showMotion`.** The obvious way to measure a silhouette is to render one. A
  gate that renders its own subject has stopped measuring the frame that ships.
- **Confirm it RED against the current content before building anything.** This
  is where the rule earns its place. Two structure metrics were written for the
  vehicles and both were *measured green on the very boxes they existed to
  reject* — `darkFraction` scored 0.646 against a 0.16 floor because a convex
  solid in sunlight has one face lit and two not, so the metric was measuring
  which face caught the sun. Written down in `budget.json` under
  `silhouettes.$DISCARDED_darkFraction` rather than deleted, because an
  assertion that cannot fail is the thing this whole section exists to prevent
  and the next session should not write it again.

### 7.3 A metric that measures a property of a shape is checked against a shape that has it and one that does not

**Added in this session, as a sibling to §7.2 rather than a case of it.** §7.1 is
about a gate that went *quiet*. §7.2 is about a gate whose question was the wrong
one. This is about a *metric* whose two answers are the same answer.

`darkFraction` was discarded last session because it scored 0.646 on the flat
grey boxes it existed to reject, against a floor of 0.16. §7.1's "confirm red
before building" is what caught it, and that was luck rather than method: the
negative control existed only because somebody happened to run the metric on the
content it was written for. **Nobody had a positive control.** Nothing in the
project had ever fed that metric a shape that *had* the property, so nothing
could have shown that it answered 0.6-something to everything.

> **Whenever a metric claims to measure a property of a SHAPE, it is run over
> the same code path on a shape that has the property and on a shape that does
> not, and both directions are required to hold before the metric is trusted.
> The two shapes live beside the metric, and the check is a gate's `--falsify`
> case like any other.**

The falsifying cases of §7.1 cannot ask this question. They hand an assertion a
number and check that a bad number is rejected; they never compute one, so a
metric that returns the same number for everything passes all of them.

For the roofline the two shapes are in `tools/lib/silhouette.mjs` →
`SHAPE_CONTROLS`, and `perfcheck --falsify` runs both:

```
prism      [[0.00, 4.90, 1.42]]                                     roofSpan 0.0000
three-box  [[0, 1.47, 0.93], [1.47, 3.43, 1.42], [3.43, 4.90, 1.14]] roofSpan 0.3403
floor                                                                        0.30
```

The positive direction is not decoration. A floor no real body can reach is
§7.1's other failure — a check that rejects everything — and this project has
shipped one of those: the walkability flood fill that reached one cell of 67 568.

#### 7.3.1 A shape control is run over the range of views the population contains

**Added in session 6b, because §7.3 as written above was satisfied by a control
that could not have caught the defect it was written to catch.**

The two shapes above were fed to the metric through an ORTHOGRAPHIC SIDE
ELEVATION: axis-aligned rectangles painted straight into a byte mask, vertical
station segments, no camera, no width, no convex hull, no union of overlapping
hulls. Both directions held — prism 0.0000, three-box 0.3403 — and the delivered
metric was returning **the same 0.02 for a prism, for a reference-era saloon and
for the fleet's own wedge** at three-quarter view. §7.3 says the control goes
through the same code path. The render path is part of the code path, and the
part that was wrong was the part the control had never touched.

The mechanism, because it generalises past this metric: the gate builds a
subject's mask as the union of its per-box convex hulls with no depth test
between the subject's own parts. A box of length `l` and width `w` seen at `θ`
from broadside projects an image-horizontal span of `l·cosθ + w·sinθ`, which
**grows** as the subject turns away from broadside, while the sampled long axis
projects `L·(1−2·trim)·cosθ`, which **shrinks**. Past about 0.86 of the second by
the first, a tall box's hull covers every station and the roofline reads that one
box at all of them.

Measured through the whole render path by `tools/hullprobe.mjs`, which places the
control shapes as real 3D boxes in the live scene at the gate's own camera pose:

```
θ from broadside        0°      25°     30°     39°     65°
three-box, 1.80 m     0.319   0.318   0.172   0.021   0.026
three-box, 0.02 m     0.346   0.347   0.349   0.349   0.344
prism,     1.80 m     0.000   0.012   0.010   0.010   0.011
delivered wedge       0.208   0.015   0.018   0.019   0.024
```

The 0.02 m arm is the attribution: same shape, same segments, same statistic,
same angles, no lateral hull span. The collapse is the width and nothing else.

> **A control for a metric that reads a projection is run at every view the
> measured population contains, and both directions are required at every one of
> them.** A control at one view certifies one view. Where a view is outside the
> instrument's own stated admissible range it is recorded as *declined* rather
> than passed, and the number of views actually measured carries a floor — a
> sweep that quietly declines everywhere is §7.1's quiet gate wearing a sweep.

Two things this cost that are worth keeping:

- **A depth-ordered mask cannot repair a union.** It was the obvious fix and it
  is provably inert here: the reading is *set membership* in the union, and
  ordering the pixels by depth gives each an owner and changes the set by
  nothing. Nor is there a spurious pixel to remove — the projected outline of a
  convex box **is** the hull of its projected vertices, so those pixels genuinely
  are cabin. What was wrong was attributing a pixel above station `a` to station
  `a`. The repair is per-station: the harness reports each box's own extent along
  the subject's axis and a station is read against the boxes that span it.
- **An instrument correction that moves readings in the lenient direction is
  §0 rule 5's problem, not rule 6's licence.** This one moved the delivered wedge
  from 0.021 to 0.208. No threshold moved, and the sweep above is the guard: the
  negative direction has to hold at every view too.

### 7.4 The silhouette height profile — what §7.3's metric measures

At each of twelve stations along a subject's own long axis the harness returns
the projected image segment from the bottom of the subject to 1.15× its own
height, on its longitudinal mid-plane; the gate reports how far up that segment
the delivered frame's mask reaches. **A rectangular prism reads the same
fraction at every station**, from any distance, any heading and any sun angle,
so its span is exactly 0.000 — the assertion fails on a box *by construction*
rather than by calibration, which is the property `darkFraction` did not have.

A segment rather than a pixel height, because both ends of a vehicle are at
different depths and a profile in pixels carries the foreshortening as though it
were shape: ±8.7% of the roof height on a 4.9 m body at 20 m in three-quarter
view, from geometry that is exactly flat. The ground point and the roof point at
one station are at the same depth, so the fraction is depth-free.

**A station is read against the boxes that span it, not against the subject's
whole mask.** §7.3.1. Session 6b's correction, and the reason the sentence above
about a prism reading the same fraction at every station was true of a prism and
false of everything else. `harness.silhouettes()` returns `profile.boxAlong` —
each box's own extent along the subject's axis, off the same instance matrices
the polygons are projected from — and `profile.stationAlong`, where each station
stands on that axis. The gate emits neither of them itself, because recomputing
the station positions from `lengthM`, `trim`, `stations` and `subSamples` would
be a second copy of four lines whose failure mode is that the two drift and every
station maps to the wrong box while the number stays plausible (§9.1).

**This metric never reads a pixel, and the block's own `$mechanism` said it
did.** `measureRoofProfile` is handed masks and hulls and does not index the
decoded PNG anywhere in its body; the same is true of the pedestrian width
profile, whose row counts are mask pixels. Only the ground contrast, the tone
profile and the chroma read the frame. It was found by measuring a control body
that the frame does not draw at all — three materials, all of them tone-mapped
to nothing against a road at tens of thousands of lux — and getting identical
figures to four decimals. A shape statistic taken off the delivered projection is
defensible; a comment claiming it comes out of the delivered pixels is not.

The level *count* is computed, printed, and **deliberately not asserted**:
single linkage chains, so a roofline that ramps continuously from a low nose to
a high cabin — the raked front this section exists to ask for — collapses into
one cluster and would be failed for having the property the count was meant to
reward. `budget.json` → `silhouettes.$roofLevels_notAsserted`.

### 7.5 The width along the long axis — the assertion four properties could not make

**Added in this session, and it is the method rather than a fifth property.**

Sessions 5, 6 and 6b each added a property to a body built from axis-aligned
boxes: ground contact, colour, a stepped roofline. Every one of those
assertions is green — ground contrast 0.7219, chroma clusters 10, roofline
span 0.414 against a 0.30 floor — and the vehicles still read as boxes. That
is not a fourth missing property. **A stack of rectangular prisms has constant
width by definition**: every corner is 90°, every face is planar, nothing
tapers and nothing is chamfered, and no number of properties added to it
changes that. Measured on the delivered wedge, its four painted boxes are 1.86
to 1.92 m wide over a 4.90 m body — a spread of 0.03 of its own width — and
none of the four existing assertions can see it, because all four read height,
tone or colour.

> **A shape assertion is paired with one on the axis it does not read.**
> `roofSpan` reads the top edge along the length. `widthSpan` reads the width
> along the same length. A body that steps in height and not in width has one
> and not the other, and the frame says so before either number does.

The reading, and it is `roofSpan`'s construction one axis over: at each of the
same stations the harness returns a segment **across** the subject at
`latHeight` of its own height, reaching `latOvershoot` times its own half-width
either side of its lateral mid-plane; the gate walks that segment in its own
parameter and reports the covered fraction as a multiple of the subject's own
maximum width. **A body of constant width reads the same number at every
station, so its span is exactly 0.0000** — the assertion fails on a prism by
construction rather than by calibration, which is the property
`darkFraction` did not have.

Three things this cost that are worth keeping:

- **A station is read against the boxes that span it along the axis AND
  straddle the probe height.** The along restriction is §7.3.1's. The height
  one is new and is not tidiness: a wheel's lateral centre sits at nearly the
  body's own half-width and its along extent is short, so at a wheel station a
  wheel reaches further out than the panel above it and the reading jumps.
  That is a spurious width *change*, in the lenient direction — the metric
  would reward a body for having wheels rather than for tapering.

- **The over-read is derived, bounded, and the bound is what makes the metric a
  metric.** There is no depth test between a subject's own parts, so a probe
  point outside the true width can be covered by another point of the same box.
  Solving the covering condition exactly: the height trade is free (one
  centimetre buys 0.30 m at 25 m) and the along trade is bounded by the box's
  own length, so the total over-read is `boxLength·cot(θ)` — **a constant, which
  cancels out of a difference of percentiles.** What does not cancel is a spread
  in part lengths, and a second-order term `−boxLength·cot(θ)·a/(d·sin θ)` that
  is linear in the station position. Both are bounded by `maxWidthBias` and the
  subject is **declined rather than corrected**, because subtracting a computed
  bias would let an over-correction manufacture a span. Measured with the bound
  switched off, a body of exactly constant width scores **0.1502** against a
  0.12 floor at 25° / 15 m. The bound is load-bearing and the sweep is what
  found that.

- **It is a near-end-on reading where `roofSpan` is a broadside one, and the two
  populations are close to complementary.** `cot(θ)` vanishes end-on, which is
  precisely where the roofline's own long axis projects under `minStationPx` and
  it declines. So each carries its own `minMeasured` and its own control sweep
  at its own angles: §7.3's runs 0° to 70°, this one runs 15° to 85°. A single
  sweep would have declined for two unrelated reasons and made
  `minViewsTested` meaningless for both.

**A body of long boxes is unmeasurable by this metric except near end-on, and
that is the honest consequence rather than a gap.** Confirmed on the delivered
fleet before any geometry changed: 0 of 16 vehicles measurable, 9 of them
declined for over-read. So the assertion lands on its population floor as
*unrun*, and what carries the claim about that geometry is a pair of control
arms with the fleet's own structure at constant width — one long box, and
unequal long boxes. §7.1's rule that a gate needs a case that makes it fail
applies to the *metric's* two directions too, and for this metric the negative
direction needs three shapes rather than one.

**And "unmeasurable" is not a finding about the content, so the content is
measured a second way.** §9 rule 2, and here it is load-bearing rather than
hygienic: a metric that declines the whole fleet has said nothing about the
fleet. `hullprobe`'s `fromBoxes` column reads `BODY_TYPES` off the **live
module** — never transcribed — and applies the same stations, the same medianed
sub-samples and the same straddle rule to each box's own width. Delivered:
**wedge 0.0309, pod 0.0349, van 0.0673, hauler 0.0152, moto 0.1111**, every one
of them under the 0.12 floor. The same column returns 0.1560 for the positive
control against the 0.1515 the projection measured, so the two paths agree
where the projection can see and the geometry path answers where it cannot.

**An assertion may be added before the thing it measures exists, and then it is
red on purpose.** That is not a violation of "must exit 0" — it is the ratchet
working in the one direction it can work before there is anything to ratchet.
A bound written after the content is a bound fitted to it, and §0 rule 5 forbids
loosening one afterwards, so the only honest time to write it is first. Such an
assertion must say in its failure message that it is **unrun rather than failed**,
and must name the session that will make it green. See `budget.json` and
`city-budget.json` under `$SESSION_NOTE`.

### 7.6 No single view verifies both the roofline and the width

**Added in session 7c, promoted out of §7.5's third bullet because it is a rule
about verification rather than an observation about one metric.**

`roofSpan` is a broadside reading: it declines when the trimmed long axis
projects under `minStationPx · stations`, which is what happens as a subject
turns end-on. `widthSpan` is a near-end-on reading: its over-read is
`boxLength · cot θ`, and `cot θ` **vanishes** end-on — which is precisely where
the roofline has already declined. The two admissible windows are close to
complementary, and that is a property of the two quantities rather than of this
fleet or this route.

Three things follow, and all three are already built:

- **Each carries its own population floor.** `minProfileMeasured` and
  `minWidthMeasured` are separate numbers over separate subsets of the same
  measured population. One count used for both would let a route on which
  nothing is ever seen broadside satisfy the roofline floor with an empty set,
  or the mirror of that end-on.
- **Each carries its own control sweep, at its own angles.** `shapeControlViews`
  runs 0° to 70°; `widthControlViews` runs 15° to 85° over three distances
  rather than two, because this metric has one exclusion scaling as `1/distance`
  and one scaling as distance, so its admissible band *moves* with distance. A
  single sweep would have declined at both ends for two unrelated reasons and
  made `minViewsTested` meaningless for both.
- **And the part that has to be said out loud: NO SINGLE VIEW VERIFIES BOTH.**
  There is no camera pose at which the roofline control and the width control
  are both admissible with margin, so "the vehicle was checked from here" is
  never a complete statement. A session that reports one view, or one probe
  pose, has reported half the shape — and the half it reported is decided by
  the angle it happened to stand at, which is exactly the accident §7.3.1 was
  written about. `hullprobe` prints both columns on every row for this reason:
  where one says `n/a` the other is the reading, and a row with two `n/a`s is a
  view that certified nothing.

The general form, for the next pair: **when two assertions measure the same
subject through projections that are admissible under opposite conditions, they
are separate assertions with separate populations, separate controls and
separate sweeps, and any claim that the subject "passes" names which of the two
was actually run.**

### 7.7 An instrument written to detect a failure mode is where that failure mode hides

**Added in session 15, on session 14's evidence, and it is a rule rather than a
row in §9's table because the two instances have the same *cause* rather than
the same shape.**

`windcheck` was written to find §9's confusion — a quantity computed correctly
and then used as a different quantity — in the geometry. Its facing test
computed a world-space triangle cross product and used it as *what the
rasteriser treats as front-facing*. Those differ by exactly three's
`frontFaceCW` rule, so the gate written to find that confusion contained it,
and it would have reported six correctly-drawn sign faces as inside-out. It is
the second time: `citycheck`'s walkability keep-out took `landmarkFootprint`'s
return — an arc **length** — and used it as a **radius**, in the gate written
to check that the landmarks are reachable, one session after the generator's
keep-out had made the same substitution with the same function.

**Why it is not a coincidence.** An instrument's author is thinking about the
quantity being measured. That is the whole job: what does "inside out" mean,
what does "reachable" mean, what is the right statistic. The arithmetic that
gets the author *to* the quantity — a cross product, a radius, a unit, a sign —
is the part they are not thinking about, because it is not the interesting part.
It is also the part that has no gate behind it, because this **is** the gate.
Content has instruments pointed at it; instruments do not.

> **An instrument is checked against a case whose answer is known from outside
> the instrument, and the check is written in the same change as the
> instrument.** A control shape (§7.3), a hand-computed expectation, a second
> derivation of the same number (§9 rule 2), or the source of the library whose
> behaviour is being asserted about — any of the four. What does not count is
> running the instrument on the content and finding the answer plausible, which
> is the instrument grading its own homework.

Two consequences that are already built and are worth naming:

- **Both of session 14's catches came from controls, not from reading.** The
  facing rule was found by reading `WebGLRenderer.renderBufferDirect` rather
  than assuming; the reversed-box control's expected verdict was written as
  *fail*, the first run refuted it, and the expectation moved to match the
  instrument because the instrument was right. Neither was found by looking at
  the census output, and the census output looked fine both times.
- **An expectation that moves to match the instrument must say which of the two
  was wrong.** `winding:control:reversed` reporting `facing` **pass** is the
  demonstration of a declared blind spot and is asserted as such; a run that
  quietly relaxed an expectation to green would be §0 rule 5 broken by a
  control instead of by a threshold.

---

## 8. The harness

When `?perf=1`, the bootstrap exposes the same object as both
`window.__NOCTIS_HARNESS__` and `window.__APEX_HARNESS__` (the name the committed
`perfcheck.mjs` already looks for):

```
ready: Promise<void>            resolves when the world is built and one frame drawn
setTimeOfDay(t): Promise<void>  sets time and rebuilds anything derived from it
setShot(name): void             fixed named camera placements
setShotAt(pos, target, fov)     an arbitrary placement, for looking. No gate
                                asserts through it and no gate may.
step(n, dt): Promise<void>      renders exactly n frames with a fixed dt
settle(): Promise<void>         steps until exposure adaptation has converged,
                                then snaps it. Determinism, not a cheat. Since
                                session 70 it also pads to a fixed TAA jitter
                                residue and drops the history there, so the
                                captured frame is a constant number of frames
                                at a constant sequence of sub-pixel offsets —
                                §5.10. It reads `post.frameIndex`, which is a
                                getter with no setter on purpose: a counter a
                                caller may write is §9.1's arrangement, and the
                                written copy would be the one the jitter table
                                is actually indexed by.
setRenderScale(n): void
faults(): Array                 ctx.faults, so a gate can assert nobody is quarantined
info(): object                  draw calls, triangles, programs, light count
runRoute(name): Promise<void>   session 3. Throws until then — a stub that resolved
                                would let perfcheck pass vacuously.

sceneCensus(): object           §9.1. The live scene walked: instanceMatrix.count
                                off every InstancedMesh and the per-kind label it
                                recorded as it was assembled. The count is the
                                measurement; the label is what it is compared to.
roughCensus(): object           SESSION 65. Every mesh in the live scene with its
                                `noctisRough` read off the DELIVERED buffer —
                                itemSize, the porosity histogram, and how far the
                                mesh reaches from the origin. A census, not a
                                check: it asserts nothing, and it consults no
                                table, because a porosity the generator chose and
                                the attribute does not carry is exactly the
                                disagreement it is looking for.
featureGround(kinds): Array     SESSION 65. For every feature the delivered census
                                recorded, the base `city.js`'s transform used
                                against the ground under the four corners of its
                                own footprint, plus what that base is a surface OF
                                and how much of the gap the ground's own gradient
                                explains. `kinds` is passed IN, grepped out of
                                `city.js`'s own loop by the tool, so the two sides
                                cannot hold different lists.
lampAimCensus(): object         SESSION 68. Every delivered lamp column and
                                bowl, paired by plan distance, with the arm
                                bearing, and each head tested against `inRiver`
                                and `cityExtentAt`. Reports `unpairedBowls`
                                separately: a post-top park lamp has no arm and
                                must not be counted as an aimed one.
groundAlbedoCensus(opts)        SESSION 67. The area-weighted albedo of every
                                mesh in the scene, by PLAN footprint, off the
                                delivered vertex colour times the material
                                colour — which is what three multiplies and
                                therefore what the frame shows. `minR`/`maxR`
                                cut it by radius so the city, the countryside
                                and the sea can be read apart.
waterlineCensus(): object       SESSION 66. Every box in the river module's
                                meshes with its bottom and top in metres
                                RELATIVE TO `SEA.levelY`, off its own delivered
                                instanceMatrix, plus the per-instance kind
                                `river.js` recorded as it emitted. The label
                                says what it is and the matrix says where it is,
                                and the two are never derived from each other —
                                which is what lets a `craft` box that is not
                                afloat be visible at all.
boxGroundCensus(opts): Array    SESSION 65. Every instanced box whose bottom face
                                sits on the ground at its centre, and how far its
                                worst bottom CORNER is from the ground under it,
                                off its own instanceMatrix. This is the quantity a
                                pitch in the feature transform moves;
                                `featureGround`'s is not, and the difference cost
                                one arm of session 65 to learn.
particleLayers(): Array         Layers that declare themselves, read off the live
                                meshes. Empty is a failure, not a pass.
pedestrianCensus(): object|null Per-chunk counts off the live scene. Null is a
                                failure, not a pass.

saturateTraffic(spec): object   Placeholder headlights at the budgeted cone bound.
updateTraffic(): void           Re-seat them relative to the camera. Called from
                                inside the route loop, not from `beforeRender` —
                                §4.1 puts that after every `update()`, and
                                `lights.update()` is where assignment happens.
clearTraffic(): void
clusterStats(): object          Grid occupancy, high-watermarked over the run. The
                                margin, not only the overflow boolean.
resetClusterPeaks(): void
setConeBound(b): void           The A side of the cone-bound A/B. Not a mode.

motionProbe(opts): object       §5.11. One box on a fixed path, and the NDC
                                displacement the geometry predicts for it.
updateMotionProbe(dt, write)    `write=false` withholds the previous transform,
                                which is exactly session 5's behaviour.
clearMotionProbe(): void
showMotion(b): object           Replace the composite with the motion attachment,
                                encoded at a gain the call returns. NOT a readback
                                — §5.4 forbids that in a module and parsecheck
                                enforces it, and three's readback silently
                                returns zeros for a non-RGBA target.
setClipGamma(v): number         The TAA neighbourhood clip width. Instrument only:
                                the clamp's job is to make wrong history harmless,
                                so it also makes a reprojection change invisible.
setTaaFeedback(v): number       The history weight. 0 is the accumulation off,
                                which is the shimmer probe's POSITIVE control —
                                the raw per-frame aliasing the filter is asked
                                to remove.
setJitterScale(v): number       The sub-pixel offset amplitude. 0, with a locked
                                camera and a paused clock, makes every input to
                                every frame identical, which is that probe's
                                NEGATIVE control on the WHOLE path rather than
                                on the metric alone.
setJitterComp(v): number        §5.10's `+ uJitter` on the history fetch. 0
                                restores what shipped through session 12 and is
                                the arm the 4.729 → 0.668 was measured with.
setKarisScale(v): number        The luminance gain in the blend weights. 0 makes
                                the resolve the plain exponential average its
                                feedback constant is derived for.

silhouettes(opts): object       §7.2 and §7.4. The projected corners of every body box of
                                every visible vehicle and pedestrian, in
                                SCREENSHOT pixels, plus each box's view depth.
                                No colour, no luminance, no verdict — the gate
                                rasterises these against the delivered frame.
                                Un-jittered, because post.js adds the TAA jitter
                                immediately before the scene pass and subtracts
                                it immediately after, and the resolve is aligned
                                to the un-jittered grid.
                                `opts` is the §7.4 sampling grid — stations,
                                subSamples, trim, overshoot — passed IN from
                                budget.json rather than held here, so the
                                instrument carries no thresholds of its own.
                                A mesh labelled `profile: true` also gets the
                                projected station segments along ITS OWN long
                                axis, taken from the instance matrix's basis and
                                never from a body-type table — and, since §7.5,
                                a LATERAL segment at each of the same stations
                                with the view depth of each of its two ends,
                                because a lateral segment's ends are at
                                different depths and image fraction is therefore
                                not parameter fraction. Plus each box's own
                                extent along the subject's UP axis, so a station
                                is read against the boxes that straddle the
                                probe rather than every box its image line
                                crosses.
instanceColourPalette(): object What was WRITTEN into the instanceColor buffers
                                of the same meshes, so the gate can print it
                                beside what ARRIVED (§9 rule 2). Only meshes
                                declaring `palette: true` — a vehicle's wheels
                                carry an instance colour too and it is one tyre
                                black on all of them.
poseRoute(name, u, frames)      Place the camera at a parameter on a ROUTE'S OWN
                                spline and let the frame converge. Not
                                `setShotAt`: the placement comes from the path
                                the gate already runs rather than from the
                                operator, which is why a gate may pool a
                                per-frame measurement over three of them.
windingCensus(opts): object     §9.1, session 14. Every mesh in the live
                                scene: signed volume, closedness by directed-
                                edge pairing over position-welded vertices,
                                authored-normal agreement by shaded AREA, and
                                front-facing area toward an eye THROUGH the
                                delivered instance matrices — with three's own
                                `frontFaceCW` rule applied, because three
                                compensates a mirrored OBJECT's culling and not
                                a mirrored INSTANCE's. Keyed by mesh name. No
                                verdict: the thresholds are in budget.json and
                                the arithmetic in tools/lib/winding.mjs.
windingControls(on): object     The §7.3 shape controls, added to and removed
                                from the LIVE SCENE so the census walks them by
                                the same path it walks the city. Never present
                                during a gate's own census, which
                                `windingControlsActive()` proves.
windingControlsActive(): bool
windingControlCentre(): [x,y,z] Where they stand, so a caller can put eyes
                                round them without knowing where they were put.
occupancyCensus(): object       §9.1, session 21. Every keep-out claim
                                `city.js` put on the ground, recorded AT THE
                                POINT OF EMISSION: the ground rectangles that
                                ARE the mesh, each prop's world extent off its
                                own delivered instance matrices split at head
                                height, each park and site feature's, each
                                building's envelope and each landmark's ground
                                solid. `citycheck` runs `occupancy.js`'s
                                conflict table over it. It is deliberately NOT
                                the generator's registry: that says what was
                                TESTED and this says what ARRIVED, and the two
                                agreeing is the claim.
signPlacement(): object         Session 14. The DELIVERED sign quad positions
                                off `city:signs`' instanceMatrix, beside the
                                resident occluder boxes. Reading `chunk.signs`
                                instead would have verified the generator's
                                description, which holds the BUILDING'S CENTRE
                                and had no opinion about the fact that all 208
                                signs were nine metres inside their buildings.
stallCensus(): object|null      The live streetlife module's own stall count,
                                kinds and awning cloths. Null is a failure.
setInstanceUploadFrozen(b)      The §5.12 upload A/B arm. Returns what it
                                actually set. NO GATE MAY CALL IT: frozen, the
                                vehicles stop moving on screen, and an arm that
                                changes what is drawn is not an A/B.
```

Everything from `sceneCensus` down is an instrument. `windingCensus`,
`signPlacement` and `stallCensus` describe the world without changing it and
gates read them freely; `windingControls` CHANGES the scene and only
`windcheck --falsify`'s own control pass may call it, which is why
`windingControlsActive()` exists and is asserted false around every census of
the city. No gate may render through
`setShotAt`, `setConeBound`, `showMotion`, `setClipGamma`, `setTaaFeedback`,
`setJitterScale`, `setJitterComp`, `setKarisScale`, the motion probe,
`setInstanceUploadFrozen` or — since session 20 — `camera.setRouteOverride`,
for the reason §7 gives about `lookat.mjs`: a gate whose subject the operator
creates measures the operator. `setRouteOverride` is the newest and is the
sharpest case of it: a route whose field of view the caller chooses is not the
route `budget.json` holds a ceiling over, and a gate that ran one would be
comparing a number against a threshold derived for a different camera. Gates may *read*
`sceneCensus`, `particleLayers`, `pedestrianCensus`, `clusterStats`,
`silhouettes` and `instanceColourPalette`, which describe the world rather than
change it, and may drive `poseRoute`, which moves the camera along a path the
gate already runs.

While the harness is driving, the rAF loop is suspended and `dt` comes from `step()`.
A capture that depends on wall-clock timing is not a capture.

---

## 8.1 Streaming — the strategy, decided in session 4

**Worker-first, one texture array, a counted memory ceiling, and an analytic
default for everything not yet resident.**

- **The bake never runs on the main thread.** `src/lib/canyon.js` is pure and
  `src/lib/citygen.js` is deterministic in `(rootSeed, cx, cz)` alone, so the
  worker generates its own nine-chunk occluder neighbourhood and gets
  byte-identical geometry without being told what the main thread holds. If
  generation ever depends on order or shared state, the field will describe a
  slightly different city from the one being drawn — a mismatch with no stack
  trace.
- **One `DataArrayTexture`, not a `sampler3D` per chunk.** A fixed pool of
  identically shaped slots plus a small table indexed by chunk coordinate modulo
  a wrap. The shader's lookup is one texture fetch and no branching, and the wrap
  is unambiguous because the resident window is never as wide as it.
- **A slot costs its bytes twice.** three uploads a changed layer out of
  `image.data`, so the array's full contents stay resident on the CPU as well as
  the GPU. Any accounting that counts one of those is wrong by a factor of two.
- **Never blocks a frame.** At most `CITY.generateBudget` chunks are built per
  frame; bakes are queued to the worker and land whenever they land.
- **The neutral default is analytic, not a constant.** A chunk with no field —
  not yet arrived, outside the ring, or bake failed — is lit by the closed-form
  sky view factor of an infinite canyon, `sin(atan(w/(H−y)))`, whose two
  parameters are *calibrated against the measured field* rather than against the
  kerb. The default's job is to agree with the bake about the average; where they
  disagree, the ring boundary becomes visible.
- **The memory ceiling is counted and enforced before admission**, never after.
  `CITY.memoryBudgetMB` covers field slots and per-chunk instance buffers, LRU by
  distance, and `perfcheck` asserts it. An unbounded chunk cache is the same
  class of mistake as an unbounded particle layer.
- **Anything anchored at the world origin is a bug once the world streams.** The
  sun's shadow camera was, and a player who walked 500 m left their shadows
  behind. It follows the camera now, snapped to a shadow texel so the edges do
  not crawl.

---

## 9. The known failure mode: one quantity mistaken for another

Every silent bug in this project across four sessions has been the same bug. Not
a similar bug — the same one, wearing different clothes. It deserves to be
written down rather than rediscovered a fifth time.

**The shape.** A number is computed correctly and then used as though it were a
different quantity. Both quantities have the same type, the same units in the
loosest sense, and plausible magnitudes. Nothing throws. Nothing is undefined.
The frame renders, and it renders *nearly* right — right enough that no amount of
looking at it will tell you which of the fifty numbers upstream is the wrong one.

**The 77 so far** — and that numeral is now **generated against, not
maintained**. `tools/parsecheck.mjs` → `contractDocCheck()` counts the
contiguous rows of the table below and fails the gate if they disagree, printing
both numbers. §9.1's rule is that a comment which claims a check names the file
the check is in; this one does, because the check exists. Edit the table and
`npm run parsecheck` tells you the new number in its failure message.

**Why it needed a gate rather than a better sentence, in three failures.** The
count said "twenty-five" against 39 delivered rows in session 18, inside the
same sentence claiming it "is now derived by counting the rows, which is the
only way it stays right" — a claim about a check, in the section about claims
about checks, with no check behind it. Session 18 then wrote 42 and printed a
four-line `python3` snippet beside it as the derivation.

**That snippet is itself this section's failure mode and it is left here as the
example.** It counts *every* line beginning with `|` from the header to the end
of the file, which is a count of **pipe-leading lines in the remainder of the
document** used as **the number of rows in this one table**. The two agree at
exactly 42 today, and they agree for a reason nobody chose: §9's table happens
to be the last table in `CONTRACT.md`. Add a table anywhere below it and the
derivation silently over-counts, in the section about numbers that are silently
the wrong quantity, in the instrument written to stop that happening (§7.7).
`contractDocCheck()` stops at the first non-`|` line instead, and its own
two-direction self-test — a fixture that agrees and a fixture that does not —
runs on every invocation.

```
                                  counted  declared
  contiguous rows after the header      75        75
  every pipe-leading line to EOF        75         —   ← the snippet’s quantity
```

| session | what was computed | what it was used as | how far off |
|---|---|---|---|
| 1 | mean of a set of horizon *angles* | the angle at which to threshold | 42° where the answer was 3/7 |
| 2 | a basis in one handedness convention | the same basis in the other | a transposed rotation |
| 3 | a fraction of **peak candela** | a fraction of **lumens** | a 9% leak that was 44% of the fixture |
| 3 | a saturation cap meant to exclude neon | excluded brick instead | colour computed from 3% of the patch |
| 4 | the **drawing buffer** size | the size of the target being drawn into | every froxel in the wrong place |
| 4 | a landmark's **arc length** | its footprint radius | a 480 m keep-out; a quarter of the map sterile |
| 4 | the direction a building **faces** | the direction its body extends | every perimeter building half in the road |
| 4 | **GPU** bytes of an array texture | bytes it costs resident | half the real figure, in every line of the budget |
| 5 | a **bent normal** — the mean unoccluded direction of the hemisphere about *up* | a steering target for a normal facing the other way | every soffit in the city sampled the zenith through a concrete slab |
| 5 | the haze's **mix fraction** | the fraction of the delivered radiance | 12% read as 12%; it delivered 57% |
| 5 | sky visibility measured **at the roadway** | sky visibility at every height | 0.93 at a facade where 0.244 was measured |
| 5 | a **count** of deck stations ("every third") | a **length** in metres (`pierEvery`) | piers at 48 m where the data said 34 |
| 5 | what blocks a ray **to the sky** | what blocks a **pedestrian** | 480 m of deck across the walkability mask |
| 5 | a **signed** colour jitter | a **soiling** term, which only warms | stucco rendered as concrete; 3 albedo clusters where 4 are required |
| 5 | a **clone** of a patched material | the patched material | four landmarks outside the lighting model for a session |
| 6 | the pool's **spare** capacity | the lamp pool's **reservation** | raising the light cap for traffic would have bought sixteen more streetlamps |
| 6b | a spot's **bounding** radius | its **falloff** radius | a 30 m headlight beam culled at 18.31 m and three times dimmer at 15 m |
| 6b | a **frame count** | a **duration** | the census timed out and measured a partial city on any machine that renders fast |
| 6b | the **light budget** (96 slots) | the **vehicle count** | a street at 585 veh/h/lane, three vehicles in fifty metres, reading as deserted |
| 7 | a wheel's **bounding box** | the wheel's **silhouette** | the bottom rows of a round tyre's mask are 69% road; six vehicles of twenty-two measured a ground band *brighter* than their own body, one by 4.25× |
| 7 | the share of a silhouette **below 45% of its own brightest** | a measure of **tonal structure** | 0.646 on flat grey boxes against a 0.16 floor — it was measuring which face caught the sun |
| 7 | a tyre's **reflectance** (0.035) | the radiance of a tyre **in a wheel arch** | in shade a tyre read *lighter* than deep blue paint; ratio 0.75 where the assertion wants 0.28 |
| 7 | a **single run's p95** | the route's **p95** | a 0.10 ms breach decided against a 0.40–0.80 ms noise floor, red one run in three |
| 11 | a lofted surface's **shading normal** (flipped outward once, deliberately, with a comment) | the **facing of its triangles**, which was never flipped | every pedestrian rasterised its FAR wall; the silhouette is identical either way, so eleven sessions of gates passed, and the body drew in front of its own clothes |
| 11 | a garment's **half-extents on the ±x and ±z axes** | its **clearance from the body in every direction** | the axes are exact — they are vertices of both rings — and the facets between them are not: cloth 9 mm clear of the pelvis at the axis was 0.12 mm inside the leading thigh one facet later |
| 13 | a ground quad's **authored `normal` attribute**, (0,1,0) at every vertex | the **facing of its triangles**, which the vertex order puts straight down | not one square metre of the streamed city's carriageway, pavement or road patch has ever been rasterised. Row 11 with a flat surface instead of a loft, found nine sessions after the last time the same mistake shipped |
| 13 | the surface's **previous position on screen** | the **history texel this pixel accumulates into** | the two differ by exactly one frame's sub-pixel jitter, so every pixel of every frame fetched its history up to half a pixel away, cycling through eight offsets. Measured: 4.729% of pixels flickering ≥8 code values against 0.668% with the term restored |
| 13 | a **surround** — "slightly proud of the wall and slightly larger than the opening" | a box larger than the opening and in front of it, i.e. a **lid** | 25 880 of 26 501 window panes on the correctly-oriented elevation were completely occluded. Half the city had no windows |
| 13 | a **scale written in world axes** for one elevation | a scale in the box's **local axes**, which `setMatrix` then rotates | the swap and the yaw both applied: 24 907 window reveals turned into 2.15 m fins projecting out of every east and west elevation, ground-floor fascias up to 25.6 m deep, and every sign on an x-facing wall drawn on its end |
| 14 | a lofted surface's **`cross(along, around)`**, which is already OUTWARD | a vector needing one negation, under a comment asserting it pointed inward | every side normal on all five pedestrian builds pointed INTO the body from session 11 to 13. Session 11 reversed the triangles and left the normals, so a comment that was wrong about the sign and a fix that was right about the winding cancelled into a figure lit from behind. Measured three ways: 83.1–90.1% of shaded area disagreeing, the cross product on paper, and a vertex at x = +0.143 m carrying normal.x = −0.989 |
| 14 | a **negative x scale** used to turn a plane round | a rotation | three DOES compensate the culling (`frontFaceCW` from `matrixWorld.determinant() < 0`) and does NOT compensate the normal (`normalMatrix` is the inverse transpose; `FLIP_SIDED` comes from `material.side`). Six origin-block sign faces visible and lit from their far side for thirteen sessions |
| 14 | a building's **centre**, which is what `citygen` writes as a sign's position | the building's **elevation** | 0.5 m from a centre is 7 to 12 m inside a 15–26 m building. **208 of 208 signs buried, median 9.51 m deep.** Not one of the streamed city's sign quads had ever reached a frame |
| 14 | **`LIGHT.neonNits`**, the radiance of a neon TUBE | the radiance of a whole sign PLATE | 6500 against the 86 cd/m² the area average gives — 76×. Invisible for thirteen sessions because the quads were buried; the session that revealed them found `citycheck`'s saturation reserve red at 12.49% against 12% in the same run. `block.js` has had `neonTube: 230` and `signPlate: 38` as separate numbers, with the reason, since session 3 |
| 14 | **`partVertices`**, which means "this subject is one strided mesh" | "this label is a silhouette subject" | a guard added in the same session as the winding gate removed all 16 vehicles from `harness.silhouettes()`, and `perfcheck` reported `0 vehicle silhouettes measurable (min 6) — UNRUN`. A pedestrian strides; a vehicle groups. Caught by a gate within the hour, which is the difference this project's gates are for |
| 14 | a mesh's **world-space triangle cross product** | what the **rasteriser treats as front-facing** | inside the winding census itself, in its first hour. three flips the winding convention for a mirrored object, so the instrument would have reported six correctly-drawn sign faces as inside-out. Read out of `WebGLRenderer.renderBufferDirect` rather than assumed, and the census now applies the same rule three does |
| 17 | a **z-fighting offset** — `city.js`'s two ground quads are "slightly above the global ground plane so there is no z-fighting with it" at 0.020 and 0.030 | the **kerb** between a carriageway and a pavement | the streamed city's kerb is **0.010 m**. `BLOCK.kerbHeight` is 0.160 and the origin block builds a real one, so the world has a 16× kerb over 336 m of one street and a 1 cm one over every other metre of road it owns. Nothing could see it because nothing had ever stood on the ground; a camera on a spline carries its own eye height |
| 17 | the origin block's **pavement mesh length** (`walkSpan` 260, so \|x\| ≤ 266.5) | the origin block's **extent**, which `BLOCK_KEEPOUT` puts at \|x\| ≤ 168 | 98.5 m at EACH end where the block's 0.160 m pavement stands over the streamed city's 0.030 m one, and 15 m of it lying across a streamed north–south carriageway that traffic drives along. Walked over: the surface steps 0.130 m at x = 266.5, in the middle of a pavement, 98.5 m outside anything that explains it |
| 17 | a look-ahead **rise in metres** (0.9), added to the aim point in `camera.setRouteAt` | the route camera's **pitch** | the look-ahead distance is 0.01 of each route's OWN path length, so the pitch is `atan(0.9 / (0.01·length))` and differs per route for a reason nobody chose: `downtown_dense` **8.13°** up (630.2 m path), `night_rain` **7.32°** (700.2 m), `highway_speed` **3.53°** (1460.1 m). A 4.60° spread of camera pitch across three gates from one constant that reads as "look slightly up" |
| 18 | **`toStop > 0`** — "am I short of the stop line", a signed distance | **"may I proceed"**, a permission | the guard stops being true the moment the vehicle ARRIVES, so the braking constraint disappears at exactly the point it is needed and a vehicle stopped on a red accelerates into the junction from rest at 1.4 m/s². Measured on the module's own integration: 37.8% of junction-box entries made while the CROSSING axis had green. The signals were real, read by every vehicle, and never simultaneously green on both axes — the red light simply had no HOLD. Repaired with a permission keyed by the junction, which is a reservation table whose conflict set the phase already guarantees |
| 18 | **peak intensity over a projected area** — `streetlampCandela` / π·0.42² = 12 270 cd/m², rounded to `LIGHT.streetlampNits` = 9000 | the **area-average radiance of the emitting bowl**, which is Φ/(π·A) = 9883.5 lm / (π·1.6115 m²) = **1952 cd/m²** | 4.61×, and the fourth photometric instance after the luminaire leak, the tyre reflectance and the sign plate. At the night exposure it puts ninety-eight bowls at **307× the bright-pass onset**. NOT APPLIED: correcting it alone measured 12.15% → 3.26% of Zone III–VII mass, because the veil fed from that energy is what holds a night frame off zero. Wrong as a radiance, load-bearing as lighting — the two numbers are one system |
| 18 | a **derivation written at fov 50°** — 0.0310° per pixel, bounding `PLAYER.lookCurveExponent` at k ≤ 1.986 | a bound on the same constant **at fov 75°**, where one pixel is 0.0420° and k ≤ 1.854 | the value did not move, the quantity it was derived FROM did, and nothing linked them. k = 2 delivers 0.71 px/frame at the new field — the second dead zone the bound exists to forbid, created by a change to a different constant in the same file. §9.1 with a derivation instead of a value, and it was found by a reader checking the arithmetic of a change made an hour earlier |
| 17 | `capture.measureFrames`, a **time** (1800 frames = 30 s) | a **distance**, against `floors.metresTravelled` = 120 m | consistent only for a camera at or above 4.0 m/s. The three original routes run at 4.5, 24 and 6.0 m/s and clear it; a route walked at 1.40 m/s covers 42.0 m and the floor rejects it for being walked. §7.7 again — the gate's own two numbers, in the same file, in different units |
| 19 | **y = 0**, which every object in this project is authored against — a wheel's contact patch, a foot, a column base, a mast base, a prop's underside | **the height of the ground under that object**, which `city.js`'s `GROUND_Y` put at 0.020–0.033 while `block.js` put it at 0.000–0.160 | 160 vehicles drove **0.020 m sunk into their own carriageway** in every frame this project has ever shipped; 13 of the origin block's 16 lamp columns stood buried by exactly one kerb height; the streamed kerb was **0.010 m against `BLOCK.kerbHeight` = 0.160**, a factor of 16, because the gap between the two streamed quads was a z-fighting offset wearing a kerb's clothes. **The origin block had obeyed the datum since session 1** — `roadMain.position.y = 0.0` over an earth plane at −0.020 — and exactly one table disagreed with it. Declaring it (`constants.js` → `GROUND`) closed all three at once and dissolved the 0.130 m step 98.5 m into a pavement that §9's row 17b records |
| 19 | a **unit scale** (`sy = 1`) in the scale slot of `setMatrix`, where every other call in the same file passes a **length in metres** | the **thickness** of a 10 mm asphalt reinstatement | road patches emitted as **1.00 m tall boxes standing 0.505 m proud of their own carriageway** — 3 to 6 in every `patched` chunk, 3–5 m wide and 5–12.5 m long, at a shallow angle to the kerb. The operator walked into one and reported "a cube in the carriageway, north of the viaduct". **The CENTRE was right**: 0.025 is `roadNS(0.020) + t/2` for exactly the 10 mm this was meant to be, so the arithmetic that would have exposed it had already been done correctly, one argument earlier, in the same call |
| 19 | the distance from a vehicle's **ORIGIN** to its stop line | the distance from its **FRONT** to that line | four of the five body types stopped with their nose past the near kerb of the crossing carriageway — wedge 1.20 m, van 1.50 m, **hauler 3.30 m, i.e. 80% into the kerbside crossing lane** — and the fleet-weighted mean was 1.07 m. The same file already subtracts both half-lengths in car-following and half its own length for the camera-as-obstacle; the signal stop subtracted nothing. **The signal masts were the independent witness**: `signalApproaches` puts each head at the stop line under a comment saying that is "where the vehicles are already stopping", and a stopped hauler's nose was 4.8 m past its own signal head |
| 19 | a **mounting height** — 8.08 m to a lamp's optic, 3.05 m to a signal lens, 2.6–7.5 m to a pylon sign, `STALL_WORKLIGHT_HEIGHT_M` under an awning — every one of which is measured from the ground the thing is planted in | a **world y coordinate** | every lamp column, signal mast, sign pylon, market stall and pedestrian in the city stood at y = 0 while its own pavement was somewhere else. It was 0.030 m and invisible; declaring the ground datum put the pavement at 0.160 m and would have made the same error **eight times larger**, which is why the datum and the nine placement sites had to ship in one change rather than two. A datum is what a query is measured FROM and is not a substitute for one |
| 19 | a **registration** count of clustered lights — `roleCensus` reporting 96 traffic + 12 stall + 52 block + 196 lamp = **356 of 384** | the number of slots **assignable in a frame** | `lights.assign()` culls on `depth − radius > CLUSTER.far` = 320 m *before* it claims a slot, and the condenser is **560 m** from the closest point on any route this project renders. **No clustered light placed at the condenser can ever be assigned**, whatever the pool has spare — so item 12's sixteen 55 000 cd floodlights had to become an emissive band at ρE/π. STATE 18 §7.3's "margin 40" was separately one session and one role out of date: the stall role takes 12 and the margin is **28** |
| 20 | a distant emitter's **radiance** (830 cd/m² over a 0.22 m housing) | what that emitter **delivers to a frame**, which is its INTENSITY `L·A` = 40 cd | a nav lamp at 1000 m subtends 2.2e-4 rad, i.e. **0.34 px** at the gate's own 6.4765e-4 rad/px — and a sub-pixel emitter is not dim, it is ABSENT: the rasteriser misses every sample, or catches one and the TAA clamp discards it as an outlier. The first sky frame of the session showed exactly nothing. The repair is not "bigger": the box is grown to a 3 px floor and its radiance divided by the same area ratio, so `I` is identical at every distance and the enlargement is a resampling rather than a brightening |
| 20 | a searchlight's **slant range to the ground** (150 m altitude at 25° depression = 355 m) | a distance the light's own **falloff window** still passes | `radius` was set to 260 m and three's `getDistanceAttenuation(d, R, 2)` carries a Frostbite window `(1 − d/R)²`, so the beam delivered `(1 − 249/260)²` = **0.0018** of its intensity and the pool was 0.04 lx. Row 6b is the same window with a headlamp — "culled at 18.31 m and three times dimmer at 15 m" — and the fix is the same shape: size the window first (R = 850 m), then derive the intensity through it |
| 20 | a log-normal's **pre-floor mean** (36.4 m at median 30) | the uniform's **post-floor delivered mean** (36.55 m) | STATE 19 §9.5 proposed the substitution as "the mean is preserved to 0.4%" and the like-for-like figure is 36.36 against **38.00**, i.e. 4.3% short before any flooring is considered. And the mean was the wrong quantity anyway: a window count is proportional to FACADE AREA, which a setback removes perimeter from as well as height. Shipped at median 30 it measured **106 501 visible instances against a floor of 115 000** — a content floor catching a content reduction, which is exactly what it is for |
| 20 | a facade row cap of **34**, derived when the generator's tallest possible building was 21 storeys | a cap on a generator whose p99 is now **134 m** | inert for nineteen sessions and binding the moment the height distribution changed: nine buildings of 432 would have had blank walls above about 108 m, on precisely the towers the session added. §9.1's config-the-code-does-not-read with a bound instead of a value — the number was right about a world that had moved on. Now `maxM / era.floor`, so it is a bound again rather than a budget |
| 20 | **1.05**, the roof parapet's height, written as a literal in `buildRoofscape` | **1.05**, written again forty lines away in the `roof` sign mounting, under a comment saying the second was "read from there rather than guessed, so a change to the upstand cannot leave a sign floating over it" | a comment that claims a link, with no link (§9.1). Nothing read anything; there were two literals. It became load-bearing when a roof sign's WORLD HEIGHT became part of the chunk's own description, so the number is now `citygen.ROOF_PARAPET_M` and all three readers take it from there |
| 21 | a landmark's **arc length** — `l.z ± arcLength/2` — as the deck's end position in z | where the viaduct's deck actually terminates | STATE 19 and STATE 20 both carried *"deck ending inside buildings at z ≈ −229 and +251"* and neither session opened it. Measured against the curve: the ends are at **(−91.0, −204.2) and (−91.0, +226.2)**, and the nearest building to either is **21.0 m and 23.5 m away**. Row 4's arc-length-as-a-radius, with a straight-line extent instead of a radius, in a DIAGNOSIS rather than in the code — so two sessions carried a repair for a defect that was not there, and the real one (a deck that stops in mid-air) had no entry at all |
| 21 | **`propHalfAcross`**, the maximum over a prop kind's variants | the clearance one PARTICULAR variant needs | a fourth tree — small, multi-stemmed, a park species — took the kind's across-pad from 0.35 m to 1.64 m, and `fitsKerb` is `7.85 + 2·across ≤ 9.15`. **Every street tree in the city** would have been refused the pavement because one variant does not fit it. A pad that is the worst member of a category bans the whole category for it, which is §7.2's shape with a clearance instead of a floor |
| 21 | a prop's yaw **relative to the world grid** | its deviation from **the axis it is aligned to** | the river's promenade runs at up to **11.46°** to the grid where the meander is steepest, so a bollard perfectly lined up with its own quay read as 11.46° of deviation against a 3° bound. `river.js` derives the quay wall's segments from the same tangent and nothing complains, because a wall is not in the list `citycheck` measures. Inert until the per-variant pad above let narrow props onto the quay: 2.27° → 11.46° with no change to any yaw expression |
| 21 | a prop's **footprint from the ground up** | the ground a prop occupies | 60 forbidden overlaps between a street tree and the carriageway beside it, every one of them a canopy at 3.4–5.8 m over a road surface at 0.05 m. A tree overhanging a carriageway is what a street tree IS; the conflict was the instrument's, from collapsing a three-dimensional object into a footprint and then testing it against something with a vertical extent. Split at `HEAD_CLEAR_M` = 2.10 m — the generator's own number for the same distinction |
| 21 | the bounding box of a **rotated** box, computed as `L/2 + W/2` on both axes | the box's world half-extents | a 0.40 × 7.20 m stop bar reported as 3.80 m deep along the road it lies across, so every marking was tested for "am I on a carriageway" against a box nine times its own area |
| 21 | the quayside walk's **1 m building margin**, correct for two terraces laid on one another | a setback for **every** building walk | the perimeter walk advances `t += width + rng.range(0.2, 1.4)` inside a run, so a terrace's own buildings stand 0.2–1.4 m apart on purpose. Measured: **303 buildings over the gate's region against 432**, a 30% content loss `floors.visibleInstances` would have caught |
| 21 | a **10 m pad on a building's CENTRE** against a landmark's box | 10 m of clear ground around a landmark | what it actually guaranteed is `10 − halfDepth`, which over the generator's 15–26 m depths is **−3.0 to +2.5 m** — negative over most of the range, i.e. buildings standing inside landmarks with their centres politely outside. Replaced by a face-to-face setback of `CITY.sidewalkWidth` = 4.2 m, which is a SMALLER number and a STRICTLY STRICTER test at every depth the generator can draw (centre distance 11.7–17.2 m against 10.0) |
| 21 | session 5's *"the block leaves x ∈ [−10.5, 10.5] clear at every z"*, in a comment | a bound the placement is checked against | it is the entire justification for the viaduct crossing where it does, and it was prose, so nothing could check it and nothing did: a support reached **\|x\| = 12.18 m**, 1.68 m past the band its own argument depends on. §9.1's config-the-code-does-not-read, with a sentence instead of a value |
| 21 | **eleven samples** of the river bank over a road's width | **every 4 m** of the same bank, in the registry | two samplings of one curve disagree by whatever falls between their stations: three carriageway pieces 0.03–0.09 m² inside the channel they are cut back from. Sub-decimetre, invisible, and closed by making the road read the water's own claims rather than re-sampling — which is a different kind of correct from a tighter tolerance |
| 21 | `riverTouchesChunk`, true for every chunk the 147.6 m **envelope** reaches | which chunk **owns** a bank | both chunk rows furnished both promenades over the same x range, so every quayside in the city was furnished twice by two chunks that could not see each other's props. Found by `prop × prop`, which nothing had ever compared: a bin inside a planter and a cabinet inside a tree. Row 15's promenade-lamp ownership bug, one system over, three sessions later |
| 22 | a kerb band's **FIXED axis** — `{ axis: 'x', at: b.x0 }`, whose `t0/t1` run over the chunk's **z** range | **the axis the band runs along**, which is the doc comment's own words and the opposite of what the rows say | `kerbRef = band.axis === 'x' ? 0 : 90` — so every kerbside prop on a north–south street was drawn ACROSS its pavement with its end to the road, and every one on an east–west street was drawn across the other way. The two lattice cases are inverted **against each other**, which is why both produce the same defect and no comparison between them could show it. The CLAIM was right all along: `axis === 'x'` claims `claimAt('prop', x, z, halfAcross, halfAlong)` — small on X, long on Z, i.e. exactly yaw 90° — so the generator tested a bench lying along the kerb and `city.js` drew one lying across it. Measured on one delivered bench at (8.097, 76.568): claimed half **(x 0.286, z 0.944)** against delivered **(x 0.935, z 0.252)**, same centre to four decimals, the two boxes each other's transpose to within 0.044 m. **1 134 of 1 596 props over the region**, and it took `citycheck` → `occupancy`'s DELIVERED half from 60 forbidden overlaps to 8 with the generator's half unmoved at 0 |
| 22 | a canopy mass's clearance over head height **in the model**, authored at scale 1 — broad tree 2.183 m against `HEAD_CLEAR_M` = 2.10, an 83 mm margin | the clearance **as delivered**, at `PROP_SCALE` 0.85–1.25 and the variant's own lean | no delivered tree is at scale 1. The broad tree's lowest foliage hung at **1.856 m** at scale 0.85 and **1.681 m** with its 5° lean — under a person, and 1.4 m under a hauler's roof. `derivePropHalfAcross` therefore called the mass overhead and claimed a trunk's worth of ground while `city.js`'s band split, which reads `lo = e[13] − hy − baseY` off the DELIVERED matrix, called it underfoot and delivered a crown's. Six kerbside trees overlapping their own carriageways, every one at scale 0.863–0.933, the worst by **1.264 m²** — larger than any of the 52 benches in the row above, and invisible until the benches were fixed. The comment over `PROP_MODELS.tree` said *"EVERY CROWN CLEARS `HEAD_CLEAR_M`"* and had no check behind it (§9.1). Repaired on the GEOMETRY — both crowns lifted, 0.50 m and 0.35 m, their internal spread untouched — because moving the test alone would have taken the broad tree's across-pad from 0.363 m to 1.640 m against a 0.650 m kerb and refused every street tree the pavement, which is session 21's own row 21 arriving from the other side |
| 23 | the frame INTERVAL delivered **under a vsync lock**, `max(work, T)` | the interval **with vsync and the frame-rate limiter disabled**, which is what `budget.json` → `$wallFrameMsP95` says the 12.5 ms ceiling is a ceiling ON, and what `page.mjs` and `perfcheck` both launch with | the operator ran the live build in a browser and read `frame p50 16.7 / 12.5 ms` in red. 16.7 is 60 Hz: under a lock the interval cannot go below `T` however fast the city renders, so that cell was red for EVERY possible state of the world and carried no information about any of them. **The tell was already in the budget file** — `$wallFrameMsP95_rebaseline` records that this ceiling was 16.67 until session 4 and that *"16.67 was the vsync line"*, so the red number on screen is the ceiling's own discarded value. The reading is CENSORED rather than wrong: `m·T` establishes `work` in `((m−1)·T, m·T]`, so a verdict is available exactly when that band lies on one side of the ceiling — no verdict at 60 Hz, **green** at 120 Hz where the lock PROVES the work, **red** on a dropped frame at every rate. No ceiling moved and no gate changed; `perfcheck` still runs unlocked against the same 12.5 |
| 23 | a viaduct's **ABUTMENT** — the mass the deck bears ON, topping out at `viaductSoffitY` = 18.20 m | its **END TREATMENT**, the thing that closes the line | session 21 built the abutment, the wing walls and two parapet returns and the ends still read as *"a line that has been cut"*. The abutment stops at the soffit by construction, so the deck's own section from 18.20 to 22.20 — box girder, slab, ballast, rail — was never closed: **8.60 m of the deck's 9.50 m width ended in mid air**, framed by two 0.40 m parapet returns whose underside is 21.00 and which therefore FLOAT 2.80 m above the abutment they stand over. A bearing and a portal are different objects and one had been built where the other was wanted. **And the whole mass was claimed by nobody** — `landmarkOccluders` returns a viaduct's legs and its deck segments, so an 18.2 m solid 6.0 × 11.1 m stood at each end on ground the registry had never been told about, which is §9.1's placement rule with a landmark's own geometry. Claiming it refused one building of 367, standing 1.73 m away against a 4.2 m setback |
| 23 | the train's **BODY LENGTH**, `cars·carLength + (cars−1)·gap` | the train's **EXTENT**, in the turn-round clamp `halfArc − len/2` | the two were the same number for as long as the leading car's end face was the furthest-forward thing on the train, and a raked nose 1.6 m long separated them. Arithmetic both ways: 74.70 m clamps the centre at 202.65, putting the nose tip at **s = 241.60**, which is **1.30 m inside the portal recess built in the same session**; 77.90 m puts it at 240.00, the deck's last station exactly. The defect would have been a train standing inside a wall, arriving from a change to a different object — and it is the shape §9.1 records for `pierEvery`, with a length that stopped meaning what it meant |
| 65 | the **generic vertex-attribute default** three hands an unbound `attribute vec2` — `(0, 0)` | **this surface's own porosity**, which `lights.js` reads as *impervious* and turns into a mirror | it is session 64's `block:ground` finding one surface along, and the reason it is a ROW rather than a repeat is that the two were found the same way and only the same way: by an operator looking at a frame. The 8 km exit-road ribbon set `position` and `normal` and nothing else, so at `wet = 1` it returned a full inverted image of a roadside tree — measured on the delivered pixels as a **−33.3 code-value notch, 35.0% of the fitted trend, against −2.2 and 1.4% after**. The default is not wrong; it is unstated, and an unstated default is a decision nobody made. `tools/roughcensus.mjs` now walks every mesh in the delivered scene and prints what each one claims, so the third one is a line of output and not a session |
| 65 | `EXIT_ROAD.taperM` = 200 m, which is **`4.0 m × 50`** — the standard 1:50 rate for narrowing a carriageway, i.e. a rate of change of WIDTH | the schedule on which the road's **SURFACING** changes from city asphalt to a rural chip seal | my own first arm, and it reads exactly like the good instinct it came from: *the surface changes where the section changes*, so that one number describes how far out of the city a station is. A lane-narrowing standard says nothing about where one authority's tarmac ends. **The frame caught it**: the operator stands 28 m past the edge, where a 200 m ramp delivers a porosity of **0.098**, so the near half of the frame he complained about was still a mirror after the repair. The datum is the city's own edge — a resurfacing joint is where the maintaining authority changes — and it needed no second number at all |
| 65 | `city.worldSurfaceAt`, whose own comment says **"THE RESULT IS TRANSIENT — copy what you keep"** | a VALUE, held across a second call to the same function | the base and the corner became one quantity, so a census of how far every feature's ends stand off the ground reported **0.00 m for 6 078 features including 424 on hill shoulders** — against session 64's independently measured hedgerow median of 1.04 m. A measurement that reports a perfect world is the loudest symptom there is and it STILL needed a second number to catch, which is §7.7's whole point arriving in the instrument written to find §9 |
| 66 | a quay wall's TOE, `RIVER.depth + 0.8` under street GRADE | how far under the WATER it is, in an instrument built to tell a hull from a wall | the water is `RIVER.depth` under grade, so the wall's toe is **0.80 m** under it — and a harbour launch draws **0.80 m**. Two populations with one signature, and `waterprobe`'s first arm classified them by exactly that: a box straddling the waterline by under 12 m was a hull, over 12 m was a wall. **The wall population came back EMPTY**, which is the §7.3 control firing rather than a defect being found by a frame. The repair is not a better threshold: `river.js` records the KIND per instance now and the probe reads the label, with the geometry as the measurement and the two never derived from each other. It is session 65's own first false pass — a census that reported a perfect world — caught this time by the control that session's lesson put there |
| 67 | `GROUND.earthAlbedo`, the area-weighted mean of the city's own drawn ground, DERIVED in session 42 | the same sentence written a second time as `ATM.groundAlbedo`, with **no derivation at all**, in the file that lights the sky | two constants for one quantity, sixty-six sessions apart, disagreeing by **1.21x in luminance and 4.0x in saturation** — and the undirived one is the copy that feeds the below-horizon hemisphere and, through PMREM, every downward-facing surface in the city. It took a 30.4 km2 sea to make it visible, because a rough water surface integrates that hemisphere and came back the colour of an over-saturated ground. **The CHANNEL ORDER was never wrong** and three sessions of STATE had called the level 1.34x, which was the right measurement of the wrong pair: 1.34x is against the COUNTRYSIDE and the constant's own first word is *"Urban"*. Against the surface it names it is 1.21x. Session 42's derivation meanwhile survived twenty-five sessions and agrees with the delivered city to **1.7% on every channel** |
| 68 | `crossingIsLanded`, session 67's *"is there ground behind this bank"*, asked over BOTH banks at a 20 m setback at any x | the same property written again twenty lines away inside `pushQuays` — ONE bank, an 8 m setback, lattice stations only, and gating a 16 m SEGMENT off a test at ONE END | the last of those is not a style difference but a defect: two wall segments, north and south at x 3 504–3 520, were drawn with their seaward ends in **4.52 m and 4.83 m of water**. Session 67 did not remove those walls, it shortened them. **And a THIRD reader had no test at all** — `river.surfaceAt` answered `parapet` and `walk` over open water, 644 band samples on the sea, the deepest under **56.80 m** of it, which is STATE 67 §6's own sentence about a drawn deck and a walkable deck reproduced one object along in the session that wrote it. `bankIsLanded` is the primitive now and both compositions read it; the two setbacks survive, NAMED, because an abutment and a quay wall ask about two different pieces of ground |
| 68 | `WATER_BODY` = [0.019, 0.026, 0.023], derived in session 42 for an URBAN RIVER and naming its own opposite in its own comment — *"silt rather than **the deep-ocean blue**"* | 30.4 km² of open ocean, added in session 66 into the same mesh on the same material, handed the silt | the constant that says what it is NOT was given the thing it said it was not, two dozen sessions later, by a session that never read its comment. Measured with a §7.3 control at [0.900, 0.020, 0.020]: the open sea goes to saturation **0.654**, so the diffuse reaches the far water and reaches it hard. `SEA_OPEN_TINT` is spent through the same footprint gate as the reflected term, so the river keeps its silt and only water whose waves have gone sub-pixel gets an ocean |
| 68 | a bounding sphere, which for a static mesh describes the object | a bounding sphere computed from the matrices a moving mesh happened to hold **at build time**, which describes one instant | `replaceInstanced` computes it from what it is handed, and the harbour's moving plant was handed a sentinel pose at y = −1e5. `frustumCulled` then threw the whole thing away: **the mesh existed, cost nothing, and drew nothing, and the draw count did not move to say so.** A silent zero — the same shape as session 45's sign pool shipping with 16 slots, 0 candidates and a byte-identical frame. The sphere is the CIRCUIT's now, over every position the plant can reach, so it culls correctly at every instant instead of at one |
| 69 | `waitForCity`'s return, a READINESS poll — it steps ten frames, asks the canyon **worker** whether its bake queue has drained, and steps ten more if it has not | the number of frames rendered before a capture, i.e. a capture SCHEDULE — and through `JITTER[frameIndex % 8]` in `post.js`, the sub-pixel offset the delivered frame was drawn at | over 35 runs of ONE source on one machine it returned **2 808 to 3 038** frames, a spread of 230, so a capture lands on whichever of the eight Halton phases the worker's milliseconds chose. `harness.settle()`'s fixed 44 frames preserve that phase exactly — `TAA.settleFrames` is 32 and **32 ≡ 0 (mod 8)** — so the constant whose comment reads *"a capture that depends on how many frames the machine happened to render is not a capture"* discharges that duty for the ACCUMULATION and not for the PHASE. Measured on `viaduct-under`: the eight phases of one unmodified source differ pairwise by **57 801 to 78 979 bytes** of 3 499 200, and **0** when two captures share a phase. STATE 68 §8 read one such pair as a finding (73 373) and three draws of one phase as a zero noise floor, and built a hypothesis about the whole city's population on the difference. With `post.setJitterScale(0)` the same three pairs read **11, 9 and 7 bytes**. THE INSTRUMENT AND NOT THE WORLD, and the second one this project has had: session 65's `worldSurfaceAt` transient reported 0.00 m for 6 078 genuinely wrong features |
| 70 | **`span`**, the pixel's reach along a wave's own direction of travel — the footprint at which the surface stops being describable as geometry, and correct for exactly that | **"this fragment is OPEN SEA, so a downward ray lands on more sea"** — `gNoctisSeaOpen`, whose own comment calls it *"the share of this fragment's lobe that has gone below the horizon"*, a third quantity again | the two agree from 40 m up at the city's edge, where the harbour basin's footprint is centimetres and *"nothing had to be told where the harbour is"* — and they part on a PAVEMENT. At the routes' own 1.74 m eye, looking ALONG the river rather than across it, water 130 m away is grazing water: `span` reaches `cutoffLo · λmax` at **111–135 m** and saturates at **157–189 m**, and the river takes the open-sea blue over a **13–15 pixel, 43–54 m** seam. Measured against a term-off arm: **71 650 bytes, 37 347 px, mean |Δ| 19.4**, hue 356° → 255°. LOOK.md §0.1's *"the river — BYTE-IDENTICAL"* is a property of ONE CAMERA — a frame that sees the river across — and was read as a property of the river. `tools/seamprobe.mjs` is the instrument |

The three session-4b rows in full, because two of them were invisible in every
delivered frame and the third was visible and misread:

- **The cone bound leaked into the falloff.** `assign()` wrote `bound.r` into
  the light's texel-0 `w`, which is the radius the *shader* culls and attenuates
  against — but texel 0's `xyz` is the light's own position, not the bound
  sphere's centre. A radius paired with the wrong centre. At the budgeted 35°
  half-angle `bound.r` is `R/(2·cos 35°) = 0.6104·R`, so a declared 30 m throw
  was culled at 18.31 m and the Frostbite window bit 2.7× earlier: 0.302 at 15 m
  where the correct cutoff gives 0.879. Nothing caught it because `boundSphere`
  is only entered for a spot narrower than the 60° crossover and until 4b the
  only such lights were the harness's placeholders, whose own comment says the
  instrument "measures froxels, not photons". It would have shipped inside the
  first real headlamp as a beam that looked short. It also means
  `setConeBound(false)` was changing *content*, which is not what an A/B may do.

- **`waitForCity` was bounded in frames and waiting on wall clock.** 25 field
  bakes run one at a time in a worker at 89 to 333 ms each — about 2.6 s that
  the frame loop does not govern and cannot hurry. The bound was 900 frames, so
  the faster the machine renders the less time the bound buys. Measured, same
  commit, same machine, from cold: vsync on, drained at 314 frames / 5227 ms and
  passed; vsync off, 900 frames burned in 3124 ms with 11 of 25 bakes landed and
  **timed out** — and `page.mjs` launches every gate with `--disable-gpu-vsync`.
  It failed by printing a census of a partial city, which is §7.1's shape: the
  number was wrong and the gate still printed one.

- **96 vehicles because 96 is the number of light slots.** The reserve is a
  *light* budget; the vehicle count is content. Conflated, they put one vehicle
  every 18.4 m — a real arterial flow that reads as a deserted street, measured
  from a plan view as three vehicles in fifty metres. `city.js` already keeps
  the two apart for its street lamps ("the lamp pool is a POOL and only the
  lamps near the camera are lit"), and the same argument is stronger for a
  headlamp: its value is the pool it throws, that pool is invisible past a
  hundred metres, and what makes a distant vehicle read is its emissive light
  line, which costs no slot.

### 9.1 Two variants the table above does not name

The table's shape is *a number computed correctly and then used as a different
quantity*. These two are the same failure at one remove, and they earned their
own heading because each has now happened twice.

**A value written in config that the code does not read.** `pierEvery: 34` was
in the landmark data and `i % 3 === 0` was in the code; what shipped was a pier
every 48 m. Row 12 above records the count-for-a-length confusion, which is how
it happened. This is the part that let it *survive*: every gate in the project
read the same side of the comparison. Five of `citycheck`'s six criteria read
placement data, which is the generator's own description of what it decided —
the right source for a claim about the generator and the wrong one for a claim
about the city. **A gate that reads config verifies the config.**

The remedy is a walk of the live scene: `instanceMatrix.count` off every
InstancedMesh, plus the per-kind breakdown each mesh records as it is assembled,
required to agree with what was written down. `harness.sceneCensus()`, asserted
by `citycheck`. Note the second half — the merge that took the detail ring from
nine draw calls a chunk to five put buildings, crowns, props and road patches
into one mesh, and after that the scene had no way to say how many props it drew.
**A refactor that erases a category also erases the check on it**, and the label
has to be written at the point where the category still exists.

**A KEEP-OUT NOBODY CALLS — session 75, and it is the same variant with a
FUNCTION instead of a config value.** Session 74 wrote `onAirfieldAt(x, z,
pad)`, exported it, and said of it in a comment beside the platform it guards:
*"`onAirfieldAt` keeps the countryside scatters off it, so nothing can grow
through it."* **Nothing called it.** Measured on the 738 × 3 120 m platform and
its forecourt at seed 1337: **45 `shed`, 18 `tower`, 89 trees, 14 rectangles of
farm yard and 280 hedge segments** — farmhouses, barns and silos standing beside
a runway.

It survived a whole session for §0's own reason and not for a new one: the frame
that would have shown it **cannot exist**. `CITY.groundRadius` is 640 m, so no
camera can hold a 3 km field, and every frame session 74 did take stood ON the
plate looking along it — where the plate is what you see. A keep-out is checked
by looking at the ground it is supposed to have cleared, and nobody could.

> **A predicate that is exported and never called is indistinguishable from one
> that is called and always false.** Neither shows up as an error, both read as
> a working guard in review, and the only way to tell them apart is to count
> what is standing where the guard says nothing should be. Count it once, at
> the time it is written.

**An argument dropped by a forwarder.** `city.js` measures the facade openness,
logs it beside the roadway figure and the ratio between them, and calls
`canyon.setFieldDefault(halfWidth, meanHeight, facadeVis)`. The forwarder in
`canyon.js` was declared `(halfWidth, meanHeight)` and passed two, so
`lights.setFieldDefault` evaluated `Math.min(1, Math.max(0.04, undefined))` =
**NaN** into a uniform that the analytic default field mixes into the sky
visibility of every surface in every chunk without a baked field — most of the
distant city. Session 18.

It is the config-the-code-does-not-read variant with a *function signature*
instead of config, and it survived for the reason all of them survive: **the
number it carries is only read far away.** The near city has a baked field and
looked right, so nothing within a hundred metres of the camera ever showed it,
and the boot log printed the correct 0.244 the whole time.

> **A forwarder that exists only to pass arguments through is checked by its
> arity, not by its name.** Three call sites, three different signatures, no
> error anywhere: JavaScript will hand a function `undefined` and let the
> arithmetic produce NaN rather than throw. Where a value crosses two module
> boundaries to reach a shader, print it at the far end at least once — §9
> rule 4's obligation is discharged at the point of USE, not at the point of
> derivation.

**Placement without a collision test against what is already there.** Piers
inside buildings in session 5; bollards, bins and cabinets inside buildings now
— `citygen.js` scatters props uniformly over `island`, the whole chunk interior,
and tests them against the landmark keep-outs and nothing else, while the
perimeter buildings occupy 15 to 26 m of that interior on every side. Measured:
**146 of 838 props, 17.4%.** Two sessions running, two different placement
routines, the same omission. So it is written as a rule rather than an incident:

> **Anything placed procedurally is tested against the existing occupancy, or it
> is not placed.**

It is cheap and it is not optional. The generator already owns the occupancy —
`occluders` is built in the same function, three lines above the scatter.

**SESSION 21: THE RULE WAS BROKEN SEVEN TIMES AND THE EIGHTH WAS A DOME ACROSS A
CARRIAGEWAY, so it stopped being a rule and became a structure.** Piers inside
buildings (5), props inside buildings (4b), 208 signs inside their own building
(14), glazing and quayside frontages overlapping (15), buildings in the river
(15), a deck terminating nowhere (19), a landmark dome standing across 2 906 m²
of road (21). Each repair added one more private test to one more placement
loop — `insideKeepout` here, `landmarkBlocks` there, `riverBlocks` in a third
place, `occupied(occluders, …)` in a fourth — and every new generator had to
remember all four and invent the fifth.

> **There is ONE occupancy. `src/lib/occupancy.js` holds the claims, their
> vertical extents and the table of which categories may not overlap which.
> Every generator writes to it and asks it. A placement routine that carries its
> own predicate is the eighth instance waiting to happen.**

Three things make it a structure rather than a fifth predicate:

- **A claim carries `[y0, y1]`.** Session 5 wrote the distinction down —
  *"`landmarkOccluders` answers what blocks a ray to the sky; the flood fill was
  asking what blocks a person"* — and built it as two functions, which is how
  you get a third question with no answer. A viaduct leg is `landmark` from 0 to
  21 m and the deck it holds up is `deck` from 14.2 to 21 m; a carriageway
  conflicts with the first and not the second, which is what an elevated railway
  over a street IS.
- **"Occupied" is a RELATION, not a property of a point.** A pavement and a
  bollard share ground on purpose; a carriageway and a bollard do not. A bridge
  deck and the water share a footprint on purpose; a building and the water do
  not. One `occupied()` predicate can only be right about one of those pairs,
  which is why this project had four of them.
- **The gate reads the DELIVERED scene, not the registry.** The registry says
  what the generator tested; `harness.occupancyCensus()` says what arrived, and
  twice now those have differed — 208 signs decided on a wall and drawn nine
  metres inside it, road patches decided 10 mm thick and drawn a metre tall.
  `citycheck` → `occupancy` runs the same conflict table over both.

**A check a comment says exists, and does not.** `traffic.js` carried the
sentence *"It must equal `tools/budget.json` → motionVectors.kindMinExtentM, and
`perfcheck` asserts the two agree: a table in a budget file and a table in a
module is exactly the arrangement in which `pierEvery: 34` sat beside
`i % 3 === 0`."* Nothing in the project read both tables. Two of the five keys
could not have matched by name if anything had tried — the budget said `car` and
`motorcycle` where the module says `wedge` and `moto` — so the check the comment
described could not have been written without noticing that first.

This is worse than the two variants above, because both of those are *silent*
and this one **advertises a guarantee**. A reader who wants to change the
geometry reads that sentence and believes the gate will catch a mistake. It was
found by changing the geometry and going to look for the assertion that was
supposed to catch the change.

> **A comment that claims a check names the file the check is in, or it does not
> claim one.** The remedy is the same shape as rule 4's: what the module now
> exposes is `stats().minExtentM`, *computed from the delivered boxes and
> wheels*, and the gate compares that against the budget. Comparing the module's
> own declaration to the budget's would have compared two declarations and
> verified neither.

**Geometry drawn and then culled by its own winding.** A horizontal quad whose
`normal` attribute says (0,1,0) at every vertex and whose triangle order puts the
face normal straight down is a surface that is submitted, rasterised and
discarded. The lighting believes the attribute, so nothing looks lit from
underneath; there is simply nothing there. `city.js`'s `buildGround` did this to
every carriageway, pavement, road patch and — once one was added — park in the
streamed city, for every session in which the city has existed, at a cost of one
draw call a chunk. It is the same pair of quantities as row 11 (a shading normal
and a facing) with a flat surface instead of a loft, and the session that found
row 11 did not go looking for a second instance.

> **A surface's normal attribute and its triangle winding are two statements
> about the same thing and neither implies the other. Where geometry is emitted
> by hand, the winding is derived in a comment beside the emission or it is a
> guess.** The tell is cheap: a draw call whose count does not change the frame.
> Measured here as 454 draws with the ground meshes and 434 without, with not
> one pixel between them.

**Geometry authored and then drawn inside something else.** Every one of the five
vehicle body types carried a dark skirt box in its data and none of them showed
it: the wedge's skirt spanned y 0.00–0.22 at 1.86 m wide under a hull spanning
0.10–0.82 at 1.95 m wide, so the hull hid it over the whole overlap and the
visible remainder was a 0.10 m sliver. The pod, van and hauler were the same
arithmetic; the hauler's cab swallowed its skirt entirely. This is the
config-the-code-does-not-read variant with geometry instead of config, and it
survived for the same reason: *the gates counted the boxes.* `sceneCensus`
reported 480 vehicle boxes and 480 existed. Nothing asked whether any of them
could be seen, which is what §7.2 is now for.

Note the fifth column that is not there: *how it was found*. Four of session 5's
seven were found by writing one number next to another — the default's sky
visibility beside the measured one, the haze's mix fraction beside the radiance
it mixes, the pier spacing beside `pierEvery`, the soiled albedo beside the
palette entry it came from. Two were found by looking from somewhere new
(`tools/lookat.mjs`) and one by a three-line experiment against three.js
(`clone().onBeforeCompile === Material.prototype.onBeforeCompile`).

Three of session 4's four were found in one afternoon, by three different
instruments: a gate that rejected everything (the walkability flood fill reached
one cell out of 67 568 — when a check rejects *everything*, the check is usually
what is wrong), a frame that was looked at (a facade pressed against the lens at
a route's starting position), and an accounting line that was written out in full
before it was believed.

**Why looking does not find it.** Three of the first five produced a frame that a
person would describe as fine. The luminaire one produced a frame that was *better* than
the one before it. A rendering bug that makes the image worse announces itself; a
quantity confusion redistributes energy, and the eye has no reference for how
much energy should have been where.

**What does find it: printing the number and comparing it to one computed a
different way.** All five were found that way and none any other way. The
luminaire leak was found by integrating the distribution the shader evaluates and
comparing the lumens to the lumens the fixture was supposed to emit. The
mean-of-angles was found by printing the per-probe clearances next to their
average. The transposed basis was found by two runs producing identical output
when they should not have.

**So, six rules, and they are cheap:**

1. **When a fraction is applied to something, name the quantity in the same
   expression.** `0.09 * fixtureLumens` is checkable by reading it;
   `0.09 * peak` is not.
2. **Anything derived two ways must be printed both ways at least once**, in the
   session that derives it, with the two numbers next to each other. If they
   agree, say so in the comment and delete the second path. If they disagree, you
   have found this bug.
3. **A size, an angle or an intensity that crosses a module boundary carries its
   frame of reference in its name or in the comment at the boundary.**
   `uNoctisScreen` is the size of the target being drawn into; that sentence is
   now in the code beside it, because the sentence is the whole bug.
4. **When a number is derived from another number, print both — at the moment of
   derivation, in the same line.** Not "print the result". Both.

   Rule 2 is about a quantity computed two ways and is a *check*. This one is
   about a quantity computed one way, from a second quantity, and is a *habit*.
   It is the cheapest of the four and it would have caught most of the table
   above at the moment each was written rather than one to four sessions later:

   - `sin(atan(w/(H−y)))` was derived from a measured roadway openness of 0.512
     and never printed beside the facade openness of 0.244 that the same bake
     had measured. One line at boot now prints both and the ratio, 3.8.
   - `pierEvery: 34` was in the data and `i % 3 === 0` was in the code. Nothing
     printed "14 bays × 34.29 m, asked 34". Now something does, and it is one
     `ctx.log` at init.
   - The haze's `f` was derived from a density and a distance and printed
     nowhere beside the radiance it multiplies. That comparison is now in the
     comment with the arithmetic, because the shader cannot log.

   The rule has an edge that matters: a number derived from another number
   **and then used somewhere else** is where this bites. If the derivation and
   the use are in the same expression, reading it is enough. If a constant is
   authored in one file and consumed in another, print the pair at the boundary
   — that is the same instinct as rule 3 with an arithmetic obligation attached.

   Where the derivation is on the GPU and cannot log, the obligation moves to
   the comment: write the arithmetic out with real numbers from a real frame,
   the way `HAZE_FRAGMENT` and `noctisDefaultField` now do. A comment with
   numbers in it is checkable. A comment without them is a claim.

5. **A number without a derivation is a guess.** This is rule 4's premise
   promoted to a rule of its own, because it applies to numbers nobody derived
   *from* anything — a threshold, a cap, a count, a radius. Every constant in
   `budget.json`, `city-budget.json`, `look-budget.json` and `core/constants.js`
   carries the arithmetic that produced it or it does not belong there. It does
   not have to be right; it has to be *checkable*, so that the next session can
   disagree with the arithmetic rather than with the taste.

   The tell is a round number with a comment that restates it. "700 particles,
   because 700 is enough" is a guess. "700 particles, which over the 630 m³ of
   frustum inside the street's own half-width is 1.11 drops per m³, which
   Marshall–Palmer at 10 mm/h reaches at D ≥ 3.15 mm — the largest 4.4% of the
   rainfall by mass, everything below it being the veil the haze term already
   delivers" is a bound somebody can prove wrong.

   Where a number really is a budget rather than a measurement, say so and give
   the arithmetic that turns it into a *statement*: what does the world have to
   be like for this number to be the right one?

6. **Measure on a quiet machine when the effect is smaller than the drift, and
   when it is not, say which.** Paired A/B passes on this project have disagreed
   by up to 3.6 ms at the same light count, and `perfcheck`'s own headroom probe
   reads 8.9 ms after one route and 20.8 ms after three — the same work, the same
   pixel count, four minutes apart. A measurement smaller than that gap is not a
   measurement, and the honest move is to defer it rather than to report it.

   The corollary is the useful half: **counts do not drift.** Froxel occupancy,
   instance counts, draw calls and index writes are integers and are reproducible
   under load, so an A/B on one of them needs no quiet machine and no paired
   runs. Knowing which of the two kinds of number is in front of you is most of
   the discipline.

7. **MEASURED FROM WHAT, AND DOES THE OTHER SIDE AGREE?** Ask it of every new
   distance, extent or datum, at the moment it is written.

   This is a *class*, not an instance, and it is named here because the project
   has now found the same defect four times in four sessions without recognising
   it as one thing. Each was a length computed correctly from the wrong
   reference — not a wrong number, a right number measured from the wrong place:

   - **s22 — `kerbRef` measured from the wrong axis.** A band's `axis` field
     names the axis the band is FIXED on (`{ axis: 'x', at: b.x0 }`, whose
     `t0/t1` run over the chunk's **z**), and the doc comment over it called it
     the axis the band RUNS ALONG — the opposite. `kerbRef = band.axis === 'x' ?
     0 : 90` read the comment. Every kerbside prop on a north–south street was
     drawn across its pavement with its end to the road; **1 134 of 1 596 props**
     over the region.
   - **s23 — the abutment topped out at the soffit, not at the deck.** `viaduct
     SoffitY` = 18.20 m is where the deck BEARS; the deck's upper surface is
     22.20 m. The mass was built to the first and wanted to the second, so
     **8.60 m of the deck's 9.50 m width ended in mid air**, framed by two
     parapet returns floating 2.80 m above the abutment they stand over.
   - **s24 — a half-extent accumulated on the wrong axis, twice.** The delivered
     claim took `Math.max(sx, sz)/2` and applied it to BOTH axes, so a
     **2.4 × 0.06 m** hoarding panel was recorded as a **2.4 × 2.4 m** square:
     the larger half-extent is correct on one axis and is 40× the truth on the
     other.
   - **s25 — the queue's datum is the junction MOUTH, the assertion's is the
     STOP LINE, and they are 9.0 m apart.** `worstStopLineM` reads −12.517 m not
     because a vehicle enters the junction — over 11 538 frames **not one ever
     does** — but because two parts of the same system measure "how far past" from
     two different lines.

   **The reason none of them was caught is the same reason in all four: both
   sides of the check shared the assumption.** A two-sided check is only two
   descriptions if the two sides can disagree; where they spell the same mistake
   the same way, they are one description written twice, and §9.1's whole design
   is defeated without anything going red. s25's building claim is the cleanest
   demonstration — the generator's registry and the delivered census spell the
   yaw omission identically, so **both halves of a two-sided check report zero
   forbidden overlaps over 51.96 m² of masonry genuinely standing in a
   pavement**, across 78 of 419 buildings. Neither half is lying; they are the
   same sentence in two files.

   > **So a new distance carries its datum in the name, in the comment at the
   > boundary, or in the field beside it — and the check on it is written from
   > the OTHER end.** Rule 3 asks a quantity to carry its frame of reference;
   > this asks the second reader to state its own and compare. Where both readers
   > are written in the same session by the same hand, assume they share the
   > error and find a third source — the delivered geometry, a hand-computed
   > case, or the number printed from the opposite direction.

   This rule has an unfinished obligation attached to it. **76 of the 189 bounds
   in `tools/budget.json` have no derivation at all** (`node tools/budgetaudit.mjs`
   lists them, STATE 25 §2.2) — 40% of every threshold in the project. Rule 5
   says each of those is a guess; rule 7 says that for any of them expressing a
   *distance*, nobody has established what it is measured from either.

Measure before theorising. A theory about why a frame looks wrong costs an hour;
printing the number costs a minute and is right more often.

### 9.2 A city default travels unquestioned — session 73, and it is three already

The table above is *a number computed correctly and then used as a different
quantity*. §9.1's two variants are that failure at one remove. **This one is at
two removes and it is the one this project keeps repeating**: a value that was
correct where it was chosen, carried into somewhere it was never chosen for, by
code that had no opinion about place at all.

**THE TELL IS A DEFAULT THAT NOBODY PICKED FOR THE GROUND IT ENDED UP ON.** Not
a wrong number — a right number in the wrong county. All three below were found
by eye, none by a gate, and each was found separately without anyone noticing it
was the third:

- **`block:ground`'s porosity, (0,0) since session 1.** The earth plane was
  under the city and impervious was what it was. Session 63 made the same plane
  the COUNTRYSIDE — *"the terrain IS the earth plane and not a surface over
  it"* — and a default chosen for asphalt became the reflectance of every field
  in the world. Invisible for sixty-two sessions because until then it had never
  been visible land.
- **42 promenade lamp stations standing in the sea**, on a seabed 57–61 m down.
  The promenade's own station spacing is right for a promenade; nothing in it
  asks whether the bank it is spacing along is still a bank at x = 4 000.
- **The harbour's branch road at `kind: 'road'`**, which falls through
  `city.js`'s `porosityFor` to **0.0** — dense-graded city asphalt, a full
  mirror at this project's wet convention. It is a hundred-metre spur off the
  exit road, and session 65 had already measured THAT ROAD at **0.70** from the
  sand-patch model. Two roads, one junction, one of them carrying an arterial's
  sheen across a field. Session 72, and the operator found it by looking at it.
- **A traffic signal showing a red lens on the airport apron — session 75, and
  it is four.** `traffic.js` emits four heads at each of the four junctions of
  a 128 m arithmetic lattice NEAREST THE CAMERA. Session 35 gave that loop a
  predicate — *"does a landmark stand here"* — after ten heads were found
  standing in the weir's basin. It never got the other one. The vehicle placer
  in the same file has asked `cityExtentAt(x, z) <= 0` since session 34; the
  signal loop did not, so wherever the camera stands, so do the signals. The
  128 m junction grid is a CITY default and 5 km out it has changed counties.
  Found in a frame of the terminal stands and cropped 7× to be sure of it.

**WHY IT SURVIVES, AND IT IS NOT THE SAME REASON §9.1's VARIANTS DO.** Those
survive because their number is only read far away. This one survives because
**the default is correct at the place it was written**, so every reader near the
origin confirms it. The city's own gates cannot see it by construction:
`citycheck`'s region is one 10 × 10 chunk square about the origin (§4b), and the
whole class lives outside it.

> **A value carried past `CITY.extentEdgeM` is a value that has changed
> counties. Anything built for the city and reused beyond r ≤ 3 232 m is a
> candidate — signage, kerbs, drainage, lamp spacing, road surfacing, pedestrian
> behaviour, vehicle speeds, tree species — and the question to ask of it is not
> "is this number right" but "was this number ever chosen for HERE".**

The remedy is not a gate and this section does not propose one: four instances
in seventy-five sessions is not a rate a check pays for, and the check would
have to know what "chosen for here" means. **The rate is worth watching rather
than acting on**: the first three took seventy-three sessions and the fourth
took two, because the world grew a fifth landscape — and every one of the four
was found by standing somewhere new and looking, none by a gate. **The remedy is that a session which
extends the world asks the question of every default it inherits**, and writes
the answer down beside the extension — which is what session 72's `portRoad`
reading `exitRoadPorosity` rather than a literal is.

---

## 10. Session ritual

1. Read `CONTRACT.md`, then `STATE.md`.
2. Do the session's work.
3. `npm run gates` — green. **A suppressed assertion is not a pass.** A check
   that sits downstream of another is skipped when that other one fails; the
   skip is right and the silence is not. `lookcheck` prints every suppression
   under its own heading and exits 1 even if nothing else is red, and
   `gateaudit` fails if any assertion did not run on the control frames. A gate
   that cannot run is not a green gate.
4. Look at `tools/look-out/*.png`, and at anything else worth looking at —
   `node tools/lookat.mjs` puts the eye wherever the question is. The numbers
   are necessary and not sufficient.
5. Rewrite `STATE.md` for a reader with no memory of the conversation: what exists,
   what is stubbed, what is known broken, what to do first next time.

No progress narrative. Nothing is reported complete while a gate is red.

---

## 11. The player — the strategy, decided in session 17

**One state, no new collision system, and the camera is borrowed rather than
taken.**

Sixteen sessions produced a city nobody had ever been inside. Every frame came
from a fixed shot, a scripted spline or a pose — from somewhere somebody had
already decided was worth standing. A first-person controller is two things at
once, and the second is the larger: it is the feature that turns a city into
something you can be in, and it is the most powerful diagnostic this project
will ever have, because free movement goes places no route has been and finds
what routes were chosen not to.

- **ONE STATE.** No interiors, no vehicle to enter, no crouch, no swim, no jump.
  A controller grows states unless somebody writes down that it must not, and a
  second state doubles the surface of everything below before any of it has been
  walked on. `?player=1` registers it; nothing registers it by default.

- **Collision is the session-3 walkability mask and NOT a new system.** That
  mask is a flood fill over the whole city, asserted every `citycheck` run:
  connected cells, every landmark reachable on foot, and since session 15 the
  bridges carrying it across the river. The expensive part was done and gated
  fourteen sessions ago. `city.walkableAt(x, z, pad)` is `placement()`'s own
  four rules — buildings, landmark ground blockers, the origin block, the water,
  and bridge decks unblocking — evaluated at a point instead of rasterised into
  a 4 m grid, and the two are printed against each other by
  `tools/walkprobe.mjs --agreement`. The relation is an **inclusion and not an
  equality**, and the direction is the safe one: the rasteriser blocks every
  cell a blocker touches, so 1 278 of 9 216 cells it calls blocked have a free
  centre and **zero** go the other way. A mask that over-blocks can only claim
  less reachable city than there is.

  **It inherits that mask's gap, and the gap is now something you can walk
  into**: the mask has never contained a prop. Measured, 3×3 chunks: **147 of
  147 bollards, bins, cabinets, benches and planters stand in walkable space.**
  Building a second collision system quietly inside the controller is how the
  one gated mask stops being the answer, so this does not.

- **The ground is read off the geometry that was emitted, never recomputed.**
  `city.js`'s `buildGround` records every quad it emits and `surfaceAt` reads
  that list, so the origin block's keep-out clip, the bank cut and the bridge
  crossings are answered by the clip that decided them. A point query written
  from the corridor arithmetic would be a transcription of three clips whose
  whole job is deciding where a quad is *not* emitted, and it would be wrong in
  exactly the places those clips are interesting. `block.js` and `river.js`
  answer for their own surfaces the same way, and the delivered height is the
  **maximum** of the three — the topmost surface is the one you stand on, and a
  precedence order would have to be right about which of six overlaps is which.

- **"Up a kerb and not up a wall" is a comparison made BEFORE the move is
  committed.** The first draft tested only the mask and let the ground query
  snap the feet afterwards, which walked a person 1.02 m straight up the face of
  the quay wall and onto its parapet — because the mask blocks the WATER and has
  never blocked the WALL. Found on foot, in the fourth walk of the session,
  which is the whole argument for having walked. `PLAYER.stepUpM` is 0.20 m: the
  maximum habitable stair riser, above `BLOCK.kerbHeight` = 0.160 m by 1.25× and
  under `RIVER.parapet` = 1.05 m by 5.25×, with nothing in the world between.

- **ONE CLOCK, and the player is the fifth thing to integrate it.** `time` owns
  it (§3) and `traffic`, `weather` and `streetlife` each advance on the
  difference of `time.now` rather than on the raw `dt` the loop hands them, for
  the reason each of them writes down: `dt` is wall-clock seconds and a system
  integrating it arrives at a given capture in a different state on every run.
  The player does the same, clamped to the same [0, 0.1]. **The consequence is
  stated rather than discovered:** `?paused=1` freezes the player exactly as it
  freezes the traffic. You can still look — the mouse delivers a displacement
  and has no clock in it at all — and you cannot walk. That is what a paused
  world means. The stick, which delivers a *rate*, stops with everything else.

- **The camera is borrowed, and handing it back is one-way arbitration.**
  `runRoute`, `poseRoute` and `setShotAt` drive every gate and both film tools;
  the player is a new CONSUMER of `ctx.camera`, not a replacement. So
  `camera.setDriven(true)` stops that module writing the camera at all — not
  "writes the same thing", nothing, so that a disagreement is impossible rather
  than small — every explicit placement still works and emits `camera:placed`,
  and the player re-seats itself wherever it was put. The harness never loses an
  argument it did not know it was having. And because the switch omits the
  `register()`, every gate runs with `ctx.get('player')` undefined, which is the
  state they have run in for sixteen sessions.

- **Two input numbers are derived from outside this project, and both are
  bounded on both sides.** §9 rule 5 forbids a number without a derivation, and
  a controller is where "it feels right" usually goes:

  - **Dead zone, radial and rescaled.** `XINPUT_GAMEPAD_LEFT_THUMB_DEADZONE` =
    7849/32767 = 0.2395 and `..._RIGHT_THUMB_DEADZONE` = 8689/32767 = 0.2651 —
    the hardware's own centring tolerance, and different for the two sticks
    because only one of them integrates. **Radial**, on the magnitude of the
    pair: a per-axis zone squares the dead region into a box whose corner is at
    0.339, **41.6% further out on the diagonal than on the axes**, which is
    exactly the direction a player pushes to walk diagonally. **Rescaled** by
    `(m − d)/(1 − d)`, so the response is continuous at the boundary; without it
    the first movement past the zone is a step of 0.335 m/s appearing from
    nothing.
  - **Look curve `m^2`, bounded above and below in pixels per frame.** One pixel
    at the internal resolution and 50° fov is 0.0310° horizontally. From below:
    half deflection must stay at or under one degree a frame, so
    `0.5^k · 180 ≤ 60` gives **k ≥ 1.585**. From above: the smallest deflection a
    thumb can hold (0.1 of the post-dead-zone range) must move at least one pixel
    a frame, and `96.8 · 0.1^k` is **0.97 px at k = 2** and **0.10 px at k = 3** —
    so a cubic is not "smoother", it is a second dead zone that does not announce
    itself. The MOVE stick has no curve at all, because its output is a speed and
    a squared half-deflection walks at 0.35 m/s, slower than every pedestrian in
    frame.

- **The `player` route is the fourth in `perfcheck`, and the first at a person's
  pace.** `downtown_dense` calls 4.5 m/s "a brisk walk"; 4.5 m/s is 16.2 km/h and
  **3.21× the 1.40 m/s the crowd in the same frame is walking at**. Every
  millisecond this project has ever measured was measured from something moving
  through the city faster than anything in the city moves. The route differs
  from `downtown_dense` in pace, in standing on the pavement rather than the
  crown of the road, in an eye height taken from the surface it stands on, and
  in looking level — and in nothing else, so the difference between their
  numbers is attributable.

  Its measurement window is per-route and that is a capture parameter rather
  than a threshold: `budget.json` → `capture.framesByRoute`. See §9's table for
  why one was needed.
