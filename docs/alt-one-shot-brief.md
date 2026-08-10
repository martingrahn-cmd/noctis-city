# NOCTIS — one-shot build prompt

*Rename the project before you run this. Paste the whole thing as your first message in a fresh Claude Code session, in an empty repo, with `budget.json`, `perf-probe.js` and `perfcheck.mjs` already committed at `tools/`.*

---

You are building **NOCTIS**, a first-person open-world game in Three.js: a neon-lit city with a full day/night cycle, enterable buildings, drivable vehicles you can get in and out of, and light combat.

Read this entire brief before writing any code. It is a contract, not a wish list. The parts that constrain you are more important than the parts that describe the game.

## The one rule that governs everything

**You may not declare any task complete until the gates are green.** Not "mostly green", not "green except for one route". The gates are `tools/perfcheck.mjs`, `tools/shoot.mjs`, `tools/parsecheck.mjs` and `tools/playtest.mjs`. They exit non-zero when something is wrong. A non-zero exit is not a suggestion.

You may not weaken a gate to pass it. Specifically, you may not:

- lower a floor in `budget.json`
- delete, disable or skip a route, a test or an assertion
- add an exception, allowlist or `if (process.env.CI)` escape hatch
- reduce content — fewer props, fewer NPCs, shorter draw distance, smaller world — as a way to hit a frame budget

That last one is the failure you are most likely to commit, because it works. The floors in `budget.json` exist to make it fail loudly instead. If you find yourself reasoning that the scene would be fast enough with fewer trees, stop: you have found a rendering problem, not a content problem. Fix the renderer.

Raising a ceiling is allowed **once**, at the end of Phase 1, when you baseline against real measurements — and only upward from what the hardware actually delivers, never to accommodate code you have already written.

## Phase 0 — tooling before game code

Write no gameplay until all of this exists and runs.

1. **`CONTRACT.md`** at the repo root. It defines the module interface and it is the file every later phase reads first. Modules never import each other. Each module registers itself on a context object and reaches others by name: `ctx.get('time')`, `ctx.get('city')`. A module that throws during `init` or `update` is caught, logged once, and quarantined — the frame keeps rendering without it. A broken NPC system must never take down the world.

2. **`tools/parsecheck.mjs`** — walks every source file and asks whether it is syntactically *complete*, not merely valid. Truncated functions, unclosed blocks, a file that ends mid-statement. You will generate a lot of files; this catches the ones that got cut off.

3. **`tools/shoot.mjs`** — deterministic headless screenshots via Playwright with `--use-angle=metal`, fixed seed, from named camera positions defined in `shots.json`. Fails loudly on any console error. Writes PNGs to `tools/shot-out/`.

4. **`tools/playtest.mjs`** — boots the real game and asserts behaviour, not pixels. Start with: the world loads within 20s; the player can walk 100m without falling through terrain; entering and exiting a vehicle returns control cleanly; a building door transitions in and back out; time advances and the sun moves. Grow this file every phase. It should end at 30+ assertions.

5. **`tools/perfcheck.mjs`** and **`budget.json`** are already committed. Read them. Understand the floors before you write a renderer.

Wire all four into `npm run gates`, which runs them in sequence and exits non-zero if any fail.

## The spine: player state

Before any content, build the state machine. Everything else attaches to it.

Three states: `ON_FOOT`, `IN_VEHICLE`, `INDOORS`. Exactly one owns the camera and exactly one consumes input at any time. Transitions are explicit and reversible, and every transition is covered by a `playtest` assertion.

Get this wrong and every later system inherits the bug. Get it right and the rest is content.

## Architecture decisions you do not get to revisit

**Interiors are not seamless.** Door → trigger volume → fade → separate scene graph, city unloaded. This is how GTA did it through IV and it is the only version that holds a draw-call budget. Seamless interiors need cell-portal visibility and are, alone, a harder problem than everything else in this brief. Each interior gets its own budget block in `budget.json`, separate from the city's.

**One source of truth for time.** A single `time` module owns `timeOfDay` as a normalised float. Sun direction, sky colour, exposure, streetlight activation, sign emissive intensity, headlights, NPC density — all read from it. Nothing keeps its own clock. Nothing hardcodes a light colour. This is what makes a night scene hold together instead of looking like six systems disagreeing.

**Auto-exposure is mandatory, and it is what sells the neon.** Bright signs read as bright because the eye adapts to the dark around them. Without adaptation you get either blown-out signs or a black city.

**Everything procedural.** No downloaded models, textures or HDRIs. Buildings, road surfaces, signage, vehicles, NPCs, sky — generated at runtime from code and seeded noise. This keeps the repo small, the licensing clean, and the world infinitely variable by seed.

## Build order

Do not reorder this. Each phase must have green gates before the next begins.

1. **Streaming city grid.** Roads, blocks, building shells, LOD, frustum culling, instancing. No detail yet. Get the world loading and the frame budget honest while there is little in it.
2. **Time and light.** Day/night cycle, sky, sun, auto-exposure, streetlights, emissive signage. This is where the look is decided.
3. **Player state machine.** All three states, all transitions, camera and input ownership.
4. **Vehicles.** Driving model, entry and exit, traffic AI. Traffic is spline-following, not pathfinding.
5. **Interiors.** Three or four generated templates — shop, lobby, apartment, stairwell. Reused with variation across hundreds of doors.
6. **Street life.** NPCs, props, litter, signage density, weather. This is the phase that makes it look alive, and it is where you spend the draw-call budget you protected in phase 1.
7. **Combat.** Last, and deliberately thin. One weapon that feels good beats four that feel like nothing. Hit feedback and NPC reaction matter more than the weapon model.

If you run out of budget or context partway through, stop at a phase boundary with green gates. A finished phase 4 is worth more than a broken phase 7.

## Loop discipline

Work in small cycles: change → `npm run gates` → read the actual output → fix. Do not batch ten changes and then run the gates; you will not know which one broke it.

When a gate fails, read the artefacts before theorising. `tools/perf-out/*.png` and `tools/shot-out/*.png` are rendered from the same frames the numbers came from. Look at them.

When something looks wrong and you cannot find the cause, **bisect by disabling systems one at a time** rather than reasoning about which is most likely. A known failure of this approach: a project like this once shipped a fog layer of 700 additive billboards with no upper bound, and fifteen rounds of expert visual critique never found it — turning one weather layer off found it in a minute.

## Definition of done

- `npm run gates` exits 0 on a clean checkout.
- `playtest.mjs` holds 30+ assertions and all pass.
- All three player states work and every transition is asserted.
- Day and night both look deliberate. Screenshot each at noon, dusk, midnight.
- `README.md` states honestly what works, what does not, and what the measured frame times are — including the machine they were measured on. Do not describe the project as finished, AAA, or comparable to a shipped title. State what it is.

## What I do not want

Do not write a progress narrative. Do not tell me a phase is complete when the gates are red. Do not add features not in this brief because there was time left. Do not tune the budget to match your output.

If you disagree with a decision in this brief, say so in one line and then follow it anyway. If you find something in it that is actually impossible, stop and tell me rather than routing around it.

Begin with Phase 0. Show me `CONTRACT.md` before you write anything else.
