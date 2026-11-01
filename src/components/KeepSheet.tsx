'use client';

import { useEffect, useRef, useState } from 'react';
import type { StarDetails } from '@/engine/types';
import { bodyName } from '@/lib/astro';
import { fmtUsd, priceFor } from '@/lib/pricing';
import { keeperId, type KeptStar } from '@/lib/keeper';

export default function KeepSheet({ idx, d, onClose, onDone, onTaken }: {
  idx: number; d: StarDetails; onClose: () => void; onDone: (c: KeptStar) => void; onTaken: () => void;
}) {
  const [step, setStep] = useState(0);
  const [ded, setDed] = useState('');
  const [who, setWho] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const first = useRef<HTMLInputElement>(null);
  const price = priceFor(d);
  const name = bodyName(d);

  useEffect(() => { first.current?.focus(); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [busy, onClose]);

  const submit = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idx, dedication: ded, keeperName: who, keeper: keeperId() }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error ?? 'Something went wrong. Try again.');
        if (r.status === 409) onTaken();
        setBusy(false);
        return;
      }
      onDone({ ...j.claim, mine: true });
    } catch {
      setErr('Could not reach the server. Check your connection and try again.');
      setBusy(false);
    }
  };

  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="sheet glass" role="dialog" aria-modal="true" aria-label={`Keep ${name}`}>
        <div className="steps" aria-hidden><i className="on" /><i className={step >= 1 ? 'on' : ''} /></div>
        {step === 0 && (
          <form onSubmit={(e) => { e.preventDefault(); if (!ded.trim()) { setErr('Add a name or dedication for this star.'); return; } setErr(''); setStep(1); }}>
            <h2>Put a name on {name}</h2>
            <p className="lead">It will appear next to the star in the public record. You can use your name, a loved one's, or a short message.</p>
            <label htmlFor="ded">Name or dedication</label>
            <input id="ded" ref={first} type="text" maxLength={40} value={ded} onChange={(e) => setDed(e.target.value)} placeholder="For Amara, always" autoComplete="off" />
            <label htmlFor="who">Your name, shown as the keeper (optional)</label>
            <input id="who" type="text" maxLength={30} value={who} onChange={(e) => setWho(e.target.value)} autoComplete="name" />
            <div className="preview" aria-hidden>
              <span className="ring" /><span className="dot" />
              <span className="txt">{ded.trim() || 'Your words appear here'}</span>
            </div>
            {err && <p className="err" role="alert">{err}</p>}
            <div className="actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-keep">Continue</button>
            </div>
          </form>
        )}
        {step === 1 && (
          <div>
            <h2>Review and keep</h2>
            <p className="lead">Check the details. Once a star is kept, no one else can keep it.</p>
            <dl className="summary">
              <div><dt>Star</dt><dd>{name}</dd></div>
              <div><dt>Dedication</dt><dd>{ded.trim()}</dd></div>
              {who.trim() && <div><dt>Keeper</dt><dd>{who.trim()}</dd></div>}
              <div><dt>Price</dt><dd>{fmtUsd(price.usd)}</dd></div>
            </dl>
            <p className="notice demo">This is a demo. No payment is taken, and the record is stored for testing only.</p>
            <p className="credits" style={{ marginTop: 0 }}>A kept star is a symbolic public record. It does not give legal ownership of the star, and astronomers do not recognise star naming for official catalogues.</p>
            {err && <p className="err" role="alert">{err}</p>}
            <div className="actions">
              <button className="btn btn-ghost" onClick={() => { setStep(0); setErr(''); }} disabled={busy}>Back</button>
              <button className="btn btn-keep" onClick={submit} disabled={busy}>{busy ? 'Keeping…' : `Keep this star for ${fmtUsd(price.usd)}`}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
