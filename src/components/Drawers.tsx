'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Sky } from '@/engine/sky';
import type { Layers } from '@/engine/types';
import { JOURNEYS, type Journey } from '@/lib/journeys';
import { nowYear } from '@/lib/astro';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* ---------------- search ---------------- */
export function SearchDrawer({ sky, onPick, onClose }: { sky: Sky; onPick: (idx: number) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [index, setIndex] = useState<[string, number, number][] | null>(null);
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    let live = true;
    sky.getData().search().then((s) => live && setIndex(s)).catch(() => live && setIndex([]));
    return () => { live = false; };
  }, [sky]);

  const folded = useMemo(() => index?.map(([n, i, m]) => ({ n, f: fold(n), i, m })) ?? [], [index]);
  const results = useMemo(() => {
    const t = fold(q.trim());
    if (t.length < 1) return [];
    const starts: typeof folded = [];
    const has: typeof folded = [];
    const seen = new Set<number>();
    for (const r of folded) {
      if (r.f.startsWith(t)) starts.push(r);
      else if (r.f.includes(t)) has.push(r);
    }
    const out: typeof folded = [];
    for (const r of [...starts.sort((a, b) => a.m - b.m), ...has.sort((a, b) => a.m - b.m)]) {
      if (seen.has(r.i)) continue;
      seen.add(r.i);
      out.push(r);
      if (out.length >= 8) break;
    }
    return out;
  }, [q, folded]);

  useEffect(() => setCursor(0), [q]);

  const surprise = () => {
    const named = [...sky.getData().named.keys()];
    const pool = named.length ? named : [0];
    onPick(pool[Math.floor(Math.random() * pool.length)]);
  };

  return (
    <div className="drawer glass" role="dialog" aria-label="Search for a star">
      <h2>Find a star</h2>
      <p className="sub">Search by name, such as Sirius or Vega, or by catalogue number.</p>
      <input
        ref={input}
        className="search-in"
        type="search"
        value={q}
        placeholder="Search 15,000 named stars"
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(results.length - 1, c + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
          else if (e.key === 'Enter' && results[cursor]) onPick(results[cursor].i);
          else if (e.key === 'Escape') onClose();
        }}
        aria-label="Star name or catalogue number"
      />
      {q && results.length === 0 && index && <p className="empty">No star matches “{q}”. Try a proper name like Rigel, or a number like HIP 32349.</p>}
      {results.length > 0 && (
        <ul className="results" role="listbox">
          {results.map((r, k) => (
            <li key={r.i} role="presentation">
              <button role="option" aria-selected={k === cursor} onClick={() => onPick(r.i)}>
                <span className="nm">{r.n}</span>
                <span className="mg">magnitude {r.m.toFixed(1)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div style={{ marginTop: 14 }}>
        <button className="btn btn-sm" onClick={surprise}>Surprise me</button>
      </div>
    </div>
  );
}

/* ---------------- layers ---------------- */
function Toggle({ label, hint, on, set }: { label: string; hint?: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <div className="switch-row">
      <div>
        <div>{label}</div>
        {hint && <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>{hint}</div>}
      </div>
      <button className="switch" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} />
    </div>
  );
}

export function LayersDrawer({ layers, onLayers, quality, onQuality }: {
  layers: Layers; onLayers: (l: Partial<Layers>) => void; quality: 'auto' | 0 | 1 | 2; onQuality: (q: 'auto' | 0 | 1 | 2) => void;
}) {
  return (
    <div className="drawer glass" role="dialog" aria-label="Sky layers">
      <h2>Sky layers</h2>
      <p className="sub">Choose what to show on the sky.</p>
      <Toggle label="Constellation lines" on={layers.lines} set={(v) => onLayers({ lines: v })} />
      <Toggle label="Names" hint="Stars and constellations" on={layers.names} set={(v) => onLayers({ names: v })} />
      <Toggle label="Coordinate grid" on={layers.grid} set={(v) => onLayers({ grid: v })} />
      <Toggle label="Kept stars" hint="Stars with a name in the record" on={layers.claims} set={(v) => onLayers({ claims: v })} />
      <div className="switch-row">
        <div>Detail</div>
        <div className="seg" role="group" aria-label="Detail level">
          {(['auto', 0, 1, 2] as const).map((q) => (
            <button key={String(q)} aria-pressed={quality === q} onClick={() => onQuality(q)}>
              {q === 'auto' ? 'Auto' : q === 0 ? 'Light' : q === 1 ? 'Medium' : 'High'}
            </button>
          ))}
        </div>
      </div>
      <p className="credits">
        Star data: HYG database v4.1 (Hipparcos, Yale Bright Star and Gliese catalogues), licensed CC BY-SA 4.0, from{' '}
        <a href="https://github.com/astronexus/HYG-Database" target="_blank" rel="noreferrer">astronexus</a>.
        Constellation lines: d3-celestial by Olaf Frohn (BSD 3-clause).
      </p>
    </div>
  );
}

/* ---------------- journeys ---------------- */
export function JourneysDrawer({ onStart, onBirth }: { onStart: (j: Journey) => void; onBirth: (year: number) => Promise<string | undefined> }) {
  const [year, setYear] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="drawer glass" role="dialog" aria-label="Guided journeys">
      <h2>Journeys</h2>
      <p className="sub">Short guided tours. Each stop flies you to a star.</p>
      <ul className="journey-list">
        {JOURNEYS.map((j) => (
          <li key={j.id}>
            <button onClick={() => onStart(j)}>
              <b>{j.title}</b>
              <span>{j.blurb}</span>
            </button>
          </li>
        ))}
      </ul>
      <form
        style={{ marginTop: 16 }}
        onSubmit={async (e) => {
          e.preventDefault();
          const y = Number(year);
          if (!Number.isInteger(y) || y < 1850 || y > nowYear()) { setMsg(`Enter a year between 1850 and ${nowYear()}.`); return; }
          setBusy(true);
          setMsg('');
          const err = await onBirth(y);
          setBusy(false);
          if (err) setMsg(err);
        }}
      >
        <b style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 17 }}>Light from your birth year</b>
        <p className="sub" style={{ margin: '2px 0 0' }}>Find stars whose light left them when you were born, and is only reaching you now.</p>
        <div className="birth">
          <input inputMode="numeric" placeholder="Year you were born" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} aria-label="Year you were born" />
          <button className="btn btn-primary btn-sm" disabled={busy || year.length < 4} style={{ minHeight: 44 }}>Find stars</button>
        </div>
        {msg && <p className="err">{msg}</p>}
      </form>
    </div>
  );
}
