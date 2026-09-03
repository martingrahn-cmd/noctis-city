/**
 * poses.mjs — WHERE A CAMERA STANDS, ONCE.
 * ========================================
 *
 * Every preset `lookat.mjs` has ever offered, moved here UNCHANGED in session
 * 70 so that a second tool can take the same frame without transcribing a
 * pose. Nothing about any of them is new; the file is.
 *
 * WHY IT EXISTS. `stepprobe.mjs` needed `viaduct-under` in session 69 and
 * re-derived it off `LANDMARKS` and `viaductArc` by the same three lines,
 * printing the pose so the two could be read against each other by eye. That
 * is the mitigation and not the fix: CONTRACT §9.1's failure mode is TWO
 * DESCRIPTIONS OF ONE QUANTITY, and two derivations of one camera is exactly
 * that with a matrix in it. Session 70 needed `sea-edge` and `sea-road` for a
 * third tool, which would have made three.
 *
 * So there is one derivation and every tool imports it. The poses themselves
 * are still functions of `LANDMARKS`, `viaductArc`, `harbourSite`,
 * `riverCentreAt`, `exitRoadZ` and `hillsideHouses` — the same data the
 * generator and the bake read — so a preset still cannot drift from where the
 * thing actually is. That property is the reason the comments below are worth
 * carrying across intact.
 */

import {
  LANDMARKS, landmarkAABB, viaductArc,
  CITY, exitRoadZ, terrainHeightAt, hillsideHouses,
  harbourSite, riverCentreAt,
} from '../../src/lib/citygen.js';

/**
 * Where to stand to judge a landmark as a structure.
 *
 * Eye height 1.74 m — the same figure the routes walk at — for everything
 * called `-street`, because "does it read as a structure" is a question asked
 * from the pavement and answered nowhere else.
 */
