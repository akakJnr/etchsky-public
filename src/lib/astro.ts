import type { StarDetails } from '@/engine/types';

export const LY_PER_PC = 3.26156;
export const SUN_TEMP = 5772;

export const nowYear = () => new Date().getFullYear();

export function lightYears(d: StarDetails): number | null {
  return d.d ? d.d * LY_PER_PC : null;
}

/** The year the light we see tonight left the star. */
export function lightLeftYear(d: StarDetails): number | null {
  const ly = lightYears(d);
  return ly === null ? null : Math.round(nowYear() - ly);
}

export function fmtYear(y: number) {
  return y < 1 ? `${1 - y} BCE` : `${y}`;
}

export function fmtNum(n: number, digits = 0) {
  return n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

/** B-V colour index to temperature in kelvin (Ballesteros 2012). */
export function tempFromCI(ci: number) {
  return 4600 * (1 / (0.92 * ci + 1.7) + 1 / (0.92 * ci + 0.62));
}

export function colorName(ci?: number) {
  if (ci === undefined) return 'unknown colour';
  if (ci < -0.1) return 'blue-white';
  if (ci < 0.2) return 'white';
  if (ci < 0.5) return 'yellow-white';
  if (ci < 0.8) return 'yellow';
  if (ci < 1.2) return 'orange';
  return 'red-orange';
}

export function colorCss(ci?: number) {
  const stops: [number, [number, number, number]][] = [
    [-0.2, [175, 198, 255]], [0.15, [244, 246, 255]], [0.65, [255, 241, 214]], [1.2, [255, 197, 138]], [1.9, [255, 154, 122]],
  ];
  const c = ci ?? 0.6;
  if (c <= stops[0][0]) return `rgb(${stops[0][1].join(',')})`;
  for (let i = 1; i < stops.length; i++) {
    if (c <= stops[i][0]) {
      const [a, ca] = stops[i - 1];
      const [b, cb] = stops[i];
      const t = (c - a) / (b - a);
      return `rgb(${ca.map((v, k) => Math.round(v + (cb[k] - v) * t)).join(',')})`;
    }
  }
  return `rgb(${stops[stops.length - 1][1].join(',')})`;
}

export type Kind = 'white-dwarf' | 'supergiant' | 'giant' | 'dwarf' | 'subgiant' | 'unknown';

export function classify(d: StarDetails): { kind: Kind; letter: string; label: string } {
  const s = (d.s ?? '').trim();
  const letter = /^[OBAFGKM]/.test(s) ? s[0] : s.startsWith('D') ? 'D' : '';
  let kind: Kind = 'unknown';
  if (letter === 'D') kind = 'white-dwarf';
  else if (/I[ab]?(?![IV])/.test(s) && !/III|IV|II|V/.test(s.replace(/Iab?|Ib?/, ''))) kind = 'supergiant';
  else if (/Ia|Ib|II(?!I)/.test(s)) kind = 'supergiant';
  else if (/III/.test(s)) kind = 'giant';
  else if (/IV/.test(s)) kind = 'subgiant';
  else if (/V/.test(s) || /^[OBAFGKM]\d?(\.\d)?$/.test(s)) kind = 'dwarf';
  const color = colorName(d.ci);
  let label: string;
  switch (kind) {
    case 'white-dwarf': label = 'white dwarf'; break;
    case 'supergiant': label = `${color} supergiant`; break;
    case 'giant': label = `${color} giant`; break;
    case 'subgiant': label = `${color} subgiant`; break;
    case 'dwarf':
      label = letter === 'M' ? 'red dwarf' : letter === 'K' ? 'orange dwarf' : letter === 'G' ? 'yellow dwarf'
        : letter === 'F' ? 'yellow-white dwarf' : letter === 'A' ? 'white star' : letter === 'B' ? 'blue-white star' : letter === 'O' ? 'blue star' : `${color} star`;
      break;
    default: label = `${color} star`;
  }
  return { kind, letter, label };
}

export function radiusInSuns(d: StarDetails): number | null {
  if (!d.l || d.ci === undefined) return null;
  const t = tempFromCI(d.ci);
  if (!isFinite(t) || t < 2000 || t > 50000) return null;
  return Math.sqrt(d.l) / Math.pow(t / SUN_TEMP, 2);
}

export const nakedEyeLimit = 6.5;

export function visibility(mag: number) {
  if (mag <= 1.5) return { text: 'Yes, and it is one of the brightest stars in the sky.', eye: true };
  if (mag <= 4.5) return { text: 'Yes, from a dark spot or even a city on a clear night.', eye: true };
  if (mag <= nakedEyeLimit) return { text: 'Only from a dark sky, away from city lights.', eye: true };
  if (mag <= 10) return { text: 'Not with the naked eye. Binoculars or a small telescope will show it.', eye: false };
  return { text: 'Not with the naked eye. It needs a telescope.', eye: false };
}

export function bodyName(d: StarDetails) {
  return d.n || d.ds || d.lb;
}

export function catalogIds(d: StarDetails) {
  const ids: [string, string][] = [];
  if (d.hip) ids.push(['Hipparcos', String(d.hip)]);
  if (d.hd) ids.push(['Henry Draper', String(d.hd)]);
  if (d.hr) ids.push(['Bright Star', String(d.hr)]);
  if (d.gl) ids.push(['Gliese', d.gl.replace(/^(GJ|Gl|NN)\s*/i, '')]);
  ids.push(['HYG', String(d.h)]);
  return ids;
}

export function hms(h?: number) {
  if (h === undefined) return '';
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const ss = ((h - hh) * 60 - mm) * 60;
  return `${hh}h ${String(mm).padStart(2, '0')}m ${ss.toFixed(1).padStart(4, '0')}s`;
}
export function dms(d?: number) {
  if (d === undefined) return '';
  const sign = d < 0 ? '−' : '+';
  const a = Math.abs(d);
  const dd = Math.floor(a);
  const mm = Math.floor((a - dd) * 60);
  const ss = ((a - dd) * 60 - mm) * 60;
  return `${sign}${dd}° ${String(mm).padStart(2, '0')}′ ${ss.toFixed(0).padStart(2, '0')}″`;
}
