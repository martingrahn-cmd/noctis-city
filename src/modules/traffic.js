import * as THREE from 'three';
import { CITY, riverNoRoad, landmarkOccupies, blockNoRoad, busStopAt, BUS_STOP, cityExtentAt } from '../lib/citygen.js';
import { EMITTER_CHROMA, kelvinToLinearRGB } from '../lib/color.js';
import { CLUSTER, LIGHT, GROUND } from '../core/constants.js';
import { createInstanceMotion, pixelAngle, motionCutoffDistance } from '../core/instmotion.js';

/**
 * Traffic — 160 vehicles and 96 headlamps on the chunk lattice. Session 4b.
 *
 * SPLINES, NOT PATHFINDING. There is no road graph in this project and there
 * does not need to be: roads are an implicit consequence of the chunk layout,
 * running along every chunk boundary at a 128 m pitch in both directions. A
 * vehicle's whole state is which line it is on, which way it is pointing, which
 * lane it is in and how far along it is — four numbers, one of which is the
 * only one that changes most frames. Junction turns are quarter circles between
 * two lane centrelines and the radius falls out of the geometry rather than
 * being chosen (see TURN_RADIUS below).
 *
 * NINETY-SIX CLUSTERED LIGHTS, AND EVERYTHING ELSE IS GEOMETRY. The headlamp
 * pool is 96 spots in the froxel grid, assigned each frame to the nearest 96 of
 * the 160 vehicles (see VEHICLE_COUNT). The tail lights, the brake lights, the
 * indicators and the interior glow are emissive quads with no light slot at
 * all, and the arithmetic for that is not an approximation:
 *
 *   a tail lamp is about 60 cd  (0.5 lux at 11 m x 121 m^2)
 *   the carriageway is held at LIGHT.streetAverageLux = 16 lux
 *   so at the distance it is seen from it contributes 0.5 / 16 = 3% of the
 *   ambient, and past 11 m it falls off as 1/d^2 from a base of 3%.
 *
 * It is not illumination. What it IS, is the brightest small saturated thing in
 * a wet road's reflection, and CONTRACT §5.8's screen-space march puts it there
 * for nothing.
 *
 * SILHOUETTES CARRY THE SETTING. Five body types with roof heights from 1.28 to
 * 3.10 m — a 2.4x spread, which is what stops a queue reading as one repeated
 * object. None of them has a wheel arch: the wheels are enclosed behind a
 * skirt, which is the cheapest single change that makes a shape stop reading as
 * a car from now. And the light signatures are LINES rather than lamps: a
 * full-width bar front and rear. That last one costs two quads and sells the
 * era harder than the geometry does.
 *
 * WHAT THIS IS NOT. Vehicles turn right at junctions and never left: a left
 * turn crosses oncoming traffic and reading as legible would need gap
 * acceptance, which is a behaviour model rather than a spline. Stated here
 * rather than discovered as an absence.
 */

/**
 * Metres from the centreline to each lane centre.
 *
 * 15 m kerb to kerb (2 x CITY.roadHalfWidth), less 0.5 m of edge margin each
 * side for the drainage channel, leaves 14 m for four lanes: 3.5 m each, which
 * is a standard urban lane. Centres at 0.5 + 3.5/2 = 2.25 and 0.5 + 3.5 + 1.75
 * = 5.75 measured from the KERB, i.e. 7.5 - 5.75 = 1.75 and 7.5 - 2.25 = 5.25
 * measured from the centreline. Both derivations printed because the two
 * conventions differ by the sign of the road's half-width and that is exactly
 * the kind of swap CONTRACT §9 is about.
 */
const LANE_OFFSET = [1.75, 5.25];

/**
 * RIGHT-HAND TRAFFIC, and it is an authored choice rather than a physical one.
 *
 * Heading +X (east), your right hand points along cross(+X, +Y) = +Z. So an
 * eastbound vehicle sits at +z from the centreline and a westbound one at -z.
 * On a north-south road, heading +Z (south) the right hand is cross(+Z, +Y) =
 * -X, so a southbound vehicle sits at -x. The sign flip between the two axes is
 * the whole reason this is a named function and not an inline expression.
 *
 * axis 0 = the road runs along X (an east-west road at z = 128 * line)
 * axis 1 = the road runs along Z (a north-south road at x = 128 * line)
 */
function lanePosition(axis, line, dir, lane, s, out) {
  const off = LANE_OFFSET[lane];
  if (axis === 0) {
    out.x = s;
    out.z = line * CITY.chunkSize + dir * off;
  } else {
    out.x = line * CITY.chunkSize - dir * off;
    out.z = s;
  }
  return out;
}

/**
 * Junction turn radius, metres, and it is not a chosen number.
 *
 * A right turn is the quarter circle tangent to the entry lane's centreline and
 * to the exit lane's centreline. Those two lines are perpendicular and the arc
 * that joins them tangentially has exactly one free parameter, so the radius
 * fixes where the turn starts: the vehicle leaves the straight at
 * (junction - laneOffset - r) and rejoins at (junction - laneOffset + r) on the
 * other road.
 *
 * 8.0 m is the swept path radius of a car making a kerbside right turn at a
 * junction with a 6 m kerb radius, which is the smallest a design manual will
 * put on a road carrying anything larger than a car. It puts the start of the
 * turn 5.75 m before the junction box (8.0 + 5.25 - 7.5), which is where a real
 * driver starts to swing.
 *
 * The arc is traversed at arc length, so speed is continuous through it and the
 * lateral acceleration is v^2/r = 8^2/8 = 8 m/s^2 at the 8 m/s turn speed
 * below. That is 0.82 g and is far too much, which is why TURN_SPEED is what it
 * is: at 5 m/s it is 3.1 m/s^2, or 0.32 g, which is a brisk but ordinary turn.
 */
const TURN_RADIUS = 8.0;
const TURN_SPEED = 5.0;

/**
 * THE LONGEST BODY THAT MAY TAKE THIS TURN — SESSION 29, AND IT IS DERIVED.
 *
 * The arc above is run by the vehicle's ORIGIN. A rigid body of half-length L
 * sitting on that origin puts its front outer corner at radius
 * sqrt((R + W)^2 + L^2) from the turn centre, where W is the body's half-width,
 * so the corner swings
 *
 *     sqrt((R + W)^2 + L^2) - (R + W)  ~=  L^2 / (2R)
 *
 * OUTSIDE the band its own width entitles it to. The quantity is in the SQUARE
 * of the half-length, which is why it is invisible on a short body and
 * unignorable on a long one, and it is exactly CONTRACT §9 row 23's shape: a
 * length that stopped meaning what it meant the moment the body got longer.
 *
 * MEASURED BEFORE THIS CONSTANT EXISTED, on the delivered arc, by
 * `tools/fleetprobe.mjs` — measured against L^2/2R predicted:
 *
 *     moto   0.072 / 0.076     pod  0.192 / 0.214     wedge  0.397 / 0.456
 *     van    0.483 / 0.563     hauler 1.162 / 1.440
 *
 * Two derivations agreeing to within the sampling of the arc (§9 rule 2); the
 * measurement sits under the asymptote because a frame rarely lands on the exact
 * mid-arc where the excursion peaks.
 *
 * THE BOUND IS THE LANE HALF-PITCH. Lanes are 3.50 m apart (`LANE_OFFSET`:
 * 5.25 - 1.75), so an excursion over 1.75 m puts a corner past the NEXT LANE'S
 * CENTRELINE — into the space the following model is keeping clear for somebody
 * else. Solving L^2/(2R) <= 1.75 at R = 8.0:
 *
 *     L <= sqrt(2 x 8.0 x 1.75) = sqrt(28) = 5.2915 m,  i.e. len <= 10.583 m
 *
 * The delivered fleet against it: hauler 9.60 m (L 4.80, 1.44 m) passes with
 * 0.31 m to spare, lorry 8.20 m (L 4.10, 1.05 m) passes, and the 12.00 m bus
 * (L 6.00, 2.25 m) DOES NOT. So a bus does not turn here.
 *
 * REFUSED RATHER THAN MOVED, which is the discipline the sign pylon and the
 * advertising pillars already use: the alternative is a second turn radius for
 * long vehicles, which is a junction geometry this city does not have and a
 * kerb line it would drive over. A bus that runs straight through junctions is
 * a bus on a route; a bus that cuts the corner is a bug.
 */
const MAX_TURN_HALF_LEN_M = Math.sqrt(2 * TURN_RADIUS * (5.25 - 1.75) / 2);

/**
 * Free-flow speed, m/s. 12 m/s is 43 km/h, an urban arterial between signals.
 *
 * It is also the speed CONTRACT §5.11's motion-vector arithmetic was written
 * against — "a vehicle at 12 m/s at 30 m crosses the frame at about ten pixels
 * a frame" — so the case the attachment was built for is the case this ships.
 */
const FREE_SPEED = 12.0;

/**
 * Simulated radius, metres, and the flow rate that fixes the vehicle count.
 *
 * Roads run on a 128 m lattice in both directions, so the road-length density
 * is 2/128 = 0.015625 m of centreline per m^2 of ground and the centreline
 * length inside a disc of radius R is 0.015625 * pi * R^2. At R = 190 m that is
 * 1771 m. 96 vehicles over 1771 m is one every 18.45 m across four lanes, i.e.
 * 73.8 m per vehicle per lane, which at 12 m/s is 3600 * 12 / 73.8 = 585
 * vehicles per hour per lane. An ordinary urban arterial at night.
 *
 * 190 m is inside the 256 m minimum radius at which road SURFACE geometry
 * exists — city.js draws the carriageway only for chunks within Chebyshev ring
 * 2, and the camera can be at the far edge of its own chunk — so no vehicle is
 * ever driving on the global ground plane. That is the constraint that fixes
 * the radius; the flow rate then fixes the count.
 */
const SIM_RADIUS = 190;

/**
 * VEHICLES AND HEADLAMPS ARE TWO DIFFERENT BUDGETS AND CONFLATING THEM MADE THE
 * STREET EMPTY.
 *
 * The first version shipped 96 vehicles because 96 is the number of reserved
 * clustered light slots, and 96 over 1771 m of centreline is one every 18.4 m —
 * 585 vehicles per hour per lane, which is a real arterial flow and reads, in
 * the frame, as a quiet night. Measured from a plan view over the block's own
 * street: three vehicles in fifty metres.
 *
 * The light pool is the budget. The vehicle count is content. city.js already
 * separates exactly these two for its street lamps — "the lamp pool is a POOL
 * and only the lamps near the camera are lit" — and the same argument applies
 * with more force here: a headlamp's value is the pool it throws on the road,
 * that pool is invisible past about a hundred metres, and the thing that makes
 * a distant vehicle read at all is its emissive light LINE, which costs no slot.
 *
 * So: 160 vehicles, 96 of them lit, assigned to the nearest 96 every frame.
 *
 *   160 over 1771 m is one every 11.07 m across four lanes = 44.3 m per vehicle
 *   per lane, which at 12 m/s is 3600 * 12 / 44.3 = 975 veh/h/lane. A busy
 *   arterial, against a saturation flow near 1800.
 *
 *   96 vehicles at that spacing fill 1063 m of centreline, which is the disc of
 *   radius sqrt(1063 / (0.015625 * pi)) = 147 m. So every vehicle inside 147 m
 *   has a beam and everything beyond it is a silhouette with lit lines — and
 *   147 m is already past where a beam pool is a pixel wide.
 *
 * The froxel measurement is unaffected in COUNT and strictly harder in
 * DISTRIBUTION: the same 96 lights, now concentrated in the nearest 147 m
 * instead of spread over 190 m. 4a's margin of 21 remains a floor and not an
 * estimate.
 */
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 160 → 120, SESSION 57, AND IT IS AN AESTHETIC DECISION WITH A FLOW RATE
 * BEHIND IT RATHER THAN A BUDGET CUT WEARING ONE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The operator released this count in as many words — *"it is fine to reduce
 * the number of cars and people"*, *"there is really too much"* — so what
 * follows is his judgement, costed in the same units the paragraph above
 * uses so the two can be compared:
 *
 *   160 over 1771 m   one every 11.07 m over four lanes   975 veh/h/lane
 *   120 over 1771 m   one every 14.76 m over four lanes   732 veh/h/lane
 *    96 over 1771 m   one every 18.45 m over four lanes   585 veh/h/lane
 *
 * 732 sits between the two figures this file already argues about: above the
 * 585 the same comment calls *"a real arterial flow that reads as a quiet
 * night"* and below the 975 it calls *"busy"*, against a saturation flow near
 * 1800. So the street is still a working arterial and is no longer nose to
 * tail, which is the complaint.
 *
 * THE POOL IS STILL A POOL, AND IT IS SHALLOWER: 96 lit of 120 rather than of
 * 160, and at the new spacing those 96 fill 1417 m of centreline, i.e. a disc
 * of radius 170 m against the 190 m simulated. Every vehicle inside 170 m has
 * a beam; the 20 m shell beyond it is silhouette and light lines. The
 * separation of the two budgets that this block exists to make is unchanged —
 * the count came down because of how the street LOOKS, and the pool did not
 * move at all.
 *
 * WHAT IT BUYS: 40 vehicles x 12 body rows and 4 wheels — see STATE 57 §0 for
 * the delivered triangle figure, which is the reason item 0 could be resolved
 * without touching a threshold.
 */
const VEHICLE_COUNT = 120;
const HEADLAMP_SLOTS = 96;

/**
 * Signal timing, seconds. Green, amber, and the period that follows from them.
 *
 * AMBER IS 4 s AND THAT IS THE ONLY ONE OF THE THREE THAT IS DERIVED. The
 * dilemma zone is the band where a driver can neither stop comfortably nor
 * clear the stop line, and it is empty when the amber is at least
 * v/(2a) + t_reaction. At v = 12 m/s and a comfortable a = 2.0 m/s^2 that is
 * 12/4 + 1 = 4.0 s. Amber then covers 4 x 12 = 48 m against a braking distance
 * of v^2/2a = 36 m, so every vehicle either stops or clears and nothing has to
 * be modelled as a judgement call. That is what makes the stopping LEGIBLE:
 * no vehicle is ever caught out, so nothing on screen looks like a mistake.
 *
 * 14 s of green is two 128 m blocks' worth of queue discharge at 12 m/s.
 */
/**
 * Bus dwell, seconds: a fixed door cycle plus a per-boarder term. Both are
 * transit-practice figures and both are bounded, which is what §9 rule 5 asks.
 * About 5 s covers opening, kneeling and closing; about 2.5 s is one passenger
 * through one door. The boarder count is COUNTED off the people standing at the
 * shelter, never assumed — see `busDwellSeconds`.
 */
const BUS_BERTH_M = 1.0;
const BUS_DOOR_CYCLE_S = 5.0;
const BUS_BOARD_S = 2.5;

const GREEN_S = 14;
const AMBER_S = 4;
const CYCLE_S = 2 * (GREEN_S + AMBER_S);

/**
 * THE CAMERA IS AN OBSTACLE, AND FINDING THAT OUT COST THE LOOK GATE.
 *
 * The first version seeded vehicles anywhere on the lattice inside the ring and
 * scored candidates against a soft penalty for being near the camera. The look
 * gate's shots stand at eye height in the middle of the block's own street —
 * which, now that the street has traffic on it, is the middle of a running
 * lane. A hauler came to rest two metres from the lens and filled eighty per
 * cent of the midnight frame, and SEVEN look assertions went red at once: mean
 * luminance 0.0469 against a [0.072, 0.112] band, stddev 0.0753 against 0.126,
 * nine emitter clusters against sixty, five ground pools against six, and the
 * mid-distance wall patch reporting that it was not on a wall. Every one of
 * them was true and none of them was about lighting.
 *
 * A soft penalty was the wrong shape of answer. Two hard ones:
 *
 *   SEEDING never places a vehicle within CAMERA_CLEARANCE. Not scored,
 *   rejected — a candidate list that can run out is a candidate list that will.
 *
 *   FOLLOWING treats the camera as a stopped vehicle in whatever lane it is
 *   standing in, so an approaching vehicle keeps its normal 2.0 + 1.2v gap and
 *   comes to rest short of it. That is what a car does when a person stands in
 *   the road, it needs no new mechanism, and it leaves the vehicle VISIBLE
 *   rather than teleporting it — a vehicle that vanished near the camera would
 *   be a pop, and a pop is a defect the eye finds instantly.
 *
 * 14 m is the gap the following model itself asks for at the free speed:
 * 2.0 + 1.2 x 12 = 16.4 m, less half a hauler — 9.60/2 = 4.80 since session 8
 * (9.20/2 = 4.60 when this was derived), so the derivation gives 11.6 m and
 * the constant holds the CONSERVATIVE side of it. So it is not a new number,
 * it is the one already in the model, and a vehicle stopped at it fills a
 * quarter of the frame height rather than all of it.
 */
const CAMERA_CLEARANCE = 14.0;
/** Metres either side of a lane centre within which the camera is IN that lane. */
const CAMERA_LANE_HALF = 2.2;

/**
 * The clearance a re-seeded vehicle must have from the nearest body already on
 * its line, BUMPER TO BUMPER, metres. Session 29.
 *
 * It is the standing term of the following model's own gap — `safe = 2.0 +
 * 1.2 v` at v = 0 — and NOT a car length, because a gap expressed in car lengths
 * is the quantity CONTRACT §9 has caught this project confusing four times. A
 * vehicle seeded exactly at this clearance is a vehicle stopped in a queue, and
 * the following model will hold it there rather than close it up.
 */
const SEED_CLEAR_M = 2.0;

/** Comfortable deceleration, m/s^2, and the stop line it implies. */
const BRAKE_A = 2.0;
/**
 * Metres from the junction centre to the stop line. `citygen.js` →
 * `CITY.stopLineFromJunctionM` since session 19 — the painted line, the signal
 * head and the braking constraint are ONE number, and `city.js` cannot import
 * this module to get it.
 */
const STOP_LINE = CITY.stopLineFromJunctionM;

/**
 * THE NEXT JUNCTION AHEAD OF `s`, AND THE CLEARANCE FROM A NOSE TO ITS BAR.
 * =========================================================================
 * SESSION 34, AND THE MEASUREMENT CAME FIRST — `tools/stoplineprobe.mjs`,
 * 25 920 frames, 432 simulated seconds, twelve signal cycles.
 *
 * WHAT THE GATE SAYS AND WHY IT IS NOT WHAT IS WRONG. `perfcheck` reports
 * *"a held vehicle's front stood 11.55 m PAST its own stop line (floor 0) — the painted
 * bar and the braking point are one number and this is the distance between
 * them"*, which reads as a datum error in the arithmetic. **The arithmetic is
 * correct.** `toStop` is nose-to-bar, `STOP_LINE` is the painted bar, and the
 * probe's own second column settles it:
 *
 *     past junction   min −15.000   median −2.968   max −0.009 m
 *     ORIGIN inside the junction box, over 18 208 settled frames:  0
 *
 * Not one vehicle in the run is ever inside the box. `past` is the origin's
 * distance beyond the junction CENTRE and its maximum is −0.009 m, so every
 * one of these bodies is standing just SHORT of the centre — nine metres past
 * its own bar, exactly as reported, and genuinely there. Session 25 killed the
 * exit reservation for the same reason and the brief repeats the instruction:
 * spillback has zero cases.
 *
 * SO HOW DOES A BODY GET NINE METRES PAST A BAR IT NEVER PASSED? IT IS PUT
 * THERE. `seed()` draws `s` uniformly over ±`SIM_RADIUS` and sets
 * `cleared = null`, so **8.9% of every re-seat — `(STOP_LINE + len/2) / 128` —
 * lands in the band between a stop line and the junction it protects, holding
 * no permission**: a vehicle that has run a red it never saw. The hold then
 * clamps it (`sqrt(max(0, toStop))` = 0) and it stands there for the rest of
 * the red, which is up to 18 s, so ONE bad seed contributes up to a thousand
 * frames to a statistic that only ever decreases.
 *
 * `stoplineprobe`'s own classifier hid this: it calls a vehicle *"settled"*
 * once 2 s have passed since its re-seat, and one of these is still standing
 * exactly where it was dropped 16 s later. 18 208 "settled" frames, 0 of them
 * spillback, and the header of that probe names the alternative in the first
 * paragraph — *"a teleport, and its distance to 'its own' stop line then
 * describes where the recycler dropped it"*. It was right and its own
 * two-second cut-off argued against it.
 *
 * THE FIX IS AT THE PLACEMENT, WHICH IS WHERE THIS FILE'S OTHER THREE
 * IMPOSSIBLE-POSITION RULES ALREADY ARE — the river, the camera clearance and
 * the body spacing are all hard rejections in the same candidate loop. This is
 * the fourth: **the recycler may not put a body where a body could only have
 * arrived by running a red.**
 *
 * ONE EXPRESSION, TWO READERS. `seed()` tests a candidate and `update()` holds
 * a vehicle, and they have to be the same line or the seeder refuses a band
 * that is not the band the hold measures — which is CONTRACT §9 rule 7 with
 * the two ends written by the same hand in the same session, the case that
 * rule says to assume is shared.
 */
const nextJunctionAhead = (s, dir) => (dir > 0
  ? (Math.floor(s / CITY.chunkSize) + 1) * CITY.chunkSize
  : Math.ceil(s / CITY.chunkSize) * CITY.chunkSize - CITY.chunkSize);

/**
 * Metres from a body's NOSE to the stop line ahead of it. Negative is past it.
 *
 * SNAPPED TO ZERO BELOW THE RESOLUTION OF ITS OWN ARITHMETIC, AND THE BOUND IS
 * DERIVED. This is an ESTIMATOR, not a threshold — CONTRACT §0 rule 6's own
 * distinction, and `trafficLights.minStopLineM` is 0 before and after.
 *
 * WHERE THE RESIDUE COMES FROM, TERM BY TERM. `nextJunctionAhead` is
 * `floor(s/128)·128`; 128 is a power of two, so the divide and the multiply are
 * both exact. `nextJ − s` is then exact too, by Sterbenz's lemma: the two
 * differ by at most 128 while both are of order |s|, so they are within a
 * factor of two of each other and the subtraction has no rounding at all.
 *
 * **What is not representable is the bar itself.** Holding a vehicle at
 * clearance zero means putting `s` at `nextJ − dir·(STOP_LINE + len/2)`, and
 * that point is a real number the double lattice does not contain. `s` lands on
 * the nearest double to it, and the true clearance at that double is up to half
 * an ulp of `s`. Measured, with the camera 3.5 km down its route:
 * **−1.8207657603852567e-13 m against a half-ulp of 4.5e-13** — 0.18
 * picometres, three orders of magnitude under a hydrogen atom, and a RED gate
 * against a floor of exactly zero.
 *
 * So the bound is `EPSILON · |s|`, which is one ulp at `s` and therefore twice
 * the worst case above. It is a statement about the double lattice at the world
 * coordinates this simulation runs at, not a tolerance chosen to make anything
 * pass: at `s` = 0 it is zero, and it grows with the distance the route has
 * travelled because that is where the precision goes.
 */
const stopLineClearanceM = (s, dir, type) => {
  const d = (nextJunctionAhead(s, dir) - s) * dir - STOP_LINE - type.len * 0.5;
  return Math.abs(d) < Number.EPSILON * Math.abs(s) ? 0 : d;
};

/**
 * TRAFFIC SIGNALS — THE GEOMETRY FOR A PHASE THAT ALREADY EXISTS.
 * ===============================================================
 *
 * Since 4b the vehicles stop at `STOP_LINE` on amber and red, hold through the
 * red and pull away on green, and NOTHING ON SCREEN SAID WHY. A car braking for
 * an empty intersection reads as a bug; the same car braking under a red light
 * reads as a city. So this adds no behaviour at all — `signal(axis, now)` is
 * unchanged and the stopping is unchanged. It makes visible what already
 * happens, which is the cheapest content in the project by a wide margin.
 *
 * IT COSTS ZERO LIGHT SLOTS AND ZERO DRAW CALLS, and both are deliberate.
 *
 *   No slot, by the same argument that gave the tail lamps theirs: a signal
 *   head is a 0.2 m lens, its pool on the road is a metre across and invisible
 *   past twenty, and what makes it read is the EMISSIVE lens itself. The
 *   §5.6 pool is 96 headlamps and 2 per street lamp and there is nothing spare
 *   in it — adding 64 signal lights would have been the session-6 mistake of
 *   spending a light budget on content (§9 row 16).
 *
 *   No draw call, because every part rides in the EXISTING `traffic:lights`
 *   instanced mesh. That mesh is a unit box on the emissive material, which is
 *   exactly what a lens is and — with `instanceColor` at zero — exactly what a
 *   dark mast is: `lightMat.color` is 0x16181c, a near-black signal grey, and
 *   an unlit instance of it is a pole. One mesh, five rows a head, and the
 *   draw-call ceiling on `highway_speed` (439 against 440) does not move.
 *
 * THE HEADS ARE STATIC AND THEREFORE `carry()` THEIR MOTION ROW. §5.12: a row
 * whose previous transform is not its own is a teleport, and a signal that is
 * re-seated onto a different junction as the camera moves is exactly that. The
 * previous transform is forced equal to the current one on every frame in which
 * a slot changes junction, and left alone otherwise — so a stationary head has
 * a motion vector of exactly zero and a re-seated one has no vector at all.
 */
const SIGNAL_ROWS = 5;
/**
 * Approaches carried. The lattice puts a junction every 128 m, so the nine
 * junctions of a 3x3 block around the camera cover ±192 m — past the 190 m the
 * traffic itself is simulated in — and four approaches each is 36. Sixteen
 * covers the four NEAREST junctions, which at 128 m spacing is everything
 * within 181 m of the camera on the diagonal and everything within 128 m on the
 * axes. A fifth junction is at least 128 m away with two 30 m buildings between
 * the camera and it.
 */
const SIGNAL_APPROACHES = 16;
/** Nits for a lit lens, on the authored scale beside NITS_TAIL and NITS_BRAKE. */
const NITS_SIGNAL = 210;
/** A dark lens is not black: it is a lens with the filter still in front of it. */
const NITS_SIGNAL_OFF = 2.5;

/**
 * The five boxes of one head, in the head's own frame: local +z faces the
 * driver, y is up from the pavement, and x is across the approach.
 *
 * A 3.05 m mounting height is the bottom of the lowest lens on a nearside post
 * signal, and the head is 0.95 m tall over three 0.20 m lenses at 0.30 m
 * centres. Every number is off a signal head; none is chosen to look right.
 */
const SIGNAL_PARTS = [
  /** mast */        { x: 0, y: 1.55, z: 0, w: 0.13, h: 3.10, d: 0.13, lamp: -1 },
  /** backing box */ { x: 0, y: 3.53, z: 0, w: 0.32, h: 0.96, d: 0.20, lamp: -1 },
  /** red */         { x: 0, y: 3.86, z: 0.13, w: 0.20, h: 0.20, d: 0.05, lamp: 2 },
  /** amber */       { x: 0, y: 3.56, z: 0.13, w: 0.20, h: 0.20, d: 0.05, lamp: 1 },
  /** green */       { x: 0, y: 3.26, z: 0.13, w: 0.20, h: 0.20, d: 0.05, lamp: 0 },
];

/**
 * The four approaches to the junction at (jx, jz), nearside for right-hand
 * traffic.
 *
 * Heading +x, the right hand points +z, so an eastbound driver's nearside kerb
 * is at `jz + roadHalfWidth` — the same `cross(heading, up)` that `lanePosition`
 * above is a named function for, and the sign flip between the two axes is the
 * same one. The head stands `SIGNAL_KERB_M` outside the carriageway edge and
 * `STOP_LINE` back from the junction centre, which is where the vehicles are
 * already stopping.
 *
 * `axis` is what `signal()` is asked about: 0 for a road running along x.
 */
const SIGNAL_KERB_M = 1.15;


/**
 * Lens chromaticities, indexed BY PHASE — 0 green, 1 amber, 2 red, the same
 * encoding `signal()` returns. Sodium stands in for amber: it is the warm
 * emitter this project already has and a signal amber is 590 nm, which is
 * within a few nanometres of a sodium lamp's D lines.
 */
const SIGNAL_CHROMA = [EMITTER_CHROMA.neonGreen, EMITTER_CHROMA.sodium, EMITTER_CHROMA.neonRed];
/** The mast and the backing box: unlit rows of the emissive mesh. */
const SIGNAL_DARK = [0, 0, 0];

function signalApproaches(jx, jz, out) {
  const k = CITY.roadHalfWidth + SIGNAL_KERB_M;
  out.length = 0;
  // travelling +x: stop before jx, kerb at +z, faces back along -x
  out.push({ x: jx - STOP_LINE, z: jz + k, faceX: -1, faceZ: 0, axis: 0 });
  // travelling -x
  out.push({ x: jx + STOP_LINE, z: jz - k, faceX: 1, faceZ: 0, axis: 0 });
  // travelling +z: right hand is -x
  out.push({ x: jx - k, z: jz - STOP_LINE, faceX: 0, faceZ: -1, axis: 1 });
  // travelling -z
  out.push({ x: jx + k, z: jz + STOP_LINE, faceX: 0, faceZ: 1, axis: 1 });
  return out;
}

const DARK = [0.045, 0.048, 0.055];
const GLASS = [0.021, 0.024, 0.030];

/**
 * THE UNDERBODY, AND IT IS THE DARKEST REFLECTANCE IN THE PROJECT ON PURPOSE.
 *
 * 0.012, which is below soot. It is not a material, it is the SHADOWED RECESS
 * between the body's lower edge and the road — a surface that sees the sky
 * through two long slots and receives, by the arithmetic in
 * `tools/budget.json` -> silhouettes.$minGroundContrast, 1.4966% of the
 * illuminance an open patch of road does. Modelling that as an occluded
 * geometry the §5.7 field would have to resolve is not possible at the field's
 * voxel size; modelling it as a reflectance that delivers the same radiance is
 * one number, and the number is checkable: paint at 0.08 receiving 40% of the
 * open road against this receiving the same 40% gives 0.012/0.08 = 0.15, which
 * is four times the 0.037 the slot arithmetic predicts, so the sill is
 * DELIBERATELY LIGHTER THAN PHYSICS and the honest reason is that a value at
 * 0.037 disappears entirely under the ACES toe and reads as a hole rather than
 * as a shadow.
 */
const SILL = [0.012, 0.012, 0.013];

/**
 * TYRE, AND IT IS THE SAME ARGUMENT AS `SILL` WITH ITS OWN ARITHMETIC.
 *
 * Carbon-black rubber is 0.04 new and weathers up; 0.035 with the road film is
 * the reflectance, and 0.035 IS WHAT SHIPPED FIRST AND IT DID NOT WORK. MEASURED
 * on `highway_speed`: ground-contact contrast median 0.681 across 23 vehicles
 * and a pass fraction of 0.652 against a floor of 0.75, and every one of the
 * failures was a vehicle STANDING IN A BUILDING'S SHADOW. Cropped out of the
 * frame and looked at, the reason is plain: in shade there is no sun for the
 * recess to be excluded from, so the only thing left making a wheel darker than
 * a body is its albedo — and 0.035 against deep blue paint at luminance 0.0469
 * is a ratio of 0.75. The tyre was LIGHTER than the car.
 *
 * A wheel does not sit in the open. It sits in a slot bounded by the arch above
 * it and the road below, and the lower half of it — which is precisely the band
 * the ground-contact assertion measures — sees perhaps a third of the
 * hemisphere an exposed surface does. The §5.7 field is a coarse world-space
 * grid and cannot represent a 0.3 m slot, so the occlusion it cannot carry is
 * folded into the reflectance, exactly as `SILL` folds the underbody's:
 *
 *   0.035 reflectance x 0.375 of the hemisphere = 0.0131
 *
 * against deep blue paint at 0.0469 that is a ratio of 0.28 and a contrast of
 * 0.72, and against silver at 0.318 it is 0.96. THE NUMBER IS FALSIFIABLE: if a
 * later session gives the field enough resolution to occlude a wheel arch on
 * its own, this must go back to 0.035 or the arch will be counted twice — which
 * is the §5.7 specular-occlusion double-count, one system across.
 */
