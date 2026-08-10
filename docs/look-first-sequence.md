# NOCTIS — look-first build sequence

*Replaces the one-shot brief. Five sessions, each a separate Claude Code conversation. Every session starts by reading `CONTRACT.md` and `STATE.md`, and ends by rewriting `STATE.md`.*

The premise: **one block that looks extraordinary is the entire problem.** A city is that block a thousand times. Solve the look on ten buildings and you have solved it on ten thousand — and you iterate against a scene that loads in two seconds instead of forty.

Do not build a city until session 3.

---

## Session structure

Every session, without exception:

1. Read `CONTRACT.md`, then `STATE.md`.
2. Do the work.
3. Run `npm run gates`. Green before you stop.
4. Rewrite `STATE.md`: what exists, what is stubbed, what is known broken, what the next session should do first.

`STATE.md` is written for a reader with no memory of this conversation. That reader is the next session.

---

# Session 1 — Light

**Scene: one block. Ten buildings, one street, one intersection. Nothing else.** No city, no traffic, no NPCs, no weather. If you find yourself building a street grid, stop — that is session 3.

This is the most important session in the project and the one most projects skip. Everything downstream multiplies whatever you achieve here. Multiply something flat and you get a large flat thing.

## What you are building

**A physical sky and sun.** Not a gradient. Preetham or Hosek-Wilkie, driven by a single normalised `timeOfDay` float and a latitude. Sun direction, sky luminance and horizon colour all fall out of the same model. Sunset must produce warm low-angle light because the geometry says so, not because someone tinted it orange at t=0.78.

**Auto-exposure with adaptation.** Measure scene luminance, drive exposure toward it with an asymmetric time constant — fast when it gets brighter, slow when it gets darker, like an eye. This is what makes neon read as bright: not the sign's intensity, but the darkness the eye adapted to around it. Without adaptation you get blown-out signs or a black city, and no amount of bloom fixes either.

**ACES filmic tonemapping** with correct linear-space compositing throughout. Every colour authored in linear, converted once at the end. Getting this wrong makes everything look like a 2010 WebGL demo and is very hard to diagnose later.

**A light budget that means something.** Sun and sky as the only global sources. Streetlights, windows and signs as local emitters with real falloff. Decide now whether you are doing clustered/tiled lighting — if the answer is yes, do it now, because retrofitting it in session 3 means rewriting every material.

**Bloom that is thresholded, not smeared.** Bloom should catch emitters and specular highlights, nothing else. If the whole frame glows softly, the threshold is wrong. A common mistake is compensating for weak lighting with heavy bloom; it reads as haze, not brightness.

## The gate for this session

`tools/lookcheck.mjs` — renders the same fixed camera position at **dawn (0.25), noon (0.5), dusk (0.78) and midnight (0.0)** and asserts:

- mean luminance falls in a distinct band per time of day, and the four bands do not overlap
- no more than 0.5% of pixels are fully clipped white at any time
- no more than 2% are crushed to pure black at night
- histogram spread (stddev of luminance) above a floor at every time — a flat frame fails even if its mean is correct
- night frame contains at least 30 distinct saturated emitter clusters
- the four frames are visually distinct from each other by a mean-squared-difference floor

Write the four PNGs to `tools/look-out/`. I will look at them. So should you — read the images, not just the numbers.

## Definition of done for session 1

Four screenshots of ten boxes on a street that make me want to see the city. Not "acceptable". If dusk does not look genuinely good on ten grey boxes, the lighting is not finished, and adding buildings will not help.

Iterate here as long as it takes. This is the session where spending six hours is correct.

---

# Session 2 — Materials

Same block. Still no city.

Now the ten boxes stop being boxes. Roughness and metalness that mean something physically. Wet asphalt with correct specular response and a reflection strategy chosen deliberately (screen-space, planar, or probe — pick one, justify it in one line in `STATE.md`). Glass that reflects the sky and shows interior light at night. Emissive signage that interacts with the exposure system rather than ignoring it. Concrete that has variation without looking like noise was applied to it.

Procedural everything — no downloaded textures. Triplanar or UV-mapped noise-driven materials, generated at load.

Extend `lookcheck.mjs`: a wet-surface variant of each time of day, and a floor on distinct material response — the frame must show a measurable spread of specular behaviour, not one roughness value everywhere.

**Done when:** the same four times of day now look like a place rather than a lighting test.

---

# Session 3 — City

Only now. You are multiplying a look that already works.

Streaming grid, LOD, instancing, frustum culling, building generation with era and condition variation. Apply the authored-city addendum in full — clumping, wear, imperfect alignment, reserved saturation, negative space, hand-placed landmarks.

This is where `perfcheck.mjs` becomes the primary gate. The ceilings stop the slideshow; the floors stop the agent from protecting frame time by deleting the world. Neither may be weakened.

Expect the look to degrade when the scene scales. That is normal and it is information — it tells you which session-1 decisions did not survive contact with 400 draw calls. Fix them in the lighting system, not by turning things off.

---

# Session 4 — Motion and life

Weather as a layer over the existing light model, never as its own lighting. Rain wets the material system you already built; it does not introduce a second one. **Cap every particle system with a hard upper bound** — an unbounded additive fog layer is a known way to destroy a frame budget invisibly.

Then traffic on splines, NPCs with varied silhouettes and clothing saturation, street props. Density is the goal here, not individual quality. This is the phase that spends the draw-call budget session 3 protected.

---

# Session 5 — Player and interaction

The three-state spine: `ON_FOOT`, `IN_VEHICLE`, `INDOORS`. Exactly one owns the camera and input at a time. Interiors are load-transitioned, never seamless, with their own budget block.

Combat last and deliberately thin. One weapon that feels good beats four that feel like nothing.

---

## Standing rules for all sessions

- No gate may be weakened to pass. No floor lowered, no route skipped, no assertion deleted.
- Reducing content to hit a frame budget is not an optimisation. It is the failure the floors exist to catch.
- When something looks wrong and reasoning has not found it, bisect by disabling systems one at a time. A project of this kind once hid a frame-killing bug in 700 unbounded additive billboards through fifteen rounds of expert visual critique; switching one weather layer off found it in a minute.
- Modules never import each other. `ctx.get('time')`. A module that throws is quarantined, and the frame keeps rendering.
- One source of truth for time. Nothing keeps its own clock.
- No progress narratives. Do not report a session complete with red gates.
