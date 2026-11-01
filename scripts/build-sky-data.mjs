// Builds the Etchsky sky data from the HYG catalog (Hipparcos + Yale Bright Star + Gliese)
// and d3-celestial constellation data.
// Usage: node scripts/build-sky-data.mjs <hygdata.csv> <constellations.json> <constellations.lines.json>
import fs from 'node:fs';
import path from 'node:path';

const [hygPath, conPath, linePath] = process.argv.slice(2);
if (!hygPath || !conPath || !linePath) {
  console.error('usage: build-sky-data.mjs <hygdata.csv> <constellations.json> <constellations.lines.json>');
  process.exit(1);
}
const out = path.resolve('public/sky');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'details'), { recursive: true });

// ---- CSV parsing (handles quoted fields) ----
function parseLine(line) {
  const cells = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { cells.push(cur); cur = ''; }
    else cur += ch;
  }
  cells.push(cur);
  return cells;
}
const lines = fs.readFileSync(hygPath, 'utf8').split(/\r?\n/).filter(Boolean);
const head = parseLine(lines[0]);
const col = Object.fromEntries(head.map((h, i) => [h, i]));
const num = (v) => (v === '' || v === undefined ? null : Number(v));

// ---- constellations ----
const conFile = JSON.parse(fs.readFileSync(conPath, 'utf8'));
const lineFile = JSON.parse(fs.readFileSync(linePath, 'utf8'));
const conInfo = {};
for (const f of conFile.features) {
  conInfo[f.id] = { name: f.properties.name, en: f.properties.en, gen: f.properties.gen, label: f.geometry.coordinates };
}
const wrap = (lon) => (lon < 0 ? lon + 360 : lon);
const constellations = lineFile.features
  .filter((f) => conInfo[f.id])
  .map((f) => ({
    id: f.id,
    name: conInfo[f.id].name,
    en: conInfo[f.id].en,
    label: [Number(wrap(conInfo[f.id].label[0]).toFixed(3)), conInfo[f.id].label[1]],
    lines: f.geometry.coordinates.map((ln) => ln.map(([lon, lat]) => [Number(wrap(lon).toFixed(3)), lat])),
  }));
fs.writeFileSync(path.join(out, 'constellations.json'), JSON.stringify(constellations));