const TYRE = [0.013, 0.013, 0.0135];

/**
 * THE FIVE BODY TYPES, REBUILT SO THEY READ IN DAYLIGHT.
 *
 * WHAT THE PREVIOUS VERSION GOT WRONG, measured rather than recalled. Every one
 * of the five had a dark "skirt" box in its data and NONE of them showed it: the
 * wedge's skirt spanned y 0.00 to 0.22 and was 1.86 m wide while its hull
 * spanned 0.10 to 0.82 and was 1.95 m wide, so the hull hid the skirt over the
 * whole overlap and what remained visible was a 0.10 m sliver. The same
 * arithmetic holds for the pod (skirt 0.02–0.22 under a hull from 0.08),
 * the van (0.02–0.24 under a hull from 0.095) and the hauler, whose cab box
 * spans 0.05–2.45 and swallows the skirt entirely. A box drawn inside another
 * box is a value in the data the frame does not show, which is CONTRACT §9.1's
 * shape with geometry instead of config.
 *
 * MEASURED, on the delivered frames: ground-contact contrast 0.062 median with
 * a pass fraction of 0.00 against a 0.45 floor, and 2 distinguishable body
 * chromaticities across 13 vehicles against a floor of 4.
 *
 * THE THREE THINGS THAT CHANGED, in the order of what they buy:
 *
 *   1. THE BODY IS LIFTED OFF THE ROAD AND THERE ARE WHEELS UNDER IT. Every
 *      hull's lower edge is at or above 0.30 m, a `SILL` box fills the gap
 *      INSET from the sides so it reads as the shadow it is, and four wheels
 *      stand on the road. At the gate's 60 m measuring distance the 0.16 m
 *      clearance is 4 px, which is the same 4 px §5.12 derived from the TAA
 *      clamp — the feature is resolvable exactly as far out as the assertion
 *      claims to measure it.
 *   2. THE SEEDED PAINT REACHES THE FRAME. See `PAINT` below for why the old
 *      palette delivered 2 clusters from 4 written and what fixed it.
 *   3. GLAZING ON EVERY TYPE INCLUDING THE HAULER, which had none, sitting
 *      PROUD of the hull rather than inside it, at roughness 0.08 against
 *      paint at 0.34–0.55.
 *
 * `min` is the smallest BODY dimension and is what the CONTRACT §5.12 motion
 * threshold is evaluated against — a lower bound on the smallest silhouette
 * dimension from any view angle, so it is conservative in the direction that
 * keeps the vector rather than drops it. It must equal
 * `tools/budget.json` -> motionVectors.kindMinExtentM.
 *
 * THAT SENTENCE USED TO END "and `perfcheck` asserts the two agree", AND
 * PERFCHECK DID NOT. Nothing in the project read both tables. It is the
 * `pierEvery: 34` arrangement exactly — a number in a data file beside a number
 * in code, with a comment claiming a check that does not exist — and it was
 * found by changing the geometry and going to look for the assertion that was
 * supposed to catch the change. It exists now, and it does not compare the two
 * TABLES: `stats().minExtentM` is COMPUTED from the boxes and wheels below, so
 * what the gate compares against the budget is the delivered geometry rather
 * than a second copy of the declaration.
 *
 * `boxes` are [len, height, width, centreHeight, albedo|null, roughness,
 * centreAlong] in vehicle-local metres. `wheels` are
 * [along, lateral, diameter, width]. `lights` are
 * [len, height, width, centreAlong, centreHeight, kind] where kind is 0 front,
 * 1 rear, 2 marker.
 *
 * LOCAL +Z IS THE HEADING. A yaw of theta about Y maps local +Z to
 * (sin theta, 0, cos theta), and the yaw below is atan2(headingX, headingZ), so
 * the length scales the Z axis and the width scales the X axis. Getting that
 * pair the wrong way round makes every vehicle drive sideways, which is at
 * least a defect you can see. RIGHT is (-cos theta, 0, sin theta), the same
 * convention the turn arc uses forty lines further down.
 *
 * ---------------------------------------------------------------------------
 * SESSION 7c: THE BODY IS A LOFT. THE FIVE AUTHORED BOXES ARE GONE AND WHAT
 * REPLACES THEM IS A STEPPED SWEEP OF ONE CHAMFERED SECTION.
 *
 * WHY THE PREVIOUS VERSION COULD NOT BE FIXED BY ADDING A SIXTH BOX. Sessions
 * 5, 6 and 6b each added a property to a body built from AXIS-ALIGNED
 * RECTANGULAR PRISMS — ground contact, colour, a stepped roofline — and every
 * one of those assertions is green while the vehicles still read as boxes. That
 * is not a fourth missing property. A stack of prisms has CONSTANT WIDTH BY
 * DEFINITION: every corner is 90 degrees, every face is planar, nothing tapers
 * and nothing is chamfered. MEASURED on the delivered wedge by the geometry path
 * of `tools/hullprobe.mjs`, which reads this table off the live module: its
 * painted boxes were 1.86 to 1.92 m wide over a 4.90 m body, a `widthSpan` of
 * 0.0309 of its own width against the 0.12 floor CONTRACT §7.5 writes. The five
 * types read 0.0309 / 0.0349 / 0.0673 / 0.0152 / 0.1111 — every one of them a
 * body of constant width to within 3% over four of five types.
 *
 * THE CONSTRUCTION IS SETTLED BY THE DRAW-CALL CEILING AND NOT BY TASTE.
 * `highway_speed` sits at 439 draws against a ceiling of 440, so ONE LOFTED
 * MESH PER BODY TYPE — the obvious way to build a tapered, chamfered hull — is
 * ruled out before it is designed: five more meshes is five more draw calls and
 * there is one. What fits inside a ceiling of one mesh is more ROWS of the mesh
 * that is already drawn, so the body is a stepped sweep: one instance row per
 * longitudinal station, each carrying its own width, height and centre height,
 * all of them scaling ONE shared section geometry.
 *
 * THAT CONSTRUCTION BUYS ALL FOUR OF THE THINGS THE BODIES WERE MISSING:
 *
 *   plan taper            per-station width
 *   raked front           per-station height and centre height
 *   tumblehome            the section's own upper chamfer, which leans the
 *                         flank inboard as it rises
 *   chamfered long edges  the section's own four cut corners, which run the
 *                         length of the body because the section is what is
 *                         swept along it
 *   wheel arches          the flank's lower edge, raised over each wheel by
 *                         `archRise` below
 *
 * AND THE GEOMETRY WAS SHAPED BY THE INSTRUMENT AS WELL AS BY THE EYE, WHICH IS
 * WORTH SAYING RATHER THAN LEAVING FOR SOMEBODY TO INFER. §7.5's over-read is
 * `boxLength * cot(theta)` and what does not cancel out of a P90-minus-P10 span
 * is a SPREAD in part lengths, bounded by `maxWidthBias` 0.03. The delivered
 * boxes were 1.45 to 1.85 m long where the metric's own positive control is
 * fourteen segments of 0.35 m, and that length spread — not the missing taper —
 * is why 0 of 16 delivered vehicles could be read for width and 9 were declined.
 * SHORT STATIONS OF EQUAL LENGTH ARE THEREFORE PART OF THE DESIGN: `SECTIONS`
 * uniform sections put every station's widest spanning box at the same length,
 * which drives `biasSpread` to zero and leaves only the derived second-order
 * drift. The fleet became measurable as a SIDE EFFECT of being built this way,
 * and it would be dishonest to present that as luck.
 *
 * THE FLEET TAPERS HARDER THAN A REAL VEHICLE AND THAT IS A DESIGN DECISION.
 * `budget.json` -> `silhouettes.$minWidthSpan` derives the 0.12 floor from a
 * REFERENCE-ERA SALOON, which reads 0.156 through the same sampling; the same
 * block's `$minWidthSpan_notAllVehiclesTaper` records that a real 1995 panel van
 * reads 0.055 and would fail. What is delivered here is 0.176 to 0.396 — 1.13x
 * to 2.54x the reference — on every type including the van and the tractor unit.
 * That is not the geometry satisfying the measurement. It is a statement about
 * this world's design language, and the reason for it is that an honestly
 * constant-width body reads as a box whatever else is true of it. STATE.md
 * carries it as a decision.
 *
 * WHAT DID NOT CHANGE, because §0 rule 5 says a gain is not spent to buy
 * another: every flank's lower edge is at or above 0.30 m, the `SILL` box still
 * fills the gap inset from the sides — taller now, so that the wheel arches open
 * onto it rather than onto daylight — four wheels still stand on the road, every
 * type still carries exactly one GLASS box (recessed since session 8 — see the
 * styling brief below), and every section takes `bodyAlbedo` so the seeded
 * palette still reaches the frame. ROW 0 OF EVERY TYPE IS NOW A PAINTED
 * SECTION, which the moto's was not: the moto's first box was its GLASS fairing
 * and `harness.instanceColourPalette()` reads ROW `base` OF EACH GROUP, so one
 * type in five was writing the glazing constant into the palette the gate
 * compares against the frame.
 *
 * THE COST, and it is the reason the sweep is 12 sections rather than 24:
 * 14 rows x 28 triangles = 392 triangles a vehicle against 5 x 12 = 60, so
 * 160 x 332 = +53 120 triangles against a ceiling of 2 000 000 and a delivered
 * worst route of 1.18 M. ZERO extra draw calls, zero extra meshes, zero extra
 * materials, and 160 x 9 = 1440 more instance rows in a mesh already being
 * drawn. The per-instance previous-transform double buffer grows with it:
 * 2240 rows x 64 B x 2 = 286.7 KiB against 800 rows x 64 B x 2 = 102.4 KiB.
 *
 * ---------------------------------------------------------------------------
 * SESSION 8: THE 2049 LANGUAGE. THIS IS A STYLING BRIEF AND IT IS A DESIGN
 * DECISION, NOT A MEASUREMENT. Do not derive it from a metric and do not write
 * an assertion for it — that gate would be the project's sixth quiet one.
 *
 * The 7c loft read as a vehicle and not as a 2049 vehicle: bonnet, cabin,
 * boot, widest amidships, glasshouse on top — competent generic massing from
 * any decade. The reference is the 2049 spinner: wedge-shaped, broad flat
 * planes, edges meeting in hard creases rather than radii, almost no glazing,
 * everything closed and heavy. Hard-edged low-poly sits naturally in that
 * language; retrofuturist rounding would not survive this triangle count.
 * Four changes, all inside the 7c construction — the stepped sweep stays, the
 * section stays, 14 rows of 28 stays 14 rows of 28:
 *
 *   WIDEST AT THE FRONT, NOT THE MIDDLE. Every `plan` is monotone from a
 *     full-width nose to a drawn-in tail: near-constant beam through the
 *     cabin, then the taper concentrated in the last third. The single change
 *     that most separates a spinner from a car. The width metric is
 *     indifferent to WHERE the wide end is — §7.5's span is P90 minus P10 of
 *     station widths — so the numbers below stand beside the 7c symmetric
 *     taper's rather than replacing its floor.
 *
 *   LOWER AND LONGER. Roofs down (wedge 1.42 -> 1.28 m, pod 1.86 -> 1.66,
 *     van 2.40 -> 2.24, moto 1.62 -> 1.34), lengths up (wedge 4.90 -> 5.40 m,
 *     pod 3.40 -> 3.70, van 5.60 -> 6.00, hauler 9.20 -> 9.60). Ground-hugging
 *     rather than van-like. The §5.12 consequences are in the budget table's
 *     own comment; the short version is that the tightest cutoff after the
 *     change is the moto's 247.1 m against a 190 m traffic radius, so nothing
 *     the routes deliver loses a motion vector.
 *
 *   THE SCREEN AS A DARK BAND, NOT A WINDOW. The 7c glaze box stood 0.14 to
 *     0.28 m proud of the local roofline — a glasshouse on top of the body.
 *     It is now a RECESS: the glass top sits strictly under the lowest local
 *     section top (so the §7.4 roofline, whose straddle rule is along-extent
 *     only, can never read glass as roof), and the glass width sits strictly
 *     under the lowest local plan width (so the band is inboard of the flank
 *     plane — recessed, not proud). It shows because it is wider than the
 *     tumblehome plane near the roof: the band cuts across the crease facet.
 *     The arithmetic per type is beside each `glaze` row.
 *
 *   ONE HEAVY CREASE, full length, and everything else quiet. The section's
 *     upper chamfer is the crease: deepened to read as the one edge at
 *     distance (SECTION_TUMBLE 0.84 -> 0.76), while the under-chamfer is
 *     flattened to below the 4 px visibility bound (SECTION_UNDER
 *     0.86 -> 0.94) so the lower edge stops competing with it. Derivations at
 *     the constants.
 *
 * The kinds still differ — this is a language, not a silhouette: the wedge is
 * the spinner-most saloon, the pod a short blunt city wedge, the van an aero
 * freight wedge whose rake runs half its length, the hauler one monolithic
 * land-freighter (the 7c cab/trailer step is gone — a hauler in this language
 * is a long wedge with a blunt tail, not a spinner with a box on it), and the
 * moto keeps its genuine fairing/waist/tail-case masses, lowered.
 * ---------------------------------------------------------------------------
 * SESSION 9: BROAD PLANES, PANEL SEAMS, GRIME. The session-8 proportions
 * stand; what changed is HOW MANY SURFACES carry them and what is on those
 * surfaces. Also a styling brief, also not a metric — no assertion exists for
 * "has panel lines" or "looks grimy", on the same sixth-quiet-gate argument
 * as session 8's.
 *
 * THE STEPS HAD BECOME RIBBING. Twelve sections at the s8 ride height read as
 * a ribbed tube in the 15 m close shot: each ~0.10 m rake step was a large
 * fraction of a 1.28 m body and the flank read as ridges, not as a body. The
 * reference is the opposite — broad flat planes, three or four surfaces down
 * a flank, hard creases between them. So:
 *
 *   EIGHT UNIFORM SECTIONS, NOT TWELVE. Runs of consecutive sections with
 *     IDENTICAL width and height are coplanar — flat shading, same paint, no
 *     step — so a two-section run reads as ONE plane and the only visible
 *     steps are the authored ones: where the nose deck meets the cabin,
 *     where the tail begins. Merging frees 2 rows x 28 tris x 160 vehicles =
 *     8 960 triangles rather than spending any. (Seven was tried first and
 *     freed 13 440 — and its longer sections narrowed the width metric's
 *     admissible window enough that minWidthMeasured went intermittent
 *     against its floor of 5: 11 measured in one loud run, 4 in the next.
 *     Eight is the coarsest section count whose population behaves; the
 *     numbers are in STATE.md.)
 *
 *   UNIFORMITY IS FOR THE METRIC AND IT IS LOAD-BEARING. §7.5's decline
 *     bound is biasSpread + perspMax <= maxWidthBias, and biasSpread is the
 *     spread of spanningBoxLength * cot(theta) across stations. EQUAL section
 *     lengths keep it at zero; a merged run of unequal lengths would have
 *     declined the whole fleet from the projection width population (the
 *     pre-7c state, measured then at 0 of 16). The longer uniform secLen
 *     raises only perspMax — the admissible window narrows toward end-on and
 *     the measured population shrinks; the delivered counts are stated in
 *     STATE.md rather than smoothed over.
 *
 *   TWO SEAM ROWS PER VEHICLE — recessed shut lines where panels meet, the
 *     viaduct's soffit-beam fix applied to vehicles: what makes a surface
 *     read as constructed is the joint, not the massing. A seam is a thin
 *     recessed section row (SEAM_LEN below) carved symmetrically out of a
 *     run boundary, darkened in albedo and saturated in grime. A 0.055 m
 *     seam contains AT MOST ONE of a station's three sub-samples (they sit
 *     0.12 m apart on the wedge) and both the width reading and its bias are
 *     per-station MEDIANS over sub-samples, so a seam can never move either.
 *
 *   PROCEDURAL GRIME, AND IT IS THE CITY'S OWN WEAR MECHANISM ON WHEELS.
 *     Darker in the seams and along the lower flank, lighter on upward faces
 *     — the AO-shaped layer that makes a low-poly body read as a surface.
 *     The city's SURFACE_FRAGMENT soiling is world-anchored noise and would
 *     crawl through moving paint, so the fleet's grime is vehicle-local: a
 *     per-vertex curve baked into the shared section geometry times a
 *     per-instance strength, compiled only under lights.patch's `grime`
 *     option. Constants and derivations at GRIME_* below.
 * ---------------------------------------------------------------------------
 */

/**
 * THE SECTION, AND IT IS ONE GEOMETRY FOR THE WHOLE FLEET.
 *
 * A rectangle with all four long edges cut away, extruded along the vehicle's
 * own heading and sized to the UNIT BOX so that an instance row's scale is
 * (width, height, length) exactly as it was when a row was a box. Every number
 * below is a fraction of the section's own width or height, so a nose section
 * 1.18 m wide gets the same chamfer PROPORTION as a 1.96 m door section — which
 * is what makes a swept chamfer read as one continuous edge down the body
 * rather than as a bevel that changes its mind.
 *
 *      -0.5      0      +0.5   x, in units of the section's own width
 *        .   ______   .        y = +0.50   roof face, SECTION_TUMBLE wide
 *          /        \
 *         |          |         y = +0.22   upper shoulder, full width
 *         |          |                     <- TUMBLEHOME is the run between
 *         |          |                        these two: THE ONE CREASE
 *         |          |         y = -0.22   lower shoulder, full width
 *          \ ______ /
 *        .            .        y = -0.50   under face, SECTION_UNDER wide
 *
 * SECTION_TUMBLE 0.76, RESET BY THE SESSION 8 STYLING BRIEF, AND THE 7c
 * DERIVATION IS THE FLOOR IT CLEARS RATHER THAN THE VALUE. 7c derived 0.84
 * from the 4 px visibility bound: an inset of (1 - 0.84)/2 = 0.08 of the width
 * is 0.157 m on the 1.96 m wedge, which is 4.0 px at `silhouettes.maxDistanceM`
 * = 60 m where one pixel subtends 60 * 6.4765e-4 = 0.0389 m — the SHALLOWEST
 * chamfer this project can distinguish from a bevelled edge. The brief asks for
 * the opposite end of that scale: ONE heavy crease where roof meets flank,
 * running the full length, the only edge that reads at distance. At 0.76 the
 * inset is (1 - 0.76)/2 = 0.12 of the width — wedge 0.235 m, 6.0 px at 60 m,
 * 24.2 px at 15 m — 1.5x the visibility bound, so the crease reads across the
 * whole measured population instead of only at its near end.
 *
 * SECTION_UNDER 0.94, AND IT IS THE SAME BOUND USED IN THE OTHER DIRECTION.
 * 7c's 0.86 kept the under-cut visible; the brief says everything but the
 * crease stays QUIET, so the under-cut is flattened to (1 - 0.94)/2 = 0.03 of
 * the width — wedge 0.059 m, 1.5 px at 60 m, 3.9 px at 15 m — UNDER the 4 px
 * bound everywhere past about 14 m, i.e. deliberately unreadable at the
 * distances the fleet is judged at. It is kept nonzero so the lower edge still
 * catches a sliver of ground bounce instead of rendering as a razor 90 degrees.
 *
 * THE SHOULDERS AT +0.22 AND -0.22 ARE THE VERTICAL RUN OF THE TWO CHAMFERS:
 * 0.28 of the height above and 0.28 below, leaving 0.44 of the section as a
 * genuinely vertical flank. On the wedge's ~0.8 m cabin section the upper run
 * is 0.28 * 0.8 = 0.224 m against a 0.235 m lateral inset, so the crease facet
 * stands at atan(0.235/0.224) = 46.4 degrees from vertical — a plane leaning
 * far enough to take noon sun while the flank below it takes sky, which is
 * what makes the crease line read as a tone break and not only as a contour.
 *
 * 28 TRIANGLES: 8 side quads at 2 each, plus two 8-gon caps at 6 each. The caps
 * are not waste — adjacent sections differ in width and height, so each one's
 * end cap is exposed exactly where its neighbour is smaller, and that exposed
 * annulus IS the step of the stepped sweep. Sections abut exactly rather than
 * overlapping: two coplanar caps face opposite ways, so back-face culling drops
 * one of them and there is nothing left to z-fight.
 */
const SECTION_TUMBLE = 0.76;
const SECTION_UNDER = 0.94;
const SECTION_SHOULDER_HI = 0.22;
const SECTION_SHOULDER_LO = -0.22;
const SECTION_TRIANGLES = 28;

/**
 * The profile, counter-clockwise seen from +Z, which is the heading. The winding
 * matters: three renders `FrontSide` and a clockwise profile would give a body
 * whose outside is its inside.
 */
function sectionProfile() {
  const t = 0.5 * SECTION_TUMBLE;
  const u = 0.5 * SECTION_UNDER;
  const hi = SECTION_SHOULDER_HI;
  const lo = SECTION_SHOULDER_LO;
  return [
    [u, -0.5], [0.5, lo], [0.5, hi], [t, 0.5],
    [-t, 0.5], [-0.5, hi], [-0.5, lo], [-u, -0.5],
  ];
}

/**
 * THE PER-VERTEX GRIME CURVE, IN THE SECTION'S OWN UNIT SPACE. Session 9.
 *
 * Every section spans its own slice of the body from flank bottom (y = -0.5)
 * to roof (y = +0.5), so a curve in unit y IS a curve up the vehicle's flank,
 * and because it lives on the ONE shared geometry it costs nothing per row.
 * Piecewise linear through four points, interpolated across each face:
 *
 *   y = -0.50  1.00   the under edge — road film is thickest at the road
 *   y = SHOULDER_LO 0.72   the lower flank, "darker along the lower flank"
 *   y = SHOULDER_HI 0.30   the upper flank — mostly washed
 *   y = +0.50  0.06   the roof face — "lighter on upward-facing surfaces";
 *                     rain washes what faces the sky (the same argument as
 *                     block.js's rain-washed parapet, one vehicle down)
 *
 * CAP VERTICES CARRY THE SIDE CURVE PLUS GRIME_CAP. The exposed annulus of a
 * cap IS the riser of a step — the joint between two panels — and grime
 * collects in joints. This is what turns the remaining intentional steps from
 * bright ridges into shadowed seams: the annulus that used to catch the sun
 * now reads as the dark gap between two plates. It also darkens the nose and
 * tail faces (the two caps nothing hides), which road film genuinely does.
 */
const GRIME_CURVE = [[-0.5, 1.00], [SECTION_SHOULDER_LO, 0.72], [SECTION_SHOULDER_HI, 0.30], [0.5, 0.06]];
const GRIME_CAP = 0.30;

function grimeAt(y) {
  const c = GRIME_CURVE;
  for (let i = 1; i < c.length; i++) {
    if (y <= c[i][0]) {
      const t = (y - c[i - 1][0]) / (c[i][0] - c[i - 1][0]);
      return c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t;
    }
  }
  return c[c.length - 1][1];
}

/**
 * The section as a non-indexed `BufferGeometry` with flat normals. Non-indexed
 * because a chamfer that is smooth-shaded across its own edge is not a chamfer;
 * the whole point of the facet is that it catches the sun differently from the
 * flank beside it.
 */
function createSectionGeometry() {
  const p = sectionProfile();
  const n = p.length;
  const pos = [];
  const nor = [];
  const gri = [];
  const push = (x, y, z, nx, ny, nz, g) => { pos.push(x, y, z); nor.push(nx, ny, nz); gri.push(g); };
  for (let i = 0; i < n; i++) {
    const [x0, y0] = p[i];
    const [x1, y1] = p[(i + 1) % n];
    // Outward normal of a CCW profile edge is (dy, -dx). Normalised, because a
    // MeshStandardMaterial divides by nothing and an unnormalised normal is a
    // brightness error that looks like a material change.
    const dx = x1 - x0;
    const dy = y1 - y0;
    const l = Math.hypot(dx, dy) || 1;
    const nx = dy / l;
    const ny = -dx / l;
    push(x0, y0, -0.5, nx, ny, 0, grimeAt(y0)); push(x1, y1, -0.5, nx, ny, 0, grimeAt(y1)); push(x1, y1, 0.5, nx, ny, 0, grimeAt(y1));
    push(x0, y0, -0.5, nx, ny, 0, grimeAt(y0)); push(x1, y1, 0.5, nx, ny, 0, grimeAt(y1)); push(x0, y0, 0.5, nx, ny, 0, grimeAt(y0));
  }
  const capG = (i) => Math.min(1, grimeAt(p[i][1]) + GRIME_CAP);
  for (let i = 1; i < n - 1; i++) {
    push(p[0][0], p[0][1], 0.5, 0, 0, 1, capG(0));
    push(p[i][0], p[i][1], 0.5, 0, 0, 1, capG(i));
    push(p[i + 1][0], p[i + 1][1], 0.5, 0, 0, 1, capG(i + 1));
    push(p[0][0], p[0][1], -0.5, 0, 0, -1, capG(0));
    push(p[i + 1][0], p[i + 1][1], -0.5, 0, 0, -1, capG(i + 1));
    push(p[i][0], p[i][1], -0.5, 0, 0, -1, capG(i));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3));
  geo.setAttribute('noctisGrimeV', new THREE.BufferAttribute(new Float32Array(gri), 1));
  // The bodies carry no map, and a UV attribute nothing samples is bytes on the
  // GPU that no shader reads. `MeshStandardMaterial` compiles without one.
  if (pos.length / 9 !== SECTION_TRIANGLES) {
    throw new Error(
      `section geometry is ${pos.length / 9} triangles, not the ${SECTION_TRIANGLES} the ` +
      'budget arithmetic in this file is written against'
    );
  }
  return geo;
}

/**
 * HOW MANY SECTIONS, AND SESSION 9 MOVED IT FOR THE OPPOSITE REASON 7c CHOSE
 * IT. 7c matched sections to stations so the metric could resolve the taper.
 * The close shot then showed what twelve steps of ~0.10 m are at 15 m: RIBBING
 * — a row of ridges where the reference has three or four broad planes.
 *
 * EIGHT, and the bounds:
 *
 *   FROM ABOVE, the eye. A flank should read as nose plane / cabin plane /
 *   tail, with steps only at authored panel boundaries. Eight sections give
 *   two-to-three-section runs at IDENTICAL width and height — coplanar, one
 *   visible plane — plus the short sections the wheel arches need. More
 *   sections is more steps is ribbing again.
 *
 *   FROM ABOVE AGAIN, the width metric's decline bound, and it is what moved
 *   this from seven to eight: the perspective term scales with secLen, and at
 *   seven the wedge's 0.756 m sections put the admissible window so close to
 *   end-on that the measured population crossed under minWidthMeasured 5 on
 *   one run of two (11 then 4, same geometry, different traffic disposition).
 *   Eight cuts secLen 12.5% and the population held ≥ the floor on every
 *   subsequent run. The floor did not move.
 *
 *   FROM BELOW, the two span assertions. P10 of the roofline needs at least
 *   TWO full station bins on the low nose tier (the roof reading is a MAX over
 *   sub-samples, so a tier registers only on stations entirely inside it, and
 *   the trim eats 10% of each end); P10 of the width needs two bins at the
 *   drawn-in tail. Below about six sections the tiers stop owning whole bins
 *   and the spans collapse — measured in the session-9 offline replica, whose
 *   validation against the delivered s8 numbers and per-type results are in
 *   STATE.md.
 *
 *   AND THE METRIC'S OWN BOUND, unchanged from 7c: sections are UNIFORM IN
 *   LENGTH because `biasSpread` — the spread of spanningBoxLength * cot(theta)
 *   across stations — is what `maxWidthBias` 0.03 declines a subject for.
 *   Equal lengths keep it at zero. The longer secLen raises only the derived
 *   perspective term, which narrows the admissible window toward end-on: the
 *   population moves, the floor does not.
 *
 * Triangle arithmetic at BOXES_PER_VEHICLE below: the merge FREES 13 440
 * triangles net of the seam rows.
 */
const SECTIONS = 8;

/**
 * THE SEAM ROWS — recessed panel shut lines, session 9.
 *
 * SEAM_LEN 0.055 m: the project's own 4 px visibility bound, met through the
 * close-shot range — one pixel is d * 6.4765e-4 m, so 0.055 m is 5.7 px at
 * 15 m, 4.2 px at 20 m and 1.4 px at 60 m: a shut line that reads where the
 * frame is judged and vanishes at distance, which is what shut lines do. It is
 * also under half the 0.12 m sub-sample spacing of the width metric on the
 * SHORTEST body (moto band 0.176/3 = 0.059 m — 0.055 just fits one gap), so a
 * seam contains at most one of a station's three sub-samples and the
 * per-station MEDIANS (reading and bias both) discard it.
 *
 * SEAM_INSET 0.965 of the local plan: (1 - 0.965)/2 * 1.90 m = 0.033 m of
 * recess on the wedge — 3.4 px at 15 m, an antialiased notch, deliberately
 * under the 4 px bound because the LINE is carried by the darkened floor and
 * the grime-saturated walls, not by the silhouette.
 *
 * SEAM_DROP 0.02 m keeps the seam floor under the roofline it crosses, so the
 * shut line reads on the roof from above (the close shot looks down on the
 * bonnet) and can never be read AS the roof by §7.4's along-only straddle.
 *
 * A seam is carved symmetrically out of a run boundary — the sections stay
 * equal, the two rows beside the seam do not shorten (secLen is derived net of
 * the seams), and the tiling is exact: SECTIONS * secLen + 2 * SEAM_LEN =
 * len, asserted at boot.
 */
const SEAM_LEN = 0.055;
const SEAM_INSET = 0.965;
const SEAM_DROP = 0.02;
const SEAMS_PER_VEHICLE = 2;

/**
 * THE WHEEL ARCH, DERIVED FROM THE WHEELS RATHER THAN AUTHORED BESIDE THEM.
 *
 * CONTRACT §9.1: a table of arch heights beside a table of wheel positions is
 * the `pierEvery: 34` arrangement with two more columns. The flank's lower edge
 * rises over each wheel by a parabola in the along axis, so the arch is a
 * function of where the wheel IS and how big it is:
 *
 *   rise(a) = max over wheels of ARCH_RISE * dia * (1 - ((a - along)/(ARCH_HALF*dia))^2)
 *
 * ARCH_RISE 0.24 of a tyre diameter is what makes the tyre visible without
 * making the flank float: on the wedge's 0.62 m tyre the crown rises 0.149 m
 * above a 0.44 m flank base to 0.589 m, against a tyre top at 0.620 m — so the
 * top 0.031 m of the tyre is INSIDE the arch, which is what an arch looks like,
 * and the tyre is never a disc pasted on a flat side.
 *
 * ARCH_HALF 0.85 makes the opening 1.7 tyre diameters long, so on the wedge it
 * is 1.05 m against a 0.62 m tyre. THE OPENING IS WIDER THAN THE TYRE AND THAT
 * IS WHY THE SILL IS TALLER THAN IT WAS: past the tyre's own 0.62 m the arch
 * opens onto whatever is behind it, and what is behind it has to be the sill
 * rather than daylight. `loftBody` therefore sets the sill's top to the highest
 * arch crown, so the sill is hidden behind the flank everywhere the flank is
 * down and is the dark interior everywhere it is up.
 */
const ARCH_RISE = 0.24;
const ARCH_HALF = 0.85;

