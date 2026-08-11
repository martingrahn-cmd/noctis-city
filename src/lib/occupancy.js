/**
 * occupancy.js — ONE KEEP-OUT REGISTRY, READ AND WRITTEN BY EVERY GENERATOR.
 * ==========================================================================
 *
 * CONTRACT §9.1 says:
 *
 *   > Anything placed procedurally is tested against the existing occupancy, or
 *   > it is not placed.
 *
 * That rule has now been broken seven times in seven places, by seven different
 * placement routines, each of which carried its own private idea of what "the
 * existing occupancy" was:
 *
 *   session 5   viaduct piers inside buildings
 *   session 4b  bollards, bins and cabinets inside buildings (146 of 838)
 *   session 14  208 of 208 signs inside their own building
 *   session 15  glazing and quayside frontages overlapping each other
 *   session 15  buildings standing in the river (40 of them, 16–29 m deep)
 *   session 19  a viaduct deck terminating inside a house
 *   session 21  a landmark dome standing across a carriageway
 *
 * SEVEN INSTANCES IS NOT SEVEN BUGS. Each repair added one more private test to
 * one more placement loop — `insideKeepout` here, `landmarkBlocks` there,
 * `riverBlocks` in a third place, `occupied(occluders, ...)` in a fourth — and
 * every new generator had to remember all four and invent the fifth. What was
 * missing is a place for the answer to live.
 *
 * WHAT THIS IS. A list of axis-aligned claims, each carrying a CATEGORY, a
 * footprint and a VERTICAL EXTENT, plus a table of which categories may not
 * overlap which. Every generator writes its claims into it and asks it before
 * placing anything. One structure, one query, one table.
 *
 * WHY THE VERTICAL EXTENT IS NOT OPTIONAL, and it is the reason a flat
 * occupancy list could never have been the answer. Session 5 wrote the
 * distinction down and then built it as two functions rather than as one
 * quantity:
 *
 *   > `landmarkOccluders` answers "what blocks a ray to the sky"; the
 *   > walkability flood fill was asking "what blocks a person" ... A viaduct is
 *   > the first structure in this city that a person walks *under*, so the two
 *   > answers separate: 480 m of deck at 21 m blocks every ray and no
 *   > pedestrian.
 *
 * Two functions is how you get a third question with no answer. A claim that
 * carries `[y0, y1]` answers all of them from one list: a deck at 18.2–21.9 m
 * conflicts with a 60 m building and not with a road, and nobody has to
 * maintain a second list to know that.
 *
 * WHY A CONFLICT TABLE AND NOT A BOOLEAN. "Occupied" is not a property of a
 * point, it is a RELATION between what is there and what is being placed. A
 * pavement and a bollard share ground on purpose; a carriageway and a bollard
 * do not. A bridge deck and the water share a footprint on purpose; a building
 * and the water do not. A single `occupied()` predicate can only be right about
 * one of those pairs, which is why this project has four of them.
 *
 * PURE, AND THAT IS LOAD-BEARING RATHER THAN TIDY. `src/lib/citygen.js` runs in
 * the streaming worker as well as on the main thread (CONTRACT §8.1) and must
 * be deterministic in `(rootSeed, cx, cz)` alone. A registry holding module
 * state would make the worker's answer depend on what the main thread happened
 * to have built.
 */