// ---- stars ----
const GREEK = { Alp: 'α', Bet: 'β', Gam: 'γ', Del: 'δ', Eps: 'ε', Zet: 'ζ', Eta: 'η', The: 'θ', Iot: 'ι', Kap: 'κ', Lam: 'λ', Mu: 'μ', Nu: 'ν', Xi: 'ξ', Omi: 'ο', Pi: 'π', Rho: 'ρ', Sig: 'σ', Tau: 'τ', Ups: 'υ', Phi: 'φ', Chi: 'χ', Psi: 'ψ', Ome: 'ω' };
const SUP = { 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
function designation(bayer, flam, con) {
  const gen = conInfo[con]?.gen;
  if (!gen) return '';
  if (bayer) {
    const m = /^([A-Za-z]{3})-?(\d*)$/.exec(bayer);
    if (m && GREEK[m[1]]) return `${GREEK[m[1]]}${m[2] ? [...m[2]].map((d) => SUP[d] || d).join('') : ''} ${gen}`;
  }
  if (flam) return `${flam} ${gen}`;
  return '';
}

const rows = [];
for (let i = 1; i < lines.length; i++) {
  const c = parseLine(lines[i]);
  const id = Number(c[col.id]);
  if (id === 0) continue; // the Sun is handled separately
  const mag = num(c[col.mag]);
  if (mag === null) continue;
  const rarad = Number(c[col.rarad]);
  const decrad = Number(c[col.decrad]);
  let dist = num(c[col.dist]);
  if (dist === null || dist >= 99999 || dist <= 0) dist = null;
  let ci = num(c[col.ci]);
  rows.push({
    id, hip: c[col.hip], hd: c[col.hd], hr: c[col.hr], gl: c[col.gl].trim(),
    proper: c[col.proper], bayer: c[col.bayer], flam: c[col.flam], con: c[col.con],
    spect: c[col.spect], dist, absmag: num(c[col.absmag]), lum: num(c[col.lum]),
    ra: num(c[col.ra]), dec: num(c[col.dec]), ci, mag, rarad, decrad,
    pmra: num(c[col.pmra]), pmdec: num(c[col.pmdec]), rv: num(c[col.rv]), var: c[col['var']],
  });
}
rows.sort((a, b) => a.mag - b.mag);

const LEVELS = [
  { name: 'L0', max: 6.5 },
  { name: 'L1', max: 9 },
  { name: 'L2', max: 99 },
];
const levelOf = (m) => LEVELS.findIndex((l) => m <= l.max);
const buffers = LEVELS.map(() => []);
rows.forEach((r) => buffers[levelOf(r.mag)].push(r));
const ordered = buffers.flat(); // global index = position in this array

const meta = { version: 1, source: 'HYG v4.1 (Hipparcos, Yale Bright Star, Gliese). CC BY-SA 4.0.', levels: [], total: ordered.length, chunk: 1024 };
let offset = 0;
buffers.forEach((arr, li) => {
  const buf = Buffer.alloc(arr.length * 16);
  arr.forEach((r, k) => {
    const cd = Math.cos(r.decrad);
    const x = cd * Math.cos(r.rarad);
    const y = Math.sin(r.decrad);
    const z = -cd * Math.sin(r.rarad);
    const o = k * 16;
    buf.writeFloatLE(x, o); buf.writeFloatLE(y, o + 4); buf.writeFloatLE(z, o + 8);
    buf.writeInt16LE(Math.round(r.mag * 100), o + 12);
    const ci = r.ci === null ? 0.6 : Math.max(-0.4, Math.min(2.2, r.ci));
    buf.writeInt16LE(Math.round(ci * 1000), o + 14);
  });
  fs.writeFileSync(path.join(out, `stars-${LEVELS[li].name}.bin`), buf);
  meta.levels.push({ name: LEVELS[li].name, file: `stars-${LEVELS[li].name}.bin`, count: arr.length, offset, maxMag: LEVELS[li].max });
  offset += arr.length;
});

// ---- details chunks + search index ----
function label(r) {
  return r.proper || designation(r.bayer, r.flam, r.con) || (r.hip ? `HIP ${r.hip}` : r.hd ? `HD ${r.hd}` : r.gl ? r.gl : `HYG ${r.id}`);
}
const search = [];
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== null && v !== undefined && v !== 0));
for (let start = 0; start < ordered.length; start += meta.chunk) {
  const slice = ordered.slice(start, start + meta.chunk).map((r, k) => {
    const idx = start + k;
    const desig = designation(r.bayer, r.flam, r.con);
    if (r.proper) search.push([r.proper, idx, r.mag]);
    if (desig && (r.proper || r.mag <= 6.5)) search.push([desig, idx, r.mag]);
    if (r.hip && r.mag <= 6.5) search.push([`HIP ${r.hip}`, idx, r.mag]);
    if (r.gl && r.dist && r.dist < 25) search.push([r.gl, idx, r.mag]);
    return clean({
      h: r.id, hip: r.hip, hd: r.hd, hr: r.hr, gl: r.gl, n: r.proper, ds: desig, c: r.con,
      s: r.spect, d: r.dist && Number(r.dist.toFixed(3)), am: r.absmag && Number(r.absmag.toFixed(2)),
      l: r.lum && Number(r.lum.toPrecision(4)), ra: r.ra && Number(r.ra.toFixed(5)), de: r.dec && Number(r.dec.toFixed(5)),
      ci: r.ci, m: r.mag, pa: r.pmra, pd: r.pmdec, rv: r.rv, v: r.var, lb: label(r),
    });
  });
  fs.writeFileSync(path.join(out, 'details', `${start / meta.chunk}.json`), JSON.stringify(slice));
}
fs.writeFileSync(path.join(out, 'search.json'), JSON.stringify(search));
fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify(meta, null, 1));

const proper = ordered.map((r, i) => [r.proper, i]).filter(([n]) => n);
fs.writeFileSync(path.join(out, 'named.json'), JSON.stringify(Object.fromEntries(proper)));
// stars whose light left in a given year, for the "light from your birth year" journey
const birth = [];
ordered.forEach((r, i) => {
  const ly = r.dist ? r.dist * 3.26156 : 0;
  if (ly >= 1 && ly <= 125 && r.mag <= 7.5) birth.push([Math.round(ly), i, r.mag]);
});
birth.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
fs.writeFileSync(path.join(out, 'birth.json'), JSON.stringify(birth));
console.log('stars', ordered.length, meta.levels.map((l) => `${l.name}:${l.count}`).join(' '), 'named', proper.length, 'search', search.length, 'constellations', constellations.length);