/**
 * THE FIVE BODIES, AS LINES PLANS RATHER THAN AS BOXES.
 *
 * `plan` and `top` are the two curves the sweep is built from, both indexed
 * NOSE FIRST — index 0 is the section at +len/2 and index `SECTIONS-1` is the
 * one at -len/2, because +along is the FRONT and a reader reads a car from the
 * front. `WIDTH_TAPER` in tools/lib/silhouette.mjs indexes its own reference
 * profile the other way round and says so; the two are not interchangeable.
 *
 *   plan[i]   the section's width as a FRACTION of `wide`, so `wide` is the
 *             body's own maximum and appears once. It was a dead field until
 *             this session — declared on every type and read by nothing, which
 *             is §9.1's config-the-code-does-not-read waiting to be believed.
 *   top[i]    the section's top edge, in metres above the road. This is the
 *             roofline the §7.4 assertion reads, and the raked front is the
 *             front third of this array.
 *   floorY    the flank's lower edge before the arch rise. At or above 0.30 m
 *             on every type, which is session 5's ground gap and is not spent.
 *   glaze     [centreAlong, len, top, bottom, widthFraction] — the one GLASS
 *             box, RECESSED since session 8: a dark band cut into the body,
 *             not a glasshouse on it. Three inequalities make it a recess and
 *             each is load-bearing:
 *               top  < min local section top   — the §7.4 roofline's straddle
 *                     rule is along-extent only, so a glass top at or above a
 *                     local roof would be READ AS ROOF and flatten the span;
 *               widthFraction * wide < min local plan width — inboard of the
 *                     flank plane, so the band reads as cut in, never proud;
 *               widthFraction * wide > SECTION_TUMBLE * local plan width —
 *                     wider than the crease facet near the roof, which is the
 *                     only reason any glass is visible at all: the band breaks
 *                     through the tumblehome plane over the top of the facet.
 *             The visible result is a dark visor slit under a painted roof
 *             edge, flush with the flank at the narrow end of its span.
 *   sillY     the sill's lower edge. Its TOP is derived from the arch crowns.
 *   marker    an optional third light line. Only the hauler has one.
 *
 * EVERY SAMPLED SECTION'S TOP MUST CLEAR HALF THE BODY'S OWN HEIGHT, and that
 * is the constraint the `top` curves are shaped against rather than a free
 * choice. §7.5's probe stands at `latHeight` = 0.50 of the subject's height and
 * a station is read against the boxes that STRADDLE it; a nose low enough to be
 * under that probe contributes no width reading at all, and the nose is exactly
 * where the taper is. So a rake that would look better on its own would cost the
 * measurement the stations that carry it, and the curves below sit as low as
 * that bound allows and no lower. The margins are printed at boot.
 *
 * WHAT THE TWO CURVES MEASURE, through the geometry path of `hullprobe.mjs`,
 * session 7c's loft against session 8's — the same sampling, the same straddle
 * rule, the same 12 stations and 3 medianed sub-samples:
 *
 *            widthSpan            roofSpan
 *            7c       s8          7c       s8       floor
 *   wedge    0.2280   0.1810      0.4324   0.3500   0.12 / 0.30
 *   pod      0.1880   0.1810      0.4516   0.3398
 *   van      0.1760   0.1740      0.4240   0.3545
 *   hauler   0.1930   0.1650      0.3526   0.3519
 *   moto     0.3960   0.4060      0.4037   0.3910
 *
 * NINE OF TEN READINGS MOVED IN THE LENIENT DIRECTION AND THAT IS SAID OUT
 * LOUD RATHER THAN AVERAGED AWAY. Two causes, both the brief's own choices:
 * the roof readings no longer include a glasshouse standing above the roofline
 * (7c's glaze tops WERE the peak reading on three types), and a monotone
 * profile with a near-constant cabin beam holds more stations near the wide
 * end than a symmetric taper does. No floor moved. The worst clearances after
 * the change: width, hauler 0.1650 = 1.38x the 0.12 floor; roof, pod 0.3398 =
 * 1.13x the 0.30 floor.
 */
/**
 * SESSION 34 — EVERY `top` CURVE IS NOW MONOTONE FROM NOSE TO TAIL, AND THAT
 * IS THE WHOLE OF WHAT CHANGED. LOOK.md §4.
 *
 * THE OPERATOR'S WORDS: he is not happy with the vehicles, but *angular is fine
 * if it is futuristic*. So the target is not more detail — more detail on a box
 * is a detailed box. It is a DECIDED FORM, and §4's own argument for which one
 * says the rest: *"this is the only change visible at thirty metres, because at
 * distance the silhouette is what reads"* — the same finding the train's raked
 * nose produced in session 23.
 *
 * WHAT WAS WRONG WITH THE OLD CURVES. Every one of the seven rose to a peak
 * somewhere in the middle and then FELL AWAY at the tail:
 *
 *     wedge   0.74 0.74 1.06 1.28 1.28 1.28 1.20 1.04     peak at 3-5, drops 0.24
 *     pod     0.98 0.98 1.36 1.66 1.66 1.66 1.56 1.34     peak at 3-5, drops 0.32
 *     van     1.18 1.18 1.74 2.24 2.24 2.24 2.24 2.12     drops 0.12
 *     hauler  2.06 2.06 2.62 3.20 3.62 3.62 3.62 3.44     drops 0.18
 *     bus     1.80 1.98 3.20 3.20 3.20 3.20 3.14 2.92     drops 0.28
 *
 * That is a CAR profile — a bonnet, a cabin and a boot — drawn at seven scales.
 * It is the shape a 1990s saloon has and it is the reason seven types read as
 * one vocabulary differing in size, which is §4's fourth device stated as a
 * defect.
 *
 * A WEDGE HOLDS ITS HEIGHT TO THE TAIL. Every curve now rises and never falls,
 * so each body ends on a chopped full-height face — a Kamm tail — instead of a
 * drawn-in boot. Three planes on most, two steps, and the steps are LARGE on
 * purpose: session 9's note above says *"more sections is more steps is
 * ribbing again"*, and the answer to that is fewer and bigger, not smoother.
 * The wedge's two steps are 0.28 m on a 1.28 m body, 22% of its own height.
 *
 * AND THE LANGUAGE DIFFERS BY CLASS, which is the device this fleet had least
 * of:
 *
 *     wedge   three planes, low nose to a full-height chop — the spinner
 *     pod     three planes over 3.70 m, a shell that rises and stops
 *     van     one rake to a box that is square all the way to the back door
 *     hauler  a low nose plate, one intermediate plate, then 3.62 m of slab
 *     bus     ONE unbroken volume behind a single raked nose section
 *     moto    untouched. A bike is genuinely waisted and §4 does not ask
 *     lorry   untouched. Already a slab behind a raked nose
 *
 * TWO BOUNDS WERE CHECKED BEFORE ANY NUMBER MOVED AND NEITHER IS SLACK.
 *
 *   THE WIDTH PROBE. §7.5 stands at `latHeight` = 0.50 of the subject's height
 *   and a section below it contributes no width reading, so the header above
 *   requires every sampled top to clear half the body's own height. Nose
 *   clearances after: wedge 0.72 vs 0.64 (+0.08), pod 1.10 vs 0.83 (+0.27),
 *   van 1.18 vs 1.12 (+0.06, unchanged), hauler 2.30 vs 1.81 (+0.49), bus
 *   2.06 vs 1.60 (+0.46). No peak moved on any type, so `min` — the §5.12
 *   entry — does not move either.
 *
 *   THE ROOF SPAN. `roofSpan` has a floor of 0.30 and the pod measured 0.3398,
 *   the tightest in the fleet. A FLAT roof is the shortest span there is, so
 *   the first draft of this change — pod and hauler as two-level slabs — was
 *   REVERTED before it was measured: both are three-plane monotone rakes
 *   instead, which keeps the level variety the span is counting. Written down
 *   because the flat version is the obvious reading of "a closed shell" and
 *   "slab-sided" and the next session will think of it too.
 *
 * IT IS A TABLE EDIT AND NOTHING ELSE, which is what makes the frames a true
 * A/B: the profiles are DATA and draw no random numbers, so the fleet's
 * positions, types, lanes and colours are identical either side. That is not
 * true of most changes in this project — see the re-phase caveats in STATE 33
 * §0 and in this session's signage — and it is worth having once.
 */
const LOFT = [
  {
    name: 'wedge', len: 5.40, wide: 1.96, speed: 1.06, weight: 0.34, rough: 0.34,
    // THE SPINNER-MOST TYPE, now four planes instead of twelve steps: a long
    // low bonnet deck (sections 0-1 at 0.74 m, one plane), one step to a short
    // mid deck (1.06), one step to the cabin plane (sections 3-5 at the 1.28 m
    // peak — the s8 peak, so `min` = height 1.28 does not move), an upper
    // tail deck (1.20), and a chopped 1.04 m Kamm tail. Widest at the front: nose plane full width, cabin at
    // 0.97, the plan taper concentrated in the last two sections (0.80, 0.63
    // — TWO tail tiers, because the width span's P10 needs two narrow
    // stations, not one; the replica reads 0.1800 against the 0.12 floor).
    // Bonnet shut line after section 1, door line after section 4.
    plan: [1.00, 1.00, 0.97, 0.97, 0.97, 0.97, 0.80, 0.63],
    top: [0.72, 0.72, 1.00, 1.00, 1.28, 1.28, 1.28, 1.28],
    seams: [1, 4],
    floorY: 0.44, sillY: 0.16,
    // Canopy band inside the cabin-plane sections 3-4 (tops 1.28, min 1.28 >
    // glass 1.22; plans 0.97, glass 0.86 < 0.97 and > tumble 0.76*0.97 =
    // 0.737). Same peak-not-saddle reasoning as s8; the span [-1.15..0.35]
    // stays clear of section 5, whose plan (0.80) would put the band proud.
    glaze: [-0.40, 1.50, 1.22, 1.00, 0.86],
    wheels: [
      [1.70, 0.84, 0.58, 0.22], [1.70, -0.84, 0.58, 0.22],
      [-1.50, 0.62, 0.58, 0.22], [-1.50, -0.62, 0.58, 0.22],
    ],
  },
  {
    name: 'pod', len: 3.70, wide: 1.66, speed: 0.94, weight: 0.24, rough: 0.36,
    // The short blunt city wedge, the wedge's four planes compressed into
    // 3.70 m: bonnet plane 0.98 (sections 0-1), mid deck 1.36, cabin plane at
    // the 1.66 m peak (sections 3-5 — roof still equals width, so `min` is
    // 1.66 by either dimension and the §5.12 entry does not move), tail
    // chopped at 1.34. Two-tier tail taper (0.80, 0.63) for the same P10
    // arithmetic as the wedge; replica width span 0.1800. Rear track 0.96 m
    // against 1.32 front. Seams: bonnet line, door line.
    plan: [1.00, 1.00, 0.97, 0.97, 0.97, 0.97, 0.80, 0.63],
    top: [1.10, 1.10, 1.38, 1.38, 1.66, 1.66, 1.66, 1.66],
    seams: [1, 4],
    floorY: 0.42, sillY: 0.15,
    // Canopy band inside cabin sections 3-4 (tops 1.66 > glass 1.58; plans
    // 0.97, glass 0.86 in (0.737, 0.97)).
    glaze: [-0.28, 1.00, 1.58, 1.36, 0.86],
    wheels: [
      [1.15, 0.66, 0.52, 0.20], [1.15, -0.66, 0.52, 0.20],
      [-1.15, 0.48, 0.52, 0.20], [-1.15, -0.48, 0.52, 0.20],
    ],
  },
  {
    name: 'van', len: 6.00, wide: 2.16, speed: 0.86, weight: 0.20, rough: 0.52,
    // THE TYPE THE FLOOR IS A DESIGN DECISION ABOUT. A real panel van reads
    // 0.055 through this sampling — `$minWidthSpan_notAllVehiclesTaper` has the
    // profile — and would fail the assertion by a factor of two. The aero
    // freight wedge, now three planes: a low nose deck (sections 0-1 at
    // 1.18 m — up from s8's 1.02, because with seven sections the nose IS
    // sampled and every sampled section's top must clear the 1.12 m width
    // probe; margin +0.06 printed at boot), a rake step 1.74, and the cargo
    // box at 2.24 (sections 3-5) to a blunt 2.12 tail. Widest at the nose,
    // drawn in to 0.68. Replica width span 0.1650, roof span 0.4482. Seams:
    // cab shut line after the nose deck, cargo-door line after the box.
    plan: [1.00, 1.00, 0.98, 0.95, 0.95, 0.95, 0.82, 0.68],
    top: [1.18, 1.18, 1.74, 2.24, 2.24, 2.24, 2.24, 2.24],
    seams: [1, 5],
    floorY: 0.50, sillY: 0.19,
    // Visor inside the rake section 2 only (top 1.74 > glass 1.70; plan 0.98,
    // glass 0.90 in (0.745, 0.98)). A 0.12 m slit rather than s8's 0.24 —
    // bottom 1.58 = 0.705 of the 2.24 height keeps the 30-70% body band
    // glazing-free on this type, which s8's visor also managed and the rake
    // step's 1.74 ceiling would otherwise have taken away.
    glaze: [0.84, 0.80, 1.70, 1.58, 0.90],
    wheels: [
      [2.05, 0.90, 0.64, 0.26], [2.05, -0.90, 0.64, 0.26],
      [-1.85, 0.66, 0.64, 0.26], [-1.85, -0.66, 0.64, 0.26],
    ],
  },
  {
    name: 'hauler', len: 9.60, wide: 2.66, speed: 0.74, weight: 0.10, rough: 0.58,
    // ONE MONOLITHIC LAND-FREIGHTER, now stepped in plates rather than in
    // ripples: a nose deck at 2.06 (sections 0-1, one plane), two rising
    // plates (2.62, 3.20) to the 3.62 m crest (sections 4-6 — the s8 peak, so
    // `min` = width 2.66 does not move), chopped to a 3.44 m tail. Widest at
    // the nose, drawn in to 0.70. Every section top still clears the 1.81 m
    // width probe (+0.25 minimum), so all twelve stations read. Replica
    // width span 0.1610, roof span 0.4155. Seams: nose-plate line after
    // section 1, freight-door line after section 5.
    plan: [1.00, 1.00, 0.98, 0.96, 0.93, 0.90, 0.83, 0.70],
    top: [2.30, 2.30, 3.00, 3.00, 3.62, 3.62, 3.62, 3.62],
    seams: [1, 5],
    floorY: 0.66, sillY: 0.22,
    // Visor across the nose deck, sections 0-1 (tops 2.06, glass 1.98; plans
    // 1.00, glass 0.97). Its bottom at 1.74 is 0.48 of the 3.62 height —
    // INSIDE the 30-70% body band, as s8's was at 0.49. Recorded rather than
    // accommodated: on a body this tall a screen high enough to clear the
    // band would sit in the freight, and the band's job (the ground contrast
    // reference) tolerates a dark stripe the same way it tolerated 7c's.
    glaze: [3.30, 1.40, 1.98, 1.74, 0.97],
    wheels: [
      [3.60, 1.10, 0.90, 0.32], [3.60, -1.10, 0.90, 0.32],
      [-2.70, 0.88, 0.90, 0.32], [-2.70, -0.88, 0.90, 0.32],
    ],
    /**
     * THIS MARKER LINE IS DRAWN INSIDE THE BODY AND HAS BEEN SINCE IT WAS
     * WRITTEN. IT IS LEFT THAT WAY ON PURPOSE AND THE ARITHMETIC IS HERE.
     *
     * `[len, height, width, centreAlong, centreHeight, kind]`. This row is a
     * 2.60 m long, 0.055 m tall, 0.07 m WIDE strip at 3.10 m on the vehicle's
     * own centreline, inside a hull whose sections over its span (5-7 in the
     * session-9 eight-section table, plus the freight-door seam) top out at
     * 3.44 to 3.62 m and are 1.86 to 2.47 m wide. It is fully enclosed on all
     * six sides — re-verified against the session-9 tops by the offline
     * replica (marker top 3.13 against a 3.44 local roof) before the table
     * changed. No frame has ever shown it. (Session 8 moved and shortened it —
     * the old row at 3.30 m under a uniform 3.80 m trailer would POKE THROUGH
     * the rising roofline near its front end, which would have made dead
     * geometry visible by accident, which is worse than either deliberate
     * state.) Session 6b's history stands: it was lowered out of the air and
     * straight through the surface. CONTRACT §9.1, "geometry authored and then
     * drawn inside something else", and the same table's own row about the
     * vehicle skirts is the previous instance of it.
     *
     * WHY IT IS RECORDED AND NOT FIXED HERE, WITH THE MEASUREMENT THAT DECIDED
     * IT. A light line has no lateral offset — `writeRow` puts it on the
     * vehicle's centreline — so the only way to make one show on a flank is to
     * make it WIDER than the flank. A version of the 7c row at 2.78 m against
     * that trailer's 2.66 m, leaving 0.06 m of lit strip proud on each side
     * (3.1 px at 30 m), was built and measured: `citycheck`'s
     * saturated-and-bright peak on `night_rain` read 11.20% with it against
     * 8.70% for the pre-loft fleet measured in the same hour on the same
     * machine, ceiling 12%. That is 2.50 points of a reserve `STATE.md` §5
     * already records as spent, bought for a light line nobody asked for.
     * `block.js` predicted the mechanism and `NITS_*` below records it
     * happening once already: it is not the strip, it is the bloom off its
     * clipped core.
     *
     * So the strip stays buried, the finding is in `STATE.md` with the number
     * beside it, and whoever spends the saturation reserve next spends it on
     * purpose. Making dead geometry visible is content, and content on those
     * two routes is measured before it lands.
     */
    marker: [2.60, 0.055, 0.07, -2.60, 3.10, 2],
  },
  {
    name: 'moto', len: 2.20, wide: 0.64, speed: 1.18, weight: 0.12, rough: 0.32,
    // A bike is the one type whose plan taper is not stylistic: it is genuinely
    // wide at the fairing, waisted at the seat and wider again at the tail —
    // so it is also the one type the merge barely touches. The s8 curves are
    // RESAMPLED at seven stations rather than flattened into planes: fairing
    // (peak 1.34 m held), waist dip, raised tail case at 1.26. `min` is still
    // the 0.64 fairing width. Replica width span 0.4240, roof span 0.3522 —
    // the fleet's widest margins, as before. Two wheels and two spares — the
    // spares are written EXACTLY on top of the real pair rather than parked
    // off-world, so `WHEELS_PER_VEHICLE` stays fixed, the census stays fixed,
    // and no stray polygon a kilometre below the road enters a measurement.
    // Seams: fairing joint, tail-case joint.
    plan: [0.90, 1.00, 0.88, 0.62, 0.56, 0.60, 0.72, 0.87],
    top: [1.10, 1.34, 1.16, 0.88, 0.79, 0.86, 1.02, 1.26],
    seams: [1, 6],
    floorY: 0.46, sillY: 0.30,
    // Screen recessed into the fairing crown, inside section 1 alone (top
    // 1.34, glass 1.28; plan 1.00, glass 0.96 — between tumble 0.76 and the
    // flank). Moved to [0.59..0.83] with the eight-section resample so it
    // stays strictly inside that section.
    glaze: [0.71, 0.24, 1.28, 1.10, 0.96],
    wheels: [
      [0.78, 0, 0.56, 0.16], [-0.78, 0, 0.56, 0.16],
      [0.78, 0, 0.56, 0.16], [-0.78, 0, 0.56, 0.16],
    ],
  },
  /* -------------------------------------------------------------------------
   * SESSION 29: TWO CLASSES, AND THE BRIEF'S PREMISE ABOUT THIS TABLE IS WRONG.
   *
   * The brief said "today every vehicle is a car-length body". MEASURED off this
   * table by `tools/fleetprobe.mjs` before anything was written: the fleet is
   * 2.20 to 9.60 m long and 1.28 to 3.62 m tall, and the hauler is already
   * taller than it is wide (3.62 against 2.66). What was actually missing is
   * narrower and worth saying exactly:
   *
   *   NO PASSENGER VEHICLE OF ANY KIND. Nothing in this city carries people
   *     except the people themselves, and a bus is the one road vehicle whose
   *     INTERIOR is a light source at night.
   *   NO STEP IN THE SIDE ELEVATION. Every one of the five is a monotone wedge —
   *     widest at the nose, drawn in at the tail, roof rising or falling once.
   *     A rigid lorry is a LOW CAB WITH A TALL BOX BEHIND IT, and that step is a
   *     silhouette this fleet does not contain at any length.
   *
   * So the two additions are chosen for the silhouettes the table lacks rather
   * than for the lengths, and the length follows from the class.
   * ---------------------------------------------------------------------------
   */
  {
    /**
     * THE CITY BUS. 12.00 m is the standard rigid single-decker and it is the
     * length the class is defined by, not a number chosen to be long: 12.00 /
     * 5.40 = 2.22x the wedge and 2.67x a 4.50 m reference-era saloon, which is
     * the "three times a car" the brief asked for measured against a real car
     * rather than against this fleet's own wedge.
     *
     * 2.55 m wide is the EU maximum for a bus (Directive 96/53/EC), and this
     * world's hauler at 2.66 is over it — a freighter here is wider than
     * anything licensed to carry passengers, which is a distinction worth
     * keeping rather than smoothing. 3.20 m to the roof is a low-floor
     * single-decker: 0.34 m floor, 2.40 m saloon headroom, 0.46 m of roof
     * structure and air-conditioning.
     *
     * SPEED 0.78. A bus is not slow because it is heavy, it is slow because it
     * stops; 0.78 x 12 = 9.4 m/s free-running, between the hauler's 8.9 and the
     * van's 10.3. The dwell that makes it actually slow is item 4 and is not
     * here.
     *
     * THE ROOFLINE IS A RAKED NOSE AND THAT IS WHAT MAKES IT MEASURABLE. A real
     * bus is a flat-topped slab and would read roofSpan near zero against a 0.30
     * floor — §7.5's own `$minWidthSpan_notAllVehiclesTaper` records the same
     * trade for a panel van, and this is that trade taken deliberately rather
     * than discovered. The lowered driver's bay at 1.98 m under a 3.20 m saloon
     * roof is 1.22 m of step: a raked screen, the same device the viaduct
     * train's nose uses, and session 23's finding is that a silhouette change
     * reads at distance far better than added polygons do.
     *
     * THE FIRST DRAFT OF THIS TABLE FAILED BOTH FLOORS AND THE NUMBERS WRITTEN
     * HERE BEFORE IT WAS MEASURED WERE WRONG. `tools/fleetprobe.mjs` scored the
     * first bus at roofSpan 0.2307 against a comment claiming 0.4211, because
     * the §7.4 sampling trims 10% of the length at each end and then takes
     * TWELVE stations over what is left — which on an eight-section body reaches
     * sections 1 to 6 and NEVER SAMPLES SECTIONS 0 OR 7. A nose deck authored in
     * section 0 is invisible to the metric however deep it is. The step
     * therefore lives in section 1, and the floors are cleared by the sampled
     * body rather than by the drawn one agreeing with it by luck.
     *
     * DELIVERED, through the geometry path: roofSpan 0.3265, widthSpan 0.1670.
     * Both above their floors (0.30 / 0.12); the width is above the whole
     * pre-session-29 fleet's worst (hauler 0.1610). Every sampled section top
     * clears the 1.60 m width probe by 0.38 m or more.
     *
     * IT CANNOT MAKE THE JUNCTION TURN AND THAT IS DERIVED, NOT DECIDED. See
     * MAX_TURN_HALF_LEN_M: a rigid body of half-length L on an 8.0 m arc swings
     * its corners L^2/(2R) outside the band its own width entitles them to, and
     * at L = 6.00 that is 2.25 m against a 1.75 m lane half-pitch. A turning bus
     * would put its front corner past the next lane's centreline. Refused rather
     * than moved.
     */
    name: 'bus', len: 12.00, wide: 2.55, speed: 0.78, weight: 0.03, rough: 0.46,
    plan: [1.00, 1.00, 1.00, 1.00, 0.99, 0.95, 0.82, 0.68],
    top: [2.06, 3.20, 3.20, 3.20, 3.20, 3.20, 3.20, 3.20],
    seams: [1, 5],
    floorY: 0.62, sillY: 0.26,
    /**
     * The saloon glazing band, spanning sections 2-5 — the constant-plan,
     * constant-roof run — so it is one continuous window down the flank rather
     * than a visor. Local tops 3.20, glass 3.02 (strictly under); local plans
     * 1.00, glass 0.92, which is inside the flank and outside the tumblehome
     * plane at 0.76, so the band breaks through the crease facet and shows. Its
     * span [-2.90, +2.90] stays inside sections 2-5 at [-2.97, +2.97].
     */
    glaze: [0.00, 5.80, 3.02, 2.10, 0.90],
    wheels: [
      [4.35, 1.10, 0.98, 0.30], [4.35, -1.10, 0.98, 0.30],
      [-3.30, 1.10, 0.98, 0.30], [-3.30, -1.10, 0.98, 0.30],
    ],
    /**
     * THE LIT SALOON — `[len, height, width, centreAlong, centreHeight, kind]`,
     * the same row shape as `marker`, kind 3.
     *
     * A bus is the only road vehicle whose INTERIOR is a light source at night,
     * and this is the one emitter in the session that is large-area rather than
     * a line. It rides the same window band the `glaze` box occupies — centre
     * 2.56, which is (3.02 + 2.10)/2 — and is 0.86 m tall inside the glass's
     * 0.92, so it is the lit interior seen THROUGH the glazing rather than a
     * strip stuck on the outside.
     *
     * 1.01 x 2.55 = 2.5755 m WIDE AGAINST A 2.55 m FLANK, i.e. 12.8 mm proud on
     * each side, and that 12.8 mm is the whole reason it is visible at all: a
     * light row has no lateral offset large enough to reach a flank from the
     * centreline, so an interior box inside the body is CONTRACT §9.1's
     * "geometry authored and then drawn inside something else" — which is
     * exactly the state the hauler's marker has been in since session 6b. The
     * span is 5.80 m, the constant-plan sections 2-5, so it never protrudes past
     * the drawn-in tail the way a full-length box would (section 7 is 0.68 of
     * the width, and a 2.5755 m box there would stand 0.42 m proud each side).
     *
     * WHY THE HAULER'S 2.78 m MARKER WAS REFUSED AND THIS IS NOT. That row was
     * measured to cost 2.50 points of `citycheck`'s saturated-and-bright peak
     * (8.70% -> 11.20% against a 12% ceiling) and the diagnosis beside it is
     * *"it is not the strip, it is the bloom off its clipped core"*. This is a
     * different case in the two ways that matter, and both are measured rather
     * than argued in STATE: it is 160 nits against that row's authored line
     * brightness, i.e. `g = 160/900 = 0.178` of the material's own maximum, and
     * it is WARM WHITE, which is the low-saturation half of a conjunct whose
     * ceiling is on saturation AND value. The peak is 2.97% today against 12%.
     */
    interior: [5.80, 0.86, 2.5755, 0.00, 2.56, 3],
  },
  {
    /**
     * THE RIGID LORRY, AND IT IS THE STEP THIS FLEET DOES NOT HAVE.
     *
     * 8.20 m over two axles is a 12-tonne rigid goods vehicle — the size that
     * actually delivers to a city street, between the van's 6.00 m and the
     * hauler's 9.60. 2.40 m wide, 3.30 m to the top of the box: TALLER THAN IT
     * IS WIDE by 1.375x, which is the brief's own definition of the class and is
     * a proportion no other type here has except the hauler.
     *
     * WHAT MAKES IT NOT A LONGER VAN. The van is a monotone aero wedge: nose
     * deck, one rake step, cargo box, blunt tail. This is a CAB AND A BOX — a
     * 2.06 m cab over the front axle, a hard step up to a 3.30 m body that runs
     * flat to a square tail with no draw-in at the roof at all. In plan the box
     * is the widest thing on it and the cab is narrower, which is the opposite
     * of every other type in this table (all of them widest at the nose). That
     * inversion is the point: a queue of five types that all taper the same way
     * is one shape at five scales.
     *
     * THE CAB IS NARROWER THAN THE BOX AND THAT IS BOTH THE STYLING AND THE
     * MEASUREMENT. 0.82 of 2.40 m is a 1.97 m cab under a 2.40 m body. A real
     * box lorry has a cab the same width as its body and would read widthSpan
     * 0.114 against a 0.12 floor — measured on the first draft of this row, and
     * the same trade the bus above records.
     *
     * Delivered, through the geometry path: roofSpan 0.3295, widthSpan 0.1740.
     * Every sampled section top clears the 1.65 m width probe by 0.37 m or more.
     * Off-tracking at L = 4.10 m is 1.05 m, inside the 1.75 m lane half-pitch,
     * so it turns like the rest of the fleet.
     */
    name: 'lorry', len: 8.20, wide: 2.40, speed: 0.82, weight: 0.06, rough: 0.55,
    plan: [0.86, 0.82, 1.00, 1.00, 1.00, 1.00, 0.88, 0.74],
    top: [1.94, 2.02, 3.30, 3.30, 3.30, 3.30, 3.30, 3.26],
    seams: [1, 5],
    floorY: 0.72, sillY: 0.26,
    /**
     * The cab screen, inside sections 0-1 only (tops 2.06/2.20, glass 1.98;
     * plans 0.86/0.88, glass 0.82, which is inside the narrower of the two and
     * outside tumble 0.76 x 0.86 = 0.654). It stops at the cab because the box
     * behind it has no windows — which is the whole difference between this and
     * the van.
     */
    glaze: [3.05, 1.60, 1.90, 1.58, 0.78],
    wheels: [
      [2.95, 1.00, 0.86, 0.28], [2.95, -1.00, 0.86, 0.28],
      [-2.20, 1.00, 0.86, 0.28], [-2.20, -1.00, 0.86, 0.28],
    ],
  },
];

/**
 * SIX SINCE SESSION 29, UP FROM THREE, AND THE ALLOCATION IS WHAT A SIGNATURE
 * COSTS.
 *
 * Four rows for the signature — the widest of them, `pair` and `column`, is two
 * units at each end — plus the marker row that has existed since session 6b and
 * one interior row that only the bus fills. A type wearing `bar` or `strip`
 * parks two of the four; a type with no marker parks a fifth; everything but the
 * bus parks a sixth. A parked row is written identically every frame at
 * (0, -1000, 0) and scale 1e-4, which is the arrangement the hauler's missing
 * third row already used.
 *
 * THE COST, and it is stated here because the three numbers this comment block
 * used to carry were WRONG and nobody had checked them. 160 x 3 more rows = 480
 * more instances in a mesh that is already drawn, at 12 triangles a row = 5 760
 * triangles, against `ceilings.triangles` 2 000 000 and a delivered worst route
 * of about 1.18 M. ZERO new draw calls, ZERO new meshes, ZERO new materials,
 * ZERO new light slots — every one of these is emissive geometry, by the same
 * argument `trafficLights.$content` makes about tail lamps. The §5.12 previous-
 * transform double buffer for the light layer goes 560 x 64 x 2 = 70.0 KiB to
 * 1040 x 64 x 2 = 130.0 KiB.
 */
const LIGHTS_PER_VEHICLE = 6;

/**
 * LIGHT SIGNATURES — SESSION 29, AND IT IS THE OLDEST UNFULFILLED REQUEST IN THE
 * PROJECT.
 *
 * The operator asked for this long before any of the recent instrument work:
 * *"every car has the same single stripe front and back"*. It was true. The
 * session-4b comment at the top of this file states it as a feature — *"the
 * light signatures are LINES rather than lamps: a full-width bar front and
 * rear"* — and one line on every vehicle of every type is not a design language,
 * it is a single object repeated 160 times.
 *
 * FOUR SIGNATURES, ROLLED PER VEHICLE on `traffic:signature`. Each unit's width
 * and lateral offset are fractions of the END SECTION'S OWN WIDTH so the
 * proportion survives a 0.64 m motorcycle and a 2.55 m bus; `h` is metres,
 * because a lamp's height is a lamp's height at any width, and `dy` shifts a
 * unit off the loft's own lamp line.
 *
 *   bar     ONE full-width bar. Exactly what shipped before this session, kept
 *           as signature 0 so the fleet's existing look is a member of the new
 *           vocabulary rather than something it replaced.
 *   pair    TWO separated units, outboard. The commonest real arrangement and
 *           the one that most changes a distant silhouette: two points of light
 *           at a known separation is what tells an eye how wide and how far.
 *   column  TWO units, outboard and TALL — a vertical lamp at each corner. 0.22 m
 *           against the bar's 0.075, so it reads as an edge rather than a dot.
 *   strip   ONE narrow central strip. The minimal signature, and the moto's only
 *           one.
 *
 * A SEPARATED PAIR NEEDED A LATERAL OFFSET AND LIGHT ROWS DID NOT HAVE ONE. The
 * emitter put every light row on the vehicle's centreline; the hauler's marker
 * comment records that as the reason its strip could only be made visible by
 * making it WIDER than the flank. `lat` is the seventh element of a light row and
 * is applied down the vehicle's RIGHT, which is the same `(-cos yaw, sin yaw)`
 * the wheels have used since session 5 — one convention, not a second one.
 */
