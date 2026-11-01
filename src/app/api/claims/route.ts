import { NextResponse } from 'next/server';
import { addClaim, listClaims } from '@/lib/claims-store';
import { skyMeta } from '@/lib/server-stars';

export const dynamic = 'force-dynamic';

const clean = (s: unknown, max: number) =>
  String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

export async function GET(req: Request) {
  const keeper = new URL(req.url).searchParams.get('keeper') ?? '';
  const all = await listClaims();
  return NextResponse.json({
    claims: all.map((c) => ({
      number: c.number, idx: c.idx, dedication: c.dedication, keeperName: c.keeperName,
      createdAt: c.createdAt, mine: !!keeper && c.keeper === keeper,
    })),
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const idx = Number(body?.idx);
  const keeper = clean(body?.keeper, 64);
  const m = await skyMeta();
  if (!Number.isInteger(idx) || idx < 0 || idx >= m.total || !keeper) {
    return NextResponse.json({ error: 'That star could not be found.' }, { status: 400 });
  }
  const dedication = clean(body?.dedication, 40);
  if (!dedication) return NextResponse.json({ error: 'Add a name or dedication for this star.' }, { status: 400 });
  const res = await addClaim({ idx, dedication, keeperName: clean(body?.keeperName, 30), keeper });
  if (!res.ok) return NextResponse.json({ error: 'Someone just kept this star. Pick another one nearby.' }, { status: 409 });
  const c = res.claim;
  return NextResponse.json({ claim: { number: c.number, idx: c.idx, dedication: c.dedication, keeperName: c.keeperName, createdAt: c.createdAt, mine: true } });
}
