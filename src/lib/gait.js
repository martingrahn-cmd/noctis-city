/**
 * gait.js — the walking model, and the GLSL emitted from it. CONTRACT §7.
 *
 * Same arrangement as `atmosphere.js`: one model, two emissions. The vertex
 * shader displaces the limbs (`lights.js` injects `GAIT_GLSL`) and the harness
 * has to project the SAME displaced vertices when it hands a gate a silhouette
 * (`harness.silhouettes`), because a gate that measures the delivered frame
 * against the rest pose is measuring two different figures. Two copies of a
 * displacement formula is CONTRACT §9.1's shape — the drift is silent and the
 * symptom is a mask that is nearly right — so there is one copy, here, and the
 * GLSL is built from the same constants the JS reads.
 *
 * WHY THE LIMBS SHEAR RATHER THAN ROTATE, which is the only interesting
 * decision in the file.
 *
 * A leg rotated about the hip by `a` puts its foot `L·sin a` fore or aft and
 * `L·(1 − cos a)` ABOVE the ground. Those two are not independently choosable:
 * a 0.75 m step at a 0.855 m hip height needs a = asin(0.375/0.855) = 26.0°,
 * and the foot then rises L(1 − cos 26°) = 8.7 cm at maximum splay. Dropping
 * the pelvis by that much to keep the feet down is a stiff-legged compass walk
 * and it bobs 8.7 cm where a human bobs 2 to 4 — the difference being knee
 * flexion and pelvic obliquity, which this geometry does not have. Dropping it
 * by the human 3 cm instead leaves the foot 5.7 cm off the pavement, and at the
 * ten to fifteen metres the street shot shows, 5.7 cm is FOURTEEN PIXELS at the
 * gate's resolution — a figure skating rather than walking.
 *
 * So the limb is sheared instead: a point `f` metres below the pivot moves
 * `f · shear · sin(2πu)` along the body's own forward axis and does not move
 * vertically at all. The foot plants exactly, by construction rather than by
 * cancellation, and the step length is not a consequence of the model — it IS
 * the constant, since at f = hip height the displacement is `±stepM/2`. A
 * sheared leg is a bent leg's silhouette to within the knee's own offset, which
 * at these distances is the part nobody can see.
 *
 * The vertical bob is then free to be the measured quantity rather than a
 * by-product, and it is: 3 cm peak to peak, twice per cycle.
 */

/**
 * The model's constants. Every one is a length in metres of the REFERENCE body
 * (`BODY_REF_HEIGHT` in streetlife.js); an instance scaled to 1.90 m gets a
 * proportionally longer step because the whole displacement rides inside the
 * instance's own uniform scale.
 */
