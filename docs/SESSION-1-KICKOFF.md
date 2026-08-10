# Session 1 kickoff — paste this into a fresh Claude Code session

*Run this in an empty repo with `docs/` and `tools/` already populated from the zip. Rename NOCTIS to whatever you're calling it before you paste.*

---

We're building **NOCTIS**, a first-person open-world game in Three.js — neon city, full day/night cycle, enterable buildings, drivable vehicles, light combat. It's a five-session build and this is session 1.

Read these three files before writing anything:

- `docs/look-first-sequence.md` — the build sequence. You are doing session 1 only.
- `docs/authored-city.md` — how the world avoids looking procedurally generated. Relevant from session 3, but read it now so session 1's decisions don't foreclose it.
- `tools/budget.json` — the performance and content contract.

**Session 1 is lighting, on a scene of ten buildings and one intersection.** No city, no streaming grid, no traffic, no NPCs, no weather, no player states. If you catch yourself building a road network, you have drifted — stop and re-read the brief.

Start with Phase 0 tooling, then the light rig:

1. `CONTRACT.md` — the module interface. Modules never import each other; they register on a context object and reach each other by name via `ctx.get()`. A module that throws during init or update is caught, logged once, and quarantined so the frame keeps rendering without it. Write this first; every later session reads it before anything else.
2. `tools/parsecheck.mjs` — verifies every source file is syntactically *complete*, not merely valid. Catches files that got truncated mid-generation.
3. `tools/lookcheck.mjs` — the session 1 gate. Renders a fixed camera at dawn, noon, dusk and midnight and asserts against the criteria in the brief. Writes PNGs to `tools/look-out/`.
4. `npm run gates` — runs parsecheck then lookcheck, exits non-zero if either fails.

Then the actual work: physical sky and sun driven by a single `timeOfDay` float, auto-exposure with asymmetric adaptation, ACES tonemapping with correct linear-space compositing throughout, a deliberate local-light strategy, and thresholded bloom.

Three things I care about more than speed:

- **You may not weaken a gate to pass it.** No lowered floors, no skipped assertions, no environment-variable escape hatches.
- **Look at the images, not just the numbers.** The four PNGs are the deliverable. Read them before you tell me a phase is done.
- **No progress narratives.** Don't tell me something is complete while the gates are red. If you disagree with a decision in the brief, say so in one line, then follow it.

The bar for done: four screenshots of ten grey boxes on a street that make me want to see the city. Not "acceptable" — if dusk doesn't look genuinely good on ten boxes, the lighting isn't finished, and adding buildings won't fix it. Spend as long as this takes; it's the session that everything else multiplies.

Finish by writing `STATE.md` for a reader with no memory of this conversation: what exists, what's stubbed, what's known broken, what session 2 should do first.

Show me `CONTRACT.md` before you write anything else.
