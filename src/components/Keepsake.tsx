'use client';

import { useEffect, useState } from 'react';
import type { Sky } from '@/engine/sky';
import { bodyName, lightLeftYear, lightYears } from '@/lib/astro';
import type { KeptStar } from '@/lib/keeper';
import type { StarDetails } from '@/engine/types';
import Certificate from './Certificate';

export default function Keepsake({ claim, sky, onClose, onFind, onShare }: {
  claim: KeptStar; sky: Sky; onClose: () => void; onFind: () => void; onShare: (c: KeptStar) => void;
}) {
  const [d, setD] = useState<StarDetails | null>(null);
  useEffect(() => { sky.getData().prefetch(claim.idx).then(setD).catch(() => undefined); }, [claim.idx, sky]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet glass" role="dialog" aria-modal="true" aria-label="Your kept star">
        <h2>It's yours to keep</h2>
        <p className="lead">{d ? bodyName(d) : 'Your star'} now carries your words in the public record.</p>
        <Certificate
          starName={d ? bodyName(d) : 'Your star'}
          designation={d?.ds && d.ds !== bodyName(d) ? d.ds : undefined}
          dedication={claim.dedication}
          keeperName={claim.keeperName}
          number={claim.number}
          createdAt={claim.createdAt}
          lightYears={d ? lightYears(d) : null}
          lightYear={d ? lightLeftYear(d) : null}
        />
        <div className="share-row">
          <button className="btn btn-keep" onClick={() => onShare(claim)}>Share</button>
          <button className="btn" onClick={onFind}>See it in the sky</button>
          <a className="btn" href={`/record/${claim.number}`} target="_blank" rel="noreferrer">Print certificate</a>
        </div>
        <div className="actions" style={{ justifyContent: 'center' }}>
          <button className="btn btn-ghost" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
