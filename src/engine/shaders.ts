// All star colours come from the measured B-V colour index. The ramp goes blue-white, white, cream, orange, red.
const RAMP = /* glsl */ `
vec3 starColor(float ci) {
  vec3 a = vec3(0.686, 0.776, 1.000);
  vec3 b = vec3(0.957, 0.965, 1.000);
  vec3 c = vec3(1.000, 0.945, 0.840);
  vec3 d = vec3(1.000, 0.773, 0.541);
  vec3 e = vec3(1.000, 0.604, 0.478);
  if (ci < -0.2) return a;
  if (ci < 0.15) return mix(a, b, (ci + 0.2) / 0.35);
  if (ci < 0.65) return mix(b, c, (ci - 0.15) / 0.5);
  if (ci < 1.2) return mix(c, d, (ci - 0.65) / 0.55);
  if (ci < 1.9) return mix(d, e, (ci - 1.2) / 0.7);
  return e;
}`;

export const starVertex = /* glsl */ `
attribute float aMag;
attribute float aCi;
uniform float uLimMag;
uniform float uPx;
uniform float uFade;
uniform float uTime;
uniform float uShimmer;
varying vec3 vColor;
varying float vAlpha;
varying float vHalo;
varying float vSpike;
${RAMP}
void main() {
  float d = uLimMag - aMag;
  float vis = smoothstep(-0.6, 0.7, d);
  float s = 1.15 + 1.9 * pow(max(d, 0.0), 0.8);
  s = min(s, 30.0);
  float h = fract(sin(dot(position.xy + position.z, vec2(12.9898, 78.233))) * 43758.5453);
  float tw = 1.0 + uShimmer * 0.07 * sin(uTime * (1.4 + h * 2.0) + h * 40.0) * step(aMag, 3.0);
  gl_PointSize = s * uPx * tw;
  vAlpha = vis * uFade * (0.3 + 0.7 * clamp(d / 3.5, 0.0, 1.0));
  vColor = starColor(aCi);
  vHalo = smoothstep(5.0, 13.0, s);
  vSpike = smoothstep(14.0, 26.0, s);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position * 10.0, 1.0);
}`;

export const starFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vHalo;
varying float vSpike;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float r = length(p) * 2.0;
  float core = exp(-r * r * 9.0);
  float halo = exp(-r * r * 3.2) * 0.38 * vHalo;
  float spike = (exp(-abs(p.x) * 70.0) * exp(-abs(p.y) * 5.0) + exp(-abs(p.y) * 70.0) * exp(-abs(p.x) * 5.0)) * 0.55 * vSpike;
  float edge = smoothstep(1.0, 0.7, r);
  float a = (core + halo + spike) * vAlpha * edge;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor * a, a);
}`;

export const claimVertex = /* glsl */ `
attribute float aMine;
uniform float uPx;
uniform float uTime;
varying float vMine;
varying float vPulse;
void main() {
  vMine = aMine;
  vPulse = 0.5 + 0.5 * sin(uTime * 1.6);
  gl_PointSize = (aMine > 0.5 ? 46.0 : 36.0) * uPx;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position * 10.0, 1.0);
}`;

export const claimFragment = /* glsl */ `
varying float vMine;
varying float vPulse;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float r = length(p) * 2.0;
  float ringR = vMine > 0.5 ? 0.52 + 0.04 * vPulse : 0.5;
  float ring = exp(-pow((r - ringR) * 14.0, 2.0));
  float glow = exp(-r * r * 6.0) * (vMine > 0.5 ? 0.35 + 0.25 * vPulse : 0.16);
  float a = (ring * 0.95 + glow) * smoothstep(1.0, 0.85, r);
  if (a < 0.01) discard;
  vec3 gold = vec3(0.961, 0.769, 0.318);
  gl_FragColor = vec4(gold * a, a);
}`;

export const lineVertex = /* glsl */ `
void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position * 10.0, 1.0); }`;
export const lineFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
void main() { gl_FragColor = vec4(uColor * uAlpha, uAlpha); }`;

// Procedural Milky Way, drawn once into a galactic-coordinate texture.
export const mwBakeVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export const mwBakeFragment = /* glsl */ `
precision highp float;
varying vec2 vUv;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5; float s = 0.0; for (int i = 0; i < 6; i++) { s += a * noise(p); p *= 2.07; a *= 0.5; } return s; }
void main() {
  float l = (vUv.x - 0.5) * 6.2831853;
  float b = (vUv.y - 0.5) * 3.14159265;
  vec3 g = vec3(cos(b) * cos(l), cos(b) * sin(l), sin(b));
  float disc = exp(-pow(b / 0.11, 2.0)) * 0.55 + exp(-pow(b / 0.38, 2.0)) * 0.2;
  float bulge = exp(-(l * l) / 0.5 - (b * b) / 0.06) * 0.7;
  float cloud = fbm(g * 5.0);
  float fine = fbm(g * 16.0 + 3.0);
  float dust = smoothstep(0.52, 0.78, fbm(g * 8.0 + 11.0)) * exp(-pow(b / 0.075, 2.0));
  float rift = exp(-pow((b - 0.02 * sin(l * 3.0)) / 0.03, 2.0)) * smoothstep(0.35, 0.7, fbm(g * 4.0 + 5.0)) * step(0.0, cos(l * 0.5 + 0.4));
  float v = (disc * (0.55 + 0.9 * cloud) + bulge) * (0.7 + 0.6 * fine);
  v *= 1.0 - clamp(dust * 0.85 + rift * 0.6, 0.0, 0.92);
  vec3 cool = vec3(0.42, 0.52, 0.80);
  vec3 warm = vec3(1.00, 0.80, 0.58);
  vec3 col = mix(cool, warm, clamp(bulge * 1.4 + disc * 0.15 * smoothstep(0.4, 0.9, fine), 0.0, 1.0));
  float haze = exp(-pow(b / 0.9, 2.0)) * 0.03 * (0.5 + cloud);
  gl_FragColor = vec4(col * v * 0.5 + vec3(0.2, 0.3, 0.6) * haze, 1.0);
}`;

export const mwSkyVertex = /* glsl */ `
varying vec3 vDir;
void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position * 50.0, 1.0); }`;

export const mwSkyFragment = /* glsl */ `
uniform sampler2D uMw;
uniform float uAmount;
varying vec3 vDir;
void main() {
  // engine frame (x, y up, z) back to equatorial (X, Y, Z)
  vec3 e = normalize(vec3(vDir.x, -vDir.z, vDir.y));
  vec3 g = vec3(
    -0.0548755604 * e.x - 0.8734370902 * e.y - 0.4838350155 * e.z,
     0.4941094279 * e.x - 0.4448296300 * e.y + 0.7469822445 * e.z,
    -0.8676661490 * e.x - 0.1980763734 * e.y + 0.4559837762 * e.z);
  float l = atan(g.y, g.x);
  float b = asin(clamp(g.z, -1.0, 1.0));
  vec2 uv = vec2(l / 6.2831853 + 0.5, b / 3.14159265 + 0.5);
  vec3 mw = texture2D(uMw, uv).rgb * uAmount;
  vec3 base = vec3(0.0235, 0.0353, 0.0706);
  gl_FragColor = vec4(base + mw, 1.0);
}`;
