import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Certificate from '@/components/Certificate';
import PrintButton from '@/components/PrintButton';
import { getClaim } from '@/lib/claims-store';
import { starDetails } from '@/lib/server-stars';
import { bodyName, lightLeftYear, lightYears } from '@/lib/astro';

type Params = { params: Promise<{ number: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { number } = await params;
  const claim = await getClaim(number);
  if (!claim) return { title: 'Record not found' };
  const d = await starDetails(claim.idx);
  const name = d ? bodyName(d) : 'A star';
  return { title: `${name}: ${claim.dedication}`, description: `${name} is kept in the Etchsky public record. “${claim.dedication}”` };
}

export default async function RecordPage({ params }: Params) {
  const { number } = await params;
  const claim = await getClaim(number);
  if (!claim) notFound();
  const d = await starDetails(claim.idx);
  const name = d ? bodyName(d) : 'A star';
  return (
    <main className="page">
      <div className="wrap">
        <Link className="back" href="/">Etchsky</Link>
        <Certificate
          starName={name}
          designation={d?.ds && d.ds !== name ? d.ds : undefined}
          dedication={claim.dedication}
          keeperName={claim.keeperName}
          number={claim.number}
          createdAt={claim.createdAt}
          lightYears={d ? lightYears(d) : null}
          lightYear={d ? lightLeftYear(d) : null}
        />
        <div className="btns">
          <Link className="btn btn-primary" href={`/?star=${claim.idx}`}>See it in the sky</Link>
          <PrintButton />
        </div>
      </div>
    </main>
  );
}
