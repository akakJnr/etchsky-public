export interface StarRef {
  idx: number;
  /** right ascension in radians */
  ra: number;
  /** declination in radians */
  dec: number;
  mag: number;
  name?: string;
}

export interface StarDetails {
  h: number;
  hip?: string | number;
  hd?: string | number;
  hr?: string | number;
  gl?: string;
  /** proper name */
  n?: string;
  /** designation such as "α Orionis" */
  ds?: string;
  /** constellation id (IAU abbreviation) */
  c?: string;
  /** spectral type */
  s?: string;
  /** distance in parsecs */
  d?: number;
  /** absolute magnitude */
  am?: number;
  /** luminosity in solar units */
  l?: number;
  /** right ascension in hours */
  ra?: number;
  /** declination in degrees */
  de?: number;
  /** B-V colour index */
  ci?: number;
  /** apparent magnitude */
  m: number;
  /** proper motion RA / Dec in mas per year */
  pa?: number;
  pd?: number;
  /** radial velocity km/s */
  rv?: number;
  /** variable star id */
  v?: string;
  /** display label */
  lb: string;
}

export interface Constellation {
  id: string;
  name: string;
  en: string;
  /** [ra degrees, dec degrees] */
  label: [number, number];
  lines: [number, number][][];
}

export interface SkyMeta {
  version: number;
  source: string;
  total: number;
  chunk: number;
  levels: { name: string; file: string; count: number; offset: number; maxMag: number }[];
}

export interface Claim {
  idx: number;
  mine?: boolean;
  dedication?: string;
}

export interface Layers {
  lines: boolean;
  names: boolean;
  grid: boolean;
  claims: boolean;
}

export interface ViewState {
  /** radians */
  lon: number;
  lat: number;
  /** degrees, vertical field of view */
  fov: number;
}

export interface SkyStats {
  fps: number;
  frameMs: number;
  tier: number;
  drawn: number;
  loaded: number;
  pixelRatio: number;
}

export type SkyEvents = {
  hover: StarRef | null;
  select: StarRef | null;
  view: ViewState;
  stats: SkyStats;
  ready: null;
  loaded: { level: number; total: number };
  error: string;
};
