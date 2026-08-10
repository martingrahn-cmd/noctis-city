/**
 * color.js — colour maths in linear sRGB.
 *
 * CONTRACT §5.2: everything is linear until the final pass. Nothing here
 * encodes, decodes or gamma-corrects. Lamp colours are specified as colour
 * temperatures because that is what a lamp has; hex triples for light sources
 * are how a scene ends up with a sodium lamp that is not sodium-coloured.
 */

/** Rec.709 / linear-sRGB luminance. */
export function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * CIE xy chromaticity of a Planckian radiator, Kang et al. (2002).
 * Valid 1667 K – 25000 K, which covers every light source in a city:
 * high-pressure sodium ~2000 K, tungsten 2700 K, fluorescent 4000 K,
 * daylight 6500 K, and the blue-white LED signage at 7000 K.
 */
export function kelvinToXY(kelvin) {
  const T = Math.max(1667, Math.min(25000, kelvin));
  const T2 = T * T;
  const T3 = T2 * T;

  let x;
  if (T <= 4000) {
    x = -0.2661239e9 / T3 - 0.2343589e6 / T2 + 0.8776956e3 / T + 0.179910;
  } else {
    x = -3.0258469e9 / T3 + 2.1070379e6 / T2 + 0.2226347e3 / T + 0.240390;
  }

  const x2 = x * x;
  const x3 = x2 * x;
  let y;
  if (T <= 2222) {
    y = -1.1063814 * x3 - 1.34811020 * x2 + 2.18555832 * x - 0.20219683;
  } else if (T <= 4000) {
    y = -0.9549476 * x3 - 1.37418593 * x2 + 2.09137015 * x - 0.16748867;
  } else {
    y = 3.0817580 * x3 - 5.87338670 * x2 + 3.75112997 * x - 0.37001483;
  }

  return [x, y];
}

/** CIE XYZ (D65-referred) to linear sRGB. */
export function xyzToLinearRGB(X, Y, Z) {
  return [
    3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z,
    -0.969266 * X + 1.8760108 * Y + 0.041556 * Z,
    0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z,
  ];
}

/**
 * Colour temperature to linear sRGB, normalised to luminance 1.
 * Multiply by an intensity in lux / candela / nits to get a light.
 *
 * Values below ~2500 K go slightly negative in blue — they sit outside the
 * sRGB gamut, which is true of real sodium light. Clamping to zero is the
 * honest thing to do: we cannot show a colour the display cannot make.
 */
export function kelvinToLinearRGB(kelvin) {
  const [x, y] = kelvinToXY(kelvin);
  const Y = 1;
  const X = (x / y) * Y;
  const Z = ((1 - x - y) / y) * Y;
  const rgb = xyzToLinearRGB(X, Y, Z);
  rgb[0] = Math.max(0, rgb[0]);
  rgb[1] = Math.max(0, rgb[1]);
  rgb[2] = Math.max(0, rgb[2]);
  const L = luminance(rgb[0], rgb[1], rgb[2]);
  if (L <= 0) return [1, 1, 1];
  return [rgb[0] / L, rgb[1] / L, rgb[2] / L];
}

/**
 * Narrow-band emitters — neon, argon, LED signage — are not blackbodies and
 * kelvinToLinearRGB cannot describe them. These are specified as linear sRGB
 * directly, normalised to luminance 1 so intensity stays in nits.
 *
 * They are deliberately not the standard teal/magenta pair. authored-city.md §4:
 * a real neon street is mostly sodium orange and dirty fluorescent, with a few
 * saturated signs that read *because* everything around them is drab.
 */