/**
 * THE CATEGORIES. Each one is a thing that claims ground, and the list is
 * deliberately finer than "solid / not solid" — every split below exists
 * because two members of the coarser category answer a conflict question
 * differently.
 *
 *   building      a generated mass, ground to roof
 *   landmark      a hand-placed structure's GROUND-STANDING solid: a drum, a
 *                 tower shell, a viaduct leg. Not its deck.
 *   deck          an elevated structure with clear space under it: the viaduct
 *                 deck, the arch's transit deck, a bridge. Split from `landmark`
 *                 because it is the one category whose conflicts are decided by
 *                 the vertical extent rather than by the footprint.
 *   water         the river channel. Split from `landmark` because a deck may
 *                 cross it and a building may not.
 *   carriageway   the running surface of a road
 *   pavement      the footway beside it. SPLIT FROM `carriageway`, and this is
 *                 the split that makes the table work at all: a bollard on a
 *                 pavement is street furniture and a bollard on a carriageway
 *                 is a collision, and one `road` category cannot say both.
 *   path          a park path. A pavement that is not beside a road.
 *   block         the origin block's authored keep-out (CONTRACT §7, block.js)
 *   prop          street furniture and planting, BELOW head height
 *   canopy        the same object ABOVE head height. Split from `prop` because
 *                 a crown over a carriageway is a street tree and a bollard on
 *                 one is a collision — and because two crowns overlapping is a
 *                 clump rather than a defect.
 *   sign          a FREESTANDING sign pylon. A flush or projecting sign is part
 *                 of its building and claims nothing.
 *   site          construction-site fixtures: hoarding, crane base, spoil,
 *                 part-built frame
 *   feature       a park's own built content: pond, pavilion, monument, edging
 */
export const CATEGORIES = [
  'building', 'landmark', 'deck', 'water',
  'carriageway', 'pavement', 'path', 'block',
  'prop', 'canopy', 'sign', 'site', 'feature',
];

/**
 * WHICH CATEGORIES MAY NOT OVERLAP WHICH.
 *
 * Read as an undirected graph: an entry in either row forbids the pair. The
 * table is symmetrised at module load by `buildConflictTable`, so an
 * asymmetric edit is a typo that cannot survive — the two halves are not two
 * numbers that have to agree (CONTRACT §9.1).
 *
 * EVERY ROW IS A SENTENCE ABOUT THE WORLD, and where a pair is ABSENT that is
 * also a sentence and it is written down below the table.
 */
