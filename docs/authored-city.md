# NOCTIS — addendum: the city must read as authored

*Append this to the main brief, after "Architecture decisions you do not get to revisit".*

---

A procedurally generated city announces itself as generated in five specific ways. Each one is a decision you can make differently, and each one has a check attached. Do not treat this section as flavour text — the metrics below become floors in `budget.json` and assertions in `tools/citycheck.mjs`.

## 1. Clumping, not uniform distribution

The default failure is even spacing: a tree every 12m, a bench every 40m, shops distributed smoothly. Real cities are lumpy. Five restaurants on one block and none for the next three. A stretch of nothing between two dense nodes.

Generate density from low-frequency noise, then place within it — never place on a grid with jitter. Jitter reads as noise; clustering reads as intent.

**Check:** the coefficient of variation of prop density across blocks must exceed **0.6**. Below that the city is too evenly spread. `citycheck.mjs` computes it from the placement data, not from screenshots.

## 2. Age, wear and mixed vintage

Everything the same age is the strongest tell. A real street has a 1960s block next to a 2010s block, patched asphalt against fresh asphalt, one dead neon sign in a row of working ones, a boarded shopfront, a facade that was repainted a different shade than its neighbour.

Give every building an `era` and a `condition` — both driven by district, both affecting palette, window rhythm, floor height and material roughness. Give roads a patch layer. Let a percentage of signs be unlit or half-lit.

**Check:** at least **4 distinct eras** present, at least **15% of signage** in a non-working state, road surface must contain at least **3 material variants**.

## 3. Imperfect alignment

Perfect right angles and exact grid alignment are the visual signature of generation. Buildings should sit slightly off their lot line. Signs hang a degree or two off level. Kerbs are worn irregularly. Street furniture is not parallel to the road.

The amounts are small — a degree here, ten centimetres there. Large randomness looks broken; small consistent deviation looks real.

**Check:** at least **60% of placed objects** deviate from perfect axis alignment, with deviation under **3°**. Both bounds matter.

## 4. A palette with ugliness in it

The neon-teal-and-magenta palette is the single most AI-looking choice available, because it is what every reference image converges on. A real neon street is mostly sodium orange, dead beige concrete, dirty white fluorescent from a laundromat window, and *then* a few saturated signs that pop precisely because everything around them is drab.

Reserve high saturation. Make the majority of the surface area muted and slightly unpleasant. The neon earns its impact from contrast, not from quantity.

**Check:** no more than **12% of screen pixels** above 0.6 saturation, measured across the night route. If the whole frame glows, nothing glows.

## 5. Negative space and dead zones

Generated worlds are uniformly interesting. Real ones have parking lots, blank side walls, service alleys, a fenced empty lot, a stretch of road with nothing on it. Emptiness is what makes density feel dense, and it is what makes a place feel navigable rather than wallpapered.

**Check:** at least **8% of city blocks** must be low-detail zones — parking, empty lot, industrial yard, park.

## 6. Authored landmarks

This is the one that does the most work for the least effort. Generate everything, then place **6 to 10 unique structures by hand** that the generator cannot produce: a distinctive tower, an elevated rail curve, a bridge, a stadium, a district of one unusual building type. They break the procedural rhythm and give the player something to navigate by.

A city you can orient yourself in feels designed. A city where every direction looks equally plausible feels generated, no matter how good the individual assets are.

**Check:** `playtest.mjs` asserts that at least 5 landmarks are visible from the elevated camera position, and that each is reachable on foot.

---

## `tools/citycheck.mjs`

Build this alongside the other gates in Phase 0. It reads the generator's placement output directly rather than analysing pixels — it is checking the *decisions*, not the render. Wire it into `npm run gates`.

The thresholds above are starting points. Baseline them against your first generated city, look at the result, and set them where they actually bite. A threshold you already pass is not a gate.

## What not to do with this section

Do not add a "handmade feel" pass at the end that scatters random imperfection over a finished uniform city. It will look like a finished uniform city with noise on top. Every item above is a property of *how the world is generated*, and belongs in the generator from the first block it places.