export const EMITTER_CHROMA = {
  sodium: normaliseLuminance([1.0, 0.42, 0.06]),
  tungsten: normaliseLuminance([1.0, 0.70, 0.42]),
  fluorescentDirty: normaliseLuminance([0.86, 1.0, 0.80]),
  fluorescentCold: normaliseLuminance([0.80, 0.92, 1.0]),
  neonRed: normaliseLuminance([1.0, 0.09, 0.08]),
  neonAmber: normaliseLuminance([1.0, 0.45, 0.05]),
  neonGreen: normaliseLuminance([0.16, 1.0, 0.30]),
  neonCyan: normaliseLuminance([0.10, 0.78, 1.0]),
  neonMagenta: normaliseLuminance([1.0, 0.10, 0.62]),
  mercuryBlue: normaliseLuminance([0.30, 0.55, 1.0]),
};

export function normaliseLuminance(rgb) {
  const L = luminance(rgb[0], rgb[1], rgb[2]);
  if (L <= 0) return [1, 1, 1];
  return [rgb[0] / L, rgb[1] / L, rgb[2] / L];
}

/** Linear interpolation of two linear-sRGB triples. No gamma involved. */
export function mixRGB(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * A LINEAR RGB REFLECTANCE PACKED INTO TWO FLOATS, AT 12 BITS A CHANNEL.
 *
 * Session 15. It exists because a pedestrian program binds 16 of ANGLE's 16
 * vertex attributes (STATE §7, and the seventeenth failed to LINK), so a third
 * independent colour zone could not have a third attribute — but an attribute
 * SLOT is a vec4 whether the shader declares vec4 or vec3, and `noctisBodyColor`
 * and `noctisGarment` were both vec3. Widening them costs zero slots and yields
 * two spare floats, which is this.
 *
 * ONE COPY, TWO EMISSIONS — the arrangement `lib/gait.js` and `lib/atmosphere.js`
 * already use, and for the identical reason: the packer runs in JS in
 * `streetlife.js` and the unpacker runs in GLSL in `lights.js`, and a pack and
 * an unpack that live in two files are two descriptions of one convention with
 * nothing comparing them (CONTRACT §9.1). Here the arithmetic is written once
 * and the shader half is emitted from the same constants.
 *
 * WHY IT IS EXACT. `hi = round(r·4095)·4096 + round(g·4095)` is at most
 * 4095·4096 + 4095 = 16 777 215 = 2^24 − 1, and a float32 mantissa represents
 * every integer to 2^24 without loss, so the value survives the attribute
 * upload and `floor(hi / 4096)` recovers `r` exactly. It is not an
 * approximation that happens to work; it is the largest exact packing the
 * format allows.
 *
 * WHY 12 BITS AND NOT 8. Eight bits a channel fits in ONE float and would have
 * left the second spare, which is tempting. These are LINEAR reflectances and
 * the ones that matter are dark — a 0.04 trouser cloth has ten 1/255 steps
 * across it and the banding shows on a leg at four metres. 1/4095 is 0.024% of
 * full scale and 0.6% of that same dark cloth.
 */
export const ZONE_PACK_SCALE = 4095;
export const ZONE_PACK_BASE = 4096;

/** @returns {[number, number]} the two floats, for the `w` of two vec4s. */
export function packZone12(rgb) {
  const q = (v) => Math.max(0, Math.min(ZONE_PACK_SCALE, Math.round(v * ZONE_PACK_SCALE)));
  return [q(rgb[0]) * ZONE_PACK_BASE + q(rgb[1]), q(rgb[2])];
}

/** The inverse, in JS, so a test can assert the round trip rather than assume it. */
export function unpackZone12(hi, lo) {
  const r = Math.floor(hi / ZONE_PACK_BASE);
  return [r / ZONE_PACK_SCALE, (hi - r * ZONE_PACK_BASE) / ZONE_PACK_SCALE, lo / ZONE_PACK_SCALE];
}

/** The same inverse, as GLSL, emitted from the same two constants. */
export const ZONE_UNPACK_GLSL = /* glsl */ `
vec3 noctisUnpackZone(float hi, float lo) {
  float r = floor(hi / ${ZONE_PACK_BASE}.0);
  return vec3(r, hi - r * ${ZONE_PACK_BASE}.0, lo) / ${ZONE_PACK_SCALE}.0;
}
`;
