import * as THREE from 'three';

export const DEG = Math.PI / 180;
export const TAU = Math.PI * 2;

/** Unit direction for a right ascension / declination (radians) in the engine frame (Y is the celestial north pole). */
export function dirFromRaDec(ra: number, dec: number, out = new THREE.Vector3()) {
  const cd = Math.cos(dec);
  return out.set(cd * Math.cos(ra), Math.sin(dec), -cd * Math.sin(ra));
}

export function raDecFromDir(v: THREE.Vector3) {
  const dec = Math.asin(Math.max(-1, Math.min(1, v.y)));
  let ra = Math.atan2(-v.z, v.x);
  if (ra < 0) ra += TAU;
  return { ra, dec };
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function angleBetween(a: THREE.Vector3, b: THREE.Vector3) {
  return Math.acos(clamp(a.dot(b), -1, 1));
}

/** B-V colour index to an approximate display temperature in kelvin (Ballesteros 2012). */
export function temperatureFromBV(bv: number) {
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
}
