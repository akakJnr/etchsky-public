import { fmtYear } from '@/lib/astro';

export interface CertProps {
  starName: string;
  designation?: string;
  dedication: string;
  keeperName?: string;
  number: string;
  createdAt: string;
  lightYear?: number | null;
  lightYears?: number | null;
}

export default function Certificate(p: CertProps) {
  const date = new Date(p.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return (
    <div className="certificate">
      <div className="star" aria-hidden />
      <p className="small">Etchsky public record</p>
      <h3>{p.starName}</h3>
      {p.designation && <p className="small">{p.designation}</p>}
      <p className="ded">{p.dedication}</p>
      <p className="meta">
        Record <span className="num">{p.number}</span>
        <br />
        Kept {date}{p.keeperName ? ` by ${p.keeperName}` : ''}
        {p.lightYears && p.lightYear ? (
          <>
            <br />
            {Math.round(p.lightYears)} light years away. Its light left in {fmtYear(p.lightYear)}.
          </>
        ) : null}
      </p>
      <p className="small" style={{ marginTop: 14, fontSize: 11.5 }}>A symbolic record. It does not give legal ownership of the star.</p>
    </div>
  );
}
