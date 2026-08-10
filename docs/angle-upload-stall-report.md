# ANGLE / Metal: one upload call stalls ~9 ms once per frame, and the victim is chosen by upload composition

**Filed against:** ANGLE, Metal back end.
**Component:** ANGLE > Metal
**Reported by:** the NOCTIS project (a WebGL2 renderer), sessions 9c–10, 2026-08-07 to 2026-08-08.

---

## Summary

On ANGLE-Metal (Apple M4), a WebGL2 application that issues a steady stream of
buffer and texture uploads every frame sees **almost exactly one upload call per
frame take far longer than the rest**. The total number of such calls is
conserved: across 24 measured arms in one experiment and 18 in another — six
different content configurations, three different upload schedules, two
different camera routes — the count of upload calls taking over 1 ms per run
equalled the number of recorded frames to within 0–7, while the *composition* of
which call family absorbed them swung by 2.7×.

The stall is not proportional to the work. Which call pays it depends on what
else the frame uploaded, and the cost of paying it ranges from ~1 ms to ~9.2 ms
depending on which call is chosen. Concretely: the same
`texSubImage3D`-into-`TEXTURE_2D_ARRAY` calls, **identical in count and in bytes
to the byte**, run slow at 0.82% in one build and 1.55% in another that differs
only in unrelated per-instance vertex data.

We cannot see below the WebGL API, so this report does not claim a cause. It
provides counted, reproducible evidence that the choice of victim is driven by
upload composition and that the total is conserved, which we believe is enough
to localise it.

---

## Environment

```
GPU string : ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)
Browser    : Chromium (Playwright `channel: 'chromium'`)
Flags      : --use-angle=metal --enable-gpu --ignore-gpu-blocklist
             --enable-webgl-draft-extensions --disable-frame-rate-limit
             --disable-gpu-vsync
Context    : WebGL2, 2560x1440 internal render target, HalfFloat MRT
OS         : macOS (Darwin 24.2.0)
```

`EXT_disjoint_timer_query_webgl2` is advertised on this configuration and
**never retires a result** — issued 0, drained 0, starved 2407 across a
2400-frame run, with an eight-query pool. That is a second, separate report; it
is mentioned here because it is why every timing below is CPU-side wall clock
around the GL call rather than a GPU timestamp.

---

## What was measured

An in-page instrument wraps `texSubImage2D`, `texSubImage3D`, `bufferSubData`
and `bufferData` on the live context and records, per frame and per call
family: call count, byte count, total milliseconds, and the number of calls
exceeding a 1 ms threshold. `texSubImage3D` is split by target so the
array-texture uploads are distinguishable from the 3D-texture ones.

**The counter was falsified before it was believed.** A known number of
`texSubImage3D` / `bufferSubData` calls was injected through the same wrapped
context on known frames, and the counter was required to move by exactly the
injected number, on exactly the injected rows, and nowhere else — two-sided.
Result: 48 array-target, 24 3D-target and 30 buffer calls injected over a
4 320-call steady background, all counts exact, bytes exact to the byte
(302 088 192), rows exact; and a deliberately large 48 MB upload tripped the
slow counter on its own row 6 of 6. A separate run-time cross-check requires
that any frame whose largest single call is a `texSubImage3D` must also count
one in its own row: **0 mismatches on all 24 arms.**

---

## Finding 1 — the stall count is conserved at one per frame

Total upload calls over 1 ms, per run, against that run's recorded frame count:

| experiment | route | arms | slow upload calls | recorded frames |
|---|---|---|---|---|
| A | night_rain | 12 | 2403–2409 | 2402 |
| A | downtown_dense | 12 | 2166–2336 | each arm's own, ±7 |
| B | night_rain | 12 | 2399–2410 | 2396–2406 |
| B | downtown_dense | 6 | tracks each arm | ±5 |

Thirty-six arms, six content/schedule configurations, two routes: the total is
the frame count, every time. Meanwhile the *split* between call families moves
by up to 2.7×.

This is the finding we cannot explain from the API side. It says the stall is
not a property of any particular call — it is a per-frame event that attaches
itself to one call in the upload stream.

## Finding 2 — identical calls, identical bytes, doubled slow rate

Two builds of the application differing only in per-instance vertex attribute
content — same draw calls, same triangles, same textures, same texture uploads
— measured on `night_rain`, 6 interleaved arms a side, fresh page per arm:

