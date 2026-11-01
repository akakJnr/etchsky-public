// DEMO STORAGE. Claims live in a JSON file so the keep flow can be tried end to end.
// The real registry is the on-chain contract; this module is replaced by the indexer's database.
import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface StoredClaim {
  number: string;
  idx: number;
  dedication: string;
  keeperName: string;
  keeper: string;
  createdAt: string;
  demo: true;
}

const FILE = path.join(process.cwd(), 'data', 'claims.json');
let queue: Promise<unknown> = Promise.resolve();

async function read(): Promise<StoredClaim[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf8')) as StoredClaim[];
  } catch {
    return [];
  }
}

export function listClaims() {
  return read();
}

export function getClaim(number: string) {
  return read().then((all) => all.find((c) => c.number === number));
}

export function addClaim(input: { idx: number; dedication: string; keeperName: string; keeper: string }) {
  const run = queue.then(async () => {
    const all = await read();
    if (all.some((c) => c.idx === input.idx)) return { ok: false as const, reason: 'taken' };
    const claim: StoredClaim = {
      number: `ETC-${String(all.length + 1).padStart(6, '0')}`,
      idx: input.idx,
      dedication: input.dedication,
      keeperName: input.keeperName,
      keeper: input.keeper,
      createdAt: new Date().toISOString(),
      demo: true,
    };
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    const tmp = `${FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify([...all, claim], null, 1));
    await fs.rename(tmp, FILE);
    return { ok: true as const, claim };
  });
  queue = run.catch(() => undefined);
  return run;
}
