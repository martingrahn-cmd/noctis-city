/**
 * solar.js — where the sun and moon actually are.
 *
 * CONTRACT §3: sun direction is derived, never authored. The warm light at
 * timeOfDay 0.78 exists because the sun is at +2° and its light has crossed
 * forty air masses, not because someone added an orange tint at t=0.78.
 *
 * Simplifications, stated here so nobody hunts for them later:
 *   - Solar time only. No equation of time, no longitude, no timezone.
 *     timeOfDay 0.5 is solar noon by definition.
 *   - Declination from the standard first-order approximation. Error ≲ 0.5°,
 *     which moves sunset by under two minutes.
 *   - The moon is a toy model: a body opposite the sun, offset by phase, on a
 *     fixed declination. It is here to give night frames a second key light
 *     and a shape, not to predict an eclipse.
 */

export const DEG = Math.PI / 180;

/** Solar declination in radians. N is day of year, 1..365. */
export function solarDeclination(dayOfYear) {
  return 23.44 * DEG * Math.sin((2 * Math.PI * (dayOfYear - 81)) / 365);
}

/**
 * Hour angle in radians. 0 at solar noon, negative in the morning,
 * +π at midnight. timeOfDay is normalised [0,1) with 0 = solar midnight.
 */
export function hourAngle(timeOfDay) {
  return (timeOfDay - 0.5) * 2 * Math.PI;
}

/**
 * Convert equatorial (declination, hour angle) to horizontal (elevation, azimuth).
 * Azimuth is clockwise from north as seen from above — CONTRACT §3.1.
 */
export function horizontal(declination, H, latitudeRad) {
  const sinLat = Math.sin(latitudeRad);
  const cosLat = Math.cos(latitudeRad);
  const sinDec = Math.sin(declination);
  const cosDec = Math.cos(declination);

  const sinEl = sinLat * sinDec + cosLat * cosDec * Math.cos(H);
  const elevation = Math.asin(Math.max(-1, Math.min(1, sinEl)));

  // atan2 form: unambiguous across the whole sky, unlike the acos form which
  // needs a separate morning/afternoon branch and gets it wrong at the poles.
  const azimuth = Math.atan2(
    -cosDec * Math.sin(H),
    cosLat * sinDec - sinLat * cosDec * Math.cos(H)
  );

  return { elevation, azimuth };
}

/** Unit vector from the origin toward (azimuth, elevation). CONTRACT §3.1. */
export function dirFromAzEl(azimuth, elevation, out = { x: 0, y: 0, z: 0 }) {
  const ce = Math.cos(elevation);
  out.x = Math.sin(azimuth) * ce;
  out.y = Math.sin(elevation);
  out.z = -Math.cos(azimuth) * ce;
  return out;
}

/** Sun position for a given time of day. */
export function sunPosition(timeOfDay, latitudeDeg, dayOfYear) {
  const dec = solarDeclination(dayOfYear);
  const H = hourAngle(timeOfDay);
  const { elevation, azimuth } = horizontal(dec, H, latitudeDeg * DEG);
  return { elevation, azimuth, declination: dec, hourAngle: H };
}

/**
 * Moon position. phase 0 = new, 0.5 = full.
 * At full moon the moon is opposite the sun, so it is highest at solar midnight —
 * which is the property we actually need for a night frame that has any shape.
 */
export function moonPosition(timeOfDay, latitudeDeg, phase, declinationDeg = 8) {
  const H = hourAngle(timeOfDay) + Math.PI - (phase - 0.5) * 2 * Math.PI;
  const dec = declinationDeg * DEG;
  const { elevation, azimuth } = horizontal(dec, H, latitudeDeg * DEG);
  return { elevation, azimuth, declination: dec, hourAngle: H };
}

/** Fraction of the lunar disc that is lit. phase 0 = new, 0.5 = full. */
export function moonIlluminatedFraction(phase) {
  return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

/**
 * Illuminance from the moon at the top of the atmosphere, in lux.
 * Full moon at zenith is ~0.267 lux. Brightness falls faster than the lit
 * fraction because a gibbous moon is lit at a grazing angle — the exponent is
 * an empirical fit to the lunar phase curve, not a physical derivation.
 */
export function moonIlluminance(phase) {
  const f = moonIlluminatedFraction(phase);
  return 0.267 * Math.pow(f, 1.8);
}

/**
 * Local sidereal-ish rotation for the star field, in radians.
 * Stars share the sun's hour-angle sweep; they only need to move consistently,
 * not to be in the right constellations.
 */
export function starRotation(timeOfDay) {
  return hourAngle(timeOfDay);
}
