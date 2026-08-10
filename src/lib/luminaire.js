/**
 * luminaire.js — the flux of the analytic street-lighting distribution.
 *
 * Pure: numbers in, one number out. No state, no ctx, no three.
 *
 * WHY THIS EXISTS
 *
 * Sessions 1 and 2 both modelled the streetlight's leak — the light a
 * semi-cutoff optic throws outside its own beam — as "9% of the peak candela,
 * radiated isotropically". That is a fraction applied to the wrong quantity,
 * and the error is not small. A 2200 cd point source radiating 9% of itself in
 * every direction emits 4π × 198 = 2488 lumens; the beam it is supposedly
 * leaking from emits about 5700. The "9% leak" was 44% of the luminaire, an
 * unshaped wash sitting exactly where the pattern was supposed to be, and it
 * is most of why the carriageway had no gradient on it that survived the pool
 * gate's threshold.
 *
 * A leak is a fraction of *lumens*. To turn a fraction of lumens back into the
 * candela of an isotropic source you need the beam's flux, which is what this
 * computes: the solid-angle integral of the distribution described in
 * LUMINAIRE, including the elliptical shaping, so that changing the optic
 * changes the leak with it rather than leaving a number behind that used to be
 * right.
 *
 * Integrated numerically rather than in closed form. The closed form exists —
 * the 1/cos³ core integrates to a difference of secants — but the elliptical
 * cutoff does not, and an algebra slip here is a silent factor on every
 * streetlight in the city. A few thousand multiplies at load, once.
 */

/**
 * Luminous flux of one luminaire, in lumens.
 *
 * The distribution, in the luminaire's own frame with γ measured from the beam
 * axis and the transverse direction squeezed by `acrossScale`:
 *
 *   I(γ') = peak · min(1, (cos γp / cos γ')³) · smoothstep(cos γc, cos γi, cos γ')
 *
 * where γ' is the angle after the elliptical shaping — the same expression the
 * shader evaluates per fragment, so the flux and the pixels describe one optic.
 *
 * @param {number} peakCandela      peak intensity, cd
 * @param {object} optic            { alongRoadRad, acrossRoadRad, peakAngleRad, edgeRad }
 * @param {number} [steps]          quadrature resolution per axis
 * @returns {number} lumens
 */
export function luminaireFlux(peakCandela, optic, steps = 96) {
  const cutoff = optic.alongRoadRad;
  const inner = cutoff - optic.edgeRad;
  const cosCut = Math.cos(cutoff);
  const cosInner = Math.cos(inner);
  const cosPeak = Math.cos(optic.peakAngleRad);
  const acrossScale = Math.tan(cutoff) / Math.tan(optic.acrossRoadRad);

  // Hemisphere below the luminaire, in (γ, φ). dΩ = sin γ dγ dφ. The upper
  // hemisphere is empty: this is a cutoff optic, which is the entire point of
  // one — a luminaire that lit the sky would be a different fixture and a
  // different comment.
  const dGamma = Math.PI / 2 / steps;
  const dPhi = (2 * Math.PI) / steps;

  let flux = 0;
  for (let i = 0; i < steps; i++) {
    const gamma = (i + 0.5) * dGamma;
    const sinG = Math.sin(gamma);
    const cosG = Math.cos(gamma);
    for (let j = 0; j < steps; j++) {
      const phi = (j + 0.5) * dPhi;
      // The shaping, written the same way the shader writes it: the transverse
      // component is scaled and the direction renormalised.
      const alongComp = sinG * Math.cos(phi);
      const acrossComp = sinG * Math.sin(phi) * acrossScale;
      const shapedCos = cosG / Math.hypot(cosG, alongComp, acrossComp);

      let atten = smoothstep(cosCut, cosInner, shapedCos);
      if (atten <= 0) continue;
      atten *= Math.min(1, Math.pow(cosPeak / Math.max(shapedCos, 1e-3), 3));
      flux += peakCandela * atten * sinG * dGamma * dPhi;
    }
  }
  return flux;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0 || 1e-6)));
  return t * t * (3 - 2 * t);
}