export const GAIT = {
  /**
   * m/s. FREE-FLOW WALKING SPEED ON A LEVEL PAVEMENT, and it is here rather
   * than in `streetlife.js` because `stepM` below is derived FROM it and the
   * two must not be able to drift (CONTRACT §9 rule 4: when a number is derived
   * from another, print both).
   *
   * It was in `streetlife.js` as `WALK_SPEED_MEAN = 1.4` and in the comment on
   * `stepM` as the premise of 0.75, in two files, since session 10. Session 17
   * needed a third reader — the player controller, which may not import a
   * module (CONTRACT §2.2) — and three copies of a number is the arrangement
   * §9.1 is written about. `streetlife.js` now reads this one.
   *
   * 1.40 m/s = 5.04 km/h. `streetlife.js` draws each pedestrian's own speed
   * from N(1.40, 0.18) clipped to [0.95, 1.90], so a player at exactly 1.40 is
   * at the crowd's mean by construction rather than by eye.
   */
  walkSpeedMps: 1.4,

  /**
   * Metres of travel per step. Free-flow walking at `walkSpeedMps` = 1.4 m/s
   * runs a cadence near 1.87 steps/s, and 1.4/1.87 = 0.75 m. One full gait
   * cycle — left step then right step, after which every joint is back where it
   * started — is therefore 1.5 m, and that is the period of `u`.
   */
  stepM: 0.75,

  /**
   * Metres. Hip pivot height on the reference body, and the denominator of the
   * leg shear. It is the height the leg's sections are authored to hang from,
   * not a separate number that has to agree with them.
   */
  hipHeightM: 0.855,

  /** Metres. Shoulder pivot height on the reference body. */
  shoulderHeightM: 1.45,

  /** Metres. Rest height of the hand, so the arm shear has a length to work over. */
  handHeightM: 0.62,

  /**
   * Metres, PEAK TO PEAK. Vertical excursion of the centre of mass in normal
   * gait is 2 to 4 cm; 3 is the middle of the band. Twice per cycle, because
   * the body rises at each mid-stance and falls at each double support.
   */
  comRiseM: 0.03,

  /**
   * Metres, amplitude at the ankle. NOT half the step length, and the
   * difference is 12.5 cm of leg that would otherwise read as a lunge.
   *
   * A 0.75 m step is not 0.75 m of hip swing. Hip flexion/extension in normal
   * walking runs about +20°/−15°, so the hip-to-ankle line swings roughly ±17°,
   * which at a 0.855 m hip height is ±0.25 m and puts the ankles 0.50 m apart
   * at full splay. The remaining 0.25 m of the step comes from pelvic rotation
   * about the vertical (about 8°, so ±0.06 m a side) and from the foot rolling
   * heel to toe (about 0.13 m) — neither of which this geometry has.
   *
   * THE FIRST DRAFT USED HALF THE STEP LENGTH, on the argument that it made the
   * step length true by construction. It made the ankle separation true instead
   * and the walk false: measured in frame at 10 m, a figure at full splay read
   * as a fencer's lunge, because a sheared leg does not shorten and a sinusoid
   * spends most of its time near its extremes. The step length remains 0.75 m —
   * it is what `pathLength` advances the phase by — and this is how much of it
   * the legs are asked to show.
   *
   * WHAT IT ALSO DECIDES, AND NOBODY HAD CHECKED: WHETHER THE PLANTED FOOT
   * SLIDES. This model has no stance phase — both feet move sinusoidally in
   * antiphase, all the time — so "does the foot stay put" is not a question
   * about a state machine, it is one line of arithmetic. A foot's position
   * along the path is `s + A·sin(2πs/C)` for cycle length `C = 2·stepM`, so its
   * ground speed relative to the pavement is
   *
   *     d/ds = 1 + (2πA/C)·cos(2πs/C),   zero at mid-stance when A = C/2π.
   *
   * C/2π = 1.5/6.2832 = **0.2387 m** and `ankleSwingM` is **0.25 m** — 4.7%
   * over. So the planted foot creeps BACKWARDS at 4.7% of walking speed at the
   * bottom of the stance, over the 0.60 rad of phase where the term is negative,
   * and the whole excursion integrates to **4.5 mm**. At 1.4 m/s that is 6.6 cm
   * a second of peak slip velocity and 4.5 mm of actual travel; at the ten
   * metres a street shot shows, 4.5 mm is a tenth of a pixel.
   *
   * The number is not tuned to that and must not be: it is a hip-swing
   * amplitude with a derivation of its own above, and the near-coincidence with
   * C/2π is worth recording precisely because the next session might otherwise
   * change one of the two and not notice it had moved the other. If the step
   * length ever changes, this is the line that says what it costs.
   */
  ankleSwingM: 0.25,

  /**
   * Metres, amplitude at the wrist. Arm swing in free walking carries the hand
   * roughly 10 to 15 cm fore and aft, counter-phase to the leg on the same
   * side — which is what stops a walking figure from reading as a marching one.
   */
  handSwingM: 0.13,

  /**
   * Seconds. How long the swing takes to fade out when somebody stops, and to
   * fade back in when they set off. Without it a figure entering a dwell keeps
   * its legs frozen at whatever part of the stride it stopped in, which reads
   * as a photograph of a walk rather than as somebody standing.
   */
  dwellFadeS: 0.28,
};

/** One full cycle: two steps. The period of `u`, in metres travelled. */
export const GAIT_CYCLE_M = 2 * GAIT.stepM;

