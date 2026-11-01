import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { StarDetails } from '@/engine/types';

const DIR = path.join(process.cwd(), 'public', 'sky');
let meta: { total: number; chunk: number } | undefined;

export async function skyMeta() {
  meta ??= JSON.parse(await fs.readFile(path.join(DIR, 'meta.json'), 'utf8'));
  return meta!;
}

export async function starDetails(idx: number): Promise<StarDetails | null> {
  const m = await skyMeta();
  if (!Number.isInteger(idx) || idx < 0 || idx >= m.total) return null;
  const chunk = JSON.parse(await fs.readFile(path.join(DIR, 'details', `${Math.floor(idx / m.chunk)}.json`), 'utf8')) as StarDetails[];
  return chunk[idx % m.chunk] ?? null;
}