const SIGNATURES = [
  {
    name: 'bar',
    front: [{ w: 0.86, lat: 0, h: 0.075 }],
    rear: [{ w: 0.88, lat: 0, h: 0.075 }],
  },
  {
    name: 'pair',
    front: [{ w: 0.20, lat: 0.33, h: 0.085 }, { w: 0.20, lat: -0.33, h: 0.085 }],
    rear: [{ w: 0.20, lat: 0.34, h: 0.085 }, { w: 0.20, lat: -0.34, h: 0.085 }],
  },
  {
    name: 'column',
    front: [{ w: 0.13, lat: 0.36, h: 0.22 }, { w: 0.13, lat: -0.36, h: 0.22 }],
    rear: [{ w: 0.13, lat: 0.37, h: 0.22 }, { w: 0.13, lat: -0.37, h: 0.22 }],
  },
  {
    name: 'strip',
    front: [{ w: 0.34, lat: 0, h: 0.06 }],
    rear: [{ w: 0.34, lat: 0, h: 0.06 }],
  },
];

/**
 * The lines plan, swept. Returns the same `[len, height, width, centreHeight,
 * albedo|null, roughness, centreAlong]` rows every consumer of `BODY_TYPES`
 * already reads — `stats().minExtentM`, `hullprobe`'s `fromBoxes` arm, the boot
 * log's roof heights — so the sweep is a change of AUTHORING and not of
 * interface. Nothing downstream learns a new row shape.
 *
 * ROW ORDER IS LOAD-BEARING IN ONE PLACE AND ONE ONLY: row 0 must be a painted
 * section, because `harness.instanceColourPalette()` reads row `base` of each
 * group and treats it as the vehicle's paint.
 */
function loftBody(T) {
  /**
   * secLen is derived NET OF THE SEAMS, so the painted sections stay exactly
   * equal — §7.5's biasSpread is zero by construction, not by rounding — and
   * the walk below tiles [-len/2, +len/2] exactly. Both halves of that claim
   * are asserted where they are cheapest: the tiling at the end of the walk,
   * the seam count against SEAMS_PER_VEHICLE (a type with a different count
   * would silently change BOXES_PER_VEHICLE for the whole fleet).
   */
  if (T.seams.length !== SEAMS_PER_VEHICLE) {
    throw new Error(`${T.name}: ${T.seams.length} seams against SEAMS_PER_VEHICLE ${SEAMS_PER_VEHICLE}`);
  }
  const secLen = (T.len - SEAMS_PER_VEHICLE * SEAM_LEN) / SECTIONS;
  const archRise = (a) => {
    let r = 0;
    for (const w of T.wheels) {
      const half = ARCH_HALF * w[2];
      const u = (a - w[0]) / half;
      if (Math.abs(u) < 1) r = Math.max(r, ARCH_RISE * w[2] * (1 - u * u));
    }
    return r;
  };
  const boxes = [];
  /**
   * Per-row grime strength and albedo scale, parallel to `boxes`. Grime is the
   * per-instance half of the session-9 term (the per-vertex half is baked into
   * the shared section geometry): painted sections carry the vehicle's own
   * condition at full weight, seam rows are written OVER 1 so the clamp in the
   * vertex shader saturates their floor dark whatever the condition, the glaze
   * takes half (road film on glass collects at the seal line, not across the
   * pane), and the sill takes none — its 0.012 reflectance IS an occlusion
   * stand-in and grime on it would double-count the darkness it models.
   * Albedo scale is CPU-side: a seam's floor is the paint at 0.55, which is
   * what makes the shut line read as a line at every angle the recess does not.
   */
  const rowGrime = [];
  const rowAlbScale = [];
  const seamAlong = [];
  const secSpan = [];
  let archMax = T.floorY;
  let noseTop = 0;
  let noseBottom = 0;
  let tailTop = 0;
  let tailBottom = 0;
  let cursor = T.len / 2;
  for (let i = 0; i < SECTIONS; i++) {
    const along = cursor - secLen / 2;
    const bottom = T.floorY + archRise(along);
    const top = T.top[i];
    if (archMax < bottom) archMax = bottom;
    if (i === 0) { noseTop = top; noseBottom = bottom; }
    if (i === SECTIONS - 1) { tailTop = top; tailBottom = bottom; }
    boxes.push([secLen, top - bottom, T.wide * T.plan[i], (top + bottom) / 2, null, T.rough, along]);
    rowGrime.push(1.0);
    rowAlbScale.push(1.0);
    secSpan.push([cursor - secLen, cursor]);
    cursor -= secLen;
    if (T.seams.includes(i) && i < SECTIONS - 1) {
      const sa = cursor - SEAM_LEN / 2;
      const sp = Math.min(T.plan[i], T.plan[i + 1]) * SEAM_INSET;
      const st = Math.min(T.top[i], T.top[i + 1]) - SEAM_DROP;
      const sb = T.floorY + archRise(sa);
      boxes.push([SEAM_LEN, st - sb, T.wide * sp, (st + sb) / 2, null, 0.70, sa]);
      rowGrime.push(1.6);
      rowAlbScale.push(0.55);
      seamAlong.push(sa);
      cursor -= SEAM_LEN;
    }
  }
  if (Math.abs(cursor + T.len / 2) > 1e-9) {
    throw new Error(`${T.name}: section walk ends at ${cursor.toFixed(6)}, not -len/2 — the tiling is broken`);
  }
  const [ga, gl, gt, gb, gw] = T.glaze;
  /**
   * GLAZE ROUGHNESS 0.60, NOT GLASS-SMOOTH, AND IT IS THE `SILL` ARGUMENT ONE
   * LEVEL UP. The session-8 band is a RECESS — a visor slit under the roof
   * edge, which on a real vehicle sits in the shadow of its own overhang. A
   * box hull carries no self-shadowing between a body's own parts, so at noon
   * a roughness-0.08 band simply MIRRORS THE SKY: measured on the first
   * session-8 frame, the recess read as a bright chrome stripe along the
   * beltline — the exact opposite of a recess. So the roughness stands in for
   * the occlusion the geometry cannot resolve, the same way `SILL`'s
   * reflectance stands in for the underbody shadow: at 0.60 the sky specular
   * spreads to nothing, the 0.021 albedo carries, and the band reads dark
   * from every angle that matters.
   */
  boxes.push([gl, gt - gb, T.wide * gw, (gt + gb) / 2, GLASS, 0.60, ga]);
  rowGrime.push(0.5);
  rowAlbScale.push(1.0);
  // The sill's top is the highest arch crown plus a 0.02 m lap, so the arches
  // open onto it and the flank hides it everywhere else. Its length stops one
  // half-section short of each end, which is where the nose and tail sections
  // have drawn in past it anyway.
  /**
   * THE SILL'S HALF-WIDTH IS DERIVED FROM THE NARROWEST SECTION IT RUNS UNDER,
   * AND THE FIRST VERSION OF THIS SESSION'S LOFT AUTHORED IT AS A FRACTION OF
   * `wide`. THAT VERSION WAS WRONG AND THE FRAME SHOWED IT.
   *
   * `SILL` is a reflectance standing in for an occlusion (see the constant), so
   * it only reads as a shadow while it is INSET behind the flank. A constant
   * 0.84 of the body's maximum width is inset under the doors and PROUD under
   * the nose the moment the plan tapers: measured on the first wedge built this
   * way, the sill's half-width was 0.823 m where the nose section's was 0.588 m,
   * so 0.235 m of dark box stuck out sideways past the bodywork over the outer
   * 0.20 m of the car — 18 px at 20 m, and visible in the first close shot
   * taken of it. That is CONTRACT §9.1's authored-and-drawn-inside-something-
   * else with the sign flipped, which is the same class of mistake and no
   * easier to see in a number.
   *
   * So it is the minimum over the sections, times 0.94 for the antialiased edge
   * and for the tumblehome that pulls the flank in above the shoulder. It runs
   * the full length under the arches on purpose — an arch that opened onto
   * daylight instead of onto the sill would be a hole in the car.
   *
   * The `sillW` column the table still carried after this derivation replaced
   * it was read by nothing — §9.1's config-the-code-does-not-read, in the very
   * table whose comments cite that rule — and was deleted in session 8.
   */
  let narrowest = Infinity;
  for (const f of T.plan) narrowest = Math.min(narrowest, f);
  const sillHalf = 0.94 * (T.wide * narrowest) / 2;
  const sillTop = archMax + 0.02;
  boxes.push([T.len - secLen, sillTop - T.sillY, sillHalf * 2, (sillTop + T.sillY) / 2, SILL, 0.70, 0]);
  rowGrime.push(0.0);
  rowAlbScale.push(1.0);

  /**
   * THE LAMPS RIDE THE LOFT. §9 rule 4: a lamp height authored beside a body
   * height is two numbers that drift, and session 6b's own note records both
   * lamps of this fleet hanging in the air over a wheel. These come off the end
   * sections' own edges, 0.60 of the way up the face they are mounted on, and
   * stand 0.02 m proud of the nose and tail so their emissive face is outside
   * the body rather than inside it.
   */
  const lampLen = 0.10;
  const frontAlong = T.len / 2 + 0.02 - lampLen / 2;
  const rearAlong = -(T.len / 2 + 0.02 - lampLen / 2);
  const frontY = noseBottom + 0.60 * (noseTop - noseBottom);
  const rearY = tailBottom + 0.60 * (tailTop - tailBottom);
  const frontW = T.wide * T.plan[0];
  const rearW = T.wide * T.plan[SECTIONS - 1];

  /**
   * THE SIGNATURE, EXPANDED AGAINST THIS TYPE'S OWN END FACES — SESSION 29.
   *
   * A row is `[len, height, width, along, y, kind, lat]`. Every unit's width and
   * lateral offset are FRACTIONS OF THE END SECTION'S OWN WIDTH, so a 0.64 m
   * motorcycle tail and a 2.55 m bus tail get the same proportion rather than the
   * same metres — the identical argument the section chamfers are authored under.
   * The heights and the along positions are the loft's, unchanged, so §9 rule 4's
   * "a lamp height authored beside a body height is two numbers that drift" still
   * holds: nothing here is authored, all of it is derived from the finished
   * sections.
   *
   * Padded to LIGHTS_PER_VEHICLE with nulls. The emitter parks a null row, which
   * is the mechanism the hauler's missing third row has used since session 6b.
   */
  const sigLights = SIGNATURES.map((sig) => {
    const rows = [];
    for (const u of sig.front) {
      rows.push([lampLen, u.h, frontW * u.w, frontAlong, frontY + (u.dy || 0), 0, frontW * (u.lat || 0)]);
    }
    for (const u of sig.rear) {
      rows.push([lampLen, u.h, rearW * u.w, rearAlong, rearY + (u.dy || 0), 1, rearW * (u.lat || 0)]);
    }
    while (rows.length < LIGHTS_PER_VEHICLE - 2) rows.push(null);
    rows.push(T.marker ? [...T.marker, 0] : null);
    rows.push(T.interior ? [...T.interior, 0] : null);
    if (rows.length !== LIGHTS_PER_VEHICLE) {
      throw new Error(`${T.name}/${sig.name}: ${rows.length} light rows against LIGHTS_PER_VEHICLE ${LIGHTS_PER_VEHICLE}`);
    }
    return rows;
  });
  /**
   * Which signatures this type may wear. A class constrains it — the brief's own
   * requirement — and the constraint is a property of what the vehicle IS:
   *
   *   moto        ONE unit at each end. A motorcycle has one headlamp; a
   *               separated pair on a 0.64 m fairing is two lamps 0.21 m apart,
   *               which reads as a fault rather than as a style.
   *   bus/lorry/  DISCRETE CLUSTERS ONLY (bar or pair). A goods or passenger
   *   hauler      vehicle's lamps are type-approved units in a housing, not a
   *               styling light-line; the full-width bar and the outboard pair
   *               are both real and the two styling signatures are not.
   *   the rest    all four.
   */
  const sigAllowed = T.name === 'moto' ? [3]
    : (T.name === 'bus' || T.name === 'lorry' || T.name === 'hauler') ? [0, 1]
      : [0, 1, 2, 3];
  const lights = sigLights[sigAllowed[0]];

  /**
   * `min` is the smallest overall body dimension and is what CONTRACT §5.12's
   * motion threshold is evaluated against. COMPUTED here rather than authored,
   * which closes a hole: it used to be a hand-written field that nothing
   * compared to the geometry, so a body change could move the real extent and
   * leave the suppression distance quietly wrong. `stats().minExtentM` computes
   * the same quantity a second time from the finished rows and `perfcheck`
   * asserts THAT against `budget.json` -> `motionVectors.kindMinExtentM`, so the
   * budget still faces a number taken off the delivered boxes.
   */
  let lenHalf = 0;
  let wideHalf = 0;
  let high = 0;
  for (const b of boxes) {
    lenHalf = Math.max(lenHalf, Math.abs(b[6]) + b[0] / 2);
    wideHalf = Math.max(wideHalf, b[2] / 2);
    high = Math.max(high, b[3] + b[1] / 2);
  }
  for (const w of T.wheels) {
    lenHalf = Math.max(lenHalf, Math.abs(w[0]) + w[2] / 2);
    wideHalf = Math.max(wideHalf, Math.abs(w[1]) + w[3] / 2);
    high = Math.max(high, w[2]);
  }
  const min = +Math.min(lenHalf * 2, wideHalf * 2, high).toFixed(2);

  /**
   * The §7.5 probe height and the tightest margin any SAMPLED section's top has
   * over it. `silhouettes.trim` discards the outermost 10% of the length —
   * which at TWELVE sections excluded the end sections entirely, and at SEVEN
   * no longer does: a 0.76 m nose section pokes 0.2 m into the sampled window,
   * so section 0's top is now bound by the probe too (the van's nose deck rose
   * 1.02 -> 1.18 m for exactly this). The loop therefore tests every section
   * that INTERSECTS the trimmed window instead of assuming the ends are free.
   * Printed at boot beside the height it is a margin on, because it is the
   * bound the `top` curves are shaped against and a later retune that crossed
   * it would silently drop the nose stations — which is exactly where the
   * taper the assertion reads lives.
   */
  const probeH = high * 0.50;
  const sampled0 = -(lenHalf) * 0.8;
  const sampled1 = lenHalf * 0.8;
  let straddle = Infinity;
  for (let i = 0; i < SECTIONS; i++) {
    const [s0, s1] = secSpan[i];
    if (s1 < sampled0 || s0 > sampled1) continue;
    straddle = Math.min(straddle, T.top[i] - probeH);
  }

  return {
    name: T.name, min, len: T.len, wide: T.wide, speed: T.speed, weight: T.weight,
    boxes, wheels: T.wheels, lights, sigLights, sigAllowed,
    rowGrime, rowAlbScale,
    _probeH: probeH,
    _straddle: straddle,
    _secLen: secLen,
    _sillTop: sillTop,
    _seamAlong: seamAlong,
  };
}

const BODY_TYPES = LOFT.map(loftBody);

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DOES A LANDMARK'S GROUND REACH THIS BODY — SESSION 35, AND IT IS THE SAME
 * CORRECTION `CAMERA_CLEARANCE` ALREADY CARRIES SIX HUNDRED LINES DOWN.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Session 34 gave `seed` and the recycler a landmark test and the test is
 * `landmarkOccupies(pos.x, pos.z)` — the vehicle's ORIGIN. A body is up to
 * 12.00 m long, so half of it can stand inside a claim while its origin stands
 * outside, and `tools/landmarkcensus.mjs --sim=90` measured exactly that: two
 * body boxes and two wheels at **x = −195 and −196 against the weir's own
 * x1 = −195**, on the street at z = 256, with the origin a metre or two clear.
 *
 * That is CONTRACT §9 rule 7 — a right number measured from the wrong place —
 * and this file already records the same finding about the same function's
 * neighbour: *"MEASURED FROM THE BODY, NOT FROM THE ORIGIN — SESSION 29, AND
 * THE CONSTANT'S OWN DERIVATION ALREADY SAID SO."*
 *
 * THREE POINTS AND NOT A PAD. `landmarkOccupies` takes a pad, and passing half
 * the body length would be one call — but the pad is applied to BOTH axes, so
 * a 12.00 m bus would keep 6.00 m clear ACROSS its lane as well as along it,
 * which refuses 4.7 m of road either side of every landmark for a reason that
 * has nothing to do with the landmark. Nose, tail and centre are exact for an
 * axis-aligned body against an axis-aligned claim wherever the claim is longer
 * than half the body — the smallest landmark ground claim in the project is the
 * mast's 9.0 m against a 6.00 m half-bus, so it holds for all eight.
 *
 * MID-TURN IS THE ONE CASE IT IS APPROXIMATE FOR, and it is approximate in the
 * lenient direction: a turning body is at up to 45° to its lane, so the nose is
 * `half·cos θ` along instead of `half`. The recycler exempts turning vehicles
 * anyway (`if (veh.turn) continue`), so nothing is lost that was there.
 */
/**
 * ONE FOOTWAY BEYOND THE NOSE — SESSION 52, AND IT IS THE TRAFFIC HALF OF THE
 * STREET END.
 *
 * `citygen.js`'s `streetEnd` turns the last `CITY.sidewalkWidth` of a cut
 * carriageway into a footway with a kerb across it, which is what a street
 * end is. The road therefore now STOPS one footway short of whatever refused
 * it — and these three points did not know that, so a vehicle drove the last
 * 4.2 m of every dead end **on the pavement** before its nose reached the
 * claim and recycled it. Measured off `worldSurfaceAt` on the driving lanes
 * themselves, ±512 m, 1 m steps, against exactly the three tests the recycle
 * pass makes: **28 stretches, 202 m, 0.55% of the driven lane length, and
 * every one of them `walk`.**
 *
 * SO THE REACH IS `half + CITY.sidewalkWidth` AND NOT A PAD, for the reason
 * the paragraph above already gives: a pad applies to BOTH axes and would
 * refuse 4.2 m of road across every lane as well as along it. This extends the
 * two probe points ALONG the body's own axis and touches nothing across it.
 * The blocker and the footway coincide by construction — the road is clipped
 * against the same claim `landmarkOccupies` tests, and the footway is the
 * 4.2 m immediately inside that clip — so a nose stopped here is a nose
 * stopped at the kerb.
 *
 * SYMMETRIC, WHICH IS CONSERVATIVE AND NOT EXACT. The pair is ±, so a vehicle
 * is refused one footway early on approach and one footway late on departure.
 * Nothing departs a dead end it was never allowed into, and the recycler's
 * whole job is refusing a body that has stopped being somewhere a vehicle can
 * be — so the lenient half of the symmetry is unreachable and the strict half
 * is the one that was owed.
 */
const BODY_REACH_M = CITY.sidewalkWidth;

function landmarkUnderBody(x, z, axis, type) {
  const half = BODY_TYPES[type].len * 0.5 + BODY_REACH_M;
  const ax = axis === 0 ? half : 0;
  const az = axis === 0 ? 0 : half;
  return landmarkOccupies(x, z)
    || landmarkOccupies(x + ax, z + az)
    || landmarkOccupies(x - ax, z - az);
}

/**
 * THE ORIGIN BLOCK'S KEEP-OUT, UNDER THE SAME BODY — SESSION 51.
 *
 * The third sentence in this file's refusal set and the only one that was
 * missing: `riverNoRoad` refuses a lane the water took (session 15),
 * `landmarkUnderBody` one a landmark took (session 34), and nothing has ever
 * refused one `BLOCK_KEEPOUT` took. See `blockNoRoad` in `citygen.js` for the
 * measurement — two lattice lines, about 76 m each, driven since session 4b.
 *
 * NOSE, CENTRE AND TAIL, exactly as the landmark test does, and for the reason
 * `landmarkOccupies` writes down: a 12 m bus whose origin is a metre outside a
 * boundary has five metres of itself inside it.
 */
function blockUnderBody(x, z, axis, type) {
  // `BODY_REACH_M` — session 52, the street end. See `landmarkUnderBody`.
  const half = BODY_TYPES[type].len * 0.5 + BODY_REACH_M;
  const ax = axis === 0 ? half : 0;
  const az = axis === 0 ? 0 : half;
  return blockNoRoad(x, z)
    || blockNoRoad(x + ax, z + az)
    || blockNoRoad(x - ax, z - az);
}

/**
 * Boxes, wheels and light quads per vehicle. Fixed, so the census is fixed.
 *
 * TWELVE BOXES SINCE SESSION 9, DOWN from fourteen, and the cost is stated
 * where the number is because that is what the previous three revisions of
 * this comment did and it is why the ceiling arithmetic is still checkable.
 * `SECTIONS` painted sections plus `SEAMS_PER_VEHICLE` seam rows plus one
 * glazing box plus one sill = 12 rows of a mesh that was already being drawn:
 *
 *   triangles   160 vehicles x 12 rows x 28 = 53 760, against 160 x 14 x 28 =
 *               62 720 in sessions 7c-8. THE MERGE FREES 8 960 net of the
 *               320 seam rows it adds, which is what the brief required of it.
 *   draw calls  ZERO change. Same three meshes.
 *   instances   160 x 2 = 320 FEWER rows; `floors.visibleInstances` 115 000
 *               had 8 139 of margin at the worst route's 123 139, and this
 *               spends 320 of it. Stated because a floor approached is a
 *               floor somebody later trips.
 *   memory      the §5.12 previous-transform double buffer is
 *               1 920 x 64 B x 2 = 240.0 KiB against 286.7 KiB.
 */
const BOXES_PER_VEHICLE = SECTIONS + SEAMS_PER_VEHICLE + 2;
const WHEELS_PER_VEHICLE = 4;

/**
 * THE PAINT PALETTE, AND WHY THE OLD ONE DELIVERED TWO COLOURS FROM SIX.
 *
 * The old table was six near-neutral greys spanning reflectance 0.029 to 0.122.
 * MEASURED with `harness.instanceColourPalette()` beside the frame: six written
 * colours collapsed to FOUR distinguishable chromaticities at the 0.02
 * threshold before they were ever rendered, and the delivered frame carried
 * TWO across thirteen vehicles. Both numbers printed side by side is CONTRACT
 * §9 rule 2, and the pair says which half is broken: the attribute arrives at
 * `diffuseColor` — a dead one would have delivered 1 — and the palette was too
 * narrow to survive its own illuminant.
 *
 * WHY AN ILLUMINANT NARROWS A PALETTE. Delivered radiance is rho * E plus an
 * additive ambient and the §5.5 veiling glare, and an ADDITIVE term pulls every
 * chromaticity toward its own. Two paints separated by 0.021 in reflectance
 * chromaticity — which the old table's closest surviving pair was — land inside
 * 0.02 of each other once the sky's contribution is added to both. A palette
 * has to be separated by more than the threshold IN REFLECTANCE to be separated
 * by the threshold IN THE FRAME, and how much more is a property of the
 * lighting rather than of the paint.
 *
 * SO THE SPREAD IS BUILT FROM CHROMATICITY AND NOT FROM TASTE. Each entry's
 * (r, b) chromaticity is written beside it. **The closest CHROMATIC pair is
 * teal and pale blue at 0.0608, which is 3.04x the threshold and leaves room
 * for the illuminant to close some of it.** (The second-tightest is oxide red
 * and livery red at 0.0983, and an earlier draft of this sentence quoted that
 * one as though it were the minimum.) The sentence here used to say "the closest pair is
 * 0.088", full stop, and measured over the whole table that was false by an
 * order of magnitude: the ten tightest pairs in the table are all
 * neutral-on-neutral, from off-white/white at **0.0022** to graphite/off-white
 * at 0.0194, and the pair the old sentence would have been about — graphite
 * and silver — sits at **0.0082**, which is 0.41x the threshold. They are
 * meant to. **FIVE of these entries are NEUTRALS** — graphite, mid grey,
 * silver, off-white and white — and a neutral is defined by having no
 * chromaticity to separate — what separates
 * them is LUMINANCE, and stating a chromaticity floor over a set that contains
 * neutrals is CONTRACT §9.1's comment-that-claims-a-property. Corrected in
 * session 30 by measuring it, and the floor is now stated over the pairs it
 * can apply to.
 *
 * ---------------------------------------------------------------------------
 * SESSION 30: THE LADDER, AND THE MEASUREMENT THAT SAID THE SPREAD WAS NOT
 * WHERE THE COMMENT ABOVE SAID IT WAS.
 *
 * The brief for this session said paint "has never been touched" and that the
 * fleet reads near-black. **The first half is wrong and the second is right,
 * and the reason they are both true at once is the whole of this section.**
 * Session 9 built the table above and it already carried silver at Rec.709
 * luminance 0.318 and off-white at 0.465. What it did not carry was a
 * DISTRIBUTION. Measured on the delivered eight:
 *
 *   luminance ladder   0.047 0.048 0.053 0.054 0.062 | 0.123 0.318 0.465
 *
 * FIVE OF EIGHT inside 0.047-0.062 — a 1.32x band at the very bottom — and
 * `bodyAlbedo` walked the table at a fixed stride, so each entry was drawn
 * equally often and **62.5% of a 160-vehicle fleet was inside that band**. A
 * night carriageway in this project's own delivered frame sits at 0.05-0.10.
 * So five eighths of the traffic was painted the colour of the road it stood
 * on, and no count of colours could see it, which is CONTRACT §7.2 with a
 * palette instead of a body type.
 *
 * The repair is a LADDER — thirteen entries from 0.047 to 0.698, which is
 * log2(0.6977/0.0469) = **3.90 stops over twelve gaps, i.e. 0.325 of a stop a
 * rung**; the first draft of this sentence said "roughly every half-stop",
 * which over thirteen entries would have spanned six stops rather than 3.9 —
 * and a WEIGHTED draw per class, so the shape of the distribution is a
 * decision rather than a side effect of a stride.
 *
 *   0.047 deep blue   0.048 oxide red  0.053 graphite   0.054 teal
 *   0.062 olive       0.095 livery red 0.124 sand       0.148 pale blue
 *   0.177 mid grey    0.318 silver     0.421 cream      0.465 off-white
 *   0.698 white
 *
 * 0.698 IS DERIVED AND NOT PICKED. Automotive white is about 0.75-0.85 total
 * reflectance in the visible; at 0.70 linear albedo this table's white sits
 * just under the bottom of that range, which is where a panel that has been
 * outdoors for a decade sits. It is 14.9x the darkest entry and 1.50x the
 * off-white it stands above, and it is the first body colour in this project
 * lighter than a lit pavement.
 *
 * AND IT COSTS NOTHING FROM THE SATURATION RESERVE, which is the check that had
 * to be done before adding colour to 160 objects. `tools/city-budget.json` ->
 * saturation measures pixels that are saturated AND bright — `valueThreshold`
 * 0.5 on the encoded frame — on `night_rain`, and the whole point of that
 * threshold is that a chromatic surface which does not GLOW is not spending the
 * reserve. The BRIGHTEST paint in this table, white at Rec.709 reflectance
 * 0.698, under `LIGHT.streetAverageLux` = 16 lx delivers rho*E/pi =
 * **3.56 cd/m2** and is nowhere near HSV value 0.5 in a frame metered for
 * neon; deep blue at 0.047 delivers 0.24. (The figure here was "deep blue at
 * reflectance 0.115" for twenty-one sessions and matches no reading of that
 * entry's albedo [0.030, 0.046, 0.105] — max channel 0.105, luminance 0.047,
 * mean 0.060. Session 30 replaced it with the case that actually bounds the
 * argument, which is the brightest entry rather than a middling one.) The two
 * saturated things on a vehicle at night are its tail bar and its brake bar,
 * both of which were already budgeted at 0.26 points in session 4b and neither
 * of which is paint.
 */
const PAINT = [
  /** graphite      (0.325, 0.344)  lum 0.0529 — the neutral, and half a fleet is neutral */
  { name: 'graphite', albedo: [0.052, 0.053, 0.055] },
  /** silver        (0.330, 0.337)  lum 0.3177 — bright neutral, and until session
   *  30 the only body value lighter than the road. */
  { name: 'silver', albedo: [0.315, 0.318, 0.322] },
  /** deep blue     (0.166, 0.580)  lum 0.0469 */
  { name: 'deep blue', albedo: [0.030, 0.046, 0.105] },
  /** oxide red     (0.644, 0.184)  lum 0.0476 */
  { name: 'oxide red', albedo: [0.112, 0.030, 0.032] },
  /** olive         (0.243, 0.270)  lum 0.0620 */
  { name: 'olive', albedo: [0.036, 0.072, 0.040] },
  /** sand          (0.429, 0.220)  lum 0.1235 */
  { name: 'sand', albedo: [0.148, 0.121, 0.076] },
  /** teal          (0.195, 0.451)  lum 0.0536 */
  { name: 'teal', albedo: [0.032, 0.058, 0.074] },
  /** off-white     (0.338, 0.329)  lum 0.4648 — a white van is a white van in every era */
  { name: 'off-white', albedo: [0.470, 0.464, 0.458] },

  /* ---- session 30, the five rungs the ladder was missing ---------------- */

  /** white         (0.336, 0.330)  lum 0.6977 — the top of the ladder. See the
   *  header for why 0.70 linear and not 0.85. */
  { name: 'white', albedo: [0.700, 0.698, 0.688] },
  /** cream         (0.378, 0.274)  lum 0.4209 — warm white. A delivery livery,
   *  and the one light colour that is not a neutral, so the light end of the
   *  fleet is not three greys. */
  { name: 'cream', albedo: [0.455, 0.420, 0.330] },
  /** mid grey      (0.328, 0.340)  lum 0.1769 — the rung between silver and
   *  graphite that was a factor of six of empty ladder. */
  { name: 'mid grey', albedo: [0.175, 0.177, 0.181] },
  /** pale blue     (0.253, 0.432)  lum 0.1476 — deep blue's rung 3.1x up, and
   *  0.172 away from it in chromaticity, so the two do not read as one colour
   *  at two brightnesses. Its closest neighbour is teal at 0.0608, which is
   *  this table's tightest chromatic pair and the number the header quotes. */
  { name: 'pale blue', albedo: [0.120, 0.150, 0.205] },
  /** livery red    (0.724, 0.128)  lum 0.0947 — a BUS red: 1.99x oxide red's
   *  luminance and 0.0983 from it in chromaticity, so an operator's livery and
   *  a rusting flank are two colours rather than one at two exposures. */
  { name: 'livery red', albedo: [0.255, 0.052, 0.045] },
];

/**
 * WHICH PAINTS A CLASS WEARS, AND IN WHAT PROPORTION.
 *
 * The brief asked for this and it is the half of item 2 that did not exist:
 * `bodyAlbedo` walked one table at a fixed stride for every body type, so a
 * bus, a skip lorry and a motorcycle drew from the same distribution.
 *
 * THE CAR ROW IS DERIVED FROM THE REAL AUTOMOTIVE COLOUR CENSUS rather than
 * chosen, so the next session can disagree with the source instead of with the
 * taste (§9 rule 5). European new-car colour share runs roughly white 27%,
 * black 22%, grey 22%, silver 8%, blue 10%, red 5%, other 6%. Mapped onto this
 * ladder — white+off-white+cream 0.30 (census 27), graphite 0.20 (22), mid
 * grey 0.14 + silver 0.10 (grey 22 + silver 8 = 30), pale blue+deep blue 0.11
 * (10), the two reds 0.06 (5), olive+teal+sand 0.09 (other 6) — which
 * reproduces white, black, blue and red inside three points and is **six
 * points short on grey-plus-silver**, spent on the three chromatic entries
 * this fleet needs for §7.2's cluster floor. Stated rather than rounded away.
 *
 * THE OTHER ROWS ARE STATEMENTS ABOUT WHAT THE VEHICLE IS, which is what the
 * brief asked for and is also why they are not derived from the same census:
 * a census of CARS says nothing about a bus.
 *
 *   van, lorry, hauler   a commercial body is bought white and is signwritten
 *                        afterwards, so the light end (white, off-white, cream,
 *                        silver) carries **0.78 / 0.68 / 0.70** of those three
 *                        rows respectively — the first draft said "two thirds
 *                        of each", which is true of none of them
 *   bus                  A LIVERY IS NOT A COLOUR CHOICE. Three entries, one
 *                        dominant, because an operator paints a fleet and not
 *                        a vehicle — and the same argument session 29 used to
 *                        give buses discrete lamp clusters rather than a
 *                        styling light-line
 *   moto                 no commercial whites; a fairing is either dark or it
 *                        is a colour
 *
 * A NAME THAT IS NOT IN `PAINT` THROWS AT MODULE LOAD, the arrangement
 * `occupancy.js` uses for its conflict table: a weight on a paint nobody has
 * is §9.1's config-the-code-does-not-read, and this file is not the place for
 * one. Each row is normalised at load, so the numbers can be read as shares
 * whatever they sum to.
 */