/**
 * m/s. THE WALK–RUN TRANSITION, DERIVED FROM THE LEG THIS MODEL ALREADY HAS.
 *
 * Dynamic similarity: a legged gait leaves walking — an inverted pendulum
 * vaulting over a stiff stance limb — when the centripetal demand at the hip
 * exceeds what gravity can supply, i.e. at Froude number `v²/(g·L) = 1`. The
 * observed preferred transition in humans is about half of that, Fr ≈ 0.5,
 * because the pendulum stops being economical before it stops being possible.
 * `L` is the pivot height of the leg, which this model already owns as
 * `hipHeightM`:
 *
 *   v = sqrt(0.5 · 9.81 m/s² · 0.855 m) = sqrt(4.194) = 2.048 m/s = 7.37 km/h
 *
 * Printed beside the two speeds it bounds: `walkSpeedMps` 1.40 m/s is 0.68× it
 * (a walk), and `streetlife.js`'s fastest drawn walker at 1.90 m/s is 0.93× it
 * — still a walk, which is why the crowd never needs a second animation.
 *
 * Nothing in the renderer reads this. It exists so that a speed can be called
 * a run for an arithmetic reason rather than for an adjectival one.
 */
export const RUN_TRANSITION_MPS = Math.sqrt(0.5 * 9.81 * GAIT.hipHeightM);

/**
 * Fore/aft displacement per metre below the pivot. Dimensionless, signed by the
 * limb: at the foot, `f` equals the hip height and the displacement is
 * `ankleSwingM`, so the ankles stand 2 × 0.25 = 0.50 m apart at full splay
 * inside a 0.75 m step.
 */
export const LEG_SHEAR = GAIT.ankleSwingM / GAIT.hipHeightM;

/** The same ratio for an arm, evaluated at the hand's rest height. */
export const ARM_SHEAR = GAIT.handSwingM / (GAIT.shoulderHeightM - GAIT.handHeightM);

const TAU = Math.PI * 2;

/**
 * The displacement of one vertex, in the body's own local space: +Z is forward
 * (the instance matrix is a yaw about Y and `yaw = atan2(hx, hz)` maps local +Z
 * onto the heading), +Y is up.
 *
 * @param {number} shear   signed shear ratio for this vertex's limb; 0 for the trunk
 * @param {number} pivotY  the joint this limb hangs from, in local metres
 * @param {number} y       the vertex's own local height
 * @param {number} u       cycle parameter in [0,1), = distance travelled / GAIT_CYCLE_M
 * @param {number} amp     0 standing, 1 walking
 * @returns {{dy: number, dz: number}}
 */
export function gaitOffset(shear, pivotY, y, u, amp) {
  const f = Math.max(0, pivotY - y);
  return {
    dy: GAIT.comRiseM * 0.5 * amp * (1 - Math.cos(2 * TAU * u)),
    dz: f * shear * amp * Math.sin(TAU * u),
  };
}

/**
 * The same function, for the vertex shader. Built from the constants above so
 * the two cannot disagree about a number; what they could still disagree about
 * is the SHAPE of the expression, which is why the JS above is written as a
 * transliteration of this string and not as an independent derivation.
 *
 * `pivotY - y` and not `abs`: a vertex ABOVE its pivot — the top of a thigh
 * section that overlaps the hip — must not swing backwards when the foot swings
 * forward, and clamping at zero is what pins the limb to its joint.
 */
export const GAIT_GLSL = /* glsl */ `
vec3 noctisGaitOffset(float shear, float pivotY, float y, float u, float amp) {
  float f = max(0.0, pivotY - y);
  return vec3(
    0.0,
    ${GAIT.comRiseM.toFixed(6)} * 0.5 * amp * (1.0 - cos(${(2 * TAU).toFixed(7)} * u)),
    f * shear * amp * sin(${TAU.toFixed(7)} * u)
  );
}
`;

/**
 * The line that prints the model's numbers next to the numbers they were
 * derived from — CONTRACT §9 rule 4, for a set of constants that are consumed
 * in three files (the geometry authors the pivots, the shader displaces about
 * them, the harness projects the result).
 */