const FORBIDDEN = {
  /**
   * A building overlaps nothing. It is the one category with no exceptions:
   * every other thing in this city is either outdoors, under something, or
   * across something, and a building is none of those.
   *
   * `building × building` is in the list and it is not a formality — the four
   * island frontages have overlapped at their corners since session 4, and
   * session 20 found a roof sign standing inside the building next door
   * because of it (STATE 20 §6).
   */
  building: ['building', 'landmark', 'deck', 'water', 'carriageway', 'pavement',
    'path', 'block', 'prop', 'canopy', 'sign', 'site', 'feature'],

  /**
   * `canopy` — THE PART OF A PROP THAT IS OVER YOUR HEAD, and it is the
   * category the delivered census found it needed on its first run.
   *
   * A prop is claimed as two bands split at `HEAD_CLEAR_M` = 2.10 m (see
   * `city.js`). The lower band is `prop` and conflicts with everything a prop
   * conflicts with. The upper band is this, and it conflicts with SOLIDS
   * ONLY — a canopy inside a wall is wrong and a canopy over a carriageway is
   * a street tree.
   *
   * `canopy × canopy` IS ABSENT AND THAT IS THE POINT. Two crowns interlacing
   * is what a CLUMP looks like, and `docs/authored-city.md` §1's clumping rule
   * is what this session's park planting was built to satisfy: 4 clump centres
   * at a 9 m Gaussian spread puts trees about 6 m apart inside a group, and a
   * 4.6 m crown at 6 m centres MUST overlap or the rule is not being obeyed.
   * Measured on the first run: 0.12 to 0.33 m² of crown-on-crown, which is a
   * park rather than a defect. Two TRUNKS in the same place is still caught,
   * because a trunk is in the lower band.
   */
  canopy: ['building', 'landmark', 'block'],

  /**
   * A landmark's ground solid stands ON ground, so it takes the ground it
   * stands on away from everything that uses it.
   *
   * `landmark × block` IS ABSENT, and the reason is that both are AUTHORED.
   * `BLOCK_KEEPOUT` is a statement to the GENERATOR — "do not place here,
   * block.js owns this ground" — and the viaduct is not the generator. Session
   * 5 chose the viaduct's crossing so that its supports stand in the block's
   * own clear cross-street band, and what checks that is a numeric assertion on
   * the leg positions (`citycheck` → `viaductLegsInsideBlockClearBandM`) rather
   * than a blanket exemption in this table. A pair excused here would be
   * excused everywhere.
   */
  landmark: ['building', 'carriageway', 'pavement', 'path', 'prop', 'canopy', 'sign', 'site', 'feature'],

  /**
   * A deck conflicts by HEIGHT. Its footprint crosses roads, water and parks on
   * purpose — that is what a viaduct is — and every one of those pairs is
   * absent from this row for that reason. What it may not do is pass THROUGH a
   * solid, and `overlaps()` decides that on `[y0, y1]`: a 60 m building under a
   * 21 m deck overlaps and a 9 m one does not.
   *
   * `deck × landmark` is absent because a deck's own legs are `landmark`
   * claims directly under it, which is the arrangement rather than a defect.
   */
  deck: ['building'],

  /**
   * Water takes the ground from anything that stands in it. A DECK crosses it
   * (absent), and the `[y0, y1]` test is what makes that exact rather than a
   * special case: the channel claims −depth to +0.05 m and a bridge soffit is
   * at 3.0 m.
   */
  water: ['building', 'carriageway', 'pavement', 'path', 'prop', 'sign', 'site', 'feature'],

  /**
   * A carriageway carries vehicles and nothing else. `carriageway × pavement`
   * is absent because the two are emitted edge to edge by construction and a
   * shared boundary is not an overlap (see `overlaps` — the test is strict).
   */
  carriageway: ['building', 'landmark', 'water', 'prop', 'sign', 'site', 'feature', 'path'],

  /**
   * A pavement carries people AND street furniture, so `pavement × prop` is
   * absent — that pair is the whole point of a pavement. What it may not carry
   * is a building, a landmark leg, a hoarding or a pond.
   */
  pavement: ['building', 'landmark', 'water', 'site', 'feature'],

  /** A park path is a pavement that is not beside a road. Same row. */
  path: ['building', 'landmark', 'water', 'carriageway', 'site', 'feature', 'prop'],

  /** The origin block. See the note in `landmark` for the one pair that is absent. */
  block: ['building', 'prop', 'canopy', 'sign', 'site', 'feature'],

  /**
   * `prop × prop` IS IN THE TABLE, and until this session nothing tested it
   * except the kerbside spacing rule. Two trees at the same point are one tree
   * that renders twice.
   */
  /**
   * `prop x path` IS FORBIDDEN WHERE `prop x pavement` IS NOT, and the
   * asymmetry is a measurement rather than an oversight. A pavement is 4.2 m
   * wide and the kerb walk keeps a 2.1 m furniture strip inside it by
   * construction, so street furniture and people share it by design. A park
   * path is 2.8 m wide with no furniture strip at all — so a bench goes BESIDE
   * a park path and ON a pavement, which is also what they do.
   */
  prop: ['building', 'landmark', 'water', 'carriageway', 'path', 'block', 'prop', 'sign', 'site', 'feature'],

  sign: ['building', 'landmark', 'water', 'carriageway', 'block', 'prop', 'sign', 'site', 'feature'],

  site: ['building', 'landmark', 'water', 'carriageway', 'pavement', 'path', 'block', 'prop', 'sign'],

  feature: ['building', 'landmark', 'water', 'carriageway', 'pavement', 'path', 'block', 'prop', 'sign'],
};

/**
 * The table, symmetrised, as a Set of `'a|b'` keys with `a <= b`.
 *
 * Built once at module load from `FORBIDDEN` so that the two halves of every
 * pair cannot disagree. An unknown category name in `FORBIDDEN` throws HERE,
 * at load, rather than silently never matching anything — a conflict rule that
 * names a category nobody claims is CONTRACT §9.1's config-the-code-does-not-
 * read, and this file is the last place that should carry one.
 */