const PAINT_WEIGHTS = {
  wedge: { white: 0.15, 'off-white': 0.12, cream: 0.03, silver: 0.10, 'mid grey': 0.14,
    'pale blue': 0.05, sand: 0.03, 'livery red': 0.01, olive: 0.03, teal: 0.03,
    graphite: 0.20, 'oxide red': 0.05, 'deep blue': 0.06 },
  pod: { white: 0.15, 'off-white': 0.12, cream: 0.03, silver: 0.10, 'mid grey': 0.14,
    'pale blue': 0.05, sand: 0.03, 'livery red': 0.01, olive: 0.03, teal: 0.03,
    graphite: 0.20, 'oxide red': 0.05, 'deep blue': 0.06 },
  van: { white: 0.34, 'off-white': 0.22, cream: 0.10, silver: 0.12, 'mid grey': 0.08,
    'pale blue': 0.04, 'livery red': 0.04, graphite: 0.06 },
  lorry: { white: 0.30, 'off-white': 0.18, cream: 0.10, silver: 0.10, 'mid grey': 0.08,
    'livery red': 0.08, 'pale blue': 0.05, sand: 0.05, graphite: 0.06 },
  hauler: { white: 0.28, 'off-white': 0.20, silver: 0.14, cream: 0.08, 'mid grey': 0.10,
    'livery red': 0.06, 'deep blue': 0.06, graphite: 0.08 },
  bus: { 'livery red': 0.55, cream: 0.25, white: 0.20 },
  moto: { graphite: 0.26, 'oxide red': 0.16, 'deep blue': 0.14, teal: 0.10, silver: 0.12,
    white: 0.10, 'livery red': 0.08, olive: 0.04 },
};

/**
 * The weights above as a cumulative table per body type, built once at load.
 * Throws HERE on an unknown paint name or a body type with no row, rather than
 * silently drawing graphite forever.
 */
const PAINT_INDEX = new Map(PAINT.map((p, i) => [p.name, i]));
function buildPaintTable(typeName) {
  const row = PAINT_WEIGHTS[typeName];
  if (!row) throw new Error(`traffic: no PAINT_WEIGHTS row for body type '${typeName}'`);
  const entries = Object.entries(row).map(([name, w]) => {
    const idx = PAINT_INDEX.get(name);
    if (idx === undefined) throw new Error(`traffic: PAINT_WEIGHTS.${typeName} names unknown paint '${name}'`);
    return [idx, w];
  });
  const total = entries.reduce((a, e) => a + e[1], 0);
  let acc = 0;
  return entries.map(([idx, w]) => { acc += w / total; return [idx, acc]; });
}

/**
 * EMISSIVE NITS FOR THE LIGHT LINES.
 *
 * Luminance, not intensity, because these are surfaces: nits = candela divided
 * by the emitting area.
 *
 *   tail   60 cd over a 1.8 x 0.06 m bar = 0.108 m^2  ->    555 cd/m^2
 *   brake  4x the tail, which is the ECE ratio        ->   2220 cd/m^2
 *   front  a daytime running line, 400 cd over 0.09   ->   4400 cd/m^2
 *
 * All three sit between the block's lit window (220) and its neon tube (6500),
 * which is the range this project's emitters are authored into. `block.js` says
 * why they are authored low: against a night street metering under 1 cd/m^2 a
 * physically-correct emitter clips to white and ACES takes the colour with it.
 *
 * The material carries the MAXIMUM as `emissiveIntensity` and each instance
 * scales it down through `instanceColor`, which the §5.6 injection multiplies
 * into `totalEmissiveRadiance`. So the chromaticity is applied exactly once,
 * in the instance colour, and `material.emissive` is white — (1,1,1) has
 * Rec.709 luminance 1 by construction, so the nits number stays honest.
 */
/**
 * EMISSIVE NITS FOR THE LIGHT LINES, ON THIS PROJECT'S AUTHORED SCALE AND NOT
 * ON THE PHYSICAL ONE. THE FIRST VERSION USED THE PHYSICAL ONE AND IT COST THE
 * SATURATION RESERVE.
 *
 * The physical numbers are easy and they are what shipped first: a tail lamp is
 * about 60 cd over a 1.8 x 0.06 m bar, so 555 cd/m2; a brake lamp is four times
 * that at 2220. Both are right about a real vehicle and both are far outside
 * the range this renderer is authored in. `block.js` states the reason above
 * its own table and it is worth quoting because it predicted this exactly:
 *
 *   "a real lit window seen from the street runs 20-200 cd/m2 and a bare neon
 *    tube runs several thousand. Against a night street metering at well under
 *    1 cd/m2, physically-correct emitters clip to white and ACES takes the
 *    colour with them."
 *
 *   "The tube clips to white and blooms; the plate behind it is what carries
 *    the colour. Sign colour that lives only in a clipped emitter is sign
 *    colour ACES takes away - a saturated glow needs an area that sits below
 *    white, not a brighter core."
 *
 * The block's brightest authored emitter is `neonTube` at 230 nits and its lamp
 * bowl is 210. A 2220 nit brake bar is ten times a neon tube, and MEASURED: the
 * night route's saturated-and-bright peak went to 16.01% against the 12%
 * reserve, and the peak sample is one hauler's rear bar five metres from the
 * lens whose red bloom covers a third of the frame. Not the bar - the bloom.
 * The bar's own area at 5 m is 0.28% of the frame; the clipped core spread the
 * rest.
 *
 * So these are authored into the same range as everything else that glows here,
 * with the ECE ratios kept:
 *
 *   tail   45   between signPlate 38 and the windows; a rear position lamp
 *   brake  180  4x tail, which is the regulation ratio, just under neonTube 230
 *   front  70   the night POSITION lamp, white, so it reads brighter than it is
 *   marker 22   interior glow, the same order as a lit window at 21
 *
 * A LINE IS NOT A LAMP AND THAT IS THE OTHER HALF OF IT. The whole point of the
 * signature is that the emitting AREA is about ten times a real lamp's lens, so
 * holding the per-area nits at lamp values multiplies the total intensity by
 * ten. The authored numbers put the bar's total back where a lamp's is.
 */
const NITS_TAIL = 45;
const NITS_BRAKE = 180;
const NITS_FRONT = 70;

/**
 * The DAYTIME running lamp, and it stays high because daylight is high.
 *
 * A DRL's job is conspicuity against a sunlit road and the exposure at noon is
 * some thirteen stops from the exposure at midnight, so a number that clips at
 * midnight does not even register at noon. `lighting.photocellOn` chooses -
 * the same switch every street lamp in the city already runs on, so a vehicle
 * and a lamp post can never disagree about whether it is night (CONTRACT §3).
 */
const NITS_FRONT_DAY = 900;
const NITS_MARKER = 22;
/**
 * THE LIT BUS SALOON, SEEN FROM OUTSIDE THROUGH THE GLAZING. cd/m², session 29.
 *
 * Derived rather than chosen, because §9 rule 5 says a number without a
 * derivation is a guess and this one is the subject of an experiment. What a
 * window band delivers is the AREA AVERAGE of what is behind it, and there are
 * two populations behind a bus window:
 *
 *   THE SURFACES — seat backs, the opposite glazing, standing passengers. A bus
 *     saloon is lit to about 150 lx (BS EN 13272's band for urban service is
 *     100-150), and at a reflectance of 0.40 that is E·rho/pi = 150 x 0.40 /
 *     3.1416 = 19.1 cd/m².
 *   THE LUMINAIRES — the ceiling diffuser run, visible directly along the top of
 *     the aperture, about 8% of it at roughly 1 750 cd/m² = 140 cd/m².
 *
 *   19.1 + 140 = 159.1  ->  160 cd/m²
 *
 * CHECKED AGAINST THE ONE NEIGHBOUR THAT MATTERS: `LIGHT.windowNits` = 220 is a
 * lit building window. 160 / 220 = 0.73, so a bus interior is a little dimmer
 * than an office window, which is the right ordering and is the sort of thing
 * that would have been obviously wrong at 900 or at 20.
 */
const NITS_INTERIOR = 160;

/**
 * The material's `emissiveIntensity`, which every instance scales DOWN through
 * `instanceColor`. It has to be the maximum of the four above or the brightest
 * is clipped: the daytime running lamp, at 900.
 */
const NITS_MAX = 900;

/**
 * Headlamp, and the simplification is named rather than hidden.
 *
 * 12 000 cd inside a 20 deg outer cone. At the 25 m where a beam dipped 1.5 deg
 * from 0.65 m meets the road (0.65 / tan 1.5 deg = 24.8 m) that is
 * 12000 / 24.8^2 = 19.5 lux, against the 16 lux the carriageway is held at by
 * LIGHT.streetAverageLux. So the pool is a 1.2x doubling on a lit road, which
 * is what a dipped beam looks like on a lit street, and it is the number this
 * was aimed at.
 *
 * THE COST OF GETTING THAT RIGHT WITH A CONE: 12 000 cd over the 2*pi*(1 -
 * cos 20 deg) = 0.3789 sr of the outer cone is 4547 lm, and a real ECE low beam
 * emits about 1000. The model is 4.5x the physical flux because a cone cannot
 * make a hot spot — a real optic puts 30 000 cd into about two degrees
 * vertically and almost nothing outside it. CONTRACT §5.9's luminaire
 * distribution is the machinery that would fix this (two transverse scales
 * about a named axis is exactly a headlamp), and it is not used here. Written
 * down so the next session can disagree with the model rather than the number.
 *
 * 20 deg rather than the 35 deg the froxel budget was measured at: narrower is
 * strictly cheaper, because the cone bound's sphere is radius/(2 cos theta) and
 * 30/(2 cos 20) = 15.96 m against 30/(2 cos 35) = 18.31 m. STATE.md names a
 * narrower cone as the remedy if the grid ever fails, so shipping inside the
 * measured bound means 4a's margin of 21 is a floor under this rather than an
 * estimate of it.
 */
/**
 * CORRECTED DOWN FROM 12 000 cd, AND IT IS A CORRECTION RATHER THAN A RETREAT.
 *
 * 12 000 cd was chosen to make the beam pool the right CONTRAST — 19.5 lux at
 * the 24.8 m where a dipped beam meets the road, against the 16 lux the
 * carriageway is held at, so a 1.2x doubling. It cost 12 000 x 0.3789 sr =
 * 4547 lm, which is 4.5x what a real ECE low beam emits, and 4.5x the flux is
 * not a modelling choice, it is a wrong number that happened to look right with
 * one vehicle in frame.
 *
 * With a hundred and sixty of them it stopped looking right too. Measured on
 * the look gate: the midnight frame's mean luminance went to 0.1374 against a
 * [0.072, 0.112] band and the roadway's distinct bright regions collapsed from
 * six to one, because overlapping beam pools merge into a single lit road and
 * the assertion that counts streetlamp pools is counting exactly that.
 *
 * So take the flux and accept the contrast. A 1000 lm low beam over the
 * 2*pi*(1 - cos 20 deg) = 0.3789 sr of the outer cone is 2639 cd mean, and a
 * profile that falls from the 7 deg inner cone to the outer one puts about 1.3x
 * the mean on axis: 3400 cd, which is 1288 lm, or 1.29x a real low beam rather
 * than 4.5x. At 24.8 m that is 3400/615 = 5.5 lux, a 35% lift on the ambient
 * instead of a 122% one — which is what a dipped beam on a LIT street actually
 * looks like, and the reason the earlier number felt right is that the frames
 * it was judged in had one vehicle in them and no comparison.
 */
const HEAD_CANDELA = 3400;
const HEAD_OUTER = (20 * Math.PI) / 180;
const HEAD_INNER = (7 * Math.PI) / 180;
/**
 * THE THROW, AND CUTTING IT FROM 30 m IS THE ONLY THING IN THIS SESSION THAT
 * WAS DONE FOR FRAME TIME.
 *
 * 30 m came from `harness.saturateTraffic`'s placeholder, whose own comment says
 * the instrument "measures froxels, not photons". It was never a photometric
 * number and at 3400 cd it is not one: 3400/30^2 = 3.8 lux at 30 m, against the
 * 16 lux the carriageway is held at, is 24% of ambient and invisible.
 *
 * MEASURED, and it is the first time anyone has measured it. Session 4a
 * validated 96 traffic slots against froxel OCCUPANCY and deferred frame time,
 * so the CPU cost of assigning them had never been on a route. Bisected on
 * downtown_dense, 1800 frames: everything on 13.00 ms cpu p95; traffic module
 * off 8.90; traffic on with the headlamp pool set to ZERO and all 160 vehicles,
 * their splines, their instanced geometry and their per-instance motion vectors
 * still running, 8.80. So the vehicles cost nothing measurable and the 96
 * clustered spots cost 4.10 ms, which is 43 microseconds a light a frame in
 * `assign()` — the eight-corner projection and, dominantly, the froxel index
 * writes.
 *
 * The lever is the RADIUS and not the cone angle. The cone bound's sphere is
 * R/(2 cos theta), so it is linear in R and almost flat in theta below 20 deg:
 * 30 m at 20 deg gives 15.96 m, and narrowing to 14 deg only gives 15.46 m.
 * Cutting R to 20 m gives 10.64 m, and the froxel writes go as the cube of it:
 * (10.64/15.96)^3 = 0.296, so about 70% fewer.
 *
 * 20 m is where the beam is worth something rather than where it stops: at the
 * dip below it the pool lands at 18.6 m and delivers 3400/18.6^2 = 9.8 lux, or
 * 61% of ambient, which is a pool you can see. Past that the beam was adding
 * froxel writes and no light.
 */
const HEAD_RADIUS = 20;
const HEAD_HEIGHT = 0.65;
/**
 * Radians below horizontal, and it follows from the throw above.
 *
 * A beam from 0.65 m dipped by d meets the road at 0.65/tan(d). At the old 1.5
 * deg that is 24.8 m, which is now OUTSIDE the 20 m radius — the pool would be
 * culled before it landed. 2.0 deg puts it at 18.6 m, inside.
 */
const HEAD_DIP = (2.0 * Math.PI) / 180;