export function gaitDerivation() {
  return (
    `gait: step ${GAIT.stepM} m over a ${GAIT_CYCLE_M} m cycle; leg shear ` +
    `${LEG_SHEAR.toFixed(4)} = ${GAIT.ankleSwingM}/${GAIT.hipHeightM} m of hip height, so the ankle ` +
    `reaches ±${(LEG_SHEAR * GAIT.hipHeightM).toFixed(3)} m and the ankles stand ` +
    `${(2 * LEG_SHEAR * GAIT.hipHeightM).toFixed(2)} m apart at full splay inside a ` +
    `${GAIT.stepM} m step — the balance being pelvic rotation and the foot's own roll, which this ` +
    `geometry does not have. Arm shear ${ARM_SHEAR.toFixed(4)} = ${GAIT.handSwingM}/` +
    `(${GAIT.shoulderHeightM} − ${GAIT.handHeightM}) m, counter-phase. Bob ${GAIT.comRiseM} m peak to ` +
    `peak twice a cycle = ${(GAIT.comRiseM * 1000).toFixed(0)} mm against the 20–40 mm measured in ` +
    `normal gait. A ROTATION about the hip at this step length would need ` +
    `${((Math.asin(LEG_SHEAR) * 180) / Math.PI).toFixed(1)}° and lift the foot ` +
    `${(GAIT.hipHeightM * (1 - Math.cos(Math.asin(LEG_SHEAR))) * 1000).toFixed(0)} mm, which is why the ` +
    `limbs shear. At 1.4 m/s the cycle is ${(1.4 / GAIT_CYCLE_M).toFixed(2)} Hz and the bob ` +
    `${((2 * 1.4) / GAIT_CYCLE_M).toFixed(2)} Hz. ` +
    `Foot slip: no-slip amplitude C/2pi = ${(GAIT_CYCLE_M / (2 * Math.PI)).toFixed(4)} m against ` +
    `ankleSwingM ${GAIT.ankleSwingM} m, ` +
    `${(((GAIT.ankleSwingM * 2 * Math.PI) / GAIT_CYCLE_M - 1) * 100).toFixed(1)}% over, so the planted ` +
    `foot creeps BACK ${(footSlipM() * 1000).toFixed(1)} mm per stance, at a peak slip of ` +
    `${(((GAIT.ankleSwingM * 2 * Math.PI) / GAIT_CYCLE_M - 1) * 100).toFixed(1)}% of walking speed ` +
    `(${((((GAIT.ankleSwingM * 2 * Math.PI) / GAIT_CYCLE_M - 1)) * 1.4 * 100).toFixed(1)} cm/s at 1.4 m/s).`
  );
}

/**
 * The backward excursion of the planted foot over one stance, in metres.
 *
 * Closed form rather than a sample. The foot's ground speed in units of the
 * body's own is `1 + g·cos(theta)` with `g = 2*pi*A/C`. It is negative on
 * `theta` in `(d, 2*pi - d)` where `d = acos(-1/g)`, an interval of width
 * `2*pi - 2d`, and integrating over it gives a signed travel of
 *
 *     (C/2pi) · [ (2*pi - 2d) - 2g·sin d ]
 *
 * which is negative; this returns its magnitude, the distance the foot goes
 * BACKWARDS. Zero, exactly, when `g <= 1` — a model at or under the no-slip
 * amplitude has a foot that never reverses at all, and returning 0 there is the
 * arithmetic saying so rather than a clamp hiding a negative.
 *
 * Printed by `gaitDerivation()` beside the two numbers it is derived FROM,
 * which is CONTRACT §9 rule 4 and the reason it is a function and not a
 * constant somebody would have to keep in step with `ankleSwingM`.
 */
export function footSlipM() {
  const g = (2 * Math.PI * GAIT.ankleSwingM) / GAIT_CYCLE_M;
  if (g <= 1) return 0;
  const d = Math.acos(-1 / g);
  return (GAIT_CYCLE_M / (2 * Math.PI)) * (2 * g * Math.sin(d) - (2 * Math.PI - 2 * d));
}