function buildConflictTable() {
  const known = new Set(CATEGORIES);
  const out = new Set();
  for (const [a, list] of Object.entries(FORBIDDEN)) {
    if (!known.has(a)) throw new Error(`occupancy: unknown category '${a}' in FORBIDDEN`);
    for (const b of list) {
      if (!known.has(b)) throw new Error(`occupancy: unknown category '${b}' in FORBIDDEN.${a}`);
      out.add(a <= b ? `${a}|${b}` : `${b}|${a}`);
    }
  }
  return out;
}

const CONFLICTS = buildConflictTable();

/** May a claim of category `a` overlap one of category `b`? */
export function mayOverlap(a, b) {
  return !CONFLICTS.has(a <= b ? `${a}|${b}` : `${b}|${a}`);
}

/** The forbidden pairs, as `[a, b]` rows. The gate prints this so the table is visible. */
export function conflictPairs() {
  return [...CONFLICTS].map((k) => k.split('|')).sort();
}

/**
 * THE VERTICAL EXTENT OF A GROUND SURFACE, and it is one number rather than
 * three.
 *
 * A carriageway, a pavement, a park path and the water's surface are all
 * "ground" and all have to overlap a building (whose `y0` is 0) while not
 * overlapping a deck. 0.05 m is above every value in `city.js`'s `GROUND_Y`
 * table (0.020–0.033) and 364× below the viaduct's soffit at 18.2 m, so no
 * plausible drift in either can make the test ambiguous.
 */
export const SURFACE_TOP_M = 0.05;

/**
 * Do two claims overlap in three dimensions?
 *
 * STRICT ON EVERY AXIS, and that is what lets surfaces be emitted edge to edge.
 * A carriageway ending at x = 7.5 and a pavement starting at x = 7.5 share a
 * line and not an area, and a non-strict test would report every kerb in the
 * city as a collision. The same strictness on `y` is why a building at
 * `y0 = 0` and a channel whose surface is at `y1 = 0` would NOT have collided,
 * which is why `SURFACE_TOP_M` is 0.05 and not 0.
 *
 * `pad` is added to `a` on both horizontal axes. It is the placing object's own
 * half-width where the caller has a point rather than a box.
 */
export function overlaps(a, b, pad = 0) {
  return (
    a.x1 + pad > b.x0 && a.x0 - pad < b.x1 &&
    a.z1 + pad > b.z0 && a.z0 - pad < b.z1 &&
    a.y1 > b.y0 && a.y0 < b.y1
  );
}

/** The overlap's own footprint area in m², so a report can rank by severity. */
export function overlapAreaM2(a, b) {
  const dx = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const dz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
  return dx > 0 && dz > 0 ? dx * dz : 0;
}

/**
 * A claim, normalised.
 *
 * `y0`/`y1` default to a GROUND SOLID — from the datum up to `top`, or up to
 * `SURFACE_TOP_M` when no top is given. Defaulting to a surface rather than to
 * an infinite column is the safe direction for the one caller that forgets:
 * a missing height under-claims and shows up as a MISSING conflict in the
 * gate, where an over-claim would show up as a spurious one and get the rule
 * relaxed to make it quiet.
 */
export function claimBox(kind, x0, z0, x1, z1, opts = {}) {
  const y0 = opts.y0 !== undefined ? opts.y0 : 0;
  const y1 = opts.y1 !== undefined ? opts.y1
    : opts.top !== undefined ? opts.top
      : SURFACE_TOP_M;
  return {
    kind,
    x0: Math.min(x0, x1), x1: Math.max(x0, x1),
    z0: Math.min(z0, z1), z1: Math.max(z0, z1),
    y0: Math.min(y0, y1), y1: Math.max(y0, y1),
    owner: opts.owner || kind,
  };
}