export function createTraffic(options = {}) {
  const count = options.vehicles || VEHICLE_COUNT;

  return {
    name: 'traffic',
    /**
     * `time` is a hard dependency and not an optional lookup, because the
     * signal phase is an ABSOLUTE time and CONTRACT §3 says nothing else keeps
     * a clock. A fallback that accumulated dt would be a second clock, which is
     * the rule this project states first.
     */
    needs: ['lights', 'time'],

    init(ctx) {
      const lights = ctx.get('lights');
      const rng = ctx.rng('traffic:layout');
      /**
       * THE CLASS ROLL GETS ITS OWN NAMED STREAM — SESSION 29 — AND WHAT THAT
       * DOES AND DOES NOT BUY IS WORTH STATING, BECAUSE THE OBVIOUS CLAIM IS
       * FALSE.
       *
       * CONTRACT §6 makes streams independent, so a roll on its own stream
       * cannot shift another system's sequence. Session 28 used that to add a
       * `retailRng` and leave 7 851 rows of the streamed city byte-identical.
       *
       * THIS IS NOT THAT CASE AND SAYING SO IS THE POINT. The class roll ALREADY
       * EXISTED, on `traffic:layout`, one draw per vehicle at construction. A
       * NEW roll on a new stream shifts nothing; MOVING an existing one off a
       * shared stream re-phases everything drawn after it — here `pref` and
       * `cab`, and through them every speed and therefore the whole disposition.
       * There is no arm in which the fleet gains two classes and the traffic
       * stands still, because the weights alone re-type every vehicle, so the
       * re-phasing costs nothing that was available anyway.
       *
       * WHAT THE SEPARATE STREAM IS ACTUALLY FOR is the other direction: from
       * here on, adding an eighth class or retuning a share cannot move `pref`,
       * `cab`, `junctionsLeft` or a single seeding draw. The determinism control
       * for the claim that nothing OUTSIDE traffic moved is a byte-identical
       * dump of the streamed city's registry, and it holds for a stronger reason
       * than stream independence: `citygen` never reads a traffic stream at all.
       */
      const classRng = ctx.rng('traffic:class');
      /**
       * The light signature, on its own stream too — session 29, item 2. Same
       * argument as `traffic:class` above: retuning the signature vocabulary,
       * or adding a fifth, must not move a single vehicle. It is a NEW roll on a
       * NEW stream, which is the case session 28 measured as byte-identical
       * downstream, so unlike the class roll it re-phases nothing at all.
       */
      const sigRng = ctx.rng('traffic:signature');
      /**
       * The paint, on its own stream — session 30, item 2. Same argument as
       * `traffic:class` and `traffic:signature`: retuning a colour share, or
       * adding a rung to the ladder, must not move a single vehicle. It is a
       * NEW roll on a NEW stream, so like the signature roll it re-phases
       * nothing at all, and the determinism control is that the nearest-vehicle
       * list at the look camera is identical across the change.
       */
      const paintRng = ctx.rng('traffic:paint');
      /** Cumulative weights per body type. Throws at build on a bad name. */
      const paintTables = BODY_TYPES.map((t) => buildPaintTable(t.name));
      function pickPaint(type) {
        const table = paintTables[type];
        const r = paintRng.next();
        for (const [idx, cum] of table) if (r <= cum) return idx;
        return table[table.length - 1][0];
      }
      /**
       * The root seed, as a string, for `riverNoRoad` — which asks the pure
       * generator which crossing carries a bridge and must be handed the same
       * seed `citygen` was. `String()` because the config value may arrive as a
       * number and `chunkRng` hashes an interpolated string.
       */
      const rootSeed = String(ctx.config.seed);
      const group = new THREE.Group();
      group.name = 'traffic';

      // --- materials -------------------------------------------------------
      //
      // Two, and both compile the CONTRACT §5.12 per-instance motion path. The
      // bodies carry albedo in instanceColor and roughness in the noctisRough
      // attribute, which is the same recipe block.js and city.js use; the light
      // lines carry emitted colour times brightness in instanceColor.

      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.45,
        metalness: 0.0,
        envMapIntensity: 1,
      });
      const lightMat = new THREE.MeshStandardMaterial({
        color: 0x16181c,
        roughness: 0.09,
        metalness: 0.0,
        envMapIntensity: 1,
      });
      lightMat.emissive.setRGB(1, 1, 1, THREE.LinearSRGBColorSpace);
      lightMat.emissiveIntensity = NITS_MAX;
      if (lights) {
        /**
         * `grime: true` compiles the session-9 vehicle grime path for the
         * bodies AND the wheels, which share bodyMat: the wheel geometry
         * carries neither grime attribute, reads 0 through the unbound-
         * attribute default, and a tyre at 0.035 reflectance has nothing a
         * film at 0.04 could darken anyway. The light lines stay plain — a
         * grimy emitter is a dimmer emitter, and the light-signature nits are
         * authored numbers this term must not touch.
         */
        lights.patch(bodyMat, { prevInstance: true, grime: true });
        lights.patch(lightMat, { prevInstance: true });
      }

      // --- geometry --------------------------------------------------------
      //
      // THREE InstancedMeshes for 160 vehicles: 1 920 body rows at 28
      // triangles, 1 040 light rows at 12 and 640 wheels at 40 — 53 760 +
      // 12 480 + 25 600 = 91 840 triangles against `floors.triangles` 940 000
      // and `ceilings.triangles` 2 000 000. Session 9's merge freed 8 960 of
      // the 7c loft's 62 720.
      //
      // SESSION 29 CORRECTED THIS BLOCK'S ARITHMETIC AS WELL AS ITS INPUTS, and
      // the correction is worth recording because the error was of exactly the
      // kind §9.1 is about. It read "480 light quads" — which is `signalBase`,
      // the VEHICLE rows alone — while the mesh has always been allocated
      // `signalBase + SIGNAL_APPROACHES * SIGNAL_ROWS`, i.e. 560 rows since the
      // signal heads landed in session 21. The stated total was 85 120 against a
      // true 86 080: a number written from one of the two terms that make it,
      // in a comment nothing checks. The light row count is now 160 x 6 + 80.
      //
      // Each mesh owns its OWN geometry object because an instanced attribute
      // lives on the GEOMETRY: `noctisRough` and the §5.12 previous-transform
      // attribute are per-mesh, and two meshes sharing one geometry would give
      // each other's rows their previous transforms. The bodies' geometry is
      // also the one thing here that is not a primitive — see
      // `createSectionGeometry` — and `harness.silhouettes()` reads its
      // vertices rather than a bounding box, so the projected outline the gates
      // rasterise is the chamfered section and not the box around it.

      const bodyCount = count * BOXES_PER_VEHICLE;
      /**
       * The signal heads share this mesh — see SIGNAL_PARTS. Their rows sit
       * AFTER the vehicles' so `vi * LIGHTS_PER_VEHICLE + l` is untouched and
       * nothing in the vehicle loop has to learn that the mesh got longer.
       */
      const signalBase = count * LIGHTS_PER_VEHICLE;
      const signalCount = SIGNAL_APPROACHES * SIGNAL_ROWS;
      const lightCount = signalBase + signalCount;
      const wheelCount = count * WHEELS_PER_VEHICLE;

      const bodyGeo = createSectionGeometry();
      const lightGeo = new THREE.BoxGeometry(1, 1, 1);

      /**
       * THE WHEEL, AND THE ROTATION IS BAKED INTO THE GEOMETRY RATHER THAN
       * CARRIED IN EVERY INSTANCE MATRIX.
       *
       * three's cylinder stands on +Y and a wheel's axle runs along the
       * vehicle's lateral axis, which is local +X. Rotating the geometry once
       * at build time means the per-instance transform is the same
       * compose(position, yaw about Y, scale) every other row in this module
       * uses — one code path, and `writeRow` does not have to learn about a
       * second orientation. After the bake the extent along X is the wheel's
       * WIDTH and the extents along Y and Z are its DIAMETER, which is the
       * order the scale is written in below and the sentence is here because
       * getting it wrong gives four discs lying flat in the road.
       *
       * Ten radial segments. At the 60 m the silhouette assertions measure out
       * to, a 0.62 m wheel is 0.62/(60 * 6.4765e-4) = 16 px across, so a
       * segment subtends 1.6 px and an eleventh would be sub-pixel. 640
       * instances x 40 triangles = 25 600 triangles against a route minimum of
       * 940 000.
       */
      const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
      wheelGeo.rotateZ(Math.PI / 2);

      const bodyMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, bodyCount);
      const lightMesh = new THREE.InstancedMesh(lightGeo, lightMat, lightCount);
      /**
       * SHARES `bodyMat`, so `distinctMaterials` does not move and neither does
       * the program count: the tyre's reflectance rides in `instanceColor` and
       * its roughness in the `noctisRough` attribute, exactly as every body box
       * does. It costs ONE draw call — 438 to 439 against a ceiling of 440 on
       * `highway_speed`, which is the tightest that ceiling has ever been and
       * is written down here rather than discovered by the next session.
       */
      const wheelMesh = new THREE.InstancedMesh(wheelGeo, bodyMat, wheelCount);
      bodyMesh.name = 'traffic:bodies';
      lightMesh.name = 'traffic:lights';
      wheelMesh.name = 'traffic:wheels';

      for (const m of [bodyMesh, lightMesh, wheelMesh]) {
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        // The population spans a 380 m box that follows the camera, so a
        // per-mesh frustum test would be testing a bound that is wrong the
        // moment it is computed. Two meshes is not worth a bound that lies.
        m.frustumCulled = false;
        m.receiveShadow = false;
        m.castShadow = false;
      }
      // A car with no shadow floats, and highway_speed is a daytime route.
      // Bodies only: a light line's shadow is two square centimetres, and a
      // wheel's own shadow is inside the body's.
      bodyMesh.castShadow = true;

      bodyMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(bodyCount * 3), 3);
      lightMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(lightCount * 3), 3);
      wheelMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(wheelCount * 3), 3);
      bodyMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      lightMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      wheelMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      bodyGeo.setAttribute('noctisRough', new THREE.InstancedBufferAttribute(new Float32Array(bodyCount), 1));
      wheelGeo.setAttribute('noctisRough', new THREE.InstancedBufferAttribute(new Float32Array(wheelCount), 1));
      /**
       * The per-instance half of the grime term. The per-vertex half rides on
       * the section geometry itself (`noctisGrimeV`, createSectionGeometry) so
       * it costs nothing per row; this attribute is which row, which vehicle,
       * and how neglected. Wheels deliberately get no counterpart — see the
       * patch() call above.
       */
      bodyGeo.setAttribute('noctisGrime', new THREE.InstancedBufferAttribute(new Float32Array(bodyCount), 1));

      bodyMesh.userData.noctisCensus = { chunk: 'traffic', vehicleBoxes: bodyCount };
      lightMesh.userData.noctisCensus = {
        chunk: 'traffic',
        vehicleLightLines: signalBase,
        signalHeadBoxes: signalCount,
      };
      wheelMesh.userData.noctisCensus = { chunk: 'traffic', vehicleWheels: wheelCount };

      /**
       * WHAT A VEHICLE IS, WRITTEN WHERE THE CATEGORY STILL EXISTS.
       *
       * `harness.silhouettes()` groups instance rows into subjects and the only
       * place that knows BOXES_PER_VEHICLE consecutive rows are one vehicle is
       * here. §9.1: a refactor that merges meshes erases the category, so the
       * label goes at the point of assembly rather than being reconstructed by
       * whoever reads the scene later.
       */
      /**
       * `profile: true` SAYS THIS SUBJECT HAS A LONG AXIS WORTH SAMPLING ALONG.
       * CONTRACT §7.3. It is on the body mesh and not on the wheels for the same
       * reason `palette` is: the flag names which mesh's instance matrix carries
       * the vehicle's own heading, and the harness reads the basis off that
       * matrix rather than off `BODY_TYPES` — a table in this file is the wrong
       * source for a claim about the delivered frame (§9.1).
       */
      bodyMesh.userData.noctisSilhouette = {
        kind: 'vehicle', group: BOXES_PER_VEHICLE, subject: 'traffic:vehicle',
        palette: true, profile: true,
      };
      /**
       * THE WHEELS ARE PART OF THE SAME SUBJECT, and if they were not the whole
       * point would be lost: the ground-contact assertion measures the bottom
       * 12% of the silhouette, the wheels ARE the bottom 12%, and a silhouette
       * that stopped at the sill would be measured against a floor it was built
       * to clear and would clear it by not containing the dark part.
       *
       * `group` is WHEELS_PER_VEHICLE against the bodies' BOXES_PER_VEHICLE.
       * Both happen to be 4 today and that is a coincidence rather than a
       * constraint — what makes them one subject is the shared `subject` key and
       * the row index, so vehicle 37's four wheels merge with vehicle 37's four
       * boxes however many of each there are.
       */
      wheelMesh.userData.noctisSilhouette = {
        kind: 'vehicle', group: WHEELS_PER_VEHICLE, subject: 'traffic:vehicle',
      };

      // --- per-instance motion, CONTRACT §5.12 -----------------------------

      const bodyMotion = createInstanceMotion(bodyCount, 'traffic:bodies');
      const lightMotion = createInstanceMotion(lightCount, 'traffic:lights');
      const wheelMotion = createInstanceMotion(wheelCount, 'traffic:wheels');

      /**
       * PRIME BOTH BUFFERS WITH THE IDENTITY, then let the first frame carry
       * every row.
       *
       * An unwritten mat4 attribute reads as four columns of (0,0,0,1), which
       * is singular and would put every vertex at the origin — the identity is
       * the only safe fill. It is not the right PREVIOUS transform for anything,
       * and it does not have to be: every vehicle is flagged `recycled` on the
       * frame it is seeded, so the first frame calls `carry` on all 288 rows and
       * previous is forced equal to current before the buffer is ever read.
       * Frame 0's motion is exactly zero for the right reason.
       */
      {
        const ident = new THREE.Matrix4();
        for (const [n, m] of [[bodyCount, bodyMotion], [lightCount, lightMotion], [wheelCount, wheelMotion]]) {
          const seed = new Float32Array(n * 16);
          for (let i = 0; i < n; i++) ident.toArray(seed, i * 16);
          m.prime(seed);
        }
      }

      group.add(bodyMesh);
      group.add(lightMesh);
      group.add(wheelMesh);
      ctx.scene.add(group);

      // --- the vehicles ----------------------------------------------------

      /**
       * CLASS SHARE, AND IT IS A CONTENT DECISION WITH ARITHMETIC UNDER IT.
       *
       * The weights are NOT normalised in the table: `typeTotal` is their sum
       * and `pickType` divides by it. That is deliberate and it is what makes
       * session 29 a two-line change to the composition rather than a seven-line
       * one — the five pre-existing weights are UNTOUCHED, so their proportions
       * relative to each other are exactly what they were, and the two new
       * classes take their share pro rata from all five at once. Editing five
       * numbers to make room would have made every one of them a number nobody
       * could attribute.
       *
       *   sum = 0.34 + 0.24 + 0.20 + 0.10 + 0.12 + 0.03 + 0.06 = 1.09
       *   bus   0.03 / 1.09 = 2.75% of 160 =  4.4 vehicles in the ring
       *   lorry 0.06 / 1.09 = 5.50% of 160 =  8.8 vehicles in the ring
       *   the five existing shares are each scaled by 1 / 1.09 = 0.9174
       *
       * WHY THOSE TWO NUMBERS AND NOT EQUAL ONES. The brief's requirement is the
       * ordering — buses rare, delivery lorries less so — and the ratio is 1:2.
       * In flow terms, which is the checkable form: 4.4 buses over the 1 772 m of
       * centreline inside the 190 m ring is one every 403 m, i.e. 26.8 buses per
       * hour per lane at the 12 m/s free speed. THAT IS AT THE TOP OF THE REAL
       * RANGE and it is chosen rather than derived: a trunk corridor with several
       * routes converging runs 20-30 buses an hour, and a bus the camera never
       * meets is content that does not exist. The lorry's 8.8 is 53.5 veh/h/lane,
       * which against this fleet's already freight-heavy van (18.3%) and hauler
       * (9.2%) shares is the smaller claim of the two.
       *
       * WHAT IT COSTS IN LENGTH, because that is the quantity item 1(f) is about:
       * the weighted mean body length goes 5.148 -> 5.505 m, +6.9%, at a fixed
       * vehicle count of 160 and a fixed 1 772 m of centreline. Road area is
       * unchanged; the fleet occupies 6.9% more of it.
       */
      const typeWeights = BODY_TYPES.map((t) => t.weight);
      const typeTotal = typeWeights.reduce((a, b) => a + b, 0);
      function pickType() {
        let r = classRng.next() * typeTotal;
        for (let i = 0; i < BODY_TYPES.length; i++) {
          r -= typeWeights[i];
          if (r <= 0) return i;
        }
        return 0;
      }

      const vehicles = [];
      for (let i = 0; i < count; i++) {
        const type = pickType();
        vehicles.push({
          type,
          /**
           * Which of `SIGNATURES` this vehicle wears, drawn from the ones its
           * CLASS allows. Rolled once at construction and never again: a
           * signature that changed when a vehicle was recycled would be a
           * different car wearing the same instance rows, and the eye finds that
           * even when a gate cannot.
           */
          sig: BODY_TYPES[type].sigAllowed[
            Math.min(BODY_TYPES[type].sigAllowed.length - 1,
              Math.floor(sigRng.next() * BODY_TYPES[type].sigAllowed.length))],
          /**
           * Which of `PAINT` this vehicle wears, drawn from its CLASS's own
           * weights. Rolled once at construction and never again, for the
           * reason `sig` gives: a vehicle that changed colour when it was
           * recycled is a different vehicle wearing the same instance rows.
           */
          paint: pickPaint(type),
          axis: 0, line: 0, dir: 1, lane: 0,
          s: 0,
          v: FREE_SPEED,
          /** Per-vehicle speed preference. A queue with one speed is a train. */
          pref: rng.range(0.86, 1.14),
          /** Lateral offset inside the lane, metres. Motorcycles use it. */
          lat: 0,
          latTarget: 0,
          braking: false,
          indicating: 0,
          turn: null,
          px: 0, pz: 0, hx: 0, hz: 1, d2: 0, nose: 0,
          /** Set on the frame an instance is re-seated. Its previous transform is elsewhere. */
          recycled: true,
          /**
           * False until `seed()` has put this vehicle somewhere. Session 29's
           * spawn spacing test reads it: a vehicle still stacked at the
           * constructor's origin is not an obstacle, it is an absence.
           */
          placed: false,
          /** Interior glow gain, fixed per vehicle so a row of cabs is not identical. */
          cab: rng.range(0.25, 1.0),
        });
      }

      // --- the light pool --------------------------------------------------
      //
      // One spot per vehicle, allocated once and re-aimed every frame. Never
      // added or removed after boot, for the reason city.js gives about its
      // lamp pool: churn in the light array reindexes every froxel.

      const warmHead = kelvinToLinearRGB(4300);
      const coolDay = kelvinToLinearRGB(5600);
      /**
       * The bus saloon. 4000 K is the neutral-white LED a modern service
       * interior is lit with — warmer than the 5600 K running lamp, cooler than
       * the 4300 K headlamp — and it is a CHROMATICITY rather than a colour, so
       * it goes through the same blackbody conversion every other emitter here
       * uses instead of being authored as a hex triple.
       */
      const warmCabin = kelvinToLinearRGB(4000);
      /** HEADLAMP_SLOTS lights for VEHICLE_COUNT vehicles, re-assigned by distance. */
      const lampPool = [];
      if (lights) {
        for (let i = 0; i < HEADLAMP_SLOTS; i++) {
          lampPool.push(lights.add({
            role: 'traffic',
            position: new THREE.Vector3(0, -1000, 0),
            color: [warmHead[0], warmHead[1], warmHead[2]],
            intensity: HEAD_CANDELA,
            radius: HEAD_RADIUS,
            type: 'spot',
            direction: new THREE.Vector3(0, 0, -1),
            coneOuter: HEAD_OUTER,
            coneInner: HEAD_INNER,
            sourceRadius: 0.07,
          }));
        }
      }

      // --- scratch ---------------------------------------------------------

      const pos = { x: 0, z: 0 };
      const mat = new THREE.Matrix4();
      const quat = new THREE.Quaternion();
      const vScale = new THREE.Vector3();
      const vPos = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);
      const tracks = new Map();
      const lampOrder = [];
      const camLane = { axis: -1, line: 0, dir: 1, lane: 0, s: 0 };
      /** Session 29's two seeding instruments. Run-cumulative; read by `stats()`. */
      let seedRejects = 0;
      let seedFallbacks = 0;

      /**
       * Seed or re-seed a vehicle somewhere inside the ring.
       *
       * Biased ahead of the camera by taking the better of two draws: a
       * uniformly re-seeded population drains from in front and accumulates
       * behind, because the camera is moving forward down a route and the ring
       * is centred on it.
       */
      function seed(veh, cam, fwd, initial) {
        const ci = Math.round(cam.x / CITY.chunkSize);
        const cj = Math.round(cam.z / CITY.chunkSize);
        const span = Math.ceil(SIM_RADIUS / CITY.chunkSize);
        let best = null;
        let bestScore = -1e9;
        for (let t = 0; t < 12; t++) {
          const axis = rng.next() < 0.5 ? 0 : 1;
          const line = (axis === 0 ? cj : ci) + rng.int(-span, span);
          const dir = rng.next() < 0.5 ? 1 : -1;
          /**
           * A BUS RUNS IN THE KERBSIDE LANE — session 33. Every other type keeps
           * the 62/38 split; a 12 m single-decker that serves kerbside stops
           * does not spend its route in the overtaking lane, and until this
           * line it did, three quarters of the time. Measured before it: of
           * 13.3 buses in the ring, **24.5% were in lane 1**, so the stop-
           * serving rule below had almost nothing to fire on and `busStopAt`
           * delivered 0 berths in 40 s of simulation.
           *
           * It is a content correction and not a tuning knob: `LANE_OFFSET[1]`
           * = 5.25 is the lane whose kerb the shelters stand on, and this makes
           * a bus be where a bus is.
           */
          const lane = BODY_TYPES[veh.type].name === 'bus' ? 1 : (rng.next() < 0.62 ? 1 : 0);
          const along = axis === 0 ? cam.x : cam.z;
          const s = along + rng.range(-SIM_RADIUS, SIM_RADIUS);
          lanePosition(axis, line, dir, lane, s, pos);
          const dx = pos.x - cam.x;
          const dz = pos.z - cam.z;
          const d2 = dx * dx + dz * dz;
          if (d2 > SIM_RADIUS * SIM_RADIUS) continue;
          /**
           * NOT SEEDED ONTO A ROAD THE RIVER TOOK. Session 15.
           *
           * `axis === 0` here means the vehicle travels in x on a line of
           * constant z — an EAST–WEST road — which is the sense
           * `riverNoRoad`'s second argument wants. Every east–west line inside
           * the river's envelope is refused entirely (`city.js` does not build
           * one, even at the stations where the meander leaves it on dry
           * land), and a north–south line is refused where the water is unless
           * that crossing carries a bridge. HARD rather than scored, for the
           * same reason `CAMERA_CLEARANCE` is: a scored candidate is a
           * candidate that still wins when every draw is bad.
           */
          if (riverNoRoad(rootSeed, pos.x, pos.z, axis === 0)) continue;
          /**
           * NOR ONTO A ROAD THAT IS PAST THE CITY'S OWN EDGE — SESSION 54, AND
           * IT IS THE SAME SENTENCE AS THE THREE EITHER SIDE OF IT.
           *
           * The lattice this module drives on is ARITHMETIC — `line *
           * chunkSize` — and the road actually drawn under it is
           * `generateChunk`'s. Those two agreed everywhere for fifty-three
           * sessions because the drawn road never stopped. This session made
           * `generateChunk` emit no lattice past `CITY.extentEdgeM` (STATE 53
           * §7 item 1), so from now on the arithmetic lattice reaches 800 m
           * further than the road does, and a fleet whose lattice is arithmetic
           * and whose road is not is exactly what the operator reported from
           * the air at the weir: *"vehicles, buses, pedestrians, lamp posts and
           * market stalls arranged in neat lanes on BARE GROUND."*
           *
           * HARD rather than scored, for the reason the three around it are.
           * The same term is in the recycle pass below, so a vehicle cannot be
           * SEEDED past the edge and cannot DRIVE past it either — one
           * statement about the delivered road network, in the two places that
           * ask the question.
           */
          if (cityExtentAt(pos.x, pos.z) <= 0) continue;
          /**
           * NOR ONTO A ROAD A LANDMARK TOOK — SESSION 34, AND IT IS THE SAME
           * SENTENCE AS THE LINE ABOVE, NINETEEN SESSIONS LATE.
           *
           * `generateChunk` clips the carriageway against every `landmark`
           * claim, so the road network delivered to a frame already has holes
           * in it. This module knew about exactly one of the two things that
           * make a hole. The weir alone is **210 × 210 m**, and the operator
           * reported it from the air as *"vehicles, buses, pedestrians, lamp
           * posts and market stalls arranged in neat lanes on BARE GROUND"* —
           * which is what a fleet does when its lattice is arithmetic and the
           * road under it is not.
           *
           * HARD rather than scored, for the reason the two tests either side
           * of it are: a scored candidate still wins when every draw is bad.
           */
          if (landmarkUnderBody(pos.x, pos.z, axis, veh.type)) continue;
          if (blockUnderBody(pos.x, pos.z, axis, veh.type)) continue;
          /**
           * NOR PAST A STOP LINE IT HAS NO PERMISSION TO HAVE PASSED —
           * SESSION 34. See `stopLineClearanceM` at the top of this file for
           * the 25 920-frame measurement that says this, and not an exit
           * reservation, is what `worstStopLineM` has been reporting since
           * session 21.
           *
           * `seed()` sets `veh.cleared = null` twenty lines below, so every
           * candidate here is a vehicle WITHOUT permission. A vehicle without
           * permission belongs at or before its bar; the 11.4 m between the bar
           * and the junction is ground it can only occupy by having been waved
           * through, and this loop cannot wave anybody through.
           *
           * HARD, not scored, like the three tests around it. It removes
           * `(9.00 + len/2) / 128` = **8.9%** of each lane from the seeding
           * distribution — a periodic gap immediately ahead of every junction,
           * which fills within a second because vehicles DRIVE into it
           * constantly. What it cannot occupy is the standing population, and
           * that is the whole point.
           */
          if (stopLineClearanceM(s, dir, BODY_TYPES[veh.type]) < 0) continue;
          /**
           * HARD, not scored. See CAMERA_CLEARANCE.
           *
           * MEASURED FROM THE BODY, NOT FROM THE ORIGIN — SESSION 29, AND THE
           * CONSTANT'S OWN DERIVATION ALREADY SAID SO.
           *
           * `CAMERA_CLEARANCE` is derived above as *"2.0 + 1.2 x 12 = 16.4 m,
           * less half a hauler — 9.60/2 = 4.80 — so the derivation gives 11.6 m
           * and the constant holds the CONSERVATIVE side of it"*. That is a
           * statement about where the NOSE ends up. The test was
           * `d2 < CAMERA_CLEARANCE^2` on the vehicle's ORIGIN, so what it
           * actually guaranteed was `14.0 − len/2` to the body: 11.2 m for a
           * hauler, and 8.0 m for the 12.00 m bus this session adds. CONTRACT §9
           * rule 7 — a right number measured from the wrong place — and it was
           * invisible for as long as the longest half-length in the fleet was
           * the 4.80 m the derivation happened to be written against.
           *
           * So the clearance is now to the oriented BODY, which makes it
           * STRICTER for every type and strictest for the longest: a bus must
           * now seed its origin 20.0 m out where 14.0 m used to do. At seed time
           * the body is axis-aligned to its lane, so the distance is the same
           * clamp-to-box the probe uses — half the length along the lane, half
           * the width across it.
           *
           * IT DOES NOT MOVE THE STREAM. The candidate loop still draws exactly
           * five numbers per iteration for exactly twelve iterations; only which
           * candidate wins changes. `traffic:layout`'s phase is untouched.
           */
          {
            const halfL = BODY_TYPES[veh.type].len * 0.5;
            const halfW = BODY_TYPES[veh.type].wide * 0.5;
            // The lane's own axes: the body runs along `axis`, across the other.
            const dAlong = axis === 0 ? Math.abs(dx) : Math.abs(dz);
            const dAcross = axis === 0 ? Math.abs(dz) : Math.abs(dx);
            const bx = Math.max(0, dAlong - halfL);
            const bz = Math.max(0, dAcross - halfW);
            if (bx * bx + bz * bz < CAMERA_CLEARANCE * CAMERA_CLEARANCE) continue;
          }
          /**
           * NOT SEEDED INSIDE A BODY THAT IS ALREADY THERE — SESSION 29, AND IT
           * IS A DEFECT THIS SESSION MEASURED RATHER THAN INTRODUCED.
           *
           * `seed()` had NO spacing test of any kind. Every other placement
           * routine in this project tests what is already there — CONTRACT §9.1
           * states it as a rule and session 21 turned it into `occupancy.js`
           * after it had been broken seven times — and the one placement routine
           * that re-runs 160 times a second was the eighth.
           *
           * MEASURED ON THE FLEET AS IT STOOD, BEFORE A BUS EXISTED
           * (`tools/fleetprobe.mjs`, 216 simulated seconds, eye parked at the
           * look shot): 245 of 637 re-seats — 38.5% — landed INSIDE a body
           * already on that line, worst overlap 9.475 m, and those overlaps
           * account for essentially all of the 17% of pair-frames whose
           * bumper-to-bumper gap is negative. The car-following model cannot
           * undo one: with `gap < 0` its limit is `max(0, lead.v x gap/safe)` =
           * 0, so the vehicle behind simply STOPS INSIDE the vehicle in front
           * and waits for it to drive out.
           *
           * WHY IT IS FIXED HERE RATHER THAN LEFT. Item 1's whole subject is
           * that a longer body finds the places an extent is used, and this is
           * the largest of them: the depth of an overlap is bounded by the two
           * bodies' half-lengths, so a 12.00 m bus makes every overlap it is in
           * up to 3.20 m deeper than the 9.60 m hauler could. Shipping the bus
           * over this would have been shipping the defect at its new maximum.
           *
           * HARD, NOT SCORED, for the same reason the two tests above it are:
           * a scored candidate still wins when every draw is bad. The clearance
           * asked for is the model's own standing gap at rest — `2.0 m`, the
           * constant term of `safe = 2.0 + 1.2 v` — and not a car length, which
           * is the quantity this project has confused with a gap before.
           */
          {
            const half = BODY_TYPES[veh.type].len * 0.5;
            let clash = false;
            for (const other of vehicles) {
              if (other === veh) continue;
              /**
               * A VEHICLE THAT HAS NEVER BEEN SEEDED IS NOT AN OBSTACLE, AND
               * LEAVING THIS OUT WOULD HAVE BIASED THE WHOLE BOOT.
               *
               * The constructor gives every vehicle `axis 0, line 0, dir 1,
               * lane 0, s 0` and the boot loop then seeds them one at a time, so
               * on the first call 159 vehicles are stacked at the world origin
               * on exactly one lane. Without this line the first seeds would
               * have found that lane occupied by 159 bodies and refused every
               * candidate on it — a systematic hole in the initial distribution,
               * on the line z = 0 that runs the length of the origin block and
               * carries every look shot in the project.
               */
              if (!other.placed) continue;
              if (other.axis !== axis || other.line !== line || other.dir !== dir || other.lane !== lane) continue;
              if (Math.abs(other.s - s) < half + BODY_TYPES[other.type].len * 0.5 + SEED_CLEAR_M) { clash = true; break; }
            }
            if (clash) { seedRejects++; continue; }
          }
          const ahead = (dx * fwd.x + dz * fwd.z) / Math.max(1, Math.sqrt(d2));
          const score = initial ? 0 : ahead;
          if (score > bestScore) { bestScore = score; best = { axis, line, dir, lane, s }; }
        }
        if (!best) {
          // Twelve candidates all inside the clearance or outside the ring is
          // possible only if the ring is degenerate. Park it at the far edge of
          // the camera's own street, which is always outside both.
          //
          // SESSION 29 added a third hard rejection above, so this branch is
          // reachable for a new reason and its rate is now an instrument rather
          // than an impossibility: `stats().seedFallbacks` counts it and
          // `fleetprobe` prints it. A fallback places a body WITHOUT the spacing
          // test, so a high rate would mean the test is not doing what the
          // number below claims.
          seedFallbacks++;
          best = { axis: 0, line: cj, dir: 1, lane: 1, s: cam.x + SIM_RADIUS * 0.8 };
          /**
           * AND THE FALLBACK OBEYS THE STOP-LINE RULE TOO — session 34.
           *
           * `cam.x + SIM_RADIUS · 0.8` is an arbitrary point on a lattice that
           * has a junction every 128 m, so it lands in the 11.4 m band ahead of
           * one about 8.9% of the times it fires. `seedFallbacks` has measured
           * 0 since session 29 and a rule that holds 91% of the time on a path
           * nobody takes is not a guarantee — it is the same probabilistic
           * gap, moved somewhere harder to see. Backed off to the bar rather
           * than redrawn, because this branch exists precisely to place a body
           * without further draws.
           */
          const clearance = stopLineClearanceM(best.s, best.dir, BODY_TYPES[veh.type]);
          if (clearance < 0) best.s += clearance * best.dir;
        }
        veh.axis = best.axis;
        veh.line = best.line;
        veh.dir = best.dir;
        veh.lane = best.lane;
        veh.s = best.s;
        veh.v = FREE_SPEED * veh.pref * BODY_TYPES[veh.type].speed;
        veh.turn = null;
        veh.lat = 0;
        veh.latTarget = 0;
        // Junctions until this vehicle turns. Counted rather than sampled per
        // frame: a per-frame probability makes the turn rate a function of the
        // frame rate.
        veh.junctionsLeft = rng.int(2, 7);
        veh.lastJ = null;
        /**
         * No permission to occupy any junction — session 18. A recycled vehicle
         * inherits a `cleared` from wherever it used to be, and a junction id is
         * a world coordinate, so on a lattice of identical 128 m spacing a stale
         * one can equal the id of the junction it has just been re-seeded in
         * front of. That is permission to run a red light, granted by a
         * coincidence of arithmetic.
         */
        veh.cleared = null;
        /**
         * And so does the bus dwell, for the same reason one line up: a berth
         * position is a world coordinate on a 128 m lattice, so a stale
         * `servedAt` can equal the berth of the stop the bus has just been
         * re-seeded in front of — which is permission to drive past a shelter,
         * granted by a coincidence of arithmetic. And a bus re-seeded mid-dwell
         * would arrive somewhere new already standing still.
         */
        veh.dwell = 0;
        veh.stopAt = null;
        veh.servedAt = null;
        veh.stopRec = null;
        veh.recycled = true;
        /**
         * From here this vehicle is somewhere real, so it becomes an obstacle
         * for every later seed. Set LAST, after `best` has been written, so a
         * vehicle can never be tested against its own stale position.
         */
        veh.placed = true;
      }

      /**
       * The signal phase for a road axis at a given time.
       *
       * One global phase, not per junction. A real grid runs a green wave and
       * a green wave is what one phase across a lattice of identical spacing
       * IS, as long as the vehicles all travel at about the same speed: the
       * 128 m block at 12 m/s is 10.7 s, against 14 s of green.
       *
       * Returns 0 green, 1 amber, 2 red.
       */
      /**
       * The next bus stop this vehicle should serve, as a position along its own
       * line — or null if there is not one, or there is one and it refuses it.
       *
       * `busStopAt` is PURE in (rootSeed, cx, cz) and costs one hash and a
       * bounds call, which is why this asks it directly for the chunk the bus is
       * in and the one ahead rather than caching a route network. There is no
       * route network and item 4 said there must not be one.
       */
      function nextBusStop(veh, type) {
        const S = CITY.chunkSize;
        const here = Math.floor(veh.s / S);
        for (let k = 0; k < 2; k++) {
          const idx = here + veh.dir * k;
          /**
           * The chunk that OWNS the band this bus is driving beside. An axis-0
           * bus runs along x on the road at z = line·S, and that road is chunk
           * (idx, line)'s own `b.z0` band — so `cz` is the line and `cx` is
           * where the bus is. An axis-1 bus is the transpose.
           */
          const cx = veh.axis === 0 ? idx : veh.line;
          const cz = veh.axis === 0 ? veh.line : idx;
          const stop = busStopAt(rootSeed, cx, cz);
          if (!stop) continue;
          // The band has to be the road this bus is on: axis 'z' is the EW road
          // at b.z0 (traffic axis 0), axis 'x' is the NS road at b.x0 (axis 1).
          const bandAxis = stop.axis === 'z' ? 0 : 1;
          if (bandAxis !== veh.axis) continue;
          if (Math.round(stop.at / S) !== veh.line) continue;
          // Which side it serves — `lanePosition`'s own sign.
          const servesDir = veh.axis === 0 ? stop.side : -stop.side;
          if (servesDir !== veh.dir) { stats.busStopsRefused.wrongSide++; continue; }
          // ITEM 4d. A bus in the through lane does not stop; it does not swerve.
          if (veh.lane !== 1) { stats.busStopsRefused.offsideLane++; continue; }
          const berth = stop.along - veh.dir * (type.len / 6);
          if (veh.servedAt === berth) continue;
          const ahead = (berth - veh.s) * veh.dir;
          if (ahead <= 0) continue;
          // Only brake for one it can actually reach comfortably from here.
          if (ahead > (veh.v * veh.v) / (2 * BRAKE_A) + 60) continue;
          veh.stopRec = stop;
          return berth;
        }
        return null;
      }

      /**
       * Seconds a bus stands at a stop, AND IT IS THE BOARDING TIME OF THE
       * PEOPLE WHO ARE ACTUALLY STANDING THERE.
       *
       * Transit practice splits dwell into a fixed door cycle and a per-boarder
       * term: about 5 s to open, kneel and close, and 2.5 s a passenger through
       * a single door. Both are figures from outside this project and both are
       * bounded, which is what §9 rule 5 asks of a number.
       *
       * THE BOARDER COUNT IS NOT ASSUMED, IT IS COUNTED. `streetlife.js` puts
       * pedestrians at shelters as a destination and holds them there
       * (item 4b), and `waitingAt` returns how many are within the shelter's own
       * roof footprint. So a stop with nobody at it is a 5 s pause and a stop
       * with four people at it is 15 s — the bus's dwell is CAUSED by what the
       * frame shows, rather than being a constant that happens to coincide with
       * it. With `streetlife` absent or quarantined the count is zero and every
       * dwell is the door cycle, which is the correct degenerate answer.
       */
      function busDwellSeconds(veh) {
        const streetlife = ctx.get('streetlife');
        const stop = veh.stopRec;
        let boarders = 0;
        if (streetlife && streetlife.waitingAt && stop) {
          /**
           * The SHELTER's own centre, built the way `city.js` builds it to draw
           * it — `roadHalfWidth + kerbGapM + roofDeepM/2` out from the road
           * centreline on the band's own side. Not the berth, which is on the
           * carriageway and is the same distance from BOTH pavements; asking
           * for people near the berth would count the crowd waiting on the
           * other side of the street as boarders for this bus.
           */
          const off = CITY.roadHalfWidth + BUS_STOP.kerbGapM + BUS_STOP.roofDeepM / 2;
          const sx = stop.axis === 'x' ? stop.at + stop.side * off : stop.along;
          const sz = stop.axis === 'x' ? stop.along : stop.at + stop.side * off;
          boarders = streetlife.waitingAt(sx, sz);
        }
        return BUS_DOOR_CYCLE_S + BUS_BOARD_S * boarders;
      }

      function signal(axis, now) {
        const t = ((now % CYCLE_S) + CYCLE_S) % CYCLE_S;
        const mine = axis === 0 ? 0 : GREEN_S + AMBER_S;
        const rel = ((t - mine) % CYCLE_S + CYCLE_S) % CYCLE_S;
        if (rel < GREEN_S) return 0;
        if (rel < GREEN_S + AMBER_S) return 1;
        return 2;
      }

      let frameId = 0;
      let firstFrame = true;
      let suppressed = 0;
      /** The §5.12 upload A/B arm. Instrument only — see `api.setUploadFrozen`. */
      let uploadFrozen = false;
      let cutoffLog = '';

      const stats = {
        vehicles: count,
        headlamps: lights ? HEADLAMP_SLOTS : 0,
        litVehicles: 0,
        lampsOn: true,
        bodyTypes: BODY_TYPES.length,
        suppressedByThreshold: 0,
        recycledThisFrame: 0,
        /**
         * SESSION 34. Run-cumulative: how many of those recycles happened
         * because the vehicle had driven onto ground with no road on it —
         * the river's channel or a landmark's footprint.
         *
         * An instrument and not a threshold, and it exists because a rule that
         * never fires is indistinguishable from one that is not wired up. That
         * sentence is STATE 33 §5.4's, about a bus refusal whose condition has
         * no case on this lattice; this one's condition has 44 100 m² of case
         * and the count says how much of it the fleet actually reaches.
         */
        recycledOffRoad: 0,
        /**
         * SESSION 29. Run-cumulative counts of the spawn spacing test above:
         * how many candidate placements it refused, and how many times all
         * twelve candidates were refused and the fallback placed a body without
         * it. Instruments, not thresholds — `tools/fleetprobe.mjs` reads them and
         * no gate asserts either, because the quantity a gate should assert here
         * is the DELIVERED overlap and that is what the probe measures.
         */
        seedRejects: 0,
        seedFallbacks: 0,
        cutoffM: 0,
        turning: 0,
        stopped: 0,
        /** Vehicles at a standstill at a stop line without permission. Session 18. */
        holdingAtRed: 0,
        /**
         * Vehicle-frames this frame in which a junction was withheld because
         * somebody was still on the carriageway of the road it was approaching.
         * Session 33, LOOK.md §4. An instrument: no gate asserts it, and what
         * it is for is telling a session whether the yield ever fires at all —
         * a rule that never fires and a rule that is wired up wrong produce the
         * same frames.
         */
        yieldedToPedestrian: 0,
        /**
         * Run-cumulative. Vehicle-frames in which a vehicle holding a junction
         * had body inside a crossing box somebody was standing on. The
         * dilemma-zone residual — see the block that increments it. Instrument.
         */
        pedConflictFrames: 0,
        /**
         * Bus stops, session 33. `served` is run-cumulative berths made;
         * `refused` is why a bus passed one, by reason. Instruments: item 4d
         * says a bus that cannot pull clear refuses rather than moves, and a
         * refusal that is never counted is indistinguishable from a rule that
         * is not wired up.
         */
        busStopsServed: 0,
        busStopsRefused: { wrongSide: 0, offsideLane: 0 },
        busesDwelling: 0,
        /**
         * Session 21. The longest queue at any single junction this frame, and
         * how many junctions have one at all. Both are instruments; neither
         * carries a threshold, because what the number MEANS depends on whether
         * it empties — which is a property of the series and not of a frame.
         */
        worstQueue: 0,
        queuedJunctions: 0,
        /**
         * Metres from a held vehicle's FRONT to its own stop line, worst over
         * the run. Session 19, item 7. Positive is short of the line, which is
         * where a vehicle should stop; **negative is a defect**. `Infinity`
         * means no vehicle has been held at a red yet, which is not a pass.
         */
        worstStopLineM: Infinity,
        /**
         * WHICH VEHICLE SET `worstStopLineM`, AND WHAT WAS TRUE OF IT — session
         * 25, and it is a WITNESS rather than a threshold.
         *
         * STATE 22 §5 and STATE 24 §3 both asked for this and both deferred it,
         * and it is the measurement that has to precede any repair: the figure
         * has been red at about −10.5 m since session 21 and NOBODY HAS EVER
         * ASKED WHICH VEHICLE PRODUCES IT. Two worlds give the same number and
         * they want opposite repairs:
         *
         *   SPILLBACK      a vehicle entered a junction box on green, its exit
         *                  was blocked, and it stopped inside. Real, and the
         *                  repair is a reservation on the EXIT.
         *   A TELEPORT     `recycled` is set when an instance is re-seated
         *                  somewhere else entirely, and a re-seated vehicle has
         *                  `cleared = null` — no permission — so it is eligible
         *                  for this statistic from its first frame. Its distance
         *                  to "its own" stop line is then bookkeeping about where
         *                  the recycler dropped it, not a vehicle that ran a red.
         *
         * Building the exit reservation without separating those is CONTRACT §9
         * row 21a exactly: two sessions carried a repair for a viaduct deck
         * defect that was not there, because nobody measured before designing.
         *
         * Costs one object write on a strictly rarer path than the comparison it
         * sits beside — only when a new worst is found.
         */
        worstStopLineWitness: null,
        signalHeads: 0,
      };

      /** Hoisted for `writeSignals`: the frame loop must not allocate. */
      /**
       * The per-junction queue census, rebuilt every frame. A Map rather than
       * an object because the key is composite and the set changes as the ring
       * moves; hoisted for the same reason `signalCandidates` is — the frame
       * loop must not allocate.
       */
      const queueNow = new Map();

      const signalCandidates = [];
      const signalHeads = [];
      const signalSeat = new Array(SIGNAL_APPROACHES).fill('');

      /**
       * Write one instance row. `motion` decides whether this row's previous
       * transform survives: a recycled vehicle's previous position is hundreds
       * of metres away, and the vector across that gap is bookkeeping rather
       * than motion.
       */
      function writeRow(arr, motion, row, px, py, pz, yaw, sx, sy, sz, suppress) {
        quat.setFromAxisAngle(up, yaw);
        vPos.set(px, py, pz);
        vScale.set(sx, sy, sz);
        mat.compose(vPos, quat, vScale);
        mat.toArray(arr, row * 16);
        if (suppress) motion.carry(row);
      }

      /**
       * The signal heads for the nearest junctions, into the tail of the light
       * mesh. See SIGNAL_PARTS for what the five rows are and why they are here
       * rather than in a mesh of their own.
       *
       * Junction selection is by Chebyshev ring around the camera's own
       * junction cell, nearest first, which is `city.js`'s `wantedChunks`
       * ordering on a lattice with the same 128 m pitch — deliberately, because
       * two orderings over one lattice is two things to keep in step.
       *
       * A SLOT THAT CHANGES JUNCTION CARRIES. §5.12: the previous transform of
       * a re-seated head is 128 m away and the vector across that gap is
       * bookkeeping, not motion. `signalSeat` remembers what each slot was
       * showing; when it changes, `carry()` forces previous equal to current
       * for that row and the TAA sees a new object rather than a moving one.
       */
      function writeSignals(ctxRef, cam, now, arr, col) {
        if (!signalCount) return;
        /**
         * THE MASTS STAND ON THE PAVEMENT, NOT ON THE DATUM — session 19.
         *
         * `SIGNAL_PARTS` says so in its own header: "y is up from the pavement".
         * It was not — every row was written at `part.y` absolute, so a 3.10 m
         * mast sat with its foot at y = 0 while the footway under it was
         * elsewhere. A signal head stands at `roadHalfWidth + SIGNAL_KERB_M` =
         * 7.5 + 1.15 = 8.65 m from the junction centre, which is 1.15 m outside
         * the kerb and therefore on the pavement.
         *
         * ONE QUERY PER FRAME, NOT ONE PER HEAD. The sixteen approaches are the
         * four nearest junctions on a 128 m lattice and every one of them is a
         * street corner, so they are all on the same `GROUND.pavement`. Asking
         * `city.groundYAt` sixteen times a frame to get one number sixteen times
         * would be worse than the constant AND worse than one query: this asks
         * once, at the camera, and uses `GROUND.pavement` if the city is not
         * there to answer. The error this can make is a head on a bridge deck,
         * where the footway is at the same `GROUND.pavement` anyway.
         */
        const cityApi = ctxRef && ctxRef.get ? ctxRef.get('city') : null;
        const mastY = cityApi && cityApi.groundYAt
          ? cityApi.groundYAt(cam.position.x, cam.position.z)
          : GROUND.pavement;
        const s = CITY.chunkSize;
        const cx = Math.round(cam.position.x / s);
        const cz = Math.round(cam.position.z / s);
        signalCandidates.length = 0;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const jx = (cx + dx) * s;
            const jz = (cz + dz) * s;
            const ddx = jx - cam.position.x;
            const ddz = jz - cam.position.z;
            signalCandidates.push({ jx, jz, d2: ddx * ddx + ddz * ddz });
          }
        }
        signalCandidates.sort((a, b) => a.d2 - b.d2);

        let slot = 0;
        for (const j of signalCandidates) {
          if (slot >= SIGNAL_APPROACHES) break;
          signalApproaches(j.jx, j.jz, signalHeads);
          for (const h of signalHeads) {
            if (slot >= SIGNAL_APPROACHES) break;
            /**
             * ═══════════════════════════════════════════════════════════════
             * THE SEVENTH SPELLING OF "DOES A LANDMARK STAND HERE", AND IT
             * SPELLED IT AS NOTHING AT ALL — SESSION 35.
             * ═══════════════════════════════════════════════════════════════
             *
             * Session 34 unified six readers of that question and repaired all
             * six. This loop is a seventh and it asked nobody: it emits four
             * heads at every junction of an arithmetic lattice, and the road
             * clip has already taken the carriageway out from under some of
             * them. **Measured by `tools/landmarkcensus.mjs --sim=90`: ten
             * signal-head boxes standing inside the weir's 210 m basin, at
             * y 1.55 to 3.86 over a floor 9.80 m down.** That is the operator's
             * *"traffic signals standing on nothing"*, and a mast is also what
             * his *"lamp posts standing in the road"* is looking at — the
             * kerbside lamps have tested this since session 34 and these have
             * not.
             *
             * THE TEST IS AT THE HEAD AND NOT AT THE JUNCTION, AND THAT IS THE
             * WHOLE OF WHY THE OBVIOUS VERSION WOULD HAVE MISSED IT. The ten
             * boxes belong to junction (−256, 256) — which is one metre
             * OUTSIDE the weir's own AABB, `z1 = 255`. `signalApproaches` puts
             * a head `STOP_LINE` back and `roadHalfWidth + SIGNAL_KERB_M`
             * across, so its heads stand at z = 247, nine metres inside the
             * claim the junction is outside of. CONTRACT §9 rule 7 again: a
             * right predicate at the wrong point.
             *
             * SKIPPED RATHER THAN SLOT-CONSUMED. `slot` only advances for a
             * head that is written, so refusing one lets the next junction's
             * approach have the row instead of leaving a hole in the pool.
             */
            if (landmarkOccupies(h.x, h.z)) continue;
            const yaw = Math.atan2(h.faceX, h.faceZ);
            const cy = Math.cos(yaw);
            const sy = Math.sin(yaw);
            const phase = signal(h.axis, now);
            const seat = `${h.x.toFixed(1)},${h.z.toFixed(1)}`;
            const moved = signalSeat[slot] !== seat;
            signalSeat[slot] = seat;
            for (let p = 0; p < SIGNAL_ROWS; p++) {
              const part = SIGNAL_PARTS[p];
              const row = signalBase + slot * SIGNAL_ROWS + p;
              // Local (x, z) into world through the head's own yaw.
              const wx = h.x + part.x * cy + part.z * sy;
              const wz = h.z - part.x * sy + part.z * cy;
              writeRow(arr, lightMotion, row, wx, mastY + part.y, wz, yaw, part.w, part.h, part.d, moved);
              let g = 0;
              let chroma = SIGNAL_DARK;
              if (part.lamp >= 0) {
                /**
                 * `signal()` returns 0 green, 1 amber, 2 red, and `part.lamp`
                 * is the SAME encoding — so the lit lens is the one whose
                 * number equals the phase. One encoding, two consumers, and
                 * the sentence is here because two encodings for one state is
                 * the whole of CONTRACT §9.
                 */
                const lit = part.lamp === phase;
                chroma = SIGNAL_CHROMA[part.lamp];
                g = (lit ? NITS_SIGNAL : NITS_SIGNAL_OFF) / NITS_MAX;
              }
              col[row * 3 + 0] = chroma[0] * g;
              col[row * 3 + 1] = chroma[1] * g;
              col[row * 3 + 2] = chroma[2] * g;
            }
            slot++;
          }
        }
        /**
         * EVERY SLOT THE JUNCTIONS DID NOT FILL IS COLLAPSED — SESSION 35, and
         * it is what makes the refusal above a refusal rather than a ghost.
         *
         * Sixteen slots and four junctions of four approaches filled all of
         * them exactly, every frame, since the signals existed — so a slot had
         * never been left over and nothing cleared one. The moment a head can
         * be REFUSED that stops being true: the leftover row keeps the matrix
         * it was written with last frame, which is a signal head standing at
         * the position the refusal was supposed to remove it from. A stale
         * instance is `citycheck`'s `underdrawn` case wearing a different hat —
         * geometry drawn from a description of a world that no longer exists.
         *
         * Zero scale rather than a shorter `count`: the rows are the TAIL of a
         * mesh whose head is the vehicle light lines, so `mesh.count` cannot
         * end before them. `carry` on the same row, because a collapsed
         * instance has no history worth reprojecting (§5.12's recycle rule).
         */
        for (let r = slot; r < SIGNAL_APPROACHES; r++) {
          signalSeat[r] = null;
          for (let p = 0; p < SIGNAL_ROWS; p++) {
            const row = signalBase + r * SIGNAL_ROWS + p;
            writeRow(arr, lightMotion, row, 0, 0, 0, 0, 0, 0, 0, true);
            col[row * 3 + 0] = 0;
            col[row * 3 + 1] = 0;
            col[row * 3 + 2] = 0;
          }
        }
        stats.signalHeads = slot;
      }

      function rebuild(ctxRef, dt) {
        const cam = ctxRef.camera;
        const time = ctxRef.get('time');
        const now = time ? time.now : 0;

        const fwd = { x: 0, z: -1 };
        {
          const e = cam.matrixWorld.elements;
          fwd.x = -e[8];
          fwd.z = -e[10];
          const l = Math.hypot(fwd.x, fwd.z) || 1;
          fwd.x /= l;
          fwd.z /= l;
        }

        // --- the size threshold, CONTRACT §5.12 ----------------------------
        /**
         * Lights on, or lights off. The same photocell the street lighting runs
         * on, read through the same module, so a vehicle and a lamp post can
         * never disagree about whether it is night.
         */
        const lighting = ctxRef.get('lighting');
        const lampsOn = lighting ? !!lighting.photocellOn : true;
        stats.lampsOn = lampsOn;

        const post = ctxRef.get('post');
        const internalH = post && post.internal ? post.internal()[1] : ctxRef.size.height;
        const theta = pixelAngle(cam, internalH);

        // --- simulate ------------------------------------------------------

        tracks.clear();
        for (const veh of vehicles) {
          if (veh.turn) continue;
          const key = `${veh.axis}:${veh.line}:${veh.dir}:${veh.lane}`;
          let bucket = tracks.get(key);
          if (!bucket) { bucket = []; tracks.set(key, bucket); }
          bucket.push(veh);
        }
        for (const bucket of tracks.values()) {
          bucket.sort((a, b) => (a.s - b.s) * a.dir);
        }

        /**
         * Which lane, if any, the camera is standing in. Computed once: it is a
         * property of the frame, not of a vehicle, and evaluating it per
         * vehicle would be 160 copies of one answer.
         */
        camLane.axis = -1;
        for (let axis = 0; axis < 2; axis++) {
          const across = axis === 0 ? cam.position.z : cam.position.x;
          const along = axis === 0 ? cam.position.x : cam.position.z;
          const line = Math.round(across / CITY.chunkSize);
          const off = across - line * CITY.chunkSize;
          for (let dir = -1; dir <= 1; dir += 2) {
            for (let lane = 0; lane < LANE_OFFSET.length; lane++) {
              const want = axis === 0 ? dir * LANE_OFFSET[lane] : -dir * LANE_OFFSET[lane];
              if (Math.abs(off - want) > CAMERA_LANE_HALF) continue;
              camLane.axis = axis;
              camLane.line = line;
              camLane.dir = dir;
              camLane.lane = lane;
              camLane.s = along;
            }
          }
        }

        /**
         * The pedestrians, for the crossing yield below. `ctx.get` and not an
         * import (CONTRACT §0 rule 1), fetched once a frame rather than per
         * vehicle, and undefined whenever `?streetlife=0` or the module is
         * quarantined — in which case there is nobody in the road and the
         * permission is granted exactly as it was for thirty-two sessions.
         */
        const streetlife = ctxRef.get('streetlife');

        stats.turning = 0;
        stats.stopped = 0;
        queueNow.clear();
        stats.holdingAtRed = 0;
        stats.yieldedToPedestrian = 0;
        stats.recycledThisFrame = 0;
        // Run-cumulative, so they are published rather than reset. Session 29.
        stats.seedRejects = seedRejects;
        stats.seedFallbacks = seedFallbacks;
        /**
         * THE PER-FRAME WORST, BESIDE THE RUN-CUMULATIVE ONE — session 25.
         *
         * `worstStopLineM` only ever decreases, so its witness is only written
         * on the few frames a new record is set — and those cluster at the START
         * of a run, when every vehicle has just been seeded. A probe reading
         * only the record-setters therefore measures the FIRST SECONDS of the
         * simulation and reports it as a property of the traffic, which is
         * CONTRACT §9's shape with a sampling window. This field is reset every
         * frame, so a caller can build the distribution over the whole run.
         */
        stats.frameWorstStopLineM = Infinity;
        stats.frameWorstStopLineWitness = null;

        for (const bucket of tracks.values()) {
          for (let i = 0; i < bucket.length; i++) {
            const veh = bucket[i];
            const type = BODY_TYPES[veh.type];
            const want = FREE_SPEED * veh.pref * type.speed;
            let limit = want;

            // Car following. The gap a driver keeps is two metres plus 1.2
            // seconds of headway, which is what a real following distance is
            // once you stop quoting it in car lengths.
            const safe = 2.0 + veh.v * 1.2;
            const lead = bucket[i + 1];
            if (lead) {
              const gap = (lead.s - veh.s) * veh.dir - (type.len + BODY_TYPES[lead.type].len) * 0.5;
              if (gap < safe) limit = Math.min(limit, Math.max(0, lead.v * (gap / Math.max(0.1, safe))));
            }

            /**
             * THE CAMERA, AS A STOPPED VEHICLE. See CAMERA_CLEARANCE.
             *
             * Only when it is actually standing in THIS vehicle's lane — within
             * CAMERA_LANE_HALF of the lane centre, on the same line, ahead of
             * it. A camera on the pavement, on the other carriageway or on a
             * different street is not an obstacle and must not slow anything
             * down, or the whole system brakes for a viewpoint it cannot see.
             */
            if (camLane.axis === veh.axis && camLane.line === veh.line && camLane.lane === veh.lane) {
              const gapCam = (camLane.s - veh.s) * veh.dir - type.len * 0.5 - CAMERA_CLEARANCE;
              if (gapCam < safe) {
                limit = Math.min(limit, Math.max(0, FREE_SPEED * (gapCam / Math.max(0.1, safe))));
              }
            }

            /**
             * THE BUS STOPS — LOOK.md §4, deferred since session 29 and built
             * here. Session 33.
             *
             * The shelters have existed on both content paths since session 30
             * — `citygen.js` → `busStopAt`, 23 of them streamed and 2 in the
             * origin block — and nothing had ever stopped at one. This is the
             * consumer.
             *
             * "CLEAR OF THE RUNNING LANE" CANNOT MEAN A LAY-BY ON THIS LATTICE,
             * AND THE ARITHMETIC IS WHY. The kerb is at `roadHalfWidth` = 7.50.
             * The kerbside lane's centre is `LANE_OFFSET[1]` = 5.25 and the lane
             * half-pitch is 1.75, so the lane's outer edge is at 7.00 — leaving
             * 0.50 m between the running lane and the kerb. A bus is 2.55 m
             * wide. There is nowhere to pull into, anywhere in the city, and no
             * amount of trying changes 0.50 into 2.55.
             *
             * SO IT IS DELIVERED AS "CLEAR OF THE THROUGH LANE", WHICH IS WHAT
             * A KERBSIDE STOP IS IN THE WORLD: the bus halts in lane 1 and the
             * traffic behind it passes in lane 0. THE REFUSAL IS REAL AND IT IS
             * ITEM 4d's: a bus in the OFFSIDE lane does not serve the stop at
             * all, because stopping there would stand a 12 m vehicle across the
             * only lane that can pass one — and nothing in this project changes
             * lanes, so the honest answer is not to stop rather than to swerve
             * across a running lane to reach a kerb. `stats.busStopsRefused`
             * counts it, by reason.
             *
             * WHICH SIDE A STOP SERVES IS `lanePosition`'s OWN SIGN, not a new
             * convention: an axis-0 vehicle sits at `dir * off` in z and an
             * axis-1 vehicle at `-dir * off` in x, so a shelter on the `+side`
             * pavement is served by `dir = +side` on the x-running road and by
             * `dir = -side` on the z-running one. Getting this backwards stops
             * every bus on the far side of the street from its own shelter,
             * which is the same class of error `busStopAt`'s own comment records
             * about near and far junctions.
             */
            if (type.name === 'bus') {
              if (veh.dwell > 0) {
                veh.dwell -= dt;
                limit = 0;
                if (veh.dwell <= 0) {
                  veh.dwell = 0;
                  // Served. `servedAt` keeps it from re-stopping at the same
                  // shelter the instant it pulls away with its centre still
                  // inside the arrival tolerance.
                  veh.servedAt = veh.stopAt;
                  veh.stopAt = null;
                }
              } else {
                const stop = nextBusStop(veh, type);
                if (stop != null) {
                  const toDoor = (stop - veh.s) * veh.dir;
                  /**
                   * BERTHED WITHIN A DOOR WIDTH, NOT AT toDoor <= 0, AND THAT
                   * DISTINCTION IS THIS FILE'S OWN §9 INCIDENT ONE OBJECT OVER.
                   *
                   * The approach profile is `v = sqrt(2·a·s)`, which reaches
                   * s = 0 at v = 0 in finite time in continuous arithmetic and
                   * NEVER in discrete steps — each frame multiplies the
                   * remaining distance by a factor short of zero. The first
                   * draft tested `toDoor <= 0` and delivered **8 approaches and
                   * 0 berths in 40 s**: every bus crept toward its shelter for
                   * ever. The stop-line block below carries a long comment
                   * about exactly this shape, written in session 18, and it did
                   * not stop this from being written again.
                   *
                   * 1.00 m is a berthing accuracy and not an epsilon: a bus
                   * door is about 1.2 m wide, so a driver who stops within half
                   * a door of the flag has berthed. At the crawl the profile
                   * delivers there, the residual closes in well under a frame.
                   */
                  if (toDoor <= BUS_BERTH_M) {
                    veh.v = 0;
                    limit = 0;
                    veh.stopAt = stop;
                    veh.dwell = busDwellSeconds(veh);
                    stats.busStopsServed++;
                  } else {
                    limit = Math.min(limit, Math.sqrt(2 * BRAKE_A * toDoor));
                  }
                }
              }
            }

            /**
             * THE SIGNAL AT THE JUNCTION AHEAD — AND THE RED LIGHT NOW HOLDS.
             * =============================================================
             *
             * SESSION 18. The signals were never decorative: `signal(axis, now)`
             * is real, every vehicle reads it, and the two axes are never
             * simultaneously green. What was missing is that a red light had no
             * HOLD, and the reason is CONTRACT §9's shape with two predicates
             * instead of two lengths.
             *
             * The stop used to be one expression guarded by `toStop > 0`:
             *
             *     if (phase !== 0 && toStop > 0) limit = sqrt(2·BRAKE_A·toStop)
             *
             * `toStop > 0` was standing in for "may I proceed", and it is not
             * that quantity — it is "am I short of the line", which STOPS BEING
             * TRUE THE MOMENT THE VEHICLE ARRIVES. The speed profile
             * `v = sqrt(2·a·s)` reaches the line at v = 0 in finite time, the
             * guard goes false, the constraint vanishes, and the vehicle
             * accelerates at 1.4 m/s² through a red light from a standing start.
             * From 40 m out at 12 m/s on a permanent red it touches the line at
             * t = 6.283 s with v = 0.0397 m/s and is 473 m past it fifty seconds
             * later, back at free speed. Measured over the module's own
             * integration, 37.8% of junction-box entries were made while the
             * CROSSING axis had green — which is the "traffic drives through
             * itself at intersections" the walkthrough reported, and it is a
             * released vehicle rather than an unmodelled conflict.
             *
             * THE REPAIR IS A PERMISSION, NOT A LONGER GUARD, and it is the
             * cheap correct model the brief asked for with the reservation
             * table's own property: permission is KEYED BY THE JUNCTION, so it
             * cannot carry to the next one, and the conflict set needs no table
             * because the phase already guarantees the crossing axis is red.
             * `veh.cleared` holds the junction this vehicle may occupy.
             *
             *   GRANTED   on green; or on amber inside the dilemma zone, where
             *             stopping is no longer comfortable. Never on red.
             *   REVOKED   when the phase leaves green while there is still room
             *             to stop comfortably — otherwise a vehicle that was
             *             waved through at 200 m keeps its permission to the
             *             line and blows the red it watched turn.
             *   KEPT      once `toStop` is negative, i.e. inside the box, where
             *             `toStop > brakeDist` is false for any non-negative
             *             brakeDist. A vehicle in a junction must LEAVE it; the
             *             one thing worse than entering on red is stopping in
             *             the middle.
             *
             * And the hold itself is `max(0, toStop)` rather than `toStop`, so
             * a vehicle without permission that has crept a centimetre over the
             * line is limited to sqrt(0) = 0 and stays there instead of being
             * released by the sign of its own position.
             */
            const along = veh.s;
            const nextJ = nextJunctionAhead(along, veh.dir);
            /**
             * THE NOSE, NOT THE ORIGIN — session 19, item 7, and it is CONTRACT
             * §9's shape with two points on the same vehicle.
             *
             * `(nextJ - along) * veh.dir - STOP_LINE` is the distance from the
             * vehicle's ORIGIN to the stop line, and it was used as the distance
             * from its FRONT. The origin is the body centre — `type.boxes`'
             * offsets and `type.wheels`' are both measured from it and straddle
             * zero — so every vehicle stopped with its centre on the line and its
             * nose `len/2` beyond it:
             *
             *     front at 9.0 − len/2 from the node, near kerb at 7.5
             *     wedge  5.40 m → 1.20 m past the kerb
             *     van    6.00 m → 1.50 m past
             *     hauler 9.60 m → **3.30 m past**, 80% into the kerbside
             *                     crossing lane — the "halfway into the crossing
             *                     lane" the walkthrough reported
             *     moto   2.20 m → 0.40 m short, the only type that was right
             *
             * Fleet-weighted mean length 5.148 m, so the TYPICAL nose stopped
             * 1.07 m past the near kerb. And because the car-following model is
             * correct, the leader's error shifts the whole queue forward by it.
             *
             * THE SAME FILE ALREADY KNEW THE DIFFERENCE, which is what makes
             * this §9 rather than an oversight: car-following subtracts both
             * half-lengths and the camera-as-obstacle rule subtracts half the
             * camera's own length. The signal stop subtracted nothing.
             *
             * AND THE SIGNAL HEADS WERE THE INDEPENDENT WITNESS. `signalApproaches`
             * places each head at `STOP_LINE` back from the junction centre under
             * a comment saying that is "where the vehicles are already stopping".
             * A stopped hauler's nose was 4.8 m past its own signal head. That
             * comment is now true.
             *
             * The dilemma-zone argument is untouched: subtracting a per-vehicle
             * constant shifts the arrival test and the braking test by the same
             * amount. The worst case still fits — a hauler needs 36 m of braking
             * plus 4.8 m of overhang against 48 m of amber, margin 7.2 m.
             */
            const frontM = type.len * 0.5;
            // `stopLineClearanceM` is the same expression, shared with `seed()`
            // so the band the recycler refuses is the band this hold measures.
            const toStop = stopLineClearanceM(along, veh.dir, type);
            const phase = signal(veh.axis, now);
            const brakeDist = (veh.v * veh.v) / (2 * BRAKE_A);

            /**
             * THE YIELD — LOOK.md §4, session 33, and it is one term on the
             * permission rather than a second braking model.
             *
             * Pedestrians step off only on the red for the road they are
             * crossing, so in the ordinary case the vehicles they cross in
             * front of are already held and this term never fires. It fires on
             * the case the signal timing deliberately leaves open: the crossing
             * is timed on a 1.2 m/s design speed and this crowd walks 1.4 m/s
             * with a per-person spread, so the slow ones are still in the road
             * when the phase turns. A vehicle is then not granted the junction
             * until they are out of it.
             *
             * WITHHOLDING PERMISSION AND NOT ADDING AN OBSTACLE. The block
             * below already brakes comfortably to the stop line whenever
             * `veh.cleared !== nextJ`, and the car-following model already
             * queues everything behind it. So the yield costs one Set lookup
             * and inherits a braking profile and a queue that are both already
             * gated.
             *
             * AND IT CANNOT DEADLOCK A JUNCTION, for two reasons written down
             * rather than hoped for: the set is rebuilt from the agents every
             * frame (`streetlife.js` → `crossingOccupied`), so a re-seated or
             * quarantined pedestrian cannot leave a key behind; and the test is
             * only on GRANTING, so a vehicle already inside the box keeps its
             * permission and leaves — CONTRACT's own rule that the one thing
             * worse than entering on red is stopping in the middle.
             *
             * `veh.line * CITY.chunkSize` is the road's centreline in the other
             * axis, so the junction this vehicle is approaching is at
             * (nextJ, line·chunkSize) for axis 0 and (line·chunkSize, nextJ)
             * for axis 1 — the same pair `signalApproaches` places heads at.
             */
            let pedInRoad = false;
            if (streetlife && streetlife.crossingBlocked) {
              const jLineM = veh.line * CITY.chunkSize;
              pedInRoad = veh.axis === 0
                ? streetlife.crossingBlocked(nextJ, jLineM, 0)
                : streetlife.crossingBlocked(jLineM, nextJ, 1);
              if (pedInRoad) stats.yieldedToPedestrian++;
            }

            if (veh.cleared !== nextJ) {
              // Strictly less than, so a vehicle already on the comfortable
              // stopping profile — where toStop === brakeDist by construction —
              // is not granted permission by its own deceleration.
              if (!pedInRoad && (phase === 0 || (phase === 1 && toStop < brakeDist))) veh.cleared = nextJ;
            } else if ((phase !== 0 || pedInRoad) && toStop > brakeDist) {
              /**
               * REVOKED, AND `pedInRoad` IS THE SECOND REASON — session 33.
               *
               * The first is unchanged: a vehicle waved through on green at
               * 200 m must not keep its permission through the amber it watched
               * turn. The second is a person who stepped off after it was
               * granted — which happens because the crossings are timed on a
               * 1.2 m/s design speed and this crowd is not all above it.
               *
               * `toStop > brakeDist` GUARDS BOTH, and it is the same guard for
               * the same reason: permission is only ever taken back from a
               * vehicle that can still stop comfortably. One inside its own
               * braking distance keeps it and drives through, because the
               * alternative is a discontinuity in the velocity of a body the
               * camera can see, and because a vehicle stopped in a junction is
               * worse than one leaving it. What that leaves open is measured
               * rather than asserted away — `stats.pedConflictFrames` below.
               */
              veh.cleared = null;
            }

            /**
             * THE RESIDUAL, COUNTED. Vehicle-frames in which a vehicle holding
             * permission has some part of its body inside a crossing box that
             * somebody is standing on. This is the dilemma-zone case the
             * paragraph above cannot close, and the arithmetic says it cannot
             * be closed by timing either: a vehicle granted at the last instant
             * of amber is `v^2/2a` = 36 m from its line when the red begins and
             * needs (36 + 9.00 + 8.15 + 0.60 + len)/12 = 4.9 s (car) to 5.5 s
             * (bus) to clear the far crossing, while a 15.0 m carriageway at the
             * 1.2 m/s design speed takes 12.5 s of an 18 s red. 18 - 5.5 - 12.5
             * = 0.0 s. THE SIGNAL TIMING LEAVES EXACTLY ZERO SECONDS for a
             * fully protected pedestrian phase, and no arrangement of the
             * stepping-off rule changes that. So the number below is the honest
             * report of what the city delivers, not a bound anything passes.
             */
            if (pedInRoad && veh.cleared === nextJ) {
              const past = (along - nextJ) * veh.dir;
              const near = CITY.crossingFromJunctionM - CITY.crossingDepthM / 2;
              const far = CITY.crossingFromJunctionM + CITY.crossingDepthM / 2;
              const nose = Math.abs(past) + frontM;
              const tail = Math.abs(past) - frontM;
              if (nose > near && tail < far) stats.pedConflictFrames++;
            }

            if (veh.cleared !== nextJ) {
              limit = Math.min(limit, Math.sqrt(Math.max(0, 2 * BRAKE_A * Math.max(0, toStop))));
              if (veh.v < 0.05 && toStop < 1.0) {
                stats.holdingAtRed++;
                /**
                 * THE FREE GATE — session 19, item 7. The brief asked for it and
                 * it costs one comparison: the distance from a STATIONARY
                 * vehicle's front to its own stop line, worst case over the run.
                 *
                 * `toStop` IS that quantity now, so there is nothing to compute
                 * — which is the point. The assertion is `>= 0`: a vehicle held
                 * at a red whose nose is past the line it is held at is a defect,
                 * and it is one that never shows in a single frame because the
                 * frame it shows in is whichever one the queue happened to
                 * settle in. Before this session the delivered figure was
                 * −3.30 m on a hauler and −1.07 m on the fleet mean.
                 *
                 * Only vehicles WITHOUT permission are counted. One that has been
                 * granted the junction is supposed to drive through it, and its
                 * `toStop` goes negative legitimately; including it would make the
                 * statistic measure the green light.
                 */
                if (toStop < stats.frameWorstStopLineM) {
                  stats.frameWorstStopLineM = toStop;
                  stats.frameWorstStopLineWitness = {
                    toStopM: toStop,
                    recycled: !!veh.recycled,
                    framesSinceRecycle: veh.recycledAtFrame === undefined ? null : frameId - veh.recycledAtFrame,
                    type: type.name,
                    speedMps: veh.v,
                    phase,
                    pastJunctionM: (along - nextJ) * veh.dir,
                  };
                }
                if (toStop < stats.worstStopLineM) {
                  stats.worstStopLineM = toStop;
                  /**
                   * The witness. `sinceRecycle` is what separates the two worlds
                   * above: a vehicle re-seated within the last few frames is a
                   * teleport whose stop-line distance describes the recycler.
                   */
                  stats.worstStopLineWitness = {
                    toStopM: toStop,
                    recycled: !!veh.recycled,
                    framesSinceRecycle: veh.recycledAtFrame === undefined ? null : frameId - veh.recycledAtFrame,
                    type: type.name,
                    lenM: type.len,
                    speedMps: veh.v,
                    axis: veh.axis,
                    phase,
                    cleared: veh.cleared,
                    nextJ,
                    alongM: along,
                    /** Distance from the vehicle's ORIGIN past the junction centre; > 0 is inside the box. */
                    pastJunctionM: (along - nextJ) * veh.dir,
                  };
                }
                /**
                 * THE QUEUE, PER JUNCTION — session 21, and it is an
                 * INSTRUMENT rather than a threshold.
                 *
                 * The operator's aerial frame showed bumper-to-bumper traffic
                 * across several junctions and it looked permanent rather than
                 * like a signal cycle. Session 18's trace showed a queue
                 * building 0 → 29 and emptying exactly at `GREEN_S + AMBER_S`
                 * = 18 s, but that trace measured ONE junction in isolation,
                 * and a network can deadlock in a way no single junction shows.
                 *
                 * So this counts held vehicles by the junction they are held
                 * at, every frame, and `tools/queueprobe.mjs` reads the series
                 * over several full cycles. The distinction it exists to make:
                 * a queue that empties every cycle is CONGESTION BY DESIGN and
                 * the question is the density; a queue that grows without bound
                 * is a DEADLOCK and the question is the mechanism. Measure
                 * before theorising.
                 *
                 * The key is the junction's own identity — axis, line and node
                 * — rather than a position, so a vehicle approaching from
                 * either side of the same node is counted in the same queue,
                 * which is what "the junction is blocked" means.
                 */
                const qk = `${veh.axis}:${veh.line}:${nextJ}`;
                queueNow.set(qk, (queueNow.get(qk) || 0) + 1);
              }
            }

            veh.braking = limit < veh.v - 0.25;
            if (veh.braking) stats.stopped++;
            // Accelerate gently, brake at the comfortable rate.
            const a = limit > veh.v ? 1.4 : -BRAKE_A;
            veh.v = Math.max(0, Math.min(limit, veh.v + a * dt));

            // Motorcycles wander inside the lane. THE POINT IS THE MOTION
            // VECTOR, not the behaviour: a single-track vehicle crossing the
            // camera laterally is the case CONTRACT §5.11 was written for and
            // the one a spline-parameter reconstruction would have got wrong.
            if (type.name === 'moto') {
              if (rng.next() < 0.004) veh.latTarget = rng.range(-1.1, 1.1);
              veh.lat += (veh.latTarget - veh.lat) * Math.min(1, dt * 1.6);
            }

            /**
             * TURN AT A JUNCTION. Kerbside lane, right turns only, on green.
             *
             * The decision is made PER JUNCTION and not per frame: a per-frame
             * probability makes the turn rate depend on the frame rate, which
             * is the same class of mistake as a frame count standing in for a
             * duration. Each vehicle carries a countdown of junctions and turns
             * when it reaches zero.
             *
             * The turn point is where the quarter circle is tangent to the
             * entry lane, which is TURN_RADIUS + laneOffset before the junction
             * centre — 13.25 m for the kerbside lane, so 5.75 m before the
             * junction box. That is ahead of the stop line at 9.0 m, so a
             * vehicle that arrives on red stops at the line without having
             * started to turn, and its countdown carries to the next junction.
             */
            if (veh.lastJ !== nextJ) {
              veh.lastJ = nextJ;
              if (veh.junctionsLeft > 0) veh.junctionsLeft--;
            }
            const toTurn = (nextJ - along) * veh.dir - (TURN_RADIUS + LANE_OFFSET[veh.lane]);
            if (
              veh.lane === 1 && !veh.turn && phase === 0 && veh.junctionsLeft === 0 &&
              toTurn <= 0 && toTurn > -3 && veh.v > 1.0 &&
              /**
               * A body too long for the arc does not take it. See
               * MAX_TURN_HALF_LEN_M: the excursion is L^2/(2R) and the bound is
               * the 1.75 m lane half-pitch. Tested on the TYPE's half-length
               * rather than on a flag in the table, so a later retune of `len`
               * moves the eligibility with it instead of leaving a stale
               * boolean behind (§9.1's config-the-code-does-not-read).
               */
              type.len * 0.5 <= MAX_TURN_HALF_LEN_M
            ) {
              // Start the arc from where the vehicle actually is, not from the
              // tangent point it has already passed by up to one frame's travel.
              veh.turn = { t: -toTurn, len: (Math.PI / 2) * TURN_RADIUS, j: nextJ, entryLine: veh.line };
              veh.indicating = 1;
              veh.junctionsLeft = rng.int(2, 7);
            }

            veh.s += veh.dir * veh.v * dt;
            /**
             * AND A VEHICLE WITHOUT PERMISSION DOES NOT CROSS ITS BAR, EVEN BY
             * A FRACTION OF THE LAST STEP — SESSION 34.
             *
             * The hold above is a SPEED limit, `sqrt(2·a·max(0, toStop))`, and
             * a speed limit integrated in discrete steps overshoots by whatever
             * the last step was worth. Measured over 25 920 frames after the
             * seeding fix closed everything else: **`worstStopLineM` =
             * −0.00027777775946535854 m**, which is 0.28 mm and is a RED gate,
             * because the floor is zero and `-0.000` printed at three decimals
             * cannot be told from zero.
             *
             * `traffic.js` HAS THIS EXACT PARAGRAPH ALREADY, ABOUT THE OTHER
             * END OF THE SAME PROFILE. Session 18 wrote it about `toStop > 0`
             * never firing because `v = sqrt(2·a·s)` reaches `s = 0` only in the
             * limit, and STATE 33 §5.2 records session 33 making the same
             * mistake 400 lines away with `toDoor <= 0` on a bus. Both are the
             * same statement: **the profile is asymptotic in continuous time and
             * neither exact nor monotone in discrete time**, so the arrival has
             * to be asserted positionally and not waited for.
             *
             * So the position is clamped to the bar rather than the speed being
             * nudged. It moves a body by at most one frame of travel at a speed
             * already under 0.05 m/s — 0.8 mm — and it makes the guarantee
             * EXACT rather than asymptotic, which is what a floor of zero
             * requires. `toStop` is this frame's value, before the step, so the
             * clamp is `s` put back to where the clearance is zero.
             *
             * ITERATED, AND THE REASON IS ARITHMETIC RATHER THAN PHYSICS. One
             * pass leaves **−1.82e-13 m** — six ulps of a double at 128 m, the
             * cancellation residue of `(nextJ − s)·dir − STOP_LINE − len/2`
             * recomputed after `s` moved. The floor is exactly zero, so six
             * ulps is a RED gate, and CONTRACT §0 rule 6 is the reason this is
             * closed at the source instead of by a tolerance: the honest move
             * when a decision falls inside an instrument's noise is to remove
             * the noise, never to widen the line. Clamping through the SAME
             * function that measures it is what makes the guarantee the
             * measured quantity rather than a second description of it — the
             * residue is driven to zero in two passes and the third is a
             * backstop, not an expectation.
             */
            if (veh.cleared !== nextJ) {
              for (let k = 0; k < 3; k++) {
                const over = stopLineClearanceM(veh.s, veh.dir, type);
                if (over >= 0) break;
                veh.s += over * veh.dir;
              }
            }
          }
        }

        // Turning vehicles, integrated by arc length so speed is continuous.
        for (const veh of vehicles) {
          if (!veh.turn) continue;
          stats.turning++;
          veh.v += (TURN_SPEED - veh.v) * Math.min(1, dt * 2.2);
          veh.turn.t += veh.v * dt;
          if (veh.turn.t >= veh.turn.len) {
            /**
             * Rejoin on the crossing road, kerbside lane, turned right.
             *
             * Worked for the concrete case so the sign flips are checkable:
             * entry axis 0, dir +1 (east), lane 1, so the entry lane is
             * z = 128*i + 5.25 and the junction is x = 128*j. Turning right
             * leaves the vehicle heading +Z, which on axis 1 is dir +1, and the
             * exit lane on that road is x = 128*j - 5.25. The arc's exit point
             * is (128*j - 5.25, 128*i + 5.25 + R), so the new position along the
             * exit road is s = 128*i + (R + 5.25). Entering on axis 1 dir +1
             * instead, the right turn ends heading -X, which is axis 0 dir -1 —
             * hence the sign flip, and it is the only asymmetry between the two
             * axes.
             */
            const exitAxis = veh.axis === 0 ? 1 : 0;
            const entryLine = veh.turn.entryLine;
            const jLine = Math.round(veh.turn.j / CITY.chunkSize);
            const exitDir = veh.axis === 0 ? veh.dir : -veh.dir;
            const over = veh.turn.t - veh.turn.len;
            veh.axis = exitAxis;
            veh.line = jLine;
            veh.dir = exitDir;
            veh.s = entryLine * CITY.chunkSize + exitDir * (TURN_RADIUS + LANE_OFFSET[1] + over);
            veh.lastJ = null;
            veh.turn = null;
            veh.indicating = 0;
          }
        }

        // --- recycle -------------------------------------------------------
        for (const veh of vehicles) {
          if (veh.turn) continue;
          lanePosition(veh.axis, veh.line, veh.dir, veh.lane, veh.s, pos);
          const dx = pos.x - cam.position.x;
          const dz = pos.z - cam.position.z;
          const offRoad = riverNoRoad(rootSeed, pos.x, pos.z, veh.axis === 0)
            || landmarkUnderBody(pos.x, pos.z, veh.axis, veh.type)
            || blockUnderBody(pos.x, pos.z, veh.axis, veh.type)
            /** Session 54 — past the city's edge there is no lattice. See `seed`. */
            || cityExtentAt(pos.x, pos.z) <= 0;
          if (dx * dx + dz * dz > SIM_RADIUS * SIM_RADIUS || offRoad) {
            /**
             * Out of the ring, OR driven onto a road the river took, OR onto
             * one a landmark took — session 34 added the third, and the second
             * and third are one statement about the delivered road network
             * rather than two rules. See `landmarkOccupies` in `citygen.js`.
             *
             * The river case is a vehicle that was seeded on a legitimate
             * north–south line and has reached the bank of a crossing with no
             * bridge; recycling it is what the ring already does to anything
             * whose position has stopped being somewhere a vehicle can be, and
             * `seed` marks it `recycled` so §5.12 carries its motion row
             * rather than drawing a vector across the whole ring.
             */
            seed(veh, cam.position, fwd, false);
            stats.recycledThisFrame++;
            if (offRoad) stats.recycledOffRoad++;
          }
        }

        // --- write the instances -------------------------------------------

        const bodyArr = bodyMotion.begin(frameId);
        const lightArr = lightMotion.begin(frameId);
        const wheelArr = wheelMotion.begin(frameId);
        const bodyCol = bodyMesh.instanceColor.array;
        const lightCol = lightMesh.instanceColor.array;
        const wheelCol = wheelMesh.instanceColor.array;
        const rough = bodyGeo.attributes.noctisRough.array;
        const wheelRough = wheelGeo.attributes.noctisRough.array;
        const grime = bodyGeo.attributes.noctisGrime.array;

        suppressed = 0;

        for (let vi = 0; vi < vehicles.length; vi++) {
          const veh = vehicles[vi];
          const type = BODY_TYPES[veh.type];
          let px;
          let pz;
          let yaw;

          if (veh.turn) {
            // The quarter circle. Right turn: the centre sits TURN_RADIUS to
            // the vehicle's right of the entry line, and the arc runs from
            // tangent-to-entry to tangent-to-exit.
            //
            // RIGHT = cross(heading, up). For h = (hx, 0, hz) and up = (0,1,0)
            // that is (-hz, 0, hx): heading +X gives +Z, heading +Z gives -X.
            // Written out because getting it backwards turns every vehicle the
            // wrong way into oncoming traffic, which is a defect that looks
            // like a lane-assignment bug rather than a sign error.
            const a = veh.turn.t / TURN_RADIUS;
            lanePosition(veh.axis, veh.line, veh.dir, veh.lane, veh.turn.j - veh.dir * (TURN_RADIUS + LANE_OFFSET[veh.lane]), pos);
            const hx = veh.axis === 0 ? veh.dir : 0;
            const hz = veh.axis === 0 ? 0 : veh.dir;
            const rx = -hz;
            const rz = hx;
            const cx = pos.x + rx * TURN_RADIUS;
            const cz = pos.z + rz * TURN_RADIUS;
            const sa = Math.sin(a);
            const ca = Math.cos(a);
            px = cx + (-rx * ca + hx * sa) * TURN_RADIUS;
            pz = cz + (-rz * ca + hz * sa) * TURN_RADIUS;
            yaw = Math.atan2(hx * ca + rx * sa, hz * ca + rz * sa);
          } else {
            lanePosition(veh.axis, veh.line, veh.dir, veh.lane, veh.s, pos);
            const hx = veh.axis === 0 ? veh.dir : 0;
            const hz = veh.axis === 0 ? 0 : veh.dir;
            px = pos.x + (veh.axis === 0 ? 0 : veh.lat);
            pz = pos.z + (veh.axis === 0 ? veh.lat : 0);
            yaw = Math.atan2(hx, hz);
          }

          const dx = px - cam.position.x;
          const dz = pz - cam.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);

          /**
           * THE SIZE THRESHOLD. tools/budget.json -> motionVectors.
           *
           * An instance whose smallest projected extent is under four pixels
           * cannot express reprojection error the 3x3 neighbourhood clamp would
           * catch, so it gets no motion vector and the previous transform is
           * forced equal to the current one. That path is the same `carry` a
           * recycled vehicle takes, because they want the same thing.
           */
          const cutoff = motionCutoffDistance(type.min, 4, theta);
          const below = dist > cutoff;
          const suppress = veh.recycled || below || firstFrame;
          if (below) suppressed++;

          // Body boxes. spec[6] is the offset along the vehicle's own length,
          // and local +Z is the heading, so it maps to (sin yaw, cos yaw).
          const syaw = Math.sin(yaw);
          const cyaw = Math.cos(yaw);
          for (let b = 0; b < BOXES_PER_VEHICLE; b++) {
            const row = vi * BOXES_PER_VEHICLE + b;
            const spec = type.boxes[b];
            const lx = spec[6];
            writeRow(
              bodyArr, bodyMotion, row,
              px + syaw * lx, spec[3], pz + cyaw * lx, yaw,
              spec[2], spec[1], spec[0],
              suppress
            );
            const alb = spec[4] || bodyAlbedo(veh, vi);
            /**
             * `rowAlbScale` is 1.0 everywhere except the seam rows (0.55), so
             * row 0 — the row `instanceColourPalette()` reads as this
             * vehicle's paint — is always the unscaled palette entry and the
             * written-vs-delivered comparison keeps comparing paint to paint.
             */
            const scale = type.rowAlbScale[b];
            bodyCol[row * 3 + 0] = alb[0] * scale;
            bodyCol[row * 3 + 1] = alb[1] * scale;
            bodyCol[row * 3 + 2] = alb[2] * scale;
            rough[row] = spec[5];
            grime[row] = grimeLevel(veh, vi) * type.rowGrime[b];
          }

          /**
           * WHEELS. `spec` is [along, lateral, diameter, width], and the world
           * position is the vehicle's plus `along` down its heading plus
           * `lateral` down its RIGHT — which is (-cos yaw, 0, sin yaw), the
           * same convention the turn arc uses. Getting the right vector's sign
           * wrong puts every wheel on the wrong side, which on a symmetric set
           * of four is invisible; it is written out because the next thing to
           * use it may not be symmetric.
           *
           * The centre height is the radius, so the wheel stands ON the road
           * rather than in it. That single line is what the ground-contact
           * assertion measures: below the body's lower edge there is now
           * 0.29 to 0.49 m of tyre and shadowed sill instead of more paint.
           */
          for (let w = 0; w < WHEELS_PER_VEHICLE; w++) {
            const row = vi * WHEELS_PER_VEHICLE + w;
            const spec = type.wheels[w];
            const along = spec[0];
            const lat = spec[1];
            const dia = spec[2];
            writeRow(
              wheelArr, wheelMotion, row,
              px + syaw * along - cyaw * lat,
              dia * 0.5,
              pz + cyaw * along + syaw * lat,
              yaw,
              spec[3], dia, dia,
              suppress
            );
            wheelCol[row * 3 + 0] = TYRE[0];
            wheelCol[row * 3 + 1] = TYRE[1];
            wheelCol[row * 3 + 2] = TYRE[2];
            wheelRough[row] = 0.86;
          }

          // Light lines. `kind` picks the chromaticity and the gain, and the
          // brake gain is the one thing on a vehicle that changes frame to
          // frame — which is what makes the stopping legible.
          const sigRows = type.sigLights[veh.sig];
          for (let l = 0; l < LIGHTS_PER_VEHICLE; l++) {
            const row = vi * LIGHTS_PER_VEHICLE + l;
            const spec = sigRows[l];
            if (!spec) {
              // A body type with fewer light lines than the allocation parks
              // its spare rows. A parked row is written IDENTICALLY every
              // frame, so its previous transform already equals its current one
              // and it needs no `carry` after the first — carrying it anyway
              // would patch the read buffer on every frame of the run and throw
              // away the whole point of swapping instead of copying.
              writeRow(lightArr, lightMotion, row, 0, -1000, 0, 0, 0.0001, 0.0001, 0.0001, firstFrame);
              lightCol[row * 3 + 0] = 0;
              lightCol[row * 3 + 1] = 0;
              lightCol[row * 3 + 2] = 0;
              continue;
            }
            const lx = spec[3];
            /**
             * `spec[6]` is the lateral offset, down the vehicle's RIGHT, which
             * is `(-cos yaw, sin yaw)` — the same convention the wheels use, and
             * written out here for the same reason it is written out there: the
             * sign is invisible on a symmetric pair and would put every
             * asymmetric signature on the wrong side.
             */
            const lt = spec[6] || 0;
            writeRow(
              lightArr, lightMotion, row,
              px + syaw * lx - cyaw * lt, spec[4], pz + cyaw * lx + syaw * lt, yaw,
              spec[2], spec[1], spec[0],
              suppress
            );
            let chroma;
            let nits;
            if (spec[5] === 0) {
              // Position lamp after dark, running lamp in daylight.
              chroma = coolDay;
              nits = lampsOn ? NITS_FRONT : NITS_FRONT_DAY;
            } else if (spec[5] === 1) {
              // A brake lamp works at every hour; a tail lamp is a night lamp.
              chroma = EMITTER_CHROMA.neonRed;
              nits = veh.braking ? NITS_BRAKE : (lampsOn ? NITS_TAIL : 0);
            } else if (spec[5] === 3) {
              /**
               * The bus saloon. A night light and nothing else: an interior lit
               * at noon delivers nothing against 100 000 lux and would be a
               * emitter budget spent on a frame that cannot show it. `veh.cab`
               * is the per-vehicle interior gain that already exists for the
               * marker row, so two buses in a queue are not the same object.
               */
              chroma = warmCabin;
              nits = lampsOn ? NITS_INTERIOR * (0.6 + 0.4 * veh.cab) : 0;
            } else {
              chroma = EMITTER_CHROMA.sodium;
              nits = lampsOn ? NITS_MARKER * veh.cab : 0;
            }
            const g = nits / NITS_MAX;
            lightCol[row * 3 + 0] = chroma[0] * g;
            lightCol[row * 3 + 1] = chroma[1] * g;
            lightCol[row * 3 + 2] = chroma[2] * g;
          }

          // Remember where this vehicle's headlamp would go. The pool is
          // assigned after every vehicle has a position, because "nearest 96"
          // is not a fact about any one of them.
          veh.hx = syaw;
          veh.hz = cyaw;
          veh.px = px;
          veh.pz = pz;
          veh.d2 = dx * dx + dz * dz;
          veh.nose = type.len * 0.45;

          /**
           * Session 25: stamp the frame the re-seat happened on before the flag
           * is cleared, so `worstStopLineWitness` can say how long ago a vehicle
           * was teleported. `recycled` itself lives exactly one frame, and a
           * re-seated vehicle takes several to come to a stand — so the flag
           * alone cannot tell a teleport from a red-light overshoot and the
           * frame number can.
           */
          if (veh.recycled) veh.recycledAtFrame = frameId;
          veh.recycled = false;
        }

        /**
         * Assign the headlamp pool to the nearest HEADLAMP_SLOTS vehicles.
         *
         * Sorted by squared distance, which is a comparison and not a length —
         * 160 square roots a frame for an ordering that does not need them.
         * Spares are parked with `enabled = false` rather than removed:
         * `lights.remove` is an indexOf-splice that reindexes the light array,
         * and churn in that array reindexes every froxel. Same reasoning
         * city.js gives for never adding or removing a street lamp after boot.
         */
        if (lampPool.length) {
          lampOrder.length = 0;
          for (let i = 0; i < vehicles.length; i++) lampOrder.push(i);
          lampOrder.sort((a, b) => vehicles[a].d2 - vehicles[b].d2);
          const lit = Math.min(lampPool.length, lampOrder.length);
          for (let k = 0; k < lampPool.length; k++) {
            const L = lampPool[k];
            if (k >= lit) { L.enabled = false; continue; }
            const veh = vehicles[lampOrder[k]];
            L.enabled = lampsOn;
            L.position.set(veh.px + veh.hx * veh.nose, HEAD_HEIGHT, veh.pz + veh.hz * veh.nose);
            L.direction.set(veh.hx, -Math.sin(HEAD_DIP), veh.hz).normalize();
          }
          stats.litVehicles = lampsOn ? lit : 0;
        }

        writeSignals(ctxRef, cam, now, lightArr, lightCol);

        bodyMotion.commit();
        lightMotion.commit();
        wheelMotion.commit();
        firstFrame = false;

        bodyMesh.instanceMatrix = bodyMotion.current();
        lightMesh.instanceMatrix = lightMotion.current();
        wheelMesh.instanceMatrix = wheelMotion.current();
        bodyMesh.instanceMatrix.needsUpdate = true;
        lightMesh.instanceMatrix.needsUpdate = true;
        wheelMesh.instanceMatrix.needsUpdate = true;
        bodyGeo.setAttribute('noctisPrevInstanceMatrix', bodyMotion.read(frameId));
        lightGeo.setAttribute('noctisPrevInstanceMatrix', lightMotion.read(frameId));
        wheelGeo.setAttribute('noctisPrevInstanceMatrix', wheelMotion.read(frameId));
        // The other per-frame uploads, withheld by the same instrument switch
        // as the instmotion attributes. `tools/uploadprobe.mjs`.
        if (!uploadFrozen) {
          bodyMesh.instanceColor.needsUpdate = true;
          lightMesh.instanceColor.needsUpdate = true;
          wheelMesh.instanceColor.needsUpdate = true;
          bodyGeo.attributes.noctisRough.needsUpdate = true;
          wheelGeo.attributes.noctisRough.needsUpdate = true;
          bodyGeo.attributes.noctisGrime.needsUpdate = true;
        }

        stats.suppressedByThreshold = suppressed;
        stats.cutoffM = +motionCutoffDistance(0.8, 4, theta).toFixed(1);
        frameId++;
      }

      /**
       * Body albedo. **A LOOKUP NOW, NOT A STRIDE** — session 30.
       *
       * It used to be `PAINT[(vi * 7 + type * 3) % 8]`, whose comment said 7
       * and 8 are coprime so consecutive vehicles never share a paint. That is
       * true and it is also what made every entry equally likely, which over a
       * table with five of eight entries inside a 1.32x luminance band put
       * 62.5% of the fleet the colour of the road. A stride cannot express a
       * distribution; the roll is at construction now, from the class's own
       * weights, and this reads it. See the module-level `PAINT`.
       *
       * `vi` is unused and is kept in the signature because the grime function
       * beside it takes the same pair and the two are called together.
       */
      function bodyAlbedo(veh, vi) {   // eslint-disable-line no-unused-vars
        return PAINT[veh.paint].albedo;
      }

      /**
       * How neglected this vehicle is, deterministic per vehicle for the same
       * reason `bodyAlbedo` is (rebuild runs every frame; an rng here would
       * shimmer). 16 levels because 16 is coprime with the palette's 8-stride
       * walk at stride 5, so paint and filth do not correlate — a fleet where
       * every oxide-red vehicle is also the filthy one reads as two liveries
       * rather than as wear.
       *
       * The floor is 0.30, not zero: "slightly grubby" is the brief, and a
       * vehicle at zero grime would be the showroom object this fleet is not.
       * The span reaches 1.0 so a few vehicles are genuinely filthy — at full
       * strength the lower flank sits at vertex-curve 0.72 x 1.0 = 0.72 of
       * the shader's maximum darkening.
       */
      function grimeLevel(veh, vi) {
        return 0.30 + 0.70 * (((vi * 5 + veh.type * 7) % 16) / 15);
      }

      // --- seed and first frame -------------------------------------------

      {
        const camPos = ctx.camera.position;
        const f = { x: 0, z: -1 };
        for (const veh of vehicles) seed(veh, camPos, f, true);
      }

      /**
       * The boot line. CONTRACT §9 rule 4 — every number here is derived from
       * another number in a different file and both halves are printed.
       */
      const theta0 = pixelAngle(ctx.camera, ctx.size.height);
      const roadLen = ((2 / CITY.chunkSize) * Math.PI * SIM_RADIUS * SIM_RADIUS);
      const roadLen0 = roadLen;
      cutoffLog =
        `traffic: ${count} vehicles, ${HEADLAMP_SLOTS} headlamps assigned by distance = ` +
        `${HEADLAMP_SLOTS} of ${CLUSTER.trafficLightReserve} reserved traffic slots ` +
        `(pool cap ${CLUSTER.maxLights}), lit out to ` +
        `${Math.sqrt((roadLen0 * HEADLAMP_SLOTS) / count / (0.015625 * Math.PI)).toFixed(0)} m; ` +
        `${BODY_TYPES.length} body types, roof heights ` +
        `${BODY_TYPES.map((t) => t.boxes.reduce((a, b) => Math.max(a, b[3] + b[1] / 2), 0).toFixed(2)).join(' / ')} m; ` +
        `${roadLen.toFixed(0)} m of centreline inside ${SIM_RADIUS} m -> one vehicle every ` +
        `${(roadLen / count).toFixed(1)} m, ${((3600 * FREE_SPEED) / ((roadLen / count) * 4)).toFixed(0)} veh/h/lane at ` +
        `${FREE_SPEED} m/s; headlamp ${HEAD_CANDELA} cd in a ${((HEAD_OUTER * 180) / Math.PI).toFixed(0)} deg cone = ` +
        `${(HEAD_CANDELA / (24.8 * 24.8)).toFixed(1)} lux at the 24.8 m the dipped beam meets the road, against ` +
        `${LIGHT.streetAverageLux} lux ambient; motion cutoff at 4 px: ` +
        /**
         * THE CUTOFFS FROM THE TYPES THEMSELVES, WHICH THIS LINE DID NOT DO.
         * It printed "moto 0.80 m" and "car 1.45 m" — two hand-written numbers
         * that had been 0.54 and 1.42 in the delivered table since session 6b,
         * so the boot line was reporting a suppression distance the module does
         * not use. That is §9.1's config-the-code-does-not-read pointed the
         * other way: a LOG that does not read the code. Both are gone; every
         * cutoff below is `type.min`, which is what `rebuild` passes.
         */
        `${BODY_TYPES.map((t) => `${t.name} ${t.min.toFixed(2)} m -> ` +
          `${motionCutoffDistance(t.min, 4, theta0).toFixed(0)} m`).join(', ')} ` +
        `(theta = ${theta0.toExponential(4)} rad); ` +
        /**
         * THE §7.5 STRADDLE MARGIN, WHICH IS THE CONSTRAINT THE `top` CURVES
         * ARE SHAPED AGAINST, PRINTED BESIDE THE PROBE HEIGHT IT IS A MARGIN
         * ON. The probe stands at 0.50 of the subject's own height and reads a
         * station against the boxes that straddle it; the smallest gap between
         * a SAMPLED section's top and that probe is what decides whether the
         * nose stations — where the taper is — are read or dropped. A negative
         * number here means the loft has been retuned past its own instrument.
         */
        `width probe / margin of the lowest sampled section over it: ` +
        `${BODY_TYPES.map((t) => `${t.name} ${t._probeH.toFixed(2)} m +${t._straddle.toFixed(2)}`).join(', ')}; ` +
        /**
         * SESSION 9's derived numbers, both halves printed (§9 rule 4):
         * secLen from (len - seams x SEAM_LEN) / SECTIONS per type, the seam
         * positions the walk actually placed, and the row arithmetic the
         * triangle budget is written against.
         */
        `body rows ${BOXES_PER_VEHICLE} = ${SECTIONS} sections + ${SEAMS_PER_VEHICLE} seams + glaze + sill ` +
        `-> ${BOXES_PER_VEHICLE * SECTION_TRIANGLES} tris/vehicle (14 rows / 392 before s9); secLen ` +
        `${BODY_TYPES.map((t) => `${t.name} (${t.len} - ${SEAMS_PER_VEHICLE}x${SEAM_LEN})/${SECTIONS} = ` +
          `${t._secLen.toFixed(3)} m, seams @ ${t._seamAlong.map((a) => a.toFixed(2)).join(' / ')}`).join('; ')}; ` +
        /**
         * SESSION 29 item 2, §9 rule 4: the signature vocabulary and what the
         * roll actually DELIVERED, side by side. A vocabulary of four that
         * delivers one is the shape this whole item exists to end, and it would
         * be invisible in any count of rows.
         */
        `light signatures ${SIGNATURES.length} (${SIGNATURES.map((s) => s.name).join('/')}) in ` +
        `${LIGHTS_PER_VEHICLE} rows/vehicle -> ${count * LIGHTS_PER_VEHICLE} + ${signalCount} = ${lightCount} light rows; ` +
        `delivered ${SIGNATURES.map((s, i) => `${s.name} ${vehicles.filter((v) => v.sig === i).length}`).join(' / ')}; ` +
        `allowed per class ${BODY_TYPES.map((t) => `${t.name} ${t.sigAllowed.map((i) => SIGNATURES[i].name).join('+')}`).join(', ')}; ` +
        `bus saloon ${NITS_INTERIOR} cd/m2 = ${(NITS_INTERIOR / LIGHT.windowNits).toFixed(2)}x LIGHT.windowNits ` +
        `over ${(BODY_TYPES.find((t) => t.name === 'bus') ? 5.80 * 0.86 : 0).toFixed(2)} m2 a flank; ` +
        `signals ${GREEN_S}/${AMBER_S}/${GREEN_S}/${AMBER_S} s, amber covers ` +
        `${(AMBER_S * FREE_SPEED).toFixed(0)} m against a ${((FREE_SPEED * FREE_SPEED) / (2 * BRAKE_A)).toFixed(0)} m ` +
        `braking distance, so the dilemma zone is empty; prev-instance buffers ` +
        // All THREE layers. This line summed two of them and called the total
        // the buffers, which understated it by the wheels' 640 rows.
        `${((bodyMotion.addedBytes + lightMotion.addedBytes + wheelMotion.addedBytes) / 1024).toFixed(1)} KiB ` +
        `(${bodyCount} + ${lightCount} + ${wheelCount} rows x 64 B x 2)`;
      console.log('[noctis] ' + cutoffLog);

      const api = {
        vehicles: count,
        bodyTypes: BODY_TYPES.length,
        /**
         * THE INSTRUMENT ARM FOR THE UPLOAD HYPOTHESIS. See
         * `src/core/instmotion.js` -> `setUploadFrozen` for what it withholds
         * and why, and `tools/uploadprobe.mjs` for the only caller. Frozen, the
         * vehicles stop moving on screen and every count stays identical: same
         * draw calls, same triangles, same instances, same materials, still
         * drawn and still visible. It is an isolation and not a mode, and no
         * gate may set it.
         */
        setUploadFrozen(b) {
          uploadFrozen = !!b;
          bodyMotion.setUploadFrozen(b);
          lightMotion.setUploadFrozen(b);
          wheelMotion.setUploadFrozen(b);
        },
        stats() {
          /**
           * The queue census, summarised at READ time rather than kept in step
           * every frame. Two numbers a caller can assert on and the whole map
           * for one that wants the series (`tools/queueprobe.mjs`).
           */
          let worst = 0;
          let queued = 0;
          for (const v of queueNow.values()) { if (v > 0) queued++; if (v > worst) worst = v; }
          stats.worstQueue = worst;
          stats.queuedJunctions = queued;
          return {
            ...stats,
            /** Held vehicles by junction, this frame. An instrument; no threshold. */
            queueByJunction: Object.fromEntries(queueNow),
            body: bodyMotion.stats,
            light: lightMotion.stats,
            wheel: wheelMotion.stats,
            addedBytes: bodyMotion.addedBytes + lightMotion.addedBytes + wheelMotion.addedBytes,
            /**
             * The smallest overall body dimension per type, COMPUTED from the
             * boxes and wheels rather than read off `min`. `perfcheck` asserts
             * it against `budget.motionVectors.kindMinExtentM`, so the gate
             * compares the geometry the module builds against the number the
             * budget declares — two paths to one quantity, CONTRACT §9 rule 2.
             * Comparing `min` to the budget would compare two declarations and
             * verify neither.
             */
            minExtentM: Object.fromEntries(BODY_TYPES.map((t) => {
              let len = 0;
              let wide = 0;
              let high = 0;
              for (const b of t.boxes) {
                len = Math.max(len, Math.abs(b[6]) + b[0] / 2);
                wide = Math.max(wide, b[2] / 2);
                high = Math.max(high, b[3] + b[1] / 2);
              }
              for (const w of t.wheels) {
                len = Math.max(len, Math.abs(w[0]) + w[2] / 2);
                wide = Math.max(wide, Math.abs(w[1]) + w[3] / 2);
                high = Math.max(high, w[2]);
              }
              return [t.name, +Math.min(len * 2, wide * 2, high).toFixed(2)];
            })),
            declaredMinExtentM: Object.fromEntries(BODY_TYPES.map((t) => [t.name, t.min])),
          };
        },
        /** CONTRACT §5.12. What `harness.instanceMotionStats()` collects. */
        motionLayers() {
          return [bodyMotion.stats, lightMotion.stats, wheelMotion.stats];
        },
        /**
         * Where the wheels are throwing water, for the weather module's spray
         * layer. Positions only: a module that had to know about vehicles to
         * draw spray would be two modules that import each other.
         */
        sprayPoints(out, max) {
          let n = 0;
          for (const veh of vehicles) {
            if (n >= max) break;
            if (veh.v < 2) continue;
            const type = BODY_TYPES[veh.type];
            lanePosition(veh.axis, veh.line, veh.dir, veh.lane, veh.s, pos);
            out[n * 4 + 0] = pos.x;
            out[n * 4 + 1] = 0.12;
            out[n * 4 + 2] = pos.z;
            out[n * 4 + 3] = veh.v / FREE_SPEED;
            n++;
          }
          return n;
        },
        signalPhase(axis) {
          const time = ctx.get('time');
          return signal(axis, time ? time.now : 0);
        },
        /**
         * The phase AND how much of it is left, for a consumer that has to
         * decide whether something fits inside it — `streetlife.js` asking
         * whether a red covers 15 m of carriageway before it steps a person off
         * a kerb. Session 33.
         *
         * THE ARITHMETIC IS `signal()`'s OWN, one line further on, so there is
         * exactly one place where `GREEN_S` and `AMBER_S` mean anything and no
         * second copy of the cycle for another module to drift from — CONTRACT
         * §9.1's whole subject. `rel` is the time since this axis's green
         * began; the three boundaries are the three the phase test uses.
         */
        signalAt(axis, now) {
          const t = ((now % CYCLE_S) + CYCLE_S) % CYCLE_S;
          const mine = axis === 0 ? 0 : GREEN_S + AMBER_S;
          const rel = (((t - mine) % CYCLE_S) + CYCLE_S) % CYCLE_S;
          if (rel < GREEN_S) return { phase: 0, remaining: GREEN_S - rel };
          if (rel < GREEN_S + AMBER_S) return { phase: 1, remaining: GREEN_S + AMBER_S - rel };
          return { phase: 2, remaining: CYCLE_S - rel };
        },
        _internal: { vehicles, BODY_TYPES, lanePosition, signal },
      };

      // The first frame has to exist before anything reads the buffers.
      rebuild(ctx, 1 / 60);

      this._rebuild = rebuild;
      this._lastNow = null;
      this._teardown = () => {
        if (lights) for (const L of lampPool) lights.remove(L);
        ctx.scene.remove(group);
        bodyGeo.dispose();
        lightGeo.dispose();
        wheelGeo.dispose();
        bodyMat.dispose();
        lightMat.dispose();
        bodyMotion.dispose();
        lightMotion.dispose();
        wheelMotion.dispose();
      };

      return api;
    },

    /**
     * ADVANCE ON THE SIMULATED CLOCK, NOT ON `dt`. CONTRACT §3.
     *
     * `dt` is wall-clock seconds. `ctx.get('time')` owns the simulated clock and
     * it can be PAUSED, which is exactly what `harness.setTimeOfDay` does before
     * every look capture. A traffic system that integrated raw `dt` kept driving
     * through a paused world, so the dry capture and the wet capture — which are
     * supposed to differ in one thing — saw the traffic in two different places.
     *
     * Measured: `wetOverDry:dawn` reported the wet road's luminance spread at
     * 0.6788 against the dry road's 0.7237, a ratio of 0.94 where the gate wants
     * 1.6. Wetting a road cannot LOWER its spread; the two numbers were not
     * describing the same scene. Nothing about water was wrong, and no amount of
     * looking at the reflection model would have found it.
     *
     * So the step is the difference of the time module's own `now`, clamped to
     * the same [0, 0.1] the core clamps `dt` to. When time is paused the
     * difference is zero and the whole system holds still — which is also what
     * makes a capture reproducible (§4.2: a capture that depends on wall-clock
     * timing is not a capture).
     */
    update(ctx, dt) {
      const time = ctx.get('time');
      let step = dt;
      if (time) {
        const now = time.now;
        step = this._lastNow == null ? 0 : Math.min(0.1, Math.max(0, now - this._lastNow));
        this._lastNow = now;
      }
      if (this._rebuild) this._rebuild(ctx, step);
    },

    dispose() {
      if (this._teardown) this._teardown();
      this._teardown = null;
      this._rebuild = null;
      this._lastNow = null;
    },
  };
}
