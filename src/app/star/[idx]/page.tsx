import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { starDetails } from '@/lib/server-stars';
import { bodyName, classify, fmtNum, fmtYear, lightLeftYear, lightYears } from '@/lib/astro';

type Params = { params: Promise<{ idx: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { idx } = await params;
  const d = await starDetails(Number(idx));
  if (!d) return { title: 'Star not found' };
  return { title: `${bodyName(d)}: a star on Etchsky`, description: `Explore ${bodyName(d)} in the Etchsky sky viewer.` };
}

export default async function StarPage({ params }: Params) {
  const { idx } = await params;
  const d = await starDetails(Number(idx));
  if (!d) notFound();
  const ly = lightYears(d);
  const year = lightLeftYear(d);
  return (
    <main className="page">
      <div className="wrap">
        <Link className="back" href="/">Etchsky</Link>
        <h1>{bodyName(d)}</h1>
        <p style={{ color: 'var(--mist)' }}>{classify(d).label}</p>
        {ly && year !== null && (
          <div className="light">
            <b>The light you see tonight left this star {ly > 300 ? 'around' : 'in'} {fmtYear(year)}.</b>
            <span>{fmtNum(ly, ly < 100 ? 1 : 0)} light years away.</span>
          </div>
        )}
        <div className="btns"><Link className="btn btn-primary" href={`/?star=${idx}`}>Open in the sky</Link></div>
      </div>
    </main>
  );
}
