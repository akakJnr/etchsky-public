import type { Constellation, SkyMeta, StarDetails } from './types';

export interface LevelData {
  /** unit directions, 3 floats per star */
  pos: Float32Array;
  /** apparent magnitude, ascending */
  mag: Float32Array;
  /** B-V colour index */
  ci: Float32Array;
  count: number;
  offset: number;
}

/** Splits a 16 byte record file (x, y, z float32, mag*100 int16, ci*1000 int16) into GPU-friendly arrays. */
export function decodeLevel(buf: ArrayBuffer, offset: number): LevelData {
  const count = buf.byteLength / 16;
  const f = new Float32Array(buf);
  const i16 = new Int16Array(buf);
  const pos = new Float32Array(count * 3);
  const mag = new Float32Array(count);
  const ci = new Float32Array(count);
  for (let k = 0; k < count; k++) {
    pos[k * 3] = f[k * 4];
    pos[k * 3 + 1] = f[k * 4 + 1];
    pos[k * 3 + 2] = f[k * 4 + 2];
    mag[k] = i16[k * 8 + 6] / 100;
    ci[k] = i16[k * 8 + 7] / 1000;
  }
  return { pos, mag, ci, count, offset };
}

export class SkyData {
  meta!: SkyMeta;
  constellations: Constellation[] = [];
  named = new Map<number, string>();
  private chunks = new Map<number, Promise<StarDetails[]>>();
  constructor(private base: string) {}

  private async json<T>(file: string): Promise<T> {
    const r = await fetch(`${this.base}/${file}`);
    if (!r.ok) throw new Error(`Could not load ${file} (${r.status})`);
    return r.json() as Promise<T>;
  }

  async loadMeta() {
    const [meta, cons, named] = await Promise.all([
      this.json<SkyMeta>('meta.json'),
      this.json<Constellation[]>('constellations.json'),
      this.json<Record<string, number>>('named.json'),
    ]);
    this.meta = meta;
    this.constellations = cons;
    for (const [name, idx] of Object.entries(named)) this.named.set(idx, name);
  }

  async loadLevel(level: number): Promise<LevelData> {
    const l = this.meta.levels[level];
    const r = await fetch(`${this.base}/${l.file}`);
    if (!r.ok) throw new Error(`Could not load ${l.file} (${r.status})`);
    return decodeLevel(await r.arrayBuffer(), l.offset);
  }

  private chunk(i: number) {
    let p = this.chunks.get(i);
    if (!p) {
      p = this.json<StarDetails[]>(`details/${i}.json`);
      p.catch(() => this.chunks.delete(i));
      this.chunks.set(i, p);
    }
    return p;
  }

  async details(idx: number): Promise<StarDetails> {
    const size = this.meta.chunk;
    const list = await this.chunk(Math.floor(idx / size));
    return list[idx % size];
  }

  /** Details that are already in memory, without waiting. */
  detailsSync(idx: number): StarDetails | undefined {
    // chunks resolve asynchronously; callers that need a sync read use the cache map below
    return this.resolved.get(idx);
  }
  private resolved = new Map<number, StarDetails>();
  async prefetch(idx: number) {
    const d = await this.details(idx);
    this.resolved.set(idx, d);
    return d;
  }

  private searchIndex?: Promise<[string, number, number][]>;
  search(): Promise<[string, number, number][]> {
    this.searchIndex ??= this.json<[string, number, number][]>('search.json');
    return this.searchIndex;
  }
}