/** A claim from a centre and a half-extent — the shape most callers have. */
export function claimAt(kind, x, z, halfX, halfZ, opts = {}) {
  return claimBox(kind, x - halfX, z - halfZ, x + halfX, z + halfZ, opts);
}

/**
 * The registry.
 *
 * A flat array with a uniform grid index over it. The grid is not a
 * micro-optimisation: `generateChunk` asks this several thousand times per
 * chunk (a prop scatter with eight retries, a building walk with four sides, a
 * park's planting) against a list that reaches a few hundred claims, and a
 * linear scan makes chunk generation quadratic in its own content — which is
 * paid on the main thread inside `CITY.generateBudget`.
 *
 * `CELL_M` is 16: a chunk is 128 m, so a chunk's own claims fall in an 8 × 8
 * neighbourhood, and the largest ordinary claim (a 27 m building) touches at
 * most 3 × 3 cells. Bigger cells stop rejecting and smaller ones cost more
 * buckets than they save comparisons.
 */
const CELL_M = 16;

export function createRegistry() {
  /** @type {Array<object>} every claim, in the order it was made. */
  const claims = [];
  /** @type {Map<string, number[]>} cell key → indices into `claims`. */
  const grid = new Map();

  const cellKey = (ix, iz) => `${ix},${iz}`;

  function index(i) {
    const c = claims[i];
    const ix0 = Math.floor(c.x0 / CELL_M);
    const ix1 = Math.floor(c.x1 / CELL_M);
    const iz0 = Math.floor(c.z0 / CELL_M);
    const iz1 = Math.floor(c.z1 / CELL_M);
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const k = cellKey(ix, iz);
        let bucket = grid.get(k);
        if (!bucket) { bucket = []; grid.set(k, bucket); }
        bucket.push(i);
      }
    }
  }

  /**
   * Every claim whose cell neighbourhood a padded box touches, once each.
   *
   * The de-duplication matters: a 27 m building lands in nine buckets and a
   * caller that visited it nine times would report nine conflicts for one
   * overlap, which is a count nobody could act on.
   */
  function candidates(box, pad, visit) {
    const ix0 = Math.floor((box.x0 - pad) / CELL_M);
    const ix1 = Math.floor((box.x1 + pad) / CELL_M);
    const iz0 = Math.floor((box.z0 - pad) / CELL_M);
    const iz1 = Math.floor((box.z1 + pad) / CELL_M);
    const seen = new Set();
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const bucket = grid.get(cellKey(ix, iz));
        if (!bucket) continue;
        for (const i of bucket) {
          if (seen.has(i)) continue;
          seen.add(i);
          if (visit(claims[i]) === false) return false;
        }
      }
    }
    return true;
  }

  const api = {
    /** Add one claim. Returns it, so a caller can keep the box it made. */
    claim(c) {
      claims.push(c);
      index(claims.length - 1);
      return c;
    },
    claimAll(list) {
      for (const c of list) api.claim(c);
      return list;
    },

    /**
     * The first EXISTING claim that a proposed one may not overlap, or null.
     *
     * This is the whole query. Everything else on this object is a convenience
     * spelling of it, and the conflict table is consulted here rather than by
     * the caller — a caller that chose its own category list would be the
     * fifth private idea of occupancy this file exists to retire.
     */
    /**
     * `pads` is a PER-CATEGORY SETBACK, and it is the one thing this query has
     * that a plain overlap test does not.
     *
     * "Do not overlap" and "keep 10 m away from" are different requirements and
     * this project has needed both since session 4: a building is refused
     * within 10 m of a landmark (a plaza), a prop within 3 m of one, and both
     * may stand hard against a kerb. Folding those into one scalar `pad` would
     * apply the landmark's setback to the kerb as well — and since a
     * building's own box touches the pavement edge by construction, a 10 m
     * scalar pad would refuse every building in the city.
     */
    conflict(proposed, pad = 0, pads = null) {
      let hit = null;
      const maxPad = pad + (pads ? Math.max(0, ...Object.values(pads)) : 0);
      candidates(proposed, maxPad, (c) => {
        if (mayOverlap(proposed.kind, c.kind)) return true;
        const p = pad + (pads && pads[c.kind] !== undefined ? pads[c.kind] : 0);
        if (!overlaps(proposed, c, p)) return true;
        hit = c;
        return false;
      });
      return hit;
    },

    /** `conflict` for a caller holding a point and a half-width. */
    conflictAt(kind, x, z, pad = 0, opts = {}, pads = null) {
      return api.conflict(claimAt(kind, x, z, 0, 0, opts), pad, pads);
    },

    /** May this box be placed? The predicate spelling, for a placement loop. */
    free(proposed, pad = 0, pads = null) {
      return api.conflict(proposed, pad, pads) === null;
    },

    /** Claim it if it is free; return the claim or null. One call, no race with itself. */
    tryClaim(proposed, pad = 0, pads = null) {
      if (api.conflict(proposed, pad, pads)) return null;
      return api.claim(proposed);
    },

    /**
     * Every claim overlapping a box REGARDLESS of the conflict table — the
     * query a clipper needs. A road does not ask "may I overlap a pier", it
     * asks "where are the piers so I can cut myself around them".
     */
    hits(box, pad = 0, kinds = null) {
      const out = [];
      const want = kinds ? new Set(kinds) : null;
      candidates(box, pad, (c) => {
        if (want && !want.has(c.kind)) return true;
        if (overlaps(box, c, pad)) out.push(c);
        return true;
      });
      return out;
    },

    all() { return claims; },
    count() { return claims.length; },
    byKind(kind) { return claims.filter((c) => c.kind === kind); },
    countsByKind() {
      const out = {};
      for (const c of claims) out[c.kind] = (out[c.kind] || 0) + 1;
      return out;
    },
  };
  return api;
}