```
texSubImage3D (TEXTURE_2D_ARRAY), 56 calls x 52 upload frames:
  build A : 2 912 calls, 36.5 MB, slow>1ms 44/48/45/47/42/45   rate 1.55%
  build B : 2 912 calls, 36.5 MB, slow>1ms 24/25/26/20/23/25   rate 0.82%
                                                        ratio  1.90x
```

Counts and bytes are **exact in every arm of both pools**. Per bake event,
build A stalls on ~87% of them and build B on ~46%. On the other route the same
comparison gives 1.4% against 0.9%, a ratio of 1.64.

Solving each arm's (calls, slow, total ms) for the fast-path cost with
slow ≈ 9.2 ms gives a fast path of 0 ± 0.01 ms in every arm: the slow population
**is** the ~9 ms stall, not a fog of 1–2 ms calls.

Build B absorbs its share elsewhere: 16–17% of its `texSubImage2D` calls run
slow, 2.7–4.8× build A's rate, **on call-count- and byte-identical streams
(1 466.6 MB in both)**, as 1–3 ms hits. Total time inside uploads is equal
between the builds to within drift (~19–20 s per 2 400-frame run).

## Finding 3 — the victim follows the schedule, and the cost follows the victim

The application was then changed to spread one chunk's array-texture upload —
56 `texSubImage3D` calls of 12.25 KiB each, previously all in one frame — over
several frames, without changing the total. Same bytes, same slots, same
destination layers.

```
night_rain, texSubImage3D (TEXTURE_2D_ARRAY):
  burst   : 2 856-2 968 calls over  51-53 frames, inter-frame gap median 19-20
            slow>1ms 42-45,  389-427 ms total in the family
  dripped : 2 856-3 024 calls over 357-378 frames, gap median 1
            slow>1ms 70-82,  558-709 ms total in the family
```

Dripping reduces the probability that an upload frame catches the stall from
~87% to ~20%, and increases the number of upload frames 6.9×, for a net
**increase** in slow calls in that family — which the conservation law then
takes back out of the other families. Frames past 14.5 ms fall from
{53 46 47 47 71 55} to {30 34 28 31 45 38} on this route, and on the other route
the drip produces runs of 14, 28 and 69 **consecutive** frames past 14.5 ms
where the burst schedule produces runs of 0, 1 and 5.

We read this as: the driver pays one stall per frame somewhere in the upload
stream; the schedule decides which call it lands on; and the price is between
~1 ms and ~9.2 ms depending on the call.

---

## Reproduction

The application is a WebGL2 city renderer. The two schedules are one URL
parameter apart, which makes this an A/B on one build:

```
?fieldDrip=0    all 56 texSubImage3D calls of a chunk's field in one frame
?fieldDrip=4    8 calls a frame over 7 frames, same bytes, same layers
```

The uploads under test are two `TEXTURE_2D_ARRAY` textures, RGBA8,
56 x 56 x 840 (28 layers x 30 slots), uploaded one layer at a time via
`texSubImage3D` out of a CPU mirror. Steady-state traffic in the same frames is
~43 000 `bufferSubData` calls per 2 400-frame run (1 176 MB) and ~7 265
`texSubImage2D` calls (1 466 MB).

Attached logs (per-arm counts, per-frame rows, and the falsification run):

```
glcount-night_rain.log            experiment A, 12 arms
glcount-downtown_dense.log        experiment A, 12 arms
glcount-s10-drip-night_rain.log   experiment B, drip vs burst
glcount-s10-drip-downtown_dense.log
glcount-s10-drip14-downtown_dense.log
```

Each log's `counts:` lines carry, per arm: calls, upload frames, inter-frame gap
median, slow-call count, total milliseconds and total bytes, per call family.
The `count-alignment vs maxName` line is the run-time cross-check described
above.

---

## What would help

1. Whether ANGLE-Metal serialises on a per-frame resource — a staging-buffer
   ring, a command-buffer boundary, a fence — such that exactly one upload per
   frame waits on it.
2. Why the wait costs ~9 ms when it lands on a burst of 56 x 12.25 KiB array
   layers and ~1–3 ms when it lands on the steady 123 KB texture uploads. A
   size class that the smaller steady volume keeps provisioned and the burst
   does not would fit the evidence.
3. Whether `EXT_disjoint_timer_query_webgl2` retiring results would let an
   application see this without wrapping every call — see the separate note in
   the environment section.

We are not asking for a fix in order to ship; the application has documented the
cost and moved its own ceiling. This is filed because the counted logs plus the
conservation law are an unusually specific repro and are worth more to whoever
owns this code than they are to us.