export function presets() {
  const out = {};
  const eye = 1.74;
  const by = (name) => LANDMARKS.find((l) => l.name === name);

  const v = by('viaduct');
  const st = viaductArc(v).stations;
  /** The station whose arc distance from the crown is `m` metres. */
  const at = (m) => st.reduce((b, s) => (Math.abs(s.s - m) < Math.abs(b.s - m) ? s : b), st[0]);
  const crown = at(0);
  const along = at(-90);

  /** Where the gate camera stands, wider. The one that has to read. */
  out['viaduct-street'] = {
    pos: [70, eye, 0.9],
    target: [crown.x, v.height * 0.78, crown.z],
    fov: 58,
  };
  /** Standing on the carriageway under the deck, looking along the soffit. */
  out['viaduct-under'] = {
    pos: [crown.x + 2.5, eye, 0],
    target: [along.x, v.height - 3.5, along.z],
    fov: 72,
  };
  /** Side on from the main street, so a whole bent is in one frame. */
  out['viaduct-side'] = {
    pos: [crown.x + 52, eye, -6],
    target: [crown.x, v.height * 0.45, crown.z - 6],
    fov: 50,
  };
  /** Along the pavement, where the pier rhythm is the subject. */
  out['viaduct-piers'] = {
    pos: [92, eye, 9.6],
    target: [-140, 12, 6],
    fov: 46,
  };

  for (const name of ['condenser', 'stack', 'arch', 'exchange', 'weir', 'mast', 'dish']) {
    const l = by(name);
    if (!l) continue;
    const a = landmarkAABB(l);
    const halfX = (a.x1 - a.x0) / 2;
    const halfZ = (a.z1 - a.z0) / 2;
    // Far enough back that the whole thing fits in a 55° frame *and* the camera
    // is outside its own footprint — a 44 m overhang seen from 30 m inside it is
    // a photograph of a ceiling.
    const d = Math.max(70, l.height * 1.5, Math.max(halfX, halfZ) + 55);
    /**
     * Stand on a road, not in a building. Roads run on every chunk boundary
     * (citygen.js), so snapping one axis to the nearest 128 m line puts the eye
     * in the carriageway — which is where a person looking at a landmark is.
     */
    const rawX = l.x + d * 0.72;
    const snapX = Math.round(rawX / 128) * 128;
    out[`${name}-street`] = {
      pos: [snapX, eye, l.z + Math.sign(d) * Math.hypot(d, d * 0.72) * 0.86],
      target: [l.x, Math.max(4, l.height * 0.45), l.z],
      fov: 55,
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * THE TWO COUNTRYSIDE POSES, DERIVED AND RECORDED — SESSION 65.
   * ═══════════════════════════════════════════════════════════════════════
   *
   * Session 64 delivered `tools/shot-out/s64-{car,air4}-t0_42-wet.png` and
   * session 65's brief asks for *"session 64's two poses exactly, so the pair
   * is comparable"*. **THE POSES WERE NOT WRITTEN DOWN ANYWHERE.** STATE 64
   * describes the first in words — *"the car's eye, 1.6 m, on the exit road at
   * x = 3 260 looking east down it"* — which is enough to rebuild it, and the
   * second as *"aerial from 180 m"*, which is not. That is
   * `landmarkcensus.mjs`'s own opening complaint arriving at a camera: a frame
   * produced by a command in a shell nobody kept is a frame the next session
   * cannot retake.
   *
   * So both are here, derived from the road's own functions rather than typed,
   * and neither can drift: `exitRoadZ` is the ribbon's centreline and
   * `terrainHeightAt` is the surface under it, so a change to either moves the
   * camera with the world instead of leaving it in a field.
   *
   * THE EYE IS ON THE SMOOTH FUNCTION AND THE ROAD IS DRAWN ON ITS STATIONS,
   * and the two differ by up to 0.0149 m (STATE 64 §5a). Said rather than
   * hidden: 15 mm of camera height is not a datum anybody reads, which is
   * exactly what could NOT be said of the paint that measurement was made for.
   */
  {
    const CAR_X = 3260;
    /** How far down the road the eye is aimed. Level — the target sits at the
     *  same height as the eye — because a driver's frame is level and a target
     *  on the carriageway would pitch the horizon with every dip. */
    const AHEAD = 900;
    const carY = terrainHeightAt('1337', CAR_X, exitRoadZ(CAR_X)) + 1.6;
    out['country-car'] = {
      pos: [CAR_X, carY, exitRoadZ(CAR_X)],
      target: [CAR_X + AHEAD, carY, exitRoadZ(CAR_X + AHEAD)],
      fov: 55,
    };
    /**
     * THE AERIAL, AND ITS SUBJECT IS THE HILL SHOULDER — 180 m, LOOKING OUT.
     *
     * Anchored on the eastern cluster of `hillsideHouses`, so the frame
     * follows the houses rather than a coordinate. The camera stands BACK from
     * the cluster and OUTSIDE the lattice, looking away from the city: the
     * first arm stood over the city's edge looking back across it and
     * delivered a frame that was two thirds streets, which answers none of
     * this session's four items.
     *
     * The offsets are in metres from the cluster centroid and they are what
     * puts the shoulder, its hedgerows, its planting and the horizon in one
     * frame at 55°.
     */
    const east = hillsideHouses('1337').filter((h) => h.x > 0 && h.z > 0 && h.x < 3600);
    const cx = east.reduce((a, h) => a + h.x, 0) / Math.max(1, east.length);
    const cz = east.reduce((a, h) => a + h.z, 0) / Math.max(1, east.length);
    /**
     * THE HILLSIDE FROM THE CITY SIDE — SESSION 73.
     *
     * `country-air` stands 710 m from the villa cluster and looks at the backs
     * of the houses; at midnight it reads as *"almost entirely black, the
     * hillside villas are not visible at all"*, which is what session 73's
     * round wrote down and what five sessions of STATE have carried as a
     * defect. **The villas were dark. They are also not visible from that
     * pose whether they are lit or not**, which is a fact about the pose.
     *
     * This one stands on the CITY side at 380 m, which is the side the glazed
     * elevation faces — `villa`'s own comment: *"a wall of glass on the view
     * side and blunt masonry everywhere else"*. Anchored on the east cluster's
     * own centroid, so it moves with the houses.
     */
    out['villa-city'] = {
      pos: [cx - 290, 55, cz - 200],
      target: [cx + 30, 25, cz + 20],
      fov: 55,
    };
    out['country-air'] = {
      pos: [cx - 380, 180, cz + 600],
      target: [cx + 540, 0, cz - 130],
      fov: 55,
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * THE THREE SEA POSES — SESSION 66, DERIVED AND RECORDED.
   * ═══════════════════════════════════════════════════════════════════════
   *
   * Session 65 could not retake session 64's frames because the commands were
   * in a shell nobody kept, so both were made into presets. These three are the
   * same discipline before the fact: every one of them is a function of
   * `harbourSite` and the river's own centreline, so a change to the harbour or
   * the estuary moves the camera with it.
   *
   * AND THE THIRD ONE IS SHOT FROM THE WATER, WHICH IS SESSION 57's OWN
   * LESSON. That session shot three empty river frames before finding its
   * barges, occluded by the quay wall from every camera on the bank — and the
   * quay in question is this harbour's. So `sea-harbour` stands OFF the quay,
   * out in the fairway, looking back at it.
   */
  {
    const H = harbourSite('1337');
    /** The city's edge, on the north bank, looking down the river to the sea. */
    out['sea-edge'] = {
      pos: [CITY.extentEdgeM - 82, 40, riverCentreAt(CITY.extentEdgeM - 82) - 5],
      target: [H.x1 + 1600, 0, riverCentreAt(H.x1) - 280],
      fov: 55,
    };
    /** A car's eye where the branch road arrives on the harbour's yard. */
    out['sea-road'] = {
      pos: [H.branchX + 4, H.yardY + 1.6, H.yardZ + 40],
      target: [H.branchX - 120, H.apronY + 8, H.quayZ - 30],
      fov: 60,
    };
    /** Off the quay, in the fairway, looking back at the whole berth. */
    out['sea-harbour'] = {
      pos: [H.x0 + 96, 26, H.quayZ - 106],
      target: [H.x1 - 70, H.apronY + 6, H.quayZ + 10],
      fov: 60,
    };
    /**
     * 180 m OVER THE HARBOUR ITSELF — SESSION 71.
     *
     * `sea-air` below is 180 m over the MOUTH and the two are not the same
     * frame: the mouth is 800 m west of the quay and its aerial shows the
     * estuary with the terminal off the edge. The brief asks for *"the 180 m
     * aerial over the harbour"*, so here it is, anchored on `harbourSite` the
     * way the three sea poses are — it moves if the quay moves.
     *
     * It stands OFF THE WATER looking back at the berth so the crane line is
     * side-on and the yard is behind it, which is the one view that shows the
     * layout: the lanes between the blocks, the sheds behind, and whether the
     * booms reach past the quay face.
     */
    out['harbour-air'] = {
      pos: [H.x0 - 150, 180, H.quayZ - 240],
      target: [H.x1 - 80, 0, H.apronZ],
      fov: 55,
    };
    /** 180 m over the mouth, the same altitude session 64 and 65 used. */
    out['sea-air'] = {
      pos: [CITY.extentEdgeM - 132, 180, riverCentreAt(CITY.extentEdgeM) + 230],
      target: [H.x1 + 900, 0, riverCentreAt(H.x1) - 620],
      fov: 55,
    };
  }
  return out;
}

/** Built once. The derivations are pure and none of them is cheap enough to repeat. */
export const POSES = presets();