/**
 * THE GATE'S HALF: every forbidden overlap in a set of claims, found by
 * comparing everything against everything through the same grid.
 *
 * It is a separate function rather than a method because the gate feeds it
 * claims from a DIFFERENT SOURCE from the generator's own — the delivered
 * scene, walked (CONTRACT §9.1: a gate that reads config verifies the config).
 * The generator's registry answers "did I test this"; this answers "is the
 * delivered world free of them", and the two are only the same number if
 * nothing between the generator and the frame moves anything. Twice now,
 * something has.
 *
 * O(n) in the number of claims times the occupancy of a 16 m cell, and each
 * unordered pair is reported once — `j > i` on the claim index.
 */
export function findConflicts(claims, limit = 200) {
  const reg = createRegistry();
  /**
   * The claim's own index, carried on the object, so a pair can be keyed
   * without an `indexOf` — which would make this quadratic in exactly the
   * situation the grid exists to avoid, and quietly, because the answer would
   * still be right.
   */
  const ix = new Map();
  for (let i = 0; i < claims.length; i++) { reg.claim(claims[i]); ix.set(claims[i], i); }
  const list = reg.all();
  const out = [];
  const seen = new Set();
  for (let i = 0; i < list.length && out.length < limit; i++) {
    const a = list[i];
    for (const b of reg.hits(a, 0)) {
      if (a === b) continue;
      if (mayOverlap(a.kind, b.kind)) continue;
      const j = ix.get(b);
      const key = i < j ? `${i}:${j}` : `${j}:${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        a: { kind: a.kind, owner: a.owner, x0: a.x0, x1: a.x1, z0: a.z0, z1: a.z1, y0: a.y0, y1: a.y1 },
        b: { kind: b.kind, owner: b.owner, x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, y0: b.y0, y1: b.y1 },
        areaM2: +overlapAreaM2(a, b).toFixed(3),
      });
      if (out.length >= limit) break;
    }
  }
  return out;
}
